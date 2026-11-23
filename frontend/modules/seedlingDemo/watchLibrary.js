/**
 * watchLibrary — THE SEEDLING LAB SAVES INTO THE DOCUMENT LIBRARY BY ITSELF (document library B3).
 *
 * ⛓ Loaded DYNAMICALLY by `watchViewer.js` at the first save (an edit or a save point) or the first
 * press of "Recent sets", so a page that never saves fetches nothing new and `dist/bundle.js` carries
 * none of it (study §7). Nothing here runs at boot and nothing restores on reload: a fresh lab opens
 * clean, as before.
 *
 *   · SAVES go to ONE module worker per page (`watchLibraryWorker.js`), created at the first save:
 *     a save point on the vanilla 116 is ~650 ms of report + stamp + canonicalise + hash, which the
 *     page's main thread must not carry (js-22 L3). The page only clones the record into the message.
 *     Without a module worker the same engine runs in-process.
 *   · THE DRAFT DEBOUNCE, the lineage and the status sentences are `watchLibraryCore.js`'s.
 *   · A PAGE HIDE flushes a pending draft at once (`visibilitychange` → hidden, and `pagehide`; js-22 L4).
 *   · A FULL STORAGE raises the app's storage banner in this page (`reportLibraryWriteFailure` →
 *     `showQuotaNotice`), and the status says "NOT saved — storage full". The session and every download
 *     are untouched: the library is beside the download, never in it.
 *   · "RECENT SETS" (in the LOAD box) lists the lineages (`inventory` + `entriesOf`) and opens a chosen
 *     version or draft by FINGERPRINT (`get({idKey, docId, contentHash})`); a non-`held` answer is shown
 *     by name, never a fallback. It loads through the page's own LOAD door (`takeLevelSet`). It creates
 *     no database: with none (`libraryDatabaseExists` false) it says "nothing saved yet".
 *
 * ⛔ No `navigator.storage.persist()` (js-22 L2): unruled, and Firefox prompts. B5 asks Robert.
 */
import {
    classifyWhy, createDraftScheduler, libraryDbNameOf, LIBRARY_PAGE, newTabId, openPlanOf,
    readRefusalOf, recentRowsOf, statusLineOf,
} from './watchLibraryCore.js';

/** Per page load (study §4): every save of this page carries it. */
const TAB_ID = newTabId();
let dbName = null;
/** The database this page uses, fixed at its first use (the seam is read once per page load). */
export function libraryDbName() {
    dbName ??= libraryDbNameOf({
        search: globalThis.location?.search ?? '',
        webdriver: globalThis.navigator?.webdriver === true,
        tabId: TAB_ID,
    });
    return dbName;
}
const source = () => ({ page: LIBRARY_PAGE, tab_id: TAB_ID });

/** The readout a driver reads (`window.__labLibrary`). */
const readout = () => {
    globalThis.__labLibrary ??= {
        dbName: libraryDbName(), tabId: TAB_ID, transport: null, status: null, saves: [], inFlight: 0,
        draftPending: false, recent: null, opened: null,
    };
    return globalThis.__labLibrary;
};

/* ── the transport: one worker per page ─────────────────────────────── */

let transport = null;

function makeTransport(schemas) {
    if (transport) return transport;
    if (typeof globalThis.Worker === 'function') {
        try {
            const w = new globalThis.Worker(new URL('./watchLibraryWorker.js', import.meta.url),
                { type: 'module', name: 'seedling-lab-library' });
            let next = 1;
            let dead = null;
            const waiting = new Map();
            const fail = (why) => {
                dead = why;
                for (const res of waiting.values()) res({ status: 'failed', why });
                waiting.clear();
            };
            w.onmessage = (ev) => {
                const { id, answer } = ev.data ?? {};
                const res = waiting.get(id);
                waiting.delete(id);
                res?.(answer);
            };
            w.onerror = (ev) => {
                ev.preventDefault?.();
                fail(`the library worker failed: ${ev.message || 'it did not load'}`);
            };
            w.postMessage({ type: 'init', dbName: libraryDbName(), schemas, source: source() });
            transport = {
                kind: 'worker',
                send(msg) {
                    if (dead) return Promise.resolve({ status: 'failed', why: dead });
                    const id = next++;
                    return new Promise((resolve) => {
                        waiting.set(id, resolve);
                        try {
                            w.postMessage({ ...msg, id });
                        } catch (e) {
                            waiting.delete(id);
                            resolve({ status: 'failed', why: `the set could not be sent to the library worker: ${e?.name}: ${e?.message}` });
                        }
                    });
                },
            };
            return transport;
        } catch { /* no module worker here: in-process below */ }
    }
    const engine = import('./watchLibraryEngine.js')
        .then((m) => m.createLibraryEngine({ dbName: libraryDbName(), schemas, source: source() }));
    transport = {
        kind: 'in-process',
        async send(msg) {
            const e = await engine;
            if (msg.type === 'start') {
                await e.start(msg);
                return { status: 'started' };
            }
            return e.save(msg);
        },
    };
    return transport;
}

/* ── the storage banner (the app's, shown in THIS document) ─────────── */

let quotaModules = null;
async function reportFailure(answer) {
    try {
        return await raiseBanner(answer);
    } catch {
        // the banner's modules did not load: the status still says what happened
        return /^(QuotaExceededError|NS_ERROR_DOM_QUOTA_REACHED)\b/.test(answer.why ?? '');
    }
}
async function raiseBanner(answer) {
    quotaModules ??= Promise.all([
        import('../../app/core/storageQuota.js'),
        import('../storagePanel/quotaNotice.js'),
    ]).then(([q, n]) => {
        q.onStorageWriteFailure((notice) => n.showQuotaNotice(notice, {
            onOpen: () => {
                const el = globalThis.document?.getElementById('editLibraryStatus');
                if (el) el.textContent += ' — the Storage panel is in the app (Panels ▸ Storage): it lists the saved sets and can clear old ones';
            },
        }));
        return q;
    });
    const q = await quotaModules;
    return q.reportLibraryWriteFailure({
        why: answer.why, owner: 'Seedling lab', database: libraryDbName(),
    }) !== null;
}

/* ── the writer, one per set arm ────────────────────────────────────── */

/**
 * @param {object} o
 * @param {object} o.lifetime   the arm's lifetime (listeners ride it; its retirement flushes a pending draft)
 * @param {object} o.schemas    `{rulesSchema, levelSetSchema, atlasSchema}` — the ones the page fetched
 * @param {Function} o.getRecord  `() => record|null` — the set session's record NOW
 * @param {object} o.statusEl   where the status sentence goes (`#editLibraryStatus`)
 * @param {object} [o.session]  `{lineageId, parent}` of the session already open
 */
export function createLabLibrary({ lifetime, schemas, getRecord, statusEl, session = {} }) {
    const out = readout();
    const send = (msg) => makeTransport(schemas).send(msg);
    out.transport = makeTransport(schemas).kind;
    let record = getRecord;

    const show = (answer, quota) => {
        const text = statusLineOf(answer, { quota });
        out.status = text;
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = answer.status === 'saved' ? 'note' : 'note bad';
        }
    };

    const save = async (kind, savedBecause, why, at = null) => {
        const rec = at ?? record();
        if (!rec) return null;
        const failNext = globalThis.__labLibraryFailNext ?? null;
        globalThis.__labLibraryFailNext = null;
        out.inFlight += 1;
        let answer;
        // ⛓ L3: what the PAGE pays is the clone into the message; the save itself is the worker's.
        const t0 = globalThis.performance.now();
        const pending = send({ type: 'save', record: rec, kind, savedBecause, failNext });
        const mainMs = globalThis.performance.now() - t0;
        try {
            answer = await pending;
        } finally {
            out.inFlight -= 1;
        }
        const quota = answer.status === 'failed' ? await reportFailure(answer) : false;
        out.saves.push({ why, kind, ...answer, quota, status_line: statusLineOf(answer, { quota }), main_ms: mainMs });
        show(answer, quota);
        return answer;
    };

    const drafts = createDraftScheduler({
        setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
        clearTimer: (t) => globalThis.clearTimeout(t),
        write: () => {
            out.draftPending = false;
            save('draft', null, 'op');
        },
    });
    const flush = () => drafts.flush();

    lifetime.on(globalThis.document, 'visibilitychange', () => {
        if (globalThis.document.visibilityState === 'hidden') flush();
    });
    lifetime.on(globalThis, 'pagehide', flush);
    lifetime.onRetire(flush);

    send({ type: 'start', lineageId: session.lineageId ?? null, parent: session.parent ?? null });

    return {
        /** `onSetChange`'s `why`. Save points save now; an edit schedules the draft. */
        changed(why, at = null) {
            const c = classifyWhy(why);
            if (c === null) return null;
            if (c.kind === 'draft') {
                drafts.edited();
                out.draftPending = true;
                return null;
            }
            drafts.savePoint();
            out.draftPending = false;
            return save('version', c.savedBecause, why, at);
        },
        /** A new set was loaded: the old session's pending draft is written first, then the new lineage. */
        startSession({ lineageId = null, parent = null } = {}, getRec = record) {
            flush();
            record = getRec;
            return send({ type: 'start', lineageId, parent });
        },
        flush,
    };
}

/* ── "Recent sets" ──────────────────────────────────────────────────── */

let libModules = null;
const loadLibModules = () => (libModules ??= Promise.all([
    import('../procgenCore/documentLibrary.js'),
    import('../procgenCore/documentLibraryIdb.js'),
]));

/**
 * List the library's sets into `listEl`, with an Open per version and per draft.
 * @param {{listEl: object, noteEl: object, onOpen: Function, doc?: object}} o
 *   `onOpen({set, overlay, lineageId, parent, draft})` loads through the page's LOAD door → boolean
 */
export async function showRecentSets({ listEl, noteEl, onOpen, doc = globalThis.document }) {
    const out = readout();
    const [{ createDocumentLibrary }, { createIdbBackend, libraryDatabaseExists }] = await loadLibModules();
    listEl.textContent = '';
    const say = (text, bad = false) => {
        noteEl.textContent = text;
        noteEl.className = bad ? 'note bad' : 'note';
    };
    const name = libraryDbName();
    const exists = await libraryDatabaseExists(name);
    if (exists === false) {
        out.recent = [];
        say('Recent sets: nothing saved yet in this browser');
        return [];
    }
    const backend = createIdbBackend({ dbName: name });
    const lib = createDocumentLibrary({ backend });
    try {
        const inv = await lib.inventory();
        if (inv.status !== 'ok') {
            out.recent = null;
            say(`Recent sets: library ${inv.status} (${inv.why})`, true);
            return null;
        }
        const byLineage = new Map();
        for (const l of inv.lineages) {
            const e = await lib.entriesOf(l.lineage_id);
            byLineage.set(l.lineage_id, e.status === 'ok' ? e.entries : []);
        }
        const rows = recentRowsOf(inv.lineages, byLineage);
        out.recent = rows.map((r) => ({
            lineage_id: r.lineage_id, label: r.label, versions: r.versions,
            newest: r.newest ? { entry_id: r.newest.entry_id, seq: r.newest.seq } : null,
            drafts: r.drafts.map((d) => ({ entry_id: d.entry_id, wontPlay: d.wontPlay, mine: d.tab_id === TAB_ID })),
        }));
        say(rows.length ? `Recent sets: ${rows.length} set(s) in this browser` : 'Recent sets: nothing saved yet in this browser');
        for (const r of rows) {
            const line = doc.createElement('div');
            line.className = 'line recentSet';
            line.dataset.lineage = r.lineage_id;
            const label = doc.createElement('span');
            label.textContent = `${r.label} — ${r.versions} version(s)`;
            line.appendChild(label);
            const openBtn = (text, entry) => {
                const b = doc.createElement('button');
                b.type = 'button';
                b.textContent = text;
                b.dataset.entry = entry.entry_id;
                b.addEventListener('click', () => openEntry(entry, r.lineage_id, say, onOpen));
                line.appendChild(b);
            };
            if (r.newest) openBtn(`Open version ${r.newest.seq}`, { ...r.newest, draft: false });
            for (const d of r.drafts) {
                openBtn(`Open DRAFT${d.tab_id === TAB_ID ? '' : ' (another tab)'}${d.wontPlay ? ` — won't play: ${d.wontPlay}` : ''}`,
                    { ...d, draft: true });
            }
            listEl.appendChild(line);
        }
        return rows;
    } finally {
        await backend.close();
    }
}

async function openEntry(entry, lineageId, say, onOpen) {
    const out = readout();
    const [{ createDocumentLibrary }, { createIdbBackend }] = await loadLibModules();
    const plan = openPlanOf(entry, lineageId);
    if (!plan.set) {
        say(`NOT opened — entry ${entry.entry_id} has no set member`, true);
        return false;
    }
    const backend = createIdbBackend({ dbName: libraryDbName() });
    const lib = createDocumentLibrary({ backend });
    try {
        const set = await lib.get(plan.set);
        if (set.status !== 'held') {
            out.opened = { entry_id: entry.entry_id, refused: readRefusalOf('set', plan.set, set) };
            say(out.opened.refused, true);
            return false;
        }
        let overlay = null;
        if (plan.overlay) {
            const o = await lib.get(plan.overlay);
            if (o.status !== 'held') {
                out.opened = { entry_id: entry.entry_id, refused: readRefusalOf('overlay', plan.overlay, o) };
                say(out.opened.refused, true);
                return false;
            }
            overlay = o.doc;
        }
        const ok = onOpen({ set: set.doc, overlay, lineageId: plan.lineageId, parent: plan.parent, draft: plan.draft }) !== false;
        out.opened = ok
            ? { entry_id: entry.entry_id, lineage_id: plan.lineageId, parent: plan.parent, draft: plan.draft,
                set_id: set.doc.set_id, content_hash: plan.set.contentHash }
            : { entry_id: entry.entry_id, refused: 'the LOAD door refused it (see the status line)' };
        if (ok) say(`OPENED ${plan.draft ? 'DRAFT' : 'version'} ${entry.seq ?? ''} of this set from the library (${set.doc.set_id})`.replace('  ', ' '));
        return ok;
    } finally {
        await backend.close();
    }
}
