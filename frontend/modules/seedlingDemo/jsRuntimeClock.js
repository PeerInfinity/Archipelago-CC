/**
 * seedlingDemo/jsRuntimeClock — ⛓ GAME SPEED (slice `seedling-js-game-speed`, ⚖ the user 2026-10-24/26): the JS
 * runtime page's CLOCK, DOM-free. The page's clock decides WHEN a slot runs; the model decides WHAT a tick does
 * (watchManual's "THE LOOP QUESTION"). A SLOT is one tick of the game's clock: either a run tick or, with a graphics
 * stack, one held dead frame of a load fade (`jsRuntimePage.advance`, G4/G7).
 *
 *  · SPEED is slots per wall-clock second: 30 × 1 | 2 | 4 (`GAME_SPEEDS`). It is PRESENTATION ONLY: the run is the
 *    same tick sequence at every speed, shown faster. The fades are dead-frame slots, so they scale with it for free.
 *  · The accumulator is the page's old one (G1–G8: `TICK_MS`, `MAX_TICKS_PER_FRAME` 5), with both scaled by the speed,
 *    so a long stall still skips the same WALL-CLOCK window (5 / 30 s) instead of replaying it. At 1× it does the
 *    same float arithmetic, in the same order, as the old loop.
 *  · ⛓ ONE SLOT PER EVENT-LOOP TURN (`createSlotPump`). The host answers the page's reports (a check, an exit, a
 *    level) on its own turn: an `onStateChanged` handler that defers through a promise chain or the event bus lands
 *    its `queueItems` / walk verb in a MICROTASK. At 1× on a 60 Hz display a slot is due every other frame, so that
 *    answer is always drained by the very next slot. At 2×/4× two slots are due in one frame, and running both inside
 *    the frame callback would drain the answer a tick LATER than at 1× — the run would see a different tick
 *    sequence at a different speed. The pump therefore runs the frame's first slot in the frame callback and each
 *    further one in its own posted task (a `MessageChannel` message on the page), so the host's microtasks run
 *    between ANY two slots at every speed. ⚠ It cannot make a WALL-CLOCK host tick-exact: the adapter's 100 ms push
 *    (`WasmBridgeAdapter.PUSH_INTERVAL_MS`) lands on a wall-clock-dependent tick at 1× as well, run to run. The panel
 *    scales that interval by the speed, so its latency in TICKS is the same at every speed.
 */

/** The speeds the page offers: slots per second = `BASE_TICKS_PER_SECOND` × speed. */
export const GAME_SPEEDS = Object.freeze([1, 2, 4]);
/** The game's own clock (`FP.frameRate` 30): the slots per second at 1×. */
export const BASE_TICKS_PER_SECOND = 30;
/** At 1×, at most this many slots per frame — a long stall is skipped, not replayed. Scaled by the speed. */
export const BASE_MAX_SLOTS_PER_FRAME = 5;

/**
 * A speed as the page reads it (`?speed=`, the panel's `1x` / `2x` / `4x`, or a number). Absent = 1. Anything else
 * REFUSES by name: a mistyped speed is not silently 1×.
 */
export function parseGameSpeed(value, where = '?speed=') {
    if (value === null || value === undefined || value === '') return 1;
    const n = Number(String(value).trim().replace(/[x×]$/i, ''));
    if (!GAME_SPEEDS.includes(n)) throw new Error(`${where}${value}: one of ${GAME_SPEEDS.join(' | ')}`);
    return n;
}

/**
 * The accumulator. `due(now)` adds the wall-clock time since the last call (capped at `maxSlots` slots' worth) and
 * returns how many slots are due now (at most `maxSlots`). `setSpeed` keeps the PHASE of the slot in progress.
 */
export function createSlotClock({ speed = 1 } = {}) {
    let s = parseGameSpeed(speed);
    let tickMs = 1000 / (BASE_TICKS_PER_SECOND * s);
    let maxSlots = BASE_MAX_SLOTS_PER_FRAME * s;
    let last = null;
    let acc = 0;
    return {
        get speed() { return s; },
        get tickMs() { return tickMs; },
        get maxSlots() { return maxSlots; },
        due(now) {
            if (last === null) last = now;
            acc += Math.min(now - last, tickMs * maxSlots);
            last = now;
            let n = 0;
            while (acc >= tickMs && n < maxSlots) {
                acc -= tickMs;
                n += 1;
            }
            return n;
        },
        setSpeed(value) {
            const next = parseGameSpeed(value);
            if (next === s) return s;
            acc *= s / next;
            s = next;
            tickMs = 1000 / (BASE_TICKS_PER_SECOND * s);
            maxSlots = BASE_MAX_SLOTS_PER_FRAME * s;
            return s;
        },
    };
}

/**
 * ⛓ The pump: `frame(now)` (the page's animation frame, or its hidden-frame timer) asks the clock what is due, runs
 * ONE slot, and posts a task for the next; each task runs one slot and posts the next while slots are owed. Owed
 * slots never exceed the clock's `maxSlots` (a page too busy to keep up drops time, as the cap always did; it never
 * drops a tick — a slot is either run or never owed). `postTask(fn)` must run `fn` on a later event-loop turn.
 */
export function createSlotPump({ clock, runSlot, postTask }) {
    let owed = 0;
    let posted = false;
    let slots = 0;
    const step = () => {
        if (owed <= 0) return;
        owed -= 1;
        slots += 1;
        runSlot();
    };
    const post = () => {
        if (posted || owed <= 0) return;
        posted = true;
        postTask(task);
    };
    function task() {
        posted = false;
        try { step(); } finally { post(); }
    }
    return {
        frame(now) {
            owed = Math.min(owed + clock.due(now), clock.maxSlots);
            try { step(); } finally { post(); }
        },
        /** Slots due but not yet run (a posted task will run the next). */
        get owed() { return owed; },
        /** Slots run since the pump was made. */
        get slots() { return slots; },
    };
}

/** The page's `postTask`: a `MessageChannel` message (no timer clamp, no background-tab timer throttling). */
export function messageChannelPostTask(win) {
    const MC = win.MessageChannel;
    if (typeof MC !== 'function') return (fn) => win.setTimeout(fn, 0);
    const channel = new MC();
    let next = null;
    channel.port1.onmessage = () => {
        const fn = next;
        next = null;
        fn?.();
    };
    return (fn) => {
        next = fn;
        channel.port2.postMessage(0);
    };
}

/**
 * The achieved rate: `sample(now, slots, ticks)` once per frame; `rate` = slots and run ticks per second over the
 * last `windowMs` (a readout for the measurement, never an input to the clock).
 */
export function createRateMeter({ windowMs = 1000 } = {}) {
    const samples = [];
    return {
        sample(now, slots, ticks) {
            samples.push([now, slots, ticks]);
            while (samples.length > 2 && now - samples[1][0] >= windowMs) samples.shift();
        },
        get rate() {
            if (samples.length < 2) return { slots: 0, ticks: 0, overMs: 0 };
            const [t0, s0, k0] = samples[0];
            const [t1, s1, k1] = samples[samples.length - 1];
            const dt = t1 - t0;
            if (dt <= 0) return { slots: 0, ticks: 0, overMs: 0 };
            return { slots: ((s1 - s0) * 1000) / dt, ticks: ((k1 - k0) * 1000) / dt, overMs: dt };
        },
    };
}
