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
 * to replay exactly once per document (the picker and the SOURCE selector
 * both NAVIGATE); a pasted tape and a manual fold have no path to navigate
 * to, so two animation loops can now exist. The counter retires the
 * superseded one. It is NOT a conditional re-arm: within a generation a
 * throw still re-arms and reports its tick, which is R4's lesson and stays.
 */

import { buildLevelWorld, TILE_SIZE } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { rolesForStaging } from './tapeRunner.js';
import {
    censusGoalOptions, censusWorld, defaultGoalsFromCensus, formatGoalsParam,
    harvestPresets, itemFlagsOf, ITEM_FORM_FIELDS, parseGoalsParam, readSolveParams,
    solveForPage, stagingFromJson, TRUE_START_CHAIN, TRUE_START_SEGMENT, withItemFlag,
} from './watchSolve.js';
import {
    activeTraceIndex, arrowLanesAt, attackRectsAt, bodiesAt, channelSummary, collectRun,
    crushersAt, dangerQueriesAt, defaultLayerSet, hammerLinesAt, LAYER_IDS, MARKER_GLYPHS,
    markersVisibleAt, OVERLAY_LAYERS, overlaysFor, parseLayersParam, pathPointsUpTo,
    traceRowFields, traceSidecarPath, worldChangesAt,
} from './watchOverlays.js';
import {
    clampTick, createManualSession, foldRoundTrip, heldFromCodes, KEYBOARD_ROWS,
    liveOverlaysFor, parseTapeText, readViewParams, serializeTapeText, tapeKeyForCode,
} from './watchManual.js';
import {
    agreementWithPayload, agreementWithTrace, BIOME_NAMES, describeState, displaySolve,
    generateStep, generationRows, ladderCost, readGenerateParams,
} from './watchGenerate.js';
import { atlasOf } from './procgenLevel.js';
import { createLifetimeHolder } from './watchLifetime.js';
import { parseDecisionTrace } from './decisionTrace.js';
import { coerceTerrainState, HAZARD_STATES, ITEM_NAMES, parseTape } from './tapeFormat.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
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
 * Every arm used to replay exactly once per page load — the picker and the
 * SOURCE selector both NAVIGATE — so the animation loop could re-arm itself
 * forever and never meet a successor. Slice 3 breaks that: a PASTED tape has
 * no path to navigate to and a MANUAL session's fold has no path at all, so
 * `replayTape` can now run a second time in one document.
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
 * ⚠ EVERY ARM MOUNTS AGAINST ONE OF THESE FROM THIS SLICE ON, while the
 * SOURCE selector still navigates. That looks like machinery for nothing —
 * a document teardown retires everything anyway — and it is the deliberate
 * order: the mechanism lands and is proved on its own, and the switch that
 * makes it load-bearing lands next. A teardown written in the same commit as
 * its first user is a teardown tested only through that user.
 *
 * The readout is what the browser row asserts on. It names the live arm and
 * keeps the retired ones, because "did the manual loop stop when I left it"
 * is a question about the past.
 */
const armLifetimes = createLifetimeHolder({
    publish: (state) => { window.__editorLifetime = state; },
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
            for (const s of world.objectSolids) rect(s.rect, '#55506a', 0.85);
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
                for (const p of attackRectsAt(opts.presses, cursor, world.level)) {
                    rect(p.rect, SHAPE_COLOURS.attack, 0.25);
                    outline(p.rect, SHAPE_COLOURS.attack);
                    drawn.attacks.push({
                        t: p.t, fired: p.fired, weapon: p.weapon, direction: p.direction,
                        rect: p.rect, hits: (p.hits ?? []).map((h) => h.id ?? h.tag ?? '?'),
                    });
                }
            }

            // The player: the collision box and, offset one pixel down, the
            // rect `getState` actually probes with.
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
    const atlas = await fetchJson(ATLAS_URL, 'atlas');
    const levelSource = levelSourceFromAtlas(atlas);
    const tape = await fetchJson(`/${params.tape.replace(/^\/+/, '')}`, 'tape');
    // ⛓ A pasted or uploaded tape has no path to navigate to, so it replays
    // IN PLACE — through this same function, against this same level source.
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, levelSource, null)
        .catch((e) => fatal('the loaded tape would not replay', e.stack || e.message));
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
        swatch(SHAPE_COLOURS.attack, 'attack rect (fired)'),
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
        pane.highlight(cursor);
    };

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
            if (active >= 0) {
                els[active].el.scrollIntoView({ block: 'nearest' });
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
function mountBootPresets(sel, source, noteEl = null) {
    loadTapeIndex(DEFAULT_TAPE_DIR).then((index) => {
        if (index.error) {
            sel.innerHTML = `<option value="">— no preset list: ${index.error} —</option>`;
            return;
        }
        const { presets, refused } = harvestPresets(index.records);
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
        formEl.appendChild(label);
        return { f, input };
    });
    const why = document.createElement('span');
    formEl.appendChild(why);

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
 * The SOLVE arm: staging in, the bot's own walk out, scrubbed by REPLAY's
 * machinery.
 *
 * ⚠ The solve is SYNCHRONOUS and blocks the page while it runs — which is
 * exactly the quantity ⚖ kickoff §1.2 deferred the live think-mode on, so
 * the page measures it and shows it rather than hiding it behind a
 * spinner.
 */
async function runSolve(params, lifetime) {
    const atlas = await fetchJson(ATLAS_URL, 'atlas');
    const levelSource = levelSourceFromAtlas(atlas);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, levelSource, null)
        .catch((e) => fatal('the loaded tape would not replay', e.stack || e.message));

    // ── the staging block ────────────────────────────────────────────
    let staging;
    let origin;
    if (params.boot) {
        const path = params.boot.replace(/^\/+/, '');
        staging = stagingFromJson(await fetchJson(`/${path}`, 'boot'));
        origin = path;
    } else {
        staging = await trueStartStaging();
        origin = `THE TRUE GAME START — ${TRUE_START_SEGMENT}'s boot block `
            + `(${TRUE_START_CHAIN} segment 1)`;
    }
    // ⚠ ?level= OVERRIDES the block's own level and SAYS SO. The boot x/y
    // belong to the block's level, so pointing it at another one usually
    // spawns the player somewhere meaningless — a fact worth a line in the
    // detail bar rather than a mysterious refusal from the solver.
    const notes = [];
    if (params.level !== null && Number.isFinite(params.level)) {
        if (params.level !== staging.boot.level) {
            notes.push(`?level=${params.level} overrode the staging block's own level `
                + `${staging.boot.level} — the boot x/y (${staging.boot.x},${staging.boot.y}) `
                + `are still level ${staging.boot.level}'s`);
        }
        staging = { ...staging, boot: { ...staging.boot, level: params.level } };
    }
    const name = params.name || `editor-L${staging.boot.level}`;
    $('title').textContent = `${name} — solving from ${origin}`;
    $('solveLevel').value = String(staging.boot.level);
    $('solveBoot').value = JSON.stringify(staging, null, 4);
    $('solveNote').textContent = notes.join('  ·  ');

    // ── the goal picker, over this staging block's own census ────────
    let goals = params.goals ? parseGoalsParam(params.goals) : [];
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
        const block = stagingFromJson(JSON.parse($('solveBoot').value));
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
    const refreshFromBox = () => { try { refreshCensus(stagingNow()); } catch { /* shown */ } };
    mountBootForm($('solveForm'), $('solveBoot'), $('solveNote'), lifetime, refreshFromBox);
    lifetime.on($('solveBoot'), 'change', refreshFromBox);

    $('solveGoalAdd').onclick = () => {
        const spec = $('solveGoalPick').value;
        if (!spec) return;
        goals = [...goals, ...parseGoalsParam(spec)];
        showGoals();
    };
    $('solveGoalClear').onclick = () => { goals = []; showGoals(); };

    // ── the PRESETS, harvested from the committed tapes' own boots ───
    mountBootPresets($('solvePreset'), 'solve', $('solveNote'));

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
            { trace: solved.out.trace, why: null }, solved.out.dangerQueries);
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
    const atlas = await fetchJson(ATLAS_URL, 'atlas');
    const levelSource = levelSourceFromAtlas(atlas);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, levelSource, null)
        .catch((e) => fatal('the loaded tape would not replay', e.stack || e.message));

    let staging;
    let origin;
    if (params.boot) {
        const path = params.boot.replace(/^\/+/, '');
        staging = stagingFromJson(await fetchJson(`/${path}`, 'boot'));
        origin = path;
    } else {
        staging = await trueStartStaging();
        origin = `THE TRUE GAME START — ${TRUE_START_SEGMENT}'s boot block `
            + `(${TRUE_START_CHAIN} segment 1)`;
    }
    if (params.level !== null && Number.isFinite(params.level)) {
        staging = { ...staging, boot: { ...staging.boot, level: params.level } };
    }
    const name = params.name || `manual-L${staging.boot.level}`;
    $('title').textContent = `${name} — driving from ${origin}`;
    $('manualLevel').value = String(staging.boot.level);
    $('manualBoot').value = JSON.stringify(staging, null, 4);
    // ⛓ ONE ROSTER, ONE TABLE: the key legend is rendered FROM the binding
    // map, so a rebinding cannot leave the page describing the old keys.
    $('manualKeys').textContent = KEYBOARD_ROWS
        .map((r) => `${r.code.replace(/^(Key|Arrow)/, '')}→${r.key}`).join('  ');
    mountBootPresets($('manualPreset'), 'manual', $('manualNote'));
    // ⛓ The SAME form, over this arm's own box — and MANUAL has re-read its
    // box at START since slice 3, so there is nothing downstream to refresh.
    mountBootForm($('manualForm'), $('manualBoot'), $('manualNote'), lifetime);

    // ⚠ ONCE. The Set IS the live toggle state — the checkboxes mutate it in
    // place, so rebuilding it per draw would undo every toggle every frame.
    const layers = layerSetFor(params);
    if (layers.unknown.length) {
        $('manualNote').textContent += `${$('manualNote').textContent ? '  ·  ' : ''}`
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
        ].join('');
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
                    const held = heldFromCodes(codes);
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
            block = stagingFromJson(JSON.parse($('manualBoot').value));
        } catch (e) {
            fatal('the starting conditions would not parse — this is the tape parser\'s '
                + 'own message', e.message);
            return;
        }
        try {
            session = createManualSession({ levelSource, staging: block, name });
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

    const atlas = await fetchJson(ATLAS_URL, 'atlas');
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
                : '');

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
        return { solved, agreement, drew: true };
    }

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
    // Load on select. A full navigation rather than an in-place swap: the
    // wasm side cannot rewind the GAME (`botReset` forgets the tape, not the
    // world — every tape needs a fresh page, which is the same rule the
    // recording harness follows), and reloading keeps both sides on one
    // code path instead of giving the JS side a teardown nobody tests.
    sel.onchange = () => {
        const q = new URLSearchParams(window.location.search);
        q.set('tape', sel.value);
        q.set('side', params.side);
        window.location.search = q.toString();
    };
}

/**
 * The SOURCE selector. Changing it NAVIGATES, like the tape picker —
 * the URL stays the page's whole state, so every view is a link.
 */
function wireSourceSelector(params) {
    const sel = $('source');
    sel.value = params.source;
    $('replayPick').hidden = params.source !== 'replay';
    $('solvePanel').hidden = params.source !== 'solve';
    $('manualPanel').hidden = params.source !== 'manual';
    $('generatePanel').hidden = params.source !== 'generate';
    // ⛓ The generation pane only exists for the arm that produces one — a
    // permanently empty "GENERATION TRACE" heading on the REPLAY page would
    // be a channel with nothing in it and no way to tell why.
    $('genTraceSection').hidden = params.source !== 'generate';
    sel.onchange = () => {
        const q = new URLSearchParams(window.location.search);
        q.set('source', sel.value);
        window.location.search = q.toString();
    };
}

/**
 * ── ⛓⛓⛓ MOUNT THE ARM `params` NAMES, AGAINST A LIFETIME ──────────────
 *
 * ⚠ ONE ENTRY, and it is the seam the in-place SOURCE switch needs next: a
 * switch is `mountArm` again with a different `source`, and the lifetime
 * started here is what retires the arm being left. Today `main` is still its
 * only caller and the selector still navigates, so this is a rename with a
 * parameter — deliberately, because the teardown wants proving BEFORE it is
 * load-bearing.
 *
 * ⛔ THE ARM'S OWN REFUSAL GOES THROUGH `lifetime.report`. An arm can fail
 * AFTER it has been retired — every one of these paths awaits a fetch — and
 * `fatal` paints the shared status bar, so a dead arm's refusal would
 * overwrite the live arm's readout with a message that is true about nothing
 * on screen. Reported this way it is kept on the retired lifetime instead,
 * where the readout still shows it.
 */
async function mountArm(params, lifetime) {
    if (params.source === 'solve') {
        // ⚠ NO PICKER FETCH HERE. `runSolve` starts the roster load itself
        // and does not await it — a solve with `?boot=` given should not
        // wait on 150 tapes it is not going to read.
        try {
            await runSolve(params, lifetime);
        } catch (e) {
            lifetime.report(`the solve arm failed: ${e.message}`, () => {
                fatal('the solve arm failed', e.stack || e.message);
                window.__editorSolve = { status: 'refused', message: e.message };
            });
        }
        return;
    }

    if (params.source === 'generate') {
        // ⚠ NEVER INFERRED FROM A BOUND. `?source=generate` or `?gen=` — the
        // arm spends SECONDS of synchronous solve per press, so a stale URL
        // must not land in it (MANUAL's own rule, for the same reason).
        try {
            await runGenerate(params, lifetime);
        } catch (e) {
            lifetime.report(`the generate arm failed: ${e.message}`, () => {
                fatal('the generate arm failed', e.stack || e.message);
                window.__editorGenerate = { status: 'refused', message: e.message };
            });
        }
        return;
    }

    if (params.source === 'manual') {
        // ⚠ MANUAL IS NEVER INFERRED, only asked for by `?source=manual`.
        // `?level=`/`?boot=` are shared with SOLVE, so inferring it would
        // make every existing SOLVE link ambiguous — and the arm that
        // WAITS for a keypress must not be the one a stale URL lands in.
        try {
            await runManual(params, lifetime);
        } catch (e) {
            lifetime.report(`the manual arm failed: ${e.message}`, () => {
                fatal('the manual arm failed', e.stack || e.message);
                window.__editorManual = { status: 'refused', message: e.message };
            });
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
}

export async function main() {
    const params = readParams();
    wireSourceSelector(params);
    /**
     * ⛓ The arm's name carries the SIDE for a replay, because `js` and `wasm`
     * are two different machines with two different teardowns — the wasm one
     * owns an iframe — and a readout that called them both `replay` would
     * describe the leak question in the one vocabulary that cannot answer it.
     */
    const armName = params.source === 'replay' ? `replay-${params.side}` : params.source;
    await mountArm(params, armLifetimes.start(armName, 'the page loaded'));
}
