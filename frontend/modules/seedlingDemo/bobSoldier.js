/**
 * seedlingDemo/bobSoldier — ⛓ seedling-fidelity-bobsoldier D1: `Enemies/BobSoldier.as`'s OWN TAIL, TRANSCRIBED.
 *
 * TERRAIN's held contact compare traced two tick-exact divergences (L30 → L28 leg 309 at t66, L30 Torchpickup leg 308
 * at t67) to this body: the game's player takes `hits` 0 → 1 from a BobSoldier the model did not step at all (a
 * `mover`, priced nowhere). The class is a chaser — `levelRun.stepChasersNow` walks it through `chasers.chaserStep`
 * like a Bob — plus a SPINNING SWORD, which is this file.
 *
 * ── THE AS3, IN UPDATE ORDER ───────────────────────────────────────────
 * ```
 *   update():  super.update()                                  // Enemy.update: the off-screen return, the terrain
 *                                                              // switch, mobileUpdate (friction, move, death's fade),
 *                                                              // and `if (!destroy) { hitUpdate(); hitPlayer(); }`
 *              if (Game.freezeObjects) return;
 *              player = nearestToPoint("Player", x, y)
 *              playerActions(player)                           // the chase (Bob's eleven lines, moveSpeed 0.8,
 *                                                              // runRange 80), then swordSpinningBeginCheck(d)
 *              swordSpinningStep(player)
 *              swordHitting()                                  // collideLine("Player", …) → p.hit(this, 3*damage, …)
 *   swordSpinningBeginCheck(d:int)   if (d <= attackRange 32 && !swordSpinning)
 *                                        if (swordSpinResetTimer > 0) swordSpinResetTimer--  else swordSpinningBegin()
 *   swordSpinningBegin()             swordSpinResetTimer = 60; swordSpinning = true;
 *                                    swordSpin[i] = swordSpinBegin[i] = (swordSpin[i] + 2π) % 2π
 *   swordSpinningStep(player)        if (swordSpinning) { swordSpin[i] += π/10;
 *                                        ang = (-atan2(p.y - y, p.x - x) + 2π) % 2π
 *                                        if (|begin - spin| >= 2π && |angle_difference((spin + 2π) % 2π, ang)| <= π/10)
 *                                            swordSpinningStop(ang) }              // spin = ang; spinning = false
 *   swordHitting()                   for each sword: collideLine("Player", x + 8cos(-s), y + 8sin(-s),
 *                                                                 x + 16cos(-s), y + 16sin(-s))
 * ```
 *
 * ── ⛔ FIVE THINGS THE SOURCE SAYS THAT A FIRST READING GETS WRONG ─────
 *
 * 1. **THE TAIL HAS NO `destroy` GATE.** `Bob.update` returns on `destroy || "die"`; `BobSoldier.update` tests only
 *    the freeze. So a killed BobSoldier (`Enemy.startDeath` sets `destroy` — the class plays no "die") keeps
 *    chasing, keeps spinning and keeps HITTING with its sword through all eleven ticks of `Mobile.death`'s fade.
 *    Only the body contact (`Enemy.hitPlayer`, inside `if (!destroy)`) stops.
 * 2. **THE TAIL HAS NO OFF-SCREEN GATE EITHER.** `Enemy.update`'s `if (!activeOffScreen && !onScreen()) return` is
 *    `super.update()`'s; the tail below it runs. A body the camera has lost still swings (and its pit descent,
 *    which REPLACES `super.update()`, does not stop the tail either).
 * 3. **THE SWORD HAS NO I-FRAME GATE.** `swordHitting` calls `p.hit` on every tick the line meets the player; only
 *    `Player.hit`'s own gates (its i-frames, the freeze, `noDamage`) refuse it. The ENEMY's `hitsTimer` gates the
 *    body contact alone.
 * 4. **THE SWORD IS ALWAYS OUT.** `swordHitting` runs whether or not the sword is spinning: at rest it points
 *    along `swordSpin[0]` — DOWN (3π/2 → −3π/2) until the first spin, then at wherever the player stood when the
 *    spin stopped (`swordSpinningStop(ang)`). A body that never got within 32 px of the player still carries a
 *    blade from (x, y + 8) to (x, y + 16).
 * 5. **`d` IS AN `int` IN THE BEGIN CHECK.** `swordSpinningBeginCheck(d:int = 0)` receives the `Number` distance and
 *    the parameter TRUNCATES it, so the spin begins at d < 33, not d ≤ 32. And the reset timer only counts down
 *    while the player is inside that range and the sword is at rest.
 *
 * ⚠ `swords` is 1 and never changes in this class (`BobBoss` is the subclass that adds blades — `bobBossFight.js`),
 * so `swordIndex` is always 0 and `swordSpin[1..3]` / `swordSpinBegin[1]` are never read. They are carried anyway:
 * the arrays are the class's own initial state and a reader diffing against the AS3 should find them.
 */

/** The class's own numbers (`BobSoldier.as:33-48`). */
export const BOB_SOLDIER = Object.freeze({
    /** `weaponLength = sprLameSword.width` — `new Spritemap(imgLameSword, 16, 5)`. */
    weaponLength: 16,
    /** `attackRange:int = 32` — the spin begins inside it (note 5). */
    attackRange: 32,
    /** `swordSpinRate = Math.PI / 10` — one full turn is twenty updates. */
    swordSpinRate: Math.PI / 10,
    /** `swordSpinResetTimerMax:int = 60`. */
    swordSpinResetTimerMax: 60,
    /** `swords:int = 1`. */
    swords: 1,
    /** `swordHitting`: `hitPlayer.hit(this, 3 * damage, new Point(x, y), damage)` — the force is `3 * damage`. */
    swordForcePerDamage: 3,
    /** `swordSpin = new Array(Math.PI * 3 / 2, Math.PI / 2, Math.PI, 0)`. */
    swordSpin0: Object.freeze([Math.PI * 3 / 2, Math.PI / 2, Math.PI, 0]),
    /** `swordSpinBegin = new Array(0, 0)`. */
    swordSpinBegin0: Object.freeze([0, 0]),
    src: 'Enemies/BobSoldier.as:33-48,90-170',
});

/** A fresh sword state, as the constructor leaves it. Per VISIT, like the body (no persistence). */
export function createBobSoldierSword() {
    return {
        swordSpinning: false,
        swordIndex: 0,
        swords: BOB_SOLDIER.swords,
        swordSpinBegin: [...BOB_SOLDIER.swordSpinBegin0],
        swordSpin: [...BOB_SOLDIER.swordSpin0],
        swordSpinResetTimer: 0,
    };
}

/** `FP.angle_difference(a0, a1)` (`net/flashpunk/FP.as:233-241`), radians, one wrap each way. */
export function angleDifference(a0, a1) {
    let d = a0 - a1;
    if (d < -Math.PI) d += 2 * Math.PI;
    if (d > Math.PI) d -= 2 * Math.PI;
    return d;
}

/**
 * `swordSpinningBeginCheck(d)` + `swordSpinningBegin()`. MUTATES `s`. `d` is the `Number` distance; the `int`
 * parameter's truncation is applied here (note 5). Returns true on the update the spin begins.
 */
export function bobSoldierBeginCheck(s, d) {
    if (!(Math.trunc(d) <= BOB_SOLDIER.attackRange)) return false;
    if (s.swordSpinning) return false;
    if (s.swordSpinResetTimer > 0) {
        s.swordSpinResetTimer -= 1;
        return false;
    }
    s.swordSpinResetTimer = BOB_SOLDIER.swordSpinResetTimerMax;
    s.swordSpinning = true;
    const i = s.swordIndex;
    s.swordSpin[i] = (s.swordSpin[i] + 2 * Math.PI) % (2 * Math.PI);
    s.swordSpinBegin[i] = s.swordSpin[i];
    return true;
}

/**
 * `swordSpinningStep(player)` + `swordSpinningStop(ang)`. MUTATES `s`. `body` is the entity point (`x`, `y`) the
 * tick's move left; `player` the player's entity point. Returns true on the update the spin stops.
 */
export function bobSoldierSpinStep(s, body, player) {
    if (!s.swordSpinning) return false;
    const i = s.swordIndex;
    s.swordSpin[i] += BOB_SOLDIER.swordSpinRate;
    const ang = (-Math.atan2(player.y - body.y, player.x - body.x) + Math.PI * 2) % (Math.PI * 2);
    if (Math.abs(s.swordSpinBegin[i] - s.swordSpin[i]) >= Math.PI * 2) {
        if (Math.abs(angleDifference((s.swordSpin[i] + 2 * Math.PI) % (2 * Math.PI), ang)) <= BOB_SOLDIER.swordSpinRate) {
            s.swordSpin[i] = ang;
            s.swordSpinning = false;
            s.swordIndex = (s.swordIndex + 1) % s.swords;
            return true;
        }
    }
    return false;
}

/**
 * Blade `i`'s hit line — `swordHitting`'s two points, as `Number`s. `collideLine`'s `int` parameters truncate them;
 * `crusher.collideLineSolid` does that cast, so the caller hands these to it unchanged.
 */
export function bobSoldierSwordLine(body, s, i = 0) {
    const a = -s.swordSpin[i];
    const L = BOB_SOLDIER.weaponLength;
    return {
        x0: body.x + (L / 2) * Math.cos(a), y0: body.y + (L / 2) * Math.sin(a),
        x1: body.x + L * Math.cos(a), y1: body.y + L * Math.sin(a),
    };
}

/**
 * ONE `BobSoldier.update` tail AFTER the chase: `swordSpinningBeginCheck(d)` (which `playerActions` calls last),
 * `swordSpinningStep(player)`, and the lines `swordHitting` will test. MUTATES `s`. The freeze return is the
 * caller's (`Game.freezeObjects` returns above all of it). `d` is measured from the post-move body to the player —
 * `playerActions`' own `FP.distance(x, y, player.x, player.y)`; the chase writes `v`, not the position, so it does
 * not matter that the chase ran first.
 *
 * @returns {{began: boolean, stopped: boolean, lines: Array<{x0, y0, x1, y1}>}}
 */
export function bobSoldierSwordTail(s, body, player) {
    // `FP.distance` is `Math.sqrt(dx*dx + dy*dy)` (not `Math.hypot`, which differs by an ulp on diagonals).
    const d = Math.sqrt((player.x - body.x) * (player.x - body.x) + (player.y - body.y) * (player.y - body.y));
    const began = bobSoldierBeginCheck(s, d);
    const stopped = bobSoldierSpinStep(s, body, player);
    const lines = [];
    for (let i = 0; i < s.swords; i += 1) lines.push(bobSoldierSwordLine(body, s, i));
    return { began, stopped, lines };
}

/**
 * The farthest any sword point gets from the body's ENTITY POINT: `weaponLength`. The danger map's pad is measured
 * from the body BOX's edge, so the reach beyond the box is `weaponLength` minus the box's nearest half-extent —
 * `combat.ENEMY_CLASSES.bobsoldier.threatPad` (16) over-covers it, which is its job (a reach without a clock).
 */
export const BOB_SOLDIER_SWORD_REACH = BOB_SOLDIER.weaponLength;
