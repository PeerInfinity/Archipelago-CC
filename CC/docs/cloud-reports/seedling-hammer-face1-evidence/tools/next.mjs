// FACE 1: the NEXT ask after the ON plan — the captured 26:9 request's staging, `perTick` = the ON plan's keys (the 50-tick
// idle included), `equips` = its slot selections, the goal replaced by --goal=<json> (the walk's next solver goal), the live
// digest re-taken at the plan's end; solved by the worker's dispatch at --budget (default the request's). Measures where the
// walk would stop next. Run with SEEDLING_GOAL_START_WAIT=1 (the plan is the switch's).
//   node next.mjs --req=<file.json.gz> --goal=<json> [--budget=<work>]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const { tapeEquips } = await M('wasmPlayback.js');
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const { passes = JR.ANYTIME_PASSES, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(cap.request);
const levelSource = levelSourceFromAtlas(source.records);
const first = JR.solveAnytime({ ...tape, source, budgetWork, upgradeWindowWork, levelSource }, { passes });
if (!first.ok) { console.log(JSON.stringify({ stage: 'first', ok: false, message: String(first.message).slice(0, 300) })); process.exit(0); }
const perTick = first.plan.solution.map((k) => new Set(k));
const equips = new Map(first.plan.equipsAt ?? []); // replayTape's form: tape index -> slot
const run = JR.replayTape({ staging: tape.staging, perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips, holds: null });
const live = JR.liveOf(run);
const solverGoal = JSON.parse(arg('goal'));
const budget = arg('budget') === null ? budgetWork : Number(arg('budget'));
const t0 = Date.now();
const ans = JR.solveAnytime({ ...tape, perTick, equips, live, solverGoal, source, budgetWork: budget, upgradeWindowWork, levelSource }, { passes });
console.log(JSON.stringify({ stage: 'next', firstTicks: perTick.length, end: [run.level, run.state.x, run.state.y], goal: solverGoal,
    budget, ok: ans.ok, kind: ans.kind ?? null, work: ans.work ?? null, ms: Date.now() - t0,
    passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}${p.work ? `@${p.work}` : ''}`),
    ticks: ans.ok ? ans.plan.solution.length : null, modelHits: ans.ok ? ans.plan.modelHits ?? null : null,
    message: ans.ok ? null : String(ans.message).slice(0, 1500) }));
