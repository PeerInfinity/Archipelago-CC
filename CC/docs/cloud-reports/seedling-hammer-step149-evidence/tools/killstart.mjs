// MEASUREMENT-ONLY: solve a captured request with REWIND_PROBE.sink; at each kill-start, print the player and the spinner forecast.
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const [file, id, i, budget, N = '120'] = process.argv.slice(2);
const row = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const cap = row.requests[Number(i)].request;
if (budget && budget !== '-') cap.budgetWork = Number(budget);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const req = restoreRequest(cap);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
let seen = 0;
sb.REWIND_PROBE.sink = (p) => {
  if (p.kind !== 'kill-start') return;
  seen += 1;
  if (seen > Number(process.env.MAXSEEN ?? 2)) return;
  const r = p.live;
  console.log(`KILL-START t=${p.t} ticks=${r.ticksCompleted} player=(${r.state.x.toFixed(2)},${r.state.y.toFixed(2)}) gameTime=${r.gameTimeAt?.(0)}`);
  const fc = r.spinnerForecast(Number(N));
  for (let k = 0; k < fc.length; k += Number(process.env.EVERY ?? 3)) {
    const rowk = fc[k];
    const bodies = (rowk.bodies ?? rowk.byId ? [...(rowk.byId?.values?.() ?? rowk.bodies)] : Object.values(rowk));
    console.log(`  +${k} ` + JSON.stringify(rowk).slice(0, 400));
  }
};
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
console.log('RESULT', a.ok, a.kind, a.work, String(a.message ?? '').slice(0, 300));
