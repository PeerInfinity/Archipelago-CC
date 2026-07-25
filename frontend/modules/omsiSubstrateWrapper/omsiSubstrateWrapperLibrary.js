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
 * The single Start Journey victory location is emitted unconditionally
 * on the v0 path: no existing preset lists 'omsi' as a content source,
 * so it is inert for every existing world.
 *
 * AP-V1 (unlock-discretization plan §7) adds an OPT-IN randomized
 * pool on top: `substrateConfig.omsi.towns` (1–9, default 1) and
 * `.emitUnlockLocations` (default false). With both at their defaults
 * this module behaves exactly as it did in v0 — the byte-inertness
 * gate every existing preset is regenerated against. With emission on,
 * each town's discovery quantity steps become AP locations carrying
 * `"<Var> Supply Step"` items, and victory moves from town 0's
 * `start_journey` to the last town's `travel_onward`. Pool derivation
 * and the access-rule formula live in ./unlockPool.js.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { generateEntryId } from '../shared/actionQueue/actionTypes.js';
import {
    buildUnlockPool,
    accessRuleFor,
    victoryAccessRule,
    unlockMetaForWorld,
    OMSI_FILLER_ITEM_NAME,
} from './unlockPool.js';

// Host-side PlaybackProxy slot, mirroring the jta library's setter
// injection. Filled by index.js since arc D1: the proxy publishes
// PlaybackController commands on `omsi:playbackControl`, which the
// in-iframe bridge executes.
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

// --- Per-visit recording (loops sole-persister protocol; arc D) ---
//
// omsi is a FINE-GRAINED loop-mode substrate in the capture contract's
// mechanical sense: supplying `takeLastRecording` is what makes
// loopState._captureShapeFor() answer 'fine', so loops charges nothing
// (the bridge's mana mirror IS the economy) and Playback replays through
// the substrate rather than through the generic executor.
//
// What omsi records is an omsi-local fact invisible to loops: ruling 1 of
// the arc-D design makes a visit recording the game's OWN authored queue
// (`actions.next` minus the synthetic exits) at a successful Record exit —
// a plan snapshot, not a performed-action log — because omsi's genre is
// author-a-queue-and-replay and a performed log of an N-loop visit is just
// that queue repeated N times.
//
// Loops remains the sole persister: this module never writes savedQueueStore.
// It converts the bridge's plan snapshot into the shared `actionQueue`
// vocabulary and stashes it in a pull-once slot; loopState pulls via
// takeLastRecording() only on a successful Record-mode exit, and drains-and-
// discards it on wrong-exit / mana-out / reset.
let _lastVisitRecording = null;

/**
 * Host-side receiver for the bridge's `omsi:visitRecording` event (slice 4).
 * Stashes the visit for the loops sole-persister pull, overwriting any
 * un-pulled prior recording (a visit whose Record exit never pulled — Manual
 * mode, or a discarded capture — is simply replaced).
 *
 * `actions` arrive as the fork's NATIVE plan entries (`{name, loops,
 * loopsType, disabled}` — the same shape the bridge stashes per region) and
 * are converted here, host-side, to the shared vocabulary. The conversion
 * lives on this side of the iframe boundary for the jta reason
 * (convertPerformedActionsToQueue is a library function, unit-testable
 * without engine globals) and because the bridge deliberately imports
 * nothing from `shared/`.
 * @param {{ actions?: object[], departureExitId?: string|null }} payload
 */
export function ingestVisitRecording(payload) {
    _lastVisitRecording = {
        actions: convertPlanToQueue(payload?.actions),
        departureExitId: payload?.departureExitId ?? null,
    };
}

/**
 * The fork's authored plan → the shared `actionQueue` vocabulary (jta
 * precedent: `convertPerformedActionsToQueue`). A native entry names an
 * action and how many reps of it the loop should run, which is exactly a
 * `clickTask` with `loops` = reps; `loopsType` and `disabled` ride along as
 * riders so a recording can be reinstalled as the plan it was captured from.
 *
 * The action NAME is the id: omsi action names are stable engine identifiers
 * (`getActionPrototype` keys off them, and the fork's own save format stores
 * names), unlike jta's numeric task ids.
 * @param {object[]} entries native NextActionEntry-shaped objects
 * @returns {object[]}
 */
export function convertPlanToQueue(entries) {
    const out = [];
    for (const e of Array.isArray(entries) ? entries : []) {
        if (typeof e?.name !== 'string' || !e.name) continue;
        out.push({
            entryId: generateEntryId(),
            actionType: 'clickTask',
            actionId: e.name,
            label: e.name,
            loops: _readLoops(e.loops),
            disabled: e.disabled === true,
            loopsType: typeof e.loopsType === 'string' ? e.loopsType : 'actions',
        });
    }
    return out;
}

/**
 * The inverse: a stored recording → native plan entries the bridge can hand
 * straight to `actions.addActionRecord`. Runs host-side (in `replayActions`)
 * for the same reason the forward conversion does, so the bridge's replay
 * install and its per-region plan restore consume ONE shape.
 *
 * Non-`clickTask` entries are dropped rather than guessed at: a recording
 * that somehow carries another substrate's vocabulary must not be turned
 * into a plan entry naming an action this build has never heard of (the
 * fork's loop start THROWS on an unknown name — actionList.js
 * translateClassNames — which is why the bridge filters again on install).
 * @param {object[]} actions shared actionQueue entries
 * @returns {object[]}
 */
export function convertQueueToPlan(actions) {
    const out = [];
    for (const a of Array.isArray(actions) ? actions : []) {
        if (a?.actionType !== 'clickTask') continue;
        if (typeof a.actionId !== 'string' || !a.actionId) continue;
        out.push({
            name: a.actionId,
            loops: _readLoops(a.loops),
            disabled: a.disabled === true,
            loopsType: typeof a.loopsType === 'string' ? a.loopsType : 'actions',
        });
    }
    return out;
}

/** Reps, preserved faithfully (0 included — a plan may hold a 0-rep entry). */
function _readLoops(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 1;
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

// P2 award schedule (cross-game §2d/§9b-pre): installed at pipeline ①
// via applyPipelineConfig ({ awardSchedule }) and emitted into the
// zone-0 payload, which the bridge feeds to the fork carrier
// (IdleLoopsManaged.setAwardSchedule) on omsi:loadRegion. Absent config
// clears it — module state must not leak across builds in one process
// (the panel path re-arranges without reloading modules).
let _awardSchedule = null;
export function getOmsiAwardSchedule() { return _awardSchedule; }

// AP-V1 unlock randomization (unlock-discretization plan §7). Both
// knobs ride the same pipeline-① channel as awardSchedule and default
// to today's behavior exactly: ONE town, NO unlock locations. Every
// existing preset must therefore regenerate byte-identical.
//
// `towns` also drives `zoneCount` (a getter — see below), which bounds
// how many omsi regions a layout driver may allocate.
const OMSI_MAX_TOWNS = 9;
let _townCount = 1;
let _emitUnlockLocations = false;
// arc A: one global scale factor ∈ (0, 1], default 1.0 (byte-inert).
// Per var L_v = I_v = clamp(round(scale·R_v), 1, R_v); scale 1 selects
// every native row so the shipped AP-V1 pool is reproduced exactly.
let _unlockScale = 1;
export function getOmsiTownCount() { return _townCount; }
export function getOmsiEmitUnlockLocations() { return _emitUnlockLocations; }
export function getOmsiUnlockScale() { return _unlockScale; }

// arc C region splitting. Absent ⇒ today's behavior exactly (byte-inert):
// zoneCount is _townCount and no zone carries an omsiRegion descriptor. When
// set, the substrate emits `count` SEPARATE zones that ALL map to the ONE
// `townIndex` (region-overlay on one town — arc C ruling 1), each carrying an
// `omsiRegion` gate descriptor. The exits BETWEEN those zones come from the
// layout's grid adjacency (the region graph the bridge derives synthetics
// from), so the descriptor holds only the gate: which Explore var, and how
// far explored (fraction of the level-100 cap) an exit needs.
let _regionSplit = null;   // { townIndex, count, exploreVar, exploreThreshold } | null
export function getOmsiRegionSplit() { return _regionSplit; }

// Coerce a config value to a region-split descriptor, or null (the byte-inert
// default). Requires an integer count >= 1; townIndex defaults 0, threshold
// defaults 1.0 (100% explored), exploreVar optional (absent ⇒ no gate).
function _readRegionSplit(rs) {
    if (!rs || typeof rs !== 'object') return null;
    const count = Math.trunc(Number(rs.count));
    if (!Number.isFinite(count) || count < 1) return null;
    const townIdx = Math.trunc(Number(rs.townIndex));
    const townIndex = Number.isFinite(townIdx) && townIdx >= 0 ? townIdx : 0;
    const exploreVar = typeof rs.exploreVar === 'string' && rs.exploreVar ? rs.exploreVar : null;
    let threshold = Number(rs.exploreThreshold);
    if (!Number.isFinite(threshold) || threshold < 0) threshold = 1.0;
    if (threshold > 1) threshold = 1.0;
    return { townIndex, count, exploreVar, exploreThreshold: threshold };
}

// Coerce a config value to a valid scale: a finite number in (0, 1],
// anything else (missing / NaN / ≤0 / >1) → the byte-inert default 1.
function _readScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(1, n);
}

// The victory location id for an emission-ON world (ruling (f)): it
// rides the LAST included town, not town 0. The legacy
// `start_journey` id stays the emission-OFF path's id, byte-inert.
export const OMSI_TRAVEL_ONWARD_LOCATION_ID = 'travel_onward';

let _libraryItemsCache = null;

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

    // A getter so an emission-ON world contributes its supply-step
    // items (jta precedent, jtaSubstrateWrapperLibrary.js libraryItems).
    // With emission off this returns the frozen vanilla object —
    // byte-identical to before the knob existed.
    //
    // Supply steps are `progression_skip_balancing`: they ARE logic
    // relevant (the HasFromList counts), but multiworld progression
    // balancing must not churn over hundreds of interchangeable copies
    // of 14 names. 'Bonus Seconds' is the declared filler/balancer; the
    // base pool contains zero copies of it (supply steps are 1:1 with
    // locations), so it only appears if a filler slot ever opens.
    get libraryItems() {
        if (!_emitUnlockLocations) return OMSI_LIBRARY_ITEMS;
        const pool = buildUnlockPool(_townCount, _unlockScale);
        const cacheKey = `${_townCount}:${_unlockScale}:${pool.itemNames.length}`;
        if (_libraryItemsCache?.key === cacheKey) {
            return _libraryItemsCache.lib;
        }
        const lib = {
            [OMSI_FILLER_ITEM_NAME]: { classification: 'filler' },
            [OMSI_VICTORY_ITEM_NAME]: { classification: 'progression', is_victory: true },
        };
        for (const name of pool.itemNames) {
            lib[name] = { classification: 'progression_skip_balancing' };
        }
        _libraryItemsCache = {
            key: cacheKey,
            lib: Object.freeze(lib),
        };
        return _libraryItemsCache.lib;
    },

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

    getPlaybackController: () => _playbackProxy,

    // --- Loop-mode block support (arc D1) ---
    //
    // Declaring `record && playback` is what ARMS the M3b strict action
    // gate for omsi regions: from here on a substrate action (an AP
    // location check, an exit crossing) is only possible while the loops
    // queue is parked on this region's Manual/Record block. Every omsi
    // preset carries loop_costs, so loop mode auto-enables and the gate is
    // live for all of them.
    //
    //   queueActions — regionMove only. The fine script lives in the saved
    //     recording (jta's shape), not in the block interior.
    //   customQueues — false: no queue-authoring panel for omsi.
    //   requiresLoopMode — the M4 loop-game contract flag, which the ruling
    //     explicitly generalizes to omsi: the fork's "budget out → restart
    //     the loop" economy IS the loop-mode reset once its zones are host
    //     regions, so there is no coherent standalone mode to fall back to.
    //   NO `instant` — the fork has no fast-step surface (no setInstantMode
    //     / stepTick; the clock is deliberately flat at 50 t/s), and omsi
    //     Instant is the standing last-of-all-substrates item.
    //   NO `executeVia` — the Bot is the fork's own automation PLANNER,
    //     scheduled as arc D2 behind a feasibility recon. Until then
    //     regionSolver() returns null and the Bot radio never renders.
    //   NO `summaryRecording` — omsi is fine-grained (takeLastRecording).
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove']),
        manual: true,
        customQueues: false,
        record: true,
        playback: true,
        requiresLoopMode: true,
    }),

    // The fine-grained capture hook. Its PRESENCE is what classifies omsi
    // as fine-grained (loopState._captureShapeFor), so it is declared with
    // the capabilities rather than with slice 4's capture implementation —
    // a coarse omsi would double-bill every visit (loops charging
    // loop_costs on top of the bridge's native mana mirror).
    takeLastRecording: () => takeLastVisitRecording(),

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
    // How many omsi regions (towns) a layout driver may allocate. A
    // GETTER, not a static 1 — the pipeline-① config installs the
    // world's `towns` BEFORE arrangement precisely so the
    // quota-vs-zoneCount validation sees the live value. Getters
    // defined in an object literal survive Object.freeze and keep
    // evaluating, so the frozen entry still tracks the config.
    // Default 1 ⇒ v0 behavior (Beginnersville only), unchanged.
    get zoneCount() { return _regionSplit ? _regionSplit.count : _townCount; },

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
        const towns = Number(cfg?.towns);
        _townCount = Number.isFinite(towns)
            ? Math.min(OMSI_MAX_TOWNS, Math.max(1, Math.trunc(towns)))
            : 1;
        _emitUnlockLocations = cfg?.emitUnlockLocations === true;
        _unlockScale = _readScale(cfg?.unlockScale);
        _regionSplit = _readRegionSplit(cfg?.regionSplit);
        _libraryItemsCache = null;
    },

    extractZoneRules: (zoneIdx, { region_id } = {}) => {
        const locations = [];

        // ── arc C region splitting: every zone is an OVERLAY of the one
        // town (omsiTown = townIndex, not the zone ordinal), carrying only
        // the Explore-gate descriptor. Exits between zones come from the
        // layout's grid adjacency (the bridge derives synthetics from the
        // region graph). No AP location partition (ruling 7) — the single
        // completion item rides zone 0, emission-off shape.
        if (_regionSplit) {
            const payload = {
                omsiTown: _regionSplit.townIndex,
                omsiRegion: {
                    townIndex: _regionSplit.townIndex,
                    regionId: region_id,
                    ...(_regionSplit.exploreVar ? { exploreVar: _regionSplit.exploreVar } : {}),
                    exploreThreshold: _regionSplit.exploreThreshold,
                },
            };
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
                if (_awardSchedule) {
                    payload.awardSchedule = JSON.parse(JSON.stringify(_awardSchedule));
                }
            }
            return { locations, payload };
        }

        const payload = { omsiTown: zoneIdx };

        // ── Emission ON (AP-V1): the zone's town contributes its
        // discovery quantity-step locations, and the LAST included town
        // carries the victory location. Throws (via buildUnlockPool) if
        // the caller enabled emission without awaiting ensureUnlockTable.
        if (_emitUnlockLocations) {
            const pool = buildUnlockPool(_townCount, _unlockScale);
            const zone = pool.zones[zoneIdx];
            const apLocations = {};
            for (const loc of (zone?.locations ?? [])) {
                const rule = accessRuleFor(loc);
                locations.push({
                    id: loc.id,
                    item: loc.item,
                    position: null,
                    ...(rule ? { access_rule: rule } : {}),
                });
                // Keyed by the RAW row id — that is the vocabulary the
                // fork's seedReportedLocations/onUnlockAchieved speak.
                apLocations[loc.rowId] = `${region_id}__${loc.id}`;
            }
            if (zoneIdx === _townCount - 1) {
                const vRule = victoryAccessRule(pool);
                locations.push({
                    id: OMSI_TRAVEL_ONWARD_LOCATION_ID,
                    item: OMSI_VICTORY_ITEM_NAME,
                    position: null,
                    ...(vRule ? { access_rule: vRule } : {}),
                });
                apLocations[OMSI_TRAVEL_ONWARD_LOCATION_ID] =
                    `${region_id}__${OMSI_TRAVEL_ONWARD_LOCATION_ID}`;
                // The bridge's victory watch is `townsUnlocked.includes(N)`;
                // carrying N on the payload spares it any config plumbing.
                payload.victoryTown = _townCount;
            }
            payload.ap_locations = apLocations;
            payload.unlockMeta = unlockMetaForWorld(pool);
            if (zoneIdx === 0 && _awardSchedule) {
                payload.awardSchedule = JSON.parse(JSON.stringify(_awardSchedule));
            }
            return { locations, payload };
        }

        // ── Emission OFF (default): the v0 path, untouched.
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
