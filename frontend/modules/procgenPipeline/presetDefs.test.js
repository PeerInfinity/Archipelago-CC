import { describe, it, expect } from 'vitest';

import {
    SHIPPED_PRESETS, VALID_MODES, PRESET_GROUPS, PRESET_GROUP_ORDER, LS_PRESETS_KEY,
    PRESET_HEADLESS_BUDGET_MS, PRESETS_SKIPPED_AS_HEAVY,
    SEEDLING_SPIRAL_ROOM_STATE, SEEDLING_SPHERE_ROOM_STATE,
    capturePresetState, applyPresetState, getPresetById, restoredActivePresetId, groupShippedPresets,
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

    it('PRESET_GROUPS names one drop-down group per pipeline mode', () => {
        expect(Object.keys(PRESET_GROUPS)).toEqual(VALID_MODES);
        expect(new Set(Object.values(PRESET_GROUPS)).size).toBe(VALID_MODES.length);
    });

    it('PRESET_GROUP_ORDER is a permutation of VALID_MODES, in the ruled order (⚖ user 2026-09-16, Q3)', () => {
        expect([...PRESET_GROUP_ORDER].sort()).toEqual([...VALID_MODES].sort());
        expect(PRESET_GROUP_ORDER).toHaveLength(new Set(PRESET_GROUP_ORDER).size);
        expect(PRESET_GROUP_ORDER.map((mode) => PRESET_GROUPS[mode]))
            .toEqual(['Sphere growth', 'Shuffled spiral', 'Grid growth', 'Top-down']);
    });

    it('every shipped preset sits in its own mode\'s group', () => {
        for (const p of SHIPPED_PRESETS) {
            expect(p.group, `${p.id} is a ${p.state.mode} preset`).toBe(PRESET_GROUPS[p.state.mode]);
        }
    });

    it('maze sphere demo pins maze alone over five spheres with fillers and revisits', () => {
        const p = getPresetById('shipped:maze-sphere-demo');
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateQuotas).toEqual({ maze: 99 });
        expect(p.state.params).toMatchObject({
            startSubstrate: 'maze', sphereCount: 5, fillerCount: 2, revisitPercent: 25,
        });
        expect(p.state.scenario.items).toEqual({
            key_red: 1, key_blue: 1, key_green: 1, key_yellow: 1, victory: 1,
        });
    });

    it('text adventure sphere demo pins text_adventure alone, started in one', () => {
        const p = getPresetById('shipped:text-adventure-sphere-demo');
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateQuotas).toEqual({ text_adventure: 99 });
        expect(p.state.params).toMatchObject({
            startSubstrate: 'text_adventure', sphereCount: 4, fillerCount: 1,
        });
    });

    it('maze + text adventure sphere mix pins BOTH procedural substrates by quota', () => {
        const p = getPresetById('shipped:maze-ta-sphere-mix');
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateMode).toBe('quotas');
        expect(p.state.substrateQuotas).toEqual({ maze: 3, text_adventure: 3 });
        expect(p.state.params.startSubstrate).toBe('maze');
    });

    it('maze + bounce sphere mix pins maze + bounce quotas and the bounce items in the pool', () => {
        const p = getPresetById('shipped:maze-bounce-sphere-mix');
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateQuotas).toEqual({ maze: 3, bounce: 3 });
        expect(p.state.scenario.items).toEqual({
            key_red: 1, key_blue: 1, 'Right arrow': 1, Springs: 1, 'Blue platforms': 1, Victory: 1,
        });
    });

    it('maze hazards + loop demo pins hazards AND loop mode on a maze-only world', () => {
        const p = getPresetById('shipped:maze-hazards-loop-demo');
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateQuotas).toEqual({ maze: 99 });
        expect(p.state.params).toMatchObject({
            enableHazards: true, hazardCount: 3, enableLoopMode: true, regionXpEffect: 'cost',
        });
    });

    it('hazards ride only a maze-only preset (⚖ user 2026-09-16, Q5: "hazards are only relevant to the maze substrate")', () => {
        for (const p of SHIPPED_PRESETS.filter((q) => q.state.params?.enableHazards)) {
            const named = Object.keys({ ...p.state.substrateQuotas, ...p.state.substrateMix });
            expect(named, `${p.id} turns hazards on`).toEqual(['maze']);
        }
    });

    it('grid growth demo pins the MIX form: maze 1 : text_adventure 1 on a 3×3 grid, keys and doors', () => {
        const p = getPresetById('shipped:grid-growth-demo');
        expect(p.state.mode).toBe('gridGrowth');
        expect(p.state.substrateMode).toBe('mix');
        expect(p.state.substrateMix).toEqual({ maze: 1, text_adventure: 1 });
        expect(p.state.params).toMatchObject({ gridWidth: 3, gridHeight: 3 });
        expect(p.state.scenario.obstacles).toEqual({ door_red: 1, door_blue: 1 });
    });

    it('content spiral mix pins maze 2 + jta 3 + bounce 2 by quota, started in a maze', () => {
        const p = getPresetById('shipped:content-spiral-mix');
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.substrateQuotas).toEqual({ maze: 2, jta: 3, bounce: 2 });
        expect(p.state.params.startSubstrate).toBe('maze');
    });

    it('omsi loop demo pins loop mode on a jta + omsi spiral', () => {
        const p = getPresetById('shipped:omsi-loop-demo');
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.substrateQuotas).toEqual({ jta: 2, omsi: 1 });
        expect(p.state.params).toMatchObject({ startSubstrate: 'jta', enableLoopMode: true });
    });

    it('library spiral demo takes served maze + bounce packs as its only content source', () => {
        const p = getPresetById('shipped:library-spiral-demo');
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.substrateQuotas).toEqual({});
        expect(p.state.libraries.map(({ source, file, count }) => [source, file, count])).toEqual([
            ['served', 'demo-maze-pack.json', 3],
            ['served', 'demo-bounce-pack.json', 2],
        ]);
    });

    it('runner library spiral demo takes the served runner pack beside the maze pack, no runner quota', () => {
        const p = getPresetById('shipped:runner-library-spiral-demo');
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.substrateQuotas).toEqual({});
        expect(p.state.libraries.map(({ source, file, count }) => [source, file, count])).toEqual([
            ['served', 'demo-maze-pack.json', 2],
            ['served', 'demo-runner-pack.json', 2],
        ]);
    });

    it('seedling spiral room demo IS the committed preset\'s state — one Seedling room, three maze rooms', () => {
        const p = getPresetById('shipped:seedling-spiral-room-demo');
        // ONE spelling: the drop-down, the committed seedling_spiral_room preset and
        // the headless oracle all read this object.
        expect(p.state).toBe(SEEDLING_SPIRAL_ROOM_STATE);
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.substrateQuotas).toEqual({ maze: 3, flash_seedling: 1 });
    });

    it('seedling sphere room demo IS the committed preset\'s state — a Seedling room as a sphere leaf', () => {
        const p = getPresetById('shipped:seedling-sphere-room-demo');
        // ONE spelling: the drop-down, the committed seedling_sphere_room preset and
        // the headless oracle all read this object.
        expect(p.state).toBe(SEEDLING_SPHERE_ROOM_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateQuotas).toEqual({ maze: 3, flash_seedling: 1 });
    });

    it('top-down maze + text adventure demo pins the mix maze 2 : text_adventure 1', () => {
        const p = getPresetById('shipped:topdown-maze-ta-demo');
        expect(p.state.mode).toBe('topDown');
        expect(p.state.substrateMix).toEqual({ maze: 2, text_adventure: 1 });
    });

    it('top-down zones demo pins the mix maze 1 : bounce 1', () => {
        const p = getPresetById('shipped:topdown-zones-demo');
        expect(p.state.mode).toBe('topDown');
        expect(p.state.substrateMix).toEqual({ maze: 1, bounce: 1 });
    });

    it('a top-down preset carries a non-empty mix, in mix mode, and says its source is the loaded world', () => {
        // Top-down reads the MIX only: measured (P2 mutant B) — an empty mix, or
        // quotas in its place, realises an all-maze world with no error.
        const topDown = SHIPPED_PRESETS.filter((q) => q.state.mode === 'topDown');
        expect(topDown.length).toBeGreaterThan(0);
        for (const p of topDown) {
            expect(p.state.substrateMode, p.id).toBe('mix');
            expect(Object.values(p.state.substrateMix).filter((w) => w > 0).length, p.id).toBeGreaterThan(0);
            expect(p.state.substrateQuotas, p.id).toEqual({});
            expect(p.label, p.id).toContain('from the loaded world');
            expect(p.description, p.id).toContain('LOADED world');
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

    it('the dropped runner zone-table demo no longer resolves (⚖ 30 s headless ceiling)', () => {
        expect(getPresetById('shipped:runner-zone-demo')).toBeNull();
        expect(SHIPPED_PRESETS.some((p) => p.id === 'shipped:runner-zone-demo')).toBe(false);
    });
});

describe('groupShippedPresets (the drop-down\'s optgroups)', () => {
    const preset = (id, mode) => ({ id, group: PRESET_GROUPS[mode], state: { mode } });

    it('orders the groups by PRESET_GROUP_ORDER, not by where their first preset sits in the list', () => {
        const list = [
            preset('shipped:t', 'topDown'),
            preset('shipped:s1', 'sphereGrowth'),
            preset('shipped:g', 'gridGrowth'),
            preset('shipped:p', 'shuffledSpiral'),
            preset('shipped:s2', 'sphereGrowth'),
        ];
        expect(groupShippedPresets(list).map(([label, members]) => [label, members.map((p) => p.id)])).toEqual([
            [PRESET_GROUPS.sphereGrowth, ['shipped:s1', 'shipped:s2']],
            [PRESET_GROUPS.shuffledSpiral, ['shipped:p']],
            [PRESET_GROUPS.gridGrowth, ['shipped:g']],
            [PRESET_GROUPS.topDown, ['shipped:t']],
        ]);
    });

    it('omits a group no preset is in', () => {
        const list = [preset('shipped:p', 'shuffledSpiral'), preset('shipped:s', 'sphereGrowth')];
        expect(groupShippedPresets(list).map(([label]) => label))
            .toEqual([PRESET_GROUPS.sphereGrowth, PRESET_GROUPS.shuffledSpiral]);
    });

    it('places every shipped preset in exactly one group', () => {
        const grouped = groupShippedPresets([...SHIPPED_PRESETS]).flatMap(([, members]) => members.map((p) => p.id));
        expect([...grouped].sort()).toEqual(SHIPPED_PRESETS.map((p) => p.id).sort());
    });
});

describe('the headless budget and the heavy allowlist', () => {
    it('the budget is the ruled 30 s (⚖ user 2026-09-16, "Yes, let\'s set the limit to 30s headless.")', () => {
        expect(PRESET_HEADLESS_BUDGET_MS).toBe(30_000);
    });

    it('every id on the heavy allowlist is a shipped preset', () => {
        for (const id of PRESETS_SKIPPED_AS_HEAVY) expect(getPresetById(id)).not.toBeNull();
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

    it('carries a non-empty region-library selection; omits an empty one', () => {
        const libraries = [{ source: 'served', file: 'p.json', library_id: 'p-abc', count: 3 }];
        const withLibs = capturePresetState({ ...CURRENT, libraries });
        expect(withLibs.libraries).toEqual(libraries);
        withLibs.libraries[0].count = 9; // deep-copied
        expect(libraries[0].count).toBe(3);
        expect(capturePresetState({ ...CURRENT, libraries: [] })).not.toHaveProperty('libraries');
        expect(capturePresetState(CURRENT)).not.toHaveProperty('libraries');
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

    it('passes a region-library selection through unfiltered; defaults to current when absent', () => {
        const libraries = [
            { source: 'served', file: 'p.json', library_id: 'p-abc', count: 3 },
            { source: 'adhoc', doc: { library_id: 'q' }, count: 2 },
        ];
        const withLibs = applyPresetState({ libraries }, {
            defaults: DEFAULTS, hasSubstrate: HAS, current: { ...CURRENT, libraries: [] },
        });
        // No hasSubstrate filter — library:* ids have no registry entry.
        expect(withLibs.libraries).toEqual(libraries);
        // Absent selection keeps the current one.
        const kept = applyPresetState({}, {
            defaults: DEFAULTS, hasSubstrate: HAS, current: { ...CURRENT, libraries },
        });
        expect(kept.libraries).toEqual(libraries);
        // Present-but-empty clears.
        const cleared = applyPresetState({ libraries: [] }, {
            defaults: DEFAULTS, hasSubstrate: HAS, current: { ...CURRENT, libraries },
        });
        expect(cleared.libraries).toEqual([]);
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

describe('restoredActivePresetId (the session restore\'s drop-down selection)', () => {
    it('keeps an id that still resolves, shipped or user', () => {
        expect(restoredActivePresetId('shipped:bounce-sphere-demo')).toBe('shipped:bounce-sphere-demo');
        const users = [{ id: 'user:mine', label: 'mine', state: {} }];
        expect(restoredActivePresetId('user:mine', users)).toBe('user:mine');
    });

    it('falls back to Custom (null) for a dropped shipped preset, a deleted user preset, or none', () => {
        expect(restoredActivePresetId('shipped:runner-zone-demo')).toBeNull();
        expect(restoredActivePresetId('user:gone', [])).toBeNull();
        expect(restoredActivePresetId(null)).toBeNull();
        expect(restoredActivePresetId(undefined)).toBeNull();
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
