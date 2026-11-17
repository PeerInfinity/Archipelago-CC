/**
 * ⛓⛓ **THE EXTENT OF A SET OF REGION CELLS** (unbounded grid, slice S1).
 *
 * Region `grid_cell`s are SIGNED (⚖ user 2026-11-16, Q1: signed storage, the start room at (0,0)): no reader may
 * assume the top-left cell is (0,0). Every reader that needs a box AFTER the data exists — a canvas, a click, a
 * `Grid` to place cells into — asks this module for it instead of computing `max + 1`.
 *
 * The other spellings this replaces or sits beside (named so the next slice can fold them in):
 *   · `apworldEditor/slotInitialise.js` `cellExtent` (module-private): `max + 1`, which is what `grid_dims` records
 *     today. S2 changes `grid_dims` to `max − min + 1` and repoints that writer here.
 *   · `procgenCore/setMapLayout.js` `cellBounds` (module-private, lab-owned): the same min/max over set-map
 *     positions; already signed since the origin slice.
 *   · `regionMap/regionMapFrames.js`: signed frames that always include the start cell (0,0), the same rule
 *     `drawnBox` below spells for region cells.
 */

/**
 * The bounding box of the cells: `{minX, minY, maxX, maxY, width, height}` (`width = maxX − minX + 1`), or `null`
 * when no cell is given. A cell is any `{gx, gy}` with finite integer coordinates; anything else is skipped.
 *
 * @param {Iterable<{gx:number, gy:number}|null|undefined>} cells
 * @returns {{minX:number, minY:number, maxX:number, maxY:number, width:number, height:number}|null}
 */
export function cellExtent(cells) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of cells ?? []) {
        if (!isSignedCell(c)) continue;
        if (c.gx < minX) minX = c.gx;
        if (c.gy < minY) minY = c.gy;
        if (c.gx > maxX) maxX = c.gx;
        if (c.gy > maxY) maxY = c.gy;
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** ⛓ A usable region cell: two whole numbers, negatives allowed. */
export const isSignedCell = (c) => !!c && Number.isInteger(c.gx) && Number.isInteger(c.gy);

/**
 * ⛓⛓ **THE BOX A REGION MAP IS DRAWN IN.** The cells' extent, widened to include the ORIGIN cell — `origin` when
 * the document declares one, else (0,0), where the start room sits (⚖ Q1) — and, when given, a declared
 * `{width, height}` box anchored at that origin (`procgen_metadata[p].grid_dims`). Returns `{minX, minY, width,
 * height}`, or `null` for no cells.
 *
 * ⛓ WHY the origin is always inside: every committed document is non-negative and a map has always been drawn
 * from column 0, including documents whose lowest cell is (4,4) (measured at c1927ba307: 26 of the 55 slots the
 * S1 dump covers have a min above 0 on some axis, e.g. `seedling_atlas_sphere` AP_1 at (4,4)). Drawing them from their min would move their pixels. Under signed storage the start room
 * IS (0,0), so the rule costs a signed world nothing; `regionMapFrames` already frames the same way.
 *
 * @param {{minX:number, minY:number, maxX:number, maxY:number}|null} extent `cellExtent(...)`
 * @param {{width:number, height:number}|null} [declared] a declared box (both positive integers), or null
 * @param {{gx:number, gy:number}|null} [origin] the declared origin (`grid_origin`), else (0,0)
 */
export function drawnBox(extent, declared = null, origin = null) {
    if (!extent) return null;
    const ox = isSignedCell(origin) ? origin.gx : 0;
    const oy = isSignedCell(origin) ? origin.gy : 0;
    let minX = Math.min(extent.minX, ox);
    let minY = Math.min(extent.minY, oy);
    let maxX = Math.max(extent.maxX, ox);
    let maxY = Math.max(extent.maxY, oy);
    if (declared) {
        minX = Math.min(minX, ox);
        minY = Math.min(minY, oy);
        maxX = Math.max(maxX, ox + declared.width - 1);
        maxY = Math.max(maxY, oy + declared.height - 1);
    }
    return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * ⛓ The top-left cell of a `Grid`-like: `{minX, minY}` — `grid.minX/minY` when it carries them (the S1 bridge grid
 * from `compositeMapDocument.gridForBox`; S2's `Grid`), else (0,0) (an engine `Grid` today, always min-0).
 */
export function gridOriginOf(grid) {
    return {
        minX: Number.isInteger(grid?.minX) ? grid.minX : 0,
        minY: Number.isInteger(grid?.minY) ? grid.minY : 0,
    };
}
