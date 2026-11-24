/**
 * regionMap/regionMapModel — **THE STATIC HALF OF THE REGION MAP, FROM ONE RULES DOCUMENT** (region-map step 3b).
 *
 * ⛔ PURE (given the substrate registry): no DOM, no singletons. It composes the landed steps and re-derives
 * nothing:
 *   · the LAYOUT — `procgenCore/regionLayoutResolve.js` `resolveRegionLayout` (stored `grid_cell` → the substrate's
 *     `compositeMap.layoutGraph` → the generic layout; then the grouping rule);
 *   · each display region's CELL — its member rules regions (sub-regions fold, `compositeMap.displayRegionOf`), the
 *     region object its painter draws, its level EXTENT (`compositeMap.regionExtent`, tiles) and its location TILES
 *     (`compositeMap.locationTiles`, plus `compositeMap.remoteLocationTiles` for an event whose object is in another
 *     level);
 *   · the LINKS BETWEEN GROUPS, with endpoints at the real door tiles (`exit_tiles` / `x, y` of the payload's exits),
 *     and apart from them the links between NEIGHBOURS in one group (`neighbourLinks`, the edge transitions).
 *
 * ⚖ No substrate is named here: every substrate answer comes through the registry, as `compositeMap.drawRegion`
 * does. A region with no sidecar (a classic AP world) is a cell with no painter, no extent and GENERIC square
 * places (`genericLocationTiles`), so the map loads for any world.
 *
 * ⛓ STEP-1 RESIDUE (a display group is drawn as its WHOLE level, UNdimmed): the painter dims a sub-region cell's
 * outside tiles when its payload names `atlas_sub_region`. The cell's region object is the display key with the
 * representative member's payload MINUS `atlas_sub_region` (and no `exits`, so no edge squares) — the painter then
 * draws the level whole, from the same bake every sub-region shares. No painter change.
 *
 * Built ONCE per rules load or grouping change — never per snapshot (snapshots only re-colour the overlay).
 */
import { displayRegionReader, resolveRegionLayout } from '../procgenCore/regionLayoutResolve.js';
import { regionsOf } from '../procgenCore/rulesGraph.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_EXTENT } from './regionMapFrames.js';
import { genericLocationTiles, legacyGenericLocationTiles } from './regionMapOverlay.js';

/** An exit's door tile in its own level's tiles, or null: `x, y` (the maze/text-adventure shape), else `exit_tiles[0]`. */
export function exitTileOf(exit) {
    if (Number.isFinite(exit?.x) && Number.isFinite(exit?.y)) return [exit.x, exit.y];
    const t = Array.isArray(exit?.exit_tiles) ? exit.exit_tiles[0] : null;
    return Array.isArray(t) && Number.isFinite(t[0]) && Number.isFinite(t[1]) ? [t[0], t[1]] : null;
}

const safe = (fn, fallback) => {
    try { return fn(); } catch { return fallback; }
};

/**
 * ⛓ WHICH UNTILED CELLS GET THE BIGGER, LOWER SQUARES (region-map-squares-rings). An untiled cell (no substrate
 * `locationTiles`) that still DRAWS ART (`cell.region`: e.g. a maze level) may read as "tiled" to the user.
 * `GENERIC_ART_CELLS_GET_BIG_PLACES` is the one switch: true → every untiled cell gets `genericLocationTiles`;
 * false → an art-drawing untiled cell keeps the pre-slice `legacyGenericLocationTiles`, byte-identical.
 * ⚖ The user, session 84c8ab35, 2026-11-23T21:05:24Z: "Only levels without art (Recommended)" — "The 116 maze levels
 * that draw art keep today's boxes, so the bigger boxes don't cover the art. The other 190 maze levels, and worlds
 * like A Link to the Past, get the change."
 */
export const GENERIC_ART_CELLS_GET_BIG_PLACES = false;
export function usesBigGenericPlaces(cell) {
    return GENERIC_ART_CELLS_GET_BIG_PLACES || !cell?.region;
}

/**
 * @param {object} args
 * @param {object} args.rules  a rules.json document (the RAW one: `preset_sidecars` live only there)
 * @param {string|number} [args.player]
 * @param {object} [args.registry]  the substrate registry
 * @param {object} [args.hookCtx]   handed to every substrate hook (e.g. `atlases` for a custom Seedling set)
 * @param {string|Function} [args.rule]  the grouping rule (a `GROUPING_RULES` name)
 * @param {number} [args.gap]
 * @returns {{layout, cells: Map, links: object[], unplaced: object[], player: string, groupOf: Map}}
 */
export function buildRegionMapModel({ rules, player = null, registry = substrateRegistry, hookCtx = {}, rule = 'R1', gap = 1 } = {}) {
    const layout = resolveRegionLayout({ rules, player, registry, hookCtx, rule, gap });
    const p = layout.stats.player;
    const sidecars = rules?.preset_sidecars?.[p] ?? {};
    const displayOf = displayRegionReader(sidecars, registry);
    const regions = regionsOf(rules, p);
    const hooksOf = (sc) => (sc ? registry?.get?.(sc.substrate)?.compositeMap ?? null : null);
    const ctx = { ...hookCtx, rules, playerId: p, sidecars, displayRegionOf: displayOf };

    const groupOf = new Map();
    for (const g of layout.groups) for (const m of g.members) groupOf.set(m, g.id);

    const cells = new Map();
    for (const key of layout.positions.keys()) {
        cells.set(key, { key, members: [], region: null, substrate: null, extent: null, tiles: [], tileSource: 'none' });
    }
    for (const name of Object.keys(regions)) cells.get(displayOf(name))?.members.push(name);

    const placed = new Set();
    for (const cell of cells.values()) {
        const rep = cell.members.find((m) => sidecars[m]?.playable_payload) ?? null;
        const sc = rep ? sidecars[rep] : null;
        const hooks = hooksOf(sc);
        if (sc) {
            const { atlas_sub_region: _sub, ...payload } = sc.playable_payload;
            cell.substrate = sc.substrate ?? null;
            cell.region = {
                region_id: cell.key, substrate: sc.substrate, render_hint: sc.render_hint, playable_payload: payload, exits: [],
            };
            const e = typeof hooks?.regionExtent === 'function' ? safe(() => hooks.regionExtent(cell.region, ctx), null) : null;
            cell.extent = e && e.w > 0 && e.h > 0 ? { w: e.w, h: e.h } : null;
        }
        if (typeof hooks?.locationTiles === 'function' && cell.extent) {
            cell.tileSource = 'substrate';
            for (const m of cell.members) {
                const msc = sidecars[m];
                if (!msc?.playable_payload) continue;
                for (const t of safe(() => hooks.locationTiles({ region_id: m, playable_payload: msc.playable_payload }, ctx), [])) {
                    if (placed.has(t.location)) continue;
                    placed.add(t.location);
                    cell.tiles.push({ location: t.location, x: t.x, y: t.y, kind: t.kind ?? 'item' });
                }
            }
        }
    }
    // An event whose object is in another level, placed there (after every cell's own tiles).
    for (const cell of cells.values()) {
        if (cell.tileSource !== 'substrate') continue;
        for (const m of cell.members) {
            const msc = sidecars[m];
            const hooks = hooksOf(msc);
            if (typeof hooks?.remoteLocationTiles !== 'function') continue;
            for (const t of safe(() => hooks.remoteLocationTiles({ region_id: m, playable_payload: msc.playable_payload }, ctx), [])) {
                const target = cells.get(t.displayRegion);
                if (!target || target.tileSource !== 'substrate' || placed.has(t.location)) continue;
                placed.add(t.location);
                target.tiles.push({ location: t.location, x: t.x, y: t.y, kind: t.kind ?? 'event', remoteFrom: m });
            }
        }
    }
    // A cell the substrate places nothing in (no hook, or no extent to place it against): generic places.
    for (const cell of cells.values()) {
        if (cell.tileSource === 'substrate') continue;
        const names = cell.members.flatMap((m) => (regions[m]?.locations ?? []).map((l) => l?.name))
            .filter((n) => typeof n === 'string' && !placed.has(n));
        for (const n of names) placed.add(n);
        cell.tiles = (usesBigGenericPlaces(cell) ? genericLocationTiles : legacyGenericLocationTiles)(names, cell.extent ?? DEFAULT_EXTENT);
        cell.tileSource = 'generic';
    }
    const unplaced = [];
    for (const cell of cells.values()) {
        for (const m of cell.members) {
            for (const l of regions[m]?.locations ?? []) {
                if (typeof l?.name === 'string' && !placed.has(l.name)) unplaced.push({ location: l.name, region: m, key: cell.key });
            }
        }
    }

    const linkArgs = { layout, sidecars, displayOf, groupOf };
    return {
        layout, cells, links: groupLinks(linkArgs), neighbourLinks: neighbourLinks(linkArgs), unplaced, player: p, groupOf,
    };
}

/**
 * ⛓ The links BETWEEN groups. `[{from, to, kind, a, b}]`, display keys; `a` / `b` the door tile in `from`'s / `to`'s
 * level (`[x, y]` tiles) or null (the cell's centre). One link per unordered pair of display regions.
 * The pairs INSIDE a group are `neighbourLinks` (a second list, so a reader counts each kind apart).
 */
export function groupLinks(args) {
    return linkPairs(args, false);
}

/**
 * ⛓ The links between NEIGHBOURS: every pair of display regions in the SAME group that the world links (on a
 * Seedling world, the edge transitions you walk between; ⚖ user 2026-11-22T20:24:34Z "Draw lines between
 * neighbours", which retired the panel build's "no lines between adjacent cells"). The same shape, endpoints and
 * one-per-pair rule as `groupLinks`, each with `neighbour: true`. A side-by-side pair the world does not link gets none.
 */
export function neighbourLinks(args) {
    return linkPairs(args, true).filter((l) => neighbourDrawn(l, args.layout)).map((l) => ({ ...l, neighbour: true }));
}

/**
 * ⛓ WHICH in-group pairs get a line: every one the world links (as briefed). The ONE place that says so, so a ruling
 * on the generic-layout worlds (whose groups hold every link, mostly not side by side) is a one-line change here.
 */
export function neighbourDrawn(_link, _layout) {
    return true;
}

/** The world's links between display regions, one per unordered pair: those inside one group (`same`) or between two. */
function linkPairs({ layout, sidecars, displayOf, groupOf }, same) {
    const kindOf = new Map();
    for (const l of layout.graph?.links ?? []) {
        const k = `${l.from}\u0000${l.to}`;
        if (!kindOf.has(k)) kindOf.set(k, l.kind ?? 'join');
    }
    const out = [];
    const seen = new Set();
    const push = (from, to, a, b) => {
        if (from === to || !layout.positions.has(from) || !layout.positions.has(to)) return;
        if ((groupOf.get(from) === groupOf.get(to)) !== same) return;
        const pair = from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
        if (seen.has(pair)) return;
        seen.add(pair);
        out.push({ from, to, kind: kindOf.get(`${from}\u0000${to}`) ?? 'join', a, b });
    };
    const names = Object.keys(sidecars ?? {});
    if (names.length) {
        for (const name of names) {
            for (const e of sidecars[name]?.playable_payload?.exits ?? []) {
                const to = e?.targetRegion;
                if (typeof to !== 'string' || !sidecars[to]) continue;
                const back = (sidecars[to]?.playable_payload?.exits ?? []).find((x) => x?.exit_id === e.targetExitId) ?? null;
                push(displayOf(name), displayOf(to), exitTileOf(e), back ? exitTileOf(back) : null);
            }
        }
        // ⛓ In a group, the LAYOUT GRAPH's links too (it is what made the group): a pair no sidecar exit names (a
        // generic-path world with sidecars, e.g. the maze) is drawn centre to centre. Between groups: unchanged.
        if (same) for (const l of layout.graph?.links ?? []) push(l.from, l.to, null, null);
    } else {
        for (const l of layout.graph?.links ?? []) push(l.from, l.to, null, null);
    }
    return out;
}
