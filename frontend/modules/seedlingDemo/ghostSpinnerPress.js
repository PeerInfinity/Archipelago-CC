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
 * ⛓ THE SWITCH — `GHOST_SPINNER_PRESS`, ON by default since ⚖ the user's flip (2026-10-11, "Turn it ON"); OFF is the
 * control (`SEEDLING_GHOST_SPINNER_PRESS=0` for a process, or `withGhostSpinnerPress(false, fn)`). OFF, every reader takes the sword's row exactly as before (byte-inert); ON, a
 * `ghostsword` primary takes the ghost's.
 */

import { SLASH_HIT_TICKS, SLASH_REACH, slashRect } from './presses.js';
import { GHOST_SLASH_ANIM_TICKS, GHOST_SWORD_REACH, ghostSlashRect } from './ghostSword.js';

export const GHOST_SPINNER_PRESS = {
    enabled: globalThis.process?.env?.SEEDLING_GHOST_SPINNER_PRESS !== '0',
};
export const GHOST_SPINNER_PRESS_DEFAULT = true;

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

/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE D (D3) — **THE APPROACH AND THE FIGHT SCORE WITH THE PRESS'S OWN ROW** (`GHOST_SEARCH_BUCKETS`,
 * OFF by default: `SEEDLING_GHOST_SEARCH_BUCKETS=1` for a process, or `withGhostSearchBuckets(true, fn)`).
 *
 * C2 handed `pressReadyAt` the run's row, so both searches ASK the ghost's predicate at a goal or a press — but their
 * own arithmetic around it stayed the sword's: `deriveFight` pre-filters a press successor at `SLASH_REACH` (16) and
 * `SLASH_HIT_TICKS` (5) before `pressReadyAt` is asked, buckets the press window at 5 and lower-bounds the gap at 16;
 * `deriveApproach` sizes its hit-aware probe and its goal's row margin at 5. Under the switch they read the row
 * `strikePressOf(run)` gives (`searchPressFor`): the ghost's reach 24 and seven tests for a ghost primary, the sword's
 * row — the very constants — for everything else. Measured (D3): C2's L18 staging with the ghost and `HAMMER_FIGHT` ON
 * presses from the 16–24 px band only with the switch, 324 t → 321 t; `HAMMER_APPROACH` is unchanged (325 t).
 *
 * OFF, `searchPressFor` returns the sword's row whatever it is handed: every number either search reads is the constant
 * it read before (byte-inert). ON, a sword run reads the sword's row too, so only a ghost run can move.
 */
export const GHOST_SEARCH_BUCKETS = {
    enabled: globalThis.process?.env?.SEEDLING_GHOST_SEARCH_BUCKETS === '1',
};
export const GHOST_SEARCH_BUCKETS_DEFAULT = false;

/** Run `fn` with `GHOST_SEARCH_BUCKETS` set to `enabled`, restoring the previous value (`withGhostSpinnerPress`'s shape). */
export function withGhostSearchBuckets(enabled, fn) {
    const was = GHOST_SEARCH_BUCKETS.enabled;
    GHOST_SEARCH_BUCKETS.enabled = enabled === true;
    const restore = () => { GHOST_SEARCH_BUCKETS.enabled = was; };
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

/** The row `deriveApproach` / `deriveFight` score with: the press's own under the switch, the sword's OFF. */
export function searchPressFor(press) {
    return GHOST_SEARCH_BUCKETS.enabled ? press : SWORD_SPINNER_PRESS;
}

/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE G1 — **THE KILL RUNG ASKS THE PRESS KILL FOR THE GHOST TOO** (`GHOST_KILL_RUNG`, ON by
 * default since the user's flip; `SEEDLING_GHOST_KILL_RUNG=0` opts a process out, or `withGhostKillRung(false, fn)`).
 *
 * C2 admitted a `ghostsword` primary inside `derivePressKill` (the kill-lock order), but the combat ladder's KILL rung,
 * in its lock-less spinner arm, asked `derivePressKill` only for `weapon === 'sword'` and refused every other primary by
 * name ("the kill this rung derives is a SWORD press"). So a ghost run never reached the press kill from the ladder
 * (measured, hammer-phase D: L40 legs 378 / 381 REFUSED at that gate, 397 / 414 and C1's staging A in 1–3 s).
 *
 * `killRungPresses(weapon)` is the rung's question. OFF it is `weapon === 'sword'`, exactly the gate it replaces
 * (byte-inert). ON it also admits a weapon whose press `derivePressKill` itself admits — `spinnerStrikePress(weapon)`
 * is not the sword's row, i.e. a `ghostsword` primary under `GHOST_SPINNER_PRESS`. A ghost sword without the sword is
 * then refused inside `derivePressKill` by `ghostSwingRefusal`'s words; every other primary keeps the rung's refusal.
 */
export const GHOST_KILL_RUNG = {
    enabled: globalThis.process?.env?.SEEDLING_GHOST_KILL_RUNG !== '0',
};
export const GHOST_KILL_RUNG_DEFAULT = true;

/** Run `fn` with `GHOST_KILL_RUNG` set to `enabled`, restoring the previous value (`withGhostSpinnerPress`'s shape). */
export function withGhostKillRung(enabled, fn) {
    const was = GHOST_KILL_RUNG.enabled;
    GHOST_KILL_RUNG.enabled = enabled === true;
    const restore = () => { GHOST_KILL_RUNG.enabled = was; };
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

/** True when the lock-less kill rung asks `derivePressKill` for `weapon`: the sword; ON, also the ghost's press. */
export function killRungPresses(weapon) {
    return weapon === 'sword' || (GHOST_KILL_RUNG.enabled && spinnerStrikePress(weapon) !== SWORD_SPINNER_PRESS);
}
