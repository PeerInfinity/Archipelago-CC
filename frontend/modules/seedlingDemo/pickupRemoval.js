/**
 * seedlingDemo/pickupRemoval — WHICH FRAME A PICKUP'S `removed()` RUNS ON.
 *
 * Seedling fidelity ENCOUNTERS2, D3. A `special` pickup's ceremony ends in two
 * frames, not one:
 *
 *   frame F    the last page's X release closes the ceremony's text NPC: its
 *              `talking = false` clears `Game.freezeObjects` (the NPC updates
 *              before the player), so the player moves on F; and `FP.world
 *              .remove(npc)` queues the NPC, whose `NPC.removed()` — at the END
 *              of F, in `updateLists` — is what nulls the pickup's `myText`
 *              (`NPCs/NPC.as:71-84`).
 *   frame F+1  `Pickup.update` → `pick_up()` takes its `else if (!myText)` arm
 *              (`Pickups/Pickup.as`): `removeSelf()`, so the pickup's own
 *              `removed()` — the item property (`Player.hasDarkSword = true`,
 *              `hasFire`, `hasTorch` …), a boss key, a totem part, its own
 *              `setPersistence(tag, false)`, an out-of-band write — runs at the
 *              END of F+1.
 *
 * The model has applied all of `removed()` on F. Measured on the game (p4f,
 * headless; `probe-seedling-encounter-ticks.mjs`, the flag read off
 * `botStatus().items` beside the model's `run.inventory` at the same
 * observation): `hasDarkSword` turns true at obs 378 on `enc-l12-witch` (the
 * model: 377), `hasFire` at obs 833 on `enc-l32-live-arrival` (832), and
 * `hasTorch` at obs 226 on `bobsoldier2-l30-torch` (225) — a PLACED pickup too,
 * so it is the ceremony, not the runtime add. The recording is
 * `fixtures/pickup-removal-witness.json`; `fidelityEncounters2.test.js` holds
 * the model to it. Every recorded x/y stream agrees
 * either way (the player is free on F on both sides), which is why no witness
 * ever saw it; the encounter executors' "one tick after the flag" equip wait
 * (`execBobBossEncounter`) was this frame, measured from the other side.
 *
 * `PICKUP_REMOVED_NEXT_FRAME` (OFF by default — the BEFORE model): ON, the
 * finishing frame QUEUES the pickup's flag writes — the item (and its slot
 * sync), a key, a totem part, the pickup's own persistence flag, and the
 * `darksword-removed` / `fire-removed` ledger rows — and they land at the end
 * of the next advance. Everything else the finishing frame does stays where it
 * was (the freeze ends on F; the `collected` record, the shield's beam, the
 * wand's activator loop and a sword's `Help` are not moved by this switch).
 *
 * ⛔ WHY IT SHIPS OFF (measured, not a licence question alone): the Sword's flag
 * is one frame late on the game too (`r8-solve-10`, obs 71, the model 70), but
 * ON moves that tape's recorded stream at t73. The tape presses `primary` on the
 * closing frame; the game swings (the dash two ticks later lands), and the ON
 * model, whose press reads `hasSword` on that frame, does not. So the game's
 * swing on the closing frame does not wait for `Sword.removed()`; the model's
 * press gate has to learn that before this can be the default. With it ON the
 * producers also move (`r8-battery`'s `r8-solve-10` 83 → 90 t; `r8-d2-chain` and
 * `r9-campaign` refuse a keylock right after a boss key's collect goal ends,
 * because the key lands on the next frame). The encounter tapes do not move.
 *
 * The node measuring hook: `SEEDLING_PICKUP_REMOVED_NEXT=1` (or `on`) turns it
 * ON for a process, `0`/`off` OFF.
 */
export const PICKUP_REMOVED_NEXT_FRAME = { enabled: false };
export const PICKUP_REMOVED_NEXT_FRAME_DEFAULT = false;

const envFlag = globalThis.process?.env?.SEEDLING_PICKUP_REMOVED_NEXT;
if (envFlag !== undefined && envFlag !== '') {
    PICKUP_REMOVED_NEXT_FRAME.enabled = envFlag === '1' || envFlag === 'on' || envFlag === 'true';
}

/** Run `fn` with the switch set to `on`, restoring it after (a test's and a measuring script's door). */
export function withPickupRemovedNextFrame(on, fn) {
    const was = PICKUP_REMOVED_NEXT_FRAME.enabled;
    PICKUP_REMOVED_NEXT_FRAME.enabled = on;
    try {
        return fn();
    } finally {
        PICKUP_REMOVED_NEXT_FRAME.enabled = was;
    }
}

