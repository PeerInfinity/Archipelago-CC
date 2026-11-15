// PLANS=<plans.json> node witness.mjs <capture> <planId> — replay a no-hit witness plan's keys after the capture's own
// prefix, the spear slot equipped first (EQUIP=0: not). PLANS: `git show origin/land/rules-no-hit-2:scripts/procgen/seedling-wallflyer-nohit-plans.json`.
import { readFileSync } from 'node:fs';
const WT = process.env.WT || '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${WT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${WT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { replayTape } = await import(`${WT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const [file, id] = process.argv.slice(2);
const req = restoreRequest(JSON.parse(readFileSync(file, 'utf8')).request ?? JSON.parse(readFileSync(file, 'utf8')));
const { source, ...tape } = req;
const plan = JSON.parse(readFileSync(process.env.PLANS, 'utf8')).plans[id];
const keys = Array.from({ length: plan.ticks }, () => new Set());
for (const sp of plan.inputs) for (let t = sp.from; t < sp.to; t += 1) keys[t].add(sp.key);
const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
  scratchPersistence: tape.scratchPersistence, equips: tape.equips });
const slots = run.progress('inventorySlots'); const spear = slots.indexOf(3);
if (process.env.EQUIP !== '0' && spear >= 0) run.equipNow(spear);
const h0 = run.ledger('playerHits').length, d0 = run.ledger('playerDeaths').length, lvl0 = run.level;
let crossed = null;
keys.forEach((k, i) => { if (crossed) return; const { transition } = run.advance(k); if (transition) crossed = { t: i, to: run.level }; });
console.log(JSON.stringify({ id, slots, spearSlot: spear, primaryWeapon: run.progress('primaryWeapon'), from: [tape.live?.x, tape.live?.y],
  hits: run.ledger('playerHits').slice(h0).map((h) => [h.t, h.id ?? h.source]), deaths: run.ledger('playerDeaths').length - d0,
  crossed, at: [run.state.x.toFixed(1), run.state.y.toFixed(1)], level: run.level, lvl0 }));
