/**
 * seedlingDemo/activators — buttons, locks and covers, as the game runs them.
 *
 * R2 slice 3. Brief: `CC/docs/plans/seedling-bot-r2-opus-kickoff.md` §9.1.
 *
 * ── Why this is not a crutch ──────────────────────────────────────────
 * Every other relaxation on this ladder is something a later rung has to
 * retire. This one is the opposite: it is a piece of the GAME that the
 * model did not have yet. L71's exit to Dungeon 7 is behind a `Lock` whose
 * button sits directly below it, and opening it needs nothing but standing
 * still — no item, no attack key, no flag. Modelling it adds a mechanic
 * rather than removing one, so nothing later has to undo it.
 *
 * ── The whole state machine, in the game's own order ──────────────────
 * `Button.update` (`Puzzlements/Button.as:26-38`) collides
 * `["Player", "Enemy", "Solid"]` at its own position and sets
 * `activate = anything overlaps that is not a Cover`. Its SETTER
 * (`:40-46`) then calls `activateAll(this, t, activate)`, which walks every
 * `Activators` in the world and copies the flag onto each one sharing its
 * `t`. That runs EVERY TICK, unconditionally — the flag is not latched, it
 * is republished, so it goes false the moment the player steps off.
 *
 * `Lock.activationStep` (`Puzzlements/Lock.as:63-88`) then either fades or
 * restores:
 *
 *     activate  -> alpha > 0 ? alpha -= 0.01 : turnOff()
 *     otherwise -> if (type == normType) alpha = 1
 *                  if (!collideTypes(hitables, x, y)) returnToNormal()
 *
 * ⚠ `Image.alpha` CLAMPS to [0, 1] (`graphics/Image.as:155-158`), so the
 * fade cannot go negative and the count is exact: 100 decrements to reach
 * 0, and `turnOff()` on the tick AFTER that — tick **101** of holding the
 * button. `Cover`'s fade is 0.1 per tick and it tests after decrementing
 * rather than before, so a cover opens on tick **11**. Both are
 * transcribed as repeated subtraction, never as `1 / step`: the R1 pit
 * fall's 20-tick knife-edge came from exactly that difference.
 *
 * ⚠⚠ AND THE RESTORE IS GUARDED BY OCCUPANCY. `returnToNormal()` only
 * fires when NOTHING in `hitables` overlaps the lock — so a lock cannot
 * close on the player standing in it. That is what makes the crossing
 * possible at all, because the button volume and the lock volume are
 * DISJOINT: L71's button is `[116,124) x [181,187)` and its lock is
 * `[112,128) x [160,176)`, so there is no position that touches both. The
 * player has to leave the button and enter the lock in ONE tick, and the
 * lock then holds itself open because they are inside it.
 *
 * Whether the real game agrees is not something this module can settle —
 * see the `l71-button-lock` oracle fixture.
 */

import { rectsOverlap } from './levelWorld.js';

export class ActivatorError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ActivatorError';
    }
}

const fail = (message) => { throw new ActivatorError(message); };

/**
 * How each responder class answers `activate`.
 *
 * `step` is the per-tick alpha decrement and `opensOn` is the tick of
 * continuous activation at which it stops being solid — derived here from
 * the AS3 rather than hard-coded, so the two cannot drift apart.
 *
 * ⚠ `RockLock` is an Activator and is NOT here. Its `set activate` override
 * does nothing but play a sound and store the flag (`RockLock.as:40-47`) —
 * it opens on an ITEM, which is R5. `Pulser` is likewise absent: it is
 * `type = "Solid"` unconditionally and `activate` only drives its radius
 * animation. Listing them here would model an opening that does not exist.
 *
 * ⚠ `BossLock` used to be in that sentence and is not any more: R4 is the
 * first rung whose walk can hold a `BossKey`, so its opening stopped being
 * hypothetical. It is in `KEY_RESPONDERS` below rather than here, because
 * its fade is not a `Lock`'s.
 */
export const RESPONDERS = Object.freeze({
    lock: { as3: 'Lock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    wandlock: { as3: 'WandLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    shieldlock: { as3: 'ShieldLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    shieldlocknorm: { as3: 'ShieldLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    grasslock: { as3: 'GrassLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    cover: { as3: 'Cover', fade: 0.1, guard: 'occupancy-unless-chest', src: 'Puzzlements/Cover.as:37-73' },
});

/** The two classes that PRESS. Both are `Activators` with a `t`. */
export const PRESSERS = Object.freeze({
    button: { as3: 'Button', src: 'Puzzlements/Button.as:26-46' },
    buttonroom: { as3: 'ButtonRoom', src: 'Puzzlements/ButtonRoom.as:60-99' },
});

/**
 * ── THE RESPONDERS THAT PRESS THEMSELVES (R3) ─────────────────────────
 *
 * A `ShieldLock` has no button. `ShieldLock.update`
 * (`Puzzlements/ShieldLock.as:30-41`) is the whole mechanic:
 *
 *     p = collide("Player", x - 1, y) as Player;
 *     if (p && !activate && ((hasDarkShield && shieldType == 1)
 *                         || (hasShield    && shieldType == 0))) {
 *         p.y = y - originY + 7;
 *         p.directionFace = 0;
 *         p.receiveInput = false;
 *         activate = true;
 *     }
 *     activationStep();
 *
 * Three things follow, and each of them is a way the button model above
 * would have been wrong here:
 *
 * 1. **`activate` LATCHES.** `ShieldLock` forces `tSet = -2`
 *    (`ShieldLock.as:26` — R2's FORCED_TSET finding), so no `Button`'s
 *    `activateAll` ever republishes the flag and nothing sets it false.
 *    The button arm's every-tick republication, and with it the occupancy
 *    restore, is dead code for this class: once touched, the fade runs to
 *    completion whatever the player does, and the lock never closes again.
 * 2. **It WRITES THE PLAYER'S POSITION and REFUSES INPUT.** The fade is
 *    ordinary — the same 0.01 per tick as any other `Lock`, so
 *    `opensOnTick` still answers 101 — but the player cannot act for the
 *    duration. That window is the caller's problem (`levelRun`), so this
 *    module REPORTS it rather than pretending the fade is the whole story.
 * 3. **⚠ `turnOff()` RESTORES INPUT ONLY `if (p)`** — and `p` is
 *    re-collided every tick, so a player who has drifted out of the check
 *    rect by the time the fade ends is refused input FOREVER. That is a
 *    real terminal state in the game, not a modelling gap, and it is why
 *    the turn-off event carries whether the player was still there.
 *
 * ⚠ `directionFace` is deliberately absent: it selects a sprite row and
 * nothing in the observation stream can see it.
 */
/**
 * ⛓⛓⛓ R9 SLICE 12d″ — **THE PROBE, WHICH IS THE ONLY THING THAT KNOWS WHICH
 * SIDE A TOUCH IS APPROACHED FROM.**
 *
 * `ShieldLock.update` does not test the player against its OWN rect. It
 * shifts its mask one pixel and tests THAT: `collide("Player", x - 1, y)`
 * (`Puzzlements/ShieldLock.as:32`). The offset is not decoration — the lock
 * body is SOLID, so the only air the shifted mask adds is the one-pixel
 * column on the side the shift points at, and that column is the entire
 * approach. `levelWorld.js` already builds the geometry from the same fact
 * (the `shieldlock*` class rows carry `hazard.dx = -1`, which is why
 * `touchRect` is `rect` shifted west); what was missing is the DIRECTION as
 * something a consumer can read, rather than a difference it would have to
 * re-derive from two rects.
 *
 * ⛔ AND THE CONSUMER THAT NEEDED IT WAS GETTING IT WRONG. R9 §31.7 measured
 * `execTouch` choosing its lean by the dominant axis to the lock's CENTRE —
 * `|dx| >= |dy|` — and at L20's derived stance `(168,24)` against target
 * `(176,16)` that comparison is `|+8.00| - |-8.00| = 0.00`: an EXACT TIE
 * decided by the `>=`, with a drive tolerance of 1.0 px scattering arrivals
 * across it. Three of six measured builds fell one way and two the other,
 * and the wrong way is FATAL rather than slow (a lean of `up` walks the
 * player north into the wall and `x` never closes, because a western probe
 * is a western approach). The cure is not a wider margin — it is to have no
 * comparison at all, which is what a transcribed probe gives.
 *
 * The offset is stored as the AS3 writes it, and `touchApproachKey` negates
 * it: the player stands on the side the probe reaches toward and walks back
 * INTO the body.
 */
const WEST_PROBE = Object.freeze({
    dx: -1,
    dy: 0,
    as3: 'collide("Player", x - 1, y)',
    src: 'Puzzlements/ShieldLock.as:32',
});

export const TOUCH_RESPONDERS = Object.freeze({
    shieldlock: { as3: 'ShieldLock', src: 'Puzzlements/ShieldLock.as:30-51', probe: WEST_PROBE },
    shieldlocknorm: { as3: 'ShieldLock', src: 'Puzzlements/ShieldLock.as:30-51', probe: WEST_PROBE },
});

/**
 * The key a touch approach LEANS ON, derived from the responder's own probe.
 *
 * ⛔ `null` IS AN ANSWER AND IT MEANS "REFUSE", never "guess". Three shapes
 * come back null, and the caller must name the class rather than fall back to
 * a dominant axis — the fallback IS the defect this function exists to
 * remove:
 *
 * 1. **NO TRANSCRIBED PROBE.** A tag that is not a touch responder, or one
 *    whose row was added without reading its AS3.
 * 2. **A CENTRED PROBE** (`dx == 0 && dy == 0`). `Whirlpool.as:61` is the
 *    game's one example — `collide("Player", x, y)`, its own rect. A centred
 *    probe adds NO air on any side and therefore names no side; a class like
 *    that is approached from wherever it is reachable and the question this
 *    function answers does not arise. (It is also not solid and not an
 *    activator, so it has no row here — the arm is transcribed for the reader,
 *    not for a caller.)
 * 3. **A DIAGONAL PROBE.** The game has none; a lean is one key by
 *    construction and inventing an order for two would be a policy nobody
 *    reviewed.
 *
 * ⚠ `PushableBlock.as:39-54` probes all FOUR faces and is deliberately not a
 * touch responder: which side is approached there is chosen by the PUSH
 * DIRECTION the planner picks, not by the class, and that is `execShove`'s
 * question.
 */
export function approachKeyFromProbe(probe) {
    if (!probe) return null;
    if (probe.dx !== 0 && probe.dy !== 0) return null;
    if (probe.dx !== 0) return probe.dx < 0 ? 'right' : 'left';
    if (probe.dy !== 0) return probe.dy < 0 ? 'down' : 'up';
    return null;
}

/**
 * ⛓ The same answer asked of a TAG. Split from the arithmetic above so the
 * derivation can be exercised on the directions the game does not currently
 * have — a table with two rows, both west, would otherwise let three of the
 * four arms and both null arms go unmeasured.
 */
export function touchApproachKey(tag) {
    return approachKeyFromProbe(TOUCH_RESPONDERS[tag]?.probe);
}

/**
 * ── THE RESPONDERS THAT OPEN ON A KEY (R4) ────────────────────────────
 *
 * `BossLock.update` (`Puzzlements/BossLock.as:59-88`) is the whole mechanic,
 * and it is a third shape rather than a variant of the two above:
 *
 *     var p = FP.world.collideLine("Player", <a one-pixel line beneath me>);
 *     if (p && Player.hasKey(keyType)) activate = true;
 *     if (activate) {
 *         if (keyTimer > 0) keyTimer--;
 *         else { scale += 0.05; alpha -= 0.05;
 *                if (alpha <= 0 && type != "") {
 *                    type = ""; alpha = 0; Game.setPersistence(tag, false); } }
 *     } else if (type != normType) {
 *         type = normType; alpha = 1; Game.setPersistence(tag, true); }
 *
 * Four things follow, and three of them are ways the other two families
 * would have been wrong here:
 *
 * 1. **THE GATE IS A SAVE-FILE BOOLEAN, not an item property.**
 *    `Player.hasKey(i)` reads `Main.SAVE_FILE.data.hasKey[i]`, which
 *    `BossKey.removed()` writes and which is not one of the fourteen
 *    properties `botStatus.items` reports. So the run carries it as its own
 *    set and this module is told, exactly as it is told the inventory.
 * 2. **`activate` LATCHES, by absence.** `tSet` is forced to -1 by the
 *    ctor, so no `Button.activateAll` republishes the flag, and nothing else
 *    in the extract writes it — which makes the `else if (type != normType)`
 *    re-close arm unreachable after the first touch. It is transcribed
 *    anyway (`reclose` below) so the claim is a reading of the code rather
 *    than a silence, and a rung that finds a writer re-opens it here.
 * 3. **THE FADE IS NOT A `Lock`'S.** Sixty ticks of `keyTimer` and then
 *    `alpha -= 0.05` — twenty more — so it opens on tick **80** of
 *    continuous activation against a Lock's 101. `opensOnKeyTick` runs the
 *    subtraction rather than dividing, for the reason `opensOnTick` does.
 * 4. **NO POSITION WRITE AND NO INPUT REFUSAL.** Unlike a ShieldLock, a
 *    BossLock does nothing to the player at all: the walk is free for the
 *    whole window, which is why this needs no event channel.
 *
 * ⚠ `Image.alpha` CLAMPS to [0,1] for a `Lock`, and `BossLock` does its own
 * arithmetic on a plain `Number` field instead — so the value really does go
 * NEGATIVE (-3.19e-16 on the twentieth decrement, which is what makes the
 * `<= 0` test fire on 20 rather than 21). Do not clamp it.
 */
export const KEY_RESPONDERS = Object.freeze({
    bosslock: {
        as3: 'BossLock',
        fade: 0.05,
        keyTimer: 60,
        src: 'Puzzlements/BossLock.as:59-88',
        // The arm that cannot run once `activate` is true — see note 2.
        reclose: 'unreachable: nothing in the extract sets BossLock.activate false',
    },
});

/** `Image.alpha`'s setter clamps — graphics/Image.as:155-158. */
const clampAlpha = (v) => (v < 0 ? 0 : (v > 1 ? 1 : v));

/**
 * How many ticks of continuous activation a responder needs before it
 * stops being solid. Computed by running the fade, because the answer is a
 * float question and reading it off `1 / fade` gives 100 for the lock and
 * 10 for the cover — one of which is wrong.
 */
export function opensOnTick(fade) {
    let alpha = 1;
    if (fade === 0.1) {
        // Cover: decrement THEN test, with no `alpha > 0` guard.
        for (let tick = 1; tick <= 1000; tick++) {
            alpha = clampAlpha(alpha - fade);
            if (alpha <= 0) return tick;
        }
    } else {
        // Lock: test `alpha > 0` FIRST, so `turnOff` lands one tick later.
        for (let tick = 1; tick <= 1000; tick++) {
            if (alpha > 0) alpha = clampAlpha(alpha - fade);
            else return tick;
        }
    }
    return fail(`a fade of ${fade} never opens`);
}

/**
 * The same question for a KEY responder, and the answer is not the same
 * number: `keyTimer` ticks run FIRST and the first of them shares the frame
 * that latched `activate`, so the count is `keyTimer + <fade ticks>`.
 *
 * ⚠ NO CLAMP, and the float is the whole reason this is computed rather
 * than written down. `BossLock` decrements a bare `Number`, so after twenty
 * subtractions of 0.05 the value is -3.19e-16 — `<= 0` and therefore OPEN.
 * A clamped or rounded version answers 21.
 */
export function opensOnKeyTick(keyTimer, fade) {
    let alpha = 1;
    let timer = keyTimer;
    for (let tick = 1; tick <= 1000; tick++) {
        if (timer > 0) timer--;
        else {
            alpha -= fade;
            if (alpha <= 0) return tick;
        }
    }
    return fail(`a key fade of ${fade} after ${keyTimer} ticks never opens`);
}

/**
 * `World.collideLine("Player", ...)` against the player's box, for the
 * horizontal one-pixel line a `BossLock` walks beneath itself.
 *
 * ⚠ AN INTEGER POINT TEST, not a rect overlap. `collideLine`'s raycast is
 * `while (x < toX)` at precision 1 with the end-point check skipped, and
 * `Entity.collidePoint` is `pX >= x - originX && pX < x - originX + width`.
 * So the question is "does the box CONTAIN one of the integer probes", and
 * a rect overlap would also answer yes for a box that straddles the last
 * probe without containing it — half a pixel of over-permission in the one
 * mechanic whose false positive is a persistence write.
 */
export function keyLineTouches(box, line) {
    if (!(box.y <= line.y && line.y < box.bottom)) return false;
    const first = Math.max(line.x0, Math.ceil(box.x));
    // `box.right` is exclusive, so the last legal integer is one below it —
    // and `Math.ceil(r) - 1` is that for a non-integer `r` too.
    const last = Math.min(line.x1, Math.ceil(box.right) - 1);
    return first <= last;
}

/**
 * Per-level activator state. One entry per responder, keyed by the id
 * `levelWorld` gave it.
 *
 * `open` is the modelled `type == ""`. It starts false because every
 * responder assigns `type = normType` in its constructor.
 */
/**
 * ⛓ R5 slice 5 step 2: THE CROSS-ROOM WRITES THIS VISIT HAS ALREADY MADE.
 *
 * A `ButtonRoom` with `room >= 0` writes persistence into ANOTHER level and
 * clears its own tag here. `set activate` is `if (a) { ... }` with no
 * already-pressed guard, so the game re-writes both flags on every tick the
 * button is held — and both writes are idempotent, so what the LEDGER sees
 * is one entry each. This set is that de-duplication, per level visit.
 *
 * ⚠ PER VISIT, like every other member of this family. `check()` recomputes
 * `_active = !checkPersistence(tag)` on the next `new Game`, so a button
 * whose own tag is now false boots ALREADY PRESSED and fires the setter
 * again at build time — the same two writes, the same values. The run banks
 * the clears, so the rebuild is a no-op it does not need to re-derive.
 */
export function crossRoomWrites(presser) {
    if (presser?.tag !== 'buttonroom') return [];
    // `persist = _active` (true on a press), flipped by `flip`.
    const persist = presser.flip ? false : true;
    const out = [];
    if (presser.room >= 0) {
        // The write is keyed on the TSET, in the named room —
        // `ButtonRoom.as:93`.
        out.push({ level: presser.room, tag: presser.t, value: persist, which: 'room' });
    }
    // ⛔⛔ R5 SLICE 7: `Game.setPersistence(tag, !activate)` IS OUTSIDE THE
    // `room` BRANCH — `ButtonRoom.as:95`, one line below the closing brace
    // of the `if (room == -1) … else …`. So a LOCAL-publish button writes
    // its own tag exactly as a cross-room one does, and this function used
    // to return an empty array for it: `if (!(presser.room >= 0)) return []`
    // dropped the write and the publish together.
    //
    // ⚠ IT MATTERS BEYOND TIDINESS. Seven `room = -1` buttonrooms exist and
    // THREE OF THEM ARE L40's — the room step 2 threads — where the publish
    // is the entire opening mechanic: `buttonroom@272,208` latches three
    // `WandLock`s AND a `BossLock` open by being walked over. The brief's
    // "the cross-room machinery from slice 5 covers them" was not true.
    if (presser.persistTag >= 0) {
        out.push({ level: null, tag: presser.persistTag, value: false, which: 'own' });
    }
    return out;
}

/**
 * ⛓ THE LOCAL PUBLISH — `ButtonRoom.as:79-91`, the `room == -1` arm.
 *
 * It walks every `Activators` sharing `t` and assigns `activate = persist`
 * DIRECTLY, outside the per-tick republication a `Button` does. And the
 * setter's whole body is behind `if (a)` with the author's own comment —
 * *"Can't be reset to false!!"* — so once pressed it never un-presses:
 * the group is LATCHED, and walking off it changes nothing.
 *
 * That is a third activation shape after the button's republication and
 * the touch/key latches, and it is the one that opens L40.
 *
 * @returns {?object} `{group, value}`, or null when the presser has no
 *   local arm.
 */
export function localPublish(presser) {
    if (presser?.tag !== 'buttonroom' || presser.room >= 0) return null;
    return { group: presser.t, value: presser.flip ? false : true };
}

/**
 * ⛓⛓ THE ROPE PUBLISH — `Puzzlements/RopeStart.as:79-91`, R5 slice 10.
 *
 * A FOURTH activation shape, and the one the shaft refutation turned on.
 *
 * ```
 *   override public function set activate(a:Boolean):void
 *   {
 *       _active = a;
 *       var v:Vector.<Activators> = new Vector.<Activators>();
 *       FP.world.getClass(Activators, v);
 *       for (var i:int = 0; i < v.length; i++)
 *           if (v[i] != this && v[i].t == t) v[i].activate = activate;
 *   }
 * ```
 *
 * ⚠⚠ **FIRST, THE SCOPE CHECK, BECAUSE IT COULD HAVE BEEN MUCH WIDER.**
 * `Activators.as:20-23`'s base setter is `_active = a` and nothing else, so
 * **the broadcast is ROPE-SPECIFIC and not base behaviour**. Thirteen
 * classes extend `Activators` and ten override the setter; only
 * `RopeStart`'s republishes. If it had been in the base, the model's
 * activation semantics would have been wrong in every level with a group,
 * not in this room — so the check ran before anything was transcribed.
 *
 * ⛓ **IT IS A LATCH BY CONSTRUCTION, NOT BY A GUARD.** `hit()` is the only
 * caller and its whole body is `if (!activate)`, so `a` is only ever TRUE
 * and nothing ever republishes the group as false. That makes it the same
 * SHAPE as a `room = -1` ButtonRoom's local publish — which is why the two
 * share `state.latched` rather than getting a second map that consumers
 * would have to remember to read.
 *
 * ⚠ **WHAT IT REACHES IS PER-CLASS, AND TWO OF THE THREE MEMBERS IN L39 DO
 * SOMETHING.** The setter it calls is the TARGET's own override:
 * `Pulser` starts cycling, `Cover`/`Lock` fade, and — the one four slices
 * of audit missed — **`FallRock.set activate` calls `fall()`**, which
 * writes its own persistence tag, freezes the game for ~197 frames and
 * drops a 16x16 solid. See `fallRock.js` and `r5Totem.GROUP_6`.
 *
 * @returns {?{group: number, value: true}} null for a rope with no group
 */
export function ropePublish(rope) {
    if (rope?.as3 !== 'RopeStart' && rope?.tag !== 'rope') return null;
    const group = rope.t;
    if (!(group >= 0)) return null;
    // `hit()` cannot publish false: `if (!activate) { … activate = true … }`.
    return { group, value: true };
}

export function createActivatorState(world) {
    const byId = new Map();
    for (const a of world.activators) {
        // `touched` is the LATCHED `activate` of a touch responder — see
        // TOUCH_RESPONDERS. It is a separate field rather than a reuse of
        // `held` because `held` counts CONTINUOUS ticks and resets, which is
        // the opposite of a latch.
        byId.set(a.id, { alpha: 1, open: false, held: 0, touched: false });
    }
    // The cross-room presser ids whose write this visit has already made,
    // and the groups a `room = -1` press has LATCHED open (see
    // `localPublish` — the setter cannot be reset to false).
    return { byId, level: world.level, roomWritten: new Set(), latched: new Map() };
}

/**
 * Which groups are pressed, given where the player is and what SOLIDS are
 * standing on things.
 *
 * ⛓ R5 SLICE 6: THE SECOND PRESSER IS REAL AND IT IS A BLOCK. The game's
 * `hitables` is `["Player", "Enemy", "Solid"]` and this docblock has said
 * since R2 that "a pushed block holds a button down too — and that is the
 * intended solution to more than one room". L39 is that room three times
 * over, so `movingSolids` now carries the boxes of anything the RUN moves
 * (the `pushables` state's rects) and a block on a button presses it.
 *
 * ⛓⛓⛓ R5 SLICE 15: THE THIRD PRESSER IS A CRUSHER, AND IT IS WHAT SOLVES
 * L41. `Crusher` is `type = "Solid"` and it moves ON ITS OWN, so it reaches
 * this list through `movingSolids` exactly as a pushed block does — and the
 * game's own exclusion list is `Cover` only, so nothing stops it. In L41
 * three baits walk it onto `button@248,232`, where it holds `cover@112,128`
 * open FOREVER; the cover is the only push stance the room's one block has,
 * and that block is the only Solid that can reach the wandlock's button.
 * ⇒ a room whose two locks each need a Solid on a button, one block, and the
 * block behind the first lock — solved by making the obstacle the machine.
 *
 * ⚠ STILL NOT ENEMIES. `hitables[1]` is `"Enemy"` and no enemy is modelled
 * as a mover, so an enemy standing on a button is invisible here. That is
 * the same boundary R2 named, narrowed by one term rather than closed, and
 * it is unchanged in the safe direction: the model reports a group SHUT
 * that the game may hold open, which shows up as a walk that waits rather
 * than a walk that walks through a solid.
 *
 * ⚠ A STATIC solid resting on a button would hold it forever and this
 * model would miss it. `assertNoStaticPress` is the guard, and it runs
 * over every level rather than being asserted in prose. ⚠ A `movingSolids`
 * box is NOT covered by that guard — it is the caller's live state, and the
 * caller is the one that knows the block moved.
 *
 * @param {object[]=} movingSolids  `[{id, rect}]` — live boxes for solids
 *   the run moves. A `Cover` must never appear here: the game's own loop
 *   excludes it (`if (c && !(c is Cover))`), which is what stops a closed
 *   cover from pressing the button it is sitting on top of.
 */
export function pressedGroups(world, playerBox, movingSolids = []) {
    const groups = new Set();
    for (const p of world.pressers) {
        if (rectsOverlap(playerBox, p.rect)) {
            groups.add(p.t);
            continue;
        }
        for (const s of movingSolids) {
            if (rectsOverlap(s.rect, p.rect)) { groups.add(p.t); break; }
        }
    }
    return groups;
}

/**
 * One tick of the activator machinery, run AFTER the player has moved.
 *
 * ⚠ THE ORDER, CORRECTED BY THE GAME AT R3. `Game.loadlevel` adds the
 * Player at `Game.as:2040` and every scenery and puzzle entity in the loop
 * BELOW it, and `World.add` -> `addUpdate` PREPENDS — so the update list is
 * reverse add order and **a Lock updates BEFORE the Player**, reading the
 * position the previous frame left. (R2's docblock here said the opposite,
 * and no recording could tell: the player is stationary for the whole of
 * `l71-button-lock`.)
 *
 * Calling this AFTER the movement is nonetheless right, because the two
 * labellings produce the SAME STATE — "derived from the position at the end
 * of tick N" is one object whether you compute it at the bottom of tick N or
 * the top of tick N+1, and the player's sweep in tick N+1 reads it either
 * way. A caller that stepped it BEFORE the movement would open a lock a tick
 * early, in every run, forever.
 *
 * What the two labellings do NOT share is a SIDE EFFECT on the player. The
 * `snap` event below is written by the lock at the top of the next tick,
 * ahead of the player's own update, so `levelRun` defers it by one tick —
 * see `pendingSnapY`, and the recording that found it.
 *
 * `opts.inventory` is the run's item mirror, and it is REQUIRED in any level
 * holding a touch responder — see TOUCH_RESPONDERS.
 *
 * Returns the EVENTS a touch responder produced this tick (see `events`
 * below), not the state: the state is mutated in place, and returning it as
 * well would offer a caller two ways to read one thing.
 *
 * ⚠ ONE BOX FOR THE WHOLE PASS, which is a bounded imprecision the game
 * does not share. A `snap` moves the player, and in the game an entity
 * updating after the ShieldLock would collide against the NEW position. The
 * pass here uses the pre-snap box throughout, so a SECOND responder whose
 * volume the snap moves the player into or out of would be one tick late.
 * L71's other two locks are 176 px away, and it is the only touch responder
 * on any route so far; recorded rather than assumed, because "no route does
 * that yet" is how the statue got its offset wrong for two slices.
 */
export function stepActivators(state, world, playerBox, opts = {}) {
    const { inventory = null, keys = null, movingSolids = [] } = opts;
    const pressed = pressedGroups(world, playerBox, movingSolids);
    /**
     * ⛓ R5 SLICE 6: THE OCCUPANCY GUARD COUNTS BLOCKS TOO, and it is the
     * half that makes L39 solvable at all.
     *
     * `Cover.update`'s reset arm collides `["Solid", "Player"]` and
     * `Lock.activationStep`'s restore arm collides `["Player", "Enemy",
     * "Solid"]`. So a block parked on an OPEN cover keeps it open after the
     * button that opened it is released — which is why the room is not the
     * three-simultaneous-holds §18.5 read it as: a block latches its own
     * cover by standing on it.
     */
    const occupied = (r) => {
        if (rectsOverlap(playerBox, r)) return true;
        for (const s of movingSolids) if (rectsOverlap(s.rect, r)) return true;
        return false;
    };
    /**
     * What a touch responder DID this tick, for the caller that owns the
     * player: `{kind: 'snap'|'turnoff', id, y?, touching?}`.
     *
     * Returned rather than applied, because this module does not own the
     * player's position and a module that reached across to write it would
     * be the second copy of the world swap all over again.
     */
    const events = [];
    // ── R5 slice 5 step 2: the CROSS-ROOM arm of `ButtonRoom.set activate`
    // ⚠ IT IS NOT AN `activators` MEMBER, so it cannot live in the loop
    // below: a `ButtonRoom` is a PRESSER, its `room >= 0` arm publishes to
    // nothing in this level, and the thing it changes is what ANOTHER level
    // builds. Emitted once per visit — `set activate` re-writes on every
    // held tick and both writes are idempotent, so a second entry would be
    // a ledger the game does not have.
    if (!state.roomWritten || !state.latched) {
        fail('stepActivators: this activator state predates the cross-room writes '
            + '(no `roomWritten`). Rebuild it with `createActivatorState` — a state '
            + 'object that silently skipped the writes would drop a ledger entry and '
            + 'leave the next level built with a plug the game has removed.');
    }
    for (const p of world.pressers ?? []) {
        if (p.tag !== 'buttonroom') continue;
        const id = `${p.tag}@${p.x},${p.y}`;
        if (state.roomWritten.has(id)) continue;
        // ⚠ A `ButtonRoom` presses on the same `hitables` a `Button` does,
        // so a BLOCK standing on one presses it too. Not a hypothetical:
        // L40's `buttonroom@272,208` sits in a room with two fire blocks.
        const byPlayer = rectsOverlap(playerBox, p.rect);
        const byBlock = movingSolids.some((s) => rectsOverlap(s.rect, p.rect));
        if (!byPlayer && !byBlock) continue;
        state.roomWritten.add(id);
        const publish = localPublish(p);
        if (publish && publish.value) state.latched.set(publish.group, true);
        events.push({
            kind: 'roomwrite', id, presser: p, writes: crossRoomWrites(p), publish,
        });
    }
    for (const a of world.activators) {
        const s = state.byId.get(a.id);
        if (!s) fail(`activator ${a.id} has no state — was createActivatorState called `
            + `for level ${world.level}?`);
        const responder = RESPONDERS[a.tag];
        // `p` in the AS3: re-collided EVERY tick, which is what makes the
        // `turnOff` guard below a live question rather than a formality.
        let touching = false;
        // ── the KEY arm, which shares nothing with the two below ────────
        // Its fade is its own, it has no `alpha = 1` reset (the reset lives
        // in the re-close arm, which cannot run — see KEY_RESPONDERS note 2)
        // and its open is a PERSISTENCE WRITE the caller has to bank. So it
        // returns before the shared fade machinery rather than threading a
        // second set of constants through it.
        const keyResponder = KEY_RESPONDERS[a.tag];
        if (keyResponder) {
            if (keys === null) {
                fail(`level ${world.level} holds ${a.id}, a BossLock whose activation `
                    + 'gates on `Player.hasKey(' + a.keyType + ')` — but stepActivators '
                    + 'was called with no key set. Defaulting it to "no keys" would '
                    + 'model a lock that can never open, silently, in the one level '
                    + 'where opening it is the errand.');
            }
            if (!s.touched && keys.has(a.keyType) && keyLineTouches(playerBox, a.keyLine)) {
                s.touched = true;
            }
            if (s.touched) {
                // ⚠ THE DECREMENT SHARES THE LATCHING FRAME. `activate = true`
                // is assigned above `if (activate)` in the same `update()`,
                // so the first tick of contact is also the first `keyTimer--`.
                if (s.held < keyResponder.keyTimer) {
                    // `keyTimer--`
                } else if (!s.open) {
                    s.alpha -= keyResponder.fade;
                    if (s.alpha <= 0) {
                        s.open = true;
                        s.alpha = 0;
                        // `Game.setPersistence(tag, false)`, once — the AS3
                        // guard is `type != ""` and `s.open` is that type.
                        events.push({ kind: 'keyopen', id: a.id, persistTag: a.persistTag });
                    }
                }
                s.held += 1;
            }
            continue;
        }
        let active;
        if (TOUCH_RESPONDERS[a.tag]) {
            if (inventory === null) {
                fail(`level ${world.level} holds ${a.id}, a touch responder whose `
                    + `activation gates on \`${a.shield}\` — but stepActivators was `
                    + 'called with no inventory. Defaulting the item to false would '
                    + 'model a lock that can never open, silently, in the one level '
                    + 'where opening it is the errand.');
            }
            touching = rectsOverlap(playerBox, a.touchRect);
            if (touching && !s.touched && inventory[a.shield] === true) {
                s.touched = true;
                events.push({ kind: 'snap', id: a.id, y: a.snapY, persistTag: a.persistTag });
            }
            // ⚠ THE LATCH, not the press. Nothing republishes this flag, so
            // it stays true whatever the player does next — including
            // walking away, which for a button-lock would close it.
            active = s.touched;
        } else {
            // ⛓ ...OR LATCHED by a `room = -1` ButtonRoom's publish, which
            // no `Button` ever republishes and nothing sets false.
            active = a.t >= 0 && (pressed.has(a.t) || state.latched?.get(a.t) === true);
        }
        /**
         * ⛔⛔ R5 SLICE 7: `Lock.turnOff()`'s THIRD LINE, which every rung
         * before this one dropped.
         *
         * ```
         *   public function turnOff():void {
         *       if (type == normType) {
         *           type = ""; alpha = 0;
         *           Game.setPersistence(tag, false);      // <- HERE
         *       } }
         *   public function returnToNormal():void {
         *       if (type == "") {
         *           type = normType;
         *           Game.setPersistence(tag, true);       // <- AND HERE
         *       } }
         * ```
         *
         * A plain `Lock`/`WandLock`/`GrassLock` that fades open writes a
         * CLEAR, and one that restores writes it back TRUE. `Bot.as`'s
         * `persistenceClearedAll` is a live scan of `Main.levelPersistence`
         * rather than an echo of anything the tape said, so both directions
         * are visible in the game's own ledger — and until this slice the
         * model emitted neither.
         *
         * ⚠ IT WAS INVISIBLE, NOT ABSENT. No committed fixture opens a
         * plain Lock with a tag: `l71-button-lock` and its three siblings
         * hold `button@112,176`, which opens `lock@112,160 {t 0, tag 3}` —
         * but their expectations are `ticks` + `transitions` only, and the
         * verifier's ledger check is one-directional over `lockSnaps`
         * (touch locks). L39's three `WandLock`s are the first ones whose
         * flags an exact-set ledger has to name.
         *
         * ⚠ AND THE `tag = -1` CASE IS THE OUT-OF-BAND FAMILY AGAIN.
         * `Lock`'s `_tag` defaults to -1 and `turnOff` writes it
         * unconditionally, so such a lock clears `(level-1, 29)`. The event
         * carries the raw tag and the caller resolves it through
         * `outOfBandLedger`, exactly as a `BreakableRock`'s does.
         */
        const writesPersistence = !TOUCH_RESPONDERS[a.tag] && responder.fade !== 0.1;
        if (active) {
            if (s.alpha > 0) {
                s.alpha = clampAlpha(s.alpha - responder.fade);
                // Cover tests immediately after decrementing; Lock waits
                // for the next tick to see a zero. That one tick is the
                // whole difference between opening on 11 and on 101.
                if (responder.fade === 0.1 && s.alpha <= 0) s.open = true;
            } else if (responder.fade !== 0.1) {
                // `Lock.turnOff()`'s `if (type == normType)` guard is what
                // makes this a TRANSITION rather than a per-tick write: the
                // branch runs on every subsequent tick and the guard makes
                // all but the first a no-op.
                if (!s.open && writesPersistence) {
                    events.push({ kind: 'lockopen', id: a.id, persistTag: a.persistTag });
                }
                s.open = true;   // Lock.turnOff()
                // ⚠ AND IT KEEPS BEING CALLED. `activate` is still true and
                // `alpha` is pinned at 0, so this branch runs on EVERY
                // subsequent tick — `Lock.turnOff`'s own `type == normType`
                // guard makes the second call a no-op, but `ShieldLock`'s
                // override does not have that guard, so its `if (p)` is
                // re-evaluated every tick. A player who missed the restore
                // and later drifts back into the rect gets input back.
                if (TOUCH_RESPONDERS[a.tag]) {
                    events.push({ kind: 'turnoff', id: a.id, touching, persistTag: a.persistTag });
                }
            }
            s.held += 1;
        } else {
            s.held = 0;
            if (!s.open) s.alpha = 1;   // `if (type == normType) alpha = 1`
            // returnToNormal / reset — BOTH are guarded by occupancy, and
            // the guard is why a crossing is possible at all.
            if (!occupied(a.rect)) {
                // `returnToNormal`'s `if (type == "")` — the write happens
                // only for a lock that really was open, which is why this
                // reads `s.open` BEFORE clearing it.
                if (s.open && writesPersistence) {
                    events.push({ kind: 'lockclose', id: a.id, persistTag: a.persistTag });
                }
                s.open = false;
                s.alpha = 1;
            }
        }
    }
    return events;
}

/** The ids that are currently NOT solid. */
export function openActivatorIds(state) {
    const open = new Set();
    for (const [id, s] of state.byId) if (s.open) open.add(id);
    return open;
}

/**
 * ⚠ THE GUARD THIS MODEL NEEDS AND CANNOT DERIVE.
 *
 * `Button.update` presses on any `["Player", "Enemy", "Solid"]` overlap
 * that is not a `Cover`. This model presses only on the player, which is
 * exact only while no STATIC solid rests on a button — a wall tile, a
 * pole, a rock. If one did, that button would be held from the first frame
 * and its group would be permanently open, and the model would report the
 * lock shut for the whole run.
 *
 * Checked rather than assumed, over every level, in the test suite.
 */
export function staticPressesIn(world) {
    const hits = [];
    for (const p of world.pressers) {
        for (const s of world.solids) {
            // A Cover is explicitly excluded by the game's own loop.
            if (s.tag === 'cover') continue;
            if (rectsOverlap(s.rect, p.rect)) {
                hits.push({ presser: p, solid: s.tag, at: { x: s.x, y: s.y } });
            }
        }
    }
    return hits;
}
