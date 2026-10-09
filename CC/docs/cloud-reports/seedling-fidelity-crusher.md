# Seedling fidelity CRUSHER — wave 9 (model coverage): L42's crusher and L40's Totem Part (64,144)

| | |
|---|---|
| Session | `seedling-fidelity-crusher` (planner `seedling-fidelity-planning-4`, wave 9) |
| Start SHA | `cf647f39ef` (main before the hammer arc's A2+A3 merge, as briefed) |
| Harness branch | `claude/seedling-crusher-fidelity-qfu391` |
| Head | see the last commit on the branch (this report is committed last) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS for L42 (flag OFF in head; movers measured) · D2 L40 PASS for cost, STOP for the rest (hammer arc's region) · D3 PASS** |

**The one thing to know first.** L42 was solved in R5 and the solver never met the solution. With `CRUSHER_BAIT` on,
the solver searches the bait ORDERING from the live arrival (R5's own nine charges, three chains), drives each chain
from a start a FORK of the run certifies, and solves survey step 85 (1,294 t) and the round trip (1,468 t). The
round trip is game-witnessed at 0 px. The flag is OFF in head and byte-identical off. Turning it on moves one identity
row: the enemy census's `crusher` row's refusal text. L40's two TIMEOUT legs are cost, not walls. Both north
arrivals solve with the dash planner off. An exact flood replacing per-cell A* (byte-identical, no flag) takes one
of them from 262 s to 57 s.

## W0 — bank at base (`cf647f39ef`, pristine detached worktree with every submodule but the wasm builds, symlinked)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9491 bash scripts/procgen/identity-block.sh .` (worktree, its own server) | log md5 **`de3586d19360bc25e96e1ebaa813c396`** |
| six `--check`s | in the block | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec`, all exit 0 (= hammer-A's) |
| other rows | in the block | maze `246dfbce…`, acceptance `608693d2…`, pairs c3 `043e1944…` c6 `f85e7722…` c4 `4aa74add…`, ENEMY census `25417923…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2 `01210c82…` s5 `07ce222a…` s9 `30a1e3e7…`, level pre `e28c1e5d…` post `fb1a59e5…`, generated set OK, reference ALL 7 + 5 MATCH |
| surface / constants / entities / profile | each `--check` | GREEN **220** · PASS **5,414** · PASS **528** · PASS **138** (both) |
| roster | `fixtures/tapes/index.json` | **250** |
| bounded vitest BEFORE | 55 files (the standing set + every `rg -a` hit for `crusherDanger|runBait|STRATEGY_EXECUTORS|OBSTACLE_STRATEGIES|twoPassSolve|'solid:crusher'|L42_SOLVE|crusherVolumesAt|dangerMap`, + `crusher`, `r5Totem`, `botDriverV2`, `tapeRunner`, `surveyFamily`) | **55 files / 2,521 tests, all green**; tapeRunner **557** pairs, md5 `f22d60bd82dc535130ce595eed4a7182` |

The survey (CI 37661110536) was fetched with `survey-seedling-shards.mjs --fetch`. Steps 61, 82 and 85 re-run locally
reproduce the CI refusals word for word. The divergence sweep's rows (CI 37661037829) were downloaded with `gh run download`.

## D1 — measure (PASS)

### L42: the crusher on the game and why the solver had no row

`Crusher` (`crusher.js`, transcribed in R5): always armed (`t == -1`); it grid-snaps at rest and takes a sight line
first (`collideLine("Solid")`, which any Solid shields). It then scans four 64-px lanes, inclusive and
last-match-wins (E, N, W, S). It charges 1 px/tick, never re-aims, and parks against the first Solid. It kills the
player on body contact (1,000). It is not freeze-gated and writes no persistence. L42's two bodies sit across the only corridor to the part.

| question | measured |
|---|---|
| why no row | `OBSTACLE_STRATEGIES['solid:crusher'] = 'bait'` (FRONTIER3), no executor: *"SELECTED but not registered"* (step 85, sweep leg 416) |
| passable by timing (a phase arm)? | **No.** A crusher has no phase; it charges only when it SEES the player and stays where it stops. The room is a PURSUIT; the answer is to PARK both bodies (R5 slice 17) |
| by baiting? | **Yes**, and R5 found it: nine charges in three chains (A W/S/E, B W/N/E, A W/N/E), both bodies parked in the top room, every escape a one-pixel seam (`r5-l42-part4`, game-recorded) |
| the arrival | the survey's step 85 boots at (240,320), the same cell `r5-l42-part4` boots at; the safe component there is 172 nodes (R5's number) |
| the choreographies' start tolerance | the tape prefix to each bait tick, the player nudged: chain 1 survives dy ∈ [-1, 1] (all dx ±3); chain 2 dy ≤ 0.5, **but fails at a periodic set of x offsets** (−2.75, −2.5, −1.25, −0.25, 0.75, 1.75 at the ¼-px grid); chain 3 only dx ∈ [−0.6, 0.2] (fine grid). A tolerance measured on a grid is not a box |
| rest-state granularity | one tap moves 1.70 px at rest, two to four 5.15, five or six 8.75 (a 4×5 box, `previewStepper`): a sub-pixel start is out of reach for alignment |

### L40 Totem Part (64,144): where the time goes

The sweep rows (CI 37661037829) say what the TIMEOUT was:

| leg | arrival | sweep row |
|---|---|---|
| 379 | L42 door (848,16) | `dashless` pass **SOLVED** (1,837 t, verbs hold/kill/walk) in **67 s**; the `full` pass refused at the `walk` deadline; the 90 s leg budget ran out **during playback** (675/1,837 drained) |
| 376 | L41 door (928,96) | **cancelled at 90 s while solving**, no plan |
| 416 (L42) | L40 door | `bait` SELECTED but not registered (the crusher above) |

Node, `probe-seedling-solve-sites.mjs` (new, measure-only: the deadline sites as a profiler), staging = survey step
82's boot view re-pointed at each door, goal `collect:64,144`:

| arrival | dash | verdict | time | where |
|---|---|---|---|---|
| (928,96) | all | REFUSED: *"kill (puncher@816,128) by press: the dwell was HIT at tick 35"* | 204 s | all at **tick 0**: walk 12 s; one 71 s gap (`chooseBodyToRemove`); `kill-chaser` 86 asks × ~2.5 s = 190 s (the stance scan's per-cell `corridorPlans`) |
| (928,96) | all, `kill-chaser` denied | REFUSED: combat ladder exhausted (puncher@816,128, d = 11 inside its leash) | 304 s | `detour` 501 asks / 208 s |
| (848,16) | all | budget (300 s) | 300 s | `sword-dash` 847 asks / 283 s for **32 ticks** of walk (`planSwordDash.evaluateAt` previews, `collidesSolid` over L40's solid list) |
| (848,16) | none | **SOLVED 1,799 t** | 77 s | 53 s in `execKillByPress → deriveStrike → spinnerForecast` (a NW-cluster spinner) |
| (928,96) | none | **SOLVED 1,838 t** | 262 s | `kill-chaser` 210 s, `chooseBodyToRemove` ~56 s (95 % string-pulling in `planWaypoints → controllerPathClear`) |

**The game's route to (64,144)** (R5 `L40_NW`, `L40_CHAIN` link 11): `buttonroom@272,208` self-latch (105 ticks) →
two swings take `breakablerock` 22/24 and 23 → `buttonroom@160,128` → the part. From both north doors, the walk must
first get past `puncher@816,128`, which is 11 px off the only corridor out of the L41 arrival. The solver finds this
order itself (`hold stance (buttonroom@272,208)`). The obstacle the walk must clear first is the puncher, and the
dashless pass clears it.

**Steps 61/82 (the SOUTH door, 480,896) are a different wall.** The arrival needs links 1–10 of R5's 11-link chain.
The frontier's nearest actionable obstacle is `pushableblockfire@576,576` (link 7, whose verb is the pulse, not a
shove). `shove` cannot apply, and `identifyAndSelect` refuses without trying the next actionable obstacle. A scratch
fallback (measured, NOT committed) tries them in order. It reaches link 1 (`chest@880,816`) and refuses there on the
chest chamber's live `spinner@880,848` + `bobsoldier@880,832`: *"the combat ladder is EXHAUSTED"*. That wall is
combat, past this slice.

## D2 — the model/solver

### L42: `bait` as a solver row (PASS; behind `CRUSHER_BAIT`, OFF)

- `crusherBait.js` (new): `searchBaitOrdering` is the R5 proposer (`probe-seedling-r5-l42-solver.mjs`), ported and
  generalised to the room's crusher list. Its player graph is the cells no crusher can see. HOT escapes chain. The
  escape reading is the pessimistic one. The goal is the ROUND TRIP: the aim reached AND the cell the bait began from
  still in the safe component. The memo is keyed on the configuration's cache, which took it from 15.8 s to 3.5 s.
  `chainsOf` groups the charges into chains. `BAIT_CHOREOGRAPHIES` holds R5's three L42 chains, written out and held
  to `r5Totem.L42_SOLVE` field for field by a test: the solver family imports only family files and the door, and
  `r5Totem.js` is neither. `alignmentCandidates` lists rest states within ≤ 3 tap-and-coast moves, every previewed
  tick outside every live lane, nearest first. `crusherSightDanger` is the game's own trigger question.
- `solverBot`: `resolveBaitStrategy` runs the search and looks up each chain. A missing chain is a named refusal
  whose work order is that chain's beam search. `execBait` walks to each stance, tries candidate starts on a
  **fork**, drives the first the fork survives with `botDriverV2.runBait` (now exported), and refuses in its words.
  `frontierExecutor(strategy)` is the frontier's lookup. It is `STRATEGY_EXECUTORS` byte for byte, plus `bait` only
  while the flag is on, and `identifyAndSelect`, `prerequisiteOrder` and the application site ask it. Other readers
  keep the frozen table.
- `solveSegment` takes a new **OPTIONAL** input, `forkRun: () => run`: a fresh run at `boot`. `ctx.fork` replays the
  segment's own ticks and equips onto it. `twoPassSolve` passes `() => makeRun(rows)`. Absent, `ctx.fork` is null and
  `execBait` falls back to the nearest start (measured: chain 2 then fails its positive control). **⇒ the JS arc
  must wire `forkRun`** in the solver worker's `solveSegment` call for leg 416 to move.
- `dangerMap.crusherDanger`: under the flag it asks `crusherSightDanger`: sight line, inclusive lanes, last match;
  any crusher mid-charge is danger. Off, the four rects through walls are unchanged.
- No new `DEADLINE_SITES` row: the bait search is bounded by `BAIT_SEARCH.maxStates` and the fork tries by
  `BAIT_ALIGN.candidates`, both named in refusals. With the flag on it costs ~3.5 s per resolution (L42).

Chains on the survey's arrival: chain 1 aligned 20 t, first fork try; chain 2 11 t, try 4; chain 3 19 t, try 2.

### L40: the scan's cost (PASS, exact, no flag)

`botDriverV2.plansReach(level, allowTeleporter, opts)` gives `planWaypoints`' existence answer as two memoised
floods, forward from one start and reverse into one aim. It mirrors `planTilePath`: ends under no margins,
`nearestGoalNode`'s goal, intermediates at each rung of the margin ladder, the waterfall's directed edge. It returns
null under `snapStart`. It is equal to the A* cell for cell: 1,200 random pairs in L40, L42 and L0 in development, and
in the test every 4th L40 tile plus every L0 tile (both directions there), featherless so the climb rule is live. It
is 60–700× faster. `deriveKillByChaser`'s stance scan asks it for its two per-cell `corridorPlans`, and
`chooseBodyToRemove` asks it for its per-body `planWaypoints` (existence only).

| arrival, dashless | before | after |
|---|---|---|
| (928,96) | SOLVED 1,838 t, 262 s | **SOLVED 1,838 t, 57 s** |
| (848,16) | SOLVED 1,799 t, 77 s | SOLVED 1,799 t, 71 s |

**STOP (cross-arc).** What remains is the hammer-phase arc's region (read-only here). From (848,16), 53 of 71 s is
`execKillByPress → deriveStrike → spinnerForecast`. Under `dashMode: 'all'`, the puncher kill-by-press dwell is hit
at t35 (928,96), and `planSwordDash`'s previews take 283 s for 32 ticks (848,16; not hammer-owned, but a dash-pass
bound would move committed dash plans: not attempted).

## D3 — witnesses + census (PASS)

**Game witness** `crusher-l42-round-trip`: step 85's staging (`plan-seedling-crusher-witness.mjs`, `--check`
byte-identical) with goals [collect `totempart@184,152`, reach-exit `teleporter@240,336`] and the flag on. It runs
1,468 t, 0 crusher contacts, parks (208,96)/(240,96) at the last L42 tick, and crosses into L40.

| check | result |
|---|---|
| `check-seedling-bot-differential --record --only=crusher-l42-round-trip` (p4f, headless, port 9490) | ALL PASS; 1,469 observations, 1 transition, 63 s; game `hits` 0 = model; `hasTotemPart` [F,F,F,F,**T**] = model; `save.time` 10245 = model; 190 dead = 150 pickup + 40 residue in band [29.5, 44.9] |
| model vs the recording | **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"** — 0 px |
| live re-play (no `--record`) | **live game matches the committed oracle stream — ALL CHECKS PASSED** |

### Mutants (predicted first; copy + restore, md5 after restore)

| mutant | predicted | measured | restored |
|---|---|---|---|
| m1 the round-trip term removed from the goal test | a shorter ordering parking in the return corridor, unbanked → refusal; proposer + plan tests red | 5 charges / 2 chains, step 85 refuses naming the unbanked chain; 2 tests red | `crusherBait.js` `19c5307d…` |
| m2 sight-aware danger off under the flag | the walk to the bait stance refused through a wall | *"bait stance … the combat ladder is EXHAUSTED … crusher@128,144 (trigger lane, +y)"*; 2 tests red | `dangerMap.js` `712f4f51…` |
| m3 the fork skipped (nearest candidate) | chain 2 fails | chain 2's positive control: *"the approach ended with every crusher STILL AT REST"*; plan test red | `solverBot.js` `43b302fd…` |
| m4 `plansReach` forward flood without the waterfall rule | the L0 arm red, the L40 arm green | exactly: *"from (88,136) to tile (15,1): expected true to be false"* | `botDriverV2.js` `1a7c9da6…` |

### The survey and sweep rows this moves (before → after)

| row | before (base) | after, flag OFF | after, flag ON |
|---|---|---|---|
| survey step 85 (L42) | REFUSED, *"'bait' SELECTED but not registered"* | identical | **SOLVED 1,294 t**, 0 hits, 6.4 s |
| survey step 61 (L40 south) | REFUSED, `shove` failed to apply (pushableblockfire@576,576) | identical | identical |
| survey step 82 (L40 south) | REFUSED, `collect` failed to apply | identical | identical |
| sweep leg 416 (L42) | failed, `bait` not registered | identical | moves only once the worker passes `forkRun` (JS arc) |
| sweep leg 376 (L40, L41 door) | TIMEOUT 90 s (solving) | dashless solve 262 → 57 s in node (the worker's cut is the JS arc's to re-measure) | same |
| sweep leg 379 (L40, L42 door) | TIMEOUT (67 s solve + playback) | dashless 77 → 71 s in node | same |

## Byte-inertia (flag OFF)

| row | BEFORE | AFTER |
|---|---|---|
| identity block | `de3586d1…` | **`de3586d1…` — byte-identical**, six `--check`s identical (this includes `plansReach`, which has no flag) |
| reference | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH (regenerated for the docs' word counts and the two new scripts' instrument rows) |
| surface / constants / entities / profile | 220 / 5,414 / 528 / 138 | **223** (re-sealed: `crusherBait.js` joins the family; `CRUSHER`, `crusherRect`, `DIRECTIONS` through the door, classified) / 5,414 / 528 / 138 |
| roster | 250 | **251** (`crusher-l42-round-trip`) |
| bounded vitest | 55 files / 2,521, green | **58 files / 2,609; 1 red, named below** (+ `fidelityCrusher` 12, `rosterCategories`, `procgenDocs/generated`) |
| tapeRunner pairs | 557, `f22d60bd…` | **559**, `5152b762…`: the base's 557 unchanged + the witness's two rows |

**Movers with the flag ON** (`SEEDLING_CRUSHER_BAIT=1` identity block, `8551c49e…`): exactly one row,
**ENEMY census default** `25417923…` → `264d960b…`. In `census-seedling-enemies.mjs`'s `crusher` row, the refusal
text changes from the stance ladder's to *"bait crusher@64,16 in level 900 — the ordering search found nothing"*;
the verdict stays REFUSED. No producer `--check`, no committed tape moves. That is the list for the licence.

## The JS arc: pins that move, what it must wire

- **Wire `forkRun`**: an optional `solveSegment` input, `() => run`, a fresh run at the segment's `boot` built as `run`
  was. Without it `execBait` falls back to the nearest start, and L42's chain 2 fails.
- New optional names: `solveSegment`'s `forkRun`, executor `ctx.fork`, `SolverRefusal.obstacle` `{kind: 'solid',
  tag: 'crusher'}` (the existing kind). Contracts and signatures of `solveSegment`, `twoPassSolve`,
  `PendingDeclaration`, `createRunForStaging` are unchanged.
- No `jsRuntime*`, `flashPanel/*`, `wasmArrival`, `wasmWalkTape` or worker file was touched.

## What the brief got wrong (measured)

- *"Is the crusher passable by timing (a phase crossing, like AXE/LADDER2's DODGE PHASE arm)?"* No. A crusher has no
  phase: it charges when it sees the player and stays where it parks. The room is a pursuit solved by parking.
- *"why does `bait` … not run in `solveSegment`"*: no executor, and also the danger map. Even with an executor, the
  walk to the first stance is refused, because `crusherDanger` prices lanes through walls (m2).
- *"L40's arrivals time out instead of finding the part0 chain"*: they DO find the chain (`hold stance
  (buttonroom@272,208)` is the solver's own first order). The time goes to killing `puncher@816,128` at tick 0 and to
  the dash planner. With the dash planner off, both north arrivals solve.
- Steps 61/82 are not the same wall as the sweep's L40 legs. They boot at the SOUTH door and need links 1–10.
- "The committed tapes … boot mid-room": `r5-l42-part4` boots at the survey's exact L42 arrival (240,320).

## Residue

- L40 south door (steps 61/82): the frontier tries only the nearest actionable obstacle, and the chest chamber is a
  combat wall (spinner + bobsoldier). Not started.
- L40 north doors: the spinner kill-by-press cost and the dash-pass costs (the hammer arc's region; the dash planner's
  bound would move committed dash plans).
- `bait` covers rooms whose chains are banked: L42 only. L41's three R5 baits (`L41_PART3`) and L107's crusher (survey
  step 210, a combat-ladder danger) have no library rows. Their work order is a chain search per room.
- The enemy census's synthetic crusher room (level 900): the ordering search finds nothing there.

## Rows to BANK

- Identity block, flag OFF: `de3586d19360bc25e96e1ebaa813c396` (= base). Flag ON: `8551c49e02864686cb68ec01fc544042`
  (ENEMY census `264d960b…`).
- `plan-seedling-crusher-witness --check`: exit 0, all checks green.
- Roster **251**; surface GREEN **223**; constants PASS 5,414; entities 528; profile 138.
- tapeRunner pairs 559, `5152b762cf0a48de8f439a13a8cf01c1`.
- ⛔ **`rosterCategories` "the LIVE row carries one part per derived category"** reads red: the standing-values
  `mechanic` part says 190, and the tree holds 191 with the new tape. Re-sealing it is `standing-values --write`,
  which this slice may not run. **The planner re-seals it at the harvest.** CI at `df0bc2b` also showed it, together
  with three reds fixed after (the reference at `707258a`, the surface census at `4a00494`).
- Game witness `crusher-l42-round-trip`: recorded, re-played (live = oracle), model 0 px.
- Instruments: `probe-seedling-solve-sites.mjs` (measure-only), `plan-seedling-crusher-witness.mjs`.

## Trap candidates

In `seedling-bot-log.md` § *Seedling fidelity CRUSHER*: a solution that exists as a tape is not one the solver can
reach; a tolerance measured on a grid is not a box; a TIMEOUT hides its refusal; ask for existence when existence is
the question.
