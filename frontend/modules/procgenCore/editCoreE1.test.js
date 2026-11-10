/**
 * ⛓⛓⛓ **SEEDLING EDITOR E1 — THE SHARED HALF, AGAINST A TOY SUBSTRATE.**
 *
 * The additive hunks E1 put into `editCore.js` and `editorView.js` (REDO, and the rectangle FILL / CLEAR /
 * REPLACE / MOVE builders, the replace-paste dispatch and `clipOrigin`), proven on a substrate that is neither
 * the maze nor Seedling — `editCore.test.js`'s discipline. Every row names its MUTANT: the change to the
 * shared file that turns it red (each was run by hand; the as-built names the results).
 */
import { describe, expect, it } from 'vitest';

import {
    EditCoreError, canonicalJson, createEditSession, group, rectClearOps, rectCopy, rectFillOps,
    rectMoveOps, rectPasteOps, rectReplaceOps,
} from './editCore.js';
import { createLifetime } from './pageLifetime.js';
import { REDO_COMMAND_ID, UNDO_COMMAND_ID, mountEditorView } from './editorView.js';

/* ── the toy: a w×h grid of {tile: 'a'|'b'|null, items: string[]} ─────── */

const world = (w, h) => Object.freeze({
    w, h, cells: Object.freeze(Array.from({ length: w * h }, () => Object.freeze({ tile: 'a', items: [] }))),
});
const cellOf = (r, x, y) => r.cells[x + y * r.w];
const put = (r, x, y, c) => Object.freeze({
    ...r, cells: Object.freeze(r.cells.map((o, i) => (i === x + y * r.w ? Object.freeze(c) : o))),
});
const toy = Object.freeze({
    name: 'toyE1',
    apply(r, op) {
        const { x, y } = op ?? {};
        if (!(x >= 0 && y >= 0 && x < r.w && y < r.h)) return { ok: false, description: `toyE1: (${x},${y}) off grid` };
        const c = cellOf(r, x, y);
        if (op.op === 'tile') return { ok: true, op, description: `tile ${x},${y}=${op.tile}`, record: put(r, x, y, { ...c, tile: op.tile }) };
        if (op.op === 'erase') {
            if (c.tile === null) return { ok: false, description: `toyE1: (${x},${y}) has no tile to erase` };
            return { ok: true, op, description: `erase ${x},${y}`, record: put(r, x, y, { ...c, tile: null }) };
        }
        if (op.op === 'add') return { ok: true, op, description: `add ${op.item}`, record: put(r, x, y, { ...c, items: [...c.items, op.item] }) };
        if (op.op === 'pop') {
            if (c.items.length === 0) return { ok: false, description: `toyE1: (${x},${y}) holds no item` };
            return { ok: true, op, description: `pop ${x},${y}`, record: put(r, x, y, { ...c, items: c.items.slice(0, -1) }) };
        }
        return { ok: false, description: `toyE1: unknown op ${op.op}` };
    },
    equal: (a, b) => canonicalJson(a) === canonicalJson(b),
    bounds: (r) => ({ w: r.w, h: r.h }),
    readCell: (r, x, y) => ({ tile: cellOf(r, x, y).tile, items: [...cellOf(r, x, y).items] }),
    writeOps: (d, x, y) => [
        ...(Object.hasOwn(d, 'tile') && d.tile ? [{ op: 'tile', x, y, tile: d.tile }] : []),
        ...(Object.hasOwn(d, 'items') ? d.items.map((item) => ({ op: 'add', x, y, item })) : []),
    ],
    clearOps: (r, x, y, { fields = null, incoming = null } = {}) => {
        const c = cellOf(r, x, y);
        const want = (f) => fields === null || fields.includes(f);
        return [
            ...(want('tile') && c.tile !== null && !incoming?.tile ? [{ op: 'erase', x, y }] : []),
            ...(want('items') ? c.items.map(() => ({ op: 'pop', x, y })) : []),
        ];
    },
});
const { clearOps: _drop, ...noClear } = toy;
const noClearToy = Object.freeze({ ...noClear, name: 'toyNoClear' });
const j = (v) => JSON.stringify(v);

/* ══ REDO ══════════════════════════════════════════════════════════════ */

describe('⛓ REDO — editCore session', () => {
    /** MUTANT: `redo` re-applies onto the BASE instead of the record the undo left — the second op is lost. */
    it('undo then redo is byte-identical to never undoing, and the op list is the same', () => {
        const s = createEditSession(toy, world(3, 3));
        s.apply({ op: 'tile', x: 0, y: 0, tile: 'b' });
        s.apply({ op: 'add', x: 1, y: 1, item: 'k' });
        const before = j(s.record());
        const ops = j(s.ops());
        expect(s.undo()).toBe(true);
        expect(s.undo()).toBe(true);
        expect(s.redoCount()).toBe(2);
        expect(s.redo()).toBe(true);
        expect(s.redo()).toBe(true);
        expect(j(s.record())).toBe(before);
        expect(j(s.ops())).toBe(ops);
        expect(s.redoCount()).toBe(0);
        expect(s.redo()).toBe(false);
    });

    /** MUTANT: drop `undone = []` from `apply` — the redo would replay onto a forked history. */
    it('a NEW applied edit after an undo clears the redo list; a refused op and a no-op do not', () => {
        const s = createEditSession(toy, world(3, 3));
        s.apply({ op: 'tile', x: 0, y: 0, tile: 'b' });
        s.undo();
        expect(s.apply({ op: 'pop', x: 2, y: 2 }).ok).toBe(false);          // refused
        expect(s.apply({ op: 'tile', x: 1, y: 0, tile: 'a' }).applied).toBe(false); // no-op
        expect(s.redoCount()).toBe(1);
        s.apply({ op: 'tile', x: 2, y: 0, tile: 'b' });
        expect(s.redoCount()).toBe(0);
        expect(s.redo()).toBe(false);
    });

    /** MUTANT: put the redo list into `payload()` — every payload grows a field. */
    it('the redo list is NOT identity: `payload()` keys are unchanged, and redo resets `certified`', () => {
        const s = createEditSession(toy, world(2, 2), { base: { kind: 'toy' }, certified: true });
        s.apply({ op: 'tile', x: 0, y: 0, tile: 'b' });
        s.setCertified(true);
        s.undo();
        s.setCertified(true);
        s.redo();
        expect(Object.keys(s.payload())).toEqual(['base', 'edits', 'certified']);
        expect(s.certified).toBe(null);
    });

    /** MUTANT: a group redone as its members — the op list grows by 2 and one undo no longer takes it back. */
    it('a GROUP is redone as ONE entry', () => {
        const s = createEditSession(toy, world(3, 1));
        s.apply(group('g', [{ op: 'tile', x: 0, y: 0, tile: 'b' }, { op: 'tile', x: 1, y: 0, tile: 'b' }]));
        s.undo();
        s.redo();
        expect(s.ops()).toHaveLength(1);
        expect(s.ops()[0].op).toBe('group');
    });
});

/* ══ FILL · CLEAR · REPLACE · MOVE ═════════════════════════════════════ */

describe('⛓ rectangle builders — each ONE group', () => {
    const seeded = () => {
        const s = createEditSession(toy, world(4, 3));
        s.apply({ op: 'add', x: 1, y: 1, item: 'k' });
        s.apply({ op: 'add', x: 1, y: 1, item: 'm' });
        return s;
    };

    /** MUTANT: `rectFillOps` loops `dx < w - 1` — the last column is not filled. */
    it('FILL paints every cell of the rectangle, in grid order, as one group', () => {
        const s = seeded();
        const op = rectFillOps(toy, s.record(), { x: 1, y: 0, w: 3, h: 2 }, { tile: 'b' });
        expect(op.op).toBe('group');
        expect(op.ops.map((o) => `${o.x},${o.y}`)).toEqual(['1,0', '2,0', '3,0', '1,1', '2,1', '3,1']);
        s.apply(op);
        expect(s.ops()).toHaveLength(3);
        expect(cellOf(s.record(), 3, 1).tile).toBe('b');
        expect(cellOf(s.record(), 0, 0).tile).toBe('a');
        expect(() => rectFillOps(toy, s.record(), { x: 3, y: 0, w: 2, h: 1 }, { tile: 'b' }))
            .toThrow(/runs off the 4x3/);
    });

    /** MUTANT: `rectClearOps` ignores `fields` — a tile-only clear also pops the items. */
    it('CLEAR empties the named fields only; an all-empty rectangle refuses by name', () => {
        const s = seeded();
        s.apply(rectClearOps(toy, s.record(), { x: 1, y: 1, w: 1, h: 1 }, { fields: ['items'] }));
        expect(toy.readCell(s.record(), 1, 1)).toEqual({ tile: 'a', items: [] });
        s.apply(rectClearOps(toy, s.record(), { x: 0, y: 0, w: 2, h: 2 }));
        expect(toy.readCell(s.record(), 0, 0).tile).toBe(null);
        expect(() => rectClearOps(toy, s.record(), { x: 0, y: 0, w: 2, h: 2 })).toThrow(/found nothing to clear/);
        expect(() => rectClearOps(noClearToy, s.record(), { x: 0, y: 0, w: 1, h: 1 }))
            .toThrow(/declares no `clearOps`/);
    });

    /** MUTANT: `rectReplaceOps` drops the clear half — the destination ACCUMULATES like an add paste. */
    it('REPLACE makes the destination equal the clip; ADD (rectPasteOps) still accumulates', () => {
        const s = seeded();
        const clip = rectCopy(toy, s.record(), { x: 1, y: 1, w: 1, h: 1 });   // items [k, m]
        const add = createEditSession(toy, s.record());
        add.apply(rectPasteOps(toy, add.record(), clip, 1, 1));
        expect(toy.readCell(add.record(), 1, 1).items).toEqual(['k', 'm', 'k', 'm']);
        const rep = createEditSession(toy, s.record());
        rep.apply(rectReplaceOps(toy, rep.record(), clip, 1, 1));
        expect(toy.readCell(rep.record(), 1, 1).items).toEqual(['k', 'm']);
        // a filtered replace keeps the other field
        const only = createEditSession(toy, s.record());
        only.apply(rectReplaceOps(toy, only.record(), rectCopy(toy, s.record(), { x: 0, y: 0, w: 1, h: 1 }), 1, 1,
            { only: 'items' }));
        expect(toy.readCell(only.record(), 1, 1)).toEqual({ tile: 'a', items: [] });
    });

    /** MUTANT: `rectMoveOps` pastes onto `record` instead of the post-cut record — an overlapping move doubles. */
    it('MOVE is cut + paste as ONE group, overlap-safe, and one undo puts it back', () => {
        const s = seeded();
        const base = j(s.record());
        const clip = rectCopy(toy, s.record(), { x: 1, y: 1, w: 2, h: 1 });
        s.apply(rectMoveOps(toy, s.record(), clip, { x: 1, y: 1 }, 2, 1));   // overlaps its own source
        expect(s.ops()).toHaveLength(3);
        expect(toy.readCell(s.record(), 1, 1)).toEqual({ tile: null, items: [] });
        expect(toy.readCell(s.record(), 2, 1).items).toEqual(['k', 'm']);
        expect(toy.readCell(s.record(), 3, 1).tile).toBe('a');
        s.undo();
        expect(j(s.record())).toBe(base);
        expect(() => rectMoveOps(toy, s.record(), clip, { x: 1, y: 1 }, 1, 1)).toThrow(/not a move/);
    });

    /**
     * MUTANT (the one an ADD move cannot see): the REPLACE half reads the PRE-cut record, so its clears pop
     * items the cut already popped and the whole group refuses.
     */
    it('an OVERLAPPING REPLACE move reads the destination AFTER the cut', () => {
        const s = seeded();
        s.apply({ op: 'add', x: 2, y: 1, item: 'q' });
        const clip = rectCopy(toy, s.record(), { x: 1, y: 1, w: 2, h: 1 });   // [k,m] | [q]
        const res = s.apply(rectMoveOps(toy, s.record(), clip, { x: 1, y: 1 }, 2, 1, { replace: true }));
        expect(res.ok, res.description).toBe(true);
        expect(toy.readCell(s.record(), 1, 1).items).toEqual([]);
        expect(toy.readCell(s.record(), 2, 1).items).toEqual(['k', 'm']);
        expect(toy.readCell(s.record(), 3, 1).items).toEqual(['q']);
    });
});

/* ══ editorView: the keys and the replace dispatch ═══════════════════ */

class Target {
    constructor() { this.h = new Map(); }

    addEventListener(t, fn, o) {
        if (!this.h.has(t)) this.h.set(t, new Set());
        this.h.get(t).add(fn);
        o?.signal?.addEventListener('abort', () => this.h.get(t)?.delete(fn));
    }

    dispatch(t, e = {}) { for (const fn of [...(this.h.get(t) ?? [])]) fn(e); }
}
const mount = ({ commands, pasteOptions } = {}) => {
    const session = createEditSession(toy, world(4, 3));
    const canvas = Object.assign(new Target(), { width: 8, height: 6, parentNode: null });
    const keys = new Target();
    const ran = [];
    const view = mountEditorView({
        canvas, session, adapter: toy, keyTarget: keys,
        cellAt: (e) => ({ tx: e.tx, ty: e.ty }),
        brushOp: (tx, ty) => ({ op: 'add', x: tx, y: ty, item: 'k' }),
        floodTarget: () => ({ tile: 'b' }),
        commands: commands ?? [
            { id: UNDO_COMMAND_ID, label: 'undo', run: () => ran.push('undo') },
            { id: REDO_COMMAND_ID, label: 'redo', run: () => ran.push('redo') },
        ],
        ...(pasteOptions ? { pasteOptions } : {}),
        lifetime: createLifetime('editCoreE1.test'),
        paint: () => {},
    });
    const key = (k, mods = {}) => keys.dispatch('keydown', { key: k, ...mods, preventDefault() {} });
    return { session, canvas, view, ran, key, click: (tx, ty) => canvas.dispatch('click', { tx, ty }) };
};

describe('⛓ editorView — REDO keys, and the maze-shaped host with none', () => {
    /** MUTANT: drop the `shiftKey` test — Ctrl+Z would run redo. */
    it('Ctrl+Z → undo; Ctrl+Shift+Z and Ctrl+Y → redo; Meta works the same', () => {
        const t = mount();
        t.key('z', { ctrlKey: true });
        t.key('Z', { ctrlKey: true, shiftKey: true });
        t.key('y', { ctrlKey: true });
        t.key('z', { metaKey: true, shiftKey: true });
        expect(t.ran).toEqual(['undo', 'redo', 'redo', 'redo']);
    });

    /** MUTANT: bind redo keys unconditionally — a page with no redo row loses Ctrl+Shift+Z → undo. */
    it('a page with NO redo row keeps today\'s keys: Ctrl+Shift+Z still undoes, Ctrl+Y is unbound', () => {
        const ran = [];
        const t = mount({ commands: [{ id: UNDO_COMMAND_ID, label: 'u', run: () => ran.push('undo') }] });
        t.key('Z', { ctrlKey: true, shiftKey: true });
        t.key('y', { ctrlKey: true });
        expect(ran).toEqual(['undo']);
    });

    /** MUTANT: `pasteAt` ignores `replace` — the destination accumulates; or forwards `replace` to rectPasteOps. */
    it('`replace: true` in pasteOptions dispatches rectReplaceOps; absent, the ADD paste is unchanged', () => {
        let replace = false;
        const t = mount({ pasteOptions: () => (replace ? { replace: true } : {}) });
        t.click(1, 1);                      // brush: one 'k'
        t.view.run('rect'); t.click(1, 1); t.click(1, 1);
        expect(t.view.clipOrigin).toEqual({ x: 1, y: 1 });
        t.view.run('paste'); t.click(1, 1);
        expect(toy.readCell(t.session.record(), 1, 1).items).toEqual(['k', 'k']);
        replace = true;
        t.click(1, 1);
        expect(toy.readCell(t.session.record(), 1, 1).items).toEqual(['k']);
        expect(t.session.ops().at(-1).label).toMatch(/^replace /);
    });

    it('a core refusal from a builder is an EditCoreError (what the panel catches)', () => {
        expect(() => rectFillOps(toy, world(2, 2), { x: 0, y: 0, w: 0, h: 1 }, { tile: 'b' }))
            .toThrow(EditCoreError);
    });
});
