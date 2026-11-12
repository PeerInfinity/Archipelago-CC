# Cloud report — `rules-l40-bk2-fixup`: the two red pin files under the L40 Boss Key 2 rule

## 1. Start, head, branch

| | |
|---|---|
| Session | `rules-l40-bk2-fixup` (planner `seedling-rules-planning-7`), cloud, Opus |
| Base | `origin/land/rules-l40-bk2` = **`9ed6b83a5deaeed53d6a8ba48572a23a1c47faec`** (main NOT merged) |
| Branch | `claude/rules-l40-bk2-fixup-cyselw` (the harness's designated branch) |
| Environment | `session_bootstrap.sh --seedling` READY; the six non-wasm submodules initialised (no pointer moved); `minimal-spoilers` |
| Scope messages | none arrived mid-run |

| commit | what |
|---|---|
| `fb066fc4` | census: a crossing that can gate nothing reads CAN'T-GATE (general); the census hands its push search the producer's `bodies`; pin re-recorded with reasons; `sealedBehindBlock` exported (no output change) |
| `81416756` | route carry: re-pinned to the rule; radius DERIVED; the accessibility mutant moved BK2 → Chest; a new mutant on the staged-flag subtraction |
| (last) | this report |

## 2. The answer first

| # | question | answer |
|---|---|---|
| 1 | Why does the rule move the census? | Its input **stances** changed, not its cases: `playthroughBlockCrossingCases` now hands a fire block `hitAwayStances` (`PushableBlockFire.as:98-121`, a hit sends the block AWAY from the hitter). The six L40 cases and the grid are identical before/after (measured). |
| 2 | Why 125 → 81 rows? | Before, `pushableblockfire@576,576` roamed column 36, row 42 and far beyond from every side (base cells: ~200 tiles). Now from below (r26c13, (36,37)) Fire sends it only north and from the pocket (r36c35) only east: those 4 cases' cells stay in the BK2 column, where no body walks → 11 bodies × 4 cases = **44 rows leave**. From inside (r32c36) Fire sends it only south, down column 36 to row 42: its 2 cases still meet all 11 bodies. L40 block met 78 → 34. |
| 3 | The 11 new MOBILE rows | **Not all BobSoldiers**: 7 Bob, 1 BobSoldier, 1 Puncher, 2 Spinner. All on ONE crossing, `r32c36 -> r36c35`, critical cell (36,37), `killHeld: false`. |
| 4 | Can a live body on (36,37) stop the Pulser's shove the BK2 route needs? | **NO (source decides; no witness needed).** See §3. |
| 5 | Fix | **General** census fix (no level literal): `crossingGatesNothing` — the crossing's far side is a pocket sealed behind the block (the producer's own `sealedBehindBlock`) and its near side has no boundary exit and exactly one other way in, which the pocket leads back to. Such a crossing reaches nothing the near side's way in did not, so no price on it can gate a location. The 11 rows → CAN'T-GATE, keeping their `critical` cells. MOBILE 12 → **1**. |
| 6 | L65's MOBILE row | **Unchanged**, byte-identical to the pre-rule base (`40e83e5c`) census line (`r0c8 -> r4c11`, Bob, critical 10,7 10,8, killHeld true, respawns). Not inert: `r0c8` has boundary exits. |
| 7 | Route carry | Re-pinned: BK2's legs now STAGE flag 12 by their goal rule and carry nothing; radius 85 → 83, now derived; mutant moved to the Chest (§5). |
| 8 | Stops | **None hit.** No AP_1 / sphere log / maze / `seedling_er` / derived-table change; no level literal in code; no producer output, solver, levelRun or `CONTACT_FIDELITY` change. |

## 3. The game source: why no body can stop the BK2 route's shove

The room (model grid, x 26..46, y 26..46): column 36 runs (36,32..34) [BK2 room, BK2 at (41,33)] → `pushableblock@576,560` (36,35) → `pushableblockfire@576,576` (36,36) → corridor (36,37..41) → row 42. `pulser@592,576` stands at (37,36) (Solid, `Pulser.as:47-48`); (35,36) is a one-tile pocket entered only from (36,36).

- **The BK2 route** is `r26c13 -> r32c36` (gated on flag 12). Its crossing is the Pulser's shove: `Pulser.as:100-103` hits the fire block with its centre (600,584); the block centre is (584,584), so `a = 0` and `PushableBlockFire.as:98-121` moves it one tile **WEST into the pocket (35,36)**. (36,37) is not on that move: it is the player's own start for the case (the producer's `walked (from (36,37))`).
- **The shove's only target, the pocket, cannot hold an Enemy.** It is entered only through (36,36), which the fire block occupies from level load until the shove; no body spawns in it (entity list of the area). The census's body flood agrees: no body's range contains (35,36) or (36,36).
- **So the critical (36,37) is on a different crossing:** `r32c36 -> r36c35`, Fire from INSIDE the BK2 room pushing the block south (hit-away) onto (36,37), freeing the pocket. A chasing body can stand there (`PushableBlockFire.as:31` `solids.push("Enemy", "Player")`; the producer's own push search with a stopper on (36,37) prices this crossing `[]`, measured). But that crossing **gates nothing**: `r32c36`'s only internal neighbours are `r26c13` and `r36c35` (no boundary exit); `r36c35` holds no location and no exit and leads only to `r32c36` and `r26c13`. Whoever is in r32c36 came from r26c13, and the crossing leads back there. No location's reachability rides on it, so a transient blocker there cannot make a rule looser than the game.

**Observation for the planner (not acted on).** In AP_1, `r32c36 -> r36c35` is free beyond the push item and `r36c35 -> r26c13` keeps the push-item rule ("entered only through the block's cell — nothing to price"), so `r32c36 -> r36c35 -> r26c13` bypasses the flag-12 gate on `r32c36 -> r26c13`. It is harmless for the same reason (r32c36 is only entered from r26c13), and it is the rule slice's as-committed shape.

## 4. Census — before → after (pin `seedlingBlockStoppersCensus.test.js`)

| value | pin before | rule, unfixed | after (fixed) |
|---|---|---|---|
| blocks / uses | 19 / none 7, holder 8, crossing+holder 1, crossing 3 | same | same |
| rows | 125 | 81 | 81 |
| CAN'T-GATE / HOLDER / MOBILE | 113 / 11 / 1 | 58 / 11 / 12 | **69 / 11 / 1** |
| movement chase / static / wall-hug-launch / none | 91 / 4 / 6 / 24 | 55 / 4 / 6 / 16 | 55 / 4 / 6 / 16 |
| holder verdicts | ok same 5, ok tighter-never-settles 6 | same | same |
| the one MOBILE row | L65 Bob `r0c8 -> r4c11` | + 11 L40 rows | L65 Bob, unchanged |

The census code (`census-seedling-block-stoppers.mjs`):
- `crossingGatesNothing(room, c)` (exported) → the near side's one way in, or null. Rows on such a crossing get `inert: '<way in>'`, verdict CAN'T-GATE, their `critical` cells kept, and a `why` naming the pocket and the way in. A static KILL-GATE on an inert crossing would read CAN'T-GATE the same way (none at this base).
- The crossing searches now take the room's other pushables as Solid `bodies`, exactly as `playthroughBlockCrossings` does (⛓ "no third physics"). That moves **no** row at this base (measured: only the 11 inert rows and the counts line differ from the unfixed run).
- `sealedBehindBlock` in `make-seedling-playthrough-rules.mjs` gains `export` only; its producer `--check` stays OK (§7).

New pin rows: the inert rows (every one CAN'T-GATE, `r32c36 -> r36c35`, way in `r26c13`, critical `36,37`, `killHeld` false; their number derived from the crossing's rows); `crossingGatesNothing` on a synthetic room with three mutants (a second way in, a boundary exit on the near side, a location in the pocket → null) and a non-pocket far side → null. **Mutant measured:** dropping `&& !inert` from the MOBILE verdict reds 3 rows (counts, the one-MOBILE row, the inert row).

## 5. Route carry — before → after (pin `seedlingDivergenceRouteCarry.test.js`)

| pinned value | before | after |
|---|---|---|
| radius (legs that carry) | typed `toHaveLength(85)` | **derived**: equal, key by key and flag by flag, to `withRouteCarry(routeCarry(..))` composed in the test over the OFF list from the committed AP_1 (generated sphere log → `collectionRows`, `gameStateEventsOf` + `stagedFlagOf` flags, `levelReads`). Measures 83. Test name carries no count. |
| BK2 carry | `[[flag:L40:12],[flag:L40:12]]` | `[[],[]]` |
| BK2 staged | (not pinned) | `[[flag:L40:12],[flag:L40:12]]` (its goal rule now names flag 12) |
| BK2 sphere | 5.3 | 6.1 (not pinned any more) |
| Chest carry | `[[flag:L40:12],[flag:L40:12]]` | same |
| flag 8 carry / r26c13 staging | `[[],[],[7],[7]]` / `[[12,7],[12,7]]` | same |
| flag 12's own legs | `[[],[]]` | same |
| every carried flag its leg's own level's | true | true |
| ⛓ MUTANT (route order = accessibility) | subject BK2 (sphere 5.3, no flag 12 in it, carries flag 12) | subject **the Chest** (`level_40__r26c13 <- in_L39_144_0 -> Level 040 - Chest`): sphere 5.3, flag 12 not in its inventory, carries flag 12. Same door, same reason. |
| ⛓ NEW MUTANT (staged flags not subtracted) | — | carrying every route flag a leg reads (no subtraction of its staging) puts BK2's legs back in the radius and grows it; the real radius holds no BK2 leg |

The other mutants (own goal, reads, far side) are unchanged and green. **No `seedlingDivergence*` producer or solver change.** The hammer planner's review of this re-pin is owed (the brief's ask); nothing here changes what the sweep stages, only what the pin expects.

## 6. C — the bounded sweep the slice missed

Listed with `rg -a -l` (guarded: `*.test.js`/`*.test.mjs` under `scripts frontend test`, `node_modules`, `shared/` and the wasm submodule excluded), as the union of:
- (a) readers of the block crossings / stoppers census / divergence legs / route carry: pattern `playthroughBlockCrossing|BlockCrossings|blockCrossingCost|census-seedling-block-stoppers|blockStopperCensus|seedling-divergence-legs|divergence-door-leg-keys|carry-route-flags|routeCarry|seedlingBlockPaths|sealedBehindBlock|pulserShoveTarget|activatorReachCost` → 8 files;
- (b) AP_1 readers of the seedling presets: files matching `AP_1` that also name `seedling_(playthrough|atlas|er)` → 110 files.

(A bare `AP_1_rules` match is 152 files, every game's preset; (b) narrows it to Seedling's.)

**The list (114 files):**

<details><summary>expand</summary>

- `frontend/modules/apworldEditor/exitSides.test.js`
- `frontend/modules/apworldEditor/regionRederive.test.js`
- `frontend/modules/apworldEditor/regionRoundTrip.test.js`
- `frontend/modules/apworldEditor/sidecarIssues.test.js`
- `frontend/modules/flashPanel/flashBridgeAdapter.test.js`
- `frontend/modules/flashPanel/flashPanelRulesDerived.test.js`
- `frontend/modules/flashPanel/flashPanelSameWiringRemount.test.js`
- `frontend/modules/flashPanel/flashSeedlingAtlasRoom.test.js`
- `frontend/modules/flashPanel/flashSeedlingContentSource.test.js`
- `frontend/modules/flashPanel/mapDocumentPath.test.js`
- `frontend/modules/flashPanel/seedlingArrivalEscape.test.js`
- `frontend/modules/flashPanel/seedlingAtlasArm.test.js`
- `frontend/modules/flashPanel/seedlingAtlasHostWorld.test.js`
- `frontend/modules/flashPanel/seedlingBlockPaths.test.js`
- `frontend/modules/flashPanel/seedlingCheckBinding.test.js`
- `frontend/modules/flashPanel/seedlingEncounterBinding.test.js`
- `frontend/modules/flashPanel/seedlingEntranceShuffleLoad.test.js`
- `frontend/modules/flashPanel/seedlingEventCollector.test.js`
- `frontend/modules/flashPanel/seedlingGeneratedArm.test.js`
- `frontend/modules/flashPanel/seedlingGeneratedWorld.test.js`
- `frontend/modules/flashPanel/seedlingKillLocks.test.js`
- `frontend/modules/flashPanel/seedlingLevelSetDelivery.test.js`
- `frontend/modules/flashPanel/seedlingLogicalLinks.test.js`
- `frontend/modules/flashPanel/seedlingLoopRestart.test.js`
- `frontend/modules/flashPanel/seedlingNoHitDirectionalGates.test.js`
- `frontend/modules/flashPanel/seedlingPlaybackController.test.js`
- `frontend/modules/flashPanel/seedlingPlaythroughExportLoad.test.js`
- `frontend/modules/flashPanel/seedlingPlaythroughOverlay.test.js`
- `frontend/modules/flashPanel/seedlingRandomizerEligibility.test.js`
- `frontend/modules/flashPanel/seedlingRandomizerWiring.test.js`
- `frontend/modules/flashPanel/seedlingRegionBinding.test.js`
- `frontend/modules/flashPanel/seedlingRegionGlue.test.js`
- `frontend/modules/flashPanel/seedlingRestartWarp.test.js`
- `frontend/modules/flashPanel/seedlingReturnToMenu.test.js`
- `frontend/modules/flashPanel/seedlingSlotPlayer.test.js`
- `frontend/modules/flashPanel/seedlingSpiralWorld.test.js`
- `frontend/modules/flashPanel/seedlingTeleportTool.test.js`
- `frontend/modules/flashPanel/seedlingVanillaArmMap.test.js`
- `frontend/modules/flashPanel/seedlingWasmPlayback.test.js`
- `frontend/modules/mazeRoom/mazeBlockSinks.test.js`
- `frontend/modules/mazeRoom/mazeLatchArt.test.js`
- `frontend/modules/mazeRoom/mazeLevelWorld.test.js`
- `frontend/modules/mazeRoom/mazeLiveMarkers.test.js`
- `frontend/modules/mazeRoom/mazeSeedlingArtEdit.test.js`
- `frontend/modules/mazeRoom/mazeSeedlingSkin.test.js`
- `frontend/modules/mazeRoom/mazeSeedlingSprites.test.js`
- `frontend/modules/mazeRoom/mazeSetLab.test.js`
- `frontend/modules/mazeRoom/mazeSidedOpeners.test.js`
- `frontend/modules/mazeRoom/mazeTileArt.test.js`
- `frontend/modules/mazeRoom/tileSpike/certifyEventLocations.test.js`
- `frontend/modules/mazeRoom/tileSpike/certifyLandingGates.test.js`
- `frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js`
- `frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.test.js`
- `frontend/modules/mazeRoom/tileSpike/encounterKillArms.test.js`
- `frontend/modules/mazeRoom/tileSpike/puzzleLocks.test.js`
- `frontend/modules/presets/documentBundle.test.js`
- `frontend/modules/presets/rulesJsonWriters.test.js`
- `frontend/modules/procgenCore/eventRoute.test.js`
- `frontend/modules/procgenCore/restartRoute.test.js`
- `frontend/modules/procgenCore/rulesGraph.test.js`
- `frontend/modules/procgenPipeline/atlasMazeBot.slow.test.js`
- `frontend/modules/procgenPipeline/compositeMapDocument.test.js`
- `frontend/modules/procgenPipeline/procgenPipelineUI.test.js`
- `frontend/modules/procgenPipeline/regionAtlasCompiler.test.js`
- `frontend/modules/procgenPipeline/regionAtlasMazeProjection.test.js`
- `frontend/modules/procgenPipeline/regionAtlasMazeRopeRun.test.js`
- `frontend/modules/seedlingDemo/apPlacementRewriter.test.js`
- `frontend/modules/seedlingDemo/entranceRetarget.test.js`
- `frontend/modules/seedlingDemo/fidelityBindings.test.js`
- `frontend/modules/seedlingDemo/fidelityLightPole.test.js`
- `frontend/modules/seedlingDemo/hammerApproachOrder.train.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeAtlas.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeDeclarations.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeEncounterLegWalk.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeEventGoalWalk.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeGameSpeed.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeLongPlanWalk.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeSolveProgress.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeSolveService.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeSolver.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeSolverEventGoal.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeVanillaDelivery.test.js`
- `frontend/modules/seedlingDemo/jsRuntimeVerbs.test.js`
- `frontend/modules/seedlingDemo/r5SwimCloseout.test.js`
- `frontend/modules/seedlingDemo/seedlingArrivalSpawn.test.js`
- `frontend/modules/seedlingDemo/seedlingAtlasCheckTable.test.js`
- `frontend/modules/seedlingDemo/seedlingAtlasDerivation.test.js`
- `frontend/modules/seedlingDemo/seedlingSetPatches.test.js`
- `frontend/modules/seedlingDemo/solverEnvChannel.test.js`
- `frontend/modules/seedlingDemo/solverPrefix.test.js`
- `frontend/modules/stateManager/core/entranceRandomization.load.test.js`
- `frontend/modules/stateManager/core/eventKinds.test.js`
- `scripts/procgen/check-worldgen-package-sidecars.test.js`
- `scripts/procgen/seedlingBlockCrossings.test.js`
- `scripts/procgen/seedlingBlockStoppersCensus.test.js`
- `scripts/procgen/seedlingBossLockCensus.test.js`
- `scripts/procgen/seedlingDivergenceLegs.test.js`
- `scripts/procgen/seedlingDivergenceRouteCarry.test.js`
- `scripts/procgen/seedlingDivergenceSweep.test.js`
- `scripts/procgen/seedlingErMode.test.js`
- `scripts/procgen/seedlingErReachBinding.test.js`
- `scripts/procgen/seedlingFootprints.test.js`
- `scripts/procgen/seedlingInRoomPressGate.test.js`
- `scripts/procgen/seedlingLethalLandings.test.js`
- `scripts/procgen/seedlingLocationRebind.test.js`
- `scripts/procgen/seedlingPlaythroughEntryGateFloor.test.js`
- `scripts/procgen/seedlingPlaythroughLogicalLinks.test.js`
- `scripts/procgen/seedlingPlaythroughNecessaryDoors.test.js`
- `scripts/procgen/seedlingPlaythroughObstacleEvents.test.js`
- `scripts/procgen/seedlingPlaythroughOffGridLock.test.js`
- `scripts/procgen/seedlingPlaythroughWaterfallDoor.test.js`
- `scripts/procgen/seedlingPresetHasNames.test.js`
- `scripts/procgen/seedlingSphereOrderEvents.test.js`
- `scripts/procgen/surveyPreset.test.js`

</details>

**Result:**

| tier | files | result |
|---|---|---|
| default (`npx vitest run <the 111 paths>`, the list guarded non-empty) | 111 | **111 passed, 2280 tests passed**, 158.7 s |
| slow (`--config vitest.slow.config.js atlasMazeBot.slow.test.js`) | 1 | **21 passed** |
| train (`--config vitest.train.config.js hammerApproachOrder.train.test.js`) | 1 | **7 passed**, 331 s |
| calib (`--config vitest.calib.config.js deriveLevelWorldLogic.calib.test.js`) | 1 | **1 passed**, 816 s |

Both previously red files are in the list and green: `seedlingBlockStoppersCensus.test.js` (16) and `seedlingDivergenceRouteCarry.test.js` (20). `lintGateLabels.test.js` was also run alongside the route-carry pin: green, with no finding on either touched test file (`lint-gate-labels.mjs` prints none for them).

## 7. Gates

| gate | result |
|---|---|
| C's sweep | green (§6) |
| `census-seedling-constants.mjs --write` | not needed: no code literal added (the census fix is structural) |
| `generate-procgen-reference.mjs --check` | "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE" |
| `make-seedling-playthrough-rules.mjs --check` | exit 0: "OK: …/seedling-playthrough.json matches a fresh build", "OK: …/seedling_playthrough/AP_1/AP_1_rules.json matches a fresh build" |
| `make-seedling-playthrough-maze.mjs --check` | "OK: …/seedling_playthrough_maze/AP_1/AP_1_rules.json is byte-identical to the compiled atlas" |
| `make-seedling-er-preset.mjs --check` | "OK: …/seedling_er/AP_1/AP_1_rules.json matches a fresh build" |
| `make-seedling-sphere-order.mjs --check` | "OK: …/seedling-sphere-order.json matches a fresh build" (48 locations over 16 spheres) |
| mutants | census: dropping the inert check reds 3 rows (measured); route carry: every mutant row green against the real list, each asserting the mutant's divergence |
| tree | clean but for this report; no pytest/Generate run, so no preset dirt |

## 8. Residue

- No `worlds/seedling/`, `vendor/seedling`, `.github/`, submodule-pointer, solver/levelRun or `CONTACT_FIDELITY` change. No new code literal (the census constants census is not needed).
- A scratch worktree at the pre-rule base (`40e83e5c`, for the before census) was used and removed.
