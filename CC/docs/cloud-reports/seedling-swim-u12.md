# Seedling swim U12: `Pull.update` transcribed, the funnel ridden, step 24 solved

**Slice:** `seedling-swim-u12`, an Opus build slice run in the cloud for the swim arc (plan §18.5–§18.6, ⚖ Q42, 2026-10-01: one slice). It was the only worker.

| | |
|---|---|
| Started from | `origin/main` @ `14b1a6b945` (the brief's bank commit) |
| Head | this report's commit, on top of D4 `982ad68` |
| Harness branch | `claude/pull-update-transcription-k105fv` (the harness pins it, not `seedling-swim-u12`) |
| Commits | D1 `f0166b8` · D2 `e287e62` · D3 `3b5c741` · D4 `982ad68` · this report |
| Dev server | `scripts/serve-nocache.py 8910`, `SEEDLING_PORT=8910`, build `seedling_bot_ap_p4e` |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at `14b1a6b`. Step 24 refused at U11's wall-5 text in 362.5 s, row md5 `a5d18e6b`. Bounded vitest: 16 files / 1,129 tests. |
| D1 | **PASS, with game witnesses recorded first** | `Pull.update` is stepped (`levelRun.stepPullsNow`, `pull.js`). The game rode the current exactly as the AS3 reading predicted, including the 2-px ticks where the box straddles two cells; the model reproduces both witnesses. Mutant (g): 2 reds at t1. tapeRunner 393/393. |
| D2 | **PASS** | A `reach-pit` leg rides the modelled currents that drain into its pit (`goalRides`). Unit row: the pit flips from unreachable to planned. Mutant (h): U11's wall-5 text, row-identical. |
| D3 | **PASS: step 24 SOLVED 2,419 t; survey 9/9** | Steps 22, 23 and 25–30 are row-identical to the bank. |
| D4 | **PASS** | Log section, bot page, `combat.js` row; reference ALL 7 + 5 MATCH; surface GREEN 189; constants PASS 4,645; profile 136 keys, entities 461 leaves (unchanged); bounded vitest 22 files / 1,406. |

**The one thing to know first.** Step 24 solves, and the survey through 2.2 reads 9/9. The model now steps a body moved by a volume for the first time. That holds only for the PLAYER: a stepped Enemy or Solid on a pull, and a push into a solid, are refused by name, unwitnessed. On L12 nothing reaches either arm.

## W0: the banked rows (at `14b1a6b`, the main tree)

| Row | Result |
|---|---|
| identity block (`identity-block.sh .`) | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…`. **All equal the brief's bank.** |
| generated set | ⚠ The script's run read *"the driver stage is KEPT (exit 1)"*: `ERR_CONNECTION_REFUSED` on `:8000`, because the script's default port has no server in this container. Re-run with `SEEDLING_PORT=8910`: **OK**. |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 46990775`, all exit 0 |
| reference `--check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| campaign census | exit 0, `NO CHAIN ROOM MOVES`, chain 21 of 21 windows, 5,774 ticks; normalised md5 (tree path → `TREE`) `6f7f1e91…` |
| solver surface / constants / tape index | GREEN 187 / PASS 4,632 literals / 166 tapes |
| profile / entity witnesses | both profile tiers name 136 keys; entities 461 leaves |
| step 24 (`--only=24 --timeout=1500`) | **REFUSED in 362.5 s**, U11's text verbatim. The row equals U11's in every field but `ms`/`views`; its md5 is `a5d18e6b`, computed as JS `JSON.stringify` of the row without those two fields, i.e. compact and non-ASCII unescaped. |
| `probe-seedling-u11-wall5.mjs` | ALL PASS: 167 tiles and refused under the solver's bag; 182 tiles and 6 waypoints with `avoidVolumes: false`; three pull exemptions open the pit |
| bounded vitest (the brief's 14 paths) | **16 files / 1,129 tests**, exit 0. Every path matched a file; `combat` and `solverBot` match two each (`combatVerbs`, `solverBotLethalPit`). |
| roster pins, R8, survey 22/23/25–30, chamber, corridor body | quoted from the bank (166/165, 166, 166 ×2; `exposed` 28; the survey rows; 12/12; 143/122) |

## D1: `Pull.update` (`f0166b8`)

### The tick order, as read

`Pull.as` (whole) and `Game.loadlevel` + `World.addUpdate`:

- **(a) Order.** `loadlevel` adds the Player (`Game.as:2227`), then the chasers (`bob` `:2253` … `puncher` `:2277`), then `pull` (`:2329`), then `lock` (`:2333`), `pulser` (`:2334`) and so on. `addUpdate` PREPENDS, so the update list is reverse add order: pulser → lock → **pulls** → arrow traps → crusher → … → chasers → Player.
  - Every pull tests the player's box where the PREVIOUS tick left it, which is exactly an observation. The player's own update this tick starts from the pushed position.
  - The pulls run among themselves in reverse `.oel` order, and each `collideTypesInto`s on its own. A box straddling two cells of one current is therefore pushed TWICE in a frame.
  - No freeze gate: `Game.freezeObjects` does not stop a pull. Only `blackCover` (the dead frames) does, because `super.update()` is not called.
- **(b) A push into a solid** is not undone by `Pull` (no `moveBy`, no solid test); the player's next `moveBy` would start embedded. On L12 it is unreachable: every one of the 14 pushes points into another pull cell or into the pit (checked by the planner script). The model refuses such a push by name.
- **(c) Mid pit-fall** the push still lands. `checkFallingInPit`'s lerp reads `x`/`y` after the write, and the witness shows it (below).
- **(d) `Solid` and `Enemy` are pullable.**
  - No `Solid` on L12 overlaps a pull box, because AABB overlap is strict. Column 34's `rock`/`rock2`/`pole` boxes end at x 560, `dungeonspire@592,640` ends at y 656, and `introchar@560,608` (type `Solid`) ends at y 620.
  - L12's one Enemy is `puncher@416,256`, a sealed room away. The funnel's ONLY entry is (36,40), from the north; its other sides are trees, rocks and poles.
  - **No body arm was taken.** No stepped body on L12 can be brought onto a pull, so the model refuses one by name.

### The step

- `pull.createPulls` builds the room's pulls in update order. It keeps the AS3's own `force * Math.cos(direction)`, so `cos(3π/2)`'s −1.8e−16 stays a term rather than a rounded zero.
- `pull.pushBody` applies them sequentially.
- `levelRun.stepPullsNow` runs in the slot (a) gives, between `stepPulsersNow` and `stepArrowTrapsNow`: above the ceremony's early return, and under `noclip` too.
- `previewStepper` wraps `stepV2` with the same push when the room holds pulls, and is the same closure otherwise.
- **The forecast.** `chaserForecastNow` steps chasers, never the player, and no L12 chaser can reach a pull. The live step refuses a chaser on a pull by name, so the forecast needs no push.
- Refused by name:
  - a stepped chaser overlapping a pull;
  - a room with pulls AND pushables or spinners;
  - a push that leaves the player's box in a solid;
  - a button-fall frozen tick (a path that returns above the slot) in a room with pulls.
- Surface: one entity family, `pulls` (`run.entities('pulls')`), which D2 reads. No ledger kind (the fold's title pins its count).

### The witnesses (`plan-seedling-u12-pull.mjs`, with `--check`)

The keys are a fixed schedule and each tape is emitted before the model is driven. Both were recorded headless on the game (`check-seedling-bot-differential.mjs --record --only=u12-pull-carry,u12-pull-cross`, `SEEDLING_PORT=8910`) **before `stepPullsNow` existed**. That recording read *"THE RECORDING IS VALID AND THE MODEL IS REFUTED — tick 1 differs: expected y=649, got 648"*. The grants are step 24's derived grant: the sword (latched), the shield and `save.keys[0]`.

| tape | prediction (AS3 reading, `predictRide`, independent of `levelRun`) | game | model after D1 |
|---|---|---|---|
| `u12-pull-carry` (boot on `pull@576,640` = (584,648), no key, 100 t) | 1 px/tick south; **2 px on t7, t8, t21, t22** (the 4×5 box straddles 640/656 and 656/672); y 687 at t35 | **exactly that, tick for tick, t1–t35**: 649 … 654, **656, 658**, 659 … 670, **672, 674**, 675 … 687. The edge fires at t35. t36 688.8 (push to 688, then lerp +0.8); t37 690.42 (push to 689.8, then lerp); from t38 (y ≥ 690) the lerp alone. Swap to L21 at **t55**, landing (88,5) | reproduces all 101 observations; the AS3 prediction agrees **35/35** |
| `u12-pull-cross` (boot on `pull@560,720` = (568,728), `up` ×40, 100 t) | x +1/tick while the box overlaps column 35's east currents, on top of the walk north; into column 36's north currents and the pit | x 569, 570 … 574, **576, 578** (two east cells straddled at t7–8), then column 36; the fall-out from t15; swap to L21 at **t34** | reproduces all 101 observations |

### The mutant and parity

- **Mutant (g)** (predicted first: 2 reds, both witnesses at t1, every other row green): `stepPullsNow()` commented out, one build, copied and restored md5-identical (`ed4071e7…`). **Measured: 2 red / 393.** `u12-pull-carry` *"tick 1 differs: expected (x=584, y=649), got (x=584, y=648)"*; `u12-pull-cross` *"tick 1 differs: expected (x=569, y=727.2), got (x=568, y=727.2)"*.
- **Parity:** a scan of every committed expectation found that **20 of the 166 committed tapes enter L12, and no observed tick of any of them overlaps a pull box**. The 20 are `r2-walk-3/4/5/full`, `r3-walk-2/3/4/5/full`, `r4-walk-2/3/4-approach/full`, `u7-puncher-*` ×2, `u9-shield-puncher`, `u10-puncher-dwell*` ×2, `u11-dark-shield-puncher` and `u11-facing-puncher`. Since the pull reads the previous observation, the scan is exact. tapeRunner **393/393** (389 + the two witnesses' two rows each); every older row passes unchanged.
- **Byte-inertia:** generated levels hold no pull (`stepPullsNow` returns on an empty list). See the block at the end.

## D2: the planner rides a modelled funnel (`e287e62`)

**The form.** A per-goal `goalRides`, beside `goalPlanExtra`.
- `execReachPit` fills it with the contact keys of the pulls that (1) drain into the leg's own pit (`pull.pullsDrainingInto`: follow each pull's push cell to cell through other pulls until it reaches the pit) and (2) the model steps for a walking player (`pull.pullModelled`: no solid overlaps the pull's box).
- `walkTo` unions it into every attempt's `contacts`. The plan, the frontier flood and the drive's live volume watch (`drive`'s `avoidVolumes` check) therefore all read the funnel as floor, and the executor's own step, which now models the push, carries the player.
- Why this form:
  - it is the existing exemption mechanism, so no second planner path exists;
  - it exempts nothing outside a pit leg, so every other leg's bag is byte-identical;
  - on L12 every push points the way the walk goes. All 14 currents drain into (36,43), and the only entry, (36,40), is a south current, so the walk is a ride.
- **Settle.** Nothing broke the executor's settle: the drive arrives on the pit tile with the current behind it, and the crossing is accepted on the tile.

**The frontier.** An UNMODELLED pull that is the frontier entity nearest the aim is now named: *"…Obstacle: an unmodelled pull pull@x,y — its box overlaps …"*. It is no longer passed over for the nearest resolvable sub-order. On L12 the arm is vacuous, since all 14 pulls are modelled (`pull.test.js` checks `pullModelled` on L12 and on a fake solid). A modelled pull that does not drain into the leg's pit stays an avoid volume and falls through as before, so mutant (h) can reproduce U11's text.

**Unit row** (`pull.test.js`, the probe re-aimed). From (424,224) under the solver's plan bag plus `allowPit`:
- with no rides, the flood does not reach the pit and `planWaypoints` refuses (*"no walkable tile path"*);
- with the rides, the pit is reached and planned.

**Mutant (h)** (predicted: U11's wall-5 text, byte-identical). `pitRides` returned an empty set, one build in the scratch worktree, restored md5-identical (`5e114289…`). **Measured: REFUSED in 541.1 s, *"reach-pit (36,43)->L21 -> keylock: bosslock@80,656 needs a key this run does not hold. …"*; the row is identical to U11's in every field but `ms`/`views` (`a5d18e6b`).**

## D3: step 24 (`3b5c741`)

Predicted SOLVED in about 2,250–2,500 t. **Measured: SOLVED 2,419 t** (549,978 ms; 4 decisions, 0 re-plans, 0 hits, 1 pass). The walk, replayed through the model (`NewDocs/…/step-24-walk.json`):

| t | event |
|---|---|
| 1781 | `puncher@416,256` killed by a press (180 presses in all, 0 player hits) |
| 1947 | `bosslock@432,240` opens (`keyOpens`); the kill-lock clears `{12,10}`, `{12,5}` are earned |
| 2303 | the first push: the player enters `pull@576,640` at (584.15,637.35) from the north |
| 2303–2320 | 18 pushed ticks: the drive walks south with the current, so the ride is shorter than a standing one (35 t) |
| 2339 | the fall lands in L21 (`transports`) |
| 2419 | on the ground in L21 (the coast) |

`--through=2.2 --only=22,23,24,25,26,27,28,29,30 --timeout=1500 --out=CC/docs/cloud-reports/seedling-swim-u12-survey.json` reads **9/9**:

| step | row md5 (sans `ms`/`views`) U12 | bank (U11) |
|---|---|---|
| 22 | `671973a3` | `671973a3` |
| 23 | `341eb8ba` | `341eb8ba` |
| 24 | **`b9d5b262`** (SOLVED 2,419) | `a5d18e6b` (REFUSED) |
| 25 | `68909100` | `68909100` |
| 26 | `4319c056` | `4319c056` |
| 27 | `1440e6ac` | `1440e6ac` |
| 28 | `643cacb4` | `643cacb4` |
| 29 | `c2facdbc` | `c2facdbc` |
| 30 | `bee5e241` | `bee5e241` |

The route and generator blocks are identical to U11's. The file md5 is `853703ef…`.

## Surface, constants, profile and entity deltas

- **Solver surface:** 187 → **189**, `--check` GREEN.
  - D1 added the entity family `pulls` to the run fold.
  - D2 added `import:pullModelled` and `import:pullsDrainingInto` (class `seedling`, form `function`) through `solverView.js`.
  - The family also gained its `entityBlocks` row (`stationary`, read by `solverBot`) and its line in the surface doc's family table. ⚠ D1's commit owed those two: `entityBlocks.test` was red at `f0166b8` and green from `e287e62`. My D1 bounded set did not include that suite.
- **Constants census:** 4,632 → 4,646 (D1) → **4,645**, PASS, 0 unclassified. The new rows are all `structural`:
  - `pull.js`'s empty tests, unit-axis test and hop bound (a wildcard row);
  - the AS3's own `* 2` in `_d * Math.PI * 2` (`Pull.as:direction`), classified rather than made a profile key, because it is a unit conversion;
  - `previewStepper`'s two empty tests.
  - The D1 → D2 step is one literal of the `pullPushes` ledger, which I removed after D1's census write. D1's committed census was green but carried that row.
- **Profile:** no new key (136 both tiers, `--check` PASS); no witness write owed.
- **Entities:** no new leaf (461, PASS).
- **Reference:** regenerated with the docs index (instruments 302 → 303, the planner script); `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED.
- **Roster:** 166 → **168** (`dialogueAutoAdvance` 168/167 inert, `tapeEnvelope` 168, `observationTolerance` 168 ×2).
  - R8 `exposed` 28 → **30**. Both witnesses are exposed because L12 holds the bridged puncher. They are declared in `exposedAdded` and in the test's three name lists.
  - One `liveSolidOpts` call site is registered in `R8_NORMALIZE_LIVE_BATCH` (`stepPullsNow embed refusal`, `brand`).
  - Tape index 168. No test title moved (`lintGateLabels` green).

## What the brief got wrong (measured)

1. **"+1 px/tick south while overlapping".** Not on every tick. A 4×5 box straddling two cells of one current is pushed by both in the same frame, because each pull tests the box the one before it moved. The game shows 2 px on t7–8 and t21–22. A standing ride from (36,40) to the edge is 35 t, not 40–48.
2. **"The only gap onto the funnel from the north is `pull@576,640`".** It is the only entry from ANY side. West, east and south of the funnel are `rock`/`pole` (column 34), trees (column 38) and trees (rows 46–47).
3. **"Predict … ≈ 2,250–2,500 t" and "the ride (3–4 tiles at 1 px/tick ≈ 48–64 t)".** The total was right (2,419). The ride was 18 pushed ticks, because the drive walks with the current rather than standing in it.
4. **"both locks open ~t2048".** The run's `keyOpens` has one row, `bosslock@432,240` at t1947; the other opening is a kill-lock clear (`{12,10}`/`{12,5}` earned).
5. **W0's "generated set OK".** That holds in this container only with `SEEDLING_PORT=8910`; `identity-block.sh`'s run of `check-seedling-generated-set.mjs` uses the script's default `:8000`. The head's block was run with the variable set.
6. **"forecast (`chaserForecastNow`) … sees it".** The forecast steps chasers, never the player, and no L12 chaser can reach a pull; the live step refuses one by name. Only `previewStepper` needed the push.
7. **"a new run member is a surface row FIRST" for a ledger.** The C4 fold test's title pins the ledger count (*"31 kinds"*), so a ledger kind would have moved a lint-pinned title. None was needed (the witnesses read positions), so none was added.

## Residue

- **The pulled BODY arms are refused, not modelled.** An `Enemy` or `Solid` overlapping a pull, and a room with pulls plus pushables or spinners, each throw by name. No committed or survey room reaches them.
- **A push into a solid** throws by name; no L12 push can make one.
- **A button-fall frozen tick** in a room with pulls throws by name (that path returns above the slot).
- **The frontier's unmodelled-pull naming is vacuous on L12.** It is exercised only through `pullModelled` on a fake world, not through a refusal.
- **A modelled current that does not drain into a pit leg's pit** stays an avoid volume. A non-pit goal that must cross a current sideways would still be refused by its volume, unnamed.
- **The witnesses' CI rate** is unmeasured (one recording each).
- **`standing-values.json`** is not rewritten, per the rules.
- **Scratch instruments** (not committed): `scan.py` (the parity scan over the 166 expectations), `ride.mjs` (the hand prediction), `map.mjs` (the funnel map), `strat.mjs` (the step-24 walk replay), and the two mutant runs' logs.

## Byte-inertia

| Artifact | W0 (`14b1a6b`) | head (`982ad68`, the main tree, `SEEDLING_PORT=8910`) |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` `3910ee23` `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 | `63d34807` `fb207b8e` `bfbdfb38` | **identical** |
| level pre/post s1 | `e28c1e5d` / `c4841acb` | **identical** |
| generated set | OK (re-run with `SEEDLING_PORT=8910`) | OK |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 46990775`, exit 0 | **identical**, exit 0 |
| reference `--check` | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH |
| campaign census | NO CHAIN ROOM MOVES, 5,774 t, `6f7f1e91…` | **identical** (NO CHAIN ROOM MOVES, 5,774 t, `6f7f1e91…`) |
| survey step 24 | REFUSED, `a5d18e6b` | **SOLVED 2,419 t**, `b9d5b262` (the licensed mover) |
| survey 22, 23, 25–30 | the bank's rows | **row-identical** (md5 pairs above) |
| chamber / corridor body | 12/12, 143/122 (quoted) | quoted, not re-measured: no generated room holds a pull, so `stepPullsNow` and `pitRides` are inert there, and the ENEMY census that carries the chamber rows is unchanged (`3910ee23…`) |
| tapeRunner | 389 rows (166 tapes) | **393** (+4: the two witnesses) |
| bounded vitest | 16 files / 1,129 | **22 files / 1,406**, exit 0 (the brief's 14 paths + `pull.test`, `entityBlocks`, `r8Acceptance`, `observationTolerance`, `tapeEnvelope`, `dialogueAutoAdvance`) |
| `fixtures/**` | — | **the two witnesses only** (tape + expectation each) and `tapes/index.json`; `campaign-frontier.json` untouched |

None of the following was touched or run: AS3, wasm, gitlinks, any committed tape or expectation other than the two new witnesses, biome defaults, `standing-values --write`, `pytest`, unfiltered vitest.

## For ⚖ Q40: survey steps 22–30 at the head

Every step boots `staged` from `r8-solve-11`'s committed v8 block (the campaign's post-sword latch), re-pointed at the room. The derived grant is `hasSword` latched and `seam.items.hasShield`, plus `save.keys` as listed.

| step | room (boot) | ticks | keys | a game recording of this survey segment? |
|---|---|---|---|---|
| 22 | L13 (96,48) | SOLVED 48 | [0] | no (`r9-solve-13` is a different L13 segment, 36 t) |
| 23 | L0 (48,192) | SOLVED 229 | [0] | no |
| 24 | L12 (16,80) | **SOLVED 2,419** | [0] | no. The two U12 witnesses record the funnel ride itself, not the 2,419-t walk |
| 25 | L21 (80,80) | SOLVED 26 | [0] | no |
| 26 | L22 (96,16) | SOLVED 89 | [0] | no |
| 27 | L29 (16,224) | SOLVED 383 | [0] | no (`r5-bosskey-leg`, 1,070 t, is another walk) |
| 28 | L31 (384,112) | SOLVED 336 | [0, 1] | no |
| 29 | L30 (176,48) | SOLVED 210 | [0, 1] | no |
| 30 | L32 (72,120) | SOLVED 1,056 | [0, 1] | **yes**: `swim-u5-bobboss-encounter` (1,056 t, U5's game recording) |
