# Seedling swim T2: the swimmer's pricing and the feather gate (cloud report)

`seedling-swim-t2` is a cloud fan-out build of plan `seedling-swim-plan.md` §6. This file is the report the coordinator reviews. The as-built record is § *Seedling substrate T2-swim* in `docs/json/developer/procgen/seedling-bot-log.md`.

- **Started from:** `279d75d451` (`origin/main`, 2026-09-29). It descends from the expected `d05e5ae017`.
- **Branch:** `claude/seedling-swim-t2-pricing-x5a1b0`. The brief named `seedling-swim-t2`, but the harness pins this branch.
- **Head:** the commit that adds this file, directly after `c351558`.
- **Commits, one per D:**
  - `2be0c56` D1
  - `a5adb81` D2
  - `d0667e7` D3
  - `c351558` D5 records
  - this report

  D4 is measurement and carries no code.

## W0

- **The A* cost site** is `botDriverV2.planTilePath`'s `const g = cur.g + 1;`. At the base it is `frontend/modules/seedlingDemo/botDriverV2.js:853`; after D1 it is `g = cur.g + stepCost(nx, ny)`.
- **Whether the lattice node can know its terrain without a reshape:** it can. A node's tile is `floor(n / (TILE_SIZE / pitch))`, and `level.lethalTerrainTiles` carries `{tx, ty, t}`. So no reshape was needed.
- **The rows, reproduced on the clean tree.** S1's `shortens-all.mjs` was not committed, so I rebuilt it as scratch: `generateSeedlingLevel` at bounds 3/4/3/1 over `seedlingSkeletonSpec(kind)`, then `requirementsFor`, then `gradeOf`. It reproduced **73 / 9 / 5** exactly, and all 14 non-SHORTENS rows to the tick. Four of them, as the brief asked:

  | cell | grade | with | without |
  |---|---|---|---|
  | branchy 14×14 s9 | NOT-ESTABLISHED | 262 | 162 |
  | loopy 10×10 s1 | NOT-ESTABLISHED | 175 | 160 |
  | loopy 10×10 s3 | NOT-ESTABLISHED | 144 | 110 |
  | open 10×10 s1 | INERT | 118 | 118 |

## The identity block: BEFORE (this tree at `279d75d`, before any edit) and AFTER (D1, and again at D3)

The command is `bash scripts/procgen/identity-block.sh .`, which took 2 min 45 s.

| row | BEFORE | AFTER (D1 and D3) |
|---|---|---|
| maze byte-identity | `246dfbceff75c1cc27fdb347469a77d7` | identical |
| acceptance batch | `4330bad70290dd18d94b11ca5b0bc5cb` | identical (also re-measured alone at D2) |
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
| r8-battery `--check` | `410f27c077b1ee854a14c24b73dc6335` exit 0 | identical |
| r8-d2-chain `--check` | `b470c14d1d272fb7d0e03fdcde9cf20e` exit 0 | identical |
| r8-l18 `--check` | `17be7d70e7bf116f9c3438de04be6b15` exit 0 | identical |
| r8-tail `--check` | `9a6a31925cb5204eee4cb0ad66febed6` exit 0 | identical |
| r9-l3 `--check` | `6cd35fe1414af6bf5beb7605f235cb8e` exit 0 | identical |
| r9-campaign `--check` | `2823a8112d1cb76e6d0324a5cf713085` exit 0 | identical |
| generated set¹ | `OK` | `OK` |
| reference `--check` | `ALL 7 … 5 MARKDOWN REGIONS MATCH` | the same, after regenerating at D3 and D5 |
| `census-seedling-campaign` (stdout md5) | `01ec4283ff00f38745d78d6d7ac376d5`, exit 0 | identical at D1 and D3 |
| 7 preset states `--check` | — | all `OK: … matches a fresh build` at D3 |

¹ The script runs this row against `:8000`, and this sandbox serves on 8530, so the script's own line reads *"driver stage KEPT (exit 1)"* on both sides. I measured it separately: `SEEDLING_PORT=8530 node scripts/procgen/check-seedling-generated-set.mjs` gives `OK`, exit 0, BEFORE and after D1 and D3.

The maze row differs from S1's `677b7d9c…`. That difference is `main`'s, from the C2 maze work since S1: it is the same on both sides here.

## Per D

### D1: the water-only tile weight. PASS

**What landed:**
- `WATER_STEP_COST = 2.25` (export).
- `swimTileKeys(level, opts)` returns the armed water tiles, and only when `inventory.canSwim`. A coerced tile is excluded.
- `planTilePath` adds `stepCost(nx, ny)`.
- Every other node costs 1, and without the conch the set is empty. So no route where water is a wall can move, and none did (the identity block).

**The ratio, derived.** The scratch `ratio.mjs` runs the real engine through `createRunForStaging`: a 40×5 corridor held RIGHT from rest, reading the crossing tick of each 16-px cell off `run.state.x`, over cells 8..32:

| walk | ground t/cell | water t/cell | ratio |
|---|---|---|---|
| held key, `sound` pinned (burst 0.25 on 6 of 47) | 13.625 (327/24) | 30.875 (741/24) | **2.266** |
| held key, no burst (arithmetic: friction 0.5 > add 0.45 resets v to 0.45) | 13.625 | 35.56 | 2.61 |
| **the solver's walk** (`solveSegment`, scratch `ratio2.mjs`) | 11.19 | 14.94 (8-cell band); 12.19 for 1 isolated cell | **1.34** (1.09 isolated) |

The shipped price is **2.25**: the held-key ratio as briefed, rounded to a quarter so that g-scores are exact binary sums (the committed route must not depend on ULP summation order). ⚠ The solver's walk is a different walk. Its tape presses `primary` (the sword dash) on its legs, as the scratch `trace.mjs` key histogram shows. A price of 1.25, from the solver-walk ratio, was measured too: it flipped **one** row and made `loopy 14×14 s2` worse (267 → 287).

**Rows** (`procgenSwimPrice.test.js`, 7):
- the price;
- a choice room (two water cells against a 2-step detour) routes round with the conch, and routes the same without it;
- a coerced water tile costs 1;
- the three re-graded rows below.

The witness room is still **SOLVED 71 t** (`procgenSwimSolver.test.js` is unchanged and green).

**The 14-row re-grade** (the same scratch census, at D1 and again at head):

| cell | before (S1) | with/without | after D1 | with/without |
|---|---|---|---|---|
| branchy 10×10 s2 | NOT-ESTABLISHED | 146/139 | NOT-ESTABLISHED | 146/139 |
| branchy 14×14 s1 | NOT-ESTABLISHED | 384/360 | NOT-ESTABLISHED | 384/360 |
| branchy 14×14 s9 | NOT-ESTABLISHED | 262/162 | NOT-ESTABLISHED | 262/162 |
| loopy 10×10 s1 | NOT-ESTABLISHED | 175/160 | **SHORTENS** | 133/160 |
| loopy 10×10 s3 | NOT-ESTABLISHED | 144/110 | **INERT** | 110/110 |
| loopy 14×14 s2 | NOT-ESTABLISHED | 267/232 | **INERT** | 232/232 |
| loopy 14×14 s10 | NOT-ESTABLISHED | 131/127 | NOT-ESTABLISHED | 131/127 |
| winding 10×10 s10 | NOT-ESTABLISHED | 247/244 | NOT-ESTABLISHED | 247/244 |
| winding 14×14 s9 | NOT-ESTABLISHED | 262/162 | NOT-ESTABLISHED | 262/162 |
| bushy 14×14 s12 | INERT | 217/217 | INERT | 217/217 |
| loopy 10×10 s2 | INERT | 208/208 | INERT | 208/208 |
| loopy 14×14 s1 | INERT | 299/299 | INERT | 299/299 |
| open 10×10 s1 | INERT | 118/118 | INERT | 118/118 |
| open 14×14 s4 | INERT | 391/391 | INERT | 391/391 |

**Totals: 73/9/5 → 74 SHORTENS / 6 NOT-ESTABLISHED / 7 INERT.** One SHORTENS row moved its with-arm: `open 14×14 s1` went from 244/269 to 268/269, and still grades SHORTENS.

**The six that stay NOT-ESTABLISHED each have their own explanation** (scratch `trace.mjs`: the per-cell trace, arrival ticks and waypoints of both arms):

- **`branchy 14×14 s9` and `winding 14×14 s9`** are the same generated room. The with-arm does not use the door. It swims a pass-2 `water-pool` at (2..3, 2) to reach the pickup's NORTH stance (7,7), a route with the same tile count as the dry route to the SOUTH stance (7,9). `deriveStance`'s committed order under `ECONOMIES_ROSTER_WIDE = false` takes the first reachable ring cell in `(d, y, x)` order, so north wins, and with the conch north is reachable. **A stance-choice fact, not a price.**
- **`branchy 10×10 s2`, `branchy 14×14 s1`, `loopy 14×14 s10` and `winding 10×10 s10`** DO swim the door, on routes 2 cells shorter. Yet the walk reaches its stance at about the same tick: 92 vs 91, 336 vs 311, 83 vs 81, 195 vs 197. A straight single-cell swim on the solver's walk costs only +10..12 ticks, so the balance is spent elsewhere:
  - in the controller's legs around the door (on `loopy 14×14 s10` the turn before the water costs 17 ticks);
  - in the collect from the other side, +2..+6 ticks.

  No tile price can see either.

**Mutant (a)**, `WATER_STEP_COST = 1`. Predicted: the choice-room and re-grade rows red, and the census back to S1. Measured: **5 red**, and the census is **byte-identical to BEFORE** (73/9/5). The file was restored by copy and the tree was clean.

### D2: the count in `ITEM_LABELS`. PASS

**What landed:**
- A row is a name or `{item, count}`.
- `itemLabelOf(flag)` returns `{item, count}` or null.
- `itemLabel(flag)` gives the report's words ("Progressive Swim ×2").
- `requirementOf(flag)` gives `Has('Progressive Swim', 2)`, and `Has('Progressive Sword')` for a count of 1.
- `procgenRequirements`' three readers go through `itemLabel`, and the row gains **no new field**. The acceptance batch's payload is unmoved: `4330bad7…`, re-measured.
- `hasFeather: {item: 'Progressive Swim', count: 2}`.

**Readers**, from `grep -a ITEM_LABELS` over `frontend` and `scripts`:
- `procgenRequirements` itself;
- `batch-seedling-acceptance.mjs`, which imports the table and reads only `row.item`.

⚠ The gen room's exit gate does **not** read it (see *What the brief got wrong*).

**Rows:** `procgenItemLabels.test.js` (5).

**Mutant (b)**, the count dropped. Predicted: 4 red, with the requirement reading `Has('Progressive Swim')`. Measured: **4 red**, *"expected 'Progressive Swim' to be 'Progressive Swim ×2'"*. Restored.

### D3: `waterfallgate`. PASS (the gen-room half STOPPED)

**What landed:**
- `TERRAIN.waterfall = {column: 32, type: 25}`. This is **measured**: `seedling-map.json` L0 (13,7) is `[13, 7, 512, 0]`, which is column 32, and L0 holds two column-32 tiles and no other type-25 column. `assertTerrainColumns` holds.
- `recordHoldsWater` counts it.
- `soloDoor`:
  - `APPROACH_SOUTH` and `WATERFALL_GATE` (`LAW_CUT`, `waterfallgate_door`);
  - `WATERFALL_GATE_REFUSALS`;
  - `the-door-has-no-south-approach` in `SOLO_DOOR_REFUSALS` and in the cut law's stage order.
- `procgenSeedlingElements`: `WATER_DOOR_IDS` gains the id, and `DOOR_TERRAIN` maps it to `waterfall`.
- `ELEMENT_TABLE.waterfallgate.needs = ['hasFeather']`, and `headsNeeding('hasFeather')` returns `['waterfallgate']`.
- `POST_FEATHER_ITEMS` / `POST_FEATHER_PALETTE`, and `watchGenerate.GENERATE_BIOMES['post-feather']`. It is **not** in `DEFAULT_CENSUS_BIOMES`.
- `planTilePath`'s refusal names the climb rule when it fired. The clause is placed first, because `solverBot.js:8816` quotes the planner's message cut to 300 characters.

**Certify.** The command is `node scripts/procgen/generate-seedling-level.mjs --biome=post-feather --elements=waterfallgate --seed=<n> --skeleton=<k> --width=<s> --height=<s> --count=3 --tries=4 --k=3`.

- `winding 10×10 s8` **139 t**, `winding 10×10 s11` **551 t** and `rooms 14×14 s8` **154 t** all give `CERTIFIED: true — SOLVED`.
- With `--require=hasFeather`, all three give `MET via the waterfallgate element … grade STRONG — WITH the item N tick(s) SOLVED, WITHOUT it REFUSED`.
- **The crucial row** (`winding 10×10 s8`): the without-arm's own text is *"… Planner said: no walkable tile path in level 900 from tile (1,1) to (3,1). ⛓ The search refused 1 UPWARD step(s) into or out of an armed waterfall (`climbsArmedWaterfall`): without the feather the push (`v.y += 0.8`) beats the climb, so a waterfall is one-way DOWN. …"*. That is **the climb rule, not a drown**; the row asserts `not.toMatch(/drown/i)`. The `canSwim` row grades **INERT**, because `checkDrowning` tests type 1 only.
- `--biome=post-swim` (and `post-shield`, `post-sword`, `pre-sword`) gives `CERTIFIED: false — null (the-element-needs-an-item-this-biome-does-not-grant)`.

**Rows:**
- `procgenWaterfallGate.test.js` (7);
- `soloDoor.test.js` +5: the declaration, the placement on a south-to-north corridor with the clearer BELOW, and three corridors that refuse by name.

**Moved literal rows,** as S1's did:
- `watchGenerate.test.js` ×2 (the biome lists);
- `procgenDoorElements.test.js` and `urlParams.test.js` ×2 (the head lists);
- `procgenLevel.test.js` (the terrain list);
- `procgenRequireDirective.test.js` (`ITEMS_ELEMENTS_NEED`);
- three rows that used `hasFeather` as *"an item nothing is gated on"*, which now use `hasDarkSuit`: `procgenRequireDirective`, `procgenKillGateDemand` and `seedlingGenRoomRequire`.

**Mutant (c)**, the south-approach check dropped. Predicted: the corridor rows red, and a door entered from above places and is no gate. Measured: **4 red**, the three corridors plus the witness, whose draw moved. The empty 10×10 rooms s1..s3, which refuse by name when intact, now place and grade **INERT 113/113, NOT-ESTABLISHED 147/144 and INERT 136/136**: not a gate. Restored.

**⛔ STOPPED — the gen room.** `GEN_ROOM_BIOMES` is declared in `seedlingGenRoom.js`, which is T1's file, and is asserted equal to `GEN_ROOM_BIOME_NAMES` (`seedlingGenRoomPayload.js`) **at module load**. Adding `post-feather` to the payload list alone makes `seedlingGenRoom` throw on import. The fix is one line in T1's file, `'post-feather': POST_FEATHER_PALETTE`, plus the payload name; I did neither.

## D4: yield and witnesses

```
node scripts/procgen/sweep-yield-table.mjs --substrate=seedling --palette=post-feather --elements=waterfallgate --kinds=empty,branchy,bushy,loopy,open,rooms,winding --sizes=10x10,14x14 --seeds=1-12 --count=3 --tries=4 --k=3 --anchortries=1 --cellbudget=120
```

This took 124 s. The denominator: **attempted 168 · completed 165 · threw 3 · timed out 0**.

| kind | N | placed | certified |
|---|---|---|---|
| empty | 24 | 0 | 0 |
| branchy | 24 | 3 | 3 |
| bushy | 24 | 3 | 3 |
| loopy | 24 | 0 | 0 |
| open | 24 | 0 | 0 |
| rooms | 24 | 3 | 3 |
| winding | 24 | 5 | 5 |
| **total** | **168** | **14** | **14/14** |

- **Refused by name:** 138 `the-door-has-no-south-approach` and 16 `wall-does-not-seal`. A main path rarely steps UP.
- **The differential over the 14** (scratch census, `--flag=hasFeather`): **14 STRONG**. The tick counts range from 139 (winding 10×10 s8) to 688 (rooms 14×14 s2).
- **⚠ The 3 THREW** (`branchy 10×10 s12`, `branchy 14×14 s9` and `winding 14×14 s9`, the last two the same room) are `GenerationAborted`: a pass-2 `pit-patch` whose certification solve died in the pit (*"the player fell into a pit in level 900, which has NO control block"*). At all three the element had **refused**, and the aborted records hold **no waterfall** (mapped). The abort is **unmoved with `WATER_STEP_COST = 1`**. Not D1, and not the waterfall; see *Residue*.

**The water shortcut's grade census after D1** is the 14-row table above: **74 / 6 / 7** over the same 87 rows. It is identical at D1 and at head.

**Wasm witnesses** (headless, `--host=http://localhost:8530 --wait-for-box=60`):

| subject | line |
|---|---|
| `--elements=waterfallgate --biome=post-feather --seed=8 --skeleton=winding --areas=0` (the shortest certified; it also certifies at the witness's `count=1`, 139 t) | `waterfall-gate at (3,2)` · `waterfallgate_door at (3,2), opened from (3,3)` · **`AGREES PER TICK … agrees per tick (140 observations)`** · `game tick 139 + 1` · **`end-state verdict: AGREES … Δx 0 Δy 0`** · `0 FAILURE(S)` (15 s) |
| `--elements=watershortcut --biome=post-swim --seed=6 --skeleton=loopy --areas=0` (S1's, re-run after D1) | `agrees per tick (76 observations)` · `game tick 75 + 1` · `Δx 0 Δy 0` · `0 FAILURE(S)`. S1 read 76 too, so this room did not move. |

## Mutants

| mutant | predicted | measured |
|---|---|---|
| (a) `WATER_STEP_COST = 1` | the choice-room and re-grade rows red; the census reverts | **5 red**; census **byte-identical** to BEFORE |
| (b) `hasFeather` count dropped | 4 red; the requirement reads `Has('Progressive Swim')` | **4 red** |
| (c) the south-approach check dropped | the corridor rows red; a door from above places and is no gate | **4 red**; empty s1..s3 place and grade INERT / NOT-ESTABLISHED |

Each mutant was one build: copy the file, edit, run, copy it back. `git status` was clean afterwards.

## Bounded vitest

- BEFORE: **43 files / 867 tests**.
- AFTER: **46 / 891**. That is +3 files and +24 rows, all new: `procgenSwimPrice` 7, `procgenItemLabels` 5, `procgenWaterfallGate` 7, `soloDoor` +5.
- The command is the brief's: `seedlingDemo/procgen*.test.js`, `procgenCore/elements`, `procgenCore/elementSpec.test.js`, `seedlingDemo/botDriverV2*.test.js`.
- The wider touched set (`procgenDocs`, `procgenCore`, `watchGenerate`, `seedlingGenRoom*`, `flashSeedlingGen*`) gives **67 / 2349 passed**.
- `check-procgen-docs.mjs` gives `ALL CHECKS PASSED`.
- No unfiltered run (⚖ ruling 52).

## What the brief got wrong (measured)

1. **The ratio.** "≈1.6–1.8×" was a guess. The held-key corridor measures **2.27×** with the burst and 2.61× without it. The solver's own dashing walk measures **1.34×**, and 1.09× for one isolated cell.
2. **"Most of the 9 become SHORTENS or INERT."** Three moved. The other six are not about the swim price: two are stance choice (`(d, y, x)` north-first), and four are the controller's legs and the collect side.
3. **"The gen room's exit gate builds `Has(<label>)` from the flag."** It does not. `seedlingGenRoom` clones the input region's `access_rule` into `exitGates`. The only readers of `ITEM_LABELS` are `procgenRequirements` and an unused import in `batch-seedling-acceptance.mjs`. The panel's `?require=` grammar text lists **flags** (`ITEMS_ELEMENTS_NEED`), not labels.
4. **"`GEN_ROOM_BIOME_NAMES` + `GEN_ROOM_BIOMES`."** `GEN_ROOM_BIOMES` is in T1's `seedlingGenRoom.js`, and the two are asserted equal at module load. See the STOP above.
5. **The refusal text.** Before D3 the without-arm's refusal did not name the climb rule. It was the generic *"separated by water, a pixelmask or a teleporter volume"*, and a clause appended at the end would be cut by `solverBot`'s 300-character quote. D3 names it, first.
6. **The branch.** The brief named `seedling-swim-t2`; the harness pins `claude/seedling-swim-t2-pricing-x5a1b0`.
7. **`identity-block.sh`'s generated-set row** assumes `:8000`. It was measured separately on `:8530`, as S1 did.

## Residue

- **The six NOT-ESTABLISHED water shortcuts.**
  - Four want a planner that prices STOPS and turns as well as cells. One tile weight cannot.
  - Two are `deriveStance`'s north-first `(d, y, x)` order, which sits behind `ECONOMIES_ROSTER_WIDE`. Its economy arm scores walk *pixels*, not ticks, and it is off roster-wide.

  Both are solver design questions, routed to the coordinator.
- **The gen room cannot offer `post-feather`** until T1's file gains the palette (one line). S1's residue also stands: the gen room walls water whatever the boot grants.
- **3/168 pass-2 aborts** in the post-feather sweep. Each is a pit death in the certification solve of a `pit-patch`, at a cell where the element refused, in a record with no waterfall. It is unmoved by D1. The rebuilt room's draws are post-feather's own, so it is new to this sweep, but no T2 mechanism is on its route. Not attributed further.
- **Yield is low** (14/168), because generated main paths rarely climb. A skeleton or placement that plans upward runs would raise it. That is a design question, not a defect.
- **Standing values.** S1's two stale banked rows (`killgate s9`, `level pre-sword s1`) are unmoved here. There was no `standing-values --write`.

## Byte-inertia

The following were all measured **IDENTICAL** BEFORE and AFTER:
- every identity-block row: 13 md5 rows and 6 producer `--check`s;
- the generated set;
- the reference (after regeneration);
- `census-seedling-campaign`;
- the seven preset states;
- the acceptance batch, re-measured alone at D2.

No committed preset, tape or standing value moved, and no biome default moved. D1 cannot reach a committed solve, because no committed boot grants `canSwim`. D3's refusal clause fires only when the climb rule refused a step, so every committed refusal message is unchanged.
