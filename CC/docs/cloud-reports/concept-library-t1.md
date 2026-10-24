# Concept library T1 — the maze realises three concepts (cloud report)

**Worker:** `concept-library-t1` (Opus build slice, cloud fan-out, 2026-09-30).
**Branch (harness-designated):** `claude/concept-library-t1-v70lk5`. The harness only pushes to this branch, so the brief's local name `concept-library-t1` was not used.
**Started from:** `53b2e2e` (origin/main, T0 merged). **Code head:** `eb90559`. This report is the commit after it.

| D | Commit | Verdict |
|---|---|---|
| D1 the seam | `2770eee` | PASS |
| D2 the realisations | `67ce4d3` | PASS, with one leg changed on a measurement (no `libraryItems`, see D2) |
| D3 the skin is visible | `0fb5493` | PASS |
| D4 a world that shows it | `39be383` | PASS. One brief assertion measured false (item colour, see D4) |
| D5 records | `eb90559`, then this report | PASS |

## W0: BEFORE and AFTER

| Gate | BEFORE (`53b2e2e`) | AFTER (`eb90559`) |
|---|---|---|
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` | `58820064449a5afa2441d34466fcb20a` | identical |
| `generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | same line |
| bounded vitest, W0 list | `Test Files 45 passed (45)` / `Tests 2210 passed (2210)` | `47 passed (47)` / `2232 passed (2232)`. The +2 files are the new `mazeConcepts.test.js` and `mazeConceptPaint.test.js`. |
| bounded vitest, W0 list + every file touched + the TA room and the gen-room entry | — | `Test Files 54 passed (54)` / `Tests 2425 passed (2425)` |
| **preset-hash** (scratch harness: md5 of every shipped non-heavy preset's `rulesJson`, generated through `buildRunFromState` → `runPresetHeadless`, the slow row's own assembly) | `ALL 725d074b6b73fd56cc0f9a50cad849bd` (22 presets) | identical |
| `dump-sphere-byteidentity.mjs` / `dump-topdown-byteidentity.mjs` | `2ba8a964…` / `f5557cf9…` | identical |
| `check-procgen-docs.mjs` | — | `ALL CHECKS PASSED`, exit 0 |

⚠ **The committed-preset md5 cannot catch a code change**, because this slice commits no preset. The preset-hash harness is the gate that actually regenerates the shipped worlds. It is what caught D2's `libraryItems` move. The harness lives in the scratchpad and is not committed; its body is the loop in `presetDefs.generate.slow.test.js` with the assertions replaced by an md5.

The wasm submodule was not needed. `flashSeedlingGen.test.js` ran green headless.

## D1: the seam (`2770eee`)

**What landed:**

- `presetRun.DEFAULT_PARAMS.concepts = []`.
- `sphereConfigHooks.assembleRegionParams` writes `regionParams.concepts` (as a copy) **only when the list is non-empty**. All four builders (sphere, spiral, top-down, grid) go through it, so a world that names no concept gets no new key.
- `generateRegionProcedural` passes `params: spec.params` to `placeFromRules`.
- The pipeline panel's Parameters section has a *Concepts* row with one checkbox per `CONCEPTS` id. Boxes are written in table order and saved to local storage.
  - The two R1 pins in `procgenPipelineUI.test.js` (the bag-key fixture and the DOM hash) now splice that one new row out, the same move as their `unwrapForms`, and hold the rest of the section to the captured fixture.
  - A new suite holds the row itself.

**Gate rows** (`conceptSeam.test.js`, 9 rows):
- the knob is `[]`;
- empty or absent → no key; non-empty → a copy, in both modes;
- the engine hands the region's params object to the placer (a probe substrate);
- the text adventure's `placeTextAdventureRules` and the generated Seedling room's `placeFromRules` return the same result and leave the same room with or without `params: {concepts: all}`;
- `mergedItemLib` (D2's replacement leg, below).

**Mutant (a):** remove the `params` line.
- Predicted 1 red at D1 (the hand-off row); measured 1.
- Re-run after D4: predicted 2 red (the hand-off row and D4's gate row); measured 2, both named.
- Restored; tree clean.

## D2: the maze's realisations (`67ce4d3`)

**What landed:**
- `mazeRoom/mazeConcepts.js`, with `MAZE_CONCEPT_REALISATIONS`:
  - `sword` and `swim`: `{tier: 'mechanic'}`.
  - `guardian`: `{tier: 'skin', art: {name, color, symbol}, placements: {gate: {effect: 'requires', needs: ['sword'], mechanic: {obstacle: 'guardian_gate'}}}}`.
  - `water`: the same shape, with `needs: ['swim']` and `water_gate`.
- `conceptGateFor(rule, {offered, rng, n, logicGateBase})`.
- The entry declares `conceptRealisations`.
- In `placeFromRules`, `registerGate` asks `conceptGateFor` first.
  - A candidate is registered as `{...logicGateBase, id: '<obstacle>_<n>', clear_set_type: 'rule', clear_rule: rule, concept, placement, name, color, symbol}`.
  - `null` gives today's `logic_gate_<n>`, byte for byte.
  - Both share one counter, so ids stay unique within a region.
- The `substrate-registry.md` § *Entry contract* row under *Build-time — procedural substrates*. After regenerating: registry `84 fields over 15 groups … 0 FINDING(S)`.
- Link-census pins 312 → 313 (`doc` 239 → 240), summed in the pin comments.

**⛔ The `libraryItems` leg was refused on a measurement.** With `libraryItems` derived from `itemRowsOf` and tagged, the preset-hash moved `shipped:topdown-maze-ta-demo` and `shipped:topdown-zones-demo`. No concept was named in either.
- I removed that one field and nothing else, and the hash went back to `725d074b…`.
- **Cause:** `topDownSteps.grantedLibraryItems` grants every in-mix substrate's `libraryItems` as free starting items. So a static declaration on the maze changes every top-down world that mixes in the maze.
- **Replacement leg (inert by construction):** `presetRun.mergedItemLib` adds the table's `itemRowsOf` rows for each item concept the **world** names, and never overwrites a row a library already declares.
- The feature-tag / `supportedFeatures` part of the brief was dropped with it, because no item carries the tag any more.

**Gate rows** (`mazeConcepts.test.js`, 14 rows):
- `assertRealisations(ENTRY, CONCEPTS)`, and `conceptsRealisedBy` as expected.
- For params absent, `{}` and `concepts: []`: `logic_gate_0` / `logic_gate_1`, the serialized world equal to the control's, and equal draws.
- Per concept (guardian, water), on the exit and on a location:
  - `<concept>_gate_0`, with the whole definition pinned;
  - `extractPathsAndObstacles` + `compileRegion` give the same exit and location rules as the control;
  - the same tiles and items, and the same number of draws.
- By name: `['guardian']` skins `Has(Sword)` but not `Has(Swim)`.
- These stay `logic_gate` even when every concept is offered: `Has(key_red)`, `Has(Swim, 2)`, `And(Sword, Swim)`, `Or(Sword, Swim)`.
- `conceptGateFor` works on an rng that only has `next`, with no draw for 0 or 1 candidate.
- Payload round trip: `obstacleLib` extras are `['guardian_gate_0', 'water_gate_1']` with their full definitions, and after deserialisation the compiled rules equal the control's own round trip.

**Mutant (b):** `offered` is ignored (every world offers everything).
- Predicted: 4 red (the three concept-less byte-for-byte rows and the by-name row), and the preset-hash unchanged.
- Measured: 4 red, all named. **The preset-hash did move (`ALL 578926…`), so that part of my prediction was wrong.** The only preset that moved was `shipped:seedling-generated-swim-demo`: a maze region in that shipped world gates on exactly `Has(Progressive Swim)`.
- So the brief's "the byte-identity row reds" holds for the regenerated-preset hash, not for the committed md5.
- Restored; the hash was back to `725d074b…`.

## D3: the skin is visible (`0fb5493`)

**What landed:**
- `mazeConcepts.paintConceptGate(ctx, {x0, y0, px, def, cleared})` and `isConceptGate(def)` (a `rule` gate with a string `concept`).
- When closed, the gate is an inset square in the concept's colour with a black border and its symbol.
- When cleared, it uses the coloured door's idiom: alpha 0.4, a 1.5px dashed outline, and the symbol.
- `mazeRoomRender.drawWorld` and `mazeCompositeMap` call it. A plain `logic_gate` has no `concept` and never reaches it.

**BEFORE capture, at `67ce4d3`:** the same world placed with `concepts: []` and with guardian + water drew identical logs: `drawWorld` 264 ops `bac171cf…`, composite 182 ops `f9a439a1…`. The skin was invisible.

**AFTER:** the concept-less world gives the same two hashes (pinned in `mazeConceptPaint.test.js`). The skinned world draws 288 / 206 ops, which is 12 ops per gate. The seven captured `mazeRoomRender.test.js` fixtures (from `868c39266`) are still green.

**Mutant (c):** `concept` dropped from the registered gate. Predicted 5 red (3 paint rows and the 2 exit-definition rows); measured 5, all named. Restored.

## D4: the world (`39be383`)

`conceptWorld.test.js`, 5 rows. It uses a maze-only sphere-growth world with seed 1, 3 spheres, no filler and 25% revisit. The items are `{Progressive Sword: 1, Progressive Swim: 1, victory: 1}`, built with `buildRunFromState` → `runPresetHeadless` twice.

**Prediction before the run:** ≥1 `guardian_gate_*` and ≥1 `water_gate_*`; any `And` or cumulative gate stays `logic_gate`.

**Measured:**

| | control `concepts: []` | `concepts: [sword, guardian, swim, water]` |
|---|---|---|
| gates | `region_2_2:logic_gate_0`, `region_2_3:logic_gate_0` | `region_2_2:water_gate_0`, `region_2_3:guardian_gate_0` |
| exits | `Menu→2_2 True_`, `2_2→2_3 Has(Swim)`, `2_3→3_3 Has(Sword)`, and the two back-exits | the same |
| oracle | `[]` | `[]` |

**Rule equality:** `rulesJson.regions` is deep-equal, and so is the whole `rulesJson` apart from `preset_sidecars`. The concept changed the picture and never the logic.

**⚠ Measured false in the brief: "the world's `items[]` carries the two concept items with the table's colour."**
- `rulesJson.items` does carry both items, but only `name`, `id`, `classification` and `groups`. It carries no colour for *any* item, in either world.
- The world's item library (`mergedItemLib`) does carry the table's colour, and that is what the row asserts.
- The region payloads' `itemLib` extras are `{}`, pinned as a finding. The sidecar serializer's base is the merged library, so a row the library already holds never travels. At play time, `deserializeWorld(payload)` uses `DEFAULT_ITEMS`, so the pickups draw with the foreign hash colour.
- This also applies to every substrate's `libraryItems` (bounce's abilities in a maze region, for example), and T0's static-`libraryItems` design would not have fixed it.
- **Proposed patch (not applied, to avoid widening):**
  1. `mergedItemLib` marks the concept rows it adds (`concept: '<id>'`).
  2. `serializeMazeWorld` carries an `itemLib` row that carries `concept` even when the base holds it.
  3. This is inert for concept-less worlds, because no row is marked.

## What T0's API was short of (findings; local workarounds)

1. **`guardian` and `water` have no presentation in `CONCEPTS`**, so the brief's "colour + symbol from the table" is impossible for the gates. Workaround: the maze's realisation `art: {name, color, symbol}`, which the contract allows. A later table row could move it.
2. **`sword` and `swim` carry no `feature`**, so `itemTagsImpliedBy(mazeEntry)` returns `[]` and "T0's `itemTagsImpliedBy` names it" does not hold. This is pinned in `mazeConcepts.test.js`. It became moot once `libraryItems` was refused.
3. **`selectRealisation` needs `rng.choice`**, and the maze's placer rng is the shared `createRng` (it has `choice`). `conceptGateFor` still wraps a `next`-only stream, `{choice: arr[floor(next()·len)]}`, which is the same draw as `rng.js`. With this table no rule ever has 2+ candidates, so nothing is ever drawn.
4. **`selectRealisation` wants an entry, and the engine cannot import the registry entry** (`mazeRoomLibrary` → `adapterPrimitives` → `mazeRoomEngine` would be a cycle). The realisations therefore live in `mazeConcepts.js`, which both import. The engine passes `{conceptRealisations}` as the entry.

## What the brief got wrong (measured)

1. **`libraryItems` on the maze is not byte-inert.** Top-down grants it as starting items, which moved 2 shipped top-down presets (D2).
2. **"The world's `items[]` carries the table's colour":** `rulesJson.items` carries no colour for any item, and the payload does not carry it either (D4).
3. **"Mutant (b) ⇒ the byte-identity row (W0's md5) reds":** the committed-preset md5 cannot red from a code mutant. The regenerated-preset hash does red (`seedling-generated-swim-demo`).
4. **The TA and gen-room placers "ignore unknown input keys":** true, and now proven by a row (D1).
5. `maze.md` has no obstacles section. The `###` went under *The engine*, next to placement.

## Residue

- **Merge collisions with T2:**
  - the `substrate-registry.md` row (T2 adds the same row; keep one);
  - the link-census pins, now 314 / `doc` 241 (sum the deltas);
  - `concepts.md` (each worker adds its own section);
  - the generated `docsIndex.js` / `README.md` (regenerate).
- **Surfaces that read `libraryItems` but not the world's concepts:** the APWorld editor's initialise/regenerate (`mergeSubstrateItemLib`) and top-down's grant. So a concept item exists only for pipeline worlds built from `presetRun`. The editor's paths pass no `concepts`, so they are inert.
- **The pipeline panel's concept list is not yet in any shipped preset,** and there is no concept preset (ruled out).
- **Not run here:** the CI vitest suite number for `eb90559` (⚖ ruling 52). No pytest; no unfiltered vitest; no `git stash`; no edit to `concepts.js`, `conceptSelection.js`, `substrateCapabilities.js`, `library.js`, any submodule, `package.json`, or T2/F1 files.
