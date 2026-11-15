# SEEDLING HAMMER-PHASE — slice ROCKLOCK-MAPPER (`seedling-hammer-rocklock-mapper`)

## 1. SHAs

| | |
|---|---|
| Start (base) | `83374e3de3` (`origin/hammer-stack-trio`: main `fe98f37f22` + DRILL_EXIT_PASS flip + YETI-TALK + the kill-lock flip) |
| Branch | `claude/rocklock-kill-page-mapper-c1sgzm` |
| Code | `c2d041f8` (the change + the node reproduction tool), `15869087` (the rows; the channel header) |
| Evidence | `55727384` (page play, census) |
| Head | the report commit (this file) |

## 2. The answer first

- **The mapper was the only gap.** On the page's MAIN thread, `solverBot.ROCKLOCK_KILL` keeps its default (OFF). The
  `?seedlingSolverEnv=` channel only sets the WORKER's env. So `jsRuntimeSolver.clearTagVerbOf('solid:rocklock')`
  found no row and refused both L26 legs `no-verb`, even with the switch on in the URL.
- **No new switch.** The mapper now reads the same name, `SEEDLING_ROCKLOCK_KILL`, page-side
  (`solverEnvChannel.pageSolverEnvSwitchOn`, YETI-TALK's pattern).
  - When it reads ON, it takes the solver's own switch-gated row: `withRockLockKill(true, () => OBSTACLE_STRATEGIES[key])`.
  - Why no separate name: one URL entry turns the mapper and the worker on together. A separate mapper name could
    hand the worker a goal that the worker then refuses `no-verb`.
- **Thread:** the decision runs on the page's MAIN thread (the `solverGoalFor` mapper). The solve runs in the worker,
  unchanged.
- **Solved and hitless:**

  | leg | node (through the mapper) | page (p4g) |
  |---|---|---|
  | `level_26__r2c4 <- in_L25_0_96 -> location:L26 flag 0: rocklock@112,208 cleared` | 629 t, `kill+walk`, 0 hits, `26:0` written | `done`, 629 t, 0 room hits, divergence null, `{26,0}` set and collected |
  | `level_26__r2c4 <- in_L27_32_0 -> location:L26 flag 0: rocklock@112,208 cleared` | 315 t, `kill`, 0 hits, `26:0` written | `done`, 315 t, 0 room hits, divergence null, `{26,0}` set and collected |

  The page result is with the shipped defaults and the URL alone; no scratch flip was used.
- **The one thing to know first:** the leg also needs `SEEDLING_KILLLOCK_CLEAR_WRITE=1` (worker-only, NEW-LOCKS) to
  finish. With `ROCKLOCK_KILL` alone, the mapper hands over the goal and the worker refuses `not-written`. The
  page URL that solves it is `?seedlingSolverEnv=SEEDLING_KILLLOCK_CLEAR_WRITE=1;SEEDLING_ROCKLOCK_KILL=1`.

## 3. The reproduction (measured)

- Tool: `…-evidence/tools/map-and-solve.mjs`. It simulates the page's main thread:
  - every `SEEDLING_*` env var is deleted, and `globalThis.location.search` is set before any import;
  - it maps the shipped rules' event `flag:L26:0` (`runtimeEventsOf` → `atlasEventGoal` → `solverGoalFor`) on a run
    replayed from NEW-LOCKS' captured request;
  - if a goal comes back, it solves it as the worker does (the switches applied with `withX`).
- At base, OFF and with `?seedlingSolverEnv=SEEDLING_ROCKLOCK_KILL=1` alike:
  - `clearTagVerbOf('solid:rocklock')` = `{verb: null, registered: false}`;
  - the refusal, verbatim: *"L26 flag 0: rocklock@112,208 cleared" is a saved-obstacle EVENT (clear-tag {26,0}
    rocklock@112,208): the solver's clear-tag refuses it — no-verb: no strategy row exists for solid:rocklock — the
    catalogue names no verb that clears it. Its check stays the game's persistence flag {26,0} turning set, which
    nothing but the game writes*.
- Control: a node process with `SEEDLING_ROCKLOCK_KILL=1` in its env maps the key to `{hold, registered: true}`.
  So the gap is specific to the main thread.
- Page, OFF (`page/off.jsonl`): both legs `failed`, history reason = "the solver has no goal for … no-verb …" (the
  same text), 0 room hits, `{26,0}` not set.

## 4. Design and change; OFF identity

- `jsRuntimeSolver.js` changes in one place: a new function `rowOfPageSwitch(key)` and one call site in
  `clearTagVerbOf`, reached only when the table has no row for a `solid:` key.
- `rowOfPageSwitch` returns null when the module's own `ROCKLOCK_KILL` is already on (in a node process or the worker,
  the table already carries the row) or when the page URL does not say `SEEDLING_ROCKLOCK_KILL=1`.
  - Otherwise it returns the solver's row under `withRockLockKill(true, …)`, which restores the switch afterwards.
  - Nothing names a class, a level or a coordinate. The verb is whatever row that switch gates.
- `solverEnvChannel.js`: the header's list of exceptions (main-thread reads) now names this mapper read. No new
  `SOLVER_ENV_NAMES` entry: `SEEDLING_ROCKLOCK_KILL` was already there.
- `solverBot.js` is not edited.
- **OFF identity:** acceptance md5 `391322d681b7aa0229d94b3f6906d024` at base and at head
  (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`).
- With no URL param, `pageSolverEnvSwitchOn` is false and the call site leaves `verb` null, as before. In a node
  process the early return means a node row's mapping is byte-identical to base whatever its env.
- `census-seedling-solver-surface.mjs --write` → `--check` GREEN (372 rows, no diff).
  `generate-procgen-reference.mjs` and `generate-docs-index.mjs` were run: no diff. No docs were edited under
  `docs/json/developer/procgen/`.

## 5. Rows and bounded vitest

- New file `frontend/modules/seedlingDemo/jsRuntimeSolverRockLockMapper.test.js`, 23 rows:
  - the switch ships OFF and the channel knows the name;
  - the page-side read: 6 URL cases (on, on among others, `=0`, another switch, malformed, empty);
  - no `location` → only the module switch counts;
  - the mapper never leaves `ROCKLOCK_KILL` on, and the row stays non-enumerable;
  - **OFF: today's refusal, byte for byte** (both legs; `EVENT_CLEAR_TAG_REFUSAL` text and the `refusal` object);
  - **ON: the mapper returns the exact clear-tag goal**, equal to the captured request's `solverGoal` (both legs);
  - **ON: the mapped goal SOLVES** with the worker's `ROCKLOCK_KILL` + `KILLLOCK_CLEAR_WRITE`: 629 / 315 t, verbs as
    above, 0 hits, `scratchClears` = `['26:0']`;
  - **ON maps every non-rocklock playthrough event exactly as OFF does**;
  - 7 non-rocklock keys unchanged (`crusher`, `witch`, `watcher`, `yeti`, `finaldoor`, `lock`, `breakablerock`).
- Mutants, each red by name, then reverted:

  | mutant | red rows |
  |---|---|
  | the page switch is ignored | 6 |
  | the URL is not read (always on) | 7 |
  | `hold` is typed for every Solid | 3 |

- Bounded vitest, by path:
  - Env OFF: the new file + `jsRuntimeSolverTalkClearGoal`, `jsRuntimeSolverEventGoal`, `solverEnvChannel`,
    `hammerNewLocks` = **5 files, 101 passed**.
  - With `SEEDLING_ROCKLOCK_KILL=1 SEEDLING_KILLLOCK_CLEAR_WRITE=1` (four files, without `hammerNewLocks`): the new file
    is green. `jsRuntimeSolverEventGoal`'s two `flag:L112:1` rows are red: 86 passed, 2 failed. **This is not from
    this change.** Those are the two rows NEW-LOCKS §9 listed as "owed at a flip", and in node the change returns
    early when the env is on, so their path is the base's.

## 6. Page play

- Harness: `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g
  --keys=<the two keys> --leg-budget-ms=90000`, on a fresh `serve-nocache.py 8000`. The server was started here and
  killed by its PID afterwards.
- The legs file came from `seedling-divergence-legs.mjs --carry-route-flags` at base (936 legs, md5 `0564732a…`; kept
  in the scratchpad, not committed).
- OFF (`page/off.*`): both `failed` with the mapper's `no-verb`, in under 1 s each.
- ON, `--solver-env=SEEDLING_KILLLOCK_CLEAR_WRITE=1;SEEDLING_ROCKLOCK_KILL=1` (`page/on.*`). The env is in the page
  URL, so the main-thread mapper and the worker read the same entry:

  | leg | end | plan | divergence | room hits | `{26,0}` |
  |---|---|---|---|---|---|
  | `… <- in_L25_0_96 -> …` | done | 629 t, `kill,walk` | null | 0 (890 samples) | set, collected |
  | `… <- in_L27_32_0 -> …` | done | 315 t, `kill` | null | 0 (480 samples) | set, collected |

- "2 page error(s)" are printed per page in both arms, OFF as well as ON, so they are not this slice's.
- No whole-game walk was run; the brief did not ask for one.

## 7. Census: what the mapper still refuses `no-verb`

- Tool: `tools/census-no-verb.mjs`; result: `m/census.json`.
- It takes every EVENT leg of the seed-1 divergence list (102 location legs whose location is a rules event) and maps
  each as the page's main thread does, under three URLs.

| URL | mapped | `no-verb` at the mapper |
|---|---|---|
| none (OFF) | 98 | 4: `rocklock` ×3, `yeti` ×1 |
| `SEEDLING_ROCKLOCK_KILL=1` | 101 | 1: `yeti` |
| `+ SEEDLING_TALK_CLEAR_GOAL=1` | **102** | **0** |

| class | legs (by key) refused OFF | moved by this change? |
|---|---|---|
| `rocklock` | `level_26__r2c4 <- in_L25_0_96 -> location:L26 flag 0: rocklock@112,208 cleared` | yes → mapped, solves |
| `rocklock` | `level_26__r2c4 <- in_L27_32_0 -> location:L26 flag 0: rocklock@112,208 cleared` | yes → mapped, solves |
| `rocklock` | `level_112__r2c2 <- in_L111_128_48 -> location:L112 flag 1: rocklock@112,16 cleared` | the mapper maps it; the worker refuses `no-verb` (instance `tset 0`, §9) |
| `yeti` | the L58 leg (`level_58__r3c3 <- in_tentacle_beast_mouth_L57_56_96 ~> level_58__r4c1 -> location:L58 flag 1: yeti@56,56 cleared`) | no (YETI-TALK's `TALK_CLEAR_GOAL`) |

- The other caller, `fightExitGoal`, maps two classes: `lightbosscontroller` → `lights` and `tentaclebeast` →
  `tentaclebeast`. Both are registered at the defaults.
- **So the next gap list is empty at the mapper.** With both mapper switches on, every seed-1 event leg reaches the
  worker. What remains is the solver's own answer per leg (out of scope here).
- The seed-1 legs this change can move: exactly the three `rocklock` rows above. Two now solve; L112's refusal moves
  from the mapper to the worker, with the same reason.

## 8. What the brief got wrong (measured)

- Nothing material. The premise held: the mapper refuses before the worker on the page, and only on the main thread.
  A node process with the env already maps it.
- Point 3 says *"ON = the mapper returns the kill verb"*. The mapper returns `hold`, the class row
  (`OBSTACLE_STRATEGIES['solid:rocklock']`, `Lock`'s). `kill` is the solver's per-instance refinement
  (`refineStrategy` → `rockLockKillRow`), and the worker picks it. The plan's verbs on both legs are `kill`
  (+ `walk`). The mapper only answers "is a verb registered", and it does not refine. That is the same contract
  as every other `hold` row.
- *"…and the leg solves"*: only with `KILLLOCK_CLEAR_WRITE` as well (§2). NEW-LOCKS already said so.

## 9. Residue and hand-overs

- **The mapper is class-keyed, the solver instance-keyed.** This is NEW-LOCKS §9's note, now on the page as well.
  - With the URL on, L112's `rocklock@112,16` (`tset 0`) is mapped and then refused `no-verb` by the worker, not by
    the mapper. The leg fails either way.
  - Node already behaved this way with the env on, and that is why `jsRuntimeSolverEventGoal`'s two `flag:L112:1`
    rows go red under `SEEDLING_ROCKLOCK_KILL=1`.
  - At the flip, either the mapper asks the instance (a solverBot export over `rockLockKillRow`; a change to the
    solver's file, so not done here) or those two rows are re-recorded. That is the planner's call.
- `pageSolverEnvSwitchOn` now serves two mapper reads. Flipping `ROCKLOCK_KILL`'s default makes `rowOfPageSwitch` dead
  code: the module's own switch returns early. The flip should remove it.
- The flip itself (both `ROCKLOCK_KILL` and `KILLLOCK_CLEAR_WRITE`) is the planner's call; both stay OFF here.
- No follow-up from `seedling-hammer-phase-planning-6` arrived during this session.
- The substrate submodules were initialised in this tree (`git submodule update --init`, excluding the wasm one). No
  gitlink moved.
