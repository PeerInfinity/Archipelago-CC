/**
 * seedlingDemo/rng — `Math.random()`, transcribed from the runtime that
 * actually runs the game.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6a. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §14.1, §14.12.
 *
 * ── WHY A MODEL OF THE RANDOM NUMBER GENERATOR ────────────────────────
 *
 * The Owl fight (L112) is the first room on the whole ladder whose GAMEPLAY
 * reads a random number: `FinalBoss.update` rolls `rockFrequency` every tick
 * to decide whether a rock falls, rolls two more for where, and `RockFall`
 * rolls its own scale into a `setHitbox` — so whether a rock HITS is a draw,
 * a hit is a knockback, and a knockback moves the `{t,x,y,level}` stream the
 * differential compares byte for byte.
 *
 * ⛔ AND §8.3's CENSUS DOES NOT COVER THIS. That census proved the fight
 * REPRODUCES — L112 has no render-coupled draw site, so two runs of one tape
 * see the same rocks. Reproducibility is not predictability: to say what the
 * next rock does, a model needs the generator's ABSOLUTE POSITION in its
 * stream, which is the whole page's history since load. Per-object draw
 * counts ("RockFall is one draw") are DELTAS, and a delta with no origin
 * predicts nothing.
 *
 * `Bot.botStart` supplies the origin: a v7 tape declares `rng.seed` and the
 * bot writes it into the generator AFTER the world is built, so the model
 * owes only the draws the recorded window itself consumes. This module is
 * the other half — the arithmetic those draws come out of.
 *
 * ── THE GENERATOR, from `SWFModernRuntime/src/avm2/avm2_number.c` ─────
 *
 * An avmplus-compatible 31-bit XOR-shift LFSR whose ENTIRE state is one
 * uint32, followed by a stateless hash:
 *
 *     step:  u = (u & 1) ? (u >>> 1) ^ 0x48000000 : u >>> 1
 *     out:   hash((int32) u * 71) & 0x7FFFFFFF
 *     value: out / 2147483648
 *
 * ⚠ **EVERY MULTIPLY IS int32 WITH WRAPAROUND, WHICH IS WHY THIS FILE IS
 * FULL OF `Math.imul`.** The C runs on wasm32, where `long` is 32 bits, so
 * `aNum * 71L` and the hasher's three products all truncate. A JS `*` would
 * carry them into double precision and be right for the first few draws and
 * wrong forever after — the failure mode that looks like a correct
 * transcription with a mysterious late divergence.
 *
 * ⚠ **AND THE STATE IS UNSIGNED WHILE THE HASH IS SIGNED.** `u` is a uint32
 * (`>>>`, and `>>> 0` after the xor); the value handed to the hasher is that
 * same bit pattern read as int32 (`| 0`). ⛓ With the REAL mask (0x48000000,
 * see `XOR_MASK`) the orbit never sets bit 31, so on a reachable state the
 * two readings coincide — the distinction is kept because the C keeps it and
 * because it was load-bearing under the mask the plan believed in.
 *
 * ── WHAT PINS IT ──────────────────────────────────────────────────────
 *
 * The xor mask is `avm2_random_xor_masks[29]` for n = 31, the three hasher
 * constants are avmplus's, and the boot seed is
 * `(uint32)(MOCK_DATE_TIME * 1000)` — a `-D` at build time, defaulted to
 * 981152406000, so `BOOT_SEED` is 1486967168 for every artifact built
 * without an override. All four are asserted in `rng.test.js` against draws
 * taken from the LIVE GAME through `botRngProbe`, because the game is the
 * only oracle: a table of expected values copied out of this file would be
 * checking the transcription against itself.
 */

/**
 * `avm2_random_xor_masks[31 - 2]` — the n = 31 tap.
 *
 * ⛔⛔⛔ **INDEX 29, NOT INDEX 30, AND THE PLAN SAID 0xA3000000.** Kickoff
 * §14.1 transcribed the C's `uXorMask = avm2_random_xor_masks[n - 2]` and
 * then wrote the LAST entry of the table beside it. `0xA3000000` is index
 * 30; index 29 is `0x48000000`, and the live game says so: seeded at 1 its
 * state after one step is 1207959552 = 0x48000000. **The first run of
 * `probe-seedling-rng.mjs` caught it**, which is the entire argument for
 * taking known answers from the game instead of from a reading of the
 * source — a hand-built vector table would have been derived from the same
 * misreading and agreed with it.
 *
 * ⛓ AND THE VALUE CHANGES THE STATE SPACE. `0x48000000` has bit 31 CLEAR,
 * so `(u >>> 1) ^ mask` is always below 2^31: the orbit lives entirely in
 * [1, 2^31), which is exactly the `uSequenceLength` the C computes. With
 * `0xA3000000` half the states would have had the top bit set and read as
 * NEGATIVE int32 going into the hasher. That is why `rng.seed` is bounded
 * at 2^31 - 1 in `tapeFormat` rather than at 2^32 - 1.
 */
export const XOR_MASK = 0x48000000;

/**
 * `(uint32)((int64_t) MOCK_DATE_TIME * 1000)` at the default 981152406000.
 *
 * ⚠ A BUILD-TIME CONSTANT, NOT A UNIVERSAL ONE. A wasm artifact built with
 * a different `MOCK_DATE_TIME` boots on a different seed and every
 * unseeded stream shifts; the artifact hash is what pins it. This value
 * matters only where a tape declares seed 0 (or a probe asks for it), which
 * means "inherit the build's own boot state".
 */
export const BOOT_SEED = 1486967168;

/** The hasher's three avmplus constants. */
export const HASH_C1 = 1376312589;
export const HASH_C2 = 789221;
export const HASH_C3 = 15731;

/** `Math.random()`'s divisor — 2^31, not 2^32: the output is masked to 31 bits. */
export const RANDOM_DIVISOR = 2147483648;

/**
 * `avm2_random_pure_hasher`, transcribed.
 *
 * Two `<<13 ^ >>21` rounds around one cubic. Every operation is int32:
 * `<<`, `>>` and `^` already are in JS, and the three products need
 * `Math.imul` (see the file docblock).
 */
export function hash(iSeed) {
    let s = iSeed | 0;
    s = (((s << 13) ^ s) - (s >> 21)) | 0;
    // (s * (s * s * c3 + c2) + c1) & 0x7FFFFFFF — left-associative, and each
    // step truncates to int32 before the next one sees it.
    let r = Math.imul(s, (Math.imul(Math.imul(s, s), HASH_C3) + HASH_C2) | 0);
    r = ((r + HASH_C1) | 0) & 0x7FFFFFFF;
    r = (r + s) | 0;
    r = (((r << 13) ^ r) - (r >> 21)) | 0;
    return r | 0;
}

/**
 * One LFSR step. `u` in, the NEXT state out, both uint32.
 *
 * ⛓ 0 is not a reachable state and that is load-bearing elsewhere: an odd
 * `u` xors to a nonzero mask, and an even one shifts down through an odd one
 * first, so the orbit never enters 0. That is what frees 0 to mean "no seed
 * declared" in a v7 tape and "the build's boot seed" in the runtime hook.
 */
export function step(u) {
    const v = u >>> 0;
    return ((v & 1) ? ((v >>> 1) ^ XOR_MASK) : (v >>> 1)) >>> 0;
}

/**
 * The largest state the orbit contains — `uSequenceLength` in the C, and
 * the ceiling `rng.seed` is validated against.
 */
export const STATE_MAX = 2147483647;

/**
 * The raw 31-bit output for a state — `avm2_generate_random_number`'s tail.
 *
 * ⚠ The state is read as int32 here (`| 0`) and multiplied by 71 with
 * wraparound — which is exactly what the C does. A `u` above 2^31 would be a
 * NEGATIVE seed to the hasher; the real mask keeps the orbit below that, so
 * the sign only ever matters to a state somebody wrote in by hand.
 */
export function rawFor(u) {
    return hash(Math.imul(u | 0, 71)) & 0x7FFFFFFF;
}

/**
 * The generator, as an object with the same shape as the C static.
 *
 * `new SeedlingRng(seed)` — seed 0 means the build's boot seed, matching
 * both the runtime's lazy init and `swfmodern.Rng.setState(0)`.
 */
export class SeedlingRng {
    constructor(seed = 0) {
        this.state = (seed >>> 0) === 0 ? BOOT_SEED : (seed >>> 0);
    }

    /** One `Math.random()`: steps the state, then reads it. */
    next() {
        this.state = step(this.state);
        return rawFor(this.state) / RANDOM_DIVISOR;
    }

    /** The raw 31-bit integer instead of the [0,1) Number. */
    nextRaw() {
        this.state = step(this.state);
        return rawFor(this.state);
    }

    /**
     * `Math.floor(Math.random() * n)` — the game's own idiom at every
     * gameplay draw site that picks an index or gates a frequency.
     */
    nextIndex(n) {
        return Math.floor(this.next() * n);
    }
}

/**
 * `n` draws from `seed`, with the state after each — the shape
 * `botRngProbe` returns, so a known-answer test is one deep-equal.
 */
export function draws(seed, n) {
    const rng = new SeedlingRng(seed);
    const out = { draws: [], states: [] };
    for (let i = 0; i < n; i++) {
        out.draws.push(rng.next());
        out.states.push(rng.state);
    }
    return out;
}
