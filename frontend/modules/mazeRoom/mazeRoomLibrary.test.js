import { describe, it, expect } from 'vitest';

import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import {
    generateRegionCore,
    placeFromItems,
    placeFromRules,
    extractPathsAndObstacles,
    deserializeMazeWorld,
} from './mazeRoomEngine.js';
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
});
