// Byte-identity harness for the top-down stepped pipeline
// (docs/json/developer/procgen/stepped-pipeline.md).
// Dumps the FULL serialized output of topDownFromRulesJson + buildRulesJson for
// a few representative sources (maze-only with multiple regions + gated content,
// and a mixed maze+bounce layout) so a before/after diff proves the MECHANICAL
// split (layoutTopDown / realiseTopDownGen / finalizeTopDown) is behavior-
// preserving. Not a test — a one-off oracle. Run:
//   node scripts/procgen/dump-topdown-byteidentity.mjs /tmp/topdown-<tag>.json
import { writeFileSync } from 'node:fs';
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import {
    topDownFromRulesJson, buildRulesJson, getRegionExits, getRegionEntrance,
} from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';

// Serialize a grid's regions deterministically (same shape as the sphere
// harness): region object minus the runtime Map (exits), rendered as an array.
function dumpGrid(grid) {
    const out = {};
    for (const region of grid.allRegions()) {
        const pp = region.playable_payload ?? {};
        const exitMap = getRegionExits(region);
        const exits = exitMap instanceof Map ? [...exitMap.values()] : (exitMap ?? []);
        out[region.region_id] = {
            substrate: region.substrate,
            extracted_rules: region.extracted_rules,
            exits_placed: region.exits_placed,
            placed_items: region.placed_items,
            placed_logic_gates: region.placed_logic_gates?.length ? region.placed_logic_gates : null,
            entrance: getRegionEntrance(region) ?? null,
            payload: { ...pp, exits, entrance: getRegionEntrance(region) ?? null },
        };
    }
    return out;
}

// A maze-only source with several branching regions + gated exits and
// locations, sized to exercise generateRegionProcedural's retry loop (the
// variable-rng path) and the teleporter fallback on a cramped grid.
function mazeSource() {
    return {
        start_regions: { '1': { default: ['Menu'] } },
        assume_bidirectional_exits: true,
        game_name: 'MazeByteIdentity',
        regions: {
            '1': {
                Menu: {
                    name: 'Menu',
                    exits: [{ name: 'GameStart', connected_region: 'Hub', access_rule: { rule: 'True_' } }],
                    locations: [],
                },
                Hub: {
                    name: 'Hub',
                    exits: [
                        { name: 'toNorth', connected_region: 'North', access_rule: { rule: 'True_' } },
                        { name: 'toEast', connected_region: 'East', access_rule: { rule: 'True_' } },
                        { name: 'toWest', connected_region: 'West', access_rule: { rule: 'True_' } },
                    ],
                    locations: [
                        { name: 'Hub_Chest', item: { name: 'key_red' } },
                    ],
                },
                North: {
                    name: 'North',
                    exits: [
                        { name: 'toDeep', connected_region: 'Deep', access_rule: { rule: 'Has', args: { item_name: 'key_red' } } },
                    ],
                    locations: [
                        { name: 'North_A', item: { name: 'key_blue' } },
                        { name: 'North_B', item: { name: 'filler_1' } },
                    ],
                },
                East: {
                    name: 'East',
                    exits: [],
                    locations: [
                        { name: 'East_A', item: { name: 'filler_2' } },
                        { name: 'East_B', item: { name: 'Victory' } },
                    ],
                },
                West: {
                    name: 'West',
                    exits: [
                        { name: 'toDeep2', connected_region: 'Deep', access_rule: { rule: 'Has', args: { item_name: 'key_blue' } } },
                    ],
                    locations: [
                        { name: 'West_A', item: { name: 'filler_3' } },
                    ],
                },
                Deep: {
                    name: 'Deep',
                    exits: [],
                    locations: [
                        { name: 'Deep_A', item: { name: 'filler_4' } },
                    ],
                },
            },
        },
    };
}

// Hub (maze) -> BounceZone (bounce) -> End (maze): the mixed cross-substrate
// case from topDownBounce.slow.test.js, with a physics-gated bounce exit.
function mixedSource() {
    return {
        start_regions: { '1': { default: ['Menu'] } },
        assume_bidirectional_exits: true,
        game_name: 'MixedByteIdentity',
        regions: {
            '1': {
                Menu: {
                    name: 'Menu',
                    exits: [{ name: 'GameStart', connected_region: 'Hub', access_rule: { rule: 'True_' } }],
                    locations: [],
                },
                Hub: {
                    name: 'Hub',
                    exits: [{ name: 'enterBounce', connected_region: 'BounceZone', access_rule: { rule: 'True_' } }],
                    locations: [],
                },
                BounceZone: {
                    name: 'BounceZone',
                    exits: [
                        { name: 'toEnd', connected_region: 'End', access_rule: { rule: 'Has', args: { item_name: 'Blue platforms' } } },
                    ],
                    locations: [
                        { name: 'Bounce_Pickup', item: { name: 'Blue platforms' }, access_rule: { rule: 'True_' } },
                    ],
                },
                End: {
                    name: 'End',
                    exits: [],
                    locations: [
                        { name: 'End_Goal', item: { name: 'Victory' } },
                    ],
                },
            },
        },
    };
}

function run(source, opts) {
    try {
        const res = topDownFromRulesJson(source, opts);
        const rulesJson = buildRulesJson(res.grid, {
            startCell: res.startCell, seed: opts.seed ?? 1, embedSphereLog: false,
            assumeBidirectional: source.assume_bidirectional_exits !== false,
        });
        return {
            grid: dumpGrid(res.grid),
            rulesJson,
            stats: res.stats,
            sphereTree: res.sphereTree ?? null,
            spherePlan: res.spherePlan ?? null,
            attributionWarnings: res.attributionWarnings ?? [],
        };
    } catch (err) {
        return { error: String(err && err.message ? err.message : err) };
    }
}

// Mixed case: pin BounceZone to bounce, everything else to maze (the deterministic
// driver pattern — a random mix can land bounce on a terminal/exitless region,
// which the bounce realiser rejects). Grant the drift arrows as free items so a
// surplus bounce exit can ride a free-arrow drift.
const MIXED_BY_REGION = {
    Menu: 'maze', Hub: 'maze', BounceZone: 'bounce', End: 'maze',
};
const FREE_ARROWS = ['Right arrow', 'Left arrow'];

const result = {
    maze_s1: run(mazeSource(), { gridDims: { width: 4, height: 4 }, seed: 1, substrateMix: { maze: 1 } }),
    maze_s7: run(mazeSource(), { gridDims: { width: 4, height: 4 }, seed: 7, substrateMix: { maze: 1 } }),
    mixed_s1: run(mixedSource(), {
        gridDims: { width: 5, height: 5 }, seed: 1,
        substrateByRegion: MIXED_BY_REGION, freeItems: FREE_ARROWS,
    }),
    mixed_s3: run(mixedSource(), {
        gridDims: { width: 5, height: 5 }, seed: 3,
        substrateByRegion: MIXED_BY_REGION, freeItems: FREE_ARROWS,
    }),
};
const outPath = process.argv[2] ?? '/tmp/topdown-dump.json';
writeFileSync(outPath, JSON.stringify(result, null, 1));
process.stderr.write(`wrote ${outPath}\n`);
process.exit(0);
