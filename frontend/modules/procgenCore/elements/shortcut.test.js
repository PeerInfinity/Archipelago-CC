/**
 * procgenCore/elements/shortcut — **THE SWORD-GATED SHORTCUT's OWN GEOMETRY**,
 * on hand-drawn rooms (PROCGEN ELEMENTS arc 5, slice 5, D2).
 *
 * ⛔⛔ **READ THE MODULE'S "NOT IN THE CATALOGUE" PARAGRAPH FIRST.** This
 * element is COMPLETE and is deliberately NOT registered as an `elementSpec`
 * head, because slice 5 measured three independent walls between it and a
 * certified Seedling level and all three are the SOLVER's or the ENGINE's. The
 * rows below are what keeps it from rotting until one of them moves, and they
 * are the same rows the head would need on the day it is enabled.
 *
 * ⛓ The room probe is `roomDoor.test.js`' shape, plus the `shortcutLaw` member
 * — and unlike the door law's test double, THIS ONE IS THE REAL LAW
 * (`gridFlood.shortcutLawRefusal`), because `gridFlood` is `procgenCore` and
 * this directory may import it (`bindingContract.test.js`'s boundary is about
 * SUBSTRATE modules). ⇒ the element is driven against the function the binding
 * hands it, not against a paraphrase.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { shortcutLawRefusal } from '../gridFlood.js';
import {
    SHORTCUT, SHORTCUT_BODY_ID, SHORTCUT_DOOR_ID, SHORTCUT_REFUSALS,
    assertShortcutPlacement, buildShortcut,
} from './shortcut.js';
import { LAW_SHORTCUT } from '../elements.js';
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
    name: 'mulberry32 (shortcut.test)',
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
        doorLaw: () => null,
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

/**
 * ⛓ THE LOOP ROOM — a 12x10 bordered box whose interior holds two arcs between
 * `S` (1,1) and `G` (10,1): the TOP row (the short one) and a bottom detour.
 * The nub at (4,2) is where an opener can stand.
 *
 *      ############
 *      #S........G#     row 1 — the SHORT arc
 *      #.#.#.####.#     row 2 — (1,2) and (9,2) are the legs; (3,2) is the nub
 *      #........#.#     row 3
 *      #.########.#     row 4
 *      #..........#     row 5 — the LONG arc
 *      ############
 */
const LOOP_ROOM = (() => {
    const floor = [];
    for (let x = 1; x <= 10; x += 1) floor.push([x, 1]);   // the short arc
    for (let x = 1; x <= 10; x += 1) floor.push([x, 5]);   // the long arc
    for (let y = 1; y <= 5; y += 1) { floor.push([1, y]); floor.push([10, y]); }
    floor.push([3, 2]);                                     // the nub
    return { floor, start: { x: 1, y: 1 }, goal: { x: 10, y: 1 } };
})();

/**
 * A plain 1-wide corridor from (1,1) to (8,1) — every cell of it is a CUT.
 * ⛓ THE ROOM IS 10x4 AND NOT 10x3 ON PURPOSE: at height 3 the only interior row
 * is the corridor itself, no cell can hold the opener, and the run dies at
 * `no-pocket` BEFORE the law is ever asked (the STAGES order, working). A
 * fourth row gives the pocket a carvable dead end, so the refusal this row is
 * about is the one the LAW raises.
 */
const CORRIDOR = {
    floor: Array.from({ length: 8 }, (_, i) => [i + 1, 1]),
    start: { x: 1, y: 1 },
    goal: { x: 8, y: 1 },
};

describe('the element declares what it is', () => {
    it('⛓⛓⛓ it is an `on-connector` element adjudicated by the SHORTCUT law', () => {
        expect(SHORTCUT.phase).toBe('on-connector');
        expect(SHORTCUT.law).toBe(LAW_SHORTCUT);
        expect(SHORTCUT.params).toEqual([]);
    });

    it('⛔ a room probe with no `shortcutLaw` refuses BY NAME, never throws', () => {
        const room = probeFor(LOOP_ROOM);
        const out = buildShortcut({ ...room, shortcutLaw: undefined });
        expect(out.refused.reason).toBe('no-path-cell');
        expect(out.refused.detail).toMatch(/offered no `shortcutLaw\(\)`/);
        expect(SHORTCUT_REFUSALS).toContain(out.refused.reason);
    });
});

describe('the SHORTCUT LAW is what selects the cell', () => {
    it('⛓⛓⛓ it places on a loop room, and every candidate strictly shortens', () => {
        const out = buildShortcut(probeFor(LOOP_ROOM));
        expect(out.refused).toBeUndefined();
        expect(out.candidates.length).toBeGreaterThan(0);
        for (const c of out.candidates) {
            expect(c.lengths.walled).toBeGreaterThan(c.lengths.open);
        }
    });

    /**
     * ⛔⛔ **THE NEGATIVE ROW THE GATE ASKS FOR — a CUT is not a shortcut.** On a
     * 1-wide corridor every main-path cell disconnects the goal, so the element
     * that stands exactly where the KILL GATE stands refuses every one of them
     * — and refuses with `the-shortcut-is-a-cut`, which is the name a census
     * needs in order to say "this room has no loop" rather than "no cell fit".
     */
    it('⛔ on a CORRIDOR every candidate is a cut — `the-shortcut-is-a-cut`', () => {
        const out = buildShortcut(probeFor({ ...CORRIDOR, width: 10, height: 4 }));
        expect(out.refused.reason).toBe('the-shortcut-is-a-cut');
        expect(out.refused.detail).toMatch(/A shortcut needs a CYCLE/);
        expect(SHORTCUT_REFUSALS).toContain(out.refused.reason);
    });

    /**
     * ⛓ AND THE OTHER REFUSAL IS A DIFFERENT ROOM: an OPEN box, where walling
     * one interior cell costs the walk nothing at all. ⛔ It must NOT come back
     * as `the-shortcut-is-a-cut` — the two say opposite things about the room
     * and a census that blurred them would be unreadable.
     */
    it('⛔ in an OPEN room the walk goes round for free — `the-shortcut-does-not-shorten`',
        () => {
            const floor = [];
            for (let y = 1; y <= 6; y += 1) for (let x = 1; x <= 8; x += 1) floor.push([x, y]);
            const out = buildShortcut(probeFor({
                floor, start: { x: 1, y: 1 }, goal: { x: 8, y: 6 }, width: 10, height: 8,
            }));
            expect(out.refused.reason).toBe('the-shortcut-does-not-shorten');
            expect(SHORTCUT_REFUSALS).toContain(out.refused.reason);
        });
});

describe('the placement', () => {
    const placementOn = (room, seed = 3) => SHORTCUT.instantiate(rngFor(seed), {})
        .construct({ room, x: 0, y: 0, w: room.width, h: room.height });

    it('⛓⛓⛓ the lock and the body are TWO obstacles, and the body is not in the lock', () => {
        const p = placementOn(probeFor(LOOP_ROOM));
        const [door, body] = p.entities.obstacles;
        expect(door.id).toBe(SHORTCUT_DOOR_ID);
        expect(body.id).toBe(SHORTCUT_BODY_ID);
        expect(k(door.x, door.y)).not.toBe(k(body.x, body.y));
        expect(p.doorCells).toEqual([{ x: door.x, y: door.y }]);
        expect(p.clearer).toEqual([{ x: body.x, y: body.y }]);
    });

    /**
     * ⛔⛔ **THE `demand` IS EMPTY AND `assertPlacement` REFUSES A NON-EMPTY
     * ONE.** A shortcut's door is not a cut, so nothing confines its body and
     * the region a demand would be computed over is the whole loop. The
     * assertion is what stops a later edit from "fixing" the gap with a claim
     * about a confinement that does not exist.
     */
    it('⛓ it declares NO demand, and a non-empty one is refused by the contract', () => {
        const p = placementOn(probeFor(LOOP_ROOM));
        expect(p.demand).toEqual([]);
        expect(p.area).toBeNull();
        expect(p.symbols).toEqual({ holds: [], grants: [] });
        const fail = (m) => { throw new Error(m); };
        expect(() => assertShortcutPlacement(p, { fail })).not.toThrow();
        expect(() => assertShortcutPlacement(
            { ...p, demand: [{ x: 1, y: 1, must: 'floor' }] }, { fail },
        )).toThrow(/declares NO `demand`/);
    });

    /**
     * ⛔ AND THE STRICTNESS OF THE SAVING IS ASSERTED BY THE CONTRACT, not just
     * by the law — a placement whose two numbers do not strictly increase is
     * one the law never accepted, and this is the row that would redden if a
     * mutant compared the lengths the other way round.
     */
    it('⛔ a placement whose walled length is NOT strictly greater is refused', () => {
        const p = placementOn(probeFor(LOOP_ROOM));
        const fail = (m) => { throw new Error(m); };
        for (const cost of [
            { ...p.cost, stepsWalled: p.cost.stepsOpen },
            { ...p.cost, stepsWalled: p.cost.stepsOpen - 1 },
            { ...p.cost, stepsOpen: null },
        ]) {
            expect(() => assertShortcutPlacement({ ...p, cost }, { fail }))
                .toThrow(/STRICTLY greater/);
        }
    });

    /**
     * ⛓⛓⛓ **THE COST CARRIES THE LAW'S OWN TWO NUMBERS**, and the contract
     * refuses a placement whose walled length is not STRICTLY greater — which
     * is the one thing that could never be true of a placement the law
     * accepted, and therefore the one thing a broken law would show up as.
     */
    it('⛓⛓ `cost.stepsWalled` is STRICTLY greater than `cost.stepsOpen`', () => {
        const p = placementOn(probeFor(LOOP_ROOM));
        expect(Number.isInteger(p.cost.stepsOpen)).toBe(true);
        expect(p.cost.stepsWalled).toBeGreaterThan(p.cost.stepsOpen);
        expect(p.cost.candidates).toBeGreaterThan(0);
    });

    /** ⛓ ONE DRAW, AND IT IS THE CHOICE AMONG CANDIDATES — the same discipline
     *  the kill gate declares. Two seeds may agree; what must not happen is a
     *  draw before the candidate list exists. */
    it('⛓ the stream advances by exactly ONE pick', () => {
        const rng = rngFor(7);
        const before = rng.draws;
        SHORTCUT.instantiate(rng, {}).construct({
            room: probeFor(LOOP_ROOM), x: 0, y: 0, w: 12, h: 10,
        });
        expect(rng.draws - before).toBe(1);
    });
});
