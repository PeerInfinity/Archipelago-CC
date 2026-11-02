/**
 * ghostRopeCut — ⛓⛓⛓ SEEDLING HAMMER-PHASE GHOSTROPE: **THE PULL RUNG CUTS A ROPE WITH THE GHOST SWORD.**
 *
 * ⚖ The user (2026-10-30): *"ghost sword replaces the sword, so the solver shouldn't attempt to switch to regular sword
 * when it has ghost sword."* So the gap is not "switch to the sword": the slot that held the sword holds the ghost
 * sword now (item 4; `levelRun.weaponForPress` → `ghostsword`), and the question is whether the PULL rung (and the
 * `rope` verb, which shares its stance) can do its job with the weapon the run actually swings.
 *
 * THE GAME (`Player.as`, witnessed headless on p4g: `ghostRopeWitness.js`, `probe-seedling-ghost-rope.mjs`): a ghost
 * swing cuts a `RopeStart`. `slash()` runs `if (hasSword)` (the endgame bag holds both flags); its rect is
 * `getSlashRect`'s ghost arm (24 along the swing, 48 across, scale 1); the reach is `distanceRectPoint <= 24`; the line
 * is waived (`|| hasGhostSword || … || type == "Rope"`); `genericHit(…, "Spear", …)` → `RopeStart.hit()`, which takes
 * no `t`. Measured: cut from 15.1 and 23.1 px ({16,0} at t3 = the model's pull t2 + 1), not from 27.1 px; the plain
 * sword does not cut from 23.1 px. The RUN already models it (`ghostSword.GHOST_PRESS_ARMS.RopeStart`, `pullRope`).
 *
 * THE SOLVER did not ask it. Three gates named only the sword:
 *   · the PULL rung: `weapon !== 'sword'` → "the pull this rung derives is a SWORD swing" (or, with
 *     `ropeCutAnyWeapon`, `resolveRopeCut` → `ropeCutWeapons`, which skips the sword while `hasGhostSword` is up
 *     and has no ghost row, so "no slot holds a Sword, Fire or Spear");
 *   · the PULL rung's later-lane probe (`primaryWeapon === 'sword'`), so a lane met second was never offered;
 *   · the `rope` verb (`resolveRopeStrategy`), the same two gates.
 * Measured at the start SHA: the lab's ENDGAME `ropegate` rooms (seeds 1-3, 10x10 `empty`) REFUSE at that rung.
 *
 * ⛓ THE SWITCH — `GHOST_ROPE_CUT`, OFF by default (`SEEDLING_GHOST_ROPE_CUT=1` for a process, or
 * `withGhostRopeCut(true, fn)`). ON, a `ghostsword` primary (with `GHOSTSWORD_PRESS` modelled and the sword's flag up,
 * `ghostSwingRefusal`) is a swing these gates admit, PRICED WITH ITS OWN PRESS (`ROPE_SWING_PRESS.ghostsword`: the
 * 24 x 48 rect, reach 24, seven tests), and a held ghost sword is the swordless cut's swing row in place of the sword's
 * (selected by `equip`, never the plain sword). OFF, every reader takes the sword's row and the old gates exactly.
 */

// ⛔ A solver-family file: every simulation symbol comes through the door (`solverView.js`).
import {
    GHOSTSWORD_PRESS, GHOST_PRESS_ARMS, GHOST_SLASH_ANIM_TICKS, GHOST_SWORD_REACH, SLASH_HIT_TICKS, SLASH_REACH,
    ghostSlashRect, ghostSwingRefusal, slashRect,
} from './solverView.js';

export const GHOST_ROPE_CUT = {
    enabled: globalThis.process?.env?.SEEDLING_GHOST_ROPE_CUT === '1',
};
export const GHOST_ROPE_CUT_DEFAULT = false;

/** Run `fn` with `GHOST_ROPE_CUT` set to `enabled`, restoring the previous value (`withGhostKillRung`'s shape). */
export function withGhostRopeCut(enabled, fn) {
    const was = GHOST_ROPE_CUT.enabled;
    GHOST_ROPE_CUT.enabled = enabled === true;
    const restore = () => { GHOST_ROPE_CUT.enabled = was; };
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
 * The swing a rope cut is priced with, per weapon: the reach gate, the rect at a facing, the hit tests a press buys.
 * Every number is `presses.js`'s or `ghostSword.js`'s, imported.
 */
export const ROPE_SWING_PRESS = Object.freeze({
    sword: Object.freeze({ weapon: 'sword', reach: SLASH_REACH, rectAt: slashRect, hitTicks: SLASH_HIT_TICKS }),
    ghostsword: Object.freeze({ weapon: 'ghostsword', reach: GHOST_SWORD_REACH,
        rectAt: (x, y, direction) => ghostSlashRect(x, y, direction), hitTicks: GHOST_SLASH_ANIM_TICKS.slash }),
});

/** Is a ghost swing one the run would actually TEST (the press modelled, and `slash()`'s `if (hasSword)`)? */
export function ghostSwingTests(inventory) {
    return GHOSTSWORD_PRESS.enabled && inventory?.hasGhostSword === true && ghostSwingRefusal(inventory) === null;
}

/**
 * The rope swing for a `primaryWeapon`: the sword's row for the sword; ON, the ghost's for a `ghostsword` primary
 * whose swing tests; else null (the old gates' "not a sword swing").
 */
export function ropeSwingFor(weapon, inventory) {
    if (weapon === 'sword') return ROPE_SWING_PRESS.sword;
    if (GHOST_ROPE_CUT.enabled && weapon === 'ghostsword' && ghostSwingTests(inventory)) {
        return ROPE_SWING_PRESS.ghostsword;
    }
    return null;
}

/**
 * The as3 classes a ghost swing's "Spear" arm must not reach on the way to a rope: a `LightPole` TOGGLES (a
 * persistence write the cut did not plan), and every arm `GHOST_PRESS_ARMS` marks `refused` (a bridge `Tile`, a
 * `PushableBlockSpear`) is one the run THROWS on for a ghost swing. The sword's "Sword" arm reaches none of them.
 */
export const GHOST_ROPE_STRAY_ARMS = Object.freeze(['LightPole',
    ...Object.keys(GHOST_PRESS_ARMS).filter((k) => GHOST_PRESS_ARMS[k].model === 'refused')]);
