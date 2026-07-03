/**
 * Substrate registry entry for the Runner Demo (auto-runner platformer)
 * — plan §4.7; bounceDemoLibrary.js is the model.
 *
 * The entry is a MERGE: flash runtime plumbing (exits-Map
 * de/serializeWorld for the sidecar round-trip, playback stub — via
 * createFlashSubstrateEntry) + runner's own panel identity + the
 * zone-based build-time hooks. Runner rides flashSubstrate's bridge and
 * panel CLASS (see index.js) but registers its own panel component +
 * loadRegion event + iframeId, because the flash panel instance shows
 * one hardcoded page, host activation keys on panelComponentType, and
 * procgenPlayer re-publishes the active region's load event on THIS
 * iframe's appReady (closing the load-before-subscribe race).
 *
 * Unlike bounce (whose default ZONES are cheap hand-authored fixtures),
 * runner's default zone table comes from generateZoneSet — a
 * generate-and-verify run that costs several SECONDS of solver time.
 * It is therefore built LAZILY on first use: `zoneCount` is a config
 * constant the layout drivers can read for free, and the zone set only
 * materializes when extractZoneRules is first invoked (a build-time
 * path — the runtime player never calls it). Fixed seed ⇒ the same
 * deterministic table every session.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import {
    generateZoneSet, generateLevelForSpecsGen, SWEEP_SATURATING_PROFILES,
} from './generator.js';
import { makeExtractZoneRules, assembleRunnerRegion } from './zoneRules.js';
import {
    RUNNER_LIBRARY_ITEMS, RUNNER_LIBRARY_OBSTACLES,
    ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME,
} from './apRules.js';
import { DEFAULT_PROFILE_ID } from './physics.js';
import {
    DEFAULT_RUNNER_PROCGEN_PARAMS, buildRunnerRegionParams, renderRunnerProcgenParams,
} from './runnerProcgenParams.js';

export { SWEEP_SATURATING_PROFILES };

// Shared across every runner entry — same Shape-1 reasoning as flash's
// FLASH_PANEL_COMPONENT_TYPE/FLASH_LOAD_REGION_EVENT: all runner zone-set
// ids resolve to the ONE runner panel + load event. Runner gets its OWN
// event (not flash:loadRegion) so the flash placeholder's bridge isn't
// configured by runner region loads and host activation brings the right
// panel forward; its own iframeId so the AdapterClients don't collide.
export const RUNNER_PANEL_COMPONENT_TYPE = 'runnerDemoPanel';
export const RUNNER_LOAD_REGION_EVENT = 'runner:loadRegion';
export const RUNNER_IFRAME_ID = 'runnerDemo';
// Playback-bot control channel (phase 8): the host-side PlaybackProxy
// will publish controller commands here; the shared flash bridge
// subscribes (it learns the event name from the iframe URL's
// playbackControlEvent param). Declared now so the iframe URL and the
// loops executeVia contract don't change when the bot driver lands.
export const RUNNER_PLAYBACK_CONTROL_EVENT = 'runner:playbackControl';

// Default zone-table config (the generateZoneSet contract): zone 0
// grants the first ability with requirement [], fillers grant nothing,
// the last zone's pickup is Victory. Fixed seed keeps the lazy table
// deterministic across sessions and headless runs.
export const RUNNER_ZONE_COUNT = 5;
export const RUNNER_ZONE_SEED = 1;

let _defaultZones = null;
/** The default entry's zone table, generated on first use (see header)
 *  and cached for the session. Exported for tests and CLI drivers. */
export function getRunnerZones() {
    _defaultZones ??= generateZoneSet({
        count: RUNNER_ZONE_COUNT, seed: RUNNER_ZONE_SEED,
    });
    return _defaultZones;
}

// Host-side PlaybackProxy, injected by runnerDemo/index.js when the
// bot driver lands (phase 8; the library stays dependency-free so
// headless CLI drivers can import it without pulling in panel/eventBus
// code). Before injection — and forever headless — getPlaybackController
// returns null and the playback bot no-ops on runner regions.
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

// Host touch-controls override (moduleSettings.runnerDemo.touchControls,
// injected by index.js): undefined = auto (the game page's coarse-pointer
// media query / ?touch= URL param decide), true/false = force. Rides the
// region payload as params.touchControls — the bridge's configure()
// forwards params verbatim and the game page applies a defined
// touchControls as the host override (main.js installTouch). Stamped at
// deserializeWorld time (warehouse build), so a setting change takes
// effect on the next rules/world load.
let _touchControlsOverride;
export function setTouchControlsOverride(value) {
    _touchControlsOverride = (value === undefined || value === null)
        ? undefined : !!value;
}

// ── Sphere-growth adapter hooks (plan §4.9; bounce's are the model) ──

const ABILITY_BY_ITEM_NAME = Object.freeze(Object.fromEntries(
    Object.entries(ABILITY_ITEM_NAMES).map(([ability, name]) => [name, ability])));

/** AP item names runner realises as PHYSICS gate geometry. Unlike
 *  bounce (gateableItems: null — full vocabulary), runner declares
 *  this AS its gate vocabulary: the grower only composes runner-hosted
 *  exit gates on these items. Non-geometry gate terms (foreign items
 *  via top-down, count > 1 instances) still realise as authored
 *  bridge-evaluated logic_gate locks. */
export const GATEABLE_ITEMS = Object.freeze(Object.values(ABILITY_ITEM_NAMES));

/**
 * Split a driver requirement (AP item names + optional counts) into
 * the physics part (ability ids for the strip generator) and the
 * authored part ([{ item, count }] for the bridge-evaluated lock).
 */
function splitRequirement(requirement, counts = {}) {
    const physics = [];
    const authored = [];
    for (const name of requirement ?? []) {
        const count = counts?.[name] ?? 1;
        const ability = ABILITY_BY_ITEM_NAME[name];
        if (ability && count === 1) physics.push(ability);
        else authored.push({ item: name, count });
    }
    return { physics, authored };
}

/**
 * Build the structural gate-hosting veto for a physics profile — the
 * runner analog of bounce's canHostExitGates, mirroring
 * planStripSpecs' constraints applied to each gate's PHYSICS PART
 * (authored terms impose no geometry):
 *
 *   - All physics parts must form one NESTED CHAIN: a strip realises
 *     gates sequentially, so incomparable requirements ({dj} vs
 *     {blue}) have no window ordering that derives both exactly.
 *   - On sweep-saturating profiles (sonic/meatboy — the calibration
 *     sweep caps out, so every gate window is unverifiable) NO physics
 *     gate may be composed at all: refuse the spec here rather than
 *     emit one the generate-and-test loop can never verify (plan §4.9
 *     calibration constraints).
 *
 * Conservative: a true here can still be declined by the generator,
 * but only for geometry dead-ends (retried), not structure. The back
 * portal is ungated (backPortalGated), so it is never in
 * `existingGates` and imposes no constraint.
 *
 * Gates arrive in the driver's vocabulary: arrays of AP item names
 * (count 1) or { item, count } terms.
 */
export function makeExitGateVeto(physicsProfile = DEFAULT_PROFILE_ID) {
    const saturating = SWEEP_SATURATING_PROFILES.includes(physicsProfile);
    return function canHost(existingGates, newGate) {
        const physicsParts = [...existingGates, newGate].map((gate) =>
            gate.map((term) => (typeof term === 'string' ? { item: term, count: 1 } : term))
                .filter(({ item, count }) => ABILITY_BY_ITEM_NAME[item] && (count ?? 1) === 1)
                .map(({ item }) => item));
        if (saturating && physicsParts[physicsParts.length - 1].length > 0) return false;
        const cores = physicsParts.map((g) => [...new Set(g)].sort())
            .sort((a, b) => a.length - b.length);
        for (let i = 1; i < cores.length; i++) {
            if (!cores[i - 1].every((x) => cores[i].includes(x))) return false;
        }
        return true;
    };
}

/** The default-profile veto (the engine's fallback when a substrate
 *  declares no exitGateVeto selector). */
export const canHostExitGates = makeExitGateVeto();

/** Structural gate-hosting veto selected by the world's regionParams
 *  (the profile decides whether physics gates exist at all). */
export function exitGateVeto(regionParams) {
    return makeExitGateVeto(regionParams?.runnerPhysicsProfile ?? DEFAULT_PROFILE_ID);
}

/**
 * Is a region's guaranteed back portal gated on its entry item?
 * Runner: NO, always — the entrance-side back portal is an ungated
 * early branch tip the player spawns past (you can only BE in the
 * region having satisfied its entry gate, so a free way back grants no
 * reachability you didn't have — the same monotone-soundness argument
 * as bounce's braid). Drives BOTH the engine's back-portal requirement
 * AND the grower's gate-slot accounting.
 */
export function backPortalGated() {
    return false;
}

/** Surplus exits ride elevated branch tips natively (exit_br0..N) —
 *  no drift device needed (runner declares no driftItems either). */
export function hostsSurplusExitsNatively() {
    return true;
}

/**
 * Guidance appended to the grower's "no host can realise a wave gate"
 * error — runner's realisable-gate constraints.
 */
export function gateHostingHint(regionParams) {
    const profile = regionParams?.runnerPhysicsProfile ?? DEFAULT_PROFILE_ID;
    if (SWEEP_SATURATING_PROFILES.includes(profile)) {
        return `For runner worlds on the '${profile}' physics profile no physics gates `
            + 'exist at all (the profile saturates the calibration sweep, so gate '
            + 'windows are unverifiable) — pick a non-saturating profile or route the '
            + 'gates through another substrate.';
    }
    return 'For runner worlds note that each strip realises its gates as ONE '
        + 'nested chain (requirements must be pairwise comparable), so a wave '
        + 'needing incomparable gates needs more regions — raise "Max '
        + 'items/region" or lower the sphere count.';
}

/**
 * Enrich the engine's base zoneSpecs ({region_id, exitSpecs,
 * locationSpecs, seed}) with runner's knob keys — moves the
 * runner-param translation OUT of the generic engine. `regionParams`
 * is the world-level regionParams (engine's spec.params).
 */
export function buildZoneSpecs(base, regionParams = {}) {
    const out = { ...base };
    if (regionParams.runnerPhysicsProfile) {
        out.physicsProfile = regionParams.runnerPhysicsProfile;
    }
    if (regionParams.runnerGapMargin !== undefined) {
        out.gapMargin = regionParams.runnerGapMargin;
    }
    if (regionParams.runnerHazardDensity !== undefined) {
        out.hazardChance = regionParams.runnerHazardDensity;
    }
    if (regionParams.runnerLengthSteps !== undefined) {
        out.stepsBetween = regionParams.runnerLengthSteps;
    }
    if (regionParams.runnerJitter !== undefined) {
        out.jitter = regionParams.runnerJitter;
    }
    return out;
}

/**
 * Region-contract hook (engine's `buildRegionContract` dispatcher
 * calls this with the engine-computed realiser specs; the panel's
 * "Edit ▸" flow and the verify scripts consume the result). The
 * entrance side joins the exit specs UNGATED — the back-portal rule
 * above.
 */
export function buildRunnerRegionContract({ specs, node, regionParams = {} }) {
    const exitSpecs = specs.exitPlans.map((e) => ({
        side: e.side, requirement: e.gate, counts: e.gateCounts ?? {},
    }));
    if (specs.entranceSide) {
        exitSpecs.push({ side: specs.entranceSide, requirement: [], counts: {} });
    }
    const locationSpecs = (node.items ?? []).map((it) => ({
        id: it.id, item: it.item, requirement: [], counts: {},
    }));
    return {
        exitSpecs,
        locationSpecs,
        physicsProfile: regionParams.runnerPhysicsProfile ?? DEFAULT_PROFILE_ID,
        gapMargin: regionParams.runnerGapMargin ?? 0,
        hazardChance: regionParams.runnerHazardDensity ?? 0.35,
        stepsBetween: regionParams.runnerLengthSteps ?? 2,
        jitter: regionParams.runnerJitter ?? 0,
        entranceSide: specs.entranceSide,
    };
}

/**
 * Requirement-targeted zone generation (the sphere engine's
 * generateRegionZoneGen contract; bounce's generateZoneForSpecsGen is
 * the model). Splits each spec requirement into physics + authored,
 * generates and verifies the strip via generateLevelForSpecsGen
 * (forwarding its per-attempt progress events for the panel's stepped
 * flow), and emits via the shared assembleRunnerRegion tail — the
 * winning attempt's derivation is reused, never re-verified.
 *
 * @param {object} specs
 * @param {string} specs.region_id
 * @param {Array<{side: string, requirement: string[],
 *   counts?: Object<string, number>}>} specs.exitSpecs — requirement in
 *   AP item names (any items; `counts` gives per-item required counts,
 *   default 1); one exit portal per side.
 * @param {Array<{id: string, item: string|null, requirement: string[],
 *   counts?: Object<string, number>}>} [specs.locationSpecs]
 * @param {number} [specs.seed]
 * @param {string} [specs.physicsProfile] — physics.js PROFILES id;
 *   generation, verification and the emitted payload stamp all ride
 *   the same profile.
 * @param {number} [specs.gapMargin] — see runnerProcgenParams.js
 * @param {number} [specs.hazardChance]
 * @param {number} [specs.stepsBetween]
 * @param {number} [specs.jitter]
 * @returns {{locations: Array, exitRules: Object, exitPaths: Object,
 *   obstacleDefs: Object, payload: Object}}
 */
export function* generateZoneForSpecsGen({
    region_id,
    exitSpecs = [],
    locationSpecs = [],
    seed = 1,
    physicsProfile = DEFAULT_PROFILE_ID,
    gapMargin = 0,
    hazardChance = 0.35,
    stepsBetween = 2,
    jitter = 0,
} = {}) {
    const seenSides = new Set();
    const exits = exitSpecs.map((s) => {
        if (!s.side) throw new Error(`runner zone '${region_id}': exit spec without side`);
        if (seenSides.has(s.side)) {
            throw new Error(`runner zone '${region_id}': duplicate exit side '${s.side}'`);
        }
        seenSides.add(s.side);
        const { physics, authored } = splitRequirement(s.requirement, s.counts);
        return { side: s.side, physics, authored };
    });
    const pickups = locationSpecs.map((s) => {
        const { physics, authored } = splitRequirement(s.requirement, s.counts);
        return { id: s.id, item: s.item ?? null, physics, authored };
    });

    const { level, derived, portalByKey } = yield* generateLevelForSpecsGen({
        id: region_id,
        exitSpecs: exits.map((e) => ({ key: e.side, requirement: e.physics })),
        pickupSpecs: pickups.map((p) => ({ id: p.id, requirement: p.physics })),
        seed,
        stepsBetween,
        hazardChance,
        gapMargin,
        jitter,
        physics: physicsProfile,
    });

    const sidePortals = {};
    const exitAuthored = {};
    for (const e of exits) {
        sidePortals[e.side] = portalByKey[e.side];
        if (e.authored.length > 0) exitAuthored[e.side] = e.authored;
    }
    return assembleRunnerRegion(level, {
        region_id,
        sidePortals,
        locationSpecs: pickups.map((p) => ({ id: p.id, item: p.item, authored: p.authored })),
        exitAuthored,
        physicsProfile,
        derived,
        what: `runner zone '${region_id}'`,
    });
}

/** Sync form of generateZoneForSpecsGen (drains the attempt events). */
export function generateZoneForSpecs(specs = {}) {
    const gen = generateZoneForSpecsGen(specs);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
}

/**
 * Build a runner substrate registry entry — the same per-entry factory
 * pattern flashSubstrate uses per game, and literally built on it:
 * createFlashSubstrateEntry supplies the runtime plumbing (exits-Map
 * de/serializeWorld, playback stub), then runner overrides the panel
 * identity and adds the zone-based build-time hooks.
 *
 * @param {object} opts
 * @param {string}  [opts.id]        substrate id (default 'runner')
 * @param {string}  [opts.label]
 * @param {Array}   [opts.zones]     explicit generateZoneSet-shaped table
 *   ([{ level, items, spec }]); omitted = the lazy default table above.
 * @param {number}  [opts.zoneCount] zone count when zones is lazy
 *   (must match the deferred generateZoneSet call).
 * @param {number}  [opts.seed]      seed for the lazy default table.
 * @param {string}  [opts.physics]   fallback physics profile for zones
 *   without a stamped spec (zoneRules.js).
 */
export function createRunnerSubstrateEntry({
    id = 'runner',
    label = 'Runner Demo',
    zones = null,
    zoneCount = RUNNER_ZONE_COUNT,
    seed = RUNNER_ZONE_SEED,
    physics,
} = {}) {
    const base = createFlashSubstrateEntry({ id, label, iframeId: RUNNER_IFRAME_ID });

    // Lazy zone-table resolution (see header). An explicit `zones` table
    // is used as-is; the default is generated on first extractZoneRules
    // call. The custom-seed/count case gets its own cache (not the
    // shared default) so two entries can't cross-contaminate.
    let _zones = zones;
    const resolveZones = () => {
        if (_zones) return _zones;
        _zones = (zoneCount === RUNNER_ZONE_COUNT && seed === RUNNER_ZONE_SEED
            && physics === undefined)
            ? getRunnerZones()
            : generateZoneSet({ count: zoneCount, seed, ...(physics ? { physics } : {}) });
        return _zones;
    };
    let _hook = null;
    const extractZoneRules = (zoneIdx, ctx) => {
        _hook ??= makeExtractZoneRules(resolveZones(), { physics });
        return _hook(zoneIdx, ctx);
    };

    return Object.freeze({
        ...base,

        // Runner's single panel identity (see the constants above).
        panelComponentType: RUNNER_PANEL_COMPONENT_TYPE,
        loadRegionEvent: RUNNER_LOAD_REGION_EVENT,
        iframeId: RUNNER_IFRAME_ID,

        // Flash's exits-Map deserializeWorld, plus the host
        // touch-controls stamp (see setTouchControlsOverride).
        deserializeWorld(payload) {
            const world = base.deserializeWorld(payload);
            if (_touchControlsOverride !== undefined) {
                world.params = {
                    ...(world.params ?? {}),
                    touchControls: _touchControlsOverride,
                };
            }
            return world;
        },
        // Inverse for sidecar emission: params.touchControls is a
        // host-session override, never authored content — strip it
        // unconditionally so written presets stay byte-identical
        // whatever the live setting is.
        serializeWorld(world, ...rest) {
            const out = base.serializeWorld(world, ...rest);
            if (out.params && 'touchControls' in out.params) {
                const { touchControls, ...params } = out.params;
                out.params = params;
            }
            return out;
        },

        // Playback bot: overrides the flash entry's `() => null` stub.
        // Returns the injected host-side proxy (phase 8) or null.
        getPlaybackController: () => _playbackProxy,

        // Loop-mode capabilities: regionMove + locationCheck queue
        // actions map to the playback bot's implementations via
        // executeVia: 'playbackBot' (bounce's contract — the loops
        // queue parks and the bot plays; loops charges the action's
        // loop_costs value on completion). Until the phase-8 bot
        // driver lands, getPlaybackController's null makes the bot
        // no-op. NO explore action; manual play yes; custom queues no
        // (same judgment as bounce, user decision 2026-06-12).
        loopSupport: Object.freeze({
            queueActions: Object.freeze(['regionMove', 'locationCheck']),
            executeVia: 'playbackBot',
            manual: true,
            customQueues: false,
        }),

        // The substrate's zone table places this item itself
        // (generateZoneSet's last zone). Emission paths use it as the
        // completion-condition item when the scenario pool contributes
        // no is_victory item — without it the AP world gets NO goal and
        // AP defaults to trivially-true completion ("beaten" at
        // sphere 0).
        victoryItem: VICTORY_ITEM_NAME,

        // Zone-based substrate metadata (read by layout drivers). The
        // count is a plain constant so drivers never pay the lazy
        // generation cost just to size an arrangement.
        zoneCount: _zones ? _zones.length : zoneCount,
        // All payload content comes from extractZoneRules (which knows
        // the exit sides); no separate synthesizeZonePayload needed.
        extractZoneRules,

        // Panel-facing item/obstacle vocabulary (declared in apRules.js,
        // the rule-emission home — unlike bounce, whose defs sit here).
        // Merged with DEFAULT_ITEMS / DEFAULT_OBSTACLES by consumers.
        libraryItems: RUNNER_LIBRARY_ITEMS,
        libraryObstacles: RUNNER_LIBRARY_OBSTACLES,
        supportedFeatures: Object.freeze(['arbitrary_ap_locations', 'runner_abilities']),

        // Sphere-driven growth (plan §4.9): requirement-targeted
        // generation + the structural vetoes/hints + the panel-facing
        // procgen params. Unlike bounce (gateableItems: null — full
        // vocabulary), runner IS constrained: the grower composes
        // runner-hosted exit gates on the ability items only; count>1
        // and foreign-item terms realise as authored bridge-evaluated
        // logic_gate locks (mixed-substrate worlds).
        generateZoneForSpecs,
        generateZoneForSpecsGen,
        gateableItems: GATEABLE_ITEMS,
        canHostExitGates,
        // Engine-facing structural hooks — the generic sphere-growth
        // engine asks these instead of naming runner directly.
        backPortalGated,
        hostsSurplusExitsNatively,
        exitGateVeto,
        gateHostingHint,
        buildZoneSpecs,
        // Region-contract builder (engine's generic buildRegionContract
        // dispatcher calls this with the engine-computed realiser specs).
        buildRegionContract: buildRunnerRegionContract,

        // Procgen Pipeline integration (runnerProcgenParams.js): panel
        // defaults, regionParams assembly, per-substrate param controls.
        // No prepareSphereGrowth — runner contributes nothing pre-plan.
        defaultProcgenParams: DEFAULT_RUNNER_PROCGEN_PARAMS,
        buildRegionParams: buildRunnerRegionParams,
        renderProcgenParams: renderRunnerProcgenParams,
    });
}

export const substrateRegistryEntry = createRunnerSubstrateEntry();

/** The default entry's hook, bound to the lazy default zone table. */
export const extractZoneRules = substrateRegistryEntry.extractZoneRules;

// Side-effect on import: register the substrate so headless callers
// (scripts/procgen CLIs, tests) get a populated registry just by
// importing the library. Idempotent with the module hook's register()
// (index.js) — both sites guard with has(), deliberately redundant.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
