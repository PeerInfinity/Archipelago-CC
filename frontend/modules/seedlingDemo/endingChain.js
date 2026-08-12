/**
 * seedlingDemo/endingChain — THE ENDING, TRANSCRIBED: a placed NPC's
 * dialogue, the door's two-arm approach, and a Seed with three terminal
 * branches and two reboots.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6b. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §§14.5–14.9, with §15.14
 * as the correction list.
 *
 * ── WHY THIS IS NOT `dialogue.js` ─────────────────────────────────────
 *
 * `dialogue.js` models the ceremony a PICKUP runs: a temporary NPC that is
 * born already `talking`, with no radius, no key to start it, and no life
 * after its last page. Every one of those four is different for a PLACED
 * NPC, and three of them are load-bearing here:
 *
 *   · **it has a radius** — `FP.distance(x, y, p.x, p.y) <= talkRange`,
 *     an origin-to-origin CIRCLE of 24 px, re-evaluated every frame;
 *   · **leaving the radius ENDS the dialogue** (`NPC.talk`'s `else` arm
 *     sets `talked = false` and `talking = false`), so a stance that
 *     drifts out mid-page restarts the whole thing from page 0;
 *   · **`doneTalking()` is a real override** — for the Watcher it is the
 *     `{114,0}` write, which is the window's whole claim;
 *   · and the start needs no key at all, because `keyNeeded` is
 *     `!Game.checkPersistence(tag)` and a fresh boot's persistence is all
 *     `true`. A Watcher AUTO-TALKS on proximity.
 *
 * The two share `stepDialogue`'s per-frame typing arithmetic and nothing
 * else, so that is imported and the rest is here.
 *
 * ── ⛔⛔ THE TICK/FRAME SPLIT, AND THE LINE THAT DECIDES IT ────────────
 *
 * Three freezes appear in this chain and they cost the tape different
 * things, which is the single most expensive thing to get wrong:
 *
 * ```
 *   Game.update:  … super.update()  …  if (canInventory()) inventory.update()
 *                                      else if (inventory) inventory.open = false
 * ```
 *
 * `canInventory()` is `inventory && !talking && p && p.receiveInput &&
 * !p.destroy` (`Game.as:1494`) and `Inventory.set open` is
 * `Game.freezeObjects = _open = _o` (`Inventory.as:153`). ⇒ **while
 * `Game.talking` is true, the ELSE arm clears the freeze at the end of
 * every frame** — so a DIALOGUE frame is raised inside `World.update` and
 * lowered before the next frame's dead-frame gate reads it, and the tape's
 * tick counter runs. A freeze raised by anything that does NOT set
 * `Game.talking` — a `SealController`, a `Pickup`'s phase A, a `Seed`'s
 * cover fade — is never lowered, and those frames are DEAD.
 *
 * That is the mechanism `dialogue.js`'s docblock describes as "a sticky
 * static with several writers and no per-frame reset" without naming; it
 * is named here because this rung has to predict BOTH kinds in one window.
 */

import { INITIAL_FRAMES_THIS_CHARACTER, beginDialogue, stepDialogue } from './dialogue.js';
// ⛓ From the browser-safe half: `r6Acceptance` reaches `node:fs` and the
// live run needs this module in a browser (editor arc slice 1).
import { animCallbackUpdate } from './r6AnimClock.js';

export class EndingError extends Error {
    constructor(message) { super(message); this.name = 'EndingError'; }
}
const fail = (m) => { throw new EndingError(m); };

// ── the placed NPC ────────────────────────────────────────────────────

/** `NPCs/NPC.as:27` — the talk radius, an origin-to-origin CIRCLE. */
export const TALK_RANGE = 24;

/** `NPCs/NPC.as:45` — a placed NPC's default `_lineLength`. */
export const NPC_LINE_LENGTH = 28;

/**
 * `Watcher`'s own constants (`NPCs/Watcher.as:20-30,46-49`).
 *
 * ⛓ `talkingSpeed` is the `frames` ATTRIBUTE, not a class constant:
 * `Game.as:2237` is `new Watcher(o.@x, o.@y, o.@tag, o.@text, o.@text1,
 * o.@frames)` and the sixth parameter is `_talkingSpeed`. L114's watcher
 * declares `frames="3"`. Taking the class default (0) instead would type
 * the whole 20-page dialogue at one character per frame and every page
 * boundary would land somewhere else.
 */
export const WATCHER = Object.freeze({
    /** `super(_x + Tile.w/2, _y + Tile.h/2)` — `NPCs/NPC.as:47`. */
    ctor: Object.freeze({ dx: 8, dy: 8 }),
    /** `setHitbox(16, 16, 8, 8)` — `Watcher.as:49`. */
    box: Object.freeze({ w: 16, h: 16, originX: 8, originY: 8 }),
    type: 'Watcher',
    /** The seed is held out while `myCurrentText` is in this CLOSED range. */
    seedIndexMin: 9,
    seedIndexMax: 19,
    /** `dieFrames` is `[7, 8, 9]`, and the trigger is `hits > length`. */
    dieFrames: 3,
    /** `Watcher.hit()` — `hitsTimer = hitsTimerMax` on a landing. */
    hitsTimerMax: 25,
    src: 'NPCs/Watcher.as:20-30,40-49,60-124,127-137',
});

/**
 * ⛔⛔⛔ THE LIVE SEED THE WATCHER HOLDS OUT — A RUN-ENDER, NOT A PICKUP.
 *
 * `Watcher.update:68-74` adds `new Seed(x - 18, y - 8, false)` while the
 * dialogue index is in `[9, 19]`, and `destroySilently()`s it outside that
 * range. For `watcher@72,72` the arithmetic is:
 *
 * ```
 *   NPC entity      (72 + 8, 72 + 8)          = (80, 80)
 *   Seed placement  (80 - 18, 80 - 8)         = (62, 72)
 *   Seed entity     +(Tile.w/2, Tile.h/2)     = (70, 80)
 *   setHitbox(10, 14, 5, 7)                   ⇒ [65,75) x [73,87)
 * ```
 *
 * ⛔ COLLECTING IT IS NOT A LOST PICKUP, IT IS A SOFT-LOCK. That Seed is
 * `bloody = false, tree = false`, so it takes `Seed.update`'s `else` arm:
 * `Game.cutscene[2] = true` and a reboot into the SAME level — which is
 * L114, which has no `seed` object, so nothing ever grows and nothing ever
 * clears the flag. And `Game.as:956`'s `cutscene[2]` arm then spawns the
 * player `receiveInput = false; visible = false; active = false` in EVERY
 * later `Game`. The player is inert for the rest of the page, and the
 * symptom is indistinguishable from a dead bot.
 *
 * ⛓ The one thing making the stance survivable at all is that `Seed`'s
 * ctor passes `_attract = false` (`Seed.as:31`), so it does not reach for
 * the player: collection is pure overlap. A stance that clears the box
 * clears it for ever.
 * → [[feedback_a_stray_pickup_soft_locks_the_run]]
 */
export function watcherSeedBox(watcherOel) {
    const nx = watcherOel.x + WATCHER.ctor.dx;
    const ny = watcherOel.y + WATCHER.ctor.dy;
    // `new Seed(x - 18, y - 8, false)` then `super(_x + Tile.w/2, _y + Tile.h/2)`.
    const sx = (nx - 18) + 8;
    const sy = (ny - 8) + 8;
    // `setHitbox(10, 14, 5, 7)` — Seed.as:36.
    return { x: sx - 5, y: sy - 7, right: sx - 5 + 10, bottom: sy - 7 + 14 };
}

/** Does a player box overlap the Watcher's live Seed? */
export function boxHitsWatcherSeed(box, watcherOel) {
    const s = watcherSeedBox(watcherOel);
    return box.right > s.x && box.x < s.right && box.bottom > s.y && box.y < s.bottom;
}

/**
 * Is the player inside a placed NPC's talk circle?
 *
 * ⚠ A CIRCLE, and `FP.distance` is `Math.sqrt(dx*dx + dy*dy)` on ENTITY
 * positions — not the player's box, and not the NPC's. `levelWorld`'s
 * `watcher` hazard rect is the circle's bounding SQUARE, which is the safe
 * over-approximation for routing and the wrong test for a schedule.
 */
export function inTalkRange(npcEntity, player, range = TALK_RANGE) {
    const dx = npcEntity.x - player.x;
    const dy = npcEntity.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) <= range;
}

/**
 * Begin a PLACED NPC's dialogue — `NPC.startTalking()` + the `talking`
 * setter.
 *
 * ⚠ THE STARTING RELEASE DOES NOT ALSO ADVANCE A PAGE. `NPC.talk()` tests
 * `if (talking)` BEFORE it tests `if (inRange) … startTalking()`, so on the
 * frame the dialogue opens the advance arm has already been skipped. A
 * model that let one release do both would finish every dialogue one page
 * early — and for the Watcher that is the difference between the seed
 * window opening at index 9 and at index 8.
 */
export function beginNpcDialogue(text, {
    talkingSpeed,
    lineLength = NPC_LINE_LENGTH,
    framesThisCharacter = INITIAL_FRAMES_THIS_CHARACTER,
} = {}) {
    if (!Number.isFinite(talkingSpeed)) {
        fail('beginNpcDialogue: `talkingSpeed` is the NPC\'s own `frames` ATTRIBUTE '
            + '(Game.as:2237 passes `o.@frames` as `_talkingSpeed`), not a class '
            + 'default — pass it from the level record');
    }
    return beginDialogue(text, {
        framesThisCharacter, framesPerCharacter: talkingSpeed, lineLength,
    });
}

/**
 * One frame of a placed NPC's dialogue, INCLUDING the radius test.
 *
 * @param {object} d       a `beginNpcDialogue` state, MUTATED
 * @param {boolean} released did the tape release X this frame?
 * @param {boolean} inRange is the player inside the circle this frame?
 * @returns {{left: boolean}} `left` means the radius test ended it
 *
 * ⛔ THE ORDER IS THE GAME'S: the advance arm runs FIRST, and the radius
 * `else` runs after it. So a release on the frame the player leaves still
 * advances the page it was going to advance — and the dialogue is torn down
 * afterwards. Getting that backwards loses a page on every exit.
 */
export function stepNpcDialogue(d, released, inRange) {
    if (d.done) return { left: false };
    stepDialogue(d, released);
    if (d.done) return { left: false };
    if (!inRange) {
        // `talked = false; if (talking) talking = false;` — the setter runs
        // `myCurrentText = 0` and `doneTalking()`. ⛔ SO LEAVING THE RADIUS
        // CALLS `doneTalking()` TOO: for the Watcher that is the `{114,0}`
        // write, guarded by `checkPersistence(tag)` — which is still SET, so
        // **walking away mid-dialogue clears the tag exactly as finishing it
        // does**. Named here because it is the opposite of what "leaving
        // cancels it" suggests, and a window that relies on the tag must not
        // rely on having read the text.
        d.page = 0;
        d.currentCharacter = 0;
        d.done = true;
        return { left: true };
    }
    return { left: false };
}

// ── the door ──────────────────────────────────────────────────────────

/**
 * `Scenery/FinalDoor.as`, transcribed. §8.7 confirmed, §14.9's clock taken.
 *
 * ⛓ `finaldoor@112,0` is `super(_x + Tile.w, _y + Tile.h)` — a WHOLE tile,
 * not the half every other class uses — so the entity is **(128, 16)** and
 * `setHitbox(32, 32, 16, 16)` makes the body `[112,144) x [0,32)`. Getting
 * the half-tile here puts the door and its radius eight pixels north-west
 * of where they are.
 */
/**
 * ⛓⛓ THE ONE CROSS-LEVEL PERSISTENCE READ IN THE GAME.
 *
 * `FinalDoor.as:50` is `!Game.checkPersistence(0, 114)` and its own comment
 * says why: *"0 is the tag for the Watcher's text, while 114 is the room
 * that it refers to."* So the flag that decides whether the ending opens is
 * read from L113 and written in L114, under a tag indistinguishable from
 * every other NPC dialogue flag. Named here rather than inlined, because a
 * bare `(0, 114)` at a call site reads as a typo for `(114, 0)`.
 *
 * ⚠ `levelWorld.UNTOUCHABLE_CLEARS` carries the same pair for the OPPOSITE
 * purpose — it is what a DERIVED clear list may never offer. A tape may
 * still declare it, and W-door's boot does.
 */
export const WATCHER_FLAG = Object.freeze({ level: 114, tag: 0 });

export const FINAL_DOOR = Object.freeze({
    ctor: Object.freeze({ dx: 16, dy: 16, src: 'FinalDoor.as:23 `super(_x + Tile.w, _y + Tile.h)`' }),
    box: Object.freeze({ w: 32, h: 32, originX: 16, originY: 16 }),
    type: 'Solid',
    /** `FP.distance(x, y, p.x, p.y) <= 32` — an origin-to-origin CIRCLE. */
    seeDistance: 32,
    /** `sprFinalDoor.add("open", […28 frames…], 15)`. */
    openFrames: 28,
    openFrameRate: 15,
    src: 'Scenery/FinalDoor.as:17-30,41-45,47-68,79-88',
});

/** How many updates the door's `open` animation takes to reach `animEnd`. */
export function finalDoorOpenUpdates() {
    return animCallbackUpdate(FINAL_DOOR.openFrameRate, FINAL_DOOR.openFrames);
}

/**
 * ⛓⛓ THE DOOR'S TWO ARMS, AS A STATE MACHINE — and §8.7's correction is
 * that they are ONE APPROACH, not two.
 *
 * ```
 *   in radius && !seenSeal   ->  seenSeal = true; spawn a SealController
 *   in radius &&  seenSeal
 *              && !mySealController
 *              && hasAllSealParts && talkedToWatcher  ->  play("open")
 *   out of radius            ->  seenSeal = false
 * ```
 *
 * `SealController.removed()` nulls `parent.mySealController` (`:219`), so
 * the second arm becomes reachable on a LATER TICK OF THE SAME APPROACH —
 * and the door is an `Entity` with no freeze gate, so its `update()` has
 * been running throughout the ceremony's 180 frozen frames waiting for
 * exactly that. §2.5's "the door only opens on a LATER approach" is wrong;
 * what IS true is that leaving the radius resets `seenSeal`, so every
 * RE-approach fires a fresh ceremony.
 *
 * @returns {{event: string|null, state: object}}
 */
export function stepFinalDoor(state, { inRadius, sealControllerUp, hasAllSealParts,
    talkedToWatcher }) {
    if (state.opening) {
        const next = { ...state, openUpdates: state.openUpdates + 1 };
        if (next.openUpdates >= finalDoorOpenUpdates()) {
            // `animEnd` -> `FP.world.remove(this)` -> `removed()` ->
            // `Game.setPersistence(tag, false)`. ⛔ A CLEAR, like every other
            // tag on this rung's ledger.
            return { event: 'removed', state: { ...next, opening: false, removed: true } };
        }
        return { event: null, state: next };
    }
    if (state.removed) return { event: null, state };
    if (!inRadius) return { event: null, state: { ...state, seenSeal: false } };
    if (!state.seenSeal) {
        return { event: 'ceremony', state: { ...state, seenSeal: true } };
    }
    if (!sealControllerUp && hasAllSealParts && talkedToWatcher) {
        // ⛔ ONE, NOT ZERO — the play frame IS the animation's first update.
        // `World.update` is `while (e) { if (e.active) e.update(); if
        // (e._graphic) e._graphic.update(); e = e._updateNext; }`, so the
        // very pass that runs `sprFinalDoor.play("open")` inside `update()`
        // advances the Spritemap immediately afterwards. Starting the count
        // at 0 puts `animEnd` — and with it the `{113,0}` CLEAR and the
        // moment the wall stops colliding — one tick late.
        // ⛓ R6 slice 6c corrected this from 0 when the door was first
        // driven; the same fencepost R6 slice 4 found in `updateLists()`,
        // one pass earlier in the frame.
        return { event: 'open', state: { ...state, opening: true, openUpdates: 1 } };
    }
    return { event: null, state };
}

/** A fresh door, as `check()` leaves it. */
export const freshFinalDoor = () => ({
    seenSeal: false, opening: false, openUpdates: 0, removed: false,
});

// ── the seed ──────────────────────────────────────────────────────────

/** `Pickups/Seed.as:21-22` — the cover fade's rate, and its accumulation. */
export const COVER_ALPHA_RATE = 0.005;

/**
 * ⛓ HOW MANY FRAMES THE COVER FADE TAKES, by ACCUMULATION.
 *
 * `coverAlpha += 0.005` until `>= 1`. ⚠ **THIS IS A BOUNDED VACUITY AND IT
 * IS RECORDED AS ONE**: the accumulation reaches `1.0000000000000007` on
 * increment 200 (199 gives 0.995) and the naive `1 / 0.005` is exactly 200
 * too, so the accumulate-don't-divide law does not bite here. Record the
 * non-biter with its witness; do NOT conclude the law is optional — the
 * tree grow is the same shape and there the two answers are 138 and 274.
 */
export function coverFadeFrames() {
    let a = 0;
    for (let n = 1; n <= 100000; n += 1) {
        a += COVER_ALPHA_RATE;
        if (a >= 1) return n;
    }
    return fail('coverFadeFrames: the cover never reached 1');
}

/**
 * `Pickups/Seed.as:46` — `add("grow", [16 frames], 3.5)`.
 * ⚠ 138 at the clamped `FP.elapsed`, and 274 at 60 fps. The brief said
 * "≈274"; that is the 60 fps reading of a 30 fps game.
 */
export const TREE_GROW_FRAME_RATE = 3.5;
export const TREE_GROW_FRAMES = 16;
export function treeGrowUpdates() {
    return animCallbackUpdate(TREE_GROW_FRAME_RATE, TREE_GROW_FRAMES);
}

/**
 * ⛔⛔⛔ `Seed.update`'s THREE TERMINAL ARMS — and §3.5 named one of them.
 *
 * ```as3
 *   if (coverAlpha >= 1) {
 *       if (bloody)    { Game.cutscene[1] = true;  FP.world = new Game(1, 64, 96, false); }
 *       else if (tree) { Game.menu = true; Game.cutscene[2] = false;
 *                        Main.unlockMedal(Main.badges[14]);
 *                        FP.world = new Game(level, currentPlayerPosition, false, 2); }
 *       else           { Game.cutscene[2] = true;
 *                        FP.world = new Game(level, currentPlayerPosition); }
 *   }
 * ```
 *
 * ⛓⛓⛓ AND `Game.as:2194` IS WHAT TURNS A SEED INTO THE TREE:
 * `add(new Seed(o.@x, o.@y, false, o.@text, cutscene[2]))` — the fifth ctor
 * argument `_tree` **is `cutscene[2]`**. So the plain arm's reboot is what
 * arms the tree arm, and the two are one chain rather than two options.
 */
export const SEED_ARMS = Object.freeze({
    bloody: Object.freeze({
        sets: 'Game.cutscene[1] = true',
        reboot: Object.freeze({ level: 1, x: 64, y: 96 }),
        why: '⛔ L1 holds `oracle@64,32`, and `Oracle.doneTalking` under `cutscene[1]` '
            + 'calls `exitToMenu()` — so THIS BRANCH ENDS IN A MENU TOO. §2.5\'s "no '
            + 'credits, no menu" is refuted by the destination room\'s own contents.',
    }),
    tree: Object.freeze({
        sets: 'Game.menu = true; Game.cutscene[2] = false; badge 14',
        reboot: 'the SAME level, at `currentPlayerPosition`, with menuIndex 2',
        why: '⛓⛓⛓ THE CREDITS. `menuIndex` 2 is the value `botStatus.menu_state` '
            + 'reports directly since slice 6a — the ladder\'s first "the game says it '
            + 'was beaten".',
    }),
    plain: Object.freeze({
        sets: 'Game.cutscene[2] = true',
        reboot: 'the SAME level, at `currentPlayerPosition`',
        why: '⛔ THE ARM §3.5 OMITTED, and L115\'s pickup takes it. It is benign ONLY '
            + 'because L115 has a `seed` object for the reboot to rebuild with '
            + '`_tree = true`. Taking the WATCHER\'s seed runs the same arm into L114, '
            + 'which has none — and `Game.as:956` then spawns every later player '
            + 'input-dead. Same arm, opposite outcome, decided by the destination.',
    }),
});

/**
 * ⛓⛓ THE WHOLE W-SEED CEREMONY, IN FRAMES — and every one of them is DEAD.
 *
 * ```
 *   150   `Pickup.specialTimer`                      frozen, no Game.talking
 *   N     the 3-line text NPC                        Game.talking ⇒ TAPE TICKS
 *   200   `removeSelf` -> drawCover fade             frozen
 *   ---- REBOOT 1: cutscene[2] = true, same level, the seed rebuilt as the tree
 *   138   `sprTreeGrow.play("grow")`                 frozen (Game.as:956)
 *   200   `endAnim` -> drawCover fade                frozen
 *   ---- REBOOT 2: menu = true, badge 14, menuIndex 2 — THE CREDITS
 * ```
 *
 * ⛔⛔ BOTH 200-FRAME FADES ARE *FROZEN* FRAMES, NOT TICKS. `removeSelf()`
 * sets `Game.freezeObjects = true` and `Seed.update`'s `drawCover` arm sits
 * ABOVE every freeze gate, so the fade advances while the world is frozen
 * and `Game.talking` is false — nothing lowers the flag. §2.5's "200-tick
 * cover fade" is a FRAME count.
 *
 * ⇒ a recording deadline scaled from the TICK count looks at a window that
 * spends ~690 engine frames and reads it as a dead bot. `deadlineFor` must
 * scale from `frozenFramesOwed` (§12.14a).
 */
export const SEED_CEREMONY_FRAMES = Object.freeze({
    specialTimer: 150,
    get fade() { return coverFadeFrames(); },
    get treeGrow() { return treeGrowUpdates(); },
    /** Everything but the dialogue, which depends on its own text. */
    get frozenTotal() { return this.specialTimer + this.fade + this.treeGrow + this.fade; },
    reboots: 2,
});

// ── the BLOODY branch (R6 slice 6d) ───────────────────────────────────

/**
 * `Watcher.as:98` — the text the runtime-spawned bloody `Seed` carries,
 * verbatim.
 *
 * ⚠ IT IS A CONSTRUCTOR LITERAL, not an oel attribute, which makes it the
 * THIRD shape a ceremony's text can come from: `PICKUP_CEREMONY`'s per-tag
 * table (the placed pickups), `PICKUP_CEREMONY_BY_KEYTYPE` (the L19 key)
 * and this one — a class that spawns another class with a string in the
 * call. L115's placed seed is a FOURTH (`Game.as:2185` passes `o.@text`),
 * and the two Seeds therefore run dialogues of different lengths from the
 * same class.
 */
export const BLOODY_SEED_TEXT = 'The seed, covered in the blood of the Watcher, seems '
    + 'almost to cower from your grasp.~This was supposed to be a triumph...';

/** `Pickups/Seed.as:36` — `setHitbox(10, 14, 5, 7)`. */
export const SEED_BOX = Object.freeze({ w: 10, h: 14, originX: 5, originY: 7 });

/**
 * ⛔ WHERE THE BLOODY SEED LANDS — AND IT IS NOT EXACTLY ON THE PLAYER.
 *
 * `Watcher.as:97` is `new Seed(p.x - 8, p.y - 8, true, …)` and `Seed`'s
 * constructor is `Seed(_x:int, _y:int, …)` — an **`int` parameter**, so AS3
 * truncates the argument toward zero before the ctor's own
 * `super(_x + Tile.w/2, _y + Tile.h/2)` adds the half tile back. The two
 * cancel EXACTLY when the player is on an integer coordinate and not
 * otherwise: a player resting at x 79.95 gets a seed whose entity is at 79.
 *
 * §14.8 says the seed spawns "at exactly `(p.x, p.y)`", which is true of
 * the arithmetic and not of the types. Transcribed rather than simplified,
 * because the box is 10x14 around a 4x5 player and a 1 px error is
 * invisible in the OVERLAP and visible in nothing else — the silent kind.
 */
export function bloodySeedEntity(player) {
    return {
        x: Math.trunc(player.x - 8) + 8,
        y: Math.trunc(player.y - 8) + 8,
    };
}

/** The bloody seed's collide box, from its entity point. */
export function seedBoxAt(entity) {
    return {
        x: entity.x - SEED_BOX.originX,
        y: entity.y - SEED_BOX.originY,
        right: entity.x - SEED_BOX.originX + SEED_BOX.w,
        bottom: entity.y - SEED_BOX.originY + SEED_BOX.h,
    };
}

/**
 * ⛓⛓⛓ `Watcher.hit()` — `NPCs/Watcher.as:117-124`, and the whole of it is
 * three terms:
 *
 * ```as3
 *   if (!Game.checkPersistence(tag) && hitsTimer <= 0 && text != "")
 *   { hits++; hitsTimer = hitsTimerMax; }
 * ```
 *
 *   1. ⛔ **THE GATE IS THE *CLEARED* TAG.** `checkPersistence` is TRUE
 *      while the dialogue is unread, so the hits count only AFTER
 *      `doneTalking()` — W-blood is W-talk's continuation, never its
 *      alternative.
 *   2. ⛔⛔ **`hitsTimer` 25 MAKES ONE PRESS ONE HIT.** §13.2's five hit
 *      tests all land inside 25 ticks, so tests 2..5 are refused — the
 *      exact opposite of the Owl (§14.4), whose `justKnock` arm sets no
 *      timer and takes all five.
 *   3. ⛓ `text` is the FIELD, i.e. the constructor's `_text` — the LONG
 *      text — and not `myText`, which is `text1` on a cleared boot. A
 *      Watcher whose tag is already off still has a non-empty `text`, which
 *      is the only reason a hit is possible at all.
 *
 * @returns {{landed: boolean, hits: number, hitsTimer: number}}
 */
export function watcherTakesHit(w) {
    if (!w.cleared) return { landed: false, hits: w.hits, hitsTimer: w.hitsTimer, why: 'the tag is still SET — `!Game.checkPersistence(tag)` is false until `doneTalking()` has run' };
    if (w.hitsTimer > 0) {
        return { landed: false, hits: w.hits, hitsTimer: w.hitsTimer, why: `hitsTimer ${w.hitsTimer} > 0 — one of the press's five hit tests, refused` };
    }
    if (!w.text) return { landed: false, hits: w.hits, hitsTimer: w.hitsTimer, why: '`text == ""`' };
    return { landed: true, hits: w.hits + 1, hitsTimer: WATCHER.hitsTimerMax, why: null };
}

/**
 * Does this hit count spawn the bloody seed? `hits > dieFrames.length`,
 * and `dieFrames` is `[7, 8, 9]` ⇒ the FOURTH hit.
 */
export function bloodySeedDue(hits) {
    return hits > WATCHER.dieFrames;
}

/**
 * ⛓⛓⛓ `Game.as:955-960` — THE SCRIPTED WALK THE BLOODY REBOOT LANDS IN.
 *
 * ```as3
 *   else if (cutscene[1]) { p.directionFace = 1; p.receiveInput = false;
 *                           p.v.y = -1; if (p.y <= 64) p.v.y = 0; }
 * ```
 *
 * Three facts the tick count depends on, none of them in the snippet:
 *
 *   1. ⛔ **THE BLOCK RUNS *BELOW* `super.update()`**, so the velocity it
 *      writes on frame N is the one `Mobile.mobileUpdate` consumes on frame
 *      N+1. The player is one frame behind the script for the whole walk.
 *   2. ⛔ **`Mobile.friction` RUNS BEFORE `moveY`**, so a `v.y` of -1 is a
 *      step of **0.75** — the same friction-before-move shape as §12.2's
 *      descent and §14.6's transcription, third class in a row.
 *   3. ⛔ **THE CLAMP IS ON THE VELOCITY, NOT THE POSITION.** `p.y <= 64`
 *      zeroes `v.y`; nothing moves the player back to 64. Coming down the
 *      lattice from y 104 in 0.75 steps, 64 is never landed on — the walk
 *      stops at the first value at or below it, and that value is 63.5.
 *
 * ⛔⛔⛔ AND 63.5 IS **INSIDE** THE ORACLE'S TALK CIRCLE. `oracle@64,32` is
 * an `NPC` (+8,+8) ⇒ entity (72,40), and `|63.5 - 40|` is 23.5 against a
 * `talkRange` of 24. §17.10 called the clamp "EXACTLY 24 px from the
 * Oracle" and that was the value the clamp NAMES, not the one the lattice
 * reaches. Either way it is a boundary and not a margin, and the window has
 * to end before it. See `ORACLE`.
 */
export const CUTSCENE_1_WALK = Object.freeze({
    /** `p.v.y = -1`, re-assigned every frame below the world update. */
    vy: -1,
    /** `if (p.y <= 64) p.v.y = 0` — a velocity clamp, not a position one. */
    clampY: 64,
    /** `p.receiveInput = false` — `Player.input()`'s first line returns. */
    receiveInput: false,
    src: 'Game.as:955-960',
});

/**
 * ⛔⛔⛔ L1's ORACLE — THE RUN-ENDER AT THE END OF THE BLOODY WALK.
 *
 * `NPCs/Oracle.as:94-121`: `doneTalking()` under `Game.cutscene[1]` — which
 * is exactly the flag the bloody `Seed` set one tick before the reboot —
 * calls `exitToMenu()`, i.e. `Game.menu = true` plus a world rebuild. And
 * `keyNeeded` is `!Game.checkPersistence(tag)` on a tag no W-blood tape has
 * ever cleared, so the dialogue opens on PROXIMITY with no key at all.
 *
 * ⛔ THE INPUT WOULD BE THE HARNESS'S OWN. `Bot.AUTO_ADVANCE_CADENCE`
 * presses and releases X every 8 frozen frames and `NPC.talk()` reads
 * `Input.released(p.keys[6])` DIRECTLY — past the `receiveInput = false`
 * the cutscene set. So in exactly the state where the tape has no input,
 * the instrument has the most, and it would walk a 13-line dialogue to
 * `exitToMenu()`. The record would then be a claim about the harness.
 * → [[feedback_auto_advance_drives_the_ending]]
 *
 * ⇒ `levelRun` REFUSES the radius rather than modelling the dialogue, and
 * the window's terminal is the LEVEL SEQUENCE plus `menu_state`, never "a
 * menu happened" (`r6Acceptance.R6_BLOOD_MENU_DERIVATION`).
 */
export const ORACLE = Object.freeze({
    /** `super(_x + Tile.w/2, _y + Tile.h/2)` — `NPCs/NPC.as:47`, as the Watcher. */
    ctor: Object.freeze({ dx: 8, dy: 8 }),
    talkRange: TALK_RANGE,
    src: 'NPCs/Oracle.as:20-40,94-121',
});

// ── the BLOODLESS branch (R6 slice 6d) ────────────────────────────────

/**
 * ⛔⛔⛔ `Game.as:961-966` — THE `cutscene[2]` ARM, AND IT IS **NOT** A
 * FREEZE.
 *
 * ```as3
 *   else if (cutscene[2]) { p.receiveInput = false; p.visible = false;
 *                           p.active = false; }
 * ```
 *
 * §14.5 called the tree grow and the second cover fade "frozen frames" and
 * priced W-seed at "~688 frozen frames plus a dialogue". **That is wrong,
 * and the line that makes it wrong is four lines further down the same
 * function.** `Game.update`'s tail is
 *
 * ```as3
 *   if (canInventory()) inventory.update(); else if (inventory) inventory.open = false;
 * ```
 *
 * and `canInventory()` is `inventory && !talking && p && p.receiveInput &&
 * !p.destroy` (`Game.as:1494`) — so setting `p.receiveInput = false` makes
 * it FALSE, which runs `Inventory.set open`, which **is**
 * `Game.freezeObjects = _open = _o` (`Inventory.as:153`). The cutscene
 * lowers the freeze at the end of every one of its own frames.
 *
 * ⇒ the 138 grow frames and the 200 frames of the second cover fade are
 * **TAPE TICKS**, not dead frames: the bot's gate reads `false`, records an
 * observation and advances. What makes the player stand still is
 * `active = false` — `Player.update` is never called at all — and that is a
 * different mechanism with a different cost. Only the FIRST fade (the one
 * `Seed.removeSelf` raises, before any cutscene flag is set) is dead.
 *
 * ⛓ Same shape as `CUTSCENE_1_WALK`, and the two are the pair that makes
 * the point: `cutscene[1]` leaves the player ACTIVE and takes its input
 * away, so it walks; `cutscene[2]` takes the update itself away, so it does
 * not. Both are live tape ticks; neither is a freeze.
 */
export const CUTSCENE_2_HOLD = Object.freeze({
    receiveInput: false,
    visible: false,
    active: false,
    /** ⛔ The freeze is LOWERED, not raised — see the docblock. */
    freezeObjects: false,
    src: 'Game.as:961-966 + Game.as:986-991 + Inventory.as:153',
});

/**
 * ⛓⛓⛓ THE TREE, AS A STATE MACHINE — `Seed` with `_tree = true`.
 *
 * `Game.as:2185` passes `cutscene[2]` as the fifth ctor argument, so the
 * plain arm's reboot is what ARMS this: the same `.oel` object is a pickup
 * on the first build and a tree on the second.
 *
 * ```
 *   r = 1 .. 138    `sprTreeGrow.play("grow")` advances one update per tick
 *   r = 138         `endAnim` -> play("grown"), drawCover = true
 *   r = 139 .. 338  `coverAlpha += 0.005`, 200 increments
 *   r = 338         `coverAlpha >= 1` -> menu = true, cutscene[2] = false,
 *                   badge 14, `new Game(level, currentPlayerPosition, false, 2)`
 * ```
 *
 * ⛔ **THE PLAY FRAME IS NOT THE FIRST UPDATE HERE, AND THAT IS THE
 * OPPOSITE OF W-DOOR.** `play("grow")` runs in the `Seed` CONSTRUCTOR,
 * which `Game.loadlevel` calls — not inside a `World.update` pass. And
 * `Game.update` gates `super.update()` on `blackCover <= 0`, so nothing
 * advances during the load fade at all. The animation's first update is
 * therefore the first LIVE frame of the rebuilt world, and the count starts
 * at 1 there. Trap 104's fencepost is about a `play()` called from inside
 * `update()`; this one is called from a constructor, and the difference is
 * a whole frame either way.
 *
 * ⛔ **AND THE FADE STARTS THE TICK AFTER `endAnim`, NOT ON IT.**
 * `World.update` runs `e.update()` then `e._graphic.update()`, so on the
 * grow's last tick `Seed.update` has ALREADY run (with `drawCover` still
 * false, and `else if (!tree)` means it does nothing at all) by the time
 * the graphic fires the callback that sets it. The first `coverAlpha`
 * increment is the next tick's.
 */
export function treeSchedule() {
    const grow = treeGrowUpdates();
    const fade = coverFadeFrames();
    return {
        grow,
        fade,
        /** The relative tick `endAnim` fires on. */
        endAnimAt: grow,
        /** The relative tick the cover reaches 1 and the credits reboot fires. */
        rebootAt: grow + fade,
    };
}

/**
 * ⛓⛓⛓ THE CREDITS, AND WHY THE TAPE HAS TO STOP DEAD THERE.
 *
 * `Game.menuAndRestart()` runs at the TOP of `Game.update` and, while
 * `Game.menu` is true, sets `Game.freezeObjects = true` on EVERY FRAME. So
 * every frame after the credits reboot is a dead frame and the tape's tick
 * counter cannot advance through one — a tape whose `tick_count` runs past
 * it would be asking for observations the game will never record.
 *
 * ⛓ AND `menuState` SURVIVES ITS OWN CONSTRUCTOR ONLY BECAUSE `menu` WAS
 * SET FIRST. `Game`'s ctor is `if (_menuState >= 0) menuState = _menuState;
 * end();` and `end()` is `if (!menu) { … menuState = 0; … }` — so the `2`
 * would be wiped by the very next line if `Seed`'s tree arm had not
 * assigned `Game.menu = true` before the world assignment. Two statements
 * one line apart, and the readout depends on the order.
 */
export const CREDITS = Object.freeze({
    menu: true,
    menuState: 2,
    badge: 14,
    src: 'Pickups/Seed.as:76-81 + Game.as:628-651 + Game.as:1265-1270',
});
