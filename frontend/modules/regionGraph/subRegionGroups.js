/**
 * ⛓ SUB-REGION GROUPS (region-graph-groups-a; ⚖ the user, session 84c8ab35, 2026-11-23: "For grouping subregions in
 * the region graph, I'll eventually want D, but we can start by implementing the other options first.").
 *
 * The Region Graph's `subRegionView` setting (`moduleSettings.regionGraph.subRegionView`) says how a region's
 * SUB-REGIONS are drawn. A world whose substrate declares `compositeMap.displayRegionOf` (Seedling: `level_7__r0c3` →
 * `level_7`) splits one level into several rules regions; the fold that groups them is the view model's
 * `displayGroupsOf` (`regionView/regionViewModel.js`), the one the Region Map uses. This module does not fold again.
 *
 *   · `separate` (the DEFAULT) — today's graph: every rules region is its own node. Nothing here runs.
 *   · `nested` (option A) — a Cytoscape COMPOUND parent node per display group with MORE than one member; the member
 *     region nodes are its children, and exit edges still end on the exact member. A group of one draws as before,
 *     with no box, so a world with no `displayRegionOf` hook draws exactly as in `separate`.
 *   · `merged` (option B; region-graph-groups-b) — ONE node per display group of 2+ members, in place of the members.
 *     Exit edges between two members of one group are dropped (internal); an edge from a member to an outside node is
 *     re-targeted to the group node; edges that then join the same two nodes merge into one, keeping every exit
 *     (`mergeGroupEdges`). A click on the node runs the REGION click actions on `regionOfCell(key, members)`, the
 *     region the Region Map's cell click picks. A group of one draws as before, so a world with no
 *     `displayRegionOf` hook draws exactly as in `separate`.
 *   · `collapsible` (option C; region-graph-groups-c; ⚖ the user, 2026-11-24: "Small +/− badge") — B by default
 *     (every group CLOSED: drawn exactly as `merged`), and a small + badge on a closed group's corner OPENS that one
 *     group into A's box; a − badge on the open box closes it again. The badges are DOM buttons over the canvas
 *     (`groupBadgeLayer.js`), never Cytoscape elements, so no reader sees them. The open set is per world and
 *     session-only (`openGroupKeys`). An open group's members keep their own edges; the closed groups merge
 *     (`collapsibleGroups` → `mergeGroupEdges` with the closed groups' `nodeOf` only).
 *   The setting switching between the four values IS option D.
 *
 * ⚠ A group node is NOT a region. It has no `regionName`, its id is `GROUP_ID_PREFIX + key` (never a rules region
 * name), and it carries `GROUP_CLASS` (never `region`). Every reader of the graph's nodes finds it through
 * `isRegionGroupNode` (`isRegionGroupNode(node, 'box')` / `(node, 'merged')` for the kind): a box runs no click and
 * is never saved; a merged node acts for its members (`graphNodeIdOf` maps a member to it).
 */
import {
    displayGroupsOf, sidecarIndex, aggregateCounts, aggregateVisibility, regionInteriorState,
} from '../regionView/regionViewModel.js';

export const SUB_REGION_VIEW_KEY = 'moduleSettings.regionGraph.subRegionView';

/** The setting's schema entry — its `default` is the ONLY default (`settingsManager.getSetting` falls back to it). */
export const SUB_REGION_VIEW_SCHEMA = Object.freeze({
    type: 'string',
    default: 'separate',
    enum: Object.freeze(['separate', 'nested', 'merged', 'collapsible']),
    label: 'Sub-regions',
    description: 'How a region split into sub-regions is drawn: each sub-region its own node (separate), the '
        + 'sub-regions inside one box per region (nested), one node per region with its sub-regions merged '
        + '(merged), or merged with a + badge that opens one region into its box (collapsible).',
});

/** The control's option labels, by value (the select in the Controls' "Sub-regions" section). */
export const SUB_REGION_VIEW_LABELS = Object.freeze({
    separate: 'Separate nodes',
    nested: 'Nested in region boxes',
    merged: 'Merged into one node per region',
    collapsible: 'Collapsible (click + to open)',
});

export const GROUP_CLASS = 'region-group';
export const GROUP_ID_PREFIX = 'region-group:';
/** The extra class a `merged` group node carries (besides `GROUP_CLASS`); a `nested` box has `GROUP_CLASS` only. */
export const MERGED_CLASS = 'region-group-merged';

/** A stored value the schema does not list (an old or future one) reads as the schema default. */
export function normaliseSubRegionView(value) {
    return SUB_REGION_VIEW_SCHEMA.enum.includes(value) ? value : SUB_REGION_VIEW_SCHEMA.default;
}

/**
 * Is this Cytoscape node a group node, not a region? With `kind`: `'box'` (a `nested` compound parent) or `'merged'`
 * (a `merged` node standing for its members); without it, either.
 */
export function isRegionGroupNode(node, kind = null) {
    if (!node || typeof node.hasClass !== 'function' || !node.hasClass(GROUP_CLASS)) return false;
    if (kind === null) return true;
    return kind === 'merged' ? node.hasClass(MERGED_CLASS) : !node.hasClass(MERGED_CLASS);
}

/**
 * The graph node that draws rules region `regionName`: its merged group node in `merged` (`ui.mergedNodeOf`, filled by
 * the builder), else the region's own node (id = the region name). `ui` may be a stub with no map.
 */
export function graphNodeIdOf(ui, regionName) {
    return ui?.mergedNodeOf?.get?.(regionName) ?? regionName;
}

/**
 * The display groups with MORE than one member: `Map<displayKey, rulesRegion[]>`, in first-seen order. The fold is
 * `displayGroupsOf` over the rules' `preset_sidecars` (as the Region Map reads them); a region with no hook is its
 * own group of one and is left out.
 * @param {Iterable<string>} regionNames
 * @param {object} opts - { rules (the raw rules.json), playerId, registry (the substrate registry) }
 */
export function multiMemberGroups(regionNames, { rules = null, playerId = '1', registry = null } = {}) {
    const sidecars = sidecarIndex(rules, playerId);
    const groups = displayGroupsOf(regionNames, { registry, sidecarOf: (n) => sidecars.get(n) ?? null });
    const out = new Map();
    for (const [key, members] of groups) if (members.length > 1) out.set(key, members);
    return out;
}

/** The parent node's id for display key `key`. */
export const groupNodeId = (key) => `${GROUP_ID_PREFIX}${key}`;

/**
 * The compound parent elements for `groups` (from `multiMemberGroups`) and the member → parent id index. A parent's
 * data: `{ id, label, groupKey, members }` — `members` is the rules regions inside it, in fold order.
 */
export function groupNodeElements(groups) {
    const nodes = [];
    const parentOf = new Map();
    for (const [key, members] of groups) {
        const id = groupNodeId(key);
        nodes.push({ data: { id, label: key, groupKey: key, members: [...members] }, classes: GROUP_CLASS });
        for (const m of members) parentOf.set(m, id);
    }
    return { nodes, parentOf };
}

/* ── subRegionView = merged (option B; region-graph-groups-b) ──────────────────────────────────────────────────── */

/**
 * The `merged` group nodes for `groups` (from `multiMemberGroups`) and the member → node id index. A node's data:
 * `{ id, label, groupKey, members, merged: true }`; its classes `GROUP_CLASS MERGED_CLASS` (never `region`).
 */
export function mergedGroupElements(groups) {
    const nodes = [];
    const nodeOf = new Map();
    for (const [key, members] of groups) {
        const id = groupNodeId(key);
        nodes.push({ data: { id, label: key, groupKey: key, members: [...members], merged: true },
            classes: `${GROUP_CLASS} ${MERGED_CLASS}` });
        for (const m of members) nodeOf.set(m, id);
    }
    return { nodes, nodeOf };
}

/* ── subRegionView = collapsible (option C; region-graph-groups-c) ─────────────────────────────────────────────── */

/**
 * Split `groups` (from `multiMemberGroups`) by the open set: `open` groups draw as A's box (`groupNodeElements`),
 * `closed` ones as B's merged node (`mergedGroupElements`). Both maps keep the fold order. With every group closed
 * this is `merged`'s input; with every group open, `nested`'s.
 * @param {Map<string, string[]>} groups
 * @param {Set<string>} openKeys - the display keys that are open
 */
export function collapsibleGroups(groups, openKeys) {
    const open = new Map();
    const closed = new Map();
    for (const [key, members] of groups) (openKeys?.has(key) ? open : closed).set(key, members);
    return { open, closed };
}

/**
 * ⛓ THE BADGE (⚖ "Small +/− badge"): a DOM button over the canvas at the group node's top-right corner, in SCREEN
 * pixels (its size does not follow the zoom). VISIBLE square `BADGE_SIZE_PX`; HIT square `BADGE_HIT_PX` (the button's
 * own box: a transparent margin round the visible square), sized for a finger on the 390 px phone. It shows at every
 * zoom where region labels show (`zoom >= zoomLevels.showRegionNames`) and is hidden below it (the node body still
 * runs its click actions there).
 */
export const BADGE_SIZE_PX = 20;
export const BADGE_HIT_PX = 36;

/** The badge's centre on screen for a node's RENDERED bounding box (`node.renderedBoundingBox()`): its top-right corner. */
export function badgeCentre(rbb) {
    return { x: rbb.x2, y: rbb.y1 };
}

/** The badge's glyph and its accessible label: + opens a closed group, − closes an open one. */
export function badgeText(key, open) {
    return open ? { glyph: '\u2212', title: `Close ${key} back into one node` }
        : { glyph: '+', title: `Open ${key} into its sub-regions` };
}

/** The label a merged node shows: the display key, then the summed counts the way a region's label shows them. */
export function mergedGroupLabel(key, counts, { withCounts = true } = {}) {
    if (!withCounts || !counts || !(counts.total > 0)) return key;
    return `${key}\n${counts.checked}, ${counts.accessible}, ${counts.inaccessible} / ${counts.total}`;
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const exitOrder = (a, b) => cmp(a.direction, b.direction) || cmp(a.name, b.name) || cmp(a.from, b.from) || cmp(a.to, b.to);

/** The exits one drawn edge stands for: its forward exit (source → target) and, if any, its reverse one. */
function exitsOfEdge(d) {
    const out = [];
    if (d.exits) {
        for (const e of d.exits) out.push({ name: e.name, from: e.from, to: e.to, rule: e.rule ?? null });
        return out;
    }
    if (d.hasForwardExit !== false) out.push({ name: d.forwardExitName ?? d.exitName ?? '', from: d.source, to: d.target, rule: d.forwardExitRule ?? null });
    if (d.hasReverseExit) out.push({ name: d.reverseExitName ?? '', from: d.target, to: d.source, rule: d.reverseExitRule ?? null });
    return out;
}

const classSet = (c) => new Set(String(c ?? '').split(/\s+/).filter(Boolean));

/**
 * ⛓ THE EDGE RULE (`merged`). Over the region-to-region edges the panel built for `separate` (one per region pair,
 * with its forward and reverse exit), with `nodeOf` (member → group node id):
 *   1. an edge with NEITHER end in a group is kept as it is (so a world with no group keeps every edge, byte-equal);
 *   2. an edge with BOTH ends in the same group is DROPPED: it is internal, and the graph draws no self-loop;
 *   3. any other edge is RE-TARGETED: each end in a group is replaced by the group node;
 *   4. re-targeted edges that then join the same two nodes (either way round: the panel draws one edge per node pair,
 *      as it draws one per region pair) MERGE into one edge that keeps every exit, each with its own direction.
 * A merged edge's data: `id = "<source>-<target>"` (a group node id is never a region name, so it never collides),
 * `exits` = every exit `{ name, from, to, rule, direction }` sorted (direction, name, from, to), `exitNames` (sorted,
 * unique), `forwardExitName` / `reverseExitName` = that direction's names joined with " / ", `isBidirectional` when
 * exits run both ways, and `mergedEdges` = how many edges it stands for. Its orientation is the one most of its
 * edges had; a tie goes to the lexicographically smaller source. Everything is sorted, so the result does not depend
 * on the input order.
 * Its discovery classes: `undiscovered` / `discovery-hidden` only when EVERY edge it stands for had that class, and
 * its label is "???" only when every one was.
 * → { edges, stats: { kept, dropped, retargeted, merged, groupEdges } } — `merged` = edges folded away by step 4
 *   (retargeted − groupEdges).
 */
export function mergeGroupEdges(edges, nodeOf) {
    const kept = [];
    const pairs = new Map();
    let dropped = 0;
    let retargeted = 0;
    for (const el of edges) {
        const d = el.data;
        const s = nodeOf.get(d.source) ?? d.source;
        const t = nodeOf.get(d.target) ?? d.target;
        if (s === d.source && t === d.target) { kept.push(el); continue; }
        if (s === t) { dropped++; continue; }
        retargeted++;
        const key = s < t ? `${s}\u0000${t}` : `${t}\u0000${s}`;
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key).push({ el, s, t });
    }
    const out = [];
    for (const contributors of pairs.values()) {
        // Orientation: the one most contributors had; a tie → the smaller source id.
        const votes = new Map();
        for (const c of contributors) votes.set(c.s, (votes.get(c.s) ?? 0) + 1);
        const ends = [contributors[0].s, contributors[0].t].sort(cmp);
        const [a, b] = ends;
        const source = (votes.get(b) ?? 0) > (votes.get(a) ?? 0) ? b : a;
        const target = source === a ? b : a;
        const exits = [];
        for (const { el } of contributors) {
            for (const e of exitsOfEdge(el.data)) {
                const fromNode = nodeOf.get(e.from) ?? e.from;
                exits.push({ ...e, direction: fromNode === source ? 'forward' : 'reverse' });
            }
        }
        exits.sort(exitOrder);
        const fwd = exits.filter((e) => e.direction === 'forward');
        const rev = exits.filter((e) => e.direction === 'reverse');
        const names = [...new Set(exits.map((e) => e.name))];
        const exitNames = [...names].sort(cmp);
        const allClass = (c) => contributors.every(({ el }) => classSet(el.classes).has(c));
        const label = contributors.every(({ el }) => el.data.label === '???') ? '???'
            : names.length <= 2 ? names.join(' / ') : `${names[0]} / ${names[1]} / +${names.length - 2}`;
        const classes = ['undiscovered', 'discovery-hidden'].filter(allClass).join(' ');
        out.push({
            data: {
                id: `${source}-${target}`,
                source,
                target,
                label,
                exitName: (fwd[0] ?? rev[0])?.name ?? '',
                accessRule: (fwd[0] ?? rev[0])?.rule ?? null,
                isBidirectional: fwd.length > 0 && rev.length > 0,
                hasForwardExit: fwd.length > 0,
                hasReverseExit: rev.length > 0,
                forwardExitRule: fwd[0]?.rule ?? null,
                reverseExitRule: rev[0]?.rule ?? null,
                forwardExitName: fwd.map((e) => e.name).join(' / '),
                reverseExitName: rev.map((e) => e.name).join(' / '),
                exits,
                exitNames,
                mergedEdges: contributors.length,
            },
            classes,
        });
    }
    out.sort((x, y) => cmp(x.data.id, y.data.id));
    return { edges: [...kept, ...out],
        stats: { kept: kept.length, dropped, retargeted, merged: retargeted - out.length, groupEdges: out.length } };
}

/**
 * ⛓ A MERGED EDGE'S STATE from its exits' (`[{ traversable }]`, one per `exits` entry): BEST STATE WINS — the edge
 * draws `accessible` when ANY of its exits is traversable, else `inaccessible`. `mixed` = some but not all are.
 */
export function mergedEdgeState(exitStates) {
    const n = exitStates.filter((e) => e.traversable).length;
    return { traversable: n > 0, mixed: n > 0 && n < exitStates.length, traversableCount: n, total: exitStates.length };
}

/**
 * A path through rules regions as the graph draws it: each region mapped to its graph node (`nodeOf`), consecutive
 * repeats collapsed. A step inside one group (member → member) draws nothing; G → X → G draws G, X, G.
 */
export function pathNodeSteps(regions, nodeOf) {
    const out = [];
    for (const r of regions) {
        const id = nodeOf?.get?.(r) ?? r;
        if (out[out.length - 1] !== id) out.push(id);
    }
    return out;
}

/** The hover text of a merged node: its key, then its member sub-regions, one per line. */
export function mergedNodeHoverText(key, members) {
    return [`${key}: ${members.length} sub-regions`, ...members.map((m) => `• ${m}`)].join('\n');
}

/** The hover text of an edge with `exits` (and their states, by index): each exit with its own state. */
export function mergedEdgeHoverText(exits, states = []) {
    const head = exits.length === 1 ? '1 exit' : `${exits.length} exits`;
    return [head, ...exits.map((e, i) => {
        const st = states[i];
        const mark = st == null ? '·' : st.traversable ? '✓' : '✗';
        // The ends, unless the exit's own name already says them (Seedling's "a -> b").
        const named = e.name.includes(e.from) && e.name.includes(e.to);
        return named ? `${mark} ${e.name}` : `${mark} ${e.name} (${e.from} → ${e.to})`;
    })].join('\n');
}

/**
 * A group's state from its members' — the Region Map's group rule (`computeRegionView`'s `displayGroups`: counts
 * summed, reachable if ANY member is, visibility the most visible member's), plus the colour the graph draws:
 *   · `color` — `'accessible'` when any member's colour is, else `'inaccessible'` when any member has one, else null
 *     (no member coloured: the accessibility filter is off, or discovery hides them all);
 *   · `interior` — `regionInteriorState` of the summed counts, only for an accessible group (as a region node).
 * @param {Array<{counts, reachable, color, visibility}>} members
 */
export function groupState(members) {
    const counts = aggregateCounts(members.map((m) => m.counts));
    const reachable = members.some((m) => m.reachable);
    const visibility = aggregateVisibility(members.map((m) => m.visibility));
    const colors = members.map((m) => m.color).filter(Boolean);
    const color = colors.includes('accessible') ? 'accessible' : colors.length ? 'inaccessible' : null;
    const interior = color === 'accessible' ? regionInteriorState(counts, reachable) : null;
    return { counts, reachable, visibility, color, interior };
}

/** The classes a group's parent node carries for `state` (`groupState`). Never a region node's classes. */
export function groupClasses(state) {
    const out = [GROUP_CLASS];
    if (state.color) out.push(`group-${state.color}`);
    if (state.interior) out.push(`group-${state.interior}`);
    if (state.visibility === 'placeholder') out.push('group-placeholder');
    if (state.visibility === 'hidden') out.push('discovery-hidden');
    return out;
}

/** Every class `groupClasses` can set (to clear before re-applying). */
export const GROUP_STATE_CLASSES = 'group-accessible group-inaccessible group-completed group-all-accessible '
    + 'group-mixed-locations group-all-inaccessible group-placeholder discovery-hidden';

/**
 * The group boxes' styles (appended to the panel's stylesheet). A parent's colours are its OWN classes, never a
 * region node's: `opacity` on a compound parent multiplies into its children, so the region rules (`node.inaccessible`
 * fades to 0.6) must not reach it.
 */
export const GROUP_STYLES = Object.freeze([
    { selector: `node.${GROUP_CLASS}`, style: {
        'shape': 'round-rectangle', 'background-color': '#2a2a33', 'background-opacity': 0.35,
        'border-width': 2, 'border-style': 'dashed', 'border-color': '#777', 'padding': '14px',
        'label': 'data(label)', 'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -4,
        'font-size': '12px', 'font-weight': 'bold', 'color': '#ddd', 'text-wrap': 'none', 'z-index': 1,
    } },
    { selector: `node.${GROUP_CLASS}.group-accessible`, style: { 'border-color': '#52b845' } },
    { selector: `node.${GROUP_CLASS}.group-inaccessible`, style: { 'border-color': '#8e8e8e' } },
    { selector: `node.${GROUP_CLASS}.group-all-accessible`, style: { 'background-color': '#4a7c59' } },
    { selector: `node.${GROUP_CLASS}.group-mixed-locations`, style: { 'background-color': '#c9a227', 'background-opacity': 0.25 } },
    { selector: `node.${GROUP_CLASS}.group-all-inaccessible`, style: { 'background-color': '#a84444', 'background-opacity': 0.25 } },
    { selector: `node.${GROUP_CLASS}.group-completed`, style: { 'background-color': '#000' } },
    { selector: `node.${GROUP_CLASS}.group-placeholder`, style: { 'font-style': 'italic', 'color': '#999' } },
    // ⛓ merged (B): a region-like node (it is not a compound parent, so opacity is its own), a DOUBLE border marking
    // it as several sub-regions; coloured by its group state as a region node is by its own.
    { selector: `node.${MERGED_CLASS}`, style: {
        'shape': 'ellipse', 'background-color': '#666', 'background-opacity': 1, 'border-width': 5,
        'border-style': 'double', 'border-color': '#333', 'padding': '0px', 'width': 72, 'height': 52,
        'text-valign': 'center', 'text-halign': 'center', 'text-margin-y': 0, 'font-size': '10px',
        'font-weight': 'bold', 'color': '#fff', 'text-wrap': 'wrap', 'text-max-width': '110px', 'z-index': 10,
    } },
    { selector: `node.${MERGED_CLASS}.group-accessible`, style: { 'border-color': '#52b845' } },
    { selector: `node.${MERGED_CLASS}.group-inaccessible`, style: { 'background-color': '#8e8e8e', 'border-color': '#555', 'opacity': 0.6 } },
    { selector: `node.${MERGED_CLASS}.group-all-accessible`, style: { 'background-color': '#4a7c59', 'background-opacity': 1 } },
    { selector: `node.${MERGED_CLASS}.group-mixed-locations`, style: { 'background-color': '#c9a227', 'background-opacity': 1 } },
    { selector: `node.${MERGED_CLASS}.group-all-inaccessible`, style: { 'background-color': '#a84444', 'background-opacity': 1 } },
    { selector: `node.${MERGED_CLASS}.group-completed`, style: { 'background-color': '#000' } },
    { selector: `node.${MERGED_CLASS}.in-path`, style: { 'border-color': '#6c5ce7' } },
    { selector: `node.${MERGED_CLASS}.path-multiple`, style: { 'border-color': '#a29bfe' } },
    { selector: `node.${MERGED_CLASS}.current`, style: { 'border-color': '#ffd93d', 'width': 82, 'height': 60 } },
    { selector: `node.${MERGED_CLASS}.hub`, style: { 'width': 90, 'height': 64, 'font-size': '12px' } },
    { selector: `node.${MERGED_CLASS}:selected`, style: { 'border-color': '#ff0000' } },
]);

/** The merged-node / merged-edge hover box (one per panel; `GraphInteractionManager` fills and places it). */
export const HOVER_BOX_STYLE = 'position:absolute; z-index:50; pointer-events:none; display:none; max-width:460px; '
    + 'white-space:pre; overflow:hidden; text-overflow:ellipsis; background:rgba(20,20,26,0.95); color:#eee; '
    + 'border:1px solid #666; border-radius:4px; padding:4px 6px; font:11px/1.35 monospace;';
