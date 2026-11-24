/**
 * procgenCore/levelSetCache — the host-side, game-neutral level-set cache (S3).
 *
 * Mutants this file reds (each driven by hand, quoted in the as-built):
 *  · `put` keeps the first body under an id (no overwrite) → the overwrite row;
 *  · the bound loop removed → the eviction row;
 *  · `get` serves the held set on a hash mismatch → the mismatch row;
 *  · a game name in the source → the grep pin.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LEVEL_SET_CACHE_LIMIT, createLevelSetCache, levelSetCache } from './levelSetCache.js';

const set = (id, rooms = [{ n: id }]) => ({ set_id: id, rooms });

describe('levelSetCache — put / get', () => {
    it('a put set is served under its id with its hash; an unknown id is ABSENT, by name', () => {
        const c = createLevelSetCache();
        const a = set('a');
        expect(c.put('a', a, { contentHash: '0000000a' })).toEqual([]);
        expect(c.get('a', '0000000a')).toMatchObject({ status: 'held', set: a, held_hash: '0000000a', why: null });
        expect(c.get('a')).toMatchObject({ status: 'held', set: a });
        const miss = c.get('b', '0000000b');
        expect(miss).toMatchObject({ status: 'absent', set: null });
        expect(miss.why).toMatch(/no level set with set_id "b"/);
    });
    it('put OVERWRITES: the same id re-put serves the NEW body and hash, never the old', () => {
        const c = createLevelSetCache();
        const old = set('a', [{ v: 1 }]);
        const fresh = set('a', [{ v: 2 }]);
        c.put('a', old, { contentHash: '00000001' });
        c.put('a', fresh, { contentHash: '00000002' });
        expect(c.size).toBe(1);
        expect(c.get('a', '00000002').set).toBe(fresh);
        expect(c.get('a', '00000001').status).toBe('mismatch');
    });
    it('⛔ a content_hash MISMATCH is REPORTED and NOT SERVED — both hashes quoted', () => {
        const c = createLevelSetCache();
        c.put('a', set('a'), { contentHash: 'aaaaaaaa' });
        const r = c.get('a', 'bbbbbbbb');
        expect(r.status).toBe('mismatch');
        expect(r.set).toBe(null);
        expect(r).toMatchObject({ content_hash: 'bbbbbbbb', held_hash: 'aaaaaaaa' });
        expect(r.why).toMatch(/aaaaaaaa.*not the bbbbbbbb.*NOT served/);
    });
    it('refuses by name: a key that is not the set\'s own id, a non-set, a missing hash', () => {
        const c = createLevelSetCache();
        expect(() => c.put('x', set('y'), { contentHash: '00000000' })).toThrow(/not the set's own set_id/);
        expect(() => c.put('x', { set_id: 'x' }, { contentHash: '00000000' })).toThrow(/not a level set/);
        expect(() => c.put('', set(''), { contentHash: '00000000' })).toThrow(/non-empty string/);
        expect(() => c.put('x', set('x'))).toThrow(/no contentHash/);
        expect(c.size).toBe(0);
    });
});

describe('levelSetCache — BOUNDED, FIFO by last put', () => {
    it('a put past the limit evicts the one put longest ago, and says which', () => {
        const c = createLevelSetCache({ limit: 2 });
        c.put('a', set('a'), { contentHash: '0000000a' });
        c.put('b', set('b'), { contentHash: '0000000b' });
        expect(c.put('c', set('c'), { contentHash: '0000000c' })).toEqual(['a']);
        expect(c.ids()).toEqual(['b', 'c']);
        expect(c.get('a').status).toBe('absent');
    });
    it('re-putting a held id moves it to the newest end; get does not reorder', () => {
        const c = createLevelSetCache({ limit: 2 });
        c.put('a', set('a'), { contentHash: '0000000a' });
        c.put('b', set('b'), { contentHash: '0000000b' });
        c.get('a');
        expect(c.ids()).toEqual(['a', 'b']);
        c.put('a', set('a'), { contentHash: '0000000a' });
        expect(c.put('c', set('c'), { contentHash: '0000000c' })).toEqual(['b']);
        expect(c.ids()).toEqual(['a', 'c']);
    });
    it('clear empties it; the shared instance has the default bound; a bad limit refuses', () => {
        const c = createLevelSetCache();
        c.put('a', set('a'), { contentHash: '0000000a' });
        c.clear();
        expect(c.size).toBe(0);
        expect(levelSetCache.limit).toBe(LEVEL_SET_CACHE_LIMIT);
        expect(() => createLevelSetCache({ limit: 0 })).toThrow(/positive integer/);
    });
});

describe('levelSetCache — ⛔ game-neutral and pure (grep pins over its own source)', () => {
    const src = readFileSync(fileURLToPath(new URL('./levelSetCache.js', import.meta.url)), 'utf8');
    it('names no game or substrate', () => {
        expect(src).not.toMatch(/seedling|maze|bounce|cloudberry|alttp|flash|noiz2sa|omsi|cavernous|tmt|adventure/i);
    });
    it('imports nothing (no eventBus, no DOM) — measured on the CODE, comments stripped', () => {
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(code).not.toMatch(/^\s*import\s/m);
        expect(code).not.toMatch(/eventBus|document\.|window\./);
    });
});
