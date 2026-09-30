# Behaviour parameters — P1: the entity records under contract (cloud report)

**Slice:** `behaviour-parameters-p1` (plan `behaviour-parameters-plan.md` §3 P1, §6.4, §7), an Opus build session in the cloud.
**Started from:** `origin/main` at `a8225ce975` (the expected SHA). **Branch:** the harness's `claude/entity-records-contract-lhe5st`. The brief's `behaviour-parameters-p1` name was not used, because the harness pushes only to its own branch. **Head:** see the last commit on that branch. This report is the last commit. Nothing was pushed to `main`.

**Verdict:** D1 PASS · D2 PASS · D3 PASS (1 disagreement, pinned) · D4 PASS (the witness ran every leaf) · D5 PASS · D6 PASS. **Every step was byte-neutral.**

**Commits:** `e853ecd` D1 · `5ad279c` D2 · `1393cb9` D3 · `163a45e` D4 code · `d3a396a` D4 witness data · `8feefb0` D5 · `52100fc` D6 (docs and generated regions) · this report.

## W0 — the identities, banked before any edit

| row | command | result |
|---|---|---|
| (a) fixture identity | scratch `identity.mjs` (A2's recipe, not committed): per tape `name, md5(file), md5(JSON(parseTape)), md5(serializeTape(parseTape)), md5(JSON(gameVisibleTape(parseTape)))`; per expectation `name, md5(file), md5(JSON(parseObservationStream))` | **308 lines**, md5 **`d06184e56c98b549042a9a760b78ef18`** |
| (a′) run identity (added) | the same script, per tape `md5(JSON {ticks, transitions})` and `md5(JSON runTape result minus profile/entities)`, with `atlasLevelSource()` | **154 lines**, 0 ERR, md5 **`1f251296581f73f3c94d2eabc335fc5e`** |
| (b) vitest | `npx vitest run …/tapeRunner.test.js …/botDriverV2.test.js …/solverBot.test.js scripts/procgen/seedlingSolverSurface.test.js` | **4 files, 635 passed** (tapeRunner 365, botDriverV2 133, solverBot 101, solver surface 36), 62 s |
| (c) solves | the seven `--check`s | **7/7 rc=0**: r8-battery `PASS: r8-solve-6: ZERO hits and ZERO deaths`; r8-d2 `PASS: r8-solve-20 trace is byte-identical … 8173 bytes`; r8-d2-chain `PASS: … 485 + 746 + 560 = 1791 against 1791`; r8-l18 `PASS: r8-solve-18 trace is byte-identical … 3040 bytes`; r8-tail `PASS: r8-solve-5: the prefix agreement ran for every declaration`; r9-l3 `## r9-solve-3: SOLVED (152 ticks) and NOT EMITTED`; r9-campaign `## goal ledger rows this chain CREDITS: sword@L10, chest@L11` |
| (d) census | `node scripts/procgen/census-seedling-constants.mjs` | 51 files, **4368 literals**; physics **1497**, rule **1183**; `--check` PASS |
| (e) smoke | `SEEDLING_PORT=8640 node scripts/procgen/check-seedling-bot-differential.mjs --tier=fast --only=friction-stop` | `CHANNEL: headless logic-only` … **ALL CHECKS PASSED** |
| (f) leaf census | a `node` walk of every D2 table | the registry table below; found that 146 nodes of `ENEMY_CLASSES`, 18 of `PUZZLEMENT_HAZARDS` and `ARROW_TRAP.ctor` were **not frozen** |

⚠ The identity md5 differs from the brief's `b60078ac…`, which was measured at `4203177b2c`. The line FORMAT is my scratch script's and the head is different, so the two numbers are not comparable. The comparison that counts is BEFORE against AFTER within this session, and that is byte-identical.

## Per D

### D1 — the record contract (`e853ecd`)

`frontend/modules/seedlingDemo/entityRecords.js` and `entityRecords.test.js`.

- `defineRecord(name, record, {doc, src})` returns THE SAME object, deep-frozen, after `assertEntityRecord` has checked it.
- Allowed leaves: finite numbers, booleans, strings, `null`, and plain arrays/objects of those.
- Refused, by record name and dotted path:
  - a function, `undefined`, `NaN`, `±Infinity`, a `Map` or other object;
  - a cycle;
  - a key holding `.`, `[` or `]`;
  - a stale `doc` name;
  - a doc key holding a non-string;
  - a record name registered twice.
- `entitiesDump()` has one line per non-doc leaf. Records print in NAME order. An empty container counts as one leaf.
- Also exported: `entitiesMd5()`, `entitiesStamp()`, `entitiesAnnouncements()`, `entityLeaves()`, `entityRecord()`, `entityRecordNames()`, `entitiesOverrides()`, `entitiesUnused()`, `ENTITY_RECORD_MODULES`, `EntityRecordError`.

Tests: 20 rows at D1, 21 after D4. They cover `Object.is` identity, the refusals, JSON round-trip, name order against registration order, doc-vs-content md5 behaviour, the pinned md5, `ENTITY_RECORD_MODULES` equal to the files that call `defineRecord(`, and overrides.

### D2 — the 23 tables under contract (`5ad279c`)

An AST-guided rewrite (`@babel/parser`) replaced each `Object.freeze(<literal>)` with `defineRecord('<name>', <literal>, { doc, src })`. It is the same literal and the same export, and one import was added per module.

**Writers.** I grepped every reader alias for a write to the 165 previously unfrozen nodes and found none. The whole `seedlingDemo/` vitest (**179 files, 219 s**) then ran with the tables frozen: **all passed**.

**Gate:**

- the identity file is byte-identical: `d06184e5…` before and after, and the run identity is `1f251296…` before and after;
- vitest 635/635;
- 7/7 `--check` PASS;
- smoke PASS;
- census `--check` PASS after `--write`. The only red was the doc region's file count (51 → 52 files, because `entityRecords.js` joined the closure). **0 rows re-keyed**; the only column that moved was `line`, on 932 rows, shifted by the import line. Physics 1497 and rule 1183 were conserved;
- the AST face is SAME for all 10 modules.

I removed one numeric literal from `entityRecords.js` (`m[1]` → destructuring), so the module adds no census rows.

### D3 — the two spellings, measured (`1393cb9`)

`entityRecords.agreement.test.js` has **44 rows**:

- 7 existence rows;
- 34 explicit `[stepping path, census path]` agreement rows (CHASERS 2, SPINNER 12, CRUSHER 3, PULSER 3, ARROW_TRAP 3, and ICE_TURRET 11, which goes beyond the brief's list);
- the `ARROW_TRAP.tag` row;
- 2 rows for the one disagreement.

**Disagreements (1):**

| pair | values | `src` anchors | reading |
|---|---|---|---|
| `ICE_TURRET.moveSpeed` / `ENEMY_CLASSES.iceturret.speed` | 0.5 / 0 | `Enemies/IceTurret.as:30-51 (ctor), :53-95 (update), …` / `Enemies/IceTurret.as:19,44,51,56,135-151` | the census `speed` is the LIVE turret's envelope bound (static, 0). The stepping `moveSpeed` is the CORPSE glide (0.5), which agrees with `ENEMY_CLASSES.iceturret.corpse.glideSpeed`. It is pinned by an `it.fails` row plus a values row. No value moved. |

Measured fact: `ARROW_TRAP.ctor` **is** `PUZZLEMENT_HAZARDS.arrowtrap.ctor` (the same object).

### D4 — overrides, the stamp, the witness (`163a45e`, `d3a396a`)

- **(i) Overrides.** `__SEEDLING_ENTITY_RECORDS__` is read once. Load-time refusals: a duplicate key in the text, a nested value, a non-finite number, another type, a non-path key. Registration-time refusals: an unknown path, a doc key, a type change. A path is applied before the freeze, with copy-on-write through any node that is already frozen. A path whose record never registers is reported `unused`, not refused (the docblock gives the reason).
  - `seedlingProfileLoader.mjs` learns `--entities=` / `SEEDLING_ENTITY_RECORDS`. `installEntityRecordsFromEnv()` imports every `ENTITY_RECORD_MODULES` module, names the FILE on a refusal, and refuses an unused path.
- **(ii) The stamp.** `runTape`'s result gains `entities: entitiesStamp()` beside `profile`. The stepper's done value carries it, and `JSON(stepped) === JSON(runTape)` is a test row. The stream is still `['ticks','transitions']`. No tape or envelope change.
- **(iii) The witness.** `witness-seedling-profile.mjs` now exports `runChild` (with a new `flag` parameter), `pool`, `tierTapes`, `declaredDivergers` and `checkWitness` (with an options argument). The defaults are unchanged, and `seedlingProfileWitness.test.js` passes as before. Its child also installs an entity override. The sibling is `witness-seedling-entities.mjs`, and `seedlingEntityWitness.test.js` guards its output.

The witness numbers are below.

### D5 — names for the int codes (`8feefb0`)

- **(i)** `TILE_TYPE_IDS` in `flashPanel/seedlingSemantics.js` covers 38 names, `ground: 0` … `rockWallFloor: 37`. Each name is `TILE_TYPE_NAMES` in camelCase, from `vendor/seedling/src/Scenery/Tile.as:32-69`. `TILE_COLUMN_TO_TYPE` is the switch at `Game.as:2097` in `vendor/seedling`.
  - There is no cycle: `seedlingSemantics.js` imports only `seedlingProfile.js`, and each touched module was imported in isolation.
  - The assertions live in `seedlingSemantics.test.js`: the table against `TILE_TYPE_NAMES`, every id in `TILE_COLUMN_TO_TYPE` and `MODELLED_TILE_TYPES`, the profile's `lavaState` `waterState` `bridgeState` `waterfallState` `iceState` `pitState` `enemyPitTile` `initialTerrainState` `coercedTerrainState` `noBounceStates0..2`, and every tile-keyed table the brief lists.
- **(ii)** These records now read the name: `ENEMY_TERRAIN_DESTROYS`, `ICE_TURRET.fatalTiles`, `SPINNER.terrain` (computed keys; integer-key order is unchanged) and `ENEMY_CLASSES.bulb.navMeshEdit.becomes`.
- **(iii)** `NO_FORCE_CAP = -1` in `enemyDamage.js`, and `ENEMY_DAMAGE_DEFAULTS.maxForce` reads it. **No D2 record holds a tag or tSet `-1`** (measured over every leaf), so `NO_TAG` was not declared (it would have been dead), and `killLockTset` stays the profile's.
- **Census.** 10 rows RETIRED: 9 rule/sentinel tile ids and 1 physics/sentinel `-1`. 39 NEW: `TILE_TYPE_IDS` 38 as rule/sentinel and `NO_FORCE_CAP` as physics/sentinel. **Physics 1497 conserved; rule 1183 → 1212 (+38 −9).** 9 fields targets that reached no row were deleted, 2 selector rows were added, and 0 rows were reclassed. `--check` PASS.
  - ⚠ The brief expected "conservation". That holds for physics. The rule class grows by 29 because the table names every tile type, not only the 3 the records held.
- **(iv)** The inline-sentinel table is below. It is measured only; nothing there was edited.

### D6 — records (`52100fc` and this report)

- `seedling-constants.md` gains § *The entity records*, and its census region is re-rendered by `--write`.
- `generate-procgen-reference.mjs` was re-run. The instruments count is 293 → 294 (`witness-seedling-entities.mjs`) and the docs index word count moved. Its `--check` says **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH**.
- `generate-docs-index.mjs --check` OK (154 docs).
- `check-procgen-docs.mjs` ALL CHECKS PASSED.
- Bounded vitest: `npx vitest run frontend/modules/seedlingDemo frontend/modules/flashPanel/seedlingSemantics frontend/modules/procgenDocs scripts/procgen/seedlingConstantsCensus.test.js scripts/procgen/seedlingSolverSurface.test.js scripts/procgen/seedlingEntityWitness.test.js scripts/procgen/seedlingProfileWitness.test.js` gave **192 files, 6554 tests, all passed, 202 s wall**. No environmental red: the path pattern selects no wasm-dependent `flashPanel` suite.

## The byte-inertia block

| face | BEFORE (W0, `a8225ce`) | AFTER D2 | AFTER D5 (final model) |
|---|---|---|---|
| fixture identity (308 lines) | `d06184e56c98b549042a9a760b78ef18` | `d06184e5…` **identical** (`cmp`) | `d06184e5…` **identical** (`cmp`) |
| run identity (154 tapes, stream + result minus stamps) | `1f251296581f73f3c94d2eabc335fc5e` | `1f251296…` | `1f251296…` |
| vitest (4 gate files) | 635 passed | 635 passed | 635 passed |
| seven solve `--check`s | 7/7 PASS | 7/7 PASS | 7/7 PASS |
| census `--check` | PASS | PASS (0 re-keyed) | PASS (10 retired / 39 new, above) |
| wasm smoke | PASS | PASS | PASS |
| AST face (`@babel/parser`, each touched model module vs `origin/main`) | — | 10/10 SAME modulo 23 wrappers | 10/10 SAME modulo 23 wrappers + 10 names (`TILE_TYPE_IDS.x` → its int, `NO_FORCE_CAP` → -1, computed numeric keys → plain) |

Two non-vacuity checks back the AST face:

- A 1-ULP edit to `SPINNER.moveSpeed`, made in memory, makes the comparator report DIFF.
- `tapeRunner.js` DIFFs, and its diff is exactly the import plus the `entities: entitiesStamp()` key. That is D4's intended change, not a wrapper.

The runTape result stamp is `{"md5":"b378bf423846d0232a518bfd94e1d0f9","records":23}` on all 154 tapes.

## The record registry

`entitiesMd5()` = **`b378bf423846d0232a518bfd94e1d0f9`** (pinned in `entityRecords.test.js`). There are 23 records, 803 non-doc leaves and 452 number leaves. The type counts include shared nodes once per record that holds them.

| record | declared in | number | boolean | string (content) | null | empty container | doc keys |
|---|---|---|---|---|---|---|---|
| `arrow` | `arrowTrap.js` | 8 | 0 | 7 | 0 | 1 | `src` `bound` |
| `arrowEnemyHit` | `arrowTrap.js` | 7 | 0 | 7 | 0 | 0 | `src` `knockbackFrom` |
| `arrowKillPlan` | `arrowTrap.js` | 10 | 0 | 6 | 0 | 0 | `src` `presserSafety` `baitRule` |
| `arrowTrap` | `arrowTrap.js` | 13 | 1 | 3 | 0 | 0 | `src` `ctorSrc` |
| `blastDamage` | `iceTurretBlast.js` | 4 | 1 | 4 | 0 | 0 | `src` `knockbackFrom` `knockbackWhy` `underNoDamage` |
| `blastPlan` | `iceTurretBlast.js` | 4 | 1 | 0 | 0 | 0 | `src` `cover` `pressPolicy` |
| `chasers` | `chasers.js` | 8 | 2 | 4 | 0 | 0 | `src` |
| `crusher` | `crusher.js` | 11 | 0 | 6 | 0 | 0 | — |
| `crusherDirections` | `crusher.js` | 8 | 0 | 4 | 0 | 0 | — |
| `enemyClasses` | `combat.js` | 240 | 43 | 144 | 26 | 0 | `src` `why` `threat` `boss` `where` |
| `enemyDamageDefaults` | `enemyDamage.js` | 7 | 8 | 1 | 0 | 0 | `src` |
| `enemyTerrainDestroys` | `chasers.js` | 2 | 0 | 0 | 0 | 0 | — |
| `fallRock` | `fallRock.js` | 11 | 0 | 2 | 0 | 0 | `src` |
| `hammerBilling` | `spinner.js` | 4 | 1 | 1 | 0 | 0 | `src` `from` `gate` |
| `iceTurret` | `iceTurret.js` | 31 | 7 | 14 | 0 | 0 | `src` `knockback` |
| `iceTurretBlast` | `iceTurretBlast.js` | 9 | 0 | 6 | 0 | 1 | `src` `sound` |
| `playerDamagePaths` | `crusher.js` | 4 | 4 | 2 | 0 | 0 | `src` `why` `gate` |
| `playerSnap` | `fallRock.js` | 2 | 0 | 0 | 0 | 0 | — |
| `pulser` | `pulser.js` | 19 | 1 | 5 | 0 | 0 | `src` |
| `puzzlementHazards` | `combat.js` | 27 | 3 | 18 | 0 | 0 | `src` `why` |
| `spinner` | `spinner.js` | 21 | 1 | 9 | 0 | 0 | `src` |
| `spinnerCtorRng` | `spinner.js` | 2 | 1 | 0 | 0 | 0 | `src` `why` |
| `spinnerTerrainWrite` | `spinner.js` | 0 | 0 | 6 | 0 | 0 | `src` `why` `gate` |

## The witness

`node scripts/procgen/witness-seedling-entities.mjs --write --jobs=4` ran at `163a45e` on a clean tree, over the fast tier (102 tapes).

- **Predicted:** 452 × 2 = 904 runs at about 5.5 s CPU each over 4 jobs, so about 21 min; every leaf would run, since the prediction was under 60 min.
- **Measured:** **1304 s** (21.7 min).
- **The control:** stable, threw nothing, and diverged only on the declared `r5-l60-kill`.

**Result: 51 leaves move and 401 are corpus-blind. Nothing was left unrun.**

| record | moves | corpus-blind |
|---|---|---|
| `arrow` | 1 | 7 |
| `arrowEnemyHit` | 0 | 7 |
| `arrowKillPlan` | 0 | 10 |
| `arrowTrap` | 3 | 10 |
| `blastDamage` | 0 | 4 |
| `blastPlan` | 0 | 4 |
| `chasers` | 2 | 6 |
| `crusher` | 0 | 11 |
| `crusherDirections` | 0 | 8 |
| `enemyClasses` | 20 | 220 |
| `enemyDamageDefaults` | 2 | 5 |
| `enemyTerrainDestroys` | 0 | 2 |
| `fallRock` | 3 | 8 |
| `hammerBilling` | 1 | 3 |
| `iceTurret` | 0 | 31 |
| `iceTurretBlast` | 0 | 9 |
| `playerDamagePaths` | 0 | 4 |
| `playerSnap` | 0 | 2 |
| `pulser` | 0 | 19 |
| `puzzlementHazards` | 7 | 20 |
| `spinner` | 12 | 9 |
| `spinnerCtorRng` | 0 | 2 |

What the moving leaves break down into:

- 34 leaves move a stream.
- 3 of those move one at +1 ULP: `fallRock.waitToFallTimerMax`, `fallRock.cameraTimerMax` and `spinner.hitsMax`.
- 17 move ONLY by making the model throw. Fourteen are `ctor` offsets (iceturret, bombpusher, shieldboss, bosstotem, spinningaxe, lavachain, pulser); the other three are `arrowTrap.shootTimerMax`, `chasers.bob.dieAnim.frames` and `enemyClasses.sandtrap.speed`.

## D5 (iv) — the inline sentinels, measured, not edited

All 171 rows in the census are `kind = sentinel, position = inline`, over the 27 files and 76 file·function sites below. I assigned each row's vocabulary from its census note and context with a keyword pass, then checked by hand; it is a reading, not a derivation.

**Totals:** tag 60 · tile id 21 · tier / type code 13 · direction 11 · camera target 11 · item id / slot 9 · seal slot 9 · tSet 6 · cutscene id 6 · class discriminator 5 · room / group 4 · drown kind 4 · frame 4 · timer state 3 · seed 3 · pod index 1 · force cap 1.

The brief's "`createLevelRun` 46" is **`levelRun.js` 46 over 22 functions**; the census frames each inner closure by its own name. `buildLevelWorld` is 18, as the brief said, and `slashRect` is 7.

| file | function | count | vocabulary |
|---|---|---|---|
| `levelWorld.js` | `buildLevelWorld` | 18 | tag 9, tier / type code 8, room / group |
| `combatVerbs.js` | `slashRect` | 7 | direction 7 |
| `playerPhysicsV2.js` | `terrainEffectClass` | 7 | tile id 7 |
| `levelRun.js` | `weaponForPress` | 6 | item id / slot 6 |
| `activators.js` | `stepActivators` | 4 | class discriminator 3, tSet |
| `levelRun.js` | `advance` | 4 | tag 2, cutscene id 2 |
| `levelRun.js` | `applyLockEvents` | 4 | tag 4 |
| `playerPhysicsV2.js` | `checkDrowning` | 4 | drown kind 4 |
| `r7Acceptance.js` | `segmentBootFromLatch` | 4 | seal slot 4 |
| `bossTotem.js` | `stepBossTotem` | 3 | tile id 3 |
| `breakableRocks.js` | `rockBreaksUnder` | 3 | tier / type code 3 |
| `chest.js` | `stepChests` | 3 | frame 3 |
| `combat.js` | `clearabilityOf` | 3 | tile id 3 |
| `combat.js` | `killLocksIn` | 3 | tSet 2, tag |
| `finalBossFight.js` | `createFinalBoss` | 3 | tag 2, pod index |
| `levelRun.js` | `applyThrust` | 3 | tag 3 |
| `levelRun.js` | `createLevelRun` | 3 | seal slot 2, item id / slot |
| `levelRun.js` | `earnedClearsNow` | 3 | tag 3 |
| `levelWorld.js` | `persistenceClearsFor` | 3 | tag 2, tSet |
| `magicalLock.js` | `createMagicalLock` | 3 | tag 3 |
| `shieldBossFight.js` | `stepShieldBoss` | 3 | tile id 3 |
| `activators.js` | `crossRoomWrites` | 2 | tag 2 |
| `bossTotemFight.js` | `bossTotemCameraTarget` | 2 | camera target 2 |
| `breakableRocks.js` | `hitRock` | 2 | tag 2 |
| `camera.js` | `stepCamera` | 2 | camera target 2 |
| `camera.js` | `stepCameraBand` | 2 | camera target 2 |
| `camera.js` | `stepCameraJiggled` | 2 | camera target 2 |
| `fallRock.js` | `stepFallRock` | 2 | tag, camera target |
| `levelRun.js` | `applyFire` | 2 | tag 2 |
| `levelRun.js` | `drainBossRemovals` | 2 | camera target 2 |
| `levelRun.js` | `finishEndingReboot` | 2 | cutscene id 2 |
| `levelRun.js` | `pullRope` | 2 | tag 2 |
| `levelRun.js` | `stepFinalDoorsNow` | 2 | seal slot, tag |
| `levelRun.js` | `talkerStateFor` | 2 | tag 2 |
| `levelRun.js` | `watcherStateFor` | 2 | tag 2 |
| `levelWorld.js` | `clearedAwayByTag` | 2 | tag, tSet |
| `magicalLock.js` | `magicalLockOpens` | 2 | tier / type code 2 |
| `outOfBandLedger.js` | `outOfBandFlagForWriter` | 2 | tag 2 |
| `playerPhysicsV2.js` | `nextDirection` | 2 | direction 2 |
| `pulser.js` | `stepPulser` | 2 | timer state 2 |
| `r7Acceptance.js` | `goalHeldBy` | 2 | seal slot, cutscene id |
| `rng.js` | `SeedlingRng.constructor` | 2 | seed 2 |
| `tapeFormat.js` | `inventorySlotsFor` | 2 | item id / slot 2 |
| `activators.js` | `localPublish` | 1 | room / group |
| `activators.js` | `opensOnTick` | 1 | class discriminator |
| `activators.js` | `ropePublish` | 1 | room / group |
| `breakableRocks.js` | `outOfBandFlagFor` | 1 | tag |
| `burnableTree.js` | `treeBuiltIn` | 1 | tag |
| `chest.js` | `createChestState` | 1 | frame |
| `combat.js` | `contactPricing` | 1 | class discriminator |
| `crusher.js` | `alwaysArmed` | 1 | tSet |
| `enemyDamage.js` | `enemyHit` | 1 | force cap |
| `fallRock.js` | `publishActivate` | 1 | tag |
| `finalBossFight.js` | `createOwlRoom` | 1 | tag |
| `finalBossFight.js` | `stepOwlGrenade` | 1 | timer state |
| `finalBossRng.js` | `OwlDrawStream.constructor` | 1 | seed |
| `levelRun.js` | `finalDoorStateFor` | 1 | tag |
| `levelRun.js` | `owlStateFor` | 1 | tag |
| `levelRun.js` | `pickupUnderfoot` | 1 | cutscene id |
| `levelRun.js` | `shieldBossStateFor` | 1 | tag |
| `levelRun.js` | `stepChaserEntity` | 1 | tile id |
| `levelRun.js` | `stepChestsNow` | 1 | tag |
| `levelRun.js` | `stepShieldBossesNow` | 1 | tile id |
| `levelRun.js` | `stepWatchersNow` | 1 | tag |
| `levelRun.js` | `terrainAt` | 1 | tile id |
| `levelWorld.js` | `clearedHere2` | 1 | tag |
| `levelWorld.js` | `tSetOf` | 1 | room / group |
| `levelWorld.js` | `tagOf` | 1 | tag |
| `playerDamage.js` | `createPlayerDamage` | 1 | direction |
| `playerDamage.js` | `stepPlayerDamage` | 1 | direction |
| `playerPhysicsV1.js` | `groundTerrain` | 1 | tile id |
| `playerPhysicsV2.js` | `getStatePos` | 1 | tile id |
| `r7Acceptance.js` | `seamBootFields` | 1 | seal slot |
| `shieldBossFight.js` | `createShieldBoss` | 1 | tag |
| `spinner.js` | `newSpinner` | 1 | tag |
| `spinner.js` | `spinnerTerrainWrites` | 1 | tag |

totals by vocabulary: {'tag': 60, 'tile id': 21, 'tier / type code': 13, 'direction': 11, 'camera target': 11, 'item id / slot': 9, 'seal slot': 9, 'tSet': 6, 'cutscene id': 6, 'class discriminator': 5, 'room / group': 4, 'drown kind': 4, 'frame': 4, 'timer state': 3, 'seed': 3, 'pod index': 1, 'force cap': 1} sum 171

## The mutants

| mutant | predicted | measured |
|---|---|---|
| (a) a record with a doc key holding a number | refused naming the key | `t.ctor.src: "src" is a doc key and must hold a string` (test row) |
| (b) two records under one name | refused | `record "t" is registered twice (first by one.js, again by two.js)` (test row) |
| (c) a `NaN` leaf | refused with its dotted path | `t.a.b[1]: NaN is not a finite number` (test row) |
| (d) `spinner.moveSpeed` +1 ULP through the global, in a child process | `result.entities.md5` moves; per the witness row, NO fast-tier stream moves | md5 `b378bf42…` → `a86408d3…`; **0 of 102 streams moved** |
| (d′) `spinner.moveSpeed` ×1.1 (= 2) | the md5 moves AND the five tapes the witness names move | md5 → `b4474417…`; moved exactly `r5-press-glide r5-press-repeat r8-hammer-control r8-solve-18 r9-solve-18` |
| (d″) the same override through a wrong path (`spinner.moveSpeeed`) | refused naming the path | `REFUSED: ovbad.json: entity records: override: unknown path "spinner.moveSpeeed"`, exit 3 |
| (AST) the comparator's own mutant | DIFF | DIFF |

(a)–(c) are rows in `entityRecords.test.js`, run in fresh module registries. (d) ran in scratch child processes, and the tree was clean after.

## Files outside the brief's list

- `scripts/procgen/witness-seedling-profile.mjs`: it now exports its harness. The new parameters default to today's behaviour, so the profile witness's messages and output are unchanged.
- `scripts/procgen/seedling-constants-fields.csv`: 9 rows deleted and 2 added (D5 census).
- `frontend/modules/procgenDocs/generated/{instruments,docsIndex}.js`, `docs/json/developer/procgen/{README,architecture}.md`: regenerated regions.
- `entityRecords.js` imports `profileOverrides.js`'s `duplicateKeys` as well as `md5.js`. `profileOverrides.js` is itself dependency-free, so this is a second leaf import, not a model import, and no cycle can form. The brief said "dependency-free but for `./md5.js`", and this was a choice against duplicating the text scanner.

## The exported API, as P3 will call it

```js
import {
    defineRecord, assertEntityRecord, EntityRecordError, ENTITY_RECORDS_GLOBAL, ENTITY_RECORD_MODULES,
    entityRecordNames, entityRecord, entityLeaves, entitiesDump, entitiesMd5, entitiesStamp,
    entitiesAnnouncements, entitiesOverrides, entitiesUnused, ENTITIES_SOURCE,
} from './entityRecords.js';

defineRecord('myTable', { … }, { doc: ['src', 'why'], src: 'my.js' });  // → the same object, deep-frozen
entityRecord('spinner')          // {name, record, doc, src}
entityLeaves()                   // [{record, path, value, type}], dump order; path e.g. 'enemyClasses.bob.aggro.range'
entitiesStamp()                  // {md5, records} — also runTape(...).entities
// override (node): SEEDLING_ENTITY_RECORDS=file.json or --entities=file.json, then
//   await installEntityRecordsFromEnv()   // scripts/procgen/seedlingProfileLoader.mjs, BEFORE importing the model
// override (anywhere): globalThis.__SEEDLING_ENTITY_RECORDS__ = { 'spinner.moveSpeed': 1.1 } before the first model import
import { TILE_TYPE_IDS } from '../flashPanel/seedlingSemantics.js';   // { ground: 0, water: 1, … lava: 17, … }
import { NO_FORCE_CAP } from './enemyDamage.js';
```

## What the brief got wrong (measured)

1. **Mutant (d) at one ULP does not move a tape.** `spinner.moveSpeed` +1 ULP moves the md5 but no fast-tier stream; ×1.1 moves five. I ran both.
2. **`tapeRunner.test.js` is 365 tests, not 360**, and the four-file gate totals 635.
3. **"`createLevelRun` 46"** is `levelRun.js`'s file total over 22 functions (above).
4. **"No tag / tSet `-1` family in the D2 tables"**: none of the D2 records holds one, so `NO_TAG` and `KILL_LOCK_TSET` had nothing to name. Only `NO_FORCE_CAP` landed.
5. **D5 census "conservation"** holds for physics. Rule grows by 29, because the table names all 38 types.
6. **The identity md5 `b60078ac…`** is from another head and a different line format. It is not comparable to this session's number.

## Residue

- ⚠ **Shared nodes are overridden asymmetrically.** `ARROW_TRAP.ctor === PUZZLEMENT_HAZARDS.arrowtrap.ctor`.
  - The override `puzzlementHazards.arrowtrap.ctor.dy` writes the shared node in place, because `combat.js` registers first and the node is unfrozen then. It therefore moves `ARROW_TRAP`'s tape as well (witness: moves 1).
  - `arrowTrap.ctor.dy`, applied after the node froze, is copied and moves nothing.
  - The witness records both as they are. P3 should decide whether a path should reach an alias, or whether `defineRecord` should refuse a node already registered under another name. I did not decide it here, because either change moves the witness record.
  - Another shared node: `SPINNER.solids` IS `levelWorld.SOLIDS_BY_MOVER.enemy`. It is frozen before registration, so an override of `spinner.solids[i]` is copied and does not reach `levelWorld`. That is the same asymmetry in its safe direction.
- The profile's `*State` keys and `TILE_TYPE_IDS` now spell the same values in two places, held together by a test. The brief kept the profile keys on purpose (the witness names them).
- `HAZARD_STATES`, `DESTROYING_TILE_TYPES`, `TILE_TYPE_SEMANTICS` and `FINAL_BOSS.lavaT` are asserted against `TILE_TYPE_IDS`, but they still spell ints. They are not D2 records, so they were out of scope.
- One run of the four-file combo (`seedlingSemantics`, `entityRecords`, the agreement test and `seedlingEntityWitness`) reported `seedlingEntityWitness.test.js` failed at collection, with no error text captured. Five later runs passed: the file alone twice, the combo three times. I could not reproduce it or give a cause. If it recurs, the suspect is that file's top-level `await entityNumberFields()` together with its `spawnSync('--check')` row under parallel load.
- The full-tier entity witness was not run. It is the coordinator's call, like the profile's `-full` record.
