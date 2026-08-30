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

import { computeContentHash, stampIdentity } from '../procgenCore/contentIdentity.js';

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

export function computePoolContentHash(pool) {
    return computeContentHash(pool, { idKey: 'pool_id' });
}

/**
 * Stamp `provenance.content_hash` + the hash-suffixed `pool_id` in place.
 *
 * ⚠ THIS USED TO *REPLACE* `provenance` (`{...prov, content_hash}`) where the
 * other four copies mutated it. The family mutates in place; the only inputs
 * that could tell the two apart are a non-plain-object provenance (a string
 * would have been spread into index keys — strictly worse) and reference
 * identity. The committed pool's id recomputes unchanged under the family
 * (pinned by contentIdentity.test.js's ten-document row).
 */
export function stampPoolIdentity(pool, baseId = null) {
    return stampIdentity(pool, { idKey: 'pool_id', defaultBase: 'atlas-pool', baseId });
}

// --- the entry-rule vocabulary ------------------------------------------------
//
// v1 (Phase 6) accepted only a CONJUNCTION of single-instance `Has` terms,
// because a sphere gate is `{ gate: [item…], gateCounts }` and `sphereGateRule`
// ANDs one `Has` per item — an OR ("the lock opens with the Wand or the Fire
// Wand") had no faithful encoding there, so three of the ten Seedling
// sub-regions were declined rather than gated wrong.
//
// The lift (Phase 6 fence 1) keeps that honesty and drops the fence: a rule is
// normalized to DISJUNCTIVE NORMAL FORM over `Has` terms, and the AUTHORED rule
// — not a re-synthesis of it — becomes the gate the compiled world carries. The
// DNF is what the SORTER reasons about:
//
//   - the honest wave is `min over disjuncts of (max over the disjunct's items'
//     spheres)`, i.e. the first sphere in which SOME way through the rule is
//     satisfiable;
//   - scheduling picks ONE disjunct (cheapest, then lexical — rng-free) and
//     pushes its items into earlier spheres.
//
// Anything a DNF over `Has` cannot say (Compare, Count*, helpers, False_) still
// declines with a reason. A count rides as the term's `count`: `Has(x, 2)` means
// two of the game's own x, and the sorter schedules two instances of it.

/** How many disjuncts a normalized requirement may have before it declines. */
export const DNF_DISJUNCT_LIMIT = 32;

/** Canonical string for one conjunct (an ordered array of {item, count}). */
export const conjunctKey = (conj) => (conj ?? [])
    .map((t) => (t.count > 1 ? `${t.item}*${t.count}` : t.item)).join('+');

/** Canonical string for a whole DNF — the sorter's grouping key. */
export const requirementKey = (dnf) => (dnf ?? []).map(conjunctKey).join('|');

/** Does conjunct `a` imply conjunct `b`? (a ⊆ b with counts ≤ ⇒ b is redundant.) */
function implies(a, b) {
    for (const [item, count] of a) {
        if ((b.get(item) ?? 0) < count) return false;
    }
    return true;
}

function dnfRec(rule) {
    if (rule == null) return [new Map()];
    if (typeof rule !== 'object') return null;
    switch (rule.rule) {
        case 'True_':
            return [new Map()];
        case 'Has': {
            const name = rule.args?.item_name;
            if (typeof name !== 'string' || name.length === 0) return null;
            const count = rule.args?.count ?? 1;
            if (!Number.isInteger(count) || count < 1) return null;
            return [new Map([[name, count]])];
        }
        case 'HasAll': {
            const items = rule.args?.items ?? rule.args?.item_names;
            if (!Array.isArray(items)) return null;
            if (items.some((i) => typeof i !== 'string' || i.length === 0)) return null;
            return [new Map(items.map((i) => [i, 1]))];
        }
        case 'HasAny': {
            const items = rule.args?.items ?? rule.args?.item_names;
            if (!Array.isArray(items) || items.length === 0) return null;
            if (items.some((i) => typeof i !== 'string' || i.length === 0)) return null;
            return items.map((i) => new Map([[i, 1]]));
        }
        case 'And': {
            // Cartesian product: (a|b) AND (c|d) = ac|ad|bc|bd.
            let acc = [new Map()];
            for (const child of rule.children ?? []) {
                const sub = dnfRec(child);
                if (sub === null) return null;
                const next = [];
                for (const left of acc) {
                    for (const right of sub) {
                        const merged = new Map(left);
                        for (const [item, count] of right) {
                            merged.set(item, Math.max(merged.get(item) ?? 0, count));
                        }
                        next.push(merged);
                    }
                }
                if (next.length > DNF_DISJUNCT_LIMIT) return null;
                acc = next;
            }
            return acc;
        }
        case 'Or': {
            const out = [];
            for (const child of rule.children ?? []) {
                const sub = dnfRec(child);
                if (sub === null) return null;
                out.push(...sub);
                if (out.length > DNF_DISJUNCT_LIMIT) return null;
            }
            return out.length > 0 ? out : null; // an Or with no branches is False_
        }
        default:
            return null; // Compare, Count*, helpers, False_, anything else
    }
}

/**
 * Normalize a Rule Builder tree to DNF over `Has` terms.
 *
 * @returns {Array<Array<{item: string, count: number}>>|null}
 *   one entry per disjunct (a conjunction of terms, sorted by item name);
 *   `[[]]` means FREE (one empty conjunction); `null` means out of vocabulary.
 *   Disjuncts are deduplicated, redundant supersets are dropped (satisfying the
 *   cheaper conjunct already satisfies the rule), and the result is ordered by
 *   (term count, canonical key) so grouping and disjunct choice are stable.
 */
export function requirementDnf(rule) {
    const raw = dnfRec(rule);
    if (raw === null) return null;
    // Drop any conjunct implied by another (keeping the cheaper one), then
    // dedupe and order canonically.
    const kept = [];
    for (const cand of raw) {
        if (kept.some((k) => implies(k, cand))) continue;
        for (let i = kept.length - 1; i >= 0; i -= 1) {
            if (implies(cand, kept[i])) kept.splice(i, 1);
        }
        kept.push(cand);
    }
    return kept
        .map((m) => [...m.entries()]
            .sort(([a], [b]) => (a < b ? -1 : (a > b ? 1 : 0)))
            .map(([item, count]) => ({ item, count })))
        .sort((a, b) => (a.length - b.length)
            || (conjunctKey(a) < conjunctKey(b) ? -1 : (conjunctKey(a) > conjunctKey(b) ? 1 : 0)));
}

/** Total instances a conjunct demands — the "cost" that picks the cheapest way. */
export const conjunctCost = (conj) => conj.reduce((n, t) => n + t.count, 0);

/**
 * The disjunct the SORTER will schedule: fewest terms, then the canonical key.
 * A pure function of the rule (no rng, no plan), so two runs agree.
 */
export const schedulingDisjunct = (dnf) => (dnf?.length ? dnf[0] : []);

/**
 * Reduce a rule to a CONJUNCTION OF SINGLE-INSTANCE `Has` terms — the v1 gate
 * vocabulary, kept because a single conjunction of plain `Has` is still the case
 * the engine can re-synthesise exactly. Returns item names (possibly empty =
 * "free"), or `null` when the rule needs a disjunction, a count, or something
 * outside `requirementDnf` altogether.
 */
export function conjunctiveHasTerms(rule) {
    const dnf = requirementDnf(rule);
    if (dnf === null || dnf.length !== 1) return null;
    if (dnf[0].some((t) => t.count !== 1)) return null;
    return dnf[0].map((t) => t.item);
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
 * The intrinsic entry requirement of one pool entry — the sorter's input.
 *
 * The chosen entrance is the CHEAPEST expressible one (its cheapest disjunct
 * demands the fewest item instances, ties broken by the entrance's own id so the
 * choice is deterministic and reproducible), because that is the earliest sphere
 * the region could honestly open in; a stronger entrance would over-gate a place
 * the real game lets you into sooner. Entrances whose rule is outside the DNF
 * vocabulary are skipped and REPORTED, and an entry with no expressible entrance
 * is DECLINED — never forced in behind an invented gate.
 *
 * `rule` is the AUTHORED rule of the chosen entrance, kept verbatim: it — not a
 * re-synthesis from `gate` — is what the compiled world gates on, so an OR stays
 * an OR and both ways in stay open.
 *
 * @returns {{
 *   entry_id: string,
 *   dnf: Array<Array<{item, count}>>|null,
 *   gate: string[]|null,          // the disjunct the sorter would schedule
 *   counts: {[item]: number},     // its counts (> 1 only)
 *   rule: object|null,            // the authored rule, verbatim
 *   via: string|null,
 *   declined: string|null,
 * }}
 */
export function entryRequirement(entry) {
    const rejected = [];
    let best = null;
    for (const ent of [...(entry.entrances ?? [])].sort((a, b) => a.via.localeCompare(b.via))) {
        const dnf = requirementDnf(ent.access_rule);
        if (dnf === null) {
            rejected.push(ent.via);
            continue;
        }
        const cost = conjunctCost(schedulingDisjunct(dnf));
        if (best === null || cost < best.cost) {
            best = { dnf, cost, via: ent.via, rule: ent.access_rule ?? null };
        }
    }
    if (best === null) {
        return {
            entry_id: entry.entry_id,
            dnf: null,
            gate: null,
            counts: {},
            rule: null,
            via: null,
            declined: (entry.entrances ?? []).length === 0
                ? 'no projected way in'
                : `every way in (${rejected.join(', ')}) needs a rule outside the gate `
                    + 'vocabulary (a disjunction of conjunctions of Has terms)',
        };
    }
    const chosen = schedulingDisjunct(best.dnf);
    return {
        entry_id: entry.entry_id,
        dnf: best.dnf,
        gate: chosen.map((t) => t.item),
        counts: Object.fromEntries(chosen.filter((t) => t.count > 1)
            .map((t) => [t.item, t.count])),
        rule: best.rule,
        via: best.via,
        declined: null,
    };
}

/** One-line-per-item human summary of a pool build's notes, for CLIs. */
export function formatAtlasPoolNotes(notes) {
    return [
        `atlas pool: ${notes.length} note(s)`,
        ...notes.map((n) => `  [${n.kind}] ${n.message}`),
    ];
}
