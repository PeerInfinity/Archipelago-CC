/**
 * seedlingDemo/hammerKeylockTurretEdgeBaitRows — the witnesses of hammer-phase EDGEBAIT's rows
 * (`hammerKeylockTurretEdgeBait.test.js`, `hammerKeylockTurretEdgeBait.train.test.js`). Test support only: nothing in
 * the app imports it.
 *   - `solveL40Lock(staging, {idle, budget})`: an L40 staging (`hammerKeylockTurretL40.js`) with the keylock arm's own
 *     goal, `bosslock@480,352` cleared ({40, 8}), after `idle` empty ticks (the door below the turret fades open by
 *     about tick 100). No `budget`: `solveFromTape`, the dashless pass, unbounded. A `budget`: `solveAnytime` as the
 *     page's worker runs it (its two passes, `budgetWork` = budget). A plan's keys are replayed on a FRESH run (30(c)).
 */
import { liveOf, replayTape, settleSolve, solveAnytime, solveFromTape } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';

const CLEAR_TAG = Object.freeze({ kind: 'clear-tag', tag: { level: 40, tag: 8 }, at: { x: 480, y: 352 },
    obstacle: 'bosslock@480,352' });
const WORKER_PASSES = Object.freeze([{ pass: 'dashless', dashMode: 'none', stop: 'all' },
    { pass: 'full', dashMode: 'all', adds: 'sword-dash', stop: 'window' }]);

/** `{ok, message}` or `{ok, ticks, solution, hits, deaths, open, dead}` (+ `work`, `passes` under a budget). */
export function solveL40Lock(staging, { idle = 0, budget = null } = {}) {
    const levelSource = atlasLevelSource();
    const pre = Array.from({ length: idle }, () => new Set());
    const live = liveOf(replayTape({ staging, perTick: pre, levelSource, scratchPersistence: true }));
    const tape = { staging, perTick: pre, live, levelSource, solverGoal: CLEAR_TAG, name: 'edgebait-lock',
        scratchPersistence: true };
    const answer = budget === null
        ? settleSolve(() => solveFromTape({ ...tape, dashMode: 'none', fineCheckpoints: true }))
        : solveAnytime({ ...tape, equips: null, budgetWork: budget, upgradeWindowWork: 85 }, { passes: WORKER_PASSES });
    const head = budget === null ? {} : { work: answer.work, passes: (answer.passes ?? []).map(({ ms, ...p }) => p) };
    if (!answer.ok) return { ok: false, ...head, message: String(answer.message ?? '') };
    const run = replayTape({ staging, perTick: pre, levelSource, scratchPersistence: true });
    for (const held of answer.plan.solution) run.advance(held);
    return { ok: true, ...head, ticks: answer.plan.solution.length,
        solution: answer.plan.solution.map((s) => [...s].sort().join('+')),
        hits: run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`), deaths: run.playerDeaths.length,
        open: run.entities('openActivators').has('bosslock@480,352'),
        dead: run.entities('turrets').get('iceturret@472,400')?.dead === true };
}
