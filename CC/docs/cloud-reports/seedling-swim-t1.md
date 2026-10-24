# Seedling swim T1: option B end to end (cloud report)

`seedling-swim-t1` is a cloud fan-out build of plan `seedling-swim-plan.md` §6 (T1), as briefed. This file is the report the coordinator reviews. The as-built record is § *Seedling substrate T1-swim — option B end to end* in `docs/json/developer/procgen/seedling-bot-log.md`, and the design summary is `flash.md` § *The water-gated world (swim T1)*.

- **Started from:** `279d75d451` (`origin/main`, 2026-09-29). This is one commit past the brief's expected `d05e5ae017`, and it is a docs commit.
- **Branch:** `claude/seedling-swim-t1-option-b-ns5fhl`. The brief named `seedling-swim-t1`, but the cloud harness only allows pushes to its designated branch.
- **Head:** the commit that adds this file, directly after `646e40f`.
- **Commits:**
  - `3735e87` D1
  - `9bf3240` D2
  - `b1daa1a` D3
  - `b95ec97` D4 docs
  - `646e40f` D4 W0 figures
  - this report
- **Files T2 and T3 own:** none touched. `procgenPalette.js`, `procgenRequirements.js` and `levelWorld.js` are imported read-only by the new tests.

## W0: the seam, on the clean tree (verbatim)

The scratch call was `generateGenRoom({region_id: 'r', exits: [{}], size: {width: 10, height: 10}, rng: <drawn seed 16807>, params: {seedlingGen: {biome: 'post-swim', elements: 'watergate', ...extra}}})`.

```
{} rerolls: 173 rerollCause: doors grownFrom: {"width":10,"height":10} size: {"width":48,"height":48} 2234841ms
```

- **`require: 'canSwim'`:** measured in a pristine worktree at `279d75d451`, `timeout 900 node w0req.mjs` gave **exit 124**, with no answer in 900 s. It then ran about 31 more minutes in a second process without returning, and I killed it by PID.
- **Why it spins:** a draw that meets the directive then fails the door pick. That resets the cause to `doors`, so the room grows instead of being refused after the `require` budget.
- **The brief's figures:** they are S1's own draw, `rerolls: 83`, grown to 28×28, and `require` refused `wall-does-not-seal` after 8. They are not what this draw measured. The cap here is 48 (`ROOM_TILES_MAX`), not 28.

After D1 the same room builds in about 300 ms. It takes re-roll 0, the door is (1,8), and `require` is met:

```
{"require":"canSwim"} rerolls: 0 size: {"width":10,"height":10} start {"tx":1,"ty":1} goal {"tx":5,"ty":3} door [[1,8]] approach {"x":16,"y":112} water 2,3
```

## The W0 rows, BEFORE (`279d75d451`) and AFTER (`646e40f`)

| row | BEFORE | AFTER |
|---|---|---|
| `make-seedling-spiral-room-preset --check`, 7 states: `spiral`, `sphere`, `generated`, `generated-leaf`, `generated-host`, `atlas-host`, `atlas-location` | 7 × `OK: … matches a fresh build` | identical (ignoring `built in N ms`) |
| `--state=generated-swim --check` | (the state did not exist) | `OK: frontend/presets/seedling_generated_swim/AP_1/AP_1_rules.json matches a fresh build — 2 regions (region_2_2:maze, region_3_2:flash_seedling_gen), start region_2_2` |
| `SEEDLING_PORT=8520 check-seedling-generated-set --seeds=1-6` | `OK`, exit 0 | `OK`, exit 0. The output differs only in the box-lock pid and head, the load average and the temp path. |
| `check-sidecar-fields` | `ALL PASS — 1417 entries over 8 substrates` (217 documents, 46 with sidecars) | `ALL PASS — 1419 entries over 8 substrates` (218 / 47; maze 1063 → 1064, flash_seedling_gen 4 → 5), as predicted before the run (see ¹) |
| the 13 shipped md5s (`md5sum frontend/presets/seedling*/*/*_rules.json`) | see the byte-inertia block | **identical, all 13** |
| the new preset's md5 | none | `b6f77113184802e75feb7b25abec167c  frontend/presets/seedling_generated_swim/AP_1/AP_1_rules.json` |
| bounded vitest (the brief's four paths) | **9 files / 173 tests** | **11 / 191**: +2 files, `seedlingGenRoomSwim` (10) and `seedlingGeneratedSwimWorld` (7), plus 1 new row in `presetDefs.test.js` |
| the other touched files (`levelSetExits`, `procgenDocs`, `boxLock.test.js`) | not taken | 10 files / 576 tests, green |

¹ The census reads TRACKED presets only. I measured with `--fixtures` before the D2 commit and predicted 218 / 47 / 1419. The measured result was 218 / 47 / 1419, ALL PASS.

## Per D

### D1: the boot-aware hazard set. PASS

- **What landed:**
  - `hazardCells(record, items = null)`: water (`t === 1`) is not a hazard when `items.canSwim`, and lava (`t === 17`) is not when `items.hasDarkSuit`. Pits always are.
  - Every reader is in `seedlingGenRoom.js`. There is no other reader in `frontend/` or `scripts/`; `seedlingGeneratedSet` does not read it, and the two test-local probes stay item-less.
  - The three readers pass the biome's items:
    - `pickGenRoomDoors`, the core's door pick, lifted out of `drawRoom` and exported so a row can test it directly;
    - `safeReach`, via `world.generation.biome`, which also covers a deserialized payload;
    - `bindAllDoors`, the same way.
  - `goalHoldsWithDoorsAsWalls` already received the items.
- **⚠ The design point the brief did not name:** "water is not a hazard" cannot apply everywhere.
  - A door, its approach and a location still never stand on a lethal cell; that is the item-less `exclude`.
  - A door's approach must be reachable from the start without crossing one. This uses a new opt-in `keepReachable.approachWalls` in `levelSetExits.pickDoorCells`, where approaches are flooded against the wider walls and kept cells against the boot-aware walls.
  - Without this, the farthest-first picker seats the door past the water: the arrival lands with the goal, and the gate gates nothing.
- **Rows:** `seedlingGenRoomSwim.test.js` (10):
  - one row per arm: no items walls water, lava and the pit; `canSwim` opens water only; `hasDarkSuit` opens lava only;
  - byte-inertia: `post-swim` is the only biome granting either item;
  - the picker gives `['1,8']`;
  - re-roll 0;
  - `require` met;
  - the goal certifies with the boot and not without the conch;
  - the approach is on the dry side and the goal only past the water.
- **Mutants** (predicted first, one build each, copy and restore, tree clean after):

  | mutant | predicted | measured |
  |---|---|---|
  | (a) boot items dropped at the door picker (`hazards = hazardCells(record)`) | the picker row reds by name | **1 red**: `LevelSetExitError: levelSetExits: room 'swim' needs 1 door cell(s) and its walkable component offers 0 usable cell(s) …`. The row takes the generator's draw directly, because `generateGenRoom` under this mutant spins for 37 minutes. |
  | (b) `approachWalls` dropped | the door is seated past the water | **2 red**: `expected [ '8,8' ] to deeply equal [ '1,8' ]` and the dry-side row `expected false to be true` |

### D2: the world. PASS

- **What landed:** `SEEDLING_GENERATED_SWIM_STATE` → `seedling_generated_swim` (`--state=generated-swim`), shipped as `shipped:seedling-generated-swim-demo`.
  - **The state:** seed 1, 2 spheres, no filler, 1 item per region, `startSubstrate: 'maze'`, items `{Progressive Swim: 1, victory: 1}`, quotas `{maze: 1, flash_seedling_gen: 1}`, bag `seedlingGenBiome: 'post-swim'`, `seedlingGenElements: 'watergate'`, `seedlingGenRequire: 'canSwim'`.
  - **The shape: the brief's first option.** The maze START holds `Progressive Swim`. Its exit into the room is gated `Has(Progressive Swim)`, and so is the room's door back. The 8×6 room is at re-roll 0 and holds `victory` on its goal cell (2,3).
  - **The water is the gate.** The one water cell (1,2) is the only way from the door's approach (5,1) to the goal:

    ```
    ########
    #S...aD#
    #~######
    #.G....#
    #......#
    ########
    ```

  - **Why not the second option** (the room hosting a victory maze child): with D1's approach rule every door sits on the dry side, so a child door past the water cannot exist. A filler room's water would gate nothing.
- **The item library:** `rulesJson.items['1']['Progressive Swim']` is `{name: 'Progressive Swim', id: 1, classification: 'progression'}`. There is no STOP.
- **`flash_panel`:** `{"config":"seedling.json","wasm":"seedling_bot_ap_p4e/game.html"}`, the default build via `FLASH_PANEL_WIRING`.
- **Seeds 1–12 of the state** all build: a maze START and a generated room at re-roll 0, except seed 2 at re-roll 1.
- **Rows:**
  - `seedlingGeneratedSwimWorld.test.js` (7): the knob round-trip, the item's one name (`ITEM_LABELS.canSwim === 'Progressive Swim'`), deterministic and oracle-clean and schema-valid, the item library, **the tree's gate = the room's requirement**, **the water between the arrival and the goal** (the test's own flood), and committed = fresh build.
  - `presetDefs.test.js` +1 (the shipped id). `presetDefs.test.js` is 45/45.

### D3: the play gate. PASS (25/25), with a measured narrowing

`node scripts/procgen/check-seedling-generated-swim-play.mjs --host=http://localhost:8520` runs headless on the logic-only channel and takes the box lock (no holder in the sandbox). It passed on two consecutive runs.

- **Prediction:** 7 phases, about 21 checks.
- **Measured:** 6 phases (A, K, E, S, V, C) and **25 checks**: 7 static rows, A 3, K 2, E 6, S 3, V 2, C 1, and the final agreement row. I miscounted the static rows.

Phase lines (run 4, verbatim, trimmed at the detail):

```
PASS: no player meets the gate WITHOUT Progressive Swim: the maze reaches exit from its entrance, and every such path crosses the item's cell (collected on step) — so the brief's refusal phase W is unreachable here, measured
PASS: THE WATER IS THE GATE, by the room's own record: from the door's approach the goal is reachable only across water — water 1,2; approach 5,1; swim leg 5,1 4,1 3,1 2,1 1,1 1,2 1,3
PASS: Phase A: the player starts in the maze region region_2_2 — region_2_2
PASS: Phase A: the flash glue has loaded nothing yet — {"loads":0,…}
PASS: Phase K: before the walk the state manager holds no Progressive Swim — 0
PASS: Phase K: real keys walked the maze to region_2_2__loc_0__5_3 {"x":5,"y":3} and collected Progressive Swim — 1 key(s); holds 1
PASS: Phase E: WITH Progressive Swim the maze keys cross exit into the generated room region_3_2 — 3 key(s); region region_3_2
PASS: Phase E: the load delivered and the panel log names the GENERATED arm for region_3_2
PASS: Phase E: botLevelSet reports the ASSEMBLED set — … "active":"seedling-gen-1-fcf4e9d4" …
PASS: Phase E: the arrival lands VISIBLE on out_teleporter_96_16's dry APPROACH 5,1, level 0 — live {"tx":5,"ty":1,"x":88,"y":24}
PASS: Phase E: the bridge grants canSwim (the conch — the state property the game config names) and drownTimer is 0 — readState canSwim true; botStatus drown_timer 0
  (Phase S) path 5,1 4,1 3,1 2,1 1,1 1,2 1,3 ; walked 4,1@(74.1,24.0) 3,1@(58.1,24.0) 2,1@(42.9,24.0) 1,1@(26.1,24.0) 1,2@(21.3,37.7) 1,3@(21.3,54.1)
PASS: Phase S: real keys SWAM the gate — every water cell on the path crossed (1,2), the player stands past it on 1,3
PASS: Phase S: drownTimer stayed 0 on every step (61 samples) and after — the conch holds — samples [0]; after 0
PASS: Phase V: before the victory the completion condition does NOT hold (the probe can say no) — {"cc":{"type":"item_check","item":"victory"},"holds":false}
PASS: Phase V: real keys walked onto region_3_2__loc_0's cell 2,3: the game wrote pendingCheck, ONE user:locationCheck, and the state manager holds victory
PASS: Phase C: WORLD COMPLETE — the rules' completion_condition (off the page's static data) HOLDS on the live snapshot — {"cc":{"type":"item_check","item":"victory"},"holds":true}
OK: the generated swim world plays — the conch opened the maze's gate, the player swam the watergate with drownTimer 0 and took the victory; the world is complete
ALL CHECKS PASSED
```

- **⛔ W is not in the gate, and neither is a maze-side refusal.** This is measured, not skipped.
  - The room is only entered through the maze exit gated on the conch.
  - Every maze path from the START's entrance to that exit crosses the conch's cell, and the maze collects on step.
  - Seeds 1–12 of the state all measure the same (`gateOffItemPath false` ×12).
  - So no player ever stands at the maze's gate or at the water without the item.
- **How I found it:** a first draft of the gate had a phase L (walk into the maze gate without the item). It "failed" because the walk collected the conch on the way in, the Down press then crossed into the room, and a probe confirmed `held 1, region region_3_2` after the fourth key.
- **The host door gate** (`seedlingDoorGate`) is not on this crossing, which is a maze exit.
- **The drown-timer refusal** is therefore measured nowhere in this slice. S1's D6 wasm witnesses remain the only evidence of water's lethality in the certified rooms.
- **A measured hazard of the walk:** after the swim the player keeps drifting under water friction (y 54 → 63), so the walker's snap can release on the goal cell before the pickup overlaps. Run 5 needed the added `settleOn` step, which walked to (39.2, 62.3), did not fire, then settled at (42.1, 60.0) and fired. Run 4 fired without it.

### D4: records. PASS

- `flash.md`:
  - the hazard bullet made boot-aware;
  - the old "watergate does not survive a generated room yet" paragraph replaced by the measured fix;
  - a `###` section, *The water-gated world (swim T1)*;
  - a committed-worlds table row;
  - the shipped list.
- `seedling-bot-log.md`: `### Seedling substrate T1-swim — option B end to end`, directly after § S2-swim.
- `pipeline-presets.md`: a table row.
- The preset's own `README.md`.
- `generate-procgen-reference.mjs` was run after each docs edit. `--check` gives `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` at `646e40f`. procgenDocs vitest is 8 files / 483 tests.

## Enrolment re-pins, by name

| roster | moved |
|---|---|
| `frontend/presets/preset_files.json` | + `seedling_generated_swim` (`register-preset.py`, name "Procgen Maze" like its siblings) |
| `scripts/release/preserved-dev-presets.txt` | + `seedling_generated_swim` |
| `make-seedling-spiral-room-preset.mjs` `PRESETS` | + `generated-swim` (8 states) |
| `presetDefs.SHIPPED_PRESETS` / `presetDefs.test.js` | + `shipped:seedling-generated-swim-demo` and its row. `presetDefs.generate.slow.test.js` and `check-procgen-presets.mjs` enrol it by the list, and I did not run them (slow tier / browser). |
| `scripts/procgen/boxLock.test.js` guarded list | + `check-seedling-generated-swim-play.mjs`. The row reddened by name first (`+ "check-seedling-generated-swim-play.mjs"`), then 26/26. |
| `check-sidecar-fields` | 1417 → 1419 entries, 217 → 218 documents |
| `check-canonical-placements` | 218 documents, ALL PASS (BEFORE not measured) |
| reference: `instruments.js` / `architecture.md` | 283 → 284 instruments; `check-` 95 → 96 (58 → 59 browser); `--wait-for-box` 105 → 106; cited 115 → 116 |
| reference: `docsIndex.js` / `README.md` | word counts only (220,750 → 221,592) |
| `check-procgen-help` | the new gate `PASS … HELP ok · IMPORT ok`. The same **3 FAILs at the pristine base and at head**: `census-seedling-atlas-doors.mjs`, `migrate-per-player-blocks.mjs` and `probe-seedling-hold.mjs`, each `IMPORT SIDE EFFECT`. They are not this slice's. |

## What the brief got wrong (measured)

1. **The seam's numbers.** "rerolls: 83, grown 10×10 → 28×28" is S1's draw. Drawn seed 16807 reads **173, grown to 48×48, 37 minutes**, and the `require` arm does not come back in 900 s. It never reaches the "refused after 8" sentence, because a met draw that fails the door pick resets the cause to `doors`.
2. **"Water is not a hazard when canSwim" at every reader.** Taken literally, the farthest-first picker seats the door past the water (mutant (b): `8,8`), so the arrival lands beside the goal and the gate gates nothing. D1 keeps the stand-on set item-less and adds `approachWalls`.
3. **Phase W.** It is not reachable in the brief's own primary shape, because the tree gates the room's only entry on the item. Nor is a maze-side refusal reachable, because the conch lies on every path to the gate (seeds 1–12).
4. **"`check-seedling-generated-set`'s set" as an enrolment.** That checker reads no preset; it builds from the generator. Nothing moved there.
5. **`drownTimer` "through the bridge's `state_properties`".** `games/seedling.json`'s `state_properties` carry `canSwim` but not `drownTimer`. The drown timer is `botStatus().drown_timer` (the p4e bot build). `readState()` carries `canSwim`.
6. **The branch** (`seedling-swim-t1` vs the harness's `claude/…`) and **the start SHA** (`279d75d451`, one docs commit past `d05e5ae017`).
7. **The flash.md section names.** The brief's "*Host-enforced gates (G4)*" and "*The re-roll and growth (G5, G8)*" are *Host-enforced door gates* and *Re-roll and growth*.

## Residue

- **The refusal half of the swim world is unplayed.** A world where a non-swimmer can stand at the water needs the entry ungated and the victory behind the water. The sphere tree cannot express that: gates ride region entries, not locations. It needs either a location-level rule in the tree, or a maze whose item sits off the path to its gate (the maze generator placed it on-path in 12/12 seeds).
- **`bindAllDoors`' kept cells are not all checked against the approach walls.** The already-bound doors' approaches ride `cells`, which is checked against the boot-aware walls. So an engine-added door could, in a room with water, seal a bound door's approach from the dry side while leaving it reachable by swimming. This needs 2+ doors in a post-swim room; the committed world has one. Not probed.
- **`builds.json`'s `namedBy` preset list** (in the wasm submodule) does not name `seedling_generated_swim`. The brief forbids wasm and gitlink moves, so this is a submodule edit for whoever next moves that pin.
- **`standingValues.test.js` › "a gate that sleeps past the deadline is KILLED"** is red here AND at the pristine base (a sandbox process-group kill). It is environmental and not this slice's.
- **The `require` arm's growth** (a met-but-unseatable draw grows instead of refusing) is a pre-existing re-roll-policy question that D1 makes moot for water. It is unexamined for other directives.

## Byte-inertia

The 13 shipped preset md5s, BEFORE and AFTER, are **identical**:

```
f8ae9918dc043e329e1e5f5a737ec596  frontend/presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json
2e3f74e1d0f4a58bb91ba276586a7195  frontend/presets/seedling_atlas/AP_1/AP_1_rules.json
431fa72dae53241a7c291c59ac15d550  frontend/presets/seedling_atlas_host/AP_1/AP_1_rules.json
279c9bb643d55eb74f9581ea932071b8  frontend/presets/seedling_atlas_location/AP_1/AP_1_rules.json
5a2083326d24ffd1534b1197c93ee1a5  frontend/presets/seedling_atlas_maze/AP_1/AP_1_rules.json
fa6a786d510243e124a73322f772554c  frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json
edebfa1f00215b7846022c5b538820a5  frontend/presets/seedling_generated_host/AP_1/AP_1_rules.json
f7db7bed32a5fb33129c0d55938704bc  frontend/presets/seedling_generated_leaf/AP_1/AP_1_rules.json
28efab1877d266057bb3da0d8911207d  frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json
dbf79293e7e8d4406634549de8daee36  frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json
59959e712cc11db546e5495245f1277d  frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json
443e3ca23f86a872811bff5f7ef3ca15  frontend/presets/seedling_sphere_room/AP_1/AP_1_rules.json
cb8e53849d9e9a3c1025851cedf79e61  frontend/presets/seedling_spiral_room/AP_1/AP_1_rules.json
```

The new preset:

```
b6f77113184802e75feb7b25abec167c  frontend/presets/seedling_generated_swim/AP_1/AP_1_rules.json
```

The rest also holds:
- all seven existing `--check`s are OK and unchanged;
- the generated set (seeds 1–6) is OK;
- the census is ALL PASS.

Why this is inert: no biome but `post-swim` grants `canSwim` or `hasDarkSuit`, which is asserted by a row. So `hazardCells(record, items)` equals `hazardCells(record)` for every other room. `approachWalls` equals the item-less set, which is exactly what `walls` was, so both floods agree with the old single flood.

No standing value, tape, AS3, wasm or gitlink moved; `pytest` was not run; vitest was run bounded only.
