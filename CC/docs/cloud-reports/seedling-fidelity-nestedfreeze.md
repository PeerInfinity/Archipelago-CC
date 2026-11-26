# seedling-fidelity-nestedfreeze — a pickup ceremony that starts inside a rock's freeze span (wave 57)

⚖ GO: Robert 2026-11-23 (planning-23's session), *"W57: nested freeze (Recommended)"*, plus the launch GO for this brief.
Scope: ONE new `contactFidelity` key, default OFF. No flip, no default change, and no change to any existing key's ON
branch. Wave 56's interim refusal is replaced under this key only.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-23` |
| Base | `49307847962c0c6032ac5ff572c7c7653629072b` (the W56 harvest). Measured there with node imports: **147 keys, 126 ON**, the last nine as the brief lists them; `SOLVER_ENV_NAMES` **238**, sorted, no duplicates |
| Harness branch | `claude/seedling-nested-freeze-pickup-0l1af3` (local `seedling-fidelity-nestedfreeze`). The only branch pushed |
| Commits | D2 `b519de0b` (the code, the key, the pins, the rows, the census and surface regen) · `ad22b8fe` (one row made env-proof: **the last CODE commit**) · evidence and this report (the head) |
| Verdict | **PASS for the button's frame A (modelled: texted and text-less, either side of the button). STOP, named, for the rest:** the rope (it cannot nest), the wand's snap (wave 56's refusal stands) and the plain pickups (not in the model's detection). OFF is byte-identical: `levelRun.js` takes 88 inserted lines and 5 changed, every one inert with the key OFF. The acceptance md5 is the standing value at all four settings. 294/294 tapes give ON = OFF. **0 legs** can move ON |

**The one thing to know first:** inside the union, the rock adds no dead frames and steps no family.
- On a button's frame A, the pickup's phase A IS the rock's span. A+1..A+149 have no writer that lowers the flag, and the
  rock lands inside them (span frame 81 of 172 on L29).
- So the union costs the ceremony's own 150 dead frames, not 172 + 150, and the player takes no rock release step.
- Measured per tick on the staged L29 rows (clock, player, turrets, bombs): ON equals the same walk with the button
  removed, which is the same ceremony with no rock. That holds alone and with all eight neighbour keys ON.
- The rock's release R only moves the camera, and the button path models no rock camera (wave 56's residue).

## D1 — the AS3 and the model

### D1.1 — the union, frame by frame

**The AS3:**
- `Button.update` (`Puzzlements/Button.as:27-39`) has no freeze gate. It presses on any overlap of the player's box at the
  start of the frame, the post-(A−1) box, and its `activate` reaches `FallRock.set activate` → `fall()`
  (`Scenery/FallRock.as:103-115`: the persistence write, `trigger`, `freezeObjects = true`, `waitToFallTimer = 60`).
- `FallRock.update` (`:51-101`):
  - the wait (`:67-70`), then the fall (`:73-74`);
  - the landing (`:76-84`: `cameraTimer = 90`, Solid, `Game.shake = 30`);
  - the countdown (`:88-91`), and R (`:92-97`: `cameraTimer == 0` → `freezeObjects = false; resetCamera()`).
  - `resetCamera` is `cameraTarget = (-1,-1)` (`Game.as:2026-2029`).
  - On L29 that is wait A+1..A+60, fall A+61..A+81 (landing at A+81), countdown A+82..A+171, and **R at A+172**. That
    is the model's `frames` of 172 and `landedAt` of 81, read off `rockFalls`.
- `Pickup.update` / `pick_up` (`Pickups/Pickup.as:50-124`):
  - the collide (`:78-84`) is outside `Mobile`'s gate, so frame A collects a pickup under the post-(A−1) box;
  - `pick_up` raises the flag on every frame (`:95`) and counts `specialTimer` 150 → 0 (`:96-98`);
  - at 0 a texted pickup adds its NPC, with `setTemp` → `Game.talking` (`:99-104`);
  - at 0 a text-less pickup takes the `!myText` arm on the next frame: `freezeObjects = false; removeSelf()` (`:106-112`).
- `Game.update`'s tail (`Game.as:1044-1051`): while `Game.talking`, `canInventory()` is false and
  `inventory.open = false` lowers the flag at the end of the frame.
- **The update order** (`Game.loadlevel`; `addUpdate` prepends): runtime adds, then `fallrock` (`:2353`), `pull`
  (`:2352`), `bosskey`/`totempart`/`health`/`seed` (`:2348-2351`), `arrowtrap`/`buttonroom` (`:2342-2343`), `button`
  (`:2341`), `apitem` … `fire` (`:2330-2340`), then the families (turrets `:2295`, towers `:2297`, drills `:2290`,
  chasers `:2276-2301`) and the player (`:2250`).
  - On frame A the rock is not triggered yet, since it updates first.
  - A pickup before the button (L29's `bosskey`) and one after it (`feather`) both test the post-(A−1) box, so both
    collect on A.
  - Between them sit only `arrowtrap`/`buttonroom`, and the arrow trap is a named rock-room residue.

**The frame tables.** The flag is given at each family's update. "Before P" means families updating before the pickup
(the rock, pull, and the runtime adds); "after P" means every family below the pickups (turrets, towers, drills,
chasers, the player).

*Button × texted special* (the staged `feather@112,127`, after the button):

| game frame | writers, in update order | flag before P / after P | observed? | the model |
|---|---|---|---|---|
| A | button `fall()` true; the pickup collects (150→149) true | false / true | yes (A−1 ended down) | the contact tick T = A (t24): the ceremony's own path, its main-slot predicates (`pickupTickFreeze`) |
| A+1..A+60 | the pickup true (the rock waits) | true / true | dead | phase A's lumps (turrets 150, bombs 150, towers 149, pushables, the chasers' lump) |
| A+61..A+81 | the pickup true (the rock falls, lands at A+81: Solid, shake 30) | true / true | dead | the same; the rock stepped alone (`dropRocksTogether` nested), landed from T |
| A+82..A+148 | the pickup true (the countdown) | true / true | dead | the same |
| A+149 | the pickup 1→0, NPC added, talking; lowered at the end | true / true | dead | the same (149 dead) |
| A+150.. | per dialogue frame: the rock counts down (no write); the pickup true; lowered at the end | false / true | yes | the ceremony's dialogue ticks, unchanged (`dialogueFrameFreeze`, `freezeEdgeFrames`) |
| A+172 (if in dialogue) | the rock's R: false and `resetCamera`, then the pickup true | false / true | yes | nothing: the flag was already down; the camera is not modelled on the button path |
| C | the NPC closes, the pickup re-raises | false / true | yes | the finishing tick (C's main slots, frozen) |
| C+1 = the pickup's R | the pickup's `!myText`: false, `removeSelf` | true / false | dead (C ended up) | the finishing tick's R (`freezeReleaseTick`), the fall-through step |

- **The end:** the union ends at the pickup's R. Here that is t41's finishing tick, with the feather collected on t41.
- **What R means:** the rock's R is a no-op on the flag, and it moves only the camera.
- **A short dialogue:** if C+1 < A+172, the rock's last frames are live, with the camera at the rock. The model does not
  hold that camera on any button drop (residue).

*Button × text-less special* (L29's own green key, `bosskey keyType 1`, before the button):

| game frame | writers | flag before P / after P | observed? | the model |
|---|---|---|---|---|
| A | the pickup collects (true), then the button's `fall()` (true) | false / true | yes | T = A (t24) |
| A+1..A+149 | the pickup true (the rock waits, falls, lands at A+81) | true / true | dead | phase A's lumps; the rock alone |
| A+150 | the pickup's `!myText`: false, `removeSelf` | true / false | dead (A+149 ended up) | the contact tick's fall-through live step (the player steps; `pickupTickFreeze`'s F+150 turret release) |
| A+151..A+171 | nobody raises the flag; the rock counts down with the camera at it | false / false | yes (live) | live ticks; the rock's camera is not modelled (residue) |
| A+172 | the rock's R: false (already down), `resetCamera` | false / false | yes | nothing |

- **The end:** the union ends EARLY, on A+150. The model collects the key on t25, against OFF's t26.
- **What R means:** the rock's freeze is cut by the pickup, and its R moves only the camera.

*Button × plain (`APItem`, `Coin`):* collected on A, with no freeze (`pick_up`'s `else removeSelf()`, `:120-123`). There
is no union. **STOP on that part** (below).

*Rope:*
- The pull is `slash()` → `genericHit` (`Player.as:892-925`), which **returns under the flag** (`:1073-1078`).
- A pickup collected on P updates before the player (`:2330-2351` vs `:2250`). It raises the flag first, so the pull on
  P lands nothing.
- A pickup not under the post-(P−1) box stays off it through the span, because the player does not move.
- **So the rope never nests.** The landing snap is refused by name already (`publishRopeGroup`).

*Wand:*
- Its rocks fall at the wand ceremony's end (`dropRocksTogether`), with L43's BossTotem stepping every span frame (it has
  no freeze test).
- A pickup at the snapped position would be collected at the landing frame, MID-span, so its phase A would run while
  the boss rides on. No ceremony path steps a BossTotem through phase A.
- **STOP:** wave 56's refusal stands.

### D1.2 — the model's map

- **The collapsed spans:**
  - `dropRock` (rope, `levelRun.js:4011`ff): the rock and, under their own keys, the pushables, turrets, drills, chasers,
    activators and camera.
  - `dropRocksTogether` (button and wand, `:4087`): the rock; the pushables, turrets, drill graphics, chasers and boss,
    each under its own key; the release bodies; `spendFrozen`; `pendingFreeSteps += 1`.
  - `resolveButtonFalls` (`:16116`).
  - The frame-A branch: `pendingButtonFalls`, `:23134`ff, which is `runFrozenTick` + `resolveButtonFalls` + the
    `buttonFallReleaseStep`.
- **The ceremony:**
  - the starts at `:23710-23905` (runtime Seed, DarkSword and Fire, then a placed pickup);
  - `spendCeremonyPhaseA` and the phase-A lumps (`stepShootersThroughFreeze`, `stepBombsThroughFreeze`,
    `stepBeamTowersThroughPhaseANow`, the pushables, `armCeremonyLumpNow`);
  - the ceremony branch, `stepCeremonyReleaseFrameNow` and `stepCeremonyReleaseFamiliesNow`;
  - the contact tick's `runFrozenTick(…, 'a pickup ceremony')`.
- **Wave 56's refusal sites:** `assertNoPickupInRockSpanNow` (`:14984`) at frame A and at the wand's snap (`:24218`).
- **The detection:** `pickupUnderfoot` and `predictPickupCeremonyStart`. `takeApItem` is a tell, not a detection: the run
  never models an `APItem`'s contact.

### D1.3 — the change chosen

**The smallest change composes the two existing paths. It forks neither.**

1. **`nestedRockCeremonyAtFrameANow(ids)`** sits in the frame-A branch's condition.
   - With the key ON and `predictPickupCeremonyStart()` non-null, it records `nestedRockFall`, clears
     `pendingButtonFalls`, holds the ids in flight, and returns true.
   - The branch then does not run. The tick falls through as the ceremony's contact tick, the same tick a pickup under
     the post-(A−1) box with no button would be.
2. **`startNestedRockSpanNow()`** sits at the detection, below the four starts and above
   `assertPickupFreezeAheadHeld`.
   - It checks that the predicted ceremony started on this tick. If not, it refuses by name.
   - It runs `resolveButtonFalls(ids, { nested: tag })` with the same refusals (a pulser, a boss, the snap).
   - `dropRocksTogether`'s `nested` steps the rocks ALONE: no family step, no `spendFrozen` and no `pendingFreeSteps`.
     The rocks' rows carry `deadFrames: 0`, `spanFrames`, `landedAt` and `nestedIn`.
   - It refuses a landing outside phase A's 149 dead frames, where a Solid would appear on an observed frame.
3. **`runFrozenTick` refuses** a frame-A fall-through that froze before its detection.

**What it does to:**
- **`spitForecastNow` and the hammer forecasts:** no line changed. After the union they start from the ceremony's state,
  which is the per-tick no-rock picture.
- **Wave 50's turret slot** (`turretSlotContact`, `turretHitPlayerNow`): untouched. The contact tick's slots run as for
  any T, and `runFrozenTick`'s TURRETSUIT check still guards the frozen exit.
- **Waves 51–56's predicates and keys:**
  - `pickupTickFreeze`: the frame-A tick is now a real T, so its slots predict the ceremony correctly. OFF of this key,
    a predicted T at frame A was pre-empted by the button's frozen tick.
  - `dialogueFrameFreeze`, `frozenTickUngated`, `freezeEdgeFrames` and `freezeReleaseTick`: not asked by the new sites.
    The ceremony's own steps run once each. The rock span's family steps (`stepRockSpanShootersNow`,
    `stepRockReleaseBodiesNow`, `stepChasersFrozenNow`, `stepDrillGraphicsFrozen`, the pushables) are not taken, because
    their frames ARE phase A's.
  - `freezeSpanUpdates`: its frame-A refusal is not reached when this key models. With this key OFF it is unchanged
    (row). Its wand-snap refusal and its tower lump are untouched.
  - No existing key's ON line moved.
- **The keys it needs ON:** none for its own claim (T, the end frame, the dead frames, the clock, the rock). Each family
  is as exact as the ceremony's keys make it, exactly as for the same ceremony without a rock: wave 56's three for a
  tower, and `pickupTickFreeze` for a text-less pickup's turrets. With them OFF it answers what that ceremony answers.
- **STOP rule:**
  - **Triggered for the plain pickups.** An `APItem`'s contact is not modelled (F2: the observer tells the run through
    `takeApItem`), and coins are not modelled at all. Adding them is a detection plus an item path, not a detection call.
  - **The wand's snap:** a mid-span T beside the BossTotem, which no phase-A lump steps.
  - **The rope:** nothing to model (it cannot nest).

## D2 — the key

`CONTACT_FIDELITY.nestedRockCeremony`:
- It is **OFF** and appended LAST: **148 keys, 126 ON**, from a node import of `contactFidelity.js` (which works, as at
  wave 56).
- Its env is `SEEDLING_NESTED_ROCK_CEREMONY=0|1`.
- Its `SOLVER_ENV_NAMES` entry sits after `SEEDLING_MOVING_WAIT`, before `SEEDLING_NON_CHASER_REMOVAL_BLOCKS`. A node import
  of `solverEnvChannel.js` gives **239**, sorted, no duplicates.

Its doc block, in brief:

> fidelity NESTEDFREEZE D2 (wave 57) — A PICKUP CEREMONY THAT STARTS INSIDE A BUTTON-DROPPED ROCK'S SPAN, ON ITS FRAME A
> … every pickup tests the SAME box on frame A … From A the two run together … No frame of A+1..A+149 has a writer that
> lowers the flag, so they are phase A's 149 dead frames, with the rock landing inside them … its R … moves only the
> camera. A text-less pickup … ends the union EARLY … ON … the tick falls through as the pickup's contact tick T = A …
> the rock is resolved at the detection ALONE … Not modelled, named: the rock's camera …; the rope (… `genericHit` …)
> and the wand's landing snap …; the plain pickups … OFF: byte-identical.

**Key-order pins**, found by grep rather than a list:
- the 21 tail lists ending `'freezeSpanUpdates']` now end `'freezeSpanUpdates', 'nestedRockCeremony']`;
- `contactFidelity.test.js`: the defaults row and the env guard;
- `fidelityFreezeSpanUpdates.test.js`: its `.at(-1)` became the tail `[KEY, 'nestedRockCeremony']`.

`fidelityFencepost`'s SOURCE-SHAPE pin is untouched: nothing was added near `spinnersSteppedThisTick`. The one-spelling
law is green, since the test imports only what wave 56's file imports.

### Rows (`fidelityNestedRockCeremony.test.js`, fast tier, 8 rows)

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| texted (`feather@112,127`, after the button) | rock t25 172 dead, the ceremony t25: spans `freeze 172` + `ceremony 150`. `freezeSpanUpdates` alone: refused at frame A (t24) | T **t24**; the rock row `{t24, deadFrames 0, spanFrames 172, landedAt 81, nestedIn feather}`; spans `ceremony 150` only; dead −172; the clock −172 from t30 to t50; collected **t41**; the player held at the post-(A−1) box t24..t40 (OFF's release step moves it at t25). With `freezeSpanUpdates` ON too: the same, whole result |
| text-less (L29's green key, before the button) | rock t25 172, the ceremony t25, collected t26 | T **t24**, collected **t25**; spans `ceremony 150`; the clock −172; the contact tick steps the player (F+150). The same with `freezeSpanUpdates` ON |
| every family, per tick (+ `turret@40,40` beside L29's own) | — | ON = the same walk with the button REMOVED (the clock, the player, the turrets, the bombs, the spit count), for both pickups; ≠ OFF |
| composition (all eight: `freezeSpanUpdates`, `freezeReleaseTick`, `freezeEdgeFrames`, `frozenTickUngated`, `pickupTickFreeze`, `dialogueFrameFreeze`, `turretSuitRetaliation`, `owlContactInStep`) | wave 56's frame-A refusal | the same starts, collected, falls and spans as solo; per tick = the no-rock ceremony under the eight |
| release-step reach (`feather@112,126`) | collected on R+1 (t25) | **ON = OFF**, the whole result; under the eight too |
| the button, no pickup | — | **ON = OFF**, the whole result; under the eight too |
| rope (`rockbutton-l28-livefall`) | fall t155, 181 dead | **ON = OFF** (stream with the clock); under the eight too |

**Mutants.** Each was applied to `levelRun.js` at `b519de0b`, run over 4 files and 38 rows, then restored with
`git checkout`. After each, the `MUTANT` count was 0 and the file equalled the commit (`d2/mutant-M*.txt`,
`d2/mutants-predicted.txt`). The 4 files: `fidelityNestedRockCeremony`, `fidelityFreezeSpanUpdates`,
`fidelityRockButton` and `fidelityPickupFreeze`.
1. **The union also spends the rock's frames.** Predicted: texted, text-less, every-family and composition. Measured:
   **exactly those 4**.
2. **The frame-A ask never takes the union.** Predicted: the same 4. Measured: **exactly those 4**.
3. **The nested loop steps the families.** Predicted 2: every-family and composition. Measured **1**: composition.
   ⚠ **A prediction miss**, explained: with this key alone every span family step is itself behind a wave-53/54 key
   (`freezeEdgeFrames`, `frozenTickUngated`, `drillTimedPass`), so it is a no-op. The pushables' step is guarded on its
   own line, which M3 did not remove. Only the composition row (the eight ON) can see them, and it does.
4. **The detection never resolves the rocks.** Predicted: the same 4 as 1. Measured: **exactly those 4**.

⚠ **Not game-witnessed:** every ON row. The pieces are the AS3 lines above and the model's own ceremony and rock steps.
The no-rock equivalence is a model-to-model check of composition, not a witness.

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only 49307847 b519de0b | grep -aE 'fixtures/|golden|tapes/'` is EMPTY
  (`d3/byte-inertia.txt`). `ad22b8fe` touches only the new test file.
- **Acceptance.** `batch-seedling-acceptance.mjs | md5sum` gives the standing **`391322d681b7aa0229d94b3f6906d024`** at
  all four settings (`d3/acceptance-*.md5`):
  - the base;
  - the head OFF;
  - the head with this key ON;
  - the head with this key and all eight ON.

  It gives the same again with the census probe in.
- **Committed tapes.** All **294** replay byte-identical ON vs OFF. They do so again with the eight ON on both sides
  (`d3/tapes-onoff.txt`).
- **The census, by method:**
  - The ON site is reachable only at a button-dropped rock's frame A with a ceremony predicted.
  - The rock-button rooms are **L29** (`button@112,128` → `fallrock@112,112`) and **L74** (`button@288,128` →
    `fallrock@288,144`). L28's `button@112,240` (tset 0) drops nothing. Wave 56's `d1/pickuprooms.json` covers all of
    them.
  - **L29's** only pickup, `bosskey@112,64`, is 64 px above the button, with the rock between. **L74's** `darkshield@48,32`
    is 240 px off.
  - Neither room has a runtime pickup.
- **Legs** (`seedling-divergence-legs.mjs`, **915** at my head; `d3/leg-census.txt`): **10** are in a room with the ON
  site (L29 290–296, L74 609–611), and **0** can reach it.
- **Runtime confirmation** (`d3/census-probe.txt`): a temporary line at `nestedRockCeremonyAtFrameANow` (copied in, then
  restored), counting every frame-A ask and every predicted ceremony there. **0 asks, 0 hits** over:
  - the 294 tapes ON (alone and with the eight);
  - the acceptance batch ON;
  - survey steps 36 (L29) and 191 (L74): `--through=end`, OFF vs ON, both 2/2 SOLVE, the rows JSON equal with the `ms`
    fields stripped.

  The survey plans boot L29's and L74's rocks already fallen (`fallrock-removed`), so no frame A happens. The probe does
  fire on the staged row (`frameA L29 t24`, `HIT … feather`).
- **Vitest ON** (the 56 gate files, `--maxWorkers=3`, `SEEDLING_NESTED_ROCK_CEREMONY=1`; `d3/vitest-on.txt`): 54/56
  files; 1366 passed, 2 failed, 2 skipped (the env-guarded "ships OFF" rows). **ON movers, both by construction:**
  - `fidelityFreezeSpanUpdates.test.js:176`, wave 56's frame-A row. Its "OFF" side (`freezeSpanUpdates` false) now
    models the union: the fall `[25, …, 172]` becomes `[24, …, 0]`. This is the replacement the brief licensed.
  - `fidelityNestedRockCeremony.test.js:104`, my texted row. Its wave-56 check left this key to the env; `ad22b8fe` names
    it OFF, and the row is now 7 passed + 1 skipped ON.
- **Train ON** (`vitest.train.config.js`, one file at a time, `SEEDLING_NESTED_ROCK_CEREMONY=1`; `d3/train-on.txt`): wave
  56's 13 `.train.` files (`d3/train-files.txt`, a superset). Of those, only `hammerWallFlyerDrillKill` names L29/L74, a
  button, a rock or a pickup by my grep.
  **13/13 files, 51 tests passed ON, 0 movers**: `hammerApproachOrder`, `hammerBaitRemoved`, `hammerBaitSubwalkGoal`,
  `hammerBodyGate`, `hammerChooserPair`, `hammerClearTagChain`, `hammerKeylockTurret`, `hammerL53Killlock`,
  `hammerL98L99`, `hammerOppDashDefers`, `hammerPitWest`, `hammerShovedLookahead`, `hammerWallFlyerDrillKill`.

### The named sweep (for the planner)

- **`nestedRockCeremony`: 0 legs.** No shipped rock-button room puts a pickup within reach of its button cell, and no
  seed-1 leg or survey plan runs a frame A at all. The probe fired 0 times on every committed tape, the acceptance batch
  and the two reached survey steps.
- Shards = min(10, 0) = 0, so there is no sweep to run. The flip gate (a hitless leg stays hitless) is vacuous on shipped
  content.
- ⚠ Belt and braces: the 10 legs in the two button rooms (L29 290–296, L74 609–611). Shards = min(10, 10) = 10, ×1 per
  arm: OFF, and `SEEDLING_NESTED_ROCK_CEREMONY=1`.

## Gates

- **Bounded vitest BEFORE** (the untouched base, 55 gate files, the new test absent): **55/55 files, 1361 passed**
  (`d3/vitest-before.txt`, `d2/gate-files-before.txt`).
- **AFTER** (`b519de0b`, OFF, 56 files): **56/56, 1370 passed** (`d3/vitest-after.txt`, `d2/gate-files-after.txt`).
  - The set:
    - `contactFidelity*`, `playerDamage*`, `levelRun*`, `fidelityPickupFreeze*`, `fidelityDialogueFreeze*`,
      `fidelityFrozenTick*`, `fidelityFreezeEdge*`, `fidelityFreezeReleaseTick*`, `fidelityFreezeSpanUpdates*`,
      `fidelityCeremony*`, `fidelityRock*`, `fidelityTurret*`, `seedlingSoundCues*`, `oneSpelling`;
    - every test file `grep -a -l` finds for the brief's 16 names and `nestedRockCeremony` (the key-order pins among
      them);
    - `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus` and
      `seedlingSolverSurface`.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, a browser arm in CI), on a
  still tree (`d3/producer-checks.txt`).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match.
- **Constants census:**
  - the first `--check` was green (3 new cosmetic/structural, 969 moves);
  - after `--write` it showed 0 drift;
  - `--profile-rows` left `seedling-constants-fields.csv` byte-identical;
  - a second `--write`, then `--check`, showed 0 drift.
- **Solver surface:** `--check` RED on line numbers only, then GREEN (374 rows) after `--write`.
- **CI** `JavaScript Unit Tests` at the code head `ad22b8fe`: run 45108893176 **success**: suite 29842 passed, 0 skipped,
  0 failed (3 shards); slow battery 446/446. Later commits are evidence and docs only.
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-nested-freeze-pickup-0l1af3 -f train_only=true`

## What the brief got wrong (measured)

1. **"A rope's pull P" as a rock source that reaches a nested pickup.** It cannot reach one.
   - The pull is `genericHit`, which returns under the flag (`Player.as:1073-1078`).
   - A pickup collected on P updates before the player, so it raises the flag first and the pull lands nothing.
   - A pickup not under the post-(P−1) box stays off it, because the player does not move through the span.
   - The only rope position is the landing snap, refused already.
   - The model's rope row is ON = OFF.
2. **"The rock's camera timer and the pickup's `specialTimer` … the flag per writer, frame by frame"** as state the model
   must newly hold. On the button path the union needs none. A+1..A+149 are phase A's dead frames for every family. The
   rock's later frames write the flag only at R, where it is already down (dialogue) or stays down (text-less), so R is
   camera-only. The union is exactly the ceremony plus a rock stepped alone.
3. **"Check it with a node import of `solverEnvChannel.js`, NOT `contactFidelity.js`."** The `contactFidelity.js`
   import works at the base and the head (147 → 148 keys), as wave 56 also found.
4. **The leg counts.** Wave 56 reported 922 legs, L74 6 (611–616). At my head `seedling-divergence-legs.mjs` gives
   **915**, L74 **3** (609–611). This is re-measured, not explained. The census answer (0) does not depend on it.

## Hand-overs

- **To the planner:**
  - the `train_only` dispatch at my head;
  - the sweep: 0 legs (optionally the 10 button-room legs);
  - at harvest, `SOLVER_ENV_NAMES`: my entry sits between `SEEDLING_MOVING_WAIT` and `SEEDLING_NON_CHASER_REMOVAL_BLOCKS`;
  - wave 56's frame-A row (`fidelityFreezeSpanUpdates.test.js:176`) moves ON by design, and a flip re-pins it.
- **To fidelity (later), beyond this licence:**
  - **Plain pickups in a rock's span** (`APItem`, coins): collected on A with no freeze. This needs an `APItem` contact
    in the run, which today is told through `takeApItem`, and coins modelled at all.
  - **The wand's landing snap with a pickup there:** a T mid-span (the landing frame) beside L43's BossTotem, which no
    phase-A lump steps. Wave 56's refusal stands.
  - **The button rock's camera**, now on live or dialogue frames after the union: the button path models no rock camera
    (`dropRocksTogether` steps none; wave 56's residue), and the union extends it by ≤ 22 frames.
  - **A union rock landing on an activator:** the rock is resolved at the detection, so the contact tick's activator
    step sees it landed. The game lands it at A+81. No rock the button paths drop lands on a button or lock (wave 56's
    census); named.
  - Carried, unchanged: a text-less pickup in a tower room (wave 56); the runtime ceremonies' turret/bomb lumps; a second
    pickup collected on a ceremony's R (wave 55); the ice turret and beam tower in a ROCK room (wave 54); the crusher,
    bomb pusher and arrow traps in a rock room.
- **To hammer:** nothing moves on shipped content. ON, a button press onto a pickup is no longer refused (with
  `freezeSpanUpdates`) or serialised: it costs 172 fewer dead frames, and the player is held through the ceremony
  instead of taking the rock's release step.

## Residue

- Every ON row is staged, not game-witnessed (no shipped room has the shape).
- The runtime pickups (Seed, DarkSword, Fire) take the union through the same predicate and their own start paths, but
  none was staged in a button room.
- The rope's "cannot nest" is argued from the AS3 and the model's existing ON = OFF rope row. A staged feather under the
  witness tape's pull position was not isolable: the walk crosses that spot at t40.
- Evidence: `seedling-fidelity-nestedfreeze-evidence/`:
  - `tools/`:
    - `nested-l29.mjs` (the staged L29 walk, per tick);
    - `tape-onoff-probe.mjs` (all tapes OFF/ON, `EXTRA` keys, the probe's counters);
  - `d2/`: the gate file lists, and the four mutants with their predictions (and the miss);
  - `d3/`: the acceptance md5s, byte-inertia, the tapes OFF/ON, the census probe, the leg census, the survey OFF/ON,
    vitest BEFORE/AFTER/ON, the train files and train ON, the producer line.
