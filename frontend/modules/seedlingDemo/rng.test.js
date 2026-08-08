import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    BOOT_SEED, HASH_C1, HASH_C2, HASH_C3, RANDOM_DIVISOR, SeedlingRng, STATE_MAX,
    XOR_MASK, draws, hash, rawFor, step,
} from './rng.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = join(HERE, 'fixtures', 'rng-oracle.json');

/**
 * ── THE DIFFERENTIAL ──────────────────────────────────────────────────
 *
 * `fixtures/rng-oracle.json` is written by
 * `scripts/procgen/probe-seedling-rng.mjs` from the LIVE wasm build, through
 * the same `Math.random()` the game calls. Everything below it is a
 * property check on the transcription; THIS is the check that the
 * transcription is of the right thing.
 */
describe('rng — the live game\'s own stream', () => {
    const present = existsSync(ORACLE);
    const oracle = present ? JSON.parse(readFileSync(ORACLE, 'utf8')) : null;

    it('the oracle fixture exists and came from a build with the hooks', () => {
        // ⚠ NOT a skip. A missing oracle is the whole stratum going vacuous,
        // and the ladder has been bitten by a green run that tested nothing.
        expect(present, `${ORACLE} is missing — regenerate it with `
            + 'scripts/procgen/probe-seedling-rng.mjs against a built page').toBe(true);
        expect(oracle.hooks).toBe(true);
        expect(oracle.streams.length).toBeGreaterThan(0);
    });

    it('reproduces every recorded stream, draw for draw', () => {
        for (const s of oracle.streams) {
            const mine = draws(s.seed, oracle.count);
            expect(mine.draws, `seed ${s.seed}${s.cosmetic ? ' (cosmetic)' : ''}`)
                .toEqual(s.draws);
            expect(mine.states, `seed ${s.seed} states`).toEqual(s.states);
        }
    });

    it('and the doubles are EXACT, not close', () => {
        // A tolerance here would hide precisely the int32-wraparound defect
        // this file's docblock is about: a JS `*` gives the right answer for
        // the first few draws and drifts after, which `toBeCloseTo` would
        // absorb for hundreds of them.
        const s = oracle.streams[0];
        const mine = draws(s.seed, oracle.count);
        for (let i = 0; i < oracle.count; i++) {
            expect(Object.is(mine.draws[i], s.draws[i]),
                `draw ${i}: ${mine.draws[i]} vs ${s.draws[i]}`).toBe(true);
        }
    });

    it('seed 0 IS the boot seed, from the game\'s side too', () => {
        const zero = oracle.streams.find((s) => s.seed === 0 && !s.cosmetic);
        const boot = oracle.streams.find((s) => s.seed === BOOT_SEED && !s.cosmetic);
        expect(zero.draws).toEqual(boot.draws);
    });
});

describe('rng — the generator', () => {
    it('pins the constants the stream is a function of', () => {
        // ⛔ INDEX 29, NOT 30. Kickoff §14.1 quoted `0xA3000000` (index 30)
        // beside the C's `[n - 2]`; the live game's first probe run said
        // 0x48000000 and this is where that correction is pinned.
        expect(XOR_MASK).toBe(0x48000000);
        expect(HASH_C1).toBe(1376312589);
        expect(HASH_C2).toBe(789221);
        expect(HASH_C3).toBe(15731);
        expect(RANDOM_DIVISOR).toBe(2 ** 31);
        // (uint32)(981152406000 * 1000) — derived here rather than repeated,
        // so a build with a different MOCK_DATE_TIME is a one-line change
        // with its arithmetic visible.
        expect(BOOT_SEED).toBe((981152406000 * 1000) % 4294967296);
    });

    it('steps the LFSR: odd xors, even shifts', () => {
        expect(step(1)).toBe(0x48000000);
        expect(step(2)).toBe(1);
        expect(step(0xFFFFFFFF)).toBe(((0x7FFFFFFF) ^ XOR_MASK) >>> 0);
    });

    it('never enters state 0 — which is what frees 0 to mean "no seed"', () => {
        // ⛓ The claim the v7 block and the runtime hook both lean on. An odd
        // state xors into a nonzero mask; an even one shifts down through an
        // odd one first. 100k steps is not a proof and it is the strongest
        // cheap evidence, so it is a bounded check that names its bound.
        let u = 1;
        for (let i = 0; i < 100000; i++) {
            u = step(u);
            expect(u, `state hit 0 after ${i + 1} steps`).not.toBe(0);
        }
    });

    it('keeps the orbit below 2^31, which is what bounds a declarable seed', () => {
        // ⛓ The consequence of the REAL mask: 0x48000000 has bit 31 clear,
        // so `(u >>> 1) ^ mask` can never set it. That is why `rng.seed` is
        // capped at 2^31 - 1 rather than at 2^32 - 1 — the higher half is
        // not a state the game can be in — and it is checked here rather
        // than asserted in prose.
        expect(STATE_MAX).toBe(2147483647);
        let u = BOOT_SEED;
        for (let i = 0; i < 50000; i++) {
            u = step(u);
            expect(u, `state ${u} set bit 31 after ${i + 1} steps`)
                .toBeLessThanOrEqual(STATE_MAX);
        }
        // And the sign distinction the C keeps is still transcribed: a state
        // ABOVE the orbit (only reachable by writing one in) reads negative.
        expect(rawFor(2147483648)).toBe(hash(Math.imul(2147483648 | 0, 71)) & 0x7FFFFFFF);
    });

    it('wraps every hash multiply at int32', () => {
        // The mutation this catches: `s * s * C3` written with plain `*`.
        // At a seed this size the double product is past 2^53 and the two
        // answers differ; below it they agree, which is why the check picks
        // a large one.
        const s = 1234567890;
        const naive = ((s * s * HASH_C3 + HASH_C2) * s + HASH_C1) & 0x7FFFFFFF;
        const exact = ((Math.imul(s, (Math.imul(Math.imul(s, s), HASH_C3) + HASH_C2) | 0)
            + HASH_C1) | 0) & 0x7FFFFFFF;
        expect(naive).not.toBe(exact);
        expect(hash(s)).toBe((() => {
            let t = (((s << 13) ^ s) - (s >> 21)) | 0;
            let r = Math.imul(t, (Math.imul(Math.imul(t, t), HASH_C3) + HASH_C2) | 0);
            r = ((r + HASH_C1) | 0) & 0x7FFFFFFF;
            r = (r + t) | 0;
            return (((r << 13) ^ r) - (r >> 21)) | 0;
        })());
    });

    it('returns values in [0, 1) and only ever 31 bits of them', () => {
        const rng = new SeedlingRng(12345);
        for (let i = 0; i < 5000; i++) {
            const v = rng.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
            expect(Number.isInteger(v * RANDOM_DIVISOR)).toBe(true);
        }
    });

    it('nextIndex is the game\'s own floor(random() * n) idiom', () => {
        const a = new SeedlingRng(7);
        const b = new SeedlingRng(7);
        for (let i = 0; i < 100; i++) {
            expect(a.nextIndex(6)).toBe(Math.floor(b.next() * 6));
        }
    });

    it('two generators at one seed agree, and a different seed diverges', () => {
        expect(draws(99, 32).draws).toEqual(draws(99, 32).draws);
        expect(draws(99, 32).draws).not.toEqual(draws(100, 32).draws);
    });

    it('a constructed seed of 0 means the boot seed, matching the runtime', () => {
        expect(new SeedlingRng(0).state).toBe(BOOT_SEED);
        expect(new SeedlingRng().state).toBe(BOOT_SEED);
        expect(new SeedlingRng(BOOT_SEED).state).toBe(BOOT_SEED);
    });
});
