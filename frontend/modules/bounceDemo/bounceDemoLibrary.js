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
            // Payload shaped for the flashSubstrate bridge's configure()
            // contract: level geometry rides `params` (the bridge forwards
            // only world.params, ap_items, ap_locations, flashCapabilities,
            // gameId, regionId — not arbitrary payload fields).
            // ap_locations maps the game's pickup ids to AP location names
            // (compileRegionGraph's `<region>__<id>` convention).
            payload: {
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
            },
        };
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
    });
}

export const substrateRegistryEntry = createBounceSubstrateEntry();

/** The default entry's hook, bound to the fixture ZONES (tests). */
export const extractZoneRules = substrateRegistryEntry.extractZoneRules;

if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
