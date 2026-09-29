# Seedling swim S1: the generator learns to swim (cloud report)

`seedling-swim-s1` is a cloud fan-out build of plan `seedling-swim-plan.md` (the ⚖ Q2/Q4/Q5 rulings as briefed). This file is the report the coordinator reviews. The as-built record is § *Seedling substrate S1-swim* in `docs/json/developer/procgen/seedling-bot-log.md`.

- **Started from:** `34f32cf324` (`origin/main`, 2026-09-29). Note that the brief's measurements were taken at `7a46822554`, and W0 reproduces them here unchanged.
- **Branch:** `claude/seedling-swim-s1-zwbfsw`. The brief named `fanout/seedling-swim-s1`, but the cloud harness only allows pushes to its designated branch.
- **Head:** the commit that adds this file, directly after `f12aa85`.
- **Commits, one per D:**
  - `ad28b55` D1
  - `1b14d2f` D2
  - `76e8700` D3
  - `29b3e24` D4
  - `f12aa85` D7 records
  - this report

  D5 and D6 are measurements and carry no code.

## W0: the witness, on the shipped file (verbatim)

The room is an 8×6 `empty` post-sword room at seed 1 with bounds 1/1/1. Tiles (2, 1..4) are repainted to `[tx, ty, 32, 0]`, which makes a 1-wide water column between the boot (1,1) and the goal (3,4). It is solved with `createRunForStaging(solveStaging(bootStaging(…)))` and `solveSegment(… DEFAULT_BUDGET.maxTicksPerTarget)` (scratch `w0.mjs`, committed as `procgenSwimSolver.test.js`).

| arm | shipped `solveSegment` | with `inventory` and `noHazards` in `solverPlanOpts` |
|---|---|---|
| A: no conch, `pins: ['dead_frames','sound']` | `SolverRefusal: … no corridor … Obstacle: no-corridor … separated by water, a pixelmask or a teleporter volume` | REFUSED (same text) |
| B: `canSwim`, `sound` pinned | REFUSED (same) | **SOLVED 71 t**, `{"timer":0,"drowning":false}` |
| C: `canSwim`, NO `sound` pin | REFUSED (same) | **`PhysicsV2Error: the player entered Water in level 900 at (32.28…, 32.28…) on a tape that does not pin "sound"`** |

This is exactly the table in the brief.

## The identity block: BEFORE (pristine `34f32cf` worktree) and AFTER (`29b3e24`)

The command is `bash scripts/procgen/identity-block.sh <tree>`. This is the committed derivation, since S1's §5.2 plan text is not in the clone. It took 4 min 3 s BEFORE and 4 min 1 s AFTER.

| row | BEFORE | AFTER |
|---|---|---|
| maze byte-identity | `677b7d9cae51023e82fa2e365a8095dc` | identical |
| acceptance batch | `4330bad70290dd18d94b11ca5b0bc5cb` | identical |
| empty pairs c3 | `fa0dc4bb1f9495cfe6eec8b710efccfc` | identical |
| empty pairs c6 | `f5c9ece7641978ad9a56032c488f18fe` | identical |
| carved pairs c4 | `8c972028c1de2345e13264bd546ac90e` | identical |
| ENEMY census default | `4ce6c5b3f44fbd9c26bb7a25d72bb647` | identical |
| guard census (elements) | `a6d18d49ae256c321d175f45ec76dccc` | identical |
| AREA census default | `06b14d5d57428ae7fcb248060a8d492e` | identical |
| killgate s2 | `1b4eab8ed32b8e709fe5fef6232e21d2` | identical |
| killgate s5 | `b018ab2bdb126f435e3913c13bb266f2` | identical |
| killgate s9 | `65e81dd332a26b0d6f591717055eff55` | identical |
| level pre-sword s1 | `e28c1e5d6522dcca4682c44e7333a32f` | identical |
| level post-sword s1 | `9219ff9131427fb727004036a20e255b` | identical |
| r8-battery `--check` | `410f27c077b1ee854a14c24b73dc6335` exit 0 | identical, exit 0 |
| r8-d2-chain `--check` | `b470c14d1d272fb7d0e03fdcde9cf20e` exit 0 | identical, exit 0 |
| r8-l18 `--check` | `17be7d70e7bf116f9c3438de04be6b15` exit 0 | identical, exit 0 |
| r8-tail `--check` | `9a6a31925cb5204eee4cb0ad66febed6` exit 0 | identical, exit 0 |
| r9-l3 `--check` | `6cd35fe1414af6bf5beb7605f235cb8e` exit 0 | identical, exit 0 |
| r9-campaign `--check` | `2823a8112d1cb76e6d0324a5cf713085` exit 0 | identical, exit 0 |
| generated set¹ | `OK`, exit 0 | `OK`, exit 0 (`--seeds=1-6` and the default) |
| reference `--check`² | (see ²) | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` at `f12aa85` |

¹ `identity-block.sh` runs this row against `:8000`, and the sandbox serves on 8500/8501. I measured it separately with `SEEDLING_PORT=8501` (pristine) and `SEEDLING_PORT=8500` (this tree), with the venv active. One line differs between runs: *"walking into room 2's door … tick N"*. It is noise, not a mover. Pristine alone read 26, 25 and 27 over three runs, and this tree read 25, 26 and 26.

² At the pristine worktree the reference `--check` read `4 … DIFFER` (`registry.js`, `capabilities.js` and two substrate-chart regions). That was the worktree: the bootstrap's `--seedling` leaves four game submodules uninitialised. After `session_bootstrap.sh --all`, this tree passes those four. Only `urlGrammar.js` and `catalogue.js` then differed, from my new heads and biome, and D7 regenerated them.

## Per D

### D1: the solver line. PASS

- **What landed:** `solverBot.solverPlanOpts` now passes `inventory: run.inventory, noHazards: run.noHazards` (⚖ Q2: both). The rows are in `procgenSwimSolver.test.js`: arm A REFUSED, arm B SOLVED 71 t, arm C THREW `PhysicsV2Error`.
- **Gates:**
  - The identity block is identical (above).
  - `node scripts/procgen/solve-seedling-r8-d2.mjs --check` gives `f2cfe3f99f919e769e6b0a102b796c45` BEFORE and AFTER, exit 0.
  - `node scripts/procgen/census-seedling-campaign.mjs` exits 0 and its output is byte-identical BEFORE and AFTER, apart from one trailing blank line from my `time` wrapper. 42 `CONTINUES`, and `⇒ NO CHAIN ROOM MOVES`. ⚠ It prints **no `ALL PASS` line**: it is a report, not a pass/fail gate, so the brief's "ALL PASS" is not a string it emits.
- **The r8 battery, compared to its banked row** (`standing-values.json`, no `--write`):

  | producer | banked | measured |
  |---|---|---|
  | battery | `410f27c0…` | `410f27c0…` |
  | d2-chain | `b470c14d…` | `b470c14d…` |
  | l18 | `17be7d70…` | `17be7d70…` |
  | tail | `9a6a3192…` | `9a6a3192…` |
  | `solve-seedling-r8-d2` | `f2cfe3f9…` | `f2cfe3f9…` |

  **No row moved.**

### D2: the `sound` pin, derived. PASS

- **What landed:**
  - `procgenLevel.recordHoldsWater(record)` checks for column 2, i.e. `TERRAIN.water`.
  - `procgenSeedling.pinsForRecord(record, templates = [])` returns `['dead_frames']`, plus the kept templates' pin union, plus `'sound'` when the record holds water.
  - `seedlingOracle.pinsFor(templates, record = null)` delegates to it.
- **Where it is wired:**
  - the oracle's `solve`, which also covers `goalHoldsWithDoorsAsWalls` because it solves through the oracle;
  - `summary.pins`, passing `out.record`, which is what `procgenRequirements.js:116` reads;
  - `watchGenerate.displayStaging`. This is a fifth reader the brief did not name. It asserts equality with the oracle's solve, so it had to follow.
- **Rows:** `procgenSwimPins.test.js` (3).
- **Byte-inertia:** `water-pool` is the only template that writes water, and it already obliges `sound`. The identity block is identical.

### D3: `watergate` and `post-swim`. PASS

- **What landed:**
  - `soloDoor.WATER_GATE`, with `WATER_GATE_DOOR_ID = 'watergate_door'` and `WATER_GATE_REFUSALS = ROCK_GATE_REFUSALS`.
  - A binding table, `procgenSeedlingElements.WATER_DOOR_IDS`. The composite writes `{tx, ty, terrain: 'water'}` for the door cell into `placed.painted` **after** the door and carve laws. The laws ask about the door open (`paintedFor(null)`), and a water cell is not `ground` to the flood. `procgenSeedling.js:2046`'s `withTerrain` then writes it with the wall paint.
  - `seedlingOnConnectorEntities` skips the id, so the door has no entity and no tag.
  - `ELEMENT_TABLE.watergate` with `needs: ['canSwim']`.
  - `POST_SWIM_ITEMS` and `POST_SWIM_PALETTE`. `post-swim` is added to `GENERATE_BIOMES`, `GEN_ROOM_BIOMES` and `GEN_ROOM_BIOME_NAMES`, but **not** to `DEFAULT_CENSUS_BIOMES`.
  - `ITEM_LABELS.canSwim = 'Progressive Swim'`.
- **Certify:** `node scripts/procgen/generate-seedling-level.mjs --biome=post-swim --elements=watergate --seed=<n> --skeleton=empty --width=10 --height=10`.
  - Seeds 1–8 all give `CERTIFIED: true — SOLVED` (120, 138, 125, 73, 96, 83, 120, 73 ticks).
  - With `--require=canSwim`, seeds 1–4 give `MET via the watergate element … grade STRONG — WITH the item N tick(s) SOLVED, WITHOUT it REFUSED`.
  - `--biome=post-shield|post-sword|pre-sword` gives `CERTIFIED: false — null (the-element-needs-an-item-this-biome-does-not-grant)`.
- **Presets, byte-identical:** all seven `make-seedling-spiral-room-preset.mjs --state=<s> --check` runs (`spiral`, `sphere`, `generated`, `generated-leaf`, `generated-host`, `atlas-host`, `atlas-location`) print `OK: … matches a fresh build`. `check-seedling-generated-set --seeds=1-6` is `OK`.
- **Rows:** `procgenWaterGate.test.js` (7). Five existing rows also moved:
  - the literal head list in `procgenDoorElements.test.js` and `urlParams.test.js` (twice);
  - `ITEMS_ELEMENTS_NEED`;
  - three rows that used `canSwim` as "an item nothing is gated on" now use `hasFeather` (`procgenRequireDirective`, `procgenKillGateDemand`, `seedlingGenRoomRequire`);
  - the two biome-list rows (`watchGenerate.test.js`, `flashSeedlingGen.test.js`).

### D4: `watershortcut`. PASS, with a finding

- **What landed:** `soloDoor.WATER_SHORTCUT`, with `WATER_SHORTCUT_DOOR_ID = 'watershortcut_door'`, `law: LAW_SHORTCUT` and the rock shortcut's `longWayDemand` via `buildSoloDoor`. `ELEMENT_TABLE.watershortcut` has `needs: ['canSwim']`, and `headsNeeding('canSwim')` returns `['watergate']`. `--require=canSwim --elements=watershortcut` refuses `the-directive-and-the-spec-disagree`, as `shortcut` does.
- **Witness:** `loopy` 10×10 seed 6 at bounds 3/4/3 **SHORTENS**: 75 ticks with the conch and 201 without, both SOLVED (`procgenWaterShortcut.test.js`).

### Mutants (predicted, then one build each)

Each mutant was built in a separate worktree at `29b3e24`, and the file was restored by path afterwards.

| mutant | predicted | measured |
|---|---|---|
| (a) D1's two keys removed | W0 arm B reds; D3/D4 certification REFUSES `no-corridor` | **7 red**: SwimSolver B and C, SwimPins oracle, WaterGate ×3, WaterShortcut. CLI: `CERTIFIED: false — REFUSED … no corridor … Obstacle: no-corridor` |
| (b) D2's water clause dropped | the D3 with-arm THROWS by name (arm C) | **6 red**. CLI: `PhysicsV2Error: the player entered Water in level 900 at (24, 31.55) on a tape that does not pin "sound"` |
| (c) `POST_SWIM_ITEMS.canSwim: false` | the seam refuses by name | **5 red**. CLI: `CERTIFIED: false — null (the-element-needs-an-item-this-biome-does-not-grant)` |
| (d) `ITEM_LABELS.canSwim` dropped | the row names `canSwim` | **2 red**: `expected 'canSwim' to be 'Progressive Swim'` |

## D5: yield

The script lists the kinds explicitly and its bounds are 3/4/3/anchor 1 with a 120 s cell budget.

```
node scripts/procgen/sweep-yield-table.mjs --substrate=seedling --kinds=empty,branchy,bushy,loopy,open,rooms,winding --sizes=10x10,14x14 --elements='watergate' --palette=post-swim --seeds=1-12 --count=3 --tries=4 --k=3 --anchortries=1 --cellbudget=120
node scripts/procgen/sweep-yield-table.mjs --substrate=seedling --kinds=empty,branchy,bushy,loopy,open,rooms,winding --sizes=10x10,14x14 --elements='watershortcut' --palette=post-swim --seeds=1-12 --count=3 --tries=4 --k=3 --anchortries=1 --cellbudget=120
```

Both sweeps completed all 168 cells: 0 threw, 0 timed out, and the wall times were 173 s and 229 s.

| head | placed | certified | refused by name | S1's rock head |
|---|---|---|---|---|
| `watergate` | **146/168** | **146/146** | 22 `wall-does-not-seal` | rock gate 146/168, 136/146 |
| `watershortcut` | **87/168** | **87/87** | 47 `the-shortcut-does-not-shorten`, 34 `the-shortcut-is-a-cut` | rock shortcut 87/168, 87/87 |

- **Per kind, water gate** (placed = certified): empty 24, branchy 21, bushy 23, loopy 19, open 13, rooms 23, winding 23.
- **Per kind, water shortcut:** empty 4, branchy 13, bushy 12, loopy 21, open 20, rooms 5, winding 12.
- **My prediction was "the water gate ≤ the rock gate".** Placed came out **equal**, as expected from the same geometry and the same draw. Certified came out **higher**, 146 against 136, so the prediction was wrong. **Trap 1448 did not reappear: 0 drops.** It is about the solve never selecting `break`, and a swim needs no verb.
- **The water shortcut's grade census** (scratch `shortens-all.mjs`, the same 7 × 2 × 12 grid at 3/4/3, differential via `requirementsFor`):
  - Result: **73 SHORTENS, 9 NOT-ESTABLISHED, 5 INERT** out of 87. The rock shortcut graded 87/87.
  - NOT-ESTABLISHED rows are cheaper *without* the conch:

    | cell | with | without |
    |---|---|---|
    | branchy 10×10 s2 | 146 | 139 |
    | branchy 14×14 s1 | 384 | 360 |
    | branchy 14×14 s9 | 262 | 162 |
    | loopy 10×10 s1 | 175 | 160 |
    | loopy 10×10 s3 | 144 | 110 |
    | loopy 14×14 s2 | 267 | 232 |
    | loopy 14×14 s10 | 131 | 127 |
    | winding 10×10 s10 | 247 | 244 |
    | winding 14×14 s9 | 262 | 162 |

  - INERT rows: bushy 14×14 s12, loopy 10×10 s2, loopy 14×14 s1, open 10×10 s1, open 14×14 s4.
  - My hypothesis, which I did not probe further: water speed is 0.45, and the planner prices tiles rather than ticks, so a swim route with fewer tiles can cost more ticks.

## D6: wasm witnesses (headless logic-only, `--host=http://localhost:8500 --wait-for-box=60`)

| subject | line |
|---|---|
| `--elements=watergate --biome=post-swim --seed=4 --skeleton=empty --areas=0` | `PASS: … AGREES PER TICK … agrees per tick (74 observations)` · `end-state verdict: AGREES … Δx 0 Δy 0` · `game 73 vs certification 73` · `0 FAILURE(S)` (14 s) |
| `--elements=watershortcut … --seed=4 --skeleton=loopy` | `agrees per tick (74 observations)` · `Δx 0 Δy 0` · `0 FAILURE(S)` |
| `--elements=watershortcut … --seed=6 --skeleton=loopy` | `agrees per tick (76 observations)` · `Δx 0 Δy 0` · `0 FAILURE(S)` |

Each certification tape's pins are `["dead_frames","sound"]`, derived from the record by D2.

## D7: records. PASS

- **`seedling-bot-log.md`:** a new § *Seedling substrate S1-swim — the water gate and the water shortcut*, placed directly after § S1. It lives in the log, where S1's section is.
- **`architecture.md`:** the on-connector head list gains `watergate` and `watershortcut`. This is where S1 catalogued its three.
- **`flash.md`:** the biome list gains `post-swim`, and there is one sentence naming `post-swim` and `Progressive Swim` as the third physical gate, plus the gen-room residue.
- **The reference is regenerated:** `catalogue.js`, `urlGrammar.js`, `docsIndex.js`, `instruments.js` (a new `citedBy`) and the README index. `--check` gives `ALL 7 … AND 5 MARKDOWN REGIONS MATCH`. The `procgenDocs` vitest gives 8 files / 483 tests passed.
- **Bounded vitest**, using the brief's command (`seedlingDemo/procgen*.test.js`, `procgenCore/elements`, `procgenCore/elementSpec.test.js`):
  - BEFORE (pristine): **38 files / 718 tests**.
  - AFTER: **42 / 734**, which is +4 files and +16 rows, all new.
  - The other touched files (`watchGenerate`, `flashSeedlingGen`, `seedlingGenRoom*`, `procgenRequireDirective`, `urlParams`, `procgenDocs`) give 17 / 850 passed.

## What the brief got wrong (measured)

1. **The S1 section's location.** § *Seedling substrate S1* is in `seedling-bot-log.md:9906`, not in `seedling-bot.md`. D7(i) followed the section.
2. **S1's "§5.2 identity block".** The plan is not in the clone. The committed derivation is `scripts/procgen/identity-block.sh`, and I used that.
3. **"Water gate ≤ rock gate".** It is equal on placed and higher on certified (146 against 136), and trap 1448 does not reappear.
4. **"`census-seedling-campaign` ALL PASS".** The census prints no such line. It exits 0 and its output was byte-identical.
5. **The branch.** The brief named `fanout/seedling-swim-s1`; the harness pins `claude/seedling-swim-s1-zwbfsw`.
6. **`SEEDLING_PORT` for D6.** `check-seedling-wasm-element.mjs` reads `--host=`. `SEEDLING_PORT` is `check-seedling-generated-set`'s variable.
7. **An unnamed seam in D2.** `watchGenerate.displayStaging` also reads `pinsFor`. It is wired, because its equality with the oracle's solve is asserted.
8. **The shortcut's SHORTENS rate.** It is not guaranteed by the law as the rock's is: 73 of 87.

## Residue

- **⛔ The gen room (the AP / flash path) cannot host the water gate.** This is a seam the brief did not name. I measured it and stopped there without widening. `seedlingGenRoom.hazardCells` and `safeReach` wall water whatever the boot grants, and `keepReachable` then refuses every room whose goal sits behind the gate.
  - Scratch `genroom.mjs`, `generateGenRoom({size: 10x10, params: {seedlingGen: {biome: 'post-swim', elements: 'watergate'}}})`: `rerolls: 83, rerollCause: 'doors', grownFrom 10x10 → 28x28`.
  - `require: 'canSwim'` gives `… no draw met the directive in 8 re-roll(s) — the last one: the-required-element-was-refused: wall-does-not-seal`.
  - `watershortcut` and plain `post-swim` gen rooms build at re-roll 0.
  - The likely fix is a boot-aware hazard set (water is not a hazard when `items.canSwim`). It is routed to the coordinator.
- **The water shortcut's 9 NOT-ESTABLISHED rows** reflect the planner pricing tiles rather than ticks. That is a solver finding and was not fixed here.
- **Standing-values staleness.** Two banked identity rows differ from the value the pristine base produces:

  | row | banked | pristine `34f32cf` |
  |---|---|---|
  | `killgate s9` | `17815c06…` | `65e81dd3…` |
  | `level pre-sword s1` | `45edd259…` | `e28c1e5d…` |

  Both are unmoved by this slice (BEFORE = AFTER). I did not run `standing-values --write`.
- **The pristine worktree's reference `--check` failure** was environmental (uninitialised game submodules); see ² above.

## Byte-inertia

Every W0 identity row is **IDENTICAL** BEFORE and AFTER: 13 md5 rows, 6 producer `--check`s plus `solve-seedling-r8-d2 --check`, and the generated set. The same holds for the seven preset states and the campaign census. No committed preset, tape or standing value moved. The one line that varied (the generated set's door-walk tick) varies on the pristine base alone.
