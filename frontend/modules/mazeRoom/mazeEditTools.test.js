/**
 * ⛓⛓⛓ **THE MAZE LAB'S FILL / CLEAR / MOVE** (maze editor tools, step B2) — the
 * maze's `clearOps` and the three shared rectangle builders over the maze
 * adapter, on a generated room whose cells were MEASURED:
 *
 *     seed 5, step 3, 7x7        E = entrance (0,0), exit at (6,4)
 *     E......                    i = key_red at (5,3), (3,6)
 *     .......                    o = door_red at (5,5), (4,6)
 *     ###....
 *     .....i.
 *     .......
 *     .....o.
 *     ...io..
 *
 * Each row names its MUTANT; every mutant was run and went red (the as-built has
 * the list). The browser side is `check-maze-lab`'s B2 claims.
 */
import { describe, expect, it } from 'vitest';

import { generateStep } from './mazeLab.js';
import { mazeClearOps, mazeEditAdapter, readMazeCell } from './mazeEditAdapter.js';
import { MAZE_EDIT_TOOLS, MAZE_FILL_REFUSAL } from './mazeEditTools.js';
import {
    applyOne, createEditSession, descriptorFieldsOf, rectClearOps, rectCopy, rectFillOps,
    rectMoveOps, rectPasteOps, rectReplaceOps,
} from '../procgenCore/editCore.js';
import { EDIT_TOOLS } from '../procgenCore/editorView.js';
import { worldsEqual } from './procgenMaze.js';

const ROOM = { seed: 5, step: 3, width: 7, height: 7 };
const world = () => generateStep(ROOM).record;
const cell = (w, x, y) => readMazeCell(w, x, y);

describe('⛓ the census — which shared tools the maze lab names', () => {
    /** MUTANT: drop CLEAR from MAZE_EDIT_TOOLS (or add nothing) — red. */
    it('FILL, CLEAR and MOVE, in that order — the shared ids, not retyped', () => {
        expect(MAZE_EDIT_TOOLS).toEqual([EDIT_TOOLS.FILL, EDIT_TOOLS.CLEAR, EDIT_TOOLS.MOVE]);
        expect(Object.isFrozen(MAZE_EDIT_TOOLS)).toBe(true);
    });
    it('FILL\'s refusal is the maze\'s own sentence, naming the two tiles', () => {
        expect(MAZE_FILL_REFUSAL).toMatch(/FLOOR or WALL/);
    });
    it('the CLEAR select\'s fields are the descriptor\'s own: tile, entity', () => {
        expect(descriptorFieldsOf(mazeEditAdapter, world())).toEqual(['tile', 'entity']);
    });
    /** MUTANT: drop `clearOps` from the adapter — CLEAR, MOVE and REPLACE refuse by name. */
    it('the adapter declares `clearOps` — the member CLEAR and MOVE need', () => {
        expect(mazeEditAdapter.clearOps).toBe(mazeClearOps);
    });
});

describe('⛓⛓ `mazeClearOps` — what emptying a maze cell is', () => {
    it('an ITEM cell → one clearEntity; a tile-only clear leaves it', () => {
        expect(mazeClearOps(world(), 5, 3)).toEqual([{ op: 'clearEntity', x: 5, y: 3 }]);
        expect(mazeClearOps(world(), 5, 3, { fields: ['tile'] })).toEqual([]);
    });
    it('a WALL → floor; an entity-only clear leaves it', () => {
        expect(mazeClearOps(world(), 0, 2)).toEqual([{ op: 'setTile', x: 0, y: 2, tile: 'floor' }]);
        expect(mazeClearOps(world(), 0, 2, { fields: ['entity'] })).toEqual([]);
    });
    /** MUTANT: emit clearEntity for any non-null entity — red (the entrance-only cell). */
    it('⛔ the ENTRANCE alone clears to NOTHING — `clearEntity` cannot remove it', () => {
        expect(cell(world(), 0, 0).entity).toEqual({ entrance: true });
        expect(mazeClearOps(world(), 0, 0)).toEqual([]);
    });
    it('a bare floor cell has nothing to clear', () => {
        expect(mazeClearOps(world(), 3, 3)).toEqual([]);
    });
    /** MUTANT: ignore `incoming` — red. */
    it('a tile the incoming descriptor writes is not cleared first (Seedling\'s rule)', () => {
        expect(mazeClearOps(world(), 0, 2, { fields: ['tile'], incoming: { tile: 'wall' } })).toEqual([]);
    });
});

describe('⛓⛓⛓ CLEAR over the maze', () => {
    it('everything in (0,2)-(5,3): the walls become floor and the key goes, as ONE undo', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const g = rectClearOps(mazeEditAdapter, s.record(), { x: 0, y: 2, w: 6, h: 2 });
        expect(g.op).toBe('group');
        expect(g.label).toBe('clear 6x2 at (0,2)');
        expect(s.apply(g).applied).toBe(true);
        for (const x of [0, 1, 2]) expect(cell(s.record(), x, 2)).toEqual({ tile: 'floor', entity: null });
        expect(cell(s.record(), 5, 3)).toEqual({ tile: 'floor', entity: null });
        expect(s.undo()).toBeTruthy();
        expect(worldsEqual(s.record(), world())).toBe(true);
        expect(s.redo()).toBeTruthy();
        expect(cell(s.record(), 5, 3).entity).toBe(null);
    });
    /** MUTANT: make `mazeClearOps` ignore `fields` — red (the walls go too). */
    it('entity only: the key goes, the walls stay', () => {
        const s = createEditSession(mazeEditAdapter, world());
        expect(s.apply(rectClearOps(mazeEditAdapter, s.record(), { x: 0, y: 2, w: 6, h: 2 },
            { fields: ['entity'] })).applied).toBe(true);
        expect(cell(s.record(), 0, 2).tile).toBe('wall');
        expect(cell(s.record(), 5, 3).entity).toBe(null);
    });
    it('⛔ a rect holding only the entrance and floor REFUSES by name', () => {
        expect(() => rectClearOps(mazeEditAdapter, world(), { x: 0, y: 0, w: 2, h: 2 }))
            .toThrow(/found nothing to clear/);
    });
});

describe('⛓⛓⛓ FILL over the maze', () => {
    it('WALL over (1,3)-(2,4): four walls, one group, one undo', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const g = rectFillOps(mazeEditAdapter, s.record(), { x: 1, y: 3, w: 2, h: 2 }, { tile: 'wall' });
        expect(g.ops).toHaveLength(4);
        expect(s.apply(g).applied).toBe(true);
        expect([[1, 3], [2, 3], [1, 4], [2, 4]].every(([x, y]) => cell(s.record(), x, y).tile === 'wall'))
            .toBe(true);
        s.undo();
        expect(worldsEqual(s.record(), world())).toBe(true);
    });
    it('⛔ WALL over the key at (5,3) is REFUSED whole — the maze\'s own `occupied`', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const res = s.apply(rectFillOps(mazeEditAdapter, s.record(), { x: 4, y: 3, w: 2, h: 1 }, { tile: 'wall' }));
        expect(res.ok).toBe(false);
        expect(res.description).toMatch(/occupied/);
        expect(s.ops()).toHaveLength(0);
        expect(cell(s.record(), 4, 3).tile).toBe('floor');
    });
});

describe('⛓⛓⛓ MOVE over the maze', () => {
    it('the three walls at (0,2) move to (2,4): the source is floor, ONE undo puts them back', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const clip = rectCopy(mazeEditAdapter, s.record(), { x: 0, y: 2, w: 3, h: 1 });
        const g = rectMoveOps(mazeEditAdapter, s.record(), clip, { x: 0, y: 2 }, 2, 4);
        expect(g.label).toBe('move 3x1 (0,2)→(2,4)');
        expect(s.apply(g).applied).toBe(true);
        expect([0, 1, 2].every((x) => cell(s.record(), x, 2).tile === 'floor')).toBe(true);
        expect([2, 3, 4].every((x) => cell(s.record(), x, 4).tile === 'wall')).toBe(true);
        s.undo();
        expect(worldsEqual(s.record(), world())).toBe(true);
        s.redo();
        expect(cell(s.record(), 4, 4).tile).toBe('wall');
    });
    it('the ENTRANCE moves with its selection (the paste\'s setEntrance), and the source stops being it', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const clip = rectCopy(mazeEditAdapter, s.record(), { x: 0, y: 0, w: 1, h: 1 });
        expect(s.apply(rectMoveOps(mazeEditAdapter, s.record(), clip, { x: 0, y: 0 }, 2, 0)).applied).toBe(true);
        expect(s.record().entrance).toEqual({ x: 2, y: 0 });
        expect(cell(s.record(), 0, 0)).toEqual({ tile: 'floor', entity: null });
    });
    it('⛔ a move that lands a WALL on the exit (6,4) is REFUSED whole — the maze\'s `protected-exit`', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const clip = rectCopy(mazeEditAdapter, s.record(), { x: 0, y: 2, w: 3, h: 1 });
        const res = s.apply(rectMoveOps(mazeEditAdapter, s.record(), clip, { x: 0, y: 2 }, 4, 4));
        expect(res.ok).toBe(false);
        expect(res.description).toMatch(/exit/);
        expect(worldsEqual(s.record(), world())).toBe(true);
    });
    it('⛔ a move with an ITEM onto the exit is refused the same way', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const clip = rectCopy(mazeEditAdapter, s.record(), { x: 5, y: 3, w: 1, h: 1 });
        const res = s.apply(rectMoveOps(mazeEditAdapter, s.record(), clip, { x: 5, y: 3 }, 6, 4));
        expect(res.ok).toBe(false);
        expect(res.description).toMatch(/exit/);
    });
});

describe('⛓⛓⛓ REPLACE paste is not offered — it lands the SAME world as ADD on the maze', () => {
    /**
     * ⛓ The reason the paste-mode select is OFF in the maze lab, measured: every
     * 2x2 clip of two generated rooms, pasted at every destination under each
     * filter, lands an equal world (or the same refusal) by ADD and by REPLACE.
     * MUTANT: make `mazeWriteOps` skip its leading `clearEntity` — the ADD paste
     * then stops emptying the entity field and this row goes red.
     */
    it.each([
        ['seed5', ROOM],
        ['seed7', { seed: 7, step: 5, width: 9, height: 9 }],
    ])('%s: ADD ≡ REPLACE for every 2x2 clip and destination', (_name, room) => {
        const w = generateStep(room).record;
        const outcome = (build) => {
            let g;
            try { g = build(); } catch (e) { return `throw:${/produced NO ops|neither writes/.test(e.message)}`; }
            const res = applyOne(mazeEditAdapter, w, g);
            return res.ok ? res.record : 'refused';
        };
        let compared = 0;
        let differing = 0;
        for (const only of [null, 'tile', 'entity']) {
            for (let sy = 0; sy + 1 < w.height; sy += 2) {
                for (let sx = 0; sx + 1 < w.width; sx += 2) {
                    const clip = rectCopy(mazeEditAdapter, w, { x: sx, y: sy, w: 2, h: 2 });
                    for (let y = 0; y + 1 < w.height; y += 1) {
                        for (let x = 0; x + 1 < w.width; x += 1) {
                            const a = outcome(() => rectPasteOps(mazeEditAdapter, w, clip, x, y, { only }));
                            const b = outcome(() => rectReplaceOps(mazeEditAdapter, w, clip, x, y, { only }));
                            compared += 1;
                            const same = (typeof a === 'string' || typeof b === 'string')
                                ? (typeof a === 'string' && typeof b === 'string')
                                : worldsEqual(a, b);
                            if (!same) differing += 1;
                        }
                    }
                }
            }
        }
        expect(compared).toBeGreaterThan(300);
        expect(differing).toBe(0);
    });
});
