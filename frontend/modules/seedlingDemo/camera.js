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
 * 5. **Shake is a `Math.random` jiggle, and R5 refused to model it.**
 *    `Game.shake += 5` on every `Player.hit` and `+= scale + 1` on a landing
 *    RockFall; `view()` then adds `shake * random - shake/2` to both axes.
 *    That is the coupling §2.1 calls "any contact is a model boundary, never
 *    a tolerance": one graze moves the camera by a DRAW, which can flip an
 *    edge-of-screen enemy between updating and not. R5's `stepCamera` threw
 *    if asked, because R5's claim was contact-freedom and a shaking camera
 *    meant the claim had already failed.
 *
 *    ⛓⛓⛓ **R6 SLICE 3 RETIRES THAT REFUSAL, and not by pretending to know
 *    the draws.** See "THE SHAKE, AND WHY IT IS A BAND" below.
 *
 * ── ⛓⛓⛓ R6 SLICE 3: THE SHAKE, AND WHY IT IS A BAND ──────────────────
 *
 * `Player.hit` is now modelled (`playerDamage.js`), so a run can produce
 * `Game.shake > 0` and the camera has to keep answering. Three facts decide
 * the shape of the answer:
 *
 * 1. **The magnitude is EXACT and the sign is not.** `shake` is an integer
 *    the writers set or add to and `view()` decays by 1 per call
 *    (`Math.max(shake - 1, 0)`); the two draws only decide WHERE inside
 *    `[-shake/2, +shake/2)` each axis lands. `Math.random()` is
 *    `raw & 0x7FFFFFFF` over `2^31` in the recompiled runtime
 *    (`SWFModernRuntime/src/avm2/avm2_number.c:481`), i.e. `[0, 1)` — so
 *    `shake * r - shake/2` is bounded by the half-amplitude on both sides,
 *    exactly, with no assumption about the generator beyond its RANGE.
 * 2. **Knowing the VALUE would mean knowing the draw INDEX, and in the
 *    rooms that shake, nothing does.** The generator is a fixed-seed 31-bit
 *    LFSR (`avm2_generate_random_number`, seed 987654321), so the k-th draw
 *    of the process is computable — but k counts every draw since page
 *    load, including `Tile`'s ctor triple, `Enemy`'s ctor pair, `Music`'s
 *    do-while and, in L43, `BossTotem.render`'s two per RENDER. A
 *    render-coupled polluter makes k not even update-determined (§8.3), and
 *    L43 is exactly where the totem's `shake = 30` lands. ⇒ a value model
 *    would be a fiction precisely where it is needed.
 * 3. **The perturbation PERSISTS.** `view()` jiggles `FP.camera` itself and
 *    the next tick's lerp compounds on the jiggled, rounded value — so the
 *    band does not collapse when the shaking stops. It shrinks by the lerp
 *    (× 0.9 per tick) until the ROUND dead zone (point 4 above) freezes
 *    whatever is left. Only a new `Game` clears it, because `loadlevel`
 *    writes `FP.camera` raw.
 *
 * ⇒ the model carries an INTERVAL, folds each `view()`'s two draws into it
 * as a mutation (never a sample), and answers `onScreen` with three values
 * — yes / no / **uncertain**. `stepCamera` still refuses, but now only for
 * the case it cannot answer: a caller that hands it `shake > 0` and expects
 * a POINT. The band is `stepCameraBand`, and a window that needs a verdict
 * an uncertain band cannot give is a window that has to move its stance.
 *
 * ⚠ **SHAKE DECAYS PER ENGINE FRAME, NOT PER TAPE TICK.** `view()` is
 * outside `Game.update`'s `blackCover` gate (point 3), so a fade drains it
 * by the fade's own frame count — which is a BAND (17..24), not a constant.
 * `shakeAcrossLoad` is that arithmetic: certain when the shake cannot
 * survive the SHORTEST fade, a named refusal when it can.
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
    // ⛓⛓⛓ R6 SLICE 3 — THE REFUSAL IS RETIRED, AND WHAT IS LEFT IS A TYPE
    // CONSTRAINT RATHER THAN A CLAIM.
    //
    // R5 threw here saying "a shaking camera means the run diverged". The
    // module now MODELS a shaking camera (`stepCameraBand`), so that
    // sentence is gone. What this function cannot do is return a POINT for
    // a camera whose position depends on two draws nobody can index — so it
    // hands the caller to the band instead of inventing a value.
    if (shake > 0) {
        fail(`stepCamera called with Game.shake = ${shake}, and this face returns a POINT. `
            + 'The jiggle is `shake * Math.random() - shake/2` on both axes '
            + '(Game.as:1870-1871), which is a value only a draw INDEX could give — and in '
            + 'a room that shakes the index is not update-determined (§8.3). Use '
            + '`stepCameraBand`, which folds the two draws as a mutation and answers '
            + '`onScreenUnderShake` with yes / no / UNCERTAIN.');
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

// ── ⛓⛓⛓ R6 SLICE 3: THE SHAKE ────────────────────────────────────────

/**
 * ⛔ THREE WRITERS, TWO OPERATORS — the table, because §34.3 wrote all three
 * as assignments and §8.9 caught it.
 *
 * A model that read `Player.hit`'s `+=` as `=` loses every second hit's
 * contribution (a hit inside another hit's window still adds), and a model
 * that read `BossTotem`'s `=` as `+=` inflates a 60 into a 65 on the tick
 * the boss dies with the player already shaken. The `op` field is the
 * difference and it is data, not prose, so `stepShake`'s two arms are
 * driven from it.
 *
 * ⚠ NOT THE WHOLE GAME. These are the writers R6's roster can reach. The
 * checkout holds eight more (`LavaBoss` 15, `TentacleBeast` 5, `Moonrock`
 * 60, `FallRock` 30, `FallRockLarge` 30, `BeamTower` 15, and `RockFall`'s
 * `+= scale + 1`), every one of them in a room this rung defers or on a
 * class it does not step. Named here so "three writers" reads as a scope,
 * not as a census of the game.
 */
export const SHAKE_WRITERS = Object.freeze({
    playerHit: Object.freeze({
        op: '+=', value: 5, src: 'Player.as:1389',
        who: 'every landed Player.hit — the only ADDITION on the roster',
    }),
    totemLaser: Object.freeze({
        op: '=', value: 30, src: 'Enemies/BossTotem.as:450 (`laserHitTimeMax * 2`)',
        who: 'one per laser volley — slice 4',
    }),
    totemDeath: Object.freeze({
        op: '=', value: 60, src: 'Enemies/BossTotem.as:477 (`removed()`)',
        who: 'the totem\'s removal — slice 4',
    }),
});

/**
 * `Math.random()`'s RANGE, which is all the band needs from the generator.
 *
 * `math_random` returns `(double)(raw & 0x7FFFFFFF) / 2147483648.0`
 * (`SWFModernRuntime/src/avm2/avm2_number.c:481-486`), so the value is in
 * `[0, 1)` — 1 is not attainable and 0 is. The band therefore closes on the
 * low side and is half-open on the high side; it is stated CLOSED below
 * (an over-approximation of at most one ulp before the round), because a
 * sound over-approximation of an uncertainty is the safe direction and a
 * half-open interval that rounds is not worth the arithmetic.
 */
export const RANDOM_RANGE = Object.freeze({
    lo: 0, hi: 1, hiAttainable: false,
    src: 'SWFModernRuntime/src/avm2/avm2_number.c:481 — (raw & 0x7FFFFFFF) / 2^31',
    generator: 'fixed-seed 31-bit LFSR, seed 987654321 (avm2_generate_random_number) — '
        + 'so the k-th draw IS computable, and k is what nothing here knows',
});

/** A degenerate band: the point `cam`, with no uncertainty. */
export function cameraBand(cam) {
    return { x: { lo: cam.x, hi: cam.x }, y: { lo: cam.y, hi: cam.y } };
}

/** Is this band a single point — i.e. is the camera still exactly known? */
export function bandIsExact(band) {
    return band.x.lo === band.x.hi && band.y.lo === band.y.hi;
}

/** The widest either axis is uncertain by, for a message or a budget. */
export function bandWidth(band) {
    return Math.max(band.x.hi - band.x.lo, band.y.hi - band.y.lo);
}

/**
 * One `Game.view()` over a BAND, with `Game.shake`'s decay.
 *
 * ⛔⛔ THE INTERVAL ARITHMETIC IS EXACT BECAUSE EVERY STEP IS MONOTONE IN
 * THE CAMERA, and that is a derivation rather than a hope:
 *
 *   · the lerp is `cam + (target - cam)/d` = `cam * (1 - 1/d) + target/d`,
 *     and `1 - 1/10 = 0.9 > 0` — increasing in `cam`, so endpoints map to
 *     endpoints and nothing inside can escape them;
 *   · `Math.min`/`Math.max` are monotone; the small-level arm is CONSTANT
 *     (which collapses the band to a point on that axis, correctly — a
 *     10x10 room's camera cannot shake, because `view()` overwrites it);
 *   · the jiggle adds an independent `[-shake/2, +shake/2]` to each axis;
 *   · `Math.round` is monotone.
 *
 * ⇒ propagating `lo` and `hi` through the same code is not an
 * approximation of the reachable set, it IS the reachable set (up to the
 * closed-vs-half-open ulp named in `RANDOM_RANGE`).
 *
 * ⚠ THE JIGGLE IS APPLIED **AFTER** THE CLAMP AND BEFORE THE ROUND, which
 * is why a shaking camera can sit outside the level's own bounds — and why
 * the next tick's clamp pulls it back in. Transcribed in that order.
 *
 * @param {object} band `{x:{lo,hi}, y:{lo,hi}}`
 * @param {number} shake `Game.shake` AT THE TOP OF THIS `view()` call
 * @returns {{band:object, shake:number}} the band after the call and the
 *          decayed shake — `Math.max(shake - 1, 0)`, and 0 stays 0
 */
export function stepCameraBand(band, player, world, {
    shake = 0, cameraTarget = null, speedDivisor = CAMERA_SPEED_DIVISOR,
} = {}) {
    if (!(shake >= 0)) fail(`stepCameraBand: Game.shake must be >= 0, got ${shake}`);
    let tx;
    let ty;
    if (cameraTarget && !(cameraTarget.x === -1 && cameraTarget.y === -1)) {
        tx = cameraTarget.x;
        ty = cameraTarget.y;
    } else {
        tx = player.x - SCREEN_W / 2 - INVENTORY_TERM;
        ty = player.y - SCREEN_H / 2;
    }
    const half = shake / 2;
    const axis = (b, target, size, screen) => {
        const lerp = (c) => c + (target - c) / speedDivisor;
        let lo = lerp(b.lo);
        let hi = lerp(b.hi);
        if (size < screen) {
            // ⚠ NOT A CLAMP — AN OVERWRITE. A room narrower than the screen
            // has its camera ASSIGNED, so the band collapses to a point on
            // that axis whatever it was before.
            lo = -(screen - size) / 2;
            hi = lo;
        } else {
            lo = Math.min(Math.max(lo, 0), size - screen);
            hi = Math.min(Math.max(hi, 0), size - screen);
        }
        // ⛔ AFTER **BOTH** ARMS, AND OUTSIDE THE `else`. `view()`'s
        // `if (shake > 0)` block sits below the whole clamp/centre section,
        // so a room narrower than the screen SHAKES TOO — its camera is
        // reassigned every tick and then jiggled. Writing this inside the
        // `else` (as the first cut did) reads perfectly and quietly declares
        // small rooms shake-proof.
        //
        // ⚠ And it is the one place the camera leaves the level's bounds:
        // the clamp has already run.
        lo -= half;
        hi += half;
        return { lo: Math.round(lo), hi: Math.round(hi) };
    };
    return {
        band: {
            x: axis(band.x, tx, world.width, SCREEN_W),
            y: axis(band.y, ty, world.height, SCREEN_H),
        },
        shake: Math.max(shake - 1, 0),
    };
}

/**
 * One `Game.view()` with the two draws SUPPLIED — the concrete transcription
 * the band is derived from.
 *
 * ⚠ NOTHING IN THE RUN CALLS THIS, and that is deliberate: a caller that had
 * the draws would need the draw INDEX, which is the thing nobody has. It
 * exists so the band can be CHECKED rather than argued — `camera.test.js`
 * runs this at the extremes and inside, and asserts the result always lies
 * within `stepCameraBand`'s interval. A band that could not be falsified by
 * a concrete stepper would be an assumption wearing an interval.
 *
 * @param {number} r1 the x draw, in [0, 1)
 * @param {number} r2 the y draw, in [0, 1)
 */
export function stepCameraJiggled(cam, player, world, {
    shake = 0, r1 = 0, r2 = 0, cameraTarget = null, speedDivisor = CAMERA_SPEED_DIVISOR,
} = {}) {
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
    x = world.width < SCREEN_W
        ? -(SCREEN_W - world.width) / 2
        : Math.min(Math.max(x, 0), world.width - SCREEN_W);
    y = world.height < SCREEN_H
        ? -(SCREEN_H - world.height) / 2
        : Math.min(Math.max(y, 0), world.height - SCREEN_H);
    // ⚠ THE SMALL-LEVEL ARM IS AN OVERWRITE, so a room narrower than the
    // screen does not shake on that axis at all — `view()` assigns the
    // centre and the jiggle then adds to it. Transcribed in `view()`'s
    // order, which puts the jiggle AFTER the assignment: it DOES shake.
    if (shake > 0) {
        x += shake * r1 - shake / 2;
        y += shake * r2 - shake / 2;
    }
    return { x: Math.round(x), y: Math.round(y), shake: Math.max(shake - 1, 0) };
}

/**
 * ⛔⛔⛔ THE BAND NEVER CLOSES, AND THIS IS HOW WIDE IT STAYS.
 *
 * The first cut of this module assumed the perturbation decays away: the
 * lerp pulls both endpoints toward one target at 0.9 per tick, so the
 * interval shrinks. It does — until the ROUND DEAD ZONE (header point 4)
 * catches it. A gap under 5 px gives `gap/10 < 0.5`, rounds straight back,
 * and FREEZES; the two endpoints freeze independently, on opposite sides of
 * the target.
 *
 * `Math.round` breaks ties toward +Infinity, so the low endpoint can park
 * up to 4 px below the target and the high endpoint up to 5 px above it.
 *
 * ⇒ **one landed hit costs the camera up to 9 px of knowledge, per axis,
 * for the rest of the visit** — only a new `Game` clears it. Every
 * `onScreen` question about a body within 9 px of a screen edge is a
 * REFUSAL from the first hit onward, and a fight that needs those verdicts
 * has to take its stance away from the edge rather than wait the shake out.
 * Measured at shake 1..60 in `camera.test.js`; the ceiling is the same 9
 * for every one of them, because it is the dead zone's and not the shake's.
 */
export const CAMERA_DEAD_ZONE_RESIDUE = Object.freeze({
    below: 4, above: 5,
    get width() { return this.below + this.above; },
    why: 'the lerp\'s gap/10 rounds to 0 below 5 px and `Math.round` ties toward '
        + '+Infinity, so the two endpoints freeze at -4 and +5 about the target',
    clearedBy: 'a new `Game` — `loadlevel` writes `FP.camera` raw',
});

/**
 * `Entity.onScreen(n)` against a BAND — yes, no, or UNCERTAIN.
 *
 * ⚠ "NOT definitely on" IS NOT "definitely off", and conflating them is how
 * a band would quietly license a stance. `off` here requires ONE of the
 * four conditions to hold for EVERY camera in the band; anything else that
 * is not `on` is `uncertain`, which is the answer a caller must treat as a
 * refusal.
 *
 * @returns {'on'|'off'|'uncertain'}
 */
export function onScreenUnderShake(rect, band, margin = 0) {
    // On for ALL cameras: each of the four escape conditions fails at its
    // own worst-case endpoint.
    const on = rect.right >= band.x.hi - margin
        && rect.bottom >= band.y.hi - margin
        && rect.x <= band.x.lo + SCREEN_W + margin
        && rect.y <= band.y.lo + SCREEN_H + margin;
    if (on) return 'on';
    // Off for ALL cameras: one condition holds at its own best case.
    const off = rect.right < band.x.lo - margin
        || rect.bottom < band.y.lo - margin
        || rect.x > band.x.hi + SCREEN_W + margin
        || rect.y > band.y.hi + SCREEN_H + margin;
    return off ? 'off' : 'uncertain';
}

/**
 * ⚠ WHAT A LEVEL LOAD DOES TO `Game.shake` — and why it is not a subtraction.
 *
 * `shake` is a `public static` that survives the world swap, and `view()`
 * decays it once per ENGINE FRAME (it is outside `Game.update`'s
 * `blackCover` gate). A load's fade is a BAND — measured 17..24 frames per
 * load (`deadFrameBand.LEGACY_FADE_PER_LOAD`), because `blackCover` decays
 * per RENDER while the gate samples per UPDATE — so the shake on the other
 * side of a load is only knowable when the fade is long enough to drain it
 * WHATEVER its length.
 *
 * ⇒ `<= fade.min` is certain 0, and anything larger is a named refusal
 * rather than a subtraction of a number nobody measured. A death reboot
 * carries at most `shakePerHit` (5) across its fade, so the certain arm is
 * the one this rung actually walks.
 *
 * @returns {{shake:number, certain:boolean, why:string}}
 */
export function shakeAcrossLoad(shake, fade) {
    if (shake <= 0) return { shake: 0, certain: true, why: 'nothing to carry' };
    if (shake <= fade.min) {
        return {
            shake: 0,
            certain: true,
            why: `${shake} <= the SHORTEST fade (${fade.min} frames), so it drains to 0 `
                + 'whatever the fade\'s real length turns out to be',
        };
    }
    return {
        shake: NaN,
        certain: false,
        why: `${shake} survives a ${fade.min}-frame fade, so what is left on the other `
            + `side is ${shake - fade.max}..${shake - fade.min} — a range, because the `
            + 'fade is a band (blackCover decays per RENDER, the gate samples per UPDATE). '
            + 'A window that needs this number has to measure the load, not derive it.',
    };
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
    // ⛔ R5 SLICE 8, STEP 0: THE `fail` ABOVE COVERS THE CASE SOMEBODY
    // THOUGHT OF — a hitbox that is ABSENT — and not the one that has now
    // shipped twice, a hitbox that is PRESENT with a field missing. `{ox,
    // oy}` with no `w` walks straight past that guard and comes out as
    // `right: NaN`, which never overlaps anything. Guarding the OUTPUT
    // covers both, and only one of them needed a person to imagine it.
    //
    // ⚠ CHECKED INLINE RATHER THAN THROUGH `levelWorld.assertRect`: this
    // module has NO imports at all, deliberately, and one added for a
    // four-field check would be the whole reason it stops being
    // dependency-free.
    const r = { x, y, right: x + box.w, bottom: y + box.h, w: box.w, h: box.h };
    if (!Number.isFinite(r.x) || !Number.isFinite(r.y)
        || !Number.isFinite(r.right) || !Number.isFinite(r.bottom)) {
        fail(`instanceRect: "${instance.tag}" has a hitbox with a missing field `
            + `(${JSON.stringify(box)}), so its rect is ${JSON.stringify(r)}. A rect `
            + 'with a non-finite edge never overlaps anything, which reads as "off '
            + 'screen" forever rather than as an error.');
    }
    return r;
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
