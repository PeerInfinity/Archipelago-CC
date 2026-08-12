/**
 * seedlingDemo/watchOverlays — the editor page's OVERLAY LAYERS, without
 * the DOM (editor arc slice 2).
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchViewer`/`watchSolve`: it
 * makes no claims, gates nothing, and nothing that DOES make a claim may
 * depend on it.
 *
 * ⛔ RAW TRUTH, WHICH FOR AN OVERLAY MEANS THREE THINGS.
 *
 *  1. **Sampled, never interpolated.** A mover's path is the positions the
 *     run actually held on each tick, one point per tick, exactly like the
 *     player breadcrumb trail. Nothing is smoothed between ticks and no
 *     point is elided; a body that sat still for eighty ticks contributes
 *     eighty coincident points, which is the honest picture of a body that
 *     sat still.
 *  2. **A marker draws at the position AT THE TICK its ledger names**, and
 *     it is FILTERED TO THE LEVEL BEING DRAWN — the trail's own law, for
 *     the same reason: every level is its own coordinate space, so a hit
 *     recorded at (57,71) in L18 means nothing at (57,71) in L19.
 *  3. **A ledger row this module cannot place is REPORTED BY NAME**, in
 *     `unplaced`, never dropped. `makeRenderer`'s `unknownShapes` is the
 *     precedent and the reason is identical: "nothing drawn" and "nothing
 *     happened" look the same on a canvas, and the difference is exactly
 *     what a viewer exists to show.
 *
 * ⛔ AND IT OWNS NO LOOP. Every sample comes from the ONE loop —
 * `createTapeStepper`'s `onTick` hook, which is handed the live run — so
 * the overlay is a second READING of the walk the page is already
 * replaying, never a second simulation of it. See `sampleMovers`.
 *
 * ── WHY THIS IS NOT IN `watchViewer.js` ───────────────────────────────
 *
 * The same split `watchSolve` made: everything here is pure (a run-shaped
 * object and some ledgers in, points and markers out) so it is unit-
 * testable in node while the viewer stays a DOM script. The part that
 * decides WHAT a layer contains is the part that can quietly disagree with
 * the run, so it is the part that gets tests.
 */

import { KEY_NAMES, parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { formatTraceRow } from './decisionTrace.js';
/**
 * ⛔⛔ THE ONE-SPELLING IMPORTS (editor arc slice 6).
 *
 * Every geometry this module hands the renderer comes from the ENGINE'S OWN
 * exported function, never from a page-side re-derivation:
 *
 *   the spinner's 7x7 body   `run.spinnerBodies[].rect` — `spinnerRect`'s output
 *   a chaser's box           `chaserBoxAt(tag, cx, cy)`
 *   the hammer's line        `hammerLine(s, gameTime)`
 *   "did the hammer reach?"  `hammerHitsPlayer(s, gameTime, box)`
 *   the player's box         `playerBoxAt(x, y)`
 *   an attack's rect         `run.presses[].rect` — the rect the run COLLIDED
 *
 * ⛓ The hammer is the one that would have been easiest to get wrong. Its
 * angle is `(Game.time % 45) / 45 · 2π`, three symbols long, and a viewer
 * that retyped it would have been a second cost model of a rotating line —
 * agreeing until somebody changed `hammerPeriod`. It is imported instead.
 */
import { chaserBoxAt } from './chasers.js';
import { hammerHitsPlayer, hammerLine } from './spinner.js';
import { playerBoxAt } from './playerPhysicsV2.js';

/**
 * ⛔ THE LAYER ROSTER — kickoff §3.2's table, transcribed once.
 *
 * `on` is the DEFAULT, and `arrows: false` is a ⚖ ruling (kickoff §1.6),
 * not a taste: an arrow path is one dot per tick per arrow and an arrow
 * room fills the canvas with them.
 *
 * `volumes` is the page's pre-existing checkbox and is listed here anyway —
 * a roster that named seven of the eight toggles would make `?layers=`
 * silently unable to address the eighth.
 */
export const OVERLAY_LAYERS = Object.freeze([
    Object.freeze({ id: 'player', label: 'player path', kind: 'path', on: true }),
    Object.freeze({ id: 'enemies', label: 'enemy paths (chasers, spinners)', kind: 'path', on: true }),
    Object.freeze({ id: 'pushables', label: 'pushable positions', kind: 'path', on: true }),
    Object.freeze({ id: 'arrows', label: 'arrow paths', kind: 'path', on: false }),
    Object.freeze({ id: 'action', label: 'action markers (attack-key edges)', kind: 'marker', on: true }),
    Object.freeze({ id: 'damage', label: 'damage / death markers', kind: 'marker', on: true }),
    Object.freeze({ id: 'events', label: 'event markers (clears, grants, transitions)', kind: 'marker', on: true }),
    Object.freeze({ id: 'volumes', label: 'hazard volumes', kind: 'volume', on: true }),
    /**
     * ── ⛓ SLICE 6'S THREE, AND THEY ARE `shape`, NOT `path` ──────────────
     *
     * The four `path` layers above are CUMULATIVE — every position up to the
     * cursor, one dot per tick, which is what a trail is for. These three are
     * THIS TICK ONLY, and the difference is not a style choice:
     *
     *  · a BOX per body per tick is 300 overlapping outlines by mid-tape, and
     *    the union of a 7x7 box swept across a room is a filled room;
     *  · the HAMMER's whole content is its ANGLE RIGHT NOW — the union over
     *    ticks is the 13 px disc `hammerReach` already calls a bound, and
     *    ⚖ the user's own R8 correction was that the disc is the wrong
     *    picture (kickoff §16.8, one arc over);
     *  · an ATTACK RECT is drawn on the tick it FIRED, which is what makes
     *    "absent at a non-press tick" a fact a check can assert.
     *
     * ⇒ all three ON by default: each is a few strokes on the tick you are
     * looking at, so the signal-to-noise argument that put `arrows` OFF
     * (⚖ §1.6 — one dot per arrow per tick, cumulative) does not reach them.
     */
    Object.freeze({ id: 'hitboxes', label: 'enemy body hitboxes (this tick)', kind: 'shape', on: true }),
    Object.freeze({ id: 'hammer', label: 'spinner hammer line (this tick)', kind: 'shape', on: true }),
    Object.freeze({ id: 'attacks', label: 'attack rects (the tick they fired)', kind: 'shape', on: true }),
]);

export const LAYER_IDS = Object.freeze(OVERLAY_LAYERS.map((l) => l.id));

/** The ON set when no `?layers=` says otherwise. */
export const defaultLayerSet = () =>
    new Set(OVERLAY_LAYERS.filter((l) => l.on).map((l) => l.id));

/**
 * `?layers=a,b,c` — the ON set, and everything else OFF.
 *
 * ⚠ AN UNKNOWN NAME IS REPORTED, NOT REFUSED AND NOT IGNORED. Throwing
 * would take the whole page down over a typo in a query string; ignoring
 * would show the DEFAULT layers under a URL that asked for others, which is
 * the silent-failure shape this arc's own laws forbid. So the legal names
 * are honoured, the rest come back in `unknown`, and the page says so.
 *
 * `on: null` means the parameter was absent — which is different from
 * `?layers=` (present and empty), and that difference is "everything off".
 */
export function parseLayersParam(raw) {
    if (raw === null || raw === undefined) return { on: null, unknown: [] };
    const names = String(raw).split(',').map((s) => s.trim()).filter((s) => s !== '');
    const on = new Set();
    const unknown = [];
    for (const n of names) {
        if (LAYER_IDS.includes(n)) on.add(n);
        else unknown.push(n);
    }
    return { on, unknown };
}

/**
 * The attack keys, by name — the edges the ACTION layer marks.
 *
 * ⚠ `primary` is X (`Player.attack`) and `secondary` is C (the item slot).
 * Movement keys are deliberately NOT here: an edge on `right` is a step,
 * and a marker on every step is the breadcrumb trail with more ink.
 */
export const ACTION_KEYS = Object.freeze(['primary', 'secondary']);

/**
 * Rising edges of the named keys across a per-tick held sequence.
 *
 * ⛔ EDGES, NOT HOLDS. `Player.attack` fires on the frame the key goes
 * DOWN; a five-tick hold is one swing, and a marker per held tick would
 * report five. The whole reason this is a separate reading from the run's
 * own `presses` ledger is that the two are derived from different things —
 * the tape's input spans here, the collided rect there — and the editor
 * acceptance row is that they agree on the ticks.
 */
export function keyEdges(heldPerTick, keys = ACTION_KEYS) {
    for (const k of keys) {
        if (!KEY_NAMES.includes(k)) {
            throw new Error(`watchOverlays: "${k}" is not a tape key. The legal names are `
                + `${KEY_NAMES.join(', ')} — one definition, shared with the format the `
                + 'game is handed.');
        }
    }
    const out = [];
    let prev = new Set();
    for (let t = 0; t < heldPerTick.length; t += 1) {
        const now = heldPerTick[t] instanceof Set ? heldPerTick[t] : new Set(heldPerTick[t] ?? []);
        for (const k of keys) if (now.has(k) && !prev.has(k)) out.push({ tick: t, key: k });
        prev = now;
    }
    return out;
}

/**
 * ⛓ ONE PER-TICK SAMPLE OF EVERY MOVER, taken INSIDE the one loop.
 *
 * `createTapeStepper`'s `onTick(tick, state, held, run)` hands the live run
 * to its caller once per observation — the seam its own docblock calls "the
 * one seam a claim may read live state through". This reads it and copies
 * out the four position channels the yielded frame does NOT carry
 * (`world`, `crushers` and `crusherScans` are already on the frame;
 * `chasers`, `spinnerBodies`, `pushables` and `arrowsInFlight` are not).
 *
 * ⛔ IT COPIES RATHER THAN KEEPING THE RUN'S OBJECTS. The getters hand back
 * fresh arrays but the underlying bodies keep moving; a viewer that stored
 * the getter's rows and read them after the loop would draw the LAST tick's
 * geometry at every scrub position — which is exactly the mistake slice 1
 * documented on the world side and deliberately did not make.
 *
 * ⚠ `null` CHANNELS ARE HONEST ABSENCES, not empties. `run.pushables` is
 * `null` under `noclip` and `run.chasers` is `[]` under `noclip` or
 * `noDamage`, because under those flags the steppers do not run and there
 * are no live positions to report. Both come through as an empty layer, and
 * the page's own emptiness readout is what says which tapes those were.
 */
export function sampleMovers(run) {
    const enemies = [];
    /**
     * ⛓ SLICE 6 — THE SAME BODIES, AS COLLIDERS.
     *
     * `enemies` is a POINT per body per tick and stays byte-unchanged: it is
     * the cumulative path channel and its consumers compare its shape. This
     * is the superset the SHAPE layers need — the box the run collides with,
     * from the class's own function, plus the entity point the hammer swings
     * from.
     *
     * ⛔ THE TWO CLASSES ANSWER THE BOX QUESTION DIFFERENTLY, and neither
     * answer is this module's. A spinner's `run.spinnerBodies[].rect` is
     * already `spinnerRect`'s output, carried across by the getter; a chaser
     * reports only its centre, so the box is `chaserBoxAt(tag, …)`, keyed on
     * the AS3 class. Retyping either as `x-4, y-4, 7, 7` would have been a
     * second hitbox table — and the census is where hitboxes live.
     */
    const bodies = [];
    for (const c of run.chasers ?? []) {
        enemies.push({ id: c.id, kind: 'chaser', x: c.x, y: c.y });
        // A partial run object (a unit-test fake) may carry no tag; a body
        // whose class is unknown has no census hitbox and is reported by its
        // ABSENCE from this channel rather than by a guessed box.
        if (c.tag) bodies.push({ id: c.id, kind: 'chaser', tag: c.tag, x: c.x, y: c.y, rect: chaserBoxAt(c.tag, c.x, c.y) });
    }
    for (const s of run.spinnerBodies ?? []) {
        enemies.push({ id: s.id, kind: 'spinner', x: s.x, y: s.y });
        if (s.rect) bodies.push({ id: s.id, kind: 'spinner', tag: 'spinner', x: s.x, y: s.y, rect: { ...s.rect } });
    }
    const pushables = [];
    // A Map keyed by id — `pushableRects`' own shape. A REMOVED block has no
    // position to draw, and drawing its last one would put a wall where the
    // run has none.
    for (const [id, b] of run.pushables ?? []) {
        if (b.removed) continue;
        pushables.push({ id, x: b.rect.x, y: b.rect.y, w: b.rect.w, h: b.rect.h });
    }
    const arrows = (run.arrowsInFlight ?? []).map((a) => ({ id: a.id, x: a.x, y: a.y }));
    /**
     * ⛓⛓ SLICE 6 — THE CLOCK AND THE PLAYER'S OWN POSITION, at this instant.
     *
     * `run.gameTime` is `Game.time` AT THE TOP OF THE FRAME `advance` is about
     * to step (its own docblock), and `run.state` is the pre-move player — the
     * exact box `Spinner.update`'s `collideLine("Player", …)` is handed,
     * because a spinner updates ABOVE the Player in `Game.loadlevel`'s add
     * order. Both are recorded here so `hammerLinesAt` needs nothing but the
     * samples: a function that reached back into the run would be reading a
     * body that has kept moving since (`sampleMovers`' own copy-don't-keep
     * law, one paragraph up).
     *
     * ⚠ `gameTime: null` IS A REAL ANSWER — `run.gameTimeRefusal` says why, and
     * a boot that declares no `save.time` has no phase to draw. The hammer
     * layer REPORTS that rather than drawing a line at a guessed angle.
     */
    return {
        level: run.level,
        enemies,
        pushables,
        arrows,
        bodies,
        gameTime: run.gameTime ?? null,
        player: run.state ? { x: run.state.x, y: run.state.y } : null,
    };
}

/**
 * ⛓⛓⛓ THE COLLECT PASS — the tape's frames AND its overlay samples, in ONE
 * walk of the ONE loop.
 *
 * ⛔ IT LIVES HERE, NOT IN THE PAGE, FOR THE REASON `watchSolve` exists.
 * The acceptance rows below assert what the overlays contain; if the page
 * collected samples with its own copy of this loop, the rows would be
 * checking a derivation nothing on screen used. One walk, two readers — the
 * DOM and the tests — and `samples[i]` is `frames[i]`'s own instant BY
 * CONSTRUCTION: `onTick` fires immediately before the frame for that tick is
 * yielded, so the two arrays cannot fall out of step.
 *
 * ⚠ A THROW MID-WALK IS RETURNED, NOT RAISED. `runTape` refuses a tape that
 * grants into a level it never enters, and the page's answer to that has
 * always been to show what it got and say where it stopped — so the partial
 * frames come back beside the error rather than instead of it.
 */
export function collectRun(tape, levelSource) {
    const parsed = parseTape(tape);
    const samples = [];
    let run = null;
    const stepper = createTapeStepper(tape, {
        levelSource,
        onTick: (tick, state, held, r) => {
            run = r;
            // A tape with no run (the v1 engine, no levelSource) has no
            // movers — an EMPTY sample, never a missing one.
            samples.push(r ? sampleMovers(r)
                : {
                    level: parsed.boot.level,
                    enemies: [],
                    pushables: [],
                    arrows: [],
                    // ⚠ The v1 engine has no bodies, no clock and no run to
                    // read a player position off — an EMPTY sample in every
                    // channel, and `null` where a value would be a guess.
                    bodies: [],
                    gameTime: null,
                    player: { x: state.x, y: state.y },
                });
        },
    });
    const frames = [];
    let finished = null;
    let error = null;
    try {
        for (let r = stepper.next(); ; r = stepper.next()) {
            if (r.done) { finished = r.value; break; }
            frames.push(r.value);
        }
    } catch (e) {
        error = e;
    }
    return { parsed, frames, samples, finished, run, error };
}

/**
 * Every marker a collected walk implies — the ledgers, placed on the frames.
 *
 * The page and the acceptance script both call THIS; neither reaches into
 * `extractMarkers`' argument shape itself, so "which ledgers feed which
 * layer" is written down once.
 */
export function overlaysFor({ frames, run }) {
    return {
        // ⛓ SLICE 6: the ATTACK layer's ledger, named here with the others so
        // "which ledger feeds which layer" stays written down once. It is the
        // raw rows — `attackRectsAt` is what picks the tick, and it is pure
        // and tested, unlike a filter buried in a draw call.
        presses: run?.presses ?? [],
        ...extractMarkers({
            hits: run?.playerHits ?? [],
            deaths: run?.playerDeaths ?? [],
            grants: run?.grantsFired ?? [],
            transitions: run?.transitions ?? [],
            clears: run?.earnedClears ?? [],
            held: frames.map((f) => f.held),
            frameAt: (t) => (frames[t]
                ? {
                    level: frames[t].observation.level,
                    x: frames[t].observation.x,
                    y: frames[t].observation.y,
                }
                : null),
        }),
    };
}

/** The glyph vocabulary. The legend renders THIS — one list, one page. */
export const MARKER_GLYPHS = Object.freeze({
    action: Object.freeze({ glyph: 'square', colour: '#ffd75f', label: 'attack key pressed' }),
    hit: Object.freeze({ glyph: 'cross', colour: '#ff5f5f', label: 'player hit' }),
    death: Object.freeze({ glyph: 'diamond', colour: '#ff2f2f', label: 'player death' }),
    grant: Object.freeze({ glyph: 'plus', colour: '#d8c030', label: 'items granted' }),
    transition: Object.freeze({ glyph: 'triangle', colour: '#3fd8ce', label: 'level transition' }),
    // ⛓ Editor arc slice 3: the arm §3.2's table promised and slice 2 could
    // not build. `circle` is its own glyph on purpose — a clear is not a
    // grant, and the legend is the only place that difference is legible.
    clear: Object.freeze({ glyph: 'circle', colour: '#9a8cff', label: 'persistence flag cleared' }),
});

/**
 * ⛔ EVERY MARKER THE OVERLAYS DRAW, AND EVERY LEDGER ROW THEY COULD NOT.
 *
 * `frameAt(tick)` is the collected frames' own `{level, x, y}` — the
 * position the run held on that tick, which is what "at the tick the ledger
 * names" means. A row whose tick falls outside the collected frames is
 * UNPLACED rather than clamped: clamping would draw a hit at a position the
 * player was never at on that tick, which is the one thing an overlay must
 * not do.
 *
 * ⛓⛓⛓ `clears` NOW PLACE — AND THE REASON THEY DID NOT IS WORTH KEEPING.
 *
 * At slice 2 `run.earnedClears` was `{level, tag, by}` with NO TICK, so
 * every clear landed in `unplaced` (SEVEN on `r1-walk-full`). The tick could
 * have been re-derived from the six ledgers that PRODUCE the clears —
 * `lockSnaps`, `keyOpens`, `rockFlags`, … — and that would have been a
 * SECOND SPELLING of `earnedClears` agreeing with the first until either
 * moved. The arc's one-of-everything law forbids it, so the absence was
 * REPORTED and escalated instead (kickoff §9.3).
 *
 * ⚖ The designer ruled the tick IN (§9.9), added at each feeder's own write
 * funnel and carried through by the getter — so this module reads `c.t` and
 * derives nothing.
 *
 * ⚠ AND `t: null` IS STILL A REAL ANSWER. A lightpole flag read at BOOT was
 * never written by this run, so it has no tick and lands in `unplaced` with
 * THAT reason — a different fact from "the ledger carries no tick at all",
 * and the report says which. A permanent absence with a written cause is the
 * honest shape; a marker at an invented tick is not.
 */
export function extractMarkers({
    hits = [], deaths = [], grants = [], transitions = [], clears = [],
    held = [], frameAt,
} = {}) {
    const markers = [];
    const unplaced = [];
    const place = (layer, tick, source, label, what) => {
        const at = frameAt(tick);
        if (!at) {
            unplaced.push({
                layer,
                what,
                why: `tick ${tick} is outside the collected frames, so there is no `
                    + 'position the run held on it — a marker drawn anyway would be at a '
                    + 'place the player never was',
            });
            return;
        }
        markers.push({
            layer, tick, source, label, level: at.level, x: at.x, y: at.y,
        });
    };

    for (const e of keyEdges(held)) {
        place('action', e.tick, 'action', `${e.key} pressed`, `key edge ${e.key}@${e.tick}`);
    }
    for (const h of hits) {
        place('damage', h.t, 'hit',
            `hit by ${h.source}${h.id ? ` (${h.id})` : ''} — ${h.hits}/${h.hitsMax}`
            + `${h.died ? ' — FATAL' : ''}`,
            `playerHit ${h.source}@${h.t}`);
    }
    for (const d of deaths) {
        place('damage', d.t, 'death',
            `DEATH by ${d.source}${d.id ? ` (${d.id})` : ''} — respawn `
            + `${d.respawn ? `${d.respawn.x},${d.respawn.y}` : '?'}`,
            `playerDeath@${d.t}`);
    }
    for (const g of grants) {
        place('events', g.t, 'grant', `granted ${(g.items ?? []).join('+') || '(nothing)'}`,
            `grant L${g.level}@${g.t}`);
    }
    for (const tr of transitions) {
        place('events', tr.t, 'transition', `L${tr.from_level} → L${tr.to_level}`,
            `transition ${tr.from_level}->${tr.to_level}@${tr.t}`);
    }
    for (const c of clears) {
        const what = `earned clear L${c.level} tag ${c.tag} (by ${c.by})`;
        if (typeof c.t !== 'number') {
            unplaced.push({
                layer: 'events',
                what,
                why: 'this clear\'s feeder carries no tick — a lightpole flag read at BOOT '
                    + 'was never written by this run, so there is no tick to stand a marker '
                    + 'on and one drawn anyway would claim a press that never happened',
            });
            continue;
        }
        place('events', c.t, 'clear', `cleared {${c.level},${c.tag}} by ${c.by}`, what);
    }
    markers.sort((a, b) => a.tick - b.tick);
    return { markers, unplaced };
}

/**
 * The markers to paint right now: at or before the cursor, in THIS level.
 *
 * ⚠ AT OR BEFORE, exactly like the breadcrumb trail. A marker for a hit
 * forty ticks in the future, visible while scrubbing the opening, would say
 * the run had already taken it.
 */
export const markersVisibleAt = (markers, cursor, level, on) => markers.filter(
    (m) => m.tick <= cursor && m.level === level && on.has(m.layer));

/**
 * One mover channel's points, up to the cursor, in THIS level.
 *
 * `samples[t]` is the sample taken on tick `t`; `samples[t].level` is the
 * level the run was in then, which is what filters it — a body sampled in
 * L18 must not be drawn on L19's canvas.
 */
export function pathPointsUpTo(samples, cursor, level, channel) {
    const out = [];
    const end = Math.min(cursor, samples.length - 1);
    for (let t = 0; t <= end; t += 1) {
        const s = samples[t];
        if (!s || s.level !== level) continue;
        for (const b of s[channel] ?? []) out.push(b);
    }
    return out;
}

// ── the SHAPE layers (editor arc slice 6) ────────────────────────────────

/**
 * The live enemy body colliders at EXACTLY this tick, in THIS level.
 *
 * ⚠ NOT CUMULATIVE, unlike `pathPointsUpTo`. See the roster's slice-6 note:
 * a box per body per tick paints the room.
 */
export function bodiesAt(samples, cursor, level) {
    const s = samples[cursor];
    if (!s || s.level !== level) return [];
    return (s.bodies ?? []).filter(Boolean);
}

/**
 * ⛔⛔⛔ THE HAMMER LINE AT THE ENGINE'S OWN CONTACT INSTANT — and the
 * instant is a SPLICE OF TWO SAMPLES, which is the slice's headline finding.
 *
 * `Spinner.update` is, in this order, inside ONE `Game.update`:
 *
 * ```as3
 *   super.update();                              // Mobile.update MOVES the body
 *   hammerAngle = (Game.time % 45) / 45 * 2π;    // Game.time is still the TOP-of-frame value
 *   collideLine("Player", x, y, x + 13·cos a, …) // against the PRE-move player
 * ```
 *
 * `Game.time += timeRate` runs at the BOTTOM of `Game.update`, and the Player
 * updates BELOW the spinner. So the three ingredients of one contact are
 * observed at two different sample instants:
 *
 * | ingredient | where the walk shows it |
 * |---|---|
 * | the body, AFTER its own move in frame `t` | `samples[t]` |
 * | `Game.time` at the TOP of frame `t` | `samples[t-1].gameTime` |
 * | the player box the line was tested against | `samples[t-1].player` |
 *
 * ⛓ MEASURED, NOT REASONED. Reading both the body and the clock from ONE
 * sample gives a line that is either at the wrong ANGLE (sample `t`: 160°
 * where the ledger says 152°) or in the wrong PLACE (sample `t-1`: the right
 * angle, touching nothing) — and the second one is the dangerous member,
 * because a line at the correct angle that quietly reaches past the player is
 * a plausible picture of a miss that was a hit. The splice below reproduces
 * `run.spinnerContacts` EXACTLY on the committed spinner tapes: every hammer
 * row at its own tick and angle, and zero touches the ledger does not have.
 * `watchOverlays.test.js` is that differential, and it is the whole reason
 * this function may exist outside the engine at all.
 *
 * ⚠ THE PREVIOUS SAMPLE'S CLOCK, NEVER `gameTime - 1`. A run spends DEAD
 * FRAMES (`run.deadFrameSpans`) that the tape does not tick through, so the
 * clock can advance by more than one between two samples. Subtracting one
 * would be a second, wrong model of `Game.time`; reading what the walk
 * actually recorded is not a model at all.
 *
 * @returns {{lines: Array, why: string|null}} — `why` is a NAMED absence,
 *   never a silent empty: "no spinner here" and "this run has no clock" are
 *   different facts and only one of them is a limitation.
 */
export function hammerLinesAt(samples, cursor, level) {
    const now = samples[cursor];
    if (!now || now.level !== level) return { lines: [], why: null };
    const spinners = (now.bodies ?? []).filter((b) => b.kind === 'spinner');
    if (spinners.length === 0) return { lines: [], why: null };
    if (cursor === 0) {
        return {
            lines: [],
            why: 'tick 0 has no PREVIOUS sample, and the clock a hammer swings at during a '
                + 'frame is the one read at the TOP of that frame — so the opening frame\'s '
                + 'angle is a value this walk never observed',
        };
    }
    const prev = samples[cursor - 1];
    if (typeof prev?.gameTime !== 'number') {
        return {
            lines: [],
            why: 'this run has no `Game.time` (see `run.gameTimeRefusal`), and the hammer\'s '
                + 'angle is `(Game.time % 45) / 45 · 2π` and nothing else — with no clock the '
                + 'only honest quantity is `hammerReach`\'s union over all 45 phases, which '
                + 'is a disc and not a line',
        };
    }
    // ⛔ The PRE-move player box, from the engine's own `playerBoxAt`.
    const box = prev.player ? playerBoxAt(prev.player.x, prev.player.y) : null;
    const lines = spinners.map((b) => {
        const line = hammerLine({ x: b.x, y: b.y }, prev.gameTime);
        return {
            id: b.id,
            gameTime: prev.gameTime,
            ...line,
            // The engine's own test, not a re-implementation of it: a rect
            // literal without `right`/`bottom` never overlaps anything, and
            // `hammerHitsPlayer` refuses one by name rather than answering
            // "the hammer missed you".
            touches: box ? Boolean(hammerHitsPlayer({ x: b.x, y: b.y }, prev.gameTime, box)) : false,
        };
    });
    return { lines, why: null };
}

/**
 * The attack rects that FIRED on this tick, in this level.
 *
 * ⛔ `fired`, NOT `t`. The ledger carries both and they differ by one BY
 * TRANSCRIPTION — `t` is the tape's press tick and `fired` is the tick the
 * rect was actually collided. A layer keyed on `t` would draw the box one
 * tick before the engine swung it, which is exactly the off-by-one the
 * hammer's own splice is about.
 *
 * ⚠ And the rect is `run.presses[].rect` — the rect the run COLLIDED, not a
 * `slashRect(x, y, direction)` this module recomputed from the row's other
 * fields. The ledger already holds the answer; recomputing it would be a
 * second spelling that agreed until a weapon changed the branch (the spear's
 * rect is `spearRect`, and `hasGhostSword` re-routes the whole press).
 */
export function attackRectsAt(presses, cursor, level) {
    return (presses ?? []).filter((p) => p.fired === cursor && p.level === level);
}

/** How many DISTINCT bodies a channel ever showed — the emptiness readout. */
export function channelSummary(samples, channel) {
    const ids = new Set();
    let points = 0;
    for (const s of samples) {
        for (const b of s?.[channel] ?? []) { ids.add(b.id); points += 1; }
    }
    return { ids: [...ids].sort(), bodies: ids.size, points };
}

// ── the trace pane (kickoff §3.3) ────────────────────────────────────────

/**
 * `…/fixtures/tapes/<name>.json` → `…/fixtures/traces/<name>.trace.json`.
 *
 * ⛔ ONE CONVENTION, and it is `decisionTrace.traceSidecarName`'s — the
 * sidecar is `<tape name>.trace.json` beside the tapes' sibling directory.
 * A page that spelled the convention a second time would find nothing the
 * day the convention moved, and "no trace for this tape" is exactly what a
 * wrong path looks like.
 *
 * Returns `{path}` or `{path: null, why}`; a tape outside a `tapes/`
 * directory has no derivable sidecar and says so rather than guessing.
 */
export function traceSidecarPath(tapePath) {
    const clean = String(tapePath ?? '').replace(/^\/+/, '');
    const m = /^(.*)\/tapes\/([^/]+)\.json$/.exec(clean);
    if (!m) {
        return {
            path: null,
            why: `${clean || '(no tape)'} is not `
                + '`<dir>/tapes/<name>.json`, so there is no sidecar path to derive — '
                + 'traces live in the `traces/` directory beside `tapes/`, keyed by the '
                + 'tape\'s own name',
        };
    }
    return { path: `${m[1]}/traces/${m[2]}.trace.json`, why: null };
}

/**
 * The pane's fields for one trace row — §3.3's five, as strings.
 *
 * The one-line form is `decisionTrace.formatTraceRow`, the CLI's own, and
 * it rides along as the row's tooltip so the pane and
 * `show-seedling-trace --dump` cannot drift into two summaries of one row.
 */
export function traceRowFields(row) {
    return {
        tick: row.tick,
        goal: row.goal.kind,
        obstacle: row.obstacle
            ? `${row.obstacle.kind}${row.obstacle.id ? `:${row.obstacle.id}` : ''}`
            : '—',
        strategy: row.strategy.verb,
        rejected: row.rejected.map((r) => `${r.option} (${r.why})`),
        line: formatTraceRow(row),
    };
}

/**
 * The index of the last row at or before the cursor, or -1.
 *
 * A trace is SPARSE (a row per DECISION), so the highlighted row is "the
 * decision in force right now" and every row above it is history. Rows are
 * strictly increasing by contract, so a scan is honest and a binary search
 * would be the same answer with more code.
 */
export function activeTraceIndex(rows, cursor) {
    let idx = -1;
    for (let i = 0; i < rows.length; i += 1) {
        if (rows[i].tick <= cursor) idx = i; else break;
    }
    return idx;
}
