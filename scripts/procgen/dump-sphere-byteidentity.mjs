// Byte-identity harness for the sphere-growth -> generateRegion wiring
// (unify substrates, Phase 2c). Dumps the FULL serialized output of
// growSpheres for a few representative configs (zone-only, mixed
// maze+bounce) so a before/after diff proves the refactor is
// behavior-preserving. Not a test — a one-off oracle. Run:
//   node scripts/procgen/dump-sphere-byteidentity.mjs /tmp/sphere-<tag>.json
import { writeFileSync } from 'node:fs';
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import { GATEABLE_ITEMS } from '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import { growSpheres, buildRulesJson } from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { planSpheres } from '../../frontend/modules/procgenPipeline/spherePlanner.js';

// Serialize a grid's regions deterministically: region object minus the
// runtime Map (exits), which we render as a sorted array.
function dumpGrid(grid) {
    const out = {};
    for (const region of grid.allRegions()) {
        const pp = region.playable_payload ?? {};
        const exits = pp.exits instanceof Map ? [...pp.exits.values()] : (pp.exits ?? []);
        out[region.region_id] = {
            substrate: region.substrate,
            extracted_rules: region.extracted_rules,
            exits_placed: region.exits_placed,
            placed_items: region.placed_items,
            // normalise [] vs undefined (a write-only region field never
            // read for output) so the diff focuses on real artifacts.
            placed_logic_gates: region.placed_logic_gates?.length ? region.placed_logic_gates : null,
            payload: { ...pp, exits, entrance: pp.entrance ?? null },
        };
    }
    return out;
}

const BOUNCE_POOL = {
    'Right arrow': 1, 'Left arrow': 1, 'Springs': 1, 'Jetpacks': 1,
    'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
};

function bounceOnly() {
    const plan = planSpheres({
        itemPool: BOUNCE_POOL, sphereCount: 3,
        exclusiveSpheres: { 1: ['Right arrow'] },
        victoryItem: 'Victory', gateableItems: GATEABLE_ITEMS, seed: 1,
    });
    const { grid, startCell, stats } = growSpheres({
        regionSize: { width: 8, height: 6 }, seed: 1,
        regionParams: { fallBehavior: 'current' },
        growthParams: {
            spherePlan: plan, substrateQuotas: { bounce: 99 },
            startSubstrate: 'bounce', maxItemsPerRegion: 2,
        },
    });
    const rulesJson = buildRulesJson(grid, {
        startCell, seed: 1, embedSphereLog: false,
        completionConditionItem: 'Victory', lockedCanonicalItems: ['Right arrow'],
    });
    return { grid: dumpGrid(grid), rulesJson, stats };
}

function mixed() {
    const pool = {
        'Right arrow': 1, 'Left arrow': 1, 'Springs': 1,
        key_red: 1, key_blue: 1, victory: 1,
    };
    const plan = planSpheres({
        itemPool: pool, sphereCount: 3,
        pins: { 'Right arrow': 1, 'Left arrow': 1 },
        victoryItem: 'victory', gateableItems: GATEABLE_ITEMS, seed: 4,
    });
    const { grid, startCell, stats } = growSpheres({
        regionSize: { width: 8, height: 6 }, seed: 4,
        growthParams: {
            spherePlan: plan, substrateQuotas: { maze: 1, bounce: 99 },
            startSubstrate: 'maze', fillerCount: 1,
        },
    });
    const rulesJson = buildRulesJson(grid, { startCell, seed: 4, embedSphereLog: false });
    return { grid: dumpGrid(grid), rulesJson, stats };
}

const result = { bounceOnly: bounceOnly(), mixed: mixed() };
const outPath = process.argv[2] ?? '/tmp/sphere-dump.json';
writeFileSync(outPath, JSON.stringify(result, null, 1));
process.stderr.write(`wrote ${outPath}\n`);
// The engine's module graph pulls in stateManager, which leaves an
// unref'd worker/timer handle that keeps node's event loop alive — the
// script's work is done synchronously above, so exit explicitly rather
// than hang in epoll_wait waiting for a handle that never closes.
process.exit(0);
