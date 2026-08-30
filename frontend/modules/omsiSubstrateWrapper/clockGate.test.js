/**
 * Arc D2 slice 1 — the held-boundary clock gate, pinned on BOTH sides.
 *
 * The fake engine below models what the pinned fork (2bda39b) actually does,
 * measured live in the slice-0 probes:
 *
 *   - Productive tick: timer++, effectiveTime += 1/50. Crossing timeNeeded
 *     ends the loop AND restarts inside the SAME tick (timer/effectiveTime
 *     back to 0, totals.loops++). This is why a legitimate boundary can never
 *     be observed from outside a step batch.
 *   - Held tick (something intercepted prepareRestart): loopEnd() still runs,
 *     restart() does not. totals.loops++ every tick, and totals.effectiveTime
 *     re-banks a never-zeroed effectiveTime — the quadratic inflation.
 *
 * Both directions matter: a gate that fails to close mints phantom loops, and
 * a gate that closes on ordinary play freezes the substrate (which is exactly
 * what the originally-proposed `stoppedAt` predicate would have done).
 */
import { describe, it, expect } from 'vitest';
import { isBoundaryHeld, planClockStep, planPumpBatch } from './clockGate.js';

const TICKS_PER_SECOND = 50;
const MAX_TICKS = 500;
const TIME_NEEDED = 250;

/**
 * A minimal stand-in for the fork's driver.js loop clock.
 *
 * `planLength` models the COMPILED queue: once that many ticks have run in a
 * loop, actions.tick() finds no valid action and sets shouldRestart — the
 * second way a loop ends (slice 1b), reachable with the budget barely
 * touched. Left null, loops only ever end on the timer.
 */
function createFakeEngine({ heldFromLoop = null, planLength = null, timeNeeded = TIME_NEEDED } = {}) {
    const engine = {
        timer: 0,
        timeNeeded,
        effectiveTime: 0,
        shouldRestart: false,
        ticksThisLoop: 0,
        totals: { loops: 0, effectiveTime: 0 },
        stepCalls: 0,
        ticksStepped: 0,
        /** True once the boundary is being held rather than restarted. */
        holding: false,
        getFullState() {
            // Deliberately WITHOUT shouldRestart: the real getFullState does
            // not carry it either, which is why the bridge reads the global.
            return { timer: this.timer, timeNeeded: this.timeNeeded };
        },
        loopEndState() {
            return { shouldRestart: this.shouldRestart, timer: this.timer, timeNeeded: this.timeNeeded };
        },
        step(n) {
            this.stepCalls += 1;
            for (let i = 0; i < n; i++) this.singleTick();
            this.ticksStepped += n;
        },
        singleTick() {
            this.timer += 1;
            this.ticksThisLoop += 1;
            this.effectiveTime += 1 / TICKS_PER_SECOND;
            // actions.tick(): the compiled list ran dry (actions.js:90)
            if (planLength !== null && this.ticksThisLoop >= planLength) this.shouldRestart = true;
            if (this.shouldRestart || this.timer >= this.timeNeeded) {
                // loopEnd(): banks whatever effectiveTime has accumulated
                this.totals.loops += 1;
                this.totals.effectiveTime += this.effectiveTime;
                // prepareRestart(): restart() unless something holds it
                const holdNow = heldFromLoop !== null && this.totals.loops >= heldFromLoop;
                if (holdNow) {
                    this.holding = true;      // the loop-end flags stay set
                } else {
                    this.timer = 0;
                    this.effectiveTime = 0;
                    this.ticksThisLoop = 0;
                    this.shouldRestart = false;   // restart() (driver.js:347)
                }
            }
        },
    };
    return engine;
}

/** Run the real decision function over a fake engine, as _clockTick does. */
function runClock(engine, callbacks, { gateOpen = true, hasRunnableQueue = true } = {}) {
    const skips = { noQueue: 0, gated: 0, heldBoundary: 0 };
    for (let i = 0; i < callbacks; i++) {
        const { ticks, skip } = planClockStep({
            elapsedMs: 200,                       // the bridge's clock interval
            ticksPerSecond: TICKS_PER_SECOND,
            maxTicks: MAX_TICKS,
            hasRunnableQueue,
            gateOpen,
            state: engine.loopEndState(),
        });
        if (skip) skips[skip] += 1;
        if (ticks > 0) engine.step(ticks);
    }
    return skips;
}

describe('isBoundaryHeld', () => {
    it('is false mid-loop and true past a loop end that never restarted', () => {
        expect(isBoundaryHeld({ timer: 0, timeNeeded: 250 })).toBe(false);
        expect(isBoundaryHeld({ timer: 249, timeNeeded: 250 })).toBe(false);
        expect(isBoundaryHeld({ timer: 250, timeNeeded: 250 })).toBe(true);
        expect(isBoundaryHeld({ timer: 251, timeNeeded: 250 })).toBe(true);
    });

    it('sees the OTHER loop end — a plan that finished before its budget', () => {
        // slice 1b. actions.tick() sets shouldRestart when the compiled list
        // runs dry; only restart() clears it. Measured on the fork: held at
        // timer 260 of 5250, i.e. 4,990 mana still in the pool — invisible to
        // the timer half, and 300 further ticks minted 300 loops.
        expect(isBoundaryHeld({ shouldRestart: true, timer: 260, timeNeeded: 5250 })).toBe(true);
        expect(isBoundaryHeld({ shouldRestart: false, timer: 260, timeNeeded: 5250 })).toBe(false);
    });

    it('never freezes on an unreadable clock — each half fails open alone', () => {
        // A fork build that stopped reporting one of them must degrade to the
        // other, not to a dead substrate.
        expect(isBoundaryHeld(null)).toBe(false);
        expect(isBoundaryHeld(undefined)).toBe(false);
        expect(isBoundaryHeld({})).toBe(false);
        expect(isBoundaryHeld({ timer: NaN, timeNeeded: 250 })).toBe(false);
        expect(isBoundaryHeld({ timer: 250, timeNeeded: undefined })).toBe(false);
        // no shouldRestart reported → the timer half still decides
        expect(isBoundaryHeld({ timer: 250, timeNeeded: 250 })).toBe(true);
        // no timer pair reported → the shouldRestart half still decides
        expect(isBoundaryHeld({ shouldRestart: true })).toBe(true);
        // and a non-boolean flag is not truthy-coerced into a freeze
        expect(isBoundaryHeld({ shouldRestart: 'yes', timer: 10, timeNeeded: 250 })).toBe(false);
    });

    it('does NOT use stoppedAt — which is ambient-true in managed play', () => {
        // saving.js load() ends with a pauseGame() toggle, so gameIsStopped is
        // true for the whole substrate session. Gating on it froze omsi.
        expect(isBoundaryHeld({ timer: 10, timeNeeded: 250, stoppedAt: true })).toBe(false);
    });
});

describe('planClockStep — the productive-play control', () => {
    it('steps normally through in-tick restarts, gate never closing', () => {
        const engine = createFakeEngine();                   // never holds
        const skips = runClock(engine, 100);                 // 100 × 10 ticks

        expect(skips.heldBoundary).toBe(0);                  // the false-positive check
        expect(engine.stepCalls).toBe(100);
        expect(engine.ticksStepped).toBe(1000);
        // 1000 ticks / 250 per loop = 4 real loops, each banking 250/50 = 5.
        expect(engine.totals.loops).toBe(4);
        expect(engine.totals.effectiveTime).toBeCloseTo(20, 6);
    });

    it('holds the rate ceiling and skips with a reason when starved or gated', () => {
        const engine = createFakeEngine();
        expect(planClockStep({
            elapsedMs: 60_000, ticksPerSecond: TICKS_PER_SECOND, maxTicks: MAX_TICKS,
            hasRunnableQueue: true, gateOpen: true, state: engine.getFullState(),
        })).toEqual({ ticks: MAX_TICKS, skip: null });

        expect(runClock(engine, 5, { hasRunnableQueue: false }).noQueue).toBe(5);
        expect(runClock(engine, 5, { gateOpen: false }).gated).toBe(5);
        // Neither skip reason may be reported as the held-boundary one.
        expect(runClock(engine, 5, { gateOpen: false }).heldBoundary).toBe(0);
    });
});

describe('planClockStep — the held boundary', () => {
    it('takes zero step() calls and moves no totals once the boundary is held', () => {
        const engine = createFakeEngine({ heldFromLoop: 2 }); // hold at loop 2
        runClock(engine, 100);

        expect(engine.holding).toBe(true);
        const stepCallsAtHold = engine.stepCalls;
        const loopsAtHold = engine.totals.loops;
        const effTimeAtHold = engine.totals.effectiveTime;

        // Keep the clock running well past the hold: nothing may move.
        const skips = runClock(engine, 200);

        expect(skips.heldBoundary).toBe(200);
        expect(engine.stepCalls).toBe(stepCallsAtHold);
        expect(engine.totals.loops).toBe(loopsAtHold);
        expect(engine.totals.effectiveTime).toBeCloseTo(effTimeAtHold, 6);
    });

    it('reopens without stepping once the hold clears (the resume path)', () => {
        // The worker's onResult → restart() zeroes timer synchronously on
        // worker onmessage, i.e. between two clock callbacks. The gate must
        // reopen on its own — it must not need a step to notice.
        const engine = createFakeEngine({ heldFromLoop: 1 });
        runClock(engine, 50);
        expect(engine.holding).toBe(true);
        expect(runClock(engine, 10).heldBoundary).toBe(10);

        engine.timer = 0;                 // restart() lands out-of-band
        engine.effectiveTime = 0;
        engine.holding = false;

        const skips = runClock(engine, 10);
        expect(skips.heldBoundary).toBe(0);
        expect(engine.ticksStepped).toBeGreaterThan(0);
    });

    it('closes on a QUEUE-EXHAUSTION hold, with the budget barely touched', () => {
        // The slice-1b case: a 40-tick plan inside a 5000-tick budget. The
        // loop ends on shouldRestart, the planner holds it, and the timer half
        // of the predicate never fires — timer sits at 40 of 5000 forever.
        const engine = createFakeEngine({ planLength: 40, timeNeeded: 5000, heldFromLoop: 1 });
        runClock(engine, 20);

        expect(engine.holding).toBe(true);
        expect(engine.shouldRestart).toBe(true);
        // The hold is REAL and the timer half is genuinely blind to it —
        // otherwise this test would pass for slice 1's reason, not 1b's.
        expect(engine.timer).toBeLessThan(engine.timeNeeded);
        expect(isBoundaryHeld({ timer: engine.timer, timeNeeded: engine.timeNeeded })).toBe(false);

        const stepCallsAtHold = engine.stepCalls;
        const loopsAtHold = engine.totals.loops;
        const skips = runClock(engine, 200);

        expect(skips.heldBoundary).toBe(200);
        expect(engine.stepCalls).toBe(stepCallsAtHold);
        expect(engine.totals.loops).toBe(loopsAtHold);
    });

    it('a plan finishing early during PRODUCTIVE play still steps normally', () => {
        // The false-positive control for the shouldRestart half: short plans
        // that restart in-tick must never be caught holding the flag. (On the
        // fork: 0 firings across 1,600 batches / 481 real loops.)
        const engine = createFakeEngine({ planLength: 40, timeNeeded: 5000 });
        const skips = runClock(engine, 100);

        expect(skips.heldBoundary).toBe(0);
        expect(engine.stepCalls).toBe(100);
        expect(engine.totals.loops).toBe(25);   // 1000 ticks / 40 per plan
    });

    it('is what stands between the host and the measured phantom-loop mint', () => {
        // Non-vacuity: with the gate removed, the same fake reproduces the
        // live measurement — 1 phantom loop per held tick, plus quadratic
        // effectiveTime inflation. If this ever stops being true, the pin
        // above is passing for the wrong reason.
        const engine = createFakeEngine({ heldFromLoop: 1 });
        runClock(engine, 50);                          // reach the hold
        const loopsAtHold = engine.totals.loops;
        const effTimeAtHold = engine.totals.effectiveTime;

        engine.step(300);                              // ungated stepping

        expect(engine.totals.loops - loopsAtHold).toBe(300);
        expect(engine.totals.effectiveTime - effTimeAtHold).toBeGreaterThan(1000);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// Instant pump (Instant-policy pass, slice 1)
// ─────────────────────────────────────────────────────────────────────────

const PUMP_BATCH = 250;

/**
 * Run the real pump decision over a fake engine, as `_runInstantPump` does.
 *
 * Mirrors the bridge's loop faithfully in the two respects the contract turns
 * on: the state is re-read EVERY batch (so a mid-run `timeNeeded` change is
 * seen), and a RUN END yields — which the bridge detects through its
 * onRestart callback and this models as a `totals.loops` change.
 */
function runPump(engine, {
    gateOpen = true,
    hasRunnableQueue = true,
    maxBatch = PUMP_BATCH,
    ceiling = 200_000,
    onBatch = null,
} = {}) {
    let stepped = 0;
    let batches = 0;
    let reason = 'ceiling';
    while (stepped < ceiling) {
        const { ticks, skip } = planPumpBatch({
            maxBatch: Math.min(maxBatch, ceiling - stepped),
            hasRunnableQueue,
            gateOpen,
            state: engine.loopEndState(),
        });
        if (skip !== null) { reason = skip; break; }
        if (ticks <= 0) { reason = 'noBudget'; break; }
        const loopsBefore = engine.totals.loops;
        engine.step(ticks);
        stepped += ticks;
        batches += 1;
        onBatch?.(engine, batches);
        if (engine.totals.loops !== loopsBefore) { reason = 'runEnd'; break; }
    }
    return { stepped, batches, reason };
}

describe('planPumpBatch', () => {
    it('withholds a batch for exactly the reasons a paced tick is withheld', () => {
        // Gate parity is the contract: Instant is a CADENCE change, so a
        // cadence change that also moved a gate would stop being one.
        const cases = [
            { hasRunnableQueue: false, gateOpen: true, state: { timer: 0, timeNeeded: 250 } },
            { hasRunnableQueue: true, gateOpen: false, state: { timer: 0, timeNeeded: 250 } },
            { hasRunnableQueue: true, gateOpen: true, state: { timer: 250, timeNeeded: 250 } },
            { hasRunnableQueue: true, gateOpen: true, state: { shouldRestart: true, timer: 4, timeNeeded: 250 } },
            { hasRunnableQueue: true, gateOpen: true, state: { timer: 10, timeNeeded: 250 } },
        ];
        for (const c of cases) {
            const paced = planClockStep({
                elapsedMs: 200, ticksPerSecond: TICKS_PER_SECOND, maxTicks: MAX_TICKS, ...c,
            });
            const pumped = planPumpBatch({ maxBatch: PUMP_BATCH, ...c });
            expect(pumped.skip).toBe(paced.skip);
        }
    });

    it('clamps the batch to the remaining budget so it lands ON the boundary', () => {
        // The overdraw bound. Paced play caps a single step at 100 ticks by
        // accident of its rate; an unclamped pump would spend a whole batch
        // of mana the shared pool did not have, and the host's out-of-mana
        // answer is a round trip away.
        expect(planPumpBatch({
            maxBatch: PUMP_BATCH, hasRunnableQueue: true, gateOpen: true,
            state: { timer: 240, timeNeeded: 250 },
        }).ticks).toBe(10);
        // A budget longer than the batch takes the batch ceiling instead.
        expect(planPumpBatch({
            maxBatch: PUMP_BATCH, hasRunnableQueue: true, gateOpen: true,
            state: { timer: 0, timeNeeded: 5000 },
        }).ticks).toBe(PUMP_BATCH);
        // Fractional budgets round UP: timer is an integer counter, and
        // stepping ceil() is what makes `timer >= timeNeeded` true.
        expect(planPumpBatch({
            maxBatch: PUMP_BATCH, hasRunnableQueue: true, gateOpen: true,
            state: { timer: 0, timeNeeded: 10.4 },
        }).ticks).toBe(11);
    });

    it('never overshoots the boundary, at any offset', () => {
        // Swept, because an off-by-one here is an overdraw the pool eats.
        for (let timeNeeded = 1; timeNeeded <= 400; timeNeeded += 1) {
            const engine = createFakeEngine({ timeNeeded });
            const { ticks } = planPumpBatch({
                maxBatch: PUMP_BATCH, hasRunnableQueue: true, gateOpen: true,
                state: engine.loopEndState(),
            });
            engine.step(ticks);
            // Either the batch ended the loop exactly (an in-tick restart, so
            // the timer is back at 0) or it stopped short of the boundary.
            const crossed = engine.totals.loops === 1;
            expect(crossed || engine.timer < timeNeeded).toBe(true);
            if (crossed) expect(ticks).toBeLessThanOrEqual(Math.ceil(timeNeeded));
        }
    });

    it('recomputes the clamp every batch, so a budget that GROWS is not truncated', () => {
        // Buy Mana (and the host pinning the budget to a refilled pool) grow
        // timeNeeded mid-run. A clamp computed once per pump would stop the
        // run at the budget it started with.
        const engine = createFakeEngine({ timeNeeded: 300 });
        const { stepped, reason } = runPump(engine, {
            onBatch: (e, batches) => { if (batches === 1) e.timeNeeded = 1200; },
        });
        expect(reason).toBe('runEnd');
        // Ran past the ORIGINAL budget — the growth was seen.
        expect(stepped).toBeGreaterThan(300);
        expect(engine.totals.loops).toBe(1);
    });

    it('fails open to the ceiling on an unreadable budget', () => {
        // Same posture isBoundaryHeld takes: a fork build that stopped
        // reporting one half degrades to a slower pump, not a stalled one.
        expect(planPumpBatch({
            maxBatch: PUMP_BATCH, hasRunnableQueue: true, gateOpen: true,
            state: { timer: 0 },
        }).ticks).toBe(PUMP_BATCH);
    });
});

describe('the Instant pump yields where it must', () => {
    it('yields on a RUN END rather than grinding into the next run', () => {
        // A restart is reported to the host, answered with a loop reset, and
        // that reset teleports — a host round trip that cannot happen while
        // the pump holds the thread.
        const engine = createFakeEngine({ timeNeeded: 1000 });
        const { reason, stepped } = runPump(engine);
        expect(reason).toBe('runEnd');
        expect(engine.totals.loops).toBe(1);
        expect(stepped).toBe(1000);
    });

    it('yields on a HELD boundary without minting a single phantom loop', () => {
        const engine = createFakeEngine({ timeNeeded: 500, heldFromLoop: 1 });
        runPump(engine);                       // reaches the hold, yields
        expect(engine.holding).toBe(true);
        const loopsAtHold = engine.totals.loops;
        const effTimeAtHold = engine.totals.effectiveTime;

        // Re-entering the pump on the next callback must stay yielded.
        const again = runPump(engine);
        expect(again.reason).toBe('heldBoundary');
        expect(again.stepped).toBe(0);
        expect(engine.totals.loops).toBe(loopsAtHold);
        expect(engine.totals.effectiveTime).toBe(effTimeAtHold);
    });

    it('yields immediately on a closed gate or an empty plan', () => {
        for (const opts of [{ gateOpen: false }, { hasRunnableQueue: false }]) {
            const engine = createFakeEngine({ timeNeeded: 1000 });
            const { stepped } = runPump(engine, opts);
            expect(stepped).toBe(0);
            expect(engine.ticksStepped).toBe(0);
        }
    });

    it('yields at the ceiling instead of truncating the run', () => {
        // The ceiling is a thread-yield, not a cap on the work: the pump flag
        // survives, so the next clock callback picks it straight back up.
        const engine = createFakeEngine({ timeNeeded: 100_000 });
        const first = runPump(engine, { ceiling: 1000 });
        expect(first.reason).toBe('ceiling');
        expect(first.stepped).toBe(1000);

        const second = runPump(engine, { ceiling: 1000 });
        expect(second.stepped).toBe(1000);
        expect(engine.timer).toBe(2000);
        expect(engine.totals.loops).toBe(0);      // nothing truncated the run
    });
});

describe('Instant is a CADENCE change — the byte-identity contract', () => {
    /**
     * The slice's independent stratum, stated the way the contract actually
     * reads: N ticks produce the same engine state NO MATTER HOW THEY ARE
     * BATCHED. That is what Instant changes and all it changes — a pump that
     * changed results would not be a pump, it would be a skip.
     *
     * Comparing "pump to the run end" against "paced to the run end" instead
     * would compare different TICK COUNTS, because a batch straddling a
     * `shouldRestart` boundary restarts in-tick and carries its remainder
     * into the next run (measured: a 250-tick batch over a 137-tick plan ends
     * 113 ticks into run 2). That overshoot is real, is bounded, and is
     * pinned separately below — but it is not a cadence divergence, and
     * folding it in here would have made this stratum assert the wrong thing.
     */
    const scenarios = [
        { name: 'a plain budget-bounded run', opts: { timeNeeded: 1000 } },
        { name: 'a plan that exhausts early', opts: { planLength: 137, timeNeeded: 5000 } },
        { name: 'a budget that is not a multiple of the batch', opts: { timeNeeded: 1013 } },
        { name: 'a budget SHORTER than one batch', opts: { timeNeeded: 47 } },
        { name: 'a fractional budget', opts: { timeNeeded: 613.5 } },
        { name: 'a plan and budget that share no common factor', opts: { planLength: 37, timeNeeded: 613.5 } },
    ];

    /** Step exactly `total` ticks in fixed-size batches. */
    function stepInBatches(engine, total, batchSize) {
        let stepped = 0;
        while (stepped < total) {
            const n = Math.min(batchSize, total - stepped);
            engine.step(n);
            stepped += n;
        }
    }

    const stateOf = (e) => ({
        timer: e.timer,
        timeNeeded: e.timeNeeded,
        shouldRestart: e.shouldRestart,
        ticksThisLoop: e.ticksThisLoop,
        loops: e.totals.loops,
        // Fixed precision, not a tolerance: float ACCUMULATION order is
        // identical across batch shapes (the ticks run in the same order), so
        // this is exact equality with the representation pinned.
        effectiveTime: e.effectiveTime.toFixed(12),
        bankedEffectiveTime: e.totals.effectiveTime.toFixed(12),
    });

    for (const { name, opts } of scenarios) {
        it(`is identical across every batch shape — ${name}`, () => {
            const TOTAL = 2000;
            // 1 = the finest cadence there is; 100 = the pump's batch, which
            // is also the paced per-callback cap; 250/2000 = coarser than
            // anything shipped, as a margin.
            const shapes = [1, 7, 10, 100, 250, TOTAL].map((size) => {
                const engine = createFakeEngine(opts);
                stepInBatches(engine, TOTAL, size);
                return { size, state: stateOf(engine) };
            });
            for (const shape of shapes) {
                expect(shape.state, `batch size ${shape.size}`).toEqual(shapes[0].state);
            }
        });
    }

    it('is non-vacuous: the batch shapes really are different work', () => {
        // Without this, the identity assertions above would also pass for a
        // harness that quietly stepped one tick at a time everywhere.
        const fine = createFakeEngine({ timeNeeded: 5000 });
        const coarse = createFakeEngine({ timeNeeded: 5000 });
        stepInBatches(fine, 2000, 10);
        stepInBatches(coarse, 2000, 250);
        expect(fine.stepCalls).toBe(200);
        expect(coarse.stepCalls).toBe(8);
        expect(fine.ticksStepped).toBe(coarse.ticksStepped);
    });

    it('overshoots an unpredictable boundary by no more than paced play does', () => {
        // The bound that licenses PUMP_BATCH_TICKS === MAX_TICKS_PER_CALLBACK.
        // The budget clamp lands exactly on the TIMER boundary, but a plan
        // running dry (`shouldRestart`) cannot be predicted from outside, so
        // that crossing restarts in-tick and the batch remainder lands in the
        // next run. Same overshoot paced play has; same ceiling on it.
        const PACED_CAP = 100;
        for (const planLength of [37, 137, 250]) {
            const engine = createFakeEngine({ planLength, timeNeeded: 5000 });
            const { reason } = runPump(engine, { maxBatch: PACED_CAP });
            // The pump YIELDED on the run end rather than grinding on…
            expect(reason).toBe('runEnd');
            expect(engine.totals.loops).toBeGreaterThanOrEqual(1);
            // …and the ticks carried past the last boundary crossed — the
            // overshoot itself — are bounded by the batch, which IS the paced
            // per-callback cap. A plan shorter than one batch (37) crosses
            // more than one boundary inside it; so does a paced catch-up
            // callback in a throttled tab, which is the point of the bound.
            expect(engine.ticksThisLoop).toBeLessThan(PACED_CAP);
        }
    });
});
