/**
 * strikeSlot — ⛓⛓⛓ SEEDLING HAMMER-PHASE STRIKE-SLOT: THE WALK'S STRIKE POLICY READS THE SELECTED SLOT
 * (`STRIKE_SLOT`, OFF).
 *
 * ⚖ The user queued this on 2026-11-02 (the hammer-phase STRIKE-SLOT slice), from fidelity CORPSEBUMP2's hand-over:
 * `solverBot.strikePolicyFor` built the walk's strike policy whenever the INVENTORY held a blade
 * (`hasSword || hasGhostSword`), whatever the SELECTED slot was. The policy presses `primary`, and the game runs that
 * press as `Player.useItem(Main.primary)` — the selected item's own verb. On L40's latch chain the corpse weigh walks
 * between its bumps with Fire selected, so the walk's "strike" on its first tick was a Fire press, which bumped the
 * ice turret's corpse from (30,25) to (30,24) in the game and in the model alike (p4g, 0 px over 1400 t).
 *
 * ⇒ ON, the policy is gated on what the press DOES: `run.progress('primaryWeapon')` (`levelRun.weaponForPress`,
 * `useItem`'s own switch) must be a blade. With the Ghost Sword held that blade is `ghostsword` ONLY (⚖ 2026-10-30:
 * the Ghost Sword REPLACES the Sword; `getSword()` reads the flag, so the game never swings the plain sword while it is
 * up). A walk whose selected item is not a blade gets NO policy (`strikePolicyFor` → `null`, the strike-free walk),
 * a policy already built re-reads the slot on every `decide` and stands down while it is not a blade, and
 * `planSwordDash` refuses by name (a scheduled press is the selected item's press too) — the walk presses no X it
 * cannot price (design (1) of the slice's report; (2) pricing the item's own press and (3) re-selecting
 * a blade mid-walk were measured and not built: the report says why).
 *
 * ⛓ THE SWITCH: `SEEDLING_STRIKE_SLOT=1` in a node process (or the page's `?seedlingSolverEnv=SEEDLING_STRIKE_SLOT=1`
 * through `solverEnvChannel`), `withStrikeSlot(enabled, fn)` for a row or a witness. OFF, nothing new is read: the
 * inventory gate and `createStrikePolicy`'s arguments are byte-identical to the pre-slice code.
 */

export const STRIKE_SLOT = {
    enabled: globalThis.process?.env?.SEEDLING_STRIKE_SLOT === '1',
};
export const STRIKE_SLOT_DEFAULT = false;

/**
 * ⛓ The instrument (ON only): `refused` (a `strikePolicyFor` call that returned `null` because the
 * selected item is not a blade, the inventory holding one), `stoodDown` (a `decide` tick a built policy declined for
 * the same reason), `dashRefused` (a `planSwordDash` refused by name for it). `resetStrikeSlotCounts()` zeroes it.
 */
export const STRIKE_SLOT_COUNTS = { refused: 0, stoodDown: 0, dashRefused: 0 };

export function resetStrikeSlotCounts() {
    for (const k of Object.keys(STRIKE_SLOT_COUNTS)) STRIKE_SLOT_COUNTS[k] = 0;
}

/** Run `fn` with `STRIKE_SLOT` set to `enabled`, restoring the previous value (`withAxisStrike`'s shape). */
export function withStrikeSlot(enabled, fn) {
    const was = STRIKE_SLOT.enabled;
    STRIKE_SLOT.enabled = enabled === true;
    const restore = () => { STRIKE_SLOT.enabled = was; };
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
 * Is a `primary` press, with this weapon selected and this inventory, a BLADE swing (`set slashing`)? `ghostsword`
 * always; `sword` only while the Ghost Sword is NOT held (⚖ it replaces the sword). Fire, the wand, the spear, an
 * empty slot (`null`) — no.
 */
export function pressIsBlade(weapon, inventory) {
    if (weapon === 'ghostsword') return true;
    return weapon === 'sword' && !inventory?.hasGhostSword;
}
