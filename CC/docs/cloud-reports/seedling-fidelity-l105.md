# Seedling fidelity L105 — the L105 hit, and a preview that steps the drifting BeamTower Solid

Session `seedling-fidelity-l105` (wave 37b, planner `seedling-fidelity-planning-18`).

- Start SHA: `26ed405d3f` (= `origin/main`; 110 ON of 122).
- Harness branch: `claude/seedling-fidelity-wave-37-mxqjq2`. Head: the commit that adds this report (the line before it is
  `0c8bdd0d`).
- Evidence: `CC/docs/cloud-reports/seedling-fidelity-l105-evidence/` (`w0/`, `d1/`, `d2/`, `tools/`).

## Verdict

| D | Verdict |
|---|---|
| W0 | **DONE. The brief's attribution is wrong.** At this base `fineStanceWalk` is inert on the leg. Both captured requests answer the same, trace for trace, ON and OFF, over seam −8..+8. The hit is a seam window of the DEFAULT solver. Its source is BEAMLANE's lane walk (`beamLaneWalk`, ON since W30), previewed against `beamtower@48,40`'s Solid as it stood at the preview's start. Not hammer's region. |
| D1 | **PASS.** New key `previewBeamTowerDrift` (OFF, byte-identical). (a) The preview steps the tower's drift. (b) The PHASE arm stops driving a preview the run has left, and refuses a lane crossing that is not the walk's own exit. ON, the leg is hitless into L106 at all 17 seams of both requests. Game-witnessed (p4g, 0 px). Mutant killed. |
| D2 | **READY, measured, NOT shipped.** With `fineStanceWalk` + my key ON, the L105 leg is hitless at 34/34 seams. L100 (survey step 215 here = the brief's 216) is SOLVED 327 t, 0 hits. The two tape producers drift as predicted (162 t, 241 t). Bounded set: 9 red rows. 5 are env-vs-default artifacts, 2 are the predicted re-records, and 2 are L105 pins that my key moves from a bad plan to a hitless one (one is hammer's; LISTED). |

**The one thing to know first:** the "one unbilled hit" undersold the defect. At the defaults, on seams 5684–5690, the
solver returns SOLVED for a reach-exit to **L106**, and the plan ends in **L104** after **two or three deaths**. The
sweep scored those rows `done`. The game does the same thing (the OFF control witness). `fineStanceWalk` was never
involved. The default flip that fixes the leg is `previewBeamTowerDrift`, not a `fineStanceWalk` fix.

## W0 — the trace (no code)

**Replays at base** (`replay-seedling-solve-request.mjs --n=1`, then `tools/l105-hits.mjs`):

- Both captured requests reproduce the sweep's answers exactly: 330 t at seam 5689, 308 t at seam 5687.
- `SEEDLING_FINE_STANCE_WALK=1` and `=0` give the same answer and the same progress trace (`w0/replay-*.log`).
- Seam sweep −8..+8 per request and per arm (`w0/seam-sweep-*`): ON = OFF on every row, for both requests.
- Over the captured clocks:

| seam | answer (both arms) |
|---|---|
| 5679–5683 | SOLVED 413/398/380 t, hitless, L106 |
| 5684–5686 | SOLVED 306–310 t, **2 hits** (`flyer@192,16` drops, t279–283), **ends L104** |
| 5687–5690 | SOLVED 307–330 t, **1 hit** (`beamtower@48,40` at t243), **3 pit deaths, ends L104** |
| 5691 | REFUSED: the `walk` site's anytime deadline |
| 5692 | REFUSED: `solid:beamtower (beamtower@48,40)`, no strategy row |
| 5693–5697 | SOLVED 415–429 t, hitless, L106 |

**The hit, named:**

- **Source:** `beamtower@48,40`. It is a BeamTower: a 16x32 Solid whose `y` drifts by
  `0.3·sin(worldFrame(100, 2)/100·2π)` every unfrozen update (`beamTowerDrift`, ON). Its beam fires on a 2-frame anim
  cycle. The hit at t243 comes from the beam (`playerHits` source `beamtower`, force 5, knockback dy −4.98).
- **Rung that chose the plan:** the `dodge` rung, PHASE arm, BEAMLANE's lane (`trace-seam5689.txt`). Row:
  `{verb: dodge, phase: beamtower@48,40, lane: {ticks: 413, walked: 413}}`. The steered lane walk previewed CLEAN for 413
  ticks (it crossed to L106 in the preview). The arm then plays the preview's 413 keys open-loop (`perTick.push` +
  `run.advance`).
- **Why the walk admits it:** it is a **forecast gap**, not an unpriced hit. `run.previewStepper()` builds its step options
  once, so every previewed tick sweeps against the tower's Solid where it stood when the preview started. Preview and run
  agree to the pixel for 211 ticks (`lane-vs-live-seam5689.txt`). At tick 211 the run's sweep is blocked on X by the
  tower's rect, which has drifted to `y 26.99 → 26.16` (`hitX: beamtower@48,40`). The run stands at x 58.41 holding
  `left` while the preview walks on to x 39.9. Then:
  - t243: the beam fires on the stalled player.
  - The knockback carries the player up into `pit@48,0`; first death at t269.
  - The open-loop keys continue from the respawn: `pit@208,80` at t296 and t323.
  - L105's arrival door to L104 at t330.
- **Why it was SOLVED:** the lane arm returned that crossing as `{forced: {transition}}`, which `walkToUnder` takes as the
  walk's arrival without checking where it went. The 16 px walk "avoided" the hit only because other seams put the tower
  elsewhere.
- **Seam sensitivity:** the tower's `y` is a function of `Game.time`, so the arrival clock decides whether the drift crosses
  the lane during the walk.
- **The 2-hit flyer seams** are the same mechanism: the run diverges from the preview at sample 217, stalls, and the flyer
  finds it.
- **Region check:** not DASHCERT's sight certificate and not a hammer function. `previewWalk` + `levelRun.previewStepper` +
  the PHASE/BEAMLANE arm in `climbLadder` are fidelity's. No hand-over is needed for the cause.

## D1 — `previewBeamTowerDrift` (new key, OFF; byte-identical)

A new key, because the cause is not `fineStanceWalk`'s walk and the fix changes every preview in a beam-tower room. Under
`fineStanceWalk`'s gate it would have been inert.

**(a) The model-faithful fix: the preview steps the drift.**

- `beamTower.beamTowerDriftedY(y, time, k)`: `stepBeamTowerFrame`'s drift, summed in its own order.
- `levelRun.beamTowerSolidForecast()`: from the live towers' `y` and `clock.now()`, `(k) =>` the towers' Solids in
  `beamTowerRectsNow`'s shape.
  - k ≥ 1: the towers update above the player, the k-th at `Game.time now + k − 1`.
  - Null (the snapshot stays) with the key or `beamTowerDrift` OFF, under noclip, in a room with no tower, with no clock,
    during a ceremony, or with a tower whose `y` is unknown.
- `previewStepper()`'s step takes an optional `previewTick`, and swaps `beamTowers` in its options for the forecast at
  that tick.
- `previewWalk` passes `previewTick = tick − startTick` at its three step sites (the walk, the stall, the stand tail).
  Every other stepper caller passes nothing.

**(b) The PHASE arm's drive guard (same key).** The arm drives `dodge.walk.samples` open-loop. Under the key:

- The first tick whose live position is not the preview's next sample hands back `{escalations}`. That is the spit arm's
  shape: the walk re-plans from where it stands. It writes a row in the new optional result field `phaseDriveLeft`.
- A lane crossing is returned as the walk's only through the walk's own exit (`drive`'s identity test: level plus arrival
  point, or the pit). Any other crossing is refused by name.

**Measurement** (`d1/seam-sweep-*`):

- ON: all 17 seams of BOTH requests are **SOLVED hitless into L106**, including the two OFF refusals. At seams 5687–5689
  the plan is 307 t.
- The guard never fires once the preview is faithful: (a) alone gives exactly these rows.
- OFF: the 17 rows of each request equal the base's.

**Game witness** (p4g, the default build, headless, port 9771, `probe-seedling-chaser-mobiles --class=Flyer --player-hits
--frames`; `d1/witness-*.txt`, `d1/witness-player-cmp.txt`; fixtures `frontend/modules/seedlingDemo/fixtures/l105-witness/`):

- **ON, seam 5689:**
  - Sample clock shift [0].
  - Flyer: 503 comparisons, worst |Δ| 0.
  - Player: **0 px at all 308 sampled ticks**.
  - Game: **no hit, L106 at t307**.
- **OFF control, seam 5689:**
  - Flyer: 585 comparisons, Δ 0.
  - Player: 0 px at 331 ticks.
  - The game takes the beam at **t243** and is in **L104 at t330**. The defect is the game's too, as the sweep's
    `divs: []` said.
- ⚠ The tape format carries no `inventory_slots`. The boot fixture does (`[0,1,3,2]`), and the tape replays the request
  staging's trajectory at 0 px (test row 5).

**Test** (`fidelityL105.test.js`, 5 rows):

1. The key ships OFF, and its env name is on the solver channel.
2. The forecast `y` equals the run's tower at every update of the ON walk (306 ticks in L105, exact).
3. OFF: 330 t, the beam at t243, deaths `pit@48,0`, `pit@208,80`, `pit@208,80`, L104. The keys equal the OFF witness tape,
   and the game rows match at 0 px.
4. ON: 307 t, hitless, L106. The keys equal the ON witness tape, and the game rows match at 0 px.
5. The tape vs the boot, tick for tick.

**Mutants** (predicted first, made by copy + restore):

- **M1**, the forecast removed (`previewTickOpts` = identity), guard kept. Predicted: the drive stops at the divergence
  and the walk re-plans, so there is no L104 "solve". Measured: every seam −5..+3 **REFUSES by name** (*"the danger map
  forbids (58.41,24.05) — hazard:beamtower@48,40 …"*). The test's row 4 reds (`expected 330 … 307`). Killed.
- **M2**, the guard removed: identical to D1. The guard is inert where the forecast is faithful, which is by design.

**New env read:** `SEEDLING_PREVIEW_BEAM_TOWER_DRIFT`, added to `SOLVER_ENV_NAMES` in sorted position.

## D2 — `fineStanceWalk` flip readiness (measured, NOT shipped)

Arms: `fsw` = `SEEDLING_FINE_STANCE_WALK=1`; `drift` = `SEEDLING_PREVIEW_BEAM_TOWER_DRIFT=1`.

- **L105 leg over the seam sweep, fsw + drift:** 17/17 + 17/17 seams **hitless into L106** (`d2/seam-sweep-*`). Equal
  row for row to drift alone; fsw does not touch this leg.
- **L100** (survey step 215 at this base; the brief's 216; L100 `reach-exit(teleporter@288,96 → L101)`):
  - default: REFUSED (the 16 px break-stance stall).
  - fsw, and fsw + drift: **SOLVED 327 t, 0 hits**. Unchanged by my key.
- **Leg 914 → this base's leg 925** (`level_100__r4c10 <- in_L99_48_96 ~> level_100__r2c3 -> exit:out_teleporter_288_96`):
  the sweep leg needs the browser sweep. See the dispatches. The survey row above is its node proxy.
- **The two tapes p17 re-recorded** (their producers' `--check`, `d2/producer-*.log`):

| tape | default | fsw | fsw + drift | drift alone |
|---|---|---|---|---|
| `l100-sliver-rock` (`plan-seedling-l100-witness`) | PASS | **DRIFT**: 186 → 163 observations (185 → 162 t); rock broken at t29 (was t84) from (124, 135.3) | = fsw | PASS (byte-identical) |
| `rulesref-l66-door` (`plan-seedling-rulesref-witness`) | PASS | **DRIFT**: 231 → 242 observations (230 → 241 t) | = fsw | PASS (byte-identical) |

  Not re-recorded; that is the flip harvest's job, licensed.
- **Bounded vitest** (125 files: the brief's header and footer lists, `fidelityL100Lattice`, `fidelityL105`,
  `dashShape`, `dashOnlyWindow`, `jsRuntimeSolverShouldStop`, and every `rg -a` hit for `previewStepper`, `previewWalk(`,
  `beamTower`, `phaseDriveLeft`, `fineStanceWalk`, `FINE_STANCE_WALK`, `PREVIEW_BEAM_TOWER`, `beamLaneWalk`,
  `walkerBeamTowers`; `d2/bounded-files.txt`):
  - head defaults: **fast 122/122 files, 2854 passed, 0 failed**. Slow 2/2 (8/8). `jsRuntimeTape` fast 14/14 and slow 2/2.
    Train (`fidelityL40Bk2.train`, the one `.train.` file the set holds) 1/1.
  - **fsw + drift:** slow 2/2 (8/8), train 1/1. **Fast: 113/122 files, 2845 passed, 9 failed. EVERY red**
    (`d2/vitest-bounded-on.txt`), attributed per arm:

| # | row | arm | class |
|---|---|---|---|
| 1 | `contactFidelity` "the shipped defaults" | env | env-vs-default artifact (re-pin at the flip) |
| 2 | `fidelityL105` "ships OFF" | env | env-vs-default artifact (re-pin at the flip) |
| 3 | `dashShape` "the defaults add no field" | env, any off-default switch | the env stamps `contactFidelity` into the request. Green under an env set to a default value (`SEEDLING_WALKER_BEAM_TOWERS=0`: 62/62). A real flip changes the defaults, so no stamp. |
| 4–5 | `dashOnlyWindow` "the default adds no field", "`stampHooks` … CAPTURE" | env | same as 3 |
| 6 | `fidelityL100` "ON: … IS the committed game witness" (185 → 162) | **fsw** | the predicted `l100-sliver-rock` re-record |
| 7 | `fidelityRulesref` "both ON: the committed witness" | **fsw** | the predicted `rulesref-l66-door` re-record (230 → 241) |
| 8 | `fidelityLapseCost` "ON: leg 773's request … solves in 426 t with no hit" → 423 | **drift** | fidelity's own L105 row (its comment already names the tower's drift as the reason the older plan parted from the game). Re-pin at the flip to 423. |
| 9 | `hammerAxisStrikes` "AXISON: on L95 flag 4 and L105 …" (`off105.ticks` 310 → 423) | **drift** | **hammer-owned pin, LISTED for hammer-3**, see below |

  - `dashShape` / `dashOnlyWindow` / `jsRuntimeSolverShouldStop`'s work-unit rows are green in both arms. L4's 1-unit
    margin is not touched (my key is inert outside beam-tower rooms).
- **Engine closure** (`seedlingDerivedRuleTable.js --print-engine-closure`, 42 files) ∩ my diff: **empty** (no
  `seedlingDemo` file is in the closure).

## The survey and sweep rows this moves

**Local route survey** (`--through=end --route=full`, 236 steps at this base; `d2/survey/*.rows.txt`, diffs
`d2/survey-default-vs-*.txt`):

| arm | SOLVED / REFUSED | movers vs head defaults |
|---|---|---|
| head defaults (OFF) | 202 / 34 | — |
| drift | 202 / 34 | **step 220 (L105 → L106): SOLVED 416 t, 2 decisions → SOLVED 413 t, 1 decision; 0 hits both** |
| fsw | 203 / 33 | step 167 (L66 → L70): 230 → 241 t, 0 hits; step 215 (L100 → L101): REFUSED → **SOLVED 327 t, 0 hits** |
| fsw + drift | 203 / 33 | exactly the union: 167, 215, 220. No interaction, no hit anywhere |

Step 218 (L103, the other surveyed beam-tower room) is REFUSED in all four arms with the same text.

**Sweep legs expected to move with my key** (keys derived at THIS base; `d2/keyed-legs.txt`):

- Leg 779 `level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144`. Today it is hitless or a hit-and-L104 depending on
  the seam. Expected ON: hitless L106 at every seam.
- The other beam-tower rooms' legs (L103, L104, L105, L107, L108: 18 legs) can move: every preview there steps the drift.
- The guard (b) runs in the PHASE arm, which lavachain rooms reach too (L72, L75, L76, L78, L79, L99: 19 legs). It acts
  only on a run that left its preview, or a wrong crossing.

**Dispatches for the planner** (all on `claude/seedling-fidelity-wave-37-mxqjq2` at its last head;
`contact_fidelity` = `d2/default-on-keys.txt`, the 110 default-ON keys, comma-separated):

1. **Survey A/B:** `seedling-survey.yml` `through=end route=full`, on this branch (control: the defaults) and on an arm
   branch whose defaults flip `previewBeamTowerDrift` (and a second with `fineStanceWalk` too). Expected: 220 alone, and
   with fsw 167 + 215 + 220.
2. **Full divergence sweep ×2 per arm:** `seedling-divergence-sweep.yml` with `contact_fidelity` =
   - `<110>` (control)
   - `<110>,previewBeamTowerDrift`
   - `<110>,fineStanceWalk,previewBeamTowerDrift`
3. **Keyed, ×2 per arm, `capture_requests=true`:** `keys=` the contents of `d2/keyed-legs-beam-l100-l69.pipe.txt`
   (beam-tower rooms 18 + L100 2 + L69 2 = 22 legs), then `d2/keyed-legs-lava.pipe.txt` (19). Add a seam census on leg
   779 (`seam_census=-8..8`) per arm.
4. **Probes:** `seedling-probe.yml battery=standard` on this branch. It is the defaults, so it is a byte-inertia control.
   Then one with an arm branch that flips the key.

## The JS arc

- **New optional result field:** `phaseDriveLeft` (`solveSegment`), present only when the PHASE arm stopped a drive under
  the key. No staging field. No new `SolverRefusal.obstacle.kind`: the wrong-crossing refusal uses `{kind: 'danger', id}`,
  an existing kind. Nothing to wire unless the page wants to show the row.
- `levelRun.previewStepper()`'s step accepts an optional `previewTick`. No other caller passes it.
- No `run.*` field renamed or reshaped (`seedlingSkinRenderer`, `levelRunStateDigest`, `levelRunDigestRead` green).
- **No new per-visit run map:** `beamTowerSolidForecast` builds a per-call memo, owned by one stepper and never stored on
  the run.
- The walker (`botDriverV2.drive` …) is untouched, so no `producer:walker` row should move from walker code. A walker leg
  in a beam-tower room can still move, because the walker's solver calls preview.
- **Sweep scoring (for the JS arc to consider; not edited):** the sweep scored seam-5689's run `end: done` with
  `expectedEnd {level: 104, deaths: 3}` for a goal `level_105 -> level_106`. A `done` whose end level is not the goal's
  target is worth a by-name verdict.

## Handed to the hammer arc

- **`hammerAxisStrikes.test.js` AXISON row** (`fixtures/hammer-axison/leg775-l105-seam6224-request.json.gz`): it pins
  OFF's L105 plan at 310 t with two `flyer@192,16` drops. Measured at this base with `tools/l105-hits.mjs`: that plan
  **ends in L104**, and the second drop **kills** the player (`died: true`). With `previewBeamTowerDrift` ON the same request
  is **423 t, hitless, L106**. The row is moved by my key only (drift arm), not by `fineStanceWalk`. At the flip the row's
  L105 half needs re-signing by hammer-3 (it asserts strikes-alone = OFF; whether that still holds at 423 t was not
  measured here). Not re-pinned.
- Nothing in the cause is hammer's.

## What the brief got wrong (measured)

1. **"⇒ fineStanceWalk alone."** At this base `fineStanceWalk` is inert on the L105 leg at every seam −8..+8 of both
   captured requests, trace for trace. p17's attribution runs were single sweep rows at different arrival clocks. The
   leg's answer flips with the seam at the DEFAULTS, so a ×2 per key could not separate a switch from the clock. Main's "3 of
   3 hitless" was the same: those runs' seams were in a hitless window.
2. **"one hit … SOLVER CHOICE, not a model mismatch."** The run model and the game agree (divs []). But the solver's
   *preview* disagreed with its own run model: a forecast gap. And the outcome is not one unbilled hit. It is 1–2 hits, 2–3
   deaths, and the wrong level, scored `done`.
3. Step and leg ids moved: L100's survey step is **215** here (216 in the brief); leg 775 → **779**; leg 914 → **925**.
4. "W36's survey 203/37": at this base the local survey has 236 steps, **202/34** at the defaults.

## Residue

- The sweep's `done` with an end level ≠ the goal's target (JS arc; above).
- **Other open-loop drives:** the spit and whirlpool dodge arms and the axe arm also play preview samples. They cover
  short stalls, but have no "left the preview" guard. Not touched: no measured case.
- A ceremony at the preview's start keeps the snapshot (the forecast would need the ceremony's span). No case measured.
- The witness tape needs `inventory_slots` staged separately (tape format).

## Byte-inertia (key OFF)

- **Identity block at head = base on every hashed row** (`w0/identity-base.txt` vs `d2/identity-head-off.txt`):
  - maze `57e07d21`, acceptance batch **`abb206c88de25e7ba1874510d493ce85`** (= the brief's main value).
  - The six producer `--check`s: `7486f32e`, `93f75467`, `88e33db7`, `35456fbc`, `6cd35fe1`, `be9c19c8`, all exit 0.
  - The two non-hash lines differ for environment reasons only:
    - "generated set": the base worktree had no venv.
    - "reference": the doc-size table. Regenerated; `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH`.
- L105 seam sweeps OFF = base, 17/17 rows per request.
- Survey OFF at head: 202/34. The drift arm's only mover is step 220.
- Both producers PASS with the key alone.

## Records and deltas

- Code:
  - `contactFidelity.js`: `previewBeamTowerDrift` at the END, plus its env lines. 110 ON / 13 OFF of 123.
  - `beamTower.js`: `beamTowerDriftedY`.
  - `levelRun.js`: `beamTowerSolidForecast`, and `previewStepper`'s `previewTick`.
  - `solverBot.js`: `previewWalk`'s `previewTickOpts`; the PHASE arm's guard; `phaseDriveLeft`.
  - `solverEnvChannel.js`: +1 name.
- Pins: `contactFidelity.test.js` +1 OFF row.
- New: `fidelityL105.test.js`, and `fixtures/l105-witness/{seam5689-boot,seam5689-on,seam5689-off}.json`.
- Censuses:
  - Constants `--write`, then `--check` **PASS 7065** (+1 field row: `beamTowerDriftedY`, physics/derivation).
  - Surface `--write` **GREEN 371**.
  - Reference regenerated. `generate-docs-index --check` OK.
- Docs: a `seedling-bot.md` paragraph, and a `seedling-bot-log.md` entry with trap candidates.
- Box lock: no new box-taking instrument (the evidence tools are node-only; the witness used the existing probe).

## Rows to BANK

- Leg 779 (L105 `in_L104_0_16 → teleporter_80_144`), both captured requests, seams −8..+8:
  - default: 7 seams end in L104 after hits and deaths, 2 refuse.
  - `previewBeamTowerDrift` ON: 17/17 hitless, L106.
- Game witnesses `l105-witness/seam5689-on` (307 t, 0 px, hitless, L106 at t307) and `seam5689-off` (hit t243, L104 at
  t330).
- Survey at this base, 236 steps:
  - defaults 202/34.
  - drift: step 220 416 → 413 t.
  - fsw: steps 167 (230 → 241 t) and 215 (REFUSED → 327 t).
- AXISON's L105 fixture at the defaults: 310 t, ends in L104, and the second flyer drop kills the player.
