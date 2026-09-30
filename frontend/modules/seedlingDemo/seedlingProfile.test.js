/**
 * The physics profile registry (`seedlingProfile.js`, engine-prep A2): its
 * shape, its canonical dump, and its identity.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
            if (f.as3Match !== undefined) expect(f.as3Match, f.key).toMatch(/^(arg:\d+|param|after:.+)$/);
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

// ── D4: the AS3 anchor gate ──────────────────────────────────────────

const AS3_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../vendor/seedling/src');
const HAS_AS3 = existsSync(AS3_SRC);
const NUM = '(-?(?:0x[0-9a-fA-F]+|\\d*\\.?\\d+(?:e-?\\d+)?))';
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every `.as` file under the AS3 source, relative to it. */
function as3Files() {
    const out = [];
    const walk = (d) => {
        for (const e of readdirSync(d).sort()) {
            const p = join(d, e);
            if (statSync(p).isDirectory()) walk(p);
            else if (e.endsWith('.as')) out.push(relative(AS3_SRC, p).split('\\').join('/'));
        }
    };
    walk(AS3_SRC);
    return out;
}

/**
 * The AS3 literal a field's anchor names, or `{unresolved: why}`. The anchor
 * `File.as:name` names a file under `vendor/seedling/src` (a bare `Player.as`
 * is found by its basename when that is unique); `as3Match` says how the
 * literal is found:
 *   (none)          `(const|var|static const) name:(Number|int|uint) = <n>` —
 *                   every such declaration in the file must agree;
 *   `arg:<n>`       `name(:Type)? = new Type(a0, a1, …)`, the n-th argument;
 *   `param`         a parameter default `name:(Number|int|uint)=<n>`;
 *   `after:<text>`  the number right after the ONE occurrence of `<text>`.
 */
function as3Literal(field, files) {
    const [file, name] = field.as3.split(':');
    const hits = files.filter((p) => p === file || p.endsWith(`/${file}`));
    if (hits.length !== 1) return { unresolved: `${hits.length} files match ${file}` };
    const src = readFileSync(join(AS3_SRC, hits[0]), 'latin1');
    const m = field.as3Match ?? '';
    let found = [];
    if (m.startsWith('arg:')) {
        const call = new RegExp(`\\b${name}\\s*(?::\\s*\\w+)?\\s*=\\s*new\\s+\\w+\\s*\\(([^)]*)\\)`).exec(src);
        if (call) found = [call[1].split(',')[Number(m.slice(4))]?.trim()];
    } else if (m === 'param') {
        found = [...src.matchAll(new RegExp(`[(,]\\s*${name}\\s*:\\s*(?:Number|int|uint)\\s*=\\s*${NUM}`, 'g'))].map((x) => x[1]);
    } else if (m.startsWith('after:')) {
        const text = m.slice(6);
        found = [...src.matchAll(new RegExp(`${escapeRe(text)}${NUM}`, 'g'))].map((x) => x[1]);
        if (src.split(text).length - 1 !== 1) return { unresolved: `"${text}" occurs ${src.split(text).length - 1} times` };
    } else {
        found = [...src.matchAll(new RegExp(`(?:const|var)\\s+${name}\\s*:\\s*(?:Number|int|uint)\\s*=\\s*${NUM}`, 'g'))].map((x) => x[1]);
    }
    const values = [...new Set(found.filter((x) => x !== undefined && new RegExp(`^${NUM}$`).test(x)))];
    if (values.length === 0) return { unresolved: `no numeric literal for ${name}${m ? ` (${m})` : ''}` };
    if (values.length > 1) return { unresolved: `${values.length} different literals for ${name}: ${values.join(', ')}` };
    return { literal: values[0], file: hits[0] };
}

describe('seedlingProfile — every AS3 anchor resolves to a literal EQUAL to the profile default (D4)', () => {
    it.skipIf(!HAS_AS3)('each anchored field\'s AS3 literal === PROFILE[key] (SKIPPED BY NAME without vendor/seedling)', () => {
        const files = as3Files();
        const anchored = PROFILE_FIELDS.filter((f) => f.as3);
        const unresolved = [];
        const wrong = [];
        let checked = 0;
        for (const f of anchored) {
            const r = as3Literal(f, files);
            if (r.unresolved) { unresolved.push(`${f.key} ${f.as3}: ${r.unresolved}`); continue; }
            checked++;
            if (Number(r.literal) !== PROFILE[f.key]) wrong.push(`${f.key}: ${r.file} says ${r.literal}, the profile ${PROFILE[f.key]}`);
        }
        expect(wrong).toEqual([]);
        // every anchor resolves to a number today; a new anchor that does not
        // must say how (`as3Match`), not be skipped silently
        expect(unresolved).toEqual([]);
        expect({ anchored: anchored.length, checked }).toEqual({ anchored: 63, checked: 63 });
    });
});
