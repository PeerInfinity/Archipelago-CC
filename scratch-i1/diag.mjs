import { readFileSync } from 'node:fs'; import { join } from 'node:path';
const [root, fa, fb] = process.argv.slice(2);
const { StateManager } = await import(join(root, 'frontend/modules/stateManager/stateManager.js'));
const { evaluateRule } = await import(join(root, 'frontend/modules/shared/ruleEngine.js'));
const { workerLoggerInstance } = await import(join(root, 'frontend/app/core/universalLogger.js'));
console.log=()=>{};console.info=()=>{};console.debug=()=>{};console.warn=()=>{};
const run = (f) => { const rules = JSON.parse(readFileSync(f,'utf8'));
  const sm = new StateManager(evaluateRule, workerLoggerInstance); sm.loadFromJSON(structuredClone(rules),'1');
  for (const [it,n] of Object.entries(rules.itempool_counts['1'])) for (let i=0;i<n;i++) sm.addItemToInventory(it);
  sm.computeReachableRegions();
  const regs = new Set(Object.keys(rules.regions['1']).filter(r=>sm.isRegionReachable(r)));
  const locs = new Set([...sm.locations.values()].filter(l=>sm.isLocationAccessible(l)).map(l=>l.name));
  return {rules, regs, locs, sm}; };
const A = run(fa), B = run(fb);
const w = (s)=>process.stdout.write(s+'\n');
w(`A regs ${A.regs.size}/${Object.keys(A.rules.regions['1']).length} B regs ${B.regs.size}/${Object.keys(B.rules.regions['1']).length}`);
const missR = [...B.regs].filter(r=>!A.regs.has(r)); w('regions reachable in B not A: '+missR.length+' '+missR.slice(0,40).join(' | '));
const notInA = [...B.regs].filter(r=>!(r in A.rules.regions['1'])); w('B regions absent from A: '+notInA.join(' | '));
// for each A-unreachable region with a reachable B parent: show A's entrances into it
let shown=0;
for (const r of missR) { if (!(r in A.rules.regions['1'])) continue;
  for (const [src, reg] of Object.entries(A.rules.regions['1'])) for (const e of reg.exits??[]) if (e.connected_region===r && A.regs.has(src) && shown<12) { shown++; w(`  A ${src} -> ${r}: ${JSON.stringify(e.access_rule).slice(0,300)}`); } }
