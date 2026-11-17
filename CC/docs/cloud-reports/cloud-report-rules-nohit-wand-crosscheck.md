# Cloud report: `rules-nohit-wand-crosscheck`

Branch `claude/rules-nohit-wand-crosscheck-2tul2m`.

Base:
- `git rev-parse origin/main` = `75e45c964d9ce37b3eb6db3c1e887b9b873b484c`.
- `git merge-base --is-ancestor 978205e557 origin/main && echo ok` = `ok` (Fire breaks rocks is in).
- The derivation was read from `origin/claude/wallflyer-no-hit-derivation-2y9dio` @ `43aa6dcd67`.

Commits: `205f6a50` (A: the Wand row and its witness), `ba6a270b` (B: the cross-check tool and its test), `fecc86ec` (C: the
producer re-records), `dcd2a9ff` (C: the derived-rule table), then this report.

## Answer table

| question | answer |
|---|---|
| Wand on L22 S→N | **added.** The L22 N gate's arms are now `hasSword, hasSpear, hasShield, hasWand`, witnessed by `l22-25-21-wand` (a hand plan, with its control in `controls`) |
| Wand on L25 W→E | **not added.** It is recorded in the table's new `unwitnessed` list with why and the follow-up. The reader refuses an entry that is inconsistent with its gate |
| Game witness (probe) | `l22-25-21-wand`: **0 hits, levels [22, 21], ended in L21** (t340). Its control `l22-25-21-none`: **2 hits, 2 respawns, stayed in L22**. `ALL CHECKS PASSED` |
| AP_1 rows that change | **exactly 1**: `level_22__r8c0 -> level_22__r0c6` gains `Wand` in its `Or`. `seedling_er` has the same single row |
| Seed-1 sphere log | **unchanged.** `_sphere_log.jsonl` and `_Spoiler.txt` are byte-identical to `origin/main` |
| Cross-check `--check --quick` | **PASS**: 4 crossings agree (directions and every table arm), 3 INFO lines. **Wall 159.4 s** (real 2m39.5s), idle box |
| Cross-check disagreement at base | **none** (no STOP) |
| Vanilla certifier `--arms=new` | **1 / 16 / 0** |
| ER arm | **1 / 16 / 0, matches** `seedling-er-whole-game-certify-expected.json` |
| Derived-rule table | **inputs only**: `payloadMd5` 2c844d31 → d3cd50fc, and `measuredAt`. 108 rows, 6 exclusions and the counts are unchanged. Measured LOCALLY (see §5) |
| Bounded sweep | **113 files, 1935 tests, all passed** (5m10s) |
| Step 35 (L22→L29) | **No change to what it REQUIRES.** The leg enters holding Progressive Sword and Progressive Shield, and no Wand (the Wand is leg 10.1). **I do not expect step 35 to move** |

No STOP fired. One row, sphere log fixed, no direction disagreement, the certifier triple held, no level literal.

## 1. A — the Wand on L22

- **`seedlingNoHitDirectionalGates.json`:**
  - L22 N: `arms` gains `hasWand`, and `witness.arms.hasWand = "l22-25-21-wand"`.
  - L25 E: unchanged.
  - New top-level `unwitnessed`: `[{level: 25, blocked: "E", arm: "hasWand", says, followUp}]`. It says the derivation's YES, the three
    failed hand tapes (the room's two Bobs and its pushable block), and the follow-up "a game witness of l25-26-22-wand".
  - `$comment` and `reexamine` are updated to match (Fire is still not an arm).
- **The reader (`seedlingNoHitDirectionalGates.js`):**
  - `WITNESS_ARM_OF_FLAG` gains `hasWand: 'wand'`.
  - For an `unwitnessed` entry it refuses, by name: an arm with no witness arm; an arm the gate offers; an arm that has a witness; a
    missing why or follow-up; and an entry whose gate does not exist (checked after the gate's own checks).
- **The witnesses live in `scripts/procgen/seedling-wallflyer-nohit-plans.json`**, beside the table's others:
  - `plans["l22-25-21-wand"]`: 340 ticks, the derivation slice's `tapes/l22-25-21-wand.json` inputs, and a `hand` field saying by what
    and the plan. One WandShot at t61 from (55.7,139.2) facing up strikes `wallflyer@48,112` at rest. While its 30-tick `hitsTimer`
    gates `hitPlayer`, the player walks up beside it, then up the west column to the L21 door.
  - New `controls["l22-25-21-wand"]`: `{arm: none, drop: [primary]}` with the inputs of the slice's `tapes/l22-25-21-none-control.json`.
    The probe refuses a control that is not exactly the plan's keys minus `drop`.
- **`probe-seedling-wallflyer-nohit.mjs`:**
  - A plan holding an arm in `MODEL_REFUSES` must be a `hand` plan (`gameOnly`). It is played on the GAME only, and the skipped model
    leg prints an INFO row.
  - Its control is played too, and must NOT cross cleanly, with `maxHits > 0`.
  - `--only=<plan>` also picks the plan's control. `--write` now keeps `controls`.
  - The old "⛔ NO WAND ROW" header is replaced.
- **Tests:**
  - `seedlingNoHitDirectionalGates.test.js`: the Wand rows and the refusals. The old "hasWand has no witness arm" mutant now uses
    `hasFire`. `ITEM_OF_FLAG` gains `hasWand → Wand`.
  - `probeSeedlingWallflyerNohit.test.js`: hand-plan and control rows; the model-replay row skips a hand plan.

### Game witness (`node scripts/procgen/probe-seedling-wallflyer-nohit.mjs --only=l22-25-21-wand --dump`, page `seedling_bot_ap_p4g`)

```
ROW {"case":"l22-25-21-wand","hand":true,"set_id":"seedling-vanilla-record-5aeefc3c",…,"held":["hasWand"],"model":{"skipped":"levelRun refuses a WandShot …"},"levels":[22,21],"maxHits":0,"respawns":0,"final":{"t":340,"x":88,"y":112.7,"level":21}}
PASS: l22-25-21-wand: the GAME lands in L21 from L25's door holding [hasWand], with no hit taken
ROW {"case":"l22-25-21-none","controlOf":"l22-25-21-wand",…,"held":[],"levels":[22],"maxHits":2,"respawns":2,"final":{"t":340,"x":24,"y":130.15,"level":22}}
PASS: l22-25-21-none (control of l22-25-21-wand): the same keys holding [no item] do NOT cross cleanly on the GAME (a hit is taken), so the arm is what clears the line
ALL CHECKS PASSED
```

The planner should dispatch the FULL probe (every plan) on CI. Only `--only=l22-25-21-wand` was run here.

## 2. The AP_1 row diff

`frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json`. Everything else that moves is `atlas_ref` / `atlas_id`
(`seedling-88e3788c` → `seedling-df2a42ee`).

```
regions.1.level_22__r8c0.exits["level_22__r8c0 -> level_22__r0c6"].access_rule
- Or(Has Progressive Sword, Has Ghost Spear, Has Progressive Shield)
+ Or(Has Progressive Sword, Has Ghost Spear, Has Progressive Shield, Has Wand)
```

- **`seedling_er`:** the same single row, plus the atlas ids (`provenance` d98dcb06 → 05627448).
- **Maze:** the same row. `level_22__r0c6`'s `atlas_gate_0` `clear_rule` gains Wand, with the name
  `"(Progressive Sword OR Ghost Spear OR Progressive Shield OR Wand)"`, and `region_atlas` id d6f5bf4b → cf4821c5.
- **`worlds/seedling_playthrough/Rules.py`:** `HasAny('Progressive Sword', 'Ghost Spear', 'Progressive Shield', 'Wand')` on that
  entrance. The three `_worldgen_*.json` files move with it.
- **Seed 1:** `_rules.json` (the row as `item_names` 3 → 4, plus the atlas id) and `.archipelago`. The sphere log and spoiler are
  byte-identical.
- **L25's row `level_25__r3c2 -> level_25__r2c7` does not move.**

## 3. Pins, before → after (each re-pinned with its reason in the file)

| pin | before | after |
|---|---|---|
| `seedlingAtlasDoorCensus.test.js` atlasId | `seedling-88e3788c` | `seedling-df2a42ee` |
| `levelSetExporter.test.js` committed.atlas_id | `seedling-88e3788c` | `seedling-df2a42ee` |
| `vanillaOverlay.test.js` playthrough atlas md5 | `e53ce5173114a245d96c7d6ce80b4af8` | `7443e72866c96c5498fb87291ea9d849` |
| `atlas_files.json` seedling-playthrough atlas_id (index; no writer found) | `seedling-88e3788c` | `seedling-df2a42ee` |
| derived-rule table `inputs.payloadMd5` | `2c844d3195c304d7148dacfcdaf58167` | `d3cd50fc2a1b4b8ec21119ba5fddf4b3` |
| derived-rule table `measuredAt` | `18810a0bd0` | `fecc86ec70` (local, §5) |
| `docs/json/developer/procgen/architecture.md` instruments count (generated) | 549 / 467 with flags / `--help` 546 | 550 / 468 / 547 |
| `seedling-derived-rules-expected.json` (counts) | — | unchanged; every pinned count matches |
| `seedling-er-whole-game-certify-expected.json` | — | unchanged; matches (1 / 16 / 0) |

No count was typed: every number above was read from a producer's or probe's output.

## 4. B — the cross-check

`scripts/procgen/derive-seedling-wallflyer-nohit.mjs`, moved from the evidence `tools/derive-nohit.mjs`:
- It IMPORTS `levelWorld.buildLevelWorld`, `wallFlyer.js`, `playerPhysicsV1.js`, `crusher.js`, `seedlingNoHitDirectionalGates.js` and
  `seedlingWallFlyerBands.js`. No copy.
- It finds the rooms with `wallFlyerLevelsOf(map)`: any level record holding a wallflyer. The old `--levels=` filter is gone.
- `--quick` is kept, now as an option rather than a module constant. `--verify` is kept, with a fixed LCG; it reports 20 of 60,000
  rects disagreeing, all where the bitmap is conservative, as before.
- `--check`:
  - It reads the table through its own reader (`noHitDirectionalGatesFor`). A pair of door sides is GATED by the table when every
    landing of X lies behind a gate's band and every landing of Y lies past it, along `blocked`.
  - It compares that with the derived verdict (NO LINE with no item = gated). For each gated pair, each table arm must derive a LINE.
  - A table gate that no pair matches is a disagreement, and so is a table gate on a level that holds no wallflyer.
  - A derived arm the table lacks is INFO, and names the `unwitnessed` entry where there is one.
  - It exits 1 on any disagreement, naming the room, the direction and both verdicts.
- `--help` derives its flags cleanly. `check-procgen-help.mjs` printed `ALL CHECKS PASSED`, and so did `check-procgen-docs.mjs`.

### `--check --quick` at the tip `dcd2a9ff` (idle box, 4 vCPU)

```
AGREE L22 [21,29] -> [25,30] (S): table free, derived free (LINE with no item) (19515629 lanes, 15 configs, 113005 ms)
AGREE L22 [25,30] -> [21,29] (N): table gated [hasSword, hasSpear, hasShield, hasWand], derived gated (NO LINE with no item) (223520 lanes, 2 configs, 1251 ms)
  AGREE arm hasSword … LINE (139 ms) · hasSpear … LINE (85 ms) · hasShield … LINE (39623 ms) · hasWand (witness l22-25-21-wand) … LINE (76 ms)
  INFO derived arm darkshield gives a LINE; the table does not offer it (no witness arm of the table names it)
L25 [22]/[26] <-> [28]: not joined even with no flyer: no wallflyer question (4 pairs)
AGREE L25 [22] -> [26] (W): table free, derived free (LINE with no item) (144307 lanes, 3 configs, 663 ms)
AGREE L25 [26] -> [22] (E): table gated [hasSword, hasSpear, hasShield], derived gated (NO LINE with no item) (370556 lanes, 2 configs, 1446 ms)
  AGREE arm hasSword (20 ms) · hasSpear (19 ms) · hasShield (2701 ms)
  INFO derived arm darkshield gives a LINE; the table does not offer it
  INFO derived arm wand gives a LINE; the table does not offer it (named unwitnessed: a game witness of l25-26-22-wand …)
L27: sides [[26,28]]; table gates none
PASS: the gate table agrees with the derivation on every wallflyer crossing (4 crossings, 3 info) — wall 159.4 s
real 2m39.505s
```

- **The Dark Shield INFO is expected.** AP's `Progressive Shield ×2` already covers it, and the table has no witness arm for it.
- **The check goes red when it should.** In a mutant, L25's gate was dropped from a copy of the table and the check ran on L25 alone.
  It returned `L25 [26] -> [22] (E): table free, derived gated (NO LINE with no item)`. The unmutated control returned no L25
  disagreement.

### Its unit test (`scripts/procgen/deriveSeedlingWallflyerNohit.test.js`, default tier, 8 rows, ~0.3 s)

- **Waiting spots on a synthetic 8×6-tile room** (no level record): the flyer settles at rest against its wall. With no flyer the floor
  is 1 component; the resting flyer's ray splits it into 2 (north and south). A spot on the ray triggers the flyer and a spot off it
  does not.
- **The lane step `tick` equals the JS model tick for tick** (`tapeRunner`: `wallFlyer.js` + `playerPhysicsV1.js`) for the player and
  every flyer: player x, y, vx, vy and each flyer's x, y, vx, vy. It is checked on the two windows the derivation slice verified,
  `l25-22-26-none` t146-205 and `l22-21-30-none` t166-190.
  - Over a whole plan they part at the first Bob, which the lane world omits by design. I measured this: `l22-21-30-none` parts at
    t92. So the window is pinned, not the whole plan.
- **The table side:** `tableGateBetween` (gated only along `blocked`) and `compassOf`. The rooms come from the records.
- **The full derivation is not a vitest row.**

### CI (⛔ `.github/` not edited): a ready-to-paste workflow, `.github/workflows/seedling-nohit-crosscheck.yml`

The tool's static import closure is 35 in-repo files. It touches no submodule and no npm package, so the job needs no
`submodules:` and no `npm ci`. The path list holds the files the brief names plus the derivation's own direct inputs. To list the full
closure, run `node -e "import('./scripts/procgen/seedlingDerivedRuleTable.js').then(m=>console.log(m.importClosure(require('path').resolve('scripts/procgen/derive-seedling-wallflyer-nohit.mjs')).join('\n')))"`.

```yaml
name: Seedling no-hit cross-check

# The wallflyer no-hit derivation (scripts/procgen/derive-seedling-wallflyer-nohit.mjs) against the per-room gate table
# (frontend/modules/flashPanel/seedlingNoHitDirectionalGates.json). A CROSS-CHECK, not a rule source: it sees flyers only
# and is knife-edge, so a red here is a question for the rules owner, never a reason to edit the table to match.
# ~2.7 min on 4 vCPU with --quick (measured 159.4 s at dcd2a9ff); no browser, no wasm, no submodule, no npm package.

on:
  workflow_dispatch:
    inputs:
      full:
        description: Full-resolution lanes instead of --quick (several times longer).
        type: boolean
        default: false
  push:
    paths:
      - frontend/modules/flashPanel/seedlingNoHitDirectionalGates.json
      - frontend/modules/flashPanel/seedlingNoHitDirectionalGates.js
      - frontend/modules/flashPanel/seedlingWallFlyerBands.js
      - frontend/modules/flashPanel/atlases/seedling-map.json
      - frontend/modules/seedlingDemo/wallFlyer.js
      - frontend/modules/seedlingDemo/playerPhysicsV1.js
      - frontend/modules/seedlingDemo/levelWorld.js
      - frontend/modules/seedlingDemo/crusher.js
      - scripts/procgen/derive-seedling-wallflyer-nohit.mjs
      - scripts/procgen/seedling-wallflyer-nohit-plans.json

jobs:
  crosscheck:
    name: Seedling no-hit cross-check (derivation vs gate table)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6.0.2

      - name: Set up Node
        uses: actions/setup-node@v6.4.0
        with:
          node-version: '22'

      - name: derive-seedling-wallflyer-nohit --check
        env:
          FULL: ${{ inputs.full }}
        run: |
          set -o pipefail
          MODE=--quick
          if [ "${FULL:-false}" = "true" ]; then MODE=; fi
          node scripts/procgen/derive-seedling-wallflyer-nohit.mjs --check $MODE | tee crosscheck.log

      - name: Summary
        if: always()
        run: |
          [ -f crosscheck.log ] || exit 0
          { echo '```'; grep -E '^(PASS|FAIL)|DISAGREE|DISAGREEMENT|INFO' crosscheck.log; echo '```'; } >> "$GITHUB_STEP_SUMMARY"
```

## 5. C — re-records

Producers, in recipe order, and their `--check` at the tip `dcd2a9ff`:

| producer | output moved? | `--check` |
|---|---|---|
| `make-seedling-playthrough-rules.mjs` | atlas (one row) and AP_1 (one row) | OK (both "matches a fresh build", rc 0) |
| `make-seedling-subregion-partition.mjs` | the atlas-id key only | OK |
| `make-seedling-playthrough-maze.mjs` | L22's gate payload and the one row | OK, byte-identical |
| `make-seedling-er-preset.mjs` | the one row and the ids | OK |
| `make-seedling-sphere-order.mjs` | **unchanged** (as expected) | OK |
| world_generator recipe (`worlds/seedling_playthrough`) | Rules.py and 3 sidecars | `check-worldgen-package-freshness.py seedling_playthrough`: ALL CHECKS PASSED |
| `Generate.py` seed 1 (`Templates/Seedling Playthrough.yaml`) | `_rules.json`, `.archipelago` | sphere log and spoiler byte-identical. `preset_files.json` was reverted: only its trailing newline had moved |
| `generate-procgen-reference.mjs` | instruments.js and architecture.md (+1 instrument) | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE |

**The derived-rule table.**
- ⚠ It was **measured locally, not by CI**: `GITHUB_SHA=fecc86ec70 node scripts/procgen/probe-seedling-derived-rules.mjs --shards=2`
  on this box, at commit `fecc86ec`, the one that staled it. Wall time 1m14s.
- The probe's summary: certifier 1 / 16 / 0, `PASS: every pinned count matches scripts/procgen/seedling-derived-rules-expected.json`,
  `TABLE: 108 rows in 51 regions; 6 exact elements excluded`.
- Against the committed table: `$comment`, `rows`, `excluded` and `counts` are deep-equal. Only `measuredAt` and `inputs.payloadMd5`
  differ.
- `engineMd5` (bec36987…) and `witnessMd5` are unchanged.
- **The expected counts for the planner's REGEN_RECIPE run:** 108 rows / 6 excluded, certifier 1 / 16 / 0, `payloadMd5`
  `d3cd50fc2a1b4b8ec21119ba5fddf4b3`. A CI copy should differ from the committed file in `measuredAt` only.

**Python walk** (what I used to diff a rules document key by key; nothing reads it): it loads `git show <base>:<path>` and the working
file, recurses over both, matches list items by `name`, and prints `ADD`, `DEL`, `CHG` and `LEN` per path. Its output for AP_1, with
the `atlas_ref` lines filtered out, is the §2 diff:

```python
import json, subprocess, sys
path, base = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'HEAD')
old = json.loads(subprocess.check_output(['git', 'show', f'{base}:{path}'])); new = json.load(open(path))
def walk(a, b, p=''):
    if type(a) != type(b): print('TYPE', p); return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a: print('ADD', p + '/' + k)
            elif k not in b: print('DEL', p + '/' + k)
            else: walk(a[k], b[k], p + '/' + k)
    elif isinstance(a, list):
        if len(a) != len(b):
            print('LEN', p, len(a), len(b))
            if all(isinstance(x, dict) and 'name' in x for x in a + b): walk({x['name']: x for x in a}, {x['name']: x for x in b}, p + '[name]')
            return
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y: walk(x, y, p + (f'[{x["name"]}]' if isinstance(x, dict) and 'name' in x else f'[{i}]'))
    elif a != b: print('CHG', p, json.dumps(a)[:200], '->', json.dumps(b)[:200])
walk(old, new)
```

### Certifier (`probe-seedling-whole-game-certify.mjs --shards=2 --arms=new`, local)

- **Vanilla:** `ARM new: 1 problems (derived-true/atlas-false 1, …) / 16 accepted / 0 threw; clean 114/115 levels` →
  `ALL CHECKS PASSED` (66 s).
- **ER (`--source=er`):** `1 / 16 / 0` and `PASS: the ER arm matches scripts/procgen/seedling-er-whole-game-certify-expected.json
  (1 / 16 / 0)` (85 s).

### Bounded sweep

- **The list:** `rg -a -l` over `frontend/` and `scripts/`, default-tier `*.test.js` only (slow, train and calib excluded). The patterns
  were the gate table, the wallflyer probe, plans and derivation, `seedling_playthrough/AP_1`, `seedling_er/AP_1`,
  `seedling_playthrough_maze`, the derived-rule table and its module, and `seedling-playthrough.json`. It found **113 files**, guarded
  with `[ -n "$LIST" ]` and a count check.
- **The run:** `npx vitest run $LIST` → **Test Files 113 passed (113), Tests 1935 passed (1935)**, 5m10s.
- **Not run here** (heavier tiers that read the same inputs): `frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.slow.test.js`
  and `deriveLevelWorldLogic.train.test.js`.
- The 113 files:

```
frontend/modules/apworldEditor/sidecarIssues.test.js frontend/modules/flashPanel/{flashSeedlingAtlasRoom,mapDocumentPath,seedlingArrivalEscape,
seedlingCheckBinding,seedlingEncounterBinding,seedlingEventCollector,seedlingGeneratedArm,seedlingKillLocks,seedlingLevelSetDelivery,
seedlingLogicalLinks,seedlingLoopRestart,seedlingNoHitDirectionalGates,seedlingPlaythroughOverlay,seedlingRandomizerEligibility,
seedlingRandomizerWiring,seedlingReturnToMenu}.test.js frontend/modules/mazeRoom/{mazeBlockSinks,mazeContent,mazeConvertedLink,mazeConvertedLoad,
mazeLatchArt,mazeLevelWorld,mazeLinks,mazeLiveMarkers,mazeMetaArt,mazeSeedlingArtEdit,mazeSeedlingLink,mazeSeedlingSkin,mazeSeedlingSprites,
mazeSidedOpeners,mazeThings,mazeTileArt}.test.js frontend/modules/mazeRoom/tileSpike/{certifyEventLocations,certifyInternalOnly,
certifyLandingArrivals,certifyLandingCells,certifyLandingGates,certifyLavaPulls,certifyPocketTalk,countedRules,deriveLevelWorldLogic,
encounterKillArms,latchSandwich,puzzleLocks,sphereOrderLevels,waterExits}.test.js frontend/modules/presets/rulesJsonWriters.test.js
frontend/modules/procgenCore/{atlasOps,contentIdentity,eventRoute,jsonSchemaCheck,regionLayoutResolve}.test.js
frontend/modules/procgenPipeline/{regionAtlasCompiler,regionAtlasLevelWorld,regionAtlasMazeRopeRun}.test.js
frontend/modules/seedlingDemo/{apPlacementRewriter,entranceRetarget,fidelityBindings,fidelityLightPole,jsRuntimeEncounterLegWalk,
jsRuntimeEventGoalWalk,jsRuntimeGameSpeed,jsRuntimeLongPlanWalk,jsRuntimeSave,jsRuntimeSolveProgress,jsRuntimeSolveService,jsRuntimeSolver,
jsRuntimeSolverEventGoal,jsRuntimeSolverRockLockMapper,jsRuntimeSolverTalkClearGoal,jsRuntimeVanillaDelivery,jsRuntimeVerbs,levelSetExporter,
r5SwimCloseout,seedlingArrivalSpawn,seedlingAtlasDerivation,seedlingLevelBake,solverEnvChannel,solverPrefix,vanillaOverlay}.test.js
frontend/modules/stateManager/core/{entranceRandomization.load,eventKinds}.test.js scripts/procgen/{boxLock,check-worldgen-package-sidecars,
deriveSeedlingWallflyerNohit,derivedRuleOverride,derivedRuleTableFresh,derivedRulesProbe,mazeInputOutputSplit,probeSeedlingWallflyerNohit,
seedlingAtlasDoorCensus,seedlingBossLockCensus,seedlingDivergenceLegs,seedlingDivergenceRouteCarry,seedlingDivergenceSweep,seedlingErMode,
seedlingErReachBinding,seedlingErSource,seedlingFootprints,seedlingInRoomPressGate,seedlingLethalLandings,seedlingLocationRebind,
seedlingPatchedSet,seedlingPlaythroughEntryGateFloor,seedlingPlaythroughLogicalLinks,seedlingPlaythroughNecessaryDoors,
seedlingPlaythroughObstacleEvents,seedlingPlaythroughOffGridLock,seedlingPlaythroughWaterfallDoor,seedlingPresetHasNames,
seedlingRockFireNarrowing,seedlingSphereOrderEvents}.test.js
```

## 6. Survey step 35

- **The leg.** `survey-seedling-route.mjs --derive-only --through=end --route=full` (no solve) prints the route leg that crosses
  L22→L29 as `LEG 3.3 Level 029 - Boss Key 1 (+Green Key)`, with levels `L25 → L22 → L29` and regions
  `level_25__r2c7 > level_22__r8c0 > level_22__r0c6 > level_29__r2c2`. Both L22 rooms are FORCED. Survey row 35 is
  `L22 visit 2 … reach-exit(teleporter@192,64 → L29)`.
- **What it holds entering:** `{Progressive Sword, Seal, …flags…, Red Key, …, Progressive Shield}`. **No Wand**: the Wand is earned at
  leg 10.1 (`Level 043 - Wand`).
- **Against the new `Or(Sword, Ghost Spear, Shield, Wand)`:** the leg already satisfied the old `Or` through Progressive Sword (and
  Shield). Adding an arm the route does not hold changes neither what the leg REQUIRES nor which leg crosses there.
- **I expect step 35 NOT to move.** The solver's line is not touched either: no solverBot, levelRun or `CONTACT_FIDELITY` change.
  `WALLFLYER_KILL_ARM` and the hammer flags are untouched.

## 7. For the planner

- **Dispatch:**
  - `probe-seedling-wallflyer-nohit.mjs`, all plans (it now carries the Wand row and its control).
  - `probe-seedling-derived-rules.mjs` (REGEN_RECIPE). Expect it to differ from the committed table in `measuredAt` only.
  - `probe-seedling-whole-game-certify.mjs`, with `--arms=new` and with `-f args='--source=er --arms=new'`.
  - The train tier (`train_only`), which holds `deriveLevelWorldLogic.train.test.js`, a reader of the maze payload.
- **Route** the §4 YAML to whoever owns CI policy.
- **The AP_1 re-record OK** is asked separately at landing (one row, §2).
- **Follow-up:** a game witness of `l25-26-22-wand` (named in the table's `unwitnessed`).
- **Housekeeping:** I started a dev server on port 8000 (`scripts/serve-nocache.py`; no other server was on 8000). `git config
  core.hooksPath scripts/git-hooks` was set in this clone. No submodule pointer moved. `worlds/seedling/`, `vendor/seedling` and
  `.github/` were not touched.
