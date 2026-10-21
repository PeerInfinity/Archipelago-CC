# seedling-fidelity-l1516 — L15's chest is a Solid, L16's enclosed pit (leg 206), leg 209's hit

| | |
|---|---|
| Session | `seedling-fidelity-l1516` (wave 21, planner `seedling-fidelity-planning-9`) |
| Start SHA | `98689e2e3ce27d64ce8b3060aafc994bffb65573` (= main `98689e2e3c`, as briefed) |
| Harness branch | `claude/seedling-l1516-chest-pushable-3j9vvw` |
| Code head | `7cc6c01e` (CI green); the report commit follows it |
| Server | `serve-nocache.py 9706`, PID 907; wasm p4g `9968c7d`, vendor/seedling `ccdf189776` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (the brief's reading was wrong; the fix is not the shove) · D4 PASS (attributed; JS-arc hand-over, no code)** |

## The one thing to know first

**Leg 206 is not a shove gap.** Its goal pit, L16 (13,4), has a pit on all four sides.
- The planner exempts only the goal tile, so the goal is an island. The pushable block was just the nearest frontier
  solid. A `PushableBlock` that reaches a pit is destroyed and does not fill it.
- The game enters the pit across a corner. `getState` reads one point per tick, so a diagonal step can jump that
  point across the corner of a diagonal floor cell straight into (13,4).
- I modelled that in the solver (`enclosedPitCorner`, OFF). With it ON, leg 206 goes REFUSED → SOLVED in 335 ticks,
  and the game plays the solver's own solution to L17 (136,56) at 0 px.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B … 98689e2e3c` (the harness branch already sat there: 0 commits either way) | bootstrap `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9706 bash scripts/procgen/identity-block.sh .` (switches OFF), then the same with `SEEDLING_CHEST_PROBE_LINE_END=1 SEEDLING_ENCLOSED_PIT_CORNER=1` | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`; the rows' md5 **`14f71e53c93587758f89a03002551de8` OFF = ON**. Generated set **OK** (ON in the block; OFF re-run alone, below) |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, **all exit 0**, OFF = ON |
| reference | the block's last row | OFF: "4 DIFFER". That was environmental: the substrate submodules (omsi-loops, cavernous-ii, …) were not checked out, so `registry`/`capabilities` could not be generated. With them initialised, only my two probes' `instruments` rows differed. Regenerated; ALL MATCH |
| surface / constants / entities / profile | `census-seedling-solver-surface --check`, `census-seedling-constants --check`, `witness-seedling-entities --check`, `witness-seedling-profile --check` | after re-records: GREEN **335** · PASS **6,530** · PASS 566 · PASS 138 (both files) |
| roster | `fixtures/tapes/index.json` `.tapes` | **289**, unchanged (no roster tape added; the witnesses are fixtures) |

⚠ **Baseline by quotation, not a pristine worktree (⚖ ruling 32 A).** Nothing either switch adds is reachable with
the switch OFF:
- the chest line's ON arm subtracts `0`;
- the corner arm sits behind `if (corners && …)`, where `corners` is `null` OFF.

So the OFF block at the code head is the base. Its values equal the rows the IGNEOUS report published at `934f99422b`,
except r9-campaign, which now exits 0 where that base exited 1 (main moved).

## D1 — why the model walks through `chest@144,96` (PASS, game-witnessed)

**What the code says.** `Chest.update` (`vendor/seedling/src/Chest.as:63`):
`collideLine("Player", x-originX+m, y-originY+height+1, x-originX+width-2*m, …)`, with m = 2, so toX = px+12.
`World.collideLine` (`net/flashpunk/World.as:411-525`) at precision 1:
- it walks `while (x < toX)`;
- the end-point test runs only when `precision > 1` (`:514`).

So the probes are **px+2 .. px+11**. The model's keyLock already transcribes this (`levelWorld.js`, `x1: 11`). But
`chest.chestProbeLine` returned `x1 = px+12`, and `activators.keyLineTouches` reads `x1` inclusive.

**Which of the brief's candidates it was: none of the four.**
- The chest is built, as the right shape (`setHitbox(16,16,8,8)`), and Solid while unopened. No swim or terrain path
  skips it.
- It OPENED in the model one pixel early, and `open()` writes `type = ""`. So the model walked through an opened
  chest.
- Measured in node: the first-cut shape (down, east until the wall, then up column 9) stands at x 157.90 → 158.00. The
  box's left edge, ≈155.9–156.0, contains probe 156. The model fires `chestopen` at t200; the game never does.

**Game witness** — `scripts/procgen/probe-seedling-l15-chest-line.mjs`:
- Setup: new; takes the box lock; p4g headless logic-only; port 9706; each tape on a fresh page.
- Staging: `r9-solve-15`'s, booted L15 (48,64) with the Conch only, the block-path swim arm's items.
- Record: `fixtures/l1516-witness/l15-chest-line-{edge,inner}.json`.

| tape | inputs | game | model ON | model OFF |
|---|---|---|---|---|
| `edge` | down 0–80, right 80–190, up 190–300 | **chest stays Solid**: no `{15,1}` clear; stops under it, final (157.99692, 114.34350), L15 | 0 px, every tick | opens it at t200, first drift t200, ends L16 (40, 64.45) |
| `inner` | right until 186 (x ≈ 152) | opens it (`{15,1}` cleared), L16 (40, 60.85) | 0 px | 0 px (the control: the line is live) |

## D2 — the model (PASS) — `CONTACT_FIDELITY.chestProbeLineEnd`, OFF

- **Change.** `chest.js:134`: `x1: px + CHEST.box.w - 2 * CHEST.m - (CONTACT_FIDELITY.chestProbeLineEnd ? 1 : 0)`.
  `contactFidelity.js` gets the switch, its docblock and `SEEDLING_CHEST_PROBE_LINE_END=0|1`.
- **Rows.** `fidelityL1516.test.js` (13 rows; the D2 half):
  - the line OFF/ON;
  - the game's stop box against both lines;
  - both witnesses' final tick, exact, ON;
  - edge OFF as the gap; inner OFF as the control.
- **Mutant** (predicted first; copy + restore): ON arm `? 1 : 0` → `? 0 : 0`.
  - Predicted: the line row and edge-ON red, the rest green.
  - Measured: exactly those 2 red, 4 green.
- **Every room it touches.** Sixteen chests: L11 `chest@32,48`, L12 `@320,816`, L15 `@144,96`, L17 `@128,16`,
  L25 `@96,96`, L36 `@64,48`, L38 `@144,112`, L40 `@880,816`, L46 `@424,40`, L48 `@152,184`, L63 `@224,80`,
  L71 `@160,256`, L80 `@16,128`, L86 `@48,16`, L90 `@48,32`, L98 `@160,32`.
  - The change moves only a box whose left edge is in (px+11, px+12], i.e. player x in (px+13, px+14].
  - The solver's chest stance (`deriveStance`: x = px+8) and `chestStanceBand` (box at x = px) never stand there.
  - Every route-survey row and sweep leg in those rooms is unchanged (below).

## D3 — leg 206 (PASS: a model of the game in the solver; the brief's reading was wrong)

**Replayed in node.** `drivers/inv-leg.mjs` with the sweep row's items and its `seamTime` 4886. It gave the sweep's
refusal word for word in 71 ms: *"no corridor for goal reach-pit toward (216,72) … Obstacle: solid:pushableblock … no
walkable tile path … from tile (2,4) to (13,4) … different connected components"*.

**L16's pit cluster** (from the built world): seven Pit tiles, (12..14, 3), (12..14, 4) and (13, 5).
- The exits are `out_pit_7_2` … `out_pit_8_4`, i.e. (12,3) … (13,5).
- `out_pit_8_3` = **(13,4), the centre**: all four orthogonal neighbours are pits.
- The six other pits all have a floor neighbour; all six legs from the same arrival are `done`.
- `PushableBlock.as:76-85`: a block centred on a Pit tile sets `destroy = true` and no tile changes. So no shove can
  make (13,4) reachable. The block is just the nearest solid on the frontier.

**The game's mechanic** (`Player.as`):
- `getState` (`:677-689`) reads ONE point per tick: the nearest tile to (x, y + checkOffsetY), i.e. the cell holding
  (x, y+1).
- `set state` (`:705-724`): the first Pit read sets `fallInPit`, and `fallInPitPos` is that cell.
- `checkFallingInPit` (`:745-770`) lerps to its centre and lands at `fallInPitPos - fallthroughOffset`.
- A diagonal step moves both axes in one tick, so the point can jump the corner (224,80) from floor (14,5) into
  (13,4).

**Game witness** — `scripts/procgen/probe-seedling-l16-corner-pit.mjs`:
- Setup: new; box lock; p4g headless logic-only; port 9706.
- Record: `fixtures/l1516-witness/l16-corner-pit-*.json`.

| tape | inputs | game | model |
|---|---|---|---|
| `corner` | boot L16 (232,88) (the player stands at (240,96)), up+left | the point jumps t14 (224.09, 81.09) → t15 (222.56, 79.56); falls into **(13,4)**, lerp to (215.87, 71.87), lands **L17 x 136** | 0 px |
| `control` | up 8 ticks first, then up+left | falls into **(14,4)**, lands L17 x 152 (a different exit) | 0 px |
| `solve` | the solver's leg-206 solution (`l16-corner-pit-solve.tape.json`; ON, from the leg's arrival L16 (32,64) with the Sword; 335 ticks + 20) | walk to (12,5), corner step, falls into **(13,4)** at L16→L17 t255, final **L17 (136, 56)** | 0 px |

**The change** — `CONTACT_FIDELITY.enclosedPitCorner`, OFF; `solverBot.js`:
- `enclosedPitCorners` (`:6603`) and `enclosedPitCornerKeys` (`:6631`, with `ENCLOSED_PIT_CORNER` at `:6624`).
- The arm in `execReachPit` (`:24254`).
- When the goal pit is enclosed, has a diagonal floor cell, and the player is not already in its cell, the arm:
  1. walks to a stance 6 px inside the nearest diagonal floor cell, on the probe's diagonal through the shared corner;
  2. previews the corner step with `run.previewStepper()`. Candidates are a pre-step of 0..12 ticks on either key or
     on nothing, then the diagonal. A candidate is admitted only if the preview's FIRST `fall.target` is the pit's
     centre;
  3. executes it, verifying the fall target;
  4. refuses by name on a hit the preview did not price;
  5. presses nothing through the fall-out and coasts the descent (`coastThroughTransport`).
- The record gains an optional `corner: {cell, keys, pre, ticks}`.

**Measured ON vs OFF in node** (`drivers/inv-leg.mjs`; `SEAM_TIME=1`):

| leg | key | OFF | ON |
|---|---|---|---|
| 206 | `level_16__r1c1 <- in_L15_144_16 -> exit:out_pit_8_3` | REFUSED (the no-corridor refusal) | **SOLVED 335 t** (dashless 451), ends L17 (136, 56) |
| 215 | `… <- in_L17_32_48 -> exit:out_pit_8_3` | REFUSED: `arrowLane:arrowtrap@112,32`, (120,56) | REFUSED: the same danger at (120,56), now in the stance walk's words (`reach-pit (13,4) corner (12,5) stance: the danger map forbids (120,56) …`). ⚖ 2026-10-21: a correct refusal |
| 671 | `level_84__r2c4 <- in_pit_L83_2_2 -> exit:out_pit_3_4` | SOLVED 100 t | SOLVED 100 t. ⚠ The first cut refused here ("no diagonal floor"): the L83 pit lands the player IN (2,2). The arm now keeps the walk when there is no diagonal floor cell or the player is already in the pit's cell; re-measured |

- Every enclosed pit in the atlas: 1,003, in L16, L59–L67, L84, L93, L95, L100–L109. Only these three sweep legs
  target one (`legs.jsonl` derived at the base, 863 legs).
- No route-survey reach-pit goal is enclosed (L12 (36,43), L48 (11,3), L56 (6,1), L70 (2,2), L71 (12,13),
  L83 (2,1), L84 (3,1), L110 (4,4); and the L32 encounter's `then`). So the arm cannot fire on the survey.

**Rows.** The D3 half of `fidelityL1516.test.js`:
- the cluster and its corners;
- the three witnesses' fall pit and landing;
- OFF refuses leg 206's goal (from the tape staging);
- ON solves it with the witnessed tape key for key.

**Mutant**: `enclosedPitCorners`' enclosure test always `null`.
- Predicted: the cluster row and the ON-solve row red, the rest green.
- Measured: exactly those 2 red, 11 green.

## D4 — leg 209's UNBILLED-HIT (PASS: attributed; not a model gap; JS-arc hand-over)

Sweep row: `hits=[tape0:0~@120,51.25]`, `billed=[-]`, `roomHits.hits[0] = {t 0, hits 1, hits_timer 19, x 120,
y 51.25, exact false, why "the tape was not armed at the read"}`.
- The leg refused at plan time, so its tape is `wasm-hold-16` with 0 ticks.
- The hit lands during the ~19-frame arrival latch (`latchWaits[0]`: gt 4889 → 4908).

**The model bills it.** `drivers/arrive209.mjs` steps the leg's arrival staging (seam 4887, the row's items) with
nothing held (`d4/leg209-arrival-model.txt`):
- The volley of `arrowtrap@112,32` falls 5 px a tick.
- Model tick 6 bills `{source: 'arrow', id: 'arrowtrap@112,32#0.1'}`, the arrow at x 120.
- The run's damage is `{hits 1, hitsTimer 19, directionFace 3}` at **(120, 51.25)**: the game's tape-0 read, field
  for field.

**So:** which arrow → `arrowtrap@112,32`, volley arrow `#0.1` (x 120). Which tick → arrival + 6. Why "unbilled" → the
sweep compares a hit with the model rows of the leg's tape, and a refused leg has none.
- **Owner: the JS arc** (`seedlingHitTicks.js` / the merge). A refused leg's arrival-latch hit could be compared
  against the model stepping the arrival staging over the same frames, which bills it here.
- The refusal itself is correct (⚖ user 2026-10-21; I did not model or plan a tank-a-hit crossing).

## The survey / sweep rows this moves (before → after)

**Route survey** (`survey-seedling-route.mjs --through=end --route=full`, local, node):
- At this base the derive gives **250** steps.
- The chest switch can only move the 54 steps in chest levels (`survey/steps.txt`). The pit arm cannot fire on any
  survey goal (above).
- Those 54, OFF vs ON (both switches): **0 movers**. 39 SOLVED / 14 REFUSED / 1 NO-ARRIVAL either way, and every
  row's md5 over all fields but `ms` is equal (`survey/steps-{off,on}.json`).
- The chest rows the brief flagged are unchanged: L38's (55, 72, 102, 143, 163) and step 227's L98 chest-stance
  refusal.

**Divergence sweep** (node, the inv-leg staging):
- **L16, by key:** leg 206 REFUSED → SOLVED 335 t; leg 215's refusal text moves (same obstacle); leg 671 unchanged.
  The other 17 rules-block-path legs do not target an enclosed pit and are not in chest levels (L15's two legs are
  chest-level: unchanged below).
- **The 236 legs in the 16 chest levels**, OFF vs ON (both switches), 180 s each: **0 movers**, 157 SOLVED / 79
  REFUSED both (`legab/chest-legs-{off,on}.jsonl`).
  - ⚠ Their items: only the 20 keys of run 39623239529 carry that run's items and seam. The other 216 use the JS
    runtime's arrival staging as-is.
  - Same inputs on both arms, so it is a switch A/B, not a reproduction of the baseline sweep.

**Bounded vitest:**

| arm | files | result |
|---|---|---|
| OFF, mid-session | 194 (`bounded-files.txt`) | 6,621 / 6,660 |
| ON | same 194 | 6,651 / 6,660 |
| AFTER, switches OFF | same 194 | **6,660 / 6,660** |

- The mid-session OFF run started before the census re-records and the reference regeneration. Its three reds were
  stale censuses/reference, a 10 s hook timeout under load, and one real fix (the constants anchor path, `997d1c3a`).
- **The 9 ON reds:**
  - `chest.test.js` ×2: pins `chestProbeLine(144,112).x1 = 156`. **These are the flip's re-pins.**
  - `contactFidelity.test.js` "shipped defaults" and `dashShape.test.js` "defaults add no field": artifacts of
    running with the env set. A flip re-pins the defaults row as every flip does.
  - `docsRender` ×2 and `generated` ×1: my doc edits before the regeneration; green after.
- **CI at `7cc6c01e`** (run 39647769931): unfiltered **21,663 passed / 0 failed** (884 files); slow battery
  **261 / 0**.

## The exact CI dispatches for the planner

1. **Survey OFF**:
   - Workflow: `seedling-survey.yml` on `claude/seedling-l1516-chest-pushable-3j9vvw`.
   - Inputs: `through=end`, `route=full`.
   - Expect: equal to the wave-20 baseline by (level, goal, boot) for every step this branch did not change. Both
     switches are OFF.
2. **Survey ON**: the same, on a one-commit scratch branch off this one that flips both defaults in
   `contactFidelity.js`:
   - `chestProbeLineEnd: true`
   - `enclosedPitCorner: true`

   Expect 0 movers. Measured locally on the 54 chest-level steps; the pit arm cannot fire on the route.
3. **Keyed sweep ×2** — workflow `seedling-divergence-sweep.yml` on this branch:
   - `keys` = `sweep/keys-block-path-plus-671.txt`: the 20 keys of run 39623239529 plus leg 671's, 21 in all.
   - `capture_requests=true` for B.
   - **A**: `contact_fidelity` omitted (the defaults).
   - **B**: `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,chestProbeLineEnd,enclosedPitCorner`
     (every default-ON key at this base, plus mine).
   - Expect: leg 206 `failed` → `done` on B, landing L17 (136,56), the game playing the solver's 335-tick plan; leg
     215 stays `failed` (the arrow lane); 671 unchanged.
   - ⚠ The page solves in the worker, so the switch must reach it through `contact_fidelity`. It is an ordinary
     `CONTACT_FIDELITY` key.
4. **Optional chest A/B**: the same workflow with `keys` = `sweep/keys-chest-levels.txt` (236 legs), A = defaults and
   B = the defaults plus `chestProbeLineEnd`. Expect 0 movers, as in node.

## The JS arc: pins that move, and what it must wire

- **Nothing of the JS arc's moves at the defaults.** I did not touch `solveSegment`, `twoPassSolve`,
  `PendingDeclaration` or `createRunForStaging`, nor the walker (`botDriverV2`).
- **New optional fields** (OFF never emits them):
  - a reach-pit record's `corner: {cell, keys, pre, ticks}`;
  - `SolverRefusal.obstacle.kind = 'enclosed-pit'` (`id: pit@<tx>,<ty>`), raised ON only when the corner preview finds
    no step or the step takes a hit.
- **To wire:** nothing for leg 206 itself. The arm is a solver-internal executor, and the worker's `contact_fidelity`
  stamp carries the switch.
- **D4 hand-over:** the sweep's hit attribution for a refused leg's arrival-latch hits (above).
- `run.*` fields read by the skin: none renamed or reshaped.

## Hand-overs

- **Hammer arc: none.** I did not edit `planWaypoints`, the escape, `stateDigest`, or any hammer-owned function. The
  arm calls `walkTo`, `run.previewStepper` and `coastThroughTransport` as existing executors do.
- **Rules arc: none.** `rope@32,16` is not read by anything here.

## Deltas

| commit | what |
|---|---|
| `536dcfda` | D1–D4 code, probes, fixtures, rows. One commit: the shared files (`contactFidelity.js`, `fidelityL1516.test.js`, `boxLock.test.js`) carry both switches, so per-D commits would have split those files' hunks |
| `1230303d` | surface (335) / constants (6,530) re-records, the reference |
| `997d1c3a` | the constants anchor path fix |
| `7cc6c01e` | `seedling-bot.md` paragraph, the log entry, the reference |

Also:
- Two new box-taking instruments, each in `boxLock.test.js`'s conditional-takers list (both directions green).
- The help door ALL PASS (452).

## What the brief got wrong (measured)

1. **D3:** *"this reads as the solver's shove strategy, not logic"*. It is neither shove nor logic. The goal pit is
   enclosed by pits. The refusal NAMES the block because the frontier names its nearest solid; its tail ("different
   connected components") was the fact.
2. **D1's four candidates** (not built / wrong shape / non-solid / skipped by a path): none. The chest opened one
   pixel early, on a probe line one pixel too long.
3. **D4:** *"a hit the model did not bill"*. The model bills it on the same tick, at the same position, with the same
   i-frame timer. The sweep had no model row to compare it against.
4. **"The 21 rules-block-path keys (listed in the header's (2) run)"**: run 39623239529 has **20** rows and keys (legs
   199–218). The dispatch above adds 671 as the 21st.
5. **Survey size:** at this base the full route derives **250** steps, not the 254 of `934f99422b`.
6. The standing list's `apReportBosses` test has no file of that name (as IGNEOUS found). `fidelityApBosses` /
   `fidelityApFlip` are in the bounded set.

## Residue

- The chest line's other readers. `botDriverV2.runChest`'s line check and `chestStanceBand` read `chestProbeLine`
  too. Both stand at the chest's centre column, so neither answer changes. The ON arm is consistent across all three
  readers by construction (one function).
- L84 (2,2) and the 1,000 enclosed pits in the dark pit fields are untouched as goals. No sweep leg targets them but
  671, which lands inside.
- The keyed wasm sweep (dispatch 3) is the browser-side witness of leg 206. In node and in the tape witness the plan
  is exact.

## Byte-inertia

- OFF: the identity block's rows (`14f71e53…`), the six `--check`s, the 54 survey steps and the 236 + 3 legs are equal
  OFF/ON where the switch cannot reach.
- At the defaults, the bounded set and CI are green, and no committed tape or producer digest moves.
- The only OFF-arm textual change in shipped output is the census re-hash of the chest line's statement. Its literals
  are unchanged.

## Rows to BANK

- `fidelityL1516` witnesses:
  - `l15-chest-line-edge`: game stops at (157.99692271842153, 114.34349760511718), chest Solid. ON 0 px; OFF drifts
    at t200.
  - `l15-chest-line-inner`: opens; both arms 0 px.
  - `l16-corner-pit-corner`: falls into (13,4), lands L17 x 136; 0 px.
  - `l16-corner-pit-control`: falls into (14,4), lands L17 x 152; 0 px.
  - `l16-corner-pit-solve`: 335 + 20 ticks, L16→L17 t255, (136,56); 0 px.
- Leg 206 ON: SOLVED 335 t (dashless 451). Leg 671 unchanged at 100 t ON (the in-pit guard).
- Chest-level A/B: 236 legs, 0 movers. Survey: 54 chest-level steps, 0 movers.
- Leg 209's arrival: the model bills `arrowtrap@112,32#0.1` at tick 6, (120, 51.25), hitsTimer 19.

Evidence: `seedling-fidelity-l1516-evidence/`:
- `w0/`: identity OFF / ON.
- `survey/`: steps and the OFF / ON rows.
- `legab/`: the 236 chest-level legs, OFF / ON.
- `sweep/`: dispatch key lists.
- `d4/`: leg 209's model arrival.
- `drivers/`: the scratch drivers.
- `bounded-files.txt`.
