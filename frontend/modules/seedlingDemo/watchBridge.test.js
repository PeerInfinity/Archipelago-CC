/**
 * seedlingDemo/watchBridge — **THE PROJECTION FROM `__watch` ONTO THE
 * PROTOCOL**, tested where it is pure.
 *
 * EDITOR INTEGRATION arc, slice W3. ⛔ `installWatchBridge` itself needs a
 * `window`, an `AdapterClient` and a host on the other end of a postMessage —
 * that is `scripts/procgen/check-procgen-lab-hosting.mjs`' job and nothing here
 * may be read as covering it. What IS pure is the two projections, and the
 * arm-aware one is the whole of W3's OUT path on this page.
 */

import { describe, expect, it } from 'vitest';

import { watchBridgeSummary, watchLabPayload } from './watchBridge.js';
import { assertLevelChanged, assertStateChanged } from '../procgenCore/labProtocol.js';
import { isSetRecordEnvelope, openRoomOf } from '../procgenCore/labRoomEnvelope.js';

/** The shape `publishWatch` writes — only the fields read here. */
const WATCH = Object.freeze({
    source: 'generate',
    url: 'http://localhost:8000/frontend/modules/seedlingDemo/watch.html?seed=3',
    seed: 3,
    step: 1,
    identity: 'seed 3 · pre-sword · step 1',
    certified: null,
    edits: 0,
    directives: [],
    payload: { seed: 3, level: { width: 10 } },
});

const RECORD = Object.freeze({
    set: { set_id: 'seedling-demo', rooms: [{}, {}, {}] },
    overlay: { rooms: {} },
});

describe('watchLabPayload — what this page hands the host', () => {
    it('⛓ with NO set session it is the LADDER payload — byte-inert for every claim '
        + 'that existed before W3', () => {
        expect(watchLabPayload(WATCH, null)).toBe(WATCH.payload);
        expect(watchLabPayload({ ...WATCH, payload: undefined }, null)).toBe(null);
        // ⛔ `resetPageChrome` DELETES `__watch` on an arm switch — a bridge
        //   reading it then must hand over nothing rather than throw.
        expect(watchLabPayload(undefined, null)).toBe(null);
        expect(watchLabPayload(null, null)).toBe(null);
    });

    it('⛓⛓⛓ with a set session HELD it is the ENVELOPE, carrying the record and the '
        + 'OPEN ROOM — and `null` room is a value, not an absence', () => {
        const closed = watchLabPayload(WATCH, { room: null, record: RECORD });
        expect(isSetRecordEnvelope(closed)).toBe(true);
        expect(closed.substrate).toBe('seedling');
        expect(openRoomOf(closed)).toBe(null);
        expect(closed.record).toBe(RECORD);

        expect(openRoomOf(watchLabPayload(WATCH, { room: 2, record: RECORD }))).toBe(2);
    });

    it('⛓ the envelope survives an arm switch that DELETED `__watch` — the set arm is '
        + 'the authority on the set, not the readout', () => {
        const env = watchLabPayload(undefined, { room: 0, record: RECORD });
        expect(isSetRecordEnvelope(env)).toBe(true);
    });

    it('⛓⛓ the ENVELOPE is a payload `assertLevelChanged` accepts — the protocol gains '
        + 'no field, the envelope rides inside the one it already has', () => {
        expect(() => assertLevelChanged({
            substrate: 'seedling',
            iframeId: 'procgenLab-seedling-2',
            payload: watchLabPayload(WATCH, { room: 1, record: RECORD }),
        })).not.toThrow();
    });

    it('⛓ the envelope MOVES when the record does — which is what makes '
        + '`labBridge.announce`\'s diff publish a set edit', () => {
        const before = JSON.stringify(watchLabPayload(WATCH, { room: 1, record: RECORD }));
        const edited = {
            set: { set_id: 'seedling-demo', rooms: [{}, { xml: '<level/>' }, {}] },
            overlay: { rooms: {} },
        };
        const after = JSON.stringify(watchLabPayload(WATCH, { room: null, record: edited }));
        expect(after).not.toBe(before);
    });

    it('⛔ the arm gate is the SESSION, not the `?source=`', () => {
        expect(isSetRecordEnvelope(watchLabPayload(
            { ...WATCH, source: 'generate' }, { room: null, record: RECORD },
        ))).toBe(true);
    });
});

describe('watchBridgeSummary — the SMALL event, untouched by W3', () => {
    it('projects the readout onto the protocol\'s field list', () => {
        expect(() => assertStateChanged({
            substrate: 'seedling',
            iframeId: 'procgenLab-seedling-2',
            ...watchBridgeSummary(WATCH),
        })).not.toThrow();
    });

    it('⛔ a page with no state is told as such, rather than as a stale line', () => {
        expect(watchBridgeSummary(null)).toBe(null);
        expect(watchBridgeSummary(undefined)).toBe(null);
    });
});
