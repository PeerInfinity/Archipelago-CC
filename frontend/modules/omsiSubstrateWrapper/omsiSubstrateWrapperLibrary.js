/**
 * Substrate registry entry for Idle Loops (omsi-loops) as a loop-mode
 * substrate — cross-game plan R2 / omsi substrate plan Phase F v0.
 *
 * v0 scope (omsi substrate plan §6, RULED 2026-07-10): ONE region =
 * Beginnersville (town 0), no travel binding, victory on completing
 * Start Journey (town 1 unlocked). The registry entry is zone-shaped
 * like jta's — `zoneCount` bounds how many omsi regions a layout
 * driver may allocate (1 in v0; multi-town v1+ raises it) and
 * `extractZoneRules` is the per-zone payload contributor.
 *
 * Unlike jta there is no opt-in flag for the location emission: no
 * existing preset lists 'omsi' as a content source, so emitting the
 * single Start Journey victory location unconditionally is inert for
 * every existing world.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

// Host-side PlaybackProxy slot, mirroring the jta library's setter
// injection. v0 registers NO playback controller (one region, no
// travel — walkTo semantics belong to the multi-town v1+ design);
// the setter exists so that arc can slot one in without reshaping
// the registry entry.
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

// P2 award schedule (cross-game §2d/§9b-pre): installed at pipeline ①
// via applyPipelineConfig ({ awardSchedule }) and emitted into the
// zone-0 payload, which the bridge feeds to the fork carrier
// (IdleLoopsManaged.setAwardSchedule) on omsi:loadRegion. Absent config
// clears it — module state must not leak across builds in one process
// (the panel path re-arranges without reloading modules).
let _awardSchedule = null;
export function getOmsiAwardSchedule() { return _awardSchedule; }

// The v0 victory location: one location on the Beginnersville region,
// checked when the game completes Start Journey (the bridge watches
// townsUnlocked). The id is the stable per-region location id;
// compileRegionGraph mints the AP location name `${region_id}__${id}`.
export const OMSI_START_JOURNEY_LOCATION_ID = 'start_journey';

export const OMSI_VICTORY_ITEM_NAME = 'Victory';

// Item-classification library merged into the pipeline's itemLib for a
// world with an omsi region. Victory is the is_victory goal item —
// same declaration shape as bounce/runner/jta.
export const OMSI_LIBRARY_ITEMS = Object.freeze({
    [OMSI_VICTORY_ITEM_NAME]: { classification: 'progression', is_victory: true },
});

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'omsi',
    label: 'Idle Loops',
    panelComponentType: 'omsiSubstrateWrapperPanel',
    loadRegionEvent: 'omsi:loadRegion',

    // The panel's iframe announces this id (the panel appends
    // ?iframeId=omsiSubstrateWrapper to the iframe src). procgenPlayer
    // re-publishes the active region's loadRegionEvent when this
    // iframe reports appReady, so a page/panel reload while standing
    // in an omsi region re-delivers omsi:loadRegion to the freshly
    // booted bridge (the existing catch-up mechanism — same as jta).
    iframeId: 'omsiSubstrateWrapper',

    // Goal item for completion-condition emission when the scenario
    // pool contributes no other is_victory item (same name bounce /
    // runner / jta declare).
    victoryItem: OMSI_VICTORY_ITEM_NAME,

    supportedFeatures: Object.freeze([
        'region_topology_from_source',
        'arbitrary_ap_locations',
    ]),

    libraryItems: OMSI_LIBRARY_ITEMS,

    // procgenPlayer passes the sidecar entry's `playable_payload` to
    // this function; the bridge reads `world.omsiTown` directly.
    // Exits convert from the on-disk array into a Map keyed by
    // exitName — procgenPlayer.handleRegionMove calls
    // sourceWorld.exits.has(exitName) when resolving region
    // transitions (same conversion as the jta/maze deserializers).
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

    // Inverse for write-to-disk (buildPresetSidecars invokes this on
    // every region during preset emission). Only the runtime-Map
    // exits field needs special handling.
    serializeWorld: (world) => {
        const w = world ?? {};
        const exitsArray = w.exits instanceof Map
            ? [...w.exits.values()]
            : (Array.isArray(w.exits) ? w.exits : []);
        return { ...w, exits: exitsArray };
    },

    // v0 registers no PlaybackController (see setPlaybackProxy above).
    getPlaybackController: () => _playbackProxy,

    // Cross-substrate sharing: participates in the shared-mana channel
    // (cross-game plan D1/D8). The in-iframe bridge publishes the
    // generic channel events (substrate:resourceDelta/Bonus/Reset with
    // substrateId 'omsi'); the resourceChannels router validates them
    // against this declaration.
    //
    // items: the shareable consumable types (D2) — the NUMERIC entries
    // of the engine's per-loop `resources` bag (resourcesTemplate,
    // saving.js), in template order. The bag literal is engine-static,
    // so this is a static list; the in-app substrate test cross-checks
    // it against the live resourcesTemplate to catch drift. Boolean
    // entries (glasses/supplies/pickaxe/...) are excluded: addResource
    // ASSIGNS rather than adds them — they are unlock flags, not
    // consumables. A granted consumable lands via the engine's own
    // addResource and is wiped by resetResources at the next loop
    // reset — that is the D4-ruled native clearing, not a bug.
    sharing: Object.freeze({
        mana: Object.freeze({}),
        items: Object.freeze({
            types: Object.freeze([
                'gold', 'reputation', 'herbs', 'hide', 'potions',
                'teamMembers', 'armor', 'blood', 'artifacts', 'favors',
                'enchantments', 'houses', 'pylons', 'zombie', 'map',
                'completedMap', 'heart', 'power',
            ]),
        }),
    }),

    // --- Zone-based substrate metadata ---
    //
    // v0: exactly one zone — Beginnersville. Layout drivers refuse to
    // allocate more omsi regions than this.
    zoneCount: 1,

    // Per-zone payload contributor. `omsiTown` is the town ordinal the
    // bridge passes through to the game (0 = Beginnersville). The
    // single victory location rides zone 0: `ap_locations` maps the
    // location id to the compileRegionGraph name so the bridge can
    // dispatch the user:locationCheck when Start Journey completes.
    // Pipeline ① config install (spiral applySubstrateConfig): the P2
    // award schedule rides here. Called for every quota'd substrate on
    // every arrange — an absent/empty config CLEARS the slot.
    applyPipelineConfig: (cfg) => {
        _awardSchedule = cfg?.awardSchedule ?? null;
    },

    extractZoneRules: (zoneIdx, { region_id } = {}) => {
        const locations = [];
        const payload = { omsiTown: zoneIdx };
        if (zoneIdx === 0) {
            locations.push({
                id: OMSI_START_JOURNEY_LOCATION_ID,
                item: OMSI_VICTORY_ITEM_NAME,
                position: null,
            });
            payload.ap_locations = {
                [OMSI_START_JOURNEY_LOCATION_ID]:
                    `${region_id}__${OMSI_START_JOURNEY_LOCATION_ID}`,
            };
            // world data for the fork's award carrier (deep-copied: the
            // payload is serialized into preset sidecars and must not
            // alias module state)
            if (_awardSchedule) {
                payload.awardSchedule = JSON.parse(JSON.stringify(_awardSchedule));
            }
        }
        return { locations, payload };
    },
});

// Side-effect on import: register the omsi substrate so the procgen
// pipeline can resolve it without booting the panel module. Same
// pattern as the mazeRoom / textAdventureSubstrate / jta libraries —
// idempotent because index.js's host hook also guards its register().
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
