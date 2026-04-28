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
        // Library-mapped features. Text adventure declares logic_gate
        // (it can render gates) but NOT colored_doors_and_keys (the
        // panel has no visual representation for doors).
        expect(substrateRegistryEntry.supportedFeatures).toContain('logic_gate');
        expect(substrateRegistryEntry.supportedFeatures).not.toContain('colored_doors_and_keys');
        // Source-shape features — required to drive the top-down
        // pipeline against an arbitrary AP rules.json.
        expect(substrateRegistryEntry.supportedFeatures).toContain('nesw_exits');
        expect(substrateRegistryEntry.supportedFeatures).toContain('region_topology_from_source');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_ap_locations');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_location_rules');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_exit_rules');
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
