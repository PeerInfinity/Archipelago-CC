/**
 * mazeRoom/mazeLabBridge — **THE PROJECTION FROM `__mazeLab` ONTO THE
 * PROTOCOL**, tested where it is pure.
 *
 * CONSTRUCTIVE-MODE arc, slice 4. ⛔ `installMazeLabBridge` itself needs a
 * `window`, an `AdapterClient` and a host on the other end of a postMessage —
 * that is `scripts/procgen/check-procgen-lab-hosting.mjs`' job and nothing
 * here may be read as covering it. What IS pure, and is the one place a field
 * could be silently coerced on its way across the boundary, is
 * `mazeLabSummary`.
 */

import { describe, expect, it } from 'vitest';

import { mazeLabPayload, mazeLabSummary } from './mazeLabBridge.js';
import { assertStateChanged, assertLevelChanged } from '../procgenCore/labProtocol.js';
import { isSetRecordEnvelope, openRoomOf } from '../procgenCore/labRoomEnvelope.js';

const HREF = 'http://localhost:8000/frontend/modules/mazeRoom/lab.html?seed=3&count=4';

/** The shape `mazeLabView.render()` writes — only the fields read here. */
const READOUT = Object.freeze({
    source: 'generate',
    url: '?seed=3&count=4',
    seed: 3,
    step: 4,
    identity: 'seed 3 · maze-v1 · 11x11 · step 4 · CERTIFIED',
    certified: true,
    edits: 0,
    directives: [],
    payload: { seed: 3, level: { width: 11 } },
});

describe('mazeLabSummary', () => {
    it('carries the readout\'s fields under the protocol\'s names', () => {
        const s = mazeLabSummary(READOUT, HREF);
        expect(s.source).toBe('generate');
        expect(s.seed).toBe(3);
        expect(s.step).toBe(4);
        expect(s.identity).toBe(READOUT.identity);
        expect(s.certified).toBe(true);
        expect(s.edits).toBe(0);
        expect(s.directives).toEqual([]);
    });

    it('⛓ reports the FULL href, not the readout\'s search-only url', () => {
        const s = mazeLabSummary(READOUT, HREF);
        expect(s.url).toBe(HREF);
        expect(s.url).not.toBe(READOUT.url);
    });

    it('⛔ a FATAL boot is not a state — the host is told nothing rather than a stale line', () => {
        expect(mazeLabSummary({ fatal: 'the URL was refused' }, HREF)).toBe(null);
        expect(mazeLabSummary(null, HREF)).toBe(null);
        expect(mazeLabSummary(undefined, HREF)).toBe(null);
    });

    it('an absent directives list becomes [] — the protocol wants an array', () => {
        const s = mazeLabSummary({ ...READOUT, directives: undefined }, HREF);
        expect(s.directives).toEqual([]);
    });

    it('⛓⛓ produces a payload the protocol\'s validator ACCEPTS', () => {
        const message = {
            substrate: 'maze', iframeId: 'procgenLab-maze-1', ...mazeLabSummary(READOUT, HREF),
        };
        expect(() => assertStateChanged(message)).not.toThrow();
    });

    it('⛓ an EDITED, uncertified level projects with edits > 0 and certified false', () => {
        const message = {
            substrate: 'maze',
            iframeId: 'procgenLab-maze-1',
            ...mazeLabSummary({ ...READOUT, edits: 2, certified: false }, HREF),
        };
        expect(() => assertStateChanged(message)).not.toThrow();
        expect(message.edits).toBe(2);
        expect(message.certified).toBe(false);
    });

    it('⛔ drops the level payload — stateChanged is the SMALL event', () => {
        expect(Object.keys(mazeLabSummary(READOUT, HREF)).sort()).toEqual([
            'certified', 'directives', 'edits', 'identity', 'seed', 'source', 'step', 'url',
        ]);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * EDITOR INTEGRATION W3 — THE ARM-AWARE PAYLOAD
 * ══════════════════════════════════════════════════════════════════════ */

describe('mazeLabPayload — what this page hands the host', () => {
    const RECORD = { library: { library_id: 'demo', entries: [{}, {}] }, overlay: {} };

    it('⛓ with NO set session it is the LADDER payload — byte-inert for every claim '
        + 'that existed before W3', () => {
        expect(mazeLabPayload(READOUT, null)).toBe(READOUT.payload);
        // ⛔ …and `undefined` is not smuggled through as an object.
        expect(mazeLabPayload({ ...READOUT, payload: undefined }, null)).toBe(null);
    });

    it('⛔ a FATAL boot hands over NOTHING, on either arm', () => {
        expect(mazeLabPayload({ fatal: 'the URL was refused' }, null)).toBe(null);
        expect(mazeLabPayload({ fatal: 'the URL was refused' },
            { room: 0, record: RECORD })).toBe(null);
        expect(mazeLabPayload(null, { room: 0, record: RECORD })).toBe(null);
    });

    it('⛓⛓⛓ with a set session HELD it is the ENVELOPE, carrying the record and the '
        + 'OPEN ROOM — and `null` room is a value, not an absence', () => {
        const closed = mazeLabPayload(READOUT, { room: null, record: RECORD });
        expect(isSetRecordEnvelope(closed)).toBe(true);
        expect(closed.substrate).toBe('maze');
        expect(openRoomOf(closed)).toBe(null);
        expect(closed.record).toBe(RECORD);

        const open = mazeLabPayload(READOUT, { room: 1, record: RECORD });
        expect(openRoomOf(open)).toBe(1);
    });

    it('⛓⛓ the ENVELOPE is a payload `assertLevelChanged` accepts — the protocol gains '
        + 'no field, the envelope rides inside the one it already has', () => {
        const message = {
            substrate: 'maze',
            iframeId: 'procgenLab-maze-1',
            payload: mazeLabPayload(READOUT, { room: 0, record: RECORD }),
        };
        expect(() => assertLevelChanged(message)).not.toThrow();
    });

    it('⛔ the arm gate is the SESSION, not the `?source=` — a library held while '
        + 'another arm is on screen still announces the document', () => {
        const onGenerate = mazeLabPayload({ ...READOUT, source: 'generate' },
            { room: null, record: RECORD });
        expect(isSetRecordEnvelope(onGenerate)).toBe(true);
    });

    it('⛓ the envelope MOVES when the record does — which is what makes '
        + '`labBridge.announce`\'s diff publish a set edit', () => {
        const before = JSON.stringify(mazeLabPayload(READOUT, { room: 1, record: RECORD }));
        const edited = { library: { library_id: 'demo', entries: [{}, { t: 1 }] }, overlay: {} };
        const after = JSON.stringify(mazeLabPayload(READOUT, { room: null, record: edited }));
        expect(after).not.toBe(before);
    });
});
