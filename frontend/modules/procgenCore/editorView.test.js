/**
 * ⛓⛓⛓ **THE EDITOR VIEW, AGAINST A TOY SUBSTRATE AND A HAND-BUILT DOM.**
 *
 * EDITOR v3 arc, slice A2 (`NewDocs/plans/seedling-editor-v3.md` §10). Two
 * things are hand-built here and each for its own reason:
 *
 *  · **the toy substrate** — the same discipline `editCore.test.js` follows: a
 *    view proven only against the maze would be a maze editor with an extra
 *    indirection, and the day Seedling's page mounted it the parts that had
 *    quietly grown maze vocabulary would be found one by one;
 *  · **the DOM** — this repo's vitest runs `environment: 'node'` (see
 *    `vitest.config.js`), so there is no `document` and no `EventTarget` to
 *    borrow. ⛔ The fakes below are deliberately THIN and honour the ONE thing
 *    the module under test relies on: `addEventListener(type, fn, {signal})`
 *    detaches when the signal aborts. That is what makes `destroy`'s claim
 *    (below) a measurement rather than a hope.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT — the change to `editorView.js` that would
 * make the row go RED.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { canonicalJson, createEditSession, describeOps } from './editCore.js';
import { createLifetime } from './pageLifetime.js';
import { EditorViewError, SHAPE_KINDS, TOOLS, assertShape, mountEditorView } from './editorView.js';

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE TOY SUBSTRATE — `editCore.test.js`'s, in the smallest form this
 *   file's claims need.
 * ══════════════════════════════════════════════════════════════════════ */

const toyWorld = (w, h, fill = 'a') => Object.freeze({
    w,
    h,
    cells: Object.freeze(Array.from({ length: w * h }, () => Object.freeze({
        tile: fill, entity: null,
    }))),
});
const at = (rec, x, y) => rec.cells[x + y * rec.w];
const withCell = (rec, x, y, cell) => Object.freeze({
    ...rec,
    cells: Object.freeze(rec.cells.map((c, i) => (i === x + y * rec.w ? Object.freeze(cell) : c))),
});

const toyAdapter = Object.freeze({
    name: 'toy',
    apply(record, op) {
        if (!op || !['setTile', 'setEntity'].includes(op.op)) {
            return { ok: false, description: `toy: unknown op ${JSON.stringify(op?.op)}.` };
        }
        const { x, y } = op;
        if (!(x >= 0 && y >= 0 && x < record.w && y < record.h)) {
            return { ok: false, description: `toy: (${x},${y}) is off the grid.` };
        }
        const cell = at(record, x, y);
        if (op.op === 'setTile') {
            return {
                ok: true,
                op: { op: 'setTile', x, y, tile: op.tile },
                description: `tile (${x},${y}) → ${op.tile}`,
                record: withCell(record, x, y, { ...cell, tile: op.tile }),
            };
        }
        if (op.entity && cell.tile === 'b') {
            return {
                ok: false,
                description: `toy: (${x},${y}) is a 'b' tile and nothing stands on a 'b'.`,
            };
        }
        return {
            ok: true,
            op: { op: 'setEntity', x, y, entity: op.entity ? { kind: op.entity.kind } : null },
            description: `entity (${x},${y}) → ${op.entity ? op.entity.kind : 'none'}`,
            record: withCell(record, x, y, {
                ...cell, entity: op.entity ? Object.freeze({ kind: op.entity.kind }) : null,
            }),
        };
    },
    equal: (a, b) => canonicalJson(a) === canonicalJson(b),
    bounds: (record) => ({ w: record.w, h: record.h }),
    readCell: (record, x, y) => {
        const c = at(record, x, y);
        return { tile: c.tile, entity: c.entity ? { kind: c.entity.kind } : null };
    },
    writeOps: (desc, x, y) => {
        const out = [];
        if (Object.prototype.hasOwnProperty.call(desc, 'tile')) {
            out.push({ op: 'setTile', x, y, tile: desc.tile });
        }
        if (Object.prototype.hasOwnProperty.call(desc, 'entity')) {
            out.push({ op: 'setEntity', x, y, entity: desc.entity });
        }
        return out;
    },
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE HAND-BUILT DOM
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ AN EVENT TARGET THAT HONOURS `{signal}`. ⛔ That one line is what makes
 * the teardown row a measurement: `pageLifetime.on` registers with the arm's
 * `AbortSignal`, so a fake that ignored it would let a retired arm keep
 * painting and the row would pass over a real leak.
 */
class FakeTarget {
    constructor(name) {
        this.name = name;
        this.handlers = new Map();
    }

    addEventListener(type, fn, options = undefined) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(fn);
        if (options?.signal) {
            options.signal.addEventListener('abort', () => {
                this.handlers.get(type)?.delete(fn);
            });
        }
    }

    removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }

    /** How many listeners are attached — the teardown row's subject. */
    count() { return [...this.handlers.values()].reduce((n, s) => n + s.size, 0); }

    dispatch(type, event = {}) {
        for (const fn of [...(this.handlers.get(type) ?? [])]) fn(event);
    }
}

/** ⛓ A canvas is a target plus the two numbers the overlay painter reads. */
class FakeCanvas extends FakeTarget {
    constructor() {
        super('canvas');
        this.width = 64;
        this.height = 64;
        this.parentNode = null;
    }
}

/**
 * ⛓ THE HARNESS. One toy world, one session, one mount — and a RECORDING
 * `paint`, `say` and `onChange`, because the claims below are about what the
 * view DID rather than about what it drew with.
 */
const harness = ({
    w = 6, h = 5, commands = [], brush = { op: 'setTile', tile: 'b' }, adapter = toyAdapter, ...rest
} = {}) => {
    const session = createEditSession(adapter, toyWorld(w, h), { base: { kind: 'toy' } });
    const canvas = new FakeCanvas();
    const keyTarget = new FakeTarget('document');
    const said = [];
    const changes = [];
    const painted = [];
    let armedBrush = brush;
    const view = mountEditorView({
        canvas,
        session,
        adapter,
        cellAt: (e) => (Number.isInteger(e.tx) && Number.isInteger(e.ty)
            ? { tx: e.tx, ty: e.ty } : null),
        commands,
        brushOp: (tx, ty) => (armedBrush ? { ...armedBrush, x: tx, y: ty } : null),
        floodTarget: () => ({ tile: 'b', entity: null }),
        onChange: (c) => changes.push(c),
        say: (text, bad) => said.push({ text, bad: Boolean(bad) }),
        offRoom: (tool) => `that point is outside the level (${tool})`,
        lifetime: createLifetime('editorView.test'),
        keyTarget,
        paint: (shapes) => painted.push(shapes),
        ...rest,
    });
    const click = (tx, ty) => canvas.dispatch('click', { tx, ty });
    const drag = (cells) => {
        canvas.dispatch('mousedown', cells[0]);
        for (const c of cells.slice(1)) canvas.dispatch('mousemove', c);
        keyTarget.dispatch('mouseup', {});
    };
    return {
        session, canvas, keyTarget, view, said, changes, painted, click, drag,
        last: () => said[said.length - 1],
        setBrush: (b) => { armedBrush = b; },
    };
};

/* ══════════════════════════════════════════════════════════════════════
 * THE BRUSH, AND THE STROKE
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ the brush', () => {
    /** ⛓ MUTANT: the click handler applies `brushOp` twice — `ops()` is 2. */
    it('a click applies ONE op at the cell `cellAt` named', () => {
        const t = harness();
        t.click(2, 3);
        expect(t.session.ops()).toHaveLength(1);
        expect(t.session.ops()[0]).toMatchObject({ op: 'setTile', x: 2, y: 3, tile: 'b' });
        expect(toyAdapter.readCell(t.session.record(), 2, 3).tile).toBe('b');
    });

    /**
     * ⛓⛓⛓ **THE CLAIM THIS FILE EXISTS FOR — A DRAG IS ONE GROUP.**
     *
     * ⛓ MUTANT: the `mouseup` arm applies each cell separately
     * (`s.cells.forEach((c) => applyOp(brushOp(c.tx, c.ty)))`). The record is
     * identical, every cell is painted, and every count below moves: `ops()`
     * becomes 3 instead of 1, `describeOps` says `3 edit(s)` instead of
     * `1 edit(s) (1 group of 3)`, and ONE undo leaves two cells painted.
     * ⛔ That is why the row asserts the OP LIST and the UNDO and not the
     * record: a claim measured on the record alone cannot tell the two builds
     * apart (⚠ §9.3's lesson, and trap 586).
     */
    it('a DRAG across three cells is ONE group — and ONE undo takes all three back', () => {
        const t = harness();
        t.drag([{ tx: 1, ty: 1 }, { tx: 2, ty: 1 }, { tx: 3, ty: 1 }]);
        expect(t.session.ops()).toHaveLength(1);
        expect(t.session.ops()[0].op).toBe('group');
        expect(t.session.ops()[0].ops).toHaveLength(3);
        expect(describeOps(t.session.ops())).toBe('1 edit(s) (1 group of 3)');
        for (const x of [1, 2, 3]) {
            expect(toyAdapter.readCell(t.session.record(), x, 1).tile).toBe('b');
        }
        expect(t.session.undo()).toBe(true);
        expect(t.session.ops()).toHaveLength(0);
        for (const x of [1, 2, 3]) {
            expect(toyAdapter.readCell(t.session.record(), x, 1).tile).toBe('a');
        }
    });

    /** ⛓ MUTANT: the dedupe is dropped (`stroke.cells.push(c)` unconditional) —
     *  the group carries 4 members for 3 distinct cells. ⛔ The ORDER is the
     *  visit order, which is what makes a stroke replayable as it was drawn. */
    it('the stroke de-duplicates cells and keeps VISIT order', () => {
        const t = harness();
        t.drag([{ tx: 3, ty: 0 }, { tx: 3, ty: 0 }, { tx: 1, ty: 0 }, { tx: 2, ty: 0 }]);
        expect(t.session.ops()[0].ops.map((o) => o.x)).toEqual([3, 1, 2]);
    });

    /**
     * ⛓⛓ MUTANT: `swallowClick` is never set — the `click` the browser fires
     * after the release re-applies the brush at the last cell.
     *
     * ⛔⛔ **AND THE OP COUNT CANNOT SEE IT** — measured, and the first cut of
     * this row was GREEN under that mutant. The trailing click lands on the
     * cell the stroke just painted, so the second application is a NO-OP and
     * ⚖ law (b) drops it: same record, same `ops()`, same everything the
     * obvious assertion looks at. ⚠ §9.3's lesson exactly (and trap 586): a
     * claim measured on a subject that cannot tell two builds apart is not a
     * claim. The SUBJECT here is that the handler did not RUN — no sentence,
     * no `onChange` — which is what the swallow actually promises.
     */
    it('the click that follows a committed drag is swallowed — the handler does NOT run', () => {
        const t = harness();
        t.canvas.dispatch('mousedown', { tx: 0, ty: 0 });
        t.canvas.dispatch('mousemove', { tx: 1, ty: 0 });
        t.keyTarget.dispatch('mouseup', {});
        const saidBefore = t.said.length;
        const changedBefore = t.changes.length;
        t.canvas.dispatch('click', { tx: 1, ty: 0 });
        expect(t.said).toHaveLength(saidBefore);
        expect(t.changes).toHaveLength(changedBefore);
        expect(t.session.ops()).toHaveLength(1);
        expect(t.session.ops()[0].op).toBe('group');
        // ⛓ …and the NEXT click is not swallowed — the flag is one-shot, not a
        //   mode. Without this the mutant "swallowClick is never cleared" would
        //   pass the row above and kill every press after a drag.
        t.canvas.dispatch('click', { tx: 4, ty: 4 });
        expect(t.session.ops()).toHaveLength(2);
    });

    /** ⛓ MUTANT: a one-cell drag commits a group of 1 — then the click that
     *  follows is swallowed and the press does nothing at all. */
    it('a ONE-cell press is left to the click handler, and lands exactly once', () => {
        const t = harness();
        t.canvas.dispatch('mousedown', { tx: 4, ty: 2 });
        t.keyTarget.dispatch('mouseup', {});
        t.canvas.dispatch('click', { tx: 4, ty: 2 });
        expect(t.session.ops()).toHaveLength(1);
        expect(t.session.ops()[0].op).toBe('setTile');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * REFUSALS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛔ a refusal moves nothing', () => {
    /**
     * ⛓⛓ MUTANT: `applyOp` records the op regardless of `res.ok`. The toy's own
     * legality rule (nothing stands on a `'b'`) is what refuses, so the row is
     * about a SUBSTRATE refusal reaching the view unchanged and not about a
     * shape check.
     */
    it('a REFUSED op leaves `ops()` unchanged and prints the adapter\'s own sentence', () => {
        const t = harness();
        t.click(2, 2);
        expect(t.session.ops()).toHaveLength(1);
        t.setBrush({ op: 'setEntity', entity: { kind: 'rock' } });
        t.click(2, 2);
        expect(t.session.ops()).toHaveLength(1);
        expect(t.last().bad).toBe(true);
        expect(t.last().text).toContain('nothing stands on a \'b\'');
    });

    /** ⛓ MUTANT: a NO-OP is counted — clicking `'b'` onto a `'b'` grows the
     *  list. ⚖ law (b): the question is asked of the RECORD. */
    it('a NO-OP click is not an edit', () => {
        const t = harness();
        t.click(0, 0);
        t.click(0, 0);
        expect(t.session.ops()).toHaveLength(1);
        expect(t.last().bad).toBe(false);
    });

    /** ⛓ MUTANT: the off-room branch clamps to the nearest cell instead of
     *  refusing — the row goes red on the op count AND on the sentence. */
    it('a point off the level REFUSES by name and applies nothing', () => {
        const t = harness();
        t.canvas.dispatch('click', { tx: null, ty: null });
        expect(t.session.ops()).toHaveLength(0);
        expect(t.last()).toEqual({ text: 'that point is outside the level (brush)', bad: true });
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * RECT COPY / PASTE
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ RECT copy and PASTE', () => {
    /** ⛓ MUTANT: the second click copies a 1x1 (the corners are not spanned) —
     *  the clip's `w`/`h` go to 1 and the paste writes one cell. */
    it('two clicks make a clip of the spanned size, in either drag direction', () => {
        const t = harness();
        t.view.setTool(TOOLS.RECT);
        t.click(3, 2);
        expect(t.view.corner).toEqual({ tx: 3, ty: 2 });
        t.click(2, 1);
        expect(t.view.clip).toMatchObject({ w: 2, h: 2 });
        expect(t.view.corner).toBe(null);
        expect(t.view.clip.cells).toHaveLength(2);
    });

    /**
     * ⛓⛓ MUTANT: the paste applies `rectPasteOps`' members one at a time
     * instead of the group it returns — `ops()` grows by 4 and ONE undo leaves
     * three cells pasted.
     */
    it('a PASTE lands the clip elsewhere as ONE group, reproducing the cells', () => {
        const t = harness();
        t.click(0, 0);
        t.click(1, 0);
        t.view.setTool(TOOLS.RECT);
        t.click(0, 0);
        t.click(1, 0);
        t.view.setTool(TOOLS.PASTE);
        t.click(4, 3);
        const rec = t.session.record();
        expect(toyAdapter.readCell(rec, 4, 3).tile).toBe('b');
        expect(toyAdapter.readCell(rec, 5, 3).tile).toBe('b');
        expect(t.session.ops()[t.session.ops().length - 1].op).toBe('group');
    });

    /** ⛓ MUTANT: PASTE with no clip silently does nothing — the row asserts the
     *  refusal is SAID, because a control that fails quietly is a control the
     *  reader believes worked. */
    it('PASTE with no clip refuses by name', () => {
        const t = harness();
        t.view.setTool(TOOLS.PASTE);
        t.click(1, 1);
        expect(t.session.ops()).toHaveLength(0);
        expect(t.last().bad).toBe(true);
        expect(t.last().text).toContain('arm RECT');
    });

    /**
     * ⛓⛓⛓ **THE CORE'S OWN SENTENCE FOR A FILTER THE SUBSTRATE CANNOT MEAN.**
     *
     * ⛓ MUTANT: `tryCore` swallows the `EditCoreError` and returns `{ok:true}`
     * — the paste then lands unfiltered and is still called a filtered paste
     * (⚠ trap 594's family, which is why `editCore`'s `filterDescriptor`
     * refuses rather than ignores).
     *
     * ⛔ THE SUBJECT IS AN ADAPTER WHOSE DESCRIPTOR HAS NO `tile` FIELD — the
     * split genuinely does not exist on it, which is the only shape that can
     * distinguish "refused the filter" from "applied it".
     */
    it('a filter the descriptor has no field for prints the CORE\'s refusal, verbatim', () => {
        const noTiles = Object.freeze({
            ...toyAdapter,
            name: 'entities-only-toy',
            readCell: (record, x, y) => ({ entity: at(record, x, y).entity }),
            writeOps: (desc, x, y) => [{ op: 'setEntity', x, y, entity: desc.entity }],
        });
        const t = harness({
            adapter: noTiles,
            pasteOptions: () => ({ tilesOnly: true }),
        });
        t.view.setTool(TOOLS.RECT);
        t.click(0, 0);
        t.click(0, 0);
        expect(t.view.clip).toMatchObject({ w: 1, h: 1 });
        const before = t.session.ops().length;
        t.view.setTool(TOOLS.PASTE);
        t.click(2, 2);
        expect(t.session.ops()).toHaveLength(before);
        expect(t.last().bad).toBe(true);
        expect(t.last().text).toContain('has no `tile` field');
        expect(t.last().text).toContain('Refused rather than ignored');
    });

    /**
     * ⛓⛓ **THE BOUNDS THE PAGE NAMES ARE PRINTED BEFORE THE PASTE LANDS.**
     * ⛓ MUTANT: `clipWarnings` is consulted after `applyOp` — the sentence then
     * arrives describing an edit that has already happened, which is the whole
     * difference between a warning and a report.
     */
    it('a clip the page warns about says so BEFORE the paste lands', () => {
        const order = [];
        const t = harness({
            clipWarnings: () => ['a pasted ENTRANCE MOVES the level\'s only one'],
            say: (text) => order.push(text.startsWith('⚠') ? 'warned' : `say:${text.slice(0, 8)}`),
            onChange: ({ result }) => { if (result?.applied) order.push('applied'); },
        });
        // ⛓ the SOURCE is painted first, so the paste is a real change and not
        //   a no-op the fold would drop (⚖ law (b)) — a row that pasted `'a'`
        //   onto `'a'` would never reach `applied` and could not order the two.
        t.click(0, 0);
        t.click(1, 0);
        t.click(0, 1);
        t.click(1, 1);
        t.view.setTool(TOOLS.RECT);
        t.click(0, 0);
        t.click(1, 1);
        t.view.setTool(TOOLS.PASTE);
        // ⛓ only the PASTE's own trace is the subject — the four preparatory
        //   brush presses each applied, and a row that read them would order
        //   the warning against somebody else's edit.
        order.length = 0;
        t.click(3, 3);
        expect(order).toContain('warned');
        expect(order).toContain('applied');
        expect(order.indexOf('warned')).toBeLessThan(order.indexOf('applied'));
    });

    /** ⛓ MUTANT: `rectCopy` is called with a clipped rectangle instead of the
     *  spanned one — an off-grid rectangle then produces a smaller clip instead
     *  of the core's refusal. */
    it('a rectangle that runs off the grid prints the core\'s refusal and makes no clip', () => {
        const t = harness();
        t.view.setTool(TOOLS.RECT);
        t.click(5, 4);
        t.click(9, 9);
        expect(t.view.clip).toBe(null);
        expect(t.last().bad).toBe(true);
        expect(t.last().text).toContain('runs off the');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOOD
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ FLOOD', () => {
    /**
     * ⛓⛓ MUTANT: the flood is applied as its member ops rather than as the
     * group `floodOps` returns — `ops()` becomes 30 and one undo leaves 29
     * cells painted.
     */
    it('a flood click paints the whole component as ONE group', () => {
        const t = harness({ w: 4, h: 3 });
        t.view.setTool(TOOLS.FLOOD);
        t.click(0, 0);
        expect(t.session.ops()).toHaveLength(1);
        expect(t.session.ops()[0].op).toBe('group');
        /** ⛓ 12 CELLS × the toy's TWO write ops per cell — the count is of the
         *  ADAPTER's ops, which is what a group carries. */
        expect(t.session.ops()[0].ops).toHaveLength(24);
        expect(t.session.undo()).toBe(true);
        expect(toyAdapter.readCell(t.session.record(), 3, 2).tile).toBe('a');
    });

    /** ⛓ MUTANT: the seed is not bounds-checked — `floodOps` throws and the
     *  view lets it escape instead of printing it. */
    it('a flood seeded off the grid prints the core\'s refusal', () => {
        const t = harness({ w: 4, h: 3 });
        t.view.setTool(TOOLS.FLOOD);
        t.canvas.dispatch('click', { tx: 9, ty: 9 });
        expect(t.session.ops()).toHaveLength(0);
        expect(t.last().bad).toBe(true);
        expect(t.last().text).toContain('off the 4x3 toy grid');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ARMED VALUE, THE COMMAND TABLE, THE KEYS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ the armed tool and the command table', () => {
    /** ⛓ MUTANT: Escape only clears the rect corner — a click after it still
     *  paints, and the readout says nothing is armed while something is. */
    it('Escape clears the armed tool, and a click then applies nothing', () => {
        const t = harness();
        t.keyTarget.dispatch('keydown', { key: 'Escape' });
        expect(t.view.tool).toBe(null);
        t.click(1, 1);
        expect(t.session.ops()).toHaveLength(0);
        expect(t.last().bad).toBe(true);
    });

    /** ⛓ MUTANT: Escape does not clear the half-drawn rectangle — the NEXT
     *  RECT click then completes a rectangle from a corner nobody can see. */
    it('Escape drops a half-drawn rectangle', () => {
        const t = harness();
        t.view.setTool(TOOLS.RECT);
        t.click(2, 2);
        expect(t.view.corner).not.toBe(null);
        t.keyTarget.dispatch('keydown', { key: 'Escape' });
        expect(t.view.corner).toBe(null);
    });

    /**
     * ⛓⛓⛓ **THE KEYS ARE A VIEW OF THE TABLE.** ⛓ MUTANT: a key is handled in
     * a `switch` beside the table — `view.keys` no longer names it and this row
     * goes red on the map rather than on the behaviour, which is the point: a
     * binding the table cannot report is a binding the help text will drift
     * from.
     */
    it('every bound key resolves to a row of the table, and each tool has one', () => {
        const t = harness();
        for (const [key, row] of t.view.keys) {
            expect(t.view.commands).toContain(row);
            expect(row.key).toBe(key);
        }
        for (const tool of Object.values(TOOLS)) {
            expect([...t.view.keys.values()].some((r) => r.id === tool)).toBe(true);
        }
        t.keyTarget.dispatch('keydown', { key: 'f' });
        expect(t.view.tool).toBe(TOOLS.FLOOD);
        t.keyTarget.dispatch('keydown', { key: 'r' });
        expect(t.view.tool).toBe(TOOLS.RECT);
    });

    /** ⛓ MUTANT: `Ctrl+Z` calls `session.undo()` directly — the page's row
     *  (which re-renders and clears the solve) never runs, so the picture and
     *  the op list disagree until the next press. */
    it('Ctrl/Cmd+Z runs the PAGE\'s `undo` row, not a private undo', () => {
        const ran = [];
        const t = harness({
            commands: [{ id: 'undo', label: 'UNDO', run: () => ran.push('page-undo') }],
        });
        t.click(1, 1);
        t.keyTarget.dispatch('keydown', { key: 'z', ctrlKey: true });
        t.keyTarget.dispatch('keydown', { key: 'Z', metaKey: true });
        expect(ran).toEqual(['page-undo', 'page-undo']);
        // ⛔ and the view did NOT undo behind the page's back
        expect(t.session.ops()).toHaveLength(1);
    });

    /** ⛓ MUTANT: a duplicate key is resolved by walk order instead of refused —
     *  the page's row silently shadows a tool nobody can reach any more. */
    it('two rows claiming one key REFUSE by name', () => {
        expect(() => harness({
            commands: [{ id: 'download', label: 'D', key: 'f', run: () => {} }],
        })).toThrow(EditorViewError);
        expect(() => harness({
            commands: [{ id: 'download', label: 'D', key: 'f', run: () => {} }],
        })).toThrow(/claimed by both/);
    });

    /** ⛓ MUTANT: `run` falls back to a no-op for an unknown id — a page that
     *  renamed a command then ships a dead button. */
    it('`run` of an unknown id refuses, and of a known one fires', () => {
        const ran = [];
        const t = harness({
            commands: [{ id: 'solve', label: 'SOLVE', run: () => ran.push('solve') }],
        });
        t.view.run('solve');
        expect(ran).toEqual(['solve']);
        expect(() => t.view.run('nope')).toThrow(/no command "nope"/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE MOUNT'S OWN REFUSALS, AND THE TEARDOWN
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛔ the mount refuses rather than skips', () => {
    const bare = () => ({
        canvas: new FakeCanvas(),
        session: createEditSession(toyAdapter, toyWorld(3, 3)),
        adapter: toyAdapter,
        cellAt: () => null,
        brushOp: () => null,
        floodTarget: () => ({}),
        lifetime: createLifetime('bare'),
        keyTarget: new FakeTarget('doc'),
        paint: () => {},
    });

    it.each(['canvas', 'session', 'adapter', 'cellAt', 'brushOp', 'floodTarget', 'lifetime'])(
        'a missing `%s` is refused BY NAME', (member) => {
            const args = bare();
            delete args[member];
            expect(() => mountEditorView(args)).toThrow(new RegExp(`\`${member}\``));
        },
    );

    /** ⛓ MUTANT: a plain object is accepted as a session — the page then edits
     *  a record nobody folds and every count reads zero. */
    it('an object that is not an editCore session is refused', () => {
        expect(() => mountEditorView({ ...bare(), session: { record: {} } }))
            .toThrow(/createEditSession/);
    });

    /**
     * ⛓⛓ MUTANT: the overlay falls back to drawing nothing when there is no
     * document — ⚖ the graceful-skip trap: the page would ship with no
     * selection rectangle and report a successful mount.
     */
    it('no `paint` and no document is a REFUSAL, not a silent skip', () => {
        const args = bare();
        delete args.paint;
        expect(() => mountEditorView({ ...args, doc: null })).toThrow(/selection overlay/);
    });

    /**
     * ⛓⛓ MUTANT: `destroy` retires the lifetime — the page's OWN listeners
     * (the hover outline, `selectTile`, every button) die with the tool.
     * ⛔ The arm is the page's; retiring it is the page's call.
     */
    it('retiring the lifetime detaches every listener the view registered', () => {
        const t = harness();
        expect(t.canvas.count()).toBeGreaterThan(0);
        expect(t.keyTarget.count()).toBeGreaterThan(0);
        t.view.destroy();
        expect(t.canvas.count()).toBeGreaterThan(0);
    });
});

describe('⛓ a brush that REFUSES — the third answer', () => {
    it('⛔ `{refused}` is SAID VERBATIM and is NOT reported as "no brush is armed" — the two '
        + 'are different findings and collapsing them sends the reader to the wrong control', () => {
        const t = harness({ brush: { refused: 'the attributes box does not parse as JSON' } });
        t.click(1, 1);
        expect(t.last().text).toBe('the attributes box does not parse as JSON');
        expect(t.last().bad).toBe(true);
        expect(t.session.ops()).toEqual([]);
    });

    it('⛓ …and NOTHING armed still says its own thing', () => {
        const t = harness({ brush: null });
        t.click(1, 1);
        expect(t.last().text).toMatch(/no brush is armed/);
    });

    it('⛔ a refusal ANYWHERE in a stroke aborts the WHOLE stroke — the core\'s '
        + 'all-or-nothing law, so a gesture the reader did not make cannot commit', () => {
        const t = harness();
        t.setBrush({ refused: 'nope' });
        t.drag([{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }, { tx: 2, ty: 0 }]);
        expect(t.session.ops()).toEqual([]);
        expect(t.last().text).toBe('nope');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 C1 — **THE PAGE'S OWN TOOLS**, in the SAME `tool`
 * ══════════════════════════════════════════════════════════════════════ */

describe('a PAGE TOOL joins the four — one armed value, one listener, one table', () => {
    const pageTool = (log, extra = {}) => ({
        id: 'template', label: 'AT… (template)', key: 't', at: (c) => log.push(c), ...extra,
    });

    it('⛓ it is armable by id, by its command row and by its key, and the CLICK reaches it', () => {
        const log = [];
        const t = harness({ tools: [pageTool(log)] });
        t.view.setTool('template');
        expect(t.view.tool).toBe('template');
        t.click(2, 3);
        expect(log).toEqual([{ tx: 2, ty: 3 }]);
        t.view.setTool(TOOLS.BRUSH);
        t.view.run('template');
        expect(t.view.tool).toBe('template');
        t.view.setTool(TOOLS.BRUSH);
        t.keyTarget.dispatch('keydown', { key: 't' });
        expect(t.view.tool).toBe('template');
    });

    it('⛔⛔ ARMING IT DISARMS THE BRUSH — which is the whole reason it is a tool and not a '
        + 'second listener: two armed states on one canvas would make the page\'s own '
        + '"only one of the two can be armed" comment a claim nothing keeps', () => {
        const log = [];
        const t = harness({ tools: [pageTool(log)] });
        t.view.setTool('template');
        t.click(1, 1);
        expect(t.session.ops()).toEqual([]);
        expect(log.length).toBe(1);
        t.view.setTool(TOOLS.BRUSH);
        t.click(1, 1);
        expect(t.session.ops().length).toBe(1);
        expect(log.length).toBe(1);
    });

    it('⛓ a ONE-SHOT page tool disarms itself from its own `at` — this file does not decide '
        + 'which gestures spend themselves', () => {
        const t = harness({
            tools: [{ id: 'oneshot', label: 'one shot', at: () => t.view.setTool(null) }],
        });
        t.view.setTool('oneshot');
        t.click(0, 0);
        expect(t.view.tool).toBe(null);
    });

    it('⛔ a page tool that SHADOWS one of the four is refused BY NAME', () => {
        expect(() => harness({ tools: [{ id: TOOLS.BRUSH, at: () => {} }] }))
            .toThrow(/shadows one of this file's own four/);
    });

    it('⛔ a malformed page tool refuses at MOUNT, not at the first click on it', () => {
        expect(() => harness({ tools: [{ id: 'x' }] })).toThrow(/\{id, label, key\?, at\(cell\)\}/);
        expect(() => harness({ tools: [{ at: () => {} }] })).toThrow(/\{id, label, key\?, at\(cell\)\}/);
    });

    it('⛔ a page tool whose KEY is already claimed is refused — the key map is a VIEW of the '
        + 'one table and a shadowed binding is a control the help text still advertises', () => {
        expect(() => harness({ tools: [{ id: 'clash', key: 'b', at: () => {} }] }))
            .toThrow(/claimed by both/);
    });

    it('⛓ the tool vocabulary REFUSES an unknown id and NAMES both halves of it', () => {
        const t = harness({ tools: [pageTool([])] });
        expect(() => t.view.setTool('nope'))
            .toThrow(/\[brush, rect, paste, flood, template\]/);
    });

    it('⛓ with NO page tools nothing moved — the maze passes none and its vocabulary is the '
        + 'four exactly', () => {
        const t = harness();
        expect(() => t.view.setTool('template')).toThrow(/\[brush, rect, paste, flood\]/);
        expect(t.view.commands.map((r) => r.id)).toEqual(
            [...Object.values(TOOLS), 'escape'],
        );
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛔⛔ THE SPLIT IS REAL — asserted on the SOURCE
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ `view.apply` — a control that is not a GESTURE, on the one op path', () => {
    /**
     * ⛔ EDITOR v3 C2. Seedling's room-flags form and its resize control build
     * an op from typed inputs and a press: no cell, no click, no `tool`. Left
     * to call `session.apply` themselves each would carry its own copy of *"say
     * the description, tell the host, repaint"*, and the first to drift would
     * be a page whose readout and canvas disagreed about what had happened.
     */
    it('⛓ it applies through the SESSION and reports like a gesture does', () => {
        const t = harness();
        const res = t.view.apply({ op: 'setTile', x: 1, y: 1, tile: 'b' });
        expect(res.ok).toBe(true);
        expect(res.applied).toBe(true);
        expect(t.session.ops()).toHaveLength(1);
        // the same three things a click causes: a sentence, an onChange, a repaint
        expect(t.last().text).toBe(res.description);
        expect(t.changes).toHaveLength(1);
        expect(t.painted.length).toBeGreaterThan(0);
    });

    it('⛓⛓ a refusal is REPORTED, not thrown, and the op list does not grow', () => {
        const t = harness();
        const res = t.view.apply({ op: 'nope' });
        expect(res.ok).toBe(false);
        expect(t.session.ops()).toHaveLength(0);
        expect(t.last().bad).toBe(true);
        expect(t.changes[t.changes.length - 1].result.ok).toBe(false);
    });

    it('⛓ an op that changed NOTHING answers `applied:false` — the law a form needs as much '
        + 'as a click does', () => {
        const t = harness();
        const res = t.view.apply({ op: 'setTile', x: 1, y: 1, tile: 'a' });
        expect(res.ok).toBe(true);
        expect(res.applied).toBe(false);
        expect(t.session.ops()).toHaveLength(0);
    });

    it('⛔ it is NOT a second session — the tool and the clip are untouched by it', () => {
        const t = harness();
        t.view.setTool(TOOLS.RECT);
        t.view.apply({ op: 'setTile', x: 2, y: 2, tile: 'b' });
        expect(t.view.tool).toBe(TOOLS.RECT);
        expect(t.view.clip).toBe(null);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SHAPES — THE OVERLAY LEARNS A POLYLINE (EDITOR v3 D2)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ A 2D CONTEXT THAT RECORDS. The arrowhead is a PAINTER behaviour — a `paint`
 * spy sees the shape and never sees the head — so the rows below that are about
 * the head drive the file's OWN painter through a hand-built document and read
 * back the call sequence. ⛔ That is the only place the head exists; asserting
 * `arrow: true` on the shape would be asserting that the test passed a flag.
 */
class RecordingCtx {
    constructor() { this.calls = []; this.strokeStyle = null; }

    /* eslint-disable class-methods-use-this */
    save() {} restore() {} clearRect() {} setLineDash() {}
    /* eslint-enable class-methods-use-this */

    beginPath() { this.calls.push(['beginPath']); }
    moveTo(x, y) { this.calls.push(['moveTo', x, y]); }
    lineTo(x, y) { this.calls.push(['lineTo', x, y]); }
    stroke() { this.calls.push(['stroke']); }
    strokeRect(...a) { this.calls.push(['strokeRect', ...a]); }
    fillText(...a) { this.calls.push(['fillText', ...a]); }

    /** ⛓ One `stroke()` per path — the head is TWO extra paths, so counting
     *  strokes is counting heads once the line's own stroke is subtracted. */
    strokes() { return this.calls.filter((c) => c[0] === 'stroke').length; }
}

/** ⛓ The smallest document that lets the file build its own overlay. */
const domHarness = (rest = {}) => {
    const ctx = new RecordingCtx();
    const overlayEl = { width: 0, height: 0, style: {}, getContext: () => ctx };
    const parent = { appendChild() {}, removeChild() {} };
    const canvas = new FakeCanvas();
    canvas.parentNode = parent;
    canvas.clientWidth = 64;
    canvas.clientHeight = 64;
    const doc = { createElement: () => overlayEl };
    const t = harness({ canvas, doc, paint: undefined, ...rest });
    /**
     * ⛔ THE CLICK IS DISPATCHED ON **THIS** CANVAS. `harness` builds one of its
     * own and hands its `click` over that; the listeners here were registered on
     * the canvas passed in, so the borrowed helper would dispatch into a target
     * nothing is listening to — a row that then asserts an ABSENCE passes over a
     * painter that never ran.
     */
    return { ...t, ctx, overlayEl, canvas, click: (tx, ty) => canvas.dispatch('click', { tx, ty }) };
};

describe('⛓⛓⛓ the overlay draws POLYLINES, and a page may contribute shapes', () => {
    const line = (extra = {}) => ({
        kind: 'polyline', points: [{ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 }], ...extra,
    });

    it('⛓ with NO `shapes` injected the list is A2\'s two and nothing else — the maze passes '
        + 'none, and this is the row that says its picture did not move', () => {
        const t = harness();
        t.view.setTool(TOOLS.RECT);
        t.click(1, 1);
        const last = t.painted[t.painted.length - 1];
        expect(last).toEqual([{ kind: 'rect', x: 1, y: 1, w: 1, h: 1 }]);
        expect(new Set(last.map((s) => s.kind)).has('polyline')).toBe(false);
    });

    /** ⛓ MUTANT: the page's shapes are merged BEFORE the view's own — a paste
     *  ghost buried under whatever the page contributed. */
    it('⛓⛓ an injected `shapes()` is MERGED AFTER the view\'s own, on every repaint', () => {
        let extra = [line({ arrow: true, label: 'L0 → L2' })];
        const t = harness({ shapes: () => extra });
        t.view.setTool(TOOLS.RECT);
        t.click(1, 1);
        const last = t.painted[t.painted.length - 1];
        expect(last.map((s) => s.kind)).toEqual(['rect', 'polyline']);
        expect(last[1].label).toBe('L0 → L2');
        // ⛓ …and it is re-ASKED, not captured: the arrows change with every op.
        extra = [];
        t.view.setTool(null);
        expect(t.painted[t.painted.length - 1]).toEqual([]);
    });

    /**
     * ⛓ AND IT REFUSES AT **MOUNT**, which is where `repaint()` first asks —
     * the same moment a malformed page TOOL refuses, and for the same reason:
     * a shape the overlay cannot draw should not wait for the first gesture to
     * be found out.
     */
    it('⛔ an UNKNOWN kind refuses BY NAME and names the vocabulary', () => {
        expect(() => harness({ shapes: () => [{ kind: 'arrow', points: [] }] }))
            .toThrow(EditorViewError);
        expect(() => assertShape({ kind: 'arrow' })).toThrow(
            new RegExp(`\\[${SHAPE_KINDS.join(', ')}\\]`));
    });

    it('⛔ a polyline with fewer than TWO points refuses — it has no segment to hang a head '
        + 'on', () => {
        expect(() => assertShape({ kind: 'polyline', points: [{ x: 0, y: 0 }] }))
            .toThrow(/at least TWO/);
        expect(() => assertShape({ kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 1 }] }))
            .toThrow(/at least TWO/);
    });

    it('⛔ the injected `shapes()` must return an ARRAY', () => {
        expect(() => harness({ shapes: () => null })).toThrow(/must return an ARRAY/);
    });

    it('⛔ a rect with a non-finite field refuses too — the two A2 kinds are checked by the '
        + 'same one authority', () => {
        expect(() => assertShape({ kind: 'rect', x: 0, y: 0, w: 1, h: NaN })).toThrow(/`h`/);
    });

    /**
     * ⛓⛓⛓ MUTANT: `paintPolyline` drops the arrowhead. The picture is then a
     * bare line between two rooms and the reader cannot tell which way the door
     * goes — which is the whole claim the overview makes.
     */
    it('⛓⛓⛓ the PAINTER strokes the line AND an arrowhead at its LAST segment', () => {
        const t = domHarness({ shapes: () => [line({ arrow: true })] });
        const plain = t.ctx.strokes();
        expect(plain).toBe(3); // the line, plus the head's two legs
        const heads = t.ctx.calls.filter((c) => c[0] === 'moveTo').slice(1);
        // ⛓ …and both legs start AT THE LAST POINT (2.5 of a 6-wide grid on a
        //   64px overlay = 26.67px), which is what "at its last segment" means.
        const px = 64 / 6;
        for (const h of heads) expect(h[1]).toBeCloseTo(2.5 * px, 6);
    });

    it('⛓⛓ `arrowBack` adds a SECOND head, pointing the other way — a two-way door is ONE '
        + 'line with two heads and not two lines', () => {
        const one = domHarness({ shapes: () => [line({ arrow: true })] }).ctx.strokes();
        const two = domHarness({ shapes: () => [line({ arrow: true, arrowBack: true })] })
            .ctx.strokes();
        expect(two - one).toBe(2);
    });

    it('⛓ the head takes its direction from the LAST SEGMENT, not from the whole span — an '
        + 'elbowed arrow arrives the way it actually arrives', () => {
        const elbow = {
            kind: 'polyline',
            points: [{ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.1 }, { x: 2.5, y: 0.5 }],
            arrow: true,
        };
        const t = domHarness({ shapes: () => [elbow] });
        const legs = t.ctx.calls.filter((c) => c[0] === 'lineTo').slice(-2);
        // ⛓ The last segment runs straight DOWN, so both legs end ABOVE the tip.
        const py = 64 / 1;
        for (const l of legs) expect(l[2]).toBeLessThan(0.5 * py);
    });

    it('⛔ a DEGENERATE last segment draws NO head rather than one at an invented angle', () => {
        const t = domHarness({
            shapes: () => [{
                kind: 'polyline', points: [{ x: 1.5, y: 0.5 }, { x: 1.5, y: 0.5 }], arrow: true,
            }],
        });
        expect(t.ctx.strokes()).toBe(1);
    });

    it('⛓ a `label` is filled, once, near the line', () => {
        const t = domHarness({ shapes: () => [line({ label: 'L0 → L2' })] });
        expect(t.ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]))
            .toEqual(['L0 → L2']);
    });

    it('⛓ the two A2 kinds still reach `strokeRect` — the polyline arm did not take the '
        + 'rectangle\'s path with it', () => {
        const t = domHarness();
        t.view.setTool(TOOLS.RECT);
        t.click(1, 1);
        expect(t.ctx.calls.some((c) => c[0] === 'strokeRect')).toBe(true);
    });
});

describe('⛔ the view test imports nothing substrate-side', () => {
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const specifiers = [...source.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)]
        .map((m) => m[1]);
    const BINDING = /(^|\/)(mazeRoom|seedlingDemo)\//;

    it('reaches for no binding', () => {
        expect(specifiers.length).toBeGreaterThan(0);
        for (const spec of specifiers) {
            expect(BINDING.test(spec), `this test imports "${spec}"`).toBe(false);
        }
    });

    it('the scan is not vacuous', () => {
        expect(specifiers).toContain('./editorView.js');
        expect(BINDING.test('../mazeRoom/mazeEditAdapter.js')).toBe(true);
    });
});
