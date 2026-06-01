import { describe, it, expect } from 'vitest';

import {
    substrateRegistryEntry,
    createFlashSubstrateEntry,
    FLASH_PANEL_COMPONENT_TYPE,
    FLASH_LOAD_REGION_EVENT,
} from './flashSubstrateLibrary.js';
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

    it('shares the same de/serialize + playback contract as the default entry', () => {
        const e = createFlashSubstrateEntry({ id: 'flash_c' });
        const w = e.deserializeWorld({ gameId: 'g', exits: [{ exitName: 'n', targetRegion: 'R' }] });
        expect(w.exits).toBeInstanceOf(Map);
        expect(e.serializeWorld(w).exits[0].exitName).toBe('n');
        expect(e.getPlaybackController()).toBeNull();
    });

    it('multiple per-game entries can register alongside the default in one registry', () => {
        const ids = ['flash_reg_a', 'flash_reg_b'];
        for (const id of ids) {
            if (!substrateRegistry.has(id)) {
                substrateRegistry.register(createFlashSubstrateEntry({ id }));
            }
        }
        // The default 'flash' plus both per-game ids all coexist, each
        // resolving to the shared panel/event.
        for (const id of ['flash', ...ids]) {
            expect(substrateRegistry.has(id)).toBe(true);
            expect(substrateRegistry.get(id).panelComponentType).toBe(FLASH_PANEL_COMPONENT_TYPE);
            expect(substrateRegistry.get(id).loadRegionEvent).toBe(FLASH_LOAD_REGION_EVENT);
        }
    });
});
