import { describe, it, expect } from 'vitest';

import { substrateRegistryEntry } from './flashSubstrateLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

describe('flashSubstrateLibrary substrateRegistryEntry', () => {
    it('declares the flash identity, panel type, and load event', () => {
        expect(substrateRegistryEntry.id).toBe('flash');
        expect(substrateRegistryEntry.panelComponentType).toBe('flashSubstratePanel');
        expect(substrateRegistryEntry.loadRegionEvent).toBe('flash:loadRegion');
    });

    it('declares a minimal supported-feature set (opaque minigame)', () => {
        // Mode 1: a minigame region is opaque. Only arbitrary AP
        // locations — no NESW exits, no source-derived topology.
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_ap_locations');
        expect(substrateRegistryEntry.supportedFeatures).not.toContain('nesw_exits');
        expect(substrateRegistryEntry.supportedFeatures).not.toContain('region_topology_from_source');
    });

    it('registers itself on import (idempotent)', () => {
        expect(substrateRegistry.has('flash')).toBe(true);
        expect(substrateRegistry.get('flash')).toBe(substrateRegistryEntry);
    });

    it('defers playback (getPlaybackController returns null in v1)', () => {
        expect(substrateRegistryEntry.getPlaybackController()).toBeNull();
    });

    it('omits build-time procgen hooks in Mode 1', () => {
        expect(substrateRegistryEntry.generateRegionCore).toBeUndefined();
        expect(substrateRegistryEntry.placeFromItems).toBeUndefined();
        expect(substrateRegistryEntry.placeFromRules).toBeUndefined();
    });

    describe('deserializeWorld', () => {
        it('converts the on-disk exits array into a Map keyed by exitName', () => {
            const world = substrateRegistryEntry.deserializeWorld({
                gameId: 'demo',
                exits: [
                    { exitName: 'north', targetRegion: 'R2' },
                    { exit_id: 'e3', targetRegion: 'R3' },
                ],
            });
            expect(world.exits).toBeInstanceOf(Map);
            expect(world.exits.has('north')).toBe(true);
            expect(world.exits.has('e3')).toBe(true);
            expect(world.gameId).toBe('demo');
        });

        it('tolerates a missing/empty exits field', () => {
            const world = substrateRegistryEntry.deserializeWorld({ gameId: 'demo' });
            expect(world.exits).toBeInstanceOf(Map);
            expect(world.exits.size).toBe(0);
        });
    });

    describe('serializeWorld', () => {
        it('is the inverse of deserializeWorld for exits (Map -> array)', () => {
            const round = substrateRegistryEntry.serializeWorld(
                substrateRegistryEntry.deserializeWorld({
                    gameId: 'demo',
                    exits: [{ exitName: 'north', targetRegion: 'R2' }],
                }),
            );
            expect(Array.isArray(round.exits)).toBe(true);
            expect(round.exits).toHaveLength(1);
            expect(round.exits[0].exitName).toBe('north');
        });
    });
});
