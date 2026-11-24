/**
 * procgenCore/levelSetCache — the host-side, game-neutral level-set cache (S3), keyed by `(set_id, content_hash)`
 * since document library B5.
 *
 * Mutants this file reds (each driven by hand, quoted in the as-built):
 *  · `put` keeps the first body under a key (no overwrite) → the overwrite row;
 *  · the bound loop removed → the eviction row;
 *  · `get` serves the held set on a hash mismatch → the mismatch row;
 *  · B5: a hashless `get` allowed → the hashless-throws row;
 *  · B5: the bound counts / evicts held entries → the two hold rows;
 *  · B5: keyed by id again (X@H2 replaces X@H1) → the coexistence row;
 *  · a game name in the source → the grep pin.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    LEVEL_SET_CACHE_LIMIT, LEVEL_SET_CACHE_REFUSAL, LevelSetCacheReadError, createLevelSetCache, levelSetCache,
} from './levelSetCache.js';

const set = (id, rooms = [{ n: id }]) => ({ set_id: id, rooms });
const ref = (setId, contentHash) => ({ set_id: setId, content_hash: contentHash });

describe('levelSetCache — put / get', () => {
    it('a put set is served under its id AND hash; an unknown id is ABSENT, by name', () => {
        const c = createLevelSetCache();
        const a = set('a');
        expect(c.put('a', a, { contentHash: '0000000a' })).toEqual([]);
        expect(c.get('a', '0000000a')).toMatchObject({ status: 'held', set: a, held_hash: '0000000a', why: null });
        const miss = c.get('b', '0000000b');
        expect(miss).toMatchObject({ status: 'absent', set: null, held_hashes: [] });
        expect(miss.why).toMatch(/no level set with set_id "b"/);
    });
    it('⛔ B5: a get with NO content hash THROWS LevelSetCacheReadError by name (never "whatever is held")', () => {
        const c = createLevelSetCache();
        c.put('a', set('a'), { contentHash: '0000000a' });
        for (const hash of [undefined, null, '']) {
            let err = null;
            try { c.get('a', hash); } catch (e) { err = e; }
            expect(err).toBeInstanceOf(LevelSetCacheReadError);
            expect(err.name).toBe('LevelSetCacheReadError');
            expect(err.code).toBe(LEVEL_SET_CACHE_REFUSAL.missingContentHash);
        }
        expect(() => c.get('', '0000000a')).toThrow(/read-bad-set-id/);
        expect(() => c.hold({ set_id: 'a' })).toThrow(/read-missing-content-hash/);
    });
    it('a re-put of the SAME (id, hash) replaces that entry; a different hash is a SECOND entry', () => {
        const c = createLevelSetCache();
        const first = set('a', [{ v: 1 }]);
        const again = set('a', [{ v: 1 }]);
        c.put('a', first, { contentHash: '00000001' });
        c.put('a', again, { contentHash: '00000001' });
        expect(c.size).toBe(1);
        expect(c.get('a', '00000001').set).toBe(again);
    });
    it('⛓ B5 (J6 retired): X@H1 and X@H2 COEXIST, each served under its own hash, byte-equal', () => {
        const c = createLevelSetCache();
        const v1 = set('x', [{ v: 1 }]);
        const v2 = set('x', [{ v: 2 }]);
        c.put('x', v1, { contentHash: '00000001' });
        c.put('x', v2, { contentHash: '00000002' });
        expect(c.size).toBe(2);
        expect(c.ids()).toEqual(['x']);
        expect(c.get('x', '00000001').set).toBe(v1);
        expect(JSON.stringify(c.get('x', '00000001').set)).toBe(JSON.stringify({ set_id: 'x', rooms: [{ v: 1 }] }));
        expect(c.get('x', '00000002').set).toBe(v2);
        expect(c.has('x')).toBe(true);
        expect(c.has('x', '00000001')).toBe(true);
        expect(c.has('x', '00000003')).toBe(false);
        // ⛓ js-23 (4): null is "no hash" like undefined — any version, never the literal key "x\0null"
        expect(c.has('x', null)).toBe(true);
        expect(c.has('y', null)).toBe(false);
    });
    it('⛔ a content_hash MISMATCH is REPORTED and NOT SERVED — the held hashes listed', () => {
        const c = createLevelSetCache();
        c.put('a', set('a'), { contentHash: 'aaaaaaaa' });
        const r = c.get('a', 'bbbbbbbb');
        expect(r.status).toBe('mismatch');
        expect(r.set).toBe(null);
        expect(r).toMatchObject({ content_hash: 'bbbbbbbb', held_hash: 'aaaaaaaa', held_hashes: ['aaaaaaaa'] });
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

describe('levelSetCache — BOUNDED on the UNHELD, FIFO by last put', () => {
    it('a put past the limit evicts the one put longest ago, and says which (as refs)', () => {
        const c = createLevelSetCache({ limit: 2 });
        c.put('a', set('a'), { contentHash: '0000000a' });
        c.put('b', set('b'), { contentHash: '0000000b' });
        expect(c.put('c', set('c'), { contentHash: '0000000c' })).toEqual([ref('a', '0000000a')]);
        expect(c.ids()).toEqual(['b', 'c']);
        expect(c.get('a', '0000000a').status).toBe('absent');
    });
    it('re-putting a held pair moves it to the newest end; get does not reorder', () => {
        const c = createLevelSetCache({ limit: 2 });
        c.put('a', set('a'), { contentHash: '0000000a' });
        c.put('b', set('b'), { contentHash: '0000000b' });
        c.get('a', '0000000a');
        expect(c.ids()).toEqual(['a', 'b']);
        c.put('a', set('a'), { contentHash: '0000000a' });
        expect(c.put('c', set('c'), { contentHash: '0000000c' })).toEqual([ref('b', '0000000b')]);
        expect(c.ids()).toEqual(['a', 'c']);
    });
    it('⛓ B5 (J2 retired): a HELD entry is never evicted, however many puts follow, and does not count against the bound', () => {
        const c = createLevelSetCache({ limit: 2 });
        const running = set('r');
        c.put('r', running, { contentHash: '0000000r' });
        expect(c.hold(ref('r', '0000000r'))).toEqual({ status: 'held', holds: 1 });
        const evicted = [];
        for (const id of ['a', 'b', 'c', 'd', 'e']) evicted.push(...c.put(id, set(id), { contentHash: `0000000${id}` }));
        expect(evicted.map((e) => e.set_id)).toEqual(['a', 'b', 'c']);
        expect(c.get('r', '0000000r').set).toBe(running);
        expect(c.refs()).toEqual([
            { ...ref('r', '0000000r'), holds: 1 }, { ...ref('d', '0000000d'), holds: 0 }, { ...ref('e', '0000000e'), holds: 0 },
        ]);
    });
    it('⛓ B5: holds are COUNTED; the last release puts the entry back under the bound, applied at once', () => {
        const c = createLevelSetCache({ limit: 1 });
        c.put('r', set('r'), { contentHash: '0000000r' });
        c.hold(ref('r', '0000000r'));
        c.hold(ref('r', '0000000r'));
        c.put('a', set('a'), { contentHash: '0000000a' });
        expect(c.release(ref('r', '0000000r'))).toEqual({ status: 'released', holds: 1, evicted: [] });
        expect(c.holdsOf(ref('r', '0000000r'))).toBe(1);
        // the last release: two unheld over a bound of one → the older (r) goes
        expect(c.release(ref('r', '0000000r'))).toEqual({ status: 'released', holds: 0, evicted: [ref('r', '0000000r')] });
        expect(c.release(ref('r', '0000000r'))).toEqual({ status: 'absent' });
        expect(c.hold(ref('z', '0000000z'))).toEqual({ status: 'absent' });
    });
    it('a re-put of a held pair keeps its holds', () => {
        const c = createLevelSetCache({ limit: 1 });
        c.put('r', set('r'), { contentHash: '0000000r' });
        c.hold(ref('r', '0000000r'));
        c.put('r', set('r'), { contentHash: '0000000r' });
        expect(c.holdsOf(ref('r', '0000000r'))).toBe(1);
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
