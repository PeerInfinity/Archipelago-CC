import { describe, it, expect } from 'vitest';

import { substrateRegistryEntry, applyMazeContentModules } from './mazeRoomLibrary.js';
import {
    generateRegionCore,
    placeFromItems,
    placeFromRules,
    extractPathsAndObstacles,
    deserializeMazeWorld,
    createWorld,
    setTile,
    TILE_FLOOR,
} from './mazeRoomEngine.js';
import { createRng } from '../shared/rng.js';
import { serializeMazeWorld } from '../procgenPipeline/procgenPipelineEngine.js';

describe('mazeRoomLibrary substrateRegistryEntry', () => {
    it('declares the maze identity, panel type, and load event', () => {
        expect(substrateRegistryEntry.id).toBe('maze');
        expect(substrateRegistryEntry.panelComponentType).toBe('mazeRoomPanel');
        expect(substrateRegistryEntry.loadRegionEvent).toBe('maze:loadRegion');
    });

    it('declares the shared features the maze implements', () => {
        // Library-mapped features (filter the Library section).
        expect(substrateRegistryEntry.supportedFeatures).toContain('logic_gate');
        expect(substrateRegistryEntry.supportedFeatures).toContain('colored_doors_and_keys');
        // Source-shape features (required to drive the top-down
        // pipeline against an arbitrary AP rules.json).
        expect(substrateRegistryEntry.supportedFeatures).toContain('nesw_exits');
        expect(substrateRegistryEntry.supportedFeatures).toContain('region_topology_from_source');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_ap_locations');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_location_rules');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_exit_rules');
    });

    it('exposes deserializeWorld bound to the engine implementation', () => {
        expect(substrateRegistryEntry.deserializeWorld).toBe(deserializeMazeWorld);
    });

    it('exposes the build-time adapter slots, bound to maze implementations', () => {
        expect(substrateRegistryEntry.generateRegionCore).toBe(generateRegionCore);
        expect(substrateRegistryEntry.placeFromItems).toBe(placeFromItems);
        expect(substrateRegistryEntry.placeFromRules).toBe(placeFromRules);
        expect(substrateRegistryEntry.extractPathsAndObstacles).toBe(extractPathsAndObstacles);
        expect(substrateRegistryEntry.serializeWorld).toBe(serializeMazeWorld);
    });

    it('exposes getPlaybackController for the bot to dispatch into', () => {
        // No panel mounted in the headless test environment, so the
        // resolver returns null. The controller delegation itself is
        // exercised in mazeRoomUI.test.js's "playback controller
        // adapter" describe block.
        expect(typeof substrateRegistryEntry.getPlaybackController).toBe('function');
        expect(substrateRegistryEntry.getPlaybackController()).toBeNull();
    });
});

describe('applyMazeContentModules — X1 consumable tiles', () => {
    function makeWorld() {
        const w = createWorld(6, 6, { entrance: { x: 0, y: 0 }, exit: { x: 5, y: 5 } });
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 6; x++) setTile(w, x, y, TILE_FLOOR);
        }
        return w;
    }
    const POOL = [{ substrate: 'omsi', type: 'gold' }];

    it('draws NO rng when consumableTileOpts is absent (byte-inert default)', () => {
        // This is the property the whole byte-inert-default proof rests
        // on: with the knobs at defaults the pass must not advance the
        // shared rng stream, or every existing preset drifts.
        const w = makeWorld();
        let draws = 0;
        const rng = { next: () => { draws++; return 0.5; } };
        applyMazeContentModules(w, {}, rng);
        applyMazeContentModules(w, { consumableTileOpts: null }, rng);
        applyMazeContentModules(w, { consumableTileOpts: { consumableCount: 0, manaCount: 0 } }, rng);
        expect(draws).toBe(0);
        expect(w.consumableTiles.size).toBe(0);
        expect(w.manaTiles.size).toBe(0);
    });

    it('places tiles when the opts are active', () => {
        const w = makeWorld();
        applyMazeContentModules(
            w,
            { consumableTileOpts: { consumableCount: 2, pool: POOL, manaCount: 1, manaAmount: 40 } },
            createRng(1),
        );
        expect(w.consumableTiles.size).toBe(2);
        expect(w.manaTiles.size).toBe(1);
    });

    it('runs strictly after hazards, so enabling it cannot move hazard placement', () => {
        // Hazards draw first from the same rng. Same seed + same hazard
        // opts must give identical hazards whether or not consumable
        // tiles are also requested.
        const hazardOpts = { enabled: true, count: 2 };
        const a = makeWorld();
        const b = makeWorld();
        applyMazeContentModules(a, { hazardOpts }, createRng(5));
        applyMazeContentModules(
            b,
            { hazardOpts, consumableTileOpts: { consumableCount: 2, pool: POOL } },
            createRng(5),
        );
        expect(JSON.stringify(b.hazards)).toBe(JSON.stringify(a.hazards));
        expect(b.consumableTiles.size).toBe(2);
    });
});
