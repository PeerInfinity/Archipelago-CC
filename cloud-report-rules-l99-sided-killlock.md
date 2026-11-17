# Cloud report: `rules-l99-sided-killlock`: a durable kill-lock gated by side, and `seedling_er` regenerated under it

Planner: `seedling-rules-planning-8`. ⚖ Robert 2026-11-15: "Rule + ER regen slice (Recommended)".
Branch `claude/rules-l99-sided-killlock-0a6pw7`.

Base: `git rev-parse origin/main` = `75e45c964d9ce37b3eb6db3c1e887b9b873b484c`.
`git merge-base --is-ancestor 978205e557 origin/main && echo ok` printed `ok`, so Fire is in the base.

Commits:
- `1c15c7fb` the rule;
- `d416af42` the re-records;
- `f5518803` the pins;
- then this report (with `CC/docs/cloud-reports/rules-l99-sided-killlock-evidence/`).

## Answer table

| # | question | answer |
|---|---|---|
| A | The rule's code path | `make-seedling-playthrough-rules.encounterLocksOf` → `seedlingObstacleEvents.encounterLockSides({…, reachable})` → `seedlingModelOracles.modelFloodPoints` (new). The latch and event plumbing is the existing one: `stampEncounterLocks`, then the analyzer's `latchEvent`, then `deriveLockEvents`. No level literal. |
| A | L99 | West pocket `cannot`: its nearest reachable centres to the three lavarunners are **74 / 82.6 / 98.5 px**, the witness's own numbers, against `runRange` 80. East `clears`. AP_1 `level_99__r2c4 -> r2c7` = `And(Has(L99 flag 0: lock@80,96 cleared), Or(Sword, Ghost Spear))`. The event sits in `level_99__r2c7` with `Or(Sword, Ghost Spear)`. |
| A | Other kill-locks read differently? | Their **side sizes and distances** are now measured from the model's centres. Their **verdicts, steps, `beyond`/`across`, `through` and `why` are identical** (census before/after, §2). In AP_1, seed 1 and the maze, the only elements that change are L99's two. Under the same layout, the ER compile also changes only those two. **L71 is unchanged.** |
| A | Precision sketch (`fatal` limited by body flood) | **Left out.** It is a per-body class flood (tile types, plus lava for `dieInLava = false`). Step 2 here is the player's own box flood. Not the same code. |
| A | Maze side | **Before: no.** L99's lock was not latched, so `playthroughEncounterLockOpeners` (filter `r.latch`) gave it no `opens_from`, and the maze opened it from any side. **After: yes**, through the same map: `opens_from {S: true}` (`deriveTileLogic.eventAdjacentCell`, `:229-235`). engineMd5 is unchanged (`bec36987…`). Certifier rows gained: **0** (vanilla and ER). |
| B.1 | Does the ER shuffle accept on the rules it compiles? | **Yes.** `entranceShuffleSteps` `compile`: `hooks.compile(atlas…)` → `beatability(rules)` → `rejected-unbeatable` → next draw. Replaying the committed layout through the new producer gives **beatable = false**: 75 locations never collected, the goal never collected. The base producer's control gives beatable = true. |
| B | ER before → after | Same seed and state: **32 of 50 stairs placements move**, accepted on draw 1 (0 unbeatable), 89 → 90 sphere states. Regions reached 265 → 265. Locations 88/88 → 89/89. Goal reached at sweep 9 → 9. r2c7's way in is now `level_43__r13c7`, no longer the west pocket. |
| C | Seed 1 | 0 regions and 0 item locations move. Goal sweep 10 → 10. **The sphere log moves (md5 `16c03fbe` → `efaa1921`), but only by the new event's own row** (13.2) and the five sphere-13 rows after it renumbered by +0.1. ⚠ The brief's STOP reads "its sphere log moves". I judged an event row the rule must add (A.4) not to be a move, because the 48 item rows keep their order and integer spheres and `seedling-sphere-order.json` is byte-identical. **Planner: confirm or overrule.** |
| C | Derived-rule table | **Not regenerated** (REGEN_RECIPE is CI). It is stale on payloadMd5 `2c844d31…` → `4b4fd1b6…`. A local probe run gives **rows 108 and exclusions 6, deep-equal to the committed table**; only `inputs` and `measuredAt` move. So no row moves and no design-6 review is owed. The expected-counts file was re-pinned. |
| Stops | Any hit? | None, except the sphere-log reading above. |

## 1. The rule (A)

**`modelFloodPoints`** (`frontend/modules/seedlingDemo/seedlingModelOracles.js`):
- the same 1 px flood of the player's box as `modelFloodTiles` (`collidesSolid`, a tile entered only when `enterable`);
- it returns the reachable **centres**, the `playerBoxAt` anchor. That is the point a chaser measures `runRange` to (`Bob.as:58`, `targetOffset` 0).

**`encounterLockSides({ reachable })`** (`frontend/modules/flashPanel/seedlingObstacleEvents.js`). When `reachable` is given:
- **Partition (step 1).** Each step INTO the lock starts on a cell. The side is the component of that cell's reachable centres, inside its tile side. A cell with no free position is no step.
- **Removability (step 2).**
  - A body's distance is the nearest reachable centre (`nearest` is reported per body).
  - A chaser counts only if that distance is within its class's `runRange` (`ENEMY_CLASSES[tag].aggro.range`).
  - Otherwise only the across-the-cut reach counts. That is the existing `reach`: the Ghost Sword's slash rect and the Spear's 32×5 thrust, the two arms with no line-of-sight test (`Player.as:917`, `:966-985`), plus the half hitbox.
  - Bodies standing in the side, `through`, and the free arms (`room.bodies.filter(b => !b.free)`) are as before.
- Without `reachable`, the tile reading stands.

**Condition and event (steps 3–4)** are the existing ones:
- a `cannot` side's steps are walled, and the cell is a latch when `tset == -1 && tag >= 0`;
- the analyzer prices the crossing from that side as `Has(<event>)`;
- `deriveLockEvents` mints `L<n> flag <tag>: lock@x,y cleared` on the side that clears, with that side's rule;
- the other side's crossing keeps the room's own rule. That is the same shape as L18, L26 and L53 (`And(weapon, event)`).

**Permissive, as the tile flood.**
- The producer floods a copy of the level without every entity that claims a grid-`gated` cell.
- Tiles, pixel masks (`CliffSide`, buildings) and ungated entities stay solid.
- Without this, L53's jellyfish room is cut at `breakablerock@128,160` and its verdict flips. It was measured and then fixed before commit.

Rule-commit tests:
- `seedlingObstacleEvents.test.js` gains three unit cases: the tile flood joins round a cut; the points split it; a chaser wakes at 45 px, not at the 40 px tile corner;
- `seedlingPlaythroughObstacleEvents.test.js` gains an L99 row with `runRange` derived from `ENEMY_CLASSES`.

## 2. Every kill-lock, before → after (`out/killlock-census.{before,after}.txt`)

| lock | verdicts before | verdicts after | what reads differently |
|---|---|---|---|
| L5 `lock@48,112` | clears | clears | — |
| L18 `lock@144,112` | clears / cannot | same | distances only |
| L26 `rocklock@112,208` | clears / cannot | same | distances only |
| L39 `wandlock@144,592` | cannot / clears (cross-level) | same | S side 193 → 176 tiles |
| L53 `lock@144,208` | cannot / clears | same | distances only |
| L60 `lock@128,80` | clears / across | same | distances only |
| L71 `lock@112,192` | across / across | same | the button-cell side is 255 → 1 tile (the one cell the L71/L63 report calls "the button cell"). All five runners are still across from both sides (43–61 px ≤ 80). `through` is unchanged. |
| L78 `lock@32,32` | clears | clears | 194 → 193 tiles |
| L98 `lock@112,112` | clears | clears | 86 → 85 tiles |
| **L99 `lock@80,96`** | clears (one side, 76 tiles) | **clears (56) / cannot (19)** | the split; beyond = `lavarunner@176,64` and `@192,64`; across = `@160,32` |

Evidence that nothing but L99 moves in the rules (`tools/rules-element-diff.py`, every exit and location rule compared):
- AP_1: 2 elements, both L99;
- seed-1 export: 2 elements, both L99;
- maze: 2 elements, both L99;
- ER, same layout compiled by the base producer vs this branch's (`tools/er-replay.mjs`): 2 elements, both L99.

No other level's kill-lock rule changes, so there is no STOP.

## 3. B.1: the shuffle's acceptance, quoted (`frontend/modules/procgenPipeline/entranceShuffleSteps.js`)

Header, `:18-21`:
```
//   … A layout NOT BEATABLE under its own compiled rules (the sphere walk collects every
//                 location and the goal) or refused by the substrate's `hooks.checks` is REJECTED and the next draw
//                 taken (back through ③); every rejection is counted and named in `compile.attempts`.
```
The `compile` runner:
```js
const out = await hooks.compile(atlas, { moved, authored: env.pool.atlas, ... });
...
const beat = beatability(rules);
...
env.attempts.push({ attempt, verdict: beat.ok ? 'rejected-check' : 'rejected-unbeatable', why: ... });
env.shuffle = drawPlacements(env, ..., attempt + 1, env.maxAttempts);
```
`beatability(rules)` walks `generateSphereLog(rules)` and fails on any location or goal item never collected.

So the shuffle accepts on the rules it compiles, and it would have refused AP_1's committed layout. The replay of that layout (`out/er-oldlayout-newrules.sweep.txt`):
- the new producer: `beatable = false — 75 location(s) never collected … the goal item The Seed never collected` (regions 58/267, locations 14/89). This matches the witness's −207 regions and −74 locations;
- the base producer: `beatable = true, 89 sphere states`.

The regeneration used the producer's own recipe: no seed change and no `SEEDLING_ER_STATE` change.

The layout moved without a rejection because the draw is bound over the **vanilla** compile (`shuffleBinding(env.vanilla.rules, …)`: the reach and the progression regions). The new event changes that binding, so draw 1's rng places differently.

## 4. `seedling_er` before → after (both ways, both mandatory)

| | before (`origin/main`) | after |
|---|---|---|
| placements (seed 1, 50) | committed | 32 of 50 differ (18 identical) |
| draws | 1 accepted, 0 unbeatable | 1 accepted, 0 unbeatable |
| sphere states (`beatability`) | 89 | 90 |
| sweep from its rules (`tools/sweep-locations.py`) | regions 265/267, locations 88/88, goal REACHED, sweep 9 | regions 265/267, locations **89/89**, goal **REACHED**, sweep 9 |
| L99 lower floor `r2c7` entered from | `level_16__r1c1`, `r2c4` | `level_43__r13c7`, `r2c4` |
| ER certifier arm (`--source=er --arms=new`) | **1 / 16 / 0**, matches its expected file | **1 / 16 / 0**, matches its expected file |

The per-location sweep indices are in `out/er-{before,after}.sweep.txt`. 30 regions and 9 locations change sweep index, which is expected from a new layout.

## 5. Re-records (commit `d416af42`)

| producer | before → after |
|---|---|
| `make-seedling-playthrough-rules.mjs` | atlas `seedling-88e3788c` → `seedling-2ac275e8` (md5 `e53ce517` → `28dc5dc7`; computed internal exits 307 → 308; lock events 17 → 18). AP_1 `b85305d1` → `858fa745`. |
| `make-seedling-subregion-partition.mjs` | atlas id only |
| `atlas_files.json` (hand-kept index) | the new id |
| `worlds/seedling_playthrough` (its recipe) | regenerated; `check-worldgen-package-freshness.py seedling_playthrough` ALL CHECKS PASSED |
| seed 1 (`Generate.py`, minimal-spoilers) | sphere log `16c03fbe` → `efaa1921`, `.archipelago` `899682bf` → `2c209272`, Spoiler `7f39286d` → `39ca6d69`. `preset_files.json` lost only its final newline and was reverted. |
| `make-seedling-playthrough-maze.mjs` | `9c33e926` → `68731263` |
| `make-seedling-er-preset.mjs` | `e3afef8c` → `aa6c0885` |
| `make-seedling-sphere-order.mjs` | unchanged (`4a9b7e80`), `--check` OK |
| `census-seedling-constants.mjs` | unchanged (7,119 literals, identical to base); no `--write` |
| `generate-procgen-reference.mjs` | unchanged, `--check` ALL MATCH |
| `census-seedling-campaign.mjs` | `--check` exit 0. No frontier write: I don't have the surveys' data, and no tracked file moved. |
| derived-rule table | **not regenerated** (CI). The local probe: 108 rows / 6 exclusions, deep-equal; `measuredAt` is CI's SHA |

## 6. Pins, before → after (commit `f5518803`, each with its reason in the file)

| pin | before → after |
|---|---|
| `seedlingPlaythroughObstacleEvents` fires | L18, L26, L53 → + L99. A new L99 row pins the sides, `nearest` vs `runRange` and the event's side. |
| `encounterKillArms` latched kill locks | [18, 26, 53, 60] → + 99 |
| `seedlingEventCollector` game_state ids | + `flag:L99:0` |
| `deriveLevelWorldLogic` weaponless unreached | + `L99 flag 0: lock@80,96 cleared` |
| `levelSetExporter` | internal exits 316 → 317; atlas id |
| `seedlingAtlasDoorCensus` | atlas id; internal exits 316 → 317; the test name no longer types counts (it said 312) |
| `vanillaOverlay` | atlas md5 `e53ce517…` → `28dc5dc7…` |
| `seedlingCompositeMap` | events 37 → 38; the test name no longer types counts |
| `seedlingDivergenceLegs` | goal-event leg ids +1 from 743 (the new leg); `legs[801]` → `legs[802]` |
| `fixtures/divergence-door-leg-keys.json` | 835 → 836 keys (its own rerecord command), nothing goes |
| `seedlingErMode` E3 mutant, `placed` | {on 7, off 9} → {on 9, off 6}. ⚠ **The direction inverted**: the mutant now refuses fewer draws than the guard. It stays live (≥ 35/40 differ) and never incomplete, which is what the row asserts. Its docblock says so. Worth a look from whoever owns E3. |
| `seedling-derived-rules-expected.json` | elements 405 → 406, labels.location.derived 59 → 60, w0.location.equal 61 → 62, sharedBinding 157 → 159 (the event location and the `r2c4 → r2c7` pair). Certifier 1/16/0 and table 108/6 are unchanged. |

`lint-gate-labels.mjs`: 78 findings on base and on the branch, none in a touched file. `lintGateLabels.test.js` is green.

## 7. Gates

- **Producers `--check`:** partition, maze, ER, sphere order, constants, procgen reference: all OK. World package freshness PASS. `check-worldgen-package-sidecars.mjs` ALL CHECKS PASSED.
  - ⚠ `make-seedling-playthrough-rules.mjs --check` stops on `STALE derived-rule table` (payloadMd5) until the CI table lands. With the local probe's table copied in temporarily, it printed `OK` for both the atlas and AP_1, and the table was then restored.
- **Whole-game certifier, `--arms=new`, before → after:**
  - vanilla: **1 / 16 / 0 → 1 / 16 / 0**. The only problem is `level_63__r6c9 → level_63__r0c1 … derived true, atlas false` (OPEN_L63);
  - ER: **1 / 16 / 0 → 1 / 16 / 0**, "matches seedling-er-whole-game-certify-expected.json";
  - logs: `out/certify-{base,new}-{vanilla,er}.txt`.
- **Moved-input re-checks (Fire):**
  - I could not reproduce the serialization behind `fe69fc4e`; no file or test records it.
  - `playthroughRockFireSides()` (22 rows) is byte-identical between base and branch under every serialization tried (`JSON.stringify([...map])` = `58ba0b9f` both).
  - The new code touches neither `seedlingHolderParking.js` nor `census-seedling-block-stoppers.mjs`.
  - Fire's move set is unchanged: the AP_1 rule diff is L99-only, and the seed-1 item rows are identical.
- **Bounded sweep.** The list is `out/bounded-sweep-files.txt`: 152 files from `rg -a -l` over the kill-lock ruling, obstacle events, AP_1 / seed-1 / `seedling_er` / maze rules, the playthrough atlas and its id, the partition, the derived-rule table, the ER mode, the certifier, the sphere order, the leg list and the model oracles. The guard was `[ -n "$LIST" ]`.
  - default tier, 148 files: **2,668 passed / 2 failed**. The 2 are `derivedRuleTableFresh` and `seedlingAtlasDerivation`'s producer `--check`, both the stale table. With the local table in place, both files pass (29/29);
  - slow (`deriveLevelWorldLogic.slow`): 2/2;
  - train (`deriveLevelWorldLogic.train`, `learnLattice.train`): 5/5;
  - calib: not run (manual-only).
- **CI for the planner to dispatch** (none dispatched here):
  - `seedling-probe.yml -f probes=probe-seedling-derived-rules.mjs` (REGEN_RECIPE; copy the table and re-run the rules producer);
  - `probe-seedling-whole-game-certify.mjs` (vanilla and `--source=er`);
  - the `wasm-er-retarget` probe (the ER layout moved);
  - the surveys / campaign frontier (the ER layout moved; `census-seedling-campaign --write-frontier` was not run here);
  - the train tier (`train_only`), since the slice touches a generator's input.

## 8. Not done, and why

- The precision sketch: not the same code as step 2 (§ answer table).
- The derived-rule table itself: CI recipe.
- `census-seedling-campaign --write-frontier`: I don't have the surveys' data.
- No solver, levelRun or `CONTACT_FIDELITY` change. No edit to `worlds/seedling/`, `vendor/seedling`, `.github/` or any submodule pointer.
- Every `pytest`/`Generate.py` side effect was reverted (`preset_files.json`).

## Evidence (`CC/docs/cloud-reports/rules-l99-sided-killlock-evidence/`)

`tools/`:
- `killlock-census.mjs`
- `er-replay.mjs`
- `sweep-locations.py`
- `sweep-compare.py`
- `sphere-log-compare.py`
- `rules-element-diff.py`

All run from a repo root.

`out/`:
- census before/after;
- AP_1 and ER sweeps before/after, and the old ER layout under the new rules;
- the seed-1 sphere-log comparison;
- the certifier summaries;
- the sweep file list.
