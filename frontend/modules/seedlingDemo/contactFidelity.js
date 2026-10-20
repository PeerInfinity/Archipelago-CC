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
 *   - a test: `withContactFidelity({ drillLive: true }, () => …)`, which restores the previous values;
 *   - the browser (⛓ CONTACT HOOK, slice `seedling-js-contact-hook`, the KILLLOCK hook's pattern): the flashPanel
 *     settings `seedlingContact<Key>` (one boolean per key, schema default = `CONTACT_FIDELITY_DEFAULTS`) set the
 *     panel's instance, the JS page reads `?contactFidelity=<keys>|none`, and a solve WORKER (its own module copy)
 *     runs the set an off-default request carries as `contactFidelity` and stamps it on the answer and the plan.
 *     At the defaults nothing is stamped: the request is byte-identical to the one before the hook.
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
    /**
     * fidelity LEASH D2 — A BAIT IS VERIFIED ON THE CHASER FORECAST (`solverBot.BAIT_FORECAST` reads this key, so the
     * page, its solve worker and the divergence sweep's `contact_fidelity=` set it like every switch here). OFF: a
     * bait stance is the straight line's, as it was. ON: each candidate's walk and dwell are previewed on one
     * forecast, a stance is offered only where the body leaves the world (a terrain death read against the CLASS's
     * flags), and the dwell's bound is that removal. Game-measured on L74 (leg 629): `lavarunner@24,56` pins on a wall
     * the straight line ignores. ⛔ OFF by default: ON moves no tape, producer `--check` or identity row, but two
     * bounded rows' refusal wording (the slice report lists them); the flip is the user's licence.
     * ⚖ ON by default since the wave-12 harvest (user, 2026-10-11: "ON at harvest", on the slice's measured movers).
     */
    baitForecast: true,
    /**
     * fidelity FORCEDHIT D2 — A PROVEN-FORCED HIT IS BILLED, NOT REFUSED (`forcedHit.FORCED_HITS` reads this key).
     * ⚖ The user, 2026-10-11 ("Allow forced hits"). OFF: a combat ladder with every rung refused is a refusal, as it
     * was. ON: the ladder first asks the proof — every input sequence over 36 held sets from this state, stepped on
     * the segment's fork, takes a hit within the bound — and then plans the least-damage crossing under the budget
     * (no death, one hit of margin), replays it, and bills the hit in the trace (`verb: 'forced-hit'`). Measured on
     * L73 (leg 622, `lavarunner@72,24`). ⚖ ON by default since the wave-13 harvest (user, 2026-10-11: "ON at
     * harvest"; game witness `forcedhit-l73-622-plan` 0 px, CI sweep 38183630094 done); `SEEDLING_FORCED_HITS=0` opts out.
     */
    forcedHits: true,
    /**
     * fidelity BOMBPUSHER D2 — THE LOBBER IS A LIVE EMITTER (`bombPusher.js`, `Enemies/BombPusher.as`,
     * `Projectiles/Bomb.as`, `Projectiles/Explosion.as`).
     *
     *     BombPusher.as:44-48   shotTime == 0 && FP.distance(x, y, p.x, p.y) <= 256 → play("shoot")
     *     BombPusher.as:52-64   the "shoot" wrap: shotTime = 15; add(new Bomb(x, y, Point(p.x, p.y)))
     *     Bomb.as:100-121       v = (p − pos) / 30; 30 updates onto the aim, the 31st one step past it and remove
     *     Explosion.as:40-66    radius int(24 × 0.65) = 15; Player → hit(null, 4, Point(x, y), 1)
     *
     * The model stepped no emitter, so L40BUTTON's damage-on walks were game-refuted (legs 378/381: the player waits
     * out group 0's fade on `buttonroom@272,208`, 157 px from `bombpusher@112,128`). Measured on the game
     * (`probe-seedling-bombpusher.mjs`, the two `bomb-refuted-*` tapes): one bomb every 46 ticks from the first tick in
     * range, hits at L42 t1064/t1156 and L41 t1153/t1291 (and t1337's kills). ON: `levelRun` steps the lobber
     * (`stepBombPushersNow`), its bombs (`stepBombsNow`) and their Explosions at `updateLists()`
     * (`drainBombBlastsNow`), billed through `applyPlayerHit`; an Explosion that would reach an `"Enemy"` body is
     * refused by name. OFF: the quiet room, byte-identical. ⚖ ON by default since the wave-13 harvest (user,
     * 2026-10-11: "ON at harvest"; L40 legs 378/381 refuse the hold by name — CI sweep 38185191405).
     */
    bombPusherLive: true,
    /**
     * fidelity MOVINGWAIT D2 — A LATCHED WAIT MAY PACE (`solverBot.MOVING_WAIT` reads this key).
     *
     *     ButtonRoom.as:67-69   set activate(a): if (a) { … } — "Can't be reset to false!!", so walking off changes nothing
     *     BombPusher.as:44-62   every bomb is aimed at the player's point at the wrap; Explosion.as:52-56 the 15 px disc
     *
     * A standing player within 256 px of a BombPusher is always hit (the blast lands ≤ 8.5 px past the aim), and on
     * every measured L40BUTTON walk every blast that landed on a walking player missed (BOMBPUSHER § D3). OFF: a hold
     * stands still by contract and one inside a lobber's reach is refused by name (`lobberHoldRefusal`). ON: when the
     * still wait prices a bomb and the hold is LATCHED (`deriveHold`'s `latched`, or `runLatchedWait`'s group), the
     * wait paces an out-and-back cycle from the stance, chosen only when every previewed sample is clean
     * (`planPacedWait`), and returns to the stance bit-exactly at each cycle end.
     */
    movingWait: false,
    /**
     * fidelity MOVINGWAIT D4 — THE TOTEM SHOT'S EXPLOSION IS AN `int` (`bossTotemFight.BOSS_TOTEM_SHOT.explosionHitRadiusInt`).
     *
     *     BossTotemShot.as:71   new Explosion(x + v.x, y + v.y, hitables, 24, 1)   — the ctor's `_x:int, _y:int`
     *     Explosion.as:22,40    private var radius:int; … radius *= radiusCoeff     — int(24 × 0.65) = 15
     *
     * OFF: the blast at the Number point with r 15.6, as before. ON: the truncated point with r 15. Measured over all
     * 277 committed tapes the runner plays: four shot blasts (`r6-totem-kill`/`-control` t387, at (122|182, 379.05)),
     * the player 58–77 px away; no verdict differs. ⚖ ON since the wave-14 flip, user 2026-10-12 ("Both ON";
     * byte-inert on tapes and sweeps, CI 38284542195).
     */
    totemShotBlastInt: true,
    /**
     * fidelity MOVINGWAIT D4 — A DEATH REBOOT SETTLES THE CAMERA THROUGH THE SHAKE (`levelRun.settleCameraForLoad`).
     *
     *     Player.as:1487    die(): dying = true; (FP.world as Game).restartLevel()   — no fade before the swap
     *     Game.as:538,2007  public static var shake; view(): if (shake > 0) jiggle FP.camera, shake -= 1
     *
     * OFF: every load drains the shake before its settle frames and the camera is exact. ON: a death reboot carries
     * the killing hit's shake into its settle frames as the shake band (⚖ the jiggle's VALUE is never modelled).
     * Measured on the game: BOMBPUSHER's L42 damage walk respawns at t1221 with `shake` 4 and settles at (777, 0)
     * where the drained settle says (776, 0). ⚖ ON since the wave-14 flip, user 2026-10-12 ("Both ON").
     */
    rebootShake: true,
    /**
     * fidelity L74LEG624 D3 — STRIKE_IFRAME_LAPSE: A PRESS IS GATED ON ITS HIT TESTS, NOT ON ITS PRESS TICK.
     *
     *     Enemy.as:140    hit(): if (hitsTimer > 0) return …   — the gate runs on each TEST tick
     *     Player.slash    the rect test runs on every tick `slashing` is up: T+1 … T+SLASH_HIT_TICKS
     *
     * `strikePolicy.strikeCandidates` refused any body whose (one-tick-old) `hitsTimer` read above 0, which is true
     * of the press tick and not of the window: a press whose later tests land at or after the i-frame's lapse damages
     * the body. Measured on L74 (leg 624, `lavarunner@208,96`, hammer C4's witnesses `tape-l74-624-press84`/`-press85`):
     * a press at t84/t85 kills it at t87 with no player hit, game and model at 0 px; the policy's own press goes in
     * at t88 and the body hits the player at t87. ON: a body is admitted when `projectedHitsTimer` at the press's
     * LAST test tick is ≤ 0 (`strikePolicy.iframeLapsesInWindow`); the `owed` rule and `ORDINARY_SWING_PERIOD`'s dash
     * refusal are untouched. OFF: the `hitsTimer > 0` refusal, byte-identical. ⚖ ON since 2026-10-14 (⚖ user, "Flip after DD lands"; fidelity
     * STRIKELAPSE's flip candidate): the two survey steps FLIP14 measured it costing (50, 62) are repaired behind it
     * (`solverBot.collectStandWalk` and its ceremony arm; `levelRun`'s forecast projects a dying body `dying`); it
     * moves strikes roster-wide (FLIP14's re-pins) and the campaign windows 16–30 (FLIP14's re-record).
     * `SEEDLING_STRIKE_IFRAME_LAPSE=0` opts out.
     */
    strikeIframeLapse: true,
    /**
     * fidelity L74LEG624 D2 — FALLROCK_POSTFALL: A CLEARED NON-ARENA `FallRock` IS BUILT AS THE GAME LEAVES IT.
     *
     *     FallRock.as:42-47   if (!Game.checkPersistence(tag)) { y = fallTo; type = "Solid"; _active = true; }
     *
     * `buildLevelWorld` refused a clear list naming a `fallrock` tag ("nothing here builds their fall"), and the page's
     * clear list is the game's live `persistence_cleared`: L74's arrival button drops `fallrock@288,144` (tag 2), so
     * every later build of L74 (a re-entry in the same run, a staged arrival after it) refused a TRUE state. ON: the
     * rock is built fallen — a 16x16 Solid at its cell, `_active` (a publication cannot drop it again), on the run's
     * `fallenRocks` arm (`levelWorld` marks the roster row `postFall`, `levelRun.fallRockStateFor` builds it landed).
     * `FallRockLarge` stays refused outside the arena (L82's `bossrock`). OFF: the refusal, byte-identical.
     * ⚖ ON since the wave-14 flip, user 2026-10-12 ("All three ON"); `SEEDLING_FALLROCK_POSTFALL=0` opts out.
     */
    fallRockPostFall: true,
    /**
     * fidelity L74LEG624 D4 — THE CHASER FORECAST RE-CHOOSES A LAVARUNNER'S SPEED BY TERRAIN, as the live run does.
     *
     *     LavaRunner.as:82-92   after super.update(): switch(getState()) { case 1, 17: swim() (1); default: walk() (1.5) }
     *
     * K2 put the tail in `levelRun.stepChasersNow` and not in `chaserForecastNow`, so a preview's lavarunner kept the
     * speed it was seeded with across lava and water. Measured on L74 leg 624: the detour's certified preview and its
     * drive part at t53 (`lavarunner@208,96`, 243.26 vs 242.2 px); the drive is the game's (0 px). ON: the clone runs
     * the same tail. OFF: as before. ⚖ ON since the wave-14 flip, user 2026-10-12 ("All three ON");
     * `SEEDLING_FORECAST_SPEED_BY_TERRAIN=0` opts out.
     */
    forecastSpeedByTerrain: true,
    /**
     * fidelity L74ARRIVAL — A BUTTON UNDER A ROOM ARRIVAL PRESSES ON THE WORLD'S FIRST LIVE FRAME (`levelRun.advance`).
     *
     *     Button.as:27-39     update(): collideTypesInto(["Player","Enemy","Solid"], x, y, v) … activate = tempCheck
     *     FallRock.as:103-109 fall(): … Game.freezeObjects = true
     *     Game.loadlevel      the Player is added before the buttons and `World.addUpdate` prepends, so on the first
     *                         live frame `Button.update` reads the cell the player was BUILT in, before `Player.update`
     *
     * The model armed a button only from a POST-MOVE box (the end of a tick), so a world's first live frame never
     * pressed one: L74 from the L73 door lands on `button@288,128`, the game freezes on t1 and the model moved on t1
     * and froze on t2 (every leg-624 witness: Δy +0.8/−1.35 at t1–t2). ON: `firstTickInWorld` arms from the arrival
     * box before the pending-fall resolve (a boot, a door arrival, a death or ending reboot). OFF: byte-identical.
     * ⛔ OFF by default (no licence yet); `SEEDLING_ARRIVAL_BUTTON_ARM=0|1` for a node measurement.
     */
    arrivalButtonArm: false,
    /**
     * fidelity UNBILLEDGATE D2 — A SOLVE WHOSE DRIVE TOOK DAMAGE NO PLAN BILLED IS REFUSED (`solverBot.UNBILLED_DAMAGE`
     * reads this key, so the page, its solve worker and the divergence sweep's `contact_fidelity=` set it like every
     * switch here). OFF: `solveSegment` returns success on reaching its goals, whatever the drive took. ON: at success,
     * a `playerHits` row of the segment's own ticks that `forcedHits` did not bill, or any `playerDeaths` row, refuses it
     * with `obstacle.kind: 'unbilled-damage'` (tick, source, hit and death counts). ⛔ OFF by default: ON refuses steps
     * the route survey solves today (the slice report lists them); the flip is the user's licence.
     * `SEEDLING_UNBILLED_DAMAGE_GATE=0|1` for a node measurement.
     */
    unbilledDamageGate: false,
    /**
     * fidelity SMALLGAPS D1 — A BUTTON-DROPPED FALLROCK'S RELEASE STEP LANDS IN THE FROZEN TICK, NOT THE NEXT ONE
     * (`levelRun.advance`'s `pendingButtonFalls` branch).
     *
     *     Bot.as:3201         if (game.blackCover > 0 || Game.freezeObjects) { deadFrames++; return; }   — at the TOP
     *     FallRock.as:91-96   cameraTimer == 0 → Game.freezeObjects = false   — the rock updates BEFORE the Player
     *
     * The press frame is a live tape tick on which the player does not move; every freeze frame after it is DEAD to
     * the tape, and on the last one (the release) the player takes one step under the held keys — before the next
     * observation. So to the tape a button freeze costs the player NOTHING: one step per tick, no stall. The model
     * banked that step in `pendingFreeSteps`, which lands one tick late (the BobBoss rock's measured lesson), so it
     * stood one tick (t1 ON with `arrivalButtonArm`, t2 OFF) where the page's `Bot` reads no stall (leg 624: 136,
     * 135.2, 133.85). ⚠ The p4f chaser witnesses that read "frozen at t1" took their FIRST poll at each tick, 20 dead
     * frames into the 175-frame freeze; the `Bot`'s own observation (`botDrain`) at the same tick is 135.2. ON: the
     * step is taken inside the frozen tick under its held keys (the BobBoss rock's form). OFF: byte-identical.
     * ⚖ ON since the wave-16 harvest (user, 2026-10-14); `SEEDLING_BUTTON_FALL_RELEASE_STEP=0|1` for a node measurement.
     */
    buttonFallReleaseStep: true,
    /**
     * fidelity SMALLGAPS D2 — AN INTERMEDIATE WAYPOINT ON ICE IS PASSED, NOT PARKED ON (the walker:
     * `botDriverV2.waypointReached`, read by `drive` and `solverBot.previewWalk` alike).
     *
     *     Player.as:516-537   onIce → friction = slidingFriction (0.025), moveSpeed = slidingSpeed
     *
     * `hasArrived` asks "within tolerance AND stopped" of every waypoint. On ice a one-tick tap from rest coasts tens
     * of px, so a ±1 px STOP is reachable only by luck: L45 (120,72) limit-cycles x 117.3–122.9 for ~300 t (route
     * step 62 with the strike lapse ON, 748 t vs 386 OFF). ON: a waypoint that is not the walk's last, reached while
     * the player stands on ice, is reached at "within tolerance" whatever the velocity; the walk's final target still
     * needs the stop. OFF: byte-identical. ⚖ ON since the wave-16 harvest (user, 2026-10-14); `SEEDLING_WAYPOINT_SLIDE=0|1` for a node measurement.
     */
    waypointSlide: true,
    /**
     * fidelity SMALLGAPS D3 — A LAVA CHAIN'S ARM HITS THE PLAYER (`levelRun.stepLavaChainsNow`, the `"Player"` arm).
     *
     *     LavaChain.as:21,76-93   hitables = ["Player", "Enemy"]; reach(): … else if (hit is Player)
     *                             (hit as Player).hit(null, force 5, getHitPos → the chain's own point, damage 1)
     *
     * K2PREP transcribed the `"Enemy"` arm and left the player to `dangerMap`'s pricing, so the live run never billed
     * a chain: on L75 (sweep leg 633, `level_75 <- in_L74_16_144 -> exit:out_teleporter_64_224`) the game takes a hit at
     * t162 from `lavachain@80,80` (its west arm, 32–80 × 86–90) and is thrown 4.72 px west where the model walks on.
     * ON: every chain in the room steps its anim (with or without bodies), and an arm that touches the PRE-move player
     * box on an update `reach()` runs bills `applyPlayerHit` from the chain's point; an arm whose anim is unknown (a
     * skipped `Game.time`) touching the player is refused by name. OFF: byte-identical.
     * ⚖ ON since the wave-16 harvest (user, 2026-10-14); `SEEDLING_LAVA_CHAIN_PLAYER_HIT=0|1` for a node measurement.
     */
    lavaChainPlayerHit: true,
    /**
     * fidelity CEREMONYSHOVE D2 — A PICKUP CEREMONY'S PHASE A IS STEPPED FOR THE CHASERS AND THE PLAYER'S OWN LINES
     * (`levelRun.stepCeremonyLumpNow`), not spent as a lump.
     *
     *     Pickup.as:91-108   pick_up(): Game.freezeObjects = true; specialTimer-- … (150 frames, then the text)
     *     Player.as:529-532  addShield(); shieldBump(); checkDrowning(); freezeStep();   ← ABOVE the gated move
     *     Player.as:1697     shieldBump(): if (shieldObj && v.length > 0) … o.knockback(shieldForce, (x, y))
     *     Enemy.as:247       knockback(): v += 5·unit(body − player)            ← no freeze gate
     *     Enemy.update       terrain switch, Mobile.death()'s fade, hitUpdate()  ← no freeze gate (the move is gated)
     *
     * The player's `v` is frozen non-zero, so a body inside the moving shield box is shoved on EVERY dead frame; the
     * game's chasers drain their i-frames and finish a death fade through the same frames, and so does the player's
     * own `hitUpdate`. MEASURED on p4f (`ceremonyshove-l30-*`): the dead frames fall between the observations one and
     * two ticks after the ceremony starts, and they shove 149 times (745.0 px/tick = 149 × 5 on two witnesses).
     * ON: those frames are stepped there (chasers, the shove, the player's i-frame), the dialogue's frozen ticks step
     * the chasers too, and `assertNoCeremonyBesideLiveChaser` stands down for what is now stepped. OFF: byte-identical.
     * ⚖ ON since the wave-16 harvest (user, 2026-10-14); `SEEDLING_CEREMONY_SHOVE=0|1` for a node measurement.
     */
    ceremonyShove: true,
    /**
     * fidelity LAPSECOST D2 — THE FLYER IS STEPPED (`chasers.CHASERS.flyer`, bridged under this key).
     *
     *     Flyer.as:58-69   p = collidePoint("Player", x, y + 10); if (p) play("fall");
     *                      if (fall) { v = 0; if (p && frame == droppedFrame) p.hit(null, dropForce, (x,y), damage); hitUpdate(); }
     *                      else super.update()          — Bob's chase to the player + targetOffset (0,-10), moveSpeed 1
     *     Flyer.as:45,83   solids = new Array(); hitPlayer() {}   — it flies through everything, and contact is harmless
     *
     * OFF the model never stepped a Flyer: the danger map priced it as a static body at its PLACEMENT, so a plan could
     * walk under a flyer that had chased it. MEASURED (sweep leg 773, L105, the lapse ON): `flyer@104,8` hovers above
     * the walk from t96, its "fall" reaches frame 10 at t103 and drops on the player (game `hits` 0 → 2, Δy +0.82), where
     * the model billed nothing. ON: the flyer chases, falls and drops as above (run and forecast), and the danger map
     * prices its drop (timed) instead of a placement. ✅ ON by default (the BeamTower trio flip, 2026-10-18); `SEEDLING_FLYER_LIVE=0|1` for a
     * node measurement.
     */
    // ⚖ ON with `beamTowerDrift` and `beamTowerBeamHit` since planning-9's flip (user "BeamTower trio", 2026-10-18).
    flyerLive: true,
    /**
     * fidelity BEAMTOWER D1 — THE BEAM TOWER'S SOLID DRIFTS WITH ITS `y` (`beamTower.stepBeamTowerFrame`).
     *
     *     BeamTower.as:53-56    if (Game.freezeObjects) return;          — the drift is skipped on a frozen frame
     *     BeamTower.as:100-103  y += 0.3 * Math.sin(Game.worldFrame(100, 2) / 100 * 2 * Math.PI);
     *     BeamTower.as:43-44    setHitbox(16, 32, 8, 24); type = "Solid"; — the box rides on `y`
     *
     * OFF the model held the tower's 16x32 Solid at its placement. Over a 90-update `Game.time` period the drift
     * spans 8.6 px, and where it sits depends on the `Game.time` at the visit's first live update (the staging's seam
     * time). MEASURED (LAPSECOST D2, leg 773 `flyerLive` plan, L105): the game's player holding `left` is blocked at
     * x 66.04 from t205 by `beamtower@48,40`, risen ~4.7 px, where the model walked through. ON: the run steps every
     * tower once per tick in its update slot (`Game.time` = `clock.now()`, no drift on a frozen tick), and the
     * tower's Solid is `liveRectOf`'s `beamTowers` arm. ✅ ON by default (the trio flip, 2026-10-18); `SEEDLING_BEAMTOWER_DRIFT=0|1`.
     */
    beamTowerDrift: true,
    /**
     * fidelity BEAMTOWER D3 — THE BEAM TOWER'S BEAM HITS THE PLAYER IN THE RUN (`levelRun.stepBeamTowersNow`).
     *
     *     BeamTower.as:57-95   if ((frame - 1) % 2 == 1) { rect = getRect(direction);
     *                            p = collideRect("Player", rect…); if (p) { p.hit(null, 5, (x, y), 1); Game.shake = 15; } }
     *
     * OFF the run never billed a beam: only the danger map priced it (`phaseHazardHit`, LADDER2), so a walk the
     * solver did not plan through a beam (an arrival) took the game's hit unmodelled. MEASURED (LAPSECOST residue 3,
     * leg 773's witness): on the first L104 tick after the crossing, `beamtower@16,56`'s UP beam (x 22..26, y 0..53)
     * takes the player at (24, 39.2): `hits` 1, Δy −4.275. ON: the run steps the tower's anim and fires the beam on
     * the player's PRE-move box, inclusively (`Entity.collideRect`), from the tower's pre-drift point; the shake is the
     * `beamTowerBeam` writer. ✅ ON by default (the trio flip, 2026-10-18); `SEEDLING_BEAMTOWER_BEAM_HIT=0|1`.
     */
    beamTowerBeamHit: true,
    /**
     * fidelity SPINNINGAXE D1 — A SPINNING AXE HITS THE PLAYER (`levelRun.stepSpinningAxesNow`).
     *
     *     SpinningAxe.as:48-63   update(): angle += spinRate; p = collideLine("Player", hub → hub + 32·(cos a, sin a))
     *                            || collideRect("Player", hub ± 6, 12×12); hitPlayer(p, a)
     *     SpinningAxe.as:65-76   hitPlayer(): p.hit(null, force 5, the foot of p on the blade 2 updates back, damage 1)
     *
     * Only `dangerMap` priced the axe (`hazards.axeHitsPlayer`, at the visit's update count in transit); the live run
     * never billed it. MEASURED (survey step 163, L75, at `e967758748`): the 366-t plan is hit on the game at t160 at
     * (86.05,132.60) by `spinningaxe@80,144` (rate −6, its blade at update 160 on the pre-move box) and the model walks
     * on. ON: every axe in the room keeps a per-world update counter (restarted at every rebuild: a door, a death, an
     * ending reboot) and bills `applyPlayerHit` from `hitPlayer`'s point when its blade or hub touches the PRE-move
     * box; a count it cannot vouch for (a frozen tick or a non-load dead-frame span in the visit) with the player
     * within the axe's reach is refused by name. OFF: byte-identical. ✅ ON by default since the user's axe flip (2026-10-18, with axeTimingRung + axeGateTransit + spinningAxePlayerHit
     * together);
     * `SEEDLING_SPINNING_AXE_PLAYER_HIT=0|1` for a node measurement.
     */
    spinningAxePlayerHit: true,
    /**
     * fidelity SPINNINGAXE D2 — A PHASE DODGE'S PARTIAL STALL IS RE-PROBED (`solverBot.walkToUnder`).
     *
     * The ladder's phase arm (a lava chain or a beam tower dodged by its clock) keeps a stall whose walk then meets a
     * NON-phase danger as `partial`, drives the stall, and returns the rest of the corridor. The walk executor walked
     * that rest without probing it: survey step 163 (L75, `e967758748`) stalls for `lavachain@96,48` at t0 with
     * `partial: [spinningaxe@80,144]` and is certified into the axe's blade at t160 (the game takes the hit). ON: the
     * rest is probed from the stall's end and a hit climbs the ladder again. OFF: byte-identical. ⛔ OFF by default
     * (no licence); `SEEDLING_PARTIAL_DODGE_REPROBE=0|1` for a node measurement.
     */
    partialDodgeReprobe: false,
    /**
     * fidelity L40CONTACT D1 — A LIVE SPINNER IS A WALL TO A CHASER WHOSE `solids` HOLD "Enemy".
     *
     *     Enemy.as:58     type = "Enemy"                        — a Spinner is one, alive, for its whole visit
     *     Bob.as:39       solids.push("Enemy")                  — Bob / Puncher sweep against it (BobSoldier: no)
     *     Game.as:2276,2416  bob added before spinner; World.addUpdate PREPENDS — the spinner moves FIRST each tick
     *
     * OFF the chaser's "Enemy" walls were the static census bodies and the ice turrets only
     * (`levelRun.chaserStaticEnemyBoxesNow`), so a bob walked through a live spinner. MEASURED (hammer CW, staging A's
     * sword prefix, p4f): at t1801 the game stops `bob@736,752` dead at (743.929, 753.416) while `spinner@880,848`
     * crosses it heading south; the model walked it on. ON: the live sweep (`stepChasersNow`) meets every live
     * spinner where this tick's spinner step left it, and the forecast (`chaserForecastNow`) steps its own copy of
     * the spinners beside the chasers (the press's hits on a spinner are not forecast). ⛔ OFF by default (no
     * licence); `SEEDLING_CHASER_SPINNER_WALLS=0|1` for a node measurement.
     */
    chaserSpinnerWalls: false,
    /**
     * fidelity CORRIDOR D2 — THE WALK'S CORRIDOR PRICES THE LIVE WALLFLYERS AND DRILLS AT THE TICKS IT PASSES THEM.
     *
     *     WallFlyer.as   launches along `decideMotion`'s vector when the player crosses its 48 px trigger ray
     *     Drill.as       hops a tile toward a player within `runRange` 48 whose line of sight is clear
     *
     * Both are PLAYER-COUPLED and the run steps both live, but the danger map had no arm for either: it priced their
     * `.oel` PLACEMENTS (`staticEnemyDanger`), so a walk the corridor probe called clean was hit by a flyer that had
     * launched across it or a drill that had hopped onto it. MEASURED at e967758748 (survey steps 47, 53, 114; sweep
     * legs 262, 265, 283, 302, 696, 698, 703; the game takes each hit at the model's tick). ON: `previewWalk` steps the
     * room's wallflyers and drills against the previewed player (`run.corridorBodyForecast`, the live steppers on
     * clones) and the corridor probe prices each sample's contact (`dangerMap.corridorBodyDanger`), so the walk
     * executor's ladder routes round them or refuses by name. ⛔ OFF by default (no licence);
     * `SEEDLING_CORRIDOR_BODY_PRICING=0|1` for a node measurement.
     */
    corridorBodyPricing: false,
    /**
     * fidelity SEALDOOR D2 — THE FINAL DOOR OPENS ON APPROACH, AND THE SOLVER STEPS IT (`solverBot`'s `approach` verb).
     *
     *     FinalDoor.as:47-68   talkedToWatcher = !Game.checkPersistence(0, 114); within `seeDistance` 32 the first
     *                          frame adds a SealController (181 dead frames); the next, with
     *                          `SealController.hasAllSealParts() && talkedToWatcher`, plays "open"
     *     FinalDoor.as:79-88   `animEnd` removes the door; `removed()` clears its tag {113,0}
     *
     * The RUN has stepped the door since R6 slice 6c (`levelRun.stepFinalDoorsNow`, game-recorded as `r6-final-door`
     * and its unspoken-Watcher control), but the solver had no row for `solid:finaldoor`, so a corridor through it
     * refused as an ITEM gate and its clear-tag as `no-verb` (sweep 38926058850: L113 legs 804-806, 811-813, 818-820).
     * ON: `refineStrategy` selects `approach` for the door; the resolver reads both predicates from the run's OWN
     * state (`run.finalDoorGate`: the save's last seal slot, the {114,0} clear) and refuses by name, saying which one
     * fails, when the door cannot open; otherwise it walks into the 32 px circle, holds toward the door through the
     * ceremony and the open, and waits out the 56-tick animation and the one-tick `updateLists` fencepost. ✅ ON by
     * default since the user's flip (2026-10-17: measured under real seal delivery, js §5.86, L113 legs
     * 810/811/817/818/824/825 failed → done on the game); `SEEDLING_SEAL_DOOR_APPROACH=0|1` for a node measurement.
     */
    sealDoorApproach: true,
    /**
     * fidelity ARROWLANE D2 — AN ARMED LANE IS CROSSED, AND THE ARROWS THAT REACH THE WALK ARE BILLED
     * (`arrowLaneCrossing.js`, `solverBot.walkToUnder`).
     *
     *     ArrowTrap.as:31-62   armed: three arrows (x−4, x, x+4), v (0, 5), every 11 updates
     *     Arrow.as:42-58       a Player takes `hit(null, 5, (x, y))`; any hitable stops the arrow
     *
     * ⚖ The user (2026-10-16): "arrows aren't supposed to be dodgeable" — no dodge, gap or timing policy. OFF the
     * danger map priced an ARMED lane at every horizon to the floor, so a walk that started in one (L16's arrival from
     * L17) was refused by the gate and one that ended in one (L16's `stairsdown@112,64`) by AVOID's A*. MEASURED
     * (sweep 38926058850): 17 failing L16 legs. ON: where the crossing is forced (start or aim in a lane, or the lanes
     * separate them), the lanes and their arrows leave the walk's danger questions, the corridor is driven on a fork
     * with the run's own arrows, and the hits are billed as forced hits (`forcedHits` row `arrow-lane`, the forced-hit
     * budget). ⛔ OFF by default (no licence); `SEEDLING_ARROW_LANE_CROSSING=0|1` for a node measurement.
     */
    arrowLaneCrossing: false,
    /**
     * fidelity AXETIMING D2 — THE AXE TIMING RUNG: A SPINNING AXE'S GAP, CROSSED ON ITS CLOCK AT DASH SPEED
     * (`solverBot`'s AXE arm, `axeTimingCrossing`).
     *
     *     SpinningAxe.as:49-63   angle += spinRate each update; collideLine hub→hub+32·(cos a, sin a), the 12×12 hub
     *
     * A point in the blade's reach is swept once a revolution, so a walk is hitless at some phase only if its angle
     * round the hub, relative to the blade's, turns by less than a revolution while it is in reach. MEASURED (sweep
     * 38926058850, legs 529/530; survey 152/183; L61 `spinningaxe@160,80`, rate 7, period 52): the walking corridor
     * turns 8.77 rad in 55 in-reach ticks, so the AXE arm's stalls are hit at every phase; walked with the sword's
     * dash chain it is in reach 19–25 ticks and 17–21 stalls are clean. ON: after the AXE arm's stall search and bent
     * corridors refuse, the rung searches stall × dash-chain phase, certifies the crossing with the probe's own
     * predicate (the danger map's transit blade on the PRE-move box, the question `spinningAxePlayerHit` bills),
     * drives it, and refuses by name if the run billed a hit. OFF: never asked, byte-identical. ✅ ON by default since the user's axe flip (2026-10-18, with axeTimingRung + axeGateTransit + spinningAxePlayerHit
     * together);
     * `SEEDLING_AXE_TIMING_RUNG=0|1` for a node measurement.
     */
    axeTimingRung: true,
    /**
     * fidelity AXETIMING D2b — THE WALK'S DECISION GATE TIMES A SPINNING AXE'S BLADE (`solverBot.axeGateTimed`).
     *
     * The gate a walk opens with asks the WAIT question, where an axe is its whole 32 px disc. MEASURED (sweep
     * 38926058850, leg 497, L54): the player arrives 16 px under `spinningaxe@128,432` (rate −2) and the gate refuses
     * before any corridor is planned, though the blade is far from the player and the goal is the door 8 px below. ON:
     * that gate prices each axe by its exact blade and hub at the walk's first transit sample (the probe's own
     * question); a count the visit clock cannot vouch for keeps the disc. OFF: byte-identical. ✅ ON by default since the user's axe flip (2026-10-18, with axeTimingRung + axeGateTransit + spinningAxePlayerHit
     * together);
     * `SEEDLING_AXE_GATE_TRANSIT=0|1` for a node measurement.
     */
    axeGateTransit: true,
    /**
     * fidelity DASHSTEP D2 — A STATUE'S TALK CIRCLE IS 32 PX, NOT THE NPC DEFAULT 24 (`endingChain.talkRangeOf`).
     *
     *     NPC.as:27        talkRange = 24 (the field's default)
     *     Statue.as:25     talkRange = 32 (the one class that overrides it; `statue1`, `statue2`)
     *     NPC.as:190-226   inRange = FP.distance(x, y, p.x, p.y) <= talkRange; an X release (keys[6], the SWORD key)
     *                      in range opens the dialogue, and `Game.freezeObjects` holds the player from the next update
     *
     * OFF the run's talker arm (`levelRun.stepTalkersNow`) and the strike policy's release guard (`talkGuard`, ⚖
     * ruling 53) tested every placed talker at 24, so a sword press released 24–32 px from a statue froze the player in
     * the game and not in the model. MEASURED (hammer's dash flip, sweep 39005482173 leg 7, L0 `statue2@184,160`): the
     * t99 dash press releases at t100 31.79 px from the statue; the game freezes the player at t102 (x 180.153, vx 2.90
     * unchanged), the model walks on (182.803). ON: the run opens the statue's dialogue there (the capture replays at
     * 0 px), and the guard keeps a planned release outside 32 px. Two statues exist (L0, L87). ✅ ON by default since
     * the user's flip (⚖ "Harvest, then flip it ON", 2026-10-17); `SEEDLING_STATUE_TALK_RANGE=0|1` for a node
     * measurement.
     */
    statueTalkRange: true,
    /**
     * fidelity AXEFORCEDU D2 — A SPINNING AXE'S FORCED U IS CROSSED AND ITS HITS BILLED (`axePricedCrossing.js`,
     * `solverBot`'s ladder after the forced-hit rung).
     *
     *     SpinningAxe.as:49-76   the blade sweeps every point of its reach once a revolution; hitPlayer: force 5, damage 1
     *     Player.as:336          20 i-frames after a hit
     *
     * MEASURED (sweep 39153416627 at `4667f7e353`; legs 603 L71 north, 636 L75 north, 774 L103): each corridor goes
     * round the hub against the blade, so no stall and no dash-chain phase crosses it clean, and the forced-hit rung's
     * input tree cannot reach the blade 47–153 ticks out (*"depth 3 needs 46,656 more fork steps than the budget's
     * 668"*). ON: when the AXE arm's corridor, entered at every phase of the axe (the doorstep stalls `0 … period − 1`,
     * × the dash chain's phases when the pass may dash), is hit in every member — the certificate — the members are
     * driven on forks, the run bills the hits (knockback, i-frames), and the fewest-billed one that reaches the goal
     * alive inside `FORCED_HITS`' budget is walked and billed as a forced hit. OFF: never asked, byte-identical. ⛔ OFF
     * by default (no licence); `SEEDLING_AXE_PRICED_CROSSING=0|1` for a node measurement.
     */
    axePricedCrossing: false,
    /**
     * fidelity WATCHERTALK D2 — THE WATCHER'S EVENT `{114,0}` IS EARNED BY TALKING (`solverBot.refineStrategy` → `talk`).
     *
     *     Watcher.as:40-49   type = "Watcher" — in no solids list, so the clear-tag finds no SOLID at (72,72)
     *     NPC.as:188-239     inRange = FP.distance <= 24 opens the dialogue on proximity (`keyNeeded` false while
     *                        the tag is set); each page is a release of X; `doneTalking()` writes `{114,0}` false
     *
     * OFF a clear-tag goal naming `watcher@72,72` (the AP event "talk to the Watcher") takes the `already-clear` arm,
     * because the Watcher is never in `world.solids`: the survey's L114 step "solves" in 4 ticks with the flag never
     * written (`watcherTalks` empty), and the JS runtime's pre-check (`clearTagVerbOf`) refuses the sweep's legs
     * `no-verb` on `solid:watcher`. ON the clear-tag binds the run's watcher, selects `talk`, walks to a talk stance,
     * pages the dialogue (`execTalk`) and finishes on `watcherTalks` + the `earnedClears` row. OFF: byte-identical.
     * ✅ ON by default since the user's flip (⚖ "Flip watcherTalkVerb", 2026-10-19); `SEEDLING_WATCHER_TALK_VERB=0|1`
     * for a node measurement.
     */
    watcherTalkVerb: true,
    /**
     * seedling-fidelity-housekeep D3 — THE WALKER'S PLANNER SEES A BEAM TOWER'S DRIFT (`botDriverV2.livePerVisitOpts`
     * carries the `beamTowers` family, and `plannerObstacleAt` forwards it on the named-key path).
     *
     *     BeamTower.as:100-103  y += 0.3 * Math.sin(Game.worldFrame(100, 2) / 100 * 2 * Math.PI);  — the Solid rides on `y`
     *
     * `beamTowerDrift` (ON) moves the tower's Solid in the run, and the solver's own plans read it through the run's full
     * bag (`liveBag: run.liveGeometryOpts()`). The walker's do not: `livePerVisitOpts` builds no `beamTowers` key, and
     * `plannerObstacleAt`'s named-key path forwards eight families only (`R8_NORMALIZE_LIVE_BATCH.plannerDropsSixFamilies`
     * lists `beamTowers` as dropped) — so the walker (`jsRuntimeWalker`), `synthesizeLegs` and the verbs' mid-leg probes
     * plan against the tower's PLACEMENT while the run walks into its drifted Solid. ON: both carry the run's drifted
     * rects (`liveGeometryOpts().beamTowers`). ⛔ OFF by default (no licence; measured movers in the housekeep report);
     * `SEEDLING_WALKER_BEAM_TOWERS=0|1` for a node measurement, and the sweep's `contact_fidelity` input for CI.
     */
    walkerBeamTowers: false,
    /**
     * fidelity BOMBBLAST D2/D3 — A BOMB'S EXPLOSION LANDS ON A BODY (`levelRun.drainBombBlastsNow`'s `"Enemy"` arm,
     * and the walk's chaser forecast).
     *
     *     Bomb.as:16            hitables = ["Player", "Enemy", "ShieldBoss"]
     *     Bomb.as:62            removed(): add(new Explosion(x, y, hitables, 24))   — int x, y; radius int(24 × 0.65) = 15
     *     Explosion.as:47-66    collideRectInto each type (the square), then FP.distance(origin, origin) <= 15:
     *                           Enemy → (c as Enemy).hit(4, new Point(x, y), 1)    — t "", force 4, damage 1
     *     Enemy.as:141-181      the five gates; a landed non-killing hit arms 30 i-frames and knocks back (atan2 from
     *                           the blast point, both components WHOLE); the killing hit does not knock back
     *
     * OFF a blast whose disc reached a stepped chaser or a spinner refused BY NAME (seedling-fidelity-bombpusher), and
     * it is reached: hammer BW's bombstand ON solve (leg 381) at t1294 (#10 on `bob@272,112`), and with the strike
     * lapse ON at t1339 (#11 on `spinner@192,160`). MEASURED on the game (`probe-seedling-bomb-blast-body.mjs`, the two
     * `bombblast-*` witnesses): t1294 #10 lands on a Bob (hits 0 → 1, knocked back) AND a Spinner (1 → 2) in one blast;
     * t1340 #11 on a Bob (1 → 2) and the player; t1339 (lapse ON) #11 KILLS a Spinner (2 → 3, no knockback, removed at
     * t1350). ON: the run lands the arm (`bombBlastHitChaser` / `bombBlastHitSpinner`, one `bombEvents` row
     * `what: 'body-hit'` per body) and the walk's chaser forecast steps the same blasts onto its own bodies (D3). A
     * static census body in the square (no stepped state) still refuses by name. OFF: byte-identical.
     * `SEEDLING_BOMB_BLAST_BODY=0|1` for a node measurement.
     */
    bombBlastBody: false,
    /**
     * fidelity APBOSSES D2 — THE R4 BOSS-REPORT AS3 (`apReportBosses.js`; PeerInfinity/Seedling `r4-boss-report`
     * @ `0eda15f785`, ⚖ user 2026-10-19 Q1–Q3: all seven bosses report, Bob is always fought, every map).
     *
     *     BobBoss.as:31, 188-197        KILLED_TAG 3; no `hasFire` guard; the final death clears {32,3}, then adds
     *                                   `Fire(…, BOSS_DROP_TAG)` only while {32,4} holds
     *     FallRockLarge.as:116-127      the landing adds the boss while {32,3} holds, else the Fire while {32,4}, else
     *                                   nothing (and `playerPosition` only with the boss)
     *     Fire.as:49-55, DarkSword.as:49-58   `removed()` grants NOTHING (the host does) and clears its own slot
     *     Witch.as:46-55                `doneTalking` adds the sword while `hasWand && checkPersistence(1)` in L12
     *
     * ON: the run reads {32,3} {32,4} {12,1} off its persistence (`run.persistenceHeld`), writes them in band, grants
     * neither item, writes no tag −1 slot ({31,29} {11,29}), and the build accepts the three slots as read; the
     * solver's Witch and Bob executors finish on the REPORT, never on the item. The six other bosses are unchanged
     * (their kills already clear their OEL tag). `SEEDLING_AP_REPORT_BOSSES=0|1` for a node measurement.
     *
     * ⛓ fidelity APFLIP (vendor/seedling `ccdf189776`, the p4g wasm) adds, all behind this one switch: the Totem gate
     * (`BossTotem.as:291`, `bossTotem.stepBossTotem`'s `allTotemParts`), the four boss rooms' persistence responses
     * (`levelWorld.AP_BOSS_PERSISTENCE_RESPONSE`, H2), the totem's kill banked, the L32 arena rock's Solid at the
     * entity's own placement (a delivered-set move), and the JS runtime's `bossreport` capability.
     * ⚖ ON (user 2026-10-19, "Launch now; ON in R7 merge"): flipped by APFLIP inside js-7's one combined landing with
     * the p4g gitlink, vendor/seedling `ccdf189776` and the rules arc's R4b; there is no OFF interim on main.
     */
    apReportBosses: true,
    /**
     * fidelity L40GUARD D2 — THE CHASER ARM'S APPROACH STANCE, FOR A BODY THE ROOM HOLDS AWAY FROM THE PLAYER
     * (`solverBot.deriveGuardApproach`, asked only after `deriveKillByChaser`'s two scans priced NOTHING).
     *
     *     BobSoldier.as:30,33   moveSpeed 0.8, runRange 80 — it chases only inside 80 px; no return-to-post
     *     BobSoldier.as:34,114  attackRange 32 — the spin begins at d < 33; the blade is 8..16 px out (:165-166)
     *     Player.as:929-950     getSlashRect — 16 px along the swing, 32 across: a strike lands from a cell the
     *                           blade does not reach (witnessed on the game at d 20.5, `l40guard-diag-strike`)
     *
     * L40's `bobsoldier@880,832` stands in the 16-px pocket under the chest. MEASURED on the game (three witnesses,
     * worst |Δ| 0): it DOES chase once the player is inside 80 px, but the pocket's west wall holds it and it leaves
     * only as `vy` allows, so it never arrives inside the arm's straight-line ceiling — and that ceiling's kill term is
     * `3 × killWindowTicks`, 3 ticks for a class with no die animation, not three landed hits through its i-frames.
     * ON, a scan that priced nothing asks a second question: the cells within the sword's reach of the body (the
     * player walks in, on the body's timing) plus the reachable leash cells, each previewed by the arm's own
     * instrument with a ceiling of the body's travel plus `hits` landed hits at `KILL_PRESS_CADENCE` plus the slack.
     * Its refusal names which of REACH / TIMING / LEASH failed. OFF: never asked, byte-identical.
     * ✅ ON by default since the user's flip (⚖ "Flip all four", 2026-10-19); `SEEDLING_GUARD_APPROACH_STANCE=0|1`
     * for a node measurement.
     */
    guardApproachStance: true,
    /**
     * fidelity L40GUARD D3 — A GOAL TILE INSIDE A LIVE BODY'S DANGER IS REFUSED BY NAME AT DETOUR AND THE FORCED-HIT
     * RUNG (`solverBot.coveredGoalRefusal`), instead of spending a via set whose every candidate ends on that tile
     * (MEASURED by hammer LB on L40 leg 414: DETOUR 3,480 units a pass, `crusher-fork` 2,376, ~98 left if both refuse).
     * OFF: never asked, byte-identical. ✅ ON by default since the user's flip (⚖ "Flip all four", 2026-10-19); 
     * `SEEDLING_COVERED_GOAL_REFUSAL=0|1` for a node measurement.
     */
    coveredGoalRefusal: true,
    /**
     * fidelity L40GUARD D4 (hammer LB hand-over #6) — AN UNCERTAIN SHAKE BAND OVER A BODY THAT STEPS THE SAME ON AND OFF
     * SCREEN IS STEPPED, NOT THROWN (`levelRun.shakeBandMootNow`): at rest (`v` 0), no i-frames, no player overlap, no
     * terrain arm under it, alive and not falling. The jiggle is still not modelled (⚖ 2026-10-10); the band's answer is
     * simply not needed. Any other body under an uncertain band still throws by name. OFF: never asked, byte-identical.
     * ✅ ON by default since the user's flip (⚖ "Flip all four", 2026-10-19); `SEEDLING_SHAKE_BAND_MOOT=0|1` for a node measurement.
     */
    shakeBandMoot: true,
    /**
     * fidelity L40GUARD D4 (hammer LB hand-over #7) — A SWORD SWING AT A SPINNER THROUGH A SOLID MISSES
     * (`levelRun.spinnerSwingBlockedNow`), as `Player.slash`'s `collideLine("Solid")` gate runs it (`Player.as:917`; the
     * drill's and the wallflyer's arms already model it): a `landed: false` press row instead of the LOS assertion's
     * throw. Witnessed on the game (`l40guard-spinner-los`). OFF: the assertion, byte-identical.
     * ✅ ON by default since the user's flip (⚖ "Flip all four", 2026-10-19); `SEEDLING_SPINNER_SWING_LOS=0|1` for a node measurement.
     */
    spinnerSwingLineOfSight: true,
};
/** The defaults this slice shipped, for a reader that asks what "default" was. */
export const CONTACT_FIDELITY_DEFAULTS = Object.freeze({ ...CONTACT_FIDELITY });
export const CONTACT_FIDELITY_KEYS = Object.freeze(Object.keys(CONTACT_FIDELITY));

/**
 * The switch set a `SEEDLING_CONTACT_FIDELITY` / `?contactFidelity=` value names: `all`, `none`, or the keys that
 * are ON, comma-separated (every other switch OFF). An unknown key throws, naming `what`.
 */
export function parseContactFidelity(value, what = 'SEEDLING_CONTACT_FIDELITY') {
    const want = value === 'all' ? CONTACT_FIDELITY_KEYS
        : (value === 'none' ? [] : String(value).split(',').map((k) => k.trim()).filter(Boolean));
    const set = Object.fromEntries(CONTACT_FIDELITY_KEYS.map((k) => [k, false]));
    for (const k of want) {
        if (!CONTACT_FIDELITY_KEYS.includes(k)) {
            throw new Error(`contactFidelity: ${what} names "${k}"; the keys are ${CONTACT_FIDELITY_KEYS.join(', ')}`);
        }
        set[k] = true;
    }
    return set;
}

/** The inverse of `parseContactFidelity`: `none`, or the ON keys in `CONTACT_FIDELITY_KEYS` order. */
export function formatContactFidelity(set) {
    const on = CONTACT_FIDELITY_KEYS.filter((k) => set?.[k] === true);
    return on.length ? on.join(',') : 'none';
}

/** A complete switch set: every key, a boolean (a missing key reads its DEFAULT; an unknown key throws). */
export function normalizeContactFidelity(over = {}) {
    for (const k of Object.keys(over ?? {})) {
        if (!CONTACT_FIDELITY_KEYS.includes(k)) throw new Error(`contactFidelity: unknown switch "${k}"`);
    }
    return Object.fromEntries(CONTACT_FIDELITY_KEYS.map((k) => [k,
        typeof over?.[k] === 'boolean' ? over[k] : CONTACT_FIDELITY_DEFAULTS[k]]));
}

/** Is this (complete or partial) set the defaults? */
export function isDefaultContactFidelity(set) {
    const full = normalizeContactFidelity(set);
    return CONTACT_FIDELITY_KEYS.every((k) => full[k] === CONTACT_FIDELITY_DEFAULTS[k]);
}

/** Set THIS module instance's switches (a complete set; a missing key reads its default). */
export function applyContactFidelity(set) {
    Object.assign(CONTACT_FIDELITY, normalizeContactFidelity(set));
    return { ...CONTACT_FIDELITY };
}

/**
 * The stamp a solve request carries: this instance's switch set when it is OFF-default, else null (nothing is
 * stamped, so a default request is byte-identical to the one before the hook).
 */
export function contactFidelityStamp() {
    return isDefaultContactFidelity(CONTACT_FIDELITY) ? null : { ...CONTACT_FIDELITY };
}

/**
 * ⛓ The node measuring hook: `SEEDLING_CONTACT_FIDELITY=all|none|<keys>` sets EVERY switch (the named ones ON, the
 * rest OFF), so `none` is the byte-identical BEFORE model.
 */
const envFlags = globalThis.process?.env?.SEEDLING_CONTACT_FIDELITY;
if (envFlags) Object.assign(CONTACT_FIDELITY, parseContactFidelity(envFlags));
// ⛓ fidelity LEASH: `SEEDLING_BAIT_FORECAST=0|1` sets that one switch over the set above (a node measurement).
if (globalThis.process?.env?.SEEDLING_BAIT_FORECAST === '1') CONTACT_FIDELITY.baitForecast = true;
if (globalThis.process?.env?.SEEDLING_BAIT_FORECAST === '0') CONTACT_FIDELITY.baitForecast = false;
// ⛓ fidelity FORCEDHIT: `SEEDLING_FORCED_HITS=0|1` sets that one switch over the set above (a node measurement).
if (globalThis.process?.env?.SEEDLING_FORCED_HITS === '1') CONTACT_FIDELITY.forcedHits = true;
if (globalThis.process?.env?.SEEDLING_FORCED_HITS === '0') CONTACT_FIDELITY.forcedHits = false;
// ⛓ fidelity MOVINGWAIT: `SEEDLING_MOVING_WAIT=0|1` sets that one switch over the set above (a node measurement).
if (globalThis.process?.env?.SEEDLING_MOVING_WAIT === '1') CONTACT_FIDELITY.movingWait = true;
if (globalThis.process?.env?.SEEDLING_MOVING_WAIT === '0') CONTACT_FIDELITY.movingWait = false;
// ⛓ fidelity L74LEG624: `SEEDLING_STRIKE_IFRAME_LAPSE=0|1` and `SEEDLING_FALLROCK_POSTFALL=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_STRIKE_IFRAME_LAPSE === '1') CONTACT_FIDELITY.strikeIframeLapse = true;
if (globalThis.process?.env?.SEEDLING_STRIKE_IFRAME_LAPSE === '0') CONTACT_FIDELITY.strikeIframeLapse = false;
if (globalThis.process?.env?.SEEDLING_FALLROCK_POSTFALL === '1') CONTACT_FIDELITY.fallRockPostFall = true;
if (globalThis.process?.env?.SEEDLING_FALLROCK_POSTFALL === '0') CONTACT_FIDELITY.fallRockPostFall = false;
if (globalThis.process?.env?.SEEDLING_FORECAST_SPEED_BY_TERRAIN === '1') CONTACT_FIDELITY.forecastSpeedByTerrain = true;
if (globalThis.process?.env?.SEEDLING_FORECAST_SPEED_BY_TERRAIN === '0') CONTACT_FIDELITY.forecastSpeedByTerrain = false;
// ⛓ fidelity L74ARRIVAL: `SEEDLING_ARRIVAL_BUTTON_ARM=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_ARRIVAL_BUTTON_ARM === '1') CONTACT_FIDELITY.arrivalButtonArm = true;
if (globalThis.process?.env?.SEEDLING_ARRIVAL_BUTTON_ARM === '0') CONTACT_FIDELITY.arrivalButtonArm = false;
// ⛓ fidelity UNBILLEDGATE: `SEEDLING_UNBILLED_DAMAGE_GATE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_UNBILLED_DAMAGE_GATE === '1') CONTACT_FIDELITY.unbilledDamageGate = true;
if (globalThis.process?.env?.SEEDLING_UNBILLED_DAMAGE_GATE === '0') CONTACT_FIDELITY.unbilledDamageGate = false;
// ⛓ fidelity SMALLGAPS: `SEEDLING_BUTTON_FALL_RELEASE_STEP`, `SEEDLING_WAYPOINT_SLIDE`, `SEEDLING_LAVA_CHAIN_PLAYER_HIT` (0|1), likewise.
if (globalThis.process?.env?.SEEDLING_BUTTON_FALL_RELEASE_STEP === '1') CONTACT_FIDELITY.buttonFallReleaseStep = true;
if (globalThis.process?.env?.SEEDLING_BUTTON_FALL_RELEASE_STEP === '0') CONTACT_FIDELITY.buttonFallReleaseStep = false;
if (globalThis.process?.env?.SEEDLING_WAYPOINT_SLIDE === '1') CONTACT_FIDELITY.waypointSlide = true;
if (globalThis.process?.env?.SEEDLING_WAYPOINT_SLIDE === '0') CONTACT_FIDELITY.waypointSlide = false;
if (globalThis.process?.env?.SEEDLING_LAVA_CHAIN_PLAYER_HIT === '1') CONTACT_FIDELITY.lavaChainPlayerHit = true;
if (globalThis.process?.env?.SEEDLING_LAVA_CHAIN_PLAYER_HIT === '0') CONTACT_FIDELITY.lavaChainPlayerHit = false;
// ⛓ fidelity CEREMONYSHOVE: `SEEDLING_CEREMONY_SHOVE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_CEREMONY_SHOVE === '1') CONTACT_FIDELITY.ceremonyShove = true;
if (globalThis.process?.env?.SEEDLING_CEREMONY_SHOVE === '0') CONTACT_FIDELITY.ceremonyShove = false;
// ⛓ fidelity LAPSECOST D2: `SEEDLING_FLYER_LIVE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_FLYER_LIVE === '1') CONTACT_FIDELITY.flyerLive = true;
if (globalThis.process?.env?.SEEDLING_FLYER_LIVE === '0') CONTACT_FIDELITY.flyerLive = false;
// ⛓ fidelity BEAMTOWER D1: `SEEDLING_BEAMTOWER_DRIFT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BEAMTOWER_DRIFT === '1') CONTACT_FIDELITY.beamTowerDrift = true;
if (globalThis.process?.env?.SEEDLING_BEAMTOWER_DRIFT === '0') CONTACT_FIDELITY.beamTowerDrift = false;
// ⛓ fidelity BEAMTOWER D3: `SEEDLING_BEAMTOWER_BEAM_HIT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BEAMTOWER_BEAM_HIT === '1') CONTACT_FIDELITY.beamTowerBeamHit = true;
if (globalThis.process?.env?.SEEDLING_BEAMTOWER_BEAM_HIT === '0') CONTACT_FIDELITY.beamTowerBeamHit = false;
// ⛓ fidelity SPINNINGAXE D1: `SEEDLING_SPINNING_AXE_PLAYER_HIT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_SPINNING_AXE_PLAYER_HIT === '1') CONTACT_FIDELITY.spinningAxePlayerHit = true;
if (globalThis.process?.env?.SEEDLING_SPINNING_AXE_PLAYER_HIT === '0') CONTACT_FIDELITY.spinningAxePlayerHit = false;
// ⛓ fidelity SPINNINGAXE D2: `SEEDLING_PARTIAL_DODGE_REPROBE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_PARTIAL_DODGE_REPROBE === '1') CONTACT_FIDELITY.partialDodgeReprobe = true;
if (globalThis.process?.env?.SEEDLING_PARTIAL_DODGE_REPROBE === '0') CONTACT_FIDELITY.partialDodgeReprobe = false;
// ⛓ fidelity L40CONTACT D1: `SEEDLING_CHASER_SPINNER_WALLS=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_CHASER_SPINNER_WALLS === '1') CONTACT_FIDELITY.chaserSpinnerWalls = true;
if (globalThis.process?.env?.SEEDLING_CHASER_SPINNER_WALLS === '0') CONTACT_FIDELITY.chaserSpinnerWalls = false;
// ⛓ fidelity CORRIDOR D2: `SEEDLING_CORRIDOR_BODY_PRICING=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_CORRIDOR_BODY_PRICING === '1') CONTACT_FIDELITY.corridorBodyPricing = true;
if (globalThis.process?.env?.SEEDLING_CORRIDOR_BODY_PRICING === '0') CONTACT_FIDELITY.corridorBodyPricing = false;
// ⛓ fidelity SEALDOOR D2: `SEEDLING_SEAL_DOOR_APPROACH=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_SEAL_DOOR_APPROACH === '1') CONTACT_FIDELITY.sealDoorApproach = true;
if (globalThis.process?.env?.SEEDLING_SEAL_DOOR_APPROACH === '0') CONTACT_FIDELITY.sealDoorApproach = false;
// ⛓ fidelity ARROWLANE D2: the armed-lane crossing arm, for a node measurement.
if (globalThis.process?.env?.SEEDLING_ARROW_LANE_CROSSING === '1') CONTACT_FIDELITY.arrowLaneCrossing = true;
if (globalThis.process?.env?.SEEDLING_ARROW_LANE_CROSSING === '0') CONTACT_FIDELITY.arrowLaneCrossing = false;
// ⛓ fidelity AXETIMING D2: `SEEDLING_AXE_TIMING_RUNG=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_AXE_TIMING_RUNG === '1') CONTACT_FIDELITY.axeTimingRung = true;
if (globalThis.process?.env?.SEEDLING_AXE_TIMING_RUNG === '0') CONTACT_FIDELITY.axeTimingRung = false;
// ⛓ fidelity AXETIMING D2b: `SEEDLING_AXE_GATE_TRANSIT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_AXE_GATE_TRANSIT === '1') CONTACT_FIDELITY.axeGateTransit = true;
if (globalThis.process?.env?.SEEDLING_AXE_GATE_TRANSIT === '0') CONTACT_FIDELITY.axeGateTransit = false;
// ⛓ fidelity DASHSTEP D2: `SEEDLING_STATUE_TALK_RANGE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_STATUE_TALK_RANGE === '1') CONTACT_FIDELITY.statueTalkRange = true;
if (globalThis.process?.env?.SEEDLING_STATUE_TALK_RANGE === '0') CONTACT_FIDELITY.statueTalkRange = false;
// ⛓ fidelity AXEFORCEDU D2: `SEEDLING_AXE_PRICED_CROSSING=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_AXE_PRICED_CROSSING === '1') CONTACT_FIDELITY.axePricedCrossing = true;
if (globalThis.process?.env?.SEEDLING_AXE_PRICED_CROSSING === '0') CONTACT_FIDELITY.axePricedCrossing = false;
// ⛓ fidelity WATCHERTALK D2: `SEEDLING_WATCHER_TALK_VERB=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_WATCHER_TALK_VERB === '1') CONTACT_FIDELITY.watcherTalkVerb = true;
if (globalThis.process?.env?.SEEDLING_WATCHER_TALK_VERB === '0') CONTACT_FIDELITY.watcherTalkVerb = false;
// ⛓ housekeep D3: `SEEDLING_WALKER_BEAM_TOWERS=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_WALKER_BEAM_TOWERS === '1') CONTACT_FIDELITY.walkerBeamTowers = true;
if (globalThis.process?.env?.SEEDLING_WALKER_BEAM_TOWERS === '0') CONTACT_FIDELITY.walkerBeamTowers = false;
// ⛓ fidelity BOMBBLAST D2: `SEEDLING_BOMB_BLAST_BODY=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BOMB_BLAST_BODY === '1') CONTACT_FIDELITY.bombBlastBody = true;
if (globalThis.process?.env?.SEEDLING_BOMB_BLAST_BODY === '0') CONTACT_FIDELITY.bombBlastBody = false;
// ⛓ fidelity APBOSSES D2: `SEEDLING_AP_REPORT_BOSSES=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_AP_REPORT_BOSSES === '1') CONTACT_FIDELITY.apReportBosses = true;
if (globalThis.process?.env?.SEEDLING_AP_REPORT_BOSSES === '0') CONTACT_FIDELITY.apReportBosses = false;
// ⛓ fidelity L40GUARD D2/D3: `SEEDLING_GUARD_APPROACH_STANCE=0|1`, `SEEDLING_COVERED_GOAL_REFUSAL=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_GUARD_APPROACH_STANCE === '1') CONTACT_FIDELITY.guardApproachStance = true;
if (globalThis.process?.env?.SEEDLING_GUARD_APPROACH_STANCE === '0') CONTACT_FIDELITY.guardApproachStance = false;
if (globalThis.process?.env?.SEEDLING_COVERED_GOAL_REFUSAL === '1') CONTACT_FIDELITY.coveredGoalRefusal = true;
if (globalThis.process?.env?.SEEDLING_COVERED_GOAL_REFUSAL === '0') CONTACT_FIDELITY.coveredGoalRefusal = false;
if (globalThis.process?.env?.SEEDLING_SHAKE_BAND_MOOT === '1') CONTACT_FIDELITY.shakeBandMoot = true;
if (globalThis.process?.env?.SEEDLING_SHAKE_BAND_MOOT === '0') CONTACT_FIDELITY.shakeBandMoot = false;
if (globalThis.process?.env?.SEEDLING_SPINNER_SWING_LOS === '1') CONTACT_FIDELITY.spinnerSwingLineOfSight = true;
if (globalThis.process?.env?.SEEDLING_SPINNER_SWING_LOS === '0') CONTACT_FIDELITY.spinnerSwingLineOfSight = false;

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
