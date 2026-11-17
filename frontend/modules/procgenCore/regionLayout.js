/**
 * procgenCore/regionLayout — **ONE DETERMINISTIC, UNBOUNDED REGION LAYOUT** (region-map step 3a, D1–D2).
 *
 * ⚖ (user, 2026-11-14) *"do we need a fixed grid size? Can't we just track the position of each node relative to
 * the center?"* → *"Yes, I approve of your unbounded layout plan."* This is that layout: the set map's canonical
 * layout (`setMapLayout.canonicalLayout`, Seedling editor E3) GENERALISED from room indices to region ids, and
 * `canonicalLayout` is now a thin wrapper over it (the same positions, translated so the start room is (0,0):
 * `regionLayout.test.js` keeps the old function as an oracle).
 *
 * ── ⛓⛓ THE COORDINATE CONTRACT ──
 *   · Positions are `{gx, gy}` integer CELLS, **SIGNED and START-RELATIVE: the start is exactly (0, 0)**. Nothing is
 *     min-shifted here. Screen y points DOWN (+gy is below), as in `canonicalLayout`.
 *   · Only a consumer that indexes arrays or pixels normalises: `setMapLayout.frameOf` and `layoutCensus` subtract the
 *     minimum themselves (the (0,0)-origin follow-up dropped `canonicalLayout`'s own min-shift).
 *   · Why (⚖ the origin ruling): an id keeps its coordinates when something unrelated is added; a min-shift moves
 *     every cell whenever the minimum moves.
 *
 * ── ⛓ ORDER IS INPUT (js-19 edit a) ──
 * No rng and **no internal sort**. The `nodes` ARRAY ORDER is the canonical order: it decides the breadth-first
 * tie-breaks and which unreached node starts the next group (the lowest position in `nodes`, exactly as
 * `canonicalLayout` used the lowest index). `links` order matters the same way. A caller whose input is unordered
 * sorts it first (`regionLayoutResolve.js` does, numeric-aware) — a string sort here would put `"10"` before `"2"`
 * and break the wrapper's byte identity.
 *
 * ── D2: GROUPS ──
 * `layoutGrouped` lays out each GROUP (a swappable pure rule; R1 = connected components over `join` links) with
 * `layoutRegions`, then places the groups as rectangles in the same signed frame: a group reached by going DOWN
 * sits below the group above it, a SOURCE group (nothing over it) just above its first successor, every other group
 * to the right, `gap` empty cells between any two.
 *
 * ⛔ PURE: no imports at all (no substrate, no DOM, no rng). Not in the js engine closure, and imported by none of it.
 */

export class RegionLayoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RegionLayoutError';
    }
}
const fail = (m) => { throw new RegionLayoutError(`regionLayout: ${m}`); };

export const DIRS = Object.freeze({
    N: Object.freeze({ dx: 0, dy: -1 }),
    S: Object.freeze({ dx: 0, dy: 1 }),
    E: Object.freeze({ dx: 1, dy: 0 }),
    W: Object.freeze({ dx: -1, dy: 0 }),
});
export const OPPOSITE = Object.freeze({ N: 'S', S: 'N', E: 'W', W: 'E' });

/** The ring of cells at Chebyshev distance `r`, in a fixed order: nearest (Manhattan) first, then E, S, W, N. */
function ring(r) {
    if (r === 0) return [{ dx: 0, dy: 0 }];
    const out = [];
    for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push({ dx, dy });
        }
    }
    const order = (c) => {
        // ⛓ E, S, W, N quadrant order for ties: a deterministic sweep, not a meaning.
        const a = Math.atan2(c.dy, c.dx);
        return a < 0 ? a + 2 * Math.PI : a;
    };
    return out.sort((a, b) => (Math.abs(a.dx) + Math.abs(a.dy)) - (Math.abs(b.dx) + Math.abs(b.dy))
        || order(a) - order(b));
}
/** How many rings around the wanted cell a directed placement searches before it gives up on the direction. */
export const CONSISTENT_RINGS = 4;
const RINGS = Array.from({ length: 40 }, (_, r) => ring(r));

/** Index the graph: `nodes` → position, each link's endpoints → positions. Refuses by name. */
function indexGraph({ nodes, start, links }) {
    if (!Array.isArray(nodes)) fail(`nodes must be an array of ids, got ${typeof nodes}`);
    const at = new Map();
    nodes.forEach((id, i) => {
        if (at.has(id)) fail(`node ${JSON.stringify(id)} is listed twice`);
        at.set(id, i);
    });
    if (nodes.length > 0 && !at.has(start)) fail(`the start ${JSON.stringify(start)} is not a node`);
    const lk = [];
    for (const l of links ?? []) {
        const from = at.get(l.from);
        const to = at.get(l.to);
        if (from === undefined || to === undefined) {
            fail(`link ${JSON.stringify(l.from)} → ${JSON.stringify(l.to)} names a node that is not in \`nodes\``);
        }
        if (l.dir != null && !DIRS[l.dir]) fail(`link ${JSON.stringify(l.from)} → ${JSON.stringify(l.to)} has dir ${JSON.stringify(l.dir)}`);
        lk.push({ from, to, dir: l.dir ?? null });
    }
    return { n: nodes.length, start: at.get(start), links: lk };
}

/**
 * ⛓⛓ THE LAYOUT — breadth-first from the start. A node reached by a link WITH a direction is placed one cell that
 * way from the node that reached it; one reached without a direction, or whose wanted cell is taken, takes the
 * nearest free cell (rings of growing distance, fixed order). Nodes no link reaches from the start begin a new
 * component to the right of everything placed so far (`(maxX + 2, minY)`), lowest position in `nodes` first.
 *
 * ⚠ ORDER-SENSITIVE in `nodes` and `links` (see the header). Self-links are ignored.
 *
 * @param {{nodes: string[], start: string, links: {from: string, to: string, dir?: 'N'|'E'|'S'|'W'|null}[]}} graph
 * @returns {Map<string, {gx: number, gy: number}>} in `nodes` order; the start is exactly (0, 0)
 */
export function layoutRegions(graph) {
    const { nodes } = graph;
    const { n, start, links } = indexGraph(graph);
    const adj = Array.from({ length: n }, () => []);
    for (const l of links) {
        if (l.from === l.to) continue;
        adj[l.from].push({ to: l.to, d: l.dir ? DIRS[l.dir] : null });
    }
    // ⛓ Inbound links come after every outbound one, reversed, so a node reached only INTO still lands beside it.
    for (const l of links) {
        if (l.from === l.to) continue;
        const d = l.dir ? DIRS[OPPOSITE[l.dir]] : null;
        adj[l.to].push({ to: l.from, d, inbound: true });
    }
    /**
     * ⛓ Directed links first (outbound before inbound, each in link order), then the undirected ones: a door with
     * no direction must not take the cell a directed door of the same room wants. MEASURED on the vanilla 116:
     * link order alone honoured 35 of 253 directed links; this order is what the E3 census in the as-built quotes.
     */
    for (const list of adj) {
        list.forEach((e, i) => { e.order = i; });
        list.sort((a, b) => (a.d ? 0 : 1) - (b.d ? 0 : 1) || a.order - b.order);
    }
    const pos = new Array(n).fill(null);
    const taken = new Set();
    const k = (x, y) => `${x},${y}`;
    /**
     * Take the nearest free cell to `(x, y)`. With `toward` = `{u, d}` (the node that reached `v`, and the link's
     * direction) a cell must also lie in that direction's quarter-plane from `u` — so a second door on the same side
     * of a room still lands on that side — until `CONSISTENT_RINGS` rings have been tried; then any free cell.
     */
    const place = (v, x, y, toward = null) => {
        const ok = (gx, gy) => {
            if (!toward) return true;
            const dx = gx - pos[toward.u].gx;
            const dy = gy - pos[toward.u].gy;
            const along = toward.d.dx * dx + toward.d.dy * dy;
            return along > 0 && Math.abs(toward.d.dy * dx + toward.d.dx * dy) <= along;
        };
        for (let r = 0; ; r += 1) {
            const cells = RINGS[r] ?? ring(r);
            const strict = toward && r < CONSISTENT_RINGS;
            for (const c of cells) {
                const gx = x + c.dx;
                const gy = y + c.dy;
                if (!taken.has(k(gx, gy)) && (!strict || ok(gx, gy))) {
                    pos[v] = { gx, gy };
                    taken.add(k(gx, gy));
                    return;
                }
            }
        }
    };
    const bfs = (root) => {
        const queue = [root];
        while (queue.length) {
            const u = queue.shift();
            for (const { to, d } of adj[u]) {
                if (pos[to] !== null) continue;
                if (d) place(to, pos[u].gx + d.dx, pos[u].gy + d.dy, { u, d });
                else place(to, pos[u].gx, pos[u].gy);
                queue.push(to);
            }
        }
    };
    const out = new Map();
    if (n === 0) return out;
    place(start, 0, 0);
    bfs(start);
    for (let v = 0; v < n; v += 1) {
        if (pos[v] !== null) continue;
        const maxX = Math.max(...pos.filter(Boolean).map((p) => p.gx));
        const minY = Math.min(...pos.filter(Boolean).map((p) => p.gy));
        place(v, maxX + 2, minY);
        bfs(v);
    }
    nodes.forEach((id, i) => out.set(id, Object.freeze({ gx: pos[i].gx, gy: pos[i].gy })));
    return out;
}

/* ══════════════════════════════════════════════════════════════════════
 * D2 — GROUPS, AND WHERE A GROUP GOES
 * ══════════════════════════════════════════════════════════════════════ */

/** The link kinds a grouping rule and the group placement read. A link without one is a `join`. */
export const LINK_KINDS = Object.freeze(['join', 'down', 'up']);
const kindOf = (l) => l.kind ?? 'join';

/**
 * ⛓ **R1, THE SIMPLEST RULE** (⚖ user: *"experiment, starting with the simplest"*): the connected components over
 * `join` links (direction ignored). `down`/`up` links never join two nodes into one group. A rule is a pure
 * `(graph) → string[][]` — each group's members, in `nodes` order, the groups ordered by their first member's position
 * in `nodes`. An R2 is one more function of that signature (`GROUPING_RULES`).
 */
export function groupsR1({ nodes, links }) {
    const at = new Map(nodes.map((id, i) => [id, i]));
    const parent = nodes.map((_, i) => i);
    const find = (i) => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    for (const l of links ?? []) {
        if (kindOf(l) !== 'join') continue;
        const a = find(at.get(l.from));
        const b = find(at.get(l.to));
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
    const byRoot = new Map();
    nodes.forEach((id, i) => {
        const r = find(i);
        if (!byRoot.has(r)) byRoot.set(r, []);
        byRoot.get(r).push(id);
    });
    // ⛓ the union keeps the LOWEST index as each root, so Map insertion order is first-member order.
    return [...byRoot.values()];
}

/** The grouping rules by name. Add R2 here; nothing else changes. */
export const GROUPING_RULES = Object.freeze({ R1: groupsR1 });

/** `groupsOf(graph, rule)` — `rule` a name from `GROUPING_RULES` or a function. */
export function groupsOf(graph, rule = groupsR1) {
    const fn = typeof rule === 'function' ? rule : GROUPING_RULES[rule];
    if (typeof fn !== 'function') fail(`no grouping rule ${JSON.stringify(rule)}`);
    return fn(graph);
}

const bboxOf = (cells) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of cells) {
        if (c.gx < minX) minX = c.gx;
        if (c.gy < minY) minY = c.gy;
        if (c.gx > maxX) maxX = c.gx;
        if (c.gy > maxY) maxY = c.gy;
    }
    return { minX, minY, maxX, maxY };
};
const shiftBox = (b, dx, dy) => ({ minX: b.minX + dx, minY: b.minY + dy, maxX: b.maxX + dx, maxY: b.maxY + dy });
/** Two boxes CONFLICT when fewer than `gap` empty cells lie between them on both axes. */
const conflicts = (a, b, gap) => a.minX <= b.maxX + gap && b.minX <= a.maxX + gap
    && a.minY <= b.maxY + gap && b.minY <= a.maxY + gap;

/**
 * ⛓⛓ **THE GROUPED LAYOUT.**
 *   1. Groups by `rule` (default R1). Each group is laid out by `layoutRegions` over its own `join` links. Its ROOT is
 *      the start when it holds it; else its first member (in `nodes` order) reached by a `down` link from another
 *      group; else by an `up` link; else its first member.
 *   2. The start's group keeps its own coordinates: the start stays at (0, 0).
 *   3. The VERTICAL RELATION between groups: a `down` link a → b says a's group lies ABOVE b's; an `up` link a → b
 *      says b's group lies above a's (the mirror). A cycle in it is broken by a depth-first walk from the start's
 *      group (the back edge is dropped, and that link is the one not honoured).
 *   4. UPWARD: the start's ANCESTORS (groups over it) are placed nearest first, each `gap` empty cells over the
 *      highest group it lies over, its linking node aligned over the linked one (`placedBy: 'above'`).
 *   5. DOWNWARD: every other group in topological order. One that a placed group lies over goes `gap` cells under
 *      the LOWEST group it lies under, its linked node aligned under the linking node (`'below'`); one that nothing
 *      reaches goes right of everything so far, `gap` cells clear, top-aligned with everything's top (`'right'`,
 *      the next one by first member's position in `nodes`).
 *   6. A group that overlaps (or comes within `gap` of) a placed one slides RIGHT until it does not; x only, so the
 *      rule above stays true.
 *   7. SOURCES (⚖ user 2026-11-16, *"just above its first successor"*): a group that NOTHING lies over but that lies
 *      over something (and is not the start's group or one of its ancestors) is not placed in step 5 — nothing in
 *      step 5 waits for it. Once every other group is placed, each source (group order) goes `gap` cells over the
 *      HIGHEST group it lies over, its linking node aligned over the linked node of its FIRST SUCCESSOR: of the
 *      groups it lies over, the one placed EARLIEST (between two links into that group, the first in link order).
 *      It slides clear RIGHT, LEFT or UP, whichever moves it least (ties in that order); each keeps it over all it
 *      lies over (`placedBy: 'source'`). A group with no vertical link at all still goes right (step 5).
 *   ⇒ Every `down` link across groups lands with the target group STRICTLY below (and every `up` strictly above)
 *     unless the vertical relation has a cycle; `stats.down` / `stats.up` count what did.
 *
 * @param {{nodes: string[], start: string, links: {from, to, dir?, kind?: 'join'|'down'|'up'}[]}} graph
 * @param {{rule?: string|Function, gap?: number}} [opts]
 * @returns {{positions: Map<string,{gx,gy}>, groups: {id, root, members, bbox, placedBy}[], stats: object}}
 */
export function layoutGrouped(graph, { rule = groupsR1, gap = 1 } = {}) {
    const { nodes, start } = graph;
    const links = graph.links ?? [];
    indexGraph({ nodes, start, links });
    if (!Number.isInteger(gap) || gap < 0) fail(`gap must be a non-negative integer, got ${gap}`);
    const members = groupsOf({ nodes, start, links }, rule);
    const groupOf = new Map();
    members.forEach((m, gi) => m.forEach((id) => groupOf.set(id, gi)));
    const at = new Map(nodes.map((id, i) => [id, i]));

    // ⛓ the vertical relation between groups: `above` → `below`, each carrying the link's (upper, lower) nodes.
    const vertical = [];
    for (const l of links) {
        const ga = groupOf.get(l.from);
        const gb = groupOf.get(l.to);
        if (ga === gb) continue;
        const kind = kindOf(l);
        if (kind === 'down') vertical.push({ above: ga, below: gb, upper: l.from, lower: l.to, link: l });
        else if (kind === 'up') vertical.push({ above: gb, below: ga, upper: l.to, lower: l.from, link: l });
    }

    const rootOf = (gi) => {
        const m = members[gi];
        if (m.includes(start)) return start;
        const entered = (kind) => {
            let best = null;
            for (const l of links) {
                if (kindOf(l) !== kind || groupOf.get(l.to) !== gi || groupOf.get(l.from) === gi) continue;
                if (best === null || at.get(l.to) < at.get(best)) best = l.to;
            }
            return best;
        };
        return entered('down') ?? entered('up') ?? m[0];
    };

    const local = members.map((m, gi) => {
        const set = new Set(m);
        const own = links.filter((l) => kindOf(l) === 'join' && set.has(l.from) && set.has(l.to));
        const root = rootOf(gi);
        return { root, pos: layoutRegions({ nodes: m, start: root, links: own }) };
    });
    const localBox = local.map((g) => bboxOf(g.pos.values()));

    const offset = new Array(members.length).fill(null);
    const box = new Array(members.length).fill(null);
    const placedBy = new Array(members.length).fill(null);
    const order = [];
    const placedBoxes = () => order.map((gi) => box[gi]);
    /** Slide `gi`'s box from offset (dx, dy) one way (`right` / `left` / `up`) until clear of every placed group. */
    const slide = (gi, dx, dy, way) => {
        let b = shiftBox(localBox[gi], dx, dy);
        let moved = 0;
        for (;;) {
            const hit = placedBoxes().find((p) => conflicts(b, p, gap));
            if (!hit) break;
            const sx = way === 'right' ? hit.maxX + gap + 1 - b.minX : way === 'left' ? hit.minX - gap - 1 - b.maxX : 0;
            const sy = way === 'up' ? hit.minY - gap - 1 - b.maxY : 0;
            b = shiftBox(b, sx, sy);
            moved += Math.abs(sx) + Math.abs(sy);
        }
        return { dx: b.minX - localBox[gi].minX, dy: b.minY - localBox[gi].minY, b, moved };
    };
    /**
     * Commit `gi` at offset (dx, dy), slid clear: RIGHT for every group (x only, so its vertical rule stays true);
     * a SOURCE also tries LEFT and UP (both keep it over all it lies over) and takes the shortest slide, ties in
     * that order.
     */
    const commit = (gi, dx0, dy0, how, ways = ['right']) => {
        const best = ways.map((w) => slide(gi, dx0, dy0, w)).reduce((a, s) => (s.moved < a.moved ? s : a));
        const { dx, dy, b } = best;
        offset[gi] = { dx, dy };
        box[gi] = b;
        placedBy[gi] = how;
        order.push(gi);
    };
    const cellOf = (id) => {
        const gi = groupOf.get(id);
        const p = local[gi].pos.get(id);
        return { gx: p.gx + offset[gi].dx, gy: p.gy + offset[gi].dy };
    };

    const G = members.length;
    const placed = (gi) => offset[gi] !== null;
    /**
     * ⛓ The vertical relation as a DAG: a depth-first walk (the start's group first, then group order; edges in
     * `vertical` order) drops each BACK edge — a cycle (A over B over A) cannot be drawn, so one of its links is not
     * honoured and `stats` counts it.
     */
    const kept = new Array(vertical.length).fill(true);
    {
        const outOf = Array.from({ length: G }, () => []);
        vertical.forEach((v, i) => outOf[v.above].push(i));
        const state = new Array(G).fill(0); // 0 new, 1 on the stack, 2 done
        const visit = (root) => {
            const stack = [[root, 0]];
            state[root] = 1;
            while (stack.length) {
                const top = stack[stack.length - 1];
                const [g, i] = top;
                if (i >= outOf[g].length) {
                    state[g] = 2;
                    stack.pop();
                    continue;
                }
                top[1] += 1;
                const e = outOf[g][i];
                const h = vertical[e].below;
                if (state[h] === 1) kept[e] = false;
                else if (state[h] === 0) {
                    state[h] = 1;
                    stack.push([h, 0]);
                }
            }
        };
        if (G > 0) visit(groupOf.get(start));
        for (let gi = 0; gi < G; gi += 1) if (state[gi] === 0) visit(gi);
    }
    const dag = vertical.filter((_, i) => kept[i]);
    const predsOf = (gi) => dag.filter((v) => v.below === gi);
    const succsOf = (gi) => dag.filter((v) => v.above === gi);

    if (G > 0) {
        const s0 = groupOf.get(start);
        commit(s0, 0, 0, 'start');
        // ⛓ UPWARD: the start's ancestors (groups over it), nearest first — each once all it lies over is placed.
        const anc = new Set();
        const up = [s0];
        while (up.length) {
            for (const v of predsOf(up.shift())) {
                if (!anc.has(v.above) && v.above !== s0) {
                    anc.add(v.above);
                    up.push(v.above);
                }
            }
        }
        for (;;) {
            const pick = dag.find((v) => anc.has(v.above) && !placed(v.above) && placed(v.below)
                && succsOf(v.above).every((w) => !(anc.has(w.below) || w.below === s0) || placed(w.below)));
            if (!pick) break;
            const gi = pick.above;
            const bottom = Math.min(...succsOf(gi).filter((w) => placed(w.below)).map((w) => box[w.below].minY));
            const lower = cellOf(pick.lower);
            const upperLocal = local[gi].pos.get(pick.upper);
            commit(gi, lower.gx - upperLocal.gx, bottom - gap - 1 - localBox[gi].maxY, 'above');
        }
        // ⛓ SOURCES (step 7) wait: a group nothing lies over that lies over something, not yet placed.
        const source = members.map((_, gi) => !placed(gi) && predsOf(gi).length === 0 && succsOf(gi).length > 0);
        const pending = () => members.reduce((n, _, gi) => n + (source[gi] ? 0 : 1), 0);
        // ⛓ DOWNWARD: everything else in topological order (Kahn) — a group reached from a placed one goes BELOW
        //   all it lies under (a waiting source is not waited for); a group nothing above reaches goes RIGHT.
        while (order.length < pending()) {
            const ready = (gi) => !placed(gi) && !source[gi] && predsOf(gi).every((v) => source[v.above] || placed(v.above));
            const pick = dag.find((v) => placed(v.above) && ready(v.below));
            if (pick) {
                const gi = pick.below;
                const top = Math.max(...predsOf(gi).filter((w) => placed(w.above)).map((w) => box[w.above].maxY));
                const upper = cellOf(pick.upper);
                const lowerLocal = local[gi].pos.get(pick.lower);
                commit(gi, upper.gx - lowerLocal.gx, top + gap + 1 - localBox[gi].minY, 'below');
                continue;
            }
            let gi = members.findIndex((_, i) => ready(i));
            // a placed descendant of an unplaced source would make it not "ready" only through a cycle; none is kept
            if (gi < 0) gi = members.findIndex((_, i) => !placed(i) && !source[i]);
            const all = placedBoxes();
            const right = Math.max(...all.map((b) => b.maxX));
            const top = Math.min(...all.map((b) => b.minY));
            commit(gi, right + gap + 1 - localBox[gi].minX, top - localBox[gi].minY, 'right');
        }
        // ⛓ SOURCES, in group order: each `gap` cells over the HIGHEST group it lies over (so every one of its links
        //   still lands below it), its linking node aligned over the linked node of its FIRST SUCCESSOR — the group it
        //   lies over that was placed EARLIEST (`order`); between two links into that group, the first in `vertical`.
        for (let gi = 0; gi < G; gi += 1) {
            if (!source[gi]) continue;
            const succ = succsOf(gi);
            const first = succ.reduce((a, v) => (order.indexOf(v.below) < order.indexOf(a.below) ? v : a));
            const bottom = Math.min(...succ.map((w) => box[w.below].minY));
            const lower = cellOf(first.lower);
            const upperLocal = local[gi].pos.get(first.upper);
            commit(gi, lower.gx - upperLocal.gx, bottom - gap - 1 - localBox[gi].maxY, 'source', ['right', 'left', 'up']);
        }
    }

    const positions = new Map();
    for (const id of nodes) positions.set(id, Object.freeze(cellOf(id)));
    const groups = members.map((m, gi) => Object.freeze({
        id: local[gi].root,
        root: local[gi].root,
        members: Object.freeze([...m]),
        bbox: Object.freeze({ ...box[gi] }),
        placedBy: placedBy[gi],
    }));
    const stats = groupedStats({ nodes, links }, positions, groups, groupOf);
    // ⛓ the vertical relation: links across groups, and how many a cycle made unhonourable (dropped back edges)
    stats.vertical = { links: vertical.length, cycleDropped: kept.filter((k) => !k).length };
    return { positions, groups, stats };
}

/**
 * The legibility census of a grouped layout (`setMapLayout.layoutCensus`'s idea, over ids and signed cells):
 * group count and sizes, directed links honoured (exactly one cell that way) and consistent (in the right
 * quarter-plane), links between edge-adjacent cells, `down` links across groups that landed strictly below
 * (`up` across groups that landed strictly above), `crossLength` (the summed Euclidean length, in cells, of every
 * link between two groups, to 2 decimals: what source placement shortens), and the bounding box.
 */
export function groupedStats({ nodes, links }, positions, groups, groupOf = null) {
    const gOf = groupOf ?? new Map(groups.flatMap((g, gi) => g.members.map((id) => [id, gi])));
    let directed = 0;
    let honoured = 0;
    let consistent = 0;
    let adjacent = 0;
    const down = { across: 0, below: 0 };
    const up = { across: 0, above: 0 };
    let crossLength = 0;
    for (const l of links) {
        if (l.from === l.to) continue;
        const a = positions.get(l.from);
        const b = positions.get(l.to);
        const dx = b.gx - a.gx;
        const dy = b.gy - a.gy;
        if (Math.abs(dx) + Math.abs(dy) === 1) adjacent += 1;
        if (l.dir) {
            directed += 1;
            if (dx === DIRS[l.dir].dx && dy === DIRS[l.dir].dy) honoured += 1;
            const along = DIRS[l.dir].dx * dx + DIRS[l.dir].dy * dy;
            const across = Math.abs(DIRS[l.dir].dy * dx + DIRS[l.dir].dx * dy);
            if (along > 0 && across <= along) consistent += 1;
        }
        const ga = gOf.get(l.from);
        const gb = gOf.get(l.to);
        if (ga === gb) continue;
        crossLength += Math.hypot(dx, dy);
        if (kindOf(l) === 'down') {
            down.across += 1;
            if (groups[gb].bbox.minY > groups[ga].bbox.maxY) down.below += 1;
        } else if (kindOf(l) === 'up') {
            up.across += 1;
            if (groups[gb].bbox.maxY < groups[ga].bbox.minY) up.above += 1;
        }
    }
    const bbox = nodes.length ? bboxOf(positions.values()) : null;
    return {
        nodes: nodes.length,
        links: links.length,
        groups: groups.length,
        sizes: groups.map((g) => g.members.length),
        directed,
        honoured,
        consistent,
        adjacent,
        down,
        up,
        crossLength: Math.round(crossLength * 100) / 100,
        bbox,
    };
}
