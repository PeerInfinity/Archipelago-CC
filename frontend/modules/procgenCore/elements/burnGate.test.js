/**
 * procgenCore/elements/burnGate — the BURN GATE's own geometry, on hand-drawn
 * rooms (strategy switch r2). The probe is `soloDoor.test.js`' restated cut law
 * (this directory may not import a substrate module; the binding's rows in
 * `seedlingDemo/procgenBurnGate.test.js` drive the real one).
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { ELEMENT_LAWS, LAW_CUT } from '../elements.js';
import { TILE_FLOOR } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';
import {
    BURN_GATE, BURN_GATE_DOOR_ID, BURN_GATE_REFUSALS, BURN_TREE_SPAN, assertBurnGatePlacement,
    buildBurnGate, treeFootprint,
} from './burnGate.js';

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
    name: 'mulberry32 (burnGate.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const k = (x, y) => `${x},${y}`;

/** A room probe over a hand-drawn floor set, carrying the REAL shortcut law. */
function probeFor({ floor, start, goal, width = 12, height = 10 }) {
    const set = new Set(floor.map(([x, y]) => k(x, y)));
    const walkFor = (paint, walled) => {
        const p = new Map((paint ?? []).map((t) => [k(t.x, t.y), t.tile === TILE_FLOOR]));
        const w = walled ?? new Set();
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
    const connectedWith = ({ paint = [], walled = [] } = {}) => reach(
        walkFor(paint, new Set(walled.map((c) => k(c.x, c.y)))), start,
    ).has(k(goal.x, goal.y));
    return {
        width,
        height,
        start,
        goal,
        mainPath: pathTo(),
        floorAt: (x, y) => set.has(k(x, y)),
        connectedWith,
        isCut: (cell) => !connectedWith({ walled: [cell] }),
        /** ⛓ The CUT law restated (the binding's `doorLawRefusal` clauses 0-2):
         *  open, the goal is reachable; walled, it is not; walled, every clearer
         *  cell still is. ⛔ A restatement, because this directory may not import a
         *  SUBSTRATE module — the binding's own rows drive the real one. */
        doorLaw: ({ paint = [], doorCells = [], clearer = [] } = {}) => {
            const open = reach(walkFor(paint, new Set()), start);
            if (!open.has(k(goal.x, goal.y))) return 'the room is SEALED open';
            const shut = reach(walkFor(paint, new Set(doorCells.map((c) => k(c.x, c.y)))), start);
            if (shut.has(k(goal.x, goal.y))) return 'the door is NOT A CUT';
            if (clearer.some((c) => !shut.has(k(c.x, c.y)))) return 'the opener is behind its door';
            return null;
        },
    };
}

const site = (room) => ({ room, x: 0, y: 0, w: room.width, h: room.height });

/** An OPEN 10x10 room: the interior 1..8 is all floor. */
const OPEN_ROOM = (() => {
    const floor = [];
    for (let y = 1; y <= 8; y += 1) for (let x = 1; x <= 8; x += 1) floor.push([x, y]);
    return { floor, start: { x: 1, y: 1 }, goal: { x: 6, y: 7 }, width: 10, height: 10 };
})();
/** A 1-wide corridor with interior WALL on both sides (rows 1 and 3): no 2x2 of
 *  floor anywhere, so no tree fits — and the refusal is the floor clause's, not
 *  the border ring's. */
const CORRIDOR = {
    floor: Array.from({ length: 8 }, (_, i) => [i + 1, 2]),
    start: { x: 1, y: 2 }, goal: { x: 8, y: 2 }, width: 10, height: 5,
};
/** A 2-wide corridor running WEST to EAST: rows 1 and 2. */
const WIDE = (() => {
    const floor = [];
    for (let x = 1; x <= 10; x += 1) { floor.push([x, 1]); floor.push([x, 2]); }
    return { floor, start: { x: 1, y: 1 }, goal: { x: 10, y: 1 }, width: 12, height: 4 };
})();
/** Too short: every path cell is within DOOR_GOAL_MIN of the goal. */
const STUB = {
    floor: [[1, 1], [2, 1], [1, 2], [2, 2]], start: { x: 1, y: 1 }, goal: { x: 2, y: 2 },
    width: 4, height: 4,
};

const keyOf = (c) => `${c.x},${c.y}`;
const recorder = () => {
    const msgs = [];
    return { msgs, fail: (m) => { msgs.push(m); } };
};

describe('⛓ the BURN GATE element (strategy switch r2)', () => {
    it('declares itself: an on-connector CUT, one id, its refusal list', () => {
        expect(BURN_GATE.family).toBe('burngate');
        expect(BURN_GATE.phase).toBe('on-connector');
        expect(BURN_GATE.law).toBe(LAW_CUT);
        expect(ELEMENT_LAWS).toContain(BURN_GATE.law);
        expect(BURN_GATE_DOOR_ID).toBe('burngate_tree');
        expect(BURN_TREE_SPAN).toBe(2);
        expect(BURN_GATE_REFUSALS).toEqual(['no-cut-cell', 'goal-too-close', 'the-tree-does-not-fit',
            'wall-does-not-seal']);
    });

    it('the footprint is C, the cell beyond it and one side\'s two; the anchor is its top-left', () => {
        const cand = { cell: { x: 4, y: 4 }, before: { x: 4, y: 3 } }; // entered from the NORTH
        expect(treeFootprint(cand, { x: 1, y: 0 })).toEqual({
            cells: [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 5 }],
            anchor: { x: 4, y: 4 },
        });
        expect(treeFootprint(cand, { x: -1, y: 0 }).anchor).toEqual({ x: 3, y: 4 });
        // entered from the EAST: the tree extends WEST, away from the opener
        expect(treeFootprint({ cell: { x: 4, y: 4 }, before: { x: 5, y: 4 } }, { x: 0, y: -1 }).anchor)
            .toEqual({ x: 3, y: 3 });
    });

    it('EVERY candidate on the open room: four FLOOR cells, no endpoint, clearer outside, wall clear of the tree, a CUT', () => {
        const room = probeFor(OPEN_ROOM);
        const out = buildBurnGate(room);
        expect(out.refused).toBeUndefined();
        expect(out.candidates.length).toBeGreaterThan(0);
        for (const c of out.candidates) {
            const under = new Set(c.fp.cells.map(keyOf));
            expect(c.doorCells.map(keyOf).sort()).toEqual([...under].sort());
            for (const q of c.fp.cells) {
                expect(room.floorAt(q.x, q.y)).toBe(true);
                expect(keyOf(q)).not.toBe(keyOf(room.start));
                expect(keyOf(q)).not.toBe(keyOf(room.goal));
            }
            expect(under.has(keyOf(c.cand.before))).toBe(false);
            for (const t of c.tiles) expect(under.has(keyOf(t))).toBe(false);
            expect(room.doorLaw({ paint: c.tiles, doorCells: c.doorCells, clearer: [c.cand.before] }))
                .toBeNull();
            // ⛓ the tree, not the wall, fills the cut: walling only the wall leaves the room open
            expect(room.connectedWith({ paint: c.tiles })).toBe(true);
        }
    });

    it('places through the contract: one tree on C with its anchor, four door cells, demand empty', () => {
        const room = probeFor(OPEN_ROOM);
        const p = BURN_GATE.instantiate(rngFor(1), {}).construct(site(room));
        expect(p.refused).toBeUndefined();
        const [tree] = p.entities.obstacles;
        expect(tree.id).toBe(BURN_GATE_DOOR_ID);
        expect(p.doorCells).toHaveLength(4);
        expect(p.doorCells.map(keyOf)).toContain(keyOf(tree));
        expect(Math.min(...p.doorCells.map((c) => c.x))).toBe(tree.anchor.x);
        expect(Math.min(...p.doorCells.map((c) => c.y))).toBe(tree.anchor.y);
        expect(p.clearer).toHaveLength(1);
        expect(p.demand).toEqual([]);
        const r = recorder();
        assertBurnGatePlacement(p, r);
        expect(r.msgs).toEqual([]);
    });

    it('a 2-wide corridor carries it; a 1-wide one refuses `the-tree-does-not-fit` BY NAME', () => {
        const wide = BURN_GATE.instantiate(rngFor(2), {}).construct(site(probeFor(WIDE)));
        expect(wide.refused).toBeUndefined();
        expect(wide.tiles).toEqual([]); // the tree spans the corridor: no wall to grow
        const thin = buildBurnGate(probeFor(CORRIDOR));
        expect(thin.refused.reason).toBe('the-tree-does-not-fit');
        expect(BURN_GATE_REFUSALS).toContain(thin.refused.reason);
    });

    it('a room with no cell far enough from the goal refuses `goal-too-close`', () => {
        const out = buildBurnGate(probeFor(STUB));
        expect(out.refused?.reason).toBe('goal-too-close');
    });

    it('the placement assertion refuses a wall under the tree, a short door list and a clearer under it', () => {
        const p = BURN_GATE.instantiate(rngFor(1), {}).construct(site(probeFor(OPEN_ROOM)));
        const r1 = recorder();
        assertBurnGatePlacement({ ...p, tiles: [...p.tiles, { ...p.doorCells[1], tile: 'wall' }] }, r1);
        expect(r1.msgs.join(' ')).toMatch(/UNDER the tree/);
        const r2 = recorder();
        assertBurnGatePlacement({ ...p, doorCells: p.doorCells.slice(0, 3) }, r2);
        expect(r2.msgs.join(' ')).toMatch(/FOUR cells/);
        const r3 = recorder();
        assertBurnGatePlacement({ ...p, clearer: [p.doorCells[1]] }, r3);
        expect(r3.msgs.join(' ')).toMatch(/NOT under the tree|4-adjacent/);
    });
});
