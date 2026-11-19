/**
 * procgenCore/atlasCache — the host-side, game-neutral atlas cache (region-map atlas-cache slice).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ATLAS_CACHE_LIMIT, atlasCache, createAtlasCache, hookCtxFor, putAtlases } from './atlasCache.js';

const A = (id, n = 1) => ({ atlas_id: id, regions: Array.from({ length: n }, (_, i) => ({ region_id: `r${i}` })) });

describe('atlasCache — put / get / clear', () => {
    it('get returns what put stored, null for an id it does not hold; clear empties it', () => {
        const c = createAtlasCache();
        const a = A('x');
        expect(c.put('x', a)).toEqual([]);
        expect(c.get('x')).toBe(a);
        expect(c.has('x')).toBe(true);
        expect(c.get('y')).toBe(null);
        c.clear();
        expect(c.size).toBe(0);
        expect(c.get('x')).toBe(null);
    });
    it('⛓ STALENESS: put OVERWRITES — a re-hand-over under the same atlas_id is what get serves next', () => {
        const c = createAtlasCache();
        const v1 = A('same', 1);
        const v2 = A('same', 2);
        c.put('same', v1);
        c.put('same', v2);
        expect(c.get('same')).toBe(v2);
        expect(c.size).toBe(1);
    });
    it('refuses a key that is not the atlas\'s own atlas_id, and a non-atlas', () => {
        const c = createAtlasCache();
        expect(() => c.put('a', A('b'))).toThrow(/not the atlas's own atlas_id/);
        expect(() => c.put('a', { regions: [] })).toThrow(/not an atlas/);
        expect(() => c.put('', A(''))).toThrow(/non-empty string/);
    });
});

describe('atlasCache — the bound (FIFO by last put)', () => {
    it(`holds at most ATLAS_CACHE_LIMIT (${ATLAS_CACHE_LIMIT}); a put past it evicts the one put longest ago`, () => {
        const c = createAtlasCache();
        expect(c.limit).toBe(ATLAS_CACHE_LIMIT);
        for (let i = 0; i < ATLAS_CACHE_LIMIT; i++) expect(c.put(`a${i}`, A(`a${i}`))).toEqual([]);
        expect(c.put('new', A('new'))).toEqual(['a0']);
        expect(c.size).toBe(ATLAS_CACHE_LIMIT);
        expect(c.get('a0')).toBe(null);
        expect(c.get('a1')).not.toBe(null);
    });
    it('a re-put moves an id to the newest end; get does not reorder', () => {
        const c = createAtlasCache({ limit: 2 });
        c.put('p', A('p'));
        c.put('q', A('q'));
        c.get('p');
        expect(c.ids()).toEqual(['p', 'q']);
        c.put('p', A('p'));
        expect(c.ids()).toEqual(['q', 'p']);
        expect(c.put('r', A('r'))).toEqual(['q']);
    });
    it('refuses a limit that is not a positive integer', () => {
        expect(() => createAtlasCache({ limit: 0 })).toThrow(/positive integer/);
        expect(() => createAtlasCache({ limit: 1.5 })).toThrow(/positive integer/);
    });
});

describe('atlasCache — putAtlases and hookCtxFor', () => {
    it('putAtlases puts every atlas in order and skips what is not one', () => {
        const c = createAtlasCache();
        expect(putAtlases([A('a'), null, { regions: [] }, A('b')], c)).toEqual(['a', 'b']);
        expect(putAtlases(undefined, c)).toEqual([]);
        expect(c.ids()).toEqual(['a', 'b']);
    });
    it('⛓ PER-PLAYER: two players naming two atlas_ids each get their OWN atlas', () => {
        const c = createAtlasCache();
        const one = A('one');
        const two = A('two');
        c.put('one', one);
        c.put('two', two);
        const rules = { region_atlas: { 1: { atlas_id: 'one' }, 2: { atlas_id: 'two' } } };
        expect(hookCtxFor(rules, '1', c)).toEqual({ atlases: { one } });
        expect(hookCtxFor(rules, 2, c)).toEqual({ atlases: { two } });
        expect(hookCtxFor(rules, '3', c)).toEqual({});
    });
    it('{} when the rules name no atlas, or one the cache does not hold', () => {
        const c = createAtlasCache();
        expect(hookCtxFor({}, '1', c)).toEqual({});
        expect(hookCtxFor(null, '1', c)).toEqual({});
        expect(hookCtxFor({ region_atlas: { 1: { atlas_id: 'absent' } } }, '1', c)).toEqual({});
    });
    it('the shared instance is a cache with the default bound', () => {
        expect(atlasCache.limit).toBe(ATLAS_CACHE_LIMIT);
    });
});

describe('atlasCache — ⛔ game-neutral and pure (grep pins over its own source)', () => {
    const src = readFileSync(fileURLToPath(new URL('./atlasCache.js', import.meta.url)), 'utf8');
    it('names no game or substrate', () => {
        expect(src).not.toMatch(/seedling|maze|bounce|cloudberry|alttp|flash|noiz2sa|omsi|cavernous|tmt|adventure/i);
    });
    it('imports nothing at the top of the module (no eventBus, no DOM) — measured on the CODE, comments stripped', () => {
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(code).not.toMatch(/^\s*import\s/m);
        expect(code).not.toMatch(/eventBus|document\.|window\./);
    });
});
