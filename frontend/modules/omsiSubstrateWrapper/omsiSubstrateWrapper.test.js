import { describe, it, expect } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    substrateRegistryEntry,
    ingestVisitRecording,
    takeLastVisitRecording,
    OMSI_START_JOURNEY_LOCATION_ID,
    OMSI_VICTORY_ITEM_NAME,
    OMSI_LIBRARY_ITEMS,
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
        // Empty until the bridge publishes (arc D slice 4) — and an empty
        // pull is what keeps a Record block persisting NOTHING today.
        expect(takeLastVisitRecording()).toBeNull();

        ingestVisitRecording({
            actions: [{ actionType: 'clickTask', actionId: 'Wander', loops: 3 }],
            departureExitId: 'exit_N',
        });
        const pulled = substrateRegistryEntry.takeLastRecording();
        expect(pulled.departureExitId).toBe('exit_N');
        expect(pulled.actions).toHaveLength(1);
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
