/**
 * pipelineRoomEdit — **THE PIPELINE'S DOOR INTO A LAB-EDITED ROOM.**
 *
 * The pipeline's Edit ▸ hands a `kind: 'panel'` editor (bounce) the live
 * region and its realiser contract, and that editor answers with a region. A
 * `kind: 'lab'` editor (maze, Seedling) is a lab PAGE: `openLabRoomEditor`
 * takes a SET DOCUMENT (`record`) and room n of it, and refuses anything else
 * (*"A REGION alone is not enough"*). Before this module the pipeline handed it
 * `{region, contract}`, so the door refused every press and the refusal was
 * returned to nobody.
 *
 * ⛓ **THE DOCUMENT IS THE SUBSTRATE'S, BUILT BY THE SAME DECLARATION THE
 * APWORLD EDITOR USES** — `regionRoundTrip.{open, save}` on the registry entry,
 * resolved through the hub's `regionRoundTripOf` (one rule for "which
 * document, and how its save reads back"; this file adds no second
 * construction). What the pipeline adds is only the two ends that are
 * pipeline-shaped:
 *
 *   IN   the region is a LIVE descriptor (a world with Maps), not a sidecar, so
 *        it is serialised by `serializeRegionEntry` — the one writer of a
 *        sidecar entry from a live region — before the round trip sees it.
 *   OUT  the save's payload is read back into a live descriptor the way
 *        `rebuildEnvelopeFromRulesJson` reads a sidecar: `deserializeWorld` →
 *        `extractPathsAndObstacles`. The descriptor keeps everything else the
 *        region carried (cell, render hint, biome, telemetry, placements).
 *
 * ⛓ **THE RULES ARE RE-DERIVED FROM THE EDITED GEOMETRY; THE IDENTITIES ARE
 * CARRIED.** A grown region's extracted locations carry the GROW's location ids
 * (`loc_0`…, or a top-down source name in `global_name`), which a fresh
 * extraction cannot know — it names a location after its item. They come back
 * by TILE, then (for an item the reader moved) by ITEM among the tiles left
 * over; a location the edit ADDED keeps the extraction's own id. MEASURED
 * (2026-10-18, the four shipped maze sphere presets, every maze region round
 * tripped unedited): the recompiled rules.json is byte-identical to the
 * original, so an unedited Save moves nothing.
 */

import { regionRoundTripOf } from '../apworldEditor/regionRoundTrip.js';
import { serializeRegionEntry } from './procgenPipelineEngine.js';
import { deserializeOrRefuse } from '../procgenCore/deserializeRefusal.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';

const tileKey = (p) => (p ? `${p.x},${p.y}` : null);

/**
 * ⛓ The round trip's context for ONE live region — what the hub's
 * `roomContext` hands the same declaration, from the pipeline's side.
 *
 * @param {object} region a live grid region descriptor
 * @param {object} [libs] `{baseItemLib, baseObstacleLib, itemPool, expectedItems}`
 * @returns {Promise<{ok:true, session:object, ctx:object, rt:object}|{ok:false, why:string}>}
 */
export async function openPipelineRoom(region, {
    baseItemLib = DEFAULT_ITEMS, baseObstacleLib = DEFAULT_OBSTACLES,
    itemPool = [], expectedItems = [],
} = {}) {
    const substrate = region?.substrate;
    const regionId = region?.region_id;
    const { rt, why } = regionRoundTripOf(substrate);
    if (!rt) return { ok: false, why };
    const adapter = substrateRegistry.get(substrate);
    if (typeof adapter?.deserializeWorld !== 'function'
            || typeof adapter?.extractPathsAndObstacles !== 'function') {
        return {
            ok: false,
            why: `the "${substrate}" substrate cannot re-derive a region from an edited room `
                + '(it declares no `deserializeWorld` / `extractPathsAndObstacles`), so a save '
                + 'could not be written back into this world.',
        };
    }
    let payload;
    try {
        payload = serializeRegionEntry(region, { baseItemLib, baseObstacleLib }).playable_payload;
    } catch (e) {
        return { ok: false, why: `region ${regionId} could not be serialised — ${e.message}` };
    }
    const ctx = { regionId, payload, region, itemPool, expectedItems };
    let opened;
    try {
        opened = await rt.open(ctx);
    } catch (e) {
        return { ok: false, why: `"${substrate}" refused this region's payload — ${e.message}` };
    }
    return { ok: true, session: opened.session, ctx, rt, libs: { baseItemLib, baseObstacleLib } };
}

/**
 * ⛓ Carry the grown region's location ids (and a top-down `global_name`) onto a
 * fresh extraction: by tile first, then by item among the leftovers.
 */
function carryLocationIdentity(fresh, original) {
    const byTile = new Map();
    for (const loc of original ?? []) {
        const k = tileKey(loc.position);
        if (k) byTile.set(k, loc);
    }
    const unmatched = [];
    const used = new Set();
    for (const loc of fresh) {
        const was = byTile.get(tileKey(loc.position));
        if (was) { stamp(loc, was); used.add(was); } else unmatched.push(loc);
    }
    const free = (original ?? []).filter((l) => !used.has(l));
    for (const loc of unmatched) {
        const i = free.findIndex((l) => l.item === loc.item);
        if (i >= 0) { stamp(loc, free[i]); free.splice(i, 1); }
    }
}

function stamp(loc, was) {
    loc.id = was.id;
    if (was.global_name) loc.global_name = was.global_name;
}

/**
 * ⛓ Read the editor's save back into a live region descriptor.
 *
 * @returns {Promise<{region:object}|{error:string}>}
 */
export async function regionFromPipelineSave(opened, saved) {
    const { rt, ctx, libs } = opened;
    const original = ctx.region;
    const substrate = original.substrate;
    let out;
    try {
        out = await rt.save(saved, ctx);
    } catch (e) {
        return { error: `the "${substrate}" editor's save could not be read back — ${e.message}` };
    }
    const adapter = substrateRegistry.get(substrate);
    const read = deserializeOrRefuse(adapter, out.payload, {
        regionId: ctx.regionId, substrate, opts: libs,
    });
    if (read.refusal) return { error: read.refusal };
    const world = read.world;
    const extracted_rules = adapter.extractPathsAndObstacles(world, { regionId: ctx.regionId });
    carryLocationIdentity(extracted_rules.locations, original.extracted_rules?.locations);
    return {
        region: {
            ...original,
            playable_payload: world,
            extracted_rules,
            exits: world.exits,
            entrance: world.entrance,
        },
    };
}
