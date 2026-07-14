// Bounce region-library entry hooks (region-library F2) — the capture /
// instantiate / validate implementation for the CONTENT (zone) capture contract.
//
// Unlike a tile substrate, a bounce region's geometry cannot be re-derived from
// a serialized world (there is no path extractor for zone substrates — see
// rebuildEnvelopeFromRulesJson). So a bounce entry CARRIES its emitted rules
// verbatim (carried_rules: the by-side exit paths/rules, the location rules, and
// the obstacle defs) alongside the level payload. Instantiation re-assembles the
// synthetic-exit region via the engine's assembleZoneRegion — the same shape the
// bounce extractZoneRules channel produces today.
//
// v1 placement fit is subset-only (the slot's required sides ⊆ the entry's
// captured sides), so NO geometry relabel is needed: every requested side already
// has a captured portal/rule. A slot needing a side the entry lacks fails loudly.
// (The moveSphereExitSide relabel the plan mentions would only be needed to lift
// that constraint — deferred with F6.) Instantiate draws no rng.

import { assembleZoneRegion } from '../procgenPipeline/procgenPipelineEngine.js';

// exit_<side> → side (assembleZoneRegion's synthetic exit id convention).
function sideOfExitId(id) {
    return typeof id === 'string' && id.startsWith('exit_') ? id.slice(5) : null;
}

/**
 * Capture a live bounce region descriptor into a library entry.
 * @param region  the assembled region (playable_payload = buildZonePayload output)
 * @param meta    { entry_id?, name? }
 * @param deps    unused (kept for signature symmetry with the tile hook)
 */
export function captureBounceLibraryEntry(region, meta = {}) {
    const pp = region?.playable_payload ?? {};
    const params = pp.params ?? {};
    const level = params.bounceLevel;
    const sidePortals = params.sidePortals ?? {};
    if (!level || Object.keys(sidePortals).length === 0) {
        throw new Error('captureLibraryEntry(bounce): region.playable_payload lacks params.bounceLevel/sidePortals');
    }
    const er = region.extracted_rules ?? {};
    const exit_sides = Object.keys(sidePortals);

    // Reconstruct the by-side rule bundle from the assembled region.
    const exitPaths = {};
    const exitRules = {};
    for (const ex of er.exits ?? []) {
        const side = sideOfExitId(ex.id);
        if (!side) continue;
        if (ex.paths) exitPaths[side] = ex.paths;
        if (ex.access_rule) exitRules[side] = ex.access_rule;
    }
    const locations = (er.locations ?? []).map((l) => ({
        id: l.id,
        item: l.item ?? null,
        ...(l.access_rule ? { access_rule: l.access_rule } : {}),
        ...(l.paths ? { paths: l.paths } : {}),
        position: l.position ?? null,
    }));
    const carried_rules = {
        locations,
        exitPaths,
        ...(Object.keys(exitRules).length ? { exitRules } : {}),
        obstacleDefs: region.obstacle_defs ?? {},
    };
    return {
        entry_id: meta.entry_id ?? region.region_id,
        ...(meta.name ? { name: meta.name } : {}),
        substrate: 'bounce',
        exit_sides,
        payload: {
            bounceLevel: level,
            sidePortals,
            physicsProfile: params.physics?.profile ?? 'experimental',
        },
        carried_rules,
        location_slots: locations.length,
    };
}

/**
 * Instantiate a bounce library entry into a fresh region descriptor.
 * @param entry  the library entry
 * @param ctx    { region_id, exitSides?, regionSize?, rng? } — rng UNUSED
 * @param deps   { buildZonePayload }
 */
export function instantiateBounceLibraryEntry(entry, ctx = {}, deps) {
    const { buildZonePayload } = deps;
    const region_id = ctx.region_id ?? entry.entry_id;
    const exitSides = ctx.exitSides ?? entry.exit_sides;
    const entrySides = new Set(entry.exit_sides);
    for (const s of exitSides) {
        if (!entrySides.has(s)) {
            throw new Error(
                `instantiateLibraryEntry(bounce): slot needs side '${s}' but entry `
                + `'${entry.entry_id}' only offers [${entry.exit_sides.join(',')}]`);
        }
    }
    const cr = entry.carried_rules ?? {};
    const exitRules = {};
    const exitPaths = {};
    for (const s of exitSides) {
        if (cr.exitPaths?.[s]) exitPaths[s] = cr.exitPaths[s];
        if (cr.exitRules?.[s]) exitRules[s] = cr.exitRules[s];
    }
    const { bounceLevel, sidePortals, physicsProfile } = entry.payload;
    const payload = buildZonePayload(region_id, bounceLevel, sidePortals, physicsProfile ?? 'experimental');
    const zoneRules = {
        locations: (cr.locations ?? []).map((l) => ({ ...l })),
        ...(Object.keys(exitRules).length ? { exitRules } : {}),
        ...(Object.keys(exitPaths).length ? { exitPaths } : {}),
        obstacleDefs: cr.obstacleDefs ?? {},
        payload,
    };
    return assembleZoneRegion({
        substrate: 'bounce', region_id, regionSize: ctx.regionSize, exitSides, zoneRules, zonePayload: {},
    });
}

// side -> level portal direction arrow (mirrors SIDE_DIRECTIONS in
// bounceDemoLibrary / DIRECTIONS in sideExits; duplicated here to avoid a
// circular import, since bounceDemoLibrary imports this module).
const SIDE_DIRECTIONS = { N: 'up', S: 'down', E: 'right', W: 'left' };

/**
 * Requirement-aware sphere instantiate (region-library F6a). Where the spiral
 * hook (instantiateBounceLibraryEntry) fills a sides-only slot, the sphere driver
 * needs SPECIFIC sides (the entrance mirrored from the parent's placed exit, plus
 * each child's side) and hands every exit an access GATE. A bounce entry's
 * sidePortals are re-keyable — the side is just the linking key, the portal
 * geometry is independent (moveSphereExitSide is a relabel) — so this RELABELS the
 * captured portals onto the requested sides BY INDEX, reassigns the node's items
 * onto the captured pickup slots (filler on the surplus), and returns
 * GEOMETRY-ONLY zoneRules.
 *
 * It deliberately emits NO exit rules: the engine composes the gate as an
 * access_rule OVERLAY on the exit (logic-looser-than-physics, the jta contract).
 * F6a does NOT re-derive/verify the captured level against the new gates — the
 * level is reused as pure playable geometry and the AP LOGIC enforces the gate
 * (the region is "walkable past" it at runtime). Physical enforcement where the
 * entry can host is F6b. Instantiate draws no rng.
 *
 * @param entry  the bounce library entry
 * @param ctx    { region_id, regionSize, exitSides, locationSpecs, fillerItem }
 *   exitSides     — the sides this region needs (entrance + child sides), ORDERED;
 *                   mapped by index onto the entry's captured portals.
 *   locationSpecs — [{ item }] the node's items to place, in order.
 *   fillerItem    — engine filler stamped on captured slots beyond the node items.
 * @param deps   { buildZonePayload }
 * @returns { locations, payload, obstacleDefs }  (no exit rules — engine overlays)
 */
export function instantiateLibraryEntryForSpecs(entry, ctx = {}, deps) {
    const { buildZonePayload } = deps;
    const region_id = ctx.region_id ?? entry.entry_id;
    const exitSides = ctx.exitSides ?? [];
    const locationSpecs = ctx.locationSpecs ?? [];
    const fillerItem = ctx.fillerItem ?? null;

    const capturedPortals = entry.payload?.sidePortals ?? {};
    const capturedSides = Object.keys(capturedPortals);
    if (capturedSides.length < exitSides.length) {
        throw new Error(
            `instantiateLibraryEntryForSpecs(bounce): entry '${entry.entry_id}' offers `
            + `${capturedSides.length} portal(s) [${capturedSides.join(',')}] but the slot `
            + `needs ${exitSides.length} side(s) [${exitSides.join(',')}]`);
    }
    const capturedSlots = entry.carried_rules?.locations ?? [];
    if (locationSpecs.length > capturedSlots.length) {
        throw new Error(
            `instantiateLibraryEntryForSpecs(bounce): entry '${entry.entry_id}' has `
            + `${capturedSlots.length} location slot(s) but the node needs `
            + `${locationSpecs.length}`);
    }

    // Relabel: map each requested side onto a captured portal (by declaration
    // index), re-key sidePortals, and point the portal's direction arrow at the
    // new side. Surplus captured portals stay in the level geometry but are
    // dropped from sidePortals (inert — no neighbour to route to; the level stays
    // navigable). Clone the level so the shared entry template is never mutated.
    const level = structuredClone(entry.payload.bounceLevel);
    const portalsById = new Map((level.portals ?? []).map((p) => [p.id, p]));
    const sidePortals = {};
    for (let i = 0; i < exitSides.length; i++) {
        const side = exitSides[i];
        const portalId = capturedPortals[capturedSides[i]];
        sidePortals[side] = portalId;
        const portal = portalsById.get(portalId);
        if (portal) portal.direction = SIDE_DIRECTIONS[side];
    }

    const payload = buildZonePayload(
        region_id, level, sidePortals, entry.payload.physicsProfile ?? 'experimental');

    // Reassign items onto the captured slots: the k-th node item takes the k-th
    // captured pickup slot (id + geometry preserved so the payload's ap_locations
    // still resolves the pickup); surplus slots take the engine filler so the item
    // pool balances 1:1 with locations. Pure geometry — no access_rule (the engine
    // overlays each GATE onto the EXIT, and locations are ungated in v1).
    const locations = capturedSlots.map((slot, k) => ({
        id: slot.id,
        item: k < locationSpecs.length ? locationSpecs[k].item : fillerItem,
        position: slot.position ?? null,
        ...(slot.paths ? { paths: slot.paths } : {}),
    }));

    return { locations, payload, obstacleDefs: entry.carried_rules?.obstacleDefs ?? {} };
}

/**
 * Capability-vs-payload revalidation (the F1 validator's entryCapabilityCheck).
 */
export function validateBounceLibraryEntry(entry) {
    const errors = [];
    const p = entry.payload ?? {};
    if (!p.bounceLevel) errors.push('payload.bounceLevel missing');
    const spSides = Object.keys(p.sidePortals ?? {}).sort();
    const declared = [...(entry.exit_sides ?? [])].sort();
    if (JSON.stringify(spSides) !== JSON.stringify(declared)) {
        errors.push(`exit_sides [${declared.join(',')}] contradict payload sidePortals sides [${spSides.join(',')}]`);
    }
    const cr = entry.carried_rules;
    if (cr == null || typeof cr !== 'object') {
        errors.push('carried_rules must be present (bounce geometry is not re-derivable)');
    } else if ((cr.locations?.length ?? 0) !== entry.location_slots) {
        errors.push(`location_slots ${entry.location_slots} != carried_rules.locations count ${cr.locations?.length ?? 0}`);
    }
    return { errors };
}
