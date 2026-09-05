/**
 * mazeRoom/mazeCompositeMap — **THE MAZE'S OWN CELL ON THE COMPOSITE MAP**
 * (APWORLD EDITOR HUB slice H3; ⚖ *"each substrate declares whether it supports
 * map rendering, and has a way to call the renderer. I don't want to hardcode
 * support for map rendering for specific substrates."*).
 *
 * This function WAS `procgenPipelineUI.js`'s `_drawMazeRegion`, reached by a
 * hand-written `hint === 'maze'` branch in the panel. It moved here whole, with
 * the imports that make it maze-specific (`TILE_WALL`/`getTile` from the maze
 * engine, the shared item/obstacle libraries), and `mazeRoomLibrary.js`
 * DECLARES it as `compositeMap.drawRegion`. The shared renderer
 * (`procgenCore/compositeMapRenderer.js`) now names no substrate at all — which
 * is also what lets it live in `procgenCore/`, where
 * `bindingContract.test.js` forbids exactly the `mazeRoomEngine` import this
 * file makes.
 *
 * ⛔ **A PAINTER TAKES `ctx` AND TOUCHES NO DOM AT MODULE LOAD.** That is the
 * whole cost of keeping `mazeRoomLibrary.js` node-importable, which the
 * capability-matrix generator and the `check-*.mjs` gates depend on;
 * `mazeRoomLibrary.test.js` asserts it.
 *
 * Lives beside `mazeKeys.js`'s `describeMazeAction` in the same role: the maze's
 * half of a registry declaration, kept out of the declaration file.
 */

import { TILE_WALL, getTile } from './mazeRoomEngine.js';
import {
    DEFAULT_ITEMS, DEFAULT_OBSTACLES,
    isObstacleCleared, getItemRenderHints,
} from '../shared/procgen/library.js';
import { TILE_PX, COLORS } from '../procgenCore/compositeMapRenderer.js';

/**
 * Paint one maze region into its composite-map cell.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} region the grid region — its `playable_payload` is the
 *   deserialized maze world (tiles / exits / items / obstacles).
 * @param {{offX:number, offY:number, regionSize:{width,height},
 *   tilePx?:number, colors?:object}} geom cell origin + the shared geometry.
 *   ⛓ `regionSize` is the GRID's uniform cell, which can be larger than this
 *   world; the maze paints its own `world.width`/`world.height` from the
 *   origin, exactly as the panel's version did.
 */
export function drawMazeCompositeRegion(ctx, region, {
    offX, offY, tilePx = TILE_PX, colors = COLORS,
} = {}) {
    const world = region?.playable_payload;
    if (!world) return;
    const obsLib = world.obstacleLib ?? DEFAULT_OBSTACLES;
    const itemLib = world.itemLib ?? DEFAULT_ITEMS;
    // Composite view doesn't have a player inventory — gates
    // always render closed here. (The maze panel's playable view
    // is the right place to see them open as the player picks up
    // keys.)
    const inventory = new Set();

    // Tile base layer
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            const tile = getTile(world, x, y);
            ctx.fillStyle = tile === TILE_WALL ? colors.wall : colors.floor;
            ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
        }
    }

    // Quick lookup from tile coords to the exit at that position.
    const exitAt = new Map();
    for (const e of world.exits.values()) {
        exitAt.set(`${e.x},${e.y}`, e);
    }

    // §5 rendering pass — same shape as mazeRoomUI._drawWorld.
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            const key = `${x},${y}`;
            const obstacleId = world.obstacles.get(key);
            const obstacle = obstacleId ? obsLib[obstacleId] : null;
            const isLogicGate = obstacle?.clear_set_type === 'rule';
            const gateClosed = isLogicGate
                && !isObstacleCleared(obstacleId, inventory, obsLib);
            const exit = exitAt.get(key);
            const isExit = !!exit;
            const isEntrance = (x === world.entrance.x && y === world.entrance.y);
            const itemId = world.items.get(key);

            if (isExit) {
                ctx.fillStyle = (isLogicGate && gateClosed) ? colors.exitBlocked : colors.exit;
                ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
            }
            if (obstacle && !isLogicGate) {
                const color = obstacle.color ?? '#b84040';
                ctx.fillStyle = color;
                ctx.fillRect(offX + x * tilePx + 2, offY + y * tilePx + 2, tilePx - 4, tilePx - 4);
            }
            if (itemId) {
                const hints = getItemRenderHints(itemId, itemLib);
                const cx = offX + x * tilePx + tilePx / 2;
                const cy = offY + y * tilePx + tilePx / 2;
                ctx.fillStyle = hints.color;
                ctx.beginPath();
                ctx.arc(cx, cy, tilePx * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (hints.label) {
                    ctx.save();
                    ctx.fillStyle = '#000';
                    ctx.font = `bold ${Math.floor(tilePx * 0.55)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(hints.label, cx, cy);
                    ctx.restore();
                }
                if (isLogicGate && gateClosed) {
                    ctx.strokeStyle = colors.locationBlocked;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(offX + x * tilePx + 1, offY + y * tilePx + 1, tilePx - 2, tilePx - 2);
                }
            }
            if (isEntrance && !isExit) {
                ctx.strokeStyle = colors.entrance;
                ctx.lineWidth = 2;
                ctx.strokeRect(offX + x * tilePx + 1, offY + y * tilePx + 1, tilePx - 2, tilePx - 2);
            }
        }
    }
}
