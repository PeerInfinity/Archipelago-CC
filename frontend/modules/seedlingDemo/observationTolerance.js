/**
 * seedlingDemo/observationTolerance — a TOLERANCE comparator for two
 * observation streams, kept APART from the gate (engine prep B1 D4; the
 * contract is `docs/json/developer/procgen/tape-envelope.md` § 6).
 *
 * ⛔⛔ THIS IS A DIAGNOSTIC, NEVER A GATE. `tapeFormat.diffObservationStreams`
 * is exact, and its docblock says why: every side computes in IEEE-754
 * doubles, so a mismatch is a transcription DEFECT to investigate, not a
 * tolerance to configure. This module answers the question asked AFTER a
 * stream is known to diverge — how far, from which tick, and does the room
 * sequence at least agree — and it does not change that function or add an
 * option to it. `observationTolerance.test.js` refuses any import of this
 * module from the gate scripts (`scripts/procgen/check-*.mjs`),
 * `tapeRunner.test.js`, `fixtures/index.js` and `watchWasm.js`.
 *
 * ── The rules ─────────────────────────────────────────────────────────
 *  · `x`/`y` may differ by at most `epsilon.x`/`epsilon.y` at every tick
 *    where the two streams are in the same room.
 *  · The room must match EXACTLY outside every expected transition's slack
 *    window. The window of a transition at `t` is `[t - slack, t + slack)`:
 *    exactly the ticks at which a crossing moved by at most `slack` ticks,
 *    early or late, shows the other room — and EMPTY at slack 0. A tick
 *    inside a window whose rooms differ is excused whole (positions in two
 *    different rooms are not comparable).
 *  · The room SEQUENCE must be identical: the ticks' rooms with repeats
 *    collapsed, and the transition records' `from_level -> to_level` list.
 *  · Each transition's `t` may differ by at most `slack`.
 *  · A length difference is reported, and tolerated only up to `slack`.
 *
 * ⛓ At `epsilon 0` and `slack 0` the verdict equals
 * `diffObservationStreams(expected, actual) === null` — asserted over all 154
 * committed streams and over perturbed copies.
 */

import { parseObservationStream } from './tapeFormat.js';

function refuse(message) {
    throw new Error(`compareObservationStreams: ${message}`);
}

function readOptions(options = {}) {
    const epsilon = options.epsilon ?? { x: 0, y: 0 };
    if (epsilon === null || typeof epsilon !== 'object') {
        refuse(`epsilon must be { x, y }, got ${JSON.stringify(epsilon)}`);
    }
    for (const axis of ['x', 'y']) {
        const v = epsilon[axis] ?? 0;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            refuse(`epsilon.${axis} must be a finite number >= 0, got ${JSON.stringify(v)}`);
        }
    }
    const slack = options.transitionSlack ?? 0;
    if (!Number.isInteger(slack) || slack < 0) {
        refuse(`transitionSlack must be an integer >= 0 (ticks), got ${JSON.stringify(slack)}`);
    }
    return { epsilon: { x: epsilon.x ?? 0, y: epsilon.y ?? 0 }, slack };
}

/** The ticks' rooms with consecutive repeats collapsed. */
function roomRun(ticks) {
    const out = [];
    for (const o of ticks) if (out.length === 0 || out[out.length - 1] !== o.level) out.push(o.level);
    return out;
}

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Compare two observation streams under a tolerance.
 *
 * @param {object|string} expected  an observation stream (`{ticks, transitions}`)
 * @param {object|string} actual    the other one
 * @param {{epsilon?: {x: number, y: number}, transitionSlack?: number}} [options]
 *   defaults: epsilon 0 on both axes, slack 0 — i.e. EXACT
 * @returns {{agrees: boolean, mode: 'exact'|'tolerance',
 *   firstDivergence: (null|{t: number, kind: string, detail: string}),
 *   maxDelta: {x: number, y: number, t: number}, divergentTicks: number,
 *   roomSequenceAgrees: boolean,
 *   transitions: Array<{index: number, expected: (object|null), actual: (object|null),
 *     dt: (number|null), agrees: boolean}>,
 *   length: {expected: number, actual: number, delta: number, tolerated: boolean}}}
 */
export function compareObservationStreams(expected, actual, options) {
    const { epsilon, slack } = readOptions(options);
    const e = parseObservationStream(expected);
    const a = parseObservationStream(actual);
    const mode = epsilon.x === 0 && epsilon.y === 0 && slack === 0 ? 'exact' : 'tolerance';

    const divergences = [];
    const note = (t, kind, detail) => divergences.push({ t, kind, detail });

    // ── length ────────────────────────────────────────────────────────
    const delta = a.ticks.length - e.ticks.length;
    const length = {
        expected: e.ticks.length, actual: a.ticks.length, delta,
        tolerated: Math.abs(delta) <= slack,
    };
    if (!length.tolerated) {
        note(Math.min(e.ticks.length, a.ticks.length), 'length',
            `tick count differs: expected ${e.ticks.length}, got ${a.ticks.length} `
            + `(slack ${slack})`);
    }

    // ── the slack windows: [t - slack, t + slack) per expected transition ─
    const windows = e.transitions.map((tr) => [tr.t - slack, tr.t + slack]);
    const inWindow = (t) => windows.some(([lo, hi]) => t >= lo && t < hi);

    // ── ticks ─────────────────────────────────────────────────────────
    const maxDelta = { x: 0, y: 0, t: 0 };
    let divergentTicks = 0;
    const n = Math.min(e.ticks.length, a.ticks.length);
    for (let i = 0; i < n; i++) {
        const et = e.ticks[i];
        const at = a.ticks[i];
        if (et.level !== at.level) {
            if (inWindow(i)) continue;
            divergentTicks++;
            note(i, 'room', `tick ${i}: expected room ${et.level}, got ${at.level}`);
            continue;
        }
        const dx = Math.abs(at.x - et.x);
        const dy = Math.abs(at.y - et.y);
        if (dx > maxDelta.x) maxDelta.x = dx;
        if (dy > maxDelta.y) maxDelta.y = dy;
        const badX = dx > epsilon.x;
        const badY = dy > epsilon.y;
        if (badX || badY) {
            divergentTicks++;
            note(i, badX ? 'x' : 'y', `tick ${i}: expected (x=${et.x}, y=${et.y}), got `
                + `(x=${at.x}, y=${at.y}) [dx=${at.x - et.x}, dy=${at.y - et.y}]`);
        }
    }

    // ── the room sequence ─────────────────────────────────────────────
    const pairs = (trs) => trs.map((tr) => `${tr.from_level}->${tr.to_level}`);
    const roomSequenceAgrees = sameList(roomRun(e.ticks), roomRun(a.ticks))
        && sameList(pairs(e.transitions), pairs(a.transitions));
    if (!roomSequenceAgrees) {
        note(0, 'room-sequence', `room sequence differs: expected `
            + `[${roomRun(e.ticks).join(', ')}] via [${pairs(e.transitions).join(', ')}], got `
            + `[${roomRun(a.ticks).join(', ')}] via [${pairs(a.transitions).join(', ')}]`);
    }

    // ── transitions, element-wise ─────────────────────────────────────
    const transitions = [];
    const m = Math.max(e.transitions.length, a.transitions.length);
    for (let i = 0; i < m; i++) {
        const et = e.transitions[i] ?? null;
        const at = a.transitions[i] ?? null;
        const dt = et && at ? at.t - et.t : null;
        const agrees = dt !== null && Math.abs(dt) <= slack
            && et.from_level === at.from_level && et.to_level === at.to_level;
        if (dt !== null && Math.abs(dt) > maxDelta.t) maxDelta.t = Math.abs(dt);
        transitions.push({ index: i, expected: et, actual: at, dt, agrees });
        if (!agrees) {
            note(et?.t ?? at.t, 'transition', `transition ${i}: expected `
                + `${et ? `{t:${et.t}, ${et.from_level}->${et.to_level}}` : 'none'}, got `
                + `${at ? `{t:${at.t}, ${at.from_level}->${at.to_level}}` : 'none'} (slack ${slack})`);
        }
    }

    divergences.sort((p, q) => p.t - q.t);
    return {
        agrees: divergences.length === 0,
        mode,
        firstDivergence: divergences[0] ?? null,
        maxDelta,
        divergentTicks,
        roomSequenceAgrees,
        transitions,
        length,
    };
}
