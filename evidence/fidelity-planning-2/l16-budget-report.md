# Seedling JS → wasm solver: the 5 s budget on L16's exit — MEASURED (slice `seedling-js-l16-budget`, 2026-10-04)

Opus slice, measure-first. Tree: worktree `Archipelago-CC-wt-seedling-js-l16-budget`, branch `seedling-js-l16-budget`,
fast-forwarded mid-slice from `ad5dd608e0` to main **`9a35ad8989`** (the rules arc's recompile landed: `seedling_playthrough`
atlas `seedling-bbddca3d`, `exporter["1"].assume_bidirectional_exits: false`). **Every live number below is on `9a35ad8989`**
except D (L14 on the door-only route), which was captured on `ad5dd608e0` (D cannot run on the new main, see §6).
No solver, model, AS3, wasm, gitlink or tree change. **Nothing committed: every script is scratch**, kept with its data in
`NewDocs/plans/seedling-js-j0-evidence/l16-budget/` (so no `check-procgen-help` / boxLock-list debt).

## 0. Verdict

- **L16 is not a load fluke.** The exact live arrival is captured and re-solved in node with no budget. It **finishes**:
  **10.6–17.8 s** (load 3–7), plan **111 ticks, `pull` + `walk`, ONE sword dash saving 8 ticks**, ends in L17, 0 deaths.
  5 s never had a chance, on any box.
- **Where the time goes (L16):** ~62 % **sword-dash planning** (`planSwordDash` previews on the walk to the PULL rung's rope
  stance) and ~30 % (dashless: ~80 %) an **eagerly computed stance hypothesis** (`deriveSwingStance → stanceHypothesis →
  deriveWeigh → deriveBlockRoute`), which the plan never uses (its verbs are `pull, walk`).
- **The user's idea works, and it is buildable on OUR side with no solver change.** `solveSegment` already takes
  `dashMode: 'none' | 'full' | 'all'` (R9 12i). Dashless, every one of the 19 captured live arrivals that solve does so in **≤ 1.4 s**
  except L16 (**4.6–5.9 s**, plan 206 ticks). With the fidelity arc's one-line fix below (a LAZY hypothesis, measured
  byte-identical on 36 runs), L16 dashless is **1.1 s**.
- **Dash is the expensive optional strategy, and it is mostly wasted.** Across 24 solved full-search plans, **9 use a dash at
  all**, saving **8–95 ticks** (≤ 1.6 s of game time at `GAME_FPS` 60) per leg. It costs up to **12 s** (L16) and
  **68 s** (L71 chest, kit), and on L71 and B's L14 the plan uses **zero** dashes after 86–99 % of the solve was dash planning.
- **L14:** two different things. On the playthrough route (B, with the Sword) the full search takes **3.3–5.7 s**: a
  budget coin flip on this box (dash planning 86 %, plan uses no dash). On the door-only route (D, no Sword) the solver
  **declines** (combat ladder exhausted, chaser bob), but the decline itself takes **4.9–8.2 s** (89 % in the KILL rung's
  `deriveKillByChaser` scan). It races the budget. When the decline wins you see the §5.16 refusal; when the budget wins you
  see "exceeded 5 s on exit in level 14".

## 1. The L16 / L14 diagnosis

### 1.1 How the arrival state was captured (the live one, not an approximation)

A naive node reconstruction (`createJsRuntime` + `new Game(16, 32, 64)` + Sword) **refuses L16 in 0.5–0.8 s** (combat ladder
exhausted at bob@48,96). The live walk instead searched past 5 s. The arrival state matters: rng and seam are read off the
game. So the state was captured LIVE:

- `capture2.mjs` is a scratch copy of `probe-seedling-wasm-logical-links.mjs` B. It differs in three ways. It polls the
  wasm engine's `arrivalReads` (`{seam, status, state}` per arrival, the engine's own WG fixture accessor) and
  `room`/`status`/`history` every 500 ms. It writes `capture-main.json`. It loads the committed sphere log
  (`AP_14089154938208861744_sphere_log.jsonl`), because `generateSphereLog` throws on the new rules (§6).
- `replay.mjs` rebuilds the staging exactly as the engine does: `stagingFromWasmArrival` → `arrivalSolverGoal` →
  `createRunForStaging(…, {scratchPersistence: true})` → `solveSegment` with no budget. It reports ms, ticks, verbs, dash
  rows and a plan hash.
- All node timing ran serially under the box lock (`sweep.mjs`, kind `measure`), and the load average is recorded per row.

**The live walk on `9a35ad8989` (p4e, headless, :8162):** 21 legs, 220 s, `Level 010 - Sword` and `Level 011 - Chest`
checked, 1 logical move, 0 divergences. Then: *"the solver exceeded 5 s on exit in level 16 (terminated)"*. This is
§5.17's refusal, reproduced on the new main.

### 1.2 L16 (`level_16 -> level_17`, the stairs at (112,64); arrival (32,64), Sword)

| run | solve | plan |
|---|---|---|
| live wasm, 5 s budget | terminated at 5 s | — (walk FAILS: on wasm an expiry is terminal, §4) |
| node, no budget, dash `all` (5 runs, load 3–11) | **10.6, 15.3*, 16.9, 17.8 s** (*with `--cpu-prof`) | 111 t, `pull,walk`, 1 dash (saves 8 t), → L17, 0 deaths |
| node, dash `none` | **4.6, 5.9, 5.9 s** | 206 t, `pull,walk`, → L17, 0 deaths |
| node, dash `all` + LAZY hypothesis | 7.8 s | **identical hash** to dash `all` |
| node, dash `none` + LAZY hypothesis | **1.1 s** | **identical hash** to dash `none` |

So **the full search does finish**, at 2–3.5× the budget. Dashless alone does NOT fit 5 s (4.6–5.9 s, and on a loaded box
worse). Dashless with the lazy hypothesis fits with 4.5× headroom.

### 1.3 L14

| leg | mode | solve (runs) | outcome |
|---|---|---|---|
| B: `level_14 -> level_15__r1c5`, arrival (160,64), Sword | `all` | **3.3, 3.8, 5.7 s** | 118 t `walk`, **0 dashes** |
| | `none` | 0.4, 0.5, 0.9 s | 145 t `walk` |
| D: same exit, door-only route, NO Sword (old base `ad5dd608e0`) | `all` | **4.9–8.2 s** | DECLINE (combat ladder exhausted, chaser bob@128,64) |
| | `none` | 4.9–7.5 s | same DECLINE |

The live D run on `ad5dd608e0` declined in time (the §5.16 text). On a busier box the same leg reads as "exceeded 5 s".
The brief's L14 budget refusal is either leg, depending on load. B's L14 is the one a dash-free first pass rescues outright.

### 1.4 Is the 5 s wall clock on THIS box vs CI?

- **It is wall clock** (`performance.now` in the page; the engine's `pollSolve` measures from the worker's `started`).
  The same L16 solve spans **10.6 → 17.8 s across load 3 → 7**, a 1.7× spread. B's L14 spans 3.3 → 5.7 s, straddling the cap.
- **CI never runs a wasm walk** (no WebGPU adapter in the in-app Chromium, WG). The JS page's in-app rows run with 30–60 s
  budgets. So the 5 s cap is exercised ONLY on local live boxes, under whatever load the other sessions make.
- **⚠ The wasm engine has no budget knob.** `createWasmPlayback` defaults `budgetMs = SOLVER_BUDGET_MS`, and
  `defaultLoadWasmEngine` passes none. The JS page's `?solverBudgetMs=` / `setSolverBudgetMs` has no wasm twin.

## 2. The strategy profile

Method: `node --cpu-prof` on the replayed solve. A sample counts once per category it has on its stack (inclusive, so rows
overlap). Categories are by function name (`cat.py`), and `path.py` gives the dominant caller chain. Shares are of
`solveSegment`'s own time.

| leg (mode) | solve | dash planning | stance hypothesis / block-route | ladder rungs (total) | of which | plan uses |
|---|---|---|---|---|---|---|
| L16 (`all`) | 15.0 s | **61.8 %** (`planSwordDash` → `previewFor`/`evaluateAt`) | 29.6 % (`deriveSwingStance → stanceHypothesis → deriveWeigh → orRoute → deriveBlockRoute`) | 95.5 % | PULL rung (the rope's swing stance + the walk to it) | pull, walk, 1 dash (−8 t) |
| L16 (`none`) | 6.5 s | — | **79.0 %** (same chain, 5.1 s) | 90.9 % | PULL rung | pull, walk |
| B L14 (`all`) | 3.2 s | **86.2 %** | — | 5.7 % | — | walk, **0 dashes** |
| L71 chest, kit (`all`) | 66.8 s | **98.7 %** | — | — | — | chest, walk, **0 dashes** |
| D L14 bare (`none`) | 5.4 s | — | — | 97.9 % | **KILL rung `deriveKillByChaser` 89 %** (`scanAround`), then refuses; bait 6 % | DECLINE |
| S4 census L16 pit (13,4), kit | 40 s (prof) / 14–15 s | — | **99.3 %** `deriveShove → deriveBlockRoute` (hits `MAX_ROUTE_EXPANSIONS`) | — | — | REFUSAL |

Read: the budget-eaters are
1. **sword-dash planning** (an optional speed-up: every plan is valid without it),
2. **the stance hypothesis** (an optional "assume another obstacle is discharged" fallback, computed EAGERLY),
3. **block-route search** on refusals (shove / weigh),
4. **the KILL rung's chaser scan** on refusals.

None of the four is in L16's plan except the single 8-tick dash.

## 3. The user's idea, quantified (no solver change: `dashMode` is an existing `solveSegment` parameter)

Rows: every live arrival of the B walk on `9a35ad8989` (reads 9/10 are apitem location goals the replay's vanilla records
cannot map, so they are not re-solved), D's arrivals (`ad5dd608e0`), and S4's census legs that hit the budget
(`leg.mjs`, a fresh JS boot, kit). Times are ranges over 2–3 runs at load 3–7. **Fits = within 5 s.**

| leg | full search (`all`) | plan | dashless (`none`) | plan | full fits | dashless-first fits |
|---|---|---|---|---|---|---|
| B L0 r1c6 → L2 | 0.24–0.40 s | 119 t walk | 0.23–0.39 s | same | ✓ | ✓ |
| B L2 → L3 | 0.09–0.14 | 47 t walk | 0.08–0.17 | same | ✓ | ✓ |
| B L3 → L4 | 0.28–0.34 | 245 t walk | 0.26–0.32 | same | ✓ | ✓ |
| B L4 → L5 | 0.38–0.41 | 255 t hold,shove | 0.33–0.39 | same | ✓ | ✓ |
| B L5 → L6 | 0.48–0.86 | 403 t kill | 0.49–0.60 | same | ✓ | ✓ |
| B L6 → L7 | 0.66–0.79 | 294 t bait | 0.65–0.86 | same | ✓ | ✓ |
| B L7 → L8 | 0.16–0.19 | 146 t walk | 0.18–0.24 | same | ✓ | ✓ |
| B L8 → L9 | 1.13–1.37 | 827 t kill,shove | 1.12–1.36 | same | ✓ | ✓ |
| B L9 → L10 | 0.14–0.16 | 122 t walk | 0.13–0.18 | same | ✓ | ✓ |
| B L3 r0c4 → L2 | 0.91–1.66 | 152 t break, **1 dash** | 0.23–0.44 | 226 t | ✓ | ✓ |
| B L2 → L0 | 0.19–0.41 | 23 t, **1 dash** | 0.10–0.13 | 47 t | ✓ | ✓ |
| B L0 → L13 | 1.72–2.28 | 145 t, **1 dash** | 0.60–0.87 | 237 t | ✓ | ✓ |
| B L13 → L14 | 0.24–0.28 | 36 t, **1 dash** | 0.12–0.49 | 74 t | ✓ | ✓ |
| **B L14 → L15** | **3.3–5.7** | 118 t, 0 dashes | 0.44–0.90 | 145 t | **✗ (coin flip)** | ✓ |
| B L15 → L16 | 1.13–1.78 | 456 t shove,weigh, **5 dashes** | 0.79–1.03 | 509 t | ✓ | ✓ |
| **B L16 → L17** | **10.6–17.8** | 111 t pull, **1 dash** | **4.6–5.9** | 206 t | **✗** | **✗ (✓ with the lazy hypothesis: 1.1 s)** |
| D L0 → L86 | 0.62–1.33 | 314 t | 0.64–0.86 | same | ✓ | ✓ |
| D L0 → L13 | 0.51–0.73 | 305 t | 0.52–0.91 | same | ✓ | ✓ |
| D L13 → L14 | 0.13–0.15 | 74 t | 0.13–0.19 | same | ✓ | ✓ |
| **D L14 → L15 (bare)** | **4.9–8.2 DECLINE** | — | **4.9–7.5 DECLINE** | — | race | race (the KILL scan, not dash) |
| S4 L11 chest, kit | 1.56 | 160 t, 1 dash | 0.13 | 180 t | ✓ | ✓ |
| S4 L15 chest, kit | 1.89 | 167 t, 1 dash | 0.31 | 211 t | ✓ | ✓ |
| S4 L16 stairs, full kit | 5.03 | 91 t, 1 dash | 3.12 | 125 t | ✗ | ✓ |
| **S4 L71 chest, kit** | **68.7** | 527 t, **0 dashes** | **0.72** | same 527 t | **✗** | ✓ |
| S4 L71 chest, bare | 1.60 | 552 t | 1.21 | same | ✓ | ✓ |
| S4 L16 pit (13,4), bare / kit | 2.7–2.9 / 14–15 REFUSAL | — | same | — | refusal / ✗ | refusal / ✗ (block-route) |
| S4 L110 pit, kit | 1.4 REFUSAL (PhysicsV2Error) | — | 0.2 same | — | — | — |

**Totals.**
- Of the 24 legs that solve (19 live captures + 5 census): **20 / 24 fit 5 s with the full search; 23 / 24 with a dashless pass**. L16 is the one left.
  It fits only with the hypothesis fix (fidelity).
- **Dash in the plan: 9 / 24** legs, each saving 8–95 ticks. On the 7 B legs whose dashless plan is longer (6 with a dash,
  plus L14, where the mode changes the walk's strike policy without dashing), dashless plans are **+403 ticks** in total (≈ 6.7 s of game time over a 220 s walk).
- Wall time saved by dashless on those same legs: L16 alone saves 6–12 s, L71 68 s, B L14 3–5 s.
- **An anytime "dashless first, upgrade if time remains" would have played EVERY solvable leg here except L16 within 5 s.
  On L16 it also needs the lazy hypothesis.** Where the full search finishes in time, its dash plan is kept.

**Other expensive optional strategies the same pattern covers:**
1. **The stance hypothesis** (`stanceHypothesis` in `deriveSwingStance` / fight / keylock / touch / hold). Measured 30–80 % of
   L16. Lazy evaluation alone removes it (§5.F1); no anytime ordering is needed.
2. **Block-route search** (`deriveBlockRoute`: shove / weigh routes). 99 % of the S4 L16-pit refusal (14 s, ends at
   `MAX_ROUTE_EXPANSIONS`).
3. **The KILL rung's chaser scan** (`deriveKillByChaser`). 89 % of D's L14 decline (4.8 s), ends in a refusal.

(2) and (3) are not anytime candidates in the user's sense: they are rungs the plan NEEDS when they succeed. They are
**bounded-refusal** candidates: a cheap precondition or a deadline that turns a slow refusal into a fast one.

## 4. Our side's options, measured (budget policy; the solver unchanged)

**What a budget expiry does today:**
- **JS page:** decline → J2 walker → retry ≤ 3 (after a death / crossing / 90 ticks).
- **wasm engine (W2+):** `pollSolve` → `fail(why)`, and **the walk ENDS**: no walker, no retry (only a W7 continuation
  falls back to a re-arrival). L16 is a walk-ending failure for exactly that reason.
- While the worker thinks, the wasm game is **held** (a zero-tick freeze tape) and the JS page holds its run. So a longer
  budget costs only **wall clock** (the user watches "solving…"), never correctness.

| option | L16 (live) | B L14 | L71 (kit) | cost |
|---|---|---|---|---|
| (a) uniform 5 s (today) | ✗ (walk ends) | coin flip | ✗ | — |
| (b) uniform 20 s | ✓ at 10.6–17.8 s (✗ at load > ~7) | ✓ | ✗ (68 s) | every slow REFUSAL now holds 20 s before ending (S4 L16 pit: 14 s held, then refused anyway); worst case +15 s per leg |
| (c) per-room budget from a census | ✓ if the census says ≥ 20 s | ✓ | needs 70 s+ | a census to keep, which goes stale whenever the fidelity arc moves the solver (L16's own time changed with F5/F6). Room SIZE does not predict cost: L16 is a small room, the slowest here |
| (d) retry once with 4× (20 s) after an expiry (wasm: instead of `fail`) | 5 + 10.6–17.8 = **16–23 s** wall | 5 + 3.3–5.7 s | ✗ | only the expired legs pay; the room stays held; needs the wasm `fail` path to become a decline-and-retry |
| (e) keep the worker searching while held, no cap (W7 hold) | ✓ at 10.6–17.8 s | ✓ | ✓ at 69 s | unbounded; a solve that never returns (S4's 90 s+ legs) needs a cap anyway → it reduces to (b) with a large cap |
| **(f) anytime in OUR worker: `dashMode: 'none'` pass, then `'all'` within the same budget; play the best found** | **4.6–5.9 s → ✗ at 5 s; ✓ at an 8 s budget, ✓ at 5 s with fidelity F1** | ✓ (0.4–0.9 s) | ✓ (0.7 s) | one extra dashless solve per leg (0.1–1.4 s; it pays for itself wherever dash planning is slow). The first pass's plan is in hand by the time the dash pass is terminated. No solver change: `solveSegment`'s `dashMode` is an existing parameter, `solveFromTape` just passes it through |

## 5. Recommendation

### OURS (budget policy; buildable in one follow-up slice, no solver/model change)

- **O1 — anytime two-pass in the worker (option f).**
  - `solveFromTape` passes `dashMode`.
  - The worker runs `none` first and posts a `{provisional: plan}` message.
  - Then it runs `all`. The service settles with the dash plan if `all` finishes inside the budget, else with the
    provisional plan at expiry.
  - The provisional plan must be from the SAME staging (the room is held, so it is).
  - Cost and benefit, measured: every leg here except L16 plays within 5 s, and dash plans are kept wherever they were
    affordable.
  - ⚖ for the user: is a dashless plan an acceptable playback? It is valid (it ends in the target level with 0 deaths in
    node). It is just slower in game time: +8 to +95 ticks per leg. **Owed: a live wasm witness that dashless plans play
    without divergence.**
- **O2 — the wasm expiry is a DECLINE, not a walk failure.** With no provisional plan, retry once with a 4× budget
  (option d) while the game stays held, then fail by name. This is the only fix on our side that saves L16 TODAY without
  the fidelity change (16–23 s of a held room).
- **O3 — a wasm budget knob** (parity with `?solverBudgetMs` / `setSolverBudgetMs`), so live probes and users on a loaded
  box can raise it.
- **Not recommended:** per-room/census budgets (option c). They go stale with every solver change, and room size does not
  predict cost. Also not recommended: a uniform raise (option b) alone. It turns every slow refusal into a long hold and
  still loses L71.

### FIDELITY arc's (the solver; `solverBot.js`)

- **F1 — LAZY stance hypothesis.**
  - `deriveSwingStance` (line ~9100) computes `stanceHypothesis(...)` BEFORE trying candidates. `stanceReaches` only
    reads it after the direct plan fails.
  - Measured with a load-time transform (`lazy-loader.mjs`, scratch): **byte-identical plan hash on all 36 runs** (18 legs
    × `all`/`none`, plus the D decline and the S4 L16-pit refusal, same messages).
  - L16 dashless **4.6 → 1.1 s**, L16 full 10.6 → 7.8 s.
  - The same eager pattern sits at fight (~8268), keylock (~8549), touch (~8743) and hold (~5067; there it also feeds
    `stancePrerequisite`, which is still lazy-safe).
  - ⚠ One semantic difference: an eager hypothesis that THROWS (`deriveWeigh`'s `fail`) would no longer throw when a
    candidate is reached directly. No measured leg hit it.
- **F2 — the anytime ordering INSIDE the solver (the user's idea at the solver's own grain).** `planSwordDash` is asked per
  `walkTo`, and the dash plan is an UPGRADE of a corridor already planned (`wps`). The hook it needs is a **deadline**
  (`solveSegment({deadline})` or a `shouldStop()` callback) consulted:
  1. between dash prefixes in `planSwordDash`'s scan, returning `plan: null` with `why: 'deadline'`, so the walk goes on
     dashless;
  2. before each optional rung (stance hypothesis, block-route expansion, the KILL chaser scan), turning a slow refusal
     into a fast named one.

  O1 covers the dash half from outside. F2 is finer: it keeps the dash on the legs where some walks dash cheaply and one
  does not (B L15→L16 has 5).
- **F3 — bounded refusals.** The KILL rung's `deriveKillByChaser` spent 4.8 s before refusing D's L14 ("no presser … arms a
  trap"). The S4 L16-pit block-route spent 14 s reaching `MAX_ROUTE_EXPANSIONS`. A cheap feasibility precondition before
  the scan, or the F2 deadline, makes these fast declines.

## 6. Found on the way (not this slice's to fix)

- **⚠ `generateSphereLog` THROWS on the recompiled `seedling_playthrough` (`9a35ad8989`):** *"SphereLogNotEvaluableError:
  not evaluable from an inventory: CanReachRegion (4 rule(s), e.g. … level_12__r0c19 -> level_12__r13c6 …)"*.
  - So **`probe-seedling-wasm-logical-links.mjs` B and `probe-seedling-wasm-vanilla-map.mjs` D both FAIL fatally on main**
    (they derive the sphere log in the page).
  - Their override check also fails, now that the flag is `source: 'explicit'` (`assumeBidirectional: false`); the
    probe's own override is redundant.
  - Worked around in the scratch capture by loading the committed `AP_14089154938208861744_sphere_log.jsonl`.
  - **Already routed** (arc log, 'AFTER' PROBES at `9a35ad8989`: the user chose (b), and `rules-sphere-log-reach` is in
    flight); this slice only confirms it independently.
- The committed `AP_14089154938208861744` rules carry no `flash_panel`, so a probe pointed at them SKIPs ("wasm artifact
  not staged"). Only `AP_1` mounts the wasm page.
- A JS fresh boot (`new Game(16,32,64)` + Sword) refuses L16 in 0.5 s, while the live arrival solves. So the S4 census's
  fresh-boot legs are NOT the live legs. **A budget census must replay captured arrivals** (`capture2.mjs` + `replay.mjs`).

## 7. Evidence (`NewDocs/plans/seedling-js-j0-evidence/l16-budget/`)

| file | what it holds |
|---|---|
| `capture2.mjs` (B), `capture-vm.mjs` (D) | the scratch live captures |
| `capture-main.json` / `capture-vm-old.json` | the captured arrivals |
| `replay.mjs` | re-solve a captured arrival |
| `leg.mjs` | a fresh-boot leg (S4's, with `dashMode` + hash) |
| `sweep.mjs` | serial runner under the box lock |
| `lazy-hook.mjs` + `lazy-loader.mjs` | the F1 measurement transform |
| `prof.py` / `cat.py` / `path.py` | the profile readers |
| `res-l16.jsonl`, `res-wide.jsonl` (110 rows), `res-lazy.jsonl` (72 rows), `res-prof2.jsonl` | the result rows |
| `capture-main.log` | the live run |

The cpuprofiles stayed in the session scratchpad (not kept).
