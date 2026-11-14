import { describe, it, expect } from 'vitest';

import {
    SHIPPED_PRESETS, VALID_MODES, PRESET_GROUPS, PRESET_GROUP_ORDER, LS_PRESETS_KEY,
    PRESET_HEADLESS_BUDGET_MS, PRESETS_SKIPPED_AS_HEAVY,
    SEEDLING_SPIRAL_ROOM_STATE, SEEDLING_SPHERE_ROOM_STATE,
    SEEDLING_GENERATED_ROOM_STATE, SEEDLING_GENERATED_LEAF_STATE, SEEDLING_GENERATED_HOST_STATE,
    SEEDLING_GENERATED_SWIM_STATE, SEEDLING_GENERATED_CHESTDOOR_STATE,
    CONCEPT_TRIAL_STATE,
    META_TRIAL_STATE,
    SEEDLING_ATLAS_HOST_STATE,
    SEEDLING_ATLAS_LOCATION_STATE,
    capturePresetState, applyPresetState, droppedSubstratesWarning, getPresetById, restoredActivePresetId, groupShippedPresets,
    TOPDOWN_GRID_KEYS,
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
    cloudberryDifficulty: 2, bouncePhysicsProfile: 'dj',
};
const CURRENT = {
    params: { seed: 42 },
    scenario: { items: { victory: 1 }, obstacles: { door_red: 1 } },
    substrateMix: { maze: 1 },
    substrateQuotas: { maze: 2 },
    substrateMode: 'mix',
    mode: 'gridGrowth',
};
const HAS = (id) => ['maze', 'bounce', 'cloudberry'].includes(id);

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
            .toEqual(['Sphere growth', 'Shuffled spiral', 'Grid growth', 'Top-down', 'Entrance shuffle']);
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

    it('cloudberry library spiral demo takes the served Cloudberry pack ×4 alone, no quota (the embed check\'s spiral)', () => {
        const p = getPresetById('shipped:cloudberry-library-spiral-demo');
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.params.seed).toBe(1);
        expect(p.state.substrateQuotas).toEqual({});
        expect(p.state.libraries.map(({ source, file, count }) => [source, file, count])).toEqual([
            ['served', 'demo-cloudberry-pack.json', 4],
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

    it('seedling generated room demo IS the committed preset\'s state — two generated rooms, two maze rooms', () => {
        const p = getPresetById('shipped:seedling-generated-room-demo');
        // ONE spelling: the drop-down, the committed seedling_generated_room preset and
        // the headless oracle all read this object.
        expect(p.state).toBe(SEEDLING_GENERATED_ROOM_STATE);
        expect(p.group).toBe(PRESET_GROUPS.shuffledSpiral);
        expect(p.state.mode).toBe('shuffledSpiral');
        expect(p.state.substrateQuotas).toEqual({ maze: 2, flash_seedling_gen: 2 });
    });

    it('seedling generated leaf demo IS the committed preset\'s state — a generated room as a sphere leaf', () => {
        const p = getPresetById('shipped:seedling-generated-leaf-demo');
        // ONE spelling: the drop-down, the committed seedling_generated_leaf preset and
        // the headless oracle all read this object.
        expect(p.state).toBe(SEEDLING_GENERATED_LEAF_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateQuotas).toEqual({ maze: 3, flash_seedling_gen: 1 });
    });

    it('seedling generated host demo IS the committed preset\'s state — a generated room hosting a gated child (G4)', () => {
        const p = getPresetById('shipped:seedling-generated-host-demo');
        // ONE spelling: the drop-down, the committed seedling_generated_host preset and
        // the headless oracle all read this object.
        expect(p.state).toBe(SEEDLING_GENERATED_HOST_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.params.startSubstrate).toBe('flash_seedling_gen');
        expect(p.state.substrateQuotas).toEqual({ maze: 2, flash_seedling_gen: 1 });
    });

    it('seedling generated swim demo IS the committed preset\'s state — a generated room gated by water (swim T1)', () => {
        const p = getPresetById('shipped:seedling-generated-swim-demo');
        // ONE spelling: the drop-down, the committed seedling_generated_swim preset and
        // the headless oracle all read this object.
        expect(p.state).toBe(SEEDLING_GENERATED_SWIM_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.params).toMatchObject({ startSubstrate: 'maze', seedlingGenBiome: 'post-swim',
            seedlingGenElements: 'watergate', seedlingGenRequire: 'canSwim' });
        expect(p.state.scenario.items).toEqual({ 'Progressive Swim': 1, victory: 1 });
        expect(p.state.substrateQuotas).toEqual({ maze: 1, flash_seedling_gen: 1 });
    });

    it('seedling generated chestdoor demo IS the committed preset\'s state — the generated room world + chestdoor', () => {
        const p = getPresetById('shipped:seedling-generated-chestdoor-demo');
        // ONE spelling: the drop-down, the committed seedling_generated_chestdoor preset and
        // its in-app rows all read this object.
        expect(p.state).toBe(SEEDLING_GENERATED_CHESTDOOR_STATE);
        expect(p.group).toBe(PRESET_GROUPS.shuffledSpiral);
        // seedling_generated_room's world, its ONE difference the element knob
        const { params, ...rest } = SEEDLING_GENERATED_CHESTDOOR_STATE;
        const { params: baseParams, ...baseRest } = SEEDLING_GENERATED_ROOM_STATE;
        expect(rest).toEqual(baseRest);
        expect(params).toEqual({ ...baseParams, seedlingGenElements: 'chestdoor' });
    });

    it('concept trial demo IS the committed preset\'s state — the first world that names concepts (T4)', () => {
        const p = getPresetById('shipped:concept-trial-demo');
        // ONE spelling: the drop-down, the committed concept_trial preset, its box
        // gate and its in-app row all read this object.
        expect(p.state).toBe(CONCEPT_TRIAL_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.params).toMatchObject({ seed: 8, startSubstrate: 'text_adventure', sphereCount: 3, fillerCount: 0,
            concepts: ['sword', 'guardian', 'swim', 'water'] });
        expect(p.state.scenario.items).toEqual({ 'Progressive Sword': 1, 'Progressive Swim': 1, victory: 1 });
        expect(p.state.substrateQuotas).toEqual({ maze: 2, text_adventure: 2 });
    });

    it('meta trial demo IS the committed preset\'s state — the concept trial plus the theme meta (content sets R3)', () => {
        const p = getPresetById('shipped:meta-trial-demo');
        expect(p.state).toBe(META_TRIAL_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        // the concept trial's world, its ONE difference the content list
        const { params, ...rest } = META_TRIAL_STATE;
        const { params: baseParams, ...baseRest } = CONCEPT_TRIAL_STATE;
        expect(rest).toEqual(baseRest);
        expect(params).toEqual({ ...baseParams, content: ['meta'] });
    });

    it('seedling atlas location demo IS the committed preset\'s state — a REAL room\'s chest as a check (G7)', () => {
        const p = getPresetById('shipped:seedling-atlas-location-demo');
        // ONE spelling: the drop-down, the committed seedling_atlas_location preset
        // and its box gate all read this object.
        expect(p.state).toBe(SEEDLING_ATLAS_LOCATION_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.params.startSubstrate).toBe('flash_seedling');
        expect(p.state.substrateQuotas).toEqual({ maze: 2, flash_seedling: 1 });
    });

    it('seedling atlas host demo IS the committed preset\'s state — a REAL room hosting a gated child (G6)', () => {
        const p = getPresetById('shipped:seedling-atlas-host-demo');
        // ONE spelling: the drop-down, the committed seedling_atlas_host preset and
        // the headless oracle all read this object.
        expect(p.state).toBe(SEEDLING_ATLAS_HOST_STATE);
        expect(p.group).toBe(PRESET_GROUPS.sphereGrowth);
        expect(p.state.mode).toBe('sphereGrowth');
        expect(p.state.substrateQuotas).toEqual({ maze: 3, flash_seedling: 1 });
        expect(p.state.params).not.toHaveProperty('seedlingAtlasHostChildren');
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

    it('the dropped runner presets no longer resolve (zone table: ⚖ 30 s headless ceiling; the rest: runner deleted, P4b)', () => {
        for (const id of ['shipped:runner-zone-demo', 'shipped:runner-sphere-demo',
            'shipped:runner-placement-demo', 'shipped:runner-library-spiral-demo']) {
            expect(getPresetById(id), id).toBeNull();
            expect(SHIPPED_PRESETS.some((p) => p.id === id), id).toBe(false);
        }
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

    // ⛓ F1 (⚖ user 2026-09-30): a top-down save pins only the grid axes the
    // user typed into; the rest follow the source the preset is applied over.
    const TOPDOWN = { ...CURRENT, mode: 'topDown', params: { seed: 3, gridWidth: 12, gridHeight: 12, regionWidth: 8 } };

    it('top-down, no grid axis hand-edited: the capture carries no grid key', () => {
        const snap = capturePresetState(TOPDOWN);
        expect(snap.params).toEqual({ seed: 3, regionWidth: 8 });
        expect(capturePresetState(TOPDOWN, { handEditedGridKeys: [] }).params)
            .toEqual({ seed: 3, regionWidth: 8 });
    });

    it('top-down, one axis hand-edited: the capture carries that key only', () => {
        expect(capturePresetState(TOPDOWN, { handEditedGridKeys: [TOPDOWN_GRID_KEYS.width] }).params)
            .toEqual({ seed: 3, gridWidth: 12, regionWidth: 8 });
        expect(capturePresetState(TOPDOWN, { handEditedGridKeys: [TOPDOWN_GRID_KEYS.height] }).params)
            .toEqual({ seed: 3, gridHeight: 12, regionWidth: 8 });
    });

    it('grid-growth mode: the grid is a real setting, so the capture keeps both keys', () => {
        const gridGrowth = { ...TOPDOWN, mode: 'gridGrowth' };
        expect(capturePresetState(gridGrowth).params).toEqual(TOPDOWN.params);
    });
});

describe('applyPresetState', () => {
    it('merges sparse params over defaults; full-state fields replace', () => {
        const next = applyPresetState({
            mode: 'sphereGrowth',
            params: { seed: 1, startSubstrate: 'cloudberry' },
            scenario: { items: { Victory: 1 } },
            substrateQuotas: { cloudberry: 99 },
            substrateMix: {},
            substrateMode: 'quotas',
        }, { defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT });
        expect(next.params).toEqual({
            ...DEFAULTS, seed: 1, startSubstrate: 'cloudberry',
        });
        // default keys from other substrates survive the merge
        expect(next.params.bouncePhysicsProfile).toBe('dj');
        expect(next.scenario).toEqual({ items: { Victory: 1 }, obstacles: {} });
        expect(next.substrateQuotas).toEqual({ cloudberry: 99 });
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
            substrateQuotas: { cloudberry: 99, ghost: 5, maze: 0 },
            substrateMix: { bounce: 1, ghost: 2, maze: -1 },
        }, { defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT });
        expect(next.substrateQuotas).toEqual({ cloudberry: 99 });
        expect(next.substrateMix).toEqual({ bounce: 1 });
    });

    it('names every unregistered substrate it drops, and an unregistered start falls back to auto (old runner saves)', () => {
        const next = applyPresetState({
            params: { seed: 1, startSubstrate: 'runner' },
            substrateQuotas: { runner: 99, maze: 2 },
            substrateMix: { ghost: 1, bounce: 0 },
        }, { defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT });
        expect(next.params.startSubstrate).toBe('auto');
        expect(next.substrateQuotas).toEqual({ maze: 2 });
        expect(next.droppedSubstrates).toEqual(['ghost', 'runner']);
        expect(droppedSubstratesWarning(next.droppedSubstrates))
            .toMatch(/names substrates this app does not have \('ghost', 'runner': deleted/);
        // a clean state drops nothing, and a registered start is kept
        const clean = applyPresetState({ params: { startSubstrate: 'maze' }, substrateQuotas: { maze: 1 } },
            { defaults: DEFAULTS, hasSubstrate: HAS, current: CURRENT });
        expect(clean.droppedSubstrates).toEqual([]);
        expect(clean.params.startSubstrate).toBe('maze');
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
        // A plain copy: the cloudberry sphere state is deep-frozen, which would
        // make the no-mutation check vacuous.
        const state = structuredClone(getPresetById('shipped:cloudberry-sphere-demo').state);
        const defaults = { ...DEFAULTS };
        const next = applyPresetState(state, {
            defaults, hasSubstrate: HAS, current: CURRENT,
        });
        next.params.seed = 999;
        next.scenario.items.Victory = 999;
        next.substrateQuotas.cloudberry = 0;
        expect(state.params.seed).toBe(1);
        expect(state.scenario.items.Victory).toBe(1);
        expect(state.substrateQuotas.cloudberry).toBe(99);
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
