# Seedling hammer-phase — slice RETRY-RATE: do HARD refusals at 640 solve at 2560? (`seedling-hammer-retry-rate`)

MEASURE ONLY. No change to the solver, playback or model. The planner is `seedling-hammer-phase-planning-12`. ⚖ The user
approved the slice on 2026-11-19T18:11:57Z (*"Measure first, B1 window (Recommended)"*) and launched it on
2026-11-20T16:29:18Z (*"Launch it now (Recommended)"*). No planner follow-up arrived during the session.

## 1. Start SHA, head, branch

- Start (base): `origin/main` @ `d358d50e0219975dc8c7e4205a36f2db6c6b887d`.
- Branch: `claude/seedling-retry-rate-measure-pmgnfo`. The head is this report's commit; the final chat message names its SHA.
  The earlier commits on the branch are the script (`f709f8ef52`), its regenerated instruments reference (`8e837ca1cc`), the
  evidence (`b4208a2a9f`), and the `--idle` option with its evidence and the regenerated reference (`ecdde8cc69`).
- Re-measure-5's evidence came from `origin/claude/whole-game-wasm-remeasure-5-h7ymjx` @ `2cc5354fb2`. I read it there and
  did not copy it.
- `HIT_AWARE_ANSWER` is **ON** at this base (`jsRuntimeSolver.js:397`, ON unless `SEEDLING_HIT_AWARE_ANSWER=0`). Every row
  below was measured with it on (each jsonl row records `hitAware: true`).

## 2. The answer

**0 of 30 HARD refusals at 640 solve at 2560.** Every one gives the byte-identical refusal at a straight 2560, after the
identical number of work units:

| population | HARD@640 | solve at a straight 2560 | same text | same work |
|---|---|---|---|---|
| the 26 survey-REFUSED steps at base (33 goal requests) | 20 | **0** | 20 | 20 |
| the L40 Chest goal, 90 arrival clocks (seam time −45…+45) | 10 | **0** | 10 | 10 |
| **total** | **30** | **0** | 30 | 30 |

**The one thing to know first:** a HARD refusal does not depend on the budget. That follows from how the budget is built,
and the measurement agrees with it. The budget reaches the solver only through the `shouldStop` hook that
`passShouldStop` installs (`jsRuntimeSolver.js:326`; nothing in `solverBot.js`, `levelRun.js` or `twoPassSolve.js` reads
`budgetWork`). A HARD answer is one where that hook never returned `true` (no pass has `limit: 'budget'`, and the
refusal has no `deadline`). At any larger budget, the hook returns the same `false` at the same calls, so the search and
its answer are the same. Every HARD here finished well under 640 units (median 108, maximum 544).

**A2's stop depends on the ARRIVAL, not on the budget.** A2 stopped at entry 19, L40 Chest, with *"kill
(spinner@816,848) by press: every key set … There is no step out"*. That refusal reproduces exactly at four arrival clocks
of the same goal (seam time d = −15, −14, +30, +31; the spinner's period is 45): the same text and the same landing
point (868.73,855.83). The arrival one tick earlier or later is budget-cut at 640, and the held retry solves it hitless,
which is the A1/A3 path. Standing still for 1, 2, 4 or 8 ticks before asking keeps every HARD arrival HARD, with the
identical refusal (40 of 40, §8). Across 90 arrivals, 78 are budget-cut
at 640 and all 78 solve hitless on the retry; 10 are HARD; 2 solve at 640.

**Recommendation: retry NONE of the HARD refusals at a larger budget.** No switch is proposed. §8 has the reasoning and
the cost.

## 3. The reproduction (measured)

### 3.1 Fixtures, and how each was built

- **Survey boots.** At base I ran `survey-seedling-route.mjs --through=end --route=full --only=<the 26 steps>`
  `--timeout=1500`. The 26 steps are the REFUSED rows of re-measure-5's `survey-refused-rows.txt` (survey run
  44369671417 @ `76f15abd88`). I ran them as 4 local shards. **All 26 are still REFUSED at base**
  (`evidence/survey-rederive-at-base.txt` has each verdict and the head of its refusal). Each step child writes its boot
  as a 0-tick tape, `.cache/seedling-survey/through-end/views/step-N-boot.json`. That is the survey's own staged
  construction (grants, staged persistence, save arrays), written before the solve. The goals come from the same run's
  `route.json`.
- **Requests.** `measure-seedling-hard-refusal-retry.mjs` builds the page's solve request for each goal in order:
  `{staging, perTick, equips, live, solverGoal}`. It uses the survey's world model (the patched atlas, delivered, with AP
  chests as `apitem`s while `CONTACT_FIDELITY.apChestItem` is on) and the survey's own goal mapping. When the page path
  solves a goal, the script plays that plan onto the prefix and asks the next goal from there, the way the page asks from
  the live state. A step stops at its first unsolved goal. Each request is saved with `captureRequest` as
  `evidence/fixtures-refused/step-N-goal-K.json` (33 files) and `evidence/fixtures-l40-chest-sweep/step-66@d-goal-0.json`
  (90 files).
- **The A2 fixture.** No capture of A2's own request exists: re-measure-5 recorded console lines only, and this brief
  did not ask for a whole-game walk. A2's goal is survey step 66's first goal ("Level 040 - Chest", `apitem (880,816)`).
  Its three runs differed only by their walk-in, so I swept that goal's arrival clock: `staging.seam.time` 8586 + d, for
  d = −45…+45 without 0 (the survey boot itself is the d = 0 row in §3.2). This is the census's `atSeamTime`, where only
  the clock moves and the model derives every mobile's phase from it.
- **Reproduction in a fresh process** (`--request=<file>`, one process per budget):
  - `step-66@-15-goal-0` gives HARD, 340 work at 640 and HARD, 340 work at 2560, with the same refusal.
  - `step-66-goal-0` gives CUT, 644 work at 640, then the retry solves at 1544 work. A straight 2560 also solves, at 1544.

### 3.2 Per fixture: the 26 survey-REFUSED steps (33 goal requests)

These are the page's path: 640, then `expiryAction`'s held retry where it says `'retry'`. A straight 2560 was also asked
for every unsolved goal. `t` = ticks; the hits are the model's, from replaying the plan on its prefix. Source:
`evidence/refused26.jsonl`.

| step | L | goal | verdict @640 | @640 | held retry (2560) | straight 2560 | HARD reason (refusal text) |
|---|---|---|---|---|---|---|---|
| 39 | 32 | 1/2 Level 032 - Bob Boss | **SOLVED** | SOLVED 825t, 0 hits, 50 work | — | — |  |
| 39 | 32 | 2/2 Level 032 - Times | **HARD** | refused, 0 work | — | refused, 0 work | item gate: Fire not held (apReportBosses) |
| 54 | 49 | 1/1 Level 049 - Conch | **HARD** | refused, 106 work | — | refused, 106 work | walk: the re-planned corridor stalls |
| 66 | 40 | 1/2 Level 040 - Chest | **CUT** | refused, 644 work (cut) | SOLVED 1338t, 0 hits, 1544 work | SOLVED 1338t, 0 hits, 1544 work |  |
| 66 | 40 | 2/2 Level 040 - Totem Part 160,640 | **HARD** | refused, 138 work | — | refused, 138 work | ladder EXHAUSTED (spinner) |
| 75 | 49 | 1/1 teleporter@32,128 → L50 | **HARD** | refused, 2 work | — | refused, 2 work | static: no tile path (conch on the frontier) |
| 96 | 40 | 1/2 L40 flag 12: wandlock@480,560 cleared | **CUT** | refused, 645 work (cut) | SOLVED 1419t, 0 hits, 1973 work | SOLVED 1419t, 0 hits, 1973 work |  |
| 96 | 40 | 2/2 Level 040 - Boss Key 2 | **CUT** | refused, 642 work (cut) | refused, 379 work | refused, 758 work |  |
| 105 | 49 | 1/1 teleporter@32,128 → L50 | **HARD** | refused, 2 work | — | refused, 2 work | static: no tile path (conch) |
| 111 | 58 | 1/2 L58 flag 1: yeti@56,56 cleared | **SOLVED** | SOLVED 145t, 0 hits, 100 work | — | — |  |
| 111 | 58 | 2/2 teleporter@80,16 → L46 | **HARD** | refused, 110 work | — | refused, 110 work | walk: stalls on the yeti |
| 134 | 40 | 1/1 teleporter@944,96 → L41 | **HARD** | refused, 74 work | — | refused, 74 work | ladder EXHAUSTED (iceturret) |
| 149 | 40 | 1/2 L40 flag 7: wandlock@208,128 cleared | **CUT** | refused, 642 work (cut) | SOLVED 1449t, 0 hits, 2066 work | SOLVED 1449t, 0 hits, 2066 work |  |
| 149 | 40 | 2/2 Level 040 - Totem Part 64,144 | **HARD** | refused, 12 work | — | refused, 12 work | ladder-routed: the hold stands in a bomb's reach |
| 155 | 61 | 1/1 teleporter@224,208 → L63 | **HARD** | refused, 203 work | — | refused, 203 work | no stance: the bridge spear rect |
| 167 | 43 | 1/2 Level 043 - Wand | **SOLVED** | SOLVED 160t, 0 hits, 119 work | — | — |  |
| 167 | 43 | 2/2 teleporter@144,64 → L37 | **HARD** | refused, 124 work | — | refused, 124 work | walk: the re-planned corridor stalls |
| 174 | 43 | 1/2 Level 043 - Totem of Lacste | **HARD** | refused, 0 work | — | refused, 0 work | order gate: bosstotem sleeps while the Wand stands |
| 183 | 68 | 1/1 Level 068 - Health | **HARD** | refused, 88 work | — | refused, 88 work | static: no tile path (health) |
| 189 | 71 | 1/2 Level 071 - Chest | **CUT** | refused, 643 work (cut) | refused, 1876 work | refused, 1876 work |  |
| 190 | 75 | 1/1 teleporter@64,0 → L74 | **CUT** | refused, 644 work (cut) | refused, 2563 work (cut) | refused, 2563 work (cut) |  |
| 192 | 75 | 1/1 teleporter@64,224 → L71 | **CUT** | refused, 643 work (cut) | refused, 2562 work (cut) | refused, 2562 work (cut) |  |
| 195 | 77 | 1/1 teleporter@96,304 → L78 | **HARD** | refused, 2 work | — | refused, 2 work | static: no strategy row (lavatrap) |
| 196 | 78 | 1/1 teleporter@32,0 → L79 | **HARD** | refused, 2 work | — | refused, 2 work | static: no strategy row (lavatrap) |
| 217 | 71 | 1/1 teleporter@224,304 → L80 | **CUT** | refused, 643 work (cut) | refused, 1864 work | refused, 1864 work |  |
| 228 | 99 | 1/1 stairsup@48,96 → L100 | **HARD** | refused, 544 work | — | refused, 544 work | model: a press kill opens an undeclared kill lock (§9) |
| 232 | 103 | 1/1 teleporter@0,64 → L104 | **CUT** | refused, 643 work (cut) | refused, 2564 work (cut) | refused, 2564 work (cut) |  |
| 236 | 101 | 1/2 L101 flag 0: lightpole@144,64 cleared | **CUT** | refused, 645 work (cut) | SOLVED 711t, 0 hits, 2563 work | SOLVED 711t, 0 hits, 2563 work |  |
| 236 | 101 | 2/2 stairsup@144,96 → L102 | **HARD** | refused, 2 work | — | refused, 2 work | item gate: Fire Wand |
| 238 | 107 | 1/1 teleporter@304,176 → L108 | **HARD** | refused, 6 work | — | refused, 6 work | ladder EXHAUSTED (crusher) |
| 239 | 108 | 1/1 teleporter@224,224 → L109 | **HARD** | refused, 2 work | — | refused, 2 work | static: no strategy row (lavatrap) |
| 241 | 101 | 1/1 teleporter@104,24 → L110 | **HARD** | refused, 2 work | — | refused, 2 work | item gate: the Fire Wand press is not modelled |
| 246 | 112 | 1/1 teleporter@112,0 → L113 | **HARD** | refused, 2 work | — | refused, 2 work | static: no strategy row (rocklock) |

Tally: 33 goal requests. 3 SOLVED at 640. 10 CUT, of which the retry solves 4, all hitless (66 g1, 96 g1, 149 g1,
236 g1). 20 HARD, of which 0 solve at 2560.

Every CUT here has `answered = 0`, so the retry re-runs both passes. The one exception is 96 goal 2: its dashless pass
refused HARD at 379 units and only the full pass was cut, so the retry ran the full pass alone and it refused HARD. Its
straight 2560 reports 758 units because it pays the dashless pass again.

### 3.3 The L40 Chest arrival sweep (A2's goal), 90 arrivals

`evidence/sweep66.jsonl`. Each cell is d, then the verdict at 640: `C+` = CUT and the retry solved it, `H` = HARD,
`S` = solved at 640.

```
-45…-32 C+ (14) · -31 H · -30 C+ · -29 H · -28 H · -27…-25 C+ · -24 S · -23…-16 C+ · -15 H · -14 H · -13…-1 C+
+1…+13 C+ · +14 H · +15 C+ · +16 H · +17 H · +18…+20 C+ · +21 S · +22…+29 C+ · +30 H · +31 H · +32…+45 C+
```

- **HARD: 10. All 10 give the identical refusal at a straight 2560, after the identical work.** There are two families,
  and both repeat with the spinner's 45-tick period:
  - d = −31, −29, −28, +14, +16, +17: *"kill (spinner@880,848) by press: every key set … at (741.44,685.29) / (739.28,683.81)
    … There is no step out"*, at 112 work.
  - d = −15, −14, +30, +31: *"kill (spinner@816,848) by press: every key set … at **(868.73,855.83)** … There is no step out.
    The corner formed 7 tick(s) after the press … LANDED"*, at 340 work. **This is A2's refusal**, with the same landing
    point as A2's console line.
- **CUT: 78. The held retry solves all 78, hitless (0 model hits, 0 deaths)**: 1153–1338 ticks, 1361–1899 work. The
  retry plans include the 1222-tick plan A3 played (d = −38…−33).
- **SOLVED at 640: 2** (d = −24 and +21): the dashless pass solves at 639 units (1284t, hitless) and the full pass is cut,
  so the page plays it as a provisional plan.

### 3.4 What a HARD refusal's text says, and which field marks it

The brief asked which HARD refusals name a budget-independent reason (static geometry, no stance, a covered goal) and
which a search-order one. By text, the 30 HARD refusals split like this:

- **Static: no tile path or no strategy row (8):** steps 75, 105, 183, 195, 196, 239, 246. Each is a planner
  connected-components answer at 2 work, or 88 for step 183.
- **Item or order gate (4):** 39 goal 2, 174, 236 goal 2, 241.
- **No stance (1):** 155.
- **Model declaration (1):** 228.
- **The model's walk stalls (3):** 54, 111 goal 2, 167 goal 2.
- **Ladder exhausted or ladder-routed (4):** 66 goal 2, 134, 149 goal 2, 238.
- **The spinner press-kill's "no step out" corner (10):** the sweep's HARD rows.

That last kind is the "search-order" kind the brief suspected. The press kill throws a whole-solve refusal from inside
its own rung, after a fallback rewind, without handing the goal back to another approach. The order it depends on is the
strategy order inside one search, not budget order. The same search at 2560 reaches the same throw.

**The solver's answer already tells cut from not-cut, with the fields the page already reads:** the refusal's
`deadline` (set by `settleSolve` from `err.deadline`) and each pass row's `limit === 'budget'` (`budgetCut`). It also
carries `obstacle` (`{kind, id}`) on some refusals and `declaration` on a pending declaration. **No field separates
"static" from "search-order"**, and on this measurement no field needs to: every HARD answer, of either kind, is
independent of the budget.

## 4. Design + change, OFF identity

There is no behavioural change, so there is no switch. The branch adds:

- `scripts/procgen/measure-seedling-hard-refusal-retry.mjs` (`--steps`/`--step`, `N@d` seam offsets, `--goal`,
  `--idle`, `--dump-requests`, `--request`). It is measure-only, nothing runs on import, and it spawns one
  process per step. The procgen help check for it passes: `check-procgen-help.mjs --only=…` reports ALL PASS.
- The regenerated instruments reference: `docs/json/developer/procgen/architecture.md` (560 → 561 instruments) and
  `frontend/modules/procgenDocs/generated/instruments.js`.
- The evidence directory and this report.

`git diff d358d50e02 HEAD -- frontend/modules` touches only `procgenDocs/generated/instruments.js`.

The acceptance md5 (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`) is the same at both ends:

- **at base** `d358d50e02` (a temporary detached worktree, since removed): `391322d681b7aa0229d94b3f6906d024`;
- **at the branch** (`8e837ca1cc`; nothing the acceptance imports changed after it): `391322d681b7aa0229d94b3f6906d024`.

Both equal the brief's expected value.

## 5. Rows + bounded vitest runs

- **No new test rows.** This is a measurement, and there is no behaviour to pin.
- `npx vitest run frontend/modules/procgenDocs/`: 8 files, 497 tests, all pass. This is the link-census pins owed for the
  edit to `docs/json/developer/procgen/architecture.md`.
- Regeneration, then `--check`, all exit 0:
  - `census-seedling-solver-surface.mjs --write` (374 rows; unchanged);
  - `generate-procgen-reference.mjs`;
  - `quicklaunch/generate-docs-index.mjs`.
- I ran no unfiltered vitest, no pytest and no `standing-values --write`.

## 6. Page play / game witness

None. The brief asked for no whole-game walk and I ran none. The page's behaviour in this slice is the re-measure-5
console record (§3.1). The node solves here are the same `solveAnytime` request the wasm page's worker answers.

## 7. Census: which seed-1 divergence-sweep legs the change can move

None, because nothing behavioural changed: the acceptance md5 is identical at both ends (§4). The recommendation is to
change nothing in `expiryAction`. If someone instead widened the retry to every HARD refusal, it would still move no leg,
because every leg would receive the identical answer one retry later (§2). Only the time to fail would change.

## 8. What the brief got wrong (measured), and the recommendation

- **"So a 'hard' verdict reached under a cut-short search may depend on search order."** A HARD verdict is *not* reached
  under a cut-short search. By definition no pass was cut (`deadline` is absent and no row has `limit: 'budget'`), and
  the work it used (≤ 544) is below the budget. The A1/A3 versus A2 split comes from a different arrival state; in the
  sweep, one tick of arrival clock is enough to flip it. The budget plays no part.
- **"Harvest … the A2 L40 Chest request (see the evidence dir and `replay-seedling-solve-request.mjs`)."** The evidence
  directory holds A2's console line, not its request. The replay script reads the divergence sweep's
  `--capture-requests` output, and nothing on A2's run produced one. I rebuilt the request from survey step 66's boot,
  and the seam-time sweep finds A2's exact refusal (§3.1, §3.3).
- **The survey row behind A2.** The brief quotes the A2 refusal as the survey's step-66 refusal. At base, step 66's
  refusal is its *second* goal (Totem Part 160,640: the ladder is EXHAUSTED on spinner@816,848). From the survey's staged
  boot, the Chest goal is CUT at 640 and the retry solves it.

**Recommendation.** Retry none of the HARD refusals at a larger budget, neither all of them nor only the "search-order"
kind. The cost of retrying all of them would be one more solve per HARD stop that returns the same answer: in units, a
second copy of the HARD search (here a median of 108 and at most 544). In wall time, the extra solve is 0.5 s at the
median. On the spinner@880,848 corner it is about 190 s on this loaded box, because that rung's time is mostly not
metered (§9). The benefit is zero (0/30).

What *does* change A2's answer is **a different arrival**. The two-family HARD pattern in §3.3 sits between CUT arrivals
that the retry solves hitless. But a **short wait does not reach those arrivals.** I measured a wait directly
(`--idle=K`: K empty key sets played at the arrival, then the same ask; `evidence/idle-wait.jsonl`):

| wait before the ask | HARD arrivals asked | still HARD | same refusal (same spinner, landing point, work) as with no wait |
|---|---|---|---|
| 1 tick | 10 | **10** | 10 |
| 2 ticks | 10 | **10** | 10 |
| 4 ticks | 10 | **10** | 10 |
| 8 ticks | 10 | **10** | 10 |

No wait took a hit (0 model hits and 0 deaths in every idle prefix). So the corner does not depend on the clock in
general: standing still for up to 8 ticks keeps it, and only a different arrival clock *at boot* (§3.3) leaves it. The
measurement cannot say what a page-side re-arrival would do: the page's forced re-arrival re-enters from the previous
room with its own walk-in. That is a different experiment, and it needs a whole-game walk, which this brief excluded.

The lever left is the hammer-phase press-kill corner itself, which throws a whole-solve refusal without handing the
goal back to another approach. That is a solver question for a hammer slice, and §9 hands it over.

## 9. Residue / hand-overs

- **The press-kill "no step out" corner (a hand-over to a hammer slice).** It is A2's stop and all 10 sweep HARD rows.
  `apitem (880,816) contact -> kill (spinner@…) by press` refuses the whole goal after `OPP_PRESS_FALLBACK`'s rewind,
  and no other approach to the chest is tried. 78 of 90 neighbouring arrivals solve the same goal hitless through the
  CUT → retry path, so a plan exists near every HARD arrival. The fixtures are `evidence/fixtures-l40-chest-sweep/step-66@-15-goal-0.json`
  (A2's text) and `step-66@-31-goal-0.json` (the spinner@880,848 family). Each reproduces in one process with
  `node scripts/procgen/measure-seedling-hard-refusal-retry.mjs --request=<file>`.

- **Unmetered time in the press-kill corner (a hand-over to the solver / hammer owners).** The spinner@880,848 HARD
  refusals (d = −31, −29, −28, +14, +16, +17) spend **186–207 s of wall time at 112 work units** in node, with 4 jobs on a
  4-CPU box; the 340-unit spinner@816,848 refusals take 21–27 s. The work clock barely advances inside that rung (the
  `HAMMER_PHASE_RUNG` / `OPP_PRESS_FALLBACK` path, *"every key set — the plan's own and 5 alternative(s)"*). So the
  deterministic budget does not bound it, and on a loaded page it comes near `SOLVE_BACKSTOP_MS` (300 s). I did not
  diagnose which loop is unmetered (MEASURE ONLY). The rows are `evidence/sweep66.jsonl` (`at640.ms` against
  `at640.work`), and the fixture is `evidence/fixtures-l40-chest-sweep/step-66@-31-goal-0.json`.
- **Step 228 (L99) refuses differently on the page path.** The survey's two-pass loop reaches the camera-band refusal.
  The page's single-pass `solveAnytime` refuses earlier, at 544 work, on *"the removal of lavarunner@160,32 at tick 137
  (a press kill) OPENS 1 kill lock(s) … the tape DECLARES no clear"*. Both are HARD and both are independent of the
  budget. I note it because a survey row's text is not always the page's.
- **Only the 26 previously REFUSED survey steps were re-derived at base.** I did not re-run the other 224 survey steps
  (SOLVED at `76f15abd88`), so a step that newly refuses at base would be missing from §3.2. A CI survey at
  `d358d50e02` (`seedling-survey.yml`) closes that gap.
- **The idle-wait runs (§8) cover the 10 HARD arrivals at K = 1, 2, 4 and 8 only.** I did not measure longer waits.
- **The A2 request is a reconstruction.** It is the survey's staged L40 boot with a moved arrival clock, not A2's
  captured arrival. It reproduces A2's refusal text, including the landing point. The sweep is the only arrival-dependence
  evidence: other state the page carries (its walk-in prefix, flags earned earlier on the route) is held at the survey's
  staging.
