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
    'set-meta',
    'set-start-region',
    'set-completion-condition',
    'set-rule-tree',
    'clear',
]);

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
        case 'set-meta': return opSetMeta(doc, op);
        case 'set-start-region': return opSetStartRegion(doc, op);
        case 'set-completion-condition': return opSetCompletionCondition(doc, op);
        case 'set-rule-tree': return opSetRuleTree(doc, op);
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
