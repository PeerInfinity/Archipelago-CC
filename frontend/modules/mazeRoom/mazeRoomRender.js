/**
 * mazeRoom/mazeRoomRender — **THE ONE CANVAS DRAW** for a maze world.
 *
 * CONSTRUCTIVE-MODE arc, slice 3 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). ⚖ Ruling 7: the maze lab page is NEW and built from the
 * headless modules, *"with the canvas draw extracted from `mazeRoomUI`"* — not
 * a refactor of the 4,145-line panel into a page. This file is that extraction,
 * and it is the whole of it: `MazeRoomUI._drawWorld` is now a five-line adapter
 * that builds a `view` from `this` and calls `drawWorld` here, and
 * `mazeRoom/lab.html` calls the SAME function with a view of its own.
 *
 * ── ⛔⛔ `view` IS THE **WHOLE** INPUT — THERE ARE NO HIDDEN READS ──────
 *
 * The body below used to read fourteen things off `this`: the player's
 * position, the inventory (local or external), the fog set, three visibility
 * predicates, the playback flag, the checked-location set, the rule evaluator,
 * the consumable-collected probe, and the region id that probe is keyed by. In
 * the panel every one of them is a method or a field; on a standalone page
 * NONE of them exist. So they are PARAMETERS, all of them, in one frozen bag —
 * and the reason that is a law rather than a style is that a single surviving
 * `this.` read would make the function work in the panel and silently draw a
 * different picture on the page, which is exactly the "one renderer" claim the
 * lab pages rest on.
 *
 * ⚠ `assertView` REFUSES A MISSING FIELD BY NAME rather than defaulting it. A
 * default for `isTileVisible` would be "everything is visible", which is a
 * picture — and a caller that forgot to pass fog would get a plausible room
 * with the fog silently off. Every field is named; `null` is how "I have no
 * such thing" is spelled, and each one says what `null` means.
 *
 * ── THE `view` CONTRACT, FIELD BY FIELD ───────────────────────────────
 *
 *   tilePx                number   the side of one tile in canvas pixels. ⛔ NOT
 *                                  defaulted here: the panel's canvas is sized
 *                                  `width*TILE_PX` by the panel, and a renderer
 *                                  that assumed a different number would draw
 *                                  outside it.
 *   playerPos             {x,y}|null   null = draw no player (the pre-play view)
 *   inventory             Set          what the player HOLDS — decides whether a
 *                                  door reads cleared and (outside playback)
 *                                  whether an item is still on the floor
 *   isPlayback            boolean  playback tracks pickups PER LOCATION, dev
 *                                  flow by inventory. Two different truths; the
 *                                  flag chooses which, it does not merge them.
 *   checkedLocations      Set      playback's per-location pickup truth
 *   ruleEvaluator         fn|null  `(rule) => boolean` for `clear_set_type:
 *                                  'rule'` obstacles; null = the library's own
 *                                  local subset evaluator (dev / standalone)
 *   fogEnabled            boolean
 *   isTileVisible         (x,y)=>boolean   consulted ONLY when `fogEnabled`
 *   seenTiles             Set|null "x,y" keys; the fog blackout paints every
 *                                  tile NOT in it. null blacks the room out
 *                                  whole, which is what an unseeded fog is.
 *   isExitVisible         (exit)=>boolean   discovery filter (playback only)
 *   isLocationVisible     (name)=>boolean   discovery filter (playback only)
 *   isConsumableCollected (x,y)=>boolean|null  null = nothing tracks them (the
 *                                  panel closes its region id into this; the
 *                                  page has no regions at all)
 *
 * ── ⛓ THE GATE IS AN ORDERED DRAW-OP LOG, AND WHY THAT IS THE PIXELS ──
 *
 * The unit runner is `environment: 'node'` with no jsdom and no `canvas`
 * package (`vitest.config.js`), so nothing here can rasterise and
 * `getImageData` is not available at any price. `mazeRoomRender.test.js`
 * instead drives BOTH paths through a context that RECORDS every call and
 * every property assignment in order — and **throws on any member it does not
 * know**, so an unrecorded operation is a loud failure rather than a hole in
 * the gate. Since the log contains every state mutation (`fillStyle`,
 * `lineWidth`, `globalAlpha`, `save`/`restore`, `setLineDash`, the font trio)
 * as well as every geometry call, two runs with equal logs paint equal pixels
 * on equal-sized canvases: the log is a SUPERSET of what determines the raster.
 * It is therefore a STRICTER gate than a pixel hash — two op sequences that
 * happen to paint the same pixels would still differ — which is the right
 * direction for a behaviour-preserving extraction. Stated here because a
 * reader is entitled to know the gate is not literally `getImageData`.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: this module is on the panel's path, on the lab
 * page's path, and in a node unit runner.
 */

import {
    DEFAULT_ITEMS, DEFAULT_OBSTACLES, getItemRenderHints, isObstacleCleared,
} from '../shared/procgen/library.js';
import { drawHazards } from '../shared/procgen/contentModules/hazardRender.js';
import { TILE_WALL, getTile } from './mazeRoomEngine.js';

export class MazeRenderError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MazeRenderError';
    }
}

const fail = (message) => { throw new MazeRenderError(message); };

/** The panel's tile size, and the page's default. One number, one home. */
export const TILE_PX = 20;

export const COLORS = {
    floor: '#2a2a2a',
    wall: '#000000',
    // §5 tile-rendering rules:
    // - Entrance: 2px solid green border
    // - Exit (no gate / open gate): solid green fill
    // - Exit (closed gate): solid red fill
    // - Location (closed gate): item sprite + 2px solid red border
    // - Both entrance and exit: follow the exit row
    entrance: '#3aa85a',
    exit: '#3aa85a',
    exitBlocked: '#d04040',
    locationBlocked: '#d04040',
    player: '#4aa8ff',
    grid: '#1a1a1a',
    // X1: mana-refill tiles get a fixed blue; cross-game consumable
    // tiles get a per-substrate hue from consumableTileColor below.
    manaTile: '#5ac8e8',
};

/**
 * Stable hue per owning substrate for X1 consumable tiles, so every
 * omsi tile looks like every other omsi tile without needing a
 * registry-wide color declaration. Same hash-to-HSL trick
 * getItemRenderHints uses for items with no library entry.
 */
export function consumableTileColor(substrateId) {
    let hash = 0;
    for (let i = 0; i < (substrateId?.length ?? 0); i++) {
        hash = ((hash << 5) - hash + substrateId.charCodeAt(i)) | 0;
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

/**
 * ⛓ THE FIELD LIST IS DECLARED, so `assertView` and this docblock cannot drift
 * — and so a page author can print it. `fn` fields are checked as functions
 * because passing a boolean where a predicate belongs would silently make the
 * whole room visible.
 */
export const VIEW_FIELDS = Object.freeze([
    'tilePx', 'playerPos', 'inventory', 'isPlayback', 'checkedLocations', 'ruleEvaluator',
    'fogEnabled', 'isTileVisible', 'seenTiles', 'isExitVisible', 'isLocationVisible',
    'isConsumableCollected',
]);

/** ⛔ Refuses a MISSING field by name; `null` is the way to say "none". */
export function assertView(view) {
    if (!view || typeof view !== 'object') {
        fail(`mazeRoomRender: drawWorld needs a view object — got ${JSON.stringify(view)}. `
            + `The view is the WHOLE input (fields: ${VIEW_FIELDS.join(', ')}); there is no `
            + 'reading of a panel instance left in this file for it to fall back on.');
    }
    for (const key of VIEW_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(view, key)) {
            fail(`mazeRoomRender: the view is missing "${key}". Every field is REQUIRED and `
                + '`null` is how "I have no such thing" is spelled — a default would be a '
                + 'PICTURE chosen by this file (an absent fog reads as "no fog", an absent '
                + 'visibility predicate as "everything is visible"), drawn under a caller\'s '
                + 'name.');
        }
    }
    if (!Number.isFinite(view.tilePx) || view.tilePx <= 0) {
        fail(`mazeRoomRender: view.tilePx must be a positive number, got `
            + `${JSON.stringify(view.tilePx)} — the canvas is sized from it by the caller, so `
            + 'a renderer that picked its own would draw outside the element.');
    }
    for (const key of ['isTileVisible', 'isExitVisible', 'isLocationVisible']) {
        if (typeof view[key] !== 'function') {
            fail(`mazeRoomRender: view.${key} must be a function, got `
                + `${JSON.stringify(view[key])}.`);
        }
    }
    return view;
}

/**
 * ⛓ THE PANEL'S OWN VIEW, WITH EVERY FILTER OFF — what a standalone page wants
 * for a world it just generated: no fog, no playback, no discovery, no regions.
 *
 * ⚠ It is a CONSTRUCTOR, not a default inside `drawWorld`. A default would be
 * this picture chosen silently; a named function is the caller saying which
 * picture they meant, and the lab page's own overrides sit on top of it.
 */
export function plainView({
    tilePx = TILE_PX, playerPos = null, inventory = null, ruleEvaluator = null,
} = {}) {
    return {
        tilePx,
        playerPos,
        inventory: inventory ?? new Set(),
        isPlayback: false,
        checkedLocations: new Set(),
        ruleEvaluator,
        fogEnabled: false,
        isTileVisible: () => true,
        seenTiles: null,
        isExitVisible: () => true,
        isLocationVisible: () => true,
        isConsumableCollected: null,
    };
}

/**
 * DRAW ONE MAZE WORLD onto a 2D context.
 *
 * ⛔ The body below is `MazeRoomUI._drawWorld`'s, moved, with every `this.*`
 * read replaced by the corresponding `view` field and `TILE_PX` by
 * `view.tilePx`. Nothing else changed — the draw ORDER, the branch structure,
 * the constants and the comments are the panel's, because the gate is that the
 * panel paints the same pixels.
 */
export function drawWorld(ctx, world, view) {
    if (!ctx) fail('mazeRoomRender: drawWorld needs a 2D context.');
    if (!world) fail('mazeRoomRender: drawWorld needs a world.');
    assertView(view);
    const w = world;
    const px = view.tilePx;
    const itemLib = w.itemLib ?? DEFAULT_ITEMS;
    const obstacleLib = w.obstacleLib ?? DEFAULT_OBSTACLES;
    const currentInv = view.inventory ?? new Set();
    // Build a clearance options bag once. When stateManager has
    // a snapshot ready, isObstacleCleared dispatches rule-typed
    // obstacles through the shared rule engine (full Rule Builder
    // schema). When it doesn't (dev/standalone), the local subset
    // evaluator handles Has/And/Or/True_/False_ as before.
    const clearOpts = view.ruleEvaluator ? { evaluateRule: view.ruleEvaluator } : undefined;

    // Tile base layer: floor / wall.
    for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
            const tile = getTile(w, x, y);
            ctx.fillStyle = tile === TILE_WALL ? COLORS.wall : COLORS.floor;
            ctx.fillRect(x * px, y * px, px, px);
        }
    }

    // Build a quick lookup from tile coords to the exit at that
    // position (if any), so the per-tile rendering decisions
    // below don't have to walk world.exits each time.
    const exitAt = new Map();
    for (const e of w.exits.values()) {
        exitAt.set(`${e.x},${e.y}`, e);
    }

    // Per-location pickup truth in playback mode — see
    // _currentCheckedLocations for why inventory-keyed checks
    // can't stand in for this (multi-instance items, e.g.
    // Adventure's 12 Freeincarnates).
    const isPlayback = view.isPlayback;
    const checkedLocations = view.checkedLocations ?? new Set();

    // §5 rendering pass — exits, entrance border, combo-list
    // obstacles, items, and gate borders, in an order that gets
    // each tile's stack of overlays right.
    for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
            const key = `${x},${y}`;
            // Fog of war: tiles outside the seen-set get blacked
            // out at the end of this method. Skip overlay work
            // here so undiscovered items / exits / gate borders
            // don't even render before the blackout.
            if (view.fogEnabled && !view.isTileVisible(x, y)) continue;
            const obstacleId = w.obstacles.get(key);
            const obstacle = obstacleId ? obstacleLib[obstacleId] : null;
            const isLogicGate = obstacle?.clear_set_type === 'rule';
            const gateClosed = isLogicGate
                && !isObstacleCleared(obstacleId, currentInv, obstacleLib, clearOpts);
            const exit = exitAt.get(key);
            const isExit = !!exit;
            const isEntrance = (x === w.entrance.x && y === w.entrance.y);
            const itemId = w.items.get(key);
            // Playback mode tracks pickups per-location (locationName
            // baked into the sidecar) so multi-instance items only
            // disappear at the specific tile that was checked.
            // Generate dev flow has no locationNames — falls back
            // to the inventory-keyed check.
            const locationName = isPlayback ? w.itemLocationNames?.get(key) : null;
            const itemCollected = isPlayback
                ? (locationName ? checkedLocations.has(locationName) : false)
                : currentInv.has(itemId);
            const itemHere = itemId && !itemCollected;

            // Discovery filter — only applies in playback mode.
            // Exits hide their fill and items hide their sprite
            // when discovery mode is active and the entry hasn't
            // been discovered yet. Underlying tile (floor / wall /
            // entrance) still renders; only the AP-overlays gate.
            const exitVisible = !isPlayback || !exit
                || view.isExitVisible(exit);
            const locationVisible = !isPlayback || !locationName
                || view.isLocationVisible(locationName);

            // Exit fill: green by default, red when a logic gate
            // sits on the tile and isn't cleared. (Both-row of
            // §5 table is "follows the exit row" — this branch
            // covers it because we don't paint the entrance
            // border when isExit is true.)
            if (isExit && exitVisible) {
                ctx.fillStyle = (isLogicGate && gateClosed) ? COLORS.exitBlocked : COLORS.exit;
                ctx.fillRect(x * px, y * px, px, px);
            }

            // Combo-list obstacles (colored doors) keep their
            // existing rendering. Logic gates are NOT painted as
            // tile-fill obstacles — their visual is handled
            // through the exit-fill / location-border paths.
            if (obstacle && !isLogicGate) {
                const color = obstacle.color ?? '#b84040';
                // combo_list obstacles (colored doors) don't use
                // the rule engine — clearOpts is harmless here
                // but unnecessary; pass it for symmetry.
                const cleared = isObstacleCleared(obstacleId, currentInv, obstacleLib, clearOpts);
                if (cleared) {
                    ctx.save();
                    ctx.globalAlpha = 0.4;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([3, 3]);
                    ctx.strokeRect(x * px + 3, y * px + 3, px - 6, px - 6);
                    ctx.restore();
                } else {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * px + 2, y * px + 2, px - 4, px - 4);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * px + 2, y * px + 2, px - 4, px - 4);
                }
            }

            // Items: a circle in the library's color. Skipped
            // when the player already collected the item, or when
            // discovery mode hides this location. Foreign items
            // (no library entry) get a hash-derived color and a
            // first-letter label so they're visually distinguishable
            // from each other and from known items.
            if (itemHere && locationVisible) {
                const hints = getItemRenderHints(itemId, itemLib);
                ctx.fillStyle = hints.color;
                const cx = x * px + px / 2;
                const cy = y * px + px / 2;
                ctx.beginPath();
                ctx.arc(cx, cy, px * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                if (hints.label) {
                    ctx.save();
                    ctx.fillStyle = '#000';
                    ctx.font = `bold ${Math.floor(px * 0.45)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(hints.label, cx, cy);
                    ctx.restore();
                }
            }

            // X1 consumable tiles. Drawn as a DIAMOND rather than a
            // circle so they read as categorically different from
            // AP item pickups at a glance — which they are: not
            // locations, not tracked, no bearing on winnability.
            // Not gated on locationVisible: discovery mode filters
            // AP locations, and these aren't any.
            const consumableHere = w.consumableTiles?.get(key);
            const manaHere = w.manaTiles?.get(key);
            if (consumableHere || manaHere) {
                const collected = view.isConsumableCollected?.(x, y);
                const cx = x * px + px / 2;
                const cy = y * px + px / 2;
                const r = px * 0.32;
                ctx.save();
                // Collected tiles stay faintly visible rather than
                // vanishing: under loop mode they come back on the
                // next reset (X1-R1), so showing where they are is
                // useful information, not clutter.
                if (collected) ctx.globalAlpha = 0.25;
                ctx.beginPath();
                ctx.moveTo(cx, cy - r);
                ctx.lineTo(cx + r, cy);
                ctx.lineTo(cx, cy + r);
                ctx.lineTo(cx - r, cy);
                ctx.closePath();
                if (manaHere) {
                    ctx.fillStyle = COLORS.manaTile;
                } else {
                    // Hash the owning substrate id to a stable hue so
                    // each foreign game's tiles read as a family,
                    // mirroring getItemRenderHints' fallback.
                    ctx.fillStyle = consumableTileColor(consumableHere.substrate);
                }
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                const label = manaHere
                    ? 'M'
                    : (consumableHere.type?.[0] ?? '?').toUpperCase();
                ctx.fillStyle = '#000';
                ctx.font = `bold ${Math.floor(px * 0.4)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, cx, cy);
                ctx.restore();
            }

            // Closed logic gate marker: 2px red border. Drawn
            // independently of the item sprite so the gate stays
            // visible even after its underlying location's item
            // has been "collected" — which can happen for any
            // tile sharing an item id with an already-checked
            // location, since `currentInv` is keyed by item name
            // not location name. (See §5 — the spec's "Location
            // closed" row anticipated only the item-present case;
            // this fallback covers the no-item case too.) Skipped
            // on exit tiles, which already render their closed
            // state via the full red fill above. Also hidden when
            // discovery mode filters this location — otherwise
            // the border would leak "something's here" before the
            // location was supposed to be visible.
            if (isLogicGate && gateClosed && !isExit && locationVisible) {
                ctx.strokeStyle = COLORS.locationBlocked;
                ctx.lineWidth = 2;
                ctx.strokeRect(x * px + 1, y * px + 1, px - 2, px - 2);
            }

            // Entrance border: 2px solid green, only when the
            // tile isn't also an exit (per the §5 "both = exit
            // row" rule).
            if (isEntrance && !isExit) {
                ctx.strokeStyle = COLORS.entrance;
                ctx.lineWidth = 2;
                ctx.strokeRect(x * px + 1, y * px + 1, px - 2, px - 2);
            }
        }
    }

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= w.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * px + 0.5, 0);
        ctx.lineTo(x * px + 0.5, w.height * px);
        ctx.stroke();
    }
    for (let y = 0; y <= w.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * px + 0.5);
        ctx.lineTo(w.width * px, y * px + 0.5);
        ctx.stroke();
    }

    // Hazard overlays — red paths + facing triangles. Drawn after
    // grid lines (so the path is visually on top of the grid
    // texture) and before the fog overlay (so unseen hazards
    // properly hide behind fog). Hazards live on world.hazards
    // when a content-module-aware procgen pipeline produced this
    // region; legacy worlds without the field render normally.
    drawHazards(ctx, w.hazards, px);

    // Fog overlay — paint solid black over every unseen tile. Runs
    // after grid lines so the grid doesn't leak the unexplored
    // shape, and before the player render so the player always
    // shows on top. Player's own tile is always in the seen-set
    // (any movement onto it expanded visibility), so this never
    // covers the player.
    if (view.fogEnabled) {
        const seen = view.seenTiles;
        ctx.fillStyle = '#000';
        for (let y = 0; y < w.height; y++) {
            for (let x = 0; x < w.width; x++) {
                if (seen && seen.has(`${x},${y}`)) continue;
                ctx.fillRect(x * px, y * px, px, px);
            }
        }
    }

    if (view.playerPos) {
        const { x, y } = view.playerPos;
        ctx.fillStyle = COLORS.player;
        ctx.beginPath();
        ctx.arc(x * px + px / 2, y * px + px / 2, px * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }
}
