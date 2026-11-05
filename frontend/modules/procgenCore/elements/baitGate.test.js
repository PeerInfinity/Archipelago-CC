/**
 * procgenCore/elements/baitGate — the BAIT GATE's own geometry, on hand-drawn
 * rooms (seedling gen baitgate). One row per placement rule, each an invariant
 * asked of EVERY candidate the search offers.
 *
 * MUTANTS (each applied to `baitGate.js` by hand, the rows run, then reverted —
 * the slice's as-built carries the measured table):
 *  (a) `[0, 1]` (the lure level with the approach) put first in `LURE_OFFSETS`
 *      ⇒ the "never level with the door's start-side neighbour" row reds;
 *  (b) the `lureStances` filter dropped ⇒ the "every lure offers a stance" row
 *      reds (EDGE_ROOM: the door against the ring, whose lure has no stance);
 *  (c) the `clear` cells dropped ⇒ the "owns the start-side floor in the
 *      leash" row reds.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import {
    BAIT_GATE, BAIT_GATE_BODY_ID, BAIT_GATE_LURE_ID, BAIT_GATE_REFUSALS, BAIT_LEASH_CELLS, LURE_OFFSETS,
    assertBaitGatePlacement, buildBaitGate, lureStances,
} from './baitGate.js';
import { TILE_FLOOR } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';

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
    name: 'mulberry32 (baitGate.test)',
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
 *  (`ropeGate.test.js`'s probe; this directory may not import a substrate). */
function probeFor({ floor, start, goal, width = 12, height = 8 }) {
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
        doorLaw: ({ doorCells = [], clearer = [] } = {}) => {
            if (!connectedWith()) return 'the room is SEALED open';
            const shut = reach(walkFor(new Set(doorCells.map((c) => k(c.x, c.y)))), start);
            if (shut.has(k(goal.x, goal.y))) return 'the door is NOT A CUT';
            if (clearer.some((c) => !shut.has(k(c.x, c.y)))) return 'the opener is behind its door';
            return null;
        },
        /** the test's own flood, with extra walls and extra floor */
        reachWith: ({ walled = [], floored = [] } = {}) => {
            const w = new Set(walled.map((c) => k(c.x, c.y)));
            const f = new Set(floored.map((c) => k(c.x, c.y)));
            return reach((x, y) => !w.has(k(x, y)) && (set.has(k(x, y)) || f.has(k(x, y))), start);
        },
    };
}

const rect = (x0, y0, x1, y1) => {
    const out = [];
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) out.push([x, y]);
    return out;
};

/** ⛓ CHAMBER_ROOM — a start chamber, a one-wide corridor (the cuts), a goal chamber. */
const CHAMBER_ROOM = Object.freeze({
    floor: [...rect(1, 1, 4, 5), [5, 3], [6, 3], [7, 3], ...rect(8, 1, 10, 5)],
    start: { x: 1, y: 1 },
    goal: { x: 10, y: 3 },
});

/** ⛓ WIDE_ROOM — a wall across a 10x10 with one gap: the default room's shape. */
const WIDE_ROOM = Object.freeze({
    floor: [...rect(1, 1, 8, 4), [4, 5], ...rect(1, 6, 8, 8)],
    start: { x: 1, y: 1 },
    goal: { x: 6, y: 7 },
    width: 10,
    height: 10,
});

/** ⛓ SLOT_ROOM — the corridor on row 1 of a 3-high room: no cell off the approach, so `no-lure-site`. */
const SLOT_ROOM = Object.freeze({
    floor: rect(1, 1, 10, 1),
    start: { x: 1, y: 1 },
    goal: { x: 10, y: 1 },
    height: 3,
});

/** ⛓ EDGE_ROOM — a one-wide start COLUMN into a goal chamber: every chase line from a door runs straight up the
 *  column, so no lure beside it has a stance (`lureStances`), and the room refuses `no-lure-site`. */
const EDGE_ROOM = Object.freeze({
    floor: [...rect(1, 1, 1, 5), ...rect(1, 6, 8, 8)],
    start: { x: 1, y: 1 },
    goal: { x: 6, y: 7 },
    width: 10,
    height: 10,
});

const site = (room) => ({ room, x: 1, y: 1, w: room.width - 2, h: room.height - 2 });
const onPathOf = (room) => new Set(room.mainPath.map((c) => k(c.x, c.y)));
const same = (a, b) => a.x === b.x && a.y === b.y;

/** (cells away from the door, cells across the approach) of a lure, from the door's start-side neighbour */
const offsetOf = (cand, lure) => {
    const dx = cand.cell.x - cand.before.x;
    const dy = cand.cell.y - cand.before.y;
    const rx = lure.x - cand.before.x;
    const ry = lure.y - cand.before.y;
    return [-(rx * dx + ry * dy), Math.abs(rx * dy + ry * dx)];
};

describe('baitGate — a chaser on a cut and a water lure on its start side', () => {
    for (const [name, def] of [['CHAMBER_ROOM', CHAMBER_ROOM], ['WIDE_ROOM', WIDE_ROOM]]) {
        const room = probeFor(def);
        const out = buildBaitGate(room);

        it(`${name}: places; every body is on a cut and every lure is start-side, off the path, blocking nothing`, () => {
            expect(out.refused).toBeUndefined();
            expect(out.candidates.length).toBeGreaterThan(0);
            const onPath = onPathOf(room);
            for (const c of out.candidates) {
                const { lure } = c.site;
                const what = JSON.stringify({ door: c.cand.cell, lure });
                expect(room.isCut(c.cand.cell), what).toBe(true);
                expect(onPath.has(k(lure.x, lure.y)), what).toBe(false);
                expect(same(lure, room.start) || same(lure, room.goal), what).toBe(false);
                /** walling the lure (water, pre-swim) costs no route to the door's start side */
                expect(room.reachWith({ walled: [c.cand.cell, lure], floored: c.site.carved })
                    .has(k(c.cand.before.x, c.cand.before.y)), what).toBe(true);
                /** no swimmer bridge: every floor neighbour of the lure is start side */
                const startSide = room.reachWith({ walled: [c.cand.cell, ...c.wall] });
                for (const [dx, dy] of NB) {
                    const n = { x: lure.x + dx, y: lure.y + dy };
                    if (room.floorAt(n.x, n.y) && !c.wall.some((w) => same(w, n)) && !same(n, c.cand.cell)) {
                        expect(startSide.has(k(n.x, n.y)), what).toBe(true);
                    }
                }
            }
        });

        it(`${name}: ⛔ the lure is never level with the door's start-side neighbour (measured: the detour drowns it)`, () => {
            const allowed = new Set(LURE_OFFSETS.map(([a, p]) => `${a}:${p}`));
            for (const c of out.candidates) {
                const [a, p] = offsetOf(c.cand, c.site.lure);
                expect(a, JSON.stringify(c.site.lure)).toBeGreaterThanOrEqual(1);
                expect(allowed.has(`${a}:${p}`)).toBe(true);
            }
        });

        it(`${name}: every lure offers a STANCE — start side, in the leash, its line reaching the lure before a wall`, () => {
            for (const c of out.candidates) {
                expect(c.site.stances).toBeGreaterThan(0);
                const reach = room.reachWith({ walled: [c.cand.cell, ...c.wall, c.site.lure] });
                const st = lureStances(room, c.cand.cell, c.site.lure, new Set([...reach].filter((key) => {
                    const [x, y] = key.split(',').map(Number);
                    return room.floorAt(x, y);
                })));
                expect(st.length).toBe(c.site.stances);
                for (const s of st) {
                    expect(Math.hypot(s.x - c.cand.cell.x, s.y - c.cand.cell.y)).toBeLessThanOrEqual(BAIT_LEASH_CELLS);
                }
            }
        });

        it(`${name}: the element OWNS the start-side floor in the leash (pass 2 lays no second kill region there)`, () => {
            for (const c of out.candidates) {
                expect(c.site.clear.length).toBeGreaterThan(0);
                for (const cell of c.site.clear) {
                    expect(room.floorAt(cell.x, cell.y)).toBe(true);
                    expect(same(cell, room.start) || same(cell, room.goal)).toBe(false);
                    expect(Math.hypot(cell.x - c.cand.cell.x, cell.y - c.cand.cell.y)).toBeLessThanOrEqual(BAIT_LEASH_CELLS);
                }
            }
        });
    }

    it('refuses BY NAME: a slot room has no cell beside its approach — `no-lure-site`', () => {
        const out = buildBaitGate(probeFor(SLOT_ROOM));
        expect(out.refused.reason).toBe('no-lure-site');
        expect(BAIT_GATE_REFUSALS).toContain(out.refused.reason);
        expect(out.refused.detail).toMatch(/BAIT GATE/);
    });

    it('refuses BY NAME: a lure that no chase line reaches is no lure — EDGE_ROOM is `no-lure-site`', () => {
        const out = buildBaitGate(probeFor(EDGE_ROOM));
        expect(out.refused?.reason).toBe('no-lure-site');
    });

    it('construct: ONE draw, the body then its lure, the clearer the door\'s start-side neighbour', () => {
        const room = probeFor(WIDE_ROOM);
        const rng = rngFor(7);
        const concrete = BAIT_GATE.instantiate(rng, {});
        const placement = concrete.construct(site(room));
        expect(rng.draws).toBe(1);
        const [body, lure] = placement.entities.obstacles;
        expect(placement.entities.obstacles.map((o) => o.id)).toEqual([BAIT_GATE_BODY_ID, BAIT_GATE_LURE_ID]);
        expect(placement.doorCells).toEqual([{ x: body.x, y: body.y }]);
        expect(placement.entities.blocks).toEqual([]);
        expect(placement.tiles.some((t) => t.x === lure.x && t.y === lure.y && t.tile === TILE_FLOOR)).toBe(true);
        expect(placement.clearer).toHaveLength(1);
        expect(Math.abs(placement.clearer[0].x - body.x) + Math.abs(placement.clearer[0].y - body.y)).toBe(1);
    });

    it('assertPlacement refuses a gate that is not exactly a body then its lure', () => {
        const fails = [];
        const fail = (m) => fails.push(m);
        assertBaitGatePlacement({ entities: { obstacles: [{ id: BAIT_GATE_LURE_ID, x: 1, y: 1 }], blocks: [] },
            doorCells: [{ x: 1, y: 1 }], clearer: [{ x: 1, y: 2 }] }, { fail });
        expect(fails.join(' ')).toMatch(/exactly a BODY then its LURE/);
    });
});
