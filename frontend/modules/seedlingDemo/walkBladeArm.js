/**
 * walkBladeArm — ⛓⛓⛓ SEEDLING HAMMER-PHASE L65→L68 HIT: A WALK THROUGH STRIKE BODIES SELECTS THE HELD BLADE
 * (`WALK_BLADE_ARM`, OFF).
 *
 * ⚖ The user approved the slice on 2026-11-27 (*"L65→L68 hit slice (Recommended)"*): past whole-game entry 37 the
 * L65 → L68 `(184,64)` plan took one model hit (`chaser:bob@208,80`, t1282, both passes) and shipped it.
 *
 * MEASURED (`CC/docs/cloud-reports/seedling-hammer-l65-l68-hit.md` §3): the run arrives holding the sword with the
 * WAND selected. `strikePolicyFor` builds the walk's strike policy off the INVENTORY (a blade held), so the walk's
 * last corridor presses `primary` at the bob — and the corridor probe (`previewWalk`, the chaser forecast) prices each
 * press as a sword strike that knocks the bob back (at t1238: (191.9,91.9) → (195.2,89.2)). The drive's press is
 * `useItem(Main.primary)`: a WandShot, which does not knock the bob. From that tick the forecast and the run part; the
 * live bob reaches (191.1,81.9) beside the exit and the certified corridor walks into it. ⚖ Ruling 30(c) (the probe
 * certifies what the walk does) is broken by the selection, not by the chase.
 *
 * ON: before a walk in a room with strike bodies (the run's `strikeBodies` family, the policy's own fast path;
 * solverBot reads it), a run that HOLDS a blade but has a non-blade selected (`strikeSlot.pressIsBlade`:
 * `ghostsword`, or `sword` while the Ghost Sword is not held) selects the blade's slot. An equip is a `Main.primary` write at the reached tick (no tick
 * spent; the tape carries it as a field), so the policy's presses are the swings the probe priced. A later verb that
 * needs another slot selects it itself, as every verb does (the wand verb, BURN, the spear arm). `SPEAR_ARM`'s
 * `spearArmEquip` is the bladeless twin of this rule.
 *
 * It composes with `STRIKE_SLOT` (ON: a non-blade selection builds no policy at all): with the blade selected that
 * gate passes, so the walk keeps its strikes rather than walking strike-free.
 *
 * ⛓ THE THREAD: read inside `solveSegment` (solverBot's `walkTo`), i.e. the page's SOLVE WORKER and node; no
 * main-thread mapper reads it, so the worker's env channel (`?seedlingSolverEnv=SEEDLING_WALK_BLADE_ARM=1`) is the
 * whole page wiring. `withWalkBladeArm(enabled, fn)` for a row or a witness. OFF nothing here is read.
 *
 * ⚖ No single-game constant: the rule reads the run's inventory, its slots and its selected weapon only.
 */
import { INVENTORY_ITEM_IDS } from './solverView.js';
import { pressIsBlade } from './strikeSlot.js';

export const WALK_BLADE_ARM = {
    enabled: globalThis.process?.env?.SEEDLING_WALK_BLADE_ARM === '1',
};
export const WALK_BLADE_ARM_DEFAULT = false;

/**
 * The instrument (ON only): `equips` the walks that selected the blade, `rows` the last 64 of them
 * (`{t, level, from, slot}`: the run tick, the level, the weapon that was selected, the blade's slot). Nothing reads
 * it but rows and probes. `resetWalkBladeArmCounts()` zeroes it.
 */
export const WALK_BLADE_ARM_COUNTS = { equips: 0, rows: [] };

export function resetWalkBladeArmCounts() {
    WALK_BLADE_ARM_COUNTS.equips = 0;
    WALK_BLADE_ARM_COUNTS.rows.length = 0;
}

/** Run `fn` with `WALK_BLADE_ARM` set to `enabled`, restoring the previous value (`withStrikeSlot`'s shape). */
export function withWalkBladeArm(enabled, fn) {
    const was = WALK_BLADE_ARM.enabled;
    WALK_BLADE_ARM.enabled = enabled === true;
    const restore = () => { WALK_BLADE_ARM.enabled = was; };
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
 * The blade's slot index the walk should select, or -1 (pure): a blade held (`hasGhostSword` → the Ghost Sword, it
 * replaces the sword; else `hasSword`), the selected weapon not already a blade press (`pressIsBlade`), and a slot
 * holding that blade (`Inventory.getItem` is what `useItem` reads; a blade not yet slotted is not selectable). The
 * switch is not read here: the caller asks only with it ON.
 */
export function walkBladeArmSlot(inventory, inventorySlots, primaryWeapon) {
    if (!inventory || !(inventory.hasSword || inventory.hasGhostSword)) return -1;
    if (pressIsBlade(primaryWeapon ?? null, inventory)) return -1;
    const want = inventory.hasGhostSword ? INVENTORY_ITEM_IDS.ghostsword : INVENTORY_ITEM_IDS.sword;
    return (inventorySlots ?? []).indexOf(want);
}
