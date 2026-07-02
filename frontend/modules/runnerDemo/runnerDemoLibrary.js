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
import { generateZoneSet } from './generator.js';
import { makeExtractZoneRules } from './zoneRules.js';
import {
    RUNNER_LIBRARY_ITEMS, RUNNER_LIBRARY_OBSTACLES, VICTORY_ITEM_NAME,
} from './apRules.js';

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
