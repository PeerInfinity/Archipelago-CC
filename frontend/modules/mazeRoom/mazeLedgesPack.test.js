/**
 * ⛓ CONTENT SETS GEN-5 — **THE `ledges` PACK: THE FIRST COMMITTED "WHAT EXISTS" PACK WITH A ONE-WAY KIND THE
 * GENERATOR PLACES** (`frontend/packs/ledges/`; GEN-4 taught the generator the `one-way` pass, and only the test
 * fixture `slope` declared one). A new pack, not a ledge added to `furniture`, so furniture's pins and identity do not
 * move (⚖ planner, GEN-5 brief). Every expectation is read off the pack on disk, never spelled twice:
 *
 *   1. The pack parses, is registered in `packs.json`, ships no image file, and is NO theme (⚖ Q4).
 *   2. Its `structure` layer: each entry is a `one-way` terrain with fixed `dirs` and `generate: true` (⚖ Q3).
 *   3. Its `concepts` layer: each terrain entry is presented by one concept with a maze `base` that is not a wall (the
 *      cell stays floor: the look must not lie) and an `art` key this pack's art layer draws; no orphan shape.
 *   4. Its `art` layer: shapes only, inside the maze's 20×20 cell, and it SHOWS THE DIRECTION: the recipe's one
 *      polygon (the chevron) has a single vertex furthest along the kind's way in, on the cell's centre line.
 *   5. THE GENERATOR: `exists: [ledges]` offers exactly its kinds, carrying their `dirs`; as a theme, none.
 *   6. THE SEAM: the maze stack plus the pack resolves each kind's art key, and `drawMazeTile` draws it `as: 'art'`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseArtManifest } from '../artLibrary/artLibrary.js';
import { parsePack, parseRegistry } from '../contentPacks/contentPacks.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { PACK_TILE_BASES } from '../packConcepts/packConcepts.js';
import { parseStructureManifest } from '../packStructure/packStructure.js';
import { effectiveContentStack, loadContentSet } from '../procgenPipeline/worldContent.js';
import { recordingContext } from './drawOpRecorder.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { TILE_PX } from './mazeRoomRender.js';
import { drawMazeTile, loadMazeTileArt, mazeTileKind } from './mazeTileArt.js';
import { generatedTileKinds } from './mazeTileKindsGen.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACK_ID = 'ledges';
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
/** A move's direction as a unit vector in the cell's frame (y grows down, as on the canvas). */
const DIR_VECTOR = Object.freeze({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] });

describe('GEN-5 — the ledges pack: registered, no image file, never a theme', () => {
    it('parses, and declares a structure, a concepts and an art layer', () => {
        expect(() => parsePack(PACK, PACK_ID)).not.toThrow();
        expect(Object.keys(PACK.layers).sort()).toEqual(['art', 'concepts', 'structure']);
    });

    it('packs.json lists it, and no content stack (theme) names it (⚖ Q4)', () => {
        const reg = parseRegistry(JSON.parse(readFileSync(join(ROOT, 'frontend/packs/packs.json'), 'utf8')));
        expect(reg.packs).toContain(PACK_ID);
        expect(Object.values(reg.contentStacks ?? {}).flat()).not.toContain(PACK_ID);
    });

    it('ships no image file', () => {
        const walk = (dir) => readdirSync(dir, { withFileTypes: true })
            .flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
        expect(walk(PACK_DIR).filter((f) => !f.endsWith('.json'))).toEqual([]);
    });
});

describe('GEN-5 — its structure layer: one-way terrain the generator places', () => {
    it('parses; every entry is a one-way terrain with fixed dirs and generate: true', () => {
        expect(() => parseStructureManifest(STRUCTURE, PACK_ID)).not.toThrow();
        expect(TERRAIN.length).toBe(Object.keys(STRUCTURE.entries).length);
        expect(TERRAIN.length).toBeGreaterThan(0);
        for (const [id, e] of TERRAIN) {
            expect(e.pass, id).toBe('one-way');
            expect(e.generate, id).toBe(true);
            expect(e.dirs.length, id).toBeGreaterThan(0);
            expect(e.dirs.length, `${id}: a kind open every way is not one-way`).toBeLessThan(4);
            for (const d of e.dirs) expect(Object.keys(DIR_VECTOR), id).toContain(d);
        }
    });
});

describe('GEN-5 — its concepts: one per terrain, a floor-side base, an art key the pack draws', () => {
    it('each terrain entry has exactly one presenting concept, with a non-wall maze base and an art key in the art layer', () => {
        for (const [id] of TERRAIN) {
            const rows = presenterOf(id);
            expect(rows.map(([k]) => k), id).toHaveLength(1);
            const [, c] = rows[0];
            expect(c.kind, id).toBe('terrain');
            expect(PACK_TILE_BASES, id).toContain(c.base);
            // a ledge's cell stays floor: a wall or plain-floor base would lie about it (`tileKindRefusal`)
            expect(['wall', 'floor'], id).not.toContain(c.base);
            expect(Object.keys(SHAPES), id).toContain(c.art);
        }
    });

    it('every shape is named by a concept (no orphan art)', () => {
        const named = new Set(Object.values(CONCEPTS).map((c) => c.art));
        expect(Object.keys(SHAPES).filter((k) => !named.has(k))).toEqual([]);
    });
});

describe('GEN-5 — its art layer: shapes only, inside the cell, pointing the way in', () => {
    it('parses as an art manifest of shapes only', () => {
        const manifest = readJson(PACK.layers.art);
        expect(() => parseArtManifest(manifest, PACK_ID)).not.toThrow();
        expect(manifest.sheets ?? {}).toEqual({});
        expect(manifest.sprites ?? {}).toEqual({});
    });

    it.each(Object.keys(SHAPES))('%s lays every point inside its box, the maze\'s own cell', (key) => {
        const s = SHAPES[key];
        expect([s.w, s.h]).toEqual([TILE_PX, TILE_PX]);
        for (const op of s.draw) {
            const pad = op.stroke ? (op.width ?? 1) / 2 : 0;
            const pts = op.polygon ?? (op.rect ? [[op.rect[0], op.rect[1]], [op.rect[0] + op.rect[2], op.rect[1] + op.rect[3]]]
                : op.line ? [[op.line[0], op.line[1]], [op.line[2], op.line[3]]]
                    : [[op.circle[0] - op.circle[2], op.circle[1] - op.circle[2]], [op.circle[0] + op.circle[2], op.circle[1] + op.circle[2]]]);
            for (const [x, y] of pts) {
                expect(x - pad, `${key} ${JSON.stringify(op)}`).toBeGreaterThanOrEqual(0);
                expect(y - pad, `${key} ${JSON.stringify(op)}`).toBeGreaterThanOrEqual(0);
                expect(x + pad, `${key} ${JSON.stringify(op)}`).toBeLessThanOrEqual(s.w);
                expect(y + pad, `${key} ${JSON.stringify(op)}`).toBeLessThanOrEqual(s.h);
            }
        }
    });

    it('the art shows the direction: the chevron\'s tip is the one point furthest along the way in, on the centre line', () => {
        for (const [id, e] of TERRAIN) {
            const [[, c]] = presenterOf(id);
            const shape = SHAPES[c.art];
            const polys = shape.draw.filter((op) => op.polygon);
            expect(polys, `${id}: one chevron`).toHaveLength(1);
            const [vx, vy] = e.dirs.map((d) => DIR_VECTOR[d]).reduce(([ax, ay], [bx, by]) => [ax + bx, ay + by], [0, 0]);
            const along = polys[0].polygon.map(([x, y]) => x * vx + y * vy);
            const top = Math.max(...along);
            const tips = polys[0].polygon.filter((_, i) => along[i] === top);
            expect(tips, `${id}: a single tip`).toHaveLength(1);
            // the tip sits on the centre line across the way in (x = w/2 for N/S, y = h/2 for E/W)
            const [[tx, ty]] = tips;
            if (vx === 0) expect(tx, id).toBe(shape.w / 2);
            if (vy === 0) expect(ty, id).toBe(shape.h / 2);
            // and past the cell's middle, on the side the move lands
            expect(tx * vx + ty * vy, id).toBeGreaterThan((shape.w / 2) * vx + (shape.h / 2) * vy);
        }
    });
});

describe('GEN-5 — the generator: named under exists, the pack offers its kinds with their dirs; as a theme, none', () => {
    const setOf = async ({ exists = [], content = [] }) => loadContentSet(
        effectiveContentStack({ substrateIds: [substrateRegistryEntry.id], exists, content }), { ...io, exists });

    it('exists: [ledges] → exactly its terrain entries, each one-way with its dirs', async () => {
        const set = await setOf({ exists: [PACK_ID] });
        const expected = TERRAIN.map(([id, e]) => ({ kind: presenterOf(id)[0][0], pass: e.pass, dirs: e.dirs }));
        expect(generatedTileKinds(set)).toEqual(expected);
    });

    it('exists: [furniture, ledges] → furniture\'s kinds, then the ledge (the plan\'s order)', async () => {
        const kinds = generatedTileKinds(await setOf({ exists: ['furniture', PACK_ID] })).map((d) => d.kind);
        const ledges = TERRAIN.map(([id]) => presenterOf(id)[0][0]);
        expect(kinds.slice(-ledges.length)).toEqual(ledges);
        expect(kinds.length).toBeGreaterThan(ledges.length);
    });

    it('⛔ content: [ledges] (the pack picked as a theme) → none (⚖ Q4)', async () => {
        expect(generatedTileKinds(await setOf({ content: [PACK_ID] }))).toEqual([]);
    });
});

describe('GEN-5 — the seam: both views draw each kind from the pack', () => {
    it('the maze stack plus the pack resolves each kind\'s art key, and drawMazeTile draws it as art', async () => {
        const byContent = new Map(Object.entries(SHAPES).map(([k, s]) => [JSON.stringify(s), k]));
        const { tileArt, tileKinds } = await loadMazeTileArt([substrateRegistryEntry.defaultContentPack, PACK_ID], {
            base: PACKS, readJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
            decode: async () => { throw new Error('no sheet'); },
            rasterise: async (shape) => ({ key: byContent.get(JSON.stringify(shape)) ?? 'other' }),
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
