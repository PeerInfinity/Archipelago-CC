/**
 * seedlingDemo/procgenLawSets — **THE SETS THE TWO LAWS HAND BACK**, and the
 * claim that handing them back changed NOTHING about what they decide (PROCGEN
 * ELEMENTS arc 3, slice 5b — D1).
 *
 * ⛔⛔ THE SUBJECT IS A HAND-DRAWN ROOM, not a generated one: the point of a
 * fixture here is that the reader can see the two components with their eyes.
 * `procgenDoorElements.test.js`'s own corridor is reused (a 5-cell lane with a
 * 1-cell nub) so the two files cannot disagree about what a legal door looks
 * like.
 *
 *     0 1 2 3 4 5      START (1,1)   GOAL (5,1)
 *   1   S · D · G      D = the door cell (3,1)
 *   2     n            n = the clearer's nub (2,2)
 *
 * With D walled the room is TWO components — {S, (2,1), n} and {(4,1), G} —
 * and that partition IS what "the door is a cut" means.
 */

import { describe, expect, it } from 'vitest';

import { carveLawRefusal, doorLawRefusal } from './procgenSeedling.js';
import { verifyAreaLevels } from '../procgenCore/areaPartition.js';

const W = 10;
const H = 10;
const START = { x: 1, y: 1 };
const GOAL = { x: 5, y: 1 };
const FLOOR = new Set(['1,1', '2,1', '3,1', '4,1', '5,1', '2,2']);
const key = (c) => `${c.x},${c.y}`;
const walkableFor = (walled) => (x, y) => FLOOR.has(`${x},${y}`)
    && !(walled && walled.has(`${x},${y}`));

const ask = (o = {}) => {
    const sets = {};
    const refusal = doorLawRefusal({
        width: W, height: H, walkableFor, start: START, goal: GOAL,
        doorKeys: new Set(['3,1']), clearerKeys: ['2,2'], name: 'the fixture',
        askOpenHalf: true, sets, ...o,
    });
    return { refusal, sets };
};

describe('⛓⛓⛓ doorLawRefusal — the SETS beside the sentence', () => {
    it('hands back the door cell(s) it was asked about', () => {
        expect(ask().sets.walled).toEqual([{ x: 3, y: 1 }]);
    });

    it('⛓⛓ the two floods are the START\'s component and the GOAL\'s', () => {
        const { sets } = ask();
        expect(new Set(sets.startSide.map(key))).toEqual(new Set(['1,1', '2,1', '2,2']));
        expect(new Set(sets.goalSide.map(key))).toEqual(new Set(['4,1', '5,1']));
    });

    /**
     * ⛔ THE PARTITION CLAIM, WHICH IS THE ONE A PICTURE IS DRAWN FROM: on this
     * room the two sides are DISJOINT and together with the walled cell they are
     * the whole walkable set. ⚠ Stated for THIS fixture and not as a law — a
     * room with a dead pocket has cells in neither side, which is why the
     * paintable draws two floods rather than one complement.
     */
    it('⛓⛓⛓ start-side ∪ goal-side ∪ walled === the walkable set, and the two are DISJOINT',
        () => {
            const { sets } = ask();
            const s = new Set(sets.startSide.map(key));
            const g = new Set(sets.goalSide.map(key));
            expect([...s].filter((k) => g.has(k))).toEqual([]);
            expect(new Set([...s, ...g, ...sets.walled.map(key)])).toEqual(FLOOR);
        });

    it('⛔ the VERDICT is untouched by the sink — the legal door still passes', () => {
        expect(ask().refusal).toBeNull();
        expect(doorLawRefusal({
            width: W, height: H, walkableFor, start: START, goal: GOAL,
            doorKeys: new Set(['3,1']), clearerKeys: ['2,2'], name: 'the fixture',
            askOpenHalf: true,
        })).toBeNull();
    });

    /** ⛓ AND ON A NON-CUT the sets are still filled — a reader who asks "why is
     *  this decoration?" is asking exactly for the picture of one component. */
    it('⛓ a NON-CUT fills the sets too, and the two floods are then EQUAL', () => {
        const { refusal, sets } = ask({ doorKeys: new Set(['9,9']), clearerKeys: [] });
        expect(refusal).toMatch(/NOT A CUT/);
        expect(new Set(sets.startSide.map(key))).toEqual(FLOOR);
        expect(new Set(sets.goalSide.map(key))).toEqual(FLOOR);
    });
});

describe('⛓⛓ carveLawRefusal — the blob, its mouths and the two paths', () => {
    /** A one-cell pocket hanging off (2,1): legal — ONE blob, ONE mouth. */
    const carved = [{ x: 2, y: 0 }];
    const after = (x, y) => FLOOR.has(`${x},${y}`) || (x === 2 && y === 0);
    const call = () => {
        const sets = {};
        const refusal = carveLawRefusal({
            width: W, height: H, carved, walkableAfter: after,
            walkableBefore: (x, y) => FLOOR.has(`${x},${y}`),
            start: START, goal: GOAL, name: 'the fixture', sets,
        });
        return { refusal, sets };
    };

    it('the carve is legal, and the sink names its ONE mouth', () => {
        const { refusal, sets } = call();
        expect(refusal).toBeNull();
        expect(sets.blob).toEqual([{ x: 2, y: 0 }]);
        expect(sets.mouths).toEqual([{ x: 2, y: 1 }]);
    });

    it('⛓ and the two shortest paths, which is clause (b)\'s whole evidence', () => {
        const { sets } = call();
        expect(sets.pathBefore.map(key)).toEqual(['1,1', '2,1', '3,1', '4,1', '5,1']);
        expect(sets.pathAfter.map(key)).toEqual(sets.pathBefore.map(key));
    });

    it('⛔ an EMPTY carve reaches nothing and fills nothing', () => {
        const sets = {};
        expect(carveLawRefusal({
            width: W, height: H, carved: [], walkableAfter: after,
            walkableBefore: after, start: START, goal: GOAL, name: 'x', sets,
        })).toBeNull();
        expect(sets).toEqual({});
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ verifyAreaLevels — the per-level reachable SETS (D2)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Two areas in a lane, joined by one corridor cell, with the SECOND at key
 * level 1 and its boundary cell carrying a level-1 door:
 *
 *     0 1 2 3 4 5 6
 *   1   a a c b b        a = area A (level 0, holds the entrance)
 *                        c = a corridor cell
 *                        b = area B (level 1); its boundary cell is (4,1)
 */
describe('⛓⛓⛓ verifyAreaLevels — the level-n floods, carried', () => {
    const FLOOR2 = ['1,1', '2,1', '3,1', '4,1', '5,1'];
    const partition = {
        areas: [
            { id: 'A', cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }], boundary: [{ x: 2, y: 1 }] },
            { id: 'B', cells: [{ x: 4, y: 1 }, { x: 5, y: 1 }], boundary: [{ x: 4, y: 1 }] },
        ],
        corridorComponents: [{ cells: ['3,1'], touches: ['A', 'B'] }],
    };
    const call = () => {
        const sets = {};
        const out = verifyAreaLevels({
            width: W,
            height: H,
            isFloor: (x, y) => FLOOR2.includes(`${x},${y}`),
            entrance: { x: 1, y: 1 },
            partition,
            levelOfArea: (id) => (id === 'B' ? 1 : 0),
            doorLevelAt: (x, y) => ((x === 4 && y === 1) ? 1 : null),
            sets,
        });
        return { out, sets };
    };

    it('the verdict is unchanged — this partition and these doors AGREE', () => {
        expect(call().out).toBeNull();
    });

    it('⛓⛓ ONE ROW PER LEVEL ASKED, in the order they were asked', () => {
        expect(call().sets.levels.map((l) => l.level)).toEqual([0, 1]);
    });

    it('⛓⛓⛓ level 0 EXCLUDES the locked area, level 1 includes it', () => {
        const [l0, l1] = call().sets.levels;
        expect(new Set(l0.reached)).toEqual(new Set(['1,1', '2,1', '3,1']));
        expect(new Set(l1.reached)).toEqual(new Set(FLOOR2));
        expect(new Set(l0.reached)).toEqual(new Set(l0.expected));
    });

    it('⛔ a caller that passes NO sink gets exactly what it always got', () => {
        expect(verifyAreaLevels({
            width: W,
            height: H,
            isFloor: (x, y) => FLOOR2.includes(`${x},${y}`),
            entrance: { x: 1, y: 1 },
            partition,
            levelOfArea: (id) => (id === 'B' ? 1 : 0),
            doorLevelAt: (x, y) => ((x === 4 && y === 1) ? 1 : null),
        })).toBeNull();
    });

    /** ⛔ A REFUSED level-n flood still carries its sets — the picture a reader
     *  most wants is the one the refusal is about (D2's own sentence). */
    it('⛓⛓⛓ a REFUSAL carries the level that refused, sets and all', () => {
        const sets = {};
        const out = verifyAreaLevels({
            width: W,
            height: H,
            isFloor: (x, y) => FLOOR2.includes(`${x},${y}`),
            entrance: { x: 1, y: 1 },
            partition,
            levelOfArea: (id) => (id === 'B' ? 1 : 0),
            // ⛔ NO door at all: level 0 then reaches B, which the partition denies.
            doorLevelAt: () => null,
            sets,
        });
        expect(out.level).toBe(0);
        expect(sets.levels).toHaveLength(1);
        expect(new Set(sets.levels[0].reached)).toEqual(new Set(FLOOR2));
        expect(sets.levels[0].expected.length).toBeLessThan(sets.levels[0].reached.length);
    });
});
