/**
 * procgenCore/atlasOps — every region-atlas mutation as a PURE
 * copy-on-write op (EDITOR v3 slice D0b; §15 gaps 4–5, §16.2).
 *
 * ── WHAT THIS REPLACED ─────────────────────────────────────────────────
 *
 * `regionMarkingTool/atlasSession.js`'s sixteen mutating methods. They were
 * correct — `removeRegion`/`removeExit`/`setSubRegions` really do rewrite the
 * references they orphan — but they MUTATED `this.atlas` in place, never cloned
 * the constructor's input, and had no vocabulary a caller could hold, name,
 * describe, log or undo. `AtlasSession` is now a thin wrapper over these ops
 * (its methods are one-line delegations that assign `this.atlas`), which is
 * what lets D1's set adapter reuse atlas editing instead of writing a third
 * copy of it.
 *
 * ── THE THREE THINGS THE SESSION COULD NOT DO, AND NOW CAN ─────────────
 *
 *   ·  `rename-region` — ZERO hits before this slice. It rewrites
 *      `vanilla_layout.connections` and `start_region`, and REFUSES BY NAME on
 *      a collision (see the docblock on `renameRegion` for why a collision is
 *      the interesting case and not a cosmetic one).
 *   ·  `connect { one_way }` — the session paired endpoints undirected only,
 *      which is why `make-seedling-playthrough-rules.mjs` BYPASSED it and
 *      assigned `vanilla_layout.connections` wholesale to carry `one_way: true`
 *      on all 312. That bypass is deleted.
 *   ·  `unwire { region, exit }` — disconnect by ENDPOINT rather than by array
 *      index, which is the question an editor actually asks ("this exit goes
 *      nowhere now").
 *
 * ── ⛔⛔ COPY-ON-WRITE MEANS STRUCTURAL SHARING, NOT `JSON.parse(JSON.stringify(…))`
 *
 * The input document is NEVER mutated — `assertAdapterBehaviour`'s law 3 for
 * the adapter D1 builds on top. But a whole-document clone per op is not a
 * detail: the playthrough atlas is 271 KB and its build applies ~1,100 ops, so
 * cloning per op is quadratic. Each op therefore rebuilds only the spine from
 * the root to what it changed and SHARES every untouched node.
 *
 * ⚠ AND THE SPREADS ARE KEY-ORDER-EXACT ON PURPOSE. `{...region, exits: […]}`
 * overwrites an EXISTING key in place and appends a NEW one at the end —
 * exactly what the in-place assignments did. The atlas is byte-gated
 * (`verify-region-marking-tool`, the playthrough `--check`), and key order is
 * part of those bytes, so a spread that re-ordered keys would be a silent
 * regeneration of every committed atlas.
 *
 * ── THE CONTRACT ───────────────────────────────────────────────────────
 *
 *   applyAtlasOp(atlas, op) -> { ok: true,  atlas, value, description }
 *                           -> { ok: false, atlas, error }
 *
 * `atlas` on a refusal is the INPUT, unchanged. `value` is the node the op
 * created or touched, a live reference INTO the returned document — which is
 * what `AtlasSession`'s methods returned before and what their callers use.
 * The refusal messages are the session's own, verbatim: they are pinned by
 * `atlasSession.test.js` and by the region-marking tool's UI copy.
 *
 * ── ⚠ A BOUND THIS SLICE NAMES RATHER THAN FIXES ───────────────────────
 *
 * This is the FIRST `procgenCore/` module to import from `procgenPipeline/`
 * (measured: zero others do), and `regionAtlasValidator.js` imports two
 * `procgenCore/` modules the other way. It is not a module cycle — the
 * validator reaches `contentIdentity`/`jsonSchemaCheck`, which are leaves — but
 * it IS a directory-level inversion, and it exists because the atlas's shared
 * VOCABULARY (`AP_SUBREGION_SEPARATOR`, the exit-source set, `derivedRulesSource`)
 * lives in the validator. Duplicating it here would be a second spelling of the
 * contract this directory exists to keep single, which is worse. Re-homing that
 * vocabulary into the core is a real change with its own blast radius (the
 * validator has many importers) and belongs to whoever owns the adapter, not to
 * a slice whose job is to move bodies without moving bytes. Named here so the
 * next reader does not have to rediscover it.
 */

import {
    AP_SUBREGION_SEPARATOR,
    DEFAULT_EXIT_SOURCE,
    VALID_EXIT_SOURCES,
    derivedRulesSource,
} from '../procgenPipeline/regionAtlasValidator.js';

// ── shared predicates (the session's own, unchanged) ──────────────────────

const isTile = (t) => Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1]);
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];

export function boundsContains(bounds, tile) {
    return tile[0] >= bounds.x && tile[0] <= bounds.x + bounds.w - 1
        && tile[1] >= bounds.y && tile[1] <= bounds.y + bounds.h - 1;
}

function requireId(value, what) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${what} must be a non-empty string`);
    if (value.includes(AP_SUBREGION_SEPARATOR)) {
        throw new Error(`${what} must not contain "${AP_SUBREGION_SEPARATOR}" — it is the AP sub-region separator`);
    }
    return value;
}

/**
 * Which side of `bounds` a run of tiles lies on, or null if it is not a
 * straight contiguous run along exactly one bounds line. y grows DOWNWARD, so
 * N is the minimum-y row. This is what makes an edge exit a drag rather than a
 * dropdown: the geometry already says which side it is.
 */
export function deriveEdgeSide(bounds, tiles) {
    if (!Array.isArray(tiles) || tiles.length === 0 || !tiles.every(isTile)) return null;
    if (!tiles.every((t) => boundsContains(bounds, t))) return null;
    const xs = new Set(tiles.map((t) => t[0]));
    const ys = new Set(tiles.map((t) => t[1]));
    const contiguous = (values) => {
        const run = [...values].sort((a, b) => a - b);
        return run.every((v, i) => i === 0 || v === run[i - 1] + 1);
    };
    // Both branches are tried: a SINGLE tile is a valid run in either
    // orientation, so short-circuiting on the horizontal reading would report
    // "not on a boundary" for a one-tile exit sitting on the east edge.
    if (ys.size === 1 && contiguous(xs)) {
        const y = [...ys][0];
        if (y === bounds.y) return 'N';
        if (y === bounds.y + bounds.h - 1) return 'S';
    }
    if (xs.size === 1 && contiguous(ys)) {
        const x = [...xs][0];
        if (x === bounds.x) return 'W';
        if (x === bounds.x + bounds.w - 1) return 'E';
    }
    return null;
}

// ── structural-sharing helpers ────────────────────────────────────────────

const regionIndexOf = (atlas, regionId) => atlas.regions.findIndex((r) => r.region_id === regionId);

function findRegion(atlas, regionId) {
    const i = regionIndexOf(atlas, regionId);
    if (i < 0) throw new Error(`no region "${regionId}" in this atlas`);
    return i;
}

/** A new atlas whose region at `index` is `region`; every other node shared. */
const withRegionAt = (atlas, index, region) => ({
    ...atlas,
    regions: atlas.regions.map((r, i) => (i === index ? region : r)),
});

/** A new atlas whose `vanilla_layout` is `layout`; every region shared. */
const withLayout = (atlas, layout) => ({ ...atlas, vanilla_layout: layout });

/** `{...obj, [key]: value}` with the key DROPPED when `value === undefined`. */
function withKey(obj, key, value) {
    if (value !== undefined) return { ...obj, [key]: value };
    const { [key]: _dropped, ...rest } = obj;
    return rest;
}

/**
 * Keep `annotations.rules_source` consistent with the rows (Phase 5a, ruling
 * 2). DERIVED once any row is analyzer-written; a region with only
 * hand-authored rows keeps whatever the author declared. Returns the region,
 * possibly the same object.
 */
function syncedRulesSource(region) {
    const derived = derivedRulesSource(region);
    const current = region.annotations?.rules_source;
    // No analyzer rows left: the derivation says nothing, EXCEPT that
    // "analyzer" is now false — that word can only have been derived, and a
    // region whose last computed row was taken over by hand is hand-authored.
    // A region the author called "mixed" (its boundary gate was written by
    // hand, say) keeps that word.
    const next = derived ?? (current === 'analyzer' ? DEFAULT_EXIT_SOURCE : null);
    if (next === null) return region;
    const annotations = region.annotations != null && typeof region.annotations === 'object'
        ? region.annotations : {};
    return { ...region, annotations: { ...annotations, rules_source: next } };
}

/**
 * Attach (or refuse) a `sub_region` on an exit/location of `region`. Returns
 * the target with the field set, or the target unchanged when the region has
 * no subgraph.
 */
function withSubRegion(region, target, value, what) {
    const subs = region.subgraph?.sub_regions ?? null;
    if (subs === null) {
        if (value !== undefined && value !== null) {
            throw new Error(`${what}: region "${region.region_id}" has no subgraph, so it takes no sub_region`);
        }
        return target;
    }
    if (value === undefined || value === null) {
        throw new Error(`${what}: region "${region.region_id}" has a subgraph, so a sub_region is required`);
    }
    if (!subs.includes(value)) throw new Error(`${what}: "${value}" is not a sub-region of "${region.region_id}"`);
    return { ...target, sub_region: value };
}

// ── the ops ───────────────────────────────────────────────────────────────
//
// Each returns `{ atlas, value, description }` and THROWS its refusal; the one
// public entry point below turns a throw into `{ ok: false, error }`. Keeping
// the refusals as throws is what let the sixteen bodies move verbatim, messages
// included — and those messages are pinned by `atlasSession.test.js`.

function addRegion(atlas, {
    region_id, name = null, bounds, map_ref = undefined,
    substrate = undefined, rules_source = 'manual',
}) {
    requireId(region_id, 'region_id');
    if (atlas.regions.some((r) => r.region_id === region_id)) {
        throw new Error(`region "${region_id}" already exists`);
    }
    if (!bounds || !Number.isInteger(bounds.x) || !Number.isInteger(bounds.y)
        || !(Number.isInteger(bounds.w) && bounds.w > 0)
        || !(Number.isInteger(bounds.h) && bounds.h > 0)) {
        throw new Error('bounds must be { x, y integers; w, h positive integers }');
    }
    // Keep the authored key order the schema documents.
    const ordered = { region_id };
    if (name) ordered.name = name;
    ordered.bounds = { ...bounds };
    if (map_ref !== undefined) ordered.map_ref = map_ref;
    // ⛓ WHICH SUBSTRATE PLAYS THIS REGION (EDITOR INTEGRATION W1) — carried
    // ONLY when the caller names one. This op rebuilds the region from a fixed
    // param set rather than spreading the spec, so an unnamed key is DROPPED,
    // and both atlas derivations write this field through here. Omitted when
    // absent so every atlas authored before the field is byte-identical: the
    // compiler reads absence as "this compile's default", which is exactly what
    // those documents meant.
    if (substrate !== undefined) ordered.substrate = substrate;
    ordered.exits = [];
    ordered.locations = [];
    ordered.annotations = { rules_source };
    return {
        atlas: { ...atlas, regions: [...atlas.regions, ordered] },
        value: ordered,
        description: `add region "${region_id}"`,
    };
}

function removeRegion(atlas, { region: regionId }) {
    const i = regionIndexOf(atlas, regionId);
    if (i < 0) throw new Error(`no region "${regionId}"`);
    const layout = atlas.vanilla_layout;
    let nextLayout = {
        ...layout,
        connections: layout.connections.filter((c) => c.from[0] !== regionId && c.to[0] !== regionId),
    };
    if (nextLayout.start_region === regionId) {
        nextLayout = withKey({ ...nextLayout, start_region: '' }, 'start_sub_region', undefined);
    }
    return {
        atlas: {
            ...atlas,
            regions: atlas.regions.filter((_, x) => x !== i),
            vanilla_layout: nextLayout,
        },
        value: null,
        description: `remove region "${regionId}"`,
    };
}

/**
 * ⛓⛓ **RENAME, AND WHY THE COLLISION REFUSAL IS THE POINT.**
 *
 * A region id is the AP REGION NAME (`apRegionName`), and the compiler
 * allocates AP ids from those names through `allocateIdsBySortedName`, which
 * **DEDUPES** (D0a §18.9, hard #1). So renaming `a` onto an existing `b` does
 * not produce a loud duplicate: it produces TWO atlas regions that quietly
 * collapse into ONE AP region, with one of them silently losing its exits and
 * locations downstream. A dedupe upstream of a name that has to be unique is a
 * collision the pipeline cannot see, so this op refuses instead.
 *
 * ⚠ AND ONE THING THE BRIEF PREDICTED THAT MEASUREMENT DID NOT BEAR OUT.
 * §18.9 expected `rename-region` to be "the first thing that can produce a
 * duplicate LOCATION name in memory". It cannot: `regionAtlasCompiler.js:376`
 * allocates location ids from `loc.name` ALONE — the region id is not part of
 * a location's AP name — so renaming a region moves no location name at all.
 * The location post-condition below is kept anyway, as the guard a future
 * rename-with-relabel would need, and it is pinned by a row that hands it an
 * atlas that already violates it — because a check nothing can reach is a
 * check nobody knows is broken.
 */
function renameRegion(atlas, { from, to }) {
    requireId(to, 'region_id');
    const i = regionIndexOf(atlas, from);
    if (i < 0) throw new Error(`no region "${from}"`);
    if (from === to) throw new Error(`region "${from}" already has that id`);
    if (atlas.regions.some((r) => r.region_id === to)) {
        throw new Error(`cannot rename "${from}" to "${to}" — a region with that id already `
            + 'exists, and the AP projection allocates ids by NAME with dedup, so the two would '
            + 'collapse into one region rather than collide');
    }
    const renamed = { ...atlas.regions[i], region_id: to };
    // ⛔ POST-CONDITION, not a pre-condition: it asks about the document the op
    //   is about to return, so it stays true of whatever the op learns to move.
    const names = [];
    for (const region of atlas.regions.map((r, x) => (x === i ? renamed : r))) {
        for (const loc of region.locations ?? []) names.push(loc.name);
    }
    const dup = names.find((n, x) => names.indexOf(n) !== x);
    if (dup !== undefined) {
        throw new Error(`renaming "${from}" to "${to}" would leave two locations named "${dup}" `
            + '— AP location names are global and the id allocator dedupes them');
    }
    const layout = atlas.vanilla_layout;
    const endpoint = (e) => (e[0] === from ? [to, e[1]] : e);
    const nextLayout = {
        ...layout,
        ...(layout.start_region === from ? { start_region: to } : {}),
        connections: layout.connections.map((c) => {
            const nf = endpoint(c.from);
            const nt = endpoint(c.to);
            return nf === c.from && nt === c.to ? c : { ...c, from: nf, to: nt };
        }),
    };
    return {
        atlas: { ...withRegionAt(atlas, i, renamed), vanilla_layout: nextLayout },
        value: renamed,
        description: `rename region "${from}" to "${to}"`,
    };
}

/** Moving or resizing a region can strand its tiles, so this refuses to. */
function setBounds(atlas, { region: regionId, bounds }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const stray = [
        ...region.exits.flatMap((e) => e.exit_tiles.map((t) => [`exit "${e.exit_id}"`, t])),
        ...region.locations.map((l) => [`location "${l.name}"`, l.tile]),
    ].filter(([, t]) => !boundsContains(bounds, t));
    if (stray.length > 0) {
        throw new Error(`those bounds would leave ${stray.length} marked tile(s) outside the region (first: ${stray[0][0]})`);
    }
    const exits = region.exits.map((e) => {
        if (e.kind !== 'edge') return e;
        const side = deriveEdgeSide(bounds, e.exit_tiles);
        if (!side) throw new Error(`those bounds would take edge exit "${e.exit_id}" off its boundary line`);
        return { ...e, side };
    });
    const next = { ...region, bounds: { ...bounds }, exits };
    return {
        atlas: withRegionAt(atlas, i, next),
        value: next,
        description: `set bounds of region "${regionId}"`,
    };
}

/**
 * Add a boundary exit. `kind` is derived, not asked for: a run that sits on a
 * bounds line is an edge exit with that side; anything else is a teleporter,
 * whose destination need not be a grid neighbour (plan decision 3).
 */
function addExit(atlas, {
    region: regionId, exit_id, tiles, entrance_tile = null,
    sub_region = undefined, name = null, kind = null, access_rule = undefined,
}) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    if (typeof exit_id !== 'string' || exit_id.length === 0) throw new Error('exit_id must be a non-empty string');
    if (region.exits.some((e) => e.exit_id === exit_id)) {
        throw new Error(`region "${regionId}" already has an exit "${exit_id}"`);
    }
    if (!Array.isArray(tiles) || tiles.length === 0 || !tiles.every(isTile)) {
        throw new Error('exit tiles must be a non-empty array of [x, y] pairs');
    }
    const outside = tiles.find((t) => !boundsContains(region.bounds, t));
    if (outside) throw new Error(`tile [${outside}] lies outside region "${regionId}"`);

    const side = deriveEdgeSide(region.bounds, tiles);
    const resolvedKind = kind ?? (side ? 'edge' : 'teleporter');
    if (resolvedKind === 'edge' && !side) {
        throw new Error('an edge exit must be a straight contiguous run along one of the region\'s bounds lines');
    }

    const entrance = entrance_tile ?? tiles[Math.floor((tiles.length - 1) / 2)];
    if (!tiles.some((t) => sameTile(t, entrance))) {
        throw new Error(`entrance_tile [${entrance}] must be one of the exit's tiles`);
    }

    let exit = { exit_id, kind: resolvedKind };
    if (name) exit.name = name;
    if (resolvedKind === 'edge') exit.side = side;
    exit.exit_tiles = tiles.map((t) => [t[0], t[1]]);
    exit.entrance_tile = [entrance[0], entrance[1]];
    exit = withSubRegion(region, exit, sub_region, `exit "${exit_id}"`);
    if (access_rule !== undefined) exit.access_rule = access_rule;
    const next = { ...region, exits: [...region.exits, exit] };
    return {
        atlas: withRegionAt(atlas, i, next),
        value: exit,
        description: `add ${resolvedKind} exit "${exit_id}" to region "${regionId}"`,
    };
}

function setEntranceTile(atlas, { region: regionId, exit: exitId, tile }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const ei = region.exits.findIndex((e) => e.exit_id === exitId);
    if (ei < 0) throw new Error(`region "${regionId}" has no exit "${exitId}"`);
    const exit = region.exits[ei];
    if (!isTile(tile) || !exit.exit_tiles.some((t) => sameTile(t, tile))) {
        throw new Error(`entrance_tile [${tile}] must be one of exit "${exitId}"'s tiles`);
    }
    const nextExit = { ...exit, entrance_tile: [tile[0], tile[1]] };
    const next = { ...region, exits: region.exits.map((e, x) => (x === ei ? nextExit : e)) };
    return {
        atlas: withRegionAt(atlas, i, next),
        value: nextExit,
        description: `set entrance tile of exit "${exitId}" in region "${regionId}"`,
    };
}

function removeExit(atlas, { region: regionId, exit: exitId }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const ei = region.exits.findIndex((e) => e.exit_id === exitId);
    if (ei < 0) throw new Error(`region "${regionId}" has no exit "${exitId}"`);
    const next = { ...region, exits: region.exits.filter((_, x) => x !== ei) };
    const layout = atlas.vanilla_layout;
    const nextLayout = {
        ...layout,
        connections: layout.connections
            .filter((c) => !(c.from[0] === regionId && c.from[1] === exitId)
                && !(c.to[0] === regionId && c.to[1] === exitId)),
    };
    return {
        atlas: { ...withRegionAt(atlas, i, next), vanilla_layout: nextLayout },
        value: null,
        description: `remove exit "${exitId}" from region "${regionId}"`,
    };
}

function addLocation(atlas, {
    region: regionId, name, tile, vanilla_item = null, sub_region = undefined, access_rule = undefined,
}) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    if (typeof name !== 'string' || name.length === 0) throw new Error('location name must be a non-empty string');
    const taken = atlas.regions.some((r) => (r.locations ?? []).some((l) => l.name === name));
    if (taken) throw new Error(`location name "${name}" is already used — AP location names are global`);
    if (!isTile(tile)) throw new Error('location tile must be an [x, y] pair');
    if (!boundsContains(region.bounds, tile)) throw new Error(`tile [${tile}] lies outside region "${regionId}"`);
    let loc = { name };
    loc = withSubRegion(region, loc, sub_region, `location "${name}"`);
    loc.tile = [tile[0], tile[1]];
    if (vanilla_item) loc.vanilla_item = vanilla_item;
    if (access_rule !== undefined) loc.access_rule = access_rule;
    const next = { ...region, locations: [...region.locations, loc] };
    return {
        atlas: withRegionAt(atlas, i, next),
        value: loc,
        description: `add location "${name}" to region "${regionId}"`,
    };
}

function removeLocation(atlas, { region: regionId, name }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const li = region.locations.findIndex((l) => l.name === name);
    if (li < 0) throw new Error(`region "${regionId}" has no location "${name}"`);
    const next = { ...region, locations: region.locations.filter((_, x) => x !== li) };
    return {
        atlas: withRegionAt(atlas, i, next),
        value: null,
        description: `remove location "${name}" from region "${regionId}"`,
    };
}

/**
 * Declare the region's sub-regions. Passing an empty list (or null) drops the
 * subgraph entirely and strips every `sub_region` — a region with no traversal
 * obstacle carries no boilerplate. Growing a subgraph assigns every existing
 * exit and location to `defaultSub` (the first sub-region unless told
 * otherwise), because the format requires each to name one.
 */
function setSubRegions(atlas, { region: regionId, sub_regions, defaultSub = null }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const subs = (sub_regions ?? []).map((s) => requireId(s, 'sub_region'));
    if (new Set(subs).size !== subs.length) throw new Error('sub-region ids must be unique within a region');

    if (subs.length === 0) {
        const { subgraph: _dropped, ...bare } = region;
        const next = {
            ...bare,
            exits: region.exits.map((e) => withKey(e, 'sub_region', undefined)),
            locations: region.locations.map((l) => withKey(l, 'sub_region', undefined)),
        };
        return {
            atlas: withRegionAt(atlas, i, next),
            value: next,
            description: `drop the subgraph of region "${regionId}"`,
        };
    }

    const fallback = defaultSub ?? subs[0];
    if (!subs.includes(fallback)) throw new Error(`defaultSub "${fallback}" is not in the new sub-region list`);
    const keep = (current) => (typeof current === 'string' && subs.includes(current) ? current : fallback);
    const previous = region.subgraph?.internal_exits ?? [];
    let next = {
        ...region,
        exits: region.exits.map((e) => ({ ...e, sub_region: keep(e.sub_region) })),
        locations: region.locations.map((l) => ({ ...l, sub_region: keep(l.sub_region) })),
        subgraph: {
            sub_regions: subs,
            // An internal exit whose endpoint disappeared has nothing to mean.
            internal_exits: previous.filter((e) => subs.includes(e.from) && subs.includes(e.to)),
        },
    };
    next = syncedRulesSource(next);
    const layout = atlas.vanilla_layout;
    const nextLayout = layout.start_region === regionId && !subs.includes(layout.start_sub_region)
        ? { ...layout, start_sub_region: fallback }
        : layout;
    return {
        atlas: { ...withRegionAt(atlas, i, next), vanilla_layout: nextLayout },
        value: next,
        description: `set the sub-regions of region "${regionId}" to ${subs.join(', ')}`,
    };
}

function assignSubRegion(atlas, { region: regionId, kind, id, sub_region }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const list = kind === 'exit' ? region.exits : region.locations;
    const key = kind === 'exit' ? 'exit_id' : 'name';
    const ti = list.findIndex((t) => t[key] === id);
    if (kind === 'exit' && ti < 0) throw new Error(`region "${regionId}" has no exit "${id}"`);
    if (ti < 0) throw new Error(`region "${regionId}" has no ${kind} "${id}"`);
    const target = withSubRegion(region, list[ti], sub_region, `${kind} "${id}"`);
    const nextList = list.map((t, x) => (x === ti ? target : t));
    const next = kind === 'exit' ? { ...region, exits: nextList } : { ...region, locations: nextList };
    return {
        atlas: withRegionAt(atlas, i, next),
        value: target,
        description: `assign ${kind} "${id}" of region "${regionId}" to sub-region "${sub_region}"`,
    };
}

/** `bidirectional` is required — the format never defaults a direction. */
function addInternalExit(atlas, {
    region: regionId, from, to, bidirectional, access_rule = undefined, source = undefined,
}) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const subs = region.subgraph?.sub_regions;
    if (!subs) throw new Error(`region "${regionId}" has no subgraph — declare its sub-regions first`);
    for (const [key, value] of [['from', from], ['to', to]]) {
        if (!subs.includes(value)) throw new Error(`internal exit ${key} "${value}" is not a sub-region of "${regionId}"`);
    }
    if (from === to) throw new Error('an internal exit cannot connect a sub-region to itself');
    if (typeof bidirectional !== 'boolean') {
        throw new Error('bidirectional must be given explicitly (a one-way drop is false) — the format never defaults it');
    }
    const edge = { from, to, bidirectional };
    if (source !== undefined) {
        if (!VALID_EXIT_SOURCES.has(source)) {
            throw new Error(`internal exit source must be one of ${[...VALID_EXIT_SOURCES].join('/')} (omit it for "${DEFAULT_EXIT_SOURCE}")`);
        }
        edge.source = source;
    }
    if (access_rule !== undefined) edge.access_rule = access_rule;
    const next = syncedRulesSource({
        ...region,
        subgraph: { ...region.subgraph, internal_exits: [...region.subgraph.internal_exits, edge] },
    });
    return {
        atlas: withRegionAt(atlas, i, next),
        value: edge,
        description: `add internal exit ${from} ${bidirectional ? '<->' : '->'} ${to} in region "${regionId}"`,
    };
}

/**
 * Edit an existing internal exit's rule and provenance — the
 * annotate-a-proposed-crossing move the analyzer's review step needs, and the
 * one mutation the Phase-2 model had no seam for.
 *
 * Passing `access_rule: null` CLEARS the rule (an analyzer proposal the author
 * judged wrong); omitting the key leaves it alone.
 */
function setInternalExitRule(atlas, {
    region: regionId, index, access_rule, source, bidirectional,
}) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const list = region.subgraph?.internal_exits;
    if (!list || index < 0 || index >= list.length) throw new Error(`region "${regionId}" has no internal exit #${index}`);
    let edge = list[index];
    if (access_rule !== undefined) {
        edge = access_rule === null
            ? withKey(edge, 'access_rule', undefined)
            : { ...edge, access_rule };
    }
    if (source !== undefined) {
        if (!VALID_EXIT_SOURCES.has(source)) {
            throw new Error(`internal exit source must be one of ${[...VALID_EXIT_SOURCES].join('/')} (omit it for "${DEFAULT_EXIT_SOURCE}")`);
        }
        edge = { ...edge, source };
    }
    if (bidirectional !== undefined) {
        if (typeof bidirectional !== 'boolean') {
            throw new Error('bidirectional must be a boolean — the format never defaults it');
        }
        edge = { ...edge, bidirectional };
    }
    const next = syncedRulesSource({
        ...region,
        subgraph: {
            ...region.subgraph,
            internal_exits: list.map((e, x) => (x === index ? edge : e)),
        },
    });
    return {
        atlas: withRegionAt(atlas, i, next),
        value: edge,
        description: `edit internal exit #${index} of region "${regionId}"`,
    };
}

function removeInternalExit(atlas, { region: regionId, index }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const list = region.subgraph?.internal_exits;
    if (!list || index < 0 || index >= list.length) throw new Error(`region "${regionId}" has no internal exit #${index}`);
    const next = syncedRulesSource({
        ...region,
        subgraph: { ...region.subgraph, internal_exits: list.filter((_, x) => x !== index) },
    });
    return {
        atlas: withRegionAt(atlas, i, next),
        value: null,
        description: `remove internal exit #${index} of region "${regionId}"`,
    };
}

function setStart(atlas, { region: regionId, sub_region = null }) {
    const i = findRegion(atlas, regionId);
    const region = atlas.regions[i];
    const subs = region.subgraph?.sub_regions ?? null;
    let layout = { ...atlas.vanilla_layout, start_region: regionId };
    if (subs === null) {
        if (sub_region) throw new Error(`region "${regionId}" has no subgraph, so it takes no start_sub_region`);
        layout = withKey(layout, 'start_sub_region', undefined);
    } else {
        if (!subs.includes(sub_region)) {
            throw new Error(`start_sub_region "${sub_region}" is not a sub-region of "${regionId}"`);
        }
        layout = { ...layout, start_sub_region: sub_region };
    }
    return {
        atlas: withLayout(atlas, layout),
        value: layout,
        description: `set the start to region "${regionId}"${sub_region ? ` sub-region "${sub_region}"` : ''}`,
    };
}

/** The endpoint-is-used test both `connect` and `unwire` are written over. */
const wires = (c, rid, eid) => (c.from[0] === rid && c.from[1] === eid)
    || (c.to[0] === rid && c.to[1] === eid);

/**
 * Pair two exits in `vanilla_layout`.
 *
 * ⛓ `one_way` IS CARRIED — the field `regionAtlasCompiler.js:340` reads and the
 * whole reason `make-seedling-playthrough-rules.mjs` used to bypass this layer.
 * ABSENT means undirected, which is the format's own default and what every
 * atlas written before R7 meant. The each-endpoint-once law is unchanged: an
 * exit is one door, and a door that appeared in two connections would be two
 * different doors sharing a tile.
 */
function connect(atlas, { from, to, one_way = undefined }) {
    for (const [rid, eid] of [from, to]) {
        const i = regionIndexOf(atlas, rid);
        if (i < 0) throw new Error(`no region "${rid}" in this atlas`);
        if (!atlas.regions[i].exits.some((e) => e.exit_id === eid)) {
            throw new Error(`region "${rid}" has no exit "${eid}"`);
        }
    }
    if (from[0] === to[0] && from[1] === to[1]) throw new Error('an exit cannot connect to itself');
    for (const [rid, eid] of [from, to]) {
        if (atlas.vanilla_layout.connections.some((c) => wires(c, rid, eid))) {
            throw new Error(`exit "${eid}" of region "${rid}" is already connected`);
        }
    }
    if (one_way !== undefined && typeof one_way !== 'boolean') {
        throw new Error('one_way must be a boolean when given (omit it for an undirected connection)');
    }
    const conn = { from: [from[0], from[1]], to: [to[0], to[1]] };
    if (one_way !== undefined) conn.one_way = one_way;
    const layout = atlas.vanilla_layout;
    return {
        atlas: withLayout(atlas, { ...layout, connections: [...layout.connections, conn] }),
        value: conn,
        description: `connect ${from[0]}/${from[1]} ${one_way ? '->' : '<->'} ${to[0]}/${to[1]}`,
    };
}

function disconnect(atlas, { index }) {
    const layout = atlas.vanilla_layout;
    if (index < 0 || index >= layout.connections.length) throw new Error(`no connection #${index}`);
    return {
        atlas: withLayout(atlas, { ...layout, connections: layout.connections.filter((_, x) => x !== index) }),
        value: null,
        description: `disconnect connection #${index}`,
    };
}

/**
 * Disconnect by ENDPOINT rather than by array index — "this exit goes nowhere
 * now", which is the question an editor asks and the index form cannot answer
 * without the caller scanning for it first. REFUSES when the exit is not wired,
 * because a silent no-op reads as "unwired it" to a caller that never checked.
 */
function unwire(atlas, { region: regionId, exit: exitId }) {
    const layout = atlas.vanilla_layout;
    const index = layout.connections.findIndex((c) => wires(c, regionId, exitId));
    if (index < 0) {
        throw new Error(`exit "${exitId}" of region "${regionId}" is not wired by vanilla_layout.connections`);
    }
    return {
        atlas: withLayout(atlas, { ...layout, connections: layout.connections.filter((_, x) => x !== index) }),
        value: layout.connections[index],
        description: `unwire ${regionId}/${exitId}`,
    };
}

// ── the vocabulary ────────────────────────────────────────────────────────

const OPS = Object.freeze({
    'add-region': addRegion,
    'remove-region': removeRegion,
    'rename-region': renameRegion,
    'set-bounds': setBounds,
    'add-exit': addExit,
    'set-entrance-tile': setEntranceTile,
    'remove-exit': removeExit,
    'add-location': addLocation,
    'remove-location': removeLocation,
    'set-sub-regions': setSubRegions,
    'assign-sub-region': assignSubRegion,
    'add-internal-exit': addInternalExit,
    'set-internal-exit-rule': setInternalExitRule,
    'remove-internal-exit': removeInternalExit,
    'set-start': setStart,
    connect,
    disconnect,
    unwire,
});

/** Every op kind this module understands, sorted. The refusals read this. */
export const ATLAS_OP_KINDS = Object.freeze(Object.keys(OPS).sort());

/**
 * Apply one op to an atlas document, PURELY.
 *
 * @param {object} atlas the document; never mutated
 * @param {{op: string}} op the op, `{op: <kind>, ...fields}`
 * @returns {{ok: true, atlas: object, value: any, description: string}
 *          | {ok: false, atlas: object, error: string}}
 */
export function applyAtlasOp(atlas, op) {
    if (atlas == null || typeof atlas !== 'object' || !Array.isArray(atlas.regions)
        || atlas.vanilla_layout == null || !Array.isArray(atlas.vanilla_layout.connections)) {
        return {
            ok: false,
            atlas,
            error: 'atlasOps: the first argument must be a region atlas document '
                + '({ regions: [...], vanilla_layout: { connections: [...] } })',
        };
    }
    const kind = op?.op;
    const fn = Object.hasOwn(OPS, kind) ? OPS[kind] : null;
    if (!fn) {
        return {
            ok: false,
            atlas,
            error: `atlasOps: no op "${kind}" — the vocabulary is ${ATLAS_OP_KINDS.join(', ')}`,
        };
    }
    try {
        const { atlas: next, value, description } = fn(atlas, op);
        return { ok: true, atlas: next, value, description };
    } catch (e) {
        return { ok: false, atlas, error: e.message };
    }
}

/** Apply a list of ops in order, stopping at the first refusal. */
export function applyAtlasOps(atlas, ops) {
    let current = atlas;
    const descriptions = [];
    for (const [i, op] of ops.entries()) {
        const result = applyAtlasOp(current, op);
        if (!result.ok) return { ok: false, atlas, error: `op #${i} (${op?.op}): ${result.error}`, descriptions };
        current = result.atlas;
        descriptions.push(result.description);
    }
    return { ok: true, atlas: current, descriptions };
}

/** Exits with no vanilla_layout connection — what the author still owes. */
export function unwiredExits(atlas) {
    const wired = new Set(atlas.vanilla_layout.connections
        .flatMap((c) => [`${c.from[0]}/${c.from[1]}`, `${c.to[0]}/${c.to[1]}`]));
    return atlas.regions.flatMap((r) => r.exits
        .filter((e) => !wired.has(`${r.region_id}/${e.exit_id}`))
        .map((e) => ({ region_id: r.region_id, exit_id: e.exit_id })));
}
