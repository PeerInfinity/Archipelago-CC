/**
 * rngRuler — **A RECORDED `Rng.state` IS A DRAW INDEX.** R9 slice 12f.
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * Every seam, latch and `botStatus` block in this arc carries `rng.gameplay`
 * / `rng.state`, and until now two of them could only be compared for
 * EQUALITY. That made a disagreement unreadable: `1029458650` vs
 * `1196888758` says "different", and a slice then argues about which page
 * was "right" (⚖ 56 forbade exactly that, and it was right to).
 *
 * They are not opaque tokens. The recompiled runtime's `Math.random()` is one
 * global 31-bit XOR-shift LFSR whose ENTIRE state is a single `uint32`, and
 * `swfmodern.Rng.state` returns that register raw — `avm2_number.c`'s
 * `rng_state` is `avm2_number((double) g_avm2_rng.uValue)`. The step is
 * `avm2_random_next`:
 *
 *     if (r->uValue & 1u)  r->uValue = (r->uValue >> 1) ^ r->uXorMask;
 *     else                 r->uValue >>= 1;
 *
 * — the returned Number is a HASH of the new register and never feeds back,
 * so the register sequence is a pure orbit. ⇒ **a state IS a position on
 * that orbit, and the distance between two states is the number of draws
 * between them.** No drive, no instrument, no rebuild.
 *
 * That is what turned slice 12f's stop from "two pages disagree" into "S1's
 * page drew exactly TWO MORE times, all of them before tick 145" in one
 * offline measurement — and it is what lets `--rng-curve`'s samples become an
 * absolute draw counter instead of a list of opaque integers.
 *
 * ⚠⚠ IT IS A CLAIM ABOUT THE *GAMEPLAY* STREAM ONLY, and only while the run
 * never calls `Rng.setState`. `botStart` reseeds (`Bot.as:1781`), so a
 * distance is meaningful WITHIN one armed window and across a boundary only
 * if you re-anchor on the new seed. The cosmetic generator is a second
 * `Avm2RandomFast` with the same step, so the same ruler reads it — but with
 * `Rng.split` false `cos()` IS `Math.random()` and the cosmetic register
 * never moves at all.
 *
 * ⚠ The orbit is finite: the register is 31 bits and the period is
 * 2**31 - 1. `distance` therefore takes a LIMIT and returns `null` rather
 * than walking two billion steps to prove a non-answer. A `null` means "not
 * within `limit` draws in this direction", never "unrelated".
 */

/**
 * avmplus' XOR-mask table, TRANSCRIBED WHOLE rather than reduced to the one
 * entry this build uses.
 *
 * Provenance: `~/CC/SWFRecomp-CC/SWFModernRuntime/src/avm2/avm2_number.c:468`
 * (`avm2_random_xor_masks[31]`), which is itself avmplus-compatible. It lives
 * in another repository, so it cannot be imported; keeping the table and the
 * INDEXING EXPRESSION means the derivation `masks[n - 2]` is spelled here the
 * way the C spells it, instead of the answer being typed in as a magic
 * number (⚖ 17: derive; a literal only with provenance).
 */
export const AVM2_RANDOM_XOR_MASKS = [
    0x00000003, 0x00000006, 0x0000000C, 0x00000014, 0x00000030, 0x00000060,
    0x000000B8, 0x00000110, 0x00000240, 0x00000500, 0x00000CA0, 0x00001B00,
    0x00003500, 0x00006000, 0x0000B400, 0x00012000, 0x00020400, 0x00072000,
    0x00090000, 0x00140000, 0x00300000, 0x00400000, 0x00D80000, 0x01200000,
    0x03880000, 0x07200000, 0x09000000, 0x14000000, 0x32800000, 0x48000000,
    0xA3000000,
];

/**
 * The register width `avm2_random_seed` always uses: `int n = 31;`
 * (`avm2_number.c:503`). Nothing in the runtime ever seeds a shorter one.
 */
export const AVM2_RANDOM_BITS = 31;

/** `r->uXorMask = avm2_random_xor_masks[n - 2]` — the same expression. */
export const AVM2_RANDOM_MASK = AVM2_RANDOM_XOR_MASKS[AVM2_RANDOM_BITS - 2];

/** The build's own boot seed when `setState(0)` is asked for, with no `-DMOCK_DATE_TIME`. */
export const AVM2_RANDOM_BOOT_SEED = 987654321;

/**
 * ONE DRAW: the register after `avm2_random_next`.
 *
 * ⛔ The zero guard is the C's, not a convenience: `avm2_random_next` reseeds
 * a zeroed register before stepping it, so 0 is not a fixed point and a ruler
 * that treated it as one would report a distance through a state the game
 * cannot occupy.
 */
export function rngStep(state) {
    let v = state >>> 0;
    if (v === 0) v = AVM2_RANDOM_BOOT_SEED >>> 0;
    return ((v & 1) ? ((v >>> 1) ^ AVM2_RANDOM_MASK) : (v >>> 1)) >>> 0;
}

/**
 * How many draws from `from` to `to`, or `null` if `to` is not reached within
 * `limit`.
 *
 * ⚠ DIRECTED. `rngDistance(a, b)` and `rngDistance(b, a)` are different
 * questions and at most one of them has a small answer; a caller comparing
 * two pages must say which page it thinks drew MORE, and the answer is the
 * one that comes back non-null.
 */
export function rngDistance(from, to, { limit = 20_000_000 } = {}) {
    const target = to >>> 0;
    let v = from >>> 0;
    for (let i = 1; i <= limit; i += 1) {
        v = rngStep(v);
        if (v === target) return i;
    }
    return null;
}

/**
 * The draw INDEX of `state` counted from `seed` — i.e. how many draws the
 * page had spent since `Rng.setState(seed)` when this state was read.
 *
 * `rngDrawIndex(seed, seed)` is 0 by definition: a tape's `rng.seed` is the
 * origin, not the first draw.
 */
export function rngDrawIndex(seed, state, { limit = 20_000_000 } = {}) {
    if ((seed >>> 0) === (state >>> 0)) return 0;
    return rngDistance(seed, state, { limit });
}

/**
 * An index for a whole run: `state -> draw index`, built once, for turning a
 * `--rng-curve` sidecar into an absolute draw counter in one pass.
 *
 * ⚠ `span` is a BOUND YOU MUST CHOOSE and the map is silent about states past
 * it — `curveDrawIndices` reports those as `null` rather than as 0.
 */
export function rngIndexFrom(seed, { span = 200_000 } = {}) {
    const seen = new Map();
    let v = seed >>> 0;
    for (let i = 0; i <= span; i += 1) {
        if (!seen.has(v)) seen.set(v, i);
        v = rngStep(v);
    }
    return seen;
}

/**
 * A `--rng-curve` sidecar's rows, each gaining `draws` (absolute, from
 * `seed`) and `spent` (draws since the previous row).
 *
 * ⛔ A row whose state is not on the indexed span gets `draws: null`, and the
 * `spent` of the row after it is `null` too. A ruler that quietly wrote 0
 * there would turn "I could not measure this" into "nothing happened", which
 * is the one answer a divergence hunt must never be handed.
 */
export function curveDrawIndices(curve, seed, { span = 200_000 } = {}) {
    const index = rngIndexFrom(seed, { span });
    let prev = null;
    return curve.map((row) => {
        const draws = index.has(row.state >>> 0) ? index.get(row.state >>> 0) : null;
        const spent = (draws === null || prev === null) ? null : draws - prev;
        prev = draws;
        return { ...row, draws, spent };
    });
}
