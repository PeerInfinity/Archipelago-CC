/**
 * ⛓ CONTENT SETS GEN-2 — **THE `furniture` PACK: THE FIRST COMMITTED "WHAT EXISTS" PACK WHOSE KINDS THE GENERATOR
 * PLACES** (`frontend/packs/furniture/`, ⚖ Robert 2026-11-22 Q2: "a new small pack that a demo world names under what
 * exists"). Every expectation is read off the pack on disk, never spelled twice:
 *
 *   1. The pack parses, is registered in `packs.json`, ships no image file, and is NO theme (no `content` stack names
 *      it: ⚖ Q4, kinds come only from "what exists").
 *   2. Its `structure` layer parses: each entry is a terrain whose pass is one the generator places (walkable,
 *      blocked) and which says `generate: true` (⚖ Q3).
 *   3. Its `concepts` layer: each terrain entry is presented by one concept that declares a maze `base` and names an
 *      `art` key this pack's art layer draws; every shape is named by a concept.
 *   4. Its `art` layer: shapes only, each inside the maze's 20×20 cell.
 *   5. THE GENERATOR: a world naming the pack under `exists` offers exactly its terrain entries to the "Randomly placed
 *      tiles" biome (`generatedTileKinds`), each with its declared pass; the same pack selected as a THEME
 *      (`content`) offers none.
 *   6. THE SEAM: the maze stack plus the pack (`loadMazeTileArt`, a stub rasteriser) resolves each kind's art key, and
 *      `drawMazeTile` draws it from the pack (`as: 'art'`), not the base or the placeholder.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseArtManifest, paintShape } from '../artLibrary/artLibrary.js';
import { loadPackStack, parsePack, parseRegistry } from '../contentPacks/contentPacks.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { PACK_TILE_BASES } from '../packConcepts/packConcepts.js';
import { createStructure, parseStructureManifest, terrainGenerates, terrainOf } from '../packStructure/packStructure.js';
import { effectiveContentStack, loadContentSet } from '../procgenPipeline/worldContent.js';
import { recordingContext } from './drawOpRecorder.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { TILE_PX } from './mazeRoomRender.js';
import { drawMazeTile, loadMazeTileArt, mazeTileKind } from './mazeTileArt.js';
import { GENERATED_TILE_KIND_PASSES, generatedTileKinds } from './mazeTileKindsGen.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACK_ID = 'furniture';
const PACK_DIR = join(ROOT, 'frontend/packs', PACK_ID);
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const readJson = (rel) => JSON.parse(readFileSync(join(PACK_DIR, rel), 'utf8'));
const PACK = readJson('pack.json');
const STRUCTURE = readJson(PACK.layers.structure);
const CONCEPTS = readJson(PACK.layers.concepts).concepts;
const SHAPES = readJson(PACK.layers.art).shapes;
const TERRAIN = Object.entries(STRUCTURE.entries).filter(([, e]) => e.kind === 'terrain');
const presenterOf = (id) => Object.entries(CONCEPTS).filter(([, c]) => c.presents === id);
const io = nodePackIo();

describe('GEN-2 — the furniture pack: registered, no image file, never a theme', () => {
    it('parses, and declares a structure, a concepts and an art layer', () => {
        expect(() => parsePack(PACK, PACK_ID)).not.toThrow();
        expect(Object.keys(PACK.layers).sort()).toEqual(['art', 'concepts', 'structure']);
    });

    it('packs.json lists it, and no content stack (theme) names it (⚖ Q4)', () => {
        const json = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/packs.json'), 'utf8'));
        const reg = parseRegistry(json);
        expect(reg.packs).toContain(PACK_ID);
        expect(Object.values(reg.contentStacks ?? {}).flat()).not.toContain(PACK_ID);
    });

    it('ships no image file', () => {
        const walk = (dir) => readdirSync(dir, { withFileTypes: true })
            .flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
        expect(walk(PACK_DIR).filter((f) => !f.endsWith('.json'))).toEqual([]);
    });
});

describe('GEN-2 — its structure layer: terrain the generator places', () => {
    it('parses; every entry is a terrain, walkable or blocked, with generate: true', () => {
        expect(() => parseStructureManifest(STRUCTURE, PACK_ID)).not.toThrow();
        expect(TERRAIN.length).toBe(Object.keys(STRUCTURE.entries).length);
        expect(TERRAIN.length).toBeGreaterThan(0);
        for (const [id, e] of TERRAIN) {
            expect(GENERATED_TILE_KIND_PASSES, id).toContain(e.pass);
            expect(e.generate, id).toBe(true);
        }
        // the demo shows both halves of the law: a kind that changes no tile, and one that walls its cell
        expect(new Set(TERRAIN.map(([, e]) => e.pass))).toEqual(new Set(GENERATED_TILE_KIND_PASSES));
    });
});

describe('GEN-2 — its concepts: one per terrain, with a base and an art key the pack draws', () => {
    it('each terrain entry has exactly one presenting concept, with a maze base and an art key in the art layer', () => {
        for (const [id] of TERRAIN) {
            const rows = presenterOf(id);
            expect(rows.map(([k]) => k), id).toHaveLength(1);
            const [, c] = rows[0];
            expect(c.kind, id).toBe('terrain');
            expect(PACK_TILE_BASES, id).toContain(c.base);
            expect(Object.keys(SHAPES), id).toContain(c.art);
        }
    });

    it('a blocked kind falls back to the wall base (an honest look), a walkable one never to a wall', () => {
        for (const [id, e] of TERRAIN) {
            const [[, c]] = presenterOf(id);
            if (e.pass === 'blocked') expect(c.base, id).toBe('wall');
            else expect(c.base, id).not.toBe('wall');
        }
    });

    it('every shape is named by a concept (no orphan art)', () => {
        const named = new Set(Object.values(CONCEPTS).map((c) => c.art));
        expect(Object.keys(SHAPES).filter((k) => !named.has(k))).toEqual([]);
    });
});

/** Every coordinate a recipe lays (from the recorded `paintShape` log), padded by half the stroke for an outline. */
function outsideBox(shape) {
    const ctx = recordingContext();
    paintShape(ctx, shape);
    const pts = [];
    let width = 1;
    let path = [];
    for (const line of ctx.__log) {
        const [, op, args] = line.match(/^(\w+)(?:\((.*)\))?(?:=(.*))?$/);
        const n = args ? JSON.parse(`[${args}]`) : [];
        if (line.startsWith('lineWidth=')) width = Number(line.slice('lineWidth='.length));
        else if (op === 'beginPath') path = [];
        else if (op === 'rect') path.push([n[0], n[1], n[0] + n[2], n[1] + n[3], true]);
        else if (op === 'arc') path.push([n[0] - n[2], n[1] - n[2], n[0] + n[2], n[1] + n[2], true]);
        else if (op === 'moveTo' || op === 'lineTo') path.push([n[0], n[1], n[0], n[1], false]);
        else if (op === 'stroke' || op === 'fill') {
            for (const [x0, y0, x1, y1, area] of path) pts.push({ x0, y0, x1, y1, pad: op === 'stroke' && area ? width / 2 : 0 });
        }
    }
    expect(pts.length, 'it lays some geometry').toBeGreaterThan(0);
    return pts.filter((p) => p.x0 - p.pad < 0 || p.y0 - p.pad < 0 || p.x1 + p.pad > shape.w || p.y1 + p.pad > shape.h);
}

describe('GEN-2 — its art layer: shapes only, inside the maze cell', () => {
    it('parses as an art manifest of shapes only', () => {
        const manifest = readJson(PACK.layers.art);
        expect(() => parseArtManifest(manifest, PACK_ID)).not.toThrow();
        expect(manifest.sheets ?? {}).toEqual({});
        expect(manifest.sprites ?? {}).toEqual({});
    });

    it.each(Object.keys(SHAPES))('%s paints inside its box, the maze\'s own cell', (key) => {
        expect([SHAPES[key].w, SHAPES[key].h]).toEqual([TILE_PX, TILE_PX]);
        expect(outsideBox(SHAPES[key])).toEqual([]);
    });
});

describe('GEN-2 — the generator: named under exists, the pack offers its kinds; as a theme, none', () => {
    const setOf = async ({ exists = [], content = [] }) => loadContentSet(
        effectiveContentStack({ substrateIds: [substrateRegistryEntry.id], exists, content }), { ...io, exists });

    it('exists: [furniture] → exactly its terrain entries, each with its declared pass', async () => {
        const set = await setOf({ exists: [PACK_ID] });
        const expected = TERRAIN.map(([id, e]) => ({ kind: presenterOf(id)[0][0], pass: e.pass }));
        expect(generatedTileKinds(set)).toEqual(expected);
        const structure = createStructure(await loadPackStack([PACK_ID], { ...io, only: ['structure'] }));
        for (const { kind } of expected) {
            const c = { ...CONCEPTS[kind], key: kind, pack: PACK_ID };
            expect(terrainGenerates(c, structure), kind).toBe(true);
            expect(terrainOf(c, structure).pass, kind).toBe(STRUCTURE.entries[c.presents].pass);
        }
    });

    it('⛔ content: [furniture] (the pack picked as a theme) → none (⚖ Q4)', async () => {
        expect(generatedTileKinds(await setOf({ content: [PACK_ID] }))).toEqual([]);
    });
});

describe('GEN-2 — the seam: both views draw each kind from the pack', () => {
    const rasteriseByKey = () => {
        const byContent = new Map(Object.entries(SHAPES).map(([k, s]) => [JSON.stringify(s), k]));
        return async (shape) => ({ key: byContent.get(JSON.stringify(shape)) ?? 'other' });
    };

    it('the maze stack plus the pack resolves each kind\'s art key, and drawMazeTile draws it as art', async () => {
        const { tileArt, tileKinds } = await loadMazeTileArt([substrateRegistryEntry.defaultContentPack, PACK_ID], {
            base: PACKS, readJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
            decode: async () => { throw new Error('no sheet'); }, rasterise: rasteriseByKey(),
            contentRoles: substrateRegistryEntry.contentRoles,
        });
        expect(tileArt).not.toBeNull();
        for (const [id] of TERRAIN) {
            const [[kind, c]] = presenterOf(id);
            expect(tileKinds[kind], kind).toMatchObject({ artKey: c.art, base: c.base });
            const ctx = recordingContext();
            expect(drawMazeTile(ctx, tileArt, kind, 0, 0, TILE_PX, mazeTileKind(kind, { tileKinds })), kind).toBe('art');
            expect(ctx.__log.some((l) => l.startsWith(`drawImage({"key":"${c.art}"}`)), kind).toBe(true);
        }
    });
});
