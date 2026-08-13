/**
 * seedlingDemo/watchManual — the editor page's MANUAL arm and its TAPE I/O,
 * without the DOM (editor arc slice 3).
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchViewer`/`watchSolve`/
 * `watchOverlays`: it makes no claims, gates nothing, and nothing that DOES
 * make a claim may depend on it.
 *
 * ── ⛔ THE LOOP QUESTION, ANSWERED BEFORE ANYTHING ELSE ────────────────
 *
 * The page's third law is NO PRIVATE TICK LOOP, and a hand-driven session
 * plainly advances a run tick by tick. The two are not in conflict, and the
 * distinction is the one the law was written for:
 *
 *   A REPLAY loop reads a tape and claims to reproduce it. Two of those
 *   drift, and the one nobody tests is the one that drifts — which is why
 *   `createTapeStepper` is the only replay loop in the package.
 *
 *   A PRODUCER loop has no tape to reproduce. `solveSegment` is one (it
 *   calls `run.advance` in a search), `botDriverV1`/`V2` are two more, and
 *   this is the fourth: keys in, `perTick` out. It cannot disagree with the
 *   stepper because it is not saying anything the stepper also says.
 *
 * ⛓ AND THE JOIN IS ASSERTED, NOT ASSUMED. `foldRoundTrip` folds a manual
 * session with the ONE fold (`buildStagedTape`) and replays the result
 * through the ONE loop, then compares every observation the drive recorded
 * against every frame the stepper yielded. If a producer loop ever did drift
 * from the replay, that row is where it shows — which is the whole reason
 * the round trip is an acceptance row and not a screenshot.
 *
 * ── WHY THIS IS NOT IN `watchViewer.js` ───────────────────────────────
 *
 * The `watchSolve` split, a third time: everything here is pure (staging and
 * key names in, a session and a tape out), so it is unit-testable in node
 * while the viewer stays a DOM script. The part that decides what a manual
 * tick CONTAINS is exactly the part that could quietly record something the
 * replay then does not reproduce, so it is the part that gets tests.
 */

import { KEY_NAMES, parseTape } from './tapeFormat.js';
import { checkSolveDespawns, createRunForStaging, solveStaging } from './tapeRunner.js';
import { buildStagedTape } from './botDriverV1.js';
import { collectRun, extractMarkers, sampleMovers } from './watchOverlays.js';

/**
 * ⛔ THE KEYBOARD, BOUND TO THE GAME'S OWN KEYS AND NO OTHERS.
 *
 * Keyed by `KeyboardEvent.code` (physical position) rather than `.key`
 * (layout-dependent), so an AZERTY keyboard drives the same run.
 *
 * ⚠ THE BINDING IS THE GAME'S. `KEY_CODES` in `tapeFormat` maps these eight
 * names to the AS3 keycodes `Input.check` reads — arrows, X, C, V, I — and
 * `FORBIDDEN_KEYS` names the ones a tape must never carry (M/R/Esc rebuild
 * the world, W opens a URL). Adding a WASD convenience here would let a
 * driver press a key the game's own bot channel has no code for, and the
 * fold would then write a tape the game cannot be handed.
 */
export const KEYBOARD_BINDINGS = Object.freeze({
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowLeft: 'left',
    ArrowDown: 'down',
    KeyX: 'primary',
    KeyC: 'secondary',
    KeyV: 'inventory',
    KeyI: 'inventory2',
});

/** The bindings as display rows, for the page's own legend. */
export const KEYBOARD_ROWS = Object.freeze(
    Object.entries(KEYBOARD_BINDINGS).map(([code, key]) => Object.freeze({ code, key })),
);

/**
 * The tape key a physical key drives, or `null` for one that drives nothing.
 *
 * ⛔ VALIDATED AGAINST `KEY_NAMES` AT MODULE LOAD, not trusted. A binding
 * table that named a key the tape format does not have would produce a
 * `perTick` the fold refuses — at STOP, after the session was driven, which
 * is the worst possible moment to find out.
 */
for (const [code, key] of Object.entries(KEYBOARD_BINDINGS)) {
    if (!KEY_NAMES.includes(key)) {
        throw new Error(`watchManual: ${code} is bound to "${key}", which is not a tape `
            + `key. The legal names are ${KEY_NAMES.join(', ')} — one definition, shared `
            + 'with the format the game is handed.');
    }
}

export const tapeKeyForCode = (code) => KEYBOARD_BINDINGS[code] ?? null;

/** The tape keys a set of physical key codes is holding down. */
export function heldFromCodes(codes) {
    const held = new Set();
    for (const c of codes ?? []) {
        const k = tapeKeyForCode(c);
        if (k) held.add(k);
    }
    return held;
}

/**
 * ⛓⛓⛓ A MANUAL SESSION — the run, driven by hand, recorded as it goes.
 *
 * ⚠ RECORD-THEN-ACT, the same rule `createTapeStepper` obeys and for the
 * same reason: the AS3 hook sits at the TOP of `Main.update()`, so
 * observation `t` is the state after exactly `t` completed movement ticks
 * and an N-tick session yields N+1 observations. A session that recorded the
 * state AFTER advancing would fold into a tape whose replay is one tick out
 * of phase with it everywhere — and it would look right on screen, because
 * every position in it is a position the run really held.
 *
 * ⛔ ONE CONSTRUCTION: `createRunForStaging(solveStaging(staging))`, the same
 * pair `solveForPage` uses. `solveStaging` is what makes the block HONEST —
 * `noclip`/`noDamage` off and `despawn` emptied — and `buildStagedTape`
 * writes a v8 header that means exactly that. A manual mode that built its
 * run some other way would be driving a different world from the one its own
 * saved tape replays in.
 */
/**
 * @param {object} o
 * @param {boolean} [o.scratchPersistence] ⛓⛓ THE ONE FLAG A GENERATED LEVEL
 *   NEEDS, passed through to `createRunForStaging` and DEFAULT FALSE here for
 *   the same reason it is false there: a kill-lock clear is DECLARED by a
 *   recorded tape's v9 `at` row, and every level with a tape behind it must
 *   keep `levelRun`'s refusal to compute one the tape does not carry ("two
 *   writers of one persistence slot").
 *
 *   A generated room has no tape — driving it IS what would produce one — so
 *   the refusal is correct everywhere else and vacuous exactly there. ⚠ The
 *   flag is therefore a statement about the LEVEL'S PROVENANCE and not a
 *   convenience: `watchViewer` sets it only for a level the GENERATE arm
 *   handed over, and says so in the panel when it does.
 */
export function createManualSession({
    levelSource, staging, name = 'manual', scratchPersistence = false,
}) {
    const honest = solveStaging(staging);
    const run = createRunForStaging(honest, levelSource, { scratchPersistence });
    const perTick = [];
    const observations = [];
    const samples = [];
    let refusal = null;

    /** The state right now, in the stepper's own observation shape. */
    const observe = () => {
        observations.push({
            t: perTick.length, x: run.state.x, y: run.state.y, level: run.level,
        });
        // ⛓ THE SAME `sampleMovers` CALL THE REPLAY PATH MAKES (slice 2's
        // line), so a LIVE overlay while driving and a replayed one after
        // STOP are the same derivation — not a second one that agrees.
        samples.push(sampleMovers(run));
    };
    observe();

    return {
        run,
        staging: honest,
        get name() { return name; },
        /** Completed movement ticks — `observations.length - 1`, always. */
        get tick() { return perTick.length; },
        get perTick() { return perTick; },
        get observations() { return observations; },
        get samples() { return samples; },
        /**
         * ⛓ The run's REFUSAL, if it made one — `{tick, message}`, else null.
         *
         * ⚠ A REFUSED DRIVE IS A REAL SESSION, NOT A LOST ONE. `levelRun`
         * refuses by name (a lethal pit with no control block, a soft-lock
         * stance, an orphan clear) and a hand driver meets those constantly —
         * that is what driving by hand IS. Everything up to the refusal was
         * really driven, so it folds, and the tape it folds to reproduces the
         * refusal on the same tick. Recorded here so `foldRoundTrip` can
         * assert exactly that rather than reporting a legitimate refusal as a
         * broken round trip.
         */
        get refusal() { return refusal; },
        /**
         * One frame: record what is held, dispatch it, observe the result.
         *
         * The held set is COPIED. The caller's set is a live view of the
         * keyboard and keeps changing; a session that stored the reference
         * would fold a tape in which every tick held whatever was down when
         * STOP was pressed.
         *
         * ⚠ A THROW LEAVES `perTick` ONE LONGER THAN `observations`, and that
         * is correct rather than an inconsistency to tidy: the tick WAS
         * dispatched, there is simply no state after it. The fold keeps it,
         * and the replay meets the same wall on the same tick.
         */
        step(held) {
            perTick.push(new Set(held));
            try {
                run.advance(held);
            } catch (e) {
                refusal = { tick: perTick.length - 1, message: e.message };
                throw e;
            }
            observe();
        },
        /**
         * The session as a tape, through the ONE fold.
         *
         * ⛔ `buildStagedTape`, the same call `solveForPage` makes — the span
         * fold every driver-emitted tape in the package goes through. A
         * manual mode with its own span compressor would be a second answer
         * to "what does this session mean", and the two would agree until
         * one of them met a one-tick press.
         */
        fold() {
            return buildStagedTape({ staging: honest, perTick, name });
        },
        /**
         * ⛓ The DECLARED despawns, checked against what this drive computed
         * (slice 5) — `solveForPage`'s line, one arm over.
         *
         * ⚠ ITS OWN METHOD RATHER THAN PART OF `fold()`, because a hand drive
         * has a mid-session state a solve does not: the check is a statement
         * about a FINISHED walk, and calling it from inside the fold would
         * make a legitimate mid-drive save refuse for a body the driver has
         * not gone anywhere near yet. STOP calls both, in this order.
         */
        checkDespawns() {
            return checkSolveDespawns(staging, run);
        },
    };
}

/**
 * The overlays of a session being driven RIGHT NOW.
 *
 * ⛔ THE SAME `extractMarkers` THE REPLAY PATH CALLS, handed the session's
 * own observations instead of a replay's frames. Not a live marker
 * extractor: one extractor, two callers — the same shape `overlaysFor` has,
 * for the same reason. A second one would let the drive show a marker the
 * scrub of its own tape then did not, which is the difference nobody would
 * ever notice was a bug.
 */
export function liveOverlaysFor(session) {
    const { run, observations, perTick } = session;
    return extractMarkers({
        hits: run.playerHits,
        deaths: run.playerDeaths,
        grants: run.grantsFired,
        transitions: run.transitions,
        clears: run.earnedClears,
        held: perTick,
        frameAt: (t) => (observations[t]
            ? { level: observations[t].level, x: observations[t].x, y: observations[t].y }
            : null),
    });
}

/**
 * ⛓⛓⛓ THE ROUND TRIP — the acceptance row, as a pure derivation.
 *
 * Folds a manual session and replays the tape through the stepper, then
 * compares the drive's own observations against the replay's frames, one
 * tick at a time. The page and the vitest row call THIS, so the row asserts
 * the derivation the page performs rather than a second one that resembles
 * it (`collectRun`'s own reason for living in `watchOverlays`).
 *
 * ⚠ WHAT IT COMPARES, AND WHY EACH PART IS THERE:
 *
 *   `observations`  the fold is faithful — every position the hand-driven
 *                   run held is a position the replay reaches, on the same
 *                   tick, in the same level.
 *   `held`          the SPAN COMPRESSION is faithful. This is the half a
 *                   position check cannot see: a press whose span is one
 *                   tick short still produces identical positions in a room
 *                   with nothing to hit.
 *
 * The final observation carries no `held` — it is the disarm tick, which
 * records the last tick's movement and dispatches nothing — so the held
 * comparison runs over `perTick.length` and the observation comparison over
 * `perTick.length + 1`. A mismatch anywhere comes back as a ROW naming the
 * tick and both sides; the caller decides whether an empty list is a pass.
 */
export function foldRoundTrip(session, levelSource) {
    const tape = session.fold();
    const collected = collectRun(tape, levelSource);
    const { frames } = collected;
    const mismatches = [];

    if (frames.length !== session.observations.length) {
        mismatches.push({
            tick: null,
            what: 'frame count',
            drove: `${session.observations.length} observation(s)`,
            replayed: `${frames.length} frame(s)`,
        });
    }
    const n = Math.min(frames.length, session.observations.length);
    for (let t = 0; t < n; t += 1) {
        const o = session.observations[t];
        const f = frames[t].observation;
        if (f.level !== o.level || f.x !== o.x || f.y !== o.y) {
            mismatches.push({
                tick: t,
                what: 'observation',
                drove: `L${o.level} ${o.x},${o.y}`,
                replayed: `L${f.level} ${f.x},${f.y}`,
            });
        }
    }
    for (let t = 0; t < Math.min(session.perTick.length, frames.length); t += 1) {
        const drove = [...session.perTick[t]].sort().join('+') || '—';
        const replayed = [...frames[t].held].sort().join('+') || '—';
        if (drove !== replayed) {
            mismatches.push({ tick: t, what: 'held', drove, replayed });
        }
    }
    /**
     * ⛓ TWO VERDICTS, BECAUSE THERE ARE TWO QUESTIONS.
     *
     * `faithful` — did the fold preserve everything the drive recorded? That
     * is the SPAN FOLD's claim, and it is answerable even for a drive the
     * run refused halfway through.
     *
     * `ok` — and did the replay end the way the drive did? A drive that hit
     * a lethal pit is a legitimate session whose tape legitimately refuses;
     * reporting that as a broken round trip would teach the reader to ignore
     * a red. So a refusal counts as reproduced when the replay throws THE
     * SAME MESSAGE — a replay that threw a DIFFERENT one, or none at all,
     * is a real divergence and stays red.
     */
    const droveRefusal = session.refusal;
    const reproduced = droveRefusal !== null && collected.error !== null
        && collected.error.message === droveRefusal.message;
    const faithful = mismatches.length === 0;
    return {
        tape,
        frames,
        collected,
        mismatches,
        faithful,
        refusal: droveRefusal,
        reproduced,
        ok: faithful && (droveRefusal === null
            ? collected.error === null
            : reproduced),
        error: collected.error,
    };
}

// ── TAPE I/O (kickoff §3.4) ──────────────────────────────────────────────

/**
 * A tape, as the text the SAVE textarea holds and the Download button writes.
 *
 * Four-space JSON, the committed tapes' own indentation — so a saved
 * experiment diffs cleanly against a fixture if anyone ever promotes one by
 * hand, which is the ONLY sanctioned route (⛔ the page never writes
 * `fixtures/`; the roster is disk-derived and a saved experiment would
 * silently join the differential).
 *
 * ⚠ THE OBJECT IS SERIALISED AS THE PAGE HOLDS IT. For a REPLAY tape that is
 * the fetched JSON verbatim, so Save → paste → Load is byte-identical to the
 * committed file. Normalising it through `parseTape` first would round a v1
 * fixture up to the current vocabulary and hand the user a tape the roster
 * does not contain.
 */
export const serializeTapeText = (tape) => `${JSON.stringify(tape, null, 4)}\n`;

/**
 * Text → a tape, or a REFUSAL carrying the reason.
 *
 * ⛔ THROUGH `parseTape`, ALWAYS. A malformed tape refuses with the PARSER'S
 * own message — the same message the runner, the driver and the differential
 * would give it — rather than a second, laxer opinion held by a page. The
 * two failure kinds are told apart because they are different facts: text
 * that is not JSON at all never reached the tape vocabulary.
 *
 * Returns `{tape, parsed}` or `{error, why}`; it does not throw, because the
 * caller is a paste box and a typo is not an exception.
 */
export function parseTapeText(text) {
    const raw = String(text ?? '').trim();
    if (!raw) {
        return { error: 'empty', why: 'there is nothing in the box to load' };
    }
    let json;
    try {
        json = JSON.parse(raw);
    } catch (e) {
        return {
            error: 'json',
            why: `this is not JSON — ${e.message}. A tape is a JSON object; paste the `
                + 'whole file, not a fragment of one',
        };
    }
    try {
        return { tape: json, parsed: parseTape(json) };
    } catch (e) {
        // ⚠ VERBATIM. `parseTape` names the field and the version rule it
        // broke; a page that re-worded it would be answering a question the
        // parser already answered better.
        return { error: 'tape', why: e.message };
    }
}

/**
 * ── ⛓ THE VIEW PARAMETERS (kickoff §3.4) ────────────────────────────────
 *
 * `?tick=N`  the cursor to land on when the frames are collected.
 * `?shot=1`  the CLI's contract — see `watch.html`'s docblock, which states
 *            it as the thing slice 4's exporter waits on.
 *
 * ⚠ AN UNREADABLE `?tick=` IS REPORTED, NOT SILENTLY ZERO. "The page opened
 * at tick 0" and "the page ignored the tick you asked for" look identical,
 * and the second is the one that wastes an afternoon. Out-of-range is a
 * different fact again and is decided where the frame count is known
 * (`clampTick`), not here.
 */
export function readViewParams(search) {
    const q = new URLSearchParams(search);
    const rawTick = q.get('tick');
    const shot = q.get('shot') === '1';
    if (rawTick === null || rawTick === '') return { tick: null, shot, tickWhy: null };
    const tick = Number(rawTick);
    if (!Number.isInteger(tick) || tick < 0) {
        return {
            tick: null,
            shot,
            tickWhy: `?tick=${JSON.stringify(rawTick)} is not a whole tick index ≥ 0, so `
                + 'the cursor stays where it started — a tick is a frame number, and the '
                + 'frame count is in the status bar',
        };
    }
    return { tick, shot, tickWhy: null };
}

/**
 * `?tick=N` against the frames actually collected.
 *
 * ⚠ CLAMPED **AND SAID SO**. A tape shorter than the requested tick is a
 * real fact about the tape — usually the run threw early — and landing
 * silently on the last frame would present a truncated run as a complete
 * one at the wrong cursor. Returns `{tick, why}`; `why` is null when the
 * request was honoured exactly.
 */
export function clampTick(tick, frameCount) {
    if (tick === null || tick === undefined) return { tick: 0, why: null };
    const last = Math.max(0, frameCount - 1);
    if (tick > last) {
        return {
            tick: last,
            why: `?tick=${tick} is past the last frame — this run collected ${frameCount} `
                + `frame(s), so the cursor is at ${last}`,
        };
    }
    return { tick, why: null };
}
