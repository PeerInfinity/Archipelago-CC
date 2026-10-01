/**
 * seedlingDemo/bobBossFight — L32's encounter, STEPPED.
 *
 * Seedling swim U5, the BobBoss simulation family (the user licensed it on
 * 2026-10-01 after U5's W0 measured that the model played none of it).
 * `bobBoss.js` holds the encounter's facts: the arena, the rock's numbers,
 * the three forms' text, and the Fire. This module is the per-frame
 * arithmetic over them, transcribed from:
 *
 *   `Enemies/BobBoss.as`    the ctor's form switch, `update`, the two
 *                           sword overrides, `hit`, and `death`'s transition
 *   `Enemies/BobSoldier.as` `update`, `playerActions` (the chase),
 *                           `swordSpinningBegin`/`Stop`, `swordHitting`
 *   `Enemies/Enemy.as`      `update`'s tail (`hitUpdate`, `hitPlayer`), `hit`
 *   `Mobile.as`             `mobileUpdate`, `friction`, `moveX`/`moveY`
 *   `Scenery/FallRockLarge.as` the arm test and the fall's frame count
 *   `NPCs/BobBossNPC.as`    the dialogue's open-and-page rule
 *
 * The model owns no world here. The caller (`levelRun`) passes the solid
 * sweep, the player's box and the player's point, and it applies what comes
 * back (hits on the player, the teleport, `receiveInput`, the spawns). That
 * keeps this module free of the run's state and testable on its own.
 *
 * ── ⛔ FOUR THINGS THE SOURCE SAYS THAT A FIRST READING GETS WRONG ─────
 *
 * 1. **FORMS 0 AND 1 NEVER STOP SPINNING.** `BobBoss.swordSpinningStep`
 *    overrides the base class's stop test, and only form 2's case keeps
 *    one (a full turn, then the next sword). So after the first
 *    `swordSpinningBegin`, forms 0 and 1 spin for ever, and form 1's second
 *    blade turns at a quarter of the first's rate.
 * 2. **`swordSpinningBeginCheck` IGNORES THE DISTANCE.** The base class
 *    begins only `if (d <= attackRange)`; the override drops the test. So
 *    the boss starts its swing the moment its reset timer allows, wherever
 *    the player is.
 * 3. **THE CHASE RUNS DURING THE TRANSITION.** `BobSoldier.update` calls
 *    `playerActions` after `super.update()` whether or not `destroy` is set,
 *    so a dying boss keeps pushing `v` toward the player, and `death()` reads
 *    that `v.y` (`v.y = Math.min(0, v.y)`) on the next frame.
 * 4. **THE BODY CONTACT IS GATED ON THE BOSS'S OWN I-FRAMES.**
 *    `Enemy.hitPlayer` tests `hitsTimer <= 0`, so for 30 frames after each
 *    landed sword hit the body cannot hurt the player. The sword lines have
 *    no such gate.
 */

import {
    ARENA, BOB_BOSS_FORMS, BOSS_IFRAMES, BOSS_LINE_LENGTH, BOSS_TEXT_SPEED, FIRE,
    FORM_TELEPORT_AT, FORM_TRANSITION_FRAMES, FORMING_FRAMES, ROCK, rockSchedule,
} from './bobBoss.js';
import { applyFriction } from './chasers.js';
import { collideLineSolid } from './crusher.js';
import { beginDialogue } from './dialogue.js';

export class BobBossFightError extends Error {
    constructor(message) { super(message); this.name = 'BobBossFightError'; }
}
const fail = (m) => { throw new BobBossFightError(m); };

/** `BobSoldier.swordSpinRate = Math.PI / 10`, before the ctor negates and divides it. */
const BASE_SPIN_RATE = Math.PI / 10;
/** `BobSoldier.runRange` — the chase leash. `attackRange` is dead (note 2). */
const RUN_RANGE = 80;
/** `sprBobBossWeapons = new Spritemap(img, 24, 5)` — `weaponLength = width`. */
const WEAPON_LENGTH = 24;
/** `setHitbox(14, 14, 7, 7)` in `BobBoss`'s ctor (overriding BobSoldier's 8x8). */
export const BOB_BOSS_BOX = Object.freeze({ w: 14, h: 14, ox: 7, oy: 7 });
/** The death's per-frame lift: `v.y = Math.min(0, v.y); v.y -= 1.2; y += v.y`. */
const DEATH_LIFT = 1.2;
/** `FP.width / 2`, `FP.height - 40` — where the transition pins the player. */
const TRANSITION_PIN = ARENA.transitionTo;

/**
 * The ctor's per-form switch (`BobBoss.as:43-74`), with the class defaults
 * the switch leaves alone written beside the ones it sets.
 *
 * ⚠ `swordSpinRate = -swordSpinRate` comes BEFORE the switch's division, so
 * each rate is `(-(π/10)) / k`, computed in that order to keep the float.
 */
export const BOB_BOSS_FORM_STATS = Object.freeze([
    Object.freeze({ spinDivisor: 4, damage: 2, hitsMax: 2, moveSpeed: 0.5, swords: 1, resetMax: 60 }),
    // ⛔ hitsMax 3 and damage 1 are `Enemy`'s defaults: case 1 sets neither.
    Object.freeze({ spinDivisor: 3, damage: 1, hitsMax: 3, moveSpeed: 0.65, swords: 2, resetMax: 60 }),
    Object.freeze({ spinDivisor: 2, damage: 1, hitsMax: 2, moveSpeed: 0.5, swords: 2, resetMax: 0 }),
]);

/**
 * `new BobBoss(72, 72, form)`. Every construction site in the game passes
 * (72, 72): the rock's spawn and `death()`'s `FP.width/2 - Tile.w/2`. The
 * BobSoldier ctor adds the half tile.
 */
export function createBobBossBody(form) {
    const s = BOB_BOSS_FORM_STATS[form];
    if (!s) fail(`createBobBossBody: form ${form} is not 0, 1 or 2`);
    if (BOB_BOSS_FORMS[form].hitsMax !== s.hitsMax) {
        fail(`createBobBossBody: form ${form}'s hitsMax disagrees with bobBoss.BOB_BOSS_FORMS`);
    }
    return {
        id: `bobboss#${form}`,
        form,
        x: ARENA.bossAt.x,
        y: ARENA.bossAt.y,
        v: { x: 0, y: 0 },
        hits: 0,
        hitsMax: s.hitsMax,
        hitsTimer: 0,
        damage: s.damage,
        moveSpeed: s.moveSpeed,
        formingTimer: FORMING_FRAMES,
        destroy: false,
        nextBossTimer: FORM_TRANSITION_FRAMES,
        swords: s.swords,
        swordSpin: [Math.PI * 3 / 2, Math.PI / 2, Math.PI, 0],
        swordSpinBegin: [0, 0],
        swordIndex: 0,
        swordSpinning: false,
        swordSpinRate: (-BASE_SPIN_RATE) / s.spinDivisor,
        swordSpinResetTimerMax: s.resetMax,
        swordSpinResetTimer: 0,
        /** Frames this body has stepped since it was added (a readout). */
        age: 0,
    };
}

/** The 14x14 box at the body's point, as a `{x, y, w, h, right, bottom}` rect. */
export function bobBossBox(b) {
    const x = b.x - BOB_BOSS_BOX.ox;
    const y = b.y - BOB_BOSS_BOX.oy;
    return { x, y, w: BOB_BOSS_BOX.w, h: BOB_BOSS_BOX.h,
        right: x + BOB_BOSS_BOX.w, bottom: y + BOB_BOSS_BOX.h };
}

/** One sword's hit line, `swordHitting`'s two points for blade `i`. */
export function bobBossSwordLine(b, i) {
    const a = -b.swordSpin[i];
    return {
        x0: b.x + (WEAPON_LENGTH / 2) * Math.cos(a), y0: b.y + (WEAPON_LENGTH / 2) * Math.sin(a),
        x1: b.x + WEAPON_LENGTH * Math.cos(a), y1: b.y + WEAPON_LENGTH * Math.sin(a),
    };
}

const sign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));
const normalize = (v, len) => {
    const m = Math.hypot(v.x, v.y);
    return m === 0 ? v : { x: (v.x / m) * len, y: (v.y / m) * len };
};

/**
 * `BobSoldier.playerActions`' chase block. The leash is measured to the
 * player's point; the boss has no `targetOffset`.
 */
function chase(b, player) {
    const d = Math.hypot(b.x - player.x, b.y - player.y);
    if (d <= RUN_RANGE) {
        const ms = b.moveSpeed;
        const a = Math.atan2(player.y - b.y, player.x - b.x);
        const toV = { x: ms * Math.cos(a), y: ms * Math.sin(a) };
        const pushed = Math.hypot(b.v.x, b.v.y) > ms;
        let v = { x: b.v.x + sign(toV.x - b.v.x) * ms, y: b.v.y + sign(toV.y - b.v.y) * ms };
        if (!pushed && Math.hypot(v.x, v.y) > ms) v = normalize(v, ms);
        b.v = v;
    }
    // `swordSpinningBeginCheck(d)`, BobBoss's override: no range test (note 2).
    if (!b.swordSpinning) {
        if (b.swordSpinResetTimer > 0) {
            b.swordSpinResetTimer--;
        } else {
            b.swordSpinResetTimer = b.swordSpinResetTimerMax;
            b.swordSpinning = true;
            const i = b.swordIndex;
            b.swordSpin[i] = b.swordSpinBegin[i] = (b.swordSpin[i] + 2 * Math.PI) % (2 * Math.PI);
        }
    }
}

/** `BobBoss.swordSpinningStep` (note 1). */
function spin(b) {
    if (!b.swordSpinning) return;
    const i = b.swordIndex;
    if (b.form === 0) {
        b.swordSpin[i] += b.swordSpinRate;
    } else if (b.form === 1) {
        b.swordSpin[0] += b.swordSpinRate;
        b.swordSpin[1] += b.swordSpinRate / 4;
    } else {
        b.swordSpin[i] += b.swordSpinRate;
        if (Math.abs(b.swordSpin[i] - b.swordSpinBegin[i]) >= Math.PI * 2) {
            // `swordSpinningStop(swordSpin[swordIndex])` — the angle is unchanged.
            b.swordSpinning = false;
            b.swordIndex = (b.swordIndex + 1) % b.swords;
        }
    }
}

/**
 * ONE `BobBoss.update()`.
 *
 * @param {object} b       a `createBobBossBody` state, MUTATED
 * @param {object} ctx
 * @param {{x, y}} ctx.player      the player's point as this frame found it
 * @param {object} ctx.playerBox   the player's box at that point
 * @param {boolean} ctx.frozen     `Game.freezeObjects` when the boss updates
 * @param {function} ctx.blocked   `(box) => boolean`, the `Mobile.solids` test
 * @returns {{playerHits: Array, transition: ?object, spawn: ?object}}
 *   `playerHits` are `Player.hit` calls in the order the game makes them;
 *   `transition` is `death()`'s write this frame, if any; `spawn` names what
 *   the end of the transition adds (`{form}` or `{fire: true}`).
 */
export function stepBobBossBody(b, { player, playerBox, frozen, blocked }) {
    const out = { playerHits: [], transition: null, spawn: null };
    if (frozen) return out;
    b.age++;
    if (b.formingTimer > 0) {
        b.formingTimer--;
        return out;
    }
    // ── Enemy.update -> Mobile.mobileUpdate ────────────────────────────
    // `activeOffScreen = true`, and L32 is open floor (no water, lava or
    // pit under any cell the boss reaches), so the terrain switch is a no-op.
    if (!b.destroy) {
        b.v = applyFriction(b.v);
        moveAxis(b, b.v.x, 'x', blocked);
        moveAxis(b, b.v.y, 'y', blocked);
    }
    // `death()`, called by `mobileUpdate` on every frame.
    if (b.destroy) {
        if (b.nextBossTimer <= 0) {
            out.spawn = b.form < 2 ? { form: b.form + 1 } : { fire: true, at: { ...FIRE.at } };
            out.transition = { done: true, receiveInput: true, hits: 0, directionFace: -1 };
            b.removed = true;
            return out;
        }
        b.nextBossTimer--;
        b.swords = 0;
        b.v = { x: b.v.x, y: Math.min(0, b.v.y) - DEATH_LIFT };
        b.y += b.v.y;
        out.transition = {
            done: false,
            nextBossTimer: b.nextBossTimer,
            pin: b.nextBossTimer <= FORM_TELEPORT_AT ? { ...TRANSITION_PIN } : null,
            receiveInput: false,
            directionFace: 1,
        };
    }
    if (!b.destroy) {
        // `hitUpdate()` then `hitPlayer()` (note 4).
        if (b.hitsTimer > 0) b.hitsTimer--;
        if (b.hitsTimer <= 0 && overlapsStrict(bobBossBox(b), playerBox)) {
            out.playerHits.push({ arm: 'body', force: 3, damage: b.damage, from: { x: b.x, y: b.y } });
        }
    }
    // ── BobSoldier.update's own tail (note 3) ──────────────────────────
    chase(b, player);
    spin(b);
    for (let i = 0; i < b.swords; i++) {
        const l = bobBossSwordLine(b, i);
        if (collideLineSolid([playerBox], l.x0, l.y0, l.x1, l.y1)) {
            out.playerHits.push({ arm: `sword${i}`, force: 3 * b.damage, damage: b.damage,
                from: { x: b.x, y: b.y } });
        }
    }
    return out;
}

/** `Mobile.moveX`/`moveY`: 1 px steps, the last `min(1, |rel| - i)`, stop at the first collider. */
function moveAxis(b, rel, axis, blocked) {
    const n = Math.abs(rel);
    const s = sign(rel);
    for (let i = 0; i < n; i++) {
        const step = Math.min(1, n - i) * s;
        const nx = axis === 'x' ? b.x + step : b.x;
        const ny = axis === 'y' ? b.y + step : b.y;
        if (blocked(bobBossBox({ x: nx, y: ny }))) return;
        b.x = nx;
        b.y = ny;
    }
}

/** `Entity.collide`'s strict overlap. */
function overlapsStrict(a, c) {
    return a.right > c.x && a.bottom > c.y && a.x < c.right && a.y < c.bottom;
}

/**
 * `BobBoss.hit(f, p, d, t)` from a player's `genericHit` — the sword arm.
 *
 * ⛔ The super call passes force 0 and point null, so nothing is knocked
 * back. Form 2's override adds a sword and re-seeds EVERY blade first, but
 * only when the base gate would let the hit through.
 *
 * @returns {{landed: boolean, killed: boolean, refusedAt: ?string}}
 */
export function bobBossHit(b, { d, t = 'Sword', frozen = false }) {
    if (b.removed) return { landed: false, killed: false, refusedAt: 'removed' };
    if (b.hitsTimer <= 0 && b.form === 2 && !frozen) {
        b.swords++;
        for (let i = 0; i < b.swords; i++) {
            b.swordSpinBegin[i] = Math.PI * 3 / 2 + 2 * Math.PI / b.swords * i;
            b.swordSpin[i] = b.swordSpinBegin[i];
        }
    }
    if (!(b.hitsTimer <= 0) || frozen) {
        return { landed: false, killed: false, refusedAt: frozen ? 'frozen' : 'hitsTimer' };
    }
    if (t === 'Fire') return { landed: false, killed: false, refusedAt: 'Fire' };
    if (!(b.hits < b.hitsMax)) return { landed: false, killed: false, refusedAt: 'hits >= hitsMax' };
    b.hits += d;
    b.hitsTimer = BOSS_IFRAMES;
    if (b.hits >= b.hitsMax) {
        b.destroy = true;
        return { landed: true, killed: true, refusedAt: null };
    }
    return { landed: true, killed: false, refusedAt: null };
}

/**
 * The arena rock's arm test, `FallRockLarge.update`'s `bossRock` branch:
 * `!p.fallFromCeiling && p.y < fallTo - sprRock.height / 2 - 8`.
 */
export function bobBossRockArms(playerY, { fallFromCeiling = false } = {}) {
    return !fallFromCeiling && playerY < ROCK.armY;
}

/** The arena rock's landed box, its ctor's `setHitbox(32, 32, 16, 16)`. */
export function bobBossRockRect() {
    const r = ROCK.sealsRect;
    return { x: r.x, y: r.y, w: r.w, h: r.h, right: r.x + r.w, bottom: r.y + r.h };
}

/**
 * The frames from the arm to the release, which are the bot's dead frames.
 * The arm frame itself is a live tape tick with a frozen player; the
 * `bossSpawnsAt` frames after it are dead, and the last of them (the
 * release) moves the player one unobserved step.
 */
export const BOB_BOSS_ROCK_DEAD_FRAMES = rockSchedule().bossSpawnsAt;

/**
 * A `BobBossNPC`'s dialogue, as `dialogue.beginDialogue` state.
 * `super(_x, _y, null, -1, _text, 6)`: no line length, so `NPC`'s default 28.
 */
export function beginBobBossDialogue(form, framesThisCharacter) {
    return beginDialogue(BOB_BOSS_FORMS[form].text, {
        framesThisCharacter,
        framesPerCharacter: BOSS_TEXT_SPEED,
        lineLength: BOSS_LINE_LENGTH,
    });
}
