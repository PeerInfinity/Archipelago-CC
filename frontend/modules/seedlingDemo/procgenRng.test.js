/**
 * seedlingDemo/procgenRng.test — determinism, and the absence of a second
 * arithmetic.
 *
 * PROCGEN PoC arc, slice 1. Two claims: the same seed produces the same
 * stream (the arc's determinism law), and the stream IS `rng.js`'s — asserted
 * against `SeedlingRng` directly, because a wrapper that had quietly grown
 * its own multiply would still look deterministic.
 */

import { describe, expect, it } from 'vitest';

import { SeedlingRng } from './rng.js';
import {
    ProcgenRngError, SEED_MAX, SEED_MIN, assertSeed, rngFor,
} from './procgenRng.js';

describe('a seed is a level\'s identity', () => {
    it('refuses 0, because to the game\'s generator 0 means "the build\'s boot seed"', () => {
        expect(() => rngFor(0)).toThrow(ProcgenRngError);
        expect(() => rngFor(0)).toThrow(/is its identity, not an inheritance/);
    });

    it('refuses a non-integer and anything outside the orbit', () => {
        expect(() => rngFor(1.5)).toThrow(ProcgenRngError);
        expect(() => rngFor(-1)).toThrow(ProcgenRngError);
        expect(() => rngFor(SEED_MAX + 1)).toThrow(ProcgenRngError);
        expect(assertSeed(SEED_MIN)).toBe(SEED_MIN);
        expect(assertSeed(SEED_MAX)).toBe(SEED_MAX);
    });
});

describe('the same seed is the same stream', () => {
    it('two generators on one seed agree draw for draw', () => {
        const a = rngFor(12345);
        const b = rngFor(12345);
        const draws = (r) => Array.from({ length: 32 }, () => r.nextInt(1000));
        expect(draws(a)).toEqual(draws(b));
    });

    it('different seeds diverge', () => {
        const a = Array.from({ length: 16 }, ((r) => () => r.nextInt(1000))(rngFor(1)));
        const b = Array.from({ length: 16 }, ((r) => () => r.nextInt(1000))(rngFor(2)));
        expect(a).not.toEqual(b);
    });

    it('the arithmetic IS SeedlingRng\'s — no second generator', () => {
        const mine = rngFor(777);
        const theirs = new SeedlingRng(777);
        for (let i = 0; i < 20; i += 1) expect(mine.next()).toBe(theirs.next());
        expect(mine.state).toBe(theirs.state);
    });
});

describe('the vocabulary', () => {
    it('nextInt stays in [0, n) and refuses a non-positive bound', () => {
        const r = rngFor(99);
        for (let i = 0; i < 200; i += 1) {
            const v = r.nextInt(7);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(7);
        }
        expect(() => r.nextInt(0)).toThrow(ProcgenRngError);
        expect(() => r.nextInt(2.5)).toThrow(ProcgenRngError);
    });

    it('nextIntBetween includes both ends', () => {
        const r = rngFor(4242);
        const seen = new Set();
        for (let i = 0; i < 300; i += 1) seen.add(r.nextIntBetween(3, 5));
        expect([...seen].sort()).toEqual([3, 4, 5]);
        expect(() => r.nextIntBetween(5, 3)).toThrow(ProcgenRngError);
    });

    it('pick takes an element, and refuses an empty palette by name', () => {
        const r = rngFor(31337);
        const items = ['a', 'b', 'c'];
        for (let i = 0; i < 50; i += 1) expect(items).toContain(r.pick(items));
        expect(() => r.pick([])).toThrow(/empty palette is a finding/);
    });

    it('shuffle permutes into a NEW array and never mutates the palette', () => {
        const r = rngFor(2026);
        const palette = ['a', 'b', 'c', 'd', 'e'];
        const out = r.shuffle(palette);
        expect(out).not.toBe(palette);
        expect(palette).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect([...out].sort()).toEqual([...palette].sort());
        // …and it is the same permutation from the same seed.
        expect(rngFor(2026).shuffle(palette)).toEqual(out);
    });

    it('`state` is a readout and does not advance the stream', () => {
        // ⛓ CONSTRUCTIVE-MODE slice 2: `ProcgenRng` needs its SOURCE named,
        // and `rngFor` is the one place a Seedling stream is constructed. The
        // bare `new ProcgenRng(555)` this used to be is now a refusal by name.
        const r = rngFor(555);
        const before = r.state;
        expect(r.state).toBe(before);
        expect(r.draws).toBe(0);
        r.next();
        expect(r.state).not.toBe(before);
        expect(r.draws).toBe(1);
    });

    it('every draw counts, whichever method spent it', () => {
        const r = rngFor(8);
        r.next();
        r.nextInt(4);
        r.nextIntBetween(1, 3);
        r.pick(['x', 'y']);
        r.shuffle([1, 2, 3]);            // two draws: i = 2 and i = 1
        expect(r.draws).toBe(6);
    });
});
