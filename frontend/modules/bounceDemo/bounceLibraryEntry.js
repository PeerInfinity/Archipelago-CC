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
