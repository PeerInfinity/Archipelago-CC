// KILL880: one pass of 19:1 (re-stamped to --seam, after --wait idle ticks) solved by solveFromTape with a never-true
// deadline hook (fine checkpoints asked, as the page's budgeted pass does), and its LINE printed: the solved plan's keys,
// or the refused pass's own prefix (`SolverRefusal.perTick`), replayed on a fresh run, every --every ticks: the player,
// the spinner bodies and chasers near --near=<x,y> (radius --r), and the run's hits. --keys=<out.json> writes the keys.
//   node line.mjs --req=<file.json.gz> [--seam=<clock>] [--wait=W] [--dash=none|<mode>] [--every=10] [--near=880,848] [--r=200]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const c0 = cap.request;
const seam = arg('seam') === null ? c0.staging.seam.time : Number(arg('seam'));
const { source, budgetWork, upgradeWindowWork, passes, ...tape } = restoreRequest({ ...c0,
    staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const levelSource = levelSourceFromAtlas(source.records);
const wait = Number(arg('wait', 0));
const base = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null };
if (wait > 0) {
    tape.perTick = Array.from({ length: wait }, () => new Set());
    tape.live = JR.liveOf(JR.replayTape({ ...base, perTick: tape.perTick }));
}
const dash = arg('dash', 'none');
// --grab: a refusal that carries no prefix (a SolverBotError) — every array that is pushed Set key sets is watched
// (Array.prototype.push, this scratch process only), and the one whose replay ends where the refusal says is its line.
const watched = new Map();
if (process.argv.includes('--grab')) {
    const push0 = Array.prototype.push;
    Array.prototype.push = function (...xs) {
        if (xs.length === 1 && xs[0] instanceof Set && (xs[0].size === 0 || typeof [...xs[0]][0] === 'string')) {
            watched.set(this, (watched.get(this) ?? 0) + 1);
        }
        return push0.apply(this, xs);
    };
}
let keys = null; let verdict = null;
const t0 = Date.now();
try {
    const plan = JR.solveFromTape({ ...tape, levelSource, dashMode: dash, shouldStop: () => false, fineCheckpoints: true });
    keys = [...tape.perTick, ...plan.solution]; verdict = `SOLVED ${plan.solution.length}t verbs=${plan.verbs}`;
} catch (e) {
    keys = (e.perTick ?? []).map((s) => new Set(s)); verdict = `REFUSED (${e.name}) ${String(e.message).slice(0, 300)}`;
    if (keys.length === 0 && watched.size > 0) {
        const m = /at \((-?[\d.]+),(-?[\d.]+)\) in level/.exec(String(e.message));
        const cands = [...watched].filter(([a, n]) => n >= 50 && a.length > 0 && a.every((x) => x instanceof Set));
        let best = null;
        for (const [a] of cands) {
            const r = JR.replayTape({ ...base, perTick: a });
            const d = m ? Math.hypot(r.state.x - Number(m[1]), r.state.y - Number(m[2])) : 0;
            console.log(`CAND len=${a.length} end=(${r.state.x.toFixed(2)},${r.state.y.toFixed(2)}) d=${d.toFixed(3)} hits=${(r.ledger('playerHits') ?? []).length}`);
            if (best === null || d < best.d || (d === best.d && a.length > best.a.length)) best = { a, d };
        }
        if (best) keys = best.a.map((x) => new Set(x));
    }
}
console.log(`VERDICT ${verdict} ms=${Date.now() - t0} keys=${keys.length}`);
if (arg('keys')) writeFileSync(arg('keys'), JSON.stringify(keys.map((k) => [...k])));
const [nx, ny] = arg('near', '880,848').split(',').map(Number); const rr = Number(arg('r', 200));
const near = (b) => Math.hypot(b.x - nx, b.y - ny) < rr;
const run = JR.replayTape({ ...base, perTick: [] });
const every = Number(arg('every', 10));
const show = (t) => {
    const sp = (run.entities('spinnerBodies') ?? []).filter(near).map((s) => `${s.id}@(${s.x.toFixed(1)},${s.y.toFixed(1)})${s.destroy ? 'X' : ''}`);
    const ch = (run.entities('chasers') ?? []).filter((c) => near(c) && !c.destroy && !c.removed).map((c) => `${c.id}@(${c.x.toFixed(1)},${c.y.toFixed(1)})`);
    console.log(`t${t} P(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) k=[${[...(keys[t] ?? [])]}] ${sp.join(' ')} | ${ch.join(' ')}`);
};
let hits = 0;
for (let t = 0; t < keys.length; t += 1) {
    if (t % every === 0) show(t);
    run.advance(keys[t]);
    const h = run.ledger('playerHits') ?? [];
    if (h.length > hits) { console.log(`HIT t${t} ${JSON.stringify(h.at(-1))}`); hits = h.length; }
}
show(keys.length);
console.log(`END hits=${hits} deaths=${(run.ledger('playerDeaths') ?? []).length}`);
const SB = await M('solverBot.js');
if (SB.PRESS_KILL_HOLD?.enabled) console.log('PRESS_KILL_HOLD', JSON.stringify(SB.PRESS_KILL_HOLD_COUNTS.rows));
