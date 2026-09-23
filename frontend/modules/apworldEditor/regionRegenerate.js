/**
 * apworldEditor/regionRegenerate — **ONE REGION'S PAYLOAD, REBUILT FOR A
 * SUBSTRATE, FROM THE DOCUMENT ALONE** (APWORLD SUBSTRATE CHANGE R0; the
 * substrate-change plan §1.2–§1.4, §2.1).
 *
 * The op is `regenerate-region-sidecar` in `rulesDocOps.js` — the op is the
 * authority, and every refusal SENTENCE lives there. This module is the part of
 * it that needs the pipeline ENGINE (`generateRegion`, the per-region serialiser,
 * the tile-mirror law, the side law) and the substrate REGISTRY, which the op
 * file reaches only through here and `regionLayout.js` (M2's door).
 *
 * ── ⛓⛓⛓ WHY THE DOCUMENT'S NAMES SURVIVE ──────────────────────────────
 *
 * The spec is DOCUMENT-shaped: exit ids are the document's exit short names,
 * location ids are the document's location names, and the realiser is asked
 * with `useSourceLocationName: true` — both engine branches then stamp
 * `global_name = id`, and the zone branch rebuilds `ap_locations` onto those
 * names. So `canonical_placements`, `sphere_log` and `loop_costs` still name
 * what the new payload carries, the access rules ARE the spec's (the op writes
 * `regions[p]` not at all), and a neighbour's `targetExitId` still names an exit
 * this region has. What top-down's `buildTopDownRegionSpec` reads off a GRID,
 * this reads off the slot's `grid_cell`s and the neighbours' payloads.
 *
 * ── ⛓⛓ THE RE-LINK — WHAT ③ DOES, FOR ONE REGION ─────────────────────
 *
 * A fresh descriptor's exits carry no `targetExitId` (the pipeline sets it in ③,
 * `linkReverseExits`) and `isBackExit` / `isTeleporter` false. Before the
 * descriptor is serialised — the order the pipeline runs them in, so the
 * substrate's serializer writes the exits in its OWN form — each exit gets:
 *   · `targetExitId` from the TARGET region's payload: the exit leading back
 *     here, preferring the one whose own `targetExitId` already names this exit;
 *     else the first leading back; else it stays absent (play falls back);
 *   · `isBackExit` copied from the OLD payload's exit with the same id;
 *   · `isTeleporter` by `linkIsAdjacentOnSide` over the slot's cells (M2's law,
 *     `regionLayout.slotLayout`), or the OLD flag when either end has no cell.
 * The NEIGHBOURS are not touched: their `targetExitId`s name exit ids the spec kept.
 *
 * ⛔ No substrate is named here. Every per-substrate fact — which realiser, the
 * geometry, the params hooks, the library items — is read off the registry entry.
 */

import {
    DEFAULT_REGION_SIZE, exitTileForMirror, generateRegion, getRegionExits, linkIsAdjacentOnSide,
    perimeterMidpoint, serializeRegionEntry,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { mergeSubstrateItemLib } from '../procgenPipeline/sphereConfigHooks.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { OPPOSITE_SIDE, SIDES, mirrorTileAcrossSide } from '../shared/procgen/spatialPrimitives.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { createRng } from '../shared/rng.js';
import { REGION_GEOMETRY, geometryOf } from '../procgenCore/regionGeometry.js';
import { apExitNameCandidates } from '../procgenCore/apLocationNaming.js';
import { regionsOf, startRegionsOf } from '../procgenCore/rulesGraph.js';
import { sidecarFieldsOf } from '../procgenCore/sidecarFields.js';
import { SIDE_SHARING, sideMayHoldAnotherExit } from '../procgenCore/exitSides.js';
import { SIDE_WORDS, slotLayout } from './regionLayout.js';

/**
 * ⛓ Top-down's own `regionParams` default (`topDownSteps.buildTopDownEnvelope`):
 * open maze rooms, the maximum floor for a source's locations and exits. The
 * op's `regionParams` merge OVER it, exactly as the envelope's do.
 */
export const REGENERATE_BASE_REGION_PARAMS = Object.freeze({ maxIterations: 0 });

/** ⛓ The three realiser kinds, as data. `null` = the entry has none. */
export const REALISER_KINDS = Object.freeze({ PROCEDURAL: 'procedural', ZONE: 'zone' });

/**
 * ⛓⛓ **DOES THIS REGISTRY ENTRY BUILD A REGION FROM A SPEC?** The engine's own
 * dispatch (`generateRegionGen`: `generateRegionCore` first, else a zone
 * generator) and the pipeline's `_sphereCapableSubstrates` test — the same three
 * slots, so the hub offers exactly the targets the pipeline realises.
 *
 * @returns {'procedural'|'zone'|null}
 */
export function regionRealiserKind(entry) {
    if (typeof entry?.generateRegionCore === 'function') return REALISER_KINDS.PROCEDURAL;
    if (typeof entry?.generateZoneForSpecs === 'function'
        || typeof entry?.generateZoneForSpecsGen === 'function') return REALISER_KINDS.ZONE;
    return null;
}

/**
 * ⛓ What the op's refusals read off a target id's registry entry — the facts,
 * never a sentence (the sentences are `rulesDocOps.js`').
 *
 * @returns {{registered: boolean, playable: boolean, kind: 'procedural'|'zone'|null,
 *            zoneCount: number|null, extractsZoneRules: boolean}}
 */
export function regenerateTargetFacts(substrate) {
    const reg = substrateRegistry.get(substrate);
    return {
        registered: !!reg,
        playable: typeof reg?.deserializeWorld === 'function' && typeof reg?.serializeWorld === 'function',
        kind: regionRealiserKind(reg),
        zoneCount: Number.isInteger(reg?.zoneCount) ? reg.zoneCount : null,
        extractsZoneRules: typeof reg?.extractZoneRules === 'function',
        sideKeys: oneExitPerSide(reg) ? sideMayHoldAnotherExit(reg).keys : null,
        sides: SIDES.length,
    };
}

/**
 * ⛓ Does the target hold ONE exit per side? — its `exitSides` declaration KEYS
 * some payload fact by side (`sideMayHoldAnotherExit` → `keyed`: the zone
 * family's `params.sidePortals`). A tile room (no declaration) and a side-agnostic
 * one hold several; measured by the R0 corpus control, the keyed ones refuse a
 * duplicate side outright.
 */
export function oneExitPerSide(entry) {
    return !!entry && sideMayHoldAnotherExit(entry).reason === SIDE_SHARING.KEYED;
}

/** ⛓ The three steps of the region-size rule, in ORDER (⚖ Q4 B-then-A). */
export const REGION_SIZE_SOURCES = Object.freeze([
    'procgen_metadata.region_size',
    'modal tile-payload size in the slot',
    'DEFAULT_REGION_SIZE',
]);

const isSize = (s) => !!s && Number.isInteger(s.width) && Number.isInteger(s.height)
    && s.width > 0 && s.height > 0;

/**
 * ⛓⛓ **THE SIZE A REGENERATED REGION IS ASKED FOR** (⚖ Q4, 2026-09-23: B then
 * A): `procgen_metadata.region_size` when it is `{width, height}`; else the
 * slot's MODAL size over the payloads of TILE-geometry substrates that carry
 * one (ties → the size met first in entry order); else the engine's
 * `DEFAULT_REGION_SIZE`. A sides-only target ignores it.
 *
 * @returns {{width: number, height: number, source: string}} `source` is one of
 *   `REGION_SIZE_SOURCES`
 */
export function regionSizeFor(doc, player) {
    const declared = doc?.procgen_metadata?.region_size;
    if (isSize(declared)) {
        return { width: declared.width, height: declared.height, source: REGION_SIZE_SOURCES[0] };
    }
    const counts = new Map();
    for (const entry of Object.values(doc?.preset_sidecars?.[player] ?? {})) {
        const reg = substrateRegistry.get(entry?.substrate);
        if (!reg || geometryOf(reg) !== REGION_GEOMETRY.TILES) continue;
        const pl = entry.playable_payload;
        if (!isSize(pl)) continue;
        const key = `${pl.width}x${pl.height}`;
        counts.set(key, { width: pl.width, height: pl.height, n: (counts.get(key)?.n ?? 0) + 1 });
    }
    let best = null;
    for (const c of counts.values()) if (!best || c.n > best.n) best = c;
    if (best) return { width: best.width, height: best.height, source: REGION_SIZE_SOURCES[1] };
    return { ...DEFAULT_REGION_SIZE, source: REGION_SIZE_SOURCES[2] };
}

/**
 * ⛓⛓ **THE ITEMS THAT RIDE FREE** — top-down's rule
 * (`topDownSteps.buildTopDownEnvelope`): the slot's `starting_items`, then the
 * target entry's `libraryItems` that are not `is_victory` and that the document
 * does not define in `items[p]`. ⛔ Without it a zone realiser that hosts one
 * arrowless exit per level refuses a region with two plain exits; with it the
 * surplus exits drift onto a free item the player always holds.
 *
 * @returns {string[]}
 */
export function freeItemsFor(doc, player, entry) {
    const starting = Array.isArray(doc?.starting_items?.[player])
        ? doc.starting_items[player].filter((n) => typeof n === 'string') : [];
    const defined = doc?.items?.[player] ?? {};
    const out = [...starting];
    for (const [name, def] of Object.entries(entry?.libraryItems ?? {})) {
        if (def?.is_victory) continue;
        if (defined[name] != null) continue;
        if (!out.includes(name)) out.push(name);
    }
    return out;
}

/** ⛓ The document's exit name without its `<region>__` prefix (the four-player
 *  fixture spells one; a top-down document does not). */
export function exitShortName(region, name) {
    const prefix = `${region}__`;
    return typeof name === 'string' && name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/** ⛓ The payload exit a document exit name speaks of, by id or name, with and
 *  without the prefix (`apExitNameCandidates` spells both). */
function payloadExitFor(entry, region, docExitName) {
    const exits = Array.isArray(entry?.playable_payload?.exits) ? entry.playable_payload.exits : [];
    return exits.find((x) => x && [x.exit_id, x.exitName].some((id) => typeof id === 'string'
        && apExitNameCandidates(region, id).includes(docExitName))) ?? null;
}

/**
 * ⛓ The BFS parent of every region reachable from the slot's first default
 * start region, over `exits[].connected_region` in document order — top-down's
 * `placementOrder` parent, read off the document instead of a layout.
 *
 * @returns {Map<string, {name: string, exit: string}|null>}
 */
export function bfsParents(doc, player) {
    const regions = regionsOf(doc, player);
    const [start] = startRegionsOf(doc, player).default;
    const parents = new Map();
    if (!start || !regions[start]) return parents;
    parents.set(start, null);
    const queue = [start];
    while (queue.length) {
        const n = queue.shift();
        for (const e of regions[n]?.exits ?? []) {
            const t = e?.connected_region;
            if (typeof t === 'string' && regions[t] && !parents.has(t)) {
                parents.set(t, { name: n, exit: e.name });
                queue.push(t);
            }
        }
    }
    return parents;
}

/**
 * ⛓⛓⛓ **THE SPEC, FROM THE DOCUMENT** (plan §1.4's rule set).
 *
 *   · entrance — the BFS parent's exit, its SIDE read off the parent's OWN
 *     payload, the entrance on the opposite side; its tile = the parent's exit
 *     tile mirrored across the shared wall (`exitTileForMirror`: the stored tile
 *     for a tile parent, the side's midpoint for a sides-only one). No entrance
 *     for a start region, an unreachable one, or a parent whose payload does
 *     not carry that exit on a side.
 *   · exits — one per document exit, `exit_id = exitName = the short name`, the
 *     side the OLD payload gave that exit (absent → the realiser assigns), the
 *     exit(s) back to the parent pinned to the entrance `{side, tile}`.
 *   · locations — `{id: name, item, access_rule}`: the fill rides as `item`.
 *
 *   · one exit per side when the TARGET keys a payload fact by side
 *     (`oneExitPerSide`): the colliding exits lose their side (`sidesReassigned`).
 *
 * @returns {{entrances: object[], exitSpecs: object[], locationSpecs: object[],
 *            parent: {name, exit}|null, size: {width, height}, sidesReassigned: string[]}}
 */
export function buildDocumentRegionSpec(doc, player, region, { size, substrate } = {}) {
    const sidecars = doc?.preset_sidecars?.[player] ?? {};
    const source = regionsOf(doc, player)[region] ?? {};
    const old = sidecars[region];
    const resolvedSize = isSize(size) ? { width: size.width, height: size.height }
        : (({ width, height }) => ({ width, height }))(regionSizeFor(doc, player));
    const parent = bfsParents(doc, player).get(region) ?? null;

    let entrances = [];
    if (parent) {
        const parentEntry = sidecars[parent.name];
        const px = payloadExitFor(parentEntry, parent.name, parent.exit);
        if (px && Object.hasOwn(SIDE_WORDS, px.side)) {
            const stored = Number.isInteger(px.x) && Number.isInteger(px.y) ? { x: px.x, y: px.y } : null;
            const parentTile = exitTileForMirror(parentEntry.substrate, stored, px.side, resolvedSize)
                ?? perimeterMidpoint(px.side, resolvedSize);
            const tile = mirrorTileAcrossSide(parentTile, px.side, resolvedSize);
            entrances = [{ side: OPPOSITE_SIDE[px.side], tile }];
        }
    }

    const exitSpecs = (source.exits ?? []).map((e) => {
        const short = exitShortName(region, e.name);
        const was = payloadExitFor(old, region, e.name);
        const oldSide = Object.hasOwn(SIDE_WORDS, was?.side) ? was.side : null;
        const target = e.connected_region ?? null;
        const pinned = parent && target === parent.name && entrances.length > 0;
        const side = pinned ? entrances[0].side : oldSide;
        return {
            exit_id: short,
            exitName: short,
            target_region: target,
            ...(side ? { side } : {}),
            ...(pinned ? { tile: entrances[0].tile } : {}),
            ...(e.access_rule ? { access_rule: e.access_rule } : {}),
        };
    });

    // ⛓ One exit per side for a KEYED target (`oneExitPerSide`): on a collision
    //   the side stays with the parent pin, else the link adjacent on that side
    //   (the slot's cells, M2's law), else the first; the others lose it and
    //   the realiser assigns them clockwise over the free sides, exactly as it
    //   does a top-down teleporter exit.
    const sidesReassigned = [];
    if (oneExitPerSide(substrateRegistry.get(substrate))) {
        const layout = slotLayout(doc, player);
        const here = layout.cells.get(region);
        const adjacent = (e) => !!(here && layout.grid && layout.cells.get(e.target_region)
            && linkIsAdjacentOnSide(layout.grid, here, e.side, layout.cells.get(e.target_region)));
        for (const side of SIDES) {
            const on = exitSpecs.filter((e) => e.side === side);
            if (on.length < 2) continue;
            const keep = on.find((e) => e.tile) ?? on.find(adjacent) ?? on[0];
            for (const e of on) {
                if (e === keep) continue;
                delete e.side;
                sidesReassigned.push(e.exit_id);
            }
        }
    }

    const locationSpecs = (source.locations ?? []).map((l) => ({
        id: l.name,
        item: l.item?.name ?? null,
        ...(l.access_rule ? { access_rule: l.access_rule } : {}),
    })).filter((l) => typeof l.id === 'string' && l.id);

    return { entrances, exitSpecs, locationSpecs, parent, size: resolvedSize, sidesReassigned };
}

/**
 * ⛓ Does `entry` host surplus exits natively under `regionParams`? — its own
 * `hostsSurplusExitsNatively` hook, the one the engine asks before it drifts a
 * surplus exit onto a free item. `false` for an entry without the hook (the
 * engine's `?.()` default).
 */
export function hostsSurplusExitsNatively(entry, regionParams) {
    return typeof entry?.hostsSurplusExitsNatively === 'function'
        && entry.hostsSurplusExitsNatively(regionParams) === true;
}

/**
 * ⛓ The default `regionParams` for a target: its `buildRegionParams` over its
 * `defaultProcgenParams` in top-down mode when it declares both, else `{}`.
 */
export function defaultRegionParamsFor(entry) {
    if (typeof entry?.buildRegionParams === 'function' && entry.defaultProcgenParams) {
        return entry.buildRegionParams({ params: { ...entry.defaultProcgenParams }, mode: 'topDown' }) ?? {};
    }
    return {};
}

/**
 * ⛓⛓ **③ FOR ONE REGION** — set each fresh exit's `targetExitId`, `isBackExit`
 * and `isTeleporter` (the header's rule) on the descriptor's exit objects, before
 * serialisation. Returns how many exits got a `targetExitId`.
 */
export function relinkRegionExits(doc, player, region, descriptor, oldEntry) {
    const sidecars = doc?.preset_sidecars?.[player] ?? {};
    const exits = getRegionExits(descriptor);
    if (!exits) return 0;
    const layout = slotLayout(doc, player);
    const oldExits = Array.isArray(oldEntry?.playable_payload?.exits) ? oldEntry.playable_payload.exits : [];
    let relinked = 0;
    for (const x of exits.values()) {
        const target = x.targetRegion;
        const back = (sidecars[target]?.playable_payload?.exits ?? [])
            .filter((b) => b?.targetRegion === region);
        const r = back.find((b) => b.targetExitId === x.exit_id) ?? back[0];
        if (r && typeof r.exit_id === 'string') {
            x.targetExitId = r.exit_id;
            relinked += 1;
        }
        const was = oldExits.find((o) => o?.exit_id === x.exit_id);
        x.isBackExit = was?.isBackExit === true;
        const here = layout.cells.get(region);
        const there = layout.cells.get(target);
        x.isTeleporter = (here && there && layout.grid && !layout.clash && Object.hasOwn(SIDE_WORDS, x.side))
            ? !linkIsAdjacentOnSide(layout.grid, here, x.side, there)
            : was?.isTeleporter === true;
    }
    return relinked;
}

/**
 * ⛓⛓ **THE SIBLINGS A REGENERATION STRANDS** — measured by the R0 corpus
 * control: a region's payload may HOST a value its siblings point at (a sidecar
 * field descriptor's `references: {field, key}`, the one `sidecarIssues` reads
 * for `REF_UNRESOLVED`). A regenerated payload carries no such host field, so
 * every sibling whose reference no other entry still carries is stranded. The
 * op NAMES them (M3's law: a link the op breaks is reported, never repaired —
 * ⚖ user 2026-09-22, the data may go temporarily invalid).
 *
 * @returns {Array<{region: string, field: string, target: string, key: string, value: *}>}
 */
export function strandedReferences(doc, player, region, newEntry) {
    const slot = doc?.preset_sidecars?.[player] ?? {};
    const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    const carriers = (entries, field, key) => {
        const out = new Set();
        for (const e of entries) {
            const v = isObj(e?.playable_payload) ? e.playable_payload[field] : undefined;
            if (isObj(v) && v[key] !== undefined) out.add(v[key]);
        }
        return out;
    };
    const before = Object.values(slot);
    const after = Object.entries(slot).map(([n, e]) => (n === region ? newEntry : e));
    const out = [];
    for (const [name, entry] of Object.entries(slot)) {
        if (name === region) continue;
        let fields = null;
        try {
            fields = sidecarFieldsOf(substrateRegistry.get(entry?.substrate));
        } catch { fields = null; }
        const payload = isObj(entry?.playable_payload) ? entry.playable_payload : null;
        if (!fields || !payload) continue;
        for (const [field, d] of Object.entries(fields)) {
            const ref = d.references;
            if (!ref || !isObj(payload[field])) continue;
            const value = payload[field][ref.key];
            if (value === undefined) continue;
            if (carriers(before, ref.field, ref.key).has(value) && !carriers(after, ref.field, ref.key).has(value)) {
                out.push({ region: name, field, target: ref.field, key: ref.key, value });
            }
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ **REGENERATE ONE REGION'S SIDECAR ENTRY.** The caller (the op) has
 * refused every input it can name; what can still fail here is the realiser
 * itself, answered as `{ok: false, threw}` with its message verbatim.
 *
 * @returns {{ok: true, entry: object, freeItems: string[], hostsSurplus: boolean,
 *            exitsRelinked: number, spec: object, stranded: object[]}
 *          | {ok: false, threw: string, freeItems: string[], hostsSurplus: boolean}}
 */
export function regenerateRegionEntry({
    doc, player, region, substrate, seed, regionParams, hazardOpts, size, freeItems,
}) {
    const old = doc.preset_sidecars[player][region];
    const target = substrate ?? old.substrate;
    const reg = substrateRegistry.get(target);
    const free = Array.isArray(freeItems) ? [...freeItems] : freeItemsFor(doc, player, reg);
    const spec = buildDocumentRegionSpec(doc, player, region, { size, substrate: target });
    const params = {
        ...REGENERATE_BASE_REGION_PARAMS,
        ...(regionParams && typeof regionParams === 'object' ? regionParams : defaultRegionParamsFor(reg)),
    };
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, [target]);
    // ⛓ R2 — the free items are the engine's DRIFT device, and a target that
    //   hosts surplus exits natively under these params never drifts (the
    //   engine's own test, `procgenPipelineEngine.js`): the op's sentence
    //   follows it instead of saying items "rode free" that rode nowhere.
    const hostsSurplus = hostsSurplusExitsNatively(reg, params);
    let descriptor;
    try {
        descriptor = generateRegion({
            substrate: target,
            region_id: region,
            size: spec.size,
            entrances: spec.entrances,
            exits: spec.exitSpecs,
            locations: spec.locationSpecs,
            itemLib,
            obstacleLib: DEFAULT_OBSTACLES,
            rng: createRng(seed),
            params,
            biome: old.biome ?? null,
            hazardOpts: hazardOpts ?? null,
            consumableTileOpts: null,
            useSourceLocationName: true,
            stampEntrance: true,
            freeItems: free,
        });
    } catch (e) {
        return { ok: false, threw: String(e?.message ?? e), freeItems: free, hostsSurplus };
    }
    const exitsRelinked = relinkRegionExits(doc, player, region, descriptor, old);
    const cell = old.grid_cell;
    const built = serializeRegionEntry({ ...descriptor, cell: cell ?? { gx: 0, gy: 0 } }, {
        manaEnabled: old.playable_payload?.manaEnabled === true,
        fogEnabled: old.playable_payload?.fogEnabled !== false,
        baseObstacleLib: DEFAULT_OBSTACLES,
        baseItemLib: itemLib,
    });
    if (cell === undefined) delete built.grid_cell;
    else built.grid_cell = cell;
    return {
        ok: true, entry: built, freeItems: free, hostsSurplus, exitsRelinked, spec,
        stranded: strandedReferences(doc, player, region, built),
    };
}
