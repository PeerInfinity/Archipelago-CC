# Cloud slice `seedling-js-same-wiring-remount`: a same-wiring Seedling preset switch while the game runs loads the NEW preset's rooms

Coordinator: `seedling-js-planning-16`. ⚖ Robert, 2026-11-02: **"Fix it"**. The fix makes the game visibly restart on
such a switch.

## Base

- origin/main: `1e5b7efd98` (train: cloudberry-p4a 112e2b5cc1). It does **not** contain `619fceea9a`.
- The row-isolation fix `619fceea9a` was merged `--no-ff` without its report commits, as `94696e00`.
- Branch: `claude/seedling-same-wiring-remount-kcxr62`. The harness pinned it, so the brief's
  `seedling-js-same-wiring-remount` name was not used. main was not pushed.
- The fix commit is `d1de3e057d`. This report is the last commit.

## The defect, re-verified

`_onRulesLoaded` re-mounts only on a change of `JSON.stringify(staticData.flash_panel)`. `seedling_atlas` and
`seedling_atlas_location` both carry `{"config":"seedling.json","wasm":"seedling_bot_ap_p4g/game.html"}`, so a switch
between them took the no-remount branch. That branch only rebuilds 619fceea9a's region data. The AP load
(`_startSeedlingRandomizer`) runs once per adapter, at bridge ready, so the atlas map, the check binding and any
delivered set stay the previous preset's.

The new in-app row reproduces it on the old behaviour (the mutant below): after the switch no fresh adapter ever
appears.

The CI rows never hit this, because every `atlasPresetOn` row also switches the runtime setting, and a runtime switch
re-mounts by itself. That is why the new row keeps the runtime fixed.

## Inventory: every path that reaches `_onRulesLoaded` with unchanged wiring

All paths below reach it through `files:jsonLoaded`, then the state manager's `rawJsonDataLoaded` re-emit (which sets
`getLastRawJsonData`), then the worker, then `stateManager:rulesLoaded`. Exceptions are noted in the table.

| Path (publisher) | Rooms change? | Before | After |
|---|---|---|---|
| Preset picker / Quick Launch (`presetUI.js`, `sourceName` = preset path) | yes, when the presets' rooms or placement differ | no re-mount; region data rebuilt (619); **game keeps the old rooms** | re-mount (teardown + `_initializeAdapter`); the AP load runs on the new rules |
| Tutorials' "load a preset" (`tutorialContext.js:177`) | same as a preset switch | same as above | same as above |
| Test rows' `atlasPresetOn` (`files:jsonLoaded`) | yes between the two atlas presets | re-mounted only because the runtime setting changed too | unchanged for existing rows; the new row (runtime fixed) re-mounts on the rooms |
| AP server connect (`client/core/messageHandler.js:726`, `sourceName` = `server:<seed>:P<slot>`) | yes if the server's rules, slot or placement differ from the running ones | no re-mount (stale rooms and binding) | re-mount when the key differs; nothing when it is the same content |
| A reload of the same payload (the same object, or an identical copy) | no | nothing; a copy rebuilt the region data | nothing (equal key); a copy still rebuilds the region data (619) |
| Procgen pipeline "Load into frontend" (`procgenPipelineUI.js:3961`, `sourceName: 'procgenPipeline'`) | yes after an edit (generated rooms / seed) | no re-mount; game keeps the old rooms | **⛔ STOPPED: unchanged (no re-mount) + a log line** (below) |
| Procgen pipeline auto-save (`localStorage.setItem`, `procgenPipelineUI.js:5430`) | n/a | emits **no** rules load | n/a; it cannot restart anything |
| APWorld editor Apply (`apworldEditorUI.js:1639`, `sourceName` = ORIGIN preset path, `appliedBy: 'apworldEditorApply'`) | can (an exit or placement edit changes links / placement) | no re-mount | **⛔ STOPPED**, same |
| JSON Editor / CodeMirror Apply (`editorUI.js:327`, `codeMirror6UI.js:413`, `'editorApply'`) | can | no re-mount | **⛔ STOPPED**, same |
| apcalcGenerator / tileMapAnalyzer (`'apcalcGenerator'`, `'tileMapAnalyzer'`) | their worlds carry no Seedling `flash_panel`, so the wiring changes | wiring path | wiring path (unchanged) |
| `apworldEditor:loadRules` hand-offs (procgen lab, marking tool, pipeline's "Open in APWorld Editor") | n/a | no `rulesLoaded` | n/a |
| `editor:snapshotApply` | n/a | snapshot only, no `rulesLoaded` | n/a |
| `testController.loadRules` (`tests/testController.js:398`: direct proxy `loadRules` + `publishAs rawJsonDataLoaded`) | depends on the row | as a preset switch | as a preset switch. ⚠ Side finding: this path does **not** update `getLastRawJsonData()` (only the `files:jsonLoaded` handler and `postInitialize` set `lastRawJsonPayload`), so the AP load **and** the key read the previous raw rules next to the new `staticData`. This predates the slice; I did not touch it (`stateManager` / `tests` are not mine). No Seedling row loads through it today, as far as I found |

## The re-mount key, and why

`seedlingMountKey({rules, playerId, locations})` (`frontend/modules/flashPanel/seedlingMountKey.js`) is a JSON string
of exactly what the AP load's three arms and `realRoomPlaybackMap` read:

- **slot:** `staticData.playerId`
- **rooms:** the `flash_seedling` and `flash_seedling_gen` sidecars, whole, in sidecar order
- **atlas:** `region_atlas["<p>"]`
- **map:** `mapDocumentPath(...).path`
- **seed:** `seed_name` and `generation_seed` (the generated set's id)
- **links:** `realRoomLinks`
- **events:** `runtimeEventsOf`
- **placement:** each location's item `{name, player}`

It is keyed by content, never by object identity, so an identical copy keys the same. It is not "any rules change",
so an edit outside these inputs keys the same too. It never throws: an unreadable document keys as `unkeyable: …`.

How the panel uses it:

- `_startSeedlingRandomizer` records `_apLoadKey` before its first await.
- `_onRulesLoaded`'s same-wiring branch calls `_mountedRoomsDiffer()`. If it says yes, the panel takes the wiring
  change's own path (`_teardownForReinit()` + `_initializeAdapter()`). There is no new restart mechanism, and no
  sleeps or retries.
- A stale AP load in flight is dropped by its existing `this.adapter !== adapter` checks, because the teardown
  replaces the adapter. The unit "the OLD load still in flight" pins this.

`_mountedRoomsDiffer()` returns false (no re-mount) in four cases:

1. **The AP load has not read the rules yet:** no adapter, or the bridge is not ready. It will read the loaded ones
   itself.
2. **The load was refused on the wiring alone:** `cheap.failed` is `transport` or `capability`. These read only the
   wiring and the build, so a non-Seedling flash game keeps running whatever rules load (`_apLoadRulesIgnored`).
3. **The key is equal.**
4. **The loaded document is an editor's:** a `WeakSet` filled from the panel's own `files:jsonLoaded` subscription,
   classified by `isEditorLoad`. This is the STOP below.

`_teardownForReinit` clears the key. Panels pinned by `componentState` paths still ignore preset switches.

## ⛔ STOPPED: the editor case (a separate ruling)

**Today:**
- An editor republish with the same wiring re-mounts nothing.
- 619fceea9a rebuilds the sub-region map, return spawns and slot data from the edited rules.
- The running game keeps the rooms, check binding and atlas / playback map of the load it booted with. On the
  generated arm, the previously assembled set stays delivered.
- None of the editors republishes on auto-save:
  - the procgen pipeline's auto-save only writes `localStorage`;
  - its rules reach the app only on the **Load into frontend** click;
  - the APWorld editor and the JSON editors publish only on **Apply**.

**What my key would do if the editor case were not excluded:**
- Every Load-into-frontend / Apply whose edit touches the inputs above (generated rooms or seed, an atlas-room exit, a
  placement, a game-state event) would restart the game. On wasm that means asking for ▶ Start again.
- An edit outside those inputs would restart nothing.
- It would happen once per click, never per auto-save.

**What the panel does now:** it keeps today's behaviour, and logs: *"rules changed by an editor (same game wiring,
different rooms) — the running game keeps the rooms it was loaded with; re-load the preset to play the edited ones"*.

Whether an editor republish should re-mount needs Robert's ruling. If he says yes, the fix is to delete the
`_editorLoads` early-return in `_mountedRoomsDiffer` and flip the unit "⛔ STOPPED" test.

Detection caveat: the APWorld editor's Apply uses the **origin preset's** `sourceName`. Only the `appliedBy` marker on
`files:jsonLoaded` names it, and the state manager's re-emit drops it. That is why the panel subscribes to
`files:jsonLoaded` itself (a new subscriber intent in `flashPanel/index.js`).

## Files

| File | Change |
|---|---|
| `frontend/modules/flashPanel/seedlingMountKey.js` | **new**: `seedlingMountKey`, `isEditorLoad`, `EDITOR_LOAD_SOURCES` |
| `frontend/modules/flashPanel/flashPanelUI.js` | `_onRulesLoaded` re-mount branch; new `_mountedRoomsDiffer`, `_mountKeyNow`; `_apLoadKey` / `_apLoadRulesIgnored` recorded in `_startSeedlingRandomizer`, cleared in `_teardownForReinit`; the `files:jsonLoaded` subscription (dropped in `destroy`) |
| `frontend/modules/flashPanel/index.js` | subscriber intent `files:jsonLoaded` |
| `frontend/modules/flashPanel/flashPanelSameWiringRemount.test.js` | **new** unit pins |
| `frontend/modules/tests/testCases/seedlingJsRuntimeTests.js` | the two in-app rows (one factory, appended) |
| `frontend/test-configs/playwright_tests_config-substrates.json` | the two rows, enabled, in `Seedling JS runtime` / `Seedling wasm runtime` |

No edits to `vendor/seedling`, wasm, solver, `levelRun`, jsRuntimeCore, Quick Launch or the procgen panel.
`seedlingRegionBinding.js:567` is untouched.

The generated reference is unaffected: `node scripts/procgen/check-procgen-reference.mjs --check` reports
**ALL CHECKS PASSED**.

## Pins and their mutants

### Unit: `flashPanelSameWiringRemount.test.js`

The setup is a bare panel. It runs over the REAL two presets and the REAL AP load: the wiring module by its computed
`file://` URL, the real atlas arm, and the atlas index and map documents read off disk. Every fetch is held per call.
The only stand-in is `_initializeAdapter`, which builds a fresh adapter and goes straight to the AP load.

The tests:
- the fixture discriminates;
- the switch re-runs the AP load on the NEW rooms;
- the old load in flight is dropped;
- a same payload or an identical copy does not re-mount and does not fetch the AP load's documents;
- an editor-style republish with unchanged rooms does not re-mount, as `procgenPipeline`, as APWorld `appliedBy`, and
  as a plain load, and logs no editor line;
- ⛔ STOPPED: an editor republish that does change the rooms keeps today's behaviour, with the log line;
- a load refused on the wiring restarts on no rules change.

Bounded run: `npx vitest run flashPanelSameWiringRemount.test.js flashPanelRulesDerived.test.js flashPanelInitEpoch.test.js`
gives **19 passed**.

Each mutant was applied to `flashPanelUI.js` and the two `flashPanel*Rules*` / `SameWiring` files were run:

| Mutant | Fails |
|---|---|
| M1: no same-wiring re-mount (`&& false`) | 4 tests: the switch, the in-flight drop, the editor-style one, and the same-payload one (the last by cross-test leakage of the never-dropped load) |
| M2: "any rules change" (key = whole rules JSON) | editor-style republish with unchanged rooms |
| M3: key = rules object identity | same payload / identical copy; editor-style republish |
| M4: no editor STOP | ⛔ STOPPED editor test |
| M5: no wiring-refusal exemption | wiring-refused test |

### In-app rows: `seedling-js-runtime-same-wiring-switch-loads-new-rooms` / `seedling-wasm-runtime-same-wiring-switch-loads-new-rooms`

Each row sets its own state:
1. Boot `seedling_atlas_location` with the game running, and assert the stairs' room is not bound.
2. Switch to `seedling_atlas` with the same wiring and the same runtime. The row asserts both.
3. Require a **fresh adapter**, the atlas map binding `overworld_start__r8c0`, and the new game standing there.
4. The Playback Bot's controller walks `overworld_start__r8c0 -> owls_nest_entrance`, the exit the probe saw refused.
   The row asserts no refusal, and that the game is in `owls_nest_entrance` on level 2.

Mutant M1 against the JS row: **FAILED 31.7 s** on `the switch re-mounted the game (a fresh adapter) …` and `the panel
is on the JS transport` (no fresh adapter ever appears). Restored, it passes.

## Batch results (local, WebGPU, this tree at `d1de3e057d`)

```
[PROGRESS 1/1] seedling-js-runtime-same-wiring-switch-loads-new-rooms PASSED 11.1s     (solo)
[PROGRESS 1/1] seedling-wasm-runtime-same-wiring-switch-loads-new-rooms PASSED 22.2s   (solo)
```

`--batch=seedling-js`: 46/46 PASSED, EXIT 0. HEADROOM OK 377.9 s of 600 s (63 %).

```
[PROGRESS 1/46] seedling-js-runtime-generated-room PASSED 19.7s
[PROGRESS 2/46] seedling-js-runtime-bot-completes-generated-room PASSED 27.7s
[PROGRESS 3/46] seedling-js-runtime-atlas-room PASSED 3.0s
[PROGRESS 4/46] seedling-js-runtime-graphics-pack-boots PASSED 2.2s
[PROGRESS 5/46] seedling-js-runtime-graphics-enemies PASSED 1.3s
[PROGRESS 6/46] seedling-js-runtime-graphics-room-bodies PASSED 1.2s
[PROGRESS 7/46] seedling-js-runtime-graphics-hazards PASSED 1.3s
[PROGRESS 8/46] seedling-js-runtime-graphics-effects PASSED 1.2s
[PROGRESS 9/46] seedling-js-runtime-graphics-lights PASSED 1.2s
[PROGRESS 10/46] seedling-js-runtime-bot-completes-atlas-location PASSED 5.6s
[PROGRESS 11/46] seedling-js-runtime-bot-walks-atlas-rooms PASSED 19.1s
[PROGRESS 12/46] seedling-js-runtime-solver-walks-enemy-room PASSED 11.6s
[PROGRESS 13/46] seedling-js-runtime-solve-progress-view PASSED 11.8s
[PROGRESS 14/46] seedling-panel-layout-sections PASSED 1.3s
[PROGRESS 15/46] seedling-panel-layout-settings PASSED 1.5s
[PROGRESS 16/46] seedling-panel-layout-narrow PASSED 1.3s
[PROGRESS 17/46] seedling-js-runtime-solver-opens-kill-lock PASSED 18.6s
[PROGRESS 18/46] seedling-js-runtime-solver-steps-off-the-door PASSED 8.0s
[PROGRESS 19/46] seedling-js-runtime-solver-budget-falls-back PASSED 2.2s
[PROGRESS 20/46] seedling-js-runtime-solver-keeps-the-frame-clock PASSED 17.7s
[PROGRESS 21/46] seedling-js-runtime-solver-falls-through-pit PASSED 7.7s
[PROGRESS 22/46] seedling-js-runtime-solver-opens-chest PASSED 5.0s
[PROGRESS 23/46] seedling-js-runtime-loop-bot-block-walks-generated-room PASSED 19.8s
[PROGRESS 24/46] seedling-js-runtime-generated-chestdoor-chest PASSED 5.6s
[PROGRESS 25/46] seedling-js-runtime-loop-play-clock-drains-mana PASSED 9.6s
[PROGRESS 26/46] seedling-js-runtime-loop-play-clock-mana-out PASSED 3.1s
[PROGRESS 27/46] seedling-js-runtime-loop-bot-blocks-cross-atlas-rooms PASSED 6.7s
[PROGRESS 28/46] seedling-js-runtime-graphics-effects-switch PASSED 2.1s
[PROGRESS 29/46] seedling-js-runtime-solver-cuts-rope-event PASSED 18.4s
[PROGRESS 30/46] seedling-js-runtime-graphics-puzzles PASSED 2.3s
[PROGRESS 31/46] seedling-js-runtime-graphics-solids PASSED 1.1s
[PROGRESS 32/46] seedling-js-runtime-graphics-rope PASSED 1.8s
[PROGRESS 33/46] seedling-js-runtime-graphics-npcs PASSED 1.7s
[PROGRESS 34/46] seedling-js-runtime-graphics-pickups PASSED 1.1s
[PROGRESS 35/46] seedling-js-runtime-graphics-machines PASSED 1.5s
[PROGRESS 36/46] seedling-js-runtime-game-speed PASSED 9.8s
[PROGRESS 37/46] seedling-js-runtime-sound-start PASSED 7.4s
[PROGRESS 38/46] seedling-js-runtime-sound-panel PASSED 1.6s
[PROGRESS 39/46] seedling-js-runtime-touch-controls PASSED 10.5s
[PROGRESS 40/46] seedling-js-runtime-graphics-one-fade-per-crossing PASSED 20.7s
[PROGRESS 41/46] seedling-js-runtime-graphics-bosses PASSED 5.8s
[PROGRESS 42/46] seedling-js-runtime-music PASSED 3.1s
[PROGRESS 43/46] seedling-js-runtime-solver-fights-bob-encounter PASSED 50.1s
[PROGRESS 44/46] seedling-js-runtime-inventory-menu PASSED 2.2s
[PROGRESS 45/46] seedling-js-runtime-tools-restart-teleport PASSED 11.7s
[PROGRESS 46/46] seedling-js-runtime-same-wiring-switch-loads-new-rooms PASSED 10.2s
```

`--batch=seedling-wasm`: 11/11 PASSED, EXIT 0. HEADROOM OK 185.8 s of 600 s (31 %).

```
[PROGRESS 1/11] seedling-wasm-runtime-bot-names-refusal PASSED 1.0s
[PROGRESS 2/11] seedling-wasm-runtime-loop-bot-block-walks-generated-room PASSED 32.8s
[PROGRESS 3/11] seedling-wasm-runtime-generated-chestdoor-chest PASSED 9.4s
[PROGRESS 4/11] seedling-flash-runtime-loop-bot-block-names-its-stop PASSED 31.1s
[PROGRESS 5/11] seedling-wasm-runtime-loop-play-clock-drains-mana PASSED 35.2s
[PROGRESS 6/11] seedling-wasm-runtime-loop-play-clock-mana-out PASSED 5.1s
[PROGRESS 7/11] seedling-wasm-runtime-loop-bot-blocks-cross-atlas-rooms PASSED 13.8s
[PROGRESS 8/11] seedling-wasm-runtime-touch-controls PASSED 15.7s
[PROGRESS 9/11] seedling-wasm-runtime-tools-restart-teleport PASSED 12.4s
[PROGRESS 10/11] seedling-wasm-runtime-restart-no-walk-hand-walk PASSED 11.9s
[PROGRESS 11/11] seedling-wasm-runtime-same-wiring-switch-loads-new-rooms PASSED 17.4s
```

The Flash row (4/11) logged a STUCK *warn* poll: "Ruffle's SWF fetch resolved before the runtime restore", 30.1 s. That
is the Ruffle CDN fetch in this sandbox, and the row passed. It is not this slice's code.

CI runs on the push; its numbers are not quoted here.
