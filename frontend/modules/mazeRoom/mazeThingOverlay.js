/**
 * mazeRoom/mazeThingOverlay — **A REGION'S THING, DRAWN BESIDE `drawWorld`** (⛓ CONTENT SETS S2; `mazeThings.js`).
 *
 * A thing (a character, an object or a piece of information that is not an AP check) stands on a floor cell. It is
 * drawn by this SIBLING of `drawWorld`, the pattern of `mazeElementOverlay.js`, so the panel's draw is unchanged
 * for every world without things and `mazeRoomRender.test.js`'s op-log hashes stay as they are. The panel calls it
 * right after `drawWorld`.
 *
 * What a thing draws as, first that applies:
 *   1. the ART its pack concept names (`art`), when the world's stack carries that key (`mazeTileArt.thingArtFrame`;
 *      resolved at PLAY, never baked — Q8);
 *   2. a piece of information that no character or object holds: the `sign` key of the maze's art table
 *      (`maze:object/sign`), else a plain sign in `COLORS.sign`;
 *   3. the holder's BAKED look: a square in its colour, outlined in ink, with its symbol.
 *
 * ⛔ Not drawn: under the fog until its cell has been seen (`view.isTileVisible`, the rule `drawWorld`'s overlays
 * use), and on the cell the player stands on (the player is drawn there; the thing's text is in the panel).
 * ⛔ No DOM and no node imports: it draws on the context it is handed.
 */

import { COLORS } from './mazeRoomRender.js';
import { drawTileArt, drawThingArt } from './mazeTileArt.js';

/** The thing at a cell of `world`, or null. */
export function thingAt(world, x, y) {
    return (world?.things ?? []).find((t) => t.x === x && t.y === y) ?? null;
}

/** A sign with no art: a board on a post, in `COLORS.sign`, ink-edged. */
function paintSign(ctx, x0, y0, px) {
    ctx.fillStyle = COLORS.sign;
    ctx.fillRect(x0 + px * 0.45, y0 + px * 0.55, px * 0.1, px * 0.35);
    ctx.fillRect(x0 + px * 0.15, y0 + px * 0.15, px * 0.7, px * 0.45);
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + px * 0.15, y0 + px * 0.15, px * 0.7, px * 0.45);
}

/** A holder with no art: a square in its baked colour, ink-edged, its symbol on it. */
function paintHolder(ctx, thing, x0, y0, px) {
    ctx.fillStyle = thing.color ?? COLORS.sign;
    ctx.fillRect(x0 + px * 0.2, y0 + px * 0.2, px * 0.6, px * 0.6);
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + px * 0.2, y0 + px * 0.2, px * 0.6, px * 0.6);
    if (thing.symbol) {
        ctx.save();
        ctx.fillStyle = COLORS.wall;
        ctx.font = `bold ${Math.floor(px * 0.45)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(thing.symbol, x0 + px / 2, y0 + px / 2);
        ctx.restore();
    }
}

/**
 * Draw every thing of `world`. `view` is `{ tilePx, playerPos, fogEnabled, isTileVisible, tileArt }` — the same
 * values the panel hands `drawWorld` — plus an optional cell origin `offX`/`offY` (default 0; the composite map's
 * cell, `mazeCompositeMap.js`). Returns how each was drawn, `[{ id, x, y, as: 'art'|'sign-art'|'sign'|'look' }]`
 * (the ones skipped are absent), for the in-app row and the tests.
 */
export function drawMazeThings(ctx, world, view) {
    const out = [];
    const px = view.tilePx;
    for (const t of world?.things ?? []) {
        if (!Number.isInteger(t?.x) || !Number.isInteger(t?.y)) continue;
        if (view.fogEnabled && !view.isTileVisible(t.x, t.y)) continue;
        if (view.playerPos && view.playerPos.x === t.x && view.playerPos.y === t.y) continue;
        const x0 = (view.offX ?? 0) + t.x * px;
        const y0 = (view.offY ?? 0) + t.y * px;
        let as;
        if (view.tileArt && drawThingArt(ctx, view.tileArt, t.concept, x0, y0, px, px)) as = 'art';
        else if (t.kind === 'info' && view.tileArt && drawTileArt(ctx, view.tileArt, 'sign', x0, y0, px, px)) as = 'sign-art';
        else if (t.kind === 'info') { paintSign(ctx, x0, y0, px); as = 'sign'; } else { paintHolder(ctx, t, x0, y0, px); as = 'look'; }
        out.push({ id: t.id, x: t.x, y: t.y, as });
    }
    return out;
}

/**
 * ⛓ WHAT READING A THING SHOWS, line by line — the text adventure's order (`templating.thingLines`): the
 * description; a character's line (`<name> says: …`); the information it holds (`<name>: <body>`); a thing that
 * says nothing reads `You see <name>.` Plain text (the maze shows it with `textContent`).
 */
export function mazeThingLines(thing) {
    const lines = [];
    if (thing?.kind !== 'info' && thing?.description) lines.push(thing.description);
    if (thing?.kind === 'character' && thing.says) lines.push(`${thing.name} says: ${thing.says}`);
    if (thing?.info?.body) lines.push(`${thing.info.name}: ${thing.info.body}`);
    if (!lines.length) lines.push(`You see ${thing?.name ?? 'something'}.`);
    return lines;
}
