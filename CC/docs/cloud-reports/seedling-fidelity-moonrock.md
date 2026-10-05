# Seedling fidelity MOONROCK: the event never fires on the delivered set, and the L110 repoint is STOPPED (measured)

**Slice:** `seedling-fidelity-moonrock`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`).

⚖ **The user** (2026-10-04, verbatim): *"Instead of having the moon rock event create a backup entrance, maybe it would make more sense to change it so that the moon rock event is never triggered, and the entrance that would normally be reached from falling into the moon rock is instead reached directly from the fall from the room above it."* The same day the user approved two edits to the delivered set:
1. L0 without its `<moonrock>`;
2. L110's control set to `fallthrough=2 xOff=-48 yOff=-32`.

| | |
|---|---|
| Started from | `origin/fidelity-harvest/sf-f7` @ **`0aab89b4d8`**, as briefed |
| Head | the last commit on the branch (this report is committed last) |
| Branches | local `seedling-fidelity-moonrock`; pushed to the harness branch **`claude/moonrock-event-removal-q5a4kp`** |
| Commits | D2 **`a31792f`** · D3 **`f448e18`** + fix `909dbf7` · D4 records `8086f71` · this report |
| Dev server | `serve-nocache.py 9240` (this tree) |
| Verdicts | **W0 PASS · D1 PASS · D2 PARTIAL: edit 1 landed, edit 2 STOPPED (a user question) · D3 PASS · D4 PASS** |

## The one thing to know first

**The approved L110 repoint defeats its own purpose, and the event's removal already gives the user's outcome.** Measured on the game (p4f, headless):

- **Every fall arrives from the ceiling.** `Player.check()` puts the player at the camera top, and `Player.update()` drops it onto its tile. `Teleporter.update` fires on any overlap and has no `fallFromCeiling` guard.
- **With the approved repoint**, the descent into L2 (48,32) crosses L2's `stairsup@48,16`. The fall therefore **ends in L0 (256,256)**: L110 → L2 at t27, then L2 → L0 at t61.
- **Without the repoint** (edit 1 alone, which is what this branch ships), the fall lands on L0's `stairsdown@256,272` tile. The descent fires those stairs, and the player arrives in **L2 (48,32)**, the `moonrock_target`, at t66.
- **Vanilla already did this**, both before the Shield and after it. After it, the route runs through the rock's Teleporter and writes `{2,0}`.
- **A repoint to L2 (64,32)** (`PATCH_L110_FALL_OFF_STAIRS`) ends in L2 directly, and model = game at 0 px.

**The user's choice:**
- (a) **ship the table as is.** The fall reaches L2 (48,32) through a mid-descent stairs hop in L0.
- (b) **add the off-stairs repoint.** The fall lands in L2 (64,32) directly, one tile right of the target.
- (c) **add the approved repoint anyway.** The fall ends in L0.

Both repoints are exported, named and unapplied. Whichever the user picks is one line in `SEEDLING_SET_PATCHES`.

## W0 (at `0aab89b4d8`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9240 bash scripts/procgen/identity-block.sh .` on this tree, pristine (the new files were parked outside the tree until it finished) | exit 0, log md5 **`aa46950b5958b32136111155250dd253`** (= F7's published value) |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, **all exit 0** |
| reference | `generate-procgen-reference.mjs --check` (the block's last row) | ALL 7 + 5 MATCH |
| tapeRunner | inside the bounded vitest | **469/469** |
| surface / constants / entities / profile | the four `--check`s | **GREEN 194** · **PASS** · **PASS 518 leaves** · **PASS 138 keys** |
| rules generators | `make-seedling-playthrough-rules --check`, `make-seedling-starter-atlas --check`, `make-seedling-subregion-partition --check` | all exit 0 (logs kept for the AFTER diff) |
| roster | `fixtures/tapes/index.json` | **206** tapes |
| bounded vitest BEFORE | 18 files: `levelSetExporter`, `seedlingRandomizerWiring` + `seedlingLevelSetDelivery` (read-only), `levelWorld`, `levelRun`, `moonrock`, `tapeRunner`, `entityBlocks`, `lintGateLabels`, `boxLock`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `apPlacementRewriter`, `seedlingAtlasDerivation`, `jsRuntimeVanillaDelivery`, `seedlingVanillaArmMap`, `levelSetValidator`, `levelSetDelivery` | **18 files / 1,172 tests, all green**; sorted `(fullName, status)` md5 **`b0af04cd…`** |
| the sweep BEFORE | every test file naming `vanillaRecordSet`, `vanilla-record`, `seedling_playthrough`, `deliveredSet`, `realRoomPlaybackMap` or `editLoadVanilla` (33) | **888/888 green** |

## D1 — the reader census (PASS)

The table below comes from `rg -a "seedling-map"` and the map loaders (`indexLevels(`, `levelSourceFromAtlas(`, `loadAtlas(`, `mapDocumentPath(`), plus every caller of `vanillaRecordSet(`, over `frontend scripts`.

**PATCHED** = reads the delivered set, so it inherits the table from `vanillaRecordSet`. **VANILLA** = reads the built-in map, i.e. the game's own rooms. **PER-ATLAS** = one file that serves both arms.

| reader (file:line) | what it describes | class | reason |
|---|---|---|---|
| `seedlingDemo/levelSetExporter.js` `vanillaRecordSet` | THE vanilla delivery's source | **PATCHED (the applier)** | `applySetPatches` runs before the join and writes `provenance.patches` / `report.patches`. `{patches: []}` gives the unpatched set, byte-identical to `seedling-vanilla-record-1040ace1` |
| `flashPanel/seedlingRandomizerWiring.js:882` (vanilla arm) | the AP rewrite → `SeedlingLevelSetDelivery` | PATCHED (inherits) | measured: the rewritten playthrough set's room 0 has no moonrock (`seedlingSetPatches.test`) |
| `flashPanel/seedlingRandomizerWiring.js:1170` (atlas arm) | the atlas arm's delivery, **when a location needs a retag** | PATCHED (inherits) | only `seedling_playthrough` allocates retags (11). The four atlas presets and `_maze` allocate **0** (measured and pinned), so they get no delivery |
| `flashPanel/seedlingRandomizerWiring.js:823/:886` | the location resolver / placement table's room join | VANILLA (patch-inert) | it joins locations to pickups, and neither patched entity is a pickup |
| `flashPanel/seedlingLevelSetDelivery.js` | chunks → `botLoadLevels` → readback | PATCHED (inherits) | it carries the set it is armed with |
| `flashPanel/seedlingWasmPlayback.js:1226` (`deliveredSet`) | the wasm engine's solver rooms | PATCHED (inherits) | `mountedRecordsOf(deliveredSet)` |
| `flashPanel/seedlingWasmPlayback.js:1229` (`mapPath` fetch) | the engine's rooms with no delivery | VANILLA | the atlas arms' world |
| `flashPanel/seedlingPlaybackController.js:279` `realRoomPlaybackMap` | the vanilla-map playback map | PATCHED (inherits) | it reads the set the arm delivered |
| `seedlingDemo/jsRuntimeCore.js:765` | the JS page's real-room mount | PATCHED (inherits) | the delivered set's records |
| `seedlingDemo/jsRuntimeCore.js:786`, `jsRuntimePage.js:68,117` | the JS page's atlas boot | VANILLA | no delivery |
| `flashPanel/flashPanelUI.js:1069` → `seedlingReturnSpawns` | return-spawn table | VANILLA (patch-inert) | it reads `RETURN_LINK_TYPES` only, and neither `moonrock` nor `control` is one |
| `flashPanel/seedlingAtlasAnalysis.js:37` | the region analyzer's room index | PER-ATLAS (rules arc) | it feeds the partition / playthrough generator |
| `scripts/procgen/make-seedling-playthrough-rules.mjs:55` | the playthrough atlas + rules | **PATCHED — the rules arc switches it** | not edited here |
| `scripts/procgen/survey-seedling-route.mjs:207` | the playthrough route's legs | **PATCHED — the rules arc switches it** | not edited here |
| `scripts/procgen/make-seedling-subregion-partition.mjs:118` | partition keyed by `atlas_id` | **BOTH ARMS: PER-ATLAS** (rules arc) | patch the playthrough's partition, not the starter's; not edited here |
| `scripts/procgen/make-seedling-starter-atlas.mjs:35` | the starter atlas `seedling-9ff3df2a` | VANILLA | atlas arm |
| `check-seedling-atlas-{preset,play,location-play,host-play,maze}.mjs`, `check-seedling-{spiral,sphere}-room-play.mjs` | atlas / generated gates | VANILLA | no delivery |
| `seedlingDemo/levelSource.js:59-72` (`loadAtlas`, `atlasLevelSource`) | **the model's built-in map**: every committed tape, `tapeRunner`, the solver tooling, the campaign producers, `shoveWeighParity`, `regenerate-r*-tapes` | VANILLA | every committed tape is recorded on the built-in map (the format carries no set). Switching it would move `u14-moonrock-*` and the r9 chain |
| `check-seedling-bot-differential.mjs:529` | game ↔ model differential | VANILLA | built-in map, both sides |
| `census-seedling-campaign.mjs:486` | the campaign frontier's source md5s | VANILLA | the map FILE is not edited; `campaign-frontier.json` is untouched |
| `census-seedling-bosslocks.mjs:53`, `seedlingBossLockCensus.js` | boss-lock census | VANILLA | game rooms |
| the probes' / planners' map reads (`wasm-level0:140`, `wasm-arrival-solve:102,159`, `wasm-playback:233`, `wasm-logical-links:132`, `r7-map-triggers:65`, `r7-l40-holder:779`, `r7-l6-bait`, `r7-l8-blocks`, `rect-inputs:248`, `build-cost:72`, `f1-l5-open-lock:64`, `f4-l8-sandtraps:63`), `wasmContinuationLab.js:43`, `wasmAdoptLab.js:39` | committed instruments' worlds | VANILLA | each measures the built-in game |
| `seedlingDemo/watchViewer.js:397` `ATLAS_URL` | the lab's model of the built-in map | VANILLA | |
| `seedlingDemo/watchViewer.js:9491` `#editLoadVanilla` | the set editor's "vanilla 116" | **VANILLA — opted out** (`{patches: []}`) | it is neither the delivery nor the rules arc's. With the default, its pins moved: E5 connections 15 → 14 and 11 → 10, set-editor links 2461 → 2460, free exits 334 → 333. Opting out keeps it on the game's rooms, so every pin and committed output holds |
| `scripts/procgen/export-seedling-level-set.mjs:239` `--vanilla` | the CLI twin of the button | **VANILLA — opted out** | same reason; the three CLI pins hold (the file names are the id) |
| `scripts/procgen/check-seedling-editor-arm.mjs:589` (+ `procgenDocs/demos.js` claim 27) | the node twin; its `set_id` must agree with the page's | **VANILLA — opted out** | it must pass what the page passes |
| `scripts/procgen/make-seedling-vanilla-overlay.mjs:189` | `fixtures/seedling-vanilla-overlay.json` | **VANILLA — opted out** | its `--check` passes under BOTH (measured); it is opted out so its report reads the editor's set (333 connections) |
| `scripts/procgen/check-seedling-ap-placement.mjs:159` | the AP rewrite delivered, rooms measured | PATCHED (default) | it IS the delivery; both arms read one set, and the discriminator is their difference |
| `regionMarkingTool/*`, `check-region-marking-tool.mjs:69`, `region-atlas-compile.mjs` | atlas authoring | VANILLA | the faithful extract |
| `scripts/procgen/extract-seedling-map.mjs`, `seedlingOgmo.js` | the map's writer, OEL I/O | VANILLA | the map is not edited |
| `tests/testCases/seedlingJsRuntimeTests.js:644` | in-app L6 solver walk | VANILLA | built-in rooms |
| `procgenLevel.js`, `r7Acceptance.js`, `levelSetExits.js:727`, `playerPhysicsV2.js`, `seedlingSemantics.js` | prose / measured constants citing the map | n/a | comments only |

**The atlas arms' exposure.** All values below are measured. L0 is `overworld_start`, L2 is `owls_nest_entrance` (`Dungeon1_Entrance`), and the Shield entity sits in L20.

| arm | delivered set? | Shield in its pool / locations / start? | L0 and L2 in its atlas? | an L0 ↔ L2 stairs edge in its rules? | exposed? |
|---|---|---|---|---|---|
| `seedling_atlas` | no (0 retags) | **no** (locations: `Seal`; no Shield in `itempool_counts` / `starting_items`) | yes (starter atlas: L0, L86, L2, L3) | **yes**: `overworld_start__r8c0 ↔ owls_nest_entrance`, `True_` | **no**: the event cannot fire |
| `seedling_atlas_location` | no (0) | no | yes | its rules route L0 ↔ L2 through the atlas regions | no |
| `seedling_atlas_host` | no (0) | no | yes | as above | no |
| `seedling_atlas_sphere` | no (it names no `region_atlas`, so the atlas arm never reads it) | no | the starter rooms, mixed with generated regions | `owls_nest_entrance ↔ overworld_start__r8c0` (`True_`) | no |
| `seedling_atlas_maze` (not in the brief) | no (0) | no | yes | yes, as `seedling_atlas` | no |

**No arm is exposed, so there is no user question here.** One residue: `Main.beam` and `Main.rockSet` are save fields. A save carried over from a game where the event already fired would boot an atlas arm with the rock set. No such flow exists today.

## D2 — the patch and the model (PARTIAL: edit 1 landed, edit 2 STOPPED)

**The names** (`a31792f`):
- `frontend/modules/seedlingDemo/seedlingSetPatches.js`:
  - **`SEEDLING_SET_PATCHES`**, the table, which is frozen and carries one row: `PATCH_MOONROCK_REMOVED` (`moonrock-removed`).
  - **`applySetPatches(levels, patches = SEEDLING_SET_PATCHES)`** returns a NEW array. Patched records are copies, every other record is the input's own object, and the input is never mutated.
  - Each patch names a BEFORE and an AFTER. A record already in the AFTER state is left alone, so the applier is **idempotent**. A record in neither state **refuses by name** (`SetPatchError`).
  - **`patchedMapDocument(mapDoc, patches?)`** returns a whole document, for node callers.
  - `SET_PATCH_IDS`.
  - The two unapplied candidates: **`PATCH_L110_FALL_TO_L2`** (the approved one) and **`PATCH_L110_FALL_OFF_STAIRS`** (64,32).
- `levelSetExporter.vanillaRecordSet(embed, map, { patches = SEEDLING_SET_PATCHES } = {})` applies the table before the join.
  - The patched delivery is **`seedling-vanilla-record-329dd9d9`**, and its `provenance.patches` is `["moonrock-removed"]`.
  - `{patches: []}` is byte-identical to `1040ace1`: no `patches` key is written for an empty list, and the content hash excludes provenance.
  - Only room 0 differs between the two sets.

**The model** needs no line of its own. It is entity-driven:
- `levelRun.moonrockStateFor` builds a rock only from a `moonrock` entity in the record.
- `levelWorld` reads `control` into `world.fallthrough` for any room.

So every model boot that mounts the delivered set reads the patched records: `jsRuntimeCore` (via `mountedRecordsOf`), the wasm engine's `deliveredSet`, and `fidelityMoonrock.deliveredMoonrockSet`. The model's built-in map stays vanilla, because every committed tape is recorded on it.

**The STOP (edit 2).** Measured in D3. The approved repoint makes the fall end in L0, the opposite of *"reached directly from the fall"*. It is not in the table.

**Unit rows** (`seedlingSetPatches.test.js`, 15):
- The table is edit 1 only.
- L0 loses exactly its moonrock; L0's stairs to L2 (48,32) stay; L2's record is the input's own; L110's control is vanilla's.
- The map file is untouched and the input is not mutated.
- The applier is idempotent, with and without the repoint.
- It refuses by name when the extract moves (a changed moonrock tag, a missing L0, a different control).
- **`checkFallingInPit`'s arithmetic over all 256 pit pixels of tile (64,64)**: vanilla → L0 (256,272), approved → L2 (48,32), off-stairs → L2 (64,32).
- The default carries the table; `{patches: []}` = `1040ace1`; only room 0 differs.
- The AP-rewritten playthrough set inherits it.
- A generated set (`seedling_generated_room`) carries no patch.
- The four atlas presets allocate 0 retags.

The editor-family opt-outs (see D1) keep these pins green: `levelSetExporter.test`, the E5 rows of `seedlingAtlasDerivation.test`, and `watchSetEditor.test`.

## D3 — game witnesses (PASS: the claims witnessed, the STOP measured)

`probe-seedling-moonrock.mjs` (`f448e18`, plus the import fix `909dbf7`) plays `fidelityMoonrock.MOONROCK_TAPES`.
- **The staging** is route step 23's, verbatim from `plan-seedling-u14-moonrock.mjs`: sword, shield, the Red Key, the game's own rng/save.
- **The worlds**: the delivered set (mounted by `botLoadLevels`, chunked by `planLevelSetChunks`), its variants, and the built-in map. One arm per fresh page.
- **The record**: `fixtures/moonrock-oracle.json` (md5 `7a68d11b…`, 27 PASS, p4f headless logic-only).
- **The rows**: `fidelityMoonrock.test.js` (9) holds the model to the recording.

| tape · world | game path (t) | ends | dead | beam / rock_set / `{2,0}` | model |
|---|---|---|---|---|---|
| **shield · delivered** | L0 → L2 (t47, at (56,40)) → L0 (t111, at (264,264)) | L0 | 60 | **true / false / no** | **= game, 0 px** |
| shield · built-in (control) | none: the rock beams, lands Solid over the stairs | L0 | **471** | false / true / **yes** | **= game, 0 px** |
| shield · delivered:unpatched | identical to built-in, frame for frame | L0 | 471 | false / true / yes | = game, 0 px |
| **fall · delivered** | L110 → L0 (t27) → L2 (t66, at (56,40)) | **L2 (48,32)** | 60 | – / – / no | refuses by name (below) |
| fall · built-in (control) | identical to delivered | L2 (48,32) | 60 | – / – / no | refuses by name |
| fallRockSet · built-in (vanilla after the Shield) | L110 → L0 (inside the set rock, onto its Teleporter) → L2 | L2 (48,32) | 60 | – / true / **yes** | refuses by name |
| fallRockSet · delivered | L110 → L0 → L2 (no rock: the stairs) | L2 (48,32) | 60 | – / true / **no** | refuses by name |
| **fall · delivered:approved** (STOP) | L110 → L2 (t27, falling at (56,−43)) → **L0** (t61, at (264,264)) | **L0** | 60 | – | refuses: *teleporter at (48,16) … descent* |
| **fall · delivered:off-stairs** | L110 → L2 (t27, at (72,−43)) | **L2 (64,32)** | 40 | – | **= game, 0 px** |

**The model's refusal** reads: *"a teleporter at (256,272) fired in level 0 while a pit transport was in flight (phase "descent"). Which world swap wins is not transcribed …"*.
- The game simply fires the teleporter. In the game the pit transport is over once the new `Game` is built, and the descent is only the arrival animation.
- The gap predates this slice: it refuses the vanilla L110 fall on the built-in map just the same.
- It lives in `levelRun`'s transitions, which is the STEP-OFF slice's region, so I did not touch it.

**Mutant M1**: the applier removed from `vanillaRecordSet` (copy → edit → run → copy back, md5 `e868a352…` restored).
- **Predicted**: 7 red. In `seedlingSetPatches.test`, 3 rows: the default, "only room 0 differs", the AP inheritance. In `fidelityMoonrock.test`, 4 rows: the oracle's set id, shield MODEL = GAME, and the two STOP rows.
- **Measured: 7/24 red, exactly those.**
  - The shield model stream diverges, because the model now beams.
  - The `approved` and `off-stairs` falls revert to *"a teleporter at (256,272) …"*, i.e. to L0's stairs tile. That is the brief's predicted mutant symptom, which shows only where a repoint is applied.

## D4 — records (PASS)

**Committed tapes on a delivered set: none.** The tape format carries no set, so every committed tape (206) runs on the built-in map. The only fixture naming a delivered set id is this slice's oracle. No tape crosses the patched rooms on a delivered set, and no joint re-record is needed.

| Row | W0 (`0aab89b4d8`) | head | movers |
|---|---|---|---|
| identity log | `aa46950b…` | **`aa46950b…`, byte-identical** (`diff` of the two logs is empty) | **none**: reach's four rows (level s1 ×2, generated set, reference) all held |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 | **identical**, all exit 0 | none: no producer reads a delivered set |
| bounded vitest (W0's 18 files) | 1,172, md5 `b0af04cd…` | **1,172, md5 `b0af04cd…`, byte-identical** | none |
| tapeRunner | 469 | **469** | none |
| roster | 206 | **206** | none (no tape added) |
| surface / constants / entities / profile | GREEN 194 / PASS / 518 / 138 | **identical logs** (`cmp`) | none |
| rules generators (playthrough, starter, partition) `--check` | exit 0 | **identical logs** | none: the rules arc switches them |
| vanilla overlay `--check` | (n/a) | OK | none |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration; `check-procgen-docs` ALL CHECKS PASSED; the probe passes `check-procgen-help --in-place` | instruments **336 → 337**; the docs index (the log entry) |
| final bounded vitest | — | **88 files / 3,099 tests: 3,097 green, 2 red**, both red at base (below) | + `seedlingSetPatches` (15), `fidelityMoonrock` (9) |
| `boxLock`, `lintGateLabels` | green | **green** | `probe-seedling-moonrock.mjs` joins `boxLock.test`'s guarded list (static `playwright` import; the take sits behind `isEntryPoint`) |

The 2 red rows in the final run were both also red at base:
- **`rosterCategories:175`**, `expected 144 to be 146`: F7's bank row (its two tapes); it needs `standing-values --write`, which is not licensed here.
- **`standingValues`**, "a gate that sleeps past the deadline is KILLED …": red alone at head, and red in the base run with the same assertion. This slice touches nothing it imports, so it looks environmental (process-group kill in this container).

**`reach-seedling-change --range=0aab89b4d8..HEAD`** (an upper bound) named:
- two producers: `plan-seedling-f4-l8-sandtraps --check` is green. **`plan-seedling-f1-l5-open-lock --check` is DRIFT at base AND at head, with byte-identical logs** (md5 `61f3ffe2…`): pre-existing, not this slice's;
- four identity rows, all covered by the AFTER block;
- 55 tests, all inside the final run.

`seedling-bot-log.md` gains `### Seedling fidelity MOONROCK — the event removed, L110 falls to L2`, with three trap candidates.

## For the rules arc (names, and what the data now says)

- **Module**: `frontend/modules/seedlingDemo/seedlingSetPatches.js`.
  - `SEEDLING_SET_PATCHES` (the table) and `applySetPatches(levels, patches?)`.
  - `patchedMapDocument(mapDoc, patches?)`, for a generator that reads the whole document; use it on the playthrough arm only.
  - `PATCH_MOONROCK_REMOVED`, `PATCH_L110_FALL_TO_L2`, `PATCH_L110_FALL_OFF_STAIRS`, `SET_PATCH_IDS`.
  - `vanillaRecordSet(embed, map, {patches})`.
- **L110 in the patched data still says `fallthrough 0`** (the repoint is STOPPED). The game nevertheless ends the fall in **L2 (48,32)**: it lands on L0's stairs tile, and the stairs fire during the descent before the player can act.
  - In rules terms, the L110 pit → L2 edge is TRUE as an outcome. The intermediate L0 arrival is not a place the player can stand.
  - The same held in vanilla, before and after the Shield.
- **L0 ↔ L2 stairs stay open both ways after the Shield** (witnessed). Any `has Shield`-conditioned removal of those edges in the playthrough rules must go.
- **If you switch the editor-derived E5 path to the patched set**, the `named_rooms` connection `moonrock_target` disappears: the trigger element (the moonrock) is gone, so 15 rows become 14 and 11 become 10. Those tests are opted out today.
- I did not edit `make-seedling-playthrough-rules`, `survey-seedling-route`, the partition, or any rules output.

## For the JS arc

**No pin of yours moves.** At head, these are all green, and no JS-arc file was edited: `jsRuntimeDeclarations`, `jsRuntimeSolver`, `jsRuntimeCore`, `jsRuntimeAtlas`, `jsRuntimeVanillaDelivery`, `jsRuntimeVerbs`, `jsRuntimeSolveService`, `wasmArrival`, `wasmArrivalComposite`, `wasmWalkTape`, `wasmPlayback`, `seedlingWasmPlayback`, `seedlingVanillaArmMap`, `seedlingLevelSetDelivery`, `seedlingRandomizerWiring`.

What changes under you:
- The vanilla delivery's id is now `329dd9d9`, where it was `1040ace1`. Your tests use `1040ace1` only as a deliberately WRONG readback id, so they hold.
- Your W5 level-0 pin is on the atlas arm, which is unpatched.
- ⚠ A live fall from L110 on the playthrough will refuse in the model by the descent-teleporter name above, as it already did on vanilla.

## Deltas

- New: `seedlingSetPatches.js` (+ test), `fidelityMoonrock.js` (+ test), `fixtures/moonrock-oracle.json`, `probe-seedling-moonrock.mjs`.
- Changed:
  - `levelSetExporter.js`: the `patches` option and the applier.
  - The editor family's `{patches: []}`: `watchViewer.js`, `export-seedling-level-set.mjs`, `check-seedling-editor-arm.mjs`, `make-seedling-vanilla-overlay.mjs`.
  - Their test mirrors: `levelSetExporter.test`, `seedlingAtlasDerivation.test`, `watchSetEditor.test`.
  - `boxLock.test`'s guarded list.
  - The log and the regenerated reference.

## What the brief got wrong (measured)

1. **"`checkFallingInPit`: arrival … ⇒ today L0 (256,272), the stairs tile."** The ctor is right, but the game takes one more step. A fall arrives from the ceiling, and the descent fires the stairs on that tile, so the vanilla fall **already reaches L2 (48,32)**: rock unset, and rock set (through its Teleporter). "Falling into the moon rock" was never the only way to the target.
2. **"With the new control … ⇒ L2 (48,32)."** The ctor is (48,32), but the descent passes through L2's `stairsup@48,16`. The approved control therefore ends the fall in **L0 (256,256)**.
3. **"The atlas presets … deliver NO set."** True today, but only conditionally. The wiring's atlas arm calls `vanillaRecordSet` whenever a location needs a retag (`seedlingRandomizerWiring.js:1170`). All four presets allocate 0, and that is now pinned.
4. **"That needs NO line in the JS arc's files; everything downstream inherits it."** True for the delivery. But `vanillaRecordSet` is ALSO the set editor's vanilla: the `#editLoadVanilla` button, its CLI, the node twin, and the overlay producer. Those would have moved pins (E5 connections, set-editor links, free exits), so they opt out by name.
5. **"Mutant: the applier removed ⇒ the fall lands on L0's stairs tile (256,272) again."** With the repoint stopped, the applier never touches L110. M1 shows that symptom only on the repoint variants; its main red is the shield witness, where the model beams.
6. **"`setPersistence(0,false,L2)` (→ the pile)."** Confirmed; and `MoonrockPile` hard-codes `tag = 0` (`MoonrockPile.as:23`), whatever the OEL says.

## Residue

1. **⚖ The L110 repoint: (a) none, (b) off-stairs (64,32), or (c) the approved (48,32).** All three are measured above, and each is one line in the table.
2. **The descent-teleporter model gap.** The model refuses a teleporter that fires during a fall-from-ceiling descent; the game fires it. It predates this slice, applies on the built-in map too, and sits in `levelRun`'s transitions (STEP-OFF's region).
3. **`Main.beam` stays `true` forever on the delivered set** after the Shield, because nothing reads it. A save carried from a vanilla game that crossed the event (`rockSet` true, `{2,0}` cleared) would show the pile in L2 but build no rock in L0. No flow does this today.
4. **`plan-seedling-f1-l5-open-lock --check` is DRIFT at base**, byte-identical BEFORE/AFTER (pre-existing).
5. **`standingValues` kill row**: red at base and head (environmental).
6. **`rosterCategories:175`**: F7's `144 vs 146`, still waiting for `standing-values --write`.
7. **`check-seedling-editor-arm --host=:9240`** ran at head after the AFTER block, with the box free: **226 PASS, ALL CHECKS PASSED**. The page's `#editLoadVanilla` and the node twin agree on the unpatched set.
   - **Not run:** `check-seedling-ap-placement` (a browser gate). Both its arms read the one patched set, and its discriminator is their difference.

## Byte-inertia

- **No committed tape, expectation, declaration or roster pin moved.** Added only: the oracle, two modules, two test files and the probe.
- **Not touched:**
  - `seedling-map.json`, `campaign-frontier.json`, every rules file and rules generator;
  - the AS3, the wasm, every gitlink;
  - the JS arc's files (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker, `seedlingRandomizerWiring.js`, `seedlingLevelSetDelivery.js`);
  - the BURN, STEP-OFF and L14 regions (`solverBot`, `levelRun` transitions, `climbLadder`).
- **No signature or contract moved** for `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging`. `vanillaRecordSet` gained an optional third argument, and its two-argument calls now return the patched set.
- ⚠ **`f448e18` (D3) was committed with one red row**: `boxLock.test`'s "NO headless instrument carries it". The probe imported `playwright` dynamically, so `gateRoster.PLAYWRIGHT_RE` read it as headless while it carried the box-lock preamble. `909dbf7` fixes it with a static import. A smoke arm reproduced the recorded `fall/delivered` stream, and every later commit is green on those rows.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. The mutant was copy → edit → run → copy back, md5-checked.
- **Box:** the BEFORE identity block ran while the probe ran twice. The probe took the box both times; the block's only box row (`generated set`) passed, and its log equals F7's published one. The oracle re-record and the AFTER block did not overlap, and the editor-arm gate ran after the AFTER block.
- **Tree dirt:**
  - A detached scratch worktree `/home/user/mr-wt` (at `0aab89b4d8`) was used for development; it is not a branch and nothing from it is staged.
  - One `git apply` from it hit its wasm symlink and left nine tracked files deleted. They were restored with `git checkout --` from HEAD, before any commit, and the diff was re-applied without the symlink entries.
- **Scratch** (`/tmp/claude-0/mr/`, not committed): both identity logs, the vitest JSONs and pair lists, the probe logs, the retag/exposure script, the mutant output.

## The rows to BANK

- identity log md5: BEFORE **`aa46950b5958b32136111155250dd253`**; AFTER **`aa46950b5958b32136111155250dd253`**, byte-identical (head)
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`, all exit 0 (BEFORE = AFTER)
- **the delivered vanilla set id: `seedling-vanilla-record-329dd9d9`** (was `1040ace1`, which `{patches: []}` still reproduces)
- counts (movers, not digests): instruments **337**; tapeRunner 469, roster 206, surface GREEN 194, entities 518, profile 138 (unchanged)
- `fixtures/moonrock-oracle.json` md5 **`7a68d11b0f1b39784d5636a551911cb9`** (p4f)
- pre-existing reds: `rosterCategories:175` (144 vs 146), `standingValues` kill row, `plan-seedling-f1-l5-open-lock --check` DRIFT
- ⚖ **for the user:** the L110 repoint choice (residue 1)
