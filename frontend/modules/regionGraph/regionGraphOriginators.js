/**
 * The Region Graph's `source` (on `user:regionMove`) and `originator` (on `user:locationCheck`) strings. Other code
 * keys on them (readers: `CC/docs/region-map/step2-view-model.md`), so they stay byte-identical; the shared actions in
 * `regionView/regionActions.js` take them as arguments. A second panel uses its own.
 */
export const REGION_GRAPH_SOURCES = Object.freeze({
    oneStep: 'regionGraph-oneStep',
    direct: 'regionGraph-direct',
    addToPath: 'regionGraph-addToPath',
    overwritePath: 'regionGraph-overwritePath',
});

export const REGION_GRAPH_ORIGINATORS = Object.freeze({
    check: 'RegionGraphCheck',
    bulkCheck: 'RegionGraphBulkCheck',
});

export const REGION_GRAPH_NODE_SELECTED = 'regionGraph:nodeSelected';
