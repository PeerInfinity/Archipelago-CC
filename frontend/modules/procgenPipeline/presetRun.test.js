/**
 * presetRun — a preset bundle → the run each mode's runner consumes.
 *
 * ⛓ PROCGEN PIPELINE PRESETS P0. The panel's four config builders moved into
 * `presetRun.js`; the panel's methods are one-line callers over `this`. These
 * rows hold each builder to a HAND-WRITTEN expected object for one small state
 * (so a builder that silently drops an input goes red — the plan's mutants A
 * and B: the sphere builder dropping `hazardOpts`, the spiral builder dropping a
 * library quota), and hold the sparse-params merge to `applyPresetState`'s.
 *
 * The registry is populated from `REGISTRY_LIBRARIES` (derived, never a literal
 * list) — the panel registers all eight, and a run assembled against a partial
 * registry would drop quota entries the panel keeps.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    buildRunFromState, runPresetHeadless, panelDefaultParams, DEFAULT_PARAMS,
    effectiveHazardOpts, activeSubstrateDict,
    GENERATION_COST, substrateGenerationCost, presetSubstrateIds, heavySubstrateIds,
} from './presetRun.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

/** A resolved library whose only entry names no sphere-capable substrate. */
const LIB = Object.freeze({ library: { library_id: 'probe-lib', entries: [] }, count: 2 });

describe('buildRunFromState — shuffled spiral', () => {
    const bundle = {
        mode: 'shuffledSpiral',
        params: { seed: 3, startSubstrate: 'maze' },
        scenario: { items: { victory: 1, key_red: 1 }, obstacles: { door_red: 1 } },
        substrateQuotas: { maze: 2 },
        substrateMix: {},
        substrateMode: 'quotas',
    };

    it('builds the newSpiralEnvelope input: sparse params over the panel defaults, libraries merged as quotas', () => {
        const { mode, run } = buildRunFromState(bundle, { resolvedLibraries: [LIB] });
        expect(mode).toBe('shuffledSpiral');
        expect(run).toEqual({
            config: {
                regionSize: { width: 8, height: 6 },
                itemPool: { victory: 1, key_red: 1 },
                obstaclePool: { door_red: 1 },
                seed: 3,
                regionParams: {},
                growthParams: {
                    substrateQuotas: { maze: 2, 'library:probe-lib': 2 },
                    maxItemsPerRegion: 2,
                    startSubstrate: 'maze',
                    substrateConfig: { 'library:probe-lib': { libraryDoc: LIB.library } },
                },
                hazardOpts: null,
            },
            compileIn: {
                seed: 3,
                enableLoopMode: false,
                regionXpEffect: 'cost',
                completionConditionItem: 'victory',
            },
        });
    });

    it('refuses a spiral with no quota and no library, in words', () => {
        expect(() => buildRunFromState({ ...bundle, substrateQuotas: {} }))
            .toThrow(/shuffled-spiral requires at least one substrate with a positive quota/);
    });
});

describe('buildRunFromState — sphere growth', () => {
    const bundle = {
        mode: 'sphereGrowth',
        params: {
            seed: 2, sphereCount: 2, enableHazards: true, hazardCount: 2, startSubstrate: 'maze',
        },
        scenario: { items: { victory: 1, key_red: 1 }, obstacles: {} },
        substrateQuotas: { maze: 99 },
        substrateMix: {},
        substrateMode: 'quotas',
    };

    it('builds the runner config ① consumes, hazards included', () => {
        const { mode, run } = buildRunFromState(bundle);
        expect(mode).toBe('sphereGrowth');
        expect(run.prep).toEqual({
            startingItems: [], lockedCanonicalItems: [], exclusiveSpheres: {},
            regionParams: {}, note: '',
        });
        const { itemLib, ...config } = run.config;
        expect(itemLib.victory?.is_victory).toBe(true);
        expect(config).toEqual({
            seed: 2,
            regionSize: { width: 8, height: 6 },
            regionParams: {},
            hazardOpts: {
                enabled: true, count: 2, maxConsecutiveFails: 10, wallOverlapAllowed: false,
            },
            maxItemsPerRegion: 2,
            fillerCount: 0,
            revisitRatio: 0.25,
            substrateQuotas: { maze: 99 },
            startSubstrate: 'maze',
            sphereCount: 2,
            spheresPerBatch: null,
            victoryItem: 'victory',
            exclusiveSpheres: {},
            startingItems: [],
            lockedCanonicalItems: [],
            enableLoopMode: false,
            regionXpEffect: 'cost',
            itemPool: { victory: 1, key_red: 1 },
        });
        expect(run.cfg.activeIds).toEqual(['maze']);
    });

    it('a library with no sphere-capable entry contributes nothing to a sphere world', () => {
        const { run } = buildRunFromState(bundle, { resolvedLibraries: [LIB] });
        expect(run.config.substrateQuotas).toEqual({ maze: 99 });
        expect(run.config).not.toHaveProperty('substrateConfig');
    });
});

describe('buildRunFromState — a selected library\'s substrates contribute the regionParams their entries read', () => {
    // ⛓ C1. The maze library's connection flags used to ride regionParams behind a
    // helper that asked `e.substrate === 'maze'`; the maze entry now declares them
    // (`defaultProcgenParams` + `buildLibraryRegionParams`), consulted for the
    // substrates the selected sphere libraries realise — NOT the quotas, which in
    // this bundle name none.
    const MAZE_LIB = Object.freeze({
        library: { library_id: 'probe-maze-lib', entries: [{ entry_id: 'm1', substrate: 'maze' }] }, count: 1,
    });
    const bundle = {
        mode: 'sphereGrowth',
        params: { seed: 1, sphereCount: 2, mazeRequireTileAlign: true },
        scenario: { items: { key_red: 1, key_blue: 1 }, obstacles: {} },
        substrateQuotas: {},
        substrateMix: {},
        substrateMode: 'quotas',
    };

    it('a selected maze library puts both flags in the assembled regionParams, with no maze quota', () => {
        const { run } = buildRunFromState(bundle, { resolvedLibraries: [MAZE_LIB] });
        expect(run.cfg.activeIds).toEqual(['library:probe-maze-lib']);
        expect(run.config.regionParams).toEqual({ mazeRequireSameWall: false, mazeRequireTileAlign: true });
    });

    it('no library, or one with no sphere-capable entry, adds no regionParams key', () => {
        expect(buildRunFromState(bundle).run.config.regionParams).toEqual({});
        expect(buildRunFromState(bundle, { resolvedLibraries: [LIB] }).run.config.regionParams).toEqual({});
    });

    it('the flag reaches the served maze pack\'s instantiate: mazeRequireTileAlign refuses generation in its words', async () => {
        const pack = JSON.parse(readFileSync(join(ROOT, 'frontend/region-libraries/demo-maze-pack.json'), 'utf8'));
        const built = buildRunFromState(bundle, { resolvedLibraries: [{ library: pack, count: 3 }] });
        await expect(runPresetHeadless(built)).rejects
            .toThrow(/a captured tile region cannot satisfy mazeRequireTileAlign/);
    });
});

describe('buildRunFromState — top-down', () => {
    const SOURCE = Object.freeze({ game_name: 'Probe', regions: { 1: {} } });
    const bundle = {
        mode: 'topDown',
        params: { seed: 4 },
        scenario: { items: {}, obstacles: {} },
        substrateQuotas: {},
        substrateMix: { maze: 2, text_adventure: 1 },
        substrateMode: 'mix',
    };

    it('builds the buildTopDownEnvelope input from the mix and the given source', () => {
        const { mode, run } = buildRunFromState(bundle, { topDownSource: SOURCE });
        expect(mode).toBe('topDown');
        expect(run).toEqual({
            source: SOURCE,
            seed: 4,
            gridDims: { width: 3, height: 3 },
            regionSizeBase: { width: 8, height: 6 },
            substrateMix: { maze: 2, text_adventure: 1 },
            regionParams: {},
            hazardOpts: null,
            sphereLog: null,
            enableLoopMode: false,
            regionXpEffect: 'cost',
        });
    });

    it('refuses a top-down run with no source, in words', () => {
        expect(() => buildRunFromState(bundle))
            .toThrow('top-down needs a source rules.json to realise, and none was given');
    });
});

describe('buildRunFromState — grid growth', () => {
    it('builds the growMazeAsync config and the compile inputs, honouring substrateMode', () => {
        const bundle = {
            mode: 'gridGrowth',
            params: { seed: 5, gridWidth: 2, maxRegions: 4 },
            scenario: { items: { key_blue: 1 }, obstacles: { door_blue: 1 } },
            substrateQuotas: { maze: 3 },
            substrateMix: { text_adventure: 1 },
            substrateMode: 'mix',
        };
        const { mode, run } = buildRunFromState(bundle);
        expect(mode).toBe('gridGrowth');
        expect(run).toEqual({
            grow: {
                gridDims: { width: 2, height: 3 },
                regionSize: { width: 8, height: 6 },
                itemPool: { key_blue: 1 },
                obstaclePool: { door_blue: 1 },
                seed: 5,
                regionParams: {},
                growthParams: {
                    maxItemsPerRegion: 2,
                    maxRegions: 4,
                    stopOnPoolEmpty: false,
                    asymmetricExits: 'add',
                    substrateMix: { text_adventure: 1 },
                },
                hazardOpts: null,
            },
            compile: {
                seed: 5,
                enableLoopMode: false,
                regionXpEffect: 'cost',
                completionConditionItem: null,
            },
        });
        const quotas = buildRunFromState({ ...bundle, substrateMode: 'quotas' }).run;
        expect(quotas.grow.growthParams.substrateQuotas).toEqual({ maze: 3 });
        expect(quotas.grow.growthParams).not.toHaveProperty('substrateMix');
    });
});

describe('the normalisation and the shared helpers', () => {
    it('merges a sparse bundle over the panel defaults (DEFAULT_PARAMS ∪ every substrate default)', () => {
        const defaults = panelDefaultParams();
        for (const [k, v] of Object.entries(DEFAULT_PARAMS)) expect(defaults[k]).toEqual(v);
        expect(Object.keys(defaults).length).toBeGreaterThan(Object.keys(DEFAULT_PARAMS).length);
        // The maze's hazard params and its library's connection flags come from
        // the maze entry's own declaration now (C1), not from DEFAULT_PARAMS.
        const mazeDeclared = substrateRegistry.get('maze').defaultProcgenParams;
        for (const key of ['mazeRequireSameWall', 'mazeRequireTileAlign', 'enableHazards',
            'hazardCount', 'hazardMaxConsecutiveFails', 'hazardWallOverlapAllowed']) {
            expect(DEFAULT_PARAMS).not.toHaveProperty(key);
            expect(mazeDeclared).toHaveProperty(key);
            expect(defaults[key]).toEqual(mazeDeclared[key]);
        }
        const { run } = buildRunFromState({
            mode: 'gridGrowth', params: { seed: 9 }, scenario: { items: {}, obstacles: {} },
        });
        expect(run.grow.regionSize).toEqual({ width: DEFAULT_PARAMS.regionWidth, height: DEFAULT_PARAMS.regionHeight });
        expect(run.grow.seed).toBe(9);
    });

    it('drops a quota on an unregistered substrate id, as applyPresetState does', () => {
        const { run } = buildRunFromState({
            mode: 'shuffledSpiral', params: {}, scenario: { items: {}, obstacles: {} },
            substrateQuotas: { maze: 1, 'not-a-registered-substrate': 4 },
        });
        expect(run.config.growthParams.substrateQuotas).toEqual({ maze: 1 });
    });

    it('refuses a bundle with no valid mode, in words', () => {
        expect(() => buildRunFromState({ mode: 'nope' }))
            .toThrow(/the bundle's mode "nope" is not one of gridGrowth, sphereGrowth, shuffledSpiral, topDown/);
    });

    it('hazardOpts is null unless hazards are on with a positive count', () => {
        expect(effectiveHazardOpts({ enableHazards: false, hazardCount: 3 })).toBeNull();
        expect(effectiveHazardOpts({ enableHazards: true, hazardCount: 0 })).toBeNull();
        expect(effectiveHazardOpts({ enableHazards: true, hazardCount: 2.7, hazardMaxConsecutiveFails: 0 }))
            .toEqual({ enabled: true, count: 2, maxConsecutiveFails: 1, wallOverlapAllowed: false });
    });

    it('no registry entry declares libraryObstacles: no builder hands the engine an obstacle library beyond DEFAULT_OBSTACLES, so such a vocabulary has no reader', () => {
        // ⛓ PROCGEN PIPELINE PRESETS C1. bounce and runner used to declare one;
        // nothing read it (P2 measured a declared id dropped silently, trap 1388).
        // A zone substrate's gate defs reach the compiler as the region's own
        // obstacle_defs. A vocabulary that comes back needs its reader first.
        const declaring = substrateRegistry.getAll()
            .filter((e) => Object.prototype.hasOwnProperty.call(e, 'libraryObstacles')).map((e) => e.id);
        expect(declaring).toEqual([]);
    });

    it('the active dict is the state\'s OWN quotas or mix object (the panel mutates it)', () => {
        const state = { substrateQuotas: {}, substrateMix: {} };
        expect(activeSubstrateDict({ ...state, mode: 'sphereGrowth' })).toBe(state.substrateQuotas);
        expect(activeSubstrateDict({ ...state, mode: 'shuffledSpiral' })).toBe(state.substrateQuotas);
        expect(activeSubstrateDict({ ...state, mode: 'gridGrowth', substrateMode: 'quotas' })).toBe(state.substrateQuotas);
        expect(activeSubstrateDict({ ...state, mode: 'gridGrowth', substrateMode: 'mix' })).toBe(state.substrateMix);
        expect(activeSubstrateDict({ ...state, mode: 'topDown' })).toBe(state.substrateMix);
    });
});

describe('what a preset definition names, and its declared generation cost', () => {
    it('names every positive quota and mix key and an explicit start substrate, before any registry filter', () => {
        expect(presetSubstrateIds({
            substrateQuotas: { maze: 2, 'not-registered': 1, text_adventure: 0 },
            substrateMix: { bounce: 1 },
            params: { startSubstrate: 'jta' },
        })).toEqual(['maze', 'not-registered', 'bounce', 'jta']);
        expect(presetSubstrateIds({ params: { startSubstrate: 'auto' } })).toEqual([]);
        expect(presetSubstrateIds({ libraries: [{ source: 'served', file: 'x.json', count: 2 }] })).toEqual([]);
    });

    it('reads generationCost off the registry: absent is light, a declared heavy is heavy', () => {
        const declared = substrateRegistry.getAll()
            .filter((e) => e.generationCost != null).map((e) => [e.id, e.generationCost]);
        expect(declared.length).toBeGreaterThan(0);
        for (const [id, cost] of declared) expect(substrateGenerationCost(id)).toBe(cost);
        const undeclared = substrateRegistry.getAll().find((e) => e.generationCost == null);
        expect(substrateGenerationCost(undeclared.id)).toBe(GENERATION_COST.LIGHT);
        const heavyId = declared.find(([, c]) => c === GENERATION_COST.HEAVY)[0];
        expect(heavySubstrateIds({ substrateQuotas: { [heavyId]: 1, [undeclared.id]: 1 } })).toEqual([heavyId]);
    });

    it('refuses a declared generationCost outside the vocabulary, in words', () => {
        substrateRegistry.register({ id: 'probe-cost', generationCost: 'enormous' });
        try {
            expect(() => substrateGenerationCost('probe-cost'))
                .toThrow("substrate 'probe-cost' declares generationCost \"enormous\", which is not one of light, heavy");
        } finally {
            substrateRegistry.entries.delete('probe-cost');
        }
    });
});
