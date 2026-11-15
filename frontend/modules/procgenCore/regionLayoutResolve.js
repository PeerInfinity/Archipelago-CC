/**
 * procgenCore/regionLayoutResolve — **WHERE EVERY DISPLAY REGION OF A WORLD GOES** (region-map step 3a, D3).
 *
 * One function, `resolveRegionLayout`, over a rules.json document. Its answer is in `regionLayout.js`'s frame:
 * cells `{gx, gy}`, SIGNED, the start region at exactly (0, 0). The RESOLUTION ORDER:
 *   1. **grid_cell** — every display region has a stored `grid_cell` (generated presets): those, minus the start
 *      region's cell, so the start sits at the origin. (Stored cells are non-negative DATA; nothing rewrites them.)
 *   2. **hook** — otherwise the world's substrate declares `compositeMap.layoutGraph(ctx)` → `{nodes, links, start?}`
 *      (links carry `dir` and `kind`), found through the REGISTRY as `compositeMap.drawRegion` is. ⚖ No substrate is
 *      named here.
 *   3. **generic** — otherwise the rules' own regions and exits: no `dir`, every link a `join`.
 *   ⚠ MIXED (some display regions carry a `grid_cell`, some do not): v1 lays EVERYTHING out by 2/3 and says so in
 *     `stats.mixedGridCell`. Honouring the stored cells of the ones that have them is a named follow-up.
 * Then `layoutGrouped` (R1 by default) for 2 and 3; a grid_cell world is one group, placed as stored.
 *
 * ── ⛓ THE START, AND THE MENU HUB (as `layoutTopDown` handles it) ──
 * The declared start (`start_regions[p].default[0]`). When it is a PURE HUB — at least one exit and no locations
 * (`procgenPipelineEngine.isVirtualStart`, the same rule; pinned equal in the test) — it is STRIPPED: not drawn,
 * its FIRST exit's target is the start, and each further exit's target is a root joined to the start. Otherwise
 * it is drawn like any region. Every region is then read as its DISPLAY region (`compositeMap.displayRegionOf` of
 * its sidecar's substrate, else its own name), and the start is the start region's display region.
 *
 * ── ⛓ ORDER (js-19 edit a) ──
 * The input is UNORDERED as far as the answer goes: `nodes` are sorted NUMERIC-AWARE (`level_2` before `level_10`)
 * and `links` by (from, to, kind, dir) before `layoutGrouped` sees them, so a permuted document gives the same
 * layout. (`layoutRegions` itself never sorts; this is the caller that does.)
 */
import { regionsOf, startRegionsOf } from './rulesGraph.js';
import { groupedStats, layoutGrouped } from './regionLayout.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/** Natural order: digit runs compare as numbers (`level_2` < `level_10`), the rest as code units. */
export function naturalCompare(a, b) {
    const ra = String(a).match(/\d+|\D+/g) ?? [];
    const rb = String(b).match(/\d+|\D+/g) ?? [];
    for (let i = 0; i < Math.min(ra.length, rb.length); i += 1) {
        const x = ra[i];
        const y = rb[i];
        if (x === y) continue;
        const dx = /^\d/.test(x);
        const dy = /^\d/.test(y);
        if (dx && dy) {
            const d = Number(x) - Number(y);
            if (d !== 0) return d;
            return x.length - y.length; // `01` after `1`, deterministically
        }
        return x < y ? -1 : 1;
    }
    return ra.length - rb.length;
}

/** The canonical order of a graph: nodes natural-sorted, links by (from, to, kind, dir) natural. Pure. */
export function canonicalGraphOrder({ nodes, start, links }) {
    const key = (l) => [l.from, l.to, l.kind ?? 'join', l.dir ?? ''];
    const cmp = (a, b) => {
        const ka = key(a);
        const kb = key(b);
        for (let i = 0; i < ka.length; i += 1) {
            const c = naturalCompare(ka[i], kb[i]);
            if (c !== 0) return c;
        }
        return 0;
    };
    return { nodes: [...new Set(nodes)].sort(naturalCompare), start, links: [...links].sort(cmp) };
}

/** ⛓ `isVirtualStart`'s rule (`procgenPipelineEngine.js`), restated so this module imports no pipeline engine. */
const isHub = (region) => (region?.exits ?? []).length > 0 && (region?.locations ?? []).length === 0;

const playerOf = (rules, player) => {
    if (player != null) return String(player);
    const keys = Object.keys(rules?.preset_sidecars ?? {});
    if (keys.length) return keys[0];
    const rk = Object.keys(rules?.regions ?? {});
    return rk.length ? rk[0] : '1';
};

/**
 * The world's START and its hub, as `layoutTopDown` reads them: `{start, hub, roots}` in RULES region names
 * (`hub` = the stripped Menu or null; `roots` = the further hub-exit targets, in exit order).
 */
export function worldStartOf(rules, player) {
    const regions = regionsOf(rules, player);
    const [declared = null] = startRegionsOf(rules, player).default;
    const fallback = Object.keys(regions)[0] ?? null;
    const region = declared ? regions[declared] : null;
    if (!region) return { start: fallback, hub: null, roots: [] };
    if (isHub(region)) {
        const targets = region.exits.map((e) => e?.connected_region).filter((t) => t && regions[t]);
        if (targets.length) return { start: targets[0], hub: declared, roots: [...new Set(targets.slice(1))] };
    }
    return { start: declared, hub: null, roots: [] };
}

/**
 * The display region of each RULES region: its sidecar substrate's `compositeMap.displayRegionOf`, else its name.
 * @returns {(name: string) => string}
 */
export function displayRegionReader(sidecars, registry = substrateRegistry) {
    return (name) => {
        const sc = sidecars?.[name];
        const fn = sc ? registry?.get?.(sc.substrate)?.compositeMap?.displayRegionOf : null;
        return typeof fn === 'function' ? fn(name, sc) : name;
    };
}

/**
 * ⛓ THE GENERIC ADAPTER: the rules' regions and exits as a layout graph, display-folded. No `dir`, every link a
 * `join`; a hub is not a node, and each of its further roots is joined to the start. Self-links (two regions of one
 * display region) and links to a non-node (an exit back to the hub) are dropped and counted.
 */
export function genericLayoutGraph(rules, player, { displayOf = (n) => n } = {}) {
    const regions = regionsOf(rules, player);
    const { start, hub, roots } = worldStartOf(rules, player);
    const names = Object.keys(regions).filter((n) => n !== hub);
    const nodes = [...new Set(names.map(displayOf))];
    const isNode = new Set(nodes);
    const links = [];
    let dropped = 0;
    const push = (from, to) => {
        if (from === to) return;
        if (!isNode.has(from) || !isNode.has(to)) {
            dropped += 1;
            return;
        }
        links.push({ from, to, kind: 'join' });
    };
    for (const n of names) {
        for (const e of regions[n]?.exits ?? []) {
            if (e?.connected_region) push(displayOf(n), displayOf(e.connected_region));
        }
    }
    const s = start === null ? null : displayOf(start);
    for (const r of roots) push(s, displayOf(r));
    return { nodes, start: s, links, dropped };
}

/** The substrate hook for these sidecars: one `compositeMap.layoutGraph` every entry's substrate declares, or null. */
function hookFor(sidecars, registry) {
    const entries = Object.values(sidecars ?? {});
    if (!entries.length) return null;
    let hook = null;
    let substrate = null;
    for (const sc of entries) {
        const fn = registry?.get?.(sc?.substrate)?.compositeMap?.layoutGraph;
        if (typeof fn !== 'function') return null;
        if (hook === null) {
            hook = fn;
            substrate = sc.substrate;
        }
        // ⛓ two substrates may share ONE hook (flash_seedling + flash_seedling_gen); two different hooks = no hook
        if (fn !== hook) return null;
    }
    return { hook, substrate };
}

/**
 * ⛓⛓ **THE RESOLUTION.**
 * @param {object} args
 * @param {object} args.rules     a rules.json document
 * @param {string|number} [args.player]   the slot (default: the first slot of `preset_sidecars`, else of `regions`)
 * @param {object} [args.sidecars]  that slot's sidecars (default `rules.preset_sidecars[player]`)
 * @param {object} [args.registry]  the substrate registry (default the shared one)
 * @param {object} [args.hookCtx]   extra context handed to the substrate's `layoutGraph` (e.g. `atlases`)
 * @param {string|Function} [args.rule]  the grouping rule (default R1)
 * @param {number} [args.gap]       empty cells between groups (default 1)
 * @returns {{positions: Map<string,{gx,gy}>, groups: object[], start: string|null, graph: object, stats: object}}
 */
export function resolveRegionLayout({
    rules, player = null, sidecars = null, registry = substrateRegistry, hookCtx = {}, rule, gap = 1,
} = {}) {
    const p = playerOf(rules, player);
    const sc = sidecars ?? rules?.preset_sidecars?.[p] ?? {};
    const displayOf = displayRegionReader(sc, registry);
    const generic = genericLayoutGraph(rules, p, { displayOf });

    // ── 1. stored grid_cell ──
    const cellOf = new Map();
    for (const [name, entry] of Object.entries(sc)) {
        const c = entry?.grid_cell;
        const d = displayOf(name);
        if (c && Number.isInteger(c.gx) && Number.isInteger(c.gy) && !cellOf.has(d)) cellOf.set(d, c);
    }
    const ordered = canonicalGraphOrder(generic);
    const withCell = ordered.nodes.filter((n) => cellOf.has(n));
    const allCells = ordered.nodes.length > 0 && withCell.length === ordered.nodes.length && cellOf.has(ordered.start);
    if (allCells) {
        const o = cellOf.get(ordered.start);
        const positions = new Map(ordered.nodes.map((n) => [n, Object.freeze({
            gx: cellOf.get(n).gx - o.gx, gy: cellOf.get(n).gy - o.gy,
        })]));
        const bbox = boxOf(positions);
        const groups = [Object.freeze({
            id: ordered.start, root: ordered.start, members: Object.freeze([...ordered.nodes]), bbox, placedBy: 'grid_cell',
        })];
        const stats = groupedStats(ordered, positions, groups);
        return { positions, groups, start: ordered.start, graph: ordered, stats: { ...stats, source: 'grid_cell', player: p, droppedLinks: generic.dropped } };
    }
    const mixedGridCell = withCell.length > 0 ? { with: withCell.length, without: ordered.nodes.length - withCell.length } : null;

    // ── 2. the substrate's hook ──
    const found = hookFor(sc, registry);
    let graph = generic;
    let source = 'generic';
    if (found) {
        const g = found.hook({ ...hookCtx, rules, player: p, sidecars: sc, displayRegionOf: displayOf, start: generic.start });
        if (g && Array.isArray(g.nodes)) {
            const isNode = new Set(g.nodes);
            const start = g.start ?? generic.start;
            if (isNode.has(start)) {
                const kept = (g.links ?? []).filter((l) => l.from !== l.to && isNode.has(l.from) && isNode.has(l.to));
                graph = { nodes: g.nodes, start, links: kept, dropped: (g.links ?? []).length - kept.length };
                source = 'hook';
            }
        }
    }

    // ── 3. generic (or the hook's graph), grouped ──
    const canon = canonicalGraphOrder(graph);
    const out = layoutGrouped(canon, { ...(rule ? { rule } : {}), gap });
    return {
        ...out,
        start: canon.start,
        graph: canon,
        stats: {
            ...out.stats,
            source,
            ...(source === 'hook' ? { substrate: found.substrate } : {}),
            player: p,
            droppedLinks: graph.dropped ?? 0,
            mixedGridCell,
        },
    };
}

function boxOf(positions) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of positions.values()) {
        minX = Math.min(minX, c.gx);
        minY = Math.min(minY, c.gy);
        maxX = Math.max(maxX, c.gx);
        maxY = Math.max(maxY, c.gy);
    }
    return Object.freeze({ minX, minY, maxX, maxY });
}
