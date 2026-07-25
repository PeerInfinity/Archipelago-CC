import { afterEach, describe, it, expect } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    substrateRegistryEntry,
    ingestVisitRecording,
    takeLastVisitRecording,
    convertPlanToQueue,
    convertQueueToPlan,
    OMSI_START_JOURNEY_LOCATION_ID,
    OMSI_VICTORY_ITEM_NAME,
    OMSI_LIBRARY_ITEMS,
    getOmsiRegionSplit,
} from './omsiSubstrateWrapperLibrary.js';

// The library registers on import (side effect) — same pattern the
// maze / textAdventure / jta libraries use.

describe('omsi substrate registry entry', () => {
    it('is registered on import under id "omsi"', () => {
        expect(substrateRegistry.has('omsi')).toBe(true);
        expect(substrateRegistry.get('omsi')).toBe(substrateRegistryEntry);
    });

    it('declares the shared-mana channel and the shareable consumables (P1)', () => {
        expect(Object.keys(substrateRegistryEntry.sharing).sort()).toEqual(['items', 'mana']);
        expect(substrateRegistryEntry.sharing.mana).toEqual({});
        // The NUMERIC entries of the engine's resources bag, in template
        // order (booleans are unlock flags, excluded). The in-app
        // substrate test cross-checks this list against the live
        // resourcesTemplate via iframe eval.
        expect(substrateRegistryEntry.sharing.items.types).toEqual([
            'gold', 'reputation', 'herbs', 'hide', 'potions',
            'teamMembers', 'armor', 'blood', 'artifacts', 'favors',
            'enchantments', 'houses', 'pylons', 'zombie', 'map',
            'completedMap', 'heart', 'power',
        ]);
        expect(new Set(substrateRegistryEntry.sharing.items.types).size).toBe(18);
    });

    it('passes register-time sharing validation on a fresh registry', () => {
        // register() already ran once on import without throwing; check
        // the declaration also validates in isolation (a second
        // registry instance shape-checks the same frozen entry).
        const entries = substrateRegistry.getAll();
        expect(entries.some((e) => e.id === 'omsi')).toBe(true);
    });

    it('exposes the v0 identity/runtime fields', () => {
        expect(substrateRegistryEntry.label).toBe('Idle Loops');
        expect(substrateRegistryEntry.panelComponentType).toBe('omsiSubstrateWrapperPanel');
        expect(substrateRegistryEntry.loadRegionEvent).toBe('omsi:loadRegion');
        expect(substrateRegistryEntry.iframeId).toBe('omsiSubstrateWrapper');
        expect(substrateRegistryEntry.victoryItem).toBe(OMSI_VICTORY_ITEM_NAME);
        expect(substrateRegistryEntry.zoneCount).toBe(1);
    });

    it('classifies Victory as the is_victory goal item', () => {
        expect(OMSI_LIBRARY_ITEMS[OMSI_VICTORY_ITEM_NAME]).toEqual({
            classification: 'progression',
            is_victory: true,
        });
        expect(substrateRegistryEntry.libraryItems).toBe(OMSI_LIBRARY_ITEMS);
    });
});

describe('per-visit recording stash (arc D1)', () => {
    it('takeLastRecording drains the slot once (loops sole-persister pull)', () => {
        // Empty until the bridge publishes — and an empty pull is what keeps a
        // Record block persisting NOTHING.
        expect(takeLastVisitRecording()).toBeNull();

        // The bridge publishes the fork's NATIVE plan entries; the ingest
        // converts them to the shared vocabulary loops stores.
        ingestVisitRecording({
            actions: [{ name: 'Wander', loops: 3, loopsType: 'actions', disabled: false }],
            departureExitId: 'exit_N',
        });
        const pulled = substrateRegistryEntry.takeLastRecording();
        expect(pulled.departureExitId).toBe('exit_N');
        expect(pulled.actions).toHaveLength(1);
        expect(pulled.actions[0]).toMatchObject({
            actionType: 'clickTask', actionId: 'Wander', loops: 3,
        });
        // Pull-once: a discarded visit can't be re-pulled by a later block.
        expect(substrateRegistryEntry.takeLastRecording()).toBeNull();
    });

    it('tolerates a malformed payload without stashing a bogus script', () => {
        ingestVisitRecording({ actions: 'nope' });
        const pulled = takeLastVisitRecording();
        expect(pulled.actions).toEqual([]);
        expect(pulled.departureExitId).toBeNull();
    });
});

describe('recording vocabulary conversion (arc D slice 4)', () => {
    const PLAN = [
        { name: 'Wander', loops: 2, loopsType: 'actions', disabled: false },
        { name: 'Smash Pots', loops: 5, loopsType: 'actions', disabled: true },
    ];

    it('converts a native plan to the shared actionQueue vocabulary', () => {
        const q = convertPlanToQueue(PLAN);
        expect(q).toHaveLength(2);
        expect(q[0]).toMatchObject({
            actionType: 'clickTask', actionId: 'Wander', label: 'Wander',
            loops: 2, disabled: false, loopsType: 'actions',
        });
        // The action NAME is the id (omsi names are stable engine ids), and
        // the disabled flag rides along so a recording reinstalls as the plan
        // it was captured from.
        expect(q[1]).toMatchObject({ actionId: 'Smash Pots', loops: 5, disabled: true });
        // Every entry carries a unique shared-vocabulary entry id.
        expect(new Set(q.map((e) => e.entryId)).size).toBe(2);
    });

    it('round-trips a plan through the shared vocabulary unchanged', () => {
        expect(convertQueueToPlan(convertPlanToQueue(PLAN))).toEqual(PLAN);
    });

    it('preserves a 0-rep entry rather than inventing a rep', () => {
        const q = convertPlanToQueue([{ name: 'Wander', loops: 0 }]);
        expect(q[0].loops).toBe(0);
        expect(convertQueueToPlan(q)[0].loops).toBe(0);
    });

    it('drops entries that name nothing, and defaults a missing rep count', () => {
        expect(convertPlanToQueue([{ loops: 3 }, { name: '' }, null])).toEqual([]);
        expect(convertPlanToQueue([{ name: 'Wander' }])[0].loops).toBe(1);
    });

    it('drops non-clickTask entries on the way back to a plan', () => {
        // A plan entry naming an action this build has never heard of makes
        // the fork's next loop start THROW out of translateClassNames, so a
        // foreign-vocabulary recording must not be guessed at here (the
        // bridge filters against totalActionList again on install).
        expect(convertQueueToPlan([
            { actionType: 'useItem', actionId: 7, loops: 1 },
            { actionType: 'clickTask', actionId: 42 },
            { actionType: 'clickTask', actionId: 'Wander', loops: 1 },
        ])).toEqual([{ name: 'Wander', loops: 1, disabled: false, loopsType: 'actions' }]);
    });

    it('both tolerate a non-array', () => {
        expect(convertPlanToQueue(undefined)).toEqual([]);
        expect(convertQueueToPlan('nope')).toEqual([]);
    });
});

describe('extractZoneRules', () => {
    it('zone 0 emits the Start Journey victory location + omsiTown payload', () => {
        const { locations, payload } = substrateRegistryEntry.extractZoneRules(0, {
            region_id: 'region_1_1',
        });
        expect(payload.omsiTown).toBe(0);
        expect(payload.ap_locations).toEqual({
            [OMSI_START_JOURNEY_LOCATION_ID]: 'region_1_1__start_journey',
        });
        expect(locations).toEqual([{
            id: OMSI_START_JOURNEY_LOCATION_ID,
            item: OMSI_VICTORY_ITEM_NAME,
            position: null,
        }]);
    });

    it('non-zero zones emit no locations (v0 forward-compat guard)', () => {
        const { locations, payload } = substrateRegistryEntry.extractZoneRules(1, {
            region_id: 'region_9_9',
        });
        expect(payload).toEqual({ omsiTown: 1 });
        expect(locations).toEqual([]);
    });
});

describe('world (de)serialization', () => {
    it('deserializeWorld converts exits array to a Map keyed by exitName', () => {
        const world = substrateRegistryEntry.deserializeWorld({
            omsiTown: 0,
            manaEnabled: true,
            exits: [
                { exit_id: 'a', exitName: 'A -> B', targetRegion: 'B' },
                { exit_id: 'b', targetRegion: 'C' },   // falls back to exit_id
            ],
        });
        expect(world.exits instanceof Map).toBe(true);
        expect(world.exits.get('A -> B').targetRegion).toBe('B');
        expect(world.exits.get('b').targetRegion).toBe('C');
        expect(world.omsiTown).toBe(0);
        expect(world.manaEnabled).toBe(true);
    });

    it('serializeWorld inverts deserializeWorld (round trip)', () => {
        const payload = {
            omsiTown: 0,
            exits: [{ exit_id: 'x', exitName: 'X', targetRegion: 'Y' }],
        };
        const world = substrateRegistryEntry.deserializeWorld(payload);
        const back = substrateRegistryEntry.serializeWorld(world);
        expect(back.exits).toEqual(payload.exits);
        expect(back.omsiTown).toBe(0);
    });

    it('both tolerate missing/odd exits fields', () => {
        expect(substrateRegistryEntry.deserializeWorld(null).exits.size).toBe(0);
        expect(substrateRegistryEntry.serializeWorld(null).exits).toEqual([]);
        expect(substrateRegistryEntry.serializeWorld({ exits: 'bogus' }).exits).toEqual([]);
    });
});

describe('region split — per-region max Explore level (arc D2 slice 2b)', () => {
    // applyPipelineConfig is module state, so every case installs what it needs
    // and the block clears it at the end (the extractZoneRules block above runs
    // against the unsplit default).
    const zone = (i) => substrateRegistryEntry
        .extractZoneRules(i, { region_id: `region_${i}` }).payload.omsiRegion;

    afterEach(() => substrateRegistryEntry.applyPipelineConfig({}));

    it('defaults to an even split of the town’s 100 levels', () => {
        substrateRegistryEntry.applyPipelineConfig({
            regionSplit: { townIndex: 0, count: 4, exploreVar: 'Wander' },
        });
        expect(zone(0).exploreMaxLevel).toBe(25);
        expect(zone(3).exploreMaxLevel).toBe(25);
        expect(getOmsiRegionSplit().exploreMaxLevels).toEqual([25, 25, 25, 25]);
    });

    it('rounds the even split and never yields 0', () => {
        substrateRegistryEntry.applyPipelineConfig({
            regionSplit: { count: 3, exploreVar: 'Wander' },
        });
        expect(getOmsiRegionSplit().exploreMaxLevels).toEqual([33, 33, 33]);

        substrateRegistryEntry.applyPipelineConfig({
            regionSplit: { count: 250, exploreVar: 'Wander' },
        });
        // 100/250 rounds to 0 — a zero-level region could never be explored.
        expect(getOmsiRegionSplit().exploreMaxLevels[0]).toBe(1);
    });

    it('a shared default overrides the even split', () => {
        substrateRegistryEntry.applyPipelineConfig({
            regionSplit: { count: 4, exploreVar: 'Wander', exploreMaxLevel: 10 },
        });
        expect(getOmsiRegionSplit().exploreMaxLevels).toEqual([10, 10, 10, 10]);
    });

    it('per-region entries override the shared default, by zone ordinal', () => {
        substrateRegistryEntry.applyPipelineConfig({
            regionSplit: {
                count: 3, exploreVar: 'Wander', exploreMaxLevel: 10,
                regions: [{ exploreMaxLevel: 4 }, {}, { exploreMaxLevel: 40 }],
            },
        });
        expect(getOmsiRegionSplit().exploreMaxLevels).toEqual([4, 10, 40]);
        expect(zone(0).exploreMaxLevel).toBe(4);
        expect(zone(2).exploreMaxLevel).toBe(40);
    });

    it('clamps to [1, 100] and falls back on unusable values', () => {
        substrateRegistryEntry.applyPipelineConfig({
            regionSplit: {
                count: 4, exploreVar: 'Wander', exploreMaxLevel: 10,
                regions: [{ exploreMaxLevel: 0 }, { exploreMaxLevel: 999 },
                    { exploreMaxLevel: 'nope' }, { exploreMaxLevel: 7.9 }],
            },
        });
        // 0 and a non-number are unusable -> the shared default; 999 clamps to
        // the town's own ceiling; a fraction truncates.
        expect(getOmsiRegionSplit().exploreMaxLevels).toEqual([10, 100, 10, 7]);
    });

    it('exploreThreshold keeps its meaning as a FRACTION of the region cap', () => {
        substrateRegistryEntry.applyPipelineConfig({
            regionSplit: { count: 2, exploreVar: 'Wander', exploreMaxLevel: 10, exploreThreshold: 0.5 },
        });
        // The descriptor carries both, and the fork derives the exp from the
        // region's own ceiling — the host never multiplies out a cap here.
        expect(zone(0)).toEqual({
            townIndex: 0,
            regionId: 'region_0',
            exploreVar: 'Wander',
            exploreThreshold: 0.5,
            exploreMaxLevel: 10,
        });
    });
});
