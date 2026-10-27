/**
 * contentPacks — the loader, the override order and the refusals, over the
 * COMMITTED packs (`frontend/packs/`) plus in-memory packs a test writes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    ContentPackError, KEY_PATTERN, KNOWN_LAYERS, RESERVED_LAYERS, loadPackStack, mergeKeyed, packsBaseUrl, parsePack,
    parseRegistry,
} from './contentPacks.js';

const PACKS = join(dirname(fileURLToPath(import.meta.url)), '../../packs');
const BASE = pathToFileURL(`${PACKS}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));

/** A readJson over committed files, with `extra` (url suffix → json) layered on top. */
const withExtra = (extra) => async (url) => {
    for (const [suffix, json] of Object.entries(extra)) if (url.endsWith(suffix)) return structuredClone(json);
    return fsJson(url);
};

const RESKIN = {
    'reskin/pack.json': { schema_version: 1, id: 'reskin', title: 'a test reskin', licence: 'CC0', layers: { art: 'art/manifest.json' } },
    'reskin/art/manifest.json': {
        schema_version: 1,
        sheets: { Grass: { file: 'sheets/Grass.png', w: 256, h: 16 } },
        sprites: { 'seedling:tile/ground': { sheet: 'Grass', fw: 16, fh: 16 }, 'reskin:extra/thing': { sheet: 'Grass', fw: 16, fh: 16 } },
    },
};

describe('the committed registry and packs', () => {
    it('packs.json parses; the `seedling` stack is [seedling, archipelago]', async () => {
        const reg = parseRegistry(await fsJson(new URL('packs.json', BASE).href));
        expect(reg.packs).toEqual(['seedling', 'archipelago']);
        expect(reg.stacks.seedling).toEqual(['seedling', 'archipelago']);
    });

    it('both packs load as one stack, each with its art layer', async () => {
        const stack = await loadPackStack(['seedling', 'archipelago'], { base: BASE, readJson: fsJson });
        expect(stack.map((p) => p.id)).toEqual(['seedling', 'archipelago']);
        expect(stack.every((p) => p.layers.art?.schema_version === 1)).toBe(true);
        expect(stack[1].pack.licence).toBe('MIT');
        expect(stack[0].base).toBe(`${BASE}seedling/`);
    });

    it('every key the committed packs carry is namespaced, and each pack keeps to its own namespace', async () => {
        const stack = await loadPackStack(['seedling', 'archipelago'], { base: BASE, readJson: fsJson });
        for (const p of stack) {
            for (const key of Object.keys(p.layers.art.sprites)) {
                expect(key).toMatch(KEY_PATTERN);
                expect(key.split(':')[0]).toBe(p.id);
            }
        }
    });
});

describe('THE OVERRIDE ORDER — a later pack wins per key', () => {
    it('a reskin stacked LAST replaces only the keys it carries', async () => {
        const stack = await loadPackStack(['seedling', 'archipelago', 'reskin'], { base: BASE, readJson: withExtra(RESKIN) });
        const merged = mergeKeyed(stack, (l) => l.layers.art.sprites);
        expect(merged.get('seedling:tile/ground').pack).toBe('reskin');
        expect(merged.get('seedling:tile/ground').value.sheet).toBe('Grass');
        expect(merged.get('seedling:tile/stone').pack).toBe('seedling');          // not carried → falls through
        expect(merged.get('archipelago:pickup/item').pack).toBe('archipelago');
        expect(merged.get('reskin:extra/thing').pack).toBe('reskin');
    });

    it('the same reskin stacked FIRST is overridden by the packs after it', async () => {
        const stack = await loadPackStack(['reskin', 'seedling'], { base: BASE, readJson: withExtra(RESKIN) });
        const merged = mergeKeyed(stack, (l) => l.layers.art.sprites);
        expect(merged.get('seedling:tile/ground').pack).toBe('seedling');
        expect(merged.get('reskin:extra/thing').pack).toBe('reskin');
    });
});

describe('⛔ A MALFORMED PACK IS REFUSED BY NAME (never half-loaded)', () => {
    const refuse = async (extra, ids, pattern) => {
        const err = await loadPackStack(ids, { base: BASE, readJson: withExtra(extra) }).catch((e) => e);
        expect(err).toBeInstanceOf(ContentPackError);
        expect(err.message).toMatch(pattern);
    };
    const pack = (over) => ({ 'bad/pack.json': { ...RESKIN['reskin/pack.json'], id: 'bad', ...over }, 'bad/art/manifest.json': RESKIN['reskin/art/manifest.json'] });

    it('an id that disagrees with its directory', () => refuse(pack({ id: 'other' }), ['seedling', 'bad'], /"bad".*id "other" does not match its directory "bad"/));
    it('a schema version this loader cannot read', () => refuse(pack({ schema_version: 2 }), ['bad'], /"bad".*schema_version 2/));
    it('a missing licence', () => refuse(pack({ licence: '' }), ['bad'], /"bad".*licence is missing/));
    it('a layer nobody reads yet', () => refuse(pack({ layers: { art: 'a.json', concepts: 'c.json' } }), ['bad'], /"bad".*layer "concepts" is not one this loader knows/));
    it('a layer path that leaves the pack', () => refuse(pack({ layers: { art: '../seedling/art/manifest.json' } }), ['bad'], /"bad".*must be a relative path inside the pack/));
    it('a pack that is not there', () => refuse({}, ['seedling', 'nosuchpack'], /"nosuchpack".*pack\.json could not be read/));
    it('a pack named twice in one stack', () => refuse({}, ['seedling', 'seedling'], /named twice/));
    it('an un-namespaced key', async () => {
        const stack = await loadPackStack(['reskin'], { base: BASE, readJson: withExtra(RESKIN) });
        const bad = [{ ...stack[0], layers: { art: { sprites: { ground: {} } } } }];
        expect(() => mergeKeyed(bad, (l) => l.layers.art.sprites)).toThrow(/"reskin".*key "ground" is not namespaced/);
    });
    it('a registry stack naming an unlisted pack', () => {
        expect(() => parseRegistry({ schema_version: 1, packs: [{ id: 'seedling' }], graphics: { x: ['seedling', 'ghost'] } }))
            .toThrow(/stack "x" names "ghost"/);
    });
    it('parsePack on a non-object', () => expect(() => parsePack(null, 'p')).toThrow(/"p": pack\.json is not an object/));
});

describe('packsBaseUrl', () => {
    it('unbundled: ../../packs/ from this module', () => {
        expect(packsBaseUrl('http://h/frontend/modules/contentPacks/contentPacks.js', 'http://h/frontend/index.html'))
            .toBe('http://h/frontend/packs/');
    });
    it('bundled (`/dist/`): the page\'s packs/', () => {
        expect(packsBaseUrl('http://h/site/dist/bundle.js', 'http://h/site/index.html?bundled=true')).toBe('http://h/site/packs/');
    });
});

// ⛓ SOUND EFFECTS (⚖ the user 2026-10-26): the `sfx` layer, the `sfx` stacks. ⛓ MUSIC (⚖ 2026-10-27): `music`
// was RESERVED (refused by name) until the music library landed; it is now known, and the reserved-name refusal
// is still pinned, on an injected name.
describe('the sfx and music layers', () => {
    const minimal = (layers) => ({ schema_version: 1, id: 'p', title: 't', licence: 'CC0', layers });

    it('KNOWN_LAYERS carries sfx and music; nothing is reserved today', () => {
        expect(KNOWN_LAYERS).toEqual(['art', 'sfx', 'music']);
        expect(RESERVED_LAYERS).toEqual([]);
        expect(parsePack(minimal({ sfx: 'sfx/manifest.json' }), 'p').layers.sfx).toBe('sfx/manifest.json');
    });

    it('⛓ MUSIC: a pack declaring `music` is ACCEPTED now (it was refused as reserved before the music library)', () => {
        expect(parsePack(minimal({ art: 'a.json', music: 'music/manifest.json' }), 'p').layers.music).toBe('music/manifest.json');
    });

    it('⛔ a RESERVED layer is still refused by name, saying it is reserved (not half-loaded)', () => {
        const opts = { known: ['art'], reserved: ['music'] };
        expect(() => parsePack(minimal({ art: 'a.json', music: 'm.json' }), 'p', opts))
            .toThrow(/content pack "p": layer "music" is reserved for a library that is not built yet/);
        expect(() => parsePack(minimal({ video: 'v.json' }), 'p'))
            .toThrow(/content pack "p": layer "video" is not one this loader knows/);
    });

    it('⛓ MUSIC: the registry\'s `music` stacks parse like `sfx`, and refuse an unlisted pack by name', async () => {
        const reg = parseRegistry(await fsJson(new URL('packs.json', BASE).href));
        expect(reg.musicStacks.seedling).toEqual(['seedling']);
        expect(() => parseRegistry({ schema_version: 1, packs: [{ id: 'seedling' }], music: { x: ['ghost'] } }))
            .toThrow(/music stack "x" names "ghost"/);
        expect(parseRegistry({ schema_version: 1, packs: [{ id: 'a' }] }).musicStacks).toEqual({});
    });

    it('the registry\'s `sfx` stacks parse like `graphics`, and refuse an unlisted pack by name', async () => {
        const reg = parseRegistry(await fsJson(new URL('packs.json', BASE).href));
        expect(reg.sfxStacks.seedling).toEqual(['seedling']);
        expect(() => parseRegistry({ schema_version: 1, packs: [{ id: 'seedling' }], sfx: { x: ['ghost'] } }))
            .toThrow(/sfx stack "x" names "ghost"/);
        expect(parseRegistry({ schema_version: 1, packs: [{ id: 'a' }] }).sfxStacks).toEqual({});
    });

    it('`only` reads just the named layers (a graphics stack never fetches the sound manifest)', async () => {
        const read = [];
        const stack = await loadPackStack(['seedling'], { base: BASE, readJson: async (u) => { read.push(u); return fsJson(u); }, only: ['art'] });
        expect(Object.keys(stack[0].layers)).toEqual(['art']);
        expect(read.some((u) => u.includes('/sfx/'))).toBe(false);
        const all = await loadPackStack(['seedling'], { base: BASE, readJson: fsJson });
        expect(Object.keys(all[0].layers)).toEqual(['art', 'sfx', 'music']);
    });
});
