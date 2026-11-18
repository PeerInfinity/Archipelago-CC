/**
 * CONTENT SETS TILE-2 — **A PACK DECLARES A TILE KIND** (`base` beside `art` on a concept row; `packConcepts`), and
 * **THE ONE LOOKUP** kind → `{ artKey, base }` (`mazeTileArt.mazeTileKind`), resolved through TILE-1's chain
 * (`drawMazeTile`). In node, on the recorded draw-op log (`drawOpRecorder.js`):
 *
 *   1. ⛔ A `MAZE_ART_KEYS` kind resolves exactly as now: its row's key and base, whatever the stack holds, and
 *      `drawMazeTile` draws the same ops with the lookup's answer as without it (with and without the row's own
 *      draw; with no art, with art for every key, and with the committed `meta` theme's art).
 *   2. A TEST-ONLY fixture pack (in memory; no committed pack or preset gains it) declares a kind no theme has art
 *      for: with a base it draws as that base, under every art variant; the same kind with no base draws the
 *      placeholder; an unknown kind draws the placeholder; nothing throws. With art for its key, it draws the art.
 *   3. The play-time load carries the declared kinds (`tileKinds`) off the world's stack, and decodes a declared
 *      kind's art sheet.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';
import { PACK_TILE_BASES, createPackConcepts } from '../packConcepts/packConcepts.js';
import { recordingContext } from './drawOpRecorder.js';
import { MAZE_CONTENT_ROLES } from './mazeContent.js';
import {
    MAZE_ART_KEYS, MAZE_ART_THINGS, MAZE_TILE_BASES, drawMazeTile, loadMazeTileArt, mazeTileKind, paintMazeTileBase,
    paintMazeTilePlaceholder, resetMazeTilePlaceholderLogForTests, tileArtRefusal, tileKindKeys,
} from './mazeTileArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKS = pathToFileURL(`${join(HERE, '../../packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const PX = 16;

/** A tileArt stub: every key in `keys` resolves to its own one-frame sheet. */
function stubTileArt(keys) {
    const set = new Set(keys);
    const art = {
        has: (k) => set.has(k),
        frameRect: (k) => (set.has(k) ? { sheetRef: `sheet:${k}`, sx: 0, sy: 0, sw: 16, sh: 16 } : null),
        packOf: () => 'stub',
    };
    return { art, images: new Map(keys.map((k) => [`sheet:${k}`, { src: k }])) };
}

const ops = (fn) => {
    const ctx = recordingContext();
    const step = fn(ctx);
    return { step, log: ctx.__log };
};

/** ⛔ THE FIXTURE PACK — test-only, in memory. Its namespace is its own, and no theme carries its art keys. */
const FIXTURE_ID = 'tile2-fixture';
const LANTERN = `${FIXTURE_ID}:object/lantern`;
const UNBASED = `${FIXTURE_ID}:object/lantern-unbased`;
const FIXTURE_CONCEPTS = {
    schema_version: 1,
    concepts: {
        [LANTERN]: { kind: 'object', name: 'A Lantern', art: `${FIXTURE_ID}:tile/lantern`, base: 'marker' },
        [UNBASED]: { kind: 'object', name: 'An Unbased Lantern', art: `${FIXTURE_ID}:tile/lantern` },
    },
};
const MEM = 'mem:/packs/';
const fixtureReader = withFixtureProvenance(async (url) => {
    if (url === `${MEM}${FIXTURE_ID}/pack.json`) {
        return { schema_version: 1, id: FIXTURE_ID, title: 'TILE-2 fixture', licence: 'CC0', layers: { concepts: 'concepts/manifest.json' } };
    }
    if (url === `${MEM}${FIXTURE_ID}/concepts/manifest.json`) return structuredClone(FIXTURE_CONCEPTS);
    throw new Error(`no file ${url}`);
});
const fixtureConcepts = async () => createPackConcepts(await loadPackStack([FIXTURE_ID], { base: MEM, readJson: fixtureReader }));

/** The committed `meta` theme's art over the default `maze` pack, decoded by a stub (every sheet decodes). */
const metaTileArt = async () => (await loadMazeTileArt(['maze', 'meta'], {
    base: PACKS, readJson: fsJson, decode: async (u) => ({ src: u }), rasterise: async (shape) => ({ shape }),
})).tileArt;

afterEach(() => {
    resetMazeTilePlaceholderLogForTests();
    vi.restoreAllMocks();
});

describe('1. ⛔ a MAZE_ART_KEYS kind resolves exactly as now', () => {
    it('the lookup answers each row\'s own key and base, with no stack, with a stack, and with declared kinds', async () => {
        const pc = await fixtureConcepts();
        for (const kind of MAZE_ART_THINGS) {
            const want = { artKey: MAZE_ART_KEYS[kind].key, base: MAZE_ART_KEYS[kind].base };
            expect(mazeTileKind(kind)).toEqual(want);
            expect(mazeTileKind(kind, { packConcepts: pc })).toEqual(want);
            expect(mazeTileKind(kind, { tileKinds: tileKindKeys(pc) })).toEqual(want);
        }
    });

    it('drawMazeTile draws the same ops with the lookup\'s answer as without it: every row, every art variant, own draw or none', async () => {
        const variants = { none: null, every: stubTileArt(MAZE_ART_THINGS.map((k) => MAZE_ART_KEYS[k].key)), meta: await metaTileArt() };
        expect(variants.meta).not.toBeNull();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const [name, tileArt] of Object.entries(variants)) {
            for (const kind of MAZE_ART_THINGS) {
                for (const withOwn of [false, true]) {
                    const draw = (opts) => ops((ctx) => drawMazeTile(ctx, tileArt, kind, 3 * PX, 2 * PX, PX, {
                        ...(withOwn ? { own: () => { ctx.fillStyle = '#123456'; ctx.fillRect(0, 0, 1, 1); } } : {}),
                        ...opts,
                    }));
                    const before = draw({});
                    const after = draw(mazeTileKind(kind));
                    expect(after, `${name} / ${kind} / own=${withOwn}`).toEqual(before);
                }
            }
        }
    });
});

describe('2. a fixture pack declares a kind no theme has art for', () => {
    const artVariants = async () => ({ none: null, every: stubTileArt(MAZE_ART_THINGS.map((k) => MAZE_ART_KEYS[k].key)), meta: await metaTileArt() });

    it('the lookup reads its art key and base off the world\'s packs', async () => {
        const pc = await fixtureConcepts();
        expect(mazeTileKind(LANTERN, { packConcepts: pc })).toEqual({ artKey: FIXTURE_CONCEPTS.concepts[LANTERN].art, base: 'marker' });
        expect(mazeTileKind(UNBASED, { packConcepts: pc })).toEqual({ artKey: FIXTURE_CONCEPTS.concepts[UNBASED].art, base: null });
        expect(mazeTileKind(LANTERN, { tileKinds: tileKindKeys(pc) })).toEqual(mazeTileKind(LANTERN, { packConcepts: pc }));
        expect(mazeTileKind(`${FIXTURE_ID}:object/nothing`, { packConcepts: pc })).toEqual({ artKey: null, base: null });
        expect(mazeTileKind('lantern')).toEqual({ artKey: null, base: null });
    });

    it('tileKindKeys lists exactly the rows that declare a base', async () => {
        const pc = await fixtureConcepts();
        const declared = Object.entries(FIXTURE_CONCEPTS.concepts).filter(([, c]) => 'base' in c).map(([k]) => k);
        expect(Object.keys(tileKindKeys(pc))).toEqual(declared);
        expect(tileKindKeys(pc)[LANTERN]).toEqual({ artKey: FIXTURE_CONCEPTS.concepts[LANTERN].art, base: 'marker', pack: FIXTURE_ID });
        expect(Object.isFrozen(tileKindKeys(pc))).toBe(true);
        expect(tileKindKeys(null)).toEqual({});
    });

    it('with a base, it draws as that base under every art variant, and nothing throws or warns', async () => {
        const pc = await fixtureConcepts();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const want = ops((ctx) => paintMazeTileBase(ctx, 'marker', 0, 0, PX)).log;
        for (const [name, tileArt] of Object.entries(await artVariants())) {
            const got = ops((ctx) => drawMazeTile(ctx, tileArt, LANTERN, 0, 0, PX, mazeTileKind(LANTERN, { packConcepts: pc })));
            expect(got.step, name).toBe('base');
            expect(got.log, name).toEqual(want);
        }
        expect(warn).not.toHaveBeenCalled();
    });

    it('each base of the closed set draws as its own base draw', async () => {
        for (const base of PACK_TILE_BASES) {
            const got = ops((ctx) => drawMazeTile(ctx, null, LANTERN, 0, 0, PX, { artKey: null, base }));
            expect(got.step).toBe('base');
            expect(got.log).toEqual(ops((ctx) => paintMazeTileBase(ctx, base, 0, 0, PX)).log);
        }
        expect(Object.keys(MAZE_TILE_BASES)).toEqual([...PACK_TILE_BASES]);
    });

    it('the same kind with no base draws the placeholder, logged once; an unknown kind too; nothing throws', async () => {
        const pc = await fixtureConcepts();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const kind of [UNBASED, `${FIXTURE_ID}:object/nothing`]) {
            for (const [name, tileArt] of Object.entries(await artVariants())) {
                const got = ops((ctx) => drawMazeTile(ctx, tileArt, kind, 0, 0, PX, mazeTileKind(kind, { packConcepts: pc })));
                expect(got.step, `${kind} / ${name}`).toBe('placeholder');
                expect(got.log).toEqual(ops((ctx) => paintMazeTilePlaceholder(ctx, kind, 0, 0, PX)).log);
            }
        }
        expect(warn.mock.calls.map((c) => c[0])).toEqual([UNBASED, `${FIXTURE_ID}:object/nothing`]
            .map((k) => expect.stringContaining(`tile kind "${k}"`)));
    });

    it('with art for its key, it draws the art (step 1 of the chain)', async () => {
        const pc = await fixtureConcepts();
        const tileArt = stubTileArt([FIXTURE_CONCEPTS.concepts[LANTERN].art]);
        for (const kind of [LANTERN, UNBASED]) {
            const got = ops((ctx) => drawMazeTile(ctx, tileArt, kind, 0, 0, PX, mazeTileKind(kind, { packConcepts: pc })));
            expect(got.step).toBe('art');
            expect(got.log.some((l) => l.startsWith('drawImage('))).toBe(true);
        }
    });
});

describe('3. the play-time load carries the declared kinds', () => {
    it('off the concepts layer, when the load reads it (contentRoles)', async () => {
        const io = { base: MEM, readJson: fixtureReader, decode: async () => ({}) };
        const pc = await fixtureConcepts();
        const r = await loadMazeTileArt([FIXTURE_ID], { ...io, contentRoles: MAZE_CONTENT_ROLES });
        expect(r.tileKinds).toEqual(tileKindKeys(pc));
        expect(r.tileArt).toBeNull(); // no pack in the stack carries any art: nothing to decode
        const artOnly = await loadMazeTileArt([FIXTURE_ID], io);
        expect(artOnly.tileKinds).toEqual({});
    });

    it('a declared kind\'s art sheet is decoded, and the loaded tileArt carries tileKinds (accepted by tileArtRefusal)', async () => {
        const ART = {
            schema_version: 1,
            sheets: { lamps: { file: 'sheets/lamps.png', w: 16, h: 16 } },
            sprites: { [FIXTURE_CONCEPTS.concepts[LANTERN].art]: { sheet: 'lamps', fw: 16, fh: 16, only: [0] } },
        };
        const reader = withFixtureProvenance(async (url) => {
            if (url === `${MEM}${FIXTURE_ID}/pack.json`) {
                return { schema_version: 1, id: FIXTURE_ID, title: 'TILE-2 fixture', licence: 'CC0', layers: { concepts: 'concepts/manifest.json', art: 'art/manifest.json' } };
            }
            if (url === `${MEM}${FIXTURE_ID}/art/manifest.json`) return structuredClone(ART);
            return fixtureReader(url);
        });
        const decoded = [];
        const r = await loadMazeTileArt([FIXTURE_ID], {
            base: MEM, readJson: reader, decode: async (u) => { decoded.push(u); return { src: u }; }, contentRoles: MAZE_CONTENT_ROLES,
        });
        expect(decoded).toEqual([`${MEM}${FIXTURE_ID}/art/sheets/lamps.png`]);
        expect(r.tileArt.tileKinds).toEqual(r.tileKinds);
        expect(tileArtRefusal(r.tileArt)).toBeNull();
        const got = ops((ctx) => drawMazeTile(ctx, r.tileArt, LANTERN, 0, 0, PX, mazeTileKind(LANTERN, { tileKinds: r.tileArt.tileKinds })));
        expect(got.step).toBe('art');
    });

    it('tileArtRefusal refuses a malformed tileKinds by name', () => {
        const t = stubTileArt([]);
        expect(tileArtRefusal({ ...t, tileKinds: [] })).toMatch(/tileArt\.tileKinds must be/);
    });
});
