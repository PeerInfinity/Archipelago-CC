/**
 * seedlingDemo/seedlingSkinRenderer — **A SEEDLING ROOM IN THE ORIGINAL
 * GRAPHICS** (Seedling JS graphics G1: tiles and static objects). The JS
 * runtime page's opt-in painter (`?graphics=<stack>`, the flash panel setting
 * `seedlingJsGraphics`); the rectangle paint stays the default and the
 * fallback for every key the pack stack lacks.
 *
 * Two halves, split so node can pin the first without a canvas:
 *
 *   · `roomOps(world, art, opts)` — PURE. Reads the room (`world`, from
 *     `buildLevelWorld`), the player's position and the uncollected AP items;
 *     returns the draw list in paint order: `{ key, sheetRef, sx, sy, sw, sh,
 *     dx, dy, rot, flipX, flipY, layer, fallback }` for a sprite, `{ rect,
 *     colour, alpha, layer }` for a rectangle. Node golden lists pin the frame
 *     CHOICE through it (`formatOp`), never pixels.
 *   · `paintOps(ctx, ops, images, view, canvas)` — the canvas half. A sprite
 *     whose sheet has not decoded (or failed) is drawn as its fallback rect.
 *
 * ⛔ THE RENDERER ONLY READS. It never writes sim state, never steps the sim
 * and never draws from the sim's RNG: the original's cosmetic draws
 * (`Rng.cos()` tile phases, rotations, flips) come from `cosmeticRand`, its own
 * hash of (level, cell, salt) — so the variants are stable per cell but do not
 * match the wasm build pixel for pixel, BY RULING (⚖ never model the cosmetic
 * RNG). A state-identity test (`seedlingSkinRenderer.test.js`) holds a real
 * walk's state and reports byte-identical with this renderer running and not.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src`) ─────────────────
 *
 *   · TILES — one sheet per type (`Game.as:216-302`), `centerOO`d on a tile
 *     centred at the cell, so a frame's top-left is the cell's top-left.
 *     `Tile.check()` (`Tile.as:489-511`) is the AUTOTILER: +1 if the right
 *     neighbour is the same type or a Cliff (t 9), +2 above, +4 left, +8 below
 *     (same type ONLY — "the cliff shouldn't clip below"); a missing cell adds
 *     nothing. The other types are a single frame, the world clock, a random
 *     frame/rotation/flip, or the bridge's state animation (`Tile.as:124-487`).
 *   · CLIFFSIDES — an explicit frame per cell (`CliffSide.as:39`), layer 0.
 *   · SCENERY — drawn at the OEL position plus the art's `origin`; the frame is
 *     a TREE's neighbour mask (`Tree.as:59-66`: another "Tree" 1 px right/up/
 *     left/down, or the room edge) or a POLE's (`Pole.as` check: +1 right,
 *     +2 left, +4 below, poles only), else 0 or the art's own animation.
 *   · Y-SORT — FlashPunk draws the HIGHEST `layer` first; `layer` is each
 *     class's own `-(y - originY + k·height)` (`Mobile.as:56` for movers,
 *     `Tile.as:21` LAYER = 100 for tiles). `SCENERY` below carries each k.
 *
 * ⛓ G2: the player's sprites come from `seedlingPlayerSkin.js` (`playerOps`)
 * through `opts.playerSprites`; without them the player is the white hitbox.
 *
 * ⛓ G3: the enemies, spinners and arrows (`seedlingEnemySkin.enemyOps`) come
 * through `opts.entitySprites`, Y-sorted with everything else; the AP items
 * drawn as their looks (`seedlingEnemySkin.apItemOps`) through
 * `opts.apItemSprites`, which then replace G1's logo-for-every-item. Without
 * them the list is G1/G2's, op for op.
 *
 * ⛓ G1.5: `paintOps`' `tileLayer` paints the still tiles ONCE onto an
 * offscreen canvas (and the animated ones onto a second, only when one of
 * them changes frame) and blits it, with the same pixels; `roomOps` builds
 * the tile ops once per (room, art). Room mode on the big rooms is the gain.
 *
 * ⛓ G7: the stairs, the live pushable blocks and the sand traps (`seedlingPuzzleSkin.puzzleOps`) come through
 * `opts.entitySprites`; the blocks' build-time rectangles through `drawnObjects` and the stairs' teleporter
 * rectangles through `drawnTeleporters` are then not painted.
 *
 * ⛔ NOT YET (G4+ of the ladder, and G3's remaining classes): broken rocks / opened chests / burned trees (every
 * solid with a run-changeable id stays a rectangle, at its START position —
 * the rect view's known limitation), grass blades, the bridge's opening, the
 * lighting passes, and the torches' `flip` attribute (the world does not keep
 * it).
 */
import { TILE_COLUMN_VARIANTS } from '../flashPanel/seedlingSemantics.js';
import {
    FLOOR_COLOUR, OBJECT_SOLID_FAMILIES, SOLID_COLOUR, TILE_COLOURS, objectSolidColour,
} from './rectPalette.js';

export const TILE = 16;
/** `Tile.as:21` — every tile renders on layer 100, under everything else. */
export const TILE_LAYER = 100;
/** `Main.as:36` `super(160, 160, FPS)` — the original's view. */
export const SCREEN = 160;

export const AP_ITEM_COLOUR = '#e8c040';
export const TELEPORTER_COLOUR = '#3fd8ce';
export const PLAYER_COLOUR = '#ffffff';

/** The camera modes (the flash panel setting `seedlingJsCamera`, the page's `?camera=`). */
export const CAMERA_MODES = Object.freeze(['room', 'follow']);

/**
 * A stable cosmetic draw in [0, 1) for (level, a, b, salt) — the renderer's
 * stand-in for AS3's per-tile `randVal` (`Rng.cos()`). A 32-bit integer hash;
 * it touches no global state, so it cannot perturb anything else.
 */
export function cosmeticRand(level, a, b, salt = 0) {
    let h = 0x811c9dc5 ^ (level | 0);
    for (const v of [a | 0, b | 0, salt | 0]) {
        h = Math.imul(h ^ v, 0x01000193);
        h ^= h >>> 15;
        h = Math.imul(h, 0x2c1b3c6d);
        h ^= h >>> 12;
    }
    return (h >>> 0) / 4294967296;
}

/**
 * Tile type `t` → its art key and frame rule. `rule`:
 *   'autotile' — the `Tile.check()` mask; 'single' — frame 0;
 *   'anim'     — the art's animation `anim`, phase `floor(r·n)`;
 *   a function `(r, ctx) → { frame | anim, phase?, rot?, flipX?, flipY? }`.
 * Index = `t` (`TILE_TYPE_IDS`, `seedlingSemantics.js`).
 */
export const TILE_ART = Object.freeze([
    /*  0 */ { key: 'seedling:tile/ground', rule: 'autotile' },
    /*  1 */ { key: 'seedling:tile/water', rule: 'anim', anim: 'flow' },
    /*  2 */ { key: 'seedling:tile/stone', rule: 'autotile' },
    /*  3 */ { key: 'seedling:tile/brick', rule: 'single' },
    /*  4 */ { key: 'seedling:tile/dirt', rule: 'autotile' },
    /*  5 */ { key: 'seedling:tile/dungeonTile', rule: (r) => ({ frame: 0, rot: 90 * Math.floor(r[0] * 4) }) },
    /*  6 */ { key: 'seedling:tile/pit', rule: 'single' },
    /*  7 */ { key: 'seedling:tile/shieldTile', rule: 'autotile' },
    /*  8 */ { key: 'seedling:tile/forest', rule: 'autotile' },
    /*  9 */ { key: 'seedling:tile/cliff', rule: 'single' },
    /* 10 */ { key: 'seedling:tile/cliffStairs', rule: 'single' },
    /* 11 */ { key: 'seedling:tile/wood', rule: 'autotile' },
    /* 12 */ { key: 'seedling:tile/walkableWood', rule: 'autotile' },
    /* 13 */ { key: 'seedling:tile/cave', rule: 'single' },
    /* 14 */ { key: 'seedling:tile/woodNatural', rule: 'autotile' },
    /* 15 */ { key: 'seedling:tile/darkStone', rule: 'autotile' },
    /* 16 */ { key: 'seedling:tile/igneousStone', rule: 'autotile' },
    /* 17 */ { key: 'seedling:tile/lava', rule: 'anim', anim: 'flow' },
    /* 18 */ { key: 'seedling:tile/blueTile', rule: (r, { img }) => ({ frame: img === 15 ? 15 + Math.floor(7 * r[0]) : img }) },
    /* 19 */ { key: 'seedling:tile/blueWall', rule: 'autotile' },
    /* 20 */ { key: 'seedling:tile/blueWallDark', rule: 'autotile' },
    /* 21 */ { key: 'seedling:tile/snow', rule: 'autotile' },
    /* 22 */ { key: 'seedling:tile/ice', rule: (r) => ({ frame: Math.floor(r[0] * 4) }) },
    /* 23 */ { key: 'seedling:tile/iceWall', rule: () => ({ anim: 'shimmer' }) },
    /* 24 */ { key: 'seedling:tile/iceWallGlowing', rule: () => ({ anim: 'shimmer' }) },
    /* 25 */ { key: 'seedling:tile/waterfall', rule: (r, { column }) => ({
        anim: TILE_COLUMN_VARIANTS[column]?.continuous ? 'fallContinuous' : 'fall', phase: Math.floor(r[0] * 4) }) },
    /* 26 */ { key: 'seedling:tile/bodyFloor', rule: (r) => ({ anim: 'pulse', phase: Math.floor(r[0] * 6), flipX: r[0] < 0.5, rot: 180 * (Math.floor(2 * r[0]) - 1) }) },
    /* 27 */ { key: 'seedling:tile/bodyWall', rule: (r) => ({ anim: 'pulse', phase: Math.floor(r[0] * 6), flipX: r[0] < 0.5, rot: 180 * (Math.floor(2 * r[0]) - 1) }) },
    /* 28 */ { key: 'seedling:tile/ghostTile', rule: 'autotile' },
    /* 29 */ { key: 'seedling:tile/bridge', rule: () => ({ anim: 'closed' }) },
    /* 30 */ { key: 'seedling:tile/ghostTileStep', rule: 'single' },
    /* 31 */ { key: 'seedling:tile/igneousToLava', rule: 'single' },
    /* 32 */ { key: 'seedling:tile/oddTile', rule: 'autotile' },
    /* 33 */ { key: 'seedling:tile/fuchsiaTile', rule: 'autotile' },
    /* 34 */ { key: 'seedling:tile/oddTileWall', rule: 'autotile' },
    /* 35 */ { key: 'seedling:tile/rockWallDark', rule: (r) => ({ frame: Math.round(r[0]), rot: 180 * Math.floor(2 * r[0]) }) },
    /* 36 */ { key: 'seedling:tile/rockWall', rule: (r) => ({ frame: Math.round(r[0]) + 2, rot: 180 * Math.floor(2 * r[0]) }) },
    /* 37 */ { key: 'seedling:tile/rockWallFloor', rule: (r) => ({ frame: Math.round(r[0]) * 4, flipX: Math.round(r[1]) === 0, flipY: Math.round(r[2]) === 0 }) },
]);

const CLIFF = 9;

/** The `Tile.check()` mask of the cell at (tx, ty) of type t, over `grid` (`'tx,ty'` → t). */
export function autotileMask(grid, tx, ty, t) {
    const at = (x, y) => grid.get(`${x},${y}`);
    const sameOrCliff = (n) => n === t || n === CLIFF;
    let img = 0;
    if (sameOrCliff(at(tx + 1, ty))) img += 1;
    if (sameOrCliff(at(tx, ty - 1))) img += 2;
    if (sameOrCliff(at(tx - 1, ty))) img += 4;
    if (at(tx, ty + 1) === t) img += 8;
    return img;
}

/** Hitbox-overlap of two `{x, y, w, h}` boxes, FlashPunk's strict test. */
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const TREE_TAGS = new Set(['tree', 'treebare', 'opentree']);

/** `Tree.getFrame()` (`Tree.as:59-66`): another Tree 1 px away, or the room's edge. */
export function treeFrame(tree, trees, room) {
    const box = { x: tree.x, y: tree.y, w: 32, h: 32 };
    const hit = (dx, dy) => trees.some((o) => o !== tree && overlaps({ ...box, x: box.x + dx, y: box.y + dy }, { x: o.x, y: o.y, w: 32, h: 32 }));
    let v = 0;
    if (hit(1, 0) || box.x + 32 + 1 > room.width) v += 1;
    if (hit(0, -1) || box.y - 1 < 0) v += 2;
    if (hit(-1, 0) || box.x - 1 < 0) v += 4;
    if (hit(0, 1) || box.y + 32 + 1 > room.height) v += 8;
    return v;
}

/** `Pole.check()`: +1 a pole 1 px right, +2 left, +4 below. */
export function poleFrame(pole, poles) {
    const box = { x: pole.x, y: pole.y, w: 16, h: 16 };
    const hit = (dx, dy) => poles.some((o) => o !== pole && overlaps({ ...box, x: box.x + dx, y: box.y + dy }, { x: o.x, y: o.y, w: 16, h: 16 }));
    return (hit(1, 0) ? 1 : 0) + (hit(-1, 0) ? 2 : 0) + (hit(0, 1) ? 4 : 0);
}

/**
 * Static scenery by OEL tag: the art key, the frame rule and the AS3 `layer`
 * as `-(oy + k)` of the OEL y (each class's `-(y - originY + k·height)` with
 * its constructor offset folded in). `layer: 0` = the class never sets one.
 */
export const SCENERY = Object.freeze({
    tree: { key: 'seedling:scenery/tree', frame: 'tree', layer: (o) => -(o.y + 32) },
    treebare: { key: 'seedling:scenery/treebare', frame: 'tree', layer: (o) => -(o.y + 32) },
    opentree: { key: 'seedling:scenery/opentree', frame: 'tree', layer: (o) => -(o.y + 32) },
    // TreeLarge.as: layer = -(y - originY + 138), the mask's origin cancelling the +96.
    treelarge: { key: 'seedling:scenery/treelarge', anim: 'shine', layer: (o) => -(o.y + 138) },
    pole: { key: 'seedling:scenery/pole', frame: 'pole', layer: (o) => -(o.y + 16) },
    rock: { key: 'seedling:scenery/rock', layer: (o) => -(o.y + 12) },
    rock2: { key: 'seedling:scenery/rock2', layer: (o) => -(o.y + 12) },
    rock3: { key: 'seedling:scenery/rock3', layer: (o) => -(o.y + 12) },
    rock4: { key: 'seedling:scenery/rock4', layer: (o) => -(o.y + 12) },
    // Building.as:25-41 — the switch on the building type; `h` is the mask's height.
    building: { key: 'seedling:scenery/building', layer: (o) => -(o.y + o.rect.h) },
    building1: { key: 'seedling:scenery/building1', layer: (o) => -(o.y + o.rect.h) },
    building2: { key: 'seedling:scenery/building2', layer: (o) => -(o.y + o.rect.h) },
    building3: { key: 'seedling:scenery/building3', layer: (o) => -(o.y + o.rect.h) },
    building4: { key: 'seedling:scenery/building4', layer: (o) => -(o.y + o.rect.h / 2) },
    building5: { key: 'seedling:scenery/building5', layer: (o) => -(o.y + o.rect.h) },
    building6: { key: 'seedling:scenery/building6', layer: (o) => -(o.y + 72) },
    building7: { key: 'seedling:scenery/building7', layer: (o) => -(o.y + 16) },
    building8: { key: 'seedling:scenery/building8', anim: 'mound', layer: (o) => -(o.y + 48) },
    // Statue.as:47-60 layering(): frame 0 → -(y+8-16+32-8), frame 1 → -(y-8+24-24).
    statue1: { key: 'seedling:scenery/statue1', layer: (o) => -(o.y + 16) },
    statue2: { key: 'seedling:scenery/statue2', layer: (o) => -(o.y - 8) },
    brickpole: { key: 'seedling:scenery/brickpole', layer: (o) => -(o.y + 16 * 4 / 5) },
    brickwell: { key: 'seedling:scenery/brickwell', layer: (o) => -(o.y + 16 * 4 / 5) },
    dungeonspire: { key: 'seedling:scenery/dungeonspire', layer: (o) => -(o.y + 16 * 2 / 3) },
    ruinedpillar: { key: 'seedling:scenery/ruinedpillar', layer: (o) => -(o.y + 32 * 4 / 5) },
    bed: { key: 'seedling:scenery/bed', layer: (o) => -(o.y + 32 * 4 / 5) },
    bar: { key: 'seedling:scenery/bar', layer: (o) => -(o.y + 16 * 4 / 5) },
    barstool: { key: 'seedling:scenery/barstool', layer: (o) => -(o.y + 4) },
    dresser: { key: 'seedling:scenery/dresser', layer: (o) => -(o.y + 16 * 4 / 5) },
    shieldstatue: { key: 'seedling:scenery/shieldstatue', layer: (o) => -o.y },
    oraclestatue: { key: 'seedling:scenery/oraclestatue', anim: 'idle', layer: (o) => -(o.y + 32 * 4 / 5) },
    planttorch: { key: 'seedling:scenery/planttorch', anim: 'burn', layer: () => 0 },
    bonetorch: { key: 'seedling:scenery/bonetorch', anim: 'burn', layer: (o) => -(o.y + 16) },
    bonetorch2: { key: 'seedling:scenery/bonetorch2', anim: 'burn', layer: (o) => -(o.y + 16) },
    snowhill: { key: 'seedling:scenery/snowhill', layer: (o) => -(o.y + o.rect.h - 32) },
});

/** A solid the run can change (a breakable rock, a chest, a lock…) — `rectPalette`'s join. */
const isChangeable = (s) => OBJECT_SOLID_FAMILIES.some((f) => s[f.key]);

/**
 * Per-world cache of what never changes while the room is up: the tile grid,
 * each tile's mask and cosmetic draws, the scenery's neighbour frames.
 * Keyed on the world OBJECT, so a new room is a new entry and nothing is kept
 * alive past it.
 */
const plans = new WeakMap();

function planFor(world, level, mask = autotileMask) {
    const hit = mask === autotileMask ? plans.get(world) : null;
    if (hit && hit.level === level) return hit;
    const grid = new Map(world.tiles.map((t) => [`${t.tx},${t.ty}`, t.t]));
    const solid = new Set(world.solids.map((s) => `${s.rect.x},${s.rect.y}`));
    const tiles = world.tiles.map((t) => ({
        tile: t,
        img: mask(grid, t.tx, t.ty, t.t),
        r: [cosmeticRand(level, t.tx, t.ty, 0), cosmeticRand(level, t.tx, t.ty, 1), cosmeticRand(level, t.tx, t.ty, 2)],
        fallbackColour: solid.has(`${t.rect.x},${t.rect.y}`) ? SOLID_COLOUR : (TILE_COLOURS[t.t] ?? FLOOR_COLOUR),
    }));
    const objects = [...world.objectSolids, ...world.pixelmasks];
    const trees = objects.filter((o) => TREE_TAGS.has(o.tag));
    const poles = objects.filter((o) => o.tag === 'pole');
    const room = world.world;
    const frames = new Map();
    for (const o of trees) frames.set(o, treeFrame(o, trees, room));
    for (const o of poles) frames.set(o, poleFrame(o, poles));
    const plan = { level, grid, tiles, objects, frames, tileEntries: new WeakMap() };
    if (mask === autotileMask) plans.set(world, plan);
    return plan;
}

const sprite = (art, key, frame, at, extra = {}) => {
    const fr = art.frameRect(key, frame);
    if (!fr) return null;
    return {
        key, sheetRef: fr.sheetRef, sx: fr.sx, sy: fr.sy, sw: fr.sw, sh: fr.sh,
        dx: at.x - fr.ox, dy: at.y - fr.oy, rot: extra.rot ?? 0, flipX: !!extra.flipX, flipY: !!extra.flipY,
        layer: extra.layer ?? 0, fallback: extra.fallback ?? null,
    };
};

/**
 * THE DRAW LIST for one room at one game tick.
 *
 * @param {object} world   `buildLevelWorld`'s room (`runtime.view().world`)
 * @param {object|null} art an `artLibrary` (null = rectangles only)
 * @param {object} opts
 * @param {number} opts.level   the room's level (the cosmetic hash's key)
 * @param {number} [opts.tick]  the GAME tick the animations read (0 = their first frame)
 * @param {object} [opts.player] the player's hitbox `{x, y, right, bottom}`
 * @param {object[]} [opts.playerSprites] the player's sprite ops (`seedlingPlayerSkin.playerOps`, G2); when
 *   non-empty they replace the white hitbox and are Y-sorted with everything else
 * @param {object[]} [opts.apItems] uncollected AP items (`{rect}`)
 * @param {object[]} [opts.apItemSprites] the AP items' ops (`seedlingEnemySkin.apItemOps`, G3); when given they
 *   replace the logo drawn for each of `apItems`
 * @param {object[]} [opts.entitySprites] every other body's ops (`seedlingEnemySkin.enemyOps`, G3), Y-sorted
 * @param {function} [opts.drawnObjects] `(objectSolid) → boolean`: a static solid the caller draws itself as a body
 *   (G3c's crushers, axes, chains, totem, bomb pusher — `seedlingHazardSkin.HAZARD_OBJECT_TAGS`), so its build-time
 *   rectangle is not painted under (or, for a crusher that has moved, beside) the sprite. Omitted: every object is drawn.
 * @param {function} [opts.drawnTeleporters] `(teleporter) → boolean`: a teleporter the caller draws itself (G7's
 *   stairs — `seedlingPuzzleSkin`), so its stand-in rectangle is not painted. Omitted: every active one is.
 * @param {function} [opts.drawnPickups] `(pickup) → boolean`: a placed pickup the caller draws itself (G9a's
 *   `seedlingPickupSkin`, taken ones included: it draws nothing for those), so its stand-in rectangle is not painted.
 *   Omitted: every one is.
 * @param {Function} [opts.mask] the autotiler (a test's MUTANT; default `autotileMask`)
 */
export function roomOps(world, art, {
    level, tick = 0, player = null, playerSprites = null, apItems = [], apItemSprites = null, entitySprites = null, mask = autotileMask,
    drawnObjects = null, drawnTeleporters = null, drawnPickups = null,
} = {}) {
    const plan = planFor(world, level, mask);
    const ops = [];
    const tileCount = tileEntriesFor(plan, art).length;
    const rectOp = (rect, colour, alpha, layer) => ({ rect, colour, alpha, layer });
    const has = (key) => !!art?.has(key);

    // ⛓ G1.5 — every tile op says whether its picture is the same at every tick (`still`): the static tile layer
    // (`paintOps`' `tileLayer`) bakes the still ones. `formatOp` does not print it, so the goldens cannot see it.
    // The ops are built once per (room, art) and SHARED, frozen, across calls — an animated tile's once per frame it
    // shows; a call reads each (key, anim, phase)'s frame at its tick once.
    const frameNow = new Map();
    for (const e of tileEntriesFor(plan, art)) {
        if (!e.anim) { ops.push(e.op); continue; }
        const at = `${e.key}|${e.choice.anim}|${e.choice.phase ?? 0}`;
        if (!frameNow.has(at)) frameNow.set(at, art.frameAt(e.key, e.choice.anim, tick, e.choice.phase ?? 0) ?? 0);
        const frame = frameNow.get(at);
        if (!e.byFrame.has(frame)) {
            const op = sprite(art, e.key, frame, e.rect, { ...e.choice, layer: TILE_LAYER, fallback: e.fallback });
            e.byFrame.set(frame, op && Object.freeze(Object.assign(op, { still: false })));
        }
        ops.push(e.byFrame.get(frame));
    }

    for (const o of plan.objects) {
        if (drawnObjects?.(o)) continue;
        const fallback = rectOp(o.rect, objectSolidColour(o), 0.85, -o.rect.bottom);
        if (o.cls?.as3 === 'CliffSide' && has('seedling:scenery/cliffside')) {
            ops.push(sprite(art, 'seedling:scenery/cliffside', o.cls.frame ?? 0, o, { layer: 0, fallback }));
            continue;
        }
        const spec = !isChangeable(o) ? SCENERY[o.tag] : null;
        if (!spec || !has(spec.key)) { ops.push(fallback); continue; }
        let frame = 0;
        if (spec.frame) frame = plan.frames.get(o) ?? 0;
        else if (spec.anim) frame = art.frameAt(spec.key, spec.anim, tick) ?? 0;
        ops.push(sprite(art, spec.key, frame, o, { layer: spec.layer(o), fallback }));
    }

    for (const tp of world.teleporters) if (!tp.deactivated && !drawnTeleporters?.(tp)) ops.push(rectOp(tp.rect, TELEPORTER_COLOUR, 0.45, -Infinity));
    for (const p of world.pickups ?? []) if (!drawnPickups?.(p)) ops.push(rectOp(p.rect, AP_ITEM_COLOUR, 0.5, -p.rect.bottom));
    if (apItemSprites) ops.push(...apItemSprites);
    else for (const a of apItems) {
        const fallback = rectOp(a.rect, AP_ITEM_COLOUR, 1, -a.rect.bottom);
        const centre = { x: (a.rect.x + a.rect.right) / 2, y: (a.rect.y + a.rect.bottom) / 2 };
        ops.push(has('archipelago:pickup/item')
            ? sprite(art, 'archipelago:pickup/item', 0, centre, { layer: -a.rect.bottom, fallback })
            : fallback);
    }
    if (entitySprites?.length) ops.push(...entitySprites);
    if (playerSprites?.length) ops.push(...playerSprites);
    else if (player) ops.push(rectOp(player, PLAYER_COLOUR, 0.95, -player.bottom));

    return layerSorted(ops, tileCount);
}

/**
 * FlashPunk renders the highest layer first; ties keep the push order (a stable sort). ⛓ G1.5 — the first
 * `tileCount` ops are the tiles, every one at `TILE_LAYER` and pushed before the rest, so the stable sort of the
 * whole list is: the rest's ops above `TILE_LAYER`, then the tiles in push order, then the rest's others — and
 * only the rest needs sorting. A layer that is not a number (NaN compares as neither) sorts the whole list, as before.
 */
function layerSorted(ops, tileCount) {
    const sortAll = (list) => list.map((op, i) => [op, i]).sort((a, b) => (b[0].layer - a[0].layer) || (a[1] - b[1])).map(([op]) => op);
    const rest = ops.slice(tileCount);
    if (rest.some((op) => Number.isNaN(op?.layer)) || ops.slice(0, tileCount).some((op) => op?.layer !== TILE_LAYER)) return sortAll(ops);
    const sorted = sortAll(rest);
    let above = 0;
    while (above < sorted.length && sorted[above].layer > TILE_LAYER) above += 1;
    return [...sorted.slice(0, above), ...ops.slice(0, tileCount), ...sorted.slice(above)];
}

/**
 * ⛓ G1.5 — the room's tile ops for one art, in push order: `{ anim: false, op }` (a still op, frozen and shared by
 * every call) or `{ anim: true, key, choice, rect, fallback, byFrame }` (its frame read per call; its op per frame
 * kept in `byFrame`, frozen and shared). Cached on the plan, which
 * is the world OBJECT's (a tile write is a new world, so a new plan).
 */
function tileEntriesFor(plan, art) {
    const slot = art ?? NO_ART;
    const hit = plan.tileEntries.get(slot);
    if (hit) return hit;
    const entries = [];
    const has = (key) => !!art?.has(key);
    const still = (op) => entries.push({ anim: false, op: op && Object.freeze(Object.assign(op, { still: true })) });
    for (const { tile: t, img, r, fallbackColour } of plan.tiles) {
        const fallback = Object.freeze({ rect: t.rect, colour: fallbackColour, alpha: 1, layer: TILE_LAYER });
        const spec = TILE_ART[t.t];
        if (!spec || !has(spec.key)) { still({ ...fallback }); continue; }
        let choice;
        if (spec.rule === 'autotile') choice = { frame: img };
        else if (spec.rule === 'single') choice = { frame: 0 };
        else if (spec.rule === 'anim') choice = { anim: spec.anim, phase: Math.floor(r[0] * (art.resolve(spec.key).sprite.anims?.[spec.anim]?.frames.length ?? 1)) };
        else choice = spec.rule(r, { img, column: t.column });
        if (choice.anim) entries.push({ anim: true, key: spec.key, choice, rect: t.rect, fallback, byFrame: new Map() });
        else still(sprite(art, spec.key, choice.frame, t.rect, { ...choice, layer: TILE_LAYER, fallback }));
        if (t.t === 25 && TILE_COLUMN_VARIANTS[t.column]?.pit && has('seedling:tile/pitShadow')) {
            still(sprite(art, 'seedling:tile/pitShadow', 0, t.rect, { layer: TILE_LAYER }));
        }
    }
    plan.tileEntries.set(slot, entries);
    return entries;
}

/** The `tileEntriesFor` cache slot of a paint with no art (rectangles only). */
const NO_ART = Object.freeze({});

/**
 * The visible rectangle in room pixels. `room`: the whole room (today's view).
 * `follow`: the original's 160×160 camera — the run's own camera when it has
 * one (`run.cameraNow`; a shaking band is drawn at its middle, or where
 * `opts.jiggle(cameraNow)` puts it — G4), else the
 * follow target clamped as `Game.view()` clamps it.
 */
export function cameraView(mode, world, state, run = null, { jiggle = null } = {}) {
    const room = world.world;
    if (mode !== 'follow') return { x: 0, y: 0, w: room.width, h: room.height };
    let cam = null;
    try {
        const now = run?.cameraNow ?? null;
        if (now?.cam) cam = now.cam;
        // ⛓ G4 — `jiggle(cameraNow)` places the camera inside a shake band (the cosmetic draw); absent, the middle.
        else if (now?.band && jiggle) cam = jiggle(now);
        else if (now?.band) cam = { x: Math.round((now.band.x.lo + now.band.x.hi) / 2), y: Math.round((now.band.y.lo + now.band.y.hi) / 2) };
    } catch { cam = null; }
    if (!cam) {
        const axis = (p, size) => (size < SCREEN ? -(SCREEN - size) / 2 : Math.min(Math.max(p - SCREEN / 2, 0), size - SCREEN));
        cam = { x: Math.round(axis(state.x, room.width)), y: Math.round(axis(state.y, room.height)) };
    }
    return { x: cam.x, y: cam.y, w: SCREEN, h: SCREEN };
}

/**
 * Paint a draw list. `view` is `cameraView`'s rectangle; it is scaled to fit
 * the canvas and every destination is snapped to whole device pixels (no
 * seams between tiles at a fractional scale). Returns `{ sprites, rects,
 * fallbacks }` — how many of each were drawn — for the page's readout.
 *
 * G2's sprite fields, each optional: `alpha`; `tint` (FlashPunk's
 * multiplying `Image.color`, drawn from `tinted(image, tint)` — the page's
 * cached copy — and untinted without one); `scaleX`/`scaleY`; and
 * `pivotX`/`pivotY`, the frame pixel a rotation and a scale turn about
 * (FlashPunk's origin; the frame's centre when absent, as G1 draws).
 *
 * ⛓ G1.5 — `tileLayer` (`createTileLayer`, with `key` and `background`): the
 * STATIC TILE LAYER. The still tile ops (`roomOps`' `still`) are drawn ONCE
 * onto an offscreen canvas filled with `background` — the colour the caller
 * cleared `ctx` to — and every later paint blits that canvas and draws only
 * the rest. It composites to the SAME PIXELS: an op is baked only if it is
 * still, sits in the leading run of tile ops, and overlaps no earlier op that
 * is drawn live (`splitTileLayer`), so every overlapping pair keeps its order,
 * and each op is drawn by the same `drawOp` either way. The run's LIVE tile
 * ops (the animated tiles, every one on the world clock) are drawn over a
 * copy of that layer onto a second canvas, redrawn only when one of them
 * changes its picture (`frameTileLayer`); a paint then blits that canvas and
 * draws the ops after the run. ⛔ The layer is
 * rebuilt whenever its key changes: the caller's `key` (the page passes the
 * world OBJECT, the art, the level — a tile write is a new world, see
 * `createTileLayer`) plus the images, the view, the canvas size and the run's
 * length. Only a FIXED view gains (room mode); a moving view rebuilds.
 */
export function paintOps(ctx, ops, images, view, canvas, { tinted = null, tileLayer = null } = {}) {
    const scale = Math.min(canvas.width / view.w, canvas.height / view.h);
    const offX = Math.round((canvas.width - view.w * scale) / 2);
    const offY = Math.round((canvas.height - view.h * scale) / 2);
    const X = (x) => offX + Math.round((x - view.x) * scale);
    const Y = (y) => offY + Math.round((y - view.y) * scale);
    ctx.imageSmoothingEnabled = false;
    const counts = { sprites: 0, rects: 0, fallbacks: 0 };
    const pen = { images, view, scale, X, Y, tinted };
    let from = 0;
    if (tileLayer) {
        const layer = bakeTileLayer(tileLayer, ops, pen, canvas);
        frameTileLayer(layer, ops, pen);
        ctx.drawImage(layer.frameCanvas, 0, 0);
        from = layer.baked.length;
        for (const k of Object.keys(counts)) counts[k] += layer.counts[k] + layer.frameCounts[k];
    }
    for (let i = from; i < ops.length; i++) drawOp(ctx, ops[i], pen, counts);
    return counts;
}

/**
 * ⛓ G5 — THE NIGHT LAYER (`seedlingNightSkin.nightOps`' `{ alpha, ops, solid }`), drawn the way
 * `Game.bufferTransforms()` draws it: the night canvas filled `fill` and given `ops` (normal blend unless an op
 * names one), the `solid` ops on a clear canvas HARDLIGHTed onto it, then the night canvas MULTIPLIED onto `ctx`
 * at `alpha`, clipped to the view's device rect (in room mode, the room). `cache` (`createNightLayer`) keeps the
 * two offscreen canvases, and the night canvas is REDRAWN only when its picture changes — a signature of every
 * field `drawOp` reads of every op, the view, the canvas, the images and the fill (`nightSignature`); otherwise
 * the paint is the one composite. Returns the counts drawn onto the night canvas (zero on a reused one).
 */
export function paintNight(ctx, night, images, view, canvas, { tinted = null, cache, fill }) {
    const counts = { sprites: 0, rects: 0, fallbacks: 0, circles: 0 };
    if (!night || !(night.alpha > 0)) return counts;
    const scale = Math.min(canvas.width / view.w, canvas.height / view.h);
    const offX = Math.round((canvas.width - view.w * scale) / 2);
    const offY = Math.round((canvas.height - view.h * scale) / 2);
    const X = (x) => offX + Math.round((x - view.x) * scale);
    const Y = (y) => offY + Math.round((y - view.y) * scale);
    const pen = { images, view, scale, X, Y, tinted };
    const sig = nightSignature(night, view, canvas, images, fill);
    const same = !!cache.night && cache.sig && cache.sig.length === sig.length && cache.sig.every((v, i) => v === sig[i]);
    if (same) cache.reused += 1;
    else drawNightCanvas(cache, night, pen, canvas, fill, sig, counts);
    const x0 = X(view.x);
    const y0 = Y(view.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, X(view.x + view.w) - x0, Y(view.y + view.h) - y0);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = night.alpha;
    ctx.drawImage(cache.night, 0, 0);
    ctx.restore();
    cache.paints += 1;
    return counts;
}

/** ⛓ G5 — (re)draw the night canvas: the fill, the ops, then the solid canvas HARDLIGHTed onto it. */
function drawNightCanvas(cache, night, pen, canvas, fill, sig, counts) {
    const sized = (c) => (c && c.width === canvas.width && c.height === canvas.height ? c : cache.newCanvas(canvas.width, canvas.height));
    cache.night = sized(cache.night);
    const nctx = cache.night.getContext('2d');
    nctx.globalCompositeOperation = 'source-over';
    nctx.globalAlpha = 1;
    nctx.imageSmoothingEnabled = false;
    nctx.fillStyle = fill;
    nctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const op of night.ops) drawOp(nctx, op, pen, counts);
    if (night.solid?.length) {
        // the solid canvas has its own signature: the lava's edges pulse every 9 ticks, its copies more often
        const solidSig = nightSignature({ ops: night.solid }, pen.view, canvas, pen.images, null);
        if (!cache.solid || !cache.solidSig || cache.solidSig.length !== solidSig.length || cache.solidSig.some((v, i) => v !== solidSig[i])) {
            cache.solid = sized(cache.solid);
            const sctx = cache.solid.getContext('2d');
            sctx.clearRect(0, 0, canvas.width, canvas.height);
            sctx.imageSmoothingEnabled = false;
            for (const op of night.solid) drawOp(sctx, op, pen, counts);
            cache.solidSig = solidSig;
            cache.solidRedraws += 1;
        }
        nctx.globalCompositeOperation = 'hard-light';
        nctx.drawImage(cache.solid, 0, 0);
        nctx.globalCompositeOperation = 'source-over';
    }
    cache.sig = sig;
    cache.redraws += 1;
}

/** ⛓ G5 — every value the night canvas's pixels depend on, flat (primitives only, compared with `===`). */
const NIGHT_OP_FIELDS = ['key', 'sheetRef', 'sx', 'sy', 'sw', 'sh', 'dx', 'dy', 'rot', 'flipX', 'flipY', 'alpha', 'tint', 'colour',
    'pivotX', 'pivotY', 'scaleX', 'scaleY', 'blend'];
export function nightSignature(night, view, canvas, images, fill) {
    const sig = [view.x, view.y, view.w, view.h, canvas.width, canvas.height, images, fill, night.ops.length, night.solid?.length ?? 0];
    for (const list of [night.ops, night.solid ?? []]) {
        for (const op of list) {
            for (const f of NIGHT_OP_FIELDS) sig.push(op[f]);
            const r = op.rect;
            if (r) sig.push(r.x, r.y, r.w ?? r.right, r.h ?? r.bottom);
            else sig.push(null, null, null, null);
            const c = op.circle;
            if (c) sig.push(c.x, c.y, c.r);
            else sig.push(null, null, null);
            const fb = op.fallback;
            if (fb) sig.push(fb.colour, fb.alpha, fb.rect.x, fb.rect.y, fb.rect.w ?? fb.rect.right, fb.rect.h ?? fb.rect.bottom);
            else sig.push(null, null, null, null, null, null);
        }
    }
    return sig;
}

/** ⛓ G5 — the night layer's offscreen canvases, one per painted canvas, and its reuse counters. */
export function createNightLayer(newCanvas) {
    return { newCanvas, night: null, solid: null, sig: null, solidSig: null, paints: 0, redraws: 0, reused: 0, solidRedraws: 0 };
}

/** ⛓ G5 — a circle (`Draw.circlePlus`), or any op under its `blend`. */
function drawLit(ctx, op, pen, counts) {
    if (op.blend) ctx.globalCompositeOperation = op.blend;
    if (op.circle) {
        ctx.globalAlpha = op.alpha ?? 1;
        ctx.fillStyle = op.colour;
        ctx.beginPath();
        ctx.arc(pen.X(op.circle.x), pen.Y(op.circle.y), op.circle.r * pen.scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        counts.circles = (counts.circles ?? 0) + 1;
    } else {
        drawOp(ctx, { ...op, blend: undefined }, pen, counts);
    }
    if (op.blend) ctx.globalCompositeOperation = 'source-over';
}

/** One op onto `ctx` (culled to the view; a sheet not decoded → its fallback). `counts` gains what was drawn. */
function drawOp(ctx, op, pen, counts) {
    const { images, view, scale, X, Y, tinted } = pen;
    const fillRect = (rop) => {
        ctx.globalAlpha = rop.alpha ?? 1;
        ctx.fillStyle = rop.colour;
        const x = X(rop.rect.x);
        const y = Y(rop.rect.y);
        ctx.fillRect(x, y, X(rop.rect.right ?? rop.rect.x + rop.rect.w) - x, Y(rop.rect.bottom ?? rop.rect.y + rop.rect.h) - y);
        ctx.globalAlpha = 1;
    };
    if (isCulled(op, view)) return;
    // ⛓ G5 — a light's circle, or a blend mode (a SCREENed part, a light ray); no G1–G4b op carries either.
    if (op.circle || op.blend) { drawLit(ctx, op, pen, counts); return; }
    if (!op.sheetRef) { fillRect(op); counts.rects += 1; return; }
    let img = images?.get(op.sheetRef);
    if (!img) {
        if (op.fallback) { fillRect(op.fallback); counts.fallbacks += 1; }
        return;
    }
    if (op.tint && tinted) img = tinted(img, op.tint) ?? img;
    if (op.alpha !== undefined) ctx.globalAlpha = op.alpha;
    const x = X(op.dx);
    const y = Y(op.dy);
    const w = X(op.dx + op.sw) - x;
    const h = Y(op.dy + op.sh) - y;
    if (op.pivotX !== undefined) {
        const px = op.pivotX * scale;
        const py = op.pivotY * scale;
        ctx.save();
        ctx.translate(X(op.dx + op.pivotX), Y(op.dy + op.pivotY));
        if (op.rot) ctx.rotate((op.rot * Math.PI) / 180);
        ctx.scale((op.scaleX ?? 1) * (op.flipX ? -1 : 1), (op.scaleY ?? 1) * (op.flipY ? -1 : 1));
        ctx.drawImage(img, op.sx, op.sy, op.sw, op.sh, -px, -py, op.sw * scale, op.sh * scale);
        ctx.restore();
    } else if (op.rot || op.flipX || op.flipY) {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        if (op.rot) ctx.rotate((op.rot * Math.PI) / 180);
        ctx.scale(op.flipX ? -1 : 1, op.flipY ? -1 : 1);
        ctx.drawImage(img, op.sx, op.sy, op.sw, op.sh, -w / 2, -h / 2, w, h);
        ctx.restore();
    } else {
        ctx.drawImage(img, op.sx, op.sy, op.sw, op.sh, x, y, w, h);
    }
    if (op.alpha !== undefined) ctx.globalAlpha = 1;
    counts.sprites += 1;
}

function isCulled(op, view) {
    const r = op.rect ?? { x: op.dx, y: op.dy, w: op.sw, h: op.sh };
    const right = r.right ?? r.x + r.w;
    const bottom = r.bottom ?? r.y + r.h;
    return right < view.x || bottom < view.y || r.x > view.x + view.w || r.y > view.y + view.h;
}

/**
 * The device-pixel box `[x0, x1) × [y0, y1)` an op can write: its sprite box (a quarter turn of a non-square
 * frame swaps its extents about the centre), widened by its fallback's — or `null`, "anywhere", for a pivoted or
 * off-axis draw. EXACT, not padded: with the bake's closure rule a padded box would make every neighbour of an
 * animated tile live, and theirs, across the room. Whole-pixel destinations with smoothing off write exactly it.
 */
function deviceBox(op, { X, Y }) {
    const union = (a, b) => (b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : a);
    const rectBox = (r) => ({ x0: X(r.x), y0: Y(r.y), x1: X(r.right ?? r.x + r.w), y1: Y(r.bottom ?? r.y + r.h) });
    if (!op.sheetRef) return rectBox(op.rect);
    if (op.pivotX !== undefined || (op.rot && op.rot % 90 !== 0)) return null;
    let box = { x0: X(op.dx), y0: Y(op.dy), x1: X(op.dx + op.sw), y1: Y(op.dy + op.sh) };
    if (op.rot && op.rot % 180 !== 0) {
        const cx = (box.x0 + box.x1) / 2;
        const cy = (box.y0 + box.y1) / 2;
        const hw = (box.y1 - box.y0) / 2;
        const hh = (box.x1 - box.x0) / 2;
        box = { x0: Math.floor(cx - hw), y0: Math.floor(cy - hh), x1: Math.ceil(cx + hw), y1: Math.ceil(cy + hh) };
    }
    return union(box, op.fallback ? rectBox(op.fallback.rect) : null);
}

const boxesOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * ⛓ G1.5 — WHICH OPS THE STATIC LAYER MAY HOLD. The leading run of tile ops
 * (those with `still` defined — `roomOps` puts them first: FlashPunk draws the
 * highest layer first, tiles are layer 100, and anything else that ties was
 * pushed after them); inside it, an op is BAKED when it is still and overlaps
 * no earlier op of the run that stays live. Drawing the baked ops first and
 * the rest after then keeps the order of every pair that shares a pixel. An
 * op culled out of the view draws nothing either way and is never live. A
 * run that starts later (an op above layer 100) bakes nothing.
 * Returns `{ run, baked }` (`baked[i]` = 1 for a baked op of the run).
 */
export function splitTileLayer(ops, pen) {
    let run = 0;
    while (run < ops.length && ops[run]?.still !== undefined) run += 1;
    const baked = new Uint8Array(run);
    // live boxes, bucketed by 64-px device cell, so the overlap test is local
    const CELL = 64;
    const buckets = new Map();
    let anywhere = false;
    const cellsOf = (b, fn) => {
        for (let cy = Math.floor(b.y0 / CELL); cy <= Math.floor((b.y1 - 1) / CELL); cy++) {
            for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor((b.x1 - 1) / CELL); cx++) if (fn(`${cx},${cy}`)) return true;
        }
        return false;
    };
    for (let i = 0; i < run; i++) {
        const op = ops[i];
        if (isCulled(op, pen.view)) { baked[i] = op.still ? 1 : 0; continue; }
        const box = deviceBox(op, pen);
        const clear = box && !anywhere && !cellsOf(box, (k) => buckets.get(k)?.some((b) => boxesOverlap(b, box)));
        if (op.still && clear) { baked[i] = 1; continue; }
        if (!box) { anywhere = true; continue; }
        cellsOf(box, (k) => { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(box); return false; });
    }
    return { run, baked };
}

/**
 * ⛓ G1.5 — a STATIC TILE LAYER's cache, one per painted canvas. `newCanvas(w, h)` makes the offscreen canvas
 * (the page: a `<canvas>` element). The caller hands `paintOps` `{ layer, key, background }`; `layer` reads back
 * `builds`, `hits` and the last build's `bakedOps` / `liveOps`.
 *
 * ⛔ WHAT INVALIDATES IT. The still tile ops are a function of the room's tiles (`world.tiles`: type, cell, column),
 * its solids (a tile's fallback colour), the art, the level (the cosmetic draws) and the decoded images — and the
 * paint's view and canvas. Every mutation the run makes to what the renderer reads arrives as a NEW world object:
 * a tile write (a Bulb's lava, an igneous tile turning to lava — `levelWorld.withTileWrites` via `levelRun`'s
 * `visitWorld`), a runtime teleporter, a lights exit, the tentacle mouth; a death restart that drops the visit's
 * writes hands back the memoised build. No reader mutates a world's tiles in place (`roomOps`' own plan cache is
 * keyed on the world object for the same reason). The breakable rocks, chests, locks, bridges, burnable trees and
 * activators are objects or animated tiles, never baked. So the key names the world object; the stale-layer pin
 * (`seedlingSkinRenderer.test.js`) writes a tile and fails if the layer is not rebuilt.
 */
export function createTileLayer(newCanvas) {
    return {
        newCanvas, key: null, canvas: null, baked: null, counts: null, builds: 0, hits: 0, bakedOps: 0, liveOps: 0,
        // the second canvas: the layer plus the run's live tile ops, and the pictures it was drawn with
        frameCanvas: null, frameSig: null, frameCounts: null, frameBuilds: 0,
    };
}

/** What a live tile op's picture is made of — every field `drawOp` reads for a run op. */
const LIVE_FIELDS = ['sheetRef', 'sx', 'sy', 'sw', 'sh', 'dx', 'dy', 'rot', 'flipX', 'flipY', 'alpha', 'tint', 'colour',
    'rect', 'pivotX', 'pivotY', 'scaleX', 'scaleY'];

/** Redraw the layer's second canvas when a live op of the run changed its picture (or the layer was rebuilt). */
function frameTileLayer(layer, ops, pen) {
    const sig = [];
    for (let i = 0; i < layer.baked.length; i++) {
        if (layer.baked[i]) continue;
        for (const f of LIVE_FIELDS) sig.push(ops[i][f]);
        sig.push(ops[i].fallback?.colour, ops[i].fallback?.alpha, ops[i].fallback?.rect);
    }
    if (layer.frameSig && layer.frameSig.length === sig.length && layer.frameSig.every((v, i) => v === sig[i])) return;
    const { canvas } = layer;
    if (!layer.frameCanvas || layer.frameCanvas.width !== canvas.width || layer.frameCanvas.height !== canvas.height) {
        layer.frameCanvas = layer.newCanvas(canvas.width, canvas.height);
    }
    const fctx = layer.frameCanvas.getContext('2d');
    fctx.globalAlpha = 1;
    fctx.drawImage(canvas, 0, 0);
    fctx.imageSmoothingEnabled = false;
    const counts = { sprites: 0, rects: 0, fallbacks: 0 };
    for (let i = 0; i < layer.baked.length; i++) if (!layer.baked[i]) drawOp(fctx, ops[i], pen, counts);
    Object.assign(layer, { frameSig: sig, frameCounts: counts, frameBuilds: layer.frameBuilds + 1 });
}

function bakeTileLayer({ layer, key, background }, ops, pen, canvas) {
    let run = 0;
    while (run < ops.length && ops[run]?.still !== undefined) run += 1;
    const v = pen.view;
    const full = [...key, pen.images, v.x, v.y, v.w, v.h, canvas.width, canvas.height, background, run];
    if (layer.key && layer.key.length === full.length && layer.key.every((k, i) => k === full[i])) {
        layer.hits += 1;
        return layer;
    }
    if (!layer.canvas || layer.canvas.width !== canvas.width || layer.canvas.height !== canvas.height) {
        layer.canvas = layer.newCanvas(canvas.width, canvas.height);
    }
    const { baked } = splitTileLayer(ops, pen);
    const lctx = layer.canvas.getContext('2d');
    lctx.globalAlpha = 1;
    lctx.fillStyle = background;
    lctx.fillRect(0, 0, canvas.width, canvas.height);
    lctx.imageSmoothingEnabled = false;
    const counts = { sprites: 0, rects: 0, fallbacks: 0 };
    let n = 0;
    for (let i = 0; i < run; i++) if (baked[i]) { drawOp(lctx, ops[i], pen, counts); n += 1; }
    Object.assign(layer, { key: full, baked, counts, builds: layer.builds + 1, bakedOps: n, liveOps: run - n, frameSig: null });
    return layer;
}

/** One op as a golden line: `drawImage(sheet, sx, sy, dx, dy)` (+ transforms), or `fillRect(...)`. */
export function formatOp(op) {
    if (!op.sheetRef) {
        const r = op.rect;
        return `fillRect(${op.colour}, ${r.x}, ${r.y}, ${(r.right ?? r.x + r.w) - r.x}, ${(r.bottom ?? r.y + r.h) - r.y})`;
    }
    const t = [op.rot ? ` rot=${op.rot}` : '', op.flipX ? ' flipX' : '', op.flipY ? ' flipY' : '',
        op.scaleX !== undefined ? ` scale=${op.scaleX}x${op.scaleY}` : '',
        op.alpha !== undefined ? ` alpha=${+op.alpha.toFixed(4)}` : '', op.tint ? ` tint=${op.tint}` : ''].join('');
    return `drawImage(${op.sheetRef}, ${op.sx}, ${op.sy}, ${op.dx}, ${op.dy})${t}`;
}
