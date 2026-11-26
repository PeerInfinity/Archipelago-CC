/**
 * ⛓ THE NODE LOOK (region-graph-map-look). The Region Graph's `nodeLook` setting (`moduleSettings.regionGraph.nodeLook`)
 * says how a region node DRAWS:
 *   · `graph` (the DEFAULT) — today's node: a coloured ellipse with its label and counts. Byte-identical to before.
 *   · `map` — each node draws as its Region Map cell: the level art, the location squares coloured by state, and the
 *     label (`mapLookLayer.js`, through the Region Map's own `regionMap/regionMapCellDraw.js`).
 *
 * ⚖ The user, session 84c8ab35: 2026-11-26T02:25:14.974Z "What I want to do next is add an option for the Region Graph
 * to display the nodes the same way as the Region Map. Preferably by using shared code rather than duplicating existing
 * code."; 02:26:18.879Z "Node look only (Recommended)" (positions still come from the Graph's own layouts); and
 * 02:29:27.084Z "To clarify, I only want the new drawing mode … to work in the mode where it groups the subregions into
 * one node, the same way the Region Map does."
 *
 * So `map` TAKES EFFECT only with `subRegionView` = `merged` (one node per region, as the Region Map draws a display
 * group). With any other `subRegionView` the nodes draw as `graph`, whatever `nodeLook` holds; the control is disabled
 * there (with a hint) and the stored value is kept (`nodeLookApplies`).
 */
export const NODE_LOOK_KEY = 'moduleSettings.regionGraph.nodeLook';

/** The setting's schema entry — its `default` is the ONLY default (`settingsManager.getSetting` falls back to it). */
export const NODE_LOOK_SCHEMA = Object.freeze({
    type: 'string',
    default: 'graph',
    enum: Object.freeze(['graph', 'map']),
    label: 'Node look',
    description: 'How a region node draws: the graph\'s own node (graph), or its Region Map cell, with the level art and '
        + 'the location squares coloured by state (map). "map" takes effect when Sub-regions is "Merged into one node '
        + 'per region".',
});

/** The control's option labels, by value (the select in the Controls' "Sub-regions" section). */
export const NODE_LOOK_LABELS = Object.freeze({
    graph: 'Graph nodes',
    map: 'Region Map cells',
});

/** The hint beside the control while `map` cannot take effect. */
export const NODE_LOOK_HINT = 'Region Map cells need Draw as: Merged into one node per region';

/** The one `subRegionView` value `map` takes effect in. */
export const NODE_LOOK_MAP_VIEW = 'merged';

/** A stored value the schema does not list (an old or future one) reads as the schema default. */
export function normaliseNodeLook(value) {
    return NODE_LOOK_SCHEMA.enum.includes(value) ? value : NODE_LOOK_SCHEMA.default;
}

/** Does the node look `map` draw, for this `nodeLook` and `subRegionView`? */
export function nodeLookApplies(nodeLook, subRegionView) {
    return normaliseNodeLook(nodeLook) === 'map' && subRegionView === NODE_LOOK_MAP_VIEW;
}

/**
 * ⛓ The "Node look" select (`#nodeLook` in the panel's Controls): shows the stored value; DISABLED (with the hint shown)
 * while `subRegionView` is not `merged`, where `map` cannot take effect. The stored value is kept either way.
 */
export function syncNodeLookControl(ui) {
    const select = ui?.controlPanel?.querySelector?.('#nodeLook');
    if (!select) return;
    select.value = normaliseNodeLook(ui.nodeLook);
    const usable = ui.subRegionView === NODE_LOOK_MAP_VIEW;
    select.disabled = !usable;
    select.title = usable ? '' : NODE_LOOK_HINT;
    const hint = ui.controlPanel.querySelector('#nodeLookHint');
    if (hint) hint.style.display = usable ? 'none' : 'block';
}
