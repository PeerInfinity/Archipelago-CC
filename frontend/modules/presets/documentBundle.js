// frontend/modules/presets/documentBundle.js
/**
 * ⛓⛓⛓ **THE BUNDLE — A ZIP WHOSE MEMBERS *ARE* THE EXISTING DOCUMENTS.**
 *
 * EDITOR v3 slice E1c (`CC/docs/plans/seedling-editor-v3.md` §25; ⚖ the user's
 * 2026-08-25 ruling, plan §22.8 items 2–4).
 *
 * ── ⚖ WHAT THE RULING SETTLED, AND WHAT THIS MODULE THEREFORE IS NOT ───
 *
 * The single `rules.json` stays **CANONICAL** and always loadable. A bundle is
 * the OPTIONAL multi-document CONTAINER, and its members are exactly the four
 * documents this repo already writes:
 *
 *   `rules`         a rules.json — `schema_version === 3`, `regions` an object
 *   `level-set`     a Seedling level set — `rooms` an ARRAY (positions are ids)
 *   `overlay`       the set's rule/location overlay — `rooms` keyed BY INDEX
 *   `region-atlas`  a region atlas — `atlas_id` + `regions[].region_id`
 *
 * ⛔ **THERE IS NO MANIFEST.** A manifest would be a SECOND description of four
 * documents that already describe themselves, and the two would disagree the
 * first time somebody edited one and not the other. The kind is DERIVED FROM
 * THE DOCUMENT — never from the entry name — which is also why `readBundle`
 * survives a member somebody renamed.
 *
 * ⛔ **AND `.chunks.json` IS NOT A MEMBER** (§24.12). Chunking is DELIVERY: it
 * is how a set too big for one response is *shipped*, not a document anybody
 * authored. A bundle that carried one would be a container describing its own
 * transport, and the reader would have to decide which of the two is the set.
 * It is REFUSED BY NAME here rather than ignored, because ignoring it silently
 * is exactly how a half-delivered set would look like a whole one.
 *
 * ── ⛓ ONE CLASSIFIER, TWO CALLERS ─────────────────────────────────────
 *
 * `classifyDocument` is ALSO what `watchViewer.js`'s `sniffLoadBox` uses for
 * its JSON branch (D2's sniff, lifted). A second copy would be a second answer
 * to "what is this document", and the two would drift on the first new field.
 *
 * ── ⛓ JSZip IS INJECTED, NEVER IMPORTED ───────────────────────────────
 *
 * `frontend/libs/jszip/jszip.min.js` is a vendored **UMD** script, not an ESM
 * module: the page injects it with a `<script>` tag (`presetUI.loadJSZip()`),
 * node evaluates it (`scripts/procgen/loadJSZipNode.mjs`). Either way it
 * arrives here as a parameter, so this module has no environment of its own —
 * and the repo keeps ONE zip implementation instead of the hand-written second
 * one the ruling refuses.
 */

import { makeRulesJsonScaffold, stringifyRulesJson } from '../shared/rulesJsonBuilder.js';

/**
 * ⛓ **THE rules.json SCHEMA VERSION IS READ OFF THE WRITER**, not typed here.
 * `stateManager/core/initialization.js:137` and `makeRulesJsonScaffold` are the
 * two places that already know it; a third literal would be the one that goes
 * stale on a schema bump, and it would go stale in the direction that makes a
 * bundle's rules member classify as "unknown" while the app still loads it.
 */
export const RULES_SCHEMA_VERSION = makeRulesJsonScaffold({
    gameName: 'probe', gameDirectory: 'probe', worldClassName: 'ProbeWorld',
}).schema_version;

/**
 * ⛓ THE MEMBER KINDS, IN THE ORDER A BUNDLE CARRIES THEM. The order is FIXED
 * and not the caller's, because it is half of what makes two writes of the same
 * four documents the same bytes.
 */
export const BUNDLE_KINDS = Object.freeze(['rules', 'level-set', 'overlay', 'region-atlas']);

/**
 * ⛓ Entry names are DERIVED from the kind — one direction only. Reading does
 * not consult them (that is `classifyDocument`'s job); writing does not let a
 * caller choose one.
 */
export const BUNDLE_ENTRY_NAMES = Object.freeze(Object.fromEntries(
    BUNDLE_KINDS.map((kind) => [kind, `${kind}.json`]),
));

/**
 * ⛔ **DELIVERY IS NOT A MEMBER.** The suffix, not a whole name, because
 * `planLevelSetChunks` writes `<set_id>.chunks.json` and the id moves.
 */
export const DELIVERY_SUFFIX = '.chunks.json';

/**
 * ⛓ A fixed mtime, so two writes of the same documents are the same bytes.
 * The DOS epoch — zip timestamps cannot represent anything earlier, and JSZip
 * writes the field from UTC getters (measured: identical bytes under TZ=UTC,
 * Asia/Tokyo and America/Los_Angeles), so this is stable across machines too.
 * ⛔ Leaving it to the clock is the determinism mutant: the date DOES reach the
 * bytes (measured — two dates, two byte strings).
 */
export const BUNDLE_MTIME = new Date(Date.UTC(1980, 0, 1));

const GZIP_MAGIC = Object.freeze([0x1f, 0x8b]);

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v !== '';

/**
 * ⛓⛓ **THE KIND IS THE DOCUMENT'S SHAPE.**
 *
 * ⛔ The four predicates are ordered most-specific-first and are deliberately
 * DISJOINT on the committed corpus — the row that proves it runs every committed
 * `_rules.json` under `frontend/presets`, the vanilla level set and the committed
 * atlases through here, and the mutant that swaps two of them goes red on the
 * set-vs-atlas pair.
 *
 * ⚠ `level-set` and `overlay` keep D2's exact predicates (`rooms` an array vs
 * `rooms` anything else / an `overlay_id`) so that lifting the sniff out of
 * `sniffLoadBox` changes NOTHING about what that box accepts.
 *
 * @param {unknown} doc a parsed JSON document
 * @returns {'rules'|'level-set'|'overlay'|'region-atlas'|null}
 */
export function classifyDocument(doc) {
    if (!isPlainObject(doc)) return null;
    if (doc.schema_version === RULES_SCHEMA_VERSION && isPlainObject(doc.regions)) {
        return 'rules';
    }
    if (Array.isArray(doc.rooms)) return 'level-set';
    if (isNonEmptyString(doc.atlas_id) && Array.isArray(doc.regions)
        && doc.regions.every((r) => isPlainObject(r) && isNonEmptyString(r.region_id))) {
        return 'region-atlas';
    }
    if (isNonEmptyString(doc.overlay_id)
        || (doc.rooms !== undefined && !Array.isArray(doc.rooms))) {
        return 'overlay';
    }
    return null;
}

/**
 * ⛓⛓ **THE ONE GZIP SEAM**, feature-detected.
 *
 * ⛔ **BY THE MAGIC BYTES, NEVER BY THE NAME OR THE HEADER.** A response that
 * arrived `content-encoding: gzip` has ALREADY been decoded by the browser
 * (measured on the live site: `presets/seedling_playthrough/AP_1/AP_1_rules.json`
 * is 806,703 B on disk and 43,140 B on the wire, GitHub Pages' own encoding) —
 * so a `gunzip` keyed on the header would double-decode a file that was never
 * a `.gz`. Bytes that start `1f 8b` are gzip; bytes that start `{` are not.
 *
 * ⛔ AND THERE IS NO `typeof window`. `DecompressionStream('gzip')` is native in
 * every browser this repo targets AND in node ≥ 18 (measured on node v18.20.6,
 * the version vitest and every gate run under), so the seam is ONE path. An
 * environment without it REFUSES BY NAME rather than falling back to a second
 * implementation that would have to be maintained blind.
 *
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {Promise<Uint8Array>} the input unchanged, or its gunzipped bytes
 */
export async function gunzipIfNeeded(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!(bytes.length >= GZIP_MAGIC.length
        && GZIP_MAGIC.every((b, i) => bytes[i] === b))) {
        return bytes;
    }
    if (typeof DecompressionStream !== 'function') {
        throw new Error('documentBundle: these bytes are gzip (they start 1f 8b) and this '
            + 'environment has no `DecompressionStream` — nothing here hand-rolls inflate, so '
            + 'gunzip the file before handing it over');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ⛓ The same seam, for text. */
export async function gunzipToText(input) {
    return new TextDecoder().decode(await gunzipIfNeeded(input));
}

const requireZip = (jszip, who) => {
    if (typeof jszip !== 'function' || typeof jszip.loadAsync !== 'function') {
        throw new Error(`documentBundle: ${who} needs JSZip INJECTED — the vendored library is `
            + 'a UMD script, so the page passes `await loadJSZip()` and node passes '
            + '`loadJSZipNode()`; this module imports no zip implementation of its own');
    }
    return jszip;
};

/**
 * ⛓⛓⛓ **READ A BUNDLE.** Every `.json` (and `.json.gz`) entry is parsed and
 * classified; nothing is dropped in silence.
 *
 * ⛔ **TWO MEMBERS OF ONE KIND REFUSE BY NAME.** A bundle carries at most one
 * of each — a container with two level sets has no answer to "which set is
 * this", and picking the first would be an answer invented by the reader.
 *
 * ⛔ **AN UNCLASSIFIABLE MEMBER IS NAMED IN `notes`**, kept out of `members`
 * and not thrown over: a person who zipped a README alongside their four
 * documents should get their documents, and should be told what was left.
 *
 * @param {Uint8Array|ArrayBuffer} bytes the `.zip` (or `.zip.gz`)
 * @param {{jszip: Function}} deps
 * @returns {Promise<{members: Array<{name: string, kind: string, doc: object}>, notes: string[]}>}
 */
export async function readBundle(bytes, { jszip } = {}) {
    const JSZip = requireZip(jszip, 'readBundle');
    const zip = await JSZip.loadAsync(await gunzipIfNeeded(bytes));
    const notes = [];
    const byKind = new Map();
    /**
     * ⛔ ENTRY ORDER IS THE ARCHIVE'S, so the REFUSALS below are stable: the
     * "second member of kind X" is whichever the zip lists second, and a bundle
     * that refuses must refuse the same way twice.
     */
    for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        if (name.endsWith(DELIVERY_SUFFIX) || name.endsWith(`${DELIVERY_SUFFIX}.gz`)) {
            throw new Error(`documentBundle: \`${name}\` is a DELIVERY artefact, not a member — `
                + 'chunking is how a set too large for one response is shipped, and a bundle '
                + 'that carried one would describe its own transport (plan §24.12)');
        }
        const gz = name.endsWith('.json.gz');
        if (!gz && !name.endsWith('.json')) {
            notes.push(`ignored \`${name}\` — a bundle member is a JSON document `
                + '(`.json` or `.json.gz`)');
            continue;
        }
        const text = gz
            ? await gunzipToText(await entry.async('uint8array'))
            : await entry.async('string');
        let doc;
        try {
            doc = JSON.parse(text);
        } catch (e) {
            notes.push(`ignored \`${name}\` — it is not readable JSON (${e.message})`);
            continue;
        }
        const kind = classifyDocument(doc);
        if (kind === null) {
            notes.push(`ignored \`${name}\` — its shape is none of `
                + `${BUNDLE_KINDS.join(', ')}`);
            continue;
        }
        if (byKind.has(kind)) {
            throw new Error(`documentBundle: this bundle carries TWO \`${kind}\` members `
                + `(\`${byKind.get(kind).name}\` and \`${name}\`) — a bundle carries at most `
                + 'one of each kind, and nothing here may pick which of two is the document');
        }
        byKind.set(kind, { name, kind, doc });
    }
    return {
        members: BUNDLE_KINDS.filter((k) => byKind.has(k)).map((k) => byKind.get(k)),
        notes,
    };
}

/**
 * ⛓⛓⛓ **WRITE A BUNDLE — DETERMINISTIC BYTES.**
 *
 * Fixed entry order (by kind), fixed mtime, and the rules member through
 * `stringifyRulesJson` so the tile-array splice survives — the bytes inside the
 * container are the bytes the separate download would have written, which is
 * the only reason a person can treat the two as the same thing.
 *
 * ⛔ `indent` is THREADED, never defaulted here: it comes from the caller (the
 * settings schema is the default source), and `indent: 0` is a real minify in
 * JS (`JSON.stringify(x, null, 0)` emits no newlines — measured; Python's
 * `json.dumps(indent=0)` does NOT, which is why the exporter maps 0 to
 * `separators`).
 *
 * @param {Array<{kind: string, doc: object}>} members
 * @param {{jszip: Function, indent?: number, mtime?: Date}} deps
 * @returns {Promise<Uint8Array>}
 */
export async function writeBundle(members, { jszip, indent = 2, mtime = BUNDLE_MTIME } = {}) {
    const JSZip = requireZip(jszip, 'writeBundle');
    const list = Array.isArray(members) ? members : [];
    const byKind = new Map();
    for (const member of list) {
        const kind = member?.kind;
        if (!BUNDLE_KINDS.includes(kind)) {
            throw new Error(`documentBundle: \`${kind}\` is not a bundle member kind — the `
                + `members are ${BUNDLE_KINDS.join(', ')}`);
        }
        if (byKind.has(kind)) {
            throw new Error(`documentBundle: two \`${kind}\` members were handed to `
                + 'writeBundle — a bundle carries at most one of each kind');
        }
        byKind.set(kind, member.doc);
    }
    const zip = new JSZip();
    for (const kind of BUNDLE_KINDS) {
        if (!byKind.has(kind)) continue;
        const doc = byKind.get(kind);
        const text = kind === 'rules'
            ? stringifyRulesJson(doc, { indent })
            : JSON.stringify(doc, null, indent);
        zip.file(BUNDLE_ENTRY_NAMES[kind], `${text}\n`, { date: mtime });
    }
    return zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
    });
}

/**
 * ⛓ What a reader should be TOLD about a bundle it just opened: the members by
 * kind, and every ignored entry by name. One sentence, so the page, the CLI and
 * the gate all say the same thing.
 */
export function describeBundle({ members = [], notes = [] } = {}) {
    const got = members.length
        ? members.map((m) => `${m.kind} (\`${m.name}\`)`).join(' · ')
        : 'no recognised member';
    return notes.length ? `${got} — ${notes.join(' | ')}` : got;
}
