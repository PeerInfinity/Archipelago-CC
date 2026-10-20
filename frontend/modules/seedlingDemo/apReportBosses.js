/**
 * seedlingDemo/apReportBosses — the R4 boss-report AS3 (`CONTACT_FIDELITY.apReportBosses`), transcribed.
 *
 * Seedling fidelity APBOSSES (planner `seedling-fidelity-planning-9`, wasm rebuild R2 item R4). ⚖ The user
 * (2026-10-19): every boss kill REPORTS a location as upstream `boss_locations` defines them (Q1), Bob is ALWAYS fought,
 * even when Fire already came from the server (Q2), and the AS3 change is UNCONDITIONAL, atlas presets included (Q3).
 *
 * The AS3 is PeerInfinity/Seedling branch `r4-boss-report` @ `0eda15f785` (on the pin `f8d9bc1`): `c87e4f4` (BobBoss,
 * FallRockLarge, Fire) and `0eda15f` (Witch, DarkSword). Every line below cites that SHA unless it says `f8d9bc1`.
 * ⛓ APFLIP (re-cited at the vendor/seedling pin `ccdf189776`, the p4g wasm): `ccdf189` is ONE commit past
 * `0eda15f785` and touches `Enemies/BossTotem.as` only (+5 −1: the totem gate, `:291`, mirrored in
 * `bossTotem.stepBossTotem`). Every BobBoss / FallRockLarge / Fire / Witch / DarkSword line below is the same at
 * `ccdf189776` (`git diff 0eda15f785 ccdf189776` names no other file; FallRockLarge is 153 lines at both); the
 * BossTotem lines from `:287` down moved +4 (the Totem row's writer, below).
 *
 * ── WHAT CHANGED, AND WHAT THIS MODULE ANSWERS ─────────────────────────────────────────────────────────────────
 *
 *   `Enemies/BobBoss.as:31`          KILLED_TAG = 3. The three `Player.hasFire` self-remove guards are GONE (f8d9bc1
 *                                    :39-43 ctor, :97-101 `update`, :121-122 `render`), so the fight always happens.
 *   `Enemies/BobBoss.as:190-194`     the final form's `death()`: `setPersistence(KILLED_TAG, false)` (the `Times`
 *                                    report), then `if (checkPersistence(Fire.BOSS_DROP_TAG)) add(new Fire(72, 72,
 *                                    BOSS_DROP_TAG))`. (f8d9bc1 :194 was `add(new Fire(…, -1))`, unconditional.)
 *   `Pickups/Fire.as:21, 49-55`      BOSS_DROP_TAG = 4; `removed()` is `setPersistence(tag, false)` alone — no
 *                                    `Player.hasFire = true` (f8d9bc1 :46). The slot's item is an ordinary AP item.
 *   `Scenery/FallRockLarge.as:116-127` the `cameraTimer == 0` arm: the boss (and the `playerPosition` write) only while
 *                                    KILLED_TAG holds; else the Fire drop while BOSS_DROP_TAG holds; else NOTHING.
 *   `NPCs/Witch.as:46-55`            `doneTalking`: `if (Main.hasWand && checkPersistence(DarkSword.WITCH_TAG))` —
 *                                    was `!Main.hasDarkSword` (f8d9bc1 :48) — adds `new DarkSword(…, WITCH_TAG)`.
 *   `Pickups/DarkSword.as:22, 49-57` WITCH_TAG = 1; `removed()` is `if (checkPersistence(tag)) setPersistence(tag,
 *                                    false)` alone — no `Player.hasDarkSword = true` (f8d9bc1 :46).
 *
 * ⛔ THE STATE IS AN INPUT, NEVER A GUESS (⚖ "a way to know which state it's in"). Every predicate below takes `held`,
 * the slot's `checkPersistence` answer, which the run reads off its own persistence (`levelRun`'s staged clears plus
 * the clears this run wrote, `run.persistenceHeld`). Nothing here reads an inventory to decide a spawn.
 *
 * ⛔ SIDE EFFECT GONE: the vanilla tag −1 writes. `Fire(…, -1).removed()` landed `setPersistence(-1)` in L31's slot 29,
 * and `DarkSword(…).removed()` (tag −1) read and wrote L11's slot 29 (`bobBoss.FIRE.outOfBandFlag`,
 * `outOfBandLedger.OUT_OF_BAND_WRITERS`). Under the switch neither pickup carries −1, so neither out-of-band row is
 * written; the model REPORTED both as ledger rows (never applied), and ON reports neither.
 */

/** `Enemies/BobBoss.as:31` @0eda15f785 — the slot the kill clears in L32 (the `Times` location's report). */
export const BOB_KILLED_TAG = 3;
/** `Pickups/Fire.as:21` @0eda15f785 — the slot the Bob Boss drop carries in L32 (the `Fire` location). */
export const FIRE_BOSS_DROP_TAG = 4;
/** `Pickups/DarkSword.as:22` @0eda15f785 — the slot the Witch's sword carries in L12 (the `Dark Sword` location). */
export const DARK_SWORD_WITCH_TAG = 1;
/** The two levels the switch's own slots live in. */
export const BOB_ARENA_LEVEL = 32;
export const WITCH_LEVEL = 12;

/**
 * The nine report rows, `(level, tag) → upstream id`. `writer` is the AS3 line that clears the slot (a kill, a
 * pickup's `removed()`); `changed` is whether `0eda15f785` changed that writer (the six other bosses already cleared
 * their OEL @tag on the kill, at `f8d9bc1`, and still do).
 */
export const AP_REPORT_ROWS = Object.freeze([
    Object.freeze({ location: 'Times', level: 32, tag: 3, upstream: 20000018, changed: true,
        writer: 'Enemies/BobBoss.as:192 @0eda15f785 — death(): setPersistence(KILLED_TAG, false)' }),
    Object.freeze({ location: 'Fire', level: 32, tag: 4, upstream: 20000016, changed: true,
        writer: 'Pickups/Fire.as:49-55 @0eda15f785 — removed(): setPersistence(tag, false)' }),
    Object.freeze({ location: 'Dark Sword', level: 12, tag: 1, upstream: 20000001, changed: true,
        writer: 'Pickups/DarkSword.as:49-57 @0eda15f785 — removed(): if (checkPersistence(tag)) setPersistence(tag, false)' }),
    Object.freeze({ location: 'Owl', level: 112, tag: 0, upstream: 20000008, changed: false,
        writer: 'Enemies/FinalBoss.as:219-222 @f8d9bc1 — endAnim "dead": setPersistence(tag) AND setPersistence(tag+1), '
            + 'one frame (⚠ the rules arc: only (112,1) reaches the host; R4b reconciles it host-side)' }),
    Object.freeze({ location: 'Shieldspire', level: 19, tag: 0, upstream: 20000013, changed: false,
        writer: 'Enemies/ShieldBoss.as:66 @f8d9bc1 — startDeath(): setPersistence(tag, false)' }),
    Object.freeze({ location: 'Tentacled Beast', level: 57, tag: 0, upstream: 20000023, changed: false,
        writer: 'Enemies/TentacleBeast.as:99-102 @f8d9bc1 — if (checkPersistence(tag)) setPersistence(tag, false)' }),
    Object.freeze({ location: 'Totem of Lacste', level: 43, tag: 5, upstream: 20000033, changed: false,
        writer: 'Enemies/BossTotem.as:482 @ccdf189776 (:478 @f8d9bc1) — removed(): setPersistence(tag, false)' }),
    Object.freeze({ location: 'Lights', level: 69, tag: 0, upstream: 20000038, changed: false,
        writer: 'Enemies/LightBossController.as:106 @f8d9bc1 — setPersistence(tag, false)' }),
    Object.freeze({ location: 'King of Fire', level: 82, tag: 0, upstream: 20000043, changed: false,
        writer: 'Enemies/LavaBoss.as:135-137 @f8d9bc1 — if (checkPersistence(tag)) setPersistence(tag, false)' }),
]);

/**
 * `Scenery/FallRockLarge.as:116-127` @0eda15f785 — what the arena rock's `cameraTimer == 0` arm adds.
 *
 *     if (bossRock && thirdBoss && checkPersistence(BobBoss.KILLED_TAG))      { add(new BobBoss(72, 72));
 *                                                                               playerPosition = new Point(72, 104); }
 *     else if (bossRock && thirdBoss && checkPersistence(Fire.BOSS_DROP_TAG)) { add(new Fire(72, 72, BOSS_DROP_TAG)); }
 *
 * ⚠ `playerPosition` (the reboot point a later `restartLevel()` reads) is written ONLY on the boss arm now. At
 * `f8d9bc1` it was written on every arena landing (the ctor's `hasFire` guard was a no-op, `levelWorld
 * .ADDED_TIME_REMOVAL`), so the model wrote it unconditionally.
 *
 * @param {{killedHeld: boolean, dropHeld: boolean}} slots  `checkPersistence(3)` and `checkPersistence(4)` in L32
 * @returns {{spawn: ?({form: 0}|{fire: true}), playerPosition: boolean}}
 */
export function fallRockLargeSpawn({ killedHeld, dropHeld }) {
    if (killedHeld === true) return { spawn: { form: 0 }, playerPosition: true };
    if (dropHeld === true) return { spawn: { fire: true }, playerPosition: false };
    return { spawn: null, playerPosition: false };
}

/**
 * `Enemies/BobBoss.as:188-197` @0eda15f785 — the FINAL form's `death()` arm, after `nextBossTimer` runs out.
 *
 *     Game.setPersistence(KILLED_TAG, false);
 *     if (Game.checkPersistence(Fire.BOSS_DROP_TAG)) FP.world.add(new Fire(…, Fire.BOSS_DROP_TAG));
 *
 * The write is IN BAND (tag 3 of L32) and comes FIRST; the drop reads slot 4, which the write did not touch.
 *
 * @param {{dropHeld: boolean}} slots  `checkPersistence(4)` in L32 on the death frame
 * @returns {{writes: Array<{level: number, tag: number}>, spawn: ?{fire: true}}}
 */
export function bobBossFinalDeath({ dropHeld }) {
    return {
        writes: [{ level: BOB_ARENA_LEVEL, tag: BOB_KILLED_TAG }],
        spawn: dropHeld === true ? { fire: true } : null,
    };
}

/**
 * `NPCs/Witch.as:46-55` @0eda15f785 — `doneTalking`'s guard: does ending the dialogue add the `DarkSword`?
 * `Main.hasWand && checkPersistence(DarkSword.WITCH_TAG)`: the sword itself already held (from the server) no longer
 * matters. `Witch.update`'s text swap (`:30-44`) is UNCHANGED and still reads `hasDarkSword` (`witch.witchText`).
 */
export function witchGrantsReport(inventory, { slotHeld }) {
    return inventory?.hasWand === true && slotHeld === true;
}

/**
 * The `removed()` of the two R4 pickups @0eda15f785: NO item (the slot's item is received from the server, as for `APItem`) and the pickup's
 * own slot cleared — `Fire` unconditionally (`Fire.as:49-55`), `DarkSword` behind `checkPersistence(tag)`
 * (`DarkSword.as:49-57`), which the caller's `held` answers.
 *
 * @param {'fire'|'darksword'} kind
 * @param {{held: boolean}} slot  `checkPersistence(tag)` on the removal frame
 * @returns {{item: null, writes: Array<{level: number, tag: number}>}}
 */
export function reportPickupRemoved(kind, { held }) {
    if (kind === 'fire') return { item: null, writes: [{ level: BOB_ARENA_LEVEL, tag: FIRE_BOSS_DROP_TAG }] };
    if (kind === 'darksword') {
        return { item: null, writes: held === true ? [{ level: WITCH_LEVEL, tag: DARK_SWORD_WITCH_TAG }] : [] };
    }
    throw new Error(`apReportBosses.reportPickupRemoved: "${kind}" is not an R4 pickup (fire | darksword)`);
}

/**
 * The slots a level's RUNTIME entities read under the switch, which a build must accept as cleared (not orphans):
 * an arena rock (`levelWorld.arenaRockOf`) reads KILLED_TAG and BOSS_DROP_TAG (`FallRockLarge.as:118, 123`), and a
 * `witch` reads WITCH_TAG (`Witch.as:50`). No placed entity carries them on either atlas (L32: tags 0, 1, 2; L12:
 * 0, 2–12), so before R4 a staged clear of them was a derivation error, and now it is the game's own state.
 *
 * @param {Array<{type: string, attrs?: object}>} entities  the level record's entities
 * @param {(e: object) => boolean} isArenaRock
 * @returns {number[]}
 */
export function reportSlotsReadBy(entities, isArenaRock) {
    const out = [];
    if ((entities ?? []).some((e) => isArenaRock(e))) out.push(BOB_KILLED_TAG, FIRE_BOSS_DROP_TAG);
    if ((entities ?? []).some((e) => e?.type === 'witch')) out.push(DARK_SWORD_WITCH_TAG);
    return out;
}
