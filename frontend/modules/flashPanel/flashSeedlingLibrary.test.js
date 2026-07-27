import { describe, it, expect } from 'vitest';

import {
    substrateRegistryEntry,
    FLASH_SEEDLING_SUBSTRATE_ID,
    FLASH_SEEDLING_LOAD_REGION_EVENT,
} from './flashSeedlingLibrary.js';
import { substrateRegistryEntry as genericFlashEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';

describe('flash_seedling substrate entry', () => {
    it('registers itself on import — headless callers get it from the import alone', () => {
        expect(substrateRegistry.has(FLASH_SEEDLING_SUBSTRATE_ID)).toBe(true);
        expect(substrateRegistry.get(FLASH_SEEDLING_SUBSTRATE_ID)).toBe(substrateRegistryEntry);
    });

    it('uses the id the compiler stamps into the sidecars', () => {
        expect(substrateRegistryEntry.id).toBe(substrateIdFor('seedling'));
    });

    it('renders in the flashPanel panel with its OWN load event', () => {
        // It is driven by flashPanel's WasmBridgeAdapter, not by the shared
        // flashSubstrate bridge — which speaks a different dialect and would
        // be a second AP<->game translation (ruling 2, 2026-07-27).
        expect(substrateRegistryEntry.panelComponentType).toBe('flashPanel');
        expect(substrateRegistryEntry.loadRegionEvent).toBe(FLASH_SEEDLING_LOAD_REGION_EVENT);
        expect(substrateRegistryEntry.loadRegionEvent).not.toBe(genericFlashEntry.loadRegionEvent);
    });

    it('claims no iframeAdapter id — the flashPanel embed never announces appReady', () => {
        expect(substrateRegistryEntry.iframeId).toBeUndefined();
    });

    it('inherits the flash family runtime plumbing unchanged', () => {
        expect(substrateRegistryEntry.supportedFeatures).toEqual(['arbitrary_ap_locations']);
        expect(substrateRegistryEntry.getPlaybackController()).toBeNull();
        expect(substrateRegistryEntry.loopSupport.queueActions).toEqual(['regionMove']);
        expect(substrateRegistryEntry.generateRegionCore).toBeUndefined();
    });

    it('round-trips an atlas payload, keying exits on the AP exit name', () => {
        const payload = {
            gameId: 'seedling',
            atlas_ref: 'seedling-abc',
            atlas_region: 'starting_house',
            level: 86,
            tile_size: 16,
            exits: [{
                exit_id: 'door',
                exitName: 'starting_house -> overworld_start',
                targetRegion: 'overworld_start',
                targetExitId: 'house_door',
                target_level: 0,
                target_spawn: { x: 160, y: 272 },
                entrance_spawn: { x: 48, y: 64 },
            }],
        };
        const world = substrateRegistryEntry.deserializeWorld(payload);
        expect(world.exits).toBeInstanceOf(Map);
        expect(world.exits.has('starting_house -> overworld_start')).toBe(true);
        // The atlas block rides through deserializeWorld untouched — the flash
        // deserializer spreads unknown payload keys.
        expect(world.level).toBe(86);
        expect(world.atlas_region).toBe('starting_house');
        expect(world.atlas_ref).toBe('seedling-abc');
        expect(substrateRegistryEntry.serializeWorld(world)).toEqual(payload);
    });
});
