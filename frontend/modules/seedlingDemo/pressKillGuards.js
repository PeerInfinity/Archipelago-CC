/**
 * ⛓⛓ SEEDLING HAMMER-PHASE LB (HX) — TWO GUARDS ON THE PRESS KILL, EACH BEHIND ITS OWN SWITCH, BOTH OFF.
 *
 * Fidelity's L40CONTACT D4 handed the hammer arc two ways the press kill (`execKillByPress`) leaves a solve by
 * something other than an answer, both measured on leg 414's atlas boot (`d4/boot-414.json`, ghost sword, the chest):
 *
 * 1. **`PRESS_KILL_SHAKE_GUARD` — the strike preview inside the camera's shake band (HO1).** A player death reboots
 *    the room with the killing hit's shake carried into the settle (`rebootShake`), and while the camera is a BAND
 *    the chaser forecast cannot say whether a body near the screen edge is on screen, so `onScreenAt` THROWS by
 *    design (⚖ the band stays: the jiggle's value is cosmetic RNG and is never modelled). `deriveStrike`'s preview
 *    of a candidate's walk (`walkTo` → `previewWalk`) met that throw at t2439 and nothing caught it: the solve
 *    escaped as a crash. ON, that preview's throw — and only that throw, recognised by `isShakeBandThrow` — makes
 *    the CANDIDATE refused by name (its walk reads as truncated, so every pass and the continuation skip it), and
 *    the press kill does what it does with no strike: a refuge wait, which re-derives on the next tick. So the
 *    refusal of the candidate IS the wait: the kill waits the band out one tick at a time.
 *
 * 2. **`PRESS_KILL_REBOOT_GUARD` — the schedule across a room reboot (HO2).** A death reboots the room: every body
 *    is rebuilt (the target's hits with it) and the player respawns at the arrival. The press kill ignored that and
 *    kept its schedule: with `chaserSpinnerWalls` ON, 414 died 9 times to `bob@736,752` (one landing per life) until
 *    the 11,418-tick bound threw `STRIKE_BOUND_EXHAUSTED`. ON, the first death inside the kill refuses it by name
 *    (`SolverRefusal`, `obstacle.kind: 'danger'`, the killing source), on the tick of the death.
 *
 * ⛔ NEITHER CHANGES ANYTHING OFF: the shake guard's catch rethrows every error when OFF, and the reboot guard reads
 * a ledger length and compares it, deciding nothing. No budget, deadline site, `shouldStop` or work unit is touched.
 * `SEEDLING_PRESS_KILL_SHAKE_GUARD=1` / `SEEDLING_PRESS_KILL_REBOOT_GUARD=1` opt a process in.
 */

export const PRESS_KILL_SHAKE_GUARD = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_KILL_SHAKE_GUARD === '1',
};
export const PRESS_KILL_SHAKE_GUARD_DEFAULT = false;

export const PRESS_KILL_REBOOT_GUARD = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_KILL_REBOOT_GUARD === '1',
};
export const PRESS_KILL_REBOOT_GUARD_DEFAULT = false;

/** What the guards did in this process (measurement only; nothing reads it back). */
export const PRESS_KILL_GUARD_COUNTS = { shakeRefused: 0, rebootRefused: 0 };

/**
 * The chaser forecast's shake-band throw (`levelRun.js` `chaserForecast`'s `onScreenAt`), and nothing else. A plain
 * `Error` (fidelity's file gives it no class or code), so it is recognised by its own first words. ⚠ Narrow on
 * purpose: the LIVE run's own band throw (`levelRun: whether … is on screen at tick …`) is not a preview's question
 * and is never caught here.
 */
export function isShakeBandThrow(e) {
    return e instanceof Error && e.constructor === Error
        && /^chaserForecast: whether .+ is on screen depends on where inside `Game\.shake`'s jiggle the camera landed/
            .test(e.message);
}

function withSwitch(sw, enabled, fn) {
    const was = sw.enabled;
    sw.enabled = enabled === true;
    const restore = () => { sw.enabled = was; };
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

/** Run `fn` with `PRESS_KILL_SHAKE_GUARD` set to `enabled`, restoring the previous value. */
export const withPressKillShakeGuard = (enabled, fn) => withSwitch(PRESS_KILL_SHAKE_GUARD, enabled, fn);
/** Run `fn` with `PRESS_KILL_REBOOT_GUARD` set to `enabled`, restoring the previous value. */
export const withPressKillRebootGuard = (enabled, fn) => withSwitch(PRESS_KILL_REBOOT_GUARD, enabled, fn);
