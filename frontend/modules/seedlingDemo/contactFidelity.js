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
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, WANDHOLD: "Flip both ON" / "Flip ON") turns it ON — MOVINGWAIT's paced hold — with bombBlastBody, WANDHOLD's L40 pair: leg 368 SOLVED, p4g 0 hits 0 px. Measured
     * (CI, main d3346cf784 + WANDHOLD): survey 0 verdict movers; the L38–L41 keyed sweep ×2 and a full sweep per arm: 368
     * failed → done, nothing else beyond known noise legs; probes standard ON green.
     */
    movingWait: true,
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
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, WANDHOLD: "Flip both ON" / "Flip ON") turns it ON — the L40 pair with movingWait (WANDHOLD). Measured
     * (CI, main d3346cf784 + WANDHOLD): survey 0 verdict movers; the L38–L41 keyed sweep ×2 and a full sweep per arm: 368
     * failed → done, nothing else beyond known noise legs; probes standard ON green.
     */
    bombBlastBody: true,
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
    /**
     * fidelity IGNEOUS D2/D3 — THE IGNEOUS-TO-LAVA TILE (type 31) CRUMBLES (`igneousLava.js`, `levelRun.renderIgneousNow`).
     *
     *     Tile.as:390-433    inside render(), on screen only: the nearest Player within sqrt(512)/2 of the tile's
     *                        centre counts igneousCounter 8 → 0 and breaks on the 9th in-range frame; a breaking tile
     *                        steps igneousFrame every 9 frames and is `t = 17` (LAVA) at the 3rd — player or not
     *     Player.as:713-737  31 → 17 under a standing player is a state CHANGE: `inLava`, the lava death
     *
     * Witnessed on the game (p4g, the five `igneous-*` D1 tapes, sweep leg 649's among them: lava at the t38 render,
     * death t39). ON: the run steps every type-31 tile at the frame's render point and writes lava through the per-visit
     * tile overlay (`withTileWrites`); a dead span or an arrival the run does not step refuses by name; the solver
     * prices the tiles' clocks. OFF: no tile is stepped, byte-identical. `SEEDLING_IGNEOUS_LAVA=0|1` for a node
     * measurement.
     * ⛓ planning-9's flip (⚖ user, 2026-10-21, "Flip igneousLava ON") turns it ON. Measured movers (CI, wave-20 A/B): route
     * survey step 195 (L76) SOLVED 519 → 496 (the OFF walk dies on the game; the ON walk is witnessed at 0 px) and sweep
     * leg 649 failed → done (×2); every other survey step and the other 48 type-31 legs unchanged.
     */
    igneousLava: true,
    /**
     * fidelity LIGHTS (wave 20) — THE L69 LIGHTS FIGHT IS STEPPED (`lightBoss.js`, `levelRun.stepLightsNow`): the intro
     * NPC (an X release within 24 px opens it, the pages freeze the room, its removal spawns the six fliers), the
     * `LightBossController`'s three `worldFrame` patterns and their shots, the six `LightBoss` fliers (their contact and
     * the `LightBossShot`s billed on the player; a sword / spear press hits them, `Enemy.hit`, `hitsMax` 3), the
     * `LightBossTotem` Solid, and `endState()` (the {69,0} report and the exit Teleporter to L36). The solver's
     * `solid:lightbosscontroller` row (`lights`) fights it. OFF: nothing here runs, byte-identical.
     * `SEEDLING_LIGHTS_BOSS_FIGHT=0|1` for a node measurement.
     * ⛓ planning-10's flip (⚖ user, 2026-10-22, "Flip lightsBossFight") turns it ON. Measured movers (CI, A/B at main
     * e2b0f2b63f): the route survey (full) only L69 159 NO-EDGE → SOLVED 826 t (0 hits, hammer LD) and L36 160 NO-ARRIVAL →
     * SOLVED 50; sweep legs 607/608 done ×2 at leg_budget 240 s (OFF failed/unresolved); probes standard green.
     */
    lightsBossFight: true,
    /**
     * seedling-fidelity-bosskills D2 — THE KING OF FIRE (`lavaBoss.js`, L82) IS STEPPED: the 99-update cycle, the
     * LavaRunners (bridged chasers once they land), the LavaBalls and their reflection, the 120-update damage window
     * and the death's report `{82,0}`; the body leaves the solids at its removal; a WandShot flies through it; the
     * `solid:lavaboss` → `lavaboss` strategy executes the fight. OFF: no fight is built, the census body stays the
     * wall it always was, a press on it refuses as before and the strategy refuses by name — byte-identical.
     * ⛓ planning-10's flip (⚖ user, 2026-10-21, "Flip kingOfFireFight") turns it ON. Measured movers (CI, wave-22 A/B
     * at BOSSFORK): the 8 boss sweep legs (505–508, 664–667) done ×2; the route survey (full): L82 199/220 SOLVED.
     */
    kingOfFireFight: true,
    /**
     * seedling-fidelity-bosskills D3 — THE TENTACLED BEAST (`tentacleBeast.js`, L57): the wake, the seeded
     * `Math.random` spawns (the run's declared `rng` stream, as the Owl's), the tentacles' sit window and their
     * `hitRect`, the whirlpools, the death's report `{57,0}` and the mouth Teleporter. OFF: byte-identical.
     * ⛓ planning-10's flip (⚖ user, 2026-10-22, "Flip now, hitless later") turns it ON. Measured movers (CI, A/B at main
     * 3ac4f7751d): the route survey (full) L57 83/114 NO-EDGE → SOLVED 2060 t; L58 84/115 NO-ARRIVAL → REFUSED on the
     * tag-1 teleporter (the Yeti's; the talk goal and PITPORT pending); sweep 492–495 done ×2 (budget 240 s); probes
     * standard 11/11. ⚠ The committed variant may take one swipe (only deaths are rejected): a HITLESS-preference slice
     * is queued (⚖ user).
     */
    tentacleBeastFight: true,
    /**
     * fidelity ROPE (wave 22) — A ROPE IS CUT ON PURPOSE (`solverBot.resolveRopeStrategy` / `execRope`): the solver's
     * `solid:rope` row (`rope`), the PULL rung's swing stance and `execPull` asked by a `clear-tag` on the rope's own
     * tag (`{16,0}` `rope@32,16`, `{28,0}` `rope@160,64`) or by a rope across a frontier corridor (L39's
     * `rope@96,384`). The cut itself is the run's (`levelRun.pullRope`, R5 slice 10), witnessed on the game by
     * rules-2's rope-events game probe (it lands with `rules-rope-events`). OFF: no row, no verb — byte-identical (the survey's L39 steps keep "No
     * strategy row exists"). `SEEDLING_ROPE_CUT_VERB=0|1` for a node measurement.
     * ⛓ planning-9's flip (⚖ user, 2026-10-21, "Yes, flip it") turns it ON, landing as one integration with js rope-goal
     * and rules-2's `rules-rope-events` (which makes the cut an event the logic requires). Measured movers (CI, wave-22
     * A/B): survey L39 steps 73 / 164 change refusal text (REFUSED → REFUSED); the 28 rope-level sweep legs: 0 movers.
     */
    ropeCutVerb: true,
    /**
     * fidelity L1516 D2 — A CHEST'S PROBE LINE STOPS ONE PIXEL SHORT OF `toX` (`chest.chestProbeLine`).
     *
     *     Chest.as:63      collideLine("Player", x-originX+m, …, x-originX+width-2*m, …)   (m = 2)
     *     World.as:442     while (x < toX) collidePoint(…)       World.as:514  the end point: `precision > 1` only
     *
     * So the integer probes are px+2 .. px+11, not px+12. Witnessed on the game (p4g, `l15-chest-line-edge`): the
     * player climbing column 9 under L15 `chest@144,96` at x 157.98 (box left 155.98) touched no probe and STOPPED at
     * y 114.24 under the Solid; the model's px+12 probe opened the chest and walked through it. ON: the line ends at
     * px+11 (the keyLock's transcription). OFF: px+12, byte-identical. `SEEDLING_CHEST_PROBE_LINE_END=0|1` for a node
     * measurement.
     * ⛓ planning-9's flip (⚖ user, 2026-10-21, "Flip chest / pit switches") turns it ON. Measured movers (CI, wave-21
     * A/B): sweep leg 206 failed → done ×2; the route survey (full) and the 236 chest-level legs: 0 movers (crossed↔done noise).
     */
    chestProbeLineEnd: true,
    /**
     * fidelity L1516 D3 — AN ENCLOSED PIT IS ENTERED ACROSS A CORNER (`solverBot.enclosedPitCorners`, the reach-pit
     * executor). `Player.getState` reads one point a tick (`Player.as:679`), so a diagonal step jumps it across the
     * corner a floor cell shares with a pit whose four neighbours are pits (L16's (13,4), sweep leg 206). Witnessed on
     * the game (p4g, `l16-corner-pit-corner` / `-control`, 0 px). ON: the executor walks to a stance in a diagonal floor
     * cell and takes the corner step its preview found. OFF: the plan exemption alone, which cannot reach such a pit
     * (refused by name), byte-identical. `SEEDLING_ENCLOSED_PIT_CORNER=0|1` for a node measurement.
     * ⛓ planning-9's flip (⚖ user, 2026-10-21, "Flip chest / pit switches") turns it ON. Measured movers (CI, wave-21
     * A/B): sweep leg 206 failed → done ×2; the route survey (full) and the 236 chest-level legs: 0 movers (crossed↔done noise).
     */
    enclosedPitCorner: true,
    /**
     * fidelity IGFADE (wave 23) — THE IGNEOUS-TO-LAVA TILES COUNT THE DEAD FRAMES' RENDERS (`levelRun.renderIgneousStepped`).
     *
     *     Engine.as:69-93,155-177  `update(); render();` — a frame the bot counts DEAD still renders
     *     Engine.as:77,242-252     the world swap lands at the END of an update, so that frame's render is the NEW world's
     *     Game.as:880-889          the fade's 20 dead updates skip `super.update()` but run `view()`
     *
     * So a visit's tiles take 1 + `LOAD_FADE_FRAMES` = 21 renders at the arrival before its first live one, and a
     * freeze, a pickup's phase A or a Help renders them once per dead frame at the frozen position. Witnessed on the
     * game (p4g, `igneous-l76-fade-stand` / `-86`, `igneous-l74-phase-a`). ON: those renders are stepped and the two
     * interim refusals (an arrival in range, a dead span while a tile counts) go, except for the spans that move the
     * player, which still refuse by name. OFF: the `igneousLava` interim, byte-identical.
     * `SEEDLING_IGNEOUS_DEAD_FRAMES=0|1` for a node measurement.
     * ⛓ planning-10's flip (⚖ user, 2026-10-21, IGFADE "Harvest + flip ON") turns it ON. Measured movers (CI, wave-23
     * A/B): the route survey (full) 0; the L76 sweep legs ×2: 0 (leg 650 flips with the seam time alone, ON = OFF in a
     * node seam sweep of its captured request).
     */
    igneousDeadFrames: true,
    /**
     * fidelity ROPESTANCE (wave 23) — A ROPE IS CUT BY THE SPEAR AND BY FIRE TOO (`solverBot.ropeCutWeapons`). The game
     * cuts a `RopeStart` from all three weapons through `Player.genericHit` → `RopeStart.hit()` (`Player.as:1095-1097`):
     * the sword's slash (reach gate, LOS waived for a Rope), the spear's 32x5 thrust rect (`spear()`: no reach gate and NO
     * line test at all) and fire's 32x32 area with its 16 px radius cut (`fire()`). The run models all three
     * (`levelRun.pullRope`). ON: with the selected slot NOT the sword, the `rope` verb and the PULL rung derive a spear
     * stance (a facing whose `spearRect` covers the rope) or a fire stance (`auditFire` reaches it, nothing else), and
     * press through the existing executors (`runSpear` / `runFire`), selecting a held weapon's slot when the selected one
     * cannot cut. OFF: a swordless run refuses by name, byte-identical. With the SWORD selected nothing changes either
     * way. `SEEDLING_ROPE_CUT_ANY_WEAPON=0|1` for a node measurement.
     * ⛓ planning-10's flip (⚖ user, 2026-10-21, ROPESTANCE "Harvest + flip ON") turns it ON. Measured movers (CI, wave-23
     * A/B): the route survey (full) 0; the 28 rope-level sweep legs ×2: 0. The L28 Spear from the L25 side still refuses
     * by name on the unstepped-drill INTERIM (`unsteppedDrills`) until fidelity DRILL models mixed-room drills.
     */
    ropeCutAnyWeapon: true,
    /**
     * fidelity DRILL (wave 24) — EVERY DRILL OF A ROOM IS STEPPED, BESIDE ITS OTHER ENEMIES (`levelRun.drillStateFor`).
     * `drillLive` admits a drill only where it is the room's ONE census enemy (L88), because `Drill.solids` adds
     * "Enemy" (`Drill.as:35`) and a lone drill's "Enemy" term meets nothing. The atlas holds two other drill rooms: L28
     * (two drills and a bobsoldier) and L91 (one drill and three bobs), whose drills the model never moved (measured on
     * p4g by ROPESTANCE: `drill@128,96` hopped onto the player at t59, the model saw nothing). ON: those drills are
     * stepped too, in the game's update order (the LAST placement first), and a hop's `collideTypes(solids, …)` reads
     * the "Enemy" bodies at their live positions (the other drills where this tick left them, the chasers where the
     * previous tick did, the static census boxes); a census body the run does not step is refused by name when a hop
     * asks for it. A chaser whose list carries "Enemy" (the bobs) meets the live drills too. `solverBot.unsteppedDrills`
     * (ROPESTANCE's interim) returns none. OFF: byte-identical. `SEEDLING_DRILL_MIXED_ROOMS=0|1` for a node measurement.
     * ⛓ planning-10's flip (⚖ user, 2026-10-21, DRILL "Harvest + flip ON") turns it ON. Measured movers (CI, wave-24
     * A/B): the route survey (full) only step 127 (L88)'s refusal WORDING (REFUSED → REFUSED, now naming the drill); the
     * 19 drill-room sweep legs ×2: 0 verdict movers. The escape cache needs no digest move (hammer's reach analysis; XC
     * verify 0 mismatches on the hammer producers ON).
     */
    drillMixedRooms: true,
    /**
     * fidelity YETI (wave 25) — THE YETI'S `doneTalking()` OPENS L58's TAG-1 TELEPORTER (`levelRun`'s talker arm,
     * `solverBot`'s clear-tag `yeti` arm).
     *
     *     NPCs/Yeti.as:40-50   doneTalking(): super; if (!createdPortal) { createdPortal = true;
     *                          Game.setPersistence(tag, false); Game.setPersistence(1, false); }
     *     Teleporter.as:89-94  update(): checkDeactivated() EVERY frame — a cleared tag opens it in the same visit
     *     NPCs/NPC.as:119-126  check(): a cleared tag REMOVES the NPC — but only when a `Game` is built (a revisit)
     *
     * ON: the talk is run (no longer refused by name): both writes land on the run's ledger at the close (`done` OR
     * `left`, the `talking` setter's two callers), `{58,1}` is applied MID-VISIT (the teleporter re-reads it) and the
     * Yeti's own `{58,0}` is banked for the next build (`NPC.check()`, which also needs the `despawn` response the
     * switch adds for `yeti`); the solver's clear-tag on `{58,1}` / `{58,0}` naming `yeti@56,56` talks it out. OFF:
     * `PLACED_NPC_TALK.yeti` stays REFUSED and every build/run is byte-identical. `SEEDLING_YETI_TALK=0|1` for a node
     * measurement.
     * ⛓ planning-10's flip (⚖ user, 2026-10-22, "Yes, please do the flip") turns it ON. Measured movers (CI, wave-25 A/B):
     * the route survey (full) 0; the L58 sweep leg ×2: 0 (done both arms); probes standard 11/11. Inert on the route until
     * rules-2's Yeti talk goal exists, and L58's door then refuses `unmodelled-pit-teleporter` (a queued model row).
     */
    yetiTalk: true,
    /**
     * fidelity MASKS (wave 25) — THE RUN'S `collideLine("Solid", …)` SAMPLES THE "Solid" PIXELMASKS, AND THE SWING AT A
     * CHASER ASKS IT (`levelRun.collideLineSolid`'s `{masks}`, DRILL's sampler). FlashPunk's `World.collideLine` asks
     * `collidePoint` per sample, and an entity with a `Pixelmask` answers from its opaque pixels: a `CliffSide`, a
     * `Building`, a `TreeLarge`, a `SnowHill` and the `TentacleBeast` body are type "Solid" (an `OpenTree` is NOT: it
     * extends `Tree`, type "Tree" — measured on p4g). ON: the lone drill's trigger (`Drill.as:86`) and the swing's line
     * at a drill, a wallflyer, a tentacle (the beast's by-name interim retires) and in the corridor body forecast sample
     * the masks, as the solver's chaser / drill mirrors do; and the chaser arm of `applyThrust` (bob, jellyfish,
     * bobsoldier, puncher, lavarunner…) gains `Player.slash`'s line (`Player.as:917`), boxes and masks, which it never
     * asked (measured on p4g: `mask-l65-wall`). OFF: byte-identical. `SEEDLING_PIXEL_MASK_SIGHT_LINES=0|1` for a node
     * measurement. NOT here: the spinner family (the hammer arc's forecast and strike line and the executor that must
     * agree with them; L92 holds a spinner beside CliffSides — handed over), the other boss arms (no mask in their rooms),
     * and every "Player"-type line (a spinner's hammer, a wallflyer's ray, the BobBoss swords, a chest's probe), which
     * never meets a mask. No crusher shares a level with a mask (`assertCrusherSolidsBound` still refuses that case).
     * ⛓ planning-10's flip (⚖ user, 2026-10-22, MASKS "Harvest + flip ON") turns it ON. Measured movers (CI, wave-25 A/B
     * on ubuntu-24.04): the route survey (full) 0; the 356 chaser-room sweep legs ×2: 0 settled (a 240 s keyed re-run
     * settled 201/210/387/404/776 as noise or slow); probes standard ON 11/11. seedlingRobust's {sword} L16 plan 878 → 882 t.
     */
    pixelMaskSightLines: true,
    /**
     * fidelity SPEARRECT (wave 25) — THE SPEAR'S TEST AS THE GAME RUNS IT, FOR EVERY SPEAR ARM (`presses.spearHitRect`,
     * `presses.pressRectTouches`). `Player.spear()` (`Player.as:954-992`) collects every hitable under a 32x5 rect
     * whose origin is `int` (`spearX`/`spearY` are `int` getters) with `Entity.collideRect`'s INCLUSIVE edges, calls
     * `genericHit` with NO reach gate and NO line test, and runs again on T+3 and T+5 (`spearDelayMax` 1). The model's
     * spear used the float `spearRect` with strict edges, borrowed `slash()`'s 16 px reach and line of sight in most
     * arms, and tested once (fidelity DRILL and LIGHTS modelled the game's rule for the drills and the fliers alone).
     * ON: `levelRun.applyThrust` tests a spear thrust by the game's rect for every arm, waives the reach and the line
     * for the spear (the hammer arc's static arm keeps its call site — a hand-over), and re-runs the whole thrust on
     * T+3 / T+5 from the live position in the latched direction (DRILL's and LIGHTS' own repeat lists stay empty), and
     * hands `genericHit` the spear's own `spearForce` 7 (every arm passed `swordForce` 5; the tentacle arm the sword's
     * damage too); the solver's spear stances (the block push, `runSpear`, the rope, the light pole, the turret) ask the
     * same rect. Witnessed on p4g at 0 px (`fixtures/spearrect-witness/`: a T+3 hit, a hit past 16 px, a corner touch,
     * a far edge, a truncated origin).
     * OFF: byte-identical. `SEEDLING_SPEAR_GAME_TEST=0|1` for a node measurement.
     * ⛓ planning-10's flip (⚖ user, 2026-10-22, SPEARRECT "Harvest + flip ON") turns it ON. Measured movers (CI, wave-25
     * A/B on ubuntu-24.04): the route survey (full) ON = OFF; the 43 spear-holding sweep legs ×2: 0 settled; probes
     * standard ON/OFF + spearrect green. The press ledger gains the T+3 / T+5 rows (`repeat: 2|4`).
     */
    spearGameTest: true,
    /**
     * fidelity DRILLKILL (wave 26) — THE SOLVER KILLS L28's DRILLS FIRST, THEN CUTS THE ROPE (`solverBot.
     * execDrillKillsFirst`). ⚖ The user (2026-10-22): *"The intended solution is to fight the drills first."* With
     * `drillMixedRooms` every L28 drill is stepped, and the rope cut's stances from the L25/L26 arrivals lie in a drill's
     * 48 px run range: the spear refused from both (`drill@128,96` t59, `drill@80,96` t31), Fire from L26. ON: before a
     * `rope` clear-tag whose stance (or the planned walk to it) gives a live stepped drill its trigger (`runRange`, the
     * masked "Solid" line), the solver kills that drill with a held sword or spear — a pre-stance 56 px out on one axis,
     * a creep until the drill hops (once to 32 px, once to 16 px), a press each time `hitsTimer` runs out (sword 3
     * hits, spear 2: `Enemy.hitsMax` 3, `spearDamage` 2), the removal waited out — and then plans the cut. FIRE CANNOT
     * KILL A DRILL (`Enemy.hit`: `hitByFire` is false and `Drill` never sets it; `fireDamage` 0) — a Fire-only run whose
     * stances a drill covers is refused BY NAME on that. The key also carries one transcription the p4g witnesses found:
     * `endAnim`'s "die" case plays `""` (`drill.stepDrillGraphic`), which the L88 skin golden reads. OFF: byte-identical.
     * `SEEDLING_DRILL_KILL_FIRST=0|1`.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, DRILLKILL "Harvest + flip ON") turns it ON. Measured movers (CI, main
     * 45e27e95e8 + the slice): the route survey (full) ON = OFF; the 8 L28 sweep legs ×2 per arm (240 s): done in all four;
     * probes standard ON green.
     */
    drillKillFirst: true,
    /**
     * fidelity REMBODY (wave 27) — A BODY REMOVED THIS FRAME STILL BLOCKS THE BODIES THAT UPDATE AFTER IT, UNTIL THE FRAME
     * ENDS. `World.remove` (`net/flashpunk/World.as:118-124`) only queues the entity in `_remove`; `World.updateLists`
     * (`:895-911`) takes it out of the type lists after `World.update` has run every entity. So the chaser whose
     * `Mobile.death` fade ends this frame (`FP.world.remove(this)`, `Mobile.as:68`) — or a bulb whose "die" ends — is still
     * an "Enemy" in `collideTypes(solids, …)` for every body stepped after it this frame (`Bob.solids` and
     * `LavaRunner.solids` carry "Enemy": `Bob.as:39`, `LavaRunner.as:43`). ON: `stepChasersNow` and its mirror
     * `chaserForecastNow` keep each body removed in this frame as a sibling wall for the rest of that frame (`removed`
     * is still set at once: every other reader is unchanged). OFF: the body stops blocking at once (byte-identical).
     * Witnessed on p4g (SKINSWING's `skinswing-l71-resite`: t63, three bodies removed, the game's `lavarunner@64,192`
     * held at y 203.303 — ON reproduces it to the end of the tape at 0 px). `SEEDLING_REMOVED_BODY_BLOCKS=0|1` for a node
     * measurement. NOT here (named in the REMBODY report): the other families' removals (drill, wallflyer, turret,
     * spinner, the static bodies) as walls to a mover stepped after them in the same frame.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, REMBODY "Harvest + flip ON") turns it ON. Measured movers (CI, main
     * b749d62c4a + the slice): the route survey (full) ON = OFF; 220 chaser-pair-room sweep legs ×2 per arm: 0 settled;
     * probes standard ON green.
     */
    removedBodyBlocks: true,
    /**
     * ⛓ seedling-fidelity-slowfix D-A (wave 27) — THE LIGHTS VERB'S SORTIE PORTFOLIO (`lightsVerb.execLights`). The verb
     * picks each sortie greedily (the earliest wait that lands, the most hits, the fewest ticks), and its ties fall to the
     * candidate order (`back` before `!back`). The fight's length is chaotic in that choice: across ten arrival clocks
     * (seam.time ±60) the spear solve runs 324..473 t either way and neither order wins on average (MEASURED; the
     * forecast equals the live run at every plan — the forecast is not wrong, the greedy is). At the committed
     * `lights-solve-spear` staging with `spearGameTest` ON the first tie (t165, `left3` back vs not) lands the 494 t fight
     * where OFF's forecast had only the one candidate and ran 361 t.
     * ON: before the fight's first decision the verb ROLLS OUT the whole fight in its own forecast once per tie order
     * (`LIGHTS_VERB.tieOrders`), and executes the shortest (the current order wins a tie) — never longer than the greedy
     * alone, since that greedy is one of the rollouts; each plan is still checked against the live run, as before.
     * A rollout carries the forecast ACROSS plans, which exposed one forecast fault the greedy never reads (it re-clones
     * from the run at every decision): a spear press set the sword's `slashTimer` (20) and `slashing`; `set spearing`
     * sets neither (`Player.as:810-822`), so ON the spear's press leaves both alone. Measured at the committed staging:
     * the spear solve 303 t (rollouts 421 | 239; `lights-solve-spear-portfolio`, recorded on p4g at 0 px), the sword's
     * two rollouts tie (507 | 507) and it plays `lights-solve-sword` unchanged.
     * Two EXACT prunes ride the switch and pay for the second rollout (a sortie that has landed nothing by its last test
     * is rejected either way; the first dodge unhit to the horizon scores Infinity, which nothing beats): the same answers
     * on all twenty perturbed solves, and the portfolio solve costs less than the greedy alone (15 s vs 23-27 s, node).
     * Without them both L69 sweep legs ran out the 90 s leg budget ON (×2, local).
     * OFF: byte-identical. `SEEDLING_LIGHTS_SORTIE_PORTFOLIO=0|1` for a node measurement.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, SLOWFIX "Harvest + flip ON") turns it ON. Measured movers (CI, main
     * b749d62c4a + the slice): survey full ON = OFF; the L69 legs ×2 per arm done (ON 38–85 s vs the 90 s budget —
     * thin headroom); probes standard ON green; the L69 spear solve 494 → 303 t (`lights-solve-spear-portfolio`).
     */
    lightsSortiePortfolio: true,
    /**
     * fidelity HITLESS (wave 27, ⚖ user 2026-10-22 "Flip now, hitless later") — THE TENTACLED BEAST'S FIGHT PREFERS A
     * VARIANT THAT TAKES NO HIT (`solverBot.execTentacleBeast`). The fork (BOSSFORK) committed the FIRST
     * `TENTACLE_BEAST_POLICY_VARIANTS` row that opened the mouth without a death, so a variant that took a swipe
     * could win over a later hitless one. ON: every variant is played on its own fork and the committed one is ranked
     * no hit first, then the fewest hits, then the fewest ticks (the list order breaks a tie); a hit stays ACCEPTABLE
     * when no variant is hitless (the verb's record names how many were tried and each one's hits). Only deaths are
     * refused, as before. OFF: byte-identical (first-without-a-death). `SEEDLING_TENTACLE_HITLESS_FIRST=0|1` for a
     * node measurement.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, HITLESS "Harvest + flip ON") turns it ON. Measured movers (CI, main
     * b749d62c4a + the slice): survey only L57 step 110 SOLVED 2060 → 1389 t; the L57/L58 sweep legs ×2 per arm: 492/493
     * game hits 1 → 0, verdicts equal; probes standard ON green.
     */
    tentacleHitlessFirst: true,
    /**
     * fidelity TIMEDPASS (wave 27) — THE SOLVER WALKS PAST A HOPPING DRILL IT CANNOT KILL (`solverBot.execDrillTimedPass`).
     * ⚖ The user (2026-10-23): *"Keep Fire; timed pass."* L28's rope rule stays Sword | Spear | Fire, and Fire cannot kill
     * a drill (DRILLKILL W0), so Fire alone from the L26 arrival needs a no-hit walk past `drill@80,96` (and
     * `drill@128,96`). `Drill.update` hops one tile toward a player within `runRange` from "sit" (every 15 ticks while
     * awake: "drill" 7 + "undrill" 7 + the "sit" check), and `hitPlayer` is the 10x10 box against the player's 4x5 on every
     * tick — so a pass is a POSITION question at each hop (a player 8-9 px off on an axis is jumped over, landing 7-8 px
     * behind), which a waypoint walk cannot answer. ON: before a `rope` clear-tag whose planned walk wakes a live stepped
     * drill and whose run holds no weapon that kills one (the kill stays first, ⚖ "fight the drills first"), the solver
     * SEARCHES a tick-by-tick walk to one of the cut's stances on the run's own drill forecast (`corridorBodyForecast`,
     * asked with `drillPass`) and the player preview (`previewStepper`), with a standing tail for the cut; certifies it on a
     * fork of the run with the cut itself; and plays it. OFF: byte-identical. `SEEDLING_DRILL_TIMED_PASS=0|1`.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, TIMEDPASS "Harvest + flip ON" — "Keep Fire; timed pass") turns it ON.
     * Measured movers (CI, the DRILLKILL harvest + the slice): survey full ON = OFF; 42 L28 + FallRock-room sweep legs ×2
     * per arm: ends identical; probes standard ON green. Plan movers: Fire alone L28 from L26 REFUSED → SOLVED 132 t;
     * Fire from L25 89 → 70 t.
     */
    drillTimedPass: true,
    /**
     * fidelity PITPORT (wave 26) — A LIVE TELEPORTER STANDING ON A PIT TILE IS AN EXIT THE WALK ENDS ON
     * (`botDriverV2.findExit`, `botDriverV2.plannerObstacleAt`'s pit arm, `solverBot.findExitNamed`).
     *
     *     Teleporter.as:89-118  update(): no fall guard — a live door fires on the first frame the player box overlaps
     *                           it (`!playerTouching`), and the teleporters update BEFORE the player (`addUpdate`
     *                           prepends), so the swap is recorded before `Player.update` reads the tile
     *     Player.as:745-771     checkFallingInPit(): the fall needs 20 frames of fade before its own `FP.world =`
     *                           (or `die()`), and only a fall already in flight could lose the race
     *
     * The pit edge reads the tile under `(x, y + checkOffsetY)`, a point inside the 4x5 box, and a door's 16x16 rect is
     * its own tile (L43, L58, L100: every pit door in the atlas), so on any approach the door's overlap comes no later
     * than the edge, and the door wins. ON: `findExit` admits a LIVE, unlatched door on a pit, and the planner exempts
     * that one pit tile only while it plans to that door (`allowTeleporter`). A SHUT door stays refused (DEACTIVATED)
     * and its pit stays forbidden floor; a run LATCHED on a pit door keeps `unmodelled-pit-teleporter` (the door cannot
     * fire, the pit takes the player). OFF: byte-identical. `SEEDLING_PIT_TELEPORTER_CROSSING=0|1` for a node
     * measurement. Witnessed on p4g: YETI's `talk`/`shut`, and PITPORT's `fixtures/pitdoor-witness/`.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, PITPORT "Harvest + flip, re-pin"; PITLATCH's one latch predicate, js-9's
     * review condition) turns it ON. Measured movers (CI, main 45e27e95e8 + PITPORT): survey verdicts equal (4 refusal
     * wordings advance to the next obstacle); 28 pit-room sweep legs ×2 per arm, 0 movers; probes standard ON: the two
     * arrival-composites pit-door legs cross on p4g (re-pinned `named` → `cross`). PITLATCH: 0 survey / 43-leg sweep movers vs
     * PITPORT ON; the doorless key L58 r1c4 failed → done.
     */
    pitTeleporterCrossing: true,
    /**
     * fidelity WANDHOLD D2 (wave 28) — A COVER'S HOLD MUST OUTLIVE THE WALKER (`solverBot.coverWeighArm`).
     *
     *     Cover.as:37-66    the fade runs while the group is active; the moment it drops, `reset()` makes the Cover
     *                       "Solid" again unless a Solid or the Player is inside it
     *     Button.as:27-46   a plain Button republishes every update: stepping off drops its group
     *
     * OFF a frontier `cover` keeps `hold` whatever its pressers are (the outlive refinement asks only `KILL_LOCK_TAGS`),
     * so guard (iii) hypothesises a cover open behind a plain Button the walker leaves — L39 from L38 (js links-b,
     * `Totem Part 72,40`) then grinds 400 ticks against `cover@112,144` (*"grazing 395 solid(s)"*). ON: a cover with a
     * group whose pressers all republish refines to `weigh`, as a lock does, so guard (iii) derives the weigh and a
     * cover no block reaches is a wall. OFF: byte-identical. `SEEDLING_COVER_WEIGH_REFINE=0|1`.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, WANDHOLD: "Flip both ON" / "Flip ON") turns it ON — L39's 400-tick grind → a named refusal (WANDHOLD). Measured
     * (CI, main d3346cf784 + WANDHOLD): survey 0 verdict movers; the L38–L41 keyed sweep ×2 and a full sweep per arm: 368
     * failed → done, nothing else beyond known noise legs; probes standard ON green.
     */
    coverWeighRefine: true,
    /**
     * fidelity SEARCHGAPS D-A (wave 28) — THE CRUSHER BAIT'S PRESS GOAL (`crusherBait.searchBaitOrdering`). The ordering
     * search's only goal was the AIM reached by crusher moves alone, with the round trip kept. L41's part is behind
     * `wandlock@240,96`, whose button only a block can hold, and the block is behind `cover@112,128`, whose button only the
     * CRUSHER can hold (`r5Totem.L41_PART3`): the search found R5's W,S,E ordering (the crusher parked on
     * `button@248,232`, the round trip kept) and threw it away, because the aim was still shut (sweep leg 871, 102 states).
     * ON: when no ordering reaches the aim, the shortest one whose parks newly HOLD DOWN a presser of a group that is shut
     * now (the round trip kept) is the answer — a PRESS goal, and the frontier re-plans from the room it leaves; and the
     * choreography lookup also reads R5's three L41 chains (`BAIT_CHOREOGRAPHIES_L41`, recorded on the game as
     * `r5-l41-part3`). OFF: byte-identical. `SEEDLING_CRUSHER_BAIT_PRESS_GOAL=0|1` for a node measurement.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, SEARCHGAPS "Harvest + flip both ON") turns it ON — L41's bait keeps R5's ordering and refuses honestly at the fire-block's wandlock. Measured (CI,
     * main d3346cf784 + SEARCHGAPS): survey 0 verdict movers, 6 refusal-text movers; the 23-key sweep ×2: 0 end movers;
     * probes standard ON green.
     */
    crusherBaitPressGoal: true,
    /**
     * fidelity SEARCHGAPS D-B (wave 28) — THE FORCED-HIT PROOF ASKS ONE HITLESS WITNESS FIRST (`forcedHit.hitlessWitness`).
     * The breadth-first proof spent its whole depth-2 level (1,332 forks, each replaying the segment) before it could say
     * "not proven"; one hitless `depthMax`-tick input says the same thing exactly. Measured at sweep leg 908 (L67): 5,328
     * of the request's 640 work units went to that tree, so the location solve ended on the deadline instead of on the
     * room's refusal. ON: the witness is asked first; OFF: byte-identical. `SEEDLING_FORCED_HIT_WITNESS_FIRST=0|1`.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, SEARCHGAPS "Harvest + flip both ON") turns it ON — the forced-hit proof asks one hitless witness first (1 fork vs 1,332). Measured (CI,
     * main d3346cf784 + SEARCHGAPS): survey 0 verdict movers, 6 refusal-text movers; the 23-key sweep ×2: 0 end movers;
     * probes standard ON green.
     */
    forcedHitWitnessFirst: true,
    /**
     * seedling-fidelity-residue D-A (wave 28) — TIMEDPASS's PASS TO THE EXIT (`solverBot.execDrillTimedPassExit`). With
     * `drillTimedPass` ON, Fire alone cuts L28's rope hit-free, but the rope's `FallRock` ceremony releases the drill
     * parked under the stance ONTO it (TIMEDPASS D1), so the walk that follows refuses at its first gate ("the danger map
     * forbids (151.87,55.81) — enemy:drill@128,96"), and from that state every continuation is hit (measured: 81 of 81
     * two-tick key sequences). ON: (1) a `reach-exit` whose planned walk wakes a live stepped drill, in a run that holds no
     * weapon that kills one, is SEARCHED as the pass is — the same beam, on the same forecast, with the goal the CROSSING
     * (the stepper's transition through that teleporter) — certified on a fork, then played; and (2) a pass to a cut's
     * stance whose segment's NEXT goal is a `reach-exit` is certified only when the cut leaves that crossing's pass open
     * (the search tries further stands until one does). OFF: byte-identical. `SEEDLING_DRILL_TIMED_PASS_EXIT=0|1`.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, RESIDUE "Harvest + flip both ON") turns it ON — Fire-only L28 leaves by both doors from L25 (182/134 t, p4g 0 px); from L26 a named refusal. Measured (CI,
     * main d3346cf784 + RESIDUE): survey ON = OFF; the 16 L28/L57/L58 sweep legs ×2: one mover (leg 494's continuation,
     * done both arms); probes standard ON green.
     */
    drillTimedPassExit: true,
    /**
     * seedling-fidelity-residue D-B (wave 28) — A WHIRLPOOL'S DROWN IS A DEATH THE SOLVER SEES, AND ITS PULL IS PRICED
     * (`Puzzlements/Whirlpool.as:61-83`, `Player.as:1431-1444`). A live whirlpool (timer in [dies, live + dies)) writes
     * the player's position on every update the player's box overlaps it within the radius (16): r = int(d), then
     * int(r * 0.999) — one pixel in a tick, plus a 20° turn — and once r <= 1 it calls `Player.drown()` on EVERY update:
     * `drownTimer` −0.5 (mod 10), the spiral `v`, `dying = true` (which skips the player's `super.update()`, so no input
     * and no move), and `die()` on the twentieth call. OFF the model threw a plain `Error` at the first call (bosskills D3)
     * and no planner priced the pull. ON: (1) the call is transcribed — `dying` latched (`state.drown.dying`), the timer,
     * the spiral `v`, and the death (a `playerDeaths` row, source `whirlpool`) on the twentieth; a whirlpool that ends
     * first leaves the player `dying` where it stands, as the game does; (2) a walk that drowns refuses by name
     * (`obstacle: {kind: 'whirlpool', id}`) instead of re-planning from the respawn, and the Tentacled Beast verb's plays
     * count a drown as a death; (3) the danger map prices a live (or growing) whirlpool's pull — `dangerAt`'s
     * `whirlpoolDanger` (the disc inside the box, at the tick's own timer in transit) and a `dangerVolumes` row (its
     * 32x32 box), so the walk's probe and its AVOID / WAIT rungs see it. OFF: byte-identical.
     * `SEEDLING_WHIRLPOOL_DROWN=0|1`.
     * ⛓ planning-11's flip (⚖ user, 2026-10-23, RESIDUE "Harvest + flip both ON") turns it ON — a whirlpool drown is a death the solver sees, its pull priced; L57's exit continuation plans a dodge. Measured (CI,
     * main d3346cf784 + RESIDUE): survey ON = OFF; the 16 L28/L57/L58 sweep legs ×2: one mover (leg 494's continuation,
     * done both arms); probes standard ON green.
     */
    whirlpoolDrown: true,
    /**
     * fidelity FIREPUSH (wave 28) — A `PushableBlockFire` ON THE FRONTIER IS SHOVED BY THE ROOM'S PULSER
     * (`solverBot.resolveFireBlockShove`). `PushableBlockFire.moveTypes` is `["Fire", "Pulse"]` and it has no lean, so
     * `resolveShoveStrategy` resolved the fire family to nothing and the frontier refused *"Strategy 'shove' failed to
     * apply"* (L40's Boss Key 2, legs 869/870: `pushableblockfire@576,576` under the walk block, whose Fire push north
     * stops dead against it). ON: a pulser whose 22 px reach holds the block, whose push (`pulsePushes`) leaves a
     * corridor to the aim, is driven by holding a publisher of its group until the block is at rest on the destination
     * (L40: `button@816,400` → `pulser@592,576` → west into (35,36)). The Fire press is considered and named, not
     * executed. OFF: byte-identical. `SEEDLING_FIRE_BLOCK_PULSE_SHOVE=0|1` for a node measurement.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, FIREPUSH "Flip all 3 ON if A/B clean") turns it ON. Measured (CI,
     * main f9342f25b8 + FIREPUSH): survey ON vs OFF one row (L40 step 67's refusal one link deeper, at
     * `button@816,400`); OFF = main row-for-row.
     */
    fireBlockPulseShove: true,
    /**
     * fidelity FIREPUSH (wave 28) — A FIRE PRESS REACHES AN ICE TURRET WHERE IT IS NOW (`presses.fireRespondersIn`).
     * `fire()`'s candidates are `collideRectInto` against each entity's CURRENT hitbox, and a dead `IceTurret` is a
     * 16x16 corpse that bumps move (`IceTurret.bump`). The audit tested every turret against its CENSUS rect — the
     * live body's 32x32 at its `.oel` cell — so a corpse pushed out of the flame stayed "reached". MEASURED on the game
     * (p4g, `firepush-l40-bosskey2`): `r5-l40-part5`'s second `fire.bumps` press from (488,440) leaves the corpse at
     * (488,407.5) — its box [399.5,415.5) is above the flame's [423.3,455.3) — and the model pushed it on to the t2
     * button. ON: the live rect and origin (`run.entities('turrets')`). OFF: byte-identical.
     * `SEEDLING_FIRE_LIVE_TURRET_REACH=0|1` for a node measurement.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, FIREPUSH "Flip all 3 ON if A/B clean") turns it ON. Measured (CI,
     * main f9342f25b8 + FIREPUSH): survey ON vs OFF one row (L40 step 67's refusal one link deeper, at
     * `button@816,400`); OFF = main row-for-row.
     */
    fireLiveTurretReach: true,
    /**
     * fidelity FIREPUSH (wave 28) — A PULSER READS THE FLAG ITS BUTTON PUBLISHED LAST TICK (`levelRun.stepPulsersNow`).
     * `Game.loadlevel` adds `button` (`Game.as:2341`) and `buttonroom` (`:2342`) BEFORE `pulser` (`:2357`), and
     * `World.addUpdate` prepends, so a Pulser updates BEFORE its publisher: its `activate` on tick T is what the Button
     * wrote on T-1, from the player box the end of T-2 left. The model read the end of T-1 box — ONE TICK EARLY.
     * MEASURED on the game (p4g, `firepush-l40-bosskey2`): the pulse that pushes `pushableblockfire@576,576` west starts
     * its glide at t5100 on the game and t5099 in the model, 0 px everywhere else. ON: the momentary (`pressedGroups`)
     * arm is lagged one tick, carried on the pulser's own state (`pressedLast`, in `stateDigestParts`' `visit` through
     * `pulserStates`); a LATCHED group is read as before. OFF: byte-identical. `SEEDLING_PULSER_PUBLISH_LAG=0|1`.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, FIREPUSH "Flip all 3 ON if A/B clean") turns it ON. Measured (CI,
     * main f9342f25b8 + FIREPUSH): survey ON vs OFF one row (L40 step 67's refusal one link deeper, at
     * `button@816,400`); OFF = main row-for-row.
     */
    pulserPublishLag: true,
    /**
     * fidelity FIREMOVE (wave 29) — THE SOLVER MOVES A `PushableBlockFire` BY FIRE PRESSES (`deriveBlockRoute`'s fire
     * arm) AND A FIRE BLOCK PARKS ON A BUTTON (`deriveWeigh`). `Player.genericHit`'s Fire arm (`Player.as:1125`) is
     * `hit(new Point(x, y), t)`, the absolute arm: one tile away from the player on the axis the `atan2` band admits. The
     * route search had a lean and a spear thrust and no Fire press, `deriveWeigh` skipped the fire family, and the frontier
     * refused *"NO block in this room can reach it"* (L39's opener, L40's t5 holder, L41's wandlock button). ON: one tile
     * per press from the cell on the block's far side, the flame audited to reach nothing else (`presses.auditFire`, the
     * live turret rect when `fireLiveTurretReach` is ON), executed through `runFire`'s `moves` arm; a fire route has its
     * order bound (the shared `MAX_ROUTE_ORDERS`, 48); a fire block already on a button dwells. OFF: byte-identical.
     * `SEEDLING_FIRE_BLOCK_ROUTE=0|1` for a node measurement.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, w29b "Flip all 3 ON") turns it ON (CI A/B: L41 Totem Part 240,144 SOLVED; 871 failed → done).
     */
    fireBlockRoute: true,
    /**
     * fidelity CORPSEBUMP D1 (wave 29) — A PUSHABLE'S GLIDE AND A TURRET CORPSE'S SLIDE STOP ON THE "Enemy" BODIES THE
     * RUN STEPS. `PushableBlock*`'s ctor does `solids.push("Enemy", "Player")` (`PushableBlock.as:28`,
     * `PushableBlockFire.as:31`) and `IceTurret.death()` does the same (`IceTurret.as:148`), so a Bob (`type =
     * "Enemy"`, `Enemy.as:58`) in the corridor stops the glide dead (`moveX`/`moveY` return the body). The block's
     * sweep (`levelRun.pushableCtx`) consulted the spinners only, and the corpse's slide THREW on a chaser. ON: the
     * block's sweep also asks every live bridged chaser (where the previous tick left it: `Game.as:2276-2301` add the
     * chasers before the blocks at `:2382-2384`, and `addUpdate` prepends) and every unremoved ice turret, alive or a
     * corpse (`:2296`, likewise); the corpse's slide asks the spinners (updated first) and the chasers added before it
     * (`bob`, `bobsoldier`, `flyer`, `bulb`), and a `Puncher` (added after it, so read one tick late here) refuses by
     * name within a tick's reach. `botDriverV2.runFire`'s enemy-room refusals narrow to the bodies those sweeps do not
     * see (`run.blockSweepBodyIds`). OFF: byte-identical. `SEEDLING_BLOCK_SWEEP_BODIES=0|1`.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, w29b "Flip all 3 ON") turns it ON (CI A/B: L41 Totem Part 240,144 SOLVED; 871 failed → done).
     */
    blockSweepBodies: true,
    /**
     * fidelity CORPSEBUMP D2 (wave 29) — AN ICE TURRET'S CORPSE IS A WEIGH'S HOLDER (`solverBot.deriveCorpseWeigh`).
     * `IceTurret.bump` moves a corpse one tile away from a Fire press (`IceTurret.as:172-203`), and a corpse on a
     * plain Button presses it for ever (`Button.hitables` holds "Solid" and "Enemy"). `deriveWeigh` asked the pushable
     * roster only, so L40's t2 group (`button@480,384`, the room's holder is `iceturret@472,400`'s corpse) was a wall
     * (guard iii). ON: where no block reaches and none is parked, a turret whose corpse tile shares an axis with the
     * presser is killed (`killIceTurretInPlace`, corpse only) and bumped there press by press (`runFire`'s bump arm),
     * each press audited against the corpse where it will be; then the fade is waited out. Needs `blockSweepBodies` and
     * `fireLiveTurretReach` ON (refused by name otherwise). OFF: byte-identical. `SEEDLING_CORPSE_BUMP_WEIGH=0|1`.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, w29b "Flip all 3 ON") turns it ON (CI A/B: L41 Totem Part 240,144 SOLVED; 871 failed → done).
     */
    corpseBumpWeigh: true,
    /**
     * fidelity MISCRES D1 (wave 29) — REMBODY'S RULE FOR THE NON-CHASER FAMILIES. `World.remove` only queues
     * (`World.as:118-124`) and `updateLists` drains after the frame (`:895-911`), so a DRILL whose `Mobile.death` fade
     * ends in its update (`Drill.as` via `Mobile.as:68`), a WALLFLYER's (`WallFlyer.as`, the same fade) and an ICE TURRET
     * corpse's removal (`IceTurret.as`, `FP.world.remove`) are still in the "Enemy" type list for every body that updates
     * after it in that frame. The model steps those families above the chasers (`advance`: wallflyers, drills, turrets,
     * then chasers — the game's prepend order: `Game.as:2415`, `:2296`, `:2290` added after `:2276-2301`), so ON:
     * `drillWallsNow` (the chasers' wall) and `drillEnemyBodiesTest` (a later drill's hop) keep a drill or wallflyer
     * removed on THIS tick, and `chaserStaticEnemyBoxesNow` an ice turret removed on this tick, for the rest of the
     * tick (`removedTick`, stamped ON only, outside a ceremony). OFF: the body stops blocking at once (byte-identical).
     * ⚠ NO GAME WITNESS: no AP_1 recording has a drill, wallflyer or turret removed beside a later "Enemy" mover
     * sweeping into its box (named in the MISCRES report). `SEEDLING_NON_CHASER_REMOVAL_BLOCKS=0|1`.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, wave 29) turns it ON (CI A/B on main ae411caa60 + the slice).
     */
    nonChaserRemovalBlocks: true,
    /**
     * fidelity MISCRES D1 (wave 29) — THE CHASER FORECAST FADES A CORPSE. `chaserForecastNow` cloned a live corpse
     * (`destroy`) or a body in its "die" (`dying`) and never stepped either on: only a BobSoldier's corpse faded, so
     * every other corpse stayed an "Enemy" sibling wall to the end of the forecast. The game removes it as live does:
     * the "die" Spritemap's end sets `destroy` (`Bob.endAnim`, the graphic half), then `Mobile.death` fades 0.1 a
     * tick on screen and `FP.world.remove`s at alpha <= 0 (`stepChaserEntity`'s destroy branch). ON: the forecast
     * steps both on its clones (the die anim on its own copy), and `removedBodyBlocks` keeps the removal a wall to the
     * end of that forecast tick, as live. OFF: byte-identical. WITNESSED on p4g (SKINSWING's `skinswing-l71-resite`,
     * the forecast taken at t58: OFF it leaves the live run, which is the game at 0 px, by 1.164 px at t64 and
     * 2.742 px at t68; ON it equals it). `SEEDLING_FORECAST_CORPSE_FADE=0|1`.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, wave 29) turns it ON (CI A/B on main ae411caa60 + the slice).
     */
    forecastCorpseFade: true,
    /**
     * fidelity MISCRES D3 (wave 29) — THE PHASE ARM'S FIRST STALL IS THE WALK'S START, IN A ROOM WITH IGNEOUS TILES
     * (`solverBot`'s dodge rung, LADDER2's phase arm). The arm stalls at the doorstep of a lava chain or beam tower and
     * up to 7 offsets earlier (step 4) — 28 samples at most. In L76 that doorstep stands within range of the type-31
     * tile (8,6) by `lavachain@128,64`, and a player in range is what drives the tile's clock (`Tile.as`, IGNEOUS):
     * every stall long enough to shift the chain's phase turns the tile to lava under the stance, so the arm refuses
     * at every arrival clock outside an 18-tick window. MEASURED (leg `level_76 <- in_L77_0_32 -> exit:out_teleporter_0_80`,
     * IGFADE's 650, captured at seam 5603): OFF the room REFUSES on the chain after 11,726 units (the page's 640 /
     * 2,560 budgets run out at `phase-dodge`); with `igneousLava` OFF it solves (184 units); ON this key, a stall at
     * the walk's start (out of the tile's range) is asked right after the doorstep's own and solves in 183 units (727 t).
     * ON: in a room holding a type-31 tile (`run.entities('igneousTiles')`, `igneousLava` ON), `at = 0` is the second
     * stall candidate (the doorstep stays first, so a short doorstep stall that clears is still the answer); every other
     * room is unchanged. OFF: byte-identical. `SEEDLING_PHASE_DODGE_ARRIVAL_STALL=0|1`.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, wave 29) turns it ON (CI A/B on main ae411caa60 + the slice).
     */
    phaseDodgeArrivalStall: true,
    /**
     * fidelity L40RES (wave 29) — A STANCE WALK THAT RE-ENTERS ITS OWN ORDER PASSES TO THE NEXT DOOR ON ITS FRONTIER
     * (`solverBot` walkTo's `STANCE_REENTRY`). MEASURED on L40 from the south (survey step 93, `Totem Part 64,144`):
     * `wandlock@448,432` (group 2) is the frontier door nearest the aim; its opener `button@480,384` is INSIDE the
     * room it shuts. The hold stance (488,392) was derived reachable under the stance hypothesis THROUGH the south door
     * `wandlock@480,560` (group 3, its `buttonroom@880,768` latches), but the walk to it re-identified its own frontier
     * nearest-to-aim and named `wandlock@448,432` again: a refusal with the room's real door untried. ON: before the
     * refusal stands, the walk's frontier is walked on (the L12KEYLINE `nextPastSealedLock` shape) — an order whose
     * stance walk is already in flight, or whose stance IS this walk's aim, is passed over by name. OFF:
     * byte-identical. `SEEDLING_STANCE_REENTRY_NEXT_DOOR=0|1` for a node measurement.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, wave 29) turns it ON (CI A/B on main ae411caa60 + the slice).
     */
    stanceReentryNextDoor: true,
    /**
     * fidelity L40RES (wave 29) — A SPINNER SEES A RESPONDER'S TURN-OFF ONE TICK LATER (`levelRun.spinnerCtx`).
     * `Game.loadlevel` adds the lock family and `cover` (`Game.as:2355-2364`) before `spinner` (`:2416`), and
     * `World.addUpdate` prepends, so a Spinner moves BEFORE them each frame and sweeps a responder Solid on the frame it
     * turns off. The model stepped spinners against the state the previous tick's `stepActivators` left, one tick early.
     * MEASURED on the game (p4g, `l40res-368-s5290`): `spinner@192,160` reflects off `wandlock@208,160` at t1172 and
     * the model's passed it (18.4 px apart by t1196). ON: `activators.openActivatorIdsBeforeLatestStep` (no new run
     * state: a fade responder's `held` names its turn-off step). OFF: byte-identical.
     * `SEEDLING_SPINNER_LOCK_LAG=0|1` for a node measurement.
     * ⛓ planning-12's flip (⚖ user, 2026-10-24, wave 29) turns it ON (CI A/B on main ae411caa60 + the slice).
     */
    spinnerLockLag: true,
    /**
     * fidelity BEAMLANE (wave 29) — A CORRIDOR ALONG A BEAM TOWER'S BAND RIDES THE BAND-TO-BAND LANE AT THE TOWERS'
     * LIVE `y` (`solverBot.beamLaneSteer`, the dodge rung's PHASE arm). The bob `y += 0.3·sin(worldFrame(100, 2)…)`
     * reads `Game.time`, so the arrival clock fixes where the bands sit for the whole visit, and a corridor walked at
     * the tile centre is inside a band at most clocks (L107's rows 7-8, leg 785: 12/61 clocks solved, the rest refused
     * on `beamtower@208,120`'s beam after ten 89x8 stall grids). MEASURED on the game (js `seedling-js-l107-investigate`,
     * CI 40130832484): the lane walk reaches L102 at 61/61 clocks, streams = model. ON: before the stall grid, the arm
     * previews the corridor with its aim steered into the free band-to-band interval at each tick's live tower `y`
     * (`dangerMap.phaseBeamTowerAt`, the timeline `phaseHazardHit` prices), crossing a band only when it does not fire
     * for the crossing; the walk is certified by the same `probeSamples`, and an uncertified lane falls through to the
     * stall grid, its reason named. OFF: byte-identical. `SEEDLING_BEAM_LANE_WALK=0|1`.
     */
    beamLaneWalk: true,
    /**
     * fidelity TURRETCIRCLE D1 (wave 29) — AN ICE TURRET'S BLAST STOPS ON THE PLAYER'S SHIELD. `IceTurretBlast.hitables`
     * is `["Player", "Tree", "Solid", "Shield"]` (`IceTurretBlast.as:17`), and `Player.addShield` adds a `"Shield"`
     * entity whose box `render` places by the facing (`Player.as:1180-1256`; `bobBossFight.playerShieldRect`). A blast
     * that meets that box and not the player is removed with no freeze and no hit; one that meets both still hits.
     * The spit and the lava ball already asked it (`stepSpitsNow`, `stepLavaBallsNow`); `stepBlastsNow` did not, so a
     * shielded player was hit by blasts the game stops. ON: `stepBlastsNow` passes the shield box. OFF: byte-identical.
     * `SEEDLING_ICE_BLAST_SHIELD=0|1`.
     */
    iceBlastShield: true,
    /**
     * fidelity TURRETCIRCLE D2 (wave 29) — THE PLAIN SWORD KILLS AN ICE TURRET ON THE MOVE. ⚖ The user (2026-10-24):
     * *"The way to not get hit is to keep moving while attacking. Keep circling around the turret."* No standing Sword
     * kill is hitless (the third landing follows the turret's next shot; CORPSEBUMP), while a player circling the body
     * on the lanes beside it, swinging on the move, is never where a frozen aim points (game-measured,
     * `turretcircle-l40-sword-circle`, p4g, 0 px). ON: `killForCorpse` with the Sword alone kills by
     * `killIceTurretInPlace`'s `circle` option (`circleKillIceTurret`), tried on a fork per start delay, direction and
     * first corner; none hitless ⇒ refused by name. OFF: byte-identical (the Sword alone refuses as before).
     * `SEEDLING_TURRET_CIRCLE_KILL=0|1`.
     */
    turretCircleKill: true,
    /**
     * fidelity TURRETCIRCLE D3 (wave 29) — AN ICE TURRET'S DEATH STOPS ITS SHOT. `IceTurret.death()`'s first call does
     * `play("dead")` (`IceTurret.as:135-151`), which resets the Spritemap's clock onto a rate-0 animation, so a
     * `startshot` in progress never wraps and `endAnim` never spawns its volley; `death()` runs inside `e.update()`,
     * before that tick's `graphic.update()`. `iceTurret.interceptIceTurretDeath` set `dead` and left the shot's clock
     * running, so a corpse could fire (game-measured: `turretcircle-l40-t2-holder-sword` t70, no blast on the game, three
     * in the model). ON: the corpse's anim is "dead". OFF: byte-identical. `SEEDLING_ICE_TURRET_DEATH_ANIM=0|1`.
     */
    iceTurretDeathAnim: true,
    /**
     * fidelity SHAKEEXACT D1 (wave 31) — A SPLIT RUN'S CAMERA SHAKE IS EXACT. ⚖ The user (2026-10-25, "Exact for
     * split"): under `Rng.split` `view()` jiggles by `shake * Game.shakeJiggle(Game.time, axis) - shake/2` and takes no
     * draw (`Game.as:2004-2011`, AS3 3′c), so where the run knows `Game.time` the camera is a point on every shaking
     * frame. ON: `levelRun.stepCameraNow` (and the chaser / corridor forecasts' own cameras) step `camera.stepCameraSplit`
     * at the exact `Game.time` when the run's `rng.split` is true and its clock counts; the BAND STAYS for a split:false
     * tape (`Rng.cos()` is `Math.random()` there), a run whose clock is null (`gameTimeRefusal`), a camera already a band
     * (it never closes inside a visit), `shakeAcrossLoad`'s fade and the `rebootShake` settle (`levelRun`'s
     * `CAMERA_BAND_KEPT`). OFF: byte-identical. `SEEDLING_SHAKE_EXACT_SPLIT=0|1`.
     */
    shakeExactSplit: true,
    /**
     * fidelity L67BK4 D1 (wave 31) — A SPEAR BLOCK THAT IS THE ONLY HOLDER FOR AN ARMED LANE'S BUTTON IS PARKED ON THE
     * BUTTON, NOT SUNK (`solverBot.laneHolderRoute`, asked by `resolveSpearPushStrategy`).
     *
     *     ArrowTrap.as:31-41   fires while `activate XOR shootDefault`; `Button.update` re-collides
     *                          `["Player","Enemy","Solid"]` every tick and publishes its group (`Button.as:27-39`)
     *
     * L67 (`Dungeon6/8.oel`) is the room built for it: `arrowtrap@48,48 tset 0 shoot 1` stands over `bosskey4` at
     * (48,64), `button@96,112 tset 0` silences it while pressed, and `pushableblockspear@144,112` stands in the only
     * corridor west. OFF the clear-path search took its cheapest route — one thrust W into the pit at (8,7) — and the
     * key's corridor then climbed to an EXHAUSTED ladder on the armed lane (divergence leg `level_67__r3c2 <-
     * in_L59_0_128 ~> level_67__r6c11 -> location:Level 067 - Boss Key 4`, survey step 140). ON: a clear-path route that
     * DESTROYS the block yields to a route that parks it on a button of an armed lane's own group (L67: N W W S W, five
     * thrusts), which empties the same cell; the walk then meets a silent lane. OFF: byte-identical.
     * `SEEDLING_LANE_WEIGH=0|1`.
     */
    laneWeigh: true,
    /**
     * fidelity L67BK4 D2 (wave 31) — THE TOTEM IS FOUGHT, NOT ROUTED AROUND (`solverBot.execTotemBoss`,
     * `bossTotemPolicy.js`).
     *
     *     BossTotem.as:280-330  `type = "Solid"` until it wakes; once `fullyActivated` the player is assigned below it
     *     BossTotem.as:254      `onlyHitBy = "Wand"`, `hitsMax = 5`, `hitsTimerMax = 20`
     *
     * L43's arena (`Dungeon4/Boss.oel`) is one 80 px shaft and `bosstotem@152,168` spans it: the wall before the wake
     * and the clamp after, so the north half (the magical lock, the teleporter to L37) is reached only past the kill.
     * OFF the frontier read *"no strategy row exists for solid:bosstotem"* (13 divergence legs `level_43__r3c8 <-
     * … -> exit:out_teleporter_144_64`). ON: `solid:bosstotem` → `totem`, a verb that plays the R6 witness's cycle
     * (`r6-totem-kill`: a stance west of the laser's fixed band, the wand every 22 ticks, the descent tracked) against
     * the run's own stepped fight on forks, and plays the first variant that kills with no death (hitless first). OFF:
     * no row, byte-identical. `SEEDLING_TOTEM_BOSS_FIGHT=0|1`.
     */
    totemBossFight: true,
    /**
     * fidelity L39SHAFT (wave 31) — **L39's SHAFT, A LICENSED SPECIAL CASE** (⚖ user 2026-10-25: *"move the three blocks
     * into the three inner switches, then stand between them and use fire … For this one, we might need to give the
     * solver a special case, rather than trying to find a general rule"*). L39's three wandlocks (`wandlock@144,64/48/32`)
     * each answer to an outer button under a cover that only ANOTHER block's inner button opens, so the one-block weigh
     * parks one block and refuses three links deeper (*"no REACHABLE stance inside button@144,112"*). ON: a frontier
     * member of `solverBot.L39_SHAFT` (the locks, the covers, the six buttons) refines to `l39shaft`, whose executor
     * parks a fire block on each inner button in the table's order (each by the fire route search), walks to (9,9)
     * between them and fires once (`runFire`'s exact set: all three blocks onto the three outer buttons), then waits out
     * the locks' fade. The game witness: `fidelityL39Shaft.js`. OFF: byte-identical. `SEEDLING_L39_SHAFT_PRESS=0|1`.
     */
    l39ShaftPress: true,
    /**
     * fidelity L39SHAFT D2b (wave 31) — A COLLECT FROM A STANCE ALREADY IN THE PICKUP'S SPAN CLOSES ON ONE AXIS.
     * `runCollect` aims at the pickup's centre; `totempart@72,40` straddles x = 80 under its only free cell, and the line
     * from (88,24) drifts into the wall at (4,1) (`r5Shaft.TOTEM_PART_2.aim` declared it by hand). ON: the solver's
     * collect aims straight along the axis the box does not yet overlap (`solverBot.collectSpanAim`). OFF:
     * byte-identical. `SEEDLING_COLLECT_SPAN_AIM=0|1`.
     */
    collectSpanAim: true,
    /**
     * fidelity L39SHAFT D2c (wave 31) — `Spinner.friction()`'s `Point` arithmetic as the runtime spells it:
     * `v.normalize(Math.max(v.length - f, moveSpeed))` is `sqrt(x*x + y*y)` and a multiply by `t / length`
     * (`playerPhysicsV1.pointNormalize`); `spinner.spinnerFriction` spelled it `Math.hypot` and `(v / len) * t`, which
     * drifts one ulp on a decaying knockback (game-measured: D2's step-66 witness, t637). ON: `spinnerPoint.js`. OFF:
     * byte-identical. `SEEDLING_SPINNER_POINT_EXACT=0|1`.
     */
    spinnerPointExact: true,
    /**
     * fidelity L40BK2 D1 (wave 31) — A WEIGH'S HOLDER IS DERIVED UNDER THE REST OF THE HYPOTHESIS. Guard (iii)
     * (`stanceHypothesis`) asked each `weigh` activator's holder of the world AS IT IS, so a holder that is reachable
     * only once another hypothesised obstacle is discharged was a WALL. L40's Boss Key 2 chain is the measured case
     * (legs 869/870, survey step 67): `wandlock@512,480`/`@448,432` {t 2}'s holder is `iceturret@472,400`'s corpse,
     * whose stance is behind the latched south door `wandlock@480,560`; and `wandlock@800,400` {t 5}'s holder is
     * `pushableblockfire@480,480`, whose Fire route crosses `wandlock@512,480`. ON: the holders a live derivation
     * refuses are asked again under the bag with the hypothesis discharged, to a fixed point, and a hold stance that
     * no candidate reaches otherwise is asked under those admissions; a frontier order that cannot bind yet passes the
     * round to the next door; a refusal carries its `equips`. OFF: byte-identical. `SEEDLING_WEIGH_HYPOTHESIS_CHAIN=0|1`.
     */
    weighHypothesisChain: true,
    /**
     * fidelity L40BK2 D2 (wave 31) ⛓ hammer hand-over 368 — A STRUCK SPINNER IS PRICED WHERE THE STRIKE LEFT IT. The
     * transit probe (`probeSamples` → `dangerDuringTransit` → `spinnerDanger`) read the run's press-blind
     * `spinnerForecast`, so a walk whose own dash struck a spinner was certified against a body the strike had moved
     * (leg 368, seam 5290: 28.31 px at t1222; the game and the model both hit, L40RES). ON: `previewWalk` advances the
     * hammer arc's `spinnerFightForecast` cursor with the walk's presses and each sample's spinners are priced from its
     * row. OFF: byte-identical. `SEEDLING_DASH_SPINNER_FORECAST=0|1`.
     */
    dashSpinnerForecast: true,
    /**
     * fidelity CHESTSEAL (wave 32) — A CHEST `checkBySeal()` REMOVED IS NOT A WALL, AND ITS FLAG IS CLEARED. With all
     * sixteen seal parts held (`SealController.hasAllSealParts()`), `Chest`'s CONSTRUCTOR runs `checkBySeal()`
     * (`Chest.as:35`, `:47-57`): `Game.setPersistence(tag, false)` — the AP check report — and a `remove` that is a
     * no-op before the add; `Chest.check()` then removes the tagged chest on the first `Game.update` (`Game.as:870-877`,
     * which runs under the `blackCover`), and `update`'s own `checkBySeal()` an untagged one. So no player-controlled
     * frame sees it. OFF the model marked it `gone` and left it SOLID (`openChestIdsNow` reads `solid`), the solver bound
     * the chest verb and refused *"NEVER OPENED"*. ON: such a chest is open in `openChests` from the build, its flag is
     * banked like `open()`'s, and a `collect-placement` at it is satisfied (`arm: 'seal-removed'`). OFF:
     * byte-identical. `SEEDLING_CHEST_SEAL_REMOVAL=0|1`.
     */
    chestSealRemoval: true,
    /**
     * fidelity L40LATCH D1 (wave 32) — A HOLD'S STILL WAIT IS PRICED AS ITS STANCE WALK'S TAIL. `runHold` stands the
     * player on the presser for the hold's whole bound (a latched `room = -1` ButtonRoom included: the hold waits for
     * the lock's 101-tick fade), but the walk to the hold stance was probed in TRANSIT only. MEASURED on L40's S-door
     * latch (`buttonroom@880,768`, the chest and the tree banked, legs 859/860's chain): `bobsoldier@880,832` walks up
     * the pocket and its sword lands on the still holder (game and model agree, `l40latch-stand`), and the executor
     * refused *"hold tick 93 of 131 MOVED"*. ON: the hold stance walk carries the hold as its tail (L30KEYLOCK's
     * `stand` instrument, `holdStandWalk`), so a body that reaches the holder is a hit on that corridor and the combat
     * ladder climbs (the kill rung's chaser arm: kill first, then hold). OFF: byte-identical. `SEEDLING_HOLD_WAIT_PRICED=0|1`.
     */
    holdWaitPriced: true,
    /**
     * fidelity L40LATCH D1b (wave 32) — A BOBSOLDIER IS KILLED ON THE MOVE, BEHIND ITS BLADE. The kill rung's chaser arm
     * (`deriveKillByChaser`) scans STILL stances (stand and strike), and no stance kills `bobsoldier@880,832` hitless:
     * `BobSoldier.swordHitting` tests its blade (8–16 px off the body) EVERY frame, spinning or resting, and the rest
     * angle is the player's at the spin's end (`swordSpinningStop(ang)`), so a body walking at a still player always
     * meets it blade first. ON: where the scan finds none, the arm plays `orbitKillPolicy` on FORKS — circle the body
     * outside the blade, close in from behind the resting blade, strike, back off — over `ORBIT_KILL.candidates`, and the
     * first hitless kill (the body removed, no hit, no crossing) is played on the live run key for key (TURRETCIRCLE's
     * shape). OFF: byte-identical. `SEEDLING_CHASER_ORBIT_KILL=0|1`.
     */
    chaserOrbitKill: true,
    /**
     * fidelity L32BOB D1 (wave 32) — THE BOB BOSS FORECAST CARRIES THE SWING ALREADY IN FLIGHT. `bobBossForecast` handed
     * the encounter's strike search the boss and the slash STATE but not the run's `swordWindow`, so a solve that starts
     * inside a swing (a continuation whose prefix ends on a press: `Player.slash()` tests on every tick `slashing` is
     * up, five for a swing) forecast none of that swing's remaining tests, and the run landed one the forecast never
     * saw. Measured: `apb-l32-fresh-no-fire`'s staging solved from its own plan's tick 380 (press 376 in flight) — the
     * run lands the 376 swing's T+5 test at t381 (form 1: 1 → 2 hits), the forecast keeps form 1 at 1 and lands its own
     * press at +58; the executor counts 2 landings and declines ("the forecast and the run disagree"). The game agrees
     * with the run (p4g, the tape t370–560 at 0 px: form 1's death flight starts at t426, after the THIRD landing,
     * which needs t381's). ON: the forecast steps the live window with `advance`'s own `swordWindowStep` /
     * `swordWindowReplace` / `swordWindowSchedule` (each thrust at its own scale), and the executor checks the run's
     * landings against every landing the forecast made through its own press's. OFF: byte-identical.
     * `SEEDLING_ENCOUNTER_SWING_IN_FLIGHT=0|1`.
     */
    encounterSwingInFlight: true,
    /**
     * fidelity RULESREF D2 (wave 32) — A CLOSED SPEAR BRIDGE ON THE FRONTIER IS OPENED BY A THRUST
     * (`solverBot.resolveBridgeStrategy` / `execBridge`, through `botDriverV2.runSpear`'s `bridge` arm).
     *
     *     Player.as:1116-1119   genericHit's `e is Tile` arm: `bridgeOpeningTimer--` only under `t == "Spear"`
     *     Tile.as:343-365       a Bridge (`t = 29`) is Solid until its timer has rendered down to 0
     *
     * The model has stepped the bridge since R4 (`bridges.js`); the solver's frontier dropped every `tile:*` blocker
     * as a wall, so L63's `(2,9)` (survey step 161, the corridor to `teleporter@32,304`) and L66's `(7,9)` (step 163,
     * between the L65 arrival and the doorway) had no verb. ON: the frontier names a closed bridge `solid:bridge`, the
     * verb thrusts from a stance one or two tiles behind it, and the block-route search's relaxed proof and goal test
     * count a bridge the run can open as open (`deriveBlockRoute`). OFF: byte-identical. `SEEDLING_SPEAR_BRIDGE_VERB=0|1`.
     */
    spearBridgeVerb: true,
    /**
     * fidelity RULESREF D3 (wave 32) — A DOOR HALF A TILE OFF THE GRID IS NAMED ON THE 8 px LATTICE
     * (`solverBot.identifyAndSelect`'s frontier flood).
     *
     * L66's `teleporter@72,64` is in `building8`'s doorway — the pixel mask's notch is x 72-87, half a tile off the
     * 16 px grid — behind `bosslock@72,64`. Every 16 px node centre beside the walk's component hits the MASK first,
     * so the frontier held only scenery (*"No strategy row exists"*, survey step 163, divergence leg 579 on both arms).
     * ON: a frontier with no actionable entry is flooded again at `FINE_LATTICE` (8 px; nodes at x 76, 84 fit the
     * notch), which names the lock (`keylock`). OFF: byte-identical. `SEEDLING_FINE_FRONTIER_FLOOD=0|1`.
     */
    fineFrontierFlood: true,
    /**
     * fidelity RULESREF D1 (wave 32) — THE WALK'S DECISION GATE TIMES A PUNCHER'S PUNCH (`solverBot.punchTickAt`,
     * `dangerMap.chaserDanger`), as `SWORD_GATE_TIMED` times a BobSoldier's blade.
     *
     *     Puncher.as:111-117, 172-218   the wind-up (`attack` anim) and `attackPlayer`'s box off the body's edge
     *
     * The gate a walk opens with priced a live puncher by `threatPad` 8 while the transit probe that follows prices it
     * by the forecast's punch (U10 D2). L53 (survey step 79): the walk to the rock's stance arrives with
     * `puncher@136,96` 11 px off, and the next gate refused before any corridor was probed, so the ladder's chaser kill
     * rung never ran. ON: that gate prices a body whose one-tick forecast row carries `punch` by the punch and its bare
     * body. OFF: byte-identical. `SEEDLING_PUNCH_GATE_TIMED=0|1`.
     */
    punchGateTimed: true,
    /**
     * fidelity DETERM (c) F1 (wave 33) — A RELEASED `Cover` UNDER A HITABLE KEEPS ITS FADED ALPHA (`activators.js`'
     * inactive arm).
     *
     *     Cover.as:49-67   not `activate`: `collideTypesInto(["Solid","Player"])`; a hit that is not a `Chest` → no
     *                      `reset()` (type AND alpha kept); no hit (or a Chest) → `reset()` (Solid, alpha 1)
     *
     * The model snapped a closed cover's alpha to 1 on every inactive step (`if (!s.open) s.alpha = 1`, the Lock's
     * line), so a cover released mid-fade with an occupant in its cell and pressed again re-faded from 1 (10 steps) where
     * the game resumes from the kept alpha (≈5–6). ON: a cover's inactive step resets only when nothing occupies its
     * cell. The Chest arm is not carried: the one chest under a cover (L38) fills the cell, so nothing else can overlap
     * it while it is closed, and an opened chest is `type = ""` (`Chest.as:77`), no hitable. OFF: byte-identical.
     * `SEEDLING_COVER_HELD_FADE=0|1`.
     */
    coverHeldFade: true,
    /**
     * fidelity DETERM (c) F2 (wave 33) — A `Lock` RE-CLOSES WITH ITS ALPHA AT 0, RESTORED ONE STEP LATER
     * (`activators.js`' inactive arm).
     *
     *     Lock.as:64-97   not `activate`: `if (type == normType) alpha = 1` runs BEFORE `returnToNormal()`, so on the
     *                     re-close step type is still "" and the alpha stays 0; the next step restores it — and if the
     *                     group is active again on that step, `alpha > 0` is false and `turnOff()` re-opens at once
     *
     * The model set alpha 1 on the re-close step, so a lock re-pressed on the very next step took 101 steps to open
     * again, and the drawn alpha was 1 a step early. ON: the re-close keeps the alpha at 0 (a lag re-open is a
     * `turnOff`, and `openActivatorIdsBeforeLatestStep` counts it as the latest step's). Plain fade locks only (a touch
     * responder latches, a BossLock never re-closes). OFF: byte-identical. `SEEDLING_LOCK_RECLOSE_LAG=0|1`.
     */
    lockRecloseLag: true,
    /**
     * fidelity L41TOTEM D1 (wave 33) — THE BAIT SEARCH FLOODS EACH COMPONENT ONCE (`crusherBait.searchBaitOrdering`).
     * A COST key: no model term moves. Each escape of each stance flooded its own safe component under the next
     * configuration, and every non-empty component the search floods ends with its key in `seenStates` (or skipped by
     * `seenRegions`, whose key is already there). So a flood seeded INSIDE a component this search already flooded for
     * that configuration always ends at `continue`. Measured at sweep leg 855 (L41 Totem Part 240,144, request at seam
     * 5280): 68,406 of 68,418 floods were that duplicate, 6.96 s of the search's 9.5 s (node, both passes). ON: such a
     * seed is skipped before its flood, with the same answer, stats and order. OFF: byte-identical.
     * `SEEDLING_BAIT_COMPONENT_MEMO=0|1`.
     */
    baitComponentMemo: true,
    /**
     * fidelity L41TOTEM D1b (wave 33) — THE BAIT ALIGNMENT ASKS EACH POSITION ONCE (`crusherBait.alignmentCandidates`).
     * A COST key: no model term moves. The alignment previews from the chain's stance and never advances the run, so the
     * caller's `safeAt(p)` (`solverBot.execBait`: every live crusher's sight at p) reads only (p.x, p.y). Measured at sweep
     * leg 855: 57,874 of 96,384 asks over L41's six alignments repeated a position already asked in the same call. ON:
     * each answer is kept for the call, keyed on (p.x, p.y). OFF: byte-identical. `SEEDLING_BAIT_ALIGN_SAFE_MEMO=0|1`.
     */
    baitAlignSafeMemo: true,
    /**
     * fidelity L41TOTEM D3 (wave 33) — A BAIT'S IDLE ENDS WHEN THE CRUSHER HAS PARKED (`solverBot.execBait`,
     * `crusherBait.trimParkedTail`). The chain's escape ends in R5's fixed idle span (L41: 160 / 220 / 260 ticks), which
     * outlasts the charge: at sweep leg 855 the player stood still 28, 123 and 85 ticks with the crusher already parked
     * (236 of the plan's 2,505 ticks, ~8 s of the leg's game-paced play). ON: the fork that certifies the chain also
     * records where the trailing streak begins in which every crusher is parked and the player is at rest, and the live
     * chain's last idle span is cut to end there; `runBait` re-checks the cut chain (no contact, parked, at its park).
     * The PLAN moves (shorter); no model term moves. OFF: byte-identical. `SEEDLING_BAIT_PARKED_TAIL=0|1`.
     */
    baitParkedTail: true,
    /**
     * fidelity L100 (wave 33) — A SWING STANCE HALF A TILE OFF THE GRID IS ASKED ON THE 8 px LATTICE
     * (`solverBot.deriveSwingStance`, the `break` and `pull` verbs' stance).
     *
     * L100's `breakablerock@128,144` is the door through the wall column x 128-143, and its near side is an 8 px sliver
     * (x 120-127) between the `cliffside` masks at x 112 and the rock. Every 16 px ring cell on that side is a
     * cell centre x 120 whose 4x5 box meets the mask, so the only cells that put the slash rect on the rock were the
     * far side's (survey step 219, divergence leg 907: *"no REACHABLE stance for a swing at breakablerock@128,144"*).
     * ON: once every 16 px cell has failed, the same pixel window is asked on `FINE_LATTICE` (8 px; nodes at x 124),
     * planned in the world as it is on the 8 px lattice, as `deriveKeylockStance`'s RULESREF arm does. OFF:
     * byte-identical. `SEEDLING_FINE_SWING_STANCE=0|1`.
     */
    fineSwingStance: true,
    /**
     * fidelity L40BK2B D1 (wave 33) — THE ORBIT KILL STEERS TO A POINT THE PLAYER CAN STAND ON. `orbitKillPolicy`
     * aims at a point on a circle round the body and steers straight at it (`chooseHeld`), which is right in an open
     * room (L40's latch pocket) and wrong where the body stands in a notch above a one-tile corridor: MEASURED on L40
     * leg 853 (`<- in_L39_144_0`, OPP ON, seam 5152), `bobsoldier@880,832` is met from the burn stance's walk with
     * the player 144 px off in the x 736 shaft; the ccw candidates pin the player against the shaft wall for the
     * whole 420-tick bound, and the cw ones land one hit, then back off INTO the corridor's floor and stand inside the
     * blade when the spin stops on them (hit at orbit tick 180). ON: each aim is the free point (the player box at it
     * and the straight sweep from the player both clear of Solids, `orbitFreeAim`) nearest the policy's own angle,
     * searched in `ORBIT_FREE_AIM` steps; where none is in sight the policy follows the planner's walk toward the body.
     * The rest of the policy (spin, blade, i-frames, the one strike policy) is unchanged. OFF: byte-identical.
     * `SEEDLING_ORBIT_FREE_AIM=0|1`.
     */
    orbitFreeAim: false,
    /**
     * fidelity L40BK2B D2 (wave 33) — THE STRATEGY BOUND COUNTS DISTINCT APPLICATIONS. `MAX_STRATEGIES_PER_GOAL` (4)
     * is documented as the number of DISTINCT obstacles one goal may clear, and the check counted every application.
     * MEASURED on L40 leg 853 (OPP ON, `orbitFreeAim` ON, seam 5152): Boss Key 2's goal applies shove
     * (`pushableblockfire@576,576`), hold (`wandlock@448,432`), burn (`burnabletree@872,784`) and the same hold again
     * from the far side of the tree, then needs the latch's hold (`wandlock@480,560`) — its fourth distinct obstacle
     * — and was refused as a fifth application. ON: the bound counts distinct `strategy(obstacle)` applications, with
     * `STRATEGY_BOUND_TOTAL` (8) applications in all as the loop's backstop. OFF: byte-identical.
     * `SEEDLING_STRATEGY_BOUND_DISTINCT=0|1`.
     */
    strategyBoundDistinct: false,
    /**
     * seedling-js-inventory-menu (C4 of fidelity-15's W0 ACK) — A C PRESS IS `useItem(Main.secondary)`.
     *
     *     Player.as:1561-1568   input(): `Input.pressed(keys[4])` → useItem(Main.primary);
     *                                    `Input.pressed(keys[5])` → useItem(Main.secondary)
     *
     * The model reads only the X press, so a C press on a live tick was a silent nothing where the game swings the
     * secondary slot (`Main.secondary`, 0 = the first slot, by default the sword). ON: a C press is routed through the
     * X press's own `useItem` arms against `secondary`'s slot, and in the same frame an X press goes first. OFF:
     * byte-identical (no committed tape presses C). `SEEDLING_SECONDARY_USE=0|1`.
     */
    secondaryUse: false,
    /**
     * fidelity LIGHTPOLE D2 (wave 34) — AN IN-ROOM POLE IS LIT BY A SPEAR THRUST FROM ITS OWN ROOM.
     *
     *     Player.as:1083-1088   genericHit: `if (t == "Spear") (e as LightPole).hit()`
     *     LightPole.as:77-84    hit(): `activate = !activate` behind a 25-tick `hitsTimer`
     *     LightPole.as:94-97    set activate → `Game.setPersistence(tag, !activate)`: the flag is written AT the hit
     *
     * The rules place an in-room pole's light as a `clear-tag` event on the pole itself, with no presser
     * (`seedlingObstacleEvents.IN_ROOM_POLE_GATE_KIND`), and the solver had no row: *"no strategy row exists for
     * solid:lightpole"*. ON: `solid:lightpole` → `pole` (`resolvePoleThrustStrategy` / `execPoleThrust`): a stance whose
     * thrust rect (`spearHitRect`) lies on the pole's bob-invariant core in one of the four facings — through a wall
     * where the rect reaches across one — walked to, ONE thrust (a second would toggle the light out), finished on the
     * run's own pole write (`earnedClears`). OFF: no row, byte-identical. `SEEDLING_IN_ROOM_POLE_THRUST=0|1`.
     */
    inRoomPoleThrust: true,
    /**
     * fidelity L12DOORS D1 (wave 34) — A WAND SHOT STOPS ON A LIVE CHASER, AND A ROOM WITH ONE MAY FIRE.
     *
     *     WandShot.as:69     solids.push("Enemy")       the shot's own list (`Mobile.as:17` + "Enemy")
     *     WandShot.as        checkEntity: `_e is Enemy` → hit(…, "Wand")   (a puncher / bob is `type = "Enemy"`)
     *
     * `levelRun.assertWandShotSolidsBound` refused EVERY shot in a room whose press census holds an Enemy-typed body
     * outside the totem / ice-turret / spinner rosters — L12's `puncher@416,256`, ~650 px from the stacked doors at
     * `@32,864` (survey steps 172/203, the solver under the locks: *"cannot place: puncher@416,256"*). The run DOES hold
     * a live box for a bridged chaser while it steps them (`chaserStateFor`, behind `stepChasersNow`'s own
     * `noclip || noDamage` gate). ON: such a chaser counts as placed, and its live box joins the shot's "Enemy" arm
     * (`wandShotBlockerAt`), so a shot that MEETS it stops there and `applyWandShotToBoss` refuses by name, as before.
     * Under `noclip`/`noDamage` (no chaser position) the room still refuses. OFF: byte-identical.
     * `SEEDLING_WAND_SHOT_CHASER_BODIES=0|1`.
     */
    wandShotChaserBodies: true,
    /**
     * fidelity L12DOORS D2 (wave 34) — A DOOR THE 16 px FRONTIER CANNOT SEE, NEARER THE AIM, IS ASKED ON THE 8 px
     * LATTICE (`solverBot.identifyAndSelect`'s frontier flood).
     *
     * `fineFrontierFlood` re-floods at 8 px only when the 16 px frontier has NO actionable entry. L12's stacked doors
     * at `@32,864` (the goal `teleporter@32,848`, survey steps 172/203) are reached through a 13 px cliffside gap no
     * 16 px node fits, and the 16 px frontier always holds some other door (a shield lock, a tree, three bosslocks), so
     * the fine flood never ran and the sealed `bosslock@112,192` refused. ON: when the 8 px flood holds an actionable
     * door the 16 px one lacks, nearer the aim than every 16 px actionable door, the 8 px frontier is asked. OFF:
     * byte-identical. `SEEDLING_FINE_FRONTIER_HIDDEN_DOOR=0|1`.
     */
    fineFrontierHiddenDoor: true,
    /**
     * fidelity L12DOORS D3 (wave 34) — A WAND STANCE THE 8 px LATTICE REACHES (`solverBot.resolveWandStrategy`).
     *
     * The strip under L12's stacked doors (`@32,864`) is reached through a 13 px cliffside gap: `stanceReaches` plans
     * at the run's 16 px lattice and found no corridor to any wand stance under `magicallock@32,864`. ON: a candidate
     * it refuses is asked once more on `FINE_LATTICE` in the world as it is. OFF: byte-identical.
     * `SEEDLING_FINE_WAND_STANCE=0|1`.
     */
    fineWandStance: true,
    /**
     * fidelity TURRETSNAP D1 (wave 35) — A LIVE ICE TURRET PRICED WHERE ITS CONTACT IS TESTED (`dangerMap`).
     *
     * `staticEnemyDanger` and `dangerVolumes` priced a live `IceTurret` at its census box (`contactRect`, the ctor
     * point). The game never tests that box: `input()` snaps a stationary axis 8 px onto `floor(v/16)*16 + 8` in the
     * same update, BEFORE `hitPlayer`, and off screen the update (contact included) does not run at all. L40's
     * `iceturret@472,400` stands at y 416 and is touched at 424 / 423.5 (hammer ICEST measured both halves of the
     * error: a stance inside the snapped body, and a stance walk refused by the unsnapped one). ON: a live turret the
     * run steps is priced at the hull of its rest two-cycle (`iceTurret.iceTurretLiveContactCycle`), and its run
     * position is unchanged. The pole thrust's crowd test (`solverBot.resolvePoleThrustStrategy`, `deriveLightPole`)
     * reads the same box. OFF: byte-identical. `SEEDLING_TURRET_SNAP_PRICING=0|1`.
     */
    turretSnapPricing: false,
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
// ⛓ fidelity IGNEOUS D2: `SEEDLING_IGNEOUS_LAVA=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_IGNEOUS_LAVA === '1') CONTACT_FIDELITY.igneousLava = true;
if (globalThis.process?.env?.SEEDLING_IGNEOUS_LAVA === '0') CONTACT_FIDELITY.igneousLava = false;
// ⛓ fidelity LIGHTS: `SEEDLING_LIGHTS_BOSS_FIGHT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_LIGHTS_BOSS_FIGHT === '1') CONTACT_FIDELITY.lightsBossFight = true;
if (globalThis.process?.env?.SEEDLING_LIGHTS_BOSS_FIGHT === '0') CONTACT_FIDELITY.lightsBossFight = false;
// ⛓ seedling-fidelity-bosskills — the two boss fights, for a node measurement (both ship OFF).
if (globalThis.process?.env?.SEEDLING_KING_OF_FIRE_FIGHT === '1') CONTACT_FIDELITY.kingOfFireFight = true;
if (globalThis.process?.env?.SEEDLING_TENTACLE_BEAST_FIGHT === '1') CONTACT_FIDELITY.tentacleBeastFight = true;
// ⛓ fidelity ROPE: `SEEDLING_ROPE_CUT_VERB=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_ROPE_CUT_VERB === '1') CONTACT_FIDELITY.ropeCutVerb = true;
if (globalThis.process?.env?.SEEDLING_ROPE_CUT_VERB === '0') CONTACT_FIDELITY.ropeCutVerb = false;
// ⛓ fidelity L1516 D2: `SEEDLING_CHEST_PROBE_LINE_END=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_CHEST_PROBE_LINE_END === '1') CONTACT_FIDELITY.chestProbeLineEnd = true;
if (globalThis.process?.env?.SEEDLING_CHEST_PROBE_LINE_END === '0') CONTACT_FIDELITY.chestProbeLineEnd = false;
// ⛓ fidelity L1516 D3: `SEEDLING_ENCLOSED_PIT_CORNER=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_ENCLOSED_PIT_CORNER === '1') CONTACT_FIDELITY.enclosedPitCorner = true;
if (globalThis.process?.env?.SEEDLING_ENCLOSED_PIT_CORNER === '0') CONTACT_FIDELITY.enclosedPitCorner = false;
// ⛓ fidelity IGFADE: `SEEDLING_IGNEOUS_DEAD_FRAMES=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_IGNEOUS_DEAD_FRAMES === '1') CONTACT_FIDELITY.igneousDeadFrames = true;
if (globalThis.process?.env?.SEEDLING_IGNEOUS_DEAD_FRAMES === '0') CONTACT_FIDELITY.igneousDeadFrames = false;
// ⛓ fidelity ROPESTANCE: `SEEDLING_ROPE_CUT_ANY_WEAPON=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_ROPE_CUT_ANY_WEAPON === '1') CONTACT_FIDELITY.ropeCutAnyWeapon = true;
if (globalThis.process?.env?.SEEDLING_ROPE_CUT_ANY_WEAPON === '0') CONTACT_FIDELITY.ropeCutAnyWeapon = false;
// ⛓ fidelity RULESREF D2: `SEEDLING_SPEAR_BRIDGE_VERB=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_SPEAR_BRIDGE_VERB === '1') CONTACT_FIDELITY.spearBridgeVerb = true;
if (globalThis.process?.env?.SEEDLING_SPEAR_BRIDGE_VERB === '0') CONTACT_FIDELITY.spearBridgeVerb = false;
// ⛓ fidelity RULESREF D3: `SEEDLING_FINE_FRONTIER_FLOOD=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_FINE_FRONTIER_FLOOD === '1') CONTACT_FIDELITY.fineFrontierFlood = true;
if (globalThis.process?.env?.SEEDLING_FINE_FRONTIER_FLOOD === '0') CONTACT_FIDELITY.fineFrontierFlood = false;
// ⛓ fidelity RULESREF D1: `SEEDLING_PUNCH_GATE_TIMED=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_PUNCH_GATE_TIMED === '1') CONTACT_FIDELITY.punchGateTimed = true;
if (globalThis.process?.env?.SEEDLING_PUNCH_GATE_TIMED === '0') CONTACT_FIDELITY.punchGateTimed = false;
// ⛓ fidelity L41TOTEM D1: `SEEDLING_BAIT_COMPONENT_MEMO=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BAIT_COMPONENT_MEMO === '1') CONTACT_FIDELITY.baitComponentMemo = true;
if (globalThis.process?.env?.SEEDLING_BAIT_COMPONENT_MEMO === '0') CONTACT_FIDELITY.baitComponentMemo = false;
// ⛓ fidelity L41TOTEM D1b: `SEEDLING_BAIT_ALIGN_SAFE_MEMO=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BAIT_ALIGN_SAFE_MEMO === '1') CONTACT_FIDELITY.baitAlignSafeMemo = true;
if (globalThis.process?.env?.SEEDLING_BAIT_ALIGN_SAFE_MEMO === '0') CONTACT_FIDELITY.baitAlignSafeMemo = false;
// ⛓ fidelity L41TOTEM D3: `SEEDLING_BAIT_PARKED_TAIL=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BAIT_PARKED_TAIL === '1') CONTACT_FIDELITY.baitParkedTail = true;
if (globalThis.process?.env?.SEEDLING_BAIT_PARKED_TAIL === '0') CONTACT_FIDELITY.baitParkedTail = false;
// ⛓ fidelity L100: `SEEDLING_FINE_SWING_STANCE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_FINE_SWING_STANCE === '1') CONTACT_FIDELITY.fineSwingStance = true;
if (globalThis.process?.env?.SEEDLING_FINE_SWING_STANCE === '0') CONTACT_FIDELITY.fineSwingStance = false;
// ⛓ seedling-js-inventory-menu C4: `SEEDLING_SECONDARY_USE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_SECONDARY_USE === '1') CONTACT_FIDELITY.secondaryUse = true;
if (globalThis.process?.env?.SEEDLING_SECONDARY_USE === '0') CONTACT_FIDELITY.secondaryUse = false;
// ⛓ fidelity LIGHTPOLE D2: `SEEDLING_IN_ROOM_POLE_THRUST=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_IN_ROOM_POLE_THRUST === '1') CONTACT_FIDELITY.inRoomPoleThrust = true;
if (globalThis.process?.env?.SEEDLING_IN_ROOM_POLE_THRUST === '0') CONTACT_FIDELITY.inRoomPoleThrust = false;
// ⛓ fidelity DRILL: `SEEDLING_DRILL_MIXED_ROOMS=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_DRILL_MIXED_ROOMS === '1') CONTACT_FIDELITY.drillMixedRooms = true;
if (globalThis.process?.env?.SEEDLING_DRILL_MIXED_ROOMS === '0') CONTACT_FIDELITY.drillMixedRooms = false;
// ⛓ fidelity YETI: `SEEDLING_YETI_TALK=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_YETI_TALK === '1') CONTACT_FIDELITY.yetiTalk = true;
if (globalThis.process?.env?.SEEDLING_YETI_TALK === '0') CONTACT_FIDELITY.yetiTalk = false;
// ⛓ fidelity MASKS: `SEEDLING_PIXEL_MASK_SIGHT_LINES=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_PIXEL_MASK_SIGHT_LINES === '1') CONTACT_FIDELITY.pixelMaskSightLines = true;
if (globalThis.process?.env?.SEEDLING_PIXEL_MASK_SIGHT_LINES === '0') CONTACT_FIDELITY.pixelMaskSightLines = false;
// ⛓ fidelity SPEARRECT: `SEEDLING_SPEAR_GAME_TEST=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_SPEAR_GAME_TEST === '1') CONTACT_FIDELITY.spearGameTest = true;
if (globalThis.process?.env?.SEEDLING_SPEAR_GAME_TEST === '0') CONTACT_FIDELITY.spearGameTest = false;
// ⛓ fidelity DRILLKILL: `SEEDLING_DRILL_KILL_FIRST=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_DRILL_KILL_FIRST === '1') CONTACT_FIDELITY.drillKillFirst = true;
if (globalThis.process?.env?.SEEDLING_DRILL_KILL_FIRST === '0') CONTACT_FIDELITY.drillKillFirst = false;
// ⛓ fidelity REMBODY: `SEEDLING_REMOVED_BODY_BLOCKS=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_REMOVED_BODY_BLOCKS === '1') CONTACT_FIDELITY.removedBodyBlocks = true;
if (globalThis.process?.env?.SEEDLING_REMOVED_BODY_BLOCKS === '0') CONTACT_FIDELITY.removedBodyBlocks = false;
// ⛓ seedling-fidelity-slowfix D-A: `SEEDLING_LIGHTS_SORTIE_PORTFOLIO=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_LIGHTS_SORTIE_PORTFOLIO === '1') CONTACT_FIDELITY.lightsSortiePortfolio = true;
if (globalThis.process?.env?.SEEDLING_LIGHTS_SORTIE_PORTFOLIO === '0') CONTACT_FIDELITY.lightsSortiePortfolio = false;
// ⛓ fidelity HITLESS: `SEEDLING_TENTACLE_HITLESS_FIRST=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_TENTACLE_HITLESS_FIRST === '1') CONTACT_FIDELITY.tentacleHitlessFirst = true;
if (globalThis.process?.env?.SEEDLING_TENTACLE_HITLESS_FIRST === '0') CONTACT_FIDELITY.tentacleHitlessFirst = false;
// ⛓ fidelity TIMEDPASS: `SEEDLING_DRILL_TIMED_PASS=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_DRILL_TIMED_PASS === '1') CONTACT_FIDELITY.drillTimedPass = true;
if (globalThis.process?.env?.SEEDLING_DRILL_TIMED_PASS === '0') CONTACT_FIDELITY.drillTimedPass = false;
// ⛓ fidelity PITPORT: `SEEDLING_PIT_TELEPORTER_CROSSING=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_PIT_TELEPORTER_CROSSING === '1') CONTACT_FIDELITY.pitTeleporterCrossing = true;
if (globalThis.process?.env?.SEEDLING_PIT_TELEPORTER_CROSSING === '0') CONTACT_FIDELITY.pitTeleporterCrossing = false;
// ⛓ fidelity WANDHOLD: `SEEDLING_COVER_WEIGH_REFINE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_COVER_WEIGH_REFINE === '1') CONTACT_FIDELITY.coverWeighRefine = true;
if (globalThis.process?.env?.SEEDLING_COVER_WEIGH_REFINE === '0') CONTACT_FIDELITY.coverWeighRefine = false;
// ⛓ fidelity SEARCHGAPS: `SEEDLING_CRUSHER_BAIT_PRESS_GOAL=0|1` and `SEEDLING_FORCED_HIT_WITNESS_FIRST=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_CRUSHER_BAIT_PRESS_GOAL === '1') CONTACT_FIDELITY.crusherBaitPressGoal = true;
if (globalThis.process?.env?.SEEDLING_CRUSHER_BAIT_PRESS_GOAL === '0') CONTACT_FIDELITY.crusherBaitPressGoal = false;
if (globalThis.process?.env?.SEEDLING_FORCED_HIT_WITNESS_FIRST === '1') CONTACT_FIDELITY.forcedHitWitnessFirst = true;
if (globalThis.process?.env?.SEEDLING_FORCED_HIT_WITNESS_FIRST === '0') CONTACT_FIDELITY.forcedHitWitnessFirst = false;
// ⛓ seedling-fidelity-residue D-A: `SEEDLING_DRILL_TIMED_PASS_EXIT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_DRILL_TIMED_PASS_EXIT === '1') CONTACT_FIDELITY.drillTimedPassExit = true;
if (globalThis.process?.env?.SEEDLING_DRILL_TIMED_PASS_EXIT === '0') CONTACT_FIDELITY.drillTimedPassExit = false;
// ⛓ seedling-fidelity-residue D-B: `SEEDLING_WHIRLPOOL_DROWN=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_WHIRLPOOL_DROWN === '1') CONTACT_FIDELITY.whirlpoolDrown = true;
if (globalThis.process?.env?.SEEDLING_WHIRLPOOL_DROWN === '0') CONTACT_FIDELITY.whirlpoolDrown = false;
// ⛓ fidelity FIREPUSH: `SEEDLING_FIRE_BLOCK_PULSE_SHOVE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_FIRE_BLOCK_PULSE_SHOVE === '1') CONTACT_FIDELITY.fireBlockPulseShove = true;
if (globalThis.process?.env?.SEEDLING_FIRE_BLOCK_PULSE_SHOVE === '0') CONTACT_FIDELITY.fireBlockPulseShove = false;
if (globalThis.process?.env?.SEEDLING_FIRE_LIVE_TURRET_REACH === '1') CONTACT_FIDELITY.fireLiveTurretReach = true;
if (globalThis.process?.env?.SEEDLING_FIRE_LIVE_TURRET_REACH === '0') CONTACT_FIDELITY.fireLiveTurretReach = false;
if (globalThis.process?.env?.SEEDLING_PULSER_PUBLISH_LAG === '1') CONTACT_FIDELITY.pulserPublishLag = true;
if (globalThis.process?.env?.SEEDLING_PULSER_PUBLISH_LAG === '0') CONTACT_FIDELITY.pulserPublishLag = false;
// ⛓ fidelity FIREMOVE: `SEEDLING_FIRE_BLOCK_ROUTE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_FIRE_BLOCK_ROUTE === '1') CONTACT_FIDELITY.fireBlockRoute = true;
if (globalThis.process?.env?.SEEDLING_FIRE_BLOCK_ROUTE === '0') CONTACT_FIDELITY.fireBlockRoute = false;
// ⛓ fidelity CORPSEBUMP: `SEEDLING_BLOCK_SWEEP_BODIES=0|1` and `SEEDLING_CORPSE_BUMP_WEIGH=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BLOCK_SWEEP_BODIES === '1') CONTACT_FIDELITY.blockSweepBodies = true;
if (globalThis.process?.env?.SEEDLING_BLOCK_SWEEP_BODIES === '0') CONTACT_FIDELITY.blockSweepBodies = false;
if (globalThis.process?.env?.SEEDLING_CORPSE_BUMP_WEIGH === '1') CONTACT_FIDELITY.corpseBumpWeigh = true;
if (globalThis.process?.env?.SEEDLING_CORPSE_BUMP_WEIGH === '0') CONTACT_FIDELITY.corpseBumpWeigh = false;
// ⛓ fidelity MISCRES D1: `SEEDLING_NON_CHASER_REMOVAL_BLOCKS=0|1` and `SEEDLING_FORECAST_CORPSE_FADE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_NON_CHASER_REMOVAL_BLOCKS === '1') CONTACT_FIDELITY.nonChaserRemovalBlocks = true;
if (globalThis.process?.env?.SEEDLING_NON_CHASER_REMOVAL_BLOCKS === '0') CONTACT_FIDELITY.nonChaserRemovalBlocks = false;
if (globalThis.process?.env?.SEEDLING_FORECAST_CORPSE_FADE === '1') CONTACT_FIDELITY.forecastCorpseFade = true;
if (globalThis.process?.env?.SEEDLING_FORECAST_CORPSE_FADE === '0') CONTACT_FIDELITY.forecastCorpseFade = false;
// ⛓ fidelity MISCRES D3: `SEEDLING_PHASE_DODGE_ARRIVAL_STALL=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_PHASE_DODGE_ARRIVAL_STALL === '1') CONTACT_FIDELITY.phaseDodgeArrivalStall = true;
if (globalThis.process?.env?.SEEDLING_PHASE_DODGE_ARRIVAL_STALL === '0') CONTACT_FIDELITY.phaseDodgeArrivalStall = false;
// ⛓ fidelity L40RES: `SEEDLING_STANCE_REENTRY_NEXT_DOOR=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_STANCE_REENTRY_NEXT_DOOR === '1') CONTACT_FIDELITY.stanceReentryNextDoor = true;
if (globalThis.process?.env?.SEEDLING_STANCE_REENTRY_NEXT_DOOR === '0') CONTACT_FIDELITY.stanceReentryNextDoor = false;
if (globalThis.process?.env?.SEEDLING_SPINNER_LOCK_LAG === '1') CONTACT_FIDELITY.spinnerLockLag = true;
if (globalThis.process?.env?.SEEDLING_SPINNER_LOCK_LAG === '0') CONTACT_FIDELITY.spinnerLockLag = false;
// ⛓ fidelity BEAMLANE: `SEEDLING_BEAM_LANE_WALK=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_BEAM_LANE_WALK === '1') CONTACT_FIDELITY.beamLaneWalk = true;
if (globalThis.process?.env?.SEEDLING_BEAM_LANE_WALK === '0') CONTACT_FIDELITY.beamLaneWalk = false;
// ⛓ fidelity TURRETCIRCLE: `SEEDLING_ICE_BLAST_SHIELD`, `SEEDLING_TURRET_CIRCLE_KILL` and `SEEDLING_ICE_TURRET_DEATH_ANIM` (`=0|1`), likewise.
if (globalThis.process?.env?.SEEDLING_ICE_BLAST_SHIELD === '1') CONTACT_FIDELITY.iceBlastShield = true;
if (globalThis.process?.env?.SEEDLING_ICE_BLAST_SHIELD === '0') CONTACT_FIDELITY.iceBlastShield = false;
if (globalThis.process?.env?.SEEDLING_TURRET_CIRCLE_KILL === '1') CONTACT_FIDELITY.turretCircleKill = true;
if (globalThis.process?.env?.SEEDLING_TURRET_CIRCLE_KILL === '0') CONTACT_FIDELITY.turretCircleKill = false;
if (globalThis.process?.env?.SEEDLING_ICE_TURRET_DEATH_ANIM === '1') CONTACT_FIDELITY.iceTurretDeathAnim = true;
if (globalThis.process?.env?.SEEDLING_ICE_TURRET_DEATH_ANIM === '0') CONTACT_FIDELITY.iceTurretDeathAnim = false;
// ⛓ fidelity SHAKEEXACT: `SEEDLING_SHAKE_EXACT_SPLIT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_SHAKE_EXACT_SPLIT === '1') CONTACT_FIDELITY.shakeExactSplit = true;
if (globalThis.process?.env?.SEEDLING_SHAKE_EXACT_SPLIT === '0') CONTACT_FIDELITY.shakeExactSplit = false;
// ⛓ fidelity L67BK4 D1: `SEEDLING_LANE_WEIGH=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_LANE_WEIGH === '1') CONTACT_FIDELITY.laneWeigh = true;
if (globalThis.process?.env?.SEEDLING_LANE_WEIGH === '0') CONTACT_FIDELITY.laneWeigh = false;
// ⛓ fidelity L67BK4 D2: `SEEDLING_TOTEM_BOSS_FIGHT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_TOTEM_BOSS_FIGHT === '1') CONTACT_FIDELITY.totemBossFight = true;
if (globalThis.process?.env?.SEEDLING_TOTEM_BOSS_FIGHT === '0') CONTACT_FIDELITY.totemBossFight = false;
if (globalThis.process?.env?.SEEDLING_L39_SHAFT_PRESS === '1') CONTACT_FIDELITY.l39ShaftPress = true;
if (globalThis.process?.env?.SEEDLING_L39_SHAFT_PRESS === '0') CONTACT_FIDELITY.l39ShaftPress = false;
if (globalThis.process?.env?.SEEDLING_COLLECT_SPAN_AIM === '1') CONTACT_FIDELITY.collectSpanAim = true;
if (globalThis.process?.env?.SEEDLING_COLLECT_SPAN_AIM === '0') CONTACT_FIDELITY.collectSpanAim = false;
if (globalThis.process?.env?.SEEDLING_SPINNER_POINT_EXACT === '1') CONTACT_FIDELITY.spinnerPointExact = true;
if (globalThis.process?.env?.SEEDLING_SPINNER_POINT_EXACT === '0') CONTACT_FIDELITY.spinnerPointExact = false;
// ⛓ fidelity L40BK2: `SEEDLING_WEIGH_HYPOTHESIS_CHAIN=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_WEIGH_HYPOTHESIS_CHAIN === '1') CONTACT_FIDELITY.weighHypothesisChain = true;
if (globalThis.process?.env?.SEEDLING_WEIGH_HYPOTHESIS_CHAIN === '0') CONTACT_FIDELITY.weighHypothesisChain = false;
if (globalThis.process?.env?.SEEDLING_DASH_SPINNER_FORECAST === '1') CONTACT_FIDELITY.dashSpinnerForecast = true;
if (globalThis.process?.env?.SEEDLING_DASH_SPINNER_FORECAST === '0') CONTACT_FIDELITY.dashSpinnerForecast = false;
// ⛓ fidelity CHESTSEAL: `SEEDLING_CHEST_SEAL_REMOVAL=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_CHEST_SEAL_REMOVAL === '1') CONTACT_FIDELITY.chestSealRemoval = true;
if (globalThis.process?.env?.SEEDLING_CHEST_SEAL_REMOVAL === '0') CONTACT_FIDELITY.chestSealRemoval = false;
// ⛓ fidelity L40LATCH: `SEEDLING_HOLD_WAIT_PRICED=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_HOLD_WAIT_PRICED === '1') CONTACT_FIDELITY.holdWaitPriced = true;
if (globalThis.process?.env?.SEEDLING_HOLD_WAIT_PRICED === '0') CONTACT_FIDELITY.holdWaitPriced = false;
if (globalThis.process?.env?.SEEDLING_CHASER_ORBIT_KILL === '1') CONTACT_FIDELITY.chaserOrbitKill = true;
if (globalThis.process?.env?.SEEDLING_CHASER_ORBIT_KILL === '0') CONTACT_FIDELITY.chaserOrbitKill = false;
// ⛓ fidelity L40BK2B: `SEEDLING_ORBIT_FREE_AIM=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_ORBIT_FREE_AIM === '1') CONTACT_FIDELITY.orbitFreeAim = true;
if (globalThis.process?.env?.SEEDLING_ORBIT_FREE_AIM === '0') CONTACT_FIDELITY.orbitFreeAim = false;
if (globalThis.process?.env?.SEEDLING_STRATEGY_BOUND_DISTINCT === '1') CONTACT_FIDELITY.strategyBoundDistinct = true;
if (globalThis.process?.env?.SEEDLING_STRATEGY_BOUND_DISTINCT === '0') CONTACT_FIDELITY.strategyBoundDistinct = false;
// ⛓ fidelity L32BOB: `SEEDLING_ENCOUNTER_SWING_IN_FLIGHT=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_ENCOUNTER_SWING_IN_FLIGHT === '1') CONTACT_FIDELITY.encounterSwingInFlight = true;
if (globalThis.process?.env?.SEEDLING_ENCOUNTER_SWING_IN_FLIGHT === '0') CONTACT_FIDELITY.encounterSwingInFlight = false;
// ⛓ fidelity L12DOORS D1: `SEEDLING_WAND_SHOT_CHASER_BODIES=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_WAND_SHOT_CHASER_BODIES === '1') CONTACT_FIDELITY.wandShotChaserBodies = true;
if (globalThis.process?.env?.SEEDLING_WAND_SHOT_CHASER_BODIES === '0') CONTACT_FIDELITY.wandShotChaserBodies = false;
// ⛓ fidelity L12DOORS D2: `SEEDLING_FINE_FRONTIER_HIDDEN_DOOR=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_FINE_FRONTIER_HIDDEN_DOOR === '1') CONTACT_FIDELITY.fineFrontierHiddenDoor = true;
if (globalThis.process?.env?.SEEDLING_FINE_FRONTIER_HIDDEN_DOOR === '0') CONTACT_FIDELITY.fineFrontierHiddenDoor = false;
// ⛓ fidelity L12DOORS D3: `SEEDLING_FINE_WAND_STANCE=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_FINE_WAND_STANCE === '1') CONTACT_FIDELITY.fineWandStance = true;
if (globalThis.process?.env?.SEEDLING_FINE_WAND_STANCE === '0') CONTACT_FIDELITY.fineWandStance = false;
// ⛓ fidelity TURRETSNAP D1: `SEEDLING_TURRET_SNAP_PRICING=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_TURRET_SNAP_PRICING === '1') CONTACT_FIDELITY.turretSnapPricing = true;
if (globalThis.process?.env?.SEEDLING_TURRET_SNAP_PRICING === '0') CONTACT_FIDELITY.turretSnapPricing = false;
// ⛓ fidelity DETERM (c): `SEEDLING_COVER_HELD_FADE=0|1` and `SEEDLING_LOCK_RECLOSE_LAG=0|1`, likewise.
if (globalThis.process?.env?.SEEDLING_COVER_HELD_FADE === '1') CONTACT_FIDELITY.coverHeldFade = true;
if (globalThis.process?.env?.SEEDLING_COVER_HELD_FADE === '0') CONTACT_FIDELITY.coverHeldFade = false;
if (globalThis.process?.env?.SEEDLING_LOCK_RECLOSE_LAG === '1') CONTACT_FIDELITY.lockRecloseLag = true;
if (globalThis.process?.env?.SEEDLING_LOCK_RECLOSE_LAG === '0') CONTACT_FIDELITY.lockRecloseLag = false;

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
