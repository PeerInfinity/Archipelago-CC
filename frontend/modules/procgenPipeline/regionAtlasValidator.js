// Region-atlas validator — structural invariants + content-hash identity for
// the per-game map-partition format (CC/docs/plans/region-atlas-plan.md, Phase 1).
// This module is the single enforcement point; the JSON Schema file
// (frontend/schema/region-atlas.schema.json) documents the same shape for
// editors, but the cross-reference checks here (sub-region referential
// integrity + reachability, edge-exit geometry, vanilla_layout endpoint
// resolution, Rule Builder tree shape, content-hash identity) are authoritative.
//
// An atlas divides one real game's tile map into procgen regions: boundary
// exits (edge runs + teleporters), an optional per-region subgraph of logical
// sub-regions split at traversal obstacles, locations with their vanilla items,
// and the game's own vanilla layout. It is the single source of truth for three
// downstream projections (vanilla rules.json, sphere-sorter input, play-time
// payload) — consumers never read each other's output.
//
// Home: procgenPipeline, beside regionLibraryValidator.js (its identity/split
// precedent) and the sphere-growth consumer that lands in Phase 6. The atlas
// itself is game-agnostic data; the authored documents live beside each game's
// wrapper (e.g. frontend/modules/flashPanel/atlases/).
//
// Headless-safe: no top-level await, no literal node: imports — this module is
// in the bundled browser graph. CLI:
//   node scripts/procgen/region-atlas-validate.mjs [--restamp] <atlas.json>

import {
    computeContentHash,
    stableStringify,
    stampIdentity,
} from '../procgenCore/contentIdentity.js';

// Re-exported because regionAtlasPool.js has imported it from here since Phase 6.
export { stableStringify };

export const REGION_ATLAS_SCHEMA_VERSION = 1;

const VALID_SIDES = new Set(['N', 'E', 'S', 'W']);
const VALID_EXIT_KINDS = new Set(['edge', 'teleporter']);
const VALID_RULES_SOURCES = new Set(['analyzer', 'manual', 'mixed']);

// --- per-exit provenance (Phase 5a, ruling 2) --------------------------------
//
// An internal exit records WHO wrote it. Re-running the analyzer replaces only
// its own rows; hand-authored ones (the puzzle gates no analyzer can derive)
// survive byte-exact, which is what makes re-analysis safe on an atlas someone
// has already annotated.
//
// ABSENT means 'manual'. That is the whole back-compat story: every atlas
// written before the analyzer existed was hand-authored, so reading the missing
// field as 'manual' is not a default, it is the truth about those documents.
export const VALID_EXIT_SOURCES = new Set(['analyzer', 'manual']);
export const DEFAULT_EXIT_SOURCE = 'manual';

/** The provenance of one internal exit; absent means hand-authored. */
export const internalExitSource = (edge) => edge?.source ?? DEFAULT_EXIT_SOURCE;

/**
 * The `annotations.rules_source` a region's internal exits imply.
 *
 * Derived once any row is analyzer-written: all-analyzer => 'analyzer', a mix
 * => 'mixed'. A region with no analyzer rows keeps whatever the author declared
 * (returns null) — a hand-annotated region is not "manual because the analyzer
 * has not run", it is manual because a person decided its rules.
 */
export function derivedRulesSource(region) {
    const edges = region?.subgraph?.internal_exits;
    if (!Array.isArray(edges) || edges.length === 0) return null;
    const sources = edges.map(internalExitSource);
    if (!sources.includes('analyzer')) return null;
    return sources.every((s) => s === 'analyzer') ? 'analyzer' : 'mixed';
}

// Guard against a hand-built cyclic rule object (JSON can't be cyclic, but a
// caller can hand us a live object graph).
const MAX_RULE_DEPTH = 64;

// --- AP naming convention (plan open question 1, ruled 2026-07-27) -----------
//
// A sub-region projects into AP as `<region_id>__<sub_region>`; a region with no
// subgraph keeps its bare `region_id`. `__` is already the fork-wide scoping
// separator for region-scoped names (jta's `${region_id}__${task_id}` AP
// locations, procgenPipelineEngine's `${regionName}__${locId}`), it keeps
// sub-region ids unique across regions without a global registry, and splitting
// on the FIRST `__` recovers the pair — which is why the validator forbids `__`
// inside region_id and sub_region ids.
export const AP_SUBREGION_SEPARATOR = '__';

export function apRegionName(regionId, subRegionId = null) {
    return subRegionId == null || subRegionId === ''
        ? String(regionId)
        : `${regionId}${AP_SUBREGION_SEPARATOR}${subRegionId}`;
}

// --- content-hash identity (mirrors regionLibraryValidator / datasetValidator) ---
//
// atlas_id must not be a stable function of authored content: an EDITED
// document that kept its id would silently keep the downstream pipeline steps
// (projections, sorter input, play-time payloads) keyed on it looking fresh.
// provenance.content_hash = FNV-1a over the canonical document (sorted-key JSON)
// minus `provenance` and minus `atlas_id` itself; atlas_id ends with the 8-hex
// short hash. validateRegionAtlas errors on a mismatch; `--restamp` rewrites
// both after a deliberate hand edit. region_id / sub_region / exit_id / location
// names are author-chosen and STABLE across restamps.

export function computeAtlasContentHash(atlas) {
    return computeContentHash(atlas, { idKey: 'atlas_id' });
}

// Stamp (or re-stamp) the identity in place: sets provenance.content_hash and
// appends the short hash to `baseId` (defaults to the current atlas_id with a
// previously stamped hash suffix stripped — idempotent). Returns the atlas.
export function stampAtlasIdentity(atlas, baseId = null) {
    return stampIdentity(atlas, { idKey: 'atlas_id', defaultBase: 'atlas', baseId });
}

// --- helpers -----------------------------------------------------------------

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isTile = (v) => Array.isArray(v) && v.length === 2
    && Number.isInteger(v[0]) && Number.isInteger(v[1]);
const tileKey = (t) => `${t[0]},${t[1]}`;

function boundsContains(bounds, tile) {
    return tile[0] >= bounds.x && tile[0] <= bounds.x + bounds.w - 1
        && tile[1] >= bounds.y && tile[1] <= bounds.y + bounds.h - 1;
}

// Structural check of a Rule Builder tree. Rule NAMES are deliberately not
// checked — game-specific helper rules are legal (rules.schema.json says so) —
// only the shape the evaluator walks: `rule` string, optional `children` array
// of rules, optional `args` object/array whose rule-shaped values recurse
// (Compare's left/right, Constant-wrapped positional args).
function checkRuleTree(node, where, err, depth = 0) {
    if (depth > MAX_RULE_DEPTH) {
        err(`${where} exceeds the maximum rule depth (${MAX_RULE_DEPTH}) — cyclic rule object?`);
        return;
    }
    if (!isPlainObject(node)) {
        err(`${where} must be a Rule Builder rule object ({ rule: "..." }), got ${JSON.stringify(node)}`);
        return;
    }
    if (!isNonEmptyString(node.rule)) {
        err(`${where}.rule must be a non-empty string (the rule type name)`);
    }
    if (node.children !== undefined) {
        if (!Array.isArray(node.children)) {
            err(`${where}.children must be an array when present`);
        } else {
            node.children.forEach((child, i) => checkRuleTree(child, `${where}.children[${i}]`, err, depth + 1));
        }
    }
    if (node.args !== undefined) {
        if (Array.isArray(node.args)) {
            node.args.forEach((arg, i) => {
                if (isPlainObject(arg) && 'rule' in arg) checkRuleTree(arg, `${where}.args[${i}]`, err, depth + 1);
            });
        } else if (isPlainObject(node.args)) {
            for (const [k, v] of Object.entries(node.args)) {
                if (isPlainObject(v) && 'rule' in v) checkRuleTree(v, `${where}.args.${k}`, err, depth + 1);
            }
        } else {
            err(`${where}.args must be an object (named args) or an array (positional args)`);
        }
    }
}

// --- structural validation ---------------------------------------------------

// --- multi-level coordinate spaces (Phase 2 delta) ---------------------------
//
// Phase 1 assumed one coordinate space per game, which is true of RWK (one big
// tile map) and false of Seedling (116 levels, each its own 0,0). A region may
// therefore name the space it lives in with `map_ref` — a level id in the
// document `tile_space.map_document` points at. It is purely ADDITIVE: an
// atlas with no map_ref anywhere validates exactly as before, because every
// geometry check the validator does (edge runs on the bounds line, tiles inside
// bounds) already stays inside a single region and never compares two.
//
// Resolution needs the map document, which the validator has no way to read —
// so callers that have it pass it in. Given one, `map_ref` must name a level
// and the region's bounds must fit inside that level.

/**
 * Index a map-source document for validateRegionAtlas's `mapDoc` option.
 * Accepts the Seedling extract shape ({ levels: [{ level, width, height }] })
 * or any { id -> { width, height } } map.
 */
export function indexMapDocument(doc) {
    const byId = new Map();
    if (isPlainObject(doc) && Array.isArray(doc.levels)) {
        for (const lvl of doc.levels) {
            if (isPlainObject(lvl) && lvl.level !== undefined) byId.set(String(lvl.level), lvl);
        }
    } else if (isPlainObject(doc)) {
        for (const [k, v] of Object.entries(doc)) if (isPlainObject(v)) byId.set(String(k), v);
    }
    return byId;
}

/**
 * @param {object} atlas
 * @param {{ mapDoc?: object }} [options] the parsed document named by
 *   tile_space.map_document. Supply it and map_ref values are resolved against
 *   real levels; omit it and only the shape of map_ref is checked.
 */
export function validateRegionAtlas(atlas, options = {}) {
    const errors = [];
    const warnings = [];
    const err = (m) => errors.push(m);
    const warn = (m) => warnings.push(m);
    const mapIndex = options.mapDoc === undefined ? null : indexMapDocument(options.mapDoc);

    if (!isPlainObject(atlas)) {
        return { ok: false, errors: ['atlas is not an object'], warnings, stats: null };
    }

    // --- envelope ---
    if (atlas.schema_version !== REGION_ATLAS_SCHEMA_VERSION) {
        err(`schema_version must be ${REGION_ATLAS_SCHEMA_VERSION}, got ${JSON.stringify(atlas.schema_version)}`);
    }
    if (!isNonEmptyString(atlas.atlas_id)) err('atlas_id must be a non-empty string');
    if (!isNonEmptyString(atlas.game)) err('game must be a non-empty string');
    for (const key of ['name', 'description']) {
        if (atlas[key] !== undefined && typeof atlas[key] !== 'string') {
            err(`${key} must be a string when present`);
        }
    }

    const prov = atlas.provenance;
    if (prov === undefined) {
        warn('provenance missing (hand-authored) — stamp with region-atlas-validate.mjs --restamp');
    } else if (!isPlainObject(prov)) {
        err('provenance must be an object when present');
    } else if (prov.content_hash === undefined) {
        warn('provenance.content_hash missing — stamp with --restamp');
    } else if (typeof prov.content_hash !== 'string') {
        err('provenance.content_hash must be a string');
    } else {
        const actual = computeAtlasContentHash(atlas);
        if (prov.content_hash !== actual) {
            err(`provenance.content_hash ${prov.content_hash} does not match the document content (${actual}) — edited without --restamp?`);
        } else if (isNonEmptyString(atlas.atlas_id) && !atlas.atlas_id.endsWith(`-${actual}`)) {
            err(`atlas_id must end with the content-hash suffix -${actual} (got "${atlas.atlas_id}") — restamp with --restamp`);
        }
    }

    // --- tile_space ---
    const tileSpace = atlas.tile_space;
    if (!isPlainObject(tileSpace)) {
        err('tile_space must be an object');
    } else {
        if (!(Number.isInteger(tileSpace.tile_size) && tileSpace.tile_size > 0)) {
            err('tile_space.tile_size must be a positive integer');
        }
        if (tileSpace.map_source !== undefined && typeof tileSpace.map_source !== 'string') {
            err('tile_space.map_source must be a string when present');
        }
        if (tileSpace.map_document !== undefined && !isNonEmptyString(tileSpace.map_document)) {
            err('tile_space.map_document must be a non-empty string when present');
        }
    }
    const usesMapRef = Array.isArray(atlas.regions)
        && atlas.regions.some((r) => isPlainObject(r) && r.map_ref !== undefined);
    if (usesMapRef && !isNonEmptyString(tileSpace?.map_document)) {
        err('tile_space.map_document is required — a region names a map_ref, so the document those level ids live in has to be identified');
    }

    // --- regions ---
    const regions = Array.isArray(atlas.regions) ? atlas.regions : [];
    if (!Array.isArray(atlas.regions) || regions.length === 0) {
        err('regions must be a non-empty array');
    }

    const startRegionId = isPlainObject(atlas.vanilla_layout) ? atlas.vanilla_layout.start_region : undefined;
    const startSubRegion = isPlainObject(atlas.vanilla_layout) ? atlas.vanilla_layout.start_sub_region : undefined;

    // region_id -> { subRegions:Set|null, exitIds:Set, exitSides:Map }
    const regionIndex = new Map();
    const locationNames = new Set();
    let exitCount = 0;
    let locationCount = 0;
    let subRegionCount = 0;

    regions.forEach((region, ri) => {
        const rlabel = `regions[${ri}]`;
        if (!isPlainObject(region)) {
            err(`${rlabel} must be an object`);
            return;
        }
        const where = isNonEmptyString(region.region_id) ? `region "${region.region_id}"` : rlabel;

        // --- region_id ---
        if (!isNonEmptyString(region.region_id)) {
            err(`${rlabel}.region_id must be a non-empty string`);
        } else if (region.region_id.includes(AP_SUBREGION_SEPARATOR)) {
            err(`${where}: region_id must not contain "${AP_SUBREGION_SEPARATOR}" — it is the AP sub-region name separator`);
        } else if (regionIndex.has(region.region_id)) {
            err(`duplicate region_id "${region.region_id}" (${rlabel})`);
        }
        if (region.name !== undefined && typeof region.name !== 'string') {
            err(`${where}.name must be a string when present`);
        }

        // --- bounds ---
        const b = region.bounds;
        const boundsOk = isPlainObject(b)
            && Number.isInteger(b.x) && Number.isInteger(b.y)
            && Number.isInteger(b.w) && b.w > 0
            && Number.isInteger(b.h) && b.h > 0;
        if (!boundsOk) {
            err(`${where}.bounds must be { x, y integers; w, h positive integers }`);
        }

        // --- map_ref: which coordinate space these bounds are in ---
        if (region.map_ref !== undefined) {
            if (!(Number.isInteger(region.map_ref) || isNonEmptyString(region.map_ref))) {
                err(`${where}.map_ref must be an integer or non-empty string level id (got ${JSON.stringify(region.map_ref)})`);
            } else if (mapIndex) {
                const level = mapIndex.get(String(region.map_ref));
                if (!level) {
                    err(`${where}.map_ref ${JSON.stringify(region.map_ref)} is not a level in ${tileSpace?.map_document ?? 'the map document'}`);
                } else if (boundsOk && Number.isInteger(level.width) && Number.isInteger(level.height)) {
                    if (b.x < 0 || b.y < 0 || b.x + b.w > level.width || b.y + b.h > level.height) {
                        err(
                            `${where}.bounds (${b.x},${b.y} ${b.w}x${b.h}) does not fit level ${region.map_ref}, `
                            + `which is ${level.width}x${level.height} tiles`,
                        );
                    }
                }
            }
        } else if (usesMapRef) {
            // Mixing spaces silently is how two regions end up "overlapping" at
            // the same coordinates while sitting in different rooms.
            warn(`${where} has no map_ref, but other regions in this atlas do — its coordinate space is ambiguous`);
        }

        // --- subgraph (optional: absent ⇒ one implicit sub-region) ---
        let subRegions = null;
        const internalExits = [];
        if (region.subgraph !== undefined) {
            const sg = region.subgraph;
            if (!isPlainObject(sg)) {
                err(`${where}.subgraph must be an object when present`);
            } else {
                const list = Array.isArray(sg.sub_regions) ? sg.sub_regions : null;
                if (!list || list.length === 0) {
                    err(`${where}.subgraph.sub_regions must be a non-empty array`);
                } else {
                    subRegions = new Set();
                    list.forEach((s, si) => {
                        if (!isNonEmptyString(s)) {
                            err(`${where}.subgraph.sub_regions[${si}] must be a non-empty string`);
                        } else if (s.includes(AP_SUBREGION_SEPARATOR)) {
                            err(`${where}.subgraph.sub_regions[${si}] ("${s}") must not contain "${AP_SUBREGION_SEPARATOR}" — it is the AP sub-region name separator`);
                        } else if (subRegions.has(s)) {
                            err(`${where}.subgraph has duplicate sub_region "${s}"`);
                        } else {
                            subRegions.add(s);
                        }
                    });
                    if (subRegions.size === 1) {
                        warn(`${where}.subgraph declares a single sub_region — omit the subgraph instead (a region with no traversal obstacles needs no boilerplate)`);
                    }
                    subRegionCount += subRegions.size;
                }
                const ie = sg.internal_exits;
                if (!Array.isArray(ie)) {
                    err(`${where}.subgraph.internal_exits must be an array (may be empty)`);
                } else {
                    const seenEdges = new Set();
                    ie.forEach((e, ei) => {
                        const elabel = `${where}.subgraph.internal_exits[${ei}]`;
                        if (!isPlainObject(e)) {
                            err(`${elabel} must be an object`);
                            return;
                        }
                        let endpointsOk = true;
                        for (const key of ['from', 'to']) {
                            if (!isNonEmptyString(e[key])) {
                                err(`${elabel}.${key} must be a non-empty string`);
                                endpointsOk = false;
                            } else if (subRegions && !subRegions.has(e[key])) {
                                err(`${elabel}.${key} references unknown sub_region "${e[key]}"`);
                                endpointsOk = false;
                            }
                        }
                        if (endpointsOk && e.from === e.to) {
                            err(`${elabel} connects sub_region "${e.from}" to itself`);
                            endpointsOk = false;
                        }
                        if (typeof e.bidirectional !== 'boolean') {
                            err(`${elabel}.bidirectional must be a boolean (explicit — a one-way drop is false)`);
                        }
                        if (e.source !== undefined && !VALID_EXIT_SOURCES.has(e.source)) {
                            err(`${elabel}.source must be one of ${[...VALID_EXIT_SOURCES].join('/')} when present (absent means "${DEFAULT_EXIT_SOURCE}"), got ${JSON.stringify(e.source)}`);
                        }
                        if (e.access_rule !== undefined) {
                            checkRuleTree(e.access_rule, `${elabel}.access_rule`, err);
                        }
                        if (endpointsOk) {
                            const key = `${e.from}>${e.to}`;
                            if (seenEdges.has(key)) warn(`${elabel} duplicates an earlier internal exit ${e.from} -> ${e.to}`);
                            seenEdges.add(key);
                            internalExits.push({ from: e.from, to: e.to, bidirectional: e.bidirectional === true });
                        }
                    });
                }
            }
        }

        // Shared rule for `sub_region` on exits and locations: required iff the
        // region has a subgraph, forbidden when it does not.
        const checkSubRegionRef = (value, label) => {
            if (subRegions === null) {
                if (value !== undefined) {
                    err(`${label}.sub_region is set but ${where} has no subgraph — a region without a subgraph is one implicit sub-region`);
                }
                return null;
            }
            if (!isNonEmptyString(value)) {
                err(`${label}.sub_region is required (${where} has a subgraph)`);
                return null;
            }
            if (!subRegions.has(value)) {
                err(`${label}.sub_region "${value}" is not declared in ${where}'s subgraph`);
                return null;
            }
            return value;
        };

        // --- exits ---
        const exitIds = new Set();
        const exitSides = new Map();
        const exitBoundSubs = new Set();
        const exits = Array.isArray(region.exits) ? region.exits : [];
        if (!Array.isArray(region.exits)) err(`${where}.exits must be an array (may be empty)`);
        exits.forEach((exit, xi) => {
            const xlabel = isNonEmptyString(exit?.exit_id)
                ? `${where} exit "${exit.exit_id}"`
                : `${where}.exits[${xi}]`;
            if (!isPlainObject(exit)) {
                err(`${xlabel} must be an object`);
                return;
            }
            exitCount += 1;
            if (!isNonEmptyString(exit.exit_id)) {
                err(`${xlabel}.exit_id must be a non-empty string`);
            } else if (exitIds.has(exit.exit_id)) {
                err(`duplicate exit_id "${exit.exit_id}" in ${where}`);
            } else {
                exitIds.add(exit.exit_id);
            }
            if (exit.name !== undefined && typeof exit.name !== 'string') {
                err(`${xlabel}.name must be a string when present`);
            }
            if (!VALID_EXIT_KINDS.has(exit.kind)) {
                err(`${xlabel}.kind must be one of ${[...VALID_EXIT_KINDS].join('/')}, got ${JSON.stringify(exit.kind)}`);
            }
            // side: required for edges (gives the composite-map direction),
            // forbidden for teleporters (their destination need not be a neighbour).
            if (exit.kind === 'edge') {
                if (!VALID_SIDES.has(exit.side)) {
                    err(`${xlabel}.side must be one of N/E/S/W for an edge exit, got ${JSON.stringify(exit.side)}`);
                } else if (isNonEmptyString(exit.exit_id)) {
                    exitSides.set(exit.exit_id, exit.side);
                }
            } else if (exit.side !== undefined) {
                err(`${xlabel}.side must be absent for a teleporter exit (it has no boundary side)`);
            }

            // exit_tiles: non-empty, well-formed, unique, inside bounds; and for
            // an edge exit a contiguous run along the named side.
            const tiles = exit.exit_tiles;
            let tilesOk = Array.isArray(tiles) && tiles.length > 0;
            if (!tilesOk) {
                err(`${xlabel}.exit_tiles must be a non-empty array of [x, y] tiles`);
            } else {
                const seenTiles = new Set();
                tiles.forEach((t, ti) => {
                    if (!isTile(t)) {
                        err(`${xlabel}.exit_tiles[${ti}] must be an [x, y] integer pair`);
                        tilesOk = false;
                        return;
                    }
                    if (seenTiles.has(tileKey(t))) err(`${xlabel}.exit_tiles has duplicate tile [${t}]`);
                    seenTiles.add(tileKey(t));
                    if (boundsOk && !boundsContains(b, t)) {
                        err(`${xlabel}.exit_tiles[${ti}] [${t}] lies outside the region bounds`);
                    }
                });
            }
            if (tilesOk && boundsOk && exit.kind === 'edge' && VALID_SIDES.has(exit.side)) {
                // y grows downward: N is the minimum-y row, S the maximum-y row.
                const vertical = exit.side === 'E' || exit.side === 'W';
                const fixedIdx = vertical ? 0 : 1;
                const runIdx = vertical ? 1 : 0;
                const expectedFixed = { N: b.y, S: b.y + b.h - 1, W: b.x, E: b.x + b.w - 1 }[exit.side];
                const fixedValues = new Set(tiles.map((t) => t[fixedIdx]));
                if (fixedValues.size !== 1) {
                    err(`${xlabel}: an edge exit on side ${exit.side} must be a straight ${vertical ? 'vertical' : 'horizontal'} line (got ${fixedValues.size} distinct ${vertical ? 'x' : 'y'} values)`);
                } else if ([...fixedValues][0] !== expectedFixed) {
                    err(`${xlabel}: side ${exit.side} lies at ${vertical ? 'x' : 'y'}=${expectedFixed} for these bounds, but exit_tiles sit at ${[...fixedValues][0]}`);
                }
                const run = tiles.map((t) => t[runIdx]).sort((p, q) => p - q);
                for (let i = 1; i < run.length; i += 1) {
                    if (run[i] !== run[i - 1] + 1) {
                        err(`${xlabel}.exit_tiles must be a contiguous run (gap between ${vertical ? 'y' : 'x'}=${run[i - 1]} and ${run[i]})`);
                        break;
                    }
                }
            }

            // entrance_tile: the single arrival spawn point, on the span.
            if (!isTile(exit.entrance_tile)) {
                err(`${xlabel}.entrance_tile must be an [x, y] integer pair`);
            } else if (tilesOk && !tiles.some((t) => isTile(t) && t[0] === exit.entrance_tile[0] && t[1] === exit.entrance_tile[1])) {
                err(`${xlabel}.entrance_tile [${exit.entrance_tile}] must be one of exit_tiles`);
            }

            const sub = checkSubRegionRef(exit.sub_region, xlabel);
            if (sub !== null) exitBoundSubs.add(sub);
            else if (subRegions === null) exitBoundSubs.add(null);

            if (exit.access_rule !== undefined) {
                checkRuleTree(exit.access_rule, `${xlabel}.access_rule`, err);
            }
        });

        // --- locations ---
        const locations = Array.isArray(region.locations) ? region.locations : [];
        if (region.locations !== undefined && !Array.isArray(region.locations)) {
            err(`${where}.locations must be an array when present`);
        }
        locations.forEach((loc, li) => {
            const llabel = isNonEmptyString(loc?.name) ? `${where} location "${loc.name}"` : `${where}.locations[${li}]`;
            if (!isPlainObject(loc)) {
                err(`${llabel} must be an object`);
                return;
            }
            locationCount += 1;
            if (!isNonEmptyString(loc.name)) {
                err(`${llabel}.name must be a non-empty string`);
            } else if (locationNames.has(loc.name)) {
                err(`duplicate location name "${loc.name}" (${where}) — AP location names are global`);
            } else {
                locationNames.add(loc.name);
            }
            if (!isTile(loc.tile)) {
                err(`${llabel}.tile must be an [x, y] integer pair`);
            } else if (boundsOk && !boundsContains(b, loc.tile)) {
                err(`${llabel}.tile [${loc.tile}] lies outside the region bounds`);
            }
            if (loc.vanilla_item === undefined) {
                warn(`${llabel} has no vanilla_item — the vanilla rules.json projection will have nothing to place here`);
            } else if (!isNonEmptyString(loc.vanilla_item)) {
                err(`${llabel}.vanilla_item must be a non-empty string when present`);
            }
            checkSubRegionRef(loc.sub_region, llabel);
            if (loc.access_rule !== undefined) {
                checkRuleTree(loc.access_rule, `${llabel}.access_rule`, err);
            }
        });

        // --- annotations ---
        if (region.annotations === undefined) {
            warn(`${where} has no annotations.rules_source — mark whether its rules are analyzer-computed or hand-annotated`);
        } else if (!isPlainObject(region.annotations)) {
            err(`${where}.annotations must be an object when present`);
        } else if (!VALID_RULES_SOURCES.has(region.annotations.rules_source)) {
            err(`${where}.annotations.rules_source must be one of ${[...VALID_RULES_SOURCES].join('/')}, got ${JSON.stringify(region.annotations.rules_source)}`);
        } else {
            // Once any internal exit is analyzer-written, rules_source is
            // DERIVED, not declared (Phase 5a, ruling 2) — a region whose label
            // disagrees with its own rows would misreport what a reviewer has
            // to check by hand.
            const derived = derivedRulesSource(region);
            if (derived !== null && region.annotations.rules_source !== derived) {
                err(
                    `${where}.annotations.rules_source is "${region.annotations.rules_source}" but its internal exits say "${derived}" `
                    + '(all-analyzer => "analyzer", any hand-authored row => "mixed") — rules_source is derived once the analyzer has run',
                );
            }
        }

        // --- sub-region reachability ---
        //
        // Entry points are the sub-regions a boundary exit binds to (you arrive
        // through an exit), plus the start sub-region of the start region. Every
        // sub-region must be reachable from some entry following internal exits
        // in their declared direction — an unreachable sub-region's locations
        // could never be collected, and a one-way drop must not orphan one.
        if (isNonEmptyString(region.region_id)) {
            const nodes = subRegions ? [...subRegions] : [null];
            const entries = new Set(exitBoundSubs);
            if (region.region_id === startRegionId) {
                // The start sub-region is an entry too. A missing/bogus one is
                // reported by the vanilla_layout checks below, not here.
                if (subRegions === null) entries.add(null);
                else if (isNonEmptyString(startSubRegion) && subRegions.has(startSubRegion)) entries.add(startSubRegion);
            }
            if (entries.size === 0) {
                // Skip when the exits exist but their sub_region refs were bad —
                // those errors are already reported and would cascade here.
                if (exits.length === 0) {
                    err(`${where} has no entry point — it has no exits and is not the start region, so nothing can reach it`);
                }
            } else {
                const forward = new Map(nodes.map((n) => [n, []]));
                const backward = new Map(nodes.map((n) => [n, []]));
                for (const e of internalExits) {
                    forward.get(e.from)?.push(e.to);
                    backward.get(e.to)?.push(e.from);
                    if (e.bidirectional) {
                        forward.get(e.to)?.push(e.from);
                        backward.get(e.from)?.push(e.to);
                    }
                }
                const bfs = (starts, adj) => {
                    const seen = new Set(starts);
                    const queue = [...starts];
                    while (queue.length > 0) {
                        const cur = queue.shift();
                        for (const next of adj.get(cur) ?? []) {
                            if (!seen.has(next)) { seen.add(next); queue.push(next); }
                        }
                    }
                    return seen;
                };
                const reachable = bfs([...entries], forward);
                for (const n of nodes) {
                    if (!reachable.has(n)) {
                        err(`${where}: sub_region "${n}" is unreachable from any entry point (${[...entries].map((e) => `"${e}"`).join(', ')})`);
                    }
                }
                // A sub-region that can never get back out to a boundary exit is
                // a one-way dead end — legal, but almost always an authoring slip.
                if (exitBoundSubs.size > 0) {
                    const canLeave = bfs([...exitBoundSubs], backward);
                    for (const n of nodes) {
                        if (reachable.has(n) && !canLeave.has(n)) {
                            warn(`${where}: sub_region "${n}" cannot reach any boundary exit (one-way dead end)`);
                        }
                    }
                }
            }
        }

        if (isNonEmptyString(region.region_id) && !regionIndex.has(region.region_id)) {
            regionIndex.set(region.region_id, { subRegions, exitIds, exitSides });
        }
    });

    // --- vanilla_layout ---
    const layout = atlas.vanilla_layout;
    if (!isPlainObject(layout)) {
        err('vanilla_layout must be an object (start region + the original game\'s exit wiring)');
    } else {
        if (!isNonEmptyString(layout.start_region)) {
            err('vanilla_layout.start_region must be a non-empty string');
        } else {
            const startRegion = regionIndex.get(layout.start_region);
            if (!startRegion) {
                err(`vanilla_layout.start_region "${layout.start_region}" is not a region in this atlas`);
            } else if (startRegion.subRegions === null) {
                if (layout.start_sub_region !== undefined) {
                    err(`vanilla_layout.start_sub_region is set but start region "${layout.start_region}" has no subgraph`);
                }
            } else if (!isNonEmptyString(layout.start_sub_region)) {
                err(`vanilla_layout.start_sub_region is required — start region "${layout.start_region}" has a subgraph, so the projection cannot tell which sub-region the player starts in`);
            } else if (!startRegion.subRegions.has(layout.start_sub_region)) {
                err(`vanilla_layout.start_sub_region "${layout.start_sub_region}" is not declared in region "${layout.start_region}"'s subgraph`);
            }
        }

        const connections = Array.isArray(layout.connections) ? layout.connections : [];
        if (!Array.isArray(layout.connections)) {
            err('vanilla_layout.connections must be an array (may be empty)');
        }
        const usedEndpoints = new Map();
        connections.forEach((conn, ci) => {
            const clabel = `vanilla_layout.connections[${ci}]`;
            if (!isPlainObject(conn)) {
                err(`${clabel} must be an object`);
                return;
            }
            const resolved = {};
            for (const key of ['from', 'to']) {
                const ref = conn[key];
                if (!Array.isArray(ref) || ref.length !== 2 || !isNonEmptyString(ref[0]) || !isNonEmptyString(ref[1])) {
                    err(`${clabel}.${key} must be [region_id, exit_id]`);
                    continue;
                }
                const [rid, eid] = ref;
                const reg = regionIndex.get(rid);
                if (!reg) {
                    err(`${clabel}.${key} references unknown region "${rid}"`);
                } else if (!reg.exitIds.has(eid)) {
                    err(`${clabel}.${key} references unknown exit "${eid}" in region "${rid}"`);
                } else {
                    resolved[key] = { rid, eid, side: reg.exitSides.get(eid) ?? null };
                }
            }
            if (!resolved.from || !resolved.to) return;
            if (resolved.from.rid === resolved.to.rid && resolved.from.eid === resolved.to.eid) {
                err(`${clabel} connects exit "${resolved.from.eid}" of region "${resolved.from.rid}" to itself`);
                return;
            }
            for (const key of ['from', 'to']) {
                const ep = `${resolved[key].rid}/${resolved[key].eid}`;
                if (usedEndpoints.has(ep)) {
                    err(`${clabel}.${key}: exit "${resolved[key].eid}" of region "${resolved[key].rid}" is already connected by ${usedEndpoints.get(ep)}`);
                } else {
                    usedEndpoints.set(ep, clabel);
                }
            }
            // Geometry sanity for edge↔edge pairs only: a teleporter destination
            // need not be a grid neighbour, so it gets no side check.
            const opposite = { N: 'S', S: 'N', E: 'W', W: 'E' };
            if (resolved.from.side && resolved.to.side && opposite[resolved.from.side] !== resolved.to.side) {
                warn(`${clabel} pairs side ${resolved.from.side} with side ${resolved.to.side} — edge connections are normally opposite sides`);
            }
        });

        // Dangling exits: legal (an unwired map edge), but worth surfacing.
        for (const [rid, reg] of regionIndex) {
            for (const eid of reg.exitIds) {
                if (!usedEndpoints.has(`${rid}/${eid}`)) {
                    warn(`exit "${eid}" of region "${rid}" is not wired by vanilla_layout.connections`);
                }
            }
        }
    }

    const stats = {
        regions: regions.length,
        sub_regions: subRegionCount,
        exits: exitCount,
        locations: locationCount,
        connections: Array.isArray(layout?.connections) ? layout.connections.length : 0,
    };
    return { ok: errors.length === 0, errors, warnings, stats };
}
