/**
 * ⛓⛓ THE DERIVED-RULE OVERRIDE (session tile-rules-automation-r-a3; ⚖ Robert 2026-11-02 "Route A, R-A1 first (Recommended)",
 * 2026-11-04 "A + B now, C after B (Recommended)"; designer tile-primitives-design-3 GO; rules-4 PASS).
 *
 * The committed table (`TABLE_FILE`, emitted by `probe-seedling-derived-rules.mjs` on CI from the maze worlds' derived logic,
 * `derivedRuleRows.derivedRuleTable`) OVERRIDES the rules producer's COMPOSED rule on every element it holds:
 *   - in the ATLAS, where the atlas row carries the element's rule (`applyDerivedRuleTableToAtlas`, inside
 *     `buildPlaythroughAtlas` before the id is stamped);
 *   - in every COMPILED document (`applyDerivedRuleTable`): AP_1 (`make-seedling-playthrough-rules.mjs`) and the maze
 *     preset's AP layer (`make-seedling-playthrough-maze.mjs`), so the certifier compares against what ships.
 *
 * Guards (each names its element):
 *   1. a HAND term (the overlay's `handExitTerms` / `handLocationTerms`) on an element the table decides is REFUSED (the m3
 *      guard pattern): the table never holds an echo, so a hand row there is a ruling the table would silently replace;
 *   2. COMPOSED ≠ TABLE: the composition still runs and is compared (`compareRules`) before the override. A disagreement is
 *      returned (`composedDisagrees`); the producers' `--check` holds it at zero. ⚠ A RULES FIX on an overridden element
 *      must change the derivation's INPUT (the overlay / the grid): a fix in the composition alone is overwritten here;
 *   3. STALENESS (`tableStaleness`): the table records the md5 of its inputs — the maze preset's world payloads and the
 *      certifier's static import closure — and the push-path check recomputes both.
 *
 * ⛔ The maze cannot read an override back: its worlds take the atlas's geometry and the overlay's hand terms only
 * (`projectionRegionOf`). `derivedRuleOverride.test.js` pins that with a sentinel planted in a table row.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './argvHelp.js';
import { compareRules } from '../../frontend/modules/mazeRoom/tileSpike/derivedRuleRows.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TABLE_FILE = resolve(REPO, 'frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json');
/** The certifier: the root of the derivation engine whose import closure `engineMd5` hashes. */
/** The committed maze preset: its world payloads are the derivation's input (`payloadMd5`). */
export const MAZE_PRESET = resolve(REPO, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json');
export const ENGINE_ROOT = resolve(REPO, 'frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js');
/** How a stale table is regenerated (named in every staleness failure). */
export const REGEN_RECIPE = 'run alone, in this order: (1) `gh workflow run seedling-probe.yml -R PeerInfinity/Archipelago-CC --ref <branch> '
    + '-f probes=probe-seedling-derived-rules.mjs`; (2) `gh run download <run> -R PeerInfinity/Archipelago-CC` and copy '
    + 'probe-seedling-derived-rules-log/seedling-playthrough-derived-rules.json over '
    + 'frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json; (3) `node scripts/procgen/make-seedling-playthrough-rules.mjs` '
    + 'then `node scripts/procgen/make-seedling-playthrough-maze.mjs` (and the rest of the atlas recipe if the atlas id moves); '
    + '(4) COMMIT THE TABLE IN THE SAME PACKET as the change that staled it. If the regenerated table\'s VERDICTS move (its rows or '
    + 'exclusions, not only its `inputs` hashes), the packet owes a tile-primitives designer review before js-16 slots it. '
    + 'The engine closure: `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`';

const EMPTY = Object.freeze({ rows: [], excluded: [], inputs: null });

/** The committed table, or an empty one where none is committed. */
export function readDerivedRuleTable(file = TABLE_FILE) {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : EMPTY;
}

const md5 = (s) => createHash('md5').update(s).digest('hex');

/** md5 of a compiled maze document's world payloads (its sidecars): the derivation's whole data input. */
export function payloadMd5(mazeRules) {
    const sc = mazeRules.preset_sidecars['1'];
    return md5(JSON.stringify(Object.keys(sc).sort().map((k) => [k, sc[k]])));
}

/**
 * The static import closure of `root` (relative `import … from` / `export … from` specifiers, followed transitively; bare
 * specifiers are packages and are not followed). Derived from the files, never listed.
 */
export function importClosure(root = ENGINE_ROOT) {
    const seen = new Set();
    const stack = [root];
    const spec = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
    while (stack.length) {
        const f = stack.pop();
        if (seen.has(f)) continue;
        seen.add(f);
        const text = readFileSync(f, 'utf8');
        for (const m of text.matchAll(spec)) stack.push(resolve(dirname(f), m[1]));
    }
    return [...seen].map((f) => relative(REPO, f)).sort();
}

/** md5 of the engine closure: every file's repo path and bytes (a comment edit flips it: one probe dispatch). */
export function engineMd5(root = ENGINE_ROOT) {
    return md5(importClosure(root).map((f) => `${f}\0${readFileSync(resolve(REPO, f), 'utf8')}`).join('\0'));
}

/** The table's `inputs` block for a compiled maze document. */
export function tableInputs(mazeRules) {
    return { payloadMd5: payloadMd5(mazeRules), engineMd5: engineMd5(), engineFiles: importClosure().length };
}

/** Why the committed table is stale against `mazeRules` (the committed maze preset) and the engine, or []. */
export function tableStaleness(table, mazeRules) {
    if (!table.inputs) return table.rows.length ? ['the table has rows but no `inputs` block'] : [];
    const now = tableInputs(mazeRules);
    const out = [];
    if (now.payloadMd5 !== table.inputs.payloadMd5) {
        out.push(`the maze world payloads moved (payloadMd5 ${table.inputs.payloadMd5} → ${now.payloadMd5}): the derivation's input changed`);
    }
    if (now.engineMd5 !== table.inputs.engineMd5) {
        out.push(`the derivation engine moved (engineMd5 ${table.inputs.engineMd5} → ${now.engineMd5}, ${now.engineFiles} files in the closure of `
            + `${relative(REPO, ENGINE_ROOT)}; a comment-only edit counts)`);
    }
    return out.map((m) => `STALE derived-rule table: ${m} — regenerate: ${REGEN_RECIPE}`);
}

const handKey = (row) => (row.kind === 'exit' ? `${row.atlas.region_id}/${row.atlas.exit_id}` : `${row.atlas.region_id}/${row.atlas.location}`);

/**
 * Guard 1: refuse a hand term on an element the table decides. `hand` = the rules producer's `playthroughHandInputs(atlas)`:
 * `exitTerms` (`[{region_id, exit_id, rule}]`) and `locationTerms` (a Map keyed by the location's name).
 */
export function refuseHandRowsUnderTable(table, hand) {
    const exits = new Set(hand.exitTerms.map((t) => `${t.region_id}/${t.exit_id}`));
    const clash = table.rows.filter((r) => (r.kind === 'exit' ? exits.has(handKey(r)) : hand.locationTerms.has(r.atlas.location)));
    if (clash.length) {
        throw new Error(`a HAND row where the derived-rule table decides: ${clash.map((r) => `${r.key} (hand ${handKey(r)})`).join('; ')} — `
            + 'a hand ruling there must be an INPUT (the overlay), or the element must leave the table');
    }
}

/**
 * The table onto an ATLAS (in place), where the atlas row carries the element's rule. Returns the rows it rewrote, each
 * with the composed rule it replaced and `compareRules(table, composed)`.
 */
export function applyDerivedRuleTableToAtlas(atlas, table) {
    const regions = new Map(atlas.regions.map((r) => [r.region_id, r]));
    const out = [];
    for (const row of table.rows) {
        const region = regions.get(row.atlas.region_id);
        if (!region) throw new Error(`derived-rule table: ${row.key} names atlas region ${row.atlas.region_id}, which the atlas does not hold`);
        const target = row.kind === 'exit' ? (region.exits ?? []).find((e) => e.exit_id === row.atlas.exit_id)
            : (region.locations ?? []).find((l) => l.name === row.atlas.location);
        if (!target) throw new Error(`derived-rule table: ${row.key} names ${handKey(row)}, which the atlas does not hold`);
        if (!target.access_rule) continue;
        out.push({ key: row.key, composed: target.access_rule, table: row.rule, compare: compareRules(row.rule, target.access_rule) });
        target.access_rule = structuredClone(row.rule);
    }
    return out;
}

/**
 * The table onto a COMPILED rules document (in place, player '1'). Every row must name one compiled element (else a
 * refusal by name; with `partial`, a row whose region the document does not hold is skipped). Returns `{applied, composedDisagrees}`: the elements whose compiled rule was not truth-table equal
 * to the table's before the override.
 */
export function applyDerivedRuleTable(rules, table, { partial = false } = {}) {
    const REGIONS = rules.regions['1'];
    const composedDisagrees = [];
    let applied = 0;
    for (const row of table.rows) {
        const region = REGIONS[row.region];
        // `partial`: a compile restricted to some levels (a measurement) carries only those levels' rows.
        if (partial && !region) continue;
        const target = row.kind === 'exit' ? region?.exits?.find((e) => e.name === row.name)
            : region?.locations?.find((l) => l.name === row.name);
        if (!target) throw new Error(`derived-rule table: ${row.key} names no element of the compiled document`);
        const composed = target.access_rule ?? { rule: 'True_' };
        const compare = compareRules(row.rule, composed);
        if (compare !== 'equal') composedDisagrees.push({ key: row.key, compare, composed, table: row.rule });
        target.access_rule = structuredClone(row.rule);
        applied += 1;
    }
    return { applied, composedDisagrees };
}

/** The `--check` message for a composed ≠ table element (rules-4's requirement (a)). */
export function composedDisagreeMessage(d) {
    return `COMPOSED ≠ TABLE at ${d.key}: the table's derived rule is ${d.compare} than the composed one `
        + `(composed ${JSON.stringify(d.composed)}, table ${JSON.stringify(d.table)}). The table OVERRIDES this element, so a rules fix `
        + 'made only in the composition is overwritten: change the derivation\'s INPUT (the overlay / the grid) and regenerate the '
        + `table, or take the element out of the table by name. Regenerate: ${REGEN_RECIPE}`;
}

// `--print-engine-closure`: the files `engineMd5` hashes (by CONTENT, never a submodule SHA), and the md5.
if (isEntryPoint(import.meta.url) && process.argv.includes('--print-engine-closure')) {
    for (const f of importClosure()) console.log(f);
    console.log(`engineMd5 ${engineMd5()} (${importClosure().length} files, root ${relative(REPO, ENGINE_ROOT)})`);
}
