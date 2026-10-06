/**
 * THE SOLVER'S IMPORT DOOR — every simulation symbol the Seedling solver
 * family imports, re-exported from ONE module (engine-prep slice C2).
 *
 * The solver family (`solverBot.js`, `director.js` and the files they pull in
 * that the simulation does not: the list is `family` in
 * `scripts/procgen/seedling-solver-surface.json`) reaches the simulation two
 * ways: through the run object `createLevelRun` returns, and through static
 * imports. This module is the second way's single door. A family file
 * imports a simulation symbol from here, never from the simulation module
 * that defines it.
 *
 * What it is NOT:
 *   - not a wrapper: every line is `export { … } from './<module>.js'`, so a
 *     name imported through the door is the very binding the defining module
 *     exports (live, same identity) and a solve is byte-identical either way;
 *   - not the contract: `seedling-solver-surface.json` is. It classes each
 *     symbol `physics` or `seedling` and names the family files that use it;
 *     the comment over each block below is that row set summarised
 *     (`<module> — <family files> · <class split>`).
 *
 * The rules, gated by `scripts/procgen/seedlingSolverSurface.test.js`:
 *   - a family file may import a `seedlingDemo` module only if it is another
 *     family file or this one;
 *   - this module exports only what some family file imports (an unused
 *     export is RED "must be RETIRED"), and imports only simulation modules.
 *
 * Adding a symbol: the contract table row comes first. Add the export here,
 * import it in the family file, run `node
 * scripts/procgen/census-seedling-solver-surface.mjs --write`, then read the
 * symbol's definition and fill in the new row's class, form and why
 * (docs/json/developer/procgen/seedling-solver-surface.md § The import door).
 *
 * ⚠ One rename: `burnableTree.js` and `breakableRocks.js` both export a
 * `WAIT_AFTER_PRESS_TICKS`, and they are different numbers for different
 * mechanics (a rock's shatter window against a tree's burn animation). The
 * door exports the rock's under its own name and the tree's pair under the
 * `BURN_` names `botDriverV2.js` already gave them.
 */

// activators.js — botDriverV2, solverBot · seedling 10
export {
    fallRocksArmedBy, groupResponders, KEY_RESPONDERS, keyLineTouches, localPublish, opensOnKeyTick,
    opensOnTick, RESPONDERS, TOUCH_RESPONDERS, touchApproachKey,
} from './activators.js';
// arrowTrap.js — dangerMap, solverBot · seedling 6
export { ARROW, arrowLaneForPlacement, arrowLaneRect, arrowRect, arrowTrapFires, stepArrow } from './arrowTrap.js';
// breakableRocks.js — botDriverV2, solverBot · seedling 3
export { assertWaitCovers, rockBreaksUnder, WAIT_AFTER_PRESS_TICKS } from './breakableRocks.js';
// bridges.js — botDriverV2 · seedling 1
export { TICKS_FROM_PRESS_TO_WALKABLE } from './bridges.js';
// burnableTree.js — botDriverV2 · seedling 2
export {
    HIT_TO_GONE_TICKS as BURN_HIT_TO_GONE_TICKS, WAIT_AFTER_PRESS_TICKS as BURN_WAIT_AFTER_PRESS_TICKS,
} from './burnableTree.js';
// camera.js — encounters · physics 2
export { SCREEN_H, SCREEN_W } from './camera.js';
// chasers.js — dangerMap, solverBot · seedling 4
export { bridgedChaserTags, chaserBoxAt, chaserHasSword, isBridgedChaser, killWindowTicks } from './chasers.js';
// chest.js — botDriverV2, solverBot · seedling 3
export { CHEST, chestProbeLine, chestStanceBand } from './chest.js';
// combat.js — dangerMap, encounters, solverBot, strikePolicy · seedling 9
export {
    contactPricing, contactRect, ENEMY_CLASSES, KILL_CADENCE_FLOOR, KILL_LOCK_TAGS, KILL_LOCK_TSET,
    plannerContactFree, pressesFor, stepBoundFor,
} from './combat.js';
// combatVerbs.js — botDriverV2, solverBot, strikePolicy · seedling 11
export {
    DASH_CHAIN, DASH_DISPLACEMENT, KILL_PRESS_CADENCE, ORDINARY_SWING_PERIOD, SLASH_ANIM_TICKS, SLASH_DASH_FORCE,
    SLASH_SCALE_NORMAL, slashPressForecast, slashScaleFor, slashSet, slashTimerTick,
} from './combatVerbs.js';
// crusher.js — botDriverV2 · seedling 1
export { collideLineSolid, scanCrusher } from './crusher.js';
// endingChain.js — strikePolicy · seedling 1
export { TALK_RANGE } from './endingChain.js';
// enemyDamage.js — solverBot, strikePolicy · seedling 3
export { KILL_ARM_POLICY, MOBILE_DEATH_FADE, STATIC_ARROW_DEATH, killArmModelled } from './enemyDamage.js';
// killLockBodies.js — solverBot · seedling 1
export { KILLLOCK_BODIES } from './killLockBodies.js';
// fireVerb.js — botDriverV2 · seedling 2
export { FIRE_WINDOW, fireRect } from './fireVerb.js';
// iceTurret.js — botDriverV2 · seedling 2
export { ICE_TURRET, ICE_TURRET_PLAN } from './iceTurret.js';
// ⛓ U15-swim D2: the turret spit's box, for `dangerMap.spitDanger`'s WAIT sweep.
export { TURRET_SPIT } from './turret.js';
// levelRun.js — botDriverV2 · physics 1
export { createLevelRun } from './levelRun.js';

// ⛓ LADDER2: the clamped `FP.elapsed` the chain's and the beam's Spritemaps step at (`hazards.js`).
export { FP_ELAPSED_CLAMPED } from './r6AnimClock.js';
// levelWorld.js — botDriverV2, dangerMap, hazards, solverBot, strikePolicy · seedling 3, physics 6
export {
    assertRect, isNormalizedLiveOpts, LIVE_GEOMETRY_KEYS, normalizeLiveOpts, PRE_R5_ROLES, rect, rectsOverlap,
    RELAXED_ROLES, TILE_SIZE,
} from './levelWorld.js';
// playerPhysicsV1.js — botDriverV1, botDriverV2, mover, solverBot, strikePolicy · physics 11
export {
    applyFriction, applyInput, DEFAULT_FRICTION, groundTerrain, HITBOX, knockbackImpulse, MOVE_SPEEDS,
    spawnFromBoot, step, sweepAxis, WALK_SPEED,
} from './playerPhysicsV1.js';
// playerPhysicsV2.js — botDriverV2, encounters, solverBot · seedling 1, physics 3
export { fallDestination, PhysicsV2Error, playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
// presses.js — botDriverV2, solverBot, strikePolicy · seedling 10, physics 5
export {
    auditFire, DARK_SWORD_DAMAGE, distanceRectPoint, DOWN, EMPTY_SWORD_WINDOW, LEFT, RIGHT, SLASH_HIT_TICKS, SLASH_REACH,
    slashReachFor, slashRect, SWORD_DAMAGE, swordWindowReplace, swordWindowSchedule, swordWindowStep, UP,
} from './presses.js';
// pull.js — solverBot · seedling 2
export { pullModelled, pullsDrainingInto } from './pull.js';
// pulser.js — solverBot · seedling 3
export { PULSER, pulsePushes, pulserCycle } from './pulser.js';

// ⛓ SEEDLING FIDELITY LADDER2: the placed grenade's fuse and blast (`dangerMap.grenadeDanger`).
export { PLACED_GRENADE, blastReaches, createPlacedGrenade, stepPlacedGrenade } from './placedGrenade.js';
// pushables.js — solverBot · seedling 2
export { DESTROYING_TILE_TYPES, newPushable } from './pushables.js';
// shieldBossFight.js — solverBot · seedling 4
export { SHIELD_BOSS, shieldBossBandRect, shieldBossBodyRect, shieldBossDeathSchedule } from './shieldBossFight.js';
// spinner.js — botDriverV2, dangerMap, solverBot · seedling 5
export {
    enemiesUnseenByBlockSweep, hammerHitsPlayer, MODELLED_ENEMY_CLASSES, SPINNER, spinnerRect,
} from './spinner.js';
// tapeFormat.js — botDriverV1, botDriverV2, decisionTrace · seedling 1, physics 7
export {
    assertTapeWithinRuntimeBudget, coerceTerrainState, GAME_VISIBLE_DROPS, heldKeysAt, INVENTORY_ITEM_IDS,
    KEY_CODES, KEY_NAMES, LEVEL_COUNT, requiredTapeVersion, serializeTape,
} from './tapeFormat.js';
