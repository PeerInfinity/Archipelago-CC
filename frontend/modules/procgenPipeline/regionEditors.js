// Substrate→editor registry for the ③ "Build regions" per-region editor.
//
// Keyed by substrate id (e.g. 'bounce'); each value is a launcher with the
// mode-agnostic hand-off contract:
//
//     open({ region, contract, onSave? })
//
// Pipeline mode passes `onSave` (the panel splices the edited region back
// into the grid + invalidates ④). Standalone mode omits it (the editor owns
// its own load/save). `contract` carries what the realiser used (sidePortals,
// exitSpecs, locationSpecs, physicsProfile, mode, braidWidth, freeArrow, …).
//
// Edit ▸ in the procgen panel looks up `region.substrate`; a missing entry is
// a graceful "no editor for X yet" fallback (other substrates land later).
// Keeps the panel substrate-agnostic, mirroring how substrateRegistry already
// isolates substrate knowledge.

const regionEditors = {};

export function registerRegionEditor(substrate, openFn) {
    regionEditors[substrate] = openFn;
}

export function getRegionEditor(substrate) {
    return regionEditors[substrate] ?? null;
}

export { regionEditors };
