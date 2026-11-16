/**
 * packStructure — **WHAT EXISTS: TASKS, STATS, RESOURCES, BOONS AND PLACES, AS
 * IDS AND LINKS** (⛓ CONTENT SETS PL-1; the shared task shape, Z.1/Z.2, ⚖ the
 * user 2026-11-15: "I agree with all of your recommendations.").
 *
 * The `structure` layer of a content pack. One entry per thing that EXISTS in a
 * game's content, keyed `<pack>:<kind>/<slug>`; an entry holds no number, no
 * name and no native id — the numbers are the `numbers` layer
 * (`packNumbers.js`), the words the `concepts`/`text` layers (a pack concept
 * PRESENTS a structure entry), and what only one game needs its `bindings`
 * layer (`packBindings.js`).
 *
 *   kind      task | stat | resource | boon | place
 *   owner,max (stat, C1) the task or place that owns it; `max: true` = a maximum exists
 *   modifies  (stat, resource, boon, C4) [{ entry: <task id> | "*", part, lasts: loop | always }];
 *             part ∈ time | limit | results.<id> | requires.<id>
 *   place     (task, C5) a place id, or absent
 *   time      (task) the resource id that is the clock
 *   requires  (task, C6) a list of SETS: any one set, all of its members; a member is
 *             { stat } or { resource, consume? }
 *   results   (task, C3) [{ stat } | { resource, sign } | { boon } | { opens }], each with
 *             when ∈ each (default) | last | every_nth
 *   limit     (task, C2) true | { grows_with: <stat id> } | absent
 *   after     (task, S10) a list of sets of task ids
 *   tags      (task) free strings
 *
 * ⛔ REFUSAL BY NAME: a `ContentPackError` naming the pack, the key and the
 * field. Nothing is half-loaded. A key's namespace is its pack's id, so packs
 * added together ("what exists" names one or more) cannot collide.
 *
 * ⛔ LOGIC. This layer is never read by the words setting
 * (`worldContent.CONTENT_LAYERS` is `concepts` and `text`).
 *
 * Pure and DOM-free: it takes a LOADED stack (`loadPackStack`'s result).
 */
import { ContentPackError } from '../contentPacks/contentPackError.js';
import { STRUCTURE_ID_PATTERN, STRUCTURE_KINDS, presentsStructure } from '../packConcepts/packConcepts.js';

export { STRUCTURE_KINDS, STRUCTURE_ID_PATTERN };

/** The fields each kind of entry may carry (`src` names its provenance source, Z.7). */
export const STRUCTURE_FIELDS = Object.freeze({
    place: Object.freeze(['kind', 'src']),
    stat: Object.freeze(['kind', 'src', 'owner', 'max', 'modifies']),
    resource: Object.freeze(['kind', 'src', 'modifies']),
    boon: Object.freeze(['kind', 'src', 'modifies']),
    task: Object.freeze(['kind', 'src', 'place', 'time', 'requires', 'results', 'limit', 'after', 'tags']),
});

/** C3: when a result applies. `each` is the default. */
export const RESULT_WHEN = Object.freeze(['each', 'last', 'every_nth']);
/** C4: how long a `modifies` lasts. */
export const MODIFIES_LASTS = Object.freeze(['loop', 'always']);
/** C4: the parts a `modifies` may change (closed list); `results.` and `requires.` take an entry id. */
export const MODIFIES_PARTS = Object.freeze(['time', 'limit', 'results.<id>', 'requires.<id>']);
/** The four forms of a result: exactly one of these fields, plus `when` (and `sign` with `resource`). */
export const RESULT_FORMS = Object.freeze(['stat', 'resource', 'boon', 'opens']);

const MANIFEST_FIELDS = Object.freeze(['schema_version', 'entries', 'provenance', '_comment']);

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (message) => { throw new ContentPackError(`pack structure: ${message}`); };

/** `{ pack, kind, slug }` of a structure id, or null. */
export function parseStructureId(id) {
    const m = typeof id === 'string' ? STRUCTURE_ID_PATTERN.exec(id) : null;
    return m ? { pack: m[1], kind: m[2], slug: m[3] } : null;
}

/**
 * A modifies `part` → `{ part, id? }`, or null when it is not on the closed
 * list (`time`, `limit`, `results.<id>`, `requires.<id>`).
 */
export function parseModifiesPart(part) {
    if (part === 'time' || part === 'limit') return { part };
    const m = typeof part === 'string' ? /^(results|requires)\.(.+)$/.exec(part) : null;
    if (!m || !parseStructureId(m[2])) return null;
    return { part: m[1], id: m[2] };
}

/** One reference: a structure id whose kind is one of `kinds`; refused by name otherwise. Returns the id. */
function ref(at, field, value, kinds) {
    const p = parseStructureId(value);
    if (!p) fail(`${at}: ${field} ${JSON.stringify(value)} is not a structure id (<pack>:<kind>/<slug>)`);
    if (!kinds.includes(p.kind)) fail(`${at}: ${field} "${value}" is a ${p.kind}, not ${kinds.length > 1 ? 'one of ' : 'a '}${kinds.join(', ')}`);
    return value;
}

function onlyFields(at, obj, allowed, what) {
    if (!isObject(obj)) fail(`${at}: ${what} is not an object`);
    for (const f of Object.keys(obj)) if (!allowed.includes(f)) fail(`${at}: ${what} has unknown field "${f}" (${allowed.join(', ')})`);
}

/** Every id one entry names, as `[{ field, id, kinds }]` (for the stack's cross-check). */
function referencesOf(entry) {
    const out = [];
    const add = (field, id, kinds) => { if (id !== undefined && id !== '*') out.push({ field, id, kinds }); };
    add('owner', entry.owner, ['task', 'place']);
    for (const [i, m] of (entry.modifies ?? []).entries()) {
        add(`modifies[${i}].entry`, m.entry, ['task']);
        const p = parseModifiesPart(m.part);
        if (p?.id) add(`modifies[${i}].part`, p.id, STRUCTURE_KINDS);
    }
    add('place', entry.place, ['place']);
    add('time', entry.time, ['resource']);
    for (const [i, set] of (entry.requires ?? []).entries()) {
        for (const [j, member] of set.entries()) {
            add(`requires[${i}][${j}]`, member.stat ?? member.resource, member.stat ? ['stat'] : ['resource']);
        }
    }
    for (const [i, r] of (entry.results ?? []).entries()) {
        const form = RESULT_FORMS.find((f) => f in r);
        add(`results[${i}].${form}`, r[form], form === 'opens' ? ['place', 'task'] : [form]);
    }
    if (isObject(entry.limit)) add('limit.grows_with', entry.limit.grows_with, ['stat']);
    for (const [i, set] of (entry.after ?? []).entries()) for (const [j, id] of set.entries()) add(`after[${i}][${j}]`, id, ['task']);
    return out;
}

function checkModifies(at, list) {
    if (!Array.isArray(list) || !list.length) fail(`${at}: modifies must be a non-empty list`);
    for (const [i, m] of list.entries()) {
        const mAt = `${at}: modifies[${i}]`;
        onlyFields(mAt, m, ['entry', 'part', 'lasts'], 'the modifier');
        if (m.entry !== '*') ref(mAt, 'entry', m.entry, ['task']);
        if (!parseModifiesPart(m.part)) fail(`${mAt}: part ${JSON.stringify(m.part)} is not one of ${MODIFIES_PARTS.join(', ')}`);
        if (!MODIFIES_LASTS.includes(m.lasts)) fail(`${mAt}: lasts ${JSON.stringify(m.lasts)} is not one of ${MODIFIES_LASTS.join(', ')}`);
    }
}

function checkSets(at, field, list, checkMember) {
    if (!Array.isArray(list)) fail(`${at}: ${field} must be a list of sets (a list of lists)`);
    for (const [i, set] of list.entries()) {
        if (!Array.isArray(set) || !set.length) fail(`${at}: ${field}[${i}] is not a non-empty set (a list)`);
        for (const [j, member] of set.entries()) checkMember(`${at}: ${field}[${i}][${j}]`, member);
    }
}

function checkTask(at, e) {
    if ('place' in e) ref(at, 'place', e.place, ['place']);
    if ('time' in e) ref(at, 'time', e.time, ['resource']);
    if ('requires' in e) {
        checkSets(at, 'requires', e.requires, (mAt, member) => {
            if (!isObject(member)) fail(`${mAt} is not { stat } or { resource, consume? }`);
            if ('stat' in member) {
                onlyFields(mAt, member, ['stat'], 'a stat requirement');
                ref(mAt, 'stat', member.stat, ['stat']);
            } else if ('resource' in member) {
                onlyFields(mAt, member, ['resource', 'consume'], 'a resource requirement');
                ref(mAt, 'resource', member.resource, ['resource']);
                if ('consume' in member && typeof member.consume !== 'boolean') fail(`${mAt}: consume must be true or false`);
            } else {
                fail(`${mAt} is not { stat } or { resource, consume? }`);
            }
        });
    }
    if ('results' in e) {
        if (!Array.isArray(e.results)) fail(`${at}: results must be a list`);
        for (const [i, r] of e.results.entries()) {
            const rAt = `${at}: results[${i}]`;
            if (!isObject(r)) fail(`${rAt} is not an object`);
            const forms = RESULT_FORMS.filter((f) => f in r);
            if (forms.length !== 1) fail(`${rAt} needs exactly one of ${RESULT_FORMS.join(', ')} (got ${forms.length ? forms.join(' + ') : 'none'})`);
            const [form] = forms;
            onlyFields(rAt, r, form === 'resource' ? ['resource', 'sign', 'when'] : [form, 'when'], 'the result');
            ref(rAt, form, r[form], form === 'opens' ? ['place', 'task'] : [form]);
            if (form === 'resource' && r.sign !== '+' && r.sign !== '-') fail(`${rAt}: a resource result needs sign "+" or "-" (got ${JSON.stringify(r.sign)})`);
            if ('when' in r && !RESULT_WHEN.includes(r.when)) fail(`${rAt}: when ${JSON.stringify(r.when)} is not one of ${RESULT_WHEN.join(', ')}`);
        }
    }
    if ('limit' in e) {
        if (e.limit !== true) {
            onlyFields(at, e.limit, ['grows_with'], 'limit (true, or { grows_with })');
            ref(at, 'limit.grows_with', e.limit.grows_with, ['stat']);
        }
    }
    if ('after' in e) checkSets(at, 'after', e.after, (mAt, id) => ref(mAt, 'the task', id, ['task']));
    if ('tags' in e && (!Array.isArray(e.tags) || !e.tags.every((t) => typeof t === 'string' && t.length > 0))) {
        fail(`${at}: tags must be a list of non-empty strings`);
    }
}

/** Validate one pack's structure manifest; refuses by name. Returns it. */
export function parseStructureManifest(json, packId) {
    const where = `pack "${packId}" structure manifest`;
    if (!isObject(json) || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this reader reads 1)`);
    for (const field of Object.keys(json)) {
        if (!MANIFEST_FIELDS.includes(field)) fail(`${where}: unknown field "${field}" (${MANIFEST_FIELDS.join(', ')})`);
    }
    const entries = json.entries ?? {};
    if (!isObject(entries)) fail(`${where}: entries is not an object`);
    for (const [key, e] of Object.entries(entries)) {
        const at = `${where}: entry "${key}"`;
        const id = parseStructureId(key);
        if (!id) fail(`${at}: the key is not <pack>:<kind>/<slug> (kind one of ${STRUCTURE_KINDS.join(', ')})`);
        if (id.pack !== packId) fail(`${at}: the key's namespace "${id.pack}" is not its pack's id "${packId}" (ids are namespaced so packs added together cannot collide)`);
        if (!isObject(e)) fail(`${at}: the entry is not an object`);
        if (!STRUCTURE_KINDS.includes(e.kind)) fail(`${at}: kind ${JSON.stringify(e.kind)} is not one of ${STRUCTURE_KINDS.join(', ')}`);
        if (e.kind !== id.kind) fail(`${at}: kind "${e.kind}" does not match the key's kind "${id.kind}"`);
        const allowed = STRUCTURE_FIELDS[e.kind];
        for (const f of Object.keys(e)) if (!allowed.includes(f)) fail(`${at}: field "${f}" is not one a ${e.kind} takes (${allowed.join(', ')})`);
        if ('src' in e && (typeof e.src !== 'string' || !e.src)) fail(`${at}: src must be a provenance source id`);
        if (e.kind === 'stat') {
            if ('owner' in e) ref(at, 'owner', e.owner, ['task', 'place']);
            if ('max' in e && e.max !== true) fail(`${at}: max is true (a maximum exists; its value is in numbers) or absent`);
        }
        if ('modifies' in e) checkModifies(at, e.modifies);
        if (e.kind === 'task') checkTask(at, e);
    }
    return json;
}

const deepFreeze = (v) => {
    if (v && typeof v === 'object') {
        for (const x of Object.values(v)) deepFreeze(x);
        Object.freeze(v);
    }
    return v;
};

/**
 * ⛓ **THE STRUCTURE OF ONE OR MORE PACKS, ADDED TOGETHER** ("what exists" names
 * one or more packs, Z.5). Packs without a structure layer are skipped. Every
 * id an entry names must be an entry of the stack, of the right kind: refused
 * by name otherwise.
 */
export function createStructure(stack) {
    const entries = new Map();
    for (const loaded of stack) {
        const json = loaded.layers?.structure;
        if (!json) continue;
        parseStructureManifest(json, loaded.id);
        for (const [key, value] of Object.entries(json.entries ?? {})) {
            // Two packs cannot carry one key (its namespace is its pack's id): a stack naming a pack twice is the
            // loader's refusal, so this is a guard, by name.
            if (entries.has(key)) fail(`entry "${key}" is in packs "${entries.get(key).pack}" and "${loaded.id}"`);
            entries.set(key, deepFreeze({ key, pack: loaded.id, ...structuredClone(value) }));
        }
    }
    for (const entry of entries.values()) {
        for (const { field, id, kinds } of referencesOf(entry)) {
            const target = entries.get(id);
            if (!target) fail(`pack "${entry.pack}" entry "${entry.key}": ${field} names "${id}", which no pack in the stack holds`);
            if (!kinds.includes(target.kind)) fail(`pack "${entry.pack}" entry "${entry.key}": ${field} names the ${target.kind} "${id}" (wants ${kinds.join(' or ')})`);
        }
    }
    return Object.freeze({
        has: (key) => entries.has(key),
        keys: () => [...entries.keys()],
        get: (key) => entries.get(key) ?? null,
        ofKind(kind) {
            if (!STRUCTURE_KINDS.includes(kind)) fail(`ofKind(${JSON.stringify(kind)}): not one of ${STRUCTURE_KINDS.join(', ')}`);
            return [...entries.values()].filter((e) => e.kind === kind).map((e) => e.key);
        },
        /** The packs whose structure the stack holds, in stack order. */
        packs: () => [...new Set([...entries.values()].map((e) => e.pack))],
    });
}

/**
 * ⛓ **EVERY NAMESPACED `presents` NAMES A REAL ENTRY** — the cross-check of the
 * words against what exists, where both are loaded (the resolver; PL-2). Bare
 * (mechanic) ids are `contentRoles.assertPresents`'s. Refused by name.
 */
export function assertPresentsStructure(packConcepts, structure) {
    for (const key of packConcepts.keys()) {
        const c = packConcepts.get(key);
        if (!presentsStructure(c.presents)) continue;
        if (!structure.has(c.presents)) fail(`pack "${c.pack}" concept "${key}" presents "${c.presents}", which no structure in the stack holds`);
    }
}
