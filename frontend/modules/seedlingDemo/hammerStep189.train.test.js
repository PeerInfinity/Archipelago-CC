/**
 * seedlingDemo/hammerStep189.train.test — ⛓ hammer-phase STEP-189 (`KILLLOCK_PINNED_SPEAR`, OFF): the witnesses.
 *
 * Re-measure-11 P1's two L71 stop requests (survey step 189; base defaults, LHM ON — the request answers are the same
 * under FIVE/SIX): 38:6 (the chest at (160,256)) and 39:1 (the exit (96,0) → L75). OFF each refuses on a lavarunner
 * PINNED on Dark Stone; ON the dashless pass spears the five through the pocket's wall and solves, 0 hits, 0 deaths
 * on a fresh replay of the plan (keys and slot selections). Train tier: four whole-request solves.
 */
import { describe, expect, it } from 'vitest';

import { REQ_38_6, REQ_39_1, solveStep189 } from './hammerStep189Legs.js';

describe('KILLLOCK_PINNED_SPEAR — re-measure-11 P1 38:6 (L71 → chest)', () => {
    it('OFF: both passes refuse on the pinned lavarunner (the page\'s own answer)', () => {
        const r = solveStep189(REQ_38_6, false);
        expect(r).toMatchObject({ ok: false, answer: 'e410e113fd01', work: 1876, rows: [] });
        expect(r.passes).toEqual([['dashless', false], ['full', false]]);
        expect(r.message).toMatch(/is PINNED on the solid between them/);
    }, 240000);

    it('ON: solved by the dashless pass, 0 hits and 0 deaths on a fresh replay', () => {
        const r = solveStep189(REQ_38_6, true);
        expect(r).toMatchObject({ ok: true, answer: '733c3d7160f8', ticks: 1081, level: 71, hits: 0, deaths: 0 });
        expect(r.passes).toEqual([['dashless', true], ['full', false]]);
        expect(r.rows.filter((x) => x.verdict === 'killed').map((x) => x.dir)).toEqual([2, 2, 2]);
    }, 240000);
});

describe('KILLLOCK_PINNED_SPEAR — re-measure-11 P1 39:1 (L71 → exit → L75)', () => {
    it('OFF: refuses as the page did', () => {
        const r = solveStep189(REQ_39_1, false);
        expect(r).toMatchObject({ ok: false, answer: '6bd9d381b7df', work: 1876 });
    }, 240000);

    it('ON: solved into L75, 0 hits and 0 deaths on a fresh replay', () => {
        const r = solveStep189(REQ_39_1, true);
        expect(r).toMatchObject({ ok: true, answer: '0d5aa914fd84', ticks: 808, level: 75, hits: 0, deaths: 0 });
    }, 240000);
});
