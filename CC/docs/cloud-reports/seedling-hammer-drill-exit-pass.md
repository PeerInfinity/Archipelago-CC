# Seedling hammer-phase DRILL-EXIT-PASS — the L91 drill's timed pass on a door leg while a weapon is held

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-drill-exit-pass` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-07 |
| Start SHA | `0d575b78eab99a88659b9bfe7c42621b43a75121` (origin/main) |
| Head | (report commit on top of) W0 `0c1818e6`, M `994ea551`, I `bc93f963`, D `67ac6fcf` + `4acf4f04` (the surface re-write); this report is the last commit |
| Branch | `claude/seedling-l91-drill-exit-pass-orf9go` (the harness's designated branch) |
| Switch | `solverBot.DRILL_EXIT_PASS`, **OFF** (`SEEDLING_DRILL_EXIT_PASS=1`, `withDrillExitPass`, page `?seedlingSolverEnv=SEEDLING_DRILL_EXIT_PASS=1`) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-drill-exit-pass-evidence/` (`w0/`, `m/`, `page/`, `tools/`; the captured requests, 4 MB, are not committed — re-capture with the W0 command) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` done (its pip line failed, as in earlier slices; the headless pip line OK); every submodule; node v22.23.4; 4 cores; :8000 `serve-nocache.py` |

## 2. The answer first

**The one thing to know first: the census's shape (the armed pass FIRST) is not shippable — it moves 6 of the 21
drill-room legs and turns L88's leg 707 from SOLVED to refused. The shipped shape is a rung AFTER the door's walk, and it
moves exactly 718 and 719.**

| question | answer |
|---|---|
| Does 718 fall ON? | **Yes.** SOLVED 190 t, 0 hits, 0 deaths, replayed on a fresh run (node), and **done, 190 t, 0 room hits, 0 divergences on the `seedling_bot_ap_p4g` page** with `--solver-env=SEEDLING_DRILL_EXIT_PASS=1`. Same plan as the census's what-if (digest `1b3b8019a88e`). Work 34 units (the refused walk's 8 + the pass's 26), inside the page's 640 |
| 719 ON? | A **by-name refusal**, never a plan: *"levelRun: drill@64,80 in level 91 hops onto tile type 1 at (40,120) on tick 211; `Enemy.update`'s terrain switch (water, lava, a pit) is not modelled for a drill. Refused by name (fidelity DRILL D2)."* Raised on the certificate's FORK; the run played no tick. Page: the same text. That is fidelity's DRILL-WATER |
| 717 / 720 ON | = OFF, byte for byte (page and node) |
| The other drill legs (L28 ×8, L88 ×9) | = OFF, byte for byte, OFF and ON (node digests and the page's end/ticks/hits) |
| The residue-D-A L28 rows | unchanged OFF and ON (`fidelityResidue.test.js` 4 files / 95 rows green with the switch ON; the Sword row re-pinned ON in my file). ON improves none of them (their runs are swordless, or the walk solves) |
| Is B (kill first) the fix? | No — re-confirmed by the census's B arm: no side of this drill is a kill stance |
| The three gates | `solverBot.js` `execDrillTimedPassExit` (the weapon gate and the wake test); `plannedWalkSamples` (the planner's `allowTeleporter`, hard-wired null); `execDrillKillsFirst` is called only before a rope clear-tag (`execClearTag`) — left alone (B is not the fix) |

## 3. W0 — reproduced at main's defaults

Page (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g
--capture-requests`, main `0d575b78ea`) and node (`tools/replay.mjs`: the captured request through `solveAnytime` with its
own budget, passes and window; a SOLVED plan replayed on a fresh run of the staging, row by row).

| leg | key | page | node |
|---|---|---|---|
| 717 | L91 ← L89 arrival → L89 door (16,144) | done 7 t | SOLVED 7 t, fresh 0 hits |
| 718 | L91 ← L89 arrival → L92 door (240,48) | failed: *"reach-exit (240,48)->L92: the combat ladder is EXHAUSTED … enemy:drill@64,80 (a stepped drill, priced as a static box …)"* | the same, 8 units |
| 719 | L91 ← L92 arrival → L89 door | failed, the same (EXHAUSTED on the drill) | the same, 20 units |
| 720 | L91 ← L92 arrival → L92 door | done 5 t | SOLVED 5 t |

The radius (`w0/sweep-radius-D0.tsv`): every leg whose level holds a drill — the atlas has drills in L28, L88 and L91
only, 21 legs. At D0: 17 done/crossed, 718/719 failed, **704 failed** (L88 → L12 door: *"the re-planned corridor failed
too … not reached within 400 ticks"* on the dashless pass, EXHAUSTED on `drill@128,160` on the full pass — after the walk
spent ticks), and **701** read *"DRILL_EXIT_PASS is not defined"*: my own mid-edit tree was served for a few seconds while
it ran. Re-captured on the finished tree OFF: **crossed 4 t** (`page/sweep-701-D0-recaptured.tsv`), = ON.

Located gates (today's line numbers at the I commit): `plannedWalkSamples` `solverBot.js:23069`;
`drillExitPassAfterRefusal` `:23747`; `execDrillTimedPassExit` `:23762`; the reach-exit call site in `solveSegmentUnder`
`:32785–32809`; the switch's docblock and exports just above `:23706–23758`.

## 4. M — the design

| arm | 718 | 719 | the 19 other drill-room legs |
|---|---|---|---|
| A alone (weapon gate lifted; wake walk as OFF) | = D0 | = D0 | — |
| A + C1 (wake walk with the door as `allowTeleporter`) | SOLVED 190 t | DRILL D2 by name | — |
| A + C2 (C1 + the other bodies' volumes forbidden: the census's C) | SOLVED 190 t (same digest) | DRILL D2 | — |
| **shape P: A+C1 BEFORE the walk (the census's shape)** | SOLVED | DRILL D2 | **6 MOVED**: 292/296 (L28, 58 → 93/95 t), 700/702 (L88, 476 → 246, 379 → 258), **707 SOLVED 213 t → REFUSED** (*"no timed pass reaches the crossing"*), 704 a different refusal |
| **shape R (shipped): A+C1 as a rung AFTER the walk's refusal** | SOLVED 190 t | DRILL D2 | **0 moved** |

(`m/arms-717-720.tsv`, `m/radius-shapeA-pass-first.tsv`, `m/radius-shapeR-rung-after-walk.tsv`.)

Why R: P lets the pass pre-empt any door walk that wakes a drill while a weapon is held, including walks the ladder
already solves (L88's room is the case: the walk takes hits the search refuses, or a shorter route the pass replaces).
R asks the pass only where the walk itself refuses with a live drill as its `obstacle`, before a tick is spent, with no
deadline tripped. So it is exactly "the timed pass as a rung before EXHAUSTED is reported", and it reaches only legs that
refused before. C1 over C2: the wake test asks "would the walk to the door wake the drill?"; the planner's own walk with
the door allowed answers it, and the extra volumes changed nothing measured. 30(c): the pass is residue D-A's, unchanged —
searched tick by tick on the run's forecast, certified on a fork, played on the run; 718's keys replayed on a fresh run
cross to L92 hitless, and the page plays them with 0 divergences.

A ladder rung inside `walkTo` was weighed and not built: the ladder is every walk's, its rungs know no crossing goal, and
the rung would sit under `rungGate`/the lab's verbs. The reach-exit's catch is local, has the door, and needs no
`strategySwitch.js` change.

## 5. I — the switch, rows, mutants, radius

**Code (`solverBot.js`, my lines only):**
- `plannedWalkSamples(run, from, to, opts, allowTeleporter = null)` — a 5th argument, null for every existing caller.
- `DRILL_EXIT_PASS`, `DRILL_EXIT_PASS_DEFAULT`, `withDrillExitPass`, `DRILL_EXIT_PASS_COUNTS` (instrument; `armed` rows,
  written only ON) and `drillExitPassAfterRefusal(run, perTick, door, ctx, refusal, ticks0)`, above
  `execDrillTimedPassExit`.
- `execDrillTimedPassExit(…, { armed = false } = {})`: armed skips the weapon gate and plans the wake walk with the door;
  its refusal text names the held weapon when one is held (OFF text unchanged: OFF it never runs with one).
- The reach-exit site: `exitPass` `let`; the walk wrapped in `walkExitOrPass` (OFF: `walkExit()` exactly as before).
- `solverEnvChannel.SOLVER_ENV_NAMES` + `SEEDLING_DRILL_EXIT_PASS`; `seedling-solver-surface.json` (one `run.level` site,
  the instrument: 180 → 181).
- No new kill arm or rung under the lab's verbs (the pass is residue D-A's executor, already ungated); no
  `strategySwitch.js` edit.

**Rows (`hammerDrillExitPass.test.js`, 9 rows, ~9 s; the stagings are the page's captured ones):** the switch ships OFF;
OFF 718/719 EXHAUSTED on the drill; ON 718 SOLVED 190 t, `drill-pass-exit` certified, one `armed` row, the keys
replayed on a fresh run → L92, 0 hits, 0 deaths; ON 719 the DRILL D2 text by name, the run at tick 0; ON = OFF on 717,
720 and L88's 707 (keys); L88's 704 ON = OFF word for word, no pass asked; the L28 Sword row (kill, cut, exit) ON = OFF.

**Mutants** (predicted, then copy + edit + run + restore, `cmp` clean):

| mutant | predicted | measured |
|---|---|---|
| m1 armed keeps the weapon gate | 718 ON red | 718 + 719 ON red (2) |
| m2 armed wake walk without the door | 718 ON red | 718 + 719 ON red (2) |
| m3 the armed pass BEFORE the walk (shape P) | 707 red | 707 red (1) |
| m4 the rung after a walk that spent ticks | none red in the L91 rows | survived them → the 704 row added → **704 red** (1) |

**ON radius by mover class** (the 21 drill-room legs, page and node): fixed 1 (718); refusal reworded by name 1 (719:
EXHAUSTED → DRILL D2); unchanged 19. Regressions 0.

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest (`hammerDrillExitPass`, `solverEnvChannel`, `strategySwitch`, `fidelityResidue`, `fidelityDrill`, `fidelityDrillKill`, `fidelityTimedPass`, `contactFidelity`) | 8 files, 199 passed (defaults); the four drill suites ON: 4 files, 95 passed |
| `entityBlocks`, `contentIdentity`, `boxLock` | 3 files, 86 passed |
| the hammer `.slow` battery (`hammer*.slow` + `strategySwitch*.slow`, `vitest.slow.config.js`) | **8 files, 25 passed** (1213 s) |
| `ci-producer-checks --jobs=4` | ON: 97 run, **0 red**. OFF: 97 run, **0 red** (`--jobs=3`). Two earlier OFF runs read `1 red` = the battery's TREE-MOVED guard only (I committed / wrote this report while they ran; every producer rc 0) |
| `census-seedling-solver-surface --check` | ⚠ written at the I commit (`run.level` 180 → 181, the instrument) BEFORE the rung rework, so the I commit's census was stale: **CI's first JSUT run was red on it** (`seedlingSolverSurface.test.js` (i), 1 of 25,846). Re-written at `4acf4f04` (`run.ticksCompleted` 158 → 160: the rung's two reads), GREEN 371 rows, the test 36/36 |
| `census-seedling-constants --check` | PASS, 0 moved |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED |
| `generate-docs-index.mjs --check` | OK |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless) | ALL PASS |
| identity block (`identity-block.sh`) | AFTER at `67ac6fcf` vs BEFORE at a pristine worktree of `0d575b78ea`: **all 18 digest rows identical** (maze, acceptance, the pairs, ENEMY/guard/AREA census, killgate ×3, levels ×2, the six producer `--check`s, all exit 0). The worktree's `generated set` (no venv in a worktree) and `reference` (HEAD's script against main's code) rows are not comparable there; at HEAD both are OK (`d/`) |
| train files run locally | `hammerSouthDoor.train`, `hammerPitWest.train`: 2 files, 12 passed (555 s), OFF. No train or slow file names a drill; every `reach-exit` reaches the changed site, so these two (door-walk heavy) stand for the rest. The planner's train-tier dispatch is still wanted |
| JSUT | run `42408824984` at `67ac6fcf`: 25,845 passed, **1 failed** (the stale surface row above); slow battery 439/439. At `4acf4f04` the JSUT workflow's path filter did not fire (only the surface JSON moved; `unittests` ran green, run `42413356429`), and a cloud session gets a 403 on dispatch — **so no green JSUT exists at the head yet: the planner's dispatch (or the harvest's run) is the suite number**. The one red row is verified fixed locally (`seedlingSolverSurface.test.js` 36/36) |

## 7. What the harvest A/B should expect

- **OFF: no movers.** OFF calls `walkExit()` exactly as before and `execDrillTimedPassExit` is unchanged when not armed.
- **ON sweep dispatch** (the divergence sweep, the drill rooms):
  `keys` = the 21 legs `level_28__r0c6 <- …` (6), `level_28__r1c18 <- in_L30_0_128 -> exit:out_teleporter_304_16`,
  `level_28__r11c4 <- in_L27_168_16 -> exit:out_teleporter_128_304`, the nine `level_88 <- …`, and
  `level_91 <- in_L89_208_0 -> exit:out_teleporter_16_144`, `level_91 <- in_L89_208_0 -> exit:out_teleporter_240_48`,
  `level_91 <- in_L92_32_144 -> exit:out_teleporter_16_144`, `level_91 <- in_L92_32_144 -> exit:out_teleporter_240_48`
  (or simply the whole leg list: ON can only move a leg whose door walk refused on a live drill);
  `solver_env` = `SEEDLING_DRILL_EXIT_PASS=1`. Expect: 718 failed → done (190 t, 0 room hits); 719 failed → failed with
  the DRILL D2 text; every other key unchanged.

## 8. What the brief got wrong (measured)

- *"arm A + C … SOLVES 718 … done on the page"* is true, but as built (the pass before the walk) it is not an OFF switch
  one can flip: it moves 6 drill-room legs and regresses L88's 707 (§4). The brief's own alternative ("a rung before
  EXHAUSTED") is the shape that holds.
- *"C (the wake test's walk with the door allowed)"*: the census's C also forbade the other bodies' volumes; the door alone
  is enough (same digest on 718, same refusal on 719).
- *"719 … refuses BY NAME"*: in node the refusal is a plain `Error` from `levelRun` (the model's guard), not a
  `SolverRefusal`; the page's `settleSolve` reports it as a refusal. Raised on the certificate's fork, so no tick is
  played. Left as is (the guard is fidelity's).
- The radius has a second D0 failure the census did not list: L88 leg 704 (§3), a walk that spends ticks and then refuses
  on `drill@128,160`. Out of this slice's shape (the rung never answers a refusal after ticks) — named, not fixed.

## 9. Residue and hand-overs

- **Fidelity DRILL-WATER** (as briefed): 719's witness is the request above (`level_91 <- in_L92_32_144 ->
  exit:out_teleporter_16_144`, sphere 5.6) — the drill's hop onto tile type 1 at (40,120) on tick 211 of the pass search.
  Once the model follows a drill into water, 719 under this switch should either solve or refuse inside the pass search.
- **L88 leg 704**: the walk to the L12 door from (32,16) stalls (dashless) / EXHAUSTS on `drill@128,160` after spending
  ticks. Shape-P's pass search refused it too (*"no contact-free arrival with a 14-tick stand"*, best 190 px), so this is
  not a wiring gap; unmeasured further.
- The leg list's 700/702/707 carry 1–2 room hits at D0 (forced hits, not this slice's).
- The census's B (`execDrillKillsFirst` before a reach-exit) stays unbuilt.
- A process note: my own first radius capture served a half-edited `solverBot.js` to the page for a few seconds (leg 701
  read *"DRILL_EXIT_PASS is not defined"*); re-captured clean. Editing the served tree during a page sweep is a trap.
- `tools/replay.mjs` is measure-only scratch.
