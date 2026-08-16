/**
 * mazeRoom/mazeElementOverlay — **THE GADGET, DRAWN OVER THE GRID.**
 *
 * PROCGEN ELEMENTS arc 2, slice 4 (`NewDocs/plans/procgen-elements-arc2-
 * kickoff.md` §3.4 / §10.11.1, §10.11.6): the site outlined, the TUNNEL shaded
 * distinctly from the carve, the block, the button, the guard door, the flag
 * and the two ports — and, while a SOLVE is being replayed, **the block where
 * `state.blocks` says it is**, not where the level started it.
 *
 * ── ⛓⛓⛓ WHY THIS IS A **SIBLING** OF `drawWorld` — ⚖ Q5, ANSWERED ────
 *
 * The slice was offered both: extend `drawWorld`'s item/obstacle paths, or draw
 * beside it. The sibling was taken, for the reason `mazeAreaOverlay.js` took it
 * one arc earlier and for one more that is this arc's own:
 *
 * 1. **`drawWorld`'s `view` IS THE WHOLE INPUT and every field is a fact about
 *    how to PRESENT THE WORLD IT WAS HANDED.** A gadget's SITE, its PORTS and
 *    its TUNNEL are facts about the MODEL that produced the world — the panel,
 *    the renderer's other caller, has no model at all and would have to pass
 *    `elements: null` forever to say so.
 * 2. **THE MOVING BLOCK IS *STATE*, NOT WORLD.** `world.blocks` is the level's
 *    INITIAL layout; during a replay the live positions are `state.blocks`, and
 *    a renderer whose contract is "draw this world" has no honest place to put
 *    them. Here they arrive as `view.blocks` and the world's own layout is the
 *    fallback — one function, two truths, and which one is being drawn is
 *    visible in the argument.
 * 3. **IT IS THE CHEAPER CLAIM TO MAKE AND TO CHECK.** `mazeRoomRender.test.js`
 *    gates the panel's draw with SEVEN op-log hashes captured at `868c39266`.
 *    Extending `drawWorld` would expire every one of them and the re-capture
 *    would come out of the code under test — a fixed point (trap 250). As a
 *    sibling those seven stay byte-identical (asserted) and this file brings its
 *    own op-log fixture for its own ops.
 *
 * ── ⛓⛓ THE TUNNEL IS SHADED, AND THAT IS §10.11.6's REQUIREMENT ──────
 *
 * The connector digs up to **28 cells** to reach the entry port. A reader who
 * cannot tell that corridor from the backend's carve will read a 28-cell
 * straight run as an artefact of the maze algorithm. So the tunnel gets its own
 * hue, its own translucent fill AND a dashed outline per cell — three signals,
 * because the level underneath it is already dark floor and one would do only
 * on a screenshot somebody was already looking for it in.
 *
 * ── ⛔ NOTHING IS LABELLED PER CELL ───────────────────────────────────
 *
 * Arc 1's rule, unchanged: the canvas carries SHAPE and COLOUR, and every
 * symbol is named exactly once in the page's LEGEND (`elementLegend`, which is
 * also in the readout). This file draws no text at all.
 *
 * ── THE LAYER ─────────────────────────────────────────────────────────
 *
 * It rides `mazeAreaOverlay`'s ONE layer control rather than growing a second
 * stepper. ⛔ `off` draws NOTHING (the level exactly as `drawWorld` left it,
 * which is what that word already means on this page); every other layer draws
 * the gadget WHOLE. A gadget is a handful of cells and every one of them —
 * site, tunnel, block, button, door, flag, ports — is needed to read the
 * puzzle, so layering it would hide half a mechanism rather than half a graph.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: this is on the lab page's path and in a node
 * unit runner.
 */

export class ElementOverlayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ElementOverlayError';
    }
}

const fail = (message) => { throw new ElementOverlayError(message); };

export const ELEMENT_COLORS = Object.freeze({
    /** The reserved rectangle — the cells the carve's answer was discarded in. */
    site: '#ff8fd0',
    /** ⛓ The connector's dig. Its OWN hue, §10.11.6. */
    tunnel: '#8f6bff',
    block: '#c8a06a',
    blockEdge: '#2a1c0c',
    /** A button that is PRESSED is filled; one that is not is a ring. */
    button: '#ffd75f',
    door: '#b07f3f',
    flag: '#e0c07f',
    portEntry: '#7fd88f',
    portExit: '#ff9a6a',
});

/** The fields this draw reads. Named, so a caller cannot forget one silently. */
export const ELEMENT_VIEW_FIELDS = Object.freeze(['tilePx', 'layer', 'blocks']);

export function assertElementView(view) {
    if (!view || typeof view !== 'object') {
        fail('mazeElementOverlay: drawElementOverlay needs a view object '
            + `(fields: ${ELEMENT_VIEW_FIELDS.join(', ')}).`);
    }
    for (const key of ELEMENT_VIEW_FIELDS) {
        if (!(key in view)) {
            fail(`mazeElementOverlay: the view is missing "${key}". ⛔ A default here would be `
                + 'a picture this file chose under the caller\'s name — the same law '
                + '`mazeRoomRender.assertView` and `mazeAreaOverlay.assertOverlayView` state. '
                + '⚠ `blocks: null` is how "draw the level\'s own layout" is spelled, and it '
                + 'is a DIFFERENT statement from "the replay is at frame 0".');
        }
    }
    if (!(typeof view.tilePx === 'number' && view.tilePx > 0)) {
        fail('mazeElementOverlay: view.tilePx must be a positive number of canvas pixels.');
    }
    if (view.blocks !== null && !Array.isArray(view.blocks)) {
        fail(`mazeElementOverlay: view.blocks must be an array of "x,y" position keys or null, `
            + `got ${JSON.stringify(view.blocks)}. It is \`state.blocks\` — the engine's own `
            + 'sorted posKey array — because the replay hands this file the LIVE layout and '
            + 'the world only knows the initial one.');
    }
    return view;
}

/** `"3,4"` → `{x:3, y:4}`. The engine's posKey, read back. */
const cellOf = (key) => {
    const [x, y] = String(key).split(',').map(Number);
    return { x, y };
};

/**
 * ⛓⛓⛓ THE DRAW. ⛔ **ZERO OPS** when there is nothing to draw — `layer: 'off'`,
 * no element block, or an element that REFUSED — and that is asserted rather
 * than assumed: a page whose gadget was refused shows the level exactly as
 * `drawWorld` painted it, and the reason goes in the page's own refusal box
 * where a reader can read it (§10.11.5: most seeds refuse, and that is honest).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object|null} elements  `model.elements` — `{spec, ran, placed[], refused}`
 * @param {{tilePx:number, layer:string, blocks:string[]|null}} view
 *   `blocks` = the LIVE `state.blocks` during a solve replay; `null` = draw the
 *   level's own initial layout (each placement's `block`).
 */
export function drawElementOverlay(ctx, elements, view) {
    const v = assertElementView(view);
    if (v.layer === 'off') return;
    if (!elements?.ran || !(elements.placed ?? []).length) return;
    const px = v.tilePx;

    /* ── THE SITE — one outline per gadget, over the reserved rectangle ── */
    ctx.save();
    ctx.strokeStyle = ELEMENT_COLORS.site;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.75;
    for (const p of elements.placed) {
        ctx.strokeRect(p.site.x * px + 0.5, p.site.y * px + 0.5,
            p.site.w * px - 1, p.site.h * px - 1);
    }
    ctx.restore();

    /* ── THE TUNNEL — the connector's dig, NOT the backend's carve ────── */
    ctx.save();
    for (const p of elements.placed) {
        for (const c of p.tunnel ?? []) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = ELEMENT_COLORS.tunnel;
            ctx.fillRect(c.x * px, c.y * px, px, px);
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = ELEMENT_COLORS.tunnel;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(c.x * px + 1.5, c.y * px + 1.5, px - 3, px - 3);
            ctx.setLineDash([]);
        }
    }
    ctx.restore();

    /* ── THE PORTS — a stub on the site edge, pointing OUTWARD ────────── */
    ctx.save();
    ctx.lineWidth = 3;
    for (const p of elements.placed) {
        for (const port of p.ports ?? []) {
            ctx.strokeStyle = port.role === 'entry'
                ? ELEMENT_COLORS.portEntry : ELEMENT_COLORS.portExit;
            ctx.beginPath();
            ctx.moveTo(port.x * px + px / 2, port.y * px + px / 2);
            const d = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[port.dir];
            ctx.lineTo(port.x * px + px / 2 + d[0] * px * 0.55,
                port.y * px + px / 2 + d[1] * px * 0.55);
            ctx.stroke();
        }
    }
    ctx.restore();

    /* ── THE GUARD DOOR and THE FLAG ──────────────────────────────────── */
    ctx.save();
    ctx.lineWidth = 2;
    for (const p of elements.placed) {
        ctx.strokeStyle = ELEMENT_COLORS.door;
        ctx.strokeRect(p.door.x * px + 1, p.door.y * px + 1, px - 2, px - 2);
        /**
         * ⛓ A PENNANT, not a ring: the flag is the LATCH the whole gadget
         * exists to guard, and it must not read as one more key circle —
         * `drawWorld` already drew the item beneath this.
         */
        ctx.strokeStyle = ELEMENT_COLORS.flag;
        ctx.beginPath();
        ctx.moveTo(p.flagCell.x * px + px * 0.3, p.flagCell.y * px + px * 0.8);
        ctx.lineTo(p.flagCell.x * px + px * 0.3, p.flagCell.y * px + px * 0.2);
        ctx.lineTo(p.flagCell.x * px + px * 0.75, p.flagCell.y * px + px * 0.38);
        ctx.lineTo(p.flagCell.x * px + px * 0.3, p.flagCell.y * px + px * 0.56);
        ctx.stroke();
    }
    ctx.restore();

    /* ── ⛓⛓⛓ THE BUTTON AND THE BLOCK — THE ONLY PARTS THAT MOVE ──────
     *
     * `view.blocks` is `state.blocks` when a solve is being replayed, so the
     * block is drawn WHERE THE PLAYER HAS PUSHED IT and the button reads HELD
     * exactly when one of them is standing on it. ⛔ With `blocks: null` the
     * placement's own `block` is used, which is the level as generated.
     */
    const live = v.blocks === null ? null : new Set(v.blocks);
    ctx.save();
    for (const p of elements.placed) {
        const held = live === null
            ? `${p.button.x},${p.button.y}` === `${p.block.x},${p.block.y}`
            : live.has(`${p.button.x},${p.button.y}`);
        ctx.strokeStyle = ELEMENT_COLORS.button;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.button.x * px + px / 2, p.button.y * px + px / 2, px * 0.28, 0, Math.PI * 2);
        if (held) {
            ctx.fillStyle = ELEMENT_COLORS.button;
            ctx.fill();
        }
        ctx.stroke();
    }
    const drawn = live === null
        ? elements.placed.map((p) => ({ x: p.block.x, y: p.block.y }))
        : [...live].map(cellOf);
    ctx.fillStyle = ELEMENT_COLORS.block;
    ctx.strokeStyle = ELEMENT_COLORS.blockEdge;
    ctx.lineWidth = 2;
    for (const c of drawn) {
        ctx.fillRect(c.x * px + px * 0.15, c.y * px + px * 0.15, px * 0.7, px * 0.7);
        ctx.strokeRect(c.x * px + px * 0.15, c.y * px + px * 0.15, px * 0.7, px * 0.7);
    }
    ctx.restore();
}

/**
 * ⛓⛓ THE LEGEND, AS DATA — one row per PLACED GADGET plus, when the element
 * machinery ran and produced nothing, one REFUSAL row carrying the binding's
 * own sentence VERBATIM.
 *
 * ⛔ It is derived from `model.elements` alone, so the page cannot show a
 * gadget the run did not place; and ⛔ the refusal row exists because §10.11.5
 * is the honest state of this page — `guard;len=3;turns=1` at 15x15 places on
 * ~38% of seeds and GUARDS on ~7%, so a legend that only ever described a
 * SUCCESS would be blank on most seeds with nothing to say why.
 */
export function elementLegend(elements) {
    if (!elements || elements.spec?.name === 'none') return Object.freeze([]);
    if (!elements.ran) {
        return Object.freeze(elements.refused ? [Object.freeze({
            kind: 'refused',
            reason: elements.refused.reason,
            detail: elements.refused.detail,
        })] : []);
    }
    return Object.freeze((elements.placed ?? []).map((p) => Object.freeze({
        kind: 'placed',
        element: p.element,
        instance: p.instance,
        index: p.index,
        /** ⛓ The three per-instance ids, so a reader can find them in the level. */
        button: p.button.id,
        door: p.door.id,
        hold: p.ids?.hold ?? null,
        /** ⛓ WHICH SYMBOL THIS GADGET GUARDS, or `null` — ⚖ ruling 1's own
         *  question, and the census says it is `null` about six times in seven
         *  at `binds=any`. `null` is reported, never smoothed into "no". */
        guards: p.guards ?? null,
        cost: p.cost,
        tunnelCells: (p.tunnel ?? []).length,
        siteCells: p.site.w * p.site.h,
        color: ELEMENT_COLORS.site,
    })));
}
