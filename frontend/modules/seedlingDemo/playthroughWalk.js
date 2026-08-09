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
        /**
         * ⛓⛓⛓ THE SEAM'S PRICE, MEASURED — and this is §6.2's open ruling
         * standing on a number instead of an argument.
         *
         * A segment boundary at an ARRIVAL duplicates exactly one level
         * BUILD. The contiguous run builds L94 once (it arrives there); the
         * segmented pair builds it twice (segment 1 arrives into it, segment
         * 2 boots into it). And `Bot.botStart` applies `Rng.setState` BEFORE
         * that build — "the declared seed is the build's first number"
         * (`Bot.as:1689`) — so the boot side's `rng.gameplay` is a PRE-build
         * quantity while the latch's is a POST-build one. They are not the
         * same kind of number, and no declaration can make them one.
         *
         * ⛔ SO THE ENDING STATE IS NOT ASSERTED EQUAL. IT IS ASSERTED
         * OFFSET, BY THIS MUCH, and that is a HARDER claim than equality
         * would have been if it were reachable: a drift of one draw or one
         * frame goes red. The two numbers are not fitted to the chain —
         * they are L94's own build cost, measured independently by
         * `scripts/procgen/probe-seedling-build-cost.mjs` (boot the level
         * with a declared seed and `tick_count: 0`; the distance from
         * declaration to latch IS the build):
         *
         *     L94's build = 1562 gameplay draws, 21 dead frames
         *     the seam's delta = 1562 LFSR steps, +21 `save.time`
         *
         * Zero residue. 409 tiles x 3 draws (`Tile.as:97-99`) = 1227 of the
         * 1562; the other 335 are the 33 entity constructions.
         *
         * ⚠ THIS BLOCK IS THE FALLBACK, NOT THE PREFERENCE. §6.2's ruled
         * preference is RNG-CONTIGUOUS seams, and the gap is one named
         * quantity the fork does not latch today: the stream state at
         * `Game.begin()` ENTRY of the arrival world. If a later batch latches
         * that, segment N+1 declares it, its own build consumes the same
         * 1562 draws, and this whole declaration is DELETED rather than
         * adjusted.
         */
        seamBuildCost: Object.freeze({
            level: 94,
            draws: 1562,
            deadFrames: 21,
            cite: 'probe-seedling-build-cost.mjs --levels=94; Tile.as:97-99; '
                + 'Game.as:832 (`time += timeRate`, below the blackCover gate)',
        }),
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
