/**
 * rngRuler — the ruler, and the boundary-14 measurement it makes reproducible.
 * ⚖ R9 ruling 56, slice 12f.
 *
 * ⛓ THE POINT OF THE SECOND BLOCK. Slice 12f's stop was two pages reporting
 * different `rng.gameplay` for BYTE-EQUAL tape bytes on one build, and the
 * evidence lived in four files on a MACHINE-GLOBAL Windows scratch that
 * nothing tracks and any producer may overwrite. The integers themselves are
 * the durable part: with the ruler, `1029458650` and `1196888758` stop being
 * two opaque tokens to argue over and become "3297 draws" and "3299 draws"
 * — a statement anybody can re-derive from this file alone, with no sidecar,
 * no browser and no GPU.
 */

import { describe, expect, it } from 'vitest';

import {
    AVM2_RANDOM_BITS,
    AVM2_RANDOM_MASK,
    AVM2_RANDOM_XOR_MASKS,
    curveDrawIndices,
    rngDistance,
    rngDrawIndex,
    rngStep,
} from './rngRuler.js';

/**
 * ⛓ THE FOUR MEASURED STATES — `r9-solve-0`, drives of 2026-08-26 02:41 (the
 * `--win` differential, S4 of the fourth re-record run) and 02:51 (S1's
 * `driveLatch` on the same run's licensed (B) pass). The two drives shipped
 * BYTE-EQUAL bytes to the game (`tape-r9-solve-0.json` and
 * `rr-tape-r9-solve-0.json`, both md5 `ac86d87c72c789c72c85851a743ff5c8`) and
 * their 146 observation ticks are identical, 0 differing.
 *
 * These are OBSERVATIONS, not derivations — the one shape ⚖ 17 still admits a
 * literal for, and their provenance is this docblock.
 */
const SOLVE0 = {
    seed: 577532565,           // the tape's own `rng.seed`
    differential: { begin: 1029458650, terminal: 1953898394 },
    s1: { begin: 1196888758, terminal: 1427998694 },
};

describe('rngRuler — the LFSR step', () => {
    it('takes its mask from the table by the C\'s own index, not by hand', () => {
        // ⛔ DELIBERATELY NOT `toHaveLength(31)`. The table's length is a
        // property of the transcription, not a claim anything depends on
        // (`lint-gate-labels` calls that shape `roster-length-pinned`, and it
        // is right: a row that pins it goes red for a correct edit). What the
        // C actually guarantees is the INDEXING — `r->uXorMask =
        // avm2_random_xor_masks[n - 2]` for a register of n bits — so the
        // table must simply REACH that index, and the mask must be what the
        // expression selects rather than a number somebody typed.
        expect(AVM2_RANDOM_BITS).toBe(31);
        expect(AVM2_RANDOM_XOR_MASKS[AVM2_RANDOM_BITS - 2]).toBeDefined();
        expect(AVM2_RANDOM_MASK).toBe(AVM2_RANDOM_XOR_MASKS[AVM2_RANDOM_BITS - 2]);
        expect(AVM2_RANDOM_MASK).toBe(0x48000000);
    });

    it('is a pure orbit — a distance of k lands exactly k steps away', () => {
        let v = SOLVE0.seed;
        for (let i = 1; i <= 500; i += 1) {
            v = rngStep(v);
            expect(rngDistance(SOLVE0.seed, v, { limit: 1000 })).toBe(i);
        }
    });

    it('never reports a distance THROUGH zero — the C reseeds a zeroed register', () => {
        expect(rngStep(0)).toBe(rngStep(987654321));
    });

    it('is DIRECTED: at most one of the two orders has a short answer', () => {
        const a = SOLVE0.differential.begin;
        const b = SOLVE0.s1.begin;
        expect(rngDistance(a, b, { limit: 1_000_000 })).toBe(2);
        expect(rngDistance(b, a, { limit: 1_000_000 })).toBeNull();
    });
});

describe('rngRuler — the boundary-14 disagreement, in draws', () => {
    it('reads both pages\' `beginEntry` as a DRAW INDEX from the tape\'s seed', () => {
        expect(rngDrawIndex(SOLVE0.seed, SOLVE0.differential.begin)).toBe(3297);
        expect(rngDrawIndex(SOLVE0.seed, SOLVE0.s1.begin)).toBe(3299);
    });

    it('⛓ the S1 page drew EXACTLY TWO MORE, and all of it before tick 145', () => {
        const beginGap = rngDrawIndex(SOLVE0.seed, SOLVE0.s1.begin)
            - rngDrawIndex(SOLVE0.seed, SOLVE0.differential.begin);
        expect(beginGap).toBe(2);

        // ⛔ THE CONTROL, and it is the whole strength of the finding: the
        // SAME signed gap appears again between the two TERMINAL latches, an
        // independent pair of integers. Two coincidences of +2 on a 2**31
        // orbit is not a coincidence.
        const spentDifferential = rngDistance(
            SOLVE0.differential.begin, SOLVE0.differential.terminal, { limit: 100_000 });
        const spentS1 = rngDistance(
            SOLVE0.s1.begin, SOLVE0.s1.terminal, { limit: 100_000 });
        expect(spentDifferential).toBe(270);
        expect(spentS1).toBe(270);
        expect(spentS1).toBe(spentDifferential);
    });

    it('⛔ a NEIGHBOURING mask reproduces none of it — the ruler discriminates', () => {
        // The fixture must be able to tell this build's generator from a
        // near-miss one; otherwise the numbers above would pass against any
        // XOR-shift at all (⚖ "a fixture only gates a change it can
        // DISTINGUISH"). Re-implemented locally with masks[28] and masks[30].
        for (const mask of [AVM2_RANDOM_XOR_MASKS[AVM2_RANDOM_BITS - 3],
            AVM2_RANDOM_XOR_MASKS[AVM2_RANDOM_BITS - 1]]) {
            const step = (s) => (((s >>> 0) & 1)
                ? (((s >>> 0) >>> 1) ^ mask) : ((s >>> 0) >>> 1)) >>> 0;
            let v = SOLVE0.seed >>> 0;
            let hit = null;
            for (let i = 1; i <= 20_000; i += 1) {
                v = step(v);
                if (v === (SOLVE0.differential.begin >>> 0)) { hit = i; break; }
            }
            expect(hit).toBeNull();
        }
    });
});

describe('rngRuler — `--rng-curve` sidecar rows', () => {
    it('turns a curve into absolute draws and per-row spend', () => {
        let v = SOLVE0.seed;
        const curve = [{ tick: 0, state: v }];
        for (let i = 0; i < 3; i += 1) v = rngStep(v);
        curve.push({ tick: 7, state: v });
        for (let i = 0; i < 5; i += 1) v = rngStep(v);
        curve.push({ tick: 9, state: v });

        const rows = curveDrawIndices(curve, SOLVE0.seed, { span: 1000 });
        expect(rows.map((r) => r.draws)).toEqual([0, 3, 8]);
        expect(rows.map((r) => r.spent)).toEqual([null, 3, 5]);
    });

    it('⛔ a state past the indexed span is `null`, never 0', () => {
        const rows = curveDrawIndices(
            [{ tick: 0, state: SOLVE0.seed }, { tick: 1, state: SOLVE0.s1.terminal }],
            SOLVE0.seed, { span: 10 });
        expect(rows[0].draws).toBe(0);
        expect(rows[1].draws).toBeNull();
        expect(rows[1].spent).toBeNull();
    });
});
