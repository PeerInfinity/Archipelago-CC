// Re-solve a CAPTURED wasm arrival in node, no budget:
//   node replay.mjs <capture.json> '<json {read: index | {level}, goal?: <AP goal>, dashMode?, economies?}>'
// The goal defaults to the capture's goal whose level matches the arrival.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const R = new URL('../../frontend/modules/', import.meta.url).pathname;
const { stagingFromWasmArrival, arrivalSolverGoal } = await import(R + 'seedlingDemo/wasmArrival.js');
const { createRunForStaging } = await import(R + 'seedlingDemo/tapeRunner.js');
const { solveSegment } = await import(R + 'seedlingDemo/solverBot.js');
const { indexLevels, levelSourceFromAtlas } = await import(R + 'seedlingDemo/atlasSource.js');
const MAP = JSON.parse(readFileSync(R + 'flashPanel/atlases/seedling-map.json', 'utf8'));
const RECORDS = indexLevels(MAP);
const SRC = levelSourceFromAtlas(RECORDS);
const cap = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const a = JSON.parse(process.argv[3] ?? '{}');
const reads = cap.reads;
const read = typeof a.read === 'number' ? reads[a.read] : reads.filter((r) => r.state.level === a.read.level).at(a.read.nth ?? -1);
const level = read.state.level;
const goal = a.goal ?? cap.goals.find((g) => g.goal.level === level && g.at >= read.at - 2000)?.goal
    ?? [...cap.goals].reverse().find((g) => g.goal.level === level)?.goal
    ?? [...cap.history].reverse().find((h) => h.goal?.level === level)?.goal;
const record = RECORDS.get(level) ?? null;
const { staging } = stagingFromWasmArrival({ seam: read.seam, status: read.status, state: read.state, record });
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record });
const head = { level, spawn: [read.state.playerPositionX, read.state.playerPositionY], goal: goal?.name ?? goal, solverGoal: mapped.goal ?? mapped, dashMode: a.dashMode ?? 'all(default)' };
if (!mapped.goal || mapped.stepOff) { console.log(JSON.stringify({ ...head, skip: mapped.walker ?? 'stepOff composite' })); process.exit(0); }
const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
let ticks = 0;
const prox = new Proxy(run, { get(t, p) { const v = Reflect.get(t, p); if (p === 'advance') return (...x) => { ticks++; return v.apply(t, x); }; return typeof v === 'function' ? v.bind(t) : v; } });
const t0 = performance.now();
let res;
try {
  const opts = { run: prox, goals: [mapped.goal], name: 'l16-budget-replay', boot: staging.boot, prefix: [] };
  if (a.dashMode) opts.dashMode = a.dashMode;
  if (a.economies !== undefined) opts.economies = a.economies;
  const out = solveSegment(opts);
  const rows = out.trace?.rows ?? [];
  const verbs = rows.map((r) => r.strategy?.verb).filter(Boolean);
  res = { ok: true, hash: createHash('md5').update(out.perTick.map((h) => [...h].sort().join('+')).join('|')).digest('hex').slice(0, 10), ticks: out.perTick.length, verbs: [...new Set(verbs)].sort(),
    dashRows: rows.filter((r) => r.strategy?.swordDash?.planned).length,
    dashSaved: rows.reduce((n, r) => n + (r.strategy?.swordDash?.planned ? (r.strategy.swordDash.saved ?? 0) : 0), 0),
    rungs: [...new Set(rows.map((r) => r.strategy?.rung).filter(Boolean))], endLevel: run.level, deaths: run.playerDeaths.length };
} catch (e) { res = { ok: false, err: `${e.name}: ${String(e.message).replace(/\s+/g, ' ').slice(0, a.long ? 4000 : 300)}` }; }
console.log(JSON.stringify({ ...head, ms: Math.round(performance.now() - t0), advances: ticks, ...res }));
