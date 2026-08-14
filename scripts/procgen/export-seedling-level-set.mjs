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
 * ── ⚠⚠ AND THE GENERATOR IS NOT DETERMINISTIC UNDER LOAD ──────────────────────
 *
 * `procgenOracle:503` converts a SUCCEEDED solve into `BUDGET_EXHAUSTED` when it
 * passes `wallClockMs`, so under load a keep flips to a revert and the run
 * reaches different candidates. Measured on seed 20: five runs on IDENTICAL
 * code gave 3 levels and 2 `GenerationAborted`. ⇒ THIS SCRIPT PRINTS
 * `/proc/loadavg` TO STDERR BEFORE IT STARTS, and a set captured on a busy box
 * is a set that will not reproduce while looking completely normal.
 *
 * ⛔ AN ABORTED SEED IS A FAILURE, NOT A GAP. A run that quietly dropped the
 * seeds that aborted would emit a smaller set that looks exactly like a smaller
 * request — the graceful-skip failure this repo has recorded. `--allow-aborts`
 * carries them into the set's own provenance instead, by name.
 *
 * ⛔ NOTHING IS WRITTEN UNDER `fixtures/`, EVER (standing law).
 *
 * Run:
 *   node scripts/procgen/export-seedling-level-set.mjs --seeds=1-8
 *   node scripts/procgen/export-seedling-level-set.mjs --seeds=1,2,5 --out-dir=/tmp/set
 *   node scripts/procgen/export-seedling-level-set.mjs --seeds=1-4 --set-id=procgen-demo
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
const { buildLevelSet, apMappingInvalidation } = await M('levelSetExporter.js');
const { validateLevelSet, planLevelSetChunks } = await M('levelSetValidator.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const num = (name, fallback) => Number(arg(name, fallback));

const say = (line) => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);

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
note(`# ${SEEDS.length} seed(s), biome ${BIOME}, obstacleTarget ${OBSTACLES}`);

const bounds = { obstacleTarget: OBSTACLES, triesPerStep: TRIES, saturationK: SATURATION_K };
const entries = [];
const aborted = [];
const t0 = Date.now();

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
    note('⚠ Before treating this as a code failure, check the load average above and re-run:');
    note('  the generator is NOT deterministic under load — a solve that passes wallClockMs is');
    note('  converted from SUCCESS to a rejection (procgenOracle:503), so keeps flip under load.');
    note('  Pass --allow-aborts to emit a set that NAMES the seeds it could not generate.');
    process.exit(3);
}
if (entries.length === 0) {
    note('export-seedling-level-set: every seed aborted; there is no set to write.');
    process.exit(3);
}

const { set, report } = buildLevelSet(entries, {
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
});

const verdict = validateLevelSet(set);
const { chunks, oversized } = planLevelSetChunks(set);
const invalidation = apMappingInvalidation(set);

say(`# generated Seedling level set — ${entries.length} room(s), biome ${BIOME}`);
say('');
say(`set_id:       ${set.set_id}`);
say(`content_hash: ${set.provenance.content_hash}`);
say(`seeds:        ${SEEDS.join(', ')}${aborted.length ? `   (ABORTED: ${aborted.map((a) => a.seed).join(', ')})` : ''}`);
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

if (OUT_DIR) {
    const dir = resolve(OUT_DIR);
    if (/(^|\/)fixtures(\/|$)/.test(dir)) {
        note('export-seedling-level-set: REFUSED to write under `fixtures/` — committed fixtures are produced by their own extractor and stamped by their own stamper (standing law).');
        process.exit(2);
    }
    mkdirSync(dir, { recursive: true });
    const j = (v) => `${JSON.stringify(v, null, 2)}\n`;
    writeFileSync(join(dir, `${set.set_id}.json`), j(set));
    writeFileSync(join(dir, `${set.set_id}.ap-invalidation.json`), j(invalidation));
    writeFileSync(join(dir, `${set.set_id}.chunks.json`), j(chunks));
    say('');
    say(`written: ${dir}/${set.set_id}.{json,ap-invalidation.json,chunks.json}`);
}

note(`# ${Date.now() - t0} ms`);
process.exit(verdict.ok ? 0 : 1);
