/**
 * procgenPipeline/worldContent — **A WORLD NAMES ITS CONTENT STACK** (⛓ CONTENT
 * SETS C3, ⚖ the user 2026-11-10: Q4 and Q8).
 *
 * Q4: a world selects a `content` stack per player, recorded in its slot's
 * `procgen_metadata` block beside `concepts`. The default is each substrate's
 * own pack, so every existing world compiles byte-equal.
 * Q8: text, names and colours resolve at GENERATION and are written into the
 * world document. So the stack is loaded once, BEFORE generation, and handed to
 * the synchronous placers as data.
 *
 * The channel, end to end:
 *
 *   params.content            the pack ids the world names (default `[]`), beside
 *                             `params.concepts` and validated like it
 *   effectiveContentStack     ONE rule: the `defaultContentPack` of each substrate
 *                             in the world's mix, in registry order, without
 *                             duplicates, then `params.content` in order
 *   loadContentSet            async: the stack → a frozen CONTENT SET
 *                             `{ ids, concepts, text }` (`packConcepts`,
 *                             `textLibrary`), after `assertPresents`
 *   regionParams.contentSet   the loaded set, on the channel `params.concepts`
 *                             uses (`sphereConfigHooks.assembleRegionParams`), so
 *                             each region's `generateRegionCore` / `placeFromRules`
 *                             receives it as `params.contentSet`
 *   regionParams.content      the world's own list, which the drivers record as
 *                             `procgen_metadata[p].content` (`recordedContentOf`)
 *                             and `rebuildEnvelopeFromRulesJson` reads back
 *
 * ⛔ BYTE-EQUALITY. An EMPTY stack (no `params.content`, no substrate in the mix
 * declaring a default pack) loads nothing — `readJson` is never called — and
 * adds NO key to `regionParams`, the envelope or the document.
 *
 * ⛔ THE SET IS RUNTIME STATE, NOT DOCUMENT STATE. Its readers are functions.
 * `JSON.stringify` omits it (a non-enumerable `toJSON` answering `undefined`),
 * so a saved envelope keeps `regionParams.content` and drops `contentSet`; a
 * resumed or rebuilt envelope re-attaches it (`attachContentSet`) before it
 * generates. A placer that needs a set that was never loaded is refused by name
 * (`assertContentLoaded`, called at the engine's region seam), so a generation
 * entry point that forgot to load cannot silently build a world without its
 * content.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { loadPackStack, packsBaseUrl, parseRegistry, PACK_ID_PATTERN } from '../contentPacks/contentPacks.js';
import { numbersSelectionRefusal } from '../packStructure/packNumbers.js';
import { createStructure } from '../packStructure/packStructure.js';
import { createPackConcepts } from '../packConcepts/packConcepts.js';
import { createTextLibrary } from '../textLibrary/textLibrary.js';
import { assertPresents } from '../procgenCore/contentRoles.js';
import { CONCEPTS } from '../procgenCore/concepts.js';

/** The params key, the regionParams key and the `procgen_metadata[p]` key for the world's own list. */
export const RECORDED_CONTENT_KEY = 'content';
/**
 * ⛓ CONTENT SETS PL-1 (Z.5, ⚖ the user 2026-11-15) — the two new world settings, keyed the same way in
 * `params`, `regionParams` and `procgen_metadata[p]` (⚠ a PER-PLAYER map), beside `content`:
 *   `exists`  — WHAT EXISTS: a list of pack ids whose `structure` entries (and matching bindings) are added
 *               together. Default: the `defaultContentPack` of each substrate in the mix.
 *   `numbers` — THE NUMBERS: a stack of pack ids, later wins per value path. Default: each `exists` pack's own
 *               set for the substrate, when it has one. A pack with no set for the world's substrate over the
 *               world's `exists` is refused by name (`numbersSelectionRefusal`).
 * Each is recorded only when it is not the default, so every existing world compiles byte-equal. ⛔ Nothing reads
 * them to build a region yet: the resolver (Z.5, Z.6) is the next slice. ⛔ The words never read them either:
 * `CONTENT_LAYERS` is `concepts` and `text`.
 */
export const RECORDED_EXISTS_KEY = 'exists';
export const RECORDED_NUMBERS_KEY = 'numbers';
/** The two pack-LIST settings' keys, in the order a metadata block records them (after `content`). */
export const WORLD_SETTING_KEYS = Object.freeze([RECORDED_EXISTS_KEY, RECORDED_NUMBERS_KEY]);
/**
 * ⛓ PL-1 (Z8, ⚖ the user 2026-11-15: "I agree with this plan.") — THE NUMBERS SWITCH, beside `numbers`:
 *   `assign` — assign by playthrough: the table's values are starting points, a substrate's walk assigns over them;
 *   `table`  — use the table as written: nothing is reassigned (a missing number is filled by rule and listed).
 * ⛔ STABLE MEANING (the planner's reading of Z8, 2026-11-15): an ABSENT `numbersMode` in a document ALWAYS
 * means `table`, so no existing world changes meaning when a later slice declares a walk. `assign` is therefore
 * RECORDED whenever a world is generated in that mode, and nothing is recorded for `table`. A NEW world's mode is
 * its own `params.numbersMode`, else the generation default: `assign` when every substrate in its mix declares a
 * walk (its registry entry's `numbersWalk: true`), else `table`. ⛔ No entry declares one in this slice (the walk
 * over a numbers table is PL-2's), so nothing is written and every world stays byte-equal. An unknown value is
 * refused by name.
 */
export const RECORDED_NUMBERS_MODE_KEY = 'numbersMode';
export const NUMBERS_MODES = Object.freeze(['assign', 'table']);
/** The registry-entry field that says a substrate has a playthrough walk that assigns numbers (Z8). */
export const NUMBERS_WALK_FIELD = 'numbersWalk';
/** The regionParams key the loaded set rides on (runtime only: never serialised). */
export const CONTENT_SET_KEY = 'contentSet';
/** The registry-entry field naming a substrate's built-in pack. */
export const DEFAULT_CONTENT_PACK_FIELD = 'defaultContentPack';
/** The layers a content set reads; a pack's other layers (art, sound) are not fetched. */
export const CONTENT_LAYERS = Object.freeze(['concepts', 'text']);

export class WorldContentError extends Error {
    constructor(message) {
        super(`world content: ${message}`);
        this.name = 'WorldContentError';
    }
}

/**
 * A refusal sentence for a `params.<name>` pack list (`content`, `exists`, `numbers`), or null when it is a list of
 * distinct pack ids (absent = null too).
 */
export function packListRefusal(name, list) {
    if (list === undefined || list === null) return null;
    if (!Array.isArray(list)) return `params.${name} is not a list (${JSON.stringify(list)})`;
    const seen = new Set();
    for (const id of list) {
        if (typeof id !== 'string' || !PACK_ID_PATTERN.test(id)) {
            return `params.${name} names ${JSON.stringify(id)}, which is not a pack id (${PACK_ID_PATTERN})`;
        }
        if (seen.has(id)) return `params.${name} names "${id}" twice`;
        seen.add(id);
    }
    return null;
}

/** A refusal sentence for a `params.content` value, or null when it is a list of distinct pack ids. */
export function contentParamRefusal(list) {
    return packListRefusal(RECORDED_CONTENT_KEY, list);
}

/**
 * A command line's `--param content=<ids>` (a string: `--param` gives strings and numbers) → the list
 * (comma-separated, trimmed, empties dropped). A list, or anything else, comes back as it is, for
 * `assertContentParam` to judge.
 */
export function contentListOf(value) {
    if (typeof value !== 'string') return value;
    return value.split(',').map((id) => id.trim()).filter(Boolean);
}

/** Throws `WorldContentError` on a malformed `params.content`; returns the list (`[]` when absent). */
export function assertContentParam(list) {
    const refusal = contentParamRefusal(list);
    if (refusal) throw new WorldContentError(refusal);
    return list ?? [];
}

/** A registry entry's default pack id, or null. A malformed value is refused by name. */
export function defaultContentPackOf(entry) {
    const id = entry?.[DEFAULT_CONTENT_PACK_FIELD];
    if (id === undefined || id === null) return null;
    if (typeof id !== 'string' || !PACK_ID_PATTERN.test(id)) {
        throw new WorldContentError(`entry "${entry?.id}"'s ${DEFAULT_CONTENT_PACK_FIELD} `
            + `${JSON.stringify(id)} is not a pack id (${PACK_ID_PATTERN})`);
    }
    return id;
}

/**
 * ⛓ **THE WORLD'S EFFECTIVE STACK — THE ONE RULE.** The `defaultContentPack` of
 * each substrate in `substrateIds` (the world's mix; any order, repeats allowed),
 * taken in REGISTRY order (`substrateRegistry.getAll()`: by id), without
 * duplicates; then `exists` (the world's what-exists packs, ⛓ PL-2); then
 * `content` (the world's `params.content`) in its own order. A pack an earlier
 * part already named keeps its first position: the stack is an override order,
 * and one pack can only sit at one place in it.
 *
 * ⛓ CONTENT SETS PL-2 — Z.5's words default: "the `exists` packs' own concepts
 * and text underneath, then the named themes". `exists` absent (every world on
 * main records none) is the mix's defaults, which the first part already holds,
 * so the stack is exactly the C3 rule's. A world naming non-default packs gets
 * them UNDER its themes and over the substrates' own packs (a region still
 * finds its default pack in the set: `assertContentLoaded`).
 *
 * `registry` is injectable for tests; an id it does not hold contributes nothing.
 */
export function effectiveContentStack({ substrateIds = [], exists = [], content = [], registry = substrateRegistry } = {}) {
    const own = assertContentParam(content);
    const named = assertPackListParam(RECORDED_EXISTS_KEY, exists);
    const out = defaultPacksOfMix(substrateIds, registry);
    for (const id of named) if (!out.includes(id)) out.push(id);
    for (const id of own) if (!out.includes(id)) out.push(id);
    return out;
}

/** The `defaultContentPack` of each substrate in the mix, in registry order, once each. */
function defaultPacksOfMix(substrateIds, registry) {
    const inMix = new Set(substrateIds);
    const out = [];
    for (const entry of registry.getAll()) {
        if (!inMix.has(entry.id)) continue;
        const id = defaultContentPackOf(entry);
        if (id && !out.includes(id)) out.push(id);
    }
    return out;
}

const setBrand = new WeakSet();

function freezeContentSet(ids, concepts, text, structure = null, structureIds = []) {
    // ⛓ GEN-1 — `structure`: the LOGIC layer of the world's "what exists" packs only (`structureIds`), never a theme's
    //   (⚖ Robert 2026-11-22, Q4; Z.1). Null when the world names none: the words setting never reads it.
    const set = { ids: Object.freeze([...ids]), concepts, text, structure, structureIds: Object.freeze([...structureIds]) };
    // A saved envelope drops the set (its readers are functions) and keeps the ids it came from.
    Object.defineProperty(set, 'toJSON', { value: () => undefined, enumerable: false });
    Object.freeze(set);
    setBrand.add(set);
    return set;
}

/** The content set of an empty stack: no concepts, no text. Shared and frozen. */
export const EMPTY_CONTENT_SET = freezeContentSet([], createPackConcepts([]), createTextLibrary([]));

/** True for a set `loadContentSet` built (or `EMPTY_CONTENT_SET`). */
export function isContentSet(value) {
    return value !== null && typeof value === 'object' && setBrand.has(value);
}

/**
 * The browser's `{ base, readJson }`: `fetch` over `packsBaseUrl()` (the
 * committed `frontend/packs/`, or `packs/` beside a bundled page). Node callers
 * pass `contentPacks/nodePackIo.js`'s `nodePackIo()` instead.
 */
export function browserPackIo({ win = globalThis, base = packsBaseUrl() } = {}) {
    return {
        base,
        readJson: async (url) => {
            const r = await win.fetch(url, { cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        },
    };
}

/**
 * ⛓ **LOAD THE STACK, ONCE, BEFORE GENERATION.** `stack` is an effective stack
 * (`effectiveContentStack`); `io` is `{ base, readJson }` (default
 * `browserPackIo()`). Returns a frozen content set
 * `{ ids, concepts: createPackConcepts(loaded), text: createTextLibrary(loaded) }`,
 * after `assertPresents` holds every pack concept's `presents` to `concepts`
 * (the mechanic concept table).
 *
 * ⛔ An EMPTY stack returns `EMPTY_CONTENT_SET` without calling `readJson`.
 * A pack that cannot be read or parsed is refused by name (`ContentPackError`).
 */
export async function loadContentSet(stack, { base, readJson, concepts = CONCEPTS, exists = [] } = {}) {
    const ids = assertContentParam(stack);
    if (!ids.length) return EMPTY_CONTENT_SET;
    const io = readJson ? { base, readJson } : browserPackIo(base ? { base } : {});
    const loaded = await loadPackStack(ids, { ...io, only: CONTENT_LAYERS });
    const packConcepts = createPackConcepts(loaded);
    assertPresents(packConcepts, concepts);
    // ⛓ GEN-1 — the `structure` layer of the packs the world NAMES under `exists` (and only those): the tile kinds
    //   the generator may place (`mazeRoom/mazeTileKindsGen.js`). Names none ⇒ nothing more is read.
    const structureIds = assertPackListParam(RECORDED_EXISTS_KEY, exists).filter((id) => ids.includes(id));
    const structure = structureIds.length
        ? createStructure(await loadPackStack(structureIds, { ...io, only: ['structure'] })) : null;
    return freezeContentSet(ids, packConcepts, createTextLibrary(loaded), structure, structureIds);
}

/**
 * The regionParams keys the world's content adds: `content` (its own list) when
 * `params.content` is non-empty, `contentSet` when the set is non-empty. `{}`
 * otherwise — so a world that names no content takes no new key.
 *
 * ⛔ A non-empty effective stack (for `substrateIds`) with no loaded set holding
 * it is REFUSED by name: the entry point did not await `loadContentSet`.
 * ⛓ C4 — except a stack made only of DEFAULT packs with no set handed in
 * (`contentSet` null): that set is built from the preload cache
 * (`defaultContentSetOf`), so a synchronous builder needs no load of its own.
 * ⛓ C4 — `contentSet: DEFER_CONTENT_SET` composes arguments for a job that
 * attaches its set where it RUNS (the APWorld editor's worker): the world's own
 * list only, no set, no refusal.
 */
export function contentRegionParams({ params, contentSet = null, substrateIds = [] }) {
    const own = assertContentParam(params?.content);
    const exists = assertPackListParam(RECORDED_EXISTS_KEY, params?.[RECORDED_EXISTS_KEY]);
    const stack = effectiveContentStack({ substrateIds, exists, content: own });
    if (!stack.length) return {};
    // ⛓ C4 — a stack of DEFAULT packs only, with no set handed in: built from the preload cache
    //   (refused by name when a pack was not preloaded). A stack naming `params.content` still
    //   needs the awaited load.
    if (contentSet === DEFER_CONTENT_SET) return own.length ? { [RECORDED_CONTENT_KEY]: [...own] } : {};
    if (contentSet === null && !own.length && !exists.length) contentSet = defaultContentSetOf(stack);
    if (!isContentSet(contentSet) || stack.some((id) => !contentSet.ids.includes(id))) {
        throw new WorldContentError(`the world's content stack [${stack.join(', ')}] was not loaded `
            + `(the set given holds [${isContentSet(contentSet) ? contentSet.ids.join(', ') : 'nothing'}]): `
            + 'a generation entry point awaits loadContentSet before it builds the run');
    }
    return {
        ...(own.length ? { [RECORDED_CONTENT_KEY]: [...own] } : {}),
        [CONTENT_SET_KEY]: contentSet,
    };
}

/**
 * ⛓ The engine's region seam: the packs a region of `substrateId` needs (its
 * entry's default pack, then the world's own `params.content`) must be in
 * `params.contentSet`. Returns the params the region is built with: `params`
 * ITSELF when nothing is needed or the set is there.
 *
 * ⛓ C4 — a region that needs only its entry's DEFAULT pack and was handed no set
 * (a synchronous caller that never assembled one: the APWorld editor's
 * regenerate, a worker's job) gets `{ ...params, contentSet }` built from the
 * preload cache; a default pack that was not preloaded is refused by name.
 */
export function assertContentLoaded(params, substrateId, registry = substrateRegistry) {
    const needed = [];
    const own = defaultContentPackOf(registry.get(substrateId));
    if (own) needed.push(own);
    // ⛓ PL-2 — the world's own what-exists packs sit under its themes in the words stack (recorded only when not
    //   the default, so a world on main names none).
    const existsNamed = params?.[RECORDED_EXISTS_KEY] ?? [];
    const named = params?.[RECORDED_CONTENT_KEY] ?? [];
    for (const id of [...existsNamed, ...named]) if (!needed.includes(id)) needed.push(id);
    if (!needed.length) return params;
    const set = params?.[CONTENT_SET_KEY];
    if ((set === undefined || set === null) && !named.length && !existsNamed.length) {
        return { ...(params ?? {}), [CONTENT_SET_KEY]: defaultContentSetOf(needed) };
    }
    const missing = needed.filter((id) => !isContentSet(set) || !set.ids.includes(id));
    if (missing.length) {
        throw new WorldContentError(`a "${substrateId}" region needs the content pack(s) [${missing.join(', ')}], `
            + 'and no loaded content set holds them: the envelope was resumed or rebuilt without '
            + 'attachContentSet, or its entry point never called loadContentSet');
    }
    return params;
}

/**
 * `{content: [...]}` for the metadata block when the world names its own content, else `{}`.
 * ⛓ CONTENT SETS PL-1 — and `exists` / `numbers` (the two new settings, Z.5) the same way, each only when the
 * world's regionParams carry it (`worldSettingsRegionParams` writes them only when not the default). Key order:
 * `content`, `exists`, `numbers`.
 */
export function recordedContentOf(regionParams) {
    const out = {};
    for (const key of [RECORDED_CONTENT_KEY, ...WORLD_SETTING_KEYS]) {
        const list = regionParams?.[key];
        if (Array.isArray(list) && list.length) out[key] = [...list];
    }
    // ⛓ Z8 — the switch, when the regionParams carry it (only when it is not the world's default).
    if (NUMBERS_MODES.includes(regionParams?.[RECORDED_NUMBERS_MODE_KEY])) out[RECORDED_NUMBERS_MODE_KEY] = regionParams[RECORDED_NUMBERS_MODE_KEY];
    // ⛓ CONTENT SETS GEN-1 — a substrate's own world settings, named by its entry's `recordedRegionParams` (the maze's
    //   biome and tile numbers), when the regionParams carry them: its `buildRegionParams` adds a key only when it is
    //   not the default, so a world that sets none records nothing.
    for (const key of recordedRegionParamKeys()) {
        if (regionParams?.[key] !== undefined && !(key in out)) out[key] = JSON.parse(JSON.stringify(regionParams[key]));
    }
    return out;
}

/** ⛓ GEN-1 — the regionParams keys the registered substrates ask the drivers to record, in registry order, once each. */
export function recordedRegionParamKeys(registry = substrateRegistry) {
    const keys = [];
    for (const entry of registry.getAll()) for (const k of entry.recordedRegionParams ?? []) if (!keys.includes(k)) keys.push(k);
    return keys;
}

/**
 * ⛓ **RE-ATTACH THE SET TO A RESUMED OR REBUILT ENVELOPE.** `regionParams` holds
 * the world's own `content` (recorded, or carried by a saved envelope);
 * `substrateIds` the substrates in its mix. Loads the effective stack and returns
 * `regionParams` with `contentSet` set — or `regionParams` ITSELF, untouched,
 * when the stack is empty (no load, no new key).
 */
export async function attachContentSet(regionParams, { substrateIds = [], ...io } = {}) {
    const stack = effectiveContentStack({
        substrateIds, exists: regionParams?.[RECORDED_EXISTS_KEY] ?? [], content: regionParams?.[RECORDED_CONTENT_KEY] ?? [],
    });
    if (!stack.length) return regionParams;
    const contentSet = await loadContentSet(stack, { ...io, exists: regionParams?.[RECORDED_EXISTS_KEY] ?? [] });
    return { ...(regionParams ?? {}), [CONTENT_SET_KEY]: contentSet };
}

/**
 * The substrates a live envelope's regions use: its nodes' (sphere growth,
 * rebuilt or resumed), its quota / mix keys with a positive value, and its start
 * substrate. The `substrateIds` an envelope's `attachContentSet` takes.
 */
export function envelopeSubstrateIds(env) {
    const ids = new Set();
    for (const n of env?.nodes ?? []) if (n?.substrate) ids.add(n.substrate);
    const c = env?.config ?? {};
    for (const dict of [c.substrateQuotas, c.growthParams?.substrateQuotas, c.growthParams?.substrateMix,
        c.substrateMix, env?.opts?.substrateQuotas, env?.opts?.substrateMix]) {
        for (const [id, n] of Object.entries(dict ?? {})) if (Number(n) > 0) ids.add(id);
    }
    if (c.startSubstrate) ids.add(c.startSubstrate);
    return [...ids];
}

/**
 * ⛓ **A RESUMED OR REBUILT ENVELOPE, READY TO GENERATE.** Loads the envelope's
 * effective stack (its `regionParams.content` over `envelopeSubstrateIds`) and
 * sets the set on its `regionParams` IN PLACE (`env.config.regionParams`; the
 * rebuild aliases it as `env.opts.regionParams`, and the panel's `growConfig`
 * holds it too, so every alias sees the set). An empty stack, or a set already
 * holding the stack, leaves the envelope untouched (no read, no new key).
 * Returns `env`. The append path's entry points (the panel's append,
 * `sphere-step append`) await this between `rebuildEnvelopeFromRulesJson` and
 * `appendSphere`.
 */
export async function attachEnvelopeContent(env, io = {}) {
    const holders = [env?.config, env?.opts].filter((h) => h && typeof h === 'object');
    const regionParams = holders.find((h) => h.regionParams)?.regionParams;
    const stack = effectiveContentStack({
        substrateIds: envelopeSubstrateIds(env), content: regionParams?.[RECORDED_CONTENT_KEY] ?? [],
    });
    if (!stack.length) return env;
    const held = regionParams?.[CONTENT_SET_KEY];
    if (isContentSet(held) && stack.every((id) => held.ids.includes(id))) return env;
    const contentSet = await loadContentSet(stack, io);
    if (regionParams) regionParams[CONTENT_SET_KEY] = contentSet;
    else env.config.regionParams = { [CONTENT_SET_KEY]: contentSet };
    return env;
}

/* ── ⛓⛓ CONTENT SETS R3 — what a world may pick ───────────────────────── */

/**
 * ⛓ **THE PACKS A WORLD MAY ADD TO ITS STACK** (the pipeline panel's content
 * picker): every pack a stack of `packs.json`'s `content` table names, in the
 * order the table first names it, LESS every pack a registry entry declares as
 * its default (a default pack is in every world's stack already, so it is never
 * offered). `[{ id, title }]`; `registryJson` is `packs.json` as read, validated
 * here (`parseRegistry`, refused by name).
 */
export function selectableContentPacks(registryJson, registry = substrateRegistry) {
    const { contentStacks } = parseRegistry(registryJson);
    const defaults = new Set(declaredDefaultContentPacks(registry));
    const titles = new Map(registryJson.packs.map((p) => [p.id, p.title ?? p.id]));
    const out = [];
    for (const stack of Object.values(contentStacks)) {
        for (const id of stack) {
            if (!defaults.has(id) && !out.some((o) => o.id === id)) out.push(Object.freeze({ id, title: titles.get(id) }));
        }
    }
    return Object.freeze(out);
}

/** `selectableContentPacks` over `packs.json` read through `io` (`{ base, readJson }`; the browser's by default). */
export async function loadSelectableContentPacks(io = browserPackIo(), registry = substrateRegistry) {
    const { base, readJson } = io.readJson ? io : browserPackIo();
    return selectableContentPacks(await readJson(new URL('packs.json', base).href), registry);
}

/**
 * ⛓ **A PICK, AS THE WORLD'S `content` LIST.** `picked` is the set of ticked
 * ids; the list is in `choices` order (the order the picker shows, which is the
 * stack order after the defaults: a later pack wins per key). An id in
 * `current` that the picker does not offer (a saved world naming a pack this
 * page does not list) is kept, in front, so a pick never drops it silently.
 */
export function pickedContentList(choices, picked, current = []) {
    const offered = choices.map((c) => c.id);
    const kept = (Array.isArray(current) ? current : []).filter((id) => !offered.includes(id));
    return [...kept, ...offered.filter((id) => picked.has(id))];
}

/* ── ⛓⛓ CONTENT SETS PL-1 — what exists, and the numbers (Z.5) ─────────── */

/** Throws `WorldContentError` on a malformed `params.<name>` pack list; returns the list (`[]` when absent). */
export function assertPackListParam(name, list) {
    const refusal = packListRefusal(name, list);
    if (refusal) throw new WorldContentError(refusal);
    return list ?? [];
}

/**
 * The DEFAULT of `exists` for a mix: the `defaultContentPack` of each substrate in `substrateIds`, in registry
 * order, once each (the packs `effectiveContentStack` puts first).
 */
export function defaultExistsOf({ substrateIds = [], registry = substrateRegistry } = {}) {
    return defaultPacksOfMix(substrateIds, registry);
}

/** A refusal sentence for a `numbersMode` value, or null when it is absent or one of `NUMBERS_MODES`. */
export function numbersModeRefusal(mode, where = 'params') {
    if (mode === undefined || mode === null) return null;
    return NUMBERS_MODES.includes(mode) ? null
        : `${where}.${RECORDED_NUMBERS_MODE_KEY} ${JSON.stringify(mode)} is not one of ${NUMBERS_MODES.join(', ')}`;
}

/** Throws `WorldContentError` on an unknown `numbersMode`; returns it (or null when absent). */
export function assertNumbersMode(mode, where = 'params') {
    const refusal = numbersModeRefusal(mode, where);
    if (refusal) throw new WorldContentError(refusal);
    return mode ?? null;
}

/** The mode a document that records no `numbersMode` is in: always `table` (stable meaning). */
export const ABSENT_NUMBERS_MODE = 'table';

/**
 * ⛓ Z8 — **THE SWITCH'S DEFAULT FOR A NEW WORLD OF A MIX** (generation only; a document's absent key is
 * `ABSENT_NUMBERS_MODE`): `assign` when the mix is non-empty and every substrate in it declares a walk
 * (`numbersWalk: true` on its registry entry), else `table`. A malformed declaration is refused by name.
 */
export function defaultNumbersModeOf({ substrateIds = [], registry = substrateRegistry } = {}) {
    const entries = [...new Set(substrateIds)].map((id) => registry.get(id)).filter(Boolean);
    for (const e of entries) {
        const v = e[NUMBERS_WALK_FIELD];
        if (v !== undefined && typeof v !== 'boolean') {
            throw new WorldContentError(`entry "${e.id}"'s ${NUMBERS_WALK_FIELD} ${JSON.stringify(v)} is not true or false`);
        }
    }
    return entries.length && entries.every((e) => e[NUMBERS_WALK_FIELD] === true) ? 'assign' : 'table';
}

/** A NEW world's numbers switch: its own `params.numbersMode`, else the generation default of its mix. */
export function generationNumbersMode({ substrateIds = [], numbersMode = null, registry = substrateRegistry } = {}) {
    return assertNumbersMode(numbersMode) ?? defaultNumbersModeOf({ substrateIds, registry });
}

/** A DOCUMENT's numbers switch for player `p`: the recorded one, else `table` (an absent key always means table). */
export function documentNumbersModeOf(doc, player) {
    return assertNumbersMode(doc?.procgen_metadata?.[String(player)]?.[RECORDED_NUMBERS_MODE_KEY], 'procgen_metadata')
        ?? ABSENT_NUMBERS_MODE;
}

/**
 * ⛓ **THE SETTINGS' REGIONPARAMS KEYS** — `{ exists?, numbers?, numbersMode? }`, each only when it is not the
 * default: `exists` when `params.exists` names packs and they are not exactly the mix's defaults
 * (`defaultExistsOf`, in order); `numbers` when `params.numbers` names packs; `numbersMode` (Z8) when the new
 * world's mode (`generationNumbersMode`) is `assign` — `table` is what an absent key means, so it is never written.
 * `{}` otherwise, so a world that names none takes no key. A malformed list or an unknown mode is refused by name.
 */
export function worldSettingsRegionParams({ params, substrateIds = [], registry = substrateRegistry } = {}) {
    const exists = assertPackListParam(RECORDED_EXISTS_KEY, params?.[RECORDED_EXISTS_KEY]);
    const numbers = assertPackListParam(RECORDED_NUMBERS_KEY, params?.[RECORDED_NUMBERS_KEY]);
    const mode = generationNumbersMode({ substrateIds, numbersMode: params?.[RECORDED_NUMBERS_MODE_KEY], registry });
    const defaults = defaultExistsOf({ substrateIds, registry });
    const isDefault = exists.length === defaults.length && exists.every((id, i) => id === defaults[i]);
    const modeDiffers = mode !== ABSENT_NUMBERS_MODE;
    return {
        ...(exists.length && !isDefault ? { [RECORDED_EXISTS_KEY]: [...exists] } : {}),
        ...(numbers.length ? { [RECORDED_NUMBERS_KEY]: [...numbers] } : {}),
        ...(modeDiffers ? { [RECORDED_NUMBERS_MODE_KEY]: mode } : {}),
    };
}

/** The world's `exists` list: its own, or the mix's defaults. */
export function effectiveExists({ substrateIds = [], exists = [], registry = substrateRegistry } = {}) {
    const own = assertPackListParam(RECORDED_EXISTS_KEY, exists);
    return own.length ? [...own] : defaultExistsOf({ substrateIds, registry });
}

/**
 * ⛓ **A NUMBERS STACK, CHECKED AGAINST THE WORLD** (Z.5): every pack `params.numbers` names is loaded (its
 * `numbers` layer only) and must hold a set whose key is one of `substrateIds` and whose `exists` is in the
 * world's `exists` (its own, or the defaults). The first pack that does not is refused by name. An empty
 * `params.numbers` reads nothing. Returns the loaded numbers stack (`[]` when none is named).
 */
export async function assertWorldNumbers(params, { substrateIds = [], registry = substrateRegistry, base, readJson } = {}) {
    const numbers = assertPackListParam(RECORDED_NUMBERS_KEY, params?.[RECORDED_NUMBERS_KEY]);
    if (!numbers.length) return [];
    const exists = effectiveExists({ substrateIds, exists: params?.[RECORDED_EXISTS_KEY] ?? [], registry });
    const io = readJson ? { base, readJson } : browserPackIo(base ? { base } : {});
    const loaded = await loadPackStack(numbers, { ...io, only: ['numbers'] });
    for (const pack of loaded) {
        const refusal = numbersSelectionRefusal(pack, { substrateIds, exists });
        if (refusal) throw new WorldContentError(refusal);
    }
    return loaded;
}

/**
 * The settings a metadata block (`procgen_metadata[p]`) records, validated by name, as regionParams keys:
 * `{ exists?, numbers?, numbersMode? }` (absent when not recorded). The rebuild's read-back (`rebuildRegionParams`).
 */
export function recordedWorldSettingsOf(meta) {
    const out = {};
    for (const key of WORLD_SETTING_KEYS) {
        const list = assertPackListParam(key, meta?.[key]);
        if (list.length) out[key] = [...list];
    }
    const mode = assertNumbersMode(meta?.[RECORDED_NUMBERS_MODE_KEY], 'procgen_metadata');
    if (mode !== null) out[RECORDED_NUMBERS_MODE_KEY] = mode;
    return out;
}

/**
 * The settings a document records for player `p` (`procgen_metadata[p].exists` / `.numbers` / `.numbersMode`,
 * ⚠ a PER-PLAYER map), validated: `{ exists: [...], numbers: [...], numbersMode }`, the lists `[]` and the mode
 * null when the document records none.
 */
export function documentWorldSettingsOf(doc, player) {
    const meta = doc?.procgen_metadata?.[String(player)];
    return {
        [RECORDED_EXISTS_KEY]: [...assertPackListParam(RECORDED_EXISTS_KEY, meta?.[RECORDED_EXISTS_KEY])],
        [RECORDED_NUMBERS_KEY]: [...assertPackListParam(RECORDED_NUMBERS_KEY, meta?.[RECORDED_NUMBERS_KEY])],
        // ⛓ Z8 — the RECORDED switch, or null (absent always means `table`: `documentNumbersModeOf`).
        [RECORDED_NUMBERS_MODE_KEY]: assertNumbersMode(meta?.[RECORDED_NUMBERS_MODE_KEY], 'procgen_metadata'),
    };
}

/* ── ⛓⛓ CONTENT SETS C4 — the process-level cache of DEFAULT packs ─────── */

/** Loaded default packs by id (the `loadPackStack` row: `{ id, pack, base, layers }`). */
const defaultPackCache = new Map();
/** The load in flight per id, so two concurrent preloads read each pack once. */
const defaultPackPending = new Map();
/** Content sets built from the cache, by stack (so one stack is one set object). */
const cachedDefaultSets = new Map();
/** How many times this process has awaited `preloadDefaultContent` (how a caller proves it was reached). */
let preloadCalls = 0;

/**
 * The default packs the registry's entries declare (`defaultContentPack`), in
 * registry order, once each — what `preloadDefaultContent` loads.
 */
export function declaredDefaultContentPacks(registry = substrateRegistry) {
    const out = [];
    for (const entry of registry.getAll()) {
        const id = defaultContentPackOf(entry);
        if (id && !out.includes(id)) out.push(id);
    }
    return out;
}

/** How many `preloadDefaultContent` calls this process has completed (a boot, a setup file, a script's). */
export function defaultContentPreloadCalls() {
    return preloadCalls;
}

/** The default packs this process has preloaded, in the order they finished loading. */
export function preloadedDefaultContentPacks() {
    return Object.freeze([...defaultPackCache.keys()]);
}

/**
 * ⛓⛓ **PRELOAD THE DEFAULT PACKS, ONCE PER PROCESS.** Loads the `concepts` and
 * `text` layers (`CONTENT_LAYERS`) of every default pack `registry`'s entries
 * declare and keeps them, so a SYNCHRONOUS builder (`buildRunFromState`, the
 * APWorld editor's regenerate, a fixed-config check script) builds a world whose
 * stack is made only of default packs without a load of its own
 * (`contentRegionParams`, `assertContentLoaded`).
 *
 * Call it — awaited — at the start of a process that builds worlds
 * synchronously, AFTER its substrate libraries have registered (it reads the
 * registry as it stands). A pack already loaded is not read again, so a second
 * call is a no-op; a later call after more entries registered loads only the new
 * packs. With no entry declaring a default pack it calls `readJson` zero times.
 * Each pack's concepts are held to the mechanic table (`assertPresents`) as it
 * loads, so a bad pack is refused here, by name, not mid-generation.
 *
 * `{ base, readJson }` is the `loadContentSet` io (`browserPackIo()` when
 * `readJson` is absent; node passes `nodePackIo()`). Returns the preloaded ids.
 *
 * `ids` (optional) names the packs to preload INSTEAD of the registry's
 * declarations: a process that must preload before its substrates register (a
 * vitest setup file runs before the test file's imports) preloads every
 * committed pack (`packs.json`), a superset of any default pack.
 */
export async function preloadDefaultContent({
    base, readJson, registry = substrateRegistry, concepts = CONCEPTS, ids = null,
} = {}) {
    const named = ids === null ? declaredDefaultContentPacks(registry) : assertContentParam(ids);
    const wanted = named.filter((id) => !defaultPackCache.has(id));
    if (wanted.length) {
        const io = readJson ? { base, readJson } : browserPackIo(base ? { base } : {});
        // One pack at a time, in the order named, so the cache's order is deterministic; a load
        // another call already started is awaited, not repeated.
        for (const id of wanted) {
            if (!defaultPackPending.has(id)) {
                defaultPackPending.set(id, (async () => {
                    try {
                        const [loaded] = await loadPackStack([id], { ...io, only: CONTENT_LAYERS });
                        assertPresents(createPackConcepts([loaded]), concepts);
                        defaultPackCache.set(id, loaded);
                    } finally {
                        defaultPackPending.delete(id);
                    }
                })());
            }
            // eslint-disable-next-line no-await-in-loop
            await defaultPackPending.get(id);
        }
    }
    preloadCalls += 1;
    return preloadedDefaultContentPacks();
}

/** For tests: forget every preloaded pack and every set built from them. */
export function resetDefaultContentCache() {
    defaultPackCache.clear();
    defaultPackPending.clear();
    cachedDefaultSets.clear();
    preloadCalls = 0;
}

/**
 * ⛓ The content set of a stack of DEFAULT packs, built SYNCHRONOUSLY from the
 * preload cache. It equals `loadContentSet(stack)`'s (same `ids`, same reader
 * answers: the same loaded rows through the same readers), and one stack always
 * answers the same set object. A pack the cache does not hold is refused by
 * name, telling the caller to await `preloadDefaultContent` first.
 */
export function defaultContentSetOf(stack) {
    const ids = assertContentParam(stack);
    if (!ids.length) return EMPTY_CONTENT_SET;
    const key = ids.join('\u0000');
    const hit = cachedDefaultSets.get(key);
    if (hit) return hit;
    const missing = ids.filter((id) => !defaultPackCache.has(id));
    if (missing.length) {
        throw new WorldContentError(`the default content pack(s) [${missing.join(', ')}] were not preloaded `
            + `(preloaded: [${[...defaultPackCache.keys()].join(', ')}]): this process builds a world `
            + 'synchronously, so it must await preloadDefaultContent (after its substrate libraries register) '
            + 'before it builds');
    }
    const loaded = ids.map((id) => defaultPackCache.get(id));
    const packConcepts = createPackConcepts(loaded);
    assertPresents(packConcepts, CONCEPTS);
    const set = freezeContentSet(ids, packConcepts, createTextLibrary(loaded));
    cachedDefaultSets.set(key, set);
    return set;
}

/**
 * The `contentSet` that DEFERS the set: arguments composed here are posted to a
 * worker (whose `postMessage` cannot clone the set's readers) or recorded in an
 * op's `provenance`, and the job attaches the set where it runs.
 */
export const DEFER_CONTENT_SET = Object.freeze({ deferred: 'the job attaches its content set where it runs' });

/**
 * `regionParams` without its loaded set: `regionParams` ITSELF when it holds none.
 * For a SERIALIZED envelope (`steppedPipeline.serializeEnvelope`), which is
 * handed on in-process (`runPipeline`) and cloned there: the set is runtime
 * state, and `structuredClone` cannot copy its readers.
 */
export function withoutContentSet(regionParams) {
    if (!regionParams || typeof regionParams !== 'object' || !(CONTENT_SET_KEY in regionParams)) return regionParams;
    const { [CONTENT_SET_KEY]: _set, ...rest } = regionParams;
    return rest;
}

/**
 * The content list a document records for player `p` (`procgen_metadata[p].content`,
 * ⚠ a PER-PLAYER map), validated; `[]` when it names none.
 */
export function documentContentOf(doc, player) {
    return [...assertContentParam(doc?.procgen_metadata?.[String(player)]?.[RECORDED_CONTENT_KEY])];
}
