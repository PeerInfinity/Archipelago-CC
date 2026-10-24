/**
 * seedlingDemo/procgenRng — THE SEEDLING SOURCE for `procgenCore/procgenRng`.
 *
 * Seedling PROCGEN PoC arc, slice 1; ⛓ CONSTRUCTIVE-MODE arc, slice 2 split
 * the file in two. The VOCABULARY (`nextInt`, `pick`, `shuffle`, `draws`,
 * `state`) is `procgenCore/procgenRng.js`'s and is shared with the maze; what
 * stayed here is the one thing that is a SEEDLING fact — which generator the
 * numbers come out of, and which seeds it can honestly carry.
 *
 * ── WHY THE SOURCE IS `rng.js` AND NOT ARITHMETIC OF ITS OWN ──────────
 *
 * `rng.js` already carries a seeded, dependency-free, integer-exact generator
 * whose transcription is asserted against draws taken from the LIVE GAME
 * (`rng.test.js`). A second PRNG here would be a second stream nobody
 * compares — the one-of-everything law, applied to the smallest thing in the
 * arc.
 *
 * ⚠ **AND THE TWO STREAMS ARE NOT THE SAME STREAM, WHICH IS THE WHOLE
 * REASON FOR A SEPARATE FILE.** `SeedlingRng` models `Math.random()` *inside
 * the game* — a tape's `rng.seed` writes the generator the GAME will draw
 * from, and its absolute position is the page's whole history. A generation
 * seed is a name for a LEVEL and reaches no tape header. Same arithmetic,
 * different universes; a call site that took one for the other would be
 * seeding the game's rocks with the level's identity.
 *
 * ⛔ SEED 0 IS REFUSED. To `SeedlingRng`, 0 means "inherit the build's boot
 * seed" (`BOOT_SEED`, a `MOCK_DATE_TIME` constant) — a perfectly sensible
 * sentence about a tape and a lie about a level, whose seed is supposed to
 * BE its identity. A level generated at "seed 0" would be reproducible only
 * on artifacts built with the same clock stub. ⛓ This is why the seed check is
 * the SOURCE's and not the core's: the maze's mulberry32 has no such sentence
 * to tell, and a shared range would be one generator's fact imposed on the
 * other.
 *
 * ⛔ NO NODE IMPORTS (see `atlasSource.js`).
 */

import { ProcgenRng, ProcgenRngError } from '../procgenCore/procgenRng.js';
import { STATE_MAX, SeedlingRng } from './rng.js';

export { ProcgenRng, ProcgenRngError };

/** The seed range a level's identity may live in — `rng.js`'s own orbit. */
export const SEED_MIN = 1;
export const SEED_MAX = STATE_MAX;

/** A seed, checked. Returned so a caller can write `assertSeed(s)` inline. */
export function assertSeed(seed) {
    if (!Number.isInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
        throw new ProcgenRngError(`procgenRng: the seed must be an integer in [${SEED_MIN}, `
            + `${SEED_MAX}] — got ${JSON.stringify(seed)}. 0 is excluded on purpose: to the `
            + 'game\'s own generator it means "the build\'s boot seed", and a level\'s seed '
            + 'is its identity, not an inheritance.');
    }
    return seed;
}

/**
 * ⛓ THE SOURCE, and it is a THIN ADAPTER BY CONSTRUCTION — three arrow
 * functions that forward to `SeedlingRng`'s own `next`, `nextIndex` and
 * `state`. ⛔ Not one line of the arithmetic is re-spelled here, which is why
 * the stream is byte-identical across the CONSTRUCTIVE-MODE slice-2 move: the
 * draws are the same object's draws, reached through one more call frame.
 */
export const SEEDLING_RNG_SOURCE = Object.freeze({
    name: 'SeedlingRng (the game\'s own Math.random)',
    assertSeed,
    create: (seed) => {
        const r = new SeedlingRng(seed);
        return {
            next: () => r.next(),
            nextIndex: (n) => r.nextIndex(n),
            get state() { return r.state; },
        };
    },
});

/** `new ProcgenRng(seed, …)` over the Seedling source, for call sites that
 *  read better as a function. ⛔ The ONE place a Seedling generation stream is
 *  constructed — the model's room stream and the loop's template stream both
 *  come through here. */
export const rngFor = (seed) => new ProcgenRng(seed, { source: SEEDLING_RNG_SOURCE });
