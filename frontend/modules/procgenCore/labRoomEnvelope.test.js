/**
 * labRoomEnvelope — the SET-arm document envelope, and the three answers its
 * reader gives.
 *
 * EDITOR INTEGRATION arc, slice W3. ⛔ The row that matters most is the LAST
 * one: `undefined` (not a SET envelope), `null` (a SET arm with no room open)
 * and `n` are three different facts, and a reader that merged the first two
 * would treat the ladder payload arriving after a close as the close itself.
 */

import { describe, it, expect } from 'vitest';
import {
    SET_RECORD_KIND, SET_RECORD_FIELDS, LabRoomEnvelopeError,
    makeSetRecordEnvelope, isSetRecordEnvelope, openRoomOf,
} from './labRoomEnvelope.js';
import { SUBSTRATES } from './labProtocol.js';

const RECORD = { library: { entries: [{}, {}] }, overlay: {} };

describe('labRoomEnvelope — what it builds', () => {
    it('carries exactly the four declared fields', () => {
        const env = makeSetRecordEnvelope({ substrate: 'maze', room: 1, record: RECORD });
        expect(Object.keys(env).sort()).toEqual([...SET_RECORD_FIELDS].sort());
        expect(env.kind).toBe(SET_RECORD_KIND);
        expect(env.substrate).toBe('maze');
        expect(env.room).toBe(1);
        expect(env.record).toBe(RECORD);
    });

    it('builds one for every substrate the protocol names', () => {
        for (const substrate of SUBSTRATES) {
            expect(makeSetRecordEnvelope({ substrate, room: null, record: RECORD }).substrate)
                .toBe(substrate);
        }
    });

    it('⛔ refuses a substrate the protocol does not name', () => {
        expect(() => makeSetRecordEnvelope({ substrate: 'bounce', room: 0, record: RECORD }))
            .toThrow(LabRoomEnvelopeError);
        expect(() => makeSetRecordEnvelope({ substrate: 'bounce', room: 0, record: RECORD }))
            .toThrow(/bounce/);
    });

    it('⛔ refuses a room that is neither a non-negative integer nor null', () => {
        for (const room of [-1, 1.5, '0', undefined, {}]) {
            expect(() => makeSetRecordEnvelope({ substrate: 'maze', room, record: RECORD }))
                .toThrow(LabRoomEnvelopeError);
        }
        // ⚠ `null` is a VALUE and is accepted BY NAME.
        expect(makeSetRecordEnvelope({ substrate: 'maze', room: null, record: RECORD }).room)
            .toBe(null);
    });

    it('⛔ refuses a missing record — "no record" is an envelope nobody should send', () => {
        for (const record of [null, undefined, [], 'a document']) {
            expect(() => makeSetRecordEnvelope({ substrate: 'maze', room: 0, record }))
                .toThrow(LabRoomEnvelopeError);
        }
    });
});

describe('labRoomEnvelope — what it recognises', () => {
    it('recognises one it built', () => {
        expect(isSetRecordEnvelope(makeSetRecordEnvelope({
            substrate: 'seedling', room: 0, record: RECORD,
        }))).toBe(true);
    });

    it('⛔ does NOT recognise a ladder payload, however level-shaped', () => {
        for (const p of [null, undefined, 42, [], {}, { level: { tiles: [] }, seed: 3 },
            { kind: 'setRecord', substrate: 'maze', room: 0, record: RECORD },
            { kind: SET_RECORD_KIND, substrate: 'bounce', room: 0, record: RECORD },
            { kind: SET_RECORD_KIND, substrate: 'maze', room: 0 }]) {
            expect(isSetRecordEnvelope(p)).toBe(false);
        }
    });

    it('⛓⛓ `openRoomOf` gives THREE answers, and they are three different facts', () => {
        // n — this room is open.
        expect(openRoomOf(makeSetRecordEnvelope({
            substrate: 'maze', room: 2, record: RECORD,
        }))).toBe(2);
        // null — a SET arm is holding a document and no room is open.
        expect(openRoomOf(makeSetRecordEnvelope({
            substrate: 'maze', room: null, record: RECORD,
        }))).toBe(null);
        // undefined — this is not a SET envelope at all.
        expect(openRoomOf({ level: { tiles: [] } })).toBe(undefined);
        expect(openRoomOf(null)).toBe(undefined);
    });
});
