# rules-l26-rocklock-nohit-witness: can each arm open L26's rock lock with 0 hits from the L25 arrival (8,2)?

| | |
|---|---|
| Slice | `rules-l26-rocklock-nohit-witness` (cloud, REPORT ONLY). Planner `seedling-rules-planning-12`; the designer's binding terms (tile-primitives-design-8) folded in |
| Base | `origin/main` **5634df8868e21e7963ce7ef4d05ea861bf0c0b1a** |
| Branch | `claude/l26-rocklock-nohit-witness-q57bkm`: commit `c1650c72` (tools + evidence), then this report |
| Game | `seedling_bot_ap_p4g` (wasm, headless logic-only; `CHANNEL: headless logic-only` on every page). **One fresh browser and page per tape**, damage on (`noDamage: false`), nothing removed, no flag staged, no game value written |
| Source | `vendor/seedling` @ `ccdf189` (the pinned AS3 source), `src/…` below |
| Evidence | `CC/docs/cloud-reports/rules-l26-rocklock-nohit-witness-evidence/` (`tools/`, `lines/` = the tapes as plans, `runs/` = every page run, gzipped) |

## Answer

The row is `level_26__r2c4 -> level_26__r13c8 = HasAnyCount(Progressive Shield 2, Ghost Spear 1, Progressive Sword 1, Wand 1)`.
From the L25 arrival (128,32) = tile (8,2), **each disjunct on its own** reaches r13c8 (its L28 door, `teleporter@144,208`) with **0
hits**. It kills both punchers, the game writes `{26,0}`, and the rocklock fades. Each result is the same on two fresh pages.

| arm (held ALONE) | verdict | tape (plan) | how | puncher@80,168 dies | puncher@32,208 dies | enters L28 | hits (every sampled tick) | pages |
|---|---|---|---|---|---|---|---|---|
| **Progressive Sword** | **GAME YES** | `runs/node-door-all-sight-default/sword.json` (solver, sha `b7170194f52c`, 688 t) | solver (ON flags) | t301 | t485 | t688 | 0 / 689 samples | `page-sword-{a,b}` identical |
| **Ghost Spear** | **GAME YES** | the same 688 keys, Spear held (`--items`) | solver plan re-armed (the solver itself refuses: no weapon arm) | t254 | t485 | t688 | 0 / 689 | `page-spear-swordplan-{a,b}` identical |
| **Wand** | **GAME YES** | `lines/WAND-YES.json` (spec `lines/WAND-YES.spec.json`, 970 t) | **hand-authored** on the game (the solver and levelRun cannot fight a puncher with a wand) | t375 | t709 | t947 | 0 / 969 | `page-WAND-YES-{a,b}` identical |
| **Progressive Shield ×2** (Shield + Dark Shield) | **GAME YES** | `lines/SHIELD2-YES.json` (926 t) | **closed-loop controller on levelRun** (`tools/shieldctl.mjs`); the solver refuses (no weapon arm) | t355 | t665 | t926 | 0 / 926 | `page-SHIELD2-YES-{a,b}` identical; 2 more lines also YES (`page-s-i0-b10-x70`, `page-s-i1-b9-x70`) |
| route's real holdings (Sword + Shield ×1) | GAME YES | the Sword plan | — | t301 | t485 | t688 | 0 / 689 | `page-sword+shield1-{a,b}` identical |

So **no arm is GAME NO** and the row stands as written. Shield ×2 also clears it by KILLING (the dark-shield bump), not by passing.
hammer-13's refusal is a **solver search refusal, not a game NO**: it is reproduced and explained in § hammer-13. Section 4's re-pricing is
therefore not needed. § 4 still answers the machinery question, for the record.

Numbers are from `runs/page-yes-summary.jsonl` (`tools/summary.py`). "Dies" is the tick the death animation starts on the game.
"Hits" is the maximum of `botStatus.hits` over every sampled tick. The player's hits never fall inside a room (no health pickup here), so a
missed sample cannot hide a hit.

## Base inventory (designer term 2)

- The rule into the arrival: `level_25__r3c2 -> level_26__r2c4 = True_` (seed-1 preset
  `seedling_playthrough/AP_14089154938208861744`). **Nothing is needed at (8,2)**.
- Staging = NEW-LOCKS leg 286's own captured request (`fixtures/hammer-new-locks/leg286-l25-l26-request.json.gz`, key
  `level_26__r2c4 <- in_L25_0_96 -> …`). It holds boot L26 (128,32), `hits_max 3`, its save block (key 0, seal parts 0–3), rng seed
  1588293782 split, `time 4989`. **Every seam item is false except the arm under test.** The slots are re-derived per arm
  (`tapeFormat.inventorySlotsFor`, the legwitness §3.2 trap): Sword `[0]`, Spear `[3]`, Wand `[2]`, Shield ×2 `[]` (the shields
  are not slot items). No Health, no Sword beside the Spear, Wand or Shield.
- The route at survey step 35 (`ap-chests-solid` `runs/step35/route-derive-tip.txt`, L26 visit 1, boot `staged:r8-solve-11`) holds
  Progressive Sword (L10) + Progressive Shield ×1 (L20). That is witnessed too (last row above).

## Source (designer term 3)

- **Puncher** (`src/Enemies/Puncher.as`): `runRange 80` (`:22`), it chases while `FP.distance <= 80` with no line-of-sight test (`:63`, the
  LOS clause is commented out), `moveSpeed 1` (`:18`). `attackRange 10` (`:23`): at centre distance ≤ 10 it plays `attack-*`
  (4 frames at 12, `:36-38`, about 10 ticks measured). The punch resolves only at the animation's END (`endAnim` → `attackPlayer`,
  `:127-143`). Its box is an 8 px strip on the facing side (`:201-213`), and `attackPlayer` returns while `hitsTimer > 0` (`:174-177`).
  `knockback` is empty (`:167-170`): it is never pushed back. Box `setHitbox(12,12,6,4)` (`:46`), `solids` + `Enemy`, `Player` (`:48`).
- **Enemy** (`src/Enemies/Enemy.as`): contact damage `hitPlayer` only while `hitsTimer <= 0` and the bodies overlap (`:211-220`, called each
  update `:108-109`). `hitsMax 3`, `hitsTimerMax 30` (`:22-24`). `hit()` ignores a hit while `hitsTimer > 0` unless it is dark stuff
  (`:147`). It does not update off screen (`activeOffScreen false`, `:45`, `:64`). The screen is 160×160 (`Main.as:36`).
- **Wand** (`src/Projectiles/WandShot.as`, `Player.as:994-1003`): the shot spawns 16 px ahead, at 3 px/t, and lives `3*16/3 = 16` ticks
  (`:23,66`): it reaches about 64 px. 0.5 damage (`:29`), so **6 landed shots** per puncher, one per 30-tick window. On the kill,
  `dieEffects("Wand")` adds `Explosion(x, y, ["Player","Enemy"], max(w,h)=12)` (`Enemy.as:181-198`). Its hit radius is
  `12 × 0.65 = 7.8 px` and it **hits the player** (`Projectiles/Explosion.as:25-55`). The facing comes from the velocity, x first
  (`Player.as:1625-1646`).
- **Dark shield** (`Player.shieldBump`, `Player.as:1691-1707`, called each update `:529-530`): while the player moves and the shield box
  overlaps an enemy with `hitsTimer <= 0`, `o.hit(5, p, 0.5, "Shield")`. That is 6 bumps per puncher, with no explosion (the `"Shield"`
  arm of `dieEffects` adds nothing).
- **RockLock** (`src/Puzzlements/RockLock.as:49-66`): `tSet == -1 && totalEnemies() == 0` → active, alpha −0.01 a tick, so
  **100 ticks** to `type = ""` and `setPersistence(tag,false)`. Punchers count in `Game.totalEnemies` (`Game.as:1868`).

## How each YES works (frame level)

The map is `runs/map26fine.txt` (8 px cells). From (136,40) the pocket opens west. The pole row (y 48–64, x 80–160) is crossed by the gap at x 64–80.
The room is x 32–128, y 64–288, and the lock sits at (112–128, 208–224) with the door east of it.

- **Sword** (solver, `KILLLOCK_CLEAR_WRITE`+`ROCKLOCK_KILL`+`KILLLOCK_CHASER_REWIND`+`KILLLOCK_LINE_STANCE`; the same plan with
  `KILL_STANCE_SIGHT` 0, 1 or default, `runs/node-arms.txt`). The player walks to the stance (120.4,103.7) by t141. puncher@80,168 wakes at
  t116 and walks up into it. Three slashes, each 30 ticks apart, so it never ends a punch with `hitsTimer` 0 (closest 7.3 px at t276).
  Dies t301. Then down column x≈72; puncher@32,208 wakes about t400 and is slashed out by t485. 144 idle ticks cover the fade, then east
  into L28 at t688 (`runs/trace-sword-model.txt` = the model's frames).
- **Ghost Spear**: the same keys. The spear does 2 per thrust (`Player.as:144`), so @80,168 dies at t254 (closest 8.6 px).
- **Wand** (`lines/WAND-YES.spec.json`): the Sword plan's first 140 ticks to the same stance, one tick of `down` to face south, then
  `primary` every 15 ticks. The first shots go wide while it approaches diagonally. From t225 a shot lands **every 30 ticks exactly**
  (225, 255, 285, 315, 345): each lands as the 30-tick immunity runs out, so every punch that ends finds `hitsTimer > 0`. Before the 6th:
  `up` 10, `down` 2 (two ticks, because one only zeroes v.y and keeps the facing up), and the 6th lands at t375 **from 8.5 px**, outside
  the 7.8 px explosion. Then left 34 / down 38 / left 27, a stop of 8 ticks (or the facing stays west) and `down` 2. puncher@32,208 wakes
  at t500 and walks straight up x≈42. The same cadence lands at 548 … 679, then `up` 13 / `down` 2, and the kill lands at t709 from 8.6 px.
  60 idle ticks, then down 64 / right 110, into L28 at t947.
- **Shield ×2** (`tools/shieldctl.mjs --mode=pulse --in=0 --back=9 --lure=76,96;76,140;42,140 --waypoints=76,216;150,216`, on levelRun,
  which models the dark-shield arm, `levelRun.js` `darkHitChaser`): the same first 140 ticks. Then each tick: step toward the nearest
  puncher only when its `hitsTimer` is 0 (the bump lands and restarts the 30), and step away while it is immune and nearer than 9 px (the
  bodies never overlap when the timer runs out). A dies t355 and B dies t665. The controller waits 105 ticks for the fade and walks to the
  door, reaching L28 at t926.

## The NO lines on the way (for the record; each one hit, and why)

The first Wand lines show that the arm's margins are real. They are not random (`runs/page-*.json.gz`, `runs/page-summary.txt`):

| line | first hit (tick, player) | cause (source) |
|---|---|---|
| Sword keys, Wand held (`page-wand-swordplan-*`) | t337 (112.4,89.4) | 3 presses = 1.5 damage; the puncher ends a punch with `hitsTimer` 0 (`Puncher.as:137-139,174`) |
| `w1a` / `w1-e16` (fire every 16) | t307 (120.4,100.7) | a 16-tick cadence lands every 32: the window opens 2 ticks before the shot, and a punch ends in it |
| `w1-e15` (every 15, no retreat) | t375 (120.4,105.4) | the 6th shot kills @80,168 **7.0 px** away: the death explosion, 7.8 px (`Explosion.as`, `Enemy.as:181-198`) |
| `w2-up8`, `w2-up12` (retreat, one `down` tick) | t382 / t388 | one `down` tick zeroes v.y and the facing stays north (`Player.as:1625-1646`): the 6th shot goes up and the puncher's punch lands |
| `w5` (no stop after walking left) | t588 (40.5,148.9) | v.x < 0 keeps the facing west (x first): every shot hits the wall; @32,208 punches at contact |
| `w6`, `w7` (B, short retreat) | t709 (41.8,152.8 / 143.4) | @32,208 dies 7.0 / 7.6 px away: the explosion again |
| Shield ×2, `--mode=push` | model t225 (chaser) | pushing overlaps the bodies, and the contact arm fires on the tick the timer runs out (`Enemy.as:211-220`) |
| Shield ×2, other pulse settings | model, `runs/shield2-model-sweep.txt` | `back ≥ 11`: the step-in comes too late, a contact hit at t226–228; `in=1`: a punch at t352 |

## hammer-13's refusal, reproduced (why it is not a game NO)

`tools/arms.mjs` runs the same request with the four switches ON and the goal = the L28 door (`runs/node-arms.txt`):
- **Sword alone: SOLVED**, 688 t, 0 hits (all three `KILL_STANCE_SIGHT` settings give the same plan).
- **Sword + Shield ×1 (the route's real holdings): REFUSED**: *"… puncher@80,168's box … PINNED from here … | puncher@80,168 at line
  stance (120,104): … by press: the dwell was HIT at dwell tick 110 (run tick 208) …"*. This is hammer-13's text.
- **But the Sword plan with Shield ×1 held is 0 hits on the model** (`tools/replay-with.mjs`) **and on the game, twice**. A Shield ×1
  bump only knocks back, and a Puncher's `knockback` is empty (`Puncher.as:167-170`). So the game is unchanged and the search is not:
  holding the shield sends the solver down another dwell and ends it there. That is a solver lead for its owner (no solver change in
  this slice). The other three arms are refused by the solver for another reason: *"the kill work order has no weapon"* (it only has a
  sword arm against chasers).

## 3. The other arrival the NEW-LOCKS legs solved

- NEW-LOCKS solved two L26 legs (`seedling-hammer-new-locks.md` § the arms): **286 = this same L25 arrival** (boot (128,32),
  Sword only, clear-tag goal, 629 t, 0 hits). That is the plan this report's Sword row extends to the door (`hammerNewLocks.test.js` passes
  at this base, 13/13). And **289 = the L27 arrival**, boot **(64,288)** (from `teleporter@64,304`, `level_26__r2c4 <- in_L27_32_0`),
  Sword only: 315 t `kill`, and to the L28 door 357 t (test row 10).
- How (8,2) differs: (64,288) stands at the room's south end, **≈ 86 px from puncher@32,208** (just past `runRange 80`) and ≈ 120 px
  from @80,168. B wakes alone, and the fight is against one body at the lock's own row. From (8,2) the player enters from the north,
  through the pole-row gap at x 64–80. **@80,168 wakes first** (at t116, at ≈ 79 px) and comes up the middle of the room. Then B must be
  drawn north to the player (it wakes at t400–500 as the player comes down past y≈140). So there are two separate fights, and the
  player has only the open room and no wall at its back. The leash and wake are the same rule (80 px, on screen only). The difference is
  which body wakes first and how far it walks to the player.

## 4. Re-pricing sketch

**Not indicated: no arm is GAME NO.** For the record, the brief's machinery question. The encounter-lock rule already grades kill-lock
SIDES (`seedlingObstacleEvents.encounterLockSides`: `clears` / `undecided` / `cannot`, FIRE only on `cannot`; the
`probe-seedling-killlock-arms` record; `opens_from`). For this row, the side is the whole r2c4 region, and that region holds both arrivals
((8,2) and (64,288)). So the existing form is **side-sided, not arrival-sided**. If a future arm were NO from one arrival only, the stricter-only
form would split the side's grade per `arrivalTiles` entry inside the side. It would be derived as the side machinery derives it, never
named: a separate `clears` per landing, with an `And` on the arrival's own entrance. Nothing in that sketch is needed here, and none of it is wired.

## Tools (all under the evidence dir; none enrolled in a roster)

- `tools/arms.mjs`: leg 286's request with one arm's items, goal = the L28 door, the atlas's other rooms added (the request carries
  L26 only), solved as the worker does (`solveAnytime`) under named switches; `--out` saves `{staging, plan}`.
- `tools/replay-with.mjs`, `tools/trace.mjs`: re-drive a plan on levelRun with other items, and print its frames.
- `tools/lines.mjs`: build a hand-authored plan from a segment spec (copy / hold / idle / fire cadence).
- `tools/shieldctl.mjs`: the Shield ×2 closed-loop controller (levelRun), emitting a plan.
- `tools/play.mjs`: plays one plan on a fresh p4g page (adapted from `seedling-hammer-small-walls-evidence/tools/legwitness.mjs`),
  polls `botStatus` + `botMobiles` every tick, and writes `{row, tape, samples, mobs}`.
- `tools/summary.py`: kill ticks, death distance, closest approach, the L28 tick and max hits per run. `tools/map26*.mjs`: the maps.

Bounded test run: `npx vitest run frontend/modules/seedlingDemo/hammerNewLocks.test.js`, 13/13 passed. No unfiltered vitest, no CI dispatch.
No solver, levelRun, rule, preset, atlas or table changes. No submodule pointer moved.

## Deliver

- **Verdict per arm: Sword YES, Ghost Spear YES, Wand YES, Shield ×2 YES.** All are from (8,2), with 0 hits, both punchers dead,
  `{26,0}` written by the game and L28 entered, each the same on two fresh pages. Also YES with the route's Sword + Shield ×1.
- **The chest landing is unblocked on this question.** `Or(Shield×2, Ghost Spear, Sword, Wand)` is honest from the (8,2) side, and no
  re-pricing is needed.
- **A note on fragility.** The Wand line's kill shots land 8.5 / 8.6 px from the player, against the 7.8 px explosion radius. The
  shield controller's step-away margin is 9 px, and 10 px also works for one lure; 11 px and more fail. These are game YES at their
  margins; a human player has the same margins.
- **Solver lead** (not acted on): holding Shield ×1 makes the solver refuse a plan that the game and the model both pass. It has no
  weapon arm for Spear, Wand or Dark Shield against chasers.
