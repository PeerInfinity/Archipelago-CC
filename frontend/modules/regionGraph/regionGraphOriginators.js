/**
 * The Region Graph's `originator` (on `user:locationCheck`) strings. Other code keys on them (readers:
 * `CC/docs/region-map/step2-view-model.md`), so they stay byte-identical; the shared actions in
 * `regionView/regionActions.js` take them as arguments. A second panel uses its own.
 * Its click moves carry `regionView-path-regionGraph` (`regionView/clickActions.js` `pathSourceFor`, CA-S2); the old
 * `regionGraph-*` move sources left this file in CA-S3 (only tests named them; the CA-S2 oracle keeps their values).
 * The selection event's name constant ('regionGraph:nodeSelected') left it in CA-S5, with the event.
 */

export const REGION_GRAPH_ORIGINATORS = Object.freeze({
    check: 'RegionGraphCheck',
    bulkCheck: 'RegionGraphBulkCheck',
});
