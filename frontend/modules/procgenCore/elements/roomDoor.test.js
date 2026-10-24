/**
 * procgenCore/elements/roomDoor + killGate + blockPocket — **THE TWO ROOM-AWARE
 * DOOR ELEMENTS' OWN GEOMETRY**, on hand-drawn rooms.
 *
 * PROCGEN ELEMENTS arc 3, slice 4a. Every row here is a LITERAL claim about one
 * rule (trap 250): the wall grows to N cells on THIS room, the pocket lands on
 * THAT cell, this straight run refuses BY NAME. ⛔ Nothing here generates and
 * nothing solves — the census (`census-seedling-doors-elements.mjs`) counts what
 * generation produces and the yield table certifies it; these rows are what a
 * mutant has to redden.
 *
 * ── ⛔ THE `doorLaw` HERE IS A TEST DOUBLE, AND IT IS LABELLED ────────
 *
 * The real law is `procgenSeedling.doorLawRefusal` — a SUBSTRATE module this
 * directory may not import (`bindingContract.test.js` asserts the boundary). So
 * the probe below implements the two clauses in terms of its own `connectedWith`
 * flood, in six lines, and it is deliberately the smallest thing that can say
 * *cut* and *start-side*. ⛓ What gates the REAL law against these elements is
 * `seedlingDemo/procgenDoorElements.test.js`, which drives them through
 * `seedlingModel` — so the law has two callers and both are tested, which is the
 * arrangement `urlParams.test.js`'s own header argues for.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { BLOCK_POCKET, buildBlockPocket } from './blockPocket.js';
import {
    KILL_BODY_ID, KILL_DOOR_ID, KILL_GATE, buildKillGate,
} from './killGate.js';
import { DOOR_GOAL_MIN, doorCandidates, growWall, wallAxisAt } from './roomDoor.js';
import { TILE_FLOOR, TILE_WALL } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';

const mulberry32 = (seed) => {
    let s = seed | 0;
    return () => {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
const SOURCE = Object.freeze({
    name: 'mulberry32 (roomDoor.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const k = (x, y) => `${x},${y}`;

/**
 * A room probe over a hand-drawn floor set. ⛓ `mainPath` is a BFS shortest path
 * in the same neighbour order `gridFlood` uses, so a candidate list here is the
 * candidate list the binding would offer.
 */
function probeFor({ floor, start, goal, width = 10, height = 10 }) {
    const set = new Set(floor.map(([x, y]) => k(x, y)));
    const walkFor = (paint, walled) => {
        const p = new Map((paint ?? []).map((t) => [k(t.x, t.y), t.tile === TILE_FLOOR]));
        const w = new Set((walled ?? []).map((c) => k(c.x, c.y)));
        return (x, y) => {
            if (w.has(k(x, y))) return false;
            const q = p.get(k(x, y));
            return q === undefined ? set.has(k(x, y)) : q;
        };
    };
    const reach = (ok, from) => {
        const seen = new Set([k(from.x, from.y)]);
        const q = [from];
        for (let i = 0; i < q.length; i += 1) {
            for (const [dx, dy] of NB) {
                const x = q[i].x + dx;
                const y = q[i].y + dy;
                if (x < 0 || y < 0 || x >= width || y >= height) continue;
                if (seen.has(k(x, y)) || !ok(x, y)) continue;
                seen.add(k(x, y));
                q.push({ x, y });
            }
        }
        return seen;
    };
    const pathTo = () => {
        const parent = new Map([[k(start.x, start.y), null]]);
        const q = [start];
        for (let i = 0; i < q.length; i += 1) {
            if (q[i].x === goal.x && q[i].y === goal.y) break;
            for (const [dx, dy] of NB) {
                const x = q[i].x + dx;
                const y = q[i].y + dy;
                if (!set.has(k(x, y)) || parent.has(k(x, y))) continue;
                parent.set(k(x, y), k(q[i].x, q[i].y));
                q.push({ x, y });
            }
        }
        if (!parent.has(k(goal.x, goal.y))) return [];
        const out = [];
        for (let key = k(goal.x, goal.y); key !== null; key = parent.get(key)) {
            const [x, y] = key.split(',').map(Number);
            out.unshift({ x, y });
        }
        return out;
    };
    const connectedWith = ({ paint = [], walled = [] } = {}) => reach(walkFor(paint, walled),
        start).has(k(goal.x, goal.y));
    return {
        width,
        height,
        start,
        goal,
        mainPath: pathTo(),
        floorAt: (x, y) => set.has(k(x, y)),
        connectedWith,
        isCut: (cell) => !connectedWith({ walled: [cell] }),
        /** ⛔ THE TEST DOUBLE — see the file docblock. */
        doorLaw: ({ paint = [], doorCells = [], clearer = [] } = {}) => {
            if (!connectedWith({ paint })) return 'seals the room';
            if (connectedWith({ paint, walled: doorCells })) return 'not a cut';
            const ok = reach(walkFor(paint, doorCells), start);
            for (const c of clearer) if (!ok.has(k(c.x, c.y))) return 'clearer is goal-side';
            return null;
        },
    };
}

/** The 8x8 interior of the bordered 10x10 room, all floor. */
const OPEN_ROOM = (() => {
    const floor = [];
    for (let y = 1; y <= 8; y += 1) for (let x = 1; x <= 8; x += 1) floor.push([x, y]);
    return floor;
})();

/** A one-wide corridor: east along row 1, south down column 8, west along row 8. */
const CORRIDOR = [
    [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1],
    [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8],
    [7, 8], [6, 8], [5, 8], [4, 8], [3, 8],
];

/**
 * ⛓ THE BLOCK POCKET'S OWN CORRIDOR — `procgenShoveDistance.test.js`'s room,
 * cell for cell. ⛔ It is NOT `CORRIDOR`: there the straight run east ends at
 * the BORDER RING, so every candidate refuses `the-run-reaches-the-ring` and
 * the element places nothing at all. The bend at (5,1) is what gives the block
 * somewhere to go, and it is the shape D3's measurement used.
 */
const BENT = [
    [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
    [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8],
    [6, 8], [7, 8], [8, 8],
];

/** A one-wide LOOP — two routes from the start to the goal, so no ONE line
 *  cuts the room and every candidate's wall is decoration. */
const LOOP = (() => {
    const floor = [];
    for (let x = 1; x <= 5; x += 1) { floor.push([x, 1]); floor.push([x, 5]); }
    for (let y = 2; y <= 4; y += 1) { floor.push([1, y]); floor.push([5, y]); }
    return floor;
})();

/** A staircase — EVERY interior path cell is a bend, so the push direction
 *  always runs into wall. */
const STAIRCASE = [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4]];

describe('⛓⛓⛓ THE WALL IS GROWN, NOT DRAWN — and it grows to what the room is', () => {
    it('an OPEN room: 7 cells, the whole line to the border ring BOTH ways', () => {
        const room = probeFor({ floor: OPEN_ROOM, start: { x: 1, y: 1 }, goal: { x: 8, y: 8 } });
        const wall = growWall(room, { x: 4, y: 4 }, 'y');
        expect(wall.length).toBe(7);
        expect(wall.map((c) => c.y).sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 6, 7, 8]);
        expect(new Set(wall.map((c) => c.x))).toEqual(new Set([4]));
    });

    it('a ONE-WIDE CORRIDOR: 0 cells — the neighbours are already wall', () => {
        const room = probeFor({ floor: CORRIDOR, start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
        expect(growWall(room, { x: 4, y: 1 }, 'y')).toEqual([]);
    });

    /** ⛓ THE CHAMBER — a 3x3 room hanging off the corridor. The wall grows to
     *  the chamber's own walls, which is neither 0 nor the full span. */
    it('a CHAMBER: to the chamber\'s walls, and that is 2', () => {
        const floor = [...CORRIDOR, [5, 2], [5, 3], [4, 2], [4, 3], [6, 2], [6, 3]];
        const room = probeFor({ floor, start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
        const wall = growWall(room, { x: 5, y: 2 }, 'x');
        expect(wall.map((c) => `${c.x},${c.y}`).sort()).toEqual(['4,2', '6,2']);
    });

    /** ⛔ THE START AND THE GOAL ARE NOT GROWABLE — the growth stops before
     *  them, which leaves a hole and lets the LAW refuse rather than building a
     *  room whose start is wall. */
    it('stops at the START and at the GOAL rather than walling either', () => {
        const room = probeFor({ floor: OPEN_ROOM, start: { x: 4, y: 1 }, goal: { x: 4, y: 8 } });
        const wall = growWall(room, { x: 4, y: 4 }, 'y');
        expect(wall.map((c) => c.y).sort((a, b) => a - b)).toEqual([2, 3, 5, 6, 7]);
    });

    /** ⛔ A BEND HAS NO SINGLE PERPENDICULAR, so the wall is the door cell
     *  alone — stated as a rule, and the law then decides. */
    it('a BEND grows NOTHING, and `wallAxisAt` says why', () => {
        const path = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }];
        expect(wallAxisAt(path, 1)).toBe(null);
        const straightH = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
        expect(wallAxisAt(straightH, 1)).toBe('y');
        const straightV = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }];
        expect(wallAxisAt(straightV, 1)).toBe('x');
        const room = probeFor({ floor: OPEN_ROOM, start: { x: 1, y: 1 }, goal: { x: 8, y: 8 } });
        expect(growWall(room, { x: 4, y: 4 }, null)).toEqual([]);
    });
});

describe('⛓⛓ THE DOOR CANDIDATES — the main path, minus the endpoints and the goal\'s doorstep',
    () => {
        it('excludes both endpoints and carries the START-SIDE neighbour', () => {
            const room = probeFor({ floor: CORRIDOR,
                start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
            const cands = doorCandidates(room);
            expect(cands[0].cell).toEqual({ x: 2, y: 1 });
            expect(cands[0].before).toEqual({ x: 1, y: 1 });
            expect(cands.some((c) => c.cell.x === 1 && c.cell.y === 1)).toBe(false);
            expect(cands.some((c) => c.cell.x === 3 && c.cell.y === 8)).toBe(false);
        });

        /** ⛓ THE GOAL >= 2 RULE (trap 348 at the picker) — the two cells nearest
         *  the goal are OFFERED by the candidate list and REFUSED by the element,
         *  which is why the rule is a row on the element and not on the list. */
        it('`goal-too-close` — every candidate within 2 of the goal is refused BY NAME', () => {
            const floor = [[1, 1], [2, 1], [3, 1]];
            const room = probeFor({ floor, start: { x: 1, y: 1 }, goal: { x: 3, y: 1 } });
            expect(doorCandidates(room).map((c) => c.goalDistance)).toEqual([1]);
            expect(DOOR_GOAL_MIN).toBe(2);
            expect(buildKillGate(room).refused.reason).toBe('goal-too-close');
            expect(buildBlockPocket(room).refused.reason).toBe('goal-too-close');
        });

        it('`no-cut-cell` — a two-cell path offers nothing at all', () => {
            const room = probeFor({ floor: [[1, 1], [2, 1]],
                start: { x: 1, y: 1 }, goal: { x: 2, y: 1 } });
            expect(doorCandidates(room)).toEqual([]);
            expect(buildKillGate(room).refused.reason).toBe('no-cut-cell');
        });
    });

describe('⛓⛓⛓ THE KILL GATE', () => {
    it('a CORRIDOR: the wall is 0, the pocket is CARVED beside the start-side cell', () => {
        const room = probeFor({ floor: CORRIDOR, start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
        const out = buildKillGate(room);
        const first = out.candidates[0];
        expect(first.wall).toEqual([]);
        expect(first.pocket.carved).toBe(true);
        // the pocket hangs off `before` = (1,1), and (1,2) is the only legal side
        expect(first.pocket.cell).toEqual({ x: 1, y: 2 });
    });

    it('an OPEN room: the wall grows the full 7 and the pocket is EXISTING floor', () => {
        const room = probeFor({ floor: OPEN_ROOM, start: { x: 1, y: 1 }, goal: { x: 8, y: 8 } });
        const out = buildKillGate(room);
        const wide = out.candidates.find((c) => c.wall.length === 7);
        expect(wide, 'some candidate grows the full span').toBeTruthy();
        expect(wide.pocket.carved).toBe(false);
        expect(wide.pocket.neighbours).toBeGreaterThanOrEqual(2);
    });

    /**
     * ⛔⛔ A ROOM WITH A SECOND ROUTE IS NOT SEALED BY ONE LINE, and it is the
     * LAW that says so rather than the geometry: the wall grows exactly as it
     * does in the sealing case (0 cells on this one-wide loop) and the FLOOD is
     * what distinguishes them. ⛓ It is a LOOP rather than the chamber D2's
     * sentence names because a loop is the smallest room that has the property,
     * and the census counts the same refusal 12 times on `loopy`/`open`.
     */
    it('a room with a SECOND ROUTE refuses `wall-does-not-seal`', () => {
        const room = probeFor({ floor: LOOP, start: { x: 1, y: 1 }, goal: { x: 5, y: 5 } });
        expect(buildKillGate(room).refused?.reason).toBe('wall-does-not-seal');
        expect(buildBlockPocket(room).refused?.reason).toBe('wall-does-not-seal');
    });

    /**
     * ⛔⛔ **THE POCKET IS START-SIDE BY CONSTRUCTION, AND NO FIXTURE CAN MAKE
     * THE ELEMENT PRODUCE A GOAL-SIDE ONE.** The search hangs off `before` —
     * the path cell BEFORE the door — so a goal-side cell is never a candidate
     * at all. The first cut of this row tried to build a room whose only nub sat
     * past the door and got a PLACED gadget with a perfectly ordinary
     * start-side pocket, which is the row proving the construction rather than
     * the clause.
     *
     * ⇒ TWO ROWS, because they are two claims: this one asserts the
     * CONSTRUCTION (every candidate's pocket is a 4-neighbour of a cell that
     * precedes the door on the path), and clause 2 of the LAW is gated where it
     * can be violated — `seedlingDemo/procgenDoorElements.test.js` hands the
     * composite a hand-built placement whose clearer is goal-side.
     */
    it('every candidate\'s pocket hangs off the cell BEFORE the door, and the law agrees',
        () => {
            const room = probeFor({ floor: CORRIDOR,
                start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
            const order = room.mainPath.map((c) => `${c.x},${c.y}`);
            for (const c of buildKillGate(room).candidates) {
                const d = Math.abs(c.pocket.cell.x - c.cand.before.x)
                    + Math.abs(c.pocket.cell.y - c.cand.before.y);
                expect(d, `pocket ${JSON.stringify(c.pocket.cell)}`).toBe(1);
                expect(order.indexOf(`${c.cand.before.x},${c.cand.before.y}`))
                    .toBeLessThan(order.indexOf(`${c.cand.cell.x},${c.cand.cell.y}`));
            }
            // ⛓ AND THE LAW WOULD REFUSE A GOAL-SIDE ONE — asked directly, since
            // the element cannot offer one.
            const first = buildKillGate(room).candidates[0];
            const beyond = room.mainPath[room.mainPath.length - 2];
            expect(room.doorLaw({ paint: first.tiles, doorCells: [first.cand.cell],
                clearer: [beyond] })).toBe('clearer is goal-side');
        });

    it('the placement is TWO obstacles in a fixed order, and the contract asserts it', () => {
        const room = probeFor({ floor: CORRIDOR, start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
        const site = { x: 1, y: 1, w: 8, h: 8, room };
        const p = KILL_GATE.instantiate(rngFor(4), {}).construct(site);
        expect(p.entities.obstacles.map((o) => o.id)).toEqual([KILL_DOOR_ID, KILL_BODY_ID]);
        expect(p.doorCells).toEqual([{ x: p.entities.obstacles[0].x, y: p.entities.obstacles[0].y }]);
        expect(p.clearer).toEqual([{ x: p.entities.obstacles[1].x, y: p.entities.obstacles[1].y }]);
        expect(p.area).toBe(null);
        expect(p.ports).toBe(undefined);
        expect(p.tiles.every((t) => t.tile === TILE_FLOOR || t.tile === TILE_WALL)).toBe(true);
    });

    /** ⛓ ONE DRAW, AND IT IS A CHOICE AMONG CANDIDATES THAT ALL PASSED. */
    it('spends exactly ONE draw, and every candidate it could have drawn is legal', () => {
        const room = probeFor({ floor: CORRIDOR, start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
        const rng = rngFor(9);
        const before = rng.draws;
        KILL_GATE.instantiate(rng, {}).construct({ x: 1, y: 1, w: 8, h: 8, room });
        expect(rng.draws - before).toBe(1);
        for (const c of buildKillGate(room).candidates) {
            expect(room.doorLaw({ paint: c.tiles, doorCells: [c.cand.cell],
                clearer: [c.pocket.cell] })).toBe(null);
        }
    });

    it('declares the `on-connector` phase and NO parameters', () => {
        expect(KILL_GATE.phase).toBe('on-connector');
        expect(KILL_GATE.params).toEqual([]);
    });
});

describe('⛓⛓⛓ THE BLOCK POCKET — the straight-run walk', () => {
    /**
     * ⛓ THE BEND IS CARVED, and the block ends off the corridor's turn — on
     * `procgenShoveDistance.test.js`'s own room, so the geometry this row
     * asserts is the geometry that measurement drove.
     */
    it('a CORRIDOR: the run ends at the bend, the bend is CARVED, and the push is the walk',
        () => {
            const room = probeFor({ floor: BENT, start: { x: 1, y: 1 }, goal: { x: 8, y: 8 } });
            const got = buildBlockPocket(room).candidates
                .map((c) => [`${c.cand.cell.x},${c.cand.cell.y}`, `${c.rest.cell.x},${c.rest.cell.y}`,
                    c.rest.carved, c.rest.run.length + (c.rest.carved ? 1 : 0)]);
            expect(got).toEqual([
                ['2,1', '6,1', true, 4],
                ['3,1', '6,1', true, 3],
                ['4,1', '6,1', true, 2],
            ]);
        });

    /** ⛔ AND `CORRIDOR`'s OWN RUN ENDS AT THE RING, which is why the row above
     *  uses `BENT`: the same element refuses that room outright. */
    it('`the-run-reaches-the-ring` — a run whose bend IS the border ring refuses', () => {
        const room = probeFor({ floor: CORRIDOR, start: { x: 1, y: 1 }, goal: { x: 3, y: 8 } });
        expect(buildBlockPocket(room).refused?.reason).toBe('the-run-reaches-the-ring');
    });

    it('`the-run-reaches-a-junction` — a branch off the run refuses BY NAME', () => {
        const floor = [[1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3], [3, 2],
            [5, 1], [6, 1], [6, 2], [6, 3]];
        const room = probeFor({ floor, start: { x: 1, y: 1 }, goal: { x: 4, y: 3 } });
        const out = buildBlockPocket(room);
        expect(out.refused?.reason).toBe('the-run-reaches-a-junction');
    });

    /** ⛓ A BEND AT THE DOOR RUNS THE PUSH INTO WALL. On a STAIRCASE every
     *  interior path cell is one, so every candidate refuses the same way. */
    it('`no-pocket` — a bend at the door itself has nothing to push into', () => {
        const room = probeFor({ floor: STAIRCASE, start: { x: 1, y: 1 }, goal: { x: 5, y: 4 } });
        expect(buildBlockPocket(room).refused?.reason).toBe('no-pocket');
    });

    /**
     * ⛓⛓⛓ THE OPEN ROOM NEEDS `k = 2`, NOT `k = 1` — the defect D4's census
     * caught. A block one cell past the gap of a full-span wall PLUGS the only
     * opening, so the walk must keep going.
     */
    it('an OPEN room: the wall grows 7 and the block rests TWO cells past the gap', () => {
        const room = probeFor({ floor: OPEN_ROOM, start: { x: 1, y: 1 }, goal: { x: 8, y: 8 } });
        const wide = buildBlockPocket(room).candidates.find((c) => c.wall.length === 7);
        expect(wide, 'some candidate grows the full span').toBeTruthy();
        expect(wide.rest.carved).toBe(false);
        const d = Math.abs(wide.rest.cell.x - wide.cand.cell.x)
            + Math.abs(wide.rest.cell.y - wide.cand.cell.y);
        expect(d).toBe(2);
        // ⛔ and ONE cell would NOT do — the claim the census refuted
        const one = { x: wide.cand.cell.x + Math.sign(wide.rest.cell.x - wide.cand.cell.x),
            y: wide.cand.cell.y + Math.sign(wide.rest.cell.y - wide.cand.cell.y) };
        expect(room.connectedWith({ paint: wide.tiles, walled: [one] })).toBe(false);
        expect(room.connectedWith({ paint: wide.tiles, walled: [wide.rest.cell] })).toBe(true);
    });

    it('the placement is ONE block, `clearer` EMPTY, and `cost.push` the guarantee', () => {
        const room = probeFor({ floor: BENT, start: { x: 1, y: 1 }, goal: { x: 8, y: 8 } });
        const p = BLOCK_POCKET.instantiate(rngFor(2), {})
            .construct({ x: 1, y: 1, w: 8, h: 8, room });
        expect(p.entities.blocks.length).toBe(1);
        expect(p.entities.obstacles).toEqual([]);
        expect(p.clearer).toEqual([]);
        expect(p.doorCells).toEqual([{ x: p.entities.blocks[0].x, y: p.entities.blocks[0].y }]);
        expect(p.cost.push).toBeGreaterThanOrEqual(1);
        expect(p.area).toBe(null);
    });

    it('declares the `on-connector` phase and NO parameters', () => {
        expect(BLOCK_POCKET.phase).toBe('on-connector');
        expect(BLOCK_POCKET.params).toEqual([]);
    });
});
