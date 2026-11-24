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
 *
 * ── ⛓ CONTENT SETS TIDY-1 — THE THEME'S ART ON THE CELL ──────────────
 * A themed maze world (`procgen_metadata[p].content`, ⚠ a per-player map) draws
 * its cell from the world's content stack exactly as the one-region view does
 * (`mazeRoomUI._tileArtStack` / `_startTileArtLoad`), through the SAME seams:
 * the tiles by `mazeTileArt.drawTileArt` (R2b), a concept gate or item by
 * `drawConceptArt` (R5), a thing by `mazeThingOverlay.drawMazeThings` (S2).
 * Each falls back to the colour + symbol it drew before. ⛔ No art logic lives
 * here: only WHICH cell asks which seam, and the load.
 *
 * ⚠ `drawRegion` IS SYNCHRONOUS; THE ART IS NOT (the Seedling cell painter's
 * pattern, `flashPanel/seedlingCompositeMap.js`). The stack is read off
 * `geom.source` (`{rules, playerId}`); ONE load per stack serves every cell and
 * every host. On a miss the cell draws its no-art fallback and the load calls
 * each host's `geom.requestRedraw` once, and only if it brought art.
 *
 * ⛔ A world with no theme draws exactly what it drew before: its stack is the
 * maze's default pack, which carries no art key, so the load resolves
 * `tileArt: null` and every seam below is skipped (`mazeCompositeArt.test.js`
 * pins the ops). A world with no things draws no thing pass. A maze world laid
 * on a Seedling atlas (`world.atlas`) gets no tile art, as in the one-region
 * view, where the Seedling skin draws instead.
 */

import { TILE_WALL, getTile } from './mazeRoomEngine.js';
import {
    DEFAULT_ITEMS, DEFAULT_OBSTACLES,
    isObstacleCleared, getItemRenderHints,
} from '../shared/procgen/library.js';
import { TILE_PX, COLORS, compositeMapIdOf } from '../procgenCore/compositeMapRenderer.js';
import { isConceptGate, paintConceptGate } from './mazeConcepts.js';
import { conceptArtFrame, drawConceptArt, drawMazeTile, loadMazeTileArt } from './mazeTileArt.js';
import { drawMazeTileKinds } from './mazeTileKindOverlay.js';
import { drawMazeThings } from './mazeThingOverlay.js';
import {
    CONCEPT_ART_CLEARED_ALPHA, drawArrowTraps, drawConsumableTile, drawLiveMarkers,
} from './mazeRoomRender.js';
import {
    RECORDED_EXISTS_KEY, browserPackIo, documentContentOf, documentWorldSettingsOf, effectiveContentStack,
} from '../procgenPipeline/worldContent.js';
import { browserDecoder, browserRasteriser } from '../artLibrary/artLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/* ══════════════════════════════════════════════════════════════════════
 * THE ART STACK (TIDY-1)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * The slot a source names: its `playerId`, or — when the host names none (a
 * pipeline run's map has no `region_atlas` slot to name) — the document's ONE
 * `procgen_metadata` slot when it has exactly one. Otherwise null (no theme).
 */
function slotOf(source) {
    if (source?.playerId !== null && source?.playerId !== undefined) return source.playerId;
    const slots = Object.keys(source?.rules?.procgen_metadata ?? {});
    return slots.length === 1 ? slots[0] : null;
}

/**
 * ⛓ The region's effective content stack for its ART: its substrate's default
 * pack, then the slot's recorded "what exists" packs, then its recorded content
 * (`worldContent.effectiveContentStack`, the one stack rule `mazeRoomUI._tileArtStack`
 * uses; ⛓ GEN-2: the `exists` packs too, so a kind the generator placed from one
 * draws from it). No source → the default pack alone. A list that does not parse
 * draws without it, by name.
 */
export function mazeCompositeStackOf(region, source = null, registry = substrateRegistry) {
    const id = compositeMapIdOf(region);
    let content = [];
    let exists = [];
    const slot = slotOf(source);
    if (source?.rules && slot !== null) {
        try {
            content = documentContentOf(source.rules, slot);
        } catch (err) {
            console.warn(`[mazeCompositeMap] the world's content list is unreadable (${err.message}); drawing without it`);
        }
        try {
            exists = documentWorldSettingsOf(source.rules, slot)[RECORDED_EXISTS_KEY];
        } catch (err) {
            console.warn(`[mazeCompositeMap] the world's "what exists" list is unreadable (${err.message}); drawing without it`);
        }
    }
    return effectiveContentStack({ substrateIds: id ? [id] : [], exists, content, registry });
}

/** stack key → `{ status: 'loading'|'ready'|'failed'|'unavailable', loaded, error, waiters }`. */
const artCache = new Map();
let artIo = null;

/** The io a load uses: the test seam's, else the browser's; null in a host with neither (node). */
function currentArtIo() {
    if (artIo) return artIo;
    if (typeof globalThis.document === 'undefined' || typeof globalThis.fetch !== 'function') return null;
    return { ...browserPackIo(), decode: browserDecoder(), rasterise: browserRasteriser() };
}

/**
 * The seam's `tileArt` for a stack, or null (draw without art): null while it
 * loads, when it failed, when it brought no art, and in a host that cannot load.
 * A miss starts the ONE load for that stack, with the substrate's `contentRoles`
 * (R5/S2: the gate, item and thing art keys); `requestRedraw` (a host's stable
 * callback) is called once when that load lands with art.
 */
function tileArtForStack(stack, requestRedraw, contentRoles) {
    if (stack.length === 0) return null;
    const key = stack.join(',');
    let entry = artCache.get(key);
    if (!entry) {
        const io = currentArtIo();
        entry = { status: io ? 'loading' : 'unavailable', loaded: null, error: null, waiters: new Set() };
        artCache.set(key, entry);
        if (io) {
            loadMazeTileArt(stack, { contentRoles, ...io }).then((loaded) => {
                if (artCache.get(key) !== entry) return;
                if (loaded.failed.length) console.warn(`[mazeCompositeMap] ${loaded.failed.length} sheet(s) failed (drawn in the maze's own colours): ${loaded.failed.join('; ')}`);
                entry.status = 'ready';
                entry.loaded = loaded;
                const waiters = [...entry.waiters];
                entry.waiters.clear();
                // ⛓ TILE-3: a stack that declares tile kinds redraws too (a placed kind's base is known now).
                if (loaded.tileArt || Object.keys(loaded.tileKinds ?? {}).length) for (const redraw of waiters) redraw();
            }, (err) => {
                if (artCache.get(key) !== entry) return;
                console.error(`[mazeCompositeMap] the art did not load (drawn in the maze's own colours): ${err.message}`);
                entry.status = 'failed';
                entry.error = err.message;
                entry.waiters.clear();
            });
        }
    }
    if (entry.status === 'loading' && typeof requestRedraw === 'function') entry.waiters.add(requestRedraw);
    return entry.status === 'ready' ? entry.loaded.tileArt : null;
}

/**
 * What a stack's load came to, for the in-app row and the tests: `{ stack,
 * status, error, keyed, conceptArt, thingArt, sheets, failedSheets }`
 * (`status` 'idle' before any cell asked for it).
 */
export function mazeCompositeArtStatus(stack) {
    const entry = artCache.get(stack.join(','));
    const l = entry?.loaded;
    return {
        stack: [...stack],
        status: entry?.status ?? 'idle',
        error: entry?.error ?? null,
        keyed: { ...(l?.keyed ?? {}) },
        conceptArt: JSON.parse(JSON.stringify(l?.conceptArt ?? {})),
        thingArt: JSON.parse(JSON.stringify(l?.thingArt ?? {})),
        sheets: l?.tileArt?.images?.size ?? 0,
        failedSheets: l?.failed?.length ?? 0,
    };
}

/** The seam's `tileArt` a stack's load came to (`{ art, images, conceptArt, thingArt }`), or null — for the in-app row. */
export function mazeCompositeTileArt(stack) {
    const entry = artCache.get(stack.join(','));
    return entry?.status === 'ready' ? entry.loaded.tileArt : null;
}

/**
 * ⛓ TILE-3 — the stack's declared tile kinds (`mazeTileArt.tileKindKeys`), or undefined while its load is in flight
 * (draw no placed kind yet, rather than a placeholder the load would replace). An empty stack, a failed load and a host
 * that cannot load answer `{}`: every placed kind is then undeclared and draws the placeholder.
 */
function tileKindsForStack(stack) {
    if (stack.length === 0) return {};
    const entry = artCache.get(stack.join(','));
    if (!entry || entry.status === 'loading') return undefined;
    return entry.loaded?.tileKinds ?? {};
}

/** Resolves once the stack's load (if one started) has landed, either way. */
export async function mazeCompositeArtSettled(stack) {
    for (let i = 0; i < 1000 && artCache.get(stack.join(','))?.status === 'loading'; i++) {
        await new Promise((r) => setTimeout(r, 0));
    }
    return mazeCompositeArtStatus(stack);
}

/**
 * TEST SEAM: load through `io` (`{ base, readJson, decode, rasterise? }`)
 * instead of the browser's, and forget every load; `null` restores the browser's.
 */
export function setMazeCompositeArtIoForTests(io) {
    artIo = io;
    artCache.clear();
}

/** TEST SEAM: forget every load (the io stays). */
export function resetMazeCompositeArtForTests() {
    artCache.clear();
}

/* ══════════════════════════════════════════════════════════════════════
 * THE CELL
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ TILE-1 — THE KINDS OF `mazeTileArt.MAZE_ART_KEYS` THIS CELL DOES NOT DRAW, each with its reason. Every other row is
 * drawn here through the same chain as the one-region view (`mazeTileFallback.test.js` holds both views to the table).
 */
export const MAZE_COMPOSITE_UNDRAWN = Object.freeze({
    player: 'the composite map draws a world\'s layout, not a play state: its geometry carries no player position, and '
        + 'the one-region view also draws no player before play (`plainView`\'s `playerPos: null`). Drawing one at the '
        + 'entrance would claim a position nobody holds.',
});

/**
 * Paint one maze region into its composite-map cell.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} region the grid region — its `playable_payload` is the
 *   deserialized maze world (tiles / exits / items / obstacles).
 * @param {{offX:number, offY:number, regionSize:{width,height},
 *   tilePx?:number, colors?:object, source?, requestRedraw?, registry?,
 *   tileArt?:object|null}} geom cell origin + the shared geometry (`tileArt`: TILE-1's held art, else the load).
 *   ⛓ `regionSize` is the GRID's uniform cell, which can be larger than this
 *   world; the maze paints its own `world.width`/`world.height` from the
 *   origin, exactly as the panel's version did.
 */
export function drawMazeCompositeRegion(ctx, region, {
    offX, offY, tilePx = TILE_PX, colors = COLORS, source = null, requestRedraw = null,
    registry = substrateRegistry, tileArt: heldArt = undefined, tileKinds: heldKinds = undefined,
} = {}) {
    const world = region?.playable_payload;
    if (!world) return;
    // ⛓ TIDY-1: the theme's art, or null (every kind below then draws its own shape, as before the art seam).
    // ⛓ TILE-1: a host that already holds the seam's `tileArt` (or null) may pass it as `geom.tileArt` instead of the
    //   load (`mazeTileFallback.test.js` draws both views from one stub this way).
    const tileArt = heldArt !== undefined ? heldArt : world.atlas ? null : tileArtForStack(mazeCompositeStackOf(region, source, registry), requestRedraw,
        registry?.get?.(compositeMapIdOf(region))?.contentRoles ?? null);
    // ⛓ TILE-1: every kind through the one chain (`mazeTileArt.drawMazeTile`): the art, else the `own` shape.
    const tile = (thing, x, y, own) => drawMazeTile(ctx, tileArt, thing, offX + x * tilePx, offY + y * tilePx, tilePx, { own });
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
            const kind = getTile(world, x, y) === TILE_WALL ? 'wall' : 'floor';
            tile(kind, x, y, () => {
                ctx.fillStyle = colors[kind];
                ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
            });
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

            // R2b: an OPEN exit is a thing (`maze:tile/exit`); a closed one is a state signal and stays red.
            if (isExit && isLogicGate && gateClosed) {
                ctx.fillStyle = colors.exitBlocked;
                ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
            } else if (isExit) {
                tile('exit', x, y, () => {
                    ctx.fillStyle = colors.exit;
                    ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
                });
            }
            if (obstacle && !isLogicGate) {
                const color = obstacle.color ?? '#b84040';
                ctx.fillStyle = color;
                ctx.fillRect(offX + x * tilePx + 2, offY + y * tilePx + 2, tilePx - 4, tilePx - 4);
            }
            // ⛓ CONCEPT LIBRARY T1 — a concept's skin, as the panel paints it
            // (always closed here: the composite view has no inventory).
            // ⛓ R5: or the concept's ART for the `gate` role, as `mazeRoomRender.drawWorld` draws it.
            if (isConceptGate(obstacle)) {
                if (conceptArtFrame(tileArt, 'gate', obstacle.concept)) {
                    ctx.save();
                    if (!gateClosed) ctx.globalAlpha = CONCEPT_ART_CLEARED_ALPHA;
                    drawConceptArt(ctx, tileArt, 'gate', obstacle.concept,
                        offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
                    ctx.restore();
                } else {
                    paintConceptGate(ctx, {
                        x0: offX + x * tilePx, y0: offY + y * tilePx, px: tilePx, def: obstacle, cleared: !gateClosed,
                    });
                }
            }
            // ⛓ R5: an item row naming its mechanic draws the concept's ART for the `item` role, else the disc.
            const itemConcept = itemId ? itemLib?.[itemId]?.concept : undefined;
            const itemArt = typeof itemConcept === 'string' && tileArt !== null
                && drawConceptArt(ctx, tileArt, 'item', itemConcept, offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
            if (itemId && !itemArt) {
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
            }
            if (itemId && isLogicGate && gateClosed) {
                ctx.strokeStyle = colors.locationBlocked;
                ctx.lineWidth = 2;
                ctx.strokeRect(offX + x * tilePx + 1, offY + y * tilePx + 1, tilePx - 2, tilePx - 2);
            }
            if (isEntrance && !isExit) {
                tile('entrance', x, y, () => {
                    ctx.strokeStyle = colors.entrance;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(offX + x * tilePx + 1, offY + y * tilePx + 1, tilePx - 2, tilePx - 2);
                });
            }
        }
    }

    // ⛓ TILE-1: the rest of the kinds, by the one-region view's OWN drawers at this cell's origin — the mana and
    //   consumable tiles, the arrow traps, then the live markers (pulsers, pulls, buttons, blocks). As the gates above,
    //   the map has no play state: the world's own block layout, every lane and pulser silent, every pull's gate shut,
    //   nothing collected. No player (`MAZE_COMPOSITE_UNDRAWN`). A world with none of these draws nothing more.
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            const key = `${x},${y}`;
            const mana = world.manaTiles?.get(key);
            const consumable = world.consumableTiles?.get(key);
            if (mana || consumable) {
                drawConsumableTile(ctx, tileArt, offX + x * tilePx, offY + y * tilePx, tilePx, { mana, consumable });
            }
        }
    }
    const markerView = {
        tilePx, offX, offY, seedlingSkin: null, tileArt, inventory, ruleEvaluator: null,
        armedTraps: null, livePulsers: null, blocks: null, blockKinds: null, playerPos: null, latched: null,
    };
    drawArrowTraps(ctx, world, markerView);
    drawLiveMarkers(ctx, world, markerView);

    // ⛓ TILE-3: the region's placed tile kinds (`mazeTileKindOverlay.drawMazeTileKinds`, the panel's own pass), by the
    //   stack's declared kinds (a host may pass them as `geom.tileKinds`, as `geom.tileArt`). A world with none draws
    //   nothing here.
    if (world.tileKinds instanceof Map && world.tileKinds.size > 0 && !world.atlas) {
        const declared = heldKinds !== undefined ? heldKinds : tileKindsForStack(mazeCompositeStackOf(region, source, registry));
        if (declared !== undefined) {
            drawMazeTileKinds(ctx, world, {
                tilePx, offX, offY, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt, tileKinds: declared,
            });
        }
    }

    // ⛓ S2: the region's things (`mazeThingOverlay.drawMazeThings`, the panel's own pass): art by their pack concept,
    //   else the sign / the baked look. No fog and no player on the composite map. A world with none draws nothing.
    if (Array.isArray(world.things) && world.things.length > 0 && !world.atlas) {
        drawMazeThings(ctx, world, {
            tilePx, offX, offY, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt,
        });
    }
}
