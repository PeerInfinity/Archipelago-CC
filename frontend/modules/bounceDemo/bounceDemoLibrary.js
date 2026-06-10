/**
 * Substrate registry entry for the Bounce Demo (DJ-Metroidvania) —
 * build-order step 5
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * Build-time-only registration for now (the registry contract allows
 * it): zoneCount + extractZoneRules drive the procgen pipeline;
 * runtime panel fields arrive with the step-6 renderer.
 *
 * Each zone is a fixture level plus its CANONICAL item assignment
 * (the "original" placement rules.json records; AP re-randomizes).
 * Zone order is chosen winnable through a spiral chain — zone 0 must
 * grant an arrow before anything needs one, because a no-arrows
 * player bounces a deterministic center column and exits at the first
 * exit platform on it. The canonical-vs-rules distinction matters:
 * what AP randomizes over is the RULE structure; this table is just
 * one valid assignment, replaced by the step-7 generator.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { deriveAccessRules } from './deriveRules.js';
import { attachSideExits } from './sideExits.js';
import { minimalSetsToRule, VICTORY_ITEM_NAME } from './apRules.js';
import { validateLevel } from './level.js';
import { bounceStack } from './fixtures/bounceStack.js';
import { easyTower } from './fixtures/easyTower.js';
import { fillerClimb } from './fixtures/fillerClimb.js';
import { springGap } from './fixtures/springGap.js';
import { fork } from './fixtures/fork.js';

// Canonical assignment constraints (checked by the e2e winnability
// test): the spiral chain hops E,S,W,W with derived side rules, so
// Right arrow must land in zone 0, Left arrow + Springs by zone 1
// (S/W exits derive as arrow-gated; springGap's own pickup needs
// Springs before zone 3).
export const ZONES = Object.freeze([
    { level: bounceStack, items: { loc_arrow: 'Right arrow' } },
    { level: easyTower, items: { loc_easy: 'Left arrow', loc_easy2: 'Springs' } },
    { level: fillerClimb, items: {} },
    { level: springGap, items: { loc_spring: 'Jetpacks' } },
    { level: fork, items: { loc_right: 'Blue platforms', loc_left: VICTORY_ITEM_NAME } },
]);

/**
 * The zone-locations channel hook (see synthesizeZoneRegion). Attaches
 * per-side exit platforms to the zone's level, derives access rules on
 * the TRANSFORMED level, and emits Rule Builder rules + the canonical
 * item per pickup. Throws on verifier defects — a zone set that emits
 * broken rules should fail generation loudly, not produce a bad seed.
 */
export function extractZoneRules(zoneIdx, { region_id, exitSides }) {
    const zone = ZONES[zoneIdx];
    if (!zone) throw new Error(`bounce: zone index ${zoneIdx} out of range (${ZONES.length} zones)`);

    const { level, sidePortals } = attachSideExits(zone.level, exitSides);
    const modelErrors = validateLevel(level);
    if (modelErrors.length > 0) {
        throw new Error(`bounce zone ${zoneIdx} (${level.id}) invalid after side-exit `
            + `transform: ${modelErrors.join('; ')}`);
    }

    const derived = deriveAccessRules(level);
    if (derived.defects.length > 0) {
        throw new Error(`bounce zone ${zoneIdx} (${level.id}) has rule defects: `
            + derived.defects.join('; '));
    }

    const locations = (level.pickups ?? []).map((pk) => {
        const item = zone.items[pk.id];
        if (!item) {
            throw new Error(`bounce zone ${zoneIdx} (${level.id}): pickup '${pk.id}' `
                + 'has no canonical item assignment');
        }
        return {
            id: pk.id,
            item,
            access_rule: minimalSetsToRule(derived.pickups[pk.id].minimalSets),
            position: null, // level-local px would be misread as tile coords
        };
    });

    const exitRules = {};
    for (const side of exitSides) {
        const portalId = sidePortals[side];
        exitRules[side] = minimalSetsToRule(derived.exits[portalId].minimalSets);
    }

    return {
        locations,
        exitRules,
        payload: {
            bounceLevel: level,     // transformed geometry the renderer draws
            sidePortals,            // side -> portal id (exit arrows)
        },
    };
}

export const substrateRegistryEntry = Object.freeze({
    // Identity
    id: 'bounce',
    label: 'Bounce Demo',

    // Runtime fields (panel, loadRegionEvent, playback) arrive with
    // the step-6 renderer. Sidecar round-trip works today: the exits
    // Map is the only non-JSON field, same as JtA.
    deserializeWorld: (payload) => {
        const p = payload ?? {};
        const exitsArray = Array.isArray(p.exits) ? p.exits : [];
        const exitsMap = new Map();
        for (const e of exitsArray) {
            const key = e?.exitName ?? e?.exit_id;
            if (key) exitsMap.set(key, e);
        }
        return { ...p, exits: exitsMap };
    },
    serializeWorld: (world) => {
        const w = world ?? {};
        const exitsArray = w.exits instanceof Map
            ? [...w.exits.values()]
            : (Array.isArray(w.exits) ? w.exits : []);
        return { ...w, exits: exitsArray };
    },
    getPlaybackController: () => null,

    // Zone-based substrate metadata (read by layout drivers)
    zoneCount: ZONES.length,
    // All payload content comes from extractZoneRules (which knows the
    // exit sides); no separate synthesizeZonePayload needed.
    extractZoneRules,
});

if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
