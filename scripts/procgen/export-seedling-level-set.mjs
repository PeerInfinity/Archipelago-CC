#!/usr/bin/env node
/**
 * export-seedling-level-set — Phase 5's CLI: seeds in, a mountable level set out.
 *
 * `CC/docs/plans/seedling-external-level-sets.md` §5. This is the first time a
 * GENERATED set exists end to end, which is what the whole arc was built to
 * enable. Everything downstream already exists and is gated — the validator
 * (Phase 2), the chunk planner (§9.1), the receiver (Phase 3), the vanilla mount
 * (3b), the save stamp (4). This script owns no format logic at all: it drives
 * `generateSeedlingLevel` and `buildLevelSet` and prints.
 *
 * ── ⛔ STDOUT IS THE DETERMINISM CHANNEL ──────────────────────────────────────
 *
 * `generate-seedling-level.mjs`'s law, inherited. Everything that may honestly
 * differ between two runs of one seed — milliseconds, this machine's speed —
 * goes to STDERR. So
 *
 *     node … --seeds=1-4 > a; node … --seeds=1-4 > b; cmp a b
 *
 * is a determinism proof rather than a ritual.
 *
 * ── ⛓⛓ AND THE GENERATOR IS NOW DETERMINISTIC UNDER LOAD (2026-08-14) ─────────
 *
 * It was NOT, and this is where that was recorded. `procgenOracle:503` used to
 * convert a SUCCEEDED solve into `BUDGET_EXHAUSTED` when it passed
 * `wallClockMs`, so under load a keep flipped to a revert and the run reached
 * different candidates. Worst measured form: at load ~100 on 8 cores,
 * `--seeds=9` failed 5 runs of 5 — the SKELETON solve, the loop's own control
 * arm, took 5,810-8,334 ms, was reclassified, and `levelGenerator`'s skeleton
 * guard then accused the room builder of a defect it did not have.
 *
 * ⇒ THE WALL CLOCK IS GONE. Every remaining budget is denominated in ticks, so
 * a set captured on a busy box is now the same set as one captured on a quiet
 * one — verified at load ~100-170, five runs, byte-identical to the quiet-box
 * digest. ⚠ THE LOAD AVERAGE IS STILL PRINTED TO STDERR: it no longer changes
 * the OUTPUT, but it is what tells a reader whether a slow run was the box.
 *
 * ⛔ AN ABORTED SEED IS A FAILURE, NOT A GAP. A run that quietly dropped the
 * seeds that aborted would emit a smaller set that looks exactly like a smaller
 * request — the graceful-skip failure this repo has recorded. `--allow-aborts`
 * carries them into the set's own provenance instead, by name.
 *
 * ⛔ NOTHING IS WRITTEN UNDER `fixtures/`, EVER (standing law).
 *
 * ── EDITOR v3 E1/E1b: THE SECOND ARM, `--vanilla` ───────────────────────────
 *
 * This script had no arm that does not GENERATE, and the set editor's whole
 * Tier B was therefore demonstrated on generated rooms: the committed vanilla
 * set is 116 `embed`-sourced rooms and an `embed` cannot be opened (plan §13.5).
 * `--vanilla` prints the SAME REPORT over `vanillaRecordSet(embedSet, mapDoc)` —
 * the vanilla 116 carried as `record`s, derived from two committed documents and
 * nothing else — so the two arms can be read line by line against each other.
 *
 * ⛔ IT TAKES NO GENERATION FLAG. There is no seed, biome, exit topology or set
 * id to honour: the document is a function of two files and its id is the hash
 * of that document. `--vanilla --seeds=1-4` REFUSES BY NAME (exit 2) rather
 * than printing a set that ignored the flag.
 *
 * Run:
 *   node scripts/procgen/export-seedling-level-set.mjs --seeds=1-8
 *   node scripts/procgen/export-seedling-level-set.mjs --seeds=1,2,5 --out-dir=/tmp/set
 *   node scripts/procgen/export-seedling-level-set.mjs --seeds=1-4 --set-id=procgen-demo
 *   node scripts/procgen/export-seedling-level-set.mjs --vanilla
 *   node scripts/procgen/export-seedling-level-set.mjs --vanilla --out-dir=/tmp/vanilla
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

const { generateSeedlingLevel } = await M('procgenSeedling.js');
const { GENERATE_BIOMES } = await M('watchGenerate.js');
const { buildLevelSet, vanillaRecordSet, apMappingInvalidation } = await M('levelSetExporter.js');
const { validateLevelSet, planLevelSetChunks } = await M('levelSetValidator.js');
// ⛓ THE MAP EXTRACT'S PATH IS `levelSource.js`'s, NOT A SECOND COPY OF IT.
// That module is the node-only edge that already owns `ATLAS_PATH` and memoises
// the 976 KB read; a `join(REPO, …)` here would be a second address for one file.
const { loadAtlas, ATLAS_PATH } = await M('levelSource.js');
/**
 * ⛓ EDITOR v3 E1c — the BUNDLE writer and the vendored JSZip. ⛔ Both are the
 * ONES the page uses: `documentBundle` is the container's only implementation,
 * and `loadJSZipNode` evaluates the same vendored UMD the browser injects.
 */
const {
    DEFAULT_RULES_JSON_INDENT, writeBundle,
} = await import(join(REPO, 'frontend/modules/presets/documentBundle.js'));
const { loadJSZipNode } = await import(join(REPO, 'scripts/procgen/loadJSZipNode.mjs'));
/**
 * The vanilla manifest. ⚠ DEFINED ONCE, HERE, because nothing exports it: the
 * five scripts that read it each `join(REPO, …)` their own copy of this string
 * (`check-seedling-vanilla-manifest.mjs:111`, `check-seedling-save-stamp.mjs:69`,
 * `stamp-seedling-vanilla-set.mjs:30`, `check-seedling-editor-arm.mjs:134`,
 * `probe-seedling-level-set-transport.mjs:119`). ⛔ READ-ONLY here — this file
 * is ⚖ ruling 2's subject and its own stamper owns writing it.
 */
const VANILLA_SET_PATH = join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const num = (name, fallback) => Number(arg(name, fallback));

const say = (line) => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);

/**
 * ⛓ WAS THE FLAG TYPED? `arg()` answers with its FALLBACK, so `--vanilla
 * --seeds=1-4` could not be told from `--vanilla` alone by reading `SEEDS`.
 * The two arms are mutually exclusive and the refusal has to name what the
 * reader actually typed, so it asks argv rather than the parsed value.
 */
const passed = (name) => process.argv.some(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`));

// ── EDITOR v3 E1 — the second arm, and what it refuses ───────────────────────
const VANILLA = has('vanilla');
/** Every flag that only means something to the GENERATED arm. */
const GENERATE_ONLY = ['seeds', 'biome', 'exits', 'regions', 'count', 'tries',
    'saturation', 'allow-aborts', 'set-id'];
if (VANILLA) {
    const clash = GENERATE_ONLY.filter(passed);
    if (clash.length > 0) {
        note(`export-seedling-level-set: --vanilla takes no generation flag, and `
            + `${clash.map((f) => `--${f}`).join(', ')} ${clash.length === 1 ? 'is' : 'are'} one.`);
        note('  The vanilla arm derives its whole document from two committed files — the map');
        note('  extract and the vanilla manifest — and its set_id from the content of what they');
        note('  produce. There is nothing for a seed, a biome, an exit topology or a set id to');
        note('  change, and accepting one would print a set that silently ignored it.');
        process.exit(2);
    }
}

/** `1-8`, `1,2,5`, or a mix. Order is set order — position is identity. */
function parseSeeds(spec) {
    const out = [];
    for (const part of String(spec).split(',')) {
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) {
            const [a, b] = [Number(range[1]), Number(range[2])];
            if (b < a) { note(`export-seedling-level-set: range "${part}" counts down`); process.exit(2); }
            for (let s = a; s <= b; s += 1) out.push(s);
            continue;
        }
        const one = Number(part);
        if (!Number.isInteger(one) || one < 0) {
            note(`export-seedling-level-set: "${part}" is not a seed or a range`);
            process.exit(2);
        }
        out.push(one);
    }
    return out;
}

const SEEDS = parseSeeds(arg('seeds', '1-4'));
const BIOME = arg('biome', 'pre-sword');
const SET_ID = arg('set-id', `procgen-${BIOME}-${SEEDS.length}`);
const OUT_DIR = arg('out-dir', '');
const OBSTACLES = num('count', 6);
const TRIES = num('tries', 8);
const SATURATION_K = num('saturation', 3);
const ALLOW_ABORTS = has('allow-aborts');
// ⛓ PHASE 5b. `none` reproduces the Phase 5 set — N ISOLATED ROOMS — and is kept
// so the before/after is one flag rather than an old commit.
const EXITS = arg('exits', 'chain');
// room -> region (1..7), e.g. `--regions=1,1,1,2,2,2`. Empty means no set announces
// anything, which is reported rather than defaulted (see `linkGeneratedRooms`).
const REGIONS = arg('regions', '').split(',').filter(Boolean).map(Number);

/**
 * ⛓⛓⛓ **EDITOR v3 E1c — `--bundle` AND `--minify`** (plan §25).
 *
 * `--bundle` writes ONE `<set_id>.zip` BESIDE the plain files, never instead of
 * them: the single documents stay canonical and this script's `--out-dir` is
 * what `levelSetExporter.test.js` reads. Its members are the set and its
 * `.ap-invalidation.json`… ⛔ and NOT the `.chunks.json`, which is DELIVERY
 * (§24.12) and is refused BY NAME by `readBundle` if anybody puts one in.
 *
 * ⛔ **STDOUT IS UNCHANGED BY EITHER FLAG** — it is the determinism channel, and
 * a report that grew a line when a file was written would make
 * `--seeds=1-4 > a; … > b; cmp a b` a proof about the flags rather than the
 * generator. What they change is what lands in `--out-dir`.
 *
 * ⚠ `--minify` applies to every JSON this script writes, and to the bundle's
 * members. It writes NOTHING under `fixtures/` or `presets/` (the refusal below
 * is older than this flag).
 */
const BUNDLE = has('bundle');
const MINIFY = has('minify');

if ((BUNDLE || MINIFY) && !OUT_DIR) {
    note('export-seedling-level-set: --bundle and --minify only describe what is WRITTEN, and '
        + 'nothing is written without --out-dir=DIR. STDOUT is the determinism channel and '
        + 'neither flag touches it.');
    process.exit(2);
}

if (!['chain', 'ring', 'none'].includes(EXITS)) {
    note(`export-seedling-level-set: --exits=${EXITS} is not one of chain, ring, none`);
    process.exit(2);
}

if (!GENERATE_BIOMES[BIOME]) {
    note(`export-seedling-level-set: biome "${BIOME}" is not available — this build ships [${Object.keys(GENERATE_BIOMES).join(', ')}].`);
    process.exit(2);
}

// ⚠ THE BOX STATE, BEFORE ANYTHING RUNS. See the header: a set captured under
// load is a set that will not reproduce, and it looks completely normal.
let loadavg = 'unavailable';
try { loadavg = readFileSync('/proc/loadavg', 'utf8').trim(); } catch { /* not linux */ }
note(`# load at start: ${loadavg}`);
note(VANILLA
    ? `# --vanilla: ${ATLAS_PATH} + ${VANILLA_SET_PATH}`
    : `# ${SEEDS.length} seed(s), biome ${BIOME}, obstacleTarget ${OBSTACLES}`);

const bounds = { obstacleTarget: OBSTACLES, triesPerStep: TRIES, saturationK: SATURATION_K };
const entries = [];
const aborted = [];
const t0 = Date.now();

/**
 * ⛓ ONE `{set, report}`, TWO PRODUCERS. Everything below the branch — validate,
 * plan, invalidate, print, write — is the SAME code for both arms, which is what
 * makes the two reports comparable line by line instead of merely similar.
 */
let set;
let report;
if (VANILLA) {
    const embedSet = JSON.parse(readFileSync(VANILLA_SET_PATH, 'utf8'));
    ({ set, report } = vanillaRecordSet(embedSet, loadAtlas()));
    note(`  ${report.join.rooms} room(s) joined by path, `
        + `${report.join.matched_by_suffix} on the shared suffix`);
} else {
for (const seed of SEEDS) {
    let out;
    try {
        out = generateSeedlingLevel({ seed, palette: GENERATE_BIOMES[BIOME], bounds });
    } catch (e) {
        if (e.name !== 'GenerationAborted') throw e;
        aborted.push({ seed, reason: e.message });
        note(`  seed ${seed}: ABORTED — ${e.message}`);
        continue;
    }
    note(`  seed ${seed}: ${out.summary.stop}, ${out.summary.keptCount} obstacle(s)`);
    entries.push({
        seed,
        record: out.record,
        summary: out.summary,
        // ⛓ THE NAME CARRIES THE SEED, so a room in a delivered set can be
        // traced back to the invocation that made it. The generator's own
        // `class` is "Procgen900" for every record it has ever produced.
        name: `${BIOME.replace(/[^\w.-]/g, '_')}_seed${seed}`,
    });
}

if (aborted.length > 0 && !ALLOW_ABORTS) {
    note(`\nexport-seedling-level-set: ${aborted.length} of ${SEEDS.length} seed(s) ABORTED and no set was written.`);
    note('⛓ This is a CODE failure, not a busy box. Since 2026-08-14 no budget in this');
    note('  pipeline is denominated in milliseconds, so an abort here reproduces on a quiet');
    note('  machine and re-running it will not make it go away — that is the whole point of');
    note('  having removed the wall clock. Reproduce, then read the seed\'s trace.');
    note('  Pass --allow-aborts to emit a set that NAMES the seeds it could not generate.');
    process.exit(3);
}
if (entries.length === 0) {
    note('export-seedling-level-set: every seed aborted; there is no set to write.');
    process.exit(3);
}

({ set, report } = buildLevelSet(entries, {
    setId: SET_ID,
    name: `Procgen ${BIOME} (${entries.length} rooms)`,
    generator: 'scripts/procgen/export-seedling-level-set.mjs',
    provenance: {
        biome: BIOME,
        // ⛓ ROOM → SEED, in set order. The one thing that lets a room in a
        // delivered set be regenerated: `--seeds=<that seed>` reproduces it, on
        // a quiet box.
        seeds: entries.map((e, room) => ({ room, seed: e.seed })),
        bounds,
        // ⛔ NAMED, NOT DROPPED. A set that silently omitted its failed seeds
        // would be indistinguishable from a smaller request.
        ...(aborted.length > 0 ? { aborted_seeds: aborted } : {}),
    },
    ...(EXITS === 'none'
        ? {}
        : { link: { topology: EXITS, ...(REGIONS.length > 0 ? { regions: REGIONS } : {}) } }),
}));
}

const verdict = validateLevelSet(set);
const { chunks, oversized } = planLevelSetChunks(set);
const invalidation = apMappingInvalidation(set);

say(VANILLA
    ? `# the VANILLA 116 as an xml-sourced level set — ${set.rooms.length} room(s)`
    : `# generated Seedling level set — ${entries.length} room(s), biome ${BIOME}`);
say('');
say(`set_id:       ${set.set_id}`);
say(`content_hash: ${set.provenance.content_hash}`);
if (VANILLA) {
    // ⛓ WHICH SET THIS ONE REPRODUCES, AND WHERE THE ROOMS CAME FROM. Two ids
    // exist for one game's 116 rooms and this is the line that says which is in
    // hand: the embed id is ⚖ ruling 2's and the AS3 fork's `VanillaSet.SET_ID`;
    // the one above is this document's own.
    say(`derived_from: ${set.provenance.derived_from.set_id} `
        + `(content_hash ${set.provenance.derived_from.content_hash})`);
    say(`map:          ${set.provenance.map.generator}, `
        + `rooted at ${set.provenance.map.source.level_root}`);
    say(`join:         ${report.join.matched_by_suffix} of ${report.join.rooms} matched by PATH `
        + `on the shared suffix (\`${report.join.embed_prefix}…\` under `
        + `\`${report.join.level_root}/…\`), ${report.join.matched_exact} exact`);
} else {
    say(`seeds:        ${SEEDS.join(', ')}${aborted.length ? `   (ABORTED: ${aborted.map((a) => a.seed).join(', ')})` : ''}`);
}
say(`start:        ${JSON.stringify(set.start)}`);
say(`menu_rooms:   ${JSON.stringify(set.menu_rooms)}`);
say(`named_rooms:  ${JSON.stringify(set.named_rooms)}`);
say('');
say(`validate:     ${verdict.ok ? 'OK' : `REFUSED (${verdict.errors.length} error(s))`}`);
verdict.errors.forEach((e) => say(`  ERROR   ${e}`));
verdict.warnings.forEach((w) => say(`  warning ${w}`));
say('');
say('## what no input determined (provenance.invented)');
if (report.invented.length === 0) say('  nothing — every field was supplied or derived');
report.invented.forEach((f) => say(`  ${f}`));
say('');
say('## notes');
report.notes.forEach((n) => say(`  ${n}`));
say('');
// ⛔ REPORTED EVERY TIME, and it is the number Phase 5b was measured against:
// with `--exits=none` a set of N generated rooms is N ISOLATED ROOMS (1/N), which
// is what the palette alone produces — it places obstacles, not transitions.
const reach = report.reachability;
say('## reachability from start — following only what the ROOM DATA carries');
say(`  ${reach.reachable}/${reach.total} reachable from room ${reach.start}`);
if (reach.unreachable.length > 0) {
    say(`  unreachable: ${reach.unreachable.join(', ')}`);
    if (EXITS === 'none') {
        say('  ⛔ --exits=none: no generated room carries a teleporter, stairs or @fallthrough.');
    }
}
if (reach.rooms_not_walked > 0) say(`  ${reach.rooms_not_walked} room(s) could not be walked (embed source)`);
say('');
// ⛓ AND THE DATA WALK IS NOT THE WHOLE CLAIM. `reachability` says a `to` exists
// and is in range; it cannot see whether the player can stand on the thing
// carrying it. The doors below were chosen from a flood over each room's real
// collision world, so each one is reachable from that room's own start with
// nothing cleared and no puzzle solved.
if (report.link) {
    say('## exits (plan §4.6, Phase 5b)');
    say(`  topology ${report.link.topology}: ${report.link.links} two-way link(s), ${
        report.link.exits} exit(s)`);
    say(`  ${report.link.announced} announce a region, ${report.link.silent} announce nothing (${
        report.link.regions_declared} room region(s) declared)`);
    report.doors.forEach((d) => say(`  room ${d.room} (${d.cell.tx}, ${d.cell.ty}) -> room ${
        d.to} at (${d.arrival.x}, ${d.arrival.y}), sign ${d.sign}, approached from (${
        d.approach.tx}, ${d.approach.ty}) heading ${d.key}`));
    say('  walkable cells per room: '
        + report.link.components.map((c) => `${c.room}:${c.walkable}`).join(' '));
    say('');
}
say('## delivery');
say(`  ${chunks.length} chunk(s), largest ${Math.max(...chunks.map((c) => JSON.stringify(c).length))} B`);
chunks.forEach((c) => say(`  chunk ${c.chunk_index}: ${c.rooms.length} room(s), ${JSON.stringify(c).length} B`));
if (oversized.length > 0) {
    say(`  ⛔ ${oversized.length} room(s) exceed the proven chunk envelope on their own:`);
    oversized.forEach((o) => say(`     rooms[${o.id}] "${o.name}" ${o.bytes} B`));
}
say('');
say(`## §6.1 — the vanilla AP mapping under this set: ${invalidation.status}`);
invalidation.references.forEach((r) => say(`  ${r.count.toString().padStart(2)} ${r.artifact} ${r.table}`));
say(`  ${invalidation.total_references} references, none of which forces a named_rooms entry`);
if (VANILLA) {
    /**
     * ⛔ THE COMPANION STILL READS `invalidated`, AND THAT IS THE CONTRACT
     * (plan §22.2 decision 5). `apMappingInvalidation` is keyed on IDENTITY, not
     * on content: this set has a different `set_id`, so a consumer must refuse
     * the 24 references under it. Deliberately conservative — a refused
     * debug-teleport is the safe failure, and widening the vocabulary to say
     * "same content, different id" would put a second authority beside the
     * stamp. The one thing owed to the reader is the sentence below.
     */
    say(`  ⚠ this set reproduces the vanilla rooms BY VALUE — derived_from names `
        + `${set.provenance.derived_from.set_id}, and those 24 references still describe its `
        + 'rooms until one is EDITED. The status is per identity, not per content.');
}

if (OUT_DIR) {
    const dir = resolve(OUT_DIR);
    if (/(^|\/)fixtures(\/|$)/.test(dir)) {
        note('export-seedling-level-set: REFUSED to write under `fixtures/` — committed fixtures are produced by their own extractor and stamped by their own stamper (standing law).');
        process.exit(2);
    }
    mkdirSync(dir, { recursive: true });
    /**
     * ⛓ EDITOR v3 E1c — the indent is `--minify`'s, and 0 is a REAL minify in
     * JS (`JSON.stringify(x, null, 0)` emits no newlines; Python's
     * `json.dumps(indent=0)` does NOT, which is why the exporter maps 0 to
     * `separators`). The DEFAULT is the schema's, not a literal here.
     */
    const indent = MINIFY ? 0 : DEFAULT_RULES_JSON_INDENT;
    const j = (v) => `${JSON.stringify(v, null, indent)}\n`;
    writeFileSync(join(dir, `${set.set_id}.json`), j(set));
    writeFileSync(join(dir, `${set.set_id}.ap-invalidation.json`), j(invalidation));
    /**
     * ⛓⛓⛓ **EDITOR v3 E1b — THE `.chunks.json` IS WHERE OEL LIVES ON DISK
     * NOW.** The `.json` is the SET: pure JSON records, no text. The
     * `.chunks.json` is the DELIVERY: `planLevelSetChunks` rendered every
     * `record` room to `{xml}` on its way out, because the receiver ends at
     * `LevelSet.as:139`. ⛔ So a set file with an `xml` room, or a chunk file
     * with a `record` room, is a document one of these two steps did not take —
     * which is what `levelSetExporter.test.js` asserts over a real `--out-dir`.
     */
    writeFileSync(join(dir, `${set.set_id}.chunks.json`), j(chunks));
    say('');
    say(`written: ${dir}/${set.set_id}.{json,ap-invalidation.json,chunks.json}`);
    /**
     * ⛓⛓ **THE BUNDLE IS WRITTEN LAST AND SAID ON STDERR.** ⛔ The `say` above
     * is STDOUT — the determinism channel — and it names the same three files
     * whether or not `--bundle` was typed, because those three ARE the output
     * and the zip is a second copy of two of them.
     *
     * ⚠ The `.ap-invalidation.json` is not one of `documentBundle`'s four kinds
     * (it is a derived invalidation table, and `classifyDocument` returns null
     * for it), so it goes in as a NAMED extra entry that `readBundle` reports in
     * `notes` rather than as a member. That is the honest shape: the container
     * carries it, the classifier does not pretend it is a document.
     */
    if (BUNDLE) {
        const bytes = await writeBundle([{ kind: 'level-set', doc: set }], {
            jszip: loadJSZipNode(),
            indent,
            extras: [{ name: `${set.set_id}.ap-invalidation.json`, text: j(invalidation) }],
        });
        writeFileSync(join(dir, `${set.set_id}.zip`), bytes);
        note(`# bundle: ${dir}/${set.set_id}.zip (${bytes.length} B, indent ${indent})`);
    }
}

note(`# ${Date.now() - t0} ms`);
process.exit(verdict.ok ? 0 : 1);
