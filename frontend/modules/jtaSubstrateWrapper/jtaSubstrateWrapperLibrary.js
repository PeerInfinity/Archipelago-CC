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
 *
 * Phase 3a: each location also carries a loose count-based `access_rule`
 * (setJtaFreeZones / setJtaStartingPerks) so AP's fill produces a real
 * sphere ORDER. Without it every location is `True_`, the whole game
 * collapses into sphere 0, Victory sits in logic immediately, and the
 * §2b post-fill balancing pass has no progression to walk.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { JTA_VANILLA_DATASET } from './vanillaDataset.js';
import { activePerkItemNames } from './perkOrigin.js';
import { createRng } from '../shared/rng.js';
import { validateJtaDataset, stampDatasetIdentity } from './datasetValidator.js';
import { generateEntryId } from '../shared/actionQueue/actionTypes.js';

// Host-side PlaybackProxy, injected by index.js's initialize() once the
// eventBus exists (setter injection rather than importing index.js so
// this library stays headless-import-safe — Node unit tests import it
// without the panel/gameState graph). Null until then; registry callers
// treat null as "no controller available" and no-op.
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

// --- Per-visit fine recording (M4 loops sole-persister protocol) ---
//
// jta is a FINE-GRAINED loop-mode substrate: the fork's performed-actions
// log is the full-visit stream. The in-iframe bridge slices ONE region
// visit out of that log (marking the log index at region entry, slicing at
// exit, dropping the departure trigger), and publishes the raw slice as a
// `jta:visitRecording` event BEFORE it publishes the departing
// user:regionMove — both cross the iframe→host boundary over the same
// postMessage channel in call order, so the host stores the slice before
// the loops Record-exit wake pulls it (the M2/M3b stash-before-regionMove
// ordering; the maze/TA precedent).
//
// Loops is the SOLE persister: this module never writes savedQueueStore.
// It converts the raw slice to the shared/actionQueue vocabulary the
// jtaQueueEngine executor replays and stashes it in a pull-once slot;
// loopState pulls via takeLastRecording() only on a successful Record-mode
// exit, and drains-and-discards it on wrong-exit / mana-out / reset. Since
// the pull clears the slot, a discarded visit can't be re-pulled by a
// later block — the next visit overwrites the slot regardless.
let _lastVisitRecording = null;

/**
 * Host-side receiver for the bridge's `jta:visitRecording` event. Converts
 * the raw performed-actions slice to actionQueue entries and stashes the
 * recording for the loops sole-persister pull. Overwrites any un-pulled
 * prior recording (a visit whose Record exit never pulled — e.g. Manual
 * mode, or a discarded capture — is simply replaced).
 * @param {{ region?: string, departureExitId?: string|null, actions?: object[] }} payload
 */
export function ingestVisitRecording(payload) {
    _lastVisitRecording = {
        actions: convertPerformedActionsToQueue(payload?.actions),
        departureExitId: payload?.departureExitId ?? null,
    };
}

/**
 * Pull-and-clear the last finalized per-visit recording. Returns null when
 * no recording is stashed. Registry hook `takeLastRecording` delegates here.
 * @returns {{ actions: object[], departureExitId: string|null }|null}
 */
export function takeLastVisitRecording() {
    const rec = _lastVisitRecording;
    _lastVisitRecording = null;
    return rec;
}

/**
 * Convert the fork's performed-actions slice into the game-agnostic
 * shared/actionQueue vocabulary the jtaQueueEngine executor consumes:
 *   - a coalesced task rep-run → one `clickTask` entry, `loops` = reps;
 *   - an item use → one `useItem` entry, `loops` = count.
 * The departure trigger (Travel / synthetic exit task) is already excluded
 * upstream by the bridge slice, so every entry here is replayable interior
 * content. Item entries carry the fork's numeric ItemType as actionId
 * (what BridgeTransport.clickItem forwards); task entries carry task_id.
 * @param {object[]} actions
 * @returns {object[]}
 */
export function convertPerformedActionsToQueue(actions) {
    const out = [];
    for (const a of Array.isArray(actions) ? actions : []) {
        if (a?.type === 'task') {
            if (typeof a.task_id !== 'number') continue;
            out.push({
                entryId: generateEntryId(),
                actionType: 'clickTask',
                actionId: a.task_id,
                label: a.name ?? String(a.task_id),
                loops: (typeof a.reps === 'number' && a.reps > 0) ? a.reps : 1,
                disabled: false,
            });
        } else if (a?.type === 'item') {
            if (a.item == null) continue;
            out.push({
                entryId: generateEntryId(),
                actionType: 'useItem',
                actionId: a.item,
                label: a.name ?? String(a.item),
                loops: (typeof a.count === 'number' && a.count > 0) ? a.count : 1,
                disabled: false,
            });
        }
    }
    return out;
}

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
    _universeCache = null;
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
    _universeCache = null;
}
export function getJtaGoalZone() { return _goalZone; }

// Loose count-based zone gating, ported from the old worlds/jta apworld
// (Rules.py + Options.py): zone Z requires
//   max(0, Z - free_zones + 1 - starting_perks)
// perks — ANY perks, not specific ones, so AP fill keeps maximum freedom
// while the sphere log still follows zone order (plan §6 open-q 9, loose
// over strict). Defaults match the apworld's: only zone 0 is free, and
// zone Z then requires Z perks.
//
// The old apworld put this on the zone→zone ENTRANCE. We put it on each
// zone's LOCATIONS instead: the procgen layout drivers place zones on a
// grid and stitch arbitrary spiral exits, so region adjacency carries no
// zone ordering to hang an entrance rule on.
let _freeZones = 1;
export function setJtaFreeZones(n) {
    _freeZones = (typeof n === 'number' && n >= 1) ? Math.floor(n) : 1;
}
export function getJtaFreeZones() { return _freeZones; }

let _startingPerks = 0;
export function setJtaStartingPerks(n) {
    _startingPerks = (typeof n === 'number' && n >= 0) ? Math.floor(n) : 0;
}
export function getJtaStartingPerks() { return _startingPerks; }

// --- Synthetic dataset mode (Phase 5d, jta-synthetic-data-plan §4.1) ---
//
// When a dataset document is active, the pipeline reads IT instead of the
// vanilla fixture (datasets/vanilla.json): zoneCount comes from the dataset,
// zone
// tasks/perk placement come from its zones, the grant-suppression sentinel
// is the DATASET's perk count, and every emitted region's payload carries
// the dataset carriage (single-carrier + refs, ruling 4): the first jta
// region (zone 0 — linear v1 rides the spiral driver, which maps the Nth
// jta region to zone N) carries `jta_dataset` (the full document); EVERY
// jta region carries `jta_dataset_ref: {dataset_id, schema_version}`.
// procgenPlayer resolves refs at warehouse build; the bridge applies the
// dataset via window.loadGameData before task patches.
//
// null (default) keeps the vanilla path byte-identical.
let _dataset = null;
export function setJtaDataset(dataset) {
    if (dataset != null) {
        const result = validateJtaDataset(dataset);
        if (!result.ok) {
            throw new Error(`setJtaDataset: invalid dataset:\n  ${result.errors.join('\n  ')}`);
        }
    }
    _dataset = dataset ?? null;
    _placementCache = null;
    _universeCache = null;
    _zoneViewCache = null;
    _libraryItemsCache = null;
}
export function getJtaDataset() { return _dataset; }

// Normalized zone/task view over whichever source is active — the vanilla
// fixture or a synthetic dataset (ONE derivation; both are jta-dataset
// documents since unification U-a). Shape matches what the placement
// machinery needs: zones[zoneIdx] = { zone, tasks: [{ id,
// perk: <item name|null> }] }, plus the grant-suppression sentinel (the
// source's perk count) and the excluded task ids. The exclusion set stays
// source-specific: vanilla keeps the v1-scoped SBtV four (the fixture's
// prestige.sbtv_unlock_task_ids also lists 209/zone-20, which the vanilla
// channel has never excluded); synthetic datasets carry [] by generation.
let _zoneViewCache = null;
let _libraryItemsCache = null;
function _zoneView() {
    if (_zoneViewCache) return _zoneViewCache;
    const doc = _dataset ?? JTA_VANILLA_DATASET;
    _zoneViewCache = {
        zones: doc.zones.map((z, i) => ({
            zone: i,
            tasks: z.tasks.map((t) => ({
                id: t.id,
                perk: t.perk != null ? (doc.perks[t.perk]?.name ?? null) : null,
            })),
        })),
        perkCount: doc.perks.length,
        excluded: _dataset
            ? new Set(_dataset.prestige?.sbtv_unlock_task_ids ?? [])
            : SBTV_GATED_TASK_IDS,
    };
    return _zoneViewCache;
}

// Memoized canonical placement, keyed by (shuffleSeed, goalZone).
let _placementCache = null; // { key, byZone: Map<zoneIdx, Map<taskId, itemName>> }
let _universeCache = null;  // { key, names: string[] }

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
// surface for perks. Sourced from the regenerable vanilla fixture via the
// single shared derivation (perkOrigin.activePerkItemNames); equals the
// fork's PERKS[].name (so window.grantPerk resolves these by name).
export const JTA_PERK_ITEM_NAMES = Object.freeze(activePerkItemNames(null));

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

// Identity placement: each perk on its own native task.
function _placeIdentity(ensureZone) {
    const view = _zoneView();
    for (const zone of view.zones) {
        for (const t of zone.tasks) {
            if (view.excluded.has(t.id)) continue;
            if (t.perk) ensureZone(zone.zone).set(t.id, t.perk);
        }
    }
}

// Compute (memoized) the canonical item placement across the emitted zone
// range: which task location holds which perk / Victory item. Filler is the
// default at the call site (any task not in the returned map). Returns
// Map<zoneIdx, Map<taskId, itemName>>.
function _computePlacement() {
    const view = _zoneView();
    const key = `${_dataset?.dataset_id ?? ''}|${_perkShuffleSeed}|${_goalZone}`;
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
            const zone = view.zones[z];
            if (!zone) continue;
            for (const t of zone.tasks) {
                if (view.excluded.has(t.id)) continue;
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
        const zone = view.zones[_goalZone];
        if (zone) {
            const zoneMap = ensureZone(_goalZone);
            const slot = zone.tasks.find((t) =>
                !view.excluded.has(t.id) && !zoneMap.has(t.id));
            if (slot) zoneMap.set(slot.id, JTA_VICTORY_ITEM_NAME);
        }
    }

    _placementCache = { key, byZone };
    return byZone;
}

// The perk item names that actually reach the AP pool: the perks placed on
// emitted zones (0..goalZone). Derived from the placement map rather than
// from the source document so it tracks the SBtV exclusions and the shuffle
// bound automatically — a perk stranded on an unemitted zone is not in the
// pool and must not appear in an access rule's item_names. Sorted to match
// rule_builder's HasFromListUnique, which stores `tuple(sorted(set(...)))`.
function _perkUniverse() {
    const key = `${_dataset?.dataset_id ?? ''}|${_perkShuffleSeed}|${_goalZone}`;
    if (_universeCache && _universeCache.key === key) return _universeCache.names;

    const byZone = _computePlacement();
    const maxZone = _goalZone ?? (_zoneView().zones.length - 1);
    const names = new Set();
    for (let z = 0; z <= maxZone; z++) {
        for (const item of byZone.get(z)?.values() ?? []) {
            if (item !== JTA_VICTORY_ITEM_NAME) names.add(item);
        }
    }
    const sorted = [...names].sort();
    _universeCache = { key, names: sorted };
    return sorted;
}

// How many perks zone `zoneIdx` demands. Capped at the universe size:
// HasFromListUnique resolves to False_ when count > len(item_names), which
// would make the whole zone unreachable and fail fill.
function _perksRequiredForZone(zoneIdx, universeSize) {
    const offset = _freeZones - 1 + _startingPerks;
    return Math.min(Math.max(0, zoneIdx - offset), universeSize);
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
    const view = _zoneView();
    const zone = view.zones[zoneIdx];
    if (!zone) return { locations: [], payload: {} };
    const placement = _computePlacement().get(zoneIdx) ?? new Map();
    const universe = _perkUniverse();
    const required = _perksRequiredForZone(zoneIdx, universe.length);
    // Free zones carry no access_rule at all — assembleZoneRegion omits the
    // field and world_generator emits the `True_` default, exactly as before
    // this rule existed.
    const accessRule = required > 0
        ? { rule: 'HasFromListUnique', args: { item_names: universe, count: required } }
        : null;
    const apLocations = {};
    const locations = [];
    const taskPatches = [];
    for (const task of zone.tasks) {
        if (view.excluded.has(task.id)) continue;
        apLocations[task.id] = `${region_id}__${task.id}`;
        const item = placement.get(task.id) ?? JTA_FILLER_ITEM_NAME;
        locations.push({
            id: task.id, item, position: null,
            ...(accessRule ? { access_rule: accessRule } : {}),
        });
        // Grant suppression (Q5, AP-authoritative): any task that
        // natively grants a perk gets its `perk` patched to the Count
        // sentinel (the ACTIVE source's perk count — the dataset's when one
        // is loaded) so onFullyFinishTask grants nothing locally — the perk
        // arrives only as an AP item (window.grantPerk). Applied per-region
        // on load; safe because a task can't complete before its region is
        // loaded. Independent of where the perk ITEM is placed above.
        if (task.perk) taskPatches.push({ id: task.id, perk: view.perkCount });
    }
    const payload = { ap_locations: apLocations, task_patches: taskPatches };
    if (_dataset) {
        // Dataset carriage (ruling 4, single-carrier + refs): every region
        // carries the ref; the first jta region (zone 0) carries the full
        // document. procgenPlayer's warehouse resolves refs at rules load.
        payload.jta_dataset_ref = {
            dataset_id: _dataset.dataset_id,
            schema_version: _dataset.schema_version,
        };
        if (zoneIdx === 0) payload.jta_dataset = _dataset;
    }
    return { locations, payload };
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
    // nothing), and 'Victory' (the is_victory goal item). A getter so a
    // loaded dataset's perk names replace the vanilla ones (memoized by
    // dataset_id); with no dataset this returns the frozen vanilla
    // JTA_LIBRARY_ITEMS object, exactly as before.
    get libraryItems() {
        if (!_dataset) return JTA_LIBRARY_ITEMS;
        if (!_libraryItemsCache || _libraryItemsCache.id !== _dataset.dataset_id) {
            const names = [...new Set(_zoneView().zones
                .flatMap((z) => z.tasks.map((t) => t.perk).filter(Boolean)))];
            _libraryItemsCache = {
                id: _dataset.dataset_id,
                lib: Object.freeze({
                    [JTA_FILLER_ITEM_NAME]: { classification: 'filler' },
                    [JTA_VICTORY_ITEM_NAME]: { classification: 'progression', is_victory: true },
                    ...names.reduce((acc, name) => {
                        acc[name] = { classification: 'progression' };
                        return acc;
                    }, {}),
                }),
            };
        }
        return _libraryItemsCache.lib;
    },

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

    // Runtime — recording (M4 loops sole-persister protocol). Pull-and-clear
    // the last finalized per-visit recording the bridge stashed. Its presence
    // is what marks jta FINE-GRAINED to loops (the coarse-vs-fine
    // discriminator is `takeLastRecording` on the registry entry); loops
    // persists it to savedQueueStore only on a successful Record-mode exit.
    takeLastRecording: () => takeLastVisitRecording(),

    // Loop-mode capabilities (M4). jta is a FINE-GRAINED substrate:
    //   - record + playback: DECLARED — the fork performed-actions recorder
    //     is the full-visit stream (takeLastRecording above), and Playback
    //     replays the captured clickTask/useItem script through the
    //     jtaQueueEngine executor. Declaring both OPTS JTA INTO THE STRICT
    //     ACTION GATE (M3b staged enforcement): substrate actions are only
    //     possible while the queue is parked on a matching Manual/Record
    //     block. A Playback block WITHOUT a bound recording parks for live
    //     play (Manual behavior) — the walkTo/delegation auto chain is
    //     unreachable from Playback until M6's Bot radio (executeVia stays
    //     declared for that future path + the current pre-record flows).
    //   - instant: DECLARED — a Playback block drains its recorded script in
    //     one frame via the fork's stepTick pump (setInstantMode + drive
    //     stepTick while the game loop is unpaused).
    //   - customQueues stays false — the queue panel (port arc Phase 3b) is
    //     deferred; flip it when that lands (user ruling 2026-07-23).
    //   - requiresLoopMode: DECLARED — a general contract flag (not a jta
    //     special case; omsi and future loop-game substrates adopt it too).
    //     jta regions are NOT supported outside loop mode: the fork's native
    //     economy has reset-to-zone-0 baked in, and with zones mapped to host
    //     regions a native reset IS a host teleport-to-start (the loop-mode
    //     reset teleport). The energy<->shared-pool sync + reset propagation
    //     are therefore always-on by CONTRACT (user ruling 2026-07-23). loops
    //     enforces this by refusing a manual loop-mode DISABLE while a
    //     requires-loop-mode world is loaded (preset auto-enable/disable
    //     already covers rules loads). Standalone jta play stays on the legacy
    //     ?mode=jta stack. See loop-recording.md.
    // regionMove is still the only queue-grade (block-interior) action; the
    // fine clickTask/useItem script lives in the saved recording, not the
    // block interior (jta v1 regions emit no AP locations / explores).
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove']),
        manual: true,
        customQueues: false,
        record: true,
        playback: true,
        instant: true,
        requiresLoopMode: true,
        executeVia: 'solver',
    }),

    // Cross-substrate sharing: participates in the shared-mana channel.
    // The in-iframe bridge publishes the generic channel events
    // (substrate:resourceDelta/Bonus/Reset with substrateId 'jta');
    // the resourceChannels router validates them against this
    // declaration.
    //
    // items: the shareable consumable types (D2), as display NAMES —
    // grantPerk's precedent, and what "jta/Fish" namespacing reads as.
    // Derived from the ACTIVE source document (same source as zoneCount:
    // dataset worlds rename items via namebanks, so a static list would
    // drift; the vanilla fixture is regenerated from the fork build).
    // Behavior-slotted items (the artifacts — `behavior` non-null) are
    // non-portable and excluded per D2.
    sharing: Object.freeze({
        mana: Object.freeze({}),
        items: Object.freeze({
            getTypes: () => (_dataset ?? JTA_VANILLA_DATASET).items
                .filter((it) => it && it.behavior == null
                    && typeof it.name === 'string' && it.name.length > 0)
                .map((it) => it.name),
        }),
    }),

    // Build-time hooks (generateRegionCore / placeFromItems / etc.)
    // are omitted in v1 — procgen does not generate JtA-specific
    // region content; it just records `jtaZone` in the sidecar.
    //
    // --- Zone-based substrate metadata ---
    //
    // Layout drivers that map grid positions to ordered "zones"
    // (currently arrangeShuffledSpiral) read `zoneCount` (how many
    // discrete zones this substrate exposes — drivers refuse to
    // allocate more regions than this) and the `extractZoneRules`
    // content channel below (the sole per-zone payload contributor
    // since region-library C1 absorbed the former synthesizeZonePayload
    // hook into it).
    //
    // Total zone count — the active source document's zone count: the
    // dataset's when one is loaded (the dataset IS the game data the fork
    // will load), the vanilla fixture's otherwise. The fixture is
    // regenerated from the fork build (export-vanilla-dataset.mjs), so
    // there is no hand-synced literal to drift; the runtime still warns on
    // loadZone and refuses a bad index as a backstop.
    get zoneCount() { return (_dataset ?? JTA_VANILLA_DATASET).zones.length; },

    // Zone-locations channel: the sole per-zone playable_payload
    // contributor. `jtaZone` (the zone ordinal the fork reads to load
    // the right zone) is always emitted as the FIRST payload key —
    // absorbed here from the former synthesizeZonePayload hook
    // (region-library C1), which the engine used to compose ahead of
    // this channel's payload. Byte-identical to the pre-C1 order.
    //
    // The zone-LOCATIONS half is opt-in (setJtaEmitZoneLocations): off,
    // the payload is just {jtaZone}; on, it also emits the zone's tasks
    // as AP locations (buildZoneLocations) alongside jtaZone.
    extractZoneRules: (zoneIdx, { region_id } = {}) => {
        if (!_emitZoneLocations) return { locations: [], payload: { jtaZone: zoneIdx } };
        const result = buildZoneLocations(zoneIdx, region_id);
        return { ...result, payload: { jtaZone: zoneIdx, ...result.payload } };
    },

    // --- Stepped-spiral ② content seam (stepped-spiral-parity plan Part 3) ---
    //
    // The spiral pipeline installs a jta world's dataset + zone-locations
    // config through these hooks instead of the module-global setters, so a
    // preset can CARRY the config and the pipeline applies it deterministically:
    // ① arrange calls applyPipelineConfig BEFORE the zoneCount-gated quota
    // validation (so the validation sees the dataset's real zone count, design
    // §6.3 "run the generator before arrangement"); ② content materialises the
    // installed document onto the envelope as the editable artifact; the spiral
    // descriptor re-applies it on every deserialize (globals don't cross a
    // process boundary) and restamps a hand-edited document.
    //
    // The standalone setters (setJtaDataset etc.) stay for the CLI/test callers
    // that drive the monolith directly — this seam is a NEW caller of them, not
    // a replacement.
    //
    // Generation stays a Node concern (the profile/vanilla fixtures aren't
    // bundled): cfg carries an already-generated `datasetDoc` (the spiral-step
    // CLI / tests produce it). Every field defers to its setter's own default,
    // so applyPipelineConfig({}) resets the vanilla path exactly — a jta world
    // with no dataset config stays byte-identical to before this seam existed.
    emitsSpiralContent: true,

    // Content-source contract (region-library C3): the ② content seam reads this
    // source's installed document from `substrateConfig.jta.datasetDoc` and its
    // stamped id from the document's `dataset_id`. Naming the field here (rather
    // than hardcoding `datasetDoc` in spiralSteps) is what lets a region library
    // ride the same ② seam under its own field/id.
    spiralContentConfigKey: 'datasetDoc',

    applyPipelineConfig: (cfg) => {
        const c = cfg ?? {};
        setJtaDataset(c.datasetDoc ?? null);
        setJtaEmitZoneLocations(c.emitZoneLocations);
        setJtaGoalZone(c.goalZone);
        setJtaFreeZones(c.freeZones);
        setJtaStartingPerks(c.startingPerks);
        setJtaPerkShuffleSeed(c.perkShuffleSeed);
        return getJtaDataset();
    },

    // The installed content document for the ② content step to materialise onto
    // the envelope as the editable artifact (null when no dataset is active).
    getSpiralContent: () => getJtaDataset(),

    // Restamp a (possibly hand-edited) dataset document: recompute the content
    // hash and rewrite the dataset_id suffix (the datasetValidator --restamp
    // path), then validate. The spiral descriptor calls this on every envelope
    // deserialize; the returned document's id lets the harness detect a real
    // content edit (id changed ⇒ invalidate the downstream regions/compile) and
    // keeps the (seed, dataset_id) Pass-B cache + id-keyed save slot honest.
    // Idempotent: an unchanged document restamps to the same id.
    onContentEdit: (doc) => {
        if (doc == null) return doc;
        stampDatasetIdentity(doc);
        const result = validateJtaDataset(doc);
        if (!result.ok) {
            throw new Error(
                `jta onContentEdit: invalid dataset after restamp:\n  ${result.errors.join('\n  ')}`,
            );
        }
        return doc;
    },
});

// Side-effect on import: register the JtA substrate so the procgen
// pipeline can resolve it without booting the panel module. Same
// pattern as mazeRoom/textAdventureSubstrateWrapper libraries — idempotent
// because index.js's host hook also calls register() in the live app.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
