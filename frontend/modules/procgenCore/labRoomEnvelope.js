/**
 * procgenCore/labRoomEnvelope — **WHAT A LAB PAGE'S SET ARM ANNOUNCES, ONCE.**
 *
 * EDITOR INTEGRATION arc, slice W3 (`NewDocs/plans/editor-integration.md` §3.2,
 * §9). The room-editor contract's OUT path: when a lab page's SET arm is
 * holding a document, its `page.payload()` stops being the ladder's level
 * payload and becomes this envelope instead, so `labBridge.announce`'s own diff
 * publishes `procgenLab:levelChanged` on every SET change — including the ONE
 * `replace-room` a room close folds into the document.
 *
 * ── ⛔ WHY THIS IS A FILE AND NOT THREE LITERALS ───────────────────────
 *
 * Three parties read it and none of them may import the other two: the maze
 * page's bridge BUILDS one, `watch.html`'s bridge BUILDS one, and the host's
 * `procgenLabPanel/labRoomEditor.js` READS one. A page importing the host
 * module would put the app's `eventBus` into a standalone document's graph
 * (`check-maze-lab.mjs` asserts that graph), and the host importing a page's
 * bridge would put `AdapterClient` into the panel. So the vocabulary lives
 * where `labProtocol.js` lives, for exactly `labProtocol.js`'s reason — *"the
 * failure mode this arc keeps paying for is TWO SPELLINGS OF ONE SETTING"* —
 * and a `kind` string spelled `'set-record'` in one file and `'setRecord'` in
 * another would fail SILENTLY on a postMessage boundary.
 *
 * ⛔ IT IS **NOT** A NEW `procgenLab:` EVENT AND NOT A NEW PROTOCOL FIELD. It
 * rides inside `levelChanged.payload`, which `assertLevelChanged` already
 * accepts as an OPAQUE object (`labProtocol.js` `assertObject`). The seven
 * event names and their field lists are untouched — W3 adds no vocabulary to
 * the closed set.
 *
 * ⚠ `room` IS `null`-BEARING AND THE `null` IS THE POINT. `n` means *"room n
 * is open in a room session"*; `null` means *"no room session is open"*. The
 * host waits for the TRANSITION `n → null` — that is what a room CLOSE looks
 * like from outside the page, and it is the one signal that does not depend on
 * counting edits (trap 599's family: a wait on a COUNT cannot tell a
 * two-stroke edit from two one-stroke ones, and a close that folded a no-op
 * would never arrive).
 *
 * ⛔ NO DOM, NO NODE, NO EVENT BUS: pure data + assertions, so it loads in a
 * standalone lab page, in the host document, and in vitest.
 */

import { SUBSTRATES } from './labProtocol.js';

/** ⛓ THE KIND, spelled ONCE. A grep for the wire value finds this line. */
export const SET_RECORD_KIND = 'set-record';

/**
 * ⛓ THE ENVELOPE'S FIELDS, as a frozen list — `labProtocol.LAB_PAYLOAD_FIELDS`'
 * shape, for its reason: the validator iterates THIS, so the docblock and the
 * check cannot drift.
 */
export const SET_RECORD_FIELDS = Object.freeze(['kind', 'substrate', 'room', 'record']);

export class LabRoomEnvelopeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LabRoomEnvelopeError';
    }
}

const fail = (message) => { throw new LabRoomEnvelopeError(message); };

/**
 * Build the envelope a SET arm announces. ⛔ REFUSES BY NAME rather than
 * defaulting: every field here is a fact the PAGE knows and the host cannot
 * re-derive, so a default would be a value this file chose travelling under the
 * page's name (`labProtocol`'s own stance, one layer out).
 *
 * @param {object} opts
 * @param {'maze'|'seedling'} opts.substrate  which page is speaking
 * @param {number|null} opts.room  the OPEN room's index, or `null` for none
 * @param {object} opts.record     the set session's own `record()`
 */
export function makeSetRecordEnvelope({ substrate, room, record } = {}) {
    if (!SUBSTRATES.includes(substrate)) {
        fail(`labRoomEnvelope: substrate is ${JSON.stringify(substrate)}, not one of `
            + `[${SUBSTRATES.join(', ')}]. It says what the reader may assume about `
            + '`record`\'s SHAPE — a region library on the maze, a level set on Seedling — '
            + 'so an unknown one is not a record anybody can read.');
    }
    if (room !== null && !(Number.isInteger(room) && room >= 0)) {
        fail(`labRoomEnvelope: room is ${JSON.stringify(room)} — it must be a non-negative `
            + 'integer (the OPEN room\'s index) or `null` (no room session is open). ⚠ `null` '
            + 'is a VALUE here, not an absence: the host\'s whole close signal is the '
            + 'transition to it.');
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        fail(`labRoomEnvelope: record must be an object, got ${JSON.stringify(record)}. `
            + 'It is the set session\'s own `record()` — the document the host handed in, '
            + 'plus every edit folded onto it — and "no record" is an envelope nobody '
            + 'should have sent.');
    }
    return { kind: SET_RECORD_KIND, substrate, room, record };
}

/**
 * ⛓ Is this `levelChanged.payload` a SET-arm envelope, or the ladder payload
 * every existing claim expects? ⛔ Shape, not a caller's word — the same stance
 * `sniffLoadBox`/`classifyDocument` take one layer down.
 */
export function isSetRecordEnvelope(payload) {
    return Boolean(payload)
        && typeof payload === 'object'
        && !Array.isArray(payload)
        && payload.kind === SET_RECORD_KIND
        && SUBSTRATES.includes(payload.substrate)
        && (payload.room === null || Number.isInteger(payload.room))
        && Boolean(payload.record)
        && typeof payload.record === 'object';
}

/**
 * ⛓ The open room's index, or `null` — and `undefined` when the payload is not
 * an envelope at all. ⛔ THE THREE ANSWERS ARE DIFFERENT: `undefined` says
 * *"this page is not on a SET arm"* and `null` says *"it is, and no room is
 * open"*. A reader that merged them would treat the ladder payload arriving
 * after a room close as the close itself.
 */
export function openRoomOf(payload) {
    return isSetRecordEnvelope(payload) ? payload.room : undefined;
}
