import { describe, it, expect } from 'vitest';
import { generateLoopCosts, _internal } from './loopCostGenerator.js';

const { bfsRegions, buildAdjacency, buildLocationIndex, extractLocationEntries } = _internal;

function makeRules(regions, startRegion) {
    return {
        regions: { '1': regions },
        start_regions: { '1': { default: [startRegion] } },
    };
}

function stateUpdate(sphereIndex, sphereLocations, itemsReceived = 0) {
    return {
        type: 'state_update',
        sphere_index: sphereIndex,
        player_data: {
            '1': {
                sphere_locations: sphereLocations,
                new_inventory_details: itemsReceived > 0
                    ? { base_items: { 'Item': itemsReceived } }
                    : { base_items: {} },
            },
        },
    };
}

describe('loopCostGenerator — pure cost simulation', () => {
    describe('generateLoopCosts: smoke', () => {
        it('produces cost data with the canonical shape', () => {
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: { exits: [], locations: [{ name: 'Loc1' }] },
            }, 'Menu');
            const sphereLog = [stateUpdate(0, ['Loc1'])];

            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });

            expect(costs.version).toBe('1.0');
            expect(costs.regions).toBeDefined();
            expect(costs.locations).toBeDefined();
            expect(costs.defaultRegionCost).toBe(50);
            expect(costs.defaultLocationCost).toBe(10);
            expect(costs.regions.Menu.moveCost).toBe(0); // start region is free
        });

        it('start region always has moveCost 0', () => {
            const rules = makeRules({
                Start: { exits: [], locations: [] },
            }, 'Start');
            const costs = generateLoopCosts({ rulesJson: rules, sphereLog: [] });
            expect(costs.regions.Start).toEqual({ moveCost: 0, xpEffect: 'cost' });
        });
    });

    describe('cost assignment formulas', () => {
        it('region cost = floor(maxMana/2 / numUncosted)', () => {
            // Path: Menu → A → B → C, target = Loc in C
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: { exits: [{ name: 'to_b', connected_region: 'B' }], locations: [] },
                B: { exits: [{ name: 'to_c', connected_region: 'C' }], locations: [] },
                C: { exits: [], locations: [{ name: 'Loc' }] },
            }, 'Menu');
            const sphereLog = [stateUpdate(0, ['Loc'])];

            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });

            // maxMana = 100, manaForRegions = 50, 3 uncosted regions (A, B, C)
            // First: floor(50/3) = 16
            // Second: floor((50-16)/2) ??? — wait, the algorithm uses
            // floor(manaForRegions / remaining), constant manaForRegions.
            // Let me re-check: original code recomputes per iteration with
            // remaining decreasing. So:
            //   A: floor(50/3) = 16; remaining=2
            //   B: floor(50/2) = 25; remaining=1
            //   C: floor(50/1) = 50; remaining=0
            expect(costs.regions.A.moveCost).toBe(16);
            expect(costs.regions.B.moveCost).toBe(25);
            expect(costs.regions.C.moveCost).toBe(50);
        });

        it('location cost = floor(maxMana / 2)', () => {
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: { exits: [], locations: [{ name: 'Loc' }] },
            }, 'Menu');
            const sphereLog = [stateUpdate(0, ['Loc'])];

            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });
            expect(costs.locations.Loc).toBe(50);
        });

        it('clamps cost to minimum of 1', () => {
            // Path with 200 uncosted regions and maxMana=100 → cost = 0,
            // clamped to 1. We can't easily build 200 regions; just assert
            // the floor applied to a normal case yields ≥ 1.
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: { exits: [], locations: [{ name: 'Loc' }] },
            }, 'Menu');
            const sphereLog = [stateUpdate(0, ['Loc'])];
            const costs = generateLoopCosts({ rulesJson: rules, sphereLog, startingMaxMana: 1 });
            // maxMana=1 → manaForRegions=0.5 → floor(0.5/1)=0 → clamp to 1
            expect(costs.regions.A.moveCost).toBe(1);
            expect(costs.locations.Loc).toBe(1);
        });
    });

    describe('mana boost from items received', () => {
        it('items received in a sphere bump maxMana for the next iteration', () => {
            const rules = makeRules({
                Menu: {
                    exits: [
                        { name: 'to_a', connected_region: 'A' },
                        { name: 'to_b', connected_region: 'B' },
                    ],
                    locations: [],
                },
                A: { exits: [], locations: [{ name: 'Loc1' }] },
                B: { exits: [], locations: [{ name: 'Loc2' }] },
            }, 'Menu');
            const sphereLog = [
                stateUpdate(0, ['Loc1'], 3), // 3 items received → maxMana += 30
                stateUpdate(1, ['Loc2']),
            ];
            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });

            // Sphere 0: maxMana = 100 → Loc1 cost = 50
            expect(costs.locations.Loc1).toBe(50);
            // Sphere 1: maxMana = 130 → Loc2 cost = 65
            expect(costs.locations.Loc2).toBe(65);
        });

        it('phantom entries (no location, just items) still boost maxMana', () => {
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: { exits: [], locations: [{ name: 'Loc' }] },
            }, 'Menu');
            const sphereLog = [
                stateUpdate(0, [], 5), // phantom: 5 items, no locations
                stateUpdate(1, ['Loc']),
            ];
            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });

            // After phantom: maxMana = 150 → Loc cost = 75
            expect(costs.locations.Loc).toBe(75);
        });
    });

    describe('default fallbacks for uncovered regions/locations', () => {
        it('uncovered regions get the highest neighbor cost', () => {
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: {
                    exits: [
                        { name: 'to_b', connected_region: 'B' },
                        { name: 'to_orphan', connected_region: 'Orphan' },
                    ],
                    locations: [{ name: 'Loc' }],
                },
                B: { exits: [], locations: [] },
                Orphan: { exits: [], locations: [] }, // never visited in sphere log
            }, 'Menu');
            const sphereLog = [stateUpdate(0, ['Loc'])];

            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });
            // Orphan is uncovered. Its only neighbor (A) has moveCost.
            expect(costs.regions.Orphan.moveCost).toBe(costs.regions.A.moveCost);
        });

        it('uncovered regions with no costed neighbors get defaultRegionCost', () => {
            const rules = makeRules({
                Menu: { exits: [], locations: [] },
                Orphan: { exits: [], locations: [] }, // disconnected
            }, 'Menu');
            const sphereLog = [];
            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });
            expect(costs.regions.Orphan.moveCost).toBe(50); // defaultRegionCost
        });

        it('uncovered locations get max of existing location costs', () => {
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: { exits: [], locations: [{ name: 'Visited' }, { name: 'Unvisited' }] },
            }, 'Menu');
            const sphereLog = [stateUpdate(0, ['Visited'])];
            const costs = generateLoopCosts({ rulesJson: rules, sphereLog });
            // Visited cost = 50 (maxMana/2). Unvisited gets the max of existing (50)
            expect(costs.locations.Unvisited).toBe(50);
        });
    });

    describe('regionXpEffect option', () => {
        it("defaults to 'cost' on every region entry and at the sidecar root", () => {
            const rules = makeRules({
                Menu: { exits: [{ name: 'to_a', connected_region: 'A' }], locations: [] },
                A: { exits: [], locations: [{ name: 'Loc' }] },
            }, 'Menu');
            const costs = generateLoopCosts({ rulesJson: rules, sphereLog: [] });
            expect(costs.defaultRegionXpEffect).toBe('cost');
            for (const entry of Object.values(costs.regions)) {
                expect(entry.xpEffect).toBe('cost');
            }
        });

        it('stamps the supplied effect on every region', () => {
            const rules = makeRules({
                Menu: {
                    exits: [
                        { name: 'to_a', connected_region: 'A' },
                        { name: 'to_b', connected_region: 'B' },
                    ],
                    locations: [],
                },
                A: { exits: [], locations: [{ name: 'Loc1' }] },
                B: { exits: [], locations: [] },
            }, 'Menu');
            const sphereLog = [stateUpdate(0, ['Loc1'])];
            const costs = generateLoopCosts({
                rulesJson: rules,
                sphereLog,
                regionXpEffect: 'none',
            });
            expect(costs.defaultRegionXpEffect).toBe('none');
            // Path-assigned region (A) and default-filled region (B)
            // both pick up the effect.
            expect(costs.regions.A.xpEffect).toBe('none');
            expect(costs.regions.B.xpEffect).toBe('none');
            expect(costs.regions.Menu.xpEffect).toBe('none');
        });

        it('falls back to default when given an unknown effect', () => {
            const rules = makeRules({
                Menu: { exits: [], locations: [] },
            }, 'Menu');
            const costs = generateLoopCosts({
                rulesJson: rules,
                sphereLog: [],
                regionXpEffect: 'wibble',
            });
            expect(costs.defaultRegionXpEffect).toBe('cost');
            expect(costs.regions.Menu.xpEffect).toBe('cost');
        });
    });

    describe('error handling', () => {
        it('throws when rulesJson is missing', () => {
            expect(() => generateLoopCosts({ sphereLog: [] })).toThrow();
        });
        it('throws when sphereLog is not an array', () => {
            expect(() => generateLoopCosts({ rulesJson: makeRules({ Menu: {} }, 'Menu'), sphereLog: 'nope' })).toThrow();
        });
        it('throws when no regions exist for the player', () => {
            expect(() => generateLoopCosts({ rulesJson: { regions: {} }, sphereLog: [] })).toThrow();
        });
    });

    describe('helpers', () => {
        it('bfsRegions returns shortest path', () => {
            const adj = new Map([
                ['A', ['B', 'C']],
                ['B', ['D']],
                ['C', ['D']],
                ['D', []],
            ]);
            expect(bfsRegions(adj, 'A', 'A')).toEqual(['A']);
            expect(bfsRegions(adj, 'A', 'D')).toHaveLength(3); // A → B/C → D
            expect(bfsRegions(adj, 'A', 'X')).toBeNull();
        });

        it('buildAdjacency builds connection map from regions', () => {
            const adj = buildAdjacency({
                A: { exits: [{ connected_region: 'B' }, { connected_region: 'C' }] },
                B: { exits: [] },
            });
            expect(adj.get('A')).toEqual(['B', 'C']);
            expect(adj.get('B')).toEqual([]);
        });

        it('buildLocationIndex maps location names to their region', () => {
            const idx = buildLocationIndex({
                A: { locations: [{ name: 'Loc1' }, 'Loc2'] },
                B: { locations: [{ name: 'Loc3' }] },
            });
            expect(idx.get('Loc1')).toBe('A');
            expect(idx.get('Loc2')).toBe('A');
            expect(idx.get('Loc3')).toBe('B');
        });

        it('extractLocationEntries flattens sphere log', () => {
            const log = [
                stateUpdate(0, ['L1', 'L2'], 2),
                stateUpdate(1, [], 1), // phantom
                stateUpdate(2, ['L3']),
            ];
            const entries = extractLocationEntries(log, '1');
            expect(entries).toHaveLength(4);
            expect(entries[0].locationName).toBe('L1');
            expect(entries[0].itemsReceived).toBe(0); // not last in sphere
            expect(entries[1].locationName).toBe('L2');
            expect(entries[1].itemsReceived).toBe(2); // last → credits items
            expect(entries[2].locationName).toBeNull(); // phantom
            expect(entries[2].itemsReceived).toBe(1);
            expect(entries[3].locationName).toBe('L3');
        });
    });
});
