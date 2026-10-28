# Seedling fidelity L41TOTEM — leg 855 (L41 Totem Part 240,144): the 90 s timeout is game-paced play, not a 240 s solve

Wave 33, planner `seedling-fidelity-planning-15`. Session `seedling-fidelity-l41totem`.

- **Start SHA:** `6f5916203ecb53d2f333d09b11a4b30933295ef7` (main, 92 default-ON keys).
- **Head:** `623fc0c0` is the last code head (CI green there). This report and its evidence are the commit after it.
- **Commits:** `137a7da8` D1, `faafe980` D1b, `30b6b15c` D3, `6fc189fc` (the D1 row names D3 OFF), `623fc0c0` (log + docs index).
- **Harness branch:** `claude/seedling-l41-totem-cost-oh70t8`.
- **Port:** 9752.
- **Evidence:** `CC/docs/cloud-reports/seedling-fidelity-l41totem-evidence/`.

## The one thing to know first

**The leg does not spend 240 s solving. It spends ~85 s playing.** On CI the page's worker solved 855's request in
**4.4 s** (keyed run 40536788606) and **9.0 s** (40536803626). The plan is **2,505 ticks**. The game plays it at its own
pacing cap, ~30 ticks/s: CI measured 29.4 and 29.1 ticks/s on those shards, and this box 28.5. So the play alone is
**≥ 83.5 s**, and the solve is the only slack against the 90 s budget. Run 1 drained **2,503 of 2,505** rows before the
cut: it missed by about 0.1 s. Run 1 also served the part at tick 2497. Both CI runs and every local run of the solver's
own plan match the game **exactly**: the engine's `firstDivergence` compares (level, x, y) on every drained row, and
none diverged.

Three keys, all OFF (byte-identical) and all mine:

- **D1 `baitComponentMemo`** and **D1b `baitAlignSafeMemo`** are cost keys with the same answer. Together they cut the
  solve by about 64%: 14.3 s → 5.2 s in node, 13.0 s → 5.6 s on this box's page worker.
- **D3 `baitParkedTail`** shortens the plan: 2,505 → 2,269 ticks, about 8 s of play. It is game-witnessed at 0 px.

With all three ON, leg 855 is **DONE inside the default 90 s budget** on the p4g game here, on a box slower than CI.

## W0 — the measurement

### Where the 90 s goes (both CI keyed runs plus local, from the rows' own clocks)

| | CI run 1 (seam 5280) | CI run 2 (seam 5282) | local OFF (seam 5189, 400 s budget) |
|---|---|---|---|
| solve (`solvedMs`, the page's worker) | 4,403 ms | 8,952 ms | 13,039 ms |
| plan | 2,505 t (both passes SOLVED: dashless 2,563 t / 238 work, full 2,505 t / 322 work) | same | same |
| play rate | 29.4 ticks/s (shard 5 `RUNNER`) | 29.1 ticks/s | 28.5 ticks/s (derived from two local runs) |
| drained at the end | 2,503 / 2,505 | 2,338 / 2,505 | 2,506 (all) |
| end | `timeout` 90,163 ms (part served at t2497) | `timeout` 90,069 ms | **`done` 103,066 ms** (served at t2498) |
| game vs plan | 0 divergences | 0 divergences | 0 divergences, end = expected end to the last digit, 0 hits |

Decomposing a leg (local, from two runs that differ only in solve time): arrival to hold is ~1.2 s, and the arrival
latch is ~0.7 s. Hold to ship is the latch plus the solve. Play is `ticks / rate`. At CI's rate the 2,505-tick play is
85.2 s, so a leg fits in 90 s only if latch + solve < ~4.5 s.

### The solve (node replay of the captured requests, `replay-seedling-solve-request.mjs`; this box is ~3.3× slower than CI's page worker)

`node --cpu-prof` over one replay (`evidence/w0-profile-off.txt`), 14.9 s in all:

| term | inclusive |
|---|---|
| `resolveBaitStrategy` → **`searchBaitOrdering`** (the crusher-bait ordering search) | **8.3 s (60%)** |
| ↳ `componentOf` → `floodOver` | 6.8 s |
| `execBait` (the chains: `alignmentCandidates` 2.7 s → `crusherSightDanger` → `scanCrusher` → `collideLineSolid`) | 4.0 s |
| everything else (walks, the fire-block route `deriveBlockRoute` 0.2 s, the weigh 0.5 s) | ~1.6 s |

**The repeats, counted** (an instrumented copy, restored):
- `searchBaitOrdering` runs **twice**, once per pass, from the same arrival state (24,168): 4.8 s and 4.7 s.
- Of its **68,418** component floods, **68,406** start inside a component the search had already flooded under the same
  crusher configuration. Every non-empty flood ends with its key in `seenStates` (or skipped by `seenRegions`, whose key
  is already there), so each of those floods ends at `continue`. They cost **6.96 s of the search's 9.5 s**. **That is
  the dominant term.**
- `execBait`'s `safe(p)` is asked **96,384** times over the six alignments (three chains × two passes). **57,874** of
  those asks repeat a position already asked in the same alignment.

### The staging diff the brief asked for

The survey's step 96 (the same location, `collect-placement (240,144)`) solved in 6.1 s on CI. The sweep's request
solved in 4.4 s / 9.0 s. **The two solves cost the same, so the staging is not the dominant term.** The difference is
that the survey never PLAYS its plan, while the sweep plays 2,505 ticks at the game's pace. The survey's plan is 2,346 t
from its own staging; the sweep's arrives `in_L40_944_96` at (16,160) and is 2,505 t.

The answer is also not a function of the seam clock: `--seam-time-sweep=-3..3` gives one answer over 5277–5283 in both
arms (`evidence/seam-census-855.txt`). So run 2's 9.0 s solve was the runner, not a different question.

## D1 — the cost (PASS, behind `baitComponentMemo` and `baitAlignSafeMemo`, both OFF) — `137a7da8`, `faafe980`

**D1, `crusherBait.searchBaitOrdering`.** When the key is ON, every node a flood reached is recorded on that
configuration's per-search cache (`c.flooded`). An escape seed already inside one is skipped before its flood. This is a
duplicate expansion with an exact skip, not a cache: the skipped flood's outcome is `continue` by the search's own
invariant. The answer, stats and BFS order do not change. `BAIT_SEARCH_COUNTERS` (`floods`, `skipped`) counts it for
the guard.

**D1b, `crusherBait.alignmentCandidates`.** When the key is ON, the caller's `safeAt(p)` is memoised per call, keyed on
(p.x, p.y). The alignment previews and never advances `run`. Its one caller (`execBait`) prices every live crusher's
sight at p, with the crushers parked and the line solids fixed for the call. The memo lives in `alignmentCandidates`
(not in `execBait`), so it is per call by construction. `BAIT_ALIGN_PROBE.record` is a measurement hook that records
each answer's candidate list.

**Measurement** (`evidence/d1-replays.txt`). Leg 855's two captured requests, 4 runs per arm (2 per seam):

| arm | wall (node, mean) | answer sha | progress trace (776 points) | work |
|---|---|---|---|---|
| OFF | **14.29 s** | `7fea55beb436` | `f8f4f53985c9` | 560 |
| D1 | 6.41 s | same | same | same |
| D1 + D1b | **5.19 s (−64%)** | same | same | same |

On this box's p4g page worker (local sweep): `solvedMs` 13,039 → **5,600** with D1 + D1b.

**Is D1 alone enough? No, so the target is not met by D1.** Projected onto CI with the measured rates and the page
ratio 5.6 / 13.0:
- run 1: about 0.8 + 1.9 + 85.2 ≈ **88 s**, a ~2 s margin;
- run 2: about 0.8 + 3.9 + 86.1 ≈ **91 s**, still TIMEOUT.

Measured locally with D1 + D1b at the default budget: **`timeout` at 90,183 ms, 2,352 / 2,505 drained, 0 divergences**
(`evidence/local-sweep-855.json`). The floor is the play, and that is why D3 exists.

**Guard** (`fidelityL41Totem.test.js`):
- The L41 bait search (the SEARCHGAPS staging, both `crusherBaitPressGoal` arms): ON `toEqual` OFF, 102 states expanded,
  ON floods < 1% of OFF.
- A y-and-x-varying safety asked twice with two predicates: the same candidate lists, fewer asks.
- The SEARCHGAPS staging's L41 solve (2,189 t; D3 named OFF): the same perTick, equips, waypoints, replans and every
  alignment's candidate list.

**Mutants** (`evidence/mutants.txt`), predicted first:
- D1's key ablation (one set for every configuration) is RED. A memo that never records is RED. Default ON is RED.
- D1's `!hot` guard is an **equivalent** mutant, and my prediction was wrong. A hot escape is seen by its mover under
  `next`, so it is never SAFE there and never inside a flooded component. The guard is kept and documented.
- **D1b's first placement (in `execBait`) let its key-ablation and shared-memo mutants survive.** At L41 every previewed
  position is safe, so a mis-keyed memo still answers `true`. Moving the memo into `alignmentCandidates` and adding the
  varying-safety row turned both RED.

## D3 — the plan's length (PASS + game witness; STOP for its default flip) — `30b6b15c`

**The gap.** A crusher chain's escape ends in R5's fixed idle span, recorded on the game: 160 / 220 / 260 ticks at L41.
The idle outlasts the charge. On the model (the plan replayed, `crushersParked` per tick) the crusher parks at t456, t808
and t1172 against idle ends at t484, t931 and t1257. **The player stands still 28, 123 and 85 ticks with the crusher
already parked**: 236 of 2,505 ticks, ~8 s of game-paced play.

This is planner conservatism, not a model term, and the model already steps the park. When the key is ON:
- The fork that certifies the chain's alignment drives `runBait` into a `parkedTailProbe` sink. `runBait` only `push`es,
  one key set before each `advance`.
- The sink marks where the **trailing** streak begins in which every crusher is parked and the player is at rest.
- `trimParkedTail` cuts the live chain's last idle span (only a trailing `key: null` span, never past its length) to end
  there.
- `runBait` on the live run then re-checks the cut chain: no contact, parked at the end, the park as a position.
- No extra fork and no deadline ask.

**Measurement.**
- Leg 855's request: 2,505 → **2,269 t**, work 560 → 532, SOLVED. Seam-independent over 5277–5283.
- The SEARCHGAPS staging: 2,189 → 1,953 t (the same 28 / 123 / 85).

**Game witness (p4g, headless logic-only, local port 9752, the production engine, every key ON:**
`evidence/local-sweep-855.json`). Leg 855 at seam 5156 is **`done` inside the default 90 s budget**.
- All **2,270** drained game rows equal the plan's expected rows **exactly** (level, x, y on every tick; the engine's own
  `firstDivergence`).
- The end is (247.84174907527955, 152.46765870174647), which is the expected end.
- The part was served at tick 2262. `roomHits.max` 0.

The local margin is ~0. `done` was read on the 200 ms poll after the last in-budget check, at 90,107 ms. This box solves
~3× slower than CI (6.2 s here) and plays at 28.5 ticks/s. **Projected onto CI's measured rates:** 0.8 + (2–4 s solve) +
2,269 / 29.4 = 77.2 s ⇒ **~80–82 s, a 7.5–10 s margin.** That is a projection; the CI dispatch below measures it.

**Guard** (`fidelityL41Totem.test.js`):
- The probe: the trailing streak, the reset on a re-wake, and "parked but moving" is not settled.
- The trim: only a trailing idle span, never past its length, unchanged without a probe.
- L41's three chains are cut by exactly 28 / 123 / 85, and the walk before the bait is the same.

**Mutants:** no reset, no at-rest condition, any trailing span, cut + 1, and default ON are all RED.

**STOP (the default flip needs a licence).** With all three keys ON, the bounded set (101 files) is 3,439 passed / 3
failed / 2 env-skipped. The 3 reds are D3's, and two of them are committed witness pins:

1. `fidelityCrusher.test.js` › *"is the solver's own plan with the flag ON …"* — `fixtures/tapes/crusher-l42-round-trip.json`
   (L42's plan is 9 t shorter: survey step 98 goes 1,294 → 1,285 t).
2. `fidelityCrusherPress.test.js` › *"the solver still plans the recorded tape"* —
   `fixtures/crusherpress-witness/crusherpress-l41-bait.json` (the L41 bait cut).
3. `fidelityL41Totem.test.js`'s own D1 row pinned the OFF plan without naming D3. It was fixed in `6fc189fc` (it names D3
   OFF).

Both committed tapes still replay at 0 px: they are the OFF plans. A flip owes either a re-record of both on p4g, or a
D3-OFF pin in their producers. No producer `--check` moved: the identity block's six producers are L≤18 and the r9
campaign, with no crusher room.

## D2 — the model (PASS: the solver's plan is game-correct; the witness IS D2)

The 2,505-tick OFF plan (the "240 s" one) is game-correct:
- CI run 1: 2,503 drained rows, 0 divergences, served at t2497.
- CI run 2: 2,338 rows, 0 divergences.
- Local, 400 s budget: all 2,506 rows, 0 divergences, end = expected end, served at t2498, 0 hits.

The D3 plan is game-correct too (above). **No model gap on this leg.** The ~240 s figure was a leg wall time with a
slower solve, not a solve.

## Movers

### Survey (local; `--through=end --route=full`)

`searchBaitOrdering` returns at `baitRoom` without a crusher, and `alignmentCandidates` / the tail are called only from
`execBait`. Crushers exist only in **L41, L42 and L107** (the atlas). At this base those are steps **96** (L41 part),
**98** (L42 part) and **228** (L107 → L108). CI's step ids differ (L107 is CI's 223): match by (level, goal, boot).

| step | OFF | D1 + D1b ON | D1 + D1b + D3 ON |
|---|---|---|---|
| 96 L41 `collect-placement (240,144)` | SOLVED 2,346 t | **byte-identical row** | SOLVED **2,110 t** (−236) |
| 98 L42 `collect-placement (184,152)` | SOLVED 1,294 t | **byte-identical row** | SOLVED **1,285 t** (−9) |
| 228 L107 `reach-exit (304,176)` | REFUSED (the combat ladder at `buttonroom@288,176`) | **byte-identical row** | **byte-identical row** |

No verdict or wording moves in any arm. The tick counts move under D3 only.

### Divergence sweep (local, keyed: every L41 / L42 / L107 leg at this base, both arms; 300 s budget so the verdict is not cut by this box's clock)

| leg | what | OFF | all three keys ON |
|---|---|---|---|
| 394 | L41 r4c3 → `out_teleporter_0_160` | done, 5 t, 1,660 ms, solve 184 ms, seam 5194, 5 rows at 0 px | done, 5 t, 1,455 ms, solve 195 ms, seam 5162, 5 rows at 0 px |
| 395 | L42 → `out_teleporter_240_336` | done, 4 t, 7,619 ms, solve 271 ms, seam 5173, 4 rows at 0 px | done, 4 t, 1,516 ms, solve 207 ms, seam 5177, 4 rows at 0 px |
| 396 | L42 Totem Part 184,152 | done, 1340 t, 65,709 ms, solve 16,060 ms, seam 5185, 1341 rows at 0 px, served t1333 | done, 1331 t, 58,276 ms, solve 7,006 ms, seam 5203, 1332 rows at 0 px, served t1324 |
| 767 | L107 (L102 door) → `out_teleporter_0_48` | done, 5 t, 1,284 ms, solve 152 ms, seam 5525, 5 rows at 0 px | done, 5 t, 1,336 ms, solve 185 ms, seam 5566, 5 rows at 0 px |
| 768 | L107 (L102 door) → `out_teleporter_304_176` | failed (the L107 `buttonroom` combat-ladder refusal), 1378 ms | failed (the L107 `buttonroom` combat-ladder refusal), 1309 ms |
| 769 | L108 door → `out_teleporter_0_48` | done, 338 t, 13,093 ms, solve 666 ms, seam 5546, 338 rows at 0 px | done, 341 t, 13,563 ms, solve 844 ms, seam 5542, 341 rows at 0 px |
| 770 | L108 door → `out_teleporter_304_176` | done, 5 t, 1,357 ms, solve 149 ms, seam 5530, 5 rows at 0 px | done, 5 t, 1,395 ms, solve 169 ms, seam 5536, 5 rows at 0 px |
| 855 | **L41 Totem Part 240,144** | done, 2505 t, 105,890 ms, solve 13,386 ms, seam 5171, 2506 rows at 0 px, served t2498 | done, 2269 t, 86,632 ms, solve 4,685 ms, seam 5185, 2270 rows at 0 px, served t2262 |

**Ends: 0 movers.** Every played leg has 0 divergences and 0 hits in both arms. The plans move only where D3 reaches a bait:
- **396: 1,340 → 1,331 t.** This is the game witness for D3's L42 plan.
- **855: 2,505 → 2,269 t, `done` at 86.6 s.**

Leg 769's 338 → 341 t is the seam clock, not the keys. Each arm's captured request replays to its own answer with the
keys ON and OFF alike: seam 5546 → 338 t (`f0cd8aa65603`), seam 5542 → 341 t (`27b425ac99b9`). Its verbs are dodge +
walk, with no bait. The OFF arm's 855 solve was 13.4 s on this box against 4.7 s ON, the same ratio as above.
This is one sample per arm; the CI ×2 below is the verdict.

### Pins (`solveProgress` / `solverDeadline` / `jsRuntimeSolverShouldStop`)

- **D1 / D1b: none move.** Both bounded ON arms are green, and the progress trace and work units are identical.
- **D3: none of those three files move.** Its reds are the two witness pins above. 855's work goes 560 → 532 (a solve
  with fewer ticks to preview), but no pinned roster row stages a crusher room.
- **L4's 1-unit dash-window margin: untouched.** L4 has no crusher, so none of the three keys can reach it.

## The CI dispatches the planner should run (I cannot dispatch)

1. **Keyed sweep ×2, both arms, at the DEFAULT leg budget** (`leg_budget_ms` empty), on branch
   `claude/seedling-l41-totem-cost-oh70t8`: `seedling-divergence-sweep.yml` with
   `keys=` the 8 keys in `evidence/keys8.txt` (`|`-separated: legs 394, 395, 396, 767–770, 855 at this base), `page_legs=1`, `capture_requests=true`.
   - OFF arm: no `contact_fidelity`.
   - ON arm: `contact_fidelity=` the 92 default-ON keys `,baitComponentMemo,baitAlignSafeMemo,baitParkedTail` (the full
     list is `evidence/on-keys-all3.txt`).
   - An ON arm with only `…,baitComponentMemo,baitAlignSafeMemo` (`evidence/on-keys-d1.txt`) prices D1 alone.
   - **The pass line for 855:** `end: done` with `ms` < 90,000 in both repeats of the all-three arm, and a margin read off
     `ms`.
2. **Survey**, `seedling-survey.yml through=end route=full`, on a branch with the three keys flipped ON (the survey takes
   no contact input). Expect only steps 96 (−236 t) and 98 (−9 t) to move; `only=96,98,228` is the minimum.
3. **Probes**, `seedling-probe.yml battery=standard`, on that same flip branch. No probe stages L41 / L42 / L107 as far as
   I can see, but the brief names DRILL's lesson, so it is owed.
4. **Full sweep** on the flip branch, for anything the keyed run cannot see (expected: no movers outside L41 / L42 / L107).

## The JS arc

- **Pins that move:** none of the JS arc's pins. `jsRuntimeSolverShouldStop`, `jsRuntimeDeclarations` and
  `jsRuntimeSolverEventGoal` are green in every arm.
- **To wire:** nothing for D1 / D1b / D3. The three keys reach the worker through the existing `seedlingContact<Key>`
  flashPanel settings (the probe's `CONTACT:` line read `baitParkedTail` back).
- **A harness note for them, not an edit.** The sweep's leg budget includes the game-paced play, so any plan over
  ~2,400 ticks is a timeout on CI whatever the solver does: 2,400 / 29.4 + latch ≈ 82.5 s, leaving ~7 s for the solve.
  A budget that excludes the play (or scales with `plan.ticks`) would separate a slow solve from a long plan. That is the
  divergence-sweep producer's call.

## Handed to the hammer arc

Nothing. No code in its region was touched: not `planWaypoints`, the escape cache, `stateDigest`, the fork closure or
`replayOntoFork`. D3 calls the existing `ctx.fork()` exactly as before, with no extra fork or deadline ask.

## What the brief got wrong (measured)

- **"It SOLVES at ~240 s … a solve-COST gap."** The solve is 4.4 s / 9.0 s on CI. The leg is ~90+ s because the
  2,505-tick plan plays at the game's ~30 ticks/s cap: ≥ 83.5 s.
- **"The cost is the STAGING's, not the goal's"** (survey 6.1 s vs the sweep). The sweep's solve is no slower than the
  survey's; the survey simply never plays its plan.
- **"Target: the leg solves inside the sweep's 90 s budget"** cannot be met by a solve-cost cut alone. With a zero-time
  solve the margin is ~4 s at CI's play rate. It took D3, a shorter plan, to make it robust.
- Leg ids: 855 here, 849 at 7266baa10d. The keyed runs' artifacts carry it as 849.

## Trap candidates

- **A sweep `timeout` is not a slow solve.** Read `history[0].solvedMs`, `rowsDrained` / `ticks` and the shard's
  `RUNNER … play ticks/s` before profiling. A 2,500-tick plan cannot fit a 90 s leg at 30 ticks/s.
- **A memo guard that only replays one room can be blind.** At L41 every previewed position is safe, so a mis-keyed
  memo passed the solver rows. Test a memo's KEY with an input whose answer varies along every axis the key claims.
- **A BFS that floods per escape can re-flood the same component tens of thousands of times.** The `seenStates` check
  after the flood hides it from every count except a profile.
- **A choreography's fixed idle is a wait, not a requirement.** R5's spans were searched to PARK the crusher. The tail
  after the park is free time the plan still pays for.

## Residue

- Two more sources of plan length on 855, not touched:
  - the 113-tick idle after the last fire press (t2141–2254) while `wandlock@240,96` opens, against a ~190-tick walk to
    it (MOVINGWAIT-shaped, in FIREMOVE's weigh/route region);
  - each Fire press's 37-tick idle.
- The full pass re-solves everything the dashless pass solved (the bait search twice). Its whole saving is 58 ticks
  (~2 s of play) for ~45% of the solve. That is the JS arc's `ANYTIME_PASSES` policy.
- The reference `--check` reports "4 GENERATED MODULE(S)/REGION(S) DIFFER" at the clean base and the same after (base
  state).

## Byte-inertia

- **Default switches:** all three keys ship OFF, and every hunk is gated on its key.
- **Bounded vitest (99 files, the BEFORE set):** BEFORE = AFTER at `faafe980` and at `30b6b15c`: 3,386 / 3,386, md5
  `1973cbcc3b7d0aae25db054c3c74241c`, tapeRunner 638 rows md5 `68ec78147b5bb841a08bb863768739ce`.
- The AFTER set adds `fidelityL41Totem` and `seedlingResponderFade` (101 files, 3,444 / 3,444).
- **Identity block:** BEFORE (clean base) = AFTER (`623fc0c0`), byte for byte (`evidence/identity-before.txt`, `identity-after.txt`): every census row, the six producer `--check`s (all exit 0, the same md5s), and the reference ("4 DIFFER", the base's own).
- **Surface census:** re-written three times, each for the new reads only: `CONTACT_FIDELITY` sites 160 → 163,
  `crusherBait.js` `state:vx` / `state:vy` +1 each, `run:entities` +1 (`crushersParked`, already a family it reads).
  `--check` GREEN 357. Constants census PASS.
- **The slow battery** (`jsRuntimeSolverForkRun.slow`): green in both arms.

## Rows to BANK

- leg 855 at OFF: plan 2,505 t, work 560, answer `7fea55beb436`, trace `f8f4f53985c9`, seam-independent over 5277–5283;
  game-correct at 0 px
- leg 855 with all three keys: plan 2,269 t, work 532, answer `86d6c4da7198`; local p4g `done` at 90,107 ms, 2,270 rows
  at 0 px, served at t2262
- the search's duplicate floods at L41: 68,406 / 68,418; the alignment's repeated asks: 57,874 / 96,384
- the bait idle slack at L41: 28 / 123 / 85 ticks (the SEARCHGAPS staging and leg 855 alike)
- bounded vitest md5 `1973cbcc3b7d0aae25db054c3c74241c` (99 files / 3,386)

## CI

`JavaScript Unit Tests` at `623fc0c0` (run 40574096971): **suite 23,698 passed / 0 skipped / 0 failed; slow battery
271 / 271** (`ci-vitest-summary.mjs 623fc0c0`). D1's head (`137a7da8`) and D1b's head (`faafe980`) were green too; D3's
and `6fc189fc`'s runs were cancelled by the next push.
