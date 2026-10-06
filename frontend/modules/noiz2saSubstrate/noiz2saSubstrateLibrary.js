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
 * `sendLocation(<location id>)` when a check run clears and `sendExit(exitName, null)` when a move run clears.
 * `deserializeWorld` is where the payload becomes what that bridge forwards: the bridge hands the game only
 * `params`, so the region (`start`, `end`, `seed`) and the exit list are copied into `params` there.
 *
 * Loop mode: a SUMMARY substrate (`summaryRecording`, runner's declarations): Record keeps the visit's net
 * result, Playback applies it instantly, live play is priced by time (`loopState._timeDrainTick`) — per GAME
 * second, from the page's play-clock stats (N4). The Bot (N4): `executeVia: 'solver'`; `getPlaybackController`
 * returns the host module's proxy (injected by `index.js`, null headless), whose walkTo carries the humanlike bot's
 * settings at the trainer's current tracks (`noiz2saTraining.js`).
 *
 * N4b/N4c (⚖ 2026-10-05): a region has a MOVE run, which plays the move span on every visit (cleared before or not)
 * and whose clear performs the move, and ZERO OR MORE LOCATIONS (⚖ "I want to keep the ability for Noiz2sa regions to
 * contain location checks. But I don't want to force them each to have exactly one. And I want them to have none by
 * default."). Each location's CHECK — its own queue action, the standard `locationCheck` (⚖ "I want the location check
 * to be a separate action from the move") — plays that location's own check span (by default twice the move's scenes),
 * and its clear checks the location while the player stays in the region. `queueActions` is both; with nothing queued
 * for the region the page offers the choice list (every exit, and every unchecked location). A first ENTRY explores
 * the region fully (`noiz2saFirstEntry.js`).
 *
 * Content source: a fixed zone table (`NOIZ2SA_ZONES`), one region per zone, for the test preset and the
 * shuffled-spiral driver (`zoneCount` / `extractZoneRules`).
 *
 * Pricing (N5): when the pipeline builds a LOOP-MODE world, the `priceRegions` hook (`noiz2saPricing.js`) walks the one
 * cost model's plan and rewrites each region's spans (`move`, every location's `check`) and drain rate
 * (`timeDrainPerSecond`, which the shared cost writer passes into `loop_costs`), recording what it predicted in
 * `pricing`. The final region's span is the generation-form setting `noiz2saFinalSpan`. The zone table's spans are what a
 * world without loop mode (and the hand-built test preset) plays. The hook imports two leaf files of the game submodule
 * (`tracks.js`, `human.js`: no engine), so this file still loads headless.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    REQUIRED_ENVELOPE_FIELD, envelopeExitNames, nameMapValues,
} from '../procgenCore/sidecarFields.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { defaultCheckSpans, parsePosition, regionSpanOf, regionSpansOf, showSpan } from './noiz2saRegion.js';
import { DEFAULT_FINAL_SPAN, FINAL_SPAN_PARAM, priceNoiz2saRegions } from './noiz2saPricing.js';
import { parseSpan } from './noiz2saDifficulty.js';
import { fieldRow } from '../procgenCore/regionGenerationForm.js';

export const NOIZ2SA_SUBSTRATE_ID = 'noiz2sa';
export const NOIZ2SA_GAME_ID = 'noiz2sa';
export const NOIZ2SA_PANEL_COMPONENT_TYPE = 'noiz2saSubstratePanel';
export const NOIZ2SA_LOAD_REGION_EVENT = 'noiz2sa:loadRegion';
export const NOIZ2SA_IFRAME_ID = 'noiz2saSubstrate';
/** the bot's commands, host proxy → the in-iframe bridge (the iframe URL names it) */
export const NOIZ2SA_PLAYBACK_CONTROL_EVENT = 'noiz2sa:playbackControl';
/** a region's i-th location (0-based): its id in the game (`sendLocation`) and the suffix of its AP name */
export const noiz2saLocationId = (i) => `check${i + 1}`;
export const NOIZ2SA_VICTORY_ITEM_NAME = 'Victory';
/** what the other locations hold: a filler with no effect (N3 has no items that do anything) */
export const NOIZ2SA_FILLER_ITEM_NAME = 'Noiz2sa Star';

export const NOIZ2SA_LIBRARY_ITEMS = Object.freeze({
    [NOIZ2SA_VICTORY_ITEM_NAME]: Object.freeze({ classification: 'progression', is_victory: true }),
    [NOIZ2SA_FILLER_ITEM_NAME]: Object.freeze({ classification: 'filler' }),
});

/**
 * The zone table: one region per entry, its MOVE span `{start, end}` as a player writes it (STAGE:SCENE, scene 1–9
 * or boss), and `locations`, how many locations the region has — ABSENT means none (⚖ N4c: "I want them to have none
 * by default"). Three spans that cover the three shapes a region has: one scene, two scenes, and a boss into the next
 * stage; and the three location cases: one, none, two. Every region plays on seed 1. The last location of the last
 * zone that has any holds Victory; a table whose zones declare none gets ONE location on its last zone, holding Victory
 * (⚖ "Add one location to the last region": `zoneLocationPlan`). A location's check span is the default one
 * (`defaultCheckSpans`: from the move's start, twice its scenes — every location of a region the same by default).
 */
export const NOIZ2SA_ZONES = Object.freeze([
    Object.freeze({ start: '1:1', end: '1:1', locations: 1 }),
    Object.freeze({ start: '1:2', end: '1:3' }),
    Object.freeze({ start: '1:boss', end: '2:1', locations: 2 }),
]);
/** how many locations a zone declares (absent: none) */
const zoneLocationCount = (z) => (Number.isInteger(z?.locations) && z.locations > 0 ? z.locations : 0);
/**
 * A zone table's locations: `{counts, victoryZone}` — each zone's location count (absent: none), and the zone whose
 * LAST location holds Victory: the last zone with a location. A table whose zones declare none would leave Victory
 * nowhere, so its LAST zone gets one location, holding Victory (⚖ the user, 2026-10-05: "Add one location to the last
 * region"). An empty table → no counts, no Victory zone (-1).
 */
export function zoneLocationPlan(zones) {
    const counts = zones.map(zoneLocationCount);
    if (counts.length && counts.every((n) => n === 0)) counts[counts.length - 1] = 1;
    return { counts, victoryZone: counts.findLastIndex((n) => n > 0) };
}
const ZONE_SEED = 1;

/** zone i of a table → its region `{move: {start, end}, seed, locations: [{id, check: {start, end}}]}` */
function zoneRegionOf(zones, zoneIdx) {
    const z = zones[zoneIdx];
    if (!z) throw new Error(`noiz2sa: no zone ${zoneIdx} (have ${zones.length})`);
    const { start, end, seed } = regionSpanOf({ start: parsePosition(z.start), end: parsePosition(z.end), seed: ZONE_SEED });
    const move = { start, end };
    const n = zoneLocationPlan(zones).counts[zoneIdx];
    const locations = defaultCheckSpans(move, n).map((check, i) => ({ id: noiz2saLocationId(i), check }));
    return { move, seed, locations };
}
/** zone i → its region (the shipped zone table) */
export const zoneRegion = (zoneIdx) => zoneRegionOf(NOIZ2SA_ZONES, zoneIdx);

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
 * `params` to the game, so the checked region (`move`, `seed`, `locations`: `regionSpansOf`, which also reads the
 * older shapes) and the exit list are written there. Throws on
 * a payload whose span is malformed (the warehouse then skips the region, `procgenCore/deserializeRefusal.js`).
 */
function deserializeWorld(payload) {
    const p = payload ?? {};
    const region = regionSpansOf(p);
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
const SPAN_SCHEMA = Object.freeze({
    required: Object.freeze(['start', 'end']),
    additionalProperties: false,
    properties: Object.freeze({
        start: Object.freeze({ type: 'object', ...POSITION_SCHEMA }),
        end: Object.freeze({ type: 'object', ...POSITION_SCHEMA }),
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
    move: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `The MOVE span {start, end}: what a move out of the region plays, its clear performing the move. `
            + 'A position is {stage, scene} (stage 0–9 the stages 1–10, 10–13 the endless modes; scene 0–8, 9 the boss); '
            + 'the end is included, at or after the start, and a boss that is not the end leads into the next stage. '
            + `From the zone table by ${ZONE_RULES}. Checked on load (\`noiz2saRegion.js\` regionSpansOf); a bad span `
            + 'refuses the region.',
        schema: SPAN_SCHEMA,
    }),
    locations: Object.freeze({
        type: 'array', required: true, derived: true,
        description: 'The region\'s locations, zero or more (⚖ N4c: none by default): `[{id, check: {start, end}}]`. `id` '
            + 'is the location\'s id in the game (`check1`, `check2`, …; `ap_locations` maps it to its AP name); `check` is '
            + 'its own CHECK span, what a check of it plays, its clear checking it (the player stays). By default every '
            + 'location of a region has the same span: from the move span\'s start, twice its scenes '
            + `(\`defaultCheckSpans\`), by ${ZONE_RULES}. A location without \`check\` gets the default span on load; `
            + 'a payload without `locations` has one per `ap_locations` key.',
        schema: Object.freeze({
            items: Object.freeze({
                type: 'object',
                required: Object.freeze(['id']),
                additionalProperties: false,
                properties: Object.freeze({ id: Object.freeze({ type: 'string' }), check: Object.freeze({ type: 'object', ...SPAN_SCHEMA }) }),
            }),
        }),
    }),
    start: Object.freeze({
        type: 'object', required: false,
        description: 'Before N4c: the move span\'s first scene (with `end`). Read as the move span when `move` is '
            + 'absent (`noiz2saRegion.js` regionSpansOf); no writer emits it now.',
        schema: POSITION_SCHEMA,
    }),
    end: Object.freeze({
        type: 'object', required: false,
        description: 'Before N4c: the move span\'s last scene (with `start`), read as for `start`.',
        schema: POSITION_SCHEMA,
    }),
    seed: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: `The game's C rand() seed for every game of the region (≥ 1), by ${ZONE_RULES}.`,
    }),
    timeDrainPerSecond: Object.freeze({
        type: 'number', required: false, derived: true,
        description: 'N5: the region\'s mana drain per game second, priced by `priceRegions` (`noiz2saPricing.js`): the '
            + 'planned cost of a move out of the region ÷ the move span\'s expected seconds at the predicted skill. The shared '
            + 'cost writer passes it into `loop_costs` (a SUMMARY region\'s payload rate). Absent: the default drain (a world '
            + 'built without loop mode, a start region, the test preset).',
    }),
    pricing: Object.freeze({
        type: 'object', required: false, derived: true,
        description: 'N5: what the pricing walk predicted, for the panel and the tests: `{pointsPerMana, mana, skill, p, '
            + 'seconds, cost, final, locations: {<id>: {skill, p, seconds, cost}}}` — the world\'s training pace (the same '
            + 'in every region; the trainer\'s default), the Noiz2sa mana spent before the walk priced the region, the '
            + 'predicted skill then, the move span\'s deathless chance and expected seconds, the planned cost, whether it is '
            + 'the final region, and the same for each priced location\'s check span.',
        schema: Object.freeze({ additionalProperties: true }),
    }),
    ap_locations: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `Each location's id → its AP location name \`<region>__<id>\` (empty for a region with none), by `
            + `${ZONE_RULES}. The bridge maps the page's \`sendLocation(<id>)\` through it; a mismatch drops the check.`,
        schema: Object.freeze({ additionalProperties: Object.freeze({ type: 'string' }) }),
    }),
});

/**
 * zone i of a table → the zone-locations channel result (`procgenPipelineEngine.synthesizeZoneRegion`); a zone with no
 * locations yields a region with none (still a region: its exits are its AP entrances). Exported for the tests.
 */
export function zoneRulesOf(zones, zoneIdx, { region_id } = {}) {
    const region = zoneRegionOf(zones, zoneIdx);
    const { victoryZone } = zoneLocationPlan(zones);
    const n = region.locations.length;
    return {
        locations: region.locations.map((l, i) => ({
            id: l.id,
            item: zoneIdx === victoryZone && i === n - 1 ? NOIZ2SA_VICTORY_ITEM_NAME : NOIZ2SA_FILLER_ITEM_NAME,
            position: null,
        })),
        payload: {
            gameId: NOIZ2SA_GAME_ID,
            ...region,
            ap_locations: Object.fromEntries(region.locations.map((l) => [l.id, `${region_id}__${l.id}`])),
        },
    };
}
/** the shipped zone table's zone-locations channel */
const extractZoneRules = (zoneIdx, ctx) => zoneRulesOf(NOIZ2SA_ZONES, zoneIdx, ctx);

/** N5: the generation form's Noiz2sa knobs (the procgen params bag) */
export const NOIZ2SA_PROCGEN_PARAMS = Object.freeze({ [FINAL_SPAN_PARAM]: DEFAULT_FINAL_SPAN });

/**
 * The generation form's Noiz2sa section: the final region's span (⚖ "In the generation settings, there should be a
 * control for the set of scenes to use for the final region"). A text box, STAGE:SCENE–STAGE:SCENE in stages 1–10; a
 * span that does not parse is not stored (the box turns red and the bag keeps the last good one).
 */
function renderNoiz2saProcgenParams({ params, onChange = () => {} } = {}) {
    const wrap = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = String(params[FINAL_SPAN_PARAM] ?? DEFAULT_FINAL_SPAN);
    input.dataset.param = FINAL_SPAN_PARAM;
    input.addEventListener('change', () => {
        try {
            parseSpan(input.value);
        } catch {
            input.style.outline = '1px solid #c33';
            return;
        }
        input.style.outline = '';
        params[FINAL_SPAN_PARAM] = input.value.trim();
        onChange();
    });
    wrap.appendChild(fieldRow('Final region span', 'The scenes the last Noiz2sa region reached plays (loop mode prices the '
        + 'other regions toward it), e.g. 10:7–10:boss', input));
    return wrap;
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

    // The Bot (N4): the walkTo solver. The page's humanlike bot plays the target's run (a location: the check run; an
    // exit: the move run, leaving by it) at the trainer's tracks, restarting on a hit, until the clear or the retry cap.
    getPlaybackController: () => _playbackProxy,

    // Loop mode: runner's declarations. `record` + `playback` arm the strict action gate and the live-play time
    // drain; `summaryRecording` makes it a summary substrate; `executeVia: 'solver'` offers the Bot (no Bot ×
    // Instant: a summary bot never honours Instant).
    loopSupport: Object.freeze({
        // N4c: the move (a move run: the move span, its clear performs the move) and the check (a check run: the
        // check span, its clear checks the location), two queue actions; the Bot block plays both
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

    // N5: a loop-mode build prices the regions against the planned walk (spans + drain rate), the final region's span
    // from the generation form (`noiz2saFinalSpan`).
    priceRegions: priceNoiz2saRegions,
    defaultProcgenParams: NOIZ2SA_PROCGEN_PARAMS,
    renderProcgenParams: renderNoiz2saProcgenParams,

    victoryItem: NOIZ2SA_VICTORY_ITEM_NAME,
    libraryItems: NOIZ2SA_LIBRARY_ITEMS,
    zoneCount: NOIZ2SA_ZONES.length,
    extractZoneRules,
    zoneSourceLabel: 'Noiz2sa segment',
});

/** what a region plays, for logs and labels: "1:2–1:3, check1 1:2–1:5 (seed 1)", "1:1, no location (seed 1)" */
export const describeRegion = (payload) => {
    const r = regionSpansOf(payload);
    const locs = r.locations.length ? r.locations.map((l) => `${l.id} ${showSpan(l.check)}`).join(', ') : 'no location';
    return `${showSpan(r.move)}, ${locs} (seed ${r.seed})`;
};

// Side-effect on import: register, so headless scripts and the pipeline resolve the substrate without the
// panel module (idempotent: index.js's register() guards too).
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
