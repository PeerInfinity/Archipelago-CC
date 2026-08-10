/**
 * seedlingDemo/playthroughWalk — THE CHAIN, as data. R7 slice 2.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.1 (the segment,
 * defined), §3.2 (the seam), §4 slice 2. Precedent: `r1Walk.js`'s six
 * ENDS-MEET segments (`docs/json/developer/procgen/seedling-bot.md`, "The
 * six segments, and why ENDS-MEET is the load-bearing part").
 *
 * ── WHAT R1 PROVED, AND WHAT THIS UPGRADES ────────────────────────────
 *
 * R1 split an eleven-minute walk into six tapes and asserted that the six
 * are the headline TICK FOR TICK, with the tick counts summing to the
 * headline's exactly (910 + 3548 + 2844 + 1145 + 4361 + 2155 = 14963,
 * re-measured at slice 0 §8.6). That is arithmetic, not analogy — but it is
 * arithmetic about POSITIONS. Six tapes can meet on level, position, item
 * set and `hitsMax` and still be six unrelated walks in every other
 * respect: a different RNG stream, a different day/night phase, a different
 * persistence state, a different music rejection-loop state.
 *
 * ⛓ ENDS-MEET v2 carries the STATE. Every boundary is checked over the
 * whole `SEAM_SIGNATURE` — `boot(N+1) == latch(N)`, field by field, from
 * the GAME's own latch on one side and the successor tape's own eight
 * blocks on the other (`seamBootFields`). The concatenation identity stays,
 * because it is the thing that makes a deleted or reordered segment
 * impossible; the seam is what makes the chain a PLAYTHROUGH rather than a
 * partition of one recording.
 *
 * ── ⛔ THE TOY CHAIN IS A TOY ON PURPOSE ──────────────────────────────
 *
 * Slice 2 proves the machinery, not the playthrough. `r7-ends-meet-*` is
 * two adjacent ALREADY-MODELLED rooms — L0 and L94, the west teleporter
 * pair `transition-west-return` has covered since R1 — cut at the L94
 * arrival. Nothing about it is a claim about the game; everything about it
 * is a claim about the seam. The real segments start from
 * `new Game(0, 80, 128)` with an empty save at slice 5.
 *
 * ⚠ AND EVERY SEGMENT ENDS AT AN ARRIVAL, INCLUDING THE LAST. R1's
 * boundaries were arrivals because an arrival is the constructor half-tile
 * with zero velocity, which is the only state `boot: {level, x, y}`
 * reproduces (`Game`'s ctor takes ints and adds 8; every other tick's `x`
 * is a float). R7 adds the second half of the same rule: `requireCalm` is
 * TRUE for a segment, so the fade must be spent, `shake` zero, nothing
 * frozen, nobody talking. A tape that ends mid-coast is not a segment even
 * if its position happens to be an integer.
 */

import { fixtureNames } from './fixtures/index.js';

export class PlaythroughError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PlaythroughError';
    }
}

/**
 * ⛓ THE TRUE INITIAL STATE — `Main.as:50-51`, verified at slice 0 §8.2.
 *
 * The game's own boot on branch `bot` is `new Game(0, 80, 128)` with an
 * empty save. Segment 1 of the REAL chain must boot exactly this and
 * declare no seam block at all, because there is no predecessor to inherit
 * from — that is the custody claim's base case, and `playthroughAcceptance`
 * asserts it rather than assuming it.
 */
export const TRUE_INITIAL_BOOT = Object.freeze({ level: 0, x: 80, y: 128 });

/**
 * ⛔ THE CHAINS, ORDERED. One entry per chain; each names its headline and
 * its segments IN ORDER.
 *
 * `headline` is the same walk driven in ONE run. It is not decoration: the
 * concatenation identity is asserted against it, so a chain without one can
 * prove its seams and cannot prove it is the same walk.
 *
 * `freeOracle` names a COMMITTED, FROZEN fixture whose observation stream
 * the headline should reproduce. `transition-west-return` has been in the
 * roster since R1 and is byte-frozen; the toy headline is the same inputs
 * with `pins: ["dead_frames"]` added, so if the two streams agree, the pin
 * is observation-inert and the chain costs the roster nothing to believe.
 * If they DISAGREE that is a finding about the pin, reported by name — not
 * a failure of the chain.
 */
export const PLAYTHROUGH_CHAINS = Object.freeze([
    Object.freeze({
        id: 'toy-west-pair',
        why: '⛓ SLICE 2\'s PROOF OF THE MACHINERY, not of the game. Two adjacent '
            + 'already-modelled rooms (L0 and L94, the west teleporter pair) cut at the '
            + 'L94 ARRIVAL — the one tick in this walk that a `boot: {level, x, y}` can '
            + 'reproduce, because it is the constructor half-tile (288+8, 160+8) with a '
            + 'fresh Player at zero velocity.',
        headline: 'r7-ends-meet-full',
        freeOracle: 'transition-west-return',
        segments: Object.freeze(['r7-ends-meet-1', 'r7-ends-meet-2']),
        /**
         * ⚠ THE CUT TICK IS DATA, AND IT IS THE COMMITTED EXPECTATION'S OWN
         * TRANSITION RECORD — `transition-west-return` puts L0 -> L94 at
         * t=61 and L94 -> L0 at t=109. The chain ends at 109 rather than at
         * 150 so that the LAST segment also ends at an arrival; the
         * original tape's tail coasts to a stop mid-level, which is a
         * position no boot reproduces and a state `requireCalm` would have
         * to be switched off to accept.
         */
        cuts: Object.freeze([61]),
        endsAt: 109,
        /*
         * ⛓ NO `seamBuildCost`, AND ITS ABSENCE IS THE RESULT. Slice 2 had to
         * declare one — a segment boundary duplicated one L94 build (1562
         * gameplay draws, 21 dead frames, measured with zero residue) because
         * a tape declared a PRE-build stream position and the latch read a
         * POST-build one. Slice 2b's begin()-ENTRY latch made those the same
         * instant, so segment 2's own build consumes the same draws and the
         * chain ends where the headline ends. The bridge was DELETED rather
         * than adjusted, per §10.1 step 4 — see `chainFindings`' claim 4.
         */
        /**
         * ⛓ THE WALK ITSELF, so the planner and the tests read ONE source.
         *
         * The inputs are `transition-west-return`'s, unchanged — the same
         * two spans that have been in the roster since R1. What is added is
         * declared here rather than typed into a tape:
         *
         *  · `pins: ["dead_frames"]` — `save.time` is a `pinned-equality`
         *    signature row (`Game.as:832`'s `time += timeRate` counts DEAD
         *    frames, which are per-RENDER in vanilla and ±2-banded per
         *    load). A committed chain whose seam carries an unpinned `time`
         *    would go red on the sweep for a render count, not a defect.
         *  · `fpSeed` — the chain declares FlashPunk's LCG rather than
         *    inheriting it. ⚠ NOT because the page's own seed is random:
         *    `Engine.as:50` seeds it from one `Math.random()`, and in this
         *    build `Math.random()` is the fixed-seed avmplus LFSR (R5 slice
         *    23), so every page load gets the SAME seed — slice 2's probe
         *    measured a byte-identical triple across six loads. The chain
         *    declares it so that its reproducibility does not DEPEND on
         *    that coincidence of the build: a `MOCK_DATE_TIME` override at
         *    build time would move the boot seed and silently move an
         *    inherited chain with it. The value is a state the LCG really
         *    occupies (measured by slice 1's v8 probe), not a round number.
         */
        walk: Object.freeze({
            inputs: Object.freeze([
                Object.freeze({ key: 'left', from: 0, to: 72 }),
                Object.freeze({ key: 'right', from: 88, to: 140 }),
            ]),
            pins: Object.freeze(['dead_frames']),
            fpSeed: 987286273,
        }),
    }),
    Object.freeze({
        id: 'act2-to-l5',
        why: '⛓⛓⛓ ACT 2, AND THE FIRST HONEST SEGMENTS. The game\'s own opening, '
            + 'from `new Game(0, 80, 128)` with an empty save and nothing granted, cut '
            + 'at every level arrival: L0 -> L2 -> L3 -> L4 -> L5. It ends where the '
            + 'sword\'s corridor begins — L5\'s arrival, one room short of the kill-lock '
            + 'the arrow traps open (§15.3) — because L5\'s fight and L5\'s crossing are '
            + 'DIFFERENT SEGMENTS (§16.5) and this chain is the four that come first.',
        headline: 'r7-act2-full',
        segments: Object.freeze(['r7-act2-1', 'r7-act2-2', 'r7-act2-3', 'r7-act2-4']),
        /**
         * ⛔ THE CUTS ARE THE DRIVER'S OWN TRANSITION TICKS, DECLARED HERE
         * AND ASSERTED THERE.
         *
         * `plan-seedling-r7-act2.mjs` synthesizes the walk from `legs` below
         * and refuses to author anything unless `transitions` reports exactly
         * these ticks and `tick_count` is exactly `endsAt`. So the numbers are
         * a CLAIM about the route that the planner checks, rather than a
         * transcription of what it happened to produce — a route that shifts
         * by one tick under a physics edit is a named failure, not a silently
         * re-cut chain.
         */
        cuts: Object.freeze([183, 230, 475]),
        endsAt: 822,
        /**
         * ⛓ THE WALK IS LEGS, NOT SPANS, and that is the M1 generator's shape
         * arriving where §3.6 said it would.
         *
         * The toy chain could carry its inputs literally because they were
         * `transition-west-return`'s, unchanged since R1. This one cannot:
         * 41 spans, three of which are a 200-tick button hold and a 39-tick
         * LEAN on a pushable block, all of them positioned by A* against live
         * per-visit geometry. Typing them would be transcribing a
         * measurement; deriving them is what makes `--check` meaningful.
         *
         * ── ⛔⛔ THE L4 TARGETS ARE THE WHOLE OF SLICE 6c ─────────────────
         *
         * L4's tile layer walls column 2 at every row but (2,4), where
         * `pushableblock@32,64` stands — **the block IS the door** — and
         * slice 6b's chain stopped there with the planner calling the room
         * two components. The room's answer, in its own vocabulary:
         *
         *   hold   `button@16,64 {tset 0}` arms `arrowtrap@48,16` and
         *          `arrowtrap@64,16`. `bob@64,64` chases the player, presses
         *          against the block's east face in column 3 — which is
         *          `arrowtrap@48,16`'s own lane — and takes one damage per
         *          landed arrow through 30-tick i-frames. MEASURED at
         *          `hits 0 -> 1 -> 2 -> 3`, gone by t~158 of the tape
         *          (`probe-seedling-r7-l4-block.mjs`).
         *   shove  then the lean: the block glides (2,4) -> (4,4) and the
         *          walk goes north up column 3 to `stairsdown@64,16`.
         *
         * ⚠ THE HOLD IS 200 AND THE KILL LANDS AT ~115 OF IT. The margin is
         * deliberate and it is the only number here the model cannot check:
         * `levelWorld` carries no enemies, so offline the shove succeeds with
         * a one-tick hold too. The probe's PAIR is what makes 200 evidence —
         * its control holds the button for ONE tick, and the game leaves the
         * block on (3,4) with the bob alive on `hits 1`.
         *
         * ⚠ AND THE BLOCK STOPS ON (4,4) BECAUSE (5,4) IS A PIT. A third
         * tile would destroy the block and open the corridor just as well,
         * and the player following it would stand in `bob@64,64`'s spawn —
         * which `levelRun` refuses on a tape that does not declare
         * `noDamage`. The route's two tiles are the game's arithmetic.
         */
        walk: Object.freeze({
            legs: Object.freeze([
                Object.freeze({ level: 0, targets: Object.freeze([]), exit: Object.freeze({ x: 256, y: 272 }) }),
                Object.freeze({ level: 2, targets: Object.freeze([]), exit: Object.freeze({ x: 48, y: 96 }) }),
                Object.freeze({ level: 3, targets: Object.freeze([]), exit: Object.freeze({ x: 128, y: 48 }) }),
                Object.freeze({
                    level: 4,
                    targets: Object.freeze([
                        Object.freeze({
                            x: 24,
                            y: 72,
                            hold: Object.freeze({ presser: Object.freeze({ x: 16, y: 64 }), ticks: 200 }),
                        }),
                        Object.freeze({
                            x: 24,
                            y: 72,
                            shove: Object.freeze({
                                block: Object.freeze({ x: 32, y: 64 }),
                                dir: 'E',
                                to: Object.freeze({ tx: 4, ty: 4 }),
                            }),
                        }),
                    ]),
                    exit: Object.freeze({ x: 64, y: 16 }),
                }),
                Object.freeze({ level: 5, targets: Object.freeze([]) }),
            ]),
            pins: Object.freeze(['dead_frames']),
            /**
             * ⚠ THE SAME DECLARED FP SEED AS THE TOY CHAIN, for the same
             * reason and not by inheritance: FlashPunk seeds its LCG once per
             * PAGE from one `Math.random()`, and a committed chain cannot
             * depend on a page's coincidence. The value is a state the LCG
             * really occupies, measured by slice 1's v8 probe.
             */
            fpSeed: 987286273,
        }),
    }),
]);

/**
 * A chain's segment boundaries as `[from, to)` spans. `[0, cut0)`,
 * `[cut0, cut1)`, … `[cutN, endsAt)`.
 *
 * ⚠ DERIVED FROM `cuts` AND `endsAt`, never listed. The tick counts a
 * planner writes into the tapes come from here, which is why the ENDS-MEET
 * arithmetic (`sum(tick_count) === headline.tick_count`) is a check on the
 * RECORDING rather than a restatement of the plan.
 */
export function chainSpans(chain) {
    const bounds = [0, ...chain.cuts, chain.endsAt];
    return bounds.slice(0, -1).map((from, i) => ({ from, to: bounds[i + 1] }));
}

/**
 * The input spans a `[from, to)` window sees, shifted to start at 0.
 *
 * ⚠ Spans are HALF-OPEN (`tapeFormat`: "spans are [from, to)"), so a hold
 * that is live at the cut tick stays live in BOTH the window that ends
 * there and the window that starts there — which is what makes the boundary
 * tick observable twice with the same input state.
 */
export function chainInputsFor(inputs, from, to) {
    return inputs
        .map((s) => ({ key: s.key, from: Math.max(s.from, from), to: Math.min(s.to, to) }))
        .filter((s) => s.to > s.from)
        .map((s) => ({ key: s.key, from: s.from - from, to: s.to - from }));
}

/** Every segment tape name in every chain, in chain order. */
export function playthroughSegmentNames() {
    return PLAYTHROUGH_CHAINS.flatMap((c) => c.segments);
}

/** Every tape a chain owns — segments plus the headline. */
export function playthroughTapeNames() {
    return PLAYTHROUGH_CHAINS.flatMap((c) => [...c.segments, c.headline]);
}

/**
 * ⛔⛔ THE PREDICATE THE SWEEP BRANCHES ON, and it is why `requireCalm` can
 * be true HERE and false for the roster.
 *
 * The 118 committed fixtures do not end at arrivals — that convention
 * arrives with the segments — so `verify-seedling-bot-differential.mjs`
 * runs `seamLatchFindings(..., {requireCalm: false})` on all of them and
 * reports the invariants without requiring them. A SEGMENT claims an
 * arrival by construction, so it is required, and this is the only thing
 * that tells the two apart.
 *
 * ⚠ IT IS A NAMED SET, WHICH MEANS IT CAN ONLY FAIL ONE WAY — by NOT
 * demanding calm of something that should be a segment. That is the safe
 * direction (`fixtures/tiers.js`'s rule, in its other form): a fixture
 * added tomorrow and forgotten here is checked less strictly, never
 * wrongly. `assertChainsWellFormed` closes the gap by asserting every name
 * is a real fixture, so a rename is a NAMED failure and not a silent
 * demotion.
 */
export function isPlaythroughSegment(name) {
    return playthroughSegmentNames().includes(name);
}

/**
 * ⛔ EVERY NAME IS A REAL FIXTURE, AND EVERY CHAIN IS ORDERED AND
 * NON-EMPTY. A chain naming a tape that does not exist checks nothing and
 * reads exactly like a chain that passes.
 *
 * ⚠ Called with the roster so a test can pass a synthetic one; defaults to
 * what is on disk, derived, never a stored count.
 */
export function assertChainsWellFormed(roster = fixtureNames()) {
    const seen = new Set();
    for (const chain of PLAYTHROUGH_CHAINS) {
        if (chain.segments.length < 2) {
            throw new PlaythroughError(
                `chain "${chain.id}" has ${chain.segments.length} segment(s); a chain `
                + 'with fewer than two has no seam, and a seam is the whole claim');
        }
        if (chain.cuts.length !== chain.segments.length - 1) {
            throw new PlaythroughError(
                `chain "${chain.id}" declares ${chain.cuts.length} cut(s) for `
                + `${chain.segments.length} segments; a chain of N segments has exactly `
                + 'N-1 seams and the cut list IS the seam list');
        }
        for (const name of [...chain.segments, chain.headline, chain.freeOracle]) {
            if (name === undefined || name === null) continue;
            if (!roster.includes(name)) {
                throw new PlaythroughError(
                    `chain "${chain.id}" names "${name}", which is not a fixture. A `
                    + 'chain naming a tape that does not exist asserts nothing and '
                    + 'reports the same green as one that does.');
            }
        }
        for (const name of chain.segments) {
            if (seen.has(name)) {
                throw new PlaythroughError(
                    `"${name}" appears in more than one chain; a segment belongs to `
                    + 'exactly one custody chain or the chain claim is ambiguous');
            }
            seen.add(name);
        }
    }
    return {
        chains: PLAYTHROUGH_CHAINS.length,
        segments: playthroughSegmentNames().length,
        seams: PLAYTHROUGH_CHAINS.reduce((n, c) => n + c.segments.length - 1, 0),
    };
}
