/**
 * procgenCore/compositeMapRenderer — **THE COMPOSITE MAP, DRAWN FOR ANYBODY**
 * (APWORLD EDITOR HUB slice H3; plan `NewDocs/plans/apworld-editor-hub-plan.md`
 * §4 *"Map rendering is DECLARED per substrate"*).
 *
 * ── ⚖ THE RULING THIS FILE EXISTS FOR ────────────────────────────────
 *
 * *"I want to refactor the map rendering code so that each substrate declares
 * whether it supports map rendering, and has a way to call the renderer. I
 * don't want to hardcode support for map rendering for specific substrates."*
 * (user, 2026-09-04.)
 *
 * Before this slice the composite map was ONE block of `procgenPipelineUI.js`
 * (`_drawGrid` … `_drawGenericRegion`, 380 lines) whose `_drawRegion` named its
 * substrates by hand: `'text_adventure'` → the text-adventure painter,
 * `'maze'` → the maze painter, anything else → a generic box. What is left
 * here is everything that names NO substrate — the grid, the connection lines,
 * the stub cell, the generic box and the selection highlight — and the
 * per-region step is a lookup:
 *
 *     substrateRegistry.get(id)?.compositeMap?.drawRegion(ctx, region, geom)
 *
 * A substrate that declares `compositeMap` paints its own cells; one that does
 * not gets the generic box **labelled with its own id**, so "nobody drew this"
 * is legible on the canvas rather than silent. Adding a third painter is now a
 * declaration in that substrate's library, and no edit here.
 *
 * ── ⛔ WHY IT CAN LIVE IN `procgenCore/` AT ALL ───────────────────────
 *
 * `bindingContract.test.js` forbids every shipping `procgenCore/` module from
 * importing `mazeRoom/`, `seedlingDemo/` or `flashPanel/` — and its own
 * docblock names *"somebody reaches for `mazeRoomEngine`'s `TILE_WALL` from a
 * shared file"* as the case it exists for. The old painter did exactly that.
 * ⇒ the maze painter MOVED to `mazeRoom/mazeRoomLibrary.js` and the
 * text-adventure painter to `textAdventureSubstrateWrapperLibrary.js`, each
 * carrying its own imports, and what stayed behind imports one thing: the
 * registry. The ⚖ and the contract want the same file.
 *
 * ⛓ **The canvas is a PARAMETER, never a global.** Both declarers stay
 * node-importable (the capability-matrix generator loads them headless), which
 * a painter taking `ctx` and touching no DOM at module load costs nothing.
 *
 * ── THE GEOMETRY IS EXPORTED, because two readers hit-test it ─────────
 *
 * `resolveExitTilePositions` has three callers that are NOT painting: the
 * pipeline panel's Move-Exits hit-tester, its connection pass and its
 * selection highlight. `canvasPointOf` / `cellAtPoint` are the click→cell
 * mapping the panel used to spell twice inline (`_gridRegionAt` and
 * `_cellCoordsAt` were the same six lines) and the hub's Map tab needs a third
 * time. Exporting the geometry beside the painter is what keeps a click and a
 * pixel agreeing about where a cell is.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/** Pixels per substrate tile in the composite view. */
export const TILE_PX = 14;

export const COLORS = Object.freeze({
    floor: '#2a2a2a',
    wall: '#000000',
    // Same §5 palette as mazeRoomUI — keep the two views consistent.
    entrance: '#3aa85a',
    exit: '#3aa85a',
    exitBlocked: '#d04040',
    locationBlocked: '#d04040',
    grid: '#1a1a1a',
    cellBorder: '#3a3a50',
    emptyCell: '#141414',
    // Text-adventure cells: warm parchment tint so they stand apart
    // from the dark maze cells at a glance, without losing the cell
    // border / exit / blocked palette.
    textAdventureBg: '#3a3326',
    textAdventureFg: '#f0e6c8',
    textAdventureFgDim: '#a89d80',
    genericBg: '#2a2a3a',
    // The pending-selection highlight (Move Region / Move Exits in the
    // pipeline panel; the clicked cell in the hub's Map tab).
    selection: '#ffd24a',
    connection: '#e6c84a',
});

/**
 * ⛓ A region's exits, whatever shape it is in. This is the same field
 * `procgenPipelineEngine.getRegionExits` reads (`region?.exits`) — spelled
 * locally because a `procgenCore/` module reaching into the pipeline's engine
 * for a one-line property accessor would drag the whole generator (and, through
 * `mazeGeometry.js`, a BINDING) in behind it. `compositeMapRenderer.test.js`
 * drives both against the same region so the two spellings cannot drift.
 */
const exitsOf = (region) => region?.exits;

/**
 * Resolve a list of exits to their tile (x, y) inside the cell.
 *
 * Substrates whose adapter populates per-exit tile coords (current maze
 * + text-adventure path) round-trip their `(x, y)` verbatim. Future
 * substrates that omit them get an even distribution along their wall,
 * keyed by `side` (N/S/E/W). Mixing both modes per region is fine.
 *
 * Returns `[{ exit, x, y }, …]` in the input order.
 */
export function resolveExitTilePositions(exits, regionSize) {
    // Accept either the on-disk Array shape (sidecar JSON) or the
    // in-memory Map shape (after deserializeWorld), since both paths
    // feed the per-region painters. Normalize to a plain array.
    let list;
    if (Array.isArray(exits)) list = exits;
    else if (exits && typeof exits.values === 'function') list = [...exits.values()];
    else return [];
    if (list.length === 0) return [];
    const result = [];
    const bySide = { N: [], S: [], E: [], W: [] };
    for (const exit of list) {
        const hasXY = Number.isFinite(exit?.x) && Number.isFinite(exit?.y);
        if (hasXY) {
            result.push({ exit, x: exit.x, y: exit.y });
        } else if (exit?.side && bySide[exit.side]) {
            bySide[exit.side].push({ exit, slotIndex: result.length });
            result.push(null);
        } else {
            result.push(null);
        }
    }
    const lastX = regionSize.width - 1;
    const lastY = regionSize.height - 1;
    for (const side of ['N', 'S', 'E', 'W']) {
        const queue = bySide[side];
        if (queue.length === 0) continue;
        const horizontal = (side === 'N' || side === 'S');
        const span = horizontal ? regionSize.width : regionSize.height;
        // Even distribution: slot k of N gets the (k+1)/(N+1) fraction
        // of the span (avoids landing on the corners).
        for (let i = 0; i < queue.length; i++) {
            const frac = (i + 1) / (queue.length + 1);
            const along = Math.max(0, Math.min(span - 1, Math.round(frac * (span - 1))));
            let x; let y;
            if (side === 'N') { x = along; y = 0; }
            else if (side === 'S') { x = along; y = lastY; }
            else if (side === 'W') { x = 0; y = along; }
            else { x = lastX; y = along; }
            const { exit, slotIndex } = queue[i];
            result[slotIndex] = { exit, x, y };
        }
    }
    return result.filter(Boolean);
}

/**
 * Truncate `text` with an ellipsis so it fits within `maxPx` using the
 * canvas's currently-set font. No-op if the text already fits.
 */
export function fitTextToWidth(ctx, text, maxPx) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxPx) return text;
    const ellipsis = '…';
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxPx) lo = mid;
        else hi = mid - 1;
    }
    return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE GEOMETRY — one spelling, three readers
 * ══════════════════════════════════════════════════════════════════════ */

/** Canvas-backing pixel under a pointer event (null if the canvas isn't laid out). */
export function canvasPointOf(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
        cx: (evt.clientX - rect.left) * (canvas.width / rect.width),
        cy: (evt.clientY - rect.top) * (canvas.height / rect.height),
    };
}

/**
 * The grid cell a canvas-backing pixel falls in, or null when it falls outside
 * the grid. `wx`/`wy` are the pixel WITHIN the cell, which is what an exit-square
 * hit-test needs next.
 */
export function cellAtPoint(grid, regionSize, point, tilePx = TILE_PX) {
    if (!point) return null;
    const cellW = regionSize.width * tilePx;
    const cellH = regionSize.height * tilePx;
    const gx = Math.floor(point.cx / cellW);
    const gy = Math.floor(point.cy / cellH);
    if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return null;
    return { gx, gy, wx: point.cx - gx * cellW, wy: point.cy - gy * cellH };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE SUBSTRATE-NEUTRAL PAINTERS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * A region placed but not yet realised (top-down 1 Layout → 2 Realise), i.e.
 * one with no `playable_payload`. Muted fill + the region_id so the live grid
 * is viewable mid-pipeline. ⛔ Drawn BEFORE any substrate lookup: a declared
 * painter is entitled to assume a payload.
 */
export function drawStubRegion(ctx, region, { offX, offY, regionSize, tilePx = TILE_PX, colors = COLORS }) {
    const w = regionSize.width * tilePx;
    const h = regionSize.height * tilePx;
    ctx.fillStyle = colors.emptyCell;
    ctx.fillRect(offX, offY, w, h);
    ctx.strokeStyle = colors.cellBorder;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(offX + 1.5, offY + 1.5, w - 3, h - 3);
    ctx.setLineDash([]);
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText(String(region?.region_id ?? '?').slice(0, 12), offX + 4, offY + 14);
}

/**
 * ⛓⛓ **GENERIC BY NAME** — the cell for a region whose substrate declares no
 * `compositeMap`. It prints the id it fell back FROM, so an undrawn substrate
 * reads as "nobody painted `bounce`" rather than as an anonymous blue box. That
 * label is the whole difference between a fallback and a silence.
 */
export function drawGenericRegion(ctx, region, { offX, offY, regionSize, tilePx = TILE_PX, colors = COLORS }) {
    const cellW = regionSize.width * tilePx;
    const cellH = regionSize.height * tilePx;
    ctx.fillStyle = colors.genericBg;
    ctx.fillRect(offX, offY, cellW, cellH);

    const placedExits = resolveExitTilePositions(exitsOf(region) ?? [], regionSize);
    ctx.fillStyle = colors.exit;
    for (const { x, y } of placedExits) {
        ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
    }

    ctx.save();
    ctx.fillStyle = colors.textAdventureFg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = region?.substrate ?? region?.render_hint ?? '?';
    // Zone-based substrates carry a numeric index in
    // playable_payload (currently just JtA's jtaZone). Surface it
    // here so the shuffled-spiral preview shows zone ordering at
    // a glance; procedural substrates render unchanged.
    const zoneIdx = region?.playable_payload?.jtaZone;
    const hasZone = typeof zoneIdx === 'number';
    const cx = offX + cellW / 2;
    if (hasZone) {
        ctx.font = `bold ${Math.max(14, Math.floor(cellH * 0.25))}px sans-serif`;
        ctx.fillText(`Zone ${zoneIdx}`, cx, offY + cellH / 2 - 6);
        ctx.font = '10px sans-serif';
        ctx.fillText(`(${label})`, cx, offY + cellH / 2 + 12);
    } else {
        ctx.font = '10px sans-serif';
        ctx.fillText(`(${label})`, cx, offY + cellH / 2);
    }
    ctx.restore();
}

/**
 * ⛓ Which id this region asks to be drawn as. `render_hint` FIRST, then
 * `substrate` — today's precedence, preserved.
 *
 * ⚠ The brief proposed `substrate ?? render_hint`. Measured over the 205
 * committed presets: 1,360 sidecar entries, **0** where the two disagree and
 * **0** naming neither (270 omit `render_hint` alone), so the corpus cannot
 * tell the two orders apart — which is exactly why the one already shipping is
 * the one to keep. `render_hint` is also the field whose NAME means "draw me
 * like this".
 *
 * ⚠ The pipeline's old `_drawRegion` ended this chain with `?? 'maze'`.
 * DELIBERATELY DROPPED (plan §13): a region naming neither field but carrying a
 * payload is unreachable — 0 of 1,360 sidecar entries, and 0 payload-bearing
 * regions out of `growMaze` / `topDownFromRulesJson` / `layoutTopDown`, whose
 * only payload-free placements are top-down's layout stubs (which never reach
 * this function). Keeping it would have been the one hardcoded substrate name
 * the ⚖ asked to remove, in the one place nothing can observe it.
 */
export function compositeMapIdOf(region) {
    return region?.render_hint ?? region?.substrate ?? null;
}

/**
 * ⛓ The declared painter for a region, or null. `compositeMap` is the registry
 * slot (`docs/json/developer/procgen/substrate-registry.md` § *Composite map*);
 * a substrate declaring nothing resolves to null and gets the generic box.
 */
export function compositeMapPainterFor(region, registry = substrateRegistry) {
    const id = compositeMapIdOf(region);
    if (!id) return null;
    const draw = registry?.get?.(id)?.compositeMap?.drawRegion;
    return typeof draw === 'function' ? draw : null;
}

/** One cell: stub, declared painter, or generic-by-name. */
function drawRegionCell(ctx, region, geom, registry) {
    // Stub region: placed in 1 Layout (top-down) but not yet realised in 2,
    // so it has no playable_payload. Draw a labelled placeholder instead of
    // dispatching to a substrate painter (which assumes a payload).
    if (!region?.playable_payload) {
        drawStubRegion(ctx, region, geom);
        return;
    }
    const painter = compositeMapPainterFor(region, registry);
    if (painter) painter(ctx, region, geom);
    else drawGenericRegion(ctx, region, geom);
}

/**
 * Thin yellow lines linking each exit's green square to its paired entrance's
 * green square (the reciprocal exit in the target region, found via
 * targetExitId). Usually the two sit adjacent so the line is tiny, but for
 * teleporter links (regions placed apart) it shows the connection. Drawn last
 * so the lines sit on top of the cells.
 */
function drawConnections(ctx, grid, regionSize, tilePx, colors) {
    const cellW = regionSize.width * tilePx;
    const cellH = regionSize.height * tilePx;
    // Global green-square center for every (region_id, exit_id).
    const centers = new Map();
    for (const region of grid.allRegions()) {
        const cell = region.cell;
        if (!cell) continue;
        const placed = resolveExitTilePositions(exitsOf(region) ?? [], regionSize);
        for (const p of placed) {
            if (!p?.exit?.exit_id) continue;
            centers.set(`${region.region_id} ${p.exit.exit_id}`, {
                px: cell.gx * cellW + (p.x + 0.5) * tilePx,
                py: cell.gy * cellH + (p.y + 0.5) * tilePx,
            });
        }
    }
    ctx.strokeStyle = colors.connection;
    ctx.lineWidth = 3;
    const drawn = new Set();
    for (const region of grid.allRegions()) {
        const exits = exitsOf(region);
        const list = Array.isArray(exits) ? exits : [...(exits?.values?.() ?? [])];
        for (const exit of list) {
            if (!exit?.targetRegion || !exit?.targetExitId) continue;
            const fromKey = `${region.region_id} ${exit.exit_id}`;
            const toKey = `${exit.targetRegion} ${exit.targetExitId}`;
            const pairKey = fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`;
            if (drawn.has(pairKey)) continue;
            drawn.add(pairKey);
            const a = centers.get(fromKey);
            const b = centers.get(toKey);
            if (!a || !b) continue;
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();
        }
    }
}

/**
 * ⛓⛓⛓ **THE WHOLE COMPOSITE MAP.** Paints `grid` onto `canvas`: every cell
 * (empty / stub / declared painter / generic-by-name), the cell borders, the
 * connection lines, then the selection highlight.
 *
 * @param {HTMLCanvasElement} canvas sized by the caller — `grid.width *
 *   regionSize.width * tilePx` by the same in y.
 * @param {{width:number,height:number,getRegion:Function,allRegions:Function}} grid
 * @param {{width:number,height:number}} regionSize cell size in TILES
 * @param {object} [opts]
 * @param {{kind:'region'|'exit', cell:{gx,gy}, exitId?:string}|null} [opts.selection]
 *   the pending selection to outline. `'region'` outlines the whole cell,
 *   `'exit'` outlines that exit's green square (and draws nothing when the
 *   named exit is not placed).
 * @param {number} [opts.tilePx]
 * @param {object} [opts.colors]
 * @param {{get:Function}} [opts.registry] test seam — the substrate registry.
 */
export function drawCompositeMap(canvas, grid, regionSize, {
    selection = null, tilePx = TILE_PX, colors = COLORS, registry = substrateRegistry,
} = {}) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colors.emptyCell;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let gy = 0; gy < grid.height; gy++) {
        for (let gx = 0; gx < grid.width; gx++) {
            const region = grid.getRegion({ gx, gy });
            const offX = gx * regionSize.width * tilePx;
            const offY = gy * regionSize.height * tilePx;
            if (!region) {
                ctx.strokeStyle = colors.cellBorder;
                ctx.lineWidth = 1;
                ctx.strokeRect(offX + 0.5, offY + 0.5,
                    regionSize.width * tilePx - 1, regionSize.height * tilePx - 1);
                continue;
            }
            drawRegionCell(ctx, region, { offX, offY, regionSize, tilePx, colors }, registry);
        }
    }

    // Cell borders so regions are visually distinct.
    ctx.strokeStyle = colors.cellBorder;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= grid.width; gx++) {
        ctx.beginPath();
        ctx.moveTo(gx * regionSize.width * tilePx + 0.5, 0);
        ctx.lineTo(gx * regionSize.width * tilePx + 0.5, canvas.height);
        ctx.stroke();
    }
    for (let gy = 0; gy <= grid.height; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, gy * regionSize.height * tilePx + 0.5);
        ctx.lineTo(canvas.width, gy * regionSize.height * tilePx + 0.5);
        ctx.stroke();
    }

    drawConnections(ctx, grid, regionSize, tilePx, colors);

    // Highlight the pending selection: the whole cell, or one exit's green square.
    const cw = regionSize.width * tilePx;
    const ch = regionSize.height * tilePx;
    if (selection?.kind === 'exit') {
        const region = grid.getRegion(selection.cell);
        const placed = region
            ? resolveExitTilePositions(exitsOf(region) ?? [], regionSize)
            : [];
        const hit = placed.find((p) => p?.exit?.exit_id === selection.exitId);
        if (hit) {
            ctx.strokeStyle = colors.selection;
            ctx.lineWidth = 3;
            ctx.strokeRect(
                selection.cell.gx * cw + hit.x * tilePx - 1.5,
                selection.cell.gy * ch + hit.y * tilePx - 1.5,
                tilePx + 3, tilePx + 3,
            );
        }
    } else if (selection?.kind === 'region') {
        const { gx, gy } = selection.cell;
        ctx.strokeStyle = colors.selection;
        ctx.lineWidth = 3;
        ctx.strokeRect(gx * cw + 1.5, gy * ch + 1.5, cw - 3, ch - 3);
    }
}
