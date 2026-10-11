/**
 * seedlingDemo/contactFidelity — the switches for slice `seedling-fidelity-terrain` (planner
 * `seedling-fidelity-planning-3`, wave 6). With all of them false the model is byte-identical to the one before the
 * slice; W2 and W3 ship ON (nothing measured moved); W1 ships ON since fidelity LINEFLIP (it moved a producer, which
 * was re-recorded on the game, and two pins — see `CONTACT_FIDELITY`). Each names the AS3 it transcribes and the game
 * rows that measured it (`probe-seedling-contact-divergence.mjs`, `replay-seedling-contact-capture.mjs`).
 *
 * ⛔ The divergence sweep filed these rows as "terrain": a 1.3–2.7 px jump on both axes. They are not terrain. The
 * held compare read the game's `hits` 0 → 1 at the divergence tick itself on every reproduced row: each one is a
 * CONTACT KNOCKBACK, `Player.hit(e, 3, …)` → `knockback(3, …)`, that one side billed and the other did not.
 */

/**
 * W1 — `World.collideLine` STEPS IN `Number`, NOT `int`.
 *
 *     World.as:411   collideLine(type, fromX:int, fromY:int, toX:int, toY:int, …)
 *     World.as:434   x:Number = fromX, y:Number = fromY …   x += xSign; y += ySign;
 *     World.as:389   collidePoint(type, pX:Number, pY:Number)   →   Entity.collidePoint(x, y, pX:Number, pY:Number)
 *
 * Only the four END POINTS are cast to `int`. The minor axis then advances by a fraction, and every sampled point is
 * tested as the `Number` it is. `crusher.collideLineSolid` truncated each sampled point as well. Against a solid with
 * integer bounds (a tile, a placed entity) the two agree for every non-negative point. Against the PLAYER'S box
 * (fractional bounds) they do not: a wallflyer launched horizontally carries `-4·sin(π)` = −4.9e-16 in `vy`, so its
 * ray's `toY` casts to `y − 1`, and the game's ray falls from y to y − 1 across 160 px where the model's sat at
 * y − 1 from its first step. Measured: L27 `wallflyer@192,48` launches on t13 in the game and t12 in the model
 * (player box bottom 55.65 vs the game's ray at y ≈ 55.8); L25 `wallflyer@48,48` launches a tick LATE (the mirror).
 */
//   → `CONTACT_FIDELITY.collideLinePointsExact`

/**
 * W2 — THE PLAYER'S SWORD HITS A WALLFLYER.
 *
 *     Player.as:99    hitables = ["Enemy", …]           (a WallFlyer is `type = "Enemy"`)
 *     Player.as:917   if (!collideLine("Solid", x, y, v[i].x, v[i].y) || …) genericHit(v[i])
 *     genericHit      `e is Enemy` → e.hit(swordForce 5, Point(x, y), swordDamage, "Sword")
 *     Enemy.as:140    hit(): hits += d; hitsTimer = 30; knockback(f, p)   — WallFlyer.knockback is `v = -v`
 *
 * The model's press census synthesizes live responders for the bridged chasers only, so a slash whose rect
 * covered a wallflyer reached NOTHING: no hit, no i-frame, no reversal — a silent zero, not even the refusal
 * `KILL_ARM_POLICY.WallFlyer` would have raised. Measured: L22 t43 `wallflyer@48,112` and L25 t51
 * `wallflyer@48,48` take `hits_timer` 30 and reverse in the game; the model's fly on, and the model later bills a
 * contact (L22 t52 `wallflyer@64,80`, struck at t46) that the game's i-frame refuses. Flag ON: the run hands the
 * wallflyers to the census as `Enemy`-arm responders (`family: 'wallflyer'`), and the arm runs `slash()`'s two
 * gates (the reach, the line of sight) and then `wallFlyer.hitWallFlyer`. A KILL is refused by name, as the dark
 * suit's retaliation is: the die anim's ledger consequence is not staged for this class.
 */
//   → `CONTACT_FIDELITY.wallFlyerSwordHits`

/**
 * W3 — THE DRILL IS A LIVE BODY (`drill.js`, `Enemies/Drill.as`).
 *
 * The model had no drill: `contactPricing('drill')` is a `mover`, so the run threw only if the player stood in the
 * PLACEMENT and billed nothing anywhere else. Measured: L88 `drill@128,160` hops (120,184) → (104,168) on t47 and
 * its contact knocks the player +2.5 px on t48 (`hits` 0 → 1); the model's player walks on. Flag ON: in a room whose
 * ONLY census enemy is one drill (L88), `levelRun.stepDrillsNow` steps it in its slot and bills its contact through
 * `applyPlayerHit`, a slash reaches it (`Enemy.hit`, an empty knockback), and a kill is refused by name. Any other
 * drill room (L28 with a BobSoldier, L91 with three bobs) is unchanged and stays residue.
 */
//   → `CONTACT_FIDELITY.drillLive`

/**
 * W4 — THE BOBSOLDIER IS A LIVE BODY (slice `seedling-fidelity-bobsoldier`; `bobSoldier.js`, `Enemies/BobSoldier.as`).
 *
 *     BobSoldier.as:72-82    update(): super.update(); if (Game.freezeObjects) return; playerActions(player);
 *                            swordSpinningStep(player); swordHitting();
 *     BobSoldier.as:160-170  swordHitting(): collideLine("Player", x + 8cos(-s), y + 8sin(-s), x + 16cos(-s), …)
 *                            → p.hit(this, 3 * damage, new Point(x, y), damage)
 *
 * TERRAIN's residue: the model had no BobSoldier (`contactPricing('bobsoldier')` a `mover`, priced nowhere), and the
 * game's sword knocked the player at L30 leg 309 t66 and leg 308 t67 (`hits` 0 → 1, the body at (50.8,92.6)). Flag
 * ON: the class is a bridged chaser (`chasers.CHASERS.bobsoldier`, `spinner.MODELLED_ENEMY_CLASSES.BobSoldier`) —
 * walked by `chaserStep`, its body contact billed by `chaserContactNow`, and its sword stepped and billed by
 * `levelRun.bobSoldierSwordNow` — and a kill is staged (`KILL_ARM_POLICY.BobSoldier` modelled: `destroy` at the blow,
 * the fade, a corpse that still swings). OFF: the class is the `mover` it was, byte-identical.
 */
//   → `CONTACT_FIDELITY.bobSoldierLive`

/**
 * W5 — A CHASER'S `Point` ARITHMETIC IS THE RUNTIME'S (slice `seedling-fidelity-bobsoldier`).
 *
 *     Point.length      Math.sqrt(x*x + y*y)                    (FP.distance the same)
 *     Point.normalize   norm = thickness / length; x *= norm; y *= norm      (avm2_globals.c point_normalize)
 *
 * `chasers.js` spelled both the way R9 slice 12e⁗ refuted for the PLAYER (`Math.hypot`, `(x / m) * t`), so every
 * chaser's friction and chase normalise drifted by an ulp on diagonals. Measured on the BobSoldier captures: the
 * game's `vx` at L30 leg 309 t38 is `0.7884788477227912`, the model's `…911`; it grows into a 1-ulp position and a
 * 7e-15 px player knockback at the sword's hit (t66). ON: `playerPhysicsV1.pointLength` / `pointNormalize`, and
 * both captures are bit-exact on the player AND the body at every tick.
 * ⚖ RETIRED as a switch at the wave-8 harvest (user, 2026-10-07): its OFF arm was the second spelling the one-spelling
 * law forbids (`oneSpelling.js`, an empty allow-list), so `chasers.js` always uses the runtime's arithmetic.
 */

/**
 * W6 — A WALLFLYER KILL IS STAGED (slice `seedling-fidelity-wallflyer`; `wallFlyer.js`, `Enemies/WallFlyer.as`).
 *
 *     WallFlyer.as:47-51    startDeath(t): play("die"); dieEffects(t)       — NO `destroy` (Enemy.startDeath is not called)
 *     WallFlyer.as:53-57    update(): super.update(); if (destroy || currentAnim == "die") return;  — no trigger, no relaunch
 *     WallFlyer.as:99-111   endAnim(): the "die" arm sets `destroy`             — `add("die", [5, 6, 7, 8], 10)`
 *     Mobile.as:31-43,60-70 mobileUpdate(): while `!destroy` the body still MOVES; death(): alpha -= 0.1 → FP.world.remove
 *     Enemy.as:211-220      hitPlayer(): gated on `currentAnim != "die"` and `!destroy` — the dying body is harmless
 *
 * W2 refused the killing sword press by name (and R2-swim D1 the dark suit's killing retaliation): survey step 47
 * (L22 → L29) and the JS arc's `level_22 -> level_29__r2c2` stopped there. `wallFlyer.js` already transcribed the die
 * anim, `endAnim`'s `destroy`, `Mobile.death`'s fade and the removal; only the entry was refused. Flag ON: both kills
 * are staged through `levelRun.stageWallFlyerKill`, whose `killLockLedger` is COMPUTED (L22, L25 and L27 hold no
 * `tset == -1` lock, so it is a scanned nil; a room with one that the removal would open refuses by name). The class
 * has no `removed()` and no `setPersistence`: a kill writes nothing, and a re-entered room rebuilds the body.
 * `dieEffects("Sword")` adds a `SlashHit` (an untyped visual Entity that nothing reads). OFF: the refusals, verbatim.
 */
//   → `CONTACT_FIDELITY.wallFlyerKill`

/**
 * W7 — THE MOVING SHIELD TURNS A WALLFLYER (slice `seedling-fidelity-wallflyer`).
 *
 *     Player.as:1691-1708   shieldBump(): if (shieldObj && v.length > 0) shieldObj.collideTypesInto(enemies, …) →
 *                           hasDarkShield && hitsTimer <= 0 ? o.hit(shieldForce, p, darkShieldDamage, "Shield")
 *                                                           : o.knockback(shieldForce, p)
 *     WallFlyer.as:172-176  knockback(): v.x = -v.x; v.y = -v.y          — no `!destroy` / "die" gate
 *
 * `levelRun.shieldBumpNow` (U9-swim) shoved the chasers and the spinners and never asked the wallflyers. MEASURED on
 * the game while witnessing W6 (survey step 47's walk, L22, the shield held since step 40): at t52 `wallflyer@64,80`
 * reverses (+4 → −4) with `hits_timer` 24 and no hit, and back again at t53, as the player's shield box crosses it;
 * the model's flies on. Flag ON: the bump reverses a touched flyer (the dark arm is `hitWallFlyer` with
 * `t: "Shield"`, damage 0.5, and a kill is `stageWallFlyerKill`'s). OFF: the wallflyers are not asked, verbatim.
 */
//   → `CONTACT_FIDELITY.wallFlyerShieldBump`

/**
 * W8 — THE BULB IS A LIVE BODY, AND ITS DEATH WRITES LAVA (slice `seedling-fidelity-bulb`; `bulb.js`,
 * `Enemies/Bulb.as`).
 *
 *     Bulb.as:35-61   update(): "drop"/"die" → slide to the tile centre, mobileUpdate(); else super.update() (Bob's
 *                     chase); then `if (hits >= hitsMax && anim != "drop"/"die") play("drop")`
 *     Bulb.as:63-66   startDeath(): { }                          — the blow sets nothing
 *     Bulb.as:68-86   endAnim(): "drop" → play("die"); collidePoint("Tile", x, y).t = 17;  "die" → FP.world.remove
 *
 * Survey step 160 (L74, the Darkshield) refused on `bulb@48,112` standing on the one-tile floor between the lava
 * pools, as a static `"Enemy"` body (unbridged, `contactPricing` a `mover`), and `KILL_ARM_POLICY.Bulb` refused its
 * kill by name. Flag ON: the class is a bridged chaser (`chasers.CHASERS.bulb`, `spinner.MODELLED_ENEMY_CLASSES.Bulb`)
 * walked by `chaserStep`, its contact billed by `chaserContactNow`, a kill staged as the game runs it (the armed
 * update, "drop", the lava write into the run's per-visit tile overlay, "die", the removal), and the kill arms
 * forecast the lava tile and refuse a kill whose tile the rest of the visit needs. OFF: the class is the `mover` it
 * was and its kill is refused, byte-identical.
 */
//   → `CONTACT_FIDELITY.bulbLive`

/**
 * THE SWITCHES. They are read at CALL time, so a measurement can turn any of them on without editing this file:
 *   - node: `SEEDLING_CONTACT_FIDELITY=all` (or a comma list of the keys) in the environment, read once at import;
 *   - a test: `withContactFidelity({ drillLive: true }, () => …)`, which restores the previous values.
 * ⛔ The browser has no such hook on purpose: the page and its solve worker run the defaults.
 */
export const CONTACT_FIDELITY = {
    /**
     * ON by default (fidelity LINEFLIP, licensed by the user 2026-10-05: *"Yes: flip + re-record"*). TERRAIN stopped
     * it OFF because it moves three things nothing else does: the `r9-campaign` producer (`r9-solve-18` re-plans
     * 510 → 519 t; re-recorded on the game, and `r9-solve-19`'s declared `seam.time` follows), `solverSpinnerKill`
     * F2 (a lock-less spinner, post-sword (5,5): 241 → 221 t) and `seedlingCanCross`'s L22-from-L25 `cannot` (its
     * cause becomes a corridor stall, not the wallflyer danger). The spinner's hammer and the BobBoss's own
     * `collideLine("Player", …)` rays go through the same function. No committed tape's replay moves.
     * `false` reproduces the BEFORE model (and the old `r9-solve-18` re-plans 510 t).
     */
    collideLinePointsExact: true,
    /** ON by default (fidelity TERRAIN D3): with it on, no committed tape, producer `--check` or bounded pin moved. */
    wallFlyerSwordHits: true,
    /** ON by default (fidelity TERRAIN D3): with it on, no committed tape, producer `--check` or bounded pin moved. */
    drillLive: true,
    /** fidelity BOBSOLDIER W4 — see its paragraph above. */
    bobSoldierLive: true,
    /**
     * fidelity WALLFLYER W6 — see its paragraph above. ON by default: with it on, no committed tape replay (tapeRunner
     * 557 pairs, md5 unchanged), producer `--check` or identity row moved; only the refusal it retires changes.
     */
    wallFlyerKill: true,
    /** fidelity WALLFLYER W7 — see its paragraph above. ON by default, on the same measurement as W6. */
    wallFlyerShieldBump: true,
    /**
     * fidelity STATICLADDER D2 — a `DarkTrap` dies to a lit `LightPole` (`enemyDamage.DARKTRAP_LIGHT_DEATH`):
     * `levelRun.stepDarkTrapsNow` starts the death when the pole's light is within 28 px, the body is harmless from
     * that tick, and "die1"'s end removes it and writes its tag; the danger map stops pricing a dying one and the
     * combat ladder's kill rung gains a LIGHT arm (press the pole). ⚖ OFF by default again (user, 2026-10-10): flipped
     * ON at the wave-10 harvest, then GAME-REFUTED in L65 by wave 11's PUSHBLOCK (step 146's walk lights a pole and the
     * game's `darktrap@144,144` does NOT die — the player takes 2 hits; step 148's walk leaves the game 3 ticks after its
     * light-arm thrust; in L63 the arm's stance misses the pole's core by ~1 px). Evidence:
     * `CC/docs/cloud-reports/seedling-fidelity-pushblock-evidence/lightarm-refuted-l65-*`. OFF until a fix slice
     * re-witnesses L62, L65 and L63 on the game. OFF moves no committed tape (ON never did); survey 115 refuses again.
     * ⛓ fidelity DARKTRAP2 D1: the L65 refutation was NOT the light death — replayed per tick on the game, the pole
     * lights at t50 (t133) and `darktrap@144,144` starts "die1" at t81 (t164), the model's ticks exactly. Both walks
     * left the game at a SWORD press inside the spear's animation (`spearingWindow` below), and step 146's then fell
     * into a pit and rebuilt the room before "die1" ended.
     * ⚖ ON by default since the wave-11 harvest (user, 2026-10-10: "Yes to all", on the slice's measured movers).
     */
    darkTrapLight: true,
    /**
     * fidelity DARKTRAP2 D2 — `spearing` IS UP FOR THE SPEAR'S WHOLE ANIMATION, NOT ONE TICK.
     *
     *     Player.as:410    sprSpear.add("spear", [0..7], 45, true)       — `spearEnd` is the wrap's callback (:1051)
     *     Player.as:781    set slashing: if (… && !spearing) { … }       — a sword press while spearing is GATED
     *     Player.as:815    set spearing: if (… && !slashing) { if (!spearing && _s) play("spear") }
     *
     * 8 frames at 45 × `FP.elapsed` 0.0333 an update wrap on update 6, so `spearing` holds through the press tick + 5
     * (`combatVerbs.SPEAR_ANIM_TICKS`). The model's gate read `swordWindow.pending` — up for ONE tick — so a sword
     * press 3 or 5 ticks after a thrust slashed (and dashed) in the model and did nothing in the game. Measured: L65
     * step 146 (thrust t48, presses t51/t53 → the model's dash moves y 1.88 px at t54) and step 148 (thrust t131,
     * presses t134/t136 → dx −1.88 at t137). ON: the slash gate (press and release) reads the window, a spear press
     * inside a swing, a wand/fire window or its own window is gated (no thrust), and `slashInfo.openUntil.spearing`
     * carries the end tick so `solverBot.previewWalk` ages it like the wand/fire windows.
     */
    // ⚖ ON since the wave-11 harvest (user, 2026-10-10), with darkTrapLight and fallBurnsPress.
    spearingWindow: true,
    /**
     * fidelity DARKTRAP2 D2 — A PRESS DURING A PIT FALL IS LOST. `checkFallingInPit` sets `receiveInput = false` and
     * `Player.input()` returns at its first line (`!receiveInput || frozenTimer > 0 || fallFromCeiling`), so the
     * `useItem` inside it never runs. `playerPhysicsV2.stepV2` already drops the MOVE keys for a fall in flight at the
     * tick's start (`fall ? NO_KEYS : held`); the press path read `acting`, which did not. Measured: step 146's
     * corrected walk, the game's `receive_input` false from t227 and the t230 sword press is lost (the model's dash
     * moved y 1.71 px at t231).
     */
    // ⚖ ON since the wave-11 harvest (user, 2026-10-10), with darkTrapLight and spearingWindow.
    fallBurnsPress: true,
    /**
     * fidelity BULB W8 — see its paragraph above. ⛔ OFF by default: turning it on moves committed artifacts (the
     * measured movers are in `CC/docs/cloud-reports/seedling-fidelity-bulb.md`), and a default flip is the user's
     * licence to give.
     * ⚖ ON by default since the wave-11 harvest (user, 2026-10-10: "Yes to all", on the slice's measured movers).
     */
    bulbLive: true,
};
/** The defaults this slice shipped, for a reader that asks what "default" was. */
export const CONTACT_FIDELITY_DEFAULTS = Object.freeze({ ...CONTACT_FIDELITY });
export const CONTACT_FIDELITY_KEYS = Object.freeze(Object.keys(CONTACT_FIDELITY));

/**
 * ⛓ The node measuring hook: `SEEDLING_CONTACT_FIDELITY=all|none|<keys>` sets EVERY switch (the named ones ON, the
 * rest OFF), so `none` is the byte-identical BEFORE model.
 */
const envFlags = globalThis.process?.env?.SEEDLING_CONTACT_FIDELITY;
if (envFlags) {
    // `all`, `none`, or a comma list of the keys to turn ON (every other key OFF)
    const want = envFlags === 'all' ? CONTACT_FIDELITY_KEYS
        : (envFlags === 'none' ? [] : envFlags.split(',').map((k) => k.trim()).filter(Boolean));
    for (const k of CONTACT_FIDELITY_KEYS) CONTACT_FIDELITY[k] = false;
    for (const k of want) {
        if (!CONTACT_FIDELITY_KEYS.includes(k)) {
            throw new Error(`contactFidelity: SEEDLING_CONTACT_FIDELITY names "${k}"; the keys are ${CONTACT_FIDELITY_KEYS.join(', ')}`);
        }
        CONTACT_FIDELITY[k] = true;
    }
}

/** Run `fn` with some switches set, then restore them (also on a throw; after the promise, for an async `fn`). */
export function withContactFidelity(over, fn) {
    const before = { ...CONTACT_FIDELITY };
    for (const [k, v] of Object.entries(over)) {
        if (!CONTACT_FIDELITY_KEYS.includes(k)) throw new Error(`withContactFidelity: unknown switch "${k}"`);
        CONTACT_FIDELITY[k] = v === true;
    }
    let out;
    try {
        out = fn();
    } catch (e) {
        Object.assign(CONTACT_FIDELITY, before);
        throw e;
    }
    if (out && typeof out.then === 'function') return out.finally(() => Object.assign(CONTACT_FIDELITY, before));
    Object.assign(CONTACT_FIDELITY, before);
    return out;
}
