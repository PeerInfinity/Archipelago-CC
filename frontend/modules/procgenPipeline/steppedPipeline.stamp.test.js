// The serialized-envelope STAMP (§5au item 4): `kind` + `envelope_version` on
// the way out, checked and stripped on the way in. See THE STAMP in
// steppedPipeline.js.
import { describe, it, expect } from 'vitest';

import {
    ENVELOPE_VERSION, EnvelopeStampError, serializeEnvelope, deserializeEnvelope,
} from './steppedPipeline.js';
import { serializeEnvelope as serializeSphere, deserializeEnvelope as deserializeSphere } from './sphereSteps.js';
import { serializeSpiralEnvelope, deserializeSpiralEnvelope } from './spiralSteps.js';
import { serializeTDEnvelope, deserializeTDEnvelope } from './topDownSteps.js';

const DESC = { kind: 'test-envelope', codecs: {} };

describe('envelope stamp', () => {
    it('serialize opens with kind + envelope_version, and replaces a stale stamp', () => {
        const out = serializeEnvelope({ envelope_version: 0, kind: 'old', config: { seed: 1 }, completed: -1 }, DESC);
        expect(Object.keys(out).slice(0, 2)).toEqual(['kind', 'envelope_version']);
        expect(out).toEqual({ kind: 'test-envelope', envelope_version: ENVELOPE_VERSION,
            config: { seed: 1 }, completed: -1 });
    });

    it('deserialize strips the stamp, so the live envelope never carries it', () => {
        const live = deserializeEnvelope({ kind: 'test-envelope', envelope_version: 1, completed: 2 }, DESC);
        expect(live).toEqual({ completed: 2 });
    });

    it('an UNSTAMPED object (pre-stamp, or hand-written) still loads', () => {
        expect(deserializeEnvelope({ completed: 0 }, DESC)).toEqual({ completed: 0 });
    });

    it('refuses another mode\'s envelope by name', () => {
        expect(() => deserializeEnvelope({ kind: 'spiral-envelope', completed: 0 }, DESC))
            .toThrow(EnvelopeStampError);
        expect(() => deserializeEnvelope({ kind: 'spiral-envelope', completed: 0 }, DESC))
            .toThrow(/'spiral-envelope' envelope, not a 'test-envelope' one/);
    });

    it.each([ENVELOPE_VERSION + 1, 0, '1', 1.5])('refuses envelope_version %j', (v) => {
        let err;
        try { deserializeEnvelope({ kind: 'test-envelope', envelope_version: v }, DESC); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(EnvelopeStampError);
        expect(err.code).toBe('ENVELOPE_STAMP');
    });

    it('each mode stamps its own kind and refuses the others', () => {
        const modes = [
            ['sphere-envelope', serializeSphere, deserializeSphere],
            ['spiral-envelope', serializeSpiralEnvelope, deserializeSpiralEnvelope],
            ['topdown-envelope', serializeTDEnvelope, deserializeTDEnvelope],
        ];
        for (const [kind, ser, de] of modes) {
            const wire = ser({ completed: -1 });
            expect(wire.kind).toBe(kind);
            expect(de(wire)).toEqual({ completed: -1 });
            for (const [otherKind, otherSer] of modes) {
                if (otherKind !== kind) expect(() => de(otherSer({ completed: -1 }))).toThrow(EnvelopeStampError);
            }
        }
    });
});
