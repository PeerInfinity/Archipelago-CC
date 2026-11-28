/**
 * spearPressGateWait — ⛓⛓⛓ SEEDLING HAMMER-PHASE ENTRY-38 SHOVE: A SPEAR THRUST WAITS OUT THE GATE THAT WOULD
 * SWALLOW IT (`SPEAR_PRESS_GATE_WAIT`, OFF).
 *
 * ⚖ The user approved the slice on 2026-11-27 (*"Entry-38 shove slice (Recommended)"*): past whole-game entry 37 the
 * L63 → L61 exit refused in its full pass, `… shove (route step 1/4: press): 56 ticks after the thrust (tick 301)
 * pushableblockspear@112,96 is at (112,96), not settled on (6,6).`
 *
 * MEASURED (`CC/docs/cloud-reports/seedling-hammer-entry38-shove.md` §3): the thrust is pressed, and the model swallows
 * it. The walk to the thrust stance ran with the WAND selected, and its strike policy pressed `primary` at tick 294: a
 * WandShot, whose window (`_wanding`) is up through tick 301. `execSpearPress` waits out the walk's coast, the face
 * tap and a freeze, and then presses on tick 301, the window's own end tick. `set spearing`'s gate (`Player.as:815`,
 * `if (hasSpear && !wanding && !firing && !deathRaying && !slashing) { if (!spearing && _s) … }`, transcribed by
 * fidelity DARKTRAP2 D2 behind `CONTACT_FIDELITY.spearingWindow`, ON) reads `wanding` above `sprites()`'s `wandEnd`,
 * so the press starts nothing: no thrust, no glide, and 56 idle ticks later the block has not moved. The model is right
 * (the game swallows the press the same way); the verb's timing is what misses.
 *
 * ON: after the freeze wait and before the reach re-ask, the verb reads the run's own `slashInfo` (the progress field
 * every press forecast reads) and, while its gate says the press would be swallowed — `wanding`, `firing`, `spearing`
 * or the swing's own `slashing` — steps one idle tick, up to `SPEAR_PRESS_GATE_BOUND`. A gate still up after that
 * refuses by name. Idle ticks are ordinary ticks of the run (the glide wait already spends 56 of them), so every hit
 * they take is billed by the run like any other; nothing here certifies a tick hitless.
 *
 * ⛓ THE THREAD: read inside `execSpearPress` (solverBot, the `press` route step), i.e. the page's SOLVE WORKER and
 * node; no main-thread mapper reads it, so the worker's env channel (`?seedlingSolverEnv=SEEDLING_SPEAR_PRESS_GATE_WAIT=1`)
 * is the whole page wiring. `withSpearPressGateWait(enabled, fn)` for a row or a witness. OFF nothing here is read.
 *
 * ⚖ No single-game constant: the rule reads the run's own gate; the bound is the longest window a gate can hold
 * (a WandShot's, the longest of the four), plus slack, as data.
 */

export const SPEAR_PRESS_GATE_WAIT = {
    enabled: globalThis.process?.env?.SEEDLING_SPEAR_PRESS_GATE_WAIT === '1',
};
export const SPEAR_PRESS_GATE_WAIT_DEFAULT = false;

/** The most idle ticks the verb waits for the gate to drop before it refuses by name. */
export const SPEAR_PRESS_GATE_BOUND = 60;

/**
 * The instrument (ON only): `asked` the presses that read the gate, `waited` the last 64 that waited
 * (`{t, ticks, gates}`: the run tick the wait began, the idle ticks spent, the gate names that were up), `refused` the
 * presses whose gate outlived the bound. Nothing reads it but rows and probes.
 */
export const SPEAR_PRESS_GATE_WAIT_COUNTS = { asked: 0, waited: [], refused: 0 };

export function resetSpearPressGateWaitCounts() {
    SPEAR_PRESS_GATE_WAIT_COUNTS.asked = 0;
    SPEAR_PRESS_GATE_WAIT_COUNTS.waited.length = 0;
    SPEAR_PRESS_GATE_WAIT_COUNTS.refused = 0;
}

/** Run `fn` with `SPEAR_PRESS_GATE_WAIT` set to `enabled`, restoring the previous value (`withWalkBladeArm`'s shape). */
export function withSpearPressGateWait(enabled, fn) {
    const was = SPEAR_PRESS_GATE_WAIT.enabled;
    SPEAR_PRESS_GATE_WAIT.enabled = enabled === true;
    const restore = () => { SPEAR_PRESS_GATE_WAIT.enabled = was; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (e) {
        restore();
        throw e;
    }
}

/**
 * The gate names that would swallow a spear press on the run's next tick (pure), from a `slashInfo` value
 * (`{state: {slashing}, gate: {wanding, firing, spearing}}`): `[]` when the press would start a thrust. A missing
 * field reads as down, so a run without the field never waits.
 */
export function spearPressGates(slashInfo) {
    const gate = slashInfo?.gate ?? {};
    const out = [];
    if (gate.wanding === true) out.push('wanding');
    if (gate.firing === true) out.push('firing');
    if (gate.spearing === true) out.push('spearing');
    if (slashInfo?.state?.slashing === true) out.push('slashing');
    return out;
}

/**
 * Wait out the gate (ON only; the caller asks only with the switch on). `readInfo()` is the run's `slashInfo` now,
 * `idle()` steps one idle tick, `refuse(why)` throws. Returns the idle ticks spent.
 */
export function waitSpearPressGate({ readInfo, idle, refuse, tick }) {
    SPEAR_PRESS_GATE_WAIT_COUNTS.asked += 1;
    const first = spearPressGates(readInfo());
    if (first.length === 0) return 0;
    const t = tick();
    let n = 0;
    for (let gates = first; gates.length > 0; gates = spearPressGates(readInfo())) {
        if (n >= SPEAR_PRESS_GATE_BOUND) {
            SPEAR_PRESS_GATE_WAIT_COUNTS.refused += 1;
            refuse(`the spear press is still gated (${gates.join(', ')}) ${n} idle ticks after tick ${t} — `
                + '`set spearing` (`Player.as:815`) would swallow it.');
        }
        idle();
        n += 1;
    }
    SPEAR_PRESS_GATE_WAIT_COUNTS.waited.push({ t, ticks: n, gates: first });
    if (SPEAR_PRESS_GATE_WAIT_COUNTS.waited.length > 64) SPEAR_PRESS_GATE_WAIT_COUNTS.waited.shift();
    return n;
}
