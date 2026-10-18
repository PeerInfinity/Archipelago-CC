import { describe, it, expect } from 'vitest';

import * as flashSubstrateLibrary from './flashSubstrateLibrary.js';
import {
    createFlashSubstrateEntry,
    FLASH_PANEL_COMPONENT_TYPE,
    FLASH_LOAD_REGION_EVENT,
} from './flashSubstrateLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

// The factory's bare shape. ⚖ user, 2026-10-18: the generic `flash` entry
// "isn't really a substrate", so the library no longer exports or registers one;
// these rows pin the factory defaults every per-game entry starts from.
const substrateRegistryEntry = createFlashSubstrateEntry({ id: 'flash_factory_probe' });

describe('createFlashSubstrateEntry — the factory defaults', () => {
    it('declares the flash identity, panel type, and load event', () => {
        expect(substrateRegistryEntry.id).toBe('flash_factory_probe');
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

    it('the library registers NO entry and exports none (the generic `flash` entry is gone)', () => {
        expect(substrateRegistry.has('flash')).toBe(false);
        expect('substrateRegistryEntry' in flashSubstrateLibrary).toBe(false);
    });

    it('defers playback: NO getPlaybackController at all (its absence is the capability readout)', () => {
        expect(substrateRegistryEntry.getPlaybackController).toBeUndefined();
        expect('getPlaybackController' in substrateRegistryEntry).toBe(false);
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

    it('is built via the factory (default entry === createFlashSubstrateEntry output shape)', () => {
        expect(substrateRegistryEntry.panelComponentType).toBe(FLASH_PANEL_COMPONENT_TYPE);
        expect(substrateRegistryEntry.loadRegionEvent).toBe(FLASH_LOAD_REGION_EVENT);
    });
});

describe('createFlashSubstrateEntry (Shape 1 — per-game entry factory)', () => {
    it('throws without a valid id', () => {
        expect(() => createFlashSubstrateEntry({})).toThrow();
        expect(() => createFlashSubstrateEntry({ id: '' })).toThrow();
        expect(() => createFlashSubstrateEntry({ id: 42 })).toThrow();
    });

    it('produces a per-game entry with its own id/label/features', () => {
        const e = createFlashSubstrateEntry({
            id: 'flash_seedling',
            label: 'Seedling',
            supportedFeatures: ['arbitrary_ap_locations', 'nesw_exits'],
        });
        expect(e.id).toBe('flash_seedling');
        expect(e.label).toBe('Seedling');
        expect(e.supportedFeatures).toContain('nesw_exits');
    });

    it('defaults label to id and features to [arbitrary_ap_locations]', () => {
        const e = createFlashSubstrateEntry({ id: 'flash_x' });
        expect(e.label).toBe('flash_x');
        expect(e.supportedFeatures).toEqual(['arbitrary_ap_locations']);
    });

    it('SHARES one panel + load event across all per-game entries (the core of Shape 1)', () => {
        const a = createFlashSubstrateEntry({ id: 'flash_a' });
        const b = createFlashSubstrateEntry({ id: 'flash_b' });
        // Distinct identities...
        expect(a.id).not.toBe(b.id);
        // ...but the same panel + load event, so both route to one panel/bridge.
        expect(a.panelComponentType).toBe(b.panelComponentType);
        expect(a.panelComponentType).toBe(FLASH_PANEL_COMPONENT_TYPE);
        expect(a.loadRegionEvent).toBe(b.loadRegionEvent);
        expect(a.loadRegionEvent).toBe(FLASH_LOAD_REGION_EVENT);
    });

    it('shares the same de/serialize + playback contract as the factory defaults', () => {
        const e = createFlashSubstrateEntry({ id: 'flash_c' });
        const w = e.deserializeWorld({ gameId: 'g', exits: [{ exitName: 'n', targetRegion: 'R' }] });
        expect(w.exits).toBeInstanceOf(Map);
        expect(e.serializeWorld(w).exits[0].exitName).toBe('n');
        expect(e.getPlaybackController).toBeUndefined();
    });

    it('multiple per-game entries can register side by side in one registry', () => {
        const ids = ['flash_reg_a', 'flash_reg_b'];
        for (const id of ids) {
            if (!substrateRegistry.has(id)) {
                substrateRegistry.register(createFlashSubstrateEntry({ id }));
            }
        }
        // Several per-game ids coexist, each
        // resolving to the shared panel/event.
        for (const id of ids) {
            expect(substrateRegistry.has(id)).toBe(true);
            expect(substrateRegistry.get(id).panelComponentType).toBe(FLASH_PANEL_COMPONENT_TYPE);
            expect(substrateRegistry.get(id).loadRegionEvent).toBe(FLASH_LOAD_REGION_EVENT);
        }
    });
});
