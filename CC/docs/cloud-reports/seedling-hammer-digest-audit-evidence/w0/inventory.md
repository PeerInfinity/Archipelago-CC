| map | line | digest part at base | escape members reaching a reader | other members reaching a reader | writers (outside construction) | DA |
|---|---|---|---|---|---|---|
| `clearedByLevel` | 954 | persist | previewStepper progress spinnerForecastWithPress state world | addTimedClears advance apReportSlotHeld armedArrowTraps armedPulsers arrowCoverAt … | applyClearNow applyEarnedClears | digested |
| `despawnedByLevel` | 1171 | persist | previewStepper progress spinnerForecastWithPress state world | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBoss … | applyTimedDespawns fireStaticRemovals | digested |
| `activatorStates` | 1388 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBossForecast … | applyEarnedClears dropWorldIfBuiltStale activatorStateFor freshActivatorState | digested |
| `bridgeStates` | 1430 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | dropWorldIfBuiltStale bridgeStateFor freshVisitState | digested |
| `pushableStates` | 1431 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBossForecast … | dropWorldIfBuiltStale pushableStateFor freshVisitState | digested |
| `rockStates` | 1442 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast brokenRocks chaserForecast … | rockStateFor | digested |
| `burnStates` | 1454 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast burnedTrees chaserForecast … | burnStateFor | digested |
| `ropeStates` | 1482 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBossForecast … | ropeStateFor | digested |
| `fallRockStates` | 1592 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBossForecast … | fallRockStateFor | digested |
| `moonrockStates` | 1776 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | moonrockStateFor freshVisitState | digested |
| `crusherStates` | 1810 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBossForecast … | dropWorldIfBuiltStale crusherStateFor freshVisitState | digested |
| `bossStates` | 1869 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast bosses bossesWoken … | dropWorldIfBuiltStale bossStateFor freshVisitState | digested |
| `shieldBossStates` | 1924 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | dropWorldIfBuiltStale shieldBossStateFor freshVisitState | digested |
| `finalDoorStates` | 2177 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | dropWorldIfBuiltStale finalDoorStateFor freshVisitState | digested |
| `turretStates` | 2247 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBossForecast … | dropWorldIfBuiltStale turretStateFor freshVisitState | digested |
| `beamTowerStates` | 2386 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | beamTowerStateFor freshVisitState | digested |
| `magicalLockStates` | 2426 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | magicalLockStateFor | digested |
| `wandWindows` | 2472 | visit | progress spinnerForecastWithPress | advance slashInfo spinnerFightForecast | run.advance | digested |
| `chestStates` | 3655 | visit | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | chestStateFor freshVisitState | digested |
| `pulserStates` | 3679 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBossForecast … | pulserStateFor freshVisitState | digested |
| `spinnerStates` | 3764 | visit | spinnerForecastWithPress | advance chaserForecast entities spinnerBodies spinnerDeaths spinnerFightForecast … | dropWorldIfBuiltStale spinnerStateFor freshVisitState | digested |
| `grantsByLevel` | 5051 | player | progress | advance unfiredGrantLevels | applyGrantsFor | digested |
| `fireWindows` | 5472 | visit | progress spinnerForecastWithPress | advance slashInfo spinnerFightForecast | run.advance | digested |
| `pullsByLevel` | 8867 | visit | previewStepper | advance entities pulls | pullsFor | digested |
| `tileWritesByLevel` | 1231 | — | — | advance tileWrites | freshVisitState renderIgneousNow stepBulbGraphicNow | EXEMPT (UNREAD) |
| `igneousStates` | 1248 | — | — | advance entities igneousTiles | freshVisitState renderIgneousNow | EXEMPT (UNREAD) |
| `finalBossStates` | 1970 | — | — | advance finalBosses owlPods shakeWritersHere | dropWorldIfBuiltStale owlStateFor freshVisitState | EXEMPT (UNREAD) |
| `podStates` | 1982 | — | — | advance finalBosses owlPods shakeWritersHere | dropWorldIfBuiltStale owlStateFor freshVisitState | EXEMPT (UNREAD) |
| `placedGrenadeStates` | 2132 | — | — | advance grenadeForecast placedGrenades | dropWorldIfBuiltStale freshVisitState stepPlacedGrenadesNow | EXEMPT (UNREAD) |
| `lavaChainStates` | 2139 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepLavaChainsNow | EXEMPT (UNREAD) |
| `spinningAxeStates` | 2146 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepSpinningAxesNow | EXEMPT (UNREAD) |
| `owlRocks` | 2148 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepOwlNow | EXEMPT (UNREAD) |
| `owlGrenades` | 2149 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepOwlNow | EXEMPT (UNREAD) |
| `owlPendingRocks` | 2150 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepOwlNow | EXEMPT (UNREAD) |
| `owlPendingGrenades` | 2151 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepOwlNow | EXEMPT (UNREAD) |
| `watcherStates` | 2205 | — | — | advance watchers | dropWorldIfBuiltStale watcherStateFor freshVisitState | EXEMPT (UNREAD) |
| `blastStates` | 2294 | — | — | advance blastsInFlight | blastsFor enterWorld stepBlastsNow | EXEMPT (UNREAD) |
| `shooterStates` | 2338 | — | — | advance entities shooters spitForecast | shooterStateFor freshVisitState | EXEMPT (UNREAD) |
| `spitStates` | 2351 | — | — | advance entities shooters spitForecast | spitsFor freshVisitState enterWorld stepSpitsNow | EXEMPT (UNREAD) |
| `bombPusherStates` | 2361 | — | — | advance bombPushers chaserForecast entities spitForecast | bombPusherStateFor freshVisitState | EXEMPT (UNREAD) |
| `bombStates` | 2374 | — | — | advance bombs chaserForecast entities spitForecast | bombsFor freshVisitState enterWorld stepBombsNow | EXEMPT (UNREAD) |
| `wandShotStates` | 2458 | — | — | advance wandShotsLive | wandShotsFor enterWorld stepWandShotsNow | EXEMPT (UNREAD) |
| `bossShotStates` | 3015 | — | — | advance bossShots | bossShotsFor stepBossShotsNow | EXEMPT (UNREAD) |
| `arrowTrapStates` | 3702 | — | — | advance armedArrowTraps arrowForecast entities | arrowTrapStateFor | EXEMPT (UNREAD) |
| `sealPiece` | 3744 | — | — | advance sealPiece | freshVisitState stepChestsNow stepSealPieceNow | EXEMPT (UNREAD) |
| `wallFlyerStates` | 3788 | — | — | advance corridorBodyForecast wallFlyers | dropWorldIfBuiltStale wallFlyerStateFor freshVisitState | EXEMPT (UNREAD) |
| `drillStates` | 3820 | — | — | advance corridorBodyForecast drills | dropWorldIfBuiltStale drillStateFor freshVisitState | EXEMPT (UNREAD) |
| `staticBodyStates` | 4021 | — | — | advance entities spitForecast staticBodies | dropWorldIfBuiltStale staticBodyStateFor freshVisitState | EXEMPT (UNREAD) |
| `darkTrapStates` | 4072 | — | — | advance darkTraps entities | dropWorldIfBuiltStale darkTrapStateFor freshVisitState | EXEMPT (UNREAD) |
| `chaserStates` | 4111 | — | — | advance chaserForecast chasers entities strikeBodies | dropWorldIfBuiltStale chaserStateFor freshVisitState | EXEMPT (UNREAD) |
| `poleStates` | 4497 | — | — | advance darkTraps entities | poleStateFor freshVisitState | EXEMPT (UNREAD) |
| `talkerStates` | 14514 | — | — | advance entities talkCircles | dropWorldIfBuiltStale freshVisitState talkerStateFor | EXEMPT (UNREAD) |
| `lightsFights` | 15582 | — | previewStepper spinnerForecastWithPress | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | freshVisitState lightsFightFor | IN |
| `lightsExits` | 15584 | — | — | advance | freshVisitState stepLightsNow | EXEMPT (UNREAD) |
| `lightsSpearRepeats` | 15593 | — | — | advance | freshVisitState lightsSpearRepeatsNow lightsSlashNow | EXEMPT (UNREAD) |
