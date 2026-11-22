# cloud-report — rules-wand-chaser-killarm-census (REPORT ONLY): does the Wand really clear the chasers rule K guards?

Branch `claude/wand-kill-arm-census-poqkkd`.
- **Base:** `git rev-parse origin/main` = **`f96d6b66254cd8c2dd08323a489d5d1f07525600`** (it carries 3c602f965d, rule K + (b)).
- **Setup:** `session_bootstrap.sh --seedling` reached READY. The six submodules are initialised; no pointer moved. Host settings: `minimal-spoilers`. Dev server: `serve-nocache.py 8000`.
- **Game:** every verdict is the wasm runtime `seedling_bot_ap_p4g` on the DELIVERED set (`seedling-vanilla-record-23510f80`). It ran headless logic-only (asserted every run), with a FRESH page per tape and never `noDamage`.
- **Slot array:** every tape is staged by `arrivalStaging` with only the row's grants. The game's own `inventory_slots` read `[2]` (the Wand) with `primary 0`, and WandShots spawned on every press. So the equip index names the Wand: the slot trap does not apply.
- **Scope:** this slice changes no rule, preset, atlas, table, solver, levelRun, `CONTACT_FIDELITY`, level data or engine closure. The Q4 patch was applied, measured and reverted; `git status` was clean after it.

Evidence: `CC/docs/cloud-reports/rules-wand-chaser-killarm-census-evidence/` (tools, tapes, runs; index at the end).

## Answer

**Does the Wand kill each K-guarded class before contact?**

| class | Wand | Fire Wand | basis |
|---|---|---|---|
| **lavarunner** (the only class K guards after (b)) | **LINE-DEPENDENT, mostly NO as a kill.** Shooting at an open approach, the ports give CONTACT before the 4th hit, standing or retreating (Q1). One game run killed `lavarunner@80,216` on L72 hit-free (hits t25/t97/t129/t161), but that run was overwritten while the tool was calibrated and is **not preserved** (UNWITNESSED in the kept evidence). Every kept Wand GAME YES row crosses **without** a Wand kill (below). | **LINE-DEPENDENT, kills.** The ports give KILL first on every line (2 hits). The game killed runners on several tapes (e.g. L80 L71→chest k20: `@80,32` killed t49; first player hit t244) | Q1, Q2 |
| puncher (dropped by (b)) | source only: 6 hits (hitsMax 3 / 0.5), no knockback, slower than the player | 3 hits | Q1 (UNWITNESSED; the item-less crossings are GAME YES, witness slice) |
| drill / teleport-hopper (dropped by (b)) | source only: a hit freezes it (its "hit" anim, no hop), and its leash (48) is inside the shot's reach (≈63) | the same | Q1 (UNWITNESSED; item-less GAME YES, witness slice) |

**How the Wand gets the player past a runner: it does not need to kill it.** `Enemy.hitPlayer` needs `hitsTimer <= 0` (`Enemy.as:211-221`), and every landed hit arms `hitsTimer = 30` (`Enemy.as:153-157`). So one Wand hit makes the runner **harmless for 30 ticks**, and the player walks past it. The kept YES lines do that, and L72's lava chains then kill or hit the other runners (`LavaChain.as:84-87` hits Enemies too).

**Per Wand-admitting K row (Q2):** lines = distinct game tapes played. YES = 0 hits, 0 restarts, goal reached (a sub-region goal must also HOLD to the tape's end).

| row (rule pairs) | Wand alone (+ pair) | Fire Wand (+ pair) |
|---|---|---|
| L72 L71→L73 | **GAME YES**: `q2/L72-71to73-wand-k20-1`, out at **t591**, 0 hits. One shot lands at t25 on `@80,216` (9.3 px at t26, harmless). The chains hit `@136,88` (t40) and kill it (t400); they hit `@216,240` at t220. 4 lines | UNWITNESSED: 4 lines, all hit at t58 (runner 13 px) |
| L72 L73→L71 | **GAME YES**: `q2/L72-73to71-wand-k20-0`, out at **t625**, 0 hits (also `-k20-1` t624). 4 lines | UNWITNESSED: 4 lines, hit at t54 |
| L73 L72→L74 (Suit & Wand) | UNWITNESSED: 8 lines, all hit at t132 by `lavarunner@32,24` (11.4 px) | **GAME YES**: `q2b/L73-72to74-firewand-k6-0`, out at **t183** |
| L73 L74→L72 (Suit & Wand) | UNWITNESSED: 8 lines, hit at t86 (runner 13.9 px) | UNWITNESSED: 4 lines, hit at t70; the runner `@40,32` dies the same tick (hits t41, t70) |
| L74 L73→L75 | UNWITNESSED: 4 lines, hit at t227 (runner 10.7 px) | UNWITNESSED: 2 lines, hit at t55 |
| L74 the Darkshield | **GAME YES**: `q2/L74-73toShield-wand-k20-0`, on the shield tile (3,2) at **t207**, 0 hits, held. 7 of 8 tapes agree. ⚠ `inputVerdict` reads `dies`: a `dead_frames` rise with no hit and no respawn, which I read as the pickup freeze (as for the witness slice's L40 totem) | UNWITNESSED: hit at t55 |
| L74 L75→L73 | UNWITNESSED: hit at t69 by **`bulb@48,112`** (10.5 px; not a K body) | the same |
| L75 L71→L74 | UNWITNESSED: no line reached L74 (the model found no route); one stalled hit-free to t1630, the other was hit at t1606 | the same |
| L75 L74→L71 | UNWITNESSED: 4 lines, hit at t85–102 (runners 7–14 px) | UNWITNESSED: hit at t114 (both runners killed t130/t134, after the hit) |
| L77 L78→L76 (Suit & Wand) | UNWITNESSED: 8 lines, hit at t25 / t57 (runners) | UNWITNESSED: hit at t56 |
| L77 L76→L78 (Suit & Wand) | UNWITNESSED: 8 lines, hit at t279 (5.2 px) or not reached | UNWITNESSED: hit at t280 / t291 |
| L78 L77→L79 (Suit & Wand) | UNWITNESSED: 8 lines, hit at t100–101 | UNWITNESSED: hit at t102 / t116 |
| L78 L79→L77 (Suit & Wand) | UNWITNESSED: 8 lines, hit at t190 / t308 or not reached | **GAME YES**: `q2b/L78-79to77-firewand-k20-0`, out at **t285** |
| L78 r0c16→r6c11 (Wand, suit-less) | UNWITNESSED, cause **lava**: every line (6, both columns) dies standing at (255,54), the (15,3) lava edge, t60–88. 0 hits, **0 trap pulls**: the closest approach to (9,3)'s centre is 93.6 px, and the respawn at t88 is the only fast move. Not a chaser NO, not a trap NO | the same |
| L80 L79→L71 (Suit & Wand) | **GAME YES**: `q2/L80-79to71-wand-k20-0`, out at **t256** (also `-k6-0` t245) | **GAME YES**: `q2b/L80-79to71-firewand-k20-0`, t256 (4 of 4) |
| L80 chest from L71 (Suit & Wand) | UNWITNESSED: 4 lines, hit at t86 / t94 | UNWITNESSED: hit at t175 / t244, after a Fire Wand kill of `@80,32` at t49 |
| L80 chest from L79 (Suit & Wand) | UNWITNESSED: 4 lines, hit at t186–211 | UNWITNESSED: hit at t201 / t222 |
| L99 r7c5→r8c10 | **GAME YES**: `q2b/L99-r7c5tor8c10-wand-k20-0`, on (10,8) at **t55**, held, 0 hits (8 of 8) | **GAME YES** (4 of 4) |
| L99 r7c5→r2c7 | UNWITNESSED: reached at t112 but hit at t132 / t137 (NO-hold) | the same |
| L99 r7c5→r6c12 | UNWITNESSED: reached at t88 but hit at t94 / t107 | the same |

**No Wand-admitting row is GAME NO.**
- A NO needs every reasonable line to fail. Here only 2–8 search-chosen lines per row were played, and most failed where the game drifted from the search model mid-route, not on a duel the line was built to win.
- So **no K row is shown LOOSER than the game**. The Wand is GAME YES on **6 rows**: L72 both ways, the Darkshield, L80 L79→L71 and L99 r7c5→r8c10. It **also clears a runner by the `hitsTimer` pass** on every row where it touched one.

**Q3 (the census arm probe):** it agrees where it reaches, and it measures a different line.
- It stands still in the pocket, behind a lock, and the Wand opens no kill-lock it was asked about (L60 W, L71 N/S; and with `--include-fired` L18 W, L26 W, L53 N, L99 E).
- That is a KILL-ALL test, not a crossing. A body that waits is never shot clear of the room.
- K's rows are crossings, where the Wand's 30-tick pass is enough.

**Q4 (the chaser arm without the Wand):** the route walk moves **16 routes, all CHG, equal in AP_1, `seedling_er` and the maze**. Each drops only `Wand` / `Dark Suit & Wand`; no route moves outside L72–L80, and no L99 route moves.
- Q2 says YES on 3 of those routes (L72 ×2, L80 L79→L71) and on the Darkshield location (also in the 16).
- So the patch would be an **over-charge at ≥ 4 GAME YES routes**. Q2 shows no route where it would be needed.
- **No general term is offered.** The YES lines are not kills (a `hitsTimer` pass, plus L72's chains), so "kill time vs closing time" would drop the Wand on exactly those rows. A term that sees the pass needs the route's other bodies and timing, which is a per-room witness, not a class constant. **Not general; not recommended.**

## Q1 — per class, from the source; numbers from the ports

**The Wand** (`Projectiles/WandShot.as`, `Player.as:994-1002,1056-1060,1586-1601`):
- The shot spawns `sprWand.width` = 16 px ahead (17 for the Fire Wand) at the anim's end.
- That is press + `WAND_WINDOW.fireTick` = **7**, with a press cadence of **8** ticks (`wandVerb.js`); the game agreed (shots every 8 ticks, spawned at player + 16).
- It flies 3 px/tick for `lifeMax = 3·16/3` = 16 ticks (`:66`), so its reach is **≈63 px** from the player's centre (game: spawn x 41.7 → dies x 89).
- It travels cardinal only, in `direction` = the sign of the player's velocity (`Player.as:1625-1646`). So "retreat while shooting" needs a one- or two-tick turn before each shot.
- It stops at `Solid`/`Tree`/`Rock`/`Rope`/`ShieldBoss` and at **any** `Enemy` (`:69`, `Mobile.as:17`).
- Lava is a `Tile`, not a solid, so **a shot crosses lava** and reaches a body standing in it.
- Damage is **0.5** (Wand) or **1** (Fire Wand, `:53-58`); force **3** (`:24`).

**`Enemy.hit`** (`Enemy.as:141-181`):
- A hit lands only at `hitsTimer <= 0`, adds `d`, and arms `hitsTimer = 30` (`hitsTimerMax`, `:24`).
- It knocks back with `v += f·unit` (away from the shot), **unless the hit kills**.
- A shot arriving during the 30 ticks is spent for nothing.
- `hitUpdate` counts the timer down only while the body is on screen (`:64-67`).

| | lavarunner | puncher | drill |
|---|---|---|---|
| hitsMax | 2 (`LavaRunner.as:41`) | 3 (default, `Enemy.as:22`) | 3 (default) |
| shots to kill, Wand / Fire Wand | **4 / 2** → the kill comes ≥ 90 / ≥ 30 ticks after the first hit | 6 / 3 → ≥ 150 / ≥ 60 | 6 / 3 → ≥ 150 / ≥ 60 |
| knockback per landed hit | v += 3 away. Bob's next impulse adds `moveSpeed` toward the player each tick, and `pushed` keeps it from being renormalised (`Bob.as:61-69`), so the push is short (ports: ≈31 px of closing per 30-tick cycle on floor even so) | **none** (`Puncher.as:167-170`) | **none** (`Drill.as:47-50`); while `hitsTimer > 0` it plays "hit" and **does not hop** (`:62-65`): a stun |
| harmless while hit | yes: `hitPlayer` needs `hitsTimer <= 0` (`Enemy.as:213`) | yes (`attackPlayer` returns at `hitsTimer > 0`, `Puncher.as:172-176`) | yes |
| shot reaches it in lava | yes (lava is not a solid). Runners stand and swim in lava (`dieInLava = false`, `:38`) | n/a | n/a |
| speed while hit (ports, px/tick per axis) | walk 1.25, swim 0.75 (`chasers.chaserStep`, `bodySpeedOn`); the knockback is net of that | 0.75 | 0 (stunned) |
| player speed (`playerPhysicsV1.step`, `playerSpeedOn`) | 1.1746 walk | | |
| leash `runRange` | 80 (`Bob.as:21`) | 80 (`Puncher.as:22`) | **48** (`Drill.as:18`): inside the shot's reach |

**Closing time vs kill time** (`tools/q1/duel.mjs`, open plane, the ports only). The runner wakes at 80 px; the player stands on floor and fires at the cadence.

| runner on | arm | line | landed hits (tick @ gap) | result |
|---|---|---|---|---|
| floor (walk) | Wand | stand | t18 @57 px, t48 @26 px | **CONTACT t78** (the 3rd hit would be due at t78, but the runner overlaps the player, inside the 16 px spawn offset) |
| floor | Wand | retreat-and-turn /16, /24, /32 | t18, t55 | **CONTACT t64–85** |
| floor | Fire Wand | stand; retreat /16, /24 | t17, t47 (or t55) | **KILL t47–55** |
| floor | Fire Wand | retreat /32 | t17 | CONTACT t64 |
| lava (swim) | Wand | stand | t20 @64, t54 @45, t88 @26 | **CONTACT t120** (the 4th hit would be due t≈118–122) |
| lava | Wand | retreat /16, /24, /32 | three hits to t103 | **CONTACT t133** |
| lava | Fire Wand | all four lines | 2 hits | **KILL t53–73** |

So the Wand loses the straight duel to a lavarunner on these lines. The runner closes the 63 px reach in about two 30-tick cycles; the Wand needs three. Where the Wand wins in the game, it is by the 30-tick pass, by terrain, or because the chains help. The drill is a Wand win from the source alone: it can be shot from outside its 48 px wake range and is stun-locked by the 30 ticks. The puncher is slower than the player (0.75 < 1.17), so a retreat line has time for 6 hits. Neither is witnessed here: (b) drops both from K, and their item-less crossings are already GAME YES (witness slice).

## Q2 — how the tapes were made

- **The witness lines are searched, not hand-typed.** `levelRun` throws when a wand shot reaches a chaser (`applyWandShotToBoss`: only the boss totem is modelled), so the solver cannot choose Wand keys.
- `tools/wand/wsim.mjs` is a screening model built from the repo's ports:
  - `playerPhysicsV1.step` against the room's solids, with its terrain probe (`CHECK_OFFSET_Y`);
  - `chasers.chaserStep` with axis-separated moves against the solids and the other runners' boxes, the speed per tile, and an on-screen gate;
  - `wandShot.createWandShot`/`stepWandShot` with `Enemy.hit`'s gates;
  - `lavaChain.stepLavaChain`/`lavaChainRect` for the chains' strike on the player and on runners;
  - every other exit, trap disc, bulb, grenade and axe as a no-go zone.
- A beam search over key segments with presses gives 2 lines per score weight per row. **The game decides every verdict** (`tools/wand/wplay.mjs`, 3 pages at a time).
- **Calibration** (`runs/game/calib/`): the model tracked the game within ≈1 px for 140+ ticks on L72 (`tools/wand/wcmp.mjs`).
  - The chain clock offset was fitted on the game. Offset 18 reproduces the player strike by `lavachain@160,144` at t403. Offset 19 reproduces the chain hits on L72's `@136,88` (t40) and `@216,240` (t405) within 2 ticks.
  - The chain screen uses the union of offsets 14/18/22.
- **Two search rounds:** `tapes/q2` (Wand), then `tapes/q2b` (both columns, with exits as no-go zones; the first round's L99 and L77 tapes walked back out at t7 / t14).
- **The verdicts per run** are `runs/q2-goalcheck.txt` (`tools/wand/goalcheck.py`), and the row table is `runs/q2-table.txt`.
- **Why so few NOs.** A NO needs every reasonable line NO (leash-edge stand, retreat, cover). These searched lines are a few per row, and the failures are mostly drift from the screening model's unmodelled bodies: bulbs, grenades, axes, the chain kills' timing. So every non-YES cell is UNWITNESSED, by the brief's own bar.

## Q3 — `probe-seedling-killlock-arms.mjs`

- **`--arms=wand`** (`runs/q3/arms-wand.log`): **ALL CHECKS PASSED.** VERDICT: L60 W `shut: [wand]`; L71 N and S `shut: [wand]` (L71's bodies are lavarunners).
- **`--arms=wand --include-fired`** (`runs/q3/arms-wand-include-fired.log`): VERDICT `shut: [wand]` at L18 W, L26 W, L53 N and **L99 E**.
  - **6 CHECK(S) FAILED**, all in the CLEAR/RETURN legs of L18 and L99. In those, the probe's room-side Sword clear did not empty the roster (`kills: []`). That is the instrument's clear side, not a Wand row. The probe's own record notes those legs are cut on purpose in its `--include-fired` runs.
- **Agreement with Q2:** on L99 the probe says the Wand alone never empties the room from the E pocket. Q2 does not contradict that: no Q2 line killed L99's three runners either.
  - Q2's L99 YES (r7c5→r8c10) is a crossing, not a clear. The two L99 rows that fail (r2c7, r6c12) fail on a runner reaching the player after arrival.
  - **The difference is the chase**: the probe's bodies wait at a lock, while K's bodies come at a moving player, who can take the 30-tick pass. L71/L60/L18/L26/L53 are not K rows.

## Q4 — the throwaway patch and its movers

- **Patch:** `tools/q4-chaser-arm-no-wand.patch`. `killArmOf` (`scripts/procgen/seedlingChaserPursuitGuard.js`) defaults to the census arm minus `{flag: hasWand}`. The kill-lock census's own rows keep `KILL_ARM_CONDITION`.
- **Measured** as `regen-seedling --write` with the derived-rule table set aside, **at base and at patch alike**. The table-aside artifacts are therefore in both and cancel out.
- Base: `runs/q4/regen-base.log`; patch: `runs/q4/regen-patch.log`. Both: every step WROTE; `census` STALE on the frontier `sources` md5, as in the K resume.
- **Reverted:** `git checkout` of `frontend worlds` and the guard, and the table restored; `git status` showed only evidence.
- **Route walk:** `tools/routeWalk.py` (the K resume's), `runs/q4/route-diff-{seedling_playthrough,seedling_er,seedling_playthrough_maze}.txt`. The three files are byte-identical. **MOVED ROUTES: 16, all CHG, all dropping `Wand` (or `Dark Suit & Wand`):**

| route | base → patch |
|---|---|
| L72 L71→L73, L73→L71 | `Spear \| Shield×2 \| Sword \| Wand` → without `Wand` |
| L73 L72→L74, L74→L72 | `Suit&Shield×2 \| Suit&Wand \| Spear \| Sword` → without `Suit&Wand` |
| L74 L73→L75, L73→Darkshield, L75→L73 | the arm → without `Wand` |
| L75 L71→L74, L74→L71 | the arm → without `Wand` |
| L77 L76→L78, L78→L76 | `Suit&Shield×2 \| Suit&Sword \| Suit&Wand \| Spear` → without `Suit&Wand` |
| L78 L77→L79, L79→L77 | the same |
| L80 chest from L71, chest from L79, L79→L71 | `Suit & (Spear \| Shield×2 \| Sword \| Wand)` → without `Suit&Wand` |

- **Not in the route walk:** L78 r0c16→r6c11 is internal to L78, so it is not an AP route. No L99 route moves; its rows are internal.
- **Against Q2:** the patch would refuse four Wand lines the game allows: L72 ×2, the Darkshield, and L80 L79→L71. That is stricter than the game ("stricter, never looser" allows it), but it has no witnessed need. **Recommendation: keep the Wand in K's arm.**

## Findings for the planner

1. **No K row is LOOSER than the game on the Wand.** No Wand-admitting row is GAME NO (no NO meets the every-line bar), and 6 rows are GAME YES with the Wand (5 with Wand alone + its pair). No fix is sketched; Q4's removal would over-charge ≥ 4 YES routes.
2. **The Wand's way past a runner is the `hitsTimer` pass, not a kill.** One landed shot makes a runner harmless for 30 ticks (`Enemy.as:213`). A kill-time-vs-closing-time term (Q1) says the Wand loses the straight duel, so such a term would be **wrong** at the YES rows. Not general.
3. **L78 r0c16→r6c11 suit-less (Spear/Sword/Wand/Shield×2 derive):** every played line, both columns, dies on lava at (255,54), the edge of (15,3), before any trap or runner. It took 0 hits and 0 trap pulls (closest to (9,3) 93.6 px), and the screening model also finds no suit-less way out of the (16,1) pocket. **UNWITNESSED, cause "lava".** This is worth a reachability check of its own: whether that row's suit-less sets have a lava-free way at all.
4. **L72's lava chains hit and kill runners** in the game (`LavaChain.as:84-87`), on a clock the model can fit (offset 18–19 against the seam time). A crossing's runners are not independent of its hazards; the Fire guard's and K's arms both ignore that, the strict side.

## Stops checked

- No rule, preset, atlas, table, solver, levelRun, `CONTACT_FIDELITY`, level-data or engine-closure change is committed. The Q4 patch is a `.patch` file in the evidence, reverted after the measurement.
- Nothing is edited in `worlds/seedling/`, `vendor/seedling`, `.github/` or any submodule pointer.
- No unfiltered vitest was run (no vitest at all: this slice adds no test). No CI dispatch.
- Tools and evidence live only under the evidence dir.

## Evidence index (`rules-wand-chaser-killarm-census-evidence/`)

| path | what |
|---|---|
| `tools/q1/duel.mjs` | Q1's duel on the ports (the table above) |
| `tools/wand/wsim.mjs` | the screening model + beam search (emits tapes on the arrival staging) |
| `tools/wand/wplay.mjs` | plays tapes on the game; per tick: player, every enemy's `hits`/`hits_timer`/anim, every shot |
| `tools/wand/wsum.py`, `wcmp.mjs`, `goalcheck.py` | run summary; model vs game per tick; the per-run goal verdict |
| `tools/wand/rows.json`, `batch.sh` | the 20 rows (boot landing, goal, pair) and the search batch |
| `tools/chase/`, `tools/*.mjs` (from the l77 witness slice), `tools/routeWalk.py` (K resume) | reused tools |
| `tools/q4-chaser-arm-no-wand.patch` | Q4's throwaway patch |
| `tapes/q2/`, `tapes/q2b/`, `tapes/wsim/`, `tapes/probe1/` | every played tape (round 1, round 2, the calibration and the L72 YES, the first probe) |
| `runs/game/{q2,q2b,wsim,calib,probe1}/*.game.json.gz` | per-tick game reads per tape |
| `runs/q2/play-wand.log`, `runs/q2b/play.log`, `runs/q2*/*.wsim.log`, `runs/batch-*.txt` | game ROW lines; search logs |
| `runs/q2-goalcheck.txt`, `runs/q2-table.txt` | the per-run verdicts and the row table |
| `runs/q3/` | the two probe runs |
| `runs/q4/` | regen logs, the AP_1 rules at base/patch for the three presets, the three route diffs |
