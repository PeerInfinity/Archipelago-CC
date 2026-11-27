// KILL880 (SPINNER880's census.mjs, the arm switch PRESS_KILL_HOLD): replay EVERY captured request of a requests file once, OFF and/or ON (env), pooled; one ROW per (arm,id,i)
import { readFileSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const [file, out, arms = 'off,on', jobs = '3', only = ''] = process.argv.slice(2);
const R = '/home/user/Archipelago-CC';
const list = [];
for (const l of readFileSync(file, 'utf8').split('\n')) {
  if (!l) continue; const j = JSON.parse(l);
  for (const r of j.requests) list.push({ id: j.id, key: j.key, i: r.i, budget: r.request.budgetWork ?? null, live: r.result ?? null });
}
const sel = only ? list.filter((x) => only.split(',').includes(`${x.id}:${x.i}`)) : list;
const tasks = [];
for (const arm of arms.split(',')) for (const x of sel) tasks.push({ arm, ...x });
const run = (t) => new Promise((res) => {
  const env = { ...process.env, SEEDLING_PRESS_KILL_HOLD: t.arm === 'on' ? '1' : '0' };
  const p = spawn('node', [`${R}/scripts/procgen/replay-seedling-solve-request.mjs`, `--requests=${file}`, `--one=${t.id}:${t.i}`], { env });
  let s = ''; p.stdout.on('data', (d) => { s += d; }); p.stderr.on('data', () => {});
  p.on('close', () => { const m = /RESULT (.*)/.exec(s); res(m ? JSON.parse(m[1]) : { error: s.slice(-300) }); });
});
let k = 0;
const worker = async () => { while (k < tasks.length) { const t = tasks[k++]; const r = await run(t);
  const row = { arm: t.arm, id: t.id, key: t.key, i: t.i, budget: t.budget, liveKind: t.live?.kind ?? null, liveWork: t.live?.work ?? null,
    liveAnswer: t.live?.answer ?? null, ok: r.ok, kind: r.kind, work: r.work, answer: r.answer, ms: r.ms,
    passes: r.passes?.map((p) => [p.pass, p.ok, p.work, p.ticks, p.deadline ?? null]), message: r.message?.slice(0, 200) ?? r.error };
  appendFileSync(out, JSON.stringify(row) + '\n'); } };
await Promise.all(Array.from({ length: Number(jobs) }, worker));
