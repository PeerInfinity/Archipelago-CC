/**
 * Noiz2sa substrate (substrate id `noiz2sa`) — the registry entry, headless.
 *
 * Noiz2sa is Kenta Cho's BulletML shoot-'em-up, played from the game repo `PeerInfinity/bulletml-dodge` (the
 * submodule `frontend/modules/bulletml-dodge`, `branch = substrate`) in an iframe. ⚖ The user's rulings
 * (2026-10-04/05): the host is Archipelago Loops; each region is one segment of one level (one or more
 * scenes, possibly a boss into the next stage); losing a life restarts the region; spending time in a region
 * drains mana and dying does not restore what was spent; centered hitbox; ONE location per region (its clear),
 * no other location; no offline progress; playable outside loop mode too (no drain then).
 *
 * The region semantics are the game repo's `segment-run.js`, copied into `noiz2saRegion.js` (why a copy: that
 * file's header). This file must load headless (scripts and vitest import it), so it imports nothing from the
 * submodule.
 *
 * Runtime: like runner and bounce, the iframe rides `flashSubstrate`'s shared code — the panel factory and the
 * injected `bridge.js` (the `__swfBridge` contract): the game page (`game/`) implements `configure`, and calls
 * `sendLocation('clear')` on the region's clear and `sendExit(exitName, null)` when the player leaves.
 * `deserializeWorld` is where the payload becomes what that bridge forwards: the bridge hands the game only
 * `params`, so the region (`start`, `end`, `seed`) and the exit list are copied into `params` there.
 *
 * Loop mode: a SUMMARY substrate (`summaryRecording`, runner's declarations): Record keeps the visit's net
 * result, Playback applies it instantly, live play is priced by time (`loopState._timeDrainTick`) — per GAME
 * second, from the page's play-clock stats (N4). The Bot (N4): `executeVia: 'solver'`; `getPlaybackController`
 * returns the host module's proxy (injected by `index.js`, null headless), whose walkTo carries the humanlike bot's
 * settings at the trainer's current tracks (`noiz2saTraining.js`).
 *
 * Content source: a fixed zone table (`NOIZ2SA_ZONES`), one region per zone, for the test preset and the
 * shuffled-spiral driver (`zoneCount` / `extractZoneRules`). Pricing and the stat tracks are later slices.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    REQUIRED_ENVELOPE_FIELD, envelopeExitNames, nameMapValues,
} from '../procgenCore/sidecarFields.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { parsePosition, regionSpanOf, showSpan } from './noiz2saRegion.js';

export const NOIZ2SA_SUBSTRATE_ID = 'noiz2sa';
export const NOIZ2SA_GAME_ID = 'noiz2sa';
export const NOIZ2SA_PANEL_COMPONENT_TYPE = 'noiz2saSubstratePanel';
export const NOIZ2SA_LOAD_REGION_EVENT = 'noiz2sa:loadRegion';
export const NOIZ2SA_IFRAME_ID = 'noiz2saSubstrate';
/** the bot's commands, host proxy → the in-iframe bridge (the iframe URL names it) */
export const NOIZ2SA_PLAYBACK_CONTROL_EVENT = 'noiz2sa:playbackControl';
/** the region's one location: its id in the game (`sendLocation`) and the suffix of its AP name */
export const NOIZ2SA_CLEAR_LOCATION_ID = 'clear';
export const NOIZ2SA_VICTORY_ITEM_NAME = 'Victory';
/** what the other regions' clears hold: a filler with no effect (N3 has no items that do anything) */
export const NOIZ2SA_FILLER_ITEM_NAME = 'Noiz2sa Star';

export const NOIZ2SA_LIBRARY_ITEMS = Object.freeze({
    [NOIZ2SA_VICTORY_ITEM_NAME]: Object.freeze({ classification: 'progression', is_victory: true }),
    [NOIZ2SA_FILLER_ITEM_NAME]: Object.freeze({ classification: 'filler' }),
});

/**
 * The zone table: one region per entry, `{start, end}` as a player writes them (STAGE:SCENE, scene 1–9 or
 * boss). Three spans that cover the three shapes a region has: one scene, two scenes, and a boss into the
 * next stage. Every region plays on seed 1. The LAST zone's clear holds Victory.
 */
export const NOIZ2SA_ZONES = Object.freeze([
    Object.freeze({ start: '1:1', end: '1:1' }),
    Object.freeze({ start: '1:2', end: '1:3' }),
    Object.freeze({ start: '1:boss', end: '2:1' }),
]);
const ZONE_SEED = 1;

/** zone i → its region `{start, end, seed}` */
export function zoneRegion(zoneIdx) {
    const z = NOIZ2SA_ZONES[zoneIdx];
    if (!z) throw new Error(`noiz2sa: no zone ${zoneIdx} (have ${NOIZ2SA_ZONES.length})`);
    return regionSpanOf({ start: parsePosition(z.start), end: parsePosition(z.end), seed: ZONE_SEED });
}

/** The region's exits as the game page lists them (its "leave" buttons): from the payload's envelope. */
export function exitButtonsOf(exits) {
    const list = exits instanceof Map ? [...exits.values()] : (Array.isArray(exits) ? exits : []);
    return list
        .map((e) => ({ exitName: e?.exitName ?? e?.exit_id ?? null, side: e?.side ?? null, targetRegion: e?.targetRegion ?? null }))
        .filter((e) => e.exitName);
}

/**
 * procgenPlayer passes the sidecar's `playable_payload`. Exits become a Map keyed by exit name
 * (procgenPlayer.handleRegionMove calls `world.exits.has(exitName)`). The flash bridge forwards only
 * `params` to the game, so the checked region and the exit list are written there. Throws on a payload whose
 * span is malformed (the warehouse then skips the region, `procgenCore/deserializeRefusal.js`).
 */
function deserializeWorld(payload) {
    const p = payload ?? {};
    const region = regionSpanOf(p);
    const exitsArray = Array.isArray(p.exits) ? p.exits : [];
    const exitsMap = new Map();
    for (const e of exitsArray) {
        const key = e?.exitName ?? e?.exit_id;
        if (key) exitsMap.set(key, e);
    }
    return {
        ...p,
        exits: exitsMap,
        // walkToExits: the bridge resolves a bot walk to an exit by its name (the exits have no side)
        params: { ...region, exits: exitButtonsOf(exitsArray), walkToExits: 'byName' },
    };
}

// The host-side playback controller (`index.js`'s Noiz2saBotProxy), injected on initialize. Headless (scripts,
// vitest) it stays null and a Bot block cannot engage (loops parks it for live play with a warning).
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy ?? null; }

/** Inverse for write-to-disk: `params` is derived at load, so it is dropped; exits back to an array. */
function serializeWorld(world) {
    const w = { ...(world ?? {}) };
    delete w.params;
    const exits = w.exits instanceof Map ? [...w.exits.values()] : (Array.isArray(w.exits) ? w.exits : []);
    return { ...w, exits };
}

/** The one pipeline writer of every derived field below. */
const ZONE_RULES = '`extractZoneRules` (`noiz2saSubstrateLibrary.js`)';
const POSITION_SCHEMA = Object.freeze({
    required: Object.freeze(['stage', 'scene']),
    additionalProperties: false,
    properties: Object.freeze({
        // the upper bounds are checkSpan's (on load): jsonSchemaCheck has no `maximum`
        stage: Object.freeze({ type: 'integer', minimum: 0 }),
        scene: Object.freeze({ type: 'integer', minimum: 0 }),
    }),
});

/** The payload, declared (the registry's `sidecarFields` slot; vocabulary in `procgenCore/sidecarFields.js`). */
export const NOIZ2SA_SIDECAR_FIELDS = Object.freeze({
    exits: REQUIRED_ENVELOPE_FIELD,
    fogEnabled: REQUIRED_ENVELOPE_FIELD,
    gameId: Object.freeze({
        type: 'string', required: true, derived: true, enum: Object.freeze([NOIZ2SA_GAME_ID]),
        description: `The game id, a constant ${ZONE_RULES} stamps (the flash bridge forwards it to the page).`,
    }),
    start: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `The region's first scene {stage, scene} (stage 0–9 the stages 1–10, 10–13 the endless modes; `
            + `scene 0–8, 9 the boss), from the zone table by ${ZONE_RULES}. Checked with \`end\` on load `
            + '(`noiz2saRegion.js` checkSpan); a bad span refuses the region.',
        schema: POSITION_SCHEMA,
    }),
    end: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `The region's last scene, included; at or after \`start\`, by ${ZONE_RULES}. A boss that is `
            + 'not the end leads into the next stage.',
        schema: POSITION_SCHEMA,
    }),
    seed: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: `The game's C rand() seed for every game of the region (≥ 1), by ${ZONE_RULES}.`,
    }),
    ap_locations: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `\`clear\` → the AP location name \`<region>__clear\`, by ${ZONE_RULES}. The bridge maps the `
            + 'page\'s `sendLocation(\'clear\')` through it; a mismatch drops the check.',
        schema: Object.freeze({ additionalProperties: Object.freeze({ type: 'string' }) }),
    }),
});

/** zone i → the zone-locations channel result (`procgenPipelineEngine.synthesizeZoneRegion`) */
function extractZoneRules(zoneIdx, { region_id } = {}) {
    const region = zoneRegion(zoneIdx);
    const last = zoneIdx === NOIZ2SA_ZONES.length - 1;
    return {
        locations: [{
            id: NOIZ2SA_CLEAR_LOCATION_ID,
            item: last ? NOIZ2SA_VICTORY_ITEM_NAME : NOIZ2SA_FILLER_ITEM_NAME,
            position: null,
        }],
        payload: {
            gameId: NOIZ2SA_GAME_ID,
            ...region,
            ap_locations: { [NOIZ2SA_CLEAR_LOCATION_ID]: `${region_id}__${NOIZ2SA_CLEAR_LOCATION_ID}` },
        },
    };
}

export const substrateRegistryEntry = Object.freeze({
    id: NOIZ2SA_SUBSTRATE_ID,
    label: 'Noiz2sa',
    panelComponentType: NOIZ2SA_PANEL_COMPONENT_TYPE,
    loadRegionEvent: NOIZ2SA_LOAD_REGION_EVENT,
    // procgenPlayer re-publishes the active region's load event when this iframe announces appReady.
    iframeId: NOIZ2SA_IFRAME_ID,
    supportedFeatures: Object.freeze(['arbitrary_ap_locations']),
    deserializeWorld,
    serializeWorld,
    sidecarFields: NOIZ2SA_SIDECAR_FIELDS,
    apLocationNamesOf: nameMapValues('ap_locations'),
    apExitNamesOf: envelopeExitNames,
    // An exit is only a side and a "leave" button; nothing in the payload is keyed by a side.
    regionGeometry: REGION_GEOMETRY.SIDES,
    exitSides: SIDE_AGNOSTIC_EXIT_SIDES,

    // The Bot (N4): the walkTo solver. The page's humanlike bot plays toward the target (the clear, or an exit
    // after the clear) at the trainer's tracks, restarting on a hit, until the clear or the retry cap.
    getPlaybackController: () => _playbackProxy,

    // Loop mode: runner's declarations. `record` + `playback` arm the strict action gate and the live-play time
    // drain; `summaryRecording` makes it a summary substrate; `executeVia: 'solver'` offers the Bot (no Bot ×
    // Instant: a summary bot never honours Instant).
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove', 'locationCheck']),
        executeVia: 'solver',
        manual: true,
        customQueues: false,
        record: true,
        playback: true,
        instant: true,
        summaryRecording: true,
        // the page reports whether its clock runs (waiting for a key, paused or cleared: not running) and the
        // visit's game seconds, and the time drain charges only the game seconds played — flashSubstrate/bridge.js
        // `setPlayClock`, loopState._timeDrainTick
        playClock: true,
    }),

    victoryItem: NOIZ2SA_VICTORY_ITEM_NAME,
    libraryItems: NOIZ2SA_LIBRARY_ITEMS,
    zoneCount: NOIZ2SA_ZONES.length,
    extractZoneRules,
    zoneSourceLabel: 'Noiz2sa segment',
});

/** what a region plays, for logs and labels: "1:2–1:3 (seed 1)" */
export const describeRegion = (payload) => {
    const r = regionSpanOf(payload);
    return `${showSpan(r)} (seed ${r.seed})`;
};

// Side-effect on import: register, so headless scripts and the pipeline resolve the substrate without the
// panel module (idempotent: index.js's register() guards too).
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
