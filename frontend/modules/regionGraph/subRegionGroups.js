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
 *   · later slices add `merged` (B: one node per group) and `collapsible` (C: B, a click opens a group into A); the
 *     setting switching between them is option D.
 *
 * ⚠ A parent node is NOT a region. It has no `regionName`, its id is `GROUP_ID_PREFIX + key` (never a rules region
 * name), and it carries `GROUP_CLASS` (never `region`). Every reader of the graph's nodes skips it through
 * `isRegionGroupNode`: no click action, no pathfinding, no label rewrite, no saved position.
 */
import {
    displayGroupsOf, sidecarIndex, aggregateCounts, aggregateVisibility, regionInteriorState,
} from '../regionView/regionViewModel.js';

export const SUB_REGION_VIEW_KEY = 'moduleSettings.regionGraph.subRegionView';

/** The setting's schema entry — its `default` is the ONLY default (`settingsManager.getSetting` falls back to it). */
export const SUB_REGION_VIEW_SCHEMA = Object.freeze({
    type: 'string',
    default: 'separate',
    enum: Object.freeze(['separate', 'nested']),
    label: 'Sub-regions',
    description: 'How a region split into sub-regions is drawn: each sub-region its own node (separate), or the '
        + 'sub-regions inside one box per region (nested).',
});

/** The control's option labels, by value (the select in the Controls' "Sub-regions" section). */
export const SUB_REGION_VIEW_LABELS = Object.freeze({
    separate: 'Separate nodes',
    nested: 'Nested in region boxes',
});

export const GROUP_CLASS = 'region-group';
export const GROUP_ID_PREFIX = 'region-group:';

/** A stored value the schema does not list (an old or future one) reads as the schema default. */
export function normaliseSubRegionView(value) {
    return SUB_REGION_VIEW_SCHEMA.enum.includes(value) ? value : SUB_REGION_VIEW_SCHEMA.default;
}

/** Is this Cytoscape node a group box (a compound parent), not a region? */
export function isRegionGroupNode(node) {
    return !!node && typeof node.hasClass === 'function' && node.hasClass(GROUP_CLASS);
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
]);
