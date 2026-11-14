// scratch (NEW-LOCKS I): the ON radius in node. Every captured request of a sweep capture jsonl is solved as the
// worker solves it (fix-solve.mjs, one fresh process per solve) under each ARM (an env set), and the answers compared
// with the arm's base. Arms: off = defaults; new = the three new switches; rew = KILLLOCK_CHASER_REWIND alone;
// all = the four. Movers are (new vs off) and (all vs rew). Appends one jsonl row per request. Measure only.
// Usage: node radius.mjs <requests.jsonl> <out.jsonl> [jobs=2]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const [file, out, jobsArg] = process.argv.slice(2);
const TOOL = new URL('./fix-solve.mjs', import.meta.url).pathname;
const NEW = { SEEDLING_KILLLOCK_CLEAR_WRITE: '1', SEEDLING_ROCKLOCK_KILL: '1', SEEDLING_KILLLOCK_LINE_STANCE: '1' };
const REW = { SEEDLING_KILLLOCK_CHASER_REWIND: '1' };
const ARMS = { off: {}, new: NEW, rew: REW, all: { ...NEW, ...REW } };
const done = new Set(existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.id}/${r.i}`; }) : []);
const work = [];
for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    for (const q of row.requests) if (!done.has(`${row.id}/${q.i}`)) work.push({ id: row.id, key: row.key, i: q.i });
}
const one = (w, env) => new Promise((res) => {
    const p = spawn(process.execPath, [TOOL, file, String(w.id), String(w.i)], { env: { ...process.env, ...env, MSG: '400' } });
    let o = ''; p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', () => {});
    p.on('close', (code) => { try { res(JSON.parse(o.trim().split('\n').pop())); } catch { res({ ok: null, sha: `CRASH${code}`, msg: o.slice(-300) }); } });
});
const jobs = Number(jobsArg ?? 2);
let next = 0;
const runner = async () => {
    for (;;) {
        const w = work[next]; next += 1;
        if (!w) return;
        const r = { id: w.id, key: w.key, i: w.i };
        for (const [arm, env] of Object.entries(ARMS)) {
            const a = await one(w, env);
            r[arm] = { ok: a.ok, ticks: a.ticks, sha: a.sha, work: a.work, hits: a.hits, verbs: a.verbs, msg: a.ok ? null : a.msg };
        }
        r.moveNew = r.new.sha !== r.off.sha; r.moveAll = r.all.sha !== r.rew.sha;
        appendFileSync(out, JSON.stringify(r) + '\n');
        console.log(`${w.id}/${w.i} off=${r.off.ok ? r.off.ticks : 'R'} new=${r.new.ok ? r.new.ticks : 'R'}${r.moveNew ? ' MOVED' : ''} rew=${r.rew.ok ? r.rew.ticks : 'R'} all=${r.all.ok ? r.all.ticks : 'R'}${r.moveAll ? ' MOVED' : ''}`);
    }
};
await Promise.all(Array.from({ length: jobs }, runner));
