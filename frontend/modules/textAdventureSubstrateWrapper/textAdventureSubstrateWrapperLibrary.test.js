/**
 * Ported from the deprecated textAdventureSubstrate's
 * textAdventureSubstrateLibrary.test.js (2026-07-26). The wrapper's registry
 * entry had no coverage of its own.
 *
 * This is the port that earns its keep. Both modules register substrate id
 * 'text_adventure' and the DEPRECATED one loads first, so wherever both are
 * enabled it wins the id and the wrapper "loses gracefully" — with no error
 * anywhere. The only visible difference is the entry's shape, and the
 * loopSupport delta below is exactly what a half-migrated mode config silently
 * costs you. Pinning it here means the delta is a test failure rather than a
 * debugging session. See docs/json/developer/procgen/gotchas.md.
 */
import { describe, it, expect } from 'vitest';

import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';
import {
    spatialCore,
    itemBasedPlacer,
    ruleGatePlacer,
    tileGridPathExtractor,
    tileGridSerializer,
    tileGridDeserializer,
} from '../shared/procgen/adapterPrimitives.js';

describe('textAdventureSubstrateWrapperLibrary substrateRegistryEntry', () => {
    it('claims the text-adventure identity and load event, with the WRAPPER panel', () => {
        expect(substrateRegistryEntry.id).toBe('text_adventure');
        expect(substrateRegistryEntry.loadRegionEvent).toBe('textAdventure:loadRegion');
        // The one identity field that differs from the deprecated entry, and
        // therefore the cheapest way for a test — or a browser probe — to tell
        // which module actually owns the registry id.
        expect(substrateRegistryEntry.panelComponentType)
            .toBe('textAdventureSubstrateWrapperPanel');
    });

    it('declares the shared features the substrate implements', () => {
        // logic_gate yes (gates can be rendered as prose), but NOT
        // colored_doors_and_keys: there is no visual representation of a door.
        expect(substrateRegistryEntry.supportedFeatures).toContain('logic_gate');
        expect(substrateRegistryEntry.supportedFeatures).not.toContain('colored_doors_and_keys');
        // Source-shape features — required to drive the top-down pipeline
        // against an arbitrary AP rules.json.
        expect(substrateRegistryEntry.supportedFeatures).toContain('nesw_exits');
        expect(substrateRegistryEntry.supportedFeatures).toContain('region_topology_from_source');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_ap_locations');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_location_rules');
        expect(substrateRegistryEntry.supportedFeatures).toContain('arbitrary_exit_rules');
    });

    it('declares the loop support the deprecated entry LACKS', () => {
        // The whole point of the migration. The deprecated entry declares only
        // queueActions/manual/customQueues; these three are what a config that
        // still enables it silently gives up.
        expect(substrateRegistryEntry.loopSupport.record).toBe(true);
        expect(substrateRegistryEntry.loopSupport.playback).toBe(true);
        expect(substrateRegistryEntry.loopSupport.instant).toBe(true);
    });

    it('keeps the loop support both entries share', () => {
        expect([...substrateRegistryEntry.loopSupport.queueActions])
            .toEqual(['regionMove', 'locationCheck', 'explore']);
        expect(substrateRegistryEntry.loopSupport.manual).toBe(true);
        // customQueues stays NO by decision (2026-06-12): the dropdown would
        // duplicate what the loops queue already expresses.
        expect(substrateRegistryEntry.loopSupport.customQueues).toBe(false);
    });

    it('supplies NO recorder — it is the reference coarse-only substrate', () => {
        // M3b capture contract: every action it has is queue-grade, so loops
        // owns coarse capture and the block interior IS the recording. A
        // takeLastRecording appearing here would mean the substrate had been
        // reclassified as fine-grained.
        expect(substrateRegistryEntry.takeLastRecording).toBeUndefined();
    });

    it('participates in the shared mana channel', () => {
        expect(substrateRegistryEntry.sharing?.mana).toBeDefined();
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

    it('exposes getPlaybackController for the bot to dispatch into', () => {
        // Headless: initialize() has not run, so the proxy is null. The slot
        // existing and being callable is the contract; the wiring is covered
        // in playbackProxy.test.js.
        expect(typeof substrateRegistryEntry.getPlaybackController).toBe('function');
        expect(substrateRegistryEntry.getPlaybackController()).toBeNull();
    });
});
