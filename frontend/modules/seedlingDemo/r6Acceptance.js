/**
 * seedlingDemo/r6Acceptance — R6's exit criteria, DERIVED, as pure
 * functions. Brief: `NewDocs/plans/seedling-bot-r6-opus-kickoff.md`
 * (§3.1 the ledger, §7 the gates, §8 slice 0's as-built).
 *
 * R5 counted CEREMONIES. **R6 counts BOSS KILLS BY PERSISTENCE TAG**, read
 * back from the game's own `botStatus.persistence_cleared` rather than
 * echoed from any tape — the R3 distinction between "the tape asked for it"
 * and "the player did it" applied to the rung's headline.
 *
 * ── ⛔ EVERY COUNT HERE IS DERIVED FROM `fixtureNames()` ──────────────
 *
 * R5 closed with two hand-kept counts ROTTED: `R5_NODAMAGE_STATUS.
 * tapesDeclaringIt` said 42 against a 100-tape roster, and the item
 * ledger's tape counts predated the roster they described (R5 kickoff
 * §38.4 item 2). A number written down beside a set is a number that stops
 * describing the set the moment the set moves, and it goes on reading like
 * a fact. **Nothing in this module stores a count.** Every one is computed
 * from the roster at call time, and the tests assert that.
 */

import { fixtureNames, loadTape } from './fixtures/index.js';

export class R6AcceptanceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'R6AcceptanceError';
    }
}

// ── THE HEADLINE: the boss-kill ledger, by persistence tag ────────────

/**
 * The six writes that ARE the rung's claim, each with the AS3 line that
 * makes it and the window that must earn it.
 *
 * ⛔ `earnedIn` is a WINDOW NAME, not a tape name, because a window is one
 * tape plus its pair and the pair is what makes the claim. The tape names
 * land in `R6_WINDOWS` as each slice authors them, and
 * `r6LedgerFindings` refuses a ledger entry whose window has no tape yet —
 * an unclaimed row must read as UNCLAIMED, never as satisfied by default.
 */
export const R6_BOSS_KILL_LEDGER = Object.freeze([
    Object.freeze({
        flag: Object.freeze({ level: 19, tag: 0 }),
        boss: 'ShieldBoss',
        earnedIn: 'W-shield',
        writtenBy: 'Enemies/ShieldBoss.as:64 — `startDeath` overrides the base and '
            + 'writes persistence FIRST, then plays "die". ⛔ IT DOES NOT SET '
            + '`destroy`; that lands in `endAnim` 23 updates later (derived at '
            + 'FP.elapsed 0.0333). ⇒ THE TAG PRECEDES THE CORPSE, and '
            + '`totalEnemies()` counts him for the whole die animation.',
    }),
    Object.freeze({
        flag: Object.freeze({ level: 43, tag: 5 }),
        boss: 'BossTotem',
        earnedIn: 'W-totem',
        writtenBy: 'Enemies/BossTotem.as:478 — `removed()`, guarded by `doActions` so '
            + 'the `check()` despawn path writes nothing. ⛓ `removed()` is reached '
            + 'from `render()` after 240 RENDER frames of white-out, not from the '
            + 'kill tick: `startDeath` sets `destroy` and `update()` returns early '
            + 'from then on, so the CLAMP stops at the kill and the tag lands much '
            + 'later.',
    }),
    Object.freeze({
        flag: Object.freeze({ level: 112, tag: 0 }),
        boss: 'FinalBoss (the Owl)',
        earnedIn: 'W-owl',
        writtenBy: 'Enemies/FinalBoss.as:221 — `endAnim`\'s "dead" arm, NOT `removed()`. '
            + '`removed()` has its own write but it is guarded by `checkPersistence` '
            + 'and is a no-op by then. ⇒ 49 + 61 = 110 updates after the third lava '
            + 'hit (the "die" then "dead" anims, derived at 0.0333).',
    }),
    Object.freeze({
        flag: Object.freeze({ level: 112, tag: 1 }),
        boss: 'the RockLock the Owl\'s death opens',
        earnedIn: 'W-owl',
        writtenBy: 'Enemies/FinalBoss.as:222 — `setPersistence(tag+1)`, a DIRECT write '
            + 'in the same `endAnim` arm. ⚠ `Button.activateAll(null, 0, true)` runs '
            + 'beside it and is a separate mechanism; the tag does not depend on the '
            + 'button sweep reaching anything.',
    }),
    Object.freeze({
        flag: Object.freeze({ level: 113, tag: 0 }),
        boss: 'FinalDoor',
        earnedIn: 'W-door',
        writtenBy: 'Scenery/FinalDoor.as:45 — `removed()`, reached from `animEnd` when '
            + 'the 28-frame "open" animation wraps (57 updates). ⛔ ONE APPROACH IS '
            + 'ENOUGH: `SealController.removed()` nulls `parent.mySealController`, so '
            + 'the door\'s `else if` becomes reachable on a LATER TICK of the SAME '
            + 'approach. Leaving the 32 px radius resets `seenSeal` and fires a FRESH '
            + 'ceremony on re-approach.',
    }),
    Object.freeze({
        flag: Object.freeze({ level: 114, tag: 0 }),
        boss: 'the Watcher\'s dialogue',
        earnedIn: 'W-talk',
        writtenBy: 'NPCs/Watcher.as:131 — `doneTalking()`. ⛓ This is FinalDoor\'s '
            + 'second condition (`!checkPersistence(0, 114)`), and it also ARMS the '
            + 'bloody branch: `Watcher.hit()` counts only while '
            + '`!checkPersistence(tag)`, i.e. only after the dialogue is exhausted.',
    }),
]);

/**
 * The three real collections R6 owes beside the kills.
 *
 * `fire` is R5's named debt (window 1's blocker: the kill that SPAWNS it is
 * driven, the PICKUP is collected by no tape). ⚠ `bosskey:0` sits INSIDE
 * ShieldBoss's 48x48 body, and `"ShieldBoss"` is in `Mobile.solids`, so it
 * is untakeable until the body is gone — which is `destroy`, 23 updates
 * after the tag, not the tag itself.
 */
export const R6_ITEM_LEDGER = Object.freeze([
    Object.freeze({
        item: 'hasShield',
        where: 'L20 `shield@112,48 {tag 2}`',
        gate: '⚠ L20 has its OWN gates beside L19\'s `bosslock keyType 0 {19,1}`: '
            + '`lock@32,80 {tset 0, tag 1}`, `shieldlocknorm@176,16 {tag 0}` and '
            + '`buttonroom@192,16 {tset 0, tag 4, room -1}`. Unpriced at slice 0.',
        alsoDoes: 'makes the Watcher VISIBLE (`Watcher.update`\'s last line) — '
            + 'render-side only, so it is not a gate on anything the model does.',
    }),
    Object.freeze({
        item: 'bosskey:0',
        where: 'L19 `bosskey@96,64` -> entity (104,72)',
        gate: 'INSIDE the ShieldBoss body box x[80,128) y[40,88). `_attract` false '
            + 'while he lives; takeable only once `destroy` removes the solid.',
        alsoDoes: 'opens `bosslock@48,32 {keyType 0, tag 1}` in the same room.',
    }),
    Object.freeze({
        item: 'fire',
        where: 'L32, spawned by the BobBoss kill `r5-bobboss-fire` already drives',
        gate: 'R5 window 1\'s blocker — the fight RESTARTS on re-entry until '
            + '`hasFire`, so the collect must ride the same visit as the kill.',
        // ⛓⛓ R6 SLICE 5's FIRST RECON JOB, ANSWERED — and the answer is
        // that the debt was half the size the ledger said.
        alsoDoes: '⛔ `R5_ITEM_LEDGER.spawnedButNotCollected` IS A MODEL-SIDE '
            + 'STATEMENT. The GAME already collects it: `r5-bobboss-fire` drives the '
            + 'kill, the walk touches the runtime-spawned `Fire`, and `Fire.removed()` '
            + 'writes `hasFire` plus `{31,29}`. `r5Chain.MODEL_EXEMPT` amends the mirror '
            + 'with `earned: [\'fire\']` and the differential checks `mirror + earned`, '
            + 'so a run that fought and lost goes RED. ⇒ W-fire is claimed from that '
            + 'pair; what remains is the MODEL of the encounter script, deferred by name.',
        modelDebt: 'the BobBoss encounter script — three forms, two 120-frame '
            + 'transitions that teleport the player and clear `receiveInput`, and a '
            + 'reward spawned at runtime that is in no level\'s pickup list. '
            + '`KILL_ARM_POLICY.BobBoss` stays `refused`.',
    }),
]);

// ── THE CREDITS, and why it is an ELIMINATION argument ────────────────

/**
 * ⛔ `Game.menuState` IS `private static` (`Game.as:585`) AND IS NOT IN
 * `botStatus`. §3.1 asks for the credits "witnessed from the game's own
 * reports"; the reachable report is `botStatus.menu`, and the claim is made
 * by ELIMINATING the other writers rather than by reading the state.
 *
 * Every `Game.menu = true` in the game, from a grep of the whole tree:
 */
export const R6_MENU_WRITERS = Object.freeze([
    Object.freeze({
        site: 'Pickups/Seed.as:77',
        what: 'the tree/credits path — `menu = true`, `cutscene[2] = false`, badge 14, '
            + '`new Game(level, currentPlayerPosition, false, 2)`',
        eliminatedBy: null, // ← this is the one we want
    }),
    Object.freeze({
        site: 'Player.as:489',
        what: 'the DARKSUIT "final (bad) scene" death — `getSuit()` returns '
            + '`sprShrumDark` only when `hasDarkSuit`, and the "die"/"dead" anims '
            + 'exist on no other sprite',
        eliminatedBy: 'the window holds no darksuit (assert `items.hasDarkSuit` false)',
    }),
    Object.freeze({
        site: 'NPCs/Oracle.as:120',
        what: 'the Oracle NPC',
        eliminatedBy: 'no Oracle in L113/L114/L115 (assert from the level records)',
    }),
    Object.freeze({
        site: 'Game.as:1281',
        what: '`Input.released(restartKey)` -> `menu = true` + a RESTART world',
        eliminatedBy: 'the tape presses no restart key (assert from the tape\'s spans)',
    }),
    Object.freeze({
        site: 'Game.as:1287',
        what: '`Input.released(escapeKey)` -> `menu = true` + a fresh world',
        eliminatedBy: 'the tape presses no escape key (assert from the tape\'s spans)',
    }),
]);

/**
 * ⛔⛔ AND A MENU IS A REBOOT LOOP, NOT A ROOM.
 *
 * `Game.menuAndRestart()` runs at the TOP of `Game.update` and, while
 * `menu` is true:
 *   · sets `Game.freezeObjects = true` EVERY FRAME — so every menu frame is
 *     a dead frame and a tape's tick counter cannot advance through one;
 *   · treats `Input.released(Key.ANY)` as "leave" —
 *     `menu = false; FP.world = new Game(level, playerPosition…)`;
 *   · pans its own camera and REBOOTS THE WORLD when the pan runs off
 *     (`menuIndex++`, `FP.world = new Game(…)`).
 *
 * ⇒ W-seed's tape must release its last key BEFORE the credits and must END
 * there. The credits claim is a POST-DRIVE `botStatus` read, not a stream
 * assertion — the observation stream ends with the tape.
 */
export const R6_CREDITS_WITNESS = Object.freeze({
    read: 'botStatus.menu === true, after the tape has finished',
    plus: Object.freeze(['level === 115', 'cutscene[2] === false']),
    notAvailable: 'Game.menuState (private static; absent from botStatus)',
    tapeShape: 'the last span must RELEASE before the credits, and the window ENDS '
        + 'there — any later key release collapses the menu and reboots the world',
});

// ── THE WINDOWS ───────────────────────────────────────────────────────

/**
 * The rung's windows, in slice order. `tape` is `null` until the slice that
 * authors it fills it in — and `r6ExitFindings` reports a null as UNCLAIMED
 * rather than skipping it, which is the difference between a rung that is
 * incomplete and one that reads complete because nobody looked.
 */
export const R6_WINDOWS = Object.freeze([
    // ⛓⛓⛓ THE RUNG'S FIRST CLAIMED ROW (slice 4). The pair is the R5
    // hold-pair shape with ONE primitive fewer: the same tape, the tenth
    // `primary` press deleted. ⚠ The control is a PREFIX (490 against 780)
    // rather than an equal — the treatment's own tail is the 240-render
    // white-out and the control has no death to white out.
    Object.freeze({ name: 'W-totem', slice: 4, tape: 'r6-totem-kill', control: 'r6-totem-control' }),
    // ⛓⛓⛓ R6 SLICE 5: THE LADDER'S SECOND BOSS KILL. The pair is the
    // one-primitive-fewer prefix again, and the primitive is the THIRD
    // landing press — which the control drops while keeping the single `up`
    // span byte-identical, because the movement and the treatment come from
    // separate generators (§12's amendment to §3.2).
    Object.freeze({ name: 'W-shield', slice: 5, tape: 'r6-shield-kill', control: 'r6-shield-control' }),
    /**
     * ⛓⛓ AND W-FIRE'S TAPE IS R5's OWN PAIR, WHICH IS THE FINDING.
     *
     * ⛔ `R5_ITEM_LEDGER.spawnedButNotCollected: ['fire']` IS TRUE OF THE
     * MODEL AND FALSE OF THE GAME. `r5-bobboss-fire` drives the whole
     * BobBoss encounter in the recompiled game, `BobBoss.death` spawns
     * `new Fire(...)` at runtime, the walk collects it, and `Fire.removed()`
     * writes `Player.hasFire = true` plus the out-of-band `{31,29}` that
     * `bobBoss.BOB_BOSS_LEDGER` names. `r5Chain.MODEL_EXEMPT` amends the
     * mirror with `earned: ['fire']` and the differential then checks the
     * game against `mirror + earned` — a HARDER assertion than the plain
     * one, and the reason the entry's own `why` says "a run that fought and
     * did not win goes RED here".
     *
     * ⇒ the item is REAL-COLLECTED inside a driven window with a control,
     * which is exactly what §3.1's ledger asks of `fire`, and the row is
     * claimed here rather than left null for a tape that would drive the
     * same fight a second time. **What is still owed is MODEL-SIDE**: the
     * 230-line encounter script (three forms, two 120-frame transitions
     * that teleport the player, a runtime-spawned pickup in no level's
     * list). That is named in `R6_ITEM_LEDGER` and deferred, not claimed.
     */
    Object.freeze({ name: 'W-fire', slice: 5, tape: 'r5-bobboss-fire', control: 'r5-bobboss-fire-control' }),
    Object.freeze({ name: 'W-owl', slice: 6, tape: null, control: null }),
    Object.freeze({ name: 'W-talk', slice: 6, tape: null, control: null }),
    Object.freeze({ name: 'W-door', slice: 6, tape: null, control: null }),
    Object.freeze({ name: 'W-seed', slice: 6, tape: null, control: null }),
    // ⚖ RULED IN by the user at slice 0 (kickoff §6.2). The bloody branch is
    // the cheapest SECOND witness of the seed/reboot machinery: both arms
    // drive `Seed.removeSelf` -> a 200-tick frozen fade -> a GAME-INITIATED
    // `FP.world = new Game(...)`, and they differ only in the trigger and
    // the landing level (L1 with `cutscene[1]` against the credits).
    Object.freeze({ name: 'W-blood', slice: 6, tape: null, control: null }),
]);

// ── THE ANIM CLOCK TABLE, derived rather than restated ────────────────

/**
 * ⛓ Every R6 window derives its tick counts by simulating
 * `Spritemap.update` at the CLAMPED `FP.elapsed`, never by 60 fps frame
 * math. `Engine.as:270` — `MAX_ELAPSED` is the decimal literal 0.0333, not
 * `1/30`, and the difference is not academic: §2.5 of the brief said the
 * tree grow was "≈ 274 ticks", which is the 60 fps reading doubled. It is
 * 138.
 *
 * ⛓⛓ AND `World.update` CALLS `e._graphic.update()` AFTER `e.update()` IN
 * THE SAME PASS AND OUTSIDE THE `e.active` TEST — so an anim advances once
 * per world update whatever the entity's own `update()` decided. That is
 * why `ShieldBoss`'s die animation still runs while its `update()` skips
 * `super.update()`.
 */
export const FP_ELAPSED_CLAMPED = 0.0333;

/**
 * `Spritemap.update`, transcribed. Returns the update index on which the
 * animation's callback fires — its WRAP for a looping anim, its completion
 * for a one-shot.
 *
 * ⚠ SIMULATED, never `frameCount / (frameRate * elapsed)`. Repeated
 * addition of 0.4995 is not the same number as a division, and dividing
 * would assert an arithmetic the game does not do —
 * [[feedback_accumulate_dont_divide_the_fade]], the same law
 * `wandFadeFreezeTicks` and `fallRockFreezeTicks` follow.
 */
export function animCallbackUpdate(frameRate, frameCount) {
    if (!(frameCount > 0)) {
        throw new R6AcceptanceError(`animCallbackUpdate: frameCount must be > 0, got ${frameCount}`);
    }
    const step = frameRate * FP_ELAPSED_CLAMPED;
    // ⛓ frameRate 0 is a REAL CASE, not a guard: `ShieldBoss`'s "sit" is
    // `add("sit", [0])` with the default frameRate 0, so its `_timer` never
    // moves and `endAnim` can never fire from it. Infinity is the honest
    // answer, and a caller that treats it as a tick count will say so.
    if (step === 0) return Infinity;
    let timer = 0;
    let index = 0;
    for (let update = 1; update <= 100000; update++) {
        timer += step;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index === frameCount) return update;
        }
    }
    throw new R6AcceptanceError(
        `animCallbackUpdate: ${frameCount} frames at ${frameRate}/s did not wrap`);
}

/** The R6 roster's anim clocks, each with its AS3 `add()` call. */
export const R6_ANIM_CLOCKS = Object.freeze([
    Object.freeze({ owner: 'Player', anim: 'wand', frameRate: 20, frames: 5, expect: 8 }),
    Object.freeze({ owner: 'ShieldBoss', anim: 'moveShield', frameRate: 15, frames: 2, expect: 5 }),
    Object.freeze({ owner: 'ShieldBoss', anim: 'movedShield', frameRate: 2, frames: 1, expect: 16 }),
    Object.freeze({ owner: 'ShieldBoss', anim: 'stab', frameRate: 15, frames: 6, expect: 13 }),
    Object.freeze({ owner: 'ShieldBoss', anim: 'die', frameRate: 15, frames: 11, expect: 23 }),
    Object.freeze({ owner: 'ShieldBoss', anim: 'sit', frameRate: 0, frames: 1, expect: Infinity }),
    Object.freeze({ owner: 'FinalBoss', anim: 'die', frameRate: 5, frames: 8, expect: 49 }),
    Object.freeze({ owner: 'FinalBoss', anim: 'dead', frameRate: 1, frames: 2, expect: 61 }),
    Object.freeze({ owner: 'FinalBoss', anim: 'walk', frameRate: 15, frames: 4, expect: 9 }),
    Object.freeze({ owner: 'FinalDoor', anim: 'open', frameRate: 15, frames: 28, expect: 57 }),
    Object.freeze({ owner: 'Seed', anim: 'grow', frameRate: 3.5, frames: 16, expect: 138 }),
    Object.freeze({ owner: 'Explosion', anim: 'explode', frameRate: 20, frames: 8, expect: 13 }),
    // ⛓ R6 SLICE 2: §8.2's last row, split into its two anims, plus the
    // lock's. Each is DERIVED again in its own module (`wandShot`,
    // `magicalLock`) and the two derivations are asserted equal there —
    // one table, two computations, the "two cost models must agree" law.
    Object.freeze({ owner: 'WandShot', anim: 'flare', frameRate: 5, frames: 3, expect: 19 }),
    Object.freeze({ owner: 'WandShot', anim: 'die', frameRate: 20, frames: 3, expect: 5 }),
    Object.freeze({ owner: 'MagicalLock', anim: 'destroy', frameRate: 15, frames: 7, expect: 15 }),
]);

// ── THE RNG POSTURE ───────────────────────────────────────────────────

/**
 * ⛔⛔⛔ THE RENDER-SIDE DRAW SITES, EXHAUSTIVELY — there are three.
 *
 * The Owl is the arc's first fight with real gameplay RNG, and the brief
 * (§2.6) opened a "witnessed-not-exact" hatch for it on the grounds that
 * stream POSITION is render-coupled while render cadence varies run to run
 * (which the dead-frame band proves). **The hatch is not needed**, and the
 * reason is one reclassification: `Game.shake`'s two `Math.random()` draws
 * are in `view()`, and `Game.update` calls `view()` (`Game.as:822`). They
 * are UPDATE-side.
 *
 * Everything else that draws — `Chest.open`'s seal identity, `Enemy`'s ctor
 * PAIR (`coins` and `fallSpinSpeed`'s `FP.choose`, two not one),
 * `Tile`'s ctor triple, `Music.playSound`'s do-while roll, the Owl's
 * rockfall and grenade draws, `RockFall`'s THREE ctor draws, DustParticle,
 * rain, `Explosion`'s angle — is update-side or construction-side, and
 * construction count is itself update-determined.
 *
 * ⇒ a room with none of these three sites has a draw stream whose POSITION
 * is a pure function of the update stream, which the differential already
 * proves byte-exact. **L112 has none of them.**
 */
export const RENDER_SIDE_DRAW_SITES = Object.freeze([
    Object.freeze({
        site: 'Enemies/BossTotem.as:587-588',
        draws: 2,
        per: 'render',
        where: 'level 43 only (one instance in the game)',
        note: '⛓ UNCONDITIONAL for as long as he exists — but `rumble` is '
            + '`(1 - cos(rumblingTime/240 * 2PI))/2` and `rumblingTime` reaches 0 at '
            + 'A+240 while the FIGHT starts at A+335, so during the fight both terms '
            + 'are multiplied by ZERO. It moves the stream and contributes nothing to '
            + '`headPos`.',
    }),
    Object.freeze({
        site: 'Enemies/LavaBoss.as:184',
        draws: 1,
        per: 'render',
        where: 'level 82 — DEFERRED by name this rung',
    }),
    Object.freeze({
        site: 'Scenery/Tile.as:309',
        draws: 2,
        per: 'render',
        where: '`case 25` waterfall tiles with `spray && _em`',
    }),
]);

/**
 * ⛓ THE GAMEPLAY CONSUMERS — draws whose VALUE changes what happens, as
 * against the many whose value is cosmetic and whose only effect is to move
 * the stream.
 *
 * ⛔ THE DISTINCTION IS THE WHOLE INSTRUMENT. A room with a render-coupled
 * polluter and no consumer is harmless (nothing reads the shifted stream);
 * a room with a consumer and no polluter is exact (the position is
 * update-determined). Only a room with BOTH is at risk, and the census
 * below is what tells them apart.
 *
 * ⚠ `Chest.open`'s seal-identity draw is deliberately NOT here. It is
 * rejection-sampled and gameplay-inert beyond the readout — the ending gate
 * only checks "last slot filled" — so it is a POLLUTER, not a consumer.
 */
export const GAMEPLAY_DRAW_CONSUMERS = Object.freeze({
    finalboss: 'FinalBoss.as:142-144,158 — the rockfall spawn decision (1 draw/tick), '
        + 'its aim (2 draws/spawn) and the grenade decision (1 draw/tick while walking)',
    tentaclebeast: 'TentacleBeast.as:138-168 — spawn placement, up to 202 draws/frame '
        + 'in the whirlpool loop (DEFERRED by name this rung)',
    lightboss: 'LightBoss.as:67 — `if (!Math.floor(Math.random() * 90))` (DEFERRED)',
});

/**
 * A level's RNG posture: is a window in this room exactly reproducible?
 *
 * ⚠ THIS IS A CLAIM ABOUT THE ROOM, NOT ABOUT THE RUN. It says whether the
 * stream can be perturbed in a way anything reads; it does NOT say the
 * update stream is byte-exact, which is what a recorded window shows.
 *
 * ⚠ And it carries one standing precondition it cannot check from a level
 * record: `Game.shake` is a `public static` that survives world swaps and
 * decays inside `view()`, which runs BELOW the `blackCover` gate — so a
 * window that begins with `shake > 0` drains it across a fade whose length
 * varies run to run. Every tape gets a fresh page, so `shake` starts at its
 * static initialiser 0; with `noDamage` on and no shake writer in the room
 * it stays there. Three facts, each assertable, none of them checked here.
 *
 * @param {object} levelRecord the atlas record
 * @param {number[]} tileTypes every tile type present in the level
 */
export function rngPostureOf(levelRecord, tileTypes) {
    const types = new Set((levelRecord?.entities ?? []).map((e) => e.type));
    const renderCoupled = [];
    if (types.has('bosstotem')) renderCoupled.push('BossTotem.render draws 2 per render');
    if (types.has('lavaboss')) renderCoupled.push('LavaBoss.render draws 1 per render');
    if ((tileTypes ?? []).includes(25)) {
        renderCoupled.push('Tile.render\'s waterfall spray draws 2 per render (t=25)');
    }
    const consumers = Object.keys(GAMEPLAY_DRAW_CONSUMERS).filter((k) => types.has(k));
    return {
        renderCoupled,
        consumers,
        // ⛓ EXACT unless BOTH halves are present. L43 has a polluter and no
        // consumer; L112 has a consumer and no polluter; L115 has a polluter
        // (four waterfall tiles) and no consumer. None of the three is at
        // risk, and the reasons are different in each case.
        exact: !(renderCoupled.length > 0 && consumers.length > 0),
        why: renderCoupled.length && consumers.length
            ? `AT RISK: ${renderCoupled.join('; ')} against consumer(s) ${consumers.join(', ')}`
            : renderCoupled.length
                ? `polluter only, nothing reads it: ${renderCoupled.join('; ')}`
                : consumers.length
                    ? `consumer only, position is update-determined: ${consumers.join(', ')}`
                    : 'no draw site of either kind',
    };
}

// ── THE EXIT CRITERIA, derived ────────────────────────────────────────

/** Does the roster contain this tape? */
const inRoster = (name, roster) => Boolean(name) && roster.includes(name);

/**
 * The rung's exit criteria, computed from the roster at call time.
 *
 * ⛔ NO COUNT IS STORED. `total` is `R6_BOSS_KILL_LEDGER.length`, `claimed`
 * is counted from the windows that actually name a tape the roster has, and
 * `declaringNoDamage` is counted from the tapes themselves. R5's close
 * named two hand-kept counts that had rotted; this is the fix.
 *
 * @param {string[]} [roster] defaults to `fixtureNames()`
 */
export function r6ExitCriteria(roster = fixtureNames()) {
    const byWindow = new Map(R6_WINDOWS.map((w) => [w.name, w]));
    const ledger = R6_BOSS_KILL_LEDGER.map((row) => {
        const w = byWindow.get(row.earnedIn);
        const tape = w?.tape ?? null;
        const control = w?.control ?? null;
        return {
            ...row,
            window: row.earnedIn,
            tape,
            control,
            // ⛔ A ledger row is CLAIMED only when its window names BOTH arms
            // and the roster has both. "Every opened-blocker claim is a
            // PAIR" is the standing law; a row with a drive and no control
            // is an unclaimed row that looks claimed.
            claimed: inRoster(tape, roster) && inRoster(control, roster),
        };
    });
    const windows = R6_WINDOWS.map((w) => ({
        ...w,
        claimed: inRoster(w.tape, roster) && inRoster(w.control, roster),
    }));
    const noDamageTapes = roster.filter((n) => loadTape(n).noDamage === true);
    return {
        rosterSize: roster.length,
        ledger,
        ledgerTotal: ledger.length,
        ledgerClaimed: ledger.filter((r) => r.claimed).length,
        windows,
        windowsTotal: windows.length,
        windowsClaimed: windows.filter((w) => w.claimed).length,
        items: R6_ITEM_LEDGER,
        credits: R6_CREDITS_WITNESS,
        // Derived, never hand-kept — the §38.4 rot lesson made mechanical.
        tapesDeclaringNoDamage: noDamageTapes.length,
        tapesNotDeclaringNoDamage: roster.length - noDamageTapes.length,
    };
}

/**
 * The gate's findings, as `{name, ok, detail}` rows.
 *
 * ⚠ An UNCLAIMED row is `ok: false` with a detail that says which arm is
 * missing. It is not skipped and it is not "pending" — a rung is not at its
 * exit until every row is claimed, and a gate that reported "0 of 6, all
 * green" would be the failure this ledger exists to prevent.
 */
export function r6ExitFindings(roster = fixtureNames()) {
    const c = r6ExitCriteria(roster);
    const out = [];
    for (const row of c.ledger) {
        const flag = `{${row.flag.level},${row.flag.tag}}`;
        out.push({
            name: `${flag} (${row.boss}) is earned in a driven window with a pair`,
            ok: row.claimed,
            detail: row.claimed
                ? `window ${row.window}: ${row.tape} / ${row.control}`
                : `UNCLAIMED — window ${row.window} names `
                    + `tape=${row.tape ?? 'null'} control=${row.control ?? 'null'}`,
        });
    }
    out.push({
        name: 'the boss-kill ledger is complete',
        ok: c.ledgerClaimed === c.ledgerTotal,
        detail: `${c.ledgerClaimed}/${c.ledgerTotal} tags earned `
            + `(over ${c.rosterSize} tapes)`,
    });
    out.push({
        name: 'every R6 window has both arms in the roster',
        ok: c.windowsClaimed === c.windowsTotal,
        detail: `${c.windowsClaimed}/${c.windowsTotal} — unclaimed: `
            + `${c.windows.filter((w) => !w.claimed).map((w) => w.name).join(', ') || '(none)'}`,
    });
    return out;
}

// ── THE AS3 DECISION ──────────────────────────────────────────────────

/**
 * ⚖ ZERO AS3 THIS RUNG, finalized at slice 0 per kickoff §1.6.
 *
 * The v6 batch is banked and unconsumed, and a new batch needs a NAMED WALL
 * plus a failed zero-build witness. Two surfaces were found that a batch
 * would improve; neither is a wall, and the difference is recorded rather
 * than glossed:
 */
export const R6_AS3_DECISION = Object.freeze({
    batches: 0,
    wanted: Object.freeze([
        Object.freeze({
            surface: '`Pod` state in `botMobiles()`',
            found: 'R6 slice 0 — L112\'s whole `botMobiles()` roster is `FinalBoss, '
                + 'Player`. The readout walks `Mobile` subclasses and `Pod`, '
                + '`PlantTorch` and `RockLock` are not Mobiles, so the Owl fight\'s '
                + 'pod open/closed state is invisible to the game side.',
            whyNotAWall: 'the rung\'s headline is the PERSISTENCE LEDGER, which is '
                + 'already readable, and the Owl\'s own row (position, hits) is in '
                + '`botMobiles()`. The pods are a modelling convenience.',
        }),
        Object.freeze({
            surface: '`Game.menuState` on `botStatus`',
            found: 'R6 slice 0 — it is `private static` (`Game.as:585`), so §3.1\'s '
                + '"the credits state (menuState 2) witnessed" cannot be read '
                + 'directly.',
            whyNotAWall: '`R6_MENU_WRITERS` eliminates the other four writers from a '
                + 'W-seed window, so `botStatus.menu === true` is a sound witness — '
                + 'weaker in form, identical in what it establishes.',
        }),
        // ⛓⛓ R6 SLICE 5, and it is the sharpest wanted-not-wall yet: the
        // surface would have SAVED A RECORDING.
        Object.freeze({
            surface: '`ShieldBoss.activated` (and the slash\'s live hit count)',
            found: 'R6 slice 5 — `activated` is a `private var` and nothing in '
                + '`botStatus` or `botMobiles()` reports it, so the model\'s claim '
                + '"the first hit of every entry is swallowed" could only be checked '
                + 'by its CONSEQUENCE. It was checked that way and it was WRONG: one '
                + 'press is five hit tests (`slashDelayMax` is 0), so the arming press '
                + 'armed him on test 1 and made him retaliate on test 2, and the '
                + 'divergence surfaced 13 ticks later as a knockback in the recording.',
            whyNotAWall: 'the consequence IS readable and it did the job — the game\'s '
                + 'own `hits` went to 1 where the model said 0, and the stream showed '
                + 'the shove. A readout would have named the cause instead of the '
                + 'symptom and saved one 60-second recording; it would not have changed '
                + 'the verdict. ⚠ The batch is ruled ZERO (§8.17) and this stays wanted.',
        }),
    ]),
    stillOwed: Object.freeze([
        '`saw_auto_advance` unification — owed since R3, not byte-inert, so it '
        + 'waits for a batch that re-records (R5 §38.4 item 3, carried).',
    ]),
});
