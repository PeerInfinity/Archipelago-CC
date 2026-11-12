/**
 * artLibrary — key → sheet rect, animation frame at a GAME TICK, fallback;
 * over the committed packs' MANIFESTS only (no image is decoded in node).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import {
    FP_ELAPSED_PER_TICK, SHAPE_PRIMITIVES, createArtLibrary, loadSheetImages, paintShape, parseArtManifest, shapeSheetRef,
} from './artLibrary.js';
import { recordingContext } from '../mazeRoom/drawOpRecorder.js';

const BASE = pathToFileURL(`${join(dirname(fileURLToPath(import.meta.url)), '../../packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: BASE, readJson: fsJson }));
});

describe('resolve and frameRect', () => {
    it('an autotiled ground frame: Shore.png, frame 9 → (144, 0) — the investigation\'s worked example cell (0,0)', () => {
        expect(art.frameRect('seedling:tile/ground', 9)).toMatchObject({ sheetRef: 'seedling/Shore', sx: 144, sy: 0, sw: 16, sh: 16, ox: 0, oy: 0 });
    });

    it('a frame index WRAPS mod the frame count, as FlashPunk\'s `set frame` does', () => {
        expect(art.frameRect('seedling:tile/ground', 16).sx).toBe(0);
        expect(art.frameRect('seedling:scenery/treebare', 13).sx).toBe(0);  // one frame: every tree mask draws frame 0
    });

    it('a shared sheet\'s one-frame pick (Statues.png): statue2 is frame 1 → (48, 0)', () => {
        expect(art.frameRect('seedling:scenery/statue2', 0)).toMatchObject({ sheetRef: 'seedling/Statues', sx: 48, sw: 48, sh: 40, ox: 8, oy: 24 });
    });

    it('origins come from the pack (a building draws 8 px up; the AP logo is centred)', () => {
        expect(art.frameRect('seedling:scenery/building1', 0)).toMatchObject({ sw: 48, sh: 40, ox: 0, oy: 8 });
        expect(art.frameRect('archipelago:pickup/item', 0)).toMatchObject({ sheetRef: 'archipelago/ArchipelagoLogo', ox: 8, oy: 8 });
    });

    it('FALLBACK: a key no pack carries resolves to null (the caller draws its rectangle)', () => {
        // (G3 added `seedling:enemy/bob` and G3b `seedling:enemy/wallflyer`, this row's examples until then; a
        // SpinningAxe has no art yet.)
        expect(art.has('seedling:enemy/spinningaxe')).toBe(false);
        expect(art.frameRect('seedling:enemy/spinningaxe', 0)).toBeNull();
        expect(art.frameAt('seedling:enemy/spinningaxe', 'walk', 10)).toBeNull();
        expect(art.frameAt('seedling:tile/ground', 'noSuchAnim', 10)).toBeNull();
    });

    it('packOf names the winning pack', () => {
        expect(art.packOf('seedling:tile/water')).toBe('seedling');
        expect(art.packOf('archipelago:pickup/item')).toBe('archipelago');
    });
});

describe('⛔ ANIMATION RUNS ON THE GAME TICK (⚖ ruling 3)', () => {
    it('the world clock is Game.worldFrame: 45 ticks per frame, `loops` stretches the cycle', () => {
        // water: frames [0, 1], loops 1 → a 45-tick cycle split in two
        expect([0, 22, 23, 44, 45, 67, 68].map((t) => art.frameAt('seedling:tile/water', 'flow', t))).toEqual([0, 0, 1, 1, 0, 0, 1]);
        // bonetorch: [0,1,2,1] over 2 loops = 90 ticks, 22.5 each
        expect([0, 22, 23, 45, 67, 68, 90].map((t) => art.frameAt('seedling:scenery/bonetorch', 'burn', t))).toEqual([0, 0, 1, 2, 2, 1, 0]);
    });

    it('a phase shifts the index (the per-tile random phase), wrapping', () => {
        expect(art.frameAt('seedling:tile/water', 'flow', 0, 1)).toBe(1);
        expect(art.frameAt('seedling:tile/water', 'flow', 23, 1)).toBe(0);
    });

    it('the same tick always answers the same frame — no wall clock anywhere', () => {
        const a = art.frameAt('seedling:tile/lava', 'flow', 1234, 2);
        expect(art.frameAt('seedling:tile/lava', 'flow', 1234, 2)).toBe(a);
    });

    it('an `fps` clock advances fps × 0.0333 frames per tick; loop:false holds the last frame', () => {
        const lib = createArtLibrary([{ id: 't', base: BASE, layers: { art: {
            schema_version: 1, sheets: { S: { file: 's.png', w: 64, h: 16 } },
            sprites: { 't:fx/x': { sheet: 'S', fw: 16, fh: 16, anims: {
                loop: { clock: 'fps', fps: 10, frames: [0, 1, 2, 3] },
                once: { clock: 'fps', fps: 10, frames: [0, 1, 2, 3], loop: false },
            } } },
        } } }]);
        const at = (n, t) => lib.frameAt('t:fx/x', n, t);
        expect(FP_ELAPSED_PER_TICK).toBe(0.0333);
        expect([0, 3, 4, 6, 7].map((t) => at('loop', t))).toEqual([0, 0, 1, 1, 2]);  // 10 × 0.0333 = 0.333 frames/tick
        expect(at('loop', 13)).toBe(0);
        expect(at('once', 400)).toBe(3);
    });
});

describe('refusals and image loading', () => {
    it('a sprite naming an undeclared sheet is refused by name', () => {
        expect(() => parseArtManifest({ schema_version: 1, sheets: {}, sprites: { 'p:x/y': { sheet: 'Nope', fw: 16, fh: 16 } } }, 'p'))
            .toThrow(/pack "p" art manifest: sprite "p:x\/y" names sheet "Nope"/);
    });

    it('a frame bigger than its sheet is refused by name', () => {
        expect(() => parseArtManifest({ schema_version: 1, sheets: { S: { file: 's', w: 8, h: 8 } }, sprites: { 'p:x/y': { sheet: 'S', fw: 16, fh: 16 } } }, 'p'))
            .toThrow(/frame 16x16 does not fit sheet "S"/);
    });

    it('sheetsInUse lists the WINNING sprites\' sheets with their URLs; a failed decode is named, not thrown', async () => {
        const sheets = art.sheetsInUse();
        expect(sheets.find((s) => s.sheetRef === 'seedling/Shore').url).toBe(`${BASE}seedling/art/sheets/Shore.png`);
        expect(sheets.find((s) => s.sheetRef === 'archipelago/ArchipelagoLogo').url).toBe(`${BASE}archipelago/art/sheets/ArchipelagoLogo.png`);
        const { images, failed } = await loadSheetImages(art, async (url) => {
            if (url.endsWith('Water.png')) throw new Error('boom');
            return { url };
        });
        expect(images.size).toBe(sheets.length - 1);
        expect(failed).toEqual([`seedling/Water (${BASE}seedling/art/sheets/Water.png): boom`]);
    });
});

describe('⛓ SHAPES — an art entry drawn from basic shapes (content sets R2b)', () => {
    const SHAPE = Object.freeze({ w: 16, h: 16, draw: [
        { rect: [0, 0, 16, 16], fill: '#30343c' },
        { circle: [8, 8, 6], fill: '#4aa8ff', stroke: '#000000', width: 2 },
        { line: [0, 0, 16, 16], stroke: '#ffffff80' },
        { polygon: [[8, 1], [15, 15], [1, 15]], fill: '#e0c040' },
    ] });
    const manifest = (extra) => ({ schema_version: 1, ...extra });
    const sheetPack = (id, key) => ({ id, base: BASE, layers: { art: manifest({
        sheets: { S: { file: 's.png', w: 16, h: 16 } }, sprites: { [key]: { sheet: 'S', fw: 16, fh: 16 } } }) } });
    const shapePack = (id, key, shape = SHAPE) => ({ id, base: BASE, layers: { art: manifest({ shapes: { [key]: shape } }) } });
    const refused = (shape) => () => parseArtManifest(manifest({ shapes: { 'p:x/y': shape } }), 'p');
    const op = (o) => ({ w: 4, h: 4, draw: [o] });

    it('a manifest with every primitive parses', () => {
        expect(SHAPE.draw.map((o) => SHAPE_PRIMITIVES.find((p) => p in o))).toEqual([...SHAPE_PRIMITIVES]);
        expect(() => parseArtManifest(manifest({ shapes: { 'p:x/y': SHAPE } }), 'p')).not.toThrow();
    });

    it('refuses by name: an unknown primitive, two primitives, a bad colour, no paint, a filled line, a bare width', () => {
        expect(refused(op({ ellipse: [1, 1, 1, 1], fill: '#000000' }))).toThrow(/shape "p:x\/y" draw\[0\]: "ellipse" is not a shape primitive/);
        expect(refused(op({ rect: [0, 0, 1, 1], circle: [1, 1, 1], fill: '#000000' }))).toThrow(/exactly one primitive .* got rect \+ circle/);
        expect(refused(op({ rect: [0, 0, 1, 1], fill: 'red' }))).toThrow(/fill "red" is not #rrggbb or #rrggbbaa/);
        expect(refused(op({ rect: [0, 0, 1, 1], fill: '#12345' }))).toThrow(/is not #rrggbb/);
        expect(refused(op({ rect: [0, 0, 1, 1] }))).toThrow(/paints nothing/);
        expect(refused(op({ line: [0, 0, 1, 1], fill: '#000000' }))).toThrow(/a line has no inside to fill/);
        expect(refused(op({ rect: [0, 0, 1, 1], fill: '#000000', width: 2 }))).toThrow(/width without a stroke/);
        expect(refused(op({ rect: [0, 0, 0, 1], fill: '#000000' }))).toThrow(/rect is \[x, y, w, h\] with w, h > 0/);
        expect(refused(op({ polygon: [[0, 0], [1, 1]], fill: '#000000' }))).toThrow(/at least 3 points/);
        expect(refused({ w: 4, h: 4, draw: [] })).toThrow(/has no draw list/);
        expect(refused({ w: 4.5, h: 4, draw: [{ rect: [0, 0, 1, 1], fill: '#000000' }] })).toThrow(/integer w, h > 0/);
        expect(refused({ ...op({ rect: [0, 0, 1, 1], fill: '#000000' }), sheet: 'S' })).toThrow(/field "sheet" is not one a shape takes/);
    });

    it('one pack may not draw a key both ways', () => {
        expect(() => parseArtManifest(manifest({
            sheets: { S: { file: 's.png', w: 16, h: 16 } }, sprites: { 'p:x/y': { sheet: 'S', fw: 16, fh: 16 } }, shapes: { 'p:x/y': SHAPE },
        }), 'p')).toThrow(/"p:x\/y" is both a sprite and a shape/);
    });

    it('the later pack wins whichever kind it is: a shape over a sprite, and a sprite over a shape', () => {
        const K = 'p:tile/wall';
        const shapeWins = createArtLibrary([sheetPack('early', K), shapePack('late', K)]);
        expect([shapeWins.kindOf(K), shapeWins.packOf(K)]).toEqual(['shape', 'late']);
        expect(shapeWins.frameRect(K, 0)).toEqual({ sheetRef: shapeSheetRef('late', K), sx: 0, sy: 0, sw: 16, sh: 16, ox: 0, oy: 0, frame: 0 });
        expect(shapeWins.frameRect(K, 5).frame).toBe(0);  // one frame: every index draws it
        const spriteWins = createArtLibrary([shapePack('early', K), sheetPack('late', K)]);
        expect([spriteWins.kindOf(K), spriteWins.packOf(K)]).toEqual(['sprite', 'late']);
        expect(spriteWins.frameRect(K, 0).sheetRef).toBe('late/S');
    });

    it('rasterised ONCE at load: the rasteriser receives the recipe, the image sits under the shape\'s sheetRef', async () => {
        const K = 'p:tile/wall';
        const lib = createArtLibrary([sheetPack('early', 'p:tile/floor'), shapePack('late', K)]);
        const got = [];
        const { images, failed } = await loadSheetImages(lib, async (url) => ({ url }), async (shape) => { got.push(shape); return { shape: true }; });
        expect(got).toEqual([SHAPE]);
        expect(failed).toEqual([]);
        expect(images.get(lib.frameRect(K, 0).sheetRef)).toEqual({ shape: true });
        expect(images.get('early/S')).toEqual({ url: `${BASE}art/s.png` });
    });

    it('with no rasteriser a shape is a FAILED sheet, named — its key falls back, nothing throws', async () => {
        const lib = createArtLibrary([shapePack('late', 'p:tile/wall')]);
        const { images, failed } = await loadSheetImages(lib, async () => { throw new Error('no image here'); });
        expect(images.size).toBe(0);
        expect(failed).toEqual([`${shapeSheetRef('late', 'p:tile/wall')} (shape): no rasteriser was given for a shape entry`]);
    });

    it('paintShape draws the recipe in order, at its own pixels', () => {
        const ctx = recordingContext();
        paintShape(ctx, SHAPE);
        expect(ctx.__log).toEqual([
            'beginPath()', 'rect(0,0,16,16)', 'fillStyle="#30343c"', 'fill()',
            'beginPath()', `arc(8,8,6,0,${Math.PI * 2})`, 'fillStyle="#4aa8ff"', 'fill()', 'strokeStyle="#000000"', 'lineWidth=2', 'stroke()',
            'beginPath()', 'moveTo(0,0)', 'lineTo(16,16)', 'strokeStyle="#ffffff80"', 'lineWidth=1', 'stroke()',
            'beginPath()', 'moveTo(8,1)', 'lineTo(15,15)', 'lineTo(1,15)', 'closePath()', 'fillStyle="#e0c040"', 'fill()',
        ]);
    });
});

describe('⛓ a SPRITE-ONLY stack answers exactly as before shapes existed (content sets R2b; the Seedling JS runtime shares this)', () => {
    /**
     * The expectation is DERIVED FROM THE MANIFESTS here, independently of the library: walk the stack in order, a key
     * keeps the position of its FIRST appearance (a `Map.set` on an existing key) and the value of its LAST pack. That is
     * the pre-shapes `mergeKeyed(…, sprites)` order, so `sheetsInUse` lists each winning sheet once, in that key order,
     * as `{ sheetRef, url }` and nothing else.
     */
    const STACK = ['seedling', 'archipelago'];
    let loaded;
    let expected;
    beforeAll(async () => {
        loaded = await loadPackStack(STACK, { base: BASE, readJson: fsJson });
        const order = new Map();
        for (const l of loaded) {
            const m = l.layers.art;
            expect(m.shapes, `${l.id} carries no shapes (this row is about sprite-only stacks)`).toBeUndefined();
            for (const [key, sp] of Object.entries(m.sprites ?? {})) order.set(key, { pack: l.id, base: l.base, sp, manifest: m });
        }
        const resolveOf = (key, { pack, sp, manifest }) => {
            const sheet = manifest.sheets[sp.sheet];
            const cols = Math.floor(sheet.w / sp.fw);
            return { key, pack, sheetRef: `${pack}/${sp.sheet}`, sheet, sprite: sp, cols,
                frameCount: cols * Math.floor(sheet.h / sp.fh), clocks: manifest.clocks ?? {} };
        };
        const sheets = new Map();
        for (const [key, w] of order) {
            const r = resolveOf(key, w);
            if (!sheets.has(r.sheetRef)) sheets.set(r.sheetRef, new URL(r.sheet.file, new URL('art/', w.base)).href);
        }
        expected = {
            keys: [...order.keys()],
            resolve: Object.fromEntries([...order].map(([k, w]) => [k, resolveOf(k, w)])),
            sheetsInUse: [...sheets].map(([sheetRef, url]) => ({ sheetRef, url })),
        };
    });

    it('keys, packOf and kindOf: every key, in first-appearance order, from its last pack, a sprite', () => {
        const lib = createArtLibrary(loaded);
        expect(lib.keys()).toEqual(expected.keys);
        for (const key of expected.keys) {
            expect(lib.packOf(key), key).toBe(expected.resolve[key].pack);
            expect(lib.kindOf(key), key).toBe('sprite');
        }
    });

    it('resolve answers the same object, field for field and nothing more, for every key', () => {
        const lib = createArtLibrary(loaded);
        for (const key of expected.keys) {
            const r = lib.resolve(key);
            expect(Object.keys(r), key).toEqual(Object.keys(expected.resolve[key]));
            expect(JSON.stringify(r), key).toBe(JSON.stringify(expected.resolve[key]));
        }
    });

    it('frameRect over every key and every frame of its sheet is the Spritemap rectangle', () => {
        const lib = createArtLibrary(loaded);
        for (const key of expected.keys) {
            const { sprite: sp, cols, frameCount, sheetRef } = expected.resolve[key];
            const [ox, oy] = sp.origin ?? [0, 0];
            for (let frame = 0; frame < frameCount; frame++) {
                let f = sp.only ? sp.only[frame % sp.only.length] : frame;
                f = ((f % frameCount) + frameCount) % frameCount;
                expect(lib.frameRect(key, frame), `${key} #${frame}`).toEqual({
                    sheetRef, sx: (f % cols) * sp.fw, sy: Math.floor(f / cols) * sp.fh, sw: sp.fw, sh: sp.fh, ox, oy, frame: f,
                });
            }
        }
    });

    it('sheetsInUse is byte-identical: the same entries, in the same order, each exactly { sheetRef, url }', () => {
        const lib = createArtLibrary(loaded);
        expect(JSON.stringify(lib.sheetsInUse())).toBe(JSON.stringify(expected.sheetsInUse));
        for (const s of lib.sheetsInUse()) expect(Object.keys(s)).toEqual(['sheetRef', 'url']);
    });
});
