/**
 * textLibrary — the `text` layer: strings and lists by key, the override order, `fill`, and every refusal; over
 * in-memory packs read through `loadPackStack` with an in-memory `readJson`, plus the committed packs.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ContentPackError, loadPackStack, parseRegistry } from '../contentPacks/contentPacks.js';
import { processMessageTemplate } from '../textAdventureSubstrateWrapper/templating.js';
import { createTextLibrary, parseTextManifest } from './textLibrary.js';

const PACKS_BASE = pathToFileURL(`${join(dirname(fileURLToPath(import.meta.url)), '../../packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));

/** The brief's manifest, verbatim. */
const META = {
    schema_version: 1,
    strings: { 'meta:narrator/greeting': 'You again. {item} is where it always is.' },
    lists: { 'meta:names/room-adjective': ['Unfinished', 'Placeholder'] },
};
const OVER = {
    schema_version: 1,
    strings: { 'meta:narrator/greeting': 'Oh. It is you, {player}.', 'over:narrator/farewell': 'Save often.' },
};

const memReader = (files) => async (url) => {
    const hit = Object.keys(files).find((suffix) => url.endsWith(suffix));
    if (!hit) throw new Error(`no file ${url}`);
    return structuredClone(files[hit]);
};
const stackOf = (manifests) => loadPackStack(Object.keys(manifests), {
    base: 'mem:/packs/',
    readJson: memReader(Object.fromEntries(Object.entries(manifests).flatMap(([id, m]) => [
        [`/${id}/pack.json`, { schema_version: 1, id, title: id, licence: 'CC0', layers: { text: 'text/manifest.json' } }],
        [`/${id}/text/manifest.json`, m],
    ]))),
});

describe('the manifest, read through loadPackStack', () => {
    it('strings and lists are answered by key; a key answers only its own shape', async () => {
        const t = createTextLibrary(await stackOf({ meta: META }));
        for (const [key, s] of Object.entries(META.strings)) {
            expect(t.has(key)).toBe(true);
            expect(t.string(key)).toBe(s);
            expect(t.list(key)).toBeNull();
        }
        for (const [key, l] of Object.entries(META.lists)) {
            expect(t.has(key)).toBe(true);
            expect(t.list(key)).toEqual(l);
            expect(Object.isFrozen(t.list(key))).toBe(true);
            expect(t.string(key)).toBeNull();
        }
        expect(t.keys()).toEqual([...Object.keys(META.strings), ...Object.keys(META.lists)]);
        expect(t.has('meta:nothing/here')).toBe(false);
        expect(t.string('meta:nothing/here')).toBeNull();
        expect(t.list('meta:nothing/here')).toBeNull();
    });

    it('a returned list is a copy: freezing it does not freeze the pack\'s manifest', async () => {
        const stack = await stackOf({ meta: META });
        const t = createTextLibrary(stack);
        const key = Object.keys(META.lists)[0];
        expect(t.list(key)).not.toBe(stack[0].layers.text.lists[key]);
    });

    it('a manifest may carry only strings, only lists, or neither', () => {
        for (const m of [{ schema_version: 1 }, { schema_version: 1, strings: {} }, { schema_version: 1, lists: {} }]) {
            expect(createTextLibrary([{ id: 'p', layers: { text: m } }]).keys()).toEqual([]);
        }
    });
});

describe('a two-pack stack: a later pack wins per key', () => {
    it('the later pack overrides one string; the others fall through', async () => {
        const t = createTextLibrary(await stackOf({ meta: META, over: OVER }));
        expect(t.string('meta:narrator/greeting')).toBe(OVER.strings['meta:narrator/greeting']);
        expect(t.packOf('meta:narrator/greeting')).toBe('over');
        expect(t.string('over:narrator/farewell')).toBe(OVER.strings['over:narrator/farewell']);
        expect(t.list('meta:names/room-adjective')).toEqual(META.lists['meta:names/room-adjective']);
        expect(t.packOf('meta:names/room-adjective')).toBe('meta');
    });

    it('a pack with no text layer is skipped', () => {
        const t = createTextLibrary([{ id: 'art-only', layers: { art: {} } }, { id: 'meta', layers: { text: META } }]);
        expect(t.keys()).toEqual([...Object.keys(META.strings), ...Object.keys(META.lists)]);
    });
});

describe('fill — `{name}` placeholders', () => {
    const t = createTextLibrary([]);

    it('fills a placeholder from vars; a missing value is LEFT AS WRITTEN', () => {
        expect(t.fill(META.strings['meta:narrator/greeting'], { item: 'The Sword' })).toBe('You again. The Sword is where it always is.');
        expect(t.fill('{a} and {b}', { a: 'x' })).toBe('x and {b}');
        expect(t.fill('{a} and {b}', { a: 'x', b: null })).toBe('x and {b}');
        expect(t.fill('{a}{a}', { a: 1 })).toBe('11');
        expect(t.fill('{a}', {})).toBe('{a}');
        expect(t.fill('{toString}', {})).toBe('{toString}');   // own properties only
    });

    it('agrees with the text adventure\'s processMessageTemplate on the plain cases (no HTML, no wasUnchecked)', () => {
        const cases = [
            [META.strings['meta:narrator/greeting'], { item: 'The Sword' }],
            ['{a} and {b}', { a: 'x' }],
            ['{a} and {b}', { a: 'x', b: null }],
            ['{a}{a} {c}', { a: 1, c: 0 }],
            ['no placeholders', { a: 1 }],
        ];
        for (const [template, vars] of cases) expect(t.fill(template, vars)).toBe(processMessageTemplate(template, vars));
    });

    it('the documented differences: no HTML escape, one pass', () => {
        expect(t.fill('{a}', { a: '<b>' })).toBe('<b>');
        expect(processMessageTemplate('{a}', { a: '<b>' })).toBe('&lt;b&gt;');
        expect(t.fill('{a} {b}', { a: '{b}', b: 'B' })).toBe('{b} B');
    });

    it('a template that is not a string fills to the empty string (as processMessageTemplate)', () => {
        expect(t.fill(null, {})).toBe('');
        expect(t.fill(null, {})).toBe(processMessageTemplate(null, {}));
    });
});

describe('⛔ REFUSAL BY NAME', () => {
    const refuse = (build, pattern) => {
        let err;
        try { build(); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(ContentPackError);
        expect(err.message).toMatch(pattern);
    };
    const one = (m) => () => createTextLibrary([{ id: 'bad', layers: { text: { schema_version: 1, ...m } } }]);

    it('an unknown schema version', () => refuse(() => parseTextManifest({ schema_version: 2 }, 'bad'), /pack "bad" text manifest: schema_version 2/));
    it('an unknown field', () => refuse(one({ words: {} }), /pack "bad" text manifest: unknown field "words"/));
    it('a non-string string', () => refuse(one({ strings: { 'bad:x/y': 3 } }), /pack "bad" text manifest: strings "bad:x\/y" is not a string/));
    it('a list that is not an array', () => refuse(one({ lists: { 'bad:x/y': 'a' } }), /lists "bad:x\/y" is not a non-empty list of strings/));
    it('an empty list', () => refuse(one({ lists: { 'bad:x/y': [] } }), /lists "bad:x\/y" is not a non-empty list of strings/));
    it('a list with a non-string member', () => refuse(one({ lists: { 'bad:x/y': ['a', 2] } }), /lists "bad:x\/y" is not a non-empty list of strings/));
    it('an un-namespaced string key', () => refuse(one({ strings: { greeting: 'hi' } }), /pack "bad" text manifest: strings key "greeting" is not namespaced/));
    it('an un-namespaced list key', () => refuse(one({ lists: { names: ['a'] } }), /pack "bad" text manifest: lists key "names" is not namespaced/));
    it('a table that is not an object', () => refuse(one({ strings: ['a'] }), /pack "bad" text manifest: strings is not an object/));
    it('one key in both tables of one pack', () => refuse(
        one({ strings: { 'bad:x/y': 'a' }, lists: { 'bad:x/y': ['a'] } }),
        /key "bad:x\/y" is in strings of pack "bad" and in lists of pack "bad"/,
    ));
    it('one key a string in one pack and a list in a later one', async () => {
        const stack = await stackOf({ meta: META, flip: { schema_version: 1, lists: { 'meta:narrator/greeting': ['a'] } } });
        refuse(() => createTextLibrary(stack), /key "meta:narrator\/greeting" is in strings of pack "meta" and in lists of pack "flip"/);
    });
});

describe('the committed packs', () => {
    it('every committed pack still loads whole, and the library accepts the stack', async () => {
        const reg = parseRegistry(await fsJson(new URL('packs.json', PACKS_BASE).href));
        const stack = await loadPackStack([...reg.packs], { base: PACKS_BASE, readJson: fsJson });
        expect(stack.map((l) => l.id)).toEqual([...reg.packs]);
        const t = createTextLibrary(stack);
        const declared = stack.flatMap((l) => [...Object.keys(l.layers.text?.strings ?? {}), ...Object.keys(l.layers.text?.lists ?? {})]);
        expect(t.keys().sort()).toEqual([...new Set(declared)].sort());
    });
});
