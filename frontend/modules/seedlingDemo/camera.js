/**
 * seedlingDemo/camera — `Game.view()`, transcribed, because the camera GATES
 * every enemy update.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.1 coupling 2, §3.2.
 *
 * ── WHY A CAMERA IS A PHYSICS QUESTION IN THIS RUNG ───────────────────
 *
 * `Enemy.update` opens with
 *
 *     if (!activeOffScreen && !onScreen()) return;
 *
 * at ZERO MARGIN (`Enemy.as:64-67`). An enemy the camera does not contain
 * does not run `mobileUpdate` — no friction, no `moveX`/`moveY` — and does
 * not run `hitPlayer`. So "where is the camera" and "can this thing move or
 * hurt me" are the same question, and a contact-freedom proof that ignored
 * the camera would be pricing threats that are not running.
 *
 * ⛔ AND THE EARLY RETURN DOES NOT FREEZE THE SUBCLASS. `Bob.update` is
 * `super.update(); …chase…`, so an off-screen Bob still runs its chase block
 * and still accumulates velocity toward the player; what it skips is the
 * movement, the terrain switch, `hitUpdate` and `hitPlayer`. Off-screen
 * means CANNOT MOVE and CANNOT DAMAGE — which is what an envelope needs —
 * but it does not mean "frozen", and an enemy's i-frame timer does not run
 * down out there either.
 *
 * ── THE FOUR THINGS THE SOURCE WILL MISLEAD YOU ABOUT ─────────────────
 *
 * 1. **`FP.width`/`FP.height` are the LEVEL, not the screen.**
 *    `Game.as:1855-1856` overwrites both from the level file on every load;
 *    `FP.screen.width/height` stay at the Engine's 160x160 (`Main.as:36`,
 *    `super(160, 160, FPS)`). Reading `FP.width` as "the viewport" gets the
 *    clamp exactly backwards, and it is the same trap `clampFor` documents.
 *
 * 2. **There is an INVENTORY TERM in the x target, and it is not zero.**
 *    `targetPosition.x -= Inventory.width / 2 + Inventory.offset.x / 2`.
 *    `Inventory.width` is the PNG's 66, and `offset` is a STATIC Point that
 *    the `Inventory` constructor sets to `offsetMin` (-70) — `Game.as:636`
 *    builds a new one per level load, and a closed inventory's `moveToward`
 *    from -70 to -70 never moves it. So the term is a constant `-2`: the
 *    camera centres the player at `player.x - 78`, not `- 80`.
 *
 * 3. **`view()` RUNS ON DEAD FRAMES.** `Game.update` gates only
 *    `super.update()` on `blackCover <= 0`; `view()` and `time += timeRate`
 *    are outside it (`Game.as:812-819`). So through the ~20 fade frames
 *    after a load the camera keeps lerping toward a stationary player — and
 *    since a load leaves it 2 px from its target and the lerp is /10, it
 *    arrives. `settleTicks` below is that, stated rather than assumed.
 *
 * 4. **⛔ THE ROUND IS A DEAD ZONE, and the camera never closes the last
 *    4 px.** `view()` rounds `FP.camera` ITSELF, and the next frame's lerp
 *    compounds on the rounded value — so a gap under 5 px gives
 *    `gap/10 < 0.5`, rounds straight back, and never closes. A level load
 *    therefore leaves the camera permanently 2 px from its follow target
 *    (the inventory term), and a standing player's camera is the LOADLEVEL
 *    SNAP rather than the follow position. Found by writing the opposite
 *    test and watching it fail; `camera.test.js` pins it both ways.
 *
 * 5. **Shake is a `Math.random` jiggle, and this rung is contact-free.**
 *    `Game.shake += 5` on every `Player.hit` and `+= scale + 1` on a landing
 *    RockFall; `view()` then adds `shake * random - shake/2` to both axes.
 *    That is the coupling §2.1 calls "any contact is a model boundary, never
 *    a tolerance": one graze moves the camera by a DRAW, which can flip an
 *    edge-of-screen enemy between updating and not. This module refuses to
 *    model a shaking camera — `stepCamera` throws if asked — because the
 *    only honest answer under shake is "the run diverged".
 */

/** `Main.as:36` — `super(160, 160, FPS)`. `FP.screen` never changes size. */
export const SCREEN_W = 160;
export const SCREEN_H = 160;

/** `Game.as:569-570` — `cameraSpeedDivisorDef`. */
export const CAMERA_SPEED_DIVISOR = 10;

/**
 * `Inventory.width / 2 + Inventory.offset.x / 2`, SUBTRACTED from the x
 * target — so the camera's x target is `player.x - SCREEN_W/2 - this`.
 *
 * 66/2 + (-70)/2 = 33 - 35 = **-2**. Kept as the two operands rather than
 * the -2 so the arithmetic is checkable against the two source lines
 * (`Inventory.as:31` and `:38`) instead of against a number.
 */
export const INVENTORY_WIDTH = 66;
export const INVENTORY_OFFSET_X = -70;
export const INVENTORY_TERM = INVENTORY_WIDTH / 2 + INVENTORY_OFFSET_X / 2;

export class CameraError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CameraError';
    }
}

const fail = (message) => { throw new CameraError(message); };

/**
 * The camera `Game.loadlevel` writes when it builds the player
 * (`Game.as:2041-2042`).
 *
 * ⚠ RAW — no inventory term, no clamp, no rounding. Those three land on the
 * FIRST `view()`, at the end of that same tick, which is why an enemy's
 * `onScreen()` on a world's very first live tick is tested against a camera
 * that can be outside the level's own bounds.
 */
export function initialCamera(playerX, playerY) {
    return { x: playerX - SCREEN_W / 2, y: playerY - SCREEN_H / 2 };
}

/**
 * One `Game.view()`.
 *
 * @param {{x:number,y:number}} cam    the camera at the top of this call
 * @param {{x:number,y:number}} player the player's position AFTER this tick's
 *                                     update — `view()` runs after
 *                                     `super.update()` (`Game.as:812-817`)
 * @param {{width:number,height:number}} world level size IN PIXELS
 * @param {number=} opts.shake  `Game.shake`; non-zero is a refusal
 * @param {{x:number,y:number}=} opts.cameraTarget an override; `(-1,-1)` is
 *        "none" (`Game.as:568`), and any other value REPLACES the follow —
 *        the ceremony camera (`Game.as:914` also drops the divisor to 50).
 */
export function stepCamera(cam, player, world, {
    shake = 0, cameraTarget = null, speedDivisor = CAMERA_SPEED_DIVISOR,
} = {}) {
    if (shake > 0) {
        fail(`stepCamera called with Game.shake = ${shake}. Shake is `
            + '`shake * Math.random() - shake/2` on BOTH axes (Game.as:1818-1819), so the '
            + 'camera is no longer a function of the player — and through `Enemy.onScreen` '
            + 'that can flip an edge-of-screen enemy between updating and not. R5\'s claim '
            + 'is contact-freedom; a shaking camera means the claim already failed.');
    }
    let tx;
    let ty;
    if (cameraTarget && !(cameraTarget.x === -1 && cameraTarget.y === -1)) {
        tx = cameraTarget.x;
        ty = cameraTarget.y;
    } else {
        tx = player.x - SCREEN_W / 2 - INVENTORY_TERM;
        ty = player.y - SCREEN_H / 2;
    }
    let x = cam.x + (tx - cam.x) / speedDivisor;
    let y = cam.y + (ty - cam.y) / speedDivisor;
    // ⚠ The small-level arm is not a clamp, it CENTRES — and it is why a
    // 10x10 room has a camera that never moves at all.
    x = world.width < SCREEN_W
        ? -(SCREEN_W - world.width) / 2
        : Math.min(Math.max(x, 0), world.width - SCREEN_W);
    y = world.height < SCREEN_H
        ? -(SCREEN_H - world.height) / 2
        : Math.min(Math.max(y, 0), world.height - SCREEN_H);
    // AS3's `Math.round` and JS's agree: half rounds toward +Infinity.
    return { x: Math.round(x), y: Math.round(y) };
}

/**
 * `Entity.onScreen(n)` — FlashPunk's own test, at the margin `Enemy.update`
 * passes, which is ZERO.
 *
 * The rect is the entity's HITBOX (`x - originX`, `+ width`), not its
 * sprite: `Entity.onScreen` reads `width`/`height`/`originX`/`originY`,
 * which `setHitbox` writes.
 */
export function onScreen(rect, cam, margin = 0) {
    if (rect.right < cam.x - margin) return false;
    if (rect.bottom < cam.y - margin) return false;
    if (rect.x > cam.x + SCREEN_W + margin) return false;
    if (rect.y > cam.y + SCREEN_H + margin) return false;
    return true;
}

/** The hitbox rect of one census instance, from its constructed centre. */
export function instanceRect(instance) {
    const box = instance.row?.hitbox;
    if (!box) {
        fail(`instanceRect: "${instance.tag}" has no transcribed hitbox — a boss or a `
            + 'class whose volume is an encounter script, not a rect');
    }
    const x = instance.cx - box.ox;
    const y = instance.cy - box.oy;
    return { x, y, right: x + box.w, bottom: y + box.h, w: box.w, h: box.h };
}

/**
 * The camera at every observation of a drained stream.
 *
 * ⚠⚠ THE PHASE IS THE WHOLE POINT, AND IT IS OFF BY ONE FROM THE OBVIOUS
 * READING. Under RECORD-THEN-ACT, observation `t` is the state after `t`
 * completed movement ticks — so the camera the enemies were gated against
 * during tick `t` is the one `view()` produced at the END of tick `t-1`,
 * from the player position that IS `observations[t]`. Hence
 *
 *     camAt(0) = initialCamera(obs[0])          // the raw loadlevel write
 *     camAt(t) = stepCamera(camAt(t-1), obs[t]) // view() at the end of t-1
 *
 * Getting this off by one puts every `onScreen` verdict one tick early,
 * which is exactly the failure mode that makes a wake look like it happened
 * before the player was in range.
 *
 * ⚠ A LEVEL CHANGE IS A NEW `Game`, hence a new camera and a fade. The
 * `settleTicks` extra steps model `view()` running through the dead frames
 * with the player stationary (see the module header, point 3); the default
 * 20 is the observed fade length and the arithmetic is forgiving — a load
 * leaves the camera 2 px from its target, and `2 * 0.9^20 < 0.25`, so any
 * value over ~12 gives the same rounded answer.
 *
 * @param {object[]} observations `{t, x, y, level}` rows
 * @param {(level:number) => {width:number,height:number}} worldOf pixel size
 */
export function cameraTrack(observations, worldOf, { settleTicks = 20 } = {}) {
    const out = [];
    let cam = null;
    let level = null;
    for (const o of observations ?? []) {
        const world = worldOf(o.level);
        if (!world) fail(`cameraTrack: no world size for level ${o.level}`);
        if (o.level !== level) {
            cam = initialCamera(o.x, o.y);
            // The fade: `view()` outside the `blackCover` gate, player still.
            for (let i = 0; i < settleTicks; i += 1) cam = stepCamera(cam, o, world);
            level = o.level;
        } else {
            cam = stepCamera(cam, o, world);
        }
        out.push({ t: o.t, level: o.level, x: cam.x, y: cam.y });
    }
    return out;
}
