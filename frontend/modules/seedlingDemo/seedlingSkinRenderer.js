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
 * ⛔ NOT YET (G2+ of the ladder): the player sprite (a white hitbox here),
 * enemies, live pushables / broken rocks / opened chests / burned trees (every
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
    const plan = { level, grid, tiles, objects, frames };
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
 * @param {object[]} [opts.apItems] uncollected AP items (`{rect}`)
 * @param {Function} [opts.mask] the autotiler (a test's MUTANT; default `autotileMask`)
 */
export function roomOps(world, art, { level, tick = 0, player = null, apItems = [], mask = autotileMask } = {}) {
    const plan = planFor(world, level, mask);
    const ops = [];
    const rectOp = (rect, colour, alpha, layer) => ({ rect, colour, alpha, layer });
    const has = (key) => !!art?.has(key);

    for (const { tile: t, img, r, fallbackColour } of plan.tiles) {
        const fallback = rectOp(t.rect, fallbackColour, 1, TILE_LAYER);
        const spec = TILE_ART[t.t];
        if (!spec || !has(spec.key)) { ops.push(fallback); continue; }
        let choice;
        if (spec.rule === 'autotile') choice = { frame: img };
        else if (spec.rule === 'single') choice = { frame: 0 };
        else if (spec.rule === 'anim') choice = { anim: spec.anim, phase: Math.floor(r[0] * (art.resolve(spec.key).sprite.anims?.[spec.anim]?.frames.length ?? 1)) };
        else choice = spec.rule(r, { img, column: t.column });
        const frame = choice.anim ? (art.frameAt(spec.key, choice.anim, tick, choice.phase ?? 0) ?? 0) : choice.frame;
        ops.push(sprite(art, spec.key, frame, t.rect, { ...choice, layer: TILE_LAYER, fallback }));
        if (t.t === 25 && TILE_COLUMN_VARIANTS[t.column]?.pit && has('seedling:tile/pitShadow')) {
            ops.push(sprite(art, 'seedling:tile/pitShadow', 0, t.rect, { layer: TILE_LAYER }));
        }
    }

    for (const o of plan.objects) {
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

    for (const tp of world.teleporters) if (!tp.deactivated) ops.push(rectOp(tp.rect, TELEPORTER_COLOUR, 0.45, -Infinity));
    for (const p of world.pickups ?? []) ops.push(rectOp(p.rect, AP_ITEM_COLOUR, 0.5, -p.rect.bottom));
    for (const a of apItems) {
        const fallback = rectOp(a.rect, AP_ITEM_COLOUR, 1, -a.rect.bottom);
        const centre = { x: (a.rect.x + a.rect.right) / 2, y: (a.rect.y + a.rect.bottom) / 2 };
        ops.push(has('archipelago:pickup/item')
            ? sprite(art, 'archipelago:pickup/item', 0, centre, { layer: -a.rect.bottom, fallback })
            : fallback);
    }
    if (player) ops.push(rectOp(player, PLAYER_COLOUR, 0.95, -player.bottom));

    // FlashPunk renders the highest layer first; ties keep the order above (stable sort).
    return ops.map((op, i) => [op, i]).sort((a, b) => (b[0].layer - a[0].layer) || (a[1] - b[1])).map(([op]) => op);
}

/**
 * The visible rectangle in room pixels. `room`: the whole room (today's view).
 * `follow`: the original's 160×160 camera — the run's own camera when it has
 * one (`run.cameraNow`; a shaking band is drawn at its middle), else the
 * follow target clamped as `Game.view()` clamps it.
 */
export function cameraView(mode, world, state, run = null) {
    const room = world.world;
    if (mode !== 'follow') return { x: 0, y: 0, w: room.width, h: room.height };
    let cam = null;
    try {
        const now = run?.cameraNow ?? null;
        if (now?.cam) cam = now.cam;
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
 */
export function paintOps(ctx, ops, images, view, canvas) {
    const scale = Math.min(canvas.width / view.w, canvas.height / view.h);
    const offX = Math.round((canvas.width - view.w * scale) / 2);
    const offY = Math.round((canvas.height - view.h * scale) / 2);
    const X = (x) => offX + Math.round((x - view.x) * scale);
    const Y = (y) => offY + Math.round((y - view.y) * scale);
    ctx.imageSmoothingEnabled = false;
    const counts = { sprites: 0, rects: 0, fallbacks: 0 };
    const fillRect = (op) => {
        ctx.globalAlpha = op.alpha ?? 1;
        ctx.fillStyle = op.colour;
        const x = X(op.rect.x);
        const y = Y(op.rect.y);
        ctx.fillRect(x, y, X(op.rect.right ?? op.rect.x + op.rect.w) - x, Y(op.rect.bottom ?? op.rect.y + op.rect.h) - y);
        ctx.globalAlpha = 1;
    };
    for (const op of ops) {
        const r = op.rect ?? { x: op.dx, y: op.dy, w: op.sw, h: op.sh };
        const right = r.right ?? r.x + r.w;
        const bottom = r.bottom ?? r.y + r.h;
        if (right < view.x || bottom < view.y || r.x > view.x + view.w || r.y > view.y + view.h) continue;
        if (!op.sheetRef) { fillRect(op); counts.rects += 1; continue; }
        const img = images?.get(op.sheetRef);
        if (!img) {
            if (op.fallback) { fillRect(op.fallback); counts.fallbacks += 1; }
            continue;
        }
        const x = X(op.dx);
        const y = Y(op.dy);
        const w = X(op.dx + op.sw) - x;
        const h = Y(op.dy + op.sh) - y;
        if (op.rot || op.flipX || op.flipY) {
            ctx.save();
            ctx.translate(x + w / 2, y + h / 2);
            if (op.rot) ctx.rotate((op.rot * Math.PI) / 180);
            ctx.scale(op.flipX ? -1 : 1, op.flipY ? -1 : 1);
            ctx.drawImage(img, op.sx, op.sy, op.sw, op.sh, -w / 2, -h / 2, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(img, op.sx, op.sy, op.sw, op.sh, x, y, w, h);
        }
        counts.sprites += 1;
    }
    return counts;
}

/** One op as a golden line: `drawImage(sheet, sx, sy, dx, dy)` (+ transforms), or `fillRect(...)`. */
export function formatOp(op) {
    if (!op.sheetRef) {
        const r = op.rect;
        return `fillRect(${op.colour}, ${r.x}, ${r.y}, ${(r.right ?? r.x + r.w) - r.x}, ${(r.bottom ?? r.y + r.h) - r.y})`;
    }
    const t = [op.rot ? ` rot=${op.rot}` : '', op.flipX ? ' flipX' : '', op.flipY ? ' flipY' : ''].join('');
    return `drawImage(${op.sheetRef}, ${op.sx}, ${op.sy}, ${op.dx}, ${op.dy})${t}`;
}
