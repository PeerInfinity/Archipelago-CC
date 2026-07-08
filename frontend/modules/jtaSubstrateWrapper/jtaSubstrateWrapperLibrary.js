/**
 * Substrate registry entry for JtA as a loop-mode substrate.
 *
 * Base scope: each Archipelago region = one JtA zone. The procgen
 * region graph drives transitions; jta:loadRegion tells the panel
 * which zone to render. The sidecar carries the per-region `jtaZone`
 * mapping and the substrate renders the corresponding zone.
 *
 * Zone-randomization (Phase 2, opt-in via setJtaEmitZoneLocations):
 * extractZoneRules surfaces every zone task as an AP location, places
 * perk display-name items (optionally seed-shuffled in the pipeline),
 * filler on the rest, and a 'Victory' goal item in the goal zone
 * (setJtaGoalZone). Each region's sidecar also carries `task_patches`
 * — the Tier-1 grant-suppression patches that make perk grants
 * AP-authoritative (the bridge applies them via window.applyTaskPatches
 * and reports task completions / grants perks from received items).
 * With emission off the substrate is byte-identical to the base scope.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { JTA_ZONE_TASK_DATA, JTA_PERK_COUNT } from './zoneTaskData.js';
import { createRng } from '../shared/rng.js';

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

// Optional seeded perk-placement shuffle in the pipeline. User ruling
// 2026-07-08: the pipeline SHOULD be able to randomize perk placement even
// though AP fill re-randomizes at Generate.py time and is authoritative
// (§2b). null (default) = vanilla-identity canonical placement (each perk
// on its own task); a number seeds a cross-zone shuffle, bounded to the
// emitted zone range [0, _goalZone] so a perk never lands on a zone the
// layout won't emit. Either way the item POOL is the same (same 21+ perks);
// only the canonical/seed-1 placement differs — AP fill re-shuffles for
// played seeds.
let _perkShuffleSeed = null;
export function setJtaPerkShuffleSeed(seed) {
    _perkShuffleSeed = (typeof seed === 'number') ? seed : null;
    _placementCache = null;
}
export function getJtaPerkShuffleSeed() { return _perkShuffleSeed; }

// Goal zone = the deepest emitted zone. When set, extractZoneRules emits
// one 'Victory'-bearing location in that zone so the AP item pool contains
// a Victory for completion_condition = has("Victory") to resolve against
// (nothing auto-places Victory — the pool derives SOLELY from location
// `item` fields). Also bounds the perk shuffle. null (default) = no Victory
// emitted, matching the Phase-1 skeleton (off-path stays byte-identical).
let _goalZone = null;
export function setJtaGoalZone(zoneIdx) {
    _goalZone = (typeof zoneIdx === 'number' && zoneIdx >= 0) ? zoneIdx : null;
    _placementCache = null;
}
export function getJtaGoalZone() { return _goalZone; }

// Memoized canonical placement, keyed by (shuffleSeed, goalZone).
let _placementCache = null; // { key, byZone: Map<zoneIdx, Map<taskId, itemName>> }

// The four zone-0..14 tasks with no in-game unlocker
// (Divinity/SeeBeyondTheVeil-gated): Use Secret Fishing Spot (17),
// Training Dummy (28), Train at Every Guild (88), Write Down Some
// Learnings (158). Unobtainable without prestige, which v1 (zones 0–14)
// never reaches, so they are excluded from the location pool, the pacing
// walk, and the verification universe (plan §6 open-q 10, RULED).
const SBTV_GATED_TASK_IDS = new Set([17, 28, 88, 158]);

// v1 filler item (plan §6 open-q 7, RULED: filler items do nothing). Held
// by every location that doesn't carry a perk or Victory, giving AP fill a
// full item pool. Classified as filler via JTA_LIBRARY_ITEMS below.
export const JTA_FILLER_ITEM_NAME = 'JtA Filler';

// Victory item name — the goal item. Matches the registry entry's
// victoryItem so resolveVictoryItem picks it up (from the pool via
// is_victory, or the registry fallback).
export const JTA_VICTORY_ITEM_NAME = 'Victory';

// Every distinct perk display name across the fork's zones — the AP item
// surface for perks. Sourced from the regenerable snapshot; equals the
// fork's PERKS[].name (so window.grantPerk resolves these by name).
const JTA_PERK_ITEM_NAMES = Object.freeze([...new Set(
    JTA_ZONE_TASK_DATA.flatMap((z) => z.tasks.map((t) => t.perk).filter(Boolean)),
)]);

// Item-classification library, merged into the pipeline's itemLib via the
// registry entry's `libraryItems` (mergeSubstrateItemLib / the panel's
// _mergedItemLib). Without it 'JtA Filler' falls through to the
// 'progression' default. Perks are progression (meaningful AP items);
// filler does nothing; Victory is the is_victory goal item.
export const JTA_LIBRARY_ITEMS = Object.freeze({
    [JTA_FILLER_ITEM_NAME]: { classification: 'filler' },
    [JTA_VICTORY_ITEM_NAME]: { classification: 'progression', is_victory: true },
    ...JTA_PERK_ITEM_NAMES.reduce((acc, name) => {
        acc[name] = { classification: 'progression' };
        return acc;
    }, {}),
});

// Identity placement: each perk on its own vanilla task.
function _placeIdentity(ensureZone) {
    for (const zone of JTA_ZONE_TASK_DATA) {
        for (const t of zone.tasks) {
            if (SBTV_GATED_TASK_IDS.has(t.id)) continue;
            if (t.perk) ensureZone(zone.zone).set(t.id, t.perk);
        }
    }
}

// Compute (memoized) the canonical item placement across the emitted zone
// range: which task location holds which perk / Victory item. Filler is the
// default at the call site (any task not in the returned map). Returns
// Map<zoneIdx, Map<taskId, itemName>>.
function _computePlacement() {
    const key = `${_perkShuffleSeed}|${_goalZone}`;
    if (_placementCache && _placementCache.key === key) return _placementCache.byZone;

    const byZone = new Map();
    const ensureZone = (z) => {
        let m = byZone.get(z);
        if (!m) { m = new Map(); byZone.set(z, m); }
        return m;
    };

    if (_perkShuffleSeed != null && _goalZone != null) {
        // Seeded cross-zone shuffle, bounded to the emitted range so a perk
        // never lands on a zone the layout won't emit (which would drop it
        // from the pool). Deal each perk (in zone/task order) to a distinct
        // shuffled task slot.
        const perks = [];
        const slots = [];
        for (let z = 0; z <= _goalZone; z++) {
            const zone = JTA_ZONE_TASK_DATA[z];
            if (!zone) continue;
            for (const t of zone.tasks) {
                if (SBTV_GATED_TASK_IDS.has(t.id)) continue;
                slots.push({ zone: z, taskId: t.id });
                if (t.perk) perks.push(t.perk);
            }
        }
        createRng(_perkShuffleSeed).shuffle(slots);
        perks.forEach((perk, i) => {
            const slot = slots[i];
            ensureZone(slot.zone).set(slot.taskId, perk);
        });
    } else {
        // Identity (default, or shuffle requested without a goal-zone bound —
        // degrade rather than risk losing perks on unemitted zones).
        _placeIdentity(ensureZone);
    }

    // Victory: one goal-zone task not already holding a perk (every zone has
    // a Travel task, which has no perk, so a free slot always exists).
    if (_goalZone != null) {
        const zone = JTA_ZONE_TASK_DATA[_goalZone];
        if (zone) {
            const zoneMap = ensureZone(_goalZone);
            const slot = zone.tasks.find((t) =>
                !SBTV_GATED_TASK_IDS.has(t.id) && !zoneMap.has(t.id));
            if (slot) zoneMap.set(slot.id, JTA_VICTORY_ITEM_NAME);
        }
    }

    _placementCache = { key, byZone };
    return byZone;
}

// Build the zone-locations result for one zone. Returns the
// extractZoneRules shape { locations, payload } where payload.ap_locations
// maps each task id to the compileRegionGraph location name
// `${region_id}__${id}`, and payload.task_patches carries the Tier-1
// grant-suppression patches (perk → Count sentinel) for this zone's
// perk-tasks. Exits are left to the layout driver (always-open) — jta
// region transitions are driven by Travel-task completion, not gated
// exits — so extractZoneRules emits no exitRules/exitPaths.
function buildZoneLocations(zoneIdx, region_id) {
    const zone = JTA_ZONE_TASK_DATA[zoneIdx];
    if (!zone) return { locations: [], payload: {} };
    const placement = _computePlacement().get(zoneIdx) ?? new Map();
    const apLocations = {};
    const locations = [];
    const taskPatches = [];
    for (const task of zone.tasks) {
        if (SBTV_GATED_TASK_IDS.has(task.id)) continue;
        apLocations[task.id] = `${region_id}__${task.id}`;
        const item = placement.get(task.id) ?? JTA_FILLER_ITEM_NAME;
        locations.push({ id: task.id, item, position: null });
        // Grant suppression (Q5, AP-authoritative): any task that
        // vanilla-grants a perk gets its `perk` patched to the Count
        // sentinel so onFullyFinishTask grants nothing locally — the perk
        // arrives only as an AP item (window.grantPerk). Applied per-region
        // on load; safe because a task can't complete before its region is
        // loaded. Independent of where the perk ITEM is placed above.
        if (task.perk) taskPatches.push({ id: task.id, perk: JTA_PERK_COUNT });
    }
    return { locations, payload: { ap_locations: apLocations, task_patches: taskPatches } };
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

    // Declares the substrate exposes AP locations inside its regions
    // (every zone task = a location, opt-in via setJtaEmitZoneLocations).
    // Purely declarative today — no engine code gates on it — but the plan
    // calls for advertising it now that the zone-locations channel emits
    // real locations + a Victory goal.
    supportedFeatures: Object.freeze([
        'region_topology_from_source',
        'arbitrary_ap_locations',
    ]),

    // Item-classification library merged into the pipeline's itemLib for a
    // jta world: perk items (progression), 'JtA Filler' (filler, does
    // nothing), and 'Victory' (the is_victory goal item). See
    // JTA_LIBRARY_ITEMS.
    libraryItems: JTA_LIBRARY_ITEMS,

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
