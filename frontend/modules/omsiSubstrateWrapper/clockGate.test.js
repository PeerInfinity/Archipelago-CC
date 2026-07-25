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

/** A minimal stand-in for the fork's driver.js loop clock. */
function createFakeEngine({ heldFromLoop = null } = {}) {
    const engine = {
        timer: 0,
        timeNeeded: TIME_NEEDED,
        effectiveTime: 0,
        totals: { loops: 0, effectiveTime: 0 },
        stepCalls: 0,
        ticksStepped: 0,
        /** True once the boundary is being held rather than restarted. */
        holding: false,
        getFullState() {
            return { timer: this.timer, timeNeeded: this.timeNeeded };
        },
        step(n) {
            this.stepCalls += 1;
            for (let i = 0; i < n; i++) this.singleTick();
            this.ticksStepped += n;
        },
        singleTick() {
            this.timer += 1;
            this.effectiveTime += 1 / TICKS_PER_SECOND;
            if (this.timer >= this.timeNeeded) {
                // loopEnd(): banks whatever effectiveTime has accumulated
                this.totals.loops += 1;
                this.totals.effectiveTime += this.effectiveTime;
                // prepareRestart(): restart() unless something holds it
                const holdNow = heldFromLoop !== null && this.totals.loops >= heldFromLoop;
                if (holdNow) {
                    this.holding = true;      // timer stays >= timeNeeded
                } else {
                    this.timer = 0;
                    this.effectiveTime = 0;
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
            state: engine.getFullState(),
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

    it('never freezes on an unreadable clock', () => {
        // A fork build that stopped reporting the pair must degrade to the
        // pre-D2 behaviour, not to a dead substrate.
        expect(isBoundaryHeld(null)).toBe(false);
        expect(isBoundaryHeld(undefined)).toBe(false);
        expect(isBoundaryHeld({})).toBe(false);
        expect(isBoundaryHeld({ timer: NaN, timeNeeded: 250 })).toBe(false);
        expect(isBoundaryHeld({ timer: 250, timeNeeded: undefined })).toBe(false);
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
