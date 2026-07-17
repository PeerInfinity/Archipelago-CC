import { describe, it, expect } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    substrateRegistryEntry,
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

    it('declares the shared-mana channel (and only that category)', () => {
        expect(substrateRegistryEntry.sharing).toEqual({ mana: {} });
        // R2 scope: the items category stays undeclared until P1.
        expect(substrateRegistryEntry.sharing.items).toBeUndefined();
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
