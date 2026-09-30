/**
 * The physics profile registry (`seedlingProfile.js`, engine-prep A2): its
 * shape, its canonical dump, and its identity.
 */
import { describe, expect, it } from 'vitest';

import {
    PROFILE, PROFILE_FIELDS, PROFILE_ID, profileDump, profileMd5, profileStamp,
} from './seedlingProfile.js';
import { validateProfile } from './tapeEnvelope.js';

const CLASSES = new Set(['physics', 'rule']);
const KINDS = new Set(['magnitude', 'count', 'bound', 'sign', 'sentinel', 'derivation']);

describe('seedlingProfile — the one registry of physics and rule constants', () => {
    it('is flat: every key holds one finite number, and the object is frozen', () => {
        expect(Object.isFrozen(PROFILE)).toBe(true);
        for (const [k, v] of Object.entries(PROFILE)) {
            expect(typeof v, k).toBe('number');
            expect(Number.isFinite(v), k).toBe(true);
        }
    });

    it('PROFILE_FIELDS covers every key exactly once, in PROFILE\'s own order', () => {
        const keys = PROFILE_FIELDS.map((f) => f.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toEqual(Object.keys(PROFILE));
    });

    it('every field carries a census class and kind, a source, and a review flag that matches its note', () => {
        for (const f of PROFILE_FIELDS) {
            expect(CLASSES.has(f.class), f.key).toBe(true);
            expect(KINDS.has(f.kind), f.key).toBe(true);
            expect(f.source, f.key).toMatch(/^[\w.]+\.js:[A-Z][A-Z0-9_]*(\.\w+|\[\d+\])?$/);
            expect(typeof f.as3, f.key).toBe('string');
            expect(f.review, f.key).toBe(f.note.startsWith('REVIEW:'));
            if (f.as3Match !== undefined) expect(f.as3Match, f.key).toMatch(/^arg:\d+$/);
            // strings and booleans only: the census must see each value once, in PROFILE
            for (const v of Object.values(f)) expect(typeof v === 'number', f.key).toBe(false);
        }
    });

    it('the key is the declaring name in camelCase', () => {
        const camel = (n) => n.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
        for (const f of PROFILE_FIELDS) {
            const name = f.source.split(':')[1];
            // a literal inside a derivation is named for its role: `checkOffsetYInset`
            if (/^[A-Z][A-Z0-9_]*$/.test(name) && f.kind !== 'derivation') expect(f.key).toBe(camel(name));
            else expect(f.key.startsWith(camel(name.split(/[.[]/)[0])), f.key).toBe(true);
        }
    });

    it('the dump is one line per field, JSON, and parses back to PROFILE exactly', () => {
        const dump = profileDump();
        expect(dump.endsWith('}\n')).toBe(true);
        expect(dump.split('\n')).toHaveLength(PROFILE_FIELDS.length + 3); // {, the fields, }, ''
        const back = JSON.parse(dump);
        expect(back).toEqual({ ...PROFILE });
        expect(Object.keys(back)).toEqual(Object.keys(PROFILE));
        for (const k of Object.keys(PROFILE)) expect(Object.is(back[k], PROFILE[k]), k).toBe(true);
    });

    it('a value prints as its shortest exact double — no rounding, no hex', () => {
        expect(profileDump()).toContain('"fpMaxElapsed": 0.0333,');
        expect(profileDump()).toContain('"xorMask": 1207959552,');
        expect(profileDump({ ...PROFILE, walkSpeed: 0.1 + 0.2 })).toContain('"walkSpeed": 0.30000000000000004,');
    });

    it('⚖ THE PROFILE\'S IDENTITY IS PINNED — a change here is a PHYSICS change, not a re-record', () => {
        // Every value in PROFILE is a literal some module used to spell. If this
        // md5 moves, a physics or rule constant moved: the committed tapes,
        // expectations and solves are then no longer known to be byte-identical,
        // and the change needs the arc's byte-neutral gates, not a new pin.
        expect(Object.keys(PROFILE)).toHaveLength(127);
        expect(profileMd5()).toBe('be8b983bc252c0ac33effa9ede59bc6e');
    });

    it('profileMd5 moves with any one value by one ULP', () => {
        const nudged = { ...PROFILE, walkSpeed: PROFILE.walkSpeed + Number.EPSILON * PROFILE.walkSpeed / 2 };
        expect(nudged.walkSpeed).not.toBe(PROFILE.walkSpeed);
        expect(profileMd5(nudged)).not.toBe(profileMd5());
    });

    it('the stamp is a valid v13 tape profile block', () => {
        const stamp = profileStamp();
        expect(stamp).toEqual({ id: PROFILE_ID, md5: profileMd5() });
        expect(validateProfile(stamp)).toEqual(stamp);
    });
});
