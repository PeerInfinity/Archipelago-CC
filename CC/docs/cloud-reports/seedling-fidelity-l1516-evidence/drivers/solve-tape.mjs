// scratch (fidelity L1516 D3): solve a leg's goal FROM A TAPE STAGING (boot = the leg's arrival, the source tape's seam
// with the sweep row's items), with the switch set by env; write the solved tape. Usage:
//   node solve-tape.mjs --legs=<legs.jsonl> --id=<leg> --items=<json> --out=<tape.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const leg = readFileSync(arg('legs'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.id === Number(arg('id')));
const { PIN_NAMES, parseTape } = await M('seedlingDemo/tapeFormat.js');
const { stagingFromTape, runTape } = await M('seedlingDemo/tapeRunner.js');
const { atlasLevelSource, loadAtlas } = await M('seedlingDemo/levelSource.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const src = JSON.parse(readFileSync(join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes/r9-solve-15.json'), 'utf8'));
const items = JSON.parse(arg('items', '{"hasSword":true}'));
const base = { ...src, name: arg('name', `l16-corner-pit-solve`), description: arg('desc', 'fidelity L1516 D3'),
    boot: { level: leg.level, x: leg.arrive.x, y: leg.arrive.y },
    seam: { ...src.seam, items: { ...src.seam.items, ...items } }, tick_count: 0, inputs: [], pins: [...PIN_NAMES] };
const SRC = atlasLevelSource();
const staging = stagingFromTape(parseTape(base));
const records = new Map(loadAtlas().levels.map((l) => [l.level, l]));
const goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: records.get(leg.level) });
if (!mapped.goal) { console.log(JSON.stringify({ noGoal: mapped.walker })); process.exit(1); }
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records, scratchPersistence: true }), passes: ANYTIME_PASSES };
const res = createInPlaceProduceService().start(req).result;
if (!res.ok) { console.log(JSON.stringify({ ok: false, message: String(res.message).slice(0, 600) })); process.exit(1); }
const sol = res.plan.solution;
const inputs = [];
const keysOf = (h) => [...h].filter((k) => typeof k === 'string');
const open = new Map();
for (let t = 0; t <= sol.length; t += 1) {
    const now = new Set(t < sol.length ? keysOf(sol[t]) : []);
    for (const [k, from] of [...open]) if (!now.has(k)) { inputs.push({ key: k, from, to: t }); open.delete(k); }
    for (const k of now) if (!open.has(k)) open.set(k, t);
}
inputs.sort((a, b) => a.from - b.from || a.key.localeCompare(b.key));
const tape = { ...base, tick_count: sol.length + Number(arg('tail', 20)), inputs, equips: res.plan.equips ?? base.equips };
const m = runTape(parseTape(tape), { levelSource: SRC });
const tr = m.transitions.map((x) => ({ t: x.t, from: x.from_level, to: x.to_level }));
writeFileSync(arg('out'), `${JSON.stringify(tape, null, 1)}\n`);
console.log(JSON.stringify({ ok: true, ticks: sol.length, verbs: res.plan.verbs, end: res.plan.expected.at(-1), tapeTransitions: tr, tapeFinal: m.ticks.at(-1), hits: (m.playerHits ?? []).length }));
