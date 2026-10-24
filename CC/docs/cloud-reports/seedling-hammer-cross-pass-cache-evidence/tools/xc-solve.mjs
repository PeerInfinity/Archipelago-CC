#!/usr/bin/env node
// SCRATCH (seedling-hammer-cross-pass-cache): one twoPassSolve per row, printed as one JSON line each:
// the answer's md5 (solveProgress.test.js's `digest`), the progress stream's md5 (every peek, whole), the deadline's
// shouldStop calls, the asks by site summed over segments, the instruments, the cache counts and the wall.
//   REPO=<tree> node xc-solve.mjs --rows=l18:21,l6,l3 [--cache] [--verify] [--floor] [--hook] [--deadline=never|trip:<k>|hammer:<k>] [--cap=<n>]
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const arg = (n, f = null) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const flag = (n) => process.argv.includes(`--${n}`);
const md5 = (x) => createHash('md5').update(x).digest('hex');
const sb = await M('solverBot.js');
const { twoPassSolve } = await M('twoPassSolve.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
const { loadTape } = await M('fixtures/index.js');
const { atlasLevelSource } = await M('levelSource.js');
const { SPINNER } = await M('spinner.js');
const { withSolveProgress } = await M('solveProgress.js');
const { PRESS_KILL_COST_COUNTS, resetPressKillCostCounts } = await M('pressKillCost.js');
const SOURCE = atlasLevelSource();
if (flag('floor')) sb.STRIKE_ETA_FLOOR.enabled = true;
if (sb.ESCAPE_CROSS_PASS_CACHE) {
    sb.ESCAPE_CROSS_PASS_CACHE.enabled = flag('cache');
    sb.ESCAPE_CROSS_PASS_CACHE.verify = flag('verify');
    if (arg('cap')) sb.ESCAPE_CROSS_PASS_CACHE.maxEntries = Number(arg('cap'));
}
const ROWS = {
    l18: { tape: 'r9-solve-18', goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }] },
    l6: { tape: 'r8-solve-6', goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }] },
    l3: { tape: 'r8-solve-3', goals: [{ kind: 'reach-exit', exit: { x: 128, y: 48 } }] },
};
function stagingOf(name, residue = null) {
    const base = stagingFromTape(loadTape(name));
    let seam = base.seam;
    if (residue !== null) {
        const P = SPINNER.hammerPeriod;
        const was = ((base.seam.time % P) + P) % P;
        seam = { ...base.seam, time: base.seam.time + ((((residue - was) % P) + P) % P) - P };
    }
    return { ...base, seam, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
}
for (const spec of arg('rows', 'l18:21').split(',')) {
    const [name, res] = spec.split(':');
    const s = ROWS[name];
    const staging = stagingOf(s.tape, res === undefined ? null : Number(res));
    let calls = 0;
    let hammerAsks = 0;
    const dl = arg('deadline');
    const deadline = dl === null ? null : {
        fineCheckpoints: true,
        shouldStop: (site) => {
            calls += 1;
            if (site === 'hammer-escape') hammerAsks += 1;
            if (dl.startsWith('trip:')) return calls >= Number(dl.slice(5));
            if (dl.startsWith('hammer:')) return site === 'hammer-escape' && hammerAsks >= Number(dl.slice(7));
            return false;
        },
    };
    const stream = [];
    const lasts = new Map();
    const hook = flag('hook') ? (site, peek) => {
        const snap = peek();
        stream.push(JSON.stringify({ site, snap }));
        if (snap) lasts.set(snap.segment.index, snap);
    } : null;
    resetPressKillCostCounts();
    sb.resetEscapeCrossPassCacheCounts?.();
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: s.goals, name: s.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    const deadlined = () => (deadline === null ? go() : sb.withSolveDeadline(deadline, go));
    const t0 = performance.now();
    let r;
    try {
        const v = await (hook === null ? deadlined() : withSolveProgress(hook, deadlined));
        r = { ok: true, value: v };
    } catch (error) { r = { ok: false, error }; }
    const wall = (performance.now() - t0) / 1000;
    const setsOut = (k, v) => (v instanceof Set ? [...v].sort() : (v instanceof Map ? [...v] : v));
    const answer = r.ok && !r.value?.out ? md5(JSON.stringify(r.value, setsOut)) : r.ok
        ? md5(JSON.stringify({ perTick: r.value.out.perTick.map((h) => [...h].sort()), trace: r.value.out.trace,
            records: r.value.out.records, transitions: r.value.out.transitions, dashes: r.value.out.dashes,
            waypointsPlanned: r.value.out.waypointsPlanned, replans: r.value.out.replans, passes: r.value.passes,
            persistence: r.value.persistence }))
        : md5(JSON.stringify({ name: r.error.name, message: r.error.message }));
    const asks = {};
    for (const x of lasts.values()) for (const [k, n] of Object.entries(x.budget.asks)) asks[k] = (asks[k] ?? 0) + n;
    console.log(JSON.stringify({ row: spec, ok: r.ok, ticks: r.value?.out?.perTick?.length ?? null,
        passes: r.value?.passes?.length ?? null, keys: r.ok ? Object.keys(r.value).join('+') : null, answer: answer.slice(0, 12),
        err: r.ok ? null : String(r.error.message).split('\n')[0].slice(0, 120),
        stream: hook ? md5(stream.join('\n')).slice(0, 12) : null, peeks: stream.length, shouldStop: calls, asks,
        pk: { ...PRESS_KILL_COST_COUNTS }, cache: sb.ESCAPE_CROSS_PASS_CACHE_COUNTS ? { ...sb.ESCAPE_CROSS_PASS_CACHE_COUNTS } : null,
        mismatches: sb.ESCAPE_CROSS_PASS_CACHE_MISMATCHES ?? null, s: Math.round(wall * 10) / 10 }));
}
