// The v1 projection of every segment's final snapshot (peeked at `done`): `v` dropped, and at v2 the new fields too
// (`rejectionKinds` on every node, `lastWhy`). Same bytes at the base (v1) and at v2 ⇒ the v1 fields did not move.
// node v1proj.mjs → one JSON line per solve {what, md5, finals, digest}
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { withSolveDeadline } = await import(join(MODULE, 'solverBot.js'));
const { withSolveProgress } = await import(join(MODULE, 'solveProgress.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));
const SOURCE = atlasLevelSource();
const md5 = (x) => createHash('md5').update(x).digest('hex');
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
const strip = (n) => { const { rejectionKinds, children, ...rest } = n; return { ...rest, children: children.map(strip) }; };
const v1 = (s) => { const { v, lastWhy, tree, ...rest } = s; return { ...rest, tree: strip(tree) }; };
const SOLVES = [
    { what: 'L18', tape: 'r9-solve-18', residue: 21, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], deadline: true },
    { what: 'L40', tape: 'r5-l40-part5', goals: [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }], deadline: true },
    { what: 'L6', tape: 'r8-solve-6', goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }], deadline: false },
    { what: 'L3', tape: 'r8-solve-3', goals: [{ kind: 'reach-exit', exit: { x: 128, y: 48 } }], deadline: false },
];
for (const s of SOLVES) {
    if (process.argv[2] && process.argv[2] !== s.what) continue;
    const staging = stagingOf(s.tape, s.residue ?? null);
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: s.goals, name: s.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    const finals = [];
    const hook = (site, peek) => { if (site === 'done') finals.push(peek()); };
    const run = () => (s.deadline ? withSolveDeadline({ shouldStop: () => false, fineCheckpoints: true }, go) : go());
    await withSolveProgress(hook, run);
    const proj = JSON.stringify(finals.map(v1));
    console.log(JSON.stringify({ what: s.what, md5: md5(proj), finals: finals.length, v: finals.map((f) => f.v),
        bytes: finals.map((f) => JSON.stringify(f).length) }));
}
