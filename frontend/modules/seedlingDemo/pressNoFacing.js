/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SLASHRECT — A PRESS ON A TICK THAT STARTS WITH NO FACING.
 *
 * **The game.** `Player.update` runs `slash()` (it latches `slashDirection = direction`), then `super.update()`, then
 * `sprites()` (the facing from `directionFace`, else from `v`), then `hitUpdate()` (`Player.as:562-578`). On the tick
 * the i-frames run out, `hitUpdate` writes `direction = directionFace; directionFace = -1` (`Player.as:1424`) AFTER
 * `sprites()` ran. A hit that parked no facing (`Player.hit(null, …)`: lava, every projectile and trap; only
 * `knockback` parks one) leaves `directionFace` at -1, so that tick ENDS with `direction = -1`, and a press on the
 * NEXT tick latches `slashDirection = -1`. `getSlashRect`'s `default:` arm then returns an all-zero `Rectangle`: a
 * swing at the world origin, a whiff. `playerDamage.hitUpdate` transcribes this exactly (`direction:
 * s.directionFace`), so the run and its previews carry the -1 too.
 *
 * **The defect.** No model has that `default:` arm (`presses.slashRect` / `combatVerbs.slashRect` THROW on it, by
 * design). The press kill's escape check (`pressEscapeOnce`) aims on tick T and asks the forecast about a press on
 * T+1 at the facing its preview of T left; on the recovery tick that facing is -1, and the forecast's own sword test
 * threw `PressError: slashRect: direction -1 is not 0..3`. Nothing classifies a `PressError`, so the solve CRASHED and
 * a generated level ABORTED (the lab's caldera counterfactual, seed 7: `caldera` items and terrain without its melt
 * `floodWalks`, `empty`, 8 obstacles; the player stood in lava while aiming).
 *
 * **Two parts.**
 *
 * 1. **ALWAYS ON — the throw becomes a refusal by name.** Where a press preview with no facing THROWS the
 *    `PressError` / `CombatVerbError` of a slash or spear rect, `refuseNoFacing` rethrows it as a `SolverRefusal`
 *    whose `bound` is `PRESS_NO_FACING`. A solve that did not throw is untouched (the catch fires only on that throw,
 *    and only when the facing is not 0..3), so this is byte-identical on every workload that did not crash.
 *
 * 2. **`PRESS_NO_FACING` (OFF) — the press is not planned on that tick.** The honest fix of the facing: the aim
 *    cannot make the press tick's facing a facing (`hitUpdate` runs after `sprites`), so a press there is a whiff the
 *    model cannot price. ON, `pressEscapeOnce` returns a CLAIMED negative (`bound: 'no-facing'`) before forecasting,
 *    `execKillByPress`'s aim admission does not aim into it (no fallback admits it), the live press tick re-aims
 *    instead of pressing at -1, and the fight search's press macro is not offered from a node whose aim tick ends
 *    facing -1. One tick later `directionFace` is -1 and `sprites()` takes the facing from `v` again.
 *
 * `SEEDLING_PRESS_NO_FACING=1` turns part 2 ON in a node process (the page's worker reads it through
 * `?seedlingSolverEnv=`); `withPressNoFacing(true, fn)` for a test or a witness.
 */

import { CombatVerbError, PressError } from './solverView.js';

export const PRESS_NO_FACING = { enabled: globalThis.process?.env?.SEEDLING_PRESS_NO_FACING === '1' };
export const PRESS_NO_FACING_DEFAULT = false;

/** The refusal's name (`SolverRefusal.bound`, and the claimed negative's `bound` under the switch). */
export const PRESS_NO_FACING_BOUND = 'PRESS_NO_FACING';

/** What the guard did in this process (measurement only; nothing reads it back). */
export const PRESS_NO_FACING_COUNTS = { refused: 0, escapeDeclined: 0, aimDeclined: 0, pressDeferred: 0,
    fightDeclined: 0 };

export function resetPressNoFacingCounts() {
    for (const k of Object.keys(PRESS_NO_FACING_COUNTS)) PRESS_NO_FACING_COUNTS[k] = 0;
}

/** One of `Player.direction`'s four values (RIGHT 0, UP 1, LEFT 2, DOWN 3). -1, a fraction or `undefined` is not. */
export const isFacing = (d) => d === 0 || d === 1 || d === 2 || d === 3;

/** The sentence, one spelling for the refusal and the switch's negative. */
export function noFacingWhy({ direction, pressAt, caller }) {
    return `the press at t${pressAt} (${caller}) starts with facing ${direction}, not 0..3: \`hitUpdate\` ended the `
        + 'previous tick\'s i-frames with `direction = directionFace` = -1 (`Player.as:1424`, after `sprites()`), so '
        + 'the game latches `slashDirection = -1` and `getSlashRect`\'s default arm swings an all-zero rect at the '
        + 'world origin. No model has that arm';
}

/** The `SolverRefusal` a no-facing press throws (the class is passed in: `solverBot.js` owns it). */
export function noFacingRefusal(SolverRefusal, { direction, pressAt, caller, id = null, cause = null }) {
    const e = new SolverRefusal(`${PRESS_NO_FACING_BOUND}: ${noFacingWhy({ direction, pressAt, caller })}`
        + `${id ? ` (body ${id})` : ''}${cause ? `; the preview said: ${cause.message}` : ''}`,
    { bound: PRESS_NO_FACING_BOUND });
    e.code = PRESS_NO_FACING_BOUND;
    return e;
}

/** A rect throw of a press preview: a `PressError` or a `CombatVerbError` (the ghost sword's rect). */
const isRectThrow = (e) => e instanceof PressError || e instanceof CombatVerbError;

/**
 * Run `fn` (a press preview); a rect throw with no facing becomes `noFacingRefusal`. Every other throw, and every
 * throw at a facing, passes through unchanged; a value passes through unchanged.
 */
export function refuseNoFacing(SolverRefusal, { direction, pressAt, caller, id = null }, fn) {
    try {
        return fn();
    } catch (e) {
        if (isFacing(direction) || !isRectThrow(e)) throw e;
        PRESS_NO_FACING_COUNTS.refused += 1;
        throw noFacingRefusal(SolverRefusal, { direction, pressAt, caller, id, cause: e });
    }
}

export function withPressNoFacing(enabled, fn) {
    const was = PRESS_NO_FACING.enabled;
    PRESS_NO_FACING.enabled = enabled === true;
    const restore = () => { PRESS_NO_FACING.enabled = was; };
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
