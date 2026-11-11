/**
 * CONTENT SETS R2b — a pack can supply the maze's tiles (`mazeTileArt.js`; the seam in `mazeRoomRender.drawWorld`).
 * In node over the recorded draw-op log (`drawOpRecorder.js`: no pixels; the log is a superset of them):
 *
 *   1. The key table is checked against the painter's own `COLORS`: every row paints with real `COLORS` keys, and every
 *      `COLORS` key is either a thing's or one of the state signals stated HERE (independently of the module).
 *   2. No art → today's ops, whatever "no art" means: `tileArt: null`, a library with no maze key, a library whose
 *      sheets did not decode. Over every playable payload of the committed Seedling playthrough preset.
 *   3. A FIXTURE stack (in-memory `readJson`, a stub decoder) whose later pack overrides one key: that thing draws the
 *      later pack's image, a thing keyed only by the earlier pack draws the earlier one, an un-keyed thing draws its
 *      `COLORS` fill, and a key whose sheet fails to decode falls back to its `COLORS` fill.
 *   4. The engine closure: this file's module is not in it, and nothing it imports is.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { KEY_PATTERN, loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { importClosure } from '../../../scripts/procgen/seedlingDerivedRuleTable.js';
import { recordingContext } from './drawOpRecorder.js';
import { TILE_WALL, createState, deserializeMazeWorld, getTile } from './mazeRoomEngine.js';
import { COLORS, drawWorld, plainView } from './mazeRoomRender.js';
import {
    MAZE_ART_KEYS, MAZE_ART_NAMESPACE, MAZE_ART_THINGS, MazeTileArtError, drawTileArt, keyedThings, loadMazeTileArt,
    tileArtRefusal,
} from './mazeTileArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const PLAYTHROUGH = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const PAYLOADS = Object.entries(PLAYTHROUGH.preset_sidecars['1']).filter(([, v]) => v.playable_payload)
    .map(([k, v]) => [k, v.playable_payload]);
const worldOf = (payload) => deserializeMazeWorld(JSON.parse(JSON.stringify(payload)));
/** A payload with blocks, buttons and traps: the first one that has all three (read off the data, not named). */
const RICH = PAYLOADS.find(([, p]) => p.blocks?.length && p.buttons?.length && p.traps?.length);

/**
 * ⛔ STATED HERE, NOT READ FROM THE MODULE: the `COLORS` keys that are state signals or edges and get no art key.
 * A key added to `COLORS` without a decision (a thing row, or this list) reds the coverage row.
 */
const SIGNALS = ['exitBlocked', 'locationBlocked', 'grid', 'laneArmed', 'laneSilent', 'pullLive', 'pullInert',
    'pullMouth', 'blockEdge'];

const logOf = (world, view) => {
    const ctx = recordingContext();
    drawWorld(ctx, world, view);
    return ctx.__log;
};
const viewFor = (world, extra = {}) => {
    const s = createState(world);
    return plainView({ tilePx: 16, playerPos: s.player_pos, inventory: s.inventory, blocks: s.blocks ?? null, ...extra });
};

// ── the fixture stack ──────────────────────────────────────────────────────────
const FIX_BASE = 'https://fixture.invalid/packs/';
const pack = (id) => ({ schema_version: 1, id, title: id, licence: 'test fixture', layers: { art: 'art/manifest.json' } });
/** `base-theme`: one 64×16 sheet, a frame per thing (`only` picks it). */
const BASE_KEYS = ['floor', 'wall', 'block', 'button', 'exit'];
const FIXTURE = {
    'base-theme/pack.json': pack('base-theme'),
    'base-theme/art/manifest.json': {
        schema_version: 1,
        sheets: { tiles: { file: 'sheets/tiles.png', w: 16 * BASE_KEYS.length, h: 16 } },
        sprites: Object.fromEntries(BASE_KEYS.map((thing, i) => [MAZE_ART_KEYS[thing].key, { sheet: 'tiles', fw: 16, fh: 16, only: [i] }])),
    },
    // `override-theme`, later in the stack: its own wall (wins), and a player on a sheet that will not decode.
    'override-theme/pack.json': pack('override-theme'),
    'override-theme/art/manifest.json': {
        schema_version: 1,
        sheets: { walls: { file: 'sheets/walls.png', w: 16, h: 16 }, broken: { file: 'sheets/broken.png', w: 16, h: 16 } },
        sprites: {
            [MAZE_ART_KEYS.wall.key]: { sheet: 'walls', fw: 16, fh: 16 },
            [MAZE_ART_KEYS.player.key]: { sheet: 'broken', fw: 16, fh: 16 },
        },
    },
};
const fixtureIo = (decoded = []) => ({
    base: FIX_BASE,
    readJson: async (url) => {
        const hit = FIXTURE[url.slice(FIX_BASE.length)];
        if (!hit) throw new Error(`no fixture at ${url}`);
        return JSON.parse(JSON.stringify(hit));
    },
    decode: async (url) => {
        decoded.push(url);
        if (url.includes('broken')) throw new Error('not an image');
        return { src: url.slice(FIX_BASE.length) };
    },
});
const blit = (src, sx, x, y, px) => `drawImage(${JSON.stringify({ src })},${sx},0,16,16,${x * px},${y * px},${px},${px})`;

describe('the key table', () => {
    it('every row is a namespaced maze key, one per thing, painting with real COLORS keys', () => {
        const keys = MAZE_ART_THINGS.map((t) => MAZE_ART_KEYS[t].key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const thing of MAZE_ART_THINGS) {
            const { key, colors } = MAZE_ART_KEYS[thing];
            expect(key, thing).toMatch(KEY_PATTERN);
            expect(key.startsWith(`${MAZE_ART_NAMESPACE}:`), thing).toBe(true);
            for (const c of colors) expect(Object.keys(COLORS), `${thing}.${c}`).toContain(c);
        }
    });

    it('every COLORS key is a thing\'s or a stated state signal — none is undecided', () => {
        const things = new Set(MAZE_ART_THINGS.flatMap((t) => MAZE_ART_KEYS[t].colors));
        const undecided = Object.keys(COLORS).filter((c) => !things.has(c) && !SIGNALS.includes(c));
        expect(undecided).toEqual([]);
        // a signal is never ALSO a thing's main colour (blockEdge and pullMouth ride along with their thing's body)
        const mainColours = new Set(MAZE_ART_THINGS.map((t) => MAZE_ART_KEYS[t].colors[0]));
        expect(SIGNALS.filter((c) => mainColours.has(c))).toEqual([]);
    });

    it('the seam refuses an unknown thing and a malformed view field by name', () => {
        expect(() => drawTileArt(recordingContext(), null, 'lava', 0, 0, 1, 1)).toThrow(MazeTileArtError);
        expect(() => drawTileArt(recordingContext(), null, 'lava', 0, 0, 1, 1)).toThrow(/no thing "lava"/);
        expect(tileArtRefusal(null)).toBe(null);
        expect(tileArtRefusal({})).toMatch(/tileArt\.art must be an art library/);
        expect(() => drawWorld(recordingContext(), worldOf(RICH[1]), { ...plainView(), tileArt: { art: createArtLibrary([]) } }))
            .toThrow(/view\.tileArt\.images must be a Map/);
    });
});

describe('no art available → exactly today\'s draw', () => {
    const noKeys = { art: createArtLibrary([]), images: new Map() };

    it(`over every playable payload of the playthrough preset (${PAYLOADS.length})`, async () => {
        // A real library with keys but no decoded sheet: the "sheet failed" case, for every key.
        const stack = await loadPackStack(['base-theme', 'override-theme'], fixtureIo());
        const undecoded = { art: createArtLibrary(stack), images: new Map() };
        expect(Object.keys(keyedThings(undecoded.art)).length).toBeGreaterThan(0);
        for (const [id, payload] of PAYLOADS) {
            const world = worldOf(payload);
            const today = logOf(world, viewFor(world));
            expect(logOf(world, viewFor(world, { tileArt: noKeys })), `${id}: no maze key`).toEqual(today);
            expect(logOf(world, viewFor(world, { tileArt: undecoded })), `${id}: no sheet decoded`).toEqual(today);
        }
    });

    it('a stack with no maze key loads no tile art and decodes nothing (the committed archipelago pack)', async () => {
        const decoded = [];
        const r = await loadMazeTileArt(['archipelago'], { base: PACKS, readJson: fsJson, decode: async (u) => { decoded.push(u); return {}; } });
        expect(r.tileArt).toBe(null);
        expect(r.keyed).toEqual({});
        expect(decoded).toEqual([]);
    });

    it('an empty stack reads nothing', async () => {
        const io = { base: FIX_BASE, readJson: async () => { throw new Error('read'); }, decode: async () => { throw new Error('decode'); } };
        expect(await loadMazeTileArt([], io)).toEqual({ ids: [], tileArt: null, failed: [], keyed: {} });
    });
});

describe('a fixture stack: the later pack wins per key, everything else falls back', () => {
    const PX = 16;
    const load = async (decoded) => loadMazeTileArt(['base-theme', 'override-theme'], fixtureIo(decoded));

    it('loads the art layer, names the failed sheet, decodes only the sheets maze keys use', async () => {
        const decoded = [];
        const r = await load(decoded);
        expect(r.keyed).toEqual({
            floor: 'base-theme', wall: 'override-theme', block: 'base-theme', button: 'base-theme', exit: 'base-theme',
            player: 'override-theme',
        });
        expect(r.failed).toHaveLength(1);
        expect(r.failed[0]).toMatch(/override-theme\/broken/);
        expect(decoded.map((u) => u.slice(FIX_BASE.length)).sort()).toEqual([
            'base-theme/art/sheets/tiles.png', 'override-theme/art/sheets/broken.png', 'override-theme/art/sheets/walls.png',
        ]);
    });

    it(`draws ${RICH?.[0]}: walls from the later pack, floors from the earlier, the player and the un-keyed trap in COLORS`, async () => {
        const { tileArt } = await load([]);
        const world = worldOf(RICH[1]);
        const view = viewFor(world, { tileArt });
        const log = logOf(world, view);
        const tiles = { wall: [], floor: [] };
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) tiles[getTile(world, x, y) === TILE_WALL ? 'wall' : 'floor'].push([x, y]);
        }
        // the base layer: one blit per cell, in row order, each from the pack that wins its key
        const base = log.slice(0, world.width * world.height);
        for (const [x, y] of tiles.wall) expect(base).toContain(blit('override-theme/art/sheets/walls.png', 0, x, y, PX));
        for (const [x, y] of tiles.floor) expect(base).toContain(blit('base-theme/art/sheets/tiles.png', 0, x, y, PX));
        expect(log.filter((l) => l.includes('override-theme/art/sheets/walls.png'))).toHaveLength(tiles.wall.length);
        // the blocks: the base pack's frame (index 2), at the cells the world lays them
        for (const key of world.blocks.keys()) {
            const [x, y] = key.split(',').map(Number);
            expect(log).toContain(blit('base-theme/art/sheets/tiles.png', 16 * BASE_KEYS.indexOf('block'), x, y, PX));
        }
        // the player's key is in the stack but its sheet failed: the COLORS disc, as today
        const { x: px, y: py } = view.playerPos;
        const disc = `arc(${px * PX + PX / 2},${py * PX + PX / 2},${PX * 0.35},0,${Math.PI * 2})`;
        expect(log).toContain(disc);
        expect(log[log.indexOf(disc) - 2]).toBe(`fillStyle=${JSON.stringify(COLORS.player)}`);
        // the trap has no key in this stack: its COLORS strip, as today
        expect(log).toContain(`fillStyle=${JSON.stringify(COLORS.trap)}`);
    });
});

describe('outside the maze engine\'s import closure', () => {
    it('neither this module nor anything it imports is in the closure `engineMd5` hashes', () => {
        const engine = new Set(importClosure());
        const mine = importClosure(join(HERE, 'mazeTileArt.js'));
        const self = relative(ROOT, join(HERE, 'mazeTileArt.js'));
        expect(mine).toContain(self);
        expect(mine.filter((f) => engine.has(f))).toEqual([]);
        expect(engine.has(relative(ROOT, join(HERE, 'mazeRoomRender.js')))).toBe(false);
        expect(engine.has(relative(ROOT, join(HERE, 'mazeRoomUI.js')))).toBe(false);
    });
});

describe('⛓ a SHAPE entry through the seam (content sets R2b part 2)', () => {
    it('a later pack\'s shape overrides an earlier pack\'s sprite for the block; the seam draws the rasterised shape', async () => {
        const SHAPE_BLOCK = { w: 16, h: 16, draw: [{ rect: [1, 1, 14, 14], fill: '#c8a06a', stroke: '#2a1c0c', width: 2 }] };
        const files = {
            ...FIXTURE,
            'shape-theme/pack.json': pack('shape-theme'),
            'shape-theme/art/manifest.json': { schema_version: 1, shapes: { [MAZE_ART_KEYS.block.key]: SHAPE_BLOCK } },
        };
        const rasterised = [];
        const io = {
            base: FIX_BASE,
            readJson: async (url) => JSON.parse(JSON.stringify(files[url.slice(FIX_BASE.length)])),
            decode: async (url) => ({ src: url.slice(FIX_BASE.length) }),
            rasterise: async (shape) => { rasterised.push(shape); return { shape: 'block' }; },
        };
        const r = await loadMazeTileArt(['base-theme', 'shape-theme'], io);
        expect(r.keyed.block).toBe('shape-theme');
        expect(r.tileArt.art.kindOf(MAZE_ART_KEYS.block.key)).toBe('shape');
        expect(rasterised).toEqual([SHAPE_BLOCK]);
        const world = worldOf(RICH[1]);
        const log = logOf(world, viewFor(world, { tileArt: r.tileArt }));
        for (const key of world.blocks.keys()) {
            const [x, y] = key.split(',').map(Number);
            expect(log).toContain(`drawImage({"shape":"block"},0,0,16,16,${x * 16},${y * 16},16,16)`);
        }
        expect(log.filter((l) => l.startsWith('drawImage({"shape"'))).toHaveLength(world.blocks.size);
    });
});
