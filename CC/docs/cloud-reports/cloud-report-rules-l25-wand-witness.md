# Cloud report: `rules-l25-wand-witness`

Can a Wand holder cross L25 west→east with 0 hits? **Yes: GAME YES.**

- Branch `claude/wand-l25-west-east-nohit-bj2bsw`, started from `origin/main` = `f96d6b66254cd8c2dd08323a489d5d1f07525600`.
- This slice is REPORT ONLY. No rule, preset, atlas, gate table, plans file, solver, levelRun, `CONTACT_FIDELITY`, level-data or engine change was made, and no submodule pointer moved.
- Evidence (tools, tapes, segment sources, run logs, per-tick traces) is in `CC/docs/cloud-reports/rules-l25-wand-witness-evidence/`, which has a `README.md` map.

**Game setup for every run:**
- Page `seedling_bot_ap_p4g`, delivered set `seedling-vanilla-record-23510f80`. The set id differs from the derivation's `5aeefc3c` because main moved since then. All three of the derivation's L25 tapes still reproduce on it, tick for tick (§5).
- Each tape ran on a **fresh page**.
- Staging is the probe's `caseTape` / `caseStaging`: boot at the L26 door's landing, holding exactly `hasWand`, `noDamage` false, nothing removed.
- **Slot trap: checked on every Wand run.** The fresh page reports `primary: 0` and `inventory_slots: [2]`, and `tapeFormat.inventorySlotsFor({hasWand})` = `[2]`. So `primary` names the Wand (`Player.as:1577-1601`, `case 2`), and every press produced a `WandShot` mover.

## Answer table

| # | question | verdict | evidence |
|---|---|---|---|
| 1a | Wand alone, L26 door → **L22 door**, 0 hits | **GAME YES** | `tapes/l25-26-22-wand.json` (200 ticks, hand-authored). Levels [25, 22], 0 hits, 0 respawns, door crossed at **t189**. Deterministic: 6 fresh pages, all 0 hits (`runs/e5.log`, `runs/e5-repeat3.log` ×3, `runs/final-wand.log`, `runs/final-wand-and-sword.log`), plus the tracked probe's own play path (`runs/probe-scratch-worktree.log`, §1.3) |
| 1b | Wand alone, L26 door → **L28 door** (the other door the W→E row charges) | **GAME NO, but not a band or Wand question** | The Wand line reaches the east side with 0 hits. The L28 corridor is shut by the closed chest, which opens only from below (`Chest.as:61-66`). `runs/l28-east.log`, `runs/l28-above.log`: 0 hits, chest cell never entered, stayed in L25. This is arm-independent, the same as the probe's `--chest` cases for no item |
| 2a | Control: same keys, Wand shots dropped, no item | **GAME NO** (as expected) | 2 hits: t63 Bob, t83 parked flyer + Bob. Respawn (`runs/final-control__arm_none___drop_primary_.log`) |
| 2a′ | Control: same keys, Wand **held**, shots dropped | **GAME NO** | Identical to 2a: t63, t83 (`runs/final-control__drop_primary_.log`). The shots are what clears the line, not holding the item |
| 2b | Table Sword witness `l25-26-22-sword`, replayed verbatim | **GAME YES** (as expected) | 0 hits, [25, 22], door at t108 (`runs/l25-26-22-sword.replay.trace.json`, `runs/final-wand-and-sword.log`) |
| 3 | The Bobs | Bob `bob@64,80`: **one Wand hit, overlapped only while struck, then held.** Bob `bob@48,64`: **never struck, avoided, then held** | §3 |
| 4 | The pushable block | **Not touched by the YES line.** The block is at (80,64) on every tick. The derivation's row-3 line is the one that has to push it | §4 |
| 5 | Contacts and launches of every attempt | 15 lines, every NO attributed | §5 |
| 6 | What a general derivation must model | sketch | §6 |

**The YES line, named:** `l25-26-22-wand` (plan-shaped in `plan-l25-26-22-wand.json`).

## 1. Q1: the YES line and the doors

### 1.1 The committed rows (main `f96d6b6625`)

The same L25 rows appear in `seedling_playthrough/AP_1` (vanilla) and in `seedling_er/AP_1`. They are also in `seedling_playthrough_maze/AP_1`, and in the seed-1 preset `seedling_playthrough/AP_14089154938208861744` as `HasAny`:

```
level_25__r3c2 -> level_25__r2c7   Or(Has Progressive Sword, Has Ghost Spear, Has Progressive Shield)   <- the W→E gate
level_25__r3c2 -> level_26__r2c4   True_
level_25__r2c7 -> level_25__r3c2   True_                                                             <- E→W, free
level_25__r2c7 -> level_22__r8c0   True_
level_25__r2c7 -> level_28__r0c6   True_
```

- The W→E row charges the east sub-region `r2c7`, and both remaining doors hang off it as `True_`: **L22** (door at (144,32)) and **L28** (door at (96,128)).
- For comparison, the L22 twin of the same rows already carries the Wand: `level_22__r8c0 -> level_22__r0c6` = `Or(…, Has Wand)`.

### 1.2 The line (`segs/l25-26-22-wand.json` → `tapes/l25-26-22-wand.json`)

**The tape is hand-authored.** The model refuses a WandShot in a wallflyer room (`MODEL_REFUSES.wand` in the probe), so no search exists for this arm. The tape was tuned only against the game's own per-tick trace (`tools/witness2.mjs`).

The sequence, in game ticks and positions:

1. **Approach.** Walk from the landing (24,104) east along row 6, then up into row 5, and stop at **(50.8, 92.2)** (t42). The square has these properties:
   - It is west of the west flyer's ray (x=56).
   - It is low enough in row 5 that the descending Bob `bob@48,64` (box bottom ≈ 87) is not yet touching. The player box is [y-2, y+3).
   - From there a vertical shot overlaps the west flyer's body [49,63) and a horizontal shot overlaps the other Bob.
2. **Shot 1 (east), pressed t36, fires t44** (`Player.as:1056-1059`: the shot leaves at `wandEnd`, 8 ticks after the press). It strikes **`bob@64,80`** at (60.2, 91.8) at t45: hits 0.5/3, `hitsTimer` 30.
3. **Shot 2 (up), fires t59** (5 release ticks first, so `v.x` = 0 and the facing reads up: `Player.as:1625-1646`, `Mobile.as:73-80`). It strikes **`wallflyer@48,48` at rest** at t63.
4. **Cross the west column.** Walk east. The struck west flyer launches at t64 (player (54.9, 90.5)), flies down its ray x=56 and **parks at the bottom of row 5, (56,89), at t73**. The player is inside its body at t71-72, while its `hitsTimer` is 21→20. Its body now overlaps both Bobs, which stop moving for the rest of the run (§3).
5. **Shot 3 (up), fires t87, from (67.2, 88.8)**, which is east of x=56 and west of x=72, off both rays. It strikes **`wallflyer@64,48` at rest** at t90.
6. **Cross the east column.** It launches at t92 (player (71.3, 88.8)) and parks at (72,89) at t101. The player is inside its body at t99, with `hitsTimer` 20.
7. **Exit.** East along row 5 under the pushable block, up column 7, east to the L22 door: **level change at t189**.

### 1.3 Plan shape: verified, not committed to the tracked file

`plan-l25-26-22-wand.json` holds `plans["l25-26-22-wand"]` (`ticks`, `inputs`, `hand: {by, plan}`) and `controls["l25-26-22-wand"]` (`arm: "none"`, `drop: ["primary"]`). Both are in the tracked plans file's shape.

To check that a follow-up can move them in verbatim:
- I merged them into a **scratch git worktree's** copy of `scripts/procgen/seedling-wallflyer-nohit-plans.json`, outside this branch, and since deleted.
- I ran the tracked `probe-seedling-wallflyer-nohit.mjs --only=l25-26-22-wand,l22-25-21-wand` there (`runs/probe-scratch-worktree.log`).
- It printed **`ALL CHECKS PASSED`**: the hand plan landed in L22 with 0 hits, and its control "do NOT cross cleanly … so the arm is what clears the line" (2 hits, 1 respawn). L22's Wand plan and control passed beside it.

### 1.4 The L28 door

- From `r2c7` the corridor to the L28 door (cells (6,7)-(6,8)) runs through the chest's cell (6,6). A closed chest is a Solid, and it opens only for a player on the line one pixel under its bottom edge (`Chest.as:61-66`). That line lies in the L28 corridor itself.
- With the Wand line as prefix:
  - `l28-east` reached cell (7,6) and pressed left+down into the chest's east face for 45 ticks.
  - `l28-above` stood on (6,5) and pressed down for 35 ticks.
  - Both: **0 hits, chest cell never entered, never left L25.**
- This matches the probe's `CHEST_CASES` `l25-22-chest-east` / `-above` (expected `shut`), which hold no item.
- **So L28 is not reachable from the east side with any arm.** That says nothing about the band or the Wand.
- ⚑ **For the planner:** `level_25__r2c7 -> level_28__r0c6 True_` is the same pre-existing question the earlier `--chest` slice raised. It is not this slice's, and I changed nothing.

## 2. Q2: controls

| run | keys | arm | result |
|---|---|---|---|
| YES | `tapes/l25-26-22-wand.json` | Wand | 0 hits, [25, 22] |
| control (no item) | same, `primary` dropped | none | **2 hits**. t63: player (54.2, 92.5) overlaps `bob@64,80` at (59.4, 91.9), which is unstruck. t83: player (63.1, 92.9) overlaps the parked, unstruck west flyer at (56,89) and the same Bob. Respawn, then 2 more hits (t145, t173, Bobs). Never left L25 |
| control (Wand held, no press) | same, `primary` dropped | Wand | identical to the row above (t63, t83, t145, t173) |
| Sword witness | `l25-26-22-sword` verbatim | Sword | 0 hits, [25, 22], door t108 |

- The derivation's own control tape `l25-26-22-none-control.json`, replayed on this base, still gives its **t96 / t116** hits (`runs/from-derivation-replay.log`).
- My control is the same-line twin, so its hit ticks differ (t63 / t83), but it lands the same way: 2 hits, respawn, no crossing.

## 3. Q3: the Bobs

**Source:**
- Bob: `moveSpeed` 0.5 (`Bob.as:18`). It chases when within `runRange` 80 of the player (`:21`, `:55-75`). There is **no line-of-sight test** (`:59`, commented out). `solids.push("Enemy")` (`:39`): a Bob cannot step into another Enemy's box. Hitbox 8×8 centred (`:41`).
- Moves are 1-px steps refused on overlap with `solids` (`Mobile.as:90`, `:107`).
- Enemy: `hitsMax` 3, `hitsTimerMax` 30 (`Enemy.as:22`, `:24`). `hit` adds `d` and arms the timer (`:147-157`). `hitPlayer` needs `hitsTimer <= 0` (`:211-219`), so **a struck Bob can be overlapped for 30 ticks**. Knockback pushes away from the shot's point (`:247-254`).
- WandShot: damage 0.5 (`WandShot.as:29`), hitbox 3×3 at origin (2,2) (`:62`), 3 px/tick for 48 px (`:23`, `:66`). It is spawned **16 px ahead** of the player (`Player.as:996-1001`, `sprWand` 16 wide).
- Kill explosion radius on a Bob: max(8,8)·0.65 = 5.2 (`Enemy.as:205`, `Explosion.as`).

**Measured:** the Bobs move about 0.25 px/tick net. The player walks about 1.25 px/tick. From the L26 landing, both Bobs are within 80 px from tick 0, so they chase from the first tick.

**What the YES line does with each Bob:**
- **`bob@64,80`: one Wand hit, then overlapped while struck.**
  - The t44 shot spawned at x≈66.8, past the Bob's centre (60.2). So the knockback pushed it *west*, onto the player.
  - The trace shows the player box overlapping it **t47-t67, with `hitsTimer` 27→7**, never at 0, so no contact damage.
  - 0.5/3 hits; it is not killed.
- **`bob@48,64`: never struck, avoided.** It descends column 3 toward the player. Standing low in row 5 (y 90.5-92.2) and leaving x<57 by t66 keeps its box (bottom ≈ 87.5) off the player box.
- **Both held from t73.** The struck west flyer parks at (56,89) with body [49,63)×[82,96). That overlaps `bob@64,80` at (53.6, 91.6) and `bob@48,64` at (51.9, 83.5). Every 1-px step either Bob tries still overlaps the flyer, so the move is refused (`Bob.as:39` + `Mobile.as:90/107`).
  - They stay at exactly those positions from t73 to the door (t189).
  - This is what lets the line stop at (67.2, 88.8) for about 13 ticks to aim at the east flyer.

**Why the other Bob handlings failed:**
- **Kill:** see `bobkill1`. The Bobs close inside the 16-px spawn offset, so shots spawn past them.
- **Leash:** the player is never more than 80 px from a Bob on the west side.
- **Waiting:** see `wait30` / `wait60`. The same keys, delayed, meet the Bobs already at the row-5 spot.

## 4. Q4: the block

- **The YES line never touches the pushable block**: `pushableblock@80,64` is at (80,64) on every L25 tick of the trace.
- Row 5 at the player's y (88.8-92.5, box top ≥ 86.8) passes under the block's cell [64,80).
- Push detection is in `PushableBlock.as:39-56`: a player box one px off a face, moving into it. Its `solids` are Enemy and Player (`:28`).
- **Where a push is unavoidable** is the derivation's line, which crosses the band on **row 3**. That line ends in the pocket (5,3), whose only way on is down through the block. In its attempt A (replayed here, `runs/from-derivation-replay.log`):
  - The push from above moved the block (80,64)→(80,80) at t146-170.
  - A block at (5,5) stands in the only row-5 link between columns 4 and 6. Reading the grid (not measured push by push), every further push ends against a solid: rock2 at (5,6), the spire at (6,4), or the trees at column 8. So it seals the way east, which matches the derivation's "the route closed".
  - That attempt then took its hits (t273, t293) from Bobs that followed it into the pocket.

## 5. Q5: every attempt

**Conventions:**
- Flyer **W** is `wallflyer@48,48` (rest centre (56,55), ray x=56 straight down, `WallFlyer.as:59-68`). Flyer **E** is `wallflyer@64,48` (rest centre (72,55), ray x=72).
- "parks" means at rest at the bottom of row 5, y=89.
- The positions given are the player's, at the event tick.
- Logs are under `runs/`. The derivation's tapes are under `runs/from-derivation/`.

| attempt (tape / run) | line | result | contacts and launches |
|---|---|---|---|
| **`l25-26-22-wand`** (= E5) | §1.2 | **0 hits, L22 t189** | No contacts. W launch t64 (54.9, 90.5), parks t73. E launch t92 (71.3, 88.8), parks t101 |
| Sword keys, arm Wand (`l25-26-22-sword.replay.wand`) | the Sword plan's keys with the Wand | 1 hit | Hit t100 (54.2, 64.6, sampled after knockback): only W, at rest, is near. W launch t101 (the player was on its column in row 4) |
| Sword keys, no item | the Sword plan without the Sword | 2 hits | t73 (46.0, 92.4) and t93 (46.0, 97.8): both Bobs |
| E1 | shoot W from (49.7, 88.2), walk at y 88 | 2 hits, respawn | Hit t53 (54.6, 90.7): `bob@48,64` (box bottom 86.35 over player top 86.2). W launch t53. Hit t73 (58.3, 93.0): W parked, its 30 ticks over |
| E2 | facing bug: both shots went east | 1 hit, reached L22 t185 | Hit t70 (66.3, 92.3): W in flight (unstruck). W launch t63 (55.9, 90.3). E launch t73 (74.5, 92.3) missed: the hit's knockback sped the player |
| E3 | E2 timing (same facing bug) | 1 hit, reached L22 t178 | Hit t64 (66.3, 92.3): W in flight. W launch t57, E launch t67 |
| E4 | up shot from x=47.1 | 2 hits, respawn | The shot's box [45,48) missed W's body [49,63). Hit t59 (53.0, 90.7): `bob@48,64`. W launch t59. Hit t79 (47.7, 90.7): W parked |
| `wait30` (YES keys after 30 idle ticks) | wait out the chase | 2 hits | t76 (48.1, 92.2) and t100 (36.9, 92.2): Bobs already at the row-5 spot |
| `wait60` | the same, 60 ticks | 2 hits | t93 (45.9, 96.3), t130: Bobs |
| `bobkill1` (Bob-first: alternate shots at both Bobs while backing west, aiming at 6 hits each) | Bob-first | 2 hits | Struck `bob@64,80` once (t45). The up shot at t55 struck W instead: `bob@48,64` was below the 16-px spawn. The t77 and t91 shots spawned past both Bobs. Hits t93 (37.5, 90.6) `bob@64,80`, t130 (30.2, 98.1) Bob |
| `probe-doorkill` (stand at the landing facing east, shoot every 32 ticks) | Bob-first from the door | 1 hit, knocked into the L26 door t186 | Every shot dies on the rock at (3,6) (x≈47). Hit t182 (23.1, 104): Bob |
| derivation `l25-26-22-wand` (attempt 2, row 3) | derivation disarm spot | 2 hits | W struck at rest t84 from (41.9, 58.4). W launch t102, parks t111. E struck t121. Hit t145 (60.9, 58.4): `bob@48,64` at (52.4, 60.8), followed up to row 3. E launch t152. Hit t165 (74.4, 56.5): E |
| derivation `l25-26-22-wand-a` (attempt A, row 3) | derivation disarm spot | 2 hits | W struck t84, launch t102. E struck t121, launch t139. Block pushed t146-170. Hits t273 (78.9, 51.3) and t293: a Bob in the pocket |
| derivation `l25-26-22-none-control` | — | 2 hits | t96 (46.3, 58.4), t116 (44.2, 55.7): W at rest and `bob@48,64` |
| `l28-east`, `l28-above` | YES prefix, then the chest | 0 hits, stayed in L25 | YES-line launches. The chest stayed shut |

**Lines varied, as the brief asks:**
- The derivation's disarm spot (three tapes): NO, from Bobs and the block.
- Bob-first (`bobkill1`, `probe-doorkill`): NO, because the shots spawn past Bobs that close in, and the door spot is walled by a rock.
- Waiting out the chase (`wait30`, `wait60`): NO, because the Bobs never leash.
- The row-5 stun-and-park line: **YES**.

**Margins (the line is deterministic, but tight):**
- Shot 1's spawn box overlaps the Bob's box by about 1.7 px.
- Shot 2's box overlaps W's body by about 2.8 px.
- The Bob hold depends on W parking on both Bobs.
- `wait30` shows that the same keys 30 ticks late fail.

## 6. Q6 (sketch): what a general derivation would need

This is the ⚑ re-examine of the table's `reexamine`: data and source lines only, no literals.

The current derivation (`derive-seedling-wallflyer-nohit.mjs`) simulates flyers and the player only. Its "waiting spot" is a static pixel set. To reproduce L22, L25 and L27 from source with no per-room table, it would need the following.

1. **Every Enemy body in the room as state, not only flyers.**
   - The Bob step is already transcribed in `seedlingDemo/chasers.js`: home on the nearest player within `runRange` (`Bob.as:55-75`), no line-of-sight (`:59`).
   - Enemy-vs-Enemy blocking (`Bob.as:39` `solids` += Enemy, `Mobile.as:90/107`).
   - A waiting spot becomes time-dependent: off every ray **and** outside every chaser's reach at that tick. That makes it a search over (player, flyer configurations, chaser positions), not a static map.
   - L25's verdict turns on two effects: a parked flyer **holds** overlapping Bobs, and the line's timing comes from where the Bobs are, not from rays alone.
2. **Contact gated by `hitsTimer`** (`Enemy.as:24`, `:147-157`, `:211-219`): overlap is legal while it is above 0. The derivation has this for flyers. Bobs need it too.
3. **The arm's real geometry and timing:**
   - The shot spawns `sprWand.width` ahead (`Player.as:996-1001`), which gives a spawn-skip band.
   - The shot leaves at `wandEnd` (`:1056-1059`, the `sprWand` "wand" anim).
   - Facing comes from velocity, with x taking priority (`:1625-1646`). Under vector friction (`Mobile.as:73-80`), aiming up costs release ticks.
   - Knockback direction is away from the shot's point (`Enemy.as:247-254`), so a close shot pushes the Bob *toward* the player.
   - The derivation's "strike at rest from the west" is a sound disarm. L25 east needs strikes from **below**, from the two off-ray squares, because the bodies are adjacent: from the west only the west body can be hit.
4. **Flyer parked configurations as obstacles and re-aimed rays.**
   - A flyer at its far wall has its ray reversed (`WallFlyer.as:113-170`, `decideMotion` reads the wall mask).
   - Its body is a 14×14 Enemy box (`:38`) that blocks Bobs and, with the block, can seal a corner.
5. **Movable solids** (`PushableBlock.as:28`, `:39-56`, grid-snapped moves): a push changes the graph. L25's row-3 pocket shows a push can seal the only corridor. The L22 room also has one block, at `pushableblock@96,64`.
6. **Which rooms are affected:**
   - L22 (4 flyers, 1 Bob at (96,144), 1 block) and L25 (2 flyers, 2 Bobs, 1 block) need items 1-5.
   - L27 (1 flyer, no Bob, no block) needs only what the derivation has now. Its verdict, "both landings in one waiting-spot component", would not move.
   - The table's `reexamine` hint (a waiting spot off the ray at the far end of every flight) is necessary but not sufficient where chasers are present. A rule would add "and outside every chaser's reach-set over the wait".

## 7. If Robert says yes: the follow-up (sketch only, NOT made)

Adding the arm is a separate wired slice that needs Robert's word. What it would change:

1. **Plans file** `scripts/procgen/seedling-wallflyer-nohit-plans.json`: add `plans["l25-26-22-wand"]` and `controls["l25-26-22-wand"]` verbatim from `plan-l25-26-22-wand.json` (verified to play, §1.3).
2. **Gate table** `frontend/modules/flashPanel/seedlingNoHitDirectionalGates.json`:
   - L25's gate: `arms` gains `"hasWand"`, and `witness.arms.hasWand = "l25-26-22-wand"`.
   - The `unwitnessed` entry for L25 E `hasWand` goes, so the list becomes `[]`.
   - The `reexamine` sentence "it is NOT an arm of L25 east, which `unwitnessed` names" is rewritten.
   - The reader accepts that table: in the scratch worktree, 8/11 of the reader's own tests pass, including "every gate is accepted against its room, its bands and the witness plans".
3. **The one rule row, with its twins:** `level_25__r3c2 -> level_25__r2c7` goes from `Or(Sword, Ghost Spear, Shield)` to `Or(…, Wand)`, the same shape as L22's row. Measured, it lives in:
   - `frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json`
   - `frontend/presets/seedling_er/AP_1/AP_1_rules.json` (the `seedling_er` twin)
   - `frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json`
   - `frontend/presets/seedling_playthrough/AP_14089154938208861744/…_rules.json` (`HasAny`), and its sphere log only if a sphere moves
   - `worlds/seedling_playthrough/Rules.py:400-403`, plus `_worldgen_rules.json` and `_worldgen_sidecars.json`
   - It should come from regenerating with `scripts/procgen/make-seedling-playthrough-rules.mjs` (it reads the table: `:120-121`, `:748`), then `--check`.
   - `frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json` names the L25 sub-regions; check it on regeneration.
   - Seed-1 sphere moves: none expected, because `Progressive Sword` is sphere 1 (the derivation report §5). Not regenerated here.
4. **Pins that move**, measured by running the reader's test on the edited table in the scratch worktree (bounded vitest on that one file: 3 failed / 8 passed):
   - `frontend/modules/flashPanel/seedlingNoHitDirectionalGates.test.js:128-137` expects L25 east **not** to offer the Wand, and the unwitnessed entry. It flips to: L25 offers `hasWand` with witness `l25-26-22-wand`.
   - `:139-145` edits `t.unwitnessed[0]` to test the refusals. With the list empty it needs an in-memory unwitnessed fixture to keep those mutants.
   - `:183-…` ("each gated room is two sub-regions; one crossing costs the arm set") compares the committed `AP_1` row with the table. It goes green once the presets are regenerated.
5. **Docs/headers** that name L25 east's Wand as unwitnessed:
   - `seedlingNoHitDirectionalGates.js:28-29`
   - `probe-seedling-wallflyer-nohit.mjs:20-23`
   - `derive-seedling-wallflyer-nohit.mjs:12`
6. **Train-tier cross-check** (`derive-seedling-wallflyer-nohit.train.test.js` → `--check`): it requires every arm the table offers to derive a LINE. The derivation derives the Wand LINE on L25 W→E (derivation report, `runs/full.log`). So the expectation (no DISAGREE) should hold unchanged, and the INFO row "named unwitnessed" becomes an `AGREE arm hasWand` row.
   - **Measured.** I edited the table and the plans file as in items 1-2, in a scratch worktree, and ran `node scripts/procgen/derive-seedling-wallflyer-nohit.mjs --check` (9 min 19 s, `runs/derive-check-with-l25-wand.log`).
   - It printed `AGREE L25 [26] -> [22] (E): table gated [hasSword, hasSpear, hasShield, hasWand]` and `AGREE arm hasWand: table offers it (witness l25-26-22-wand), derived LINE`, then `PASS: the gate table agrees with the derivation on every wallflyer crossing (4 crossings, 2 info)`.
   - So the train-tier test's expectations do not move.
   - The same run lists L25's L28 side as "not joined even with no flyer: no wallflyer question", which agrees with §1.4.

## 8. Notes

- **New tools in the evidence dir** (not enrolled in any roster):
  - `witness2.mjs`: the derivation's `witness.mjs` plus a page-side per-tick sampler of `botStatus` + `botMobiles`, with `--arm=` / `--drop=` for controls.
  - `segtape.mjs`, `run.sh`, `show.mjs`.
- `from-derivation/` holds unchanged copies of the derivation slice's tools, tapes and logs.
- **CI:** no dispatch, no tape batch. Every run was in this container, against the dev server on 8000.
- **No unfiltered vitest.** The only vitest was one explicit file, in the scratch worktree.
- **Scratch worktrees** were used for the probe check and the reader-test check and then removed. The only paths this branch adds are the evidence dir and this report.
