# cloud report — `er-e4a-producer-decoupling` (ER step E4a)

**Branch** `claude/e4a-producer-decoupling-fgp2w8`. **Base** `git merge-base HEAD origin/main` = `26ed405d3f45d3cb86ebae87207035fc08a57e04`
(`train: tile-frontier-route 4c06b906f5`). Neither E2 nor E3 had landed, so I merged `origin/er-e2-schema-loader` (→ `db53ba10`) and
`origin/er-e3-shuffle-core` (→ `d54cea39`). Both merged cleanly.

**Verdict: done, and vanilla is BYTE-IDENTICAL.** No sphere moved, no generated file moved, and no E1 census count moved.

## ⚠ Read first
1. **The `shared` change is delivered as a PATCH: `er-e4a-shared.patch` (repo root).** It is one commit, `72037fc` on local branch
   `er-e4a-traversable-exits`, on top of `733945b`. The outer gitlink is NOT in any of my commits: the tree shows `M frontend/modules/shared`
   and I left it unstaged. **Until you apply the patch and bump the gitlink, two of my test files go red on CI**, because CI checks
   out `733945b`, which has no `computeTraversableExits`:
   - `frontend/modules/procgenPipeline/entranceRandomizationReach.test.js`
   - `scripts/procgen/seedlingErReachBinding.test.js`

   The swap pins and PLACED-TARGET don't need the patch. Order: `git am er-e4a-shared.patch` in archipelago-shared → push → bump.
2. **The brief's "24 shufflable pairs" is an arithmetic slip. The measured number is 25 pairs (50 exits).** The census at my tip gives
   52 stairs doorways = 26 coupled pairs. PIN-CHAIN pins 2 doorways (`L0:out_stairsdown_256_272` + its reverse `L2:out_stairsup_48_16`),
   which is ONE pair, so 26 − 1 = 25. The binding test pins 50 exits.
3. **FINDING for E4b: one stair shares its AP exit.** `L40:out_stairsdown_320_576` is carried by AP exit
   `level_40__r23c29 -> level_43__r13c7` together with 12 screen-edge teleporters to L43 (13 atlas connections merged into one AP exit).
   - A placement names an AP exit by name, so this stair has no name of its own.
   - The binding works around it: it keeps the shared exit and adds the stair as `<AP exit> [L40:out_stairsdown_320_576]`.
   - E4b's compiler must split it into its own AP exit before the mode can write a `placements[]` row for it.
   - A test row pins this finding.

## What changed

### 1. Decoupling (`make-seedling-playthrough-rules.mjs`)
- **New helper `departuresLandingAt(doc, landing, why)`.**
  - A `gameLandings` row `{from, door, level}` is identified by its ARRIVAL exit, `[regionIdFor(level), inExitId(from, door)]`: the
    derivation's own name for the `to` end of that door's connection.
  - The helper returns every doc connection whose `to` is that arrival, as `[{region_id, exit_id}]` in connection order.
  - If none lands there, it refuses by name. A coupled shuffle permutes the arrival exits, so this never fires on a valid layout; it
    keeps the integrity check the three readers had.
- **New `vanillaDepartureOf`**: the retired reading, kept ONLY as the mutant.
- **Fixed readers.** Each takes an injectable `departures` option, defaulting to `departuresLandingAt`:

| reader | before | now |
|---|---|---|
| `playthroughRopeEvents` exitGates (E1 defect 1) | gated the landing's VANILLA door, so a retargeted arrival went ungated | gates every departure whose connection lands in the lane |
| `barrierAnalysis` cut pass (E1 defect 2), shared by `playthroughButtonEvents` and `playthroughInRoomPoleEvents` | vanilla door, plus a "connection → region" check that threw on a swap | the doc's departures. One cut row per departure; sides merge by tile, as before |
| `playthroughObstacleEvents` departure (E1 defect 3) | vanilla door, plus an exact-connection check | the doc's departures |

- **`flashPanel/seedlingObstacleEvents.deriveObstacleEvents`** now takes one departure or an array (`[].concat`); its JSDoc is updated.
  A vanilla single departure gives the same output and the same sort.

### 2. The reader census (re-measured at my tip with E1's own `scanLinkReaders`, plus a grep for `attrs.to` / `LINK_TAGS`)

| line | fn | reads | class |
|---|---|---|---|
| 267 | `doorTilesOf` | gameLandings | **TILES only** (safe): the landing tiles plus the room's own link tiles that a rope lane leaves open. A coupled retarget keeps every room's landing-tile set |
| 640 | `derivePlaythroughLayer` | deriveAtlas | **produces** the vanilla connections. E4b replaces its output with the shuffled doc; every reader below reads the doc |
| 680 | `pitChainsFor` | censusFallsOntoDoors | the room's own links' `@to` (descent census). Its only stairs exposure is the **PIN-CHAIN pair, which stays pinned** |
| 1387 | `playthroughObstacleEvents` | arrivalSolidCensus | rows = landing TILES (safe). Departure **FIXED here** |
| 1431 | obstacle `place` back door | `attrs.to === landing.from` | **geometry** (safe): it finds the pocket of the physical door beside the landing. Under a coupled retarget that door and its pocket are unchanged |
| 1784 / 1890 | `playthroughBlockStoppers` / `barrierAnalysis` | poleKillsOf | the room's combat model (departure side; no link target is read) |
| 1918 | `barrierAnalysis` | buildLevelWorld | the room's own physics (departure side) |
| 1929 | `barrierAnalysis` cut | gameLandings | landing TILES for the floods (safe). Departure **FIXED here**. The pocket's `exits[].to` already read the doc's connections |
| 2139 | `playthroughRopeEvents` | gameLandings | landing TILES for the lane test (safe). Departure **FIXED here** |
| 2195 | `RETURN_SPAWNS` | returnSpawnTable | keyed by arrival TILE (safe) |
| 2241 | `arrivalSpawnFor` | via RETURN_SPAWNS | keyed by arrival TILE (safe). `landingTilesOf` reads the doc's connections |
| 2290 | `playthroughLandingGates` | via RETURN_SPAWNS | **reads the doc's connections** (it iterates `doc.vanilla_layout.connections`); the spawn is keyed by TILE |
| — | `arrivalTilesFor` / `entryGateOf` | derived atlas `to` tiles | TILES only (safe) |

The census pin (`seedlingErDoorCensus.test.js`) still passes unchanged:
- the same readers, and the same stairs-exposed rows;
- 52 / 26 / 26 stairs;
- 65 of 320 cross-level exits gated;
- the same 2 pins.

**No count moved.** The fixed readers still enumerate `gameLandings` for TILES, which is why the scan rows are unchanged.

### 3. Swap pins (`scripts/procgen/seedlingErProducerDecoupling.test.js`, 12 tests, pure)
**The swap** is the E1 design note's coupled retarget, done as a 4-connection permutation:
- D.to := conn(rev E).to, E.to := conn(rev D).to;
- rev D.to := conn(E).to, rev E.to := conn(D).to;
- reverses come from the census.

**Per reader:**
- **Rope.** Two swaps into L17's lane landing, with L5 (E1's own swap) and with L15:
  - the gate moves `level_17/out_stairsup_32_48` → the new departure;
  - the event layer is unchanged.
- **Barrier.** Two swaps into L101's lightpole pocket, with L97 (E1's) and with L99:
  - `playthroughButtonEvents` no longer throws, and its gates are unchanged;
  - the pole gate moves `level_102/out_stairsdown_160_96` → the new departure;
  - every other row of the layer is identical, and so is the rope.
- **Obstacle.** There are no stairs in its domain, so I closed the class on teleporters: a plain two-connection trade with
  `level_1/out_teleporter_64_112`, which lands inside L0's breakablerock.
  - The gate moves to the partner, with the same rule.
  - Two gated departures that trade arrivals trade their gates.

**MUTANTS** (injected `departures: vanillaDepartureOf`): all go red.
- rope: the gate stays on L17;
- obstacle: no move;
- barrier: the pole pass throws `cuts off the side of [level_102/out_stairsdown_160_96], which is not a pocket` — E1 defect 2 in the
  pole path's words.

I also **mutated the SOURCE** (re-pointed each default at `vanillaDepartureOf`): the rope pins (2) and the barrier and obstacle pins (6)
went red. I reverted, and `git diff` confirms it.

**E1's raw uncoupled repro** (two forward connections trade) is now **refused by name** ("not a pocket": the pocket's doors connect two
regions). It is not silently priced. That is correct under Q2.

### 4. Evaluator export (patch) and binding
**`computeTraversableExits(model, inventory, reachableRegions = null, undecided = null) → Set<exitName>`**, beside
`computeReachableRegions`:
- It reuses the module-private `decide`.
- **Undecided = NOT traversable**, which is the walkers' reading. It is the conservative side: counting an undecidable exit as open could
  let GER hang the only way on with an unpriced requirement, and the layout would be unbeatable. Counting it shut can only cost a layout
  that would have worked.
- The pins in `entranceRandomizationReach.test.js` (8 tests) cover:
  - parent reachable + rule held → in the set;
  - unmet rule → out;
  - unreachable parent → out;
  - undecided → out, and recorded.

**`procgenPipeline/entranceRandomizationReach.js`** (`makeRulesDocReach`, `allStateInventory`, `eventItemsOf`):
- It lives in procgenPipeline, not procgenCore, because procgenCore imports nothing.
- **Inventory = GER's single-player all-state:** `itempool_counts[p]` + `starting_items[p]` minus the event items, with events swept to
  the fixed point.
- Each shufflable exit is in the model under its own rule: placed → its target region, unplaced → `null`.
  - The sweep never follows `null`, but traversability still decides it.
  - This is GER's `blocked_connections`: an unconnected exit is placeable once its parent is reached and its rule holds. My first draft
    dropped unplaced exits from `exits`, and E3 deadlocked at stage 1 with "Placeable exits: (none)". Fixed, and pinned.
- It is pure, and refuses by name.

**`scripts/procgen/seedlingErReachBinding.test.js` (10 tests):** E3's `randomizeEntrances` over vanilla AP_1.
- Inputs: 25 pairs; coupled; groups stairsdown↔stairsup; 6 seeds.
- Preconditions asserted:
  - every stair's beside-arrival is in its own departure AP region (0 mismatches), so GER's coupled naming contract holds;
  - vanilla through the binding equals the undisconnected document's reach.
- Every seed: bijection, group-legal, coupled, fully reachable (⊇ vanilla regions and locations), not the identity; deterministic per
  seed, and seed-sensitive.
- **Time per run: seed 1 59 ms, seeds 2–6 44–47 ms.**
- ⚠ Each exit keeps its compiled AP `access_rule`, which still holds the VANILLA landing's conjuncts. Re-pricing those for the shuffled
  doc is the producer re-derivation that §1 makes possible; the mode is E4b.

### 5. `placements[].target`
**Settled:** a target is named by the AP exit it arrives BESIDE (GER's naming: a disconnected two-way exit leaves a same-named target in
its region).
- `{exit: D, target: E}` means D lands where E's reverse lands, the existing arrival exit beside E.
- For a coupled stair this is the paired exit's name. Vanilla = every exit placed at its own reverse.

**PLACED-TARGET** is added to `entranceRandomizationCheck.js`. A target must:
- name exactly one exit of the player;
- have `er.shuffle: true`;
- have the same `er.type` as the placed exit;
- be of a group the placed exit's `target_group_lookup` row allows;
- be used at most once.

Each clause has a mutant (5). The clean fixture still passes, and so do E2's suites: 39 tests across Check, RoundTrip and load.

I did not add a coupled-mirror rule ({D,E} ⇒ {E,D}), because E2's fixture lists one direction only. It is a candidate for E4b.

## Gates
- **Producers `--check`:** all OK.
  - `make-seedling-playthrough-rules.mjs --check`: atlas OK, AP_1 OK. Seed-1 summary unchanged (8 obstacle / 7 button / 4 pole / 2 rope
    events, 1 lane landing gated).
  - `make-seedling-subregion-partition.mjs --check`: OK.
  - `make-seedling-playthrough-maze.mjs --check`: OK, byte-identical.
- **World package:** regenerated with `--force --canonical-seed 1`, and `git status worlds/` is clean.
- **Seed 1:** `Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 1` (minimal-spoilers) →
  `AP_14089154938208861744`. No tracked file changed, and no apquest or `preset_files.json` dirt.
- **`census-seedling-constants.mjs --write`:** no diff.
- **`generate-procgen-reference.mjs`, then `--check`:** **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE.** I added only
  `*.test.js` under `scripts/procgen/`; the index did not change.
- **Bounded vitest: 108 files, 2058 tests, all passed (266 s).** The run covered:
  - every non-slow test file that greps for the playthrough atlas, the maze preset, AP_1, the producers, `seedlingObstacleEvents`,
    `entranceRandomization*` or `forwardSimulator`;
  - plus `boxLock`, `checkProcgenHelp`, `seedlingConstantsCensus`, `seedlingErDoorCensus`, the no-retired-docs-path test (`scripts/test/noN…References.test.js`), E3's
    `entranceRandomizer.test.js` and my 3 new files.
  - The slow/train `deriveLevelWorldLogic` pins were not run; the maze they read is byte-identical.
- **E1 census at my tip:** its pin passes. No count moved.

## Out of scope (E4b)
The mode, steps, CLI, panel, classifier, preset, editor cascade and relayout builders. The L40 split above is E4b's.
