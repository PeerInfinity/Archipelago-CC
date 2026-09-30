/**
 * seedlingDemo/seedlingProfile — **THE ONE REGISTRY OF SEEDLING'S PHYSICS AND
 * RULE CONSTANTS** (engine-prep arc, slice A2; plan
 * `seedling-engine-prep-plan.md` §7). The convention is RWK's physics
 * profile, without overrides: every value below is the literal its declaring
 * module used to spell, and every declaring module still exports its old name,
 * now read from here (`export const WALK_SPEED = PROFILE.walkSpeed; // dMS`).
 * Moving a declaration moved no arithmetic, so every committed tape,
 * expectation and solve is byte-identical across the move.
 *
 * ── WHAT IS IN IT ──────────────────────────────────────────────────────
 *
 * Every named top-level scalar the constants census classes `physics` or
 * `rule` (`docs/json/developer/procgen/seedling-constants.md`), plus the
 * literals of the player's own small tables in `playerPhysicsV1/V2.js`
 * (`HITBOX`, `TILE`, `SPAWN_OFFSET`, `LEVEL0_WORLD`, `MOVE_SPEEDS`'s one
 * divisor, `CHECK_OFFSET_Y`'s inset, `NO_BOUNCE_STATES`). The entity tables
 * stay where they are, and a DERIVED constant (`CLAMP`, `CHECK_OFFSET_Y`,
 * `TICKS_PER_TILE` …) stays derived in its module — a derived value is
 * computed in code from profile fields, never stored here.
 *
 * ── THE SHAPE ──────────────────────────────────────────────────────────
 *
 *   `PROFILE`         FLAT and numbers only, one key per value. The key is
 *                     today's name in camelCase (`WALK_SPEED` → `walkSpeed`;
 *                     a table field `HITBOX.originY` → `hitboxOriginY`; an
 *                     array element `NO_BOUNCE_STATES[1]` → `noBounceStates1`;
 *                     a divisor or inset inside a derivation is named for
 *                     its role, `moveSpeeds25Divisor`). A name declared in
 *                     several files is ONE key, and so is a pair whose keys
 *                     would collide and whose values and AS3 source agree
 *                     (`HITBOX_ORIGIN_X` / `HITBOX.originX`, `TILE_W` /
 *                     `TILE.w`); `alsoIn` names the other declarations.
 *                     Values keep their source spelling (`0x48000000`).
 *   `PROFILE_FIELDS`  one record per key, in `PROFILE`'s order: the census
 *                     class and kind, the AS3 anchor (`File.as:name`), how
 *                     the anchor's literal is found when it is not a
 *                     numeric `const`/`var` declaration (`as3Match`:
 *                     `'arg:<n>'` a constructor call's n-th argument,
 *                     `'param'` a parameter default, `'after:<text>'` the
 *                     number right after the one occurrence of `<text>`), the
 *                     declaration it came from, and the census note
 *                     (`review` is true exactly when that note starts
 *                     `REVIEW:`). Strings and booleans only — no numbers, so
 *                     the census sees this table's literals once, in
 *                     `PROFILE`.
 *   `profileDump()`   the canonical text: one `"<key>": <value>` line per
 *                     field in `PROFILE_FIELDS` order, inside braces, with a
 *                     final newline. A value prints as its SHORTEST
 *                     round-trip double (`JSON.stringify`), which is exact —
 *                     so the dump is JSON and parses back to `PROFILE`.
 *   `profileMd5()`    md5 of the dump: the profile's IDENTITY. `PROFILE_ID`
 *                     is a name; two profiles are the same when their md5s
 *                     are. `seedlingProfile.test.js` pins it as a literal —
 *                     a change there is a physics change.
 *   `profileStamp()`  `{id, md5}`, the shape of a v13 tape's model-only
 *                     `profile` field (`tapeEnvelope.validateProfile`).
 *
 * Dependency-free apart from `md5.js`, and browser-safe (no `fs`, no
 * `process`): the dependency-free modules (`tapeFormat.js`, `levelWorld.js`,
 * `flashPanel/seedlingSemantics.js`) import it without taking on anything
 * else, and since it imports nothing of the simulation no cycle can form.
 */

import { md5 } from './md5.js';

/** The profile's NAME. The md5 is its identity. */
export const PROFILE_ID = 'seedling-js-2026';

/** Every physics and rule constant, by key. See the docblock. */
export const PROFILE = Object.freeze({
    // ── seedlingSemantics.js
    seedlingTileSize: 16,
    // ── bossTotemFight.js
    headPosX: 0,
    // ── breakableRocks.js
    tagsPerLevel: 30,
    fpMaxElapsed: 0.0333,
    waitAfterPressTicks: 20,
    // ── bridges.js
    bridgeTimerMax: 60,
    bridgeState: 29,
    onScreenRadius: 64,
    ticksFromPressToWalkable: 60,
    // ── camera.js
    screenW: 160,
    screenH: 160,
    cameraSpeedDivisor: 10,
    inventoryWidth: 66,
    inventoryOffsetX: -70,
    // ── chasers.js
    fpElapsed: 0.0333,
    friction: 0.25,
    velocityEpsilon: 0.05,
    enemyPitTile: 6,
    // ── combat.js
    enemyIframes: 30,
    slashTimerMax: 20,
    killLockTset: -1,
    // ── combatVerbs.js
    swordForce: 5,
    slashDashForce: 2,
    swordAnimRate: 30,
    swordAnimRateDash: 20,
    // ── dialogue.js
    specialTimerMax: 150,
    pickupTextSpeed: 6,
    pickupLineLength: 32,
    initialFramesThisCharacter: 0,
    npcLineLengthDefault: 28,
    // ── endingChain.js
    talkRange: 24,
    coverAlphaRate: 0.005,
    treeGrowFrameRate: 3.5,
    treeGrowFrames: 16,
    // ── finalBossFight.js
    fpElapsedClamped: 0.0333,
    // ── finalBossRng.js
    rockFrequency: 6,
    grenadeFrequency: 40,
    rockStepsAhead: -15,
    rockRadius: 20,
    deathRocks: 5,
    rockScaleBase: 0.25,
    rockScaleSpan: 0.5,
    enemyCoinsBase: 4,
    enemyCoinsSpan: 4,
    // ── fireVerb.js
    fireHitFrameStart: 3,
    fireHitFrameEnd: 6,
    fireForce: 0.325,
    fireDamage: 0,
    // ── gameClock.js
    gameFps: 60,
    // ── levelWorld.js
    hitboxOriginX: 2,
    hitboxOriginY: 2,
    waterState: 1,
    lavaState: 17,
    waterfallState: 25,
    // ── playerPhysicsV1.js
    defaultFriction: 0.25,
    waterFriction: 0.5,
    walkSpeed: 0.8,
    stairSpeed: 0.4,
    waterSpeed: 0.45,
    slidingSpeed: 1,
    slidingFriction: 0.025,
    moveSpeeds25Divisor: 2,
    hitboxWidth: 4,
    hitboxHeight: 5,
    tileW: 16,
    tileH: 16,
    spawnOffsetXDivisor: 2,
    spawnOffsetYDivisor: 2,
    level0WorldWidth: 320,
    level0WorldHeight: 320,
    checkOffsetYInset: 2,
    // ── playerPhysicsV2.js
    initialTerrainState: 0,
    pitState: 6,
    iceState: 22,
    initialDirection: 3,
    directionRight: 0,
    directionUp: 1,
    directionLeft: 2,
    directionDown: 3,
    waterfallAcceleration: 0.8,
    drownTimerMax: 10,
    fallAlphaSpeed: 0.05,
    fallAlphaStart: 1,
    fallLerpDivisor: 10,
    descentDrop: 83,
    descentGravity: 0.1,
    descentMaxFall: 5,
    bounceVelocity: -2,
    noBounceStates0: 6,
    noBounceStates1: 1,
    noBounceStates2: 17,
    // ── presses.js
    swordDamage: 1,
    darkSwordDamage: 2,
    spearDamage: 2,
    slashReach: 16,
    spearLength: 32,
    spearThick: 5,
    enemyHitsMax: 3,
    enemyHitsTimer: 30,
    slashHitTicks: 5,
    lightpoleHitsTimerMax: 25,
    right: 0,
    up: 1,
    left: 2,
    down: 3,
    // ── pushables.js
    tile: 16,
    pushableSpeed: 0.5,
    pushableFriction: 0.25,
    alphaFade: 0.1,
    bothRange: 0.1,
    // ── r7Acceptance.js
    bootPreswapFrames: 1,
    // ── rng.js
    xorMask: 0x48000000,
    bootSeed: 1486967168,
    hashC1: 1376312589,
    hashC2: 789221,
    hashC3: 15731,
    randomDivisor: 2147483648,
    stateMax: 2147483647,
    // ── swimSoundClock.js
    swimLengthFrames: 47,
    swimBoostBelowSeconds: 0.1,
    swimBoostSpeed: 0.25,
    loadDeadFrames: 20,
    ceremonyFreezeFrames: 150,
    // ── tapeFormat.js
    pinFrameRate: 60,
    coercedTerrainState: 0,
    levelCount: 116,
    // ── wandVerb.js
    wandSpeed: 3,
});

/** One metadata record per `PROFILE` key, in the same order. */
export const PROFILE_FIELDS = Object.freeze([
    // ── seedlingSemantics.js
    { key: 'seedlingTileSize', class: 'physics', kind: 'magnitude', as3: 'Scenery/Tile.as:w', source: 'seedlingSemantics.js:SEEDLING_TILE_SIZE', review: false, note: 'tile size' },
    // ── bossTotemFight.js
    { key: 'headPosX', class: 'physics', kind: 'magnitude', as3: '', source: 'bossTotemFight.js:HEAD_POS_X', review: false, note: 'headPos.x always 0' },
    // ── breakableRocks.js
    { key: 'tagsPerLevel', class: 'rule', kind: 'count', as3: 'Game.as:tagsPerLevel', source: 'breakableRocks.js:TAGS_PER_LEVEL', review: false, note: '' },
    { key: 'fpMaxElapsed', class: 'physics', kind: 'magnitude', as3: 'net/flashpunk/Engine.as:MAX_ELAPSED', source: 'breakableRocks.js:FP_MAX_ELAPSED', alsoIn: ['pulser.js:FP_MAX_ELAPSED'], review: false, note: 'FP.elapsed clamp; drives anim clock gating removal' },
    { key: 'waitAfterPressTicks', class: 'rule', kind: 'magnitude', as3: '', source: 'breakableRocks.js:WAIT_AFTER_PRESS_TICKS', review: false, note: 'leg wait obligation after the press' },
    // ── bridges.js
    { key: 'bridgeTimerMax', class: 'rule', kind: 'magnitude', as3: 'Scenery/Tile.as:bridgeOpeningTimerMax', source: 'bridges.js:BRIDGE_TIMER_MAX', review: false, note: '' },
    { key: 'bridgeState', class: 'rule', kind: 'sentinel', as3: '', source: 'bridges.js:BRIDGE_STATE', alsoIn: ['levelWorld.js:BRIDGE_STATE'], review: false, note: 'Tile.types index for bridge' },
    { key: 'onScreenRadius', class: 'rule', kind: 'bound', as3: '', source: 'bridges.js:ON_SCREEN_RADIUS', review: false, note: 'planner on-screen promise radius (camera lag derived)' },
    { key: 'ticksFromPressToWalkable', class: 'rule', kind: 'magnitude', as3: '', source: 'bridges.js:TICKS_FROM_PRESS_TO_WALKABLE', review: false, note: '' },
    // ── camera.js
    { key: 'screenW', class: 'rule', kind: 'bound', as3: '', source: 'camera.js:SCREEN_W', review: false, note: 'FP.screen 160 (Main.as:36); camera gates Enemy.update via onScreen' },
    { key: 'screenH', class: 'rule', kind: 'bound', as3: '', source: 'camera.js:SCREEN_H', review: false, note: 'FP.screen 160 (Main.as:36); camera gates Enemy.update via onScreen' },
    { key: 'cameraSpeedDivisor', class: 'rule', kind: 'magnitude', as3: 'Game.as:cameraSpeedDivisorDef', source: 'camera.js:CAMERA_SPEED_DIVISOR', review: false, note: 'camera lerp; camera gates enemy updates' },
    { key: 'inventoryWidth', class: 'rule', kind: 'magnitude', as3: '', source: 'camera.js:INVENTORY_WIDTH', review: false, note: 'Inventory.width in camera x target' },
    { key: 'inventoryOffsetX', class: 'rule', kind: 'magnitude', as3: '', source: 'camera.js:INVENTORY_OFFSET_X', review: false, note: 'Inventory.offsetMin in camera x target' },
    // ── chasers.js
    { key: 'fpElapsed', class: 'physics', kind: 'magnitude', as3: 'net/flashpunk/Engine.as:MAX_ELAPSED', source: 'chasers.js:FP_ELAPSED', review: false, note: '' },
    { key: 'friction', class: 'physics', kind: 'magnitude', as3: 'Mobile.as:DEFAULT_FRICTION', source: 'chasers.js:FRICTION', review: false, note: '' },
    { key: 'velocityEpsilon', class: 'physics', kind: 'bound', as3: '', source: 'chasers.js:VELOCITY_EPSILON', review: false, note: 'Mobile.friction dead zone (Mobile.as:76-80)' },
    { key: 'enemyPitTile', class: 'rule', kind: 'sentinel', as3: '', source: 'chasers.js:ENEMY_PIT_TILE', review: false, note: '' },
    // ── combat.js
    { key: 'enemyIframes', class: 'rule', kind: 'magnitude', as3: 'Enemies/Enemy.as:hitsTimerMax', source: 'combat.js:ENEMY_IFRAMES', review: false, note: '' },
    { key: 'slashTimerMax', class: 'rule', kind: 'magnitude', as3: 'Player.as:slashTimerMax', source: 'combat.js:SLASH_TIMER_MAX', review: false, note: '' },
    { key: 'killLockTset', class: 'rule', kind: 'sentinel', as3: '', source: 'combat.js:KILL_LOCK_TSET', review: false, note: 'Lock tSet == -1 kill-lock discriminator (Lock.as:109-115)' },
    // ── combatVerbs.js
    { key: 'swordForce', class: 'physics', kind: 'magnitude', as3: 'Player.as:swordForce', source: 'combatVerbs.js:SWORD_FORCE', review: false, note: '' },
    { key: 'slashDashForce', class: 'physics', kind: 'magnitude', as3: '', source: 'combatVerbs.js:SLASH_DASH_FORCE', review: false, note: 'knockback(2) Player.as:788' },
    { key: 'swordAnimRate', class: 'rule', kind: 'magnitude', as3: 'Player.as:swordSpeed', source: 'combatVerbs.js:SWORD_ANIM_RATE', review: false, note: '' },
    { key: 'swordAnimRateDash', class: 'rule', kind: 'magnitude', as3: 'Player.as:swordSpeedDash', source: 'combatVerbs.js:SWORD_ANIM_RATE_DASH', review: false, note: '' },
    // ── dialogue.js
    { key: 'specialTimerMax', class: 'rule', kind: 'magnitude', as3: 'Pickups/Pickup.as:specialTimerMax', source: 'dialogue.js:SPECIAL_TIMER_MAX', review: false, note: '' },
    { key: 'pickupTextSpeed', class: 'rule', kind: 'magnitude', as3: 'Pickups/Pickup.as:DEF_TEXT_SPEED', source: 'dialogue.js:PICKUP_TEXT_SPEED', review: false, note: '' },
    { key: 'pickupLineLength', class: 'rule', kind: 'bound', as3: '', source: 'dialogue.js:PICKUP_LINE_LENGTH', review: true, note: 'REVIEW: text layout but the wrap changes page .length which gates page advance and ceremony ticks' },
    { key: 'initialFramesThisCharacter', class: 'rule', kind: 'magnitude', as3: 'Game.as:framesThisCharacter', source: 'dialogue.js:INITIAL_FRAMES_THIS_CHARACTER', review: false, note: '' },
    { key: 'npcLineLengthDefault', class: 'rule', kind: 'bound', as3: 'NPCs/NPC.as:_lineLength', as3Match: 'param', source: 'dialogue.js:NPC_LINE_LENGTH_DEFAULT', review: true, note: 'REVIEW: text layout but wrap length decides page lengths and so dialogue ticks' },
    // ── endingChain.js
    { key: 'talkRange', class: 'rule', kind: 'bound', as3: 'NPCs/NPC.as:talkRange', source: 'endingChain.js:TALK_RANGE', review: false, note: 'origin-to-origin talk circle' },
    { key: 'coverAlphaRate', class: 'rule', kind: 'magnitude', as3: 'Pickups/Seed.as:coverAlphaRate', source: 'endingChain.js:COVER_ALPHA_RATE', review: false, note: 'cover fade accumulation = 200 frozen frames' },
    { key: 'treeGrowFrameRate', class: 'rule', kind: 'magnitude', as3: '', source: 'endingChain.js:TREE_GROW_FRAME_RATE', review: false, note: 'grow anim rate; endAnim triggers credits fade' },
    { key: 'treeGrowFrames', class: 'rule', kind: 'count', as3: '', source: 'endingChain.js:TREE_GROW_FRAMES', review: false, note: 'grow anim frames; endAnim triggers credits fade' },
    // ── finalBossFight.js
    { key: 'fpElapsedClamped', class: 'physics', kind: 'magnitude', as3: 'net/flashpunk/Engine.as:MAX_ELAPSED', source: 'finalBossFight.js:FP_ELAPSED_CLAMPED', alsoIn: ['r6AnimClock.js:FP_ELAPSED_CLAMPED', 'shieldBossFight.js:FP_ELAPSED_CLAMPED'], review: false, note: 'FP.elapsed clamp; scales anim timers that gate callbacks' },
    // ── finalBossRng.js
    { key: 'rockFrequency', class: 'rule', kind: 'magnitude', as3: 'Enemies/FinalBoss.as:rockFrequency', source: 'finalBossRng.js:ROCK_FREQUENCY', review: false, note: '1-in-6 rock spawn roll' },
    { key: 'grenadeFrequency', class: 'rule', kind: 'magnitude', as3: 'Enemies/FinalBoss.as:grenadeFrequency', source: 'finalBossRng.js:GRENADE_FREQUENCY', review: false, note: '1-in-40 grenade roll' },
    { key: 'rockStepsAhead', class: 'rule', kind: 'magnitude', as3: 'Enemies/FinalBoss.as:stepsAhead', source: 'finalBossRng.js:ROCK_STEPS_AHEAD', review: false, note: 'rock aim offset in player-velocity steps (negative = behind)' },
    { key: 'rockRadius', class: 'rule', kind: 'bound', as3: 'Enemies/FinalBoss.as:radius', source: 'finalBossRng.js:ROCK_RADIUS', review: false, note: 'rock spawn scatter radius' },
    { key: 'deathRocks', class: 'rule', kind: 'count', as3: '', source: 'finalBossRng.js:DEATH_ROCKS', review: false, note: '' },
    { key: 'rockScaleBase', class: 'physics', kind: 'magnitude', as3: '', source: 'finalBossRng.js:ROCK_SCALE_BASE', review: false, note: 'rock scale base; scale sets the hitbox' },
    { key: 'rockScaleSpan', class: 'physics', kind: 'magnitude', as3: '', source: 'finalBossRng.js:ROCK_SCALE_SPAN', review: false, note: 'rock scale span; scale sets the hitbox' },
    { key: 'enemyCoinsBase', class: 'rule', kind: 'magnitude', as3: '', source: 'finalBossRng.js:ENEMY_COINS_BASE', review: false, note: 'Enemy.as:30 coin drop base' },
    { key: 'enemyCoinsSpan', class: 'rule', kind: 'magnitude', as3: '', source: 'finalBossRng.js:ENEMY_COINS_SPAN', review: false, note: 'Enemy.as:30 coin drop span' },
    // ── fireVerb.js
    { key: 'fireHitFrameStart', class: 'rule', kind: 'bound', as3: 'Player.as:fireHitFrameStart', source: 'fireVerb.js:FIRE_HIT_FRAME_START', review: false, note: '' },
    { key: 'fireHitFrameEnd', class: 'rule', kind: 'bound', as3: 'Player.as:fireHitFrameEnd', source: 'fireVerb.js:FIRE_HIT_FRAME_END', review: false, note: '' },
    { key: 'fireForce', class: 'physics', kind: 'magnitude', as3: 'Player.as:fireForce', source: 'fireVerb.js:FIRE_FORCE', review: false, note: '' },
    { key: 'fireDamage', class: 'rule', kind: 'magnitude', as3: 'Player.as:fireDamage', source: 'fireVerb.js:FIRE_DAMAGE', review: false, note: '' },
    // ── gameClock.js
    { key: 'gameFps', class: 'rule', kind: 'magnitude', as3: 'Main.as:FPS', source: 'gameClock.js:GAME_FPS', review: false, note: '' },
    // ── levelWorld.js
    { key: 'hitboxOriginX', class: 'physics', kind: 'magnitude', as3: 'Player.as:normalHitbox', as3Match: 'arg:0', source: 'levelWorld.js:HITBOX_ORIGIN_X', alsoIn: ['playerPhysicsV1.js:HITBOX.originX'], review: false, note: 'player hitbox origin x (Rectangle(2;2;4;5))' },
    { key: 'hitboxOriginY', class: 'physics', kind: 'magnitude', as3: 'Player.as:normalHitbox', as3Match: 'arg:1', source: 'levelWorld.js:HITBOX_ORIGIN_Y', alsoIn: ['playerPhysicsV1.js:HITBOX.originY'], review: false, note: 'player hitbox origin y' },
    { key: 'waterState', class: 'rule', kind: 'sentinel', as3: '', source: 'levelWorld.js:WATER_STATE', alsoIn: ['playerPhysicsV2.js:WATER_STATE'], review: false, note: 'Tile.types index for Water' },
    { key: 'lavaState', class: 'rule', kind: 'sentinel', as3: '', source: 'levelWorld.js:LAVA_STATE', alsoIn: ['playerPhysicsV2.js:LAVA_STATE'], review: false, note: 'Tile.types index for Lava' },
    { key: 'waterfallState', class: 'rule', kind: 'sentinel', as3: '', source: 'levelWorld.js:WATERFALL_STATE', alsoIn: ['playerPhysicsV2.js:WATERFALL_STATE'], review: false, note: 'Tile.types index for Waterfall' },
    // ── playerPhysicsV1.js
    { key: 'defaultFriction', class: 'physics', kind: 'magnitude', as3: 'Mobile.as:DEFAULT_FRICTION', source: 'playerPhysicsV1.js:DEFAULT_FRICTION', review: false, note: '' },
    { key: 'waterFriction', class: 'physics', kind: 'magnitude', as3: 'Mobile.as:WATER_FRICTION', source: 'playerPhysicsV1.js:WATER_FRICTION', review: false, note: '' },
    { key: 'walkSpeed', class: 'physics', kind: 'magnitude', as3: 'Player.as:dMS', source: 'playerPhysicsV1.js:WALK_SPEED', review: false, note: '' },
    { key: 'stairSpeed', class: 'physics', kind: 'magnitude', as3: 'Player.as:dMSstair', source: 'playerPhysicsV1.js:STAIR_SPEED', review: false, note: '' },
    { key: 'waterSpeed', class: 'physics', kind: 'magnitude', as3: 'Player.as:dMSwater', source: 'playerPhysicsV1.js:WATER_SPEED', review: false, note: '' },
    { key: 'slidingSpeed', class: 'physics', kind: 'magnitude', as3: 'Player.as:slidingSpeed', source: 'playerPhysicsV1.js:SLIDING_SPEED', alsoIn: ['playerPhysicsV2.js:SLIDING_SPEED'], review: false, note: '' },
    { key: 'slidingFriction', class: 'physics', kind: 'magnitude', as3: 'Player.as:slidingFriction', source: 'playerPhysicsV1.js:SLIDING_FRICTION', alsoIn: ['playerPhysicsV2.js:SLIDING_FRICTION'], review: false, note: '' },
    { key: 'moveSpeeds25Divisor', class: 'physics', kind: 'derivation', as3: 'Player.as:moveSpeeds', as3Match: 'after:dMSwater/', source: 'playerPhysicsV1.js:MOVE_SPEEDS[25]', review: false, note: 'WATER_SPEED / 2 for the waterfall row' },
    { key: 'hitboxWidth', class: 'physics', kind: 'magnitude', as3: 'Player.as:normalHitbox', as3Match: 'arg:2', source: 'playerPhysicsV1.js:HITBOX.width', review: false, note: 'normalHitbox setHitbox(4 5 2 2)' },
    { key: 'hitboxHeight', class: 'physics', kind: 'magnitude', as3: 'Player.as:normalHitbox', as3Match: 'arg:3', source: 'playerPhysicsV1.js:HITBOX.height', review: false, note: 'normalHitbox setHitbox(4 5 2 2)' },
    { key: 'tileW', class: 'physics', kind: 'magnitude', as3: 'Scenery/Tile.as:w', source: 'playerPhysicsV1.js:TILE.w', alsoIn: ['wandShot.js:TILE_W'], review: false, note: 'the tile width (wandShot: travel = tilesMove * Tile.w)' },
    { key: 'tileH', class: 'physics', kind: 'magnitude', as3: 'Scenery/Tile.as:h', source: 'playerPhysicsV1.js:TILE.h', review: false, note: '' },
    { key: 'spawnOffsetXDivisor', class: 'physics', kind: 'derivation', as3: '', source: 'playerPhysicsV1.js:SPAWN_OFFSET.x', review: false, note: 'TILE.w / 2 and TILE.h / 2 spawn centring (Player.as:357)' },
    { key: 'spawnOffsetYDivisor', class: 'physics', kind: 'derivation', as3: '', source: 'playerPhysicsV1.js:SPAWN_OFFSET.y', review: false, note: 'TILE.w / 2 and TILE.h / 2 spawn centring (Player.as:357)' },
    { key: 'level0WorldWidth', class: 'physics', kind: 'bound', as3: '', source: 'playerPhysicsV1.js:LEVEL0_WORLD.width', review: false, note: 'level 0 pixel size for the position clamp' },
    { key: 'level0WorldHeight', class: 'physics', kind: 'bound', as3: '', source: 'playerPhysicsV1.js:LEVEL0_WORLD.height', review: false, note: 'level 0 pixel size for the position clamp' },
    { key: 'checkOffsetYInset', class: 'physics', kind: 'derivation', as3: 'Player.as:checkOffsetY', as3Match: 'after:checkOffsetY = -originY + height - ', source: 'playerPhysicsV1.js:CHECK_OFFSET_Y', review: false, note: '-HITBOX.originY + HITBOX.height - 2' },
    // ── playerPhysicsV2.js
    { key: 'initialTerrainState', class: 'rule', kind: 'sentinel', as3: 'Player.as:_state', source: 'playerPhysicsV2.js:INITIAL_TERRAIN_STATE', review: false, note: 'Ground state' },
    { key: 'pitState', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:PIT_STATE', review: false, note: 'Tile.t pit' },
    { key: 'iceState', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:ICE_STATE', review: false, note: 'Tile.t ice' },
    { key: 'initialDirection', class: 'rule', kind: 'sentinel', as3: 'Player.as:direction', source: 'playerPhysicsV2.js:INITIAL_DIRECTION', review: false, note: 'direction code down' },
    { key: 'directionRight', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:DIRECTION_RIGHT', review: false, note: 'direction code' },
    { key: 'directionUp', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:DIRECTION_UP', review: false, note: 'direction code' },
    { key: 'directionLeft', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:DIRECTION_LEFT', review: false, note: 'direction code' },
    { key: 'directionDown', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:DIRECTION_DOWN', review: false, note: 'direction code; auto anchor suppressed: Player.as:direction is the facing field whose default 3 only coincides with this enum' },
    { key: 'waterfallAcceleration', class: 'physics', kind: 'magnitude', as3: 'Player.as:waterfallAcceleration', source: 'playerPhysicsV2.js:WATERFALL_ACCELERATION', review: false, note: '' },
    { key: 'drownTimerMax', class: 'rule', kind: 'magnitude', as3: 'Player.as:drownTimerMax', source: 'playerPhysicsV2.js:DROWN_TIMER_MAX', review: false, note: '' },
    { key: 'fallAlphaSpeed', class: 'rule', kind: 'magnitude', as3: 'Player.as:fallAlphaSpeed', source: 'playerPhysicsV2.js:FALL_ALPHA_SPEED', review: false, note: 'accumulation decides fall swap tick 20' },
    { key: 'fallAlphaStart', class: 'rule', kind: 'magnitude', as3: '', source: 'playerPhysicsV2.js:FALL_ALPHA_START', review: false, note: 'the player Image.alpha at the start of the pit fall (no named AS3 field); auto anchor Game.as:blackCover suppressed' },
    { key: 'fallLerpDivisor', class: 'physics', kind: 'magnitude', as3: '', source: 'playerPhysicsV2.js:FALL_LERP_DIVISOR', review: false, note: 'pit-fall position lerp' },
    { key: 'descentDrop', class: 'physics', kind: 'magnitude', as3: '', source: 'playerPhysicsV2.js:DESCENT_DROP', review: false, note: 'FP.screen.height / 2 + (height - originY) = 80 + 3' },
    { key: 'descentGravity', class: 'physics', kind: 'magnitude', as3: '', source: 'playerPhysicsV2.js:DESCENT_GRAVITY', review: false, note: '' },
    { key: 'descentMaxFall', class: 'physics', kind: 'bound', as3: '', source: 'playerPhysicsV2.js:DESCENT_MAX_FALL', review: false, note: '' },
    { key: 'bounceVelocity', class: 'physics', kind: 'magnitude', as3: '', source: 'playerPhysicsV2.js:BOUNCE_VELOCITY', review: false, note: '' },
    { key: 'noBounceStates0', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:NO_BOUNCE_STATES[0]', review: false, note: 'Tile.t pit/water/lava' },
    { key: 'noBounceStates1', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:NO_BOUNCE_STATES[1]', review: false, note: 'Tile.t pit/water/lava' },
    { key: 'noBounceStates2', class: 'rule', kind: 'sentinel', as3: '', source: 'playerPhysicsV2.js:NO_BOUNCE_STATES[2]', review: false, note: 'Tile.t pit/water/lava' },
    // ── presses.js
    { key: 'swordDamage', class: 'rule', kind: 'magnitude', as3: 'Player.as:swordDamage', source: 'presses.js:SWORD_DAMAGE', review: false, note: '' },
    { key: 'darkSwordDamage', class: 'rule', kind: 'magnitude', as3: 'Player.as:darkSwordDamage', source: 'presses.js:DARK_SWORD_DAMAGE', review: false, note: '' },
    { key: 'spearDamage', class: 'rule', kind: 'magnitude', as3: 'Player.as:spearDamage', source: 'presses.js:SPEAR_DAMAGE', review: false, note: '' },
    { key: 'slashReach', class: 'physics', kind: 'bound', as3: '', source: 'presses.js:SLASH_REACH', review: false, note: 'slash distanceRectPoint reach gate (sprite width * scaleX)' },
    { key: 'spearLength', class: 'physics', kind: 'magnitude', as3: 'Player.as:length', source: 'presses.js:SPEAR_LENGTH', review: false, note: '' },
    { key: 'spearThick', class: 'physics', kind: 'magnitude', as3: 'Player.as:thick', source: 'presses.js:SPEAR_THICK', review: false, note: '' },
    { key: 'enemyHitsMax', class: 'rule', kind: 'count', as3: 'Enemies/Enemy.as:hitsMax', source: 'presses.js:ENEMY_HITS_MAX', review: false, note: '' },
    { key: 'enemyHitsTimer', class: 'rule', kind: 'magnitude', as3: 'Enemies/Enemy.as:hitsTimerMax', source: 'presses.js:ENEMY_HITS_TIMER', review: false, note: '' },
    { key: 'slashHitTicks', class: 'rule', kind: 'count', as3: '', source: 'presses.js:SLASH_HIT_TICKS', review: false, note: 'hit tests per slash press (T+1..T+5)' },
    { key: 'lightpoleHitsTimerMax', class: 'rule', kind: 'magnitude', as3: 'Scenery/LightPole.as:hitsTimerMax', source: 'presses.js:LIGHTPOLE_HITS_TIMER_MAX', review: false, note: '' },
    { key: 'right', class: 'rule', kind: 'sentinel', as3: '', source: 'presses.js:RIGHT', alsoIn: ['pushables.js:RIGHT'], review: false, note: 'direction code' },
    { key: 'up', class: 'rule', kind: 'sentinel', as3: '', source: 'presses.js:UP', alsoIn: ['pushables.js:UP'], review: false, note: 'direction code' },
    { key: 'left', class: 'rule', kind: 'sentinel', as3: '', source: 'presses.js:LEFT', alsoIn: ['pushables.js:LEFT'], review: false, note: 'direction code' },
    { key: 'down', class: 'rule', kind: 'sentinel', as3: '', source: 'presses.js:DOWN', alsoIn: ['pushables.js:DOWN'], review: false, note: 'direction code; auto anchor suppressed: Player.as:direction is the initial-facing field (default 3) not the code table' },
    // ── pushables.js
    { key: 'tile', class: 'physics', kind: 'magnitude', as3: 'Scenery/Tile.as:w', source: 'pushables.js:TILE', review: false, note: 'tile size in block collision and step' },
    { key: 'pushableSpeed', class: 'physics', kind: 'magnitude', as3: 'Puzzlements/PushableBlockFire.as:moveSpeed', source: 'pushables.js:PUSHABLE_SPEED', review: false, note: '' },
    { key: 'pushableFriction', class: 'physics', kind: 'magnitude', as3: 'Mobile.as:DEFAULT_FRICTION', source: 'pushables.js:PUSHABLE_FRICTION', review: false, note: '' },
    { key: 'alphaFade', class: 'rule', kind: 'magnitude', as3: '', source: 'pushables.js:ALPHA_FADE', review: false, note: 'Mobile.death alpha fade; accumulation gates removal' },
    { key: 'bothRange', class: 'physics', kind: 'bound', as3: 'Puzzlements/PushableBlockFire.as:bothRange', source: 'pushables.js:BOTH_RANGE', review: false, note: '' },
    // ── r7Acceptance.js
    { key: 'bootPreswapFrames', class: 'rule', kind: 'magnitude', as3: '', source: 'r7Acceptance.js:BOOT_PRESWAP_FRAMES', review: true, note: 'REVIEW: measured boot pre-swap frame offset; a clock correction for seam comparison' },
    // ── rng.js
    { key: 'xorMask', class: 'rule', kind: 'magnitude', as3: '', source: 'rng.js:XOR_MASK', review: false, note: 'LFSR feedback mask; decides every draw' },
    { key: 'bootSeed', class: 'rule', kind: 'magnitude', as3: '', source: 'rng.js:BOOT_SEED', review: false, note: 'build boot seed (MOCK_DATE_TIME*1000)' },
    { key: 'hashC1', class: 'rule', kind: 'magnitude', as3: '', source: 'rng.js:HASH_C1', review: false, note: 'avmplus hasher constant' },
    { key: 'hashC2', class: 'rule', kind: 'magnitude', as3: '', source: 'rng.js:HASH_C2', review: false, note: 'avmplus hasher constant' },
    { key: 'hashC3', class: 'rule', kind: 'magnitude', as3: '', source: 'rng.js:HASH_C3', review: false, note: 'avmplus hasher constant' },
    { key: 'randomDivisor', class: 'rule', kind: 'magnitude', as3: '', source: 'rng.js:RANDOM_DIVISOR', review: false, note: '2^31 Math.random divisor' },
    { key: 'stateMax', class: 'rule', kind: 'bound', as3: '', source: 'rng.js:STATE_MAX', review: false, note: 'largest orbit state; seed ceiling' },
    // ── swimSoundClock.js
    { key: 'swimLengthFrames', class: 'rule', kind: 'magnitude', as3: '', source: 'swimSoundClock.js:SWIM_LENGTH_FRAMES', review: true, note: 'REVIEW: sound length in frames; not cosmetic because the replay re-arms the swim speed boost' },
    { key: 'swimBoostBelowSeconds', class: 'physics', kind: 'bound', as3: '', source: 'swimSoundClock.js:SWIM_BOOST_BELOW_SECONDS', review: false, note: 'Player.as:530 threshold on Sfx.position' },
    { key: 'swimBoostSpeed', class: 'physics', kind: 'magnitude', as3: '', source: 'swimSoundClock.js:SWIM_BOOST_SPEED', review: false, note: 'Player.as:530 addend' },
    { key: 'loadDeadFrames', class: 'rule', kind: 'magnitude', as3: '', source: 'swimSoundClock.js:LOAD_DEAD_FRAMES', review: false, note: 'room-load fade dead frames (blackCover 1 at -0.05)' },
    { key: 'ceremonyFreezeFrames', class: 'rule', kind: 'magnitude', as3: 'Pickups/Pickup.as:specialTimerMax', source: 'swimSoundClock.js:CEREMONY_FREEZE_FRAMES', review: false, note: '' },
    // ── tapeFormat.js
    { key: 'pinFrameRate', class: 'rule', kind: 'magnitude', as3: 'Main.as:FPS', source: 'tapeFormat.js:PIN_FRAME_RATE', review: false, note: 'engine FPS the sound-clock pin reproduces; swim boost reads it' },
    { key: 'coercedTerrainState', class: 'rule', kind: 'sentinel', as3: '', source: 'tapeFormat.js:COERCED_TERRAIN_STATE', review: false, note: 'Ground state 0 (Player.as:297)' },
    { key: 'levelCount', class: 'rule', kind: 'count', as3: '', source: 'tapeFormat.js:LEVEL_COUNT', review: false, note: 'Game.levels.length' },
    // ── wandVerb.js
    { key: 'wandSpeed', class: 'physics', kind: 'magnitude', as3: 'Player.as:wandSpeed', source: 'wandVerb.js:WAND_SPEED', review: false, note: '' },
].map((f) => Object.freeze(f)));

/**
 * The canonical text of `profile` (default: `PROFILE`), in `PROFILE_FIELDS`
 * order. Shaped as RWK's profile dump: braces, one `"<key>": <value>` line per
 * field, a final newline.
 */
export function profileDump(profile = PROFILE) {
    const lines = PROFILE_FIELDS.map((f) => `  ${JSON.stringify(f.key)}: ${JSON.stringify(profile[f.key])}`);
    return `{\n${lines.join(',\n')}\n}\n`;
}

/** md5 of `profileDump(profile)` — the profile's identity. */
export function profileMd5(profile = PROFILE) {
    return md5(profileDump(profile));
}

/** `{id, md5}` — what a v13 tape's `profile` field carries. */
export function profileStamp() {
    return { id: PROFILE_ID, md5: profileMd5() };
}
