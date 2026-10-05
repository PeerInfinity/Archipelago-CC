/**
 * ⛓⛓⛓ SEEDLING FIDELITY ROBUST — D2 (one idle tick) and D3 (the Conch), one
 * mechanism: the PULL rung asked only the corridor's FIRST danger.
 *
 *   D2  L16 → L17 + Sword, door from L15: `can` at the arrival tick (PULL,
 *       206 t) and EXHAUSTED one idle tick later on `bob@48,96`, whose phase
 *       put it ahead of `arrowtrap@96,32`'s lane on the same corridor. The
 *       tick-0 plan started one tick late crosses with 0 hits on the GAME
 *       (recorded, not committed), so the refusal was the solver's.
 *   D3  L16 → L18 (`stairsup@352,80`) + {Sword, Conch}: the swim corridor meets
 *       `sandtrap@48,32` first; AVOID has no corridor while the lanes are armed.
 *
 * The fix probes the same corridor on past a first danger with no silencer for
 * a lane that has one (`LATER_LANE_PROBES`). Both witnesses below were recorded
 * on the game (`check-seedling-bot-differential --record`), and each IS
 * `canCross`'s witness byte for byte.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { LATER_LANE_PROBES } from './solverBot.js';
import { CanCrossError, canCross } from './seedlingCanCross.js';

const committed = (name) => readFileSync(new URL(`./fixtures/tapes/${name}.json`, import.meta.url), 'utf8');
const L17 = (o) => canCross({ level: 16, exit: 17, arrival: { from: 15 }, inventory: ['sword'], dashMode: 'none', ...o });

describe('ROBUST D2 — one idle tick no longer flips L16', () => {
    it('one idle tick: `can` (220 t, 0 hits), and the committed game witness IS the oracle\'s', () => {
        const r = L17({ idle: 1, name: 'robust-l16-sword-idle1' });
        expect(r.verdict).toBe('can');
        expect(r.request.idle).toBe(1);
        expect(r.plan).toMatchObject({ ticks: 220, hash: '1059d26ccf', landed: 17, deaths: 0, hits: 0 });
        expect(`${JSON.stringify(r.witness.tape, null, 4)}\n`).toBe(committed('robust-l16-sword-idle1'));
        expect(r.witness.replayed).toEqual({ observations: 221, landed: 17, agrees: true });
    });

    it('every idle count asked crosses with 0 hits; idle 0 is the committed CANCROSS plan', () => {
        const rows = [0, 1, 2, 3, 5, 8].map((idle) => {
            const r = L17({ idle, witness: false });
            return [idle, r.verdict, r.plan?.hits];
        });
        expect(rows).toEqual([[0, 'can', 0], [1, 'can', 0], [2, 'can', 0], [3, 'can', 0], [5, 'can', 0],
            [8, 'can', 0]]);
        expect(L17({ witness: false }).plan).toMatchObject({ ticks: 206, hash: '0c36d853aa', rungs: ['pull'] });
    });

    it('`idle` is a request field, checked', () => {
        expect(() => L17({ idle: -1 })).toThrow(CanCrossError);
        expect(() => L17({ idle: 0.5 })).toThrow(/`idle` must be a non-negative integer/);
        expect('idle' in L17({ witness: false }).request).toBe(false);
    });
});

describe('ROBUST D3 — the Conch no longer loses L16 → L18', () => {
    it('{sword, conch}: `can` (797 t, 0 hits), and the committed game witness IS the oracle\'s', () => {
        const r = canCross({ level: 16, exit: { x: 352, y: 80 }, arrival: { from: 15 }, inventory: ['sword', 'conch'],
            dashMode: 'none', name: 'robust-l16-l18-sword-conch' });
        expect(r.verdict).toBe('can');
        expect(r.plan).toMatchObject({ ticks: 797, hash: 'd6505110c3', landed: 18, deaths: 0, hits: 0 });
        expect(`${JSON.stringify(r.witness.tape, null, 4)}\n`).toBe(committed('robust-l16-l18-sword-conch'));
        expect(r.witness.replayed).toEqual({ observations: 798, landed: 18, agrees: true });
    });

    it('{sword} alone is unmoved (878 t, PULL)', () => {
        const r = canCross({ level: 16, exit: { x: 352, y: 80 }, arrival: { from: 15 }, inventory: ['sword'],
            dashMode: 'none', witness: false });
        expect(r.plan).toMatchObject({ ticks: 878, hash: 'b9fc18ae79', hits: 0, rungs: ['pull'] });
    });

    it('the later-lane probe is bounded', () => {
        expect(LATER_LANE_PROBES).toBe(4);
    });
});
