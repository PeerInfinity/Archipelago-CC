# Seedling swim S2: the playthrough atlas as a pipeline supply (cloud report)

- **Branch:** `claude/seedling-swim-s2-atlas-pipeline-ckmmv4`. This is the harness-designated branch, not the brief's `fanout/seedling-swim-s2`: the environment allows pushes only to the designated branch.
- **Started from:** `origin/main` @ `34f32cf324ff6e5f9a932779719a21a2a6d49e44`. The designated branch was 29 commits behind main with no commits of its own, so it was reset to main.
- **Head before this report:** `deae99a322333f265ed9909c322fa463130a6c9e`. This report is the one commit on top of it.
- **Commits:** D1 `a140f22`, D2 `e129204`, D5 `40eca98`, D6 `deae99a`, then this report. D3 and D4 have no commits (STOPPED, see below).

## The first thing to know

**Installing the playthrough atlas does not make its swim crossings pipeline doors.**

`flash_seedling` places one sub-region per AP region. A placed room's doors are the level's teleporters, and their rules come from `boundaryRule` over `region.exits`, which carry no rules in this atlas. A crossing between sub-regions of one level stays geometry inside the room.

The measurements:
- The content source's zones carry **0** swim rules.
- In L47, 1 of 9 sub-regions is placeable: `level_47__r2c9`, which holds the `r5-swim-cross` boot tile (13,8).
- All 8 swim-side sub-regions of L47 are doorless.

So D3 (the committed swim demo world) and D4 (its play gate) are STOPPED with this measured refusal. D1, D2, D5 and D6 landed.

## W0: the seams, measured

**How the atlas reaches `sourceOf`:**

| Driver | What it does | Consequence |
|---|---|---|
| Sphere growth | Never calls `applyPipelineConfig`; `prepareSphereGrowth` only cleared the placed rooms. | Sphere growth used whatever atlas the module had last installed. |
| Shuffled spiral | ① `applySubstrateConfig` calls `applyPipelineConfig(substrateConfig[id])`. | `presetRun.buildSpiralRun` filled `substrateConfig` from region libraries only, so no preset or bag key could reach it. |
| Panel | Runs the same `presetRun` assembly. | Same as the two drivers above. |

**How the atlas document is loaded:**
- The pipeline imports the starter statically.
- `atlas_files.json` is fetched only by the APWorld hub's read-back (`zoneConfigFromSlot`) and by the randomizer's atlas arm.

**Install path chosen: a static JSON import of the playthrough, beside the starter.**
- Every install seam (`prepareSphereGrowth`, `applyPipelineConfig`, `generateZoneForSpecs`) is synchronous.
- The preset producer and vitest have no fetch.
- Precedent: jta's 169 KB `vanilla.json` is imported the same way.
- Cost: 275 KB more in the module graph at boot.

**Baseline gates:**

| Gate | Result |
|---|---|
| `make-seedling-spiral-room-preset --state=<s> --check` for spiral, sphere, generated, generated-leaf, generated-host, atlas-host, atlas-location | 7 × `OK: … matches a fresh build` |
| `SEEDLING_PORT=8510 check-seedling-generated-set --seeds=1-6` | `OK` (`procgen-roundtrip-6-c75feb6f`, reachability 6/6) |
| `check-sidecar-fields` | `ALL PASS — 1417 entries over 8 substrates · 0 issue(s), 2 warning(s), 16 not-checked notice(s)` |
| `md5sum frontend/presets/seedling*/*/*_rules.json` | **13 files**, not 21 (see the byte-inertia block) |
| Bounded vitest before (`npx vitest run frontend/modules/flashPanel frontend/modules/procgenPipeline/presetDefs*.test.js`) | 35 files, 658 tests passed |

## D1: the install knob (`a140f22`) — PASS

**What landed:**
- The bag key `seedlingAtlasId` (`SEEDLING_ATLAS_ID_KEY`), holding an `atlas_id` from `atlas_files.json`. Absent means the starter.
- `SEEDLING_INSTALLABLE_ATLASES` = [starter, playthrough]. Any other id is refused by name.

**Where each driver picks up the knob:**

| Driver | Route |
|---|---|
| Sphere growth | `prepareSphereGrowth({params})` installs the atlas at plan time. The tree's `canHostExitGates` reads it there. |
| Shuffled spiral | A new registry hook, `pipelineConfigFromParams`, is merged by `presetRun.buildSpiralRun` into `substrateConfig.flash_seedling.atlasId`. `applyPipelineConfig` now reads `atlasId` as well as `atlasDoc`, and refuses both at once if they disagree. |
| Top-down and the hub's initialise | `buildZoneSpecs` copies `regionParams.seedlingAtlas.atlasId` onto the zone specs, and `generateZoneForSpecs` installs it. Without this, the picker would be a dead control in the initialise form, since `flash_seedling` is an initialise target. |
| Panel | An *Atlas* select in `renderProcgenParams`. |

**Gate rows:**
- `npx vitest run frontend/modules/flashPanel/flashSeedlingAtlasKnob.test.js`: 7 passed. For both drivers it runs the picker's bag through `buildRunFromState` and `runPresetHeadless`, then reads `region_atlas.atlas_id` and every placed room's `atlas_ref`.
- With the knob set, both drivers place playthrough rooms. Sphere, seed 1, places `level_19/r5c5`; spiral places `level_0/r1c6`.

**Mutant (a): the knob recorded but never installed.**

| | Prediction | Measured |
|---|---|---|
| First build (only `prepareSphereGrowth`'s install removed, plus the spiral merge) | The picker changes nothing; each driver's row goes red. | Only the spiral row went red. The sphere row stayed **green**, because the realise-time `buildZoneSpecs` route also installs. |
| Second build (after adding a row that isolates the plan-time install) | Red where the knob no longer lands. | **2 rows red**: the spiral world row and the `prepareSphereGrowth` row. |

Restored, md5-identical: `837739d4…` for the library and `5bc20939…` for `presetRun.js`.

**Reference and docs:**
- `generate-procgen-reference` first found `pipelineConfigFromParams` undocumented. A row was added to `substrate-registry.md` § Entry contract; findings are now 0.
- `docLinks`/`docsRender` census 301 → 302, re-pinned by name.

## D2: the census (`e129204`) — PASS

`node scripts/procgen/census-seedling-atlas-doors.mjs` (report-only; `--atlas=<id|file>`, `--json=`).

**The witness rule.** A tape witnesses level L when it boots in L, its `noHazards` lacks `water`, and it is granted a tag whose AP item is `Progressive Swim` (`ITEM_FOR_TAG`: `conch`, `feather`). The witness set is derived from the tapes, never typed. **Bound:** boot level only, with no replay.

**Totals:**
- `atlas seedling-ae833c1e · 113 regions · 52 with a subgraph · 189 sub-regions · 285 internal exits`
- `the Progressive Swim rows: 216 of 285 internal exits, over 23 levels`
- Rules: `Has(Progressive Swim)` 179, `Has(Progressive Swim, 2)` 33, and 4 mixed `Or`/`And` rows.

**The swim levels:**

| Level | Swim rows | Verdict | Witnesses |
|---|---|---|---|
| 47 | 36 | WITNESSED | r5-swim-cross, r5-swim-latch (no-swim: r5-swim-drown) |
| 54 | 36 | BOT-UNCERTIFIED | — |
| 115 | 33 | WITNESSED | r6-seed-control, r6-seed-credits |
| 89 | 23 | BOT-UNCERTIFIED | — |
| 94 | 20 | BOT-UNCERTIFIED | — |
| 58 | 18 | BOT-UNCERTIFIED | — |
| 46 | 9 | BOT-UNCERTIFIED | — |
| 0 | 6 | WITNESSED | r5-waterfall-climb, r5-waterfall-shut |
| 51 | 6 | BOT-UNCERTIFIED | — |
| 87 | 6 | WITNESSED | r5-feather |
| 45 | 4 | BOT-UNCERTIFIED | — |
| 29, 30, 92 | 3 each | BOT-UNCERTIFIED | — |
| 48 | 2 | BOT-UNCERTIFIED | — (r5-swim-latch swims L48's column but boots in L47) |
| 5, 12, 15, 44, 53, 60, 93 | 1 each | BOT-UNCERTIFIED | — |
| 37 | 1 | WITNESSED | r5-l37-burn, r5-l37-burn-control |

**Summary:**
- `WITNESSED levels: 5 [47, 115, 0, 87, 37]`
- `BOT-UNCERTIFIED levels: 18 [54, 89, 94, 58, 46, 51, 45, 29, 30, 92, 48, 5, 12, 15, 44, 53, 60, 93]`
- `swim rows on a WITNESSED level: 82 of 216`

**The pipeline side:**
- `swim rows with a placeable side: 104 of 216; with BOTH sides placeable: 15`
- `swim rules the content source's zones carry (bound-door boundaryRule + location rules): 0`

**Pin:** `scripts/procgen/seedlingAtlasDoorCensus.test.js` pins 113/52/189/285/216, the 23 levels and the witness set. 4 tests passed.

## D3: the committed demo world — STOPPED (measured refusal)

These are the brief's premises, as measured:

1. **The swim crossing is not a pipeline door.** `buildSeedlingContentSource` emits one zone per sub-region with ≥1 wired door. `extractZoneRules` and `generateZoneForSpecs` carry rules only from bound doors (`boundaryRule`) and the room's own locations. The census counts **0** swim rules across all 168 placeable rooms.
2. **Its far side cannot be placed.** In L47, `level_47__r2c9` is the only placeable sub-region. `componentForTile` puts the `r5-swim-cross` boot tile (13,8) there, `exact: true`. Its four doors are `in_L46_176_0`, `out_teleporter_216_112`, `out_teleporter_240_464` and `in_L48_112_304`, all in `r2c9`. The 8 sub-regions it swims to are all doorless. So "its far side leading to a maze holding victory" cannot be built.
3. **The room is not pinnable from a state.** Sphere growth picks the tightest fit: with the knob set, seed 1 picks `level_19/r5c5`. The spiral picks by zone ordinal. Neither can name `level_47__r2c9` without a substrate change.
4. **The item library.** `mergedItemLib` does not list `Progressive Swim` (`flash_seedling` has no `libraryItems`). But a sphere scenario `{Progressive Swim: 1, victory: 1}` with the playthrough installed builds anyway, with 16 mentions of the item. So the item name is not the blocker.

Nothing was committed for D3, and the derived-roster sweep was not needed.

## D4: the play gate — STOPPED

D4 depends on D3's world, so there is no pass line.

## D5: the survey to sphere 2.2 (`40eca98`) — PASS (report delivered)

The brief assumed the survey had an `--out=` flag and could extend its legs. **It had neither**: the three legs were hard-wired, and it wrote only to `NewDocs/…/survey.json`. So D5 adds two opt-in flags:

- `--through=2.2` appends leg 1.4 (`Level 029 - Boss Key 1` → Green Key) and leg 2.2 (`Level 032 - Bob Boss` → Fire) after the shield.
- `--out=<file>` is required with `--through`. The survey rows go to that file; the route and the views go to `NewDocs/…/through-2.2/`. `survey.json` is never touched.

**Default mode is byte-identical.** `--derive-only` stdout md5 `27ff43dbb8e4d4e08c3dc741c5a02bc7` and `route.json` md5 `1e08f9ad37c505a5ca8360a882cc6b96` are `cmp`-equal to HEAD's copy of the script.

**Run:**
```
node scripts/procgen/survey-seedling-route.mjs --through=2.2 \
  --out=CC/docs/cloud-reports/seedling-swim-s2-survey.json --only=21,22,23,24,25,26,27,28,29,30 --timeout=120
```
Headline: `## HEADLINE: 5/10 route steps SOLVE today`.

**The derived legs:**
- **1.4:** L20 → L13 → L0 → L12 → L21 → L22 → L29. Forced rooms: `level_13`, `level_0__r8c0`, `level_12__r0c37`, `level_21`, `level_22`.
- **2.2:** L29 → L22 → L30 → L32. Forced rooms: `level_30__r2c10`, `level_30__r8c13`.

**The rows** (the refusal text is in the committed JSON, verbatim):

| Step | Level | Verdict | Ticks | Notes |
|---|---|---|---|---|
| 21 | L20 | SOLVED | 560 | Shield, then exit to L13. The errand is new: the old step 21 had no exit. |
| 22 | L13 | SOLVED | 48 | |
| 23 | L0 | SOLVED | 229 | |
| 24 | L12 | NO-EDGE | — | `the atlas has 0 edges L12 -> L21 (none)…`. The hop is the pit `in_pit_L12_5_5`, which the survey's `to`-edge vocabulary cannot express. |
| 25 | L21 | NO-ARRIVAL | — | Same text: no boot can be staged after a pit fall. |
| 26 | L22 | SOLVED | 89 | |
| 27 | L29 | **REFUSED** | — | See quote (a) below. |
| 28 | L22 | SOLVED | 102 | |
| 29 | L30 | REFUSED | — | See quote (b) below. |
| 30 | L32 | **REFUSED** | — | See quote (c) below. |

The refusals, verbatim:
- **(a) Step 27, L29:** `collect (112,64) stance (ladder-routed: … bosskey@112,64 …) -> hold: button@112,128 presses group t=0, which NO responder in level 29 answers — the level's responders are [none] …`
- **(b) Step 29, L30:** `reach-exit (224,160)->L32 -> keylock: undefined needs a key this run does not hold. The key is a SUB-ORDER …`
- **(c) Step 30, L32:** `collect-placement (64,128) resolves to NOTHING in level 32 — no chest and no pickup stands there. A goal about an absent thing is a macro-layer error …`

**Against the brief's expectations:**
- **L29 does not refuse at its turrets or on `KILL_ARM_POLICY`.** It refuses earlier, on the fallrock button: the model sees no responder for `button@112,128` (tset 0), even though `fallrock@112,112` carries tag 0. This finding is worth its own line.
- **L32 does not reach `KILL_ARM_POLICY` either.** The encounter is not a placement: the map's L32 entities are `burnabletree, control, fallrocklarge, lightalpha, stairsdown, tree, watcher`, with no boss entity. The solver refuses at the macro layer.
- **L30's refusal is the staged-boot bound, not a room wall.** Staged rows inherit `r8-solve-11`'s latch, which holds no Green Key.

## What the brief got wrong (measured)

1. **"Installing it makes all 216 swim crossings pipeline doors, host-enforced."** False: the content source carries 0 swim rules (D2, D3).
2. **"Expect exactly the 3 R5 tapes ⇒ L47/L48 witnessed."** The derived witness set is 9 tapes over 5 levels: L0, L37, L47, L87, L115. L48 is uncertified at the boot-level bound.
3. **"L32 … reachable from the start ONLY with the Green Key."** It needs the Sword too: `level_0__r8c0 → level_0__r11c19` is `Or(Has(Progressive Sword), Has(Ghost Spear))`. With the Green Key alone the BFS finds no path; with Sword + Green Key it does. The Green Key gates `level_12__r0c19 → r40c4` and `level_30__r0c4 → r2c10 → r8c13`. `level_30__r8c13 → level_32` is confirmed as the sole entrance. The shortest start route runs L0 → L12 → L24 → L23 → L21 → L22 → L30 → L32; the brief's list omits L24 and L23.
4. **The survey's flags.** It had no `--out=`, and its legs were hard-wired (see D5).
5. **"The 21 shipped preset md5s."** `md5sum frontend/presets/seedling*/*/*_rules.json` lists 13 files.
6. **"L32's encounter refuses by name (`KILL_ARM_POLICY`)" and "L29's turrets refuse."** Neither holds (see D5).
7. **The conch room L49 is unreachable without Fire.** This one is confirmed: `level_48__r18c7 → level_48__r2c10` is `Has(Fire)`. L49 is unreachable with every other item held, and reachable with Fire.

## D6: records — PASS

- **`flash.md`:** a new section, § *The atlas knob and the swim census*, under `flash_seedling`.
- **`substrate-registry.md`:** a `pipelineConfigFromParams` row in the entry contract.
- **The build record is in `seedling-bot-log.md` § *Seedling substrate S2-swim — the playthrough atlas as a supply*, not in `seedling-bot.md`.** This deviates from the brief. `seedling-bot.md` is the present-state page and sends build history to the log, and S1's record sits in the log too. Mine is placed directly after S1's.
- **`generate-procgen-reference.mjs`:** run after every docs edit and committed. `check-procgen-docs.mjs` prints `ALL CHECKS PASSED`.
- **Bounded vitest after:**
  ```
  npx vitest run frontend/modules/flashPanel frontend/modules/procgenPipeline/presetDefs \
    frontend/modules/procgenPipeline/presetRun.test.js frontend/modules/procgenPipeline/procgenPipelineUI.test.js \
    frontend/modules/apworldEditor/regionGenerationFlow.test.js frontend/modules/apworldEditor/slotInitialise \
    frontend/modules/apworldEditor/regionContent.test.js frontend/modules/procgenCore/substrateConfigRecord.test.js \
    frontend/modules/procgenCore/regionGenerationForm.test.js frontend/modules/procgenDocs \
    scripts/procgen/seedlingAtlasDoorCensus.test.js scripts/procgen/checkProcgenHelp.test.js
  ```
  Result: **53 files, 1427 tests passed.** The unfiltered suite was not run (ruling 52); CI quotes it at the pushed SHA.

## Residue

- **The swim crossings stay out of the pipeline.** They become pipeline doors only if a placed room can span sub-regions, or if the content source emits internal exits as gated sides. That is a substrate design question for the coordinator, not a fix this slice could make.
- **The L29 button refusal.** It looks like a model gap: a fallrock is not registered as a button responder. It lives in S1's territory (`levelRun`/`solverBot`) and was not investigated.
- **The survey's pit hop.** Its edge vocabulary (`to` entities only) cannot express the L12 → L21 pit, so steps 24 and 25 are unsurveyable until it can.
- **The panel picker was not driven in a browser.** It was tested through a DOM stub in vitest. It shares the panel's generic `renderRegionGenerationForm` path.
- **A timing row outside this slice's files.** `scripts/test/testRunBox.test.js`'s "a gate that sleeps past the deadline is KILLED" failed once under parallel load and passed solo (13/13). It is not a touched file.
- **Side effects of D1.** `prepareSphereGrowth` now re-installs the bag's atlas every generation. Before, sphere growth used whatever the module had last installed; that was a latent leak from an earlier spiral or hub install into a later sphere run. Byte-inert for every committed preset (all use the starter).

## Byte inertia

`md5sum frontend/presets/seedling*/*/*_rules.json` at W0 and at the end: **all 13 identical** (`diff` is empty). No new world was committed, because D3 was STOPPED.

```
f8ae9918dc043e329e1e5f5a737ec596  seedling/AP_14089154938208861744
2e3f74e1d0f4a58bb91ba276586a7195  seedling_atlas/AP_1
431fa72dae53241a7c291c59ac15d550  seedling_atlas_host/AP_1
279c9bb643d55eb74f9581ea932071b8  seedling_atlas_location/AP_1
5a2083326d24ffd1534b1197c93ee1a5  seedling_atlas_maze/AP_1
8999436d37b941ec85686b9646d494bc  seedling_atlas_sphere/AP_1
edebfa1f00215b7846022c5b538820a5  seedling_generated_host/AP_1
f7db7bed32a5fb33129c0d55938704bc  seedling_generated_leaf/AP_1
28efab1877d266057bb3da0d8911207d  seedling_generated_room/AP_1
dbf79293e7e8d4406634549de8daee36  seedling_playthrough/AP_1
59959e712cc11db546e5495245f1277d  seedling_playthrough/AP_14089154938208861744
443e3ca23f86a872811bff5f7ef3ca15  seedling_sphere_room/AP_1
cb8e53849d9e9a3c1025851cedf79e61  seedling_spiral_room/AP_1
```

The seven `--check` states were re-run at the end: all `OK`. `check-sidecar-fields` at the end: `ALL PASS — 1417 entries`.

**Enrolment re-pins:** none (no new preset). The only re-pins are the doc-link census (301 → 302), named in the D1 commit.
