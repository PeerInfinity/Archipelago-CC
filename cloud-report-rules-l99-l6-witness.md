# Cloud report: `rules-l99-l6-witness` — two True_-ish edges the hammer solver refuses, asked of the game

Planner: `seedling-rules-planning-7`. ⚖ Robert 2026-11-14 (rules replan): "Witness L99 + L6 (Recommended)".
Base: `origin/main` = `39e8a29f7fe8f9ebca9a17c3fa2d98d4123f09a4`. Branch `claude/rules-l99-l6-witness-qj80tc`.
Game: wasm `seedling_bot_ap_p4g` (flashPanel/wasm `9968c7d`), headless logic-only (`assertLogicOnlyChannel` passed on
every page). AS3 source: `vendor/seedling` `ccdf189` (read-only). Delivered level set: the vanilla record set.
Evidence and tools: `CC/docs/cloud-reports/rules-l99-l6-witness-evidence/` (`tools/`, `l99/`, `l6/`).

## 1. The answer

| # | question | verdict | evidence |
|---|---|---|---|
| L99-a | West arrival (32,96), **Sword**: can the player open `lock@80,96` hitless? | **GAME NO** | 6 west sword runs (every pocket stance), 0 hits, all three runners alive, `99:0` never written. Two runners never wake: they are out of `Bob.runRange` (80 px) from every point of the pocket |
| L99-b | West arrival, **Ghost Spear** only | **GAME NO** | 6 west spear runs, 0 hits. The spear kills `lavarunner@160,32` through the wall, but the other two never wake, so the lock stays shut |
| L99-c | East arrival (96,112), **Sword** only | **GAME YES** | `east-sword-pin-y133`: 1,125 ticks, **0 hits**, all three dead, `99:0` written. Played twice, the same result both times |
| L99-d | East arrival, **Ghost Spear** only | **GAME YES** | `east-spear-pin-y133`, `east-spear-pin-y132`, `east-spear-foot2-p10`, `east-spear-foot2-p15`: 0 hits, lock opened |
| L6 | Weaponless, hitless westbound crossing past `bob@112,48`, from (216,40) to L5 | **GAME YES** | `noswim-bait152-row1` and `-row3`: 370/369 ticks, **0 hits**, both Bobs drown, the player lands in L5 at tick 350/349. The captured state (canSwim **true**) gives the same: `swim-bait152-row1/-row3`. The no-bait control takes hits |

**Rule consequences (sketch only, nothing committed; Robert decides, §5):**

- **L99: the AP edge `level_99__r2c4 -> level_99__r2c7` = `HasAny(Progressive Sword, Ghost Spear)` is wrong.** No item
  in that disjunction lets the player cross from the west. The lock is durable (tag 0). So the crossing should need
  the lock's flag event, and that event should be earned on the r2c7 side.
  - **seed 1 (vanilla):** no change. Swept from the committed rules: 0 regions moved, goal sweep 10 → 10.
  - **`seedling_er` AP_1:** the committed seed becomes **unbeatable** under that rule. Its route crosses r2c4→r2c7 at
    sweep 1, and r2c7's only other way in is `level_16__r1c1`, which lies behind r2c7. After the change, 74 locations
    are unreached, including the goal. So the committed ER seed rests on a crossing the game does not allow, with or
    without hits.
- **L6: the rule `level_6 -> level_5__r1c5: True_` is right.** The refusal is a solver gap (the bait rung), not a
  logic gap.

## 2. L99 — the source argument

Room: `assets/levels/Dungeon8/1.oel`, 240×208.

| line | what it says |
|---|---|
| `Puzzlements/Lock.as:111` | `tSet == -1 && totalEnemies() == 0` → the lock activates |
| `Lock.as:96` | it writes `setPersistence(tag,false)` |
| `Lock.as:42` | it removes itself on any later load while that persistence holds, so it is **durable** |
| `Game.as:1855-1882` | `totalEnemies()` counts `LavaRunner` |

**The geometry.** The L100 stairs land the player on a raised west plateau.

- The lock sits on the plateau's only cliff stairs, tile (5,6).
- The plateau is sealed on its other sides:
  - wall tiles at column 6, rows 2–4;
  - cliff (6,6) and cliff row 8;
  - cliffsides (4,6), (4,7) and (6,5), all `type = "Solid"` (`Scenery/CliffSide.as:33`, pixel masks).
- The three lavarunners stand on lava in the east half: centres (168,40), (184,72) and (200,72).

**The runners** (`Enemies/LavaRunner.as` extends `Bob`):

- speed 1.5 (`:18`), hitbox 12×12 (`:36`), `dieInLava = false` (`:38`), `hitsMax = 2` (`:41`);
- they chase only within `runRange = 80` (`Bob.as:21,59`);
- they move straight at the player with no pathfinding (`Bob.as:61`);
- they stop at the first solid pixel on each axis (`Mobile.moveX/moveY`).

**The arms:**

- **Sword** lands only if `distanceRectPoint ≤ 16` (`Player.as:915`) **and** `!collideLine("Solid", player, body)`
  (`:917`). Damage is 1 (`:115`), so a runner needs 2 hits.
- **Ghost Spear** (`hasSpear`) is a 32×5 rectangle (`:966`) with **no line-of-sight test** (`:989`). Damage is 2
  (`:144`), so one stab kills.

**The west pocket, measured** (`tools/l99-pocket.mjs`: a 1 px flood fill of the model's player map, lock shut, from
(40,88)):

- 3,472 reachable centres; x 34–102, y 34–125. It never reaches the lower floor.
- Nearest reachable point to each runner:

| runner | nearest point | distance | wakes (≤ 80 px)? |
|---|---|---|---|
| `lavarunner@160,32` | (94,40) | 74.0 px | yes |
| `lavarunner@176,64` | (102,82) | **82.6 px** | **no** |
| `lavarunner@192,64` | (102,82) | **98.5 px** | **no** |

- The game agrees on the edge. `west-*-corner` holds `right` and then `right+up` into the cliffside band for 120
  ticks. The game's x stops at **102.9**, the model's at 102.9.

So from the west, two of the three counted bodies never move. No melee arm reaches 82+ px through a wall. Taking hits
does not help either: there is nothing to trade a hit for. **GAME NO for every item in the rule's disjunction.**

**Prediction → game, west (`l99/game-rows.txt`):**

- Stances tried: the NE strip (92,40), row 5's end (100,88), above the lock (88,92), the corner (102,82) and the SE
  ledge (68,120). Each was tried with the Sword and with the spear, pressing primary 20–40 times.
- Every run: **0 hits**, lock not written.
- The runners at (184,72) and (200,72) **never left their placements** in any west run (`*.game.json.gz` samples).
- `lavarunner@160,32` wakes at the NE strip and the corner. It then pins against the far face:
  - (118.6,41) at the NE strip, behind the column-6 wall;
  - (118.8,~77) at the corner, behind the cliffside.
- **Sword:** 0 kills. The pinned runner is 18.6 px away behind the wall, and 15.9 px away behind the cliffside but
  with the line of sight blocked.
- **Spear:** kills that one runner (`minRunnersAlive` 2), which is exactly the prediction.

## 3. L99 — what DOES open it (the east side)

The lower floor (the L98 landing (96,112)) reaches every runner.

**The hitless Sword witness is a line stance** under wall tile (8,7) (x 128–144, y 112–128):

1. The player stands at (134,133) facing east, just below the wall's bottom edge.
2. A chasing runner comes down the corridor (x 148–172). Its 12 px box hits the wall's east face at x 144 while its
   top edge is still above y 128. It slides down to the player's y and **stops at centre (150,y)**.
3. That is 16 px from the player: inside the blade (rect distance 10 ≤ 16) and outside contact (|dx| ≥ 8).
4. The centre line runs under the wall, so `collideLine` is clear.
5. The runners are woken one at a time: from the stance, then from (146,y), (158,118) and (158,106). The player is
   back at the stance before each runner arrives.

The pinned position in the game samples is (150.1–151, 126.5–129). Runs:

| tape | ticks | hits | runners left | `99:0` |
|---|---|---|---|---|
| `east-sword-pin-y133` | 1,125 | 0 | 0 | written (played twice, identical) |
| `east-spear-pin-y133` | 1,125 | 0 | 0 | written |
| `east-spear-pin-y132` | 1,129 | 0 | 0 | written |
| `east-sword-pin-y132` | 1,129 | 0 | 1 | not written (third runner not finished; y133 is the witness) |

**Why plain stances fail with the Sword** (rows `east-sword-foot2-p*`, `-corridor`, `-shelf`, all 1–2 hits):

- After a hit, `Enemy.hitsTimer = 30` (`Enemy.as:24,156`). Knockback (force 5) is cancelled within about 3 ticks by the
  runner's 1.5/tick chase acceleration.
- So the runner sits on the player while it is invulnerable.
- At expiry, `hitPlayer` (`:213`) lands before a second slash can (`hit()` also needs `hitsTimer <= 0`, `:147`).
- The player walks at 0.8 (`Player.as:73`) and cannot outrun 1.5.
- A sword kill without a hit therefore needs a body that cannot close the last 8 px: the pinned line stance.
- Also: pressing again within 20 ticks dash-slashes and moves the player (`Player.as:784`), so the tapes press every
  21 ticks.

**The spear** kills in one stab. It works from the corridor's foot as well (`east-spear-foot2-p10/p15`, 0 hits).

**Model and solver.** `tools/model-replay.mjs` replays the committed east tapes on the JS model with their own staging
and the bodies present. Sword pin and spear pin both: 0 hits, `99:0`. The model is faithful here, so the refusals are
**planning gaps**:

- `l99/model-rows.txt`, east, Sword: *"no stance derives for lavarunner@176,64 … the player's box priced no stance"*.
  This is not the 55 s bait refusal from the ER report; it is a different refusal at this base.
- Spear (both sides): *"the kill work order has no weapon … (trap 157)"*. The solver has no spear kill arm, though
  the model executes the stab.
- West: *"no stance derives"* (correct).

## 4. L6 — the witness

Room: `assets/levels/Dungeon1/4.oel`, 272×80.

**Layout:**

- Water: row 2, cols 6–8.
- `sandtrap` pairs: (4,1)/(4,3) and (10,1)/(10,3). They are static 16×16 bodies (`SandTrap.as:35`).
- `bob@96,16`: centre (104,24). `bob@112,48`: centre (120,56).

**The Bob:**

- speed 0.5 (`Bob.as:18`), slower than the player's 0.8;
- chases in a straight line within 80 px;
- an `Enemy` whose centre tile is Water is destroyed (`Enemy.as:71-74`, `dieInWater = true` `:39`).

**Prediction.** The player stands on row 2 at column 9, (152,40), just east of the water. Both Bobs wake: 35.8 px and
50.6 px away. Each Bob's straight line to the player crosses the water, so both drown. Then the room is empty.

**Game (`l6/game-rows.txt`, staging = captured request #26).** Changes from the capture:
- `seam.items.hitsMax` is renamed `seam.hits_max`;
- `inventory_slots` is dropped (the tape format has no such field);
- nothing else.

| tape | canSwim | ticks | hits | Bobs left in L6 | lands in L5 at |
|---|---|---|---|---|---|
| `noswim-bait152-row1` | false | 370 | **0** | 0 | t 350 (played twice, identical) |
| `noswim-bait152-row3` | false | 369 | **0** | 0 | t 349 |
| `swim-bait152-row1` | true (as captured) | 370 | **0** | 0 | t 350 |
| `swim-bait152-row3` | true | 369 | **0** | 0 | t 349 |
| `*-nobait-row1` (control) | both | 220 | 1–2 | 2 | never |

Samples (`noswim-bait152-row1.game.json.gz`):
- `bob@112,48` is last seen at t 84, at (132.2,48.8) going north-east, and is gone by t 104;
- `bob@96,16` is last seen at t 144, at (126.6,31.5) going south-east, and is gone by t 164.

The player then walks row 1 over columns 5–9, drops to row 2 at column 5, passes column 4 on row 2, and goes up
column 2 into the teleporter. No item, 0 hits. The model replays both bait tapes the same way (0 hits, L5).

**Solver (`l6/model-rows.txt`, this base):**

- swim: REFUSED, *"bait (bob@112,48) stance: the combat ladder is EXHAUSTED … danger at (162.2,40.0)"* (11.3 s);
- noswim: REFUSED, same rung, danger `sandtrap@160,16` (64 ms).

So the hammer owes a **drowning bait**: a stance on the far side of the terrain that kills the chaser, not past it.
That is a general derivation from `dieInWater`/`dieInLava` and the chaser's straight line. The `tapeFormat` v10
docblock already records the same mechanism for the eastbound crossing. No solver or levelRun change was needed for
the witness; the tapes are hand-authored.

## 5. The GAME NO, sketched as a GENERAL rule (not built, not committed)

**What changes.** A durable kill-lock (`tset == -1`, `tag ≥ 0`) becomes a **sided** gate. Today
`killLockRoomRuling` → `lockRuling` emits one condition for the level (here the undecided `A_WEAPON`). That condition
applies to every crossing of the lock, whichever side the player is on.

**The derivation:**

1. Partition the level into the regions the lock separates (the existing `__rRcC` sub-regions, with the lock shut).
2. For each region X and each counted body B, decide whether B is **removable from X** by an arm or a free cause:
   - **Chaser bodies** (the `Bob` family, using the class's `runRange`): some reachable centre of X lies within
     `runRange` of B's placement centre. Otherwise B never moves (`Bob.as:59`), and only a ranged or no-LOS arm whose
     reach covers the placement from X counts.
   - **Static bodies:** the arm's reach from some cell of X covers B. The reach comes from the arm's own geometry: the
     sword's 16 px rect plus LOS, the spear's 32 px rect with no LOS.
   - The existing free arms (self-removal, measured environmental kills) stay as they are.
3. The lock's condition **from X** is the conjunction over bodies of their arms removable from X. If some body has
   none, X cannot open the lock.
4. Because the lock is durable (`Lock.as:42`), emit one flag event, `L<n> flag <tag>: lock@x,y cleared`, in each
   region from which the condition is satisfiable, with that region's condition. Gate **every** crossing of the lock
   on the event. That is the same shape the map already uses for other flag events.

**Inputs it reads:**

- the level record: tile types, cliffside placements and masks, lock `tset`/`tag`, the bodies' placements and
  classes;
- per class: the chase radius (`runRange`), hitbox, and the terrains it survives;
- per arm: the reach geometry and whether it needs LOS;
- the sub-region partition.

No level literal: L71's lavarunner lock would be decided by the same code.

**Expected effect** (`tools/sided-lock-sweep.py`, `l99/sided-lock-sweep.txt`). This is an item-aware sweep over the
**committed** rules.json and its placements. Events are collected inside the sphere they unlock. The L99 edges are
rewritten in memory as the sketch says. It is not a generator run.

- **seed 1** (`seedling_playthrough/AP_14089154938208861744`): **0 regions and 0 locations move**, goal at sweep 10
  before and after. The west island (L99 r2c4, L100 r2c3 and r4c10) has no entrance except from r2c7. The
  `*_sphere_log.jsonl` shows L98, L99 and L100 opening together at sphere 12.2, from L98.
- **`seedling_er` AP_1:** **the goal becomes unreachable.**
  - 207 regions and 74 locations drop out (41 item locations, `Level 115 - The Seed` among them).
  - Before the change: r2c4 at sweep 1 (from `level_11`), r2c7 at sweep 1 via r2c4, and the L16 side behind it.
  - r2c7's only other entrance is `level_16__r1c1`, which is reached only through r2c7.
  - The committed ER seed is exactly the impossible case. Its survey step 39 is the request that refused.
  - A regenerated ER seed under the sided rule would have to route differently. ER generation would then have a rule
    that can reject layouts like this one.
- **Graph-only control** (`tools/edge-cut.py`, every item rule read as true): cutting `r2c4 -> r2c7` strands nothing
  in either preset. The ER loss is an item/route-order effect of AP_1's layout, not a disconnected map.

## 6. What was tried, and what was not

- **L99 west:** 5 stances × 2 arms (`west-{sword,spear}-{nePocket,row5,overLock,se,corner}`), plus the 1 px pocket
  flood fill.
- **L99 east:** 14 committed runs before the pin worked (`east-*-{corridor,foot,shelf,foot2-p0/5/10/15}`), then the pin rows. Two earlier "hold" runs at
  (96,136) woke nothing; their logs were superseded and are not committed.
- **Not tried, from the west:**
  - Wand, Fire Wand, Fire and the Dark/Ghost Sword arms. The edge's rule names only Sword and Ghost Spear.
  - Source note: Fire only knocks a runner back (`Enemy.hit`: `hitByFire` false). Dark and Ghost Sword hit for 2
    (`Player.as:113-114`), but no west point wakes the far two, so reach is still the binding constraint.
  - Whether a projectile crosses the cliffside band was **not** examined.
- **Not staged:** the ER survey's Green Key and 4 seals. Nothing in L99 reads them.
- **Model-authoring caveat:**
  - The tapes are open-loop key scripts. The model only advanced the player's clock, on a copy with the room's bodies
    despawned at t 0. Its camera-shake band refuses to say whether a runner near the screen edge is on screen
    (`levelRun`: *"depends on where inside `Game.shake`'s jiggle the camera landed"*).
  - The **played** tapes carry the true staging (no despawn). The game is the judge of every row.
  - Repeatability: `east-sword-pin-y133` and `noswim-bait152-row1` were each played twice with identical rows.
- **Not done:** `CONTACT_FIDELITY` / solver / levelRun, rules, presets, atlas, tables, `worlds/`, `vendor/seedling`,
  submodule pointers. All untouched. No vitest run (no test file touched). The dev server on :8000 was started by
  this slice and stopped by PID at the end.

## 7. Hand-overs

- **Robert / rules:** §5. The L99 sided kill-lock rule, and the fact that it makes `seedling_er` AP_1 unbeatable.
  Stopped at the sketch, as the brief requires.
- **Hammer (solver):**
  - (a) L99 east Sword: the line stance under a wall corner with one-at-a-time waking. The model executes the tape
    hitless, but the solver's kill rung says "no stance derives".
  - (b) The kill work order has no Ghost Spear arm (`trap 157` refusal). The model executes the stab.
  - (c) L6: a drowning bait stance on the near side of the water for a far-side arrival. The model executes the tape
    hitless.
- **Fidelity:** nothing new. Every committed tape replays on the model as on the game.
