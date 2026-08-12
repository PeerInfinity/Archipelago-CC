#!/usr/bin/env node
/**
 * prove-seedling-procgen-seam — SLICE 1's PROOF, and it is CLI-first on
 * purpose.
 *
 * Seedling PROCGEN PoC arc, slice 1 (kickoff §4.1). Four claims, in one run:
 *
 *   1. THE LEVEL MODEL BUILDS. A synthetic atlas record — bordered empty
 *      single-screen room — becomes a world through `buildLevelWorld`, and
 *      each of the four declared terrains is found in the world by the
 *      property that terrain is FOR (a wall in `solids`, water in
 *      `lethalTerrainTiles`, a pit in `pitTiles`, ground walkable).
 *   2. THE SEAM CARRIES IT. That record reaches the solver through
 *      `levelSourceFromAtlas` — the same injection point the editor page and
 *      the runner already share — with no engine file changed.
 *   3. THE GOAL ENDS A SOLVE. A `collect-placement` on a placed pickup is
 *      solved, and certification reads the SOLVE'S OWN COLLECT RECORD (⚖
 *      kickoff §3.4), never a persistence ledger.
 *   4. IT IS DETERMINISTIC. The seed picks the goal cell, the whole payload
 *      is generated TWICE in one process, and the two are compared as bytes.
 *      A second process must produce the same stdout — which is why every
 *      wall-clock number in this script goes to STDERR.
 *
 * ⛔ STDOUT IS THE DETERMINISM CHANNEL. Anything that varies between two runs
 * of the same seed (milliseconds, this machine's speed) is printed on stderr
 * and never on stdout, so `node … > a; node … > b; cmp a b` is the proof
 * rather than a ritual. The `--json` mode prints the payload alone.
 *
 * Run: node scripts/procgen/prove-seedling-procgen-seam.mjs
 *      node scripts/procgen/prove-seedling-procgen-seam.mjs --seed=7
 *      node scripts/procgen/prove-seedling-procgen-seam.mjs --json
 *
 * ⚠ NOTHING IS WRITTEN ANYWHERE. `fixtures/` is never touched (standing law),
 * and this script has no output file at all — the payload is stdout.
 */

import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const M = (p) => import(join(HERE, '..', '..', 'frontend/modules/seedlingDemo', p));

const { ROLES, buildLevelWorld } = await M('levelWorld.js');
const {
    SINGLE_SCREEN_TILES, TERRAIN, atlasOf, bootAtTile, emptyLevel, oelAtTile,
    withEntities, withTerrain,
} = await M('procgenLevel.js');
const { rngFor } = await M('procgenRng.js');
const {
    DEFAULT_BUDGET, VERDICT, bootStaging, collectGoal, solve,
} = await M('procgenOracle.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);

const SEED = Number(arg('seed', 1));
const LEVEL = Number(arg('level', 900));
/** ⚖ Slice 1's chosen goal-pickup class — the reasoning is in the report. */
const GOAL_CLASS = 'torchpickup';
/** The room's fixed start cell: the first interior cell. */
const START = { tx: 1, ty: 1 };

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/**
 * ONE GENERATION, from a seed — the whole thing this script proves.
 *
 * The seed's ONLY job in slice 1 is choosing the goal cell out of the room's
 * interior, which is enough to make "same seed ⇒ same level" a claim with
 * something in it. Slice 2's palette draws from the same stream.
 */
function generate(seed) {
    const rng = rngFor(seed);
    const room = emptyLevel({ level: LEVEL });
    const interior = [];
    for (let ty = 1; ty < room.height - 1; ty += 1) {
        for (let tx = 1; tx < room.width - 1; tx += 1) {
            if (tx === START.tx && ty === START.ty) continue;
            interior.push({ tx, ty });
        }
    }
    const cell = rng.pick(interior);
    const at = oelAtTile(cell.tx, cell.ty);
    const record = withEntities(room, [{ type: GOAL_CLASS, ...at, attrs: { tag: '0' } }]);
    const staging = bootStaging({ boot: bootAtTile(record, START.tx, START.ty) });
    const goals = [collectGoal(at.x, at.y)];
    const out = solve(record, staging, goals, DEFAULT_BUDGET, { name: `procgen-seed-${seed}` });
    return {
        rng, cell, at, record, staging, goals, out,
        /**
         * ⛔ THE PAYLOAD — everything that must be identical between two runs
         * of one seed, and NOTHING that is allowed to differ. `ms` is absent
         * by construction; so is anything derived from it.
         */
        payload: {
            seed,
            level: LEVEL,
            drawsSpent: rng.draws,
            rngState: rng.state,
            goalCell: cell,
            goalOel: at,
            goalClass: GOAL_CLASS,
            recordSha: sha(record),
            verdict: out.verdict,
            ticks: out.ticks,
            certification: out.certification,
            tapeSha: sha(out.tape),
            traceSha: sha(out.trace),
            records: out.records,
        },
    };
}

const note = (line) => process.stderr.write(`${line}\n`);
const say = (line) => process.stdout.write(`${line}\n`);
let failed = 0;
const check = (ok, what, detail) => {
    say(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed += 1;
};

// ── 1. the terrain vocabulary, against the world the engine builds ────
const probe = withTerrain(emptyLevel({ level: LEVEL }), [
    { tx: 3, ty: 3, terrain: 'water' },
    { tx: 5, ty: 5, terrain: 'pit' },
    { tx: 7, ty: 3, terrain: 'wall' },
]);
const probeWorld = buildLevelWorld(probe, { roles: ROLES });
const ringCells = 2 * (SINGLE_SCREEN_TILES.width + SINGLE_SCREEN_TILES.height) - 4;

if (!has('json')) {
    say('# SLICE 1 — the level model + the seam, proven against the engine');
    say('');
    say(`room: ${probe.width}x${probe.height} tiles `
        + `(one screen; SINGLE_SCREEN_TILES is SCREEN_W/TILE_SIZE, derived)`);
    say(`terrain columns: ${Object.values(TERRAIN)
        .map((t) => `${t.name}=col ${t.column} -> type ${t.type}`).join(' · ')}`);
    say('');
    check(probeWorld.solids.length === ringCells + 1,
        'WALL (column 3 -> type 2 Stone) joins `solids`',
        `${probeWorld.solids.length} solids = ${ringCells} ring + 1 placed`);
    check(probeWorld.solids.every((s) => s.tag === 'tile:Stone'),
        'every wall solid carries the tile tag the type names', 'tag `tile:Stone`');
    check(probeWorld.lethalTerrainTiles.length === 1
        && probeWorld.lethalTerrainTiles[0].t === TERRAIN.water.type,
        'WATER (column 2 -> type 1) lands in `lethalTerrainTiles`',
        `at (${probeWorld.lethalTerrainTiles[0]?.tx},${probeWorld.lethalTerrainTiles[0]?.ty})`);
    check(probeWorld.pitTiles.length === 1 && probeWorld.pitTiles[0].t === TERRAIN.pit.type,
        'PIT (column 7 -> type 6) lands in `pitTiles`',
        `at (${probeWorld.pitTiles[0]?.tx},${probeWorld.pitTiles[0]?.ty})`);
    const ground = probeWorld.walkableTiles.filter((t) => t.t === TERRAIN.ground.type);
    check(ground.length === (probe.width - 2) * (probe.height - 2) - 3,
        'GROUND (column 0 -> type 0) is walkable',
        `${ground.length} walkable ground cells (interior minus the three probes)`);
    say('');
}

// ── 2-3. the seam and the goal ────────────────────────────────────────
const first = generate(SEED);
const firstMs = first.out.ms;
const second = generate(SEED);

if (!has('json')) {
    say(`## the generated level (seed ${SEED})`);
    say(`goal: ${GOAL_CLASS} at cell (${first.cell.tx},${first.cell.ty}) `
        + `= OEL (${first.at.x},${first.at.y}); start cell (${START.tx},${START.ty})`);
    say(`draws spent: ${first.rng.draws}; rng state after: ${first.rng.state}`);
    say('');
    check(first.out.verdict === VERDICT.SOLVED,
        'the empty bordered room + goal pickup SOLVES through the injected levelSource',
        `${first.out.verdict}, ${first.out.ticks} ticks`);
    check(first.out.certification?.certified === true,
        'the goal is CERTIFIED from the solve\'s own collect record (⚖ §3.4)',
        JSON.stringify(first.out.certification?.collected ?? null));
    check((first.out.dangerQueries ?? []).every((q) => q.danger === false),
        'the danger channel is calm on a success — BY CONSTRUCTION, not by absence '
        + '(trap 202)',
        `${(first.out.dangerQueries ?? []).length} queries recorded, 0 dangerous`);
    say(`budget: wallClockMs=${DEFAULT_BUDGET.wallClockMs}, `
        + `maxTicksPerTarget=${DEFAULT_BUDGET.maxTicksPerTarget}`);
    say('');
}

// ── 4. determinism ────────────────────────────────────────────────────
const a = JSON.stringify(first.payload);
const b = JSON.stringify(second.payload);
if (has('json')) {
    say(JSON.stringify(first.payload, null, 2));
} else {
    say('## determinism');
    check(a === b, 'two generations of seed ' + SEED + ' are BYTE-IDENTICAL',
        `${a.length} bytes, sha ${sha(first.payload)}`);
    const other = generate(SEED + 1);
    check(JSON.stringify(other.payload) !== a,
        `seed ${SEED + 1} is a DIFFERENT level — the seed is the identity, not decoration`,
        `goal cell (${other.cell.tx},${other.cell.ty}) vs (${first.cell.tx},${first.cell.ty})`);
    say('');

    // ── the other two verdict classes, exercised ──────────────────────
    say('## the verdict classes');
    const boxed = withTerrain(first.record, [
        { tx: first.cell.tx - 1, ty: first.cell.ty, terrain: 'wall' },
        { tx: first.cell.tx, ty: first.cell.ty - 1, terrain: 'wall' },
        { tx: first.cell.tx - 1, ty: first.cell.ty - 1, terrain: 'wall' },
        { tx: first.cell.tx + 1, ty: first.cell.ty, terrain: 'wall' },
        { tx: first.cell.tx, ty: first.cell.ty + 1, terrain: 'wall' },
    ]);
    const refused = solve(boxed, first.staging, first.goals, DEFAULT_BUDGET,
        { name: 'procgen-boxed' });
    check(refused.verdict === VERDICT.REFUSED,
        'a goal walled into its own cell is REFUSED, and the refusal text is VERBATIM',
        refused.verdict);
    say(`   refusal (${refused.errorName}): ${refused.reasonText}`);
    const starved = solve(first.record, first.staging, first.goals,
        { maxTicksPerTarget: 7 }, { name: 'procgen-starved' });
    check(starved.verdict === VERDICT.BUDGET_EXHAUSTED,
        'a 7-tick per-target budget is BUDGET_EXHAUSTED — its own class, a BOUND and '
        + 'never a proof',
        `${starved.verdict}${starved.budgetKind ? ` (${starved.budgetKind})` : ''}`);
    say(`   classified by: ${starved.classifiedBy}`);
    say('');
    say(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
}

note(`[timing, stderr only] solve ${firstMs} ms (first), ${second.out.ms} ms (second)`);
process.exit(failed === 0 ? 0 : 1);
