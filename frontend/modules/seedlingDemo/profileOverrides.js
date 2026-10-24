/**
 * seedlingDemo/profileOverrides — the LOADER that lets a physics profile
 * override replace `seedlingProfile.js`'s compiled-in defaults (engine-prep
 * arc, slice A3; RWK's `Profile.cpp` semantics, restated).
 *
 * ── WHERE AN OVERRIDE COMES FROM ───────────────────────────────────────
 *
 * `globalThis.__SEEDLING_PROFILE__`, read ONCE, when `seedlingProfile.js`
 * evaluates:
 *
 *   `undefined`   no override — `PROFILE` IS the defaults object, untouched
 *   an object     the overrides, as a plain object
 *   a string      JSON text of that object (duplicate keys are found in the
 *                 TEXT, before `JSON.parse` would silently keep the last)
 *
 * ⚠ PROCESS-WIDE AT LOAD (⚖ Q2). Twenty-eight modules copy their constants
 * out of `PROFILE` at THEIR evaluation (`export const WALK_SPEED =
 * PROFILE.walkSpeed`), so an override set after the first import of any of
 * them changes nothing. Whoever sets the global sets it before the model is
 * imported: a node script (`scripts/procgen/seedlingProfileLoader.mjs`, from
 * `SEEDLING_PROFILE=<path>`), or — later, not yet — a page.
 *
 * ── THE RULES (RWK's) ──────────────────────────────────────────────────
 *
 * The override is a FLAT object whose every value is a finite number, keyed
 * by `PROFILE` keys. Refused BY NAME, never ignored: an unknown key (the
 * message lists the known ones), a duplicate key, a nested value, a
 * non-number or non-finite value, and any flag the loader does not know.
 * Two keys are not numbers:
 *
 *   `id`      a non-empty string: the profile's NAME, what a v13 tape's
 *             `profile.id` carries. Without one the default name stays —
 *             the md5 is the identity, and it moves anyway.
 *   `flags`   an object of formula switches, flag 0 being the original
 *             path. No flag exists yet, so every flag key is refused; the
 *             slot is reserved so the first flag is a data change, not a
 *             format change.
 *
 * Every key the override names is a SET, and is reported as one even when
 * its value equals the default (RWK announces every set); whether the
 * profile actually MOVED is what the md5 says. The keys left at their
 * default are reported as a count (and the list, on request).
 *
 * Dependency-free and browser-safe: no `fs`, no `process`, no fetch.
 */

/** The global an override is read from. */
export const PROFILE_GLOBAL = '__SEEDLING_PROFILE__';

/** The provenance phrase of the compiled-in profile. */
export const DEFAULT_SOURCE = 'compiled-in default';

/** Every refusal the loader makes. The message names the offending key. */
export class ProfileOverrideError extends Error {
    constructor(message) {
        super(`profile override: ${message}`);
        this.name = 'ProfileOverrideError';
    }
}

const refuse = (message) => { throw new ProfileOverrideError(message); };
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));

/**
 * Every key that appears twice in one object of `text` (JSON), as
 * `path.key` (`walkSpeed`, `flags.x`). The scan tracks strings and nesting
 * only; `JSON.parse` still judges the syntax.
 */
export function duplicateKeys(text) {
    const dups = [];
    const stack = []; // one {seen, path, expectKey} per open object/array
    let i = 0;
    let lastKey = null;
    while (i < text.length) {
        const c = text[i];
        if (c === '"') {
            let j = i + 1;
            while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
            const top = stack[stack.length - 1];
            if (top && top.seen && top.expectKey) {
                let key;
                try { key = JSON.parse(text.slice(i, j + 1)); } catch { key = text.slice(i + 1, j); }
                const where = top.path ? `${top.path}.${key}` : key;
                if (top.seen.has(key)) dups.push(where);
                top.seen.add(key);
                top.expectKey = false;
                lastKey = key;
            }
            i = j + 1;
            continue;
        }
        const top = stack[stack.length - 1];
        if (c === '{' || c === '[') {
            const parentPath = top ? top.path : '';
            const path = top && top.seen ? (parentPath ? `${parentPath}.${lastKey}` : lastKey) : parentPath;
            stack.push({ seen: c === '{' ? new Set() : null, path: path ?? '', expectKey: c === '{' });
        } else if (c === '}' || c === ']') {
            stack.pop();
        } else if (c === ',' && top && top.seen) {
            top.expectKey = true;
        }
        i += 1;
    }
    return dups;
}

/**
 * Apply `override` to `defaults`.
 *
 * @param {object} defaults   the compiled-in profile (frozen, flat, numbers)
 * @param {undefined|object|string} override  see the docblock
 * @param {object} opts
 * @param {string} opts.defaultId        the compiled-in profile's name
 * @param {string[]} [opts.knownFlags]   the flags that exist (none yet)
 * @returns {{profile, defaults, id, source, overrides, defaulted, flags}} frozen.
 *   `profile` IS `defaults` when there is no override; otherwise a new frozen
 *   object in the defaults' key order. `overrides` is every key the override
 *   set, `{key: value}`; `defaulted` the keys it did not, in order.
 */
export function applyOverrides(defaults, override, { defaultId, knownFlags = [] } = {}) {
    const keys = Object.keys(defaults);
    if (override === undefined) {
        return Object.freeze({
            profile: defaults, defaults, id: defaultId, source: DEFAULT_SOURCE,
            overrides: Object.freeze({}), defaulted: Object.freeze(keys), flags: Object.freeze({}),
        });
    }
    let obj = override;
    if (typeof override === 'string') {
        const dups = duplicateKeys(override);
        if (dups.length) refuse(`duplicate key ${dups.map(show).join(', ')}`);
        try { obj = JSON.parse(override); } catch (e) { refuse(`not JSON: ${e.message}`); }
    }
    if (!isPlainObject(obj)) refuse(`must be a flat JSON object of profile keys, got ${show(obj)}`);

    const known = new Set(keys);
    const set = {};
    let id = defaultId;
    let hasId = false;
    const flags = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'id') {
            if (typeof v !== 'string' || !v) refuse(`"id" must be a non-empty string (the profile's name), got ${show(v)}`);
            id = v;
            hasId = true;
        } else if (k === 'flags') {
            if (!isPlainObject(v)) refuse(`"flags" must be an object of formula flags, got ${show(v)}`);
            for (const f of Object.keys(v)) {
                if (!knownFlags.includes(f)) {
                    refuse(`unknown flag "${f}"; the known flags are: ${knownFlags.length ? knownFlags.join(', ') : '(none — no flag exists yet)'}`);
                }
                flags[f] = v[f];
            }
        } else if (!known.has(k)) {
            refuse(`unknown key "${k}"; the known keys are: ${keys.join(', ')}`);
        } else if (v !== null && typeof v === 'object') {
            refuse(`"${k}" is a nested value (${show(v)}); a profile is flat, one number per key`);
        } else if (typeof v !== 'number') {
            refuse(`"${k}" must be a number, got ${show(v)}`);
        } else if (!Number.isFinite(v)) {
            refuse(`"${k}" must be a finite number, got ${String(v)}`);
        } else {
            set[k] = v;
        }
    }
    const profile = {};
    for (const k of keys) profile[k] = Object.hasOwn(set, k) ? set[k] : defaults[k];
    return Object.freeze({
        profile: Object.freeze(profile),
        defaults,
        id,
        source: `override:${hasId ? id : 'inline'}`,
        overrides: Object.freeze(set),
        defaulted: Object.freeze(keys.filter((k) => !Object.hasOwn(set, k))),
        flags: Object.freeze(flags),
    });
}
