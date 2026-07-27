// atlasSession — the region-marking tool's editing model, with no DOM in it.
// (CC/docs/plans/region-atlas-plan.md, Phase 2, Deliverable 2.)
//
// Every mutation the panel offers goes through here, and every rule the atlas
// format has that a UI can enforce BEFORE the validator sees the document is
// enforced here by throwing:
//
//   - '__' is rejected in region and sub-region ids (it is the AP compound
//     separator; letting the validator be the first to notice means the author
//     finds out after naming twenty regions);
//   - an edge exit's `side` is DERIVED from which bounds line its tiles sit on,
//     never typed;
//   - `entrance_tile` must be one of `exit_tiles`, at authoring time;
//   - a region with one sub-region carries no `subgraph` and its exits and
//     locations carry no `sub_region`; once a subgraph exists both are
//     required, and adding or dropping one rewrites the region's exits and
//     locations to match;
//   - `internal_exits[].bidirectional` is always written explicitly — the
//     format forbids a default, because a silently-defaulted direction is the
//     bug the sub-region split exists to prevent;
//   - `annotations.rules_source` is DERIVED, never typed, once any internal
//     exit is analyzer-written (Phase 5a, ruling 2) — every mutation that can
//     change the mix re-syncs it.
//
// The validator remains authoritative (this model can produce a document that
// still fails a cross-reference check, e.g. an unreachable sub-region); this
// layer exists so the common slips are impossible rather than reported.

import {
    validateRegionAtlas,
    stampAtlasIdentity,
    computeAtlasContentHash,
    derivedRulesSource,
    AP_SUBREGION_SEPARATOR,
    DEFAULT_EXIT_SOURCE,
    REGION_ATLAS_SCHEMA_VERSION,
    VALID_EXIT_SOURCES,
} from '../procgenPipeline/regionAtlasValidator.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const isTile = (t) => Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1]);
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];

function requireId(value, what) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${what} must be a non-empty string`);
    if (value.includes(AP_SUBREGION_SEPARATOR)) {
        throw new Error(`${what} must not contain "${AP_SUBREGION_SEPARATOR}" — it is the AP sub-region separator`);
    }
    return value;
}

export function boundsContains(bounds, tile) {
    return tile[0] >= bounds.x && tile[0] <= bounds.x + bounds.w - 1
        && tile[1] >= bounds.y && tile[1] <= bounds.y + bounds.h - 1;
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

/** The tiles of a straight H/V drag between two corners, or null if diagonal. */
export function lineTiles(from, to) {
    if (!isTile(from) || !isTile(to)) return null;
    if (from[0] === to[0]) {
        const [a, b] = [Math.min(from[1], to[1]), Math.max(from[1], to[1])];
        return Array.from({ length: b - a + 1 }, (_, i) => [from[0], a + i]);
    }
    if (from[1] === to[1]) {
        const [a, b] = [Math.min(from[0], to[0]), Math.max(from[0], to[0])];
        return Array.from({ length: b - a + 1 }, (_, i) => [a + i, from[1]]);
    }
    return null;
}

/** The bounds rectangle spanned by two dragged corners (inclusive). */
export function rectBounds(from, to) {
    const x = Math.min(from[0], to[0]);
    const y = Math.min(from[1], to[1]);
    return { x, y, w: Math.abs(to[0] - from[0]) + 1, h: Math.abs(to[1] - from[1]) + 1 };
}

export function createEmptyAtlas({
    game = 'seedling', name = '', description = '', tileSize = 16, mapDocument = null, mapSource = null,
} = {}) {
    // Built in the order the schema documents, so a saved atlas reads
    // top-down: what it is, then where its coordinates live, then the map.
    const atlas = {
        schema_version: REGION_ATLAS_SCHEMA_VERSION,
        atlas_id: game,
        game,
    };
    if (name) atlas.name = name;
    if (description) atlas.description = description;
    atlas.provenance = { generator: 'region-marking-tool' };
    atlas.tile_space = { tile_size: tileSize };
    if (mapSource) atlas.tile_space.map_source = mapSource;
    if (mapDocument) atlas.tile_space.map_document = mapDocument;
    atlas.regions = [];
    atlas.vanilla_layout = { start_region: '', connections: [] };
    return atlas;
}

export class AtlasSession {
    constructor(atlas) {
        this.atlas = atlas ?? createEmptyAtlas();
        // The id the content hash is appended to. Taken from the loaded
        // document with any prior hash stripped, so a save never grows a chain
        // of stale suffixes.
        this.baseId = this._deriveBaseId();
    }

    _deriveBaseId() {
        const id = this.atlas.atlas_id ?? this.atlas.game ?? 'atlas';
        const prior = this.atlas.provenance?.content_hash;
        return typeof prior === 'string' && id.endsWith(`-${prior}`)
            ? id.slice(0, -(prior.length + 1))
            : id;
    }

    // --- lookup ---
    regions() { return this.atlas.regions; }

    region(regionId) {
        const r = this.atlas.regions.find((x) => x.region_id === regionId);
        if (!r) throw new Error(`no region "${regionId}" in this atlas`);
        return r;
    }

    exit(regionId, exitId) {
        const e = this.region(regionId).exits.find((x) => x.exit_id === exitId);
        if (!e) throw new Error(`region "${regionId}" has no exit "${exitId}"`);
        return e;
    }

    subRegions(regionId) { return this.region(regionId).subgraph?.sub_regions ?? null; }

    // --- regions ---
    addRegion({ region_id, name = null, bounds, map_ref = undefined, rules_source = 'manual' }) {
        requireId(region_id, 'region_id');
        if (this.atlas.regions.some((r) => r.region_id === region_id)) {
            throw new Error(`region "${region_id}" already exists`);
        }
        if (!bounds || !Number.isInteger(bounds.x) || !Number.isInteger(bounds.y)
            || !(Number.isInteger(bounds.w) && bounds.w > 0)
            || !(Number.isInteger(bounds.h) && bounds.h > 0)) {
            throw new Error('bounds must be { x, y integers; w, h positive integers }');
        }
        const region = { region_id, bounds: { ...bounds }, exits: [], locations: [], annotations: { rules_source } };
        if (name) region.name = name;
        if (map_ref !== undefined) region.map_ref = map_ref;
        // Keep the authored key order the schema documents.
        const ordered = { region_id: region.region_id };
        if (region.name) ordered.name = region.name;
        ordered.bounds = region.bounds;
        if (map_ref !== undefined) ordered.map_ref = map_ref;
        ordered.exits = region.exits;
        ordered.locations = region.locations;
        ordered.annotations = region.annotations;
        this.atlas.regions.push(ordered);
        return ordered;
    }

    removeRegion(regionId) {
        const i = this.atlas.regions.findIndex((r) => r.region_id === regionId);
        if (i < 0) throw new Error(`no region "${regionId}"`);
        this.atlas.regions.splice(i, 1);
        const layout = this.atlas.vanilla_layout;
        layout.connections = layout.connections.filter((c) => c.from[0] !== regionId && c.to[0] !== regionId);
        if (layout.start_region === regionId) {
            layout.start_region = '';
            delete layout.start_sub_region;
        }
        return this;
    }

    /** Moving or resizing a region can strand its tiles, so this refuses to. */
    setBounds(regionId, bounds) {
        const region = this.region(regionId);
        const stray = [
            ...region.exits.flatMap((e) => e.exit_tiles.map((t) => [`exit "${e.exit_id}"`, t])),
            ...region.locations.map((l) => [`location "${l.name}"`, l.tile]),
        ].filter(([, t]) => !boundsContains(bounds, t));
        if (stray.length > 0) {
            throw new Error(`those bounds would leave ${stray.length} marked tile(s) outside the region (first: ${stray[0][0]})`);
        }
        for (const e of region.exits) {
            if (e.kind !== 'edge') continue;
            const side = deriveEdgeSide(bounds, e.exit_tiles);
            if (!side) throw new Error(`those bounds would take edge exit "${e.exit_id}" off its boundary line`);
            e.side = side;
        }
        region.bounds = { ...bounds };
        return region;
    }

    // --- exits ---
    /**
     * Add a boundary exit. `kind` is derived, not asked for: a run that sits on
     * a bounds line is an edge exit with that side; anything else is a
     * teleporter, whose destination need not be a grid neighbour (plan
     * decision 3).
     */
    addExit(regionId, { exit_id, tiles, entrance_tile = null, sub_region = undefined, name = null, kind = null, access_rule = undefined }) {
        const region = this.region(regionId);
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

        const exit = { exit_id, kind: resolvedKind };
        if (name) exit.name = name;
        if (resolvedKind === 'edge') exit.side = side;
        exit.exit_tiles = tiles.map((t) => [t[0], t[1]]);
        exit.entrance_tile = [entrance[0], entrance[1]];
        this._applySubRegion(region, exit, sub_region, `exit "${exit_id}"`);
        if (access_rule !== undefined) exit.access_rule = access_rule;
        region.exits.push(exit);
        return exit;
    }

    setEntranceTile(regionId, exitId, tile) {
        const exit = this.exit(regionId, exitId);
        if (!isTile(tile) || !exit.exit_tiles.some((t) => sameTile(t, tile))) {
            throw new Error(`entrance_tile [${tile}] must be one of exit "${exitId}"'s tiles`);
        }
        exit.entrance_tile = [tile[0], tile[1]];
        return exit;
    }

    removeExit(regionId, exitId) {
        const region = this.region(regionId);
        const i = region.exits.findIndex((e) => e.exit_id === exitId);
        if (i < 0) throw new Error(`region "${regionId}" has no exit "${exitId}"`);
        region.exits.splice(i, 1);
        this.atlas.vanilla_layout.connections = this.atlas.vanilla_layout.connections
            .filter((c) => !(c.from[0] === regionId && c.from[1] === exitId)
                && !(c.to[0] === regionId && c.to[1] === exitId));
        return this;
    }

    // --- locations ---
    addLocation(regionId, { name, tile, vanilla_item = null, sub_region = undefined, access_rule = undefined }) {
        const region = this.region(regionId);
        if (typeof name !== 'string' || name.length === 0) throw new Error('location name must be a non-empty string');
        const taken = this.atlas.regions.some((r) => (r.locations ?? []).some((l) => l.name === name));
        if (taken) throw new Error(`location name "${name}" is already used — AP location names are global`);
        if (!isTile(tile)) throw new Error('location tile must be an [x, y] pair');
        if (!boundsContains(region.bounds, tile)) throw new Error(`tile [${tile}] lies outside region "${regionId}"`);
        const loc = { name };
        this._applySubRegion(region, loc, sub_region, `location "${name}"`);
        loc.tile = [tile[0], tile[1]];
        if (vanilla_item) loc.vanilla_item = vanilla_item;
        if (access_rule !== undefined) loc.access_rule = access_rule;
        region.locations.push(loc);
        return loc;
    }

    removeLocation(regionId, name) {
        const region = this.region(regionId);
        const i = region.locations.findIndex((l) => l.name === name);
        if (i < 0) throw new Error(`region "${regionId}" has no location "${name}"`);
        region.locations.splice(i, 1);
        return this;
    }

    // --- subgraph ---
    _applySubRegion(region, target, value, what) {
        const subs = region.subgraph?.sub_regions ?? null;
        if (subs === null) {
            if (value !== undefined && value !== null) {
                throw new Error(`${what}: region "${region.region_id}" has no subgraph, so it takes no sub_region`);
            }
            return;
        }
        if (value === undefined || value === null) {
            throw new Error(`${what}: region "${region.region_id}" has a subgraph, so a sub_region is required`);
        }
        if (!subs.includes(value)) throw new Error(`${what}: "${value}" is not a sub-region of "${region.region_id}"`);
        target.sub_region = value;
    }

    /**
     * Declare the region's sub-regions. Passing an empty list (or null) drops
     * the subgraph entirely and strips every `sub_region` — a region with no
     * traversal obstacle carries no boilerplate. Growing a subgraph assigns
     * every existing exit and location to `defaultSub` (the first sub-region
     * unless told otherwise), because the format requires each to name one.
     */
    setSubRegions(regionId, list, { defaultSub = null } = {}) {
        const region = this.region(regionId);
        const subs = (list ?? []).map((s) => requireId(s, 'sub_region'));
        if (new Set(subs).size !== subs.length) throw new Error('sub-region ids must be unique within a region');

        if (subs.length === 0) {
            delete region.subgraph;
            for (const e of region.exits) delete e.sub_region;
            for (const l of region.locations) delete l.sub_region;
            return region;
        }

        const fallback = defaultSub ?? subs[0];
        if (!subs.includes(fallback)) throw new Error(`defaultSub "${fallback}" is not in the new sub-region list`);
        const keep = (current) => (typeof current === 'string' && subs.includes(current) ? current : fallback);
        for (const e of region.exits) e.sub_region = keep(e.sub_region);
        for (const l of region.locations) l.sub_region = keep(l.sub_region);

        const previous = region.subgraph?.internal_exits ?? [];
        region.subgraph = {
            sub_regions: subs,
            // An internal exit whose endpoint disappeared has nothing to mean.
            internal_exits: previous.filter((e) => subs.includes(e.from) && subs.includes(e.to)),
        };
        this._syncRulesSource(region);
        const layout = this.atlas.vanilla_layout;
        if (layout.start_region === regionId && !subs.includes(layout.start_sub_region)) {
            layout.start_sub_region = fallback;
        }
        return region;
    }

    assignSubRegion(regionId, kind, id, subRegionId) {
        const region = this.region(regionId);
        const target = kind === 'exit'
            ? this.exit(regionId, id)
            : region.locations.find((l) => l.name === id);
        if (!target) throw new Error(`region "${regionId}" has no ${kind} "${id}"`);
        this._applySubRegion(region, target, subRegionId, `${kind} "${id}"`);
        return target;
    }

    /** `bidirectional` is required — the format never defaults a direction. */
    addInternalExit(regionId, { from, to, bidirectional, access_rule = undefined, source = undefined }) {
        const region = this.region(regionId);
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
        region.subgraph.internal_exits.push(edge);
        this._syncRulesSource(region);
        return edge;
    }

    /**
     * Edit an existing internal exit's rule and provenance in place — the
     * annotate-a-proposed-crossing move the analyzer's review step needs, and
     * the one mutation the Phase-2 model had no seam for.
     *
     * Passing `access_rule: null` CLEARS the rule (an analyzer proposal the
     * author judged wrong); omitting the key leaves it alone.
     */
    setInternalExitRule(regionId, index, { access_rule, source, bidirectional } = {}) {
        const region = this.region(regionId);
        const list = region.subgraph?.internal_exits;
        if (!list || index < 0 || index >= list.length) throw new Error(`region "${regionId}" has no internal exit #${index}`);
        const edge = list[index];
        if (access_rule !== undefined) {
            if (access_rule === null) delete edge.access_rule;
            else edge.access_rule = access_rule;
        }
        if (source !== undefined) {
            if (!VALID_EXIT_SOURCES.has(source)) {
                throw new Error(`internal exit source must be one of ${[...VALID_EXIT_SOURCES].join('/')} (omit it for "${DEFAULT_EXIT_SOURCE}")`);
            }
            edge.source = source;
        }
        if (bidirectional !== undefined) {
            if (typeof bidirectional !== 'boolean') {
                throw new Error('bidirectional must be a boolean — the format never defaults it');
            }
            edge.bidirectional = bidirectional;
        }
        this._syncRulesSource(region);
        return edge;
    }

    removeInternalExit(regionId, index) {
        const region = this.region(regionId);
        const list = region.subgraph?.internal_exits;
        if (!list || index < 0 || index >= list.length) throw new Error(`region "${regionId}" has no internal exit #${index}`);
        list.splice(index, 1);
        this._syncRulesSource(region);
        return this;
    }

    /**
     * Keep `annotations.rules_source` consistent with the rows (Phase 5a,
     * ruling 2). It is DERIVED once any row is analyzer-written; a region with
     * only hand-authored rows keeps whatever the author declared.
     */
    _syncRulesSource(region) {
        const derived = derivedRulesSource(region);
        const current = region.annotations?.rules_source;
        // No analyzer rows left: the derivation says nothing, EXCEPT that
        // "analyzer" is now false — that word can only have been derived, and a
        // region whose last computed row was taken over by hand is hand-authored.
        // A region the author called "mixed" (its boundary gate was written by
        // hand, say) keeps that word.
        const next = derived ?? (current === 'analyzer' ? DEFAULT_EXIT_SOURCE : null);
        if (next === null) return;
        if (region.annotations == null || typeof region.annotations !== 'object') region.annotations = {};
        region.annotations.rules_source = next;
    }

    // --- vanilla layout ---
    setStart(regionId, subRegionId = null) {
        const region = this.region(regionId);
        const subs = region.subgraph?.sub_regions ?? null;
        this.atlas.vanilla_layout.start_region = regionId;
        if (subs === null) {
            if (subRegionId) throw new Error(`region "${regionId}" has no subgraph, so it takes no start_sub_region`);
            delete this.atlas.vanilla_layout.start_sub_region;
        } else {
            if (!subs.includes(subRegionId)) {
                throw new Error(`start_sub_region "${subRegionId}" is not a sub-region of "${regionId}"`);
            }
            this.atlas.vanilla_layout.start_sub_region = subRegionId;
        }
        return this.atlas.vanilla_layout;
    }

    connect(from, to) {
        const endpoints = [from, to];
        for (const [rid, eid] of endpoints) this.exit(rid, eid);
        if (from[0] === to[0] && from[1] === to[1]) throw new Error('an exit cannot connect to itself');
        for (const [rid, eid] of endpoints) {
            const used = this.atlas.vanilla_layout.connections.some(
                (c) => (c.from[0] === rid && c.from[1] === eid) || (c.to[0] === rid && c.to[1] === eid),
            );
            if (used) throw new Error(`exit "${eid}" of region "${rid}" is already connected`);
        }
        const conn = { from: [from[0], from[1]], to: [to[0], to[1]] };
        this.atlas.vanilla_layout.connections.push(conn);
        return conn;
    }

    disconnect(index) {
        const list = this.atlas.vanilla_layout.connections;
        if (index < 0 || index >= list.length) throw new Error(`no connection #${index}`);
        list.splice(index, 1);
        return this;
    }

    /** Exits with no vanilla_layout connection — what the author still owes. */
    unwiredExits() {
        const wired = new Set(this.atlas.vanilla_layout.connections
            .flatMap((c) => [`${c.from[0]}/${c.from[1]}`, `${c.to[0]}/${c.to[1]}`]));
        return this.atlas.regions.flatMap((r) => r.exits
            .filter((e) => !wired.has(`${r.region_id}/${e.exit_id}`))
            .map((e) => ({ region_id: r.region_id, exit_id: e.exit_id })));
    }

    // --- output ---
    /**
     * The document to write: a stamped clone. Stamping goes through the
     * validator's own stampAtlasIdentity so the hash is never reimplemented,
     * and it is applied to a CLONE so the live session keeps the base id
     * (stamping in place would append a second suffix on the next save).
     */
    toDocument() {
        const doc = clone(this.atlas);
        return stampAtlasIdentity(doc, this.baseId);
    }

    validate(options = {}) {
        return validateRegionAtlas(this.toDocument(), options);
    }

    contentHash() { return computeAtlasContentHash(this.atlas); }
}
