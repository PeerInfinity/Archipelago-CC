/**
 * ghostStrikeGate — ⛓⛓⛓ SEEDLING HAMMER-PHASE GHOST-STRIKE-GATE: A GHOST-SWORD-ONLY RUN PLANS NO SWING THE GAME
 * IGNORES (`GHOST_STRIKE_GATE`, OFF).
 *
 * ⚖ The user approved this slice on 2026-11-12 (the hammer replan), from fidelity FIREBREAK's hand-over: the walk's
 * strike policy and its dash read `hasSword || hasGhostSword` and press `primary`, but the game's hit test is
 * `slash()`, which `Player.update` calls only `if (hasSword)` (`Player.as:560-563`). The game, for a run holding the
 * Ghost Sword WITHOUT the Sword:
 *
 *   `useItem` case 4    `if (slashDelay <= 0) slashing = true` (`Player.as:1580-1585`) — `slashDelay` only moves inside
 *                       `slash()`, so it stays 0 and every press reaches the setter;
 *   `set slashing`      gated `(hasSword || hasGhostSword) && …` (`:782`): it PLAYS — the animation, the sound, and on a
 *                       press while `slashTimer > 0` the dash's `knockback(2, …)` (`:784-790`);
 *   `slash()`           never called: no hitbox test (`Bot.slashTests` stays 0), no damage, no rock, no rope, no pole
 *                       — and `slashTimer` (decremented only there, `:894-897`) never counts down, so after the first
 *                       press of a room every later press is a DASH;
 *   the spear           `Inventory.addItemsFromSave` splices item 4 in for the sword (0) AND the spear (3) slots once
 *                       the flag is up (`Inventory.as:291-330`): no thrust either.
 *
 * The model refuses that swing by name (`ghostSword.ghostSwingRefusal`) — `levelRun` THROWS on such a press — so a
 * solver that plans one dies at the press with a plain Error, not a `SolverRefusal` (measured: a ghost-only arrival
 * `level_0__r7c6 <- in_L2_48_16 -> exit:out_teleporter_0_128` threw at tick 0, the walk's dash press).
 *
 * ⇒ ON, every site that grants the walk a swing or a dash on "a blade is held" asks `bladeSwings(inventory)` instead:
 * the Sword, or (OFF only) the Ghost Sword. A Ghost-Sword-only run then builds no strike policy, plans no dash, opens
 * no kill arm; a goal that needs a swing refuses BY NAME (`ghostOnlyWhy`, `ghostSwingRefusal`'s words) rather than
 * throwing at the press. Sword-only and both-held runs are untouched (`hasSword` is up).
 *
 * ⛔ What the game DOES honour for this inventory — the dash's `knockback(2, …)` on every press after the first — is
 * NOT used: its frozen `slashTimer` is a state `levelRun` does not carry (`ghostSwingRefusal`), and modelling it is
 * the fidelity arc's (a hand-over in the slice's report), not a strike gate's.
 *
 * ⛓ THE SWITCH: `SEEDLING_GHOST_STRIKE_GATE=1` in a node process (or the page's
 * `?seedlingSolverEnv=SEEDLING_GHOST_STRIKE_GATE=1` through `solverEnvChannel` — the solve WORKER's thread; no
 * main-thread mapper reads it), `withGhostStrikeGate(enabled, fn)` for a row or a witness. OFF, `bladeSwings` is
 * `hasSword || hasGhostSword`, the expression every gated site read before (byte-identical).
 */

import { ghostSwingRefusal } from './ghostSword.js';

export const GHOST_STRIKE_GATE = {
    enabled: globalThis.process?.env?.SEEDLING_GHOST_STRIKE_GATE === '1',
};
export const GHOST_STRIKE_GATE_DEFAULT = false;

/** ⛓ The instrument (ON only): `gated` — a site that, OFF, would have granted a swing to a Ghost-Sword-only run. */
export const GHOST_STRIKE_GATE_COUNTS = { gated: 0 };

export function resetGhostStrikeGateCounts() {
    for (const k of Object.keys(GHOST_STRIKE_GATE_COUNTS)) GHOST_STRIKE_GATE_COUNTS[k] = 0;
}

/** Run `fn` with `GHOST_STRIKE_GATE` set to `enabled`, restoring the previous value (`withStrikeSlot`'s shape). */
export function withGhostStrikeGate(enabled, fn) {
    const was = GHOST_STRIKE_GATE.enabled;
    GHOST_STRIKE_GATE.enabled = enabled === true;
    const restore = () => { GHOST_STRIKE_GATE.enabled = was; };
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
 * Does a `primary` blade press with this inventory reach a hit test? OFF: `hasSword || hasGhostSword` (the pre-slice
 * read). ON: `hasSword` — `slash()` runs only `if (hasSword)`, whichever sword's sprite swings.
 */
export function bladeSwings(inventory) {
    const sword = !!inventory?.hasSword;
    const ghost = !!inventory?.hasGhostSword;
    if (!GHOST_STRIKE_GATE.enabled) return sword || ghost;
    if (!sword && ghost) GHOST_STRIKE_GATE_COUNTS.gated += 1;
    return sword;
}

/**
 * ON only: the refusal's words for a run the gate closed (`ghostSwingRefusal`'s), else null. OFF always null, so a
 * caller's message is byte-identical.
 */
export function ghostOnlyWhy(inventory) {
    return GHOST_STRIKE_GATE.enabled ? ghostSwingRefusal(inventory) : null;
}
