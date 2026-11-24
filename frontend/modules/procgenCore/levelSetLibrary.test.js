/**
 * procgenCore/levelSetLibrary + levelSetReference.ensureHeld — document library B5: the front (`levelSetCache`)
 * filled from the library, and a running game's holds. Over B1's in-memory backend (no IndexedDB in node).
 *
 * Mutants this file reds (each driven by hand, quoted in the as-built):
 *  · `ensureHeld` falls back to any held version of the id → the mismatch row;
 *  · `ensureHeld` serves a body whose id/hash is not the asked one → the corrupt row;
 *  · the holder never heartbeats / never re-holds on `gone` → the heartbeat rows;
 *  · the holder leaves the front hold on release → the release row.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { stampIdentity } from './contentIdentity.js';
import * as core from './documentLibrary.js';
import { createMemoryBackend } from './documentLibraryMemory.js';
import { createLevelSetCache } from './levelSetCache.js';
import { ENSURE_HELD_REFUSALS, ensureHeld, levelSetReferenceOf } from './levelSetReference.js';
import { createLevelSetHolder, createLibraryFront, levelSetLibrarySource } from './levelSetLibrary.js';

const setDoc = (tag, base = 'lab-set') => stampIdentity({ set_id: base, name: 'Lab', rooms: [{ id: 0, tag }] },
    { idKey: 'set_id', defaultBase: base });
const SOURCE = Object.freeze({ page: 'lab-page', tab_id: 'labtab' });

function makeLib() {
    let t = 1_000_000;
    let n = 0;
    const clock = { now: () => t, advance: (ms) => { t += ms; } };
    const backend = createMemoryBackend();
    const lib = core.createDocumentLibrary({ backend, now: clock.now, randomId: () => `id${(n += 1).toString(16).padStart(4, '0')}` });
    return { lib, backend, clock };
}
async function saveSet(lib, set, { lineageId = null, draft = false } = {}) {
    const r = await lib.saveVersion({
        lineageId, parent: null, draft, savedBecause: draft ? 'draft' : 'report', substrate: 'demo', source: SOURCE,
        label: 'Lab', members: [{ role: 'set', idKey: 'set_id', doc: set }, { role: 'rules', idKey: null, doc: { r: set.rooms[0].tag } }],
    });
    expect(r.status).toBe('saved');
    return r;
}

describe('ensureHeld — the front, filled from the library (B5)', () => {
    it('a front HIT answers held from the front and never opens the library', async () => {
        const cache = createLevelSetCache();
        const v1 = setDoc('one');
        const ref = levelSetReferenceOf(v1);
        cache.put(ref.set_id, v1, { contentHash: ref.content_hash });
        const library = vi.fn();
        await expect(ensureHeld(cache, ref, { library })).resolves.toMatchObject({ status: 'held', source: 'front', set: v1 });
        expect(library).not.toHaveBeenCalled();
    });
    it('a MISS is filled from the library: put in the front under that hash, the body byte-equal, its versions named', async () => {
        const { lib } = makeLib();
        const v1 = setDoc('one');
        const ref = levelSetReferenceOf(v1);
        const saved = await saveSet(lib, v1);
        const cache = createLevelSetCache();
        const got = await ensureHeld(cache, ref, { library: async () => lib });
        expect(got).toMatchObject({ status: 'held', source: 'library', why: null });
        expect(got.entries.map((e) => e.entry_id)).toEqual([saved.entry_id]);
        expect(core.canonicalOf(got.set, 'set_id')).toBe(core.canonicalOf(v1, 'set_id'));
        expect(got.set.provenance.content_hash).toBe(ref.content_hash);
        expect(cache.get(ref.set_id, ref.content_hash).set).toBe(got.set);
        // the second ask is a front hit
        await expect(ensureHeld(cache, ref, { library: async () => { throw new Error('not opened'); } }))
            .resolves.toMatchObject({ source: 'front' });
    });
    it('⛓ pin 3 / pin 5: v1 and v2 of one lineage in the library — rules naming v1 get v1\'s body, never v2\'s', async () => {
        const { lib } = makeLib();
        const v1 = setDoc('one');
        const v2 = setDoc('two');
        const first = await saveSet(lib, v1);
        await saveSet(lib, v2, { lineageId: first.lineage_id });
        const cache = createLevelSetCache();
        const got = await ensureHeld(cache, levelSetReferenceOf(v1), { library: lib });
        expect(got.set.rooms[0].tag).toBe('one');
        expect(cache.refs().map((r) => r.content_hash)).toEqual([levelSetReferenceOf(v1).content_hash]);
    });
    it('⛔ the library holds ONLY another version: mismatch BY NAME, its hashes listed, nothing put — never a fallback', async () => {
        const { lib } = makeLib();
        // ⛓ ONE id, two bodies (a set edited after its stamp: the library files it under its computed hash, B1 D9)
        const v1 = setDoc('one');
        const v2 = { ...structuredClone(v1), rooms: [{ id: 0, tag: 'two' }] };
        const v2Hash = levelSetReferenceOf(v2).content_hash;
        await saveSet(lib, v2);
        const cache = createLevelSetCache();
        const got = await ensureHeld(cache, levelSetReferenceOf(v1), { library: lib });
        expect(got).toMatchObject({ status: 'mismatch', source: 'library', set: null, heldHashes: [v2Hash] });
        expect(got.why).toMatch(/another version is NOT served/);
        expect(cache.size).toBe(0);
    });
    it('absent (nothing saved), and the opener\'s own answers (absent / unavailable), pass through by name', async () => {
        const { lib } = makeLib();
        const ref = levelSetReferenceOf(setDoc('one'));
        const cache = createLevelSetCache();
        await expect(ensureHeld(cache, ref, { library: lib })).resolves.toMatchObject({ status: 'absent', set: null });
        await expect(ensureHeld(cache, ref, { library: async () => ({ status: 'absent', why: 'nothing saved here' }) }))
            .resolves.toMatchObject({ status: 'absent', why: 'nothing saved here' });
        await expect(ensureHeld(cache, ref, { library: async () => ({ status: 'unavailable', why: 'no IndexedDB' }) }))
            .resolves.toMatchObject({ status: 'unavailable', why: 'no IndexedDB' });
        await expect(ensureHeld(cache, ref, { library: null })).resolves.toMatchObject({ status: 'unavailable' });
        await expect(ensureHeld(cache, ref, { library: async () => { throw new Error('boom'); } }))
            .resolves.toMatchObject({ status: 'unavailable', why: expect.stringMatching(/boom/) });
        expect(cache.size).toBe(0);
    });
    it('corrupt: the library\'s own verdict passes through; a served body under another id or hash is refused here', async () => {
        const ref = levelSetReferenceOf(setDoc('one'));
        const cache = createLevelSetCache();
        await expect(ensureHeld(cache, ref, { library: { get: async () => ({ status: 'corrupt', why: 'edited behind' }) } }))
            .resolves.toMatchObject({ status: 'corrupt', why: expect.stringMatching(/edited behind/) });
        const wrongId = { ...setDoc('one', 'other-base') };
        await expect(ensureHeld(cache, ref, { library: { get: async () => ({ status: 'held', doc: wrongId, contentHash: ref.content_hash, entries: [] }) } }))
            .resolves.toMatchObject({ status: 'corrupt', set: null });
        await expect(ensureHeld(cache, ref, { library: { get: async () => ({ status: 'held', doc: setDoc('one'), contentHash: '00000000', entries: [] }) } }))
            .resolves.toMatchObject({ status: 'corrupt', set: null });
        expect(cache.size).toBe(0);
        expect([...ENSURE_HELD_REFUSALS]).toEqual(['absent', 'mismatch', 'corrupt', 'unavailable']);
    });
    it('a ref without a hash THROWS by name (the front\'s rule), before any library is asked', async () => {
        const library = vi.fn();
        await expect(ensureHeld(createLevelSetCache(), { set_id: 'x' }, { library })).rejects.toMatchObject({
            name: 'LevelSetCacheReadError', code: 'read-missing-content-hash' });
        expect(library).not.toHaveBeenCalled();
    });
});

/** A front over one memory library, whose "databases" are a Set of names. */
function frontOver({ lib = makeLib().lib, exists = new Set(), search = '', webdriver = false, source = { dbName: null } } = {}) {
    const opened = [];
    const load = async () => ({
        core,
        idb: {
            libraryDatabaseExists: async (name) => exists.has(name),
            createIdbBackend: ({ dbName }) => { opened.push(dbName); return { close: async () => {} }; },
        },
    });
    // the memory library stands in for the one createDocumentLibrary would make over the IDB backend
    const fakeCore = { ...core, createDocumentLibrary: () => lib };
    const front = createLibraryFront({ load: async () => ({ ...(await load()), core: fakeCore }), source,
        search: () => search, webdriver: () => webdriver, tabId: 'apptab' });
    return { front, opened, lib };
}

describe('the app\'s library front (createLibraryFront)', () => {
    it('no database of that name → absent BY NAME and none is made (nothing opened)', async () => {
        const { front, opened } = frontOver();
        await expect(front.open()).resolves.toMatchObject({ status: 'absent' });
        expect(opened).toEqual([]);
    });
    it('which database: the seam, else ?libraryDb=, else the per-load name under webdriver, else the default', async () => {
        await expect(frontOver({ source: { dbName: 'row-db' } }).front.dbName()).resolves.toBe('row-db');
        await expect(frontOver({ search: '?libraryDb=q-db' }).front.dbName()).resolves.toBe('q-db');
        await expect(frontOver({ webdriver: true }).front.dbName()).resolves.toBe(`${core.DEFAULT_LIBRARY_DB_NAME}-auto-apptab`);
        await expect(frontOver().front.dbName()).resolves.toBe(core.DEFAULT_LIBRARY_DB_NAME);
        expect(levelSetLibrarySource).toEqual({ dbName: null });
    });
    it('one connection per database: reused, re-opened when the seam moves, concurrent opens make one', async () => {
        const source = { dbName: 'a' };
        const { front, opened, lib } = frontOver({ exists: new Set(['a', 'b']), source });
        const [x, y] = await Promise.all([front.open(), front.open()]);
        expect(x).toBe(lib);
        expect(y).toBe(lib);
        expect(opened).toEqual(['a']);
        source.dbName = 'b';
        await front.open();
        expect(opened).toEqual(['a', 'b']);
    });
});

const fakeTimers = () => {
    const live = new Map();
    let n = 0;
    return {
        live,
        setInterval: (fn, ms) => { n += 1; live.set(n, { fn, ms }); return n; },
        clearInterval: (id) => live.delete(id),
        tick: async () => { for (const { fn } of [...live.values()]) await fn(); },
    };
};

async function holderWorld({ inLibrary = true } = {}) {
    const { lib, clock } = makeLib();
    const v1 = setDoc('one');
    const ref = levelSetReferenceOf(v1);
    const saved = inLibrary ? await saveSet(lib, v1) : null;
    const cache = createLevelSetCache({ limit: 1 });
    cache.put(ref.set_id, v1, { contentHash: ref.content_hash });
    const { front } = frontOver({ lib, exists: new Set([core.DEFAULT_LIBRARY_DB_NAME]) });
    const timers = fakeTimers();
    const win = new EventTarget();
    const doc = new EventTarget();
    const holder = createLevelSetHolder({ cache, front, timers, win, doc });
    return { lib, clock, v1, ref, saved, cache, front, timers, win, doc, holder };
}
const holdsOf = async (lib, lineageId) => (await lib.inventory()).lineages.find((l) => l.lineage_id === lineageId)?.liveHolds ?? [];

describe('the running game\'s holds (createLevelSetHolder) — B1 D3/D8, the HOLDER\'s job', () => {
    it('holds in the front AND the library (kind game, this tab), and heartbeats every HOLD_HEARTBEAT_MS', async () => {
        const w = await holderWorld();
        const h = w.holder.hold(w.ref, { what: 'a game' });
        await h.ready;
        expect(h.state()).toMatchObject({ front: 'held', library: 'held', entry_id: w.saved.entry_id });
        expect(w.cache.holdsOf(w.ref)).toBe(1);
        const live = await holdsOf(w.lib, w.saved.lineage_id);
        expect(live).toEqual([expect.objectContaining({ kind: 'game', tab_id: 'apptab', what: 'a game' })]);
        expect([...w.timers.live.values()].map((t) => t.ms)).toEqual([core.HOLD_HEARTBEAT_MS]);
        // nine minutes of beats keep it live past a cleanup at the stale line
        for (let i = 0; i < 54; i += 1) { w.clock.advance(core.HOLD_HEARTBEAT_MS); await w.timers.tick(); }
        expect(h.state().beats).toBe(54);
        w.clock.advance(core.HOLD_STALE_MS - 1);
        await w.lib.cleanup({ now: w.clock.now() });
        expect((await w.lib.getEntry(w.saved.entry_id)).status).toBe('held');
    });
    it('a beat on visibilitychange and on pageshow; pagehide releases the library hold and pageshow holds again', async () => {
        const w = await holderWorld();
        const h = w.holder.hold(w.ref);
        await h.ready;
        w.doc.dispatchEvent(new Event('visibilitychange'));
        await vi.waitFor(() => expect(h.state().beats).toBe(1));
        w.win.dispatchEvent(new Event('pagehide'));
        expect(h.state().library).toBe('released-hidden');
        await vi.waitFor(async () => expect(await holdsOf(w.lib, w.saved.lineage_id)).toEqual([]));
        expect(w.cache.holdsOf(w.ref)).toBe(1);
        w.win.dispatchEvent(new Event('pageshow'));
        await vi.waitFor(() => expect(h.state()).toMatchObject({ library: 'held', reholds: 1 }));
        expect(await holdsOf(w.lib, w.saved.lineage_id)).toHaveLength(1);
    });
    it('⛓ D3: a heartbeat answered `gone` (cleaned while stale) HOLDS AGAIN', async () => {
        const w = await holderWorld();
        const h = w.holder.hold(w.ref);
        await h.ready;
        const first = h.state().hold_id;
        await w.lib.release(first); // the hold vanishes behind the holder's back (as a stale cleanup does)
        await w.timers.tick();
        expect(h.state()).toMatchObject({ library: 'held', reholds: 1 });
        expect(h.state().hold_id).not.toBe(first);
        expect(await holdsOf(w.lib, w.saved.lineage_id)).toHaveLength(1);
    });
    it('release: the front hold, the library hold, the timer and the listeners — all gone; idempotent', async () => {
        const w = await holderWorld();
        const h = w.holder.hold(w.ref);
        await h.ready;
        await h.release();
        expect(w.cache.holdsOf(w.ref)).toBe(0);
        expect(await holdsOf(w.lib, w.saved.lineage_id)).toEqual([]);
        expect(w.timers.live.size).toBe(0);
        w.win.dispatchEvent(new Event('pageshow'));
        await new Promise((r) => setTimeout(r, 5));
        expect(h.state()).toMatchObject({ library: 'released', reholds: 0 });
        await expect(h.release()).resolves.toMatchObject({ released: true });
        // now deleteLineage is no longer refused
        await expect(w.lib.deleteLineage(w.saved.lineage_id)).resolves.toMatchObject({ status: 'deleted' });
    });
    it('a release while the library hold is still in flight leaves NO library hold behind', async () => {
        const w = await holderWorld();
        const h = w.holder.hold(w.ref);
        await h.release();
        await h.ready;
        expect(await holdsOf(w.lib, w.saved.lineage_id)).toEqual([]);
        expect(w.timers.live.size).toBe(0);
    });
    it('⛓ js-23 (2): puts landing between the read and the hold evict the entry → the served body is RE-PUT and held', async () => {
        const w = await holderWorld();
        const big = createLevelSetCache(); // the default bound of 4
        big.put(w.ref.set_id, w.v1, { contentHash: w.ref.content_hash });
        const served = big.get(w.ref.set_id, w.ref.content_hash).set;
        for (let i = 0; i < 4; i += 1) big.put(`x${i}`, { set_id: `x${i}`, rooms: [] }, { contentHash: `0000000${i}` });
        expect(big.get(w.ref.set_id, w.ref.content_hash).status).toBe('absent');
        const holder = createLevelSetHolder({ cache: big, front: w.front, timers: w.timers, win: w.win, doc: w.doc });
        const h = holder.hold(w.ref, { set: served });
        expect(h.state()).toMatchObject({ front: 'held', refilled: true });
        expect(big.holdsOf(w.ref)).toBe(1);
        expect(big.get(w.ref.set_id, w.ref.content_hash).set).toBe(served);
        // without the body there is nothing to re-put: absent, by name
        const bare = createLevelSetCache();
        expect(createLevelSetHolder({ cache: bare, front: w.front, timers: w.timers, win: w.win, doc: w.doc })
            .hold(w.ref).state()).toMatchObject({ front: 'absent', refilled: false });
        await h.release();
    });
    it('a set with no library version (a bundle, door A\'s body) is held in the FRONT only, by name', async () => {
        const w = await holderWorld({ inLibrary: false });
        const h = w.holder.hold(w.ref);
        await h.ready;
        expect(h.state()).toMatchObject({ front: 'held', library: 'front-only' });
        expect(h.state().why).toMatch(/not a library version/);
        expect(w.timers.live.size).toBe(0);
        // the front hold keeps it through the bound (limit 1 here)
        w.cache.put('other', { set_id: 'other', rooms: [] }, { contentHash: '0000000b' });
        w.cache.put('other2', { set_id: 'other2', rooms: [] }, { contentHash: '0000000c' });
        expect(w.cache.get(w.ref.set_id, w.ref.content_hash).status).toBe('held');
    });
});

describe('levelSetLibrary — ⛔ pins over its source', () => {
    const src = readFileSync(fileURLToPath(new URL('./levelSetLibrary.js', import.meta.url)), 'latin1');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    it('imports nothing statically (the library is fetched document-relative, so the bundle carries none of it)', () => {
        expect(code).not.toMatch(/^\s*import\s/m);
        expect(code).toMatch(/import\(\s*appUrl\('\.\/modules\/procgenCore\/documentLibrary\.js'\)\)/);
    });
    it('names no game or substrate', () => {
        expect(src).not.toMatch(/seedling|maze|bounce|cloudberry|alttp|flash|noiz2sa|omsi|cavernous|tmt|adventure/i);
    });
    it('⛔ (d) never swaps a running game: nothing here listens for a library save or a live notice', () => {
        expect(code).not.toMatch(/BroadcastChannel|versionSaved|draftUpdated|eventBus|subscribe\(/);
    });
});
