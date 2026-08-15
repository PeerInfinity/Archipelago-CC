/**
 * procgenCore/labProtocol — **THE HOSTING VOCABULARY, ONCE.** Seven event
 * names, their payload shapes as frozen field lists, and one `assert*`
 * validator each.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5, ⚖ ruling 6). Imported by BOTH in-page bridges
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
 * ⛓ THE SEVEN NAMES. ⛔ The keys are the vocabulary the kickoff §3.5 wrote and
 * the values are `procgenLab:<key>` — spelled out rather than computed, so a
 * grep for the wire name finds this table.
 */
export const LAB_EVENTS = Object.freeze({
    load: 'procgenLab:load',
    navigate: 'procgenLab:navigate',
    requestState: 'procgenLab:requestState',
    ready: 'procgenLab:ready',
    stateChanged: 'procgenLab:stateChanged',
    levelChanged: 'procgenLab:levelChanged',
    selectTile: 'procgenLab:selectTile',
});

/** ⛔ Direction is part of the contract: `register()` declares each side. */
export const HOST_TO_PAGE = Object.freeze([
    LAB_EVENTS.load, LAB_EVENTS.navigate, LAB_EVENTS.requestState,
]);
export const PAGE_TO_HOST = Object.freeze([
    LAB_EVENTS.ready, LAB_EVENTS.stateChanged, LAB_EVENTS.levelChanged,
    LAB_EVENTS.selectTile,
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
    if (!fields) fail(`labProtocol: ${JSON.stringify(event)} is not one of the seven lab `
        + `events [${Object.values(LAB_EVENTS).join(', ')}].`);
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
    for (const key of Object.keys(payload)) {
        if (!fields.includes(key)) {
            fail(`labProtocol: ${event} carries an unexpected field "${key}" (allowed: `
                + `[${fields.join(', ')}]). An extra field is what a MISSPELLED one looks `
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

const assertObject = (event, payload, key) => {
    if (!payload[key] || typeof payload[key] !== 'object' || Array.isArray(payload[key])) {
        fail(`labProtocol: ${event}.${key} must be an object, got `
            + `${JSON.stringify(payload[key])}. ⛔ \`null\` is NOT accepted here: a level `
            + 'payload is the thing the message is FOR, and "no payload" is a message '
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
 * THE SEVEN VALIDATORS
 * ══════════════════════════════════════════════════════════════════════ */

/** HOST → PAGE. Load a level payload through the page's ONE reconstruction. */
export function assertLoad(payload) {
    assertFields(LAB_EVENTS.load, payload);
    assertAddress(LAB_EVENTS.load, payload);
    assertObject(LAB_EVENTS.load, payload, 'payload');
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
    assertObject(LAB_EVENTS.levelChanged, payload, 'payload');
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
});

/** Validate by NAME. Refuses an unknown event rather than passing it through. */
export function assertLabPayload(event, payload) {
    const validator = LAB_VALIDATORS[event];
    if (!validator) fail(`labProtocol: ${JSON.stringify(event)} is not one of the seven lab `
        + `events [${Object.values(LAB_EVENTS).join(', ')}].`);
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
