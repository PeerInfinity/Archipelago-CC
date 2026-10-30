/**
 * procgenCore/elements/ropeGate — the ROPE GATE's own geometry, on hand-drawn
 * rooms (seedling gen A1). One row per placement rule of the design (§1.4),
 * each an invariant asked of EVERY candidate the search offers, on a room
 * built so that the rule is the only thing standing between the search and a
 * wrong candidate.
 *
 * MUTANTS (each applied to `ropeGate.js` by hand, the row run, then reverted —
 * the slice's as-built carries the measured table):
 *  (i)   the stance taken as the rope's first FLOOR neighbour (the start-side
 *        flood dropped) ⇒ the `(i)` row reds on CHAMBER_ROOM (the pocket
 *        above the rope is not on the start side once the rope is solid);
 *        the rope-costs-no-route clause dropped ⇒ the same row reds (a rope on
 *        the one-wide corridor);
 *  (ii)  the TOP-most run offered instead of the bottom-most ⇒ the `(ii)` row
 *        reds on BAND_ROOM (column 5's top run is a cut, and its priced lane
 *        runs on through the bottom band's floor);
 *  (iii) the door law not asked ⇒ the `(iii)` row reds on BAND_ROOM (column
 *        5's bottom run, which the walk goes round).
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import {
    ROPE_GATE, ROPE_GATE_REFUSALS, ROPE_GATE_ROPE_ID, ROPE_GATE_TRAP_ID, ROPE_NEAR_GATE,
    assertRopeGatePlacement, buildRopeGate, laneOfColumn,
} from './ropeGate.js';
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
    name: 'mulberry32 (ropeGate.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const k = (x, y) => `${x},${y}`;

/** A room probe over a hand-drawn floor set, with the cut law restated
 *  (`soloDoor.test.js`'s probe; this directory may not import a substrate). */
function probeFor({ floor, start, goal, width = 12, height = 10 }) {
    const set = new Set(floor.map(([x, y]) => k(x, y)));
    const walkFor = (walled) => (x, y) => !walled.has(k(x, y)) && set.has(k(x, y));
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
        const out = [];
        for (let key = k(goal.x, goal.y); key !== null; key = parent.get(key)) {
            const [x, y] = key.split(',').map(Number);
            out.unshift({ x, y });
        }
        return out;
    };
    const connectedWith = ({ walled = [] } = {}) => reach(
        walkFor(new Set(walled.map((c) => k(c.x, c.y)))), start).has(k(goal.x, goal.y));
    return {
        width,
        height,
        start,
        goal,
        mainPath: pathTo(),
        floorAt: (x, y) => set.has(k(x, y)),
        connectedWith,
        isCut: (cell) => !connectedWith({ walled: [cell] }),
        reach: (walled) => reach(walkFor(new Set(walled.map((c) => k(c.x, c.y)))), start),
        doorLaw: ({ doorCells = [], clearer = [] } = {}) => {
            if (!connectedWith()) return 'the room is SEALED open';
            const shut = reach(walkFor(new Set(doorCells.map((c) => k(c.x, c.y)))), start);
            if (shut.has(k(goal.x, goal.y))) return 'the door is NOT A CUT';
            if (clearer.some((c) => !shut.has(k(c.x, c.y)))) return 'the opener is behind its door';
            return null;
        },
    };
}

const rect = (x0, y0, x1, y1) => {
    const out = [];
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) out.push([x, y]);
    return out;
};

/** ⛓ CHAMBER_ROOM — a start chamber with a POCKET above it, a one-wide
 *  corridor, a one-wide N–S lane column (6) and the goal room off its foot. */
const CHAMBER_ROOM = Object.freeze({
    floor: [...rect(1, 2, 3, 4), [2, 1], [4, 3], [5, 3], ...rect(6, 1, 6, 8),
        ...rect(7, 7, 10, 8)],
    start: { x: 1, y: 3 },
    goal: { x: 10, y: 7 },
});

/** ⛓ BAND_ROOM — a top band (the route), a full wall row at y=5, and a bottom
 *  band reached only through (1,5) on the START side. Column 5 has TWO runs:
 *  the top one is a cut of the route; the bottom one is not a cut at all. */
const BAND_ROOM = Object.freeze({
    floor: [...rect(1, 1, 10, 4), [1, 5], ...rect(1, 6, 10, 8)],
    start: { x: 1, y: 1 },
    goal: { x: 10, y: 1 },
});

const site = (room) => ({ room, x: 1, y: 1, w: room.width - 2, h: room.height - 2 });

/** The three rules, as invariants of one candidate. */
const ruleI = (room, c) => room.reach([...c.lane.cells, c.rope]).has(k(c.stance.x, c.stance.y))
    && room.connectedWith({ walled: [c.rope] });
const ruleII = (room, c) => {
    const lane = new Set(c.lane.cells.map((l) => k(l.x, l.y)));
    for (let y = c.lane.cells[0].y; y < room.height; y += 1) {
        if (room.floorAt(c.lane.x, y) && !lane.has(k(c.lane.x, y))) return false;
    }
    return true;
};
const ruleIII = (room, c) => room.doorLaw({ doorCells: c.lane.cells, clearer: [c.stance] }) === null;

describe('the ROPE GATE — placement rules (design §1.4)', () => {
    it('declares its refusals and its two ids', () => {
        expect(ROPE_GATE.family).toBe('ropegate');
        expect(ROPE_GATE.phase).toBe('on-connector');
        expect(ROPE_GATE_REFUSALS).toEqual(['no-lane-cell', 'the-lane-holds-the-start-or-the-goal',
            'goal-too-close', 'the-lane-is-not-a-cut', 'no-rope-cell']);
        expect([ROPE_GATE_TRAP_ID, ROPE_GATE_ROPE_ID]).toEqual(['ropegate_trap', 'ropegate_rope']);
    });

    it('a lane is a column\'s BOTTOM-MOST floor run, with the wall below it to the ring', () => {
        const room = probeFor(BAND_ROOM);
        const lane = laneOfColumn(room, 5);
        expect(lane.cells.map((c) => c.y)).toEqual([6, 7, 8]);
        expect(lane.below.map((c) => c.y)).toEqual([9]);
        expect(laneOfColumn(room, 0)).toBe(null);
    });

    it('(i) every rope\'s stance is reached from the start with the lane AND the rope walled, '
        + 'and the solid rope costs no route', () => {
        const room = probeFor(CHAMBER_ROOM);
        const out = buildRopeGate(room);
        expect(out.refused).toBeUndefined();
        expect(out.candidates.length).toBeGreaterThan(0);
        for (const c of out.candidates) expect(ruleI(room, c)).toBe(true);
        /** ⛓ The rope is never on the one-wide corridor (walling it cuts the room). */
        expect(out.candidates.map((c) => k(c.rope.x, c.rope.y))).not.toContain('4,3');
        expect(out.candidates.map((c) => k(c.rope.x, c.rope.y))).not.toContain('5,3');
        for (const c of out.candidates) expect(c.ropeDistance).toBeLessThanOrEqual(ROPE_NEAR_GATE);
    });

    it('(ii) the priced lane holds no floor the element does not own, to the level floor', () => {
        for (const def of [BAND_ROOM, CHAMBER_ROOM]) {
            const room = probeFor(def);
            const out = buildRopeGate(room);
            for (const c of out.candidates ?? []) expect(ruleII(room, c)).toBe(true);
        }
        /** ⛔ BAND_ROOM's column 5: its top run IS a cut, and its lane would run on
         *  through the bottom band — so column 5 is never offered. */
        const band = buildRopeGate(probeFor(BAND_ROOM));
        expect((band.candidates ?? []).filter((c) => c.lane.x === 5)).toEqual([]);
    });

    it('(iii) the goal side is reachable only through the lane (the door law, with the stance)', () => {
        for (const def of [BAND_ROOM, CHAMBER_ROOM]) {
            const room = probeFor(def);
            for (const c of buildRopeGate(room).candidates ?? []) expect(ruleIII(room, c)).toBe(true);
        }
        /** ⛓ BAND_ROOM has no lane that is a cut at all: every column's bottom-most
         *  run is in the bottom band, which the route never needs. */
        expect(buildRopeGate(probeFor(BAND_ROOM)).refused.reason).toBe('the-lane-is-not-a-cut');
    });

    it('a one-wide start side with no spare floor CARVES a one-mouth pocket for the rope', () => {
        const room = probeFor({ floor: [...rect(1, 1, 5, 1), ...rect(5, 2, 5, 8), ...rect(6, 8, 10, 8)],
            start: { x: 1, y: 1 }, goal: { x: 10, y: 8 } });
        const out = buildRopeGate(room);
        expect(out.refused).toBeUndefined();
        for (const c of out.candidates) {
            expect(c.carved).toBe(true);
            expect(room.floorAt(c.rope.x, c.rope.y)).toBe(false);
            expect(Math.abs(c.rope.x - c.stance.x) + Math.abs(c.rope.y - c.stance.y)).toBe(1);
        }
    });

    it('the lane may not hold the start or the goal', () => {
        const out = buildRopeGate(probeFor({ floor: rect(1, 1, 1, 8), start: { x: 1, y: 1 },
            goal: { x: 1, y: 8 } }));
        expect(out.refused.reason).toBe('the-lane-holds-the-start-or-the-goal');
    });
});

describe('the ROPE GATE — the placement it constructs', () => {
    it('a TRAP on the lane head, a ROPE with its node, the stance as clearer; owns the lane '
        + 'below as wall', () => {
        const room = probeFor(CHAMBER_ROOM);
        const p = ROPE_GATE.instantiate(rngFor(1), {}).construct(site(room));
        expect(p.refused).toBeUndefined();
        const [trap, rope] = p.entities.obstacles;
        expect(trap.id).toBe(ROPE_GATE_TRAP_ID);
        expect(rope.id).toBe(ROPE_GATE_ROPE_ID);
        expect(rope.node).toEqual({ x: rope.x, y: rope.y });
        expect(p.doorCells[0]).toEqual({ x: trap.x, y: trap.y });
        expect(p.tiles).toContainEqual({ x: rope.x, y: rope.y, tile: TILE_FLOOR });
        for (const t of p.tiles.filter((w) => w.tile === TILE_WALL)) {
            expect(t.x).toBe(trap.x);
            expect(t.y).toBeGreaterThan(p.doorCells.at(-1).y);
            expect(t.y).toBeLessThan(room.height - 1);
        }
        expect(p.demand).toEqual([]);
        expect(p.cost.candidates).toBeGreaterThan(0);
    });

    it('⛔ the placement assertion refuses a stance not next to the rope', () => {
        const room = probeFor(CHAMBER_ROOM);
        const p = ROPE_GATE.instantiate(rngFor(1), {}).construct(site(room));
        const bad = { ...p, clearer: [{ x: p.clearer[0].x + 5, y: p.clearer[0].y }] };
        expect(() => assertRopeGatePlacement(bad, { fail: (m) => { throw new Error(m); } }))
            .toThrow(/not 4-adjacent to the rope/);
    });
});
