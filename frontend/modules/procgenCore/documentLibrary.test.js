/**
 * documentLibrary — the shared, versioned, fingerprint-checked document store
 * (lab arc, slice B1). Runs on the in-memory backend, which has IndexedDB's
 * transaction semantics; the IndexedDB backend itself is driven by the in-app
 * row `document-library-idb`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { computeContentHash, stampIdentity } from './contentIdentity.js';
import {
    DRAFT_MAX_AGE_MS, HOLD_STALE_MS, KEEP_SAVED_PER_LINEAGE, LibraryReadError, LibraryWriteError, NO_ID_KEY, READ_REFUSAL, SAVE_POINTS,
    WRITE_REFUSAL, canonicalOf, createDocumentLibrary, docKey,
} from './documentLibrary.js';
import { createMemoryBackend } from './documentLibraryMemory.js';
import { createIdbBackend, deleteLibraryDatabase } from './documentLibraryIdb.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..');
const REPO = join(FRONTEND, '..');

/** A deterministic library over `backend` with a hand-wound clock. */
function makeLib(backend = createMemoryBackend(), { start = 1_000_000, prefix = 'id' } = {}) {
    let t = start;
    let n = 0;
    const clock = { now: () => t, advance: (ms) => { t += ms; }, set: (ms) => { t = ms; } };
    const lib = createDocumentLibrary({ backend, now: clock.now, randomId: () => `${prefix}${(n += 1).toString(16).padStart(4, '0')}` });
    return { lib, backend, clock };
}

/** A small id-stamped document, as the labs stamp theirs. */
function setDoc(rooms, base = 'demo-set') {
    return stampIdentity({ set_id: base, name: 'Demo', rooms }, { idKey: 'set_id', defaultBase: base });
}
const overlayDoc = (note = 'o') => stampIdentity({ overlay_id: 'demo-overlay', note }, { idKey: 'overlay_id', defaultBase: 'demo-overlay' });
const rulesDoc = (n = 1) => ({ regions: { start: { exits: n } } });

function members(set, { overlay = overlayDoc(), rules = rulesDoc() } = {}) {
    return [
        { role: 'set', idKey: 'set_id', doc: set },
        { role: 'overlay', idKey: 'overlay_id', doc: overlay },
        { role: 'rules', idKey: null, doc: rules },
    ];
}
const SOURCE_A = Object.freeze({ page: 'lab-page', tab_id: 'tabA' });
const SOURCE_B = Object.freeze({ page: 'lab-page', tab_id: 'tabB' });

function saveReq(set, extra = {}) {
    return {
        lineageId: null, parent: null, draft: false, savedBecause: 'report', substrate: 'demo-substrate',
        source: SOURCE_A, label: 'Demo', members: members(set), ...extra,
    };
}
const getOf = (doc) => ({ idKey: 'set_id', docId: doc.set_id, contentHash: doc.provenance.content_hash });

async function refusalCode(promiseOrFn) {
    try {
        await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
    } catch (e) {
        return `${e.name}:${e.code}`;
    }
    return 'no refusal';
}

describe('documentLibrary — reads refuse by name; no read without a fingerprint', () => {
    it('a get without contentHash THROWS LibraryReadError (read-missing-content-hash)', async () => {
        const { lib } = makeLib();
        await expect(refusalCode(() => lib.get({ idKey: 'set_id', docId: 'x-00000000' })))
            .resolves.toBe(`LibraryReadError:${READ_REFUSAL.missingContentHash}`);
        await expect(refusalCode(() => lib.get({ idKey: 'set_id', docId: 'x', contentHash: null })))
            .resolves.toBe(`LibraryReadError:${READ_REFUSAL.missingContentHash}`);
        await expect(refusalCode(() => lib.get({ idKey: 'set_id', docId: 'x', contentHash: 'ABC' })))
            .resolves.toBe(`LibraryReadError:${READ_REFUSAL.badContentHash}`);
        await expect(refusalCode(() => lib.get({ docId: 'x', contentHash: '00000000' })))
            .resolves.toBe(`LibraryReadError:${READ_REFUSAL.missingIdKey}`);
        await expect(refusalCode(() => lib.get({ idKey: 'set_id', contentHash: '00000000' })))
            .resolves.toBe(`LibraryReadError:${READ_REFUSAL.missingDocId}`);
        await expect(refusalCode(() => lib.get({ idKey: null, docId: 'x', contentHash: '00000000' })))
            .resolves.toBe(`LibraryReadError:${READ_REFUSAL.badDocId}`);
        await expect(refusalCode(() => lib.get())).resolves.toBe(`LibraryReadError:${READ_REFUSAL.notAnObject}`);
        expect(new LibraryReadError('c', 'd')).toBeInstanceOf(Error);
    });

    it('absent, and mismatch LISTS the hashes held under that id', async () => {
        const { lib } = makeLib();
        const v1 = setDoc(['r1']);
        expect(await lib.get(getOf(v1))).toEqual({ status: 'absent' });
        await lib.saveVersion(saveReq(v1));
        const other = { idKey: 'set_id', docId: v1.set_id, contentHash: '0badc0de' };
        expect(await lib.get(other)).toEqual({ status: 'mismatch', heldHashes: [v1.provenance.content_hash] });
        expect(await lib.get({ idKey: 'set_id', docId: 'nobody-12345678', contentHash: '12345678' })).toEqual({ status: 'absent' });
    });

    it('a body edited behind the library answers corrupt, never held', async () => {
        const { lib, backend } = makeLib();
        const v1 = setDoc(['r1']);
        await lib.saveVersion(saveReq(v1));
        const key = docKey('set_id', v1.set_id, v1.provenance.content_hash);
        const row = backend.raw('docs').get(key);
        backend.raw('docs').set(key, { ...row, canonical: row.canonical.replace('r1', 'r9') });
        const r = await lib.get(getOf(v1));
        expect(r.status).toBe('corrupt');
        expect(r.doc).toBeUndefined();
    });

    it('a stored provenance that lies about the hash answers corrupt', async () => {
        const { lib, backend } = makeLib();
        const v1 = setDoc(['r1']);
        await lib.saveVersion(saveReq(v1));
        const key = docKey('set_id', v1.set_id, v1.provenance.content_hash);
        const row = backend.raw('docs').get(key);
        backend.raw('docs').set(key, { ...row, provenance: { content_hash: 'deadbeef' } });
        expect((await lib.get(getOf(v1))).status).toBe('corrupt');
    });

    it('unavailable is an ANSWER for every call, not a throw', async () => {
        const { lib, backend } = makeLib();
        backend.unavailable('no database here');
        const want = { status: 'unavailable', why: 'no database here' };
        expect(await lib.get(getOf(setDoc(['r1'])))).toEqual(want);
        expect(await lib.saveVersion(saveReq(setDoc(['r1'])))).toEqual(want);
        expect(await lib.lineages()).toEqual(want);
        expect(await lib.getEntry('x#1')).toEqual(want);
        expect(await lib.entriesOf('x')).toEqual(want);
        expect(await lib.cleanup({ now: 1 })).toEqual(want);
        expect(await lib.estimate()).toEqual(want);
    });

    it('the IndexedDB backend answers unavailable where there is no indexedDB (node)', async () => {
        expect(globalThis.indexedDB).toBeUndefined();
        const lib = createDocumentLibrary({ backend: createIdbBackend({ dbName: 'nowhere' }) });
        const r = await lib.get(getOf(setDoc(['r1'])));
        expect(r.status).toBe('unavailable');
        expect(r.why).toMatch(/no indexedDB/);
        expect(await deleteLibraryDatabase('nowhere')).toEqual({ status: 'unavailable', why: 'no indexedDB in this browser context' });
    });

    it('an open that fails with VersionError answers unavailable: newer library schema', async () => {
        const fakeFactory = {
            open() {
                const req = {};
                queueMicrotask(() => { req.error = { name: 'VersionError', message: 'older' }; req.onerror(); });
                return req;
            },
        };
        const lib = createDocumentLibrary({ backend: createIdbBackend({ dbName: 'v', indexedDB: fakeFactory }) });
        const r = await lib.lineages();
        expect(r).toEqual({ status: 'unavailable', why: 'newer library schema (this page knows an older one)' });
    });

    it('a commit the browser refuses (quota) answers failed and writes nothing', async () => {
        const { lib, backend } = makeLib();
        const quota = Object.assign(new Error('the quota has been exceeded'), { name: 'QuotaExceededError' });
        backend.failNextCommit(quota);
        const r = await lib.saveVersion(saveReq(setDoc(['r1'])));
        expect(r).toEqual({ status: 'failed', why: 'QuotaExceededError: the quota has been exceeded' });
        expect((await lib.lineages()).lineages).toEqual([]);
        expect(backend.raw('docs').size).toBe(0);
    });
});

describe('documentLibrary — writes refuse by name', () => {
    const cases = [
        ['not an object', () => 7, WRITE_REFUSAL.notAnObject],
        ['an unknown field', (s) => ({ ...saveReq(s), latest: true }), WRITE_REFUSAL.unknownField],
        ['no members', (s) => ({ ...saveReq(s), members: [] }), WRITE_REFUSAL.membersMissing],
        ['draft not boolean', (s) => ({ ...saveReq(s), draft: 'yes' }), WRITE_REFUSAL.draftShape],
        ['an unknown savedBecause', (s) => ({ ...saveReq(s), savedBecause: 'idle' }), WRITE_REFUSAL.savedBecauseUnknown],
        ['a numbered version saved because draft', (s) => ({ ...saveReq(s), savedBecause: 'draft' }), WRITE_REFUSAL.savedBecauseDraftMismatch],
        ['a draft saved at a save point', (s) => ({ ...saveReq(s), draft: true, savedBecause: 'report' }), WRITE_REFUSAL.savedBecauseDraftMismatch],
        ["a won't-play mark on a numbered version", (s) => ({ ...saveReq(s), wontPlay: 'duplicate room name' }), WRITE_REFUSAL.wontPlayNotDraft],
        ["a won't-play mark that is not a reason", (s) => ({ ...saveReq(s), draft: true, savedBecause: 'draft', wontPlay: true }), WRITE_REFUSAL.wontPlayShape],
        ['no substrate', (s) => ({ ...saveReq(s), substrate: '' }), WRITE_REFUSAL.substrateShape],
        ['a source without tab_id', (s) => ({ ...saveReq(s), source: { page: 'p' } }), WRITE_REFUSAL.sourceShape],
        ['a bad lineage id', (s) => ({ ...saveReq(s), lineageId: 5 }), WRITE_REFUSAL.lineageShape],
        ['a bad parent', (s) => ({ ...saveReq(s), parent: 3 }), WRITE_REFUSAL.parentShape],
        ['a member that is not an object', (s) => ({ ...saveReq(s), members: ['x'] }), WRITE_REFUSAL.memberShape],
        ['a member without a role', (s) => ({ ...saveReq(s), members: [{ idKey: 'set_id', doc: s }] }), WRITE_REFUSAL.memberShape],
        ['a member with a bad idKey', (s) => ({ ...saveReq(s), members: [{ role: 'set', idKey: 4, doc: s }] }), WRITE_REFUSAL.idKeyShape],
        ['a member whose doc has no id', (s) => ({ ...saveReq(s), members: [{ role: 'set', idKey: 'nope', doc: s }] }), WRITE_REFUSAL.docIdMissing],
        ['an id-less doc carrying the reserved key', (s) => ({ ...saveReq(s), members: [{ role: 'rules', idKey: null, doc: { [NO_ID_KEY]: 1 } }] }), WRITE_REFUSAL.reservedKey],
        ['a doc with an undefined value', (s) => ({ ...saveReq(s), members: [{ role: 'set', idKey: 'set_id', doc: { set_id: 'a', x: undefined } }] }), WRITE_REFUSAL.notJsonClean],
        ['a doc with a sparse array', (s) => ({ ...saveReq(s), members: [{ role: 'set', idKey: 'set_id', doc: { set_id: 'a', x: [1, , 3] } }] }), WRITE_REFUSAL.notJsonClean], // eslint-disable-line no-sparse-arrays
        ['a doc with a function', (s) => ({ ...saveReq(s), members: [{ role: 'set', idKey: 'set_id', doc: { set_id: 'a', f() {} } }] }), WRITE_REFUSAL.notJsonClean],
        ['a provenance that does not round-trip', (s) => ({ ...saveReq(s), members: [{ role: 'set', idKey: 'set_id', doc: { set_id: 'a', provenance: { x: undefined } } }] }), WRITE_REFUSAL.notJsonClean],
    ];
    for (const [what, make, code] of cases) {
        it(`refuses ${what} (${code})`, async () => {
            const { lib } = makeLib();
            await expect(refusalCode(() => lib.saveVersion(make(setDoc(['r1']))))).resolves.toBe(`LibraryWriteError:${code}`);
        });
    }

    it('an unknown lineage is refused inside the transaction, and nothing is written', async () => {
        const { lib, backend } = makeLib();
        await expect(refusalCode(() => lib.saveVersion({ ...saveReq(setDoc(['r1'])), lineageId: 'never-minted' })))
            .resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.lineageUnknown}`);
        expect(backend.raw('docs').size).toBe(0);
    });

    it('savedBecause accepts exactly the save points, and draft for a draft (⚖ Q1)', async () => {
        expect(SAVE_POINTS).toEqual(['room-close', 'report', 'download', 'handover']);
        const { lib } = makeLib();
        for (const [i, why] of SAVE_POINTS.entries()) {
            const r = await lib.saveVersion({ ...saveReq(setDoc([`r${i}`])), savedBecause: why });
            expect(r.status).toBe('saved');
        }
        const d = await lib.saveVersion({ ...saveReq(setDoc(['d'])), draft: true, savedBecause: 'draft' });
        expect(d.status).toBe('saved');
        expect(d.seq).toBeNull();
    });
});

describe('documentLibrary — js-22: the library makes the canonical string itself', () => {
    it('a member carrying its own canonical is refused by name, even when it is the right string', async () => {
        const { lib } = makeLib();
        const s = setDoc(['r1']);
        const honest = canonicalOf(s, 'set_id');
        const m = { role: 'set', idKey: 'set_id', doc: s, canonical: honest };
        await expect(refusalCode(() => lib.saveVersion({ ...saveReq(s), members: [m] })))
            .resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.memberCarriesCanonical}`);
    });

    it('any string beside the doc is refused by name (a member is exactly {role, idKey, doc})', async () => {
        const { lib } = makeLib();
        const s = setDoc(['r1']);
        for (const extra of [{ body: JSON.stringify(s) }, { contentHash: s.provenance.content_hash }, { json: '{}' }]) {
            const m = { role: 'set', idKey: 'set_id', doc: s, ...extra };
            await expect(refusalCode(() => lib.saveVersion({ ...saveReq(s), members: [m] })))
                .resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.memberUnknownField}`);
        }
    });

    it('a doc whose own declared hash is stale is stored under its COMPUTED hash, the stamp replaced and noted', async () => {
        const { lib } = makeLib();
        const s = setDoc(['r1']);
        const stale = { ...s, rooms: ['r2'], provenance: { ...s.provenance, tool: 'kept' } }; // edited; the stamp still says r1's hash
        const real = computeContentHash(stale, { idKey: 'set_id' });
        const r = await lib.saveVersion(saveReq(stale));
        expect(r.status).toBe('saved');
        expect(r.notes).toEqual([`members[0] (set ${s.set_id}): provenance hash replaced: was "${s.provenance.content_hash}", content is ${real}`]);
        expect(stale.provenance.content_hash).toBe(s.provenance.content_hash); // the caller's object is untouched
        const got = await lib.get({ idKey: 'set_id', docId: s.set_id, contentHash: real });
        expect(got.status).toBe('held');
        expect(got.doc.provenance).toEqual({ content_hash: real, tool: 'kept' });
        expect(got.doc.rooms).toEqual(['r2']);
        expect(await lib.get(getOf(s))).toEqual({ status: 'mismatch', heldHashes: [real] }); // the stale hash serves nothing
        expect((await lib.saveVersion(saveReq(setDoc(['ok'])))).notes).toEqual([]);
    });

    it('the canonical string the library made hashes to computeContentHash, for id-keyed and id-less documents', async () => {
        const { lib, backend } = makeLib();
        const s = setDoc(['r1', { nested: [1, 2, { z: 'ü', a: null }] }]);
        const rules = { b: 2, a: [{ y: 1, x: 0 }], provenance: { tool: 't' } };
        await lib.saveVersion({ ...saveReq(s), members: [{ role: 'set', idKey: 'set_id', doc: s }, { role: 'rules', idKey: null, doc: rules }] });
        const rows = [...backend.raw('docs').values()];
        const bySet = rows.find((r) => r.id_key === 'set_id');
        const byRules = rows.find((r) => r.id_key === null);
        expect(bySet.content_hash).toBe(computeContentHash(s, { idKey: 'set_id' }));
        expect(byRules.content_hash).toBe(computeContentHash(rules, { idKey: NO_ID_KEY }));
        expect(bySet.canonical).toBe(canonicalOf(s, 'set_id'));
        const back = await lib.get({ idKey: null, docId: null, contentHash: byRules.content_hash });
        expect(back.status).toBe('held');
        expect(back.doc).toEqual(rules);
    });

    it('the reader-computed hash is the key: a provenance claiming another hash cannot reach that hash', async () => {
        const { lib } = makeLib();
        const v1 = setDoc(['r1']);
        const v2 = setDoc(['r2']);
        await lib.saveVersion(saveReq(v1));
        // v2 re-labelled with v1's id AND v1's hash in its provenance: keyed by ITS OWN content …
        const forged = { ...v2, set_id: v1.set_id, provenance: { content_hash: v1.provenance.content_hash } };
        const r = await lib.saveVersion(saveReq(forged));
        expect(r.status).toBe('saved');
        expect(r.notes).toHaveLength(1);
        // … so get(v1) still serves v1, byte for byte, and the forgery answers only to its own hash.
        const got = await lib.get(getOf(v1));
        expect(got.doc.rooms).toEqual(['r1']);
        const own = await lib.get({ idKey: 'set_id', docId: v1.set_id, contentHash: computeContentHash(forged, { idKey: 'set_id' }) });
        expect(own.doc.rooms).toEqual(['r2']);
    });

    it('a 32-bit collision (a different body under one id and hash) is refused, not merged', async () => {
        const { lib, backend } = makeLib();
        const v1 = setDoc(['r1']);
        await lib.saveVersion(saveReq(v1));
        const key = docKey('set_id', v1.set_id, v1.provenance.content_hash);
        const row = backend.raw('docs').get(key);
        backend.raw('docs').set(key, { ...row, canonical: `${row.canonical} ` }); // a stand-in for a colliding body
        await expect(refusalCode(() => lib.saveVersion(saveReq(v1))))
            .resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.hashCollision}`);
    });
});

describe('documentLibrary — fingerprint coexistence and the read', () => {
    it('X@H1 and X@H2 are both held; get(X, H1) returns H1, byte-equal', async () => {
        const { lib } = makeLib();
        const h1 = setDoc(['r1']);
        const first = await lib.saveVersion(saveReq(h1));
        // the same set id, edited: the base survives, the content hash moves; stamp with the SAME id to force X@H2
        const h2 = stampIdentity({ ...structuredClone(h1), rooms: ['r1', 'r2'] }, { idKey: 'set_id', defaultBase: 'x', baseId: 'demo-set' });
        const asX = { ...h2, set_id: h1.set_id };
        await lib.saveVersion({ ...saveReq(asX), lineageId: first.lineage_id, parent: first.entry_id });
        const a = await lib.get(getOf(h1));
        const b = await lib.get({ idKey: 'set_id', docId: h1.set_id, contentHash: h2.provenance.content_hash });
        expect(a.status).toBe('held');
        expect(b.status).toBe('held');
        expect(JSON.stringify(a.doc, Object.keys(a.doc).sort())).toBe(JSON.stringify(h1, Object.keys(h1).sort()));
        expect(canonicalOf(a.doc, 'set_id')).toBe(canonicalOf(h1, 'set_id'));
        expect(a.doc).toEqual(h1);
        expect(b.doc.rooms).toEqual(['r1', 'r2']);
    });

    it('a read is a copy: editing what get returned changes nothing stored', async () => {
        const { lib } = makeLib();
        const s = setDoc(['r1']);
        await lib.saveVersion(saveReq(s));
        const a = await lib.get(getOf(s));
        a.doc.rooms.push('x');
        expect((await lib.get(getOf(s))).doc.rooms).toEqual(['r1']);
    });

    it('versions that share an unchanged overlay store it once', async () => {
        const { lib, backend } = makeLib();
        const first = await lib.saveVersion(saveReq(setDoc(['r1'])));
        await lib.saveVersion({ ...saveReq(setDoc(['r2'])), lineageId: first.lineage_id });
        const overlays = [...backend.raw('docs').values()].filter((d) => d.id_key === 'overlay_id');
        expect(overlays).toHaveLength(1);
    });

    it('entry reads list metadata, never bodies; the head is the highest saved seq', async () => {
        const { lib } = makeLib();
        const a = await lib.saveVersion(saveReq(setDoc(['r1'])));
        const b = await lib.saveVersion({ ...saveReq(setDoc(['r2'])), lineageId: a.lineage_id, parent: a.entry_id });
        const e = await lib.getEntry(b.entry_id);
        expect(e.status).toBe('held');
        expect(e.entry.parent).toBe(a.entry_id);
        expect(e.entry.members.map((m) => m.role)).toEqual(['set', 'overlay', 'rules']);
        expect(JSON.stringify(e)).not.toContain('canonical');
        expect(JSON.stringify(e)).not.toContain('"rooms"');
        const ls = await lib.lineages();
        expect(ls.lineages.map((l) => l.head)).toEqual([b.entry_id]);
        expect((await lib.entriesOf(a.lineage_id)).entries.map((x) => x.seq)).toEqual([1, 2]);
        expect(await lib.getEntry('nope#1')).toEqual({ status: 'absent' });
    });
});

describe('documentLibrary — seq under interleaved writers', () => {
    it('two libraries on one backend (two tabs) saving interleaved get distinct, increasing seqs', async () => {
        const backend = createMemoryBackend();
        const A = makeLib(backend, { prefix: 'a' }).lib;
        const B = makeLib(backend, { prefix: 'b' }).lib;
        const root = await A.saveVersion(saveReq(setDoc(['r0'])));
        const writes = [];
        for (let i = 1; i <= 6; i += 1) {
            const lib = i % 2 ? A : B;
            writes.push(lib.saveVersion({ ...saveReq(setDoc([`r${i}`])), lineageId: root.lineage_id, parent: root.entry_id, source: i % 2 ? SOURCE_A : SOURCE_B }));
        }
        const results = await Promise.all(writes);
        const seqs = results.map((r) => r.seq);
        expect(new Set(seqs).size).toBe(seqs.length);
        expect([...seqs].sort((x, y) => x - y)).toEqual(seqs); // asked-for order = commit order
        expect(Math.min(...seqs)).toBe(root.seq + 1);
        const lineage = (await A.lineages()).lineages[0];
        expect(lineage.next_seq).toBe(Math.max(...seqs) + 1);
        expect(lineage.head).toBe(`${root.lineage_id}#${Math.max(...seqs)}`);
    });

    it('a fork: two tabs saving from the same parent both keep their versions', async () => {
        const backend = createMemoryBackend();
        const A = makeLib(backend, { prefix: 'a' }).lib;
        const B = makeLib(backend, { prefix: 'b' }).lib;
        const v3 = await A.saveVersion(saveReq(setDoc(['base'])));
        const [x, y] = await Promise.all([
            A.saveVersion({ ...saveReq(setDoc(['fromA'])), lineageId: v3.lineage_id, parent: v3.entry_id }),
            B.saveVersion({ ...saveReq(setDoc(['fromB'])), lineageId: v3.lineage_id, parent: v3.entry_id, source: SOURCE_B }),
        ]);
        expect([x.seq, y.seq]).toEqual([2, 3]);
        expect((await A.getEntry(y.entry_id)).entry.parent).toBe(v3.entry_id);
    });
});

describe('documentLibrary — drafts', () => {
    const draftReq = (set, lineageId, source = SOURCE_A, extra = {}) => ({ ...saveReq(set), lineageId, draft: true, savedBecause: 'draft', source, ...extra });

    it('one rolling draft per tab: a new draft replaces the previous one; another tab keeps its own', async () => {
        const { lib } = makeLib();
        const v1 = await lib.saveVersion(saveReq(setDoc(['r1'])));
        const d1 = await lib.saveVersion(draftReq(setDoc(['d1']), v1.lineage_id));
        const d2 = await lib.saveVersion(draftReq(setDoc(['d2']), v1.lineage_id));
        const db = await lib.saveVersion(draftReq(setDoc(['dB']), v1.lineage_id, SOURCE_B));
        expect(d2.collapsed).toEqual([d1.entry_id]);
        const drafts = (await lib.entriesOf(v1.lineage_id)).entries.filter((e) => e.draft).map((e) => e.entry_id);
        expect(drafts).toEqual([d2.entry_id, db.entry_id]);
        expect((await lib.get(getOf(setDoc(['d1'])))).status).toBe('absent'); // its body went with it
        expect((await lib.get(getOf(setDoc(['d2'])))).status).toBe('held');
    });

    it('a save point collapses THIS tab\'s draft into the version; the other tab\'s draft stays', async () => {
        const { lib } = makeLib();
        const v1 = await lib.saveVersion(saveReq(setDoc(['r1'])));
        const dA = await lib.saveVersion(draftReq(setDoc(['dA']), v1.lineage_id));
        const dB = await lib.saveVersion(draftReq(setDoc(['dB']), v1.lineage_id, SOURCE_B));
        const v2 = await lib.saveVersion({ ...saveReq(setDoc(['dA'])), lineageId: v1.lineage_id, parent: v1.entry_id, savedBecause: 'room-close' });
        expect(v2.collapsed).toEqual([dA.entry_id]);
        const ids = (await lib.entriesOf(v1.lineage_id)).entries.map((e) => e.entry_id);
        expect(ids).toEqual([v1.entry_id, v2.entry_id, dB.entry_id]);
        expect((await lib.get(getOf(setDoc(['dA'])))).status).toBe('held'); // the body lives on in v2
    });

    it('a HELD draft is kept through a replacement and through a save point', async () => {
        const { lib } = makeLib();
        const v1 = await lib.saveVersion(saveReq(setDoc(['r1'])));
        const d1 = await lib.saveVersion(draftReq(setDoc(['d1']), v1.lineage_id));
        const pin = await lib.hold(d1.entry_id, { kind: 'pin', tab_id: 'app1', what: 'a world built from it' });
        expect(pin.status).toBe('held');
        const d2 = await lib.saveVersion(draftReq(setDoc(['d2']), v1.lineage_id));
        expect(d2.collapsed).toEqual([]);
        const v2 = await lib.saveVersion({ ...saveReq(setDoc(['d2'])), lineageId: v1.lineage_id, savedBecause: 'report' });
        expect(v2.collapsed).toEqual([d2.entry_id]);
        expect((await lib.getEntry(d1.entry_id)).status).toBe('held');
        expect((await lib.get(getOf(setDoc(['d1'])))).status).toBe('held');
        await lib.release(pin.hold_id);
        const v3 = await lib.saveVersion({ ...saveReq(setDoc(['v3'])), lineageId: v1.lineage_id, savedBecause: 'download' });
        expect(v3.collapsed).toEqual([d1.entry_id]);
    });

    it("the won't-play mark (⚖ Q2): a draft carries wont_play and every read reports it", async () => {
        const { lib } = makeLib();
        const bad = setDoc(['dup', 'dup']);
        const d = await lib.saveVersion({ ...saveReq(bad), draft: true, savedBecause: 'draft', wontPlay: 'two rooms share a name' });
        expect(d.status).toBe('saved');
        expect((await lib.getEntry(d.entry_id)).entry.wont_play).toEqual({ why: 'two rooms share a name' });
        expect((await lib.entriesOf(d.lineage_id)).entries[0].wont_play).toEqual({ why: 'two rooms share a name' });
        const got = await lib.get(getOf(bad));
        expect(got.entries).toEqual([{ entry_id: d.entry_id, draft: true, wont_play: { why: 'two rooms share a name' }, seq: null }]);
        const ok = await lib.saveVersion({ ...saveReq(setDoc(['fine'])), lineageId: d.lineage_id });
        expect((await lib.getEntry(ok.entry_id)).entry.wont_play).toBeNull();
    });
});

describe('documentLibrary — holds and cleanup (⚖ Q3: last 10 + in use; ⚖ Q4: downloads like any other)', () => {
    async function lineageOf(lib, count, why = () => 'report') {
        const first = await lib.saveVersion(saveReq(setDoc(['v1'])));
        const out = [first];
        for (let i = 2; i <= count; i += 1) {
            out.push(await lib.saveVersion({ ...saveReq(setDoc([`v${i}`])), lineageId: first.lineage_id, parent: out.at(-1).entry_id, savedBecause: why(i) }));
        }
        return out;
    }

    it(`keeps the last ${KEEP_SAVED_PER_LINEAGE} saved seqs per lineage and the head; older ones and their bodies go`, async () => {
        const { lib } = makeLib();
        const all = await lineageOf(lib, KEEP_SAVED_PER_LINEAGE + 3, (i) => (i % 2 ? 'download' : 'report'));
        const seqs = (await lib.entriesOf(all[0].lineage_id)).entries.map((e) => e.seq);
        const total = KEEP_SAVED_PER_LINEAGE + 3;
        expect(seqs).toEqual(Array.from({ length: KEEP_SAVED_PER_LINEAGE }, (_, i) => total - KEEP_SAVED_PER_LINEAGE + 1 + i));
        expect((await lib.get(getOf(setDoc(['v1'])))).status).toBe('absent');
        expect((await lib.get(getOf(setDoc([`v${total}`])))).status).toBe('held');
        expect((await lib.lineages()).lineages[0].head).toBe(all.at(-1).entry_id);
        // the shared overlay is still named by the kept versions, so it stays
        const ov = overlayDoc();
        expect((await lib.get({ idKey: 'overlay_id', docId: ov.overlay_id, contentHash: ov.provenance.content_hash })).status).toBe('held');
    });

    it('a downloaded version gets no special retention (⚖ Q4)', async () => {
        const { lib } = makeLib();
        const all = await lineageOf(lib, KEEP_SAVED_PER_LINEAGE + 1, (i) => (i === 2 ? 'download' : 'report'));
        expect((await lib.getEntry(all[1].entry_id)).status).toBe('held'); // seq 2 is the oldest kept
        await lib.saveVersion({ ...saveReq(setDoc(['more'])), lineageId: all[0].lineage_id, savedBecause: 'report' });
        expect((await lib.getEntry(all[1].entry_id)).status).toBe('absent');
    });

    it('an entry with a live hold is never deleted, however old; a stale one is', async () => {
        const { lib, clock } = makeLib();
        const all = await lineageOf(lib, 2);
        const game = await lib.hold(all[0].entry_id, { kind: 'game', tab_id: 'app1', what: 'running game' });
        for (let i = 3; i <= KEEP_SAVED_PER_LINEAGE + 4; i += 1) {
            await lib.saveVersion({ ...saveReq(setDoc([`v${i}`])), lineageId: all[0].lineage_id, savedBecause: 'report' });
        }
        expect((await lib.getEntry(all[0].entry_id)).status).toBe('held');
        expect((await lib.getEntry(all[1].entry_id)).status).toBe('absent');
        clock.advance(HOLD_STALE_MS - 1);
        expect((await lib.cleanup({ now: clock.now() })).deletedEntries).toEqual([]);
        clock.advance(1);
        const c = await lib.cleanup({ now: clock.now() });
        expect(c.deletedEntries).toEqual([all[0].entry_id]);
        expect(c.deletedDocs).toEqual([docKey('set_id', setDoc(['v1']).set_id, setDoc(['v1']).provenance.content_hash)]);
        expect(await lib.heartbeat(game.hold_id)).toEqual({ status: 'gone' });
    });

    it('a game hold whose last heartbeat is nine minutes old (a throttled hidden tab) is still live, and kept', async () => {
        const { lib, clock } = makeLib();
        expect(HOLD_STALE_MS).toBeGreaterThanOrEqual(10 * 60_000);
        const all = await lineageOf(lib, KEEP_SAVED_PER_LINEAGE + 1);
        await lib.hold(all[1].entry_id, { kind: 'game', tab_id: 'hidden-tab' });
        await lib.saveVersion({ ...saveReq(setDoc(['z'])), lineageId: all[0].lineage_id, savedBecause: 'report' });
        clock.advance(9 * 60_000);
        expect((await lib.cleanup({ now: clock.now() })).deletedEntries).toEqual([]);
        expect((await lib.getEntry(all[1].entry_id)).status).toBe('held');
    });

    it('a pin hold is durable without heartbeats until released', async () => {
        const { lib, clock } = makeLib();
        const all = await lineageOf(lib, KEEP_SAVED_PER_LINEAGE + 1);
        const pin = await lib.hold(all[1].entry_id, { kind: 'pin', tab_id: 'app1' });
        await lib.saveVersion({ ...saveReq(setDoc(['x'])), lineageId: all[0].lineage_id, savedBecause: 'report' });
        clock.advance(HOLD_STALE_MS * 100);
        expect((await lib.cleanup({ now: clock.now() })).deletedEntries).toEqual([]);
        expect(await lib.release(pin.hold_id)).toEqual({ status: 'released' });
        expect(await lib.release(pin.hold_id)).toEqual({ status: 'absent' });
        expect((await lib.cleanup({ now: clock.now() })).deletedEntries).toEqual([all[1].entry_id]);
    });

    it('the late-heartbeat interleaving: a heartbeat that commits before cleanup keeps the entry', async () => {
        const { lib, clock } = makeLib();
        const all = await lineageOf(lib, KEEP_SAVED_PER_LINEAGE + 1);
        // all[0] fell out of the last 10 already — it is held, so it was kept. Make the hold go nearly stale.
        const h = await lib.hold(all[1].entry_id, { kind: 'world', tab_id: 'app2' });
        await lib.saveVersion({ ...saveReq(setDoc(['y'])), lineageId: all[0].lineage_id, savedBecause: 'report' });
        clock.advance(HOLD_STALE_MS + 5);
        // both asked for at once: the heartbeat was asked first, so it commits first and cleanup re-reads it live
        const [hb, c] = await Promise.all([lib.heartbeat(h.hold_id), lib.cleanup({ now: clock.now() })]);
        expect(hb).toEqual({ status: 'live' });
        expect(c.deletedEntries).toEqual([]);
        // the other order: cleanup first sees it stale and deletes; the late heartbeat finds the hold gone
        clock.advance(HOLD_STALE_MS + 5);
        const [c2, hb2] = await Promise.all([lib.cleanup({ now: clock.now() }), lib.heartbeat(h.hold_id)]);
        expect(c2.deletedEntries).toEqual([all[1].entry_id]);
        expect(hb2).toEqual({ status: 'gone' });
        expect((await lib.get(getOf(setDoc(['v2'])))).status).toBe('absent');
    });

    it('a doc shared with a kept version survives its old version being deleted', async () => {
        const { lib } = makeLib();
        const shared = setDoc(['shared']);
        const first = await lib.saveVersion(saveReq(shared));
        for (let i = 2; i <= KEEP_SAVED_PER_LINEAGE; i += 1) {
            await lib.saveVersion({ ...saveReq(setDoc([`v${i}`])), lineageId: first.lineage_id, savedBecause: 'report' });
        }
        // a second lineage names the same set document
        await lib.saveVersion(saveReq(shared));
        await lib.saveVersion({ ...saveReq(setDoc(['last'])), lineageId: first.lineage_id, savedBecause: 'report' });
        expect((await lib.getEntry(first.entry_id)).status).toBe('absent');
        expect((await lib.get(getOf(shared))).status).toBe('held');
    });

    it('cleanup never deletes a head, a lineage, or a draft younger than DRAFT_MAX_AGE_MS', async () => {
        expect(HOLD_STALE_MS * 1000).toBeLessThan(DRAFT_MAX_AGE_MS); // the clock below stays inside the draft window
        const { lib, clock } = makeLib();
        const one = await lib.saveVersion(saveReq(setDoc(['solo'])));
        const d = await lib.saveVersion({ ...saveReq(setDoc(['dr'])), lineageId: one.lineage_id, draft: true, savedBecause: 'draft', source: SOURCE_B });
        clock.advance(HOLD_STALE_MS * 1000);
        expect(await lib.cleanup({ now: clock.now() })).toEqual({ status: 'cleaned', deletedEntries: [], deletedDocs: [] });
        expect((await lib.getEntry(one.entry_id)).status).toBe('held');
        expect((await lib.getEntry(d.entry_id)).status).toBe('held');
        expect((await lib.lineages()).lineages).toHaveLength(1);
    });

    it('hold refuses by name and answers absent for a missing entry', async () => {
        const { lib } = makeLib();
        await expect(refusalCode(() => lib.hold('x#1', { kind: 'forever', tab_id: 't' }))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.holderKindUnknown}`);
        await expect(refusalCode(() => lib.hold('x#1', { kind: 'pin' }))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.holderShape}`);
        await expect(refusalCode(() => lib.hold('', { kind: 'pin', tab_id: 't' }))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.entryIdShape}`);
        await expect(refusalCode(() => lib.heartbeat(''))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.holdIdShape}`);
        await expect(refusalCode(() => lib.cleanup({}))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.nowShape}`);
        expect(await lib.hold('x#1', { kind: 'pin', tab_id: 't' })).toEqual({ status: 'absent' });
        expect(new LibraryWriteError('c', 'd').name).toBe('LibraryWriteError');
    });

    it('estimate counts the stores and the body bytes', async () => {
        const { lib } = makeLib();
        await lib.saveVersion(saveReq(setDoc(['r1'])));
        const e = await lib.estimate();
        expect(e.status).toBe('ok');
        expect(e.counts).toEqual({ docs: 3, entries: 1, lineages: 1, holds: 0 });
        expect(e.bodyBytes).toBeGreaterThan(0);
    });
});

describe('documentLibrary — B2: deleteLineage, deleteDrafts, inventory (the Storage panel\'s calls)', () => {
    const draftReq = (lid, set, source = SOURCE_A) => ({ ...saveReq(set), lineageId: lid, draft: true, savedBecause: 'draft', source });
    const setKey = (d) => docKey('set_id', d.set_id, d.provenance.content_hash);
    const ovKey = () => { const o = overlayDoc(); return docKey('overlay_id', o.overlay_id, o.provenance.content_hash); };

    it('deleteLineage on an unheld lineage removes its entries, its lineage and its unnamed docs; a doc another lineage names is KEPT', async () => {
        const { lib, backend } = makeLib();
        const a1 = await lib.saveVersion(saveReq(setDoc(['a1'])));
        await lib.saveVersion({ ...saveReq(setDoc(['a2'])), lineageId: a1.lineage_id });
        await lib.saveVersion(draftReq(a1.lineage_id, setDoc(['a-draft'])));
        const b1 = await lib.saveVersion(saveReq(setDoc(['b1']))); // shares the overlay
        const r = await lib.deleteLineage(a1.lineage_id);
        expect(r.status).toBe('deleted');
        expect(r.deletedEntries).toHaveLength(3);
        // the overlay and the rules are named by lineage b too, so only a's three set bodies go
        expect([...r.deletedDocs].sort()).toEqual([setKey(setDoc(['a1'])), setKey(setDoc(['a2'])), setKey(setDoc(['a-draft']))].sort());
        expect(backend.raw('docs').has(docKey(null, null, computeContentHash(rulesDoc(), { idKey: NO_ID_KEY })))).toBe(true);
        expect((await lib.lineages()).lineages.map((l) => l.lineage_id)).toEqual([b1.lineage_id]);
        expect((await lib.get(getOf(setDoc(['b1'])))).status).toBe('held');
        expect(backend.raw('docs').has(ovKey())).toBe(true);
        expect((await lib.get(getOf(setDoc(['a1'])))).status).toBe('absent');
        expect(await lib.deleteLineage(a1.lineage_id)).toEqual({ status: 'absent' });
    });

    it('deleteLineage is REFUSED by name while any entry has a live hold (a game hold, a pin), from any tab; nothing is deleted', async () => {
        const { lib, clock } = makeLib();
        const a1 = await lib.saveVersion(saveReq(setDoc(['h1'])));
        const a2 = await lib.saveVersion({ ...saveReq(setDoc(['h2'])), lineageId: a1.lineage_id });
        const game = await lib.hold(a1.entry_id, { kind: 'game', tab_id: 'otherTab', what: 'running game' });
        const r = await lib.deleteLineage(a1.lineage_id);
        expect(r).toEqual({ status: 'refused', why: 'held', lineage_id: a1.lineage_id, label: 'Demo',
            heldBy: [{ hold_id: game.hold_id, entry_id: a1.entry_id, kind: 'game', tab_id: 'otherTab', what: 'running game' }] });
        expect((await lib.entriesOf(a1.lineage_id)).entries).toHaveLength(2);
        // stale → deletable; a pin is live without heartbeats
        clock.advance(HOLD_STALE_MS);
        const pin = await lib.hold(a2.entry_id, { kind: 'pin', tab_id: 'pinTab' });
        expect((await lib.deleteLineage(a1.lineage_id)).heldBy.map((h) => h.kind)).toEqual(['pin']);
        await lib.release(pin.hold_id);
        const d = await lib.deleteLineage(a1.lineage_id);
        expect(d.status).toBe('deleted');
        expect(await lib.heartbeat(game.hold_id)).toEqual({ status: 'gone' }); // the stale hold went with it
    });

    it('deleteDrafts removes every unheld draft and its unnamed docs, keeps held drafts (named), versions and lineages', async () => {
        const { lib } = makeLib();
        const a1 = await lib.saveVersion(saveReq(setDoc(['v'])));
        const dA = await lib.saveVersion(draftReq(a1.lineage_id, setDoc(['dA'])));
        const dB = await lib.saveVersion(draftReq(a1.lineage_id, setDoc(['dB']), SOURCE_B));
        const b1 = await lib.saveVersion(saveReq(setDoc(['w'])));
        const dC = await lib.saveVersion(draftReq(b1.lineage_id, setDoc(['v']), SOURCE_B)); // names a version's doc
        const pin = await lib.hold(dB.entry_id, { kind: 'pin', tab_id: 'builder' });
        const r = await lib.deleteDrafts();
        expect(r.status).toBe('deleted');
        expect(r.deletedEntries).toEqual([dA.entry_id, dC.entry_id].sort());
        expect(r.kept).toEqual([{ hold_id: pin.hold_id, entry_id: dB.entry_id, kind: 'pin', tab_id: 'builder', what: null }]);
        expect(r.deletedDocs).toEqual([setKey(setDoc(['dA']))]);
        expect((await lib.get(getOf(setDoc(['v'])))).status).toBe('held');
        expect((await lib.lineages()).lineages).toHaveLength(2);
        expect((await lib.getEntry(a1.entry_id)).status).toBe('held');
        // scoped to one lineage
        await lib.release(pin.hold_id);
        const dB2 = await lib.saveVersion(draftReq(b1.lineage_id, setDoc(['x'])));
        expect((await lib.deleteDrafts({ lineageId: a1.lineage_id })).deletedEntries).toEqual([dB.entry_id]);
        expect((await lib.getEntry(dB2.entry_id)).status).toBe('held');
    });

    it('deleteLineage / deleteDrafts / inventory answer unavailable, refuse bad arguments by name', async () => {
        const { lib, backend } = makeLib();
        await expect(refusalCode(() => lib.deleteLineage(''))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.lineageShape}`);
        await expect(refusalCode(() => lib.deleteDrafts({ lineageId: 3 }))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.lineageShape}`);
        await expect(refusalCode(() => lib.deleteDrafts('all'))).resolves.toBe(`LibraryWriteError:${WRITE_REFUSAL.optionsShape}`);
        backend.unavailable('no indexedDB in this browser context');
        const want = { status: 'unavailable', why: 'no indexedDB in this browser context' };
        expect(await lib.deleteLineage('L')).toEqual(want);
        expect(await lib.deleteDrafts()).toEqual(want);
        expect(await lib.inventory()).toEqual(want);
    });

    it('a refused commit (quota) answers failed and deletes nothing', async () => {
        const { lib, backend } = makeLib();
        const a1 = await lib.saveVersion(saveReq(setDoc(['q'])));
        backend.failNextCommit(Object.assign(new Error('full'), { name: 'QuotaExceededError' }));
        expect((await lib.deleteLineage(a1.lineage_id)).status).toBe('failed');
        expect((await lib.getEntry(a1.entry_id)).status).toBe('held');
    });

    it('inventory lists each lineage with versions, drafts, old drafts, distinct bytes and LIVE holds of any tab', async () => {
        const { lib, clock } = makeLib();
        const a1 = await lib.saveVersion(saveReq(setDoc(['i1'])));
        await lib.saveVersion({ ...saveReq(setDoc(['i2'])), lineageId: a1.lineage_id });
        const d = await lib.saveVersion(draftReq(a1.lineage_id, setDoc(['i-draft'])));
        const g = await lib.hold(a1.entry_id, { kind: 'game', tab_id: 'tab2', what: 'play' });
        const inv = await lib.inventory();
        expect(inv.status).toBe('ok');
        const [row] = inv.lineages;
        expect(row).toMatchObject({ lineage_id: a1.lineage_id, label: 'Demo', versions: 2, drafts: 1, oldDrafts: 0 });
        expect(row.liveHolds).toEqual([{ hold_id: g.hold_id, entry_id: a1.entry_id, kind: 'game', tab_id: 'tab2', what: 'play' }]);
        expect(row.bytes).toBe((await lib.estimate()).bodyBytes); // one lineage: every doc, each counted once
        clock.advance(DRAFT_MAX_AGE_MS);
        const later = (await lib.inventory()).lineages[0];
        expect(later.liveHolds).toEqual([]); // the game hold is stale now
        expect(later.oldDrafts).toBe(1);
        expect(d.status).toBe('saved');
    });
});

describe('documentLibrary — ⚖ Q2: cleanup deletes a DRAFT older than DRAFT_MAX_AGE_MS (7 days), never a numbered version', () => {
    const draftReq = (lid, set, source = SOURCE_A) => ({ ...saveReq(set), lineageId: lid, draft: true, savedBecause: 'draft', source });
    const setKey = (d) => docKey('set_id', d.set_id, d.provenance.content_hash);

    it('the window is seven days', () => {
        expect(DRAFT_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('a draft at 7 days − 1 ms is kept; at 7 days + 1 ms it is deleted with its unnamed docs, shared docs kept', async () => {
        const { lib, clock, backend } = makeLib();
        const v = await lib.saveVersion(saveReq(setDoc(['base'])));
        const t0 = clock.now();
        const d = await lib.saveVersion(draftReq(v.lineage_id, setDoc(['dead-tab'])));
        expect((await lib.cleanup({ now: t0 + DRAFT_MAX_AGE_MS - 1 })).deletedEntries).toEqual([]);
        const c = await lib.cleanup({ now: t0 + DRAFT_MAX_AGE_MS + 1 });
        expect(c.deletedEntries).toEqual([d.entry_id]);
        expect(c.deletedDocs).toEqual([setKey(setDoc(['dead-tab']))]); // overlay + rules are named by the version
        expect(backend.raw('docs').size).toBe(3);
        expect((await lib.getEntry(v.entry_id)).status).toBe('held');
        expect((await lib.lineages()).lineages).toHaveLength(1); // the lineage stays (a writer may still save into it)
    });

    it('an old HELD draft is kept (a pin; a heartbeating game hold from another tab)', async () => {
        const { lib, clock } = makeLib();
        const v = await lib.saveVersion(saveReq(setDoc(['b'])));
        const d1 = await lib.saveVersion(draftReq(v.lineage_id, setDoc(['p'])));
        const d2 = await lib.saveVersion(draftReq(v.lineage_id, setDoc(['g']), SOURCE_B));
        await lib.hold(d1.entry_id, { kind: 'pin', tab_id: 'x' });
        const g = await lib.hold(d2.entry_id, { kind: 'game', tab_id: 'tabB' });
        clock.advance(DRAFT_MAX_AGE_MS + 1);
        await lib.heartbeat(g.hold_id);
        expect((await lib.cleanup({ now: clock.now() })).deletedEntries).toEqual([]);
        clock.advance(HOLD_STALE_MS); // the game hold goes stale; the pin stays durable
        expect((await lib.cleanup({ now: clock.now() })).deletedEntries).toEqual([d2.entry_id]);
    });

    it('an old numbered version and the head are kept; another lineage\'s young draft is kept', async () => {
        const { lib, clock } = makeLib();
        const v1 = await lib.saveVersion(saveReq(setDoc(['n1'])));
        const v2 = await lib.saveVersion({ ...saveReq(setDoc(['n2'])), lineageId: v1.lineage_id });
        const old = await lib.saveVersion(draftReq(v1.lineage_id, setDoc(['old'])));
        clock.advance(DRAFT_MAX_AGE_MS * 3);
        const other = await lib.saveVersion(saveReq(setDoc(['o1'])));
        const young = await lib.saveVersion(draftReq(other.lineage_id, setDoc(['young']), SOURCE_B));
        const c = await lib.cleanup({ now: clock.now() + 1 });
        expect(c.deletedEntries).toEqual([old.entry_id]);
        for (const e of [v1, v2, other, young]) expect((await lib.getEntry(e.entry_id)).status).toBe('held');
        expect((await lib.lineages()).lineages.find((l) => l.lineage_id === v1.lineage_id).head).toBe(v2.entry_id);
    });

    it('a save in the lineage runs the same rule (B3\'s writers clean on save)', async () => {
        const { lib, clock } = makeLib();
        const v = await lib.saveVersion(saveReq(setDoc(['s1'])));
        const d = await lib.saveVersion(draftReq(v.lineage_id, setDoc(['sd']), SOURCE_B));
        clock.advance(DRAFT_MAX_AGE_MS);
        const s = await lib.saveVersion({ ...saveReq(setDoc(['s2'])), lineageId: v.lineage_id });
        expect(s.deleted).toEqual([d.entry_id]);
    });
});

describe('documentLibrary — the memory backend keeps IndexedDB\'s transaction semantics', () => {
    it('a throw inside a transaction discards every write it made', async () => {
        const b = createMemoryBackend();
        await expect(b.transaction(['lineages'], 'readwrite', async (tx) => {
            await tx.put('lineages', { lineage_id: 'L' });
            throw new Error('boom');
        })).rejects.toThrow('boom');
        expect(b.raw('lineages').size).toBe(0);
    });

    it('a readonly transaction cannot write, and a store outside the scope is refused', async () => {
        const b = createMemoryBackend();
        await expect(b.transaction(['lineages'], 'readonly', (tx) => tx.put('lineages', { lineage_id: 'L' }))).rejects.toThrow(/ReadOnlyError/);
        await expect(b.transaction(['lineages'], 'readwrite', (tx) => tx.get('docs', 'k'))).rejects.toThrow(/NotFoundError/);
    });
});

/* ── source pins ─────────────────────────────────────────────────────────── */

const LIBRARY_FILES = ['documentLibrary.js', 'documentLibraryMemory.js', 'documentLibraryIdb.js'];

describe('documentLibrary — source pins', () => {
    it('the three library files are game-neutral (no game, substrate-runtime or lab-page word)', () => {
        const hits = [];
        for (const f of LIBRARY_FILES) {
            const text = readFileSync(join(HERE, f), 'latin1');
            for (const [i, line] of text.split('\n').entries()) {
                if (/seedling|maze|flash|watch/i.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
            }
        }
        expect(hits).toEqual([]);
    });

    it('documentLibrary.js imports only contentIdentity.js; the backends only the library', () => {
        const importsOf = (f) => [...readFileSync(join(HERE, f), 'latin1').matchAll(/^\s*import\b[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
        expect(importsOf('documentLibrary.js')).toEqual(['./contentIdentity.js']);
        expect(importsOf('documentLibraryMemory.js')).toEqual(['./documentLibrary.js']);
        expect(importsOf('documentLibraryIdb.js')).toEqual(['./documentLibrary.js']);
    });

    it('only documentLibraryIdb.js opens an IndexedDB database in the app\'s own sources', () => {
        const submodules = [...readFileSync(join(REPO, '.gitmodules'), 'latin1').matchAll(/^\s*path\s*=\s*(.+)$/gm)]
            .map((m) => join(REPO, m[1].trim()));
        const skip = new Set(['node_modules', 'libs', 'dist', 'external', '.git']);
        const found = [];
        const walk = (dir) => {
            for (const name of readdirSync(dir)) {
                const p = join(dir, name);
                if (skip.has(name) || submodules.includes(p)) continue;
                const st = statSync(p);
                if (st.isDirectory()) { walk(p); continue; }
                if (!/\.(m?js|ts|html)$/.test(name) || /\.test\.m?js$/.test(name)) continue;
                // NUL-bearing sources are read as bytes (latin1), so the census cannot skip one
                if (/indexedDB\s*\.\s*open\s*\(|\bfactory\.open\s*\(/.test(readFileSync(p, 'latin1'))) found.push(relative(FRONTEND, p));
            }
        };
        walk(FRONTEND);
        expect(found.sort()).toEqual([
            // pre-existing: the standalone bounce demo page caches the original SWF it fetched (its own DB, its own page)
            'modules/bounceDemo/djReal/index.html',
            'modules/procgenCore/documentLibraryIdb.js',
        ]);
    });

    it('nothing outside the library\'s own tests, its in-app row, the Storage panel and the Seedling lab writer imports the library', () => {
        const users = [];
        const walk = (dir) => {
            for (const name of readdirSync(dir)) {
                const p = join(dir, name);
                if (['node_modules', 'libs', 'dist', 'external', '.git'].includes(name)) continue;
                const st = statSync(p);
                if (st.isDirectory()) { walk(p); continue; }
                if (!/\.(m?js|ts|html)$/.test(name)) continue;
                // an IMPORT (static `from '…'` or a dynamic `import(…)`), not a mention in a comment
                if (/(?:\bfrom\s+|\bimport\s*\()[^;\n]*documentLibrary(?:Memory|Idb)?\.js/.test(readFileSync(p, 'latin1'))) users.push(relative(FRONTEND, p));
            }
        };
        walk(FRONTEND);
        expect(users.sort()).toEqual([
            'modules/procgenCore/documentLibrary.test.js',
            'modules/procgenCore/documentLibraryIdb.js',
            'modules/procgenCore/documentLibraryMemory.js',
            // B3: the Seedling lab's writer (the page imports it dynamically at the first save; the engine runs in its worker)
            'modules/seedlingDemo/watchLibrary.js',
            'modules/seedlingDemo/watchLibraryCore.js',
            'modules/seedlingDemo/watchLibraryCore.test.js',
            'modules/seedlingDemo/watchLibraryEngine.js',
            // B2: the Storage panel reads it by a document-relative dynamic import (it stays out of the bundle)
            'modules/storagePanel/storagePanelUI.js',
            'modules/tests/testCases/documentLibraryTests.js',
        ]);
    });
});
