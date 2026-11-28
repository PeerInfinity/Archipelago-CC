# Seedling fidelity SPINNERPULSE (wave 72): the Spinner's death by Pulser pulses

- **Session:** `seedling-fidelity-spinnerpulse` (planner `seedling-fidelity-planning-27`), cloud, 2026-11-28.
- **Start SHA:** `048733514ab725f77d6c711d71e184d4f78e789d` (the W71 harvest tip, `fidelity-harvest/wandkill-w71`).
- **Harness branch:** `claude/spinner-pulse-kill-fidelity-6dlgzd` (local name `seedling-fidelity-spinnerpulse`).
- **Last code head:** `eacc8f87d544da4414c7ea61df1b1a60cd705f7e` (the test file; this report is committed after it).
- **Evidence:** `CC/docs/cloud-reports/seedling-fidelity-spinnerpulse-evidence/` (`tools/`, `d1/`, `d2/`, `d3/`).

## Verdict: STOP on the brief's case, with the cause found, witnessed and pinned

**The spinner's pulse-kill path has no gap. OFF is the game, at every tick, on both level sets.** The 246 ticks wave 69
handed over are a **set mismatch** in the witness, not a modelling gap:

- Wave 69's game witness (and mine, reused) mounts `l25Sets().vanilla`. Its records carry `SEEDLING_SET_PATCHES`, and edit
  6 (`l39-fallrock-removed`) deletes `fallrock@144,624` from L39. So in the game the rope pull drops no rock and nothing
  freezes. The spinner dies at sample **t1643**.
- `runTape` replays the committed tape on the **atlas**, where the rock is placed. The pull drops it, which is a 197-frame
  span, and `publishRopeGroup` steps the group's Pulser through the span. That shifts the phase by 197 mod 51 = 44 frames.
- Put the one patched entity back (`set-with-rock.mjs`) and the game kills the spinner at sample **t1396**. The model OFF
  stamps its write at t1397. That one-tick difference is the standing `spinnerWrites` stamp, explained below.

**The arm that is wrong is `pulserDeadFrameUpdate` ON (t1207).** It steps the rope rock's span twice:

- `publishRopeGroup`'s own pre-step runs in both arms (`levelRun.js`, the loop after `dropRock` in the pull).
- `dropRock` also queues the same span when the key is ON: `queueDeadPulserFramesNow(frames, 'a rope\'s rock')`,
  `levelRun.js:4564`.

Together that is 2 × 197 mod 51 = 37, which puts every pulse after the pull 7 ticks late. Closing it means editing an
existing key's ON branch. The brief says to STOP there, so I did not change it. It is named, measured with a scratch fix,
and pinned (below).

**No key was added**, so no source file changed. That makes every OFF claim trivially byte-identical.

## D1 — the trace, the witnesses, the map

### 1. The trace (`tools/model-trace.mjs`, `tools/witness-spinner.mjs`, `tools/compare-trace.mjs`; `d1/compare.txt`)

The game stream comes from p4g on a fresh page per run, logic-only channel, `botMobiles` + `botStatus` sampled every tick.
It covers 2,765 of the 2,765 ticks on each set.

Each row is compared on `spinner@224,112`'s x, y, `hits` and `hitsTimer`, matched exactly (full doubles). The game row is
tracked by nearest neighbour.

| Game set | Model source | Arm | Game hits / ledger | Model hits / write | First divergence |
|---|---|---|---|---|---|
| rockless (the witness's) | the same set | OFF | 1068, 1109, 1632 / **1643** | 1068, 1109, 1632 / 1644 | **none** |
| rockless | the same set | `pulserDeadFrameUpdate` ON | the same | the same / 1644 | **none** (no span in the room) |
| rockless | the same set | `spinnerRemoveRead` ON | the same | the same; the body is out of the list at **1643** | **none** |
| rock (`set-with-rock.mjs`) | atlas (`runTape`'s) | OFF | 1068, 1116, 1385 / **1396**; 197 dead frames at t191 | 1068, 1116, 1385 / 1397 | **none** |
| rock | atlas | `pulserDeadFrameUpdate` ON | the same | 1072, 1123, 1195 / **1207** | **t1068** (the hit lands 4 ticks late) |
| rockless | atlas | OFF (wave 69's comparison) | 1068, 1109, 1632 / 1643 | 1068, 1116, 1385 / 1397 | t1109 (the Pulser's phase: a window at 1109 in the game, 1116 in the model) |

**The first divergence on the brief's comparison, and its cause:**

- At t1109 the spinner is at the same position to the last bit in the game and the model: (83.73…, 119.10…), `hitsTimer`
  0, inside the 22 px ring.
- The game's Pulser window starts at 1109 and the model's at 1116. So it is the Pulser's phase. It is not a hit, an
  i-frame, the knockback, friction or the death.
- The phase comes from the rock the witness's set does not have.

Everything the brief asked to compare agrees on the same set: the position at every tick; the knockback (implied by
exact positions through two force-6 shoves and their wall reflections); the 30-tick i-frames counting down; and the hit
ticks.

- The 11-frame death fade agrees too: the game's alpha at the last frame is 1.39e-16, as `SPINNER.deathTicks` derives.
- `pulseTimer` and `radius` are not readable on the page: a Pulser is not a `Mobile`, and `botMobiles` lists only
  `Mobile`s. The Pulser's phase is read off the hit ticks instead. In the rockless arm, the window holding 1109 must start
  at exactly 1109: the body was in range and hittable on 1098–1108.

### 2. The witnesses (p4g, a fresh page per run, a control per shape)

| Shape | Game | Model OFF | Verdict |
|---|---|---|---|
| (a) one pulse hit on the spinner: the knockback and the i-frames. Natural, on the committed tape: t1068, the first hit. | vx/vy 0.4617/5.1780 after the hit, `hits_timer` 30 → 0 at 1098 | exact, every tick | **NO GAP** |
| (b) repeated pulses to the kill: the count and the death's frames | the third hit at 1385 (rock) / 1632 (rockless); fade 11 frames; out at 1396 / 1643 | exact; the body is out at the game's sample with `spinnerRemoveRead` ON | **NO GAP** (the stamp: below) |
| (c) what D1.1 found: the rope rock's span through the Pulser. Shape = the rock set; control = the rockless set. | 197 dead frames run the Pulser **once** | once | **NO GAP** OFF; **GAP ON**: run twice |

- **(a) is not on a resting spinner.** A Spinner never rests: `friction()` floors `|v|` at `moveSpeed` = 1
  (`Spinner.as:124-136`). So the natural first hit on a moving spinner is the honest shape.
- **Not staged separately.** The committed tape already isolates (a) and (b) on two sets, and the shape and its control
  differ in one entity. A staged L38 shape would add a second room and reuse the same `hitSpinner`.

### 3. The map (every reader of the spinner's hits, knockback and death)

- **`hitSpinner` (`spinner.js:497`)** is `Enemy.hit` + `knockback`. Its callers in `levelRun.js`:
  - `:10756`, `stepPulsersNow`'s enemy arm, `PULSER.force`, `t: 'Pulse'`;
  - `:5993`, the `pulserForecastPulse` stepper;
  - `:7724`, fire;
  - `:8360`, the sword;
  - `:9837`, the fight forecast;
  - `:12474`, the shield or suit;
  - `:16018`, the bomb blast;
  - `:20340`, the ghost slash.
- **`stepSpinners` (`spinner.js:714`):** the live step at `:23880`, and the forecasts at `:9947`, `:21448`, `:21592` and
  `:21724`.
- **`spinnerRectsNow` (`:5469`)** feeds the pulse targets, the block solids and the press bodies. `spinnerBodiesNow`
  (`:18513`) is the body readout these rows use.
- **The removal:** `spinnerWrites.push` at `:23963` (stamp `ticksCompleted + 1`), and `settleSpinnerRemovalsNow`
  (`spinnerRemoveRead`, FENCEPOST), which keeps that stamp on purpose.
- **The kill locks:** `spinnerKillLockOpensNow` (`:20878`). The deaths: `spinnerDeaths` and `pulserEnemyKills`.
- **The danger view:** `dangerMap.spinnerDanger` reads the forecast's bodies (`pulserForecastPulse`'s doc names it).
- **The rope rock's Pulser pre-step:** `publishRopeGroup` → `dropRock` → the per-pulser loop of `dropped.frames`, armed
  `true`, only `p.t === pub.group`. Then `:4564`, the ON queue.

## D2 — no key: the rows and the mutants

**No key** (0 of the licensed 2). OFF is the game on both sets, so there is nothing to model behind a new key. The only
wrong arm belongs to an existing key, `pulserDeadFrameUpdate`.

**Rows:** `frontend/modules/seedlingDemo/fidelitySpinnerPulse.test.js` (fast tier, 7 rows, about 2.5 s). They read the
game witnesses from `d1/*.json.gz`:

- **OFF is the game at every live tick,** on the rockless set and on the rock set (two rows).
- **The hit ticks,** from the model and read independently off the game's stream: rockless 1068 / 1109 / 1632, rock
  1068 / 1116 / 1385.
- **The removal:** the game's ledger holds (39,4) at samples 1643 and 1396; the model stamps 1644 and 1397. With
  `spinnerRemoveRead` ON the body leaves the list at the game's sample.
- **The four arms of the kill write:**

  | | OFF | `pulserDeadFrameUpdate` ON |
  |---|---|---|
  | rock (atlas) | 1397 | 1207 |
  | rockless | 1644 | 1644 |

- **The double step:** the Pulser's first pulse hit is 191 with no span, 198 with the span once (OFF) and 205 with it
  twice (ON). The ON `deadPulserFrames` holds `["a rope's rock", 197]` and the OFF one is empty.
- **`runTape` is the atlas arm** (1397).

The four-arms row and the double-step row pin the defect's current values on purpose: a licensed fix turns them red, and
the fix's re-record is listed in D3.

**Mutants** (`d2/mutants.txt`; copy, break, run, restore):

| Mutant | Predicted | Shown |
|---|---|---|
| M1: the rope pull steps its Pulsers 0 frames, not the span | the rock-set rows red, the rockless row green | 6 red, 1 green (rockless) ✓ |
| M2: `dropRock` queues no Pulser frames ON (the named fix) | the four-arms and double-step rows red (rock ON → 1397), every OFF row green | 2 red, 5 green ✓ |

## D3 — the measurement

- **Byte-inertia OFF:** `git diff --name-only --diff-filter=MD 048733514a HEAD | grep -aE 'fixtures/|golden|tapes/'` is
  **empty**. No tracked file was modified or deleted at all. Added: the test file and the evidence directory. The two
  witness fixtures are `d1/game-rockless-set.json.gz` and `d1/game-rock-set.json.gz`.
- **The md5s** (`d3/acceptance-md5.txt`, `batch-seedling-acceptance.mjs | md5sum`): head = base, because no source
  changed.

  | Run | md5 |
  |---|---|
  | OFF | `391322d681b7aa0229d94b3f6906d024` (the standing value) |
  | all 12 queued keys ON | `d871cee754a7490a7003a7395028e531` (the brief's base value) |
  | all 12 ON with the scratch fix | `d871cee754a7490a7003a7395028e531` (unmoved) |

  The 12 queued keys are the ones past main `7898678dc4`: `publishedButtonRoomSetter`, `responderStepAfterReaders`,
  `deadFrameResponderStep`, `enemyPressesFallRockButton`, `wandShotTrapBodies`, `wandShotEnemyBodies`,
  `freezeFramesStepResponders`, `pulserDeadFrameUpdate`, `blockPressesFallRockButtonSameFrame`, `itemPressHeldBySlash`,
  `drillSightLineGame` and `wandShotKill`. **No seed moves.**
- **The tape movers** (wave 69's `tape-dump.mjs`, 322 tapes, `d2/fix-experiment.txt`):
  - `pulserDeadFrameUpdate` ON vs OFF at the base: 7 movers, as wave 69 found;
  - with the scratch fix: **5**. `r5-shaft-control` (`pulserHits` and `spinnerWrites`) and `hammer-d-l39-ghostwall`
    (`pulserHits`) leave the list;
  - `r5-shaft` stays, through its 150-frame totempart lump at t2633;
  - no `hits` field and no stream moves in either.
- **ON movers by file:row.** These are under the named fix; with no key, there are no ON movers of my own.
  `d3/fix-sweep.txt`:
  - the 37 fast files that name `pulserDeadFrameUpdate` give 4 red rows and 816 green. The red rows are
    `fidelityDeadFrame2.test.js:174` (the mover list), `fidelityDeadFrame2.test.js:182` (1207 → 1397), and the two
    `fidelitySpinnerPulse.test.js` pin rows above;
  - `fidelityDeadFrame2.slow.test.js` (`vitest.slow.config.js`, alone) gives 2 red rows (its 7-tape list becomes 5);
  - **class: all game-witnessed.** The game on the rock set agrees with the fixed ON arm. None is OFF-contract and none
    is a solver re-plan.
- **The hit gate:** no tape or route takes a hit it did not take before. No key ships. Under the scratch fix no `hits` or
  `playerHits` field moves on any of the 322 tapes. `shakeExactSplit` is not touched.
- **The keyed ON-arm sweep: none is owed by this slice** (no key). For the named fix: the only room on the atlas where a
  rope's group holds both a FallRock and a Pulser is L39 (`rope@96,384` / `fallrock@144,624` / `pulser@64,96`; measured
  over 116 levels: 3 ropes, 4 Pulsers). The delivered set the survey solves on has that rock patched out (edit 6). So the
  fix reaches **0 survey legs** (derived from the set, not counted: no survey cache in the container). It reaches only
  committed-tape replays on the atlas.
- **Gates:**
  - **Bounded vitest** (17 files: `fidelitySpinnerPulse`, `contactFidelity`, `contactFidelityHook`, `decisionTrace`,
    `pulser`, `r8Acceptance`, `solverDeadline`, `spinner`, `spinnerClockPairing`, `tapeEnvelope`, `fidelityDeadFrame2`,
    `fidelityFencepost`, `fidelityL39Hit`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`,
    `oneSpelling`): **605/605 green**.
  - **The 37 `pulserDeadFrameUpdate` files:** 820/820 green.
  - **No source changed,** so before = after for `levelRun*` and `levelWorld*`. There are no key-order pins to move.
  - **The checks:** `ci-producer-checks.mjs --jobs=3` gives 100 run, 0 red, 1 skipped. `check-procgen-docs.mjs` passes.
    `generate-procgen-reference.mjs --check` matches. `census-seedling-constants.mjs --check` passes.
    `census-seedling-solver-surface.mjs --check` is green (375 rows). The six `solve-seedling-*.mjs --check` are all green
    (`d3/solve-checks.txt`).
  - **CI** at `eacc8f87d5`: success (§ CI). For the planner: `unittests_frontend.yml -f train_only=true` at the head (I can't
    dispatch).

## What the brief got wrong (measured)

1. **"Both arms are wrong."** OFF is right. Wave 69's "game t1643" is the game on a set **without the rock**, compared
   with the model on a set **with it**. On the same set OFF matches every tick.
2. **"No test names 1397 or 1643."** `fidelityDeadFrame2.test.js:182` pins 1643 / 1397 / 1207. Its label, *"(both off:
   the spinner's pulse-kill path)"*, is the refuted claim. I left it unedited because it is wave 69's row. Re-label it at
   harvest.
3. **"A resting spinner"** (witness a): a Spinner cannot rest; `friction()` floors at speed 1.
4. **The kill tick the ON key should hit** is the game's on the set the model runs: 1396 (stamp 1397), not 1643.
5. **The bounded vitest form** (`npx vitest run <paths>`) runs no `.slow.` file: the default config excludes it. A slow
   file needs `--config vitest.slow.config.js`.

## Hand-overs

### Planner (fidelity, `seedling-fidelity-planning-27`)

- **STOP, named: `pulserDeadFrameUpdate` ON double-steps a rope-dropped rock's span.**
  - **The fix to license:** drop `dropRock`'s `queueDeadPulserFramesNow(frames, 'a rope\'s rock')`
    (`levelRun.js:4564`), the one line measured here.
  - **A precise variant:** queue only the level's Pulsers outside `pub.group`. The pre-step covers only the rope's group,
    and the queue covers every Pulser of the level. On the atlas the two are the same, because L39 has one Pulser.
  - **Re-records:** the 4 fast rows and 2 slow rows above, all game-witnessed. The acceptance md5 does not move.
  - **Do this before or with any flip of `pulserDeadFrameUpdate`.** As shipped, a flip moves `r5-shaft-control`'s kill
    from the game's tick (1397) to 1207.
- **The witness-set trap (a method note for every wave).** A game witness that mounts `l25Sets().vanilla` runs the
  PATCHED rooms (`seedlingSetPatches.js` edits 1–10: L29, L32, L39, L43, L74, …). `runTape` and `atlasLevelSource()` run
  the unpatched ones. In a patched room the two are different levels. `set-with-rock.mjs` shows the one-entity way to give
  the game the atlas room.
- Re-label `fidelityDeadFrame2.test.js:182` at harvest (above).

### HAMMER (`seedling-hammer-phase-planning-17`): read-only

- **`pulserForecastPulse`** (`levelRun.js:5944-6000`) copies the live Pulser state and steps one frame per row. It has no
  span frames.
  - OFF: a forecast taken after a rope pull already sees the span, because the pull's pre-step ran at the publish.
  - With `pulserDeadFrameUpdate` ON, a forecast taken between the pull and the next advance sees the span once (the
    pre-step). The queued second copy runs at that advance, so the forecast and the run disagree by the double step.
  - The named fix makes them agree.
  - The solver solves on the delivered set, where L39 has no rock, so no solver leg meets it today. Nothing to re-plan.

### JS arc

None.

## Residue

- **The `spinnerWrites` stamp** is one past the game's ledger sample on both sets (1644/1643, 1397/1396). This is by
  design: `ticksCompleted + 1` at the step that finds `removed`, and FENCEPOST's `spinnerRemoveRead` keeps the stamp while
  it moves the body out at the game's sample. Not a gap.
- **Pulsers outside the rope's group** get no span frames OFF (the pre-step filters `p.t === pub.group`). There are 0 of
  them on the atlas: L39's only Pulser is in group 6. The source says every Pulser runs through a freeze, so this stays
  unwitnessed and is moot today.
- **The cosmetic RNG:** the ctor draws (`Enemy.as:30,35`, `Spinner.as:24`: coins and `fallSpinSpeed`) are inert
  (`SPINNER_CTOR_RNG`) and stay unmodelled. No draw on this path moves a hit, a position or a body.
- `pulseTimer` and `radius` are not exposed by the page (a Pulser is not a `Mobile`). A `botMobiles`-style Activators
  readout would let a future wave witness the Pulser directly rather than through its hits. That would be an AS3 change,
  which is not mine.
- Scratch-only: `/tmp` witness JSON (the committed copies are the `.gz`). The dev server on 9798 was killed by PID at the
  end.

## CI

`JavaScript Unit Tests` at `eacc8f87d544da4414c7ea61df1b1a60cd705f7e` (run 46087669223): **success**. Shards 1–3 are green. The
suite is `vitest (unfiltered)` 30837 passed, 0 skipped, 0 failed, and the slow battery is 488 passed, 0 failed
(`ci-vitest-summary.mjs`). The train tier is not run on a slice push; dispatch `unittests_frontend.yml -f train_only=true` at
the head (I can't, 403).
