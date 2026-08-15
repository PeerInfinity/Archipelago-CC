/**
 * seedlingDemo/watchViewer — watch a tape replay, in the browser.
 *
 * ⚠ TOOLING ONLY. This page makes no claims, gates nothing, and nothing
 * that DOES make a claim may depend on it. The gates are vitest (JS stream
 * == the committed oracle recording) and
 * `scripts/procgen/verify-seedling-bot-differential.mjs` (the live game ==
 * those recordings); a viewer is a window onto the same run, not a third
 * opinion about it. What this page IS, and its named limits:
 * `docs/json/developer/procgen/seedling-bot.md` § "The editor arc".
 *
 * ⚠ That citation used to be `CC/docs/plans/seedling-bot-watch-page.md`,
 * which has not existed on disk since the docs migration moved it under the
 * gitignored `NewDocs/` — i.e. the page's only stated design reference was
 * unreachable to every reader who did not have this working machine. It now
 * points at the TRACKED section.
 *
 *   watch.html?tape=<repo-relative path>&side=js|wasm[&speed=N]
 *
 * `side=js`   steps `tapeRunner.createTapeStepper` on an animation-frame
 *             pacer and draws the level, the player and the model state the
 *             observation stream cannot carry. Works anywhere — it needs
 *             only the committed atlas and a committed tape.
 * `side=wasm` iframes the recompiled game and drives its own bot callbacks.
 *             Local-only BY NATURE: the wasm artifact is gitignored and
 *             there is no CI build in either repo.
 *
 * ⚠ IT RENDERS RAW TRUTH. No position smoothing, no interpolation between
 * ticks, no eliding of dead frames — they are counted and shown. The whole
 * value of watching a replay is seeing what the model actually did, and a
 * viewer that tidies it up is a viewer that hides the next divergence. The
 * terrain readout shows the RAW state and the EFFECTIVE one side by side
 * for the same reason: `noHazards` is exactly the difference between them.
 *
 * ⚠ AND IT DOES NOT OWN A TICK LOOP. `createTapeStepper` is the incremental
 * face of `runTape` — one loop, two faces, pinned in `tapeRunner.test.js`
 * by stepping every committed fixture to completion and comparing byte for
 * byte. A private loop here would be the verifier-shared-assumption trap in
 * tooling clothes.
 *
 * ── SOURCE = SOLVE (editor arc slice 1) ───────────────────────────────
 *
 * A second way to get a tape: instead of fetching one, SOLVE one. The page
 * takes a level, a tape v8 staging block and a goal list, runs
 * `solveSegment` to completion IN THE PAGE, folds the result with the one
 * fold, and hands the tape to the SAME collect-then-scrub machinery above
 * (⚖ solve-then-scrub, kickoff §1.2 — a live think-mode is deferred on the
 * measured latency, which is why the wall clock is displayed rather than
 * merely taken).
 *
 * ⛔ Every one of the three laws survives it. It makes NO CLAIM: the solved
 * tape is a thing to look at, it is never written to `fixtures/` (the
 * roster is disk-derived, so a saved experiment would silently join the
 * differential), and no gate consumes it. It is RAW TRUTH: the solver's
 * refusals are surfaced with their own message and their trace rows, an
 * ambiguous default exit is reported rather than guessed, and the solve's
 * cost is shown in milliseconds. And it adds NO LOOP: `solveSegment`
 * advances the run, the stepper replays it, and this file drives neither.
 *
 * ⛔ IT ALSO BUILDS NO WORLD OF ITS OWN. The run comes from
 * `createRunForStaging` — the construction `createTapeStepper` uses — so
 * the world the solver senses is the world the replay runs. See
 * `watchSolve.js`, which holds everything here that is pure.
 *
 * ── OVERLAYS + THE TRACE PANE (editor arc slice 2) ────────────────────
 *
 * Eight independently toggleable layers over the same canvas — the player
 * trail, the movers' paths, and markers for actions, damage and events —
 * plus a pane rendering the decision trace beside them.
 *
 * ⛔ ALL THREE LAWS SURVIVE IT, and each one bites somewhere specific:
 *
 * NO LOOP: every mover position is SAMPLED from the live run through
 * `createTapeStepper`'s `onTick` hook, once per tick, inside the collect
 * loop that was already running. A layer that re-stepped the world to find
 * out where a spinner was would be a second cost model with pixels.
 *
 * RAW TRUTH: sampled positions, one per tick, never interpolated; a marker
 * stands at the position the run held on the tick its ledger names, and a
 * ledger row that cannot be placed there — `earnedClears` carries no tick —
 * is REPORTED by name rather than dropped or invented.
 *
 * NO CLAIM: the pane renders the trace the solver produced (or the sidecar
 * beside a committed tape, through the producer's own validator) and
 * nothing gates on any of it. See `watchOverlays.js`, which holds
 * everything here that is pure.
 *
 * ── SOURCE = MANUAL, AND TAPE I/O (editor arc slice 3) ────────────────
 *
 * A third way to get a tape: DRIVE one. Keyboard → held set →
 * `run.advance` on the page's own pacer, every tick recorded; STOP folds
 * the session with the one fold and hands it to the REPLAY machinery above.
 *
 * ⛔ THE NO-LOOP LAW SURVIVES IT, and the distinction is the one the law
 * exists for. What it forbids is a second REPLAY loop — two readers of one
 * tape drift, and the one nobody tests is the one that drifts. A manual
 * drive is a PRODUCER, beside `solveSegment` and `botDriverV1/V2`: keys in,
 * `perTick` out, with no tape it claims to reproduce. ⛓ And the join is
 * ASSERTED rather than asserted-by-comment: STOP runs
 * `watchManual.foldRoundTrip`, which replays the fold through
 * `createTapeStepper` and compares EVERY observation and EVERY held set
 * against what the drive recorded. That comparison is the acceptance row.
 *
 * ⛔ RAW TRUTH SURVIVES IT: the live overlays are the replay's own
 * `sampleMovers`/`extractMarkers` calls over the session's real
 * observations, never a smoothed or predicted view; a refusal mid-drive
 * carries the run's own message WITH its tick and keeps the session, so
 * what was driven up to it can still be folded and looked at.
 *
 * ⛔ NO CLAIM SURVIVES IT: a hand-driven tape is never written to
 * `fixtures/`. It lives in the save box, in a download, and in your hands.
 *
 * ⚠ ONE NEW LIFETIME RULE CAME WITH IT — `replayGeneration`. Every arm used
 * to replay exactly once per document, because every way of leaving one
 * NAVIGATED; a pasted tape and a manual fold have no path to navigate to, so
 * two animation loops can now exist. The counter retires the superseded one.
 * It is NOT a conditional re-arm: within a generation a throw still re-arms
 * and reports its tick, which is R4's lesson and stays.
 *
 * ⛓⛓ AND THE SWITCH ARC GENERALISED IT (`watchLifetime`): the SOURCE
 * selector no longer navigates either, so ARMS now supersede each other in
 * one document too. Two counters, two questions — a manual fold supersedes a
 * REPLAY without ending the MANUAL arm that started it.
 */

import { buildLevelWorld, TILE_SIZE } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createRunForStaging, rolesForStaging, solveStaging } from './tapeRunner.js';
import {
    censusGoalOptions, censusWorld, defaultGoalsFromCensus, formatGoalsParam,
    harvestPresets, itemFlagsOf, ITEM_FORM_FIELDS, parseGoalsParam, readSolveParams,
    solveForPage, stagingFromJson, TRUE_START_CHAIN, TRUE_START_SEGMENT, withItemFlag,
} from './watchSolve.js';
import {
    activeTraceIndex, arrowLanesAt, ATTACK_HOLD_DEFAULT, attackHoldsAt, attackRectsAt,
    bodiesAt, channelSummary, collectRun, crushersAt, dangerQueriesAt, defaultLayerSet,
    hammerLinesAt, LAYER_IDS, MARKER_GLYPHS, markersVisibleAt, OVERLAY_LAYERS, overlaysFor,
    parseAttackHold, parseLayersParam, pathPointsUpTo, SWING_WINDOW_NOTE, traceRowFields,
    traceSidecarPath, worldChangesAt, dialogueAt,
} from './watchOverlays.js';
import {
    clampTick, createManualSession, foldRoundTrip, heldFromCodes, KEYBOARD_ROWS,
    liveOverlaysFor, parseTapeText, readViewParams, serializeTapeText, tapeKeyForCode,
} from './watchManual.js';
import {
    agreementWithPayload, agreementWithTrace, BIOME_NAMES, describeState, displaySolve,
    displayStaging, generateStep, generationRows, ladderCost, readGenerateParams,
    writeGenerateParams,
} from './watchGenerate.js';
import { atlasOf } from './procgenLevel.js';
import { createLifetimeHolder } from './watchLifetime.js';
/**
 * ⛓⛓⛓ THE ENTRANCES — ⚖ the user's item, and the module docblock is where the
 * measurements live (280 teleporters, 112 of 116 levels with an entrance, the
 * four without, and the half-tile between a boot block and a player position).
 */
import {
    BOOT_TO_PLAYER_OFFSET, collectEntrances, entranceLabel, entrancesTo, playerPointFor,
} from './watchEntrances.js';
import { parseDecisionTrace } from './decisionTrace.js';
import { coerceTerrainState, HAZARD_STATES, ITEM_NAMES, parseTape } from './tapeFormat.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
// ⛓ GROUP B: the legend states the swing's LENGTH, and it states the engine's
// own number rather than a page-side "5" — the one-spelling law, applied to a
// sentence. See `watchOverlays`' `SLASH_HIT_TICKS` import block.
import { SLASH_HIT_TICKS } from './presses.js';
import { TILE_TYPE_NAMES } from '../flashPanel/seedlingSemantics.js';

/** Paths are resolved against the REPO ROOT — the dev server's cwd. */
const ATLAS_URL = '/frontend/modules/flashPanel/atlases/seedling-map.json';
const WASM_PAGE = '../flashPanel/wasm/seedling_bot_ap/game.html';

const PIT = HAZARD_STATES.pit;

/**
 * Tile colours by TYPE, not by tileset column — the column is a drawing
 * detail and the type is what the physics reads. Anything unlisted falls
 * back to a plain floor colour, which is honest: it walks at 0.8 like the
 * rest.
 */
const TILE_COLOURS = {
    1: '#1d4f7a',   // Water
    6: '#000000',   // Pit — the R1 transport primitive
    10: '#7a6a3a',  // Cliff Stairs
    16: '#4a3f3a',  // Igneous Stone
    17: '#8a2b12',  // Lava
    21: '#c8d6e0',  // Snow
    22: '#8fc7d8',  // Ice
    25: '#2f7fa8',  // Waterfall
    28: '#4b3a63',  // Ghost Tile
    29: '#6b4a2a',  // Bridge — solid until something spears it
    30: '#6a5a83',  // Ghost Tile Step
};
const SOLID_COLOUR = '#3a3a42';
const FLOOR_COLOUR = '#6b6152';

/**
 * ⛓⛓⛓ GROUP B — THE OBJECT SOLIDS, BY FAMILY, AND THE COMPLAINT THAT FORCED
 * IT: *a pushable block and a breakable rock are the same grey box.*
 *
 * They were. Every entity solid — 1219 of them across the atlas's 116 levels —
 * was drawn `#55506a`, so the two things a room's puzzle is usually MADE of
 * were indistinguishable from each other and from a dresser.
 *
 * ⛔ THE KEY IS THE RUN'S OWN JOIN, NOT THE TAG. `levelWorld` stamps exactly
 * one id field per changeable solid (`pushableId`, `rockId`, `chestId`, …) —
 * the same field `liveRectOf` switches on and the same one the world-state
 * layer marks through. Colouring by `s.tag` instead would be a second
 * classification of the same objects: `breakablerock` and `breakablerockghost`
 * are two tags and one family, `lock`/`cover`/`wandlock`/`bosslock`/
 * `shieldlock`/`rocklock`/`grasslock` are seven tags and one, and the day a
 * class was added the palette would quietly fall back to grey while the
 * mechanics kept working.
 *
 * ⛔⛔ MEASURED FIRST: NO SOLID CARRIES TWO OF THESE FIELDS. Over all 116
 * levels — activatorId 70 · rockId 24 · pushableId 19 · chestId 16 · treeId 6
 * · magicalLockId 6 · bridgeId 5 · pulserId 4 · crusherId 4 · ropeId 3 ·
 * turretId 2 · shieldBossId 1 · bossId 1 · finalDoorId 1, and **zero**
 * multi-keyed. So "first field that matches" is a total function here and not
 * a precedence rule that happens to work; if that ever stops being true the
 * order below becomes a silent choice, which is why the measurement is written
 * down rather than assumed.
 *
 * ⚠ 1057 OF THE 1219 CARRY NO FIELD AT ALL and stay grey — trees, poles,
 * spires, statues, furniture. That is the honest answer: they are scenery with
 * no run-changeable state, the legend says so, and a palette that gave every
 * tag its own hue would spend the reader's whole colour budget on the 87% of
 * boxes nothing can happen to.
 */
const OBJECT_SOLID_FAMILIES = Object.freeze([
    Object.freeze({ key: 'pushableId', colour: '#6f5fd0', label: 'PUSHABLE block — a press or a lean moves it one tile' }),
    Object.freeze({ key: 'rockId', colour: '#a8703a', label: 'BREAKABLE rock — a press destroys it' }),
    Object.freeze({ key: 'chestId', colour: '#c0a038', label: 'chest' }),
    Object.freeze({ key: 'activatorId', colour: '#3f7f8a', label: 'lock / cover — opens while its group is held' }),
    Object.freeze({ key: 'magicalLockId', colour: '#8a3f8a', label: 'magical lock — the wand opens it' }),
    Object.freeze({ key: 'treeId', colour: '#3f7a3f', label: 'burnable tree' }),
    Object.freeze({ key: 'ropeId', colour: '#9a7a4a', label: 'rope — a pull SHRINKS it to one cell, it does not vanish' }),
    Object.freeze({ key: 'bridgeId', colour: '#6b4a2a', label: 'bridge — solid until something spears it' }),
    Object.freeze({ key: 'pulserId', colour: '#b04070', label: 'pulser — solid always; its flag makes it HIT' }),
    Object.freeze({ key: 'crusherId', colour: '#c04040', label: 'crusher — charges at a player it can SEE' }),
    Object.freeze({ key: 'turretId', colour: '#7fb0c0', label: 'ice turret — an ENEMY while alive, a wall once dead' }),
    Object.freeze({ key: 'bossId', colour: '#8a5f2a', label: 'boss totem — a wall until the wand WAKES it' }),
    Object.freeze({ key: 'shieldBossId', colour: '#9a4040', label: 'shield boss' }),
    Object.freeze({ key: 'finalDoorId', colour: '#5a5a9a', label: 'final door' }),
]);
/** Scenery: an object solid with no run-changeable state at all. */
const SCENERY_COLOUR = '#55506a';
const objectSolidColour = (s) => {
    for (const f of OBJECT_SOLID_FAMILIES) if (s[f.key]) return f.colour;
    return SCENERY_COLOUR;
};

/**
 * The overlay palette, by channel. Named here and rendered into the LEGEND
 * from the same table, so a colour nobody can identify is impossible —
 * `unknownShapes`' lesson applied to ink instead of geometry.
 */
const PATH_COLOURS = Object.freeze({
    player: '#7fe0ff',
    chaser: '#ff9a6a',
    spinner: '#d05090',
    pushable: '#9a8cff',
    arrow: '#8fc7d8',
});

/**
 * ⛓ SLICE 6's THREE SHAPE LAYERS, and their ink is deliberately NOT the
 * matching path colour.
 *
 * A chaser's PATH is `#ff9a6a` and its BOX is `#ffd0a0`: two readings of one
 * body, one cumulative and one at this tick, and a viewer that painted both
 * in the same colour would make "where it has been" and "where it is"
 * indistinguishable at exactly the moment they matter — the tick something
 * touched something.
 *
 * `hammerTouch` is the second hammer colour and it is the layer's whole
 * point: the line is drawn WHITE-HOT on the ticks the engine's own
 * `hammerHitsPlayer` says it reached the player, so the picture and
 * `run.spinnerContacts` agree on screen and not merely in a readout.
 */
const SHAPE_COLOURS = Object.freeze({
    hitbox: '#ffd0a0',
    hammer: '#ff8fd0',
    hammerTouch: '#ffffff',
    attack: '#ffd75f',
    /**
     * ⛓⛓⛓ GROUP B — THE AFTERIMAGE, AND ITS INK IS A DESATURATED `attack` ON
     * PURPOSE. It has to read as *the same swing, no longer live*: a hue of
     * its own would make it look like a different event, and the FULL `attack`
     * yellow would make a display choice indistinguishable from the tick the
     * engine collided a rect on. So it is the same colour drained, drawn
     * outline-only, and the legend row says the word "display choice".
     */
    attackHeld: '#8a7638',
    /**
     * ⛓ A LANE IS NOT AN ARROW, AND THE INK SAYS SO. `PATH_COLOURS.arrow` is
     * the flights; this is the trap's column. A distinct hue is the legend's
     * job made visible — the two layers answer different questions and a
     * reader who cannot tell them apart on the canvas has the legend's
     * distinction and not the picture's.
     */
    lane: '#7fd4ff',
    /**
     * ⛓⛓⛓ SLICE 9 — THREE INK FAMILIES, AND THE SEPARATION IS THE POINT.
     *
     * `gone`/`swapped`/`notsolid` are CORRECTIONS to the base picture. They
     * are deliberately a colour nothing else on the canvas uses, because the
     * mark's whole content is "the grey box under me is not true" — painting
     * it in the base's own greys would make the correction look like more
     * base.
     *
     * `crusher`/`crusherLane`/`crusherLaneLive` are RAW TRUTH: where the body
     * is and what the run's own scan can see from there.
     *
     * ⛔⛔ `danger`/`dangerClear` ARE NEITHER, AND THE INK SAYS SO LOUDEST.
     * ⚖ Item 9's supersession of §14.4c is conditional on the layer being
     * *explicitly labelled as the bot's heuristic*, and a colour shared with
     * any raw-truth layer would undo that label on the canvas whatever the
     * legend said. This is the one layer on the page that draws an OPINION,
     * so it gets an ink no fact wears.
     */
    gone: '#ff4f9f',
    swapped: '#8fff9f',
    notsolid: '#ffae4f',
    crusher: '#c04040',
    crusherLane: '#7a4040',
    crusherLaneLive: '#ff6a6a',
    danger: '#b070ff',
    dangerClear: '#4a3a70',
});

const $ = (id) => document.getElementById(id);
const fmt = (n) => (typeof n === 'number' ? Number(n.toFixed(4)) : n);

/**
 * ⛓ WHICH REPLAY OWNS THE CANVAS.
 *
 * Every arm used to replay exactly once per page load — leaving one always
 * NAVIGATED — so the animation loop could re-arm itself forever and never
 * meet a successor. Editor slice 3 breaks that: a PASTED tape has no path to
 * navigate to and a MANUAL session's fold has no path at all, so `replayTape`
 * can now run a second time in one document. ⚠ Since the switch arc the
 * SOURCE selector does not navigate either — but an ARM change is
 * `armLifetimes`' question, not this counter's.
 *
 * ⛔ WITHOUT THIS COUNTER THE TWO LOOPS BOTH DRAW. The first one keeps its
 * own `frames`/`cursor` closure and its own rAF chain; the canvas would
 * flicker between two runs and the HUD would disagree with itself every
 * other frame — a failure that looks like a rendering bug and is a lifetime
 * bug.
 *
 * ⚠ THE UNCONDITIONAL RE-ARM SURVIVES INTACT, and the distinction matters:
 * within a generation the loop still re-arms after a THROW (R4's lesson —
 * a frame that cannot be drawn must report its tick, not stop the clock).
 * What stops a loop is being SUPERSEDED, which is a decision, not a failure.
 */
let replayGeneration = 0;

/**
 * Replay a tape this page is HOLDING (a paste, an upload, a manual fold).
 *
 * Assigned by whichever arm knows the level source; the default refuses by
 * name rather than doing nothing, because "the button did nothing" is the
 * one outcome a user cannot act on.
 */
let replayLoadedTape = () => {
    fatal('this page has no level source, so a loaded tape cannot be replayed here',
        'the wasm side (`?side=wasm`) drives the recompiled game and does not build JS '
        + 'worlds. Load the tape with &side=js.');
};

/**
 * ⛓⛓⛓ WHICH ARM OWNS THE PAGE — the second lifetime question, and NOT the
 * one `replayGeneration` answers (see `watchLifetime`'s docblock for why the
 * two must stay separate: a manual fold supersedes a REPLAY without ending
 * the MANUAL arm that started it).
 *
 * ⚠ IT LANDED ONE SLICE BEFORE ITS FIRST USER, deliberately: the teardown was
 * built and proved while the selector still navigated and a document teardown
 * still retired everything anyway. A teardown written in the same commit as
 * the switch that needs it is a teardown tested only through that switch.
 *
 * The readout is what the browser row asserts on. It names the live arm and
 * keeps the retired ones, because "did the manual loop stop when I left it"
 * is a question about the past.
 */
const armLifetimes = createLifetimeHolder();

/**
 * ⛔⛔ A **GETTER**, AND THE FIRST CUT WAS AN ASSIGNMENT — measured, by the
 * browser row, which came back with an EMPTY `stopped` list for a loop it had
 * just watched stop.
 *
 * The holder publishes on every change, so the assignment ran at the instant
 * the switch happened. A retired loop's one blocked tick lands AFTER that
 * instant — it is the frame that was already scheduled — so the published
 * object was frozen one tick before the only evidence anybody reads it for.
 * ⚖ The same readout-assigned-from-a-getter trap the holder's own history hit
 * one level down, which is worth saying twice: a leak witness that is a
 * SNAPSHOT cannot see the leak, because leaks are what happens next.
 */
Object.defineProperty(window, '__editorLifetime', {
    get: () => armLifetimes.state(),
    configurable: true,
});

function readParams() {
    const q = new URLSearchParams(window.location.search);
    /**
     * ⛓ THE GENERATE ARM'S PARAMETERS, parsed where they are testable — and
     * its `source` WINS when it applies. `?source=generate` says so outright
     * and `?gen=` is unambiguous (nothing else in the page's vocabulary
     * spells it); everything else the arm reads (`?seed=`, `?count=`) is a
     * bound, not a selector, so a stale SOLVE link cannot land here.
     */
    const gen = readGenerateParams(window.location.search);
    return {
        gen,
        tape: q.get('tape'),
        side: (q.get('side') || 'js').toLowerCase(),
        speed: Number(q.get('speed') || 1),
        // ⚠ RAW. `parseLayersParam` is where it is decided, and it is pure so
        // the decision is tested; an absent parameter is not an empty one.
        layers: q.get('layers'),
        // ⛓ GROUP B: `?attackhold=N`, raw for the same reason — the decision
        // is `parseAttackHold`'s, which is pure and reports a bad value by
        // name instead of silently falling back.
        attackHold: q.get('attackhold'),
        // The SOLVE arm's own parameters, parsed where they are testable.
        ...readSolveParams(window.location.search),
        // ⛓ …and the VIEW parameters (`?tick=`, `?shot=`), for the same
        // reason and in the same shape. Both are pure decisions about a
        // string, so both are decided where a test can reach them.
        ...readViewParams(window.location.search),
        // ⛔ LAST, so it WINS over `readSolveParams`' inference. `?gen=` with
        // no `?source=` has to select GENERATE, and `readSolveParams` would
        // have already answered `replay` for that URL.
        ...(gen.isGenerate ? { source: 'generate' } : {}),
    };
}

function fatal(message, detail = '') {
    $('status').className = 'bad';
    $('status').textContent = message;
    $('detail').textContent = detail;
}

async function fetchJson(url, what) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${what}: ${url} — HTTP ${res.status}`);
    return res.json();
}

/**
 * ── ⛔⛔ CLEAR THE READOUTS, KEEP THE INPUTS ───────────────────────────
 *
 * The reload used to do this too, and indiscriminately. Doing it by hand
 * forces the distinction the reload never had to make, and the two halves
 * answer to different laws:
 *
 * A READOUT is a statement about a run — the status bar, the detail line, the
 * HUD, the legend, the trace panes, the progress bar, the canvas, and the
 * `window.__editorX` objects the browser rows assert on. Left standing across
 * a switch it becomes a statement about a run that is no longer on screen,
 * which is the RAW TRUTH law's plainest violation: a refusal from the SOLVE
 * arm sitting above a MANUAL session, describing nothing.
 *
 * AN INPUT is the user's own work — the boot boxes, the tape box, the goal
 * list, the seed and bounds. Clearing those is the thing this whole arc
 * exists to STOP doing. ⚠ So they are not listed here, and the omission is
 * the feature.
 */
function resetPageChrome() {
    $('status').className = '';
    $('status').textContent = '';
    $('detail').textContent = '';
    $('title').textContent = '';
    $('hud').innerHTML = '';
    $('legend').innerHTML = '';
    $('layers').innerHTML = '';
    $('trace').innerHTML = '';
    $('genTrace').innerHTML = '';
    $('bar').style.width = '0%';
    $('scrub').max = '0';
    $('scrub').value = '0';
    const canvas = $('canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    /**
     * ⛔ THE PAGE'S OWN READOUTS GO WITH THEM. `check-seedling-editor-*.mjs`
     * read these to decide whether the arm did what it claims, and a stale
     * `__editorSolve` under a live GENERATE would let a row assert a PASS
     * against the arm before last — a verifier reading the wrong run and
     * agreeing with it.
     */
    delete window.__editorSolve;
    delete window.__editorManual;
    delete window.__editorGenerate;
    delete window.__editorGenerated;
    // ⛓ And "an arm has finished mounting" is a claim about the arm that just
    // left. Cleared here, it becomes the honest thing to wait on: it reappears
    // only when the ARRIVING arm is done (see `mountArm`).
    delete window.__editorArm;
}

/**
 * ── ⛓⛓⛓ THE BLOCK AN ARM MOUNTS FROM, AND WHY THE BOX WINS ───────────
 *
 * ⛔ A BOX THAT ALREADY HOLDS A BLOCK BEATS `?boot=`. This is the whole point
 * of switching in place: you edit the starting conditions in SOLVE, look at
 * them in MANUAL, come back — and find your own block, not the one the URL
 * names. On a fresh document the box is empty and the URL wins, exactly as it
 * always did, so every existing link still opens what it always opened.
 *
 * ⚠ AND IT IS SAID OUT LOUD. The URL stops being the page's whole state the
 * moment this rule fires, so the note names where the block came from — a
 * view showing edits the link does not carry must not look like a view of the
 * link.
 *
 * ⛔⛔ UNPARSEABLE TEXT IS **KEPT AND REPORTED**, never replaced. Re-fetching
 * over it would delete the user's work at precisely the moment they most want
 * it back (they were mid-edit), and "the box was wrong so the page threw it
 * away" is not a recovery. The arm refuses to mount instead, with the
 * parser's own message — the same answer the boot form gives to the same
 * text.
 */
async function stagingForMount(boxEl, params) {
    const held = boxEl.value.trim();
    if (held) {
        let staging;
        try {
            staging = stagingFromJson(JSON.parse(held));
        } catch (e) {
            throw new Error('the block already in this tab\'s box will not parse, and it is '
                + 'KEPT rather than overwritten with what ?boot= names — fix it, or pick a '
                + `preset to load another one. The parser's own message: ${e.message}`);
        }
        return {
            staging,
            origin: 'THE BLOCK ALREADY IN THIS TAB\'S BOX — your own edits, kept across the '
                + `SOURCE switch and NOT re-read from ${params.boot ? `?boot=${params.boot}` : 'the true game start'}`,
            kept: true,
        };
    }
    if (params.boot) {
        const path = params.boot.replace(/^\/+/, '');
        return { staging: stagingFromJson(await fetchJson(`/${path}`, 'boot')), origin: path, kept: false };
    }
    return {
        staging: await trueStartStaging(),
        origin: `THE TRUE GAME START — ${TRUE_START_SEGMENT}'s boot block `
            + `(${TRUE_START_CHAIN} segment 1)`,
        kept: false,
    };
}

// ── side=js ──────────────────────────────────────────────────────────────

/**
 * Everything the viewer draws, per level, cached the same way the runner
 * memoises worlds. Built with the census the TAPE implies, exactly as
 * `runTape` picks it — a viewer that consulted a different census could
 * refuse to draw a level the run happily walks through.
 */
function makeRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    const trail = [];
    let scale = 1;
    /**
     * Hazard shapes this renderer does not know how to draw.
     *
     * Collected rather than thrown: a viewer that cannot draw one volume
     * should still draw the level. Surfaced by the caller, so a fourth shape
     * is a line in the detail bar rather than a silently missing rectangle —
     * or, as it was before R4, a dead animation loop.
     */
    const unknownShapes = new Set();

    /**
     * Size the canvas to a level, at the largest INTEGER scale that fits.
     *
     * ⚠ THE 560 IS A BUDGET, NOT A CLAMP. `Math.max(1, ...)` wins, so a
     * level taller than 560 px is drawn at scale 1 and the page scrolls —
     * which is the honest arm: the alternative is a fractional scale, and a
     * pixel-art canvas at 0.58x is a blurred lie about where the player is.
     * Level 12 is 640x960 and really does need 960 px of canvas.
     */
    function fit(world) {
        const w = world.width * TILE_SIZE;
        const h = world.height * TILE_SIZE;
        scale = Math.max(1, Math.min(
            Math.floor((canvas.parentElement.clientWidth - 8) / w),
            Math.floor(560 / h),
        ));
        canvas.width = w * scale;
        canvas.height = h * scale;
    }

    /**
     * Is the canvas already the right size for this level?
     *
     * ⛔ BOTH DIMENSIONS, and testing only the width was a real bug with a
     * real symptom: *"some maps, like level 12, display at the wrong height,
     * so the bottom part of the map is not displayed."*
     *
     * The R4 walk enters L37 (640x320) immediately before L12 (640x960).
     * Both are 640 px wide and L37 sits at scale 1, so a width-only guard
     * saw `canvas.width === 640 * 1`, skipped the refit, and drew L12 into a
     * canvas 320 px tall — **the top third of the level, and no indication
     * that the other 640 px existed.** It bites exactly when consecutive
     * levels share a pixel width at the same scale, which is why it looked
     * like "some maps".
     *
     * Phrased as "the canvas is world dimensions times ONE uniform scale",
     * because that is the invariant `fit` establishes and the thing a
     * consumer can check.
     */
    const fitted = (world) => canvas.width === world.width * TILE_SIZE * scale
        && canvas.height === world.height * TILE_SIZE * scale;

    const rect = (r, fill, alpha = 1) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.fillRect(r.x * scale, r.y * scale,
            (r.right - r.x) * scale, (r.bottom - r.y) * scale);
        ctx.globalAlpha = 1;
    };
    const outline = (r, stroke, width = 1) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.strokeRect(r.x * scale + 0.5, r.y * scale + 0.5,
            (r.right - r.x) * scale - 1, (r.bottom - r.y) * scale - 1);
    };

    /**
     * One sampled position, as a device-pixel dot.
     *
     * ⚠ THE SAME ROUNDING THE BREADCRUMB TRAIL USES, and for the same
     * reason: a 1x1 rect at a half-pixel offset is anti-aliased across four
     * pixels at ~25% alpha each, which at scale 1 makes a whole path nearly
     * invisible. It is a rasterisation detail, not smoothing — nothing about
     * the sampled position itself is adjusted, and the HUD still reports the
     * exact doubles.
     */
    const dotAt = (x, y, colour, alpha = 1) => {
        const d = Math.max(1, scale);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.fillRect(Math.round(x * scale) - (d >> 1), Math.round(y * scale) - (d >> 1), d, d);
        ctx.globalAlpha = 1;
    };

    /**
     * ⛓ SLICE 6 — a LINE in world coordinates, for the hammer.
     *
     * ⛔ THE ENDPOINTS ARE NOT ROUNDED. `dotAt` rounds because a 1x1 rect at a
     * half-pixel offset nearly vanishes; a stroked line is already several
     * device pixels long and rounding its ends would MOVE it — and this
     * line's whole content is where its far end is. The half-pixel offset is
     * the canvas convention for a crisp 1 px stroke, applied to the stroke and
     * not to the geometry.
     */
    const lineAt = (x0, y0, x1, y1, colour, width = 1) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(width, Math.round(scale / 2) * width);
        ctx.beginPath();
        ctx.moveTo(x0 * scale + 0.5, y0 * scale + 0.5);
        ctx.lineTo(x1 * scale + 0.5, y1 * scale + 0.5);
        ctx.stroke();
    };

    /**
     * A marker glyph, at the position its ledger's tick names.
     *
     * ⛔ THE `default` ARM IS THE LESSON, NOT DECORATION — the same one the
     * hazard-shape loop learned at R4. A marker source this renderer has no
     * glyph for must SAY SO on the canvas; "nothing drawn" and "nothing
     * happened" are indistinguishable otherwise.
     */
    /**
     * ⛓⛓⛓ SLICE 6 — WHAT THE LAST DRAW ACTUALLY PUT ON THE CANVAS.
     *
     * ⛔ THE POINT IS THAT IT IS WRITTEN INSIDE THE `if (on.has(…))` ARMS, not
     * beside them. Slice 5's two findings were both a control writing into
     * state nobody read, and both were caught by asserting in the DRIVEN
     * SYSTEM rather than at the widget. A readout derived alongside the draw
     * would repeat that mistake one layer up: `hammerLinesAt` could be
     * perfect, the checkbox could be checked, the `if` could be testing the
     * wrong key, and a derivation-shaped readout would report the line as
     * present while the canvas stayed empty.
     *
     * ⚠ LAST DRAW, not cumulative — these three layers are THIS TICK ONLY, so
     * the readout is reset at the top of each pass and describes the frame
     * you are looking at.
     */
    const drawn = {
        hitboxes: { boxes: [], why: null },
        hammer: { lines: [], why: null },
        attacks: [],
        /**
         * ⛓⛓⛓ GROUP B — ITS OWN CHANNEL, AND THAT IS THE WHOLE SAFEGUARD.
         * `attacks` is what the run COLLIDED; this is what the page is still
         * showing you afterwards. Folding the afterimage into `attacks` would
         * have made `check-seedling-editor-shapes`' claim — *"the attack rect
         * is drawn on its fired tick, and NOT OTHERWISE"* — pass on a picture
         * that no longer says that, which is a check measuring the page's
         * decoration instead of the game's timing.
         */
        attacksHeld: [],
        lanes: { lanes: [], why: null },
        /**
         * ⛓ SLICE 9's three, in the `{…, why}` PAIR SHAPE FROM THE OUTSET —
         * kickoff §16.9 item 1, and §16.5 is why it is worth saying: the shape
         * has to be chased into `get drawn()`, which is DOM-side and which no
         * module test reaches. All three can legitimately draw nothing, so all
         * three carry a reason.
         */
        worldstate: { changes: [], why: null },
        crushers: { crushers: [], why: null },
        danger: { queries: [], why: null },
    };

    const unknownGlyphs = new Set();
    function glyph(kind, x, y, colour, source) {
        const r = Math.max(3, 2 * scale);
        const px = Math.round(x * scale);
        const py = Math.round(y * scale);
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        ctx.lineWidth = Math.max(1, Math.round(scale / 2));
        ctx.beginPath();
        switch (kind) {
        case 'square':
            ctx.strokeRect(px - r, py - r, 2 * r, 2 * r);
            return;
        case 'cross':
            ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
            ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
            ctx.stroke();
            return;
        case 'plus':
            ctx.moveTo(px - r, py); ctx.lineTo(px + r, py);
            ctx.moveTo(px, py - r); ctx.lineTo(px, py + r);
            ctx.stroke();
            return;
        case 'diamond':
            ctx.moveTo(px, py - r); ctx.lineTo(px + r, py);
            ctx.lineTo(px, py + r); ctx.lineTo(px - r, py);
            ctx.closePath(); ctx.fill();
            return;
        case 'triangle':
            ctx.moveTo(px, py - r); ctx.lineTo(px + r, py + r); ctx.lineTo(px - r, py + r);
            ctx.closePath(); ctx.stroke();
            return;
        case 'circle':
            ctx.arc(px, py, r, 0, 7);
            ctx.stroke();
            return;
        default:
            unknownGlyphs.add(`${source} (glyph "${kind}")`);
        }
    }

    return {
        reset() { trail.length = 0; },
        fit,
        draw(world, state, opts) {
            if (!fitted(world)) fit(world);
            ctx.fillStyle = '#101014';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Tiles. A SOLID leaves the getState candidate list, so it is
            // drawn as a wall regardless of its type — that IS the fact the
            // resolver acts on.
            const solidRects = new Set(world.solids.map((s) => `${s.rect.x},${s.rect.y}`));
            for (const t of world.tiles) {
                const isSolid = solidRects.has(`${t.rect.x},${t.rect.y}`);
                rect(t.rect, isSolid ? SOLID_COLOUR : (TILE_COLOURS[t.t] ?? FLOOR_COLOUR));
            }
            // A HOLE is a cell with no tile at all — walkable, and the only
            // place the sticky resolver is observable. Left as background.

            // Object solids (buildings, statues, NPCs...) and pixelmasks.
            // ⛓ GROUP B: coloured by the run's own family join, not by tag —
            // see `OBJECT_SOLID_FAMILIES`. Scenery keeps the old grey.
            for (const s of world.objectSolids) rect(s.rect, objectSolidColour(s), 0.85);
            for (const p of world.pixelmasks) outline(p.rect, '#a06060');

            // Volumes. Teleporters and pits are TRANSPORT; the rest are
            // avoid volumes the planner routes around.
            for (const tp of world.teleporters) {
                if (tp.deactivated) continue;
                rect(tp.rect, '#2fa8a0', 0.35);
                outline(tp.rect, '#3fd8ce');
            }
            for (const t of world.tiles) {
                if (t.t === PIT) outline(t.rect, '#c04040', 2);
            }
            // ⚠ THREE SHAPES, and the third one arrived at R4 with a
            // `BossLock`. A hazard is a rect (`collide`), a disc
            // (`FP.distance < r`) or a LINE (`collideLine` over integer
            // probes) — and a `line` entry carries NEITHER `rect` NOR
            // `disc`, both null. This loop used to be `if (h.rect) ... else
            // <disc>`, which dereferenced `h.disc.x` on the first bosslock
            // it met and threw inside the rAF callback, killing the
            // animation with no message at all. Level 12 holds FIVE of them.
            //
            // The `default` arm is the lesson, not decoration: a fourth
            // shape should say so on the canvas rather than stop the clock.
            if (opts.on.has('volumes')) {
                for (const p of world.pickups) rect(p.rect, '#d8c030', 0.4);
                for (const h of world.proximityHazards) {
                    if (h.rect) {
                        rect(h.rect, '#d05090', 0.35);
                    } else if (h.disc) {
                        ctx.strokeStyle = '#d05090';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(h.disc.x * scale, h.disc.y * scale, h.disc.r * scale, 0, 7);
                        ctx.stroke();
                    } else if (h.line) {
                        // The probes are the INTEGER points `[x0, x1]` on
                        // row `y`, so the drawn band is one pixel tall and
                        // `x1 + 1` wide — never a rect enclosing them, which
                        // is the over-approximation the census refuses.
                        rect({
                            x: h.line.x0, right: h.line.x1 + 1,
                            y: h.line.y, bottom: h.line.y + 1,
                        }, '#ff6fae', 0.9);
                    } else {
                        unknownShapes.add(`${h.tag}@${h.x},${h.y} (${h.kind})`);
                    }
                }
            }

            // The breadcrumb trail — raw sampled positions, one per tick,
            // never interpolated.
            //
            // ⚠ FILTERED TO THE LEVEL BEING DRAWN. Every level is its own
            // coordinate space (`Game.as:1854` rewrites FP.width/height on
            // each load), so a dot recorded at (296,168) in level 94 means
            // nothing at (296,168) in level 0 — carrying the trail across a
            // swap draws a path the player never walked. The points keep
            // their level rather than being cleared, so scrubbing BACK
            // across a crossing restores the old level's trail instead of
            // losing it.
            //
            // ⚠ The DRAW position is rounded to the device pixel. That is a
            // rasterisation detail, not smoothing: a 1x1 rect at a half-pixel
            // offset is anti-aliased across four pixels at ~25% alpha each,
            // which at scale 1 makes the whole trail nearly invisible over
            // the floor colour. The HUD still reports the exact doubles, and
            // nothing about the path itself is adjusted.
            if (opts.on.has('player')) {
                for (const p of trail) {
                    if (p.level !== world.level) continue;
                    dotAt(p.x, p.y, PATH_COLOURS.player);
                }
            }

            /**
             * ── THE MOVER PATHS (kickoff §3.2) ──────────────────────────
             *
             * ⛔ FROM THE PER-TICK SAMPLES, NEVER FROM `world`. The world
             * this renderer draws is built SEPARATELY from the run's and is
             * never advanced (slice 1's §8.8 note, deliberate: the run's own
             * world would show END-state geometry at early scrub positions).
             * So its bodies are where the LEVEL put them, not where the run
             * has them, and a mover overlay read off it would draw every
             * enemy parked at its spawn for the whole tape.
             */
            const { samples, cursor } = opts;
            if (opts.on.has('enemies')) {
                for (const e of pathPointsUpTo(samples, cursor, world.level, 'enemies')) {
                    dotAt(e.x, e.y, PATH_COLOURS[e.kind] ?? PATH_COLOURS.chaser);
                }
            }
            if (opts.on.has('pushables')) {
                for (const b of pathPointsUpTo(samples, cursor, world.level, 'pushables')) {
                    dotAt(b.x + b.w / 2, b.y + b.h / 2, PATH_COLOURS.pushable);
                }
            }
            if (opts.on.has('arrows')) {
                for (const a of pathPointsUpTo(samples, cursor, world.level, 'arrows')) {
                    dotAt(a.x, a.y, PATH_COLOURS.arrow);
                }
            }

            /**
             * ── ⛓ THE SHAPE LAYERS (slice 6) — THIS TICK, NOT THE WALK ────
             *
             * Drawn BELOW the player and ABOVE the paths: they are geometry
             * the run holds right now, so they must not bury the player
             * sprite, and they must not be buried by three hundred path dots.
             *
             * ⛔ EVERY RECT AND EVERY LINE HERE CAME FROM THE ENGINE. This
             * block chooses colours and z-order and computes no geometry at
             * all — see `watchOverlays`' one-spelling import block.
             */
            drawn.hitboxes = { boxes: [], why: null };
            drawn.hammer = { lines: [], why: null };
            drawn.attacks = [];
            drawn.attacksHeld = [];
            drawn.lanes = { lanes: [], why: null };
            drawn.worldstate = { changes: [], why: null };
            drawn.crushers = { crushers: [], why: null };
            drawn.danger = { queries: [], why: null };
            /**
             * ⛓⛓⛓ SLICE 9 — THE WORLD-STATE MARKS, AND THEY ARE DRAWN FIRST
             * OF THE SHAPE LAYERS ON PURPOSE.
             *
             * They belong to the GEOMETRY above them — a correction to the
             * tiles and object solids already painted — so they sit under
             * every body, every lane and every line. Ordering them last would
             * put "this wall is gone" on top of the enemy standing where the
             * wall was, which reads as a mark on the enemy.
             *
             * ⛔ NOTHING IS UN-DRAWN. ⚖ The charter's own condition: the mark
             * says the base is no longer true; it does not erase the base. A
             * viewer that repainted the floor would be indistinguishable from
             * one that had built the world fresh, and the reader would lose
             * the only evidence that the picture needed correcting at all.
             */
            if (opts.on.has('worldstate')) {
                const w = worldChangesAt(samples, cursor, world.level);
                drawn.worldstate = { changes: [], why: w.why };
                for (const ch of w.changes) {
                    const b = ch.base;
                    if (ch.effect === 'swapped' && ch.rect) {
                        // What is TRUE now, filled; what the level built,
                        // outlined and struck through. Two boxes, because the
                        // fact is that they are DIFFERENT boxes.
                        outline(b, SHAPE_COLOURS.gone);
                        lineAt(b.x, b.y, b.right, b.bottom, SHAPE_COLOURS.gone);
                        rect(ch.rect, SHAPE_COLOURS.swapped, 0.3);
                        outline(ch.rect, SHAPE_COLOURS.swapped);
                    } else {
                        const ink = ch.effect === 'notsolid'
                            ? SHAPE_COLOURS.notsolid : SHAPE_COLOURS.gone;
                        outline(b, ink);
                        lineAt(b.x, b.y, b.right, b.bottom, ink);
                        lineAt(b.right, b.y, b.x, b.bottom, ink);
                    }
                    drawn.worldstate.changes.push({
                        id: ch.id, family: ch.family, tag: ch.tag, effect: ch.effect,
                        verb: ch.verb, base: ch.base, rect: ch.rect,
                    });
                }
            }
            /**
             * ⛓⛓⛓ THE CRUSHERS — the dangling R5 forward's first reader.
             *
             * ⛔ THE LANE OUTLINES ARE NOT FILLED unless the scan MATCHED
             * them. A crusher's four lanes are 32x96 each and a filled set
             * would bury the room the layer exists to explain; a matched lane
             * is the one fact worth the ink, because it is what will make the
             * body charge.
             */
            if (opts.on.has('crushers')) {
                const c = crushersAt(opts.live);
                drawn.crushers = { crushers: [], why: c.why };
                for (const body of c.crushers) {
                    for (const lane of body.lanes) {
                        if (lane.live) rect(lane.rect, SHAPE_COLOURS.crusherLaneLive, 0.15);
                        outline(lane.rect,
                            lane.live ? SHAPE_COLOURS.crusherLaneLive : SHAPE_COLOURS.crusherLane,
                            lane.live ? 2 : 1);
                    }
                    rect(body.rect, SHAPE_COLOURS.crusher, 0.3);
                    outline(body.rect, SHAPE_COLOURS.crusher);
                    drawn.crushers.crushers.push({
                        id: body.id, rect: body.rect, x: body.x, y: body.y,
                        resting: body.resting, shieldedBy: body.shieldedBy, dir: body.dir,
                        lanes: body.lanes.map((l) => ({ dir: l.dir, live: l.live, rect: l.rect })),
                        live: body.lanes.filter((l) => l.live).map((l) => l.dir),
                    });
                }
            }
            if (opts.on.has('danger')) {
                /**
                 * ⛓⛓⛓ ⚖ ITEM 9 — WHAT THE SOLVER WAS TOLD, AND NOTHING ELSE.
                 *
                 * ⛔ THE BOX IS `playerBoxAt(q.x, q.y)` — the ENGINE's own
                 * builder, and the very call `dangerNow` made when it asked
                 * (`dangerAt(run, tick, playerBoxAt(x, y))`). Not a rect this
                 * page assembled from the recorded position: a box literal
                 * without `right`/`bottom` never overlaps anything, silently,
                 * which is a defect this package has already paid for once.
                 *
                 * ⚠ AND THE REASONS ARE TEXT, WHICH IS A FACT ABOUT THE UNION
                 * AND NOT A SHORTCUT HERE. `dangerAt` returns `{kind, id,
                 * why}` per source and NO GEOMETRY, so there is no shape to
                 * draw for "an ARMED trap's lane" beyond the query box itself.
                 * Inventing one — reaching for `dangerVolumes` to fill in the
                 * picture — is precisely the third opinion the law forbids and
                 * the refusal §14.4c still stands on.
                 */
                const d = dangerQueriesAt(opts.dangerQueries, cursor, world.level);
                drawn.danger = { queries: [], why: d.why };
                for (const q of d.queries) {
                    const box = playerBoxAt(q.x, q.y);
                    const ink = q.danger ? SHAPE_COLOURS.danger : SHAPE_COLOURS.dangerClear;
                    rect(box, ink, q.danger ? 0.35 : 0.15);
                    outline(box, ink, 2);
                    drawn.danger.queries.push({
                        where: q.where, tick: q.tick, runTick: q.runTick, x: q.x, y: q.y,
                        danger: q.danger, mode: q.mode, horizon: q.horizon,
                        sources: q.sources.map((s) => ({ kind: s.kind, id: s.id, why: s.why })),
                        box,
                    });
                }
            }
            if (opts.on.has('hitboxes')) {
                /**
                 * ⛔ SLICE 8: `why` IS CARRIED OUT, exactly as `hammer` has
                 * done since slice 6. An empty hitboxes layer meant two things
                 * and drew one picture — L16's nine refused bodies looked
                 * identical to an empty corridor. See `bodiesAt`.
                 */
                const b = bodiesAt(samples, cursor, world.level);
                drawn.hitboxes = { boxes: [], why: b.why };
                for (const body of b.bodies) {
                    outline(body.rect, SHAPE_COLOURS.hitbox);
                    drawn.hitboxes.boxes.push({
                        id: body.id, kind: body.kind, tag: body.tag, rect: body.rect,
                    });
                }
            }
            if (opts.on.has('lanes')) {
                /**
                 * ⛓ THE ARMED TRAPS' COLUMNS — the trap's GEOMETRY, not the
                 * `arrows` layer's sampled flights. Outlined and barely
                 * filled: a lane runs the full height of the room, so a solid
                 * one would bury everything standing in it, which is exactly
                 * the population the layer exists to show is in danger.
                 */
                const l = arrowLanesAt(samples, cursor, world.level);
                drawn.lanes = { lanes: [], why: l.why };
                for (const lane of l.lanes) {
                    rect(lane.rect, SHAPE_COLOURS.lane, 0.12);
                    outline(lane.rect, SHAPE_COLOURS.lane);
                    drawn.lanes.lanes.push({ id: lane.id, t: lane.t, rect: lane.rect });
                }
            }
            if (opts.on.has('hammer')) {
                // ⚠ `why` is CARRIED OUT, not swallowed: "no spinner in this
                // room" and "this run has no clock" both draw nothing, and
                // only one of them is a limitation of the page.
                const h = hammerLinesAt(samples, cursor, world.level);
                drawn.hammer = { lines: [], why: h.why };
                for (const l of h.lines) {
                    lineAt(l.x0, l.y0, l.x1, l.y1,
                        l.touches ? SHAPE_COLOURS.hammerTouch : SHAPE_COLOURS.hammer,
                        l.touches ? 2 : 1);
                    drawn.hammer.lines.push({ ...l, degrees: l.angle * 180 / Math.PI });
                }
            }
            if (opts.on.has('attacks')) {
                /**
                 * ⛓⛓⛓ GROUP B — THE HELD RECTS FIRST, SO THE LIVE ONE IS ON
                 * TOP. A sword's five hit ticks overlap heavily (measured:
                 * `r6-owl-kill`'s rect walks 2.2 px across them), and drawing
                 * the afterimage last would put a dim outline over the bright
                 * fill of the tick the engine is actually swinging on.
                 *
                 * ⛔ OUTLINE ONLY, NEVER FILLED. `attackRectsAt`'s rows are
                 * filled AND outlined; these are the same geometry with the
                 * engine no longer behind it, and the difference has to be
                 * legible at a glance rather than only in the readout.
                 */
                for (const p of attackHoldsAt(
                    opts.presses, cursor, world.level, opts.attackHold)) {
                    outline(p.rect, SHAPE_COLOURS.attackHeld);
                    drawn.attacksHeld.push({
                        t: p.t, fired: p.fired, weapon: p.weapon, direction: p.direction,
                        rect: p.rect, age: p.age, hold: p.hold,
                    });
                }
                for (const p of attackRectsAt(opts.presses, cursor, world.level)) {
                    rect(p.rect, SHAPE_COLOURS.attack, 0.25);
                    outline(p.rect, SHAPE_COLOURS.attack);
                    drawn.attacks.push({
                        t: p.t, fired: p.fired, weapon: p.weapon, direction: p.direction,
                        rect: p.rect, hits: (p.hits ?? []).map((h) => h.id ?? h.tag ?? '?'),
                    });
                }
            }

            /**
             * ── ⛓⛓⛓ GROUP B: THE PLAYER IS TWO BOXES, AND ONLY ONE OF THEM
             * ── IS A COLLISION VOLUME ─────────────────────────────────────
             *
             * ⚖ The user asked which of the two overlapping boxes is the real
             * hitbox, and ruled that BOTH stay drawn once the answer was in
             * hand — so the answer lives here and in the legend rather than in
             * a layer toggle. It is:
             *
             *  · **WHITE, FILLED — `playerBoxAt(x, y)`.** THE hitbox. The
             *    engine's own `HITBOX` origin/width/height, the box the
             *    physics collides solids with, the box `dangerAt` is queried
             *    with (`dangerAt(run, tick, playerBoxAt(x, y))`), and the box
             *    `hammerHitsPlayer` is handed. If a question is "did that
             *    touch the player", this is the rect that answered it.
             *
             *  · **YELLOW, OUTLINE — `terrainProbeRect(x, y)`.** NOT a
             *    collision volume and never consulted as one. It is the same
             *    box shifted DOWN by `checkOffsetY = 1`, and it exists because
             *    `Player.getState()` (`Player.as:660`) compares the NEAREST
             *    TILE against that shifted rect to decide which terrain the
             *    player is standing in — water, ice, pit, lava. So it is a
             *    diagnostic of terrain PROBING: when the two boxes straddle a
             *    tile boundary, the yellow one is why the terrain readout says
             *    what it says.
             *
             * ⚠ THE ONE-PIXEL OVERLAP IS THE POINT, not a rendering artefact.
             * They differ by exactly `checkOffsetY`, which is the whole reason
             * a player can be collision-clear of a pit and reading `pit`.
             */
            outline(terrainProbeRect(state.x, state.y), '#ffd75f');
            rect(playerBoxAt(state.x, state.y), '#ffffff', 0.9);

            // Markers LAST, so the one the player is standing on is not
            // painted over by the player.
            for (const m of markersVisibleAt(opts.markers, cursor, world.level, opts.on)) {
                const g = MARKER_GLYPHS[m.source];
                if (!g) { unknownGlyphs.add(`${m.source}@${m.tick} (no glyph)`); continue; }
                glyph(g.glyph, m.x, m.y, g.colour, `${m.source}@${m.tick}`);
            }
        },
        mark(state, level) { trail.push({ x: state.x, y: state.y, level }); },
        /**
         * ⛓ What the LAST `draw` really put on the canvas (slice 6).
         *
         * ⚠ SLICE 8: `hitboxes` and `lanes` are `{…, why}` PAIRS, like
         * `hammer` — an empty layer and a layer with a reason are different
         * readouts, and this accessor has to carry the reason out or the
         * check that reads it cannot tell them apart. (It is also the shape
         * this getter got WRONG first: it still spread `hitboxes` as a bare
         * array and the page died on `drawn.hitboxes.map is not a function`,
         * which the browser row caught on its first run.)
         */
        get drawn() {
            return {
                hitboxes: {
                    boxes: drawn.hitboxes.boxes.map((b) => ({ ...b })),
                    why: drawn.hitboxes.why,
                },
                hammer: { lines: drawn.hammer.lines.map((l) => ({ ...l })), why: drawn.hammer.why },
                attacks: drawn.attacks.map((a) => ({ ...a })),
                attacksHeld: drawn.attacksHeld.map((a) => ({ ...a })),
                lanes: {
                    lanes: drawn.lanes.lanes.map((l) => ({ ...l })),
                    why: drawn.lanes.why,
                },
                /**
                 * ⛔ SLICE 9 — AND THIS IS THE ACCESSOR §16.5 CAUGHT WRONG.
                 * All three landed as `{…, why}` pairs at their producers, and
                 * a copier that spread one of them as a bare array is a page
                 * that will not load with every module test green. The browser
                 * row is what exercises these three lines.
                 */
                worldstate: {
                    changes: drawn.worldstate.changes.map((c) => ({ ...c })),
                    why: drawn.worldstate.why,
                },
                crushers: {
                    crushers: drawn.crushers.crushers.map((c) => ({ ...c })),
                    why: drawn.crushers.why,
                },
                danger: {
                    queries: drawn.danger.queries.map((q) => ({ ...q })),
                    why: drawn.danger.why,
                },
            };
        },
        /** Shapes met that this renderer has no arm for; empty is the norm. */
        get unknownShapes() { return [...unknownShapes]; },
        /** Marker sources met that this renderer has no GLYPH for; same law. */
        get unknownGlyphs() { return [...unknownGlyphs]; },
    };
}

async function runJs(params, lifetime) {
    // ⛓ A pasted or uploaded tape has no path to navigate to, so it replays
    // IN PLACE — through the same `replayLoadedTape` hook every arm sets, and
    // against this same level source (`armPrelude`).
    const { levelSource } = await armPrelude(params, lifetime);
    const tape = await fetchJson(`/${params.tape.replace(/^\/+/, '')}`, 'tape');
    if (!lifetime.alive()) return undefined;
    return replayTape(tape, params.tape, params, levelSource,
        await fetchTraceSidecar(params.tape));
}

/**
 * A committed tape's decision trace, if it has one.
 *
 * ⚠ A MISSING SIDECAR IS THE NORM, NOT AN ERROR — most of the roster is
 * hand-authored and only the solver's tapes carry a trace. So this NEVER
 * throws and always returns a reason: the pane renders "no trace for this
 * tape — <why>", with the path it looked for, and a fetch that failed for
 * some other reason (a malformed sidecar, a server error) is distinguishable
 * from a tape that simply never had one.
 *
 * ⛔ THROUGH `parseDecisionTrace`, the producer's own validator. A sidecar
 * this page rendered without validating would be a second, laxer reader of
 * a format that already has one.
 */
async function fetchTraceSidecar(tapePath) {
    const { path, why } = traceSidecarPath(tapePath);
    if (!path) return { trace: null, why };
    try {
        const res = await fetch(`/${path}`);
        if (!res.ok) {
            return { trace: null, why: `${path} — HTTP ${res.status} (only the solver's `
                + 'tapes carry a trace sidecar)' };
        }
        return { trace: parseDecisionTrace(await res.json(), path), why: null };
    } catch (e) {
        return { trace: null, why: `${path} — ${e.message}` };
    }
}

/**
 * Draw and scrub a tape — one fetched by REPLAY, or one SOLVE just folded.
 *
 * ⚠ ONE REPLAY PATH for both arms, deliberately. A solved tape shown by
 * some second, simpler renderer would be a picture of a run nobody had
 * replayed; going through here means the thing on screen is the thing the
 * stepper produced, which is the thing the differential would check.
 * `label` is what the status bar calls it — a path for REPLAY, a name for
 * SOLVE. Returns the collected frames, so a caller can report how many.
 */
/**
 * The renderer's per-level world source, memoised — ONE rule, and both arms
 * of the page reach it.
 *
 * ⚠ THE CENSUS THE STAGING BLOCK IMPLIES, THROUGH THE RUNNER'S OWN RULE, so
 * the viewer can never refuse to draw a level the run walks through. This
 * used to read `tape.noclip === false ? ROLES : RELAXED_ROLES` off the RAW
 * fetched JSON: a second spelling of `rolesForStaging` that agreed with it
 * only by accident, because a v1 tape's JSON carries no `noclip` key at all.
 * The raw test got the right answer for the wrong reason, and the obvious
 * tidy-up to `tape.noclip ? …` would have silently flipped the census on
 * every v1 fixture.
 *
 * ⚠ AND THE STAGING'S CLEARS, for the same reason as the census: a viewer
 * that built a level the run does not have would draw locks the player walks
 * straight through. Grouped BY LEVEL because `buildLevelWorld`'s orphan
 * guard refuses a tag the level does not own — the same rule `levelRun`
 * follows, and the reason it groups too.
 *
 * ⛓ `staging` is a PARSED TAPE for REPLAY/SOLVE and a MANUAL session's own
 * honest block for MANUAL. The two carry the same two fields this needs
 * (`noclip`, `persistence`), which is exactly what makes one rule possible —
 * `tapeRunner.stagingFromTape`'s whole point is that a tape IS a staging
 * block plus inputs.
 */
function makeWorldFor(levelSource, staging) {
    const roles = rolesForStaging(staging);
    const clearedByLevel = new Map();
    for (const c of staging.persistence ?? []) {
        if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
        clearedByLevel.get(c.level).push(c.tag);
    }
    const worlds = new Map();
    return (n) => {
        if (!worlds.has(n)) {
            const cleared = clearedByLevel.get(n);
            worlds.set(n, buildLevelWorld(levelSource(n),
                cleared ? { roles, cleared } : { roles }));
        }
        return worlds.get(n);
    };
}

/**
 * The ON set for this page load, and the `?layers=` names nobody knows.
 *
 * ⚠ CALLED ONCE PER ARM, and the Set it returns IS the live toggle state —
 * the checkboxes mutate it in place. Calling it again per draw would rebuild
 * the defaults every frame and silently undo every toggle.
 */
function layerSetFor(params) {
    const parsed = parseLayersParam(params.layers);
    return { on: parsed.on ?? defaultLayerSet(), unknown: parsed.unknown };
}

/**
 * ⛓⛓⛓ GROUP B — THE ATTACK HOLD, AND IT IS PAGE STATE RATHER THAN ARM STATE.
 *
 * The layer SET is per arm (`mountLayerControls` is handed one), because which
 * layers you want is a question about the walk you are looking at. How long an
 * afterimage should linger is a question about YOUR EYES, so it survives an arm
 * switch the way `?speed=` does — and the switch arc's whole point is that
 * changing SOURCE no longer reloads, which would otherwise be the only thing
 * resetting it.
 *
 * ⛔ IT IS READ AT DRAW TIME, NEVER CAPTURED. Every draw site passes
 * `attackHold: attackHoldNow()`, so the control's `onchange` needs to do
 * nothing but write and redraw — a value closed over at mount would go stale
 * the first time the knob moved, silently, and only on the arm that mounted
 * first.
 */
let attackHold = ATTACK_HOLD_DEFAULT;
const attackHoldNow = () => attackHold;

/**
 * ⛓⛓⛓ GROUP B — AUTO-ADVANCE THE CEREMONY TEXT WHILE DRIVING BY HAND.
 *
 * ⚖ The user's own suggestion, and ON by default because without it a manual
 * drive that walks onto a pickup simply stops: the screen freezes, the page
 * says nothing, and paging out needs SPACED X releases the driver has no way
 * to know about (`PRESS_GAP` — a release that lands mid-type-out fast-forwards
 * the page instead of turning it).
 *
 * ⛔ IT IS A SWITCH AND HAS TO BE. It makes the page dispatch keys the driver
 * did not press, and those keys are RECORDED — they are in the folded tape,
 * which is the honest outcome and also exactly why turning it off must be
 * possible. Page state like `attackHold`, for the same reason: it is a
 * question about how you want to drive, not about the walk you are looking at.
 */
let autoAdvanceText = true;
const autoAdvanceTextNow = () => autoAdvanceText;

/**
 * The per-layer toggles and the LEGEND, both generated from `OVERLAY_LAYERS`
 * and `MARKER_GLYPHS`.
 *
 * ⛔ ONE ROSTER. A hand-written checkbox list would be a second copy of the
 * layer table, and the day a layer was added the URL parameter and the UI
 * would disagree about how many there are.
 *
 * ⛓ Extracted from `replayTape` at slice 3 so the MANUAL arm gets the same
 * eight toggles over its LIVE drive — a second copy for the live view would
 * be the same fork one level down.
 */
function mountLayerControls(on, redraw) {
    const layerBox = $('layers');
    layerBox.innerHTML = '';
    for (const l of OVERLAY_LAYERS) {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = `layer-${l.id}`;
        box.checked = on.has(l.id);
        box.onchange = () => {
            if (box.checked) on.add(l.id); else on.delete(l.id);
            redraw();
        };
        label.appendChild(box);
        label.appendChild(document.createTextNode(` ${l.label}`));
        layerBox.appendChild(label);
    }
    /**
     * ⛓⛓⛓ GROUP B — THE HOLD KNOB, NEXT TO the toggles and NOT INSIDE THEM.
     *
     * ⛔⛔ `#viewknobs`, NOT `#layers`, AND THE CONTAINER IS A CONTRACT. Three
     * acceptance rows enumerate `#layers input` to assert that the toggle count
     * and `OVERLAY_LAYERS` agree — so a field that is not a layer, mounted in
     * that box, reports the roster as one longer than it is. MEASURED: the
     * first cut put it there and reddened `check-seedling-editor-world`,
     * `-lanes` and `-shapes` simultaneously, each complaining "FIFTEEN now — 16".
     * It is a knob about the DISPLAY, not a member of the roster, and it now
     * lives where that is true of the DOM as well as of the prose.
     *
     * ⚠ `.onchange`, NOT `addEventListener` — the idiom every control in this
     * function already uses, and the one `watchLifetime.test.js` asserts
     * STRUCTURALLY over this source. The box is rebuilt on every arm mount, so
     * the handler dies with the element and there is nothing to retire.
     */
    const knobBox = $('viewknobs');
    knobBox.innerHTML = '';
    const holdLabel = document.createElement('label');
    holdLabel.title = `${SWING_WINDOW_NOTE.hold}\n\n${SWING_WINDOW_NOTE.sword}`
        + `\n\n${SWING_WINDOW_NOTE.spear}`;
    const holdInput = document.createElement('input');
    holdInput.type = 'number';
    holdInput.id = 'attack-hold';
    holdInput.min = '0';
    holdInput.step = '1';
    holdInput.style.width = '52px';
    holdInput.value = String(attackHoldNow());
    holdInput.onchange = () => {
        const n = Number(holdInput.value);
        // ⚠ A TYPED-IN NONSENSE VALUE SNAPS BACK rather than being accepted as
        // NaN and quietly drawing nothing — the field then SHOWS what is in
        // force, which is the only way a reader can tell the two apart.
        attackHold = Number.isInteger(n) && n >= 0 ? n : attackHoldNow();
        holdInput.value = String(attackHoldNow());
        redraw();
    };
    holdLabel.appendChild(document.createTextNode('attack hold '));
    holdLabel.appendChild(holdInput);
    holdLabel.appendChild(document.createTextNode(' ticks (display choice)'));
    knobBox.appendChild(holdLabel);
    /**
     * ⛓⛓⛓ GROUP B — THE AUTO-ADVANCE SWITCH, in the knob box beside the hold.
     *
     * ⚠ IT ONLY BITES ON THE MANUAL ARM (nothing else dispatches keys), but it
     * is mounted for every arm on purpose: an option that appeared and vanished
     * with the SOURCE selector would be one a reader could not find in order
     * to reason about a tape they had already driven.
     */
    const autoLabel = document.createElement('label');
    autoLabel.title = 'A pickup ceremony freezes the player and pages on `Input.released(X)`, '
        + 'spaced by `PRESS_GAP` — a release that lands mid-type-out fast-forwards the page '
        + 'instead of turning it. With this on, the page drives those releases for you, on '
        + 'the SAME cadence `botDriverV2.runCollect` uses. ⚠ They are RECORDED: the folded '
        + 'tape contains every key dispatched, including these.';
    const autoBox = document.createElement('input');
    autoBox.type = 'checkbox';
    autoBox.id = 'auto-advance-text';
    autoBox.checked = autoAdvanceTextNow();
    autoBox.onchange = () => { autoAdvanceText = autoBox.checked; };
    autoLabel.appendChild(autoBox);
    autoLabel.appendChild(document.createTextNode(
        ' auto-advance ceremony text while driving (records the X releases)'));
    knobBox.appendChild(autoLabel);
    const swatch = (colour, text) =>
        `<span class="sw"><i style="background:${colour}"></i>${text}</span>`;
    $('legend').innerHTML = [
        swatch(PATH_COLOURS.player, 'player'),
        swatch(PATH_COLOURS.chaser, 'chaser'),
        swatch(PATH_COLOURS.spinner, 'spinner'),
        swatch(PATH_COLOURS.pushable, 'pushable'),
        swatch(PATH_COLOURS.arrow, 'arrow'),
        // ⛓ SLICE 6's three, each with a row of its own. A layer whose ink
        // nobody can name is the `unknownShapes` lesson applied to colour —
        // the reason this legend is generated from the tables rather than
        // written out — and three new strokes with no legend rows would have
        // re-opened exactly that.
        swatch(SHAPE_COLOURS.hitbox, 'enemy hitbox (this tick)'),
        swatch(SHAPE_COLOURS.hammer, 'hammer line'),
        swatch(SHAPE_COLOURS.hammerTouch, 'hammer REACHING the player'),
        swatch(SHAPE_COLOURS.attack, 'attack rect (fired) — a SWORD press fires '
            + `${SLASH_HIT_TICKS}, on T+1…T+${SLASH_HIT_TICKS}; a spear records ONE`),
        // ⛓⛓⛓ GROUP B. The row says "display choice" in words for the same
        // reason the `danger` row says "the bot's HEURISTIC": this is the only
        // other stroke on the canvas that is not something the run did, and a
        // reader who cannot tell it from the live rect has the page's own
        // afterimage back as evidence.
        swatch(SHAPE_COLOURS.attackHeld, 'the same rect HELD after the swing ended — '
            + 'a DISPLAY CHOICE of this page, not the game\'s timing (set the hold to 0)'),
        // ⛓ SLICE 8, and the wording carries the whole distinction: the
        // ARROW swatch above is the sampled FLIGHTS, this is the trap's own
        // COLUMN while it is armed. Two layers, two rows, two sentences —
        // a legend that said "arrows" twice would be the blur itself.
        swatch(SHAPE_COLOURS.lane, 'armed arrow-trap LANE (the column, not the flights)'),
        // ⛓ SLICE 9. Six rows for three layers, because three of the strokes
        // are corrections to the BASE picture and a reader who cannot tell a
        // correction from a fact has the picture's distinction and not the
        // legend's — the `unknownShapes` lesson applied to meaning.
        swatch(SHAPE_COLOURS.gone, 'GONE — the level built a solid here and the run has removed it'),
        swatch(SHAPE_COLOURS.swapped, 'the box that is REALLY there now (a pulled rope, a turret corpse)'),
        swatch(SHAPE_COLOURS.notsolid, 'drawn as a wall and NOT one — a live ice turret is an Enemy'),
        swatch(SHAPE_COLOURS.crusher, 'crusher body, where the RUN left it'),
        swatch(SHAPE_COLOURS.crusherLaneLive, 'crusher trigger lane the scan MATCHED (dim = not matched)'),
        // ⚖ The one OPINION on the canvas, and the row says so in words —
        // item 9's "labelled as the bot's HEURISTIC" is this line plus the ink.
        swatch(SHAPE_COLOURS.danger, 'the box the SOLVER asked about, and was told DANGER '
            + '(dim = told clear) — the bot\'s HEURISTIC, not what happened'),
        /**
         * ⛓⛓⛓ GROUP B — THE PLAYER'S TWO BOXES, NAMED.
         *
         * ⚖ The user's question was "which of these is the real hitbox?", and
         * that it had to be asked at all is the finding: the page drew two
         * overlapping boxes one pixel apart and told nobody which was which.
         * ⚖ The ruling was to keep both and DOCUMENT them, so these two rows
         * are the fix. See the draw site for the mechanism.
         */
        swatch('#ffffff', 'the PLAYER HITBOX — `playerBoxAt`, the box that collides '
            + 'solids and the box `dangerAt` is asked about'),
        swatch('#ffd75f', 'the TERRAIN PROBE — `terrainProbeRect`, the hitbox shifted down '
            + '`checkOffsetY` (1 px), which `getState` compares the nearest tile against. '
            + 'NOT a collision volume'),
        /**
         * ⛓⛓⛓ GROUP B — ONE ROW PER OBJECT-SOLID FAMILY, generated from the
         * table the renderer colours from, for `OVERLAY_LAYERS`' own reason: a
         * hand-written list would be a second copy, and the day a family was
         * added the canvas would grow a hue with no name.
         */
        ...OBJECT_SOLID_FAMILIES.map((f) => swatch(f.colour, f.label)),
        swatch(SCENERY_COLOUR, 'scenery — an object solid with no state a run can change '
            + '(trees, poles, statues, furniture: 1057 of the atlas\'s 1219)'),
        ...Object.values(MARKER_GLYPHS).map(
            (g) => swatch(g.colour, `${g.glyph} = ${g.label}`)),
    ].join('');
}

/**
 * @param {Array|null} [dangerQueries] ⚖ item 9 — `solveSegment`'s record of
 *   the danger the SOLVER was told, when this replay is a solve's own output.
 *   `null` on every other path, and the distinction is load-bearing: the layer
 *   reports "no solver ran" by NAME rather than drawing an empty picture that
 *   looks like a calm room (trap 196, and item 9 names the sentence).
 */
async function replayTape(tape, label, params, levelSource, traceSource = null,
    dangerQueries = null, { scratchPersistence = false } = {}) {
    replayGeneration += 1;
    const myGeneration = replayGeneration;
    const canvas = $('canvas');
    const renderer = makeRenderer(canvas);
    const parsed = parseTape(tape);
    const worldFor = makeWorldFor(levelSource, parsed);

    /**
     * ⛓⛓⛓ ONE WALK, TWO READINGS — the frames the scrubber shows and the
     * per-tick mover SAMPLES the overlays draw, collected together by
     * `watchOverlays.collectRun`.
     *
     * Collect eagerly: a tape is at most a few thousand ticks and the whole
     * point of scrubbing is that going BACK costs nothing. It is still the
     * one loop — every frame and every sample comes from the stepper, and
     * the samples come through its `onTick` hook, whose own docblock calls
     * it "the one seam a claim may read live state through".
     *
     * ⛔ THIS IS WHY NO ENGINE CHANGE WAS NEEDED, and slice 1's §8.8 note
     * expected one. That note read the stepper's RETURN OBJECT (`{tape,
     * tickCount, worldFor, next, …}`, which indeed exposes no run) and
     * concluded slice 2 needed an additive `run` getter. It does not: the
     * hook has forwarded the run since R6 slice 4. A getter beside it would
     * have been a second way to reach the same object — trap 119's family
     * in its other form, a seam with no consumer because the consumer
     * already had one.
     */
    /**
     * ⛓⛓⛓ PROCGEN PoC SLICE 5 — THE SCRUB FORK, and the ONE caller that
     * passes the flag is the GENERATE arm.
     *
     * §13.4's residue: a generated solve can bank a kill-lock clear that
     * `tapeFormat` cannot declare (`persistence[].level` is bounded to the
     * real game's 0..115 and a generated level is 900), so re-stepping that
     * tape on the ordinary path throws MID-WALK — measured, 270 of 379
     * frames. The default here is FALSE, so every other arm (REPLAY, SOLVE,
     * MANUAL, a paste, an upload) scrubs exactly as it always did and a
     * committed tape's undeclared clear is still the refusal it should be.
     */
    const collected = collectRun(tape, levelSource, { scratchPersistence });
    const { frames, samples, finished, run } = collected;
    if (collected.error) {
        fatal('the run threw before finishing — the viewer shows what it got',
            collected.error.message);
    }
    let cursor = 0;
    /**
     * ⛓ `?tick=` AND `?shot=` BOTH START PAUSED, and that is the whole
     * content of "initial cursor". A page that landed on tick 200 and
     * immediately played forward from it has not shown you tick 200; the
     * parameter would be a flicker. `?shot=1` needs it for a second reason —
     * a screenshot of an animating page is a screenshot of whenever the
     * shutter happened to open.
     */
    let playing = !(params.shot || params.tick !== null);
    let speed = params.speed;

    /**
     * ── THE LAYERS, THE MARKERS AND THE LEGEND (kickoff §3.2) ──────────
     *
     * Derived ONCE, from the ledgers the run already kept and the frames
     * just collected. Nothing here re-simulates anything, and every
     * marker's position is the position the run held on the tick its own
     * ledger names.
     */
    const layerParam = layerSetFor(params);
    const on = layerParam.on;
    const { markers, unplaced, presses } = overlaysFor(collected);

    $('scrub').max = String(Math.max(0, frames.length - 1));
    $('status').className = 'ok';
    $('status').textContent = `${label} — ${frames.length} observations`;

    const hud = () => {
        const f = frames[cursor];
        if (!f) return;
        const world = worldFor(f.observation.level);
        const raw = f.state.terrain ?? 0;
        const eff = coerceTerrainState(raw, parsed.noHazards ?? []);
        const fall = f.state.fall;
        $('hud').innerHTML = [
            row('tick', `${f.observation.t} / ${parsed.tick_count}`),
            row('level', `${f.observation.level} (${world.width}x${world.height})`),
            row('position', `${fmt(f.observation.x)}, ${fmt(f.observation.y)}`),
            row('velocity', `${fmt(f.state.vx)}, ${fmt(f.state.vy)}`),
            // BOTH values. `noHazards` is exactly their difference, and a
            // viewer that showed one would hide the whole relaxation.
            row('terrain raw', `${raw} ${TILE_TYPE_NAMES[raw] ?? ''}`),
            row('terrain effective', `${eff} ${TILE_TYPE_NAMES[eff] ?? ''}`,
                eff === raw ? '' : 'coerced'),
            row('held', [...f.held].join(' + ') || '—'),
            row('transport', fall
                ? `${fall.phase}${fall.phase === 'out' ? ` alpha ${fmt(fall.alpha)}`
                    : ` yStart ${fall.yStart}${fall.bounced ? ' (bounced)' : ''}`}`
                : '—', fall ? 'transport' : ''),
            row('transitions', f.transitions.length
                ? f.transitions.map((t) => `${t.from_level}→${t.to_level}@${t.t}`).join(' ')
                : '—'),
            row('grants', f.grants.length
                ? f.grants.map((g) => `L${g.level} ${g.items.join('+')}@${g.t}`).join(' ')
                : '—'),
            row('items', f.inventory
                ? (ITEM_NAMES.filter((n) => n !== 'health')
                    .filter((n) => f.inventory[itemProp(n)]).join(' ') || '—')
                    + `  hitsMax=${f.inventory.hitsMax}`
                : '—'),
        ].join('');
        renderer.draw(world, f.state, {
            on,
            samples,
            markers,
            presses,
            // ⛓ GROUP B: read at DRAW time, never captured — see `attackHold`.
            attackHold: attackHoldNow(),
            cursor,
            /**
             * ⛓⛓⛓ SLICE 9 — THE R5 FORWARD, READ OFF THE FRAME ITSELF.
             * `crushers`/`crusherScans` are the two channels `sampleMovers`
             * deliberately did NOT copy (its own docblock: they "are already
             * on the frame"), so the layer takes them from the frame the
             * scrubber is showing rather than from a second reading. That is
             * what makes this the FORWARD's reader and not a fifth sampler.
             */
            live: { crushers: f.crushers, crusherScans: f.crusherScans },
            dangerQueries,
        });
        // ⛓ GROUP B: scrubbing a REPLAY through a pickup shows its text too —
        // the same call the manual arm makes, over the same sample channel.
        dialogue = renderDialogue(samples, cursor, f.observation.level);
        pane.highlight(cursor);
    };
    /** ⛓ GROUP B: the last ceremony readout, for `__editorOverlays`. */
    let dialogue = { ceremony: null, visible: '', why: null };

    const itemProp = (name) => {
        // The property behind an item name, without importing the table's
        // internals: the mirror is keyed by property.
        const map = {
            sword: 'hasSword', darksword: 'hasDarkSword', ghostsword: 'hasGhostSword',
            shield: 'hasShield', darkshield: 'hasDarkShield', wand: 'hasWand',
            firewand: 'hasFireWand', fire: 'hasFire', conch: 'canSwim',
            feather: 'hasFeather', spear: 'hasSpear', darksuit: 'hasDarkSuit',
            torch: 'hasTorch',
        };
        return map[name] ?? name;
    };
    const row = (k, v, cls = '') =>
        `<div class="r ${cls}"><span>${k}</span><b>${v}</b></div>`;

    function seek(i) {
        cursor = Math.max(0, Math.min(frames.length - 1, i));
        renderer.reset();
        for (let j = 0; j <= cursor; j++) renderer.mark(frames[j].state, frames[j].observation.level);
        $('scrub').value = String(cursor);
        hud();
    }

    let acc = 0;
    /**
     * ⚠ A THROW IN HERE USED TO STOP THE CLOCK AND SAY NOTHING.
     *
     * `requestAnimationFrame(frame)` is the LAST statement, so anything that
     * threw above it — a level whose geometry the renderer had no arm for,
     * say — skipped the re-arm and the animation simply froze mid-walk. No
     * status, no detail, no console line the page surfaced: indistinguishable
     * from a slow tape or a paused one.
     *
     * That is exactly how R4's third hazard shape presented: the viewer
     * stopped "near the beginning, when it entered level 12", which holds
     * FIVE bosslocks. So the re-arm is unconditional now and the failure is
     * REPORTED, once, with the tick it happened on — a viewer that cannot
     * draw a frame should say which one.
     */
    let frameError = null;
    function frame() {
        // ⛔ SUPERSEDED, so this loop retires. NOT the same thing as the
        // conditional re-arm the docblock above forbids: a throw still
        // re-arms below, because a frame that cannot be drawn must report
        // its tick rather than stop the clock.
        if (myGeneration !== replayGeneration) return;
        try {
            if (playing && frames.length) {
                acc += speed;
                while (acc >= 1 && cursor < frames.length - 1) {
                    cursor += 1;
                    acc -= 1;
                    renderer.mark(frames[cursor].state, frames[cursor].observation.level);
                }
                if (acc >= 1) acc = 0;
                if (cursor >= frames.length - 1) playing = false;
                $('scrub').value = String(cursor);
                hud();
            }
        } catch (e) {
            playing = false;
            if (!frameError) {
                frameError = e;
                const f = frames[cursor];
                fatal(`the viewer could not draw observation ${f?.observation.t} `
                    + `(level ${f?.observation.level}) — the RUN is unaffected, this is `
                    + 'the drawing side', `${e.message}\n${e.stack ?? ''}`);
            }
        }
        requestAnimationFrame(frame);
    }

    $('play').onclick = () => {
        if (cursor >= frames.length - 1) seek(0);
        playing = !playing;
        $('play').textContent = playing ? 'Pause' : 'Play';
    };
    $('scrub').oninput = (e) => { playing = false; $('play').textContent = 'Play'; seek(Number(e.target.value)); };
    $('speed').oninput = (e) => { speed = Number(e.target.value); $('speedv').textContent = `${speed}x`; };
    $('speed').value = String(speed);
    $('speedv').textContent = `${speed}x`;

    mountLayerControls(on, hud);

    // ── the trace pane (kickoff §3.3) ────────────────────────────────
    const pane = mountTracePane(traceSource, (t) => {
        playing = false;
        $('play').textContent = 'Play';
        seek(t);
    });

    /**
     * ── ⛓ `?tick=N` — THE INITIAL CURSOR ────────────────────────────────
     *
     * Through `clampTick`, which CLAMPS AND SAYS SO: a tape shorter than the
     * requested tick is a real fact (usually the run threw early), and
     * landing silently on the last frame would present a truncated run as a
     * complete one at the wrong cursor.
     */
    const landed = clampTick(params.tick, frames.length);
    seek(landed.tick);
    $('play').textContent = playing ? 'Pause' : 'Play';
    requestAnimationFrame(frame);

    if (finished) {
        // ⚠ NAMED, NOT SILENT: a hazard shape this renderer has no arm for
        // draws nothing, and "nothing drawn" and "no volume there" look
        // identical on a canvas.
        const unknown = renderer.unknownShapes;
        $('detail').textContent = `finished: ${finished.transitions.length} transition(s), `
            + `${finished.transports.length} pit transport(s), `
            + `${finished.grants.length} grant(s)`
            + (unknown.length
                ? `  ⚠ ${unknown.length} volume(s) NOT DRAWN — no renderer arm for their `
                + `shape: ${unknown.join(', ')}`
                : '');
    }

    /**
     * ⚠ THE OVERLAYS' OWN ABSENCES, REPORTED. Three of them, and every one
     * reads as "quiet run" on a canvas if nobody says otherwise:
     * a `?layers=` name nobody knows, a ledger row with nowhere to stand,
     * and a marker source with no glyph.
     */
    const notes = [];
    if (layerParam.unknown.length) {
        notes.push(`⚠ ?layers= names ${layerParam.unknown.length} unknown layer(s): `
            + `${layerParam.unknown.join(', ')} — the roster is ${LAYER_IDS.join(', ')}`);
    }
    if (unplaced.length) {
        // ⚠ "NOT PLACED", not "NOT DRAWN", and the two words are two facts.
        // A volume is NOT DRAWN because this renderer has no arm for its
        // SHAPE; a ledger row is NOT PLACED because there is no tick to
        // stand it on. `probe-seedling-watch-page` asserts on the first
        // phrase, and one word for both would have made an unplaceable
        // clear read as a renderer that had lost a hazard shape.
        // Grouped BY REASON: a full walk has seven tickless clears and all
        // seven carry the same paragraph. The rows are still named
        // individually — the reason is what repeats, not the finding.
        const byWhy = new Map();
        for (const u of unplaced) {
            if (!byWhy.has(u.why)) byWhy.set(u.why, []);
            byWhy.get(u.why).push(u.what);
        }
        notes.push(`⚠ ${unplaced.length} ledger row(s) NOT PLACED: `
            + [...byWhy].map(([why, what]) => `${what.join(', ')} — ${why}`).join('  ·  '));
    }
    if (renderer.unknownGlyphs.length) {
        notes.push(`⚠ ${renderer.unknownGlyphs.length} marker(s) with no glyph: `
            + renderer.unknownGlyphs.join(', '));
    }
    /**
     * ⚠ SLICE 6 — THE HAMMER LAYER'S NAMED ABSENCE. A spinner room whose boot
     * declares no `save.time` draws no line, and an empty canvas is what "the
     * hammer is not swinging" looks like too. Only 28 of the 153 committed
     * tapes ever have a live clock (this slice's roster sweep), so the absence
     * is the COMMON case and saying so is not a corner-case courtesy.
     */
    if (renderer.drawn.hammer.why) notes.push(`⚠ no hammer line: ${renderer.drawn.hammer.why}`);
    /**
     * ⛓ SLICE 9 — THE TWO NEW NAMED ABSENCES THAT ARE WORTH SAYING OUT LOUD
     * AT LOAD, and the third that is not.
     *
     * `worldstate` and `crushers` both draw nothing in most rooms in the game,
     * and a reader who has just switched a layer on deserves to be told
     * WHICH nothing before concluding the layer is broken. The DANGER layer is
     * deliberately NOT here: it is OFF by default (⚖ item 9), so a note about
     * it at load would be the page explaining a layer nobody asked to see —
     * and its own `why` is on the readout the moment it is switched on.
     */
    if (renderer.drawn.worldstate.why) {
        notes.push(`⚠ no world-state change drawn: ${renderer.drawn.worldstate.why}`);
    }
    if (renderer.drawn.crushers.why) notes.push(`⚠ no crusher drawn: ${renderer.drawn.crushers.why}`);
    // ⚠ A `?tick=` this page could not honour EXACTLY says so — both the
    // unreadable form (`readViewParams`) and the out-of-range one.
    if (params.tickWhy) notes.push(`⚠ ${params.tickWhy}`);
    if (landed.why) notes.push(`⚠ ${landed.why}`);
    if (notes.length) {
        $('detail').textContent += `${$('detail').textContent ? '\n' : ''}${notes.join('\n')}`;
    }

    // ── SAVE / LOAD (kickoff §3.4) ───────────────────────────────────
    mountTapeIO(tape, label);

    /**
     * The overlays' readout, for `check-seedling-editor-overlays.mjs` — the
     * same contract `window.__editorSolve` is for slice 1's row. It carries
     * the DERIVED facts (every marker, every unplaced row, the per-channel
     * body counts), not a picture: the acceptance rows are ledger facts and
     * a screenshot is evidence, never the gate.
     */
    window.__editorOverlays = {
        label,
        frames: frames.length,
        layers: OVERLAY_LAYERS.map((l) => ({ id: l.id, on: on.has(l.id) })),
        unknownLayerParams: layerParam.unknown,
        /**
         * ⛓⛓⛓ GROUP B — THE SWING, AS A READOUT, so a check can assert the
         * distinction the ink is making rather than only look at it.
         *
         * `hold` is the DISPLAY CHOICE in force; `window` is the ENGINE's own
         * answer, and the two are named apart here for the same reason they are
         * drawn apart. ⚠ `spearHitTicksUnmodelled` is carried BY NAME because
         * it is a bound on the model that the picture cannot show: a spear
         * draws one rect where the game tests three times, and an absence with
         * no written cause reads as a room where nothing happened.
         */
        attackSwing: {
            hold: attackHoldNow(),
            holdDefault: ATTACK_HOLD_DEFAULT,
            swordHitTicks: SLASH_HIT_TICKS,
            note: SWING_WINDOW_NOTE,
        },
        /**
         * ⛓⛓⛓ GROUP B — THE CEREMONY AT THE SCRUB TICK. A GETTER, not a value
         * captured when the readout was built: the box is re-rendered on every
         * `hud()` and a snapshot taken at mount would report tick 0's ceremony
         * (i.e. none) for the whole session, which is the leak-witness shape —
         * evidence that lands one tick late reads as evidence of nothing.
         */
        get dialogue() {
            return {
                ceremony: dialogue.ceremony,
                visible: dialogue.visible,
                why: dialogue.why,
                shown: !$('dialogue').hidden,
                text: $('dialogue').textContent,
            };
        },
        markers,
        unplaced,
        unknownGlyphs: renderer.unknownGlyphs,
        channels: {
            enemies: channelSummary(samples, 'enemies'),
            pushables: channelSummary(samples, 'pushables'),
            arrows: channelSummary(samples, 'arrows'),
            // ⛓ SLICE 6: the shape layers' own emptiness readout. `bodies` is
            // the collider channel, and it is a DIFFERENT count from `enemies`
            // whenever a class reports a position but no census hitbox — which
            // is a fact worth being able to see.
            bodies: channelSummary(samples, 'bodies'),
            // ⛓ SLICE 8: the armed lanes over the whole walk. A trap that is
            // armed for three ticks and a trap that is never armed both draw
            // nothing at most cursor positions, and only this count tells
            // them apart across the tape.
            lanes: channelSummary(samples, 'lanes'),
            /**
             * ⛓ SLICE 9: every object the run changed anywhere on the walk.
             * A rock broken at tick 50 is invisible at every cursor before it
             * and unremarkable at every cursor after; only this count says the
             * walk changed anything at all. ⚠ `bodies` counts DISTINCT ids, so
             * an object changed for 300 ticks contributes ONE — which is the
             * number a reader wants here.
             */
            changes: channelSummary(samples, 'changes'),
        },
        /**
         * ⛓⛓⛓ SLICE 9 — THE POPULATION BEHIND AN EMPTY `worldstate` LAYER, at
         * the scrub tick. `drawn.worldstate.why` says WHICH nothing is on
         * screen; this is the count that claim rests on (trap 196: never read
         * an absence without its population count), and it is the census's
         * shape one layer over.
         */
        get changeCounts() {
            const s = samples[Math.min(Math.max(cursor, 0), samples.length - 1)];
            return s?.changeCounts ?? null;
        },
        /**
         * ⚖ ITEM 9 — WHETHER THERE IS A SOLVER TO SHOW AT ALL, as a fact
         * rather than as an inference from an empty layer. `null` here and
         * `[]` are the two different answers the layer's own first branch is
         * about; a row that could only see the drawn result could not tell
         * "REPLAY, so no bot" from "a bot that asked nothing".
         */
        dangerQueries: dangerQueries === null ? null : dangerQueries.length,
        /**
         * ⛓ SLICE 8 — THE CENSUS BEHIND AN EMPTY `hitboxes` LAYER, at the
         * scrub tick. `drawn.hitboxes.why` says WHICH nothing is on screen;
         * this is the population count that claim rests on, so a reader never
         * has to take the sentence's word for it (trap 196: never read an
         * absence without its population count).
         */
        get census() {
            const s = samples[Math.min(Math.max(cursor, 0), samples.length - 1)];
            return s?.census ?? null;
        },
        /**
         * ⛓⛓⛓ SLICE 6 — WHAT THE RENDERER DREW ON THE CURRENT FRAME, read
         * back off the renderer itself rather than recomputed here. A check
         * that recomputed it would be checking a derivation nothing on screen
         * used, which is `collectRun`'s own reason for living in
         * `watchOverlays` and slice 5's lesson stated one layer up.
         *
         * ⛔⛔ A GETTER, AND THE FIRST CUT WAS NOT — this slice's own defect,
         * found by its browser row. `drawn: renderer.drawn` EVALUATES the
         * renderer's getter once, at readout-assembly time, and freezes that
         * frame for ever. Every `?tick=N` row still passed, because `seek()`
         * runs before this object is built; the row that SCRUBBED got tick
         * zero's boxes and read them as tick 120's, so a layer that tracks
         * perfectly reported a body that never moved. A snapshot wearing a
         * live readout's name is the same shape as slice 5's two findings —
         * state that looks like it is being read and is not.
         */
        get drawn() { return renderer.drawn; },
        /** The whole press ledger, so a row can ask "and at a NON-press tick?" */
        presses: presses.map((p) => ({ t: p.t, fired: p.fired, level: p.level, rect: p.rect })),
        trace: pane.readout,
    };

    /**
     * ── ⛓⛓⛓ `?shot=1` — THE CLI'S CONTRACT (kickoff §3.4/§3.5) ─────────
     *
     * The readiness signal slice 4's exporter waits on. Three parts, and
     * each one is load-bearing for a headless screenshot:
     *
     *  1. NOTHING IS ANIMATING. `playing` is already false above, so the
     *     canvas holds the requested tick indefinitely. A shutter opened on
     *     a playing page photographs whenever it happened to open.
     *  2. THE FRAME IS DRAWN BEFORE THE FLAG IS SET. `seek()` ran the full
     *     draw path (`hud()` → `renderer.draw`) synchronously above, so a
     *     waiter that sees the flag is looking at a painted canvas — not at
     *     one scheduled to paint on the next rAF.
     *  3. IT IS BOTH A DOM ATTRIBUTE AND A JS OBJECT. Playwright's
     *     `waitForSelector('body[data-shot-ready="1"]')` needs no page
     *     evaluation and no injected script; `window.__editorShot` carries
     *     the facts a caller should assert AFTER the wait — which tick was
     *     actually drawn, how many frames existed, and any reason the
     *     request could not be honoured exactly.
     *
     * ⚠ IT IS SET WHETHER OR NOT `?shot=1` WAS ASKED FOR — the flag on the
     * body is not. A readout that only existed under the parameter would
     * make the parameter untestable from the other side.
     */
    window.__editorShot = {
        ready: true,
        requested: params.shot,
        tick: cursor,
        frames: frames.length,
        label,
        why: [params.tickWhy, landed.why].filter(Boolean).join('  ·  ') || null,
    };
    if (params.shot) document.body.dataset.shotReady = '1';
    return { frames, finished };
}

/**
 * ── SAVE / LOAD — the tape in your hands (kickoff §3.4, ⚖ §1.3) ─────────
 *
 * Save is the CURRENT tape — replayed, solved or manually recorded, all
 * three arrive here as an object — serialised into the textarea, with a
 * Download button writing the same bytes. Load is the reverse: paste into
 * the box, or Upload a file, and the page navigates to it.
 *
 * ⛔ THROUGH `parseTape`, VIA `parseTapeText`. A malformed tape refuses with
 * the PARSER'S own message — the same one the runner and the differential
 * would give it — rather than a second, laxer opinion held by a page.
 *
 * ⛔⛔ AND THE PAGE NEVER WRITES `fixtures/`. The roster is disk-derived
 * (`fixtures/index.js`), so a saved experiment would silently enter the
 * differential's roster. A download goes to the browser's download
 * directory; promotion to a fixture stays a deliberate act outside this arc.
 *
 * ⚠ A LOADED TAPE IS HELD IN MEMORY AND REPLAYED IN PLACE — it is NOT put in
 * the URL. A tape is kilobytes; `?tape=` names a path the server can serve
 * and a pasted experiment has no path. So the picker's navigate-to-load
 * remains the route for committed tapes and this is the route for the ones
 * that exist only here.
 */
function mountTapeIO(tape, label) {
    const box = $('tapeText');
    if (!box) return;
    box.value = serializeTapeText(tape);
    $('tapeName').textContent = label;
    $('tapeNote').textContent = '';

    $('tapeDownload').onclick = () => {
        const name = (tape?.name || 'tape').replace(/[^A-Za-z0-9._-]+/g, '-');
        const url = URL.createObjectURL(
            new Blob([box.value], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadText = async (text, from) => {
        const got = parseTapeText(text);
        if (got.error) {
            $('tapeNote').textContent = `⚠ ${from} REFUSED (${got.error}) — ${got.why}`;
            return;
        }
        // ⛓ The SAME replay path everything else uses. A pasted tape that
        // was drawn by some second, simpler renderer would be a picture of a
        // run nobody had replayed.
        //
        // ⚠ THE NOTE IS WRITTEN *AFTER* THE REPLAY, and the ordering is a
        // bug this row caught: the replay re-mounts this whole panel (it is
        // showing a different tape now, so it must), which clears the note —
        // so a note written first was wiped by the very load it announced.
        // The page said nothing about a load that had plainly happened.
        await replayLoadedTape(got.tape, `${from}: ${got.parsed.name}`);
        $('tapeNote').textContent = `loaded from ${from}: ${got.parsed.name} — `
            + `${got.parsed.tick_count} ticks, v${got.parsed.tape_version}`;
        window.__editorLoaded = { from, name: got.parsed.name, ticks: got.parsed.tick_count };
    };

    $('tapeLoad').onclick = () => loadText(box.value, 'paste');
    $('tapeUpload').onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        box.value = text;
        loadText(text, `upload ${file.name}`);
    };
}

/**
 * ── THE TRACE PANE (kickoff §3.3) ────────────────────────────────────────
 *
 * `source` is `{trace}` for a trace this page already holds (an in-page
 * SOLVE's `out.trace`) or `{why}` for one it could not get — and BOTH are
 * rendered. A tape with no sidecar says so BY NAME, with the path it looked
 * for: "no trace" and "a trace this page failed to fetch" are different
 * facts and an empty pane would state neither.
 *
 * Rows at or before the cursor are highlighted (a trace is SPARSE, so the
 * last such row is the decision in force right now); clicking one seeks to
 * its tick.
 */
function mountTracePane(source, seekTo) {
    const box = $('trace');
    const rows = source?.trace?.rows ?? [];
    if (!rows.length) {
        const why = source?.why
            ?? (source?.trace ? 'the trace has no rows' : 'no trace was offered');
        box.innerHTML = '';
        const el = document.createElement('div');
        el.className = 'traceNone';
        el.textContent = `no trace for this tape — ${why}`;
        box.appendChild(el);
        return { highlight() {}, readout: { rows: 0, why } };
    }

    box.innerHTML = '';
    const els = rows.map((row) => {
        const f = traceRowFields(row);
        const el = document.createElement('div');
        el.className = 'tr';
        el.title = f.line;      // the CLI's own line — one summary, two views
        el.innerHTML = `<b>t${f.tick}</b> <span class="g">${f.goal}</span>`
            + ` <span class="o">${f.obstacle}</span> → <span class="s">${f.strategy}</span>`
            + (f.rejected.length
                ? `<div class="rj">rejected: ${f.rejected.join('; ')}</div>`
                : '<div class="rj none">rejected: (nothing else considered)</div>');
        el.onclick = () => seekTo(row.tick);
        box.appendChild(el);
        return { el, tick: row.tick };
    });

    let lastActive = -2;
    return {
        highlight(cursor) {
            const active = activeTraceIndex(rows, cursor);
            if (active === lastActive) return;
            lastActive = active;
            els.forEach((r, i) => {
                r.el.classList.toggle('past', i <= active);
                r.el.classList.toggle('now', i === active);
            });
            /**
             * ⛔ THE PANE SCROLLS, NOT THE PAGE (group A, item 8).
             *
             * `scrollIntoView` scrolls EVERY scrollable ancestor, and the
             * document is one of them — so following a solve's trace dragged
             * the whole page up and down under the reader once per highlighted
             * row, which is the "why does it keep jumping" complaint. Moving
             * the pane's own `scrollTop` by the overshoot keeps the active row
             * visible and leaves the document exactly where it was put.
             */
            if (active >= 0) {
                const r = els[active].el.getBoundingClientRect();
                const b = box.getBoundingClientRect();
                if (r.top < b.top) box.scrollTop -= (b.top - r.top);
                else if (r.bottom > b.bottom) box.scrollTop += (r.bottom - b.bottom);
            }
        },
        readout: { rows: rows.length, why: null, firstTick: rows[0].tick },
    };
}

// ── SOURCE = SOLVE ───────────────────────────────────────────────────────

/**
 * ⛓⛓⛓ THE DEFAULT STAGING BLOCK IS **THE TRUE GAME START** (slice 5,
 * kickoff §12.3) — and it is FETCHED, never typed.
 *
 * ── what it replaced, and why that was worse than it looked ───────────
 *
 * It used to be a frozen literal: `{level: 0, x: 16, y: 16}`, everything
 * else empty, described here as "deliberately the EMPTIEST honest one". It
 * was honest — nothing was pre-cleared — and it was still a boot state THE
 * GAME NEVER HAS. `(16,16)` is the atlas's convention for "just inside the
 * top-left door" and L0's real spawn is `(80,128)`; `pins` was `[]` where
 * every honest walk in the tree pins `dead_frames`; `rng` was `null` where
 * the game boots with a live `fp` seed. Arriving at the page with nothing
 * typed put you in a room the player cannot be standing in, and the first
 * thing anybody does with an editor is press the button before typing.
 *
 * ⛔ SO IT IS THE HONEST CHAIN'S OWN SEGMENT-1 BOOT, THROUGH THE SAME SEAM
 * A PASTED BLOCK TAKES. `act2-the-sword` is R7's honest playthrough and its
 * first segment starts where a new game does; its committed tape is the
 * artifact the game and the differential already agreed on. The page fetches
 * that tape and runs it through `stagingFromJson` — the `?boot=` path,
 * unchanged — so the default validates through `parseTape` exactly as any
 * pasted block does. ⚠ A literal transcription of the same numbers would be
 * the same eleven fields typed a second time, and the copy would be right
 * until the chain moved (trap 86: one definition, owned, never retyped).
 *
 * ⚠ AND A FETCH CAN FAIL. `?boot=`'s failure is already REPORTED rather than
 * swallowed and this one is too — there is no literal to silently fall back
 * to, which is the point: a page that quietly reverted to a made-up boot
 * would present the fallback as the game's start.
 */
const trueStartStaging = async () =>
    stagingFromJson(await fetchJson(`/${DEFAULT_TAPE_DIR}/${TRUE_START_SEGMENT}.json`,
        `the true game start (${TRUE_START_SEGMENT})`));

/**
 * "Boot like `r8-solve-18`" — the staging-is-declared law in UI clothes.
 *
 * The preset is not a hand-typed approximation of a room's starting state,
 * it is the exact block the game and the differential already agreed on.
 *
 * ⛓ ONE DROPDOWN, TWO ARMS (slice 3). SOLVE and MANUAL both need "start me
 * where that tape started", and a second harvest for the manual panel would
 * be a second answer to which tapes can be booted from.
 *
 * Fired but NOT awaited: with `?boot=` given, an arm should not wait on a
 * roster fetch it is not going to use.
 *
 * `source` rides in the navigation so choosing a preset from the MANUAL
 * panel lands back in MANUAL rather than silently switching arms.
 */
/**
 * ⛓⛓ A COMMITTED BOOT PER LEVEL, harvested from the same roster the preset
 * dropdown lists (group A, item 10).
 *
 * The level stepper needs somewhere to PUT the player. `boot.x/y` belong to
 * the level the block came from, so stepping to another one and keeping them
 * usually spawns you inside a wall — the `?level=` override note has said
 * exactly this since the editor arc. A tape that starts in the target level
 * already knows a position the game itself used.
 *
 * ⚠ FIRST WINS, and the roster order is the directory listing's, so this is
 * "a committed boot" and never "the canonical one" — the map is only ever
 * consulted for a starting position, never for a claim.
 * ⚠ EMPTY UNTIL THE ROSTER LOADS, which is a real state the stepper reports
 * rather than waits on: 150 tapes should not block the first press.
 */
const committedBootByLevel = new Map();

/**
 * ⛓ THE ROSTER LOAD, AS A PROMISE THE STEPPER CAN AWAIT — resolved once per
 * document, because `loadAtlas`'s reason applies here too.
 *
 * ⚠ MEASURED BY THE BROWSER ROW: it pressed ▶ within milliseconds of mount,
 * the map was still empty, and the level stepped with the PREVIOUS level's
 * boot position and a note saying so. Honest, and the worse of the two
 * outcomes for anybody who clicks fast. Awaiting the fetch that is already in
 * flight costs a human nothing (they click seconds later) and gets the row —
 * and a fast hand — the committed boot instead of the caveat.
 */
let bootRosterReady = null;

function mountBootPresets(sel, source, noteEl = null) {
    bootRosterReady = loadTapeIndex(DEFAULT_TAPE_DIR).then((index) => {
        if (index.error) {
            sel.innerHTML = `<option value="">— no preset list: ${index.error} —</option>`;
            return;
        }
        const { presets, refused } = harvestPresets(index.records);
        for (const p of presets) {
            const lvl = p.staging.boot.level;
            if (!committedBootByLevel.has(lvl)) {
                committedBootByLevel.set(lvl, { name: p.name, boot: p.staging.boot });
            }
        }
        sel.innerHTML = '<option value="">— boot like… —</option>';
        for (const p of presets) {
            const el = document.createElement('option');
            el.value = p.name;
            el.textContent = `${p.name} — L${p.staging.boot.level}`;
            sel.appendChild(el);
        }
        // ⚠ A tape that would not parse is NAMED. A preset list that
        // silently shrank would read as a smaller roster.
        if (refused.length && noteEl) {
            noteEl.textContent += `${noteEl.textContent ? '  ·  ' : ''}`
                + `⚠ ${refused.length} tape(s) refused as presets: `
                + refused.map((r) => `${r.name} (${r.why})`).join('; ');
        }
        sel.onchange = () => {
            const chosen = presets.find((p) => p.name === sel.value);
            if (!chosen) return;
            // A full navigation, like the tape picker's — one code path for
            // "load something else", and the URL stays the whole state.
            const q = new URLSearchParams(window.location.search);
            q.set('source', source);
            q.set('boot', `${DEFAULT_TAPE_DIR}/${chosen.name}.json`);
            q.set('level', String(chosen.staging.boot.level));
            q.delete('goals');
            q.delete('solve');
            window.location.search = q.toString();
        };
    });
}

/**
 * ⛓⛓⛓ THE BOOT FORM (slice 5, kickoff §12.4) — checkboxes over the SAME
 * PARSED BLOCK the textarea holds, in BOTH directions.
 *
 * ⛔ ONE SOURCE OF TRUTH, AND IT IS THE TEXTAREA'S PARSE. Ticking a box
 * parses the box's text, edits the resulting BLOCK (`withItemFlag`) and
 * re-serialises the whole thing back; typing in the textarea re-derives the
 * boxes from whatever it now parses. Nothing is cached between the two, so
 * there is no state that can disagree with what is on screen — a form
 * holding its own copy of the flags is the two-cost-models trap with
 * checkboxes, and the copy would win silently whenever the user typed.
 *
 * ⛔⛔ A TEXTAREA THAT WILL NOT PARSE **DISABLES** THE BOXES, with the
 * parser's own message. The alternative is guessing: a form that kept the
 * last good flags would let you tick a box against a block that does not
 * exist and then write it into text you never meant to keep. Refusing to
 * offer the control is the honest answer, and the reason is on screen.
 *
 * ⚠ THE THIRD STATE IS RENDERED AS `indeterminate`. `itemFlagsOf` returns
 * `null` for a flag the block declares NOTHING about (the seam keeps only
 * declared keys), and a dash-filled box says that where an unticked one
 * would say "declared false". Clicking one writes a real `false`, which is
 * a declaration — as it should be, because that is what the user just did.
 *
 * @param {object} lifetime the mounting arm's lifetime — the box listener
 *   below dies with it (see `watchLifetime`).
 * @param {Function} onChange fired after a box writes, so the arm can
 *   re-derive anything downstream (the SOLVE arm re-reads its census).
 */
function mountBootForm(formEl, boxEl, noteEl, lifetime, onChange = () => {}) {
    /**
     * ⛔ MOUNTED TWICE IS NOW NORMAL, so the previous mount's controls are
     * REMOVED rather than appended beside. Every other `mount*` in this file
     * already clears its box (`layerBox.innerHTML = ''` and friends); this one
     * appended into a `<div>` that also holds a static label from `watch.html`,
     * so it could not simply be emptied — and an in-place switch back to an
     * arm would have given it a second row of sword checkboxes, each writing
     * the same field, the older one holding a `boxEl` nobody reads any more.
     */
    formEl.querySelector('[data-boot-form]')?.remove();
    const fields = document.createElement('span');
    fields.dataset.bootForm = '1';
    formEl.appendChild(fields);

    const boxes = ITEM_FORM_FIELDS.map((f) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `${formEl.id}-${f.id}`;
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${f.label}`));
        // The GAME's own property path, so the control says which field it
        // writes rather than only what it is called.
        label.title = `${f.field}  (writes seam.${f.key})`;
        fields.appendChild(label);
        return { f, input };
    });
    const why = document.createElement('span');
    fields.appendChild(why);

    const sync = () => {
        let staging = null;
        let refusal = null;
        try {
            staging = stagingFromJson(JSON.parse(boxEl.value));
        } catch (e) {
            refusal = e.message;
        }
        const flags = staging ? itemFlagsOf(staging) : null;
        for (const { f, input } of boxes) {
            input.disabled = !staging;
            input.indeterminate = Boolean(staging) && flags[f.id] === null;
            input.checked = flags?.[f.id] === true;
        }
        why.textContent = refusal
            ? `  ⚠ the block below will not parse, so these are disabled — ${refusal}`
            : '';
        return staging;
    };

    for (const { f, input } of boxes) {
        input.onchange = () => {
            let parsed;
            try {
                parsed = stagingFromJson(JSON.parse(boxEl.value));
            } catch {
                // Unreachable while the box is enabled — but re-syncing is
                // the honest answer if it ever is, rather than writing into
                // text the parser has already refused.
                sync();
                return;
            }
            boxEl.value = JSON.stringify(withItemFlag(parsed, f.id, input.checked), null, 4);
            sync();
            onChange();
        };
    }
    /**
     * A block edited by hand re-derives the boxes — the other direction.
     *
     * ⛔ THROUGH THE ARM'S LIFETIME, and this one ACCUMULATES rather than
     * leaking quietly: `input` listeners stack, so an arm mounted twice in
     * one document would re-derive the checkboxes twice per keystroke, three
     * times on the third mount. Nothing visibly breaks — it just does the
     * work N times — which is why it would have survived a switch nobody
     * profiled.
     */
    lifetime.on(boxEl, 'input', () => sync());
    sync();
    if (noteEl && !noteEl.textContent) noteEl.textContent = '';
    return { sync };
}

/**
 * ── ⛓⛓ WHERE TO PUT THE PLAYER IN A LEVEL NOBODY HAS A TAPE FOR ──────
 *
 * ⚠ MEASURED FIRST: 42 of the atlas's 116 levels have a committed boot in the
 * tape roster. So two thirds of the level stepper's destinations have no
 * position the game itself ever used, and carrying the previous level's `x/y`
 * into them drops the player inside a wall about as often as not — which
 * makes MANUAL unusable for exactly the rooms you most want to look at.
 *
 * ⛔ SO THE PAGE CHOOSES ONE, AND SAYS THAT IT CHOSE. The nearest WALKABLE,
 * NON-PIT tile to where the player already was, rejecting any cell where the
 * engine's own `playerBoxAt` would overlap a solid. That is a tooling
 * convenience and NOT a fact about the game: no claim may rest on it, and the
 * note in the panel calls it a choice rather than a boot.
 *
 * ⚠ `walkableTiles` and the solid rosters are the ENGINE's own, through
 * `censusWorld` — the same world build the arms press into. A spawn picked
 * from a second idea of "walkable" would put the player somewhere this page
 * thinks is fine and the physics does not.
 */
function chooseSpawn(levelSource, block, level) {
    const world = censusWorld(levelSource, { ...block, boot: { ...block.boot, level } });
    const blockers = [...(world.solids ?? []), ...(world.objectSolids ?? [])].map((s) => s.rect);
    const pits = new Set((world.pitTiles ?? []).map((t) => `${t.rect.x},${t.rect.y}`));
    const hits = (r) => blockers.some((s) =>
        r.x < s.right && r.right > s.x && r.y < s.bottom && r.bottom > s.y);
    let best = null;
    let bestD = Infinity;
    for (const t of world.walkableTiles ?? []) {
        if (pits.has(`${t.rect.x},${t.rect.y}`)) continue;
        const x = t.rect.x + TILE_SIZE / 2;
        const y = t.rect.y + TILE_SIZE / 2;
        if (hits(playerBoxAt(x, y))) continue;
        // ⚠ THE DISTANCE IS MEASURED IN THE SAME SPACE THE ANSWER IS GIVEN IN.
        // `block.boot` is ctor args and `(x, y)` is a tile centre, so the old
        // comparison carried a half-tile bias in both axes — harmless at this
        // resolution, and exactly the kind of mixed-space arithmetic that
        // produced the bug below. Both sides are corners now.
        const cx = x - BOOT_TO_PLAYER_OFFSET;
        const cy = y - BOOT_TO_PLAYER_OFFSET;
        const d = ((cx - block.boot.x) ** 2) + ((cy - block.boot.y) ** 2);
        /**
         * ⛔⛔⛔ THE TILE'S CORNER, NOT ITS CENTRE — AND THIS WAS A REAL
         * DEFECT, MEASURED.
         *
         * A staging block's `boot.x`/`boot.y` are the `Game` CONSTRUCTOR'S
         * ARGS (`playerx`/`playery`), and the Player ctor re-centres onto the
         * tile (`Player.as:357`) — so the player is observed at `boot + 8`.
         * This loop validates a tile CENTRE (`playerBoxAt(cx, cy)` clears the
         * solids) and used to write that centre straight into `boot`, which
         * the engine then offset again: the player landed half a tile DOWN AND
         * RIGHT of the cell that had been checked.
         *
         * ⛓ MEASURED over a twelve-level sample while the entrances item was
         * being built: **five of the twelve spawned INSIDE A SOLID** — L58,
         * L84, L70, L90 and L110 — which is the precise failure this function
         * exists to prevent. The cell is right; the field it was written into
         * was wrong.
         *
         * ⇒ the corner, which is `centre - BOOT_TO_PLAYER_OFFSET` and is also
         * exactly the form a teleporter's own `playerx`/`playery` take. *A
         * validated coordinate written into a field somebody else offsets has
         * not been validated.*
         */
        if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
    return best;
}

/**
 * ── ⛓⛓⛓ DRAW THE LEVEL NOW, BEFORE ANYTHING RUNS (group A, item 9) ────
 *
 * SOLVE drew nothing until you pressed SOLVE (or passed `?solve=1`) and
 * MANUAL drew nothing until you pressed START, so both arms opened on a black
 * canvas: the page had the level in its hands and was showing you nothing.
 * This builds the run the arm is ABOUT to use and draws its first frame.
 *
 * ⛔ IT IS NOT A SECOND CONSTRUCTION. `createRunForStaging(solveStaging(…))`
 * is the same pair `solveForPage` and `createManualSession` use, so the room
 * you are looking at before you press anything is the room the press will run
 * in — a preview built some other way could differ from it in exactly the
 * ways that matter (a `solveStaging` relaxation, a scratch clear).
 *
 * ⛔ AND IT IS NOT A LOOP. One `draw`, no rAF, nothing scheduled — the page's
 * third law is about tick loops, and a still frame has no tick to advance.
 * Anything that starts afterwards (a solve's scrub, a manual drive) builds its
 * own renderer and supersedes this frame in the ordinary way.
 *
 * ⚠ A REFUSAL IS REPORTED AND NOT FATAL TO THE MOUNT. A block that will not
 * build is worth saying — with the builder's own message — but the arm must
 * still finish mounting, or a bad `?level=` would leave you with no panel to
 * fix it in.
 */
function previewLevel(levelSource, staging, layers, lifetime) {
    try {
        const run = createRunForStaging(solveStaging(staging), levelSource,
            { scratchPersistence: isHeldLevel(staging.boot.level) });
        const world = makeWorldFor(levelSource, staging)(run.level);
        const renderer = makeRenderer($('canvas'));
        renderer.reset();
        renderer.fit(world);
        renderer.draw(world, run.state, {
            on: layers.on,
            // The still frame has no history and no run behind it: every
            // channel that would describe one is EMPTY rather than absent, so
            // the layers draw nothing instead of drawing something stale.
            samples: [],
            markers: [],
            presses: [],
            // ⛓ GROUP B: passed even though `presses` is empty, so the still
            // frame's emptiness is the CHANNEL's and not a missing option —
            // an omitted key here would fall through to `attackHoldsAt`'s own
            // default and make this site behave differently from the other two
            // for a reason nothing on the page states.
            attackHold: attackHoldNow(),
            cursor: 0,
            live: { crushers: run.crushers, crusherScans: run.crusherScans },
            // ⚖ Nothing has solved this room yet, and `null` is how the layer
            // is told to SAY so rather than drawing a calm room.
            dangerQueries: null,
        });
        /**
         * ⛓⛓⛓ WHERE THE PLAYER ACTUALLY IS IN THE DRAWN ROOM, AND WHETHER
         * THEY FIT — ⚖ the entrances item's own witness.
         *
         * ⛔ IT IS THE RUN'S STATE, NOT THE BLOCK'S NUMBERS. `run.state` is
         * what `createRunForStaging` produced from the boot block, so it has
         * ALREADY had the Player ctor's half tile applied — which is the whole
         * quantity the item turned on. A readout that re-derived the position
         * from `boot.x + 8` would be a second spelling of the very offset it
         * exists to check, and would agree with a wrong boot block perfectly.
         *
         * ⛔⛔ AND `clear` IS ASKED OF THE DRAWN WORLD'S OWN SOLIDS with the
         * ENGINE's `playerBoxAt`. `chooseSpawn` used to validate a tile centre
         * and write it into a field the engine offsets, so the cell it checked
         * and the cell the player stood in were different cells — measured, 5
         * of a 12-level sample spawned inside a solid. This is the reading
         * that fails when that is true, and it is taken from the picture the
         * page is showing rather than from the function under suspicion.
         */
        const box = playerBoxAt(run.state.x, run.state.y);
        const blockers = [...(world.solids ?? []), ...(world.objectSolids ?? [])];
        const inside = blockers.find((s) => box.x < s.rect.right && box.right > s.rect.x
            && box.y < s.rect.bottom && box.bottom > s.rect.y);
        window.__editorSpawn = {
            level: run.level,
            boot: { x: staging.boot.x, y: staging.boot.y },
            player: { x: run.state.x, y: run.state.y },
            offset: BOOT_TO_PLAYER_OFFSET,
            clear: !inside,
            // ⚠ THE BLOCKER IS NAMED. "The player is inside something" and
            // "the player is inside `tile:Stone` at 96,64" are the same
            // verdict and very different findings.
            inside: inside ? { tag: inside.tag ?? null, rect: inside.rect } : null,
            solids: blockers.length,
        };
        return { drew: true, level: run.level, why: null };
    } catch (e) {
        // ⚠ A REFUSED PREVIEW HAS NO SPAWN TO REPORT, and `null` says so
        // rather than leaving the LAST level's answer standing — a stale
        // `clear: true` under a room that would not build is the readout
        // lying about the room on screen.
        window.__editorSpawn = null;
        lifetime.report(`the level preview refused: ${e.message}`, () => {
            $('detail').textContent = `⚠ this block will not build, so nothing is drawn yet — `
                + `${e.message}`;
        });
        return { drew: false, level: staging?.boot?.level ?? null, why: e.message };
    }
}

/**
 * ⛓ THE ATLAS, ONCE PER DOCUMENT. Every arm needs it and every arm fetched
 * its own copy — which cost nothing when an arm mount meant a page load, and
 * costs a re-fetch per SOURCE switch now that it does not.
 *
 * ⚠ A REJECTION IS NOT CACHED. Memoising the promise itself would pin a
 * transient failure (a server restart mid-switch) for the life of the tab,
 * and the arm would report "the atlas is missing" forever with no way back
 * short of a reload — the one thing this arc removed.
 */
let atlasPromise = null;
function loadAtlas() {
    if (!atlasPromise) {
        atlasPromise = fetchJson(ATLAS_URL, 'atlas')
            .catch((e) => { atlasPromise = null; throw e; });
    }
    return atlasPromise;
}

/**
 * ── ⛓⛓⛓ THE LEVEL THE GENERATE ARM HANDED OVER (switch slice 4) ───────
 *
 * ⛔ IT IS A LEVEL, NOT A FILE AND NOT A SEED. The GENERATE arm holds the
 * record it just generated; the bridge hands that RECORD to SOLVE or MANUAL
 * directly, in memory. Regenerating from `?seed=` would be a second path to
 * a level and a second chance to disagree — the page's standing rule is that
 * every level it draws came out of the loop, IN THE PAGE, once.
 *
 * ⚠ IT SURVIVES A SWITCH AND NOT A RELOAD, which is the honest boundary: a
 * generated room is not in the atlas and not on disk, so a link to it could
 * only ever be a link to the GENERATION (`?source=generate&seed=…`), and that
 * is what the address bar keeps saying. The arms SAY they are holding one.
 */
let heldGeneratedLevel = null;

/**
 * A source that answers for the held generated level and defers to the atlas
 * for everything else.
 *
 * ⛔ BOTH HALVES ARE NEEDED, and the composite is not decoration: the
 * generated room is the only level the arm is looking at, but the TAPE I/O
 * box, a pasted tape and any teleporter whose `to` names a real room all ask
 * this same source for committed levels. A source that held only the
 * generated record would refuse them by name — see `runGenerate`'s own note,
 * which fetches the real atlas for exactly this reason.
 */
function levelSourceWithHeld(atlasSource, held) {
    if (!held) return atlasSource;
    return (level) => (level === held.record.level ? held.record : atlasSource(level));
}

/**
 * ⛔⛔ THE SCRATCH FORK IS ABOUT **THIS RUN'S LEVEL**, not about whether the
 * page happens to be holding a generated one.
 *
 * The first cut keyed it on `Boolean(heldGeneratedLevel)`, which is wrong in a
 * way that only shows on the paths nobody looks at twice: hand a generated
 * room to SOLVE, then paste a COMMITTED tape into the box below the canvas,
 * and that tape — which has a v9 `at` row declaring its own kill-lock clear —
 * would replay with the model as a second writer of the slot its tape already
 * owns. The flag is vacuous exactly where no tape exists and correct
 * everywhere else, so it asks about the LEVEL.
 */
const isHeldLevel = (level) =>
    Boolean(heldGeneratedLevel) && level === heldGeneratedLevel.record.level;

/**
 * ⛓ WHAT EVERY ARM DOES FIRST, and did in four copies: get the atlas, build
 * a level source over it, and point the page's "replay a tape I am holding"
 * hook at it. The copies were identical, which is how they stayed correct —
 * and is exactly why the fifth one would not have been.
 */
async function armPrelude(params, lifetime) {
    const atlas = await loadAtlas();
    const levelSource = levelSourceWithHeld(levelSourceFromAtlas(atlas), heldGeneratedLevel);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, levelSource, null,
        undefined, { scratchPersistence: isHeldLevel(t?.boot?.level) })
        .catch((e) => lifetime.report(`a loaded tape would not replay: ${e.message}`,
            () => fatal('the loaded tape would not replay', e.stack || e.message)));
    return { atlas, levelSource };
}

/**
 * ── ⛓⛓⛓ THE BOOT PANEL, SHARED BY SOLVE AND MANUAL (switch slice 3) ───
 *
 * Both arms start from a staging block and both built the same panel around
 * it: level readout, preset picker, item form, textarea, note. Two copies of
 * a panel drift — MANUAL's level input was `disabled` and SOLVE's was not —
 * and, more to the point, ⛔ TWO BOXES CANNOT SHARE A BLOCK. The ask this arc
 * came from is that the level you are looking at follows you between modes,
 * and no amount of copying between two textareas is as honest as having one.
 *
 * ⚠ `#bootLevel` IS A READOUT AND NOW SAYS SO. It was written by both arms
 * and read by neither: in SOLVE you could type a level into it and nothing
 * whatsoever consumed the number (MANUAL marked the same field `disabled`,
 * which is the same fact with better manners). The level lives INSIDE the
 * block — ⛔ one source of truth, and it is the textarea's parse — so the
 * field is `readonly` rather than made into a second writer of it.
 */
async function mountBootPanel(params, lifetime, {
    verb, namePrefix, levelSource, layers, atlas, onBoxChange = () => {},
} = {}) {
    let { staging, origin, kept } = await stagingForMount($('bootBox'), params);
    if (!lifetime.alive()) return { staging: null, name: null };

    // ⚠ ?level= OVERRIDES the block's own level and SAYS SO. The boot x/y
    // belong to the block's level, so pointing it at another one usually
    // spawns the player somewhere meaningless — a fact worth a line in the
    // note rather than a mysterious refusal from the solver.
    const notes = [];
    if (params.level !== null && Number.isFinite(params.level)) {
        if (params.level !== staging.boot.level) {
            notes.push(`?level=${params.level} overrode the staging block's own level `
                + `${staging.boot.level} — the boot x/y (${staging.boot.x},${staging.boot.y}) `
                + `are still level ${staging.boot.level}'s`);
        }
        staging = { ...staging, boot: { ...staging.boot, level: params.level } };
    }
    /**
     * ⛔ PROVENANCE, IN THE ORDER THAT MATTERS. A handed-over generated level
     * is ALSO "a block the box was already holding", so the kept note is true
     * of it — and it is the wrong sentence, because it says the block is your
     * edits when it is the generator's output. The stronger fact wins and
     * says everything the weaker one would have.
     */
    if (isHeldLevel(staging.boot.level)) {
        const h = heldGeneratedLevel;
        notes.push(`⛓⛓ LEVEL ${h.record.level} WAS GENERATED IN THIS PAGE — seed ${h.seed}, `
            + `${h.biome}, step ${h.step} — and handed over by the GENERATE arm. It is not `
            + 'in the atlas and not on disk: THIS TAB holds it, a reload loses it, and the '
            + 'link above describes the GENERATION and not the room. The run uses the '
            + 'SCRATCH PERSISTENCE fork, because a generated room has no tape to declare a '
            + 'kill-lock clear (⚖ kickoff §1.13) — so a clear it banks leaves through '
            + '`run.scratchClears` and NOT through the folded tape, whose `persistence[].'
            + 'level` is bounded to the real game\'s 116 levels.');
    } else if (kept) {
        notes.push('⛓ the starting conditions below are THIS TAB\'S OWN, kept across a '
            + 'SOURCE switch — they are not what this URL names, so a copy of the link '
            + 'will not show them');
    }
    /**
     * ⚠ THE DEFAULT NAME STAYS PER-ARM. It is not decoration: it rides into
     * the tape a MANUAL session FOLDS, so unifying it here would quietly
     * rename every hand-driven tape from `manual-L0` to the solver's own
     * prefix — a shared panel must not relabel the artifacts its arms produce.
     */
    const name = params.name || `${namePrefix}-L${staging.boot.level}`;
    $('title').textContent = `${name} — ${verb} from ${origin}`;
    $('bootLevel').value = String(staging.boot.level);
    $('bootLevel').title = 'the level the block below boots into — a READOUT of '
        + '`boot.level`, which is where the level actually lives. Edit it in the block, '
        + 'or override it with ?level=.';
    $('bootBox').value = JSON.stringify(staging, null, 4);
    $('bootNote').textContent = notes.join('  ·  ');

    // ⛓ ONE ROSTER, ONE TABLE: the key legend is rendered FROM the binding
    // map, so a rebinding cannot leave the page describing the old keys.
    $('manualKeys').textContent = KEYBOARD_ROWS
        .map((r) => `${r.code.replace(/^(Key|Arrow)/, '')}→${r.key}`).join('  ');
    // ⚠ The preset navigation carries THIS arm's source, so choosing a preset
    // from MANUAL lands back in MANUAL. It still navigates — a preset is an
    // explicit "load something else", and the reload is what makes it beat
    // the kept block (`stagingForMount`).
    mountBootPresets($('bootPreset'), params.source, $('bootNote'));
    mountBootForm($('bootForm'), $('bootBox'), $('bootNote'), lifetime, onBoxChange);

    /**
     * ⛓ THE BLOCK IN THE BOX, RE-READ — never a closure copy. Editor slice 5's
     * whole finding was a form editing a block nobody read, and every control
     * added since answers to that: the box's parse is the one source of truth.
     */
    const blockNow = () => stagingFromJson(JSON.parse($('bootBox').value));

    // ⛓ THE LEVEL IS ON SCREEN BEFORE ANY BUTTON IS PRESSED (item 9). Both
    // arms that mount this panel get it, from the block the panel is showing.
    let preview = previewLevel(levelSource, staging, layers, lifetime);

    /**
     * ⚠ DEBOUNCED, AND GUARDED. Holding ▶ fires a change per click and each
     * one builds a world; the delay coalesces a run of them into one draw.
     * ⛔ Through `lifetime.guard`, because a pending timer that fires after
     * the arm is retired would paint this arm's level onto the next one's
     * canvas — the exact hazard the switch arc exists to close, re-introduced
     * by a convenience.
     */
    let pending = null;
    const redraw = lifetime.guard('boot-panel-redraw', () => {
        pending = null;
        try {
            preview = previewLevel(levelSource, blockNow(), layers, lifetime);
        } catch { /* the box will not parse; the form already says so */ }
        onBoxChange();
    });
    const scheduleRedraw = () => {
        if (pending !== null) clearTimeout(pending);
        pending = setTimeout(redraw, 120);
    };
    lifetime.onRetire(() => { if (pending !== null) clearTimeout(pending); });
    mountLayerControls(layers.on, redraw);

    /**
     * ⛓ THE ATLAS'S OWN LEVEL LIST — hoisted above the entrance index, which
     * scans it, and still the stepper's list. One enumeration of "the rooms
     * this atlas has"; two of them would drift the day the atlas grew a gap.
     */
    const atlasLevels = [...(atlas?.levels ?? []).map((l) => l.level)].sort((a, b) => a - b);

    /**
     * ── ⛓⛓⛓ WHERE THE PLAYER STARTS (⚖ the user's item) ────────────────
     *
     * ⛔ THE INDEX IS BUILT ONCE PER PANEL MOUNT, AND EAGERLY. An entrance to
     * L10 lives in L9 and L11, so answering "where do I start in L10" needs
     * every OTHER level scanned — a lazy per-level build would do the same
     * whole-atlas walk on the first press and again on every cache miss.
     * MEASURED at 93 ms for all 116 rooms with `roles: ['trigger']`, which is
     * what makes eager affordable and is why the cheap role set is not an
     * optimisation but the reason this control can exist at all.
     *
     * ⚠ REFUSALS ARE CARRIED, not swallowed: a room that will not build is one
     * whose exits are missing from this index, and `entrancesTo` folds that
     * into the sentence it gives for an empty answer.
     */
    const entranceIndex = collectEntrances(levelSource, atlasLevels);
    if (entranceIndex.refused.length > 0) {
        lifetime.report(`${entranceIndex.refused.length} level(s) would not build while `
            + 'indexing entrances', () => {});
    }

    /**
     * ⛔⛔ ONE WRITER FOR THE BOOT POSITION, AND IT IS THIS.
     *
     * Every control that can change where the player starts — the selector,
     * the two number fields, the level stepper — goes through here, so "what
     * is in the block" and "what the selector says" cannot drift apart. The
     * page has paid for the other shape once already (editor slice 5: a form
     * editing a block nobody read).
     *
     * @param {{x:number,y:number}} at the `Game` CONSTRUCTOR'S ARGS — not the
     *   player's position. See `watchEntrances`' docblock for the half tile.
     * @param {string} source the `#bootStart` value this came from
     */
    const writeStart = (at, source, extraNote = null) => {
        let block;
        try {
            block = blockNow();
        } catch (e) {
            $('bootNote').textContent = `the block will not parse — ${e.message}`;
            return;
        }
        block = { ...block, boot: { ...block.boot, x: at.x, y: at.y } };
        $('bootBox').value = JSON.stringify(block, null, 4);
        $('bootX').value = String(at.x);
        $('bootY').value = String(at.y);
        $('bootStart').value = source;
        const p = playerPointFor(at);
        // ⚠ BOTH NUMBERS, ALWAYS. The block holds ctor args and the HUD shows
        // the player's position, and they differ by the half tile — a readout
        // that printed one of them would make the other look like a bug.
        const note = `start ${at.x},${at.y} — the \`Game\` ctor's own args, so the player is `
            + `observed at (${p.x},${p.y})`;
        $('bootNote').textContent = extraNote ? `${extraNote}  ·  ${note}` : note;
        scheduleRedraw();
    };

    /**
     * ⛔ THE OPTIONS ARE THE LADDER, IN DESCENDING ORDER OF TRUST, and each one
     * carries its own sentence rather than a shared one.
     *
     * ⚠ `chooseSpawn` IS STILL OFFERED AND IS STILL LAST. It is the only
     * answer for the four rooms nothing leads into (58, 69, 81, 84 — measured)
     * and it is still *a convenience for looking around, not a position the
     * game ever used*. What changed is that it is no longer the DEFAULT for
     * the 74 levels that have no committed boot: 112 of 116 rooms now get the
     * game's own arrival point instead.
     */
    const startOptionsFor = (level) => {
        const opts = [];
        const committed = committedBootByLevel.get(level);
        if (committed) {
            opts.push({
                value: 'committed',
                label: `COMMITTED BOOT — ${committed.boot.x},${committed.boot.y} `
                    + `(from ${committed.name}, a position the game itself used)`,
                at: { x: committed.boot.x, y: committed.boot.y },
                note: `level ${level} — booting at (${committed.boot.x},${committed.boot.y}) `
                    + `from ${committed.name}'s own boot block, a position the game itself used`,
            });
        }
        const { entrances, why } = entrancesTo(entranceIndex, level);
        for (const e of entrances) {
            opts.push({
                value: `entrance:${e.id}`,
                label: `ENTRANCE — ${entranceLabel(e)}`,
                at: { x: e.x, y: e.y },
                note: `level ${level} — the ENTRANCE from L${e.from}`
                    + `${e.isStairs ? ' (stairs)' : ''}: where the game itself puts the player `
                    + 'when they walk in, from that teleporter\'s own `playerx`/`playery`'
                    + `${e.deactivated ? '. ⚠ THIS TELEPORTER IS DEACTIVATED on a fresh boot, '
                        + 'so the route in is shut even though the arrival point is real' : ''}`,
            });
        }
        return { opts, why };
    };

    /**
     * ── ⛓⛓⛓ THE LEVEL STEPPER (group A, items 7 and 10) ───────────────
     *
     * ⛔ IT WALKS THE ATLAS'S OWN LEVEL LIST, not `level ± 1`. The atlas has
     * gaps, and a stepper that counted integers would hand you a refusal from
     * `levelSourceFromAtlas` for a room the game does not have — a control
     * that produces errors for pressing it is not a control.
     *
     * ⚠ A GENERATED LEVEL IS NOT IN THAT LIST (900 is nobody's neighbour), so
     * stepping from one LEAVES it, and the note says so rather than the
     * button doing nothing.
     */
    const stepLevel = async (dir) => {
        // ⛓ The roster is already in flight from the preset mount; this is a
        // no-op by the time a human presses.
        await bootRosterReady?.catch(() => {});
        if (!lifetime.alive()) return;
        let block;
        try {
            block = blockNow();
        } catch (e) {
            $('bootNote').textContent = `the block will not parse, so the level cannot be `
                + `stepped — ${e.message}`;
            return;
        }
        const here = block.boot.level;
        const at = atlasLevels.indexOf(here);
        const next = at === -1
            ? (dir > 0 ? atlasLevels[0] : atlasLevels[atlasLevels.length - 1])
            : atlasLevels[at + dir];
        if (next === undefined) {
            $('bootNote').textContent = `level ${here} is the ${dir > 0 ? 'last' : 'first'} `
                + `level this atlas holds (${atlasLevels.length} of them), so there is no `
                + `${dir > 0 ? 'next' : 'previous'} one`;
            return;
        }
        await setLevel(next, at === -1
            ? `level ${here} is not in the atlas (a generated room is nobody's neighbour), `
                + 'so stepping left it'
            : null);
    };

    /**
     * ⛔⛔ THE BOOT POSITION IS NO LONGER GUESSED FOR 112 OF THE 116 ROOMS.
     *
     * Group A shipped this with two answers and a warning: a COMMITTED BOOT
     * from the tape roster (42 levels) or `chooseSpawn`, *a convenience for
     * looking around, not a position the game ever used*. ⚖ The user's item
     * replaces the second one wherever the game itself has an answer — and it
     * does, in the shape of a teleporter: **an entrance to level N is any
     * teleporter whose `to` is N**, and its `playerx`/`playery` are the very
     * ctor args `levelRun`'s transition arm passes when the player walks in.
     *
     * ⛔ FOUR OUTCOMES NOW, AND STILL FOUR DIFFERENT SENTENCES — the same rule
     * Group A wrote this comment for. "A tape booted here", "the game puts you
     * here when you walk in", "this page picked a spot" and "nothing could be
     * picked, so the old position stands and may be inside a wall" are four
     * degrees of trust, and a note that read the same for all of them would
     * make the weakest look like the strongest.
     *
     * ⚠ THE COMMITTED BOOT STILL WINS WHERE IT EXISTS, and that is a decision
     * rather than an oversight. MEASURED: of the 42, exactly **21 sit on an
     * entrance and 21 do not** — `r3-collect-shield` boots at (112,72) in L20,
     * mid-room, to isolate one mechanism. Both are positions the game used and
     * they answer different questions; the SELECTOR offers every entrance
     * regardless, so nothing is hidden by the default.
     */
    async function setLevel(level, why = null) {
        await bootRosterReady?.catch(() => {});
        if (!lifetime.alive()) return;
        let block;
        try {
            block = blockNow();
        } catch (e) {
            $('bootNote').textContent = `the block will not parse — ${e.message}`;
            return;
        }
        block = { ...block, boot: { ...block.boot, level } };
        $('bootBox').value = JSON.stringify(block, null, 4);
        $('bootLevel').value = String(level);
        const { opts, why: noEntranceWhy } = startOptionsFor(level);
        mountStartOptions(opts, noEntranceWhy);
        const notes2 = [];
        if (why) notes2.push(why);
        if (opts.length > 0) {
            // ⛔ THE LADDER'S HEAD — committed first where it exists, then the
            // entrances in atlas order. `startOptionsFor` builds it in that
            // order and this takes the front rather than re-deciding, so the
            // selector's first row and the block's contents cannot disagree.
            const pick = opts[0];
            notes2.push(pick.note);
            writeStart(pick.at, pick.value, notes2.join('  ·  '));
            return;
        }
        /**
         * ⚠ ONLY THE FOUR ROOMS NOTHING LEADS INTO REACH THIS (58, 69, 81, 84
         * — measured), and the reason the entrance index gave is printed with
         * the fallback rather than replaced by it: "this page picked a spot"
         * is much easier to trust than it should be without "…because nothing
         * in the atlas walks into this room" beside it.
         */
        if (noEntranceWhy) notes2.push(noEntranceWhy);
        let chosen = null;
        try {
            chosen = chooseSpawn(levelSource, block, level);
        } catch (e) {
            notes2.push(`⚠ level ${level}'s world would not build, so no spawn could be `
                + `chosen — ${e.message}`);
        }
        if (chosen) {
            notes2.push(`level ${level} — ⚠ THIS PAGE CHOSE (${chosen.x},${chosen.y}): the `
                + 'nearest walkable non-pit cell where the player box clears the solids. A '
                + 'convenience for looking around, not a position the game ever used — '
                + 'nothing may rest on it');
            mountStartOptions([{
                value: 'page-chose',
                label: `THIS PAGE CHOSE — ${chosen.x},${chosen.y} (nearest clear cell; not a `
                    + 'position the game ever used)',
                at: chosen,
                note: notes2[notes2.length - 1],
            }], noEntranceWhy);
            writeStart(chosen, 'page-chose', notes2.join('  ·  '));
            return;
        }
        notes2.push(`level ${level} — ⚠ no entrance, no committed boot, AND no free cell `
            + `could be chosen, so the boot position (${block.boot.x},${block.boot.y}) is `
            + 'still the previous level\'s and may be inside a wall');
        $('bootNote').textContent = notes2.join('  ·  ');
        $('bootX').value = String(block.boot.x);
        $('bootY').value = String(block.boot.y);
        scheduleRedraw();
    }

    /**
     * ⛓⛓⛓ THE SELECTOR'S OPTIONS, PLUS THE ONE THAT IS ALWAYS THERE.
     *
     * ⚠ `custom` IS NOT A PLACE, IT IS AN ATTRIBUTION. Every other row names
     * where its numbers came from; this one says a human typed them, which is
     * the honest label for a coordinate with no provenance — and it is exactly
     * what the two number fields select when they are edited.
     */
    let startOptions = [];
    function mountStartOptions(opts, noEntranceWhy) {
        startOptions = opts;
        const sel = $('bootStart');
        sel.innerHTML = '';
        for (const o of opts) {
            const el = document.createElement('option');
            el.value = o.value;
            el.textContent = o.label;
            sel.appendChild(el);
        }
        const custom = document.createElement('option');
        custom.value = 'custom';
        custom.textContent = 'CUSTOM — the x/y beside this box, typed by hand';
        sel.appendChild(custom);
        // ⚠ A NAMED ABSENCE ON THE CONTROL ITSELF. A selector holding nothing
        // but "custom" reads as a broken control; the reason it is empty is a
        // fact about the atlas and belongs where the emptiness is.
        sel.title = opts.length > 0
            ? 'where the start position came from — the game\'s own answers first'
            : (noEntranceWhy ?? 'no start position could be derived for this level');
    }

    lifetime.on($('bootStart'), 'change', () => {
        const want = $('bootStart').value;
        if (want === 'custom') {
            // ⚠ Selecting CUSTOM changes nothing but the label: the numbers in
            // the fields are already what is in force, and moving the player
            // because a dropdown was opened would be a control with a side
            // effect nobody asked for.
            writeStart({ x: Number($('bootX').value), y: Number($('bootY').value) }, 'custom',
                'CUSTOM — these coordinates are yours; nothing in the game or the tape '
                + 'roster claims them');
            return;
        }
        const opt = startOptions.find((o) => o.value === want);
        if (opt) writeStart(opt.at, opt.value, opt.note);
    });

    /**
     * ⛓ THE TWO NUMBER FIELDS, AND EDITING ONE SWITCHES THE ATTRIBUTION.
     *
     * ⛔ A HAND-TYPED COORDINATE MAY NOT KEEP AN ENTRANCE'S LABEL. The whole
     * item is about knowing where a start position came from; a selector still
     * reading "ENTRANCE from L9" over numbers somebody had since edited would
     * be the page asserting a provenance that is no longer true.
     */
    const onCoordEdit = () => {
        const x = Number($('bootX').value);
        const y = Number($('bootY').value);
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            // ⚠ SNAP BACK rather than write NaN into the block: the field then
            // SHOWS what is in force, which is the only way to tell a rejected
            // edit from an accepted one.
            let block;
            try { block = blockNow(); } catch { return; }
            $('bootX').value = String(block.boot.x);
            $('bootY').value = String(block.boot.y);
            $('bootNote').textContent = 'a start coordinate is a whole number of pixels — '
                + 'the `Game` constructor takes ints, so a fraction is not a position the '
                + 'engine can be booted at. The previous value stands';
            return;
        }
        writeStart({ x, y }, 'custom',
            'CUSTOM — these coordinates are yours; nothing in the game or the tape roster '
            + 'claims them');
    };
    lifetime.on($('bootX'), 'change', onCoordEdit);
    lifetime.on($('bootY'), 'change', onCoordEdit);

    /**
     * ⛓⛓⛓ READ THE BLOCK AND SAY WHERE ITS POSITION CAME FROM — WITHOUT
     * MOVING IT.
     *
     * ⛔⛔ THIS IS THE HALF THAT MUST NOT WRITE. A panel mounts holding a block
     * that came from a preset, a `?boot=` tape or the kept block of a previous
     * arm, and that position is the user's. `setLevel` CHOOSES a position (the
     * level changed, so the old one is meaningless); this only ATTRIBUTES the
     * one already there. A mount that ran the chooser would silently replace a
     * hand-tuned boot every time the SOURCE selector was touched — and since
     * the switch arc the selector no longer reloads, that would happen over
     * and over in one document.
     *
     * ⚠ AND AN UNMATCHED POSITION IS `custom`, NOT THE FIRST OPTION. A block
     * whose coordinates are nobody's entrance is exactly the case the label
     * exists for; defaulting the selector to the head of the ladder would
     * caption somebody's own numbers with a provenance they do not have.
     */
    function syncStartControls() {
        let block;
        try {
            block = blockNow();
        } catch {
            // The form already says the block will not parse; leaving the
            // fields as they are beats writing a guess into them.
            return;
        }
        const { opts, why: noEntranceWhy } = startOptionsFor(block.boot.level);
        mountStartOptions(opts, noEntranceWhy);
        $('bootX').value = String(block.boot.x);
        $('bootY').value = String(block.boot.y);
        $('bootLevel').value = String(block.boot.level);
        const match = opts.find((o) => o.at.x === block.boot.x && o.at.y === block.boot.y);
        $('bootStart').value = match ? match.value : 'custom';
    }
    syncStartControls();
    /**
     * ⚠ AND AGAIN ONCE THE TAPE ROSTER LANDS. `committedBootByLevel` is filled
     * by a fetch, so the first render can legitimately be missing the
     * COMMITTED BOOT row — the same race the level stepper documents and
     * answers by awaiting. Here the answer is to render twice: immediately, so
     * the control is never empty, and again when the roster resolves, so the
     * option appears. ⛔ Guarded on the lifetime, because a retired arm's
     * promise still settles.
     */
    bootRosterReady?.then(() => { if (lifetime.alive()) syncStartControls(); })
        .catch(() => {});

    $('bootPrev').onclick = () => stepLevel(-1);
    $('bootNext').onclick = () => stepLevel(1);
    // ⛓ TYPING A LEVEL WRITES THE BLOCK, through the same function the arrows
    // use — one path from "a level was chosen" to "the block says so".
    lifetime.on($('bootLevel'), 'change', () => {
        const wanted = Number($('bootLevel').value);
        if (!Number.isInteger(wanted)) return;
        /**
         * ⛔⛔ A CHANGE TO THE LEVEL ALREADY IN FORCE IS NOT A CHANGE, AND
         * TREATING IT AS ONE CLOBBERS A DELIBERATE CHOICE.
         *
         * `setLevel` PICKS a start position — that is its job, because a new
         * room makes the old coordinates meaningless. So a spurious re-fire
         * for the SAME level throws away whatever the user selected in the
         * meantime and silently reinstates the head of the ladder.
         *
         * ⛓ MEASURED, and it is not hypothetical: a number input fires
         * `change` on BLUR as well as on commit, so the sequence "type a
         * level, then click the entrance picker" delivered a second `change`
         * from the field losing focus. The browser row caught it as an
         * entrance selection that reverted to the committed boot between one
         * read and the next — `48,32` back to `48,80` with the selector
         * flipping itself to `committed`.
         *
         * ⇒ the level field answers "take me to a different room", and the
         * start-position controls answer "put me somewhere in this one". A
         * control that quietly did both is why this guard exists.
         */
        let here = null;
        try { here = blockNow().boot.level; } catch { /* the form says so */ }
        if (here === wanted) return;
        setLevel(wanted);
    });
    // ⚠ The roster decides where the player STARTS, so the stepper is only
    // meaningfully pressable once it has answered. Enabled either way — a
    // control that vanishes is worse than one that reports a caveat — but the
    // await above is what makes the caveat rare.
    /**
     * A hand edit of the block itself redraws too — on `change` (blur) rather
     * than per keystroke, which would build a world for every half-typed number.
     *
     * ⛓ AND IT RE-ATTRIBUTES THE START POSITION FIRST. Typing an entrance's
     * coordinates into the textarea makes the selector say `ENTRANCE from L9`;
     * typing anything else makes it say CUSTOM. ⚠ ONE LISTENER DOING BOTH,
     * deliberately: a second `change` on the same element would be a second
     * thing to retire and a second ordering to reason about, for a handler
     * that is two statements.
     */
    lifetime.on($('bootBox'), 'change', () => { syncStartControls(); scheduleRedraw(); });

    return { staging, origin, kept, name, preview, setLevel, redraw };
}

/**
 * The SOLVE arm: staging in, the bot's own walk out, scrubbed by REPLAY's
 * machinery.
 *
 * ⚠ The solve is SYNCHRONOUS and blocks the page while it runs — which is
 * exactly the quantity ⚖ kickoff §1.2 deferred the live think-mode on, so
 * the page measures it and shows it rather than hiding it behind a
 * spinner.
 */
async function runSolve(params, lifetime) {
    const { levelSource, atlas } = await armPrelude(params, lifetime);
    // ⛔ EVERY AWAIT IS A PLACE THE PAGE CAN HAVE CHANGED HANDS. A mount that
    // kept writing after its arm was retired would paint this arm's title and
    // block over the one the user actually switched to.
    if (!lifetime.alive()) return;

    const layers = layerSetFor(params);
    const { staging, name } = await mountBootPanel(params, lifetime, {
        verb: 'solving',
        namePrefix: 'editor',
        levelSource,
        layers,
        atlas,
        // ⛓ The SOLVE arm's own consumer: a ticked sword rebuilds the world
        // the goal picker offers, so the census follows the box.
        onBoxChange: () => refreshFromBox(),
    });
    if (!lifetime.alive()) return;

    // ── the goal picker, over this staging block's own census ────────
    let goals = params.goals ? parseGoalsParam(params.goals) : [];
    /**
     * ⛔ WHETHER THE GOAL LIST IS THE USER'S. `?goals=` and every press of
     * add/clear make it theirs, and the auto-pick below then keeps its hands
     * off — a control that re-chose for you after you cleared it would be
     * fighting you, once per level change.
     */
    let goalsAreYours = goals.length > 0;
    const showGoals = () => {
        $('solveGoals').textContent = goals.length ? formatGoalsParam(goals) : '—';
    };
    const fillCensus = (world) => {
        const options = censusGoalOptions(world);
        $('solveGoalPick').innerHTML = '';
        for (const o of options) {
            const el = document.createElement('option');
            el.value = o.spec;
            el.textContent = o.label;
            // Listed, never dropped — but not selectable, with the reason
            // in the tooltip. "Shut" and "absent" must not look alike.
            el.disabled = !o.usable;
            if (o.why) el.title = o.why;
            $('solveGoalPick').appendChild(el);
        }
        if (!options.length) {
            $('solveGoalPick').innerHTML =
                '<option value="">— this level\'s census names no exit and no placement —</option>';
            return;
        }
        /**
         * ── ⛓⛓⛓ THE GOALS, PRE-FILLED FROM THE CENSUS (group A, item 10) ──
         *
         * Browsing levels with ◀ ▶ is unusable if every step needs a trip to
         * the dropdown before SOLVE can be pressed. So the list is filled on
         * arrival — ⛔ BY `defaultGoalsFromCensus`, THE PAGE'S OWN EXISTING
         * LAW, and never by a second policy invented here.
         *
         * ⚠ MEASURED, TWICE OVER. The first cut auto-picked "the first usable
         * option", which quietly overruled the one case that law exists for —
         * a level with two live exits, where the page refuses because a solve
         * toward the wrong one prints a tick count that looks like an answer.
         * `check-seedling-editor-boot.mjs` went red on exactly that (level 4).
         * The second cut fired only when the census had ONE usable option of
         * any kind, which honoured the law but almost never fired: level 0 has
         * eight, seven of them pickups nobody is ambiguous about.
         *
         * ⇒ ASK THE FUNCTION THAT ALREADY KNOWS. It takes every placement and
         * the single live exit when there is exactly one, and REFUSES — with
         * the alternatives named — when there is not. That is precisely the
         * set of decisions this page is entitled to make, so the pre-fill and
         * the press now agree by construction rather than by care.
         */
        if (!goalsAreYours) {
            const d = defaultGoalsFromCensus(world);
            const usable = options.filter((o) => o.usable);
            if (usable.length) $('solveGoalPick').value = usable[0].spec;
            if (d.goals) {
                goals = d.goals;
                showGoals();
                $('bootNote').textContent += `${$('bootNote').textContent ? '  ·  ' : ''}`
                    + `⛓ goals pre-filled from this level's census — ${formatGoalsParam(d.goals)}`
                    + '. This is the SAME default SOLVE would use on an empty list, not a '
                    + 'second opinion about it; add or clear to make the list yours.';
            } else {
                $('bootNote').textContent += `${$('bootNote').textContent ? '  ·  ' : ''}`
                    + `⚠ no goals pre-filled — ${d.refusal}`;
            }
        }
    };
    showGoals();

    /**
     * ⛔⛔ THE BLOCK THE BUTTON ACTUALLY SOLVES IS THE ONE IN THE BOX —
     * and until slice 5 it was not.
     *
     * `runSolve` fetched a staging block, printed it into the textarea and
     * then kept its own closure copy; `solveNow` solved THAT. So every edit
     * anybody made to the "starting conditions" editor since slice 1 shipped
     * was silently discarded — the page showed a block, accepted changes to
     * it, and solved a different one. The MANUAL arm has re-read its own box
     * at START since slice 3 (`stagingFromJson(JSON.parse(...))`), which is
     * what makes the asymmetry visible now that a FORM writes into the box:
     * a sword checkbox over a textarea nobody reads is a control that does
     * nothing, reporting success.
     *
     * ⚠ Found by building the form, not by inspection — the same way slice
     * 3's load-note was found by its browser row. A feature that consumes an
     * input is how you learn whether the input was ever consumed.
     */
    const stagingNow = () => {
        const block = stagingFromJson(JSON.parse($('bootBox').value));
        return params.level !== null && Number.isFinite(params.level)
            ? { ...block, boot: { ...block.boot, level: params.level } }
            : block;
    };

    // The census needs a built world, and building one can refuse (a level
    // the atlas does not have, an orphan clear). REPORTED, not swallowed.
    let world = null;
    /**
     * ⛔⛔ THE CENSUS IS REBUILT FROM THE BLOCK BEING SOLVED, and it has to
     * take that block as an ARGUMENT rather than re-deriving it.
     *
     * The first cut re-read the box here too, and `solveNow` re-read it
     * again — two readings of one textarea in a single press. Retyping the
     * level to 4 then produced a refusal naming LEVEL 11's exits: the block
     * was fresh and the census was the one built at mount. That is the
     * two-cost-models trap in miniature, and its tell was a message about
     * the wrong room. ⚠ Caught by the acceptance row, which asserted the
     * refusal names the level in the box — a check on `__editorSolve.level`
     * alone would have been green.
     */
    const refreshCensus = (block) => {
        try {
            world = censusWorld(levelSource, block);
            fillCensus(world);
            return true;
        } catch (e) {
            fatal(`level ${block.boot.level} would not build from this staging block`,
                e.message);
            return false;
        }
    };
    refreshCensus(staging);
    /**
     * ⛓ THE FORM'S CONSUMER, IN THE SAME SLICE (trap 119). A ticked sword
     * rebuilds the world the goal picker offers — `Karlore` removes itself
     * when the player has fire and a `BossKey` in its own first `check()`,
     * so an item flag really can change what a level CONTAINS.
     *
     * ⚠ And a HAND edit refreshes it on `change` (blur), not on `input`: a
     * world build per keystroke would rebuild a level for every half-typed
     * number. The press-time refresh in `solveNow` is what makes the picker's
     * staleness cosmetic rather than load-bearing.
     */
    function refreshFromBox() { try { refreshCensus(stagingNow()); } catch { /* shown */ } }
    // ⛓ NO SECOND `change` LISTENER ON THE BOX. The panel's own redraw calls
    // `onBoxChange` — which IS this function — so registering here too would
    // rebuild the census twice per edit: harmless, invisible, and exactly the
    // kind of duplicate work the shared panel exists to stop.

    $('solveGoalAdd').onclick = () => {
        const spec = $('solveGoalPick').value;
        if (!spec) return;
        // ⛓ Touching the list makes it YOURS — the auto-pick stops choosing.
        goals = [...(goalsAreYours ? goals : []), ...parseGoalsParam(spec)];
        goalsAreYours = true;
        showGoals();
    };
    $('solveGoalClear').onclick = () => { goals = []; goalsAreYours = true; showGoals(); };

    // ── SOLVE ────────────────────────────────────────────────────────
    async function solveNow() {
        $('solveGo').disabled = true;
        // ⛔ THE BOX, RE-READ AT PRESS — see `stagingNow`. A refusal here is
        // the tape parser's own message, exactly as the MANUAL arm's is.
        let block;
        try {
            block = stagingNow();
        } catch (e) {
            fatal('the starting conditions would not parse — this is the tape parser\'s '
                + 'own message', e.message);
            window.__editorSolve = { status: 'refused', message: e.message };
            $('solveGo').disabled = false;
            return;
        }
        // ⛔ ONE READING PER PRESS: the census the default goals come from is
        // rebuilt from the SAME block the solve will run, so a refusal names
        // the room in the box rather than the room at mount.
        if (!refreshCensus(block)) {
            $('solveGo').disabled = false;
            return;
        }
        let list = goals;
        if (!list.length) {
            if (!world) return;
            const d = defaultGoalsFromCensus(world);
            if (!d.goals) {
                fatal('no goals — and this level has no unambiguous default', d.refusal);
                window.__editorSolve = { status: 'refused', message: d.refusal };
                $('solveGo').disabled = false;
                return;
            }
            list = d.goals;
            goals = list;
            showGoals();
        }

        $('status').className = '';
        $('status').textContent = `solving ${name} in level ${block.boot.level} `
            + `toward ${formatGoalsParam(list)}…`;
        // Yield one frame so the status paints BEFORE the synchronous solve
        // takes the thread. Without it the page looks frozen with the old
        // text on it, which is a lie about what it is doing.
        await new Promise((r) => requestAnimationFrame(r));

        let solved;
        try {
            solved = solveForPage({
                levelSource, staging: block, goals: list, name, now: () => performance.now(),
                /**
                 * ⛓⛓ THE SCRATCH FORK, AND ONLY FOR A LEVEL WITH NO TAPE
                 * BEHIND IT. A kill-lock clear is DECLARED by a recorded
                 * tape's v9 `at` row; a level the GENERATE arm just handed
                 * over has no tape at all, so `levelRun`'s refusal to compute
                 * a clear nobody declared is vacuous exactly there and
                 * correct everywhere else. ⛔ Keyed on the HELD LEVEL, never
                 * on the level NUMBER: 900 is a convention, and a flag that
                 * read it would turn any block someone typed 900 into a
                 * scratch solve.
                 */
                scratchPersistence: isHeldLevel(block.boot.level),
            });
        } catch (e) {
            // ⚠ THE SOLVER'S OWN MESSAGE, VERBATIM, with the rows it got
            // through first — a refused segment is still reviewable, and
            // `SolverRefusal` carries them for exactly that. ⛓ Slice 5: the
            // despawn CHECK's refusal arrives through this same arm, which
            // is why the wording says "the solver" rather than naming one.
            const rows = e.rows?.length;
            /**
             * ⛓⛓⛓ ⚖ EDITOR ARC SLICE 10 — THE DANGER RECORD, ON THE ONE
             * OUTCOME THAT CAN CARRY A NON-EMPTY ONE.
             *
             * Slice 9 gave the page a `danger` layer and then measured that
             * across 30 solves of 9 committed blocks NOT ONE recorded query
             * came back dangerous (§17.5) — a theorem, not an accident:
             * `refuseDanger` THROWS when the union answers danger, so a
             * segment that reaches its goal cannot have had a dangerous gate.
             * ⇒ the interesting half of that channel lives HERE, on the
             * refusal path, and until slice 10 nothing read it.
             *
             * ⛔ THE READOUT IS THREE DIFFERENT ANSWERS, NOT A COUNT. `null`
             * = this refusal carries no record at all (thrown by a
             * module-level helper, which cannot see `solveSegment`'s
             * recorder — the same bound `rows` and `perTick` already have);
             * `0` = the bot asked nothing before it stopped; `n` with
             * `dangerous: 0` = it was told CLEAR every time and stopped for
             * some other reason. Collapsing those would report "no danger"
             * for a refusal nobody recorded.
             */
            const queries = Array.isArray(e.dangerQueries) ? e.dangerQueries : null;
            const dangerous = (queries ?? []).filter((q) => q.danger);
            const dangerLine = queries === null
                ? '\n\n(this refusal carries NO danger record — it was raised outside '
                    + 'the solve loop\'s own recorder)'
                : `\n\n⚖ the danger the bot was told: ${queries.length} query(s), `
                    + `${dangerous.length} DANGEROUS${dangerous.length
                        ? `:\n${dangerous.slice(0, 4).map((q) => `  · ${q.where} at tick `
                            + `${q.tick} (run tick ${q.runTick}), L${q.level} `
                            + `(${q.x},${q.y}) — ${q.sources
                                .map((s) => `${s.kind}:${s.id ?? '?'} (${s.why})`).join('; ')}`)
                            .join('\n')}`
                        : ' — every gate this walk reached answered CLEAR'}`;
            fatal('the solver REFUSED — this is its own message, not the page\'s',
                `${e.message}${rows ? `\n\n(${rows} decision row(s) before the refusal)` : ''}`
                + dangerLine);
            window.__editorSolve = {
                status: 'refused',
                message: e.message,
                rows: rows ?? 0,
                dangerQueries: queries === null ? null : queries.length,
                dangerousQueries: queries === null ? null : dangerous.length,
                /**
                 * ⛔ THE UNION'S OWN `why` STRINGS, VERBATIM — a paraphrase
                 * would be a second spelling of the warning, and the warning
                 * is the entire content of the channel (the recorder's own
                 * rule, one module over).
                 */
                dangerSources: dangerous.flatMap((q) => q.sources.map((s) => s.why)),
            };
            $('solveGo').disabled = false;
            return;
        }

        const solveMs = Math.round(solved.ms);
        $('solveTime').textContent = `solved in ${solveMs} ms`;
        const replayT0 = performance.now();
        // ⛓ The trace goes STRAIGHT into the pane: an in-page solve already
        // holds it, so fetching a sidecar for a tape that was never written
        // would be looking on disk for something in memory.
        // ⚖ ITEM 9: the danger the SOLVER was told rides straight into the
        // replay, exactly as its trace does — the solve holds both in memory,
        // and a page that went looking for either on disk would be looking for
        // an artifact that was never written.
        const { frames } = await replayTape(solved.tape, name, params, levelSource,
            { trace: solved.out.trace, why: null }, solved.out.dangerQueries,
            // ⛓ The tape being scrubbed came from a scratch solve iff the
            // solve above was one — the same fork, kept in step by construction.
            { scratchPersistence: isHeldLevel(block.boot.level) });
        const replayMs = Math.round(performance.now() - replayT0);

        /**
         * ⛓ The trace's SHAPE, beside the run's own counts — the same
         * summary `solve-seedling-r8-battery` prints. The rows themselves
         * are in the pane (slice 2), which is the consumer this readout was
         * standing in for.
         */
        $('detail').textContent = `${$('detail').textContent}`
            + `${$('detail').textContent ? '  ·  ' : ''}`
            + `SOLVED: ${solved.out.perTick.length} ticks, `
            + `${solved.out.trace.rows.length} decision(s), `
            + `${solved.out.replans} re-plan(s), `
            + `${solved.run.playerHits.length} hit(s), `
            + `${solved.run.playerDeaths.length} death(s)  ·  `
            + `solve ${solveMs} ms + replay ${replayMs} ms`
            /**
             * ⛓ THE DESPAWN CHECK'S VERDICT, ON SCREEN (slice 5). A check
             * whose only outcome anybody sees is its REFUSAL is a check
             * nobody can tell ran — trap 119's family, one channel over. A
             * reproduced row names the model's own tick beside the declared
             * witness band so the two numbers are visibly different things.
             */
            + (solved.despawns.length
                ? `  ·  DESPAWN CHECK: ${solved.despawns.map((d) => `${d.id} declared by `
                    + `${d.at}${d.reproduced ? ` — the model removed it at ${d.t} (${d.cause})`
                        : ' — NOT reproduced by this walk (the route never caused it)'}`)
                    .join('; ')}`
                : '');
        $('status').className = 'ok';
        $('status').textContent = `${name} — ${frames.length} observations, `
            + `solved in ${solveMs} ms`;

        /**
         * The page's own readout, for `check-seedling-editor-solve.mjs`.
         * Sets are not JSON, so the held keys travel as arrays IN THE
         * SOLVER'S OWN ORDER — sorting them here would hide exactly the
         * kind of difference the acceptance row exists to catch.
         */
        window.__editorSolve = {
            status: 'ok',
            name,
            level: block.boot.level,
            despawns: solved.despawns,
            tapeVersion: solved.tape.tape_version,
            goals: formatGoalsParam(list),
            tickCount: solved.out.perTick.length,
            perTick: solved.out.perTick.map((held) => [...held]),
            inputs: solved.tape.inputs,
            traceRows: solved.out.trace.rows.length,
            solveMs,
            replayMs,
            frames: frames.length,
        };
        // The pane reads the object above directly; this is the same trace,
        // exposed for a CLI or a console that wants the rows without the DOM.
        window.__editorTrace = solved.out.trace;
        $('solveGo').disabled = false;
    }

    $('solveGo').onclick = solveNow;
    if (params.solve) await solveNow();
    else {
        $('status').textContent = `ready — level ${staging.boot.level} from ${origin}. `
            + 'Pick goals and press SOLVE.';
    }
}

// ── SOURCE = MANUAL (editor arc slice 3) ─────────────────────────────────

/**
 * ── ⛓⛓⛓ DRIVE THE PLAYER BY HAND, AND FOLD THE SESSION INTO A TAPE ─────
 *
 * ⛔ THE LOOP LAW, ANSWERED. This advances a run tick by tick, and the page's
 * third law is NO PRIVATE TICK LOOP. It is not one: the law forbids a second
 * REPLAY loop (two of those drift, and the one nobody tests is the one that
 * drifts). This is a PRODUCER, beside `solveSegment` and `botDriverV1/V2` —
 * keys in, `perTick` out, with no tape it claims to reproduce. And the join
 * is ASSERTED rather than assumed: STOP folds with the ONE fold and replays
 * the result through the ONE stepper, comparing every observation
 * (`watchManual.foldRoundTrip`). If a producer ever did drift from the
 * replay, that comparison is where it shows.
 *
 * ⛔ ONE CONSTRUCTION AND ONE FOLD, both `solveForPage`'s:
 * `createRunForStaging(solveStaging(staging))` and `buildStagedTape`.
 *
 * ⚠ THE LIVE OVERLAYS ARE THE REPLAY'S OWN CALLS. `sampleMovers` per tick
 * (slice 2's line, no new mechanism) and `extractMarkers` over the session's
 * observations — so what you see while driving and what you see scrubbing
 * the tape you just recorded are the same derivation, not two that agree.
 */
async function runManual(params, lifetime) {
    const { levelSource, atlas } = await armPrelude(params, lifetime);
    if (!lifetime.alive()) return;

    /**
     * ⛓ THE SAME PANEL SOLVE MOUNTS, over the SAME box — which is what makes
     * a block edited in SOLVE the block you drive here. ⚠ MANUAL passes no
     * `onBoxChange`: it re-reads the box at START (slice 3 of the editor arc),
     * so there is nothing downstream to refresh in between.
     */
    // ⚠ ONCE, AND BEFORE THE PANEL. The Set IS the live toggle state — the
    // checkboxes mutate it in place, so rebuilding it per draw would undo
    // every toggle every frame, and the preview must share the one the drive
    // will use or a layer would mean two different things either side of START.
    const layers = layerSetFor(params);
    const { staging, name } = await mountBootPanel(params, lifetime, {
        verb: 'driving', namePrefix: 'manual', levelSource, layers, atlas,
    });
    if (!lifetime.alive()) return;

    if (layers.unknown.length) {
        $('bootNote').textContent += `${$('bootNote').textContent ? '  ·  ' : ''}`
            + `⚠ ?layers= names ${layers.unknown.length} unknown layer(s): `
            + `${layers.unknown.join(', ')} — the roster is ${LAYER_IDS.join(', ')}`;
    }

    const canvas = $('canvas');
    let session = null;
    let driving = false;
    let speed = params.speed;
    const codes = new Set();
    let renderer = null;
    let worldFor = null;

    /**
     * ⚠ THE KEYBOARD IS READ FROM PHYSICAL CODES AND ONLY WHILE DRIVING.
     *
     * `preventDefault` on the bound keys, or the arrows scroll the page out
     * from under the canvas mid-run — and a run you cannot see is a run you
     * cannot drive. Deliberately NOT captured when the session is stopped:
     * typing a boot block into the textarea must not press X.
     */
    const onKey = (down) => (e) => {
        if (!driving) return;
        if (!tapeKeyForCode(e.code)) return;
        e.preventDefault();
        if (down) codes.add(e.code); else codes.delete(e.code);
    };
    /**
     * ⛔⛔ THESE THREE ARE THE ARM-SWITCH HAZARD IN ITS SHARPEST FORM. They
     * are on WINDOW, not on a panel, and `onKey` refuses only when this arm
     * is not `driving` — a flag in a closure that outlives the arm. Left
     * registered, a retired MANUAL would go on swallowing arrow keys under
     * SOLVE and GENERATE, and `preventDefault` means it would eat the page's
     * scrolling with them. Nothing would throw and nothing would draw wrong:
     * the keyboard would simply be haunted.
     */
    lifetime.on(window, 'keydown', onKey(true));
    lifetime.on(window, 'keyup', onKey(false));
    // A window that loses focus mid-press would otherwise hold that key for
    // the rest of the session — the tape would record a hold nobody made.
    lifetime.on(window, 'blur', () => codes.clear());

    const drawLive = () => {
        const world = worldFor(session.run.level);
        const last = session.observations[session.observations.length - 1];
        const { markers } = liveOverlaysFor(session);
        renderer.draw(world, session.run.state, {
            on: layers.on,
            samples: session.samples,
            markers,
            // ⛓ SLICE 6: the LIVE drive gets the shape layers too, off the
            // same ledger the replay path reads — a hand swing shows its rect
            // on the tick it fired, exactly as a replayed one does.
            presses: session.run.presses,
            // ⛓ GROUP B: the LIVE drive gets the afterimage too — a hand swing
            // is five ticks and a blink exactly like a replayed one.
            attackHold: attackHoldNow(),
            cursor: session.tick,
            /**
             * ⛓ SLICE 9 — THE MANUAL ARM HAS NO FRAMES, so it hands the LIVE
             * run's own two getters. One derivation (`crushersAt`), two
             * sources, and each is that path's own per-tick reading: the
             * replay path's is the R5 FORWARD, this one's is the run being
             * driven right now. A manual drive that showed no crusher because
             * the forward is a replay artifact would be the layer lying about
             * the one room it exists for.
             */
            live: { crushers: session.run.crushers, crusherScans: session.run.crusherScans },
            // ⚖ A MANUAL DRIVE HAS NO SOLVER, and `null` is how the layer is
            // told to say so by name rather than drawing a calm room.
            dangerQueries: null,
        });
        $('hud').innerHTML = [
            manualRow('tick', String(session.tick)),
            manualRow('level', `${last.level} (${world.width}x${world.height})`),
            manualRow('position', `${fmt(last.x)}, ${fmt(last.y)}`),
            manualRow('held', [...heldFromCodes(codes)].sort().join(' + ') || '—'),
            manualRow('hits', `${session.run.playerHits.length}`),
            manualRow('deaths', `${session.run.playerDeaths.length}`),
            manualRow('clears', `${session.run.earnedClears.length}`),
            /**
             * ⛓ GROUP B: what the auto-advance has DRIVEN, on the HUD beside
             * what the driver did. Keys the page dispatched on your behalf and
             * wrote into your tape are not a thing to leave to a tooltip.
             */
            manualRow('auto text', autoAdvanceTextNow()
                ? `${session.autoText.releases} release(s) over `
                    + `${session.autoText.ceremonies} ceremony(s)`
                : 'OFF — you are pressing X yourself'),
        ].join('');
        // ⛓ GROUP B: the live drive's own ceremony box, from the sample the
        // session just took. The manual arm's cursor IS its tick.
        renderDialogue(session.samples, session.tick, last.level);
        $('status').textContent = `${name} — DRIVING, ${session.tick} tick(s) recorded`;
    };

    /**
     * ⚠ THE PACER IS THE PAGE'S OWN, and `speed` means the same thing it
     * means in REPLAY: ticks per animation frame. At 1x that is the game's
     * own rate on a 60 Hz display.
     *
     * ⛔ THE PER-FRAME STEP COUNT IS CAPPED. A backgrounded tab wakes with a
     * multi-second delta, and an uncapped accumulator would drive hundreds
     * of ticks in one frame with whatever keys were down — recording a walk
     * nobody made, at full speed, into the tape.
     */
    let acc = 0;
    const MAX_STEPS_PER_FRAME = 8;
    function manualFrame() {
        try {
            if (driving && session) {
                acc += speed;
                let steps = 0;
                while (acc >= 1 && steps < MAX_STEPS_PER_FRAME) {
                    acc -= 1;
                    steps += 1;
                    /**
                     * ⛓⛓⛓ GROUP B — THE CEREMONY DRIVES ITSELF, IF ASKED.
                     *
                     * ⛔ THE DECISION IS THE SESSION'S (`heldFor`), THE STEP IS
                     * STILL THIS LOOP'S. One place dispatches a manual tick,
                     * which is the no-second-loop law at its own scale; what
                     * moved into `watchManual` is the RULE about which keys,
                     * because that is the part that can be wrong and therefore
                     * the part that has tests.
                     */
                    const { held } = session.heldFor(heldFromCodes(codes),
                        { autoAdvanceText: autoAdvanceTextNow() });
                    session.step(held);
                    renderer.mark(session.run.state, session.run.level);
                }
                if (acc >= 1) acc = 0;
                drawLive();
            }
        } catch (e) {
            driving = false;
            // The run REFUSED (a soft-lock stance, an orphan clear). Its own
            // message, with the tick — and the session is kept, so STOP can
            // still fold what was driven up to it.
            fatal(`the run refused at tick ${session?.tick} — this is its own message`,
                `${e.message}\n${e.stack ?? ''}`);
            $('manualStop').disabled = false;
        }
        requestAnimationFrame(manualTick);
    }

    /**
     * ⛔⛔ THE LOOP THE RELOAD USED TO STOP. `manualFrame` re-arms from its own
     * tail unconditionally and had NO supersession check of any kind —
     * `replayGeneration` guards `replayTape`'s loop and never guarded this
     * one, because until now the only way to leave MANUAL was to navigate.
     * Retired, it would keep stepping `session` for the life of the tab,
     * under whichever arm came next, recording ticks into a tape nobody is
     * driving.
     *
     * ⚠ The guard wraps the BODY, so the tail above cannot re-arm — and the
     * unconditional re-arm after a THROW inside it survives untouched, which
     * is R4's lesson and a different question entirely.
     */
    const manualTick = lifetime.guard('manual-frame', manualFrame);

    $('manualStart').onclick = () => {
        let block;
        try {
            block = stagingFromJson(JSON.parse($('bootBox').value));
        } catch (e) {
            fatal('the starting conditions would not parse — this is the tape parser\'s '
                + 'own message', e.message);
            return;
        }
        try {
            session = createManualSession({
                levelSource, staging: block, name,
                // ⛓ Same fork, same reason as SOLVE's — a generated room has
                // no tape to declare a clear, and driving it is what would
                // produce one.
                scratchPersistence: isHeldLevel(block.boot.level),
            });
        } catch (e) {
            fatal(`level ${block.boot.level} would not build from this staging block`,
                e.message);
            return;
        }
        // ⛔ SUPERSEDES ANY REPLAY THAT OWNS THE CANVAS — see
        // `replayGeneration`. Without it a previously folded tape's loop
        // would keep drawing over the live drive.
        replayGeneration += 1;
        worldFor = makeWorldFor(levelSource, session.staging);
        renderer = makeRenderer(canvas);
        renderer.reset();
        renderer.fit(worldFor(session.run.level));
        driving = true;
        acc = 0;
        $('manualStart').disabled = true;
        $('manualStop').disabled = false;
        $('status').className = '';
        $('detail').textContent = '';
        mountLayerControls(layers.on, drawLive);
        drawLive();
        requestAnimationFrame(manualTick);
    };

    $('manualStop').onclick = async () => {
        if (!session) return;
        driving = false;
        $('manualStart').disabled = false;
        $('manualStop').disabled = true;

        /**
         * ⛓⛓⛓ THE ACCEPTANCE ROW, PERFORMED BY THE PAGE ITSELF.
         *
         * Fold with the one fold, replay through the one stepper, compare
         * every observation and every held set. Reported on the page rather
         * than merely computed: a round trip that silently failed would show
         * a tape that looks exactly like a good one.
         */
        const trip = foldRoundTrip(session, levelSource);
        /**
         * ⛓ THE DESPAWN CHECK, AT STOP (slice 5). A hand drive is a walk
         * like any other, so the declared removals owe the same account —
         * and STOP is where the walk is finished, which is what makes the
         * question answerable. ⚠ REPORTED, never thrown here: STOP's job is
         * to hand back what was driven, and a refusal that discarded the
         * session would lose a real walk over a bookkeeping disagreement.
         */
        let despawns = [];
        let despawnWhy = null;
        try { despawns = session.checkDespawns(); } catch (e) { despawnWhy = e.message; }
        window.__editorManual = {
            name,
            despawns,
            despawnWhy,
            ticks: session.tick,
            observations: session.observations.length,
            frames: trip.frames.length,
            roundTrip: trip.ok,
            faithful: trip.faithful,
            refusal: session.refusal,
            reproduced: trip.reproduced,
            mismatches: trip.mismatches,
            error: trip.error ? trip.error.message : null,
            inputs: trip.tape.inputs,
            clears: session.run.earnedClears.length,
        };
        $('status').className = trip.ok ? 'ok' : 'bad';
        $('status').textContent = `${name} — ${session.tick} tick(s) driven, folded into `
            + `${trip.tape.inputs.length} input span(s)`;
        // ⚠ THREE OUTCOMES, NOT TWO. A drive the run REFUSED is a legitimate
        // session whose tape legitimately refuses; calling that a broken
        // round trip would teach the next reader to ignore a red.
        $('detail').textContent = trip.ok
            ? `⛓ ROUND TRIP OK — the fold replays frame-for-frame: `
              + `${session.observations.length} observation(s) driven, `
              + `${trip.frames.length} frame(s) replayed, every position and every held `
              + 'set identical'
              + (trip.reproduced
                  ? `  ·  and the run's REFUSAL at tick ${session.refusal.tick} reproduced `
                    + 'identically'
                  : '')
            : `⛔ ROUND TRIP FAILED — ${trip.mismatches.length} mismatch(es): `
              + trip.mismatches.slice(0, 6).map(
                  (m) => `t${m.tick} ${m.what}: drove ${m.drove}, replayed ${m.replayed}`)
                  .join('  ·  ')
              + (trip.error ? `  ·  the replay threw: ${trip.error.message}` : '')
              + (session.refusal && !trip.error
                  ? `  ·  the DRIVE refused at tick ${session.refusal.tick} and the replay `
                    + 'did NOT — the fold lost the refusal'
                  : '');
        if (despawnWhy) {
            $('detail').textContent += `  ·  ⛔ DESPAWN CHECK REFUSED — ${despawnWhy}`;
        } else if (despawns.length) {
            $('detail').textContent += `  ·  DESPAWN CHECK: ${despawns.map((d) => `${d.id} `
                + `declared by ${d.at}${d.reproduced ? ` — the model removed it at ${d.t}`
                    : ' — NOT reproduced by this walk'}`).join('; ')}`;
        }

        // ⛓ And the tape is handed to the page's OWN REPLAY arm, so what you
        // scrub is what the stepper produced — not a picture of the drive.
        await replayTape(trip.tape, `${name} (manual fold)`, params, levelSource, null);
        // replayTape rewrites status/detail; the round-trip verdict is the
        // headline and goes back on top of it.
        $('detail').textContent = `${$('detail').textContent}\n`
            + (trip.ok ? '⛓ manual fold: round trip OK'
                : `⛔ manual fold: ROUND TRIP FAILED (${trip.mismatches.length})`);
    };

    $('status').textContent = `ready — level ${staging.boot.level} from ${origin}. `
        + 'Press START, then drive with the arrow keys and X/C.';
}

const manualRow = (k, v) => `<div class="r"><span>${k}</span><b>${v}</b></div>`;

/** Text into HTML. The ceremony strings are the game's, not this page's. */
const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * ⛓⛓⛓ GROUP B — RENDER THE CEREMONY TEXT, from the per-tick sample.
 *
 * ⛔ ONE RENDERER, BOTH ARMS, ONE CHANNEL. The complaint was about MANUAL
 * mode, and a box wired only into the manual arm would have been a second
 * reading the first time somebody scrubbed a REPLAY through a pickup. Both
 * arms already sample through `sampleMovers`, so both get this from one call.
 *
 * ⛔⛔ THE TYPED PREFIX AND THE REST ARE BOTH SHOWN, and the difference is the
 * whole content. `Game.talk()` types one character every `framesPerCharacter`
 * RENDER frames, and a release that lands before the page has finished typing
 * FAST-FORWARDS it instead of turning it — so "how far has this typed" is
 * precisely the state that decides what the next X release does. Showing only
 * the visible prefix would hide the page; showing only the whole page would
 * hide the type-out. Both, in two inks.
 *
 * ⚠ AND AN ABSENCE IS PRINTED, NOT HIDDEN, WHEN IT HAS A REASON WORTH READING.
 * A textless ceremony — a boss key, a totem part — freezes the screen for 150
 * frames with nothing to press, which looks exactly like a hang; that one gets
 * the box and the sentence. "No ceremony is running", the state of almost
 * every tick, hides the box instead: a permanent banner saying nothing is
 * happening is noise, and `dialogueAt`'s reason is still in the readout for
 * anything that asks.
 */
function renderDialogue(samples, cursor, level) {
    const box = $('dialogue');
    const d = dialogueAt(samples, cursor, level);
    if (!d.ceremony) {
        box.hidden = true;
        box.innerHTML = '';
        return d;
    }
    const c = d.ceremony;
    const who = `${c.tag ?? 'pickup'}${c.item ? ` → ${c.item}` : ''}`;
    if (!c.dialogue) {
        box.hidden = false;
        box.innerHTML = `<div class="meta">CEREMONY — ${esc(who)}</div>`
            + `<div class="why">${esc(d.why ?? '')}</div>`;
        return d;
    }
    const dl = c.dialogue;
    const rest = typeof dl.text === 'string' ? dl.text.slice(d.visible.length) : '';
    box.hidden = false;
    box.innerHTML = `<div class="meta">CEREMONY — ${esc(who)} — page ${dl.page + 1}`
        + ` of ${dl.pages}${dl.done ? ' — DONE' : ''}</div>`
        + `<div class="txt">${esc(d.visible)}<span class="rest">${esc(rest)}</span></div>`
        + `<div class="meta">typed ${dl.currentCharacter}/${dl.pageLength} chars`
        + ` (${dl.framesPerCharacter} frames each) — the page turns on an X RELEASE, and`
        + ' one that lands before the type-out finishes fast-forwards it instead</div>';
    return d;
}

// ── SOURCE = GENERATE (PROCGEN PoC slice 5) ──────────────────────────────

/**
 * The GENERATION trace, in its own pane beside the decision trace.
 *
 * ⛔ TWO PANES BECAUSE THERE ARE TWO TRACES, and they answer different
 * questions about different things. The decision trace is the SOLVER's, one
 * row per obstacle it reasoned about, indexed by TICK — which is why its rows
 * are clickable and light up as the scrubber passes them. A generation row is
 * an ATTEMPT: a template, an anchor, a verdict class and (⚖ §7.4) the
 * refusal's own verbatim text. It has no tick and nothing to seek to.
 * Rendering them in one list would need a row shape that is a superset of
 * both and true of neither.
 *
 * ⚠ THE REASON TEXT IS THE ROW'S BODY, not a tooltip. Trap 202: the danger
 * channel is empty on every success BY CONSTRUCTION, so the refusals are the
 * evidence channel — and evidence you have to hover to see is evidence
 * nobody reads.
 */
function mountGenerationPane(rows) {
    const box = $('genTrace');
    box.innerHTML = '';
    if (!rows.length) {
        const el = document.createElement('div');
        el.className = 'traceNone';
        el.textContent = 'no generation trace yet — this is the SKELETON, the bordered '
            + 'room and its goal before any template was drawn (⚖ the loop\'s own control)';
        box.appendChild(el);
        return { rows: 0 };
    }
    for (const r of rows) {
        const el = document.createElement('div');
        el.className = `tr past${r.outcome === 'KEPT' ? ' kept' : ''}`;
        el.innerHTML = `<b>${r.label}</b> <span class="s">${r.template}</span>`
            + (r.at ? ` <span class="g">${r.at}</span>` : '')
            + ` → <span class="${r.outcome === 'KEPT' ? 'g' : 'o'}">${r.outcome}</span>`
            + (r.verdict ? ` <span class="rj">${r.verdict}</span>` : '')
            + (r.ticks !== null ? ` <span class="rj">${r.ticks}t</span>` : '')
            + (r.classifiedBy ? `<div class="rj">by: ${r.classifiedBy}</div>` : '')
            + (r.reasonText ? `<div class="rj">${r.reasonText}</div>` : '');
        box.appendChild(el);
    }
    return { rows: rows.length };
}

/**
 * ── ⛓⛓⛓ THE FOURTH SOURCE: GENERATE ONE, LOOK AT IT, KEEP STEPPING ─────
 *
 * ⚖ Kickoff §3.5 and ruling §1.3: seed + biome + obstacle-count target (+
 * budget) → the Cloudberry loop runs IN THE PAGE. STEP places one template
 * and re-solves; RUN-ALL runs to the target or to saturation, and the display
 * updates after EVERY placement — the current level drawn, the LATEST SOLVE's
 * path layers over it, and the verdict / kept-or-reverted template / verbatim
 * refusal as pane rows.
 *
 * ⛔ ALL THREE OF THE PAGE'S LAWS SURVIVE IT, and each bites somewhere:
 *
 * NO CLAIM: a generated level is never written to `fixtures/` (the roster is
 * disk-derived, so a saved experiment would silently join the differential).
 * It lives in the box, in a download and in your hands. No gate consumes it —
 * the acceptance batch runs the same loop from a script.
 *
 * RAW TRUTH: the loop's refusals arrive VERBATIM; a saturated run says
 * SATURATED and names the bound that ended it; a `?gen=` payload that
 * disagrees with what this page generated is REPORTED rather than redrawn;
 * and the display solve is compared against the trace row that accepted the
 * record, because "they must agree" is a claim and not an excuse to skip it.
 *
 * NO PRIVATE TICK LOOP: the walk is `solveSegment`'s, folded by the one fold,
 * scrubbed by the one stepper — `replayTape`, unchanged, exactly as SOLVE and
 * MANUAL reach it. ⛓ WITH ONE OPTION: the scrub is told the tape came from a
 * SCRATCH solve (§13.4's residue; see `createTapeStepper`'s docblock). That
 * is the one caller in the codebase that passes it.
 *
 * ⛔ AND NO SECOND GENERATOR LOOP. STEP is "obstacleTarget = k, re-run" —
 * see `watchGenerate`'s docblock for the prefix property that makes it sound
 * and for the O(N²) price it costs, which is stated before it is spent.
 */
async function runGenerate(params, lifetime) {
    const gp = params.gen;
    let seed = gp.seed;
    let biome = gp.biome;
    let bounds = { ...gp.bounds };
    const budget = { ...gp.budget };

    /**
     * ⛓ `?gen=` — a payload emitted by `generate-seedling-level.mjs`, whose
     * seed/biome/count REPLACE the URL's. The page then generates and
     * COMPARES (⚖ `agreementWithPayload`): one path into the page, and the
     * export becomes a cross-runtime determinism check rather than a picture
     * of a file.
     */
    let payload = null;
    /**
     * ⛓ Set once, when a press takes the URL back off `?gen=` — so the detail
     * line can say the reproduction claim GONE rather than just stop printing
     * it. See `writeGenerateParams`' docblock for why the two cannot coexist.
     */
    let payloadDropped = false;
    if (gp.gen) {
        payload = await fetchJson(gp.gen.startsWith('/') ? gp.gen : `/${gp.gen}`,
            'the generated payload');
        seed = payload.seed;
        biome = payload.biome;
        bounds = { ...bounds, ...(payload.bounds ?? {}) };
    }

    $('genSeed').value = String(seed);
    $('genCount').value = String(bounds.obstacleTarget);
    $('genTries').value = String(bounds.triesPerStep);
    $('genK').value = String(bounds.saturationK);
    const biomeSel = $('genBiome');
    biomeSel.innerHTML = BIOME_NAMES
        .map((b) => `<option value="${b}">${b}</option>`).join('');
    biomeSel.value = biome;

    const atlas = await loadAtlas();
    /**
     * ⛔ THE PAGE'S ATLAS IS FETCHED AND THEN NOT USED FOR THE LEVEL — a
     * generated room is not in it. `atlasOf(record)` wraps the ONE record in
     * the atlas shape `levelSourceFromAtlas` takes (⚖ kickoff §2: the
     * atlas-record JSON IS the PoC's level format), which is exactly what
     * `procgenOracle` does on the other side of the seam. The real atlas is
     * still fetched because the TAPE I/O and the loaded-tape path below need
     * a source for committed levels.
     */
    const atlasSource = levelSourceFromAtlas(atlas);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, atlasSource, null)
        .catch((e) => fatal('the loaded tape would not replay', e.stack || e.message));

    let step = 0;
    let state = null;
    let lastPayload = null;

    const cost = ladderCost(bounds, 139);
    $('genNote').textContent = cost.why;

    const busy = (on) => {
        for (const id of ['genStep', 'genRunAll', 'genReset']) $(id).disabled = on;
    };

    /**
     * ONE DISPLAY UPDATE, called after EVERY placement (⚖ ruling §1.3).
     *
     * ⚠ IT RETURNS THE READOUT RATHER THAN SETTING IT, so RUN-ALL can decide
     * what to do next from the same object the acceptance row reads.
     */
    async function show(why) {
        const t0 = performance.now();
        const solved = displaySolve(state);
        const solveMs = Math.round(performance.now() - t0);
        const agreement = agreementWithTrace(state, solved);
        const genRows = generationRows(state.trace);
        const paneReadout = mountGenerationPane(genRows);
        lastPayload = {
            generator: 'frontend/modules/seedlingDemo/watchViewer.js (SOURCE = GENERATE)',
            seed,
            biome,
            bounds: state.bounds,
            budget: state.budget,
            summary: state.summary,
            level: state.record,
            trace: state.trace,
        };
        const label = `generated-s${seed}-${biome}-step${step}`;
        $('title').textContent = `${label} — the Cloudberry loop, in this page`;

        if (solved.verdict !== 'SOLVED') {
            /**
             * ⛔ A REFUSED DISPLAY SOLVE IS A DISAGREEMENT, NOT A VIEW. Every
             * record on the ladder is one the LOOP accepted, so a refusal here
             * means the same room answered two ways. Reported with the
             * solver's own text; nothing is drawn over the last good frame.
             */
            fatal(`the DISPLAY solve of step ${step} came back ${solved.verdict} — the loop `
                + 'KEPT this record, so the same room has answered two ways',
                `${solved.reasonText ?? solved.classifiedBy ?? '(no text)'}`);
            window.__editorGenerate = {
                status: 'refused', step, seed, biome,
                verdict: solved.verdict, message: solved.reasonText ?? null,
            };
            return { solved, agreement, drew: false };
        }

        const levelSource = levelSourceFromAtlas(atlasOf(state.record));
        const { frames } = await replayTape(solved.tape, label, params, levelSource,
            { trace: solved.trace, why: null }, solved.dangerQueries,
            // ⛓ THE SCRUB FORK — see `replayTape`'s own note. This arm is the
            // one caller: the tape it is scrubbing came from a scratch solve.
            { scratchPersistence: true });

        $('status').className = 'ok';
        $('status').textContent = `${label} — ${frames.length} observations, `
            + `${solved.ticks} ticks${why ? ` · ${why}` : ''}`;
        $('detail').textContent = `${describeState(state, solved)}  ·  display solve `
            + `${solveMs} ms`
            + (agreement.compared
                ? `  ·  trace/display agreement: ${agreement.agrees ? 'YES' : 'NO'}`
                : '')
            + (agreement.agrees ? '' : `  ·  ⛔ ${agreement.why}`)
            + (payload
                ? `  ·  ?gen= reproduction: ${payload.__check?.agrees === false
                    ? `⛔ DIFFERS in [${payload.__check.differences.join(', ')}]`
                    : (payload.__check ? 'byte-identical' : '(checked at the target)')}`
                : (payloadDropped
                    // ⚠ SAID, not silently done. The reproduction line above was a
                    // statement about the payload's run; this is no longer that run,
                    // so the claim goes and its absence is explained where it stood.
                    ? '  ·  ?gen= was DROPPED at the press — this level is the page\'s own '
                        + 'run and the URL now names it explicitly'
                    : ''));

        /**
         * The page's own readout, for `check-seedling-editor-generate.mjs`.
         * ⛔ Every bound that ran is in it — a readout that named the level
         * and not the bounds would let a batch quote a number nobody could
         * reproduce (⚖ kickoff §5).
         */
        window.__editorGenerate = {
            status: 'ok',
            seed,
            biome,
            step,
            bounds: state.bounds,
            budget: state.budget,
            stop: state.stop,
            saturated: state.saturated,
            keptCount: state.summary?.keptCount ?? 0,
            attempts: state.summary?.attempts ?? 0,
            genRows: genRows.length,
            paneRows: paneReadout.rows,
            vetoes: genRows.filter((r) => r.outcome !== 'KEPT')
                .map((r) => ({ label: r.label, template: r.template, outcome: r.outcome,
                    verdict: r.verdict, reasonText: r.reasonText })),
            verdict: solved.verdict,
            ticks: solved.ticks,
            certified: solved.certification?.certified ?? null,
            strategies: (solved.records ?? []).map((r) => r.strategy),
            scratchClears: solved.scratchClears ?? [],
            frames: frames.length,
            agreement,
            payloadCheck: payload?.__check ?? null,
        };
        window.__editorGenerated = lastPayload;
        // ⛓ THE BRIDGE IS ARMED ONLY BY A DRAWN LEVEL. A refused display
        // solve returns above this line, so the buttons can never hand over a
        // room the page could not show — the one state in which "solve this
        // level" would mean two different rooms.
        /**
         * ── ⛓⛓⛓ THE DRAWN LEVEL **IS** THE PAGE'S LEVEL (group A, item 1) ──
         *
         * ⛔ HANDING OVER IS NOT A BUTTON ANY MORE, IT IS A CONSEQUENCE OF
         * DRAWING. Slice 4 armed the bridge on the two buttons alone, which
         * left the obvious route broken: switching GENERATE → MANUAL with the
         * SOURCE SELECTOR found an empty boot box, fell back to `?boot=`, and
         * dropped you at the true game start in level 0 — the generated room
         * you were looking at simply gone. The buttons and the selector are
         * two ways of saying the same thing, so they must leave the same state
         * behind.
         *
         * ⚠ THE PRICE IS STATED, because it is a real one: a block you typed
         * by hand in SOLVE is REPLACED the moment GENERATE draws a level. That
         * is the honest reading of "this is the page's current level", and the
         * note below says so where it happens rather than leaving you to
         * discover it two switches later.
         */
        heldGeneratedLevel = {
            record: state.record, seed, biome, step, bounds: state.bounds, budget: state.budget,
        };
        // ⛔ THE GENERATOR'S OWN BLOCK, through `displayStaging` — pins
        // included. Building one here would be a second staging for the same
        // room, differing exactly where it matters least visibly.
        $('bootBox').value = JSON.stringify(displayStaging(state), null, 4);
        /**
         * ⛔ AND THE MODEL'S OWN GOAL WITH IT. The receiving arm builds its
         * defaults from the level's CENSUS, which is not the list the
         * generator certified against — the model names one goal
         * (`collectGoal(goalOel)`) and a census can offer several. Without
         * this the other arm walks a question that LOOKS like the certified
         * one, silently. `?boot=`/`?level=` go, so a stale committed tape
         * cannot be re-read over the handed level.
         */
        const q = new URLSearchParams(window.location.search);
        q.set('goals', formatGoalsParam(state.model.goals));
        q.delete('boot');
        q.delete('level');
        /**
         * ── ⛓⛓⛓ AND THE FORM'S OWN VALUES WITH THEM (slice 1) ─────────
         *
         * ⛔ THE PANEL USED TO EDIT LOCAL VARIABLES AND NOTHING ELSE. Seed
         * 3 → 9, press RUN-ALL, and the address bar still said `?seed=3`:
         * the link named a level the page was not showing, on a page whose
         * ONLY persistence is the URL. `writeGenerateParams` is the single
         * writer and `readGenerateParams` the single reader — see that
         * docblock for why `count` is `state.bounds.obstacleTarget`, why
         * `run` is deleted rather than zeroed, and what `?gen=` does here.
         *
         * ⚠ WRITTEN FROM `state`, NOT FROM THE FORM. `show()` runs after the
         * generation, so the state holds the arguments the record on screen
         * was ACTUALLY made with — the form is where they came from, but it
         * is the run that the link has to name.
         */
        const search = writeGenerateParams(q.toString(), {
            seed: state.seed,
            biome: state.biome,
            bounds: state.bounds,
            step,
            payloadOwned: Boolean(payload),
        });
        window.history.replaceState(null, '', `${window.location.pathname}?${search}`);

        $('genToSolve').disabled = false;
        $('genToManual').disabled = false;
        $('genBridgeNote').textContent = `step ${step} (seed ${seed}, ${biome}) IS the page's `
            + 'current level: the shared starting-conditions block now holds it, so SOLVE and '
            + 'MANUAL take it however you reach them — these buttons or the SOURCE selector. '
            + '⚠ A block you had typed by hand was replaced.';
        return { solved, agreement, drew: true };
    }

    /**
     * ── ⛓⛓⛓ HAND THIS LEVEL TO ANOTHER ARM ───────────────────────────
     *
     * ⚠ WHAT DOES **NOT** RIDE: the level. `?seed=` still describes the
     * GENERATION, so the address bar keeps pointing at the thing that IS
     * reproducible, and the arms say out loud that they are holding a room
     * the URL does not name.
     */
    /**
     * The buttons are now SHORTCUTS, not the mechanism — `show()` has already
     * left the level, the block and the goal where any route to another arm
     * will find them. Kept because "SOLVE this level" is what you actually
     * want to say, and hunting the SOURCE selector to say it is friction.
     */
    const handOver = (source) => (state?.record ? switchArm(source) : undefined);
    $('genToSolve').onclick = () => handOver('solve');
    $('genToManual').onclick = () => handOver('manual');

    /**
     * ⛔ READ THE FORM, AND RESET THE LADDER IF ITS IDENTITY CHANGED.
     *
     * The seed IS the level's identity (⚖ kickoff §5). Pressing STEP after
     * retyping the seed must not continue somebody else's ladder: step 3 of
     * seed 9 followed by step 4 of seed 10 is a display that has never shown
     * a level any single run produces. So a changed seed or biome RESETS to
     * the skeleton and SAYS so — the same shape as the SOLVE arm re-reading
     * its own textarea at press time (⛓ slice 5 of the editor arc, whose
     * whole finding was a control that edited a value nobody read).
     */
    function readForm() {
        /**
         * ⛔ AND THE PAYLOAD STOPS OWNING THE URL HERE, AT THE FIRST PRESS.
         *
         * `?gen=` is an IDENTITY: it names a file whose seed/biome/bounds
         * REPLACE the URL's, so a URL carrying both it and the form's values
         * would hold two spellings of one run — exactly what this slice
         * exists to end. A press means the state on screen is the page's own
         * from now on (the step it reaches, under the bounds the form now
         * holds), so `gen` goes and the explicit parameters take over.
         *
         * ⚠ THE PRESS, NOT THE EDIT. "Did the form move away from the
         * payload's values" would be a THIRD place that knows what the
         * payload's identity is, and it would still have to answer for a
         * press that changes the STEP without changing a field.
         */
        payloadDropped = payloadDropped || Boolean(payload);
        payload = null;
        const nextSeed = Number($('genSeed').value);
        const nextBiome = $('genBiome').value;
        const reset = nextSeed !== seed || nextBiome !== biome;
        seed = nextSeed;
        biome = nextBiome;
        bounds = {
            obstacleTarget: Number($('genCount').value),
            triesPerStep: Number($('genTries').value),
            saturationK: Number($('genK').value),
        };
        return reset;
    }

    async function goTo(target, why) {
        busy(true);
        try {
            if (step >= target) {
                // ⚠ SAID, not silently nothing. "The button did nothing" is
                // the one outcome a user cannot act on.
                $('status').className = '';
                $('status').textContent = `already at step ${step}, and the obstacle target `
                    + `is ${target} — raise the target, or press RESET to start over`;
                return;
            }
            for (let k = step + 1; k <= target; k += 1) {
                /**
                 * ⛔ THE DRIVER IS A LOOP TOO, and it is the one that spends
                 * SECONDS per iteration. It yields to the frame below, so a
                 * switch can land in the middle of a RUN-ALL — and a retired
                 * arm that kept going would generate levels nobody asked for
                 * and paint them over whatever now owns the canvas. Checked
                 * after every await, which is where ownership can have moved.
                 */
                if (!lifetime.alive()) return;
                $('status').className = '';
                $('status').textContent = `generating step ${k} of ${target} `
                    + `(seed ${seed}, ${biome})…`;
                // Yield a frame so the status paints BEFORE the synchronous
                // loop takes the thread — without it the page looks frozen
                // with the old text on it, which is a lie about what it does.
                await new Promise((r) => requestAnimationFrame(r));
                if (!lifetime.alive()) return;
                state = generateStep({ seed, biome, step: k, bounds, budget });
                step = k;
                const out = await show(why);
                if (!out.drew) return;
                if (state.saturated) {
                    $('status').textContent += `  ·  SATURATED — ${bounds.saturationK} `
                        + 'consecutive step(s) kept nothing, so the loop stopped short of '
                        + `the target of ${bounds.obstacleTarget}`;
                    break;
                }
            }
        } finally {
            busy(false);
        }
    }

    const resetToSkeleton = async (why) => {
        step = 0;
        state = generateStep({ seed, biome, step: 0, bounds, budget });
        await show(why);
    };
    $('genStep').onclick = async () => {
        if (readForm()) await resetToSkeleton('the seed or biome changed — RESET to the '
            + 'skeleton, because the seed IS the level\'s identity');
        return goTo(Math.min(step + 1, bounds.obstacleTarget), 'STEP');
    };
    $('genRunAll').onclick = async () => {
        if (readForm()) await resetToSkeleton('the seed or biome changed — RESET to the '
            + 'skeleton, because the seed IS the level\'s identity');
        return goTo(bounds.obstacleTarget, 'RUN-ALL');
    };
    $('genReset').onclick = async () => {
        readForm();
        await resetToSkeleton('RESET — the skeleton');
    };
    /**
     * ⛔ THE DOWNLOAD IS THE CLI'S OWN PAYLOAD SHAPE, so a level generated in
     * the page can be handed straight back to `--gen=` (and to the batch's
     * report). A second shape here would be a second thing to keep in step.
     */
    $('genDownload').onclick = () => {
        if (!lastPayload) return;
        const blob = new Blob([`${JSON.stringify(lastPayload, null, 2)}\n`],
            { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `generated-s${seed}-${biome}-c${step}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    // ── the skeleton, before anything is drawn ───────────────────────────
    state = generateStep({ seed, biome, step: 0, bounds, budget });
    await show('the SKELETON');

    if (gp.run || payload) {
        await goTo(bounds.obstacleTarget, payload ? '?gen= reproduction' : 'RUN-ALL (?run=1)');
        if (payload) {
            /**
             * ⛔ CHECKED AT THE TARGET AND REPORTED EITHER WAY. A payload that
             * matches is a determinism statement across node and the browser;
             * one that does not is a FINDING, and the page keeps showing what
             * IT generated.
             */
            payload.__check = agreementWithPayload(payload, state);
            await show(payload.__check.agrees
                ? '?gen= reproduced byte-identically'
                : `⛔ ?gen= DIFFERS in [${payload.__check.differences.join(', ')}]`);
        }
    }
}

// ── side=wasm ────────────────────────────────────────────────────────────

/**
 * Drive the recompiled game in an iframe.
 *
 * Same origin, so `frame.contentWindow.__swfBridge.game.*` is reachable
 * from here — which is what lets this page add nothing to the gitignored
 * deploy artifact. ZERO changes there, ZERO AS3.
 *
 * ⚠ ONE REAL CLICK IS REQUIRED before starting. The runtime wants user
 * activation, and the existing Playwright driver clicks `#btn-start` for
 * exactly this reason; a page that tried to autostart would hang with no
 * visible cause.
 */
async function runWasm(params, lifetime) {
    const tape = await fetchJson(`/${params.tape.replace(/^\/+/, '')}`, 'tape');

    // Say WHICH path is missing rather than showing a blank frame — the
    // artifact is gitignored and machine-local, so "nothing happened" is the
    // expected experience on a fresh checkout.
    const probe = await fetch(WASM_PAGE, { method: 'HEAD' }).catch(() => null);
    if (!probe || !probe.ok) {
        fatal('the wasm build is not on this machine',
            `${WASM_PAGE} is missing (HTTP ${probe ? probe.status : 'unreachable'}). `
            + 'It is gitignored and built locally — see '
            + '~/CC/seedling_bot_build/build_bot.sh. Use &side=js meanwhile.');
        return;
    }

    const frame = $('frame');
    frame.src = WASM_PAGE;
    frame.style.display = 'block';
    $('canvas').style.display = 'none';
    $('status').textContent = 'loading the runtime…';
    /**
     * ⛓⛓ THE ONE TEARDOWN THE RELOAD WAS ACTUALLY PROTECTING.
     * `populatePicker`'s docblock states it: the wasm side cannot rewind the
     * GAME — `botReset` forgets the tape, not the world — so every tape needs
     * a fresh runtime. `about:blank` gives it one: the iframe's document is
     * discarded, which takes the runtime, its own rAF chain and its audio
     * with it. That is the whole of the wasm side's claim on a page reload,
     * and it is satisfiable from here.
     */
    lifetime.onRetire(() => {
        frame.src = 'about:blank';
        frame.style.display = 'none';
        $('canvas').style.display = '';
    });

    const win = () => frame.contentWindow;
    const bot = (name, arg) => {
        const g = win() && win().__swfBridge && win().__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return arg === undefined ? g[name]() : g[name](arg);
    };
    const botJson = (name, arg) => {
        const raw = bot(name, arg);
        try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    };
    /**
     * ⚠ A THREE-MINUTE POLL IS A LOOP WITH A LONG FUSE. Retired, it would go
     * on asking a discarded iframe for `__runtimeReady` every 200 ms and then
     * TIME OUT under some other arm, painting a wasm refusal over whatever
     * that arm had drawn. So the chain stops with the lifetime, and the
     * promise REJECTS rather than hanging: an `await` nobody will ever
     * resolve is a leak that looks like a slow load.
     */
    const until = (what, pred, ms = 180000) => new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = lifetime.guard('wasm-until', () => {
            let v = null;
            try { v = pred(); } catch { v = null; }
            if (v) return resolve(v);
            if (Date.now() - t0 > ms) return reject(new Error(`timed out waiting for ${what}`));
            return setTimeout(tick, 200);
        });
        lifetime.onRetire(() => reject(new Error(
            `the wasm arm was retired while waiting for ${what}`)));
        tick();
    });

    await until('__runtimeReady', () => win() && win().__runtimeReady);

    // ⚠⚠ THE PARENT MUST NOT START THE GAME. NOT EVEN AS A FALLBACK.
    //
    // The frame's start path is
    //     __swfBridgeStart = function () {
    //         if (started || !__runtimeReady) return false;
    //         started = true;
    //         btn.style.display = 'none';
    //         Module.ccall('runSWF', ...);
    //     }
    // and its own comment says it "MUST run within a user-gesture handler in
    // this document (WebGPU renderer init + AudioContext consume the
    // activation)".
    //
    // A first cut here called `btn.click()` from the parent as a harmless-
    // looking convenience. It is not harmless: it LATCHES `started = true`
    // and HIDES the button, so `runSWF` is invoked with no user activation
    // (the renderer never comes up, `game.botStatus` never appears) AND the
    // user's real click is now impossible — the button is gone and the latch
    // refuses a second start. It burns the one chance it was trying to save.
    // The symptom is maximally unhelpful: `__swfBridge.game` exists, so the
    // shim looks fine, and the wait just spins.
    //
    // So the parent does exactly nothing here except ask, and poll.
    $('play').style.display = 'none';
    $('status').textContent = 'runtime ready — press ▶ Start inside the frame below. '
        + 'One REAL click: the renderer and the audio context consume the user '
        + 'activation, and nothing this page can do substitutes for it.';

    try {
        await until('the game\'s bot callbacks (press Start in the frame)',
            () => bot('botStatus') !== null);
    } catch (e) {
        fatal('the tape never started', `${e.message}. The frame is up but the SWF `
            + 'has not begun, which is what a missed Start looks like.');
        return;
    }

    try {
        const loaded = bot('botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
    } catch (e) {
        fatal('could not start the tape', e.message);
        return;
    }
    $('status').className = 'ok';
    $('status').textContent = `${params.tape} — running in the real game`;
    /**
     * ⚠ THE WRAPPER CALLS `poll` THROUGH AN ARROW rather than wrapping it
     * directly, for the same temporal-dead-zone reason the note below gives:
     * `poll` is hoisted and readable here, but only from inside a body that
     * runs later.
     */
    const pollTick = lifetime.guard('wasm-poll', () => poll());
    pollTick();

    // A function DECLARATION, not a const arrow: `poll()` is called above
    // this line and a `const` would be in its temporal dead zone. Caught by
    // the real-GPU Windows run, which is the only place the wasm path gets
    // far enough to execute it.
    function row(k, v) { return `<div class="r"><span>${k}</span><b>${v}</b></div>`; }
    function poll() {
        const st = botJson('botStatus');
        if (st) {
            const pct = Math.round(100 * (st.tick ?? 0) / Math.max(1, tape.tick_count));
            $('bar').style.width = `${pct}%`;
            const items = st.items || {};
            $('hud').innerHTML = [
                row('tick', `${st.tick ?? '?'} / ${tape.tick_count}`),
                row('level', st.level ?? '?'),
                row('position', `${fmt(st.x)}, ${fmt(st.y)}`),
                // Shown, not elided: the fade frames are real frames the
                // tick counter skips, and how many there were is a fact
                // about the run.
                row('dead frames', st.dead_frames ?? 0),
                row('receive input', String(st.receive_input)),
                row('saw input refused', String(st.saw_input_refused)),
                row('auto advance', st.saw_auto_advance ?? 0),
                row('grants', (st.grants || [])
                    .map((g) => `L${g.level} ${(g.items || []).join('+')}@${g.t}`).join(' ') || '—'),
                row('items', Object.entries(items)
                    .filter(([k, v]) => v === true && k !== 'hitsMax')
                    .map(([k]) => k).join(' ') || '—'),
                row('hitsMax', items.hitsMax ?? '?'),
                row('finished', String(st.finished)),
            ].join('');
            if (st.finished) {
                $('status').textContent += ' — finished';
                return;
            }
        }
        setTimeout(pollTick, 250);
    }
}

// ── entry ────────────────────────────────────────────────────────────────

/** Where to look for sibling tapes when no `?tape=` names a directory. */
const DEFAULT_TAPE_DIR = 'frontend/modules/seedlingDemo/fixtures/tapes';

/**
 * List the tapes next to the one being watched, and offer them.
 *
 * Read from the dev server's own DIRECTORY LISTING rather than from a
 * committed manifest, deliberately: slice 4 records segment tapes as it
 * goes, and a manifest would be stale between the recording and the
 * regeneration that noticed. The listing is the live truth, and if the
 * server does not emit one (a different static host) the picker says so and
 * the page still works from `?tape=` alone.
 *
 * The directory comes from the CURRENT tape's own path, so a roster kept
 * somewhere other than `fixtures/tapes/` lists its own siblings without a
 * second parameter.
 */
/**
 * Every tape in a directory, fetched ONCE.
 *
 * ⛓ Both consumers want the same bytes: the picker wants a one-line
 * summary per tape and the SOLVE arm wants each tape's staging block for
 * the presets dropdown. The picker used to fetch the roster for its labels
 * and nothing kept the second consumer from fetching it all over again —
 * so the fetch moved here and both read one index.
 *
 * `{records, error}` rather than a throw: a static host with no directory
 * listing is a working page with no picker, not a broken page.
 */
async function loadTapeIndex(dir) {
    let names = [];
    try {
        const res = await fetch(`/${dir}/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        names = [...html.matchAll(/href="([^"?/]+\.json)"/g)]
            .map((m) => decodeURIComponent(m[1]))
            .filter((n, i, a) => a.indexOf(n) === i)
            .sort();
    } catch (e) {
        return { dir, records: [], error: `could not list /${dir}/: ${e.message}` };
    }
    const records = await Promise.all(names.map(async (n) => {
        const name = n.replace(/\.json$/, '');
        try {
            return { name, file: n, path: `${dir}/${n}`, tape: await (await fetch(`/${dir}/${n}`)).json() };
        } catch (e) {
            // Kept in the list WITHOUT a tape: the file exists, and a
            // roster that hid the one it could not read would be lying
            // about its own size.
            return { name, file: n, path: `${dir}/${n}`, tape: null, why: e.message };
        }
    }));
    return { dir, records, error: null };
}

async function populatePicker(params, index) {
    const sel = $('tapes');
    const dir = index.dir;
    if (index.error) {
        sel.innerHTML = '<option>— no directory listing —</option>';
        sel.disabled = true;
        sel.title = `${index.error}. The page still works from ?tape= directly.`;
        return;
    }

    // A one-line summary per tape, from the tape itself: what it boots into
    // and how long it runs are the two things you pick on.
    const summarise = (r) => {
        const t = r.tape;
        if (!t) return `${r.name} — ⚠ unreadable (${r.why})`;
        const relaxed = (t.noHazards || []);
        const pit = t.tape_version === 2 && !relaxed.includes('pit') ? ' pit-LIVE' : '';
        return `${r.name} — L${t.boot?.level ?? '?'}, `
            + `${t.tick_count} ticks, v${t.tape_version}${pit}`;
    };
    const names = index.records.map((r) => r.file);
    const labels = index.records.map(summarise);

    sel.innerHTML = '';
    names.forEach((n, i) => {
        const o = document.createElement('option');
        o.value = `${dir}/${n}`;
        o.textContent = labels[i];
        if (o.value === (params.tape || '').replace(/^\/+/, '')) o.selected = true;
        sel.appendChild(o);
    });
    sel.disabled = false;
    /**
     * Load on select. A full navigation rather than an in-place swap: the
     * wasm side cannot rewind the GAME (`botReset` forgets the tape, not the
     * world — every tape needs a fresh page, which is the same rule the
     * recording harness follows).
     *
     * ⚠ THE SECOND HALF OF THIS REASON IS SPENT, AND THE FIRST IS NOT. It
     * used to add "and reloading keeps both sides on one code path instead of
     * giving the JS side a teardown nobody tests" — the switch arc built that
     * teardown and a browser row tests it, so that argument is gone. What
     * stands is the wasm one, and picking a tape stays a navigation for a
     * second reason worth keeping: it is an explicit "load something else",
     * and the reload is what lets it BEAT the block `stagingForMount` would
     * otherwise keep.
     */
    sel.onchange = () => {
        const q = new URLSearchParams(window.location.search);
        q.set('tape', sel.value);
        q.set('side', params.side);
        window.location.search = q.toString();
    };
}

/**
 * Which panels belong to an arm. ONE TABLE, read on mount and on switch.
 *
 * ⛓ THE BOOT PANEL IS SHARED, so it is shown for BOTH arms that start from a
 * staging block and only the ACTIONS beside it change. That is the visible
 * half of "one box, one block": the panel does not blink out and back when
 * you move between SOLVE and MANUAL, because it is the same panel.
 */
const PANELS = Object.freeze({
    replayPick: (s) => s === 'replay',
    bootPanel: (s) => s === 'solve' || s === 'manual',
    solveActions: (s) => s === 'solve',
    solveGoalLine: (s) => s === 'solve',
    manualActions: (s) => s === 'manual',
    generatePanel: (s) => s === 'generate',
    // ⛓ The generation pane only exists for the arm that produces one — a
    // permanently empty "GENERATION TRACE" heading on the REPLAY page would
    // be a channel with nothing in it and no way to tell why.
    genTraceSection: (s) => s === 'generate',
});

function showPanelsFor(source) {
    for (const [id, belongs] of Object.entries(PANELS)) $(id).hidden = !belongs(source);
}

/**
 * ── ⛓⛓⛓ THE SOURCE SELECTOR — AND IT NO LONGER NAVIGATES ─────────────
 *
 * ⚠ THE URL IS STILL WRITTEN, through `replaceState` instead of assignment.
 * "Every view is a link" was the reason the selector navigated, and it is
 * kept exactly: copy the address bar after a switch and it opens the arm you
 * are looking at. What changed is that the DOCUMENT survives — so the boot
 * box you edited, the tape you pasted and the goals you picked are all still
 * there when you come back, which is the entire point (⛓ `stagingForMount`).
 *
 * ⛔ AND THE URL IS WRITTEN BEFORE THE ARM MOUNTS, because the arm reads its
 * parameters back out of it (`readParams`). Mounting first would mount the
 * arm you left.
 *
 * ⚠ `replaceState` AND NOT `pushState`: back would otherwise walk the arms
 * you have visited without restoring what any of them held, since the state
 * that makes them different lives in the document. A history entry that
 * cannot be honoured is worse than none.
 */
function wireSourceSelector(params, onSwitch) {
    const sel = $('source');
    sel.value = params.source;
    showPanelsFor(params.source);
    sel.onchange = () => onSwitch(sel.value);

    // ⛓ The engine picker rides the same switch — REPLAY-only, because the
    // other three arms build JS worlds and the wasm side builds none.
    const sideSel = $('side');
    sideSel.value = params.side;
    sideSel.onchange = () => onSwitch('replay', sideSel.value);
}

/** `replay-js` and `replay-wasm` are two machines with two teardowns. */
const armNameFor = (params) =>
    (params.source === 'replay' ? `replay-${params.side}` : params.source);

/**
 * ⛓ THE FOUR ARMS, AS ONE TABLE — the runner and the readout key an arm's
 * REFUSAL is written to.
 *
 * ⚠ THE KEYS ARE THE BROWSER ROWS' VOCABULARY (`__editorSolve` and friends),
 * so they are named here rather than constructed: a row that polls for one of
 * these by name is asserting against the arm it thinks it is.
 *
 * ⚠ AND THE SELECTION RULES STAY IN THEIR PARAMETER READERS. Nothing here
 * INFERS an arm — `readSolveParams` and `readGenerateParams` already decide
 * that, and for stated reasons (MANUAL and GENERATE are asked for by name
 * because a stale URL must not land in an arm that waits for a press or
 * spends seconds per press).
 */
const ARMS = Object.freeze({
    solve: { run: runSolve, readout: '__editorSolve' },
    generate: { run: runGenerate, readout: '__editorGenerate' },
    manual: { run: runManual, readout: '__editorManual' },
});

/**
 * ── ⛓⛓⛓ MOUNT THE ARM `params` NAMES, AGAINST A LIFETIME ──────────────
 *
 * ⚠ ONE ENTRY, and it is the seam the in-place SOURCE switch is built on: a
 * switch is `mountArm` again with a different `source`, and the lifetime
 * started here is what retires the arm being left.
 *
 * ⛔ THE ARM'S OWN REFUSAL GOES THROUGH `lifetime.report`. An arm can fail
 * AFTER it has been retired — every one of these paths awaits a fetch — and
 * `fatal` paints the shared status bar, so a dead arm's refusal would
 * overwrite the live arm's readout with a message that is true about nothing
 * on screen. Reported this way it is kept on the retired lifetime instead,
 * where the readout still shows it.
 */
async function mountArm(params, lifetime) {
    const arm = ARMS[params.source];
    if (arm) {
        // ⚠ NO PICKER FETCH FOR THESE THREE. `runSolve` starts the roster
        // load itself and does not await it — a solve with `?boot=` given
        // should not wait on 150 tapes it is not going to read.
        try {
            await arm.run(params, lifetime);
        } catch (e) {
            lifetime.report(`the ${params.source} arm failed: ${e.message}`, () => {
                fatal(`the ${params.source} arm failed`, e.stack || e.message);
                window[arm.readout] = { status: 'refused', message: e.message };
            });
        }
        /**
         * ⛓⛓ "THE MOUNT FINISHED" IS A FACT NOTHING ELSE STATED, and it was
         * the browser row that needed it: a row waiting for the arriving arm
         * by watching its boot box waits for a box that is ALREADY FULL —
         * `stagingForMount` keeps it across the switch — so the wait returns
         * instantly and the row reads the OUTGOING arm's page. It went green
         * on a note that had not been written yet.
         *
         * ⚠ Written only while this arm still owns the page, and carrying the
         * lifetime's generation, so "which mount is this" has an answer that
         * two mounts of the same arm cannot blur.
         */
        if (lifetime.alive()) {
            window.__editorArm = {
                source: params.source, arm: lifetime.name, generation: lifetime.generation,
            };
        }
        return;
    }

    $('title').textContent = params.tape || '(no tape)';
    // The picker is populated even with no tape, so the page is a launcher
    // rather than an error when you arrive without one.
    const dir = params.tape
        ? params.tape.replace(/^\/+/, '').split('/').slice(0, -1).join('/')
        : DEFAULT_TAPE_DIR;
    const picking = loadTapeIndex(dir).then((index) => populatePicker(params, index));
    if (!params.tape) {
        await picking;
        lifetime.report('no ?tape= given', () => fatal(
            'no ?tape= given — pick one above, or switch source to SOLVE',
            'watch.html?tape=frontend/modules/seedlingDemo/fixtures/tapes/'
            + 'pit-fall-chain-85.json&side=js'));
        /**
         * ⛓⛓⛓ …AND IT STILL DRAWS A LEVEL. ⚖ THE USER'S REPORT: *"when the
         * page first loads, it doesn't load and display the level"*.
         *
         * ⛔ THIS WAS THE ONE ARM THAT DID NOT, AND IT IS THE ONE YOU LAND ON.
         * Group A's item was "every arm draws its level on mount" and SOLVE,
         * MANUAL, GENERATE and a REPLAY-with-a-tape all do — MEASURED at
         * 102400/102400 opaque pixels each. A bare `watch.html` is REPLAY with
         * no `?tape=`, which reported the missing parameter and RETURNED, so
         * the default entry point to the page was the only black canvas on it.
         *
         * ⛔⛔ IT DRAWS THE TRUE GAME START, WHICH IS NOT A TAPE AND IS NOT A
         * GUESS. `trueStartStaging` is the same block `stagingForMount` hands
         * SOLVE and MANUAL when nothing else is named — the committed boot of
         * `TRUE_START_SEGMENT` — so this is the page's existing answer to
         * "where does the game begin", drawn instead of withheld. No tape is
         * invented, no run is stepped, and `previewLevel` hands every history
         * channel an EMPTY array: it is a still frame of a room, which is
         * exactly what the other arms put up.
         *
         * ⚠ THE REFUSAL SURVIVES INTACT AND IS REPORTED FIRST. "There is no
         * tape here" is still true and still on screen; what changes is that
         * the reader can see the room the picker is about to launch them into.
         * A drawing that had REPLACED the message would be a page pretending
         * to have loaded something.
         *
         * ⚠ `side=wasm` IS EXCLUDED BY NATURE, not by preference: that arm
         * iframes the recompiled game and builds no JS worlds at all, so there
         * is nothing here for it to draw.
         */
        if (params.side !== 'wasm') {
            try {
                const { levelSource } = await armPrelude(params, lifetime);
                if (!lifetime.alive()) return;
                const staging = await trueStartStaging();
                if (!lifetime.alive()) return;
                previewLevel(levelSource, staging, layerSetFor(params), lifetime);
            } catch (e) {
                /**
                 * ⚠ REPORTED, AND THE TAPE REFUSAL IS NOT OVERWRITTEN. The
                 * missing `?tape=` is the actionable fact and a failure to
                 * draw a courtesy preview must not bury it — so this appends
                 * rather than calling `fatal` a second time.
                 */
                lifetime.report(`the opening preview would not draw: ${e.message}`, () => {
                    $('detail').textContent = `${$('detail').textContent}\n⚠ and the opening `
                        + `preview of the true game start would not draw — ${e.message}`;
                });
            }
        }
        return;
    }
    document.body.dataset.side = params.side;
    try {
        if (params.side === 'wasm') await runWasm(params, lifetime);
        else await runJs(params, lifetime);
    } catch (e) {
        lifetime.report(`the ${params.side} side failed: ${e.message}`,
            () => fatal(`${params.side} side failed`, e.stack || e.message));
    }
    if (lifetime.alive()) {
        window.__editorArm = {
            source: params.source, arm: lifetime.name, generation: lifetime.generation,
        };
    }
}

/**
 * ⛓ SWITCH ARMS IN PLACE — the URL, then the teardown, then the mount.
 *
 * ⛔ THE ORDER IS THE CONTRACT. `armLifetimes.start` retires the outgoing arm
 * BEFORE the incoming one exists (⚖ `watchLifetime`), so there is no instant
 * at which two arms both believe they own the canvas — the state the reload
 * used to make unreachable. The chrome is cleared between them, so nothing
 * the old arm said survives to describe the new one's run.
 *
 * ⚠ IT IS `await`ed BUT NOTHING AWAITS IT: the selector's `onchange` cannot,
 * and a mount can take seconds (GENERATE's first solve). A failure therefore
 * has to land somewhere visible, which is what the arms' own
 * `lifetime.report` paths do.
 */
async function switchArm(source, side = null) {
    const q = new URLSearchParams(window.location.search);
    q.set('source', source);
    /**
     * ⛓ THE ENGINE MOVES THE SAME WAY THE ARM DOES (item 11). `?side=` was
     * URL-only, so trying the other engine meant editing the address bar —
     * and the in-place switch already knows how to retire a wasm arm (the
     * iframe's `about:blank` teardown rides on `onRetire`), so there was
     * nothing left to build but the control.
     */
    if (side) q.set('side', side);
    /**
     * ⛔ THE ARM'S OWN BOUNDS DO NOT FOLLOW IT. `?tickbudget=` means one thing
     * to GENERATE and `?tick=` means another to the scrub cursor; what makes
     * them safe to leave in the URL is that each arm reads only its own
     * vocabulary. The one parameter that must be rewritten is the one being
     * switched, so that is the only one touched here.
     */
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
    const params = readParams();
    showPanelsFor(params.source);
    resetPageChrome();
    await mountArm(params, armLifetimes.start(armNameFor(params),
        `the SOURCE selector switched to ${source}`));
}

/**
 * ⛓⛓⛓ WHICH COPY OF THIS SCRIPT IS RUNNING — the stamp, and why a page whose
 * whole job is showing you the truth needed one about itself.
 *
 * ⚖ A user reported an arm not drawing its level on load. Every arm was
 * measured drawing it, in a fresh browser, at every window size — and there
 * was no way, from the page, to tell "the fix is wrong" from "your browser
 * never fetched the fix". The dev server is a plain `python -m http.server`:
 * it sends `Last-Modified` and NO `Cache-Control`, so a browser may apply
 * heuristic freshness and serve this module from cache without revalidating.
 *
 * ⛔ THE WITNESS IS THE RESOURCE TIMING ENTRY, NOT A GUESS. A response the
 * browser took from its own cache reports `transferSize === 0` with a
 * non-zero `decodedBodySize`; one that came off the network reports bytes.
 * That is the browser's own account of what it did, which is the only
 * authority here — a page cannot otherwise know what it was served.
 *
 * ⚠ AND IT IS REPORTED, NEVER ACTED ON. This does not bust the cache, add a
 * query string or reload anything: a page that silently re-fetched itself
 * would make the same ambiguity unobservable in the other direction, and a
 * reader would have no way to know their browser was ever holding stale code.
 * Ctrl+Shift+R is the fix; saying so is this function's whole job.
 *
 * ⚠ `null` IS A REAL ANSWER in both channels — a browser that exposes no
 * resource entry for the module, or a server that answers no HEAD, is a
 * limitation of the reading and says so rather than claiming "fresh".
 */
async function stampSource() {
    const el = $('sourceStamp');
    if (!el) return;
    const href = new URL('./watchViewer.js', import.meta.url).href;
    /**
     * ⛔⛔ THREE STATES, NOT TWO — AND THE MIDDLE ONE IS THE COMMON ONE.
     * MEASURED against this very server: a second load in a warm context
     * reported **300 bytes**, which is not a download (the module is ~250 KB)
     * and not a silent cache hit either. It is a **304 revalidation**: the
     * browser asked, the server said "unchanged", and the body came from
     * cache. A two-state reading called that "fetched from the network", which
     * is false, and would have called it "cached/stale" just as wrongly.
     *
     *   `transferSize === 0`              taken from cache WITHOUT asking — the
     *                                     only state that can be stale
     *   `0 < transferSize < decoded`      REVALIDATED (304) — cached AND current
     *   `transferSize >= decodedBodySize` downloaded in full
     */
    let state = null;
    let bytes = null;
    let decoded = null;
    try {
        const entry = performance.getEntriesByType('resource').find((e) => e.name === href);
        if (entry && entry.decodedBodySize > 0) {
            bytes = entry.transferSize;
            decoded = entry.decodedBodySize;
            if (entry.transferSize === 0) state = 'cache';
            else if (entry.transferSize < entry.decodedBodySize) state = 'revalidated';
            else state = 'network';
        }
    } catch { /* the API is optional; `null` says so */ }
    let onDisk = null;
    try {
        // ⛔ `no-store` ON THIS ONE REQUEST, so the answer is the SERVER's and
        // not another reading of the same cache the question is about.
        const r = await fetch(href, { method: 'HEAD', cache: 'no-store' });
        onDisk = r.headers.get('last-modified');
    } catch { /* offline or blocked — reported as an absence below */ }
    const disk = onDisk ? `server copy ${onDisk}` : 'server answered no HEAD';
    if (state === 'cache') {
        el.className = 'note bad';
        // ⚠ IT SAYS WHAT IT MEASURED, AND NOT WHY. The browser's own timing
        // entry is evidence that the body came from cache; WHICH header let it
        // is not something this reading asked about, and a message that
        // blamed the server would be a second claim with no measurement under
        // it. The remedy is the same either way.
        el.textContent = `⚠ THIS PAGE'S SCRIPT CAME FROM YOUR BROWSER'S CACHE WITHOUT `
            + `ASKING THE SERVER (transferSize 0), so it may be older than what is on `
            + `disk — HARD RELOAD (Ctrl+Shift+R) before believing anything about the `
            + `page's behaviour. ${disk}`;
        return;
    }
    el.className = 'note';
    if (state === 'revalidated') {
        // ⚠ THE HEALTHY CACHE HIT, NAMED AS ONE. The body came from cache and
        // the server was asked whether that was still right — so this is
        // CURRENT, and calling it "cached" would send a reader chasing a
        // problem they do not have.
        el.textContent = `script REVALIDATED with the server (304, ${bytes} B of headers `
            + `for ${decoded} B of script) — cached but current · ${disk}`;
        return;
    }
    el.textContent = state === 'network'
        ? `script downloaded fresh (${bytes} B) · ${disk}`
        : '⚠ this browser reports no timing entry for the page script, so whether it came '
            + `from cache is not a question it can answer · ${disk}`;
}

export async function main() {
    const params = readParams();
    // ⛓ FIRST, AND NOT AWAITED: the stamp is a diagnostic ABOUT the page and
    // must not delay the page. A failure in it may not stop an arm mounting.
    stampSource().catch(() => {});
    /**
     * ⛓⛓⛓ GROUP B — `?attackhold=` IS APPLIED ONCE, AT THE DOCUMENT'S BOOT,
     * AND NOT AT EVERY ARM MOUNT.
     *
     * The hold is page state (see `attackHold`), so re-reading the parameter
     * on each SOURCE switch would silently undo a knob the reader had turned —
     * the switch arc's whole premise is that switching does not reload, and a
     * setting that reset itself on a switch anyway would be that premise
     * leaking. ⚠ A BAD VALUE IS REPORTED, not swallowed: the parse hands back
     * the default with a reason, and the page says the reason where it says
     * every other parameter's.
     */
    const holdParam = parseAttackHold(params.attackHold);
    attackHold = holdParam.hold;
    if (holdParam.why) $('detail').textContent = `⚠ ${holdParam.why}`;
    wireSourceSelector(params, switchArm);
    await mountArm(params, armLifetimes.start(armNameFor(params), 'the page loaded'));
}
