| site | function | class | owner | code | the throw's lead-in |
|---|---|---|---|---|---|
| `solverBot.js:202` | `assertTransitSamplesCarryEtas` | b-arg |  |  | ${}: a corridor validated with NO samples is a corridor  |
| `solverBot.js:206` | `assertTransitSamplesCarryEtas` | b-arg |  |  | ${}: the plan tick must be finite; got ${}. |
| `solverBot.js:212` | `assertTransitSamplesCarryEtas` | b-arg |  |  | ${}: sample ${} carries no absolute tick — an ETA that is  |
| `solverBot.js:216` | `assertTransitSamplesCarryEtas` | b-arg |  |  | ${}: sample ${} is at tick ${}, which does not  |
| `solverBot.js:223` | `assertTransitSamplesCarryEtas` | b-arg |  |  | ${}: ${} samples all landed inside one tick of  |
| `solverBot.js:11186` | `entities` | b-invariant | hammer |  | previewPressApproach: a previewed tick has no '${}' — the view  |
| `solverBot.js:12380` | `deriveFight` | b-arg | hammer |  | deriveFight: order "${}" is not astar, progress, stage or nearest |
| `botDriverV1.js:74` | `coastDistance` | b-invariant |  |  | coastDistance did not converge — friction no longer snaps to zero? |
| `hazards.js:371` | `hazardVolume` | b-arg |  |  | hazardVolume: "${}" has no transcribed volume. Every member  |
| `spaceTimeReach.js:122` | `coarseKey` | b-arg | hammer |  | spaceTimeReach.coarseKey: cell ${} is not a positive size |
| `spaceTimeReach.js:161` | `spaceTimeReach` | b-arg | hammer |  | spaceTimeReach: 'step' and 'safe' are required functions |
| `spaceTimeReach.js:164` | `spaceTimeReach` | b-arg | hammer |  | spaceTimeReach: horizon ${} is not a whole number of ticks |
| `spaceTimeReach.js:167` | `spaceTimeReach` | b-arg | hammer |  | spaceTimeReach: mode "${}" is neither 'survive' nor 'earliest' |
| `spaceTimeReach.js:170` | `spaceTimeReach` | b-arg | hammer |  | spaceTimeReach: the earliest mode answers "when is the goal first reached" — it needs a goal |
| `spaceTimeReach.js:173` | `spaceTimeReach` | b-arg | hammer |  | spaceTimeReach: shouldStop must be a function () => boolean or null |
| `solveProgress.js:112` | `installOf` | b-arg |  |  | ${}: onProgress must be a function (site, peek) => void, got ${} |
| `r8Acceptance.js:3181` | `assertTwoPassPrefixAgrees` | b-invariant |  |  | ${}: pass 1 and pass 2 must both hand over their per-tick key  |
| `r8Acceptance.js:3185` | `assertTwoPassPrefixAgrees` | b-arg |  |  | ${}: the declared tick must be a non-negative integer; got  |
| `r8Acceptance.js:3195` | `assertTwoPassPrefixAgrees` | b-invariant |  |  | ${}: pass 1 spent only ${} tick(s) but the clear  |
| `r8Acceptance.js:3200` | `assertTwoPassPrefixAgrees` | b-invariant |  |  | ${}: pass 2 spent only ${} tick(s) and the clear  |
| `r8Acceptance.js:3208` | `assertTwoPassPrefixAgrees` | b-invariant |  |  | ${}: pass 1 and pass 2 DISAGREE at tick ${}, below the  |
| `combat.js:810` | `place` | b-arg |  |  | combatCensus: "${}" has no 'ctor' offset. Read its  |
| `combat.js:818` | `place` | b-invariant |  |  | combatCensus: "${}" placement disagreement — the  |
| `combat.js:1233` | `plannerContactFree` | b-arg |  |  | plannerContactFree: needs a body. The whole question is about the  |
| `combat.js:1237` | `plannerContactFree` | a-gap |  |  | plannerContactFree: "${}" is not an on-screen  |
| `ghostSword.js:110` | `ghostSlashHitTicksFor` | b-arg |  |  | ghostSlashHitTicksFor: unknown slash animation ${}; know  |
| `levelRun.js:1140` | `recordFor` | a-gap |  |  | levelRun: despawn names [${}] in level  |
| `levelRun.js:1605` | `publishRopeGroup` | a-gap |  |  | levelRun: ${} in level ${} boots PULLED (its  |
| `levelRun.js:1668` | `publishRopeGroup` | a-gap |  |  | levelRun: ${}'s ring reaches  |
| `levelRun.js:1682` | `publishRopeGroup` | a-gap |  |  | levelRun: ${} landed on the player at tick  |
| `levelRun.js:1969` | `owlStateFor` | a-gap |  |  | levelRun: level ${} holds a finalboss but no pod at  |
| `levelRun.js:2024` | `owlStreamFor` | a-gap |  |  | levelRun: the Owl's draw stream was opened in level  |
| `levelRun.js:2048` | `owlStreamFor` | a-gap |  |  | levelRun: the Owl's draw stream would open in level ${}  |
| `levelRun.js:2065` | `owlStreamFor` | a-gap |  |  | levelRun: the Owl stream's level build spent  |
| `levelRun.js:2447` | `assertWandShotSolidsBound` | a-gap |  |  | levelRun: level ${} holds a LavaBoss-typed entity  |
| `levelRun.js:2464` | `assertWandShotSolidsBound` | a-gap |  |  | levelRun: a WandShot in level ${} would collide with  |
| `levelRun.js:2473` | `assertWandShotSolidsBound` | a-gap |  |  | levelRun: level ${} holds an IceTurret and a WandShot at  |
| `levelRun.js:2501` | `assertWandSpawnUnclamped` | a-gap |  |  | levelRun: the wand press at tick ${} fires at tick  |
| `levelRun.js:3178` | `assertScratchSlotIsFree` | b-invariant |  |  | levelRun: the scratch persistence layer was about to self-declare  |
| `levelRun.js:3326` | `firePendingKillLockThrows` | a-gap |  |  |  |
| `levelRun.js:3734` | `wallFlyerStateFor` | a-gap |  |  | levelRun: level ${} holds wallflyer(s) AND an entity of type  |
| `levelRun.js:3784` | `stageDrillKill` | a-gap |  |  | levelRun: the ${} kill of ${} in level ${} at tick ${}  |
| `levelRun.js:3801` | `stageWallFlyerKill` | a-gap |  |  |  |
| `levelRun.js:3814` | `stageWallFlyerKill` | a-gap |  |  | levelRun: the ${} kill of ${} in level ${} at tick ${} moves  |
| `levelRun.js:4017` | `darkTrapStateFor` | a-gap |  |  | levelRun: ${}@${},${} in level ${} stands within  |
| `levelRun.js:4200` | `assertChaserSolidsBound` | a-gap |  |  | levelRun: level ${} holds a bridged chaser AND  |
| `levelRun.js:4238` | `assertChaserSolidsBound` | a-gap |  |  | levelRun: level ${} holds a bridged chaser AND  |
| `levelRun.js:4804` | `settleCameraForLoad` | a-gap |  |  | levelRun: Game.shake is ${} at a level load in level  |
| `levelRun.js:4870` | `assertWitnessCamera` | a-gap |  |  | levelRun: the witnessed game camera (${}, ${}) at tick ${} is not  |
| `levelRun.js:4877` | `assertWitnessCamera` | b-invariant |  |  | levelRun: the witnessed game camera (${}, ${}) at tick ${} lies  |
| `levelRun.js:4902` | `onScreenNow` | a-gap |  |  | levelRun: whether ${} is on screen at tick  |
| `levelRun.js:5264` | `drainEquipChecks` | b-tape |  |  | levelRun: the tape equips slot ${} at tick ${}, but the run holds  |
| `levelRun.js:5306` | `equipNow` | b-tape |  |  | levelRun: the tape already equips slot  |
| `levelRun.js:5470` | `weaponForPress` | b-tape |  |  | levelRun: the tape presses X with slot ${} holding the  |
| `levelRun.js:5476` | `weaponForPress` | b-tape |  |  | levelRun: the tape presses X with slot ${} holding item  |
| `levelRun.js:5700` | `assertDialogueFreeSpinnerRoom` | a-gap |  |  | levelRun: level ${} holds live spinners AND a DIALOGUED  |
| `levelRun.js:5762` | `assertCrusherSolidsBound` | a-gap |  |  | levelRun: level ${} holds ${} crusher(s) AND  |
| `levelRun.js:5781` | `assertSpinnerSolidsBound` | a-gap |  |  | levelRun: level ${} holds ${} spinner(s) AND  |
| `levelRun.js:5926` | `applyFire` | a-gap |  |  | levelRun: the fire press at tick ${} in level  |
| `levelRun.js:5941` | `applyFire` | a-gap |  |  | levelRun: the fire press at tick ${} reaches  |
| `levelRun.js:5975` | `applyFire` | a-gap |  |  | levelRun: the fire press at tick ${} reaches  |
| `levelRun.js:6000` | `applyFire` | a-gap |  |  | levelRun: the fire press at tick ${} reaches  |
| `levelRun.js:6048` | `applyFire` | a-gap |  |  | levelRun: 'FIRE_ARM_POLICY' calls ${} modelled and  |
| `levelRun.js:6092` | `applyThrust` | a-gap |  |  | levelRun: a ghostsword press routes the slash rect through  |
| `levelRun.js:6098` | `applyThrust` | a-gap |  |  | levelRun: the ghostsword press at tick ${} in level ${}: ${} |
| `levelRun.js:6182` | `applyThrust` | a-gap |  |  | levelRun: the ghostsword press at tick ${} in level ${} reaches  |
| `levelRun.js:6193` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${} in level  |
| `levelRun.js:6226` | `applyThrust` | a-gap |  |  | levelRun: the press at tick ${} reaches  |
| `levelRun.js:6248` | `applyThrust` | a-gap |  |  | levelRun: the press at tick ${} reaches  |
| `levelRun.js:6372` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${}  |
| `levelRun.js:6444` | `applyThrust` | a-gap |  |  | levelRun: the kill of ${} in level  |
| `levelRun.js:6453` | `applyThrust` | a-gap |  |  | levelRun: the kill of ${} at tick  |
| `levelRun.js:6513` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${}  |
| `levelRun.js:6581` | `applyThrust` | a-gap |  |  | levelRun: the ShieldBoss kill in level  |
| `levelRun.js:6589` | `applyThrust` | a-gap |  |  | levelRun: the ShieldBoss kill at tick  |
| `levelRun.js:6643` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${}  |
| `levelRun.js:6741` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${}  |
| `levelRun.js:6827` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${}  |
| `levelRun.js:6851` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick  |
| `levelRun.js:6906` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${} reaches  |
| `levelRun.js:6949` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${} reaches ${} in  |
| `levelRun.js:6971` | `applyThrust` | a-gap |  |  | levelRun: ${} dies to the ${} press at tick ${} and  |
| `levelRun.js:6987` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${} KILLS ${}, whose  |
| `levelRun.js:7037` | `applyThrust` | a-gap |  |  | levelRun: the ${} press at tick ${}  |
| `levelRun.js:7158` | `applyThrust` | a-gap |  |  | levelRun: a press killed ${} in level  |
| `levelRun.js:7233` | `stepChestsNow` | b-invariant |  |  | levelRun: ${} in level ${} opened with  |
| `levelRun.js:7242` | `stepChestsNow` | b-invariant |  |  | levelRun: a second SealPiece spawned while one was  |
| `levelRun.js:7657` | `stepDarkTrapsNow` | a-gap |  |  | levelRun: ${}'s light is ${}–${} px from ${}  |
| `levelRun.js:7680` | `stepDarkTrapsNow` | a-gap |  |  | levelRun: ${} finishes "die1" at tick ${} and carries no  |
| `levelRun.js:7690` | `stepDarkTrapsNow` | a-gap |  |  | levelRun: ${}'s removal in level ${} at tick ${} moves  |
| `levelRun.js:8049` | `onScreenAt` | a-gap |  |  | chaserForecast: whether ${} is on screen depends on  |
| `levelRun.js:8556` | `applyArrowHit` | a-gap |  |  | levelRun: ${} is a static body whose 'knockback' moves it,  |
| `levelRun.js:8562` | `applyArrowHit` | a-gap |  |  | levelRun: ${} dies to ${} at tick ${}  |
| `levelRun.js:8721` | `stepPullsNow` | a-gap |  |  | levelRun: level ${} holds ${} Pull(s) AND pushable  |
| `levelRun.js:8732` | `stepPullsNow` | a-gap |  |  | levelRun: ${} overlaps ${} at tick  |
| `levelRun.js:8747` | `stepPullsNow` | a-gap |  |  | levelRun: ${} pushed the player INTO a solid at  |
| `levelRun.js:8917` | `stepCrushersNow` | a-gap |  |  | levelRun: ${} in level ${} has tset ${}, not -1.  |
| `levelRun.js:9068` | `stepSpitsNow` | a-gap |  |  | levelRun: level ${} has a TurretSpit and an IceTurretBlast  |
| `levelRun.js:9083` | `onScreen` | a-gap |  |  | levelRun: whether a TurretSpit is culled at tick  |
| `levelRun.js:9155` | `stepWandShotsNow` | a-gap |  |  | levelRun: a wand shot is in flight while the camera  |
| `levelRun.js:9218` | `applyWandShotToBoss` | a-gap |  |  | levelRun: a wand shot (${}) reached the enemy  |
| `levelRun.js:9306` | `stepBossShotsNow` | a-gap |  |  | levelRun: the BossTotemShot ${} acted on the player  |
| `levelRun.js:9705` | `stepOwlNow` | a-gap |  |  | levelRun: the player is inside ${}'s 16x16 cell at tick  |
| `levelRun.js:9726` | `stepOwlNow` | b-tape |  |  | levelRun: the tape holds 'primary' across tick  |
| `levelRun.js:9901` | `stepOwlNow` | a-gap |  |  | levelRun: the Owl's body touched the player at tick  |
| `levelRun.js:9939` | `stepOwlNow` | a-gap |  |  | levelRun: the player's box overlaps the Owl's CORPSE at  |
| `levelRun.js:9987` | `stepOwlNow` | a-gap |  |  | levelRun: the Owl's tick ${} took phase  |
| `levelRun.js:10036` | `assertGrenadeRemovalOpensNothing` | a-gap |  |  | levelRun: ${}'s removal at tick ${} OPENS  |
| `levelRun.js:10081` | `assertFinalBossLineOfSight` | a-gap |  |  | levelRun: the swing at (${}, ${}) reaches  |
| `levelRun.js:10157` | `stepSpinnerContactsNow` | a-gap |  |  | levelRun: at tick ${} the player box at  |
| `levelRun.js:10253` | `assertSpinnerLineOfSight` | a-gap |  |  | levelRun: the swing at (${}, ${}) reaches  |
| `levelRun.js:10284` | `assertSpinnerKillIsAccounted` | a-gap |  |  | levelRun: a Spinner kill in level ${} happens in a  |
| `levelRun.js:10388` | `assertSpinnerRemovalIsDeclared` | a-gap |  |  | levelRun: ${}'s removal in level ${} happens in a  |
| `levelRun.js:10455` | `assertShieldBossLineOfSight` | a-gap |  |  | levelRun: the swing at (${}, ${}) reaches  |
| `levelRun.js:10580` | `assertNoCeremonyBesideShieldBoss` | a-gap |  |  | levelRun: a ${} ceremony began in level ${} while  |
| `levelRun.js:10647` | `applyPlayerHit` | a-gap |  |  | levelRun: the '${}' hit (${}) at tick  |
| `levelRun.js:10748` | `stepLavaChainsNow` | a-gap |  |  | levelRun: the player touches ${}'s arm at tick ${} in level  |
| `levelRun.js:10766` | `stepLavaChainsNow` | a-gap |  |  | levelRun: ${} touches ${}'s arm at tick ${}  |
| `levelRun.js:10773` | `stepLavaChainsNow` | a-gap |  |  | levelRun: ${}'s arm touches the stepped ${} AND the census  |
| `levelRun.js:10841` | `stepSpinningAxesNow` | a-gap |  |  | levelRun: the player is within ${}'s reach at tick ${} in level  |
| `levelRun.js:10849` | `stepSpinningAxesNow` | a-gap |  |  | levelRun: ${}'s ${} hits the player at tick ${} in level  |
| `levelRun.js:11007` | `stepContactsNow` | a-gap |  |  | levelRun: the player is standing inside ${} in level  |
| `levelRun.js:11022` | `stepContactsNow` | a-gap |  |  | levelRun: the player is standing inside ${} in level  |
| `levelRun.js:11247` | `retaliateIntoChaser` | b-invariant |  |  | levelRun: the dark suit's retaliation KILLS ${} through its  |
| `levelRun.js:11332` | `assertChaserRemovalIsDeclared` | a-gap |  |  | levelRun: ${}'s death (${}) in level ${} happens  |
| `levelRun.js:11427` | `assertChaserRemovalIsDeclared` | a-gap |  |  |  |
| `levelRun.js:11734` | `assertNoCeremonyBesideLiveWallFlyer` | a-gap |  |  | levelRun: a ${} ceremony began in level ${} beside  |
| `levelRun.js:11938` | `startBulbDrop` | a-gap |  |  | levelRun: ${} in level ${} was killed and then ${} on its armed update (tick ${}).  |
| `levelRun.js:12505` | `assertNoCeremonyBesideLiveChaser` | a-gap |  |  | levelRun: a ${} ceremony began in level ${} while  |
| `levelRun.js:12614` | `assertNoUnsteppedCeremonyShove` | a-gap |  |  | levelRun: a ${} ceremony began in level ${} with ${} inside the moving  |
| `levelRun.js:12632` | `stepShootersNow` | a-gap |  |  | levelRun: level ${} holds a Turret and an IceTurret —  |
| `levelRun.js:12764` | `drainBombBlastsNow` | a-gap |  |  | levelRun: the Explosion of ${} at (${}, ${}) on tick  |
| `levelRun.js:12775` | `drainBombBlastsNow` | a-gap |  |  | levelRun: the Explosion of ${} at (${}, ${}) on tick  |
| `levelRun.js:12784` | `drainBombBlastsNow` | a-gap |  |  | levelRun: the Explosion of ${} at (${}, ${}) on tick  |
| `levelRun.js:12840` | `stepBeamTowersNow` | a-gap |  |  | levelRun: the player at (${}, ${}) is inside ${}'s drift band at  |
| `levelRun.js:12849` | `stepBeamTowersNow` | a-gap |  |  | levelRun: the player at (${}, ${}) is where ${}'s beam can  |
| `levelRun.js:12899` | `blockedAt` | a-gap |  |  | levelRun: the IceTurret corpse ${} slides  |
| `levelRun.js:12939` | `retaliate` | b-invariant |  |  | levelRun: the dark suit's retaliation KILLS ${}  |
| `levelRun.js:13308` | `ceremonyFor` | a-gap |  |  | levelRun: the "${}" pickup at (${},${}) in  |
| `levelRun.js:13319` | `ceremonyFor` | a-gap |  |  | levelRun: the player is standing on a "${}" pickup  |
| `levelRun.js:13443` | `resolveButtonFalls` | a-gap |  |  | levelRun: a button in level ${} drops [${}]  |
| `levelRun.js:13458` | `resolveButtonFalls` | a-gap |  |  | levelRun: [${}] landed on the player at tick  |
| `levelRun.js:13635` | `applyLockEvents` | a-gap |  |  | levelRun: ${} in level ${} snapped the  |
| `levelRun.js:13655` | `applyLockEvents` | a-gap |  |  | levelRun: ${} in level ${}  |
| `levelRun.js:13777` | `runFrozenTick` | a-converted |  | FROZEN_TICK_PRESS | levelRun: a fire window's hit tick  |
| `levelRun.js:13785` | `runFrozenTick` | a-converted |  | FROZEN_TICK_PRESS | levelRun: a ${} press at tick  |
| `levelRun.js:13818` | `runFrozenTick` | a-gap |  |  | levelRun: a button is pressed DURING ${} at tick  |
| `levelRun.js:14015` | `stepWatchersNow` | a-gap |  |  | levelRun: the stance overlaps the Watcher's LIVE  |
| `levelRun.js:14158` | `spawnLine` | b-arg |  |  | levelRun: '${}' has no parseable spawn line in  |
| `levelRun.js:14262` | `stepTalkersNow` | a-gap |  |  | levelRun: the walk opens '${}''s dialogue at tick  |
| `levelRun.js:14545` | `stepMoonrocksNow` | a-gap |  |  | levelRun: level ${} holds ${} moonrocks. 'beam' and  |
| `levelRun.js:14564` | `stepMoonrocksNow` | a-gap |  |  | levelRun: the moonrock freezes level ${} at tick  |
| `levelRun.js:14590` | `after` | b-invariant |  |  | levelRun: the moonrock never released its freeze |
| `levelRun.js:14633` | `after` | b-invariant |  |  | levelRun: the moonrock's release frame produced a  |
| `levelRun.js:14821` | `stepBobBossArenaNow` | a-gap |  |  | levelRun: a BobBossNPC dialogue and a pickup ceremony are  |
| `levelRun.js:14914` | `after` | b-invariant |  |  | levelRun: the BobBoss rock's release frame produced a  |
| `levelRun.js:15982` | `entities` | b-arg |  |  | levelRun.entities: unknown entity family ${} —  |
| `levelRun.js:15997` | `progress` | b-arg |  |  | levelRun.progress: unknown progress field ${} —  |
| `levelRun.js:16011` | `ledger` | b-arg |  |  | levelRun.ledger: unknown ledger kind ${} —  |
| `levelRun.js:16390` | `spinnerForecastWithPress` | b-arg | hammer |  | levelRun.spinnerForecastWithPress: pressAt ${} is not a tick at or  |
| `levelRun.js:16397` | `pointAt` | b-arg | hammer |  | levelRun.spinnerForecastWithPress: no player position for the hit test  |
| `levelRun.js:16548` | `advance` | b-arg |  |  | levelRun.spinnerFightForecast: no player position for the hit  |
| `levelRun.js:16601` | `snap` | b-arg | hammer |  | levelRun.spinnerFightForecast: no row ${} to fork at |
| `levelRun.js:16606` | `fork` | b-arg | hammer |  | levelRun.spinnerFightForecast: row ${} not reached |
| `levelRun.js:16745` | `gameTimeAt` | b-arg |  |  | levelRun.gameTimeAt: ${} is not a forecast  |
| `levelRun.js:17223` | `liveGeometryOpts` | b-arg |  |  | levelRun.liveGeometryOpts: this run is noclip — the  |
| `levelRun.js:17745` | `previewStepper` | b-arg |  |  | levelRun.previewStepper: this run is noclip — the  |
| `levelRun.js:18423` | `takeApItem` | b-invariant |  |  | levelRun.takeApItem: ${} was reported taken in level ${},  |
| `levelRun.js:18723` | `advance` | a-gap |  |  | levelRun: a button-dropped fallrock's frozen tick in level ${},  |
| `levelRun.js:18756` | `advance` | a-gap |  |  | levelRun: a button-dropped fallrock's release frame at tick  |
| `levelRun.js:18888` | `advance` | b-tape |  |  | levelRun: the tape asks for tick ${},  |
| `levelRun.js:18920` | `advance` | b-tape |  |  | levelRun: the tape holds ${} at  |
| `levelRun.js:18996` | `advance` | b-tape |  |  | levelRun: the tape holds ${} at  |
| `levelRun.js:19015` | `advance` | b-tape |  |  | levelRun: an X release at tick ${}  |
| `levelRun.js:19081` | `advance` | a-gap |  |  | levelRun: a placed NPC's dialogue and a pickup  |
| `levelRun.js:19097` | `advance` | a-gap |  |  | levelRun: a Watcher's dialogue and a pickup  |
| `levelRun.js:19126` | `advance` | a-gap |  |  | levelRun: a SealController and a pickup ceremony  |
| `levelRun.js:19152` | `advance` | a-gap |  |  | levelRun: the moonrock's freeze and a pickup ceremony  |
| `levelRun.js:19211` | `advance` | a-gap |  |  | levelRun: the Owl's intro freeze and a pickup  |
| `levelRun.js:19503` | `advance` | a-gap |  |  | levelRun: a plain Seed collected in level  |
| `levelRun.js:19524` | `advance` | a-gap |  |  | levelRun: a Seed ceremony finished on the  |
| `levelRun.js:19754` | `advance` | a-gap |  |  | levelRun: a BossTotem is awake while a  |
| `levelRun.js:20051` | `advance` | a-converted |  | FROZEN_TICK_PRESS | levelRun: a 'primary' press at tick ${}  |
| `levelRun.js:20216` | `advance` | a-gap |  |  | levelRun: the freeze-clearing frame at tick  |
| `levelRun.js:20308` | `advance` | b-invariant |  |  | levelRun: a fire press at tick ${}  |
| `levelRun.js:20328` | `advance` | b-invariant |  |  | levelRun: a wand press at tick ${}  |
| `levelRun.js:20566` | `advance` | a-gap |  |  | levelRun: the player died (${}) at tick  |
| `levelRun.js:20630` | `advance` | a-gap |  |  | levelRun: the run crossed from level  |
| `beamTower.js:56` | `createBeamTower` | b-arg |  |  | createBeamTower: pass the level size in pixels — the beam ends at  |
| `spinningAxe.js:105` | `axeHitsPlayer` | b-arg |  |  | axeHitsPlayer: ${} is not an update count — the angle  |
| `levelWorld.js:4990` | `buildLevelWorld` | a-gap |  |  | levelWorld: level ${}'s '${}' at  |
| `levelWorld.js:5001` | `buildLevelWorld` | b-invariant |  |  | levelWorld: '${}' is a talker but its class  |
| `pull.js:76` | `createPulls` | b-arg |  |  | pull: pull@${},${} carries force "${}" / direction  |
| `dialogue.js:157` | `beginDialogue` | b-arg |  |  | beginDialogue: a ceremony with no pages cannot end |
| `swimSoundClock.js:126` | `createPinnedChannel` | b-arg |  |  | createPinnedChannel: lengthFrames must be a positive  |
| `swimSoundClock.js:137` | `stepChannel` | b-arg |  |  | stepChannel: frames must be a non-negative integer, got ${} |

totals: a-converted 3 · a-gap 128 · b-arg 36 · b-invariant 20 · b-tape 9
