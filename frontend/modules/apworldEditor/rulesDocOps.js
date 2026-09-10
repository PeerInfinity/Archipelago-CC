/**
 * apworldEditor/rulesDocOps — **THE RULES DOCUMENT'S ATOMIC OPS** (EDITOR
 * INTEGRATION slice B-c; plan §3.1's APWorld row and §15.11's #4).
 *
 * ⛔ PURE, COPY-ON-WRITE, AND IT KNOWS NOTHING ABOUT A PANEL. Every op in
 * `RULES_OP_KINDS` takes a `rules.json` document and returns a NEW one sharing
 * every untouched sub-object, so `editCore.foldEdits` can walk a chain of them
 * and `undo` can re-fold a shorter list. Nothing here reads the DOM, the
 * session, the event bus or `stateManager`.
 *
 * ── ⛓ KEY ORDER IS CONTENT, AND THAT DECIDES HOW THINGS ARE COPIED ────
 *
 * `cloneFullRulesDoc`'s contract is that a procgen-generated world round-trips
 * its non-standard top-level keys (`procgen_metadata`, `loop_costs`,
 * `preset_sidecars`) untouched, and Apply publishes the document the exporter
 * reads. So `withKey(obj, k, v)` is `{...obj, [k]: v}` — an EXISTING key keeps
 * its position and a NEW one appends, which is exactly what `obj.k = v` did —
 * and a delete is a rest-destructure, which is what `delete obj.k` did. The
 * adapter's `equal` is `deepEqualKeyOrder`, so an op that only re-ordered keys
 * would be a real edit rather than a silently dropped one.
 *
 * ⚠ THE THREE RENAMES ARE THE EXCEPTION, and it is trap 861's, verbatim.
 * `renameRegionInRules` / `renameLocationInRules` / `renameItemInRules` walk
 * every rule tree and write THROUGH the document; re-spelling their walk as a
 * copy-on-write one would be a second implementation of `walkRuleTrees` whose
 * only job is to disagree with the first. So a rename op clones the document
 * with `JSON.parse(JSON.stringify(…))` — the only clone that keeps key order —
 * and runs the shipped cascade on the clone. The eight `rulesUtils.test.js`
 * rows keep the functions they already pin, untouched.
 *
 * ── ⛓⛓ WHERE THE REFUSAL SENTENCES COME FROM: `validateRules`, DERIVED ─
 *
 * `bounceLevelOps` quotes `validateLevel`'s sentences; the analogue here is
 * `validateRules`, and it is a REPORT rather than a throw — so a refusal
 * quotes the issue the validator ITSELF would raise about the document the op
 * would have produced, found by differencing the errors before and after.
 * ⛔ Nothing here re-spells one of those sentences: a copy would drift the day
 * the validator's wording moved, and the whole point of quoting is that a
 * person who has seen the message in the validation bar has seen it here.
 *
 * ⚠ The difference is only computed when a CHEAP STRUCTURAL PRE-CHECK says
 * there is a reference to break, so the common case costs no validation at all
 * and the fold does not walk the document twice per op.
 *
 * ── ⛓⛓ THE TWO CASCADES ARE `group`s, AND THE ATOMIC OP REFUSES ───────
 *
 * B-b's rule (§15.4): the atomic op REFUSES the state the cascade exists to
 * avoid, and a `…Ops(doc, id)` builder returns the FLAT list the caller wraps
 * in `group`, so one undo restores everything and a reader of `payload().edits`
 * can see what the delete took with it.
 *
 *   · `delete-region` refuses while a SURVIVING region's exit points at it;
 *     `deleteRegionOps` blanks those first (which is what the panel's own
 *     handler did, so the bytes are unmoved), then deletes.
 *   · `delete-item` refuses while a pool count or a starting-items entry names
 *     it — both are validator ERRORS on their own — and `deleteItemOps` clears
 *     those first, then deletes.
 *
 * ⛔ THE RENAMES ARE *NOT* GROUPS, and that is a measurement rather than a
 * preference — see `rulesDocOps.test.js`'s FOLD row, which builds the group of
 * atomic ops by hand and asserts it produces the same bytes as the one op. It
 * does; the one op is four lines against twenty-plus, its member list does not
 * have to be recomputed from the document at build time, and `apply-analysis`
 * (§13.4) is the precedent for a cascade whose rules already exist as a
 * function.
 *
 * ── ⚠ A NO-OP IS NOT THIS MODULE'S BUSINESS ───────────────────────────
 *
 * Setting a field to the value it already holds is APPLIED-FALSE by the
 * SESSION through `equal`, never refused here. A refusal for a field the
 * person re-typed unchanged would be a readout announcing something that did
 * not happen.
 */

import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';
import { makeExit, makeTrueRule } from '../shared/rulesJsonBuilder.js';
import {
    renameItemInRules,
    renameLocationInRules,
    renameRegionInRules,
    validateRules,
} from './rulesUtils.js';

/** ⛓ THE VOCABULARY, as data. */
export const RULES_OP_KINDS = Object.freeze([
    'add-region',
    'delete-region',
    'rename-region',
    'add-exit',
    'delete-exit',
    'set-exit-field',
    'add-location',
    'delete-location',
    'rename-location',
    'add-item',
    'delete-item',
    'rename-item',
    'set-item-field',
    'set-starting-count',
    'add-item-group',
    'rename-item-group',
    'delete-item-group',
    'set-canonical-placement',
    'set-meta',
    'set-start-region',
    'set-completion-condition',
    'set-rule-tree',
    'replace-region-sidecar',
    'set-key',
    'replace-document',
    'clear',
]);

/**
 * ⛓⛓ **WHERE A `set-key` WRITES**, as a table rather than a boolean, so the op
 * that RECORDS a Document-tab edit says out loud which of the two shapes it
 * meant. ⛔ Presence of `player` could not carry this: every op in this module
 * carries `player`, and the panel stamps it on all of them, so "a player is
 * named" would silently nest EVERY key under a slot the moment the Document tab
 * grew a selector — which is exactly the tab that op exists for.
 */
export const SET_KEY_SCOPES = Object.freeze({
    document: Object.freeze({ path: (key) => [key] }),
    player: Object.freeze({ path: (key, p) => [key, p] }),
});

/**
 * ⛓⛓⛓ **ONE TABLE THE OP AND THE ROW BOTH READ** — trap 823's cure. An op
 * that ENUMERATES its fields drops a new one silently, so the enumeration is
 * exported and `rulesDocOps.test.js` scans `apworldEditorUI.js`'s own
 * `set-item-field` call sites and asserts the two sets are EQUAL in both
 * directions: a field the panel writes that the table does not hold is a
 * refusal nobody predicted, and a field the table holds that no row writes is
 * a vocabulary entry with no caller.
 *
 * `where` is which container the field lives in — `item` is `items[p][name]`,
 * `pool` is `itempool_counts[p][name]`. ⚠ The STARTING count is not here: it
 * is a count of entries in a LIST, not a field, and it has its own op.
 */
export const ITEM_FIELDS = Object.freeze({
    id: Object.freeze({ where: 'item' }),
    classification: Object.freeze({ where: 'item' }),
    max_count: Object.freeze({ where: 'item' }),
    groups: Object.freeze({ where: 'item' }),
    event: Object.freeze({ where: 'item' }),
    pool_count: Object.freeze({ where: 'pool' }),
});

/** ⛓ The two fields an exit row writes directly. ⚠ `access_rule` is NOT one —
 *  it is a TREE and `set-rule-tree` carries it. */
export const EXIT_FIELDS = Object.freeze(['name', 'connected_region']);

/**
 * ⛓⛓ **THE META FIELDS AND WHERE EACH ONE LIVES**, as a table of PATHS, so the
 * op does not hold eight branches and the panel's eight rows name a key rather
 * than spelling a path. `path(player)` because three of them are per-slot.
 *
 * ⚠ `undefined` DELETES the key rather than storing it. `doc.schema_version =
 * undefined` — what the panel's closure did on an unparseable number — leaves a
 * key `JSON.stringify` then DROPS, so the published bytes were already those of
 * a delete; the op does what the bytes did.
 */
export const META_FIELDS = Object.freeze({
    game_name: Object.freeze({ path: () => ['game_name'] }),
    game_directory: Object.freeze({ path: () => ['game_directory'] }),
    world_class_name: Object.freeze({ path: (p) => ['world', p, 'world_class_name'] }),
    archipelago_version: Object.freeze({ path: () => ['archipelago_version'] }),
    schema_version: Object.freeze({ path: () => ['schema_version'] }),
    generation_seed: Object.freeze({ path: () => ['generation_seed'] }),
    seed_name: Object.freeze({ path: () => ['seed_name'] }),
    player_name: Object.freeze({ path: (p) => ['player_names', p] }),
});

/** ⛓ The two places an access-rule tree hangs off a region. */
export const RULE_TREE_KINDS = Object.freeze(['exit', 'location']);

const refuse = (error) => ({ ok: false, error });

const ok = (doc, description, value, op) => ({
    ok: true, doc, description,
    ...(value === undefined ? {} : { value }),
    ...(op === undefined ? {} : { op }),
});

/* ── copy-on-write primitives ─────────────────────────────────────────── */

/** ⛓ `obj.k = v` — an existing key keeps its POSITION, a new one appends. */
const withKey = (obj, k, v) => ({ ...(obj ?? {}), [k]: v });

/** ⛓ `delete obj.k`, as a rest-destructure. */
const withoutKey = (obj, k) => {
    const { [k]: _dropped, ...rest } = obj ?? {};
    return rest;
};

/**
 * ⛓ Write (or, with `undefined`, DELETE) a leaf at `path`, rebuilding only the
 * spine and sharing everything else.
 */
function setPath(obj, path, value) {
    const [head, ...rest] = path;
    if (rest.length === 0) {
        return value === undefined ? withoutKey(obj, head) : withKey(obj, head, value);
    }
    return withKey(obj, head, setPath((obj ?? {})[head], rest, value));
}

/** ⛓ The slot maps, READ-ONLY: an accessor that lazily CREATED its container
 *  would write through the session's folded record. */
const regionsOf = (doc, p) => doc?.regions?.[p] ?? {};
const itemsOf = (doc, p) => doc?.items?.[p] ?? {};
const poolOf = (doc, p) => doc?.itempool_counts?.[p] ?? {};
const startingOf = (doc, p) => (Array.isArray(doc?.starting_items?.[p])
    ? doc.starting_items[p] : []);

const withRegions = (doc, p, next) => setPath(doc, ['regions', p], next);
const withItems = (doc, p, next) => setPath(doc, ['items', p], next);
const withPool = (doc, p, next) => setPath(doc, ['itempool_counts', p], next);
const withStarting = (doc, p, next) => setPath(doc, ['starting_items', p], next);

/** ⛓ Replace ONE region, keeping the map's key order. */
const withRegion = (doc, p, name, region) => withRegions(doc, p,
    withKey(regionsOf(doc, p), name, region));

const playerOf = (op) => op?.player ?? DEFAULT_PLAYER_ID;

/**
 * ⛓⛓⛓ **A PAYLOAD AN OP CARRIES IS COPIED INTO THE RECORD, NEVER ALIASED.**
 *
 * ⛔ FOUND BY THE FIRST BROWSER RUN, and it is the sharpest defect this slice
 * had. Three ops carry arbitrary JSON a CALLER built — `set-rule-tree`'s tree,
 * `set-completion-condition`'s condition, `set-item-field`'s value. Storing the
 * reference makes the record and the caller's object THE SAME OBJECT, and the
 * APWorld panel's rule editor is a caller that keeps editing its copy in place:
 * the next keystroke wrote THROUGH the record, `equal(record, next)` then saw
 * two identical documents, and the session reported a NO-OP for an edit that
 * had already happened invisibly. Undo could not see it either.
 *
 * ⚠ It also breaks the fold's own law transitively — `apply` does not mutate
 * the record it is handed, but an op list re-folded after a caller touched its
 * own payload would reconstruct a DIFFERENT document.
 *
 * ⇒ Everything a caller hands in is structurally cloned on the way in. JSON is
 * the clone that keeps key order (trap 861), which is what this document's
 * `equal` reads.
 *
 * ⛓⛓ **THERE IS EXACTLY ONE CLONE SITE, AND THAT IS A MEASUREMENT.** The first
 * fix cloned in TWO places — the op on the way in AND each payload on the way
 * into the record — and the mutant that removed the second came back **GREEN**
 * across the whole browser gate and the node rows. It had to: `applyRulesDocOp`
 * copies the op BEFORE dispatch, so by the time a handler reads `op.tree` it is
 * already reading this module's own object and a second clone is a second copy
 * of a copy. The guard that cannot be shown to do anything is the guard that
 * goes (traps 824/825); what is left is one clone at the door, which every
 * handler is downstream of.
 */
const carried = (value) => (value === null || typeof value !== 'object'
    ? value
    : JSON.parse(JSON.stringify(value)));

/**
 * ⛓ FIRST FREE `${stem}` / `${stem} N` — the panel's own naming rule, and it is
 * a FUNCTION OF THE RECORD, so an `add-…` op that omits its name gets the same
 * name on every fold of the same list from the same base. That is what lets the
 * panel record `{op:'add-region'}` with no name and still have undo reproduce
 * the document byte for byte (`bounceLevelOps.nextId`'s rule).
 */
export function nextName(stem, taken) {
    const used = new Set(taken);
    if (!used.has(stem)) return stem;
    let i = 2;
    while (used.has(`${stem} ${i}`)) i += 1;
    return `${stem} ${i}`;
}

/* ── the validator, quoted rather than re-spelled ─────────────────────── */

/**
 * ⛓⛓⛓ **THE ERROR `next` WOULD INTRODUCE, IN `validateRules`' OWN WORDS.**
 *
 * ⛔ Differenced against the errors the document ALREADY has, so an op is never
 * refused for a dangling reference somebody else left behind. Returns `null`
 * when the op breaks nothing new.
 */
function newValidationError(doc, next, player) {
    const before = new Set(validateRules(doc, player)
        .filter((i) => i.severity === 'error').map((i) => i.message));
    for (const issue of validateRules(next, player)) {
        if (issue.severity === 'error' && !before.has(issue.message)) return issue.message;
    }
    return null;
}

/** ⛓ The cascade refusal's shape, shared by the two deletes that have one. */
const refuseCascade = (message, opName, builder) => refuse(`${message} ⛔ The cascade is a `
    + `GROUP: \`${builder}\` builds it — the clearing ops FIRST, THEN the `
    + `\`${opName}\`, so every intermediate document is one the validator accepts and one `
    + 'undo restores what the delete took with it.');

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ ONE ATOMIC OP → `{ok, doc, description, value?}` / `{ok:false, error}`
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛔ The shape is `atlasOps.applyAtlasOp`'s and `bounceLevelOps.applyBounceOp`'s,
 * deliberately: the adapter maps `error` → `description` and `doc` → `record` in
 * three lines, exactly as the other two do. Three substrates, one adapter shape.
 */
export function applyRulesDocOp(doc, op) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        return refuse(`apworld: a rules document is an object, got ${JSON.stringify(doc)}.`);
    }
    /**
     * ⛓⛓⛓ **THE OP IS COPIED BEFORE IT IS READ, AND THE COPY IS WHAT GETS
     * RECORDED.** ⛔ Cloning only on the way into the RECORD is not enough: the
     * EDIT LIST is the identity, `editCore` records `res.op ?? op`, and an op
     * whose payload the caller can still mutate makes the list reconstruct a
     * document nobody edited on the next fold — which is exactly what the first
     * browser run measured (the undo came back with the LATER value in it).
     * From here on the caller's object and the record share nothing.
     */
    const resolved = carried(op);
    const res = dispatchRulesDocOp(doc, resolved);
    return res.ok ? { ...res, op: res.op ?? resolved } : res;
}

/** ⛓ The dispatch, over an op this module already owns a private copy of. */
function dispatchRulesDocOp(doc, op) {
    switch (op?.op) {
        case 'add-region': return opAddRegion(doc, op);
        case 'delete-region': return opDeleteRegion(doc, op);
        case 'rename-region': return opRenameRegion(doc, op);
        case 'add-exit': return opAddExit(doc, op);
        case 'delete-exit': return opDeleteExit(doc, op);
        case 'set-exit-field': return opSetExitField(doc, op);
        case 'add-location': return opAddLocation(doc, op);
        case 'delete-location': return opDeleteLocation(doc, op);
        case 'rename-location': return opRenameLocation(doc, op);
        case 'add-item': return opAddItem(doc, op);
        case 'delete-item': return opDeleteItem(doc, op);
        case 'rename-item': return opRenameItem(doc, op);
        case 'set-item-field': return opSetItemField(doc, op);
        case 'set-starting-count': return opSetStartingCount(doc, op);
        case 'add-item-group': return opAddItemGroup(doc, op);
        case 'rename-item-group': return opRenameItemGroup(doc, op);
        case 'delete-item-group': return opDeleteItemGroup(doc, op);
        case 'set-canonical-placement': return opSetCanonicalPlacement(doc, op);
        case 'set-meta': return opSetMeta(doc, op);
        case 'set-start-region': return opSetStartRegion(doc, op);
        case 'set-completion-condition': return opSetCompletionCondition(doc, op);
        case 'set-rule-tree': return opSetRuleTree(doc, op);
        case 'replace-region-sidecar': return opReplaceRegionSidecar(doc, op);
        case 'set-key': return opSetKey(doc, op);
        case 'replace-document': return opReplaceDocument(doc, op);
        case 'clear': return opClear(doc, op);
        default:
            return refuse(`apworld: unknown op ${JSON.stringify(op?.op)} — the vocabulary is `
                + `[${RULES_OP_KINDS.join(', ')}].`);
    }
}

/* ── regions ─────────────────────────────────────────────────────────── */

/** ⛓ `{name?}` — `value` is the region. */
function opAddRegion(doc, op) {
    const p = playerOf(op);
    const regions = regionsOf(doc, p);
    const name = op.name ?? nextName('New Region', Object.keys(regions));
    if (typeof name !== 'string' || !name.trim()) {
        return refuse(`apworld: a region name is a non-empty string, got ${JSON.stringify(op.name)}.`);
    }
    if (name in regions) {
        return refuse(`A region named "${name}" already exists.`);
    }
    const region = { name, exits: [], locations: [] };
    // ⛓ THE RESOLVED OP SPENDS THE DRAWN NAME — `editCore`'s contract for
    //   `apply`'s returned op. The derivation is a function of the record, so
    //   the fold would reach the same name anyway; recording it means a reader
    //   of `payload().edits` sees what was created rather than a rule for it.
    return ok(withRegion(doc, p, name, region), `+ region ${name}`, region, { ...op, name });
}

/** Every SURVIVING region's exits that point at `name`, as `{region, index}`. */
export function exitsPointingAt(doc, player, name) {
    const out = [];
    for (const [rn, region] of Object.entries(regionsOf(doc, player))) {
        if (rn === name) continue;                       // it goes with the region
        (region?.exits ?? []).forEach((ex, index) => {
            if (ex?.connected_region === name) out.push({ region: rn, index });
        });
    }
    return out;
}

/**
 * ⛓⛓ THE CASCADE, AS A FLAT OP LIST — one `set-exit-field` blanking each
 * surviving dangling destination, then the delete.
 *
 * ⛔ THE ORDER IS LOAD-BEARING: every intermediate document inside the group is
 * one the validator accepts, and reversed the delete would refuse on its own
 * danglers. ⚠ It is a plain ARRAY, not a `group`: the caller wraps it, because
 * `editCore.group` is the core's and this module imports nothing from it.
 *
 * ⚠ `''` rather than a removal is the PANEL'S OWN CHOICE, kept: an exit whose
 * destination was blanked is a WARNING the person notices, where a silently
 * deleted exit is a change nobody sees.
 */
export function deleteRegionOps(doc, name, player = DEFAULT_PLAYER_ID) {
    return [
        ...exitsPointingAt(doc, player, name).map(({ region, index }) => ({
            op: 'set-exit-field', region, index, field: 'connected_region', value: '', player,
        })),
        { op: 'delete-region', name, player },
    ];
}

/** ⛓ `{name}` — REFUSES while a surviving exit still points at it. */
function opDeleteRegion(doc, op) {
    const p = playerOf(op);
    const regions = regionsOf(doc, p);
    if (!(op.name in regions)) {
        return refuse(`apworld: no region "${op.name}" to delete — the document holds `
            + `[${Object.keys(regions).join(', ')}].`);
    }
    const next = withRegions(doc, p, withoutKey(regions, op.name));
    if (exitsPointingAt(doc, p, op.name).length) {
        const message = newValidationError(doc, next, p);
        if (message) return refuseCascade(message, 'delete-region', 'deleteRegionOps(doc, name)');
    }
    return ok(next, `− region ${op.name}`);
}

/**
 * ⛓⛓⛓ `{from, to}` — **ONE OP CARRYING THE FOUR-SITE CASCADE**, the
 * `apply-analysis` precedent (§13.4) and the FOLD measured in the test file.
 *
 * The four sites: the ordered key AND the region's own `name`; every exit
 * `connected_region`; every `CanReachRegion.region_name` in every rule tree;
 * every `start_regions[p].default` entry.
 *
 * ⛔ It clones through `JSON.parse(JSON.stringify(…))` because
 * `renameRegionInRules` writes THROUGH the document, and a structural clone is
 * the only one that keeps key order (trap 861).
 */
function opRenameRegion(doc, op) {
    const p = playerOf(op);
    const regions = regionsOf(doc, p);
    const to = typeof op.to === 'string' ? op.to.trim() : '';
    if (!(op.from in regions)) {
        return refuse(`apworld: no region "${op.from}" to rename — the document holds `
            + `[${Object.keys(regions).join(', ')}].`);
    }
    if (!to) return refuse('apworld: a region name is a non-empty string.');
    if (to !== op.from && to in regions) {
        return refuse(`A region named "${to}" already exists.`);
    }
    const next = JSON.parse(JSON.stringify(doc));
    // (1) the ordered key rebuild, and the region's own `name`.
    const ordered = {};
    for (const [k, v] of Object.entries(next.regions[p])) {
        if (k === op.from) { v.name = to; ordered[to] = v; } else { ordered[k] = v; }
    }
    next.regions[p] = ordered;
    // (2) exit destinations.
    for (const r of Object.values(ordered)) {
        for (const ex of r.exits ?? []) if (ex.connected_region === op.from) ex.connected_region = to;
    }
    // (3) CanReachRegion references in every rule tree.
    renameRegionInRules(next, p, op.from, to);
    // (4) start_regions.default entries.
    const sr = next.start_regions?.[p];
    if (sr && Array.isArray(sr.default)) sr.default = sr.default.map((n) => (n === op.from ? to : n));
    return ok(next, `rename region ${op.from} → ${to}`);
}

/* ── exits ───────────────────────────────────────────────────────────── */

const regionOr = (doc, p, name) => {
    const regions = regionsOf(doc, p);
    return (name in regions)
        ? { region: regions[name] }
        : {
            error: `apworld: no region "${name}" — the document holds `
                + `[${Object.keys(regions).join(', ')}].`,
        };
};

/** ⛓ `{region, name?}` — `value` is the exit. */
function opAddExit(doc, op) {
    const p = playerOf(op);
    const { region, error } = regionOr(doc, p, op.region);
    if (error) return refuse(error);
    const exits = region.exits ?? [];
    const name = op.name ?? nextName(`${op.region} → ?`, exits.map((e) => e?.name));
    if (exits.some((e) => e?.name === name)) {
        return refuse(`An exit named "${name}" already exists in "${op.region}".`);
    }
    const exit = makeExit(name, '');
    return ok(
        withRegion(doc, p, op.region, withKey(region, 'exits', [...exits, exit])),
        `+ exit ${name} in ${op.region}`,
        exit,
        { ...op, name },
    );
}

const indexedOr = (list, index, what, where) => (
    Number.isInteger(index) && index >= 0 && index < list.length
        ? null
        : `apworld: no ${what} #${index} in "${where}" — it holds ${list.length}.`);

/** ⛓ `{region, index}`. */
function opDeleteExit(doc, op) {
    const p = playerOf(op);
    const { region, error } = regionOr(doc, p, op.region);
    if (error) return refuse(error);
    const exits = region.exits ?? [];
    const bad = indexedOr(exits, op.index, 'exit', op.region);
    if (bad) return refuse(bad);
    const gone = exits[op.index];
    return ok(
        withRegion(doc, p, op.region,
            withKey(region, 'exits', exits.filter((_, i) => i !== op.index))),
        `− exit ${gone?.name ?? op.index} in ${op.region}`,
    );
}

/** ⛓ `{region, index, field, value}` — `EXIT_FIELDS` only. */
function opSetExitField(doc, op) {
    const p = playerOf(op);
    const { region, error } = regionOr(doc, p, op.region);
    if (error) return refuse(error);
    const exits = region.exits ?? [];
    const bad = indexedOr(exits, op.index, 'exit', op.region);
    if (bad) return refuse(bad);
    if (!EXIT_FIELDS.includes(op.field)) {
        return refuse(`apworld: an exit row writes [${EXIT_FIELDS.join(', ')}], not `
            + `${JSON.stringify(op.field)}. ⛔ \`access_rule\` is a TREE and \`set-rule-tree\` `
            + 'carries it.');
    }
    const next = exits.map((e, i) => (i === op.index
        ? (op.value === undefined ? withoutKey(e, op.field) : withKey(e, op.field, op.value))
        : e));
    return ok(
        withRegion(doc, p, op.region, withKey(region, 'exits', next)),
        `exit #${op.index} in ${op.region}: ${op.field} = ${JSON.stringify(op.value)}`,
    );
}

/* ── locations ───────────────────────────────────────────────────────── */

/** ⛓ `{region, name?}` — `value` is the location. */
function opAddLocation(doc, op) {
    const p = playerOf(op);
    const { region, error } = regionOr(doc, p, op.region);
    if (error) return refuse(error);
    const locations = region.locations ?? [];
    const name = op.name ?? nextName('New Location', locations.map((l) => l?.name));
    if (locations.some((l) => l?.name === name)) {
        return refuse(`A location named "${name}" already exists in this region.`);
    }
    const location = { name, id: null, access_rule: makeTrueRule() };
    return ok(
        withRegion(doc, p, op.region, withKey(region, 'locations', [...locations, location])),
        `+ location ${name} in ${op.region}`,
        location,
        { ...op, name },
    );
}

/** ⛓ `{region, index}`. */
function opDeleteLocation(doc, op) {
    const p = playerOf(op);
    const { region, error } = regionOr(doc, p, op.region);
    if (error) return refuse(error);
    const locations = region.locations ?? [];
    const bad = indexedOr(locations, op.index, 'location', op.region);
    if (bad) return refuse(bad);
    const gone = locations[op.index];
    return ok(
        withRegion(doc, p, op.region,
            withKey(region, 'locations', locations.filter((_, i) => i !== op.index))),
        `− location ${gone?.name ?? op.index} in ${op.region}`,
    );
}

/**
 * ⛓ `{region, index, to}` — ONE op carrying the `CanReachLocation` cascade.
 * The clone is trap 861's, as in `rename-region`.
 */
function opRenameLocation(doc, op) {
    const p = playerOf(op);
    const { region, error } = regionOr(doc, p, op.region);
    if (error) return refuse(error);
    const locations = region.locations ?? [];
    const bad = indexedOr(locations, op.index, 'location', op.region);
    if (bad) return refuse(bad);
    const to = typeof op.to === 'string' ? op.to.trim() : '';
    if (!to) return refuse('apworld: a location name is a non-empty string.');
    const from = locations[op.index]?.name;
    if (locations.some((l, i) => i !== op.index && l?.name === to)) {
        return refuse(`A location named "${to}" already exists in this region.`);
    }
    const next = JSON.parse(JSON.stringify(doc));
    next.regions[p][op.region].locations[op.index].name = to;
    renameLocationInRules(next, p, from, to);
    return ok(next, `rename location ${from} → ${to}`);
}

/* ── items ───────────────────────────────────────────────────────────── */

/**
 * ⛓ `{name?}` — `value` is the item. ⚠ IT ALSO WRITES THE POOL COUNT OF 1,
 * as the panel's handler did, and that is ONE op rather than a group because
 * there is no invalid intermediate to enforce an order against: an item with no
 * pool count is a document the validator accepts (the error is a pool count
 * with no ITEM, which is the delete's problem, not the add's).
 */
function opAddItem(doc, op) {
    const p = playerOf(op);
    const items = itemsOf(doc, p);
    const name = op.name ?? nextName('New Item', Object.keys(items));
    if (typeof name !== 'string' || !name.trim()) {
        return refuse(`apworld: an item name is a non-empty string, got ${JSON.stringify(op.name)}.`);
    }
    if (name in items) return refuse(`An item named "${name}" already exists.`);
    const item = {
        name, id: null, groups: [], classification: 'filler', type: null, max_count: 1,
    };
    const withItem = withItems(doc, p, withKey(items, name, item));
    return ok(
        withPool(withItem, p, withKey(poolOf(doc, p), name, 1)),
        `+ item ${name}`,
        item,
        { ...op, name },
    );
}

/** ⛓ `{name}` — the pool count and starting entries that would dangle. */
export function deleteItemOps(doc, name, player = DEFAULT_PLAYER_ID) {
    const ops = [];
    if (name in poolOf(doc, player)) {
        ops.push({ op: 'set-item-field', item: name, field: 'pool_count', player });
    }
    if (startingOf(doc, player).includes(name)) {
        ops.push({ op: 'set-starting-count', item: name, count: 0, player });
    }
    ops.push({ op: 'delete-item', name, player });
    return ops;
}

/** ⛓ `{name}` — REFUSES while the pool or the starting list still names it. */
function opDeleteItem(doc, op) {
    const p = playerOf(op);
    const items = itemsOf(doc, p);
    if (!(op.name in items)) {
        return refuse(`apworld: no item "${op.name}" to delete — the document holds `
            + `[${Object.keys(items).join(', ')}].`);
    }
    const next = withItems(doc, p, withoutKey(items, op.name));
    if (op.name in poolOf(doc, p) || startingOf(doc, p).includes(op.name)) {
        const message = newValidationError(doc, next, p);
        if (message) return refuseCascade(message, 'delete-item', 'deleteItemOps(doc, name)');
    }
    return ok(next, `− item ${op.name}`);
}

/**
 * ⛓⛓ `{from, to}` — ONE op carrying a SIX-site cascade: the ordered key, the
 * item's own `name`, the `itempool_counts` key, every `starting_items` entry,
 * every `Has`/`HasAll`/`HasAny`/`HasFromList`/`CountItem` reference in every
 * rule tree, and the `completion_condition` when it is an `item_check` for it.
 */
function opRenameItem(doc, op) {
    const p = playerOf(op);
    const items = itemsOf(doc, p);
    const to = typeof op.to === 'string' ? op.to.trim() : '';
    if (!(op.from in items)) {
        return refuse(`apworld: no item "${op.from}" to rename — the document holds `
            + `[${Object.keys(items).join(', ')}].`);
    }
    if (!to) return refuse('apworld: an item name is a non-empty string.');
    if (to !== op.from && to in items) return refuse(`An item named "${to}" already exists.`);
    const next = JSON.parse(JSON.stringify(doc));
    const ordered = {};
    for (const [k, v] of Object.entries(next.items[p])) {
        if (k === op.from) { v.name = to; ordered[to] = v; } else { ordered[k] = v; }
    }
    next.items[p] = ordered;
    const counts = next.itempool_counts?.[p];
    if (counts && op.from in counts) {
        const rekeyed = {};
        for (const [k, v] of Object.entries(counts)) rekeyed[k === op.from ? to : k] = v;
        next.itempool_counts[p] = rekeyed;
    }
    const startList = next.starting_items?.[p];
    if (Array.isArray(startList)) {
        next.starting_items[p] = startList.map((n) => (n === op.from ? to : n));
    }
    renameItemInRules(next, p, op.from, to);
    const cc = next.game_info?.[p]?.completion_condition;
    if (cc && cc.type === 'item_check' && cc.item === op.from) cc.item = to;
    return ok(next, `rename item ${op.from} → ${to}`);
}

/** ⛓ `{item, field, value}` — `ITEM_FIELDS` only; an ABSENT `value` DELETES. */
function opSetItemField(doc, op) {
    const p = playerOf(op);
    const spec = Object.prototype.hasOwnProperty.call(ITEM_FIELDS, op.field ?? '')
        ? ITEM_FIELDS[op.field] : null;
    if (!spec) {
        return refuse(`apworld: an item row writes [${Object.keys(ITEM_FIELDS).join(', ')}], not `
            + `${JSON.stringify(op.field)}. ⛔ The table is \`ITEM_FIELDS\` and the row and the `
            + 'op read the SAME one, so a field a row learns to write is a field this op '
            + 'accepts on the same commit.');
    }
    const items = itemsOf(doc, p);
    if (!(op.item in items)) {
        return refuse(`apworld: no item "${op.item}" — the document holds `
            + `[${Object.keys(items).join(', ')}].`);
    }
    const shown = op.value === undefined ? '(absent)' : JSON.stringify(op.value);
    if (spec.where === 'pool') {
        return ok(
            withPool(doc, p, op.value === undefined
                ? withoutKey(poolOf(doc, p), op.item)
                : withKey(poolOf(doc, p), op.item, op.value)),
            `item ${op.item}: pool count = ${shown}`,
        );
    }
    const item = items[op.item];
    return ok(
        withItems(doc, p, withKey(items, op.item, op.value === undefined
            ? withoutKey(item, op.field)
            : withKey(item, op.field, op.value))),
        `item ${op.item}: ${op.field} = ${shown}`,
    );
}

/**
 * ⛓ `{item, count}` — the LIST rewrite `_setStartingCount` did: every entry for
 * the item removed, then `count` of them appended. ⚠ The panel's rounding and
 * its floor of 0 live HERE, so the op list records the count that was applied
 * rather than the number that was typed.
 */
function opSetStartingCount(doc, op) {
    const p = playerOf(op);
    if (typeof op.item !== 'string' || !op.item) {
        return refuse(`apworld: set-starting-count needs an item name, got ${JSON.stringify(op.item)}.`);
    }
    const c = Math.max(0, Math.floor(op.count) || 0);
    const list = startingOf(doc, p).filter((n) => n !== op.item);
    for (let i = 0; i < c; i += 1) list.push(op.item);
    return ok(withStarting(doc, p, list), `starting ${op.item} × ${c}`);
}

/**
 * ⛓⛓ **HOW MANY NAMES A REFUSAL MAY LIST.** The neighbouring refusals
 * (`regionOr`, `opSetMeta`) print the whole vocabulary because a document holds
 * a few dozen regions and eight meta fields. LOCATIONS AND ITEMS ARE NOT THAT:
 * measured over the committed corpus, `dark_souls_3` slot 1 holds **1,194**
 * locations and **1,208** items, `depgraph` **712** and **1,356**, and `sc2` slot 1
 * holds **1,741** items under an **889**-name group registry — a refusal that named
 * them all would be a hundred-kilobyte `alert()`. So the list is
 * bounded and SAYS it is bounded; the sentence still names what the person
 * typed and enough of what the document holds to see the spelling.
 */
export const REFUSAL_NAME_LIMIT = 12;

/** ⛓ `[a, b, … and N more]`, so a refusal is a sentence rather than a dump. */
function listNames(names) {
    const shown = names.slice(0, REFUSAL_NAME_LIMIT);
    const rest = names.length - shown.length;
    return `${shown.join(', ')}${rest > 0 ? `, … and ${rest} more` : ''}`;
}

/* ── item groups ─────────────────────────────────────────────────────── */

/**
 * ⛓⛓⛓ **THE ITEM-GROUP REGISTRY'S KEY**, named once so the ops, the registry
 * table and the Items tab cannot disagree about it (I1).
 */
export const ITEM_GROUPS_KEY = 'item_groups';

/**
 * ⛓⛓⛓ **THE LAW THIS WHOLE SECTION RESTS ON: `item_groups[p]` IS A NAME
 * REGISTRY, AND MEMBERSHIP LIVES ON `items[p][name].groups`.**
 *
 * MEASURED over the 212 committed documents (python over
 * `frontend/presets/*∕AP_*∕AP_*_rules.json`): every one carries `item_groups`,
 * all **224** slots hold an ARRAY of names, and the engine reads it that way —
 * `shared/snapshotInterface.js:631-661`, where an array value makes
 * `HasGroup` / `group_count` / `group_check` count membership through each
 * ITEM's own `groups` field. (The other branch, `{group: [items]}`, is the
 * object form and no committed document uses it.)
 *
 * ⛔ **THE TWO ARE NOT DERIVABLE FROM EACH OTHER, AND THE EDITOR MUST NOT
 * "FIX" EITHER.** Measured: the registry equals the union of the items' own
 * groups in **69** slots and differs in **155** — and the divergence is
 * ONE-DIRECTIONAL. In all 155 the items carry a name the registry LACKS
 * (`Event` in 154 of them); **0** slots carry a registry name no item uses.
 * ⇒ an "unlisted" group is a real, common state and gets shown rather than
 * silently added; a registry entry with no carriers is legal, rare enough that
 * the corpus has none, and is exactly what `add-item-group` creates on the way
 * to populating it.
 *
 * ⚠ The registry's CONTENT has no reader in this tree today:
 * `world_generator/extractors.py:397` extracts it into `WorldData.item_groups`
 * and no template consumes it (`grep '\.item_groups' world_generator/` = the
 * assignment alone) — the generated world's `item_name_groups` is built from
 * the ITEMS' `groups`. The engine reads the slot's value only to pick the
 * array branch. So this registry is the world's declared vocabulary, and that
 * is the thing this editor is for.
 */

/** ⛓ The slot's registry, READ-ONLY and always an array (`regionsOf`'s rule:
 *  an accessor that lazily created its container would write through the
 *  session's folded record). */
export function itemGroupRegistry(doc, player = DEFAULT_PLAYER_ID) {
    const v = doc?.[ITEM_GROUPS_KEY]?.[player ?? DEFAULT_PLAYER_ID];
    return Array.isArray(v) ? v : [];
}

/** ⛓ One item's groups, READ-ONLY and always an array. */
const groupsOfItem = (item) => (Array.isArray(item?.groups) ? item.groups : []);

/**
 * ⛓⛓⛓ **WHICH ITEMS CARRY A GROUP — THE ONE PREDICATE** (P1's shape, one key
 * over). The delete refusal, the Groups section's per-name count, the disabled
 * delete button's `title` and the in-app rows all ask THIS, so a name the
 * section says nothing carries is exactly a name the op will delete.
 *
 * ⛔ A second spelling of "does anything carry this" would agree with the first
 * until the day one of them learned about another container — and then the
 * button would be enabled for a delete the op refuses.
 *
 * ⚠ Document order, never sorted: the tab draws items in the order the
 * generator wrote them.
 */
export function itemsCarryingGroup(doc, name, player = DEFAULT_PLAYER_ID) {
    const items = itemsOf(doc, player ?? DEFAULT_PLAYER_ID);
    return Object.keys(items).filter((n) => groupsOfItem(items[n]).includes(name));
}

/**
 * ⛓⛓ **THE GROUPS THE ITEMS CARRY THAT THE REGISTRY DOES NOT LIST**, in the
 * order the items introduce them. 155 of the 224 committed slots have at least
 * one; they are legal and the editor SHOWS them (with the one gesture it can
 * offer: add this name to the registry) rather than writing them in behind the
 * person's back.
 */
export function unlistedItemGroups(doc, player = DEFAULT_PLAYER_ID) {
    const p = player ?? DEFAULT_PLAYER_ID;
    const listed = new Set(itemGroupRegistry(doc, p));
    const out = [];
    const seen = new Set();
    for (const item of Object.values(itemsOf(doc, p))) {
        for (const g of groupsOfItem(item)) {
            if (typeof g === 'string' && !listed.has(g) && !seen.has(g)) {
                seen.add(g);
                out.push(g);
            }
        }
    }
    return out;
}

/** ⛓ A group name is a non-empty string, trimmed — the rule `add-item-group`
 *  and `rename-item-group` share so the two cannot differ about it. */
const groupName = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * ⛓ `{name}` — appends a name to the slot's registry, CREATING the block when
 * the document has none (a procgen document is where a person wants to add
 * groups, and `makeRulesJsonScaffold` writes `item_groups: {'1': []}` — but a
 * hand-built document need not carry the key at all).
 *
 * ⛓ It is also the *"add to registry"* gesture for an unlisted group: the name
 * is already on the items, and this is what promotes it to the vocabulary.
 */
function opAddItemGroup(doc, op) {
    const p = playerOf(op);
    const name = groupName(op.name);
    if (!name) {
        return refuse('apworld: an item group name is a non-empty string, got '
            + `${JSON.stringify(op.name)}.`);
    }
    const groups = itemGroupRegistry(doc, p);
    if (groups.includes(name)) {
        return refuse(`An item group named "${name}" is already in slot ${p}'s registry — `
            + `[${listNames(groups)}].`);
    }
    return ok(setPath(doc, [ITEM_GROUPS_KEY, p], [...groups, name]),
        `+ item group ${name}`, name, { ...op, name });
}

/**
 * ⛓⛓ `{name, newName}` — ONE op carrying a TWO-site cascade: the registry
 * entry (in place, so the list's order is content) and EVERY item's own
 * `groups` membership. One op means one undo, which is the whole reason the
 * two sites are not two ops: a rename that took two undos to put back would
 * leave the document in a state where the registry and the items disagree.
 *
 * ⚠ An item that already carries `newName` does not get it twice — the map is
 * de-duplicated per item, keeping the first position.
 */
function opRenameItemGroup(doc, op) {
    const p = playerOf(op);
    const from = op.name;
    const to = groupName(op.newName);
    const groups = itemGroupRegistry(doc, p);
    if (typeof from !== 'string' || !groups.includes(from)) {
        return refuse(`apworld: no item group "${from}" in slot ${p} — the registry holds `
            + `[${listNames(groups)}].`);
    }
    if (!to) {
        return refuse('apworld: an item group name is a non-empty string, got '
            + `${JSON.stringify(op.newName)}.`);
    }
    if (to !== from && groups.includes(to)) {
        return refuse(`An item group named "${to}" is already in slot ${p}'s registry — `
            + `[${listNames(groups)}].`);
    }
    let next = setPath(doc, [ITEM_GROUPS_KEY, p], groups.map((g) => (g === from ? to : g)));
    const carriers = itemsCarryingGroup(doc, from, p);
    if (carriers.length) {
        const items = itemsOf(next, p);
        let nextItems = items;
        for (const itemName of carriers) {
            const item = items[itemName];
            const renamed = [];
            for (const g of groupsOfItem(item)) {
                const g2 = g === from ? to : g;
                if (!renamed.includes(g2)) renamed.push(g2);
            }
            nextItems = withKey(nextItems, itemName, withKey(item, 'groups', renamed));
        }
        next = withItems(next, p, nextItems);
    }
    return ok(next, `rename item group ${from} → ${to} (${carriers.length} item`
        + `${carriers.length === 1 ? '' : 's'})`);
}

/**
 * ⛓⛓⛓ `{name}` — **REFUSED BY NAME WHILE ANY ITEM STILL CARRIES THE GROUP.**
 *
 * ⚖ user, 2026-09-09, asked which of "refuse" / "cascade" / "orphan" this
 * should be: *"Let's go with refuse."* So this is NOT a `deleteItemOps`-shaped
 * cascade — there is no builder that clears the members first, deliberately.
 * A group is a classification a person put on items on purpose, and removing
 * it from a hundred of them because a registry row was deleted is not a
 * gesture anyone asked for; the refusal LISTS the carriers so the next click
 * is obvious.
 *
 * ⛔ And the refusal is the OP's, not the button's. The Groups section disables
 * its delete button with the same sentence in the `title`, but that is a
 * courtesy: the guard has to hold for a caller that never drew a button (the
 * Document tab's whole-block `set-key` is a different vocabulary on the same
 * key and is the everything-fallback — W0's rule).
 *
 * ⚠ **Deleting a registry entry does NOT ask about rule trees.** Measured over
 * the corpus: **32** slots carry `HasGroup` / `group_count` / `group_check`
 * nodes (**566** nodes in all) naming **81** distinct groups, and **3** of
 * those references already name a group that is in neither the registry nor on
 * any item — i.e. a dangling group reference is a state the committed corpus
 * is already in, and the ⚖ ruling is about the ITEMS. Whether the refusal
 * should also read the rules is on the record as an open question rather than
 * decided here.
 */
function opDeleteItemGroup(doc, op) {
    const p = playerOf(op);
    const groups = itemGroupRegistry(doc, p);
    if (typeof op.name !== 'string' || !groups.includes(op.name)) {
        return refuse(`apworld: no item group "${op.name}" in slot ${p} to delete — the `
            + `registry holds [${listNames(groups)}].`);
    }
    const carriers = itemsCarryingGroup(doc, op.name, p);
    if (carriers.length) {
        return refuse(`apworld: ${carriers.length} item${carriers.length === 1 ? '' : 's'} still `
            + `carr${carriers.length === 1 ? 'ies' : 'y'} the group "${op.name}" — `
            + `[${listNames(carriers)}]. ⛔ Take the group off those items first (the Groups `
            + 'picker on each item row); this op will not take it off them for you.');
    }
    return ok(setPath(doc, [ITEM_GROUPS_KEY, p], groups.filter((g) => g !== op.name)),
        `− item group ${op.name}`);
}

/* ── canonical placements ────────────────────────────────────────────── */

/**
 * ⛓⛓⛓ **THE SLOT'S LOCATIONS, IN DOCUMENT ORDER, EACH WITH ITS REGION** — and
 * it is EXPORTED because the op and the Placements tab must not disagree about
 * what "a location this slot holds" means.
 *
 * ⛔ The op refuses a location the slot does not hold and the tab lists the
 * locations it may place into; two spellings of that set would agree until the
 * day one of them learned about a second container, and then the tab would
 * offer a row whose every edit was refused. One function, both callers
 * (trap 823's shape: the enumeration is the shared table).
 *
 * ⚠ Order is the DOCUMENT's — region insertion order, then each region's own
 * `locations` array — never sorted, because the tab draws them in this order
 * and a person reading a generated world reads it in the order the generator
 * wrote it.
 */
export function locationsOfPlayer(doc, player = DEFAULT_PLAYER_ID) {
    const out = [];
    for (const [region, body] of Object.entries(regionsOf(doc, player))) {
        const locations = Array.isArray(body?.locations) ? body.locations : [];
        for (const loc of locations) {
            if (typeof loc?.name === 'string') out.push({ region, name: loc.name });
        }
    }
    return out;
}

/** ⛓ The slot's placements, READ-ONLY (the `regionsOf` rule: never lazily created). */
const placementsOf = (doc, p) => doc?.canonical_placements?.[p] ?? {};

/**
 * ⛓⛓⛓ **ONE CANONICAL PLACEMENT — `{location, item}`, per player** (W3).
 *
 * `canonical_placements[player]` is a flat `location name → item name` map, and
 * it is an INPUT rather than a readout: `world_generator/extractors.py` reads it
 * as the `--canonical-seed` placement source, so what this op writes is what the
 * next `Generate.py` places. That is why the refusals are by NAME against the
 * document's own regions and items — a placement naming something the world does
 * not hold is a seed that cannot be generated, and the schema cannot catch it
 * (`additionalProperties: true` on the slot).
 *
 * ⛓⛓ **THE SECOND VOCABULARY ON THIS PATH, DELIBERATELY.** The Document tab's
 * `set-key` already writes the whole `canonical_placements` block, and it keeps
 * that (W0's rule: the pointer AND the block). This op is the small,
 * per-entry one — the same situation W0's §7.7 (1) names for the six fields the
 * Meta tab and the Document tab both write. Both are schema-vetoed, both are one
 * undo, and the Document row says which tab knows the shape.
 *
 * ⛓⛓ **P1 — AND THE REFUSALS ARE `canonicalPlacementIssues`' PREDICATE, ASKED
 * ABOUT ONE ENTRY.** The three sentences below are this op's, because they name
 * what the slot holds and a corpus report has no room for that; but WHICH of
 * them fires is `placementIssueReason`, which the tab, the panel's whole-block
 * veto and `check-canonical-placements.mjs` also read. So an entry the tab
 * marks stale is exactly an entry this op refuses to write, by construction
 * rather than by agreement.
 *
 * ⛓⛓ **AN ABSENT / EMPTY `item` DELETES, AND A DELETE IS NOT VALIDATED.** This
 * is not a loosening — it is the only thing that makes a hand-edited file
 * fixable. A document can carry a placement naming a location or an item that is
 * no longer in it; the tab SHOWS those rather than dropping them, and the only
 * gesture it can offer is removal. Refusing the delete because the name it names
 * is unknown would leave the one entry a person needs to remove as the one entry
 * they cannot. ⇒ the refusals guard what is WRITTEN, never what is removed.
 * (`''` clears, as it does in `set-start-region` — that is the blank
 * "(unplaced)" option's value.)
 *
 * ⛔ Deleting an entry that is not there returns the document UNCHANGED rather
 * than refusing: the session's `equal` reports it as a no-op, which is this
 * module's standing rule, and writing `canonical_placements[p] = {}` into a
 * document that never carried the key would be a byte change for a gesture that
 * removed nothing.
 */
/**
 * ⛓⛓⛓ **THE THREE WAYS ONE ENTRY CAN BE STALE, BY NAME** (P1).
 *
 * They are the refusals `set-canonical-placement` already had, promoted to
 * data so that the op, the Placements tab, the panel's whole-block veto and
 * the corpus gate all ask ONE question. ⛔ A second spelling of *"is this
 * entry writable"* would agree with the first until the day one of them
 * learned about a new container, and then the tab would mark rows the op is
 * happy to write — trap 823's shape, one layer up: the ENUMERATION is the
 * shared table.
 */
export const PLACEMENT_ISSUE_REASONS = Object.freeze({
    UNKNOWN_LOCATION: 'unknown location',
    NON_STRING_VALUE: 'non-string value',
    UNKNOWN_ITEM: 'unknown item',
});

/**
 * ⛓⛓ **THE PREDICATE — `null` for an entry this op would WRITE, a reason
 * otherwise.**
 *
 * ⚠ THE ORDER IS LOAD-BEARING, AND NOT THE ORDER THE REFUSALS USED TO RUN IN.
 * Until P1 the op checked the item's TYPE before the location's membership;
 * the validator cannot, because an entry whose location the slot does not hold
 * has no row to sit on and the tab has to draw it in the orphan block whatever
 * its value is. Reporting `non-string value` for such an entry would take it
 * out of the one list that can offer it a delete — i.e. it would be the
 * "silently dropped" outcome W3's tab exists to prevent. So membership first,
 * and the op follows the validator rather than the other way round.
 *
 * @param {string} location
 * @param {*} item                the stored value, which is why it is not typed
 * @param {Set<string>} held      `locationsOfPlayer` names, as a set
 * @param {object} items          the slot's item table
 * @returns {string|null} one of `PLACEMENT_ISSUE_REASONS`, or `null`
 */
function placementIssueReason(location, item, held, items) {
    if (!held.has(location)) return PLACEMENT_ISSUE_REASONS.UNKNOWN_LOCATION;
    if (typeof item !== 'string') return PLACEMENT_ISSUE_REASONS.NON_STRING_VALUE;
    if (!Object.prototype.hasOwnProperty.call(items, item)) {
        return PLACEMENT_ISSUE_REASONS.UNKNOWN_ITEM;
    }
    return null;
}

/**
 * ⛓⛓⛓ **EVERY STALE ENTRY IN ONE SLOT — the shared validator** (P1; ⚖ user
 * 2026-09-09: *"We can go ahead and implement placement validation if it's
 * easy."*; W3 §10.7 (1) and (2)).
 *
 * `canonical_placements[player]` is the `--canonical-seed` input
 * (`world_generator/extractors.py`), and the JSON schema declares the slot
 * `additionalProperties: true` — a cross-reference between two other blocks of
 * the same document is not something a JSON schema can assert. So this is the
 * assertion, and it is a REPORT rather than a throw, exactly as `validateRules`
 * is: three callers want the list and one of them (the tab) wants to DRAW it.
 *
 * ⛔ **A DELETE IS STILL NOT VALIDATED** — see `opSetCanonicalPlacement`. This
 * function says what is stale; the only gesture the tab can offer for a stale
 * entry is removal, and refusing that would leave the one entry a person needs
 * to remove as the one entry they cannot.
 *
 * ⚠ A slot whose value is not a plain object carries no ENTRIES, so it reports
 * none: the schema's `patternProperties` is the authority on the slot's own
 * type and a second complaint here would be this module inventing one.
 *
 * @param {object} doc
 * @param {string} [player]
 * @returns {Array<{location: string, item: *, reason: string}>} in the
 *   document's own key order, because that is the order the tab and the gate
 *   both print.
 */
export function canonicalPlacementIssues(doc, player = DEFAULT_PLAYER_ID) {
    const p = player ?? DEFAULT_PLAYER_ID;
    const placements = placementsOf(doc, p);
    if (!placements || typeof placements !== 'object' || Array.isArray(placements)) return [];
    const held = new Set(locationsOfPlayer(doc, p).map((l) => l.name));
    const items = itemsOf(doc, p);
    const out = [];
    for (const [location, item] of Object.entries(placements)) {
        const reason = placementIssueReason(location, item, held, items);
        if (reason) out.push({ location, item, reason });
    }
    return out;
}

/**
 * ⛓⛓ **EVERY SLOT OF THE DOCUMENT, EACH ISSUE STAMPED WITH ITS PLAYER** — the
 * shape a whole-document reader needs (the corpus gate; the panel's veto,
 * which differences two documents and must not lose which slot an entry is
 * in).
 *
 * ⛔ The population is the slots `canonical_placements` itself carries, not the
 * slots the document has regions for: a slot with no block has no entry that
 * could be stale, and iterating `regions` instead would make the answer depend
 * on a key this function is not about.
 */
export function canonicalPlacementIssuesByPlayer(doc) {
    const block = doc?.canonical_placements;
    if (!block || typeof block !== 'object' || Array.isArray(block)) return [];
    const out = [];
    for (const player of Object.keys(block)) {
        for (const issue of canonicalPlacementIssues(doc, player)) out.push({ player, ...issue });
    }
    return out;
}

/**
 * ⛓ ONE ISSUE AS A SENTENCE — the panel's refusal, the gate's finding line and
 * a test's expectation all read this, so a person who has seen the wording in
 * one place has seen it in the others.
 */
export function describePlacementIssue(issue) {
    const value = typeof issue.item === 'string' ? issue.item : JSON.stringify(issue.item);
    return `${issue.location} → ${value} — ${issue.reason}`;
}

function opSetCanonicalPlacement(doc, op) {
    const p = playerOf(op);
    const location = op.location;
    if (typeof location !== 'string' || !location) {
        return refuse('apworld: set-canonical-placement needs a location NAME, got '
            + `${JSON.stringify(location)}.`);
    }
    const placements = placementsOf(doc, p);
    const clearing = op.item === undefined || op.item === null || op.item === '';
    if (clearing) {
        if (!Object.prototype.hasOwnProperty.call(placements, location)) {
            return ok(doc, `no canonical placement at ${location}`);
        }
        return ok(setPath(doc, ['canonical_placements', p, location], undefined),
            `unplaced ${location}`);
    }
    // ⛓⛓ THE REFUSALS ARE THE VALIDATOR, ASKED ABOUT ONE ENTRY. The sentences
    //   are this op's — they name what the slot holds, which a report over a
    //   whole corpus has no room for — but WHICH of them fires is
    //   `placementIssueReason`, so a write the tab marks stale cannot be a
    //   write this op accepts (P1).
    const held = locationsOfPlayer(doc, p);
    const items = itemsOf(doc, p);
    const reason = placementIssueReason(location, op.item,
        new Set(held.map((l) => l.name)), items);
    if (reason === PLACEMENT_ISSUE_REASONS.UNKNOWN_LOCATION) {
        return refuse(`apworld: no location "${location}" in slot ${p} — the document holds `
            + `[${listNames(held.map((l) => l.name))}].`);
    }
    if (reason === PLACEMENT_ISSUE_REASONS.NON_STRING_VALUE) {
        return refuse(`apworld: an item name is a string, got ${JSON.stringify(op.item)}.`);
    }
    if (reason === PLACEMENT_ISSUE_REASONS.UNKNOWN_ITEM) {
        return refuse(`apworld: no item "${op.item}" in slot ${p} — the document holds `
            + `[${listNames(Object.keys(items))}].`);
    }
    return ok(setPath(doc, ['canonical_placements', p, location], op.item),
        `placed ${op.item} at ${location}`);
}

/* ── meta ────────────────────────────────────────────────────────────── */

/** ⛓ `{key, value}` — `META_FIELDS` only; an ABSENT `value` DELETES the key. */
function opSetMeta(doc, op) {
    const p = playerOf(op);
    const spec = Object.prototype.hasOwnProperty.call(META_FIELDS, op.key ?? '')
        ? META_FIELDS[op.key] : null;
    if (!spec) {
        return refuse(`apworld: the Meta tab writes [${Object.keys(META_FIELDS).join(', ')}], not `
            + `${JSON.stringify(op.key)}. ⛔ The table is \`META_FIELDS\` and it carries each `
            + 'field\'s PATH, so a new row is one table entry rather than a ninth branch here.');
    }
    const shown = op.value === undefined ? '(absent)' : JSON.stringify(op.value);
    return ok(setPath(doc, spec.path(p), op.value), `${op.key} = ${shown}`);
}

/**
 * ⛓⛓⛓ **ONE TOP-LEVEL KEY OF THE DOCUMENT — the Document tab's whole
 * vocabulary** (APWORLD EDITOR HUB slice H1).
 *
 * `{key, value, scope?, player?}`. `scope: 'document'` (the default) writes
 * `doc[key]`; `scope: 'player'` writes `doc[key][player]`, which is the shape
 * the eighteen slot-map keys have. `value === undefined` DELETES, exactly as
 * `set-meta` does — and for the same reason: that is what the bytes did.
 *
 * ⛓⛓ **THE VALUE IS COPIED AT THE DOOR AND THE OP CARRIES THE RESULT.** It is
 * `applyRulesDocOp`'s `carried()` that does it, once, before dispatch — so the
 * record and the caller's object share nothing and a Document row that keeps
 * editing its own parsed JSON in place cannot write THROUGH the record. That is
 * the defect the first browser run of B-c found on `set-rule-tree`, and this op
 * carries arbitrary JSON for exactly the same reason.
 *
 * ⛔ NO SCHEMA IS READ HERE. Whether a key is per-player is a fact about
 * `rules.schema.json`, and this module is pure and knows nothing about it: the
 * CALLER resolves the scope from the registry (`documentKeys.js`) and the op
 * RECORDS it, so re-folding the edit list reproduces the same document without
 * the schema that was loaded when the edit was made.
 */
function opSetKey(doc, op) {
    const key = op.key;
    if (typeof key !== 'string' || key === '') {
        return refuse(`apworld: set-key needs a top-level key NAME, got ${JSON.stringify(key)}.`);
    }
    const scopeName = op.scope ?? 'document';
    const scope = Object.prototype.hasOwnProperty.call(SET_KEY_SCOPES, scopeName)
        ? SET_KEY_SCOPES[scopeName] : null;
    if (!scope) {
        return refuse(`apworld: set-key scope ${JSON.stringify(op.scope)} is not one of `
            + `[${Object.keys(SET_KEY_SCOPES).join(', ')}]. \`document\` writes the key itself; `
            + '`player` writes the selected slot\'s slice of it.');
    }
    const p = playerOf(op);
    const next = setPath(doc, scope.path(key, p), op.value);
    const where = scopeName === 'player' ? `${key}[${p}]` : key;
    return ok(next, `${where} ${op.value === undefined ? 'deleted' : `= ${describeValue(op.value)}`}`);
}

/** ⛓ A description is a SENTENCE, not a dump: a 2 MB block gets its size. */
function describeValue(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? '' : 's'}]`;
    const n = Object.keys(value).length;
    return `{${n} key${n === 1 ? '' : 's'}}`;
}

/** ⛓ `{region}` — `''`/absent CLEARS. `start_regions[p].default` is a LIST and
 *  the panel edits its first entry; the op writes the list it produced. */
function opSetStartRegion(doc, op) {
    const p = playerOf(op);
    const region = op.region ?? '';
    if (typeof region !== 'string') {
        return refuse(`apworld: a start region is a name or '', got ${JSON.stringify(op.region)}.`);
    }
    const sr = doc.start_regions?.[p] ?? {};
    const next = withKey(sr, 'default', region ? [region] : []);
    return ok(setPath(doc, ['start_regions', p], next),
        region ? `start region = ${region}` : 'start region cleared');
}

/**
 * ⛓ `{condition}` — carries the PARSED tree (the `replace-level` rule: carry
 * the RESULT). ⛔ A raw JSON TEXT in the op would be a recipe whose parse could
 * fail on the fold, and an edit list that cannot be re-folded is not a record.
 */
function opSetCompletionCondition(doc, op) {
    const p = playerOf(op);
    const c = op.condition;
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
        return refuse(`apworld: a completion condition is an object, got ${JSON.stringify(c)}.`);
    }
    return ok(setPath(doc, ['game_info', p, 'completion_condition'], c),
        `completion condition = ${c.type ?? '(untyped)'}`);
}

/* ── rule trees ──────────────────────────────────────────────────────── */

/**
 * ⛓⛓ `{path: {region, kind, index}, tree}` — carries the RESULT TREE, never a
 * gesture.
 *
 * ⛔ `RuleTreeEditor` keeps `ruleTreeOps` for its four gestures — that is where
 * "the node at this path" is expressed — and the SESSION records the tree that
 * came OUT. Recording the gesture instead would mean re-running a
 * path-addressed op on every fold against a tree the person may since have
 * edited through a field closure, which reconstructs a DIFFERENT rule from the
 * one they saw (trap 787's family, and B-b's `replace-level` rule).
 *
 * ⚠ The path is a CLOSED grammar, not an arbitrary deep key list: an op that
 * could set any path would make every other op in this file redundant and
 * nothing about it validatable.
 */
function opSetRuleTree(doc, op) {
    const p = playerOf(op);
    const path = op.path ?? {};
    if (!RULE_TREE_KINDS.includes(path.kind)) {
        return refuse(`apworld: a rule tree hangs off an [${RULE_TREE_KINDS.join(' | ')}], not `
            + `${JSON.stringify(path.kind)}.`);
    }
    const { region, error } = regionOr(doc, p, path.region);
    if (error) return refuse(error);
    const listKey = path.kind === 'exit' ? 'exits' : 'locations';
    const list = region[listKey] ?? [];
    const bad = indexedOr(list, path.index, path.kind, path.region);
    if (bad) return refuse(bad);
    if (!op.tree || typeof op.tree !== 'object' || typeof op.tree.rule !== 'string') {
        return refuse('apworld: an access rule is a Rule Builder node — an object with a '
            + `\`rule\` string, got ${JSON.stringify(op.tree)}.`);
    }
    const next = list.map((e, i) => (i === op.path.index ? withKey(e, 'access_rule', op.tree) : e));
    return ok(
        withRegion(doc, p, path.region, withKey(region, listKey, next)),
        `access rule on ${path.kind} #${path.index} in ${path.region} = ${op.tree.rule}`,
    );
}

/* ── the region's room: payload + rules, atomically ──────────────────── */

/**
 * ⛓⛓⛓ **THE ROOM EDITOR'S ONE OP BACK** (APWORLD EDITOR HUB slice H4b).
 * `{region, payload, rules}` — replace `preset_sidecars[p][region].playable_payload`
 * AND the region's ACCESS RULES, in ONE op, so a whole sub-edit made in the
 * maze lab or the bounce editor folds away with one undo (§4's "one undo stack").
 *
 * ── ⛓ WHY THE RULES ARE A NAME → RULE MAP AND NOT A REGION ────────────
 *
 * The op could have carried the whole rebuilt region entry, and that would have
 * made it a `set-key` with extra steps: an editor could then rename a location,
 * drop an exit or re-place an item through a door whose only mandate is
 * geometry. ⛔ What an edited ROOM may move is the ACCESS RULES — the
 * document's exit TARGETS, its location NAMES and their AP placements are the
 * FILL's, and the fill is not in this document's gift. So the payload arrives
 * whole and the rules arrive as `{exits: {<exit name>: rule}, locations:
 * {<location name>: rule}}`, keyed by the names the document already holds.
 *
 * ── ⛓⛓ THE MAP IS TOTAL, IN BOTH DIRECTIONS, AND THAT IS THE REFUSAL ──
 *
 * ⛔ **A key naming nothing** is a rule for an exit/location this region does
 * not have — the derivation matched something that is not here.
 * ⛔ **A missing key** is the important one: it means THE NEW GEOMETRY NO
 * LONGER HAS a location or an exit the document names, and the fill placed an
 * item at that location. Dropping it silently would delete somebody's item
 * placement inside an op whose description says "room replaced"; the op refuses
 * BY NAME and says what is on the location.
 *
 * ⚠ Totality is checked HERE and not only in the caller, because it is the only
 * thing that makes the op safe to re-fold: an edit list replayed against a
 * document whose region has since been edited must refuse rather than write
 * rules onto the wrong names.
 *
 * ⛓ THE PAYLOAD IS COPIED AT THE DOOR — `applyRulesDocOp`'s `carried()` clones
 * the whole op before dispatch, so a room editor that keeps mutating its own
 * world object cannot write THROUGH the record. That is `set-rule-tree`'s
 * defect (see `carried`), and a room payload is a much bigger object to alias.
 */
function opReplaceRegionSidecar(doc, op) {
    const p = playerOf(op);
    const name = op.region;
    if (typeof name !== 'string' || !name.trim()) {
        return refuse('apworld: replace-region-sidecar needs a region NAME, got '
            + `${JSON.stringify(op.region)}.`);
    }
    const slotSidecars = doc?.preset_sidecars?.[p];
    const sidecar = slotSidecars?.[name];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) {
        return refuse(`apworld: player ${p} has no sidecar for region "${name}", and a region `
            + 'with no sidecar entry has no room to edit. This slot\'s sidecars are '
            + `[${Object.keys(slotSidecars ?? {}).join(', ') || 'none'}].`);
    }
    if (!op.payload || typeof op.payload !== 'object' || Array.isArray(op.payload)) {
        return refuse('apworld: a room payload is an object (the substrate\'s own serialized '
            + `world), got ${Array.isArray(op.payload) ? 'an array' : JSON.stringify(op.payload)}.`);
    }
    const region = regionsOf(doc, p)[name];
    if (!region) {
        return refuse(`apworld: no region "${name}" in \`regions.${p}\` — the sidecar names a `
            + 'region the document does not carry, so there are no rules to move.');
    }
    const rules = op.rules;
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)
        || !isNameMap(rules.exits) || !isNameMap(rules.locations)) {
        return refuse('apworld: replace-region-sidecar needs `rules` as '
            + '`{exits: {<exit name>: rule}, locations: {<location name>: rule}}` — the names '
            + `the DOCUMENT holds, got ${JSON.stringify(rules)}.`);
    }

    const exits = region.exits ?? [];
    const locations = region.locations ?? [];
    for (const [what, list] of [['exit', exits], ['location', locations]]) {
        const seen = new Set();
        for (const e of list) {
            if (seen.has(e?.name)) {
                return refuse(`apworld: region "${name}" holds two ${what}s named `
                    + `"${e.name}", and a name → rule map cannot address either of them. `
                    + 'Rename one first.');
            }
            seen.add(e?.name);
        }
    }

    const missing = [
        ...exits.filter((e) => !(e?.name in rules.exits))
            .map((e) => `exit "${e?.name}" (→ ${e?.connected_region || 'nowhere'})`),
        ...locations.filter((l) => !(l?.name in rules.locations))
            .map((l) => `location "${l?.name}"`
                + (l?.item?.name ? ` (the fill placed "${l.item.name}" there)` : '')),
    ];
    if (missing.length) {
        return refuse(`apworld: the edited room of "${name}" no longer has ${missing.length} `
            + `thing(s) the document names — ${missing.join('; ')}. ⛔ REFUSED rather than `
            + 'dropped: this document is FILLED, and a location that disappears takes an item '
            + 'placement with it. Edit the geometry back, or delete them in the Regions tab '
            + 'first (which is a different op, and one undo of its own).');
    }
    const strayExits = Object.keys(rules.exits).filter((k) => !exits.some((e) => e?.name === k));
    const strayLocs = Object.keys(rules.locations)
        .filter((k) => !locations.some((l) => l?.name === k));
    if (strayExits.length || strayLocs.length) {
        return refuse(`apworld: the rules for "${name}" name things this region does not have — `
            + `${[...strayExits.map((k) => `exit "${k}"`), ...strayLocs.map((k) => `location "${k}"`)]
                .join('; ')}. An edited room may move ACCESS RULES; adding an exit or a `
            + 'location to a filled document is `add-exit` / `add-location`, with an AP id and '
            + 'a pool entry of its own.');
    }

    const withRules = (list, map) => list.map((e) => withKey(e, 'access_rule', map[e.name]));
    const nextRegion = withKey(
        withKey(region, 'exits', withRules(exits, rules.exits)),
        'locations', withRules(locations, rules.locations),
    );
    const next = withRegion(
        setPath(doc, ['preset_sidecars', p, name, 'playable_payload'], op.payload),
        p, name, nextRegion,
    );
    return ok(next, `region ${name}: room replaced (${exits.length} exit rule`
        + `${exits.length === 1 ? '' : 's'}, ${locations.length} location rule`
        + `${locations.length === 1 ? '' : 's'})`);
}

/** ⛓ A `{name: rule}` map — an object, and never an array. */
const isNameMap = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/* ── the whole document ───────────────────────────────────────────────── */

/**
 * ⛓⛓⛓ **THE RAW VIEW'S ONE OP — `{document}` REPLACES THE WHOLE RECORD**
 * (APWORLD EDITOR HUB slice H2).
 *
 * The raw view is a text editor over `JSON.stringify(record, null, 2)`, and a
 * person editing text can move any part of the document at once — rename a
 * region and add a top-level key in the same keystroke run. ⛔ There is no
 * decomposition of that into the other atomic ops, and inventing one would
 * be a diff algorithm whose output nobody typed. So the edit IS the new
 * document, recorded as one op, and one undo folds it away entirely.
 *
 * ⛓⛓ **THE VALUE IS COPIED AT THE DOOR** — `applyRulesDocOp`'s `carried()`
 * clones the whole op before dispatch, so the record and the textarea's parsed
 * object share nothing. Without that, a raw view that re-parses its own text on
 * every keystroke writes THROUGH the record: `equal(record, next)` then sees
 * two identical documents, the session reports a NO-OP for an edit that already
 * happened invisibly, and undo cannot see it either. That is the defect the
 * first browser run of B-c found on `set-rule-tree`, and this op carries a
 * WHOLE document for exactly the same reason.
 *
 * ⛔ NO SCHEMA IS READ HERE, and no `validateRules` either. This module is pure
 * and the op is a replacement, not an edit of a reference: `newValidationError`
 * differences against the document BEING REPLACED, whose errors say nothing
 * about the one arriving. The CALLER (the panel) runs `rulesJsonSchemaErrors`
 * over the candidate and refuses BY PATH before the op is ever built — the
 * `set-key` veto's shape, and for the same reason.
 *
 * ⚠ `player` is ignored on purpose: a whole document is not a slot's slice of
 * one. The panel still stamps the field (`_stampPlayer` stamps every op) and
 * the op records it, which costs nothing and keeps the edit list uniform.
 */
function opReplaceDocument(doc, op) {
    const next = op.document;
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
        return refuse('apworld: replace-document needs a rules document (a JSON object), got '
            + `${Array.isArray(next) ? 'an array' : JSON.stringify(next)}.`);
    }
    const keys = Object.keys(next);
    return ok(next, `document replaced (${keys.length} top-level key`
        + `${keys.length === 1 ? '' : 's'})`);
}

/* ── clear ───────────────────────────────────────────────────────────── */

/**
 * ⛓⛓⛓ **CLEAR IS AN OP, NOT A SESSION BOUNDARY** — and the distinction is
 * where its input comes from.
 *
 * A BOUNDARY is a document that arrived from OUTSIDE: the app published a new
 * `rules.json`, the marking tool handed one over, Reload fetched the one the
 * rest of the app holds. Nothing in the record can express that, and the
 * session's base changes. ⛔ CLEAR INVENTS NO NEW BASE: it is a function of the
 * document being edited — empty the four per-slot containers, keep every other
 * key — so it is expressible, deterministic, and therefore UNDOABLE, which is
 * the whole point of the slice. Spelling it as a boundary would be the one
 * gesture in the panel that destroys work with no way back.
 *
 * ⚠ It carries no payload for the same reason `replace-level` carries one: this
 * recipe cannot reconstruct differently. There is no generator behind it, only
 * four deletions the record already determines.
 */
function opClear(doc, op) {
    const p = playerOf(op);
    let next = withRegions(doc, p, {});
    next = withItems(next, p, {});
    next = withPool(next, p, {});
    next = withStarting(next, p, []);
    return ok(next, `cleared regions/items for player ${p}`);
}

export default applyRulesDocOp;
