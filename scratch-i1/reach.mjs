// usage: node reach.mjs <repoRoot> <rules.json>...  → reachable locations with empty / full itempool
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [root, ...files] = process.argv.slice(2);
const { StateManager } = await import(join(root, 'frontend/modules/stateManager/stateManager.js'));
const { evaluateRule } = await import(join(root, 'frontend/modules/shared/ruleEngine.js'));
const { workerLoggerInstance } = await import(join(root, 'frontend/app/core/universalLogger.js'));
const warns = new Set();
const ow = console.warn; console.warn = (...a) => { const s = a.join(' '); if (/helper/i.test(s)) warns.add(s.slice(0, 160)); };
console.log = () => {}; console.info = () => {}; console.debug = () => {};
for (const f of files) {
  const rules = JSON.parse(readFileSync(f, 'utf8'));
  const out = [];
  for (const mode of ['empty', 'full']) {
    const sm = new StateManager(evaluateRule, workerLoggerInstance);
    sm.loadFromJSON(structuredClone(rules), '1');
    if (mode === 'full') {
      for (const [it, n] of Object.entries(rules.itempool_counts?.['1'] ?? {})) for (let i = 0; i < n; i++) sm.addItemToInventory(it);
    }
    sm.computeReachableRegions();
    let acc = 0, tot = 0;
    for (const loc of sm.locations.values()) { tot++; if (sm.isLocationAccessible(loc)) acc++; }
    out.push(`${mode} ${acc}/${tot}`);
  }
  process.stdout.write(`${f.split('/').slice(-2,-1)[0]}  ${out.join('  ')}  helperWarns=${warns.size}\n`);
  for (const w of warns) process.stdout.write("   W " + w + "\n");
  warns.clear();
}
