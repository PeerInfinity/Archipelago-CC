# Seedling hammer-phase CPWIT: a page channel for the solver's OFF switches, and the game witness of CHOOSER_PAIR size 3

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-chooser-witness` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `9c0f9045` (origin/main) |
| Head | this report is the last commit on the branch, on top of `e2e29700` (code `183c4d14`, witness `9268489f`, packet `8d0d31f5`, D `717e4f58` / `5d51a80a` / `e2e29700`) |
| Branch | `claude/seedling-hammer-chooser-witness-tkxhl2` (the harness's designated branch; the brief's `seedling-hammer-chooser-witness` name was not used) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-chooser-witness-evidence/` |
| Scope messages | none arrived mid-run |
| Flips | **none**. `CHOOSER_PAIR` ships OFF at size 2, as before. The flip is a patch file (`flip/cpair3-flip.patch`), not applied |

## 2. The answer first

- **The channel:** `?seedlingSolverEnv=NAME=VALUE;…` on the page URL. The page's solve service puts the canonical spec on its
  worker's URL, and the worker's first import (`solverEnvShim.js`) installs it as `process.env` before any solver module
  is evaluated. The names come from ONE table (`solverEnvChannel.SOLVER_ENV_NAMES`), which holds every `SEEDLING_*` name the
  worker's import closure reads: 150 names, held equal by a row. It was chosen because it is the only design that reaches
  all of them with no per-switch code. Most switches are read at module load (`CHOOSER_PAIR.size` is computed at
  import), so a per-solve stamp would need a setter per switch inside `solverBot.js` (§4). Without the param the worker
  URL is `SOLVE_WORKER_URL` itself (the same object, by row), nothing is installed and nothing is stamped. The sweep takes
  it as `--solver-env` (workflow input `solver_env`, empty default).
- **The three pits, in the GAME** (the divergence sweep's page half, headless wasm `seedling_bot_ap_p4g`, channel
  `SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR_SIZE=3`):

  | leg (this SHA = L40C's ids) | key | ON | OFF |
  |---|---|---|---|
  | 374 | `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_21` | **done**, 955 t, 0 hits, no divergence, game end L43 (88,344) = plan's | failed: anytime deadline (both requests) |
  | 378 | `… -> exit:out_pit_5_22` | **done**, 938 t, 0 hits, no divergence, L43 (88,360) = plan's | failed: anytime deadline |
  | 380 | `… -> exit:out_pit_5_23` | **done**, 909 t, 0 hits, no divergence, L43 (88,376) = plan's | failed: anytime deadline |

  Each plan is one solve (verbs `kill`, `walk`; the dashless pass 989 t, the full pass 955 t on 374). Each row and plan
  carries `solverEnv`, and the page read it back at boot (`SOLVER_ENV: page N: SEEDLING_CHOOSER_PAIR=1;…`).
- **What else moves in the game on L40 (52 keys):** ON 42 done / 9 failed / 1 timeout; OFF 39 / 12 / 1. **The only verdict
  movers are the three pits.** 363 / 366 (Totem 64,144) traded done/failed both ways, but that is the arrival clock (±20 t
  run to run). Replayed in node, the same captured request gives ON = OFF, and a re-run flipped them again in both arms.
  382 / 399 (Chest) and 860 / 861 (Boss Key 2) move only their refusal: to the anytime deadline, or to
  `bobsoldier@880,832`'s sword instead of the x≈744 bobs. This is L40C's A1 finding, now in the game. Node replay equals
  the page's work units on 18/18 captured requests.
- **The flip packet** (`flip/cpair3-flip.patch`, 6 files, +32/−21, applies cleanly to the head, measured on a worktree):

  | what | change | measured under the patch |
  |---|---|---|
  | defaults (`solverBot.js`) | `CHOOSER_PAIR.enabled` = env `!== '0'`, `size` = env `=== '2' ? 2 : 3`, `CHOOSER_PAIR_DEFAULT = true` | — |
  | `plan-seedling-hammer-g1-ghostkill` | pins `withChooserPair(false)` beside its other pinned switches | `--check` byte-identical, no re-record |
  | `plan-seedling-hammer-sf-strikefloor` | the same | `--check` byte-identical, all asserts as today |
  | `hammerChooserPair` "ships …" | ON at size 3; `=0` / `_SIZE=2` opt out | pass |
  | `hammerChooserPair` "853 at 5172" | the pair arm is asked at size 2 (`withPairSize(2)`) | pass (same values as today) |
  | `hammerChooserPair` "the measurement arm …" | its pair-only probe at size 2 | pass (367 still 955 t at size 3) |
  | `hammerGhostKillRung` "ON: … IS the witness" | `solveA` pins `withChooserPair(false)` | pass |
  | `hammerStrikeEtaFloor` "ON: … IS the witness" | `solveOn` pins `withChooserPair(false)` | pass |
  | producer roster | — | **97 run, 0 red** |
  | bounded set (41 files) | — | **635/635** |
  | fidelity rows | none move (L40C's single-switch bisection: CPAIR-3 moves no fidelity row; the 41-file set includes none red) | — |
  | survey / r9 / latch / pocket | not re-run here: L40C A1 measured 240-row survey 0 movers, r9 `be9c19c8` =, latch and pocket = | quoted |

  The other way, re-recording the two witnesses under the flip (`flip/variant-rerecord.patch`), lengthens both tapes
  (2195 → 2317 t, 1629 → 1796 t) past their committed game samples (`*.game-bodies.json`). It also reds 7 rows (the 4
  above plus 3 that read the witness walk), so it is not the packet.
- **Is the flip ready?** By this slice's measures, **yes**. The new solves are game-witnessed (3/3 hitless, to the
  exit). The game loses nothing on L40. The patch keeps every pin and is green on the roster and the bounded set. Still
  open, for the user and planner: L40C's survey/r9 answers are quoted, not re-run at this SHA; the unfiltered suite under
  the patch is CI's, at a dispatch (§7); and the flip is the user's call.

## 3. W0

| row | result |
|---|---|
| base | `9c0f9045`; `session_bootstrap.sh --seedling` READY (node v22.22.0). ⚠ I did not initialise the six other non-wasm submodules until mid-run (§8) |
| identity block (pristine worktree at the base, `identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, six producer `--check`s exit 0 (r9 campaign `be9c19c8`): **all equal L40C's published values**. Reference "4 differ" = the worktree's symlinked submodules (the head run in the main tree: ALL MATCH) |
| producer roster `--jobs=4` (`producer-w0.txt`) | 97 run, every producer exit 0; one battery red `TREE-MOVED`: my own edits landed mid-run |
| bounded set (base worktree, `bounded-w0.txt`) | 39 files (the 41 minus the two new ones): **617/617** |
| the channel survey | see §4: no existing channel sets a `solverBot.js` switch in the page |
| the 52 L40 keys | all resolve at this SHA with L40C's ids (`l40-leg-keys.txt`) |

## 4. M — the design (full note: `M-design.md`)

What exists: five REQUEST STAMPS (`killLockBodies`, `contactFidelity`, `axeDodgeAskPerPreview`, `dashOnlyWindow`,
`dashShape`), each one module's own set, each set by a flashPanel SETTING; `upgradeWindowWork`; the sweep's
`stage_flags` (game flags, not solver switches). **None reaches `solverBot.js`'s env switches.** The worker's closure:
136 files, 150 `SEEDLING_*` names, every read the literal `process?.env?.SEEDLING_X`, and no other use of `process`.
So a bare `{env}` is safe to install there.

| | A. worker-URL env shim (chosen) | B. per-solve request stamp | C. flashPanel setting |
|---|---|---|---|
| one table, existing names | yes, all 150, read sites untouched | no: module-load constants need a setter + `with…` each, in `solverBot.js` | no: one setting + stamp + hook each |
| default | the same URL object, no shim, no stamp | no stamp | absent |
| per run, not persisted, not a setting | yes | yes | no |
| out-of-bounds files | none | `solverBot.js` per switch | `flashPanel/*` |

The sweep workflow needs an input: **`solver_env`** (added; empty default), passed to the plan job and every shard.
`solverEnv` joined the probe's and the merge's `SOLVER_KNOB_KEYS`, so the row/plan stamp and the mixed-merge refusal
reuse the existing path. No `flashPanel/*`, `levelRun.js`, `botDriverV*.js`, AS3 or wasm edit was needed.

## 5. I

**The channel** (`183c4d14`): `solverEnvChannel.js` (pure), `solverEnvShim.js` (the worker's first import),
`jsRuntimeSolveWorker.js` (imports the shim first; stamps every `pass` answer, `best`, `result` and plan `solverEnv`;
a bad spec refuses every solve by name), `jsRuntimeSolveService.js` and `jsRuntimePage.js` (worker URL via
`solveWorkerUrl`). Sweep: `probe-seedling-divergence-sweep.mjs` (`--solver-env`: validated before the box, on the page
URL, `SOLVER_ENV:` read-back, every plan held to it), `seedlingDivergenceLab.js` (plans carry the worker's stamp),
`seedlingDivergenceMerge.js`, `.github/workflows/seedling-divergence-sweep.yml` (`solver_env`).

**Rows** (`solverEnvChannel.test.js` 11, `seedlingDivergenceSolverEnv.test.js` 8, plus the knob-key row; 30/30):
- the table equals the names read in the worker's import closure;
- each table name is set (into a scope with no `process`, as in a browser);
- nothing set = nothing installed, the same URL object, no stamp, and the switch at its shipped default (compared against
  `solverBot.js` loaded with no channel, so the row survives the flip);
- an unknown name refuses by name, in the probe and in the real worker (every solve);
- the result and plan record the spec;
- the real worker with CPAIR3 reads `{enabled: true, near: 4, size: 3}` and only those two env names;
- the probe, plan job, merge and workflow plumbing.

Mutation m1, the shim imported after the solver modules: the CHOOSER_PAIR row reds (`mutants.txt`).

**Byte-identical without it:** the identity block at the head equals W0 (and reference ALL MATCH). The head producer
roster is 97 run, 0 red. `check-seedling-wasm-ship` headless: ALL PASS (the 30-window campaign). The default page run (the
OFF arm) takes today's URL. The worker URL is the same object (row).

**The witness:** §2. Logs, summaries and gzipped rows are in `witness/`; the node replay is `witness/replay-{on,off}.tsv`
(the tool is `tools/cpwit-replay.mjs`).

**The flip packet:** §2 table; `flip/`.

## 6. D

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), head | 41 files 635/635 (`bounded-head.txt`); and the 25 other tests reading touched files 594/594 after the docs fix (`bounded-touch-head.txt` is the run that found it: docLinks/docsRender 5 red, then 61/61) |
| `ci-producer-checks --jobs=4`, head | 97 run, **0 red** (`producer-head.txt`) |
| identity block, head | = W0 (`identity-head.txt`) |
| `census-seedling-solver-surface --check` | RED at the base already (`levelRun.js` line moves only); `--write` → GREEN, 363 rows, nothing to classify |
| `census-seedling-constants --check` | PASS |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED |
| `generate-docs-index.mjs --check` | OK |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless) | ALL PASS |
| JSUT | **run 41136268271 at `e2e29700`: success.** Unfiltered vitest 24358/24358; **slow battery 275/275 green**. The run before it (41126427382 at `5d51a80a`) had 1 red: `sweepControl.test.js` pins the sweep's `run-name`, which gained `env=`; fixed in `e2e29700`. The one at `47e30c58` (41090446959) redded shards 2/3 and 3/3. Its logs were unreadable (GitHub 503s), and the docs-census pins (docLinks/docsRender) red locally at that tree were fixed in `5d51a80a`. Its slow battery was green |

Docs: `flash.md` (*The solver-env channel*), `seedling-bot.md` (CPAIR paragraph), `seedling-bot-log.md`
(`### Seedling hammer-phase CPWIT — …`).

## 7. What the harvest A/B should expect, and the dispatches

- **Without the channel: no movers.** The default worker URL, request and answer are unchanged. Main's sweep at the
  harvest base vs this branch (`solver_env` empty) should differ only by arrival-clock noise. The L40 Totem legs 363/366
  trade done/failed between runs on the same code.
- **Dispatches for the planner** (cloud sessions get a 403 on `workflow_dispatch`):
  1. `seedling-divergence-sweep.yml`, `keys` = the three pit keys (`|`-joined, §2), `solver_env` =
     `SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR_SIZE=3`, `shards` 3: expect 3 done, 0 hits.
  2. The same with `keys` = the 52 L40 keys (`l40-leg-keys.txt`, column 2), with and without `solver_env`: expect the pits
     as the only verdict movers.
  3. Optional, the flip's CI read: JSUT and the slow battery on a scratch branch with `flip/cpair3-flip.patch` applied.

## 8. What the brief got wrong (measured)

- *"The switch's shipped `size` default is 2; the verdict above is for size 3"*: true. The flip packet sets both
  `enabled` and `size`; one flip of `CHOOSER_PAIR` alone (size 2) would not solve the pits.
- *"it reds 2 hammer producer pins … and moves 4 test rows"*: true under the env arm. As a code flip the pins can stay as
  they are by pinning the switch OFF inside the two witnesses, the way they already pin OPP, PRESS_KILL_CHASERS and the
  guards. Re-recording them instead lengthens both witness tapes past their game samples and reds 7 rows.
- *"Is there ANY existing channel that sets a `solverBot.js` switch in the page?"*: none for `solverBot.js`'s env
  switches. Five request stamps exist for other modules' own sets (§4).
- The leg ids 374/378/380 are unchanged at this SHA (L40C's base `480c2aa4` → `9c0f9045`).
- L40C's report is on its unmerged branch (`claude/seedling-l40-combined-measure-xusatn`), not on main.

## 9. Residue and hand-overs

- **My first sweep of "tests that read touched files" missed two pin families:** the docs census (docLinks/docsRender count links and headings) and `sweepControl.test.js` (the sweep's run-name). CI found both, and both are fixed. A slice that adds a sweep input or a doc link should run those three files.
- **Submodules:** I initialised the six other non-wasm submodules mid-run (after the generator dropped registry rows
  without them). The ON L40 arm's first 1–2 legs ran before that. No such leg moved (358/367 are done in both arms).
- **The page's main thread is not switched**, only the worker. The divergence detail's model replay (main thread)
  therefore runs defaults. With the game as judge this does not touch the witness. A switch that changes the
  SIMULATION (a contact-fidelity key) would show a model/game divergence detail at defaults; use the channel with that
  in mind.
- **A harvested slice that adds a `SEEDLING_*` read** reds `solverEnvChannel.test.js`'s table row until a line is added. That
  is by design, and it may happen on SPIN / APPROACH / DASH harvests.
- **Not run here:** the unfiltered suite (⚖ 52; CI's), and the 240-row survey under the patch (quoted from L40C A1).
- **Worktrees** `/home/user/wt-cpwit-base` and `/home/user/wt-cpwit-flip` were mine and are removed; so are the servers
  I started.
