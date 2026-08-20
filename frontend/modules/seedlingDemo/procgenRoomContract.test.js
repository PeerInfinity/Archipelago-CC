/**
 * seedlingDemo/procgenRoomContract.test — **THE ROOM CONTRACT**: the size
 * channel, the sparse SHELL format and the closure law, measured on rooms the
 * generator really builds.
 *
 * PROCGEN ELEMENTS arc 5, slice 1 (`NewDocs/plans/procgen-elements-arc5-
 * kickoff.md` §3.1; ⚖ rulings 1 and 2). ⛔ `procgenLevel.test.js` holds the
 * FORMAT half — what `shellOf` keeps, what `assertClosed` refuses, what a built
 * world does with an absent cell. This file holds the half that needs a MODEL:
 * that the strip changes nothing the solver can see, that the element's demand
 * survives it, and that pass 2 meets an absent cell with a refusal BY NAME.
 *
 * ── ⛓⛓⛓ THE DIFFERENTIAL IS THE WHOLE POINT OF THIS FILE ──────────────
 *
 * The shell is a claim about COLLISION: the wall cells it drops are cells
 * nothing in the room can reach, so the room plays identically. That is not a
 * claim a byte count can carry. ⛔ So the row solves the SAME room twice — once
 * dense, once stripped — through the loop's own oracle, and compares the ENTIRE
 * verdict object including the tape and the per-tick trace. A single tick of
 * difference is a wall somebody could touch.
 *
 * ⚠ AND THE JS RUNTIME IS ONLY HALF THE ANSWER. `check-seedling-wasm-ship.mjs`
 * ships a shell room to the REAL recompiled game and verdicts it PER TICK; this
 * file is what makes that row a confirmation rather than the only evidence.
 */

import { describe, expect, it } from 'vitest';

import { FILL_DENSE, FILL_SHELL, assertClosed, hasTile, terrainAt } from './procgenLevel.js';
import {
    seedlingModel, seedlingOracle, seedlingSeam, seedlingSkeletonSpec, shellLevel,
} from './procgenSeedling.js';
import { POST_SWORD_PALETTE } from './procgenPalette.js';

/** ⛓ A room whose interior carries real WALL BLOBS — the only kind the strip
 *  has anything to do on. `empty` is in the ladder deliberately: its answer is
 *  "nothing was dropped", and a table without it would overstate the format. */
const ROOMS = [
    { kind: 'empty', width: 10, height: 10 },
    { kind: 'winding', width: 10, height: 10 },
    { kind: 'winding', width: 20, height: 20 },
    { kind: 'rooms', width: 20, height: 12 },
];

const modelFor = ({ kind, width, height }, seed = 3) => seedlingModel({
    seed, skeleton: seedlingSkeletonSpec(kind), defaults: { width, height },
});

/** ⛔ Everything a solve returns EXCEPT the wall clock — `ms` is allowed to
 *  differ between two runs of one room and is the one field that may. */
const withoutTheClock = (v) => JSON.stringify(v, (k, x) => (k === 'ms' ? undefined : x));

describe('the SIZE reaches the model as a constant input, never as a draw', () => {
    it('builds the room it was asked for, on both axes', () => {
        const m = modelFor({ kind: 'empty', width: 20, height: 12 });
        expect([m.skeleton().width, m.skeleton().height]).toEqual([20, 12]);
    });

    /**
     * ⛓⛓⛓ **THE TWO STREAMS** (⚖ ruling 1's *"a NAMED `width=10` ≠ omitted"*).
     * The two spell different URLs and different command lines; they must build
     * the SAME ROOM, because a size is a constant input and spends no draw. ⛔
     * Asserted as the PAIR — an arm on its own proves nothing about the other.
     */
    it('⛓ a NAMED 10x10 and an OMITTED size build the identical room, cell for cell', () => {
        const omitted = seedlingModel({ seed: 7, skeleton: seedlingSkeletonSpec('winding') });
        const named = seedlingModel({
            seed: 7, skeleton: seedlingSkeletonSpec('winding'), defaults: { width: 10, height: 10 },
        });
        expect(JSON.stringify(named.skeleton())).toBe(JSON.stringify(omitted.skeleton()));
        expect(named.goalCell).toEqual(omitted.goalCell);
    });

    it('⛔ refuses a size outside the vanilla range before it touches the stream', () => {
        expect(() => modelFor({ kind: 'empty', width: 61, height: 10 }))
            .toThrow(/procgenSeedling: width=61 is outside \[3\.\.60\]/);
    });

    /** ⛓ The goal draw's own refusal is what a 3x3 room meets — there is no
     *  interior cell 3 away from the start — and it is the model's, by name. */
    it('a 3x3 room refuses on the GOAL rule, which is a different sentence', () => {
        expect(() => modelFor({ kind: 'empty', width: 3, height: 3 }))
            .toThrow(/no interior cell of this 3x3 room is 3 or more cells/);
    });
});

describe('THE SHELL, on rooms the generator really builds', () => {
    it('⛓ at `dense` the strip returns the SAME OBJECT, by identity', () => {
        const m = modelFor(ROOMS[1]);
        const r = m.skeleton();
        expect(shellLevel(r, m, FILL_DENSE)).toBe(r);
    });

    it.each(ROOMS)('$kind $width x $height — the strip keeps the room CLOSED', (spec) => {
        const m = modelFor(spec);
        const shell = shellLevel(m.skeleton(), m, FILL_SHELL);
        expect(assertClosed(shell)).toBe(true);
        expect(shell.layers[0].tiles.length)
            .toBeLessThanOrEqual(m.skeleton().layers[0].tiles.length);
    });

    /**
     * ⛓⛓⛓ **THE DIFFERENTIAL** — the same room, solved twice, compared whole.
     * ⛔ Not "both solved" and not "the same tick count": the TAPE and the
     * per-tick TRACE are in the comparison, so a wall the player brushed would
     * move a frame and this row would say so.
     */
    it.each(ROOMS)('$kind $width x $height — dense and shell SOLVE identically, tape and all',
        (spec) => {
            const m = modelFor(spec);
            const dense = m.skeleton();
            const shell = shellLevel(dense, m, FILL_SHELL);
            const oracle = seedlingOracle({ model: m, items: null });
            const a = oracle.solve(dense, { templates: [] });
            const b = oracle.solve(shell, { templates: [] });
            expect(a.verdict).toBe('SOLVED');
            expect(withoutTheClock(b)).toBe(withoutTheClock(a));
        });

    /**
     * ⛔⛔ THE MUTANT'S ARM, SHIPPED AS A ROW (⚖ the brief's mutant (b)). The
     * 4-adjacent strip drops MORE — the diagonal walls — and this records that
     * it is a real difference in the RECORD. Whether it is a difference in the
     * GAME is `mutant (b)`'s own measurement, and the answer is in the as-built:
     * an axis-aligned box that overlaps a diagonal neighbour also overlaps both
     * cells they share an edge with, and those are kept under either rule.
     */
    it('⛓ the 4-adjacent strip is STRICTLY smaller — the two rules differ in bytes', () => {
        const m = modelFor(ROOMS[2]);
        const eight = shellLevel(m.skeleton(), m, FILL_SHELL).layers[0].tiles.length;
        const four = shellLevel(m.skeleton(), m, FILL_SHELL, { adjacency: 4 })
            .layers[0].tiles.length;
        expect(four).toBeLessThan(eight);
    });
});

describe('⛔ THE ELEMENT\'S `wall` DEMAND SURVIVES THE STRIP — asserted, not reasoned', () => {
    /**
     * ⛓ THE SUBJECT WAS MEASURED, NOT CHOSEN, and the search itself is the
     * finding: over `killgate` on six kinds x six seeds, the OPEN room's gates
     * demand `floor` ONLY — the body's region is the whole interior and its
     * boundary is the room's own ring, which the element already owns — so a
     * `wall` demand exists only where the CARVE put a wall around the body.
     * `rooms` seed 3 demands 13 of them. ⛔ The first row below asserts the
     * subject is non-vacuous, because a demand-survival claim over an empty
     * demand set is a row that passes by proving nothing (trap 231's shape).
     */
    const m = seedlingSeam({
        seed: 3,
        skeleton: seedlingSkeletonSpec('rooms'),
        elements: { name: 'killgate' },
        items: POST_SWORD_PALETTE.items,
    }).model;

    it('the subject really demands `wall` cells (otherwise this row proves nothing)', () => {
        const walls = m.elementDemand().filter((c) => c.must === 'wall');
        expect(walls.length).toBeGreaterThan(0);
    });

    it('⛓ every demanded `wall` cell is still present after the strip', () => {
        const shell = shellLevel(m.skeleton(), m, FILL_SHELL);
        for (const cell of m.elementDemand()) {
            if (cell.must !== 'wall') continue;
            expect(hasTile(shell, cell.x, cell.y)).toBe(true);
        }
    });
});

describe('⛔ PASS 2 MEETS AN ABSENT CELL WITH A REFUSAL BY NAME', () => {
    /** A room with a wall blob big enough that its centre is dropped. */
    const spec = { kind: 'winding', width: 20, height: 20 };
    const m = modelFor(spec);
    const shell = shellLevel(m.skeleton(), m, FILL_SHELL);
    const absent = (() => {
        for (let ty = 1; ty < shell.height - 1; ty += 1) {
            for (let tx = 1; tx < shell.width - 1; tx += 1) {
                if (!hasTile(shell, tx, ty)) return { tx, ty };
            }
        }
        return null;
    })();

    it('the subject room really has an absent interior cell', () => {
        expect(absent).not.toBe(null);
        expect(terrainAt(shell, absent.tx, absent.ty)).toBe(null);
    });

    /** ⛓ A one-cell template that WRITES a wall — the `freeRefusal` arm. */
    const painter = {
        name: 'a-painter',
        footprint: [{ dx: 0, dy: 0 }],
        terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
    };
    /** ⛓ …and one that CARVES — the `carveCellRefusal` arm. */
    const carver = {
        name: 'a-carver',
        footprint: [{ dx: 0, dy: 0 }],
        terrain: [{ dx: 0, dy: 0, terrain: 'ground' }],
    };

    it('⛔ a PAINT on an absent cell says the room does not extend there', () => {
        const why = m.refusalAt(shell, painter, absent.tx, absent.ty);
        expect(why).toMatch(/holds NO TILE — it is beyond this room's wall shell/);
        expect(why).toMatch(/decorates the PLAY AREA/);
    });

    it('⛔ a CARVE on an absent cell says a carve cannot create room', () => {
        const why = m.refusalAt(shell, carver, absent.tx, absent.ty);
        expect(why).toMatch(/holds NO TILE/);
        expect(why).toMatch(/cannot create room where the record has none/);
    });

    /**
     * ⛓⛓⛓ **THE CLOSURE LAW, ASKED PROSPECTIVELY** — the one pass-2 write that
     * could break it. A kept shell wall with an absent neighbour is exactly the
     * cell a carve must not open.
     */
    it('⛔ a CARVE on a shell wall with an absent neighbour is refused by THE CLOSURE LAW', () => {
        const edge = (() => {
            for (let ty = 1; ty < shell.height - 1; ty += 1) {
                for (let tx = 1; tx < shell.width - 1; tx += 1) {
                    if (terrainAt(shell, tx, ty) !== 'wall') continue;
                    const open = [[0, -1], [-1, 0], [1, 0], [0, 1]]
                        .some(([dx, dy]) => !hasTile(shell, tx + dx, ty + dy));
                    if (open) return { tx, ty };
                }
            }
            return null;
        })();
        expect(edge).not.toBe(null);
        const why = m.refusalAt(shell, carver, edge.tx, edge.ty);
        expect(why).toMatch(/THE CLOSURE LAW/);
        expect(why).toMatch(/is ABSENT/);
    });

    /** ⛔ AND THE DENSE ROOM IS UNMOVED: none of these refusals can fire there,
     *  which is what makes the whole channel opt-in. */
    it('⛓ the dense room meets none of them — every cell of it holds a tile', () => {
        const dense = m.skeleton();
        for (let ty = 0; ty < dense.height; ty += 1) {
            for (let tx = 0; tx < dense.width; tx += 1) expect(hasTile(dense, tx, ty)).toBe(true);
        }
    });
});
