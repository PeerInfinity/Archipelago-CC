# cloud report — rules-l112-owl-rocklock

Branch `claude/lockruling-premise-check-2iunyb`. **merge-base `9c0f904549a4f6f9c6f2ca511e1a29dd9f7bc177`** (= origin/main at start).
Bootstrap: `session_bootstrap.sh --seedling` → READY; `update_host_settings.py minimal-spoilers`.

Commits (drop the last one, this report, before landing):
1. `aab21c02` — `lockRuling` premise check + `SCRIPT_GROUP_OPENERS` + census/AS3 pins (`seedlingScriptOpeners.test.js`).
2. `557036b7` — regeneration through the producers + downstream restamps.
3. `88dcb973` — `maze.md` fence row + procgen reference regen.

**No sphere move.**

## AS3 re-verification (`vendor/seedling` @ ccdf189776)
- `assets/levels/End/Boss.oel:259`: `<rocklock x="112" y="16" tset="0" tag="1"/>` ✔. `:258` is `<finalboss x="64" y="96" tag="0"/>`, so the Owl's `tag+1` = 1, the rock's tag ✔.
- `src/Puzzlements/RockLock.as:31-38` `check()`: `if (tag >= 0 && !Game.checkPersistence(tag)) FP.world.remove(this)`, with no tSet test ✔.
  `:49-74` `update()` fades the rock only `if (activate)`, and otherwise re-solidifies ✔.
- `src/Enemies/FinalBoss.as:61` `onlyHitBy = "Lava"` ✔. `:116-123` a lava tile hits it ✔. `:212-224` `case "dead"` →
  `Button.activateAll(null, 0, true)` (`:218`), then `setPersistence(tag,false)` / `setPersistence(tag+1,false)` (`:221-222`) ✔.
- `git grep "activateAll"` over `*.as` finds `FinalBoss.as:218` and `Button.as:46` (plus the definition at `Button.as:50`). Only those two callers ✔.
- L112 holds no `button`, `buttonroom` or `rope` ✔.
- Census over `seedling-map.json`, all levels: a grouped (tSet ≥ 0) lock-family placement whose level has no Button, no
  `room == -1` ButtonRoom and no rope of its group gives **exactly one: `112:rocklock@112,16`** ✔. (A `room ≥ 0` ButtonRoom
  writes another level's persistence, `ButtonRoom.as:80-93`, and does not walk its own group.)

## Design
- `buildGroupOpeners` already is the in-level opener census (Button, `room == -1` ButtonRoom, rope). In the `tSet >= 0` arm,
  after `GROUPED_LOCK_EXCEPTIONS`:
  - **If** the caller supplied `ctx.groupOpeners` **and** it has no `"<level>:<tSet>"` entry, the ruling looks up
    `ctx.scriptOpeners`.
  - **Otherwise** it keeps today's ruling (re-closing / OPEN).
- `SCRIPT_GROUP_OPENERS` is **data with an AS3 citation per row**, keyed by class tag. It has one row:
  `finalboss: { group: 0, tagOffset: 1, killRule: 'finalboss', cite: FinalBoss.as:212-224 + RockLock.as:31-37 }`.
  - `buildScriptOpeners(map)` maps `"<level>:<group>"` to `{ opener, tag: own tag + tagOffset, row }`.
  - The lock is ruled `GATED(PLAYTHROUGH_ENTITY_OVERLAY[killRule].condition)`, i.e. the overlay's `finalboss` row, A_WEAPON.
    That is the same condition as `owl@L112`.
- **Throws by name** in two cases:
  - no in-level opener and no row;
  - a row whose opening is not durable for this lock. It must be a `rocklock` whose tag equals the script's cleared tag,
    because only `RockLock.check()` honours persistence whatever the tSet, so anything else would be a this-visit opening.
- Without `ctx.groupOpeners` (unit calls with no map), the ruling is unchanged. Today's LAW-2 tests rely on that.
- Plumbed in `make-seedling-playthrough-rules.mjs` (both `overlayEntitySemantics` call sites: `scriptOpeners: SCRIPT_OPENERS`).
- Pins (`frontend/modules/flashPanel/seedlingScriptOpeners.test.js`, 7 rows):
  - `groupedLocksWithoutOpener(MAP)` equals `[{ site: '112:rocklock@112,16', script: 'finalboss@64,96' }]`. That is
    1 without an opener and 1 resolved.
  - The script's tag equals the rock's tag.
  - The ruling equals the `finalboss` condition.
  - Both throws.
  - The no-ctx fallback.
  - Re-read against the AS3 (skipIf no `vendor/seedling`): the `Button.activateAll` callers outside `Button.as` are exactly
    `['Enemies/FinalBoss.as']`, and its source contains `activateAll(null, 0, true)` and `setPersistence(tag+1, false)`.

## Diffs
**AP_1 rules.json** (semantic diff, `regions` only; other top-level changes are provenance/region_atlas/sidecars). **Only L112:**
- `level_112` → `level_112__r0c7` + `level_112__r2c2`.
- `level_111 -> level_112__r2c2` True_. `level_112__r2c2 -> level_111` True_. `level_112__r0c7 -> level_113` True_.
- `r2c2 -> r0c7` and `r0c7 -> r2c2` = Or(Sword, Ghost Spear). The atlas holds one bidirectional internal exit.
- Event `L112 flag 1: rocklock@112,16 cleared` is in r2c2, `across: [level_112__r0c7]`, rule Or(Sword, Ghost Spear). It was True_.
- `Level 112 - Owl` is in r2c2, with the rule unchanged.
- `level_113 -> level_112__r0c7` (and `#2`) = Has(event), as before, renamed only.

**Seed 1 (minimal-spoilers), `AP_14089154938208861744`:**
- The Spoiler is **byte-identical**.
- Sphere log: one line. Sphere 73's `new_accessible_regions` has `level_112` → `level_112__r0c7`, `level_112__r2c2`. No location moves.
- Seed rules.json: the same L112-only diff.
- `preset_files.json` was not dirtied by the Generate run, and no apquest dir was created.

**Maze preset:** `make-seedling-playthrough-maze.mjs` regenerates it **byte-identical, the stamp included**. L112 is not in
the maze's level list yet (`grep -c level_112` = 0) and the restamp hashes the restricted atlas. So this slice changes
nothing in the maze; the rock will reach it when L112 joins.

**Partition:** the L112 row (54 regions with sub-regions).

**World package:** `Locations.py`, `Regions.py`, `Rules.py`, `_worldgen_region_atlas.json` and `_worldgen_sidecars.json` were regenerated.

**Downstream restamps** (each with a dated `⛓ rules-l112-owl-rocklock` comment):
- `atlas_files.json` id.
- `seedlingAtlasDoorCensus`: id; 53/199/297 → 54/201/298; swim 206 unchanged.
- `levelSetExporter`: id; subgraphs 53 → 54; internal exits 297 → 298.
- `vanillaOverlay` playthrough md5 → `141195a8…`. The overlay fixture rewrites byte-identical.
- `flashSeedlingAtlasKnob` zones 184 → 185.
- `seedlingAtlasArm` rooms 261 → 262.
- `divergence-door-leg-keys.json`, re-recorded by its own recipe: 841 → 837.
  - 4 keys re-key into their sub-region.
  - 4 go, each now a crossing of the rock: `r2c2 <- in_L111 -> out_teleporter_112_0`; `r0c7 <- in_L113 ->` the L111 door,
    the Owl and the rock flag.
- `seedlingDivergenceLegs` pins:
  - gated 45 → 42;
  - staged 37 → 35;
  - goal-event legs are the same by key, with ids from 792 on shifted by −4 (`legs[801]` → `legs[797]`).

## Gates
| gate | result |
|---|---|
| `make-seedling-playthrough-rules.mjs --check --quiet` | exit 0 |
| `make-seedling-subregion-partition.mjs --check` | exit 0 (seedling-1973beee: 54 regions with sub-regions) |
| `make-seedling-playthrough-maze.mjs --check` | OK, byte-identical |
| `make-seedling-vanilla-overlay` / `sphere-order` / `starter-atlas` / `spiral-room-preset` / `entity-colliders` `--check` | all OK, exit 0 |
| `generate-procgen-reference.mjs --check` | **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE** (after regenerating docsIndex/README for the maze.md row's word count) |
| bounded vitest (114 files; see below) | **114 passed / 114** |

The bounded vitest set:
- every test file that names `seedling-playthrough.json`, `seedling_playthrough`, `seedling-subregion-partition`,
  `make-seedling-playthrough*`, `PLAYTHROUGH_ATLAS` or `seedlingPlaythroughOverlay`;
- every test file that names `developer/procgen` or `maze.md` (the docs pins);
- the remaining required files: `scripts/procgen/boxLock.test.js`, `scripts/test/noNewDocsReferences.test.js`,
  `scripts/procgen/checkProcgenHelp.test.js`, `scripts/procgen/procgenHelpBaseline.test.js`,
  `frontend/modules/flashPanel/atlasIndex.test.js` and the new `seedlingScriptOpeners.test.js`.

`.slow` / `.calib` / omsi-loops are excluded. The first run of the set was 9 files red, all downstream pins of the restamp
(listed above). After the restamps it is 114/114.

## Notes / could not run
- The `--seedling` bootstrap leaves six submodules uninitialised (bulletml-dodge, cavernous-ii, journey-to-ascension,
  omsi-loops, textAdventureEngine, swfRecompilerPanel/browser). With them missing, `generate-procgen-reference --check`
  reports 6 unrelated diffs (the substrate registry). I ran `git submodule update --init` on them (no pointer moved), and
  after that only the docs-index word count differed, and that diff was mine.
- I did NOT run `check-seedling-atlas-preset.mjs` or `check-seedling-atlas-maze.mjs`, which are host/browser checks against a dev
  server. The first threw at startup and the second refused because nothing serves :8000. I also did not run the unfiltered
  vitest (ruling 52), the whole-game certifier, the survey or the npm/Playwright batches. Those are the planner's CI dispatches.
- **Expected certifier move** (not measured here): the four L112 problems should go.
  - `level_112: location L112 flag 1 … is not priced` → the event now carries A_WEAPON.
  - The three `level_113 → level_112` landings at (1,1), (7,1) and (8,1) now land in r0c7, whose only way on is the rock (A_WEAPON).
  - The L113 finaldoor / Watcher row at (1,1) is out of scope, as briefed.
- Rebase note for the parallel `tile-primitives-sphere-order-10`: both slices restamp the playthrough family. Whoever lands
  second re-runs the producers in the brief's order and re-records the pins above. The maze preset is untouched here.
