/**
 * Substrate registry entry for JtA as a loop-mode substrate.
 *
 * v1 scope: each Archipelago region = one JtA zone. The procgen
 * region graph drives transitions; jta:loadRegion tells the panel
 * which zone to render. v1 does not surface AP location checks
 * inside regions and does not contribute build-time procgen hooks —
 * the sidecar carries the per-region `jtaZone` mapping and the
 * substrate just renders the corresponding zone.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { JTA_ZONE_TASK_DATA } from './zoneTaskData.js';

// Host-side PlaybackProxy, injected by index.js's initialize() once the
// eventBus exists (setter injection rather than importing index.js so
// this library stays headless-import-safe — Node unit tests import it
// without the panel/gameState graph). Null until then; registry callers
// treat null as "no controller available" and no-op.
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

// --- Zone-locations channel (Phase 1 skeleton, param-gated) ---
//
// extractZoneRules emits a jta zone's tasks as AP locations. It is
// OPT-IN: dormant by default so existing jta presets stay byte-identical
// (an entry with a no-op extractZoneRules produces the same region as one
// with none — empty locations, always-open exits, the same {jtaZone}
// payload). setJtaEmitZoneLocations(true) turns it on for the
// AP-locations preset. This proves the locations build path end-to-end
// (extracted_rules → world_generator → Generate.py → spoiler/sphere log)
// before Phase 2 adds randomization and the runtime check-reporting
// bridge.
let _emitZoneLocations = false;
export function setJtaEmitZoneLocations(on) { _emitZoneLocations = !!on; }
export function getJtaEmitZoneLocations() { return _emitZoneLocations; }

// The four zone-0..14 tasks with no in-game unlocker
// (Divinity/SeeBeyondTheVeil-gated): Use Secret Fishing Spot (17),
// Training Dummy (28), Train at Every Guild (88), Write Down Some
// Learnings (158). Unobtainable without prestige, which v1 (zones 0–14)
// never reaches, so they are excluded from the location pool, the pacing
// walk, and the verification universe (plan §6 open-q 10, RULED).
const SBTV_GATED_TASK_IDS = new Set([17, 28, 88, 158]);

// v1 filler item (plan §6 open-q 7, RULED: filler items do nothing). The
// Phase 1 skeleton places no perks yet, so EVERY location holds filler —
// enough to give AP fill a full item pool so the round-trip
// (world_generator → Generate.py → sphere log) actually runs. Phase 2
// replaces filler with the granting perk on perk-tasks and keeps filler
// on the rest.
export const JTA_FILLER_ITEM_NAME = 'JtA Filler';

// Build the zone-locations result for one zone. Returns the
// extractZoneRules shape { locations, payload } where payload.ap_locations
// maps each task id to the compileRegionGraph location name
// `${region_id}__${id}`. Exits are left to the layout driver
// (always-open) — jta region transitions are driven by Travel-task
// completion, not by gated exits, so extractZoneRules emits no
// exitRules/exitPaths.
function buildZoneLocations(zoneIdx, region_id) {
    const zone = JTA_ZONE_TASK_DATA[zoneIdx];
    if (!zone) return { locations: [], payload: {} };
    const apLocations = {};
    const locations = [];
    for (const task of zone.tasks) {
        if (SBTV_GATED_TASK_IDS.has(task.id)) continue;
        apLocations[task.id] = `${region_id}__${task.id}`;
        locations.push({ id: task.id, item: JTA_FILLER_ITEM_NAME, position: null });
    }
    return { locations, payload: { ap_locations: apLocations } };
}

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'jta',
    label: 'JtA',
    panelComponentType: 'jtaSubstrateWrapperPanel',
    loadRegionEvent: 'jta:loadRegion',

    // The panel's iframe announces this id (jtaSubstrateWrapperPanel
    // appends ?iframeId=jtaSubstrateWrapper to the iframe src).
    // procgenPlayer re-publishes the active region's loadRegionEvent
    // when this iframe reports appReady, so a page/panel reload while
    // standing in a jta region re-delivers jta:loadRegion to the
    // freshly booted bridge (same catch-up the flash family uses).
    iframeId: 'jtaSubstrateWrapper',

    // Completion-condition item emission paths use this when a jta
    // world's scenario pool contributes no is_victory item; without it
    // an emitted world has no goal and is "beaten" at sphere 0. Same
    // name bounce and runner declare (VICTORY_ITEM_NAME).
    victoryItem: 'Victory',

    // v1: no AP location checks inside regions, no logic gates, no
    // spatial topology. The supported-feature set is intentionally
    // minimal — extended in later phases as features are added.
    supportedFeatures: Object.freeze([
        'region_topology_from_source',
    ]),

    // procgenPlayer passes the sidecar entry's `playable_payload` (not
    // the whole sidecar) to this function. The bridge then reads
    // `world.jtaZone` directly. Expected payload shape for a jta
    // region:
    //   { jtaZone: <number>, exits: [...], ... }
    //
    // Exits are converted from the on-disk array form into a Map
    // keyed by exitName — same shape mazeRoom's deserializer uses —
    // because procgenPlayer.handleRegionMove calls
    // sourceWorld.exits.has(exitName) when resolving the targetExitId
    // for a region transition. Leaving exits as an array breaks that
    // lookup with "exits.has is not a function".
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

    // Inverse of deserializeWorld for write-to-disk. buildPresetSidecars
    // invokes this on every region during preset emission; without it
    // jta regions emitted by a procgen layout driver (e.g.
    // arrangeShuffledSpiral) would fail at sidecar build time. Only
    // the runtime-Map exits field needs special handling — everything
    // else round-trips as-is.
    serializeWorld: (world) => {
        const w = world ?? {};
        const exitsArray = w.exits instanceof Map
            ? [...w.exits.values()]
            : (Array.isArray(w.exits) ? w.exits : []);
        return { ...w, exits: exitsArray };
    },

    // Host-side proxy publishing jta:playbackControl events that the
    // in-iframe bridge executes (play/stop → resume/pause the game
    // clock, step → stepTick, instant → setInstantMode, reset →
    // doEnergyReset, walkTo(exit) → drive mandatory+travel tasks then
    // take the requested exit). Null before index.js initializes.
    getPlaybackController: () => _playbackProxy,

    // Loop-mode capabilities. executeVia makes the loops queue drive
    // regionMove actions through the PlaybackController's walkTo (the
    // queue parks until the resulting user:regionMove arrives) instead
    // of the generic progress timer. Custom queues are wanted
    // eventually but jta has no queue recording yet — flip
    // customQueues when that lands. No locations / explore in v1
    // regions, so regionMove is the only queueable action.
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove']),
        manual: true,
        customQueues: false,
        executeVia: 'playbackBot',
    }),

    // Build-time hooks (generateRegionCore / placeFromItems / etc.)
    // are omitted in v1 — procgen does not generate JtA-specific
    // region content; it just records `jtaZone` in the sidecar.
    //
    // --- Zone-based substrate metadata ---
    //
    // Layout drivers that map grid positions to ordered "zones"
    // (currently arrangeShuffledSpiral) read these two fields:
    //   - zoneCount: how many discrete zones this substrate exposes.
    //     Drivers refuse to allocate more than this many regions to
    //     the substrate.
    //   - synthesizeZonePayload(zoneIdx): returns a playable_payload
    //     fragment for the Nth zone. The driver merges this with the
    //     layout's own fields (exits, etc.) before stamping the
    //     sidecar.
    //
    // Total zone count is owned by the JtA build in the
    // frontend/modules/journey-to-ascension submodule (build/zones.js
    // — the copy the panel actually loads). Kept in sync by hand; if
    // it drifts the runtime warns on loadZone and refuses the bad
    // index. 30 as of Fork 1.6.
    zoneCount: 30,
    synthesizeZonePayload: (zoneIdx) => ({ jtaZone: zoneIdx }),

    // Zone-locations channel (opt-in, see setJtaEmitZoneLocations). The
    // engine calls this whenever it is present (procgenPipelineEngine
    // synthesizeZoneRegion), so when emission is off it returns an empty
    // result that assembles byte-identically to having no hook. When on
    // it emits the zone's tasks as AP locations, merged over
    // synthesizeZonePayload's {jtaZone} (the payloads compose:
    // playable_payload = { ...{jtaZone}, ...{ap_locations} }).
    extractZoneRules: (zoneIdx, { region_id } = {}) => {
        if (!_emitZoneLocations) return { locations: [], payload: {} };
        return buildZoneLocations(zoneIdx, region_id);
    },
});

// Side-effect on import: register the JtA substrate so the procgen
// pipeline can resolve it without booting the panel module. Same
// pattern as mazeRoom/textAdventureSubstrate libraries — idempotent
// because index.js's host hook also calls register() in the live app.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
