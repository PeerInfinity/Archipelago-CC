import { describe, it, expect } from 'vitest';

import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';

describe('mazeRoomLibrary substrateRegistryEntry', () => {
    it('declares the maze identity, panel type, and load event', () => {
        expect(substrateRegistryEntry.id).toBe('maze');
        expect(substrateRegistryEntry.panelComponentType).toBe('mazeRoomPanel');
        expect(substrateRegistryEntry.loadRegionEvent).toBe('maze:loadRegion');
    });

    it('declares the shared features the maze implements', () => {
        expect(substrateRegistryEntry.supportedFeatures).toContain('logic_gate');
        expect(substrateRegistryEntry.supportedFeatures).toContain('door_color');
        expect(substrateRegistryEntry.supportedFeatures).toContain('key_color');
    });

    it('exposes deserializeWorld bound to the engine implementation', () => {
        expect(substrateRegistryEntry.deserializeWorld).toBe(deserializeMazeWorld);
    });
});
