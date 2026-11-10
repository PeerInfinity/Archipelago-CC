/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE L40-FLIP-BUILD — THE L40 FLIP SET, NAMED ONCE.
 *
 * The switches this flip turns ON by default (`CC/docs/cloud-reports/seedling-hammer-l40-flip-build.md` § I), each
 * still opting out by its own `SEEDLING_<NAME>=0`. `withL40Flip(enabled, fn)` sets every one of them to `enabled` for
 * the duration of `fn` and restores each — the one way a row that witnesses the pre-flip defaults (a BEFORE pin)
 * names the set it was recorded without, instead of listing twelve `with…` wrappers.
 *
 * ⛔ Not a switch of its own: nothing in the solver reads this module. `OPP_PRESS_FALLBACK` (the flip's one new piece
 * of code) is not in the set — it is inert while `OPPORTUNISTIC_STRIKE` is off.
 */
import {
    APPROACH_DOOR, BOMB_PHASE_WAIT, CHASER_STAGED_HUNT, CHOOSER_CUT, CLEARTAG_CHAIN, DETOUR_VIA_BOUND, KEYLOCK_TURRET,
    LATCH_WEIGH_FIRST, STANCE_BURN, TURRET_APPROACH,
} from './solverBot.js';
import { OPPORTUNISTIC_STRIKE } from './pressKillCost.js';
import { STAGED_HUNT_SCAN_MEMO } from './stagedHuntScanMemo.js';

/** The flip's switches, by their env names (each `SEEDLING_<key>`), in the order the report lists them. */
export const L40_FLIP_SWITCHES = Object.freeze({
    STAGED_HUNT_SCAN_MEMO, CHASER_STAGED_HUNT, OPPORTUNISTIC_STRIKE, CLEARTAG_CHAIN, STANCE_BURN, CHOOSER_CUT,
    DETOUR_VIA_BOUND, KEYLOCK_TURRET, LATCH_WEIGH_FIRST, TURRET_APPROACH, APPROACH_DOOR, BOMB_PHASE_WAIT,
});

/** Run `fn` with every switch of the flip set at `enabled`, restoring each one's previous value (sync or async). */
export function withL40Flip(enabled, fn) {
    const was = Object.entries(L40_FLIP_SWITCHES).map(([k, sw]) => [k, sw.enabled]);
    for (const sw of Object.values(L40_FLIP_SWITCHES)) sw.enabled = enabled === true;
    const restore = () => { for (const [k, v] of was) L40_FLIP_SWITCHES[k].enabled = v; };
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
