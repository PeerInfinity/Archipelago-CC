# Seedling fidelity L40RES — L40's STANCE_REENTRY was the walk's door, not the stance (`stanceReentryNextDoor`); leg 368's seam-5290 hit is the model's own, and a spinner sees a lock's turn-off one tick later (`spinnerLockLag`) — both OFF

| | |
|---|---|
| Session | `seedling-fidelity-l40res` (planner `seedling-fidelity-planning-12`, wave 29, model coverage after R7) |
| Start SHA | `e8d85de8d1` (= `fidelity-harvest/firepush`: main `f9342f25b8` + FIREPUSH merged, its three keys OFF; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-l40-wandlock-hold-tbqn4x` (nothing pushed elsewhere) |
| Commits | D2 `ffd46aa7` · D1 `b6b0a3c2` · defaults table `2493159e` · records `61448b08` · evidence + this report |
| Port | 9729 (the base worktree's identity block: 9730) |
| Verdicts | **W0 PASS · D2 PASS behind `stanceReentryNextDoor` (OFF), then STOP at the hammer arc's press kill · D1 STOP for the hit (it is the hammer arc's certificate), PASS for the model gap the witness found (`spinnerLockLag`, OFF; p4g, 0 px) · Movers: survey 1 row (step 93, REFUSED → REFUSED), sweep 0, probes 11/11, tapeRunner 0** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-l40res-evidence/` |

## The one thing to know first

**Neither gap was what the brief read it as.**

**Gap 1.** The STANCE_REENTRY stance was not on the wrong side; the walk to it chose the wrong door. `wandlock@448,432`'s hold stance (488,392) is inside the lock room, and the stance hypothesis found it reachable **through the room's south door** `wandlock@480,560`, whose `buttonroom@880,768` latches. The walk to the stance then asked its own frontier nearest-to-aim, and that named the west door again. With `stanceReentryNextDoor` ON the walk passes on and starts the room's real chain: chest → tree → buttonroom → south door. It then dies in a press kill (the hammer arc's region).

**Gap 2.** Leg 368's seam-5290 hit is **not a model/game contact divergence**. The model replay takes the same hit at t1222, to the bit, and the solver's own expected trajectory carries the knockback. The plan passed because the dashed walk's certificate prices the spinner hammer from the press-blind `run.spinnerForecast`, which puts the spinner the walk itself struck 28.31 px from where it is. That is the hit-aware spinner forecast: handed to the hammer arc.

The same witness found one real model divergence, which is now modelled: a spinner sees a lock's turn-off one tick later than the player does (`spinnerLockLag`).

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/seedling-l40-wandlock-hold-tbqn4x e8d85de8d1`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9730 bash scripts/procgen/identity-block.sh .` in a detached worktree of `e8d85de8d1` (submodules + `node_modules` symlinked, its own server on 9730; `evidence/identity-w0.txt`) | log md5 **`161dab658ab243a98241f743a78f9157`**: maze `57e07d21`, acceptance `481b7a1c`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | 4 DIFFER: this box's environmental rows (as every slice since WANDHOLD) |
| tapeRunner pairs | `npx vitest run …/tapeRunner.test.js --reporter=json`, md5 over sorted `status\tfullName` | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** (= FIREPUSH's), 0 non-pass |
| surface / constants / entities / profile | each `--check` | GREEN **347** · PASS **6,908** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| bounded vitest BEFORE | 136 files (`evidence/vitest-files.txt` less `fidelityL40Res`): the brief's list (no file named `apReportBosses.test.js` exists; `fidelityL32ArenaPrefix` is `.slow`, not run), + `fidelityWandHold`, `fidelityFirePush`, + every non-slow test hitting `STANCE_REENTRY\|nextPastSealedLock\|identifyAndSelect\|openActivatorIds\|spinnerCtx\|spinnerForecast\|stepSpinners\|spinnerBodies\|CONTACT_FIDELITY_KEYS\|CONTACT_FIDELITY_DEFAULTS\|stanceHypothesis\|wandlock@448,432\|activators.js`, + the surface/constants/census tests | **3,333 / 3,333 pass**, md5 `7346e583225af81b291388b901fcfc3b` |
| gap 1 reproduced | `survey-seedling-route.mjs --through=end --route=full --only=93` (step ids derived at this base: 239 steps) | REFUSED, the brief's text verbatim (STANCE-REENTRY family) |
| gap 2 reproduced | leg 368 captured locally (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g --ids=368 --capture-requests`, seam 5241), then `replay-seedling-solve-request.mjs --seam-time-sweep=39..51` (`evidence/seam368.txt`) | 5280-5287 → 1558 t, 5288 → 1584 t, 5289 → REFUSED (the shake band), **5290-5292 → 1600 t** (the brief's plan) |

## D2 — gap 1, the STANCE_REENTRY (PASS behind `stanceReentryNextDoor`, OFF; then STOP)

**The room, measured** (the planner's own `plannerObstacleAt` map: `evidence/l40-planner-map.txt`, `tools/ascii2.mjs`). The
lock room is tiles 29-31 × 23-34. Its four doors:

| door | id | group | opener |
|---|---|---|---|
| W | `wandlock@448,432` | t2 | `button@480,384`, a plain Button **inside** the room |
| E | `wandlock@512,480` | t2 | the same |
| S | `wandlock@480,560` | t3 | `buttonroom@880,768` (`room = -1`, latches), in the SE pocket behind `chest@880,816` (a one-tile gap) and `burnabletree@872,784` |
| N | `bosslock@480,352` | key | Purple Key (the boot's save holds it) |

The arrival (488,904) reaches the W, E and S doors from outside. The part (64,144) is north, through the bosslock and the
col-30 corridor.

**What the solver did.** The frontier sorts its doors nearest-to-aim, so it names the W door: `hold` → `button@480,384` →
stance (488,392). `stanceHypothesisProbe` at the boot (`fidelityL40Res` row 2) shows why that stance "reaches":
- the hypothesis holds `wandlock@480,560` (the S door: its opener latches, so `hold` survives refinement);
- it holds neither group-2 door: they are guard (iii)'s weigh-wall (a plain Button, and no walk block reaches it).

So the stance was derived reachable **through the S door**: right, and the room's real order. The walk to it then
re-identified its frontier nearest to ITS aim (488,392), named the W door again (d 57.7), and refused STANCE_REENTRY with
the S door never asked.

**The answer to the brief's question.** It is not a stance-choice defect. "The room's real order is different (another
opener first)" is right, and the derivation already knew it. The defect is the stance WALK's choice of door.

**The change** (`solverBot.js`; `contactFidelity.js`: `stanceReentryNextDoor: false`, `SEEDLING_STANCE_REENTRY_NEXT_DOOR=0|1`):
- `identifyAndSelect` returns the rest of its sorted frontier (`frontierRest`), ON only.
- In `walkTo`'s re-entry branch, after the 8 px lattice has also failed and before the refusal, `nextPastReentry` walks that
  list (the L12KEYLINE `nextPastSealedLock` shape). The first entry whose strategy resolves is this round's order, with a
  `rejected` row naming the re-entry.
- Passed over by name: an entry with no registered verb; one whose resolution refuses or binds nothing; and one that is
  this walk again (its stance walk is in flight in `stanceWalks`, or its stance is this walk's aim).
- A prerequisite rides through `prerequisiteOrder` as any order does. With none binding, the refusal stands unchanged.
- OFF: `frontierRest` is never attached, so the branch is the old one. No new `SolverRefusal.obstacle.kind`.

**ON at step 93** (node 46 s; survey ON): the re-entry passes over the E door (its stance walk is this walk) and over the
S door's hold. That hold is refused by name: *"no REACHABLE stance inside buttonroom@880,768"*, because the chest and the
tree are in the way. The order goes to `chest@880,816`, the first link of the S door's chain (chest → tree → buttonroom →
S door). The walk to the chest's stance meets `bobsoldier@880,832` and the spinners `@816,848`/`@880,848`. The danger
ladder ends in *"kill (spinner@880,848) by press: the player died at t1266 (chaser bob@736,752) … PRESS_KILL_REBOOT_GUARD"*.
**STOP: that is `execKillByPress`, the hammer arc's.** FIREPUSH saw the same refusal on leg 404 (`L40 Chest`), and this
slice's sweep shows it on legs 387/404 in both arms.

**Witness.** No game witness: the D2 change is a planner-side order choice, and the new end is a refusal (nothing new
to play). The room facts it rests on are the atlas, the AS3 (`ButtonRoom.as` latch) and the stance hypothesis.

**Rows** (`fidelityL40Res.test.js`, the step-93 boot in `fixtures/l40res-witness/step93-boot.json`): the switch defaults;
the hypothesis measurement; OFF = the survey's text; ON = the chest route and the press-kill end (~110 s, the longest row).

**Mutant M2** (predicted: only the ON row red; copy + restore, `cmp` clean): `nextPastReentry` returns `null` → the ON row
red with the STANCE_REENTRY text back, 3 rows green. ✔

## D1 — gap 2, leg 368 at seam 5290 (STOP for the hit; PASS for the model gap the witness found)

**The witness** (p4g `seedling_bot_ap_p4g`, headless logic-only, damage on, `SEEDLING_PORT=9729`; `tools/gamewitness.mjs`
plays a tape and keeps every mobile and the status per tick). The tape is the solver's own 1600 t plan at seam 5290,
re-staged from the captured request (`tools/req2tape.mjs`, `tools/plan2tape.mjs`).
- **The game hits the player once: t1222 at (209.20268562891582, 147.76630485663475).** That is the sweep's tick and point.
- **The model replay of the same tape bills the same hit at t1222**: `spinner-hammer`, `spinner@192,144`, hits 1. Its
  player matches the game at every tick through 1600, to the bit.
- **The solver's own `expected` row at t1222 is (209.2027, 147.7663)**: the knocked-back position (y +1.93 against the
  walk's −1.46/tick).

The model planned the hit. **What the brief got wrong:** "the model planned it hit-free … a model/game contact
divergence". It is neither.

**Why the solver accepted it.**
- The hit is inside the `walk` from (279,215) to (200,136) after `break(breakablerock@176,128)`. That walk carries a planned
  sword dash (windows at walk offsets 0 [+0/+2/+8] and 36). Its own press (`right`+`primary`, t1198-1199) strikes
  `spinner@192,144` on tick 1204 (hits 0 → 1, knockback).
- The dash certificate (`planSwordDash` → `certify` → `probeSamples` → `dangerDuringTransit`) carries the walk's own
  `chasers`, `arrows`, `spits`, `grenades` and `corridorBodies` per sample, but **no spinners**. So `spinnerDanger` prices
  the hammer from `run.spinnerForecast`, which knows nothing of the walk's presses.
- Measured (`tools/forecast.mjs`, pinned as a row): from any tick ≤ 1204, that forecast puts `spinner@192,144` at
  **(231.113,147.757)** at t1222; the struck body is at **(205.557,135.582)**, **28.31 px** away. The hammer line that hits
  the player swings from the second point.
- **STOP — the hit-aware spinner forecast is the hammer arc's** (`spinnerForecastWithPress`, the brief's hand-over clause).

**Hand-over to the hammer arc:**
- **What:** a dashed (or struck) walk's certificate must price a spinner its own press moves. Per sample, the walk's
  spinners as its strikes leave them, read by `dangerDuringTransit`'s spinner arm, as `s.chasers` is for chasers.
- **Where:** `solverBot.probeSamples` / `previewWalk`'s sample rows, `dangerMap.spinnerDanger`.
- **The measurement:** `fidelityL40Res` row *"THE GAP"*; witness `fixtures/l40res-witness/l40res-368-s5290.json`.
- **Also:** the drive does not refuse the planned-but-uncertified hit after the fact.

**The model gap the witness found: `spinnerLockLag` (PASS; OFF).**
- `tools/spindiv.mjs` compares every model spinner against the game each tick. Apart from t1600 (the pickup-freeze repeat,
  on all five), **one body diverges: `spinner@192,160` at t1172.** The game reflects in x off `wandlock@208,160` (x stays
  204.950, vx flips); the model's passes (205.657) and is 18.4 px off by t1196.
- The AS3: `Game.loadlevel` adds `lock`/`rocklock`/`cover`/`grasslock`/`wandlock` (`Game.as:2355-2364`) before `spinner`
  (`:2416`), and `World.addUpdate` prepends. So each frame is Spinner → the lock family → ButtonRoom → … → Player. The
  player (added first) walks through a lock on its turn-off frame; a spinner sweeps it Solid.
- The model steps spinners at the top of a tick and `stepActivators` at its end, so a spinner read the turn-off one tick
  early. This is the third update-order shape after FIREPUSH's pulser lag.
- **The change** (`levelRun.spinnerCtx`; `contactFidelity.js`: `spinnerLockLag: false`, `SEEDLING_SPINNER_LOCK_LAG=0|1`):
  ON, the spinner's `openActivators` comes from `activators.openActivatorIdsBeforeLatestStep`, which leaves out a fade
  responder (the `RESPONDERS` table less touch/key) that turned off on the latest step (`held === opensOnTick(fade)`).
- **No new run state:** `held` is in `activatorStates`, already IN `stateDigestParts`' `visit`. Nothing for the digest
  audit, and no `DIGEST_EXEMPT` row.
- **ON:** every spinner of the part room matches the game bit-exactly t1160-1230 (213 rows), and through t1599 in the scratch
  compare. The player still matches every tick, with the one hit.
- **Named bound:** `spinnerForecast` reuses one ctx for its horizon, so ON it carries a just-turned-off responder Solid
  past its first row. That is its existing frozen-world bound (a responder opening inside the horizon is not foreseen), one
  tick longer.
- **Not measured:** the closing edge (`returnToNormal`, the symmetric lag), and other bodies added after the lock family.
  Residue.

**The solver at 5290 does not move under `spinnerLockLag`** (`evidence/seam368-lag.txt`): 13 of 13 seam answers are
byte-identical OFF vs ON. The bounce is not on the hit's path, so the hand-over stands as the fix for the hit.

**Leg 371 (← L42), measured only** (`evidence/seam371.txt`):
- Captured at seam 5235, it refuses at 12 of 13 seam times (5229-5240): *"kill (spinner@192,160) by press: every key set …
  There is no step out … the HAMMER-PHASE rung … from t1342 NO PHASE admits a step"*. It plans at 5241.
- In this slice's sweep (seams 5521/5564) it refuses at the paced hold (*"spinner:spinner@192,160 at paced tick 29"*),
  equal in both arms.
- **Handed to the hammer arc** as the brief said (press kill / hammer phase).

**Rows** (`fidelityL40Res`): the witness facts; the model's 0 px replay and its one hit; `spinnerLockLag` OFF (the t1172
divergence, to the bit) and ON (every spinner, every player tick); THE GAP (28.31 px).

**Mutant M1** (predicted: only the ON-spinners row red): `openActivatorIdsBeforeLatestStep` returns `openActivatorIds` →
exactly that row red. ✔

## The movers: before → after

**Route survey, full** (local, `survey-seedling-route.mjs --through=end --route=full`, OFF vs both env switches `=1`;
`evidence/survey-full-{off,on}.txt`, step / level / verdict / ticks / family / refusal tail). 239 rows, 13 min per arm.
- OFF: SOLVED 186 / REFUSED 53. ON: SOLVED 186 / REFUSED 53.
- **Exactly one row differs: step 93 (L40 Totem Part 64,144), REFUSED → REFUSED**: STANCE-REENTRY → the press-kill death
  at t1266 (above).
- Every SOLVED step has the same tick count in both arms. That includes L18, L39, L40 and L92 (the spinner rooms:
  steps 27, 66, 67, 92, 93, 95, 133, 134, 153, 154).

**Keyed sweep** (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g`):
- 53 legs re-derived at this base: every leg in L18/L39/L40/L41/L42/L92 (`evidence/sweep-leg-keys.txt`).
- Arm A = the 62 default-ON keys; arm B = the 62 + `stanceReentryNextDoor,spinnerLockLag`.
- ×1 each (A1 shared the box with the survey; ×2 is the planner's CI dispatch below).
- `evidence/sweep-{A1,B1}.jsonl`, `sweep-summary.txt`. **50 of 53 equal.** The three that differ are all A1 **timeouts**
  under the survey's load:

| leg | key | A1 | B1 | decided on B1's captured request, node, OFF vs ON |
|---|---|---|---|---|
| 368 | `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` | timeout (seam 6071) | done, 0 hits (6089) | plan `32f29414cd8e` both |
| 387 | `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest` | timeout | failed (`kill (spinner@880,848) by press`, death t1320) | refusal `1ed3f853fbf3` both |
| 404 | `level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest` | timeout | failed (the same, death t1165) | refusal `55926686012e` both |

**0 key-driven sweep movers.** Totals: A1 done 39 / failed 11 / timeout 3; B1 done 40 / failed 13.

**Probes standard, ON** (both literals flipped to `true` in a scratch edit, restored after, `cmp` clean;
`--host=http://localhost:9729`; `evidence/probe-battery-standard-on.txt`): **11/11 ALL CHECKS PASSED** (342 PASS rows, BOOT-RETRIES 0 each), `arrival-composites` included (95 PASS rows).

**Bounded vitest, ON** (137 files; each key ON by its env switch):

| arm | tests | red |
|---|---|---|
| `SEEDLING_SPINNER_LOCK_LAG=1` | 3,345 | **1**: `contactFidelity.test.js > the shipped defaults: all three ON` (the defaults table; this run predates its re-pin `2493159e`, and a flip re-pins it) |
| `SEEDLING_STANCE_REENTRY_NEXT_DOOR=1` | 3,345 | the same 1 |

**tapeRunner ON** (each arm): **635, `88fc7df4dd05d11dfd84ebbea675cc8e`**, identical to the base. No committed tape moves
under either key, including every L18/L39/L40/L92 tape.

**The dispatches for the planner** (branch `claude/seedling-l40-wandlock-hold-tbqn4x`):
1. `seedling-divergence-sweep.yml`, `keys=<evidence/sweep-leg-keys.txt, '|'-joined>`, ×2 per arm:
   - (A) `contact_fidelity=<the 62 defaults>` (the control);
   - (B) the 62 + `stanceReentryNextDoor,spinnerLockLag`.
   - Add `capture_requests` on (B), and `seam_census=-3..3` for legs 368/371/387/404.
2. `seedling-survey.yml`, `--through=end --route=full`, arm (B) against the control. Expected: only step 93 moves, REFUSED
   → REFUSED.
3. `seedling-probe.yml battery=standard` with arm (B). The probes read the page's settings, so the planner's CI arm
   switches them as FIREPUSH's did.

## The JS arc

- **Pins that move:** none at the defaults. On a flip, `contactFidelity.test.js`'s defaults table and the flashPanel
  settings rows (`seedlingContactStanceReentryNextDoor`, `seedlingContactSpinnerLockLag`, derived from
  `CONTACT_FIDELITY_KEYS` automatically).
- **Nothing of theirs was edited.** No new `SolverRefusal.obstacle.kind`; no `run.*` field renamed or reshaped.
  `openActivatorIdsBeforeLatestStep` is a new `activators.js` export read only by `levelRun.spinnerCtx`.
- **The skin renderer** reads run state: unchanged (no field moved).
- **`producer:walker` rows:** none. The walker was not touched; the sweep ran `producer=solver`.
- **To wire:** nothing new. ON, step 93's refusal text changes; the JS arc's `long` battery does not end there.

## Handed over

- **Hammer arc (1): the hit-aware certificate.** A dashed/striking walk's `probeSamples` prices spinners from the
  press-blind `run.spinnerForecast` (leg 368 at seam 5290: 28.31 px; the game and the model both hit at t1222).
  Measurement and witness above.
- **Hammer arc (2): `kill (spinner@880,848) by press` dies** (chaser `bob@736,752`, `PRESS_KILL_REBOOT_GUARD`):
  - step 93's new end with `stanceReentryNextDoor` ON;
  - legs 387/404 (`Level 040 - Chest`) in both arms.
- **Hammer arc (3): leg 371's `kill (spinner@192,160) by press`** HAMMER-PHASE no-step-out (12 of 13 seams), and its paced-hold
  refusal at seams 5521/5564.
- **Nothing for the js-route-census slice:** no bound was hit.

## Deltas

| row | base | head |
|---|---|---|
| identity block | md5 `161dab65…` | **byte-identical** `161dab658ab243a98241f743a78f9157` (every row, the six `--check`s, the 4 environmental DIFFERs; `evidence/identity-after.txt`) |
| tapeRunner | 635, `88fc7df4…` | **635, `88fc7df4dd05d11dfd84ebbea675cc8e`** (defaults and both ON arms) |
| bounded vitest (defaults) | 136 files, 3,333 pass | **137 files, 3,345 / 3,345 pass** (+10 `fidelityL40Res`, +2 the derived flashPanel settings rows for the two keys), md5 `b7822f3441a26d8263954a7be0983fa1` |
| surface census | 347 rows | 347, re-sealed: `CONTACT_FIDELITY` read sites 120 → 121 (`solverBot.js` 91 → 92: `frontierRest`); the rest are line moves |
| constants census | 6,908 | 6,911, PASS, 0 new / 0 vanished (748 moved by line shifts) |
| entities / profile | 566 / 138 | 566 / 138 PASS |
| roster | 289 | 289 (no tape added; `fixtures/l40res-witness/` is not a tape directory) |
| reference | 4 environmental DIFFER | the docs index regenerated for the log entry (444,420 → 444,978 words); the environmental four not committed |
| branch CI | — | `ci-vitest-summary.mjs 61448b08` (run 40119130044): **unfiltered vitest 22,610 passed, 0 failed; slow battery 268 passed**. Later commits are docs/evidence only |

## What the brief got wrong (measured)

1. **Gap 1, "a stance-choice defect, or the room's real order":** the second, and the derivation already had it. The hold
   stance was derived reachable through the south door, the room's real entry. The walk to the stance chose the west door
   again. The fix is the walk's door choice; the stance is right.
2. **Gap 2, "the model planned it hit-free … a model/game contact divergence":** no. The model replay takes the hit at
   t1222 to the bit, and the solver's expected trajectory carries it. The certificate under the dash is press-blind for
   spinners (the hammer arc's region).
3. **"spinners `spinner@192,128`/`@192,160` are near":** the hitter is `spinner@192,144`, the one the walk's own press
   struck at t1204. `@192,160` diverged elsewhere (the lock lag), off the hit's path.
4. **Leg 371 "refuses at `kill (spinner@192,160) by press` in 4/5 samples":** at this base it does so at 12 of 13 seam
   times, and at seams 5521/5564 it refuses earlier, at the paced hold. Both are the hammer arc's.
5. Leg ids at this base are as the brief named them (368, 371); survey step 93 is the brief's.

## Residue

- The stance hypothesis has no CHEST and no TREE. So the S door's hold is refused ("no REACHABLE stance") rather than
  derived with those as prerequisites; the next-door walk reaches the chest only because it is the next frontier entry.
  A `stancePrerequisite` arm for a chest / burnable tree would make that order derived rather than incidental.
- The rules (`level_40__r23c29`) put the L39 arrival and the lock room in one region, `True_`. In the game, entering
  needs the S door's chain (Fire for the tree). The Purple Key's own access implies Fire + Sword in this seed, so no rules
  gap shows. Noted for rules-2, not edited.
- `spinnerLockLag`: the closing edge (`returnToNormal`) and bodies other than Spinner that update before the lock family
  are not measured.
- The `tools/` scripts are scratch instruments: they name their scratchpad paths, and are kept for reproduction.

## Byte-inertia

Both keys are OFF:
- the identity block and the six `--check`s are byte-identical base → head;
- tapeRunner is byte-identical (also in each ON arm);
- the defaults' bounded set is all green.

No committed tape, producer digest, rules, AS3, wasm or gitlink moved.

## Rows to BANK

- `stanceReentryNextDoor` (OFF): `fidelityL40Res` D2 rows; survey step 93 changes family (REFUSED → REFUSED, the hammer
  arc's press kill).
- `spinnerLockLag` (OFF): `fidelityL40Res` D1 rows; witness `fixtures/l40res-witness/l40res-368-s5290.json` (p4g, 0 px on
  every spinner and every player tick, ON).
- The hand-over measurement (`THE GAP` row) for the hammer arc's hit-aware certificate.
- Trap candidates (in the log):
  - a sweep "game hit" can be the model's own (replay before calling it a divergence);
  - a certificate that previews presses must price every body family they move;
  - "updates before the responders" is a third order;
  - read the hypothesis before calling a STANCE_REENTRY stance wrong.
