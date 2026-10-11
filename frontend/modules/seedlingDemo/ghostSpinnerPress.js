/**
 * ghostSpinnerPress — ⛓⛓⛓ SEEDLING HAMMER-PHASE C2: THE GHOST SWORD'S PRESS, AS THE SPINNER FORECASTS AND THE STRIKE
 * ASK IT.
 *
 * The run has modelled the ghost press since fidelity GHOSTSWORD (`levelRun.applyThrust`'s ghost arm: the 24 x 48 rect,
 * reach 24, the line of sight waived for every target, `genericHit(…, "Spear", 5, 2)`, seven tests a swing and six a
 * dash) and its release since GHOSTMOTION (`ghostSword.slashEndTicksFor`: 7 / 6). The hammer arc's two forecasts and its
 * strike did not:
 *   · `levelRun.spinnerForecastWithPress` and `spinnerFightForecast` fired a forecast test only for a `sword` thrust, so a
 *     ghost press forecast NO landing (measured, C2 W0: 0 of the witness's 2), and the fight cursor released a ghost
 *     swing on the sword's clock (`SLASH_ANIM_TICKS`);
 *   · `solverBot.derivePressKill` refused any primary but the sword ("fires `ghostsword`"), and `deriveStrike`,
 *     `pressReadyAt` and the train previews are the SWORD's geometry (16 × 32, reach 16, the line, five tests).
 *
 * This module is the switch and the one per-weapon table both sides read; every number is `ghostSword.js`'s or
 * `presses.js`'s, imported (fidelity owns the model; nothing here restates it).
 *
 * ⛓ THE SWITCH — `GHOST_SPINNER_PRESS`, OFF by default (`SEEDLING_GHOST_SPINNER_PRESS=1` for a process, or
 * `withGhostSpinnerPress(true, fn)`). OFF, every reader takes the sword's row exactly as before (byte-inert); ON, a
 * `ghostsword` primary takes the ghost's.
 */

import { SLASH_HIT_TICKS, SLASH_REACH, slashRect } from './presses.js';
import { GHOST_SLASH_ANIM_TICKS, GHOST_SWORD_REACH, ghostSlashRect } from './ghostSword.js';

export const GHOST_SPINNER_PRESS = {
    enabled: globalThis.process?.env?.SEEDLING_GHOST_SPINNER_PRESS === '1',
};
export const GHOST_SPINNER_PRESS_DEFAULT = false;

/** Run `fn` with `GHOST_SPINNER_PRESS` set to `enabled`, restoring the previous value (`withStaticSwordArm`'s shape). */
export function withGhostSpinnerPress(enabled, fn) {
    const was = GHOST_SPINNER_PRESS.enabled;
    GHOST_SPINNER_PRESS.enabled = enabled === true;
    const restore = () => { GHOST_SPINNER_PRESS.enabled = was; };
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

/** True when a press by `weapon` is forecast and struck as the ghost sword's (the switch ON and the weapon the ghost). */
export function ghostSpinnerPressFor(weapon) {
    return GHOST_SPINNER_PRESS.enabled && weapon === 'ghostsword';
}

/**
 * The strike's plain press (a swing, not a dash: the kill presses outside the dash window) against a spinner, per
 * weapon: `rect(x, y, direction)`, the `distanceRectPoint` gate `reach`, whether `slash()` asks the Solid line
 * (`lineOfSight`), and the hit tests one press buys (`hitTicks`).
 */
export const SWORD_SPINNER_PRESS = Object.freeze({
    weapon: 'sword', reach: SLASH_REACH, rect: (x, y, direction) => slashRect(x, y, direction), lineOfSight: true,
    hitTicks: SLASH_HIT_TICKS,
});
export const GHOST_SPINNER_PRESS_ROW = Object.freeze({
    weapon: 'ghostsword', reach: GHOST_SWORD_REACH, rect: ghostSlashRect, lineOfSight: false,
    hitTicks: GHOST_SLASH_ANIM_TICKS.slash,
});

/** The row a press by `weapon` reads: the ghost's under the switch, else the sword's (OFF: always the sword's). */
export function spinnerStrikePress(weapon) {
    return ghostSpinnerPressFor(weapon) ? GHOST_SPINNER_PRESS_ROW : SWORD_SPINNER_PRESS;
}
