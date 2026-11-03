/**
 * procgenCore/elements/chestLoot — the LOOT CHEST's own geometry, on hand-drawn
 * rooms (seedling gen B1). One row per placement rule, each an invariant asked of
 * EVERY candidate the search offers, plus the refusals by name.
 *
 * MUTANTS (each applied to `chestLoot.js` by hand, the rows run, then reverted —
 * the slice's as-built carries the measured table):
 *  (a) the main-path filter dropped ⇒ the (i) row reds on TWO_ROW (a path cell
 *      becomes a candidate);
 *  (b) the stance-floor check dropped ⇒ the (ii) row reds on ALCOVE_BELOW;
 *  (c) the GOAL left walkable in (iii)'s flood ⇒ the BEHIND_GOAL pin reds (the
 *      stance reached only through the goal pickup — measured on generated
 *      branchy/rooms seed 1 as a certification REFUSAL).
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import {
    CHEST_LOOT, CHEST_LOOT_CHEST_ID, CHEST_LOOT_REFUSALS, assertChestLootPlacement, buildChestLoot,
} from './chestLoot.js';
import { LAW_NONE } from '../elements.js';

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
    name: 'mulberry32 (chestLoot.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const k = (x, y) => `${x},${y}`;

/** A room probe over a hand-drawn floor set (no paint: a loot chest writes no terrain). */
function probeFor({ floor, start, goal, width = 12, height = 10 }) {
    const set = new Set(floor.map(([x, y]) => k(x, y)));
    const reach = (walled, from = start) => {
        const seen = new Set([k(from.x, from.y)]);
        const q = [from];
        for (let i = 0; i < q.length; i += 1) {
            for (const [dx, dy] of NB) {
                const x = q[i].x + dx;
                const y = q[i].y + dy;
                if (!set.has(k(x, y)) || walled.has(k(x, y)) || seen.has(k(x, y))) continue;
                seen.add(k(x, y));
                q.push({ x, y });
            }
        }
        return seen;
    };
    const parent = new Map([[k(start.x, start.y), null]]);
    const q = [start];
    for (let i = 0; i < q.length; i += 1) {
        for (const [dx, dy] of NB) {
            const x = q[i].x + dx;
            const y = q[i].y + dy;
            if (!set.has(k(x, y)) || parent.has(k(x, y))) continue;
            parent.set(k(x, y), k(q[i].x, q[i].y));
            q.push({ x, y });
        }
    }
    const mainPath = [];
    for (let key = k(goal.x, goal.y); key !== null; key = parent.get(key)) {
        const [x, y] = key.split(',').map(Number);
        mainPath.unshift({ x, y });
    }
    const connectedWith = ({ walled = [] } = {}) => reach(new Set(walled.map((c) => k(c.x, c.y))))
        .has(k(goal.x, goal.y));
    return { width, height, start, goal, mainPath, floorAt: (x, y) => set.has(k(x, y)), reach, connectedWith,
        isCut: (cell) => !connectedWith({ walled: [cell] }), doorLaw: () => null };
}

const rect = (x0, y0, x1, y1) => {
    const out = [];
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) out.push([x, y]);
    return out;
};

/** The open 10x8 interior (an `empty` room). */
const OPEN_ROOM = Object.freeze({ floor: rect(1, 1, 10, 8), start: { x: 1, y: 1 }, goal: { x: 10, y: 4 } });
/** A one-wide corridor along row 4 with an alcove ABOVE it at (5,3): the alcove is a nook whose stance is the corridor. */
const ALCOVE_ABOVE = Object.freeze({ floor: [...rect(1, 4, 10, 4), [5, 3]], start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });
/** The same corridor with the alcove BELOW it at (5,5): its stance (5,6) is wall. */
const ALCOVE_BELOW = Object.freeze({ floor: [...rect(1, 4, 10, 4), [5, 5]], start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });
/** A bare one-wide corridor: every floor cell is on the main path. */
const CORRIDOR = Object.freeze({ floor: rect(1, 4, 10, 4), start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });
/** Two rows (4 and 5): the path runs along row 4, whose cells stand ON row 5 — the only stance-bearing cells
 *  are path cells. */
const TWO_ROW = Object.freeze({ floor: rect(1, 4, 10, 5), start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });
/** A spur (5,5)-(5,6) hanging below the corridor: a chest at (5,5) is the only way to its stance (5,6). */
const SPUR = Object.freeze({ floor: [...rect(1, 4, 10, 4), [5, 5], [5, 6]], start: { x: 1, y: 4 }, goal: { x: 10, y: 4 } });
/** The corridor runs PAST the goal (6,4) to (8,4), with an alcove (8,3) above its end: that alcove's stance is
 *  reached only THROUGH the goal. */
const BEHIND_GOAL = Object.freeze({ floor: [...rect(1, 4, 8, 4), [8, 3]], start: { x: 1, y: 4 }, goal: { x: 6, y: 4 } });

const ROOMS = { OPEN_ROOM, ALCOVE_ABOVE, ALCOVE_BELOW, CORRIDOR, TWO_ROW, SPUR, BEHIND_GOAL };
const candidatesOf = (spec) => buildChestLoot(probeFor(spec)).candidates ?? [];

describe('⛓⛓⛓ the LOOT CHEST\'s placement rules — each an invariant over every candidate', () => {
    it('(i) OFF THE PATH: never the start, the goal or a main-path cell; with it solid the goal is reached', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            const path = new Set(room.mainPath.map((c) => k(c.x, c.y)));
            for (const c of candidatesOf(spec)) {
                expect(path.has(k(c.chest.x, c.chest.y)), `${name} ${k(c.chest.x, c.chest.y)}`).toBe(false);
                expect(room.reach(new Set([k(c.chest.x, c.chest.y)])).has(k(spec.goal.x, spec.goal.y)), name).toBe(true);
            }
        }
        expect(buildChestLoot(probeFor(CORRIDOR)).refused?.reason).toBe('no-loot-cell');
        /** the two-row room's only stance-bearing cells are path cells: refused at the stance stage */
        expect(buildChestLoot(probeFor(TWO_ROW)).refused?.reason).toBe('the-stance-is-not-floor');
    });

    it('(ii) THE STANCE is the floor cell directly BELOW the chest, neither the start nor the goal', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            for (const c of candidatesOf(spec)) {
                expect(c.stance, name).toEqual({ x: c.chest.x, y: c.chest.y + 1 });
                expect(room.floorAt(c.stance.x, c.stance.y), name).toBe(true);
                expect(k(c.stance.x, c.stance.y)).not.toBe(k(spec.goal.x, spec.goal.y));
            }
        }
        expect(buildChestLoot(probeFor(ALCOVE_BELOW)).refused?.reason).toBe('the-stance-is-not-floor');
        expect(candidatesOf(ALCOVE_ABOVE).map((c) => c.chest)).toEqual([{ x: 5, y: 3 }]);
    });

    it('(iii) THE STANCE IS REACHED with the chest AND the goal solid', () => {
        for (const [name, spec] of Object.entries(ROOMS)) {
            const room = probeFor(spec);
            for (const c of candidatesOf(spec)) {
                const walled = new Set([k(c.chest.x, c.chest.y), k(spec.goal.x, spec.goal.y)]);
                expect(room.reach(walled).has(k(c.stance.x, c.stance.y)), `${name} ${k(c.chest.x, c.chest.y)}`).toBe(true);
            }
        }
        expect(buildChestLoot(probeFor(SPUR)).refused?.reason).toBe('the-chest-walls-off-its-stance');
    });

    it('⛔ THE BEHIND-THE-GOAL PIN: a stance reached only THROUGH the goal refuses by name', () => {
        const out = buildChestLoot(probeFor(BEHIND_GOAL));
        expect(out.refused?.reason).toBe('the-chest-walls-off-its-stance');
        expect(out.refused.detail).toMatch(/BELOW it/);
    });

    it('NOOKS FIRST: in an open room only cells with at most one floor neighbour besides the stance', () => {
        const room = probeFor(OPEN_ROOM);
        const cands = candidatesOf(OPEN_ROOM);
        expect(cands.length).toBeGreaterThan(0);
        for (const c of cands) {
            const others = NB.filter(([dx, dy]) => !(dx === 0 && dy === 1) && room.floorAt(c.chest.x + dx, c.chest.y + dy));
            expect(others.length).toBeLessThanOrEqual(1);
        }
        expect(buildChestLoot(probeFor(OPEN_ROOM)).nooks).toBe(true);
    });

    it('the refusal list is the stage order, and the deepest stage reached names a refusal', () => {
        expect(CHEST_LOOT_REFUSALS).toEqual(['no-loot-cell', 'the-stance-is-not-floor', 'the-chest-walls-off-its-stance']);
    });
});

describe('⛓ the LOOT CHEST element — construct, and the placement it commits', () => {
    const site = (spec) => {
        const room = probeFor(spec);
        return { room, x: 1, y: 1, w: room.width - 2, h: room.height - 2 };
    };

    it('law `none`, on-connector, ONE draw, one chest, its stance below it, NO terrain', () => {
        expect(CHEST_LOOT.law).toBe(LAW_NONE);
        expect(CHEST_LOOT.phase).toBe('on-connector');
        const rng = rngFor(1);
        const before = rng.draws;
        const p = CHEST_LOOT.instantiate(rng, {}).construct(site(OPEN_ROOM));
        expect(rng.draws - before).toBe(1);
        expect(p.entities.obstacles).toHaveLength(1);
        const [chest] = p.entities.obstacles;
        expect(chest.id).toBe(CHEST_LOOT_CHEST_ID);
        expect(p.doorCells).toEqual([{ x: chest.x, y: chest.y }]);
        expect(p.clearer).toEqual([{ x: chest.x, y: chest.y + 1 }]);
        expect(p.tiles).toEqual([]);
        const fails = [];
        assertChestLootPlacement(p, { fail: (m) => fails.push(m) });
        expect(fails).toEqual([]);
        assertChestLootPlacement({ ...p, clearer: [{ x: chest.x, y: chest.y - 1 }] }, { fail: (m) => fails.push(m) });
        expect(fails.join('\n')).toMatch(/not directly BELOW the chest/);
    });

    it('a refused room is a refusal, not a throw, and spends no draw', () => {
        const rng = rngFor(3);
        const before = rng.draws;
        const out = CHEST_LOOT.instantiate(rng, {}).construct(site(BEHIND_GOAL));
        expect(out.refused.reason).toBe('the-chest-walls-off-its-stance');
        expect(rng.draws).toBe(before);
    });
});
