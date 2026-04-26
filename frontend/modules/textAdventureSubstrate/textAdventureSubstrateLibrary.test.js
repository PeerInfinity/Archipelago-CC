import { describe, it, expect } from 'vitest';

import { substrateRegistryEntry } from './textAdventureSubstrateLibrary.js';
import {
    spatialCore,
    itemBasedPlacer,
    ruleGatePlacer,
    tileGridPathExtractor,
    tileGridSerializer,
    tileGridDeserializer,
} from '../shared/procgen/adapterPrimitives.js';

describe('textAdventureSubstrateLibrary substrateRegistryEntry', () => {
    it('declares the text-adventure identity, panel type, and load event', () => {
        expect(substrateRegistryEntry.id).toBe('text_adventure');
        expect(substrateRegistryEntry.panelComponentType).toBe('textAdventureSubstratePanel');
        expect(substrateRegistryEntry.loadRegionEvent).toBe('textAdventure:loadRegion');
    });

    it('declares the shared features the substrate implements', () => {
        // v1 reuses the maze sidecar shape verbatim, so the
        // shared-library features the substrate supports are the same
        // set the maze supports.
        expect(substrateRegistryEntry.supportedFeatures).toContain('logic_gate');
        expect(substrateRegistryEntry.supportedFeatures).toContain('door_color');
        expect(substrateRegistryEntry.supportedFeatures).toContain('key_color');
    });

    it('exposes the build-time adapter slots, bound to shared primitives', () => {
        expect(substrateRegistryEntry.generateRegionCore).toBe(spatialCore);
        expect(substrateRegistryEntry.placeFromItems).toBe(itemBasedPlacer);
        expect(substrateRegistryEntry.placeFromRules).toBe(ruleGatePlacer);
        expect(substrateRegistryEntry.extractPathsAndObstacles).toBe(tileGridPathExtractor);
        expect(substrateRegistryEntry.serializeWorld).toBe(tileGridSerializer);
    });

    it('exposes deserializeWorld bound to the shared tile-grid deserializer', () => {
        expect(substrateRegistryEntry.deserializeWorld).toBe(tileGridDeserializer);
    });
});
