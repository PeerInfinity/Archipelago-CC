/**
 * watchLibraryCore — THE SEEDLING LAB'S LIBRARY WRITER, ITS DECISIONS (document library B3).
 *
 * Pure: no DOM, no worker, no IndexedDB. The library and the member builder are injected, so every
 * rule here is a vitest row (`watchLibraryCore.test.js`):
 *
 *   · WHICH PRESS SAVES WHAT (⚖ Robert Q1, "Save points"): `setEditorView.js` notifies the page with
 *     `onSetChange({why})`, `why` ∈ `SET_CHANGE_WHY`. A room CLOSE, a REPORT, a download and the
 *     hand-over to the app are SAVE POINTS (a numbered version); an edit (`op`) is the tab's rolling
 *     DRAFT; `select` and `room` (the selection moved, a room was opened) write nothing.
 *   · THE DRAFT DEBOUNCE: an edit schedules the draft `DRAFT_DEBOUNCE_MS` later; another edit
 *     restarts the wait; a save point CANCELS a pending draft (the version holds those edits, and the
 *     library collapses this tab's drafts when it saves one), so a draft is never written after the
 *     save point that superseded it; a page hide flushes it at once (js-22 L4).
 *   · THE LINEAGE: minted by the library at the first save of a session; every later save uses it,
 *     with `parent` = the last NUMBERED version saved (or opened). A save answered
 *     `write-lineage-unknown` (the set was cleared in the Storage panel, B2) mints a new lineage and
 *     saves again ONCE, and says so.
 *   · THE STATUS LINE, one sentence per answer.
 *   · "RECENT SETS": the rows, built from `inventory` + `entriesOf`, and the fingerprinted reads.
 *
 * ⛔ No `navigator.storage.persist()` here or anywhere in this writer (js-22 L2: Firefox prompts the
 * user, and Robert has not ruled on it; B5 asks). A vitest row pins its absence from these files.
 */
import { DEFAULT_LIBRARY_DB_NAME, DRAFT_REASON, WRITE_REFUSAL } from '../procgenCore/documentLibrary.js';

/** The `substrate` string the writer files its versions under (data, never branched on). */
export const LIBRARY_SUBSTRATE = 'seedling';
/** The `source.page` of every save. */
export const LIBRARY_PAGE = 'seedlingDemo/watch.html';

/** ⚖ Q1: the four save points, from `setEditorView`'s `why` to the library's `saved_because`. */
export const SAVE_POINT_OF_WHY = Object.freeze({
    close: 'room-close',
    report: 'report',
    download: 'download',
    handoff: 'handover',
});
/** An edit: the rolling draft. */
export const DRAFT_WHY = 'op';
/** A selection or a room opened: nothing is written. */
export const NO_SAVE_WHY = Object.freeze(['select', 'room']);

/**
 * The draft debounce. A 116-room draft costs ~150 ms of worker time (stamp + canonicalise + hash), so a
 * burst of paint edits writes one draft, not one per stroke.
 */
export const DRAFT_DEBOUNCE_MS = 750;

/** `why` → `{kind: 'version', savedBecause}` | `{kind: 'draft'}` | `null` (nothing to write). */
export function classifyWhy(why) {
    if (Object.prototype.hasOwnProperty.call(SAVE_POINT_OF_WHY, why)) {
        return { kind: 'version', savedBecause: SAVE_POINT_OF_WHY[why] };
    }
    if (why === DRAFT_WHY) return { kind: 'draft' };
    return null;
}

/**
 * The database this page writes. `?libraryDb=<name>` is the test seam (every row and check names its
 * own); under automation (`navigator.webdriver`) with no seam, a per-page-load name, so an automated
 * run NEVER opens the default library and no later page inherits its sets (js-22 L1); otherwise the
 * app's one library.
 */
export function libraryDbNameOf({ search = '', webdriver = false, tabId = '' } = {}) {
    const named = new URLSearchParams(search).get('libraryDb');
    if (named) return named;
    if (webdriver === true) return `${DEFAULT_LIBRARY_DB_NAME}-auto-${tabId}`;
    return DEFAULT_LIBRARY_DB_NAME;
}

/** A random per-page-load tab id (study §4). */
export function newTabId(random = globalThis.crypto) {
    const bytes = new Uint8Array(8);
    random.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The draft debounce, over injected timers.
 * @param {{delayMs?: number, setTimer: Function, clearTimer: Function, write: Function}} o
 *   `write()` posts the draft of the CURRENT record (read when it fires, not when it was scheduled).
 */
export function createDraftScheduler({ delayMs = DRAFT_DEBOUNCE_MS, setTimer, clearTimer, write }) {
    let timer = null;
    const fire = () => {
        timer = null;
        write();
    };
    return {
        /** An edit: (re)start the wait. */
        edited() {
            if (timer !== null) clearTimer(timer);
            timer = setTimer(fire, delayMs);
        },
        /** A save point: a pending draft is SUPERSEDED (cancelled, never written after). Returns whether one was. */
        savePoint() {
            if (timer === null) return false;
            clearTimer(timer);
            timer = null;
            return true;
        },
        /** A page hide (or the arm retiring): a pending draft is written NOW. Returns whether one was. */
        flush() {
            if (timer === null) return false;
            clearTimer(timer);
            fire();
            return true;
        },
        pending: () => timer !== null,
    };
}

/** Is this library throw the B2 hand-over (`deleteLineage` ran while this tab was editing)? */
const isLineageUnknown = (e) => e?.code === WRITE_REFUSAL.lineageUnknown;

/**
 * The save queue: one save at a time, in the order asked, over one lineage state.
 * @param {{library: object, membersOf: Function, substrate?: string, source: {page, tab_id}}} o
 *   `membersOf(record, kind)` → `{draft, wontPlay, members, label}` (`watchLibraryMembers.librarySaveOf`).
 */
export function createSaveQueue({ library, membersOf, substrate = LIBRARY_SUBSTRATE, source }) {
    let state = { lineageId: null, parent: null };
    let chain = Promise.resolve();
    const enqueue = (fn) => {
        const p = chain.then(fn);
        chain = p.catch(() => {});
        return p;
    };

    async function attempt(req) {
        try {
            return await library.saveVersion(req);
        } catch (e) {
            if (isLineageUnknown(e)) return { status: 'lineage-unknown', why: e.message };
            if (e?.code) return { status: 'failed', why: `${e.code}: ${e.message}` };
            throw e;
        }
    }

    async function saveNow({ record, kind, savedBecause = null }) {
        let plan;
        try {
            plan = membersOf(record, kind);
        } catch (e) {
            return { status: 'failed', why: `the save could not be built: ${e?.message ?? e}`, kind };
        }
        const req = {
            lineageId: state.lineageId,
            parent: state.parent,
            draft: plan.draft,
            savedBecause: plan.draft ? DRAFT_REASON : savedBecause,
            wontPlay: plan.wontPlay,
            substrate,
            source: { page: source.page, tab_id: source.tab_id },
            label: plan.label,
            members: plan.members,
        };
        let r = await attempt(req);
        let reminted = false;
        if (r.status === 'lineage-unknown') {
            // ⛓ B2 hand-over: the lineage was cleared. Mint a new one and save again, ONCE (a null lineage
            // cannot be unknown, so this cannot loop).
            reminted = true;
            r = await attempt({ ...req, lineageId: null, parent: null });
        }
        if (r.status !== 'saved') return { ...r, kind, reminted, wontPlay: plan.wontPlay, label: plan.label };
        state = { lineageId: r.lineage_id, parent: plan.draft ? (reminted ? null : state.parent) : r.entry_id };
        const entry = await library.getEntry(r.entry_id);
        return {
            status: 'saved',
            kind,
            draft: plan.draft,
            wontPlay: plan.wontPlay,
            label: plan.label,
            reminted,
            entry_id: r.entry_id,
            seq: r.seq,
            lineage_id: r.lineage_id,
            parent: reminted ? null : req.parent,
            savedBecause: req.savedBecause,
            members: entry.status === 'held'
                ? entry.entry.members.map((m) => ({ role: m.role, doc_id: m.doc_id, content_hash: m.content_hash }))
                : [],
        };
    }

    return {
        /** A new session (a set loaded): `{lineageId, parent}` from "Recent sets", else a fresh lineage. */
        start({ lineageId = null, parent = null } = {}) {
            return enqueue(() => { state = { lineageId, parent }; });
        },
        /** `{record, kind: 'version'|'draft', savedBecause}` → the answer (see `statusLineOf`). */
        save(request) {
            return enqueue(() => saveNow(request));
        },
        state: () => ({ ...state }),
    };
}

/**
 * The status line for one save answer. `quota` is whether the failure was a full storage (the caller
 * asked `reportLibraryWriteFailure`, which raises the banner for exactly that case).
 */
export function statusLineOf(answer, { quota = false } = {}) {
    if (answer.status === 'saved') {
        const again = answer.reminted ? ' — saved as a new set: the old one was cleared' : '';
        if (!answer.draft) return `Saved: version ${answer.seq} of ${answer.label ?? 'this set'}${again}`;
        if (answer.wontPlay) return `Draft saved (won't play: ${answer.wontPlay})${again}`;
        return `Draft saved${again}`;
    }
    if (answer.status === 'unavailable') return `Not saved — library unavailable (${answer.why})`;
    if (quota) return 'NOT saved — storage full';
    return `NOT saved — ${answer.why}`;
}

/**
 * "Recent sets": one row per lineage, newest activity first, from `inventory()` and each lineage's
 * `entriesOf`. A row names the newest numbered version and every draft (DRAFT, and won't-play with its
 * reason). Metadata only; nothing is read until Open.
 * @param {object[]} lineages  `inventory().lineages`
 * @param {Map<string, object[]>} entriesByLineage  `entriesOf(id).entries`
 */
export function recentRowsOf(lineages, entriesByLineage) {
    const rows = [];
    for (const l of lineages) {
        const entries = entriesByLineage.get(l.lineage_id) ?? [];
        const versions = entries.filter((e) => !e.draft);
        const newest = versions.length ? versions[versions.length - 1] : null;
        const drafts = entries.filter((e) => e.draft).map((e) => ({
            entry_id: e.entry_id, parent: e.parent, saved_at: e.saved_at,
            wontPlay: e.wont_play?.why ?? null, tab_id: e.source?.tab_id ?? null, members: e.members,
        }));
        const latest = Math.max(0, ...entries.map((e) => e.saved_at ?? 0));
        rows.push({
            lineage_id: l.lineage_id,
            label: l.label ?? '(unnamed set)',
            versions: versions.length,
            newest: newest ? { entry_id: newest.entry_id, seq: newest.seq, members: newest.members, saved_at: newest.saved_at } : null,
            drafts,
            latest,
        });
    }
    return rows.sort((a, b) => b.latest - a.latest || (a.lineage_id < b.lineage_id ? -1 : 1));
}

/**
 * What Open reads for an entry: the set and overlay members BY FINGERPRINT, and the lineage the
 * session then continues (parent = this version; a draft's parent is the version it was drafted from).
 */
export function openPlanOf(entry, lineageId) {
    const ref = (role) => {
        const m = (entry.members ?? []).find((x) => x.role === role);
        return m ? { idKey: m.id_key, docId: m.doc_id, contentHash: m.content_hash } : null;
    };
    return {
        set: ref('set'),
        overlay: ref('overlay'),
        lineageId,
        parent: entry.draft ? (entry.parent ?? null) : entry.entry_id,
        draft: entry.draft === true,
    };
}

/** A non-`held` read, by name (never a fallback). */
export function readRefusalOf(role, ref, answer) {
    const at = `${role} ${ref.docId ?? '(no id)'} @ ${ref.contentHash}`;
    switch (answer.status) {
    case 'absent': return `NOT opened — the ${at} is not in the library (absent)`;
    case 'mismatch': return `NOT opened — the library holds ${ref.docId} only as ${answer.heldHashes.join(', ')}, not ${ref.contentHash} (mismatch)`;
    case 'corrupt': return `NOT opened — the stored ${at} is corrupt: ${answer.why}`;
    case 'unavailable': return `NOT opened — library unavailable (${answer.why})`;
    default: return `NOT opened — the ${at} answered ${answer.status}${answer.why ? `: ${answer.why}` : ''}`;
    }
}
