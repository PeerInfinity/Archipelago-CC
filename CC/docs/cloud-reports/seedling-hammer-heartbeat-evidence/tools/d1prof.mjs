// D1 (measure only): CPU-profile one solve, attribute the samples that fall inside hook-call gaps > 100 ms.
// node d1prof.mjs --tape=r5-l40-part5 --goal=collect:160,640 [--residue=21] [--out=prof.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Session } from 'node:inspector/promises';

const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { goalsFrom, answerDigest } = await import(join(REPO, 'scripts/procgen/probe-seedling-solve-progress.mjs'));
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { withSolveDeadline } = await import(join(MODULE, 'solverBot.js'));
const { withSolveProgress } = await import(join(MODULE, 'solveProgress.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));

const tape = loadTape(arg('tape'));
const goals = goalsFrom(arg('goal'));
const residue = arg('residue', null);
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
const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
    goals, name: tape.name, boot: staging.boot, persistence: staging.persistence,
    gameTick: () => { throw new Error('no game oracle'); } });
const deadlined = () => withSolveDeadline({ shouldStop: () => false, fineCheckpoints: true }, go);

const us = () => Number(process.hrtime.bigint() / 1000n);
const calls = [];
const s = new Session();
s.connect();
await s.post('Profiler.enable');
await s.post('Profiler.setSamplingInterval', { interval: 200 });
await s.post('Profiler.start');
const t0 = us();
let r;
try { const v = await withSolveProgress((site) => { calls.push([us(), site]); }, deadlined); r = { ok: true, out: v.out }; }
catch (error) { r = { ok: false, error }; }
const t1 = us();
const { profile } = await s.post('Profiler.stop');
if (arg('out')) writeFileSync(arg('out'), JSON.stringify(profile));

// gaps in the hook-call stream
const pts = [[t0, 'start'], ...calls, [t1, 'end']];
const gaps = [];
for (let i = 1; i < pts.length; i += 1) if (pts[i][0] - pts[i - 1][0] > 100e3) gaps.push({ a: pts[i - 1][0], b: pts[i][0], kind: `${pts[i - 1][1]}→${pts[i][1]}` });

const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const stackOf = (id) => { const out = []; for (let x = id; x !== undefined; x = parent.get(x)) out.push(byId.get(x).callFrame); return out; };
const CANDS = (arg('cands', 'previewWalk,stallHere,combatBefore,planSwordDash,deriveKillByChaser,scoreAll,scanAround,planWaypointsOrNull,planWaypoints,dangerDuringTransit,chaserStep,chaserForecastNow,step,stepV2,clearsOf,deriveEscape,spaceTimeReach,plansReach,corridorPlans,walkToUnder,probeCorridor')).split(',');
let t = profile.startTime;
const stats = {};
const self = {};
let inGapUs = 0;
let total = 0;
const gk = {};
console.error(`profile.startTime ${profile.startTime} vs t0 ${t0} (Δ ${profile.startTime - t0} µs)`);
for (let i = 0; i < profile.samples.length; i += 1) {
    t += profile.timeDeltas[i];
    const dt = profile.timeDeltas[i + 1] ?? 0;
    total += dt;
    const g = gaps.find((x) => t >= x.a && t < x.b);
    if (!g) continue;
    const kind = g.kind.startsWith('kill-chaser→') ? 'kill-chaser→*' : g.kind;
    inGapUs += dt;
    gk[kind] ??= { us: 0, cands: {}, self: {} };
    gk[kind].us += dt;
    const st = stackOf(profile.samples[i]);
    const names = new Set(st.map((f) => f.functionName));
    for (const c of CANDS) if (names.has(c)) gk[kind].cands[c] = (gk[kind].cands[c] ?? 0) + dt;
    const leaf = st[0];
    const lk = `${leaf.functionName || '(anon)'} ${leaf.url.split('/').pop()}:${leaf.lineNumber + 1}`;
    gk[kind].self[lk] = (gk[kind].self[lk] ?? 0) + dt;
}
const pct = (x, of) => +(100 * x / of).toFixed(1);
const report = { digest: answerDigest(r), calls: calls.length, wallMs: Math.round((t1 - t0) / 1e3), gaps: gaps.length,
    gapMs: Math.round(gaps.reduce((a, g) => a + g.b - g.a, 0) / 1e3), sampledInGapMs: Math.round(inGapUs / 1e3), kinds: {} };
for (const [k, v] of Object.entries(gk)) {
    report.kinds[k] = { ms: Math.round(v.us / 1e3),
        inclusive: Object.fromEntries(Object.entries(v.cands).sort((a, b) => b[1] - a[1]).map(([c, x]) => [c, pct(x, v.us)])),
        selfTop: Object.fromEntries(Object.entries(v.self).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c, x]) => [c, pct(x, v.us)])) };
}
console.log(JSON.stringify(report, null, 1));
