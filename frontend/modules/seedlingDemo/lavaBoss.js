/**
 * seedlingDemo/lavaBoss — THE KING OF FIRE (`Enemies/LavaBoss.as`, L82), transcribed.
 *
 * ⛓⛓⛓ seedling-fidelity-bosskills D2 (wave 20), behind `CONTACT_FIDELITY.kingOfFireFight` (OFF). The AS3 is
 * PeerInfinity/Seedling @ccdf189776 (`vendor/seedling/src`); every number below is cited at its line.
 *
 * ── THE FIGHT, IN THE GAME'S OWN TERMS ─────────────────────────────────────────────────────────────────────────
 * The body is a 64x58 `type = "LavaBoss"` rect (`LavaBoss.as:44-46`) at its ctor point `(x + 48, y + 40)` (`:26`), a
 * wall to the player (`Player.as:377`) and to a LavaRunner (`LavaRunner.as:43`), and to nothing else: a LavaBall's and
 * a WandShot's lists do not carry the type. It never touches the player (`hitPlayer` is an empty override, `:126-128`)
 * and is never knocked back (`:118-120`).
 *
 * It does nothing until the player stands within 3/4 of a screen on both axes, not falling from the ceiling
 * (`:101-110`); from then on it runs ONE DETERMINISTIC CYCLE (`endAnim`, `:211-272`), measured on p4g (D1):
 *
 *     sit 19 · smash 16 → two LavaRunners · smashback 16 · armsup 22 · sweep 10 → five LavaBalls · sweepback 16
 *
 * = 99 updates (the first `sit` is 20: the sprite's `active` is read at the top of the update that wakes it).
 *
 * The DAMAGE GATE (`hit`, `:143-174`) counts a hit only inside a window a reflected LavaBall opens:
 *   · a `"LavaBall"` hit with `hitsTimer <= 0` opens a 120-update window (`hitsTimerMax`, `:51`) and counts NOTHING;
 *   · inside it, the FIRST non-LavaBall hit counts (`hits += 1`), re-arms 120 and closes it (`lastHitType` moves);
 *   · `hitByDarkStuff` (a `"Shield"`/`"Suit"` hit) would let any hit count — ⚠ and NOTHING CAN SET IT HERE: the dark
 *     shield's bump collects `["Enemy", "ShieldBoss"]` (`Player.as:100`, `:1691-1703`), and the dark suit retaliates
 *     only on a `Player.hit(e)` with an `e`, which this body never calls. Transcribed, unreachable, asserted below.
 * The third count is `startDeath` (`:130-141`): `destroy`, "die" (7 frames at 5 = 43 updates), the report
 * `setPersistence(tag, false)` — the (82,0) AP location — and then "dead", whose `render()` takes 0.01 of alpha per
 * frame until `FP.world.remove` (`:190-197`). The body stays a wall until that removal.
 *
 * A LavaBall (`Projectiles/LavaBall.as`) moves `v` a tick through every solid (`solids = []`), then dies on the first
 * `["Player", "Tree", "Solid", "Shield"]` it overlaps (`:20`, `:56-85`) — a player contact is `Player.hit(null,
 * v.length, ball)` — leaving an `Explosion` (radius `int(16) * 0.65` → 10, force 4, `Explosion.as:26-68`) that lands at
 * the frame's `updateLists()`. ANY player swing that reaches it (`Player.genericHit` → `LavaBall.hit`, `:45-53`)
 * reverses it at twice the speed and adds `"LavaBoss"` to its list: that is the ball that opens the window.
 *
 * A LavaRunner (`Enemies/LavaRunner.as`) is a `Bob` (runRange 1000, hitsMax 2) that first JUMPS: `jumpV` -3, +0.2 a
 * tick, `collidable = false` (so it passes through everything — FlashPunk's `collide` returns null on a
 * non-collidable self) until it is back at `startY = y + 16` (`:55-69`, `:98-104`). Grounded, it is an ordinary
 * bridged chaser (`chasers.js`, `CHASERS.lavarunner`), which is how `levelRun` steps it.
 *
 * ── WHAT IS NOT MODELLED, BY NAME ────────────────────────────────────────────────────────────────────────────────
 *   · `Rng.cos()` in `render` (`:184`, the sweep's scale wobble) and the Explosion's sprite angle: cosmetic (⚖ user
 *     2026-10-10, never model the cosmetic RNG);
 *   · a FIRE press on the body (`hitByFire` false → `knockback`, an empty override): refused upstream
 *     (`FIRE_ARM_POLICY.LavaBoss`), unchanged;
 *   · nothing else: the Explosion's `Enemy` arm on the BOSS (a reflected ball's list carries "LavaBoss", so its
 *     disc can land `Enemy.hit(4, p, 1)` with `t` "") is stepped — though a ball dies on the body's EDGE, ≥ 29 px
 *     from the origin the disc is measured to, outside its 10 px.
 */

import { FP_ELAPSED } from './chasers.js';
import { pointLength, pointNormalize } from './playerPhysicsV1.js';

export class LavaBossError extends Error {
    constructor(message) { super(message); this.name = 'LavaBossError'; }
}
const fail = (m) => { throw new LavaBossError(m); };

/** `Enemies/LavaBoss.as`, in its own numbers. */
export const LAVA_BOSS = Object.freeze({
    as3: 'Enemies/LavaBoss.as',
    /** `super(_x + 48, _y + 40, …)` (`:26`). */
    ctorDx: 48,
    ctorDy: 40,
    /** `setHitbox(64, 58, 32, 29)` (`:46`). */
    hitbox: Object.freeze({ w: 64, h: 58, originX: 32, originY: 29 }),
    /** `Enemy.hitsMax` (`Enemy.as:22`), not overridden. */
    hitsMax: 3,
    /** `hitsTimerMax = 120` (`:51`). */
    hitsTimerMax: 120,
    /** `FP.screen.height * 3 / 4` and `.width * 3 / 4` (`:102`); the screen is 160 x 160. */
    wakeRange: 120,
    screenHalf: 80,
    /** The smash's two runners (`:222-236`): offsets from the body, and `Tile.w` / `Tile.h`. */
    runnerOffsets: Object.freeze([Object.freeze({ dx: -34, dy: 32 }), Object.freeze({ dx: 34, dy: 32 })]),
    tile: 16,
    /** The sweep's fan (`:249-255`): five balls at `(x, y + 32)`, speed `shotSpeed` 1 (`:19`), over PI. */
    ballCount: 5,
    ballDy: 32,
    shotSpeed: 1,
    /**
     * `(FP.world as Game).playerPosition = new Point(152, 176)` in the CTOR (`:53`): the point a death's
     * `restartLevel()` rebuilds the room at — the RESPAWN, not the arrival (an arrival keeps its own point).
     */
    respawn: Object.freeze({ x: 152, y: 176 }),
    /** `Game.shake = 15` on the sweep's end (`:246`). */
    sweepShake: 15,
    /** `render()`'s fade in "dead" (`:192`), per rendered frame. */
    deadAlphaStep: 0.01,
});

/**
 * The animations (`:28-37`): `[frames, rate]`. Every one LOOPS (FlashPunk's `add` default), so its end calls
 * `endAnim` and, unless that plays another, starts over. "dead" has rate 0 (`add("dead", [27])`) and never advances.
 */
export const LAVA_BOSS_ANIMS = Object.freeze({
    sit: Object.freeze([5, 8]),
    smash: Object.freeze([5, 10]),
    smashback: Object.freeze([5, 10]),
    armsup: Object.freeze([7, 10]),
    sweep: Object.freeze([3, 10]),
    sweepback: Object.freeze([5, 10]),
    hit: Object.freeze([2, 10]),       // `hitsTimerInt` = 10 (`Enemy.as:25`)
    hitplayer: Object.freeze([1, 10]),
    die: Object.freeze([7, 5]),
    dead: Object.freeze([1, 0]),
});

/** `Projectiles/LavaBall.as`, in its own numbers. */
export const LAVA_BALL = Object.freeze({
    as3: 'Projectiles/LavaBall.as',
    /** `setHitbox(24 * sc, 24 * sc, 12 * sc, 12 * sc)` with `sc` 0.5 (`:21`, `:36`). */
    hitbox: Object.freeze({ w: 12, h: 12, originX: 6, originY: 6 }),
    /** The Spritemap is 48 wide (`:18`): `onScreen(48)` culls it (`:86`). */
    cullMargin: 48,
    /** `v.x = -v.x * 2; v.y = -v.y * 2` (`:50-51`). */
    reflectScale: 2,
    /** `new Explosion(x + v.x, y + v.y, hitables, 32 * sc, 1)` (`:82`). */
    explosionRadiusArg: 16,
    explosionDamage: 1,
});

/**
 * `Projectiles/Explosion.as`: `radius:int`, so `radius *= radiusCoeff` (0.65, `:20`) TRUNCATES — 16 → 10.4 → 10.
 * The square prefilter is `radius * 2` on a side around the centre (`:52`), then `FP.distance(x, y, c.x, c.y) <=
 * radius` against the body's ORIGIN (`:56`). Force 4 (`:19`).
 */
export const LAVA_EXPLOSION = Object.freeze({
    radius: Math.trunc(16 * 0.65),
    force: 4,
});

/** `Enemies/LavaRunner.as`: the jump (`:20-24`, `:98-104`) and the body (`:36-43`). */
export const LAVA_RUNNER = Object.freeze({
    as3: 'Enemies/LavaRunner.as',
    tag: 'lavarunner',
    jumpV: -3,
    gravity: 0.2,
    /** `startY = y + Tile.h`. */
    landDy: 16,
    /** `lr.runRange = 1000` (`:232`). */
    runRange: 1000,
    /** `Bob`'s ctor adds `Tile.w / 2`, `Tile.h / 2` (`Bob.as:31`). */
    ctorOffset: 8,
    /** `Mobile.DEFAULT_FRICTION` and its dead zone (`Mobile.as:14`, `:76-83`). */
    friction: 0.25,
    epsilon: 0.05,
});

const ANIM_NAMES = Object.keys(LAVA_BOSS_ANIMS);

/** FlashPunk's `Spritemap.play(name)`: a no-op on the anim already playing, a reset otherwise. */
function play(spr, name) {
    if (!ANIM_NAMES.includes(name)) fail(`play: "${name}" is not a LavaBoss animation`);
    if (spr.name === name) return;
    spr.name = name;
    spr.timer = 0;
    spr.index = 0;
}

/** The boss's world box (`setHitbox(64, 58, 32, 29)` around the body). */
export function lavaBossRect(b) {
    const { w, h, originX, originY } = LAVA_BOSS.hitbox;
    const x = b.x - originX;
    const y = b.y - originY;
    return { x, y, w, h, right: x + w, bottom: y + h };
}

/** A LavaBall's world box. */
export function lavaBallRect(s) {
    const { w, h, originX, originY } = LAVA_BALL.hitbox;
    const x = s.x - originX;
    const y = s.y - originY;
    return { x, y, w, h, right: x + w, bottom: y + h };
}

/**
 * The fight's per-visit state, built from the `.oel` placement (`lavaboss x=112 y=48 tag=0` in L82).
 * `tag` is the body's own (`LavaBoss(_x, _y, _tag)`); a cleared tag never reaches here — `check()` removes the body
 * on its first frame (`:59-66`), which `buildLevelWorld`'s persistence arm already answers (`'despawn'`).
 */
export function createLavaBossFight(e) {
    if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.y)) fail('createLavaBossFight: needs the .oel placement');
    const tag = Number.isInteger(e.tag) ? e.tag : -1;
    return {
        id: `lavaboss@${e.x},${e.y}`,
        tag,
        boss: {
            x: e.x + LAVA_BOSS.ctorDx,
            y: e.y + LAVA_BOSS.ctorDy,
            spr: { name: 'sit', timer: 0, index: 0 },
            startAttacking: false,
            hits: 0,
            hitsTimer: 0,
            lastHitType: '',
            hitByDarkStuff: false,
            destroy: false,
            alpha: 1,
            removeRequested: false,
            removed: false,
        },
        balls: [],
        /** Runners spawned this frame, in ADD order; `levelRun` hands them to the chaser roster at `updateLists()`. */
        spawnedRunners: [],
        /** Balls spawned this frame (add order); they join `balls` at `updateLists()`, newest FIRST. */
        spawnedBalls: [],
        /** Explosions queued this frame, landing at `updateLists()`. */
        explosions: [],
        seq: 0,
        /** The ledger: `{t, kind, …}` per event the fight makes — the witness's join and the solver's read. */
        events: [],
        cameraTarget: null,
        report: null,
        reportBanked: false,
    };
}

/**
 * `LavaBoss.hit(f, p, d, t)` (`:143-174`) — the damage gate, verbatim. Returns what happened, for the ledger.
 * `frozen` is `Game.freezeObjects`. `canHit` is never written by this class (always true).
 */
export function lavaBossHit(fight, t, { frozen = false } = {}) {
    const b = fight.boss;
    if (b.removed) fail('lavaBossHit: the body has been removed');
    let counted = false;
    let opened = false;
    let died = false;
    const gate = (b.hitsTimer <= 0 && t === 'LavaBall') || b.hitByDarkStuff
        || (t !== 'LavaBall' && b.lastHitType === 'LavaBall' && b.hitsTimer > 0);
    if (gate && !frozen) {
        // `if (hitByFire || t != "Fire")`: `hitByFire` is never set here, so a Fire hit is the knockback arm (a no-op).
        if (t !== 'Fire') {
            if (b.hits < LAVA_BOSS.hitsMax) {
                if (t !== 'LavaBall') {
                    b.hits += 1;
                    counted = true;
                } else {
                    opened = true;
                }
                b.hitsTimer = LAVA_BOSS.hitsTimerMax;
                b.hitByDarkStuff = (t === 'Shield' || t === 'Suit');
                if (b.hitByDarkStuff) {
                    fail(`lavaBossHit: a "${t}" hit reached the King of Fire, which nothing in the game can deliver `
                        + '(the dark shield bumps ["Enemy", "ShieldBoss"]; the suit retaliates only on Player.hit(e))');
                }
                if (b.hits >= LAVA_BOSS.hitsMax) {
                    startLavaBossDeath(fight);
                    died = true;
                }
            }
        }
    }
    b.lastHitType = t;
    return { counted, opened, died, hits: b.hits, hitsTimer: b.hitsTimer };
}

/** `startDeath` (`:130-141`): the report is written here, on the killing hit. */
function startLavaBossDeath(fight) {
    const b = fight.boss;
    b.destroy = true;
    play(b.spr, 'die');
    if (fight.report === null) fight.report = { tag: fight.tag };
}

/**
 * `endAnim` (`:211-272`) — the cycle. Called from the graphic update when an animation wraps. Spawns go to the
 * frame's pending lists (`FP.world.add` lands at `updateLists()`).
 */
function lavaBossEndAnim(fight, ctx) {
    const b = fight.boss;
    switch (b.spr.name) {
        case 'sit': play(b.spr, 'smash'); break;
        case 'smash': {
            play(b.spr, 'smashback');
            const T = LAVA_BOSS.tile;
            for (let i = 0; i < LAVA_BOSS.runnerOffsets.length; i += 1) {
                const o = LAVA_BOSS.runnerOffsets[i];
                const box = { x: b.x + o.dx - T / 2, y: b.y + o.dy - T / 2, w: T, h: T };
                box.right = box.x + box.w;
                box.bottom = box.y + box.h;
                // `if (!FP.world.collideRect("Enemy", …))` — a COLLIDABLE "Enemy" body in the 16x16 cell.
                if (ctx.enemyInRect(box)) {
                    fight.events.push({ t: ctx.tick, kind: 'runner-blocked', i, box });
                    continue;
                }
                // `new LavaRunner(x + xpos - Tile.w / 2, y + ypos - Tile.h / 2)` — `LavaRunner(_x:int, _y:int)`.
                const ax = Math.trunc(box.x);
                const ay = Math.trunc(box.y);
                const seq = ++fight.seq;
                const r = {
                    id: `lavarunner#${seq}`,
                    seq,
                    x: ax + LAVA_RUNNER.ctorOffset,
                    y: ay + LAVA_RUNNER.ctorOffset,
                    jumpV: LAVA_RUNNER.jumpV,
                    startY: ay + LAVA_RUNNER.ctorOffset + LAVA_RUNNER.landDy,
                    inAir: true,
                    right: i === 0,
                };
                fight.spawnedRunners.push(r);
                fight.events.push({ t: ctx.tick, kind: 'runner', id: r.id, x: r.x, y: r.y });
            }
            break;
        }
        case 'smashback': play(b.spr, 'armsup'); break;
        case 'armsup': play(b.spr, 'sweep'); break;
        case 'sweep': {
            play(b.spr, 'sweepback');
            ctx.setShake(LAVA_BOSS.sweepShake);
            const n = LAVA_BOSS.ballCount;
            const angle = Math.PI;
            for (let i = 0; i < n; i += 1) {
                // The game's own expression, in its order: `-angle / 2 + i / (numLavaBalls - 1) * angle + Math.PI/2`.
                const ang = -angle / 2 + i / (n - 1) * angle + Math.PI / 2;
                const seq = ++fight.seq;
                const s = {
                    id: `lavaball#${seq}`,
                    seq,
                    // `LavaBall(_x:int, _y:int, _v)` — the args truncate.
                    x: Math.trunc(b.x),
                    y: Math.trunc(b.y + LAVA_BOSS.ballDy),
                    vx: LAVA_BOSS.shotSpeed * Math.cos(ang),
                    vy: LAVA_BOSS.shotSpeed * Math.sin(ang),
                    beenHit: false,
                    hitsBoss: false,
                    removed: false,
                };
                fight.spawnedBalls.push(s);
            }
            fight.events.push({ t: ctx.tick, kind: 'fan', ids: fight.spawnedBalls.map((s) => s.id) });
            break;
        }
        case 'hit': play(b.spr, 'sit'); break;
        case 'die': play(b.spr, 'dead'); break;
        case 'dead': break;
        default: play(b.spr, 'sit');
    }
    if (b.spr.name === 'die') b.destroy = true;
}

/**
 * The boss's graphic update (`World.update`'s `e._graphic.update()`, after the entity's own), FlashPunk's
 * `Spritemap.update` with a looping animation: the wrap resets the index and calls `endAnim`, and a play inside the
 * callback zeroes the timer, which ends the loop.
 */
function lavaBossGraphic(fight, ctx) {
    const b = fight.boss;
    const [frames, rate] = LAVA_BOSS_ANIMS[b.spr.name];
    if (rate <= 0) return;
    b.spr.timer += rate * FP_ELAPSED;
    while (b.spr.timer >= 1) {
        b.spr.timer -= 1;
        b.spr.index += 1;
        if (b.spr.index === frames) {
            b.spr.index = 0;
            lavaBossEndAnim(fight, ctx);
        }
    }
}

/**
 * ONE update of the body, entity half then graphic half (`:74-116`). `ctx`:
 *   `tick` (this update's index), `frozen` (`Game.freezeObjects`), `player` `{x, y, fallFromCeiling}` (where the
 *   previous update left it — the body updates before the player), `enemyInRect(box)`, `setShake(v)`.
 * Returns the camera write: `{x, y}` (`Game.cameraTarget = …`), `{x: -1, y: -1}` (`Game.resetCamera()`), or null
 * (the frame wrote none — frozen, or the body is dying).
 */
export function stepLavaBoss(fight, ctx) {
    const b = fight.boss;
    if (b.removed) return null;
    const active = !ctx.frozen && b.startAttacking;      // `sprLavaBoss.active = …`, read before the body's update
    let camera = null;
    if (!ctx.frozen && !b.destroy) {
        if (b.startAttacking) {
            // `super.update()` → `Enemy.update`: `activeOffScreen`; the terrain switch (the body's centre tile is lava
            // and `dieInLava` is false); `Mobile.mobileUpdate` (v stays 0: knockback is an empty override); then
            // `hitUpdate` (the tick-down) and `hitPlayer` (empty).
            if (b.hitsTimer > 0) b.hitsTimer -= 1;
            if (b.hitsTimer > 0) {
                play(b.spr, b.lastHitType === 'LavaBall' ? 'hit' : 'hitplayer');
            } else if (b.spr.name === 'hit' || b.spr.name === 'hitplayer') {
                play(b.spr, 'sit');
            }
        }
        const p = ctx.player;
        if (p && !p.fallFromCeiling && Math.abs(b.y - p.y) <= LAVA_BOSS.wakeRange
            && Math.abs(b.x - p.x) <= LAVA_BOSS.wakeRange) {
            camera = { x: (b.x + p.x) / 2 - LAVA_BOSS.screenHalf, y: (b.y + p.y) / 2 - LAVA_BOSS.screenHalf };
            if (!b.startAttacking) {
                b.startAttacking = true;
                fight.events.push({ t: ctx.tick, kind: 'wake' });
            }
        } else {
            camera = { x: -1, y: -1 };
        }
    }
    if (active) lavaBossGraphic(fight, ctx);
    if (camera) fight.cameraTarget = camera;
    return camera;
}

/**
 * `render()`'s fade (`:190-197`): only in "dead", 0.01 a rendered frame, and the removal it asks for lands at the
 * NEXT frame's `updateLists()` (`removed()` → `Game.resetCamera()`).
 */
export function renderLavaBoss(fight) {
    const b = fight.boss;
    if (b.removed || !b.destroy || b.spr.name !== 'dead' || b.removeRequested) return false;
    b.alpha -= LAVA_BOSS.deadAlphaStep;
    if (b.alpha <= 0) {
        b.removeRequested = true;
        return true;
    }
    return false;
}

/**
 * ONE update of a LavaBall (`:56-90`). `ctx`:
 *   `frozen`, `playerBox`, `shieldBox` (null without the shield), `blockedAt(box)` (a "Solid"/"Tree" overlap),
 *   `bossBox` (null once the body is removed), `onScreen(box, margin)`.
 * Returns `{removed, hitPlayer, hitBoss, culled, types, explosion}`.
 */
export function stepLavaBall(s, ctx) {
    if (s.removed) fail(`stepLavaBall: ${s.id} has been removed`);
    if (!ctx.frozen) {
        // `Mobile.friction` with f = 0: `v.normalize(max(v.length - 0, 0))`, then the 0.05 dead zone. This is what
        // zeroes the fan's 1.2e-16 / 6e-17 components on the first update.
        const len = pointLength(s.vx, s.vy);
        const n = pointNormalize(s.vx, s.vy, Math.max(len - 0, 0));
        s.vx = Math.abs(n.x) < LAVA_RUNNER.epsilon ? 0 : n.x;
        s.vy = Math.abs(n.y) < LAVA_RUNNER.epsilon ? 0 : n.y;
        // `moveX` / `moveY` in sub-steps of at most 1 against `solids = []`: nothing stops them.
        s.x = subStep(s.x, s.vx);
        s.y = subStep(s.y, s.vy);
    }
    const out = { removed: false, hitPlayer: false, hitBoss: false, culled: false, types: [], explosion: null };
    if (pointLength(s.vx, s.vy) > 0) {
        const box = lavaBallRect(s);
        // `collideTypesInto(hitables, x, y, hits)` in the list's order: Player, Tree, Solid, Shield, (LavaBoss).
        if (ctx.playerBox && overlaps(box, ctx.playerBox)) { out.types.push('Player'); out.hitPlayer = true; }
        if (ctx.blockedAt(box)) out.types.push('Solid');
        if (ctx.shieldBox && overlaps(box, ctx.shieldBox)) out.types.push('Shield');
        if (s.beenHit && ctx.bossBox && overlaps(box, ctx.bossBox)) { out.types.push('LavaBoss'); out.hitBoss = true; }
        if (out.types.length > 0) {
            out.explosion = { x: s.x + s.vx, y: s.y + s.vy, hitsBoss: s.beenHit, from: s.id };
            s.removed = true;
            out.removed = true;
        }
    }
    if (!s.removed && !ctx.onScreen(lavaBallRect(s), LAVA_BALL.cullMargin)) {
        s.removed = true;
        out.removed = true;
        out.culled = true;
    }
    return out;
}

/** `LavaBall.hit()` (`:45-53`) — the reflection, once. */
export function reflectLavaBall(s) {
    if (s.beenHit) return false;
    s.beenHit = true;
    s.vx = -s.vx * LAVA_BALL.reflectScale;
    s.vy = -s.vy * LAVA_BALL.reflectScale;
    return true;
}

/**
 * ONE update of an AIRBORNE LavaRunner (`LavaRunner.update`'s `inAir` arm, `:55-69`): no `super.update()` (so no
 * terrain, no hit test, no i-frame tick), `v = (0, jumpV)`, `Mobile.mobileUpdate` (friction, then the move — through
 * everything, `collidable` false), landed once `y >= startY`. Frozen: `Game.freezeObjects` returns at the top.
 */
export function stepLavaRunnerAir(r, { frozen = false } = {}) {
    if (!r.inAir) fail(`stepLavaRunnerAir: ${r.id} has landed`);
    if (frozen) return false;
    r.jumpV += LAVA_RUNNER.gravity;
    const len = Math.abs(r.jumpV);
    const n = pointNormalize(0, r.jumpV, Math.max(len - LAVA_RUNNER.friction, 0));
    const vy = Math.abs(n.y) < LAVA_RUNNER.epsilon ? 0 : n.y;
    // `v` is the body's own field: the landing update leaves `(0, vy)` for the first grounded one to spend.
    r.vy = vy;
    r.y = subStep(r.y, vy);
    if (r.y >= r.startY) {
        r.inAir = false;
        return true;
    }
    return false;
}

/**
 * An Explosion's `added()` against one body (`Explosion.as:49-66`): the square prefilter on its box, then the disc
 * on its ORIGIN.
 */
export function explosionReaches(ex, box, origin) {
    const r = LAVA_EXPLOSION.radius;
    const sq = { x: ex.x - r, y: ex.y - r, w: r * 2, h: r * 2, right: ex.x + r, bottom: ex.y + r };
    if (!overlaps(sq, box)) return false;
    return Math.sqrt((ex.x - origin.x) ** 2 + (ex.y - origin.y) ** 2) <= r;
}

/**
 * L82's arena rock (`Scenery/FallRockLarge.as` with `bossrock = 1`, `thirdboss = 0`, `fallrocklarge@128,224 tag 1`):
 * it arms when the player, not falling from the ceiling, is above `fallTo - sprRock.height / 2 - 8` (`:71-80`), writes
 * its tag false and freezes the room (`fall()`, `:137-143`), waits 60 frames, falls `vy += 0.6` from y -32 to `fallTo`,
 * holds the camera 90, and releases the freeze on the frame `cameraTimer` reads 0 (`:106-131`) — spawning nothing,
 * since only a `thirdboss` rock does. The arm frame is a tape tick with a frozen player; the rest are DEAD frames.
 * The landed Solid is `setHitbox(32, 32, 16, 16)` around `(x + 16, y + 16)`.
 */
export const LAVA_ARENA_ROCK = Object.freeze({
    as3: 'Scenery/FallRockLarge.as',
    halfHeight: 16,
    armMargin: 8,
    fallFrom: -32,
    fallRate: 0.6,
    waitToFallTimerMax: 60,
    cameraTimerMax: 90,
});

/** The rock's numbers from its `world.fallRocks` row (the OEL point): the arm line, the landed box, the dead frames. */
export function lavaArenaRockSchedule(row) {
    const fallTo = row.y + 16;
    let y = LAVA_ARENA_ROCK.fallFrom;
    let vy = 0;
    let fallTicks = 0;
    while (y < fallTo) {
        vy += LAVA_ARENA_ROCK.fallRate;
        y += vy;
        fallTicks += 1;
        if (fallTicks > 1000) fail('lavaArenaRockSchedule: the rock never lands');
    }
    return {
        armY: fallTo - LAVA_ARENA_ROCK.halfHeight - LAVA_ARENA_ROCK.armMargin,
        rect: { x: row.x, y: row.y, w: 32, h: 32, right: row.x + 32, bottom: row.y + 32 },
        fallTicks,
        // The arm frame spends one wait decrement; then 59 waits, the fall, 90 holds and the release frame.
        deadFrames: LAVA_ARENA_ROCK.waitToFallTimerMax + fallTicks + LAVA_ARENA_ROCK.cameraTimerMax,
    };
}

/** The fight's read for a planner and the witness: positions and phases, no references into the live state. */
export function lavaBossView(fight) {
    const b = fight.boss;
    return {
        id: fight.id,
        boss: { x: b.x, y: b.y, anim: b.spr.name, index: b.spr.index, hits: b.hits, hitsTimer: b.hitsTimer,
            lastHitType: b.lastHitType, startAttacking: b.startAttacking, destroy: b.destroy, alpha: b.alpha,
            removed: b.removed },
        balls: fight.balls.filter((s) => !s.removed).map((s) => ({ id: s.id, x: s.x, y: s.y, vx: s.vx, vy: s.vy,
            beenHit: s.beenHit })),
        report: fight.report ? { ...fight.report } : null,
    };
}

function subStep(p, rel) {
    const n = Math.abs(rel);
    const sgn = rel < 0 ? -1 : (rel > 0 ? 1 : 0);
    for (let i = 0; i < n; i += 1) p += Math.min(1, n - i) * sgn;
    return p;
}

function overlaps(a, b) {
    return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}
