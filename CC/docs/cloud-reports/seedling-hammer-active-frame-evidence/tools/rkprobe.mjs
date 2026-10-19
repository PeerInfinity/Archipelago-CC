// TC2's copy of RK's probe (+ the posted snapshots' bytes and frames). Read-only RK probe: one solve under the real tap at --interval ms (or none), deadline never trips, fine checkpoints on.
// Records the digest, shouldStop, each segment's final asks, each node's rejection keys (and, at v2, kinds and lastWhy),
// the wall time and each segment's final snapshot size. HB's hbprobe.mjs plus the segment finals.
// node rkprobe.mjs --tape=r5-l40-part5 --goal=collect:160,640 [--residue=21] [--interval=100|none]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

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
const { createProgressTap } = await import(join(MODULE, 'solveProgressTap.js'));

const tapeName = arg('tape');
const goals = goalsFrom(arg('goal'));
const residue = arg('residue', null);
const interval = arg('interval', '100');
const tape = loadTape(tapeName);
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

const finals = [];
const posted = { n: 0, bytes: 0, max: 0, framed: 0 };
let tap = null;
let hook = null;
let calls = 0;
if (interval !== 'none') {
    tap = createProgressTap({ passes: [{ pass: 'probe', stop: 'all' }], clock: () => performance.now(),
        minIntervalMs: Number(interval), budgetWork: null, post: (snap) => {
            structuredClone(snap);
            const b = JSON.stringify(snap).length;
            posted.n += 1; posted.bytes += b; posted.max = Math.max(posted.max, b);
            if (snap.frame !== undefined && snap.frame !== null) posted.framed += 1;
        } });
    hook = (site, peek) => { calls += 1; tap.hook(site, peek); if (site === 'done') finals.push(peek()); };
}
const t0 = performance.now();
let r;
try {
    const value = await (hook === null ? deadlined() : withSolveProgress(hook, deadlined));
    r = { ok: true, out: value.out, passes: value.passes };
} catch (error) { r = { ok: false, error }; }
const wall = performance.now() - t0;
if (tap) tap.finish();
const nodes = (n, out = []) => { out.push(n); for (const c of n.children) nodes(c, out); return out; };
const out = { tape: tapeName, interval, wall: Math.round(wall), digest: answerDigest(r), shouldStops, ok: r.ok,
    ticks: r.ok ? r.out.perTick.length : null, hookCalls: calls };
if (tap) {
    out.segments = finals.map((s) => ({
        index: s.segment.index, outcome: s.segment.outcome, v: s.v, bytes: JSON.stringify(s).length,
        asks: s.budget.asks,
        rejections: Object.fromEntries(nodes(s.tree).filter((n) => Object.keys(n.rejections).length)
            .map((n) => [n.key, n.rejections])),
        ...(s.tree.rejectionKinds !== undefined ? { kinds: Object.fromEntries(nodes(s.tree)
            .filter((n) => Object.keys(n.rejectionKinds).length).map((n) => [n.key, n.rejectionKinds])) } : {}),
        ...(s.lastWhy !== undefined ? { lastWhy: s.lastWhy } : {}),
        ...(s.frame !== undefined ? { frame: s.frame } : {}),
    }));
}
if (tap) out.posted = posted;
console.log(JSON.stringify(out));
