/**
 * mazeRoom/mazeTileKindOverlay — **THE PLACED TILE KINDS, DRAWN BESIDE `drawWorld`** (⛓ CONTENT SETS TILE-3;
 * `mazeTileKinds.js` holds the field). The `mazeThingOverlay` pattern: a sibling pass, so a world with no placed kind
 * draws nothing here and every view's op log is unchanged. Both views call it: the Maze Room panel right after
 * `drawWorld`, the composite map's maze cell after its markers. ⛔ No DOM.
 */
import { drawMazeTile, mazeTileKind } from './mazeTileArt.js';
import { tileKindsList } from './mazeSerializer.js';

/**
 * ⛓ THE PAINTER — every placed kind of `world`, through TILE-1's chain with TILE-2's lookup:
 * `drawMazeTile(ctx, view.tileArt, kind, …, mazeTileKind(kind, { tileKinds }))`, `tileKinds` the stack's declared
 * kinds (`view.tileKinds`, else `view.tileArt.tileKinds`). A sibling of `drawWorld` (the `mazeThingOverlay` pattern),
 * so a world with no placed kind draws NOTHING here and every view's op log is unchanged. Skipped like a thing: under
 * the fog until seen, and on the player's cell. `view`: `{ tilePx, playerPos, fogEnabled, isTileVisible, tileArt,
 * tileKinds, offX?, offY? }`. Returns `[{ x, y, kind, as }]`, `as` the chain's step.
 */
export function drawMazeTileKinds(ctx, world, view) {
    const list = tileKindsList(world);
    if (!list) return [];
    const px = view.tilePx;
    const declared = view.tileKinds ?? view.tileArt?.tileKinds ?? null;
    const out = [];
    for (const { x, y, kind } of list) {
        if (view.fogEnabled && !view.isTileVisible(x, y)) continue;
        if (view.playerPos && view.playerPos.x === x && view.playerPos.y === y) continue;
        const as = drawMazeTile(ctx, view.tileArt ?? null, kind, (view.offX ?? 0) + x * px, (view.offY ?? 0) + y * px, px,
            mazeTileKind(kind, { tileKinds: declared }));
        out.push({ x, y, kind, as });
    }
    return out;
}
