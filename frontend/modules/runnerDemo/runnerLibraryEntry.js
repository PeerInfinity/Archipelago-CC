// Runner region-library entry hooks (region-library F6c) — the capture /
// instantiate / validate implementation for the CONTENT (zone) capture contract,
// the runner analogue of bounceDemo/bounceLibraryEntry.js.
//
// Runner IS a zone/portal substrate (generateZoneForSpecs / sidePortals /
// backPortalGated, buildZonePayload in runnerDemo/zoneRules.js — the same shape as
// bounce), but F1–F6a only wired the bounce library hooks, so runner libraries had
// no way into the spiral or sphere content sources. This file closes that gap.
//
// Like bounce, a runner region's geometry cannot be re-derived from a serialized
// world (there is no path extractor for zone substrates — see
// rebuildEnvelopeFromRulesJson), so an entry CARRIES its emitted rules verbatim
// (carried_rules: the by-side exit paths/rules, the location rules, and the
// obstacle defs) alongside the level payload. Instantiation re-assembles the
// synthetic-exit region via the engine's assembleZoneRegion — the same shape the
// runner extractZoneRules channel produces today.
//
// It is a near-mirror of bounceLibraryEntry.js. The substrate-specific bits are:
//   - the payload level key (runner `runnerLevel` vs bounce `bounceLevel`);
//   - runner ALWAYS embeds a physics stamp ({ profile, constants }), whereas bounce
//     omits it for the experimental profile — so capture reads params.physics.profile
//     with a DEFAULT_PROFILE_ID fallback, and buildZonePayload takes the profile id;
//   - the portal-direction relabel field (runner `arrow` glyph vs bounce `direction`);
//   - the substrate id.
// A shared shared/procgen/zoneLibraryEntry.js factory could host the common body —
// deferred here (bounce is SHIPPED + byte-gated, and shared/ is a submodule) to keep
// the runner-first landing low-risk; see the region-library-f6 plan.

import { assembleZoneRegion } from '../procgenPipeline/procgenPipelineEngine.js';
import { DEFAULT_PROFILE_ID } from './physics.js';

// exit_<side> → side (assembleZoneRegion's synthetic exit id convention).
function sideOfExitId(id) {
    return typeof id === 'string' && id.startsWith('exit_') ? id.slice(5) : null;
}

/**
 * Capture a live runner region descriptor into a library entry.
 * @param region  the assembled region (playable_payload = buildZonePayload output)
 * @param meta    { entry_id?, name? }
 */
export function captureRunnerLibraryEntry(region, meta = {}) {
    const pp = region?.playable_payload ?? {};
    const params = pp.params ?? {};
    const level = params.runnerLevel;
    const sidePortals = params.sidePortals ?? {};
    if (!level || Object.keys(sidePortals).length === 0) {
        throw new Error('captureLibraryEntry(runner): region.playable_payload lacks params.runnerLevel/sidePortals');
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
        substrate: 'runner',
        exit_sides,
        payload: {
            runnerLevel: level,
            sidePortals,
            physicsProfile: params.physics?.profile ?? DEFAULT_PROFILE_ID,
        },
        carried_rules,
        location_slots: locations.length,
    };
}

/**
 * Instantiate a runner library entry into a fresh region descriptor (the spiral
 * content-source hook; subset-only fit — the slot's sides ⊆ the entry's captured
 * sides, so no relabel is needed). Draws no rng.
 * @param entry  the library entry
 * @param ctx    { region_id, exitSides?, regionSize?, rng? } — rng UNUSED
 * @param deps   { buildZonePayload }
 */
export function instantiateRunnerLibraryEntry(entry, ctx = {}, deps) {
    const { buildZonePayload } = deps;
    const region_id = ctx.region_id ?? entry.entry_id;
    const exitSides = ctx.exitSides ?? entry.exit_sides;
    const entrySides = new Set(entry.exit_sides);
    for (const s of exitSides) {
        if (!entrySides.has(s)) {
            throw new Error(
                `instantiateLibraryEntry(runner): slot needs side '${s}' but entry `
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
    const { runnerLevel, sidePortals, physicsProfile } = entry.payload;
    const payload = buildZonePayload(region_id, runnerLevel, sidePortals, physicsProfile ?? DEFAULT_PROFILE_ID);
    const zoneRules = {
        locations: (cr.locations ?? []).map((l) => ({ ...l })),
        ...(Object.keys(exitRules).length ? { exitRules } : {}),
        ...(Object.keys(exitPaths).length ? { exitPaths } : {}),
        obstacleDefs: cr.obstacleDefs ?? {},
        payload,
    };
    return assembleZoneRegion({
        substrate: 'runner', region_id, regionSize: ctx.regionSize, exitSides, zoneRules, zonePayload: {},
    });
}

// side -> level portal arrow glyph (runner portals carry `arrow`, not bounce's
// `direction`; the glyph vocabulary is the same up/down/left/right). Purely a
// rendering hint — the connection is side-based (stitchGrid), so relabelling it is
// cosmetic but kept so a relabelled exit's arrow points the right way.
const SIDE_ARROWS = { N: 'up', S: 'down', E: 'right', W: 'left' };

/**
 * Requirement-aware sphere instantiate (region-library F6c, runner). Mirrors
 * bounce's instantiateLibraryEntryForSpecs: the sphere driver needs SPECIFIC sides
 * (the entrance mirrored from the parent's placed exit, plus each child's side) and
 * hands every exit an access GATE. A runner entry's sidePortals are re-keyable — the
 * side is just the linking key, the portal geometry (exit_main at the strip end,
 * exit_brN on branch tips) is independent — so this RELABELS the captured portals
 * onto the requested sides BY INDEX, reassigns the node's items onto the captured
 * pickup slots (filler on the surplus), and returns GEOMETRY-ONLY zoneRules.
 *
 * It deliberately emits NO exit rules: the engine composes the gate as an
 * access_rule OVERLAY on the exit (logic-looser-than-physics, the jta contract).
 * The captured level is reused as pure playable geometry; the AP LOGIC enforces the
 * gate, not the level's physics (the region is "walkable past" the gate at runtime).
 * Instantiate draws no rng.
 *
 * @param entry  the runner library entry
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
            `instantiateLibraryEntryForSpecs(runner): entry '${entry.entry_id}' offers `
            + `${capturedSides.length} portal(s) [${capturedSides.join(',')}] but the slot `
            + `needs ${exitSides.length} side(s) [${exitSides.join(',')}]`);
    }
    const capturedSlots = entry.carried_rules?.locations ?? [];
    if (locationSpecs.length > capturedSlots.length) {
        throw new Error(
            `instantiateLibraryEntryForSpecs(runner): entry '${entry.entry_id}' has `
            + `${capturedSlots.length} location slot(s) but the node needs `
            + `${locationSpecs.length}`);
    }

    // Relabel: map each requested side onto a captured portal (by declaration
    // index), re-key sidePortals, and point the portal's arrow glyph at the new
    // side. Surplus captured portals stay in the level geometry but are dropped
    // from sidePortals (inert — no neighbour to route to; the level stays
    // navigable). Clone the level so the shared entry template is never mutated.
    const level = structuredClone(entry.payload.runnerLevel);
    const portalsById = new Map((level.portals ?? []).map((p) => [p.id, p]));
    const sidePortals = {};
    for (let i = 0; i < exitSides.length; i++) {
        const side = exitSides[i];
        const portalId = capturedPortals[capturedSides[i]];
        sidePortals[side] = portalId;
        const portal = portalsById.get(portalId);
        if (portal) portal.arrow = SIDE_ARROWS[side];
    }

    const payload = buildZonePayload(
        region_id, level, sidePortals, entry.payload.physicsProfile ?? DEFAULT_PROFILE_ID);

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
export function validateRunnerLibraryEntry(entry) {
    const errors = [];
    const p = entry.payload ?? {};
    if (!p.runnerLevel) errors.push('payload.runnerLevel missing');
    const spSides = Object.keys(p.sidePortals ?? {}).sort();
    const declared = [...(entry.exit_sides ?? [])].sort();
    if (JSON.stringify(spSides) !== JSON.stringify(declared)) {
        errors.push(`exit_sides [${declared.join(',')}] contradict payload sidePortals sides [${spSides.join(',')}]`);
    }
    const cr = entry.carried_rules;
    if (cr == null || typeof cr !== 'object') {
        errors.push('carried_rules must be present (runner geometry is not re-derivable)');
    } else if ((cr.locations?.length ?? 0) !== entry.location_slots) {
        errors.push(`location_slots ${entry.location_slots} != carried_rules.locations count ${cr.locations?.length ?? 0}`);
    }
    return { errors };
}
