// scratch (STRIKECACHE): every request of a requests file, one process each (LEAN+METER, the fast arm): how many
// deriveStrike walks it computed and what lean skipped (tools/one.mjs), pooled; one row per (id,i)
import { readFileSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const [file, out, jobs = '3'] = process.argv.slice(2);
const R = '/home/user/Archipelago-CC';
const list = [];
for (const l of readFileSync(file, 'utf8').split('\n')) { if (!l) continue; const j = JSON.parse(l); for (const r of j.requests) list.push({ id: j.id, key: j.key, i: r.i }); }
let k = 0;
const run = (t) => new Promise((res) => {
  const p = spawn('node', [`${R}/CC/docs/cloud-reports/seedling-hammer-strikecache-evidence/tools/one.mjs`, file, `${t.id}:${t.i}`],
    { env: { ...process.env, SEEDLING_STRIKE_PREVIEW_LEAN: '1', SEEDLING_PREVIEW_METER: '1' } });
  let s = ''; p.stdout.on('data', (d) => { s += d; }); p.on('close', () => { try { res(JSON.parse(s.split('\n')[0])); } catch { res({ error: s.slice(-200) }); } });
});
const worker = async () => { while (k < list.length) { const t = list[k++]; const r = await run(t);
  appendFileSync(out, JSON.stringify({ id: t.id, key: t.key, i: t.i, kind: r.kind ?? null, ms: r.ms, strikeWalks: r.strikeWalks, lean: r.leanCounts }) + '\n'); } };
await Promise.all(Array.from({ length: Number(jobs) }, worker));
