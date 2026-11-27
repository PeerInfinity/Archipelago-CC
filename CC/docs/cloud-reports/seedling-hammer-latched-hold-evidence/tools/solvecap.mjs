// usage: node solvecap.mjs <jsonl> <id> <i> [--budget=N] [--plan]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i] = process.argv.slice(2);
const opt = Object.fromEntries(process.argv.slice(5).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.id === Number(id));
const c = leg.requests.find((r) => r.i === Number(i));
const req = restoreRequest(c.request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
if (opt.budget) tape.budgetWork = Number(opt.budget);
if (opt.addflag) for (const f of String(opt.addflag).split(',')) { const [level, tag] = f.split(':').map(Number); tape.staging = { ...tape.staging, persistence: [...tape.staging.persistence, { level, tag }] }; }
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
const sha = createHash('sha1').update(text).digest('hex').slice(0, 12);
console.log(JSON.stringify({ goal: c.goal, budgetWork: tape.budgetWork, ok: a.ok, kind: a.kind ?? null, work: a.work, answer: sha, ms: Date.now() - t0,
  passes: (a.passes ?? []).map(({ ms, ...r }) => r), ticks: a.plan?.solution?.length, hits: a.plan?.hits ?? a.hits ?? null }));
if (!a.ok) console.log('MESSAGE:', text);
if (opt.plan && a.ok) console.log('PLANKEYS', Object.keys(a.plan), JSON.stringify(a.plan.verbs ?? a.plan.steps ?? '').slice(0, 2000));
