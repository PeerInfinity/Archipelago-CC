# Content sets GEN-1: the "Randomly placed tiles" biome (walkable and blocked kinds)

Branch `content-gen1`, based on `origin/main` `f901049815`. The design is GEN-D's (§ 4 GEN-1, as revised by § 9). The
brief is the planner's GEN-1 prompt.

⚖ Rulings in force (Robert, 2026-11-22):
- 16:32:57Z:
  - Q2: a new small pack, in GEN-2; GEN-1 uses a test-only fixture pack.
  - Q3: a kind qualifies only with `generate: true`.
  - Q4: kinds come only from the "what exists" packs, never a theme.
  - Q5: logic-preserving placement only.
  - Q1, verbatim: *"This should be controlled by the biome, and the generation settings. What you just made could be
    called the "randomly placed tiles" biome."*
- 17:41:25Z:
  - Q7: "Classic now, walls setting later".
  - Q8: "A per-room mix".
- Planner decisions:
  - shape C;
  - Q6: walkable and blocked only;
  - the mix's shape: an id or a weighted list, picked by hash of (seed, region), stamped in the sidecar.

## Commits

| # | SHA | What |
|---|---|---|
| 1/6 | `7a70cb9899` | `packStructure`: terrain `generate` (a boolean, refused by name otherwise) and `terrainGenerates`. The `ground` fixture opts in its rug and pillar, sets `generate: false` on its pool, and leaves its ledge without the field |
| 2/6 | `794d3426c7` | `worldContent.loadContentSet(stack, {exists})` loads the `structure` layer of the "what exists" packs **only**, into `set.structure` / `set.structureIds`. Every caller passes its world's `exists`: `presetRun`, the panel, `attachContentSet`, `sphere-step`, `topdown-step`. `recordedContentOf` also records each registry entry's `recordedRegionParams` keys, and `rebuildRegionParams` reads them back |
| 3/6 | `ebcbc87eb6` | `mazeRoom/mazeRegionBiomes.js`: the region-biome table (`scattered`, "Randomly placed tiles", base `classic`, tileKinds 5 / 8 / 1); the world setting normalised and refused by name; the hash pick; `engineBiomeOf`. `mazeLocationCapacity.mazeRoomIsOpen` resolves through it |
| 4/6 | `92c71e19b5` | `mazeRoom/mazeTileKindsGen.js`: which kinds qualify, the slot count, the law, and the two OUTERMOST wrappers on the maze entry. The entry gains `buildRegionParams`, `regionBiomeOf` and `recordedRegionParams`. The engine asks `adapter.regionBiomeOf` for a region whose spec names no biome. The *Maze biome* list editor goes in the maze parameters |
| 5/6 | `f414c22c90` | `procgenPipeline/scatteredBiomeWorld.slow.test.js`: the whole-world proof |
| 6/6 | `beffd62533` | Docs: `maze.md` § Region biomes; `substrate-registry.md`'s two new fields; the glossary `biome`; both READMEs; the regenerated reference; doc-link census 448 → 450 |

## 1. What was built

- **The biome.** `scattered` is not a row of `BIOMES` (`skeletonKinds.js`, in the closure). It lives in a maze-only
  region-biome table outside the closure.
  - The registry entry's core wrapper hands the engine the `base` (`classic`).
  - It re-stamps the world's and the result's `biome` as `{id: 'scattered'}`, adding `tileKinds` only when the
    numbers are not the biome's own.
  - It records a position-less plan: the qualifying kinds, the numbers, and the region rng's state, **read** but never
    advanced.
  - A `scattered` world that offers no kind is refused by name.
- **The placement** (the serializer wrapper, after every roll):
  - the world is serialized once, to seat its things;
  - the kinds are placed on a copy (tiles copied) that avoids those things;
  - the copy is serialized.
  - No plan, or nothing placed, returns the inner serializer's own output. The world object itself is never mutated.
- **The slots.** Each room gets `min(cap, max(min, round(percent × free / 100)))` slots, and 0 with no free cell.
  - A slot's kind is `hash32("<state>:<region>:kind:<i>")`. If that kind finds no legal cell, the plan's other kinds
    are tried in turn.
  - The cells are ranked by `hash32("<state>:<region>:<i>:<x>,<y>")`, up to `TILE_KIND_TRIES_PER_SLOT` (60).
- **The law** (`tileKindLawRefusal`). A walkable kind changes no tile. A blocked kind is kept only if:
  - (a) no reachable floor cell is cut off;
  - (b) the compiled rules (`compileRegion(extractPathsAndObstacles(…))`) are byte-equal;
  - (c) `longestShortestPath` is unchanged.
- **The setting** (`params.mazeBiome`, `params.tileKinds`):
  - `buildRegionParams` writes them only when they are not the default, with `mazeBiomeSeed` alongside a mix.
  - `classic`, `[classic]` or absent means no key. A one-element list is the single id.
  - It refuses by name, at settings time: an unknown id, a bad or duplicate weight, an unknown row field, numbers out
    of their domains (`percent` 0–25, `cap` 1–32, `min` 0–`cap`), and `tileKinds` with no tile-placing biome.
  - The pipeline calls `adapter.regionBiomeOf?.({params, regionId})` in `generateRegionProcedural` (before the sizing)
    and in `buildSubstrateRegion`, so the pipeline still names no substrate.
- **The panel.** The maze parameters gain a *Maze biome* block (`MAZE_BIOME_ROW_CLASS`):
  - one select per row;
  - a weight and a − button when there are two or more rows;
  - a "+ biome" button;
  - the three numbers, shown while a row's biome places tiles.

## 2. The proof

| Claim | Where | Result |
|---|---|---|
| Sphere growth (`maze-sphere-demo`): `rules.json` minus sidecars and setting keys equals the control (same state, no biome); each room's payload equals the control's except `tileKinds` and the walls under pillars; sidecar `biome` is `scattered` vs `classic` | `scatteredBiomeWorld.slow.test.js` | ✅ 7 rooms; 7 rugs, 2 pillars |
| Grid growth (`grid-growth-demo`) | same | ✅ 5 rooms; 5 rugs, 0 pillars (small carved rooms: no pillar holds the law) |
| Shuffled spiral (`content-spiral-mix`) | same | ✅ 2 rooms; 2 rugs |
| Top-down (`topdown-maze-ta-demo` over Adventure) | same | ✅ 6 rooms; 6 rugs, 6 pillars |
| Things do not move (meta theme), and kinds avoid their cells | same | ✅ |
| The mix (classic + scattered) equals the control's logic; each room is `pickMazeBiome(setting, seed, region)`; a rebuilt world (`rebuildRegionParams` off the record) picks every room the same | same | ✅ both biomes occur |
| A one-element list equals the single id, the whole `rules.json` byte for byte | same, and `mazeRegionBiomes.test.js` (regionParams) | ✅ |
| An unknown id in the list is refused by name before anything is built | same (through `prepareRunFromState`), and the unit table | ✅ |
| Law (b) alone: a pillar on Light World (2,1) cuts off no floor and keeps the walk, but kills an exit | `mazeTileKindsGen.test.js` | ✅ `changes-rules` |
| Law (a): a pillar on carved `region_1_0` (1,3) | same | ✅ `cuts-off-floor`; the dead-end tip (0,2) holds |
| `placeTileKinds` on Light World: 8 of 8, rules, walk length and reach equal, deterministic | same | ✅ |
| Qualifying kinds: generate: true, walkable or blocked only, honest looks; ⛔ a theme cannot place one (no "what exists" ⇒ none) | same | ✅ rug, pillar; pool (`generate: false`) and ledge (no field) out |
| The wrappers pass every other biome through untouched; the serializer with no plan returns the inner output; with a plan the world itself is not mutated | same | ✅ |
| A `scattered` room is sized as its `classic` twin | `mazeRegionBiomes.test.js` | ✅ |
| No GEN-1 file is in the engine closure | `mazeTileKindsGen.test.js` (`importClosure`) | ✅ |
| The setting loaded with no `exists` reads no `structure` file | `worldContent.test.js` | ✅ |
| The control writes `mazeBiome` and `tileKinds`, and nothing until edited | `procgenPipelineUI.test.js` | ✅ |

**Mutation checks:**
- With law (b) deleted, the Light World (2,1) pin turns red. The four world rows stay green: no world they build
  offers a pillar that only (b) refuses. So the unit pin is the guard, by design.
- With the things-first step deleted, the things row turns red.

## 3. Pins that moved

- `mazeRoomLibrary.test.js`: *"the maze has no buildRegionParams"* is restated. The hook exists, and it returns `{}`
  for the defaults.
- `procgenPipelineUI.test.js`: the R1 pins splice the *Maze biome* block out, the same move as the arrival row. Its
  own rows were added.
- `worldContent.test.js`: the set's keys gain `structure` and `structureIds`.
- `packStructure.test.js`: the terrain field list gains `generate`, plus a refusal row and a `terrainGenerates` row.
- Doc-link census 448 → 450 (`docLinks.test.js`, `docsRender.test.js`):
  - maze.md → its own § Region biomes (1 same-doc);
  - the registry's `regionBiomeOf` row → it (1 doc).
- The generated reference (registry matrix, capabilities, docs index) was regenerated.

## 4. Gates (local, at `beffd62533`)

| Instrument | Result |
|---|---|
| `--print-engine-closure` | `74ae60f575531492ed9eaec1839e1fe3`, 42 files, unchanged; closure ∩ diff = ∅ |
| `refresh-seedling-derived-rules.mjs --check` | fresh and on count |
| `ci-producer-checks.mjs` | 99 run, 0 red, 1 skipped (its named exclusion); `regenerate-procgen-topdown-presets` OK |
| World tests | `metaTrialWorld`, `conceptTrialWorld` (in the bounded run); `seedlingAtlasHost`, `seedlingGeneratedHost`, `seedlingGeneratedSwim`, `seedlingGenerated`, `seedlingSphere`, `seedlingSpiral`: 51 passed |
| Region probe, main `f901049815` (a `git archive` export with the same `shared`) vs the tip: every committed maze region through the tree's own registry entry (deserialize → extract + compile → serialize) | **identical**: 38 documents, 1,188 regions, `298e902adbc7fdde9c70b07e0c170ac2` on both |
| `check-sidecar-fields` | ALL PASS (2,424 entries, 0 issues); rule agreement 0 FAIL |
| `action-nodes-compile --check`, `make-seedling-spiral-room-preset --check` | OK |
| `generate-procgen-reference --check` | ALL MATCH |
| `check-procgen-docs`, `check-maze-lab` (browser, each with its own server on this tree, queued for the box) | ALL CHECKS PASSED / ALL CHECKS PASSED |
| Bounded vitest (`mazeRoom` with `tileSpike`, `procgenPipeline`, `packStructure`, `packConcepts`, `contentPacks`, `procgenCore`, `procgenDocs`, `apworldEditor`, `lintGateLabels`) | first run: 5 expected pin reds, all fixed. Second run: 8 **timeouts** (60 s / 120 s) in untouched files, run while `ci-producer-checks --jobs=6` held the CPU. All 6 files re-run alone: 135 passed |
| Slow tier: `scatteredBiomeWorld.slow.test.js` | 8 passed |
| Committed presets moved | **none** (`git diff --stat origin/main -- frontend/presets` is empty) |
| Gitlinks changed | 0 |

## 5. CI at the tip

**At the code tip `beffd62533`** (all success):

| Run | Id | Result |
|---|---|---|
| `unittests` (push) | 45055640529 | success |
| JSUT (push) | 45055640581 | success; suite 29,595 passed / 0 failed; slow battery 446 passed |
| TT (dispatch) | 45055703455 | success; headroom OK on every batch (fast 55%, fast bundled 52%, seedling-js 46%, seedling-js-solver 34%, apworld 26%, seedling-wasm 25%, playback-bot 23%) |
| feature-checks (manual batch) | 45055706104 | success |
| `train_only` (dispatch) | 45055709260 | success, 3/3 train shards |

**The merge of main.** `origin/main` moved `f901049815` → `9e8172bf58` (21 commits) and was merged ONCE, in
`528f6263a2`. Two files conflicted, both inside generated regions: `procgen/README.md`'s docs-index block and
`procgenDocs/generated/docsIndex.js` (word counts). They were resolved by regenerating. After the merge:

- the closure is still `74ae60f5…`, 42 files, ∩ diff = ∅;
- refresh-derived `--check` OK;
- generate-procgen-reference `--check` ALL MATCH;
- check-sidecar-fields ALL PASS;
- the bounded vitest (procgenDocs, the GEN-1 tests, packStructure, worldContent, procgenPipelineUI) 743 passed;
- the slow test 8 passed;
- gitlinks 0, no preset moved.

CI at the final tip: in the report-back message.

## 6. What the code overturned

1. **A slot whose hashed kind has no legal cell would leave a small room bare.** The first build placed nothing at all
   in the spiral's two rooms (1 and 3 free cells: the pillar was hashed, and no pillar holds the law there). A slot
   now tries the plan's other kinds in turn, so a room that can hold a rug gets one. The design's "a slot that finds
   no cell is skipped" still holds when no kind fits.
2. **A mix needs its seed recorded.** The brief's record is `mazeBiome` + `tileKinds`. A rebuilt world (an append)
   re-picks every room by `hash(seed, region)`, so `mazeBiomeSeed` is recorded beside a multi-biome mix. A single id
   needs none.
3. **The pipeline needed a hook, not a key.** The design's one line (`spec.biome ?? params.mazeBiome`) would name a
   maze key in the engine. Instead the engine asks the substrate (`regionBiomeOf`), and two drivers' paths needed it:
   `generateRegionProcedural` (sphere growth, top-down) and `buildSubstrateRegion` (grid growth, the spiral).
4. **Recording a substrate's own settings had no generic channel.** `recordedContentOf` named the content keys only.
   The entry's `recordedRegionParams` now names the keys every driver records and a rebuild reads back.
5. **The maze lab's own scan forbids a `mazeRoom/` file importing the pipeline engine, test files included**
   (`mazeSerializer.test.js`). The whole-world proof therefore lives in `procgenPipeline/`.
6. **Blocked kinds rarely fit the committed small rooms** (grid growth and the spiral: 0 pillars), as GEN-D measured.
   The non-vacuity rows require pillars only where they land (sphere growth and top-down).
