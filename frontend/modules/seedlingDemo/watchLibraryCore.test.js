/**
 * Document library B3 — the Seedling lab's writer, its decisions (`watchLibraryCore.js`), what a save
 * holds (`watchLibraryMembers.js`) and the two together over the memory backend (`watchLibraryEngine.js`).
 * The browser half (the worker, the presses, reload, two tabs, the banner) is `scripts/procgen/check-seedling-lab-library.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { SET_CHANGE_WHY } from '../procgenCore/setEditorView.js';
import {
    createDocumentLibrary, DEFAULT_LIBRARY_DB_NAME, LibraryReadError, SAVE_POINTS, WRITE_REFUSAL,
} from '../procgenCore/documentLibrary.js';
import { createMemoryBackend } from '../procgenCore/documentLibraryMemory.js';
import { computeContentHash } from '../procgenCore/contentIdentity.js';
import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { buildLevelSet } from './levelSetExporter.js';
import { emptyLevel } from './procgenLevel.js';
import { emptyOverlay } from './seedlingSetOverlay.js';
import { createSetSession, downloadSet, setRecord } from './seedlingSetAdapter.js';
import { levelSetContentHash } from '../procgenCore/levelSetReference.js';
import {
    classifyWhy, createDraftScheduler, createSaveQueue, DRAFT_WHY, libraryDbNameOf, LIBRARY_PAGE,
    NO_SAVE_WHY, openPlanOf, readRefusalOf, recentRowsOf, SAVE_POINT_OF_WHY, statusLineOf,
    createLeaveGuard, createPersistOnce, leaveWarningHandler, PERSIST_LINES,
} from './watchLibraryCore.js';
import { createLibraryEngine } from './watchLibraryEngine.js';
import { librarySaveOf, membersContextOf } from './watchLibraryMembers.js';

const SOURCE = Object.freeze({ page: LIBRARY_PAGE, tab_id: 'tab-a' });

/** A small generated set (as the set editor's own rows build one) and its record. */
const generatedSet = (n = 4, setId = 'watch-library-test') => buildLevelSet(
    Array.from({ length: n }, (_, level) => emptyLevel({ level })), { setId, link: true },
).set;
const recordOf = (set = generatedSet()) => setRecord(set, emptyOverlay());
const ctx = membersContextOf({ rulesSchema: loadRulesSchema(), atlasSchema: loadAtlasSchema() });
const sessionOver = (record) => createSetSession(ctx.adapter, record, { base: { kind: 'set', set_id: record.set.set_id } });

/** A fake member builder: one doc whose content is the record's `n`, with the plan the row asks for. */
const fakeMembers = (plan = {}) => (record, kind) => ({
    draft: kind === 'draft' || Boolean(plan.wontPlay),
    wontPlay: plan.wontPlay ?? null,
    label: 'a set',
    members: [{ role: 'set', idKey: 'set_id', doc: { set_id: `s-${record.n}`, n: record.n } }],
});

describe('which press saves what (⚖ Q1 "Save points")', () => {
    it('maps exactly Robert\'s four save points to the library\'s saved_because, and an edit to the draft', () => {
        expect(SAVE_POINT_OF_WHY).toEqual({ close: 'room-close', report: 'report', download: 'download', handoff: 'handover' });
        expect(new Set(Object.values(SAVE_POINT_OF_WHY))).toEqual(new Set(SAVE_POINTS));
        expect(classifyWhy('close')).toEqual({ kind: 'version', savedBecause: 'room-close' });
        expect(classifyWhy('report')).toEqual({ kind: 'version', savedBecause: 'report' });
        expect(classifyWhy('download')).toEqual({ kind: 'version', savedBecause: 'download' });
        expect(classifyWhy('handoff')).toEqual({ kind: 'version', savedBecause: 'handover' });
        expect(classifyWhy(DRAFT_WHY)).toEqual({ kind: 'draft' });
    });

    it('select and room write nothing, and every why setEditorView sends is classified (none is new to the writer)', () => {
        for (const why of NO_SAVE_WHY) expect(classifyWhy(why)).toBeNull();
        expect(new Set([...Object.keys(SAVE_POINT_OF_WHY), DRAFT_WHY, ...NO_SAVE_WHY])).toEqual(new Set(SET_CHANGE_WHY));
        expect(classifyWhy('nonsense')).toBeNull();
        expect(classifyWhy(undefined)).toBeNull();
    });
});

describe('the draft debounce never writes after a save point, and never loses the last edit', () => {
    const scheduler = (write) => {
        vi.useFakeTimers();
        return createDraftScheduler({ delayMs: 500, setTimer: setTimeout, clearTimer: clearTimeout, write });
    };

    it('a burst of edits writes ONE draft, after the wait', () => {
        const write = vi.fn();
        const d = scheduler(write);
        d.edited(); vi.advanceTimersByTime(300);
        d.edited(); vi.advanceTimersByTime(300);
        d.edited();
        expect(write).not.toHaveBeenCalled();
        vi.advanceTimersByTime(500);
        expect(write).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('a save point SUPERSEDES a pending draft: it is cancelled and never written afterwards', () => {
        const write = vi.fn();
        const d = scheduler(write);
        d.edited();
        expect(d.savePoint()).toBe(true);
        vi.advanceTimersByTime(10_000);
        expect(write).not.toHaveBeenCalled();
        expect(d.savePoint()).toBe(false);
        vi.useRealTimers();
    });

    it('a page hide FLUSHES a pending draft at once (L4), and a flush with nothing pending writes nothing', () => {
        const write = vi.fn();
        const d = scheduler(write);
        expect(d.flush()).toBe(false);
        d.edited();
        expect(d.flush()).toBe(true);
        expect(write).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(10_000);
        expect(write).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('the queue writes a draft asked BEFORE a save point before it (order kept), and its tab\'s draft collapses at the version', async () => {
        const library = createDocumentLibrary({ backend: createMemoryBackend() });
        const q = createSaveQueue({ library, membersOf: fakeMembers(), source: SOURCE });
        const a = q.save({ record: { n: 1 }, kind: 'draft' });
        const b = q.save({ record: { n: 2 }, kind: 'version', savedBecause: 'report' });
        const [ra, rb] = await Promise.all([a, b]);
        expect(ra.draft).toBe(true);
        expect(rb.seq).toBe(1);
        const listed = await library.entriesOf(rb.lineage_id);
        expect(listed.entries.map((e) => e.entry_id)).toEqual([rb.entry_id]);
    });
});

describe('the lineage: minted once, a parent chain, one re-mint after a Clear', () => {
    it('the first save mints; every later save uses it, parent = the previous VERSION; a draft does not move the parent', async () => {
        const library = createDocumentLibrary({ backend: createMemoryBackend() });
        const q = createSaveQueue({ library, membersOf: fakeMembers(), source: SOURCE });
        const d0 = await q.save({ record: { n: 0 }, kind: 'draft' });
        const v1 = await q.save({ record: { n: 1 }, kind: 'version', savedBecause: 'room-close' });
        const d1 = await q.save({ record: { n: 2 }, kind: 'draft' });
        const v2 = await q.save({ record: { n: 3 }, kind: 'version', savedBecause: 'report' });
        expect(new Set([d0.lineage_id, v1.lineage_id, d1.lineage_id, v2.lineage_id]).size).toBe(1);
        expect((await library.lineages()).lineages).toHaveLength(1);
        expect([v1.seq, v2.seq]).toEqual([1, 2]);
        expect(d0.parent).toBeNull();
        expect(v1.parent).toBeNull();
        expect(d1.parent).toBe(v1.entry_id);
        expect(v2.parent).toBe(v1.entry_id);
        expect((await library.getEntry(v2.entry_id)).entry.parent).toBe(v1.entry_id);
        expect(q.state()).toEqual({ lineageId: v1.lineage_id, parent: v2.entry_id });
    });

    it('a session opened from "Recent sets" continues THAT lineage, parent = the opened version; a fresh start mints anew', async () => {
        const library = createDocumentLibrary({ backend: createMemoryBackend() });
        const a = createSaveQueue({ library, membersOf: fakeMembers(), source: SOURCE });
        const v1 = await a.save({ record: { n: 1 }, kind: 'version', savedBecause: 'report' });
        await a.save({ record: { n: 2 }, kind: 'version', savedBecause: 'report' });
        const b = createSaveQueue({ library, membersOf: fakeMembers(), source: { ...SOURCE, tab_id: 'tab-b' } });
        await b.start({ lineageId: v1.lineage_id, parent: v1.entry_id });
        const v3 = await b.save({ record: { n: 3 }, kind: 'version', savedBecause: 'download' });
        expect(v3.lineage_id).toBe(v1.lineage_id);
        expect(v3.seq).toBe(3);
        expect(v3.parent).toBe(v1.entry_id); // a FORK off v1, beside v2 — nothing overwritten
        await b.start();
        const fresh = await b.save({ record: { n: 4 }, kind: 'version', savedBecause: 'download' });
        expect(fresh.lineage_id).not.toBe(v1.lineage_id);
        expect(fresh.seq).toBe(1);
    });

    it('write-lineage-unknown (the set was Cleared) → a NEW lineage, saved again ONCE, and the status says so', async () => {
        const library = createDocumentLibrary({ backend: createMemoryBackend() });
        const q = createSaveQueue({ library, membersOf: fakeMembers(), source: SOURCE });
        const v1 = await q.save({ record: { n: 1 }, kind: 'version', savedBecause: 'report' });
        expect((await library.deleteLineage(v1.lineage_id)).status).toBe('deleted');
        const again = await q.save({ record: { n: 2 }, kind: 'version', savedBecause: 'report' });
        expect(again.status).toBe('saved');
        expect(again.reminted).toBe(true);
        expect(again.lineage_id).not.toBe(v1.lineage_id);
        expect(again.seq).toBe(1);
        expect(again.parent).toBeNull();
        expect(statusLineOf(again)).toBe('Saved: version 1 of a set — saved as a new set: the old one was cleared');
        const next = await q.save({ record: { n: 3 }, kind: 'version', savedBecause: 'report' });
        expect(next.reminted).toBe(false);
        expect(next.lineage_id).toBe(again.lineage_id);
    });

    it('the re-mint is not a loop: a library that answers lineage-unknown every time is asked exactly twice', async () => {
        const err = Object.assign(new Error('no lineage'), { code: WRITE_REFUSAL.lineageUnknown });
        const library = { saveVersion: vi.fn(async () => { throw err; }), getEntry: vi.fn() };
        const q = createSaveQueue({ library, membersOf: fakeMembers(), source: SOURCE });
        await q.start({ lineageId: 'f'.repeat(32), parent: null });
        const r = await q.save({ record: { n: 1 }, kind: 'version', savedBecause: 'report' });
        expect(library.saveVersion).toHaveBeenCalledTimes(2);
        expect(library.saveVersion.mock.calls[1][0].lineageId).toBeNull();
        expect(r.status).toBe('lineage-unknown');
        expect(statusLineOf(r)).toBe('NOT saved — no lineage');
    });
});

describe('won\'t play (⚖ Q2): a draft only, never a version', () => {
    it('a plan that says won\'t-play is saved as a DRAFT marked with its reason, never a numbered version', async () => {
        const library = createDocumentLibrary({ backend: createMemoryBackend() });
        const q = createSaveQueue({ library, membersOf: fakeMembers({ wontPlay: 'duplicate room name' }), source: SOURCE });
        const r = await q.save({ record: { n: 1 }, kind: 'version', savedBecause: 'report' });
        expect(r.status).toBe('saved');
        expect(r.draft).toBe(true);
        expect(r.seq).toBeNull();
        expect((await library.getEntry(r.entry_id)).entry.wont_play).toEqual({ why: 'duplicate room name' });
        expect(statusLineOf(r)).toBe('Draft saved (won\'t play: duplicate room name)');
        expect(q.state().parent).toBeNull();
    });
});

describe('the status line', () => {
    it('says one sentence per answer', () => {
        expect(statusLineOf({ status: 'saved', draft: false, seq: 4, label: 'my set' })).toBe('Saved: version 4 of my set');
        expect(statusLineOf({ status: 'saved', draft: true })).toBe('Draft saved');
        expect(statusLineOf({ status: 'saved', draft: true, wontPlay: 'x' })).toBe('Draft saved (won\'t play: x)');
        expect(statusLineOf({ status: 'failed', why: 'QuotaExceededError: full' }, { quota: true })).toBe('NOT saved — storage full');
        expect(statusLineOf({ status: 'failed', why: 'AbortError: gone' })).toBe('NOT saved — AbortError: gone');
        expect(statusLineOf({ status: 'unavailable', why: 'no indexedDB in this browser context' }))
            .toBe('Not saved — library unavailable (no indexedDB in this browser context)');
    });
});

describe('which database (js-22 L1)', () => {
    it('?libraryDb= wins; under automation with no seam a per-page-load name, NEVER the default; otherwise the default', () => {
        expect(libraryDbNameOf({ search: '?libraryDb=row-1', webdriver: true, tabId: 'abc' })).toBe('row-1');
        expect(libraryDbNameOf({ search: '?source=edit', webdriver: true, tabId: 'abc' })).toBe(`${DEFAULT_LIBRARY_DB_NAME}-auto-abc`);
        expect(libraryDbNameOf({ search: '?source=edit', webdriver: true, tabId: 'abc' })).not.toBe(DEFAULT_LIBRARY_DB_NAME);
        expect(libraryDbNameOf({ search: '?source=edit', webdriver: false, tabId: 'abc' })).toBe(DEFAULT_LIBRARY_DB_NAME);
    });
});

describe('what a save holds (the bundle\'s members, from the same functions the doors call)', () => {
    it('a version: set, overlay, rules, atlas; the set is downloadSet\'s, and the rules name its fingerprint — after an edit too', () => {
        const session = sessionOver(recordOf());
        for (const step of ['before', 'after']) {
            if (step === 'after') {
                expect(session.apply({ op: 'set-room-field', room: 1, field: 'music', value: 2 }).ok).toBe(true);
            }
            const plan = librarySaveOf(session.record(), 'version', ctx);
            expect(plan.draft).toBe(false);
            expect(plan.members.map((m) => m.role)).toEqual(['set', 'overlay', 'rules', 'atlas']);
            const set = plan.members[0].doc;
            const bundleSet = downloadSet(session).set;
            expect(set).toEqual(bundleSet);
            const h = levelSetContentHash(set);
            expect(computeContentHash(set, { idKey: 'set_id' })).toBe(h);
            const refs = Object.values(plan.members[2].doc.region_atlas).map((r) => r.level_set);
            expect(refs).toEqual([{ set_id: set.set_id, content_hash: h }]);
            expect(plan.members[3].doc.atlas_id).toBe(Object.values(plan.members[2].doc.region_atlas)[0].atlas_id);
        }
    });

    it('an edit: a DRAFT of the set and overlay, stamped (its own fingerprint) but not validated', () => {
        const plan = librarySaveOf(recordOf(), 'draft', ctx);
        expect(plan.draft).toBe(true);
        expect(plan.wontPlay).toBeNull();
        expect(plan.members.map((m) => m.role)).toEqual(['set', 'overlay']);
        const set = plan.members[0].doc;
        expect(set.provenance.content_hash).toBe(levelSetContentHash(set));
        expect(set.set_id.endsWith(`-${levelSetContentHash(set)}`)).toBe(true);
    });

    it('an invalid set at a save point (two rooms one name) → a won\'t-play DRAFT, no rules, no version', () => {
        const session = sessionOver(recordOf());
        const name = session.record().set.rooms[0].name;
        expect(session.apply({ op: 'set-room-field', room: 1, field: 'name', value: name }).ok).toBe(true);
        const plan = librarySaveOf(session.record(), 'version', ctx);
        expect(plan.draft).toBe(true);
        expect(plan.wontPlay).toMatch(/^the set does not validate/);
        expect(plan.members.map((m) => m.role)).toEqual(['set', 'overlay']);
    });

    it('a stale report is never the source: two saves around an edit give two fingerprints, each the record\'s own', () => {
        const session = sessionOver(recordOf());
        const before = librarySaveOf(session.record(), 'version', ctx).members[0].doc;
        session.apply({ op: 'set-room-field', room: 2, field: 'music', value: 3 });
        const after = librarySaveOf(session.record(), 'version', ctx).members[0].doc;
        expect(after.provenance.content_hash).not.toBe(before.provenance.content_hash);
        expect(after).toEqual(downloadSet(session).set);
    });
});

describe('the engine over the memory backend (statuses end to end)', () => {
    const engineOver = (backend) => createLibraryEngine({ backend, schemas: { rulesSchema: loadRulesSchema(), atlasSchema: loadAtlasSchema() }, source: SOURCE });

    it('a save point saves a version whose set member is the bundle\'s; a storage failure says NOT saved and keeps nothing', async () => {
        const backend = createMemoryBackend();
        const engine = engineOver(backend);
        const record = recordOf();
        const v1 = await engine.save({ record, kind: 'version', savedBecause: 'report' });
        expect(v1.status).toBe('saved');
        expect(statusLineOf(v1)).toBe(`Saved: version 1 of ${v1.label}`);
        const setMember = v1.members.find((m) => m.role === 'set');
        expect(setMember.content_hash).toBe(levelSetContentHash(downloadSet(sessionOver(record)).set));
        const before = backend.raw('entries').size;
        const failed = await engine.save({ record, kind: 'version', savedBecause: 'download', failNext: 'QuotaExceededError' });
        expect(failed.status).toBe('failed');
        expect(failed.why).toMatch(/^QuotaExceededError: /);
        expect(statusLineOf(failed, { quota: true })).toBe('NOT saved — storage full');
        expect(backend.raw('entries').size).toBe(before);
        const after = await engine.save({ record, kind: 'version', savedBecause: 'download' });
        expect(after.seq).toBe(2);
    });

    it('no database → "Not saved — library unavailable (<why>)"', async () => {
        const backend = createMemoryBackend();
        backend.unavailable('blocked by the browser');
        const r = await engineOver(backend).save({ record: recordOf(), kind: 'draft' });
        expect(r.status).toBe('unavailable');
        expect(statusLineOf(r)).toBe('Not saved — library unavailable (blocked by the browser)');
    });
});

describe('"Recent sets": the rows and the fingerprinted Open', () => {
    it('lists lineages from inventory + entriesOf (newest version, DRAFT and won\'t-play marked) and opens BY FINGERPRINT', async () => {
        const library = createDocumentLibrary({ backend: createMemoryBackend() });
        const q = createSaveQueue({ library, membersOf: fakeMembers(), source: SOURCE });
        const v1 = await q.save({ record: { n: 1 }, kind: 'version', savedBecause: 'report' });
        const v2 = await q.save({ record: { n: 2 }, kind: 'version', savedBecause: 'download' });
        const w = createSaveQueue({ library, membersOf: fakeMembers({ wontPlay: 'bad' }), source: { ...SOURCE, tab_id: 'tab-b' } });
        await w.start({ lineageId: v1.lineage_id, parent: v2.entry_id });
        const d = await w.save({ record: { n: 9 }, kind: 'version', savedBecause: 'report' });
        const inv = await library.inventory();
        const rows = recentRowsOf(inv.lineages, new Map([[v1.lineage_id, (await library.entriesOf(v1.lineage_id)).entries]]));
        expect(rows).toHaveLength(1);
        expect(rows[0].newest).toMatchObject({ entry_id: v2.entry_id, seq: 2 });
        expect(rows[0].versions).toBe(2);
        expect(rows[0].drafts).toEqual([expect.objectContaining({ entry_id: d.entry_id, wontPlay: 'bad', tab_id: 'tab-b', parent: v2.entry_id })]);

        const plan = openPlanOf({ ...rows[0].newest, draft: false }, rows[0].lineage_id);
        expect(plan.set.contentHash).toBe(v2.members[0].content_hash);
        expect(plan).toMatchObject({ lineageId: v1.lineage_id, parent: v2.entry_id, draft: false });
        const got = await library.get(plan.set);
        expect(got.status).toBe('held');
        expect(got.doc).toEqual({ set_id: 's-2', n: 2 });
        const draftPlan = openPlanOf({ ...rows[0].drafts[0], draft: true }, rows[0].lineage_id);
        expect(draftPlan.parent).toBe(v2.entry_id);
        // ⛔ there is no read without a fingerprint: Open always names one, and a hashless get throws
        await expect(library.get({ idKey: plan.set.idKey, docId: plan.set.docId })).rejects.toBeInstanceOf(LibraryReadError);
    });

    it('a non-held answer is named, never a fallback', () => {
        const ref = { idKey: 'set_id', docId: 's-2', contentHash: '0123abcd' };
        expect(readRefusalOf('set', ref, { status: 'absent' })).toBe('NOT opened — the set s-2 @ 0123abcd is not in the library (absent)');
        expect(readRefusalOf('set', ref, { status: 'mismatch', heldHashes: ['11112222'] }))
            .toBe('NOT opened — the library holds s-2 only as 11112222, not 0123abcd (mismatch)');
        expect(readRefusalOf('set', ref, { status: 'corrupt', why: 'the stored body hashes to x' }))
            .toBe('NOT opened — the stored set s-2 @ 0123abcd is corrupt: the stored body hashes to x');
        expect(readRefusalOf('set', ref, { status: 'unavailable', why: 'no db' })).toBe('NOT opened — library unavailable (no db)');
    });
});

describe('source pins', () => {
    const FILES = ['watchLibrary.js', 'watchLibraryCore.js', 'watchLibraryEngine.js', 'watchLibraryMembers.js', 'watchLibraryWorker.js'];
    const read = (f) => readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), 'latin1');

    it('⛓ B5 (⚖ Q3): persist() is called in exactly ONE place — createPersistOnce — and the page asks through it', () => {
        const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        const calls = FILES.flatMap((f) => (code(f).match(/\.persist\s*\(/g) ?? []).map(() => f));
        expect(calls).toEqual(['watchLibraryCore.js']);
        expect(code('watchLibraryCore.js')).toMatch(/export function createPersistOnce[\s\S]*storage\.persist\(\)/);
        expect(code('watchLibrary.js')).toMatch(/createPersistOnce\(\{ storage: globalThis\.navigator\?\.storage \}\)/);
    });

    it('the page imports the writer only DYNAMICALLY (a standalone boot fetches nothing new)', () => {
        const page = read('watchViewer.js');
        expect(page).not.toMatch(/^import[^;]*watchLibrary/m);
        expect(page).toMatch(/import\('\.\/watchLibrary\.js'\)/);
    });
});

describe('B5 — the leave warning (⚖ Robert Q2 "Warn only if unsaved")', () => {
    it('armed only while unsaved: a pending draft SETS the handler (preventDefault + returnValue); a clean tab has NONE', () => {
        const win = { onbeforeunload: null };
        const guard = createLeaveGuard({ win });
        expect(win.onbeforeunload).toBe(null);
        expect(guard.update(false)).toBe(false);
        expect(win.onbeforeunload).toBe(null);
        expect(guard.update(true)).toBe(true);
        expect(win.onbeforeunload).toBe(leaveWarningHandler);
        const ev = { preventDefault: vi.fn(), returnValue: undefined };
        expect(win.onbeforeunload(ev)).toBe('');
        expect(ev.preventDefault).toHaveBeenCalledTimes(1);
        expect(ev.returnValue).toBe('');
        expect(guard.update(true)).toBe(true);
        expect(guard.update(false)).toBe(false);
        expect(win.onbeforeunload).toBe(null);
        expect(guard.armed).toBe(false);
    });
    it('the page arms it from draftPending OR a save in flight, and from nothing else', () => {
        const src = readFileSync(fileURLToPath(new URL('./watchLibrary.js', import.meta.url)), 'latin1');
        expect(src).toMatch(/leave\.update\(out\.draftPending === true \|\| out\.inFlight > 0\)/);
        expect(src.match(/onbeforeunload/g) ?? []).toEqual([]);
    });
});

describe('B5 — the one persistence request (⚖ Robert Q3 "Ask once, at first save")', () => {
    it('ONE persist() call across several saves; the answer is the line', async () => {
        const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) };
        const once = createPersistOnce({ storage });
        expect(once.asked).toBe(false);
        const answers = await Promise.all([once.ask(), once.ask()]);
        await once.ask();
        expect(storage.persist).toHaveBeenCalledTimes(1);
        expect(answers[0]).toEqual({ status: 'granted', line: PERSIST_LINES.granted });
        expect(answers[1]).toBe(answers[0]);
    });
    it('already persisted → no request at all; a refusal or a throw is an answer, never an error', async () => {
        const kept = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) };
        await expect(createPersistOnce({ storage: kept }).ask()).resolves.toMatchObject({ status: 'already' });
        expect(kept.persist).not.toHaveBeenCalled();
        const no = { persisted: async () => false, persist: vi.fn(async () => false) };
        await expect(createPersistOnce({ storage: no }).ask()).resolves.toEqual({ status: 'denied', line: PERSIST_LINES.denied });
        const boom = { persisted: async () => false, persist: vi.fn(async () => { throw new TypeError('no'); }) };
        await expect(createPersistOnce({ storage: boom }).ask()).resolves.toMatchObject({ status: 'denied', why: 'TypeError: no' });
        await expect(createPersistOnce({ storage: undefined }).ask()).resolves.toMatchObject({ status: 'unsupported' });
    });
});
