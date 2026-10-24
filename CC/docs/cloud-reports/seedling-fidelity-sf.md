# Seedling fidelity SF: the solver's budget items (SF1 lazy stance hypothesis · SF2 anytime deadline · SF3 bounded refusals)

**Slice:** `seedling-fidelity-sf`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`).

⚖ **The user's idea** (2026-10-04): *"…first search for solutions that don't involve sword dashes, then if it finds a dashless solution, and runs out of time while searching the dash options, it falls back on the solution it already found. This same pattern might work for other expensive and optional strategies."*

| | |
|---|---|
| Started from | `origin/main` @ **`a2d10de28c`** (the harness branch was already there) |
| Head | the commit that adds this report (the last one on the branch); the code head is **`15e34f8`** |
| Harness branch | `claude/seedling-fidelity-sf-czl402` (`seedling-fidelity-sf` was never created or pushed) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS** |
| Commits | `c117dfb` SF1 · `2bd779b` SF2 · `2ad8f52` SF3 · `de83979` surface · `15e34f8` log + reference · this report |

## The one thing to know first

**The hook is `solveSegment({ shouldStop })`, and it takes the site name: `shouldStop(site) => boolean`.** Only the `sword-dash` site is lossless. The other three sites (`stance-hypothesis`, `block-route`, `kill-chaser`) can turn a solve into a refusal. Measured: a clock that trips every site makes `r8-solve-4` refuse (its shove is the plan), and on B's L15 a counter that ignores the site refuses at the block route. So if the JS arc's worker wants the user's "fall back on the dashless plan" behaviour, its callback must answer true **only for `site === 'sword-dash'`**. A callback that trips everything is the bounded-refusal tool, and it belongs on a pass whose refusal is acceptable.

Also: **this box is 3–4× faster than the l16-budget report's.** L16's full search takes 2.4 s here at the base (the report: 10.6–17.8 s; the planner: 9.6 s). So the absolute times below are this box's. The ratios and the plan hashes are what carry over.

## W0 (at `a2d10de28c`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9200 bash scripts/procgen/identity-block.sh .` in the primary tree, venv active, pristine | log md5 **`aa46950b5958b32136111155250dd253`**, exit 0 |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, **all exit 0** |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner | inside the bounded vitest, (name, status) pairs | **465/465**, pairs md5 `9fe697368da8c79f3c8584ba836d784e` |
| surface / constants / profile / entities | `census-seedling-solver-surface --check` · `census-seedling-constants --check` · `witness-seedling-profile --check` · `witness-seedling-entities --check` (primary tree, AS3 present) | **GREEN 193** · **PASS 4,965** · **PASS 138** (both JSONs) · **PASS 518** |
| roster | `fixtures/tapes/index.json` | **204** tapes |
| bounded vitest BEFORE | 55 files: the brief's W0 list (`solverBot`, `solverBotLethalPit`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `tapeRunner`, `jsRuntimeDeclarations` read-only, `lintGateLabels`, `boxLock`, `entityBlocks`, `seedlingSolverSurface`, `seedlingConstantsCensus`), plus every other non-slow test file that imports the solver (50 by `rg`) | **55 files / 1,785 tests, all green** (run in a detached worktree; 13 files first failed to import because the worktree had no submodules, and were re-run green once they were linked) |
| timing + plan-hash table | `replay.mjs`'s staging (scratch `replay2.mjs`, which adds a trace hash and the hook) over every captured arrival in both captures × `none`/`all`, 3 runs each, serial, load per row; plus 4 census legs (scratch `leg2.mjs`) | 50 rows, in the side-by-side table below |

The census legs had to be reconstructed. S4's arguments are not in the evidence, so I took arrivals and kits from the atlas. Because of that, two values differ from the report: L71's plan is 509 t (not 527), and its arrival is (96,16), full kit.

## D1 — SF1: the stance hypothesis is lazy at all five sites (PASS)

**The change** (`c117dfb`). `lazyStanceHypothesis(run, blocked, contacts, walls)` returns a memoised thunk. All five sites hold the thunk: hold, fight, keylock, touch and swing. `stanceReaches` calls it only after the candidate's direct `planWaypoints` fails, which is the only place it was ever read. At the hold site, `stancePrerequisite` and `prerequisiteRefusalClause` force it, so they still see the hypothesis and the `walls` out-parameter exactly as before. Those two run only after every candidate has refused, and by then the thunk has usually been forced already.

**The throw question, measured.** The brief named one semantic difference: an eager hypothesis that throws (`deriveWeigh`'s `fail` or a block-route bound) would no longer throw when a candidate is reached directly. I instrumented the BASE in a scratch worktree, wrapping each eager call in a counter. Then I ran every solve I could: the six producers' `--check`, the acceptance batch, the generated set, killgate s2/s5/s9, every captured arrival and census leg, and the 50 solver-reaching test files.

| site | eager calls | throws |
|---|---|---|
| hold (`:5067`) | 26 | 0 |
| fight (`:8268`) | 3 | 0 |
| keylock (`:8549`) | 6 | 0 |
| touch (`:8743`) | 86 | 0 |
| swing (`:9100`) | 42 | 0 |

**163 eager calls over 126 processes, 0 throws.** No committed solve depends on the old order, so nothing had to be preserved.

**Proof of byte-identity.** All 50 sweep rows are byte-identical in plan keys, in the full trace JSON (md5) and, for refusals, in the message md5. That covers 21 live arrivals × 2 modes (2 rows are skips) and 4 census legs × 2 modes. The identity block, the six `--check`s and tapeRunner were identical at the head (D4).

**Timing.** L16 dashless **1,096 → 266 ms** (median of 3). L16 full **2,443 → 1,549 ms**. L16 stairs (census, kit) dashless 1,520 → 256 ms, full 2,279 → 975 ms.

**Mutant** (the base `solverBot.js` copied over the D1 file). Predicted: L16 dashless returns to ~1.1 s with the same hash. Measured: 1,140 / 1,081 ms, hash `0c36d853aa`, trace `805972cf56`. Restored md5-identical (`301534b5…`): 286 / 427 ms.

## D2 — SF2: the anytime deadline hook (PASS)

**The parameter.** `solveSegment({ …, shouldStop })`:
- `shouldStop: (site) => boolean | null`, default `null`.
- **`null` is today's search exactly.** The exported `solveSegment` is now a thin wrapper over `solveSegmentUnder`. With no hook it calls straight through and touches no state, and every site's check is `activeDeadline === null → false` before anything else.
- **The caller owns the clock.** The module never reads time, and a non-function is refused by name.
- **Per site, latched per site.** `DEADLINE_SITES = ['sword-dash', 'stance-hypothesis', 'block-route', 'kill-chaser']`. The callback is asked with the site's name. Once it answers true for a site, it is never asked for that site again, and that site stays refused for the rest of the segment. A clock or a counter ignores the argument.
- **Never silent.**
  - A tripped segment returns `deadline: { tripped: true, first, sites: { <site>: <refused count> } }` beside its trace. The key is absent when nothing tripped.
  - The walk row's `strategy.swordDash.why` is `'deadline'`.
  - A refusal raised after a trip carries `e.deadline` and a ` ⏱ DEADLINE: …` clause in its message.

**The sites, and whether a trip can turn a solve into a refusal:**

| site | where | on a trip | can it turn a solve into a refusal? |
|---|---|---|---|
| `sword-dash` | `planSwordDash`: at entry (after the sword gate) and before **each candidate preview** | returns the ordinary refusal shape with `why: 'deadline'`; even windows already accepted are dropped (`plan: null`, as the brief asked) | **No, not at the trip.** See the proof below |
| `stance-hypothesis` | the SF1 thunk | answers `[]` | **Yes**: a stance that needed another obstacle discharged is not found |
| `block-route` | `deriveBlockRoute`, before each expansion | `refused: { bound: 'deadline', … }`, the shape `MAX_ROUTE_EXPANSIONS` already has, so the callers throw "hit \`deadline\`" | **Yes**, measured: `r8-solve-4` (a shove is the plan) refuses |
| `kill-chaser` | `deriveKillByChaser`, before its stance scan | `{ stance: null, why: 'deadline — …' }`; the rung refuses and the ladder continues | **Yes**, if the KILL rung was the one that solved |

**Why the dash trip cannot itself refuse.**
- `walkTo` asks `planSwordDash` only after the corridor `wps` has been certified. That happens through `probeCorridor`, or `climbLadder` when the corridor probes dangerous.
- A trip returns the same `{ plan: null, why }` shape as "no dash window certified faster". `walkTo` then builds `strikePolicyFor(run, { dashPlan: null, dashMode })` and drives `wps`.
- That is the branch every walk whose scan found nothing has always taken. So the trip adds no new way to fail. The walk is the certified corridor with no dash plan.
- What follows is the ordinary search from the state that walk reaches. On every leg measured, that remainder solved (the table below). In general a different arrival state could in principle meet a different refusal later. The outer anytime pass (the JS arc's dashless-first pass) is the guarantee against that.

**The deterministic witnesses.**
- `solverDeadline.test.js` (committed; 5 rows at D2, 7 at D3) uses `r9-solve-2`'s own room. It plans one dash window (23 t against the undashed 47 t).
  - No hook, a `null` hook, and a counter that never trips (17 consults, all `sword-dash`) are byte-identical in keys and trace.
  - A counter tripping after 0, ⌊n/2⌋ or n−1 consults plays the **`dashMode: 'none'` keys exactly** (47 t), in L0, with 0 deaths. `out.deadline` is `{ first: 'sword-dash', sites: { 'sword-dash': 1 } }`, the walk row says `why: 'deadline'`, and the counter was asked exactly k+1 times (the latch).
  - A callback that bounds only the other sites is byte-identical to no hook.
  - `r8-solve-4` with `() => true` refuses with "hit \`deadline\`", the ⏱ clause and `e.deadline.first === 'block-route'`.
- On the scratch captures, with a counter that trips every site (L16 has no required block route), sweeping N = 0…100:

| L16 live arrival (`all`) | plan | where it tripped |
|---|---|---|
| N = 0 … 92 | **206 t, `0c36d853aa`, = the `dashMode: 'none'` plan byte-for-byte**, L17, 0 deaths | inside the PULL rung's walk to the rope stance, so every remaining walk is dashless |
| N = 93 … 97 | 119 t, `dfa80dab82`, L17, 0 deaths | in the last walk's scan: the pull keeps its dash and the final walk is dashless (111 + the 8 t that dash saved) |
| N ≥ 98 | 111 t, `5b1f924b52`, byte-identical (plan and trace) to no hook | never (98 consults in all) |

- On B's L15→L16 (5 dashes), with a **dash-only** counter (`site === 'sword-dash' && ++n > N`):

| N | plan | dashes kept |
|---|---|---|
| 0 | 509 t `fa1d871849` = the `none` plan | 0 (DDDDD) |
| 20, 40 | 511 t `bad03429b9` | 2 (PPDDD) |
| 60 | 482 t `ad12bdcfe7` | 4 (PPPPD) |
| ≥ 80 | 456 t `5e43ff1369` = no hook | 5 |

  Every row ends in L16 with 0 deaths. ⚠ **The 511 t row is 2 ticks LONGER than the pure dashless 509 t.** A partial dash schedule followed by walks under the `all` strike policy is not guaranteed to beat the `none` pass. An outer worker that holds both should keep the shorter plan.
- ⚠ With a counter that ignores the site, L15 at N = 0 / 40 **refuses**: the block-route site trips (`pushableblock@64,64`, "hit \`deadline\`"). That is the measured case behind "the one thing to know first".
- B's L14 (`all`, the 118 t plan with 0 dash rows) with a trip at 0 gives 145 t `7f0165df18`, which **equals the `none` plan**. The planner's "L14 changes the strike policy without dashing" is the dash planner's previews choosing the walk, not the policy alone.

**Mutant** (`deadlineReached` always answers false: the hook ignored). Predicted: the three rows that need a trip go red ("never trips" because 0 consults, the dash trip, the block-route trip), and the site-filter and non-function rows stay green. **Measured exactly that: 3 red / 5.** Restored md5-identical (`e7c8f669…`).

**With no hook, 50/50 sweep rows were byte-identical** at `2bd779b` (1 run).

**The wall-clock demonstration** (not a gate; `performance.now()` callback, all sites; load ~6 from parallel jobs):

| leg | no hook | 5 s clock | 1 s clock |
|---|---|---|---|
| L16 live (B read 17) | 1,869 ms, 111 t, 1 dash | 1,976 ms, 111 t, 1 dash (never trips here) | **1,162 ms, 206 t, 0 dashes** (the dashless plan) |
| B L14 (read 15) | 963 ms, 118 t | 885 ms, 118 t | 819 ms, 118 t (never trips) |
| L71 chest, full kit (96,16) | **26,336 ms**, 509 t, 0 dashes | **5,038 ms**, 509 t, `a9195aa929` (same plan) | **1,064 ms**, same plan |

## D3 — SF3: bounded refusals (PASS)

Two preconditions. Each one proves a refusal that the scan could only have confirmed.

**(a) `deriveBlockRoute`, `clear-path` (S4's L16 pit).**
- **The relaxed room:** every pushable removed, every breakable rock broken (live and still standing), every activator open. The exempt set is `contacts` ∪ the `crossable` pressers ∪ every activator's `proximity-hazard`.
- **The test:** if the search's own `floodReaches` cannot reach the aim from the live position in that room, no route exists. The search returns the **exhausted** shape (`refused: { bound: null, why }`, one `rejected` row) without searching.
- **Why it is sound:**
  - Every bag `bagsOf` can build restricts the relaxed one. A route only moves this block or sinks it, breaks rocks, and holds groups open. `liveRectOf` answers `null` for an open, broken or removed solid, so none of those adds an obstacle.
  - The search's connectivity is that same flood (the goal test of every route longer than one order). Otherwise it is A* on the same 16 px lattice, which the flood (four-connected, margin 0) never refuses where A* passes, per the flood's own comment.
- **Why the exhausted shape:** `deriveShove`'s caller distinguishes "I could not decide" (a bound, which throws) from "there is none" (returned for the frontier to report). This is the second claim. So solves can only gain: a search that would have found a route cannot meet the precondition.

**(b) The KILL rung's chaser arm without a sword.**
- Before SF3, the arm's two outcomes without a sword were both refusals: "no stance derives" (from the scan), or a stance followed by "but this run holds no sword". `strikePolicyFor` is null exactly when there is no sword, since a hunted body is always present.
- The gate is now read before `deriveKillByChaser`. The exported function is unchanged; its direct test caller and `botDriverV2` are untouched.

**Measured over the instrumented full pass** (the base plus counters):
- (a) ran on **197** `clear-path` searches. It fired **4 times**, all on the L16 pit legs, where the search had hit `MAX_ROUTE_EXPANSIONS` (2) or `MAX_ROUTE_ORDERS` (2). It never fired on a search that returned a route (0 unsound) or ran dry.
- (b) was reached **2 times** (D's L14, `none` and `all`), and the scan **never** found a stance without a sword.

**Words that change** (still refusals; no solve moved):
1. A relaxed-unreachable `clear-path` aim. Before: *"the block-route search for … hit \`MAX_ROUTE_EXPANSIONS\` / \`MAX_ROUTE_ORDERS\`"*. Now: the frontier's own *"no corridor for goal reach-pit toward (216,72) … Strategy 'shove' failed to apply. Planner said: no walkable tile path …"*, and the trace's rejection row names the relaxed proof (SF3).
2. The swordless chaser arm. Before: *"chaser arm: no stance derives for bob@128,64 …"* (or *"… — but this run holds no sword"*). Now: *"chaser arm: this run holds no sword, so \`set slashing\`'s outer gate refuses every press — no stance could strike bob@128,64, and the stance scan was not run (SF3)"*.

`rg -a` over `*.test.js`, `*.test.mjs` and `*.json` under `frontend scripts test_json` for `no stance derives for`, `but this run holds no sword`, `chaser arm:`, `MAX_ROUTE_EXPANSIONS`, `MAX_ROUTE_ORDERS`, `` hit `MAX_ROUTE`` and `pushableblock@256,80`:
- the only hits are the new `solverDeadline.test.js`;
- one comment in `procgenWeigh.test.js:338`;
- one id in `r9-solve-16.trace.json`, a solve whose trace is unchanged (tapeRunner, campaign `--check`).

No test asserted the old words.

**Timing** (median of 3, before → head):

| refusal | before | head |
|---|---|---|
| D's L14 decline (swordless, `none` / `all`) | 937 / 957 ms | **147 / 140 ms** |
| S4 L16 pit (13,4), full kit (`none` / `all`) | 7,403 / 7,451 ms | **37 / 37 ms** |
| S4 L16 pit (13,4), bare (`none` / `all`) | 1,231 / 1,178 ms | **41 / 35 ms** |

The committed witnesses use a fresh boot: L16 (32,64) for the pit, and L14 (160,64) with and without a sword grant. The swordless L14 refusal and the sword solve both reproduce on a fresh boot (the sword solve: 118 t → L15, unchanged).

**Mutant** (the D2 file over the D3 file: both preconditions removed). Predicted: the two SF3 rows red, D's L14 back to ~0.9 s, the five SF2 rows green. **Measured: 2 red / 7, D's L14 924 ms.** Restored md5-identical (`4fa0e024…`).

**No-hook sweep at the D3 code: 44/50 byte-identical.** The 6 movers are exactly the predicted refusal rows: D L14 × 2, L16 pit kit × 2, L16 pit bare × 2. All six are still refusals.

## The timing + plan-hash table, BEFORE / after SF1 / HEAD (no hook)

Each cell is the median of 3 serial runs of a node re-solve of the captured staging. Load is the mean 1-minute load average at the start of each row. B = `capture-main.json` (route B, Sword). D = `capture-vm-old.json` (route D, swordless). The goal for each read is `replay.mjs`'s own selection. The two skipped D read 1 rows (L86 arrival, `stepOff` composite) are omitted.

| leg (arrival) | mode | plan at the base | BEFORE ms | after SF1 ms | HEAD ms | load B / D1 / head | plan hash at head |
|---|---|---|---|---|---|---|---|
| B read 0: L0 | none | 119 t, 0 dash row(s), → L13, 0 deaths | 73 | 74 | 72 | 1.7 / 3.2 / 2.7 | `26c8fe62f0` byte-identical |
| B read 0: L0 | all | 119 t, 0 dash row(s), → L13, 0 deaths | 89 | 79 | 77 | 1.7 / 3.2 / 2.7 | `26c8fe62f0` byte-identical |
| B read 1: L2 | none | 47 t, 0 dash row(s), → L3, 0 deaths | 36 | 31 | 36 | 1.7 / 3.2 / 2.7 | `a3d960f7e7` byte-identical |
| B read 1: L2 | all | 47 t, 0 dash row(s), → L3, 0 deaths | 35 | 44 | 32 | 1.7 / 3.2 / 2.7 | `a3d960f7e7` byte-identical |
| B read 2: L3 | none | 245 t, 0 dash row(s), → L4, 0 deaths | 74 | 84 | 80 | 1.7 / 3.2 / 2.7 | `f4619e98d4` byte-identical |
| B read 2: L3 | all | 245 t, 0 dash row(s), → L4, 0 deaths | 75 | 81 | 75 | 1.7 / 3.2 / 2.7 | `f4619e98d4` byte-identical |
| B read 3: L4 | none | 255 t, 0 dash row(s), → L5, 0 deaths | 103 | 98 | 93 | 1.7 / 3.2 / 2.7 | `61dd959f0f` byte-identical |
| B read 3: L4 | all | 255 t, 0 dash row(s), → L5, 0 deaths | 118 | 105 | 99 | 1.7 / 3.2 / 2.7 | `61dd959f0f` byte-identical |
| B read 4: L5 | none | 403 t, 0 dash row(s), → L6, 0 deaths | 120 | 117 | 118 | 1.7 / 3.2 / 2.7 | `56b79cb759` byte-identical |
| B read 4: L5 | all | 403 t, 0 dash row(s), → L6, 0 deaths | 125 | 121 | 121 | 1.8 / 3.2 / 2.7 | `56b79cb759` byte-identical |
| B read 5: L6 | none | 294 t, 0 dash row(s), → L7, 0 deaths | 140 | 144 | 133 | 1.8 / 3.2 / 2.7 | `76d8fc4df4` byte-identical |
| B read 5: L6 | all | 294 t, 0 dash row(s), → L7, 0 deaths | 142 | 148 | 141 | 1.8 / 3.2 / 2.7 | `76d8fc4df4` byte-identical |
| B read 6: L7 | none | 146 t, 0 dash row(s), → L8, 0 deaths | 53 | 52 | 47 | 1.8 / 3.2 / 2.7 | `b07e547cf5` byte-identical |
| B read 6: L7 | all | 146 t, 0 dash row(s), → L8, 0 deaths | 51 | 49 | 47 | 1.8 / 3.2 / 2.7 | `b07e547cf5` byte-identical |
| B read 7: L8 | none | 827 t, 0 dash row(s), → L9, 0 deaths | 267 | 277 | 253 | 1.8 / 3.2 / 2.7 | `f6f0eb2b4d` byte-identical |
| B read 7: L8 | all | 827 t, 0 dash row(s), → L9, 0 deaths | 254 | 268 | 254 | 1.8 / 3.2 / 2.7 | `f6f0eb2b4d` byte-identical |
| B read 8: L9 | none | 122 t, 0 dash row(s), → L10, 0 deaths | 38 | 44 | 45 | 1.8 / 3.2 / 2.7 | `9b6a1b8b03` byte-identical |
| B read 8: L9 | all | 122 t, 0 dash row(s), → L10, 0 deaths | 41 | 44 | 42 | 1.8 / 3.2 / 2.7 | `9b6a1b8b03` byte-identical |
| B read 11: L3 | none | 226 t, 0 dash row(s), → L2, 0 deaths | 73 | 75 | 70 | 1.8 / 3.2 / 2.7 | `b44e575c6f` byte-identical |
| B read 11: L3 | all | 152 t, 1 dash row(s), → L2, 0 deaths | 164 | 157 | 153 | 1.8 / 3.2 / 2.7 | `23b4ca25d1` byte-identical |
| B read 12: L2 | none | 47 t, 0 dash row(s), → L0, 0 deaths | 42 | 34 | 33 | 1.8 / 3.2 / 2.7 | `8313ecc54a` byte-identical |
| B read 12: L2 | all | 23 t, 1 dash row(s), → L0, 0 deaths | 48 | 59 | 59 | 1.8 / 3.2 / 2.7 | `69f5d32b59` byte-identical |
| B read 13: L0 | none | 237 t, 0 dash row(s), → L13, 0 deaths | 155 | 156 | 157 | 1.8 / 3.2 / 2.7 | `d148c3937c` byte-identical |
| B read 13: L0 | all | 145 t, 1 dash row(s), → L13, 0 deaths | 301 | 309 | 296 | 1.8 / 3.2 / 2.7 | `ef6743ba91` byte-identical |
| B read 14: L13 | none | 74 t, 0 dash row(s), → L14, 0 deaths | 38 | 38 | 41 | 1.8 / 3.2 / 2.6 | `4b14594834` byte-identical |
| B read 14: L13 | all | 36 t, 1 dash row(s), → L14, 0 deaths | 67 | 60 | 62 | 1.8 / 3.2 / 2.6 | `a1ddebcd9e` byte-identical |
| B read 15: L14 | none | 145 t, 0 dash row(s), → L15, 0 deaths | 146 | 127 | 140 | 1.8 / 3.2 / 2.6 | `7f0165df18` byte-identical |
| B read 15: L14 | all | 118 t, 0 dash row(s), → L15, 0 deaths | 577 | 609 | 577 | 1.8 / 3.2 / 2.6 | `36cd4f6200` byte-identical |
| B read 16: L15 | none | 509 t, 0 dash row(s), → L16, 0 deaths | 214 | 207 | 190 | 1.9 / 3.2 / 2.6 | `fa1d871849` byte-identical |
| B read 16: L15 | all | 456 t, 5 dash row(s), → L16, 0 deaths | 297 | 274 | 247 | 1.9 / 3.2 / 2.6 | `5e43ff1369` byte-identical |
| B read 17: L16 | none | 206 t, 0 dash row(s), → L17, 0 deaths | 1096 | 263 | 270 | 1.9 / 3.2 / 2.6 | `0c36d853aa` byte-identical |
| B read 17: L16 | all | 111 t, 1 dash row(s), → L17, 0 deaths | 2443 | 1460 | 1645 | 1.9 / 3.2 / 2.6 | `5b1f924b52` byte-identical |
| D read 0: L0 | none | 314 t, 0 dash row(s), → L86, 0 deaths | 154 | 150 | 162 | 1.9 / 3.2 / 2.5 | `db21299996` byte-identical |
| D read 0: L0 | all | 314 t, 0 dash row(s), → L86, 0 deaths | 160 | 152 | 151 | 2.0 / 3.2 / 2.5 | `db21299996` byte-identical |
| D read 2: L0 | none | 305 t, 0 dash row(s), → L13, 0 deaths | 133 | 131 | 155 | 2.0 / 3.1 / 2.5 | `9cc39be278` byte-identical |
| D read 2: L0 | all | 305 t, 0 dash row(s), → L13, 0 deaths | 130 | 135 | 133 | 2.0 / 3.1 / 2.5 | `9cc39be278` byte-identical |
| D read 3: L13 | none | 74 t, 0 dash row(s), → L14, 0 deaths | 47 | 38 | 35 | 2.0 / 3.1 / 2.5 | `4b14594834` byte-identical |
| D read 3: L13 | all | 74 t, 0 dash row(s), → L14, 0 deaths | 39 | 39 | 39 | 2.0 / 3.1 / 2.5 | `4b14594834` byte-identical |
| D read 4: L14 | none | REFUSAL | 937 | 909 | 147 | 2.2 / 3.1 / 2.5 | `8f96434f8f` **words moved** (8f96434f8f → 734c9f3e24) |
| D read 4: L14 | all | REFUSAL | 957 | 991 | 140 | 2.2 / 3.2 / 2.5 | `8f96434f8f` **words moved** (8f96434f8f → 734c9f3e24) |
| L71-chest-kit | none | 509 t, 0 dash row(s), → L71, 0 deaths | 172 | 218 | 181 | 3.0 / 3.9 / 2.2 | `a9195aa929` byte-identical |
| L71-chest-kit | all | 509 t, 0 dash row(s), → L71, 0 deaths | 16479 | 16859 | 15882 | 3.0 / 3.9 / 2.2 | `a9195aa929` byte-identical |
| L16-pit-kit | none | REFUSAL | 7403 | 7686 | 37 | 3.1 / 4.0 / 2.2 | `f354a29cff` **words moved** (f354a29cff → 6d60d8b167) |
| L16-pit-kit | all | REFUSAL | 7451 | 7377 | 37 | 3.2 / 4.3 / 2.2 | `f354a29cff` **words moved** (f354a29cff → 6d60d8b167) |
| L16-pit-bare | none | REFUSAL | 1231 | 1255 | 41 | 3.4 / 4.2 / 2.2 | `0c66ff5fb7` **words moved** (0c66ff5fb7 → 6d60d8b167) |
| L16-pit-bare | all | REFUSAL | 1178 | 1233 | 35 | 3.4 / 4.3 / 2.2 | `0c66ff5fb7` **words moved** (0c66ff5fb7 → 6d60d8b167) |
| L16-stairs-kit | none | 125 t, 0 dash row(s), → L17, 0 deaths | 1520 | 266 | 256 | 3.4 / 4.3 / 2.2 | `073bb5a0c9` byte-identical |
| L16-stairs-kit | all | 91 t, 1 dash row(s), → L17, 0 deaths | 2279 | 1051 | 975 | 3.5 / 4.3 / 2.1 | `2c5e84ee71` byte-identical |

## D4 — records (PASS)

| Row | Command | Result |
|---|---|---|
| identity block AFTER | `SEEDLING_PORT=9200 bash scripts/procgen/identity-block.sh .` in a detached worktree at `de83979` (the code head; the later commits are docs only), venv active | log md5 `b8925c6fed267264f07958d755a5ed79`. **`diff` against W0: ONE line, the reference row.** Every census, pair, killgate, level and generated-set row, and all six `--check`s, are **byte-identical**: `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 |
| that one line | `generate-procgen-reference.mjs --check` | In the worktree: "4 … DIFFER" (`registry.js`, `capabilities.js` and their two markdown regions). The cause is the worktree's **symlinked submodules**, not this change. The same command in the primary tree at the code head (`de83979`) and at `15e34f8` reads **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH**. So the identity log in a primary tree is the W0 log, md5 `aa46950b…` |
| tapeRunner | bounded vitest AFTER, (name, status) pairs | **465/465, pairs md5 `9fe69736…` = W0** |
| solver surface | `--check` (6 RED, count drift only) → `--write` → `--check` | **GREEN 193** (site counts in `run:state`, `run:world`, `world:activators`, `state:x/y`; no new member), `de83979` |
| constants | `--profile-rows` → `--write` → `--check` | **PASS 4,965**, no file changed |
| profile / entities | `--check` | PASS 138 (both) / PASS 518 |
| reference | `generate-procgen-reference.mjs` after the log edit | docs index regenerated (`README.md` word counts, `docsIndex.js`); `--check` **ALL 7 + 5 MATCH**; `check-procgen-docs.mjs` **ALL CHECKS PASSED**; `vitest run frontend/modules/procgenDocs` 8 files / 491 green |
| bot log | `seedling-bot-log.md` | `### Seedling fidelity SF — lazy hypothesis, anytime deadline, bounded refusals`, after F6, with three trap candidates |
| bounded vitest AFTER | the 55 W0 files + `solverDeadline.test.js` | **56 files / 1,792 tests, all green** (1,785 + 7), exit 0. `shoveWeighParity`, `watchGenOverlay`, `jsRuntimeDeclarations` and `jsRuntimeSolverAnytime` are among them, green |
| roster | `fixtures/tapes/index.json` | **204**, unchanged (no tape added or moved) |

## For the JS arc: the parameter and how to wire it

- **Name:** `shouldStop`, on `solveSegment`'s options object.
- **Type:** `(site: 'sword-dash' | 'stance-hypothesis' | 'block-route' | 'kill-chaser') => boolean`, or `null` (the default: no deadline).
- **Semantics:**
  - It is asked before each optional scan, latched per site, and it never reads a clock itself.
  - When anything tripped, the result has `out.deadline = { tripped: true, first, sites }`; a refusal after a trip has `e.deadline` and a ⏱ clause.
  - `sword-dash` is the lossless site: the corridor is walked without a dash plan. The other three bound a slow scan and can refuse.
- `DEADLINE_SITES` is exported.

```js
// the worker's full pass: keep the dashless plan already found, upgrade only while time remains
const deadlineAt = started + budgetMs;
const out = solveSegment({ ...opts, dashMode: 'all',
    shouldStop: (site) => site === 'sword-dash' && performance.now() >= deadlineAt });
const best = (provisional && provisional.perTick.length <= out.perTick.length) ? provisional : out;  // a partial schedule can be longer (L15: 511 vs 509)
```

To bound a slow REFUSAL as well (for example on the dashless first pass), pass `shouldStop: () => performance.now() >= deadlineAt`. The pass then refuses by name instead of overrunning, and `e.deadline` says it was the clock.

## The JS arc's pins that move at my head

**None measured.** `jsRuntimeDeclarations.test.js` and `jsRuntimeSolverAnytime.test.js` (read only) are green at the head, and no file of theirs was edited. Their worker passes no `shouldStop`, so it runs the default, which is byte-identical. What does change for them is speed:
- L16's dashless pass: 1.1 s → 0.27 s on this box;
- the full pass: 2.4 s → 1.5 s;
- D's L14 decline: 0.94 s → 0.14 s.

A pin that recorded a *timing* would move, and I found none.

## Deltas

| | W0 | head |
|---|---|---|
| solver surface | GREEN 193 | GREEN 193 (site counts re-written) |
| constants / profile / entities | PASS 4,965 / 138 / 518 | unchanged |
| tapes / tapeRunner | 204 / 465 | 204 / 465 (pairs identical) |
| bounded vitest | 55 / 1,785 | 56 / 1,792 (+ `solverDeadline` 7) |
| identity log (primary tree) | `aa46950b…` | identical rows; worktree log `b8925c6f…` differs only by the symlink reference line |
| exports | — | `DEADLINE_SITES`; `solveSegment` gains the optional `shouldStop` |

## What the brief got wrong (measured)

1. **The absolute times.** On this box L16's full search is 2.4 s, not 9.6–17.8 s, and B's L14 is 0.6 s, not 3.3–5.7 s. Only L71 with the kit still exceeds 5 s (16–26 s). Same plan hashes as the planner's (`0c36d853aa`, `5b1f924b52`).
2. **"L16's plan uses ONE dash saving 8 ticks."** The full plan is 111 t against the dashless 206 t. The 8 t is the dash on the final walk row, which is the only `swordDash` key the trace carries. Most of the difference is the PULL rung's own walk to the rope stance. With that walk's dash scan (the first 93 consults) tripped, the pull ends at tick 164 instead of 99, and the last walk then starts from a different place (42 t instead of 12–20 t). No trace row records that walk's dash plan (residue 1).
3. **"B's L14 changes the strike policy without dashing."** A dash trip at the first consult plays 145 t, the `none` plan exactly. The 27 t difference comes from the dash *planner's* scan, not from the `all` policy's reactive allowance.
4. **"a dashless plan already found is NEVER lost to the deadline", applied to every site.** That holds for `sword-dash` only. A callback that trips every site refuses `r8-solve-4` and B's L15 at the block route. The JS arc must filter by site (above).
5. **The S4 census legs** are not reproducible from the evidence (no arguments recorded). L71's plan at this base is 509 t (from (96,16), full kit), not 527.
6. **The l16-budget report's "deriveKillByChaser 89 % of D's L14"** was a scan whose answer was fixed by one field: D's route holds no sword, so the arm could only refuse. That is SF3(b).
7. (my own, not the brief's) My first cut of SF3(a) returned `refused: null` as "the exhausted shape". The exhausted shape is `refused: { bound: null, why }`. I caught it before the commit by reading the search's last return.

## Residue

1. **A rung's inner walk does not show its dash.** L16's trace is two rows (`pull` at t0, `walk` at t99), and only the walk row carries `swordDash`. The pull rung's walk to the rope stance plans a dash that brings the pull from t164 to t99, and no row records it. It looks like R9 slice RR's named merge residue, but I did not trace it to the line that drops the key. Fixing it would move committed sidecars.
2. **A tripped dash scan drops windows already accepted** (`plan: null`, as briefed). Keeping the accepted prefix would keep certified time savings. It is a one-line change, but its plans would need their own certification argument.
3. **A partial dash schedule can be longer than the dashless plan** (L15: 511 vs 509). The outer worker should compare.
4. **SF3(a)'s soundness rests on two stated properties:** `liveRectOf`'s monotonicity, and "the flood never refuses where A* passes" (the flood's own comment). Both are reasoned, not machine-checked. The empirical check is 197 searches with 0 unsound.
5. **The instrumented pass ran on the base with scratch counters** (never committed). The generated-set leg needed `SEEDLING_PORT` and the primary venv, and was re-run. The worktree reference artifact is described in D4.
6. **SF2's `kill-chaser` site is not reachable on any measured leg** at the head: SF3(b) answers first on every swordless leg, and no sworded leg in the set reached the chaser scan under a trip. It is witnessed only by construction.

## Byte-inertia

With no `shouldStop`:
- every committed solve is byte-identical: the six producers' `--check` md5s, tapeRunner's 465 pairs, the identity rows;
- the 44 sweep rows that are not the two SF3 refusals are identical in plan and trace md5.

SF1 alone: 50/50. SF2 alone: 50/50. SF3's six movers are refusal words only.

## The identity rows the coordinator must BANK

- identity log (primary tree): **`aa46950b5958b32136111155250dd253`**, unchanged from `a2d10de28c`;
- six `--check`s: **`405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`**, all exit 0, unchanged;
- tapeRunner **465**, pairs md5 **`9fe697368da8c79f3c8584ba836d784e`**;
- surface **GREEN 193**; constants **PASS 4,965**; profile **138**; entities **518**; tapes **204**;
- new: `solverDeadline.test.js` (7 rows); `DEADLINE_SITES`;
- the refusal words that moved: the S4 L16 pit (13,4) and D's swordless L14 decline (D3). No committed artifact carries them.
