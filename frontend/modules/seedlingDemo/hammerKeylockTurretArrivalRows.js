/**
 * seedlingDemo/hammerKeylockTurretArrivalRows — the witnesses of hammer-phase KT-ARRIVAL's rows
 * (`hammerKeylockTurretArrival.test.js`, `hammerKeylockTurretArrival.train.test.js`). Test support only: nothing in the
 * app imports it.
 *   - `solveL40Exit(staging)`: an L40 arrival staging (`hammerKeylockTurretL40.js`) with the goal the whole-game walk
 *     asks there, the teleporter@944,96 → L41 (`reach-exit`), solved as the page's worker does (`solveFromTape`, the
 *     dashless pass) and, for a plan, its keys replayed on a FRESH run (30(c));
 *   - `solveCapturedA1()`: the page worker's own request (re-measure-7 A1 29:11, `fixtures/kt-arrival/`) solved with
 *     `solveAnytime` over the committed atlas and the capture's own L40/L41 records, a plan replayed on a fresh run.
 */
import { readFileSync } from 'node:fs';

import { ANYTIME_PASSES, liveOf, replayTape, settleSolve, solveAnytime, solveFromTape } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const EXIT = Object.freeze({ kind: 'reach-exit', exit: { x: 944, y: 96 } });

/** A plan's keys replayed on a fresh run of `staging`: `{hits, deaths, crossed}` (`crossed`: `{t, to}` or null). */
function freshReplay(staging, perTick, levelSource, solution) {
    const run = replayTape({ staging, perTick, levelSource, scratchPersistence: true });
    let crossed = null;
    for (const held of solution) {
        const out = run.advance(held);
        if (out?.transition && crossed === null) crossed = { t: run.ticksCompleted, to: out.transition.to_level };
    }
    return { hits: run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`), deaths: run.playerDeaths.length, crossed };
}

/** Solve an L40 staging toward teleporter@944,96 (`{ok, message}` or `{ok, ticks, hits, deaths, crossed}`). */
export function solveL40Exit(staging) {
    const levelSource = atlasLevelSource();
    const live = liveOf(replayTape({ staging, perTick: [], levelSource, scratchPersistence: true }));
    const answer = settleSolve(() => solveFromTape({ staging, perTick: [], live, levelSource, solverGoal: EXIT,
        name: 'wasm-exit-40', scratchPersistence: true, dashMode: 'none', fineCheckpoints: true }));
    if (!answer.ok) return { ok: false, message: answer.message };
    return { ok: true, ticks: answer.plan.solution.length, ...freshReplay(staging, [], levelSource, answer.plan.solution) };
}

/** The captured A1 29:11 request, solved as the worker does: `{ok, work, passes, message}` and, for a plan, the replay. */
export function solveCapturedA1() {
    const url = new URL('./fixtures/kt-arrival/A1-29-11.request.json', import.meta.url);
    const fx = JSON.parse(readFileSync(url, 'utf8'));
    const { passes = ANYTIME_PASSES, ...tape } = restoreRequest(fx.request);
    const base = atlasLevelSource();
    const own = new Map(fx.levels.map(([level, record]) => [level, restoreRequest(record)]));
    const levelSource = (level) => own.get(level) ?? base(level);
    const answer = solveAnytime({ ...tape, levelSource }, { passes });
    const head = { ok: answer.ok, work: answer.work, passes: (answer.passes ?? []).map(({ ms, ...p }) => p) };
    if (!answer.ok) return { ...head, message: String(answer.message ?? '') };
    return { ...head, ticks: answer.plan.solution.length,
        ...freshReplay(tape.staging, tape.perTick ?? [], levelSource, answer.plan.solution) };
}
