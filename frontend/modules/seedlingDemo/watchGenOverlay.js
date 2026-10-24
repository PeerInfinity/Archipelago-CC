/**
 * seedlingDemo/watchGenOverlay — **THE GENERATION OVERLAYS, DRAWN OVER THE
 * SEEDLING RENDERER AS SIBLINGS.**
 *
 * PROCGEN ELEMENTS arc 3, slice 5a (D5), and it is the maze lab's own pattern
 * one substrate over (`mazeRoom/mazeAreaOverlay.js` + `mazeElementOverlay.js`,
 * arc-1 §3.6 / arc-2 §11.1).
 *
 * ── ⛓⛓⛓ WHY A SIBLING AND NOT A RENDERER LAYER ────────────────────────
 *
 * `watchViewer.makeRenderer(canvas).draw(world, state, opts)` presents A WORLD:
 * every field of `opts` says how to draw the level it was handed, and
 * `OVERLAY_LAYERS` (`watchOverlays.js`) is a vocabulary of RUN facts — samples,
 * markers, presses, danger. A site class, an element's reserved rectangle and
 * an area partition are facts about the MODEL that produced the world, and the
 * renderer's other callers (SOLVE, MANUAL, the tape scrub) have no model at
 * all. Extending the renderer would also expire the world row's `drawn.*`
 * readouts, which are a gate. ⇒ this file draws AFTER `renderer.draw`, on the
 * same canvas, and `makeRenderer.draw` and `OVERLAY_LAYERS` are untouched.
 *
 * ── ⛓⛓⛓ THE DATA IS THE PICTURE'S ARGUMENT ────────────────────────────
 *
 * `genOverlaysFor(model, {layer, phase})` is PURE DATA and `drawGenOverlay`
 * takes exactly that object. `window.__editorGenerate.overlays` is the SAME
 * object the draw consumed, so a browser row asserting a cell list is asserting
 * something about the canvas rather than about a readout beside it (arc-2
 * §11.2's law: `overlayBlocks()` is ONE function called by the draw and by the
 * readout; two functions would let the picture be wrong while the readout
 * stayed right, which is the echo/value split inside one page).
 *
 * ── THE LAYERS, CUMULATIVE ───────────────────────────────────────────
 *
 *   `off`       nothing at all
 *   `sites`     every SITE class hue-coded from `model.sites` (main, bend,
 *               branch, tip, chamber, corridor). ⛓ `any` draws nothing: it is
 *               the whole interior, and shading the room says nothing.
 *   `elements`  + the element's geometry from `model.elements`
 *   `areas`     + the partition, its synthetic/vestibule areas DASHED, the
 *               boundary locks and the flags
 *   `all`       everything above
 *
 * ⛔ **A DROPPED ELEMENT DRAWS NOTHING** and says so in the LEGEND. The
 * geometry a refused certification measured is carried on
 * `certification.geometry` (arc-3 §10.8) precisely so the CENSUS numbers
 * survive the drop — but the level that SHIPPED does not contain it, and a
 * picture that read that field would draw a gadget nobody can walk into.
 *
 * ⛔ **NOTHING IS LABELLED ON THE CANVAS.** Arc-1's rule: the symbols are named
 * once each in the page's LEGEND and the canvas carries only colour, so the op
 * stream stays short enough to read and a 10x10 room does not become a wall of
 * three-character strings. Zero `fillText` in this file.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: this is on the page's path and in a node unit
 * runner.
 */

export class GenOverlayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GenOverlayError';
    }
}

const fail = (message) => { throw new GenOverlayError(message); };

/** ⛓ THE LAYERS, in the order the page steps through them. */
export const GEN_LAYERS = Object.freeze(['off', 'sites', 'elements', 'areas', 'all']);

export const genLayerRank = (layer) => GEN_LAYERS.indexOf(layer);

/**
 * ⛓ THE SITE CLASSES, and a hue each. ⛔ `chambers` is NOT here: it is
 * `chamber`'s own decomposition (`sites.js`: *"the cells of `chambers`,
 * flattened. ⛓ ONE derivation"*) and drawing both would paint one cell twice
 * and count it twice in the legend.
 */
export const SITE_COLORS = Object.freeze({
    main: 'hsl(200, 70%, 55%)',
    bend: 'hsl(280, 60%, 60%)',
    branch: 'hsl(45, 75%, 55%)',
    tip: 'hsl(15, 75%, 55%)',
    chamber: 'hsl(120, 45%, 45%)',
    corridor: 'hsl(0, 0%, 60%)',
});

export const ELEMENT_COLORS = Object.freeze({
    reserved: '#ff8fd0',
    site: '#ffd75f',
    tunnel: '#8f6bff',
    door: '#ffd75f',
    clearer: '#7fe0ff',
    wall: '#c86464',
    carved: '#64c8a0',
    block: '#ffffff',
    button: '#7fe0ff',
    flag: '#9fff9f',
    flagLock: '#ff9f5f',
    demand: '#ff5f5f',
});

export const AREA_COLORS = Object.freeze({
    lock: '#ffd75f',
    flag: '#9fff9f',
    synthetic: '#9a9aa8',
});

export const areaHue = (index) => `hsl(${(index * 47) % 360}, 45%, 45%)`;

/** ⛓ The generic painter's own hue — ⚖ the 2026-08-18 ruling: the picture is
 *  SELECTION-driven, so one hue plus the pick outlined is enough. */
export const PAINTABLE_COLOR = '#ffd75f';
export const PAINTABLE_PICK_COLOR = '#ffffff';

export const GEN_VIEW_FIELDS = Object.freeze(['tilePx']);

export function assertGenView(view) {
    if (!view || typeof view !== 'object') {
        fail(`watchGenOverlay: drawGenOverlay needs a view object (fields: ${
            GEN_VIEW_FIELDS.join(', ')}).`);
    }
    if (!(typeof view.tilePx === 'number' && view.tilePx > 0)) {
        fail('watchGenOverlay: view.tilePx must be a positive number of canvas pixels. ⛔ No '
            + 'default: a picture this file chose under the caller\'s name is the defect '
            + '`mazeRoomRender.assertView` states.');
    }
    return view;
}

/** One drawn thing. ⛔ `style` is the whole draw vocabulary — see `drawGroup`. */
const group = (id, label, color, style, cells, note = null) => Object.freeze({
    id,
    label,
    color,
    style,
    cells: Object.freeze(cells.map((c) => Object.freeze({ x: c.x ?? c.tx, y: c.y ?? c.ty }))),
    count: cells.length,
    note,
});

const rectCells = (r) => {
    const out = [];
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) out.push({ x, y });
    return out;
};

/**
 * ⛓⛓⛓ **THE DATA.** Pure, node-testable, and it is what the draw consumes.
 *
 * @param {object|null} model  a `seedlingModel` — `sites`, `elements`,
 *   `areas`, `areaPartition()` and (slice 5a) `elementDemand()`
 * @param {object} o
 * @param {string} o.layer  one of `GEN_LAYERS`
 * @param {number|null} [o.phase]  a LEDGER INDEX. A group is included only when
 *   the phase that produced it has already run — so stepping back before the
 *   carve does not paint sites the room did not have yet. `null` is the
 *   FINISHED model, which is what the page shows when it is not stepping.
 */
export function genOverlaysFor(model, { layer = 'off', phase = null } = {}) {
    if (!GEN_LAYERS.includes(layer)) {
        fail(`watchGenOverlay: layer ${JSON.stringify(layer)} is not one of `
            + `[${GEN_LAYERS.join(', ')}].`);
    }
    const empty = Object.freeze({
        layer, phase, groups: Object.freeze([]), legend: Object.freeze([]),
        counts: Object.freeze({ sites: 0, elements: 0, areas: 0 }), notes: Object.freeze([]),
    });
    if (layer === 'off' || !model) return empty;
    const rank = genLayerRank(layer);
    const rows = model.ledger ?? [];
    /**
     * ⛔ WHICH PHASE PRODUCED WHICH GROUP, ASKED OF THE LEDGER RATHER THAN OF A
     * CONSTANT LIST (trap 357). A ledger with no row of that name answers
     * `Infinity`, so the group is drawn only on the FINISHED model — which is
     * the honest answer for a build with recording disabled.
     */
    const rowIndexOf = (name) => {
        const i = rows.findIndex((r) => r.phase === name);
        return i < 0 ? Infinity : i;
    };
    const ran = (name) => phase === null || phase >= rowIndexOf(name);

    const groups = [];
    const notes = [];

    /* ── SITES ──────────────────────────────────────────────────────── */
    let siteCells = 0;
    if (rank >= genLayerRank('sites') && ran('carve')) {
        const sites = model.sites ?? {};
        for (const [cls, color] of Object.entries(SITE_COLORS)) {
            const raw = sites[cls] ?? [];
            /** ⛓ `branch` is a list of `{mouth,dir,length,cells}` STUBS; every
             *  other class is a flat cell list. ONE reader for both. */
            const cells = cls === 'branch' ? raw.flatMap((b) => b.cells ?? []) : raw;
            if (!cells.length) continue;
            groups.push(group(`site:${cls}`, `site ${cls}`, color, 'fill', cells));
            siteCells += cells.length;
        }
    }

    /* ── ELEMENTS ───────────────────────────────────────────────────── */
    let elementCells = 0;
    if (rank >= genLayerRank('elements')) {
        const e = model.elements ?? null;
        if (e && !e.ran && e.refused) {
            /** ⛔ A DROPPED OR REFUSED ELEMENT DRAWS NOTHING. The reason is a
             *  LEGEND row, never a picture — see the file docblock. */
            notes.push(`the element REFUSED: ${e.refused.reason} — ${e.refused.detail}`);
        } else if (e && e.ran && ran('composite')) {
            const p = e.placed[0];
            const add = (id, label, color, style, cells, note = null) => {
                if (!cells || !cells.length) return;
                groups.push(group(id, label, color, style, cells, note));
                elementCells += cells.length;
            };
            if (p.phase === 'on-connector') {
                add('element:door', `${p.instance} door cell(s)`, ELEMENT_COLORS.door,
                    'outline', p.doorCells ?? [p.doorCell]);
                add('element:clearer', 'the door\'s CLEARER', ELEMENT_COLORS.clearer,
                    'ring', p.clearer ?? []);
                add('element:wall', 'wall the element GREW', ELEMENT_COLORS.wall,
                    'fill', p.wall ?? []);
                add('element:carved', 'the POCKET it carved', ELEMENT_COLORS.carved,
                    'fill', p.carved ?? []);
            } else {
                const site = p.site;
                add('element:reserved', 'the RESERVED rectangle (site + its ring)',
                    ELEMENT_COLORS.reserved, 'outline',
                    rectCells({ x: site.x - 1, y: site.y - 1, w: site.w + 2, h: site.h + 2 }));
                add('element:site', 'the element\'s SITE', ELEMENT_COLORS.site, 'outline',
                    rectCells(site));
                /** ⛓ §10.11.6: the tunnel is drawn FILLED **and** dash-outlined —
                 *  the level under it is already dark floor, so one signal is
                 *  not enough to read it as a tunnel. */
                add('element:tunnel', 'the entry TUNNEL (filled and dashed)',
                    ELEMENT_COLORS.tunnel, 'fill+dash', p.tunnel ?? []);
                add('element:block', 'the BLOCK', ELEMENT_COLORS.block, 'square',
                    p.block ? [p.block] : []);
                add('element:button', 'its BUTTON', ELEMENT_COLORS.button, 'ring',
                    p.button ? [p.button] : []);
                add('element:door', 'the guard DOOR', ELEMENT_COLORS.door, 'outline',
                    p.door ? [p.door] : []);
                add('element:flag', 'the FLAG (buttonroom)', ELEMENT_COLORS.flag, 'pennant',
                    p.flagCell ? [p.flagCell] : []);
                add('element:flagLock', 'the flag\'s LOCK', ELEMENT_COLORS.flagLock, 'outline',
                    p.flagLockCell ? [p.flagLockCell] : []);
            }
            /**
             * ⛓⛓ THE DEMAND (arc 3, slice 4d) — the REGION the element's body
             * moves in plus the walls that keep it there. ⛔ It is read from
             * `model.elementDemand()` and NOT from the placement, because
             * §15.13's false mover put it on `placed` once and it reached the
             * payload through `certification.geometry`.
             */
            const demand = model.elementDemand ? model.elementDemand() : [];
            add('element:demand', 'the element\'s DEMAND region', ELEMENT_COLORS.demand,
                'dash', demand,
                demand.length ? 'pass 2 may stand here; it may not write what the body '
                    + 'cannot survive' : null);
        }
    }

    /* ── AREAS ──────────────────────────────────────────────────────── */
    let areaCells = 0;
    if (rank >= genLayerRank('areas') && ran('partition')) {
        const partition = model.areaPartition ? model.areaPartition() : null;
        if (partition) {
            for (const [i, area] of partition.areas.entries()) {
                /** ⛔ A SYNTHETIC area (the grown 1-cell entrance/goal area, or
                 *  the goal's VESTIBULE) is NOT a chamber and must not read as
                 *  one — dashed outline, no fill. */
                groups.push(group(`area:${area.id}`, `area ${area.id} (${area.kind ?? 'chamber'}`
                    + `${area.synthetic ? ', SYNTHETIC' : ''})`,
                area.synthetic ? AREA_COLORS.synthetic : areaHue(i),
                area.synthetic ? 'dash' : 'fill', area.cells));
                areaCells += area.cells.length;
            }
        }
        const a = model.areas ?? null;
        if (a && !a.ran && a.refused) {
            notes.push(`the area graph REFUSED: ${a.refused.reason} — ${a.refused.detail}`);
        } else if (a && a.ran && ran('realisation')) {
            if (a.locks.length) {
                groups.push(group('area:locks', `${a.locks.length} boundary LOCK(s)`,
                    AREA_COLORS.lock, 'outline', a.locks));
                areaCells += a.locks.length;
            }
            if (a.flags.length) {
                groups.push(group('area:flags', `${a.flags.length} FLAG(s)`,
                    AREA_COLORS.flag, 'pennant', a.flags));
                areaCells += a.flags.length;
            }
        }
    }

    return Object.freeze({
        layer,
        phase,
        groups: Object.freeze(groups),
        /**
         * ⛓ THE LEGEND IS THE GROUPS' OWN LABELS PLUS THE NOTES — one row per
         * SYMBOL, never per cell (arc-1's rule), and it is DERIVED from the
         * groups so the page cannot name a symbol the draw did not paint.
         */
        legend: Object.freeze([
            ...groups.map((g) => Object.freeze({
                id: g.id, label: g.label, color: g.color, style: g.style, count: g.count,
                note: g.note,
            })),
            ...notes.map((text, i) => Object.freeze({
                id: `note:${i}`, label: text, color: null, style: 'note', count: 0, note: null,
            })),
        ]),
        counts: Object.freeze({ sites: siteCells, elements: elementCells, areas: areaCells }),
        notes: Object.freeze(notes),
    });
}

/** ⛔ ONE `switch`, and every style it draws is named in a group above. */
function drawGroup(ctx, g, px) {
    ctx.save();
    ctx.strokeStyle = g.color;
    ctx.fillStyle = g.color;
    ctx.lineWidth = 2;
    for (const c of g.cells) {
        const x = c.x * px;
        const y = c.y * px;
        switch (g.style) {
        case 'fill':
            ctx.globalAlpha = 0.28;
            ctx.fillRect(x, y, px, px);
            ctx.globalAlpha = 1;
            break;
        case 'fill+dash':
            ctx.globalAlpha = 0.3;
            ctx.fillRect(x, y, px, px);
            ctx.globalAlpha = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(x + 2, y + 2, px - 4, px - 4);
            ctx.setLineDash([]);
            break;
        case 'dash':
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(x + 2, y + 2, px - 4, px - 4);
            ctx.setLineDash([]);
            break;
        case 'outline':
            ctx.strokeRect(x + 1, y + 1, px - 2, px - 2);
            break;
        case 'ring':
            ctx.beginPath();
            ctx.arc(x + px / 2, y + px / 2, px / 3, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'square':
            ctx.strokeRect(x + px / 4, y + px / 4, px / 2, px / 2);
            break;
        case 'pennant':
            /** ⛔ NOT A RING — the renderer has already drawn an item circle on
             *  a `buttonroom`, and a second ring would read as one more key
             *  (arc-2 §11.1's own correction). */
            ctx.beginPath();
            ctx.moveTo(x + px / 4, y + px - 2);
            ctx.lineTo(x + px / 4, y + 2);
            ctx.lineTo(x + px - 3, y + px / 3);
            ctx.lineTo(x + px / 4, y + px / 2);
            ctx.stroke();
            break;
        default:
            fail(`watchGenOverlay: the group ${JSON.stringify(g.id)} declares style `
                + `${JSON.stringify(g.style)}, which this file cannot draw. ⛔ A silently `
                + 'skipped group is a picture missing a fact the legend claims is on it.');
        }
    }
    ctx.restore();
}

/**
 * ⛓⛓⛓ THE DRAW — a SIBLING, called after `renderer.draw` on the same canvas.
 * ⛔ Zero ops when there is nothing to draw, asserted rather than assumed.
 */
export function drawGenOverlay(ctx, data, view) {
    const v = assertGenView(view);
    if (!data || data.layer === 'off' || !data.groups.length) return;
    for (const g of data.groups) drawGroup(ctx, g, v.tilePx);
}

/**
 * ⛓⛓⛓ **THE GENERIC PAINTER FOR THE LEDGER'S INTERMEDIATE RESULTS** — ⚖ the
 * user's ruling of 2026-08-18: *"only display the visual representation when
 * the corresponding TEXT DESCRIPTION is selected"*. Because the picture is
 * selection-driven, ONE hue and an outlined PICK is enough and no per-fact
 * drawing code exists to keep in step with the phases.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} selected  the SAME paintables the readout published
 * @param {{tilePx:number}} view
 */
export function drawPaintables(ctx, selected, view) {
    const v = assertGenView(view);
    for (const p of selected ?? []) {
        ctx.save();
        ctx.strokeStyle = PAINTABLE_COLOR;
        ctx.fillStyle = PAINTABLE_COLOR;
        ctx.lineWidth = 2;
        for (const c of p.cells ?? []) {
            const x = c.x * v.tilePx;
            const y = c.y * v.tilePx;
            if (p.kind === 'flood' || p.kind === 'cells') {
                ctx.globalAlpha = 0.3;
                ctx.fillRect(x, y, v.tilePx, v.tilePx);
                ctx.globalAlpha = 1;
            } else if (p.kind === 'outline') {
                ctx.strokeRect(x + 1, y + 1, v.tilePx - 2, v.tilePx - 2);
            }
        }
        /** ⛓ A PATH is a polyline through its cells' centres, in the order the
         *  phase recorded them — which is the one fact a cell set cannot say. */
        if (p.kind === 'path' && (p.cells ?? []).length > 1) {
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            p.cells.forEach((c, i) => {
                const x = c.x * v.tilePx + v.tilePx / 2;
                const y = c.y * v.tilePx + v.tilePx / 2;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        /** ⛔ THE PICK IS OUTLINED IN A SECOND COLOUR — a candidate set whose
         *  chosen member looked like every other member would hide the one
         *  fact the reader opened the row for. */
        if (p.pick) {
            ctx.strokeStyle = PAINTABLE_PICK_COLOR;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(p.pick.x * v.tilePx + 1, p.pick.y * v.tilePx + 1,
                v.tilePx - 2, v.tilePx - 2);
        }
        ctx.restore();
    }
}
