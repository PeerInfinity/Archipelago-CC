/**
 * mazeRoom/procgenRng — THE MAZE SOURCE for `procgenCore/procgenRng`.
 *
 * CONSTRUCTIVE-MODE arc, slice 2 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.2). The generator vocabulary (`pick`, `shuffle`, `nextInt`,
 * `draws`, `state`) is `procgenCore/procgenRng.js`'s and is shared with
 * Seedling; the only thing that is a MAZE fact is which arithmetic the numbers
 * come out of, and that is `shared/rng.js`'s mulberry32 — the generator
 * `generateMaze`, every wall backend and every post-processor already draw
 * from.
 *
 * ⛔ NOT `SeedlingRng`. The two substrates keep their own generators on
 * purpose: the maze's producers are already asserted against mulberry32
 * streams (`mazeRoomEngine.test.js`'s "deterministic for the same seed" rows),
 * and importing the Seedling one here would drag `seedlingDemo/` into the
 * maze's page for arithmetic the maze already has. ⚖ Kickoff §3.2's shape: ONE
 * `ProcgenRng` class, two sources.
 *
 * ── THE SEED RANGE, AND WHY IT IS THE SOURCE'S TO DECLARE ─────────────
 *
 * `createRng` starts with `s = seed | 0`, so seeds outside the signed 32-bit
 * range ALIAS onto ones inside it — seed 2^32+7 and seed 7 would produce the
 * identical level under two different names, and "the seed is the level's
 * identity" would quietly stop being true. So the range is [0, 2147483647] and
 * anything else refuses BY NAME.
 *
 * ⚠ **0 IS LEGAL HERE AND ILLEGAL IN SEEDLING**, which is exactly why the check
 * belongs to the source. To `SeedlingRng`, 0 means *"inherit the build's boot
 * seed"* — a sentence about a tape. mulberry32 has no such sentence: `s = 0`
 * immediately becomes `0x6D2B79F5` and the stream is as good as any other.
 * A shared range would have been one generator's fact imposed on the other.
 *
 * ⛔ NO NODE IMPORTS: this module is on the maze's browser path.
 */

import { ProcgenRng, ProcgenRngError } from '../procgenCore/procgenRng.js';
import { createRng } from '../shared/rng.js';

export { ProcgenRng, ProcgenRngError };

/** The seed range a maze level's identity may live in — mulberry32's own orbit. */
export const SEED_MIN = 0;
export const SEED_MAX = 2147483647;

/** A seed, checked. Returned so a caller can write `assertSeed(s)` inline. */
export function assertSeed(seed) {
    if (!Number.isInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
        throw new ProcgenRngError(`procgenRng (maze): the seed must be an integer in `
            + `[${SEED_MIN}, ${SEED_MAX}] — got ${JSON.stringify(seed)}. mulberry32 starts `
            + 'with `s = seed | 0`, so a seed outside that range ALIASES onto one inside it '
            + 'and two names would produce one level.');
    }
    return seed;
}

/**
 * ⛓ THE SOURCE — a thin adapter over `shared/rng.js`. ⛔ `nextIndex` is spelled
 * here and NOT in `procgenCore` because it is the SOURCE's idiom:
 * `createRng` exposes `randint`/`choice` and no zero-based index, so the maze
 * declares `Math.floor(next() * n)` once, in the same shape `SeedlingRng.
 * nextIndex` has (`floor(next * n)`), and both substrates' `pick` therefore
 * index the same way.
 */
export const MAZE_RNG_SOURCE = Object.freeze({
    name: 'mulberry32 (shared/rng.js)',
    assertSeed,
    create: (seed) => {
        const r = createRng(seed);
        return {
            next: () => r.next(),
            nextIndex: (n) => Math.floor(r.next() * n),
            get state() { return r.getState(); },
        };
    },
});

/** `new ProcgenRng(seed, …)` over the maze source. ⛔ The ONE place a maze
 *  generation stream is constructed — the model's room stream and the loop's
 *  template stream both come through here. */
export const rngFor = (seed) => new ProcgenRng(seed, { source: MAZE_RNG_SOURCE });
