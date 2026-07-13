// Tile-grid region-library entry hooks (region-library F2) — the capture /
// instantiate / validate implementation for the PROCEDURAL (tile) capture
// contract, composed by mazeRoomLibrary (and reusable by any tile-grid substrate
// sharing the maze world model — text_adventure could adopt it later).
//
// The tile capture contract (plan §2a): an entry stores the serialized world
// (payload) ONLY, carried_rules null, because the geometry is re-derivable —
// instantiation deserializes the world and RE-EXTRACTS exits/locations
// (deserializeWorld + extractPathsAndObstacles), so the rules can never go stale
// against the geometry. This is the same re-import path rebuildEnvelopeFromRulesJson
// already uses for procedural substrates.
//
// Instance identity is stripped at capture (exit stitching targets, item
// assignments) and re-stamped at instantiate (region-namespaced slot ids). No
// rng is drawn on either side: instantiation reuses the captured slot POSITIONS
// (keeping the spiral ③ step deterministic — the plan's rng-free-instantiate
// discipline).

// Deterministic slot order: top-to-bottom, left-to-right.
function byPosition(a, b) {
    return (a.position.y - b.position.y) || (a.position.x - b.position.x);
}

function sideOf(exit) {
    return exit.side;
}

/**
 * Capture a live tile-grid region descriptor into a library entry.
 * @param region  the region object (playable_payload is the tile world)
 * @param meta    { entry_id?, name? } author-facing identity
 * @param deps    { serialize, extract, substrate }
 */
export function captureTileGridLibraryEntry(region, meta = {}, deps) {
    const { serialize, extract, substrate } = deps;
    const world = region?.playable_payload;
    if (!world || !(world.exits instanceof Map)) {
        throw new Error(`captureLibraryEntry(${substrate}): region.playable_payload is not a tile-grid world`);
    }
    const extracted = region.extracted_rules ?? extract(world, { regionId: region.region_id });
    const sidecar = serialize(world, extracted);

    // Strip instance identity: exit stitching targets + back/teleporter flags
    // (resolved fresh by stitchGrid on instantiate).
    for (const ex of sidecar.exits ?? []) {
        ex.targetRegion = null;
        ex.targetExitId = null;
        ex.isBackExit = false;
        ex.isTeleporter = false;
        ex.exitName = ex.exit_id;
    }
    // Reduce placed items to instance-free location SLOTS: keep POSITION (the
    // geometry), drop the item assignment (the engine owns items on instantiate).
    // Slot ids are positional + stable so capture/instantiate agree.
    const slots = (sidecar.items ?? [])
        .map((it) => ({ x: it.x, y: it.y }))
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));
    sidecar.items = slots.map((s, i) => ({
        x: s.x, y: s.y, id: `slot_${i}`, locationName: null,
    }));

    const exit_sides = [...new Set((sidecar.exits ?? []).map(sideOf))];
    return {
        entry_id: meta.entry_id ?? region.region_id,
        ...(meta.name ? { name: meta.name } : {}),
        substrate,
        region_size: { width: world.width, height: world.height },
        exit_sides,
        payload: sidecar,
        carried_rules: null,
        location_slots: slots.length,
    };
}

/**
 * Instantiate a tile-grid library entry into a fresh region descriptor.
 * @param entry  the library entry
 * @param ctx    { region_id, exitSides?, regionSize?, rng? } — rng UNUSED
 * @param deps   { deserialize, extract, substrate }
 * Returns a region descriptor shaped like buildSubstrateRegion's output, so the
 * spiral driver's grid.placeRegion / stitchGrid / buildPresetSidecars consume it
 * uniformly. Surplus exits (sides the slot doesn't need) are left on the world
 * and closed by the driver's wallOffUnusedExits, exactly like a grown region.
 */
export function instantiateTileGridLibraryEntry(entry, ctx = {}, deps) {
    const { deserialize, extract, substrate } = deps;
    const region_id = ctx.region_id ?? entry.entry_id;
    const world = deserialize(entry.payload);
    // Reset stitching identity on the live exits — targets resolved by stitchGrid.
    for (const ex of world.exits.values()) {
        ex.targetRegion = null;
        ex.targetExitId = null;
        ex.isBackExit = false;
        ex.isTeleporter = false;
    }
    const extracted = extract(world, { regionId: region_id });
    // Re-stamp location slots to region-namespaced ids (deterministic order);
    // item is left null — the engine assigns items to these slots.
    const locs = [...extracted.locations].sort(byPosition);
    locs.forEach((loc, i) => {
        loc.id = `${region_id}__slot_${i}`;
        loc.item = null;
    });
    extracted.locations = locs;

    const exits_placed = [...world.exits.values()].map((e) => ({
        exit_id: e.exit_id, side: e.side, tile_position: { x: e.x, y: e.y },
    }));
    return {
        substrate,
        region_id,
        playable_payload: world,
        // Maze ALIASES its world's exits Map + entrance (Phase 4c), same as
        // buildSubstrateRegion — stitch/back-exit mutations reach the world.
        exits: world.exits,
        entrance: world.entrance,
        extracted_rules: extracted,
        placed_items: [],
        placed_obstacles: [],
        exits_placed,
        render_hint: substrate,
        sidecar_filename: `${region_id}.json`,
        wall_stats: null,
        biome: world.biome ?? null,
        grow_telemetry: null,
    };
}

/**
 * Capability-vs-payload revalidation (the F1 validator's entryCapabilityCheck):
 * the denormalized capability metadata (region_size, exit_sides, location_slots)
 * must not lie about the payload. Returns { errors, warnings }.
 */
export function validateTileGridLibraryEntry(entry, deps) {
    const { deserialize } = deps;
    const errors = [];
    let world;
    try {
        world = deserialize(entry.payload);
    } catch (e) {
        return { errors: [`payload failed to deserialize: ${e.message}`] };
    }
    const rs = entry.region_size ?? {};
    if (rs.width !== world.width || rs.height !== world.height) {
        errors.push(`region_size ${rs.width}x${rs.height} contradicts payload ${world.width}x${world.height}`);
    }
    const actual = [...new Set([...world.exits.values()].map((e) => e.side))].sort();
    const declared = [...(entry.exit_sides ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(declared)) {
        errors.push(`exit_sides [${declared.join(',')}] contradict payload exit sides [${actual.join(',')}]`);
    }
    if (entry.location_slots !== world.items.size) {
        errors.push(`location_slots ${entry.location_slots} contradicts payload slot count ${world.items.size}`);
    }
    return { errors };
}
