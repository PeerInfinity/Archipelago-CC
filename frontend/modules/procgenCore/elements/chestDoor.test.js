/**
 * procgenCore/elements/chestDoor — the CHEST DOOR's own geometry, on
 * hand-drawn rooms (seedling gen B2). One row per placement rule, each an
 * invariant asked of EVERY candidate the search offers, on a room built so the
 * rule is the only thing between the search and a wrong candidate.
 *
 * MUTANTS (each applied to `chestDoor.js` by hand, the rows run, then reverted —
 * the slice's as-built carries the measured table):
 *  (i)   the door law not asked ⇒ the `(i)` row reds on TWO_GAP_ROOM (the
 *        chest stands in a corridor the walk can go round);
 *  (ii)  the start-side test on a floor stance dropped ⇒ the north-approach
 *        pin reds (NORTH_ROOM places, its stance on the far side);
 *  (iii) the far-floor clause of a carvable cell dropped ⇒ the `(iii)` row
 *        reds on SPUR_ROOM (the pocket under the chest joins the far side's
 *        spur: a second gap);
 *  (jog) the wall's lower half grown in the chest's own column ⇒ the jog row
 *        reds on OPEN_ROOM (every east–west crossing puts the stance IN the
 *        wall and refuses).
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import {
    CHEST_DOOR, CHEST_DOOR_CHEST_ID, CHEST_DOOR_REFUSALS, CHEST_POCKET_MAX,
    assertChestDoorPlacement, buildChestDoor, chestWall,
} from './chestDoor.js';
import { doorCandidates } from './roomDoor.js';
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
    name: 'mulberry32 (chestDoor.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const k = (x, y) => `${x},${y}`;

/** A room probe over a hand-drawn floor set, with the cut law restated — and,
 *  unlike the rope gate's, `paint` honoured (the chest door grows a wall). */
function probeFor({ floor, start, goal, width = 12, height = 10 }) {
    const set = new Set(floor.map(([x, y]) => k(x, y)));
    const walkFor = (paint, walled) => (x, y) => {
        if (walled.has(k(x, y))) return false;
        const p = paint.get(k(x, y));
        return p === undefined ? set.has(k(x, y)) : p === TILE_FLOOR;
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
        const out = [];
        for (let key = k(goal.x, goal.y); key !== null; key = parent.get(key)) {
            const [x, y] = key.split(',').map(Number);
            out.unshift({ x, y });
        }
        return out;
    };
    const paintOf = (paint = []) => new Map(paint.map((t) => [k(t.x, t.y), t.tile]));
    const keysOf = (cells = []) => new Set(cells.map((c) => k(c.x, c.y)));
    const connectedWith = ({ paint = [], walled = [] } = {}) => reach(
        walkFor(paintOf(paint), keysOf(walled)), start).has(k(goal.x, goal.y));
    return {
        width,
        height,
        start,
        goal,
        mainPath: pathTo(),
        floorAt: (x, y) => set.has(k(x, y)),
        connectedWith,
        isCut: (cell) => !connectedWith({ walled: [cell] }),
        reachWith: (paint, walled) => reach(walkFor(paintOf(paint), keysOf(walled)), start),
        doorLaw: ({ paint = [], doorCells = [], clearer = [] } = {}) => {
            if (!connectedWith({ paint })) return 'the room is SEALED open';
            const shut = reach(walkFor(paintOf(paint), keysOf(doorCells)), start);
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

/** The walled-and-carved room a candidate builds, as the probe's `paint`. */
const paintOf = (c) => [
    ...c.wall.map((w) => ({ x: w.x, y: w.y, tile: TILE_WALL })),
    ...c.pocket.map((p) => ({ x: p.x, y: p.y, tile: TILE_FLOOR })),
];

/** ⛓ A one-wide corridor down column 3, booted NORTH, the goal SOUTH — the
 *  design probe's `door-north` crossing. */
const NORTH_ROOM = Object.freeze({ floor: rect(3, 1, 3, 8), start: { x: 3, y: 1 }, goal: { x: 3, y: 8 } });
/** The same corridor booted SOUTH (`door-south`). */
const SOUTH_ROOM = Object.freeze({ floor: rect(3, 1, 3, 8), start: { x: 3, y: 8 }, goal: { x: 3, y: 1 } });
/** A one-wide corridor along row 4, west to east: every stance is wall. */
const EAST_ROOM = Object.freeze({ floor: rect(1, 4, 10, 4), start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });
/** EAST_ROOM with a far-side hook (7,5) (7,6) (6,6) (5,6) that ends right under
 *  column 5's stance (and out of its jog column): the pocket under a chest at
 *  column 5 would touch it. */
const SPUR_ROOM = Object.freeze({ floor: [...rect(1, 4, 10, 4), [7, 5], [7, 6], [6, 6], [5, 6]],
    start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });
/** Two parallel corridors (rows 2 and 6) joined at both ends: no single cell of
 *  either is a cut. */
const TWO_GAP_ROOM = Object.freeze({
    floor: [...rect(1, 2, 10, 2), ...rect(1, 6, 10, 6), ...rect(1, 3, 1, 5), ...rect(10, 3, 10, 5)],
    start: { x: 1, y: 2 }, goal: { x: 10, y: 6 },
});
/** The open 10x8 interior (an `empty` room), the goal half-way down the east
 *  side, so the main path crosses the room east–west along row 4. */
const OPEN_ROOM = Object.freeze({ floor: rect(1, 1, 10, 8), start: { x: 1, y: 1 }, goal: { x: 10, y: 4 } });

const ROOMS = { NORTH_ROOM, SOUTH_ROOM, EAST_ROOM, SPUR_ROOM, TWO_GAP_ROOM, OPEN_ROOM };
const candidatesOf = (spec) => buildChestDoor(probeFor(spec)).candidates ?? [];

describe('⛓⛓⛓ the CHEST DOOR\'s placement rules — each an invariant over every candidate', () => {
    it('(i) THE CHEST IS A CUT: with the chest and its wall walled, the goal is unreachable', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            for (const c of candidatesOf(spec)) {
                const reach = room.reachWith(paintOf(c), [c.chest]);
                expect(reach.has(k(spec.goal.x, spec.goal.y)), `${name} chest ${k(c.chest.x, c.chest.y)}`)
                    .toBe(false);
                /** …and OPEN, the room still joins (the chest is the gap, not a seal) */
                expect(room.connectedWith({ paint: paintOf(c) }), name).toBe(true);
            }
        }
        expect(buildChestDoor(probeFor(TWO_GAP_ROOM)).refused?.reason).toBe('the-chest-is-not-a-cut');
    });

    it('(ii) THE STANCE is the cell directly BELOW the chest, on the START side', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            for (const c of candidatesOf(spec)) {
                expect(c.stance, name).toEqual({ x: c.chest.x, y: c.chest.y + 1 });
                expect(room.reachWith(paintOf(c), [c.chest]).has(k(c.stance.x, c.stance.y)),
                    `${name} stance ${k(c.stance.x, c.stance.y)}`).toBe(true);
            }
        }
    });

    it('⛔ THE SOUTH-APPROACH PIN: a crossing that enters the chest from the NORTH refuses BY NAME', () => {
        const north = buildChestDoor(probeFor(NORTH_ROOM));
        expect(north.refused?.reason).toBe('the-stance-is-beyond-the-chest');
        expect(north.refused.detail).toMatch(/BELOW it/);
        /** the control: the same corridor booted south places, every stance natural */
        const south = candidatesOf(SOUTH_ROOM);
        expect(south.length).toBeGreaterThan(0);
        expect(south.every((c) => c.pocket.length === 0)).toBe(true);
    });

    it('(iii) THE POCKET: at most CHEST_POCKET_MAX carved wall cells, the stance first, none touching '
        + 'the far side', () => {
        for (const [name, spec] of [['EAST_ROOM', EAST_ROOM], ['SPUR_ROOM', SPUR_ROOM]]) {
            const room = probeFor(spec);
            const cands = candidatesOf(spec);
            expect(cands.length, name).toBeGreaterThan(0);
            for (const c of cands) {
                expect(c.pocket.length).toBeGreaterThan(0);
                expect(c.pocket.length).toBeLessThanOrEqual(CHEST_POCKET_MAX);
                expect(c.pocket[0]).toEqual(c.stance);
                expect(c.pocket.every((p) => !room.floorAt(p.x, p.y))).toBe(true);
                /** the far side, with the chest walled: no pocket cell may touch it */
                const startSide = room.reachWith(paintOf(c), [c.chest]);
                const walled = new Set(c.wall.map((w) => k(w.x, w.y)));
                const floorAfter = (x, y) => room.floorAt(x, y) && !walled.has(k(x, y));
                for (const p of c.pocket) {
                    for (const [dx, dy] of NB) {
                        const x = p.x + dx;
                        const y = p.y + dy;
                        if (x === c.chest.x && y === c.chest.y) continue;
                        if (floorAfter(x, y)) expect(startSide.has(k(x, y)), `${name} ${k(x, y)}`).toBe(true);
                    }
                }
            }
        }
        /** the hook: column 5's stance touches (5,6), so column 5 is never offered */
        expect(candidatesOf(SPUR_ROOM).some((c) => c.chest.x === 5)).toBe(false);
    });

    it('THE JOG: an east–west crossing grows its wall up its own column and DOWN the far-side column', () => {
        const room = probeFor(OPEN_ROOM);
        const cands = candidatesOf(OPEN_ROOM);
        const eastWest = doorCandidates(room).filter((d) => d.wallAxis === 'y');
        expect(eastWest.length).toBeGreaterThan(0);
        const jogged = cands.filter((c) => c.wall.some((w) => w.y > c.chest.y && w.x !== c.chest.x));
        expect(jogged.length).toBeGreaterThan(0);
        for (const c of jogged) {
            const d = eastWest.find((e) => e.cell.x === c.chest.x && e.cell.y === c.chest.y);
            const far = c.chest.x + Math.sign(d.after.x - c.chest.x);
            expect(c.wall.filter((w) => w.y < c.chest.y).every((w) => w.x === c.chest.x)).toBe(true);
            expect(c.wall.filter((w) => w.y > c.chest.y).every((w) => w.x === far)).toBe(true);
            expect(chestWall(room, d)).toEqual(c.wall);
        }
    });

    it('every refusal it raises is declared, and the census order runs stage by stage', () => {
        expect(CHEST_DOOR_REFUSALS).toEqual(['no-chest-cell', 'goal-too-close', 'the-chest-is-not-a-cut',
            'the-stance-is-beyond-the-chest', 'no-stance-pocket']);
        const tiny = buildChestDoor(probeFor({ floor: rect(1, 1, 3, 1), start: { x: 1, y: 1 }, goal: { x: 3, y: 1 } }));
        expect(tiny.refused?.reason).toBe('goal-too-close');
    });
});

describe('⛓ the CHEST DOOR element — construct, and the placement it commits', () => {
    const site = (spec) => {
        const room = probeFor(spec);
        return { room, x: 1, y: 1, w: room.width - 2, h: room.height - 2 };
    };

    it('ONE draw, one chest, the stance below it, the pocket carved and the wall owned', () => {
        const rng = rngFor(1);
        const before = rng.draws;
        const p = CHEST_DOOR.instantiate(rng, {}).construct(site(EAST_ROOM));
        expect(rng.draws - before).toBe(1);
        expect(p.entities.obstacles).toHaveLength(1);
        const [chest] = p.entities.obstacles;
        expect(chest.id).toBe(CHEST_DOOR_CHEST_ID);
        expect(p.doorCells).toEqual([{ x: chest.x, y: chest.y }]);
        expect(p.clearer).toEqual([{ x: chest.x, y: chest.y + 1 }]);
        expect(p.doorSolidForCarve).toBe(true);
        const floors = p.tiles.filter((t) => t.tile === TILE_FLOOR);
        expect(floors.length).toBe(p.cost.carved);
        expect(floors[0]).toMatchObject({ x: chest.x, y: chest.y + 1 });
        /** the chest's wall neighbours are OWNED (written as wall), so pass 2 cannot open a gap */
        const walls = new Set(p.tiles.filter((t) => t.tile === TILE_WALL).map((t) => k(t.x, t.y)));
        expect(walls.has(k(chest.x, chest.y - 1))).toBe(true);
    });

    it('`assertChestDoorPlacement` refuses a stance that is not directly below the chest', () => {
        const p = CHEST_DOOR.instantiate(rngFor(2), {}).construct(site(SOUTH_ROOM));
        const fails = [];
        const fail = (m) => fails.push(m);
        assertChestDoorPlacement(p, { fail });
        expect(fails).toEqual([]);
        const [c] = p.doorCells;
        assertChestDoorPlacement({ ...p, clearer: [{ x: c.x, y: c.y - 1 }] }, { fail });
        expect(fails.join('\n')).toMatch(/not directly BELOW the chest/);
    });

    it('a refused room is a refusal, not a throw, and spends no draw', () => {
        const rng = rngFor(3);
        const before = rng.draws;
        const out = CHEST_DOOR.instantiate(rng, {}).construct(site(NORTH_ROOM));
        expect(out.refused.reason).toBe('the-stance-is-beyond-the-chest');
        expect(rng.draws).toBe(before);
    });
});
