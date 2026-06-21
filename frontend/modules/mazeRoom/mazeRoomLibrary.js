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
 * The registry entry composes its build-time adapter slots from
 * shared/procgen/adapterPrimitives.js. The maze "owns" most of the
 * primitive implementations (they live in mazeRoomEngine.js) but the
 * registry entry stays substrate-neutral in shape so any substrate
 * sharing tile-grid semantics can compose the same way.
 *
 * See NewDocs/plans/procedural-generation/procgen-player.md §"Substrate
 * registry" for the runtime fields, and text-adventure-substrate.md
 * §"Substrate registry entry, expanded" for the build-time slots.
 */

import {
    spatialCore,
    itemBasedPlacer,
    ruleGatePlacer,
    tileGridPathExtractor,
    tileGridSerializer,
    tileGridDeserializer,
} from '../shared/procgen/adapterPrimitives.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { generateHazards } from '../shared/procgen/contentModules/hazardPathGen.js';
import { getPanelInstance } from './index.js';

/**
 * Content-module pass (registry `applyContentModules` hook): stamp tile-grid
 * content onto a freshly-built maze world after the base maze + obstacle layout
 * is done. Currently just hazards (a maze content module). Mutates `world`;
 * no-op when no hazards are requested. The generic engine calls this
 * unconditionally at both region-build sites — substrates without the hook
 * (bounce etc.) simply don't declare it, so the engine names no substrate.
 *
 * Gated on hazardOpts.enabled to keep existing presets cost-free unless the
 * caller opts in. Draws from `rng` at the same point the engine used to call
 * applyHazardModule, so hazard RNG ordering is preserved (byte-identical).
 *
 * @param {object} world - target world (must have width/height/tiles)
 * @param {object} opts
 * @param {object|null} opts.hazardOpts - { enabled, count?,
 *   maxConsecutiveFails?, wallOverlapAllowed? }; null/disabled = no-op
 * @param {{next:()=>number}} rng
 */
export function applyMazeContentModules(world, { hazardOpts = null } = {}, rng) {
    if (!hazardOpts || !hazardOpts.enabled) return;
    const count = Math.max(0, Math.floor(hazardOpts.count ?? 0));
    if (count === 0) return;
    // Keep hazards off entrance / exit / location tiles. Hazards don't
    // statically block tiles (the player walks through them when the cycle
    // phase allows), but a hazard whose path includes one of these "anchor"
    // tiles would obscure them visually and create UX confusion — entrance is
    // where the player spawns, exits route between regions, and locations hold
    // the item sprite.
    const reservedTiles = new Set();
    if (world.entrance) {
        reservedTiles.add(`${world.entrance.x},${world.entrance.y}`);
    }
    if (world.exits) {
        for (const exit of world.exits.values()) {
            if (typeof exit?.x === 'number' && typeof exit?.y === 'number') {
                reservedTiles.add(`${exit.x},${exit.y}`);
            }
        }
    }
    // world.items is a Map<posKey, itemId>; each entry is a location tile.
    // Reserve them all so hazards stay clear of pickups.
    if (world.items) {
        for (const key of world.items.keys()) {
            reservedTiles.add(key);
        }
    }
    const result = generateHazards(world, {
        count,
        maxConsecutiveFails: hazardOpts.maxConsecutiveFails ?? 10,
        wallOverlapAllowed: !!hazardOpts.wallOverlapAllowed,
        initialReservedTiles: reservedTiles,
    }, rng);
    if (result.hazards.length > 0) {
        world.hazards = result.hazards.map((h) => ({ ...h, phase: 0 }));
    }
}

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'maze',
    label: 'Maze',
    panelComponentType: 'mazeRoomPanel',
    loadRegionEvent: 'maze:loadRegion',
    supportedFeatures: Object.freeze([
        'logic_gate',
        'colored_doors_and_keys',
        'nesw_exits',
        'region_topology_from_source',
        'arbitrary_ap_locations',
        'arbitrary_location_rules',
        'arbitrary_exit_rules',
    ]),
    deserializeWorld: tileGridDeserializer,

    // Runtime — playback. Returns the live panel's controller so the
    // bot can drive the visualizer directly. null when no panel mounted.
    getPlaybackController: () => getPanelInstance()?.getPlaybackController?.() ?? null,

    // Loop-mode capabilities: maze supports everything — all queue
    // action types, manual play, and saved-queue recording/replay.
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove', 'locationCheck', 'explore']),
        manual: true,
        customQueues: true,
    }),

    // Build-time adapters
    generateRegionCore: spatialCore,
    placeFromItems: itemBasedPlacer,
    placeFromRules: ruleGatePlacer,
    extractPathsAndObstacles: tileGridPathExtractor,
    serializeWorld: tileGridSerializer,

    // Content-module pass (hazards). The generic engine calls this after the
    // base region build at both build sites; substrates that don't declare it
    // skip the pass, so the engine no longer names 'maze' there.
    applyContentModules: applyMazeContentModules,
});

// Side-effect on import: register the maze substrate so any caller
// that imports this library can immediately dispatch via the registry.
// Idempotent — production also calls register() via mazeRoom/index.js's
// host hook, and tests that want a fresh registry call substrateRegistry
// .clear() in beforeEach. Putting registration here (rather than in
// procgenPipelineEngine.js) avoids a circular import between the
// pipeline engine and the maze library.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
