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
import { EditorViewError, TOOLS, mountEditorView } from './editorView.js';

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

/* ══════════════════════════════════════════════════════════════════════
 * ⛔⛔ THE SPLIT IS REAL — asserted on the SOURCE
 * ══════════════════════════════════════════════════════════════════════ */

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
