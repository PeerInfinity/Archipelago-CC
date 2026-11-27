import { readFileSync } from 'node:fs';
import { ctx } from './chain.mjs';
const { J, levelSource, tape0 } = ctx;
const { inventorySlotsFor } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeFormat.js');
const chain = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { obs, status } = JSON.parse(readFileSync(process.argv[2] + '.drain.json', 'utf8'));
const perTick = chain.perTick.map((k) => new Set(k));
const run = J.replayTape({ staging: tape0.staging, perTick: [], levelSource, scratchPersistence: true });
const eq = new Map(chain.equips); const rows = [[run.level, run.state.x, run.state.y]];
perTick.forEach((h, i) => { const s = eq.get(i); if (s !== undefined) run.equipNow(s); run.advance(h); rows.push([run.level, run.state.x, run.state.y]); });
let first = -1; const levels = [];
for (let i = 0; i < Math.min(obs.length, rows.length); i++) { const o = obs[i], m = rows[i]; if (!levels.includes(o.level)) levels.push(o.level);
  if (o.level !== m[0] || Math.abs(o.x - m[1]) > 1e-9 || Math.abs(o.y - m[2]) > 1e-9) { first = i; break; } }
console.log('rows game', obs.length, 'model', rows.length, 'levels', JSON.stringify(levels), 'first differing row', first);
if (first >= 0) for (let i = Math.max(0, first - 2); i < Math.min(obs.length, first + 6); i++) console.log(' ', i, JSON.stringify(obs[i]), JSON.stringify(rows[i]), JSON.stringify([...(perTick[i - 1] ?? [])]), eq.get(i - 1) ?? eq.get(i));
console.log('game end', JSON.stringify(obs.at(-1)), 'model end', JSON.stringify(rows.at(-1)), 'game hits', status.hits, 'model hits', run.ledger('playerHits').length);
