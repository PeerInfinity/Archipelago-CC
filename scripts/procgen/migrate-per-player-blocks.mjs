#!/usr/bin/env node
/**
 * migrate-per-player-blocks.mjs — **THE SHAPE MOVES of the committed corpus's
 * top-level per-player keys into their per-player homes**, and the census that
 * keeps them moved:
 *   - `procgen_metadata` / `loop_costs` → `{"<p>": block}` (APWORLD SUBSTRATE
 *     CHANGE P1a; ⚖ user 2026-09-27, plan §34.5 / §36.5: *"I want to replace
 *     the old format, the old presets, and the code for them entirely, and not
 *     add any compatibility features for the old format."*);
 *   - `assume_bidirectional_exits` → `exporter["<p>"].assume_bidirectional_exits`
 *     (rules F1; ⚖ user 2026-10-03: *"If there are presets that set the
 *     bidirectional flag at the top level, then that's a bug. The flag should be
 *     specific to one player."*).
 *
 *   node scripts/procgen/migrate-per-player-blocks.mjs --check   # exit 1 naming every unmigrated file
 *   node scripts/procgen/migrate-per-player-blocks.mjs --write   # move them (idempotent: a second run writes 0 bytes)
 *
 * ── WHAT IT MOVED FROM (said once, here, dated 2026-09-27 / 2026-10-03) ────
 *
 * Until P1a both keys sat at the top level as ONE block describing ONE slot.
 * They are now `{"<p>": block}` — the shape `preset_sidecars`, `regions` and
 * `items` have. No reader of the old shape exists anywhere else in the tree;
 * this docblock is the only place it is described.
 *
 * Until rules F1 the procgen pipeline wrote `assume_bidirectional_exits` at the
 * top level (one boolean for the document). Its home is now the slot's
 * `exporter["<p>"]` block — where the AP exporter's handler already wrote it.
 * The runtime loader REFUSES the old key by name
 * (`stateManager/core/initialization.js` `RETIRED_TOP_LEVEL_KEYS`) and the
 * strict schema rejects it; no reader of the old place exists.
 *
 * ── ⛓ WHAT A MOVE IS ────────────────────────────────────────────────────
 *
 * For every tracked `frontend/presets/**∕AP_*_rules.json` carrying either key:
 *   1. parse, then SELF-CHECK that the file's own writer reproduces the INPUT
 *      bytes exactly — one of `stringifyRulesJson` (shared/rulesJsonBuilder.js,
 *      the pipeline's and — mirrored in Python — the exporter's) or plain
 *      `JSON.stringify(x, null, 2)`, each with or without a trailing newline.
 *      A file no candidate reproduces is REFUSED by name: the written diff must
 *      be provably the moved block and nothing else, so there is no best effort;
 *   2. wrap each present block at the SAME key position:
 *      `block` → `{"<p>": block}`; and DROP a top-level
 *      `assume_bidirectional_exits`, writing its value as the LAST key of
 *      `exporter["<p>"]` (the order the pipeline's writer produces) at
 *      `exporter`'s own position. A document whose `exporter["<p>"]` already
 *      names the flag is REFUSED: two values, no rule picks one;
 *   3. write with the writer + newline rule step 1 found.
 * A block whose keys are all slot ids of the document is already moved (the
 * old block's keys are field names — `driver`, `regions`, … — never digits).
 *
 * ⛓ THE SLOT is the document's ONE `preset_sidecars` slot (a document with
 * any other count is refused unless the table below names it).
 *
 * ⛓⛓ THE TABLE — the one committed multi-slot document, measured (plan
 * §36.1): `multiworld/AP_05594871498841892311` is one generation in five
 * files (the combined + `_P1`…`_P4`), and all five carried the SAME block —
 * the `procgen_maze_worldgen` package's `_worldgen_procgen_metadata.json`,
 * injected by the exporter's old *first worldgen world wins* rule. Slots 1–2
 * are that package's world; slots 3–4 are `bounce_worldgen`'s, which ships no
 * metadata file. So the table writes what the MOVED exporter
 * (`handler.py`: `export_data[KEY][str(player)] = block`, and both keys in
 * `PLAYER_SPECIFIC_KEYS`) writes for that generation: the combined file
 * `{"1": b, "2": b}`, `_P1` `{"1": b}`, `_P2` `{"2": b}`, and `_P3` / `_P4`
 * carry NO key (a per-player export slices a player-specific key to its own
 * slot's entry, and those slots have none). Task 6b of P1a regenerates that
 * document and asserts exactly this; since P1b′ the committed row
 * `test/test_export_player_slicing.py` holds the table to the exporter's own
 * `create_ordered_export_data` without a regeneration.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const { stringifyRulesJson } = await import(join(ROOT, 'frontend/modules/shared/rulesJsonBuilder.js'));

const KEYS = ['procgen_metadata', 'loop_costs'];
/** ⛓ The flat flag whose home is `exporter["<p>"]` (rules F1). */
const EXPORTER_FLAGS = ['assume_bidirectional_exits'];
const MW = 'frontend/presets/multiworld/AP_05594871498841892311/AP_05594871498841892311';
/** ⛓ The measured table (docblock): path → the slots that carry the block. `[]` = the key goes. */
const TABLE = new Map([
    [`${MW}_rules.json`, ['1', '2']],
    [`${MW}_P1_rules.json`, ['1']],
    [`${MW}_P2_rules.json`, ['2']],
    [`${MW}_P3_rules.json`, []],
    [`${MW}_P4_rules.json`, []],
]);

/** ⛓ The writers the corpus was measured to use, in the order tried (plan §36.1: 22 / 6 / 13). */
const WRITERS = [
    ['stringifyRulesJson', (d) => stringifyRulesJson(d)],
    ['JSON.stringify(x, null, 2)', (d) => JSON.stringify(d, null, 2)],
];

const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null;
if (!mode) {
    console.error('usage: migrate-per-player-blocks.mjs --check | --write');
    process.exit(2);
}

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const files = execFileSync('git', ['ls-files', '-z', 'frontend/presets'], { cwd: ROOT, maxBuffer: 1 << 28 })
    .toString().split('\0').filter((f) => /\/AP_[^/]*_rules\.json$/.test(f));

/** ⛓ The writer (+ newline rule) that reproduces `text` from `doc`, or null. */
function writerOf(doc, text) {
    for (const [name, fn] of WRITERS) {
        const out = fn(doc);
        if (out === text) return { name, nl: '', fn };
        if (`${out}\n` === text) return { name, nl: '\n', fn };
    }
    return null;
}

const refused = [];
const unmigrated = [];
let moved = 0;
let carriers = 0;
let tableDropped = 0;
for (const rel of files) {
    const path = join(ROOT, rel);
    const text = readFileSync(path, 'utf8');
    if (![...KEYS, ...EXPORTER_FLAGS].some((k) => text.includes(`"${k}"`))) {
        if (TABLE.has(rel) && TABLE.get(rel).length === 0) tableDropped += 1;
        continue;
    }
    const doc = JSON.parse(text);
    const present = [...KEYS, ...EXPORTER_FLAGS].filter((k) => Object.hasOwn(doc, k));
    if (present.length === 0) {
        if (TABLE.has(rel) && TABLE.get(rel).length === 0) tableDropped += 1;
        continue;
    }
    carriers += 1;
    const slotIds = new Set(Object.keys(isPlain(doc.regions) ? doc.regions : {}));
    const done = (k) => !EXPORTER_FLAGS.includes(k) && isPlain(doc[k]) && Object.keys(doc[k]).length > 0
        && Object.keys(doc[k]).every((p) => /^[0-9]+$/.test(p) && slotIds.has(p));
    const todo = present.filter((k) => !done(k));
    if (todo.length === 0) continue;

    let slots = TABLE.get(rel);
    if (!slots) {
        const sidecarSlots = Object.keys(isPlain(doc.preset_sidecars) ? doc.preset_sidecars : {});
        if (sidecarSlots.length !== 1) {
            refused.push(`${rel}: ${sidecarSlots.length} preset_sidecars slots (${sidecarSlots.join(', ') || 'none'}) — `
                + 'the slot is not derivable and the file is not in the table');
            continue;
        }
        slots = sidecarSlots;
    }
    const flags = todo.filter((k) => EXPORTER_FLAGS.includes(k));
    if (flags.length && slots.length !== 1) {
        refused.push(`${rel}: ${flags.join(', ')} at the top level of a document with ${slots.length} slot(s) — `
            + 'one top-level value cannot be given to one slot');
        continue;
    }
    if (flags.length && !isPlain(doc.exporter)) {
        refused.push(`${rel}: ${flags.join(', ')} at the top level but no \`exporter\` map to move it into`);
        continue;
    }
    const clash = flags.filter((k) => Object.hasOwn(doc.exporter?.[slots[0]] ?? {}, k));
    if (clash.length) {
        refused.push(`${rel}: ${clash.join(', ')} both at the top level and in exporter["${slots[0]}"] — two values`);
        continue;
    }
    const writer = writerOf(doc, text);
    if (!writer) {
        refused.push(`${rel}: no known writer reproduces its bytes — the move could not be proved to be the block alone`);
        continue;
    }
    const dest = (k) => (EXPORTER_FLAGS.includes(k) ? `exporter["${slots[0]}"]`
        : slots.length ? `{${slots.map((p) => `"${p}"`).join(', ')}}` : 'key dropped');
    unmigrated.push(`${rel} (${todo.map((k) => `${k} → ${dest(k)}`).join(', ')}; ${writer.name}${writer.nl ? ' + \\n' : ''})`);
    if (mode !== 'write') continue;

    const out = {};
    for (const [k, v] of Object.entries(doc)) {
        if (k === 'exporter' && flags.length) {
            const p = slots[0];
            out[k] = { ...v, [p]: { ...v[p], ...Object.fromEntries(flags.map((f) => [f, doc[f]])) } };
            continue;
        }
        if (EXPORTER_FLAGS.includes(k) && todo.includes(k)) continue;
        if (!todo.includes(k)) { out[k] = v; continue; }
        if (slots.length === 0) continue;
        out[k] = Object.fromEntries(slots.map((p) => [p, v]));
    }
    writeFileSync(path, writer.fn(out) + writer.nl);
    moved += 1;
}

for (const r of refused) console.error(`REFUSED ${r}`);
if (mode === 'check') {
    for (const u of unmigrated) console.log(`UNMIGRATED ${u}`);
    console.log(`CHECK: ${carriers - unmigrated.length}/${carriers} carrying document(s) per-player, `
        + `${tableDropped} table file(s) carrying none by the table, ${unmigrated.length} unmigrated, ${refused.length} refused`);
    process.exit(unmigrated.length || refused.length ? 1 : 0);
}
for (const u of unmigrated) console.log(`MOVED ${u}`);
console.log(`WRITE: ${moved} file(s) moved, ${refused.length} refused`);
process.exit(refused.length ? 1 : 0);
