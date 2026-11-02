// SCRATCH (W0): the producer's permissiveBindings and arrivalsUncharged, against the derived rows.
import { readFileSync } from 'node:fs';
import * as P from '../scripts/procgen/make-seedling-playthrough-rules.mjs';
P.buildPlaythroughAtlas();
const E = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const M = JSON.parse(readFileSync('frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', 'utf8'));
const R = M.regions['1'];
const byAtlas = new Map();
for (const [name, s] of Object.entries(M.preset_sidecars['1'])) for (const e of s.playable_payload?.exits ?? []) if (e.targetRegion) byAtlas.set(`${s.playable_payload.atlas_region}/${e.atlas_exit_id}`, e.exitName ?? e.exit_id);
const exits = E.parts.flatMap((p) => p.exits); const rec = E.parts.flatMap((p) => p.rec);
const rule = (n) => { for (const r of Object.values(R)) for (const e of r.exits) if (e.name === n) return JSON.stringify(e.access_rule); };
for (const key of P.permissiveBindings) {
  const ap = byAtlas.get(key);
  if (!ap) { const loc = key.split('/')[1]; const rows = rec.filter((r) => r.label.includes(`@ ${loc}`)); console.log(`PERM ${key} (location): ${rows.map((r) => `${r.label.replace(/^.*?(\(|$)/, '(')}=${JSON.stringify(r.derived)}${r.problem ? ' PROBLEM' : r.accepted.length ? ' accepted' : ''}`).join(' ; ')}`); continue; }
  const d = exits.filter((x) => x.exit === ap);
  console.log(`PERM ${key} = ${ap}: today ${rule(ap)} | derived ${d.map((x) => JSON.stringify(x.minimal)).join(' ; ') || '(no row)'}`);
}
console.log('arrivalsUncharged', P.arrivalsUncharged.length);
const unpriced = []; const ex = new Set(exits.map((x) => `${x.region}|${x.exit}`)); const pairs = new Set(rec.filter((r) => r.closure).map((r) => r.label));
const lv = (n) => n.split('__')[0];
for (const [n, r] of Object.entries(R)) for (const e of r.exits) if (!ex.has(`${n}|${e.name}`) && !pairs.has(`${n} → ${e.connected_region}`) && lv(n) !== lv(e.connected_region)) unpriced.push(`${e.name} ${JSON.stringify(e.access_rule)}`);
console.log('UNPRICED', unpriced);
