/**
 * packConcepts — the `concepts` layer: the manifest, the override order, `presenting`, and every refusal; over
 * in-memory packs read through `loadPackStack` with an in-memory `readJson`, plus the committed packs.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ContentPackError, loadPackStack, parseRegistry } from '../contentPacks/contentPacks.js';
import { PACK_CONCEPT_FIELDS, PACK_CONCEPT_KINDS, PACK_TILE_BASES, createPackConcepts, parseConceptsManifest } from './packConcepts.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';

const PACKS_BASE = pathToFileURL(`${join(dirname(fileURLToPath(import.meta.url)), '../../packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));

const MEM = 'mem:/packs/';
const packJson = (id) => ({ schema_version: 1, id, title: id, licence: 'CC0', layers: { concepts: 'concepts/manifest.json' } });

/** The brief's manifest, verbatim, plus TILE-2's `base` on the narrator (so every accepted field is exercised). */
const META = {
    schema_version: 1,
    concepts: {
        'meta:character/narrator': {
            kind: 'character',
            name: 'The Narrator',
            description: 'Knows this is a game.',
            look: { color: '#c0a040', symbol: 'N' },
            art: 'meta:character/narrator',
            // ⛓ TILE-2 — what the tile kind IS when nothing draws it as itself (`PACK_TILE_BASES`).
            base: 'character',
            text: { greeting: 'meta:narrator/greeting' },
            presents: 'guardian',
            // ⛓ PL-1 — the entry's provenance source (`withFixtureProvenance` lists `fixture`).
            src: 'fixture',
        },
        'meta:place/lobby': { kind: 'place', name: 'The Lobby' },
        'meta:object/save-crystal': { kind: 'object', name: 'A Save Crystal', look: { color: '#40a0c0', symbol: '*' } },
        'meta:info/respawn': { kind: 'info', name: 'Respawning is free', text: { body: 'meta:info/respawn' } },
    },
};

/** A later pack: overrides the narrator, and presents the same mechanic id from a new key. */
const OVER = {
    schema_version: 1,
    concepts: {
        'meta:character/narrator': { kind: 'character', name: 'The Tired Narrator' },
        'over:character/understudy': { kind: 'character', name: 'The Understudy', presents: 'guardian' },
    },
};

const memReader = (files) => async (url) => {
    const hit = Object.keys(files).find((suffix) => url.endsWith(suffix));
    if (!hit) throw new Error(`no file ${url}`);
    return structuredClone(files[hit]);
};

const stackOf = (manifests) => loadPackStack(Object.keys(manifests), {
    base: MEM,
    readJson: withFixtureProvenance(memReader(Object.fromEntries(Object.entries(manifests).flatMap(([id, m]) => [
        [`/${id}/pack.json`, packJson(id)],
        [`/${id}/concepts/manifest.json`, m],
    ])))),
});

describe('the manifest, read through loadPackStack', () => {
    it('one pack: every entry is answered, with the pack it came from', async () => {
        const pc = createPackConcepts(await stackOf({ meta: META }));
        expect(pc.keys()).toEqual(Object.keys(META.concepts));
        for (const [key, entry] of Object.entries(META.concepts)) {
            expect(pc.has(key)).toBe(true);
            expect(pc.get(key)).toEqual({ key, pack: 'meta', ...entry });
        }
        expect(pc.has('meta:character/nobody')).toBe(false);
        expect(pc.get('meta:character/nobody')).toBeNull();
        expect(pc.presenting('guardian').key).toBe('meta:character/narrator');
        expect(pc.presenting('sword')).toBeNull();
    });

    it('ofKind lists each kind\'s keys in declaration order; every key is of exactly one kind', async () => {
        const pc = createPackConcepts(await stackOf({ meta: META }));
        for (const kind of PACK_CONCEPT_KINDS) {
            expect(pc.ofKind(kind)).toEqual(Object.entries(META.concepts).filter(([, e]) => e.kind === kind).map(([k]) => k));
        }
        expect(PACK_CONCEPT_KINDS.flatMap((k) => pc.ofKind(k)).sort()).toEqual(pc.keys().sort());
    });

    it('an entry is frozen, nested look and text too', async () => {
        const e = createPackConcepts(await stackOf({ meta: META })).get('meta:character/narrator');
        expect(Object.isFrozen(e) && Object.isFrozen(e.look) && Object.isFrozen(e.text)).toBe(true);
    });

    it('PACK_CONCEPT_KINDS is frozen and carries the four kinds of Q2, the four of S6 (⛓ PL-1) and terrain (⛓ PASS-1)', () => {
        expect(Object.isFrozen(PACK_CONCEPT_KINDS)).toBe(true);
        expect([...PACK_CONCEPT_KINDS].sort()).toEqual(['boon', 'character', 'info', 'object', 'place', 'resource', 'stat', 'task', 'terrain']);
    });
});

describe('a two-pack stack: a later pack wins per key', () => {
    it('the later pack overrides one key WHOLE (no field merge) and keeps the key\'s first position', async () => {
        const pc = createPackConcepts(await stackOf({ meta: META, over: OVER }));
        expect(pc.get('meta:character/narrator')).toEqual({ key: 'meta:character/narrator', pack: 'over', ...OVER.concepts['meta:character/narrator'] });
        expect(pc.get('meta:place/lobby').pack).toBe('meta');
        const expected = [...new Set([...Object.keys(META.concepts), ...Object.keys(OVER.concepts)])];
        expect(pc.keys()).toEqual(expected);
        expect(pc.ofKind('character')).toEqual(expected.filter((k) => pc.get(k).kind === 'character'));
    });

    it('presenting answers the LAST pack in the stack that presents the id', async () => {
        const pc = createPackConcepts(await stackOf({ meta: META, over: OVER }));
        expect(pc.presenting('guardian')).toMatchObject({ key: 'over:character/understudy', pack: 'over' });
        // reversed stack: the meta pack is last, and its narrator (not overridden now) wins
        const rev = createPackConcepts(await stackOf({ over: OVER, meta: META }));
        expect(rev.presenting('guardian')).toMatchObject({ key: 'meta:character/narrator', pack: 'meta' });
    });

    it('an override that drops `presents` stops that key presenting', async () => {
        const drop = { schema_version: 1, concepts: { 'meta:character/narrator': { kind: 'character', name: 'Quiet' } } };
        expect(createPackConcepts(await stackOf({ meta: META, drop })).presenting('guardian')).toBeNull();
    });

    it('a pack with no concepts layer is skipped', () => {
        const pc = createPackConcepts([{ id: 'art-only', layers: { art: {} } }, { id: 'meta', layers: { concepts: META } }]);
        expect(pc.keys()).toEqual(Object.keys(META.concepts));
    });
});

describe('⛔ REFUSAL BY NAME', () => {
    const NARRATOR = META.concepts['meta:character/narrator'];
    const refuse = (concepts, pattern, extra = {}) => {
        const m = { schema_version: 1, concepts, ...extra };
        let err;
        try { createPackConcepts([{ id: 'bad', layers: { concepts: m } }]); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(ContentPackError);
        expect(err.message).toMatch(/pack "bad"/);
        expect(err.message).toMatch(pattern);
    };
    const one = (over) => ({ 'bad:character/x': { ...NARRATOR, ...over } });

    // ⛓ PL-1 — `presents` takes two forms (Z.1): a bare mechanic id, or a namespaced structure id.
    const task = (presents, kind = 'task') => ({ 'bad:task/x': { kind, name: 'X', presents } });
    it('a namespaced presents that is not <pack>:<kind>/<slug>', () => refuse(task('bad:quest/x'), /presents "bad:quest\/x" is not a structure id/));
    it('a namespaced presents of another kind than the concept\'s own', () => refuse(task('bad:stat/x'), /presents the stat "bad:stat\/x", but its own kind is task/));
    it('two entries of ONE pack presenting the same structure id', () => refuse(
        { 'bad:task/a': { kind: 'task', name: 'A', presents: 'g:task/x' }, 'bad:task/b': { kind: 'task', name: 'B', presents: 'g:task/x' } },
        /concepts "bad:task\/a" and "bad:task\/b" both present "g:task\/x"/,
    ));
    it('a src that is not a string', () => refuse(one({ src: 3 }), /src must be a provenance source id/));

    // ⛓ TILE-2 — `base` beside `art`: one of the closed set, refused by name otherwise; absent is valid.
    it('a base outside the closed set is refused BY NAME, naming the set', () => {
        for (const bad of ['lamp', 'Marker', '', 3, null]) {
            const want = `concept "bad:character/x": base ${JSON.stringify(bad)} is not one of ${PACK_TILE_BASES.join(', ')}`;
            refuse(one({ base: bad }), new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
    });
    it('each base of the closed set parses, with or without an art key; a row with no base parses', () => {
        for (const base of PACK_TILE_BASES) {
            for (const art of [undefined, 'ok:tile/x']) {
                const entry = { kind: 'object', name: 'X', base, ...(art ? { art } : {}) };
                const pc = createPackConcepts([{ id: 'ok', layers: { concepts: { schema_version: 1, concepts: { 'ok:object/x': entry } } } }]);
                expect(pc.get('ok:object/x').base).toBe(base);
            }
        }
        const pc = createPackConcepts([{ id: 'ok', layers: { concepts: { schema_version: 1, concepts: { 'ok:object/x': { kind: 'object', name: 'X', art: 'ok:tile/x' } } } } }]);
        expect('base' in pc.get('ok:object/x')).toBe(false);
    });
    it('PACK_TILE_BASES is frozen and is TILE-1\'s closed set', () => {
        expect(Object.isFrozen(PACK_TILE_BASES)).toBe(true);
        expect([...PACK_TILE_BASES].sort()).toEqual(['character', 'floor', 'marker', 'wall']);
    });
    it('a namespaced presents of the right form and kind parses (each structure kind)', () => {
        for (const kind of ['task', 'stat', 'resource', 'boon', 'place']) {
            expect(() => createPackConcepts([{ id: 'ok', layers: { concepts: { schema_version: 1, concepts: { [`ok:${kind}/x`]: { kind, name: 'X', presents: `g:${kind}/x` } } } } }])).not.toThrow();
        }
    });

    it('an unknown schema version', () => {
        let err;
        try { parseConceptsManifest({ schema_version: 2, concepts: {} }, 'bad'); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(ContentPackError);
        expect(err.message).toMatch(/pack "bad" concepts manifest: schema_version 2/);
    });
    it('an unknown kind', () => refuse(one({ kind: 'monster' }), /concept "bad:character\/x": kind "monster" is not one of/));
    it('a missing kind', () => refuse(one({ kind: undefined }), /concept "bad:character\/x": kind undefined is not one of/));
    it('a missing name', () => refuse(one({ name: undefined }), /concept "bad:character\/x": name is missing/));
    it('an empty name', () => refuse(one({ name: '' }), /name is missing/));
    it('an empty description', () => refuse(one({ description: '' }), /description must be a non-empty string/));
    it('a look that is not an object', () => refuse(one({ look: '#c0a040' }), /look must be \{ color, symbol \}/));
    it('a look colour that is not #rrggbb', () => refuse(one({ look: { color: '#c0a', symbol: 'N' } }), /look\.color "#c0a" is not #rrggbb/));
    it('a look with no colour', () => refuse(one({ look: { symbol: 'N' } }), /look\.color undefined is not #rrggbb/));
    it('a look with an empty symbol', () => refuse(one({ look: { color: '#c0a040', symbol: '' } }), /look\.symbol must be a non-empty string/));
    it('a look with an unknown field', () => refuse(one({ look: { color: '#c0a040', symbol: 'N', glow: 1 } }), /look has unknown field "glow"/));
    it('an art value that is not a namespaced key', () => refuse(one({ art: 'narrator.png' }), /art "narrator\.png" is not a namespaced art-library key/));
    it('a text value that is not a namespaced key', () => refuse(one({ text: { greeting: 'Hello there' } }), /text\.greeting "Hello there" is not a namespaced text-library key/));
    it('a text that is not an object', () => refuse(one({ text: 'meta:narrator/greeting' }), /text must be \{ <slot>: <text-library key> \}/));
    it('an empty presents', () => refuse(one({ presents: '' }), /presents must be a non-empty mechanic concept id/));
    it('an unknown field on an entry', () => refuse(one({ voice: 'deep' }), /concept "bad:character\/x": unknown field "voice"/));
    it('an unknown field on the manifest', () => refuse({}, /unknown field "extra"/, { extra: 1 }));
    it('an entry that is not an object', () => refuse({ 'bad:character/x': 'The Narrator' }, /the entry is not an object/));
    it('an un-namespaced concept key', () => refuse({ narrator: NARRATOR }, /concept "narrator": the key is not namespaced/));
    it('two entries of ONE pack presenting the same mechanic id', () => refuse(
        { 'bad:character/a': { kind: 'character', name: 'A', presents: 'guardian' }, 'bad:character/b': { kind: 'character', name: 'B', presents: 'guardian' } },
        /concepts "bad:character\/a" and "bad:character\/b" both present "guardian"/,
    ));
    it('ofKind of an unknown kind', async () => {
        const pc = createPackConcepts(await stackOf({ meta: META }));
        expect(() => pc.ofKind('monster')).toThrow(ContentPackError);
    });

    it('every field the reader accepts is exercised by the brief\'s manifest (no field goes unread)', () => {
        expect(Object.keys(NARRATOR).sort()).toEqual([...PACK_CONCEPT_FIELDS].sort());
    });
});

describe('the committed packs', () => {
    it('every committed pack still loads whole, and the reader accepts the stack (no pack carries concepts yet or each parses)', async () => {
        const reg = parseRegistry(await fsJson(new URL('packs.json', PACKS_BASE).href));
        const stack = await loadPackStack([...reg.packs], { base: PACKS_BASE, readJson: fsJson });
        expect(stack.map((l) => l.id)).toEqual([...reg.packs]);
        const pc = createPackConcepts(stack);
        const declared = stack.flatMap((l) => Object.keys(l.layers.concepts?.concepts ?? {}));
        expect(pc.keys().sort()).toEqual([...new Set(declared)].sort());
    });
});

describe('⛓ TILE-2 — a row that declares a base keeps per-entry provenance, as any concept row', () => {
    const tilePack = (row, provenance) => ({
        schema_version: 1,
        concepts: { 'lamps:object/lantern': { kind: 'object', name: 'A Lantern', art: 'lamps:tile/lantern', base: 'marker', ...row } },
        provenance,
    });
    const load = (manifest) => loadPackStack(['lamps'], {
        base: MEM,
        readJson: memReader({ '/lamps/pack.json': packJson('lamps'), '/lamps/concepts/manifest.json': manifest }),
    });
    const BLOCK = { sources: { hand: { type: 'authored', by: 'a test' }, other: { type: 'authored', by: 'another test' } }, default: 'hand' };

    it('the row resolves to its own src, else the default, through the loader\'s check', async () => {
        const { provenanceCounts } = await import('../contentPacks/provenance.js');
        const [own] = await load(tilePack({ src: 'other' }, BLOCK));
        expect(provenanceCounts(own).concepts).toEqual({ hand: 0, other: 1 });
        const [dflt] = await load(tilePack({}, BLOCK));
        expect(provenanceCounts(dflt).concepts).toEqual({ hand: 1, other: 0 });
        expect(createPackConcepts([dflt]).get('lamps:object/lantern')).toMatchObject({ base: 'marker', art: 'lamps:tile/lantern', pack: 'lamps' });
    });

    it('an unlisted src on a base-declaring row is refused at load, naming the pack, the layer and the key', async () => {
        await expect(load(tilePack({ src: 'nobody' }, BLOCK))).rejects.toThrow(/content pack "lamps" layer "concepts" provenance key "lamps:object\/lantern": src "nobody" is not a listed source/);
    });
});
