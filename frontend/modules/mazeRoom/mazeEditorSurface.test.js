/**
 * ⛓⛓⛓ **THE MAZE LAB'S EDITOR SURFACE IS BYTE-IDENTICAL ACROSS THE TOOLS MOVE** (editor tools, step B1).
 *
 * B1 moved Seedling's FILL / CLEAR / MOVE / paste-mode wiring into `procgenCore/editorView.js` as OPT-IN tools.
 * The maze lab opts into none of them, so its mount must be exactly what it was. This row mounts `editorView`
 * the way `mazeLabView.js`'s EDIT arm does — `mazeEditAdapter`, a `MazeRoomEditor` palette as `brushOp`, the
 * page's flood target (floor/wall only), its two paste checkboxes and its two clip bounds, an undo and a redo
 * row — in a node-side DOM, and digests the command table and, for a fixed script of gestures over two
 * generated rooms, every status line, op, `onChange` and overlay stroke.
 *
 * The digests were measured on the base BEFORE the move (origin/main 856d1aec89) and re-measured after it: equal.
 * ⛔ A change to the maze editor's behaviour must re-measure them and say so.
 *
 * ⛓ B2 (slice `maze-editor-tools`) turned FILL / CLEAR / MOVE ON in the maze lab. The first rows below still
 * mount WITHOUT them and still match the B1 digests (so adding `mazeEditAdapter.clearOps` moved nothing the
 * old mount does); the B2 rows mount as the page now does and carry their own digests.
 *
 * ⚠ The palette, flood target, paste options and clip bounds are written out here because `mazeLabView.main()`
 * is a whole page and cannot be mounted in node; `check-maze-lab` is the browser row over the page itself.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { MazeRoomEditor, PALETTE_TYPES, generateStep } from './mazeLab.js';
import { mazeEditAdapter } from './mazeEditAdapter.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { REDO_COMMAND_ID, UNDO_COMMAND_ID, mountEditorView } from '../procgenCore/editorView.js';
import { MAZE_EDIT_TOOLS, MAZE_FILL_REFUSAL } from './mazeEditTools.js';
import { fakeDocument } from '../procgenCore/fakeEditorDom.testkit.js';
import { createLifetime } from '../procgenCore/pageLifetime.js';

function surfaceOf(room, { b2 = false } = {}) {
    const doc = fakeDocument([]);
    // ⛓ B2 — the page's CLEAR select (`#labClearWhat`), filled by `editorView`.
    const clearWhat = b2 ? doc.createElement('select') : null;
    const parent = doc.createElement('div');
    const canvas = parent.appendChild(doc.createElement('canvas'));
    const session = createEditSession(mazeEditAdapter, generateStep(room).record);
    canvas.width = session.record().width * 16;
    canvas.height = session.record().height * 16;
    const editor = new MazeRoomEditor({ itemLib: {}, obstacleLib: {} });
    const log = [];
    const paste = { tilesOnly: false, entitiesOnly: false };
    const lifetime = createLifetime('mazeEditorSurface.test');
    const view = mountEditorView({
        canvas,
        session,
        adapter: mazeEditAdapter,
        cellAt: (e) => e?.cell ?? null,
        brushOp: (tx, ty) => editor.opFor(tx, ty),
        floodTarget: () => {
            const t = editor.selectedType;
            if (t === PALETTE_TYPES.FLOOR) return { tile: 'floor' };
            if (t === PALETTE_TYPES.WALL) return { tile: 'wall' };
            return null;
        },
        pasteOptions: () => ({ ...paste }),
        clipWarnings: (clip) => {
            const parts = (clip?.cells ?? []).flat().map((d) => d?.entity).filter(Boolean);
            return [
                ...(parts.some((e) => e.button !== undefined) ? ['button'] : []),
                ...(parts.some((e) => e.entrance) ? ['entrance'] : []),
            ];
        },
        commands: [
            { id: UNDO_COMMAND_ID, label: 'UNDO one edit', key: 'u', run: () => { log.push(['undo', session.undo()]); } },
            { id: REDO_COMMAND_ID, label: 'REDO one edit', run: () => { log.push(['redo', session.redo()]); } },
        ],
        // ⛓ B2 — the maze lab's opt-in, read off the SAME module the page imports.
        ...(b2 ? { tools: MAZE_EDIT_TOOLS, editTools: { fillRefusal: MAZE_FILL_REFUSAL, clearWhat } } : {}),
        lifetime,
        say: (text, bad) => log.push(['say', Boolean(bad), text]),
        offRoom: () => 'outside the room',
        onChange: (c) => log.push(['change', c?.tool ?? null, Boolean(c?.result?.applied)]),
        doc,
    });
    const snap = (what) => {
        log.push(['ops', what, JSON.stringify(session.ops())]);
        log.push(['paint', doc.paintLog.splice(0).filter((c) => c[0] === 'strokeRect')]);
        log.push(['tool', view.tool, view.clip ? [view.clip.w, view.clip.h] : null, view.clipOrigin]);
    };
    const key = (k, extra = {}) => { doc.dispatch('keydown', { key: k, ...extra }); };
    const click = (tx, ty) => { canvas.dispatch('click', { cell: { tx, ty } }); };
    const out = {
        commands: view.commands.map((r) => [r.id, r.label, r.key ?? null]),
        keys: [...view.keys.keys()],
        ...(b2 ? { clearWhat: clearWhat.options.map((o) => [o.value, o.textContent]) } : {}),
    };
    const W = session.record().width;
    const H = session.record().height;
    snap('mount');
    editor.selectedType = PALETTE_TYPES.WALL;
    key('b'); click(1, 1); snap('brush-wall');
    canvas.dispatch('mousedown', { cell: { tx: 2, ty: 1 } });
    canvas.dispatch('mousemove', { cell: { tx: 3, ty: 1 } });
    canvas.dispatch('mousemove', { cell: { tx: 3, ty: 2 } });
    doc.dispatch('mouseup', {}); click(3, 2); snap('stroke');
    editor.selectedType = PALETTE_TYPES.FLOOR;
    key('f'); click(1, 1); snap('flood');
    key('r'); click(0, 0); click(2, 2); snap('rect');
    key('p'); click(W - 3, H - 3); snap('paste');
    paste.tilesOnly = true; click(W - 4, 0); snap('paste-tiles');
    key('u'); key('z', { ctrlKey: true }); key('z', { ctrlKey: true, shiftKey: true }); key('y', { ctrlKey: true }); snap('undo-redo');
    // the keys the Seedling tools take are NOT bound here
    for (const k of ['l', 'x', 'm']) { key(k); click(1, 1); }
    snap('unbound-keys');
    key('r'); click(1, 1); key('Escape'); click(1, 1); snap('escape');
    key('b'); canvas.dispatch('click', { cell: null }); snap('off-room');
    out.log = log;
    out.world = JSON.stringify(session.record());
    view.destroy();
    lifetime.retire('done');
    return out;
}

/** ⛓ Measured on origin/main 856d1aec89 before the move. */
const BEFORE_THE_MOVE = Object.freeze({
    seed5: 'df47868e7dfed710eae0d8d9a9130599a7da9fc3b284d8ecc5b0c696f391d728',
    seed7: '0b427948b6731247bac0fb0c03cca3410e788f291ba4e23ff00bd6077a38842a',
});

describe('the maze lab\'s editor surface across the tools move', () => {
    it.each([
        ['seed5', { seed: 5, step: 3, width: 7, height: 7 }],
        ['seed7', { seed: 7, step: 5, width: 9, height: 9 }],
    ])('%s: the same digest as before the move, and none of the Seedling tools', (name, room) => {
        const s = surfaceOf(room);
        expect(s.commands.map((c) => c[0])).toEqual(['undo', 'redo', 'brush', 'rect', 'paste', 'flood', 'escape']);
        expect(s.log.filter((e) => e[0] === 'change' && e[2]).length).toBeGreaterThanOrEqual(3);
        const digest = createHash('sha256').update(JSON.stringify(s)).digest('hex');
        expect(digest).toBe(BEFORE_THE_MOVE[name]);
    });
});

/**
 * ⛓⛓⛓ **MAZE EDITOR TOOLS (B2) — THE PAGE'S MOUNT NOW NAMES FILL / CLEAR / MOVE**, and this is the
 * surface it has. The SAME script as above; what differs from the B1 surface (measured, the slice's
 * as-built quotes the diff): the command table gains `fill (l)`, `clear (x)`, `move (m)` between `flood`
 * and `escape`, the key map gains `l`, `x`, `m`, the `clearWhat` options are `['', 'tile', 'entity']`, and
 * the `unbound-keys` step's three presses now arm FILL (a corner), CLEAR (a corner) and MOVE (refused:
 * the earlier RECT clip, a no-op tiles-only move). Re-pinned by slice `maze-editor-tools`; ⛔ a change here
 * re-measures and says so.
 *
 * ⛓ Re-pinned by slice `editor-corner-reset` (a pending FILL/CLEAR corner belongs to the tool that set it; any
 * switch drops it). Measured base (B2's mount on origin/main add369e82f) vs tip, both seeds: ONE entry moves, the
 * `unbound-keys` CLEAR click's status — it used to complete a 1x1 rect on FILL's corner (refused, nothing to clear,
 * `bad` true) and now starts CLEAR's own corner (`CLEAR corner 1 at (1,1) …`, `bad` false). Ops, `onChange`, overlay
 * strokes, the command table and the world are byte-identical.
 */
const B2_PAGE_MOUNT = Object.freeze({
    seed5: '64ae264f1f564d5f1986789e1181a883a70a30ac5b855c832a2e076c4129ea98',
    seed7: '2b866415cc3ba721c35b513c77a0a773c1398f3ecb844a8550bfb99c388a93db',
});

describe('the maze lab\'s editor surface with B2\'s tools turned on', () => {
    it.each([
        ['seed5', { seed: 5, step: 3, width: 7, height: 7 }],
        ['seed7', { seed: 7, step: 5, width: 9, height: 9 }],
    ])('%s: FILL / CLEAR / MOVE after the four, and the pinned digest', (name, room) => {
        const s = surfaceOf(room, { b2: true });
        expect(s.commands.map((c) => c[0]))
            .toEqual(['undo', 'redo', 'brush', 'rect', 'paste', 'flood', 'fill', 'clear', 'move', 'escape']);
        expect(s.clearWhat.map((o) => o[0])).toEqual(['', 'tile', 'entity']);
        const digest = createHash('sha256').update(JSON.stringify(s)).digest('hex');
        expect(digest).toBe(B2_PAGE_MOUNT[name]);
    });
});
