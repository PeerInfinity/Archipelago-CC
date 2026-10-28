/**
 * mazeSeedlingSkin — S1 of the maze Seedling-art ladder (slice maze-seedling-art-1), in node over the COMMITTED
 * packs, map and presets (no pixels):
 *
 *   1. ⚖ RULING 1's derivation: on for a Seedling-atlas world, off for every other (by data, never by name).
 *   2. Every Seedling maze payload's grid IS its level (size checked against the patched map).
 *   3. GOLDEN static draw lists (`formatOp`) for L0, L4 and L12 — a CHANGE DETECTOR of the frame choice.
 *      Re-record after a deliberate change: `UPDATE_MAZE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   4. What the maze models is left to its markers: no object of the baked room sits on a modelled cell, and
 *      no placed pickup is drawn.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { formatOp } from '../seedlingDemo/seedlingSkinRenderer.js';
import { regionAtlasOf } from '../flashPanel/mapDocumentPath.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';
import { levelWorldFor, mazeModelledCells, seedlingSkinFor, staticOps } from './mazeSeedlingSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/seedling-skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const rulesOf = (preset) => JSON.parse(readFileSync(join(ROOT, `frontend/presets/${preset}/AP_1/AP_1_rules.json`), 'utf8'));
const PLAYTHROUGH = rulesOf('seedling_playthrough_maze');
/** Every playable payload of a preset's slot 1: `[regionId, payload]`. */
const payloadsOf = (rules) => Object.entries(rules.preset_sidecars?.['1'] ?? {})
    .filter(([, v]) => v.playable_payload).map(([k, v]) => [k, v.playable_payload]);
const worldOf = (payload) => deserializeMazeWorld(JSON.parse(JSON.stringify(payload)));

/** The golden rooms: the start, a small room with blocks and traps, and the biggest level (one sub-region). */
const GOLDEN_REGIONS = Object.freeze({ 0: 'level_0__r1c6', 4: 'level_4', 12: 'level_12__r0c19' });

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

describe('1. ⚖ ruling 1 — switched on by the DATA', () => {
    const atlas = regionAtlasOf(PLAYTHROUGH, '1');

    it('a Seedling-atlas world gets its level; the rules say game "seedling"', () => {
        expect(atlas.game).toBe('seedling');
        const [, payload] = payloadsOf(PLAYTHROUGH).find(([k]) => k === GOLDEN_REGIONS[12]);
        expect(seedlingSkinFor(worldOf(payload), atlas)).toEqual({ level: 12 });
    });

    it('off without the atlas game, without the world\'s level, or at another tile size / origin', () => {
        const [, payload] = payloadsOf(PLAYTHROUGH)[0];
        const world = worldOf(payload);
        expect(seedlingSkinFor(world, null)).toBe(null);
        expect(seedlingSkinFor(world, { ...atlas, game: 'tunic' })).toBe(null);
        const { level, tile_size: _t, origin: _o, ...rest } = payload;
        expect(seedlingSkinFor(worldOf(rest), atlas)).toBe(null);
        expect(seedlingSkinFor(worldOf({ ...payload, tile_size: 8 }), atlas)).toBe(null);
        expect(seedlingSkinFor(worldOf({ ...payload, origin: { x: 16, y: 0 } }), atlas)).toBe(null);
        expect(level).toBe(0);
    });

    it('a non-Seedling maze preset is off for every payload (it draws exactly as before)', () => {
        const rules = rulesOf('procgen_maze');
        const payloads = payloadsOf(rules);
        expect(payloads.length).toBeGreaterThan(0);
        for (const [k, p] of payloads) expect(seedlingSkinFor(worldOf(p), regionAtlasOf(rules, '1')), k).toBe(null);
    });

    it('open question E: the other Seedling maze preset (seedling_atlas_maze) is on too, by the same derivation', () => {
        const rules = rulesOf('seedling_atlas_maze');
        const on = payloadsOf(rules).filter(([, p]) => seedlingSkinFor(worldOf(p), regionAtlasOf(rules, '1')));
        expect(on.length).toBeGreaterThan(0);
    });
});

describe('2. every Seedling maze payload\'s grid IS its level', () => {
    for (const preset of ['seedling_playthrough_maze', 'seedling_atlas_maze']) {
        it(`${preset}: each world's size equals its patched level's`, () => {
            const rules = rulesOf(preset);
            const atlas = regionAtlasOf(rules, '1');
            let n = 0;
            for (const [k, p] of payloadsOf(rules)) {
                const world = worldOf(p);
                const skin = seedlingSkinFor(world, atlas);
                if (!skin) continue;
                expect(() => levelWorldFor(MAP, skin.level, world), k).not.toThrow();
                n += 1;
            }
            expect(n).toBeGreaterThan(0);
        });
    }

    it('a world whose size is not the level\'s is refused by name', () => {
        expect(() => levelWorldFor(MAP, 0, { width: 5, height: 5 })).toThrow(/is 20×20 tiles but the maze world is 5×5/);
        expect(() => levelWorldFor(MAP, 99999)).toThrow(/has no level 99999/);
    });

    it('one level world per (map, level) — the renderer\'s tile cache keys on the object', () => {
        expect(levelWorldFor(MAP, 0).world).toBe(levelWorldFor(MAP, 0).world);
    });
});

const opsOf = (level) => {
    const [, payload] = payloadsOf(PLAYTHROUGH).find(([k]) => k === GOLDEN_REGIONS[level]);
    const mazeWorld = worldOf(payload);
    const { record, world } = levelWorldFor(MAP, level, mazeWorld);
    return { mazeWorld, world, ops: staticOps(world, art, { level, record, mazeWorld }) };
};

describe('3. golden static draw lists (frame CHOICE at tick 0, not pixels)', () => {
    for (const level of Object.keys(GOLDEN_REGIONS).map(Number)) {
        it(`level ${level} (${GOLDEN_REGIONS[level]})`, () => {
            const lines = opsOf(level).ops.map(formatOp);
            const path = join(GOLDENS, `L${level}.txt`);
            if (process.env.UPDATE_MAZE_SKIN_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${lines.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} (record with UPDATE_MAZE_SKIN_GOLDENS=1)`).toBe(true);
            expect(lines).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n'));
            // the art is really used: most of the list is sprites, not stand-in rectangles
            expect(lines.filter((l) => l.startsWith('drawImage')).length).toBeGreaterThan(lines.length / 2);
        });
    }
});

describe('4. what the maze models is drawn by the maze, not baked into the room', () => {
    for (const level of Object.keys(GOLDEN_REGIONS).map(Number)) {
        it(`level ${level}: no baked object on a modelled cell; no placed pickup`, () => {
            const { mazeWorld, world, ops } = opsOf(level);
            const modelled = mazeModelledCells(mazeWorld);
            const objectRects = new Set([...world.objectSolids, ...world.pixelmasks].map((o) => o.rect));
            const pickupRects = new Set((world.pickups ?? []).map((p) => p.rect));
            for (const op of ops) {
                const r = op.rect ?? op.fallback?.rect;
                expect(pickupRects.has(r)).toBe(false);
                if (!objectRects.has(r)) continue;
                const cx = Math.floor((r.x + (r.right ?? r.x + r.w)) / 2 / 16);
                const cy = Math.floor((r.y + (r.bottom ?? r.y + r.h)) / 2 / 16);
                expect(modelled.has(`${cx},${cy}`), `${formatOp(op)} on a modelled cell`).toBe(false);
            }
        });
    }
});
