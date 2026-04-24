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
 * Step 2 of NewDocs/plans/procedural-generation/procgen-player.md.
 * No consumer wired up yet — this commit is the skeleton.
 *
 * Entry shape (informal — see procgen-player.md §"Substrate
 * registry"):
 *
 *   {
 *     id,                   // string, unique
 *     panelComponentType,   // Golden Layout component type the substrate exposes
 *     loadRegionEvent,      // eventBus event name the substrate subscribes to
 *     supportedFeatures,    // array of shared-library feature ids the substrate implements
 *     deserializeWorld,     // (sidecar) -> world  (added in step 4)
 *   }
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
