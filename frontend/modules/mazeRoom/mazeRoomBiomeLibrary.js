/**
 * Maze biome library — named bundles of (backend, params,
 * post-processors) that the substrate looks up by id when generating
 * a region. Per-region biome selection lives in
 * `preset_sidecars[player][region].biome` of rules.json; the substrate
 * falls back to `DEFAULT_BIOME_ID` when no biome is specified.
 *
 * Adding a new biome that uses an existing backend is a one-line
 * change here. Adding a new backend is a new file under
 * `mazeAlgorithms/` plus an entry there.
 *
 * Tree-based biomes (branchy, bushy, loopy, open, rooms) and the
 * post-processors they use (braid, pruneDeadEnds) land in a
 * follow-up commit alongside their backends.
 *
 * See NewDocs/plans/procedural-generation/maze-biomes.md.
 */

export const BIOMES = Object.freeze({
    empty: Object.freeze({
        name: 'Empty',
        description: 'No walls — just entrance and exits. Showcases the topology layer.',
        backend: 'empty',
    }),
    classic: Object.freeze({
        name: 'Classic',
        description: 'Uniform random wall proposals with a feasibility check. The original v1 generator.',
        backend: 'random_walls',
    }),
    corridor: Object.freeze({
        name: 'Corridor',
        description: 'Shortest path from entrance to each exit; everything else is wall.',
        backend: 'corridor_only',
    }),
});

export const DEFAULT_BIOME_ID = 'classic';

/**
 * Resolve a biome reference to its definition + merged params.
 *
 * Input:
 *   `null` / `undefined`         → DEFAULT_BIOME_ID with no overrides
 *   `{ id }`                     → that biome with no overrides
 *   `{ id, paramsOverride }`     → that biome with per-key overrides
 *                                   on top of biome.params
 *
 * Output:
 *   { id, biome, params }
 *
 * Throws if `id` doesn't match a known biome — unknown biomes should
 * never reach the substrate, and silently swapping in the default
 * would mask bugs in the rules-export side.
 */
export function resolveBiome(input) {
    const id = input?.id ?? DEFAULT_BIOME_ID;
    const biome = BIOMES[id];
    if (!biome) {
        const known = Object.keys(BIOMES).join(', ');
        throw new Error(`resolveBiome: unknown biome id '${id}' (known: ${known})`);
    }
    return {
        id,
        biome,
        params: { ...(biome.params ?? {}), ...(input?.paramsOverride ?? {}) },
    };
}
