/**
 * seedlingDemo/seedlingLevelBake — the LEVEL-ONLY baker (region-map step 1, D1), pinned in node.
 *
 * 1. Golden whole-level draw lists for three vanilla levels (`fixtures/level-bake-goldens/`, the way
 *    `fixtures/skin-goldens/` pins `roomOps`): the frame CHOICE at tick 0, not pixels — pixels need a browser.
 *    Record with `UPDATE_LEVEL_BAKE_GOLDENS=1`.
 * 2. The maze wrapper IS this baker: `mazeSeedlingSkin.staticOps` equals `levelStaticOps` with the maze census
 *    excluded, and the two `levelWorldFor`s hand back the SAME world object (the renderer's tile cache keys on it).
 * 3. `bakeLevel` sizes its canvas from the RECORD (no maze world) and clears it to the page background first.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { formatOp } from './seedlingSkinRenderer.js';
import {
    SEEDLING_BACKGROUND, bakeLevel, levelRecordFor, levelStaticOps, levelWorldFor, recordWorldOf,
} from './seedlingLevelBake.js';
import * as mazeSkin from '../mazeRoom/mazeSeedlingSkin.js';
import { deserializeMazeWorld } from '../mazeRoom/mazeRoomEngine.js';
import { censusEntityIds, seedlingCensus } from '../mazeRoom/mazeSeedlingSprites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/level-bake-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));

/** The start (scenery, a house), a dungeon room (blocks, stairs) and a later overworld level. */
const GOLDEN_LEVELS = Object.freeze([0, 4, 36]);

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

describe('1. golden whole-level static draw lists (nothing excluded)', () => {
    for (const level of GOLDEN_LEVELS) {
        it(`level ${level}`, () => {
            const { record, world } = levelWorldFor(MAP, level);
            const lines = levelStaticOps(world, art, { level, record }).map(formatOp);
            const path = join(GOLDENS, `L${level}.txt`);
            if (process.env.UPDATE_LEVEL_BAKE_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${lines.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} (record with UPDATE_LEVEL_BAKE_GOLDENS=1)`).toBe(true);
            expect(lines).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n'));
            expect(lines.filter((l) => l.startsWith('drawImage')).length).toBeGreaterThan(lines.length / 2);
        });
    }

    it('a level the map lacks: levelRecordFor answers null with the map size; levelWorldFor throws by name', () => {
        expect(levelRecordFor(MAP, 9999).record).toBe(null);
        expect(levelRecordFor(MAP, 9999).size).toBeGreaterThan(100);
        expect(() => levelWorldFor(MAP, 9999)).toThrow(/seedlingLevelBake: the map has no level 9999/);
    });

    it('a free-standing record gets one built world per record object', () => {
        const { record } = levelRecordFor(MAP, 4);
        const copy = structuredClone(record);
        expect(recordWorldOf(copy)).toBe(recordWorldOf(copy));
        expect(recordWorldOf(copy).world.width).toBe(levelWorldFor(MAP, 4).world.world.width);
    });
});

describe('2. the maze skin is a thin wrapper over this baker', () => {
    const rules = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
    const payloadOf = (regionId) => rules.preset_sidecars['1'][regionId].playable_payload;

    it('the same world OBJECT through either levelWorldFor', () => {
        expect(mazeSkin.levelWorldFor(MAP, 4).world).toBe(levelWorldFor(MAP, 4).world);
    });

    it('staticOps(maze) === levelStaticOps(excluded = the maze census) — and the census removes something', () => {
        const mazeWorld = deserializeMazeWorld(structuredClone(payloadOf('level_4')));
        const { record, world } = levelWorldFor(MAP, 4);
        const census = seedlingCensus(mazeWorld, record);
        const viaMaze = mazeSkin.staticOps(world, art, { level: 4, record, mazeWorld }).map(formatOp);
        const direct = levelStaticOps(world, art, { level: 4, record, excluded: censusEntityIds(census) }).map(formatOp);
        expect(viaMaze).toEqual(direct);
        expect(levelStaticOps(world, art, { level: 4, record }).length).toBeGreaterThan(viaMaze.length);
    });

    it('loadSeedlingArt is ONE function, re-exported (one load per page for both readers)', async () => {
        const bake = await import('./seedlingLevelBake.js');
        expect(mazeSkin.loadSeedlingArt).toBe(bake.loadSeedlingArt);
        expect(mazeSkin.SEEDLING_BACKGROUND).toBe(bake.SEEDLING_BACKGROUND);
    });
});

describe('3. bakeLevel — the canvas comes from the RECORD and an injected newCanvas', () => {
    it('sizes by record × cellPx, clears to the background, then paints the ops', () => {
        const { record, world } = levelWorldFor(MAP, 4);
        const calls = [];
        const newCanvas = (w, h) => {
            const ctx = {
                fillStyle: null, imageSmoothingEnabled: true,
                fillRect: (...a) => calls.push(['fillRect', ctx.fillStyle, ...a]),
                drawImage: (...a) => calls.push(['drawImage', a.length]),
                save() {}, restore() {}, globalAlpha: 1,
            };
            return { width: w, height: h, getContext: () => ctx };
        };
        const out = bakeLevel({ newCanvas, record, world, level: 4, art, images: new Map(), cellPx: 3 });
        expect([out.canvas.width, out.canvas.height]).toEqual([record.width * 3, record.height * 3]);
        expect(calls[0]).toEqual(['fillRect', SEEDLING_BACKGROUND, 0, 0, record.width * 3, record.height * 3]);
        expect(out.ops).toBe(levelStaticOps(world, art, { level: 4, record }).length);
        expect(out.counts.sprites + out.counts.rects + out.counts.fallbacks).toBeGreaterThan(0);
    });
});
