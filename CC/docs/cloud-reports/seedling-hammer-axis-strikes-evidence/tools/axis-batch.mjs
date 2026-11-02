// MEASUREMENT ONLY: every request of a capture jsonl (or the --ids list), one fresh process each, `--jobs` at once,
// through axis-replay.mjs with the census hook. Rows (answer + census summary) go to --out, the census rows to
// --census. Usage: node axis-batch.mjs --requests=<jsonl> --root=<tree> --out=<jsonl> --census=<jsonl> [--on]
//   [--env=NAME=V,NAME=V] [--jobs=3] [--skip-done] [--d=<seam offset>]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const rows = readFileSync(args.requests, 'utf8').trim().split('\n').map(JSON.parse);
const want = args.ids ? new Set(args.ids.split(',')) : null;
const done = new Set(args['skip-done'] && existsSync(args.out)
    ? readFileSync(args.out, 'utf8').trim().split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.id}:${r.i}`; }) : []);
const jobs = [];
for (const r of rows) for (const q of r.requests) {
    const k = `${r.id}:${q.i}`;
    if ((want && !want.has(k) && !want.has(String(r.id))) || done.has(k)) continue;
    jobs.push({ id: r.id, i: q.i });
}
const env = { ...process.env, AXIS_ROOT: args.root, AXIS_OUT: args.census };
for (const kv of (args.env ?? '').split(',').filter(Boolean)) { const [n, v] = kv.split('='); env[n] = v; }
let next = 0;
const one = () => new Promise((res) => {
    const j = jobs[next++];
    if (!j) return res(false);
    const a = ['--import', join(HERE, 'axis-register.mjs'), join(HERE, 'axis-replay.mjs'), `--root=${args.root}`,
        `--requests=${args.requests}`, `--id=${j.id}`, `--i=${j.i}`, ...('on' in args ? ['--on'] : []), ...(args.d ? [`--d=${args.d}`] : [])];
    const p = spawn(process.execPath, a, { env: { ...env, AXIS_TAG: `${j.id}:${j.i}` } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', () => {});
    p.on('close', (code) => {
        const line = out.trim().split('\n').pop();
        appendFileSync(args.out, (line?.startsWith('{') ? line : JSON.stringify({ id: j.id, i: j.i, crashed: code })) + '\n');
        console.log(`${j.id}:${j.i} done (${code})`);
        res(true);
    });
});
const worker = async () => { while (await one()); };
await Promise.all(Array.from({ length: Number(args.jobs ?? 3) }, worker));
