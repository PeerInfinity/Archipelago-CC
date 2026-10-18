# seedling-dash-cutoff — the leg pre-check's cutoff, re-derived; the dash flip completed (built, measured, NOT landed)

Slice DK of the hammer-phase planner (`seedling-hammer-phase-planning`), cloud, Opus. ⚖ The user (2026-10-17): *"Fix
the skip's cutoff first"*. Re-derive `DASH_LEG_PRECHECK`'s cutoff so it never refuses a corridor that can plan, then
land the three switches together with nothing slower. Evidence: [`seedling-dash-cutoff-evidence/`](./seedling-dash-cutoff-evidence/).
Log: `seedling-bot-log.md` § *Seedling DK — the leg pre-check's cutoff, by the chain*. Nothing went to `main`.

| | |
|---|---|
| Start SHA | DF's head `86b978c574` (branch `claude/seedling-dash-flip-ih4lx5`), merged with `origin/main` `1c0825d5` (fidelity SEALDOOR) → **W0 `0314f824`** |
| Head | the commit carrying this report. Before it: D1 `553b2ada`, D2 `734418fc`, D2 evidence + D4 `ce4e335c` |
| Branch | `claude/seedling-dash-cutoff-bq1l3c` (the harness named it; the brief's `seedling-dash-cutoff`) |
| Verdict | **W0 PASS · D1 PASS (no STOP) · D2 PASS · D3 named (CI below) · D4 PASS** |

## The one thing to know first

**The flip now lands with nothing slower: the new cutoff keeps all of (i)'s pit saving and moves no committed tape.**
- `axe-witness --check` is green at `ae029113` (DF's pre-flip md5), with no re-record. `r9-campaign --check` is green
  at `6b1bf15c`, so the `r9-solve-12` trace no longer moves either.
- The 617 sweep requests: the same 165 shorter, 0 longer.
- DF's 9 heaviest requests: Σ median 20.5 s (K = 40: 20.4 s; without (i): 44.4 s).

**DF's diagnosis was wrong in a useful way.** Windows do not compound on the way in. `evaluateAt` certifies a candidate
only when *its own* walk's longest leg is ≤ 195, and the first candidate accepted carries no other window. So a
corridor plans only if ONE window brings every leg under the bound.
- On the axe corridor that window is `[0,2]` at walk-offset 100, and it alone takes the leg from 305 to 184.
- The leg is 305 ticks long, but not because of ground. It is a 192 px climb walked in 154 ticks, followed by about
  150 ticks of the walk **dithering at its waypoint**: `hasArrived` needs a full stop inside the tolerance. The dash
  knocks the dither out.
- The new rule follows from that. It refuses only a **clean run** (straight, no standing) whose ticks, less what one
  window's ground can save at the leg's own rate, are still past 195.

## W0 — the base (PASS)

| row | result |
|---|---|
| checkout | `git reset --hard origin/claude/seedling-dash-flip-ih4lx5` (`86b978c5`), `git merge origin/main` (9 commits; `1c0825d5`). Conflicts: README, `procgenDocs/generated/docsIndex.js` (regenerated), `seedling-bot-log.md` (a union: SEALDOOR's section, then DF's). Merge `0314f824` |
| bootstrap | `session_bootstrap.sh --seedling` → `READY`, node v22.22.0. Six submodules `-` after READY, each `git submodule update --init`. Server `serve-nocache.py 9593`, PID 1212 |
| defaults | DF's flip, as built: `DASH_LEG_PRECHECK` ON (K = 40), `DASH_KEEP_PARTIAL` ON, `DASH_ONLY_WINDOW` ON, `DASH_NO_SWING_PREFIX` OFF |
| identity block | equal to DF's flip row for row (maze `57e07d21` … levels `e28c1e5d / fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH). Five `--check`s exit 0. **`r9-campaign --check` `e900dde2` exit 1**, as DF (`evidence/w0/identity.txt`) |
| 62 producers | 61 + `plan-seedling-sealdoor-witness` (new from main). In a frozen copy of W0: **60 green**; **`axe-witness` `59ae80f2` exit 1** (= DF's flip md5); `r7-ends-meet` needs `git` and was run in a git worktree of `0314f824`: clean, `f1675cfc` (`evidence/w0/plans-frozen.txt`, `r7-worktree.txt`) |
| battery | the D1 rows below reproduce DF exactly: today 110,216 t / 34,936 u; window 0 87,704 t / 77,780 u; the flip without (i) 94,359 t / 51,709 u; **ON as built (K = 40) 94,359 t / 50,094 u** |

⚠ The first W0 producer run read the live tree while I edited `solverBot.js`. Its rows after the edit are contaminated
(`axe-witness` read green). That run is kept as `plans-contaminated.txt` and was replaced by the frozen-copy run above.

## D1 — what bounds a leg's chain saving (PASS, no STOP)

**Instrument** (`evidence/tools/`, scratch lab only, never committed). Each `planSwordDash` call records:
- the undashed legs and per-leg geometry;
- every candidate's legs, longest leg and verdict;
- the windows accepted, the final legs, and whether it planned.

**Population.**
- **Battery:** the 617 requests of sweep `38845773709` (re-downloaded), at window 0 (pre-check OFF) and at the flip's
  85 (pre-check OFF), 1,267 corridors.
- **In place:** all 62 producers plus the six solve producers, pre-check OFF: 223 corridors in 32 producers
  (`axe-l48-reach-l49` included).

**The chain, measured on the axe corridor** (`evidence/d1/axe-chain.txt`):
- Its legs are `[26,20,56,17,30,305,39]`. With the pre-check OFF it plans 8 windows, 493 → 275 t, final legs
  `[…,116,23]`.
- The first certified candidate is `[0,2]` at 100, with legs `[26,20,56,12,30,184,39]`. Earlier candidates bring the
  leg to 158–177 too, but fail `danger`.
- Leg 5 is 192 px straight up. The player reaches y = 56 after **154** ticks, then spends 151 ticks inside 54–58
  without ever stopping (path 304.8 px over a 192.4 px line).

**Candidates.** Each is judged on: refusing 0 corridors that planned; units and wall saved on the 617; pit timing.

| rule | corridors refused (battery + producers) | of which PLANNED | units saved, the 617 at 85 (vs no (i): 51,709) | L40 pits (DF's 9 heaviest) |
|---|---|---|---|---|
| K = 40 (DF, as built) | 46 | **1: `axe-l48-reach-l49`** | 1,615 | Σ median 20.4 s |
| **(a)** physics bound on ground (`span − reach` at the steady stride 1.2001) | 39 | 0 *on this population*, but not a bound (below) | — | refuses them |
| **(a′)** physics bound at the per-axis cap 1.6 (sound) | 17 | 0 | (not built) | **refuses none** (their leg is 303 px): 0 % |
| **(b)** K = 110 (the smallest K keeping the axe's 305) | 23 | 0 | **850** (`f85k110`) | **refuses none** (261 t): 0 % |
| **(c)** a clean run's floor (built) | 34 | **0** | **680** (`f85dk`) | **Σ median 20.5 s: all of it** |

(Offline columns from `evidence/d1/rules-offline.txt`; the units are measured batteries, `battery-table.txt`.)

**(a), derived from the physics** (`evidence/d1/physics.txt`). I stepped `applyFriction` and `applyInput` (the
threshold add), with the dash impulse `SLASH_DASH_FORCE` along the velocity, at every `MOVE_SPEEDS` entry, axis and
diagonal. For the dash window I used every prefix of both weapons' chains, at every phase of a swing period.
- **The steady stride per axis is 1.2001 px/t** (a diagonal walk on ground). **One window adds at most 48.8 px** of
  ground to the same walk (the full sword chain on a ground axis, 27 ticks after the swing; stable at every horizon).
  Against the stride, the most any start under the cap runs ahead is 48.15 px.
- **It is not a bound on a real walk.** The axe climb's own *undashed* walk averages **1.248 px/t** on one axis, past
  1.2001. The steering toggles its perpendicular keys, and vector friction then bleeds less off the main axis. The only
  sound stride is the per-axis velocity cap, 2·`WALK_SPEED` = 1.6.
- **At 1.6 the bound refuses only legs ≥ ~360 px.** It refuses no L40 pit, so the pit saving is lost. Ice
  (`SLIDING_FRICTION` 0.025) carries one window **816 px**, so ice rooms are unbounded under any rule.

**(b) K = 110** is a population number with the same flaw as K = 40: it is the axe's 305 minus 195. It refuses the
waterfall-room corridors (358–392 t), which have long legs. It keeps the L40 pits, whose legs are only 261 t.

**(c) What distinguishes the axe corridor from the never-planning long corridors** is whether the leg's ticks were
travel.
- **Never-planning long corridors:** every one is a straight, unbroken run. The L40 pit's leg 1 is 261 t over 303.3 px,
  path = line, 1 still tick. The L95 legs are 384 t over 452 px, path/line 1.03.
- **The axe leg** is a 192 px climb plus a dither: path/line 1.58, 4 still ticks.
- **Rule.** On a clean run the walk already travels at its own rate `v = span / n`, and a dashed walk steers by the same
  keys over the same tiles. One window can therefore save at most 48.8 / v ticks there, so `floor = ceil(n − 48.8 / v)`.
  The L40 pit's floor is **220**.
- **Tight.** With no budget, the pit scans 2,960 candidates. The best gets that leg to **221**.

**With no budget, none of the refused corridors can plan** (`evidence/d1/nobudget.txt`). Every corridor K = 40 refuses
among the 617 (19 corridors in L40, L52 and L95) was re-solved at window 0, pre-check OFF, `budgetWork: null`.
- Each previewed to exhaustion: 1,524–3,980 candidates, 7–500 s per solve.
- Each certified **0**.
- So every refusal any of these rules makes on the population is a true refusal. The axe is the only corridor past the
  margin that plans.

**Turns, bodies, start offset** (the brief's other structural suggestions) were not measured as rules. Path/line plus
still ticks already separate the axe from every long corridor that never plans, and the floor says why.

## D2 — the floor, built and measured in place (PASS)

### The rule (`solverBot.js`)
- **The switch.** `DASH_LEG_PRECHECK` keeps its name and stays ON. `DASH_LEG_PRECHECK_MARGIN` is removed: its only
  readers were the pre-check and its test.
- **`dashLegPrecheck(run, walk)`** reads the UNDASHED walk `planSwordDash` already previewed, so it costs no preview
  and no deadline ask.
- **The legs.** `dashLegRuns(samples, from)` gives each leg's `n`, `span` (Chebyshev, from where the previous leg ended),
  `path`, `line` and `still`.
- **The floor.** `dashLegFloor(leg)` is `null` unless the leg is a clean run (`path ≤ 1.05·line`, `still ≤ 2`).
  Otherwise it is `ceil(n − dashLegGain() / (span / n))`.
- **The refusal.** A corridor is refused when some leg has `n > 195` and a floor past 195.
- **The gain.** `dashLegGain()` derives 48.8 px once, in 51 ms, memoised.
- **Exemptions** (never refused):
  - a room with ice (`strikeTerrainOf`, the read `strikeEtaFloorOf` makes);
  - a room with a waterfall: its push adds to `v.y` past any cap, so the walk's own rate does not bound a dashed walk;
  - a crossed walk's last leg: it ends where the walk met the transition, which a dashed walk can meet elsewhere.
- **The docblock** gives the derivation, the one-window argument, the axe counter-example, and why a physics-only
  stride fails.
- **The `why`:** *"DASH_LEG_PRECHECK: the UNDASHED walk's leg 1 is a clean run of 261 tick(s) over 303.3 px; one dash
  window adds at most 48.8 px, so it walks that leg in no fewer than 220 tick(s), past PREVIEW_AGREEMENT_BOUND 195. …"*
- **Imports.** `MOVE_SPEEDS` and `SLASH_DASH_FORCE` now come in through `solverView.js`. The surface census was
  re-written: counts only, no new rows (GREEN 312).
- ⚠ **I built and then reverted a leg-local waterfall test**: a tile within the gain of the leg's box. It recovered
  nothing on the 617, because L95's long legs run within reach of its waterfall, and the in-place battery had measured
  the room-wide rule.

### The gate rows (`hammerDashShape.test.js`, 21 rows, ~60 s)
- **The gain, the floor and the clean-run test:**
  - `dashLegGain()` = 48.8;
  - the L40 pit leg's floor is 220;
  - `still` 3 → `null`; `path` 1.051 × line → `null`; `path` 1.05 × line → 220;
  - OFF → `null`.
- **The boundary on a real corridor.** New fixture `fixtures/dash-shape/sweep-392-l40.json`: sweep `38845773709`'s
  request 392:0, its staging plus the records of L40 and L43 (58 KB).
  - With waypoints (488,680) → (217,680), leg 1 is a clean run of **237 t over 271.5 px, floor 195**. ON it scans
    exactly as OFF.
  - With (214,680), leg 1 is **238 t over 274.9 px, floor 196**. ON refuses with `scanned 0`, the named `why`, and one
    deadline ask.
- **392:0 solved whole:** ON and OFF ship the same 828-tick solution. ON's work is lower; OFF's full pass is cut by the
  budget at `sword-dash`.
- **The D2 counter-example.** The axe corridor's legs measure `[26,20,56,17,30,305,39]`, with leg 5's line 192.4 px,
  path past 1.05 × line, and floor `null`.
  - ON, `planSwordDash` scans exactly as OFF.
  - **ON, `axePlan` plans `axe-l48-reach-l49` at 368 t with 8 windows.**
- **A waterfall room refuses nothing:** DB's L52 corridor, a clean run of 289 t (floor 196), scans ON as OFF.
- `dashShape.test.js` (DF's re-pins): the `legPrecheck` witness moves from 478:0 (a waterfall room, which the rule
  exempts) to 392:0, both in process and through a real worker. 14 / 14.

**Mutants (`evidence/d2/mutants.txt`): 3 applied, 3 caught.**

| mutant | caught by |
|---|---|
| the old K = 40 (`longest > 235`) | 4 rows: the floor-195 corridor, **both axe rows**, the waterfall row |
| the bound off by one (`floor < 195` refuses) | the floor-195 corridor |
| the bound reading the DASHED walk (a per-candidate refusal) | the floor-196 corridor (`scanned` > 0), and 392:0 whole (the work) |

### In place, at the flipped defaults (frozen D2 snapshot, `evidence/d2/`)

| row | W0 (K = 40) → DK | re-recorded? |
|---|---|---|
| identity block | equal row for row, except **`r9-campaign --check` `e900dde2` exit 1 → `6b1bf15c` exit 0** (DF's pre-flip md5) | no |
| `plan-seedling-axe-witness` | `59ae80f2` exit 1 → **`ae029113` exit 0**, "all checks green": `axe-l48-reach-l49` is the committed 368 t again | **no** (⛔ nor needed) |
| `plan-seedling-l40button-witness` | md5 moves, exit 0 both: only its printed wall seconds (16 → 15 s, 13 → 14 s) | n/a |
| `plan-seedling-r7-ends-meet` | `f1675cfc` → `f1675cfc` (primary tree at `734418fc`; it needs `git`) | — |
| the other 59 producers, five `--check`s, censuses, generated set | equal (generated set re-measured in the primary tree on port 9593: OK) | — |

**⚖ 40: no fixture moved, so nothing was re-recorded.** The brief allowed a text-only re-record of `r9-solve-12`. It
isn't needed: the trace is back to its pre-flip bytes.

### The battery at the new rule (`evidence/d1/battery-table.txt`; the 617 at window 85, lab2 = the D2 code plus the passive instrument)

| row | ticks | better / **worse** vs today | units |
|---|---|---|---|
| today (all OFF) | 110,216 | — | 34,936 |
| the flip without (i) | 94,359 | 165 / 0 | 51,709 |
| the flip, K = 40 (DF) | 94,359 | 165 / 0 | 50,094 |
| **the flip, DK's floor** | **94,359** | **165 / 0** (the same 165 keys: tick-identical to K = 40 on all 617) | **51,029** |
| the flip, K = 110 | 94,359 | 165 / 0 | 50,859 |

- **Units.** The floor saves 680 of K = 40's 1,615.
- **The 935 between them** are 11 corridors in waterfall rooms: 478, 486 and 488 in L52; 725, 726, 729, 730, 735, 736,
  739 and 740 in L95. With no budget they certify nothing.

### Timings (`evidence/d2/timing.txt`)
3 interleaved rounds, jobs 1, window 85, load 1.48–3.03 (median 1.97), DF's 9 heaviest. Configurations:
- **OFF:** stamped all-OFF, on the DK tree;
- **K = 40:** the W0 tree;
- **DK:** the D2 tree;
- **without (i):** stamped, on the DK tree.

Ticks and units were identical across rounds, and DK's equal K = 40's on every key. Each cell is median / min.

| key | OFF (today) | ON, K = 40 | **ON, DK's floor** | ON without (i) |
|---|---|---|---|---|
| 108:0 | 561 t, 87 u, 0.81 / 0.79 s | 328 t, 151 u, 1.23 / 1.13 s | 328 t, 151 u, 1.23 / 1.12 s | 328 t, 151 u, 1.13 / 1.11 s |
| 298:0 | 295 t, 87 u, 0.45 / 0.44 s | 143 t, 108 u, 0.55 / 0.53 s | 143 t, 108 u, 0.55 / 0.53 s | 143 t, 108 u, 0.58 / 0.56 s |
| 384:0 | 861 t, 87 u, 2.55 / 2.10 s | 861 t, 105 u, 2.15 / 1.94 s | 861 t, 105 u, 2.31 / 1.93 s | 861 t, 190 u, 5.61 / 5.19 s |
| 385:0 | 913 t, 86 u, 1.98 / 1.88 s | 913 t, 157 u, 3.03 / 2.61 s | 913 t, 157 u, 2.91 / 2.61 s | 913 t, 242 u, 6.19 / 5.59 s |
| 386:0 | 1025 t, 88 u, 2.21 / 1.69 s | 1025 t, 175 u, 3.17 / 2.99 s | 1025 t, 175 u, 3.37 / 3.25 s | 1025 t, 260 u, 7.53 / 7.03 s |
| 387:0 | 1087 t, 91 u, 1.85 / 1.83 s | 1087 t, 181 u, 3.59 / 3.41 s | 1087 t, 181 u, 3.43 / 3.35 s | 1087 t, 266 u, 8.34 / 7.91 s |
| 388:0 | 844 t, 87 u, 2.44 / 1.97 s | 844 t, 103 u, 2.40 / 1.88 s | 844 t, 103 u, 2.40 / 1.76 s | 844 t, 188 u, 4.61 / 4.61 s |
| 392:0 | 828 t, 87 u, 2.59 / 2.00 s | 828 t, 101 u, 2.06 / 1.94 s | 828 t, 101 u, 1.95 / 1.72 s | 828 t, 186 u, 5.30 / 4.76 s |
| 394:0 | 809 t, 87 u, 2.54 / 2.10 s | 809 t, 99 u, 2.24 / 2.08 s | 809 t, 99 u, 2.31 / 2.10 s | 809 t, 184 u, 5.09 / 4.15 s |
| **Σ median / min** | **17.4 / 14.8 s** | **20.4 / 18.5 s** | **20.5 / 18.4 s** | **44.4 / 40.9 s** |

## D3 — the gates (named; cloud dispatch returns 403)

js-6's flip gate, for the planner to dispatch:
1. **The 843-leg A/B.**
   - Run `seedling-divergence-sweep.yml` on `claude/seedling-dash-cutoff-bq1l3c` with `capture_requests=true` and
     `shards=10`.
   - Compare by key against a `main` run of the same inputs (e.g. `38845773709`'s inputs re-run on current main).
   - Expected movers: DF's 165 keys (`seedling-dash-flip-evidence/d1/battery.txt`), all shorter. DK ships the same
     ticks as K = 40 on all 617 replayed requests.
2. **The full `plan-seedling-*.mjs --check` set:** green at the D2 head. That is all 62 (sealdoor included), plus the
   six solve producers' `--check` in the identity block.
3. **`test-substrates-manual.yml` with `batch=feature-checks`.** The `seedling-dash-window` check is DF's and is
   unchanged by DK: its witness, leg 108, is tick- and unit-identical under K = 40 and DK.
4. **CI unit tests at the head:** `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`. See *CI* under D4.

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling DK — the leg pre-check's cutoff, by the chain` (D1, D2, two lessons) |
| as-built | `seedling-bot.md`'s DB/DF paragraph: (1) is now the floor; the ⚠ axe text is now "at DK's floor nothing moves in place", with DK's battery numbers; the gate line names both fixtures. `flash.md` *Dash-shape switches*: the `legPrecheck` witness is 392:0 |
| surface / constants / entities / profile | surface `--write` then GREEN **312**; constants PASS **6,001** (6,000 at DF; main's SEALDOOR merge, not this slice: `--check` green, 0 drift); entities PASS 566; profile PASS 138 |
| reference | `generate-procgen-reference.mjs`, then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs, byte-unchanged |
| bounded vitest AFTER | DF's AFTER set (41 files) plus `fidelityLapseCost`; `tapeIndexManifest` and `lintGateLabels` are in DF's set. **42 files, 2198 / 2199**. The one red was `procgenDocs/generated.test.js`'s `--check` row, run before the reference was regenerated; after regenerating it is 55 / 55. `jsRuntimeSolverCalibration.slow`: **5 / 5** |
| not run | pytest, unfiltered local vitest (⚖ 52), `standing-values --write`, any re-record, any dispatch |

**CI unit tests** (`ci-vitest-summary.mjs`): at `ce4e335c` (D2 + D4; this report adds only itself), run `39002992779` **success**: unfiltered vitest **20,690 / 20,690** passed, 0 skipped, 0 failed; slow battery **253 / 253**.

## The table for the user

| | today (main) | **the flip with DK's floor** (i)+(iii)+window | (DF's flip, K = 40, for reference) |
|---|---|---|---|
| play time, the 617 sweep requests | 110,216 t | **94,359 t** (−15,857; 165 shorter, 0 longer) | 94,359 t (identical on every key) |
| e.g. leg 108 (L12) / 298 (L26) | 561 / 295 t | 328 / 143 t | 328 / 143 t |
| play time, committed tapes in place | — | **nothing moves**: `axe-witness` and `r9-campaign` green, no re-record | `axe-l48-reach-l49` 368 → 585 t; `r9-solve-12` trace moves |
| solve work, the 617 | 34,936 u | 51,029 u (+46 %) | 50,094 u (+43 %) |
| solve time, the heaviest 9 (Σ median) | 17.4 s | **20.5 s** (+18 %) | 20.4 s (+17 %). Without (i): 44.4 s (+155 %) |
| ⚖ rulings touched | — | partly reverses WINDOW WHOLE PASS (chosen at DF) | the same |

The flip is ready for js-6's gate (D3). Nothing in it needs the user's licence for a slower tape.

## What the brief got wrong (measured)

1. *"windows compound on one leg"* (DF's reading, quoted in the brief). They do not, on the way in. A candidate
   certifies only with its own longest leg ≤ 195, and the first one accepted carries no other window. So ONE window
   must bring the leg under. On the axe corridor, `[0,2]` at 100 takes 305 → 184 alone. The other seven windows
   only shorten a walk that already certified.
2. *"re-derive the cutoff from the whole dash CHAIN's saving per leg … Derive that maximum from the dash's physics
   (the swing rate and the impulse)"*. The impulse and the swing rate bound the *ground* a window adds: 48.8 px. They
   do not bound the *ticks* a window saves on a leg, because a leg can hold ticks that are not travel. The axe leg has
   ~150 ticks of dither, and the dash removes them whole. A rule needs both halves: the physics for the ground, and
   the walk's shape (a clean run) for which ticks were travel.
3. *A physics-only stride.* The fixed-key limit cycle (1.2001 px/t per axis) is beaten by the solver's own undashed
   walk: 1.248 px/t on the axe climb. Only the 1.6 cap is sound, and it refuses no pit. That is (a′).
4. *"axe-witness must be green with NO re-record" and "r9-solve-12 … if (i) still moves it, list it as a re-record"*:
   both are green and nothing moves, so no re-record is needed.
5. *"the 61 producers"*: 62 at this base. Main added `plan-seedling-sealdoor-witness`, which has a `--check` and is
   green.
6. *"DB's / DF's runner" re-used on the sweep*: the captures had to be re-downloaded (`gh run download`; DF's
   `/tmp/claude-0/caps` did not survive the container).

## Residue

1. **The 935 units in waterfall rooms.** The floor exempts any room with a waterfall, and 11 never-planning corridors in
   L52 and L95 sit there. Two ways to recover them:
   - a leg-local test (built and reverted: it recovers nothing on L95, whose long legs pass within a window's reach of
     its waterfall);
   - a waterfall-aware gain (the push stepped into `dashLegGain`'s walk).
   Neither is needed for the pits.
2. **The crossed-last-leg exemption** keeps 736:0 and 740:0 (L95) and the L52 corridors scanned. All of them also sit
   in waterfall rooms.
3. **Not modelled:** a contact knockback the player takes inside a certified corridor. Measured: no corridor that
   planned is refused, over the 617 and every committed producer.
4. **The dispatches in D3** are js-6's to run.
5. **Stale "OFF" text outside the grant** (DF's residue 2, unchanged): `seedlingDashOnlyWindowSettings.js:30`,
   `seedlingDashShapeSettings.js:10, 49`, `dashShapeHook.js:37`, `seedling-divergence-sweep.yml:106, 114`.
6. **The tutorials planner** still needs DF's feature-check note relayed. DK does not change the check.
7. **Walls are one box's.** The batteries ran at load 4–13, the timing at 1.5–3.0. Units and ticks are the measure.
8. **Tree hygiene.** These scratch copies were removed by name: the lab trees `lab`, `lab2`, `w0lab` and `d2lab`, and
   the worktree `w0wt`. Two `/tmp/seedling-driver-*` dirs left by a port-less generated-set run were removed. The
   servers (PIDs 1212, 16644, 17157 and 23656) were killed by PID. The captures stay in `/tmp/claude-0/caps`, outside
   the tree.
