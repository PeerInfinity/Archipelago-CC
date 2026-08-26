/**
 * procgenCore/editorView — **THE DOM HALF OF THE SHARED EDIT CORE.**
 *
 * EDITOR v3 arc, slice A2 (`NewDocs/plans/seedling-editor-v3.md` §7.2, §10).
 * A1 shipped `editCore.js` — the op log, the fold, `group`, rect copy/paste and
 * flood — as PURE functions over an adapter. This file is the other half: the
 * one owner of *what a press on the canvas does*, mounted by a page with its
 * own adapter, its own geometry and its own palette.
 *
 * ⛔ SUBSTRATE-AGNOSTIC, exactly as `editCore` is: it imports `editCore.js` and
 * nothing else, and `bindingContract.test.js`'s derived scan of this directory
 * is what holds that. It knows about CELLS, an `armed` tool and a clip; it does
 * not know what a tile is, what an entrance is, or which substrate it is on.
 *
 * ── ⛔⛔ THE FOUR THINGS IT OWNS, AND THE ONE IT MUST NOT ─────────────
 *
 * **(1) THE CANVAS TOOL — one `armed` value.** `{kind:'brush'|'rect'|'paste'|
 * 'flood'}` or `null`, and `Escape` sets it to `null`. A page that kept a
 * second "which tool" flag beside it would have two answers to *what does this
 * click do*, which is exactly the two-spellings failure the whole arc is
 * spending its budget avoiding.
 *
 * **(2) THE STROKE IS ONE GROUP.** A drag paints every cell it visits and
 * records **ONE** op (`editCore.group`), so ONE undo takes the whole stroke
 * back. ⛔ Not a convenience: undo is a fold over a SHORTER LIST, and a stroke
 * recorded as N ops would need N undos to reach a state the person thinks of as
 * one press — and `describeOps` would report a history with N presses in it.
 *
 * **(3) THE COMMAND TABLE IS THE ONE WRITER OF THE KEY MAP.** The page hands
 * `{id, label, key, run}` rows; the view adds its own (the tools, and clearing
 * the armed tool); the keyboard is a **VIEW** of that list and never a second
 * list. ⛔ A key bound in a `switch` beside the table is a binding the table
 * cannot report, and a readout that cannot report a key is a page whose help
 * text drifts from its behaviour on the first slice that adds one.
 *
 * **(4) THE SELECTION OVERLAY, AND NOTHING ELSE.** ⚖ The one-renderer law: the
 * substrate is drawn by the page and only by the page. This file creates its
 * own overlay element and draws on it the two things the page has no notion of
 * — the rectangle a copy is being dragged out of, and the anchor a paste is
 * pending at — plus, since EDITOR v3 D2, whatever SHAPES the page contributes
 * through the optional `shapes()`. ⛔ That last one does not loosen the law: the
 * element, the clear and the repaint schedule are still this file's, and the
 * page hands over WHAT to draw rather than a second surface to draw it on.
 * ⚠ HOVER STAYS THE PAGE'S: `mazeLabView.draw` already outlines the
 * hovered cell in every arm, and a second outline drawn by this file would be a
 * second answer to *which cell is under the pointer* (trap 269's shape at the
 * boundary between two renderers).
 *
 * ── ⚠ WHAT IS INJECTED, AND WHY EACH ONE HAS TO BE ───────────────────
 *
 *  · `cellAt(event)` — ⛔ THE GEOMETRY IS THE PAGE'S. `check-maze-lab`'s claim 5
 *    computes the target cell from the canvas rectangle INDEPENDENTLY and
 *    asserts the tile it named is the tile that changed; a geometry of this
 *    file's own would make that row assert against itself.
 *  · `brushOp(tx, ty)` — the palette selection, as a CLOSED op. The view never
 *    reads a palette; a substrate's vocabulary is its own.
 *  · `floodTarget(tx, ty)` — the descriptor a flood paints, for the same reason.
 *  · `clipWarnings(clip)` — ⛔ THE BOUNDS ARE THE SUBSTRATE'S. §9.4 named two
 *    that are real on the maze (a pasted button DUPLICATES its resolved index;
 *    a pasted entrance MOVES the world's only one) and this file cannot know
 *    either — it can only guarantee that whatever the page names is printed
 *    BEFORE the paste lands rather than after, or silently.
 *  · `say(text, bad)` — the page's status line, and every sentence this file
 *    prints goes through it VERBATIM from the core or the adapter.
 */

import {
    EditCoreError,
    describeOps,
    floodOps,
    group,
    rectCopy,
    rectPasteOps,
} from './editCore.js';

export class EditorViewError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EditorViewError';
    }
}

const fail = (message) => { throw new EditorViewError(message); };

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SHAPE VOCABULARY — EDITOR v3 D2, ADDITIVE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **WHAT THE OVERLAY CAN DRAW.** Two of these three are A2's and their
 * bytes on the maze did not move; `polyline` is the one this slice adds.
 *
 * ⛔ **WHY A POLYLINE AND NOT "AN ARROW".** Four slices have now wanted the
 * same picture — *this room leads to that one* — and an `arrow` primitive would
 * have been a shape that can only ever be a straight segment between two
 * points. A polyline with an optional head at either end draws the arrow, the
 * elbowed arrow that clears the cells between, and the plain path a later slice
 * will want for a corridor; the head is a FLAG on the line rather than a kind of
 * its own, because *"a line, drawn with a head"* is one thing to reason about
 * and two kinds would be two.
 *
 * ⛔ **AND THE COORDINATES ARE CELL SPACE, FRACTIONS ALLOWED.** The painter
 * multiplies by the cell size and nothing else, so the CENTRE of cell 3 is
 * `{x: 3.5, y: 0.5}` and the producer says where the line goes. A painter that
 * centred points itself would make every polyline that is NOT between two cell
 * centres impossible to express.
 */
export const SHAPE_KINDS = Object.freeze(['rect', 'paste', 'polyline']);

/** ⛓ The arrowhead, in overlay pixels — a length and a half-spread. */
const ARROW_PX = Object.freeze({ length: 9, spread: 0.45 });

const isFinitePoint = (p) => p !== null && typeof p === 'object'
    && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * ⛓⛓ **THE ONE AUTHORITY ON WHAT A SHAPE IS**, called where a shape is
 * PRODUCED (the merge below) and again by the painter's dispatch when it meets
 * a kind it has no painter for — one function, so there is exactly one sentence
 * about a malformed shape no matter which side notices it.
 *
 * ⛔ AN UNKNOWN KIND REFUSES BY NAME rather than being skipped. A page that
 * contributed `{kind:'arrow'}` and saw nothing drawn would look at its
 * geometry, at its `repaint`, and at the overlay element long before it looked
 * at the spelling — ⚖ the graceful-skip trap, which this file already refuses
 * to fall into when there is no document to draw on at all.
 */
export function assertShape(shape, where = 'a shape') {
    if (shape === null || typeof shape !== 'object' || Array.isArray(shape)) {
        fail(`editorView: ${where} must be an object, got ${JSON.stringify(shape)}.`);
    }
    if (!SHAPE_KINDS.includes(shape.kind)) {
        fail(`editorView: ${where} names kind ${JSON.stringify(shape.kind)} and the `
            + `vocabulary is [${SHAPE_KINDS.join(', ')}]. ⛔ Refused by name rather than `
            + 'skipped: a shape nobody draws cannot be told from one nobody produced.');
    }
    if (shape.kind === 'polyline') {
        if (!Array.isArray(shape.points) || shape.points.length < 2
            || !shape.points.every(isFinitePoint)) {
            fail(`editorView: ${where} is a polyline, so it needs \`points\` — at least TWO `
                + '`{x, y}` in CELL space, every coordinate finite. ⛔ A one-point polyline '
                + 'has no direction, so it has no segment to hang an arrowhead on and '
                + 'nothing to stroke; it is refused rather than drawn as a dot.');
        }
        for (const flag of ['arrow', 'arrowBack', 'highlight']) {
            if (shape[flag] !== undefined && typeof shape[flag] !== 'boolean') {
                fail(`editorView: ${where} carries \`${flag}\` = `
                    + `${JSON.stringify(shape[flag])}; it is a boolean or absent.`);
            }
        }
        if (shape.label !== undefined && typeof shape.label !== 'string') {
            fail(`editorView: ${where} carries a non-string \`label\`.`);
        }
        return shape;
    }
    for (const n of ['x', 'y', 'w', 'h']) {
        if (!Number.isFinite(shape[n])) {
            fail(`editorView: ${where} is a ${shape.kind}, so \`${n}\` must be a finite `
                + `number, got ${JSON.stringify(shape[n])}.`);
        }
    }
    return shape;
}

/**
 * ⛓ THE FOUR TOOLS. ⛔ Exported as data so a page's buttons, this file's key
 * map and a browser row's selector all name the same four strings.
 */
export const TOOLS = Object.freeze({
    BRUSH: 'brush',
    RECT: 'rect',
    PASTE: 'paste',
    FLOOD: 'flood',
});

/**
 * ⛓ THE TOOL COMMANDS THIS FILE CONTRIBUTES, as data. `key` is the single
 * character a keydown matches; the page may add rows with their own.
 */
const TOOL_ROWS = Object.freeze([
    Object.freeze({ id: TOOLS.BRUSH, label: 'BRUSH', key: 'b', tool: TOOLS.BRUSH }),
    Object.freeze({ id: TOOLS.RECT, label: 'RECT (copy)', key: 'r', tool: TOOLS.RECT }),
    Object.freeze({ id: TOOLS.PASTE, label: 'PASTE', key: 'p', tool: TOOLS.PASTE }),
    Object.freeze({ id: TOOLS.FLOOD, label: 'FLOOD', key: 'f', tool: TOOLS.FLOOD }),
]);

/** ⛓ The command id `Ctrl/Cmd+Z` resolves to — the page supplies the row. */
export const UNDO_COMMAND_ID = 'undo';

const isFn = (v) => typeof v === 'function';

/**
 * ⛓⛓⛓ **MOUNT THE TOOL ON A CANVAS.**
 *
 * @returns {{
 *   tool: string|null, setTool: (t: string|null) => void,
 *   clip: object|null, commands: object[], keys: Map<string, object>,
 *   run: (id: string) => any, destroy: () => void,
 * }}
 */
export function mountEditorView({
    canvas,
    session,
    adapter,
    cellAt,
    commands = [],
    brushOp,
    floodTarget,
    pasteOptions = () => ({}),
    clipWarnings = () => [],
    /**
     * ⛓⛓⛓ **THE PAGE'S OWN TOOLS** — EDITOR v3 C1. `[{id, label, key, at(cell)}]`,
     * joining the four below in the SAME `tool` variable, the SAME command
     * table and the SAME canvas listener.
     *
     * ⛔ **WHY THIS EXISTS AND WHY IT IS NOT A SECOND LISTENER.** Seedling's
     * GENERATE arm has a click-to-anchor TEMPLATE arm (*press AT… on a
     * catalogue row, then click a tile*) that predates this file, and it was
     * one of two kinds inside a page-local `armed` variable with its own
     * `canvas.onclick`. Delegating the editing half here while leaving the
     * template half behind would have put TWO armed states and TWO listeners on
     * one canvas — and the page's own comment (*"only one of the two can be
     * armed at a time"*) would then be a claim nothing kept. A page tool is
     * this file's answer: the four remain the vocabulary this file OWNS, and
     * `TOOLS` is still the closed set of them, but `tool` may also name a
     * gesture the page brought.
     *
     * ⚠ `at(cell)` IS CALLED WITH THE CELL AND MAY DO ANYTHING — including
     * disarming itself, which is what a one-shot gesture (a template arm spends
     * a solve) does and what a brush must not. This file does not decide which:
     * a page tool that wants to be one-shot calls `setTool` from its own `at`.
     */
    tools = [],
    /**
     * ⛓⛓⛓ **THE PAGE'S OWN SHAPES** — EDITOR v3 D2, optional. `() => shape[]`,
     * merged into this file's own on every repaint and validated at the moment
     * they are produced.
     *
     * ⛔ **WHY THE PAGE NEEDED A DOOR AT ALL.** Seedling's set editor draws a
     * strip of rooms and the EXITS BETWEEN THEM — a picture that is neither the
     * substrate (the page's renderer draws the rooms) nor a selection (the view
     * draws that), and the only thing on the page that knows where the cells
     * land in pixels is this file. Left to the page it would have meant a THIRD
     * canvas stacked on the same two, aligned by a geometry copied from here.
     *
     * ⚠ It is a FUNCTION and not an array: the arrows change with every
     * `connect`, and a stored list would be the picture as it was at mount.
     */
    shapes: pageShapes = null,
    onChange = null,
    say = () => {},
    offRoom = () => 'that point is outside the level',
    lifetime,
    doc = globalThis.document,
    keyTarget = null,
    paint = null,
} = {}) {
    for (const [name, v, want] of [
        ['canvas', canvas, 'object'],
        ['session', session, 'object'],
        ['adapter', adapter, 'object'],
        ['cellAt', cellAt, 'function'],
        ['brushOp', brushOp, 'function'],
        ['floodTarget', floodTarget, 'function'],
        ['lifetime', lifetime, 'object'],
    ]) {
        // eslint-disable-next-line valid-typeof
        if (!v || typeof v !== want) {
            fail(`editorView: \`${name}\` must be a ${want}, got ${typeof v}. ⛔ Every one of `
                + 'them is the PAGE\'s — this file owns the tool, never the geometry, the '
                + 'palette or the substrate.');
        }
    }
    if (!isFn(session.apply) || !isFn(session.ops) || !isFn(session.record)) {
        fail('editorView: `session` must answer `apply` / `ops` / `record` — the shape '
            + '`editCore.createEditSession` returns. ⛔ It is the ONE home for the record and '
            + 'the op list, and a page that handed a plain bag here would be editing a copy '
            + 'nobody folds. ⚠ EDITOR v3 C1: a HOST may present that shape over its own '
            + 'store (Seedling\'s GENERATE arm folds through `watchEdit.editState` so its '
            + 'payload stays byte-identical), and that is the point — one tool, two hosts. '
            + 'What is refused is an object that does not answer the three.');
    }
    /**
     * ⛓ THE PAGE'S TOOLS, VALIDATED HERE so a malformed one refuses at MOUNT
     * rather than at the first click on it.
     */
    const pageTools = [...tools].map((t) => {
        if (!t || typeof t.id !== 'string' || !t.id || !isFn(t.at)) {
            fail(`editorView: a page tool must be {id, label, key?, at(cell)}, got `
                + `${JSON.stringify(t)}.`);
        }
        if (Object.values(TOOLS).includes(t.id)) {
            fail(`editorView: the page tool ${JSON.stringify(t.id)} shadows one of this `
                + `file's own four [${Object.values(TOOLS).join(', ')}] — refused by name `
                + 'rather than resolved by whichever list is walked last.');
        }
        return Object.freeze({ ...t });
    });
    const keys$ = keyTarget ?? doc;
    if (!keys$ || !isFn(keys$.addEventListener)) {
        fail('editorView: no keyboard target — pass `keyTarget` (or a `doc` that is a real '
            + 'document). ⛔ Refused rather than skipped: a mount that silently shipped no '
            + 'keys would report success and leave `Ctrl+Z` dead.');
    }

    /* ── THE ONE ARMED VALUE, AND THE CLIP ────────────────────────── */
    let tool = TOOLS.BRUSH;
    /** The first corner of a rectangle being dragged out, or `null`. */
    let corner = null;
    /** The clip a RECT copy produced — a clipboard, NOT an armed state. */
    let clip = null;
    /** The cells a brush drag has visited, in visit order, de-duplicated. */
    let stroke = null;
    /**
     * ⛓ SET BY A COMMITTED DRAG so the `click` that follows the release does
     * not paint the last cell a SECOND time. ⛔ The alternative — handling a
     * single press in the drag listener too — would make a plain click and a
     * one-cell drag two code paths for one gesture.
     */
    let swallowClick = false;

    /* ── THE OVERLAY ──────────────────────────────────────────────── */
    /**
     * ⛓ THE PAINTER. Injected in a test (which has no DOM at all — this
     * repo's vitest runs `environment: 'node'`), otherwise built here over an
     * overlay element this file creates and inserts beside the canvas.
     *
     * ⛔ IT REFUSES WHEN IT CAN DO NEITHER rather than skipping: a selection
     * rectangle nobody can see is a rectangle the person cannot tell from one
     * they never dragged.
     */
    /**
     * ⛓⛓⛓ **A POLYLINE, AND ITS HEADS** — EDITOR v3 D2.
     *
     * ⛔ THE HEAD IS DRAWN OFF THE LAST **SEGMENT**, not off the first-to-last
     * point: an elbowed arrow that took its direction from the whole span would
     * point at the target while arriving from somewhere else, and the picture's
     * whole job is to say which way the door goes.
     *
     * ⚠ A degenerate segment (two identical points — two rooms whose centres
     * coincide, which is what a one-room set does to a self-join) has NO
     * direction, so the head is omitted rather than drawn at an angle
     * `Math.atan2(0, 0)` invented.
     */
    const paintHead = (ctx, from, to) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (dx === 0 && dy === 0) return;
        const a = Math.atan2(dy, dx);
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(to.x, to.y);
            ctx.lineTo(
                to.x - ARROW_PX.length * Math.cos(a + side * ARROW_PX.spread),
                to.y - ARROW_PX.length * Math.sin(a + side * ARROW_PX.spread),
            );
            ctx.stroke();
        }
    };

    const paintPolyline = (ctx, s, px, py) => {
        const pts = s.points.map((p) => ({ x: p.x * px, y: p.y * py }));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        if (s.arrow) paintHead(ctx, pts[pts.length - 2], pts[pts.length - 1]);
        if (s.arrowBack) paintHead(ctx, pts[1], pts[0]);
        if (typeof s.label === 'string' && s.label !== '') {
            const mid = pts[Math.floor((pts.length - 1) / 2)];
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fillText(s.label, mid.x + 3, mid.y - 3);
        }
    };

    const overlay = (() => {
        if (isFn(paint)) return { paint, el: null };
        const parent = canvas.parentNode;
        if (!doc || !isFn(doc.createElement) || !parent || !isFn(parent.appendChild)) {
            fail('editorView: no way to draw the selection overlay — there is no `document` '
                + 'to create one with and no `paint` was injected. ⛔ Refused rather than '
                + 'skipped (⚖ the graceful-skip trap): a rectangle nobody can see cannot be '
                + 'told from one that was never dragged.');
        }
        const el = doc.createElement('canvas');
        el.className = 'editorViewOverlay';
        el.style.position = 'absolute';
        el.style.pointerEvents = 'none';
        el.style.left = '0';
        el.style.top = '0';
        parent.appendChild(el);
        return {
            el,
            paint(shapes) {
                const w = canvas.width ?? 0;
                const h = canvas.height ?? 0;
                if (el.width !== w) el.width = w;
                if (el.height !== h) el.height = h;
                el.style.width = `${canvas.clientWidth ?? w}px`;
                el.style.height = `${canvas.clientHeight ?? h}px`;
                const ctx = isFn(el.getContext) ? el.getContext('2d') : null;
                if (!ctx) return;
                ctx.clearRect(0, 0, el.width, el.height);
                const b = adapter.bounds(session.record());
                const px = el.width / b.w;
                const py = el.height / b.h;
                for (const s of shapes) {
                    ctx.save();
                    ctx.strokeStyle = s.kind === 'paste' || s.highlight ? '#7fe0ff' : '#ffd75f';
                    ctx.setLineDash(s.kind === 'paste' ? [4, 3] : []);
                    ctx.lineWidth = 2;
                    if (s.kind === 'polyline') paintPolyline(ctx, s, px, py);
                    else if (s.kind === 'rect' || s.kind === 'paste') {
                        ctx.strokeRect(s.x * px + 1, s.y * py + 1, s.w * px - 2, s.h * py - 2);
                    } else {
                        // ⛓ UNREACHABLE THROUGH `shapes()` (the merge asserts every
                        // shape before it is returned) and here anyway, so the ONE
                        // sentence about an unknown kind is this file's either way.
                        ctx.restore();
                        assertShape(s, 'the shape the painter was handed');
                    }
                    ctx.restore();
                }
            },
        };
    })();

    /**
     * ⛓ THE SHAPES THE OVERLAY DRAWS — derived, never stored.
     *
     * ⛓⛓ **AND THE PAGE MAY CONTRIBUTE** (EDITOR v3 D2). ⛔ The one-renderer
     * law SURVIVES this and that is the point of the shape: the view still owns
     * the overlay element, still clears it, still decides when to repaint — the
     * page hands over WHAT to draw, never a second surface to draw it on. A
     * page that had made its own overlay canvas would be back to two answers
     * about which pixels the selection lives in.
     *
     * ⛔ THE PAGE'S SHAPES COME **AFTER** the view's own, so a selection
     * rectangle is never buried under whatever the page contributed.
     */
    const shapes = () => {
        const out = [];
        if (corner) out.push({ kind: 'rect', x: corner.tx, y: corner.ty, w: 1, h: 1 });
        if (tool === TOOLS.PASTE && clip) {
            out.push({ kind: 'paste', x: 0, y: 0, w: clip.w, h: clip.h });
        }
        if (!pageShapes) return out;
        const extra = pageShapes();
        if (!Array.isArray(extra)) {
            fail('editorView: the injected `shapes` must return an ARRAY of shapes, got '
                + `${JSON.stringify(extra)}.`);
        }
        for (const s of extra) out.push(assertShape(s, 'a shape the page contributed'));
        return out;
    };
    const repaint = () => overlay.paint(shapes());

    /* ── APPLYING ─────────────────────────────────────────────────── */

    /**
     * ⛓⛓ **THE ONE PLACE AN OP REACHES THE SESSION.** Every tool lands here, so
     * the status sentence, the `onChange` hook and the overlay repaint happen
     * once per gesture and not once per tool.
     *
     * ⛔ THE SENTENCE IS THE CORE'S OR THE ADAPTER'S, VERBATIM — this file has
     * no paraphrase of a refusal, because a paraphrase is where the evidence
     * channel stops being evidence.
     */
    const applyOp = (op) => {
        let res;
        try {
            res = session.apply(op);
        } catch (e) {
            if (!(e instanceof EditCoreError)) throw e;
            res = Object.freeze({ ok: false, applied: false, description: e.message });
        }
        say(res.description, !res.ok);
        if (onChange) onChange({ session, result: res, tool, clip });
        repaint();
        return res;
    };

    /**
     * ⛓ A CORE CALL THAT **THROWS** ITS REFUSAL (`rectCopy`, `rectPasteOps`,
     * `floodOps` all do), turned into the same shape a refused op has. ⛔ The
     * message is not rewritten: an off-grid rectangle's sentence explains why
     * a copy refuses rather than clipping, and that is the reader's answer.
     */
    const tryCore = (what, fn) => {
        try {
            return { ok: true, value: fn() };
        } catch (e) {
            if (!(e instanceof EditCoreError)) throw e;
            say(e.message, true);
            if (onChange) {
                onChange({
                    session,
                    result: Object.freeze({ ok: false, applied: false, description: e.message }),
                    tool,
                    clip,
                });
            }
            return { ok: false, what };
        }
    };

    /* ── THE TOOLS ────────────────────────────────────────────────── */

    /**
     * ⛓⛓ **`brushOp` HAS THREE ANSWERS, NOT TWO** (EDITOR v3 C1):
     *
     *   an op        — apply it;
     *   `null`       — nothing is armed;
     *   `{refused}`  — the palette CANNOT build an op and says why.
     *
     * ⛔ THE THIRD ONE EXISTS BECAUSE THE FIRST TWO COLLAPSED A REAL
     * DISTINCTION. Seedling's PLACE brush parses a JSON attributes box, and an
     * unparseable box is not "no brush is armed" — reporting it as one is a
     * true sentence about the wrong subject (trap 598's family), and the reader
     * would go looking at the tool selector instead of at the box they just
     * typed in. ⚠ A THROW would have been the other spelling and is worse: a
     * substrate-agnostic file cannot tell the page's own refusal class from a
     * `TypeError`, so catching one means swallowing the other.
     */
    const opFromBrush = (c) => {
        const op = brushOp(c.tx, c.ty);
        if (!op) {
            say('no brush is armed — pick a palette entry first', true);
            return null;
        }
        if (typeof op.refused === 'string') {
            say(op.refused, true);
            return null;
        }
        return op;
    };

    const brushAt = (c) => {
        const op = opFromBrush(c);
        return op ? applyOp(op) : null;
    };

    const rectAt = (c) => {
        if (!corner) {
            corner = { tx: c.tx, ty: c.ty };
            say(`RECT corner 1 at (${c.tx},${c.ty}) — click the opposite corner`);
            repaint();
            return null;
        }
        const x = Math.min(corner.tx, c.tx);
        const y = Math.min(corner.ty, c.ty);
        const w = Math.abs(c.tx - corner.tx) + 1;
        const h = Math.abs(c.ty - corner.ty) + 1;
        corner = null;
        const got = tryCore('rectCopy', () => rectCopy(adapter, session.record(), {
            x, y, w, h,
        }));
        repaint();
        if (!got.ok) return null;
        clip = got.value;
        /**
         * ⛓⛓ §9.4's BOUNDS, PRINTED THE MOMENT THE CLIP EXISTS **AND AGAIN
         * BEFORE THE PASTE LANDS** — the page names them, this file only
         * guarantees they are said BEFORE rather than after or never.
         */
        const warn = clipWarnings(clip) ?? [];
        say(`copied ${w}x${h} at (${x},${y}) — press PASTE, then click where it goes`
            + (warn.length ? ` ⚠ ${warn.join(' ⚠ ')}` : ''), warn.length > 0);
        if (onChange) onChange({ session, result: null, tool, clip });
        return null;
    };

    const pasteAt = (c) => {
        if (!clip) {
            say('nothing to paste — arm RECT and drag out a rectangle first', true);
            return null;
        }
        const warn = clipWarnings(clip) ?? [];
        if (warn.length) say(`⚠ ${warn.join(' ⚠ ')}`, true);
        const built = tryCore('rectPasteOps', () => rectPasteOps(
            adapter, session.record(), clip, c.tx, c.ty, pasteOptions(),
        ));
        if (!built.ok) return null;
        return applyOp(built.value);
    };

    const floodAt = (c) => {
        const target = floodTarget(c.tx, c.ty);
        /**
         * ⛓ A PAGE THAT HAS NO TARGET HAS NOT ARMED A FLOOD. ⛔ Refused here
         * rather than passed on: `writeOps(null, …)` emits nothing and the
         * core's refusal would then be *"writeOps emitted nothing"*, which is a
         * true sentence about the wrong subject (⚠ trap 598's family).
         */
        if (!target || typeof target !== 'object') {
            say('FLOOD has no target — the page\'s palette selection does not name one', true);
            return null;
        }
        const built = tryCore('floodOps', () => floodOps(
            adapter, session.record(), c.tx, c.ty, target,
        ));
        if (!built.ok) return null;
        return applyOp(built.value);
    };

    const TOOL_FN = Object.freeze({
        [TOOLS.BRUSH]: brushAt,
        [TOOLS.RECT]: rectAt,
        [TOOLS.PASTE]: pasteAt,
        [TOOLS.FLOOD]: floodAt,
        // ⛓ The page's, in the same table — so the canvas listener's dispatch
        // has ONE shape and `setTool`'s vocabulary has ONE source.
        ...Object.fromEntries(pageTools.map((t) => [t.id, (c) => t.at(c)])),
    });

    /* ── THE COMMAND TABLE, AND THE KEY MAP AS A VIEW OF IT ───────── */

    const TOOL_IDS = Object.freeze([...Object.values(TOOLS), ...pageTools.map((t) => t.id)]);
    const setTool = (t) => {
        if (t !== null && !TOOL_IDS.includes(t)) {
            fail(`editorView: unknown tool ${JSON.stringify(t)} — the vocabulary is `
                + `[${TOOL_IDS.join(', ')}] (this file's four, plus the page's).`);
        }
        tool = t;
        corner = null;
        stroke = null;
        repaint();
        if (onChange) onChange({ session, result: null, tool, clip });
    };

    const OWN = [
        ...TOOL_ROWS.map((r) => Object.freeze({
            id: r.id, label: r.label, key: r.key, run: () => { setTool(r.tool); },
        })),
        // ⛓ A page tool gets a command row too, so the key map and every button
        // stay a VIEW of ONE table — including the page's own gestures.
        ...pageTools.map((t) => Object.freeze({
            id: t.id, label: t.label ?? t.id, key: t.key, run: () => { setTool(t.id); },
        })),
        Object.freeze({
            id: 'escape',
            label: 'CLEAR the armed tool',
            key: 'Escape',
            /**
             * ⛔ **THE SENTENCE FIRST, THEN THE CLEAR** — EDITOR v3 C1, and the
             * order is the contract. `setTool` fires `onChange`, and a page that
             * wants to name WHAT was disarmed (*"AT… cancelled — nothing was
             * placed"*) can only do it from there, one draw behind. With the
             * clear first this file's generic line landed AFTER the page's
             * specific one and overwrote it — measured, as a browser gate
             * failure reading *"nothing is armed — pick a tool"* where the row
             * expected *"cancelled"*. ⚠ Saying it before it is true is this
             * page family's own law anyway: a control says what a press will DO.
             */
            run: () => {
                say('nothing is armed — pick a tool');
                setTool(null);
            },
        }),
    ];
    /**
     * ⛔ THE PAGE'S ROWS COME FIRST so a page may not silently shadow a tool
     * key: a duplicate is REFUSED BY NAME below rather than resolved by
     * whichever list happened to be walked last.
     */
    const table = Object.freeze([...commands, ...OWN].map((row) => {
        if (!row || typeof row.id !== 'string' || !row.id || !isFn(row.run)) {
            fail(`editorView: a command row must be {id, label, run}, got `
                + `${JSON.stringify(row)}.`);
        }
        return Object.freeze({ ...row });
    }));
    const byId = new Map();
    for (const row of table) {
        if (byId.has(row.id)) {
            fail(`editorView: two commands share the id ${JSON.stringify(row.id)} — the key `
                + 'map and every button are a VIEW of this table, so a duplicate id is two '
                + 'answers to one press.');
        }
        byId.set(row.id, row);
    }
    const keys = new Map();
    for (const row of table) {
        if (!row.key) continue;
        if (keys.has(row.key)) {
            fail(`editorView: the key ${JSON.stringify(row.key)} is claimed by both `
                + `${JSON.stringify(keys.get(row.key).id)} and ${JSON.stringify(row.id)}. ⛔ `
                + 'Refused rather than resolved by order: a shadowed binding is a control the '
                + 'help text still advertises.');
        }
        keys.set(row.key, row);
    }
    const run = (id) => {
        const row = byId.get(id);
        if (!row) {
            fail(`editorView: no command ${JSON.stringify(id)} — the table holds `
                + `[${[...byId.keys()].join(', ')}].`);
        }
        return row.run();
    };

    /* ── THE LISTENERS ────────────────────────────────────────────── */

    const cellOf = (event) => {
        const c = cellAt(event);
        if (c && Number.isInteger(c.tx) && Number.isInteger(c.ty)) return c;
        return null;
    };

    lifetime.on(canvas, 'click', (event) => {
        if (swallowClick) { swallowClick = false; return; }
        if (tool === null) {
            say('nothing is armed — pick a tool (Escape cleared it)', true);
            return;
        }
        const c = cellOf(event);
        if (!c) { say(offRoom(tool), true); return; }
        TOOL_FN[tool](c);
    });

    /**
     * ⛓⛓ THE DRAG. ⛔ BRUSH ONLY: rect, paste and flood are point gestures, and
     * a drag that armed them would make "click the opposite corner" mean two
     * different things depending on how long a button was held.
     */
    lifetime.on(canvas, 'mousedown', (event) => {
        if (tool !== TOOLS.BRUSH) return;
        const c = cellOf(event);
        stroke = c ? { cells: [c], seen: new Set([`${c.tx},${c.ty}`]) } : { cells: [], seen: new Set() };
    });
    lifetime.on(canvas, 'mousemove', (event) => {
        if (!stroke) return;
        const c = cellOf(event);
        if (!c) return;
        const k = `${c.tx},${c.ty}`;
        if (stroke.seen.has(k)) return;
        stroke.seen.add(k);
        stroke.cells.push(c);
    });
    /**
     * ⛓ THE RELEASE IS LISTENED FOR ON THE **KEY TARGET** (the document), not
     * on the canvas: a stroke that ran off the edge would otherwise never
     * commit, and the next press would extend a stroke the person thought had
     * ended.
     */
    lifetime.on(keys$, 'mouseup', () => {
        const s = stroke;
        stroke = null;
        if (!s || s.cells.length < 2) return;
        /**
         * ⛓⛓⛓ **ONE GROUP FOR THE WHOLE STROKE** — the claim this file exists
         * to keep. ⛔ Not `s.cells.map(apply)`: N ops would need N undos and
         * `describeOps` would report a history with N presses in it.
         */
        const built = s.cells.map((c) => brushOp(c.tx, c.ty));
        // ⛓ A REFUSAL ANYWHERE ABORTS THE WHOLE STROKE and says why, on the
        // core's own all-or-nothing law: a stroke that dropped its refused
        // cells would commit a gesture the reader did not make.
        const refusal = built.find((o) => o && typeof o.refused === 'string');
        if (refusal) { say(refusal.refused, true); return; }
        const ops = built.filter(Boolean);
        if (ops.length === 0) {
            say('no brush is armed — pick a palette entry first', true);
            return;
        }
        swallowClick = true;
        applyOp(group(`stroke of ${ops.length} cell(s)`, ops));
    });

    lifetime.on(keys$, 'keydown', (event) => {
        /**
         * ⛓⛓ `Ctrl/Cmd+Z` IS A VIEW OF THE TABLE TOO — it resolves to the row
         * the page registered under `undo`, and if the page registered none the
         * key simply is not bound. ⛔ No private undo here: the session's undo
         * is the fold over a shorter list and the page's row is what re-renders
         * around it.
         */
        if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'z') {
            const row = byId.get(UNDO_COMMAND_ID);
            if (!row) return;
            if (isFn(event.preventDefault)) event.preventDefault();
            row.run();
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const row = keys.get(event.key) ?? keys.get(String(event.key).toLowerCase());
        if (!row) return;
        if (isFn(event.preventDefault)) event.preventDefault();
        row.run();
    });

    repaint();

    return {
        get tool() { return tool; },
        get clip() { return clip; },
        get corner() { return corner; },
        setTool,
        /**
         * ⛓⛓⛓ **REPAINT THE OVERLAY, ON DEMAND — EDITOR v3 E3a, ADDITIVE.**
         *
         * ⛔ **A SHIPPED DEFECT IS WHY THIS KEY EXISTS** (§23.11 #5, found by
         * `check-seedling-editor-arm`'s first run on real data). This file
         * paints ONCE at mount and then only from its own gestures. A HOST that
         * sizes the target canvas AFTER mount — which is exactly what
         * `setEditorView`'s `paintStrip` does, and what `watch.html`'s
         * `width="1" height="1"` strip forces it to do — left the overlay at
         * 1×1 with 0 ink, holding a picture of an EMPTY rows list, until the
         * first gesture happened to repaint it. MEASURED on the vanilla 116:
         * strip 2088×132 with 181,674 ink, overlay 1×1 with 0.
         *
         * ⛔ The host's only door until now was `setTool`, which also CLEARS
         * `corner` and `stroke` and fires `onChange` — a half-armed two-click
         * gesture and a re-entrant render, in exchange for a repaint. This is
         * the repaint alone: it asks `shapes()` again and paints, and touches
         * no state at all.
         *
         * ⛓ NOTHING READS THIS SURFACE'S KEY SET (measured before it grew: no
         * `Object.keys`, no spread, no `for…in` over a mount result anywhere in
         * the repo, and no row pins the roster), so a sixth key is additive.
         */
        repaint,
        commands: table,
        keys,
        run,
        /**
         * ⛓⛓ **A CONTROL THAT IS NOT A GESTURE, APPLYING THROUGH THE ONE
         * PATH** — EDITOR v3 C2, ADDITIVE.
         *
         * ⛔ Seedling's room-flags form and its resize control are FORMS: they
         * build an op from typed inputs and a press, with no cell and no
         * canvas click, so no `tool` can carry them. Left to call
         * `session.apply` themselves they would each need their own copy of
         * *"say the description, tell the host, repaint"* — three copies of the
         * one sequence that makes an applied op visible, and the first one to
         * drift would be a page whose readout and canvas disagreed about what
         * had happened. ⇒ the sequence stays here and the door is opened.
         *
         * ⚠ It is NOT a second `session`: the record and the op list are still
         * the host's, and this is `applyOp` — the same function every gesture
         * above already goes through.
         */
        apply: applyOp,
        /** ⛓ WHAT A READOUT PRINTS — `describeOps` over the session's own list. */
        describe: () => describeOps(session.ops()),
        /**
         * ⛓ RETIRING THE LIFETIME IS WHAT DETACHES EVERY LISTENER (they were
         * all registered through it), so `destroy` only has the overlay left to
         * take down. ⛔ The lifetime is NOT retired here: it is the PAGE's, it
         * outlives this mount, and retiring somebody else's arm would take the
         * page's own listeners with it.
         */
        destroy() {
            corner = null;
            stroke = null;
            clip = null;
            if (overlay.el?.parentNode?.removeChild) {
                overlay.el.parentNode.removeChild(overlay.el);
            }
        },
    };
}
