/**
 * contentPacks/provenance — **WHERE EVERY ENTRY OF EVERY LAYER CAME FROM**
 * (⛓ CONTENT SETS PL-1; ⚖ the user 2026-11-15: "I'll want the concept library,
 * and also the other libraries, to track the source of their contents. For
 * example, which game the data came from, which user contributed an image, or
 * which Claude model generated original data."; the shape is Z.7, ruled Z5/Z6).
 *
 * Every layer manifest carries ONE block, and an entry may carry `src`:
 *
 *     "provenance": {
 *       "sources": { "<id>": { "type": "game" | "person" | "model" | "authored" | "derived", … } },
 *       "default": "<id>",
 *       "groups":  { "<key prefix>": "<id>" }          // optional
 *     }
 *
 * An entry's source is its own `src`, else the LONGEST `groups` prefix of its
 * key, else `default`. So every entry resolves once `default` is listed, and a
 * layer whose rows are plain strings (the text layer) names a per-entry source
 * with a group whose prefix is the whole key.
 *
 * ⛔ THE LOADER CHECKS IT (Z6 check 1). `loadPackStack` calls
 * `checkLayerProvenance` on every layer it reads, so a pack with a layer that
 * has no block, a `default` or `src` or group naming an unlisted source, or a
 * source missing its type's required fields, is refused by name — pack, layer
 * and key — before any library sees it.
 *
 * ⛔ A `person` or a `model` is a DECLARATION (Z6 check 3): presence and form
 * only; nothing here can verify it. A `game` source's `extracted_by` names the
 * script whose `--check` compares the pack with the game's files (check 2, held
 * by `provenance.test.js`).
 *
 * ⛔ A WORLD DOCUMENT CARRIES NO PER-ENTRY PROVENANCE (Z.7). It records its pack
 * ids; the source of anything in it is looked up through the packs.
 *
 * Pure and DOM-free.
 */
import { ContentPackError } from './contentPackError.js';

/** The five source types (Z5) and the fields each REQUIRES. */
export const SOURCE_TYPES = Object.freeze(['game', 'person', 'model', 'authored', 'derived']);

/** The fields a source of each type may carry (besides `type`). Anything else is refused by name. */
export const SOURCE_FIELDS = Object.freeze({
    game: Object.freeze(['name', 'repo', 'commit', 'path', 'files', 'extracted_by', 'credit', 'licence', 'approved', 'note']),
    person: Object.freeze(['name', 'permission', 'licence', 'approved', 'note']),
    model: Object.freeze(['model', 'family', 'date', 'licence', 'approved', 'note']),
    authored: Object.freeze(['by', 'licence', 'approved', 'note']),
    derived: Object.freeze(['from', 'by', 'licence', 'approved', 'note']),
});

/** The literal a `model` source names when the exact model id was not logged (it then names a `family`). */
export const UNRECORDED_MODEL = 'unrecorded';

const BLOCK_FIELDS = Object.freeze(['sources', 'default', 'groups']);
const APPROVED_FIELDS = Object.freeze(['by', 'date']);
const SOURCE_ID_PATTERN = /^[a-z][a-zA-Z0-9_-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;
/** A rule id with its version (`R1@1`) — the `by` of a source a fill rule wrote. */
const RULE_PATTERN = /^[A-Za-z][A-Za-z0-9-]*@\d+$/;
/** A script path in this repository, optionally with its flag (`scripts/x.mjs --check`). */
const SCRIPT_PATTERN = /^[A-Za-z0-9_./-]+\.(?:mjs|js|cjs|py)(?: --check)?$/;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;

/** The refusal, naming the pack, the layer and (when there is one) the key. */
function refuse(packId, layer, message, key = null) {
    const at = key === null ? '' : ` key "${key}"`;
    throw new ContentPackError(`content pack "${packId}" layer "${layer}" provenance${at}: ${message}`);
}

function checkApproved(value, fail) {
    if (!isObject(value)) fail('approved must be { by, date }');
    for (const f of Object.keys(value)) if (!APPROVED_FIELDS.includes(f)) fail(`approved has unknown field "${f}" (${APPROVED_FIELDS.join(', ')})`);
    if (!isText(value.by)) fail('approved.by is missing');
    if (typeof value.date !== 'string' || !DATE_PATTERN.test(value.date)) fail(`approved.date ${JSON.stringify(value.date)} is not YYYY-MM-DD`);
}

/**
 * ⛓ **ONE SOURCE, CHECKED** — its type, its type's required fields and their form.
 * `fail(message)` throws; returns nothing.
 */
export function checkSource(id, source, fail) {
    const at = (m) => fail(`source "${id}": ${m}`);
    if (!SOURCE_ID_PATTERN.test(id)) fail(`source id ${JSON.stringify(id)} is not an id (${SOURCE_ID_PATTERN})`);
    if (!isObject(source)) at('is not an object');
    if (!SOURCE_TYPES.includes(source.type)) at(`type ${JSON.stringify(source.type)} is not one of ${SOURCE_TYPES.join(', ')}`);
    const allowed = SOURCE_FIELDS[source.type];
    for (const f of Object.keys(source)) {
        if (f !== 'type' && !allowed.includes(f)) at(`field "${f}" is not one a ${source.type} source takes (${allowed.join(', ')})`);
    }
    for (const f of ['licence', 'note', 'credit', 'permission']) {
        if (f in source && !isText(source[f])) at(`${f} must be a non-empty string`);
    }
    if ('approved' in source) checkApproved(source.approved, at);
    switch (source.type) {
        case 'game': {
            if (!isText(source.name)) at('a game source needs its name');
            const hasRepo = 'repo' in source || 'commit' in source;
            if (hasRepo) {
                if (!isText(source.repo)) at('a game source with a commit needs its repo');
                if (typeof source.commit !== 'string' || !COMMIT_PATTERN.test(source.commit)) at(`commit ${JSON.stringify(source.commit)} is not a commit id`);
            }
            if ('path' in source && !isText(source.path)) at('path must be a non-empty string');
            if (!hasRepo && !('path' in source)) at('a game source needs a repo and a commit, or a path in this repository');
            if ('files' in source && (!Array.isArray(source.files) || !source.files.length || !source.files.every(isText))) {
                at('files must be a non-empty list of paths');
            }
            if ('extracted_by' in source) {
                const list = Array.isArray(source.extracted_by) ? source.extracted_by : [source.extracted_by];
                if (!list.length || !list.every((s) => typeof s === 'string' && SCRIPT_PATTERN.test(s))) {
                    at(`extracted_by ${JSON.stringify(source.extracted_by)} is not a script path ("<path> --check")`);
                }
            }
            break;
        }
        case 'person':
            if (!isText(source.name)) at('a person source needs the name they chose to be credited by');
            break;
        case 'model':
            if (!isText(source.model)) at('a model source needs the exact model id, or "unrecorded" with a family');
            if (source.model === UNRECORDED_MODEL && !isText(source.family)) at('an "unrecorded" model needs its family');
            if (source.model !== UNRECORDED_MODEL && 'family' in source) at('family is only for an "unrecorded" model (the id names it)');
            if (typeof source.date !== 'string' || !DATE_PATTERN.test(source.date)) at(`date ${JSON.stringify(source.date)} is not YYYY-MM-DD`);
            break;
        case 'authored':
            if (!isText(source.by)) at('an authored source needs its by');
            break;
        case 'derived':
            if (!Array.isArray(source.from) || !source.from.length || !source.from.every(isText)) {
                at('a derived source needs from: a non-empty list of source ids or entry keys');
            }
            if (typeof source.by !== 'string' || !(RULE_PATTERN.test(source.by) || SCRIPT_PATTERN.test(source.by))) {
                at(`by ${JSON.stringify(source.by)} is neither a rule id with its version (R1@1) nor a script path`);
            }
            break;
        default:
    }
}

/**
 * ⛓ **THE BLOCK, CHECKED** (without its entries). Returns a frozen
 * `{ sources, default, groups }`; refuses by pack and layer.
 */
export function parseProvenance(block, packId, layer) {
    const fail = (m) => refuse(packId, layer, m);
    if (block === undefined) fail('the manifest has no provenance block (every layer names its sources)');
    if (!isObject(block)) fail('provenance is not an object { sources, default, groups? }');
    for (const f of Object.keys(block)) if (!BLOCK_FIELDS.includes(f)) fail(`unknown field "${f}" (${BLOCK_FIELDS.join(', ')})`);
    if (!isObject(block.sources) || !Object.keys(block.sources).length) fail('sources is missing or empty');
    for (const [id, source] of Object.entries(block.sources)) checkSource(id, source, fail);
    const listed = (id) => Object.prototype.hasOwnProperty.call(block.sources, id);
    if (!isText(block.default)) fail('default is missing');
    if (!listed(block.default)) fail(`default "${block.default}" is not a listed source`);
    const groups = block.groups ?? {};
    if (!isObject(groups)) fail('groups must be { <key prefix>: <source id> }');
    for (const [prefix, id] of Object.entries(groups)) {
        if (!prefix) fail('groups has an empty prefix');
        if (!listed(id)) fail(`group "${prefix}" names "${id}", which is not a listed source`);
    }
    for (const [id, source] of Object.entries(block.sources)) {
        if (source.type !== 'derived') continue;
        for (const from of source.from) {
            // A `from` is a source id of this block or an entry key (`<namespace>:<path>`): a bare word must be listed.
            if (!from.includes(':') && !listed(from)) fail(`source "${id}": from names "${from}", which is not a listed source (or an entry key)`);
        }
    }
    return Object.freeze({
        sources: Object.freeze({ ...block.sources }),
        default: block.default,
        groups: Object.freeze({ ...groups }),
    });
}

/**
 * ⛓ **WHAT COUNTS AS AN ENTRY, PER LAYER** — `[{ key, src }]`. `src` is the
 * entry's own field, or undefined. A layer this table does not know has no
 * entries (its block is still checked).
 *
 *   structure  `entries`                      concepts  `concepts`
 *   text       `strings` and `lists` (plain values: a per-entry source is a group whose prefix is the key)
 *   numbers    `sets` (one entry per set)     bindings  every `<game>/<key>` of `bindings`
 *   art        `sprites` and `shapes`         sfx       `sounds`        music  `tracks`
 */
export function layerEntries(layer, json) {
    const keyed = (table) => Object.entries(isObject(table) ? table : {})
        .map(([key, v]) => ({ key, src: isObject(v) ? v.src : undefined }));
    switch (layer) {
        case 'structure': return keyed(json?.entries);
        case 'concepts': return keyed(json?.concepts);
        case 'text': return [...keyed(json?.strings), ...keyed(json?.lists)];
        case 'numbers': return keyed(json?.sets);
        case 'bindings': return Object.entries(isObject(json?.bindings) ? json.bindings : {})
            .flatMap(([game, table]) => keyed(table).map((e) => ({ ...e, key: `${game}/${e.key}` })));
        case 'art': return [...keyed(json?.sprites), ...keyed(json?.shapes)];
        case 'sfx': return keyed(json?.sounds);
        case 'music': return keyed(json?.tracks);
        default: return [];
    }
}

/** The source id `key` resolves to under `block` (a parsed block): `src` → the longest group prefix → `default`. */
export function resolveSource(block, key, src = undefined) {
    if (src !== undefined) return src;
    let best = null;
    for (const prefix of Object.keys(block.groups)) {
        if (key.startsWith(prefix) && (best === null || prefix.length > best.length)) best = prefix;
    }
    return best === null ? block.default : block.groups[best];
}

/**
 * ⛓⛓ **THE LOADER CHECK** (Z6 check 1): the block is present and well formed,
 * and every entry of the layer resolves to a listed source. Returns
 * `{ block, sourceOf: Map<key, source id> }`; refuses by pack, layer and key.
 */
export function checkLayerProvenance(packId, layer, json) {
    const block = parseProvenance(json?.provenance, packId, layer);
    const sourceOf = new Map();
    for (const { key, src } of layerEntries(layer, json)) {
        if (src !== undefined && !isText(src)) refuse(packId, layer, `src ${JSON.stringify(src)} is not a source id`, key);
        if (src !== undefined && !Object.prototype.hasOwnProperty.call(block.sources, src)) {
            refuse(packId, layer, `src "${src}" is not a listed source (${Object.keys(block.sources).join(', ')})`, key);
        }
        sourceOf.set(key, resolveSource(block, key, src));
    }
    return Object.freeze({ block, sourceOf });
}

/**
 * The count of entries per source, per layer, of one LOADED pack (`loadPackStack`'s row):
 * `{ [layer]: { [source id]: n } }`, every listed source present (a source no entry resolves to counts 0).
 */
export function provenanceCounts(loaded) {
    const out = {};
    for (const [layer, json] of Object.entries(loaded.layers ?? {})) {
        const { block, sourceOf } = checkLayerProvenance(loaded.id, layer, json);
        const counts = Object.fromEntries(Object.keys(block.sources).map((id) => [id, 0]));
        for (const id of sourceOf.values()) counts[id] += 1;
        out[layer] = counts;
    }
    return out;
}
