/**
 * Phase-2 check: the headless CLIs build their sphere-growth config through the
 * SAME substrate-hook assembly the panel uses (sphereConfigHooks), so the CLI's
 * emitted regionParams / starting items / exclusive spheres match what the
 * panel produces — no more inline arrow block + minimal {fallBehavior,
 * physicsProfile} regionParams.
 *
 * Asserts, for a bounce world:
 *   1. sphere-step.js's envelope config.regionParams equals the canonical
 *      hook-assembled regionParams (the panel path), and carries the FULL braid
 *      layout (bounceMode/braidWidth/bounceJitter/platformRows/decoration/
 *      bounceFreeArrow) — not the old 2-key minimal shape.
 *   2. The free arrow is a starting item (removed from the pool), with no
 *      exclusiveSpheres (the column-mode start-stack is gone).
 *   3. dump-sphere-growth.js produces a byte-identical rules.json (both CLIs on
 *      one shared prep).
 * And, for a maze world: regionParams is {} (no bounce keys leak in).
 *
 * Pure-node (spawns the CLIs); no dev server needed.
 * Run: node scripts/procgen/verify-cli-sphere-config.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Substrate libraries register their adapters on import.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import {
    defaultProcgenParams, activeSubstrateIds,
    collectSphereGrowthPrep, assembleRegionParams,
} from '../../frontend/modules/procgenPipeline/sphereConfigHooks.js';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'cli-sphere-config-'));
function fail(msg) { console.error('FAIL:', msg); process.exit(1); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function runCli(script, args) {
    const r = spawnSync('node', [join(here, script), ...args], { encoding: 'utf8' });
    if (r.status !== 0) fail(`${script} exited ${r.status}\n${r.stderr}`);
    return r;
}

const BOUNCE_ITEMS = [
    'Right arrow', 'Left arrow', 'Springs', 'Jetpacks',
    'Blue platforms', 'Brown platforms', 'Victory',
];
const bounceItemFlags = BOUNCE_ITEMS.flatMap((i) => ['--items', `${i}=1`]);
const BOUNCE_ARGS = [
    '--start', 'bounce', '--quota', 'bounce=99',
    ...bounceItemFlags, '--victory', 'Victory', '--spheres', '3', '--seed', '1',
];

// ── Expected: the panel path (shared hooks). The panel merges
// defaultProcgenParams over DEFAULT_PARAMS, but DEFAULT_PARAMS declares no
// bounce* keys, so the bounce*-driven regionParams are identical to merging
// over {}. ───────────────────────────────────────────────────────────────
const params = defaultProcgenParams({});
const quotas = { bounce: 99 };
const activeIds = activeSubstrateIds(quotas, 'bounce');
const itemPool = Object.fromEntries(BOUNCE_ITEMS.map((i) => [i, 1]));
const prep = collectSphereGrowthPrep({
    activeIds, itemPool, quotas, startSubstrate: 'bounce', seed: 1, params,
});
const expectedRegionParams = assembleRegionParams({
    activeIds, mode: 'sphere', params, extra: prep.regionParams,
});

// ── 1 + 2. sphere-step.js envelope ─────────────────────────────────────
{
    const out = join(tmp, 'ss-bounce.json');
    runCli('sphere-step.js', ['plan', ...BOUNCE_ARGS, '-o', out]);
    const env = JSON.parse(readFileSync(out, 'utf8'));
    const rp = env.config.regionParams;
    if (!eq(rp, expectedRegionParams)) {
        fail(`sphere-step regionParams != panel hooks\n  cli:   ${JSON.stringify(rp)}\n  panel: ${JSON.stringify(expectedRegionParams)}`);
    }
    for (const k of ['bounceMode', 'braidWidth', 'bounceJitter', 'platformRows',
        'bounceDecorChance', 'bounceFreeArrow']) {
        if (!(k in rp)) fail(`sphere-step regionParams missing braid key '${k}' (got ${JSON.stringify(rp)})`);
    }
    if (rp.bounceMode !== 'braid') fail(`expected braid mode, got ${rp.bounceMode}`);
    console.log('1. sphere-step regionParams == panel hooks, full braid layout — OK');

    if (!eq(env.config.startingItems, prep.startingItems) || env.config.startingItems.length !== 1) {
        fail(`expected one free-arrow starting item, got ${JSON.stringify(env.config.startingItems)}`);
    }
    const arrow = env.config.startingItems[0];
    if ((env.config.itemPool[arrow] ?? 0) !== 0) fail(`free arrow ${arrow} not removed from pool`);
    if (Object.keys(env.config.exclusiveSpheres).length !== 0) {
        fail(`expected no exclusiveSpheres (start-stack gone), got ${JSON.stringify(env.config.exclusiveSpheres)}`);
    }
    console.log(`2. free arrow (${arrow}) is a starting item, pool-removed, no exclusiveSpheres — OK`);
}

// ── 3. dump-sphere-growth.js byte-identical rules.json ──────────────────
{
    const ssFull = join(tmp, 'ss-bounce-full.json');
    runCli('sphere-step.js', ['run', '--to', 'compile', ...BOUNCE_ARGS, '-o', ssFull]);
    const ss = JSON.parse(readFileSync(ssFull, 'utf8'));

    const dumpOut = join(tmp, 'dump-bounce.json');
    runCli('dump-sphere-growth.js', [...BOUNCE_ARGS, '-o', dumpOut]);
    const dump = JSON.parse(readFileSync(dumpOut, 'utf8'));

    if (ss.compile.oracleErrors.length) fail(`sphere-step oracle: ${ss.compile.oracleErrors[0]}`);
    if (dump.oracle.errors.length) fail(`dump oracle: ${dump.oracle.errors[0]}`);
    if (!eq(ss.compile.rulesJson, dump.rulesJson)) {
        fail('sphere-step and dump rules.json differ for the same bounce world');
    }
    console.log('3. sphere-step and dump produce byte-identical bounce rules.json — OK');
}

// ── 4. maze world: no bounce keys leak into regionParams ────────────────
{
    const MAZE_ARGS = [
        '--quota', 'maze=4', '--items', 'key_red=1', '--items', 'key_green=1',
        '--items', 'key_blue=1', '--items', 'victory=1', '--victory', 'victory',
        '--spheres', '3', '--seed', '1',
    ];
    const out = join(tmp, 'ss-maze.json');
    runCli('sphere-step.js', ['plan', ...MAZE_ARGS, '-o', out]);
    const env = JSON.parse(readFileSync(out, 'utf8'));
    if (!eq(env.config.regionParams, {})) {
        fail(`maze regionParams should be {}, got ${JSON.stringify(env.config.regionParams)}`);
    }
    console.log('4. maze regionParams is {} (no bounce keys leak) — OK');
}

console.log('VERIFY CLI SPHERE CONFIG: ALL OK');
