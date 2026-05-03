/**
 * Substrate registry — collects per-substrate registry entries so the
 * procgen player and pipeline can dispatch by substrate id without
 * any direct imports from substrate modules.
 *
 * Each substrate module registers its entry during its own
 * register() / initialize() phase by calling
 * substrateRegistry.register(entry). The registry is a singleton;
 * entries are keyed by their `id` field.
 *
 * Entry shape (informal — see procgen-player.md §"Substrate
 * registry" for the runtime fields, and
 * text-adventure-substrate.md §"Substrate registry entry,
 * expanded" for the build-time slots):
 *
 *   {
 *     // Identity (required)
 *     id,                       // string, unique substrate id
 *
 *     // Runtime — required for substrates that ship a panel
 *     panelComponentType,       // Golden Layout component type
 *     loadRegionEvent,          // eventBus event the panel subscribes to
 *     supportedFeatures,        // array of shared-library feature ids
 *     deserializeWorld,         // (sidecar) -> world; called by procgenPlayer
 *
 *     // Runtime — playback (optional; substrates that don't support
 *     // scripted playback may omit). The bot resolves the controller
 *     // for the current region's substrate and calls methods directly,
 *     // bypassing the eventBus. Returning null means "no panel mounted
 *     // / no controller available" and the bot should no-op.
 *     getPlaybackController,    // () -> PlaybackController | null
 *
 *     // Build-time — required for substrates that drive procgen
 *     generateRegionCore,       // (input) -> { world, exits_placed, ... }
 *     placeFromItems,           // (world, input) -> { placed_items, placed_obstacles }
 *     placeFromRules,           // (world, input) -> { placed_logic_gates, placed_items, placed_locations }
 *     extractPathsAndObstacles, // (world, opts) -> extracted_rules
 *     serializeWorld,           // (world, extracted, baseObstacleLib, baseItemLib) -> sidecar
 *   }
 *
 * PlaybackController contract (substrate-neutral, used by the playback
 * bot):
 *
 *   {
 *     play(rateHz?),            // start internal clock at given rate
 *     stop(),                   // pause clock
 *     step(),                   // advance one tick
 *     instant(),                // flush remaining work without delay
 *     reset(),                  // return to initial state
 *     setRate(rateHz),          // change clock rate
 *     walkTo(target),           // target = { kind:'location'|'exit'|'tile',
 *                               //            name?, region?, x?, y? }
 *   }
 *
 * Build-time slots are optional. A substrate that only handles
 * runtime playback (e.g. consuming hand-authored sidecars) can
 * register without them; the driver checks for required slots at
 * dispatch time. Likewise, runtime slots are optional for a
 * substrate that only supplies build-time adapters.
 */

class SubstrateRegistry {
    constructor() {
        this.entries = new Map();
    }

    register(entry) {
        if (!entry || typeof entry !== 'object') {
            throw new Error('substrateRegistry.register: entry must be an object');
        }
        if (!entry.id || typeof entry.id !== 'string') {
            throw new Error('substrateRegistry.register: entry.id must be a non-empty string');
        }
        if (this.entries.has(entry.id)) {
            throw new Error(`substrateRegistry.register: substrate '${entry.id}' already registered`);
        }
        this.entries.set(entry.id, entry);
    }

    get(id) {
        return this.entries.get(id);
    }

    has(id) {
        return this.entries.has(id);
    }

    getAll() {
        return [...this.entries.values()];
    }

    // Test-only: drop all registrations so a fresh state can be built up.
    clear() {
        this.entries.clear();
    }
}

export const substrateRegistry = new SubstrateRegistry();
