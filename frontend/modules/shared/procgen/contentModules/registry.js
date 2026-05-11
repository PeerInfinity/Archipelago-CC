/**
 * Content-module registry. A content module declares optional hooks
 * for adding gameplay content (hazards, block-pushing puzzles, etc.)
 * to a substrate region without modifying core substrate code. Each
 * module registers itself at module load time; substrates resolve
 * them by id and call whichever hooks are present.
 *
 * Plan: NewDocs/plans/procedural-generation/maze-content-modules.md
 * (Phase 2). The registry sits alongside mazeAlgorithms/registry.js
 * (wall-generation backends) and shares its registration shape.
 *
 * Hook contract (all optional):
 *
 *   generate(world, opts, rng)
 *     Place the module's content on `world` during procgen. Pure
 *     w.r.t. anything outside `world`. Called after wall layout +
 *     obstacle/item placement.
 *
 *   serialize(world)
 *     Return the module's per-region sidecar payload (plain JSON).
 *
 *   deserialize(sidecar, world)
 *     Attach the module's state to a `world` constructed at runtime
 *     from a saved sidecar.
 *
 *   tickRuntime(world, state, dt)
 *     Advance the module's state by one turn (player move / wait /
 *     locationCheck). `dt` is informational only — content runs on
 *     turn boundaries, not real time.
 *
 *   validateMove(world, state, fromXY, toXY)
 *     Return true to allow the player's proposed move, false to
 *     block. Called BEFORE the move executes. Multiple modules'
 *     vetoes are conjunctive.
 *
 *   onMove(world, state, fromXY, toXY)
 *     Side effects on a player move (e.g., block displacement).
 *     Called AFTER the move executes if validateMove allowed it.
 *
 *   render(ctx, world, state)
 *     Canvas overlay rendering. Called after the substrate's main
 *     render, before the player sprite.
 *
 *   resetOnEntry(world, state)
 *     Reset the module's state to its initial configuration. Called
 *     on every region entry (manual or loops-driven). Region content
 *     is per-visit-fresh in v1 per the plan's region-reset model.
 *
 * Optional schema fields:
 *
 *   procgenSettingsSchema  - per-region authoring controls (e.g.
 *                             hazardCount). Auto-generated UI for v1.
 *   runtimeSettingsSchema  - per-player runtime controls. Reserved
 *                             for later modules.
 */

const VALID_HOOKS = [
    'generate',
    'serialize',
    'deserialize',
    'tickRuntime',
    'validateMove',
    'onMove',
    'render',
    'resetOnEntry',
];

const SCHEMA_KEYS = [
    'procgenSettingsSchema',
    'runtimeSettingsSchema',
];

const registry = new Map();

/**
 * Register a content module. Validates that `id` is a non-empty
 * string and unique, that any provided hooks are functions, and
 * that any provided schemas are plain objects. Throws on violation.
 *
 * Modules are stored by reference — callers retain ownership.
 *
 * @param {object} module
 */
export function registerContentModule(module) {
    if (!module || typeof module !== 'object') {
        throw new Error('registerContentModule: module must be an object');
    }
    if (typeof module.id !== 'string' || module.id.length === 0) {
        throw new Error('registerContentModule: module must have a non-empty string id');
    }
    if (registry.has(module.id)) {
        throw new Error(`registerContentModule: duplicate id '${module.id}'`);
    }
    for (const hook of VALID_HOOKS) {
        if (module[hook] !== undefined && typeof module[hook] !== 'function') {
            throw new Error(
                `registerContentModule: '${module.id}'.${hook} must be a function (or omitted)`,
            );
        }
    }
    for (const key of SCHEMA_KEYS) {
        if (module[key] === undefined) continue;
        if (typeof module[key] !== 'object' || module[key] === null || Array.isArray(module[key])) {
            throw new Error(
                `registerContentModule: '${module.id}'.${key} must be a plain object (or omitted)`,
            );
        }
    }
    registry.set(module.id, module);
}

/**
 * Resolve a module by id, or null if not registered.
 */
export function getContentModule(id) {
    return registry.get(id) ?? null;
}

/**
 * Return all registered modules. Array order matches insertion
 * order (stable per Map semantics).
 */
export function listContentModules() {
    return [...registry.values()];
}

/**
 * Return true if a module with this id is registered.
 */
export function hasContentModule(id) {
    return registry.has(id);
}

// Test-only — clear the registry between tests. Production code
// never calls this. Mirrors the mazeAlgorithms registry helper.
export function _testOnly_clearRegistry() {
    registry.clear();
}
