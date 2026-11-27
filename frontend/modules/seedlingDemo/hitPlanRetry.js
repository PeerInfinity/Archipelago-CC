/**
 * seedlingDemo/hitPlanRetry — ⛓⛓ SEEDLING HAMMER-PHASE L39-ARRIVAL-HIT — **A BUDGET-CUT ANSWER WHOSE PLAN BILLS A HIT
 * ASKS THE HELD RETRY, THE WHOLE LADDER AGAIN, BEFORE IT IS PLAYED** (`HIT_PLAN_RETRY`, OFF; `SEEDLING_HIT_PLAN_RETRY=1`,
 * `withHitPlanRetry(enabled, fn)`). ⚖ The user, 2026-11-26: *"L39 18:11 arrival hit"*
 * (`CC/docs/cloud-reports/seedling-hammer-l39-arrival-hit.md`).
 *
 * MEASURED (re-measure-11's S1 18:11, L39 "Totem Part 72,40", the arrival at seam 29994): the dashless pass solves with
 * one model hit (536 of the 640 units), the full pass is cut at the BUDGET (`limit: 'budget'`), and the hit-avoid pass
 * has 1 unit left. The page's `wasmPlayback.expiryAction` plays any budget-cut answer that holds a plan ('provisional'),
 * so the billed hit shipped. The same request's whole ladder at the held retry's 4× budget solves hitless: the full
 * pass, with the dashless plan IN HAND, trips its upgrade window at `sword-dash` and returns a hitless partial-dash plan.
 * Over one 45-tick period of arrival seams, 7 bill this hit; all 7 are hitless so.
 *
 * ON, two reads, both on the page's MAIN thread:
 *  - `wasmPlayback.expiryAction` answers 'retry' for a budget-cut answer whose plan the model plays into a hit or a death
 *    (`hitPlanRetryAsks`), while a retry is left and a pass is unanswered; the cut plan stays the retry's `best`, so the
 *    page ships whichever `betterAnswer` prefers (a hitless plan wins by the verdict; neither → the shorter, as today).
 *  - `jsRuntimeSolveService` does not count a pass whose answer bills a hit as ANSWERED (`hitPlanHeldOpen`), so the held
 *    retry (`passesAfter`) runs that pass again, and every later pass sees a plan in hand, as the first attempt did.
 *    Resuming at the cut pass alone, it runs with no plan in hand and no window, and declines at one seam of the seven.
 * ⚖ No-hit logic: a hitless plan is never retried and is played as before. A retry that is cut again with no plan gives
 * up as a refusal does today (the goal fails by name); a retry that declines by name plays the cut plan, as today.
 * OFF: both reads are false — byte-identical.
 * ⛓ THE THREAD: the MAIN thread (`seedlingWasmPlayback.pollSolve`, the solve service's message handler), so the switch
 * also reads the page URL's own `?seedlingSolverEnv=` (`pageSolverEnvSwitchOn`, YETI-TALK's pattern); node reads the env.
 * `jsRuntimeSolver.js` re-exports it (the worker's import closure holds the name: `solverEnvChannel`'s one table).
 */
import { pageSolverEnvSwitchOn } from './solverEnvChannel.js';

export const HIT_PLAN_RETRY = { enabled: globalThis.process?.env?.SEEDLING_HIT_PLAN_RETRY === '1'
    || pageSolverEnvSwitchOn('SEEDLING_HIT_PLAN_RETRY') };
export const HIT_PLAN_RETRY_DEFAULT = false;

/** Run `fn` with `HIT_PLAN_RETRY` set to `enabled`, restoring the previous value. */
export function withHitPlanRetry(enabled, fn) {
    const was = HIT_PLAN_RETRY.enabled;
    HIT_PLAN_RETRY.enabled = enabled === true;
    try { return fn(); } finally { HIT_PLAN_RETRY.enabled = was; }
}

/** A plan's `modelHits` stamp bills a hit or a death (`jsRuntimeSolver.planTakesHit === true`); no stamp → false. */
export function billsHit(modelHits) {
    if (!modelHits || typeof modelHits !== 'object') return false;
    return (modelHits.hits ?? 0) > 0 || (modelHits.deaths ?? 0) > 0;
}

/** ON: should a budget-cut `answer` that holds a plan be retried rather than played? */
export function hitPlanRetryAsks(answer) {
    return HIT_PLAN_RETRY.enabled && answer?.ok === true && answer.kind !== 'divergence' && billsHit(answer.plan?.modelHits);
}

/** ON: a pass's `answer` is a plan that bills a hit — not a final word for the held retry (it runs that pass again). */
export function hitPlanHeldOpen(answer) {
    return HIT_PLAN_RETRY.enabled && answer?.ok === true && billsHit(answer.plan?.modelHits);
}
