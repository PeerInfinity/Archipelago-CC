/**
 * seedlingDemo/shieldBossFight — THE SHIELDSPIRE: A WALL THAT SITS ON ITS
 * OWN KEY, AND A WINDOW YOU OPEN BY STANDING STILL.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 5. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §4.5, with §2.4 amended by
 * §8.14 (the measured rects and the ungated band counter) and §8.2 (the anim
 * table, derived at the clamped `FP.elapsed = 0.0333`). Source:
 * `Enemies/ShieldBoss.as`, `Enemies/Enemy.as`, `Mobile.as`, `Player.as`,
 * `Pickups/BossKey.as`, `Pickups/Pickup.as`,
 * `net/flashpunk/graphics/Spritemap.as`, `net/flashpunk/World.as`, all read
 * at first hand against fork `bot` @ a9f84ab.
 *
 * ── THE FIGHT IN ONE PARAGRAPH ────────────────────────────────────────
 *
 * `shieldboss@80,32` in L19 is a 48x48 body at `[80,128) x [40,88)` whose
 * `type` is `"ShieldBoss"` — a member of `Mobile.solids`, so it is a hard
 * wall to the player and to everything else that moves. `bosskey@96,64`
 * sits INSIDE it at entity `(104,72)` with `_attract` false, and the room's
 * only route north runs through the same three columns. So the wall, the
 * key and the exit are one object, and the object has three hit points.
 *
 * The only way to spend one is to STAND STILL. `hitPlayer()` counts a
 * player inside its own 48x16 band — `(x-24, y+24, 48, Tile.h)` =
 * `[80,128) x [88,104)` — for `swingTimeMax` = 120 CONSECUTIVE updates
 * while the animation is `"sit"`, and then fires `startStab(false)`, which
 * is the ONE path through `moveShield -> movedShield -> stab -> sit`.
 * `movedShield` is the only animation in which `ShieldBoss.hit` forwards to
 * `super.hit`, and a landed hit also calls `sit()`, which aborts the stab
 * before its damaging frames. A player-initiated hit from `sit` takes the
 * OTHER branch — `startStab(true)`, `moveShield -> stab -> sit`, a
 * retaliation with no vulnerable phase at all.
 *
 * ── ⛔⛔⛔ THE FIRST HIT OF EVERY ROOM ENTRY IS SWALLOWED ─────────────
 *
 * `activated` is an INSTANCE field with no persistence behind it, and every
 * room entry is a `new Game` which constructs a new `ShieldBoss`. So the
 * first `hit()` after every entry is
 *
 *     if (!activated) { activated = true; return; }
 *
 * — it does not damage, it does not retaliate, it does not touch the band
 * counter and it does not care which animation is playing. ⇒ **it is the
 * fight's own ARMING DISPATCH**, and a schedule that treats it as a miss is
 * one hit short for ever. It is also FREE: because it returns above the
 * `movedShield` test and above `startStab`, it can be spent on arrival,
 * before the first 120-tick count has even begun.
 *
 * ── ⛔⛔ THE BAND COUNTER HAS NO `hitsTimer` GATE ────────────────────
 *
 * `Enemy.hitPlayer` opens with `!destroy && currentAnim != "die" &&
 * hitsTimer <= 0`. `ShieldBoss.hitPlayer` OVERRIDES it and drops all three:
 * its damage arm carries its own `!destroy`, and its counter arm carries
 * nothing. So `swingTime` accumulates during the player's i-frames, during
 * the boss's own i-frames, and during the die animation's first tick —
 * §8.14's finding, and the reason the cycle is 120 flat rather than
 * `120 + hitsTimerMax`.
 *
 * ⚠ `startStab` DOES carry the timer (`hitsTimer <= 0 && currentAnim ==
 * "sit"`), so the counter can complete while the stab it asks for is
 * refused — and `swingTime` has already been zeroed by then, so the refusal
 * costs a whole fresh 120. On the schedule this file's window uses that
 * never binds (30 < 120), and it is transcribed rather than assumed away.
 *
 * ── ⛔ THE TAG PRECEDES THE CORPSE, AND THE CORPSE PRECEDES THE REMOVAL
 *
 * Three separate instants, and every one of them has a consumer:
 *
 *   `startDeath`  `Game.setPersistence(tag, false)` then `play("die")`. It
 *                 does NOT set `destroy`. **`{19,0}` is written here**, on
 *                 the tick the third hit lands.
 *   `endAnim`     `destroy = true`, `SHIELD_BOSS_DIE_UPDATES` = 23 graphic
 *                 updates later (§8.2, derived).
 *   `removed`     `Mobile.death()` fades `alpha` by 0.1 per call and
 *                 `FP.world.remove(this)` lands on the ELEVENTH — the
 *                 clamped subtraction leaves 3.06e-17 after ten, which is
 *                 not `<= 0`. **The wall and the key's cage end HERE**, 34
 *                 updates after the tag.
 *
 * ⇒ a ledger that read the kill tick as the removal tick would walk into a
 * solid for 34 ticks, and one that read the removal as the tag would report
 * `{19,0}` 34 ticks late.
 *
 * ── ⛓ AND `stabbing` SURVIVES THE KILL ────────────────────────────────
 *
 * `ShieldBoss.hit`'s `movedShield` arm is `super.hit(...); sit();`, and
 * `sit()` is `if (currentAnim != "die")` — so on the KILLING hit `sit()` is
 * a no-op and `stabbing` is left TRUE. `endAnim` then runs its
 * `if (stabbing) switch(currentAnim)` with `currentAnim == "die"`, which
 * falls to `default:` and does nothing, and the `if (currentAnim == "die")`
 * below it sets `destroy`. The switch's default arm is load-bearing: a
 * `case "die"` there would have re-entered the chain from a corpse.
 */

import { rect } from './levelWorld.js';
import {
    MOBILE_DEATH_FADE, createEnemyDamage, enemyHit, mobileDeath,
} from './enemyDamage.js';

export class ShieldBossError extends Error {
    constructor(message) { super(message); this.name = 'ShieldBossError'; }
}
const fail = (m) => { throw new ShieldBossError(m); };

/** `Engine.as:270` — `MAX_ELAPSED`, the decimal literal, not `1/30`. */
export const FP_ELAPSED_CLAMPED = 0.0333;

/**
 * `Spritemap.update`, simulated at double precision.
 *
 * ⚠ A SECOND DERIVATION ON PURPOSE. `r6Acceptance.animCallbackUpdate` owns
 * the rung's table and this owns the class's clock; `shieldBossFight.test.js`
 * asserts the two agree on all five rows. One table with two computations is
 * the shape [[feedback_two_cost_models_must_agree]] asks for — a single
 * shared helper would make the table's `expect` column self-confirming.
 *
 * @returns {number} the update index on which `callback()` (i.e. `endAnim`)
 *   fires, or `Infinity` for a `frameRate` of 0 (which is a REAL case:
 *   `add("sit", [0])` takes the default 0 and its `_timer` never moves).
 */
export function shieldBossAnimUpdates(frameRate, frameCount) {
    if (!Number.isInteger(frameCount) || frameCount <= 0) {
        fail(`shieldBossAnimUpdates: frameCount must be a positive integer, got ${frameCount}`);
    }
    if (!(frameRate >= 0)) fail(`shieldBossAnimUpdates: frameRate must be >= 0, got ${frameRate}`);
    const step = frameRate * FP_ELAPSED_CLAMPED;
    if (step === 0) return Infinity;
    let timer = 0;
    let index = 0;
    for (let update = 1; update <= 100000; update += 1) {
        timer += step;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index === frameCount) return update;
        }
    }
    return fail(`shieldBossAnimUpdates: ${frameCount} frames at ${frameRate}/s never wrapped`);
}

/**
 * The five `sprShieldBoss.add(...)` calls, verbatim and in the ctor's order.
 *
 * `frames` is the FRAME INDEX ARRAY, not a count — `hitPlayer`'s damage arm
 * tests `sprShieldBoss.frame`, which is `_anim._frames[_index]`, so the
 * VALUES matter and a model that kept only the length could not answer it.
 */
export const SHIELD_BOSS_ANIMS = Object.freeze({
    sit: Object.freeze({ frames: Object.freeze([0]), frameRate: 0 }),
    stab: Object.freeze({ frames: Object.freeze([3, 4, 5, 6, 7, 8]), frameRate: 15 }),
    moveShield: Object.freeze({ frames: Object.freeze([0, 1]), frameRate: 15 }),
    movedShield: Object.freeze({ frames: Object.freeze([2]), frameRate: 2 }),
    die: Object.freeze({
        frames: Object.freeze([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]), frameRate: 15,
    }),
});

/** Every anim's callback index, derived once from the table above. */
export const SHIELD_BOSS_ANIM_UPDATES = Object.freeze(
    Object.fromEntries(Object.entries(SHIELD_BOSS_ANIMS).map(
        ([name, a]) => [name, shieldBossAnimUpdates(a.frameRate, a.frames.length)],
    )),
);

/** 23 — the die animation, and the distance from the tag to the corpse. */
export const SHIELD_BOSS_DIE_UPDATES = SHIELD_BOSS_ANIM_UPDATES.die;

/**
 * 16 — `movedShield`, THE ONLY WINDOW.
 *
 * ⚠ It is 16 GRAPHIC UPDATES, and the window a PLAYER can hit in is a
 * different span by one tick at each end — see `shieldBossWindowFor`.
 */
export const SHIELD_BOSS_WINDOW_UPDATES = SHIELD_BOSS_ANIM_UPDATES.movedShield;

/** `ShieldBoss.as`'s own constants, at the names the class gives them. */
export const SHIELD_BOSS = Object.freeze({
    as3: 'Enemies/ShieldBoss.as',
    /** `super(_x + Tile.w * 1.5, _y + Tile.h * 2, …)` — ⚠ ASYMMETRIC. */
    ctorOffset: Object.freeze({ dx: 24, dy: 32 }),
    /** `setHitbox(48, 48, 24, 24)`. */
    hitbox: Object.freeze({ w: 48, h: 48, ox: 24, oy: 24 }),
    /** `type = "ShieldBoss"`, which `Mobile.as:17` lists among `solids`. */
    type: 'ShieldBoss',
    /** `Enemy.hitsMax` is 3 and the class does not change it; sword `d` is 1. */
    hitsMax: 3,
    /** `Enemy.hitsTimerMax`, unchanged. */
    hitsTimerMax: 30,
    /** `swingTimeMax` — the stand-under count, in `hitPlayer` calls. */
    swingTimeMax: 120,
    /** `swingForce` — the push `p.hit(this, swingForce, …)` applies. */
    swingForce: 6,
    /** `Enemy.damage`, unchanged: one heart per stab. */
    damage: 1,
    /** `sprShieldBoss.frame >= 5 && <= 8` — the stab's damaging frames. */
    damagingFrames: Object.freeze({ from: 5, to: 8 }),
    /** `hitPlayer`'s band is `Tile.h` tall. */
    bandHeight: 16,
    /** Boss music arms at `FP.distance(x, y, p.x, p.y) <= 96`, every frame. */
    musicRange: 96,
    /**
     * ⛔ `activeOffScreen` is NOT set, so `Enemy.update`'s first line applies:
     * off camera, the whole update returns and the band counter, the i-frame
     * and the damage arm all freeze.
     */
    activeOffScreen: false,
    src: Object.freeze({
        ctor: 'ShieldBoss.as:30-50',
        check: 'ShieldBoss.as:53-60',
        startDeath: 'ShieldBoss.as:62-66 — persistence FIRST, no `destroy`',
        update: 'ShieldBoss.as:68-86',
        hitPlayer: 'ShieldBoss.as:103-127',
        hit: 'ShieldBoss.as:129-150',
        startStab: 'ShieldBoss.as:170-179',
        endAnim: 'ShieldBoss.as:190-218',
        deadArm: 'Player.as:1097-1100 — `e is ShieldBoss` is DEAD CODE; `e is Enemy` '
            + 'catches him four arms above it',
    }),
});

/**
 * ⛔ THE ARM `Player.genericHit` NEVER REACHES.
 *
 * `genericHit`'s chain opens `if (e is Enemy) … else if (e is Grass) …` and
 * `ShieldBoss extends Enemy`, so the `else if (e is ShieldBoss)` five arms
 * down can never run. The live call is therefore
 * `hit(swordForce = 5, new Point(x, y), swordDamage = 1, "Sword")` and not
 * the dead arm's `hit(0, null, d)` — the two differ in `f` and `p`, both of
 * which reach `knockback`, which this class overrides EMPTY. So the game
 * cannot tell them apart *today*; the census note exists because a future
 * knockback would make the difference the whole fight.
 */
export const SHIELD_BOSS_DEAD_ARM = Object.freeze({
    site: 'Player.as:1097-1100',
    unreachableBecause: '`e is Enemy` (Player.as:1077) catches every `ShieldBoss`',
    wouldHaveCalled: 'hit(0, null, d)',
    actuallyCalls: 'hit(swordForce 5, new Point(x, y), swordDamage 1, "Sword")',
    observable: false,
    why: '`ShieldBoss.knockback` is an empty override, so `f` and `p` reach nothing',
});

/**
 * A live ShieldBoss.
 *
 * @param {object} spec `{id, x, y, tag}` — `x`/`y` are the ENTITY point
 *   (the `.oel` placement plus `ctorOffset`), which is where `setHitbox`'s
 *   origins are measured from.
 */
export function createShieldBoss({ id = 'shieldboss', x, y, tag = -1 } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`createShieldBoss needs the ENTITY point, got (${x}, ${y})`);
    }
    // ⚠ The damage half is `enemyDamage`'s, not a second copy. `hits`,
    // `hitsTimer`, the five gates, the fade and `totalEnemies` bookkeeping
    // all live there; this file owns only what `ShieldBoss.as` overrides.
    const damage = createEnemyDamage('ShieldBoss', {
        hitsMax: SHIELD_BOSS.hitsMax,
        damage: SHIELD_BOSS.damage,
    });
    return {
        ...damage,
        id,
        x,
        y,
        tag,
        /** `sprShieldBoss.play("sit")` in the constructor. */
        anim: 'sit',
        animTimer: 0,
        animIndex: 0,
        frame: SHIELD_BOSS_ANIMS.sit.frames[0],
        /** The three instance fields the state machine turns on. */
        activated: false,
        stabbing: false,
        retaliation: false,
        playedSound: false,
        swingTime: 0,
        /** Set by `startDeath`, which is NOT `destroy`. */
        tagWritten: false,
        /**
         * `FP.world.remove(this)` has been CALLED and `updateLists()` has
         * not drained it yet — one tick, and the body is a wall for all of
         * it. See `stepShieldBoss`'s die arm.
         */
        removeRequested: false,
        /** `Game.levelMusics[level] = Game.bossMusic` — proximity, no latch. */
        bossMusicArmed: false,
    };
}

/** The 48x48 body — `null` once the entity has left the world. */
export function shieldBossBodyRect(b) {
    if (b.removed) return null;
    const { w, h, ox, oy } = SHIELD_BOSS.hitbox;
    return rect(b.x - ox, b.y - oy, w, h);
}

/**
 * `hitPlayer()`'s own rect: `(x - originX, y - originY + height, width,
 * Tile.h)`.
 *
 * ⛔ IT IS NOT THE HITBOX AND IT IS NOT CENTRED ON HIM. It is the 48-wide
 * strip directly BELOW the body, 16 px tall, and it is both the damage
 * volume of the stab and the trigger volume of the stand-under. One rect,
 * two jobs, and the stance has to be inside it for both.
 */
export function shieldBossBandRect(b) {
    const { w, h, ox, oy } = SHIELD_BOSS.hitbox;
    return rect(b.x - ox, b.y - oy + h, w, SHIELD_BOSS.bandHeight);
}

/** Does the CURRENT frame damage? `frame >= 5 && frame <= 8` — stab only. */
export function shieldBossFrameDamages(b) {
    return b.frame >= SHIELD_BOSS.damagingFrames.from
        && b.frame <= SHIELD_BOSS.damagingFrames.to;
}

/** `sprShieldBoss.play(name)` — FlashPunk's own early return included. */
export function playShieldBossAnim(b, name) {
    const a = SHIELD_BOSS_ANIMS[name];
    if (!a) fail(`playShieldBossAnim: no animation "${name}" on ShieldBoss`);
    // `Spritemap.play(name, reset=false)`: `if (!reset && _anim && _anim._name
    // == name) return _anim;` — a re-play of the SAME animation keeps its
    // timer. Every call site in this class passes the default.
    if (b.anim === name) return false;
    b.anim = name;
    b.animTimer = 0;
    b.animIndex = 0;
    b.frame = a.frames[0];
    return true;
}

/**
 * `sit()` — `if (currentAnim != "die") { play("sit"); stabbing = false;
 * retaliation = false; }`.
 *
 * ⛔ THE GUARD IS WHY A KILL LEAVES `stabbing` TRUE. See the file header.
 */
export function shieldBossSit(b) {
    if (b.anim === 'die') return false;
    playShieldBossAnim(b, 'sit');
    b.stabbing = false;
    b.retaliation = false;
    return true;
}

/**
 * `startStab(_retaliation)` — and both of its gates are real.
 *
 * @returns {{started: boolean, refusedAt: ?string}}
 */
export function shieldBossStartStab(b, retaliation) {
    if (b.hitsTimer > 0) return { started: false, refusedAt: 'hitsTimer' };
    if (b.anim !== 'sit') return { started: false, refusedAt: `anim "${b.anim}" != "sit"` };
    b.stabbing = true;
    b.retaliation = retaliation;
    playShieldBossAnim(b, 'moveShield');
    return { started: true, refusedAt: null };
}

/** `startDeath(t)` — the override. Persistence FIRST, and no `destroy`. */
export function shieldBossStartDeath(b) {
    b.tagWritten = true;
    b.dying = true;
    playShieldBossAnim(b, 'die');
}

/**
 * `endAnim()` — the Spritemap callback, in the source's order.
 *
 * ⚠ THE SECOND `if` READS `currentAnim` AFTER THE SWITCH MAY HAVE CHANGED
 * IT. Transcribed as two sequential statements rather than folded into the
 * switch, because that ordering is the only thing keeping a `die` callback
 * out of the stab chain.
 */
export function shieldBossEndAnim(b) {
    b.playedSound = false;
    if (b.stabbing) {
        switch (b.anim) {
            case 'moveShield':
                playShieldBossAnim(b, b.retaliation ? 'stab' : 'movedShield');
                break;
            case 'movedShield':
                playShieldBossAnim(b, 'stab');
                break;
            case 'stab':
                shieldBossSit(b);
                break;
            default:
                // ⛓ "die" lands HERE, and that is what makes a kill during a
                // stab chain safe. See the file header.
                break;
        }
    }
    if (b.anim === 'die') b.destroy = true;
}

/**
 * `World.update`'s post-entity `e._graphic.update()`, for this body.
 *
 * ⛓⛓ IT RUNS OUTSIDE `if (e.active)` AND AFTER `e.update()` IN THE SAME
 * PASS (§8.2). So the animation advances once per world update whatever the
 * entity's own `update()` decided — which is why the die animation still
 * completes while `ShieldBoss.update` is calling `death()` instead of
 * `super.update()`.
 *
 * @returns {boolean} whether `endAnim` fired on this update.
 */
export function advanceShieldBossGraphic(b) {
    const a = SHIELD_BOSS_ANIMS[b.anim];
    if (!a) fail(`advanceShieldBossGraphic: no animation "${b.anim}"`);
    const step = a.frameRate * FP_ELAPSED_CLAMPED;
    if (step === 0) return false;                // `sit` — `_timer` never moves
    b.animTimer += step;
    if (!(b.animTimer >= 1)) return false;
    let fired = false;
    while (b.animTimer >= 1) {
        b.animTimer -= 1;
        b.animIndex += 1;
        if (b.animIndex === a.frames.length) {
            // Every anim on this class LOOPS (`add`'s `loop` default is true),
            // so the wrap resets the index and fires the callback.
            b.animIndex = 0;
            fired = true;
            shieldBossEndAnim(b);
            break;
        }
    }
    // `if (_anim) _frame = uint(_anim._frames[_index])` — AFTER the loop, so
    // an `endAnim` that swapped the animation writes the NEW one's frame 0.
    const now = SHIELD_BOSS_ANIMS[b.anim];
    b.frame = now.frames[b.animIndex];
    return fired;
}

/**
 * `ShieldBoss.hit(f, p, d, t)` — the player's side.
 *
 * ⚠ CALL IT AFTER `stepShieldBoss` AND `advanceShieldBossGraphic` FOR THE
 * SAME TICK. `Player` is added at `Game.as:2092` and the boss at `:2222`;
 * `addUpdate` PREPENDS, so the boss and its graphic both run before the
 * player's `slash()` in the same `World.update` pass. The animation the
 * sword sees is this tick's, not last tick's.
 *
 * @returns {{swallowed, landed, killed, aborted, refusedAt, retaliated}}
 */
export function shieldBossTakesHit(b, {
    d = 1, f = 5, t = 'Sword', frozen = false,
} = {}) {
    const no = (extra) => ({
        swallowed: false, landed: false, killed: false, aborted: false,
        retaliated: false, refusedAt: null, ...extra,
    });
    if (b.removed) return no({ refusedAt: 'removed — the entity has left the world' });
    // ⛔ THE ARMING DISPATCH, above everything. It does not read the
    // animation, it does not touch `swingTime`, and it cannot retaliate.
    if (!b.activated) {
        b.activated = true;
        return no({ swallowed: true, refusedAt: 'activated — the swallowed first hit' });
    }
    if (b.anim === 'movedShield') {
        const verdict = enemyHit(b, { d, f, t, frozen });
        if (verdict.killed) shieldBossStartDeath(b);
        // ⛔ `sit()` IS OUTSIDE `Enemy.hit`'s gates. A hit that lands in the
        // window while the i-frame is still up damages NOTHING and still
        // aborts the chain — a free abort, and the reason this returns
        // `aborted` separately from `landed`.
        const aborted = shieldBossSit(b);
        return no({
            landed: verdict.landed,
            killed: verdict.killed,
            aborted,
            refusedAt: verdict.refusedAt,
        });
    }
    if (!b.playedSound) b.playedSound = true;       // Music.playSound("Metal Hit")
    const { started, refusedAt } = shieldBossStartStab(b, true);
    return no({ retaliated: started, refusedAt: started ? null : refusedAt });
}

/**
 * ONE `ShieldBoss.update()`, plus `Enemy.update` and `Mobile.mobileUpdate`
 * beneath it — the whole entity-side tick, in the game's order.
 *
 * ⛔ THE `v` HALF IS A TRANSCRIBED NO-OP, NOT AN OMISSION. `mobileUpdate`
 * runs `friction(); input(); moveX(v.x); moveY(v.y);` and this class writes
 * `v` nowhere — `input()` is `Mobile`'s empty body and `knockback` is
 * overridden empty — so the body never moves a pixel. `Point.normalize` on
 * the zero vector is skipped by the runtime, so even the friction is exact.
 *
 * @param {object} ctx
 * @param {?object} ctx.playerBox  the player's rect, or null when absent
 * @param {boolean} ctx.onScreen   `Entity.onScreen()` — `activeOffScreen` is
 *   false on this class, so a false here returns from `Enemy.update`'s FIRST
 *   line and stops the counter, the i-frame and the damage arm together
 * @param {number}  ctx.tileT      `getState()` — the tile under his origin
 * @param {?number} ctx.playerDist `FP.distance(x, y, p.x, p.y)`, for the music
 * @returns {{hitCalls, bandOccupied, swingTime, startedStab, removedNow,
 *            destroyedNow, anim}}
 */
export function stepShieldBoss(b, {
    playerBox = null, onScreen = true, tileT = null, playerDist = null,
} = {}) {
    const out = {
        hitCalls: 0,
        bandOccupied: false,
        swingTime: b.swingTime,
        startedStab: false,
        removedNow: false,
        destroyedNow: false,
        anim: b.anim,
        refusedAt: null,
    };
    if (b.removed) { out.refusedAt = 'removed'; return out; }

    // `ShieldBoss.update`'s own head: the music arm, ABOVE the die test and
    // outside every gate. It reads `nearestToPoint("Player", …)`, so it runs
    // off screen and during the die animation too.
    if (playerDist !== null && playerDist <= SHIELD_BOSS.musicRange) b.bossMusicArmed = true;

    if (b.anim === 'die') {
        // ⛔ THE DIE ARM CALLS `death()` DIRECTLY — it does NOT go through
        // `Enemy.update`, so the `onScreen` early return does not apply and
        // the fade cannot be stalled by the camera.
        const before = b.removed || b.removeRequested;
        mobileDeath(b);
        // ⛔⛔⛔ `FP.world.remove` IS DEFERRED, AND THE PLAYER UPDATES AFTER
        // HIM. `World.remove` pushes to `_remove`, which `updateLists()`
        // drains AFTER `World.update` — so on the tick `Mobile.death`'s
        // eleventh fade call asks for the removal, the body is STILL in the
        // "ShieldBoss" type list, and the Player (added at `Game.as:2092`,
        // i.e. LAST in the update order) collides with it one more time.
        // ⇒ the request and the disappearance are DIFFERENT TICKS, and the
        // game said so: the first recording of this window had the model
        // walking north at tick 443 and the game still pinned at 90.05.
        if (b.removed && !before) {
            b.removed = false;
            b.removeRequested = true;
            out.removeRequestedNow = true;
        }
        out.removedNow = false;
        out.anim = b.anim;
        out.swingTime = b.swingTime;
        return out;
    }

    // ── `Enemy.update` ────────────────────────────────────────────────
    if (!(SHIELD_BOSS.activeOffScreen || onScreen)) {
        out.refusedAt = 'onScreen — `Enemy.update`\'s first line';
        return out;
    }
    if (tileT !== null && (tileT === 1 || tileT === 6 || tileT === 17)) {
        fail(`stepShieldBoss: the tile under (${b.x},${b.y}) is t=${tileT}, which `
            + '`Enemy.update`\'s state switch treats as water, a pit or lava. This class '
            + 'has `dieInWater`/`dieInLava` at their defaults, so the body would destroy '
            + 'itself. L19 is t=5 under him; a level that is not is a model question, '
            + 'not a silent pass.');
    }
    // `Mobile.mobileUpdate` — the moves are no-ops (see the docblock) and
    // `death()` at its tail cannot fire while `destroy` is false.
    mobileDeath(b);
    if (b.destroy) {
        // `Enemy.update`'s `if (!destroy) { hitUpdate(); hitPlayer(); }`.
        out.destroyedNow = true;
        out.anim = b.anim;
        return out;
    }
    // `hitUpdate()` — the i-frame, decremented once, not freeze-gated.
    if (b.hitsTimer > 0) b.hitsTimer -= 1;
    // `hitPlayer()` — the override.
    const band = shieldBossBandRect(b);
    const inBand = !!playerBox && playerBox.x < band.right && playerBox.right > band.x
        && playerBox.y < band.bottom && playerBox.bottom > band.y;
    out.bandOccupied = inBand;
    if (shieldBossFrameDamages(b) && inBand && !b.destroy) out.hitCalls += 1;
    if (inBand && b.anim === 'sit') {
        b.swingTime += 1;
        if (b.swingTime >= SHIELD_BOSS.swingTimeMax) {
            b.swingTime = 0;
            out.startedStab = shieldBossStartStab(b, false).started;
        }
    } else {
        b.swingTime = 0;
    }
    out.swingTime = b.swingTime;
    out.anim = b.anim;
    return out;
}

// ── THE SCHEDULE, DERIVED ─────────────────────────────────────────────

/**
 * The tick offsets of one stand-under cycle, measured from the update on
 * which `hitPlayer` fired `startStab(false)`.
 *
 * ⛔ THE PLAYER'S WINDOW IS NOT THE ANIMATION'S WINDOW. `moveShield` runs
 * its `SHIELD_BOSS_ANIM_UPDATES.moveShield` graphic updates on ticks
 * `T … T+4` (the first of them is the SAME tick `startStab` ran, because
 * the graphic step follows the entity step in one pass), so `movedShield`
 * is already up when the PLAYER updates on tick `T+4`. It ends when
 * `movedShield`'s own 16th update fires `endAnim` — on tick `T+19`'s
 * graphic step, which is again BEFORE the player. ⇒ the sword may land on
 * `T+4 … T+19`, sixteen ticks, shifted one earlier at each end from the
 * animation's own `T+5 … T+20`.
 *
 * @returns {{startStab, windowFrom, windowTo, stabFrom, retaliationStabFrom,
 *            damageFrom, damageTo, cycle}}
 */
export function shieldBossWindowFor(startStabTick) {
    if (!Number.isInteger(startStabTick)) {
        fail(`shieldBossWindowFor: pass the tick startStab ran, got ${startStabTick}`);
    }
    const move = SHIELD_BOSS_ANIM_UPDATES.moveShield;      // 5
    const window = SHIELD_BOSS_ANIM_UPDATES.movedShield;   // 16
    // `moveShield` advances on T … T+move-1 and swaps at the END of T+move-1.
    const windowFrom = startStabTick + move - 1;
    const windowTo = windowFrom + window - 1;
    return {
        startStab: startStabTick,
        /** Inclusive: the ticks a player-side `hit()` sees `"movedShield"`. */
        windowFrom,
        windowTo,
        /** The tick a player-side call would first see `"stab"` instead. */
        stabFrom: windowTo + 1,
        /** A RETALIATION skips `movedShield` entirely: moveShield -> stab. */
        retaliationStabFrom: startStabTick + move - 1,
        /**
         * The stab's damaging frames are 5..8, i.e. `_index` 2..5 — reached
         * at `ceil(2 / 0.4995)` = 5 and left after `_index` passes 5.
         */
        damageFrom: windowTo + 1 + stabIndexReachedAt(2) - 1,
        damageTo: windowTo + 1 + stabIndexReachedAt(6) - 2,
        /** The stand-under count that opens the NEXT one. */
        cycle: SHIELD_BOSS.swingTimeMax,
    };
}

/** The graphic update on which `stab`'s `_index` first reaches `i`. */
export function stabIndexReachedAt(i) {
    const step = SHIELD_BOSS_ANIMS.stab.frameRate * FP_ELAPSED_CLAMPED;
    let timer = 0;
    let index = 0;
    for (let update = 1; update <= 1000; update += 1) {
        timer += step;
        while (timer >= 1) { timer -= 1; index += 1; }
        if (index >= i) return update;
    }
    return fail(`stabIndexReachedAt: index ${i} is past the stab animation`);
}

/**
 * The three instants of the death, from the tick the killing hit lands.
 *
 * ⚠ THE HIT LANDS IN THE **PLAYER'S** UPDATE, which is below the boss's own
 * graphic step for that tick — so the die animation's first advance is on
 * the tick AFTER the kill, and every number here is measured from there.
 */
export function shieldBossDeathSchedule(killTick) {
    if (!Number.isInteger(killTick)) {
        fail(`shieldBossDeathSchedule: pass the tick the third hit landed, got ${killTick}`);
    }
    // `{19,0}` is written by `startDeath`, inside the hit itself.
    const tagTick = killTick;
    // 23 graphic updates, the first on killTick + 1 -> `destroy` at the end
    // of killTick + 23.
    const destroyTick = killTick + SHIELD_BOSS_DIE_UPDATES;
    // From the tick after that, `ShieldBoss.update`'s die arm calls
    // `death()` once per tick and `Mobile.death` fades. The eleventh call
    // CALLS `FP.world.remove`...
    const removeRequestedTick = destroyTick + MOBILE_DEATH_FADE.ticks;
    // ...and `updateLists()` drains it after `World.update`, so the body is
    // still a wall for the whole of that tick and the cell opens on the
    // NEXT one. ⛔ THE GAME'S OWN RECORDING IS WHAT SET THIS FENCEPOST: the
    // first cut walked north one tick early and the replay caught it.
    const removedTick = removeRequestedTick + 1;
    return {
        tagTick,
        destroyTick,
        removeRequestedTick,
        removedTick,
        dieUpdates: SHIELD_BOSS_DIE_UPDATES,
        fadeTicks: MOBILE_DEATH_FADE.ticks,
        /** What each instant releases. */
        releases: Object.freeze({
            tag: '`{19,0}` — the kill witness, and `check()`\'s despawn on re-entry',
            destroy: 'the sprite stops rendering; `totalEnemies()` still counts him',
            removeRequested: '`FP.world.remove` is CALLED — and the body is still in '
                + 'the type list for the rest of this tick, so the player collides once '
                + 'more',
            removed: 'the "ShieldBoss" solid AND the key\'s cage — both end HERE, one '
                + 'tick after the request, when `updateLists()` has drained it',
        }),
    };
}

/**
 * `Pickups/BossKey.as` — the key inside the body.
 *
 * ⛔ `_attract` IS FALSE (`super(…, null, false)`), so there is no 24 px
 * pull and no `minSpeedToPlayer` glide: the only way to take it is for the
 * player's own box to overlap its 8x8 one. And `special` is true with a
 * `text`, so taking it is a CEREMONY — `Game.freezeObjects` for
 * `specialTimer` = 150 frames and then a dialogue page — not a step.
 */
export const BOSS_KEY = Object.freeze({
    as3: 'Pickups/BossKey.as',
    /** `super(_x + Tile.w/2, _y + Tile.h/2, …)`. */
    ctorOffset: Object.freeze({ dx: 8, dy: 8 }),
    /** `setHitbox(8, 8, 4, 4)`. */
    hitbox: Object.freeze({ w: 8, h: 8, ox: 4, oy: 4 }),
    attract: false,
    special: true,
    specialTimerMax: 150,
    text: 'You got a key!~Keys open locks of their color.',
    /** `removed()` — `if (doActions) Player.hasKeySet(keyType, true)`. */
    onRemoved: 'Player.hasKeySet(keyType, true)',
    /**
     * ⛓ `check()` is `if (Player.hasKey(keyType)) { doActions = false;
     * remove }` — a BUILD-TIME despawn keyed on the inventory, with no
     * persistence tag anywhere in the class. The key is therefore its own
     * flag: holding it is what stops it coming back.
     */
    check: 'Player.hasKey(keyType) -> doActions = false, then remove',
    persistTag: null,
});

/** The key's box at its entity point. */
export function bossKeyRect(k) {
    const { w, h, ox, oy } = BOSS_KEY.hitbox;
    return rect(k.x - ox, k.y - oy, w, h);
}

/**
 * Can the player take the key on this tick?
 *
 * ⛔ THE ANSWER IS "NOT UNTIL THE BODY LEAVES THE WORLD", and the reason is
 * geometry rather than a flag: the key's 8x8 box is wholly inside the
 * boss's 48x48 one, `"ShieldBoss"` is in `Mobile.solids`, and the player's
 * own box cannot enter a solid. So the gate is `removedTick`, 34 ticks
 * after the tag — not the tag, and not `destroy`.
 */
export function bossKeyReachable(boss, key) {
    if (!boss) return { reachable: true, blockedBy: null };
    const body = shieldBossBodyRect(boss);
    if (!body) return { reachable: true, blockedBy: null };
    const box = bossKeyRect(key);
    const inside = box.x >= body.x && box.right <= body.right
        && box.y >= body.y && box.bottom <= body.bottom;
    return {
        reachable: false,
        blockedBy: inside
            ? 'the ShieldBoss body, which CONTAINS the key\'s whole box'
            : 'the ShieldBoss body',
    };
}
