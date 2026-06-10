/**
 * Substrate registry entry for the Bounce Demo (DJ-Metroidvania) —
 * build-order step 5 + the embed phase
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * The entry is a MERGE: flash runtime plumbing (de/serializeWorld,
 * playback stub — via createFlashSubstrateEntry) + bounce's own panel
 * identity + the build-time zone hooks. Bounce rides flashSubstrate's
 * bridge and panel CLASS (see index.js) but registers its own panel
 * component + loadRegion event, because the flash panel instance shows
 * one hardcoded page and host activation keys on panelComponentType.
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
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import { deriveAccessRules } from './deriveRules.js';
import { attachSideExits } from './sideExits.js';
import { generateLevelFromSpecs } from './generator.js';
import { ABILITY_ITEM_NAMES, minimalSetsToRule, VICTORY_ITEM_NAME } from './apRules.js';
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
 * Payload shaped for the flashSubstrate bridge's configure() contract:
 * level geometry rides `params` (the bridge forwards only world.params,
 * ap_items, ap_locations, flashCapabilities, gameId, regionId — not
 * arbitrary payload fields). ap_locations maps the game's pickup ids to
 * AP location names (compileRegionGraph's `<region>__<id>` convention).
 */
function buildZonePayload(region_id, level, sidePortals) {
    return {
        gameId: 'bounceDemo',
        params: {
            bounceLevel: level, // transformed geometry the renderer draws
            sidePortals,        // side -> portal id (exit arrows)
        },
        ap_locations: Object.fromEntries(
            (level.pickups ?? []).map((pk) => [pk.id, `${region_id}__${pk.id}`])),
        flashCapabilities: {
            locations: 'cooperative',
            items: 'pull',
            start: 'auto',      // no click needed; the game runs on load
        },
    };
}

/**
 * The zone-locations channel hook (see synthesizeZoneRegion). Attaches
 * per-side exit platforms to the zone's level, derives access rules on
 * the TRANSFORMED level, and emits Rule Builder rules + the canonical
 * item per pickup. Throws on verifier defects — a zone set that emits
 * broken rules should fail generation loudly, not produce a bad seed.
 */
function makeExtractZoneRules(zones, { portalPlacement = 'directional' } = {}) {
    return function extractZoneRules(zoneIdx, { region_id, exitSides }) {
        const zone = zones[zoneIdx];
        if (!zone) throw new Error(`bounce: zone index ${zoneIdx} out of range (${zones.length} zones)`);

        const { level, sidePortals } = attachSideExits(zone.level, exitSides, {
            placement: portalPlacement,
        });
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
            payload: buildZonePayload(region_id, level, sidePortals),
        };
    };
}

// ── Sphere-driven growth hook (generateZoneForSpecs, step 2) ─────────
//
// Requirement-targeted region realization for the sphere grower
// (NewDocs/plans/procedural-generation/sphere-driven-growth.md): the
// driver specifies per-exit and per-location target requirements in AP
// item names; bounce maps them to ability ids at this boundary,
// generates a verified prefix-graded chain level, and returns the same
// { locations, exitRules, payload } shape extractZoneRules produces.
// Unsatisfiable specs THROW — that is the "adapter declines" channel
// (unknown gate items, non-nested requirements, more than one
// arrowless-gated exit).

const SIDE_DIRECTIONS = { N: 'up', S: 'down', E: 'right', W: 'left' };

const ABILITY_BY_ITEM_NAME = Object.freeze(Object.fromEntries(
    Object.entries(ABILITY_ITEM_NAMES).map(([ability, name]) => [name, ability])));

/** AP item names bounce can realize gates for (driver-side gate
 *  compatibility — see the plan doc's "Gate compatibility"). */
export const GATEABLE_ITEMS = Object.freeze(Object.values(ABILITY_ITEM_NAMES));

function requirementToAbilities(requirement, what) {
    return (requirement ?? []).map((name) => {
        const ability = ABILITY_BY_ITEM_NAME[name];
        if (!ability) {
            throw new Error(`bounce ${what}: cannot gate on item '${name}' — `
                + `gateable items are: ${GATEABLE_ITEMS.join(', ')}`);
        }
        return ability;
    });
}

/**
 * @param {object} specs
 * @param {string} specs.region_id
 * @param {Array<{side: string, requirement: string[]}>} specs.exitSpecs
 *   — requirement in AP item names; one exit platform per side.
 * @param {Array<{id: string, item: string|null, requirement: string[]}>}
 *   [specs.locationSpecs] — pickups; `item` is the canonical placement.
 * @param {number} [specs.seed]
 * @param {number} [specs.stepsBetween]
 * @param {number} [specs.jitter]
 * @returns {{locations: Array, exitRules: Object, payload: Object}}
 */
export function generateZoneForSpecs({
    region_id,
    exitSpecs = [],
    locationSpecs = [],
    seed = 1,
    stepsBetween = 2,
    jitter = 0,
} = {}) {
    const exits = exitSpecs.map((s) => {
        if (!SIDE_DIRECTIONS[s.side]) {
            throw new Error(`bounce zone '${region_id}': unknown exit side '${s.side}'`);
        }
        return {
            id: `side_exit_${s.side}`,
            side: s.side,
            direction: SIDE_DIRECTIONS[s.side],
            requirement: requirementToAbilities(s.requirement, `zone '${region_id}' exit ${s.side}`),
        };
    });
    const pickups = locationSpecs.map((s) => ({
        id: s.id,
        requirement: requirementToAbilities(s.requirement, `zone '${region_id}' location '${s.id}'`),
    }));

    const level = generateLevelFromSpecs({
        id: region_id,
        exitSpecs: exits,
        pickupSpecs: pickups,
        seed,
        stepsBetween,
        jitter,
    });

    const derived = deriveAccessRules(level);
    if (derived.defects.length > 0) {
        throw new Error(`bounce zone '${region_id}' has rule defects: `
            + derived.defects.join('; '));
    }
    const sidePortals = {};
    for (const e of exits) sidePortals[e.side] = e.id;
    const exitRules = {};
    for (const e of exits) {
        exitRules[e.side] = minimalSetsToRule(derived.exits[e.id].minimalSets);
    }
    const locations = locationSpecs.map((s) => ({
        id: s.id,
        item: s.item ?? null,
        access_rule: minimalSetsToRule(derived.pickups[s.id].minimalSets),
        position: null, // level-local px would be misread as tile coords
    }));
    return {
        locations,
        exitRules,
        payload: buildZonePayload(region_id, level, sidePortals),
    };
}

// Shared across every bounce entry — same Shape-1 reasoning as flash's
// FLASH_PANEL_COMPONENT_TYPE/FLASH_LOAD_REGION_EVENT: all bounce zone-set
// ids resolve to the ONE bounce panel + load event. Bounce gets its OWN
// event (not flash:loadRegion) so the flash placeholder's bridge isn't
// configured by bounce region loads and host activation brings the right
// panel forward.
export const BOUNCE_PANEL_COMPONENT_TYPE = 'bounceDemoPanel';
export const BOUNCE_LOAD_REGION_EVENT = 'bounce:loadRegion';
export const BOUNCE_IFRAME_ID = 'bounceDemo';

/**
 * Build a bounce substrate registry entry for a zone set — the same
 * per-entry factory pattern flashSubstrate uses per game, and literally
 * built on it: createFlashSubstrateEntry supplies the runtime plumbing
 * (exits-Map de/serializeWorld for the sidecar round-trip, playback
 * stub), then bounce overrides the panel identity and adds the
 * zone-based build-time hooks. `zones` is a ZONES-shaped table
 * (fixtures or generator.generateZoneSet output); `portalPlacement` is
 * 'directional' | 'arbitrary' (sideExits.js).
 */
export function createBounceSubstrateEntry({
    id = 'bounce',
    label = 'Bounce Demo',
    zones = ZONES,
    portalPlacement = 'directional',
} = {}) {
    return Object.freeze({
        ...createFlashSubstrateEntry({ id, label, iframeId: BOUNCE_IFRAME_ID }),

        // Bounce's own panel + load event (see constants above).
        panelComponentType: BOUNCE_PANEL_COMPONENT_TYPE,
        loadRegionEvent: BOUNCE_LOAD_REGION_EVENT,

        // The substrate's zone table places this item itself (fork's
        // loc_left in the fixture set; generateZoneSet's last zone).
        // Emission paths use it as the completion-condition item when
        // the scenario pool contributes no is_victory item — without
        // it the AP world gets NO goal and AP defaults to trivially
        // true (BaseClasses.set_player_attr), which makes the seed
        // "beaten" at sphere 0.
        victoryItem: VICTORY_ITEM_NAME,

        // Zone-based substrate metadata (read by layout drivers)
        zoneCount: zones.length,
        // All payload content comes from extractZoneRules (which knows
        // the exit sides); no separate synthesizeZonePayload needed.
        extractZoneRules: makeExtractZoneRules(zones, { portalPlacement }),

        // Sphere-driven growth: requirement-targeted generation + the
        // gate vocabulary bounce can realize (driver-side gate
        // compatibility check).
        generateZoneForSpecs,
        gateableItems: GATEABLE_ITEMS,
    });
}

export const substrateRegistryEntry = createBounceSubstrateEntry();

/** The default entry's hook, bound to the fixture ZONES (tests). */
export const extractZoneRules = substrateRegistryEntry.extractZoneRules;

if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
