/**
 * procgenCore/elements/keyGate — the KEY GATE's own geometry, on hand-drawn rooms (strategy elements round 2;
 * ⚖ the user 2026-11-01 "(b) More strategy elements", 2026-11-03 "a randomized AP item whose vanilla placement is
 * the key"). The LOCK is the chest door's cell (its rules are `chestDoor.test.js`'s); these rows are the KEY's:
 * one row per placement rule, each an invariant over EVERY candidate, plus the refusals by name.
 *
 * MUTANTS (each applied to `keyGate.js` by hand, the rows run, then reverted — the slice's as-built carries the
 * measured table):
 *  (a) the start-side test dropped from `keyCellsFor` (any floor cell) ⇒ 3 red: "(ii) START SIDE" (a key behind
 *      its lock), the refusals row (SHORT_ROOM places) and the construct row (no corridor to a far-side key);
 *  (b) the tiers collapsed to one (on-path keys offered beside off-path ones) ⇒ 1 red, "(iii) OFF THE PATH";
 *  (c) the key's corridor not owned (only the key cell written) ⇒ 1 red, the construct row.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { LAW_CUT } from '../elements.js';
import {
    KEY_GATE, KEY_GATE_KEY_ID, KEY_GATE_LOCK_ID, KEY_GATE_REFUSALS, KEY_GATE_TYPES, assertKeyGatePlacement,
    buildKeyGate, keyPathFor,
} from './keyGate.js';
import { CHEST_DOOR_REFUSALS } from './chestDoor.js';
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
    name: 'mulberry32 (keyGate.test)',
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

/** A one-wide corridor down column 3 booted SOUTH, the goal NORTH: every start-side cell is on the main path. */
const SOUTH_ROOM = Object.freeze({ floor: rect(3, 1, 3, 8), start: { x: 3, y: 8 }, goal: { x: 3, y: 1 } });
/** SOUTH_ROOM with one nook (4,7) beside the corridor near the start: the one OFF-PATH start-side cell. */
const SOUTH_NOOK = Object.freeze({ floor: [...rect(3, 1, 3, 8), [4, 7]], start: { x: 3, y: 8 }, goal: { x: 3, y: 1 } });
/** The same corridor booted NORTH: every stance is beyond its lock. */
const NORTH_ROOM = Object.freeze({ floor: rect(3, 1, 3, 8), start: { x: 3, y: 1 }, goal: { x: 3, y: 8 } });
/** A five-cell corridor booted south: the one legal lock (3,3) has the start and its stance as its whole start side. */
const SHORT_ROOM = Object.freeze({ floor: rect(3, 1, 3, 5), start: { x: 3, y: 5 }, goal: { x: 3, y: 1 } });
/** The open 10x8 interior (an `empty` room). */
const OPEN_ROOM = Object.freeze({ floor: rect(1, 1, 10, 8), start: { x: 1, y: 1 }, goal: { x: 10, y: 4 } });
/** A one-wide corridor along row 4, west to east (the lock takes a carved pocket). */
const EAST_ROOM = Object.freeze({ floor: rect(1, 4, 10, 4), start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });

const ROOMS = { SOUTH_ROOM, SOUTH_NOOK, OPEN_ROOM, EAST_ROOM };
const candidatesOf = (spec) => buildKeyGate(probeFor(spec)).candidates ?? [];

describe('⛓⛓⛓ the KEY GATE\'s placement rules — each an invariant over every candidate', () => {
    it('(i) THE LOCK is the chest door\'s: a CUT with its wall, the stance directly BELOW it', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            const cands = candidatesOf(spec);
            expect(cands.length, name).toBeGreaterThan(0);
            for (const c of cands) {
                expect(room.connectedWith({ paint: paintOf(c), walled: [c.chest] }), name).toBe(false);
                expect(c.stance, name).toEqual({ x: c.chest.x, y: c.chest.y + 1 });
            }
        }
    });

    it('(ii) THE KEY IS ON THE START SIDE — reached with the lock walled — and is never the start, goal, stance or pocket', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            for (const c of candidatesOf(spec)) {
                const what = `${name} lock ${k(c.chest.x, c.chest.y)} key ${k(c.key.x, c.key.y)}`;
                expect(room.reachWith(paintOf(c), [c.chest]).has(k(c.key.x, c.key.y)), what).toBe(true);
                const banned = [spec.start, spec.goal, c.stance, ...c.pocket].map((p) => k(p.x, p.y));
                expect(banned, what).not.toContain(k(c.key.x, c.key.y));
            }
        }
    });

    it('(iii) OFF THE PATH when it can be: one off-path key anywhere ⇒ every candidate\'s key is off the path', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            const path = new Set(room.mainPath.map((c) => k(c.x, c.y)));
            const cands = candidatesOf(spec);
            const off = cands.filter((c) => !path.has(k(c.key.x, c.key.y)));
            if (off.length > 0) expect(off.length, name).toBe(cands.length);
            for (const c of cands) expect(c.key.onPath, name).toBe(path.has(k(c.key.x, c.key.y)));
        }
        /** the nook is the corridor's only off-path cell: every candidate keys it */
        expect(new Set(candidatesOf(SOUTH_NOOK).map((c) => k(c.key.x, c.key.y)))).toEqual(new Set(['4,7']));
        /** the bare corridor has none: the on-path fallback */
        expect(candidatesOf(SOUTH_ROOM).every((c) => c.key.onPath)).toBe(true);
        expect(candidatesOf(OPEN_ROOM).every((c) => !c.key.onPath)).toBe(true);
    });

    it('the refusals BY NAME: the lock\'s stages spoken of a lock, then `no-key-cell`', () => {
        expect(KEY_GATE_REFUSALS).toEqual(['no-lock-cell', 'goal-too-close', 'the-lock-is-not-a-cut',
            'the-stance-is-beyond-the-lock', 'no-stance-pocket', 'no-key-cell']);
        /** every chest-door stage has its lock name */
        expect(CHEST_DOOR_REFUSALS.length).toBe(KEY_GATE_REFUSALS.length - 1);
        expect(buildKeyGate(probeFor(NORTH_ROOM)).refused?.reason).toBe('the-stance-is-beyond-the-lock');
        const short = buildKeyGate(probeFor(SHORT_ROOM)).refused;
        expect(short?.reason).toBe('no-key-cell');
        expect(short.detail).toMatch(/key behind its own lock/);
    });
});

describe('⛓ the KEY GATE element — construct, and the placement it commits', () => {
    const site = (spec) => {
        const room = probeFor(spec);
        return { room, x: 1, y: 1, w: room.width - 2, h: room.height - 2 };
    };

    it('cut law, on-connector, ONE draw: the LOCK then the KEY; clearer = [stance, key]; the key\'s corridor OWNED', () => {
        expect(KEY_GATE.law).toBe(LAW_CUT);
        expect(KEY_GATE.phase).toBe('on-connector');
        expect(KEY_GATE.family).toBe('keygate');
        for (const [name, spec] of Object.entries(ROOMS)) {
            const rng = rngFor(7);
            const before = rng.draws;
            const p = KEY_GATE.instantiate(rng, { type: 0 }).construct(site(spec));
            expect(rng.draws - before, name).toBe(1);
            const [lock, key] = p.entities.obstacles;
            expect(p.entities.obstacles.map((o) => o.id), name).toEqual([KEY_GATE_LOCK_ID, KEY_GATE_KEY_ID]);
            expect(p.entities.obstacles.map((o) => o.keyType), name).toEqual([0, 0]);
            expect(p.doorCells, name).toEqual([{ x: lock.x, y: lock.y }]);
            expect(p.clearer, name).toEqual([{ x: lock.x, y: lock.y + 1 }, { x: key.x, y: key.y }]);
            /** the corridor: every cell from the start (exclusive) to the key is OWNED as floor, and it is a path */
            const room = probeFor(spec);
            const pick = buildKeyGate(room).candidates.find((c) => c.chest.x === lock.x && c.chest.y === lock.y
                && c.key.x === key.x && c.key.y === key.y);
            const corridor = keyPathFor(room, pick);
            expect(corridor.at(0), name).toEqual(spec.start);
            expect(corridor.at(-1), name).toEqual({ x: key.x, y: key.y });
            const floors = new Set(p.tiles.filter((t) => t.tile === TILE_FLOOR).map((t) => k(t.x, t.y)));
            for (const c of corridor.slice(1)) expect(floors.has(k(c.x, c.y)), `${name} ${k(c.x, c.y)}`).toBe(true);
            const fails = [];
            assertKeyGatePlacement(p, { fail: (m) => fails.push(m) });
            expect(fails, name).toEqual([]);
        }
    });

    it('assertPlacement refuses a stance not below the lock, a missing key and a wrong second clearer', () => {
        const p = KEY_GATE.instantiate(rngFor(1), { type: 0 }).construct(site(OPEN_ROOM));
        const [lock] = p.entities.obstacles;
        const fails = [];
        const ask = (q) => assertKeyGatePlacement(q, { fail: (m) => fails.push(m) });
        ask({ ...p, clearer: [{ x: lock.x, y: lock.y - 1 }, p.clearer[1]] });
        expect(fails.join('\n')).toMatch(/not directly BELOW the lock/);
        ask({ ...p, entities: { ...p.entities, obstacles: [lock] } });
        expect(fails.join('\n')).toMatch(/exactly a LOCK then its KEY/);
        ask({ ...p, clearer: [p.clearer[0], { x: 0, y: 0 }] });
        expect(fails.join('\n')).toMatch(/the key's own cell/);
    });

    it('⛓ THE KEY TYPE (⚖ "B: Distinct colour per room"): `type` 0..4 rides the lock AND the key; default 0', () => {
        expect(KEY_GATE_TYPES).toEqual([0, 1, 2, 3, 4]);
        expect(KEY_GATE.params.map((pp) => [pp.key, pp.domain, pp.default])).toEqual([['type', [0, 1, 2, 3, 4], 0]]);
        for (const type of KEY_GATE_TYPES) {
            const p = KEY_GATE.instantiate(rngFor(2), { type }).construct(site(OPEN_ROOM));
            expect(p.entities.obstacles.map((o) => o.keyType)).toEqual([type, type]);
        }
        const p = KEY_GATE.instantiate(rngFor(2), { type: 2 }).construct(site(OPEN_ROOM));
        const fails = [];
        assertKeyGatePlacement({ ...p, entities: { ...p.entities, obstacles: [p.entities.obstacles[0],
            { ...p.entities.obstacles[1], keyType: 3 }] } }, { fail: (m) => fails.push(m) });
        expect(fails.join('\n')).toMatch(/ONE key type/);
        expect(() => KEY_GATE.instantiate(rngFor(2), { type: 5 })).toThrow();
    });

    it('a refused room is a refusal, not a throw, and spends no draw', () => {
        const rng = rngFor(3);
        const before = rng.draws;
        const out = KEY_GATE.instantiate(rng, { type: 0 }).construct(site(NORTH_ROOM));
        expect(out.refused?.reason).toBe('the-stance-is-beyond-the-lock');
        expect(rng.draws - before).toBe(0);
    });
});
