/**
 * procgenCore/elements/strategyGate — the HOLD GATE's and the WEIGH GATE's own
 * geometry, on hand-drawn rooms (seedling gen strategy-switch r3). One row per
 * placement rule, each an invariant asked of EVERY candidate the search offers.
 *
 * MUTANTS (each applied to `strategyGate.js` by hand, the rows run, then
 * reverted — the slice's as-built carries the measured table):
 *  (a) `!onPath` dropped from the presser filters ⇒ the "off the main path" row
 *      reds (the chamber room's main path runs through the start chamber);
 *  (b) the weigh gate's enclosure walls dropped ⇒ the "the button's only mouth
 *      is the block" row reds;
 *  (c) `behindLock` dropped ⇒ the "behind the lock" row reds (FAR_ROOM: the
 *      start chamber holds cells nearer the goal than the corridor door).
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import {
    HOLD_GATE, HOLD_GATE_BUTTON_ID, HOLD_GATE_DOOR_ID, PRESSER_DOOR_MIN, PRESSER_NEAR_GATE,
    STRATEGY_GATE_REFUSALS, WEIGH_GATE, WEIGH_GATE_BUTTON_ID, WEIGH_GATE_DOOR_ID,
    assertStrategyGatePlacement, buildStrategyGate,
} from './strategyGate.js';
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
    name: 'mulberry32 (strategyGate.test)',
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

/** ⛓ CORRIDOR_ROOM — one row of floor, start to goal: no spare floor, so both
 *  gates take the CARVED pocket (walls below the corridor are interior). */
const CORRIDOR_ROOM = Object.freeze({
    floor: rect(1, 2, 10, 2),
    start: { x: 1, y: 2 },
    goal: { x: 10, y: 2 },
});

/** ⛓ SLOT_ROOM — the corridor on row 1 of a 3-high room: nothing to carve
 *  (every wall is the ring), so both refuse `no-presser-site`. */
const SLOT_ROOM = Object.freeze({
    floor: rect(1, 1, 10, 1),
    start: { x: 1, y: 1 },
    goal: { x: 10, y: 1 },
    height: 3,
});

/** ⛓ FAR_ROOM — the corridor door is far from the goal along the path but the
 *  start chamber reaches round below the goal, so some start-side cells are
 *  NEARER the goal (Euclidean) than the door. */
const FAR_ROOM = Object.freeze({
    floor: [...rect(1, 4, 9, 6), [1, 3], [1, 2], ...rect(1, 1, 4, 1), [5, 1], ...rect(6, 1, 9, 2)],
    start: { x: 9, y: 6 },
    goal: { x: 9, y: 1 },
});

const site = (room) => ({ room, x: 1, y: 1, w: room.width - 2, h: room.height - 2 });
const onPathOf = (room) => new Set(room.mainPath.map((c) => k(c.x, c.y)));
const md = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

describe('strategyGate — the HOLD GATE (a lock on a cut and its latching presser off the main path)', () => {
    const room = probeFor(CHAMBER_ROOM);
    const out = buildStrategyGate(room, 'hold');

    it('places: every candidate is a door on a cut with its presser start-side, off the main path, near the gate', () => {
        expect(out.refused).toBeUndefined();
        expect(out.candidates.length).toBeGreaterThan(0);
        const onPath = onPathOf(room);
        for (const c of out.candidates) {
            const what = JSON.stringify({ door: c.cand.cell, button: c.site.button });
            expect(room.isCut(c.cand.cell), what).toBe(true);
            expect(onPath.has(k(c.site.button.x, c.site.button.y)), what).toBe(false);
            expect(md(c.site.button, c.cand.cell), what).toBeGreaterThanOrEqual(PRESSER_DOOR_MIN);
            expect(c.site.distance, what).toBeLessThanOrEqual(PRESSER_NEAR_GATE);
            /** the presser is on the start side, and walling it costs no route to the door */
            expect(room.reachWith({ walled: [c.cand.cell] }).has(k(c.site.button.x, c.site.button.y)), what).toBe(true);
            expect(room.reachWith({ walled: [c.cand.cell, c.site.button] })
                .has(k(c.cand.before.x, c.cand.before.y)), what).toBe(true);
            expect(c.site.stance, what).toEqual(c.site.button);
            expect(c.site.block, what).toBeUndefined();
        }
    });

    it('a one-wide corridor takes the CARVED one-cell pocket, its only mouth a corridor cell', () => {
        const corridor = probeFor(CORRIDOR_ROOM);
        const res = buildStrategyGate(corridor, 'hold');
        expect(res.refused).toBeUndefined();
        for (const c of res.candidates) {
            expect(c.site.carved).toEqual([c.site.button]);
            expect(corridor.floorAt(c.site.button.x, c.site.button.y)).toBe(false);
            const mouths = NB.map(([dx, dy]) => ({ x: c.site.button.x + dx, y: c.site.button.y + dy }))
                .filter((n) => corridor.floorAt(n.x, n.y));
            expect(mouths).toHaveLength(1);
        }
    });

    it('construct: ONE draw, the lock then its presser, the clearer the presser cell', () => {
        const rng = rngFor(7);
        const concrete = HOLD_GATE.instantiate(rng, {});
        const placement = concrete.construct(site(room));
        expect(rng.draws).toBe(1);
        expect(placement.entities.obstacles.map((o) => o.id)).toEqual([HOLD_GATE_DOOR_ID, HOLD_GATE_BUTTON_ID]);
        expect(placement.entities.blocks).toEqual([]);
        expect(placement.clearer).toEqual([{ x: placement.entities.obstacles[1].x, y: placement.entities.obstacles[1].y }]);
        expect(placement.demand).toEqual([]);
        const fails = [];
        assertStrategyGatePlacement('hold')(placement, { fail: (m) => fails.push(m) });
        expect(fails).toEqual([]);
    });
});

describe('strategyGate — the WEIGH GATE (a lock, a momentary button off the main path, one block a shove short)', () => {
    const room = probeFor(CHAMBER_ROOM);
    const out = buildStrategyGate(room, 'weigh');
    /** the element's writes: its grown wall and enclosure (WALL), its carve (FLOOR) */
    const writesOf = (c) => ({ walled: [...c.wall, ...c.site.enclose], floored: c.site.carved });

    it('places: stance, block and button are three cells in a straight line, off the main path, start-side', () => {
        expect(out.refused).toBeUndefined();
        expect(out.candidates.length).toBeGreaterThan(0);
        const onPath = onPathOf(room);
        for (const c of out.candidates) {
            const { stance: s, block: b, button: p } = c.site;
            const what = JSON.stringify({ door: c.cand.cell, s, b, p });
            expect([b.x - s.x, b.y - s.y], what).toEqual([p.x - b.x, p.y - b.y]);
            expect(md(s, b), what).toBe(1);
            for (const cell of [b, p]) {
                expect(onPath.has(k(cell.x, cell.y)), what).toBe(false);
                expect(md(cell, c.cand.cell), what).toBeGreaterThanOrEqual(PRESSER_DOOR_MIN);
            }
            /** the block before the shove blocks nothing; the parked block blocks nothing */
            const onB = room.reachWith({ walled: [c.cand.cell, b, ...c.site.enclose], floored: c.site.carved });
            expect(onB.has(k(s.x, s.y)) && onB.has(k(c.cand.before.x, c.cand.before.y)), what).toBe(true);
            expect(room.reachWith({ walled: [c.cand.cell, p, ...c.site.enclose], floored: c.site.carved })
                .has(k(c.cand.before.x, c.cand.before.y)), what).toBe(true);
        }
    });

    it('⛓ the button\'s only mouth is the block — the player cannot hold it by hand', () => {
        for (const room2 of [room, probeFor(CORRIDOR_ROOM)]) {
            const res = buildStrategyGate(room2, 'weigh');
            expect(res.refused).toBeUndefined();
            for (const c of res.candidates) {
                const { block: b, button: p } = c.site;
                const { walled, floored } = writesOf(c);
                const w = new Set(walled.map((x) => k(x.x, x.y)));
                const f = new Set(floored.map((x) => k(x.x, x.y)));
                const floorAfter = (x, y) => !w.has(k(x, y)) && (room2.floorAt(x, y) || f.has(k(x, y)));
                const mouths = NB.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
                    .filter((n) => floorAfter(n.x, n.y));
                expect(mouths, JSON.stringify(c.site)).toEqual([b]);
                for (const wcell of c.site.enclose) {
                    expect(onPathOf(room2).has(k(wcell.x, wcell.y))).toBe(false);
                }
            }
        }
    });

    it('⛓ behind the lock: block and button are each ≥ 1 tile further from the goal than the door', () => {
        for (const spec of [CHAMBER_ROOM, FAR_ROOM]) {
            const room2 = probeFor(spec);
            const res = buildStrategyGate(room2, 'weigh');
            expect(res.refused, JSON.stringify(spec.start)).toBeUndefined();
            const dist = (c) => Math.hypot(c.x - room2.goal.x, c.y - room2.goal.y);
            for (const c of res.candidates) {
                expect(dist(c.site.block)).toBeGreaterThanOrEqual(dist(c.cand.cell) + 1);
                expect(dist(c.site.button)).toBeGreaterThanOrEqual(dist(c.cand.cell) + 1);
            }
        }
    });

    it('a one-wide corridor takes the CARVED straight pocket — block then button, its mouth the stance', () => {
        const corridor = probeFor(CORRIDOR_ROOM);
        const res = buildStrategyGate(corridor, 'weigh');
        for (const c of res.candidates) {
            expect(c.site.carved).toEqual([c.site.block, c.site.button]);
            expect(corridor.floorAt(c.site.stance.x, c.site.stance.y)).toBe(true);
            expect(c.site.enclose).toEqual([]);
        }
    });

    it('construct: ONE draw, the lock then its button, ONE block; the enclosure is written WALL, block/button FLOOR', () => {
        const rng = rngFor(3);
        const placement = WEIGH_GATE.instantiate(rng, {}).construct(site(room));
        expect(rng.draws).toBe(1);
        expect(placement.entities.obstacles.map((o) => o.id)).toEqual([WEIGH_GATE_DOOR_ID, WEIGH_GATE_BUTTON_ID]);
        expect(placement.entities.blocks).toHaveLength(1);
        const [, button] = placement.entities.obstacles;
        const [block] = placement.entities.blocks;
        const tileAt = (c) => placement.tiles.find((t) => t.x === c.x && t.y === c.y)?.tile;
        expect(tileAt(button)).toBe(TILE_FLOOR);
        expect(tileAt(block)).toBe(TILE_FLOOR);
        expect(placement.tiles.filter((t) => t.tile === TILE_WALL).length)
            .toBe(placement.cost.wall + placement.cost.enclosed);
        const fails = [];
        assertStrategyGatePlacement('weigh')(placement, { fail: (m) => fails.push(m) });
        expect(fails).toEqual([]);
    });
});

describe('strategyGate — refusals BY NAME', () => {
    it('the census key, in stage order', () => {
        expect(STRATEGY_GATE_REFUSALS).toEqual(['no-cut-cell', 'goal-too-close', 'wall-does-not-seal',
            'no-presser-site']);
    });

    it('a corridor with nothing to carve: `no-presser-site`, for both gates', () => {
        const slot = probeFor(SLOT_ROOM);
        for (const kind of ['hold', 'weigh']) {
            expect(buildStrategyGate(slot, kind).refused?.reason, kind).toBe('no-presser-site');
        }
    });

    it('a room whose every path cell is beside the goal: `goal-too-close`', () => {
        const tiny = probeFor({ floor: rect(1, 1, 3, 1), start: { x: 1, y: 1 }, goal: { x: 3, y: 1 }, height: 4 });
        expect(buildStrategyGate(tiny, 'hold').refused?.reason).toBe('goal-too-close');
    });

    it('an open room the probe cannot seal: `wall-does-not-seal`', () => {
        const open = probeFor({ floor: rect(1, 1, 8, 5), start: { x: 1, y: 1 }, goal: { x: 8, y: 5 } });
        expect(buildStrategyGate(open, 'weigh').refused?.reason).toBe('wall-does-not-seal');
    });

    it('a refused construct spends no draw and returns the refusal', () => {
        const rng = rngFor(1);
        const placement = HOLD_GATE.instantiate(rng, {}).construct(site(probeFor(SLOT_ROOM)));
        expect(placement.refused.reason).toBe('no-presser-site');
        expect(rng.draws).toBe(0);
    });

    it('assertPlacement names a presser beside the lock and a weigh gate without its block', () => {
        const fails = [];
        const base = {
            entities: { blocks: [], buttons: [], items: [], obstacles: [
                { x: 3, y: 3, id: WEIGH_GATE_DOOR_ID }, { x: 3, y: 4, id: WEIGH_GATE_BUTTON_ID }] },
            doorCells: [{ x: 3, y: 3 }],
            clearer: [{ x: 1, y: 4 }],
        };
        assertStrategyGatePlacement('weigh')(base, { fail: (m) => fails.push(m) });
        expect(fails.join('\n')).toMatch(/within one step of the lock/);
        expect(fails.join('\n')).toMatch(/exactly ONE block/);
    });
});
