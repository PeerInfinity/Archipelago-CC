/**
 * ⛓⛓ hammer-phase SPEAR-ARM (`SPEAR_ARM`, `SEEDLING_SPEAR_ARM`, OFF) — **A STRIKE POLICY FOR A SPEAR-ONLY SLOT.**
 *
 * `solverBot.strikePolicyFor` builds the walk's strike policy only for a sword (`hasSword || hasGhostSword`): a run that
 * holds the Ghost Spear and no blade walks strike-free, so neither the walk's opportunistic strike nor any rung built on
 * the policy exists for it (CONNECTED-L22 §5: request #49 dies to `wallflyer` contact crossing L22 south → north and
 * loops). The game's spear IS a strike: `Player.spear()` (`Player.as:954-990`) collides a `length` x `thick` rect ahead
 * of the player from `spearDirection` and calls `genericHit(v[i], "Spear", spearForce, spearDamage)` on every body in it
 * (`spearDamage` 2, `spearForce` 7, `Player.as:144-145`), and the model carries that press whole (`levelRun`'s thrust:
 * `presses.spearHitRect`, the T+1/T+3/T+5 tests, no reach gate and no line under `CONTACT_FIDELITY.spearGameTest`).
 *
 * ON, this module hands the policy the SPEAR's geometry instead of the sword's — the rect the press will collide
 * (`spearHitRect`, read through `pressRectTouches`), the reach gate the model applies (none under `spearGameTest`, else
 * `SLASH_REACH`), and the re-press guard (`set spearing` ignores a press while `spearing` is up, so a press inside the
 * thrust's animation is swallowed) — all read from the press model, no level and no body named here. Which slot is
 * the spear is the run's own `inventorySlots`; a press is `useItem(Main.primary)`, so the walk selects that slot first
 * (`spearArmSlot`, an equip: a `Main.primary` write, no tick). There is no spear dash (`set spearing` has no dash arm),
 * so a dash plan builds no spear policy.
 *
 * OFF nothing here is read: `strikePolicyFor` returns null for a bladeless run, as before.
 */
import {
    CONTACT_FIDELITY, INVENTORY_ITEM_IDS, SLASH_REACH, SPEAR_ANIM_TICKS, pressRectTouches, spearHitRect,
} from './solverView.js';

export const SPEAR_ARM = {
    enabled: globalThis.process?.env?.SEEDLING_SPEAR_ARM === '1',
};
export const SPEAR_ARM_DEFAULT = false;

/**
 * `policies` built; `equips` the walks that selected the spear slot; `swallowed` the aims refused because the press
 * would land inside the previous thrust's animation. Reset by the reader.
 */
export const SPEAR_ARM_COUNTS = { policies: 0, equips: 0, swallowed: 0 };

export function resetSpearArmCounts() {
    for (const k of Object.keys(SPEAR_ARM_COUNTS)) SPEAR_ARM_COUNTS[k] = 0;
}

/** Run `fn` with `SPEAR_ARM` set to `enabled`, restoring the previous value (`withStrikeSlot`'s shape). */
export function withSpearArm(enabled, fn) {
    const was = SPEAR_ARM.enabled;
    SPEAR_ARM.enabled = enabled === true;
    const restore = () => { SPEAR_ARM.enabled = was; };
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
 * The spear's slot index for a run the arm serves, or -1: the switch ON, no blade held (a sword's policy is the
 * sword's), the spear held, and a slot holding it (`Inventory.getItem` is what `useItem` reads).
 */
export function spearArmSlot(inventory, inventorySlots) {
    if (!SPEAR_ARM.enabled) return -1;
    if (!inventory || inventory.hasSword || inventory.hasGhostSword || !inventory.hasSpear) return -1;
    return (inventorySlots ?? []).indexOf(INVENTORY_ITEM_IDS.spear);
}

/**
 * The thrust as `strikePolicy`'s scan asks it (`strikeCandidates`' `geometry`): `rect(x, y, facing)` the rect
 * `spear()` collides, `touches(rect, box)` its edge rule, `reach` the model's distance gate, `period` the ticks after a
 * press before another press starts a thrust (`spearing` is cleared when the animation completes,
 * `combatVerbs.SPEAR_ANIM_TICKS`; a press while it is up is a no-op).
 */
export function spearStrikeGeometry() {
    return Object.freeze({
        weapon: 'spear',
        rect: (x, y, facing) => spearHitRect(x, y, facing),
        touches: pressRectTouches,
        reach: CONTACT_FIDELITY.spearGameTest ? Infinity : SLASH_REACH,
        period: SPEAR_ANIM_TICKS,
    });
}
