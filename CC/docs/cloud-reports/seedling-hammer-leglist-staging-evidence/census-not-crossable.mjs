import { readFileSync } from 'node:fs';
const REPO = process.argv[2], S = process.argv[3];
const { evaluateRuleWithInventory } = await import(REPO + '/frontend/modules/shared/procgen/library.js');
const { sphereTable } = await import(REPO + '/scripts/procgen/seedling-divergence-legs.mjs');
const rules = JSON.parse(readFileSync(REPO + '/frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json', 'utf8'));
const { generateSphereLog } = await import(REPO + '/frontend/modules/shared/procgen/forwardSimulator.js');
const log = generateSphereLog(rules).filter((e) => e.type === 'state_update');
const sp = sphereTable(log);
const pm = rules.progression_mapping?.['1'] ?? null;
const R = rules.regions['1'];
const old = new Map(readFileSync(S + '/legs-on.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((l) => [l.key, l]));
const legs = readFileSync(S + '/legs3-on.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const rows = { fallback: [], other: [] }; const onlyNon = [];
for (const l of legs.filter((x) => x.skip?.startsWith('arrival-not-crossable'))) {
  const i = l.sphere.index, row = sp.rows[i];
  const holds = (r) => evaluateRuleWithInventory(r ?? { rule: 'True_' }, row.counts, '1', (x) => row.reached.has(x), pm) === true;
  const ins = Object.entries(R).flatMap(([s, reg]) => (reg.exits ?? []).filter((x) => x.connected_region === l.region).map((x) => ({ s, x })));
  const ok = ins.filter(({ s, x }) => row.reached.has(s) && holds(x.access_rule)).map(({ x }) => x.name);
  const reached = row.reached.has(l.region);
  const wasFallback = !!old.get(l.key)?.edgeEvents;
  (wasFallback ? rows.fallback : rows.other).push(`${l.key} | ${l.sphere.label} | region reached: ${reached} | holding entrances: ${ok.length ? ok.join(', ') : 'NONE'} | ${l.skip.slice(33, 200)}`);
  if (reached && !ok.length) onlyNon.push(l.key);
}
console.log('FORMERLY-FALLBACK', rows.fallback.length); rows.fallback.forEach((r) => console.log('  ' + r));
console.log('OTHER', rows.other.length); rows.other.forEach((r) => console.log('  ' + r));
console.log('REACHED ONLY THROUGH NON-HOLDING EDGES', onlyNon.length, JSON.stringify(onlyNon));
