import { describe, it, expect } from 'vitest';

import {
    detectJtaWorld,
    extractDataset,
    datasetIdentity,
    extractApLocations,
    extractGateCounts,
    ruleGateCount,
    computeSeedName,
    cacheKey,
    partitionPatchesByRegion,
} from './hostGlue.js';

// A minimal jta-shaped rules doc: player '1' with two regions, each a jta
// sidecar carrying ap_locations (taskId -> location name) and access rules with
// a HasFromListUnique perk gate. Mirrors the shape the verify script consumes.
function jtaRules() {
    return {
        seed_name: 'AP_9999',
        preset_sidecars: {
            1: {
                region_0_0: {
                    substrate: 'jta',
                    playable_payload: {
                        jtaZone: 0,
                        ap_locations: { 10: 'region_0_0__10', 11: 'region_0_0__11' },
                        task_patches: [{ id: 11, perk: 47 }],
                    },
                },
                region_1_0: {
                    substrate: 'jta',
                    playable_payload: {
                        jtaZone: 1,
                        ap_locations: { 20: 'region_1_0__20' },
                        task_patches: [],
                    },
                },
            },
        },
        regions: {
            1: {
                region_0_0: {
                    locations: [
                        { name: 'region_0_0__10' }, // no access_rule -> free (0)
                        {
                            name: 'region_0_0__11',
                            access_rule: { rule: 'HasFromListUnique', args: { item_names: ['P'], count: 2 } },
                        },
                    ],
                },
                region_1_0: {
                    locations: [
                        {
                            name: 'region_1_0__20',
                            // Nested under a combinator to exercise the tree walk.
                            access_rule: {
                                rule: 'AND',
                                args: {
                                    conditions: [
                                        { rule: 'HasFromListUnique', args: { count: 5 } },
                                        { rule: 'True' },
                                    ],
                                },
                            },
                        },
                    ],
                },
            },
        },
    };
}

describe('detectJtaWorld', () => {
    it('detects a jta world and returns the player id', () => {
        expect(detectJtaWorld(jtaRules())).toEqual({ isJta: true, playerId: '1' });
    });

    it('is dormant for a non-jta world (no preset_sidecars)', () => {
        expect(detectJtaWorld({ regions: {} })).toEqual({ isJta: false, playerId: null });
    });

    it('is dormant when sidecars carry no ap_locations', () => {
        const doc = { preset_sidecars: { 1: { r: { substrate: 'flash', playable_payload: {} } } } };
        expect(detectJtaWorld(doc)).toEqual({ isJta: false, playerId: null });
    });

    it('handles a bare-payload sidecar (no playable_payload wrapper)', () => {
        const doc = { preset_sidecars: { 2: { r: { substrate: 'jta', ap_locations: { 1: 'r__1' } } } } };
        expect(detectJtaWorld(doc)).toEqual({ isJta: true, playerId: '2' });
    });

    it('detects synthetic-dataset worlds too (Pass-B dataset support, 5e)', () => {
        const doc = jtaRules();
        doc.preset_sidecars[1].region_0_0.playable_payload.jta_dataset_ref =
            { dataset_id: 'synthetic-x-s1-z2', schema_version: 1 };
        expect(detectJtaWorld(doc)).toEqual({ isJta: true, playerId: '1' });
    });
});

describe('extractDataset', () => {
    // Single-carrier + refs: region_0_0 carries the full document, both
    // regions carry the ref — the shape the pipeline emits.
    function datasetRules() {
        const doc = jtaRules();
        const ref = { dataset_id: 'synthetic-x-s1-z2', schema_version: 1 };
        const dataset = {
            schema_version: 1,
            dataset_id: 'synthetic-x-s1-z2',
            zones: [{ name: 'Z0', tasks: [{ id: 10, perk: 0 }, { id: 11, perk: null }] },
                { name: 'Z1', tasks: [{ id: 20, perk: 2 }] }],
            perks: [{ name: 'First Light' }, { name: 'Unplaced' }, { name: 'Deep Sight' }],
        };
        doc.preset_sidecars[1].region_0_0.playable_payload.jta_dataset = dataset;
        doc.preset_sidecars[1].region_0_0.playable_payload.jta_dataset_ref = ref;
        doc.preset_sidecars[1].region_1_0.playable_payload.jta_dataset_ref = ref;
        return doc;
    }

    it('resolves the single-carrier document and the ref', () => {
        const { dataset, ref } = extractDataset(datasetRules(), '1');
        expect(dataset?.dataset_id).toBe('synthetic-x-s1-z2');
        expect(ref).toEqual({ dataset_id: 'synthetic-x-s1-z2', schema_version: 1 });
    });

    it('returns null/null for a vanilla world', () => {
        expect(extractDataset(jtaRules(), '1')).toEqual({ dataset: null, ref: null });
    });

    it('surfaces a broken carriage: ref without a carried document', () => {
        const doc = datasetRules();
        delete doc.preset_sidecars[1].region_0_0.playable_payload.jta_dataset;
        const { dataset, ref } = extractDataset(doc, '1');
        expect(dataset).toBe(null);
        expect(ref?.dataset_id).toBe('synthetic-x-s1-z2');
    });

    it('derives the identity constants from the dataset', () => {
        const { dataset } = extractDataset(datasetRules(), '1');
        expect(datasetIdentity(dataset)).toEqual({
            // Placed-perk names only — 'Unplaced' sits on no task.
            perkItemNames: ['First Light', 'Deep Sight'],
            perkCountSentinel: 3,
        });
    });
});

describe('extractApLocations', () => {
    it('inverts+merges every region payload to taskId -> name', () => {
        expect(extractApLocations(jtaRules(), '1')).toEqual({
            10: 'region_0_0__10',
            11: 'region_0_0__11',
            20: 'region_1_0__20',
        });
    });

    it('returns {} for an unknown player', () => {
        expect(extractApLocations(jtaRules(), '99')).toEqual({});
    });
});

describe('ruleGateCount', () => {
    it('reads a direct HasFromListUnique count', () => {
        expect(ruleGateCount({ rule: 'HasFromListUnique', args: { count: 3 } })).toBe(3);
    });
    it('finds the count nested under a combinator', () => {
        expect(ruleGateCount({
            rule: 'AND',
            args: { conditions: [{ rule: 'True' }, { rule: 'HasFromListUnique', args: { count: 7 } }] },
        })).toBe(7);
    });
    it('returns 0 for a missing / non-gate rule', () => {
        expect(ruleGateCount(null)).toBe(0);
        expect(ruleGateCount({ rule: 'True' })).toBe(0);
    });
});

describe('extractGateCounts', () => {
    it('maps each jta task id to its access-rule gate count (plain object)', () => {
        const apLocations = extractApLocations(jtaRules(), '1');
        const gc = extractGateCounts(jtaRules(), '1', apLocations);
        // Plain object, cloneable across the worker boundary; numeric-string keys.
        expect(gc).toEqual({ 10: 0, 11: 2, 20: 5 });
        expect(Object.getPrototypeOf(gc)).toBe(Object.prototype);
    });
});

describe('computeSeedName / cacheKey', () => {
    it('prefers seed_name', () => {
        expect(computeSeedName({ seed_name: 'AP_1', seed: 2 })).toBe('AP_1');
    });
    it('falls back to seed then 1', () => {
        expect(computeSeedName({ seed: 42 })).toBe(42);
        expect(computeSeedName({})).toBe(1);
    });
    it('builds a versioned, seed-keyed cache key', () => {
        expect(cacheKey('AP_9999')).toBe('jtaBalance_patches_v1_AP_9999');
    });
    it('adds a dataset dimension WITHOUT changing vanilla keys', () => {
        // The no-dataset string is load-bearing: existing caches and the
        // jta-balance-solve-at-rules-load test key on it.
        expect(cacheKey('AP_9999', null)).toBe('jtaBalance_patches_v1_AP_9999');
        expect(cacheKey(1, 'synthetic-x-s1-z3'))
            .toBe('jtaBalance_patches_v1_1__ds_synthetic-x-s1-z3');
    });
});

describe('partitionPatchesByRegion', () => {
    it('routes each patch to the region owning its task id, dropping unknowns', () => {
        const patches = [
            { id: 10, cost_multiplier: 1 },
            { id: 11, cost_multiplier: 2 },
            { id: 20, cost_multiplier: 3 },
            { id: 999, cost_multiplier: 9 }, // belongs to no region -> dropped
        ];
        const regionTaskIds = [
            { regionId: 'region_0_0', taskIds: new Set([10, 11]) },
            { regionId: 'region_1_0', taskIds: new Set([20]) },
        ];
        const byRegion = partitionPatchesByRegion(patches, regionTaskIds);
        expect(byRegion.get('region_0_0')).toEqual([
            { id: 10, cost_multiplier: 1 },
            { id: 11, cost_multiplier: 2 },
        ]);
        expect(byRegion.get('region_1_0')).toEqual([{ id: 20, cost_multiplier: 3 }]);
    });

    it('returns empty arrays for regions with no matching patches', () => {
        const byRegion = partitionPatchesByRegion([], [{ regionId: 'r', taskIds: new Set([1]) }]);
        expect(byRegion.get('r')).toEqual([]);
    });
});
