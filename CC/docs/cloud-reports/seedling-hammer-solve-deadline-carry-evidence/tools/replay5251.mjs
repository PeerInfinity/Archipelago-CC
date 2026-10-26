// SCRATCH (SDC): 371 at a seam, ON: solveAnytime's answer, then an independent replayTape of prefix + plan, its rows
// compared with the plan's `expected` row for row (the row shape is the plan's own: the keys of expected[0]).
import { readFileSync } from 'node:fs';
const R = 'file:///home/user/Archipelago-CC/'; const rel = (p) => new URL(p, R).href;
const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=') || d;
const { restoreRequest } = await import(rel('scripts/procgen/seedlingSolveRequestCodec.js'));
const { atSeamTime } = await import(rel('scripts/procgen/replay-seedling-solve-request.mjs'));
const { levelSourceFromAtlas } = await import(rel('frontend/modules/seedlingDemo/atlasSource.js'));
const J = await import(rel('frontend/modules/seedlingDemo/jsRuntimeSolver.js'));
const line = readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((d) => d.id === 371);
const req = restoreRequest(atSeamTime(line.requests[0].request, Number(arg('seam', '5251'))));
const { passes = J.ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const answer = J.solveAnytime({ ...tape, source, levelSource }, { passes });
if (!answer.ok) { console.log('NOT OK', answer.kind, String(answer.message).slice(0, 200)); process.exit(1); }
const plan = answer.plan;
const keys = Object.keys(plan.expected[0]);
const row = (r) => { const all = { level: r.level, x: r.state.x, y: r.state.y, deaths: r.playerDeaths.length }; return Object.fromEntries(keys.map((k) => [k, all[k]])); };
const run = J.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence ?? false, equips: tape.equips ?? null, holds: tape.holds ?? null });
const rows = [row(run)];
for (const h of plan.solution) { run.advance(h); rows.push(row(run)); }
let first = -1; for (let i = 0; i < rows.length; i++) if (JSON.stringify(rows[i]) !== JSON.stringify(plan.expected[i])) { first = i; break; }
console.log(JSON.stringify({ seam: req.staging.seam.time, ok: answer.ok, ticks: plan.solution.length, expected: plan.expected.length, keys, rows: rows.length, firstMismatch: first, equal: first === -1 && rows.length === plan.expected.length, deadline: plan.deadline }));
