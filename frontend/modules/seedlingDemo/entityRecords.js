/**
 * seedlingDemo/entityRecords — **THE CONTRACT FOR SEEDLING'S PER-ENTITY
 * PARAMETER RECORDS** (behaviour-parameters arc, slice P1; plan
 * `behaviour-parameters-plan.md` §3 P1, §6.4). The profile's machinery
 * (`seedlingProfile.js`: a dump, an md5 identity, load-time overrides, a
 * witness) given to the tables the model ALREADY holds — `ENEMY_CLASSES`,
 * `CHASERS`, `SPINNER`, `CRUSHER` … — without moving one of them.
 *
 * ── WHAT A RECORD IS ───────────────────────────────────────────────────
 *
 * A declaring module wraps its table where it declares it:
 *
 *     export const CHASERS = defineRecord('chasers', { … }, { doc: ['src'], src: 'chasers.js' });
 *
 * `defineRecord` returns THE SAME OBJECT it was given (`Object.is`), deep-
 * frozen, so every reader keeps its object and every value stays where it
 * was — the wrapper is a declaration, not arithmetic. Unlike the profile a
 * record is not flat and not numbers only: its leaves may be a finite
 * number, a boolean, a string, `null`, or an array/object of those. Refused
 * BY NAME with the dotted path: a function, `undefined`, `NaN`, `±Infinity`,
 * any other object (a `Map`, a class instance), a cycle, a key that would
 * make a path ambiguous (empty, or holding `.`, `[` or `]`).
 *
 * ── DOC AND CONTENT ────────────────────────────────────────────────────
 *
 * A string is one of two things, and the record says which:
 *
 *   DOC      a key named in `doc` (at any depth: `src` covers `ctor.src`)
 *            holds PROSE — an AS3 anchor, a why, a threat description. It
 *            must hold a string; it is left out of the dump, the md5 and the
 *            witness, so rewording a comment moves no identity.
 *   CONTENT  every other string is data the game reads or a rule the model
 *            keys on (`type: 'Solid'`, `hitables`, `as3`, `aggro.kind`), and
 *            is part of the identity.
 *
 * A `doc` name that names no key of the record is refused (a stale list).
 *
 * ── THE IDENTITY ───────────────────────────────────────────────────────
 *
 *   `entitiesDump()`   one `"<name><path>": <JSON leaf>` line per non-doc
 *                      leaf (an empty array or object is one leaf), for
 *                      every registered record IN NAME ORDER — never
 *                      registration order, which is import order — inside
 *                      braces, with a final newline. It is JSON.
 *   `entitiesMd5()`    md5 of the dump: the records' IDENTITY.
 *   `entitiesStamp()`  `{md5, records}`. It rides on `runTape`'s RESULT
 *                      beside `profile` — never on the stream, an emitted
 *                      tape or the envelope (`tapeEnvelope.validateProfile`
 *                      holds a tape's `profile` to exactly `{id, md5}`).
 *
 * A path is the record's name, then `.key` per object step and `[i]` per
 * array step: `enemyClasses.bob.aggro.range`, `spinner.solids[0]`,
 * `directions[2].dx`.
 *
 * ── OVERRIDES ──────────────────────────────────────────────────────────
 *
 * `globalThis.__SEEDLING_ENTITY_RECORDS__`, read ONCE when this module
 * evaluates: `undefined` (none), a FLAT object keyed by path, or its JSON
 * text (duplicate keys are found in the TEXT). A value is a number (finite),
 * a boolean or a string. Refused by name at load: a duplicate key, a nested
 * value, a non-finite number, any other type, a key that is not a path.
 * Refused by name when the record registers: an unknown path, a doc key, a
 * type change (a string into a number leaf …). An override is applied when
 * its record registers, BEFORE the record freezes; the object returned is
 * then a copy along the overridden path wherever a node on it was already
 * frozen (so a table's inner `Object.freeze` nodes are never written), and
 * the same object everywhere else.
 *
 * ⚖ A path naming a record that NEVER registers is NOT refused — it is
 * reported by `entitiesAnnouncements()` as `unused`. Registration is import
 * order, and a page (or a test) need not import every declaring module; a
 * refusal there would make an override's validity depend on what else the
 * process happened to load. A runner that must know every path took effect
 * asks `entitiesUnused()` after importing the model.
 *
 * ⚠ PROCESS-WIDE AT LOAD, like the profile: a module that copies a leaf out
 * at its own evaluation (`const HAMMER = SPINNER.hammerLength`) copies the
 * overridden value only because the override is applied at registration,
 * before any reader can see the record. Set the global before the first
 * import of the model (`scripts/procgen/seedlingProfileLoader.mjs`,
 * `SEEDLING_ENTITY_RECORDS=<path>`).
 *
 * Dependency-free apart from `md5.js` and `profileOverrides.js`'s
 * `duplicateKeys` (itself dependency-free), and browser-safe (no `fs`, no
 * `process`). It imports NO model module — the model modules import it — so
 * no cycle can form.
 */

import { md5 } from './md5.js';
import { duplicateKeys } from './profileOverrides.js';

/** The global an override is read from. */
export const ENTITY_RECORDS_GLOBAL = '__SEEDLING_ENTITY_RECORDS__';

/**
 * The modules that declare a record, so a runner (the witness, the tests)
 * can register every record regardless of what else it imported.
 * `entityRecords.test.js` holds this list to the files that call
 * `defineRecord`.
 */
export const ENTITY_RECORD_MODULES = Object.freeze([
    'arrowTrap.js', 'chasers.js', 'combat.js', 'crusher.js', 'enemyDamage.js',
    'fallRock.js', 'iceTurret.js', 'iceTurretBlast.js', 'moonrock.js', 'pulser.js', 'spinner.js',
]);

/** Every refusal this module makes. The message names the record and path. */
export class EntityRecordError extends Error {
    constructor(message) {
        super(`entity records: ${message}`);
        this.name = 'EntityRecordError';
    }
}

const refuse = (message) => { throw new EntityRecordError(message); };
const show = (v) => (v === undefined ? 'undefined' : typeof v === 'number' && !Number.isFinite(v) ? String(v) : JSON.stringify(v));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const RECORD_NAME = /^[A-Za-z][A-Za-z0-9]*$/;
const BAD_KEY = /[.[\]]/;
const leafType = (v) => (v === null ? 'null' : typeof v);

/** name → {name, record, doc, src}. The registry. */
const RECORDS = new Map();

/**
 * Every object/array node a registered record holds → the path it was
 * registered at. ⛔ A node two records share is overridden ASYMMETRICALLY
 * (the P1 residue, ⚖ Q13): an override through the first record's path
 * writes the shared node in place and moves the second record too, while
 * the second record's own path only reaches a copy. So a node already
 * held by another record is REFUSED; the second record carries its own
 * value-identical literal.
 */
const NODE_OWNER = new WeakMap();

/** Every object/array node under `record`, with its dotted path. */
function nodesOf(name, record) {
    const out = [];
    const visit = (v, path) => {
        if (v === null || typeof v !== 'object') return;
        out.push([v, path]);
        if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`));
        else for (const k of Object.keys(v)) visit(v[k], `${path}.${k}`);
    };
    visit(record, name);
    return out;
}

// ── the override, read once ──────────────────────────────────────────

/** Parse and validate the global's override into Map(path → value). */
function readOverride(raw) {
    if (raw === undefined) return null;
    let obj = raw;
    if (typeof raw === 'string') {
        const dups = duplicateKeys(raw);
        if (dups.length) refuse(`override: duplicate key ${dups.map(show).join(', ')}`);
        try { obj = JSON.parse(raw); } catch (e) { refuse(`override: not JSON: ${e.message}`); }
    }
    if (!isPlainObject(obj)) refuse(`override: must be a flat object of record paths, got ${show(obj)}`);
    const out = new Map();
    for (const [path, v] of Object.entries(obj)) {
        const [, name] = /^([A-Za-z][A-Za-z0-9]*)[.[]/.exec(path) ?? [];
        if (!name) refuse(`override: "${path}" is not a record path ("<name>.<key>…" or "<name>[<i>]…")`);
        if (v !== null && typeof v === 'object') refuse(`override: "${path}" is a nested value (${show(v)}); an override is flat, one leaf per path`);
        if (typeof v === 'number' && !Number.isFinite(v)) refuse(`override: "${path}" must be a finite number, got ${show(v)}`);
        if (!['number', 'boolean', 'string'].includes(typeof v)) refuse(`override: "${path}" must be a number, a boolean or a string, got ${show(v)}`);
        out.set(path, { name, value: v });
    }
    return out;
}

const OVERRIDE = readOverride(globalThis[ENTITY_RECORDS_GLOBAL]);
/** path → value, for every override path a registered record took. */
const APPLIED = new Map();

/** Where the live records came from. */
export const ENTITIES_SOURCE = OVERRIDE ? 'override' : 'compiled-in default';

// ── the walk ─────────────────────────────────────────────────────────

/**
 * Every leaf of `record`, as `{path, segs, value, doc}` in key order. An empty
 * array or object is one leaf (so the dump still sees it). `doc` marks a
 * leaf under a doc key.
 */
function leavesOf(name, record, docKeys) {
    const out = [];
    const visit = (v, path, segs, doc) => {
        if (Array.isArray(v) ? v.length : isPlainObject(v) && Object.keys(v).length) {
            if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`, [...segs, i], doc));
            else for (const k of Object.keys(v)) visit(v[k], `${path}.${k}`, [...segs, k], doc || docKeys.has(k));
            return;
        }
        out.push({ path, segs, value: v, doc });
    };
    visit(record, name, [], false);
    return out;
}

/**
 * Refuse, by name and dotted path, anything a record may not hold (the
 * docblock's list). Returns nothing; throws `EntityRecordError`.
 *
 * @param {string} name
 * @param {object|Array} record
 * @param {{doc?: string[]}} [opts]
 */
export function assertEntityRecord(name, record, { doc = [] } = {}) {
    if (typeof name !== 'string' || !RECORD_NAME.test(name)) refuse(`record name ${show(name)} must be an identifier (letters and digits)`);
    if (!Array.isArray(doc) || doc.some((d) => typeof d !== 'string' || !d)) refuse(`${name}: doc must be a list of key names, got ${show(doc)}`);
    if (!(isPlainObject(record) || Array.isArray(record))) refuse(`${name}: a record is a plain object or an array, got ${show(record)}`);
    const docKeys = new Set(doc);
    const seenDoc = new Set();
    const stack = [];
    const visit = (v, path) => {
        if (v !== null && typeof v === 'object') {
            if (!(Array.isArray(v) || isPlainObject(v))) refuse(`${path}: ${Object.prototype.toString.call(v)} is not a record value (a plain object or array)`);
            if (stack.includes(v)) refuse(`${path}: a cycle — the record reaches itself`);
            stack.push(v);
            if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`));
            else {
                for (const k of Object.keys(v)) {
                    if (!k || BAD_KEY.test(k)) refuse(`${path}: key ${show(k)} would make a path ambiguous (empty, or holds . [ ])`);
                    if (docKeys.has(k)) {
                        seenDoc.add(k);
                        if (typeof v[k] !== 'string') refuse(`${path}.${k}: "${k}" is a doc key and must hold a string (prose), got ${show(v[k])}`);
                        continue;
                    }
                    visit(v[k], `${path}.${k}`);
                }
            }
            stack.pop();
            return;
        }
        if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
        if (typeof v === 'number') {
            if (!Number.isFinite(v)) refuse(`${path}: ${show(v)} is not a finite number`);
            return;
        }
        refuse(`${path}: a ${typeof v} is not a record value (number, boolean, string, null, array, object)`);
    };
    visit(record, name);
    const stale = doc.filter((d) => !seenDoc.has(d));
    if (stale.length) refuse(`${name}: doc names ${stale.map(show).join(', ')}, which name no key of the record`);
}

/** Freeze `v` and everything under it. Already-frozen nodes are walked too. */
function deepFreeze(v) {
    if (v === null || typeof v !== 'object') return v;
    for (const k of Object.keys(v)) deepFreeze(v[k]);
    return Object.freeze(v);
}

/**
 * Write `value` at `segs` under `node`: in place where the node is not
 * frozen, a shallow copy where it is. Returns the (possibly new) node.
 */
function setAt(node, segs, value) {
    if (!segs.length) return value;
    const [k, ...rest] = segs;
    const child = setAt(node[k], rest, value);
    if (Object.is(child, node[k])) return node;
    const target = Object.isFrozen(node) ? (Array.isArray(node) ? [...node] : { ...node }) : node;
    target[k] = child;
    return target;
}

/**
 * Register `record` under `name`, apply the override paths that name it,
 * deep-freeze it, and return it — THE SAME OBJECT when no override touches
 * it.
 *
 * @param {string} name   unique across the registry; the paths' first segment
 * @param {object|Array} record
 * @param {{doc?: string[], src?: string}} [opts]  `doc` the prose keys;
 *   `src` the declaring file
 * @returns {object|Array}
 */
export function defineRecord(name, record, { doc = [], src = '' } = {}) {
    assertEntityRecord(name, record, { doc });
    if (RECORDS.has(name)) refuse(`record "${name}" is registered twice (first by ${RECORDS.get(name).src || '?'}, again by ${src || '?'})`);
    for (const [node, path] of nodesOf(name, record)) {
        const owner = NODE_OWNER.get(node);
        if (owner && owner.name !== name) {
            refuse(`record "${name}": ${path} is the same object as ${owner.path}, registered by "${owner.name}" (${owner.src || '?'}) — give "${name}" its own value-identical literal; a node two records share is overridden asymmetrically`);
        }
    }
    const docKeys = new Set(doc);
    let live = record;
    if (OVERRIDE) {
        const mine = [...OVERRIDE].filter(([, o]) => o.name === name);
        if (mine.length) {
            const byPath = new Map(leavesOf(name, record, docKeys).map((l) => [l.path, l]));
            for (const [path, { value }] of mine) {
                const leaf = byPath.get(path);
                if (!leaf) refuse(`override: unknown path "${path}" — record "${name}" has no such leaf (see entitiesDump())`);
                if (leaf.doc) refuse(`override: "${path}" is a doc key (prose, outside the identity); it cannot be overridden`);
                if (leafType(leaf.value) !== leafType(value)) refuse(`override: "${path}" is a ${leafType(leaf.value)} leaf (${show(leaf.value)}); it cannot take a ${leafType(value)} (${show(value)})`);
                live = setAt(live, leaf.segs, value);
                APPLIED.set(path, value);
            }
        }
    }
    deepFreeze(live);
    for (const r of new Set([record, live])) {
        for (const [node, path] of nodesOf(name, r)) {
            if (!NODE_OWNER.has(node)) NODE_OWNER.set(node, { name, path, src });
        }
    }
    RECORDS.set(name, Object.freeze({ name, record: live, doc: Object.freeze([...doc]), src }));
    return live;
}

// ── reading the registry ─────────────────────────────────────────────

/** The registered records' names, sorted. */
export function entityRecordNames() {
    return [...RECORDS.keys()].sort();
}

/** `{name, record, doc, src}` for one registered record, or undefined. */
export function entityRecord(name) {
    return RECORDS.get(name);
}

/**
 * Every non-doc leaf of every registered record, in dump order:
 * `{record, path, value, type}` (`type` is `number` | `boolean` | `string` |
 * `null` | `array` | `object`, the last two only for an empty one).
 */
export function entityLeaves() {
    const out = [];
    for (const name of entityRecordNames()) {
        const { record, doc } = RECORDS.get(name);
        for (const l of leavesOf(name, record, new Set(doc))) {
            if (l.doc) continue;
            const type = Array.isArray(l.value) ? 'array' : leafType(l.value);
            out.push({ record: name, path: l.path, value: l.value, type });
        }
    }
    return out;
}

/** The canonical text: one `"<path>": <JSON leaf>` line per non-doc leaf, records in name order. */
export function entitiesDump() {
    const lines = entityLeaves().map((l) => `  ${JSON.stringify(l.path)}: ${JSON.stringify(l.value)}`);
    return `{\n${lines.join(',\n')}\n}\n`;
}

/** md5 of `entitiesDump()` — the records' identity. */
export function entitiesMd5() {
    return md5(entitiesDump());
}

/** `{md5, records}` — what `runTape`'s result carries beside `profile`. */
export function entitiesStamp() {
    return { md5: entitiesMd5(), records: RECORDS.size };
}

/** `{path: value}` for every override path a registered record took. */
export function entitiesOverrides() {
    return Object.fromEntries(APPLIED);
}

/** The override paths no registered record has taken (yet), in override order. */
export function entitiesUnused() {
    return OVERRIDE ? [...OVERRIDE.keys()].filter((p) => !APPLIED.has(p)) : [];
}

/**
 * The announcements, as lines: the provenance, one `set <path>=<value>` per
 * override path taken, one `unused <path>=<value>` per path whose record has
 * not registered, and the record count. The module never prints.
 */
export function entitiesAnnouncements() {
    return [
        `entities: ${ENTITIES_SOURCE} (md5 ${entitiesMd5()})`,
        ...[...APPLIED].map(([p, v]) => `set ${p}=${JSON.stringify(v)}`),
        ...entitiesUnused().map((p) => `unused ${p}=${JSON.stringify(OVERRIDE.get(p).value)} (no record "${OVERRIDE.get(p).name}" registered in this process)`),
        `records: ${RECORDS.size} (${entityRecordNames().join(', ')})`,
    ];
}
