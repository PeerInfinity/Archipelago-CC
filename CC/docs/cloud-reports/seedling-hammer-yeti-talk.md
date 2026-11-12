# SEEDLING HAMMER-PHASE — slice YETI-TALK (`seedling-hammer-yeti-talk`)

## 1. SHAs

| | |
|---|---|
| Start (base) | `add369e82f` (`origin/main` at checkout) |
| Branch | `claude/seedling-yeti-talk-verb-7u130h` |
| Code commits | `ae7b75de` (the change + rows), `4a8fd7dd` (the channel's header names the exception) |
| Evidence | `c92c42b7` (page play), plus the walk evidence in the report commit |
| Head | the report commit (this file) |

## 2. The answer first

- **It was the MAPPER, not a missing verb.** If the clear-tag goal reaches it, solverBot's existing Yeti arm
  (`execYetiTalk`, behind `CONTACT_FIDELITY.yetiTalk`, ON on main) solves L58 flag 1. The page-side
  `jsRuntimeSolver.clearTagVerbOf` refused it before the solver ran, because it reads only the strategy tables and
  they have no `solid:yeti` row.
- **The switch:** `SEEDLING_TALK_CLEAR_GOAL=1` (`jsRuntimeSolver.TALK_CLEAR_GOAL`; it ships OFF). When ON,
  `clearTagVerbOf` asks the solver's own arm, `solverBot.clearTagTalkArmOf(cls)`. solverBot's Yeti row now asks the
  same function, so the two sides cannot drift apart.
- **Does it solve, and is it hitless?** Yes:
  - Node, from the L58 leg's arrival: 151 ticks, 0 hits, `{58,0}` and `{58,1}` both earned.
  - p4g page: 152 rows compared, 0 divergences, 0 hits, and the game's `persistence_cleared` holds `{58,0}` and
    `{58,1}`.
  - Whole-game walk: it passes L58. `wasm-location-58` solved at 100 u and played, and the route crossed the portal
    into L46.
- **The one thing to know first: the mapper runs on the page's MAIN thread** (`wasmArrival.continuationSolveRequest`).
  The solverEnv channel used to reach only the worker, so a mapper switch set through it could never be ON on the page.
  This switch alone also reads the page URL's `?seedlingSolverEnv=` there (`solverEnvChannel.pageSolverEnvSwitchOn`).
  NEW-LOCKS' `ROCKLOCK_KILL` (legs 286/289) hit the same gap. Its fix would follow the same pattern, if that gap is a
  mapper gap too.
- **Next stop:** L91's drill exit `level_91 -> level_89__r1c10`, the combat ladder EXHAUSTED on `enemy:drill@64,80`.
  This is WALK-WALLS' third stop, now reached.

## 3. The reproduction

- The page uses `atlasEventGoal` (`seedling_playthrough`'s `flag:L58:1`, side `level_58__r3c3`) →
  `solverGoalFor` → `eventSolverGoal`. It is refused at `jsRuntimeSolver.js` (`clearTagVerbOf(key)` →
  `refused('no-verb', …)`, at the `no strategy row exists for` line).
- The refusal is the walk's text, verbatim: *"… clear-tag {58,1} yeti@56,56 … no-verb: no strategy row exists for
  solid:yeti — the catalogue names no verb that clears it …"* (`evidence/play/off.json`).
- The rules' own event carries `action: {verb: 'talk', gates: [teleporter@80,16]}`. The talk is known upstream. Only
  the mapper lacked it.
- The leg came from the divergence leg list (`--carry-route-flags`), key
  `level_58__r3c3 <- in_tentacle_beast_mouth_L57_56_96 ~> level_58__r4c1 -> location:L58 flag 1: yeti@56,56 cleared`.
  The arrival is (48,96), in water. Without Swim the solver answers `no-corridor` (lethal Water at the start tile), so
  the witness stages `hasSword, canSwim`, which the route holds at that sphere.

## 4. The change and its OFF identity

- `solverBot.clearTagTalkArmOf(cls)` returns `'talk'` iff `CONTACT_FIDELITY.yetiTalk && cls === 'yeti'`. The Yeti row
  now asks it; this is byte-identical.
  - ⚖ The key is the class, and that is honest. The arm is class-keyed: `execYetiTalk` handles the Yeti's keyed
    dialogue and its hardcoded second write, `YETI_PORTAL_TAG`. The model's "this talker's `doneTalking()` writes
    that flag" is `levelRun`'s own `yetiDoneTalking` arm (`dialogue.PLACED_NPC_TALK.yeti` says `doneTalking:
    'REFUSED'`). There is no per-talker datum to read.
  - So the mapper reads the arm's answer rather than typing `yeti`.
- `jsRuntimeSolver.clearTagVerbOf`: when `TALK_CLEAR_GOAL` is ON, a `solid:` key with no table row asks the arm.
  `talk` is a `STRATEGY_EXECUTORS` row, so the key counts as registered. Whatever happens next (`already-clear`,
  `cannot-act`, the talk itself) is the solver's own answer.
- `solverEnvChannel.pageSolverEnvSwitchOn(name)` reads the page URL's spec. A malformed spec or no `location` reads
  as OFF. The switch is `process.env…=== '1' || pageSolverEnvSwitchOn(…)`, so the channel test's closure scan still
  sees the name. The name has been added to `SOLVER_ENV_NAMES`.
- Rows (`jsRuntimeSolverTalkClearGoal.test.js`, 18; green both with the env OFF and with `SEEDLING_TALK_CLEAR_GOAL=1`):
  - ships OFF;
  - the page-side read, six URL cases plus no `location`;
  - the witness exists (`TALKED() = [flag:L58:1]`, read off the arm);
  - **OFF = today's refusal byte for byte**;
  - **ON = the exact clear-tag goal**, which `assertGoal` admits;
  - ON with `yetiTalk` OFF → no-verb;
  - **ON, a Solid with no talk arm still refuses** (`rocklock`, `witch`, `watcher`, `crusher`);
  - ON maps every other playthrough event exactly as OFF does;
  - **ON, from the leg's arrival, the goal SOLVES**: `talk`, `cause: 'done'`, 0 hits, earned `{58,0}` and `{58,1}`.
- Bounded vitest (by path): the new file, `jsRuntimeSolverEventGoal`, `solverEnvChannel`, `fidelityYeti`,
  `levelRun`, `contactFidelity`, `entityBlocks`, `fidelityPitPort` and `seedlingDialogueSkin` all pass (304 rows).
- `census-seedling-solver-surface.mjs --write` and `--check` are GREEN (371 rows). The table did not change.
  `generate-procgen-reference.mjs` and `generate-docs-index.mjs` were run and produced no diff.
- **Acceptance md5:** `391322d681b7aa0229d94b3f6906d024` at the base and at head
  (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`). This is the value the brief gives for main.

## 5. The page play

- Tools: `evidence/tools/solve-l58.mjs` and `play-request.mjs`.
  - `solve-l58.mjs` is new. It runs the leg through the same `solverGoalFor` the page uses, then `solveSegment`, then
    folds the result into a staged tape with `buildStagedTape`.
  - `play-request.mjs` is WALK-L53-PAGE's play phase, copied with `persistence_cleared` added to its record. Its
    box-lock name still reads `walk-l53-page`.
- OFF: the mapper refuses, so there is nothing to play.
- ON:
  - The plan is 151 t, digest `3a9f5d89dcb1`, with the stance at (56,72); the dialogue opens at t60 and closes at
    t150.
  - On p4g (headless, logic-only): **152 rows compared, firstDiff null, hits 0 → 0, no rise**. The game ends at
    (56,72.25) in L58, and **`persistence_cleared` = `[{58,0},{58,1}]`**. Game rows digest `5699b59bf93c`
    (`evidence/play/on.json`).
- ⚠ This staging is a fresh arrival boot (`arrivalStaging`), not the walk's own continuation. The walk (§6) is the
  production check.

## 6. The walk: the next stop

- Base: WALK-L53-PAGE's branch (`fc383ae7`), which is NEW-LOCKS (`hammer-harvest-new-locks`, **not on main**, so it was
  merged) plus the walk knobs and capture. Onto that I merged `origin/main` `add369e8` (two generated-doc conflicts,
  taken from main) and this branch.
  - This was a scratch worktree (`/base`), never pushed, and removed after the walk.
- Env: `SEEDLING_KILLLOCK_CHASER_REWIND=1;SEEDLING_KILLLOCK_LINE_STANCE=1;SEEDLING_TALK_CLEAR_GOAL=1`, with the skip
  probe at 10.
- Result: `PASSED 1800.4s` (the ratchet), bot-plays 1789.9 s (`evidence/walk/`).

| skip | t | entry | why |
|---|---|---|---|
| 1 | 1225 s | 19/48 "Level 040 - Boss Key 2" | unchanged: it ran out of 640/2560 work units (a `walk`-site deadline). This is WALK-WALLS' wall |
| — | — | **25/48, through L58** | **Passed.** `wasm-location-58` (the yeti event) solved at 100 u and played. `wasm-continue-exit-58` was REFUSED (see residue). The engine's fresh `wasm-exit-58` solved at 102 u and the route crossed the portal: `wasm-exit-46` (125) solved |
| 2–10 | 1785–1797 s | 25/48 "Level 089 - Feather" onward | **`level_91 -> level_89__r1c10`**: "the combat ladder is EXHAUSTED … `enemy:drill@64,80` (a stepped drill …)", then "no path from level_91 …" rows. The walk ended there |

- So the stop moves from L58 to **L91's drill** (WALK-WALLS' third stop).
- ⚠ Launches: four earlier attempts stopped on harness clocks before reaching L58. Each played no more than entry 18,
  and none measured anything about this slice. I count the fifth as the brief's ONE walk; the earlier four are
  disclosed here (`walk-false-starts.txt`).
  1. A 0.1 s boot failure: the substrate submodules were not initialised. That was my miss of first-act 1.
  2. A cut by the default 180 s step budget.
  3. A cut by the 600 s in-app suite budget.
  4. A cut by Playwright's 900 s test timeout.
- A long walk needs all four of these: `TEST_MEASURE_STEP_TIMEOUT_MS`, `TEST_MEASURE_BOT_STALL_MS`,
  `TEST_AUTO_START_TIMEOUT_MS` and `TEST_TIMEOUT`.

## 7. What the brief got wrong (measured)

- *"Slice a TALK verb"*: no verb was missing. The planner's after-ruling note was right that it is the mapper.
- *"read from the same `CONTACT_FIDELITY.yetiTalk` and the model's talker data"*: no per-talker "writes this flag"
  datum exists. The honest key is the class, read through the arm (§4).
- *"`SEEDLING_<NAME>=1` turns it on" via the channel*: the channel is worker-only, and this mapper is main-thread. It
  needed the page-side read (§2).
- `wasmArrival.js` is not the mapper. It calls `solverGoalFor`, and it was not edited. No `flashPanel` line was needed.

## 8. Residue

- **`wasm-continue-exit-58` refuses** after the talk. Its message: "reach-exit (80,16)->L46 … waypoint 1 (72,56): not
  reached within 400 ticks; stalled at (56.85,55.95)". The player presses against the Yeti's body: the Yeti stays,
  and is Solid. The engine's fallback (`wasm-exit-58`) solved it, so the walk did not stop.
  - The continuation corridor routes a waypoint through a Solid NPC's box. This is worth a look, but it is not this
    slice's (the walker's or planner's).
- The ON switch lands OFF. Flipping it (and whether `pageSolverEnvSwitchOn` becomes the pattern for other mapper
  switches) is the planner's call.
- The walk does not report hits per entry. "Hitless" at L58 comes from §5's page play, not from the walk.
- Tests were run with the untracked substrate submodules initialised in the primary tree (`git submodule update
  --init`). No tracked path moved.
