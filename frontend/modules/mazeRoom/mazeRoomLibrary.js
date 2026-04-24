/**
 * Maze substrate library — registry entry plus a place for any future
 * maze-substrate-specific library data (sprite hints, tile-specific
 * config, etc.).
 *
 * Cross-substrate item / obstacle definitions still live in
 * shared/procgen/library.js (logic_gate, colored keys/doors, etc.)
 * because any substrate could implement them. This file holds only
 * what is genuinely maze-specific.
 *
 * See NewDocs/plans/procedural-generation/procgen-player.md §"Substrate
 * registry" for the entry shape and the rationale for its fields.
 */

import { deserializeMazeWorld } from './mazeRoomEngine.js';

export const substrateRegistryEntry = Object.freeze({
    id: 'maze',
    panelComponentType: 'mazeRoomPanel',
    loadRegionEvent: 'maze:loadRegion',
    supportedFeatures: Object.freeze([
        'logic_gate',
        'door_color',
        'key_color',
    ]),
    deserializeWorld: deserializeMazeWorld,
});
