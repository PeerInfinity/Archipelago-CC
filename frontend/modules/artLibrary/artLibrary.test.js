/**
 * artLibrary — key → sheet rect, animation frame at a GAME TICK, fallback;
 * over the committed packs' MANIFESTS only (no image is decoded in node).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { FP_ELAPSED_PER_TICK, createArtLibrary, loadSheetImages, parseArtManifest } from './artLibrary.js';

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
