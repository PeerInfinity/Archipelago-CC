import { describe, it, expect } from 'vitest';

import { WorldWarehouse, buildWarehouse, findStartRegion } from './procgenPlayerEngine.js';

// Minimal substrate registry mock — just the get() shape buildWarehouse
// uses. Tests construct it explicitly so we don't depend on real
// substrate modules being loaded.
function makeRegistry(entries) {
    const map = new Map();
    for (const e of entries) map.set(e.id, e);
    return {
        get: (id) => map.get(id),
        has: (id) => map.has(id),
        getAll: () => [...map.values()],
    };
}

const MAZE_ENTRY = {
    id: 'maze',
    loadRegionEvent: 'maze:loadRegion',
    deserializeWorld: (sidecar) => ({ kind: 'maze-world', from: sidecar }),
};

function makeRulesJson(overrides = {}) {
    return {
        start_regions: { 1: ['Menu'] },
        regions: {
            1: {
                Menu: {
                    name: 'Menu',
                    exits: [{ name: 'GameStart', connected_region: 'region_0_0' }],
                    locations: [],
                },
                region_0_0: { name: 'region_0_0', exits: [], locations: [] },
            },
        },
        preset_sidecars: {
            1: {
                region_0_0: { substrate: 'maze', playable_payload: { width: 4, height: 3 } },
            },
        },
        ...overrides,
    };
}

describe('buildWarehouse', () => {
    it('returns null when the rules.json has no preset_sidecars for the player', () => {
        const registry = makeRegistry([MAZE_ENTRY]);
        expect(buildWarehouse({ start_regions: { 1: ['Menu'] } }, '1', registry)).toBeNull();
    });

    it('returns null when preset_sidecars exists but the player has no entry', () => {
        const registry = makeRegistry([MAZE_ENTRY]);
        const rules = { preset_sidecars: { 2: {} } };
        expect(buildWarehouse(rules, '1', registry)).toBeNull();
    });

    it('builds a warehouse with one entry per sidecar region', () => {
        const registry = makeRegistry([MAZE_ENTRY]);
        const wh = buildWarehouse(makeRulesJson(), '1', registry);
        expect(wh).toBeInstanceOf(WorldWarehouse);
        expect(wh.size()).toBe(1);
        const entry = wh.get('region_0_0');
        expect(entry.substrate).toBe('maze');
        expect(entry.loadRegionEvent).toBe('maze:loadRegion');
        // deserializeWorld result is preserved as-is
        expect(entry.world).toEqual({ kind: 'maze-world', from: { width: 4, height: 3 } });
    });

    it('skips (with a warning) regions whose substrate is not in the registry', () => {
        const registry = makeRegistry([]); // empty — maze missing
        const warnings = [];
        const fakeLogger = { warn: (msg) => warnings.push(msg) };
        const wh = buildWarehouse(makeRulesJson(), '1', registry, { logger: fakeLogger });
        expect(wh.size()).toBe(0);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toMatch(/unknown substrate 'maze'/);
    });

    it('skips substrates whose entry lacks deserializeWorld', () => {
        const registry = makeRegistry([{ id: 'maze', loadRegionEvent: 'maze:loadRegion' }]);
        const warnings = [];
        const fakeLogger = { warn: (msg) => warnings.push(msg) };
        const wh = buildWarehouse(makeRulesJson(), '1', registry, { logger: fakeLogger });
        expect(wh.size()).toBe(0);
        expect(warnings[0]).toMatch(/no deserializeWorld/);
    });
});

describe('findStartRegion', () => {
    function withWarehouse(rules, regionsInWarehouse) {
        const wh = new WorldWarehouse();
        for (const id of regionsInWarehouse) {
            wh.regions.set(id, { substrate: 'maze' });
        }
        return findStartRegion(rules, '1', wh);
    }

    it('returns a direct transition when the start region has a sidecar', () => {
        const rules = {
            start_regions: { 1: ['region_0_0'] },
            regions: { 1: { region_0_0: { exits: [] } } },
        };
        expect(withWarehouse(rules, ['region_0_0'])).toEqual({
            region: 'region_0_0', sourceRegion: null, exitName: null,
        });
    });

    it('handles the AP {default: [...]} shape for start_regions', () => {
        const rules = {
            start_regions: { 1: { default: ['region_0_0'] } },
            regions: { 1: { region_0_0: { exits: [] } } },
        };
        expect(withWarehouse(rules, ['region_0_0']).region).toBe('region_0_0');
    });

    it('walks Menu through its first exit, reporting Menu as sourceRegion', () => {
        const rules = makeRulesJson();
        expect(withWarehouse(rules, ['region_0_0'])).toEqual({
            region: 'region_0_0', sourceRegion: 'Menu', exitName: 'GameStart',
        });
    });

    it('returns null when no warehoused region is reachable', () => {
        const rules = makeRulesJson();
        expect(withWarehouse(rules, [])).toBeNull();
    });

    it('returns null when start_regions is missing entirely', () => {
        const rules = { regions: { 1: {} } };
        expect(withWarehouse(rules, [])).toBeNull();
    });

    it('skips Menu exits whose target is not in the warehouse and tries the next', () => {
        const rules = {
            start_regions: { 1: ['Menu'] },
            regions: {
                1: {
                    Menu: {
                        exits: [
                            { name: 'unbuilt', connected_region: 'region_does_not_exist' },
                            { name: 'GameStart', connected_region: 'region_real' },
                        ],
                    },
                },
            },
        };
        expect(withWarehouse(rules, ['region_real'])).toEqual({
            region: 'region_real', sourceRegion: 'Menu', exitName: 'GameStart',
        });
    });
});
