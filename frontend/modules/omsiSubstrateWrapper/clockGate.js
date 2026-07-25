/**
 * The bridge's clock-step decision (arc D2 slice 1).
 *
 * Extracted from bridge.js purely so it can be unit-pinned: bridge.js runs
 * inside the omsi iframe and imports nothing testable, while this decision is
 * the one place a mistake freezes the substrate outright.
 *
 * ── Why a HELD-BOUNDARY predicate ────────────────────────────────────────
 *
 * `singleTick()` (driver.js) ends the loop and asks for a restart whenever
 * `shouldRestart || timer >= timeNeeded`:
 *
 *     if (shouldRestart || timer >= timeNeeded) { loopEnd(); prepareRestart(); }
 *
 * and — unlike the fork's own rAF `tick()` — it never consults `gameIsStopped`.
 * Normally that is harmless: `prepareRestart()` calls `restart()` inside the
 * same tick that crossed the boundary, zeroing `timer` and `effectiveTime`.
 * But when something HOLDS the boundary instead of restarting — Advanced
 * Automation pausing while its planner works (`interceptPrepareRestart`
 * returning true), or the `pauseBeforeRestart` / `pauseOnFailedLoop` options —
 * the engine sits past its loop end and EVERY subsequent host tick re-runs
 * `loopEnd()`. Each one mints a phantom loop, and because `effectiveTime` is
 * only zeroed by `restart()`, each one also re-banks an ever-growing value
 * into `totals.effectiveTime`. Measured on the pinned fork: 300 held ticks
 * minted 300 loops and inflated effectiveTime by 2,403 — as much as a genuine
 * 481-loop run.
 *
 * ⚠ The predicate is deliberately NOT `getFullState().stoppedAt`. That reads
 * TRUE during ordinary managed play — `load()` (saving.js) ends with a
 * `pauseGame()` toggle, so `gameIsStopped` is true for the whole substrate
 * session — and gating on it would freeze omsi entirely. The engine's own
 * loop-end condition observed BETWEEN step batches is the discriminator,
 * because a legitimate crossing restarts inside the crossing tick and so can
 * never be observed from out here. Falsification: 1,600 batches at four sizes
 * (7/13/31/250, straddling the 250-tick boundary at every offset) across 481
 * real loops produced zero firings, while a planner hold fired within 4
 * batches.
 *
 * ── BOTH halves of that condition (slice 1b) ─────────────────────────────
 *
 * A loop can end two ways, and a hold on either one mints phantoms:
 *
 *   - `timer >= timeNeeded` — the loop spent its whole budget.
 *   - `shouldRestart` — `actions.tick()` (actions.js:90) sets it when the
 *     COMPILED list runs out of valid actions mid-loop, and only `restart()`
 *     (driver.js:347) clears it. A plan that finishes before its budget does
 *     therefore holds a boundary with `timer` still well short of
 *     `timeNeeded`. Measured: held at timer 260/5250 — 4,990 mana still in
 *     the pool — and 300 further ticks minted 300 loops the timer half could
 *     not see. `_hasRunnableQueue()` does not cover it either: that reads
 *     `actions.next`, which still holds enabled entries; it is
 *     `actions.current` that is exhausted.
 *
 * Routine for the bot flow: an auto-mode plan finishing early IS the normal
 * case, and the planner pause on that boundary is exactly this hold. The same
 * between-batches argument licenses it — `shouldRestart` is set inside a tick
 * and cleared by the in-tick restart, so productive play can never be caught
 * holding it (0 firings across the same 1,600-batch control).
 *
 * Being planner-agnostic is the point: it covers the pause-on-restart options
 * too, and needs no fork edit (`pausedByPlanner` is private to the
 * AdvancedAutomation IIFE and absent from its `_debug` surface).
 */

/**
 * Whether the engine is parked PAST a loop end that never restarted.
 *
 * Mirrors singleTick's own condition — `shouldRestart || timer >= timeNeeded`
 * — so a hold on EITHER loop-end path closes the gate.
 *
 * @param {{shouldRestart?: boolean, timer?: number, timeNeeded?: number}
 *         |null|undefined} state
 *   The engine's loop-end state — `{shouldRestart, timer, timeNeeded}`.
 * @returns {boolean} true when stepping would mint phantom loops.
 */
export function isBoundaryHeld(state) {
    // Each half fails open INDEPENDENTLY: a fork build that stopped reporting
    // one of them degrades to the other rather than to a frozen substrate
    // (phantom loops are a bad day; a frozen substrate is a dead one).
    if (state?.shouldRestart === true) return true;
    const timer = state?.timer;
    const timeNeeded = state?.timeNeeded;
    if (!Number.isFinite(timer) || !Number.isFinite(timeNeeded)) return false;
    return timer >= timeNeeded;
}

/**
 * Decide what a single clock callback should do.
 *
 * Returns the tick count to step and, when that is zero, WHY — so the caller
 * can keep per-reason diagnostics without re-deriving the conditions.
 *
 * @param {Object} args
 * @param {number} args.elapsedMs        - wall time since the last callback
 * @param {number} args.ticksPerSecond   - the game's base tick rate
 * @param {number} args.maxTicks         - per-callback ceiling
 * @param {boolean} args.hasRunnableQueue - the plan has an enabled action
 * @param {boolean} args.gateOpen        - the loops step gate (D1 slice 2)
 * @param {{shouldRestart?: boolean, timer?: number, timeNeeded?: number}|null}
 *        args.state - the engine's loop-end state
 * @returns {{ticks: number, skip: null|'noQueue'|'gated'|'heldBoundary'}}
 */
export function planClockStep({
    elapsedMs,
    ticksPerSecond,
    maxTicks,
    hasRunnableQueue,
    gateOpen,
    state,
}) {
    if (!hasRunnableQueue) return { ticks: 0, skip: 'noQueue' };
    if (!gateOpen) return { ticks: 0, skip: 'gated' };
    if (isBoundaryHeld(state)) return { ticks: 0, skip: 'heldBoundary' };
    const ticks = Math.min(maxTicks, Math.round((elapsedMs * ticksPerSecond) / 1000));
    return { ticks: ticks > 0 ? ticks : 0, skip: null };
}
