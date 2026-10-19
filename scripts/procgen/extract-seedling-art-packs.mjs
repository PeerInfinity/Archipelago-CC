#!/usr/bin/env node
// Seedling art-pack extractor — copies the Seedling sheets the JS runtime's
// graphics renderer draws out of a Seedling source checkout into the two
// committed CONTENT PACKS, and writes their manifests:
//
//   frontend/packs/seedling/      the original Seedling art (Unlicense)
//   frontend/packs/archipelago/   the fork's ArchipelagoLogo pickup (MIT)
//
// Seedling JS graphics, slices G0+G1 (⚖ the user, 2026-10-16: the packs live
// under `frontend/` because GitHub Pages serves only `frontend/`, and
// `vendor/seedling` 404s there).
//
// ── What is in the table, and what is deliberately not ─────────────────
// `ART_TABLE` below is HAND-KEPT, seeded from the graphics investigation's
// asset inventory (the AS3 embed + `new Spritemap(img, w, h)` of every class).
// One row per art KEY: the sheet file, its frame size, the ORIGIN (the frame
// pixel that sits on the renderer's anchor) and the animations, each with the
// AS3 line it was read from. The renderer decides WHICH frame (the autotiler,
// the tree/pole neighbour rules, Y-sort); the pack only says what the frames
// ARE, so a reskin pack can replace the pictures without touching code.
//
// ⛔ LEFT OUT by ruling (the same ruling): the 04B_03 font, the promotional,
// Newgrounds and tank images, and all music and sound. They are not in the
// table, so they cannot reach a pack.
//
// ── Bytes, not pixels ─────────────────────────────────────────────────
// A sheet is COPIED, never re-encoded: the PNG in the pack is the PNG in the
// checkout, byte for byte, so `--check` is an exact comparison and the pack's
// provenance is "this file at the pinned submodule commit".
//
// Usage:
//   node scripts/procgen/extract-seedling-art-packs.mjs
//   node scripts/procgen/extract-seedling-art-packs.mjs --check
//   node scripts/procgen/extract-seedling-art-packs.mjs --source <seedling-checkout> [--check]
//
// The source is the `vendor/seedling` submodule unless `--source` names another
// checkout; an uninitialised submodule is a refusal by name (`seedlingSource.js`).
//
// --check re-extracts IN MEMORY and compares every file each pack would hold
// (pack.json, the art manifest, every sheet's bytes) and every file the pack
// directory DOES hold, WITHOUT writing; exit 1 names each drifted, missing or
// stray file. It also refuses a pack the hand-kept registry
// (`frontend/packs/packs.json`) does not list. No timestamps anywhere, so the
// same checkout always gives the same bytes.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { seedlingSourceOrExit } from './seedlingSource.js';

argvHelp(import.meta.url);
const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const PACKS_DIR = join(REPO_ROOT, 'frontend/packs');
const GRAPHICS = 'assets/graphics';

/** `Game.timePerFrame` (`Game.as:488`): the world clock advances one frame every 45 game ticks. */
const WORLD_TICKS_PER_FRAME = 45;

/** The pack-level facts that are not art rows. */
export const PACKS = Object.freeze({
    seedling: Object.freeze({
        title: 'Seedling — the original graphics',
        licence: 'Unlicense',
        credit: 'Seedling art by Connor Ullmann; vendor/seedling/LICENSE (the Unlicense) covers the whole repository.',
    }),
    archipelago: Object.freeze({
        title: 'Archipelago — the fork\'s AP item pickup',
        licence: 'MIT',
        credit: 'The Archipelago application icon (data/icon.png), downscaled to 16x16 by the Seedling fork; '
            + 'MIT per the Archipelago repository\'s root LICENSE (vendor/seedling/src/Pickups/APItem.as:67-73).',
    }),
});

const tile = (key, file, as3, extra = {}) => ({ pack: 'seedling', key: `seedling:tile/${key}`, file, fw: 16, fh: 16, as3, ...extra });
const world = (frames, loops = 1) => ({ clock: 'world', frames, loops });
const fps = (frames, rate) => ({ clock: 'fps', frames, fps: rate });

/** `Player.as:653-658`: per `states` row (`colW` 9), the walk/stand cycle of each facing. */
function playerAnims() {
    const anims = {};
    for (const [prefix, row, walk] of [['', 0, 15], ['swim-', 1, 5]]) {
        const s = row * 9;
        anims[`${prefix}down-walk`] = fps([s, s + 1, s + 2, s + 1], walk);
        anims[`${prefix}down-stand`] = fps([s, s + 1], 1);
        anims[`${prefix}side-walk`] = fps([s + 3, s + 4, s + 5, s + 4], walk);
        anims[`${prefix}side-stand`] = fps([s + 3, s + 4], 1);
        anims[`${prefix}up-walk`] = fps([s + 6, s + 7, s + 8, s + 7], walk);
        anims[`${prefix}up-stand`] = fps([s + 6, s + 7], 1);
    }
    return anims;
}

/**
 * THE TABLE. `origin` defaults to [0, 0]: the frame's top-left sits on the
 * anchor. The Seedling renderer's anchor is the tile's top-left for tiles and
 * the OEL object position (`@x`, `@y`) for scenery, so an origin here is
 * "how far up/left of the OEL position AS3 draws this picture" — the entity's
 * constructor offset plus its graphic's `x`/`y` (FlashPunk `Image.render`
 * draws at `point + (x, y)`; `originX/Y` only pivot a transform).
 */
export const ART_TABLE = Object.freeze([
    // ── tiles: one sheet per type, `Game.as:216-302`; every sheet `centerOO`d
    //    on a tile centred at (x+8, y+8), so a frame's top-left is the cell's ──
    tile('ground', 'Shore.png', 'Game.as:219 sprGround'),
    tile('water', 'Water.png', 'Game.as:221 sprWater; Tile.as:138 worldFrame(2) + random phase',
        { anims: { flow: world([0, 1]) } }),
    tile('stone', 'Stone.png', 'Game.as:223 sprStone'),
    tile('brick', 'Brick.png', 'Game.as:225 sprBrick'),
    tile('dirt', 'Dirt.png', 'Game.as:227 sprDirt'),
    tile('dungeonTile', 'DungeonTile.png', 'Game.as:229 sprDungeonTile; Tile.as:151 random 90° rotation'),
    tile('pit', 'Pit.png', 'Game.as:231 sprPit'),
    tile('shieldTile', 'ShieldTile.png', 'Game.as:233 sprShieldTile'),
    tile('forest', 'ForestTile.png', 'Game.as:235 sprForest'),
    tile('cliff', 'Cliff.png', 'Game.as:237 sprCliff'),
    tile('cliffStairs', 'CliffStairs.png', 'Game.as:302 sprCliffStairs'),
    tile('wood', 'Wood.png', 'Game.as:239 sprWood'),
    tile('walkableWood', 'WoodWalk.png', 'Game.as:241 sprWoodWalk'),
    tile('cave', 'Cave.png', 'Game.as:243 sprCave'),
    tile('woodNatural', 'WoodTree.png', 'Game.as:245 sprWoodTree'),
    tile('darkStone', 'DarkTile.png', 'Game.as:247 sprDarkTile'),
    tile('igneousStone', 'IgneousTile.png', 'Game.as:249 sprIgneousTile'),
    tile('lava', 'Lava2.png', 'Game.as:251 sprLava; Tile.as:205 worldFrame(4) + random phase',
        { anims: { flow: world([0, 1, 2, 3]) } }),
    tile('blueTile', 'BlueStone.png', 'Game.as:253 sprBlueTile (23 frames; 15..22 are the img-15 variants)'),
    tile('blueWall', 'BlueStoneWall.png', 'Game.as:255 sprBlueTileWall'),
    tile('blueWallDark', 'BlueStoneWallDark.png', 'Game.as:257 sprBlueTileWallDark'),
    tile('snow', 'Snow.png', 'Game.as:259 sprSnow'),
    tile('ice', 'Ice.png', 'Game.as:261 sprIce; Tile.as:267 random frame'),
    tile('iceWall', 'IceWall.png', 'Game.as:263 sprIceWall; Tile.as:271 worldFrame(8, 2)',
        { anims: { shimmer: world([0, 1, 2, 3, 4, 5, 6, 7], 2) } }),
    tile('iceWallGlowing', 'IceWallLit.png', 'Game.as:265 sprIceWallLit; Tile.as:286 worldFrame(8, 2)',
        { anims: { shimmer: world([0, 1, 2, 3, 4, 5, 6, 7], 2) } }),
    tile('waterfall', 'Waterfall.png', 'Game.as:267 sprWaterfall; Tile.as:301 worldFrame(4, 0.8) + random phase, +4 if continuous',
        { anims: { fall: world([0, 1, 2, 3], 0.8), fallContinuous: world([4, 5, 6, 7], 0.8) } }),
    tile('bodyFloor', 'Body.png', 'Game.as:269 sprBody; Tile.as:317 bodyFrames on the world clock',
        { anims: { pulse: world([0, 1, 2, 3, 2, 1], 1) } }),
    tile('bodyWall', 'BodyWall.png', 'Game.as:271 sprBodyWall; Tile.as:326 bodyFrames, 2 loops',
        { anims: { pulse: world([0, 1, 2, 3, 2, 1], 2) } }),
    tile('ghostTile', 'GhostTile.png', 'Game.as:273 sprGhostTile'),
    tile('bridge', 'OpenBridge.png', 'Game.as:275 sprBridge; Tile.as:75-77,347 closedBridge/openBridge, 2 loops',
        { anims: { closed: world([0, 1], 2), open: world([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], 2) } }),
    tile('ghostTileStep', 'GhostTileStep.png', 'Game.as:277 sprGhostTileStep'),
    tile('igneousToLava', 'IgneousLava.png', 'Game.as:279 sprIgneousLava (frame 0 until the player breaks it)'),
    tile('oddTile', 'OddTile.png', 'Game.as:281 sprOddTile'),
    tile('fuchsiaTile', 'FuchTile.png', 'Game.as:283 sprFuchTile'),
    tile('oddTileWall', 'OddTileWall.png', 'Game.as:285 sprOddTileWall'),
    tile('rockWallDark', 'RockTile.png', 'Game.as:287 sprRockTile; Tile.as:468 round(randVal), random 180°'),
    tile('rockWall', 'RockTile.png', 'Game.as:287 sprRockTile; Tile.as:473 round(randVal) + 2, random 180°'),
    tile('rockWallFloor', 'RockyTile.png', 'Game.as:289 sprRockyTile; Tile.as:479 round(randVal) * 4, random flips'),
    tile('pitShadow', 'PitShadow.png', 'Game.as:391 sprPitShadow; Tile.as:305 drawn over a pit waterfall'),

    // ── cliffsides: an explicit frame per cell, `CliffSide.as:39` ──
    { pack: 'seedling', key: 'seedling:scenery/cliffside', file: 'CliffSide.png', fw: 16, fh: 16,
        as3: 'Game.as:294 sprCliffSides; CliffSide.as:39 frame = the cliffsides layer column' },

    // ── static scenery, by OEL object name (`Game.loadLevelXML`, Game.as:2296-2420) ──
    { pack: 'seedling', key: 'seedling:scenery/tree', file: 'Tree2.png', fw: 32, fh: 32,
        as3: 'Game.as:372 sprTree (centerOO) at Tree(x+16, y+16); Tree.as:59-66 neighbour frame' },
    { pack: 'seedling', key: 'seedling:scenery/treebare', file: 'TreeBare.png', fw: 32, fh: 32,
        as3: 'Game.as:374 sprTreeBare (centerOO); one frame, so every neighbour mask wraps to 0' },
    { pack: 'seedling', key: 'seedling:scenery/opentree', file: 'OpenTree.png', fw: 32, fh: 32,
        as3: 'Game.as:376 sprOpenTree (centerOO); OpenTree.as render, the Tree frame' },
    { pack: 'seedling', key: 'seedling:scenery/treelarge', file: 'TreeLarge.png', fw: 160, fh: 192,
        as3: 'TreeLarge.as: Spritemap(160, 192) centerOO at (x+80, y+96); shine [0,1,2,3,2,1] on worldFrame(100, 3) (the cross-fade between frames is not drawn)',
        anims: { shine: world([0, 1, 2, 3, 2, 1], 3) } },
    { pack: 'seedling', key: 'seedling:scenery/pole', file: 'Pole.png', fw: 16, fh: 16,
        as3: 'Game.as:367 sprPole (centerOO) at Pole(x+8, y+8); Pole.as check(): +1 right, +2 left, +4 below' },
    ...['', '2', '3', '4'].map((n, i) => ({ pack: 'seedling', key: `seedling:scenery/rock${n}`, file: `Rock${n}.png`, fw: 16, fh: 16,
        as3: `Game.as:352-363 rocks[${i}] (an Image at the OEL position); Rock.as` })),
    ...['', '1', '2', '3', '4', '5', '6', '7'].map((n, i) => ({ pack: 'seedling', key: `seedling:scenery/building${n}`, file: `Building${n}.png`,
        as3: `Game.as:306-341 buildings[${i}]; Building.as:21 graphic y = -8`, origin: [0, 8] })),
    { pack: 'seedling', key: 'seedling:scenery/building8', file: 'Building8.png', fw: 64, fh: 64,
        as3: 'Game.as:338 sprBuilding8 Spritemap(64, 64); Building.as:39 y = 0; Building.as:51 moundFrames [0,1,2,1] on the world clock',
        anims: { mound: world([0, 1, 2, 1], 1) } },
    { pack: 'seedling', key: 'seedling:scenery/statue1', file: 'Statues.png', fw: 48, fh: 40, frames: [0],
        as3: 'Game.as:348 sprStatues; Statue.as:20 at (x+16, y+8), NPC centerOO (x -24), render y = -24', origin: [8, 16] },
    { pack: 'seedling', key: 'seedling:scenery/statue2', file: 'Statues.png', fw: 48, fh: 40, frames: [1],
        as3: 'Game.as:348 sprStatues; Statue.as:20 at (x+16, y-8), NPC centerOO (x -24), render y = -16', origin: [8, 24] },
    { pack: 'seedling', key: 'seedling:scenery/brickpole', file: 'BrickPole.png', as3: 'BrickPole.as: y = -4', origin: [0, 4] },
    { pack: 'seedling', key: 'seedling:scenery/brickwell', file: 'BrickWell.png', as3: 'BrickWell.as: x = -1, y = -4', origin: [1, 4] },
    { pack: 'seedling', key: 'seedling:scenery/dungeonspire', file: 'DungeonSpire.png', as3: 'DungeonSpire.as: y = -8', origin: [0, 8] },
    { pack: 'seedling', key: 'seedling:scenery/ruinedpillar', file: 'RuinedPillar.png', fw: 32, fh: 48, as3: 'RuinedPillar.as: y = -16', origin: [0, 16] },
    { pack: 'seedling', key: 'seedling:scenery/bed', file: 'Bed.png', as3: 'Bed.as: at the OEL position' },
    { pack: 'seedling', key: 'seedling:scenery/bar', file: 'Bar.png', as3: 'Bar.as: y = -4', origin: [0, 4] },
    { pack: 'seedling', key: 'seedling:scenery/barstool', file: 'Barstool.png', as3: 'Barstool.as: at (x+4, y+4), y = -4', origin: [-4, 0] },
    { pack: 'seedling', key: 'seedling:scenery/dresser', file: 'Dresser.png', as3: 'Dresser.as: y = -8', origin: [0, 8] },
    { pack: 'seedling', key: 'seedling:scenery/shieldstatue', file: 'ShieldStatue.png', as3: 'ShieldStatue.as: at (x+8, y), y = -11', origin: [-8, 11] },
    { pack: 'seedling', key: 'seedling:scenery/oraclestatue', file: 'OracleStatue.png', fw: 32, fh: 48,
        as3: 'OracleStatue.as: y = -16; render worldFrame(2)', origin: [0, 16], anims: { idle: world([0, 1], 1) } },
    { pack: 'seedling', key: 'seedling:scenery/planttorch', file: 'PlantTorch.png', fw: 16, fh: 16,
        as3: 'PlantTorch.as: at (x+8, y+8), x/y = -8; frames [0,1,2,1] worldFrame(4, 1)', anims: { burn: world([0, 1, 2, 1], 1) } },
    { pack: 'seedling', key: 'seedling:scenery/bonetorch', file: 'BoneTorch.png', fw: 16, fh: 24,
        as3: 'BoneTorch.as type 0: at (x+8, y+8), x = -8, y = -16; frames [0,1,2,1] worldFrame(4, 2)', origin: [0, 8],
        anims: { burn: world([0, 1, 2, 1], 2) } },
    { pack: 'seedling', key: 'seedling:scenery/bonetorch2', file: 'BoneTorch2.png', fw: 16, fh: 24,
        as3: 'BoneTorch.as type 1: as type 0', origin: [0, 8], anims: { burn: world([0, 1, 2, 1], 2) } },
    { pack: 'seedling', key: 'seedling:scenery/snowhill', file: 'SnowHill.png', as3: 'SnowHill.as: Game.sprSnowHill y = -8', origin: [0, 8] },

    // ── the player (G2): `Player.as:35-45`. A suit is a 9-column grid, one ROW per `states` prefix
    //    (`Player.as:83-86`: row 0 "", row 1 "swim-"); `addAnimations` (`Player.as:635-660`) adds each row's six
    //    animations ONCE, at the row's FIRST index, so "" keeps row 0's walk speed 15 (stairs' 12 is never added)
    //    and "swim-" row 1's 5. Both suits `centerOO` (`Player.as:383-384`), so the origin is the frame's centre. ──
    ...[['shrum', 'ShrumBlue.png', 'Player.as:35-37 imgShrum → sprShrum'], ['shrumDark', 'ShrumDark.png', 'Player.as:38-39 sprShrumDark (row 2 = the final scene\'s "die", not drawn)']]
        .map(([key, file, as3]) => ({ pack: 'seedling', key: `seedling:player/${key}`, file, fw: 16, fh: 16, origin: [8, 8],
            as3: `${as3}; Player.as:383 centerOO; Player.as:635-660 addAnimations (walk fps 15 / swim 5, stand fps 1)`,
            anims: playerAnims() })),
    // ── the sword overlays: `centerOO` then `x = originX = 0` (`Player.as:390-406`), so the pivot (and the anchor)
    //    is the frame's LEFT-middle, on the player's position; `slashEnd` ends the swing (`Player.as:41-45`). ──
    ...[['slash', 'Slash.png', 'Player.as:40-41 sprSlash; :390-393'], ['slashDark', 'SlashDark.png', 'Player.as:42-43 sprSlashDark; :394-397']]
        .map(([key, file, as3]) => ({ pack: 'seedling', key: `seedling:player/${key}`, file, fw: 16, fh: 32, origin: [0, 16],
            as3: `${as3} — slash [0..4] at swordSpeed 30, slashnarrow [1,2,3] at swordSpeedDash 20 (Player.as:131-132)`,
            anims: { slash: fps([0, 1, 2, 3, 4], 30), slashnarrow: fps([1, 2, 3], 20) } })),
    { pack: 'seedling', key: 'seedling:player/ghostSword', file: 'GhostSword.png', fw: 24, fh: 7, origin: [0, 3.5],
        as3: 'Player.as:44-45 sprGhostSword; :399-405 slash [0,1,2,2,3,3,4] at 30, slashnarrow [0,1,2,3] at 20',
        anims: { slash: fps([0, 1, 2, 2, 3, 3, 4], 30), slashnarrow: fps([0, 1, 2, 3], 20) } },

    // ── the fork's AP item:`APItem.as:74` (`look` "ap" → the logo, 0x0 = an Image, centred) ──
    { pack: 'archipelago', key: 'archipelago:pickup/item', file: 'ArchipelagoLogo.png',
        as3: 'Pickups/APItem.as:74 imgAP; APItem(x+8, y+8) with a centred Image', origin: [8, 8] },
]);

/** Width and height out of a PNG's IHDR (bytes 16..23), or a refusal by name. */
export function pngSize(bytes, where) {
    const sig = '89504e470d0a1a0a';
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== sig || bytes.subarray(12, 16).toString('latin1') !== 'IHDR') {
        throw new Error(`${where}: not a PNG (no IHDR)`);
    }
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

const sheetIdOf = (file) => file.replace(/\.png$/, '');

/**
 * Every file each pack holds, as `{ [pack]: Map<relative path, Buffer|string> }`,
 * built in memory from the source checkout. Pure apart from the reads.
 */
export function buildPacks(source) {
    const dir = join(source, GRAPHICS);
    const out = {};
    for (const [id, meta] of Object.entries(PACKS)) {
        const rows = ART_TABLE.filter((r) => r.pack === id);
        const files = new Map();
        const sheets = {};
        const sprites = {};
        for (const row of rows) {
            const sheetId = sheetIdOf(row.file);
            if (!sheets[sheetId]) {
                const path = join(dir, row.file);
                if (!existsSync(path)) throw new Error(`${row.key}: ${GRAPHICS}/${row.file} is not in ${source}`);
                const bytes = readFileSync(path);
                const { w, h } = pngSize(bytes, `${GRAPHICS}/${row.file}`);
                sheets[sheetId] = { file: `sheets/${row.file}`, w, h };
                files.set(`art/sheets/${row.file}`, bytes);
            }
            const sheet = sheets[sheetId];
            const fw = row.fw ?? sheet.w;
            const fh = row.fh ?? sheet.h;
            if (sprites[row.key]) throw new Error(`${row.key}: two table rows`);
            const sprite = { sheet: sheetId, fw, fh, frames: Math.floor(sheet.w / fw) * Math.floor(sheet.h / fh) };
            if (row.frames) sprite.only = row.frames;
            if (row.origin) sprite.origin = row.origin;
            if (row.anims) sprite.anims = row.anims;
            sprite.as3 = row.as3;
            sprites[row.key] = sprite;
        }
        const manifest = {
            schema_version: 1,
            generated_by: 'scripts/procgen/extract-seedling-art-packs.mjs — do not edit; regenerate and --check',
            clocks: { world: { ticksPerFrame: WORLD_TICKS_PER_FRAME, as3: 'Game.as:488 timePerFrame; Game.as:1962 worldFrame(n, loops)' } },
            sheets,
            sprites,
        };
        const pack = {
            schema_version: 1,
            id,
            title: meta.title,
            licence: meta.licence,
            credit: meta.credit,
            source: `vendor/seedling/${GRAPHICS} (PeerInfinity/Seedling), copied byte for byte`,
            layers: { art: 'art/manifest.json' },
        };
        files.set('pack.json', `${JSON.stringify(pack, null, 2)}\n`);
        files.set('art/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
        out[id] = files;
    }
    return out;
}

/** Every file under `dir`, as relative paths. */
function listFiles(dir, base = dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);
        return e.isDirectory() ? listFiles(p, base) : [relative(base, p)];
    });
}

/** The drift between what `buildPacks` makes and what is on disk, as named lines; [] = identical. */
export function packDrift(built, packsDir = PACKS_DIR) {
    const problems = [];
    const registryPath = join(packsDir, 'packs.json');
    let listed = [];
    try {
        listed = JSON.parse(readFileSync(registryPath, 'utf8')).packs.map((p) => p.id);
    } catch (err) {
        problems.push(`frontend/packs/packs.json: unreadable (${err.message})`);
    }
    for (const [id, files] of Object.entries(built)) {
        if (!listed.includes(id)) problems.push(`frontend/packs/packs.json: does not list the pack "${id}"`);
        const root = join(packsDir, id);
        for (const [rel, want] of files) {
            const path = join(root, rel);
            if (!existsSync(path)) { problems.push(`${id}/${rel}: MISSING`); continue; }
            const have = readFileSync(path);
            const wantBuf = typeof want === 'string' ? Buffer.from(want, 'utf8') : want;
            if (!have.equals(wantBuf)) problems.push(`${id}/${rel}: DIFFERS from a fresh extract`);
        }
        for (const rel of listFiles(root)) {
            if (!files.has(rel)) problems.push(`${id}/${rel}: STRAY (no table row makes it)`);
        }
    }
    return problems;
}

function main() {
    const argv = process.argv.slice(2);
    const arg = (name, fallback) => {
        const i = argv.indexOf(name);
        return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
    };
    const source = seedlingSourceOrExit(arg('--source'), { tool: 'extract-seedling-art-packs.mjs' });
    const built = buildPacks(source);
    const counts = Object.entries(built).map(([id, f]) => `${id}: ${[...f.keys()].filter((k) => k.startsWith('art/sheets/')).length} sheets`).join(', ');
    if (argv.includes('--check')) {
        const problems = packDrift(built);
        if (problems.length) {
            console.error(`--check FAILED: ${problems.length} file(s) drifted from a fresh extract of ${source}:`);
            for (const p of problems) console.error(`  ${p}`);
            console.error('Regenerate with: node scripts/procgen/extract-seedling-art-packs.mjs');
            process.exit(1);
        }
        console.log(`--check OK: ${counts} — byte-identical, no stray files`);
        return;
    }
    for (const [id, files] of Object.entries(built)) {
        const root = join(PACKS_DIR, id);
        rmSync(join(root, 'art'), { recursive: true, force: true });
        for (const [rel, data] of files) {
            const path = join(root, rel);
            mkdirSync(join(path, '..'), { recursive: true });
            writeFileSync(path, data);
        }
    }
    console.log(`wrote ${relative(REPO_ROOT, PACKS_DIR)}: ${counts}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
