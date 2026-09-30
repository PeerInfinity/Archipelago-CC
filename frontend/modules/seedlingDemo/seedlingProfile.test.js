/**
 * The physics profile registry (`seedlingProfile.js`, engine-prep A2): its
 * shape, its canonical dump, and its identity.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    PROFILE, PROFILE_DEFAULTED, PROFILE_DEFAULTS, PROFILE_DEFAULT_ID, PROFILE_FIELDS, PROFILE_FLAGS,
    PROFILE_ID, PROFILE_OVERRIDES, PROFILE_SOURCE, profileDump, profileMd5, profileStamp,
} from './seedlingProfile.js';
import {
    DEFAULT_SOURCE, PROFILE_GLOBAL, ProfileOverrideError, applyOverrides, duplicateKeys,
} from './profileOverrides.js';
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

// ── A3: overrides ────────────────────────────────────────────────────

const DEFAULT_MD5 = 'be8b983bc252c0ac33effa9ede59bc6e';
/** The next double above `x` (x > 0): +1 ULP. */
const nextUp = (x) => {
    const b = new DataView(new ArrayBuffer(8));
    b.setFloat64(0, x);
    b.setBigUint64(0, b.getBigUint64(0) + 1n);
    return b.getFloat64(0);
};
const OPTS = { defaultId: PROFILE_DEFAULT_ID, knownFlags: [] };
const refusal = (override) => {
    try { applyOverrides(PROFILE_DEFAULTS, override, OPTS); } catch (e) {
        expect(e).toBeInstanceOf(ProfileOverrideError);
        return e.message;
    }
    throw new Error('not refused');
};

/**
 * A FRESH module registry with `override` installed in the global — the
 * load-time semantics under test: the profile and every module that copies
 * a constant out of it evaluate after the global is set.
 */
async function withOverride(override, ...modules) {
    vi.resetModules();
    globalThis[PROFILE_GLOBAL] = override;
    try {
        return await Promise.all(['./seedlingProfile.js', ...modules].map((m) => import(m)));
    } finally {
        delete globalThis[PROFILE_GLOBAL];
    }
}

describe('seedlingProfile — overrides (A3): no override is byte-identical', () => {
    afterEach(() => { delete globalThis[PROFILE_GLOBAL]; });

    it('⚖ WITH NO OVERRIDE, PROFILE IS THE DEFAULTS OBJECT ITSELF — every value Object.is, the md5 pinned', () => {
        expect(PROFILE).toBe(PROFILE_DEFAULTS);
        expect(Object.isFrozen(PROFILE_DEFAULTS)).toBe(true);
        for (const k of Object.keys(PROFILE_DEFAULTS)) expect(Object.is(PROFILE[k], PROFILE_DEFAULTS[k]), k).toBe(true);
        expect(profileMd5()).toBe(DEFAULT_MD5);
        expect(PROFILE_ID).toBe('seedling-js-2026');
        expect(PROFILE_ID).toBe(PROFILE_DEFAULT_ID);
        expect(PROFILE_SOURCE).toBe('compiled-in default');
        expect(PROFILE_SOURCE).toBe(DEFAULT_SOURCE);
        expect(PROFILE_OVERRIDES).toEqual({});
        expect(PROFILE_DEFAULTED).toBe(127);
        expect(PROFILE_FLAGS).toEqual([]); // the reserved flags section: empty
    });

    it('a fresh load with the global undefined is the same profile again', async () => {
        const [m] = await withOverride(undefined);
        expect(m.PROFILE).toBe(m.PROFILE_DEFAULTS);
        expect(m.profileMd5()).toBe(DEFAULT_MD5);
        expect(m.profileStamp()).toEqual({ id: 'seedling-js-2026', md5: DEFAULT_MD5 });
    });
});

describe('seedlingProfile — overrides (A3): the load-time semantics', () => {
    afterEach(() => { delete globalThis[PROFILE_GLOBAL]; });

    it('an override moves PROFILE.walkSpeed AND playerPhysicsV1.WALK_SPEED (the module copied it at ITS load)', async () => {
        const v = nextUp(0.8);
        expect(v).not.toBe(0.8);
        const [m, phys] = await withOverride({ walkSpeed: v }, './playerPhysicsV1.js');
        expect(m.PROFILE.walkSpeed).toBe(v);
        expect(phys.WALK_SPEED).toBe(v);
        expect(m.PROFILE_DEFAULTS.walkSpeed).toBe(0.8); // the defaults are never edited
        expect(Object.isFrozen(m.PROFILE)).toBe(true);
        expect(Object.keys(m.PROFILE)).toEqual(Object.keys(PROFILE));
        expect(m.profileMd5()).not.toBe(DEFAULT_MD5);
        expect(m.profileMd5()).toBe(profileMd5({ ...PROFILE, walkSpeed: v }));
        expect(validateProfile(m.profileStamp())).toEqual({ id: 'seedling-js-2026', md5: m.profileMd5() });
        expect(m.PROFILE_SOURCE).toBe('override:inline');
        expect(m.PROFILE_OVERRIDES).toEqual({ walkSpeed: v });
        expect(m.PROFILE_DEFAULTED).toBe(126);
        expect(m.profileDefaultedKeys()).not.toContain('walkSpeed');
        expect(m.profileAnnouncements()).toContain(`set walkSpeed=${JSON.stringify(v)}`);
        // ...and a module imported in THIS (unreset) registry kept the default
        expect(PROFILE.walkSpeed).toBe(0.8);
    });

    it('JSON text is accepted; an `id` names the profile and the provenance', async () => {
        const [m] = await withOverride('{"id": "walk-plus", "walkSpeed": 0.9, "flags": {}}');
        expect(m.PROFILE.walkSpeed).toBe(0.9);
        expect(m.PROFILE_ID).toBe('walk-plus');
        expect(m.PROFILE_SOURCE).toBe('override:walk-plus');
        expect(m.profileStamp()).toEqual({ id: 'walk-plus', md5: m.profileMd5() });
        expect(m.profileAnnouncements()[0]).toBe(`profile: override:walk-plus (id walk-plus, md5 ${m.profileMd5()})`);
    });

    it('⚖ A NO-OP OVERRIDE IS STILL A SET (RWK announces every set): md5 unchanged, 1 set, 126 defaulted', async () => {
        const [m] = await withOverride({ walkSpeed: 0.8 });
        expect(m.profileMd5()).toBe(DEFAULT_MD5); // the md5 says the profile did not move
        expect(m.PROFILE_OVERRIDES).toEqual({ walkSpeed: 0.8 });
        expect(m.PROFILE_DEFAULTED).toBe(126);
        expect(m.PROFILE_SOURCE).toBe('override:inline');
        expect(m.PROFILE).not.toBe(m.PROFILE_DEFAULTS);
        expect(m.PROFILE).toEqual(m.PROFILE_DEFAULTS);
        expect(m.profileAnnouncements()).toEqual([
            `profile: override:inline (id seedling-js-2026, md5 ${DEFAULT_MD5})`,
            'set walkSpeed=0.8',
            'defaulted: 126 of 127 keys',
        ]);
    });

    it('a refused override fails the IMPORT, by name', async () => {
        vi.resetModules();
        globalThis[PROFILE_GLOBAL] = { walkSped: 0.8 };
        await expect(import('./seedlingProfile.js')).rejects.toThrow(/unknown key "walkSped"/);
    });
});

describe('seedlingProfile — overrides (A3): every refusal names what it refused', () => {
    it('an unknown key — named, with the known keys listed (mutant (a))', () => {
        const msg = refusal({ walkSped: 0.8 });
        expect(msg).toMatch(/^profile override: unknown key "walkSped"; the known keys are: /);
        for (const k of Object.keys(PROFILE)) expect(msg).toContain(k);
    });

    it('a duplicate key in JSON text (JSON.parse would silently keep the last)', () => {
        expect(refusal('{"walkSpeed": 0.8, "stairSpeed": 1, "walkSpeed": 0.9}'))
            .toBe('profile override: duplicate key "walkSpeed"');
        expect(duplicateKeys('{"a": 1, "flags": {"x": 0, "x": 1}, "s": "a,\\"b\\"", "b": [{"a": 1}]}'))
            .toEqual(['flags.x']);
        expect(duplicateKeys('{"a": 1, "b": {"a": 2}}')).toEqual([]);
    });

    it('a nested value, a string, a boolean, null, NaN and Infinity', () => {
        expect(refusal({ walkSpeed: { v: 1 } })).toMatch(/"walkSpeed" is a nested value/);
        expect(refusal({ walkSpeed: [1] })).toMatch(/"walkSpeed" is a nested value/);
        expect(refusal({ walkSpeed: '0.8' })).toMatch(/"walkSpeed" must be a number, got "0.8"/);
        expect(refusal({ walkSpeed: true })).toMatch(/"walkSpeed" must be a number, got true/);
        expect(refusal({ walkSpeed: null })).toMatch(/"walkSpeed" must be a number, got null/);
        expect(refusal({ walkSpeed: NaN })).toMatch(/"walkSpeed" must be a finite number, got NaN/);
        expect(refusal({ walkSpeed: -Infinity })).toMatch(/"walkSpeed" must be a finite number, got -Infinity/);
    });

    it('any flag — none exists yet; `flags: {}` is accepted', () => {
        expect(refusal({ flags: { v2Friction: 1 } }))
            .toBe('profile override: unknown flag "v2Friction"; the known flags are: (none — no flag exists yet)');
        expect(refusal({ flags: 1 })).toMatch(/"flags" must be an object/);
        expect(applyOverrides(PROFILE_DEFAULTS, { flags: {} }, OPTS).flags).toEqual({});
    });

    it('a bad id, a non-object and text that is not JSON', () => {
        expect(refusal({ id: '' })).toMatch(/"id" must be a non-empty string/);
        expect(refusal({ id: 7 })).toMatch(/"id" must be a non-empty string/);
        expect(refusal([])).toMatch(/must be a flat JSON object/);
        expect(refusal(null)).toMatch(/must be a flat JSON object/);
        expect(refusal(0.8)).toMatch(/must be a flat JSON object/);
        expect(refusal('{"walkSpeed": 0.8,}')).toMatch(/^profile override: not JSON: /);
        expect(refusal('[1]')).toMatch(/must be a flat JSON object/);
    });
});
