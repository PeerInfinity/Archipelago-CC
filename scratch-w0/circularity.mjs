// SCRATCH (W0): which maze-payload gates are COPIED from the atlas's access rules (so derived == atlas by construction)?
// Rebuild the maze preset (buildPlaythroughMaze's body) from an atlas whose every rule is a sentinel item, and find the sentinels in the payloads.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as MZ from '../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { PLAYTHROUGH_MAP, playthroughAnalyzerOptions } from '../scripts/procgen/make-seedling-playthrough-rules.mjs';
import { compileRegionAtlas } from '../frontend/modules/procgenPipeline/regionAtlasCompiler.js';
import { seedlingMazeProjectionDeps } from '../frontend/modules/flashPanel/seedlingAtlasAnalysis.js';
const R = (p) => JSON.parse(readFileSync(resolve('frontend/modules/flashPanel/atlases', p), 'utf8'));
const atlas = R('seedling-playthrough.json');
const L0 = MZ.eventLayerFor(R('seedling-playthrough.json'), atlas.regions.map((r) => r.region_id)); // prime the producer cache on the TRUE atlas
const sent = (kind, id) => ({ rule: 'Has', args: { item_name: `W0S|${kind}|${id}` } });
let n = { loc: 0, ix: 0, ex: 0 };
for (const r of atlas.regions) {
  for (const l of r.locations ?? []) if (l.access_rule) { l.access_rule = sent('loc', `${r.region_id}/${l.name}`); n.loc++; }
  for (const e of r.exits ?? []) if (e.access_rule) { e.access_rule = sent('ex', `${r.region_id}/${e.exit_id}`); n.ex++; }
  for (const x of r.subgraph?.internal_exits ?? []) if (x.access_rule && !L0.internalExitRules.some((q) => q.region_id === r.region_id && q.from === x.from && q.to === x.to)) { x.access_rule = sent('ix', `${r.region_id}/${x.from}->${x.to}`); n.ix++; }
}
const levels = atlas.regions.map((r) => r.region_id);
const partition = R('seedling-subregion-partition.json').atlases[atlas.atlas_id];
n.evt = 0;
const ropes = MZ.ropeEventsFor(atlas, partition, levels);
const layer = MZ.eventLayerFor(atlas, levels, { minted: ropes.events.map((e) => e.name) });
for (const e of layer.events) if (e.access_rule) { e.access_rule = sent('evt', e.name); n.evt++; }
for (const g of layer.exitGates) if (g.rule) { g.rule = sent('gate', `${g.region_id}/${g.exit_id}`); n.gate = (n.gate ?? 0) + 1; }
const mazeProjection = seedlingMazeProjectionDeps({ mapDoc: PLAYTHROUGH_MAP, events: layer.world,
  gameConfig: JSON.parse(readFileSync('frontend/modules/flashPanel/games/seedling.json', 'utf8')), levelWorlds: { partition },
  analysis: { gridForLevel: (level) => MZ.playthroughPuzzleLockGridFor(level, { atlas, partition }), conditionKey: playthroughAnalyzerOptions.conditionKey, resolveCondition: playthroughAnalyzerOptions.resolveCondition } });
const restricted = MZ.restrictAtlas(atlas, levels, { start: MZ.START_LEVEL });
const { rules } = compileRegionAtlas(restricted, { mapDoc: R(atlas.tile_space.map_document), completionItem: MZ.completionItemFor(restricted), embedSphereLog: false,
  sidecarFlavor: 'maze', mazeProjection, events: [...layer.events, ...ropes.events], internalExitRules: layer.internalExitRules, internalExitGates: layer.internalExitGates,
  exitGates: [...layer.exitGates, ...MZ.landingGatesFor(atlas, levels), ...ropes.exitGates] });
console.log('sentinels planted', n);
const S = rules.preset_sidecars['1'];
const found = { loc: new Map(), ix: new Map(), ex: new Map(), evt: new Map(), gate: new Map() };
for (const [name, s] of Object.entries(S)) {
  const p = s.playable_payload; if (!p) continue;
  const shared = Boolean(p.shared_world);
  const txt = JSON.stringify(p);
  for (const m of txt.matchAll(/W0S\|(loc|ix|ex|evt|gate)\|([^"]+)/g)) {
    const key = m[2]; const lvl = name.split('__')[0];
    if (!found[m[1]].has(key)) found[m[1]].set(key, { lvl, shared });
  }
}
for (const k of ['loc', 'ix', 'ex', 'evt', 'gate']) {
  const v = [...found[k].values()];
  console.log(`${k}: ${found[k].size} of ${n[k]} copied into payloads; in shared worlds ${v.filter((x) => x.shared).length}, plain ${v.filter((x) => !x.shared).length}`);
  if (k !== 'ix') console.log('   ', [...found[k].keys()].slice(0, 60).join(' | '));
}
const byLvl = {}; for (const [k, v] of found.ix) byLvl[v.lvl] = (byLvl[v.lvl] ?? 0) + 1;
console.log('ix copied by level:', JSON.stringify(byLvl));
const sharedLv = new Set(Object.entries(S).filter(([, s]) => s.playable_payload?.shared_world).map(([n]) => n.split('__')[0]));
console.log('shared levels:', [...sharedLv].sort((a, b) => +a.slice(6) - +b.slice(6)).join(' '));
