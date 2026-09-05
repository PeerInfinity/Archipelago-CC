/**
 * mazeRoom/mazeSerializer — **THE MAZE'S OWN SIDECAR SERIALIZER**
 * (APWORLD EDITOR HUB slice H3b; ⚖ user 2026-09-05, *"I prefer the cleaner
 * option, not the quicker option."*).
 *
 * `serializeMazeWorld` WAS `procgenPipeline/procgenPipelineEngine.js:2391`,
 * while its exact inverse `deserializeMazeWorld` has always lived in
 * `mazeRoomEngine.js` — whose header still calls itself the inverse of this
 * function. The dependency ran BACKWARDS: the maze module imported the
 * pipeline engine to get its own serializer (`mazeSetAdapter.js`, three maze
 * tests), and `shared/procgen/adapterPrimitives.js` — a SUBMODULE — reached out
 * of itself into `../../procgenPipeline/` for it while taking the deserializer
 * from `../../mazeRoom/`. H3b turned that around; the outer engine now imports
 * nothing from `mazeRoom/` at all.
 *
 * ⛔ **THIS IS ITS OWN FILE AND NOT PART OF `mazeRoomEngine.js`.** `mazeGeometry.js`
 * imports `isFloor` FROM `mazeRoomEngine.js`, so an engine that imported
 * `computeLongestShortestPath` back from `mazeGeometry.js` would close a
 * module cycle. ES modules tolerate one for call-time use; a third file that
 * imports both and is imported by neither does not need the tolerance.
 *
 * ⛔ **A MOVE CHANGES NO BYTE.** Every committed `preset_sidecars` payload is
 * this function's output. The gates are the four
 * `scripts/procgen/dump-*-byteidentity.mjs` oracles and a re-emit diff against
 * the committed presets; `mazeSerializer.test.js` drives the function directly.
 */

import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { computeLongestShortestPath } from './mazeGeometry.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';

// Serialize a maze world into the sidecar payload shape. Maps and
// Int8Array aren't JSON-safe, so this flattens them. AP-canonical
// names from the extracted_rules are baked in so the substrate panel
// can publish user:locationCheck and user:regionMove with the right
// names without consulting any other lookup at runtime.
export function serializeMazeWorld(world, extractedRules, baseObstacleLib = DEFAULT_OBSTACLES, baseItemLib = DEFAULT_ITEMS) {
    const obstacles = [];
    for (const [key, id] of world.obstacles) {
        const [x, y] = key.split(',').map(Number);
        obstacles.push({ x, y, id });
    }

    // Lookup: position key "x,y" -> AP-canonical location name. Built
    // from the extracted location list, which already names each item
    // pickup. The lookup is keyed by position because that's how each
    // item maps back to its location entry.
    const locationNameByPos = new Map();
    for (const loc of extractedRules?.locations ?? []) {
        if (!loc.position) continue;
        const key = `${loc.position.x},${loc.position.y}`;
        const name = loc.global_name
            ?? makeLocationName(extractedRules.region_id, loc.id, loc.position);
        locationNameByPos.set(key, name);
    }

    const items = [];
    for (const [key, id] of world.items) {
        const [x, y] = key.split(',').map(Number);
        items.push({ x, y, id, locationName: locationNameByPos.get(key) ?? null });
    }

    // Bake in each exit's AP-canonical name and target region. The
    // sidecar carries the multi-exit `exits` array; deserializeMaze-
    // World builds world.exits back from it. (Old single-exit
    // sidecars used `exit: {...}`; the deserializer accepts both.)
    const extractedExitsById = new Map();
    for (const e of extractedRules?.exits ?? []) {
        extractedExitsById.set(e.id, e);
    }
    const exitsOut = [];
    for (const e of world.exits.values()) {
        const ext = extractedExitsById.get(e.exit_id);
        exitsOut.push({
            exit_id: e.exit_id,
            x: e.x,
            y: e.y,
            side: e.side,
            exitName: ext?.id ?? e.exitName ?? null,
            targetRegion: ext?.target_region ?? e.targetRegion ?? null,
            // Bidirectional metadata — lets the procgen player resolve
            // which exit_id to spawn at on the other side, and lets the
            // panel render back-exits / teleporters distinctly.
            targetExitId: e.targetExitId ?? null,
            isBackExit: e.isBackExit ?? false,
            isTeleporter: e.isTeleporter ?? false,
        });
    }

    // Only include obstacleLib / itemLib entries that aren't already
    // in the base library. Standard colored doors and the maze's own
    // keys live in the base; per-instance logic_gate_<N> entries
    // (from placeFromRules) and any foreign-item metadata baked in
    // by a top-down driver need to travel in the sidecar so the
    // compiler / renderer / runtime can look them up.
    const obstacleLibExtras = {};
    for (const [id, def] of Object.entries(world.obstacleLib || {})) {
        if (!(id in baseObstacleLib)) {
            obstacleLibExtras[id] = def;
        }
    }
    const itemLibExtras = {};
    for (const [id, def] of Object.entries(world.itemLib || {})) {
        if (!(id in baseItemLib)) {
            itemLibExtras[id] = def;
        }
    }
    // Geometric property used by loop-mode mana hooks: the longest of
    // the pairwise shortest paths among (entrance, ...exits). Combined
    // with baseRegionCost from loop_costs at runtime to derive a
    // per-tile move cost: moveCost = baseRegionCost / longestShortestPath.
    // Always computed (cheap BFS over the tile grid); the runtime
    // ignores it when manaEnabled is off.
    const longestShortestPath = computeLongestShortestPath(world);

    // Hazards (Phase 2). Each entry is the IMMUTABLE shape — the
    // runtime initializes phase to 0 in deserializeMazeWorld. Stored
    // entries strip phase + any other mutable runtime state per the
    // strip-progress-on-save convention.
    const hazardsOut = Array.isArray(world.hazards) && world.hazards.length > 0
        ? world.hazards.map((h) => ({
            shape: h.shape,
            length: h.length,
            tiles: h.tiles.map((t) => ({ x: t.x, y: t.y })),
            cycleLength: h.cycleLength,
        }))
        : null;

    // Cross-game consumable tiles (X1). Both overlays serialize as
    // position-keyed arrays and are OMITTED ENTIRELY when empty — the
    // same conditional-spread discipline as hazards above, which is what
    // keeps every pre-X1 preset sidecar byte-identical.
    const consumableTilesOut = world.consumableTiles?.size > 0
        ? [...world.consumableTiles].map(([key, g]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, substrate: g.substrate, type: g.type, count: g.count };
        })
        : null;
    const manaTilesOut = world.manaTiles?.size > 0
        ? [...world.manaTiles].map(([key, amount]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, amount };
        })
        : null;

    return {
        width: world.width,
        height: world.height,
        tiles: Array.from(world.tiles),
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits: exitsOut,
        obstacles,
        items,
        obstacleLib: obstacleLibExtras,
        itemLib: itemLibExtras,
        longestShortestPath,
        ...(hazardsOut ? { hazards: hazardsOut } : {}),
        ...(consumableTilesOut ? { consumableTiles: consumableTilesOut } : {}),
        ...(manaTilesOut ? { manaTiles: manaTilesOut } : {}),
    };
}
