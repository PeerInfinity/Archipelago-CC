/**
 * The difficulty model (`noiz2saDifficulty.js`, bulletml N5) over the measured sweeps (`noiz2saDifficultyData.js`):
 * the smoothing, a span's chance and expected seconds, the span picker, and the product model against the measured
 * three-scene spans.
 */
import { describe, expect, it } from 'vitest';

import {
    SKILLS, P_FLOOR, SCENE_TOTAL, isotonic, sceneChance, spanDifficulty, pickSpan, parseSpan, spanAt, spanLength,
    modelVersusMeasured, sceneIndex,
} from './noiz2saDifficulty.js';
import { NOIZ2SA_DIFFICULTY } from './noiz2saDifficultyData.js';
import { showSpan } from './noiz2saRegion.js';

describe('the data', () => {
    it('every scene of stages 1–10 and the 30 aligned triples, at 16 skills, 16 bot seeds', () => {
        expect(SKILLS).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 92, 94, 96, 98, 99, 100]);
        expect(Object.keys(NOIZ2SA_DIFFICULTY.scenes)).toHaveLength(100);
        expect(Object.keys(NOIZ2SA_DIFFICULTY.triples)).toHaveLength(30);
        expect(NOIZ2SA_DIFFICULTY.source).toMatchObject({ hitbox: 'centered', gameSeeds: [1], botSeeds: 16 });
        // 1:1 at skill 0: 5 of 16 deathless, a clean clear 16.032 s (1002 frames)
        expect(NOIZ2SA_DIFFICULTY.scenes['1:1'][0]).toEqual([16, 5, 16.032, 9.942]);
    });
});

describe('the smoothing', () => {
    it('isotonic: pool-adjacent-violators, weighted', () => {
        const close = (got, want) => { expect(got).toHaveLength(want.length); got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 12)); };
        close(isotonic([0.3, 0.7, 0.2, 0.6], [1, 1, 1, 1]), [0.3, 0.45, 0.45, 0.6]);
        close(isotonic([0.5, 0.1], [3, 1]), [0.4, 0.4]);
        expect(isotonic([0, 0.5, 1], [1, 1, 1])).toEqual([0, 0.5, 1]);
    });
    it('every scene\'s chance is non-decreasing in skill and 1 at skill 100', () => {
        for (let i = 0; i < SCENE_TOTAL; i++) {
            let last = -1;
            for (let s = 0; s <= 100; s += 0.5) {
                const p = sceneChance(i, s);
                expect(p).toBeGreaterThanOrEqual(last - 1e-12);
                last = p;
            }
            expect(sceneChance(i, 100)).toBe(1);
        }
    });
});

describe('a span\'s chance and expected seconds', () => {
    it('one scene: its own measurement; E = L + F(1 − p)/p', () => {
        const d = spanDifficulty(parseSpan('1:1'), 90);
        expect(d).toMatchObject({ p: 1, measured: true });
        expect(d.seconds).toBeCloseTo(16.032, 6);
        const b = spanDifficulty(parseSpan('10:boss'), 50);
        expect(b.measured).toBe(true);
        expect(b.p).toBeLessThan(P_FLOOR); // nothing cleared it: E is large and finite (the floor)
        expect(Number.isFinite(b.seconds)).toBe(true);
    });
    it('an unmeasured span is the product of its scenes; a measured triple its own', () => {
        const s = parseSpan('1:2–1:3');
        const d = spanDifficulty(s, 60);
        expect(d.measured).toBe(false);
        expect(d.p).toBeCloseTo(sceneChance(1, 60) * sceneChance(2, 60), 12);
        expect(spanDifficulty(parseSpan('2:4–2:6'), 60).measured).toBe(true);
    });
    it('the product span\'s E is the scene-by-scene restart model (a single scene reduces to the cell formula)', () => {
        const s = parseSpan('3:2–3:3');
        const one = (i) => spanDifficulty(spanAt(i, 1), 70);
        const [a, b] = [one(sceneIndex(s.start)), one(sceneIndex(s.end))];
        const d = spanDifficulty(s, 70);
        // E ≥ the two scenes' clean lengths, and at least as long as either scene's own E
        expect(d.seconds).toBeGreaterThan(Math.max(a.seconds, b.seconds));
    });
    it('parseSpan: an en dash or a hyphen, one position, stages 1–10 only', () => {
        expect(showSpan(parseSpan('10:7–10:boss'))).toBe('10:7–10:boss');
        expect(showSpan(parseSpan('10:7-10:boss'))).toBe('10:7–10:boss');
        expect(showSpan(parseSpan('3:boss'))).toBe('3:boss');
        expect(spanLength(parseSpan('9:9–10:2'))).toBe(4);
        expect(() => parseSpan('ENDLESS:1')).toThrow();
        expect(() => parseSpan('2:3–1:1')).toThrow();
        expect(() => parseSpan('nonsense')).toThrow();
    });
});

describe('pickSpan (⚖ "a 50% chance of winning, erring on the side of a higher chance")', () => {
    const all = (n, skill) => Array.from({ length: SCENE_TOTAL - n + 1 }, (_, a) => ({ a, ...spanDifficulty(spanAt(a, n), skill) }));
    it('the lowest chance still ≥ 0.5 — the hardest span the bot clears deathless half the time', () => {
        for (const [n, skill] of [[1, 40], [1, 90], [2, 80], [3, 94], [4, 96]]) {
            const pick = pickSpan(n, skill);
            expect(pick.reached).toBe(true);
            expect(pick.p).toBeGreaterThanOrEqual(0.5);
            expect(spanLength(pick.span)).toBe(n);
            const lower = all(n, skill).filter((c) => c.p >= 0.5 && c.p < pick.p - 1e-12);
            expect(lower).toEqual([]);
        }
    });
    it('no span reaches 0.5: the easiest one', () => {
        const pick = pickSpan(4, 0);
        expect(pick.reached).toBe(false);
        expect(pick.p).toBe(Math.max(...all(4, 0).map((c) => c.p)));
    });
});

describe('the product model against the measured three-scene spans', () => {
    const rows = modelVersusMeasured();
    const mae = (rs) => rs.reduce((a, r) => a + Math.abs(r.model - r.measured), 0) / rs.length;
    it('one row per triple × skill', () => {
        expect(rows).toHaveLength(30 * 16);
        expect(rows[0]).toMatchObject({ span: '1:1–1:3', skill: 0, n: 16 });
    });
    it('MEASURED: mean absolute error ≤ 0.05 through skill 80 and 98–100, ≤ 0.13 at 90–96 (16 attempts a cell)', () => {
        // pinned off this data (19e3de1): 0.003–0.049 through skill 80; 0.092, 0.125, 0.104, 0.112 at 90/92/94/96;
        // 0.025, 0.016, 0 at 98/99/100. The model is a little optimistic where the bot is mid-way (bias +0.05–0.10).
        for (const skill of SKILLS) {
            const e = mae(rows.filter((r) => r.skill === skill));
            expect(e).toBeLessThanOrEqual(skill >= 90 && skill <= 96 ? 0.13 : 0.05);
        }
        expect(mae(rows)).toBeLessThan(0.05);
    });
});
