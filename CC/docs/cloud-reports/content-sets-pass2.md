# Content sets PASS-2: declared passability, `needs`, end to end

Branch `content-pass2`, based on `origin/content-pass1` `578deb3473` (PASS-1, land OK 2026-11-19T14:48:27Z, queued with
js-21, frozen). The design is PASS-D's (`content-sets-passability-design.md` § 3 PASS-2, § 2.3, § 2.5), and the brief
is the planner's PASS-2 prompt. The PASS-1 report is `content-sets-pass1.md`.

⚖ Rulings in force:
- Robert, 2026-11-18: "One per slice", "Pack declares, world copies", "Separate, no lying looks".
- Planner, 2026-11-19: the `tileKinds` entry bakes `pass: "needs"` + `needs: <mechanic concept id>`. The obstacle id is
  DERIVED from the cell, not stored. The round trip, the drift report and `withTileKinds` check the gate by name.
  Erasing removes exactly that obstacle, and painting over the cell is refused.

## Commits

| # | SHA | What |
|---|---|---|
| 1/5 | `1a77767a53` | The declaration: `TERRAIN_PASSES` gains `needs`, plus the terrain entry's `needs` field and its refusals, and `terrainOf` |
| 2/5 | `8c9bf2bded` | The lowering: the derived gate id, the realised rule, lower/lift, the payload field, the ownership checks, drift |
| 3/5 | `1a2c7b12fb` | The editor and the round trip: place/erase/replace/floor-over/copy-paste, and the save's ownership check |
| 4/5 | `84a22a86be` | The proof: `mazeTileNeeds.test.js` |
| docs | `9a0b69fc63` | `maze.md`, `concepts.md`, three READMEs, the regenerated README index and `docsIndex` |
| — | this commit | This report |

## 1. The parts as built

### 1.1 The declaration (1/5)

- `packConcepts.TERRAIN_PASSES` is `['walkable', 'blocked', 'needs']`, and `NEEDS_PASS = 'needs'`.
- `STRUCTURE_FIELDS.terrain` gains `needs`. A terrain entry with `pass: "needs"` must carry `needs`, the **bare id of
  a mechanic concept** (`/^[a-z][a-z0-9_-]*$/`). An AP item name (`"Progressive Swim"`) or a namespaced key is refused
  by name (Q8: an item name is logic, and the pack never writes one). `needs` on any other pass is refused by name.
- `packStructure.terrainOf(concept, structure)` returns `{ pass, needs? }`. `terrainPassOf` is kept and now delegates
  to it.
- Whether the concept table knows the id is the maze's question (§ 1.2): `packStructure` and `packConcepts` stay free
  of `procgenCore` imports, as before.
- The on-disk fixture `ground` gains `pool` (needs `swim`). PASS-1's "a field a terrain does not take" pin now uses
  `dirs` (PASS-3's field-to-be), because `needs` is valid now.

### 1.2 The lowering, the field and drift (2/5)

- **The lookup.** `tileKindKeys` spreads `terrainOf`, so a needs kind's table entry is
  `{ artKey, base, pack, pass: 'needs', needs }`.
- **The rule.** `needsRuleOf(concept)` is `conceptSelection.ruleFor({ needs: [concept] }, CONCEPTS)`, the concept-gate
  idiom's rule: `Has(<the concept's item>)`. It is null for a concept the table does not hold as an *unparameterised
  item* concept (`lantern` unknown; `guardian` is an enemy; a `key` need names no one key).
- **The derived id** (the ruling): `mazeSerializer.tileKindGateId(x, y)` = `tilekind_gate_<x>_<y>`. No other placer
  mints that namespace: placeFromRules uses `logic_gate_<n>`, concept gates use `<concept>_gate_<n>`, and the base
  library has its own ids. I measured that nothing on the lab or round-trip path rewrites a payload's obstacle ids.
  `mazeSetAdapter`'s renumbering touches only the overlay ("no payload is rewritten").
- **The definition** (`tileKindGateDef`) is the base library's `logic_gate` with that id and the realised rule. It has
  exactly the shape of a hand-placed logic gate, so its compile is the same by construction, and the proof measures
  it.
- **`lowerTileKind` / `liftTileKind`.**
  - `needs` writes the definition into `obstacleLib` **copy-on-write** (`cloneWorld` shares `obstacleLib` by
    reference, so an in-place write would have leaked into the edit session's base world; pinned) and places the
    obstacle.
  - Lift removes the placement and the definition, and sets floor.
- **The world's copy is still the cell.** No second store holds the concept.
  - `tileKindPassAt` reads a wall as `blocked`, the cell's own derived gate as `needs`, and anything else as
    `walkable`.
  - `tileKindNeedsAt` reads the concept back off the gate's rule: one `Has` of an unparameterised concept item, via
    `procgenCore/concepts.conceptOfItem`.
- **The payload** writes `{x, y, kind, pass: "needs", needs: "sword"}`. Walkable writes neither field, so byte-equality
  holds. The schema row gains `needs`.
- **`withTileKinds`** (`tileKindsFromList` with `ownedGateRefusal`) refuses by name:
  - `needs` without `pass: "needs"`, or the reverse;
  - an unknown concept;
  - the gate missing from the cell;
  - the gate not a rule obstacle;
  - the gate's rule not the concept's;
  - a walkable entry on a cell that holds its derived gate.
- **Drift** (`placedTileKindDrift`). A pass now reads `walkable`, `blocked` or `needs <concept>`, so a changed concept
  (`needs sword` → `needs swim`) is drift as well as a changed pass. First it names a needs kind whose gate was lost or
  altered in memory (`tile-kind-gate-mismatch`). The load would refuse such a world; the report names it.
- **At placement** (`needsRealisationRefusal`), two conditions:
  - the maze must realise the concept as a mechanic (`MAZE_CONCEPT_REALISATIONS[c].tier === 'mechanic'`);
  - the world's item library must hold the concept's item.

Files: `mazeRoom/mazeTileArt.js`, `mazeRoom/mazeTileKinds.js`, `mazeRoom/mazeSerializer.js`.

### 1.3 The editor and the round trip (3/5)

- **`setTileKind`.** A needs kind this world cannot realise is refused (`unrealisable-needs-tile-kind`). Otherwise the
  op lifts whatever a kind here lowered and lowers the declared value in the same op. A kind's own gate is not
  "something else" on its cell for the occupancy rule. Re-placing after drift takes the pack's current value.
- **`clearEntity`** lifts the lowering: the gate's placement and definition go with the kind. Placing and then erasing
  is byte-equal to the room before (pinned).
- **Painting floor** over a needs kind is refused (`needs-tile-kind`), with the same sentence as blocked.
- **Copy/paste.** `readMazeCell` leaves a kind's own gate out of the cell's parts. A paste therefore lowers under the
  *destination's* derived id; copying the id would have planted a gate no kind owns (pinned).
- **The round trip's save** now deserializes with the kinds (`deserializeMazeWorldWithKinds`), so a needs kind whose
  gate is missing, not a rule, or carries another rule is refused by name before anything is derived (pinned).

Files: `mazeRoom/mazeRoomEditor.js`, `mazeRoom/mazeEditAdapter.js`, `mazeRoom/mazeRegionRoundTrip.js`.

## 2. The refusals

| Where | Reason | Sentence |
|---|---|---|
| structure parser | `needs` absent, an AP item name, or a namespaced key | `entry "…": pass "needs" needs \`needs\`, the bare id of a mechanic concept (got …; never an AP item name or a namespaced key)` |
| structure parser | `needs` on another pass | `needs "swim" is only for pass "needs" (this entry's pass is "walkable")` |
| declared (`tileKindRefusal`) | a concept the table does not declare as an unparameterised item | `needsUnknown`: `tile kind "…" needs "lantern", which the concept table does not declare as an unparameterised item concept …` |
| declared | a floor look on a needs kind / a wall look on a needs kind | PASS-1's `floorBaseNotWalkable` / `wallBase`, with pass `needs` |
| placement | a mechanic the maze does not realise, or an item the world does not hold | `needsUnrealisable`: `tile kind "…" needs "sword", which this world cannot realise: the world's item library holds no "Progressive Sword"` |
| editor | floor painted over a needs kind | `floorOverBlocked(…, 'needs')`: `Tile (x,y) holds the needs tile kind "…"; painting floor there is refused: erase the kind first.` |
| payload / save | `needs` and `pass: "needs"` not written together | `tileKinds: entry 0: needs is written with pass "needs", and only there` |
| payload / save | the derived gate missing (including a kind moved off its gate) | `gateMissing` |
| payload / save | the gate not a rule obstacle | `gateNotRule` |
| payload / save | the gate's rule not the concept's | `gateRuleMismatch` |
| payload / save | a walkable kind on a cell holding a derived gate | `gateUnowned` |
| drift report | a gate whose rule realises no concept | `gateRealisesNone` |

Every row is pinned in `mazeTileNeeds.test.js` (the parser rows in `packStructure.test.js`).

## 3. The proof

`frontend/modules/mazeRoom/mazeTileNeeds.test.js` uses a **test-only in-memory** fixture pack, `pass2-fixture`:

| kind | base | declared |
|---|---|---|
| SHRINE | marker | needs sword (the proof's kind) |
| POOL | marker | needs swim |
| RUG | marker | walkable |
| PAINTED | floor | needs swim (refused) |
| GROTTO | wall | needs swim (refused) |
| LANTERN | marker | needs lantern (refused) |

The world is the meta trial's maze region with a thing (`region_2_3`). It is one corridor: the entrance at (4,0), the
swim pickup at (4,1), and an exit at (0,1) behind the committed `water_gate_0` (`Has(Progressive Swim)`). That is why
the proof's kind needs **sword**: a swim gate on that corridor would repeat the existing water gate and move nothing.

- **The cell is read off the data.** It is the first free cell, with a free floor neighbour, where a hand-placed
  `Has(Progressive Sword)` obstacle moves the exits relative to the unedited save. That gave (2,2).
- **The lab path** is TILE-3's and PASS-1's: `open`, the SET arm's room 0, the palette's **Tile kind** press,
  `closeRoomSession`, `save`, the registry reload, and a second `open`.
- **The control** is the same path with the palette's **Obstacle** press of a hand-placed rule obstacle,
  `logic_gate_hand` (the base `logic_gate` with `Has(Progressive Sword)`, added to the room's library), on the same
  cell.
- **The results:**
  - the payload carries `[{2,2,shrine,pass:"needs",needs:"sword"}]`, the placement `{2,2,tilekind_gate_2_2}` and the
    definition;
  - `tiles`, `exits` and `locations` equal the control's;
  - the exits differ from the unedited save's, so the equality is not vacuous;
  - the location names equal the unedited save's, so the gate is never a location;
  - the thing has not moved.
- **The readers.** The room's only pickup is the swim on the corridor, so the solver checks run on a clone with the
  pickups removed, starting beside the gate, where the gate alone decides:
  - `bfsSolver`: `unreachable` without the sword, reached with it;
  - `step`: `null` without it, a state with it;
  - `whyBlocked` names the gate; with the sword it gives `null`;
  - `findPath`: `null` with `inventory: {}`, a path with `{Progressive Sword}`.
- **Both views**, with no art and with the `meta` theme: the panel's draw and the composite cell contain
  `paintMazeTileBase(marker)` at (2,2), and `drawMazeTileKinds` reports `{2,2,shrine,as:'base'}`. Nothing warns or
  throws.
- **Mutation checks:**
  - with the gate placement in `lowerTileKind` removed, 6 of the 11 tests red;
  - with `readMazeCell` copying the kind's own gate, the copy/paste pin reds.
- No committed preset or pack gains the fixture (§ 5).
- **No screenshots.** The box was held by other sessions' browser runs (`npm test test-spoilers`, then
  `test-substrates`, then `check-seedling-lab-load-in-js.mjs`) for the whole window, and the brief takes them only
  when the box is free. The draws are pinned in node. PASS-1's screenshots show the same two painters.

## 4. Drift

The pin (§ 4 of the test) changes the fixture's structure after the save: SHRINE goes from `needs sword` to
`needs swim`, and POOL from `needs swim` to `walkable`. The results:
- the reload succeeds;
- the gate's rule stays `Has(Progressive Sword)`, so it is never re-lowered;
- both drifts are listed by name (`was placed as "needs sword", but the loaded packs now declare it "needs swim"`);
- the serialized `tileKinds` are byte-equal;
- re-placing SHRINE takes `Has(Progressive Swim)`.

A gate altered in memory (its rule set to `True_`) is named `tile-kind-gate-mismatch`. The lab's note and the panel's
`getTileKindStatus().drift` read the same function (PASS-1's wiring, unchanged).

## 5. Closure, byte-equality, op-log identity

| Instrument | Result |
|---|---|
| `--print-engine-closure`, base `578deb3473` and tip | **identical**: `engineMd5 bec369878feb67081187edca62baa951`, 42 files. `mazeTileNeeds.test.js` § 5 pins the eight PASS-2 files out of the closure. `mazeTileKinds.js` now imports `mazeConcepts.js` and `procgenPipeline/conceptSelection.js` (both in the closure), which is allowed: the closure is what the engine imports, not what imports it |
| **Op-log probe**, keyed on relative paths. Base `578deb3473` is a `git archive` export with the same `shared` commit `71b77deb8a`. The probe covers every maze region of every committed `*_rules.json`: the panel draw in plain and fog views under no art and the `meta` art, plus the composite cell | base = tip: 38 documents, 1,188 regions, 4,815,966 ops; none `320e803df3a09d94b526dfbde23ce293`, meta `bf5a0548e76dc66aebccba71ee3b8822`, composite `293be8744efe6b22a40724fe61b1213d`. These are the same hashes as PASS-1 and as main `427ccd5c93` |
| `make-seedling-spiral-room-preset.mjs --state=concept-trial --check` / `--state=meta-trial --check` | both OK |
| `action-nodes-compile.mjs --check` | OK, byte-identical |
| `check-sidecar-fields.mjs` | ALL PASS: 2,264 entries, 0 issues (30 warnings, as at PASS-1) |
| `generate-procgen-reference.mjs --check` / `check-procgen-docs.mjs` / `check-maze-lab.mjs` | ALL MATCH / ALL CHECKS PASSED / ALL CHECKS PASSED (both browser checks waited for the box: `--wait-for-box`) |
| Presets and packs against base | only `frontend/packs/README.md`. No preset or pack data byte differs |
| Gitlinks changed | **0** |

## 6. Gates

- **Bounded vitest:** `frontend/modules/{mazeRoom, apworldEditor, packConcepts, packStructure, contentPacks,
  procgenCore, procgenDocs}` and `scripts/procgen/lintGateLabels.test.js`. 228 files, 6,539 tests, of which 6,538
  passed.
  - The one red was `tileSpike/sphereOrderLevels.test.js` "L12 certifies clean": `Test timed out in 60000ms`, while
    the op-log probe and `check-sidecar-fields` ran beside it. Re-run alone: 35/35 passed. No file of this diff is in
    its import closure (the engine closure is unchanged).
- No glossary term was added, and PASS-2's docs add no markdown link, so the doc-link census stays at 440.

### 6.1 CI at `9a0b69fc63` (the code + docs tip, before this report), all success

- ut 44551748343.
- JSUT 44551748070: suite 1367/28976 (28,976 passed, 0 failed), slow 36/438.
- TT 44551746865: every on-push batch HEADROOM OK. Largest:
  - fast 274.2 s of 600 s (46%);
  - fast bundled 270.3 s (45%);
  - seedling-js 214.4 s (36%);
  - apworld 209.7 s (35%);
  - seedling-js-solver 185.1 s (31%);
  - seedling-wasm 182.9 s (30%);
  - playback-bot 111.3 s (19%).
- feature-checks 44551754245.
- Gitlinks changed: 0.

## 7. Test paths

- `frontend/modules/mazeRoom/mazeTileNeeds.test.js` (new): the lookup, every refusal, the realisation, the editor,
  copy-on-write, copy/paste, the payload and ownership, the save, the proof, drift, the closure.
- `frontend/modules/packStructure/packStructure.test.js`: the `needs` parser refusals and `terrainOf`; the `ground`
  fixture's `pool`.

## 8. What the code overturned

1. **"A concept the stack does not declare."** A pack stack declares no mechanic concepts: they live in
   `procgenCore/concepts.js`, which the pack layers never import. The refusal therefore checks the *concept table*, in
   `tileKindRefusal` (an unparameterised item concept), and the pack parser checks only the id's form.
2. **Only two concepts can be needed today.** The table's unparameterised item concepts are `sword` and `swim`, and the
   maze realises both as mechanics. The "the maze does not realise it as a mechanic" branch is therefore unreachable
   through placement today. It is pinned directly with `guardian`, an enemy that is a skin gate.
   - "The world cannot realise it" is measured off the world's item library. That library is per region and merged
     over the base, so it is the world's own list of items its rules may name.
3. **`cloneWorld` shares `obstacleLib` by reference.** The first lowering any kind does into a library is PASS-2's.
   Writing it in place would have leaked the gate into the edit session's base, so it is copy-on-write and pinned.
4. **Copy/paste would have planted an unowned gate.** `readMazeCell` reported the kind's gate as the cell's obstacle,
   so a paste would have placed `tilekind_gate_<a>` at cell b. It is excluded and pinned.
5. **The concept is read back off the gate, not stored.** That follows the ruling ("derived from the cell") and
   PASS-1's "the grid is the bake": `conceptOfItem` of the gate's one `Has`. A gate whose rule realises no concept is
   named by drift and refused by the load.

## 9. Next slice's line

**PASS-3, `one-way`, which moves the closure.**
- Part 0: `ghostStep` and `minimalObstacleSets` in `extractPathsAndObstacles`, and the autopather's `_bfsToGoal`,
  read `entry_gates`. This is pinned by PASS-D's 5×3 corridor probe as a test: the extractor equals `step`'s
  reachability on entry-gate worlds.
- Then: the terrain entry gains `dirs`, lowered to `entry_gates` `{x, y, dir, gate: null}` for every other direction.
- It owes the derived-table `REGEN_RECIPE` in the same packet, a P3 timing pass, and a designer review if the
  table's verdicts move.
