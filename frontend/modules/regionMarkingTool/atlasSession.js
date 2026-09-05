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
//
// ⛓⛓ EDITOR v3 slice D0b — EVERY RULE ABOVE STILL HOLDS, AND NOT ONE OF THEM IS
// SPELLED HERE ANY MORE. The sixteen mutating bodies moved to
// `procgenCore/atlasOps.js` as PURE copy-on-write ops, verbatim, refusal
// messages included; each method below is a one-line delegation that assigns
// `this.atlas`. What that bought: a named op vocabulary an editor can hold,
// log, describe and undo; an input document that is never mutated; and three
// things this class could not do at all — `renameRegion`, `connect` with
// `one_way`, and `unwire` by endpoint. `toDocument()` is byte-identical, which
// is what `check-region-marking-tool` and the playthrough `--check` gate.
//
// ⚠ ONE VISIBLE CONSEQUENCE, AND IT IS THE GOOD KIND. `this.atlas` is now a NEW
// object after every mutation, so a caller holding a reference to the document
// (or to a region inside it) across a mutation sees the OLD one. That is what
// "pure" means and it is why an op layer can have undo at all; the methods
// still return the live node they created or touched, so the marking tool's own
// `const r = session.addRegion(...)` shape is unchanged.
//
// ⛓⛓⛓ EDITOR INTEGRATION slice B-a — AND NOW THE UNDO D0b MADE POSSIBLE EXISTS.
// This class is a wrapper over `editCore.createEditSession` on
// `atlasEditAdapter`: `apply` is the core's, the document is `record()` over
// `base + edits` rather than a field, and `undo()` / `edits()` / `payload()`
// come with it. Not one authoring rule moved and not one refusal sentence
// moved — the adapter forwards `atlasOps`' own text unprefixed, so every string
// this class throws is still the string it threw in Phase 2.
//
// ⛔ AND `toDocument()` IS STILL THE ONLY STAMPING PATH, on a CLONE. The record
// the fold holds is NEVER stamped: `undo()` refolds from the base, and a base
// that had grown a `content_hash` suffix would reconstruct a different document
// every time it was replayed.

import {
    validateRegionAtlas,
    stampAtlasIdentity,
    computeAtlasContentHash,
    REGION_ATLAS_SCHEMA_VERSION,
} from '../procgenPipeline/regionAtlasValidator.js';
import {
    boundsContains,
    deriveEdgeSide,
    unwiredExits,
} from '../procgenCore/atlasOps.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { createAtlasEditAdapter } from './atlasEditAdapter.js';

// Re-exported: both were DEFINED here and the marking tool's renderer, its UI
// and `atlasSession.test.js` have imported them from here since Phase 2. Their
// home is the op module now; this keeps every import site working.
export { boundsContains, deriveEdgeSide };

const clone = (v) => JSON.parse(JSON.stringify(v));
const isTile = (t) => Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1]);

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

/**
 * ⛓⛓⛓ **`game` IS REQUIRED — EDITOR v3 E3b, §26.9.**
 *
 * ⛔ It defaulted to `'seedling'`, and so did `atlas_id`, which took it from
 * `game`. That was harmless while Seedling was the only derivation and a
 * LANDMINE the moment there were two: E2a's maze derivation had to work around
 * it by deriving `game` from the entries' own `substrate`, and a caller that
 * simply forgot would have produced a maze atlas labelled `seedling` — a
 * document that VALIDATES and names the wrong game
 * ([[feedback_fallback_reinstates_the_defect]]).
 *
 * ⚠ THE DEFAULT WAS NOT REPLACED BY A BETTER DEFAULT. There is no substrate
 * this module can guess: the answer is the caller's and the refusal says so.
 */
export function createEmptyAtlas({
    game = null, name = '', description = '', tileSize = 16, mapDocument = null, mapSource = null,
} = {}) {
    if (typeof game !== 'string' || game === '') {
        throw new Error('createEmptyAtlas: `game` is REQUIRED and names the substrate this atlas '
            + `describes, got ${JSON.stringify(game)}. ⛔ It used to default to "seedling" — and `
            + 'so did `atlas_id`, which is built from it — which was harmless while Seedling was '
            + 'the only derivation and silently mislabelled every atlas once there were two. '
            + 'Pass the substrate: `\'seedling\'`, the maze library\'s own entries\' '
            + '`substrate`, or whatever this document is of.');
    }
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
    /**
     * ⚠ **AN EMPTY SESSION NEEDS A `game` TOO, AND IS TOLD SO** (E3b). This
     * used to call `createEmptyAtlas()` with no arguments and get a document
     * labelled `seedling`; now the refusal names the constructor the caller
     * actually has to reach for, because the alternative — a default here —
     * would be the same landmine one layer up.
     */
    constructor(atlas, { levelView = null, base = null, certified = null } = {}) {
        if (atlas === undefined || atlas === null) {
            throw new Error('AtlasSession: no atlas was given, and an EMPTY one cannot be built '
                + 'without naming its `game` (E3b — `createEmptyAtlas` no longer defaults it to '
                + '"seedling"). Pass a document, or `new AtlasSession(createEmptyAtlas({game}))`.');
        }
        this.baseAtlas = atlas;
        /**
         * ⛓⛓ **A LEVEL VIEW IS OPTIONAL, AND THE DEFAULT REFUSES BY NAME.**
         *
         * ⛔ Not a stub. `bounds`/`readCell` are the CELL half of the adapter
         * contract, and the atlas's cell space belongs to the MAP document, not
         * to this class — every one of the nine callers that opens a session
         * headlessly (both derivations, the starter, the playthrough, the
         * verifier) has no level and asks nothing about cells. Handing them a
         * `bounds` of `{w: 0, h: 0}` would answer a question they never ask
         * with a rectangle that does not exist; the panel, which HAS a level
         * picker, passes its own.
         */
        this.adapter = createAtlasEditAdapter({
            levelView: levelView ?? (() => null),
        });
        this._session = createEditSession(this.adapter, atlas, {
            /**
             * ⛓ §3.2's TAG for the document this session OPENED — the atlas's
             * own id, so a payload names what its edits are relative to. The
             * core carries it opaquely and never reads it.
             */
            base: base ?? { kind: 'atlas', atlas_id: atlas.atlas_id ?? null },
            certified,
        });
        this.baseId = this.deriveBaseId();
    }

    /**
     * ⛓⛓⛓ **THE DOCUMENT IS THE FOLD, NOT A FIELD.** It was `this.atlas =
     * result.atlas` after every op; it is now `record()` over `base + edits`,
     * which is what makes `undo()` the fold over a shorter list rather than a
     * stack pop. Every reader is unchanged — `session.atlas.regions`,
     * `session.atlas.vanilla_layout`, `session.atlas.game` all still answer the
     * live document.
     *
     * ⚠ **A CALLER MAY STILL MUTATE IT IN PLACE, AND FIVE DO** — the playthrough
     * producer's analysis pass, the starter's, the verifier's Phase G reference
     * (`applySeedlingRegionAnalysis(session.atlas, …)`). Those writes land on
     * the record the fold is currently holding, so `toDocument()` sees them and
     * the bytes are unmoved; what they are INVISIBLE to is `undo()`, which
     * refolds from the base. That is exactly why the panel's seven escape
     * hatches become ops — see §13. There is no setter: reassigning the
     * document would give the fold a second writer.
     */
    get atlas() { return this._session.record(); }

    /**
     * The id the content hash is appended to, read off the CURRENT document
     * with any prior hash stripped, so a save never grows a chain of stale
     * suffixes.
     *
     * ⛓ **PUBLIC SINCE B-a, AND IT IS NOT DERIVED FROM `game`.** Measured: the
     * committed `seedling-fixture.json` has `game: "seedling"` and an
     * `atlas_id` stem of `seedling-fixture`, so a `set-game` that also moved
     * `atlas_id` would RENAME the starter atlas. `baseId` therefore stays a
     * FIELD a page may move (the marking tool does, when the author retypes
     * `game` on a document whose id came from it) — and a page that moved it
     * re-reads this after undoing that op, because the document is back to
     * saying what its stem is.
     */
    deriveBaseId() {
        const id = this.atlas.atlas_id ?? this.atlas.game ?? 'atlas';
        const prior = this.atlas.provenance?.content_hash;
        return typeof prior === 'string' && id.endsWith(`-${prior}`)
            ? id.slice(0, -(prior.length + 1))
            : id;
    }

    /**
     * ⛔ THE ONE SEAM. Apply an op, adopt its document, hand back its value —
     * and THROW its refusal, because that is what every caller of this class
     * has been written against since Phase 2 and the messages are pinned by
     * `atlasSession.test.js` and by the tool's own error copy.
     */
    apply(op) {
        const result = this._session.apply(op);
        // ⛔ THE REFUSAL IS THE OP MODULE'S OWN SENTENCE, unchanged: the adapter
        //   forwards it unprefixed and the core hands it back verbatim for an
        //   atomic op, which is what keeps the strings this class throws the
        //   ones `atlasSession.test.js` and the tool's error copy pin.
        if (!result.ok) throw new Error(result.description);
        this.lastDescription = result.description;
        // ⛓ The node the op created or touched — see `takeLastValue` in the
        //   adapter for why the core's session cannot carry it.
        return this.adapter.takeLastValue();
    }

    /**
     * ⛓⛓ **UNDO IS THE FOLD OVER A SHORTER LIST**, the core's law (a): the
     * document after an undo is the one a session that never had that op would
     * hold, byte for byte. Returns `false` at zero edits and changes nothing,
     * so a toolbar button can call it unconditionally.
     */
    undo() { return this._session.undo(); }

    /** ⛓ The op list, oldest first — what `payload().edits` carries. */
    edits() { return this._session.ops(); }

    /** ⛓ §3.2's IDENTITY, as data: `{base, edits, certified}`. */
    payload() { return this._session.payload(); }

    get certified() { return this._session.certified; }

    setCertified(v) { return this._session.setCertified(v); }

    /* ⛓⛓ B-a — THE SEVEN THAT USED TO BE INSPECTOR FIELDS WRITING STRAIGHT
     * INTO THE DOCUMENT. Same one-line delegation shape as the other sixteen;
     * what they buy is that undo can see them. */

    setGame(game) { return this.apply({ op: 'set-game', game }); }

    setName(name) { return this.apply({ op: 'set-name', name }); }

    setRegionName(regionId, name) {
        return this.apply({ op: 'set-region-name', region: regionId, name });
    }

    setRulesSource(regionId, source) {
        return this.apply({ op: 'set-rules-source', region: regionId, rules_source: source });
    }

    /** ⛓ `null` CLEARS the rule; omitting it is refused (see the op). */
    setExitRule(regionId, exitId, accessRule) {
        return this.apply({
            op: 'set-exit-rule', region: regionId, exit: exitId, access_rule: accessRule,
        });
    }

    setLocationItem(regionId, name, item) {
        return this.apply({ op: 'set-location-item', region: regionId, name, vanilla_item: item });
    }

    /** ⛓ The analyzer's proposal, committed as ONE op — see `applyAnalysis`. */
    applyAnalysis(analysis) { return this.apply({ op: 'apply-analysis', analysis }); }

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
    addRegion(spec) { return this.apply({ op: 'add-region', ...spec }); }

    removeRegion(regionId) {
        this.apply({ op: 'remove-region', region: regionId });
        return this;
    }

    /**
     * ⛓ NEW IN D0b — see `atlasOps.renameRegion` for why the collision refusal
     * is the whole point (the AP id allocator DEDUPES by name, so two regions
     * sharing an id collapse silently rather than collide loudly).
     */
    renameRegion(from, to) { return this.apply({ op: 'rename-region', from, to }); }

    /** Moving or resizing a region can strand its tiles, so this refuses to. */
    setBounds(regionId, bounds) { return this.apply({ op: 'set-bounds', region: regionId, bounds }); }

    // --- exits ---
    /**
     * Add a boundary exit. `kind` is derived, not asked for: a run that sits on
     * a bounds line is an edge exit with that side; anything else is a
     * teleporter, whose destination need not be a grid neighbour (plan
     * decision 3).
     */
    addExit(regionId, spec) { return this.apply({ op: 'add-exit', region: regionId, ...spec }); }

    setEntranceTile(regionId, exitId, tile) {
        return this.apply({ op: 'set-entrance-tile', region: regionId, exit: exitId, tile });
    }

    removeExit(regionId, exitId) {
        this.apply({ op: 'remove-exit', region: regionId, exit: exitId });
        return this;
    }

    // --- locations ---
    addLocation(regionId, spec) { return this.apply({ op: 'add-location', region: regionId, ...spec }); }

    removeLocation(regionId, name) {
        this.apply({ op: 'remove-location', region: regionId, name });
        return this;
    }

    // --- subgraph ---
    /**
     * Declare the region's sub-regions. Passing an empty list (or null) drops
     * the subgraph entirely and strips every `sub_region` — a region with no
     * traversal obstacle carries no boilerplate. Growing a subgraph assigns
     * every existing exit and location to `defaultSub` (the first sub-region
     * unless told otherwise), because the format requires each to name one.
     */
    setSubRegions(regionId, list, { defaultSub = null } = {}) {
        return this.apply({ op: 'set-sub-regions', region: regionId, sub_regions: list, defaultSub });
    }

    assignSubRegion(regionId, kind, id, subRegionId) {
        return this.apply({
            op: 'assign-sub-region', region: regionId, kind, id, sub_region: subRegionId,
        });
    }

    /** `bidirectional` is required — the format never defaults a direction. */
    addInternalExit(regionId, spec) {
        return this.apply({ op: 'add-internal-exit', region: regionId, ...spec });
    }

    /**
     * Edit an existing internal exit's rule and provenance — the
     * annotate-a-proposed-crossing move the analyzer's review step needs, and
     * the one mutation the Phase-2 model had no seam for.
     *
     * Passing `access_rule: null` CLEARS the rule (an analyzer proposal the
     * author judged wrong); omitting the key leaves it alone.
     */
    setInternalExitRule(regionId, index, spec = {}) {
        return this.apply({ op: 'set-internal-exit-rule', region: regionId, index, ...spec });
    }

    removeInternalExit(regionId, index) {
        this.apply({ op: 'remove-internal-exit', region: regionId, index });
        return this;
    }

    // --- vanilla layout ---
    setStart(regionId, subRegionId = null) {
        return this.apply({ op: 'set-start', region: regionId, sub_region: subRegionId });
    }

    /**
     * ⛓ `one_way` IS CARRIED NOW (D0b). Absent means undirected, which is what
     * every caller written before R7 meant and what the format defaults to —
     * so this signature is a widening, not a change.
     */
    connect(from, to, { one_way } = {}) {
        return this.apply({ op: 'connect', from, to, one_way });
    }

    disconnect(index) {
        this.apply({ op: 'disconnect', index });
        return this;
    }

    /** ⛓ NEW IN D0b — disconnect by ENDPOINT, the question an editor asks. */
    unwire(regionId, exitId) { return this.apply({ op: 'unwire', region: regionId, exit: exitId }); }

    /** Exits with no vanilla_layout connection — what the author still owes. */
    unwiredExits() { return unwiredExits(this.atlas); }

    // --- output ---
    /**
     * The document to write: a stamped clone. Stamping goes through the
     * validator's own stampAtlasIdentity so the hash is never reimplemented,
     * and it is applied to a CLONE so the live session keeps the base id
     * (stamping in place would append a second suffix on the next save).
     *
     * ⛔ The clone is KEPT even though the ops are pure: `stampAtlasIdentity`
     * writes `provenance.content_hash` and `atlas_id` IN PLACE, so handing it
     * `this.atlas` directly would stamp the live session. D0a's identity module
     * is load-bearing for ten committed ids and this is not the path to change
     * that on.
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
