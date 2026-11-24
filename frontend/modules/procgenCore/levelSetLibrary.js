/**
 * procgenCore/levelSetLibrary — **THE APP'S SIDE OF THE DOCUMENT LIBRARY, FOR LEVEL SETS** (document library B5).
 *
 * Two things, both game-neutral:
 *   · THE OPENER (`createLibraryFront`): the page's one lazy connection to the library, for `levelSetReference.ensureHeld`
 *     (`front.open` is the function it is handed). Nothing is fetched or opened until a reader MISSES in the front
 *     (`levelSetCache`) on a set its rules name; a browser that never saved a set answers `absent` and no database is
 *     made (`libraryDatabaseExists`), the Storage panel's rule.
 *   · THE HOLDER (`createLevelSetHolder`): a running game HOLDS the version it plays — in the front
 *     (`levelSetCache.hold`, so the bound never evicts it) and, when that document is in the library, in the library
 *     too (`hold(entry, {kind: 'game', tab_id, what})`, so cleanup and Clear never remove it). The holder heartbeats
 *     every `HOLD_HEARTBEAT_MS` and on `visibilitychange` and `pageshow` (a hidden tab's timers are throttled to about
 *     one a minute; `HOLD_STALE_MS` is the line — B1 D8: the HOLDER's job), and releases on `pagehide` (re-held on a
 *     `pageshow` from the back/forward cache) and when the game stops. A heartbeat answered `gone` (B1 D3: cleaned
 *     while stale) holds again. A set with no library entry (a bundle, door A's carried body) is held in the front only.
 *
 * ⛓ WHICH DATABASE (B5 brief §4): the library's own rule, `libraryDbNameOf` — `?libraryDb=` on the page URL, else a
 *   per-page-load name under `navigator.webdriver`, else the default — with ONE more seam ahead of it, the B2 pattern:
 *   `levelSetLibrarySource.dbName` (null = the rule). An in-app row sets it to its own database and restores null, so
 *   no row ever reads the default library, and a row that sets nothing reads its page's own per-load name.
 * ⛔ IMPORTS NOTHING STATICALLY. The library's modules are fetched document-relative (`import(new URL(…,
 *   document.baseURI))`, B1–B3's pattern), so `dist/bundle.js` carries no library code; tests hand their own `load`.
 * ⛔ A NEW VERSION SAVED ELSEWHERE CHANGES NOTHING HERE. Nothing in this file listens for saves: a running game's
 *   rooms are swapped only by a press (the follow-live toggles are C3's).
 */

/** The test seam (B2's `librarySource` pattern): a row names its own database, then restores null. */
export const levelSetLibrarySource = { dbName: null };

const appUrl = (rel) => new URL(rel, globalThis.document?.baseURI ?? globalThis.location?.href).href;

/** The library's modules, fetched raw on either boot. */
export async function loadLibraryModules() {
    const [core, idb] = await Promise.all([
        import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibrary.js')),
        import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibraryIdb.js')),
    ]);
    return { core, idb };
}

/** A random per-page-load tab id (every hold this page makes carries it). */
export function newTabId(random = globalThis.crypto) {
    const bytes = new Uint8Array(8);
    random.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The page's lazy library connection.
 * @param {{load?: Function, source?: {dbName: string|null}, search?: () => string, webdriver?: () => boolean,
 *   tabId?: string}} [o]
 */
export function createLibraryFront({
    load = loadLibraryModules,
    source = levelSetLibrarySource,
    search = () => globalThis.location?.search ?? '',
    webdriver = () => globalThis.navigator?.webdriver === true,
    tabId = newTabId(),
} = {}) {
    let mods = null;
    /** {dbName, backend, library} of the open connection, or null. */
    let open = null;
    let opening = Promise.resolve();
    const front = {
        tabId,
        /** The modules (loaded once). */
        async modules() {
            mods ??= load();
            try {
                return await mods;
            } catch (e) {
                mods = null;
                throw e;
            }
        },
        /** The database this page reads NOW (the seam is read at every open, so a row can point it at its own). */
        async dbName() {
            const { core } = await front.modules();
            return source.dbName ?? core.libraryDbNameOf({ search: search(), webdriver: webdriver(), tabId });
        },
        /**
         * The library, or an answer: `{status: 'absent', why}` (no database of that name: nothing was ever saved
         * here; none is made), `{status: 'unavailable', why}` (no IndexedDB, or the modules did not load).
         */
        open() {
            // ⛓ one open at a time, so two readers never make two connections
            opening = opening.then(openNow, openNow);
            return opening;
        },
        /** Close the connection (the next `open` opens again). */
        async close() {
            const was = open;
            open = null;
            try { await was?.backend?.close?.(); } catch { /* it never opened */ }
        },
        /** `{dbName, open}` for a readout. */
        state() { return { dbName: open?.dbName ?? null, open: !!open }; },
    };
    async function openNow() {
        let m;
        try {
            m = await front.modules();
        } catch (e) {
            return { status: 'unavailable', why: `the document library's modules did not load: ${e?.message ?? e}` };
        }
        const dbName = source.dbName ?? m.core.libraryDbNameOf({ search: search(), webdriver: webdriver(), tabId });
        if (open && open.dbName === dbName) return open.library;
        if (open) await front.close();
        let exists = null;
        try {
            exists = await m.idb.libraryDatabaseExists(dbName);
        } catch { exists = null; }
        if (exists === false) return { status: 'absent', why: `nothing is saved in this browser's library (${dbName})` };
        const backend = m.idb.createIdbBackend({ dbName });
        open = { dbName, backend, library: m.core.createDocumentLibrary({ backend }) };
        return open.library;
    }
    return front;
}

/** Prefer the newest numbered version that names the document, else the first draft. */
function entryToHold(entries) {
    const saved = (entries ?? []).filter((e) => !e.draft && Number.isInteger(e.seq)).sort((a, b) => b.seq - a.seq);
    return saved[0] ?? (entries ?? [])[0] ?? null;
}

/**
 * A running game's holds. `hold(ref, {what})` → a handle `{ref, release(), beat(), state(), ready}`.
 * @param {object} o
 * @param {object} o.cache   the front (`levelSetCache`)
 * @param {object} o.front   `createLibraryFront`'s object
 * @param {object} [o.timers] `{setInterval, clearInterval}`
 * @param {object} [o.win]   the window (pagehide / pageshow)
 * @param {object} [o.doc]   the document (visibilitychange)
 * @param {Function} [o.onChange] called with the handle's state after every change (a readout)
 */
export function createLevelSetHolder({ cache, front, timers = globalThis, win = globalThis.window, doc = globalThis.document,
    onChange = () => {} }) {
    return {
        hold(ref, { what = null } = {}) {
            const st = {
                ref: { set_id: ref.set_id, content_hash: ref.content_hash },
                front: cache.hold(ref).status,
                library: 'pending', why: null, entry_id: null, hold_id: null, beats: 0, reholds: 0, released: false,
            };
            let lib = null;
            let core = null;
            let timer = null;
            const notify = () => { try { onChange({ ...st }); } catch { /* a readout */ } };

            const attach = async () => {
                const got = await front.open();
                if (st.released) return;
                if (typeof got?.get !== 'function') {
                    st.library = 'front-only';
                    st.why = got?.why ?? 'no document library';
                    return;
                }
                lib = got;
                core = (await front.modules()).core;
                const g = await lib.get({ idKey: 'set_id', docId: st.ref.set_id, contentHash: st.ref.content_hash });
                if (st.released) return;
                const entry = g?.status === 'held' ? entryToHold(g.entries) : null;
                if (!entry) {
                    st.library = 'front-only';
                    st.why = g?.status === 'held' ? 'no library version names this set'
                        : `the library answered ${g?.status} for this set (it is not a library version)`;
                    return;
                }
                const h = await lib.hold(entry.entry_id, { kind: 'game', tab_id: front.tabId, what: what ?? undefined });
                if (h?.status !== 'held') {
                    st.library = 'front-only';
                    st.why = `the library answered ${h?.status} to the hold`;
                    return;
                }
                if (st.released) {
                    // ⛔ released while the hold was in flight: give it straight back
                    await lib.release(h.hold_id);
                    return;
                }
                st.entry_id = entry.entry_id;
                st.hold_id = h.hold_id;
                st.library = 'held';
                st.why = null;
            };
            const reattach = async () => {
                st.reholds += 1;
                st.hold_id = null;
                st.entry_id = null;
                await attach();
            };
            const beat = async () => {
                if (st.released) return st;
                if (st.library === 'released-hidden') {
                    await reattach();
                } else if (lib && st.hold_id) {
                    const a = await lib.heartbeat(st.hold_id);
                    st.beats += 1;
                    if (a?.status === 'gone') await reattach();
                }
                notify();
                return { ...st };
            };
            const onVisibility = () => { void beat(); };
            const onPageShow = () => { void beat(); };
            const onPageHide = () => {
                if (lib && st.hold_id) {
                    void lib.release(st.hold_id);
                    st.hold_id = null;
                    st.entry_id = null;
                    st.library = 'released-hidden';
                    notify();
                }
            };
            doc?.addEventListener?.('visibilitychange', onVisibility);
            win?.addEventListener?.('pageshow', onPageShow);
            win?.addEventListener?.('pagehide', onPageHide);

            const ready = attach().catch((e) => {
                st.library = 'front-only';
                st.why = `the library hold failed: ${e?.message ?? e}`;
            }).then(() => {
                if (!st.released && st.library === 'held' && core) {
                    timer = timers.setInterval(() => beat().catch(() => {}), core.HOLD_HEARTBEAT_MS);
                }
                notify();
            });

            return {
                ref: st.ref,
                ready,
                beat,
                state: () => ({ ...st }),
                /** Stop holding: the front hold, the library hold, the timer and the listeners. Idempotent. */
                async release() {
                    if (st.released) return { ...st };
                    st.released = true;
                    if (timer !== null) timers.clearInterval(timer);
                    timer = null;
                    doc?.removeEventListener?.('visibilitychange', onVisibility);
                    win?.removeEventListener?.('pageshow', onPageShow);
                    win?.removeEventListener?.('pagehide', onPageHide);
                    st.front = cache.release(st.ref).status;
                    const holdId = st.hold_id;
                    st.hold_id = null;
                    if (lib && holdId) {
                        try { await lib.release(holdId); } catch { /* the hold goes stale by itself */ }
                    }
                    st.library = 'released';
                    notify();
                    return { ...st };
                },
            };
        },
    };
}
