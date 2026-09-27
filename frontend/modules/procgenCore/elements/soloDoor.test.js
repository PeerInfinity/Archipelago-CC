/**
 * procgenCore/elements/soloDoor — the ONE-OBSTACLE doors' own geometry, on
 * hand-drawn rooms (seedling substrate, slice S1). The probe is
 * `shortcut.test.js`' (the REAL shortcut law) plus a restated cut law.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { shortcutLawRefusal } from '../gridFlood.js';
import {
    APPROACH_WEST, ROCK_GATE, ROCK_GATE_DOOR_ID, ROCK_GATE_REFUSALS, ROCK_SHORTCUT,
    ROCK_SHORTCUT_DOOR_ID, ROCK_SHORTCUT_REFUSALS, SHIELD_GATE, SHIELD_GATE_DOOR_ID,
    SHIELD_GATE_REFUSALS, SOLO_DOOR_REFUSALS, buildSoloDoor, assertSoloPlacement,
} from './soloDoor.js';
import { LAW_CUT, LAW_SHORTCUT } from '../elements.js';
import { TILE_FLOOR } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';

/** The element's own placement assertion, asked directly. */
const assertPlacementOf = (el, placement, fail) => {
    const which = { [ROCK_GATE.name]: ['rockGate', ROCK_GATE_DOOR_ID] }[el.name];
    return assertSoloPlacement(which[0], which[1])(placement, { fail });
};

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
    name: 'mulberry32 (soloDoor.test)',
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
        /** ⛓ THE REAL LAW — see the file docblock. */
        shortcutLaw: ({ paint = [], doorCells = [], clearer = [], lengths = null } = {}) =>
            shortcutLawRefusal({
                width,
                height,
                walkableFor: (walled) => walkFor(paint, walled),
                start,
                goal,
                doorKeys: new Set(doorCells.map((c) => k(c.x, c.y))),
                clearerKeys: clearer.map((c) => k(c.x, c.y)),
                name: 'the element\'s shortcut',
                lengths,
            }),
    };
}


/** ⛓ THE LOOP ROOM — `shortcut.test.js`'s own: a short top arc and a long
 *  bottom arc between S (1,1) and G (10,1). */
const LOOP_ROOM = (() => {
    const floor = [];
    for (let x = 1; x <= 10; x += 1) floor.push([x, 1]);
    for (let x = 1; x <= 10; x += 1) floor.push([x, 5]);
    for (let y = 1; y <= 5; y += 1) { floor.push([1, y]); floor.push([10, y]); }
    floor.push([3, 2]);
    return { floor, start: { x: 1, y: 1 }, goal: { x: 10, y: 1 } };
})();

/** A 1-wide corridor run WEST to EAST: every interior cell is a cut, and each
 *  one is entered from its west neighbour. */
const CORRIDOR_WE = {
    floor: Array.from({ length: 8 }, (_, i) => [i + 1, 1]),
    start: { x: 1, y: 1 },
    goal: { x: 8, y: 1 },
    width: 10,
    height: 3,
};
/** The same corridor run EAST to WEST — every cell is entered from the EAST. */
const CORRIDOR_EW = { ...CORRIDOR_WE, start: { x: 8, y: 1 }, goal: { x: 1, y: 1 } };
/** A corridor run NORTH to SOUTH — every cell entered from the NORTH. */
const CORRIDOR_NS = {
    floor: Array.from({ length: 8 }, (_, i) => [1, i + 1]),
    start: { x: 1, y: 1 },
    goal: { x: 1, y: 8 },
    width: 3,
    height: 10,
};

const site = (room) => ({ room, x: 0, y: 0, w: room.width, h: room.height });

describe('the three elements declare what they are', () => {
    it('⛓ all three are `on-connector`; only the shortcut asks the SHORTCUT law', () => {
        for (const el of [ROCK_GATE, ROCK_SHORTCUT, SHIELD_GATE]) {
            expect(el.phase).toBe('on-connector');
            expect(el.params).toEqual([]);
        }
        expect(ROCK_GATE.law).toBe(LAW_CUT);
        expect(SHIELD_GATE.law).toBe(LAW_CUT);
        expect(ROCK_SHORTCUT.law).toBe(LAW_SHORTCUT);
    });

    it('⛓ every per-element refusal list is a subset of the file\'s census key', () => {
        for (const list of [ROCK_GATE_REFUSALS, ROCK_SHORTCUT_REFUSALS, SHIELD_GATE_REFUSALS]) {
            for (const name of list) expect(SOLO_DOOR_REFUSALS).toContain(name);
        }
    });
});

describe('the ROCK GATE — one obstacle on a CUT, the opener its start-side neighbour', () => {
    it('⛓⛓ it places on a corridor, and the clearer is the door\'s own `before`', () => {
        const room = probeFor(CORRIDOR_WE);
        const out = buildSoloDoor(room);
        expect(out.refused).toBeUndefined();
        // (1,1) is the start and (7,1)/(8,1) are within DOOR_GOAL_MIN of (8,1)
        expect(out.candidates.map((c) => c.cand.cell.x)).toEqual([2, 3, 4, 5, 6]);
        const p = ROCK_GATE.instantiate(rngFor(1), {}).construct(site(room));
        expect(p.entities.obstacles).toHaveLength(1);
        expect(p.entities.obstacles[0].id).toBe(ROCK_GATE_DOOR_ID);
        const [door] = p.doorCells;
        expect(p.clearer).toEqual([{ x: door.x - 1, y: door.y }]);
        expect(p.demand).toEqual([]);
    });

    it('⛔ on a LOOP it refuses `wall-does-not-seal` — a rock the walk goes round is no gate', () => {
        const out = buildSoloDoor(probeFor(LOOP_ROOM));
        expect(out.refused.reason).toBe('wall-does-not-seal');
        expect(ROCK_GATE_REFUSALS).toContain(out.refused.reason);
    });

    it('⛔ a room whose path is all within DOOR_GOAL_MIN refuses `goal-too-close`', () => {
        const out = buildSoloDoor(probeFor({ floor: [[1, 1], [2, 1], [3, 1]],
            start: { x: 1, y: 1 }, goal: { x: 3, y: 1 }, width: 5, height: 3 }));
        expect(out.refused.reason).toBe('goal-too-close');
    });

    it('⛔ the placement contract refuses a clearer that is not next to the door', () => {
        const fail = (m) => { throw new Error(m); };
        const p = ROCK_GATE.instantiate(rngFor(2), {}).construct(site(probeFor(CORRIDOR_WE)));
        const bad = { ...p, clearer: [{ x: p.doorCells[0].x - 3, y: 1 }] };
        expect(() => assertPlacementOf(ROCK_GATE, bad, fail)).toThrow(/not 4-adjacent/);
    });
});

describe('the ROCK SHORTCUT — the rock gate with the law swapped', () => {
    it('⛓⛓⛓ on the LOOP it places on the short arc, and walled is STRICTLY longer', () => {
        const room = probeFor(LOOP_ROOM);
        const out = buildSoloDoor(room, { law: LAW_SHORTCUT });
        expect(out.refused).toBeUndefined();
        for (const c of out.candidates) {
            expect(c.cand.cell.y).toBe(1);
            expect(c.lengths.walled).toBeGreaterThan(c.lengths.open);
        }
        const p = ROCK_SHORTCUT.instantiate(rngFor(3), {}).construct(site(room));
        expect(p.entities.obstacles[0].id).toBe(ROCK_SHORTCUT_DOOR_ID);
        expect(p.cost.stepsWalled).toBeGreaterThan(p.cost.stepsOpen);
    });

    it('⛔ on a CORRIDOR every candidate is a cut — `the-shortcut-is-a-cut`', () => {
        const out = buildSoloDoor(probeFor(CORRIDOR_WE), { law: LAW_SHORTCUT });
        expect(out.refused.reason).toBe('the-shortcut-is-a-cut');
        expect(ROCK_SHORTCUT_REFUSALS).toContain(out.refused.reason);
    });

    it('⛔ a probe with no `shortcutLaw` refuses BY NAME, never throws', () => {
        const out = buildSoloDoor({ ...probeFor(LOOP_ROOM), shortcutLaw: undefined },
            { law: LAW_SHORTCUT });
        expect(out.refused.reason).toBe('no-path-cell');
    });
});

describe('the SHIELD GATE — a cut entered from the WEST, and only there', () => {
    it('⛓⛓ it places on a west-to-east corridor, the clearer WEST of the door', () => {
        const room = probeFor(CORRIDOR_WE);
        const p = SHIELD_GATE.instantiate(rngFor(4), {}).construct(site(room));
        expect(p.entities.obstacles[0].id).toBe(SHIELD_GATE_DOOR_ID);
        const [door] = p.doorCells;
        expect(p.clearer).toEqual([{ x: door.x - 1, y: door.y }]);
    });

    /**
     * ⛔⛔ `ShieldLock.update` collides at `x - 1`: a lock entered from the east
     * or the north can never be touched. Measured on the real solver at S1's
     * W0 (the east approach REFUSED); here it is the geometry's refusal, BY
     * NAME, before any solve is spent.
     */
    for (const [label, room] of [['east-to-west', CORRIDOR_EW], ['north-to-south', CORRIDOR_NS]]) {
        it(`⛔ on a ${label} corridor it refuses \`the-door-has-no-west-approach\``, () => {
            const out = buildSoloDoor(probeFor(room), { approach: APPROACH_WEST });
            expect(out.refused.reason).toBe('the-door-has-no-west-approach');
            expect(SHIELD_GATE_REFUSALS).toContain(out.refused.reason);
            // the ROCK gate, which has no approach rule, places on the same room
            expect(buildSoloDoor(probeFor(room)).refused).toBeUndefined();
        });
    }
});
