// usage: [BUDGET=n] [PASS=name] node sites.mjs <jsonl> <id> <i> — site-ask log (TMPDEBUG hook) per route step. Measurement only.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const J = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [,, file, id, i] = process.argv;
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const cap = leg.requests.find((r) => String(r.i) === i).request;
let { passes = J.ANYTIME_PASSES, source, ...tape } = restoreRequest(cap);
if (process.env.BUDGET) tape.budgetWork = Number(process.env.BUDGET);
if (process.env.PASS) passes = passes.filter((p) => p.pass === process.env.PASS);
const levelSource = levelSourceFromAtlas(source.records);
globalThis.__SITELOG = [];
const a = J.solveAnytime({ ...tape, source, levelSource }, { passes });
const out = []; let cur = null, n = 0, tot = 0;
for (const e of globalThis.__SITELOG) {
  if (e.startsWith('STEP')) { if (cur) out.push(`${cur}x${n}`); out.push(`[${e} asks-so-far=${tot}]`); cur = null; n = 0; continue; }
  tot++; if (e === cur) n++; else { if (cur) out.push(`${cur}x${n}`); cur = e; n = 1; }
}
if (cur) out.push(`${cur}x${n}`);
console.log(out.join(' '));
console.log('TOTAL', tot, JSON.stringify({ ok: a.ok, work: a.work, ticks: a.ok ? a.plan.solution.length : null, passes: (a.passes ?? []).map(({ ms, ...r }) => r), msg: a.ok ? null : String(a.message).slice(0, 300) }));
