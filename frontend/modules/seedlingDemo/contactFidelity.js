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
