// frontend/modules/procgenCore/documentLibrary.js
//
// THE DOCUMENT LIBRARY: a versioned, fingerprint-checked store of whole
// document packages (a set, its overlay, its atlas, its rules …), shared by
// every page of the app through one browser database.
//
// ⛔ PURE. This file imports only `contentIdentity.js`. The storage BACKEND is
// injected (`documentLibraryMemory.js` for tests, `documentLibraryIdb.js` in a
// browser), and so are the clock and the id source.
//
// ⛔ GAME-NEUTRAL. Nothing here names a game, a substrate or a page. The
// `substrate` field of a version is a caller-supplied STRING that is stored
// and listed, never branched on. `documentLibrary.test.js` pins the word list.
//
// ── THE SAFETY RULE, ENFORCED HERE ─────────────────────────────────────
//
//   "Never the original rooms, never a different version of the set."
//
//   · There is NO read without a fingerprint. `get` takes
//     `{idKey, docId, contentHash}`, all three present, and THROWS
//     `LibraryReadError` by name when one is missing.
//   · The library RECOMPUTES the fingerprint on every read (`fnv1a32` over the
//     stored canonical string) and never trusts a hash written inside a
//     document. A stored row that no longer hashes to its key answers
//     `corrupt`, never `held`, and there is no fallback.
//   · The canonical string is MADE HERE, by `stableStringify`, from the
//     document handed to `saveVersion`. A caller can never supply the stored
//     bytes: a member carrying a `canonical` (or any other field beside
//     `role`/`idKey`/`doc`) is refused by name. A document whose own
//     `provenance.content_hash` disagrees with its content is NOT trusted and
//     NOT refused: it is stored with that field REPLACED by the computed hash,
//     and the save answers a `notes` line naming both. (Refusing would lose a
//     player's work: a lab session's set keeps its BASE's provenance through
//     every edit, because the lab stamps only at download, and a set that
//     fails validation cannot be stamped at all — measured, B1 as-built.)
//
// ── THE RECORD ─────────────────────────────────────────────────────────
//
//   docs      key `docKey(idKey, docId, hash)`; the body as `canonical` (the
//             document minus `provenance` and minus its id key — exactly
//             what `computeContentHash` hashes), `provenance` apart, sizes.
//             Content-addressed: versions that share a document store it once.
//   entries   one VERSION: `<lineage>#<seq>` (saved) or
//             `<lineage>#draft-<tab>-<members hash>` (a draft). Members name
//             documents by `{role, id_key, doc_id, content_hash}`.
//   lineages  a family of versions: `next_seq`, `head`, `label`.
//   holds     "something is using this entry": `game` / `world` (live while
//             heartbeating) or `pin` (durable until released).
//
//   Compound keys are STRINGS (`JSON.stringify([…])`), not IndexedDB array
//   keys, because a rules member has `id_key: null` and `null` is not a valid
//   component of an IndexedDB array key.
//
// ── WHAT IS REFUSED, BY NAME ───────────────────────────────────────────
//
//   Caller errors THROW (`LibraryReadError` / `LibraryWriteError`, with a
//   `code` from `READ_REFUSAL` / `WRITE_REFUSAL`). The state of the browser is
//   an ANSWER, never a throw: `unavailable` (no database), `failed` (a write
//   the browser refused, e.g. quota), `absent`, `mismatch`, `corrupt`.

import { fnv1a32, stableStringify } from './contentIdentity.js';

export const DEFAULT_LIBRARY_DB_NAME = 'archipelago-cc-document-library';

/**
 * WHICH DATABASE A PAGE USES (moved here from the lab writer in B5, so the app and the labs share ONE rule).
 * `?libraryDb=<name>` is the test seam (every row and check names its own); under automation
 * (`navigator.webdriver`) with no seam, a per-page-load name, so an automated run NEVER opens the default
 * library and no later page inherits its sets (js-22 L1); otherwise the app's one library.
 */
export function libraryDbNameOf({ search = '', webdriver = false, tabId = '' } = {}) {
    const named = new URLSearchParams(search).get('libraryDb');
    if (named) return named;
    if (webdriver === true) return `${DEFAULT_LIBRARY_DB_NAME}-auto-${tabId}`;
    return DEFAULT_LIBRARY_DB_NAME;
}

/** Versions kept per lineage (⚖ ruling Q3: "Last 10 + in use"). */
export const KEEP_SAVED_PER_LINEAGE = 10;
/**
 * A `game`/`world` hold is live while its heartbeat is younger than this.
 * ⛓ TEN MINUTES, not seconds (js-22): a browser throttles the timers of a
 * HIDDEN tab, down to one wake-up per minute after a few minutes hidden, so a
 * game left playing in a background tab heartbeats late. A short window would
 * let cleanup delete the version that running game came from.
 */
export const HOLD_STALE_MS = 10 * 60_000;
/**
 * How often a holder heartbeats while visible. The HOLDER (not this file,
 * which runs no timers) also heartbeats on `visibilitychange` → visible and on
 * `pageshow`.
 */
export const HOLD_HEARTBEAT_MS = 10_000;
/**
 * A DRAFT older than this, with no live hold, is deleted by the cleanup rule
 * (⚖ Robert, B2 Q2: "By hand + auto after 7 days"). A tab closed without a
 * save point leaves its rolling draft behind; this is what removes it. A
 * NUMBERED version is never deleted for its age (⚖ Q3: last 10 + in use + head).
 */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/**
 * Why a version was written (⚖ ruling Q1: "Save points"). A DRAFT is written
 * with `draft`; a numbered version with one of the save points.
 */
export const SAVE_POINTS = Object.freeze(['room-close', 'report', 'download', 'handover']);
export const DRAFT_REASON = 'draft';

export const HOLDER_KINDS = Object.freeze(['game', 'world', 'pin']);
const HEARTBEAT_KINDS = new Set(['game', 'world']);

/** The id key a document WITHOUT an id is hashed under (`computeContentHash(doc, {idKey: NO_ID_KEY})`). */
export const NO_ID_KEY = '__none';

export const READ_REFUSAL = Object.freeze({
    notAnObject: 'read-query-not-an-object',
    missingIdKey: 'read-missing-id-key',
    missingDocId: 'read-missing-doc-id',
    missingContentHash: 'read-missing-content-hash',
    badContentHash: 'read-bad-content-hash',
    badIdKey: 'read-bad-id-key',
    badDocId: 'read-bad-doc-id',
    badEntryId: 'read-bad-entry-id',
    badLineageId: 'read-bad-lineage-id',
});

export const WRITE_REFUSAL = Object.freeze({
    notAnObject: 'write-request-not-an-object',
    unknownField: 'write-unknown-field',
    lineageShape: 'write-lineage-id-shape',
    lineageUnknown: 'write-lineage-unknown',
    parentShape: 'write-parent-shape',
    draftShape: 'write-draft-not-boolean',
    savedBecauseUnknown: 'write-saved-because-unknown',
    savedBecauseDraftMismatch: 'write-saved-because-draft-mismatch',
    wontPlayShape: 'write-wont-play-shape',
    wontPlayNotDraft: 'write-wont-play-not-draft',
    substrateShape: 'write-substrate-shape',
    sourceShape: 'write-source-shape',
    labelShape: 'write-label-shape',
    membersMissing: 'write-members-missing',
    memberShape: 'write-member-shape',
    memberCarriesCanonical: 'write-member-carries-canonical',
    memberUnknownField: 'write-member-unknown-field',
    idKeyShape: 'write-id-key-shape',
    docIdMissing: 'write-doc-id-missing',
    reservedKey: 'write-reserved-key',
    notJsonClean: 'write-not-json-clean',
    hashCollision: 'write-hash-collision',
    holderShape: 'write-holder-shape',
    holderKindUnknown: 'write-holder-kind-unknown',
    holdIdShape: 'write-hold-id-shape',
    entryIdShape: 'write-entry-id-shape',
    nowShape: 'write-now-shape',
    optionsShape: 'write-options-shape',
});

export class LibraryReadError extends Error {
    constructor(code, detail) {
        super(`${code}: ${detail}`);
        this.name = 'LibraryReadError';
        this.code = code;
    }
}

export class LibraryWriteError extends Error {
    constructor(code, detail) {
        super(`${code}: ${detail}`);
        this.name = 'LibraryWriteError';
        this.code = code;
    }
}

/**
 * Thrown by a BACKEND when it has no database (no IndexedDB, the open failed,
 * a newer schema). The library turns it into the `unavailable` answer.
 */
export class LibraryUnavailableError extends Error {
    constructor(why) {
        super(`unavailable: ${why}`);
        this.name = 'LibraryUnavailableError';
        this.why = why;
    }
}

/**
 * The stores and indexes, as data: both backends build from this one table.
 * A later schema adds a numbered entry to `migrations` and never rewrites
 * `docs` (content hashes are a contract, `contentIdentity.js`).
 */
export const LIBRARY_SCHEMA = Object.freeze({
    version: 1,
    stores: Object.freeze({
        docs: Object.freeze({ keyPath: 'key', indexes: Object.freeze({ by_id: Object.freeze({ keyPath: 'id_ref' }) }) }),
        entries: Object.freeze({
            keyPath: 'entry_id',
            indexes: Object.freeze({
                by_lineage: Object.freeze({ keyPath: 'lineage_id' }),
                by_member: Object.freeze({ keyPath: 'member_keys', multiEntry: true }),
            }),
        }),
        lineages: Object.freeze({ keyPath: 'lineage_id', indexes: Object.freeze({}) }),
        holds: Object.freeze({ keyPath: 'hold_id', indexes: Object.freeze({ by_entry: Object.freeze({ keyPath: 'entry_id' }) }) }),
    }),
});

const ALL_STORES = Object.freeze(Object.keys(LIBRARY_SCHEMA.stores));
const HASH_RE = /^[0-9a-f]{8}$/;
const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/** The `docs` key of one document. */
export function docKey(idKey, docId, contentHash) {
    return JSON.stringify([idKey, docId, contentHash]);
}

function idRef(idKey, docId) {
    return JSON.stringify([idKey, docId]);
}

function utf8Bytes(str) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(str).length;
    return str.length;
}

/**
 * THE canonical string of a document under `idKey`: `stableStringify` of the
 * document minus `provenance` and minus `idKey` — the same content
 * `computeContentHash` hashes, so `fnv1a32(canonical) === computeContentHash`.
 * Refuses (throws by name) a document that would not survive the round trip.
 */
export function canonicalOf(doc, idKey) {
    const content = { ...doc };
    delete content.provenance;
    delete content[idKey ?? NO_ID_KEY];
    const canonical = stableStringify(content);
    let parsed;
    try {
        parsed = JSON.parse(canonical);
    } catch (e) {
        throw new LibraryWriteError(WRITE_REFUSAL.notJsonClean,
            `the document does not encode as JSON (an undefined value, a function, a sparse array …): ${e.message}`);
    }
    if (stableStringify(parsed) !== canonical) {
        throw new LibraryWriteError(WRITE_REFUSAL.notJsonClean, 'the document does not round-trip through JSON');
    }
    return canonical;
}

function jsonCleanCopy(value, what) {
    if (value === undefined) return undefined;
    const s = stableStringify(value);
    try {
        const back = JSON.parse(s);
        if (stableStringify(back) === s) return back;
    } catch { /* fall through */ }
    throw new LibraryWriteError(WRITE_REFUSAL.notJsonClean, `${what} does not round-trip through JSON`);
}

const MEMBER_FIELDS = new Set(['role', 'idKey', 'doc']);
const SAVE_FIELDS = new Set(['lineageId', 'parent', 'draft', 'members', 'substrate', 'source', 'savedBecause', 'wontPlay', 'label']);

/** Validate + canonicalise one member; no backend touched. */
function prepareMember(member, index) {
    const at = `members[${index}]`;
    if (!isPlainObject(member)) throw new LibraryWriteError(WRITE_REFUSAL.memberShape, `${at} is not an object`);
    if ('canonical' in member) {
        throw new LibraryWriteError(WRITE_REFUSAL.memberCarriesCanonical,
            `${at} carries its own canonical string; the library makes the canonical string itself`);
    }
    for (const k of Object.keys(member)) {
        if (!MEMBER_FIELDS.has(k)) {
            throw new LibraryWriteError(WRITE_REFUSAL.memberUnknownField,
                `${at}.${k}: a member is exactly {role, idKey, doc}; nothing is accepted beside the document`);
        }
    }
    if (!isNonEmptyString(member.role)) throw new LibraryWriteError(WRITE_REFUSAL.memberShape, `${at}.role is not a non-empty string`);
    if (!isPlainObject(member.doc)) throw new LibraryWriteError(WRITE_REFUSAL.memberShape, `${at}.doc is not a plain object`);
    const idKey = member.idKey;
    if (!(idKey === null || isNonEmptyString(idKey))) {
        throw new LibraryWriteError(WRITE_REFUSAL.idKeyShape, `${at}.idKey must be a non-empty string or null`);
    }
    const doc = member.doc;
    let docId = null;
    if (idKey !== null) {
        docId = doc[idKey];
        if (!isNonEmptyString(docId)) throw new LibraryWriteError(WRITE_REFUSAL.docIdMissing, `${at}.doc.${idKey} is not a non-empty string`);
    } else if (Object.prototype.hasOwnProperty.call(doc, NO_ID_KEY)) {
        throw new LibraryWriteError(WRITE_REFUSAL.reservedKey, `${at}.doc has a "${NO_ID_KEY}" field, which an id-less document is hashed without`);
    }
    const canonical = canonicalOf(doc, idKey);
    const hash = fnv1a32(canonical);
    const hasProvenance = Object.prototype.hasOwnProperty.call(doc, 'provenance');
    const provenance = hasProvenance ? jsonCleanCopy(doc.provenance, `${at}.doc.provenance`) : undefined;
    const declared = isPlainObject(provenance) ? provenance.content_hash : undefined;
    const notes = [];
    if (declared !== undefined && declared !== hash) {
        // ⛓ never trusted, never refused: the stored provenance carries the hash of the stored bytes
        provenance.content_hash = hash;
        notes.push(`${at} (${member.role}${docId ? ` ${docId}` : ''}): provenance hash replaced: was ${JSON.stringify(declared)}, content is ${hash}`);
    }
    return {
        role: member.role, idKey, docId, hash, canonical, hasProvenance, provenance, notes,
        key: docKey(idKey, docId, hash), sizeBytes: utf8Bytes(canonical),
    };
}

function validateSave(req) {
    if (!isPlainObject(req)) throw new LibraryWriteError(WRITE_REFUSAL.notAnObject, 'saveVersion takes one object');
    for (const k of Object.keys(req)) {
        if (!SAVE_FIELDS.has(k)) throw new LibraryWriteError(WRITE_REFUSAL.unknownField, `saveVersion: unknown field "${k}"`);
    }
    const { lineageId = null, parent = null, draft, savedBecause, wontPlay = null, substrate, source, label = null } = req;
    if (!(lineageId === null || isNonEmptyString(lineageId))) throw new LibraryWriteError(WRITE_REFUSAL.lineageShape, 'lineageId must be a non-empty string or null');
    if (!(parent === null || isNonEmptyString(parent))) throw new LibraryWriteError(WRITE_REFUSAL.parentShape, 'parent must be an entry id or null');
    if (typeof draft !== 'boolean') throw new LibraryWriteError(WRITE_REFUSAL.draftShape, 'draft must be true or false');
    if (savedBecause !== DRAFT_REASON && !SAVE_POINTS.includes(savedBecause)) {
        throw new LibraryWriteError(WRITE_REFUSAL.savedBecauseUnknown,
            `savedBecause ${JSON.stringify(savedBecause)} is not "${DRAFT_REASON}" or a save point (${SAVE_POINTS.join(', ')})`);
    }
    if (draft !== (savedBecause === DRAFT_REASON)) {
        throw new LibraryWriteError(WRITE_REFUSAL.savedBecauseDraftMismatch,
            draft ? `a draft is saved because "${DRAFT_REASON}", not ${JSON.stringify(savedBecause)}`
                : `a numbered version needs a save point, not "${DRAFT_REASON}"`);
    }
    if (!(wontPlay === null || isNonEmptyString(wontPlay))) throw new LibraryWriteError(WRITE_REFUSAL.wontPlayShape, 'wontPlay must be null or the reason, a non-empty string');
    if (wontPlay !== null && !draft) {
        throw new LibraryWriteError(WRITE_REFUSAL.wontPlayNotDraft, `a set that won't play is saved only as a DRAFT (${wontPlay})`);
    }
    if (!isNonEmptyString(substrate)) throw new LibraryWriteError(WRITE_REFUSAL.substrateShape, 'substrate must be a non-empty string');
    if (!isPlainObject(source) || !isNonEmptyString(source.page) || !isNonEmptyString(source.tab_id)) {
        throw new LibraryWriteError(WRITE_REFUSAL.sourceShape, 'source must be {page, tab_id}, both non-empty strings');
    }
    if (!(label === null || typeof label === 'string')) throw new LibraryWriteError(WRITE_REFUSAL.labelShape, 'label must be a string or null');
    if (!Array.isArray(req.members) || req.members.length === 0) throw new LibraryWriteError(WRITE_REFUSAL.membersMissing, 'members must be a non-empty array');
    const members = req.members.map(prepareMember);
    return { lineageId, parent, draft, savedBecause, wontPlay, substrate, source: { page: source.page, tab_id: source.tab_id }, label, members };
}

function defaultRandomId() {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const metaOfEntry = (e) => ({
    entry_id: e.entry_id, lineage_id: e.lineage_id, seq: e.seq, parent: e.parent, draft: e.draft,
    wont_play: e.wont_play, primary: e.primary, members: e.members, substrate: e.substrate, source: e.source,
    saved_at: e.saved_at, saved_because: e.saved_because, size_bytes: e.size_bytes, label: e.label,
});

/** Is this hold keeping its entry? `pin` always; `game`/`world` while heartbeating. */
export function holdIsLive(hold, now) {
    if (!HEARTBEAT_KINDS.has(hold.holder.kind)) return true;
    return now - hold.heartbeat_at < HOLD_STALE_MS;
}

/** Is this draft past `DRAFT_MAX_AGE_MS` at `now`? (The same boundary style as `holdIsLive`: old at ≥.) */
export function draftIsOld(entry, now) {
    return entry.draft === true && now - entry.saved_at >= DRAFT_MAX_AGE_MS;
}

/** A live hold, named for a refusal: what holds it and from which tab. */
const holdName = (h) => ({ hold_id: h.hold_id, entry_id: h.entry_id, kind: h.holder.kind, tab_id: h.holder.tab_id, what: h.holder.what ?? null });

/**
 * @param {{backend: object, now?: () => number, randomId?: () => string}} options
 */
export function createDocumentLibrary({ backend, now = Date.now, randomId = defaultRandomId } = {}) {
    if (!backend || typeof backend.transaction !== 'function') throw new TypeError('createDocumentLibrary: backend.transaction is required');

    /** Run `fn` in one transaction; the browser's state becomes an answer. */
    async function run(stores, mode, fn) {
        try {
            return { ok: true, value: await backend.transaction(stores, mode, fn) };
        } catch (e) {
            if (e instanceof LibraryReadError || e instanceof LibraryWriteError) throw e;
            if (e instanceof LibraryUnavailableError || e?.name === 'LibraryUnavailableError') return { ok: false, answer: { status: 'unavailable', why: e.why ?? e.message } };
            return { ok: false, answer: { status: 'failed', why: `${e?.name ?? 'Error'}: ${e?.message ?? String(e)}` } };
        }
    }

    /** The cleanup rule for one lineage, inside an open readwrite transaction. */
    async function cleanLineage(tx, lineageId, at) {
        const lineage = await tx.get('lineages', lineageId);
        const entries = await tx.getAll('entries', { index: 'by_lineage', value: lineageId });
        const saved = entries.filter((e) => !e.draft).sort((a, b) => b.seq - a.seq);
        const keep = new Set(saved.slice(0, KEEP_SAVED_PER_LINEAGE).map((e) => e.entry_id));
        if (lineage?.head) keep.add(lineage.head);
        const deleted = [];
        const touchedDocs = new Set();
        for (const e of entries) {
            if (keep.has(e.entry_id)) continue;
            // A draft leaves by collapse (see saveVersion) or, here, once older than DRAFT_MAX_AGE_MS (⚖ Q2).
            if (e.draft && !draftIsOld(e, at)) continue;
            const holds = await tx.getAll('holds', { index: 'by_entry', value: e.entry_id });
            if (holds.some((h) => holdIsLive(h, at))) continue;
            for (const h of holds) await tx.delete('holds', h.hold_id);
            await tx.delete('entries', e.entry_id);
            deleted.push(e.entry_id);
            for (const k of e.member_keys) touchedDocs.add(k);
        }
        return { deleted, touchedDocs };
    }

    /** Delete each doc in `keys` that no entry names any more. */
    async function sweepDocs(tx, keys) {
        const gone = [];
        for (const k of keys) {
            const users = await tx.getAll('entries', { index: 'by_member', value: k });
            if (users.length === 0) {
                await tx.delete('docs', k);
                gone.push(k);
            }
        }
        return gone;
    }

    /** Delete an unheld entry (a collapsing draft), its stale holds and orphaned docs. */
    async function dropIfUnheld(tx, entry, at, touchedDocs) {
        const holds = await tx.getAll('holds', { index: 'by_entry', value: entry.entry_id });
        if (holds.some((h) => holdIsLive(h, at))) return false;
        for (const h of holds) await tx.delete('holds', h.hold_id);
        await tx.delete('entries', entry.entry_id);
        for (const k of entry.member_keys) touchedDocs.add(k);
        return true;
    }

    async function saveVersion(request) {
        const v = validateSave(request);
        const at = now();
        const mintedId = v.lineageId === null ? randomId() : null;
        const r = await run(ALL_STORES, 'readwrite', async (tx) => {
            // ⛓ The seq is read AND written in THIS transaction: two tabs never get one number.
            let lineage;
            if (v.lineageId === null) {
                lineage = { lineage_id: mintedId, next_seq: 1, label: v.label, created_at: at, head: null };
            } else {
                lineage = await tx.get('lineages', v.lineageId);
                if (!lineage) throw new LibraryWriteError(WRITE_REFUSAL.lineageUnknown, `no lineage ${v.lineageId} in this library`);
            }
            for (const m of v.members) {
                const held = await tx.get('docs', m.key);
                if (held) {
                    if (held.canonical !== m.canonical) {
                        throw new LibraryWriteError(WRITE_REFUSAL.hashCollision,
                            `${m.docId ?? m.role}@${m.hash}: a different document is already held under this id and fingerprint`);
                    }
                    continue;
                }
                await tx.put('docs', {
                    key: m.key, id_ref: idRef(m.idKey, m.docId), id_key: m.idKey, doc_id: m.docId, content_hash: m.hash,
                    canonical: m.canonical, has_provenance: m.hasProvenance, provenance: m.provenance ?? null,
                    size_bytes: m.sizeBytes, first_saved_at: at,
                });
            }
            const memberKeys = [...new Set(v.members.map((m) => m.key))];
            const lid = lineage.lineage_id;
            const tab = v.source.tab_id;
            let seq = null;
            let entryId;
            if (v.draft) {
                entryId = `${lid}#draft-${tab}-${fnv1a32(JSON.stringify(v.members.map((m) => [m.role, m.key])))}`;
            } else {
                seq = lineage.next_seq;
                entryId = `${lid}#${seq}`;
                lineage.next_seq = seq + 1;
                lineage.head = entryId;
            }
            if (v.label !== null) lineage.label = v.label;
            await tx.put('lineages', lineage);
            const first = v.members[0];
            await tx.put('entries', {
                entry_id: entryId, lineage_id: lid, seq, parent: v.parent, draft: v.draft,
                wont_play: v.wontPlay === null ? null : { why: v.wontPlay },
                primary: { role: first.role, id_key: first.idKey, doc_id: first.docId, content_hash: first.hash },
                members: v.members.map((m) => ({ role: m.role, id_key: m.idKey, doc_id: m.docId, content_hash: m.hash })),
                member_keys: memberKeys, substrate: v.substrate, source: v.source, saved_at: at,
                saved_because: v.savedBecause, size_bytes: v.members.reduce((s, m) => s + m.sizeBytes, 0), label: v.label,
            });
            // Drafts collapse: this tab's OTHER drafts of this lineage go, unless held.
            const touchedDocs = new Set();
            const collapsed = [];
            const siblings = await tx.getAll('entries', { index: 'by_lineage', value: lid });
            for (const e of siblings) {
                if (!e.draft || e.entry_id === entryId || e.source?.tab_id !== tab) continue;
                if (await dropIfUnheld(tx, e, at, touchedDocs)) collapsed.push(e.entry_id);
            }
            const cleaned = await cleanLineage(tx, lid, at);
            for (const k of cleaned.touchedDocs) touchedDocs.add(k);
            await sweepDocs(tx, touchedDocs);
            return { entry_id: entryId, seq, lineage_id: lid, collapsed, deleted: cleaned.deleted, notes: v.members.flatMap((m) => m.notes) };
        });
        if (!r.ok) return r.answer;
        return { status: 'saved', ...r.value };
    }

    function checkReadQuery(q) {
        if (!isPlainObject(q)) throw new LibraryReadError(READ_REFUSAL.notAnObject, 'get takes {idKey, docId, contentHash}');
        if (!('idKey' in q)) throw new LibraryReadError(READ_REFUSAL.missingIdKey, 'get: idKey is required (null for a document without an id)');
        if (!('docId' in q)) throw new LibraryReadError(READ_REFUSAL.missingDocId, 'get: docId is required (null for a document without an id)');
        if (!('contentHash' in q) || q.contentHash == null) {
            throw new LibraryReadError(READ_REFUSAL.missingContentHash, 'get: contentHash is required — there is no read without a fingerprint');
        }
        if (typeof q.contentHash !== 'string' || !HASH_RE.test(q.contentHash)) {
            throw new LibraryReadError(READ_REFUSAL.badContentHash, `get: contentHash ${JSON.stringify(q.contentHash)} is not 8 lowercase hex digits`);
        }
        if (!(q.idKey === null || isNonEmptyString(q.idKey))) throw new LibraryReadError(READ_REFUSAL.badIdKey, 'get: idKey must be a non-empty string or null');
        if (q.idKey === null ? q.docId !== null : !isNonEmptyString(q.docId)) {
            throw new LibraryReadError(READ_REFUSAL.badDocId, 'get: docId must be a non-empty string, or null exactly when idKey is null');
        }
    }

    async function get(query) {
        checkReadQuery(query);
        const { idKey, docId, contentHash } = query;
        const r = await run(['docs', 'entries'], 'readonly', async (tx) => {
            const key = docKey(idKey, docId, contentHash);
            const row = await tx.get('docs', key);
            if (!row) {
                if (docId === null) return { status: 'absent' };
                const others = await tx.getAll('docs', { index: 'by_id', value: idRef(idKey, docId) });
                if (others.length === 0) return { status: 'absent' };
                return { status: 'mismatch', heldHashes: others.map((d) => d.content_hash).sort() };
            }
            // ⛓ The fingerprint is RECOMPUTED from the stored bytes; nothing written inside the row is trusted.
            const computed = typeof row.canonical === 'string' ? fnv1a32(row.canonical) : null;
            if (computed !== contentHash) return { status: 'corrupt', why: `the stored body hashes to ${computed}, not ${contentHash}` };
            const declared = isPlainObject(row.provenance) ? row.provenance.content_hash : undefined;
            if (declared !== undefined && declared !== contentHash) {
                return { status: 'corrupt', why: `the stored provenance claims ${JSON.stringify(declared)}` };
            }
            let doc;
            try {
                doc = JSON.parse(row.canonical);
            } catch (e) {
                return { status: 'corrupt', why: `the stored body does not parse: ${e.message}` };
            }
            if (idKey !== null) doc[idKey] = docId;
            if (row.has_provenance) doc.provenance = row.provenance;
            const users = await tx.getAll('entries', { index: 'by_member', value: key });
            const entries = users.map((e) => ({ entry_id: e.entry_id, draft: e.draft, wont_play: e.wont_play, seq: e.seq }));
            return { status: 'held', doc, contentHash, entries };
        });
        return r.ok ? r.value : r.answer;
    }

    async function getEntry(entryId) {
        if (!isNonEmptyString(entryId)) throw new LibraryReadError(READ_REFUSAL.badEntryId, 'getEntry takes an entry id');
        const r = await run(['entries'], 'readonly', async (tx) => {
            const e = await tx.get('entries', entryId);
            return e ? { status: 'held', entry: metaOfEntry(e) } : { status: 'absent' };
        });
        return r.ok ? r.value : r.answer;
    }

    /** A lineage's versions (metadata only; no bodies): saved by seq ascending, then drafts by time. */
    async function entriesOf(lineageId) {
        if (!isNonEmptyString(lineageId)) throw new LibraryReadError(READ_REFUSAL.badLineageId, 'entriesOf takes a lineage id');
        const r = await run(['entries'], 'readonly', async (tx) => {
            const all = await tx.getAll('entries', { index: 'by_lineage', value: lineageId });
            const saved = all.filter((e) => !e.draft).sort((a, b) => a.seq - b.seq);
            const drafts = all.filter((e) => e.draft).sort((a, b) => a.saved_at - b.saved_at || (a.entry_id < b.entry_id ? -1 : 1));
            return { status: 'ok', entries: [...saved, ...drafts].map(metaOfEntry) };
        });
        return r.ok ? r.value : r.answer;
    }

    async function lineages() {
        const r = await run(['lineages'], 'readonly', async (tx) => {
            const all = await tx.getAll('lineages');
            return { status: 'ok', lineages: all.sort((a, b) => a.created_at - b.created_at || (a.lineage_id < b.lineage_id ? -1 : 1)) };
        });
        return r.ok ? r.value : r.answer;
    }

    async function hold(entryId, holder) {
        if (!isNonEmptyString(entryId)) throw new LibraryWriteError(WRITE_REFUSAL.entryIdShape, 'hold takes an entry id');
        if (!isPlainObject(holder) || !isNonEmptyString(holder.tab_id) || !(holder.what === undefined || typeof holder.what === 'string')) {
            throw new LibraryWriteError(WRITE_REFUSAL.holderShape, 'holder must be {kind, tab_id, what?}');
        }
        if (!HOLDER_KINDS.includes(holder.kind)) {
            throw new LibraryWriteError(WRITE_REFUSAL.holderKindUnknown, `holder kind ${JSON.stringify(holder.kind)} is not one of ${HOLDER_KINDS.join(', ')}`);
        }
        const at = now();
        const holdId = randomId();
        const r = await run(['entries', 'holds'], 'readwrite', async (tx) => {
            if (!(await tx.get('entries', entryId))) return { status: 'absent' };
            await tx.put('holds', {
                hold_id: holdId, entry_id: entryId,
                holder: { kind: holder.kind, tab_id: holder.tab_id, what: holder.what ?? null },
                heartbeat_at: at, created_at: at,
            });
            return { status: 'held', hold_id: holdId };
        });
        return r.ok ? r.value : r.answer;
    }

    /** Refresh a hold. `gone` = the hold no longer exists (its entry was cleaned while it was stale): hold again. */
    async function heartbeat(holdId) {
        if (!isNonEmptyString(holdId)) throw new LibraryWriteError(WRITE_REFUSAL.holdIdShape, 'heartbeat takes a hold id');
        const at = now();
        const r = await run(['holds'], 'readwrite', async (tx) => {
            const h = await tx.get('holds', holdId);
            if (!h) return { status: 'gone' };
            h.heartbeat_at = at;
            await tx.put('holds', h);
            return { status: 'live' };
        });
        return r.ok ? r.value : r.answer;
    }

    async function release(holdId) {
        if (!isNonEmptyString(holdId)) throw new LibraryWriteError(WRITE_REFUSAL.holdIdShape, 'release takes a hold id');
        const r = await run(['holds'], 'readwrite', async (tx) => {
            if (!(await tx.get('holds', holdId))) return { status: 'absent' };
            await tx.delete('holds', holdId);
            return { status: 'released' };
        });
        return r.ok ? r.value : r.answer;
    }

    /** The cleanup rule over every lineage, in ONE readwrite transaction (holds are re-read in it). */
    async function cleanup({ now: at } = {}) {
        if (!Number.isFinite(at)) throw new LibraryWriteError(WRITE_REFUSAL.nowShape, 'cleanup takes {now} in ms');
        const r = await run(ALL_STORES, 'readwrite', async (tx) => {
            const all = await tx.getAll('lineages');
            const deleted = [];
            const touched = new Set();
            for (const l of all) {
                const c = await cleanLineage(tx, l.lineage_id, at);
                deleted.push(...c.deleted);
                for (const k of c.touchedDocs) touched.add(k);
            }
            const deletedDocs = await sweepDocs(tx, touched);
            return { status: 'cleaned', deletedEntries: deleted, deletedDocs };
        });
        return r.ok ? r.value : r.answer;
    }

    async function estimate() {
        const r = await run(ALL_STORES, 'readonly', async (tx) => {
            const docs = await tx.getAll('docs');
            const counts = {};
            for (const s of ALL_STORES) counts[s] = s === 'docs' ? docs.length : (await tx.getAll(s)).length;
            return { counts, bodyBytes: docs.reduce((s, d) => s + (d.size_bytes ?? 0), 0) };
        });
        if (!r.ok) return r.answer;
        let browser = null;
        if (typeof backend.estimate === 'function') {
            try { browser = await backend.estimate(); } catch { browser = null; }
        }
        return { status: 'ok', ...r.value, browser };
    }

    /**
     * Every lineage with its versions, drafts, distinct body bytes and LIVE holds
     * (any tab's: the holds store is read, not this page's memory), for a
     * listing. Metadata only; no body is parsed.
     */
    async function inventory() {
        const at = now();
        const r = await run(ALL_STORES, 'readonly', async (tx) => {
            const [lins, entries, holds, docs] = await Promise.all([
                tx.getAll('lineages'), tx.getAll('entries'), tx.getAll('holds'), tx.getAll('docs'),
            ]);
            const docBytes = new Map(docs.map((d) => [d.key, d.size_bytes ?? 0]));
            const liveByEntry = new Map();
            for (const h of holds) {
                if (!holdIsLive(h, at)) continue;
                if (!liveByEntry.has(h.entry_id)) liveByEntry.set(h.entry_id, []);
                liveByEntry.get(h.entry_id).push(holdName(h));
            }
            const out = lins.sort((a, b) => a.created_at - b.created_at || (a.lineage_id < b.lineage_id ? -1 : 1)).map((l) => {
                const mine = entries.filter((e) => e.lineage_id === l.lineage_id);
                const keys = new Set(mine.flatMap((e) => e.member_keys));
                return {
                    lineage_id: l.lineage_id, label: l.label, head: l.head, created_at: l.created_at,
                    versions: mine.filter((e) => !e.draft).length,
                    drafts: mine.filter((e) => e.draft).length,
                    oldDrafts: mine.filter((e) => draftIsOld(e, at)).length,
                    bytes: [...keys].reduce((sum, k) => sum + (docBytes.get(k) ?? 0), 0),
                    liveHolds: mine.flatMap((e) => liveByEntry.get(e.entry_id) ?? []),
                };
            });
            return { status: 'ok', at, lineages: out };
        });
        return r.ok ? r.value : r.answer;
    }

    /**
     * Delete one lineage: its entries, their stale holds, the lineage record, and
     * every document no remaining entry names — in ONE readwrite transaction that
     * re-reads the holds. REFUSED, by name, when any of its entries has a LIVE
     * hold (a pin, or a game/world hold heartbeating within HOLD_STALE_MS) from
     * ANY tab: `{status: 'refused', why: 'held', heldBy: [{entry_id, kind, tab_id, what}]}`.
     * ⚠ A tab still editing this lineage gets `write-lineage-unknown` on its next
     * save (the writer's job to handle: mint a new lineage).
     */
    async function deleteLineage(lineageId) {
        if (!isNonEmptyString(lineageId)) throw new LibraryWriteError(WRITE_REFUSAL.lineageShape, 'deleteLineage takes a lineage id');
        const at = now();
        const r = await run(ALL_STORES, 'readwrite', async (tx) => {
            const lineage = await tx.get('lineages', lineageId);
            if (!lineage) return { status: 'absent' };
            const entries = await tx.getAll('entries', { index: 'by_lineage', value: lineageId });
            const heldBy = [];
            const stale = [];
            for (const e of entries) {
                for (const h of await tx.getAll('holds', { index: 'by_entry', value: e.entry_id })) {
                    if (holdIsLive(h, at)) heldBy.push(holdName(h));
                    else stale.push(h.hold_id);
                }
            }
            if (heldBy.length) return { status: 'refused', why: 'held', lineage_id: lineageId, label: lineage.label, heldBy };
            const touched = new Set();
            for (const id of stale) await tx.delete('holds', id);
            for (const e of entries) {
                await tx.delete('entries', e.entry_id);
                for (const k of e.member_keys) touched.add(k);
            }
            await tx.delete('lineages', lineageId);
            const deletedDocs = await sweepDocs(tx, touched);
            return { status: 'deleted', lineage_id: lineageId, deletedEntries: entries.map((e) => e.entry_id).sort(), deletedDocs };
        });
        return r.ok ? r.value : r.answer;
    }

    /**
     * Delete DRAFTS (by hand: the Storage panel's "Clear leftover drafts", ⚖ Q2):
     * every draft with no live hold, or only those of `lineageId`, in ONE
     * readwrite transaction; documents no remaining entry names are swept. A held
     * draft is KEPT and named in `kept`. Numbered versions and lineages are never
     * touched.
     */
    async function deleteDrafts(options = {}) {
        if (!isPlainObject(options)) throw new LibraryWriteError(WRITE_REFUSAL.optionsShape, 'deleteDrafts takes {lineageId?}');
        const { lineageId = null } = options;
        if (!(lineageId === null || isNonEmptyString(lineageId))) throw new LibraryWriteError(WRITE_REFUSAL.lineageShape, 'deleteDrafts: lineageId must be a lineage id or null');
        const at = now();
        const r = await run(ALL_STORES, 'readwrite', async (tx) => {
            const all = lineageId === null ? await tx.getAll('entries') : await tx.getAll('entries', { index: 'by_lineage', value: lineageId });
            const touched = new Set();
            const deleted = [];
            const kept = [];
            for (const e of all) {
                if (!e.draft) continue;
                const holds = await tx.getAll('holds', { index: 'by_entry', value: e.entry_id });
                const live = holds.filter((h) => holdIsLive(h, at));
                if (live.length) { kept.push(...live.map(holdName)); continue; }
                await dropIfUnheld(tx, e, at, touched);
                deleted.push(e.entry_id);
            }
            const deletedDocs = await sweepDocs(tx, touched);
            return { status: 'deleted', deletedEntries: deleted.sort(), deletedDocs, kept };
        });
        return r.ok ? r.value : r.answer;
    }

    return { saveVersion, get, getEntry, entriesOf, lineages, hold, heartbeat, release, cleanup, estimate, inventory, deleteLineage, deleteDrafts };
}
