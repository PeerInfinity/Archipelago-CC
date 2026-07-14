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
 * Requirement-aware sphere instantiate (region-library F6c, tile/maze). The sphere
 * analogue of instantiateTileGridLibraryEntry: where the spiral hook fills a
 * sides-only slot, the sphere driver needs SPECIFIC sides (the entrance mirrored
 * from the parent's placed exit, plus each child's side) and hands every CHILD exit
 * an access GATE. Returns a FULL region descriptor (unlike bounce/runner's
 * zoneRules) — the engine (buildSphereLibraryRegion) branches on region shape and
 * overlays the child gates onto extracted_rules.exits directly.
 *
 * Connection is BEST-EFFORT by default (plan §4 F6c; user ruling 2026-07-14): the
 * hook ATTEMPTS to align each child opening to the needed wall (and keeps tiles),
 * and FALLS BACK to a relabelled, side-based connection when it can't — it never
 * throws in the default mode. Two regionParams flags, both DEFAULT OFF ("don't
 * require"), turn the attempt into a hard requirement:
 *
 *   - mazeRequireSameWall — OFF (default): prefer a captured opening already on the
 *     needed wall (aligned); fall back to relabelling any leftover opening onto the
 *     side (the maze analogue of bounce's moveSphereExitSide — the physical hole
 *     stays put, the connection is side-based via stitchGrid, logic-looser-than-
 *     physics). ON: a child side MUST be served by a same-wall opening, else throw.
 *   - mazeRequireTileAlign — OFF (default): keep the captured opening's tile (the
 *     child region mirrors its own entrance from this exit tile, so child links stay
 *     physically coherent; the connection is side-based regardless). ON: the opening
 *     must sit at the grid-mirror tile — a CAPTURED maze's holes are fixed, so exact
 *     alignment would need an exit-carve (out of scope), and ON therefore throws.
 *
 * These flags touch ONLY this hook; generated-maze output never reads them, so the
 * default flip is byte-inert for every non-library path. The ENTRANCE side carries
 * no forward exit here — the driver's guaranteed back-portal (applySphereBackExit)
 * provides the return route to the parent. Slots take the node's items in order
 * (filler on the surplus). Draws no rng (captured positions).
 *
 * @param entry  the maze library entry
 * @param ctx    { region_id, exitSides, locationSpecs, fillerItem, regionParams }
 *   exitSides     — sides this region needs (entrance FIRST, then child sides).
 *   locationSpecs — [{ item }] the node's items to place, in order.
 *   fillerItem    — engine filler stamped on captured slots beyond the node items.
 *   regionParams  — world-level params (mazeRequireSameWall / mazeRequireTileAlign).
 * @param deps   { deserialize, extract, substrate }
 * @returns a region descriptor (playable_payload + exits Map + extracted_rules + …)
 */
export function instantiateTileGridLibraryEntryForSpecs(entry, ctx = {}, deps) {
    const { deserialize, extract, substrate } = deps;
    const region_id = ctx.region_id ?? entry.entry_id;
    const neededSides = ctx.exitSides ?? [];
    const locationSpecs = ctx.locationSpecs ?? [];
    const fillerItem = ctx.fillerItem ?? null;
    const regionParams = ctx.regionParams ?? {};
    const requireSameWall = regionParams.mazeRequireSameWall === true; // default OFF
    const requireTileAlign = regionParams.mazeRequireTileAlign === true; // default OFF

    if (requireTileAlign) {
        throw new Error(
            `instantiateLibraryEntryForSpecs(${substrate}): a captured tile region cannot `
            + 'satisfy mazeRequireTileAlign — its openings sit at fixed captured tiles, and '
            + 'grid-mirror alignment would need an exit-carve (out of scope). Leave '
            + 'mazeRequireTileAlign off (the default) for best-effort sphere-growth reuse.');
    }

    // Entrance side is served by the driver's back-portal (applySphereBackExit); only
    // the CHILD sides need a forward opening here.
    const childSides = neededSides.slice(1);

    const world = deserialize(entry.payload);
    // Reset stitching identity on every exit — targets resolved fresh by stitchGrid.
    for (const ex of world.exits.values()) {
        ex.targetRegion = null;
        ex.targetExitId = null;
        ex.isBackExit = false;
        ex.isTeleporter = false;
        ex.exitName = ex.exit_id;
    }
    const capturedExits = [...world.exits.values()];

    // Assign a captured opening to each needed child side, BEST-EFFORT: first give
    // each side an opening ALREADY on that wall (aligned), then — unless same-wall is
    // required — relabel leftover openings onto the still-unserved sides (fallback).
    const assigned = new Map(); // exit_id -> new side
    const usedIds = new Set();
    const bySide = new Map();
    for (const ex of capturedExits) {
        if (!bySide.has(ex.side)) bySide.set(ex.side, []);
        bySide.get(ex.side).push(ex);
    }
    const unmatched = [];
    // Pass 1: aligned (same-wall) assignment.
    for (const side of childSides) {
        const pool = bySide.get(side);
        if (pool && pool.length) {
            const ex = pool.shift();
            assigned.set(ex.exit_id, side);
            usedIds.add(ex.exit_id);
        } else {
            unmatched.push(side);
        }
    }
    // Pass 2: fall back to relabelling leftover openings (unless same-wall required).
    if (unmatched.length) {
        if (requireSameWall) {
            throw new Error(
                `instantiateLibraryEntryForSpecs(${substrate}): entry '${entry.entry_id}' has `
                + `no captured opening on wall(s) [${unmatched.join(',')}] (mazeRequireSameWall `
                + `is ON; captured sides [${[...bySide.keys()].join(',')}]). Leave `
                + 'mazeRequireSameWall off to relabel a captured opening onto any needed side.');
        }
        const leftover = capturedExits.filter((ex) => !usedIds.has(ex.exit_id));
        if (leftover.length < unmatched.length) {
            throw new Error(
                `instantiateLibraryEntryForSpecs(${substrate}): entry '${entry.entry_id}' offers `
                + `${capturedExits.length} captured opening(s) but the slot needs `
                + `${childSides.length} child side(s) [${childSides.join(',')}]`);
        }
        unmatched.forEach((side, i) => {
            const ex = leftover[i];
            assigned.set(ex.exit_id, side);
            usedIds.add(ex.exit_id);
        });
    }

    // Prune the openings we didn't assign (their holes stay as geometry but they are
    // NOT routing exits — no neighbour to route to), and relabel the assigned ones
    // onto their needed side. The captured TILE is kept (tile-align off).
    for (const ex of capturedExits) {
        if (assigned.has(ex.exit_id)) ex.side = assigned.get(ex.exit_id);
        else world.exits.delete(ex.exit_id);
    }

    const extracted = extract(world, { regionId: region_id });
    // Re-stamp location slots to region-namespaced ids (deterministic order) and
    // assign the node's items in order; surplus slots take the engine filler so the
    // pool balances 1:1 with locations.
    const locs = [...extracted.locations].sort(byPosition);
    if (locationSpecs.length > locs.length) {
        throw new Error(
            `instantiateLibraryEntryForSpecs(${substrate}): entry '${entry.entry_id}' has `
            + `${locs.length} location slot(s) but the node needs ${locationSpecs.length}`);
    }
    locs.forEach((loc, i) => {
        loc.id = `${region_id}__slot_${i}`;
        loc.item = i < locationSpecs.length ? locationSpecs[i].item : fillerItem;
    });
    extracted.locations = locs;

    const exits_placed = [...world.exits.values()].map((e) => ({
        exit_id: e.exit_id, side: e.side, tile_position: { x: e.x, y: e.y },
    }));
    return {
        substrate,
        region_id,
        playable_payload: world,
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
