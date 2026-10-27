/**
 * sfxLibrary — the table and the loader, over the COMMITTED seedling pack plus
 * in-memory packs a test writes: the override order, the refusals by name, and
 * a failed clip named and skipped (never a crash).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ContentPackError, loadPackStack } from '../contentPacks/contentPacks.js';
import { browserSfxDecoder, createSfxLibrary, loadSfxClips, parseSfxManifest } from './sfxLibrary.js';

const PACKS = join(dirname(fileURLToPath(import.meta.url)), '../../packs');
const BASE = pathToFileURL(`${PACKS}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));

/** An in-memory loaded pack (what `loadPackStack` returns). */
const loaded = (id, sfx) => ({ id, base: `http://packs/${id}/`, layers: sfx ? { sfx } : {} });
const RESOUND = {
    schema_version: 1,
    clips: { Clang: { file: 'clips/clang.ogg' } },
    sounds: { 'seedling:sfx/sword': { clips: ['Clang'] }, 'resound:sfx/extra': { clips: ['Clang', 'Clang'] } },
};

describe('the committed seedling sfx stack', () => {
    it('loads with only the sfx layer; 38 keys, the variants in Music.as order, each clip with its seconds', async () => {
        const lib = createSfxLibrary(await loadPackStack(['seedling'], { base: BASE, readJson: fsJson, only: ['sfx'] }));
        expect(lib.keys()).toHaveLength(38);
        expect(lib.has('seedling:sfx/sword')).toBe(true);
        expect(lib.variantCount('seedling:sfx/sword')).toBe(3);
        const sword = lib.clipsOf('seedling:sfx/sword');
        expect(sword.map((c) => c.clipRef)).toEqual(['seedling/Sword1', 'seedling/Sword2', 'seedling/Sword3']);
        expect(sword[0].url).toBe(`${BASE}seedling/sfx/clips/Sword1.mp3`);
        expect(lib.clipsOf('seedling:sfx/swim')[0].seconds).toBe(0.78367);
        // a clip at two indices is one decode
        expect(lib.variantCount('seedling:sfx/drill')).toBe(2);
        expect(lib.clipsInUse()).toHaveLength(68);
        expect(lib.clipsOf('seedling:sfx/nope')).toEqual([]);
    });
});

describe('THE OVERRIDE ORDER — a later pack wins per key', () => {
    it('a sound pack stacked last replaces only the keys it carries', async () => {
        const seedling = (await loadPackStack(['seedling'], { base: BASE, readJson: fsJson, only: ['sfx'] }))[0];
        const lib = createSfxLibrary([seedling, loaded('resound', RESOUND), loaded('artonly', null)]);
        expect(lib.packOf('seedling:sfx/sword')).toBe('resound');
        expect(lib.clipsOf('seedling:sfx/sword').map((c) => c.url)).toEqual(['http://packs/resound/sfx/clips/clang.ogg']);
        expect(lib.packOf('seedling:sfx/hurt')).toBe('seedling');
        expect(lib.has('resound:sfx/extra')).toBe(true);
        // stacked FIRST it is overridden instead
        expect(createSfxLibrary([loaded('resound', RESOUND), seedling]).packOf('seedling:sfx/sword')).toBe('seedling');
    });
});

describe('⛔ REFUSED BY NAME', () => {
    const refuse = (sfx, pattern) => {
        let err = null;
        try { createSfxLibrary([loaded('bad', sfx)]); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(ContentPackError);
        expect(err.message).toMatch(pattern);
    };
    it('a schema version it cannot read', () => refuse({ ...RESOUND, schema_version: 2 }, /pack "bad" sfx manifest: schema_version 2/));
    it('a sound naming an undeclared clip', () => refuse({ ...RESOUND, sounds: { 'bad:sfx/x': { clips: ['Ghost'] } } }, /sound "bad:sfx\/x" names clip "Ghost"/));
    it('a sound with no clips', () => refuse({ ...RESOUND, sounds: { 'bad:sfx/x': { clips: [] } } }, /sound "bad:sfx\/x" has no clips/));
    it('a clip path that leaves the pack', () => refuse({ ...RESOUND, clips: { Clang: { file: '../x.ogg' } } }, /clip "Clang" needs a relative file inside the pack/));
    it('an un-namespaced key', () => refuse({ ...RESOUND, sounds: { sword: { clips: ['Clang'] } } }, /key "sword" is not namespaced/));
    it('parseSfxManifest on nothing', () => expect(() => parseSfxManifest(null, 'p')).toThrow(/pack "p" sfx manifest/));
});

describe('the loader: a failed clip is NAMED and SKIPPED, never a crash', () => {
    it('every distinct clip decodes once; a failure leaves that variant silent (null), the rest play', async () => {
        const lib = createSfxLibrary([loaded('x', {
            schema_version: 1,
            clips: { A: { file: 'clips/a.mp3' }, B: { file: 'clips/b.mp3' } },
            sounds: { 'x:sfx/s': { clips: ['A', 'B', 'A'] } },
        })]);
        const asked = [];
        const r = await loadSfxClips(lib, async (url) => {
            asked.push(url);
            if (url.endsWith('b.mp3')) throw new Error('HTTP 404');
            return { decoded: url };
        });
        expect(asked).toHaveLength(2);
        expect(r.failed).toEqual(['x/B (http://packs/x/sfx/clips/b.mp3): HTTP 404']);
        expect(r.bufferFor('x:sfx/s', 0)).toEqual({ decoded: 'http://packs/x/sfx/clips/a.mp3' });
        expect(r.bufferFor('x:sfx/s', 1)).toBeNull();
        expect(r.bufferFor('x:sfx/s', 2)).toEqual({ decoded: 'http://packs/x/sfx/clips/a.mp3' });
        expect(r.bufferFor('x:sfx/s', 3)).toBeNull();
        expect(r.bufferFor('x:sfx/none', 0)).toBeNull();
    });

    it('the browser decoder fetches, then decodes through the output; an HTTP error is the failure\'s name', async () => {
        const out = { decode: async (ab) => ({ bytes: ab.byteLength }) };
        const win = { fetch: async (u) => (u.includes('ok') ? { ok: true, arrayBuffer: async () => new ArrayBuffer(4) } : { ok: false, status: 404 }) };
        const decode = browserSfxDecoder(out, win);
        expect(await decode('http://h/ok.mp3')).toEqual({ bytes: 4 });
        await expect(decode('http://h/missing.mp3')).rejects.toThrow('HTTP 404');
    });
});
