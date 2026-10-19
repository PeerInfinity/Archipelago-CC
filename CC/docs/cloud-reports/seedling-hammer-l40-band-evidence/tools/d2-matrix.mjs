// LB D2 — the four committed progress solves (solveProgress.test.js's RK_SOLVES: L18 residue 21, L40 totem part, L6,
// L3) under a never-tripping deadline with the fine checkpoints: answer digest, ticks, `shouldStop` total, final
// `budget.asks` per segment, and the guards' counters. Run OFF and with the env switches ON; diff the lines.
//   [SEEDLING_PRESS_KILL_SHAKE_GUARD=1 SEEDLING_PRESS_KILL_REBOOT_GUARD=1] node d2-matrix.mjs
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const { answerDigest } = await import(join(REPO, 'scripts/procgen/probe-seedling-solve-progress.mjs'));
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { withSolveDeadline } = await import(join(MODULE, 'solverBot.js'));
const { withSolveProgress } = await import(join(MODULE, 'solveProgress.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));
const { PRESS_KILL_GUARD_COUNTS, PRESS_KILL_SHAKE_GUARD, PRESS_KILL_REBOOT_GUARD } = await import(join(MODULE, 'pressKillGuards.js'));

const SOLVES = [
    ['L18', 'r9-solve-18', 21, [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }]],
    ['L40', 'r5-l40-part5', null, [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }]],
    ['L6', 'r8-solve-6', null, [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }]],
    ['L3', 'r8-solve-3', null, [{ kind: 'reach-exit', exit: { x: 128, y: 48 } }]],
];
const SOURCE = atlasLevelSource();
console.log(`guards shake=${PRESS_KILL_SHAKE_GUARD.enabled} reboot=${PRESS_KILL_REBOOT_GUARD.enabled}`);
for (const [what, name, residue, goals] of SOLVES) {
    const tape = loadTape(name);
    const base = stagingFromTape(tape);
    let seam = base.seam;
    if (residue !== null) {
        const P = SPINNER.hammerPeriod;
        const was = ((base.seam.time % P) + P) % P;
        seam = { ...base.seam, time: base.seam.time + ((((residue - was) % P) + P) % P) - P };
    }
    const staging = { ...base, seam, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
    let stops = 0;
    const asks = [];
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals, name: tape.name, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle'); } });
    let r;
    try {
        const v = await withSolveProgress((site, peek) => { if (site === 'done') asks.push(peek()?.budget.asks ?? null); },
            () => withSolveDeadline({ shouldStop: () => { stops += 1; return false; }, fineCheckpoints: true }, go));
        r = { ok: true, out: v.out };
    } catch (error) { r = { ok: false, error }; }
    const ticks = r.ok ? r.out.perTick.length : null;
    console.log(`${what} digest=${answerDigest(r)} ok=${r.ok} ticks=${ticks} shouldStop=${stops} asks=${JSON.stringify(asks)}`);
}
console.log('counts', JSON.stringify(PRESS_KILL_GUARD_COUNTS));
