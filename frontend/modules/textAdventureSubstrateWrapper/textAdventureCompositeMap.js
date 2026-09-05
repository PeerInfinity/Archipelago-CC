/**
 * textAdventureSubstrateWrapper/textAdventureCompositeMap — **THE TEXT
 * ADVENTURE'S OWN CELL ON THE COMPOSITE MAP** (APWORLD EDITOR HUB slice H3;
 * ⚖ *"each substrate declares whether it supports map rendering … I don't want
 * to hardcode support for map rendering for specific substrates."*).
 *
 * This function WAS `procgenPipelineUI.js`'s `_drawTextAdventureRegion`,
 * reached by a hand-written `hint === 'text_adventure'` branch. It moved here
 * whole; `textAdventureSubstrateWrapperLibrary.js` DECLARES it as
 * `compositeMap.drawRegion`. See `mazeRoom/mazeCompositeMap.js` for the other
 * half of the same move, and `procgenCore/compositeMapRenderer.js` for what is
 * left over once no substrate is named.
 *
 * ⛓ A text-adventure region has no tile geometry to draw — it has LOCATIONS.
 * So the cell is a parchment card: the region id, a location count, then the
 * location names until the cell runs out of room, with locked ones marked. The
 * exits still land on their resolved tiles so the connection lines (drawn by
 * the shared renderer) meet something.
 *
 * ⛔ No DOM at module load — the library that declares this stays
 * node-importable for the capability-matrix generator.
 */

import {
    DEFAULT_OBSTACLES, isObstacleCleared,
} from '../shared/procgen/library.js';
import {
    TILE_PX, COLORS, resolveExitTilePositions, fitTextToWidth,
} from '../procgenCore/compositeMapRenderer.js';

/**
 * Paint one text-adventure region into its composite-map cell.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} region the grid region (its `playable_payload` carries
 *   `exits` / `items` / `itemLocationNames` / `obstacles`).
 * @param {{offX:number, offY:number, regionSize:{width,height},
 *   tilePx?:number, colors?:object}} geom
 */
export function drawTextAdventureCompositeRegion(ctx, region, {
    offX, offY, regionSize, tilePx = TILE_PX, colors = COLORS,
} = {}) {
    const payload = region?.playable_payload ?? {};
    const cellW = regionSize.width * tilePx;
    const cellH = regionSize.height * tilePx;
    const obsLib = payload.obstacleLib ?? DEFAULT_OBSTACLES;
    const inventory = new Set();

    ctx.fillStyle = colors.textAdventureBg;
    ctx.fillRect(offX, offY, cellW, cellH);

    const placedExits = resolveExitTilePositions(payload.exits, regionSize);
    for (const { x, y } of placedExits) {
        const obstacleId = payload.obstacles?.get?.(`${x},${y}`);
        const obstacle = obstacleId ? obsLib[obstacleId] : null;
        const isLogicGate = obstacle?.clear_set_type === 'rule';
        const gateClosed = isLogicGate
            && !isObstacleCleared(obstacleId, inventory, obsLib);
        ctx.fillStyle = gateClosed ? colors.exitBlocked : colors.exit;
        ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
    }

    if (payload.entrance && Number.isFinite(payload.entrance.x) && Number.isFinite(payload.entrance.y)) {
        const ex = payload.entrance.x;
        const ey = payload.entrance.y;
        const onExit = placedExits.some(({ x, y }) => x === ex && y === ey);
        if (!onExit) {
            ctx.strokeStyle = colors.entrance;
            ctx.lineWidth = 2;
            ctx.strokeRect(offX + ex * tilePx + 1, offY + ey * tilePx + 1, tilePx - 2, tilePx - 2);
        }
    }

    // Items live in two parallel Maps keyed by "x,y": payload.items
    // (Map → itemId) and payload.itemLocationNames (Map → AP name).
    // Skip items whose location name didn't make it through serialization.
    const locationNames = [];
    const lockedLocations = new Set();
    const items = payload.items;
    const itemLocationNames = payload.itemLocationNames;
    if (items && typeof items.entries === 'function') {
        for (const [posKey] of items) {
            const locationName = itemLocationNames?.get?.(posKey);
            if (!locationName) continue;
            locationNames.push(locationName);
            const obstacleId = payload.obstacles?.get?.(posKey);
            const obstacle = obstacleId ? obsLib[obstacleId] : null;
            const isLogicGate = obstacle?.clear_set_type === 'rule';
            const gateClosed = isLogicGate
                && !isObstacleCleared(obstacleId, inventory, obsLib);
            if (gateClosed) lockedLocations.add(locationName);
        }
    }

    const padX = 6;
    const padY = 6;
    const headerSize = 11;
    const lineSize = 10;
    const lineGap = 2;
    let textY = offY + padY;

    ctx.save();
    ctx.fillStyle = colors.textAdventureFg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.font = `bold ${headerSize}px sans-serif`;
    const heading = region?.region_id ?? region?.name ?? '(region)';
    const headingLine = fitTextToWidth(ctx, heading, cellW - padX * 2);
    if (headingLine && textY + headerSize <= offY + cellH - padY) {
        ctx.fillText(headingLine, offX + padX, textY);
        textY += headerSize + lineGap;
    }

    ctx.font = `${lineSize}px sans-serif`;
    const summary = `${locationNames.length} location${locationNames.length === 1 ? '' : 's'}`;
    if (textY + lineSize <= offY + cellH - padY) {
        ctx.fillText(summary, offX + padX, textY);
        textY += lineSize + lineGap;
    }

    const maxY = offY + cellH - padY;
    let truncated = 0;
    for (let i = 0; i < locationNames.length; i++) {
        const name = locationNames[i];
        const remaining = locationNames.length - i;
        if (textY + lineSize > maxY) {
            truncated = remaining;
            break;
        }
        // Last visible slot may need to host a "+N more" instead.
        const isLastSlot = textY + lineSize * 2 + lineGap > maxY;
        if (isLastSlot && remaining > 1) {
            ctx.fillStyle = colors.textAdventureFgDim;
            ctx.fillText(`+${remaining} more`, offX + padX, textY);
            truncated = 0;
            textY += lineSize + lineGap;
            break;
        }
        const prefix = lockedLocations.has(name) ? '\u{1F512} ' : '• ';
        ctx.fillStyle = lockedLocations.has(name) ? colors.locationBlocked : colors.textAdventureFg;
        ctx.fillText(fitTextToWidth(ctx, prefix + name, cellW - padX * 2), offX + padX, textY);
        textY += lineSize + lineGap;
    }
    if (truncated > 0) {
        ctx.fillStyle = colors.textAdventureFgDim;
        ctx.fillText(`+${truncated} more`, offX + padX, textY);
    }
    ctx.restore();
}
