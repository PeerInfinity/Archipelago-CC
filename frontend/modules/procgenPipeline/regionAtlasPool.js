// Region-atlas → SPHERE-GROWTH content pool
// (CC/docs/plans/region-atlas-plan.md, Phase 6).
//
// Phase 5b projects an atlas region into playable maze worlds so the REAL game
// map can be walked with nothing but the committed repo. This module turns that
// projection into a **content pool**: the document sphere growth reads when it
// is asked to place pre-built regions of a real game inside a world it grows.
//
// --- why this is its own document kind -------------------------------------
//
// The region library (regionLibraryValidator.js) has two capture contracts:
//
//   'procedural' (maze)      payload only; rules are RE-DERIVED from geometry
//                            at instantiate time, so they can never go stale.
//   'content'    (bounce…)   geometry can't be re-derived, so the entry carries
//                            its emitted rules verbatim.
//
// An atlas pool is a THIRD contract: **payload plus AUTHORED rules**. The
// geometry is re-derivable (it is a tile world), but its access rules must NOT
// be — they are rows a human or the Phase-5a analyzer wrote into the atlas, and
// the atlas is the single source of truth for them (the two-truths rule). So an
// entry carries the projected payload AND, per exit, the atlas row's own
// `access_rule`. Re-deriving those from the projected geometry would silently
// promote the projection's fidelity fences into logic.
//
// It is also not a library in the interchangeable-content sense: a library entry
// is a reusable chunk that may be placed many times, while an atlas entry is a
// SPECIFIC PLACE in a specific game. Two copies of Seedling's starting house in
// one world would duplicate its location identity, so an entry is placed AT MOST
// ONCE per world (see buildSphereAtlasSource in procgenPipelineEngine.js).
//
// --- what an entry is -------------------------------------------------------
//
// One entry per AP (sub-)region the maze projection emitted — the same unit the
// `seedling_atlas_maze` preset ships as a `preset_sidecars` entry. It carries:
//
//   payload      the projected maze world (verbatim from the projection)
//   exits        every OUTBOUND crossing/boundary exit, with the atlas's own
//                authored `access_rule` for it (null = free)
//   entrances    every way IN, with what the real game charges to come that way.
//                This is what the Phase-6 sorter reads: a region's intrinsic
//                entry requirement is the cost of its cheapest entrance, and
//                that requirement becomes its sphere gate.
//   locations    the atlas's own location names (ruling 3 — they keep them)
//
// Entrances are NOT the same list as exits: crossing A→B and crossing B→A can
// cost different items (Seedling's waterfall: free down, a Feather back up), and
// the analyzer emits each direction as its own atlas row. Coming INTO a
// sub-region costs whatever the row pointing AT it costs.
//
// Deterministic and rng-free: everything is emitted in projection order, so the
// committed pool carries an exact `--check` regeneration gate.
//
// Headless-safe: no top-level await, no literal node: imports.

import { stableStringify } from './regionAtlasValidator.js';

export const ATLAS_POOL_SCHEMA_VERSION = 1;

/** The pseudo-substrate id a sphere quota uses for a game's atlas pool. */
export const ATLAS_SOURCE_PREFIX = 'atlas:';

/** `atlas:seedling` — the quota/source id for a game's atlas pool. */
export const atlasSourceId = (game) => `${ATLAS_SOURCE_PREFIX}${game}`;

/** Is `id` an atlas content-source id rather than a registered substrate? */
export const isAtlasSourceId = (id) =>
    typeof id === 'string' && id.startsWith(ATLAS_SOURCE_PREFIX);

/**
 * The game an atlas source id names — and therefore the
 * `growthParams.substrateConfig` key its document rides on (plan decision 5:
 * `substrateConfig['<game>'].atlasDoc`, the same seam jta datasets use).
 */
export const atlasSourceGame = (id) =>
    (isAtlasSourceId(id) ? id.slice(ATLAS_SOURCE_PREFIX.length) : null);

// --- content-hash identity (mirrors regionAtlasValidator / library) ----------

function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

export function computePoolContentHash(pool) {
    const content = { ...pool };
    delete content.provenance;
    delete content.pool_id;
    return fnv1a32(stableStringify(content));
}

/** Stamp `provenance.content_hash` + the hash-suffixed `pool_id` in place. */
export function stampPoolIdentity(pool, baseId = null) {
    const hash = computePoolContentHash(pool);
    let base = baseId ?? pool.pool_id ?? 'atlas-pool';
    if (baseId == null) {
        const prior = pool.provenance?.content_hash;
        if (typeof prior === 'string' && base.endsWith(`-${prior}`)) {
            base = base.slice(0, -(prior.length + 1));
        }
    }
    pool.pool_id = `${base}-${hash}`;
    pool.provenance = { ...(pool.provenance ?? {}), content_hash: hash };
    return pool;
}

// --- the v1 entry-rule vocabulary -------------------------------------------

/**
 * Reduce a Rule Builder tree to the sphere grower's gate vocabulary: a
 * CONJUNCTION OF SINGLE-INSTANCE `Has` terms. Returns an array of item names
 * (possibly empty = "free"), or `null` when the rule says something the gate
 * representation cannot carry.
 *
 * The fence is the gate representation's, not the atlas's (Phase-6 ruling 4):
 * a sphere gate is `{ gate: [item…], gateCounts }` and `sphereGateRule` ANDs one
 * `Has` per item, so an OR ("the lock opens with the Wand or the Fire Wand") has
 * no faithful encoding — and a wrong encoding would either over-gate the world
 * or break the oracle. Counts are excluded for the same reason a sphere gate's
 * count is DERIVED from the plan's cumulative instance table: an atlas row's
 * `Has(x, 2)` means "two of the game's own x", which is not the same statement
 * as the grower's "the second instance, through sphere k".
 *
 * Widening this is its own change (the sorter would need disjunctive gates and
 * `computeItemSpheres` would have to agree); until then a region whose only way
 * in is an OR is DECLINED and named, never silently over- or under-gated.
 */
export function conjunctiveHasTerms(rule) {
    if (rule == null) return [];
    if (typeof rule !== 'object') return null;
    if (rule.rule === 'True_') return [];
    if (rule.rule === 'Has') {
        const name = rule.args?.item_name;
        if (typeof name !== 'string' || name.length === 0) return null;
        const count = rule.args?.count;
        if (count != null && count !== 1) return null; // counts: out of vocabulary
        return [name];
    }
    if (rule.rule === 'And') {
        const out = [];
        for (const child of rule.children ?? []) {
            const terms = conjunctiveHasTerms(child);
            if (terms === null) return null;
            out.push(...terms);
        }
        return [...new Set(out)];
    }
    return null; // Or, Compare, Count*, False_, anything else
}

// --- pool construction -------------------------------------------------------

const CROSSING_PREFIX = 'cross_';

/** Split a projected exit's `atlas_exit_id` into what the atlas calls it. */
function classifyAtlasExitId(atlasExitId) {
    return typeof atlasExitId === 'string' && atlasExitId.startsWith(CROSSING_PREFIX)
        ? { kind: 'crossing', target: atlasExitId.slice(CROSSING_PREFIX.length) }
        : { kind: 'boundary', target: null };
}

/**
 * The atlas's OWN rule for one directed internal crossing `from -> to`.
 * Mirrors regionAtlasMazeProjection's planCrossings: a bidirectional row serves
 * both directions with the same rule, an asymmetric crossing is two rows, and
 * the FIRST row for a direction stands.
 */
function crossingRule(region, from, to) {
    for (const row of region.subgraph?.internal_exits ?? []) {
        if (row.from === from && row.to === to) return row.access_rule ?? null;
        if (row.bidirectional === true && row.from === to && row.to === from) {
            return row.access_rule ?? null;
        }
    }
    return null;
}

/** The atlas's own rule for one BOUNDARY exit. */
function boundaryRule(region, exitId) {
    return (region.exits ?? []).find((e) => e.exit_id === exitId)?.access_rule ?? null;
}

/**
 * Build the sphere content pool for an atlas from its MAZE projection.
 *
 * @param {object} atlas   the authored region atlas
 * @param {object} rules   the rules.json `compileRegionAtlas(atlas, {sidecarFlavor:'maze'})`
 *                         produced — its `preset_sidecars` are the projected worlds
 * @param {object} [opts]  { playerId = '1' }
 * @returns {{ pool: object, notes: Array<{kind:string, message:string}> }}
 */
export function buildAtlasPool(atlas, rules, opts = {}) {
    const playerId = opts.playerId ?? '1';
    const sidecars = rules?.preset_sidecars?.[playerId] ?? null;
    if (!sidecars) {
        throw new Error('buildAtlasPool: the compiled rules.json carries no preset_sidecars — '
            + 'compile the atlas with the MAZE flavour (region-atlas-compile.mjs --maze) first');
    }

    const notes = [];
    // Which atlas (sub-)region a sidecar came from is stamped IN the payload by
    // the projection (atlas_region / atlas_sub_region), so the pool never has to
    // re-derive the binding from the AP name's `__` split.
    const entries = [];
    for (const [apName, sidecar] of Object.entries(sidecars)) {
        const payload = sidecar?.playable_payload;
        if (sidecar?.substrate !== 'maze' || !payload) {
            notes.push({
                kind: 'skipped_flavor',
                message: `sidecar "${apName}" is substrate "${sidecar?.substrate}" — only the maze `
                    + 'projection can be placed by sphere growth, so it is not in the pool',
            });
            continue;
        }
        const regionId = payload.atlas_region;
        const sub = payload.atlas_sub_region ?? null;
        const region = (atlas.regions ?? []).find((r) => r.region_id === regionId);
        if (!region) {
            throw new Error(`buildAtlasPool: sidecar "${apName}" names atlas region `
                + `"${regionId}", which the atlas does not contain`);
        }

        const exits = (payload.exits ?? []).map((e) => {
            const cls = classifyAtlasExitId(e.atlas_exit_id);
            return {
                exit_id: e.exit_id,
                atlas_exit_id: e.atlas_exit_id ?? e.exit_id,
                kind: cls.kind,
                ...(cls.kind === 'crossing' ? { to_sub_region: cls.target } : {}),
                tile: { x: e.x, y: e.y },
                is_teleporter: !!e.isTeleporter,
                access_rule: cls.kind === 'crossing'
                    ? crossingRule(region, sub, cls.target)
                    : boundaryRule(region, e.atlas_exit_id ?? e.exit_id),
            };
        });

        entries.push({
            entry_id: apName,
            atlas_region: regionId,
            atlas_sub_region: sub,
            substrate: 'maze',
            region_size: { width: payload.width, height: payload.height },
            entrance_tile: { x: payload.entrance.x, y: payload.entrance.y },
            exits,
            // entrances are filled in below: an inbound crossing's rule lives in
            // the SOURCE sub-region's row, so it needs every entry to exist first.
            entrances: [],
            locations: (payload.items ?? []).map((it) => ({
                name: it.locationName,
                vanilla_item: it.id,
            })),
            location_slots: (payload.items ?? []).length,
            payload,
        });
    }

    // --- entrances: every way IN, and what the real game charges for it ------
    for (const entry of entries) {
        // A wired boundary exit is a two-way frontier: its own `access_rule` is
        // the intrinsic gate decision 5 hands the sorter.
        for (const ex of entry.exits) {
            if (ex.kind !== 'boundary') continue;
            entry.entrances.push({
                via: ex.exit_id,
                atlas_exit_id: ex.atlas_exit_id,
                kind: 'boundary',
                access_rule: ex.access_rule,
            });
        }
    }
    for (const source of entries) {
        for (const ex of source.exits) {
            if (ex.kind !== 'crossing') continue;
            const target = entries.find((e) => e.atlas_region === source.atlas_region
                && e.atlas_sub_region === ex.to_sub_region);
            if (!target) {
                notes.push({
                    kind: 'crossing_target_missing',
                    message: `"${source.entry_id}" crosses into sub-region `
                        + `"${ex.to_sub_region}", which the projection did not emit`,
                });
                continue;
            }
            target.entrances.push({
                via: ex.exit_id,
                atlas_exit_id: ex.atlas_exit_id,
                kind: 'crossing',
                from_entry: source.entry_id,
                access_rule: ex.access_rule,
            });
        }
    }
    // Stable order regardless of which pass filled a row.
    for (const entry of entries) {
        entry.entrances.sort((a, b) => a.via.localeCompare(b.via));
        if (entry.entrances.length === 0) {
            notes.push({
                kind: 'no_entrance',
                message: `"${entry.entry_id}" has no projected way in (every boundary exit is `
                    + 'unwired and no crossing points at it) — it cannot be placed',
            });
        }
    }

    const pool = {
        schema_version: ATLAS_POOL_SCHEMA_VERSION,
        pool_id: `${atlas.game}-atlas-pool`,
        atlas_id: atlas.atlas_id,
        game: atlas.game,
        flavor: 'maze',
        ...(atlas.tile_space?.map_document
            ? { map_document: atlas.tile_space.map_document } : {}),
        entries,
    };
    stampPoolIdentity(pool, `${atlas.game}-atlas-pool`);
    return { pool, notes };
}

// --- validation --------------------------------------------------------------

/**
 * Structural + cross-reference checks on a pool document. The pool is generated,
 * not authored, so this is a gate on the GENERATOR (and on a hand edit) rather
 * than an authoring aid: an entry that lies about its payload would place a
 * region the engine cannot realise.
 */
export function validateAtlasPool(pool) {
    const errors = [];
    const warnings = [];
    const fail = (m) => errors.push(m);

    if (pool == null || typeof pool !== 'object') {
        return { ok: false, errors: ['pool is not an object'], warnings };
    }
    if (pool.schema_version !== ATLAS_POOL_SCHEMA_VERSION) {
        fail(`schema_version must be ${ATLAS_POOL_SCHEMA_VERSION}, got ${pool.schema_version}`);
    }
    for (const key of ['pool_id', 'atlas_id', 'game']) {
        if (typeof pool[key] !== 'string' || pool[key].length === 0) {
            fail(`${key} must be a non-empty string`);
        }
    }
    if (pool.flavor !== 'maze') fail(`flavor must be 'maze' (got ${JSON.stringify(pool.flavor)})`);
    if (!Array.isArray(pool.entries)) {
        fail('entries must be an array');
        return { ok: false, errors, warnings };
    }
    if (pool.entries.length === 0) warnings.push('pool has no entries');

    const hash = computePoolContentHash(pool);
    if (pool.provenance?.content_hash !== hash) {
        fail(`provenance.content_hash ${pool.provenance?.content_hash} != computed ${hash} — `
            + 'the document was edited after stamping; regenerate it');
    } else if (!pool.pool_id.endsWith(`-${hash}`)) {
        fail(`pool_id "${pool.pool_id}" does not end in its content hash "${hash}"`);
    }

    const seen = new Set();
    for (const entry of pool.entries) {
        const id = entry?.entry_id;
        if (typeof id !== 'string' || id.length === 0) {
            fail('an entry has no entry_id');
            continue;
        }
        if (seen.has(id)) fail(`duplicate entry_id "${id}"`);
        seen.add(id);
        if (entry.substrate !== 'maze') fail(`entry "${id}": substrate must be 'maze'`);
        const p = entry.payload;
        if (p == null || typeof p !== 'object') {
            fail(`entry "${id}": payload must be an object`);
            continue;
        }
        if (entry.region_size?.width !== p.width || entry.region_size?.height !== p.height) {
            fail(`entry "${id}": region_size contradicts the payload `
                + `(${entry.region_size?.width}x${entry.region_size?.height} vs ${p.width}x${p.height})`);
        }
        if (entry.location_slots !== (p.items ?? []).length) {
            fail(`entry "${id}": location_slots ${entry.location_slots} contradicts the payload's `
                + `${(p.items ?? []).length} item slot(s)`);
        }
        const payloadExitIds = new Set((p.exits ?? []).map((e) => e.exit_id));
        for (const ex of entry.exits ?? []) {
            if (!payloadExitIds.has(ex.exit_id)) {
                fail(`entry "${id}": exit "${ex.exit_id}" is not in the payload`);
            }
        }
        if ((entry.exits ?? []).length !== payloadExitIds.size) {
            fail(`entry "${id}": ${entry.exits?.length} exit row(s) for ${payloadExitIds.size} `
                + 'payload exit(s) — the pool is stale against its projection');
        }
        // The exit-id invariant Phase 5b pinned: a maze payload's exit_id IS its
        // exitName. Sphere placement resolves arrivals through exitName, so a
        // divergence here silently sends every arrival to the entrance tile.
        for (const e of p.exits ?? []) {
            if (e.exitName !== e.exit_id) {
                fail(`entry "${id}": payload exit "${e.exit_id}" has exitName `
                    + `"${e.exitName}" — a maze payload's exit_id IS its exitName`);
            }
        }
        for (const loc of entry.locations ?? []) {
            if (typeof loc.name !== 'string' || loc.name.length === 0) {
                fail(`entry "${id}": a location slot has no name`);
            }
        }
        if ((entry.entrances ?? []).length === 0) {
            warnings.push(`entry "${id}" has no way in and can never be placed`);
        }
    }

    return { ok: errors.length === 0, errors, warnings };
}

/**
 * The intrinsic entry requirement of one pool entry, in the grower's gate
 * vocabulary — the Phase-6 sorter's input.
 *
 * The chosen entrance is the CHEAPEST expressible one (fewest required items,
 * ties broken by the entrance's own id so the choice is deterministic and
 * reproducible), because that is the earliest sphere the region could honestly
 * open in; a stronger entrance would over-gate a place the real game lets you
 * into sooner. Entrances whose rule is outside the v1 vocabulary are skipped and
 * REPORTED, and an entry with no expressible entrance is DECLINED — never forced
 * in behind an invented gate.
 *
 * @returns {{ entry_id, gate: string[]|null, via: string|null, declined: string|null }}
 */
export function entryRequirement(entry) {
    const rejected = [];
    let best = null;
    for (const ent of [...(entry.entrances ?? [])].sort((a, b) => a.via.localeCompare(b.via))) {
        const terms = conjunctiveHasTerms(ent.access_rule);
        if (terms === null) {
            rejected.push(ent.via);
            continue;
        }
        if (best === null || terms.length < best.gate.length) {
            best = { gate: terms, via: ent.via };
        }
    }
    if (best === null) {
        return {
            entry_id: entry.entry_id,
            gate: null,
            via: null,
            declined: (entry.entrances ?? []).length === 0
                ? 'no projected way in'
                : `every way in (${rejected.join(', ')}) needs a rule outside the v1 gate `
                    + 'vocabulary (a conjunction of single-instance Has terms)',
        };
    }
    return { entry_id: entry.entry_id, gate: best.gate, via: best.via, declined: null };
}

/** One-line-per-item human summary of a pool build's notes, for CLIs. */
export function formatAtlasPoolNotes(notes) {
    return [
        `atlas pool: ${notes.length} note(s)`,
        ...notes.map((n) => `  [${n.kind}] ${n.message}`),
    ];
}
