| binding | kind | decl | read in the reach by | written by (every writer; `<construction>` = at build) | digest |
|---|---|---|---|---|---|
| `levelSource` | param | :534 | `beamTowerStateFor`, `crossRoomWritersOnto`, `levelCarriesTag`, `recordFor` +1 | — | EXCLUDED: a function; the caller keys on the staging it came from |
| `boot` | param | :534 | `=level`, `=spawn` | — | staging |
| `noclip` | param | :534 | `beamTowerRectsNow`, `fallenRocksNow`, `pulledRopeIdsNow`, `run.previewStepper` +2 | — | staging |
| `noHazards` | param | :534 | `stepOptsFor` | — | staging |
| `noDamage` | param | :534 | `publishRopeGroup` | — | staging |
| `grants` | param | :534 | `=grantsByLevel` | — | staging |
| `equips` | param | :534 | `=equipsByTick` | — | staging |
| `roles` | param | :534 | `worldFor` | — | staging |
| `pins` | param | :534 | `=clockRefusal`, `stepOptsFor` | — | staging |
| `save` | param | :534 | `=bootSave` | — | staging |
| `seam` | param | :534 | `=seamBoot` | — | staging |
| `worlds` | const-data | :685 | `worldFor` | `applyClearNow`, `applyEarnedClears`, `applyTimedDespawns`, `dropWorldIfBuiltStale`, `fireStaticRemovals`, `worldFor` | place |
| `inventory` | const-data | :701 | `inventoryNow`, `pressHitDamage`, `run.spinnerForecastWithPress`, `slashInfoNow` +3 | `<construction>` | player |
| `seamBoot` | const-data | :713 | `=bootCutscene`, `=clockDeclared`, `=cutscene`, `=moonrockSet` +1 | — | EXCLUDED: f(seam) |
| `primary` | let | :751 | `primaryNow`, `weaponForPress` | `applyEquipsAt`, `syncSlots` | player |
| `slotOrder` | let | :752 | `inventorySlotsNow`, `weaponForPress` | `<construction>`, `syncSlots` | player |
| `clockDeclared` | const-data | :800 | `=clock`, `=clockRefusal` | — | EXCLUDED: f(seam) |
| `bootCutscene` | const-data | :801 | `=clockRefusal` | — | EXCLUDED: f(seam) |
| `clockRefusal` | let | :820 | `=clock` | `run.adoptWindowClock` | clock |
| `clock` | const-data | :821 | `run.gameTimeAt`, `spendFrozen` | — | clock |
| `bootSave` | const-data | :837 | `=keys`, `=totemParts`, `saveStateNow` | — | EXCLUDED: f(save) |
| `totemParts` | const-data | :838 | `saveStateNow` | `run.advance` | persist |
| `clearedByLevel` | const-data | :850 | `moonrockStateFor`, `worldFor` | `<construction>`, `applyClearNow`, `applyEarnedClears` | persist |
| `pendingEarnedClears` | const-data | :963 | `publishRopeGroup` | `applyEarnedClears`, `applyLockEvents`, `applyThrust`, `fireStaticRemovals`, `moonrockFrameNow`, `publishRopeGroup`, `pullRope`, `resolveButtonFalls` +6 | persist |
| `crossRoomWriterIndex` | let | :1005 | `crossRoomWritersOnto` | `crossRoomWritersOnto` | EXCLUDED: a memo of levelSource |
| `unreadRoomWrites` | const-data | :1028 | `reportUnreadStaged` | `applyLockEvents`, `reportUnreadStaged` | persist |
| `despawnedByLevel` | const-data | :1044 | `recordFor` | `applyTimedDespawns`, `fireStaticRemovals` | persist |
| `staticRemovedTags` | const-data | :1067 | `clearedForBuild` | `fireStaticRemovals` | persist |
| `activatorStates` | const-data | :1246 | `activatorStateFor` | `activatorStateFor`, `applyEarnedClears`, `dropWorldIfBuiltStale`, `freshActivatorState` | visit |
| `bridgeStates` | const-data | :1288 | `bridgeStateFor` | `bridgeStateFor`, `dropWorldIfBuiltStale`, `freshVisitState` | visit |
| `pushableStates` | const-data | :1289 | `pushableStateFor` | `dropWorldIfBuiltStale`, `freshVisitState`, `pushableStateFor` | visit |
| `rockStates` | const-data | :1300 | `rockStateFor` | `rockStateFor` | visit |
| `burnStates` | const-data | :1312 | `burnStateFor` | `burnStateFor` | visit |
| `ropeStates` | const-data | :1340 | `ropeStateFor` | `ropeStateFor` | visit |
| `fallRockStates` | const-data | :1450 | `fallRockStateFor` | `fallRockStateFor` | visit |
| `moonrockSet` | let | :1633 | `moonrockStateFor` | `moonrockFrameNow` | persist |
| `moonrockStates` | const-data | :1634 | `moonrockStateFor` | `freshVisitState`, `moonrockStateFor` | visit |
| `crusherStates` | const-data | :1668 | `crusherStateFor` | `crusherStateFor`, `dropWorldIfBuiltStale`, `freshVisitState` | visit |
| `bossStates` | const-data | :1727 | `bossStateFor` | `bossStateFor`, `dropWorldIfBuiltStale`, `freshVisitState` | visit |
| `shieldBossStates` | const-data | :1782 | `shieldBossStateFor` | `dropWorldIfBuiltStale`, `freshVisitState`, `shieldBossStateFor` | visit |
| `finalDoorStates` | const-data | :2035 | `finalDoorStateFor` | `dropWorldIfBuiltStale`, `finalDoorStateFor`, `freshVisitState` | visit |
| `turretStates` | const-data | :2105 | `turretStateFor` | `dropWorldIfBuiltStale`, `freshVisitState`, `turretStateFor` | visit |
| `beamTowerStates` | const-data | :2244 | `beamTowerStateFor` | `beamTowerStateFor`, `freshVisitState` | visit |
| `magicalLockStates` | const-data | :2284 | `magicalLockStateFor` | `magicalLockStateFor` | visit |
| `wandWindows` | const-data | :2330 | `slashInfoNow` | `run.advance` | visit |
| `rockFalls` | const-data | :2522 | `dropRock` | `dropRock`, `dropRocksTogether` | persist |
| `frozenTimer` | let | :2900 | `frozenTimerNow`, `run.previewStepper` | `enterWorld`, `run.advance`, `stepBlastsNow` | player |
| `damage` | let | :2919 | `forecastSwordTest`, `run.previewStepper`, `run.spinnerForecastWithPress` | `<construction>`, `applyPlayerHit`, `enterWorld`, `moonrockFrameNow`, `run.advance`, `runFrozenTick`, `stepBobBossArenaNow`, `stepCeremonyDeadFrameNow` +1 | player |
| `chestStates` | const-data | :3501 | `chestStateFor` | `chestStateFor`, `freshVisitState` | visit |
| `pulserStates` | const-data | :3525 | `pulserStateFor` | `freshVisitState`, `pulserStateFor` | visit |
| `spinnerStates` | const-data | :3610 | `spinnerStateFor` | `dropWorldIfBuiltStale`, `freshVisitState`, `spinnerStateFor` | visit |
| `level` | let | :4513 | `=world`, `beamTowerRectsNow`, `bossRectsNow`, `brokenRockIdsNow` +18 | `enterWorld` | place |
| `world` | let | :4514 | `=state`, `collideLineSolid`, `run.world`, `spinnerCtx` +2 | `applyClearNow`, `applyTimedDespawns`, `enterWorld`, `fireStaticRemovals`, `stepBulbGraphicNow` | place |
| `spawn` | const-data | :4521 | `=state` | — | EXCLUDED: f(boot) |
| `state` | let | :4522 | `dropRock`, `publishRopeGroup`, `run.state` | `applyPlayerHit`, `enterWorld`, `finishEndingReboot`, `moonrockFrameNow`, `run.advance`, `run.spinnerFightForecast`, `runFrozenTick`, `stepBobBossArenaNow` +3 | player |
| `firstTickInWorld` | let | :4548 | `run.spinnerForecastWithPress`, `spinnerCtx` | `enterWorld`, `finishEndingReboot`, `run.advance` | place |
| `ticksCompleted` | let | :4824 | `brokenRockIdsNow`, `burnedTreeIdsNow`, `dropRock`, `openBridgeIdsNow` +6 | `run.advance`, `runFrozenTick` | place |
| `keys` | const-data | :4890 | `keysNow`, `saveStateNow`, `takenPickupsNow` | — | persist |
| `grantsByLevel` | const-data | :4891 | `unfiredGrantLevelsNow` | `applyGrantsFor` | player |
| `equipsByTick` | const-data | :5162 | `unfiredEquipTicksNow` | `applyEquipsAt`, `equipNow`, `run.addEquips` | player |
| `swordWindow` | let | :5265 | `run.spinnerForecastWithPress`, `spearingAt` | `enterWorld`, `run.advance`, `stepMoonrocksNow` | player |
| `slashState` | let | :5275 | `slashInfoNow` | `enterWorld`, `run.advance`, `runFrozenTick`, `stepMoonrocksNow` | player |
| `slashEndsAt` | let | :5282 | `slashInfoNow` | `enterWorld`, `run.advance`, `stepMoonrocksNow` | player |
| `spearEndsAt` | let | :5288 | `slashInfoNow`, `spearingAt` | `enterWorld`, `run.advance` | player |
| `fireWindows` | const-data | :5312 | `slashInfoNow` | `run.advance` | visit |
| `pullsByLevel` | const-data | :8623 | `pullsFor` | `pullsFor` | visit |
| `chestOpens` | const-data | :12956 | `saveStateNow` | `stepChestsNow` | persist |
| `ceremony` | let | :13062 | `inCeremonyNow`, `run.spinnerForecastWithPress`, `spinnerCtx` | `armCeremonyLumpNow`, `run.advance`, `stepCeremonyLumpNow` | player |
| `bobArena` | let | :13099 | `fallenRocksNow` | `bobArenaNow`, `enterWorld`, `run.advance` | player |
| `bobNoInput` | let | :13110 | `inputRefusedNow` | `enterWorld`, `stepBobBossArenaNow` | player |
| `cutscene` | const-data | :13141 | `clockRefusalFor` | `finishEndingReboot` | EXCLUDED: f(seam) |
| `collectedPickups` | const-data | :13169 | `takenPickupsNow` | `run.advance` | persist |
| `lockSnap` | let | :13270 | `inputRefusedNow` | `applyLockEvents` | persist |
| `PROGRESS_FIELDS` | const-data | :15738 | `run.progress` | — | EXCLUDED: frozen constant |

74 bindings; digested 65, excluded by name 9, unaccounted []

## the persistence channel (the crux): every reader and writer, and whether the escape reach reads it
- `persistence` (param, :534): read by ['<construction>', '=declaredClears', '=timedClears']; written by []; read in the escape reach: NO
- `timedClears` (const-data, :876): read by ['appliedTimedClearsNow', 'applyTimedClears', 'run.addTimedClears']; written by ['run.addTimedClears']; read in the escape reach: NO
- `declaredClears` (let, :899): read by ['assertChaserRemovalIsDeclared', 'assertScratchSlotIsFree', 'assertSpinnerRemovalIsDeclared', 'fireStaticRemovals', 'run.addTimedClears']; written by ['run.addTimedClears']; read in the escape reach: NO
- `despawn` (param, :534): read by ['=timedDespawns']; written by []; read in the escape reach: NO
- `scratchPersistence` (param, :534): read by ['assertChaserRemovalIsDeclared', 'firePendingKillLockThrows', 'fireStaticRemovals', 'run.scratchPersistence']; written by []; read in the escape reach: NO
