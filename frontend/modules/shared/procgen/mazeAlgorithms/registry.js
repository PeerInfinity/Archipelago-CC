/**
 * Maze backend registry. A backend is one wall-generation strategy
 * (random walls, recursive backtracker, Kruskal's, etc.). Backends
 * register themselves at module load time; `getBackend(id)` looks one
 * up by id; the maze substrate dispatches on the id from the active
 * biome's `backend` field.
 *
 * Keeping the registry in shared/procgen rather than mazeRoom/ leaves
 * room for a future grid-based substrate (e.g. a tile-room generator)
 * to register its own backends here. Today only the maze substrate
 * uses it.
 *
 * See NewDocs/plans/procedural-generation/maze-biomes.md.
 */

const registry = new Map();

export function registerBackend(backend) {
    if (!backend || typeof backend.id !== 'string') {
        throw new Error('registerBackend: backend must have a string id');
    }
    if (typeof backend.run !== 'function') {
        throw new Error(`registerBackend: backend '${backend.id}' must have a run function`);
    }
    if (registry.has(backend.id)) {
        throw new Error(`registerBackend: duplicate id '${backend.id}'`);
    }
    registry.set(backend.id, backend);
}

export function getBackend(id) {
    return registry.get(id) ?? null;
}

export function listBackends() {
    return [...registry.values()];
}

export function hasBackend(id) {
    return registry.has(id);
}

// Test-only — drop all registered backends so a test can re-register
// from a clean state. Production code never calls this.
export function _testOnly_clearRegistry() {
    registry.clear();
}
