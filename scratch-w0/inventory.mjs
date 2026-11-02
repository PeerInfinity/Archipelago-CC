import * as P from '../scripts/procgen/make-seedling-playthrough-rules.mjs';
import * as OV from '../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
const doc = P.buildPlaythroughAtlas();
const rows = doc.regions.flatMap((r) => (r.subgraph?.internal_exits ?? []).map((e) => ({ ...e, region: r.region_id })));
const bySource = {};
for (const e of rows) { const s = e.source ?? 'manual'; bySource[s] = (bySource[s] ?? 0) + 1; }
const exits = doc.regions.flatMap((r) => (r.exits ?? []).map((e) => ({ ...e, region: r.region_id })));
const exitRuled = exits.filter((e) => e.access_rule !== undefined);
console.log('atlas regions', doc.regions.length, 'internal_exits', rows.length, bySource);
console.log('atlas boundary exits', exits.length, 'with an access_rule', exitRuled.length, 'out_', exits.filter(e=>e.exit_id.startsWith('out_')).length);
console.log('manual internal rows:', rows.filter((e) => (e.source ?? 'manual') !== 'analyzer').map((e) => `${e.region} ${e.from}->${e.to} ${JSON.stringify(e.access_rule)}`).join('\n  '));
for (const k of ['permissiveBindings','arrivalsUncharged','crossingCharged','sealedDoorsCharged','directionalDoorsCharged','pocketDoorsCharged','sealedLocationsCharged','modelVerdicts','prunedPockets','droppedRegions','lavaTrapLifts','locationGuards','pitChains']) {
  const v = P[k]; console.log(`${k}: ${v?.length}`);
}
console.log('crossingCharged:', P.crossingCharged.join(', '));
console.log('sealedDoorsCharged:', P.sealedDoorsCharged.length, 'directional:', P.directionalDoorsCharged.length, 'sealedLoc', P.sealedLocationsCharged.length);
P.setPlaythroughLandingAtlas(doc);
const layer = P.playthroughEventLayer(doc);
const ropes = P.playthroughRopeEvents(doc);
const lg = P.playthroughLandingGates(doc);
console.log('events', layer.events.length, '+ropes', ropes.events.length, 'internalExitRules', layer.internalExitRules.length, 'internalExitGates', layer.internalExitGates.length, 'exitGates', layer.exitGates.length, 'landingGates', lg.length, 'ropeExitGates', ropes.exitGates.length);
const ovKeys = Object.keys(OV);
console.log('OV exports', ovKeys.length);
for (const k of ovKeys) { const v = OV[k]; const n = Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : typeof v); console.log(`  OV.${k}: ${n}`); }
