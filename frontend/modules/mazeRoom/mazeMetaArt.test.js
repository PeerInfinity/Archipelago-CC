/**
 * CONTENT SETS R4 — **THE `meta` THEME DRAWS THE MAZE FROM SHAPES** (`frontend/packs/meta/art/manifest.json`).
 * The first real shape art in the repo. In node, over the recorded draw-op log (`drawOpRecorder.js`):
 *
 *   1. The manifest parses (`artLibrary.parseArtManifest`), carries ONLY shapes (no sheet, no sprite, no image file
 *      in the pack), and the pack declares it as its `art` layer.
 *   2. Every key it carries is one of `MAZE_ART_KEYS`' keys, and every key of the table is either carried or in
 *      `OMITTED` below with its reason — derived from the two tables, never a count.
 *   3. Each recipe paints inside its box: `paintShape` on a recording context, every coordinate it lays against the
 *      shape's own `w`/`h` (a stroked outline with half its stroke width; a line by its end points, as the canvas
 *      clips a line's square end). One style: one box size, one stroke width.
 *   4. The states stay apart: block / block-struck / block-dormant are three recipes, button up / down two, and an
 *      open exit never paints the closed exit's `COLORS.exitBlocked`.
 *   5. THE SEAM, with the real `meta` stack (the committed packs through `loadMazeTileArt`, a stub rasteriser): a
 *      maze world staged to hold every thing draws each carried key from the pack (`"meta#<key>"`) and each omitted
 *      key from `COLORS`; a plain world's own stack (no `content`) still draws exactly as it did.
 *   6. `meta_trial`'s document: its recorded content resolves through `effectiveContentStack` to `['maze', 'meta']`,
 *      and that stack keys the maze's things from `meta`.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseArtManifest, paintShape, shapeSheetRef } from '../artLibrary/artLibrary.js';
import { parsePack } from '../contentPacks/contentPacks.js';
import { documentContentOf, effectiveContentStack } from '../procgenPipeline/worldContent.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { recordingContext } from './drawOpRecorder.js';
import { TILE_WALL, createState, deserializeMazeWorld, getTile } from './mazeRoomEngine.js';
import { COLORS, TILE_PX, drawWorld, plainView } from './mazeRoomRender.js';
import { MAZE_ART_KEYS, MAZE_ART_THINGS, loadMazeTileArt } from './mazeTileArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACK_ID = 'meta';
const PACK_DIR = join(ROOT, 'frontend/packs', PACK_ID);
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const PACK = JSON.parse(readFileSync(join(PACK_DIR, 'pack.json'), 'utf8'));
const MANIFEST = JSON.parse(readFileSync(join(PACK_DIR, PACK.layers.art), 'utf8'));
const SHAPES = MANIFEST.shapes ?? {};
const META_TRIAL = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8'));
const PLAYTHROUGH = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));

/**
 * ⛓ THE ONE TABLE OF KEYS THE THEME LEAVES OUT (they fall back to the maze's own `COLORS` drawing), each with its
 * reason. Empty today: every thing of `MAZE_ART_KEYS` has a recipe that reads better than the default for this
 * theme. A row added here must name why no simple shape does.
 */
const OMITTED = Object.freeze({});

const thingOfKey = new Map(MAZE_ART_THINGS.map((t) => [MAZE_ART_KEYS[t].key, t]));
const CARRIED = MAZE_ART_THINGS.filter((t) => MAZE_ART_KEYS[t].key in SHAPES);

describe(`the "${PACK_ID}" art layer`, () => {
    it('is declared by the pack and parses as an art manifest of shapes only', () => {
        expect(() => parsePack(PACK, PACK_ID)).not.toThrow();
        expect(PACK.layers.art).toBeTypeOf('string');
        expect(() => parseArtManifest(MANIFEST, PACK_ID)).not.toThrow();
        expect(Object.keys(SHAPES).length).toBeGreaterThan(0);
        expect(MANIFEST.sprites ?? {}).toEqual({});
        expect(MANIFEST.sheets ?? {}).toEqual({});
    });

    it('ships no image file (a theme complete without a single image)', () => {
        const walk = (dir) => readdirSync(dir, { withFileTypes: true })
            .flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
        expect(walk(PACK_DIR).filter((f) => !f.endsWith('.json'))).toEqual([]);
        expect(existsSync(join(PACK_DIR, 'art/sheets'))).toBe(false);
    });

    it('carries only maze keys; every maze key is carried or in OMITTED with a reason, never both', () => {
        expect(Object.keys(SHAPES).filter((k) => !thingOfKey.has(k))).toEqual([]);
        for (const [thing, why] of Object.entries(OMITTED)) {
            expect(MAZE_ART_THINGS, `OMITTED.${thing}`).toContain(thing);
            expect(why, `OMITTED.${thing} has a reason`).toMatch(/\w{8,}/);
            expect(CARRIED, `OMITTED.${thing} is not also carried`).not.toContain(thing);
        }
        expect([...CARRIED, ...Object.keys(OMITTED)].sort()).toEqual([...MAZE_ART_THINGS].sort());
    });
});

/** Every coordinate a recipe lays, from the recorded `paintShape` log, with the stroke that outlines it. */
function extentsOf(shape) {
    const ctx = recordingContext();
    paintShape(ctx, shape);
    const out = [];
    let width = 1;
    let path = [];
    const close = (stroked) => out.push(...path.map((p) => ({ ...p, pad: stroked && !p.line ? width / 2 : 0 })));
    for (const line of ctx.__log) {
        const m = line.match(/^(\w+)(?:\((.*)\))?(?:=(.*))?$/);
        const [, op, args] = m;
        const nums = args ? JSON.parse(`[${args}]`) : [];
        if (line.startsWith('lineWidth=')) width = Number(line.slice('lineWidth='.length));
        else if (op === 'beginPath') path = [];
        else if (op === 'rect') path.push({ x0: nums[0], y0: nums[1], x1: nums[0] + nums[2], y1: nums[1] + nums[3] });
        else if (op === 'arc') path.push({ x0: nums[0] - nums[2], y0: nums[1] - nums[2], x1: nums[0] + nums[2], y1: nums[1] + nums[2] });
        else if (op === 'moveTo' || op === 'lineTo') path.push({ x0: nums[0], y0: nums[1], x1: nums[0], y1: nums[1], line: true });
        else if (op === 'closePath') path = path.map((p) => ({ ...p, line: false }));
        else if (op === 'stroke') close(true);
        else if (op === 'fill') close(false);
    }
    return out;
}

describe('each recipe paints inside its box, in one style', () => {
    it.each(Object.keys(SHAPES))('%s', (key) => {
        const shape = SHAPES[key];
        const ext = extentsOf(shape);
        expect(ext.length, 'it lays some geometry').toBeGreaterThan(0);
        const outside = ext.filter((e) => e.x0 - e.pad < 0 || e.y0 - e.pad < 0 || e.x1 + e.pad > shape.w || e.y1 + e.pad > shape.h);
        expect(outside, `inside ${shape.w}×${shape.h}`).toEqual([]);
    });

    it('one box for every recipe, the maze\'s own cell (drawn 1:1 in play), and one stroke width', () => {
        const boxes = new Set(Object.values(SHAPES).map((s) => `${s.w}x${s.h}`));
        expect([...boxes]).toEqual([`${TILE_PX}x${TILE_PX}`]);
        const widths = new Set(Object.values(SHAPES).flatMap((s) => s.draw.filter((op) => op.stroke).map((op) => op.width ?? 1)));
        expect(widths.size).toBe(1);
    });

    it('the base layer (floor, wall) covers its whole cell, so nothing from before shows through', () => {
        for (const thing of ['floor', 'wall'].filter((t) => CARRIED.includes(t))) {
            const s = SHAPES[MAZE_ART_KEYS[thing].key];
            expect(s.draw[0], thing).toMatchObject({ rect: [0, 0, s.w, s.h] });
            expect(s.draw[0].fill, thing).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
});

describe('the states stay apart', () => {
    const recipe = (thing) => JSON.stringify(SHAPES[MAZE_ART_KEYS[thing].key]?.draw ?? null);
    it('block, block-struck and block-dormant are three different recipes', () => {
        const carried = ['block', 'blockStruck', 'blockDormant'].filter((t) => CARRIED.includes(t));
        expect(new Set(carried.map(recipe)).size).toBe(carried.length);
    });
    it('a button up and a button down are different recipes', () => {
        if (CARRIED.includes('button') && CARRIED.includes('buttonDown')) expect(recipe('button')).not.toBe(recipe('buttonDown'));
    });
    it('an open exit never paints the closed exit\'s colour (the closed one stays the COLORS.exitBlocked fill)', () => {
        const colours = (SHAPES[MAZE_ART_KEYS.exit.key]?.draw ?? []).flatMap((op) => [op.fill, op.stroke]).filter(Boolean)
            .map((c) => c.slice(0, 7).toLowerCase());
        expect(colours).not.toContain(COLORS.exitBlocked.toLowerCase());
    });
});

// ── the seam, with the real stack ───────────────────────────────────────────────────────────────────────────────
/** The stub rasteriser: an image that names its shape's key (shapes are matched by content, one per key). */
const rasteriseByKey = () => {
    const byContent = new Map(Object.entries(SHAPES).map(([k, s]) => [JSON.stringify(s), k]));
    return async (shape) => ({ key: byContent.get(JSON.stringify(shape)) });
};
const blitOf = (line) => line.match(/^drawImage\(\{"key":"([^"]+)"\}/)?.[1] ?? null;

/**
 * Maze scenes staged so every thing of the key table is drawn, from the committed Seedling playthrough payloads (read
 * off the data, never named): the first that has blocks, buttons and traps (one with a `block_lib` first, for a struck
 * kind), and the first that has pulls. No committed payload carries the rest, so they are staged on the rich world —
 * a mana tile, a pulser, a dormant block kind — and a second view of it puts the player on a button (DOWN). Staged on
 * the DESERIALIZED world, as the painter reads it. A rich payload with no `block_lib` adds the walked block; nothing here is a world anyone plays.
 * Returns `[{ world, view }]`.
 */
function stagedScenes() {
    const payloads = Object.values(PLAYTHROUGH.preset_sidecars['1']).map((v) => v.playable_payload).filter(Boolean);
    const richOnes = payloads.filter((p) => p.blocks?.length && p.buttons?.length && p.traps?.length);
    const rich = richOnes.find((p) => p.block_lib) ?? richOnes[0];
    const pulls = payloads.find((p) => p.pulls?.length);
    const world = deserializeMazeWorld(JSON.parse(JSON.stringify(rich)));
    const s = createState(world);
    const busy = new Set([...world.items.keys(), ...world.obstacles.keys(), ...world.blocks.keys(), ...world.buttons.keys(),
        `${world.entrance.x},${world.entrance.y}`, `${s.player_pos.x},${s.player_pos.y}`,
        ...[...world.exits.values()].map((e) => `${e.x},${e.y}`), ...(world.traps ?? []).map((t) => `${t.x},${t.y}`)]);
    const free = (wantWall) => {
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                if (!busy.has(`${x},${y}`) && (getTile(world, x, y) === TILE_WALL) === wantWall) { busy.add(`${x},${y}`); return { x, y }; }
            }
        }
        throw new Error('staging: no free cell');
    };
    const mana = free(false);
    world.manaTiles = new Map([[`${mana.x},${mana.y}`, 1]]);
    const pulser = free(true);
    world.pulsers = [...(world.pulsers ?? []), { x: pulser.x, y: pulser.y, reach: [], token: 'r4-staged-pulser' }];
    const dormantKind = 'r4-staged-dormant';
    world.blockLib = { ...(world.blockLib ?? {}), [dormantKind]: { wake: true } };
    const [firstBlock] = world.blocks.keys();
    const base = { tilePx: TILE_PX, inventory: s.inventory, blocks: s.blocks ?? null };
    const [button] = world.buttons.keys();
    const [bx, by] = button.split(',').map(Number);
    const scene = (payload) => {
        const w = deserializeMazeWorld(JSON.parse(JSON.stringify(payload)));
        const st = createState(w);
        return { world: w, view: { tilePx: TILE_PX, inventory: st.inventory, blocks: st.blocks ?? null, playerPos: st.player_pos } };
    };
    return [
        { world, view: { ...base, playerPos: s.player_pos, blockKinds: { [firstBlock]: dormantKind } }, pulser },
        { world, view: { ...base, playerPos: { x: bx, y: by } }, pulser },
        scene(pulls),
        // the walked block: a rich payload with no block_lib draws every block as the walked kind
        scene(richOnes.find((p) => !p.block_lib) ?? rich),
    ];
}

describe('⛓ the seam draws the meta stack: every carried key from the pack, every omitted key from COLORS', () => {
    it('the stack loads every carried key from "meta", rasterises each once, decodes no sheet', async () => {
        const decoded = [];
        const r = await loadMazeTileArt([substrateRegistryEntry.defaultContentPack, PACK_ID], {
            base: PACKS, readJson: fsJson, decode: async (u) => { decoded.push(u); throw new Error('no sheet'); },
            rasterise: rasteriseByKey(),
        });
        expect(r.failed).toEqual([]);
        expect(decoded).toEqual([]);
        expect(r.keyed).toEqual(Object.fromEntries(CARRIED.map((t) => [t, PACK_ID])));
        expect([...r.tileArt.images.keys()].sort()).toEqual(CARRIED.map((t) => shapeSheetRef(PACK_ID, MAZE_ART_KEYS[t].key)).sort());
    });

    it('a staged world draws each carried thing from its "meta#<key>" sheet and no carried thing in COLORS', async () => {
        const { tileArt } = await loadMazeTileArt([substrateRegistryEntry.defaultContentPack, PACK_ID], {
            base: PACKS, readJson: fsJson, decode: async () => { throw new Error('no sheet'); }, rasterise: rasteriseByKey(),
        });
        const drawn = new Set();
        const logs = stagedScenes().map(({ world, view }) => {
            const ctx = recordingContext();
            drawWorld(ctx, world, plainView({ ...view, tileArt }));
            for (const l of ctx.__log) if (blitOf(l)) drawn.add(blitOf(l));
            return ctx.__log;
        });
        expect([...drawn].map((k) => thingOfKey.get(k)).sort()).toEqual([...CARRIED].sort());
        // each blit is the frame of the key's own sheet in the pack
        for (const thing of CARRIED) {
            const r = tileArt.art.frameRect(MAZE_ART_KEYS[thing].key, 0);
            expect(r.sheetRef, thing).toBe(shapeSheetRef(PACK_ID, MAZE_ART_KEYS[thing].key));
        }
        // a carried thing's own fallback colour is not used for it: the floor/wall base fill and the player disc
        const all = logs.flat();
        if (CARRIED.includes('floor')) expect(all).not.toContain(`fillStyle=${JSON.stringify(COLORS.floor)}`);
        if (CARRIED.includes('player')) expect(all).not.toContain(`fillStyle=${JSON.stringify(COLORS.player)}`);
        if (CARRIED.includes('manaTile')) expect(all).not.toContain(`fillStyle=${JSON.stringify(COLORS.manaTile)}`);
        // every omitted thing paints its first COLORS colour
        for (const thing of Object.keys(OMITTED)) {
            expect(all, thing).toContain(`fillStyle=${JSON.stringify(COLORS[MAZE_ART_KEYS[thing].colors[0]])}`);
        }
    });

    it('the state signals drawn over or around a thing are unchanged: the facing tick, the rings, the tints, red', async () => {
        const { tileArt } = await loadMazeTileArt([substrateRegistryEntry.defaultContentPack, PACK_ID], {
            base: PACKS, readJson: fsJson, decode: async () => { throw new Error('no sheet'); }, rasterise: rasteriseByKey(),
        });
        const count = (log, line) => log.filter((l) => l === line).length;
        for (const { world, view, pulser } of stagedScenes()) {
            const ring = pulser
                ? `arc(${pulser.x * TILE_PX + TILE_PX / 2},${pulser.y * TILE_PX + TILE_PX / 2},${TILE_PX * 0.42},0,${Math.PI * 2})` : null;
            const facing = { ...view, facing: 'E' };
            const withArt = recordingContext();
            drawWorld(withArt, world, plainView({ ...facing, tileArt }));
            const without = recordingContext();
            drawWorld(without, world, plainView(facing));
            // the facing tick: the last two ops (its COLORS.wall fill and its square), identical over the art
            expect(without.__log.slice(-2)[0]).toBe(`fillStyle=${JSON.stringify(COLORS.wall)}`);
            expect(withArt.__log.slice(-2)).toEqual(without.__log.slice(-2));
            // the pulser's ring, the lane and disc tints, the closed exits' and blocked locations' red: as many as before
            if (ring) expect(count(withArt.__log, ring)).toBe(1);
            for (const line of [...(ring ? [ring] : []), 'globalAlpha=0.3', 'globalAlpha=0.25',
                ...['laneArmed', 'laneSilent', 'pullLive', 'pullInert'].map((c) => `fillStyle=${JSON.stringify(COLORS[c])}`),
                ...['laneArmed', 'laneSilent', 'locationBlocked'].map((c) => `strokeStyle=${JSON.stringify(COLORS[c])}`),
                `fillStyle=${JSON.stringify(COLORS.exitBlocked)}`]) {
                expect(count(withArt.__log, line), line).toBe(count(without.__log, line));
            }
        }
    });

    it('a plain maze world (no content) still keys nothing: its stack is the maze default pack alone', async () => {
        const stack = effectiveContentStack({ substrateIds: [substrateRegistryEntry.id], content: [], registry: { getAll: () => [substrateRegistryEntry] } });
        expect(stack).not.toContain(PACK_ID);
        const r = await loadMazeTileArt(stack, { base: PACKS, readJson: fsJson, decode: async () => ({}), rasterise: rasteriseByKey() });
        expect(r.tileArt).toBe(null);
        expect(r.keyed).toEqual({});
    });
});

describe('meta_trial selects the theme, and its maze resolves the theme\'s art', () => {
    it('its recorded content resolves through effectiveContentStack to the maze default pack, then the theme', async () => {
        const slot = Object.keys(META_TRIAL.procgen_metadata)[0];
        const content = documentContentOf(META_TRIAL, slot);
        expect(content).toEqual([PACK_ID]);
        const stack = effectiveContentStack({ substrateIds: [substrateRegistryEntry.id], content, registry: { getAll: () => [substrateRegistryEntry] } });
        expect(stack).toEqual([substrateRegistryEntry.defaultContentPack, PACK_ID]);
        const r = await loadMazeTileArt(stack, { base: PACKS, readJson: fsJson, decode: async () => ({}), rasterise: rasteriseByKey() });
        expect(r.keyed).toEqual(Object.fromEntries(CARRIED.map((t) => [t, PACK_ID])));
    });

    it('its maze regions are plain mazes (no Seedling atlas), so play draws them through the seam', () => {
        const slot = Object.keys(META_TRIAL.procgen_metadata)[0];
        const mazes = Object.values(META_TRIAL.preset_sidecars[slot]).filter((s) => s.substrate === 'maze');
        expect(mazes.length).toBeGreaterThan(0);
        expect(META_TRIAL.region_atlas?.[slot]?.game ?? null).not.toBe('seedling');
    });
});
