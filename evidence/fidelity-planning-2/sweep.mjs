// Under the box lock: run each job (argv JSON file: [{script, args:[...], prof?:name, timeoutS}]) serially, append JSONL.
import { readFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { takeBoxLockOrExit } from '/home/robert/CC/Archipelago-CC-wt-seedling-js-l16-budget/scripts/procgen/boxLock.js';
takeBoxLockOrExit({ name: 'l16-budget node solve sweep (scratch)', kind: 'measure' });
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
for (const j of jobs) {
  const load0 = readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
  const nodeArgs = j.prof ? ['--cpu-prof', '--cpu-prof-dir=prof', `--cpu-prof-name=${j.prof}.cpuprofile`] : [];
  const t0 = Date.now();
  const p = spawnSync('timeout', [String(j.timeoutS ?? 300), 'node', ...nodeArgs, j.script, ...j.args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  let row;
  try { row = JSON.parse(p.stdout.trim().split('\n').at(-1)); } catch { row = { ok: null, err: `rc=${p.status} TIMEOUT/none ${p.stderr.slice(-300)}` }; }
  appendFileSync(out, JSON.stringify({ tag: j.tag, wallMs: Date.now() - t0, load0, prof: j.prof ?? null, ...row }) + '\n');
  console.log(j.tag, row.ok, row.ms, (row.err ?? '').slice(0, 120));
}
