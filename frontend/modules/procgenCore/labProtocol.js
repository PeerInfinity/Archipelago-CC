/**
 * procgenCore/labProtocol — **THE HOSTING VOCABULARY, ONCE.** Eight event
 * names, their payload shapes as frozen field lists, and one `assert*`
 * validator each.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (the constructive-mode kickoff
 * §3.5, ⚖ ruling 6). Imported by BOTH in-page bridges
 * (`mazeRoom/mazeLabBridge.js`, `seedlingDemo/watchBridge.js`) AND by the host
 * panel (`procgenLabPanel/`), which is the whole reason it is a file: the
 * failure mode this arc keeps paying for is TWO SPELLINGS OF ONE SETTING, and
 * a host that publishes `{payload}` to a page reading `{level}` fails SILENTLY
 * — `eventBus.publish` has no receiver-side contract and `iframeAdapterCore`
 * forwards whatever it is handed (`feedback_iframe_adapter_gotchas`: *"payload
 * shapes must match host handlers exactly … mismatches fail silently"*).
 *
 * ⛔ NO NEW `MessageTypes`. These ride the EXISTING adapter bridge as ordinary
 * eventBus events (`SUBSCRIBE_EVENT_BUS` / `PUBLISH_EVENT_BUS`), so nothing in
 * `shared/communicationProtocol.js` changes and the `shared` submodule is not
 * touched.
 *
 * ── ⛔⛔ WHY EVERY PAYLOAD CARRIES `{substrate, iframeId}` ──────────────
 *
 * The host may mount TWO lab panels at once (one per substrate) and both talk
 * over ONE host eventBus. `iframeAdapterCore` forwards a host publish to EVERY
 * iframe subscribed to that event name, and an iframe publish reaches EVERY
 * host subscriber — so without an address on the payload, a `load` meant for
 * the maze frame lands in the Seedling frame too, and a `stateChanged` from
 * either frame updates both panels' status lines. `iframeId` is the address;
 * `substrate` is what the reader is allowed to assume about the payload's
 * shape. ⛔ NEITHER IS OPTIONAL, and `assertStateChanged` refusing a missing
 * `iframeId` is the ROUTING claim's unit-level twin.
 *
 * ── ⛔ THE VALIDATORS REFUSE BOTH DIRECTIONS, BY NAME ──────────────────
 *
 * `mazeRoomRender.assertView`'s stance, one layer out: a MISSING field refuses
 * by name (a default would be a value this file chose under a caller's name),
 * and an EXTRA field refuses by name too — which `assertView` does not do and
 * this file must, because the payload crosses a postMessage boundary where a
 * field nobody reads is a field somebody MEANT to be read. A typo'd `iframeid`
 * would otherwise arrive as a silently ignored extra beside a missing
 * required one, and only one of the two would be reported.
 *
 * ⚠ `null` IS A VALUE, NOT AN ABSENCE, in exactly the places the pages already
 * spell it that way: `certified: null` is *"nobody has asked"* and `false` is
 * *"the oracle said no"* (trap 262 — the pages are careful about this and a
 * protocol that merged them would undo it at the boundary), and `seed`/`step`
 * are `null` on a Seedling arm that has no ladder at all.
 *
 * ⛔ NO DOM, NO NODE, NO `AdapterClient`: this file is pure data + assertions,
 * so it loads in a browser page, in the host document, and in vitest.
 */

export class LabProtocolError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LabProtocolError';
    }
}

const fail = (message) => { throw new LabProtocolError(message); };

/** The prefix, stated once so a grep for the vocabulary finds all of it. */
export const LAB_EVENT_PREFIX = 'procgenLab:';

/**
 * ⛓ THE NAMES. ⛔ The keys are the vocabulary the kickoff §3.5 wrote and the
 * values are `procgenLab:<key>` — spelled out rather than computed, so a grep
 * for the wire name finds this table.
 *
 * ⛓⛓ **THE EIGHTH IS A REVERSE LINK** (APWorld editor hub, H4c). Seven names
 * carry a HOST driving a page and a page reporting what it shows; this one
 * carries the page asking the app to open something ELSE — the APWorld editor,
 * on the document this page just compiled. It is page→host like the other
 * four, and it is a lab-protocol name rather than a direct publish because a
 * lab page has no app `eventBus` at all: `apworldEditor:loadRules` exists only
 * on the host side of the iframe boundary, and the ONE transport across that
 * boundary is this vocabulary.
 */
export const LAB_EVENTS = Object.freeze({
    load: 'procgenLab:load',
    navigate: 'procgenLab:navigate',
    requestState: 'procgenLab:requestState',
    ready: 'procgenLab:ready',
    stateChanged: 'procgenLab:stateChanged',
    levelChanged: 'procgenLab:levelChanged',
    selectTile: 'procgenLab:selectTile',
    openInApworldEditor: 'procgenLab:openInApworldEditor',
});

/** ⛔ Direction is part of the contract: `register()` declares each side. */
export const HOST_TO_PAGE = Object.freeze([
    LAB_EVENTS.load, LAB_EVENTS.navigate, LAB_EVENTS.requestState,
]);
export const PAGE_TO_HOST = Object.freeze([
    LAB_EVENTS.ready, LAB_EVENTS.stateChanged, LAB_EVENTS.levelChanged,
    LAB_EVENTS.selectTile, LAB_EVENTS.openInApworldEditor,
]);

/**
 * ⛓ THE TWO SUBSTRATES, AND THE LIST IS CLOSED. A third one arrives with its
 * own page and its own bridge, and the panel's `componentState.substrate` must
 * refuse a name that has neither rather than mounting an iframe on a 404.
 */
export const SUBSTRATES = Object.freeze(['maze', 'seedling']);

/** ⛓ Every payload's address. Named so the field lists below cannot drift. */
export const ADDRESS_FIELDS = Object.freeze(['substrate', 'iframeId']);

/**
 * ⛓⛓ THE PAYLOAD SHAPES, AS FROZEN FIELD LISTS — §3.5's table, verbatim.
 * ⛔ The validators iterate THESE, so the docblock and the check cannot drift
 * (`mazeRoomRender.VIEW_FIELDS`' own reason).
 */
export const LAB_PAYLOAD_FIELDS = Object.freeze({
    [LAB_EVENTS.load]: Object.freeze([...ADDRESS_FIELDS, 'payload']),
    [LAB_EVENTS.navigate]: Object.freeze([...ADDRESS_FIELDS, 'search']),
    [LAB_EVENTS.requestState]: Object.freeze([...ADDRESS_FIELDS]),
    [LAB_EVENTS.ready]: Object.freeze([...ADDRESS_FIELDS, 'url']),
    [LAB_EVENTS.stateChanged]: Object.freeze([...ADDRESS_FIELDS,
        'url', 'source', 'seed', 'step', 'identity', 'certified', 'edits', 'directives']),
    [LAB_EVENTS.levelChanged]: Object.freeze([...ADDRESS_FIELDS, 'payload']),
    [LAB_EVENTS.selectTile]: Object.freeze([...ADDRESS_FIELDS, 'tx', 'ty']),
    [LAB_EVENTS.openInApworldEditor]: Object.freeze([...ADDRESS_FIELDS, 'rules', 'source']),
});

/**
 * ⛓ lab-apworld-door-map — **THE ONE OPTIONAL FIELD, AND WHY IT IS ONE.** Every field above is REQUIRED (a default
 * would be this file's value under the sender's name). `openInApworldEditor.atlases` is the exception on purpose: a
 * payload WITHOUT it is exactly what every page sent before this slice, and its meaning is unambiguous — "no atlas to
 * give", which the host treats as `[]` and forwards the rules as it always did. A frame from an older build therefore
 * still opens its document; it only gets the generic map it always got. ⛔ PRESENT IS CHECKED like a required field.
 * ⛓ lab-apworld-door-play — `levelSets` is the second, for the same reason: absent ≡ `[]`, "no set to give", and the
 * player then refuses the set by name (slice G) exactly as it did before sets travelled.
 */
export const LAB_OPTIONAL_PAYLOAD_FIELDS = Object.freeze({
    [LAB_EVENTS.openInApworldEditor]: Object.freeze(['atlases', 'levelSets']),
});

/* ══════════════════════════════════════════════════════════════════════
 * THE SHARED REFUSALS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛔ MISSING **AND** EXTRA, both by name. See the docblock: an extra field is
 * the shape a typo takes on a postMessage boundary, and reporting only the
 * missing half would name the symptom and hide the cause.
 */
function assertFields(event, payload) {
    const fields = LAB_PAYLOAD_FIELDS[event];
    if (!fields) fail(`labProtocol: ${JSON.stringify(event)} is not one of the `
        + `${Object.keys(LAB_EVENTS).length} lab events `
        + `[${Object.values(LAB_EVENTS).join(', ')}].`);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        fail(`labProtocol: ${event} needs a payload object — got ${JSON.stringify(payload)}. `
            + `Its fields are [${fields.join(', ')}].`);
    }
    for (const key of fields) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) {
            fail(`labProtocol: ${event} is missing "${key}". Every field is REQUIRED — a `
                + 'default here would be a value THIS file chose travelling under the '
                + 'sender\'s name, and the receiver has no way to tell the two apart.');
        }
    }
    const optional = LAB_OPTIONAL_PAYLOAD_FIELDS[event] ?? [];
    for (const key of Object.keys(payload)) {
        if (!fields.includes(key) && !optional.includes(key)) {
            fail(`labProtocol: ${event} carries an unexpected field "${key}" (allowed: `
                + `[${[...fields, ...optional].join(', ')}]). An extra field is what a MISSPELLED one looks `
                + 'like on this boundary, and a receiver that ignored it would report only '
                + 'the missing half.');
        }
    }
    return payload;
}

function assertAddress(event, payload) {
    if (!SUBSTRATES.includes(payload.substrate)) {
        fail(`labProtocol: ${event}.substrate is ${JSON.stringify(payload.substrate)}, not one `
            + `of [${SUBSTRATES.join(', ')}]. The substrate says what the reader may assume `
            + 'about this payload\'s SHAPE, so an unknown one is not a payload anybody can '
            + 'read.');
    }
    if (typeof payload.iframeId !== 'string' || payload.iframeId === '') {
        fail(`labProtocol: ${event}.iframeId must be a non-empty string, got `
            + `${JSON.stringify(payload.iframeId)}. It is the ADDRESS: the host forwards a `
            + 'publish to EVERY subscribed iframe and every iframe publish reaches EVERY '
            + 'host subscriber, so a payload without one is delivered to all of them.');
    }
    return payload;
}

const assertString = (event, payload, key) => {
    if (typeof payload[key] !== 'string') {
        fail(`labProtocol: ${event}.${key} must be a string, got `
            + `${JSON.stringify(payload[key])}.`);
    }
};

/**
 * ⚠ `noun` NAMES THE THING, and it is a parameter rather than the literal
 * "level payload" it used to be: the same refusal now guards `load.payload`,
 * `levelChanged.payload` AND `openInApworldEditor.rules`, and a sentence that
 * called a compiled rules.json a level would be a true refusal about the wrong
 * subject.
 */
const assertObject = (event, payload, key, noun = 'payload') => {
    if (!payload[key] || typeof payload[key] !== 'object' || Array.isArray(payload[key])) {
        fail(`labProtocol: ${event}.${key} must be an object, got `
            + `${JSON.stringify(payload[key])}. ⛔ \`null\` is NOT accepted here: the `
            + `${noun} is the thing the message is FOR, and "no ${noun}" is a message `
            + 'nobody should have sent.');
    }
};

/** ⚠ `null` is a VALUE — "this arm has no ladder" — and is accepted BY NAME. */
const assertNumberOrNull = (event, payload, key) => {
    if (payload[key] !== null && !Number.isFinite(payload[key])) {
        fail(`labProtocol: ${event}.${key} must be a finite number or null (null = "this arm `
            + `has no such quantity"), got ${JSON.stringify(payload[key])}.`);
    }
};

const assertInteger = (event, payload, key) => {
    if (!Number.isInteger(payload[key])) {
        fail(`labProtocol: ${event}.${key} must be an integer, got `
            + `${JSON.stringify(payload[key])} — it is a TILE COORDINATE and a fractional `
            + 'one names no cell.');
    }
};

/* ══════════════════════════════════════════════════════════════════════
 * THE VALIDATORS — ONE PER NAME
 * ══════════════════════════════════════════════════════════════════════ */

/** HOST → PAGE. Load a level payload through the page's ONE reconstruction. */
export function assertLoad(payload) {
    assertFields(LAB_EVENTS.load, payload);
    assertAddress(LAB_EVENTS.load, payload);
    assertObject(LAB_EVENTS.load, payload, 'payload', 'level payload');
    return payload;
}

/** HOST → PAGE. A URL-grammar string through the page's ONE reader, no reload. */
export function assertNavigate(payload) {
    assertFields(LAB_EVENTS.navigate, payload);
    assertAddress(LAB_EVENTS.navigate, payload);
    assertString(LAB_EVENTS.navigate, payload, 'search');
    return payload;
}

/** HOST → PAGE. "Say what you are showing" — the answer is a `stateChanged`. */
export function assertRequestState(payload) {
    assertFields(LAB_EVENTS.requestState, payload);
    assertAddress(LAB_EVENTS.requestState, payload);
    return payload;
}

/** PAGE → HOST, after connect + first render. `url` is the frame's OWN URL. */
export function assertReady(payload) {
    assertFields(LAB_EVENTS.ready, payload);
    assertAddress(LAB_EVENTS.ready, payload);
    assertString(LAB_EVENTS.ready, payload, 'url');
    return payload;
}

/**
 * PAGE → HOST, on every state change. ⛓ THE SMALL ONE — a subset of the page's
 * own summary (`__mazeLab` / `__watch`), so the host can mirror an identity
 * line without carrying a level around on every keystroke.
 */
export function assertStateChanged(payload) {
    const e = LAB_EVENTS.stateChanged;
    assertFields(e, payload);
    assertAddress(e, payload);
    assertString(e, payload, 'url');
    assertString(e, payload, 'source');
    assertNumberOrNull(e, payload, 'seed');
    assertNumberOrNull(e, payload, 'step');
    assertString(e, payload, 'identity');
    // ⚠ TRAP 262 AT THE BOUNDARY: `null` = nobody has asked, `false` = the
    // oracle said no. A protocol that coerced them would undo the distinction
    // both pages are careful to keep.
    if (payload.certified !== null && typeof payload.certified !== 'boolean') {
        fail(`labProtocol: ${e}.certified must be true, false or null — got `
            + `${JSON.stringify(payload.certified)}. \`null\` means NOBODY HAS ASKED and `
            + '`false` means THE ORACLE SAID NO; they are different facts and a boolean '
            + 'that swallowed the first would report an uncertified level as a refused one.');
    }
    if (!Number.isInteger(payload.edits) || payload.edits < 0) {
        fail(`labProtocol: ${e}.edits must be a non-negative integer, got `
            + `${JSON.stringify(payload.edits)}.`);
    }
    if (!Array.isArray(payload.directives)) {
        fail(`labProtocol: ${e}.directives must be an array (empty = none), got `
            + `${JSON.stringify(payload.directives)}.`);
    }
    return payload;
}

/** PAGE → HOST, on KEPT / edit / load. ⛓ THE FULL ONE — the level payload. */
export function assertLevelChanged(payload) {
    assertFields(LAB_EVENTS.levelChanged, payload);
    assertAddress(LAB_EVENTS.levelChanged, payload);
    assertObject(LAB_EVENTS.levelChanged, payload, 'payload', 'level payload');
    return payload;
}

/** PAGE → HOST, on a canvas click. Tile coordinates, not pixels. */
export function assertSelectTile(payload) {
    assertFields(LAB_EVENTS.selectTile, payload);
    assertAddress(LAB_EVENTS.selectTile, payload);
    assertInteger(LAB_EVENTS.selectTile, payload, 'tx');
    assertInteger(LAB_EVENTS.selectTile, payload, 'ty');
    return payload;
}

/**
 * PAGE → HOST. ⛓⛓ **THE REVERSE LINK** (H4c): *"open what I am holding in the
 * APWorld editor."* `rules` is the page's OWN compiled rules.json document —
 * whatever `adapterFns.rulesJsonOf` returned for the session in front of the
 * reader, which is the same value the page's `Download rules.json` writes — and
 * `source` is the page's own name for where it came from.
 *
 * ⛔ `source` IS REQUIRED AND IS NOT THE HOST'S TO INVENT. The hub records the
 * provenance of every document it opens (H2's rule: every intake DECIDES its
 * origin), and a lab document has no preset path and no sphere log. A host that
 * defaulted this would be filing an in-memory compile under a name the page
 * never claimed.
 */
export function assertOpenInApworldEditor(payload) {
    const e = LAB_EVENTS.openInApworldEditor;
    assertFields(e, payload);
    assertAddress(e, payload);
    assertObject(e, payload, 'rules', 'compiled rules.json');
    assertString(e, payload, 'source');
    if (payload.source === '') {
        fail(`labProtocol: ${e}.source must be a non-empty string — it is the PROVENANCE the `
            + 'hub files this document under, and an empty one is a document with no story '
            + 'about where it came from.');
    }
    /**
     * ⛓ lab-apworld-door-map — `atlases`: the region atlas(es) the page compiled `rules` FROM, so the host can put
     * them in its `atlasCache` (the rules name an atlas by `region_atlas[p].atlas_id` and carry no body). Absent
     * means `[]` (see `LAB_OPTIONAL_PAYLOAD_FIELDS`). ⛔ The FIELD's type is checked here and a wrong one refuses the
     * whole payload, like every other field; ONE bad atlas inside a good array is the host's per-atlas refusal
     * (`labAtlasRefusal`), which refuses that atlas and still forwards the rules.
     */
    if (Object.prototype.hasOwnProperty.call(payload, 'atlases') && !Array.isArray(payload.atlases)) {
        fail(`labProtocol: ${e}.atlases must be an array of region atlases — got `
            + `${summarizeValue(payload.atlases)}. Send [] (or leave it out) when the page has none.`);
    }
    /**
     * ⛓ lab-apworld-door-play — `levelSets`: the level-set DOCUMENT(S) the rules name per player
     * (`region_atlas[p].level_set = {set_id, content_hash}`; the rules carry no body), so the host can hold them the
     * way the bundle door does. Absent means `[]`. ⛔ The FIELD's type refuses the whole payload; ONE bad set inside a
     * good array is the host's per-set refusal (`labLevelSetVerdicts`), which refuses that set and still forwards.
     */
    if (Object.prototype.hasOwnProperty.call(payload, 'levelSets') && !Array.isArray(payload.levelSets)) {
        fail(`labProtocol: ${e}.levelSets must be an array of level-set documents — got `
            + `${summarizeValue(payload.levelSets)}. Send [] (or leave it out) when the page has none.`);
    }
    return payload;
}

/**
 * A NON-THROWING one-line summary of a value for a refusal sentence. ⛔ `JSON.stringify` throws on a BigInt or a
 * cyclic value, and a structured-cloned postMessage payload can carry either — so a refusal built on it would throw
 * instead of refusing by name.
 */
export function summarizeValue(v, max = 80) {
    if (v === null || v === undefined) return String(v);
    if (Array.isArray(v)) return `an array of ${v.length}`;
    if (typeof v === 'object') {
        if (typeof v.atlas_id === 'string') return `an object with atlas_id ${JSON.stringify(v.atlas_id.slice(0, max))}`;
        if (typeof v.set_id === 'string') return `an object with set_id ${JSON.stringify(v.set_id.slice(0, max))}`;
        return `an object with keys [${Object.keys(v).slice(0, 6).join(', ')}]`;
    }
    if (typeof v === 'string') return JSON.stringify(v.slice(0, max));
    return `${typeof v} ${String(v).slice(0, max)}`;
}

/** The atlas ids `rules` names, one per player that names one, in player order (EVERY player, never the first). */
export function atlasIdsNamedBy(rules) {
    const out = [];
    for (const ref of Object.values(rules?.region_atlas ?? {})) {
        const id = ref?.atlas_id;
        if (typeof id === 'string' && id !== '' && !out.includes(id)) out.push(id);
    }
    return out;
}

/**
 * ⛓ lab-apworld-door-map — **WHY ONE HANDED-OVER ATLAS IS REFUSED, OR `null`.** Game-neutral and pure. An atlas is
 * refused when it is not an object with a non-empty `atlas_id`, or when NO player of the rules handed over beside it
 * names that id (`region_atlas[p].atlas_id`, every player checked): an atlas the rules do not name is one the Region
 * Map would never read, and putting it would only shadow whatever else the host holds under that id. ⛓ The SHAPE
 * test the bundle door applies to its `region-atlas` member (`documentBundle.classifyDocument`) is the host's to add;
 * this file imports nothing.
 *
 * @returns {string|null}
 */
export function labAtlasRefusal(atlas, rules) {
    if (!atlas || typeof atlas !== 'object' || Array.isArray(atlas)
        || typeof atlas.atlas_id !== 'string' || atlas.atlas_id === '') {
        return `not a region atlas (no non-empty atlas_id): ${summarizeValue(atlas)}`;
    }
    const named = atlasIdsNamedBy(rules);
    if (!named.includes(atlas.atlas_id)) {
        return `atlas ${JSON.stringify(atlas.atlas_id)} is not the one the rules name `
            + `(region_atlas names ${named.length ? named.map((n) => JSON.stringify(n)).join(', ') : 'none'})`;
    }
    return null;
}

const isNonEmptyString = (s) => typeof s === 'string' && s !== '';

/**
 * ⛓ lab-apworld-door-play — the level-set references `rules` names, ONE PER PLAYER that names one, in player order:
 * `[{player, set_id, content_hash}]` (`region_atlas[p].level_set`; every player read, never the first). Two players
 * may name the same `set_id`; each is its own row.
 */
export function levelSetRefsNamedBy(rules) {
    const out = [];
    for (const [player, slot] of Object.entries(rules?.region_atlas ?? {})) {
        const ref = slot?.level_set;
        if (ref && isNonEmptyString(ref.set_id) && isNonEmptyString(ref.content_hash)) {
            out.push({ player, set_id: ref.set_id, content_hash: ref.content_hash });
        }
    }
    return out;
}

/**
 * ⛓⛓ lab-apworld-door-play — **WHICH HANDED-OVER LEVEL SETS THE HOST MAY HOLD, AND WHY EACH OTHER ONE IS REFUSED.**
 * Game-neutral and pure; the content hash is INJECTED (`contentHashOf`, the host passes
 * `levelSetReference.levelSetContentHash`, the one spelling) so this file still imports nothing.
 *
 * A carried document is `ok` only when its COMPUTED content hash and its `set_id` are both the ones some player of
 * THESE rules names (`levelSetRefsNamedBy`). ⛔ A hash or id the document declares ABOUT ITSELF
 * (`provenance.content_hash`) is never read: a body edited after its stamp must not pass as the stamped one.
 * ⛔ Each player is checked on its own: a refused document never removes another player's good one.
 * ⛔ The host holds ONE set per `set_id` (`levelSetCache`, put overwrites), so when the rules name one `set_id` under
 * two content hashes and good documents for both are carried, putting both would leave only the last one — that id is
 * refused for every document carrying it, by name, and nothing under it is put.
 *
 * @param {Array} docs   the payload's `levelSets` (absent → `[]`)
 * @param {object} rules the rules handed over beside them
 * @param {{contentHashOf: (doc) => string}} o
 * @returns {{ok: object[], refused: Array<{set_id: string|null, why: string}>,
 *   players: Array<{player: string, set_id: string, content_hash: string, carried: boolean}>}}
 */
export function labLevelSetVerdicts(docs, rules, { contentHashOf } = {}) {
    if (typeof contentHashOf !== 'function') {
        throw new Error('labProtocol: labLevelSetVerdicts needs `contentHashOf` injected (the host\'s '
            + '`levelSetContentHash`); this file imports nothing');
    }
    const refs = levelSetRefsNamedBy(rules);
    const named = refs.length
        ? refs.map((r) => `player ${r.player}: ${JSON.stringify(r.set_id)} @ ${r.content_hash}`).join(', ') : 'none';
    const good = [];
    const refused = [];
    for (const doc of docs ?? []) {
        if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !isNonEmptyString(doc.set_id)
            || !Array.isArray(doc.rooms)) {
            refused.push({ set_id: null, why: `not a level set (no non-empty set_id, or no rooms array): ${summarizeValue(doc)}` });
            continue;
        }
        let hash;
        try {
            hash = contentHashOf(doc);
        } catch (err) {
            refused.push({ set_id: doc.set_id, why: `set ${JSON.stringify(doc.set_id)} could not be hashed: ${err?.message ?? String(err)}` });
            continue;
        }
        const hits = refs.filter((r) => r.set_id === doc.set_id && r.content_hash === hash);
        if (hits.length === 0) {
            const sameId = refs.filter((r) => r.set_id === doc.set_id);
            refused.push({ set_id: doc.set_id, why: sameId.length
                ? `set ${JSON.stringify(doc.set_id)} hashes to ${hash}, not the content hash the rules name for it `
                    + `(${sameId.map((r) => `player ${r.player}: ${r.content_hash}`).join(', ')}) — a different version of the set`
                : `set ${JSON.stringify(doc.set_id)} is not one the rules name (level_set names ${named})` });
            continue;
        }
        if (!good.some((g) => g.doc.set_id === doc.set_id && g.hash === hash)) good.push({ doc, hash });
    }
    const ok = [];
    for (const g of good) {
        const rivals = good.filter((o) => o.doc.set_id === g.doc.set_id && o.hash !== g.hash);
        if (rivals.length) {
            refused.push({ set_id: g.doc.set_id, why: `the rules name set ${JSON.stringify(g.doc.set_id)} under `
                + `${rivals.length + 1} content hashes (${[g, ...rivals].map((o) => o.hash).join(', ')}), and the host `
                + 'holds one set per id — none of them is put' });
        } else {
            ok.push(g.doc);
        }
    }
    const players = refs.map((r) => ({ ...r,
        carried: good.some((g) => g.doc.set_id === r.set_id && g.hash === r.content_hash && ok.includes(g.doc)) }));
    return { ok, refused, players };
}

/**
 * ⛓ THE TABLE A DISPATCHER USES — event name → its validator. ⛔ Both sides
 * validate: the sender so a defect is reported where it was made, the receiver
 * so a payload from a stale build is refused rather than half-read.
 */
export const LAB_VALIDATORS = Object.freeze({
    [LAB_EVENTS.load]: assertLoad,
    [LAB_EVENTS.navigate]: assertNavigate,
    [LAB_EVENTS.requestState]: assertRequestState,
    [LAB_EVENTS.ready]: assertReady,
    [LAB_EVENTS.stateChanged]: assertStateChanged,
    [LAB_EVENTS.levelChanged]: assertLevelChanged,
    [LAB_EVENTS.selectTile]: assertSelectTile,
    [LAB_EVENTS.openInApworldEditor]: assertOpenInApworldEditor,
});

/** Validate by NAME. Refuses an unknown event rather than passing it through. */
export function assertLabPayload(event, payload) {
    const validator = LAB_VALIDATORS[event];
    if (!validator) fail(`labProtocol: ${JSON.stringify(event)} is not one of the `
        + `${Object.keys(LAB_EVENTS).length} lab events `
        + `[${Object.values(LAB_EVENTS).join(', ')}].`);
    return validator(payload);
}

/**
 * ⛓ IS THIS PAYLOAD ADDRESSED TO ME? The one routing predicate, so the two
 * bridges and the host panel cannot disagree about what "mine" means.
 *
 * ⚠ It answers `false` for a payload with no address at all rather than
 * throwing — a receiver's job is to IGNORE other people's mail, and the
 * validators are where a malformed payload is refused.
 */
export function addressedTo(payload, iframeId) {
    return Boolean(payload) && payload.iframeId === iframeId;
}
