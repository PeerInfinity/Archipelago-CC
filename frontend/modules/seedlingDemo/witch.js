/**
 * seedlingDemo/witch — L12's Witch: the encounter that grants the DARK SWORD.
 *
 * Seedling fidelity ENCOUNTERS, D3. The AP location `Level 012 - Witch`
 * (vanilla item: the second `Progressive Sword`, i.e. `Player.hasDarkSword`)
 * is not a fight. It is a placed NPC whose `doneTalking()` ADDS a pickup:
 *
 *   `NPCs/Witch.as`
 *     update()       if (Main.hasWand) prepNewText(hasDarkSword ? textExtra1 : textExtra);
 *                    super.update();               // NPC.talk()
 *     doneTalking()  if (Main.hasWand && !Main.hasDarkSword)
 *                        FP.world.add(new DarkSword(p.x - Tile.w/2, p.y - Tile.h/2));
 *   `Pickups/DarkSword.as`
 *     ctor           super(_x + Tile.w/2, _y + Tile.h/2, spr, null, false)   // `_attract` FALSE
 *                    setHitbox(8, 8, 4, 4); special = true; text = …; tag = -1
 *     removed()      Player.hasDarkSword = true;
 *                    if (Game.checkPersistence(tag)) Game.setPersistence(tag, false)  // out of band, tag -1
 *
 * ⛔ FOUR THINGS A FIRST READING GETS WRONG
 *
 * 1. **The text is the ITEM's, not the level's.** `update()` replaces
 *    `myText` on every frame the player holds the wand, BEFORE `talk()` runs,
 *    so the `.oel` `text` attribute is spoken only by a wand-less player.
 * 2. **Leaving the circle GRANTS too.** `NPC.talk()`'s out-of-range arm runs
 *    the `talking` setter, which calls `doneTalking()`: walking away
 *    mid-dialogue spawns the sword exactly as finishing it does.
 * 3. **The sword spawns AT THE PLAYER, truncated.** The ctor's parameters are
 *    `int`, so `p.x - 8` is truncated toward zero and the half tile added
 *    back: the pickup's point is `(trunc(p.x - 8) + 8, trunc(p.y - 8) + 8)`,
 *    read where the player stands when the Witch updates (before the
 *    player's own update that frame).
 * 4. **It is collected on the NEXT frame, by overlap alone.** `FP.world.add`
 *    queues it; `updateLists` adds it at the end of the closing frame, and a
 *    runtime add is PREPENDED, so on the next frame it updates before the
 *    player and `collide("Player")` finds the box it was spawned on. No
 *    attraction (`_attract` false), so a player that walked > 6 px away on
 *    the closing frame would leave it lying there (the model refuses that
 *    by name rather than modelling a dropped sword).
 */

/** `Witch.as:21-22`, verbatim. */
export const WITCH_TEXT_EXTRA = 'Oh, you found the wand!~You must be very powerful and your goals noble.'
    + '~Here is an enchantment to improve your sword!';
export const WITCH_TEXT_EXTRA1 = 'May you do only good with that sword.~I presume you can be trusted?';

export const DARK_SWORD = Object.freeze({
    as3: 'Pickups/DarkSword.as',
    /** `setHitbox(8, 8, 4, 4)` */
    box: Object.freeze({ w: 8, h: 8, ox: 4, oy: 4 }),
    /** `DarkSword.as:27` */
    text: 'You got the dark sword!~It does more damage.',
    /** `tapeFormat.ITEM_PROPERTIES.darksword` → `hasDarkSword` */
    item: 'darksword',
});

/** The text `NPC.talk()` speaks this frame: `Witch.update`'s `prepNewText`, or the level's. */
export function witchText(oelText, inventory) {
    if (inventory?.hasWand !== true) return oelText;
    return inventory?.hasDarkSword === true ? WITCH_TEXT_EXTRA1 : WITCH_TEXT_EXTRA;
}

/** `Witch.doneTalking`'s guard: does ending this dialogue add a `DarkSword`? */
export function witchGrants(inventory) {
    return inventory?.hasWand === true && inventory?.hasDarkSword !== true;
}

/** `new DarkSword(p.x - Tile.w/2, p.y - Tile.h/2)` → the pickup's point (int ctor args, `+ Tile/2`). */
export function darkSwordSpawnAt(player) {
    return { x: Math.trunc(player.x - 8) + 8, y: Math.trunc(player.y - 8) + 8 };
}

/** The pickup's 8x8 box at its point. */
export function darkSwordBox(at) {
    const x = at.x - DARK_SWORD.box.ox;
    const y = at.y - DARK_SWORD.box.oy;
    return { x, y, right: x + DARK_SWORD.box.w, bottom: y + DARK_SWORD.box.h };
}
