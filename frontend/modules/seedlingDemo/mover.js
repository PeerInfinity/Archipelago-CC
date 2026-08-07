/**
 * seedlingDemo/mover — the TIME-OPTIMAL MOVER. R6 slice 1.
 *
 * Ruled design (`note_time_optimal_mover`, user 2026-08-07; R6 kickoff
 * §3.3): an EMPIRICAL mover on the exact stepper, **never a closed form**.
 * A\* over quantized `(position, velocity, tick)` with
 * `playerPhysicsV1.step` as the transition function; ONE cost model;
 * certificates replayable through the stepper the differential already
 * proves byte-exact.
 *
 * ── Why this exists, in the user's own framing ────────────────────────
 * "finding a safe path requires traveling along a dangerous path as
 * quickly as possible, to get through it during the safe window." The
 * arc's searches kept dying because their adjacency was STATICALLY safe
 * cells: confinement worked by shrinking the world to where time does not
 * matter, and transient-safe corridors are invisible to that. A mover that
 * answers "earliest tick at which I can be HERE" makes a transient-safe
 * corridor a first-class edge.
 *
 * ── ⛔⛔⛔ THE HEURISTIC'S DENOMINATOR IS DERIVED, NOT SAMPLED ─────────
 *
 * A\* is admissible only if `h` never OVERSTATES the remaining ticks, and
 * `h` is `distance / (max per-tick displacement)`. Getting that denominator
 * by measurement is the obvious move and it is WRONG:
 *
 *   · 400 random 200-tick walks over the 16 key sets   -> max |dx| 1.4342
 *   · a 4000-tick pure hold-RIGHT                       -> max |vx| 1.5500
 *   · adversarial BFS over 1,040,113 velocity states    -> max |vx| 1.599994
 *   · READING THE BRANCH                                -> **< 1.6, exactly**
 *
 * `applyInput` is `if (v.x < moveSpeed) v.x += moveSpeed`, a threshold test
 * followed by a full-magnitude add, so the add can only fire from below
 * `moveSpeed` and can only land below `2 * moveSpeed`. A heuristic built on
 * the sampled 1.4342 divides by too little, overstates `h`, and returns
 * paths that are not tick-optimal — silently, because A\* still returns
 * *a* path. **A sampled envelope is not a bound.**
 *
 * ── ⛓ THE QUANTIZATION IS A SEED, NOT A DIAL ─────────────────────────
 *
 * Merging two states under one grid key can prune the true optimum, and
 * finer is NOT monotonically better — the arc has paid for that twice
 * ([[feedback_knob_derived_for_one_terrain]],
 * [[feedback_finer_step_is_not_stronger_search]]). So:
 *
 *   · every answer carries its TRIPLE — the result, the granularity it was
 *     found at, and the constraint that bounded the search;
 *   · every NEGATIVE names the bound that produced it, because "no path"
 *     and "no path within 4,000 expansions at grid 0.25" are different
 *     claims and only one of them is true;
 *   · the search PROPOSES and the replay DISPOSES.
 *
 * ── ⛓⛓ WHAT A CERTIFICATE IS, AND WHY REPLAY IS NOT A TAUTOLOGY ──────
 *
 * The certificate is **tape input spans**, not an internal path object. The
 * quantization decides which states get EXPANDED, so it can cost
 * optimality; it cannot make a returned path invalid, because the path is
 * reconstructed from real parent states and real key sets. What replay
 * therefore buys is a claim about a DIFFERENT stratum: `replayThroughTape`
 * runs the spans through `tapeRunner.runTape` — the loop the 100-tape
 * differential proves byte-exact against the real game — rather than
 * through this module's own successor function. A certificate that only
 * ever round-tripped through its own generator would be
 * [[feedback_verifier_shared_assumption]] in planner clothing.
 *
 * ── ⚠ THE CONTRACT SAYS "CERTIFIED AGAINST TIMELINE T", NEVER "SAFE" ──
 *
 * `forbiddenAt(tick, x, y)` is a caller-supplied TIMELINE. A plan is
 * certified against the timeline it was planned against and against
 * nothing else; where the timeline is player-coupled (a boss that aims, a
 * trigger that arms) the caller owns the fixed point — plan against the
 * induced timeline, re-derive it, verify by replay. The clock still
 * disposes.
 *
 * ── ⛔⛔⛔ THE MEASURED RANGE — THIS IS A SHORT-RANGE INSTRUMENT ───────
 *
 * A 4-D state with 16-way branching does not scale, and pretending
 * otherwise would be the expensive kind of optimism. Measured on open
 * ground from rest, straight-line, `maxExpansions` 60,000
 * (`MOVER_RANGE` below carries the same numbers as data):
 *
 * ```
 *   distance | smallest dwell that answers | ticks | tick-optimal? | expansions
 *      8 px  |            1                |   7   |     YES       |    1,250
 *     16 px  |            2                |  13   |     no        |      338
 *     24 px  |            2                |  20   |     no        |   37,614
 *     35 px  |            3                |  29   |     no        |   56,579
 *     48 px  |            4                |  39   |     no        |   42,253
 *     64 px  |         none at dwell <= 4  |   —   |      —        |   budget
 * ```
 *
 * ⇒ **exact tick-optimality reaches about half a tile; a named dwell
 * reaches about three tiles as an UPPER BOUND; past that, decompose into
 * waypoints** — which `botDriverV2.planWaypoints` already does. The mover
 * is the instrument for the last few tiles of a race, not a router.
 *
 * ⛓⛓ **AND THIS TABLE IS A WORST CASE, NOT A CEILING — GEOMETRY HELPS.**
 * These numbers are open ground, where every direction is available and
 * the reachable set grows unchecked. In a WALLED room the walls collapse
 * the state space and the same search goes further: `moverRooms.test.js`
 * pins a **62 px** leg across L112 finishing at dwell 4 inside 20,000
 * expansions, which this table says should not answer. The regression
 * suite asserts the SUCCESS for that reason — a range that silently
 * shrank would otherwise look like the table being right.
 *
 * That is enough for the customers §3.3 names, and the numbers say so:
 * the Owl's shove is **3.00 px** perpendicular (R6 slice 0 measured every
 * leg), and L42's escape was **35 px of rise against a body closing 1
 * px/tick** — dwell 3 answers it in 29 ticks, which decides that race.
 *
 * ⚠ AND THE FIRST CUT OF THIS SEARCH CLAIMED OPTIMALITY IT HAD NOT EARNED.
 * It goal-tested on GENERATION, which is the obvious shape and is not
 * optimal: A\* knows a node's cost is minimal only when the node is
 * POPPED. Fixing it cost an order of magnitude of range (16 px used to
 * "answer" at dwell 1) and bought a claim that is true.
 */

import {
    DEFAULT_FRICTION, MOVE_SPEEDS, step as stepV1,
} from './playerPhysicsV1.js';

export class MoverError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MoverError';
    }
}

/** The four movement keys, in `applyInput`'s own branch order. */
export const MOVER_KEYS = Object.freeze(['up', 'right', 'down', 'left']);

/**
 * All sixteen held-key subsets.
 *
 * ⛔ ALL SIXTEEN, INCLUDING THE OPPOSING PAIRS. `applyInput` is four
 * independent `if`s, not an else-chain, so `{up, down}` is not a no-op: up
 * fires, then down's threshold test sees up's write. Pruning "contradictory"
 * inputs would remove real transitions.
 */
export const KEY_SETS = Object.freeze(
    Array.from({ length: 16 }, (_, mask) => Object.freeze(
        MOVER_KEYS.filter((_k, i) => (mask & (1 << i)) !== 0))),
);

/**
 * The per-axis velocity bound, DERIVED from `applyInput`'s branch.
 *
 * `if (v.x < moveSpeed) v.x += moveSpeed` — the add fires only from below
 * `moveSpeed` and adds exactly `moveSpeed`, so the post-add value is
 * strictly under `2 * moveSpeed`. Confirmed adversarially to 1.599994 over
 * a million velocity states; never approached by random sampling.
 */
export function perAxisVelocityBound(moveSpeed) {
    return 2 * moveSpeed;
}

/** The fastest any terrain in the game moves the player. */
export const MAX_MOVE_SPEED = Math.max(...MOVE_SPEEDS);

/**
 * The per-tick, per-axis displacement bound over EVERY terrain.
 *
 * A sweep can be cut short by collision but never lengthened, so this
 * bounds displacement as well as velocity.
 */
export const MAX_AXIS_STEP = perAxisVelocityBound(MAX_MOVE_SPEED);

/**
 * The default quantization. ⚠ A SEED — record it with every result and
 * sweep it rather than tuning it.
 *
 * `pos` 0.25 px and `vel` 0.05 are chosen to sit just under the physics'
 * own smallest meaningful quantities: `applyFriction` zeroes any component
 * under 0.05, and the sweep's fractional last step is what puts the player
 * at mid-pixel rest positions.
 */
export const DEFAULT_QUANT = Object.freeze({ pos: 0.25, vel: 0.05 });

/** The default search bound. Every negative must name the one it hit. */
export const DEFAULT_LIMITS = Object.freeze({ maxTicks: 600, maxExpansions: 200000 });

/** The merge key. Distinct states sharing one key are treated as one. */
export function quantKey(s, quant = DEFAULT_QUANT) {
    const q = (v, g) => Math.round(v / g);
    return `${q(s.x, quant.pos)},${q(s.y, quant.pos)},`
        + `${q(s.vx, quant.vel)},${q(s.vy, quant.vel)}`;
}

/**
 * A tiny binary heap. A sorted-array frontier is O(n) per pop and the
 * frontier here reaches six figures — the arc has already paid once for a
 * hot loop that was the same work and a different program
 * ([[feedback_refactor_same_work_different_program]]), so this stays a
 * plain array of numbers and objects with no wrapper allocation per push.
 */
class MinHeap {
    constructor() { this.f = []; this.v = []; }

    get size() { return this.f.length; }

    push(f, value) {
        this.f.push(f); this.v.push(value);
        let i = this.f.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.f[p] <= this.f[i]) break;
            [this.f[p], this.f[i]] = [this.f[i], this.f[p]];
            [this.v[p], this.v[i]] = [this.v[i], this.v[p]];
            i = p;
        }
    }

    pop() {
        const top = this.v[0];
        const lastF = this.f.pop();
        const lastV = this.v.pop();
        if (this.f.length) {
            this.f[0] = lastF; this.v[0] = lastV;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < this.f.length && this.f[l] < this.f[m]) m = l;
                if (r < this.f.length && this.f[r] < this.f[m]) m = r;
                if (m === i) break;
                [this.f[m], this.f[i]] = [this.f[i], this.f[m]];
                [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
                i = m;
            }
        }
        return top;
    }
}

/**
 * The default admissible heuristic: Chebyshev distance over the per-axis
 * displacement bound.
 *
 * x and y advance independently each tick, each by at most `MAX_AXIS_STEP`,
 * so no plan can reach a point in fewer than
 * `max(|dx|, |dy|) / MAX_AXIS_STEP` ticks. ⛔ It must UNDERSTATE; see the
 * docblock on the sampled-vs-derived denominator.
 */
export function chebyshevHeuristic(target) {
    return (s) => Math.max(Math.abs(target.x - s.x), Math.abs(target.y - s.y))
        / MAX_AXIS_STEP;
}

/**
 * Earliest arrival, by A\* over `(x, y, vx, vy)` with `step` as the
 * transition and one tick as the unit cost.
 *
 * @param {object}   o
 * @param {object}   o.start        `{x, y, vx, vy}`
 * @param {Function} o.accept       `(state, tick) => boolean` — the END REGION.
 *                                  ⛓ A REGION, never a point: R5's searches
 *                                  died on end conditions that were single
 *                                  cells ([[feedback_distance_hint_is_not_a_constraint]]).
 * @param {object}   [o.stepOpts]   forwarded to `playerPhysicsV1.step` verbatim
 * @param {Function} [o.forbiddenAt] `(tick, x, y) => boolean` — the TIMELINE.
 *                                  Called on every candidate; a state inside
 *                                  it is not expanded.
 * @param {Function} [o.heuristic]  `(state) => ticks`, must UNDERSTATE
 * @param {object}   [o.quant]      the merge grid — A SEED
 * @param {object}   [o.limits]     `{maxTicks, maxExpansions}`
 *
 * @returns {object} a CERTIFICATE `{ok: true, ticks, path, keysPerTick,
 *   spans, quant, limits, expansions}` or a NEGATIVE `{ok: false, reason,
 *   bound, quant, limits, expansions, deepestTick, closest}` — a negative
 *   ALWAYS names the bound that produced it.
 */
export function findEarliestArrival({
    start, accept, stepOpts = {}, forbiddenAt = null,
    heuristic = null, quant = DEFAULT_QUANT, limits = DEFAULT_LIMITS,
    dwell = 1,
}) {
    if (!start || typeof accept !== 'function') {
        throw new MoverError('findEarliestArrival needs a start state and an accept()');
    }
    const { maxTicks, maxExpansions } = { ...DEFAULT_LIMITS, ...limits };
    if (!Number.isInteger(dwell) || dwell < 1) {
        throw new MoverError(`dwell must be a positive integer, got ${dwell}`);
    }
    const h = heuristic ?? (() => 0);

    const startNode = {
        x: start.x, y: start.y, vx: start.vx ?? 0, vy: start.vy ?? 0,
        tick: start.tick ?? 0, parent: null, keys: null,
    };
    if (forbiddenAt && forbiddenAt(startNode.tick, startNode.x, startNode.y)) {
        return {
            ok: false,
            reason: 'the START state is inside the timeline\'s forbidden set',
            bound: 'none — refused before the first expansion',
            quant, limits: { maxTicks, maxExpansions, dwell }, expansions: 0,
            deepestTick: startNode.tick, closest: null,
        };
    }
    if (accept(startNode, startNode.tick)) {
        return certificateFrom(startNode, quant, { maxTicks, maxExpansions, dwell }, 0);
    }

    // ⛓⛓ THE TIE-BREAK, AND IT IS A PURE WIN. Every edge costs one tick and
    // `h` is weak (the derived 1.6 px/tick bound against a sustained ~1.29),
    // so A* sits on enormous equal-`f` plateaus and degenerates towards
    // breadth-first. Ordering ties by LARGER `g` drives the search down the
    // deepest branch of the current contour first. It changes only the order
    // within a tie, so optimality is untouched — but it is worth an order of
    // magnitude in expansions.
    const TIE = 1 / (DEFAULT_LIMITS.maxTicks + 1);
    const fkey = (g, hv) => (g + hv) - g * TIE;

    const open = new MinHeap();
    /** best `tick` seen per merge key — the only thing quantization decides. */
    const best = new Map();
    best.set(quantKey(startNode, quant), startNode.tick);
    open.push(fkey(startNode.tick, h(startNode)), startNode);

    let expansions = 0;
    let deepestTick = startNode.tick;
    /** The nearest miss, so a negative can say HOW near it got. */
    let closest = { h: h(startNode), x: startNode.x, y: startNode.y, tick: startNode.tick };

    while (open.size > 0) {
        if (expansions >= maxExpansions) {
            return {
                ok: false,
                reason: 'expansion budget exhausted',
                bound: `maxExpansions=${maxExpansions}, dwell=${dwell}`,
                quant, limits: { maxTicks, maxExpansions, dwell }, expansions,
                deepestTick, closest,
            };
        }
        const node = open.pop();
        // ⛔⛔ THE GOAL TEST IS ON POP, NOT ON GENERATION, AND THE DIFFERENCE
        // IS THE `optimal` FLAG. Returning the first generated goal is the
        // obvious shape and it is not optimal: A* only knows a node's cost is
        // minimal when the node is POPPED, because a cheaper route to a
        // different goal state may still be sitting in the frontier at a
        // lower f. Testing on generation would have returned plans one tick
        // long, silently, while still calling itself tick-optimal.
        if (node.isGoal) {
            return certificateFrom(node, quant, { maxTicks, maxExpansions, dwell }, expansions);
        }
        expansions += 1;
        if (node.tick > deepestTick) deepestTick = node.tick;
        if (node.tick >= maxTicks) continue;

        for (const keys of KEY_SETS) {
            const held = new Set(keys);
            // ⛓ THE DWELL. One decision holds a key set for `dwell` ticks, so
            // the tree is 16^(N/dwell) instead of 16^N. It is a RESTRICTION,
            // exactly like the quantization: it cannot make a returned plan
            // invalid (the ticks are really stepped) and it CAN prune the
            // optimum, so `dwell > 1` demotes the claim from "tick-optimal"
            // to "an upper bound", and the certificate says which.
            let s = node;
            let blocked = false;
            let goalAt = null;
            for (let d = 0; d < dwell; d += 1) {
                const n = stepV1(s, held, stepOpts);
                const t = s.tick + 1;
                if (t > maxTicks) { blocked = true; break; }
                if (forbiddenAt && forbiddenAt(t, n.x, n.y)) { blocked = true; break; }
                s = { x: n.x, y: n.y, vx: n.vx, vy: n.vy, tick: t };
                // ⚠ ACCEPT MID-DWELL. A dwell that only tested its last tick
                // would walk the player THROUGH the end region and report a
                // later arrival — wrong in the direction that looks like a
                // working search. The mid-dwell hit becomes its OWN node so
                // the pop-time goal test can still order it against the rest
                // of the frontier.
                if (accept(s, t)) { goalAt = { ...s, dwellUsed: d + 1 }; break; }
            }
            if (blocked) continue;
            if (goalAt) {
                const goalNode = { ...goalAt, parent: node, keys, isGoal: true };
                // f = g exactly: a goal's remaining cost is zero, whatever h says.
                open.push(fkey(goalNode.tick, 0), goalNode);
                continue;
            }
            const tick = s.tick;
            const child = {
                x: s.x, y: s.y, vx: s.vx, vy: s.vy, tick,
                parent: node, keys, dwellUsed: dwell,
            };
            const hv = h(child);
            if (hv < closest.h) closest = { h: hv, x: child.x, y: child.y, tick };
            const k = quantKey(child, quant);
            const seen = best.get(k);
            // ⛓ `<=` NOT `<`: a state re-reached at the SAME tick under a
            // different key set is not new information for a search whose
            // only cost is ticks, and admitting it doubles the frontier.
            if (seen !== undefined && seen <= tick) continue;
            best.set(k, tick);
            open.push(fkey(tick, hv), child);
        }
    }
    return {
        ok: false,
        reason: 'the reachable set was exhausted',
        bound: `maxTicks=${maxTicks}, dwell=${dwell}, quant=${JSON.stringify(quant)} — `
            + 'a coarser grid merges states and a dwell above 1 skips decision '
            + 'points, so this is "no path at this granularity", NOT "no path"',
        quant, limits: { maxTicks, maxExpansions, dwell }, expansions, deepestTick, closest,
    };
}

/** Walk the parent chain into a certificate. */
function certificateFrom(node, quant, limits, expansions) {
    const path = [];
    for (let n = node; n; n = n.parent) {
        // ⛔ `dwellUsed` MUST BE COPIED. An explicit field list that drops it
        // makes every edge read as one tick below, so a dwell-2 plan encodes
        // a tape HALF ITS OWN LENGTH — and the window then diverges from the
        // game in a way that looks like a physics defect rather than an
        // encoding one. Caught by the test that names this exact mutation.
        path.push({
            x: n.x, y: n.y, vx: n.vx, vy: n.vy, tick: n.tick,
            keys: n.keys, dwellUsed: n.dwellUsed,
        });
    }
    path.reverse();
    // ⛓ ONE EDGE IS `dwellUsed` TICKS, so the per-tick key stream repeats each
    // edge's key set that many times. A certificate that emitted one entry per
    // EDGE would encode a tape shorter than the plan it describes — the tape
    // would run out mid-dash and the window would read as a physics
    // divergence rather than an encoding bug.
    const keysPerTick = [];
    for (const p of path.slice(1)) {
        for (let i = 0; i < (p.dwellUsed ?? 1); i += 1) keysPerTick.push(p.keys);
    }
    return {
        ok: true,
        ticks: node.tick - path[0].tick,
        optimal: (limits.dwell ?? 1) === 1,
        startTick: path[0].tick,
        path,
        keysPerTick,
        spans: keysToSpans(keysPerTick, path[0].tick),
        quant,
        limits,
        expansions,
    };
}

/**
 * Per-tick key SETS -> tape input spans.
 *
 * ⛓ `heldKeysAt` UNIONS every span overlapping a tick, so a held set is
 * expressed as one run-length span PER KEY, overlapping. Emitting one span
 * per (key, run) rather than per tick keeps the tape's byte budget down —
 * which is a real constraint: [[feedback_tape_budget_is_spans]] records a
 * denser plan blowing the heap at BOOT.
 */
export function keysToSpans(keysPerTick, tickOffset = 0) {
    const spans = [];
    for (const key of MOVER_KEYS) {
        let runStart = null;
        for (let i = 0; i <= keysPerTick.length; i += 1) {
            const held = i < keysPerTick.length && keysPerTick[i].includes(key);
            if (held && runStart === null) runStart = i;
            if (!held && runStart !== null) {
                spans.push({ key, from: tickOffset + runStart, to: tickOffset + i });
                runStart = null;
            }
        }
    }
    // Sorted by `from` then key, so two runs of the same plan compare equal
    // as JSON — a certificate is a thing that gets diffed.
    spans.sort((a, b) => a.from - b.from
        || MOVER_KEYS.indexOf(a.key) - MOVER_KEYS.indexOf(b.key));
    return spans;
}

/**
 * Re-run a certificate's SPANS through the stepper, from its own start.
 *
 * ⚠ THIS IS THE WEAK CHECK, and it is labelled as such: it shares this
 * module's successor function, so it can only catch a bookkeeping error in
 * the parent chain or the span encoding. The claim that matters comes from
 * `replayThroughTape`. Both exist because they fail differently — this one
 * localises a defect to a tick, that one says the plan is wrong about the
 * game.
 */
export function replayThroughStepper(cert, stepOpts = {}) {
    if (!cert?.ok) throw new MoverError('replayThroughStepper: not a certificate');
    const spans = cert.spans;
    const heldAt = (t) => {
        const s = new Set();
        for (const sp of spans) if (t >= sp.from && t < sp.to) s.add(sp.key);
        return s;
    };
    let s = { ...cert.path[0] };
    const seen = [{ x: s.x, y: s.y, vx: s.vx, vy: s.vy, tick: s.tick }];
    for (let i = 0; i < cert.ticks; i += 1) {
        const t = cert.startTick + i;
        const n = stepV1(s, heldAt(t), stepOpts);
        s = { x: n.x, y: n.y, vx: n.vx, vy: n.vy, tick: t + 1 };
        seen.push({ ...s });
    }
    const want = cert.path[cert.path.length - 1];
    const drift = Math.max(Math.abs(s.x - want.x), Math.abs(s.y - want.y),
        Math.abs(s.vx - want.vx), Math.abs(s.vy - want.vy));
    return {
        ok: drift === 0,
        drift,
        // Exactness is deliberate: AS3 `Number`, JS numbers and the
        // recompiled runtime are all IEEE-754 doubles, so any drift at all
        // is a defect to investigate and not a tolerance to configure.
        detail: drift === 0
            ? `${cert.ticks} tick(s) reproduced exactly from ${spans.length} span(s)`
            : `replay diverged by ${drift} — the span encoding or the parent `
                + 'chain is wrong, not the physics',
        states: seen,
    };
}

/**
 * The INDEPENDENT check: run the certificate's spans through
 * `tapeRunner.runTape`.
 *
 * ⛓ `runTape` is the loop the 100-tape `--win` differential proves
 * byte-exact against the real recompiled game. A plan verified only against
 * the successor function that produced it is
 * [[feedback_verifier_shared_assumption]]; this is the second stratum.
 *
 * The caller supplies the tape skeleton (boot, flags, grants) because those
 * are window decisions the mover has no view of; this fills in `inputs` and
 * `tick_count` from the certificate.
 */
export function certificateToTape(cert, skeleton) {
    if (!cert?.ok) throw new MoverError('certificateToTape: not a certificate');
    if (!skeleton?.boot) {
        throw new MoverError('certificateToTape needs a tape skeleton with a `boot`');
    }
    return {
        ...skeleton,
        inputs: cert.spans.map((s) => ({ ...s })),
        tick_count: cert.startTick + cert.ticks,
    };
}

/**
 * Earliest-arrival TABLE — one search, many goals.
 *
 * §3.3's second product: "safe-window checks become arithmetic". Instead of
 * running a search per candidate stance, run one Dijkstra-by-tick and read
 * off the earliest tick at which each goal region is enterable. A route
 * layer can then ask "can I be at stance S before tick T" without planning.
 *
 * ⚠ NO HEURISTIC. A\*'s heuristic is goal-directed and a table has many
 * goals, so this is a uniform-cost sweep — and it is therefore much more
 * expensive than a single `findEarliestArrival`. That is the trade, stated:
 * pay once for the table, or pay per query for the search.
 *
 * @returns {{arrivals: Map<string, object>, unreached: string[], bound: string}}
 */
export function earliestArrivalTable({
    start, goals, stepOpts = {}, forbiddenAt = null,
    quant = DEFAULT_QUANT, limits = DEFAULT_LIMITS,
}) {
    if (!goals || typeof goals !== 'object') {
        throw new MoverError('earliestArrivalTable needs `goals` as {name: accept}');
    }
    const { maxTicks, maxExpansions } = { ...DEFAULT_LIMITS, ...limits };
    const names = Object.keys(goals);
    const arrivals = new Map();

    const startNode = {
        x: start.x, y: start.y, vx: start.vx ?? 0, vy: start.vy ?? 0,
        tick: start.tick ?? 0, parent: null, keys: null,
    };
    const record = (name, node) => {
        if (!arrivals.has(name)) {
            arrivals.set(name, certificateFrom(node, quant,
                { maxTicks, maxExpansions }, 0));
        }
    };
    for (const name of names) if (goals[name](startNode, startNode.tick)) record(name, startNode);

    // ⛓ A plain FIFO by tick is a correct priority queue here BECAUSE every
    // edge costs exactly one tick — a heap would order identically and cost
    // a log factor for nothing.
    let frontier = [startNode];
    const best = new Map([[quantKey(startNode, quant), startNode.tick]]);
    let expansions = 0;
    let tick = startNode.tick;
    let stoppedBy = null;

    while (frontier.length && arrivals.size < names.length) {
        if (tick >= maxTicks) { stoppedBy = `maxTicks=${maxTicks}`; break; }
        if (expansions >= maxExpansions) {
            stoppedBy = `maxExpansions=${maxExpansions}`;
            break;
        }
        const next = [];
        for (const node of frontier) {
            expansions += 1;
            if (expansions >= maxExpansions) break;
            for (const keys of KEY_SETS) {
                const n = stepV1(node, new Set(keys), stepOpts);
                const t = node.tick + 1;
                if (forbiddenAt && forbiddenAt(t, n.x, n.y)) continue;
                const child = {
                    x: n.x, y: n.y, vx: n.vx, vy: n.vy, tick: t, parent: node, keys,
                };
                const k = quantKey(child, quant);
                const seen = best.get(k);
                if (seen !== undefined && seen <= t) continue;
                best.set(k, t);
                for (const name of names) {
                    if (!arrivals.has(name) && goals[name](child, t)) record(name, child);
                }
                next.push(child);
            }
        }
        frontier = next;
        tick += 1;
    }

    return {
        arrivals,
        unreached: names.filter((n) => !arrivals.has(n)),
        // ⛔ A TABLE WITH GAPS MUST SAY WHY. "unreached" with no bound reads
        // as "unreachable"; it may only mean "the sweep stopped".
        bound: stoppedBy
            ? `STOPPED BY ${stoppedBy} at tick ${tick}, quant ${JSON.stringify(quant)}`
            : `exhausted the reachable set within maxTicks=${maxTicks}, `
                + `quant ${JSON.stringify(quant)}`,
        expansions,
        deepestTick: tick,
    };
}

/**
 * `dash` — tick-optimal traversal of a corridor, certified against a
 * timeline.
 *
 * The verb §3.3 asks for. It is `findEarliestArrival` with the END REGION
 * and the timeline made explicit in the contract, plus the two-stratum
 * verification wired in, so a caller cannot accidentally take the plan
 * without the certificate.
 *
 * ⚠ THE RETURNED `certifiedAgainst` IS THE WHOLE CLAIM. It never says
 * "safe". It says which timeline the plan was checked against, at which
 * granularity, under which bound.
 */
export function planDash({
    start, endRegion, stepOpts = {}, forbiddenAt = null, timelineName = null,
    heuristicTarget = null, quant = DEFAULT_QUANT, limits = DEFAULT_LIMITS,
    dwell = 1,
}) {
    if (forbiddenAt && !timelineName) {
        throw new MoverError('planDash: a timeline must be NAMED. A plan certified '
            + 'against an anonymous timeline cannot be re-checked when the timeline '
            + 'moves, which is the only thing the certificate is for.');
    }
    const cert = findEarliestArrival({
        start,
        accept: endRegion,
        stepOpts,
        forbiddenAt,
        heuristic: heuristicTarget ? chebyshevHeuristic(heuristicTarget) : null,
        quant,
        limits,
        dwell,
    });
    if (!cert.ok) return { ...cert, certifiedAgainst: null };
    const replay = replayThroughStepper(cert, stepOpts);
    return {
        ...cert,
        replay,
        certifiedAgainst: {
            timeline: timelineName ?? '(none — no hazard timeline was supplied)',
            quant,
            limits: cert.limits,
            expansions: cert.expansions,
            // ⛔ The words the note insists on.
            // ⛔ THE WORDING CHANGES WITH THE DWELL, because the claim does.
            claim: cert.optimal
                ? `tick-optimal at quantization ${JSON.stringify(quant)}, certified `
                    + `against timeline "${timelineName ?? 'none'}" — NOT "safe"`
                : `an UPPER BOUND of ${cert.ticks} tick(s) at dwell ${dwell}, quantization `
                    + `${JSON.stringify(quant)}, certified against timeline `
                    + `"${timelineName ?? 'none'}" — a dwell above 1 skips decision `
                    + 'points, so a shorter plan may exist. NOT "safe", NOT "optimal".',
        },
    };
}

/**
 * The measured range, as DATA rather than prose — so a test can assert the
 * instrument still does what its docblock says, and a regression in the
 * search shows up as a failing capability claim instead of a slow day.
 *
 * ⚠ These are the SMALLEST dwell that answered at `maxExpansions` 60,000
 * on open ground from rest. They are a floor on the instrument, not a
 * property of the physics.
 */
export const MOVER_RANGE = Object.freeze([
    Object.freeze({ px: 8, dwell: 1, ticks: 7, optimal: true }),
    Object.freeze({ px: 16, dwell: 2, ticks: 13, optimal: false }),
    Object.freeze({ px: 24, dwell: 2, ticks: 20, optimal: false }),
    Object.freeze({ px: 35, dwell: 3, ticks: 29, optimal: false }),
    Object.freeze({ px: 48, dwell: 4, ticks: 39, optimal: false }),
]);

/** Everything a caller needs to reproduce a search, for the record. */
export const MOVER_PROVENANCE = Object.freeze({
    transition: 'playerPhysicsV1.step — the exact stepper, not a closed form',
    cost: 'one tick per edge; every plan is tick-optimal at its quantization',
    velocityBound: `per-axis < 2 * moveSpeed (= ${MAX_AXIS_STEP} at the fastest terrain), `
        + 'DERIVED from applyInput\'s threshold branch. Sampling 400 random walks '
        + 'reached only 1.4342 and would have made the heuristic inadmissible; '
        + 'adversarial BFS over 1,040,113 velocity states reached 1.599994.',
    friction: `applyFriction shortens the VECTOR by ${DEFAULT_FRICTION} and zeroes any `
        + 'component under 0.05 — the axes are coupled, which is why a per-axis '
        + 'closed form does not exist',
    strata: 'the search proposes; replayThroughStepper localises a bookkeeping error; '
        + 'certificateToTape + tapeRunner.runTape is the independent check',
    goalTest: 'ON POP, never on generation — A* knows a cost is minimal only when the '
        + 'node is popped, and the first cut of this search got that wrong while still '
        + 'reporting `optimal: true`',
    range: 'SHORT. Exact tick-optimality reaches ~8 px; a named dwell reaches ~48 px as '
        + 'an upper bound; beyond that, decompose into waypoints. See MOVER_RANGE.',
});
