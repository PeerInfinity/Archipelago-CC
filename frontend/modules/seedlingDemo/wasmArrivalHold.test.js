/**
 * ⛓ ARRIVAL HOLD (§5.124) — `crossingArrivalVerdict` (what a begin record seen while a crossing plan plays IS) and
 * `legEndRefusal` (the pin: a leg that never left the level it was leaving is never `done`). The L22 shape:
 * `wasm-exit-22` plans 2 deaths in L22 and ends in L21; its first respawn was held as the exit's landing.
 */
import { describe, expect, it } from 'vitest';
import { crossingArrivalVerdict, legEndRefusal } from './wasmPlayback.js';

/** L22 → L21 with two planned deaths: death 1 respawns at (104,184) on row 99, death 2 at row 250. */
const row = (level, x, y, deaths) => ({ level, x, y, deaths });
const L22 = [
    ...Array.from({ length: 99 }, (_, i) => row(22, 200 - i, 100, 0)),
    row(22, 104, 184, 1), ...Array.from({ length: 150 }, (_, i) => row(22, 104 + (i + 1) / 4, 184, 1)),
    row(22, 104, 184, 2), ...Array.from({ length: 155 }, (_, i) => row(22, 104 - (i + 1) / 4, 184 - (i + 1) / 8, 2)),
    row(21, 88, 152, 2),
];
const SPAWN = { level: 22, x: 104, y: 184 };

describe('crossingArrivalVerdict', () => {
    it('L22: each planned death\'s respawn, in order, is played through at its own row', () => {
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: L22, respawns: 0, landing: SPAWN }))
            .toEqual({ kind: 'planned-respawn', death: 1, row: 99 });
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: L22, respawns: 1, landing: SPAWN }))
            .toEqual({ kind: 'planned-respawn', death: 2, row: 250 });
    });

    it('a THIRD new Game in L22 (two planned, two respawned) is unplanned, by name', () => {
        const v = crossingArrivalVerdict({ fromLevel: 22, expected: L22, respawns: 2, landing: SPAWN });
        expect(v.kind).toBe('unplanned');
        expect(v.why).toMatch(/the plan bills 2 death\(s\) and 2 respawned already/);
    });

    it('a respawn at a spawn no row of the planned death stands on is not the shadow\'s', () => {
        const v = crossingArrivalVerdict({ fromLevel: 22, expected: L22, respawns: 0, landing: { level: 22, x: 40, y: 184 } });
        expect(v).toMatchObject({ kind: 'unplanned' });
        expect(v.why).toMatch(/death 1 of the 2 the plan bills, but no row of it stands at that spawn/);
    });

    it('the row must carry THAT death: the spawn on a row of death 2 is not death 1\'s respawn', () => {
        const only2 = L22.map((r, i) => (i === 99 ? { ...r, x: 0 } : r));
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: only2, respawns: 0, landing: SPAWN }).kind).toBe('unplanned');
    });

    it('a plan with no death: any new Game in the level being left is unplanned', () => {
        const none = L22.map((r) => ({ ...r, deaths: 0 }));
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: none, landing: SPAWN })).toMatchObject({ kind: 'unplanned' });
    });

    it('the landing: another level, a redirect, or a plan that ends in the level it plays in', () => {
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: L22, landing: { level: 21, x: 88, y: 152 } })).toEqual({ kind: 'landing' });
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: L22, landing: SPAWN, redirected: true })).toEqual({ kind: 'landing' });
        const stays = [...L22.slice(0, -1), row(22, 1, 1, 2)];
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: stays, landing: SPAWN })).toEqual({ kind: 'landing' });
    });

    it('rows from before `deaths` existed count no death (absent = the base)', () => {
        const bare = L22.map(({ deaths, ...r }) => r);
        expect(crossingArrivalVerdict({ fromLevel: 22, expected: bare, landing: SPAWN })).toMatchObject({ kind: 'unplanned' });
    });
});

describe('legEndRefusal — the pin: a leg whose end is the level its plan was leaving never reads done', () => {
    it('for every pair of levels: end in the from-level with the plan ending elsewhere → refused; otherwise null', () => {
        const levels = [0, 21, 22, 30, 86];
        for (const from of levels) {
            for (const endLevel of levels) {
                for (const expLevel of levels) {
                    const why = legEndRefusal({ fromLevel: from, end: { level: endLevel }, expectedEnd: { level: expLevel, x: 1, y: 2 } });
                    const never = endLevel === from && expLevel !== from;
                    expect(why === null ? 'null' : 'refused', `${from} ${endLevel} ${expLevel}`).toBe(never ? 'refused' : 'null');
                }
            }
        }
    });

    it('L22\'s false done is refused, by name', () => {
        expect(legEndRefusal({ fromLevel: 22, end: { level: 22, x: 104, y: 184 }, expectedEnd: L22.at(-1) }))
            .toBe('the leg ends in level 22, the level it was leaving — its plan ends in level 21 (88,152): not done');
    });

    it('a glue redirect may land in the level it left (exempt); a plan with no end row says nothing', () => {
        expect(legEndRefusal({ fromLevel: 22, end: { level: 22 }, expectedEnd: L22.at(-1), redirected: true })).toBeNull();
        expect(legEndRefusal({ fromLevel: 22, end: { level: 22 }, expectedEnd: undefined })).toBeNull();
    });
});
