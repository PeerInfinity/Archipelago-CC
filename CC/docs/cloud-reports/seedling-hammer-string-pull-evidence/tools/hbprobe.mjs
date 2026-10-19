// Read-only heartbeat probe: one solve under the real tap at --interval ms (or none), timing every hook call.
// node hbprobe.mjs --tape=r5-l40-part5 --goal=collect:160,640 [--residue=21] [--interval=100|none] [--json]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { goalsFrom, answerDigest } = await import(join(REPO, 'scripts/procgen/probe-seedling-solve-progress.mjs'));
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { withSolveDeadline } = await import(join(MODULE, 'solverBot.js'));
const { withSolveProgress } = await import(join(MODULE, 'solveProgress.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));
const { createProgressTap } = await import(join(MODULE, 'solveProgressTap.js'));

if (process.env.HBCOUNT) globalThis.__hb = { pw: 0, tp: 0, exp: 0, cpc: 0 };
const tapeName = arg('tape');
const goals = goalsFrom(arg('goal'));
const residue = arg('residue', null);
const interval = arg('interval', '100');
const tape = tapeName.endsWith('.json') ? parseTape(readFileSync(tapeName, 'utf8')) : loadTape(tapeName);
const base = stagingFromTape(tape);
let seam = base.seam;
if (residue !== null) {
    const P = SPINNER.hammerPeriod;
    const was = ((base.seam.time % P) + P) % P;
    seam = { ...base.seam, time: base.seam.time + ((((Number(residue) - was) % P) + P) % P) - P };
}
const SOURCE = atlasLevelSource();
const staging = { ...base, seam, noclip: false, noDamage: false, equips: [],
    persistence: base.persistence.filter((c) => c.at === undefined) };
let shouldStops = 0;
const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
    goals, name: tape.name ?? tapeName, boot: staging.boot, persistence: staging.persistence,
    gameTick: () => { throw new Error('no game oracle'); } });
const deadlined = () => withSolveDeadline({ shouldStop: () => { shouldStops += 1; return false; },
    fineCheckpoints: true }, go);

const calls = [];
const posts = [];
let asks = null;
let tap = null;
let hook = null;
const sites = {};
if (interval !== 'none') {
    tap = createProgressTap({ passes: [{ pass: 'probe', stop: 'all' }], clock: () => performance.now(),
        minIntervalMs: Number(interval), budgetWork: null,
        post: (snap) => { posts.push(performance.now()); structuredClone(snap); asks = snap.budget?.asks; } });
    hook = (site, peek) => { calls.push([performance.now(), site]); sites[site] = (sites[site] ?? 0) + 1;
        tap.hook(site, peek); };
}
const t0 = performance.now();
let r;
try {
    const value = await (hook === null ? deadlined() : withSolveProgress(hook, deadlined));
    r = { ok: true, out: value.out, passes: value.passes };
} catch (error) { r = { ok: false, error }; }
const t1 = performance.now();
if (tap) tap.finish();
const wall = t1 - t0;
const out = { tape: tape.name ?? tapeName, interval, wall: Math.round(wall), digest: answerDigest(r), shouldStops,
    ok: r.ok, ticks: r.ok ? r.out.perTick.length : null, hookCalls: calls.length };
if (tap) {
    // gap share: wall time inside stretches between consecutive hook calls (and start/end) longer than 100 ms
    const pts = [t0, ...calls.map((c) => c[0]), t1];
    let over = 0;
    const big = [];
    for (let i = 1; i < pts.length; i += 1) {
        const g = pts[i] - pts[i - 1];
        if (g > 100) {
            over += g;
            big.push({ ms: Math.round(g), from: i >= 2 ? calls[i - 2][1] : 'start', to: i - 1 < calls.length ? calls[i - 1][1] : 'end' });
        }
    }
    const pp = [t0, ...posts.filter((p) => p <= t1), t1];
    const pg = [];
    for (let i = 1; i < pp.length; i += 1) pg.push(pp[i] - pp[i - 1]);
    pg.sort((a, b) => a - b);
    const pairs = {};
    for (const b of big) { const k = `${b.from}→${b.to}`; pairs[k] = (pairs[k] ?? 0) + 1; }
    Object.assign(out, { gapShareOver100: +(100 * over / wall).toFixed(1), gapsOver100: big.length,
        postGapMedian: Math.round(pg[Math.floor(pg.length / 2)]), posts: posts.length, gapPairs: pairs,
        heartbeats: sites.heartbeat ?? 0, finalAsks: asks });
    if (process.argv.includes('--gaps')) out.gaps = big;
}
if (globalThis.__hb) out.hb = globalThis.__hb;
console.log(JSON.stringify(out));
