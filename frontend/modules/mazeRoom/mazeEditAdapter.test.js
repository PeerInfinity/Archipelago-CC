/**
 * ⛓⛓⛓ **THE MAZE ADAPTER — the core's six words, spoken by a real substrate.**
 *
 * EDITOR v3 arc, slice A1 (`NewDocs/plans/seedling-editor-v3.md` §7.2, §8.1).
 * `editCore.test.js` proves the core is agnostic against a TOY; this file
 * proves the adapter is thin — that every claim the core makes still holds when
 * the record is a maze world the generator actually produced, with an oracle
 * that can be asked about the result.
 *
 * ⛔ THE WORLD IS GENERATED, NOT HAND-BUILT: `generateStep({seed: 5, step: 3,
 * width: 7, height: 7})` — the same call the lab page makes, so the world these
 * rows edit is the world `generate-maze-level.mjs --seed=5 --count=3` prints.
 * Seed 5 was chosen by measurement rather than taste: it is the smallest seed
 * of 1–6 whose step-3 room has BOTH walls (3) and entities (5), so a flood has
 * a real component to stop at and a copy has something to copy.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { describe, expect, it } from 'vitest';

import {
    MazeRoomEditor, PALETTE_TYPES, applyEdit, applyEdits, certify, generateStep, undoEdit,
} from './mazeLab.js';
import { EDIT_OPS, applyEditOp } from './mazeRoomEditor.js';
import { cloneWorld, serializeMazeLevel, worldsEqual } from './procgenMaze.js';
import { createMazeEditAdapter, mazeEditAdapter, mazeWriteOps, readMazeCell } from './mazeEditAdapter.js';
import {
    canonicalJson, createEditSession, describeOps, floodOps, foldEdits, rectCopy, rectPasteOps,
} from '../procgenCore/editCore.js';

const ROOM = { seed: 5, step: 3, width: 7, height: 7 };
const world = () => generateStep(ROOM).record;

/* ══════════════════════════════════════════════════════════════════════
 * THE VOCABULARY
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ ONE SAMPLE PER OP, on cells measured free on this room (no entity, not the
 * entrance at (0,0), not the goal exit at (6,4)). ⛔ Its KEYS are asserted
 * against `EDIT_OPS` below, so a ninth op cannot arrive in the editor and not
 * in this table — the roster is READ, never retyped (trap 574's family: a
 * gate's subject frozen as a literal decays invisibly).
 */
const SAMPLE_OPS = {
    setTile: { op: 'setTile', x: 3, y: 3, tile: 'wall' },
    setEntrance: { op: 'setEntrance', x: 3, y: 3 },
    setItem: { op: 'setItem', x: 3, y: 3, id: 'key_green' },
    setObstacle: { op: 'setObstacle', x: 3, y: 3, id: 'door_green' },
    setBlock: { op: 'setBlock', x: 3, y: 3 },
    setButton: { op: 'setButton', x: 3, y: 3, index: null },
    setFlag: { op: 'setFlag', x: 3, y: 3, index: null },
    clearEntity: { op: 'clearEntity', x: 5, y: 3 },
};

describe('⛓ the adapter speaks the editor\'s OWN vocabulary', () => {
    /** ⛓ MUTANT: add a ninth entry to `SAMPLE_OPS` (or drop one) — this row
     *  goes RED, which is what keeps the table honest as `EDIT_OPS` moves. */
    it('the sample table IS `EDIT_OPS`, read and not retyped', () => {
        expect(Object.keys(SAMPLE_OPS).sort()).toEqual([...EDIT_OPS].sort());
    });

    /**
     * ⛓⛓ MUTANT: have `adapter.apply` hand `applyEditOp` the record ITSELF
     * instead of a clone — the direct call and the session call then share a
     * world, `worldsEqual` still passes, but the `base is untouched` row below
     * goes RED. MUTANT 2: return the op the caller HANDED rather than
     * `res.op` — the `setButton`/`setFlag` rows go RED, because those two
     * resolve `index: null` to the allocated number.
     */
    it.each(EDIT_OPS)('a session apply of `%s` equals a direct applyEditOp', (name) => {
        const op = SAMPLE_OPS[name];
        const base = world();
        const direct = cloneWorld(base);
        const ref = applyEditOp(direct, op);
        expect(ref.ok).toBe(true);

        const s = createEditSession(mazeEditAdapter, base);
        const res = s.apply(op);
        expect(res.ok).toBe(true);
        expect(res.op).toEqual(ref.op);
        expect(worldsEqual(s.record(), direct)).toBe(true);
        // ⛔ and the BASE the session was opened on never moved
        expect(worldsEqual(base, world())).toBe(true);
    });

    /**
     * ⛓ The two allocating ops come back with the index they SPENT. ⛓ MUTANT:
     * as above — an adapter that recorded the handed op leaves `index: null` in
     * the payload and a replay allocates a different gadget.
     */
    it('`setButton` / `setFlag` come back RESOLVED, so a replay spends no draw', () => {
        const s = createEditSession(mazeEditAdapter, world());
        expect(s.apply(SAMPLE_OPS.setButton).op).toMatchObject({ index: 0 });
        expect(s.apply({ ...SAMPLE_OPS.setFlag, x: 4, y: 3 }).op).toMatchObject({ index: 0 });
    });

    /** ⛓ MUTANT: add a second op-name gate in the adapter — it would answer
     *  before `applyEditOp` and this row's sentence (the editor's own, naming
     *  the whole list) would change. */
    it('an op outside `EDIT_OPS` is refused BY NAME, by the editor and not by the adapter', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const res = s.apply({ op: 'setTeleporter', x: 1, y: 1 });
        expect(res.ok).toBe(false);
        expect(res.description).toContain('Unknown edit op');
        for (const name of EDIT_OPS) expect(res.description).toContain(name);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * readCell ↔ writeOps
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ readCell → writeOps → readCell is a FIXED POINT on a generated level', () => {
    /**
     * ⛓⛓ EVERY CELL of the seed-5 step-3 room — 49 of them, including the
     * ENTRANCE, the goal EXIT, three walls and four entity cells.
     *
     * ⚠ **A FIXED POINT TESTS SELF-CONSISTENCY, NEVER CORRECTNESS** (the
     * standing law): a `readCell` that reported `{}` for every cell and a
     * `writeOps` that emitted nothing would round-trip perfectly. The
     * NON-VACUITY row below is what stops that, and the vocabulary rows above
     * are what say the ops mean anything.
     *
     * ⛓ MUTANT: drop `entrance` from `readMazeCell`'s bag — still a fixed
     * point (nothing writes it either), which is exactly why the non-vacuity
     * row asserts the entrance cell is DISTINGUISHABLE. MUTANT 2: emit
     * `setTile` BEFORE `clearEntity` in `mazeWriteOps` — the wall cells stay
     * fine but any entity cell whose tile is being re-set dies on `occupied`,
     * and the row goes RED with the editor's own refusal.
     */
    it('holds on all 49 cells', () => {
        const w = world();
        for (let y = 0; y < 7; y += 1) {
            for (let x = 0; x < 7; x += 1) {
                const desc = readMazeCell(w, x, y);
                const out = foldEdits(mazeEditAdapter, w, mazeWriteOps(desc, x, y));
                expect(canonicalJson(readMazeCell(out.record, x, y)),
                    `cell (${x},${y}) was ${JSON.stringify(desc)}`).toBe(canonicalJson(desc));
            }
        }
    });

    /** ⛔ NON-VACUITY — the descriptors really do distinguish the room's cells,
     *  so the fixed point is a claim about content and not about emptiness. */
    it('is not vacuous — the room really does hold four kinds of cell', () => {
        const w = world();
        const seen = new Set();
        for (let y = 0; y < 7; y += 1) {
            for (let x = 0; x < 7; x += 1) seen.add(canonicalJson(readMazeCell(w, x, y)));
        }
        expect(readMazeCell(w, 0, 0)).toEqual({ tile: 'floor', entity: { entrance: true } });
        expect(readMazeCell(w, 0, 2)).toEqual({ tile: 'wall', entity: null });
        expect(readMazeCell(w, 5, 3)).toEqual({ tile: 'floor', entity: { item: 'key_red' } });
        expect(readMazeCell(w, 5, 5)).toEqual({ tile: 'floor', entity: { obstacle: 'door_red' } });
        expect(seen.size).toBeGreaterThanOrEqual(5);
        expect(mazeWriteOps(readMazeCell(w, 0, 0), 0, 0).map((o) => o.op))
            .toEqual(['clearEntity', 'setTile', 'setEntrance']);
    });

    /**
     * ⛔⛔ **BOUND 2, PINNED — THE ENTRANCE IS A SINGLETON.**
     *
     * `readCell` reports it (so a flood stops at the entrance cell instead of
     * trying to wall it), and `writeOps` re-creates it — but `setEntrance`
     * MOVES the world's only entrance, and there is no op that removes one. ⇒
     * writing the entrance descriptor at another cell moves the entrance there
     * and the cell it came from silently stops being one.
     *
     * ⛓ MUTANT: drop the `setEntrance` line from `mazeWriteOps` — this row goes
     * RED, and it is the ONLY row that catches it: the 49-cell fixed point
     * passes without it, because the entrance is already where it was read.
     * ⚠ That is the shape of trap 588's family — a claim that cannot tell the
     * two builds apart is not a claim, and a fixed point on an unchanged cell
     * is exactly such a claim.
     */
    it('BOUND: writing the ENTRANCE descriptor elsewhere MOVES it — there is no remove op', () => {
        const w = world();
        expect(readMazeCell(w, 0, 0).entity).toEqual({ entrance: true });
        const moved = foldEdits(mazeEditAdapter, w, mazeWriteOps(readMazeCell(w, 0, 0), 3, 3))
            .record;
        expect(readMazeCell(moved, 3, 3).entity).toEqual({ entrance: true });
        // ⛔ and the ORIGINAL cell is no longer the entrance — nothing asked it to move
        expect(readMazeCell(moved, 0, 0).entity).toBe(null);
        expect(moved.entrance).toEqual({ x: 3, y: 3 });
    });

    /**
     * ⛓ A FLAG IS AN ITEM TO THE ENGINE and a different OP to the editor.
     * ⛓ MUTANT: drop the `indexOfFlagId` arm of `readMazeCell` — the flag then
     * reads as `{item: 'flag_K0'}`, `writeOps` emits `setItem`, the cell comes
     * back the same and the FIXED POINT STILL PASSES — but the `itemLib` entry
     * the renderer and layer 1 read is never written on a fresh world, which
     * this row is what catches.
     */
    it('a FLAG round-trips as a flag, with its library entry', () => {
        const s = createEditSession(mazeEditAdapter, world());
        s.apply({ op: 'setFlag', x: 3, y: 3, index: null });
        const desc = readMazeCell(s.record(), 3, 3);
        expect(desc.entity).toEqual({ flag: 0 });
        expect(mazeWriteOps(desc, 4, 4).some((o) => o.op === 'setFlag')).toBe(true);
        // ⛓ and re-writing it onto a FRESH world brings the library entry with it
        const fresh = foldEdits(mazeEditAdapter, world(), mazeWriteOps(desc, 4, 4)).record;
        expect(Object.keys(fresh.itemLib)).toContain('flag_K0');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOOD, ON A REAL MAZE
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ floodOps on a real maze', () => {
    /**
     * ⛓⛓ THE WALL SEGMENT (0,2)-(2,2) IS ONE COMPONENT: painted to floor it is
     * 3 ops, the fold's world is a real world, and the ORACLE still answers.
     *
     * ⛓ MUTANT: an 8-neighbour flood — (3,1)/(3,3) are floor and diagonal to
     * the segment's end, so the component grows past 3 and the row goes RED.
     */
    it('paints ONE corridor component, and the oracle still returns a verdict', () => {
        const st = generateStep(ROOM);
        expect(certify(st).lastSolve.verdict).toBe('SOLVED');
        const g = floodOps(mazeEditAdapter, st.record, 0, 2, { tile: 'floor' });
        expect(g.ops).toHaveLength(3);
        expect(g.ops.every((o) => o.op === 'setTile' && o.y === 2)).toBe(true);

        const s = createEditSession(mazeEditAdapter, st.record);
        expect(s.apply(g)).toMatchObject({ ok: true, applied: true });
        expect(s.ops()).toHaveLength(1);
        expect(describeOps(s.ops())).toBe('1 edit(s) (1 group of 3)');

        // ⛔ THE POINT: the fold's world is a world the oracle can be asked about.
        const after = certify({ ...st, record: s.record() });
        expect(after.lastSolve.verdict).toBe('SOLVED');
        expect(() => serializeMazeLevel(s.record())).not.toThrow();
    });

    /**
     * ⛓⛓⛓ ALL-OR-NOTHING, ADJUDICATED BY THE ENGINE'S OWN RULE. The 41-cell
     * floor component painted to WALL dies on member #30 — *"Cannot place wall
     * on an exit tile"* — and the record does not move.
     *
     * ⛓ MUTANT: commit a group's successful members before the refusal — 29
     * cells of the room would be walled and the `worldsEqual` row goes RED.
     * ⚠ This is the atomicity claim on REAL data, where the refusal comes from
     * `MazeRoomEditor` rather than from a toy rule invented for the test.
     */
    it('a flood the ENGINE refuses mid-way leaves the world untouched', () => {
        const base = world();
        const g = floodOps(mazeEditAdapter, base, 6, 0, { tile: 'wall' });
        expect(g.ops).toHaveLength(41);
        const s = createEditSession(mazeEditAdapter, base);
        const res = s.apply(g);
        expect(res.ok).toBe(false);
        expect(res.description).toContain('member #30');
        expect(res.description).toContain('Cannot place wall on an exit tile');
        expect(s.ops()).toHaveLength(0);
        expect(worldsEqual(s.record(), base)).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * RECT COPY / PASTE — the gadget, and the id bound
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ rect copy/paste of a button+block gadget', () => {
    const withGadget = () => {
        const s = createEditSession(mazeEditAdapter, world());
        s.apply({ op: 'setButton', x: 1, y: 1, index: null });
        s.apply({ op: 'setBlock', x: 2, y: 1 });
        return s;
    };

    /**
     * ⛓ MUTANT: transpose the paste in `rectPasteOps` — the gadget lands
     * rotated and the two cell assertions go RED.
     */
    it('a 3x3 clip reproduces the gadget cell for cell, as ONE undo entry', () => {
        const s = withGadget();
        const clip = rectCopy(mazeEditAdapter, s.record(), { x: 1, y: 0, w: 3, h: 3 });
        expect(clip.cells[1][0]).toEqual({ tile: 'floor', entity: { button: 0 } });
        expect(clip.cells[1][1]).toEqual({ tile: 'floor', entity: { block: true } });

        const res = s.apply(rectPasteOps(mazeEditAdapter, s.record(), clip, 4, 3));
        expect(res).toMatchObject({ ok: true, applied: true });
        expect(readMazeCell(s.record(), 4, 4)).toEqual({ tile: 'floor', entity: { button: 0 } });
        expect(readMazeCell(s.record(), 5, 4)).toEqual({ tile: 'floor', entity: { block: true } });
        expect(readMazeCell(s.record(), 4, 5)).toEqual({ tile: 'wall', entity: null });

        expect(s.ops()).toHaveLength(3);
        expect(describeOps(s.ops())).toBe('3 edit(s) (1 group of 20)');
        // ⛓ ONE undo takes the whole paste back
        expect(s.undo()).toBe(true);
        expect(readMazeCell(s.record(), 4, 4).entity).toBe(null);
    });

    /**
     * ⛔⛔ **A MEASURED BOUND, PINNED — `applyEditOp` DOES NOT REFUSE A
     * DUPLICATE RESOLVED INDEX.**
     *
     * The brief asked what happens when a clip carrying `setButton index: 0` is
     * pasted onto a world that already holds `button_A0`. Measured: `_setButton`
     * only short-circuits when THAT CELL already has a button; otherwise it
     * takes the index it was given, writes the cell and re-writes the identical
     * `buttonLib` / `obstacleLib` entries. ⇒ **the world ends up with TWO cells
     * holding `button_A0`**, and this row pins that rather than asserting a
     * refusal nobody implements.
     *
     * ⚠ It is a BOUND and not a defect of the adapter: the resolved index is
     * carried on purpose (a replay must not allocate a different one — the
     * editor's own law), and whether a duplicate is legal is `applyEditOp`'s
     * call. ⛓ Consequence to carry into A2: a paste that duplicates a gadget
     * gives BOTH cells the same door, so pressing either opens it. The oracle
     * is what grades the level that results.
     *
     * ⛓ MUTANT: make the adapter refuse a duplicate index — this row goes RED
     * and the next session to write one would find out from a test rather than
     * from a level.
     */
    it('BOUND: a pasted button DUPLICATES its resolved index — the engine does not refuse', () => {
        const s = withGadget();
        const clip = rectCopy(mazeEditAdapter, s.record(), { x: 1, y: 1, w: 2, h: 1 });
        expect(s.apply(rectPasteOps(mazeEditAdapter, s.record(), clip, 4, 4)))
            .toMatchObject({ ok: true, applied: true });

        const cells = [];
        for (let y = 0; y < 7; y += 1) {
            for (let x = 0; x < 7; x += 1) {
                const e = readMazeCell(s.record(), x, y).entity;
                if (e && e.button !== undefined) cells.push([x, y, e.button]);
            }
        }
        expect(cells).toEqual([[1, 1, 0], [4, 4, 0]]);
        // ⛓ ONE library entry, TWO presses of it.
        expect(Object.keys(s.record().buttonLib)).toEqual(['button_A0']);
    });

    /** ⛓ MUTANT: drop the paste's bounds test — the group then dies on the
     *  editor's `out-of-bounds` refusal instead of clipping. */
    it('a paste at the EDGE is clipped to the room', () => {
        const s = withGadget();
        const clip = rectCopy(mazeEditAdapter, s.record(), { x: 1, y: 0, w: 3, h: 3 });
        const g = rectPasteOps(mazeEditAdapter, s.record(), clip, 5, 5);
        // ⛓ 2x2 of the 3x3 survives on a 7x7 grid → 4 cells
        expect(g.ops.filter((o) => o.op === 'setTile')).toHaveLength(4);
        expect(s.apply(g)).toMatchObject({ ok: true, applied: true });
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE TWO RECONSTRUCTIONS AGREE — the gate A2 replaces one behind
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛔ `mazeLab` and the edit core reconstruct the SAME world', () => {
    /** A recorded edit list, made the way the PAGE makes one: a palette
     *  selection and a click, through `mazeLab.applyEdit`. */
    const recorded = () => {
        const editor = new MazeRoomEditor({
            itemLib: { key_green: {} }, obstacleLib: { door_green: {} },
        });
        let st = generateStep(ROOM);
        const press = (type, x, y) => {
            editor.selectType(type);
            st = applyEdit(st, editor, x, y).state;
        };
        press(PALETTE_TYPES.WALL, 3, 3);
        press(PALETTE_TYPES.ITEM, 1, 3);
        press(PALETTE_TYPES.BUTTON, 2, 3);
        press(PALETTE_TYPES.BLOCK, 1, 4);
        press(PALETTE_TYPES.ERASE, 5, 3);
        return st;
    };

    /**
     * ⛓⛓⛓ **THE AGREEMENT** — `mazeLab.applyEdits` (the page's replay) and
     * `foldEdits` (the core's) produce the same world from the same list. This
     * is what makes A2's swap a REPLACEMENT rather than a rewrite.
     *
     * ⛓ MUTANT: have `foldEdits` fold onto a shared record (no clone per step)
     * or reverse the list — the `worldsEqual` row goes RED. MUTANT 2: drop the
     * adapter's `cloneWorld` — `applyEditOp` then writes through `state.record`
     * and the mazeLab side is corrupted before it is compared.
     */
    it('a recorded payload folds the same way through both', () => {
        const st = recorded();
        expect(st.edits).toHaveLength(5);
        const base = generateStep(ROOM).record;

        const viaLab = applyEdits(generateStep(ROOM), st.edits);
        const viaCore = foldEdits(mazeEditAdapter, base, st.edits.map((e) => e.op));

        expect(worldsEqual(viaLab.record, viaCore.record)).toBe(true);
        expect(worldsEqual(viaLab.record, st.record)).toBe(true);
        expect(viaCore.applied).toHaveLength(5);
        expect(viaCore.dropped).toHaveLength(0);
    });

    /**
     * ⛓⛓⛓ **THE TWO UNDO LAWS AGREE** — a self-consistency the maze has never
     * been asked for.
     *
     * `mazeLab.undoEdit` POPS a stack of worlds; the session RE-FOLDS a shorter
     * list. They are different mechanisms and they must produce the same
     * record, or A2's replacement would silently change what UNDO means.
     *
     * ⛓ MUTANT: make the session's `undo()` a stack pop of its own — this row
     * stays GREEN (that is the point: the two agree today), but the CORE's own
     * `undo = shorter fold` row is what makes the mechanism a fold. ⛓ MUTANT 2:
     * have `mazeLab.undoEdit` forget to pop `edits` alongside `undoStack` — the
     * op-count row goes RED.
     */
    it('a stack POP and a shorter FOLD land on the same world, at every depth', () => {
        const st = recorded();
        const base = generateStep(ROOM).record;
        const s = createEditSession(mazeEditAdapter, base);
        for (const e of st.edits) expect(s.apply(e.op)).toMatchObject({ ok: true, applied: true });
        expect(s.ops()).toHaveLength(5);

        let popped = st;
        for (let n = 4; n >= 0; n -= 1) {
            popped = undoEdit(popped);
            expect(s.undo()).toBe(true);
            expect(popped.edits).toHaveLength(n);
            expect(s.ops()).toHaveLength(n);
            expect(worldsEqual(popped.record, s.record()),
                `after undoing to ${n} edit(s)`).toBe(true);
        }
        expect(worldsEqual(s.record(), base)).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ADAPTER'S OWN SEAM
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ the adapter is a wrapper, and says so', () => {
    /** ⛓ MUTANT: drop `cloneWorld` from `apply` — `applyEditOp` writes through
     *  the caller's world and this row goes RED. */
    it('apply never mutates the record it is handed', () => {
        const base = world();
        const before = JSON.stringify(serializeMazeLevel(base));
        mazeEditAdapter.apply(base, { op: 'setTile', x: 3, y: 3, tile: 'wall' });
        mazeEditAdapter.apply(base, { op: 'setBlock', x: 3, y: 3 });
        expect(JSON.stringify(serializeMazeLevel(base))).toBe(before);
    });

    /** ⛓ MUTANT: hand `applyEditOp` a different default — the location name
     *  the page's convention produces would stop travelling with the op. */
    it('the page\'s `locationNameFormat` is a construction parameter, not a default here', () => {
        const named = createMazeEditAdapter({ locationNameFormat: (x, y) => `Vault ${x}/${y}` });
        const out = named.apply(world(), { op: 'setItem', x: 3, y: 3, id: 'key_green' });
        expect(out.ok).toBe(true);
        expect(out.record.itemLocationNames.get('3,3')).toBe('Vault 3/3');
        const plain = mazeEditAdapter.apply(world(), { op: 'setItem', x: 3, y: 3, id: 'key_green' });
        expect(plain.record.itemLocationNames.get('3,3')).toBe('Edited Location 3,3');
    });

    /** ⛓ MUTANT: give the adapter its own equality — `mazeLab.applyEdit`'s
     *  no-op test and the core's would then be two spellings that can drift. */
    it('`equal` IS `procgenMaze.worldsEqual` — one comparison, not two', () => {
        expect(mazeEditAdapter.equal).toBe(worldsEqual);
        /**
         * ⚠ MEASURED ON A **NON-SQUARE** ROOM. A 7x7 hides a transposition
         * completely — the mutant `bounds: {w: height, h: width}` was GREEN
         * against every row of this file until this line named a room whose
         * two sides differ (⚖ a claim can only bite on a subject that
         * DISTINGUISHES the two builds).
         */
        expect(mazeEditAdapter.bounds(generateStep({ ...ROOM, width: 7, height: 9 }).record))
            .toEqual({ w: 7, h: 9 });
        expect(mazeEditAdapter.name).toBe('maze');
    });

    /** ⛓ A no-op press is not an edit, on real data: `setTile floor` onto a
     *  floor cell. ⛓ MUTANT: drop the core's `equal` guard — ops() grows. */
    it('a press that changes nothing is not an edit', () => {
        const s = createEditSession(mazeEditAdapter, world());
        const res = s.apply({ op: 'setTile', x: 3, y: 3, tile: 'floor' });
        expect(res).toMatchObject({ ok: true, applied: false });
        expect(s.ops()).toHaveLength(0);
    });
});
