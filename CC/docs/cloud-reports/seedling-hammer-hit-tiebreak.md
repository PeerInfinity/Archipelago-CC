# Seedling hammer-phase HIT-TIEBREAK — the ANYTIME ranking reads the model's hit verdict (`HIT_AWARE_ANSWER`, OFF)

Session `seedling-hammer-hit-tiebreak` (Opus, cloud). The planner is `seedling-hammer-phase-planning-11`.
⚖ The user approved the slice on 2026-11-17: *"Slice it now (Recommended)"*. No follow-up from the planner arrived, so
the scope is the brief's.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `94d5e1be2722a2f2d7f3bff3026329076bb394a7` (`hammer-harvest-wave6`: main at train 136 + wave 6 + FADE-MOVE; not pushed to) |
| Commits | step 1 measure `6adfe5ee` · step 2 switch `f67c5197` (the code head) · step 3 rows `f9334abd` · evidence `2a19b365`, `71c58807`, `115416d0` · report `bee62ddb` · this one-line report fix (last; its message carries the Cloud trailers) |
| Branch | `seedling-hammer-hit-tiebreak` |
| Switch | `jsRuntimeSolver.HIT_AWARE_ANSWER`: `SEEDLING_HIT_AWARE_ANSWER=1`, `withHitAwareAnswer(enabled, fn)`, `HIT_AWARE_ANSWER_DEFAULT = false`, listed in `SOLVER_ENV_NAMES` |
| Thread | `betterAnswer` runs inside `solveAnytime`. That is the page's **solve worker** (and node). No main-thread mapper reads the switch, so `pageSolverEnvSwitchOn` is not needed: the worker env channel is the whole page wiring. Measured: the page rows for `?seedlingSolverEnv=SEEDLING_HIT_AWARE_ANSWER=1` carry `modelHits` on their pass rows (§6) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-hit-tiebreak-evidence/`: `w0/` page rows and the env lists, `m/` node replays, `game/` p4g witness rows, `census/`, `survey/`, `tools/`, and the bounded vitest log |
| Environment | `session_bootstrap.sh --seedling`, node v22.23.5, 4 cores. This session started `:8000` (`serve-nocache.py`) |

## 2. The answer first

**The one thing to know first:** the model already knows. Each pass's segment ends on a model run (the shadow, or the
fork a rewind adopted). That run's `playerHits` ledger and `playerDeaths` hold the hits the game later shows, tick for
tick. They were simply never put on the plan. ON, `solveFromTape` stamps each plan with
`modelHits = {hits, deaths}`, counting only the plan's own ticks. `betterAnswer` then ranks two plans with different
verdicts by the verdict alone. Nothing here is an UNBILLED hit: on every row measured, the stamp equals the hits
re-driven on a fresh `replayTape` and the game's hits.

| leg (key) | env | OFF ships | ON ships | p4g game, ON |
|---|---|---|---|---|
| 308 `level_30__r2c10 <- in_L31_160_384 -> location:L30 flag 0: bosslock@64,32 cleared` | defaults | full 191 t: 3 model hits (t151 body, t171 / t191 sword) + death; game hits t151, t171 | **dashless 255 t, 0 hits** | **0 hits**, `done`, flag cleared, game end = model end |
| 171 `level_12__r0c19 <- in_L95_624_80 -> location:L12 flag 4: bosslock@416,240 cleared` | defaults | full 672 t, 2 punches; game hits 610, 652 | **dashless 713 t, 0 hits** | **0 hits**, `done`, game end = model end |
| 160 `level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 4: bosslock@416,240 cleared` | defaults | full 632 t, 2 punches (dashless 680 t is punched too) | = OFF (same verdict, so length decides) | 2 hits (575, 615), as OFF |
| 160 | `SEEDLING_FADE_MOVE=1` | full 632 t, 2 punches; game hits 575, 615 | **dashless 680 t, 0 hits** | **0 hits**, `done`, game end = model end |

- **Census** (node, all 924 sweep legs, the page's budget and window): at defaults **2 legs move (171, 308)**. Under
  FADE_MOVE, **160 moves** (171 is already hitless there). No leg moves toward a hit (§7).
- **Route survey `--through=end`:** 224/26 both arms, **0 movers, no step gains a hit**. The survey never asks
  `betterAnswer` (§8).
- **Acceptance md5:** `391322d681b7aa0229d94b3f6906d024` at base and at the tip with the switch OFF.

## 3. The reproduction (measured)

**Page, base, defaults** (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver
--page=seedling_bot_ap_p4g --page-legs=1 --keys=<160|308> --capture-requests`; leg list from
`seedling-divergence-legs.mjs` at this base, ids 160 and 308 = W44's):
- 160: done, 632 t (`full`), roomHits 2 (t575, t615, `exact`).
- 308: done, 191 t (`full`), roomHits 2 (t151, t171).

Rows: `w0/page-rows-off.jsonl`.

**Node replay of those captures** (`tools/passes.mjs`). Every pass's plan is replayed on a fresh `replayTape`
(`m/off-*.json`):

| leg | dashless | full | shipped |
|---|---|---|---|
| 308 | 255 t, 0 hits, 0 deaths | 191 t, `bobsoldier@48,80` chaser t151 / sword t171 / sword t191, **1 death** | full |
| 160 | 680 t, `puncher@416,256` punch t624, t664 | 632 t, punch t575, t615 (window-cut dash schedule) | full |

**The wave-6 ON env** (`w0/wave6env.txt`) was rebuilt from the switches harvested in wave 6, because no list is
committed: FRONTIER_DOOR_ROUTE, SHOVED_BODY_LOOKAHEAD, UNHELD_LOCK_NEXT_DOOR, CHASER_PASS, BAIT_TARGET_GONE,
SUBWALK_ANCESTOR_CROSSING, KILLLOCK_STANDOUT_GUARD, DRIVE_DEATH_REFUSED, FADE_MOVE, FADE_MOVE_ATTACK.
- **Page:** 308 done, **0 hits**, 255 t; 160 done, 2 hits, 632 t (`w0/page-rows-wave6.jsonl`).
- **Node** (`m/w6-*.json`):
  - 308's full pass **refuses** ("the player DIED at run t191 … bobsoldier@48,80"), so dashless ships.
  - 160: dashless 680 t **0 hits**, full 632 t 2 punches; the full pass ships.
- **Which switch moves 308:** DRIVE_DEATH_REFUSED alone gives that refusal and the dashless ship. FADE_MOVE alone, and
  FADE_MOVE + ATTACK, still ship the dying 191 t full plan (§8.1).

**What a pass's answer carries at ranking time (the step-1 crux).**
- **Deaths:** `plan.expected[i].deaths` is already on every plan.
- **Hits:** nothing on the plan carries them today. `forcedHits` / `damage` are present only when the solver billed a
  forced crossing; neither leg's passes bill one (`forcedHits 0`).
- **The run the plan ended on does carry them:**
  - `ended.ledger('playerHits')` holds the rows above. On this harness it is the recording proxy of the shadow, or of
    the adopted fork (B3).
  - Its length minus the shadow's length before the solve is exactly the re-driven count, on all eight pass rows
    (2 legs × 2 passes × {defaults, FADE_MOVE}).
  - So the case is the first one: **the model knows**. The field is new (`plan.modelHits`), read from the model's own
    ledger.

## 4. Design and change; OFF identity

All hunks are in `jsRuntimeSolver.js` (plus one name in `solverEnvChannel.js`). `solverBot.js` is not touched.
- **`HIT_AWARE_ANSWER` / `withHitAwareAnswer`:** the switch, after `TALK_CLEAR_GOAL`'s pattern, read once at module
  load.
- **`solveFromTape`:**
  - ON only: `hitsBefore` = the shadow's `playerHits` length before `solveSegment`.
  - After the trailing-equip tick, the plan gets `modelHits: {hits: ended − hitsBefore, deaths: expected.at(-1).deaths
    − expected[0].deaths}`.
  - A rewound segment's fork replays the same prefix from boot, so the subtraction is the plan's own hits there too.
- **`betterAnswer`:**
  - In the `best.ok` arm only, ON, and when `next` is a plan: `hitVerdictOrder(best.plan, next.plan)` returns `true`
    (next is hitless, best is hit), `false` (best is hitless, next is hit) or `null` (same verdict, or either plan
    unstamped).
  - `null` falls through to today's rule: strictly fewer ticks, and a tie keeps the first.
  - A death is a hit verdict. Hit counts are not compared: two hit plans rank by length.
  - Refusals, skips and the deadline rule are untouched.
- **`solveAnytime` pass rows:** ON, they echo `modelHits` (diagnostic; the sweep rows show it).
- **OFF:**
  - No stamp is written. `hitsBefore` is `null`, so the plan object is the same.
  - `betterAnswer` evaluates `HIT_AWARE_ANSWER.enabled` (false) and takes today's expression.
  - Acceptance md5 (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`): **base `94d5e1be`
    `391322d681b7aa0229d94b3f6906d024`**, **tip (code head `f67c5197`, OFF) `391322d681b7aa0229d94b3f6906d024`**. Equal.
- **Generated surfaces:**
  - `census-seedling-solver-surface.mjs --write` then `--check`: GREEN, 374 rows, unchanged.
  - `census-seedling-constants.mjs --check`: PASS.
  - `generate-procgen-reference.mjs` and `generate-docs-index.mjs`: no tracked change.
  - No docs under `docs/json/developer/procgen/` were edited.

## 5. Rows and bounded vitest

**`hammerHitTiebreak.test.js` (new, 10 rows).**
- **The switch:** OFF by default, in `SOLVER_ENV_NAMES`, and restored after a throw.
- **Synthetic `betterAnswer`, hit/hitless × longer/shorter, both orders:**
  - 308's and 160's shapes; a shorter hitless plan; a death-only verdict;
  - same verdict decides by length (both hit, both hitless, a tie);
  - an unstamped plan decides by length;
  - refusals and skips give an identical vector ON and OFF;
  - OFF never reads the verdict;
  - `planTakesHit` / `hitVerdictOrder`.
- **Witness legs:** the page captures of 308 and 160, each cut to its one level (`fixtures/hammer-hit-tiebreak/`,
  `tools/cut-fixture.mjs`).
  - 308 OFF ships full 191 t, unstamped, with the model's 3 hits and death.
  - 308 ON: each stamp equals the re-driven hits, and the dashless 255 t ships.
  - 160 at defaults: ON = OFF byte for byte.
  - 160 under FADE_MOVE: OFF ships full 632 t, ON ships dashless 680 t, and each stamp equals the re-driven hits.
- **Mutant** (the verdict ignored in `betterAnswer`): 3 rows red (the synthetic ON row and both witness ON rows). The
  file was then restored.
- **Runs:**
  - With `SEEDLING_HIT_AWARE_ANSWER=1` in the env: 10/10.
  - **Bounded vitest, 22 files, 356 / 356 passed** (`--maxWorkers=2`; list `vitest-bounded-files.txt`, log
    `vitest-bounded.txt`). The set: the new file, `solverEnvChannel`, every `jsRuntimeSolver*` / `jsRuntime*` file
    that solves (Anytime and ShouldStop are the existing `betterAnswer` rows), the wasm walk / delivery / equips /
    hold-seam rows, the dash-window and dash-shape rows, FADE-MOVE and CLEARTAG-STAND.
- **Not run (the brief's boundaries):** unfiltered vitest, the train tier, pytest, `standing-values`, full sweeps, the
  whole-game walk.

## 6. Page play and game witness (p4g)

Page sweep at the step-2 code, `--page=seedling_bot_ap_p4g --page-legs=1`. Rows: `game/*.jsonl`.

| leg | `--solver-env` | end | plan | game hits | divs | game end = model end |
|---|---|---|---|---|---|---|
| 308 | `SEEDLING_HIT_AWARE_ANSWER=1` | done, flag cleared | 255 t dashless | **0** | 0 | (72.115, 50.121) both |
| 171 | `SEEDLING_HIT_AWARE_ANSWER=1` | done, flag cleared | 713 t dashless | **0** | 0 | (424.000, 258.027) both |
| 171 | (none, the control) | done | 672 t full | 2 (610, 652) | 0 | — |
| 160 | `SEEDLING_HIT_AWARE_ANSWER=1` | done | 632 t full | 2 (575, 615) | 0 | as OFF |
| 160 | `SEEDLING_FADE_MOVE=1;SEEDLING_HIT_AWARE_ANSWER=1` | done, flag cleared | 680 t dashless | **0** | 0 | (424.875, 282.318) both |
| 160 | `SEEDLING_FADE_MOVE=1` (the control) | done | 632 t full | 2 (575, 615) | 0 | — |

**308 against the brief's witness item:** game ledger 0 hits. The page's pass rows read `dashless 255 t {hits 0,
deaths 0}` and `full 191 t {hits 3, deaths 1}`. The worker read the switch through the env channel.

## 7. Census: which seed-1 divergence-sweep legs the change can move, and why

**Method** (`tools/census-leg.mjs`, `census/README.txt`).
- Every leg of this base's list (924) is solved in node as the page's solver producer asks it:
  - inv staging, with the sphere's items and slots matched by KEY;
  - save keys, seals and totems from the sphere inventory (the small-walls recipe staged none, so every bosslock leg
    refused);
  - the p4g dump;
  - `ANYTIME_PASSES` under `SOLVER_BUDGET_WORK` 640 / `SOLVER_UPGRADE_WINDOW_WORK` 85 (no held retry).
- One run with the switch ON gives both choices: ON's own, and today's length rule over the same pass rows.
- **Validated:** 160 and 308 reproduce the page captures' passes exactly (ticks, work units, verdicts).
- ⚠ The arrival rng differs from the page's (node seed 0), so a leg where a body's motion depends on it can differ.

**Defaults (`census/summary-defaults.txt`).**
- Counts: 816 solved, 83 refused, 4 no solver goal, 21 over the 240 s cap. The 21 are the same boss legs small-walls
  could not measure: L32 Times, L57 ×2, L69 Lights, L82 ×2, L112 Owl, L19 Shieldspire, and 13 L43 Totem arrivals.
- 711 legs have both passes planned.
- **4 are mixed** (both passes planned, verdicts differ):

| leg (key) | passes | OFF → ON |
|---|---|---|
| `level_12__r0c19 <- in_L95_624_80 -> location:L12 flag 4: bosslock@416,240 cleared` (171) | dashless 713 t 0 h; full 672 t 2 h | **MOVES** full 672 (2 h) → dashless 713 (0 h) |
| `level_30__r2c10 <- in_L31_160_384 -> location:L30 flag 0: bosslock@64,32 cleared` (308) | dashless 255 t 0 h; full 191 t 3 h + death | **MOVES** full 191 → dashless 255 |
| `level_30__r2c10 <- in_L28_304_16 -> location:L30 flag 0: bosslock@64,32 cleared` (302) | dashless 187 t 2 h; full 156 t 0 h | stays: the hitless plan is already the shorter |
| `level_82 <- in_pit_L71_10_17 -> exit:out_teleporter_144_0` (637) | dashless 1141 t 0 h; full 1363 t 2 h | stays: the hitless plan is already the shorter |

**Under `SEEDLING_FADE_MOVE=1`** (FADE-MOVE's 52 static lock legs, `census/summary-fadeMove.txt`):
- 3 mixed. **160 MOVES** (full 632 t 2 h → dashless 680 t 0 h); 308 MOVES as at defaults; 302 stays.
- 171 is not mixed there: FADE_MOVE already makes its full pass hitless.

**Why only these.** The tie-break can move a leg only when both passes return a plan and exactly one of them is
model-hitless. The shipped plans that take a model hit at defaults are 11. Of those, 9 have **no hitless pass**, and no
ranking can fix them:
- L12 bosslock 127, 128, 160, 161, 172 (FADE_MOVE fixes 127, 128, 161, 172 itself; with FADE_MOVE + this switch all six
  L12 L35/L95 legs ship hitless in the model);
- L16 pit exits 838, 841, 845, 848 (both passes 1 hit).

**No leg moves toward a hit:** a move needs the new plan to be hitless.

## 8. What the brief got wrong (measured)

1. **"308 went from 2 hits to 0 because FADE_MOVE changed the plan."** With the reconstructed wave-6 env, 308's full
   pass is **refused by DRIVE_DEATH_REFUSED** (the player dies at t191), so the dashless pass ships. FADE_MOVE alone,
   and FADE_MOVE + ATTACK, still ship the dying 191 t plan. This matches FADE-MOVE's own §3 ("no hitless move"). Caveat:
   no wave-6 env list is committed, so that env is my reconstruction (`w0/wave6env.txt`). The two switches overlap on
   308 only: DRIVE_DEATH_REFUSED covers a dying plan by refusing it, and this switch also covers hits that do not kill
   (171, 160).
2. **"Survey `--through=end` ON vs OFF: every mover by step."** The route survey solves each step in place with one
   search (`passes: [{pass: 1, kind: 'solve'}]`, no `solveAnytime`), so `betterAnswer` is never asked. Its 0 movers
   holds by construction; it is not evidence about the ranking. The node census (§7) is the instrument that sees this
   change.
3. **"L12 key 160: the dashless pass is 680 t and hitless"** holds only with FADE_MOVE ON. At defaults both of 160's
   passes are punched twice, so the tie-break leaves it alone. The defaults leg the brief did not name is **171**
   (`… in_L95_624_80 -> … flag 4 …`): its dashless pass is hitless at defaults, and it moves.
4. **The main-thread reader** (`pageSolverEnvSwitchOn`) is not needed: the ranking runs in the worker.

## 9. Residue / hand-overs

- **Planner:**
  - The landing sweeps: OFF + `SEEDLING_HIT_AWARE_ANSWER=1`, with capture on the ON arm.
  - Predicted: 171 and 308 roomHits 2 → 0, at 713 t and 255 t (+41 t and +64 t, which is the point). Every other leg
    is byte-identical in plan, except the 21 boss legs, which are not measured.
  - With FADE_MOVE also ON: 160 2 → 0 at 680 t (+48 t).
  - The flip pair (FADE_MOVE + HIT_AWARE_ANSWER) makes all six L12 L35/L95 keylock legs and 308 hitless in the model.
    Game-witnessed so far: 160, 171, 308.
- **Hammer / fidelity (both passes hit, no ranking fix):**
  - L16 pit exits 838 `level_16__r1c9 <- in_L15_144_16 ~> level_16__r1c1 -> exit:out_pit_7_2`, 841 (`… out_pit_7_3`),
    845 `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_2`, 848 (`… out_pit_7_3`): 1 model hit in
    both passes.
  - 128 / 161 at defaults: the dashless pass *dies* (3 h + death) and the full pass takes 2 hits.
- **Possible follow-ups (not built):**
  - Ranking hit plans by count (fewer hits, or no death beats a death) would rank 128 / 161's two hit plans. The
    brief's rule leaves same-verdict plans to length.
  - A third, hit-avoiding pass when every pass hits.
- **JS arc (js-21):** the hunks are local to `betterAnswer`, `solveFromTape`'s plan literal, the pass row, and four new
  exports. The plan gains `modelHits` only ON, so a structured clone or a delivery check sees it only ON.
- **Not measured:** the 21 boss legs over the 240 s cap; the census's node rng versus the page's on bodies it moves;
  held-retry interplay (a retry runs only with no plan in hand, so it never ranks two plans).
