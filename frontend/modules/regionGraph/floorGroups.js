/**
 * ⛓ FLOOR GROUPING FOR THE DIRECTION-AWARE LAYOUT (region-graph-dungeon-groups). Keeps each floor group's levels
 * together, apart from other floor groups, in one of FOUR ways, chosen by one setting.
 *
 * ⚖ The user, session 84c8ab35, 2026-11-26T18:05:17.944Z: "That looks good, thanks. The individual connections look
 * right, but nodes from one dungeon are mixed together with nodes from another dungeon. Is there a way that we could
 * separate them more into groups?" — and, offered "Two-step layout", "Soft pull together" and "Two-step + boxes"
 * (AskUserQuestion, 2026-11-26T18:07:07.610Z): "I want to try each of these options, and to have a setting to toggle
 * between them, and also the way it works now."
 *
 * ── WHAT A FLOOR GROUP IS ────────────────────────────────────────────────────────────────────────────────────────────
 * The Region Map's GROUPS, and only those: `buildRegionMapModel(...).groupOf` (display key → group id), which is
 * `procgenCore/regionLayout.js` `groupsR1` (the connected components over `join` links; a `down` / `up` / `warp` link —
 * a doorway into a floor group — never joins). No second grouping is written here. A drawn node's floor group is its DISPLAY
 * region's group: a merged node by its `groupKey`, a region (and so a sub-region in `separate` / `nested` / an open
 * `collapsible` group) by its level. A node with no display region in the model (the Menu node, a node the model does
 * not place) has NO floor group: it is its own singleton (a block of one in `twoStep`, never boxed).
 * A floor group's NAME (the box label) is the group's id: the Region Map's group ROOT — the start's level when the group
 * holds it, else the first level a `down` (then an `up`) link from another group enters, else its first member.
 *
 * ── THE FOUR VALUES (`groupedDirectionLayout`) ───────────────────────────────────────────────────────────────────
 *   · `none` (the default): today's Direction-aware layout, the very same call (`directionLayout`): the same positions.
 *   · `soft`: ONE relaxation, plus each node pulled towards its own floor group's centre and pushed away from nodes of
 *     other floor groups nearer than a reach, both scaled by `groupStrength` (0 = `none`, exactly: the terms are skipped).
 *   · `twoStep`: (1) each floor group laid out ALONE (the same relaxation over its own internal edges), (2) the floor groups
 *     placed as RIGID BLOCKS (the floor group's box plus a pad) by the same relaxation over the block graph: one block edge
 *     per pair of linked floor groups, preferring the direction the links between them prefer (their exits' directions,
 *     summed), length only where no link has one. That pass ends with 0 overlapping blocks (its separation pass), so
 *     no node lies inside another floor group's block.
 *   · `twoStepBoxes`: `twoStep`, plus a faint labelled box around each floor group of 2+ drawn nodes
 *     (`floorBoxLayer.js`, a DOM overlay: not a Cytoscape element).
 * ⛓ region-graph-floors: the floor groups are FLOORS (`floors.js`). In both two-step values, a block edge that carries a
 * VERTICAL link (an edge with `vertical`: a stair or a pit between the two groups) is a FLOOR link: it prefers the sum
 * of its vertical links' directions (where the stairs are in their level) and rests at `floorGap` px instead of the
 * spacing. Every other block edge, and every edge inside a floor group, is as before. The box label is the floor's.
 * ⛔ A grouping only acts when some drawn edge joins two DIFFERENT floor groups (an edge to a node with no floor group does
 * not count). When none does (every component of the graph is inside one floor group, give or take the Menu node: alttp,
 * whose generic layout graph makes every exit a `join`, so its groups ARE its components; a single-group maze) every
 * value returns exactly `none`'s positions (`stats.grouping.inert`).
 *
 * ⛔ DETERMINISTIC (as `directionLayout`): floor groups and blocks are sorted by key; no clock, no `Math.random`.
 * ⛔ PURE: no DOM, no Cytoscape, no substrate named. The panel's glue is `layoutControlsManager.js`.
 */
import { directionLayout, DIRECTION_STRENGTH_SCHEMA, DIRECTION_SPACING_SCHEMA } from './directionLayout.js';
import { FLOOR_GAP_SCHEMA, normaliseFloorGap } from './floors.js';

/* ── settings ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export const FLOOR_GROUPING_KEY = 'moduleSettings.regionGraph.floorGrouping';
export const FLOOR_GROUP_STRENGTH_KEY = 'moduleSettings.regionGraph.floorGroupStrength';

export const FLOOR_GROUPING_SCHEMA = Object.freeze({
    type: 'string', default: 'none', enum: Object.freeze(['none', 'soft', 'twoStep', 'twoStepBoxes']),
    label: 'Floor grouping',
    description: 'How the Direction-aware layout keeps each floor group (a Region Map group) together: not at all (none), '
        + 'a pull together and a push apart in one layout (soft), each floor group laid out alone and then placed as a block '
        + '(twoStep), or that plus a labelled box round each floor group (twoStepBoxes).',
});
export const FLOOR_GROUPING_LABELS = Object.freeze({
    none: 'Off (as before)',
    soft: 'Soft pull together',
    twoStep: 'Two-step layout',
    twoStepBoxes: 'Two-step + boxes',
});
export const FLOOR_GROUP_STRENGTH_SCHEMA = Object.freeze({
    type: 'number', default: 0.5, minimum: 0, maximum: 1,
    label: 'Floor pull',
    description: 'Soft pull together only: how strongly a node is pulled towards its own floor group and pushed away from '
        + 'other floor groups\' nodes. 0 = no grouping (the same as Off), 1 = the strongest.',
});

/** The grouping settings, as the schema says them (a stored value out of range / of the wrong type reads as the default). */
export function normaliseGroupingSettings({ grouping, groupStrength } = {}) {
    const s = FLOOR_GROUP_STRENGTH_SCHEMA;
    const n = Number(groupStrength);
    return {
        grouping: FLOOR_GROUPING_SCHEMA.enum.includes(grouping) ? grouping : FLOOR_GROUPING_SCHEMA.default,
        groupStrength: Number.isFinite(n) && groupStrength !== null && groupStrength !== '' && typeof groupStrength !== 'boolean'
            ? Math.min(s.maximum, Math.max(s.minimum, n)) : s.default,
    };
}

/** Does `grouping` draw the boxes? */
export const groupingDrawsBoxes = (grouping) => grouping === 'twoStepBoxes';

/** The pad (graph px) round a floor group's nodes: its block in `twoStep`, its box in `twoStepBoxes`. */
export const blockPad = (spacing) => 10 + Math.max(0, Number(spacing) || 0) / 2;

/* ── the floor group of a drawn node ──────────────────────────────────────────────────────────────────────────────── */

/**
 * The display key → floor group reader of a Region Map model (`buildRegionMapModel`): `{ ofKey(key), ofRegion(region) }`,
 * each → the group id or null. `ofRegion` maps a rules region to its display region (the model cell holding it).
 */
export function floorGroupReader(model) {
    const groupOf = model?.groupOf instanceof Map ? model.groupOf : new Map();
    const keyOfRegion = new Map();
    for (const [key, cell] of model?.cells ?? []) for (const m of cell.members ?? []) keyOfRegion.set(m, key);
    const ofKey = (key) => (key != null && groupOf.has(key) ? groupOf.get(key) : null);
    return { ofKey, ofRegion: (region) => ofKey(keyOfRegion.get(region)), keyOfRegion };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const SOLO = '\u0001solo:';
/** A node's grouping key: its floor group, or a key of its own (a singleton) when it has none. */
const keyOfNode = (n) => (n.floorGroup != null ? `\u0000${n.floorGroup}` : `${SOLO}${n.id}`);

/** The floor groups of `nodes` (`[{id, floorGroup?}]`) → `[{key, floorGroup, members: [id]}]` sorted by key (members by id). */
export function floorGroupsOf(nodes) {
    const by = new Map();
    for (const n of nodes) {
        const k = keyOfNode(n);
        if (!by.has(k)) by.set(k, { key: k, floorGroup: n.floorGroup ?? null, members: [] });
        by.get(k).members.push(String(n.id));
    }
    const out = [...by.values()].sort((a, b) => cmp(a.key, b.key));
    for (const d of out) d.members.sort(cmp);
    return out;
}

/**
 * How many drawn edges join two DIFFERENT floor groups. An edge to a node with no floor group (the Menu node) does not count:
 * it says nothing about how two floor groups sit, so a world whose only "crossings" are the Menu's stays ungrouped.
 */
export function crossFloorGroupEdges(nodes, edges) {
    const k = new Map(nodes.map((n) => [String(n.id), n.floorGroup ?? null]));
    let c = 0;
    for (const e of edges) {
        const a = k.get(String(e.source)); const b = k.get(String(e.target));
        if (a != null && b != null && a !== b) c += 1;
    }
    return c;
}

/* ── the layout ───────────────────────────────────────────────────────────────────────────────────────────────── */

/** Soft pull tuning (not settings): the pull's and the push's weight at groupStrength 1, the push's reach (× L). */
export const SOFT_GROUPING_TUNING = Object.freeze({ pull: 0.12, push: 0.6, reach: 2 });

/**
 * Lay out `nodes` (`[{id, w, h, group?, floorGroup?}]`) joined by `edges` (`[{id, source, target, pref?}]`) with the
 * Direction-aware layout and floor `grouping`. → `{ positions, stats, blocks }`; `blocks` (twoStep values only) =
 * `[{key, floorGroup, members, x1, y1, x2, y2}]`, each floor group's block (its nodes' boxes + `blockPad`) at the result.
 * @param {object} opts - { grouping, groupStrength, strength, spacing, tuning }
 */
export function groupedDirectionLayout(nodes, edges, {
    grouping = FLOOR_GROUPING_SCHEMA.default, groupStrength = FLOOR_GROUP_STRENGTH_SCHEMA.default,
    strength = DIRECTION_STRENGTH_SCHEMA.default, spacing = DIRECTION_SPACING_SCHEMA.default, tuning = {},
    floorGap = FLOOR_GAP_SCHEMA.default,
} = {}) {
    const opts = { strength, spacing, tuning };
    const mode = FLOOR_GROUPING_SCHEMA.enum.includes(grouping) ? grouping : 'none';
    const cross = mode === 'none' ? null : crossFloorGroupEdges(nodes, edges);
    if (mode === 'none' || cross === 0 || (mode === 'soft' && !(groupStrength > 0))) {
        const out = directionLayout(nodes, edges, opts);
        return { ...out, stats: { ...out.stats, grouping: { mode, inert: mode !== 'none', crossEdges: cross } }, blocks: null };
    }
    if (mode === 'soft') {
        const out = directionLayout(nodes, edges, { ...opts, floorGroupPull: { strength: groupStrength, ...SOFT_GROUPING_TUNING } });
        return { ...out, stats: { ...out.stats, grouping: { mode, inert: false, crossEdges: cross } }, blocks: null };
    }
    return twoStepLayout(nodes, edges, opts, mode, cross, normaliseFloorGap(floorGap));
}

function twoStepLayout(nodes, edges, opts, mode, cross, floorGap) {
    const pad = blockPad(opts.spacing);
    const floorGroups = floorGroupsOf(nodes);
    const keyOf = new Map(nodes.map((n) => [String(n.id), keyOfNode(n)]));
    const byId = new Map(nodes.map((n) => [String(n.id), n]));
    // (1) each floor group alone, over its own internal edges.
    const internal = new Map(floorGroups.map((d) => [d.key, []]));
    const between = [];
    for (const e of edges) {
        const a = keyOf.get(String(e.source)); const b = keyOf.get(String(e.target));
        if (a === undefined || b === undefined) continue;
        if (a === b) internal.get(a).push(e); else between.push(e);
    }
    const local = new Map();
    let iterations = 0;
    for (const d of floorGroups) {
        const ns = d.members.map((id) => byId.get(id));
        const out = directionLayout(ns, internal.get(d.key), opts);
        iterations += out.stats.iterations;
        let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
        for (const n of ns) {
            const p = out.positions.get(String(n.id));
            const w = Math.max(1, +n.w || 1); const h = Math.max(1, +n.h || 1);
            x1 = Math.min(x1, p.x - w / 2); x2 = Math.max(x2, p.x + w / 2);
            y1 = Math.min(y1, p.y - h / 2); y2 = Math.max(y2, p.y + h / 2);
        }
        local.set(d.key, { positions: out.positions, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: x2 - x1 + 2 * pad, h: y2 - y1 + 2 * pad });
    }
    // (2) the blocks: one node per floor group, one edge per linked pair, its preference the links' directions summed.
    // ⛓ region-graph-floors: a pair with a VERTICAL edge is a floor link: only its vertical directions, and `floorGap`.
    const pairs = new Map();
    for (const e of between) {
        let a = keyOf.get(String(e.source)); let b = keyOf.get(String(e.target));
        let sign = 1;
        if (a > b) { [a, b] = [b, a]; sign = -1; }
        const k = `${a}\u0002${b}`;
        if (!pairs.has(k)) pairs.set(k, { a, b, sx: 0, sy: 0, n: 0, preferred: 0, vx: 0, vy: 0, vn: 0, vpreferred: 0 });
        const p = pairs.get(k);
        p.n += 1;
        if (e.pref) { p.sx += sign * (e.pref.weight ?? 1) * e.pref.dx; p.sy += sign * (e.pref.weight ?? 1) * e.pref.dy; p.preferred += 1; }
        if (e.vertical) {
            p.vn += 1;
            const v = e.vertical.pref;
            if (v) { p.vx += sign * (v.weight ?? 1) * v.dx; p.vy += sign * (v.weight ?? 1) * v.dy; p.vpreferred += 1; }
        }
    }
    const blockNodes = floorGroups.map((d) => ({ id: d.key, w: local.get(d.key).w, h: local.get(d.key).h }));
    let floorLinks = 0;
    const blockEdges = [...pairs.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, p]) => {
        if (p.vn > 0) {
            floorLinks += 1;
            const r = Math.hypot(p.vx, p.vy);
            const pref = p.vpreferred > 0 && r > 1e-9 ? { dx: p.vx / r, dy: p.vy / r, weight: Math.min(1, r / p.vn) } : undefined;
            return { id: k, source: p.a, target: p.b, pref, gap: floorGap };
        }
        const r = Math.hypot(p.sx, p.sy);
        const pref = p.preferred > 0 && r > 1e-9 ? { dx: p.sx / r, dy: p.sy / r, weight: Math.min(1, r / p.n) } : undefined;
        return { id: k, source: p.a, target: p.b, pref };
    });
    const placed = directionLayout(blockNodes, blockEdges, opts);
    const positions = new Map();
    const blocks = [];
    for (const d of floorGroups) {
        const L = local.get(d.key);
        const c = placed.positions.get(d.key);
        for (const id of d.members) {
            const p = L.positions.get(id);
            positions.set(id, { x: round(c.x + p.x - L.cx), y: round(c.y + p.y - L.cy) });
        }
        blocks.push({ key: d.key, floorGroup: d.floorGroup, members: d.members, x1: c.x - L.w / 2, y1: c.y - L.h / 2, x2: c.x + L.w / 2, y2: c.y + L.h / 2 });
    }
    const sorted = new Map([...positions.entries()].sort((x, y) => cmp(x[0], y[0])));
    return {
        positions: sorted,
        blocks,
        stats: {
            nodes: nodes.length, edges: edges.length, preferred: edges.filter((e) => e.pref).length,
            components: placed.stats.components, iterations: iterations + placed.stats.iterations,
            separationPasses: placed.stats.separationPasses, separationScales: placed.stats.separationScales,
            grouping: { mode, inert: false, crossEdges: cross, blocks: blocks.length, blockEdges: blockEdges.length, pad, floorLinks, floorGap },
        },
    };
}

const round = (x) => Math.round(x * 100) / 100;

/* ── measures ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * MIXING: of the nodes in a floor group of 2+ drawn nodes, how many have a node of ANOTHER floor group nearer (centre to
 * centre) than their nearest own-floor-group node. → `{ mixed, eligible, fraction }`. 0 = every floor group reads as one
 * cluster; a random placement of k equal floor groups scores ≈ (k − 1) / k.
 */
export function mixingCount(nodes, positions) {
    const ns = [...nodes].sort((a, b) => cmp(String(a.id), String(b.id))).filter((n) => positions.has(String(n.id)));
    const keys = ns.map(keyOfNode);
    const size = new Map();
    for (const k of keys) size.set(k, (size.get(k) ?? 0) + 1);
    let mixed = 0; let eligible = 0;
    for (let i = 0; i < ns.length; i += 1) {
        if (size.get(keys[i]) < 2) continue;
        eligible += 1;
        const p = positions.get(String(ns[i].id));
        let own = Infinity; let other = Infinity;
        for (let j = 0; j < ns.length; j += 1) {
            if (j === i) continue;
            const q = positions.get(String(ns[j].id));
            const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
            if (keys[j] === keys[i]) own = Math.min(own, d); else other = Math.min(other, d);
        }
        if (other < own) mixed += 1;
    }
    return { mixed, eligible, fraction: eligible ? mixed / eligible : 0 };
}

/**
 * The floor group blocks at `positions`: each floor group's nodes' boxes plus `pad` → `[{key, floorGroup, members, x1, y1, x2,
 * y2}]`, and the two checks the twoStep values promise: `blockOverlaps` (pairs of blocks that overlap) and `intruders`
 * (a node whose box overlaps another floor group's block). Both 0 for `twoStep` / `twoStepBoxes`.
 */
export function blockCheck(nodes, positions, pad) {
    const blocks = floorGroupsOf(nodes).map((d) => {
        let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
        for (const id of d.members) {
            const n = nodes.find((m) => String(m.id) === id);
            const p = positions.get(id);
            if (!p) continue;
            x1 = Math.min(x1, p.x - n.w / 2); x2 = Math.max(x2, p.x + n.w / 2);
            y1 = Math.min(y1, p.y - n.h / 2); y2 = Math.max(y2, p.y + n.h / 2);
        }
        return { ...d, x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad };
    });
    const hit = (a, b) => a.x1 < b.x2 - 1e-6 && b.x1 < a.x2 - 1e-6 && a.y1 < b.y2 - 1e-6 && b.y1 < a.y2 - 1e-6;
    let blockOverlaps = 0;
    for (let i = 0; i < blocks.length; i += 1) for (let j = i + 1; j < blocks.length; j += 1) if (hit(blocks[i], blocks[j])) blockOverlaps += 1;
    let intruders = 0;
    const keyOf = new Map(nodes.map((n) => [String(n.id), keyOfNode(n)]));
    for (const n of nodes) {
        const p = positions.get(String(n.id));
        if (!p) continue;
        const box = { x1: p.x - n.w / 2, y1: p.y - n.h / 2, x2: p.x + n.w / 2, y2: p.y + n.h / 2 };
        if (blocks.some((b) => b.key !== keyOf.get(String(n.id)) && hit(box, b))) intruders += 1;
    }
    return { blocks, blockOverlaps, intruders };
}
