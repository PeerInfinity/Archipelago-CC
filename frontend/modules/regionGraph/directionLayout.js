/**
 * ⛓ THE DIRECTION-AWARE LAYOUT (region-graph-direction-layout). A Region Graph layout that PREFERS to place each
 * neighbouring region in the direction of the exit that leads to it — a SOFT preference, never a fixed relative
 * position.
 *
 * ⚖ The user, session 84c8ab35: 2026-11-26T02:25:14.974Z "after that, I'll want to experiment with some advanced layout
 * settings for the Region Graph. Is there a way to tell it to prefer for neighboring regions to be placed according to
 * the direction of their exits?"; 2026-11-26T02:33:46.839Z "One complication we encountered in arranging the nodes in
 * the Region Map is that some regions have exits to two different regions along the same side. I'll want the new
 * layout code to be able to handle this by putting the nodes as close as it can to the preferred layout, not by having
 * the nodes in fixed positions relative to each other."
 *
 * ── 1. THE PREFERRED OFFSET PER EXIT (`doorOffset`) ──────────────────────────────────────────────────────────────
 * An exit's door tile `(x, y)` (`regionMapModel.exitTileOf`: `x, y` or `exit_tiles[0]`, in its own level's tiles) and
 * its level's extent `W × H` (the Region Map model's cell extent: `compositeMap.regionExtent`, through the registry):
 *     u = (x + ½) / W − ½,   v = (y + ½) / H − ½          (each in [−½, ½]; +u = right, +v = down, as on screen)
 *   · the door's SIDE is the larger of |u|, |v| with its sign: E / W (|u| ≥ |v|) or S / N;
 *   · its place ALONG that side is t = 2v (E / W) or 2u (N / S), in [−1, 1] (−1 = the top / left end);
 *   · the preferred DIRECTION from the region to the exit's target is the side's outward normal tilted along the side
 *     by `DOOR_TILT · t`, normalised: E → (1, ½t). A door in the middle of the east edge points straight right; one
 *     near its top end points up-right (≈ 24° at the corner), one near its bottom end down-right — so two exits on one
 *     side point to two different spots, and the tilt never takes a door past its own side's 45° wedge;
 *   · its WEIGHT is 1 for a door ON the level's border (a walk-off-the-edge door), else `min(1, 2·max(|u|, |v|))`
 *     (an interior door — a staircase in the middle — says less about where its target lies).
 * An exit with no door tile, no extent, or a door at the exact centre has NO preference. With `exits` = `border` (the
 * default) only border doors give one.
 *
 * ── 2. THE PREFERENCE PER DRAWN EDGE (`edgePreferences`) ─────────────────────────────────────────────────────────
 * A drawn edge S–T stands for every exit from a member of S to a member of T (and back). Each S→T exit adds its
 * weighted direction; each T→S exit adds the NEGATED one (T's door on its west side means S lies west of T, so T lies
 * east of S). The sum's direction is the edge's preferred direction, its weight `|Σ wᵢ·dᵢ| / n` (so exits that
 * disagree weaken each other). A merged node (`subRegionView` = merged / collapsible) takes every member's exits: B's
 * merge rule keeps every exit, and so does this. An edge with no exit preference has none, and lays out on length
 * alone.
 *
 * ── 3. THE LAYOUT (`directionLayout`) — a VECTOR-SPRING relaxation ────────────────────────────────────────────────
 * Every edge is a spring whose rest state is a VECTOR, not only a length: with strength s and an edge preference
 * (d, ω), the spring pulls the target towards `source + L·d` with weight s·ω and towards distance L with weight 1 − s·ω.
 * L is the distance at which the two drawn boxes just clear each other along that direction, plus the spacing. All
 * pairs repel (Fruchterman–Reingold, k²/r), boxes that overlap (plus a margin) are pushed apart, and the moves are
 * capped by a cooling temperature. The start is a deterministic BFS seed that already places each neighbour on its
 * preferred side (s > 0). Components lay out on their own and are shelf-packed. A final pass separates any boxes that
 * still overlap (pushing, then scaling about the centre: it always ends with 0 overlaps).
 * Nothing is fixed: two neighbours that want one spot both pull towards it and the repulsion and overlap push share it
 * out — each lands as near its own preferred direction as the others allow (⚖ 02:33:46Z).
 *
 * ⛔ DETERMINISTIC: nodes are sorted by id and edges by (source, target) before anything is read; no `Math.random`, no
 * clock, no Map/Set iteration order the caller controls. Two calls with the same nodes and edges in ANY insertion order
 * give the same positions.
 *
 * ⛔ PURE: no DOM, no Cytoscape, no singletons, no substrate named. The panel's glue is `layoutControlsManager.js`.
 */

/* ── settings ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export const DIRECTION_STRENGTH_KEY = 'moduleSettings.regionGraph.directionStrength';
export const DIRECTION_SPACING_KEY = 'moduleSettings.regionGraph.directionSpacing';
export const DIRECTION_EXITS_KEY = 'moduleSettings.regionGraph.directionExits';

/** The three settings' schema entries — each `default` is the ONLY default (`settingsManager.getSetting` falls back). */
export const DIRECTION_STRENGTH_SCHEMA = Object.freeze({
    type: 'number', default: 0.7, minimum: 0, maximum: 1,
    label: 'Direction strength',
    description: 'How strongly the Direction-aware layout places each neighbour on the side of the exit that leads to '
        + 'it: 0 = a plain spring layout (exit directions ignored), 1 = as close to map-like as it can get.',
});
export const DIRECTION_SPACING_SCHEMA = Object.freeze({
    type: 'number', default: 40, minimum: 0, maximum: 300,
    label: 'Direction spacing',
    description: 'The gap (graph pixels) the Direction-aware layout aims for between two neighbouring nodes\' borders.',
});
export const DIRECTION_EXITS_SCHEMA = Object.freeze({
    type: 'string', default: 'border', enum: Object.freeze(['all', 'border']),
    label: 'Direction exits',
    description: 'Which exits give a direction: only doors on the level\'s border, the walk-off-the-edge kind (border), '
        + 'or every door with a position in its level, staircases and teleporters inside it too (all).',
});
export const DIRECTION_EXITS_LABELS = Object.freeze({ border: 'Border doors only', all: 'All doors' });

/** The settings, as the schema says them (a stored value out of range or of the wrong type reads as the default). */
export function normaliseDirectionSettings({ strength, spacing, exits } = {}) {
    const num = (v, s) => (Number.isFinite(Number(v)) && v !== null && v !== '' && typeof v !== 'boolean'
        ? Math.min(s.maximum, Math.max(s.minimum, Number(v))) : s.default);
    return {
        strength: num(strength, DIRECTION_STRENGTH_SCHEMA),
        spacing: num(spacing, DIRECTION_SPACING_SCHEMA),
        exits: DIRECTION_EXITS_SCHEMA.enum.includes(exits) ? exits : DIRECTION_EXITS_SCHEMA.default,
    };
}

/** The layout preset's id in the Layout Preset select. */
export const DIRECTION_LAYOUT_PRESET = 'direction-aware';

/* ── 1. the offset rule ───────────────────────────────────────────────────────────────────────────────────────── */

/** How far a door's place along its side tilts its direction off the side's normal: tan(max tilt) at the corner. */
export const DOOR_TILT = 0.5;

/**
 * The preferred offset of a door at tile `[x, y]` in a level of `{w, h}` tiles → `{u, v, dx, dy, weight, side,
 * border}`, or null (no tile, no extent, or a door at the exact centre).
 */
export function doorOffset(tile, extent, tilt = DOOR_TILT) {
    if (!Array.isArray(tile) || !extent || !(extent.w > 0) || !(extent.h > 0)) return null;
    const [x, y] = tile;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const u = (x + 0.5) / extent.w - 0.5;
    const v = (y + 0.5) / extent.h - 0.5;
    if (!(Math.max(Math.abs(u), Math.abs(v)) > 1e-9)) return null;
    const horizontal = Math.abs(u) >= Math.abs(v);
    const side = horizontal ? (u > 0 ? 'E' : 'W') : (v > 0 ? 'S' : 'N');
    // The side's outward normal, tilted along the side by where the door sits on it (t in [-1, 1]).
    const t = horizontal ? 2 * v : 2 * u;
    const nx = horizontal ? Math.sign(u) : tilt * t;
    const ny = horizontal ? tilt * t : Math.sign(v);
    const r = Math.hypot(nx, ny);
    const border = x <= 0 || y <= 0 || x >= extent.w - 1 || y >= extent.h - 1;
    const weight = border ? 1 : Math.min(1, 2 * Math.max(Math.abs(u), Math.abs(v)));
    return { u, v, along: t, dx: nx / r, dy: ny / r, weight, side, border };
}

/**
 * Every rules exit's preferred offset, from the rules' sidecars and the Region Map model (`buildRegionMapModel`):
 * `[{from, to, exitName, ...doorOffset}]` (rules region names), sorted (from, to, exitName). `tileOf` is
 * `regionMapModel.exitTileOf` (passed in, so this file imports nothing). Also the per-preset counts:
 * `{exits, withDirection, without, border, twoOnOneSide: [{region, side, targets}], twoOnOneSideLevels: [{level, side,
 * targets}]}` — `twoOnOneSide` lists every rules region with BORDER doors on one side leading to 2+ different rules
 * regions; `twoOnOneSideLevels` the same per display region (the level a merged node draws), its targets display keys.
 * @param {object} args - { sidecars (`preset_sidecars[player]`), model, tileOf, exits: 'all' | 'border' }
 */
export function exitDirections({ sidecars, model, tileOf, exits = DIRECTION_EXITS_SCHEMA.default, tilt = DOOR_TILT }) {
    const keyOf = new Map();
    for (const [key, cell] of model?.cells ?? []) for (const m of cell.members) keyOf.set(m, key);
    const out = [];
    const counts = { exits: 0, withDirection: 0, without: 0, border: 0 };
    const sides = new Map();
    const levelSides = new Map();
    for (const name of Object.keys(sidecars ?? {}).sort(cmp)) {
        for (const e of sidecars[name]?.playable_payload?.exits ?? []) {
            const to = e?.targetRegion;
            if (typeof to !== 'string' || to === name) continue;
            counts.exits += 1;
            const extent = model?.cells?.get(keyOf.get(name))?.extent ?? null;
            const off = doorOffset(tileOf(e), extent, tilt);
            if (!off || (exits === 'border' && !off.border)) { counts.without += 1; continue; }
            counts.withDirection += 1;
            if (off.border) {
                counts.border += 1;
                const k = `${name}\u0000${off.side}`;
                if (!sides.has(k)) sides.set(k, new Set());
                sides.get(k).add(to);
                const from = keyOf.get(name); const toKey = keyOf.get(to);
                if (from !== undefined && toKey !== undefined && from !== toKey) {
                    const lk = `${from}\u0000${off.side}`;
                    if (!levelSides.has(lk)) levelSides.set(lk, new Set());
                    levelSides.get(lk).add(toKey);
                }
            }
            out.push({ from: name, to, exitName: e.exitName ?? e.exit_id ?? '', ...off });
        }
    }
    out.sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.exitName, b.exitName) || a.u - b.u || a.v - b.v);
    const twoOnOneSide = [];
    for (const [k, targets] of sides) {
        if (targets.size < 2) continue;
        const [region, side] = k.split('\u0000');
        twoOnOneSide.push({ region, side, targets: [...targets].sort(cmp) });
    }
    twoOnOneSide.sort((a, b) => cmp(a.region, b.region) || cmp(a.side, b.side));
    const twoOnOneSideLevels = [];
    for (const [k, targets] of levelSides) {
        if (targets.size < 2) continue;
        const [level, side] = k.split('\u0000');
        twoOnOneSideLevels.push({ level, side, targets: [...targets].sort(cmp) });
    }
    twoOnOneSideLevels.sort((a, b) => cmp(a.level, b.level) || cmp(a.side, b.side));
    return { directions: out, counts: { ...counts, twoOnOneSide, twoOnOneSideLevels } };
}

/* ── 2. the preference per drawn edge ─────────────────────────────────────────────────────────────────────────── */

/**
 * The preferred direction of each drawn edge. `nodes` = `[{id, members?}]` (`members`: the rules regions a merged node
 * stands for; a plain region node stands for itself), `edges` = `[{id, source, target}]`, `directions` from
 * `exitDirections`. → `Map<edgeId, {dx, dy, weight, exits}>` (only edges with a preference).
 */
export function edgePreferences(nodes, edges, directions) {
    const nodeOf = new Map();
    for (const n of nodes) {
        const members = Array.isArray(n.members) && n.members.length ? n.members : [n.id];
        for (const m of members) nodeOf.set(m, n.id);
    }
    const byPair = new Map();
    for (const d of directions) {
        const a = nodeOf.get(d.from);
        const b = nodeOf.get(d.to);
        if (a === undefined || b === undefined || a === b) continue;
        const k = `${a}\u0000${b}`;
        if (!byPair.has(k)) byPair.set(k, []);
        byPair.get(k).push(d);
    }
    const out = new Map();
    for (const e of edges) {
        let sx = 0; let sy = 0; let n = 0;
        for (const d of byPair.get(`${e.source}\u0000${e.target}`) ?? []) { sx += d.weight * d.dx; sy += d.weight * d.dy; n += 1; }
        for (const d of byPair.get(`${e.target}\u0000${e.source}`) ?? []) { sx -= d.weight * d.dx; sy -= d.weight * d.dy; n += 1; }
        const r = Math.hypot(sx, sy);
        if (n === 0 || !(r > 1e-9)) continue;
        out.set(e.id, { dx: sx / r, dy: sy / r, weight: Math.min(1, r / n), exits: n });
    }
    return out;
}

/* ── 3. the layout ────────────────────────────────────────────────────────────────────────────────────────────── */

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** The centre distance at which boxes `a` and `b` just clear each other along unit direction (dx, dy). */
export function clearance(a, b, dx, dy) {
    const hw = (a.w + b.w) / 2;
    const hh = (a.h + b.h) / 2;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const tx = ax > 1e-9 ? hw / ax : Infinity;
    const ty = ay > 1e-9 ? hh / ay : Infinity;
    return Math.min(tx, ty);
}

/** Do the boxes (centre x, y; size w, h) overlap by more than `eps` on both axes? */
const overlapsAt = (pa, a, pb, b, margin = 0) => Math.abs(pa.x - pb.x) < (a.w + b.w) / 2 + margin - 1e-6
    && Math.abs(pa.y - pb.y) < (a.h + b.h) / 2 + margin - 1e-6;

/** Default tuning (not user settings): iterations, the repulsion and the overlap margin. */
export const DIRECTION_LAYOUT_TUNING = Object.freeze({ iterations: 300, repulsion: 0.02, gravity: 0.05, componentGap: 1.5 });

/**
 * Lay out `nodes` (`[{id, w, h, group?}]`, sizes in graph px) joined by `edges` (`[{id, source, target, pref?}]`,
 * `pref` = `{dx, dy, weight}` from `edgePreferences`). → `{positions: Map<id, {x, y}>, stats}`.
 * `group` (optional): nodes sharing one are pulled a little towards their common centre (a `nested` box's members).
 * `dungeon` (optional) and `opts.dungeonPull` (region-graph-dungeon-groups, `dungeonGroups.js`'s `soft` value):
 * `{strength, pull, push, reach}` — each node with a dungeon is pulled towards its dungeon's centre (weight
 * strength·pull) and pushed from every node of ANOTHER dungeon nearer than reach·L (weight strength·push). Absent or
 * strength 0: no term runs, so the positions are exactly those without it.
 * @param {object} opts - { strength, spacing, dungeonPull? } (see the schema entries), plus `tuning` overrides
 */
export function directionLayout(nodes, edges, { strength = DIRECTION_STRENGTH_SCHEMA.default, spacing = DIRECTION_SPACING_SCHEMA.default, tuning = {}, dungeonPull = null } = {}) {
    const T = { ...DIRECTION_LAYOUT_TUNING, ...tuning };
    const s = Math.min(1, Math.max(0, Number(strength) || 0));
    const gap = Math.max(0, Number(spacing) || 0);
    const ns = [...nodes].map((n) => ({ id: String(n.id), w: Math.max(1, +n.w || 1), h: Math.max(1, +n.h || 1), group: n.group ?? null, dungeon: n.dungeon ?? null }))
        .sort((a, b) => cmp(a.id, b.id));
    const dp = dungeonPull && dungeonPull.strength > 0 ? dungeonPull : null;
    const idx = new Map(ns.map((n, i) => [n.id, i]));
    // Edges: one per unordered pair, oriented smaller → larger id (a preference flips with it), sorted.
    const pairs = new Map();
    for (const e of edges) {
        const a = idx.get(String(e.source));
        const b = idx.get(String(e.target));
        if (a === undefined || b === undefined || a === b) continue;
        const flip = a > b;
        const [i, j] = flip ? [b, a] : [a, b];
        const k = i * ns.length + j;
        const pref = e.pref && s > 0 ? { dx: flip ? -e.pref.dx : e.pref.dx, dy: flip ? -e.pref.dy : e.pref.dy, w: e.pref.weight ?? 1 } : null;
        const prev = pairs.get(k);
        if (!prev) { pairs.set(k, { i, j, pref }); continue; }
        if (pref) {
            // Two drawn edges on one pair (cannot happen in the panel, which draws one per pair): add their vectors.
            const p = prev.pref ?? { dx: 0, dy: 0, w: 0 };
            const x = p.dx * p.w + pref.dx * pref.w; const y = p.dy * p.w + pref.dy * pref.w; const r = Math.hypot(x, y);
            prev.pref = r > 1e-9 ? { dx: x / r, dy: y / r, w: Math.min(1, r) } : null;
        }
    }
    const es = [...pairs.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e);
    const adj = ns.map(() => []);
    for (const e of es) { adj[e.i].push(e); adj[e.j].push(e); }

    const sizeRef = ns.length ? ns.reduce((acc, n) => acc + Math.max(n.w, n.h), 0) / ns.length : 1;
    const Lref = sizeRef + gap;
    const restOf = (e, dx, dy) => clearance(ns[e.i], ns[e.j], dx, dy) + gap;

    // Components, in order of their smallest member.
    const comp = new Array(ns.length).fill(-1);
    const comps = [];
    for (let r = 0; r < ns.length; r += 1) {
        if (comp[r] !== -1) continue;
        const members = [];
        const queue = [r];
        comp[r] = comps.length;
        while (queue.length) {
            const v = queue.shift();
            members.push(v);
            for (const e of adj[v]) {
                const w = e.i === v ? e.j : e.i;
                if (comp[w] === -1) { comp[w] = comps.length; queue.push(w); }
            }
        }
        comps.push(members.sort((a, b) => a - b));
    }

    const pos = ns.map(() => ({ x: 0, y: 0 }));
    let iterations = 0;
    for (const members of comps) iterations += layoutComponent(members);

    // Shelf-pack the components (largest first; ties by smallest member), left to right, rows ~ square overall.
    const boxes = comps.map((members, c) => {
        let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
        for (const v of members) {
            x1 = Math.min(x1, pos[v].x - ns[v].w / 2); x2 = Math.max(x2, pos[v].x + ns[v].w / 2);
            y1 = Math.min(y1, pos[v].y - ns[v].h / 2); y2 = Math.max(y2, pos[v].y + ns[v].h / 2);
        }
        return { c, x1, y1, w: x2 - x1, h: y2 - y1, n: members.length };
    }).sort((a, b) => b.n - a.n || b.w * b.h - a.w * a.h || a.c - b.c);
    const cgap = Lref * T.componentGap;
    const area = boxes.reduce((acc, b) => acc + (b.w + cgap) * (b.h + cgap), 0);
    const rowWidth = Math.max(boxes[0]?.w ?? 0, Math.sqrt(area) * 1.2);
    let cx = 0; let cy = 0; let rowH = 0;
    for (const b of boxes) {
        if (cx > 0 && cx + b.w > rowWidth) { cx = 0; cy += rowH + cgap; rowH = 0; }
        const ox = cx - b.x1; const oy = cy - b.y1;
        for (const v of comps[b.c]) { pos[v].x += ox; pos[v].y += oy; }
        cx += b.w + cgap;
        rowH = Math.max(rowH, b.h);
    }

    const separation = separate(ns, pos, Math.min(4, gap / 4));
    const positions = new Map(ns.map((n, i) => [n.id, { x: round(pos[i].x), y: round(pos[i].y) }]));
    return {
        positions,
        stats: { nodes: ns.length, edges: es.length, preferred: es.filter((e) => e.pref).length, components: comps.length,
            iterations, ...separation },
    };

    /** Seed + relax one component (indices into `ns`, sorted). → the iterations run. */
    function layoutComponent(members) {
        if (members.length === 1) { pos[members[0]] = { x: 0, y: 0 }; return 0; }
        // Seed: BFS from the highest-degree member (ties: smallest id), each child on its preferred side.
        let root = members[0];
        for (const v of members) if (adj[v].length > adj[root].length) root = v;
        const placed = new Set([root]);
        pos[root] = { x: 0, y: 0 };
        const queue = [root];
        let spin = 0;
        while (queue.length) {
            const v = queue.shift();
            const kids = adj[v].map((e) => ({ e, w: e.i === v ? e.j : e.i })).filter(({ w }) => !placed.has(w))
                .sort((a, b) => a.w - b.w);
            for (const { e, w } of kids) {
                let dx; let dy;
                if (e.pref) {
                    const sign = e.i === v ? 1 : -1;
                    dx = sign * e.pref.dx; dy = sign * e.pref.dy;
                } else {
                    spin += 1;
                    dx = Math.cos(spin * GOLDEN); dy = Math.sin(spin * GOLDEN);
                }
                const L = restOf(e, dx, dy);
                pos[w] = { x: pos[v].x + dx * L, y: pos[v].y + dy * L };
                placed.add(w);
                queue.push(w);
            }
        }
        // Coincident seeds: nudge apart deterministically.
        nudgeCoincident(members, pos);

        const N = T.iterations;
        const k2 = Lref * Lref * T.repulsion;
        const margin = gap / 2;
        const fx = new Float64Array(ns.length);
        const fy = new Float64Array(ns.length);
        const compEdges = es.filter((e) => comp[e.i] === comp[members[0]]);
        const groups = new Map();
        for (const v of members) if (ns[v].group != null) {
            if (!groups.has(ns[v].group)) groups.set(ns[v].group, []);
            groups.get(ns[v].group).push(v);
        }
        // ⛓ soft dungeon grouping (only when `dungeonPull` is on): the dungeons of this component, by key order.
        const dungeons = new Map();
        if (dp) {
            for (const v of members) if (ns[v].dungeon != null) {
                const k = String(ns[v].dungeon);
                if (!dungeons.has(k)) dungeons.set(k, []);
                dungeons.get(k).push(v);
            }
        }
        const dPull = dp ? dp.strength * dp.pull : 0;
        const dPush = dp ? dp.strength * dp.push : 0;
        const dReach = dp ? dp.reach * Lref : 0;
        for (let it = 0; it < N; it += 1) {
            const temp = Lref * 0.5 * (1 - it / N) + 0.5;
            for (const v of members) { fx[v] = 0; fy[v] = 0; }
            // Springs.
            for (const e of compEdges) {
                const a = pos[e.i]; const b = pos[e.j];
                let ddx = b.x - a.x; let ddy = b.y - a.y;
                let r = Math.hypot(ddx, ddy);
                if (r < 1e-9) { ddx = 1e-3; ddy = 0; r = 1e-3; }
                const ux = ddx / r; const uy = ddy / r;
                const ws = e.pref ? s * e.pref.w : 0;
                if (ws > 0) {
                    const L = restOf(e, e.pref.dx, e.pref.dy);
                    const ex = e.pref.dx * L - ddx; const ey = e.pref.dy * L - ddy;
                    fx[e.j] += 0.5 * ws * ex; fy[e.j] += 0.5 * ws * ey;
                    fx[e.i] -= 0.5 * ws * ex; fy[e.i] -= 0.5 * ws * ey;
                }
                const wl = 1 - ws;
                if (wl > 0) {
                    const L = restOf(e, ux, uy);
                    const f = 0.5 * wl * (r - L);
                    fx[e.i] += f * ux; fy[e.i] += f * uy;
                    fx[e.j] -= f * ux; fy[e.j] -= f * uy;
                }
            }
            // Repulsion (all pairs) and the overlap push.
            for (let p = 0; p < members.length; p += 1) {
                const a = members[p];
                for (let q = p + 1; q < members.length; q += 1) {
                    const b = members[q];
                    let ddx = pos[b].x - pos[a].x; let ddy = pos[b].y - pos[a].y;
                    let r2 = ddx * ddx + ddy * ddy;
                    if (r2 < 1e-6) { ddx = 1e-3 * (q - p); ddy = 1e-3; r2 = ddx * ddx + ddy * ddy; }
                    const f = k2 / r2;
                    fx[a] -= f * ddx; fy[a] -= f * ddy;
                    fx[b] += f * ddx; fy[b] += f * ddy;
                    const ox = (ns[a].w + ns[b].w) / 2 + margin - Math.abs(ddx);
                    const oy = (ns[a].h + ns[b].h) / 2 + margin - Math.abs(ddy);
                    if (ox > 0 && oy > 0) {
                        if (ox < oy) {
                            const push = 0.5 * ox * (ddx >= 0 ? 1 : -1);
                            fx[a] -= push; fx[b] += push;
                        } else {
                            const push = 0.5 * oy * (ddy >= 0 ? 1 : -1);
                            fy[a] -= push; fy[b] += push;
                        }
                    }
                    // ⛓ soft dungeon grouping: two nodes of DIFFERENT dungeons nearer than the reach push apart.
                    if (dp && ns[a].dungeon != null && ns[b].dungeon != null && ns[a].dungeon !== ns[b].dungeon) {
                        const r = Math.sqrt(r2);
                        if (r < dReach) {
                            const f2 = (0.5 * dPush * (dReach - r)) / r;
                            fx[a] -= f2 * ddx; fy[a] -= f2 * ddy;
                            fx[b] += f2 * ddx; fy[b] += f2 * ddy;
                        }
                    }
                }
            }
            // Gravity towards the component's centre; a nested box's members towards their own centre.
            let gx = 0; let gy = 0;
            for (const v of members) { gx += pos[v].x; gy += pos[v].y; }
            gx /= members.length; gy /= members.length;
            for (const v of members) { fx[v] += T.gravity * (gx - pos[v].x); fy[v] += T.gravity * (gy - pos[v].y); }
            for (const g of groups.values()) {
                if (g.length < 2) continue;
                let hx = 0; let hy = 0;
                for (const v of g) { hx += pos[v].x; hy += pos[v].y; }
                hx /= g.length; hy /= g.length;
                for (const v of g) { fx[v] += 0.1 * (hx - pos[v].x); fy[v] += 0.1 * (hy - pos[v].y); }
            }
            for (const g of dungeons.values()) {
                if (g.length < 2) continue;
                let hx = 0; let hy = 0;
                for (const v of g) { hx += pos[v].x; hy += pos[v].y; }
                hx /= g.length; hy /= g.length;
                for (const v of g) { fx[v] += dPull * (hx - pos[v].x); fy[v] += dPull * (hy - pos[v].y); }
            }
            for (const v of members) {
                const m = Math.hypot(fx[v], fy[v]);
                const k = m > temp ? temp / m : 1;
                pos[v].x += fx[v] * k; pos[v].y += fy[v] * k;
            }
        }
        return N;
    }
}

const round = (x) => Math.round(x * 100) / 100;

function nudgeCoincident(members, pos) {
    const seen = new Map();
    for (const v of members) {
        const k = `${Math.round(pos[v].x * 1000)},${Math.round(pos[v].y * 1000)}`;
        const n = seen.get(k) ?? 0;
        if (n > 0) { pos[v].x += Math.cos(n * GOLDEN) * n; pos[v].y += Math.sin(n * GOLDEN) * n; }
        seen.set(k, n + 1);
    }
}

/**
 * The final pass: push overlapping boxes apart (each pair along its smaller penetration, half each way), and when that
 * stalls, scale every position about the centre by 5 % and try again. Positions are distinct (nudged), so a scale
 * always ends it. → `{separationPasses, separationScales}`.
 */
function separate(ns, pos, margin) {
    const n = ns.length;
    nudgeCoincident(ns.map((_, i) => i), pos);
    let passes = 0; let scales = 0;
    for (let round = 0; round < 400; round += 1) {
        let any = false;
        for (let pass = 0; pass < 30; pass += 1) {
            passes += 1;
            any = false;
            for (let a = 0; a < n; a += 1) {
                for (let b = a + 1; b < n; b += 1) {
                    if (!overlapsAt(pos[a], ns[a], pos[b], ns[b], margin)) continue;
                    any = true;
                    const ddx = pos[b].x - pos[a].x; const ddy = pos[b].y - pos[a].y;
                    const ox = (ns[a].w + ns[b].w) / 2 + margin - Math.abs(ddx);
                    const oy = (ns[a].h + ns[b].h) / 2 + margin - Math.abs(ddy);
                    if (ox < oy) {
                        const push = (ox / 2 + 0.01) * (ddx > 0 || (ddx === 0 && b > a) ? 1 : -1);
                        pos[a].x -= push; pos[b].x += push;
                    } else {
                        const push = (oy / 2 + 0.01) * (ddy > 0 || (ddy === 0 && b > a) ? 1 : -1);
                        pos[a].y -= push; pos[b].y += push;
                    }
                }
            }
            if (!any) return { separationPasses: passes, separationScales: scales };
        }
        let cx = 0; let cy = 0;
        for (const p of pos) { cx += p.x; cy += p.y; }
        cx /= n; cy /= n;
        for (const p of pos) { p.x = cx + (p.x - cx) * 1.05; p.y = cy + (p.y - cy) * 1.05; }
        scales += 1;
    }
    return { separationPasses: passes, separationScales: scales };
}

/* ── measures ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The overlapping pairs of drawn boxes at `positions` (strict: touching boxes do not overlap). */
export function overlapCount(nodes, positions) {
    const ns = [...nodes].sort((a, b) => cmp(String(a.id), String(b.id)));
    let k = 0;
    for (let a = 0; a < ns.length; a += 1) {
        const pa = positions.get(String(ns[a].id));
        if (!pa) continue;
        for (let b = a + 1; b < ns.length; b += 1) {
            const pb = positions.get(String(ns[b].id));
            if (pb && overlapsAt(pa, ns[a], pb, ns[b], 0)) k += 1;
        }
    }
    return k;
}

/**
 * The angle error (degrees, 0–180) between each preferred edge's direction and its actual one at `positions`:
 * `[{id, error}]` sorted by id, and `{mean, p90, max, n}`.
 */
export function angleErrors(edges, prefs, positions) {
    const rows = [];
    for (const e of edges) {
        const p = prefs.get(e.id);
        const a = positions.get(String(e.source));
        const b = positions.get(String(e.target));
        if (!p || !a || !b) continue;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const r = Math.hypot(dx, dy);
        if (!(r > 1e-9)) { rows.push({ id: e.id, error: 180 }); continue; }
        const c = Math.max(-1, Math.min(1, (dx * p.dx + dy * p.dy) / r));
        rows.push({ id: e.id, error: (Math.acos(c) * 180) / Math.PI });
    }
    rows.sort((x, y) => cmp(x.id, y.id));
    const errs = rows.map((r) => r.error).sort((x, y) => x - y);
    const mean = errs.length ? errs.reduce((acc, x) => acc + x, 0) / errs.length : null;
    const p90 = errs.length ? errs[Math.min(errs.length - 1, Math.ceil(errs.length * 0.9) - 1)] : null;
    return { rows, mean, p90, max: errs.length ? errs[errs.length - 1] : null, n: errs.length };
}

/** A digest-friendly canonical string of positions (sorted ids, 2 decimals). */
export function positionsKey(positions) {
    return [...positions.entries()].sort((a, b) => cmp(a[0], b[0])).map(([id, p]) => `${id}:${p.x},${p.y}`).join('|');
}
