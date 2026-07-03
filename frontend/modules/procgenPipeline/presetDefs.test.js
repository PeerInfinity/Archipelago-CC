import { describe, it, expect } from 'vitest';

import {
    SHIPPED_PRESETS, VALID_MODES, LS_PRESETS_KEY,
    capturePresetState, applyPresetState, getPresetById,
    userPresetId, loadUserPresets, saveUserPreset, deleteUserPreset,
} from './presetDefs.js';

// localStorage stand-in for the user-preset store helpers.
function makeStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
    };
}

const DEFAULTS = {
    seed: 7, sphereCount: 3, startSubstrate: 'auto',
    runnerPhysicsProfile: 'celeste', bouncePhysicsProfile: 'dj',
};
const CURRENT = {
    params: { seed: 42 },
    scenario: { items: { victory: 1 }, obstacles: { door_red: 1 } },
    substrateMix: { maze: 1 },
    substrateQuotas: { maze: 2 },
    substrateMode: 'mix',
    mode: 'gridGrowth',
};
const HAS = (id) => ['maze', 'bounce', 'runner'].includes(id);

describe('SHIPPED_PRESETS', () => {
    it('every shipped preset has a resolvable shape and a valid mode', () => {
        expect(SHIPPED_PRESETS.length).toBeGreaterThan(0);
        for (const p of SHIPPED_PRESETS) {
            expect(p.id).toMatch(/^shipped:/);
            expect(typeof p.label).toBe('string');
            expect(VALID_MODES).toContain(p.state.mode);
            expect(p.state.scenario.items).toBeTruthy();
            // ids must be unique
            expect(SHIPPED_PRESETS.filter((q) => q.id === p.id)).toHaveLength(1);
        }
    });

    it('runner sphere demo pins the runner_sphere_worldgen config + Springs', () => {
        const p = getPresetById('shipped:runner-sphere-demo');
        expect(p.state.params.seed).toBe(1);
        expect(p.state.params.sphereCount).toBe(3);
        expect(p.state.params.startSubstrate).toBe('runner');
        expect(p.state.params.runnerPhysicsProfile).toBe('celeste');
        expect(p.state.substrateQuotas).toEqual({ runner: 99 });
        expect(p.state.scenario.items).toEqual({
            'Double Jump': 1, 'Blue Platforms': 1, Springs: 1, Victory: 1,
        });
    });

    it('runner placement demo pins the sphere config with the placement knobs on', () => {
        const p = getPresetById('shipped:runner-placement-demo');
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.params.runnerJitter).toBe(0.75);
        expect(p.state.params.runnerSplitChance).toBe(0.6);
        expect(p.state.params.startSubstrate).toBe('runner');
        expect(p.state.scenario.items).toEqual({
            'Double Jump': 1, 'Blue Platforms': 1, Springs: 1, Victory: 1,
        });
    });

    it('runner zone demo pins the runner_worldgen shuffled-spiral config', () => {
        const p = getPresetById('shipped:runner-zone-demo');
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.params.seed).toBe(1);
        expect(p.state.params.startSubstrate).toBe('runner');
        expect(p.state.substrateQuotas).toEqual({ runner: 5 });
        // the zone table mints its own items — the scenario pool is empty
        expect(p.state.scenario.items).toEqual({});
        // and no spec-path difficulty knobs are pinned (spiral serves the
        // library's fixed default zone table)
        expect(Object.keys(p.state.params).some((k) => k.startsWith('runner'))).toBe(false);
    });
});

describe('capturePresetState', () => {
    it('snapshots exactly the persisted bundle keys, deep-copied', () => {
        const panelLike = { ...CURRENT, unrelatedField: 'not captured' };
        const snap = capturePresetState(panelLike);
        expect(Object.keys(snap).sort()).toEqual([
            'mode', 'params', 'scenario', 'substrateMix',
            'substrateMode', 'substrateQuotas',
        ]);
        expect(snap.scenario).toEqual(CURRENT.scenario);
        snap.scenario.items.victory = 99;
        snap.params.seed = 0;
        expect(CURRENT.scenario.items.victory).toBe(1);
        expect(CURRENT.params.seed).toBe(42);
    });
});

describe('applyPresetState', () => {
    it('merges sparse params over defaults; full-state fields replace', () => {
        const next = applyPresetState({
            mode: 'sphereGrowth',
            params: { seed: 1, startSubstrate: 'runner' },
            scenario: { items: { Victory: 1 } },
            substrateQuotas: { runner: 99 },
            substrateMix: {},
            substrateMode: 'quotas',
        }, { defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT });
        expect(next.params).toEqual({
            ...DEFAULTS, seed: 1, startSubstrate: 'runner',
        });
        // default keys from other substrates survive the merge
        expect(next.params.bouncePhysicsProfile).toBe('dj');
        expect(next.scenario).toEqual({ items: { Victory: 1 }, obstacles: {} });
        expect(next.substrateQuotas).toEqual({ runner: 99 });
        expect(next.substrateMix).toEqual({});
        expect(next.substrateMode).toBe('quotas');
        expect(next.mode).toBe('sphereGrowth');
    });

    it('keeps current values for absent params/scenario and invalid mode fields', () => {
        const next = applyPresetState({}, {
            defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT,
        });
        expect(next.params).toBe(CURRENT.params);
        expect(next.scenario).toBe(CURRENT.scenario);
        expect(next.substrateMode).toBe('mix');
        expect(next.mode).toBe('gridGrowth');
        // quota/mix dicts are always rebuilt — absent means empty
        expect(next.substrateQuotas).toEqual({});
        expect(next.substrateMix).toEqual({});

        const bad = applyPresetState({ mode: 'nope', substrateMode: 'nope' }, {
            defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT,
        });
        expect(bad.mode).toBe('gridGrowth');
        expect(bad.substrateMode).toBe('mix');
    });

    it('filters unregistered substrates and non-positive counts from quota/mix dicts', () => {
        const next = applyPresetState({
            substrateQuotas: { runner: 99, ghost: 5, maze: 0 },
            substrateMix: { bounce: 1, ghost: 2, maze: -1 },
        }, { defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT });
        expect(next.substrateQuotas).toEqual({ runner: 99 });
        expect(next.substrateMix).toEqual({ bounce: 1 });
    });

    it('does not mutate the preset state or defaults', () => {
        const state = getPresetById('shipped:runner-sphere-demo').state;
        const defaults = { ...DEFAULTS };
        const next = applyPresetState(state, {
            defaults, hasSubstrate: HAS, current: CURRENT,
        });
        next.params.seed = 999;
        next.scenario.items.Victory = 999;
        next.substrateQuotas.runner = 0;
        expect(state.params.seed).toBe(1);
        expect(state.scenario.items.Victory).toBe(1);
        expect(state.substrateQuotas.runner).toBe(99);
        expect(defaults).toEqual(DEFAULTS);
    });
});

describe('user preset store', () => {
    it('round-trips save → load → delete; same name overwrites', () => {
        const storage = makeStorage();
        expect(loadUserPresets(storage)).toEqual([]);

        const state = capturePresetState(CURRENT);
        const saved = saveUserPreset(storage, '  My Setup!  ', state);
        expect(saved.id).toBe('user:my-setup');
        expect(userPresetId('My Setup!')).toBe(saved.id);
        expect(loadUserPresets(storage)).toEqual([
            { id: 'user:my-setup', label: 'My Setup!', state },
        ]);

        // resolvable through getPresetById alongside shipped presets
        const found = getPresetById('user:my-setup', saved.presets);
        expect(found.label).toBe('My Setup!');

        const state2 = { ...state, mode: 'sphereGrowth' };
        const saved2 = saveUserPreset(storage, 'My Setup!', state2);
        expect(saved2.presets).toHaveLength(1);
        expect(loadUserPresets(storage)[0].state.mode).toBe('sphereGrowth');

        const after = deleteUserPreset(storage, 'user:my-setup');
        expect(after).toEqual([]);
        expect(loadUserPresets(storage)).toEqual([]);
    });

    it('rejects blank names and survives malformed stored JSON', () => {
        const storage = makeStorage();
        expect(saveUserPreset(storage, '   ', {})).toBeNull();
        expect(saveUserPreset(storage, '!!!', {})).toBeNull();

        const junk = makeStorage({ [LS_PRESETS_KEY]: '{not json' });
        expect(loadUserPresets(junk)).toEqual([]);
        const wrongShape = makeStorage({
            [LS_PRESETS_KEY]: JSON.stringify({ presets: [{ id: 1 }, null,
                { id: 'user:ok', label: 'ok', state: {} }] }),
        });
        expect(loadUserPresets(wrongShape)).toEqual([
            { id: 'user:ok', label: 'ok', state: {} },
        ]);
    });
});
