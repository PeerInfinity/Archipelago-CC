/**
 * seedlingDemo/fireVerb — the SECOND weapon, transcribed from `Player.as`.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 6 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §18.6 (the seal that made
 * this necessary) and §18.9 (the order it asked for).
 *
 * `combatVerbs.js` is the sword: a directed rect in front of the player that
 * does damage. This is not that weapon in a different direction. It is an
 * AREA around the player that does NO damage at all, dispatches its hit
 * ELEVEN times per tick, and exists on this route for exactly one reason —
 * `PushableBlockFire.moveTypes` contains `"Fire"` and nothing else the
 * player carries passes it. L39's three lock-holders are behind it, and so
 * therefore are L40–L43, the wand, and the Witch.
 *
 * ── ⛓ THE FIRST RULING: `fireTimer` IS NOT FUEL ───────────────────────
 *
 * §18.9 asked, before anything else, whether fire is a METERED resource —
 * because if it were, L39's six presses would have a budget and the
 * choreography would have to be priced against it. **It is not.**
 *
 * `fireTimer` (`Player.as:180-181`, max 180, `+= 60` per press) is read in
 * exactly two places and both are `Player.render`:
 * `Player.as:1321-1327` decides whether `drawFireOver` is called and with
 * what alpha, and `drawFireOver` (`:1358-1370`) is three `Draw.circlePlus`
 * calls and a `Game.drawCover`. **`set firing` does not test it.** The one
 * place it could have gated anything is `Player.as:866-869`:
 *
 * ```
 *   if (fireTimer >= fireTimerMax)
 *   {
 *       //hit();                       <- COMMENTED OUT IN THE SHIPPED SOURCE
 *       fireTimer = fireTimerMax;
 *   }
 * ```
 *
 * — a clamp with a dead line above it. So the meter is a glow, the glow is
 * a render, and the shaft has no fuel budget. `FIRE_TIMER_MAX` and
 * `FIRE_INCREMENT` are transcribed anyway, with `metered: false` as the
 * claim a later rung can go red against if it ever finds a third reader.
 *
 * ── ⛔ THE FIVE THINGS THE SOURCE MISLEADS YOU ABOUT ──────────────────
 *
 * 1. **THE DISPATCH LOOP IS NESTED, AND `vc` IS NEVER CLEARED.** This is
 *    the difference between `fire()` and `slash()`, and it is one line of
 *    indentation. `slash()` fills its vector across all eleven `hitables`
 *    types and THEN iterates it once (`Player.as:906-911`). `fire()` puts
 *    the `for each` INSIDE the type loop (`:1021-1031`) and
 *    `collideRectInto` APPENDS (`n = into.length`), so the vector still
 *    holds everything the previous ten passes found. A target of type
 *    `hitables[i]` is dispatched `11 - i` times **per tick**: an `"Enemy"`
 *    eleven times, a `"Solid"` — which is every pushable block — five.
 *    Across the five-tick window that is 55 and 25. See
 *    `FIRE_DISPATCHES_BY_TYPE`.
 *
 * 2. **FIRE CANNOT KILL ANYTHING, AND IT DOES NOT SPEND I-FRAMES EITHER.**
 *    `Enemy.hit` (`Enemies/Enemy.as:151`) branches on
 *    `if (hitByFire || t != "Fire")`, and the `else` — the arm every
 *    `"Fire"` hit takes — is a bare `knockback(f, p)` with the
 *    `hitsTimer = hitsTimerMax` line **commented out** beside it. So the
 *    `hitsTimer <= 0` guard above never closes and EVERY ONE of the 55
 *    dispatches lands another 0.325 impulse. ⛓ And `hitByFire` has no
 *    writer anywhere in the source (`Enemy.as:38` declares it `false`;
 *    `Enemy.as:151` and `LavaBoss.as:147` are the only other mentions), so
 *    the damage arm is unreachable for `"Fire"` in the shipped game — a
 *    BOUNDED VACUITY, named here rather than left as silence, and asserted
 *    in the tests as a grep-level claim about the source.
 *
 * 3. **THE RADIUS FILTER READS THE PLAYER'S `originY` FOR THE TARGET.**
 *    `Player.as:1026`, verbatim:
 *
 *    ```
 *      FP.distanceRects(x - originX, y - originY, width, height,
 *                       e.x - e.originX, e.y - originY, e.width, e.height)
 *    ```
 *
 *    The fifth argument is `e.x - e.originX` and the sixth is
 *    `e.y - originY` — **the player's**, not `e.originY`. It is not a typo
 *    a model may tidy: for a 16x16 block (origin 0,0) it shifts the target
 *    rect 2 px UP inside the distance computation, and 2 px is a quarter of
 *    the margin a stance has. `fireRadiusDistance` transcribes it and
 *    `fireRadiusDistanceCorrected` exists ONLY so a test can show the two
 *    disagree.
 *
 * 4. **THE CANDIDATE TEST IS INCLUSIVE, NOT STRICT.**
 *    `Entity.collideRect` is `>=`/`<=` on all four edges, so a block whose
 *    left edge exactly equals the fire rect's right edge IS a candidate.
 *    `levelWorld.rectsOverlap` is strict. ⚠ `combatVerbs.swingHits` uses
 *    the strict one — a latent ±1 on the sword that this slice found and
 *    did NOT fix, because no committed fixture stands on that pixel and a
 *    silent widening of the sword would re-record 59 tapes. Named in §19.
 *
 * 5. **THE ANIMATION IS THE ONLY CLOCK, AND IT LOOPS.**
 *    `sprFire.add("fire", [0..8], 25, true)` — nine frames, 25 fps, **loop
 *    true** — so `Spritemap.update` never sets `complete` and the callback
 *    fires on the WRAP. `fireEnd()` is that callback and all it does is
 *    `firing = false`. There is no `fireDelay`, no `fireTimerMax` gate and
 *    no analogue of `slashTimer`: the cadence is the animation's own length
 *    and nothing else. See `FIRE_TIMELINE`.
 *
 * ── THE TICK MAP, and why it is not the sword's ───────────────────────
 *
 * `Player.update`'s order is `fire()` … `super.update()` (which reaches
 * `Mobile.input` -> `useItem` -> `firing = true` -> `sprFire.play`) …
 * `sprites()` (which is the only `sprFire.update()`). So a press on tick T
 * is set AFTER that tick's hit test and the sprite takes its first update at
 * the END of tick T — which means tick `T + n` reads the frame after `n`
 * updates. Simulating `Spritemap.update`'s `while (_timer >= 1)` loop with
 * `FP.elapsed` pinned at `MAX_ELAPSED` gives frames 3..6 on ticks **T+4 to
 * T+8** — five hit ticks — and the wrap on the ELEVENTH UPDATE, which runs
 * at the end of tick **T+10**. So `firing` is up for T..T+10 inclusive, a
 * press on T+10 is swallowed by `useItem`'s `if (!firing)` (it runs in
 * `super.update()`, before `sprites()`), and **T+11 is the next press that
 * fires**.
 *
 * ⚠ DERIVED BY SIMULATION, NOT BY DIVISION — the `HIT_TO_GONE_TICKS`
 * lesson, one weapon later, and it BITES here: `25 * 0.0333 = 0.8325`
 * stalls on frame **4** (tick T+6 repeats it) while `25 * (1/30)` stalls on
 * frame 5. The hit window is the same five ticks either way, but the frame
 * a test pins is not, and 0.0333 is what `Engine.as:270` holds.
 *
 * ── WHAT THIS MODULE IS NOT ───────────────────────────────────────────
 *
 * It does not choose stances. The fire rect is centred on the player and
 * the push is directed AWAY from the player, so the stance grammar is the
 * OPPOSITE of R4's facing-pushes and it is `r5Shaft.js`'s problem, not
 * this one. This is the primitive that file is scored against.
 */

import { assertRect, rect } from './levelWorld.js';
import { HITBOX } from './playerPhysicsV1.js';
import { HITABLE_TYPES } from './combatVerbs.js';
import { FP_MAX_ELAPSED } from './breakableRocks.js';

export class FireVerbError extends Error {
    constructor(message) { super(message); this.name = 'FireVerbError'; }
}
const fail = (m) => { throw new FireVerbError(m); };

/**
 * `sprFire` — `Player.as:53` + the constructor's `centerOO()` and `add()`.
 *
 * ⚠ `origin` is HALF THE FRAME because of `centerOO()`, which is what makes
 * the collide rect centred on the player rather than hanging off them; the
 * sword's three sprites all have `originX` forced back to 0.
 */
export const FIRE_SPRITE = Object.freeze({
    w: 32,
    h: 32,
    originX: 16,
    originY: 16,
    frameCount: 9,
    frameRate: 25,
    loop: true,
    src: 'Player.as:53 Spritemap(imgFire, 32, 32, fireEnd) + :424-425 centerOO() / '
        + 'add("fire", [0..8], 25, true)',
});

/** `Player.fire()`'s two locals (`Player.as:1016-1017`). */
export const FIRE_HIT_FRAME_START = 3;
export const FIRE_HIT_FRAME_END = 6;

/** `Player.fireForce` (`:179`) — the knockback impulse, per dispatch. */
export const FIRE_FORCE = 0.325;

/**
 * `Player.fireDamage` (`:178`) — and it is **0**, with `// .5` commented
 * beside it. Fire never kills. Kept as a named constant so an arithmetic
 * that divides by it fails loudly instead of returning Infinity.
 */
export const FIRE_DAMAGE = 0;

/** The `t` string `fire()` dispatches with (`Player.as:1030`). */
export const FIRE_HIT_TYPE = 'Fire';

/**
 * ⛓ THE METER, and the ruling that it is one.
 *
 * `metered: false` is the load-bearing field: it is the answer to §18.9's
 * first question, and the shaft's choreography is priced against it.
 */
export const FIRE_METER = Object.freeze({
    max: 180,
    increment: 60,
    metered: false,
    readers: Object.freeze([
        'Player.as:1321-1327 — `if (fireTimer > 0)` chooses which `drawFireOver` alpha',
        'Player.as:1358-1370 — `drawFireOver`: three `Draw.circlePlus` + `Game.drawCover`',
    ]),
    why: 'both readers are inside `Player.render`, and `set firing` (`:858-872`) does not '
        + 'test it at all. `Player.as:866-869`\'s `if (fireTimer >= fireTimerMax)` body is '
        + 'a clamp with the only interesting line — `//hit();` — commented out in the '
        + 'shipped source. So the meter is a glow: a press is always available and the '
        + 'only thing that gates the next one is the animation.',
});

/**
 * `Spritemap.update`'s `while (_timer >= 1)` loop, simulated.
 *
 * ⚠ SIMULATED, NOT DIVIDED. `_timer += frameRate * FP.elapsed` and the
 * `while` can advance the index more than once on a tick (it does not here,
 * at 0.8325 per tick) or not at all (it does — twice per wrap). A closed
 * form gets the window's LENGTH right and the frame ON A GIVEN TICK wrong,
 * which is the half a hit test reads.
 *
 * @param {object=} anim  `{frameCount, frameRate, loop}`; defaults to `FIRE_SPRITE`
 * @param {number=} elapsed  `FP.elapsed`; defaults to `Engine.MAX_ELAPSED`
 * @param {number=} ticks  how many updates to simulate
 * @returns {object} `{frames, callbackUpdates}` — `frames[k]` is the frame a
 *   hit test on tick `T + k` reads (`frames[0]` is the `play()` frame, before
 *   any update), and `callbackUpdates` the UPDATE INDICES that fired
 *   `callback`.
 *
 * ⚠ **AN UPDATE INDEX IS NOT A TICK.** Update `k` runs in `sprites()` at the
 *   END of tick `T + (k - 1)`, so the wrap on update 11 drops `firing`
 *   during tick T+10 and tick T+11 is the first one that can start a new
 *   press. Conflating the two is a one-tick error in the CADENCE, which is
 *   the one number the shaft's six presses are scheduled from.
 */
export function animTimeline(anim = FIRE_SPRITE, elapsed = FP_MAX_ELAPSED, ticks = 16) {
    if (!(anim.frameCount > 0)) fail('animTimeline: frameCount must be positive');
    // `play(name, true)`: `_index = 0; _timer = 0; _frame = _frames[0]`. The
    // frame list here is the identity [0..8], so index and frame coincide —
    // asserted rather than assumed, because `sprGhostSword`'s is not.
    let timer = 0;
    let index = 0;
    let frame = 0;
    const frames = [0];
    const callbackUpdates = [];
    for (let k = 1; k <= ticks; k += 1) {
        timer += anim.frameRate * elapsed;
        if (timer >= 1) {
            while (timer >= 1) {
                timer -= 1;
                index += 1;
                if (index === anim.frameCount) {
                    if (anim.loop) {
                        index = 0;
                        callbackUpdates.push(k);
                    } else {
                        index = anim.frameCount - 1;
                        callbackUpdates.push(k);
                        break;
                    }
                }
            }
            frame = index;
        }
        frames.push(frame);
    }
    return { frames, callbackUpdates };
}

/** The fire animation's timeline, at the pinned elapsed. */
export const FIRE_TIMELINE = Object.freeze(animTimeline());

/**
 * The press -> window map, DERIVED from `FIRE_TIMELINE`.
 *
 * `hitTicks` are offsets from the press tick T. `endTick` is the tick whose
 * `sprites()` fires `fireEnd` and drops `firing`, so the earliest tick a
 * SECOND press can take effect is `endTick + 1` — a press ON `endTick` is
 * swallowed, because `useItem`'s `if (!firing)` runs in `super.update()`,
 * which is BEFORE `sprites()` in the same tick.
 */
function deriveWindow() {
    const { frames, callbackUpdates } = FIRE_TIMELINE;
    const hitTicks = [];
    const wrapUpdate = callbackUpdates[0];
    if (wrapUpdate === undefined) fail('deriveWindow: the fire animation never wrapped');
    // Update `wrapUpdate` runs at the END of tick T + (wrapUpdate - 1), and
    // that is the tick whose `sprites()` calls `fireEnd`. `firing` is still
    // TRUE for that tick's own hit test and for `useItem`'s `if (!firing)`.
    const endTick = wrapUpdate - 1;
    // ⚠ k STARTS AT 1. `frames[0]` is the frame `play()` left, and the tick
    // that ran `play()` is the PRESS tick — whose `fire()` call happened
    // earlier in the same `Player.update`, while `firing` was still false.
    // The frame there is 0 and so it could not be a hit tick anyway, which
    // is a coincidence rather than a reason: named, and asserted below.
    if (frames[0] >= FIRE_HIT_FRAME_START && frames[0] <= FIRE_HIT_FRAME_END) {
        fail('deriveWindow: `play()` left the sprite inside the hit window, so the press '
            + 'tick\'s own frame is no longer excluded by arithmetic and the `firing` '
            + 'ordering has to carry it explicitly. Re-read `Player.update`\'s order.');
    }
    for (let k = 1; k <= endTick; k += 1) {
        // The hit test on tick T+k runs BEFORE that tick's sprite update, so
        // it reads the frame after `k` updates — and only while `firing` is
        // still up, which is every tick strictly before the wrap.
        if (frames[k] >= FIRE_HIT_FRAME_START && frames[k] <= FIRE_HIT_FRAME_END) {
            hitTicks.push(k);
        }
    }
    return Object.freeze({
        hitTicks: Object.freeze(hitTicks),
        firstHitTick: hitTicks[0],
        lastHitTick: hitTicks[hitTicks.length - 1],
        /** The tick whose `sprites()` fires `fireEnd` and drops `firing`. */
        endTick,
        wrapUpdate,
        frames: Object.freeze([...frames]),
    });
}

export const FIRE_WINDOW = deriveWindow();

/**
 * The gap between two presses that BOTH fire.
 *
 * ⚠ Not a constant chosen for safety like `KILL_PRESS_CADENCE` — this one
 * is exact and it is the animation's. A press at `T + FIRE_WINDOW.endTick`
 * is a silent no-op (`firing` is still true when `useItem` reads it), and a
 * press one tick later replays the animation from frame 0.
 */
export const FIRE_PRESS_CADENCE = FIRE_WINDOW.endTick + 1;

/**
 * `collideRectInto`'s rect: `(x - sprFire.originX, y - sprFire.originY,
 * sprFire.width, sprFire.height)` — 32x32 centred on the player's ENTITY
 * position, which is 2 px right and 2 px down from their hitbox corner.
 */
export function fireRect(px, py) {
    return assertRect(
        rect(px - FIRE_SPRITE.originX, py - FIRE_SPRITE.originY, FIRE_SPRITE.w, FIRE_SPRITE.h),
        `fireRect(${px},${py})`,
    );
}

/**
 * `Entity.collideRect`'s AABB test (`Entity.as`), which is INCLUSIVE on all
 * four edges — see header note 4. `_mask` is null for every `setHitbox`
 * entity, so the mask branch below it is unreachable for this route's
 * candidates and is named here rather than transcribed.
 */
export function collideRectInclusive(box, r) {
    assertRect(box, 'collideRectInclusive box');
    assertRect(r, 'collideRectInclusive rect');
    return box.right >= r.x && box.bottom >= r.y && box.x <= r.right && box.y <= r.bottom;
}

/** `FP.distanceRects` (`FP.as:281-301`), transcribed branch for branch. */
export function distanceRects(x1, y1, w1, h1, x2, y2, w2, h2) {
    const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
    if (x1 < x2 + w2 && x2 < x1 + w1) {
        if (y1 < y2 + h2 && y2 < y1 + h1) return 0;
        if (y1 > y2) return y1 - (y2 + h2);
        return y2 - (y1 + h1);
    }
    if (y1 < y2 + h2 && y2 < y1 + h1) {
        if (x1 > x2) return x1 - (x2 + w2);
        return x2 - (x1 + w1);
    }
    if (x1 > x2) {
        if (y1 > y2) return dist(x1, y1, x2 + w2, y2 + h2);
        return dist(x1, y1 + h1, x2 + w2, y2);
    }
    if (y1 > y2) return dist(x1 + w1, y1, x2, y2 + h2);
    return dist(x1 + w1, y1 + h1, x2, y2);
}

/** `sprFire.width / 2` — the corner cut's threshold, and it is a `>`. */
export const FIRE_RADIUS = FIRE_SPRITE.w / 2;

/**
 * `Player.as:1026`'s distance, INCLUDING the wrong `originY` — header note 3.
 *
 * @param {object} player  `{x, y}` — the entity position
 * @param {object} target  `{x, y, originX, originY, w, h}` — the entity's
 *   own fields, NOT a pre-built box, because the whole point is which
 *   origin gets subtracted from which coordinate.
 */
export function fireRadiusDistance(player, target) {
    requireTarget(target, 'fireRadiusDistance');
    return distanceRects(
        player.x - HITBOX.originX, player.y - HITBOX.originY, HITBOX.width, HITBOX.height,
        // ⚠ `e.x - e.originX` and `e.y - originY`. The second `originY` is
        // the PLAYER's. Transcribed, not corrected.
        target.x - target.originX, target.y - HITBOX.originY, target.w, target.h,
    );
}

/**
 * What the same line would compute if it used `e.originY`.
 *
 * Exists ONLY as the other half of a two-sided test: a model that "fixed"
 * the source silently would still pass every check phrased over itself, so
 * the check is that these two DISAGREE on a target whose `originY` is not
 * the player's — and by how much.
 */
export function fireRadiusDistanceCorrected(player, target) {
    requireTarget(target, 'fireRadiusDistanceCorrected');
    return distanceRects(
        player.x - HITBOX.originX, player.y - HITBOX.originY, HITBOX.width, HITBOX.height,
        target.x - target.originX, target.y - target.originY, target.w, target.h,
    );
}

function requireTarget(target, where) {
    for (const k of ['x', 'y', 'originX', 'originY', 'w', 'h']) {
        if (!Number.isFinite(target?.[k])) {
            fail(`${where}: target needs a finite \`${k}\` — the distance is built from the `
                + 'raw entity fields and an absent origin would read as 0, which is a '
                + 'DIFFERENT and plausible-looking answer rather than an error.');
        }
    }
}

/**
 * ⛔ HOW MANY TIMES ONE TARGET IS DISPATCHED PER HIT TICK — header note 1.
 *
 * `hitables[i]` is scanned on pass `i`, and the `for each (e in vc)` after
 * every pass walks everything found so far. So a target of type
 * `hitables[i]` is dispatched once on each of passes `i .. 10`.
 */
export const FIRE_DISPATCHES_BY_TYPE = Object.freeze(Object.fromEntries(
    HITABLE_TYPES.map((t, i) => [t, HITABLE_TYPES.length - i]),
));

export function fireDispatchCount(type) {
    const n = FIRE_DISPATCHES_BY_TYPE[type];
    if (n === undefined) {
        fail(`fireDispatchCount: "${type}" is not in \`hitables\`. An entity whose type is `
            + 'not in that list is never a candidate at all, which is a different answer '
            + `from "dispatched once"; know [${HITABLE_TYPES.join(', ')}]`);
    }
    return n;
}

/**
 * One tick of `Player.fire()`'s hit test over a declared candidate set.
 *
 * ⚠ No LOS test and no `blockedLine` oracle: `fire()` has neither. The
 * sword's `collideLine("Solid", ...)` has no analogue here — fire reaches
 * through a wall if the 32x32 rect and the 16 px radius both admit the
 * target. That is not an omission in this model; it is `Player.as:1021-1031`
 * having no such line, and it is why a stance for a block behind a wall is
 * a stance this verb will happily take.
 *
 * @param {object}   player  `{x, y}` — the entity position
 * @param {object[]} targets `[{id, type, x, y, originX, originY, w, h}]`
 * @returns {object[]} one row per target hit, with the DISPATCH COUNT
 */
export function fireHits(player, targets) {
    const r = fireRect(player.x, player.y);
    const out = [];
    for (const target of targets) {
        requireTarget(target, `fireHits target ${target.id}`);
        if (!HITABLE_TYPES.includes(target.type)) continue;
        const box = assertRect(
            rect(target.x - target.originX, target.y - target.originY, target.w, target.h),
            `fireHits box ${target.id}`,
        );
        if (!collideRectInclusive(box, r)) continue;
        const d = fireRadiusDistance(player, target);
        if (d > FIRE_RADIUS) continue;
        out.push({
            id: target.id,
            type: target.type,
            t: FIRE_HIT_TYPE,
            force: FIRE_FORCE,
            damage: FIRE_DAMAGE,
            distance: d,
            dispatches: fireDispatchCount(target.type),
        });
    }
    return out;
}

/**
 * `Enemy.hit`'s `"Fire"` arm, as a ruling rather than a number — header
 * note 2. `perPress` is the arithmetic a route has to carry: an enemy
 * inside the rect for the whole window takes `hitTicks * dispatches`
 * knockbacks, each of `FIRE_FORCE`, and takes ZERO damage.
 */
export const FIRE_ON_ENEMY = Object.freeze({
    damage: 0,
    consumesIFrames: false,
    dispatchesPerHitTick: FIRE_DISPATCHES_BY_TYPE.Enemy,
    hitTicks: FIRE_WINDOW.hitTicks.length,
    perPress: FIRE_DISPATCHES_BY_TYPE.Enemy * FIRE_WINDOW.hitTicks.length,
    impulsePerPress: FIRE_FORCE * FIRE_DISPATCHES_BY_TYPE.Enemy * FIRE_WINDOW.hitTicks.length,
    why: '`Enemy.as:151` is `if (hitByFire || t != "Fire")`, and the `else` is a bare '
        + '`knockback(f, p)` with `//hitsTimer = hitsTimerMax;` commented out beside it. '
        + 'So the `hitsTimer <= 0` guard never closes for fire and every dispatch lands. '
        + '`hitByFire` has NO WRITER in the source, so the damage arm is unreachable for '
        + '"Fire" — a bounded vacuity, and the reason "fire never kills" is a property of '
        + 'the shipped game rather than of `fireDamage = 0` alone.',
});

/** `Enemy.knockback` — `atan2(y - p.y, x - p.x)`, i.e. AWAY from the player. */
export function fireKnockback(enemy, player, force = FIRE_FORCE) {
    const a = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    return { vx: force * Math.cos(a), vy: force * Math.sin(a) };
}

/**
 * The press schedule for ONE fire, as a tape input span.
 *
 * Two ticks, for the same reason `SWING_SPAN_TICKS` is two: `Input.pressed`
 * is an edge and a span that runs to `tick_count` never dispatches its
 * release.
 */
export const FIRE_SPAN_TICKS = 2;

/**
 * ⚠ THE EQUIP IS PART OF THE VERB. `useItem` switches on
 * `Inventory.getItem(Main.primary)` and fire is item id **1**; a press with
 * the sword selected is a SLASH, which on a `PushableBlockFire` is a
 * `moveTypes` miss and therefore silence. `tapeFormat.inventorySlotsFor`
 * turns the held-item set into the slot array; the caller passes the slot
 * it resolved, and this verb refuses to schedule a press without one.
 */
export function firePress(atTick, player, targets, { slot = null, equipAt = null } = {}) {
    if (!Number.isInteger(atTick) || atTick < 0) {
        fail(`firePress: atTick must be a non-negative integer, got ${atTick}`);
    }
    if (slot === null) {
        fail('firePress: `slot` is required — the slot `Main.primary` must hold for the '
            + 'press to be a FIRE. Resolve it with `tapeFormat.inventorySlotsFor(items)'
            + '.indexOf(INVENTORY_ITEM_IDS.fire)`; a default would silently schedule a '
            + 'sword slash, which a `PushableBlockFire` ignores in complete silence.');
    }
    return {
        press: atTick,
        slot,
        equips: equipAt === null ? [] : [{ t: equipAt, slot }],
        /** Absolute ticks the hit test runs and can land. */
        hitTicks: FIRE_WINDOW.hitTicks.map((k) => atTick + k),
        firstHitTick: atTick + FIRE_WINDOW.firstHitTick,
        lastHitTick: atTick + FIRE_WINDOW.lastHitTick,
        /** The tick `fireEnd` drops `firing`; the next press lands the tick after. */
        endTick: atTick + FIRE_WINDOW.endTick,
        nextPressTick: atTick + FIRE_PRESS_CADENCE,
        spans: [{ key: 'primary', from: atTick, to: atTick + FIRE_SPAN_TICKS }],
        rect: fireRect(player.x, player.y),
        radius: FIRE_RADIUS,
        expect: fireHits(player, targets),
    };
}

/**
 * ⚠ A FROZEN FRAME BURNS THE WINDOW. `genericHit` returns immediately on
 * `Game.freezeObjects` (`Player.as:1069-1072`), but `sprites()` — the only
 * `sprFire.update()` — is called unconditionally in `Player.update`, and
 * `Player.update` itself runs on a frozen frame (only `blackCover` gates
 * `super.update()` one level up, in `Game.update`). So a press whose window
 * overlaps a 150-tick ceremony advances its animation and lands nothing.
 *
 * The two kinds of dead frame, §18.3, applied to this verb: on a
 * `blackCover` frame the animation does NOT advance (the player does not
 * update at all) and the window merely stretches; on a `freezeObjects`
 * frame it advances and the hits are LOST.
 */
export const FIRE_DEAD_FRAME_RULE = Object.freeze({
    blackCover: 'window stretches — `Game.update` skips `super.update()`, so neither the '
        + 'hit test nor `sprFire.update()` runs',
    freezeObjects: 'window BURNS — `Player.update` still runs, `sprites()` still advances '
        + 'the animation, and `genericHit` returns at its first line',
    src: 'Game.as:813-816 + Player.as:1069-1072 + Player.as:1614-1622',
});
