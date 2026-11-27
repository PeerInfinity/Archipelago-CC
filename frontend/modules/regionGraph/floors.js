/**
 * ⛓ FLOORS FOR THE TWO-STEP DUNGEON GROUPING (region-graph-floors). The Region Map's groups (`dungeonGroups.js`) are
 * FLOORS: R1 joins only `join` links, so stairs and pits always lead from one group to another. This file turns that
 * into a floor layout for the Region Graph's `twoStep` / `twoStepBoxes` values:
 *   · a VERTICAL link (a stair or a pit) gets a direction from where its tile sits in its level (option (a)), and the
 *     block step lays two floors joined by one out at a LONGER distance (the Floor gap), in that direction;
 *   · every group gets a FLOOR NUMBER, the start region's group the ground floor, and the boxes are labelled by it.
 *
 * ⚖ The user, session 84c8ab35: 2026-11-27T17:40:33.236Z "I want regions connected by a north south link to appear
 * adjacent to each other. I want regions connected by an up down link to be further apart, but with the correct
 * direction in the map." — and, offered (a) where the stairs are in the level, (b) a fixed offset, (c) one fixed
 * direction per kind, 2026-11-27T17:46:25.944Z: "I choose option a. Adjacent regions would work the way they do now.
 * And I want to apply this just to the region graph for now. Let's make this a modification to the current dungeon
 * system, where instead of labeling by the first region in the group, we label by the floor number, with the starting
 * region being ground floor."
 *
 * ── 1. WHAT IS VERTICAL ──────────────────────────────────────────────────────────────────────────────────────────
 * The Region Map model's own layout graph (`model.layout.graph.links`, `{from, to, kind}` over DISPLAY keys) says each
 * link's kind: `down` (from → a lower floor), `up` (from → a higher floor), `warp` or `join`. Every directed display
 * pair carries ONE kind (measured on the frozen seedling_playthrough: 0 pairs with two), so a rules exit's kind is its
 * display pair's kind. A vertical link is a `down` / `up` link between two DIFFERENT groups. (A stair inside one group
 * — the group joined by a walk elsewhere — is a flat link and stays as it was.) No substrate is named here: the kinds
 * are whatever the world's `compositeMap.layoutGraph` said; a world without one (alttp, the maze) has no vertical link.
 *
 * ── 2. THE DIRECTION OF A VERTICAL LINK (`stairOffset`) ──────────────────────────────────────────────────────────
 * The SAME normalisation as a door (`directionLayout.js` `doorOffset`): the exit's tile `(x, y)` in its level of `W × H`
 * tiles → `u = (x + ½) / W − ½`, `v = (y + ½) / H − ½`. But a stair is usually INTERIOR, so not the door's edge-SIDE
 * rule: the VECTOR rule, the direction `(u, v) / |(u, v)|` from the level's centre to the tile. Stairs in the east of a
 * level put the floor they lead to further east. Weight `min(1, 2·max(|u|, |v|))` (the interior-door weight: a stair
 * near the centre says little). A tile within `STAIR_CENTRE_TOLERANCE` of the centre on both axes (|u|, |v| ≤ 0.05:
 * the middle tenth of the level) gives NO direction: length only. So does a missing tile or extent.
 *
 * ── 3. FLOOR NUMBERS (`floorNumbers`) ────────────────────────────────────────────────────────────────────────────
 * Over the GROUP graph of vertical links, BFS from the start region's group (floor 0, the ground floor): crossing a
 * `down` link from → to gives to = from − 1, an `up` link to = from + 1 (crossed backwards, the opposite). Groups and
 * links in sorted id order; the FIRST assignment wins. A link that reaches an already-numbered group at a DIFFERENT
 * number is a CONFLICT (reported with both paths). A group no vertical path from the start reaches (warp-only, the
 * Menu, disconnected) has no number: "Floor ?".
 *
 * ── 4. LABELS (`floorLabels`) ────────────────────────────────────────────────────────────────────────────────────
 * "Ground floor", "Floor +1", "Floor −1", … and "Floor ?". When 2+ groups share a number, each gets " · k", k = its
 * place in BFS discovery order on that floor (1 = the first reached, the one nearest the start by links). The
 * unnumbered groups all read "Floor ?" (no suffix: discovery order from the start says nothing about them). The labels belong to the model (every group, boxed or not), so a group's label is
 * the same in every view. The group's root level id stays in the box's tooltip.
 *
 * ⛔ DETERMINISTIC: sorted ids everywhere; no clock, no `Math.random`. ⛔ PURE: no DOM, no Cytoscape, no substrate.
 */

/* ── the setting ──────────────────────────────────────────────────────────────────────────────────────────────── */

export const FLOOR_GAP_KEY = 'moduleSettings.regionGraph.floorGap';
export const FLOOR_GAP_SCHEMA = Object.freeze({
    type: 'number', default: 160, minimum: 0, maximum: 600,
    label: 'Floor gap',
    description: 'Two-step values only: the gap (graph pixels) the layout aims for between two floors joined by stairs '
        + 'or a pit, in place of the spacing. Flat links (walking from one region to the next) keep the spacing.',
});

/** The floor gap as the schema says it (out of range clamped; a wrong type reads as the default). */
export function normaliseFloorGap(v) {
    const s = FLOOR_GAP_SCHEMA;
    return Number.isFinite(Number(v)) && v !== null && v !== '' && typeof v !== 'boolean'
        ? Math.min(s.maximum, Math.max(s.minimum, Number(v))) : s.default;
}

/* ── 2. the direction rule ────────────────────────────────────────────────────────────────────────────────────── */

export const STAIR_CENTRE_TOLERANCE = 0.05;

/**
 * The preferred direction of a stair / pit at tile `[x, y]` in a level of `{w, h}` tiles → `{u, v, dx, dy, weight}`,
 * `{u, v, centre: true}` (within the tolerance of the centre: no direction), or null (no tile, no extent).
 */
export function stairOffset(tile, extent, tol = STAIR_CENTRE_TOLERANCE) {
    if (!Array.isArray(tile) || !extent || !(extent.w > 0) || !(extent.h > 0)) return null;
    const [x, y] = tile;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const u = (x + 0.5) / extent.w - 0.5;
    const v = (y + 0.5) / extent.h - 0.5;
    if (Math.abs(u) <= tol && Math.abs(v) <= tol) return { u, v, centre: true };
    const r = Math.hypot(u, v);
    return { u, v, dx: u / r, dy: v / r, weight: Math.min(1, 2 * Math.max(Math.abs(u), Math.abs(v))) };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const VERTICAL = new Set(['down', 'up']);

/** `(fromKey, toKey) → kind | null` over the model's layout graph (the first kind of a directed display pair). */
export function linkKindReader(model) {
    const kinds = new Map();
    for (const l of model?.layout?.graph?.links ?? []) {
        const k = `${l.from}\u0000${l.to}`;
        if (!kinds.has(k)) kinds.set(k, l.kind ?? 'join');
    }
    return (a, b) => kinds.get(`${a}\u0000${b}`) ?? null;
}

/**
 * Every VERTICAL rules exit (a `down` / `up` link between two groups) with its direction:
 * `{ exits: [{from, to, fromKey, toKey, exitName, kind, dx?, dy?, weight?, u?, v?, centre?}], counts }`, sorted
 * (from, to, exitName). `counts` = `{vertical, withDirection, centre, without, inGroup}` — `inGroup` the stairs inside
 * one group (left flat, not in `exits`). `tileOf` is `regionMapModel.exitTileOf` (passed in).
 */
export function verticalExits({ sidecars, model, tileOf, tol = STAIR_CENTRE_TOLERANCE }) {
    const keyOf = new Map();
    for (const [key, cell] of model?.cells ?? []) for (const m of cell.members ?? []) keyOf.set(m, key);
    const kindOf = linkKindReader(model);
    const groupOf = model?.groupOf instanceof Map ? model.groupOf : new Map();
    const exits = [];
    const counts = { vertical: 0, withDirection: 0, centre: 0, without: 0, inGroup: 0 };
    for (const name of Object.keys(sidecars ?? {}).sort(cmp)) {
        for (const e of sidecars[name]?.playable_payload?.exits ?? []) {
            const to = e?.targetRegion;
            if (typeof to !== 'string' || to === name) continue;
            const fromKey = keyOf.get(name); const toKey = keyOf.get(to);
            if (fromKey === undefined || toKey === undefined || fromKey === toKey) continue;
            const kind = kindOf(fromKey, toKey);
            if (!VERTICAL.has(kind)) continue;
            if (groupOf.get(fromKey) === groupOf.get(toKey)) { counts.inGroup += 1; continue; }
            counts.vertical += 1;
            const off = stairOffset(tileOf(e), model.cells.get(fromKey)?.extent ?? null, tol);
            if (!off) counts.without += 1;
            else if (off.centre) counts.centre += 1;
            else counts.withDirection += 1;
            exits.push({ from: name, to, fromKey, toKey, exitName: e.exitName ?? e.exit_id ?? '', kind, ...(off ?? {}) });
        }
    }
    exits.sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.exitName, b.exitName));
    return { exits, counts };
}

/**
 * Each drawn edge that carries a vertical exit: `Map<edgeId, {pref, exits}>`, `pref` = `{dx, dy, weight}` (the exits'
 * weighted directions summed, a T→S exit negated, weight `|Σ wᵢdᵢ| / n`: `edgePreferences`'s rule) or null when no exit
 * on it has a direction. `nodes` = `[{id, members?}]` as for `edgePreferences`.
 */
export function verticalEdges(nodes, edges, exits) {
    const nodeOf = new Map();
    for (const n of nodes) {
        const members = Array.isArray(n.members) && n.members.length ? n.members : [n.id];
        for (const m of members) nodeOf.set(m, n.id);
    }
    const byPair = new Map();
    for (const d of exits) {
        const a = nodeOf.get(d.from); const b = nodeOf.get(d.to);
        if (a === undefined || b === undefined || a === b) continue;
        const k = `${a}\u0000${b}`;
        if (!byPair.has(k)) byPair.set(k, []);
        byPair.get(k).push(d);
    }
    const out = new Map();
    for (const e of edges) {
        let sx = 0; let sy = 0; let n = 0; let directed = 0;
        for (const d of byPair.get(`${e.source}\u0000${e.target}`) ?? []) {
            n += 1;
            if (d.dx !== undefined) { sx += d.weight * d.dx; sy += d.weight * d.dy; directed += 1; }
        }
        for (const d of byPair.get(`${e.target}\u0000${e.source}`) ?? []) {
            n += 1;
            if (d.dx !== undefined) { sx -= d.weight * d.dx; sy -= d.weight * d.dy; directed += 1; }
        }
        if (n === 0) continue;
        const r = Math.hypot(sx, sy);
        out.set(e.id, { pref: directed > 0 && r > 1e-9 ? { dx: sx / r, dy: sy / r, weight: Math.min(1, r / n) } : null, exits: n });
    }
    return out;
}

/* ── 3. floor numbers ─────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The floor number of every group of `model` → `{ start, floorOf: Map<group, n>, order: Map<group, bfs index>,
 * unreached: [group], conflicts: [{group, floor, other, path, otherPath}], conflictGroups }`. A path is
 * `[{group, via?: {from, to, kind}}]` from the start group.
 */
export function floorNumbers(model) {
    const groupOf = model?.groupOf instanceof Map ? model.groupOf : new Map();
    const groups = [...new Set(model?.layout?.groups?.map((g) => g.id) ?? groupOf.values())].sort(cmp);
    const start = model?.layout?.start != null ? groupOf.get(model.layout.start) ?? null : null;
    // The vertical group graph: each link both ways, its delta seen from the side it leaves.
    const adj = new Map(groups.map((g) => [g, []]));
    const seen = new Set();
    for (const l of model?.layout?.graph?.links ?? []) {
        const kind = l.kind ?? 'join';
        if (!VERTICAL.has(kind)) continue;
        const ga = groupOf.get(l.from); const gb = groupOf.get(l.to);
        if (ga == null || gb == null || ga === gb) continue;
        const k = `${l.from}\u0000${l.to}\u0000${kind}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const d = kind === 'down' ? -1 : 1;
        const via = { from: l.from, to: l.to, kind };
        adj.get(ga)?.push({ to: gb, delta: d, via });
        adj.get(gb)?.push({ to: ga, delta: -d, via });
    }
    for (const list of adj.values()) {
        list.sort((x, y) => cmp(x.to, y.to) || cmp(x.via.from, y.via.from) || cmp(x.via.to, y.via.to) || cmp(x.via.kind, y.via.kind));
    }
    const floorOf = new Map();
    const order = new Map();
    const parent = new Map();
    const conflicts = [];
    const pathOf = (g) => {
        const out = [];
        for (let c = g; c != null; c = parent.get(c)?.from ?? null) out.unshift({ group: c, ...(parent.has(c) ? { via: parent.get(c).via } : {}) });
        return out;
    };
    if (start != null) {
        floorOf.set(start, 0);
        order.set(start, 0);
        const queue = [start];
        while (queue.length) {
            const g = queue.shift();
            for (const { to, delta, via } of adj.get(g) ?? []) {
                const want = floorOf.get(g) + delta;
                if (!floorOf.has(to)) {
                    floorOf.set(to, want);
                    order.set(to, order.size);
                    parent.set(to, { from: g, via });
                    queue.push(to);
                } else if (floorOf.get(to) !== want && !conflicts.some((c) => c.via === via)) {
                    conflicts.push({ group: to, floor: floorOf.get(to), other: want, via, path: pathOf(to), otherPath: [...pathOf(g), { group: to, via }] });
                }
            }
        }
    }
    const unreached = groups.filter((g) => !floorOf.has(g));
    return { start, floorOf, order, unreached, conflicts, conflictGroups: new Set(conflicts.map((c) => c.group)).size };
}

/* ── 4. labels ────────────────────────────────────────────────────────────────────────────────────────────────── */

/** A floor number's name: 0 "Ground floor", +n "Floor +n", −n "Floor −n" (U+2212), none "Floor ?". */
export function floorName(n) {
    if (!Number.isInteger(n)) return 'Floor ?';
    if (n === 0) return 'Ground floor';
    return n > 0 ? `Floor +${n}` : `Floor −${-n}`;
}

/**
 * Every group's label → `Map<group, label>`: its floor's name, plus " · k" when 2+ groups share that floor (k by BFS
 * discovery order); every unnumbered group "Floor ?".
 */
export function floorLabels(numbering) {
    const { floorOf, order, unreached } = numbering;
    const byFloor = new Map();
    for (const [g, n] of floorOf) {
        if (!byFloor.has(n)) byFloor.set(n, []);
        byFloor.get(n).push(g);
    }
    const out = new Map();
    for (const [n, gs] of byFloor) {
        gs.sort((a, b) => order.get(a) - order.get(b));
        gs.forEach((g, i) => out.set(g, gs.length > 1 ? `${floorName(n)} · ${i + 1}` : floorName(n)));
    }
    // The unnumbered share "Floor ?": discovery order from the start means nothing for a group it never reached.
    for (const g of unreached) out.set(g, floorName(null));
    return out;
}
