/**
 * extract-seedling-art-packs — the committed packs are what the PINNED submodule
 * extracts, and `--check` names every kind of drift: a changed byte, a missing
 * file, a stray file, a pack the registry does not list.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ART_TABLE, PACKS_DIR, buildPacks, packDrift, pngSize } from './extract-seedling-art-packs.mjs';
import { SEEDLING_SUBMODULE } from './seedlingSource.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUB = join(REPO, SEEDLING_SUBMODULE);
const INITIALISED = existsSync(join(SUB, '.git'));

describe.skipIf(!INITIALISED)('the art packs, extracted from vendor/seedling', () => {
    let built;
    let tmp;
    beforeAll(() => {
        built = buildPacks(SUB);
        tmp = mkdtempSync(join(tmpdir(), 'art-packs-'));
        cpSync(PACKS_DIR, tmp, { recursive: true });
    });
    afterAll(() => rmSync(tmp, { recursive: true, force: true }));

    it('the committed packs are byte-identical to a fresh extract (no drift, no stray file)', () => {
        expect(packDrift(built)).toEqual([]);
    });

    it('⛔ the ruling\'s exclusions are not in any pack: no font, promo, Newgrounds, tank, music or sound', () => {
        const files = Object.values(built).flatMap((m) => [...m.keys()]);
        for (const f of files) {
            expect(f).not.toMatch(/04B_03|promo|pixel_logo|newgrounds|tank|\.mp3$|\.wav$|\.ttf$/i);
        }
        expect(ART_TABLE.every((r) => r.file.endsWith('.png'))).toBe(true);
    });

    it('a sheet is the checkout\'s PNG byte for byte, and its manifest size is the PNG\'s', () => {
        const shore = built.seedling.get('art/sheets/Shore.png');
        expect(shore.equals(readFileSync(join(SUB, 'assets/graphics/Shore.png')))).toBe(true);
        expect(pngSize(shore, 'Shore.png')).toEqual({ w: 256, h: 16 });
        const manifest = JSON.parse(built.seedling.get('art/manifest.json'));
        expect(manifest.sheets.Shore).toEqual({ file: 'sheets/Shore.png', w: 256, h: 16 });
    });

    describe('--check names each kind of drift', () => {
        it('a changed byte in a sheet', () => {
            const p = join(tmp, 'seedling/art/sheets/Water.png');
            const keep = readFileSync(p);
            const bad = Buffer.from(keep);
            bad[bad.length - 20] ^= 0xff;
            writeFileSync(p, bad);
            try { expect(packDrift(built, tmp)).toEqual(['seedling/art/sheets/Water.png: DIFFERS from a fresh extract']); } finally { writeFileSync(p, keep); }
        });
        it('a missing file and a stray one', () => {
            const p = join(tmp, 'archipelago/art/sheets/ArchipelagoLogo.png');
            const keep = readFileSync(p);
            unlinkSync(p);
            writeFileSync(join(tmp, 'seedling/art/sheets/Extra.png'), 'x');
            try {
                expect(packDrift(built, tmp)).toEqual([
                    'seedling/art/sheets/Extra.png: STRAY (no table row makes it)',
                    'archipelago/art/sheets/ArchipelagoLogo.png: MISSING',
                ]);
            } finally { writeFileSync(p, keep); unlinkSync(join(tmp, 'seedling/art/sheets/Extra.png')); }
        });
        it('a hand-edited manifest', () => {
            const p = join(tmp, 'seedling/art/manifest.json');
            const keep = readFileSync(p, 'utf8');
            writeFileSync(p, keep.replace('"fw": 32', '"fw": 31'));
            try { expect(packDrift(built, tmp)).toEqual(['seedling/art/manifest.json: DIFFERS from a fresh extract']); } finally { writeFileSync(p, keep); }
        });
        it('a pack the registry does not list', () => {
            const p = join(tmp, 'packs.json');
            const keep = readFileSync(p, 'utf8');
            const reg = JSON.parse(keep);
            reg.packs = reg.packs.filter((x) => x.id !== 'archipelago');
            writeFileSync(p, JSON.stringify(reg));
            try { expect(packDrift(built, tmp)).toEqual(['frontend/packs/packs.json: does not list the pack "archipelago"']); } finally { writeFileSync(p, keep); }
        });
    });
});
