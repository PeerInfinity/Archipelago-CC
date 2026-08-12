/**
 * seedlingDemo/watchViewer — watch a tape replay, in the browser.
 *
 * ⚠ TOOLING ONLY. This page makes no claims, gates nothing, and nothing
 * that DOES make a claim may depend on it. The gates are vitest (JS stream
 * == the committed oracle recording) and
 * `scripts/procgen/verify-seedling-bot-differential.mjs` (the live game ==
 * those recordings); a viewer is a window onto the same run, not a third
 * opinion about it. Design: `CC/docs/plans/seedling-bot-watch-page.md`.
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
    harvestPresets, parseGoalsParam, readSolveParams, solveForPage, stagingFromJson,
} from './watchSolve.js';
import {
    activeTraceIndex, channelSummary, collectRun, defaultLayerSet, LAYER_IDS,
    MARKER_GLYPHS, markersVisibleAt, OVERLAY_LAYERS, overlaysFor, parseLayersParam,
    pathPointsUpTo, traceRowFields, traceSidecarPath,
} from './watchOverlays.js';
import {
    clampTick, createManualSession, foldRoundTrip, heldFromCodes, KEYBOARD_ROWS,
    liveOverlaysFor, parseTapeText, readViewParams, serializeTapeText, tapeKeyForCode,
} from './watchManual.js';
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

function readParams() {
    const q = new URLSearchParams(window.location.search);
    return {
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
     * A marker glyph, at the position its ledger's tick names.
     *
     * ⛔ THE `default` ARM IS THE LESSON, NOT DECORATION — the same one the
     * hazard-shape loop learned at R4. A marker source this renderer has no
     * glyph for must SAY SO on the canvas; "nothing drawn" and "nothing
     * happened" are indistinguishable otherwise.
     */
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
        /** Shapes met that this renderer has no arm for; empty is the norm. */
        get unknownShapes() { return [...unknownShapes]; },
        /** Marker sources met that this renderer has no GLYPH for; same law. */
        get unknownGlyphs() { return [...unknownGlyphs]; },
    };
}

async function runJs(params) {
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
        ...Object.values(MARKER_GLYPHS).map(
            (g) => swatch(g.colour, `${g.glyph} = ${g.label}`)),
    ].join('');
}

async function replayTape(tape, label, params, levelSource, traceSource = null) {
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
    const collected = collectRun(tape, levelSource);
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
    const { markers, unplaced } = overlaysFor(collected);

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
        renderer.draw(world, f.state, { on, samples, markers, cursor });
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
        },
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
 * The default staging block, for arriving with `?level=` and nothing else.
 *
 * ⚠ Deliberately the EMPTIEST honest one — no clears, no save, no seam —
 * because a page that quietly pre-cleared flags would present a room the
 * game only reaches after work as a room you can boot into. The boot
 * coordinates are the atlas's own convention for "just inside the top-left
 * door" and will be wrong for plenty of levels; the solver says so when
 * they are, which is the honest failure.
 */
const DEFAULT_STAGING = Object.freeze({
    boot: { level: 0, x: 16, y: 16 },
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: [],
    save: null,
    rng: null,
    seam: null,
});

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
 * The SOLVE arm: staging in, the bot's own walk out, scrubbed by REPLAY's
 * machinery.
 *
 * ⚠ The solve is SYNCHRONOUS and blocks the page while it runs — which is
 * exactly the quantity ⚖ kickoff §1.2 deferred the live think-mode on, so
 * the page measures it and shows it rather than hiding it behind a
 * spinner.
 */
async function runSolve(params) {
    const atlas = await fetchJson(ATLAS_URL, 'atlas');
    const levelSource = levelSourceFromAtlas(atlas);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, levelSource, null)
        .catch((e) => fatal('the loaded tape would not replay', e.stack || e.message));

    // ── the staging block ────────────────────────────────────────────
    let staging = DEFAULT_STAGING;
    let origin = 'the page default (nothing cleared, nothing saved)';
    if (params.boot) {
        const path = params.boot.replace(/^\/+/, '');
        staging = stagingFromJson(await fetchJson(`/${path}`, 'boot'));
        origin = path;
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

    // The census needs a built world, and building one can refuse (a level
    // the atlas does not have, an orphan clear). REPORTED, not swallowed.
    let world = null;
    try {
        world = censusWorld(levelSource, staging);
        fillCensus(world);
    } catch (e) {
        fatal(`level ${staging.boot.level} would not build from this staging block`,
            e.message);
    }

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
        $('status').textContent = `solving ${name} in level ${staging.boot.level} `
            + `toward ${formatGoalsParam(list)}…`;
        // Yield one frame so the status paints BEFORE the synchronous solve
        // takes the thread. Without it the page looks frozen with the old
        // text on it, which is a lie about what it is doing.
        await new Promise((r) => requestAnimationFrame(r));

        let solved;
        try {
            solved = solveForPage({
                levelSource, staging, goals: list, name, now: () => performance.now(),
            });
        } catch (e) {
            // ⚠ THE SOLVER'S OWN MESSAGE, VERBATIM, with the rows it got
            // through first — a refused segment is still reviewable, and
            // `SolverRefusal` carries them for exactly that.
            const rows = e.rows?.length;
            fatal('the solver REFUSED — this is its own message, not the page\'s',
                `${e.message}${rows ? `\n\n(${rows} decision row(s) before the refusal)` : ''}`);
            window.__editorSolve = { status: 'refused', message: e.message, rows: rows ?? 0 };
            $('solveGo').disabled = false;
            return;
        }

        const solveMs = Math.round(solved.ms);
        $('solveTime').textContent = `solved in ${solveMs} ms`;
        const replayT0 = performance.now();
        // ⛓ The trace goes STRAIGHT into the pane: an in-page solve already
        // holds it, so fetching a sidecar for a tape that was never written
        // would be looking on disk for something in memory.
        const { frames } = await replayTape(solved.tape, name, params, levelSource,
            { trace: solved.out.trace, why: null });
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
            + `solve ${solveMs} ms + replay ${replayMs} ms`;
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
            level: staging.boot.level,
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
async function runManual(params) {
    const atlas = await fetchJson(ATLAS_URL, 'atlas');
    const levelSource = levelSourceFromAtlas(atlas);
    replayLoadedTape = (t, lbl) => replayTape(t, lbl, params, levelSource, null)
        .catch((e) => fatal('the loaded tape would not replay', e.stack || e.message));

    let staging = DEFAULT_STAGING;
    let origin = 'the page default (nothing cleared, nothing saved)';
    if (params.boot) {
        const path = params.boot.replace(/^\/+/, '');
        staging = stagingFromJson(await fetchJson(`/${path}`, 'boot'));
        origin = path;
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
    window.addEventListener('keydown', onKey(true));
    window.addEventListener('keyup', onKey(false));
    // A window that loses focus mid-press would otherwise hold that key for
    // the rest of the session — the tape would record a hold nobody made.
    window.addEventListener('blur', () => codes.clear());

    const drawLive = () => {
        const world = worldFor(session.run.level);
        const last = session.observations[session.observations.length - 1];
        const { markers } = liveOverlaysFor(session);
        renderer.draw(world, session.run.state, {
            on: layers.on, samples: session.samples, markers, cursor: session.tick,
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
        requestAnimationFrame(manualFrame);
    }

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
        requestAnimationFrame(manualFrame);
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
        window.__editorManual = {
            name,
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
async function runWasm(params) {
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
    const until = (what, pred, ms = 180000) => new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
            let v = null;
            try { v = pred(); } catch { v = null; }
            if (v) return resolve(v);
            if (Date.now() - t0 > ms) return reject(new Error(`timed out waiting for ${what}`));
            return setTimeout(tick, 200);
        };
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
    poll();

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
        setTimeout(poll, 250);
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
    sel.onchange = () => {
        const q = new URLSearchParams(window.location.search);
        q.set('source', sel.value);
        window.location.search = q.toString();
    };
}

export async function main() {
    const params = readParams();
    wireSourceSelector(params);

    if (params.source === 'solve') {
        // ⚠ NO PICKER FETCH HERE. `runSolve` starts the roster load itself
        // and does not await it — a solve with `?boot=` given should not
        // wait on 150 tapes it is not going to read.
        try {
            await runSolve(params);
        } catch (e) {
            fatal('the solve arm failed', e.stack || e.message);
            window.__editorSolve = { status: 'refused', message: e.message };
        }
        return;
    }

    if (params.source === 'manual') {
        // ⚠ MANUAL IS NEVER INFERRED, only asked for by `?source=manual`.
        // `?level=`/`?boot=` are shared with SOLVE, so inferring it would
        // make every existing SOLVE link ambiguous — and the arm that
        // WAITS for a keypress must not be the one a stale URL lands in.
        try {
            await runManual(params);
        } catch (e) {
            fatal('the manual arm failed', e.stack || e.message);
            window.__editorManual = { status: 'refused', message: e.message };
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
        fatal('no ?tape= given — pick one above, or switch source to SOLVE',
            'watch.html?tape=frontend/modules/seedlingDemo/fixtures/tapes/'
            + 'pit-fall-chain-85.json&side=js');
        return;
    }
    document.body.dataset.side = params.side;
    try {
        if (params.side === 'wasm') await runWasm(params);
        else await runJs(params);
    } catch (e) {
        fatal(`${params.side} side failed`, e.stack || e.message);
    }
}
