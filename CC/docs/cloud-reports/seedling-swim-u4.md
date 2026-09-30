# Seedling swim U4: R-o, L12's puncher (measured → STOP) · the pit-throw class becomes levels · the AVOID text · the survey

**Slice:** `seedling-swim-u4`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §15). A sibling, `seedling-swim-u4b`, ran in parallel on the kill rung (`deriveRefuge`, `stepToward`, `clearOfHammersAt`, `execKillByPress`, the press executor's refusals). None of those functions were edited here.

| | |
|---|---|
| Started from | `origin/main` @ `e048567718` (the brief's expected SHA; the harness branch already sat on it) |
| Harness branch | `claude/seedling-swim-u4-bna32f` |
| Commits | D2 `bac0e48` · D3 `ce7ba88` · D4 `064ed88` (survey JSON) · D5 `5f225d7` · this report. D1 is read-only: its record is this report. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduces the brief's, c4 `3bacdc9e…` included. The corridor-body sweep has 10 THREW, as U3 found. |
| D1 | **STOP** | The pit is reachable only through two keyType-0 locks, and the puncher (a chaser in the game, range 80) can reach every stance of either. The model admits a stance clear of the priced body under the *second* lock, but only because it holds the puncher still. The design is below, not built. |
| D2 | **PASS** | The 10 throws came from a **preview**, not the walk: 6 pits and 4 **drownings**, so U3's "one pit class" was two. Truncating a preview at a lethal fall or a latched drown turns all 10 into levels, **all placed and certified**. THREW 10 → 0, and 156 of 168 cells are byte-identical. |
| D3 | **PASS** | `danger:puncher@416,256 (a static "Enemy" body) at (418,260)`, never `undefined`. |
| D4 | **PASS, 7/9** | Step 24 is REFUSED by the predicted name in 310.6 s under a 600 s bound (this row only). 22, 23 and 25–30 are identical to U2's. |
| D5 | **PASS** | The log section, the bot-page sentences, the reference and docs index regenerated, surface GREEN 185, bounded vitest 15 / 456. |

**The one thing to know first.** L12's puncher is not a solver wall that a better stance can route around. The model's route exists (under `bosslock@432,240`) only because the model holds a chasing enemy still, so step 24 needs the puncher transcribed as a chaser (simulation work). Separately, the generator's pit "engine throws" were a solver *preview* bug, not a pit class, and they are gone.

## W0: the banked rows (clean tree `e048567718`, `SEEDLING_PORT=8840`)

| Row | Result |
|---|---|
| identity block | maze `246dfbce…`, acceptance `4330bad7…`, c3 `fa0dc4bb…`, c6 `f5c9ece7…`, **c4 `3bacdc9e…`**, ENEMY `4ce6c5b3…`, guard `a6d18d49…`, AREA `06b14d5d…`, killgate s2/s5/s9 `1b4eab8e…`/`b018ab2b…`/`65e81dd3…`, level pre/post s1 `e28c1e5d…`/`9219ff91…`, generated set OK, reference ALL 7 + 5 MATCH |
| six r8/r9 `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, all exit 0 |
| campaign census | `88fa2333013aaabb84298f0f4fd5d72a`, exit 0, `NO CHAIN ROOM MOVES` |
| survey derive / route | default `27ff43db…` / `1e08f9ad…`; through-2.2 `1172328c…` / `dae52ec7…` |
| surface / constants | GREEN 185 / PASS |
| bounded vitest (the brief's seven paths) | **14 files / 451 tests**, green |
| corridor-body sweep, post-sword (U3's command, run as three kind-partitions in parallel) | 168 cells: **136 placed / 75 certified**; named 59 × roaming + 2 × per-target; 22 `wall-does-not-seal`; **10 THREW**; 10 TIMEOUT |
| roam sweep (F1b's command) | post-sword 10 / 8 / 2 named, **3 THREW** (pit); pre-sword 10 / 8 / 2, 0 THREW |

⚠ **The corridor-body W0 is one cell off U3's 137/76.** U3 had 9 TIMEOUT and I had 10: one certified cell outran the 120 s harness bound under a 4-way parallel load. That is the harness, not a verdict, and it came back in the AFTER run. The sweep's md5 is not an identity (its tables carry wall-clock columns), so rows are compared cell by cell on the JSON, with `cellMs`/`genMs`/`maxSolveMs` stripped.

**The 10 THREW cells** (every one a `GenerationAborted` around a `PhysicsV2Error` from a pass-2 candidate's solve):

| cell | placing | the engine said |
|---|---|---|
| branchy 10x10 s1 | water-pool(3,1) (6,8) | fell into a pit in level 900, which has NO control block |
| branchy 10x10 s6 | wall-segment(v,2) (3,2) | **DROWNED** |
| branchy 10x10 s12 | wall-segment(v,3) (2,4) | pit |
| branchy 14x14 s9 | pit-patch(2,1) (2,3) | pit |
| loopy 10x10 s11 | water-pool(1,1) (3,3) | **DROWNED** |
| loopy 14x14 s6 | pit-patch(2,2) (2,3) | pit |
| open 14x14 s5 | pit-patch(1,1) (2,5) | pit |
| open 14x14 s9 | pit-patch(2,2) (1,5) | pit |
| winding 10x10 s9 | water-pool(2,1) (1,7) | **DROWNED** |
| winding 14x14 s2 | water-pool(1,1) (7,7) | **DROWNED** |

## D1: R-o, L12's puncher — the measurement (read-only) → **STOP**

Instruments (session scratchpad): `stage24.mjs` (the survey's own staging of step 24: `r8-solve-11`'s block re-pointed at L12 (16,80), `save.keys [0]`, `seam.items.hasShield`, the timed clears stripped), `geo12.mjs`, `flood12.mjs`, `danger12.mjs`, and a `--cpu-prof` run of the survey's own `--step=24` child.

### (a) Geometry

| thing | measured |
|---|---|
| `bosslock@416,240` | rect (416,240)–(432,256), keyLine y=257, x 418..427, keyType 0 |
| **`bosslock@432,240`** (the brief did not name it) | rect (432,240)–(448,256), keyLine y=257, x 434..443, **keyType 0 as well** |
| `puncher@416,256` | census (416,256), centre (424,264) = the centre of tile (26,16), directly below `bosslock@416,240` |
| player box | 4×5 (`HITBOX` origin 2,2); pinned under a lock the box is y 256..261 (centre y 258) |
| flood from the arrival (16,80), 4-connected, player box at tile centres, `plannerBlockerAt` | **locks shut: 833 tiles, no pit neighbour. Locks open: 1028 tiles, all four neighbours of pit (36,43) reached.** |

The locks are tiles (26,15) and (27,15). The whole east region, the pit (36,43) included, is reachable only through them. **No route to the pit avoids the locks.** The approach to either lock is the row-16/17 corridor running under the puncher's tile.

### (b) The danger at the keylock stance

The danger map prices the puncher as **ingredient (e)**, a static `"Enemy"` body at its placement: `dangerVolumes` gives ONE volume, `puncher@416,256`, rect **(418,260)–(430,272), the bare 12×12 body, with no `threatPad` and no punch box.** The brief's premise (box + `threatPad 8` + punch r = 8) is not what is priced; `threatPad` is added only to STEPPED chasers (ingredient (c)).

| stance (pinned, centre) | box | overlap with the priced body |
|---|---|---|
| under `bosslock@416,240`, x 417..429 | x−2..x+2, y 256..261 | **x overlap 1..4 px, y overlap 1 px: inside, at every x** |
| the stance the solver aimed at: (424,264) | the puncher's own tile centre | the AVOID goal tile (26,16) *is* the puncher's tile |
| under `bosslock@432,240`, x 433..445 | x−2..x+2, y 256..261 | **clear by 1..13 px in x** |
| same, against body + `threatPad 8` (410..438) | | clear only for x ≥ 441 |

So, **in the model**, the second lock's stance is clear of the priced volume. The solver never considered it: the corridor's first solid is `bosslock@416,240`, and the keylock stance is derived for the obstacle the frontier names.

### (c) `chaserRoomVerdict(12)`

**`{stepped: true, why: null}`**. The brief expected `false` ("arrow traps whose static bodies stand in a lane"). L12 has no bridged chaser, so the verdict is vacuously stepped and `chooseBodyToRemove`'s static half is **empty** (`statics = stepped ? [] : …`). The puncher is priced as danger (the danger map's own "this room is stepped, so this class is unbridged and does not move") and is **not a removal hypothesis at all**: BAIT and KILL both refuse on an empty roster, which is exactly the EXHAUSTED text.

### (d) Where the 347 s goes

The survey's own `--step=24 --through=2.2` child under `node --cpu-prof` (5 ms sampling): **REFUSED at 345.2 s**, 345.4 s sampled.

| inclusive | s | share |
|---|---|---|
| `walkTo` / `solveSegment` / `twoPassSolve` | 339.6 | 98% |
| **`planSwordDash` → `evaluateAt` → `previewFor` → `previewWalk`** | **323.6** | **94%** |
| `planWaypoints` | 15.3 | 4% |
| `climbLadder` (all rungs) | 4.6 | 1% |
| `deriveKeylockStance` / `stanceReaches` | 3.8 / 5.1 | 1% |

Self time: `collidesSolid` 134.6 s, `liveRectOf` 102.5 s, `nearestWalkableTileWithTie` 44.0 s. **The time is the sword-dash planner previewing the 1876-tick walk to the lock, not the ladder or its re-plans.** It is a `--timeout` question for the survey (D4 raises the bound for this row only), and a dash-planner cost question, not a rung loop.

### The verdict: **STOP**

The brief's ROUTE test is "a stance the puncher cannot reach exists". The model admits one (under `bosslock@432,240`, x ≥ 433; x ≥ 441 even against the pad), but **the puncher can reach it**. `ENEMY_CLASSES.puncher` is `aggro: chase, range 80, speed 1`. The stance centre (440,258) is 17.1 px from the puncher's centre, the key wait is `keyTimer 60` + the fade (80 ticks by `opensOnKeyTick`), and the whole approach corridor runs inside the leash. The model holds the body still only because it has no puncher physics. A route certified there would be certified against a body the game moves, and the wasm witness would refute it. Building it would make step 24 "SOLVED" in a sense the game denies, so no ROUTE was built.

**The design (NOT built):**
1. **The chase.** A `CHASERS.puncher` row in `chasers.js`, transcribing `Enemies/Puncher.as` (Bob-derived: `runRange` 80, speed 1, `targetOffset`, `freezesOnGameFreeze`, the die animation, `solidsMover`), and a `spinner.MODELLED_ENEMY_CLASSES.Puncher` row naming `chasers.js`. Together those put `puncher` in `bridgedChaserTags()`. The danger map then prices it as ingredient (c), at its live position, grown `bound × horizon + threatPad 8`, rather than as (e).
2. **The punch.** The attack state machine, NOT shared with Bob: `attackRange` 10 decides, and the punch box is `r = 8` off the body edge (`Puncher.as:201`), damage 1. This is the new simulation, and the reason `KILL_ARM_POLICY.Puncher` says "the Bob cost".
3. **The death.** `kill.hits 3` observed through the chaser kill arm, then `KILL_ARM_POLICY.Puncher` → `modelled`.
4. **Parity first.** Per-tick agreement with the wasm witness on L12 and on L40 (two punchers, no leg presses), before any solve uses the arm.
5. **Then step 24:** a live, removable body. The chaser arm (3 sword hits) or BAIT opens the corridor, and either lock's stance becomes reachable.

## D2: the pit-throw class becomes levels (`bac0e48`)

**The replay** (`open 14x14 s5`, in an instrumented copy of the module tree under the scratchpad: a stderr line at the physics' fall start, plus the full cause stack):

- **Not the walk, and not knockback.** The throw's stack is `procgenOracle.solve → solveSegment → walkTo → climbLadder → execKillByPress → deriveRefuge → previewWalk → run.previewStepper → step → fallDestination`.
- `deriveRefuge` previews a **straight walk** to each clear candidate cell, with no A\* path, so the planner's pit wall never applies. The preview held `right+down` at (42.5, 79.1) with v = (1.47, 1.47) and cut a corner onto pit tile (2,5).
- 20 ticks into the fall, the preview's own step called `fallDestination`, which threw. The same stack produced the drownings, over a `water-pool`.
- My prediction before the replay was class (i), knockback. The measurement is class (ii), a walk stepping on the tile by its own keys, but inside a candidate preview.

**The layer and the fix.** The narrowest place is `previewWalk` (not in U4b's list; `deriveRefuge` itself is untouched). After each stepped tick it asks whether the preview has died:
- a fall began (`state.fall.phase === 'out'`) and the model's own `fallDestination` throws for its target: `truncated = {kind: 'lethal-pit', …}`;
- `drown.drowning` latched during the preview: `{kind: 'drowned', …}`. A drown already latched at the preview's start belongs to the live run and is left to it.

Both deaths are irreversible from that tick: the fall drops the keys, and `drown()` runs to `die()`. Every caller already treats a truncated preview as a walk it cannot take: the refuge and strike searches skip the candidate, the chaser-arm stance search rejects it, and the dash planner refuses the dash. A transport pit keeps its old path to `crossed`.

**Why it grew from pit to pit+drown, measured.** The first cut handled the pit only. AFTER-B then still threw twice: `loopy 10x10 s11` (a W0 drowning), and `loopy 14x14 s6`, which got past its old pit and drowned later. The drown arm closed both.

**Yield, post-sword, 168 cells, W0 → AFTER:**

| | W0 | AFTER |
|---|---|---|
| PLACED / CERTIFIED | 136 / 75 | **137 / 76** |
| named refusals | 59 roaming + 2 per-target | 59 + 2 (identical) |
| geometry | 22 `wall-does-not-seal` | 22 |
| THREW | **10** | **0** |
| TIMEOUT (120 s harness) | 10 | 9 |
| ablation COSTS / INERT | 43 / 19 | 54 / 19 |

Per cell, 156 of 168 are byte-identical. The 12 that moved, and why:
- 9 × THREW → generates, placed and certified. The THREW cells were already counted in PLACED/CERTIFIED at W0, because the element's certification precedes pass 2; what changed is that their ablations now complete. Hence COSTS +11 with placed barely moving.
- 1 × THREW → TIMEOUT: `branchy 14x14 s9` now runs past the point where it used to abort. Solo with `--cellbudget=1200` it **generates, placed and certified, in 137 s**.
- 2 × TIMEOUT → generates (`open 14x14 s12`, `winding 14x14 s9`): load, not the fix.

**No named refusal was needed.** Every former throw certifies, so no gap name was added and the elements catalogue is unchanged.

**Roam, post-sword:** its 3 THREW cells (all pit) generate; the roam block stays **10 / 8 / 2**, the brief's byte-inertia claim. Every other cell is identical to W0. This was measured twice, once from the copy and once from the tree, with 0 cells differing between the two runs.
⚠ A first AFTER roam run from the copy came back **cell-for-cell identical to W0**, three throws included, though it started after the fix was on disk. I could not explain it, and both re-runs disagree with it, so it is recorded here and discarded.

**Mutant (a):** `lethalFloorOf` forced to return null. Predicted: the 10 THREW rows return byte-identical. Measured: **10/10 BYTE-IDENTICAL** to W0's error rows. Restored md5-identical (`9febb660…`), tree clean.

**Unit rows:** `solverBotLethalPit.test.js` (4). L4's pit (5,4) is lethal by `fallDestination`, and a straight preview into it truncates as `lethal-pit` in under 20 samples; the live run is untouched; L0's lake with no conch truncates as `drowned`. At the pre-fix tree both preview calls THROW `PhysicsV2Error` (measured).

**Identity rows moved:** none. The identity block, the six `--check`s, the campaign census and both derive pairs are identical after D2+D3 (below).

## D3: the AVOID text (`ce7ba88`)

`botDriverV2.describe` gains an arm for a volume carrying `id` + `rect` and no `tag`: `${kind}:${id} (${why}) at (rect.x,rect.y)`. Step 24's AVOID line now reads *"… is not walkable: danger:puncher@416,256 (a static "Enemy" body) at (418,260). …"*. Unit row in `botDriverV2.test.js`, with a count-free title. Mutant, the arm disabled: the row reds on the old sentence; restored md5-identical (`c8610001…`). No committed artifact carried `danger undefined`.

## D4: the survey (`064ed88`, `CC/docs/cloud-reports/seedling-swim-u4-survey.json`, md5 `16c3c2dd504301b3b006260ce74f9024`)

**Why the bound was raised for row 24 only:** the refusal costs 310–345 s, and 94% of that is `planSwordDash` previews (D1 (d)). At 180 s it could only ever read TIMEOUT, and the name is the measurement.

| step | room | predicted | measured (verbatim) |
|---|---|---|---|
| 22 | L13 | SOLVED 48 | SOLVED 48 ticks |
| 23 | L0 | SOLVED 229 | SOLVED 229 ticks |
| 24 | L12 | REFUSED by the puncher name inside 600 s, AVOID line with the D3 text | **REFUSED, 310.6 s**: `reach-pit (36,43)->L21 -> keylock stance (bosslock@416,240): the combat ladder is EXHAUSTED. The corridor passes through danger at (431.6,263.8) — enemy:puncher@416,256 (a static "Enemy" body at its placement (this room is stepped, so this class is unbridged and does not move), priced "mover" by `contactPricing`) …` avoid: `… is not walkable: danger:puncher@416,256 (a static "Enemy" body) at (418,260). …` |
| 25 | L21 | SOLVED 26 | SOLVED 26 ticks |
| 26 | L22 | SOLVED 89 | SOLVED 89 ticks |
| 27 | L29 | SOLVED 383 | SOLVED 383 ticks |
| 28 | L31 | SOLVED 336 | SOLVED 336 ticks |
| 29 | L30 | SOLVED 210 | SOLVED 210 ticks |
| 30 | L32 | R-f | REFUSED `collect-placement (64,128) resolves to NOTHING in level 32 …` |

Every row other than 24 has the same verdict, ticks and refusal text as U2's JSON. Step 24's text differs from the pre-D3 measurement only in the AVOID line: the D3 sentence, plus the rung's existing 200-character slice cutting the tail sooner.

## HEADLINE: 7/9

## Surface table delta

185 → 185 rows, `--check` GREEN after `--write`. Site counts only: `run:level` 84→86, `run:state` 262→263, `run:world` 168→169, `import fallDestination` 1→2, `import PhysicsV2Error` 2→3. The existing `state:drown` row (seedling / live-state, until now seen only dynamically) gains its first static site. No new row to classify. `census-seedling-constants --check` PASS.

## What the brief got wrong (measured)

1. **`chaserRoomVerdict(12)` is `stepped: true`**, not false: L12 has no bridged chaser, so the verdict is vacuously stepped. The consequence is that `chooseBodyToRemove`'s static census is empty in L12, not that the puncher is hypothesised statically.
2. **The priced volume is the bare 12×12 body.** It is not body + `threatPad 8` + the punch box: the pad applies only to stepped chasers.
3. **There are two keyType-0 locks**, `bosslock@416,240` and `bosslock@432,240`.
4. **"The 10 THREW are one pit class"** (U3 § D3): they are 6 pits and 4 drownings. **"A dodge or knockback near a body"**: they are a straight-line refuge *preview* cutting a corner, and the certification walk never touched the tile.
5. **"The corridor body's 137 placed unchanged":** the THREW cells were already inside PLACED, so fixing them moves the ablation columns, not placed. W0 read 136 only because of a load-induced TIMEOUT.
6. **"347 s: the ladder's rungs × the corridor re-plans":** the ladder is 1%; the sword-dash planner's previews are 94%.
7. **The AVOID text's region** is `botDriverV2.describe` (~`:659`), not `:670`.

## Residue

- **R-o is a simulation slice** (the design above). Step 24 stays REFUSED by name until the puncher is a stepped class.
- **`planSwordDash`'s cost:** 323 s previewing one 1876-tick walk. A cost question for whoever owns the dash planner.
- **`deriveRefuge` previews straight lines**, not planned paths (U4b's function). A lethal-floor candidate is now skipped rather than fatal, but the refuge search could plan around pits in the first place.
- **The discarded AFTER roam run** (D2) is unexplained.
- **Scratch instruments** (session scratchpad): `stage24.mjs`, `geo12.mjs`, `flood12.mjs`, `danger12.mjs`, `prof.mjs` + the CPU profile, `sweepcell.mjs` (a cell runner that prints the cause stack), `tally.mjs`, `l4pit.mjs`, `l0drown.mjs`, `mutant.sh`, `bank.sh`, and the instrumented module copy.

## Byte-inertia

| Artifact | W0 (`e048567718`) | after D2+D3 (`ce7ba88`) |
|---|---|---|
| identity block (13 md5 rows + generated set) | as above | `diff`-identical |
| six r8/r9 `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | identical |
| campaign census | `88fa2333…`, NO CHAIN ROOM MOVES | identical |
| survey derive / route, default | `27ff43db…` / `1e08f9ad…` | identical |
| survey derive / route, through-2.2 | `1172328c…` / `dae52ec7…` | identical |
| reference `--check` | ALL MATCH | ALL MATCH after D5's regeneration (the only drift was D5's own doc word counts) |
| solver surface | GREEN 185 | GREEN 185 |
| bounded vitest (seven paths) | 14 / 451 | 15 / 456 (+ `solverBotLethalPit`, + D3's row) |
| `fixtures/**`, `campaign-frontier.json` | — | untouched (`git diff origin/main` names no file there) |

No AS3, wasm, gitlink, tape, biome default, `standing-values --write`, `pytest` or unfiltered vitest was touched or run. No simulation file was edited: the fall/drown instrumentation lived only in the scratchpad copy. None of U4b's functions were edited.

⚠ **The worker restarted once** mid-slice, while a bounded vitest run was going (exit 137, probably memory under five heavy processes). The run was repeated alone and passed; the interrupted AFTER-A sweep was re-run in full.
