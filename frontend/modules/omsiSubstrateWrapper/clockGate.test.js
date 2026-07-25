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
import { isBoundaryHeld, planClockStep } from './clockGate.js';

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
