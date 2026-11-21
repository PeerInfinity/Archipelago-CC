# S4 — seedling-custom-set-arm: the player delivers a HELD custom set's own rooms, and Edit ▸ opens one back in the lab

Session `seedling-custom-set-arm` (Opus), 2026-11-21. Launched by `seedling-js-planning-21`; its successor
`seedling-js-planning-22` (js-22) is the reviewer and owns the landing queue. Lab hunks were reviewed by
`seedling-lab-planning-7` (lab-7). Licence: Robert, 2026-11-20, *"Make lab sets playable (Recommended)"*: "S4: the
player delivers THOSE rooms on both runtimes (no rebuild) and Edit ▸ opens a room back in the lab."

## Summary for Robert

- **You can play your own set now.** Make a set in the Seedling watch page's set editor and press its **bundle**
  button. Load that `.zip` in the app (Presets panel → load file), and the Flash panel boots the game with **your
  rooms**, on the JS runtime and on wasm. Nothing was rebuilt: the wasm game already takes delivered rooms.
- **Measured end to end:** the original 116 rooms with one tree added to room 10. The delivered room 10 has the
  tree, in node and in the app on both runtimes.
- **Edit ▸ opens the room you are in back in the lab.** It is a button in the Flash panel's **Tools** section, and
  it appears only for a set the app holds. The lab opens the same set, and the set id is checked. For example:
  room 10, tree included.
- **Anything else is still refused, with the same message as before.** Rules that arrive without their set get slice
  G's *"This set can't be played yet"*, and nothing boots. That covers a `rules.json` downloaded alone, the APWorld
  Editor's hand-over, and a set whose contents no longer match the rules.
- **The lab never throws away unsaved work.** Edit ▸ is refused by name if the lab holds a set whose content differs
  from its last download, or a room with unwritten edits, or a room another panel handed over that is still open.
- **"Play" is not "solve".** The Playback Bot, the solver, the survey and the derived-rule table still assume the
  original rooms. None of them was touched, and none of them plays a custom set.
- No wasm rebuild, no wasm gitlink, no `vendor/seedling`, no preset, no gitlink change.

## What was built

**1. The custom-set arm** (`flashPanel/seedlingRandomizerWiring.js`, step (iv)). The rules name a set in
`region_atlas[p].level_set`. When the host's `levelSetCache` holds that set with the same `content_hash`
(`procgenCore/levelSetReference.heldLevelSetOf`, new):
- that set is the record set (the role `embed` plays for vanilla). Its rooms' records are the map document
  (`heldSetMapDocument`: `levels[i] = {...rooms[i].source.record, level: i}`, the same document the lab compiled the
  rules from). **Nothing is fetched** for either document.
- **Vanilla arm**: the held set replaces `vanillaRecordSet(embed, mapDoc)`. The placement rewrite and the entrance
  shuffle apply to it unchanged.
- **Atlas arm** (G7, which is where a lab set lands, because its locations are named by atlas region): the atlas
  comes from `atlasCache` when the served index lacks it. The held set is **always delivered** (retagged and
  shuffled as before), because the rooms the game itself holds are the original ones.
- A room that is not record-sourced is refused by name (the `assets` refusal).
- Everything downstream (`SeedlingLevelSetDelivery`, `runSeedlingRandomizerLoad`, the reset, the check binding) is
  unchanged. On wasm the delivery is the existing `botLoadLevels` path.

**2. G stays for everything else** (`seedlingRandomizerEligibility.js`).
- `servedRegionAtlas({…, heldSet})` carries the held set's id only when the cache answered `held`.
- `unservedAtlasRefusal` asks `heldSetLiftsGuard` first.
- An absent set, or one held under another hash (`mismatch`, never served), hands nothing, so G's sentence is
  unchanged.

**3. The panel** (`flashPanel/flashPanelUI.js`).
- `_customSetRefusal` asks the same held question before it starts any game.
- It hands the wiring its own **static** `levelSetCache`/`atlasCache`. The wiring is a computed-URL import, so in
  the bundled build its own imports would be a second, empty instance.

**4. Edit ▸** (`_setHeldSetEdit` / `_editHeldSetRoom`, the Tools row).
- It is shown only after a load delivered a held set (`loaded.assets.recordSet.held`).
- **What crosses:**
  - the held **set document** from `levelSetCache` (it carries its own `set_id` and its stamped
    `provenance.content_hash`; the host refuses unless that stamp equals the rules' `level_set.content_hash`);
  - the **room index**, from the game's `botStatus().level`.
- Both go through the one opener, `regionEditors.openRoomEditor('flash_seedling', {room, record, onSave})`, to the
  lab's `?source=edit&room=n`.
- The lab re-verifies the body against its stamp (`validateLevelSet`, the existing "EDITED SET REUSING ITS ID"
  refusal) before it opens it.
- On close the panel logs that the edits stay in the lab: these rules describe the set as it was, so re-bundle to
  play them.

**5. The lab half** (lab-7 reviewed):
- `watchSetIdentity.LAB_SET_COMPILE_OPTIONS` is `{}` again, so the rules carry the compiler's own Seedling
  `flash_panel` block.
- **The Edit ▸ receiver** (`watchViewer.hostLoad`) asks `watchSetIdentity.handoverRefusalOf` before it holds a
  handed-over set. It **refuses** (there is no dialog in the page) when:
  - a host's room is still open;
  - an open room has unwritten edits;
  - the held set's `levelSetContentHash` differs from its last **save**.
- A save is the load itself, a set or bundle download through the set editor's own download seam
  (`isSetSaveDownload`; never a room `.json`/`.oel`, the overlay, the companion or `rules.json`), or a host room's
  close (its record went back to that host).
- Edit ▸ for an **original** game room is unchanged: no `regionRoundTrip`/`roomEditor`/`labRoomEditor` code moved,
  and the panel offers it only for a held set.

**6. The mount key / JS save:** these were already apart per set (S3). `seedlingCustomSetArm.test.js` pins that the
tree set, the vanilla lab set and the vanilla preset key three ways.

## Gates

### The inverse of p5: an edited set (one tree added to room 10) → the delivered room 10 HAS the tree

| where | row | result |
|---|---|---|
| node, js + wasm | `seedlingCustomSetArm.test.js` | eligible on the **atlas** arm (the lab set); delivered set = the held one, 116 rooms, room 10 with the tree, every room's layers equal to the held set's; nothing fetched (`levelSetCache:<id>`), atlas from `atlasCache:<id>` |
| node, js + wasm | same file, p5's own rules + `level_set` | eligible on the **vanilla** arm, `replaced > 0`, room 10 with the tree |
| node | control | the vanilla lab set held: room 10 without the tree; two held sets each deliver their own |
| in-app JS (seedling-js) | `seedling-js-runtime-held-custom-set-plays-its-rooms` | delivered room 10 and the JS page's mounted room 10 have the tree; `botLevelSet.active` = the delivered set; Edit ▸ offered |
| in-app wasm (seedling-wasm, WebGPU) | `seedling-wasm-runtime-held-custom-set-plays-its-rooms` | delivered room 10 has the tree; `botLevelSet.active` = the delivered set, 116 rooms; no rebuild |
| in-app JS (seedling-js), lab-7 (d) | `seedling-js-runtime-held-custom-set-edit-opens-room-in-lab` | game teleported to room 10, Edit ▸: the lab's own `procgenLab:levelChanged` names room 10 open, the handed `set_id`, and room 10's record has the tree |

### G stays for a set that is not held

- **Node, js + wasm** (`seedlingCustomSetArm.test.js`):
  - the rules **alone** (`flash_panel` + `level_set`, no body: a rules.json download or the APWorld door) → G's
    exact `atlas: <unservedAtlasWhy(id)>`, `assets: null`, nothing delivered;
  - held under **another** hash → the same.
- **Panel** (`flashPanelHeldSet.test.js`): lab-7 #2, the lab rules not held → `_customSetRefusal` = G's
  `{why, reason}`. Mismatch → G. Held → null. A served preset → null.
- **G's two in-app rows**: `seedling-js-runtime-custom-set-with-flash-panel-starts-no-game` (the row that covers the
  "with flash_panel" shape) and `…-without-flash-panel-…` → CI below; message unchanged.

### The 8 committed preset slot rows (G's set and G's method)

The rows are `seedling_atlas`, `_host`, `_location`, `seedling_er`, `seedling_playthrough` ×2, `_sphere_room` and
`_spiral_room`, each × {js, wasm}. Each runs the real `loadSeedlingRandomizer` and records (verdict, arm, failed,
md5 of the delivered rooms, md5 of the reason with the tree path normalised).

| tree | digest |
|---|---|
| pristine `git archive 84d9ccd29d` (the S3 base) | `5a8392a4e7b62d465684973d4dddefba` |
| tip `f8de3bcbd8` | `5a8392a4e7b62d465684973d4dddefba` |
| pristine `git archive 88ac143065` (main at the merge) | `5a8392a4e7b62d465684973d4dddefba` |
| merge `9c96df5e04` | `5a8392a4e7b62d465684973d4dddefba` |

All four are byte-identical. The 16 rows are 3 vanilla × 2 + 5 atlas × 2, all `eligible`.

### Mutants (each driven by hand on the two new test files, then reverted)

| mutant | red |
|---|---|
| held set ignored (`const heldSet = null`) | 6 rows (the tree rows, js + wasm, both arms; the two-sets row; the control) |
| hash mismatch served (`cache.get(set_id)` with no hash) | 3 rows (the mismatch rows js + wasm, the panel's mismatch row) |
| G lifted for an unheld set (`heldSetLiftsGuard → true`) | 6 rows (rules-alone js + wasm, mismatch js + wasm, both panel rows) |

### Lab-side additions (lab-7)

1. **Lab CI-GATE rows, base → tip**: see the CI section.
   - Unchanged outputs (local; `84d9ccd29d` = tip, and main `88ac143065` = merge `9c96df5e04`):
     - `generate-maze-level --seed=1` `f3fa9f63c5b1cd593da4c198da7f40db`;
     - `--seed=7` `f1250ed8c21b3d76d5dff2ef8d3068fd`;
     - acceptance `391322d681b7aa0229d94b3f6906d024`.
   - engineMd5 base = tip at each base: `bec369878feb67081187edca62baa951` before main moved it, then
     `74ae60f575531492ed9eaec1839e1fe3` at `88ac143065` = merge.
   - The derived-rule table `seedling-playthrough-derived-rules.json` md5 `b1255b1cb21058db7ca37323eebdc4d4`, base =
     merge; it is not in this diff.
   - The maze lab is untouched: no `mazeRoom/` file, and nothing the maze lab imports changed.
2. **Re-records**, each with its reason in the hunk:
   - `watchSetIdentity.test.js` "NO `flash_panel`" → `toEqual({1: FLASH_PANEL_WIRING.seedling})`;
   - `check-seedling-editor-arm.mjs` bundled-rules claim → the same block (local 232 PASS / 0 FAIL = base count);
   - `region-map-watch-set-bundle`'s condition → `flash_panel` present. That bundle has no level-set member, so the
     player still refuses it with G.
   - Comment-only: `vanillaOverlay.test.js`, the identity note in `watchViewer.js`, `presetUI.js`.
3. **Edit ▸ receiving side**:
   - (a) the set itself crosses, the stamp is checked on both sides, and the lab refuses a mismatch by name;
   - (b) refuse, not ask (`handoverRefusalOf`, 7 node rows: content not op counts, room download ≠ save, open host
     room refuses);
   - (c) the original-room door is unchanged;
   - (d) the in-app row above.
   - The existing hand-over rows pass at the reworked receiver (solo, locally): `apworld-edit-opens-the-lab-door-and-its-save-is-one-op`,
     `feature-check-region-edit-apworld-editor`, `-seedling-generated`, `-seedling-real-game`,
     `feature-check-seedling-load-vanilla-after-handover`.
4. lab-7's OK (quoted): *"LAB OK on the lab hunks at f8de3bcbd8 (r2 diff md5 1574af16… matches; read by me), together
   with the r1 hunks at dca51c4ae3 (md5 c7febd85…) I OK'd except (b). (b) now: save = the set editor's download seam
   only (set document or bundle; room .json/.oel, overlay, apMapping, rules.json never count) — correct, …;
   host-handed exemption removed (open host room refuses outright; close = save); dirtiness by content hash vs the
   last save, not op counts. Node rows carry the room-download case; the in-app row is waived as not cheap."*

### Other

- Bounded vitest (⚖ 52), at the merge: every test file naming a touched file, plus `procgenDocs/`,
  `moduleImportOrder`, `bindingContract`, `refusalCensus`, `storageCensus`, `storageDeclarationPins`,
  `bundledTestCases`, `reachClosure` and `documentBundle`. Result: **78 files, 2662 tests, all passed.**
- `generate-procgen-reference --check`: all match. `urlGrammar.js` was regenerated, because watchViewer's line moved
  from 633 to 634.
- Engine closure (42 files) ∩ diff = ∅. 0 gitlinks, 0 presets, no wasm binary and no `vendor/` change.

## CI at the merge `9c96df5e04` (headSha)

All runs are `success` with headSha `9c96df5e04`. Base is main `88ac143065`.

- **JSUT** push run `44929614393`: suite `vitest (unfiltered)` **1393 files / 29325 tests, 0 failed**, slow battery
  36/438. Base: the train run `44921668966` / `ci-vitest-summary` at `88ac143065`, 1391 / 29294. So **+F 2, +T 31**:
  `seedlingCustomSetArm` 15 + `flashPanelHeldSet` 9 + `watchSetIdentity` 21→28 (+7). Nothing else moved.
- **unittests** push run `44929614482`: success.
- **Lab CI-GATE rows**, base (`44921668966`) → merge (`44929614393`), all `exit=0 · ALL CHECKS PASSED`, every count
  equal:
  - `seedling-editor-arm` 232/0 → 232/0 (the S4 claim re-recorded in place, same count);
  - `maze-lab` 326/0 → 326/0;
  - `maze-world-map` 51/0 → 51/0;
  - `seedling-editor-e1` 69/0 → 69/0;
  - `seedling-editor-e3` 61/0 → 61/0;
  - `seedling-editor-export` 29/0 → 29/0;
  - `seedling-lab-art` 189/0 → 189/0;
  - `seedling-lab-load-in-js` 60/0 → 60/0;
  - also `preset-bundle-load` 10/0 → 10/0.
- **TT** (test-templates, dispatched) run `44929613724`: every job succeeded. Base is TT `44927944653`, the main push
  at `88ac143065`.

  | batch | rows base → merge | headroom at merge | at base |
  |---|---|---|---|
  | fast | 126 → 126 | 299.5 s / 600 s (50%) | 298.5 s |
  | fast (bundled boot) | 126 → 126 | 315.1 s (53%); **re-sample 300.7 s (50%)** | 293.7 s |
  | seedling-js | 39 → **41** (+2 new) | 230.1 s (38%) | 221.0 s |
  | seedling-wasm | 12 → **13** (+1 new) | 222.2 s (37%) | 181.8 s |
  | playback-bot | 16 → 16 | 112.7 s (19%) | 92.7 s |
  | seedling-js-solver | 12 → 12 | 185.0 s (31%) | 189.0 s |
  | apworld | 142 → 142 | 154.4 s (26%) | 207.5 s |

  ALTTP & regression: success.
- **The fast-bundled reading.** The first reading was +21.4 s, over the +20 s STOP line, so it was measured before
  it was believed:
  - per row, base → merge, the +22 s is spread over 126 rows, and no row moves more than 2.7 s;
  - the top movers are `test_graph_data_loading`, `seedling-playthrough-maze-l15-level-world` and
    `rule-converter-exact-mode-round-trips`, none of which touches this slice;
  - the bundle's module set did not grow (`regionEditors.js`, now static in the Flash panel, was already static in
    `procgenPipelineUI.js`, `apworldEditorUI.js` and `regionRoundTrip.js`);
  - a re-sample of the same SHA (`test-substrates-manual.yml` `-f batch=fast -f bundled=true`, run `44932783482`,
    success, 126/126) read **300.7 s (+7.0 s)**.

  It is runner variance. S3 saw the same batch swing 21 s between its base and tip. Every batch is under the 70%
  STOP line.
- **Named rows, all PASSED in TT `44929613724`:**
  - seedling-js: the two new rows, plus G's `custom-set-with-flash-panel-starts-no-game` and
    `custom-set-without-flash-panel-starts-no-game`;
  - seedling-wasm: the new row;
  - playback-bot (Region Map): `region-map-seedling-paints`, `-follow-player`, `-discovery`, `-clicks-seedling`,
    `-clicks-loop-mode`, `-custom-set-atlas`, `-watch-set-bundle` (re-recorded);
  - fast (Region Map): `region-map-classic-world`, `-clicks-generated`, `-click-default`, `-click-master-off`,
    `-click-location-check`, `-click-settings-independent`.

### The first CI round, and what it found (fixed in `bc7cb19f57`)

TT `44925590366` and JSUT `44925563789` at `f8de3bcbd8` were red, for three reasons:
- `seedling-panel-layout-sections` pins the Flash panel header to title + status, per the panel-layout ruling. The
  first Edit ▸ sat in the header, so it moved to the Tools controls.
- The held-set rows were green solo and red in the batch: they read the **previous** row's `_apLoadResult`. They now
  wait for a load that is not the stale one and whose delivered set is the held one.
- `generate-procgen-reference --check`: `urlGrammar.js` records a watchViewer line number, and it was regenerated.

A TT dispatch at `dca51c4ae3` (superseded) was left running: the cancel was refused by this session's permission
check.

## Scope, and what is not covered

- **Play ≠ solve.** The Playback Bot, the solver, the survey and the derived-rule table still assume the vanilla
  atlas, and none of them was touched. A held set's Playback-Bot walk is not covered.
- **The bundle is the only carrier** (S3's answer). The hand-over door (S2) was not licensed, so a set sent from the
  lab through the APWorld Editor still refuses with G.
- **A set whose rooms are not record-sourced** (embed/xml rooms) is refused by name at the `assets` check. The
  watch page's sets are record-sourced.
- **An edit made through Edit ▸ is not played until it is re-bundled.** The panel's rules describe the set as it was
  loaded, and the panel says so on close.
- **The receiver's refusal is shown on the lab page.** The host's door then waits in its `holding` phase until the
  next Edit ▸ replaces it, which matches the door's contract: after the document is sent there is no timer.

## Files

- New:
  - `flashPanel/seedlingCustomSetArm.test.js`
  - `flashPanel/flashPanelHeldSet.test.js`
- Player side:
  - `flashPanel/seedlingRandomizerWiring.js`
  - `flashPanel/seedlingRandomizerEligibility.js`
  - `flashPanel/flashPanelUI.js`
  - `procgenCore/levelSetReference.js` (`heldLevelSetOf`, game-neutral)
  - `presets/presetUI.js` (comment)
- Tests:
  - `tests/testCases/seedlingJsRuntimeTests.js` (3 rows)
  - `test-configs/playwright_tests_config-substrates.json` (3 enrolments)
  - `procgenDocs/generated/urlGrammar.js` (regenerated)
- Lab (lab-7 OK):
  - `seedlingDemo/watchSetIdentity.js` (+test)
  - `seedlingDemo/watchViewer.js`
  - `seedlingDemo/vanillaOverlay.test.js` (comment)
  - `tests/testCases/regionMapTests.js`
  - `scripts/procgen/check-seedling-editor-arm.mjs`

The worktree is left for the cleanup round. Its dev server (port 8130) is stopped at the end of the session.
