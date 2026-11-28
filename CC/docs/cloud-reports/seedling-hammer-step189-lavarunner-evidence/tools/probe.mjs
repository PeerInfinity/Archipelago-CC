// MEASUREMENT-ONLY: hand-driven keys after 38:6's prefix — walk into the east pocket, face west, spear through the wall.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [file, id, i, sx = '120', sy = '224'] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const raw = gunzipSync(readFileSync(file)).toString();
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { replayTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { INVENTORY_ITEM_IDS } = await import(`${ROOT}/frontend/modules/seedlingDemo/solverView.js`);
const { passes, source, ...tape } = restoreRequest(req.request);
const levelSource = levelSourceFromAtlas(source.records);
const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null, scratchPersistence: tape.scratchPersistence === true });
const T = Number(sx), U = Number(sy);
const bodies = () => (run.entities('strikeBodies') ?? []).map((b) => `${b.id.split('@')[1]}:${b.x.toFixed(0)},${b.y.toFixed(0)}`).join(' ');
const ch = () => (run.entities('chasers') ?? []).map((c) => `${c.id.split('@')[1]}${c.dying ? 'D' : ''}h${c.hits}`).join(' ');
let t = 0;
const step = (k) => { run.advance(new Set(k)); t++; };
const log = (w) => console.log(`t${t} ${w} p=(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) hits=${run.ledger('playerHits').length} | ${bodies()} | ${ch()}`);
while (run.state.y > 282 && t < 100) step(['up']);
log('up');
while (run.state.x < T && t < 300) step(['right']);
log('right');
while (run.state.y > U && t < 500) step(['up']);
log('upB');
const slot = run.progress('inventorySlots').indexOf(INVENTORY_ITEM_IDS.spear);
console.log('spear slot', slot, 'primary', run.progress('primary'), 'slots', run.progress('inventorySlots'));
run.equipNow(slot);
for (let k = 0; k < 40; k++) { step([]); if (k % 10 === 9) log('wait'); }
for (let n = 0; n < 30; n++) {
  step(['left']); step(['primary']);
  for (let w = 0; w < 12; w++) step([]);
  log('thrust' + n);
  if ((run.entities('strikeBodies') ?? []).length === 0) break;
}
for (let k = 0; k < 120; k++) step([]);
log('end');
console.log('hits', JSON.stringify(run.ledger('playerHits')));
