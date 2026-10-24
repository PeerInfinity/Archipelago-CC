/**
 * The bridge's clock-step decision (arc D2 slice 1; Instant pump added by
 * slice 1 of the Instant-policy pass).
 *
 * Extracted from bridge.js purely so it can be unit-pinned: bridge.js runs
 * inside the omsi iframe and imports nothing testable, while this decision is
 * the one place a mistake freezes the substrate outright.
 *
 * Two tick derivations live here, sharing one gate (`stepSkipReason`):
 * `planClockStep` (paced — ticks from wall time) and `planPumpBatch`
 * (Instant — ticks from the remaining loop budget).
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
 * ⚠ The held-boundary predicate is NOT the game's stopped flag, and the two
 * are separate gates on purpose (see the split below). The engine's own
 * loop-end condition observed BETWEEN step batches is the discriminator for
 * phantom loops, because a legitimate crossing restarts inside the crossing
 * tick and so can never be observed from out here. Falsification: 1,600
 * batches at four sizes (7/13/31/250, straddling the 250-tick boundary at
 * every offset) across 481 real loops produced zero firings, while a planner
 * hold fired within 4 batches. Those numbers still stand — nothing below
 * changes what `isBoundaryHeld` reads.
 *
 * ── The STOPPED gate, and why only LIVE play honours it ──────────────────
 *
 * ⚖ RULED (user, 2026-09-06): *"I want the restart to be triggered by the
 * player pressing the in-game start button, not the addition of the first
 * action of the queue. And in general, I want our code to respect the state
 * of the in-game start and pause controls."*
 *
 * So the gate SPLITS by which window is driving:
 *
 *   - LIVE PLAY (the loops queue parked on this region's Manual / Record /
 *     Bot-fallback block) honours the fork's own `gameIsStopped`: the host
 *     clock withholds every step while the game says stopped, and the
 *     player's Play press is what starts it. Play's own handler
 *     (`driver.js` `pauseGame()`) calls `restart()` when it unpauses AT a
 *     loop end, so pressing Play IS the cold start — the fork boots stopped
 *     and holding a boundary (`saving.js`'s `load()` ends with a
 *     `pauseGame()` toggle), and Play releases both in one press. Measured:
 *     a cold start driven by Play instead of `IdleLoopsManaged.restartLoop()`
 *     passes the whole mana leg (boundary released, restart unreported by
 *     the no-progress guard, one reset at exhaustion).
 *   - A PLAYBACK REPLAY (`_replayInFlight`) and a BOT WALK
 *     (`_stepGateBotRegion`) do NOT honour it, and must not: there the
 *     bridge and the fork's own planner own that flag between them
 *     (`automation.js` `resumeIfPlannerPaused` toggles `pauseGame()`, and
 *     the pause-while-planning option deliberately parks the game stopped
 *     between plans). Gating those on the flag would stall a window whose
 *     timing the player never touches — and there is no Play press coming,
 *     because nobody is at the keyboard.
 *
 * The historical warning this paragraph replaces said gating on the flag
 * "would freeze omsi entirely". That was true of gating EVERY arm on it —
 * the game is stopped for the whole managed session unless something presses
 * Play — and it is exactly why the split above is per-arm, and why the caller
 * (not this module) decides which arm it is in: `liveStopped` is asserted by
 * `bridge.js` only when the LIVE arm is the one that opened the gate.
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
 * The four reasons stepping is withheld, in the order they are checked.
 *
 * Shared by BOTH tick derivations (paced and Instant-pump) so the two can
 * never drift: Instant is a CADENCE change, and a cadence change that also
 * moved a gate would stop being one. Returns null when stepping may proceed.
 *
 * `stopped` is checked BEFORE `heldBoundary` because the two coincide at the
 * boot state this substrate always starts from (`{shouldRestart: true,
 * gameIsStopped: true}`), and the honest reason there is the player's — the
 * Play press releases both. It also keeps `heldBoundary` meaning what the bot
 * cold start and the bot exit crossing in `bridge.js` already read it to mean:
 * a boundary held by something OTHER than the player.
 *
 * @param {boolean} args.liveStopped - the LIVE arm opened the gate AND the
 *   fork says stopped. Always false on the replay and bot arms (they are
 *   exempt by ⚖ ruling — see the header), so this module never has to know
 *   which arm it is in.
 * @returns {null|'noQueue'|'gated'|'stopped'|'heldBoundary'}
 */
function stepSkipReason({ hasRunnableQueue, gateOpen, liveStopped, state }) {
    if (!hasRunnableQueue) return 'noQueue';
    if (!gateOpen) return 'gated';
    if (liveStopped) return 'stopped';
    if (isBoundaryHeld(state)) return 'heldBoundary';
    return null;
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
 * @param {boolean} [args.liveStopped]   - live play, and the game says stopped
 * @param {{shouldRestart?: boolean, timer?: number, timeNeeded?: number}|null}
 *        args.state - the engine's loop-end state
 * @returns {{ticks: number,
 *            skip: null|'noQueue'|'gated'|'stopped'|'heldBoundary'}}
 */
export function planClockStep({
    elapsedMs,
    ticksPerSecond,
    maxTicks,
    hasRunnableQueue,
    gateOpen,
    liveStopped = false,
    state,
}) {
    const skip = stepSkipReason({ hasRunnableQueue, gateOpen, liveStopped, state });
    if (skip) return { ticks: 0, skip };
    const ticks = Math.min(maxTicks, Math.round((elapsedMs * ticksPerSecond) / 1000));
    return { ticks: ticks > 0 ? ticks : 0, skip: null };
}

/**
 * Decide ONE batch of an Instant pump (slice 1 of the Instant-policy pass).
 *
 * Same gate, different clock. `planClockStep` derives its tick count from
 * WALL TIME; the pump derives it from how much loop budget is left, because
 * Instant's whole content is "stop consulting wall time". Every other input
 * — and the skip ordering — is shared with the paced path on purpose
 * (`stepSkipReason`): Instant changes cadence only, so a batch is withheld
 * for exactly the reasons a paced tick is.
 *
 * ── Why the batch is CLAMPED to the remaining budget ─────────────────────
 *
 * `timer` is compared against `timeNeeded` inside `singleTick`, so a batch
 * that overshoots the boundary has already spent mana the pool did not have:
 * the bridge mirrors drains 1:1 into a SHARED pool, and the host's
 * out-of-mana → `triggerLoopReset` answer is a round trip away. Paced play
 * bounds that overdraw at `MAX_TICKS_PER_CALLBACK` (100 ticks) by accident of
 * its rate; an unclamped pump would bound it only by the batch size. Stepping
 * exactly `ceil(timeNeeded - timer)` instead lands ON the boundary — the
 * crossing tick runs `loopEnd()`/`prepareRestart()` itself, which is an
 * ordinary in-tick restart and not a hold.
 *
 * Recompute EVERY batch rather than once per pump: `timeNeeded` GROWS mid-run
 * (Buy Mana, and the host pinning the budget to a refilled pool), so a clamp
 * computed once would truncate a run that legitimately got longer.
 *
 * The `shouldRestart` half of the boundary is still checked between batches —
 * a plan that exhausts its compiled list ends the loop with `timer` well short
 * of `timeNeeded`, which no budget clamp can predict.
 *
 * @param {Object} args
 * @param {number} args.maxBatch          - ceiling on one synchronous batch
 * @param {boolean} args.hasRunnableQueue - the plan has an enabled action
 * @param {boolean} args.gateOpen         - the loops step gate (D1 slice 2)
 * @param {boolean} [args.liveStopped]    - live play, and the game says stopped.
 *   Reachable only in principle: a pump runs inside a replay or a bot window,
 *   and both arms are exempt from the stopped rule, so the bridge passes
 *   false here on every real path. Threaded anyway because the two
 *   derivations share ONE gate by contract.
 * @param {{shouldRestart?: boolean, timer?: number, timeNeeded?: number}|null}
 *        args.state - the engine's loop-end state
 * @returns {{ticks: number,
 *            skip: null|'noQueue'|'gated'|'stopped'|'heldBoundary'}}
 */
export function planPumpBatch({
    maxBatch, hasRunnableQueue, gateOpen, liveStopped = false, state,
}) {
    const skip = stepSkipReason({ hasRunnableQueue, gateOpen, liveStopped, state });
    if (skip) return { ticks: 0, skip };
    const remaining = state?.timeNeeded - state?.timer;
    // A non-finite budget (a fork build that stopped reporting one half)
    // fails open to the ceiling rather than to a stalled pump — the same
    // posture isBoundaryHeld takes, for the same reason.
    const ticks = Number.isFinite(remaining)
        ? Math.min(maxBatch, Math.ceil(remaining))
        : maxBatch;
    return { ticks: ticks > 0 ? ticks : 0, skip: null };
}
