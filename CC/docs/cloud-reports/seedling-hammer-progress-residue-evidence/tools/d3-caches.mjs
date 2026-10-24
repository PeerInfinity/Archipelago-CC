// d3-caches.mjs (measure only, PR D3): each committed solve's final `caches` / `churn` per segment, the snapshot count and the
// largest `{caches, churn}` bytes at any snapshot; `--xc`: the cross-pass escape cache ON, its member wired by this hook
// (`progressCaches` at each segment's first call — the solver-side line is held). node d3-caches.mjs [L18|L40|L6|L3] [--xc]
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC'; const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { withSolveDeadline, withEscapeCrossPassCache } = await import(join(MODULE, 'solverBot.js'));
const { withSolveProgress, progressCaches } = await import(join(MODULE, 'solveProgress.js'));
const { ESCAPE_CROSS_PASS_CACHE_COUNTS } = await import(join(MODULE, 'solverBot.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));
const SOURCE = atlasLevelSource();
function stagingOf(name, residue = null) {
    const base = stagingFromTape(loadTape(name)); let seam = base.seam;
    if (residue !== null) { const P = SPINNER.hammerPeriod; const was = ((base.seam.time % P) + P) % P;
        seam = { ...base.seam, time: base.seam.time + ((((residue - was) % P) + P) % P) - P }; }
    return { ...base, seam, noclip: false, noDamage: false, equips: [], persistence: base.persistence.filter((c) => c.at === undefined) };
}
const SOLVES = [
    { what: 'L18', tape: 'r9-solve-18', residue: 21, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], deadline: true },
    { what: 'L40', tape: 'r5-l40-part5', goals: [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }], deadline: true },
    { what: 'L6', tape: 'r8-solve-6', goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }], deadline: false },
    { what: 'L3', tape: 'r8-solve-3', goals: [{ kind: 'reach-exit', exit: { x: 128, y: 48 } }], deadline: false },
];
const xcArg = process.argv.includes('--xc');
for (const s of SOLVES) {
    if (process.argv[2] && !process.argv[2].startsWith('--') && process.argv[2] !== s.what) continue;
    const staging = stagingOf(s.tape, s.residue ?? null);
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: s.goals, name: s.tape, boot: staging.boot, persistence: staging.persistence, gameTick: () => { throw new Error('x'); } });
    const finals = []; let snaps = 0; let maxBytes = 0;
    const hook = (site, peek) => { if (xcArg && site === 'segment') progressCaches(ESCAPE_CROSS_PASS_CACHE_COUNTS); const x = peek(); if (x) { snaps += 1; maxBytes = Math.max(maxBytes, JSON.stringify({ c: x.caches, h: x.churn }).length); } if (site === 'done') finals.push(x); };
    const run = () => (s.deadline ? withSolveDeadline({ shouldStop: () => false, fineCheckpoints: true }, go) : go());
    await (xcArg ? withEscapeCrossPassCache(true, () => withSolveProgress(hook, run)) : withSolveProgress(hook, run));
    console.log(JSON.stringify({ what: s.what, xc: xcArg, snaps, maxBytes, finals: finals.map((f) => ({ outcome: f.segment.outcome, caches: f.caches, churn: f.churn, bytes: JSON.stringify(f).length })) }));
}
