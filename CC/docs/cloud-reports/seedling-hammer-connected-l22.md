# Seedling hammer-phase: CONNECTED-L22: why the connected bot's L22 → L29 exit refuses

Slice `seedling-hammer-connected-l22` (LOCAL, Opus, measure first). Evidence: `seedling-hammer-connected-l22-evidence/`
beside this file.

## 1. SHAs

- Base: `a3a5b8182e` (origin/main, `train: content-r4 0f817667ad`). The acceptance-md5 baseline.
- Branch `hammer-connected-l22`: `b335c63f2d` capture + replays, `b15d94a1b9` the switch, `fca23e3318` census, then
  the commit that carries this report.
- Page under test: the `sdc-connected-events` worktree at `51ee582a1f` (= this base + the unlanded connected-events
  fix, which is what the evidence's f6 run used). Its `seedlingDemo/` is identical to this base.

## 2. The answer

**It is not a wall or a missing item. The walk dies in a loop.** The corridor from L25's door to the L29 exit crosses
L22's wallflyer band. The corridor probe does not price wallflyer contact (`corridorBodyPricing` is OFF on main), so it
certifies the corridor. The drive then takes three wallflyer hits, dies, respawns at L25's door and walks the same
corridor again. In captured request #49 that happens **9 times inside one solve**. Each attempt ends at the 400-tick
bound, and the refusal calls it a *stall "after grazing N solids"*. The solids it names are the trees and rocks by the
door, which the respawned player brushes on the way back. They are not what stops it.

**Staging is faithful (not (a)).** The slot holds **Ghost Spear**, Fire, Purple Key and 6 Seals, with no Sword or
Shield. A node-built offline arrival with the same items, through `canCross` from L25's door, stalls at the SAME
coordinates `(57.37568056970543,132.60385297831334)` as the captured request.

**Classification (b), hammer.** Two gaps:
1. **Honesty gap (fixed, switch OFF):** a non-drowning death on a walk is invisible to the solve.
   `SEEDLING_WALK_DEATH_REFUSED=1` names it.
2. **Arm gap (not built):** the user ruled on 2026-11-11, from game witnesses, that Sword, Ghost Spear and Shield each
   give a hitless line south → north. The solver has no **spear** arm here: `strikePolicyFor` returns null without a
   sword. With the spear it refuses, with or without dash and with or without `corridorBodyPricing`. A sword flag alone
   solves the captured request (229 ticks, the seed-1 sweep's own plan).

**Rules note.** On main, `level_22 -> level_29__r2c2` is `True_`. The directional gate
(`level_22__r8c0 -> level_22__r0c6`: `HasAny(Ghost Spear, Progressive Shield, Progressive Sword)`) is on the
**unlanded** `land/rules-no-hit-2` branch. This slot holds the Ghost Spear, so it satisfies that gate. Landing the gate
would therefore **not** remove this request from logic: the hammer still owes the spear line.

## 3. Reproduction

- Room f6 (`AP_00679259829289197625.archipelago`, copied to scratch) on upstream `~/CC/ap-upstream-seedling`
  MultiServer, port 38470, `SKIP_REQUIREMENTS_UPDATE=1 --disable_save`. The embedded data package served the room, and
  `custom_worlds/` was not touched. Dev server: `python3 -m http.server 8150` in the sdc worktree.
- Probe: the evidence's `probe.mjs` / `play.mjs` / `steps_bot.mjs` / `steps_full.mjs` (copied to `probe/`), plus
  `probe/steps_cap.mjs`. That is the L6 slice's capture hook with **realm-agnostic** Map/Set tagging
  (`Object.prototype.toString`), so `source.records` (116 levels) survived this time.
- **Two connected runs:**
  1. **Invalid.** The page took RoomInfo and never sent `Connect`. `__lines` stayed empty and the bot stepped against
     the boot Adventure doc. The suspected cause is a late boot-time connect superseding the probe's
     (`apClient.connect`'s generation check closes the earlier socket silently). Not proven. Run 2 added a 15 s settle
     (`CONNECT_SETTLE_MS`) and an abort when the server rules don't load. The server was restarted for a clean room.
  2. **Reproduced:** 6/48 at 575 s, `statusAtEnd` stalled at `(61.820389679067425, 132.31640171274313)`, word for word
     the evidence's. The route was L21 → L22 → L25 (Level 025 - Chest) → back into L22 at (24,136) → seven L22
     requests. #49–#52 are the refusals, at work units 33/31/33/31.
- Both servers stopped by PID. The public IP that MultiServer prints is redacted in the committed logs.

## 4. Request facts (#49; `captures/cap_conn_L22_49.json`)

| field | value |
|---|---|
| `staging.boot` / `live` | L22 (16,128) / (24,136), i.e. L25's door |
| `seam.items` | `hasSpear`, `hasFire`, hitsMax 3. No sword, no shield. `primary` 0, slots [1,3] (Fire, Spear) |
| `save` | keys [2], seal_parts 0–5 |
| `persistence` | L5/0, L8/0, L8/1, L3/0, L0/1, L44/0, L12/2 |
| `solverGoal` | reach-exit (192,64) → L29 |
| `budgetWork` / passes | 640 / `{attempt: {retry: 0, budgets: [640]}}` |

The client's inventory at the end agrees: Ghost Spear 1, Fire 1, Purple Key 1, Seal 6, and the L0 flag-1 event.
The Sword in this room is Questy's (APQuest "Top Left Room Chest"). Sprout's swords are at L38 and L42, past this point.

## 5. Node replay and classification (`replays/`)

`replay.mjs` runs `solveAnytime` as `jsRuntimeSolveWorker` does, on the CAPTURED records.

| request / variant | answer | work |
|---|---|---|
| #49 as captured | refusal, **byte-identical** to the page's (627 chars) | 33 (= page) |
| #50 as captured (from (88.2,99.2)) | refusal, byte-identical (661 chars) | 31 (= page) |
| #49, `budgetWork` 2560 | the same refusal | 33 (the budget is not what ends it) |
| #49 + `hasSword` | **solves**: verbs [walk], 229 ticks | 92 |
| #49 + `hasShield` | refusal (waypoint 2 (120,88) "stall") | 43 |
| #49 with the spear or fire removed | refused by `levelRun`'s slot guard (the slots still hold them): not a valid variant | 0 |
| #44 (the earlier L22 → L25 westbound) | solved, 240 ticks, **2 wallflyer hits**, 0 deaths | 11 |
| #49, switch ON | refusal: *"the player DIED at run tick 104 in level 22 (4 death(s) on the walk; the hits before the first: wallflyer@48,112 at t64, wallflyer@128,80 at t84, wallflyer@128,80 at t104)…"* | 16 |

The +sword replay's own re-check trips a Fire press: the flag was added without a slot, so the plan's strike presses
go to slot 0, which holds Fire. This is an artefact of the variant, not a finding.

**The death loop, measured** (`trace/r49_deathtrace.txt`). The trace comes from temporary `L22DBG` prints in `drive`
and the attempts loop, kept as `trace/l22dbg-temporary-instrumentation.patch` and reverted. Attempt 0 plans
`[(72,136),(88,88),(120,88),(120,72),(200,72)]` from (24,136). The player dies at t67, 148, 240 and 328 (attempt 0),
and at 10, 100, 189, 270 and 360 (attempt 1, re-planned from wherever the respawn left it). Every death follows three
hits from `wallflyer@48,112` (the first death also from `@128,80`). After each death the player is back at (24,136).

**`canCross` (offline-built arrivals, same answer shape):**

| arrival | items | dash `none` | dash `all` (default) |
|---|---|---|---|
| L25 door | none | cannot (death loop) | cannot (death loop) |
| L25 door | spear | cannot (death loop) | cannot (death loop) |
| L25 door | sword | cannot (death loop) | **can**: 229 t, rung avoid, **1 hit** |
| L30 door | none / spear | cannot (death loop at (112.98,89.56)) | cannot |
| L30 door | sword | cannot (wp 1 (120,72)) | — |
| L30 door | shield | **can**: 210 t, rung detour, **2 hits** | — |
| L25 door, `corridorBodyPricing` ON | none / spear | cannot, honestly: *"combat ladder EXHAUSTED … enemy:wallflyer@48,112"*. With the spear it is modelled as a *static* body | — |
| L25 door, `corridorBodyPricing` ON | sword | cannot: ladder exhausted on `chaser:wallflyer@144,112` | — |

So the spear never helps: `strikePolicyFor` (`solverBot.js:6605`) returns null without `hasSword`/`hasGhostSword`,
so neither the walk's opportunistic strike nor a dash swing exists for a spear-only slot. The game witnesses a spear
line (`l22-25-29-spear`, rules-no-hit-directional). **Owner: hammer**, and it is not cheap. A spear strike arm against
wallflyers is a rung, not a switch.

## 6. Change: `WALK_DEATH_REFUSED` (`SEEDLING_WALK_DEATH_REFUSED`, OFF)

`solverBot.js`: `refuseIfDrowned` (seedling-fidelity-residue D-B) already refused a walk a whirlpool drowned, with
*"a walk that died is refused, not re-planned from the respawn"*. ON, every other death does the same. The first death
since the walk began refuses, naming its tick, the number of deaths and the last 3 hits before the first death
(`obstacle: {kind: 'death', id}`). The verdict stays a refusal. The switch changes the words and stops the re-plan from
the respawn (work 33 → 16 on #49). It does not make a crossing solvable. `WALK_DEATH_REFUSED.refused` collects a row per
refusal. The name is added to `SOLVER_ENV_NAMES`, so a page or CI sweep can carry it.

- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` =
  `391322d681b7aa0229d94b3f6906d024` on base, on the change OFF, and on the change ON.
- **Pin:** `hammerWalkDeathRefused.test.js` (3 rows: the switch and channel name; OFF the stall words; ON the death
  words + cause + rows). Bounded run with `solverEnvChannel.test.js` and `seedlingCanCross.test.js`: 3 files, 31 tests
  green. The first draft of my own new pin failed (it expected one `refused` row and got two, because the attempt's
  catch and `walkTo`'s wrapper each refuse once, as a drown does). The pin now asserts ≥ 1 row.
- Not done: refusing *inside* `drive` at the death tick. Today the attempt still runs to its 400-tick bound before the
  catch names the death, which is why the count reads "4 death(s)". That would be more invasive (`botDriverV2.js`).
- ⚠ A plan that dies deliberately (a restart warp) would be refused ON. That is one reason it ships OFF.

## 7. Census (`census/`)

Shape: *"waypoint N … not reached within K ticks; stalled at … after grazing"*.

- **Vanilla survey** (CI 43263653105, 2026-11-12, 244 steps; 43263949170 the same): 2 rows. Re-run here as single
  steps (`survey-seedling-route.mjs --through=end --only=<n>`), OFF and ON:
  - **step 150 (L43, wand stance for `magicallock@144,112`) is a second hidden death loop.** ON: *"the player DIED at
    run tick 237 in level 43 (2 death(s)…; bosstotem@152,168 ×3)"*. OFF it reads as a stall grazing `tile:Blue Wall`.
  - step 114 (L58, `yeti@56,56`) is a true stall: 400 grazes at one point, unchanged ON.
- **Seed-1 divergence sweep** (CI 42311570470, 930 rows, 2026-11-06, the newest full one on disk): 2 rows, id 352
  (`level_37__r0c18 -> level_38`, hermit) and id 704 (`level_88 -> level_12__r0c19`, tree). **Not re-run** (no local
  sweeps). A CI dispatch with `SEEDLING_WALK_DEATH_REFUSED=1` through the channel would sort them.
- **No sweep or survey row is the L22 refusal itself.** The sweep's L22 → L29 legs (rows 250 from L25, 258 from L30)
  hold the Progressive Sword and solve on the full pass after the dashless pass refuses.

## 8. What the brief got wrong (measured)

- *"the corridor's polyline grazes a Solid … the walk cannot get there"*: no solid blocks the walk. The grazes are
  incidental (`rock at (96,96)` while sliding, then `tree at (0,96)` / `rock at (32,112)` on each respawned approach),
  and the message lists the **first** three grazes of the attempt, not the cause. The cause is death to wallflyer hits.
- *"or a staging/inventory difference (as L6 was: a weaponless state)"*: not weaponless. The slot holds the Ghost Spear,
  which the user's ruling counts as a hitless arm here. The staging matches an offline-built arrival exactly.
- *"waypoint 1 (88,88) … another try: waypoint 0"*: the same loop. Attempt 1 re-plans from wherever the last respawn
  left the player, so the waypoint index differs and nothing else does.

## 9. Residue

- **Hammer (planner):** a **spear** arm against wallflyer bands (and generally: `strikePolicyFor` is sword-only). That
  is the arm that makes this connected request solvable under the user's directional gate. With the switch ON, the L43
  `bosstotem@152,168` death loop (survey step 150) is now named and is a separate item.
- **Hammer, NO-HIT note:** the solved plans here take hits. #44 (L22 → L25, the free direction) takes 2 wallflyer
  hits. `canCross` sword from L25 takes 1, and shield from L30 takes 2. ⚖ NO-HIT logic says the game gives hitless
  lines, so these plans are legal-but-hit, not witnesses.
- **Rules:** the directional gate (`land/rules-no-hit-2`) is still unlanded, so main keeps `True_` for the bare
  south → north crossing, which the ruling says has no hitless line. Landing it removes the *bare* case but not this one.
- **Fidelity:** `corridorBodyPricing` ON turns the death loop into an honest ladder refusal (§5). Flipping it is
  fidelity's call.
- **js / server-data:** connected run 1's page never sent `Connect` after RoomInfo (§3). It is suspected, not proven,
  to be a boot-time race in `apClient.connect`.
- **Process:** two connected runs (one invalid). Temporary debug prints in `solverBot.js` / `botDriverV2.js` were
  reverted, kept as a patch, and are not on the branch. The single-step survey re-runs (4 runs) are census
  measurements, not sweeps. Nothing under `flashPanel/`, rules, AS3, wasm or gitlinks was touched.
