# Seedling Constants Census

Every numeric literal in Seedling's JS simulation — the static import closure of `frontend/modules/seedlingDemo/levelRun.js` — is one row of a generated census, `scripts/procgen/seedling-constants-census.csv`, and every row carries a REVIEWED class (`physics`, `rule`, `cosmetic`, `structural`) joined from `scripts/procgen/seedling-constants-fields.csv`. It is the first step of giving the simulation a single physics profile: the census says which numbers a profile would have to own, and a vitest gate keeps the classification from rotting as the simulation changes.

## What it is, and what it is not

The census is READ-ONLY over the simulation. It moves no constant, edits no simulation or solver file, and touches no tape or expectation. The profile itself — gathering the `physics` and `rule` constants into one object — is a later slice that reads this classification; the candidate list at the end of this page is its starting inventory.

Three files and one test:

- `scripts/procgen/seedlingConstantsCensus.js` — the pure logic: the closure, the rows, the keys, the join, the drift verdict, and the tables rendered at the end of this page.
- `scripts/procgen/census-seedling-constants.mjs` — the command. With no flag it prints the class × position table; `--write` regenerates the census CSV and this page's CENSUS region; `--check` exits 1 on drift.
- `scripts/procgen/seedling-constants-fields.csv` — the reviewed classification, hand-edited.
- `scripts/procgen/seedlingConstantsCensus.test.js` — the gate, in the default vitest tier.

## The closure and the three positions

The simulation is every file reached from `levelRun.js` by `import … from './x'` or `export … from './x'` with a relative specifier; dynamic `import()` and bare specifiers are not followed. Today that is 46 files in `frontend/modules/seedlingDemo/` plus `frontend/modules/flashPanel/seedlingSemantics.js`. Every `NumericLiteral` node in them is one row, in one position:

- **scalar** — the whole initialiser of a top-level `const NAME = <number>` (or `= -<number>`), `NAME` matching `^[A-Z][A-Z0-9_]*$`. These are the names a profile would import.
- **table** — anywhere inside the initialiser of any other top-level `const` whose initialiser is not a function: frozen objects, arrays, `new Set([...])`, arithmetic over other constants, and the methods nested inside those objects.
- **inline** — everything else: literals in function bodies, in `let`s, in function-valued consts.

A unary minus is folded into the literal, so `-1` is one row spelled `-1`. The literal column keeps the source spelling (`0.0333`, `0x48000000`), never a re-printed float.

## The key

`<file>|<function>|h<8 hex>|<literal>|<ordinal>`

- `function` is the innermost NAMED function frame (`createLevelRun`, `Class.method`, the const an arrow is assigned to); anonymous callbacks are attributed to the named frame around them, and module-level code is `(module)`.
- The 8 hex digits are the md5 of the literal's UNIT with comments stripped and whitespace normalised (runs collapsed, and dropped wherever they touch punctuation, so `f( 3 )` and `f(3)` agree). The unit is the literal's statement, with every nested block or statement that does not hold the literal replaced by `{…}` — so an edit inside an `if`'s body moves no key in its test. In a table the unit is the innermost `key: value` property, prefixed by the property path from the table's name (`HITBOX.originY: originY:2`), so editing one entry of a large table does not re-key its neighbours.
- `ordinal` numbers the rows that agree on everything before it, in source order.

The LINE is a column, never part of the key: inserting lines moves no key (the gate proves it on a temp copy). The reason the key carries the statement at all is the trap the precedent census hit: a value cannot tell you its kind — the same `16` is a tile size in one statement and a frame count in another — and a `(file, literal)` key would cover every occurrence at once.

## The classes and kinds

| class | means | examples |
|---|---|---|
| `physics` | a magnitude the motion or collision arithmetic consumes | speeds, friction, acceleration, hitbox sizes and origins, tile size, knockback force, the 0.0333 frame-time clamp |
| `rule` | a game rule in numbers | hit counts, damage, invulnerability frames, timers and cadences that gate events, state and tile ids the rules branch on, RNG constants |
| `cosmetic` | presentation only; no simulation outcome depends on it | sprite frames nothing reads back, alpha fades, sound, text layout |
| `structural` | the program's own bookkeeping | array indices, loop bounds, `+1`/`-1` index arithmetic, version numbers, format and parser limits, 0/1 as booleans or identities |
| `unclassified` | no reviewed target reaches the row | — the gate allows none |

Every `physics` and `rule` row also carries a `kind`: `magnitude` (a quantity), `count` (how many), `bound` (a limit, clamp, threshold or radius), `sign` (a direction or ±1), `sentinel` (an id or marker value), or `derivation` (a literal inside arithmetic over named constants — its note names the sources). `cosmetic` and `structural` rows carry none.

⚠ In this engine an animation frame count often GATES gameplay: a hit lands on a sprite frame, an animation callback fires a kill. Such a literal is `rule` (or `physics`), not `cosmetic`. Where a classification is a judgement call, its note starts `REVIEW:`; the count of those is in the tables below.

## The reviewed table and how to classify a new literal

`seedling-constants-fields.csv` has the columns `target,class,kind,as3,note`. A target is either:

- a SELECTOR `file|enclosing|function` or `file|enclosing|function|literal`, where `enclosing` is the top-level declaration the literal sits in (the table's name for a table row) and `function` is as in the key; `*` appears only as a file-wide default `file|*|*`; or
- an exact KEY from the census, for a single row.

The most specific target wins: an exact key, then a four-part selector, then a three-part one, then a file default. Two targets equally specific on one row is a red gate row, never resolved by file order, and a target that reaches no row is also red — dead rows do not accumulate.

To classify a new literal after the gate names it:

1. Read the statement the key's hash was taken over (the census row's `context` column shows its first 90 characters) and the doc comment above it. Do not class by value.
2. If its group (`file|enclosing|function`) already has a row with the right class, nothing is needed beyond step 3. Otherwise add a selector for the group, or an exact-key row when the group mixes classes.
3. Run `node scripts/procgen/census-seedling-constants.mjs --write` and commit the census CSV, this page and the fields file together.

## The gate

`seedlingConstantsCensus.test.js` runs `--check`'s own function (`checkCensus`) over the tree. It is RED on:

- a NEW key whose class is `physics`, `rule` or `unclassified`;
- a committed `physics` or `rule` key that is gone from the source — it must be RETIRED by a `--write` whose commit says why;
- a key present on both sides whose reviewed columns (class, kind, note, as3) disagree — the committed census is stale;
- this page's CENSUS region differing from a render of the COMMITTED census (and of the source's top-level facts: the duplicated names and derived constants).

A new or vanished `cosmetic` or `structural` literal is GREEN and is reported as drift, as is a moved line; the next `--write` records it. The region renders the committed rows rather than fresh ones for exactly that reason: rendered fresh, every new cosmetic literal would move the counts and turn the page red. The test also proves the key line-independent, self-tests the positions on synthetic sources, and runs three mutants on temp copies of the closure (a new physics scalar is red by key, a new literal in a cosmetic table is green, a deleted physics statement must be retired).

The `as3` column is read from `vendor/seedling/src` when the submodule is initialised: a named scalar is anchored automatically when its trailing comment or its name names an AS3 `const`/`var` of EQUAL value (`WALK_SPEED = 0.8; // dMS` → `Player.as:dMS`), and the fields file can give any row an anchor by hand. Without the submodule the as3 column is not compared and the anchor row of the test skips by name; the region needs no AS3 source, since the committed rows carry their anchors.

## The census

The region below is rendered by `--write`; do not edit it by hand.

<!-- CENSUS:seedling-constants BEGIN — by scripts/procgen/census-seedling-constants.mjs --write; do not edit; regenerate -->

**48 files, 4185 literals.** Class × position:

| class | scalar | table | inline | total |
|---|---|---|---|---|
| physics | 43 | 1194 | 268 | 1505 |
| rule | 85 | 729 | 377 | 1191 |
| cosmetic | 0 | 43 | 8 | 51 |
| structural | 9 | 182 | 1247 | 1438 |
| unclassified | 0 | 0 | 0 | 0 |
| total | 137 | 2148 | 1900 | 4185 |

Class × kind (physics and rule rows only):

| class | magnitude | count | bound | sign | sentinel | derivation | total |
|---|---|---|---|---|---|---|---|
| physics | 1267 | 0 | 87 | 108 | 4 | 39 | 1505 |
| rule | 321 | 109 | 184 | 22 | 482 | 73 | 1191 |

Rows whose note starts `REVIEW:`: **105**.

### The 12 names declared in more than one file

| name | values agree | files |
|---|---|---|
| `BRIDGE_STATE` | yes | seedlingDemo/levelWorld.js = 29; seedlingDemo/bridges.js = 29 |
| `WATER_STATE` | yes | seedlingDemo/levelWorld.js = 1; seedlingDemo/playerPhysicsV2.js = 1 |
| `LAVA_STATE` | yes | seedlingDemo/levelWorld.js = 17; seedlingDemo/playerPhysicsV2.js = 17 |
| `WATERFALL_STATE` | yes | seedlingDemo/levelWorld.js = 25; seedlingDemo/playerPhysicsV2.js = 25 |
| `RIGHT` | yes | seedlingDemo/pushables.js = 0; seedlingDemo/presses.js = 0 |
| `UP` | yes | seedlingDemo/pushables.js = 1; seedlingDemo/presses.js = 1 |
| `LEFT` | yes | seedlingDemo/pushables.js = 2; seedlingDemo/presses.js = 2 |
| `DOWN` | yes | seedlingDemo/pushables.js = 3; seedlingDemo/presses.js = 3 |
| `FP_MAX_ELAPSED` | yes | seedlingDemo/breakableRocks.js = 0.0333; seedlingDemo/pulser.js = 0.0333 |
| `FP_ELAPSED_CLAMPED` | yes | seedlingDemo/shieldBossFight.js = 0.0333; seedlingDemo/finalBossFight.js = 0.0333; seedlingDemo/r6AnimClock.js = 0.0333 |
| `SLIDING_SPEED` | yes | seedlingDemo/playerPhysicsV1.js = 1; seedlingDemo/playerPhysicsV2.js = 1 |
| `SLIDING_FRICTION` | yes | seedlingDemo/playerPhysicsV1.js = 0.025; seedlingDemo/playerPhysicsV2.js = 0.025 |

### The 28 derived or aliased top-level constants

| name | file | initialiser |
|---|---|---|
| `PIT_STATE` | seedlingDemo/levelWorld.js | `HAZARD_STATES.pit` |
| `TILE_SIZE` | seedlingDemo/levelWorld.js | `SEEDLING_TILE_SIZE` |
| `NPC_LINE_LENGTH` | seedlingDemo/endingChain.js | `NPC_LINE_LENGTH_DEFAULT` |
| `BLOODY_SEED_TEXT` | seedlingDemo/endingChain.js | `'The seed, covered in the blood of the Watcher, seems ' + 'almost to cower fr...` |
| `TICKS_PER_TILE` | seedlingDemo/pushables.js | `TILE / PUSHABLE_SPEED` |
| `SLASH_REACH_DASH` | seedlingDemo/presses.js | `SLASH_REACH * SLASH_SCALE_DASH.x` |
| `FIRE_PRESS_CADENCE` | seedlingDemo/fireVerb.js | `FIRE_WINDOW.endTick + 1` |
| `FIRE_RADIUS` | seedlingDemo/fireVerb.js | `FIRE_SPRITE.w / 2` |
| `WAIT_AFTER_PRESS_TICKS` | seedlingDemo/burnableTree.js | `HIT_TO_GONE_TICKS + 12` |
| `TILE` | seedlingDemo/spinner.js | `TILE_SIZE` |
| `TILE` | seedlingDemo/crusher.js | `TILE_SIZE` |
| `SHIELD_BOSS_DIE_UPDATES` | seedlingDemo/shieldBossFight.js | `SHIELD_BOSS_ANIM_UPDATES.die` |
| `SHIELD_BOSS_WINDOW_UPDATES` | seedlingDemo/shieldBossFight.js | `SHIELD_BOSS_ANIM_UPDATES.movedShield` |
| `OWL_LEVEL_BUILD_DRAWS` | seedlingDemo/finalBossRng.js | `OWL_LEVEL_BUILD_SITES.length` |
| `TILE` | seedlingDemo/iceTurret.js | `TILE_SIZE` |
| `WAND_SPAWN_REACH` | seedlingDemo/wandVerb.js | `WAND_SPRITE.w` |
| `WAND_PRESS_CADENCE` | seedlingDemo/wandVerb.js | `WAND_WINDOW.endTick + 1` |
| `MAGICAL_LOCK_CALLBACK_TICK_OFFSET` | seedlingDemo/magicalLock.js | `MAGICAL_LOCK_DESTROY_UPDATES - 1` |
| `MAGICAL_LOCK_OPEN_TICK_OFFSET` | seedlingDemo/magicalLock.js | `MAGICAL_LOCK_DESTROY_UPDATES` |
| `INVENTORY_TERM` | seedlingDemo/camera.js | `INVENTORY_WIDTH / 2 + INVENTORY_OFFSET_X / 2` |
| `KILL_CADENCE_FLOOR` | seedlingDemo/combat.js | `SLASH_TIMER_MAX + 1` |
| `MAX_HALF_WIDTH` | seedlingDemo/deadFrameBand.js | `CEREMONY_DEAD_FRAMES.pickup / 2` |
| `KILL_PRESS_CADENCE` | seedlingDemo/combatVerbs.js | `ENEMY_IFRAMES + 1` |
| `DASH_CHAIN_MAX` | seedlingDemo/combatVerbs.js | `DASH_CHAIN.max` |
| `ORDINARY_SWING_PERIOD` | seedlingDemo/combatVerbs.js | `SLASH_TIMER_MAX` |
| `CHECK_OFFSET_Y` | seedlingDemo/playerPhysicsV1.js | `-HITBOX.originY + HITBOX.height - 2` |
| `DAY_LENGTH_FRAMES` | seedlingDemo/gameClock.js | `160 * GAME_FPS` |
| `PAGE_BOOT_TIME` | seedlingDemo/gameClock.js | `DAY_LENGTH_FRAMES / 2` |

### The profile candidates

**128 named scalars** are `physics` or `rule` (62 with an AS3 anchor), and **133 small tables** (at most 16 literals) hold at least one (84 with an AS3 reference).

| name | file | value | class | kind | AS3 |
|---|---|---|---|---|---|
| `SEEDLING_TILE_SIZE` | flashPanel/seedlingSemantics.js | 16 | physics | magnitude | Scenery/Tile.as:w |
| `HEAD_POS_X` | seedlingDemo/bossTotemFight.js | 0 | physics | magnitude |  |
| `TAGS_PER_LEVEL` | seedlingDemo/breakableRocks.js | 30 | rule | count | Game.as:tagsPerLevel |
| `FP_MAX_ELAPSED` | seedlingDemo/breakableRocks.js | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED |
| `WAIT_AFTER_PRESS_TICKS` | seedlingDemo/breakableRocks.js | 20 | rule | magnitude |  |
| `BRIDGE_TIMER_MAX` | seedlingDemo/bridges.js | 60 | rule | magnitude | Scenery/Tile.as:bridgeOpeningTimerMax |
| `BRIDGE_STATE` | seedlingDemo/bridges.js | 29 | rule | sentinel |  |
| `ON_SCREEN_RADIUS` | seedlingDemo/bridges.js | 64 | rule | bound |  |
| `TICKS_FROM_PRESS_TO_WALKABLE` | seedlingDemo/bridges.js | 60 | rule | magnitude |  |
| `SCREEN_W` | seedlingDemo/camera.js | 160 | rule | bound |  |
| `SCREEN_H` | seedlingDemo/camera.js | 160 | rule | bound |  |
| `CAMERA_SPEED_DIVISOR` | seedlingDemo/camera.js | 10 | rule | magnitude | Game.as:cameraSpeedDivisorDef |
| `INVENTORY_WIDTH` | seedlingDemo/camera.js | 66 | rule | magnitude |  |
| `INVENTORY_OFFSET_X` | seedlingDemo/camera.js | -70 | rule | magnitude |  |
| `FP_ELAPSED` | seedlingDemo/chasers.js | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED |
| `FRICTION` | seedlingDemo/chasers.js | 0.25 | physics | magnitude | Mobile.as:DEFAULT_FRICTION |
| `VELOCITY_EPSILON` | seedlingDemo/chasers.js | 0.05 | physics | bound |  |
| `ENEMY_PIT_TILE` | seedlingDemo/chasers.js | 6 | rule | sentinel |  |
| `ENEMY_IFRAMES` | seedlingDemo/combat.js | 30 | rule | magnitude | Enemies/Enemy.as:hitsTimerMax |
| `SLASH_TIMER_MAX` | seedlingDemo/combat.js | 20 | rule | magnitude | Player.as:slashTimerMax |
| `KILL_LOCK_TSET` | seedlingDemo/combat.js | -1 | rule | sentinel |  |
| `SWORD_FORCE` | seedlingDemo/combatVerbs.js | 5 | physics | magnitude | Player.as:swordForce |
| `SLASH_DASH_FORCE` | seedlingDemo/combatVerbs.js | 2 | physics | magnitude |  |
| `SWORD_ANIM_RATE` | seedlingDemo/combatVerbs.js | 30 | rule | magnitude | Player.as:swordSpeed |
| `SWORD_ANIM_RATE_DASH` | seedlingDemo/combatVerbs.js | 20 | rule | magnitude | Player.as:swordSpeedDash |
| `SPECIAL_TIMER_MAX` | seedlingDemo/dialogue.js | 150 | rule | magnitude | Pickups/Pickup.as:specialTimerMax |
| `PICKUP_TEXT_SPEED` | seedlingDemo/dialogue.js | 6 | rule | magnitude | Pickups/Pickup.as:DEF_TEXT_SPEED |
| `PICKUP_LINE_LENGTH` | seedlingDemo/dialogue.js | 32 | rule | bound |  |
| `INITIAL_FRAMES_THIS_CHARACTER` | seedlingDemo/dialogue.js | 0 | rule | magnitude | Game.as:framesThisCharacter |
| `NPC_LINE_LENGTH_DEFAULT` | seedlingDemo/dialogue.js | 28 | rule | bound | NPCs/NPC.as:_lineLength |
| `TALK_RANGE` | seedlingDemo/endingChain.js | 24 | rule | bound | NPCs/NPC.as:talkRange |
| `COVER_ALPHA_RATE` | seedlingDemo/endingChain.js | 0.005 | rule | magnitude | Pickups/Seed.as:coverAlphaRate |
| `TREE_GROW_FRAME_RATE` | seedlingDemo/endingChain.js | 3.5 | rule | magnitude |  |
| `TREE_GROW_FRAMES` | seedlingDemo/endingChain.js | 16 | rule | count |  |
| `FP_ELAPSED_CLAMPED` | seedlingDemo/finalBossFight.js | 0.0333 | physics | magnitude |  |
| `ROCK_FREQUENCY` | seedlingDemo/finalBossRng.js | 6 | rule | magnitude | Enemies/FinalBoss.as:rockFrequency |
| `GRENADE_FREQUENCY` | seedlingDemo/finalBossRng.js | 40 | rule | magnitude | Enemies/FinalBoss.as:grenadeFrequency |
| `ROCK_STEPS_AHEAD` | seedlingDemo/finalBossRng.js | -15 | rule | magnitude | Enemies/FinalBoss.as:stepsAhead |
| `ROCK_RADIUS` | seedlingDemo/finalBossRng.js | 20 | rule | bound | Enemies/FinalBoss.as:radius |
| `DEATH_ROCKS` | seedlingDemo/finalBossRng.js | 5 | rule | count |  |
| `ROCK_SCALE_BASE` | seedlingDemo/finalBossRng.js | 0.25 | physics | magnitude |  |
| `ROCK_SCALE_SPAN` | seedlingDemo/finalBossRng.js | 0.5 | physics | magnitude |  |
| `ENEMY_COINS_BASE` | seedlingDemo/finalBossRng.js | 4 | rule | magnitude |  |
| `ENEMY_COINS_SPAN` | seedlingDemo/finalBossRng.js | 4 | rule | magnitude |  |
| `FIRE_HIT_FRAME_START` | seedlingDemo/fireVerb.js | 3 | rule | bound | Player.as:fireHitFrameStart |
| `FIRE_HIT_FRAME_END` | seedlingDemo/fireVerb.js | 6 | rule | bound | Player.as:fireHitFrameEnd |
| `FIRE_FORCE` | seedlingDemo/fireVerb.js | 0.325 | physics | magnitude | Player.as:fireForce |
| `FIRE_DAMAGE` | seedlingDemo/fireVerb.js | 0 | rule | magnitude | Player.as:fireDamage |
| `GAME_FPS` | seedlingDemo/gameClock.js | 60 | rule | magnitude | Main.as:FPS |
| `HITBOX_ORIGIN_X` | seedlingDemo/levelWorld.js | 2 | physics | magnitude | Player.as:normalHitbox |
| `HITBOX_ORIGIN_Y` | seedlingDemo/levelWorld.js | 2 | physics | magnitude | Player.as:normalHitbox |
| `BRIDGE_STATE` | seedlingDemo/levelWorld.js | 29 | rule | sentinel |  |
| `WATER_STATE` | seedlingDemo/levelWorld.js | 1 | rule | sentinel |  |
| `LAVA_STATE` | seedlingDemo/levelWorld.js | 17 | rule | sentinel |  |
| `WATERFALL_STATE` | seedlingDemo/levelWorld.js | 25 | rule | sentinel |  |
| `DEFAULT_FRICTION` | seedlingDemo/playerPhysicsV1.js | 0.25 | physics | magnitude | Mobile.as:DEFAULT_FRICTION |
| `WATER_FRICTION` | seedlingDemo/playerPhysicsV1.js | 0.5 | physics | magnitude | Mobile.as:WATER_FRICTION |
| `WALK_SPEED` | seedlingDemo/playerPhysicsV1.js | 0.8 | physics | magnitude | Player.as:dMS |
| `STAIR_SPEED` | seedlingDemo/playerPhysicsV1.js | 0.4 | physics | magnitude | Player.as:dMSstair |
| `WATER_SPEED` | seedlingDemo/playerPhysicsV1.js | 0.45 | physics | magnitude | Player.as:dMSwater |
| `SLIDING_SPEED` | seedlingDemo/playerPhysicsV1.js | 1 | physics | magnitude | Player.as:slidingSpeed |
| `SLIDING_FRICTION` | seedlingDemo/playerPhysicsV1.js | 0.025 | physics | magnitude | Player.as:slidingFriction |
| `INITIAL_TERRAIN_STATE` | seedlingDemo/playerPhysicsV2.js | 0 | rule | sentinel | Player.as:_state |
| `PIT_STATE` | seedlingDemo/playerPhysicsV2.js | 6 | rule | sentinel |  |
| `WATER_STATE` | seedlingDemo/playerPhysicsV2.js | 1 | rule | sentinel |  |
| `LAVA_STATE` | seedlingDemo/playerPhysicsV2.js | 17 | rule | sentinel |  |
| `ICE_STATE` | seedlingDemo/playerPhysicsV2.js | 22 | rule | sentinel |  |
| `WATERFALL_STATE` | seedlingDemo/playerPhysicsV2.js | 25 | rule | sentinel |  |
| `INITIAL_DIRECTION` | seedlingDemo/playerPhysicsV2.js | 3 | rule | sentinel | Player.as:direction |
| `DIRECTION_RIGHT` | seedlingDemo/playerPhysicsV2.js | 0 | rule | sentinel |  |
| `DIRECTION_UP` | seedlingDemo/playerPhysicsV2.js | 1 | rule | sentinel |  |
| `DIRECTION_LEFT` | seedlingDemo/playerPhysicsV2.js | 2 | rule | sentinel |  |
| `DIRECTION_DOWN` | seedlingDemo/playerPhysicsV2.js | 3 | rule | sentinel |  |
| `SLIDING_FRICTION` | seedlingDemo/playerPhysicsV2.js | 0.025 | physics | magnitude | Player.as:slidingFriction |
| `SLIDING_SPEED` | seedlingDemo/playerPhysicsV2.js | 1 | physics | magnitude | Player.as:slidingSpeed |
| `WATERFALL_ACCELERATION` | seedlingDemo/playerPhysicsV2.js | 0.8 | physics | magnitude | Player.as:waterfallAcceleration |
| `DROWN_TIMER_MAX` | seedlingDemo/playerPhysicsV2.js | 10 | rule | magnitude | Player.as:drownTimerMax |
| `FALL_ALPHA_SPEED` | seedlingDemo/playerPhysicsV2.js | 0.05 | rule | magnitude | Player.as:fallAlphaSpeed |
| `FALL_ALPHA_START` | seedlingDemo/playerPhysicsV2.js | 1 | rule | magnitude |  |
| `FALL_LERP_DIVISOR` | seedlingDemo/playerPhysicsV2.js | 10 | physics | magnitude |  |
| `DESCENT_DROP` | seedlingDemo/playerPhysicsV2.js | 83 | physics | magnitude |  |
| `DESCENT_GRAVITY` | seedlingDemo/playerPhysicsV2.js | 0.1 | physics | magnitude |  |
| `DESCENT_MAX_FALL` | seedlingDemo/playerPhysicsV2.js | 5 | physics | bound |  |
| `BOUNCE_VELOCITY` | seedlingDemo/playerPhysicsV2.js | -2 | physics | magnitude |  |
| `SWORD_DAMAGE` | seedlingDemo/presses.js | 1 | rule | magnitude | Player.as:swordDamage |
| `DARK_SWORD_DAMAGE` | seedlingDemo/presses.js | 2 | rule | magnitude | Player.as:darkSwordDamage |
| `SPEAR_DAMAGE` | seedlingDemo/presses.js | 2 | rule | magnitude | Player.as:spearDamage |
| `SLASH_REACH` | seedlingDemo/presses.js | 16 | physics | bound |  |
| `SPEAR_LENGTH` | seedlingDemo/presses.js | 32 | physics | magnitude | Player.as:length |
| `SPEAR_THICK` | seedlingDemo/presses.js | 5 | physics | magnitude | Player.as:thick |
| `ENEMY_HITS_MAX` | seedlingDemo/presses.js | 3 | rule | count | Enemies/Enemy.as:hitsMax |
| `ENEMY_HITS_TIMER` | seedlingDemo/presses.js | 30 | rule | magnitude | Enemies/Enemy.as:hitsTimerMax |
| `SLASH_HIT_TICKS` | seedlingDemo/presses.js | 5 | rule | count |  |
| `LIGHTPOLE_HITS_TIMER_MAX` | seedlingDemo/presses.js | 25 | rule | magnitude | Scenery/LightPole.as:hitsTimerMax |
| `RIGHT` | seedlingDemo/presses.js | 0 | rule | sentinel |  |
| `UP` | seedlingDemo/presses.js | 1 | rule | sentinel |  |
| `LEFT` | seedlingDemo/presses.js | 2 | rule | sentinel |  |
| `DOWN` | seedlingDemo/presses.js | 3 | rule | sentinel |  |
| `FP_MAX_ELAPSED` | seedlingDemo/pulser.js | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED |
| `TILE` | seedlingDemo/pushables.js | 16 | physics | magnitude | Scenery/Tile.as:w |
| `PUSHABLE_SPEED` | seedlingDemo/pushables.js | 0.5 | physics | magnitude | Puzzlements/PushableBlockFire.as:moveSpeed |
| `PUSHABLE_FRICTION` | seedlingDemo/pushables.js | 0.25 | physics | magnitude | Mobile.as:DEFAULT_FRICTION |
| `ALPHA_FADE` | seedlingDemo/pushables.js | 0.1 | rule | magnitude |  |
| `RIGHT` | seedlingDemo/pushables.js | 0 | rule | sentinel |  |
| `UP` | seedlingDemo/pushables.js | 1 | rule | sentinel |  |
| `LEFT` | seedlingDemo/pushables.js | 2 | rule | sentinel |  |
| `DOWN` | seedlingDemo/pushables.js | 3 | rule | sentinel |  |
| `BOTH_RANGE` | seedlingDemo/pushables.js | 0.1 | physics | bound | Puzzlements/PushableBlockFire.as:bothRange |
| `FP_ELAPSED_CLAMPED` | seedlingDemo/r6AnimClock.js | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED |
| `BOOT_PRESWAP_FRAMES` | seedlingDemo/r7Acceptance.js | 1 | rule | magnitude |  |
| `XOR_MASK` | seedlingDemo/rng.js | 0x48000000 | rule | magnitude |  |
| `BOOT_SEED` | seedlingDemo/rng.js | 1486967168 | rule | magnitude |  |
| `HASH_C1` | seedlingDemo/rng.js | 1376312589 | rule | magnitude |  |
| `HASH_C2` | seedlingDemo/rng.js | 789221 | rule | magnitude |  |
| `HASH_C3` | seedlingDemo/rng.js | 15731 | rule | magnitude |  |
| `RANDOM_DIVISOR` | seedlingDemo/rng.js | 2147483648 | rule | magnitude |  |
| `STATE_MAX` | seedlingDemo/rng.js | 2147483647 | rule | bound |  |
| `FP_ELAPSED_CLAMPED` | seedlingDemo/shieldBossFight.js | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED |
| `SWIM_LENGTH_FRAMES` | seedlingDemo/swimSoundClock.js | 47 | rule | magnitude |  |
| `SWIM_BOOST_BELOW_SECONDS` | seedlingDemo/swimSoundClock.js | 0.1 | physics | bound |  |
| `SWIM_BOOST_SPEED` | seedlingDemo/swimSoundClock.js | 0.25 | physics | magnitude |  |
| `LOAD_DEAD_FRAMES` | seedlingDemo/swimSoundClock.js | 20 | rule | magnitude |  |
| `CEREMONY_FREEZE_FRAMES` | seedlingDemo/swimSoundClock.js | 150 | rule | magnitude | Pickups/Pickup.as:specialTimerMax |
| `PIN_FRAME_RATE` | seedlingDemo/tapeFormat.js | 60 | rule | magnitude | Main.as:FPS |
| `COERCED_TERRAIN_STATE` | seedlingDemo/tapeFormat.js | 0 | rule | sentinel |  |
| `LEVEL_COUNT` | seedlingDemo/tapeFormat.js | 116 | rule | count |  |
| `TILE_W` | seedlingDemo/wandShot.js | 16 | physics | magnitude | Scenery/Tile.as:w |
| `WAND_SPEED` | seedlingDemo/wandVerb.js | 3 | physics | magnitude | Player.as:wandSpeed |

| table | file | literals | physics/rule | classes | kinds | AS3 |
|---|---|---|---|---|---|---|
| `MAGICAL_LOCK_TYPE_BY_TAG` | seedlingDemo/levelWorld.js | 2 | 2 | rule | sentinel | Game.as:2148-2149 |
| `UNMODELLED_REASON` | seedlingDemo/levelWorld.js | 1 | 1 | rule | sentinel |  |
| `LIGHTPOLE_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude |  |
| `WATCHER_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude | Player.as:1112-1115 Watcher.as:49 NPC.as:47 |
| `SPINNER_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude |  |
| `FINAL_BOSS_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude | FinalBoss.as:52 |
| `FORCED_TSET` | seedlingDemo/levelWorld.js | 3 | 3 | rule | sentinel | Puzzlements/ShieldLock.as:26 Game.as:2144-2145 BossLock.as:31 Game.as:2199 |
| `FORCED_TAG` | seedlingDemo/levelWorld.js | 5 | 5 | rule | sentinel | Scenery/MoonrockPile.as:23 NPCs/Statue.as:20 Stairs.as:20 |
| `UNTOUCHABLE_CLEARS` | seedlingDemo/levelWorld.js | 2 | 2 | rule | sentinel | FinalDoor.as:50 |
| `CLIFFSIDE_CLASS` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude | Game.as:2009-2015 |
| `PICKUP_CEREMONY_BY_KEYTYPE` | seedlingDemo/dialogue.js | 1 | 1 | rule | sentinel |  |
| `PLACED_NPC_TALK` | seedlingDemo/dialogue.js | 2 | 2 | rule | bound | NPCs/NPC.as Player.as:59 NPC.as:205 NPCs/Watcher.as:46 NPC.as:41 NPC.as:46 NPCs/Statue.as:20 Game.as:2265-2282 |
| `WATCHER` | seedlingDemo/endingChain.js | 10 | 10 | physics/rule | bound/count/magnitude | NPCs/Watcher.as:hitsTimerMax |
| `WATCHER_FLAG` | seedlingDemo/endingChain.js | 2 | 2 | rule | sentinel | Scenery/FinalDoor.as FinalDoor.as:50 |
| `FINAL_DOOR` | seedlingDemo/endingChain.js | 9 | 9 | physics/rule | bound/count/magnitude |  |
| `SEED_ARMS` | seedlingDemo/endingChain.js | 3 | 3 | rule | magnitude/sentinel | Game.as:2194 |
| `SEED_CEREMONY_FRAMES` | seedlingDemo/endingChain.js | 2 | 2 | rule | count/magnitude | Game.as:956 |
| `SEED_BOX` | seedlingDemo/endingChain.js | 4 | 4 | physics | magnitude | Pickups/Seed.as:36 |
| `CUTSCENE_1_WALK` | seedlingDemo/endingChain.js | 2 | 2 | physics | bound/magnitude | Game.as:955-960 |
| `ORACLE` | seedlingDemo/endingChain.js | 2 | 2 | physics | magnitude | NPCs/Oracle.as:94-121 |
| `CREDITS` | seedlingDemo/endingChain.js | 2 | 2 | rule | sentinel |  |
| `RESPONDERS` | seedlingDemo/activators.js | 6 | 6 | rule | magnitude | RockLock.as:40-47 |
| `WEST_PROBE` | seedlingDemo/activators.js | 2 | 2 | physics | sign | Puzzlements/ShieldLock.as:30-41 ShieldLock.as:26 Puzzlements/ShieldLock.as:32 |
| `KEY_RESPONDERS` | seedlingDemo/activators.js | 2 | 2 | rule | magnitude | Puzzlements/BossLock.as:59-88 |
| `FALL_RESPONDER_ROOMS` | seedlingDemo/activators.js | 6 | 6 | rule | sentinel |  |
| `FALL_ROCK` | seedlingDemo/fallRock.js | 11 | 11 | physics/rule | magnitude | Scenery/FallRock.as:fallRate Scenery/FallRock.as:waitToFallTimerMax Scenery/FallRock.as:cameraTimerMax |
| `PLAYER_SNAP` | seedlingDemo/fallRock.js | 2 | 2 | physics | magnitude | Player.as:295 |
| `DESTROYING_TILE_TYPES` | seedlingDemo/pushables.js | 3 | 3 | rule | sentinel |  |
| `PUSH_STEP` | seedlingDemo/pushables.js | 8 | 8 | physics | sign | Player.as:1103 |
| `SPEAR_HIT_TICKS_UNMODELLED` | seedlingDemo/presses.js | 3 | 3 | rule | magnitude |  |
| `FIRE_SPRITE` | seedlingDemo/fireVerb.js | 6 | 6 | physics/rule | count/magnitude | Player.as:53 |
| `FIRE_PRESS_CADENCE` | seedlingDemo/fireVerb.js | 1 | 1 | rule | derivation |  |
| `FIRE_RADIUS` | seedlingDemo/fireVerb.js | 1 | 1 | physics | derivation |  |
| `FIRE_ON_ENEMY` | seedlingDemo/fireVerb.js | 1 | 1 | rule | magnitude |  |
| `BREAK_ANIM` | seedlingDemo/breakableRocks.js | 2 | 2 | rule | count/magnitude | BreakableRock.as:40 |
| `BURN_ANIM` | seedlingDemo/burnableTree.js | 2 | 2 | rule | count/magnitude |  |
| `BURN_SPRITE` | seedlingDemo/burnableTree.js | 2 | 2 | physics | magnitude |  |
| `WAIT_AFTER_PRESS_TICKS` | seedlingDemo/burnableTree.js | 1 | 1 | rule | derivation |  |
| `SPINNER_CTOR_RNG` | seedlingDemo/spinner.js | 2 | 2 | rule | count | Enemy.as:30 Enemy.as:35 Spinner.as:24 FP.as:404-422 |
| `HAMMER_BILLING` | seedlingDemo/spinner.js | 2 | 2 | physics/rule | magnitude | Spinner.as:72-76 Player.as |
| `CHASERS` | seedlingDemo/chasers.js | 8 | 8 | physics/rule | count/magnitude |  |
| `ENEMY_TERRAIN_DESTROYS` | seedlingDemo/chasers.js | 2 | 2 | rule | sentinel | Enemies/Enemy.as:68-103 |
| `CRUSHER` | seedlingDemo/crusher.js | 9 | 8 | physics/rule | bound/magnitude | Puzzlements/Crusher.as:intDist Puzzlements/Crusher.as:speed Puzzlements/Crusher.as:damage Puzzlements/Crusher.as:force Puzzlements/Crusher.as:spinRate |
| `DIRECTIONS` | seedlingDemo/crusher.js | 8 | 8 | physics | sign | Puzzlements/Crusher.as:directions |
| `CEREMONY_RULE` | seedlingDemo/crusher.js | 1 | 1 | rule | magnitude |  |
| `PLAYER_DAMAGE_PATHS` | seedlingDemo/crusher.js | 4 | 4 | rule | sentinel | LavaTrap.as:72 Player.as:1379 |
| `BOSS_TOTEM` | seedlingDemo/bossTotem.js | 14 | 14 | physics/rule | count/derivation/magnitude | Enemies/BossTotem.as:setHitbox Enemies/BossTotem.as:rumblingTimeMax Enemies/BossTotem.as:activationRate Enemies/BossTotem.as:n Enemies/BossTotem.as:activationRestTimeMax Enemies/BossTotem.as:waitAtTopTimeMax Enemies/BossTotem.as:playerPosSet Enemies/BossTotem.as:hitsMax Enemies/BossTotem.as:hitsTimerMax |
| `WAND_PICKUP` | seedlingDemo/bossTotem.js | 10 | 10 | physics/rule | derivation/magnitude/sentinel | Pickups/Wand.as:setHitbox Pickups/Wand.as:alphaRate Pickups/Wand.as:tset Pickups/Pickup.as:specialTimerMax |
| `DEF_HEAD_POS` | seedlingDemo/bossTotemFight.js | 2 | 2 | physics | magnitude | Enemies/BossTotem.as:defHeadPos |
| `BOSS_TOTEM_BODY` | seedlingDemo/bossTotemFight.js | 7 | 7 | physics/rule | magnitude | Enemies/BossTotem.as:setHitbox Enemies/Enemy.as:hitPlayer Enemies/BossTotem.as:hitsTimerMax |
| `BOSS_TOTEM_KILL` | seedlingDemo/bossTotemFight.js | 4 | 4 | rule | count/magnitude | Enemies/BossTotem.as:hitsMax Enemies/BossTotem.as:hitsTimerMax |
| `BOSS_TOTEM_SHOT` | seedlingDemo/bossTotemFight.js | 13 | 13 | physics/rule | bound/derivation/magnitude | Projectiles/BossTotemShot.as:setHitbox |
| `BOSS_TOTEM_DEATH_BLAST` | seedlingDemo/bossTotemFight.js | 5 | 5 | physics/rule | derivation/magnitude | Projectiles/Explosion.as:radiusCoeff |
| `BOSS_TOTEM_WHITE_OUT` | seedlingDemo/bossTotemFight.js | 3 | 3 | rule | magnitude/sentinel | Enemies/BossTotem.as:rumblingTimeMax |
| `SHIELD_BOSS` | seedlingDemo/shieldBossFight.js | 15 | 14 | physics/rule | bound/count/derivation/magnitude | Enemies/ShieldBoss.as:setHitbox Enemies/Enemy.as:hitsMax Enemies/Enemy.as:hitsTimerMax Enemies/ShieldBoss.as:swingTimeMax Enemies/ShieldBoss.as:swingForce |
| `BOSS_KEY` | seedlingDemo/shieldBossFight.js | 7 | 7 | physics/rule | derivation/magnitude | Pickups/BossKey.as:setHitbox Pickups/Pickup.as:specialTimerMax |
| `FINAL_BOSS_ANIMS` | seedlingDemo/finalBossFight.js | 8 | 4 | rule | count/magnitude | FinalBoss.as:47-50 |
| `ROCKFALL_BREAK_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude | Scenery/RockFall.as Scenery/Pod.as Enemies/Grenade.as |
| `POD_OPEN_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude |  |
| `GRENADE_EXPLODE_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude |  |
| `GRENADE_HIT_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude |  |
| `ROCK_FALL` | seedlingDemo/finalBossFight.js | 5 | 5 | physics/rule | magnitude | Scenery/RockFall.as:fallHeight Scenery/RockFall.as:g Scenery/RockFall.as:startingSpeed Scenery/RockFall.as:force Scenery/RockFall.as:damage |
| `GRENADE` | seedlingDemo/finalBossFight.js | 8 | 8 | physics/rule | bound/magnitude | Enemies/Grenade.as:hitRadius Enemies/Grenade.as:force |
| `OWL_DRAW_SITES` | seedlingDemo/finalBossRng.js | 10 | 10 | rule | count |  |
| `ICE_TURRET_BLAST` | seedlingDemo/iceTurretBlast.js | 9 | 9 | physics/rule | count/magnitude | Enemies/IceTurret.as:shotSpeed Enemies/IceTurret.as:distBtwnShots |
| `FREEZE_SPAN` | seedlingDemo/iceTurretBlast.js | 1 | 1 | rule | derivation |  |
| `BLAST_DAMAGE` | seedlingDemo/iceTurretBlast.js | 4 | 4 | physics/rule | magnitude |  |
| `BLAST_PLAN` | seedlingDemo/iceTurretBlast.js | 3 | 3 | rule | magnitude |  |
| `WAND_SPRITE` | seedlingDemo/wandVerb.js | 11 | 3 | physics/rule | count/magnitude | Player.as:48-51 |
| `FIRE_WAND_SPRITE` | seedlingDemo/wandVerb.js | 11 | 2 | rule | count/magnitude |  |
| `WAND_PRESS_CADENCE` | seedlingDemo/wandVerb.js | 1 | 1 | rule | derivation |  |
| `WAND_FACING_RULE` | seedlingDemo/wandVerb.js | 1 | 1 | rule | magnitude |  |
| `WAND_DIRECTIONS` | seedlingDemo/wandVerb.js | 5 | 5 | physics/rule | derivation/sentinel |  |
| `WAND_SHOT_ANIMS` | seedlingDemo/wandShot.js | 10 | 2 | rule | count/magnitude |  |
| `WAND_SHOT_DEATH` | seedlingDemo/wandShot.js | 2 | 2 | rule | derivation |  |
| `WAND_SHOT_CULL` | seedlingDemo/wandShot.js | 3 | 3 | physics/rule | derivation/magnitude |  |
| `WAND_SHOT_GRAZE` | seedlingDemo/wandShot.js | 4 | 4 | physics | sign |  |
| `WAND_SHOT_PLAN` | seedlingDemo/wandShot.js | 1 | 1 | physics | magnitude |  |
| `MAGICAL_LOCK_TYPES` | seedlingDemo/magicalLock.js | 2 | 2 | rule | sentinel | Game.as:2148-2149 |
| `WAND_SHOT_TYPES` | seedlingDemo/magicalLock.js | 2 | 2 | rule | sentinel | Projectiles/WandShot.as:29 |
| `MAGICAL_LOCK_GEOMETRY` | seedlingDemo/magicalLock.js | 6 | 6 | physics | magnitude |  |
| `MAGICAL_LOCK_DESTROY_ANIM` | seedlingDemo/magicalLock.js | 9 | 2 | rule | count/magnitude |  |
| `MAGICAL_LOCK_CALLBACK_TICK_OFFSET` | seedlingDemo/magicalLock.js | 1 | 1 | rule | derivation |  |
| `MAGICAL_LOCK_MATRIX` | seedlingDemo/magicalLock.js | 8 | 8 | rule | sentinel |  |
| `INVENTORY_TERM` | seedlingDemo/camera.js | 2 | 2 | rule | derivation |  |
| `SHAKE_WRITERS` | seedlingDemo/camera.js | 3 | 3 | rule | magnitude |  |
| `RANDOM_RANGE` | seedlingDemo/camera.js | 2 | 2 | rule | bound |  |
| `CAMERA_DEAD_ZONE_RESIDUE` | seedlingDemo/camera.js | 2 | 2 | rule | bound |  |
| `PLAYER_DAMAGE` | seedlingDemo/playerDamage.js | 5 | 4 | rule | count/magnitude | Player.as:hitsTimerMax Player.as:hitsTimerInt |
| `KNOCKBACK_COMPARATORS` | seedlingDemo/playerDamage.js | 1 | 1 | physics | bound | Player.as:1500 |
| `KILL_CADENCE_FLOOR` | seedlingDemo/combat.js | 1 | 1 | rule | derivation |  |
| `ENEMY_DAMAGE_DEFAULTS` | seedlingDemo/enemyDamage.js | 7 | 4 | physics/rule | count/magnitude/sentinel | Enemies/Enemy.as:damage Enemies/Enemy.as:hitsMax Enemies/Enemy.as:hitsTimerMax Enemies/Enemy.as:maxForce |
| `MOBILE_DEATH_FADE` | seedlingDemo/enemyDamage.js | 3 | 3 | rule | magnitude | Image.as:157 |
| `PIT_FADE` | seedlingDemo/enemyDamage.js | 3 | 3 | rule | magnitude | Enemies/Enemy.as:fallAlphaSpeed |
| `SLASH_SPRITES` | seedlingDemo/combatVerbs.js | 6 | 6 | physics | magnitude | Player.as:41-45 |
| `SLASH_SCALE_NORMAL` | seedlingDemo/combatVerbs.js | 2 | 2 | physics | magnitude | Player.as:1258-1265 |
| `SLASH_SCALE_DASH` | seedlingDemo/combatVerbs.js | 2 | 2 | physics | magnitude |  |
| `SWORD_DAMAGE` | seedlingDemo/combatVerbs.js | 3 | 3 | rule | magnitude |  |
| `KILL_PRESS_CADENCE` | seedlingDemo/combatVerbs.js | 1 | 1 | rule | derivation |  |
| `SLASH_ANIM_TICKS` | seedlingDemo/combatVerbs.js | 2 | 2 | rule | count | Player.as:392-393 |
| `CHEST` | seedlingDemo/chest.js | 9 | 9 | physics/rule | count/magnitude | Chest.as:openTimerMax Chest.as:m |
| `SEAL_DRAW` | seedlingDemo/chest.js | 6 | 5 | rule | count/derivation | SealController.as:SEALS |
| `SEAL_PIECE` | seedlingDemo/sealCeremony.js | 10 | 10 | physics/rule | bound/magnitude | Pickups/Pickup.as:attractDistance Pickups/Pickup.as:motionDampener Pickups/Pickup.as:minAttraction Pickups/Pickup.as:minSpeedToPlayer Pickups/Pickup.as:specialTimerMax Mobile.as:DEFAULT_FRICTION |
| `SEAL_CONTROLLER` | seedlingDemo/sealCeremony.js | 2 | 2 | rule | magnitude | SealController.as:waitTime SealController.as:alphaSteps |
| `CEREMONY_DEAD_FRAMES` | seedlingDemo/sealCeremony.js | 1 | 1 | rule | magnitude | Pickups/Pickup.as:specialTimerMax |
| `ARROW_TRAP` | seedlingDemo/arrowTrap.js | 11 | 11 | physics/rule | derivation/magnitude | Puzzlements/ArrowTrap.as:shootTimerMax Puzzlements/ArrowTrap.as:shootTimer |
| `ARROW` | seedlingDemo/arrowTrap.js | 8 | 6 | physics | magnitude | Projectiles/Arrow.as:setHitbox |
| `ARROW_ENEMY_HIT` | seedlingDemo/arrowTrap.js | 7 | 7 | physics/rule | count/derivation/magnitude | Enemies/Enemy.as:hitsMax Enemies/Enemy.as:hitsTimerMax |
| `ARROW_PLAYER_ARM` | seedlingDemo/arrowTrap.js | 2 | 2 | physics/rule | magnitude | Arrow.as:51 |
| `ARROW_KILL_PLAN` | seedlingDemo/arrowTrap.js | 10 | 9 | rule | derivation/magnitude |  |
| `BUILD_SPAWN` | seedlingDemo/tapeFormat.js | 3 | 3 | physics/rule | magnitude/sentinel | Main.as:51 Bot.as |
| `KEY_CODES` | seedlingDemo/tapeFormat.js | 8 | 8 | rule | sentinel | Player.as:59 Key.as |
| `HAZARD_STATES` | seedlingDemo/tapeFormat.js | 5 | 5 | rule | sentinel |  |
| `ITEM_PROPERTIES` | seedlingDemo/tapeFormat.js | 2 | 2 | rule | count/magnitude | Player.as:hitsMaxDef |
| `INVENTORY_ITEM_IDS` | seedlingDemo/tapeFormat.js | 6 | 6 | rule | sentinel | Inventory.as:277-318 |
| `SAVE_SLOTS` | seedlingDemo/tapeFormat.js | 3 | 3 | rule | count | Player.as:totemParts Player.as:totalKeys SealController.as:SEALS |
| `MOVE_SPEEDS` | seedlingDemo/playerPhysicsV1.js | 1 | 1 | physics | derivation | Player.as:moveSpeeds |
| `HITBOX` | seedlingDemo/playerPhysicsV1.js | 4 | 4 | physics | magnitude | Player.as:560-561 Player.as:295 |
| `TILE` | seedlingDemo/playerPhysicsV1.js | 2 | 2 | physics | magnitude | Scenery/Tile.as:w Scenery/Tile.as:h |
| `SPAWN_OFFSET` | seedlingDemo/playerPhysicsV1.js | 2 | 2 | physics | derivation | Player.as:357 Game.as:2034-2037 |
| `LEVEL0_WORLD` | seedlingDemo/playerPhysicsV1.js | 2 | 2 | physics | bound | Main.as:36 Game.as:1854-1855 |
| `CHECK_OFFSET_Y` | seedlingDemo/playerPhysicsV1.js | 1 | 1 | physics | derivation | Player.as:checkOffsetY |
| `BLACK_COVER` | seedlingDemo/gameClock.js | 2 | 2 | rule | magnitude | Game.as:blackCover Game.as:blackCoverRate |
| `LOAD_FADE_FRAMES` | seedlingDemo/gameClock.js | 7 | 1 | rule | bound | Game.as:blackCover |
| `PICKUP_HELP_DEAD_FRAMES` | seedlingDemo/gameClock.js | 1 | 1 | rule | magnitude | Pickups/Sword.as:42-49 Inventory.as:174 Game.as:961 |
| `TIME_RATE` | seedlingDemo/gameClock.js | 1 | 1 | rule | magnitude | Game.as:timeRate |
| `DAY_LENGTH_FRAMES` | seedlingDemo/gameClock.js | 1 | 1 | rule | derivation | Game.as:dayLength |
| `PAGE_BOOT_TIME` | seedlingDemo/gameClock.js | 1 | 1 | rule | derivation | Main.as:158 Main.as:51 |
| `NO_BOUNCE_STATES` | seedlingDemo/playerPhysicsV2.js | 3 | 3 | rule | sentinel | Player.as:490 |
| `TILE_TYPE_SEMANTICS` | flashPanel/seedlingSemantics.js | 8 | 8 | rule | sentinel |  |
| `SEEDLING_PLAYER_BOX` | flashPanel/seedlingSemantics.js | 2 | 2 | physics | magnitude | Player.as:normalHitbox |
| `CLIFFSIDE_FRAME_FACES` | flashPanel/seedlingSemantics.js | 4 | 4 | rule | sentinel | Game.as:2084-2089 Scenery/CliffSide.as:15-34 |
| `DIRECTIONS` | flashPanel/seedlingSemantics.js | 8 | 8 | rule | sign |  |

<!-- CENSUS:seedling-constants END -->
