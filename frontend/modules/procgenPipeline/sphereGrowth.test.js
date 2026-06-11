/**
 * Sphere-driven growth driver (build-order steps 3+4): buildSphereTree
 * structure, growSpheres realisation, and THE ORACLE — the computed
 * sphere log of the emitted rules.json must equal the input plan
 * exactly (multisets per sphere).
 */
import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
// Side-effect: registers the maze and bounce substrates.
import '../mazeRoom/mazeRoomLibrary.js';
import { GATEABLE_ITEMS } from '../bounceDemo/bounceDemoLibrary.js';
import { validateLevel } from '../bounceDemo/level.js';
import {
    buildSphereTree, growSpheres, buildRulesJson,
} from './procgenPipelineEngine.js';
import {
    planSpheres, computeItemSpheres, compareSpheresToPlan,
} from './spherePlanner.js';

// Maze worlds speak itemLib ids (key_red etc. from DEFAULT_ITEMS);
// rules.json item names are those ids verbatim.
const POOL = { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 };

const makePlan = (seed = 1, sphereCount = 3) => planSpheres({
    itemPool: POOL,
    sphereCount,
    victoryItem: 'victory',
    seed,
});

describe('buildSphereTree', () => {
    const tree = buildSphereTree(makePlan(), {
        maxItemsPerRegion: 2, fillerCount: 2, revisitRatio: 0.3,
    }, createRng(1));

    it('builds parents before children with valid sides', () => {
        for (const node of tree.nodes) {
            if (node.parent == null) {
                expect(node.wave).toBe(0);
                expect(node.side).toBeNull();
            } else {
                expect(node.parent).toBeLessThan(node.index);
                expect(['N', 'S', 'E', 'W']).toContain(node.side);
            }
            expect(node.usedSides.size).toBeLessThanOrEqual(4);
        }
    });

    it('enforces the stratification rule on entry gates', () => {
        const plan = makePlan();
        for (const node of tree.nodes) {
            if (node.wave === 0 && !node.isFiller) {
                expect(node.gate).toEqual([]);
            } else if (node.isFiller && node.wave === 0) {
                // wave-0 fillers carry no items, so they may gate on
                // sphere-1 items (frees the host's arrowless slot)
                expect(node.gate.every(
                    (i) => plan.spheres[0].items.includes(i))).toBe(true);
            } else {
                // gate = exactly one item from sphere `wave`
                expect(node.gate).toHaveLength(1);
                expect(plan.spheres[node.wave - 1].items).toContain(node.gate[0]);
            }
        }
    });

    it('hosts each wave\'s items on that wave\'s regions, fillers empty', () => {
        const plan = makePlan();
        for (let w = 0; w < plan.spheres.length; w++) {
            const hosted = tree.nodes.filter((n) => n.wave === w)
                .flatMap((n) => n.items.map((it) => it.item)).sort();
            expect(hosted).toEqual([...plan.spheres[w].items].sort());
        }
        expect(tree.nodes.filter((n) => n.isFiller)
            .every((n) => n.items.length === 0)).toBe(true);
        expect(tree.nodes.filter((n) => n.isFiller)).toHaveLength(2);
    });

    it('never exceeds maxItemsPerRegion', () => {
        for (const node of tree.nodes) {
            expect(node.items.length).toBeLessThanOrEqual(2);
        }
    });
});

describe('growSpheres (maze) — the sphere oracle', () => {
    // The core promise: for a spread of seeds/shapes, the emitted
    // rules.json computes back to EXACTLY the planned spheres.
    it.each([
        [1, 3, 0, 0],
        [2, 3, 2, 0.5],
        [3, 4, 1, 0.25],
        [4, 5, 3, 0.4],
    ])('seed %i, %i spheres, %i fillers, revisit %f: computed spheres == plan',
        (seed, sphereCount, fillerCount, revisitRatio) => {
            const plan = makePlan(seed, sphereCount);
            const { grid, stats, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed,
                growthParams: {
                    spherePlan: plan, maxItemsPerRegion: 2, fillerCount, revisitRatio,
                },
            });
            expect(stats.stopReason).toBe('plan_complete');

            const rulesJson = buildRulesJson(grid, {
                startCell, seed, embedSphereLog: false,
            });
            const computed = computeItemSpheres(rulesJson);
            expect(compareSpheresToPlan(computed, plan)).toEqual([]);
        });

    it('places every region and wires every gate to a built child', () => {
        const plan = makePlan(1, 3);
        const { grid, stats, tree } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: { spherePlan: plan, fillerCount: 2 },
        });
        expect(stats.regionsBuilt).toBe(tree.nodes.length);
        // every non-back exit has a resolved target
        for (const region of grid.allRegions()) {
            for (const exit of region.extracted_rules.exits) {
                expect(exit.target_region).toBeTruthy();
            }
        }
    });

    it('is deterministic for a given seed', () => {
        const run = () => {
            const { grid, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed: 9,
                growthParams: { spherePlan: makePlan(9, 3), fillerCount: 1 },
            });
            return buildRulesJson(grid, { startCell, seed: 9, embedSphereLog: false });
        };
        expect(JSON.parse(JSON.stringify(run())))
            .toEqual(JSON.parse(JSON.stringify(run())));
    });

    it('rejects a missing or invalid plan', () => {
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            growthParams: {},
        })).toThrow(/spherePlan required/);
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            growthParams: { spherePlan: { spheres: [] } },
        })).toThrow(/invalid sphere plan/);
    });

    it('counts quota fallbacks when the plan needs more regions than the quotas allow', () => {
        const plan = makePlan(1, 3); // needs several regions
        const { stats } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: {
                spherePlan: plan,
                maxItemsPerRegion: 1,        // one region per item → many regions
                substrateQuotas: { maze: 2 }, // far too few
            },
        });
        expect(stats.quotaFallbacks).toBeGreaterThan(0);
        expect(stats.quotaFallbacks).toBe(stats.regionsBuilt - 2);
        // no quotas at all → the maze default is intentional, not a fallback
        const { stats: statsNoQuota } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: { spherePlan: makePlan(1, 3) },
        });
        expect(statsNoQuota.quotaFallbacks).toBe(0);
    });

    it('rejects unregistered substrates in the quotas upfront', () => {
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: {
                spherePlan: makePlan(1, 2),
                substrateQuotas: { no_such_substrate: 99 },
            },
        })).toThrow(/'no_such_substrate' is not registered/);
    });
});

// ── Step 5: bounce in the driver ─────────────────────────────────────

const BOUNCE_POOL = {
    'Right arrow': 1, 'Left arrow': 1, 'Springs': 1, 'Jetpacks': 1,
    'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
};

// Mirrors the panel's bounce-start orchestration: sphere 1 is EXACTLY
// one arrow (the start-stack intro); the other arrow is an ordinary
// pool item.
const makeBouncePlan = (seed, sphereCount) => planSpheres({
    itemPool: BOUNCE_POOL,
    sphereCount,
    exclusiveSpheres: { 1: ['Right arrow'] },
    victoryItem: 'Victory',
    gateableItems: GATEABLE_ITEMS,
    seed,
});

describe('growSpheres — count gates (duplicate-instance pools)', () => {
    // The duplicate-instance fix: when the planner splits N instances
    // of one item across spheres, a gate on that item demands its
    // CUMULATIVE count through the gate's sphere (Has with
    // args.count), so the region opens exactly at its planned sphere
    // instead of a sphere early.
    const DUP_POOL = { key_red: 2, key_blue: 1, victory: 1 };

    const collectCountGates = (rulesJson) => {
        const found = [];
        const walk = (rule, where) => {
            if (!rule || typeof rule !== 'object') return;
            if (rule.rule === 'Has' && (rule.args?.count ?? 1) > 1) {
                found.push({ where, ...rule.args });
            }
            for (const c of rule.children ?? []) walk(c, where);
        };
        for (const region of Object.values(rulesJson.regions['1'])) {
            for (const ex of region.exits) walk(ex.access_rule, ex.name);
        }
        return found;
    };

    // Seeds where the planner splits key_red across spheres 1 and 2
    // (verified by inspection) — the case that used to fail the
    // oracle with single-item Has gates.
    it.each([[2], [3], [7]])(
        'seed %i: split key_red realises the plan exactly via a count gate',
        (seed) => {
            const plan = planSpheres({
                itemPool: DUP_POOL, sphereCount: 3,
                victoryItem: 'victory', seed,
            });
            const spheresWithKeyRed = plan.spheres
                .filter((s) => s.items.includes('key_red')).length;
            expect(spheresWithKeyRed).toBeGreaterThan(1); // the split happened

            const { grid, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed,
                growthParams: { spherePlan: plan },
            });
            const rulesJson = buildRulesJson(grid, {
                startCell, seed, embedSphereLog: false,
            });
            expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan))
                .toEqual([]);

            // Any gate on key_red at sphere 2 must demand both copies.
            const countGates = collectCountGates(rulesJson);
            for (const g of countGates) {
                expect(g.item_name).toBe('key_red');
                expect(g.count).toBe(2);
            }
        });

    it('both instances in ONE sphere needs no count gate (and still verifies)', () => {
        // Seed 1 puts both key_red copies in sphere 1 — gates on it
        // are plain Has; the oracle must hold either way.
        const plan = planSpheres({
            itemPool: DUP_POOL, sphereCount: 3,
            victoryItem: 'victory', seed: 1,
        });
        expect(plan.spheres[0].items.filter((i) => i === 'key_red')).toHaveLength(2);
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: { spherePlan: plan },
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 1, embedSphereLog: false,
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
    });

    it('buildSphereTree stamps cumulative gateCounts on count-gated nodes', () => {
        // Hand-written split plan: the wave-2 gate on key_red must
        // demand cumulative count 2 (one instance per sphere 1-2).
        const plan = {
            seed: 1,
            spheres: [
                { sphere: 1, items: ['key_red'] },
                { sphere: 2, items: ['key_red'] },
                { sphere: 3, items: ['victory'] },
            ],
        };
        const tree = buildSphereTree(plan, {}, createRng(1));
        const wave2 = tree.nodes.find((n) => n.wave === 2 && !n.isFiller);
        expect(wave2.gate).toEqual(['key_red']);
        expect(wave2.gateCounts).toEqual({ key_red: 2 });
        const wave1 = tree.nodes.find((n) => n.wave === 1 && !n.isFiller);
        expect(wave1.gate).toEqual(['key_red']);
        expect(wave1.gateCounts).toEqual({ key_red: 1 });
    });

    it('bounce cannot realise a count gate — loud failure, not a broken world', () => {
        // TEMPORARY restriction until bounce's rule-gated portals land
        // (priority list #2): a multi-instance gate item never lands on
        // a bounce-owned exit / back portal. A bounce-only world whose
        // only sphere-2 gate item is multi-instance must fail loudly.
        const plan = {
            seed: 1,
            spheres: [
                { sphere: 1, items: ['Right arrow'] },
                { sphere: 2, items: ['Springs', 'Springs'] },
                { sphere: 3, items: ['Victory'] },
            ],
        };
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: {
                spherePlan: plan,
                substrateQuotas: { bounce: 99 },
                startSubstrate: 'bounce',
            },
        })).toThrow(/cannot realise a back portal|no host can realise/);
    });

    it('mixed world: count gates land on maze exits, bounce keeps single-instance gates', () => {
        const pool = {
            'Right arrow': 1, Springs: 1,
            key_red: 2, key_blue: 1, victory: 1,
        };
        // Find a seed whose plan splits key_red; assert the world
        // still realises exactly with bounce in the mix.
        for (let seed = 1; seed <= 12; seed++) {
            const plan = planSpheres({
                itemPool: pool, sphereCount: 3,
                victoryItem: 'victory', seed,
            });
            if (plan.spheres.filter((s) => s.items.includes('key_red')).length < 2) continue;
            const { grid, startCell, tree } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed,
                growthParams: {
                    spherePlan: plan,
                    substrateQuotas: { maze: 99, bounce: 2 },
                    startSubstrate: 'maze',
                },
            });
            // No bounce node carries (or is gated by) a count > 1.
            for (const node of tree.nodes) {
                if (node.substrate !== 'bounce') continue;
                for (const c of Object.values(node.gateCounts ?? {})) {
                    expect(c).toBe(1);
                }
            }
            const rulesJson = buildRulesJson(grid, {
                startCell, seed, embedSphereLog: false,
                startingItems: ['Left arrow'],
                sourceItems: {
                    'Left arrow': {
                        name: 'Left arrow', id: 999,
                        classification: 'progression', groups: ['Everything'],
                    },
                },
            });
            expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
            return; // one verified split seed is enough
        }
        throw new Error('no seed in 1..12 split key_red — adjust the fixture');
    }, 120000);
});

describe('growSpheres (bounce) — zone realisation + oracle', () => {
    it.each([
        [1, 3],
        [2, 4],
        [3, 4],
    ])('bounce-only world, seed %i, %i spheres: computed spheres == plan',
        (seed, sphereCount) => {
            const plan = makeBouncePlan(seed, sphereCount);
            const { grid, stats, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed,
                regionParams: { fallBehavior: 'current' },
                growthParams: {
                    spherePlan: plan,
                    substrateQuotas: { bounce: 99 },
                    startSubstrate: 'bounce',
                    maxItemsPerRegion: 2,
                },
            });
            expect(stats.substrateCounts.bounce).toBe(stats.regionsBuilt);

            // every bounce level validates, and every NON-START region
            // carries a guaranteed back portal on its entrance side
            const startRegionId = grid.getRegion(startCell).region_id;
            for (const region of grid.allRegions()) {
                const params = region.playable_payload?.params;
                expect(params?.bounceLevel).toBeTruthy();
                expect(validateLevel(params.bounceLevel)).toEqual([]);
                if (region.region_id !== startRegionId) {
                    expect(params.backExitSide).toBeTruthy();
                    expect(params.sidePortals[params.backExitSide]).toBeTruthy();
                    expect(params.fallBehavior).toBe('current');
                }
            }

            // the start stack hosts exactly the sphere-1 arrow
            const startRegion = grid.getRegion(startCell);
            const startLocs = startRegion.extracted_rules.locations;
            expect(startLocs).toHaveLength(1);
            expect(startLocs[0].item).toBe('Right arrow');

            const rulesJson = buildRulesJson(grid, {
                startCell, seed, embedSphereLog: false,
                completionConditionItem: 'Victory',
                // the panel locks the start-stack arrow's canonical
                // placement (multiworld fill must keep it an arrow)
                lockedCanonicalItems: ['Right arrow'],
            });
            const computed = computeItemSpheres(rulesJson);
            expect(compareSpheresToPlan(computed, plan)).toEqual([]);

            // locked:true landed on exactly the start-stack arrow location
            const lockedLocs = Object.values(rulesJson.regions['1'])
                .flatMap((r) => r.locations.filter((l) => l.locked));
            expect(lockedLocs).toHaveLength(1);
            expect(lockedLocs[0].item.name).toBe('Right arrow');
            const startRegionName = grid.getRegion(startCell).region_id;
            expect(rulesJson.regions['1'][startRegionName].locations
                .some((l) => l.locked)).toBe(true);
        }, 120000);

    it('a starting-item arrow rides rules.json and the oracle still holds (mixed start)', () => {
        // The panel's non-bounce-start path: the arrow leaves the pool
        // and becomes a starting item; bounce regions are traversable
        // on first encounter.
        const pool = {
            'Left arrow': 1, Springs: 1, 'Blue platforms': 1,
            key_red: 1, victory: 1,
        };
        const plan = planSpheres({
            itemPool: pool,
            sphereCount: 3,
            victoryItem: 'victory',
            gateableItems: GATEABLE_ITEMS,
            seed: 6,
        });
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 6,
            growthParams: {
                spherePlan: plan,
                substrateQuotas: { maze: 1, bounce: 99 },
                startSubstrate: 'maze',
            },
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 6, embedSphereLog: false,
            startingItems: ['Right arrow'],
            sourceItems: {
                'Right arrow': {
                    name: 'Right arrow', id: 999,
                    classification: 'progression', groups: ['Everything'],
                },
            },
        });
        expect(rulesJson.starting_items['1']).toEqual(['Right arrow']);
        expect(rulesJson.items['1']['Right arrow']).toBeTruthy();
        const computed = computeItemSpheres(rulesJson);
        expect(compareSpheresToPlan(computed, plan)).toEqual([]);
    }, 120000);

    it('mixed maze+bounce world realises the plan exactly', () => {
        const pool = {
            'Right arrow': 1, 'Left arrow': 1, 'Springs': 1,
            key_red: 1, key_blue: 1, victory: 1,
        };
        // gateableItems guarantees every non-final sphere carries a
        // bounce-gateable item — bounce children can't sit behind key
        // gates (their guaranteed back portal carries the entry gate).
        const plan = planSpheres({
            itemPool: pool,
            sphereCount: 3,
            pins: { 'Right arrow': 1, 'Left arrow': 1 },
            victoryItem: 'victory',
            gateableItems: GATEABLE_ITEMS,
            seed: 4,
        });
        const { grid, stats, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 4,
            growthParams: {
                spherePlan: plan,
                // exactly one maze region (the start), bounce for the rest
                substrateQuotas: { maze: 1, bounce: 99 },
                startSubstrate: 'maze',
                fillerCount: 1,
            },
        });
        expect(stats.substrateCounts.maze).toBe(1);
        expect(stats.substrateCounts.bounce).toBeGreaterThan(0);

        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 4, embedSphereLog: false,
        });
        const computed = computeItemSpheres(rulesJson);
        expect(compareSpheresToPlan(computed, plan)).toEqual([]);
    }, 120000);
});
