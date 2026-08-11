/**
 * seedlingDemo/levelRun — ONE run of the v2 engine across levels, with the
 * end-of-tick world swap in it.
 *
 * v2 slice 4. This is a factoring, not a new mechanism: every line below
 * was `tapeRunner`'s loop, and it moved here the moment a SECOND caller
 * appeared. `botDriverV2` has to advance the same physics through the same
 * transitions while CHOOSING each tick's keys instead of reading them off a
 * tape, and the two ways of getting a held-key set must not each grow their
 * own idea of what a world swap is.
 *
 * That is not a tidiness argument. The swap is five coupled facts — the
 * arrival offset, the zeroed velocity, the reset terrain state, the
 * pre-armed latch, and the destination world's own `beforeTypeFlip` tick —
 * and a second copy would agree with the first exactly until one of them
 * was edited. The differential could not catch it either, because the
 * driver's copy is what SYNTHESIZES the tape the differential then runs
 * through the runner's copy: they would be wrong together and the tape
 * would still reconcile. (The same failure mode as a verifier sharing the
 * generator's assumptions, and the same fix — one implementation.)
 *
 * ── What this owns, and what it does not ──────────────────────────────
 * It owns: which level we are in, that level's world, the physics state,
 * the latch, the `beforeTypeFlip` flag, the transition log, and the count
 * of completed ticks. It does NOT own the observation stream — that is
 * RECORD-THEN-ACT bookkeeping and belongs to whoever is recording (see
 * `tapeRunner`), because "record the state, then advance" is a rule about
 * the AS3 hook's position, not about the engine.
 *
 * Worlds are built lazily and memoised, for the reason `playerPhysicsV2`'s
 * docblock gives: `buildLevelWorld` throws by name on geometry v2 does not
 * model, and that throw should fire when a run walks INTO a level, naming
 * it, rather than eagerly for all 116.
 */

import {
    PLAYER_SOLID_TYPES,
    addedTimeKey, buildLevelWorld, normalizeLiveOpts, rect, rectsOverlap,
} from './levelWorld.js';
import {
    INITIAL_FRAMES_THIS_CHARACTER, PICKUP_CEREMONY, PICKUP_CEREMONY_BY_KEYTYPE,
    PICKUP_TEXT_FROM_ATTRIBUTE, TALK_KEY,
    beginDialogue, stepDialogue,
} from './dialogue.js';
// ⛓⛓⛓ R6 SLICE 6c: the ENDING's own transcription — the placed NPC's
// dialogue and its radius. `endingChain` reaches `r6Acceptance` and through
// it `fixtures/index.js`, which is node-only; that is sound here because
// `levelRun` has no browser consumer (the watch page reads `watchViewer`).
import {
    BLOODY_SEED_TEXT, CREDITS, CUTSCENE_1_WALK, CUTSCENE_2_HOLD, FINAL_DOOR, ORACLE,
    SEED_ARMS, TALK_RANGE, WATCHER, WATCHER_FLAG, beginNpcDialogue, bloodySeedDue,
    bloodySeedEntity, boxHitsWatcherSeed, coverFadeFrames, freshFinalDoor, inTalkRange,
    seedBoxAt, stepFinalDoor, stepNpcDialogue, treeSchedule, watcherSeedBox,
    watcherTakesHit,
} from './endingChain.js';
import {
    createActivatorState, openActivatorIds, pressedGroups, ropePublish, stepActivators,
} from './activators.js';
import {
    createFallRock, fallRockFreezeTicks, fallRockRect, publishActivate, stepFallRock,
} from './fallRock.js';
import {
    BridgeError, TICKS_FROM_PRESS_TO_WALKABLE, withinOnScreenRadius,
} from './bridges.js';
import {
    createPushableState, hitPushable, movedPushables, pushableRects,
    pushablesSettled, stepPushables,
} from './pushables.js';
import {
    DARK_SWORD_DAMAGE, FIRE_ARM_POLICY, LIGHTPOLE_HITS_TIMER_MAX, PRESS_ARM_POLICY,
    SLASH_HIT_TICKS, SLASH_REACH, SPEAR_DAMAGE, SWORD_DAMAGE, auditFire, auditPress,
    distanceRectPoint, slashRect, spearRect,
} from './presses.js';
import { FIRE_PRESS_CADENCE, FIRE_WINDOW, fireRect } from './fireVerb.js';
import { hitPushableFromPoint } from './pushables.js';
import {
    brokenRockIds, createRockState, hitRock, outOfBandFlagFor, rockBreaksUnder,
} from './breakableRocks.js';
import {
    burnTree, burnWrites, burnedTreeIds, createBurnState,
} from './burnableTree.js';
import {
    SPINNER, createSpinnerState, hitSpinner, spinnerRects, spinnerTerrainWrites, stepSpinners,
} from './spinner.js';
// ⛓⛓⛓ R8 SLICE 1: THE ENEMY BRIDGE. `chasers.js` has transcribed the walk
// exactly since R5 slice 3 and nothing has ever called it — this import IS
// the slice. The roster it is gated on (`bridgedChaserTags`) is DERIVED from
// `CHASERS` x `MODELLED_ENEMY_CLASSES`, never typed here.
import {
    ENEMY_PIT_TILE, ENEMY_TERRAIN_DESTROYS, chaserBoxAt, chaserSolids, chaserStep,
    isBridgedChaser,
} from './chasers.js';
import { CRUSHER, alwaysArmed, crusherRect, scanCrusher, stepCrusher } from './crusher.js';
import {
    createBossTotem, bossTotemClampY, bossTotemSolidRect, renderBossTotem, stepBossTotem,
    wandFadeFreezeTicks, wandFadeGateOpen, WAND_PICKUP,
} from './bossTotem.js';
// ⛓⛓⛓ R6 SLICE 4: the FOURTEENTH family — the fight itself, and the only
// per-visit body on the roster that publishes projectiles of its own.
import {
    BOSS_TOTEM_BODY, BOSS_TOTEM_DEATH_BLAST, BOSS_TOTEM_FIGHT, BOSS_TOTEM_KILL,
    BOSS_TOTEM_SHOT, BOSS_TOTEM_WHITE_OUT, bossTotemBodyRect, bossTotemCameraTarget,
    bossTotemShotRect, bossTotemTakesHit, stepBossTotemShot,
} from './bossTotemFight.js';
import {
    BOSS_KEY, SHIELD_BOSS, advanceShieldBossGraphic, createShieldBoss, shieldBossBandRect,
    shieldBossBodyRect, shieldBossDeathSchedule, shieldBossTakesHit, shieldBossWindowFor,
    stepShieldBoss,
} from './shieldBossFight.js';
// ⛓⛓⛓ R6 SLICE 6f: the FIFTEENTH family — the Owl, and the first fight on
// the ladder whose GAMEPLAY reads random numbers. `finalBossRng` is the
// per-tick DRAW SCHEDULE the fight consumes; `finalBossFight` is the fight.
import {
    FINAL_BOSS, GRENADE, ROCK_FALL, advanceFinalBossGraphic, advanceOwlGrenadeGraphic,
    advancePodGraphic, advanceRockFallGraphic, createFinalBoss, createOwlGrenade, createPod,
    createRockFall, finalBossBox, finalBossDeathSchedule, finalBossHit, finalBossLavaVerdict,
    firstTileUnder, owlGrenadeReaches, podIsLethal, pointDistance, rockFallBox, setPodOpen,
    stepFinalBoss, stepOwlGrenade, stepRockFall,
} from './finalBossFight.js';
import {
    OWL_LEVEL_BUILD_DRAWS, OwlDrawStream, assertOwlStreamPremises, owlTickDraws,
} from './finalBossRng.js';
import {
    createIceTurret, hitIceTurret, iceTurretRect, iceTurretSettled, stepIceTurret,
    bumpIceTurret,
} from './iceTurret.js';
// ⛓⛓⛓ R5 SLICE 22: the ELEVENTH family, and the first that is created
// inside a window rather than placed by an `.oel`.
import {
    ICE_TURRET_BLAST, blastIsSpent, stepIceTurretBlast,
} from './iceTurretBlast.js';
// ⛓⛓⛓ R6 SLICE 2: the THIRTEENTH family — the first projectile the PLAYER
// makes, so the first per-visit body a tape is responsible for.
import { WAND_PRESS_CADENCE, WAND_WINDOW, wandPress } from './wandVerb.js';
import {
    WAND_SHOT_CULL, createWandShot, stepWandShot, stepWandShotGraphic, wandShotRect,
} from './wandShot.js';
import {
    createMagicalLock, hitMagicalLock, magicalLockIsSolid, stepMagicalLock,
} from './magicalLock.js';
// ⛓⛓⛓ R5 SLICE 22: `Game.view()`, LIVE. Transcribed at slice 2 for the
// contact envelope and consumed by nothing until a turret's own rest
// position turned out to depend on it — see `cam` below.
import {
    initialCamera, onScreen as camOnScreen, stepCamera,
    // ⛓⛓⛓ R6 SLICE 3: the shake half. `stepCameraBand` is what the camera
    // becomes once a hit lands — see `stepCameraNow` below.
    bandIsExact, cameraBand, onScreenUnderShake, shakeAcrossLoad, stepCameraBand,
    // ⛓ R6 SLICE 4: the writers table, DRIVEN — the totem writes two of the
    // roster's three shakes and both are `=`, not `+=`.
    applyShakeWriter,
} from './camera.js';
// ⛓⛓⛓ R6 SLICE 3: `Player.hit`/`knockback`/`hitUpdate`/`die`, and the
// contact source that calls them. `noDamage` stops being a refusal here.
import {
    DEATH_REBOOT, PLAYER_DAMAGE, canSteer, createPlayerDamage, playerHit, stepPlayerDamage,
} from './playerDamage.js';
import {
    TYPE_REWRITING_ENEMIES, contactPricing, contactRect, enemyHitPlayerFires,
} from './combat.js';
import { LEGACY_FADE_PER_LOAD } from './deadFrameBand.js';
// ⛓⛓⛓ R5 SLICE 21: the kill's LEDGER half. `killLockLedger` is what turns
// the R4 refusal's reason — "a death moves totalEnemies(), which opens
// tSet == -1 locks" — from a blanket policy into an arithmetic the run
// computes at every kill.
import { MOBILE_DEATH_FADE, killLockLedger } from './enemyDamage.js';
// ⚠ `SWORD_FORCE` ONLY. `combatVerbs` owns the swing GEOMETRY, which this
// file does not use — the press rect comes from `presses.slashRect` — but
// `Player.as:116`'s `swordForce` has one home and this is it.
import { SWORD_FORCE } from './combatVerbs.js';
import { ledgerKey, outOfBandFlagForWriter } from './outOfBandLedger.js';
import { createChestState, stepChests } from './chest.js';
import {
    CEREMONY_DEAD_FRAMES, createSealPiece, sealControllerTicks, sealPieceBox, stepSealPiece,
} from './sealCeremony.js';
import { PULSER, createPulser, pulseReaches, pulsePushes, stepPulser } from './pulser.js';
// ⛓⛓⛓ R7 SLICE 6b: the SIXTEENTH family. An `ArrowTrap` is the pulsers'
// shape with the sign flipped — an `Activators` with a `t` that is Solid
// NEITHER way — so its live state lives here beside theirs and never in
// `activators`.
import {
    ARROW_KILL_PLAN, arrowLane, arrowRect, arrowTrapFires, createArrow, createArrowTrap,
    lanesOver, shadowOf, stepArrow, stepArrowTrap,
} from './arrowTrap.js';
import {
    ITEM_PROPERTIES, ITEM_NAMES, inventorySlotsFor, SAVE_SLOTS,
    seamFieldsFromBlock,
} from './tapeFormat.js';
import { clampFor, spawnFromBoot } from './playerPhysicsV1.js';
import {
    CEREMONY_FREEZE_FRAMES, LOAD_DEAD_FRAMES, stepChannel,
} from './swimSoundClock.js';
import {
    INITIAL_DIRECTION,
    INITIAL_HAZARD_FLAGS,
    INITIAL_TERRAIN_STATE,
    arriveAtRespawn,
    arriveFromFall,
    arriveIn,
    initialLatch,
    playerBoxAt,
    step as stepV2,
} from './playerPhysicsV2.js';

/**
 * The inventory a fresh boot starts from — every boolean false, `hitsMax`
 * at `Player.hitsMaxDef` (3).
 *
 * ⚠ THIS IS A MIRROR, NOT THE ORACLE. `Bot.as` writes the real `Player`
 * statics and `botStatus.items` reads them back, and that readout is what
 * an acceptance assertion must consult. This object exists so the JS engine
 * can be asked "which items would the game have by now" without a second
 * source of truth about WHEN — the two sides share the tick contract, not
 * the storage. A test that asserted an item from here instead of from the
 * game's own report would be asserting that this file agrees with itself.
 */
export function initialInventory() {
    const inv = {};
    for (const name of ITEM_NAMES) {
        const spec = ITEM_PROPERTIES[name];
        inv[spec.property] = spec.kind === 'add' ? spec.base : false;
    }
    return inv;
}

/** Apply one item name to an inventory mirror, in place. */
function applyItem(inventory, name) {
    const spec = ITEM_PROPERTIES[name];
    if (spec.kind === 'add') inventory[spec.property] += spec.value;
    else inventory[spec.property] = true;
}

/**
 * Start a run at `boot`, in the level the boot names.
 *
 * @param {object}   opts
 * @param {Function} opts.levelSource  `(level) => levelRecord` — the ONE seam
 *                                     by which real geometry enters
 * @param {object}   opts.boot         `{level, x, y}` GAME CONSTRUCTOR args;
 *                                     the half-tile spawn offset is applied here
 * @param {boolean}  opts.noclip       the tape's flag: picks the arm of the AS3's
 *                                     `Bot.noclip ? null : collideTypes(...)`
 * @param {Array}    [opts.noHazards]  the tape's hazard-name set (R0)
 * @param {boolean}  [opts.noDamage]   the tape's flag (R0). Carried, not
 *                                     consumed — see the note on `noDamage` below.
 * @param {Array}    [opts.grants]     the tape's `{level, items}` list (R0)
 * @returns {{
 *   level: number, world: object, state: object, transitions: Array,
 *   ticksCompleted: number, advance: (held: Set<string>) => object,
 * }} a live view — `level`/`state`/... are getters over the run's own state,
 *    so a caller may hold the object and read fields after each `advance`.
 *
 * ⛔⛔⛔ R5 SLICE 22: `noDamage` IS NOW CONSUMED, AND THE NOTE IT REPLACES
 * WAS WRONG IN THE ONE WAY THAT MATTERED.
 *
 * It used to read: *"a bounded vacuity rather than an oversight. The JS
 * engine models no enemy, no projectile and no trap, so there is no site at
 * which `Player.hit()` would have been called — `noDamage: false` is
 * equally inert here."* The premise held until this slice and the
 * CONCLUSION never did. `IceTurretBlast` calls `Player.freeze(15)` on the
 * line ABOVE `Player.hit`, and only `hit` is behind
 * `if (Bot.noDamage) return` — so the flag was never a switch between "the
 * blast does something" and "the blast does nothing"; it was a switch
 * between two different things the blast does. A model that had built the
 * projectile while still believing the note would have priced the freeze
 * behind the flag and been wrong on every tape.
 *
 * ⇒ what `noDamage` now buys is a REFUSAL: a blast that reaches the player
 * on a tape without it throws, because `hits`/`hitsTimer`/`Game.shake` are
 * state this model does not carry. The freeze is charged either way.
 * [[feedback_nodamage_prices_damage_not_freeze]]
 */
export function createLevelRun({
    levelSource, boot, noclip = false, noHazards = [], noDamage = false, grants = [],
    persistence = [], equips = [], roles,
    /**
     * ⛓⛓⛓ R7 SLICE 6e: the tape's version-10 `despawn` LIST — the witnessed
     * mid-run ENEMY REMOVAL, threaded here for `persistence[].at`'s reason
     * exactly one class along.
     *
     * `combat.contactPricing` REFUSES a `mover` body by name (below), so a
     * walk past `bob@112,48` in L6 is a recording this model cannot replay
     * at all — not a walk it replays wrongly. The game removes the body
     * itself (`Enemy.update`'s `case 1: //Water`), and this is how the model
     * is told, at the tick a driven arm witnessed it by.
     *
     * ⚠ It reaches the RUN and not merely the tape header for the `pins`
     * lesson's reason: a field a gate reads must be threaded to the gate.
     */
    despawn = [],
    // R5 slice 4: the tape's `pins` list, threaded to the physics. The swim
    // sound term is only modellable under `pins: ["sound"]`, and `stepV2`
    // REFUSES a wet tick without it rather than modelling the term as zero
    // — so this has to reach the step, not merely be recorded on the tape.
    pins = [],
    /**
     * ⛓⛓⛓ R5 SLICE 23: the tape's version-6 SAVE-ARRAY BOOT BLOCK.
     *
     * `{totem_parts, keys, seal_parts}` — indices, not booleans, and
     * `seal_parts` is an ordered collection LOG (see `tapeFormat.SAVE_SLOTS`).
     * It reaches this run because a gate READS it: `Wand.update`'s body is
     * behind `Player.hasAllTotemParts()`, so a run that recorded the field
     * on the tape header and did not thread it here would model an inert
     * pickup while the game ran a ceremony — the `pins` failure one version
     * back, exactly.
     */
    save = null,
    /**
     * ⛓⛓⛓ R6 SLICE 6f: the tape's version-7 `rng` BLOCK, threaded for the
     * `pins`/`save` reason one version on — and this time the field is not
     * merely READ by a gate, it IS the model.
     *
     * L112 is the first room on the ladder whose GAMEPLAY reads random
     * numbers: every rock's aim, every rock's hitbox and the camera's own
     * jiggle come out of one stream whose position is the sum of everything
     * drawn before them. A runner that kept `rng` on the tape header would
     * model an Owl fight from an unknown stream position — which is not a
     * small error but an unstated one, because the run would still produce
     * numbers. `assertOwlStreamPremises` refuses the whole fight without it.
     *
     * ⚠ THE DEFAULT IS THE PRE-R6 TAPE'S. `{seed: 0, split: false}` is what
     * every fixture written before slice 6a declares, and it means "inherit
     * the page's stream" — an ORIGIN no model has. Nothing but the Owl asks,
     * so nothing but the Owl is refused.
     */
    rng = null,
    /**
     * ⛓⛓⛓ R7 SLICE 1: the tape's version-8 `seam` BLOCK, threaded for the
     * `pins`/`save`/`rng` reason one version on.
     *
     * A SEGMENT boots the state its predecessor ended with, and most of that
     * state is read at BUILD time: `Karlore.added()` removes itself when
     * `Player.hasFire` (`levelWorld.ADDED_TIME_REMOVAL`), `BossTotemPart`
     * and `BossKey` remove themselves in the `check()` of a new world's
     * first frame, `Game.cutscene[2]` decides whether the player spawns
     * inert. So the same rule the save arrays are under applies here: a
     * runner that recorded the block on the tape header and did not thread
     * it would build a DIFFERENT WORLD from the one the game builds.
     *
     * ⚠ NOT EVERY FIELD IS MODELLED, and `SEAM_BOOT_SPEC[].modelled` is the
     * list. `beam`, `rock_set`, `time`, `grass_cut`, `secondary`,
     * `first_use`, `extended`, the two music fields and `menu_state` are
     * carried, validated and compared AT THE SEAM, and no physics here
     * reads them. Saying which is which is the difference between a
     * declared field and a silently ignored one.
     */
    seam = null,
}) {
    if (typeof levelSource !== 'function') {
        throw new TypeError('createLevelRun needs a levelSource (level) => levelRecord');
    }

    // `roles` is the census a caller consults (see `levelWorld.ROLES`).
    // Undefined means the builder's own default, which is ALL roles — so
    // every pre-R0 caller keeps exactly the census it had.
    const worlds = new Map();
    /**
     * ⛓ THE ITEM MIRROR, DECLARED HERE BECAUSE A WORLD READS IT (R5).
     *
     * `levelWorld.ADDED_TIME_REMOVAL`: `Karlore.added()` runs inside
     * `new Game(48, ...)` and removes the NPC when `Player.hasFire`, so a
     * level's GEOMETRY is a function of the inventory at construction. The
     * grants machinery below is what fills this in; it lives above
     * `worldFor` only because a builder cannot read a binding that has not
     * been evaluated yet.
     *
     * ⚠ AND THE BOOT WORLD IS BUILT FROM AN EMPTY ONE, on purpose. A boot
     * grant is applied AFTER the world exists — which is exactly what the
     * game does, `Bot` applying its grant list after `new Game` has already
     * run every `added()`. §15.8: **a boot is not an entry.**
     */
    const inventory = initialInventory();
    /**
     * ⛓ R7: the v8 seam's declared BOOT STATE, as a map keyed by the seam
     * signature's own field names.
     *
     * ⛔ APPLIED BEFORE THE FIRST WORLD IS BUILT — which is the whole
     * difference between this and a `grants` row. A grant fires on the first
     * OBSERVATION tick in its level, by which time the world already exists
     * and every `added()` has run; the note on `inventory` above says so and
     * §15.8 makes it a law ("a boot is not an entry"). A seam declares what
     * the run STARTED with.
     */
    const seamBoot = seamFieldsFromBlock(seam);
    for (const name of ITEM_NAMES) {
        const spec = ITEM_PROPERTIES[name];
        const declared = seamBoot[`save.${spec.property}`];
        if (declared !== undefined) inventory[spec.property] = declared;
    }
    /**
     * ⛓⛓⛓ R5 SLICE 23: THE SAVE-ARRAY MIRROR.
     *
     * ⚠ A MIRROR, not the oracle. `botStatus.save` reports the GAME's own
     * `Player.hasTotemPart(i)` / `hasKey(i)` / `Main.hasSealPart(i)`, and
     * the differential compares them against these — so a boot block one
     * side honoured and the other dropped is a named failure at the first
     * observation rather than a ceremony that mysteriously never starts.
     *
     * ⛔ `sealParts` IS AN ARRAY OF SLOTS, initialised to -1, because that
     * is what the array IS. A `Set` of identities would be a different data
     * structure that happens to answer one of the two questions.
     */
    const bootSave = save ?? { totem_parts: [], keys: [], seal_parts: [] };
    const totemParts = new Set(bootSave.totem_parts ?? []);
    const sealParts = Array.from({ length: SAVE_SLOTS.seal_parts }, () => -1);
    (bootSave.seal_parts ?? []).forEach((identity, slot) => { sealParts[slot] = identity; });
    const hasAllTotemParts = () => totemParts.size >= SAVE_SLOTS.totem_parts;
    /**
     * R2: the tape's persistence clears, indexed BY LEVEL.
     *
     * A clear is `(level, tag)` and a world is built per level, so the run
     * hands each level only its own tags. Passing the whole list would make
     * `buildLevelWorld`'s orphan guard fire for every level that does not
     * happen to own one — which is every level but a handful.
     */
    const clearedByLevel = new Map();
    for (const c of persistence) {
        if (c.at !== undefined) continue;
        if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
        clearedByLevel.get(c.level).push(c.tag);
    }
    /**
     * ⛓⛓⛓ R7 slice 6d: THE WITNESSED MID-RUN CLEARS (`at`), pending until
     * their tick. See `tapeFormat`'s v9 docblock for the ruling and for why
     * this is not a staged grant.
     *
     * ⛔ AND THIS ONE IS APPLIED MID-VISIT, unlike `pendingEarnedClears`
     * below, because that is what the GAME does: `Lock.turnOff()` writes the
     * flag and the lock stops being in the way while the player is still
     * standing in the room. A clear cashed on the transition path would
     * arrive after the very crossing it exists to open.
     *
     * ⚠ WHAT A MID-VISIT REBUILD COSTS, named rather than assumed: dropping
     * the world memo makes the next `worldFor` build a room without the
     * despawned entity — and the per-visit RUNTIME state (activators,
     * pushables, spinners, crushers, turrets) is deliberately NOT dropped,
     * because the game removes ONE entity and does not rebuild the room. The
     * oracle for that claim is not this comment: it is the differential's
     * byte-exact "the model reproduces the recording", which replays a tape
     * whose arrow traps are armed across this very tick.
     */
    const timedClears = persistence.filter((c) => c.at !== undefined)
        .map((c) => ({ ...c })).sort((a, b) => a.at - b.at);
    const applyTimedClears = (tick) => {
        for (const c of timedClears) {
            if (c.applied || c.at !== tick) continue;
            c.applied = true;
            if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
            const list = clearedByLevel.get(c.level);
            if (!list.includes(c.tag)) list.push(c.tag);
            worlds.delete(c.level);
            /**
             * ⛔⛔ AND THE LIVE BINDING IS REFRESHED, which dropping the memo
             * does NOT do. `world` is a `let` set at construction and rebound
             * only in `enterWorld` — so the first cut of this cleared the map
             * and left the run holding the old room, and the model walked
             * into a lock the game had already removed for another 75 ticks.
             * The tell was a byte-exact replay that stopped 1.34 px short of
             * a teleporter it should have crossed.
             */
            if (c.level === level) world = worldFor(c.level);
        }
    };
    /**
     * ⚠ THE CLEARS THE PLAYER EARNS (R3), pending until the next entry.
     *
     * `Lock.turnOff()` calls `Game.setPersistence(tag, false)`, and
     * `Lock.check()` — which runs on a NEW `Game`'s first frame — is
     * `tag >= 0 && tSet < 0 && !checkPersistence(tag) -> remove(this)`. So a
     * shield lock the player opens is not merely non-solid for this visit:
     * it is GONE the next time the level loads, exactly as a declared clear
     * would have made it.
     *
     * The route depends on that. R3's walk goes out through L71's shield
     * lock to reach darksuit and comes BACK through the same corridor to
     * L71's pit — and a model that rebuilt the level with the lock standing
     * would send the return leg into a wall the game does not have.
     *
     * ⚠ PENDING, not immediate. The world is memoised per level, and
     * dropping the memo while the run is still standing in that level would
     * despawn the lock mid-visit — a tick early, and on the very tick the
     * player is inside it. So the tag is banked here and cashed in the
     * transition path, when the destination's world is built.
     */
    const pendingEarnedClears = new Map();
    const applyEarnedClears = (n) => {
        const tags = pendingEarnedClears.get(n);
        if (!tags) return;
        pendingEarnedClears.delete(n);
        if (!clearedByLevel.has(n)) clearedByLevel.set(n, []);
        const list = clearedByLevel.get(n);
        for (const tag of tags) if (!list.includes(tag)) list.push(tag);
        // Drop the memo so the next `worldFor` rebuilds with the tag — which
        // is what `Lock.check()` does to a freshly constructed `Game`.
        worlds.delete(n);
        activatorStates.delete(n);
    };
    /**
     * ⛓⛓⛓ R7 slice 6e: THE DESPAWNED BODIES, BY LEVEL — and they are removed
     * from the level RECORD rather than from any one list the world derives.
     *
     * ⛔ THAT IS THE WHOLE OF THE CHOICE. A body is in `combat.enemies`, in
     * the avoid volumes the planner reads, in `Game.totalEnemies()`'s count
     * and in whatever the next role adds; filtering the census alone would
     * remove it from the contact test and leave it in the planner's — one
     * body, two answers. Dropping the ENTITY is the only edit that cannot
     * disagree with itself, and it is also exactly what the game did.
     */
    const despawnedByLevel = new Map();
    const despawnIdOf = (e) => `${e.type}@${e.x},${e.y}`;
    const recordFor = (n) => {
        const rec = levelSource(n);
        const gone = despawnedByLevel.get(n);
        if (!gone || gone.size === 0) return rec;
        const kept = rec.entities.filter((e) => !gone.has(despawnIdOf(e)));
        if (kept.length === rec.entities.length) {
            throw new Error(`levelRun: despawn names [${[...gone].join(' ')}] in level `
                + `${n} and the level record has no such placement. The id is a level `
                + 'record identity ("<type>@<x>,<y>"), and a despawn nobody can find is '
                + 'a declaration that silently removes nothing — which reads exactly '
                + 'like one that worked.');
        }
        return { ...rec, entities: kept };
    };
    const worldFor = (n) => {
        if (!worlds.has(n)) {
            const opts = { ...(roles ? { roles } : {}), inventory };
            if (clearedByLevel.has(n)) opts.cleared = clearedByLevel.get(n);
            worlds.set(n, buildLevelWorld(recordFor(n), opts));
        }
        return worlds.get(n);
    };
    /**
     * The despawns, pending until their tick — `applyTimedClears`' twin, and
     * deliberately its twin down to the live-binding refresh.
     *
     * ⛔⛔ TRAP 149, THE SECOND CUSTOMER. `world` is a `let` rebound only in
     * `enterWorld`, so dropping the memo alone would leave the run holding
     * the room the body is still standing in — and the tell would be the
     * same one slice 6d chased: a byte-exact replay that stops short of
     * somewhere it should have walked through. Both halves, or neither.
     *
     * ⚠ MID-VISIT, like a mid-run clear and for the same reason: the game
     * removes ONE entity while the player is still in the room and does not
     * rebuild it, so the per-visit runtime state (activators, pushables,
     * spinners, crushers, turrets) is deliberately NOT dropped here.
     */
    const timedDespawns = despawn.map((d) => ({ ...d })).sort((a, b) => a.at - b.at);
    const applyTimedDespawns = (tick) => {
        for (const d of timedDespawns) {
            if (d.applied || d.at !== tick) continue;
            d.applied = true;
            if (!despawnedByLevel.has(d.level)) despawnedByLevel.set(d.level, new Set());
            despawnedByLevel.get(d.level).add(d.id);
            worlds.delete(d.level);
            if (d.level === level) world = worldFor(d.level);
            /**
             * ⛔⛔ R8 SLICE 1: AND THE ONE BODY LEAVES THE LIVE ROSTER —
             * TARGETED, NEVER A ROSTER DROP.
             *
             * The docblock above is right that per-visit state is not
             * dropped here, and a chaser roster is exactly why it matters:
             * L6 declares ONE despawn (`bob@112,48`, the body the game's own
             * water drowned) and the OTHER bob has been walking since tick 1.
             * Dropping the roster would rebuild BOTH at their `.oel` cells
             * and teleport the survivor backwards; leaving it alone would
             * keep a body the game removed. Remove exactly the one named.
             */
            const st = chaserStates.get(d.level);
            const body = st?.get(d.id);
            if (body) body.removed = true;
        }
    };
    /**
     * ⛓ A MEMOISED WORLD CAN GO STALE FOR A SECOND REASON (R5 slice 4).
     *
     * `applyEarnedClears` drops the memo when a flag the player turned off
     * changes what the next `Game` builds. A held ITEM does the same thing
     * through a different door: `new Game(n, ...)` re-runs every `added()`,
     * so a level first entered without `fire` and re-entered with it is
     * built twice and differently.
     *
     * ⚠ CASHED ON THE TRANSITION PATH ONLY, and for exactly the reason the
     * earned clears are: dropping a memo while the run is standing IN that
     * level would remove the entity mid-visit — and mid-visit is the one
     * time the game does NOT, because `added()` has already run. An item
     * picked up in L48 does not make Karlore vanish under the player's
     * feet; the next `new Game(48, ...)` is what does.
     */
    const dropWorldIfBuiltStale = (n) => {
        const w = worlds.get(n);
        if (!w || w.addedTimeKey === addedTimeKey(inventory)) return;
        worlds.delete(n);
        activatorStates.delete(n);
        pushableStates.delete(n);
        // R5 slice 13: the spinner roster is built from the world, so a
        // rebuilt world needs a rebuilt roster — the same reason the blocks'
        // does. (Nothing an item grants adds or removes a spinner today;
        // it is dropped anyway, because "no item does" is a claim about the
        // current census and not about the mechanism.)
        spinnerStates.delete(n);
        // ⛓ R8 slice 1: the chaser roster is built from the world's census,
        // so a rebuilt world needs a rebuilt roster — the spinner's reason
        // exactly. (No item grants or removes a chaser today; dropped
        // anyway, because "no item does" is a claim about the census.)
        chaserStates.delete(n);
        // R5 slice 15: the crusher roster is built from the world too. No
        // item grants or removes one today; dropped anyway, for the reason
        // the spinner's is.
        crusherStates.delete(n);
        // ⛓ R5 slice 20: and the turret roster, for the strongest version of
        // that reason — a rebuild does not just move it, it REVIVES it.
        turretStates.delete(n);
        // ⛓ R5 slice 23: and the boss, whose only persistence write is its
        // DEATH — so a rebuild gets an unwoken boss and its wall back.
        bossStates.delete(n);
        // ⛓⛓ R6 slice 5: and the ShieldBoss, whose rebuild re-arms
        // `activated` — the swallowed first hit is a per-ENTRY dispatch, so
        // a run that carried the flag across a rebuild would spend three
        // swings for four hits and never land the last one.
        shieldBossStates.delete(n);
        // ⛓⛓⛓ R6 slice 6f: and the Owl, whose rebuild re-arms `started`,
        // `rockfallTime`, `cpod`, `hitThisSequence` and `hits` — every one of
        // them an instance field — and rebuilds his four pods, each replaying
        // its constructor's `play("open")`. ⛔ THE DRAW STREAM IS NOT DROPPED:
        // the generator is a `public static`, so its position is a fact about
        // the PAGE and a re-entry pays a SECOND level build from wherever the
        // first visit left it. `owlStreamFor` refuses a second room rather
        // than modelling a position it has not measured.
        finalBossStates.delete(n);
        podStates.delete(n);
        owlRocks = [];
        owlGrenades = [];
        owlPendingRocks = [];
        owlPendingGrenades = [];
        // ⛓ R6 slice 6c: and the watcher, whose rebuild re-arms `talked` —
        // see `watcherStateFor`. Nothing an item grants adds or removes one;
        // dropped anyway, for the reason the spinner's is.
        watcherStates.delete(n);
        // ⛓ R6 slice 6c: and the door, whose rebuild re-arms `seenSeal`.
        finalDoorStates.delete(n);
        bridgeStates.delete(n);
    };
    /**
     * R2: per-level activator state (buttons, locks, covers).
     *
     * ⚠ PER LEVEL AND PER VISIT. `Game` is reconstructed on every world
     * swap, so a Lock that was open when the player left is a fresh
     * `type = normType` when they come back — unless the persistence its
     * `turnOff()` wrote is what despawns it, which is a different
     * mechanism entirely. Memoising this alongside the world would keep a
     * lock open across a round trip the game closes.
     */
    const activatorStates = new Map();
    const activatorStateFor = (n) => {
        const w = worldFor(n);
        if (!activatorStates.has(n)) activatorStates.set(n, createActivatorState(w));
        return activatorStates.get(n);
    };
    const freshActivatorState = (n) => {
        activatorStates.set(n, createActivatorState(worldFor(n)));
        return activatorStates.get(n);
    };
    /**
     * ── R4: THE TWO THINGS A PRESS CHANGES, both PER VISIT ─────────────
     *
     * `openBridges` is `bridgeId -> {pressTick, walkableAt}` and
     * `pushableStates` is `pushables.createPushableState`'s own object. They
     * are a THIRD lifetime beside the two this file already holds, and the
     * three must not be collapsed:
     *
     *   declared clears   the tape's, for the whole run
     *   EARNED clears     banked, cashed when the destination is built —
     *                     `Lock.check()` despawns on a cleared flag, so an
     *                     opened shield lock is gone next visit too
     *   THESE             gone the moment the level is rebuilt
     *
     * `Tile.bridgeOpeningTimer` and `PushableBlockFire.tile` are instance
     * variables with no persistence at all, so a re-entered level rebuilds
     * the bridge CLOSED and the block IN THE CORRIDOR. The R4 route walks
     * back through L63, and a model that banked either would plan the
     * return through a door the game has shut.
     */
    const bridgeStates = new Map();
    const pushableStates = new Map();
    /**
     * R5 slice 5: the breaking rocks, per VISIT.
     *
     * ⚠ AND PER VISIT IS THE TRANSCRIPTION, not a simplification.
     * `BreakableRock.check()` removes a rock only when
     * `tag >= 0 && !Game.checkPersistence(tag)`; L92's two are BOTH
     * `tag = -1`, so every `new Game(92, ...)` rebuilds them whole and a
     * walk that comes back pays for both again. Keyed like the bridges,
     * cleared like them on a world swap.
     */
    const rockStates = new Map();
    /**
     * ⛓⛓ R5 slice 12: the BURNING trees, per VISIT — the eighth family.
     *
     * ⚠ PER VISIT even though L40's tree is `tag 0` and persists, because
     * the two lifetimes answer different questions: this map is "is the
     * 2x2 solid there RIGHT NOW, forty-one ticks into an animation", and
     * the flag is "will the next `new Game` build it at all". A tree burned
     * in this visit is gone from `solids` by this set; a tree burned in an
     * EARLIER visit is gone because `buildLevelWorld` never made it
     * (`treeBuiltIn`).
     */
    const burnStates = new Map();
    const bridgeStateFor = (n) => {
        if (!bridgeStates.has(n)) bridgeStates.set(n, new Map());
        return bridgeStates.get(n);
    };
    const rockStateFor = (n) => {
        if (!rockStates.has(n)) rockStates.set(n, createRockState());
        return rockStates.get(n);
    };
    const burnStateFor = (n) => {
        if (!burnStates.has(n)) burnStates.set(n, createBurnState());
        return burnStates.get(n);
    };
    /**
     * ⛓ R5 SLICE 7: THE ROPES THIS VISIT HAS PULLED, per level.
     *
     * `RopeStart.hit()` is the fifth per-visit geometry family and it is
     * the first one that SHRINKS rather than removing or flipping a type:
     * `setHitbox(16, 16, 8, 8)` leaves a one-cell solid at the span's
     * start. So the set is ids and the geometry query swaps the rect —
     * `levelWorld.collidesSolid`'s `pulledRopes` arm.
     *
     * ⚠ PER VISIT, and it is not merely bookkeeping: `hit()`'s whole body
     * is behind `if (!activate)`, and `check()` re-derives `activate` from
     * `Game.checkPersistence(tag)` on the next `new Game`. Since this pull
     * also BANKS the clear ({39,9}), a re-entry rebuilds the rope already
     * shrunk — through `clearedHere2`, not through this set.
     */
    const ropeStates = new Map();
    const ropeStateFor = (n) => {
        if (!ropeStates.has(n)) ropeStates.set(n, new Set());
        return ropeStates.get(n);
    };
    /**
     * ⛓ R5 SLICE 6/7: THE SOLIDS THAT PRESS. `Button.update` collides
     * `["Player", "Enemy", "Solid"]` and a pushed block is a `"Solid"` —
     * which is the intended solution to L39 and, `pressedGroups`' docblock
     * has said since R2, to more than one room. Slice 6 gave
     * `stepActivators` the parameter; this is the caller that fills it, and
     * without it the whole shaft is a model that says the covers never open.
     *
     * ⚠ A REMOVED block is not a presser. `pushableRects` keeps the entry
     * with `removed: true` (absent and gone are different facts), so the
     * filter is here rather than in the reader.
     */
    const movingSolidsNow = () => {
        const out = [];
        const st = pushableStateFor(level);
        if (st.byId.size > 0) {
            for (const [id, r] of pushableRects(st)) {
                if (!r.removed) out.push({ id, rect: r.rect });
            }
        }
        /**
         * ⛓⛓⛓ R5 SLICE 15: AND A CRUSHER IS A PRESSER TOO.
         *
         * `Button.update` collides `["Player","Enemy","Solid"]` and excludes
         * only a `Cover`; `Crusher.type` is `"Solid"`. So a crusher parked on
         * a button holds it down — and in L41 that is not a curiosity, it is
         * the room's SOLUTION: the crusher is the only Solid that can reach
         * `button@248,232`, and that button is what holds `cover@112,128`
         * open long enough for the room's one block to be pushed at all.
         *
         * ⚠ IT REACHES EVERY CONSUMER OF THIS LIST, and each one is right:
         * `Cover.update`'s occupancy arm (`["Solid","Player"]`) and
         * `Lock.returnToNormal`'s (`["Player","Enemy","Solid"]`) both hold
         * open for a Solid in their own cell, and a parked crusher is one.
         * A list that carried it for the PRESS and not for the OCCUPANCY
         * would be the two-member-list shape again.
         */
        for (const [id, c] of crusherRectsNow() ?? []) out.push({ id, rect: c.rect });
        /**
         * ⛓⛓⛓ R5 SLICE 21: AND AN ICE TURRET PRESSES ONE BOTH WAYS ROUND.
         *
         * `Button.update`'s `hitables` is `["Player", "Enemy", "Solid"]` and
         * the only thing it excludes is a `Cover`. An `IceTurret` is `type =
         * "Enemy"` while it lives and `type = "Solid"` once the corpse
         * latches — so it is in that list on BOTH sides of the kill, and
         * this loop deliberately emits every body rather than only the
         * standing corpses.
         *
         * ⛔⛔ THAT IS WHY LINK 4 IS OPENABLE AT ALL. `button@480,384 {t 2}`
         * is the one activator in L40 that no block reaches and the player
         * cannot hold and walk through — and a 16x16 corpse shoved two tiles
         * north sits on it. This list is the seam where that becomes true.
         *
         * ⚠ AND EVERY OTHER ENEMY IN THE ROOM IS A NAMED VACUITY — BOUNDED,
         * NOT ABSENT. Each of L40's fifteen chasers is `type = "Enemy"` and
         * would press a button it wandered onto; this model does not
         * simulate their positions, so a button under one is a button this
         * run reports UNPRESSED that the game might not. Measured rather
         * than waved at — the six activators and their nearest chaser at
         * spawn:
         *
         *   buttonroom@272,208 {t0}   bob@304,144        72 px  ⚠
         *   buttonroom@880,768 {t3}   bobsoldier@880,832 64 px  ⚠
         *   buttonroom@160,128 {t1}   bob@272,112       113 px
         *   button@480,384     {t2}   bob@352,416       132 px  <- link 4
         *   button@816,400     {t4}   puncher@816,128   272 px
         *   button@768,400     {t5}   puncher@816,128   276 px
         *
         * The two flagged are inside a `runRange` of 80 and are exactly the
         * two no modelled leg touches; link 4's own button is 132 px from
         * the nearest chaser's SPAWN, which is a fact about the spawn and
         * not about the walk — which is why `runFire`'s `enemyRoom`
         * declaration exists and why the leg that pushes this corpse has to
         * make it. Same bound, same reason, one verb over.
         */
        const ts = turretStateFor(level);
        for (const t of ts.values()) {
            if (t.removed) continue;
            out.push({ id: t.id, rect: iceTurretRect(t) });
        }
        return out;
    };
    const pulledRopeIdsNow = () => {
        const st = ropeStateFor(level);
        return st.size === 0 ? null : st;
    };
    /**
     * ── ⛔⛔ R5 SLICE 10: THE ROCKS A ROPE DROPS ────────────────────────
     *
     * The SEVENTH per-visit geometry family, and the only one that ADDS a
     * solid: every other member removes one (a broken rock), flips a type (a
     * lock, a bridge, a chest) or moves one (a block, a shrinking rope). A
     * parked `FallRock` is in no list at all — `type = ""` at `y = -16` —
     * and it lands as a 16x16 `Solid`.
     *
     * ⚠ IT IS PER-VISIT AND BANKED, and the banking is where the R2 refusal
     * bites: `REFUSED_CLEAR_RESPONSES.arm` forbids a tape from DECLARING the
     * rock's tag, so a window cannot boot into the room after the fall. The
     * window that pulls the rope is the window that must finish the room.
     * Named in `fallRock.js`; the live half is here.
     */
    const fallRockStates = new Map();
    const fallRockStateFor = (n) => {
        if (!fallRockStates.has(n)) {
            const st = new Map();
            for (const r of worldFor(n).fallRocks ?? []) {
                // ⚠ `cleared` is FALSE for every rock a census could build:
                // the clear list may not name a fallrock tag, so a rock that
                // boots fallen is a state no build reaches. Asserted by the
                // refusal rather than by this comment.
                st.set(r.id, {
                    ...createFallRock(r.x, r.y, r.t, r.persistTag, false),
                    landed: false,
                });
            }
            fallRockStates.set(n, st);
        }
        return fallRockStates.get(n);
    };
    /**
     * ── ⛓⛓⛓ R5 SLICE 15: THE CRUSHERS, THE NINTH FAMILY ────────────────
     *
     * The first solid on this map that MOVES WITHOUT THE PLAYER TOUCHING IT.
     * A block moves when a press shoves it, a rope shrinks when it is
     * pulled, a rock drops when a rope publishes; a crusher charges the
     * moment it can SEE you, so its box is a function of every tick of the
     * run and of no single event in it.
     *
     * ⚠ THE STATE IS THE ENTITY POINT, NOT THE BOX CORNER. `update()`'s
     * `Math.round(x / Tile.w) * Tile.w` snaps the entity, which sits at the
     * body's CENTRE (`setHitbox(32, 32, 16, 16)`), so `ex`/`ey` from the
     * roster are what this holds and `crusherRect` is what the geometry sees.
     */
    const crusherStates = new Map();
    const crusherStateFor = (n) => {
        if (!crusherStates.has(n)) {
            assertCrusherSolidsBound(n);
            const byId = new Map();
            for (const c of worldFor(n).crushers ?? []) {
                byId.set(c.id, { id: c.id, t: c.t, x: c.ex, y: c.ey, vx: 0, vy: 0 });
            }
            crusherStates.set(n, byId);
        }
        return crusherStates.get(n);
    };
    /**
     * The live boxes, for `collidesSolid`'s `crushers` arm.
     *
     * ⚠ RETURNS `null` FOR A ROOM WITH NONE, like `pulledRopeIdsNow` and for
     * the same reason: 113 of the 116 levels hold no crusher at all and this
     * is on the hot path.
     */
    const crusherRectsNow = () => {
        const st = crusherStateFor(level);
        if (st.size === 0) return null;
        const out = new Map();
        for (const [id, c] of st) out.set(id, { id, rect: crusherRect(c), x: c.x, y: c.y });
        return out;
    };
    /**
     * ── ⛓⛓⛓ R5 SLICE 20: THE ICE TURRETS, THE TENTH FAMILY ─────────────
     *
     * The only member of the ten that is NOT a solid when the level builds
     * it. `IceTurret.type` is "Enemy" from the base ctor and `type =
     * "Solid"` is the else-arm of `if (currentAnim != "dead")` — so it
     * blocks nothing until the player has killed it AND stepped off the
     * corpse, and then it blocks for ever (nothing writes the type back).
     *
     * ⚠ AND IT IS PER VISIT WITH NOTHING TO CARRY IT: `IceTurret` has no
     * `check()`, no `removed()`, no `setPersistence` and no tag, so a
     * rebuild REVIVES it at its constructor cell. The kill, the pushes, the
     * hold they buy and everything downstream of the hold have to share ONE
     * window.
     */
    /**
     * ⛓⛓⛓ R5 SLICE 23: THE BOSS TOTEM — the TWELFTH per-visit family, and
     * the first whose SOLIDITY is removed by an event the player causes
     * indirectly.
     *
     * Every family before this one is a solid the player moves, breaks,
     * burns, opens or kills. This one stops being a solid because the WAND
     * LEFT THE WORLD: `BossTotem.update`'s `if (FP.world.classCount(Wand)
     * <= 0 && !activated)` is the whole trigger, and the Wand leaves only at
     * the very END of its ceremony.
     *
     * ⚠ PER VISIT, and it is a HARD per-visit like the turret's: the boss's
     * only persistence write is in `removed()` (its death, which is R6's),
     * so a rebuilt room gets an unwoken boss and its wall back. The wand
     * window is TERMINAL for a stronger reason than that — the room's only
     * shaft is sealed on the publishing tick — but the state rule is the
     * same one.
     */
    const bossStates = new Map();
    const bossStateFor = (n) => {
        if (!bossStates.has(n)) {
            const byId = new Map();
            for (const b of worldFor(n).bossTotems ?? []) {
                // ⛓ THE ID RIDES ON THE STATE from slice 4: the fight's six
                // ledgers all attribute by it, and looking it up from the
                // Map key at four call sites is how two of them would end up
                // spelling it differently.
                byId.set(b.id, { ...createBossTotem(b.ex, b.ey), id: b.id });
            }
            bossStates.set(n, byId);
        }
        return bossStates.get(n);
    };
    /**
     * The live boxes, for `collidesSolid`'s `bosses` arm.
     *
     * ⛔ EVERY BOSS IS IN THE MAP, WOKEN OR NOT, and `activated` is what
     * `liveRectOf` reads — the turret's rule, for the turret's reason:
     * "absent" must not mean both "no boss in the room" and "a boss that is
     * still a wall".
     */
    const bossRectsNow = () => {
        const st = bossStateFor(level);
        if (st.size === 0) return null;
        const out = new Map();
        for (const [id, b] of st) {
            out.set(id, {
                id, activated: b.activated, fullyActivated: b.fullyActivated,
                rect: bossTotemSolidRect(b), clampY: bossTotemClampY(b),
                // ⛔⛔ R6 SLICE 4: A DEFECT SLICE 2 LEFT AND NO TAPE COULD
                // REACH. `wandShotBlockerAt`'s woken arm reads `b.rect` —
                // which `bossTotemSolidRect` returns `null` for EXACTLY when
                // `b.activated` is true, i.e. exactly when that arm runs. It
                // would have thrown a TypeError on its first live tick. The
                // woken body is `type = "Enemy"` and has its OWN rect, and
                // it is `collidable`-gated (the jump and the top wait are
                // both un-hittable from the un-restored flag — §8.11).
                bodyRect: b.activated ? bossTotemBodyRect(b) : null,
            });
        }
        return out;
    };
    /**
     * ⛓⛓⛓ R6 SLICE 5: THE SHIELD BOSSES — the THIRTEENTH per-visit family.
     *
     * ⚠ PER VISIT ONLY IN ONE DIRECTION. The kill writes `{19,0}` and
     * `ShieldBoss.check()` despawns the body on a CLEARED tag, so a rebuilt
     * room after a kill has no boss at all — which `buildLevelWorld`'s
     * persistence arm handles from the run's cleared set, not from here. A
     * rebuild BEFORE the kill gets a fresh body with `activated` back to
     * false, which is exactly why the swallowed first hit is a per-ENTRY
     * dispatch rather than a once-per-fight one.
     */
    const shieldBossStates = new Map();
    const shieldBossStateFor = (n) => {
        if (!shieldBossStates.has(n)) {
            const byId = new Map();
            for (const b of worldFor(n).shieldBosses ?? []) {
                byId.set(b.id, createShieldBoss({
                    id: b.id, x: b.ex, y: b.ey, tag: b.persistTag ?? -1,
                }));
            }
            shieldBossStates.set(n, byId);
        }
        return shieldBossStates.get(n);
    };
    /**
     * The live boxes, for `collidesSolid`'s `shieldBosses` arm and for the
     * press census's.
     *
     * ⛔ `removed` IS THE ONLY FIELD THAT MATTERS and it is NOT `destroy`.
     * The body collides for the whole eleven-tick fade after the twenty-
     * three-update die animation; a map keyed on `destroy` would open the
     * room — and the key's cage — eleven ticks early.
     */
    const shieldBossRectsNow = () => {
        const st = shieldBossStateFor(level);
        if (st.size === 0) return null;
        const out = new Map();
        for (const [id, b] of st) {
            out.set(id, { id, removed: b.removed, rect: shieldBossBodyRect(b) });
        }
        return out;
    };
    /**
     * ⛓⛓⛓ R6 SLICE 6f: THE OWL — the FIFTEENTH per-visit family, and the
     * first whose state includes a RANDOM NUMBER GENERATOR.
     *
     * ⚠ PER VISIT LIKE EVERY OTHER ROSTER HERE, and for this class the game
     * agrees twice over: `started`, `rockfallTime`, `cpod`, `hitThisSequence`
     * and `hits` are all instance fields a `new Game` rebuilds, and the four
     * `Pod`s are rebuilt with them (each replaying its constructor's
     * `play("open")`). ⛔ WHAT DOES NOT COME BACK IS THE DRAW STREAM: the
     * generator is a `public static` on `Rng` and the room's own build spends
     * `OWL_LEVEL_BUILD_DRAWS` of it, so a re-entry is NOT a fresh stream.
     * `owlStream` therefore lives on the RUN and not on the level, and the
     * builder below refuses a second entry rather than paying the build twice
     * from a position it cannot know.
     */
    const finalBossStates = new Map();
    /**
     * The four pods, keyed by the boss's OWN index — `podPositions` order,
     * which is not the `.oel`'s.
     *
     * ⛔ L112's `.oel` places them (112,48), (112,192), (40,120), (184,120)
     * and `FinalBoss.check()` fills its `pods` Vector by walking
     * `podPositions` — (120,56), (48,128), (120,200), (192,128) — and
     * `collide`ing at each. So the boss's pod 1 is the level's pod 2. A
     * roster in file order with `cpod` as its index would send him to the
     * wrong pod on every cycle, and the walk would still LOOK plausible.
     */
    const podStates = new Map();
    const owlStateFor = (n) => {
        if (!finalBossStates.has(n)) {
            const byId = new Map();
            for (const b of worldFor(n).finalBosses ?? []) {
                byId.set(b.id, createFinalBoss({
                    id: b.id, x: b.ex, y: b.ey, tag: b.persistTag ?? -1,
                }));
            }
            finalBossStates.set(n, byId);
            const placed = worldFor(n).pods ?? [];
            // The boss's order, resolved against the placements by POSITION.
            const pods = FINAL_BOSS.podPositions.map((p, i) => {
                const found = placed.find((q) => q.ex === p.x && q.ey === p.y);
                if (byId.size > 0 && !found) {
                    throw new Error(`levelRun: level ${n} holds a finalboss but no pod at `
                        + `(${p.x}, ${p.y}) — \`FinalBoss.check()\` walks `
                        + '`podPositions` and pushes whatever `collide("Pod", …)` finds '
                        + `there, so a missing one leaves \`pods[${i}]\` undefined and `
                        + 'his walk arm throws in the GAME. Refused rather than modelled '
                        + 'with a short Vector.');
                }
                return createPod({ id: found?.id ?? `pod${i}`, x: p.x, y: p.y });
            });
            podStates.set(n, pods);
        }
        return { bosses: finalBossStates.get(n), pods: podStates.get(n) };
    };
    /**
     * The Owl's LIVE box, for the press census's `finalBosses` join.
     *
     * ⛔ `removed` IS ALWAYS FALSE FOR THIS CLASS, and the field is here so
     * the join has the same shape as the turret's and the Shieldspire's
     * rather than because the case exists: `death()` is an empty override, so
     * `FP.world.remove` is never called and the corpse is a responder for the
     * rest of the visit. `dead` is what a caller wants — the corpse's arm is
     * a refusal, not a landing.
     */
    const finalBossRectsNow = () => {
        const st = owlStateFor(level).bosses;
        if (st.size === 0) return null;
        const out = new Map();
        for (const [id, b] of st) {
            out.set(id, {
                id, removed: false, dead: b.destroy, rect: finalBossBox(b.x, b.y),
            });
        }
        return out;
    };
    /**
     * ⛓⛓⛓ R6 SLICE 6f: THE RUN'S DRAW STREAM, and it is the run's because
     * the generator is.
     *
     * `null` until a room with an Owl is entered. `assertOwlStreamPremises`
     * refuses a tape that has not declared `rng: { seed, split: true }` — see
     * `finalBossRng.js` for why the split is a premise and not a preference
     * (without it `Music.playSound("Rock", 0)` draws from this stream once
     * per rock LANDING and the schedule is short by exactly that many).
     */
    let owlStream = null;
    let owlStreamLevel = null;
    const owlStreamFor = (n) => {
        if (owlStream !== null) {
            if (owlStreamLevel !== n) {
                throw new Error(`levelRun: the Owl's draw stream was opened in level `
                    + `${owlStreamLevel} and level ${n} is asking for it too. The `
                    + 'generator is a `public static`, so its position is a fact about '
                    + 'the PAGE — two rooms sharing one run would each have to pay the '
                    + "other's build, and this rung has measured only L112's.");
            }
            return owlStream;
        }
        assertOwlStreamPremises(rng, `the Owl fight in level ${n}`);
        owlStream = new OwlDrawStream(rng.seed);
        owlStreamLevel = n;
        // ⛔⛔ THE LEVEL BUILD IS ON THE SEEDED STREAM. `Bot.botStart` reseeds
        // BELOW `FP.world = new Game(...)` — but `Game`'s constructor does not
        // call `loadlevel`; `begin()` does, when the deferred swap lands,
        // i.e. after `botStart` returned. So the room's own two gameplay ctor
        // draws come FIRST (§19.3), and a model that started counting at tick
        // 0 would be two draws behind for the whole run.
        owlStream.levelBuild();
        if (owlStream.count !== OWL_LEVEL_BUILD_DRAWS) {
            throw new Error('levelRun: the Owl stream\'s level build spent '
                + `${owlStream.count} draws and \`OWL_LEVEL_BUILD_DRAWS\` is `
                + `${OWL_LEVEL_BUILD_DRAWS}. One of the two is wrong and neither is a `
                + 'default.');
        }
        return owlStream;
    };
    /** The rocks and grenades this visit has spawned — RUNTIME bodies. */
    let owlRocks = [];
    let owlGrenades = [];
    let owlPendingRocks = [];
    let owlPendingGrenades = [];
    let owlSpawnSeq = 0;
    /**
     * ⛓⛓⛓ R6 SLICE 6c: THE WATCHERS — a PLACED NPC's dialogue state.
     *
     * ⚠ PER LEVEL AND PER VISIT, like every other roster here, and for a
     * reason this class states more sharply than most: `talked` is an
     * INSTANCE field (`NPCs/NPC.as:22`) and `new Game` rebuilds the entity,
     * so a dialogue exhausted in one visit is offered again in the next —
     * except that `Watcher.update` gates `super.update()` (and therefore
     * `talk()`) on `Game.checkPersistence(tag)`, which the first
     * `doneTalking()` cleared. Two mechanisms, opposite directions, and the
     * persistence one wins. The `cleared` flag below is the model's copy of
     * the gate; `Watcher.check()` is overridden EMPTY, so unlike every other
     * tagged class the body does NOT despawn on the cleared tag — which is
     * what leaves it standing for W-blood's four sword hits.
     */
    /**
     * ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR's per-visit state.
     *
     * ⚠ PER VISIT, and the reason is the one field `stepFinalDoor` carries
     * that nothing else does: `seenSeal`. It is an INSTANCE field reset by
     * every `new Game`, and leaving the 32 px radius resets it too — so a
     * re-approach fires a FRESH 181-frame ceremony. A run that carried it
     * across a rebuild would predict one ceremony where the game runs two.
     */
    const finalDoorStates = new Map();
    const finalDoorStateFor = (n) => {
        if (!finalDoorStates.has(n)) {
            const byId = new Map();
            for (const d of worldFor(n).finalDoors ?? []) {
                byId.set(d.id, {
                    id: d.id,
                    level: n,
                    ex: d.ex,
                    ey: d.ey,
                    persistTag: d.persistTag ?? -1,
                    ...freshFinalDoor(),
                    // See `stepFinalDoorsNow`: `FP.world.remove` only queues.
                    pendingRemove: false,
                });
            }
            finalDoorStates.set(n, byId);
        }
        return finalDoorStates.get(n);
    };
    /** The live boxes, for `collidesSolid`'s `finalDoors` arm. */
    const finalDoorRectsNow = () => {
        const st = finalDoorStateFor(level);
        if (st.size === 0) return null;
        const out = new Map();
        for (const [id, d] of st) out.set(id, { id, removed: d.removed });
        return out;
    };
    const watcherStates = new Map();
    const watcherStateFor = (n) => {
        if (!watcherStates.has(n)) {
            const byId = new Map();
            for (const w of worldFor(n).watchers ?? []) {
                byId.set(w.id, {
                    id: w.id,
                    level: n,
                    oel: { x: w.x, y: w.y },
                    ex: w.ex,
                    ey: w.ey,
                    persistTag: w.persistTag ?? -1,
                    // `Watcher.as:39` — `Game.checkPersistence(_tag) ? _text : _text1`,
                    // read at CONSTRUCTION. A fresh boot's persistence is all
                    // `true` (`Main.as:319-330`), so a booted window always gets
                    // the long text; the short one is what a SECOND visit shows.
                    text: w.text,
                    text1: w.text1,
                    talkingSpeed: w.talkingSpeed,
                    // `NPC.talked` — "the player has already talked to him since
                    // he came in range". Only the out-of-range arm resets it.
                    talked: false,
                    talking: false,
                    dialogue: null,
                    // The model's copy of `Watcher.update`'s own gate.
                    cleared: (clearedByLevel.get(n) ?? []).includes(w.persistTag ?? -1),
                    // ⛓⛓⛓ R6 SLICE 6d: the sword half. ⚠ PER VISIT like
                    // everything else here, and this one is a `new Game`
                    // reset the GAME agrees with: `hits`, `hitsTimer` and
                    // `createdSeed` are all instance fields, so a Watcher
                    // hit three times and left alone is back at zero on the
                    // next entry. Nothing persists but the tag, which the
                    // hits do not write.
                    hits: 0,
                    hitsTimer: 0,
                    createdSeed: false,
                });
            }
            watcherStates.set(n, byId);
        }
        return watcherStates.get(n);
    };
    const turretStates = new Map();
    const turretStateFor = (n) => {
        if (!turretStates.has(n)) {
            const byId = new Map();
            for (const t of worldFor(n).iceTurrets ?? []) {
                byId.set(t.id, createIceTurret(t.x, t.y));
            }
            turretStates.set(n, byId);
        }
        return turretStates.get(n);
    };
    /**
     * The live boxes, for `collidesSolid`'s `turrets` arm.
     *
     * ⛔ EVERY TURRET IS IN THE MAP, ALIVE OR DEAD, and the `solid` flag is
     * what `liveRectOf` reads. Emitting only the standing corpses would make
     * "absent" mean two different things — no turret in the room, and a
     * turret that is not a wall yet — and `liveRectOf`'s turret arm cannot
     * tell them apart.
     */
    const turretRectsNow = () => {
        const st = turretStateFor(level);
        if (st.size === 0) return null;
        const out = new Map();
        for (const [id, t] of st) {
            out.set(id, {
                id, rect: iceTurretRect(t), x: t.x, y: t.y,
                solid: t.solid && !t.removed, dead: t.dead, removed: t.removed,
            });
        }
        return out;
    };
    /**
     * ── ⛓⛓⛓ R5 SLICE 22: THE BLASTS IN FLIGHT, THE ELEVENTH FAMILY ─────
     *
     * ⛔ AND IT IS THE FIRST ONE THAT IS NOT A ROSTER. Every family before
     * it is built from the level's `.oel` placements and lives for the
     * visit; an `IceTurretBlast` is created by an animation callback, is in
     * no extract, and dies on its first contact. So this is a LIST that
     * grows and shrinks, keyed by level only so a world swap drops it —
     * which is what `Game`'s reconstruction does to every runtime entity.
     *
     * ⚠ ORDER IS THE UPDATE LIST'S, NEWEST FIRST. `World.addUpdate`
     * PREPENDS, so `unshift` here is the transcription and not a
     * preference. It is unobservable today (blasts do not collide with each
     * other and a volley shares one velocity) and it is free.
     */
    const blastStates = new Map();
    const blastsFor = (n) => {
        if (!blastStates.has(n)) blastStates.set(n, []);
        return blastStates.get(n);
    };
    /**
     * ⛔ THE PRUNE BOUND, COMPUTED FROM THE GEOMETRY RATHER THAN ASSUMED.
     *
     * The game gives a blast no lifetime at all, so the model needs a
     * reason to drop one. The reason is reachability: the player is
     * hard-clamped inside the level rect every tick and every hitable box
     * is a box in this world, so a blast outside the union of the two and
     * receding from it can never touch anything again. Memoised per level —
     * the union only ever needs the STATIC boxes, because a mover's live
     * rect is always inside its own family's static footprint plus the
     * level, and the level rect is in the union anyway.
     */
    const blastReachCache = new Map();
    const blastReachFor = (n) => {
        if (!blastReachCache.has(n)) {
            const w = worldFor(n);
            const r = {
                x: 0, y: 0, right: w.world.width, bottom: w.world.height,
            };
            for (const b of w.solidBoxesForBlast()) {
                if (b.x < r.x) r.x = b.x;
                if (b.y < r.y) r.y = b.y;
                if (b.right > r.right) r.right = b.right;
                if (b.bottom > r.bottom) r.bottom = b.bottom;
            }
            blastReachCache.set(n, r);
        }
        return blastReachCache.get(n);
    };
    /**
     * ── ⛓⛓⛓ R6 SLICE 2: THE MAGICAL LOCKS, THE TWELFTH ID JOIN ──────────
     *
     * Static geometry with per-visit state, exactly like a `BurnableTree` —
     * and with the same trap: `hit()` starts a 15-update animation and the
     * lock is `"Solid"` for every tick of it, so the OPEN set is keyed on
     * `openTick` and never on the hit.
     */
    const magicalLockStates = new Map();
    const magicalLockStateFor = (n) => {
        if (!magicalLockStates.has(n)) {
            const byId = new Map();
            for (const l of worldFor(n).magicalLocks ?? []) {
                byId.set(l.id, createMagicalLock(l.id, { tag: l.tag, x: l.x, y: l.y }, l.lockType));
            }
            magicalLockStates.set(n, byId);
        }
        return magicalLockStates.get(n);
    };
    const openMagicalLockIdsNow = () => {
        const st = magicalLockStateFor(level);
        if (st.size === 0) return null;
        const out = new Set();
        for (const [id, l] of st) if (!magicalLockIsSolid(l, ticksCompleted)) out.add(id);
        return out.size === 0 ? null : out;
    };
    /** `{level, id, tag, hitTick, openTick, shot}` per lock a shot has opened. */
    const magicalLocksOpened = [];
    /**
     * ── ⛓⛓⛓ R6 SLICE 2: THE SHOTS IN FLIGHT, THE THIRTEENTH FAMILY ──────
     *
     * The blast's list shape, one rung on: keyed by level so a world swap
     * drops it, `unshift`ed because `World.addUpdate` PREPENDS.
     *
     * ⚠ AND THE ORDER *BETWEEN* THE TWO PROJECTILE FAMILIES IS A BOUNDED
     * VACUITY, asserted rather than assumed. Both are added at run time, so
     * whichever was added last is nearer the head; no room in the game
     * holds an `IceTurret` and a reachable wand at once, and
     * `assertWandShotSolidsBound` fails by name in any room that did.
     */
    const wandShotStates = new Map();
    const wandShotsFor = (n) => {
        if (!wandShotStates.has(n)) wandShotStates.set(n, []);
        return wandShotStates.get(n);
    };
    /** `{t, level, id, direction, x, y}` per shot the run has fired. */
    const wandShotsFired = [];
    /** `{t, level, id, arm, ...}` per contact a shot has made. */
    const wandShotHits = [];
    /**
     * The open wand animations, at most one deep — `useItem`'s
     * `if (!wanding)` is what makes a second press inside the window a
     * silent no-op, and the run refuses that rather than swallowing it.
     */
    const wandWindows = [];
    /**
     * ⛔⛔⛔ THE SHOT'S OWN SOLIDS LIST IS NEITHER THE PLAYER'S NOR THE
     * BLAST'S, AND THE DIFFERENCE IS ASSERTED AWAY RATHER THAN ASSUMED AWAY.
     *
     * ```
     *   Player.solids    ["Solid","Tree","Rock","Rope","ShieldBoss","LavaBoss"]
     *   WandShot.solids  ["Solid","Tree","Rock","Rope","ShieldBoss","Enemy"]
     * ```
     *
     * `world.collidesSolid` is the PLAYER's list, so using it for a shot is
     * wrong in BOTH directions at once: it over-stops on a `LavaBoss` and
     * under-stops on every `"Enemy"`. This bounds both — the spinner's own
     * `assertSpinnerSolidsBound` shape, with two names instead of one.
     *
     * ⛓ The `"Enemy"` half is not a filter but a SUPPLY problem: an
     * Enemy-typed body reaches `collidesSolid` only when something flips it
     * to `"Solid"` (an unwoken totem, a turret corpse), so a live one is
     * INVISIBLE there and has to come from a roster the run holds. This
     * refuses any room where a body in the press census has no such roster
     * — the undriven-producer law pointed at a consumer.
     */
    const wandSolidsBoundChecked = new Set();
    function assertWandShotSolidsBound(n) {
        if (wandSolidsBoundChecked.has(n)) return;
        wandSolidsBoundChecked.add(n);
        const w = worldFor(n);
        for (const s of w.solids) {
            if (s.cls && s.cls.type === 'LavaBoss') {
                throw new Error(`levelRun: level ${n} holds a LavaBoss-typed entity `
                    + `("${s.tag}"), which is in the PLAYER's solids list and NOT in `
                    + '`WandShot`\'s (`Mobile.as:17` + `WandShot.as:69` vs '
                    + '`Player.as:377`). `world.collidesSolid` would stop a shot the '
                    + 'game lets fly straight through. Give the shot its own list '
                    + 'before firing one in this room.');
            }
        }
        // Every Enemy-typed body the press census names must have a roster
        // the run can take a live box from.
        const boxed = new Set();
        for (const b of w.bossTotems ?? []) boxed.add(`${b.x},${b.y}`);
        for (const t of w.iceTurrets ?? []) boxed.add(`${t.x},${t.y}`);
        for (const s of w.spinners ?? []) boxed.add(`${s.x},${s.y}`);
        const unboxed = (w.pressEnemies ?? []).filter((e) => !boxed.has(`${e.x},${e.y}`));
        if (unboxed.length > 0) {
            const names = unboxed.map((e) => `${e.tag}@${e.x},${e.y}`).join(', ');
            throw new Error(`levelRun: a WandShot in level ${n} would collide with `
                + `${unboxed.length} Enemy-typed bod(ies) this run cannot place: ${names}. `
                + '`WandShot`\'s ctor pushes "Enemy" onto its own solids, so a live enemy '
                + 'STOPS a shot — and a live enemy is invisible to `collidesSolid`, which '
                + 'only sees the ones something has flipped to "Solid". Reporting rather '
                + 'than flying through: a shot that passed through a body would report a '
                + 'clean corridor that does not exist.');
        }
        if ((w.iceTurrets ?? []).length > 0) {
            throw new Error(`levelRun: level ${n} holds an IceTurret and a WandShot at `
                + 'once. Both projectile families are added at RUN TIME and '
                + '`World.addUpdate` prepends, so their relative update order is the '
                + 'ADD order — which this file models as "wand shots first" on the '
                + 'grounds that no room has both. This room does.');
        }
    }
    /**
     * ⚠ `wand()` READS THE POSITION *ABOVE* `Player.update`'s FINAL CLAMP,
     * and this run cannot see that value.
     *
     * `x = Math.min(Math.max(x, originX), FP.width + originX - width)` runs
     * BELOW `sprites()`, so a shot fired while the player is pinned against
     * a level edge spawns from the un-clamped position — and `stepV2`
     * returns only the clamped one (`playerPhysicsV1` applies the clamp
     * inside the step, as step 4 of the tick).
     *
     * ⇒ this refuses at the BOUND rather than at the difference: an
     * OVER-approximation, in the safe direction. Standing exactly on a
     * clamp edge does not prove the clamp moved anything; it proves the run
     * cannot tell. `wandVerb.assertSpawnUnclamped` is the exact test for a
     * caller that does hold both values.
     */
    function assertWandSpawnUnclamped(pos, w) {
        const c = clampFor(world.world);
        const atBound = pos.x === c.minX || pos.x === c.maxX
            || pos.y === c.minY || pos.y === c.maxY;
        if (!atBound) return;
        throw new Error(`levelRun: the wand press at tick ${w.pressTick} fires at tick `
            + `${w.fireTick} with the player at (${pos.x}, ${pos.y}), which is ON level `
            + `${level}'s clamp bound (x ${c.minX}..${c.maxX}, y ${c.minY}..${c.maxY}). `
            + '`wand()` reads the position ABOVE that clamp (`sprites()` is the line '
            + 'above it in `Player.update`) and this run only holds the value below it, '
            + 'so the spawn point is unknowable here. Refused at the bound rather than '
            + 'at the difference — move the stance one pixel inward.');
    }
    /**
     * `collideTypes(WandShot.solids, x, y)`, as the blocker the game's
     * `checkEntity` would receive — CLASSIFIED, because `_e is Enemy` is an
     * AS3 class test and this package holds runtime types.
     */
    const wandShotBlockerAt = (opts) => (x, y, shot) => {
        const box = wandShotRect({ ...shot, x, y });
        // (1) everything already flipped to a type in `Mobile.solids`.
        const s = world.collidesSolid(box, opts);
        if (s) {
            if (s.magicalLockId) {
                return {
                    kind: 'magicallock', id: s.magicalLockId, lockType: s.lockType,
                };
            }
            // A totem that has not woken, or a turret corpse: still an
            // `Enemy` INSTANCE, so `_e is Enemy` is true whatever `type` says.
            if (s.bossId) return { kind: 'enemy', id: s.bossId, boss: true };
            if (s.turretId) return { kind: 'enemy', id: s.turretId, turret: true };
            return { kind: 'other', id: s.crusherId ?? s.pushableId ?? s.rockId
                ?? s.treeId ?? s.chestId ?? s.tag ?? null, tag: s.tag ?? null };
        }
        // (2) the `"Enemy"` arm — the bodies (1) cannot see. A WOKEN totem
        // is `type = "Enemy"` and `liveRectOf` deliberately returns null for
        // it, which is right for the player and wrong for this mover.
        for (const b of (bossRectsNow() ?? new Map()).values()) {
            if (b.activated && b.bodyRect && rectsOverlap(box, b.bodyRect)) {
                return { kind: 'enemy', id: b.id, boss: true };
            }
        }
        for (const sp of spinnerRectsNow() ?? []) {
            if (rectsOverlap(box, sp.rect)) return { kind: 'enemy', id: sp.id, spinner: true };
        }
        return null;
    };
    /**
     * ── ⛔⛔ R5 SLICE 15: ONE OPTIONS BUILDER FOR EVERY LIVE-GEOMETRY QUERY
     *    IN THIS FILE ─────────────────────────────────────────────────────
     *
     * `botDriverV2.liveGeometryOpts` was slice 14's answer to three
     * hand-written option literals in the DRIVER, one of which cost a leg.
     * This file had FIVE — the block's collide, the spinner's collide, the
     * chest's `solidOver`, the seal piece's `blockedAt`, and `stepV2` itself
     * — and adding a ninth family to five literals is how a sixth one
     * quietly acquires a different world.
     *
     * ⚠ `beforeTypeFlip` IS NOT IN HERE. It is a fact about the TICK
     * (`firstTickInWorld`) rather than about the run's geometry, and only the
     * queries that run on a live tick want it; the callers that do pass it.
     */
    const liveSolidOpts = (extra = {}) => ({
        // ⚠ COMPUTED LAZILY-BY-CALLER WHERE IT MATTERS: three of the four
        // call sites already hold this tick's set and pass it in `extra`,
        // and `openActivatorIds` walks every activator in the room.
        openActivators: extra.openActivators !== undefined
            ? extra.openActivators : openActivatorIds(activatorStateFor(level)),
        openMagicalLocks: openMagicalLockIdsNow(),
        openBridges: openBridgeIdsNow(),
        pushables: pushableRectsNow(),
        brokenRocks: brokenRockIdsNow(),
        burnedTrees: burnedTreeIdsNow(),
        pulledRopes: pulledRopeIdsNow(),
        fallenRocks: fallenRocksNow(),
        openChests: openChestIdsNow(),
        crushers: crusherRectsNow(),
        turrets: turretRectsNow(),
        bosses: bossRectsNow(),
        shieldBosses: shieldBossRectsNow(),
        finalDoors: finalDoorRectsNow(),
        ...extra,
    });
    /** The boxes of every rock this visit has DROPPED — `collidesSolid`'s arm. */
    const fallenRocksNow = () => {
        const st = fallRockStateFor(level);
        if (st.size === 0) return null;
        const out = new Map();
        for (const [id, r] of st) {
            if (!r.landed) continue;
            out.set(id, { id, tag: 'fallrock', rect: fallRockRect(r), x: r.x, y: r.y });
        }
        return out.size === 0 ? null : out;
    };
    /** ⛔⛔ R5 slice 10: `{id, level, t, flag, deadFrames}` per rock dropped. */
    const rockFalls = [];
    /**
     * ⛔⛔ R5 slice 15: every tick a crusher's `hit()` found the player inside
     * its body. `Bot.noDamage` makes the GAME survive it, so this is a route
     * defect the run REPORTS rather than a death it simulates — see
     * `stepCrushersNow`.
     */
    const crusherContacts = [];
    /**
     * ⛓⛓⛓ R8 SLICE 1: one row per tick a bridged chaser MOVED —
     * `{t, level, id, x, y, vx, vy}`.
     *
     * ⚠ MOVES ONLY, not every tick: a bob out of leash and at rest writes
     * nothing, so a room whose chasers never wake produces an EMPTY ledger
     * and that emptiness is a claim ("nothing woke") rather than a silence.
     * It is the positive witness the pair asserts against — a hit count alone
     * is not a witness that the body was stepped (trap 113).
     */
    const chaserWalks = [];
    /**
     * ⛓ One row per body the ROOM removed — `{t, level, id, cause, x, y}`.
     *
     * ⛔ THE POSITIVE WITNESS FOR TRAP 152, MOVED FROM A PROBE INTO THE RUN.
     * R7 slice 6e measured "the room kills them itself" with a truncated
     * `--mobiles` arm and carried the result as a DECLARED `despawn`. With
     * the terrain arm transcribed the model computes it, and this ledger is
     * where it says so — which is what makes "the game removed this body"
     * checkable against the declaration rather than merely compatible with it.
     */
    const chaserTerrainDeaths = [];
    /**
     * ⛓⛓⛓ R5 SLICE 23: every tick `BossTotem`'s clamp overwrote the
     * player's y, and what it overwrote.
     *
     * ⛔ AN ASSIGNMENT, NOT A COLLISION, so it is logged rather than
     * inferred from a position: `if (p.y < 212) p.y = 212` at the top of
     * `update()` teleports, and a stream that showed the player at 212
     * could equally be a walk that stopped there.
     */
    const bossClamps = [];
    /**
     * ── ⛓⛓⛓ R6 SLICE 4: THE FIGHT'S OWN LEDGERS ──────────────────────
     *
     * Six lists, because the six things the fight does to the world are six
     * different claims and a window has to be able to name which one it
     * meant. `bossWalks` is R5's boundary-band CEILING, kept as a record now
     * that it is no longer a throw.
     */
    const bossWalks = [];
    /** `{t, level, y, rects, hitCalls}` — one per laser VOLLEY, hit or miss. */
    const bossLasers = [];
    /** `{t, level, id, x, y}` — one per `BossTotemShot` the attack published. */
    const bossShotsFired = [];
    /** `{t, level, id, hits, killed, refusedAt}` — one per wand shot AT the boss. */
    const bossHits = [];
    /**
     * `{t, level, id, x, y, killTick, tagTick, flag}` — the kill, its blast,
     * and the tick `removed()` writes `{43,5}` 240 renders later.
     */
    const bossKills = [];
    /** `{t, level, x, y, hitPlayer}` — every Explosion this room produced. */
    const bossBlasts = [];
    /**
     * ⛓⛓⛓ Every tick a `BossTotemShot`'s own removal was UNCERTAIN under
     * the shake band. Not an error — the surviving branch is driven and the
     * shot is asserted to touch nothing — but a window that shows an empty
     * list has proved something WEAKER than one that shows a full list and
     * no contact, and the ledger is what tells the two apart.
     */
    const bossShotCullBand = [];
    /**
     * `Explosion.added()` calls waiting for this tick's `updateLists()`.
     *
     * ⛔ NOT APPLIED WHERE THEY ARE CREATED. `FP.world.add` appends to
     * `_add`, which `Engine.update` drains AFTER `World.update` — so the
     * disc is tested against the player's END-of-tick origin, one whole
     * player step later than the hit that spawned it (§8.10).
     */
    const pendingBlasts = [];
    /** The `{43,5}` write `removed()` makes, keyed like `rockFlags`. */
    const bossFlags = new Map();
    // ── ⛓⛓⛓ R6 SLICE 5: the Shieldspire's four ledgers ─────────────────
    /**
     * `{t, level, id, inBand, swingTime, anim, hitsTimer}` — EVERY TICK.
     *
     * ⚠ A FULL LEDGER RATHER THAN AN EVENT ONE, because the mechanic IS the
     * counter: "the player stood in the band" is a claim about 120
     * consecutive ticks and an event log of the 120th proves only that the
     * model thinks it counted. The window asserts monotonicity over this.
     */
    const shieldBossBand = [];
    /** `{t, level, id, retaliation, windowFrom, windowTo, stabFrom}` per stab. */
    const shieldBossStabs = [];
    /** `{t, level, id, swallowed, landed, killed, aborted, hits, refusedAt}` per swing. */
    const shieldBossHits = [];
    /**
     * `{t, level, id, what, tagTick}` — `what` is `'tag'`, `'destroy'` or
     * `'removed'`, and they are THREE DIFFERENT TICKS 23 and 11 apart.
     */
    const shieldBossKills = [];
    /** The `{19,0}` write `startDeath` makes — keyed like `bossFlags`. */
    const shieldBossFlags = new Map();
    // ── ⛓⛓⛓ R6 SLICE 6f: the Owl's seven ledgers ───────────────────────
    /**
     * `{t, level, id, landed, force, reach, dist, why, vx, vy}` — one per HIT
     * TEST that reached the Owl, landed or not.
     *
     * ⛔ EVERY TEST, AND THE `reach` IS THE POINT. One press is five
     * dispatches and this receiver refuses NONE of them (`justKnock` sets no
     * `hitsTimer`) — what refuses them is `Player.slash`'s own 16 px
     * `FP.distanceRectPoint` gate against a body the earlier tests have
     * already shoved. So "how many of the five land" is GEOMETRY, computed
     * here per test, and the refused rows with their distances ARE the
     * derivation. A ledger of landings alone would make the count look like a
     * constant.
     */
    const finalBossShoves = [];
    /**
     * `{t, level, id, x, y, hits, killed, firstT, wholly, touching}` — one per
     * tick the Owl's own lava test fired.
     *
     * ⛓ `wholly` AND `firstT` ARE BOTH RECORDED because they answer different
     * questions. `firstT` is the GAME's predicate (`collide("Tile", x, y)`
     * returns the first overlap in world order and the test is `t == 17` on
     * THAT one — trap 95's selection); `wholly` is the order-independent
     * sufficient condition a plan should aim for. A hit that is `firstT: 17`
     * and `wholly: false` is a hit that depends on a file's line order.
     */
    const finalBossLava = [];
    /**
     * `{t, level, id, what, ...}` — `what` is `'kill'`, `'dieAnimEnded'` or
     * `'tagsWritten'`, and they are 48 and 61 ticks apart.
     */
    const finalBossKills = [];
    /** The `{112,0}` AND `{112,1}` writes `endAnim`'s "dead" arm makes. */
    const finalBossFlags = new Map();
    /**
     * `{t, level, id, x, y, scale, box, shake, hitPlayer}` — one per ROCK that
     * landed, and the `shake` is the draw it made.
     */
    const owlRockLandings = [];
    /** `{t, level, id, what, x, y, dist, hitPlayer}` per grenade event. */
    const owlGrenadeEvents = [];
    /**
     * `{t, level, phase, draws, shaking, shake, streamCount}` — EVERY TICK the
     * Owl room ran.
     *
     * ⚠ A FULL LEDGER RATHER THAN AN EVENT ONE, for `shieldBossBand`'s reason
     * with a harder claim: the exactness of this whole family is "the model
     * turned the crank the same number of times as the game did, in the same
     * order", and that is a statement about every tick. `finalBossRng`'s
     * `owlTickDraws` is asserted against the stream's own delta on each of
     * them, which is the one-table-two-computations shape — a phase row that
     * disagreed with the sites the stream actually booked fails by name.
     */
    const owlTicks = [];
    /**
     * ⛔⛔⛔ THE POSITIVE WITNESS FOR THE CORPSE REFUSAL — trap 101's shape,
     * the third time this rung needs it.
     *
     * `{t, id, rect, clearance}` — one per tick after `startDeath`.
     * `startDeath` sets `type = "Solid"` and `death()` is an EMPTY override,
     * so the body is a PERMANENT WALL where the third shove left it. This
     * package does not carry it as a live-geometry key (no committed tape
     * moves after the kill — the window ends 109 ticks later, standing still),
     * so the guard is a REFUSAL on any overlap plus this clearance record: a
     * plan asserts the corpse really existed, for this many ticks, and the
     * stance cleared it by this much.
     */
    const finalBossCorpse = [];
    // ── ⛓⛓⛓ R6 SLICE 6c: the Watcher's three ledgers ───────────────────
    /**
     * `{t, level, id, cause, pages, page, flag}` — one per `doneTalking()`.
     *
     * ⛔ `cause` IS `'done'` OR `'left'` AND BOTH WRITE THE FLAG. `NPC.talk`'s
     * out-of-range arm is `talked = false; if (talking) talking = false;` and
     * the `talking` SETTER's false branch ends with `doneTalking()` — so
     * walking away mid-dialogue earns `{114,0}` exactly as exhausting the
     * pages does. The cause is recorded BECAUSE the two are indistinguishable
     * from the flag alone. → [[feedback_leaving_the_radius_still_pays]]
     */
    const watcherTalks = [];
    /** The `{114,0}` write `doneTalking()` makes — keyed like `bossFlags`. */
    const watcherFlags = new Map();
    /**
     * ⛔⛔⛔ THE POSITIVE WITNESS FOR A REFUSAL THAT MUST NEVER FIRE.
     *
     * `Watcher.update:68-74` holds a live `Seed` out while `myCurrentText` is
     * in `[9,19]`, and taking it is not a lost pickup — it is a SOFT-LOCK
     * (`endingChain.watcherSeedBox`'s docblock has the chain). The stance
     * assertion below refuses a tape that touches it, and a refusal no tape
     * can reach is a check with no witness (trap 101) — so every tick the
     * seed is LIVE is recorded here with the stance's clearance, and a plan
     * asserts the positive: the box really was there, for this many ticks,
     * and the stance cleared it by this much.
     */
    const watcherSeedLive = [];
    // ── ⛓⛓⛓ R6 SLICE 6d: the bloody branch's four ledgers ──────────────
    /**
     * `{t, level, id, hits, hitsTimer, landed, why}` — one per HIT TEST that
     * reached a Watcher, landed or not.
     *
     * ⛔ EVERY TEST, NOT EVERY PRESS, and that is the claim. One press is
     * FIVE dispatches (§13.2) and `Watcher.hit`'s `hitsTimer = 25` refuses
     * four of them; recording only the landings would make "four presses,
     * four hits" look like a fact about presses instead of the arithmetic it
     * is. The refused rows ARE the derivation.
     */
    const watcherHits = [];
    /**
     * `{t, level, id, ex, ey, from}` — one per runtime-spawned `Seed`.
     *
     * ⛓ The FIRST pickup on the ladder that is in no level's entity list.
     * `Watcher.update` adds it with `FP.world.add`, which QUEUES — so its
     * first update, and therefore the overlap that collects it, is the tick
     * AFTER the one that created it.
     */
    const seedSpawns = [];
    /**
     * `{t, level, id, arm, fadeFrames}` — one per `Seed.removeSelf()`.
     *
     * ⛔ `Seed` OVERRIDES `removeSelf` AND DOES NOT CALL IT.
     * `Pickup.removeSelf` is `FP.world.remove(this)`, which runs `removed()`
     * — the item property and `Game.setPersistence`. The Seed's override is
     * `Game.freezeObjects = true; drawCover = true;` and nothing else, so
     * the pickup NEVER leaves the world, grants NOTHING and writes NO flag.
     * That is why `earnedClears` is empty for a window whose whole subject is
     * a collected pickup, and why the ledger is here rather than in
     * `collected`'s flag machinery.
     */
    const seedFades = [];
    /**
     * ⛓⛓⛓ `{t, arm, fromLevel, toLevel, cutscene}` — one per GAME-INITIATED
     * reboot the ending chain ordered.
     *
     * The third shape of world swap on the ladder, after a teleporter and a
     * death: a `Seed`'s terminal arm assigns `FP.world = new Game(...)` from
     * inside a pickup's update, with a level and a position of its own
     * choosing. §5's "a game-initiated world reboot is a BOOT, not an entry"
     * as a ledger row.
     */
    const endingReboots = [];
    /**
     * ⛔⛔⛔ THE POSITIVE WITNESS FOR THE ORACLE REFUSAL — trap 101's shape,
     * the second time this rung needs it.
     *
     * `{t, id, distance, inRange}`, one per tick of a `cutscene[1]` world.
     * The refusal below throws on an X release inside the 24 px circle,
     * because `Oracle.doneTalking()` under `cutscene[1]` is `exitToMenu()`
     * and the record would then be a claim about the harness rather than the
     * game (`R6_BLOOD_MENU_DERIVATION`). A shipped tape can never reach it —
     * the walk's spans are refused outright — so the CLEARANCE is recorded
     * every tick and a plan asserts the positive: the circle really was
     * entered, and no key was live while it was.
     */
    const oracleApproach = [];
    /**
     * `{t, level, what, r, updates}` — the TREE's two events, `endAnim` and
     * `coverFull`, with the relative tick each fired on.
     *
     * ⛓ Kept as EVENTS rather than as a length, because the two numbers the
     * window turns on are fenceposts and a total hides both: the grow's
     * first update is the first LIVE frame of the rebuilt world (the
     * `play("grow")` runs in the CONSTRUCTOR, not inside an update pass —
     * the opposite of W-door's trap 104), and the fade's first increment is
     * the tick AFTER `endAnim` (the graphic update runs below `e.update()`).
     */
    const treeEvents = [];
    // ── ⛓⛓⛓ R6 SLICE 6c: the final door's three ledgers ────────────────
    /**
     * `{t, level, id, frames, dismissable}` — one per SealController the
     * door spawned.
     *
     * ⛔ ITS FRAMES ARE DEAD, NOT TICKS, and that is the whole difference
     * from the Watcher's freeze one family over. A `SealController` sets
     * `Game.freezeObjects` in its CONSTRUCTOR and never sets `Game.talking`,
     * so nothing lowers the flag between frames and the bot's dead-frame
     * gate sees every one of them. They land in `frozenFramesOwed` as a
     * LUMP, exactly like a pickup's phase A.
     */
    const doorCeremonies = [];
    /** `{t, level, id, what}` per door event — `open` then `removed`. */
    const doorEvents = [];
    /** The `{113,0}` write `removed()` makes — keyed like `bossFlags`. */
    const finalDoorFlags = new Map();
    let bossShotSeq = 0;
    const bossShotStates = new Map();
    const bossShotsFor = (n) => {
        if (!bossShotStates.has(n)) bossShotStates.set(n, []);
        return bossShotStates.get(n);
    };
    /**
     * `Game.cameraTarget`, a STATIC the boss overwrites every frame he
     * exists and NOTHING resets until he is removed (§8.16). `null` means
     * "no boss has ever written it in this world", which is not the same as
     * `(-1,-1)` — that is an explicit `Game.resetCamera()`.
     */
    let bossCameraTarget = null;
    /** One record per wand approach FADE — a freeze no other pickup has. */
    const wandFades = [];
    /**
     * ⛓⛓⛓ R5 SLICE 22: THE PLAYER'S OWN FREEZE, AND IT IS NOT THE OTHER ONE.
     *
     * `Player.frozenTimer`, whose ONLY writer in the entire game is
     * `IceTurretBlast` (grepped, not assumed: `\.freeze\(` has exactly one
     * call site outside the definition). It gates `Player.input()` and
     * nothing else — friction and both sweeps still run — so it is a
     * DISPLACEMENT and not a stopped clock, and `frozenFramesOwed` below,
     * which counts `Game.freezeObjects` frames the tape never sees, is a
     * different quantity that must never be merged with it.
     *
     * ⚠ PER PLAYER, SO PER WORLD. `Game` builds a fresh `Player` on every
     * swap and the field is `private var frozenTimer:int = 0` — see
     * `arriveIn`.
     */
    let frozenTimer = 0;
    /**
     * ⛓⛓⛓ R6 SLICE 3: THE PLAYER'S DAMAGE, AND IT IS THE THIRD TIMER.
     *
     * `{hits, hitsTimer, directionFace}` — `playerDamage.createPlayerDamage`.
     * Three timers now live on this player and no two of them mean the same
     * thing:
     *
     *   `frozenTimer`  an `IceTurretBlast`; gates `Player.input()` WHOLE
     *                  (arrows, waterfall and both item presses)
     *   `hitsTimer`    a landed `Player.hit`; gates the ARROWS ONLY, and
     *                  suppresses the next hit from any source
     *   `drownTimer`   a hazard tile; cumulative, never reset off-hazard
     *
     * ⚠ PER PLAYER, SO PER WORLD, like `frozenTimer` — and a death is a
     * world swap, so a death resets `hits` to 0 as surely as a door does.
     * `Main.hitsMax` is the one damage number that survives, which is why
     * it is read from the inventory mirror and not carried here.
     */
    let damage = createPlayerDamage();
    /** One per landed `Player.hit` — `{t, level, source, id, hits, ...}`. */
    const playerHits = [];
    /**
     * One per contact that reached the player and paid NOTHING — the §10.6
     * carry, made visible.
     *
     * A hit inside a ceremony is swallowed by `Player.hit`'s own
     * `!Game.freezeObjects`, silently and with no i-frames to show for it;
     * a hit inside an open i-frame window is swallowed by the first term.
     * A schedule that assumed either one landed is short by however many,
     * and without this list the only symptom is a position that drifts.
     */
    const contactsSuppressed = [];
    /**
     * ⛔⛔⛔ One per DEATH — `{t, level, respawn, hits}` — and a death is a
     * GAME-INITIATED WORLD REBOOT (§8.8), not an end of run.
     *
     * `playerDamage.DEATH_REBOOT` carries the shape; this is where it
     * happened. The list is the only witness a stream cannot give: the
     * respawn is the level's own entry point, so a death that costs the
     * player a whole room's progress can land them exactly where a normal
     * re-entry would and look, tick for tick, like a tape that walked back.
     */
    const playerDeaths = [];
    /**
     * Set the instant `hits >= hitsMax`, consumed at the END of the tick.
     *
     * ⚠ NOT A FLAG THE PHYSICS READS — it is `Player.dying`, and its first
     * consequence is that `Player.update`'s `if (!dying) super.update()`
     * skips the whole move. The world swap is the second, and it is
     * deferred to `Engine.checkWorld` like every other `FP.world =`.
     */
    let pendingDeath = null;
    /**
     * The `Game` constructor args of the CURRENT world — what
     * `restartLevel()` reboots into.
     *
     * ⚠ NOT THE PLAYER'S POSITION. `Game.playerPosition` is written once,
     * by the constructor, from its own args (`Game.as:624`), and walking
     * never updates it. And the `<player>` object arm of `loadlevel` cannot
     * fire — no level in the checkout has one — so these two numbers are
     * the whole of "where does a death put you".
     */
    let worldCtor = { x: boot.x, y: boot.y };
    /** `IceTurretBlast.freezeTime`, through the family that owns it. */
    const BLAST_FREEZE_TICKS = ICE_TURRET_BLAST.freezeTicks;
    /** One per tick a blast reached the player — `{t, level, blast, x, y}`. */
    const blastFreezes = [];
    /** One per volley an `endAnim` spawned — `{t, level, turret, blasts}`. */
    const volleys = [];
    /**
     * The dead frames a level load spends with `view()` still running and
     * the player stationary — `camera.js`'s `cameraTrack` default, and the
     * arithmetic is forgiving (a load leaves the camera 2 px out and
     * `2 * 0.9^20 < 0.25`, so anything over ~12 rounds the same).
     */
    const CAMERA_LOAD_SETTLE_TICKS = 20;
    /**
     * ⛓⛓ Frozen frames this run has spent that the TAPE never sees.
     *
     * `Bot.update`'s gate skips a frozen frame entirely — no observation, no
     * span — so a freeze costs the tape ZERO ticks and costs the readout
     * `dead_frames`. The two numbers are what let a claim about a ceremony be
     * made at all, and this is the accumulator for the freezes the RUN
     * causes (a `SealController`'s is `sealCeremony`'s own).
     */
    let frozenFramesOwed = 0;
    /**
     * ⛓⛓⛓ R5 SLICE 23: HAS THE WAND LEFT THE WORLD?
     *
     * `BossTotem.update`'s trigger is `FP.world.classCount(Wand) <= 0`, and
     * `Pickup.pick_up()` reaches `removeSelf()` only at the very END of the
     * ceremony — after 150 `specialTimer` decrements AND after the dialogue
     * NPC has been dismissed. So this is the ceremony's LAST act and not its
     * first, which is the difference between a boss that wakes on contact
     * and one that wakes 150-plus frames later.
     */
    let wandLeftTheWorld = false;
    /**
     * ⛓⛓ R5 SLICE 23: has the wand's approach FADE been spent this visit?
     *
     * ⛔⛔ THE FADE IS A FREEZE THAT FIRES ON APPROACH, NOT ON CONTACT, and
     * it is the one ceremony cost no other pickup has. `Wand.update`'s gate
     * is `p.y < y + Tile.h && Player.hasAllTotemParts() && !p.fallFromCeiling`
     * — a half-room-wide test on the player's Y ALONE — and while the
     * graphic's alpha is under 1 it writes `Game.freezeObjects = alpha < 1`
     * every tick. Ninety-nine frozen frames, before the player has touched
     * anything.
     *
     * ⚠ RESOLVED IN ONE MODEL TICK, the `dropRock` convention, and it is
     * exact for THIS room: nothing in level 43 advances through a freeze.
     * There is no button under the player, no lock fading, no pulser, no
     * lightpole and no crusher; the boss is not activated (the Wand is still
     * in the world) so its whole `if (activated)` block is dead. A room that
     * held any of those would need the span ticked rather than collapsed.
     */
    let wandFadeSpent = false;
    /**
     * Did `dropRocksTogether` run on THIS model tick?
     *
     * ⛔ The drop advances the boss itself, once per frozen frame, so the
     * live-tick stepper below must not add a 187th. A boolean rather than a
     * tick index because `ticksCompleted` moves inside the same branch.
     */
    let droppedRocksThisTick = false;
    /**
     * ⛓⛓ Physics steps the model OWES for freeze-clearing frames the tape
     * never observed — see the loop above the main `stepV2`.
     *
     * One per collapsed frozen span, banked where the span is resolved.
     */
    let pendingFreeSteps = 0;
    /**
     * ⛓⛓ THE FALL, RESOLVED IN ONE MODEL TICK — because that is what the
     * tape sees.
     *
     * The game spends 60 + 46 + 90 + 1 frames on it and the bot's gate
     * counts every one as DEAD, so the tape does not advance: between the
     * live tick that pulls the rope and the next live tick, the rock has
     * gone from overhead to landed. So the run steps the rock to completion
     * HERE rather than carrying 197 ticks of state nothing can observe — and
     * the number of frames is banked for the readout.
     *
     * ⚠ The loop is `stepFallRock`'s, not a constant: `fallRockFreezeTicks`
     * is the same arithmetic and the two are asserted against each other in
     * `fallRock.test.js` rather than one calling the other here.
     */
    const dropRock = (rockState, id) => {
        const pub = publishActivate(rockState, true);
        if (!pub.fell) return { state: rockState, fell: false };
        let s = pub.state;
        let frames = 0;
        let snapY = null;
        for (let i = 1; i <= 1000; i += 1) {
            const r = stepFallRock(s, playerBoxAt(state.x, state.y), { cleared: true });
            s = r.state;
            frames = i;
            // ⛔ THE SNAP. `FallRock.update`'s first arm writes the player's
            // `y` on every tick from the landing, and the player cannot move
            // out from under it — the whole span is frozen. So the LAST snap
            // of the span is the one the next live tick starts from.
            if (r.snapY !== null) snapY = r.snapY;
            if (r.unfroze) break;
        }
        frozenFramesOwed += frames;
        rockFalls.push({
            id,
            level,
            t: ticksCompleted,
            flag: pub.write ? outOfBandFlagFor(level, pub.write.tag) : null,
            deadFrames: frames,
        });
        return { state: { ...s, landed: true }, fell: true, write: pub.write, snapY, frames };
    };
    /**
     * ⛓⛓⛓ R5 SLICE 23: SEVERAL ROCKS FALLING AT ONCE, WHICH `dropRock`
     * CANNOT EXPRESS — AND THE ARITHMETIC IS NOT ADDITION.
     *
     * ⛔⛔ THREE SEQUENTIAL `dropRock` CALLS WOULD CHARGE 186 + 186 + 188 =
     * 560 DEAD FRAMES FOR A SPAN THE GAME SPENDS 186 ON. The rocks fall
     * TOGETHER: `Wand.removed()` sets `activate = true` on every tset-0
     * `Activators` in one loop, each `fall()` sets `Game.freezeObjects =
     * true`, and each rock's own camera expiry sets it FALSE **with no
     * arbitration** — so the EARLIEST release ends the freeze for all of
     * them and the later rocks' remaining hold is spent on a game nobody is
     * frozen in. (`r5Totem.L43_BOSS_WAKE.freeze`, and §34.7's
     * "harmless overlap".)
     *
     * The bug was invisible for thirteen slices because the only publisher
     * with a rock behind it — L39's rope — has exactly ONE.
     *
     * ⛓ AND THE BOSS RIDES THIS LOOP. `BossTotem.update` has no freeze test
     * above its rumble countdown or its activation ramp, and the update
     * order is fallrock → bosstotem → player, so the boss takes one step per
     * frozen frame here. That is where 186 of its 216 ticks to the clamp are
     * spent, and a model that woke it on the first LIVE tick after the span
     * would be 186 ticks late.
     *
     * @param {Array<[string, object]>} rocks  `[id, state]` pairs to drop
     * @returns {{frames: number, dropped: Array, snapY: number|null}}
     */
    const dropRocksTogether = (rocks) => {
        const started = [];
        for (const [id, rock] of rocks) {
            const pub = publishActivate(rock, true);
            if (!pub.fell) continue;
            started.push({ id, state: pub.state, write: pub.write });
        }
        if (started.length === 0) return { frames: 0, dropped: [], snapY: null };
        const bosses = [...bossStateFor(level).values()];
        const wandGoneNow = wandLeftTheWorld;
        let frames = 0;
        let snapY = null;
        let unfroze = false;
        for (let i = 1; i <= 2000 && !unfroze; i += 1) {
            for (const e of started) {
                const r = stepFallRock(e.state, playerBoxAt(state.x, state.y),
                    { cleared: true });
                e.state = r.state;
                if (r.snapY !== null) snapY = r.snapY;
                // ⛔ THE FIRST rock to release ends the span for every one of
                // them, which is why this is `||` over the set and not a
                // per-rock loop that runs to its own end.
                if (r.unfroze) unfroze = true;
            }
            for (const b of bosses) {
                // ⛓ R6 SLICE 4: and `render()` runs on every frozen frame
                // too — it is outside `Game.update` entirely. Without this
                // the head position would be 186 frames stale on the far
                // side of the drop.
                renderBossTotem(b);
                stepBossTotem(b, {
                    wandGone: wandGoneNow,
                    // ⚠ TRUE FOR THE WHOLE SPAN, including the last frame.
                    // On the release frame the rock clears the flag BEFORE
                    // the boss updates (`addUpdate` prepends and the rocks
                    // are added last), so the boss's rest arm reads FALSE
                    // there — which cannot matter, because the rest arm is
                    // behind `fullyActivated` and that lands 30 ticks after
                    // this span ends. Named rather than relied on.
                    freezeObjects: true,
                    playerY: null,
                });
            }
            frames = i;
        }
        frozenFramesOwed += frames;
        // ⛓ THE RELEASE FRAME IS A LIVE PLAYER FRAME. The rock that expires
        // first clears `Game.freezeObjects` before the Player updates, and
        // `Bot.update` already counted that frame dead — so the player takes
        // one step nobody sees.
        pendingFreeSteps += 1;
        const dropped = started.map((e) => {
            rockFalls.push({
                id: e.id,
                level,
                t: ticksCompleted,
                flag: e.write ? outOfBandFlagFor(level, e.write.tag) : null,
                deadFrames: frames,
            });
            return { id: e.id, state: { ...e.state, landed: true }, write: e.write };
        });
        return { frames, dropped, snapY };
    };
    /**
     * ── ⛔⛔ R5 SLICE 9: THE CHESTS, AND THE SEAL PIECE ONE SPAWNS ──────
     *
     * A SIXTH per-visit geometry family, and the first whose opening is
     * neither a press nor a flag: `Chest.update` walks a one-pixel line
     * beneath itself and `open()` writes `type = ""`. `chest.js` owns the
     * transcription; this owns the two joins it needs — the gate's geometry
     * and the persistence write — and the pickup the open spawns.
     *
     * ⚠ PER VISIT *AND* BANKED, like a `ShieldLock` and unlike a bridge.
     * `open()` runs `Game.setPersistence(tag, false)` and `Chest.check()`
     * on the next `new Game` removes any chest whose flag is off, so the
     * clear is banked through `pendingEarnedClears` and the LIVE half is
     * this state. Both halves, or a re-entry rebuilds the wall the leg just
     * opened.
     */
    const chestStates = new Map();
    const chestsOf = (n) => worldFor(n).chests ?? [];
    const chestStateFor = (n) => {
        if (!chestStates.has(n)) chestStates.set(n, createChestState(chestsOf(n)));
        return chestStates.get(n);
    };
    const openChestIdsNow = () => {
        const st = chestStateFor(level);
        if (st.size === 0) return null;
        const open = new Set();
        for (const c of st.values()) if (!c.solid) open.add(c.id);
        return open.size === 0 ? null : open;
    };
    /**
     * ⛓⛓ THE PULSERS, whose state is not an activator's.
     *
     * A `Pulser` is `type = "Solid"` published or not, so it cannot join
     * `activators` — "open" would read as passable (§21.65). What its group
     * changes is that it starts HITTING, and the hit moves a block.
     *
     * ⚠ PER VISIT: `Activators.check()` re-derives `activate` from the
     * group's flag on every `new Game`, and the run's own group state is
     * rebuilt with it.
     */
    const pulserStates = new Map();
    const pulsersOf = (n) => worldFor(n).pulsers ?? [];
    const pulserStateFor = (n) => {
        if (!pulserStates.has(n)) {
            const byId = new Map();
            for (const p of pulsersOf(n)) byId.set(p.id, createPulser(p.x, p.y, p.t));
            pulserStates.set(n, byId);
        }
        return pulserStates.get(n);
    };
    /**
     * ⛓⛓⛓ R7 SLICE 6b: THE ARROW TRAPS, and the live arrows they make.
     *
     * The pulsers' shape with the sign flipped. A `Pulser` is `type =
     * "Solid"` published or not; an `ArrowTrap` is Solid NEITHER way
     * (`ArrowTrap` calls no `setHitbox` and assigns no `type`), so "open" is
     * not a question anyone can ask of it either. What its group changes is
     * that it starts SHOOTING, and the shots are bodies this run owns.
     *
     * ⚠ PER VISIT, like the pulsers': `Activators.check()` re-derives
     * `activate` on every `new Game`, and an arrow in flight is a body of
     * the old world.
     */
    const arrowTrapStates = new Map();
    const arrowTrapsOf = (n) => worldFor(n).arrowTraps ?? [];
    const arrowTrapStateFor = (n) => {
        if (!arrowTrapStates.has(n)) {
            const byId = new Map();
            for (const a of arrowTrapsOf(n)) {
                byId.set(a.id, createArrowTrap({
                    id: a.id, tag: a.tag, x: a.ex, y: a.ey, t: a.t, shootDefault: a.shootDefault,
                }));
            }
            arrowTrapStates.set(n, byId);
        }
        return arrowTrapStates.get(n);
    };
    /** Every arrow currently in flight, per level. Cleared on a re-entry. */
    const arrowsInFlight = new Map();
    const arrowsFor = (n) => {
        if (!arrowsInFlight.has(n)) arrowsInFlight.set(n, []);
        return arrowsInFlight.get(n);
    };
    /**
     * ⛔⛔ THE LIVE SEAL PIECE — at most one, and it is not in the census.
     *
     * `Chest.open()` adds it at RUN time, so unlike every pickup this file
     * has handled it is not in `world.pickups` and `pickupUnderfoot` can
     * never see it. It is also the first pickup that MOVES TOWARD the
     * player rather than being walked onto (`sealCeremony.js`), which is
     * why it is stepped rather than tested.
     */
    let sealPiece = null;
    const pushableStateFor = (n) => {
        if (!pushableStates.has(n)) pushableStates.set(n, createPushableState(worldFor(n)));
        return pushableStates.get(n);
    };
    /**
     * ── ⛔⛔ R5 SLICE 13: THE SPINNERS, and they are the NINTH family ────
     *
     * Per visit, like a block and unlike a broken rock: `Spinner` keeps
     * `x`/`y`/`v` in instance variables with no persistence, so every `new
     * Game` rebuilds it at its `.oel` cell heading north-east. The one thing
     * that crosses a door is the flag a DEATH wrote, and `buildLevelWorld`
     * applies `check()` to that already — a spinner whose tag is cleared is
     * not in `world.spinners` at all.
     *
     * ⚠ IT IS THE FIRST ENEMY THE RUN STEPS, and it exists for exactly one
     * consumer: a `PushableBlock*`'s `solids` list carries `"Enemy"`. The
     * player still does not collide with it (`hazards.js` prices the damage),
     * so this state never reaches the player's sweep.
     */
    const spinnerStates = new Map();
    const spinnerStateFor = (n) => {
        if (!spinnerStates.has(n)) {
            // ⚠ HERE rather than at a call site: this is the one place a
            // spinner roster comes into existence, so the bound cannot be
            // skipped by a path that forgot to ask.
            assertSpinnerSolidsBound(n);
            spinnerStates.set(n, createSpinnerState(worldFor(n)));
        }
        return spinnerStates.get(n);
    };
    /**
     * ⛓⛓⛓ R8 SLICE 1 — THE BRIDGED CHASERS, PER VISIT.
     *
     * ⚠ PER VISIT, exactly like a spinner and for the stronger version of its
     * reason: `Bob` holds `x`/`y`/`v`/`hits` in instance fields and writes no
     * persistence at all, so a re-entered level rebuilds every one at its
     * `.oel` cell with zero velocity. R7 slice 6d MEASURED that from the
     * other side — stepping out of L5 and back respawned all three bobs while
     * the flag their deaths cleared stayed cleared (trap 150).
     *
     * ⛔ THE ROSTER IS `chasers.bridgedChaserTags()`, DERIVED from the two
     * tables — never a third list here.
     */
    /**
     * ⛔⛔⛔ R8 SLICE 1'S OWN WALL, AND IT IS A CLAIM ABOUT LIFETIME RATHER
     * THAN ABOUT MOTION — MEASURED, NOT ARGUED.
     *
     * Turning the stepper on roster-wide reddened THREE committed tapes
     * (`r7-act2-4` at tick 282, `r7-act2-5`, `r7-act2-full` — the last with a
     * PIT DEATH in L4), and the cause is one missing family, not a wrong
     * transcription: **this model's arrows hit nothing at all.**
     * `stepArrowTrapsNow` calls `stepArrow(a, {frozen, bound})` and
     * `stepArrow`'s `bodies` defaults to `[]`, so an arrow flies through
     * every body in the game. In L4 the GAME's arrows kill `bob@64,64` —
     * R7 slice 6c measured its hits climbing `0→1→2→3` and the body gone at
     * t≈158 — and in L5 they kill all three. The model's bobs therefore
     * SURVIVE, keep chasing, and reach a player who is deliberately standing
     * still to bait them.
     *
     * ⇒ stepping a body whose DEATH the model cannot see is not a partial
     * model, it is a wrong one: the position is right for as long as the body
     * should have existed and wrong for ever afterwards. So the roster is
     * scoped by the question "can this run compute this body's lifetime",
     * which is `contactPricing`'s own split — *does the run step its
     * position* — asked one layer deeper.
     *
     * ⛔ THE PREDICATE IS THE ROOM'S ARROW TRAPS, and it is deliberately
     * COARSE: whether a chaser wanders into a lane is a question about a walk
     * nobody has run, and the leash follows the player, so "this trap cannot
     * reach that body" is not a claim the level record can support. A room
     * with a trap is refused whole.
     *
     * ⚠ AND THE OTHER LIFETIME MECHANISM IS NOT REFUSED, IT IS ASSERTED.
     * `Enemy.update`'s terrain switch (water/lava destroy, the pit fall) is
     * also absent from `chaserStep`, and refusing every room with water would
     * take L6 — the one room this slice can prove anything in — off the
     * table. The honest instrument there is a CHECK rather than a refusal:
     * `assertSteppedChaserLifetime` fails BY NAME the moment a stepped body
     * stands on lethal terrain or inside a live arrow, so the gap can never
     * be silent. R7 slice 6e's L6 `despawn` is the standing witness that the
     * declared channel is what carries a removal the model cannot compute.
     */
    const chaserRoomVerdict = (n) => {
        const traps = (worldFor(n).arrowTraps ?? []);
        if (traps.length > 0) {
            return {
                stepped: false,
                why: `level ${n} holds ${traps.length} arrow trap(s) `
                    + `[${traps.map((t) => t.id).join(', ')}], and this model's arrows hit `
                    + 'NOTHING — `stepArrowTrapsNow` calls `stepArrow` with no `bodies`. '
                    + 'The GAME kills chasers with them (measured in L4: hits 0->1->2->3, '
                    + 'body gone at t~158), so a stepped body here would outlive its real '
                    + 'one and chase a player the game had already freed. The missing '
                    + 'family is Arrow x Enemy',
            };
        }
        return { stepped: true, why: null };
    };
    const chaserStates = new Map();
    const chaserStateFor = (n) => {
        if (!chaserStates.has(n)) {
            // ⚠ HERE rather than at a call site, for `spinnerStateFor`'s own
            // reason: this is the one place a chaser roster comes into
            // existence, so the bound cannot be skipped by a path that
            // forgot to ask.
            assertChaserSolidsBound(n);
            const byId = new Map();
            const verdict = chaserRoomVerdict(n);
            for (const e of (verdict.stepped ? (worldFor(n).combat?.enemies ?? []) : [])) {
                if (!isBridgedChaser(e.tag)) continue;
                byId.set(`${e.tag}@${e.x},${e.y}`, {
                    id: `${e.tag}@${e.x},${e.y}`,
                    tag: e.tag,
                    as3: e.as3,
                    // ⛔ THE CONSTRUCTED POSITION, not the `.oel` one. The
                    // census's `cx`/`cy` carry the ctor's half-tile offset,
                    // and eight pixels is what the live contact-control pair
                    // caught the first time somebody used the other pair.
                    x: e.cx,
                    y: e.cy,
                    v: { x: 0, y: 0 },
                    damage: e.row.damage,
                    // `Enemy`'s own fields, at their class defaults. Nothing
                    // on this rung's roster hits a bob, so they are carried
                    // rather than driven — and carried is what makes the
                    // refusal in `KILL_ARM_POLICY.Bob` a decision.
                    hits: 0,
                    hitsTimer: 0,
                    dying: false,
                    // ⛔ `destroy` AND `removed` ARE DIFFERENT FENCEPOSTS, and
                    // trap 87 is the whole reason both exist: `destroy` stops
                    // the body dead THIS tick, and `FP.world.remove` is ten
                    // fade ticks later. A model that collapsed them would
                    // stop counting the body ten ticks early.
                    destroy: false,
                    alpha: 1,
                    removed: false,
                });
            }
            chaserStates.set(n, byId);
        }
        return chaserStates.get(n);
    };
    /**
     * ⛔ THE CHASER'S SOLIDS BOUND — `assertSpinnerSolidsBound`'s shape, with
     * the difference in the OTHER direction.
     *
     * A spinner's list is the player's MINUS "LavaBoss"; a chaser's is that
     * minus "LavaBoss" PLUS "Enemy" (`Bob.as:39`). `stepChasersNow` models
     * the "Enemy" half itself — the census bodies and the sibling chasers —
     * and reuses `collidesSolid` for the rest, so the one type it would get
     * wrong is `LavaBoss`, and that is asserted away by room rather than
     * over-approximated.
     *
     * ⚠ AND THE SECOND HALF IS THE STATE-DEPENDENT `type`. Three classes
     * REWRITE their own `type` at run time — `IceTurret` to "Solid" in its
     * corpse arm, `FinalBoss` and `BossTotem` between "Enemy" and "Solid" —
     * so "is this body in the chaser's way" is not a question the census can
     * answer for them. Refused by name in any room that holds both, rather
     * than answered with whichever reading happened to be typed.
     */
    const assertChaserSolidsBound = (n) => {
        const w = worldFor(n);
        const census = w.combat?.enemies ?? [];
        if (!census.some((e) => isBridgedChaser(e.tag))) return;
        /**
         * ⛔ THE DIFFERENCE IS DERIVED, NOT TYPED. `chaserSolids('bob')` is
         * the class's own list and `PLAYER_SOLID_TYPES` is what
         * `collidesSolid` really answers for; the types this sweep would get
         * wrong are exactly the ones in the player's list and not the
         * chaser's. Writing "LavaBoss" here instead would be a constant
         * quoted beside its derivation (trap 97) — and would go stale the
         * moment either list moved.
         */
        const chaserTypes = new Set(chaserSolids(
            census.find((e) => isBridgedChaser(e.tag)).tag,
        ));
        const overReach = PLAYER_SOLID_TYPES.filter((t) => !chaserTypes.has(t));
        const wrong = (w.solids ?? []).filter((s) => overReach.includes(s.cls?.type));
        if (wrong.length > 0) {
            throw new Error(`levelRun: level ${n} holds a bridged chaser AND `
                + `${wrong.length} solid(s) of type [${[...new Set(wrong.map((s) => s.cls.type))]
                    .join(', ')}]. \`stepChasersNow\` reuses \`collidesSolid\`, which is `
                + 'the PLAYER\'s solids list — and a chaser\'s list does NOT carry '
                + `[${overReach.join(', ')}] (\`SOLIDS_BY_MOVER.chaser\`). The model would `
                + 'stop the chaser against something the game lets it walk through. Give '
                + '`collidesSolid` a mover before routing here.');
        }
        const shifty = census.filter((e) => TYPE_REWRITING_ENEMIES.includes(e.as3));
        if (shifty.length > 0) {
            throw new Error(`levelRun: level ${n} holds a bridged chaser AND `
                + `[${[...new Set(shifty.map((e) => e.as3))].join(', ')}], whose runtime `
                + '`type` is rewritten at run time (`IceTurret.as:94`, `FinalBoss.as:233`, '
                + '`BossTotem.as:296,315`). A chaser\'s `solids` carries "Enemy", so '
                + 'whether one of those bodies BLOCKS it depends on which side of its own '
                + 'flip it is on — a question the census cannot answer. Refused rather '
                + 'than answered with one reading.');
        }
    };
    /**
     * The live chaser bodies, as `{id, tag, rect}` — the "Enemy" half of a
     * chaser's own sweep, and the danger map's ingredient (c).
     */
    const chaserRectsNow = () => {
        const st = chaserStateFor(level);
        if (st.size === 0) return null;
        const out = [];
        for (const c of st.values()) {
            if (c.removed) continue;
            out.push({ id: c.id, tag: c.tag, rect: chaserBoxAt(c.tag, c.x, c.y) });
        }
        return out.length === 0 ? null : out;
    };
    /**
     * The live spinner bodies for the block's collision query.
     *
     * ⚠ NULL WHEN THERE IS NOTHING TO SAY, like `pushableRectsNow` — 112 of
     * the 116 levels hold no spinner at all and this is on the hot path.
     */
    const spinnerRectsNow = () => {
        const st = spinnerStateFor(level);
        return st.byId.size === 0 ? null : spinnerRects(st);
    };
    /**
     * ── R4: THE LIGHTPOLE, which is per-visit STATE over a BANKED flag ──
     *
     * `LightPole.hit()` toggles `activate` behind a 25-tick `hitsTimer`, and
     * `set activate` calls `Game.setPersistence(tag, !activate)` — so a
     * press writes a persistence flag, and the ledger has to say so.
     *
     * Two lifetimes AGAIN, and this one has them in the same entity: the
     * `hitsTimer` and the entity are per visit, while the FLAG is banked
     * (its ctor reads it back: `activate = !Game.checkPersistence(tag)`), so
     * a pole lit on one visit boots lit on the next. `poleFlags` is the
     * banked half; the per-visit half is rebuilt from it on every entry.
     *
     * ⚠ IT IS A TOGGLE, NOT A LATCH. A second hit puts the flag back, so the
     * ledger entry is derived from the FINAL state and never from a count of
     * hits — which is exactly the shape of error a "count the presses"
     * accounting would make.
     */
    const poleFlags = new Map();
    const poleKey = (n, tag) => `${n}:${tag}`;
    /**
     * R5 slice 5: `BreakableRock.endAnim`'s persistence writes, keyed by the
     * flag they LAND on rather than by the rock — which for a `tag = -1`
     * rock is a slot in another level entirely (`outOfBandFlagFor`). A Map
     * because L92's two rocks resolve to the SAME flag ({91,29}) and the
     * ledger has one entry, not two.
     */
    const rockFlags = new Map();
    /**
     * ⛓⛓ R7 slice 6 (R6 debt 2): one record per COLLECTED pickup whose class
     * clears its own tag — `"<level>:<tag>" -> {id, level, tag, t}`.
     *
     * ⛔ BANKED AT THE CEREMONY'S COMPLETION, not read off `world.pickups` at
     * the end, and the difference is a whole walk. `collectedPickups` is
     * keyed by position and `world` is only ever the level the run is IN, so
     * a six-level walk that collected the sword in L10 and finished in L64
     * could not answer "which tags did I clear" from the world at all. The
     * completion site is also the only place `doActions` is true, which is
     * the guard fourteen of the fifteen writes sit behind.
     */
    const pickupFlags = new Map();
    /** ⛓ R5 slice 12: one record per BURN — `{id, level, t, goneAt, flag}`. */
    const treeBurns = [];
    const polesOf = (n) => worldFor(n).pressResponders.filter((r) => r.as3 === 'LightPole');
    const poleFlagFor = (n, tag) => {
        const key = poleKey(n, tag);
        if (!poleFlags.has(key)) {
            // `Game.checkPersistence(tag)` — true unless something cleared
            // it, and the tape's declared clears are the only other writer.
            poleFlags.set(key, !(clearedByLevel.get(n) ?? []).includes(tag));
        }
        return poleFlags.get(key);
    };
    const poleStates = new Map();
    const poleStateFor = (n) => {
        if (!poleStates.has(n)) {
            const byId = new Map();
            for (const p of polesOf(n)) {
                byId.set(`${p.tag}@${p.x},${p.y}`, {
                    persistTag: p.persistTag,
                    t: p.t,
                    // `LightPole`'s ctor, last line.
                    activate: !poleFlagFor(n, p.persistTag),
                    hitsTimer: 0,
                });
            }
            poleStates.set(n, byId);
        }
        return poleStates.get(n);
    };
    const freshVisitState = (n) => {
        bridgeStates.set(n, new Map());
        pushableStates.set(n, createPushableState(worldFor(n)));
        // R5 slice 13: a re-entered room rebuilds every spinner at its cell,
        // heading north-east — there is no state on the class to carry.
        spinnerStates.delete(n);
        // ⛓⛓⛓ R8 slice 1: and every bridged chaser, for the strongest
        // version of that reason — R7 slice 6d MEASURED it from the other
        // side. Stepping out of L5 and back respawned all three bobs while
        // the flag their deaths cleared stayed cleared (trap 150): the
        // FIGHT is per visit and the CLEAR is durable, which is what decides
        // where a segment may be cut.
        chaserStates.delete(n);
        /**
         * ⛓⛓⛓ R5 SLICE 15: AND A RE-ENTERED ROOM REBUILDS EVERY CRUSHER AT
         * ITS CONSTRUCTOR CELL — WITH NOTHING TO CARRY AND NOTHING TO CHECK.
         *
         * Source-verified: `Crusher.as` has no `check()`, no `removed()` and
         * no `Game.setPersistence` call of any kind, so unlike a spinner
         * (whose roster IS filtered by a cleared flag) a crusher is
         * unconditional AND positionless across a build. Two consequences a
         * route plan has to hold at once:
         *
         *   ⛓ A BOTCHED PARK IS ONE ROOM-EXIT FROM RESET — the recovery from
         *     sealing a corridor is to leave and come back.
         *   ⛔ AND EVERY WINDOW BOOT RESETS IT. A window that boots into L41
         *     gets the crusher at (256,80) however the previous window left
         *     it, so a plan may NEVER carry a crusher position across a
         *     re-boot; it re-derives them per boot. `Bot.as:811`'s re-boot to
         *     a tape's own boot block is the same fact from the driver's side.
         */
        crusherStates.delete(n);
        // ⛓⛓⛓ R5 SLICE 20, AND IT IS THE HARDEST VERSION OF THE RULE ABOVE.
        // A crusher survives a rebuild as an entity and loses its POSITION;
        // an `IceTurret` loses its DEATH. `IceTurret` has no `check()`, no
        // `removed()`, no tag and no `setPersistence` anywhere, so the
        // rebuilt room holds a live 32x32 shooter where the run left a
        // corpse on a button — and the button un-presses with it. ⇒ the
        // kill, the pushes, the hold and EVERYTHING DOWNSTREAM OF THE HOLD
        // have to share one window; there is no state to carry across.
        turretStates.delete(n);
        bossStates.delete(n);
        shieldBossStates.delete(n);
        // ⛓⛓⛓ R6 slice 6f: and the Owl, whose rebuild re-arms `started`,
        // `rockfallTime`, `cpod`, `hitThisSequence` and `hits` — every one of
        // them an instance field — and rebuilds his four pods, each replaying
        // its constructor's `play("open")`. ⛔ THE DRAW STREAM IS NOT DROPPED:
        // the generator is a `public static`, so its position is a fact about
        // the PAGE and a re-entry pays a SECOND level build from wherever the
        // first visit left it. `owlStreamFor` refuses a second room rather
        // than modelling a position it has not measured.
        finalBossStates.delete(n);
        podStates.delete(n);
        owlRocks = [];
        owlGrenades = [];
        owlPendingRocks = [];
        owlPendingGrenades = [];
        // ⛓ R6 slice 6c. `new Game` rebuilds the NPC with `talked` false, and
        // the CLEARED tag is what keeps `talk()` from running again — the
        // flag, not the roster, is the memory. See `watcherStateFor`.
        watcherStates.delete(n);
        // ⛓ R6 slice 6c. A rebuilt door has `seenSeal` false, so a second
        // visit fires a second ceremony — and if its own tag has been
        // cleared, `FinalDoor.check()` removes it and the build's
        // persistence arm never places it at all.
        finalDoorStates.delete(n);
        poleStates.delete(n);
        // R5 slice 9: a chest whose flag is still TRUE is rebuilt SHUT, and
        // a pulser's `activate` is re-derived from its group. The chest whose
        // flag the run cleared is removed by `applyEarnedClears` ->
        // `PERSISTENCE_RESPONSE.chest`, which is the OTHER half and runs one
        // line earlier in the swap.
        chestStates.delete(n);
        pulserStates.delete(n);
        // A seal piece cannot cross a door: `Game` is reconstructed and the
        // pickup is a run-time entity of the old world.
        sealPiece = null;
    };
    /**
     * The bridges walkable RIGHT NOW, as ids the two queries take.
     *
     * ⚠ THE INDEX IS THE OBSERVATION THE CURRENT TICK WILL PRODUCE, not the
     * one it started from, and the fencepost is the probe's own arithmetic:
     * `probe-seedling-bridge.mjs` pressed at tape tick 25 and the player's
     * `y` first moved on observation **85**. A tick that produces
     * observation 85 ENTERS with `ticksCompleted` at 84, so a gate written
     * against the entry index would open the crossing a tick late and the
     * model would report the player still pinned against a tile the game had
     * already opened.
     */
    // ⚠ NULL WHEN THERE IS NOTHING TO SAY, on both of these. They are asked
    // on EVERY tick of every level — a fresh Set and a fresh Map per tick,
    // for the 108 levels that hold neither a bridge nor a block, is pure
    // allocation on the hot path, and `null` is already the "no live state"
    // arm both queries take.
    const openBridgeIdsNow = () => (bridgeStateFor(level).size === 0
        ? null : openBridgeIds(level, ticksCompleted + 1));
    const brokenRockIdsNow = () => (rockStateFor(level).size === 0
        ? null : brokenRockIds(rockStateFor(level), ticksCompleted + 1));
    // ⚠ `ticksCompleted + 1`, exactly like the rocks': the geometry query
    // is being made FOR the tick about to run, and a burn that completes on
    // it has already been processed by `World.updateLists` at the top of
    // the frame.
    const burnedTreeIdsNow = () => (burnStateFor(level).size === 0
        ? null : burnedTreeIds(burnStateFor(level), ticksCompleted + 1));
    const pushableRectsNow = () => {
        const st = pushableStateFor(level);
        return st.byId.size === 0 ? null : pushableRects(st);
    };
    const openBridgeIds = (n, observation) => {
        const open = new Set();
        for (const [id, b] of bridgeStateFor(n)) if (observation >= b.walkableAt) open.add(id);
        return open;
    };

    let level = boot.level;
    let world = worldFor(level);
    const spawn = spawnFromBoot(boot);
    let state = {
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        terrain: INITIAL_TERRAIN_STATE,
        // R4: the four sticky hazard flags and the drown timer, at the
        // values a fresh `Player`'s initialisers give them.
        hazard: INITIAL_HAZARD_FLAGS,
        drown: { timer: 0, drowning: false },
        // R4: the facing every press rect is a function of, at
        // `Player.as:61`'s own initialiser. A boot faces DOWN.
        direction: INITIAL_DIRECTION,
        // The boot `Game` arms the latch on its first frame exactly as an
        // arrival does (`Game.as:803-812` runs `check()` above the
        // blackCover gate), so a spawn that sits on a teleporter does not
        // immediately fall through it.
        latched: initialLatch(world, spawn.x, spawn.y),
        hitX: null,
        hitY: null,
    };
    // The world's first LIVE tick, when no Tile has run its own first
    // update yet and so no tile is solid. `blackCover` frames update
    // nothing, so tick 0 is that tick for the boot world — and the tick
    // after an arrival is that tick for the destination world, for exactly
    // the same reason. It is per WORLD, not per run.
    let firstTickInWorld = true;
    /**
     * ⛔⛔⛔ R5 SLICE 22: THE CAMERA IS LIVE NOW, AND SLICE 20'S NAMED
     * SIMPLIFICATION IS WHAT THE RECORDING REFUTED.
     *
     * `stepIceTurretsNow` declared `onScreen: true` and said so out loud —
     * *"the camera is a render-side quantity this package does not carry,
     * and every leg that pushes a corpse stands within a tile of it"*. Both
     * halves were true and the conclusion was still wrong, because the gate
     * does not only decide whether a CORPSE glides: `Enemy.update`'s early
     * return also skips `Mobile.mobileUpdate`, and an `IceTurret`'s
     * `input()` SNAPS ITS OWN y BY 8 px on the first tick it runs. So the
     * camera decides WHERE THE TURRET STANDS, which decides when the player
     * crosses its 128 px range, which decides the phase of a 45-tick volley
     * clock — and the recording put the freeze 33 ticks from where a
     * permanently-on-screen turret puts it.
     *
     * ⇒ [[feedback_the_obstacle_is_the_machine]] once more: "off screen
     * means it cannot move" and "off screen means it is where it started"
     * are the same sentence, and only the first one had been written down.
     *
     * ⚠ THE PHASE IS `cameraTrack`'s, LIVE. `view()` runs at the END of
     * `Game.update`, after every entity — so the camera an enemy is gated
     * against during tick T is the one produced at the end of T-1, which is
     * exactly the value this variable holds when `stepIceTurretsNow` runs.
     * A load settles it through the fade's own `view()` calls first
     * (`camera.js` header, point 3).
     */
    let cam = null;
    /**
     * ⛓⛓⛓ R6 SLICE 3: `Game.shake`, and the band it turns the camera into.
     *
     * `shake` is a `public static` — it survives world swaps and decays
     * inside `view()`, once per ENGINE frame. `camBand` is null while the
     * camera is still a point; the first `view()` with `shake > 0` opens it
     * and it NEVER closes inside a level, because the jiggle is written to
     * `FP.camera` itself and every later lerp compounds on it. Only a new
     * `Game` clears it (`loadlevel` writes the camera raw).
     */
    let shake = 0;
    let camBand = null;
    const settleCameraForLoad = () => {
        cam = initialCamera(state.x, state.y);
        // ⛓ A LOAD CLEARS THE BAND. `loadlevel` writes `FP.camera` from the
        // arrival position with no history, so whatever the jiggle had
        // accumulated is gone — the one thing that collapses it.
        camBand = null;
        // ...and the fade DRAINS the shake, at one per engine frame. The
        // fade's length is a BAND, so this is only knowable when the shake
        // cannot survive the shortest one; `shakeAcrossLoad` refuses
        // otherwise rather than subtracting a number nobody measured.
        const carried = shakeAcrossLoad(shake, LEGACY_FADE_PER_LOAD);
        if (!carried.certain) {
            throw new Error(`levelRun: Game.shake is ${shake} at a level load in level `
                + `${level}, and ${carried.why} This rung models the certain arm only.`);
        }
        shake = carried.shake;
        for (let i = 0; i < CAMERA_LOAD_SETTLE_TICKS; i += 1) {
            cam = stepCamera(cam, state, worldFor(level).world);
        }
    };
    settleCameraForLoad();
    /**
     * One `view()`, whichever face the camera currently has.
     *
     * ⚠ THE POINT PATH IS UNCHANGED AND IS THE ONLY ONE ANY COMMITTED TAPE
     * TAKES. Every fixture through R5 declares `noDamage`, and the roster's
     * other two shake writers are the totem's (slice 4) — so `shake` is 0
     * for all 100 of them and this is `stepCamera` with a branch in front.
     */
    const stepCameraNow = (player, worldRec) => {
        // ⛓⛓⛓ R6 SLICE 4: `Game.cameraTarget`, which the BossTotem
        // overwrites every frame he exists. It REPLACES the follow (and
        // with it the inventory term), so the camera jumps by that offset
        // the tick he comes into range — and it is a STATIC that stays
        // frozen at the last midpoint through the whole white-out (§8.16).
        const cameraTarget = bossCameraTarget;
        if (camBand === null && shake === 0) {
            cam = stepCamera(cam, player, worldRec, { cameraTarget });
            return;
        }
        if (camBand === null) camBand = cameraBand(cam);
        const r = stepCameraBand(camBand, player, worldRec, { shake, cameraTarget });
        camBand = r.band;
        shake = r.shake;
        // ⛔ THE BAND CAN COLLAPSE BACK TO A POINT, and when it does the
        // camera is exactly known again — the round's dead zone is what
        // makes that happen rather than a decaying interval that never
        // closes. Reading it back into `cam` keeps every downstream
        // consumer on the exact path whenever it can be.
        if (bandIsExact(camBand)) {
            cam = { x: camBand.x.lo, y: camBand.y.lo };
            camBand = null;
        } else {
            cam = null;
        }
    };
    /**
     * `Enemy.onScreen()` for a consumer that needs a BOOLEAN.
     *
     * An uncertain band is a refusal, not a `false`: "the camera might not
     * have contained it" and "the camera did not contain it" are the two
     * answers a silent `false` would merge, and one of them is a stance the
     * window has to move.
     */
    const onScreenNow = (rect, who) => {
        if (camBand === null) return camOnScreen(rect, cam);
        const verdict = onScreenUnderShake(rect, camBand);
        if (verdict === 'uncertain') {
            throw new Error(`levelRun: whether ${who} is on screen at tick `
                + `${ticksCompleted} depends on where inside \`Game.shake\`'s jiggle the `
                + 'camera landed, and the two draws that decide it are not indexable '
                + '(camera.js, "THE SHAKE, AND WHY IT IS A BAND"). `Enemy.update` '
                + 'early-returns at ZERO margin, so this is the difference between a body '
                + 'that damages and one that does not. Move the stance away from the '
                + 'screen edge, or wait the shake out.');
        }
        return verdict === 'on';
    };
    let ticksCompleted = 0;
    const transitions = [];
    /**
     * The PIT TRANSPORTS this run drove, `{t, from_level, to_level}` — the
     * subset of `transitions` a fall produced.
     *
     * Deliberately a SEPARATE list rather than a `kind` field on the
     * transition records: those are the minimal symmetric record the
     * differential compares element-wise, and the game side derives them
     * from the level field alone, so it cannot know a kind. This is JS-side
     * bookkeeping, and it exists so a consumer can say "the model expects a
     * transport here" — which is what makes the harness's
     * `saw_input_refused` check TWO-SIDED instead of a blanket tolerance.
     */
    const transports = [];

    // ── grants ────────────────────────────────────────────────────────
    // The shared contract (R0 kickoff §3.1): a grant is applied by BOTH
    // sides on the FIRST OBSERVATION TICK whose level equals the grant's
    // level. Observation `t` is the state after `t` completed ticks, and a
    // world swap lands at END of tick `t`, so "the run's level just became
    // L" and "observation `t` reports level L" are the same instant. Hence
    // the two call sites below and no third: construction (the boot level,
    // observed at tick 0) and immediately after a swap.
    //
    // FIRST entry only — a revisit does not re-grant. For a boolean that is
    // invisible, but `health` ADDS to `hitsMax`, so a re-grant on every
    // visit would silently inflate it.
    //
    // ⚠ `inventory` itself is declared beside `worldFor`, because a level's
    // BUILD reads it (`levelWorld.ADDED_TIME_REMOVAL`).
    /**
     * ── R4: `Main.SAVE_FILE.data.hasKey`, as a set of key types ────────
     *
     * The BossKey is the one pickup whose effect is not one of the fourteen
     * item properties: `BossKey.removed()` is `Player.hasKeySet(keyType,
     * true)` and nothing else — it does not even call `super.removed()`, so
     * it writes no persistence. `BossLock.update` gates on
     * `Player.hasKey(keyType)`, so this is the state that decides whether a
     * lock opens, and it lives here rather than in `inventory` because the
     * mirror's shape is `ITEM_PROPERTIES` and a key is not in it.
     *
     * ⚠ There is no `grants` equivalent, deliberately. A segment inherits
     * ITEMS through a boot-level grant, and a segment that needed a key
     * would need a second inheritance channel with its own AS3 side. The R4
     * segmentation puts the key collection and the lock it opens in the SAME
     * segment for that reason; `assertRouteWellFormed` checks it.
     *
     * ⛔⛔⛔ R6 SLICE 5: …AND THE v6 `save` BLOCK IS THAT SECOND CHANNEL,
     * AND THIS SIDE HAD NEVER READ IT.
     *
     * R5 slice 23's AS3 batch added `save: {totem_parts, keys, seal_parts}`
     * and `Bot.as:1027-1028` applies it — `for (si …) Main.hasKeySet(
     * int(saveKeys[si]), true)` — at the boot, before the first level
     * builds. `tapeFormat` parses and validates the array. `levelRun`
     * consumed `totem_parts` and `seal_parts` and **dropped `keys` on the
     * floor**: `bootSave.keys` appeared nowhere in this file.
     *
     * ⇒ a tape declaring `save.keys` would boot a GAME holding the key and
     * a MODEL that does not, and the two would part at the first
     * `BossLock` — which gates on exactly this set. Nothing in the roster
     * declares one, so it is a silence with no witness rather than a red
     * fixture: the shape [[feedback_silent_watcher_vacuous_negative]] and
     * the reason this comment is longer than the fix. Found by driving the
     * L20 shield walk from a keyed boot and watching the lock stay shut.
     */
    const keys = new Set(bootSave.keys ?? []);
    const grantsByLevel = new Map(grants.map((g) => [g.level, g.items]));
    const firedGrants = [];
    const applyGrantsFor = (n) => {
        if (!grantsByLevel.has(n)) return null;
        const items = grantsByLevel.get(n);
        grantsByLevel.delete(n);
        for (const item of items) applyItem(inventory, item);
        const record = { t: ticksCompleted, level: n, items: [...items] };
        firedGrants.push(record);
        return record;
    };
    applyGrantsFor(level);

    /**
     * ⛓⛓⛓ R6 SLICE 3: THE END-OF-TICK WORLD SWAP, ONCE.
     *
     * Every `FP.world = new Game(...)` in this run's reach lands here — the
     * teleporter's, the pit fall's, and now `restartLevel()`'s. The five
     * coupled facts this module's docblock names (the arrival offset, the
     * zeroed velocity, the reset terrain state, the pre-armed latch and the
     * destination world's own `beforeTypeFlip` tick) plus the six the
     * slices since have added (the earned clears cashed, the per-visit
     * state rebuilt, the pending thrust dropped, the freeze cleared, the
     * blasts torn down, the camera rewritten raw) are ELEVEN facts a second
     * copy would agree with exactly until one of them was edited.
     *
     * ⚠ WHAT IS **NOT** HERE IS THE TRANSITION RECORD, and that is the
     * difference a death makes. `restartLevel()` reboots into the SAME
     * level, so the level field never changes and `deriveTransitions` — the
     * one derivation both sides share — reports nothing. The witness of a
     * death is the POSITION JUMP in the stream and the `playerDeaths`
     * ledger beside it, never a transition.
     *
     * @param {number} o.toLevel     the destination (the same level, for a death)
     * @param {number} o.fromLevel   the level being torn down
     * @param {?object} o.carriedSwim the `Music` channel, which is a static
     *                                and survives — see the note at the call
     * @param {Function} o.arrivalFor `(world) => state`
     * @param {{x:number,y:number}} o.ctor the NEW `Game`'s constructor args
     * @returns {?object} the grant record this entry fired, if any
     */
    const enterWorld = ({ toLevel, fromLevel, carriedSwim, arrivalFor, ctor }) => {
        level = toLevel;
        // A `Game` is constructed here, so this is where `Lock.check()` runs
        // and where a flag the player turned off finally removes its lock.
        applyEarnedClears(level);
        // ...and so is where every `added()` runs again, which is the other
        // way a memoised world can be the wrong one (R5 slice 4).
        dropWorldIfBuiltStale(level);
        world = worldFor(level);
        // A new `Game` means new entities: every lock is solid again.
        if (!noclip) freshActivatorState(level);
        // ⚠ ...and so is every bridge, and every block is back in the
        // corridor. `Tile.bridgeOpeningTimer` and `PushableBlockFire.tile`
        // are instance variables with NO persistence — unlike the clear a
        // shield lock earns, which `applyEarnedClears` above has just
        // cashed. Two families, two lifetimes, three lines apart on purpose.
        if (!noclip) freshVisitState(level);
        // A thrust cannot outlive its level either: `spear()` collides the
        // rect against `FP.world`, and by the time it fires the world is the
        // destination's.
        pendingThrust = null;
        slashRepeats = [];
        // ⛓⛓ R6 SLICE 6d: …and a RUNTIME pickup cannot outlive its level
        // either, for a stronger reason than the thrust's. A placed pickup is
        // rebuilt by the destination's `loadlevel`; a `Seed` the Watcher added
        // is in no `.oel` at all, so a `new Game` does not rebuild it — it
        // simply ceases to exist. Cleared rather than carried, because
        // "carried" is not a state the game has.
        runtimeSeeds = [];
        pendingSeedAdds = [];
        state = arrivalFor(world);
        // ⛔⛔ THE SWIM CHANNEL IS A MIXER, NOT A `Player` FIELD, AND IT
        // SURVIVES THE DOOR — plus the twenty frames the door costs.
        //
        // The arrival builds a WHOLE NEW Player, which is right for
        // `terrain`, `direction` and `drownTimer` (all instance
        // initialisers) and WRONG for this: `Music`'s pinned channels are
        // statics, and `Bot.update` steps them above the armed check and
        // above the dead-frame gate on purpose — "a mixer does not stop
        // because the room is fading". Found by the feather walk's first
        // recording: 0.25 px (`SWIM_BOOST_SPEED`) eight ticks after a door.
        if (carriedSwim) {
            state = { ...state, swim: stepChannel({ ...carriedSwim }, LOAD_DEAD_FRAMES) };
        }
        firstTickInWorld = true;
        // ⛓⛓ AND THE FREEZE DOES NOT CROSS THE DOOR. `frozenTimer` is
        // `private var frozenTimer:int = 0` on the Player and the arrival is
        // a new one — the same argument that makes `terrain`, `direction`
        // and `drownTimer` reset, and the OPPOSITE of the swim channel's.
        frozenTimer = 0;
        // ⛓⛓⛓ R6 SLICE 3: AND SO DOES THE DAMAGE, FOR THE SAME REASON AND
        // WITH ONE EXCEPTION THAT IS NOT HERE. `hits`, `hitsTimer` and
        // `directionFace` are instance fields of the new `Player`;
        // `Main.hitsMax` is a STATIC and is not touched — which is exactly
        // why a death costs the run its damage and not its hearts.
        damage = createPlayerDamage();
        // ⛔ AND SO DO THE BLASTS AND THE SHOTS IN FLIGHT. They are runtime
        // entities of the world being torn down; `Game`'s reconstruction
        // takes them with it, and one that survived a door would be the
        // corpse bug from the other side.
        blastStates.delete(fromLevel);
        wandShotStates.delete(fromLevel);
        // ⛓ THE NEW `Game`'s OWN ARGS, for a later `restartLevel()`.
        worldCtor = { x: ctor.x, y: ctor.y };
        // ⛓ AND THE CAMERA IS A NEW `Game`'s TOO — `loadlevel` writes it raw
        // from the arrival position and the fade's own `view()` calls settle
        // it, which is `cameraTrack`'s level-change arm as a live step. It
        // also drains `Game.shake` and clears the band; see the function.
        settleCameraForLoad();
        // `ticksCompleted` is already the arrival observation's index, so the
        // grant's `t` is that observation — the same tick the transition
        // record carries, and the same tick `Bot.as` applies it on. Applied
        // AFTER the swap, so a grant naming the level being LEFT does not
        // fire on the way out.
        return applyGrantsFor(level);
    };

    /**
     * ⛓⛓⛓ R6 SLICE 6d: THE ENDING'S OWN WORLD SWAP — one implementation,
     * two callers.
     *
     * The THIRD game-initiated swap on the ladder, and the first that
     * CHOOSES ITS DESTINATION. A teleporter goes where its attributes say; a
     * death goes back to the same `Game`'s own constructor args;
     * `Seed.update`'s three terminal arms are literal `FP.world = new
     * Game(...)` statements written inside a pickup, each with a
     * `Game.cutscene` write on the line above it.
     *
     * ⛔ AND ONLY THE BLOODY ONE PRODUCES A TRANSITION RECORD. The level
     * FIELD is what `deriveTransitions` reads — the one derivation both
     * sides share — so a reboot into the SAME level is invisible to it,
     * exactly like a death. The `plain` and `tree` arms are both
     * `new Game(level, …)`: they are LOADS the transition list cannot see,
     * and the dead-frame band has to read them from `endingReboots`
     * instead or the residue is a whole fade out per reboot.
     *
     * @param {object} atTick the tick's own final state (for the mixer)
     * @param {object} hits   the tick's `{hitX, hitY}`
     */
    const finishEndingReboot = (atTick, hits) => {
        const reb = pendingSeedReboot;
        pendingSeedReboot = null;
        worldCtor = { x: reb.ctor.x, y: reb.ctor.y };
        // ⛓ The flag is set on the line ABOVE the world assignment, so the
        // destination's very first `Game.update` already takes the cutscene
        // arm — which for `[1]` is why `v.y` is -1 before the first live
        // frame, and for `[2]` is why the player is inert from the load
        // fade onward.
        if (reb.cutscene !== null) cutscene[reb.cutscene] = true;
        // `Game.cutscene[2] = false` — the tree arm is the ONLY thing in the
        // game that clears it, apart from `menuAndRestart`'s save wipe.
        if (reb.arm === 'tree') cutscene[2] = false;
        const grant = enterWorld({
            toLevel: reb.toLevel,
            fromLevel: reb.fromLevel,
            carriedSwim: atTick?.swim ?? state.swim ?? null,
            // The ctor args ARE the spawn block, and `spawnFromBoot` is the
            // same half tile a boot takes. A reboot is a BOOT (§5).
            arrivalFor: () => arriveAtRespawn(worldFor(reb.toLevel), worldCtor),
            ctor: worldCtor,
        });
        if (reb.arm === 'bloody') {
            cutsceneWalk = {
                arm: reb.cutscene,
                level: reb.toLevel,
                from: reb.fromLevel,
                startedAt: ticksCompleted,
            };
            state = { ...state, vy: CUTSCENE_1_WALK.vy };
        } else if (reb.arm === 'plain') {
            /**
             * ⛓⛓⛓ THE TREE, AND IT IS THE SAME `.oel` OBJECT. `loadlevel`
             * has just rebuilt the room with `cutscene[2]` true, so
             * `Game.as:2185` hands `Seed` a fifth argument of `true` and
             * the pickup comes back as a growing tree.
             * `endingChain.treeSchedule` is the clock; `CUTSCENE_2_HOLD` is
             * why its frames are TICKS and not dead frames.
             */
            cutsceneHold = {
                arm: 2,
                id: `seed@tree:${reb.toLevel}`,
                level: reb.toLevel,
                enteredAt: ticksCompleted,
                phase: 'grow',
                r: 0,
                ...treeSchedule(),
            };
        } else if (reb.arm === 'tree') {
            // ⛓⛓⛓ THE CREDITS. `menuState` survives the constructor only
            // because `Game.menu = true` was assigned first: the ctor takes
            // `_menuState` and then calls `end()`, whose
            // `if (!menu) { … menuState = 0 … }` would wipe it.
            credits = {
                t: ticksCompleted,
                menuState: CREDITS.menuState,
                badge: CREDITS.badge,
                level: reb.toLevel,
            };
        }
        const sameLevel = reb.fromLevel === reb.toLevel;
        const record = sameLevel ? null : {
            t: ticksCompleted,
            from_level: reb.fromLevel,
            to_level: reb.toLevel,
        };
        if (record) transitions.push(record);
        endingReboots.push({
            t: ticksCompleted,
            arm: reb.arm,
            id: reb.id,
            fromLevel: reb.fromLevel,
            toLevel: reb.toLevel,
            cutscene: reb.cutscene,
            respawn: { x: state.x, y: state.y },
            // ⛓ A same-level reboot is a LOAD the transition list cannot
            // see — the dead-frame band's `loads` term has to read it from
            // here or the residue is a whole fade out.
            sameLevel,
        });
        firstTickInWorld = true;
        return { transition: record, grant, ...hits };
    };

    // ── the equip (R4) ────────────────────────────────────────────────
    // `Main.primary` is an INDEX into `Inventory.items`, and
    // `Player.useItem` switches on `Inventory.getItem(index)` — so this one
    // integer decides whether an X press is a sword slash or a spear
    // thrust, and the L63 bridge decrements only under a Spear.
    //
    // ⚠ THE ORDER WITHIN A TICK IS GRANTS THEN EQUIPS, on both sides. A
    // segment inherits its items through a boot-level grant and its slot
    // through `equips: [{t: 0, slot: 1}]`, so an equip applied first would
    // be selecting into an empty array. `Bot.as` calls `applyEquipsFor`
    // immediately after `applyGrantsFor` for the same reason.
    //
    // ⚠ AND THE BOUND IS CHECKED HERE, not in `parseTape`. The parser sees
    // a tape; the run knows what the run HOLDS. `Inventory.getItem` on an
    // out-of-range slot returns `undefined`, which `useItem`'s int coercion
    // turns into 0 — the sword — so an over-range slot is a SILENT
    // downgrade from a thrust to a slash, which is exactly the kind of
    // divergence that surfaces two thousand ticks later against a bridge
    // nobody was looking at.
    // ⛓ R7: …unless the v8 seam declared one. A segment inherits the slot
    // its predecessor had SELECTED, which is not the same as re-pressing for
    // it: an `equips` row is a press at a tick and this is the state before
    // tick 0.
    let primary = seamBoot['save.primary'] ?? 0;
    const equipsByTick = new Map(equips.map((e) => [e.t, e.slot]));
    const firedEquips = [];
    const applyEquipsAt = (t) => {
        if (!equipsByTick.has(t)) return;
        const slot = equipsByTick.get(t);
        // Consumed, exactly as a grant is: `advance` re-asks at the top of
        // every tick and construction already asked for tick 0.
        equipsByTick.delete(t);
        const slots = inventorySlotsFor(inventory);
        if (slot >= slots.length) {
            throw new Error(
                `levelRun: the tape equips slot ${slot} at tick ${t}, but the run holds `
                + `${slots.length} item(s) (slots [${slots.join(', ')}]). `
                + '`Inventory.getItem` on an out-of-range slot is `undefined`, which '
                + '`useItem` coerces to 0 — so every press from here on would be a '
                + 'SWORD SLASH and the game would never say so. Grant or collect the '
                + 'item before selecting it.',
            );
        }
        primary = slot;
        firedEquips.push({ t, slot });
    };
    applyEquipsAt(0);
    /**
     * R4: select a slot RIGHT NOW, at the tick the run has reached.
     *
     * ⚠ THE TAPE CANNOT DECLARE THIS ONE, and that is the whole reason it
     * exists. A headline walk collects the spear rather than inheriting it,
     * so the tick at which the slot becomes selectable is a fact SYNTHESIS
     * produces — a `relax.equips` written before the drive would be guessing
     * the length of four legs and a ceremony. The driver calls this, the run
     * records it in `equipsFired`, and `synthesizeLegs` writes THAT onto the
     * tape: the emitted `{t, slot}` is a measurement, and replaying it
     * through `applyEquipsAt` lands on exactly the same tick.
     *
     * A segment still declares its own at `{t: 0}` — it inherits the spear
     * through a boot grant, which is a tick-0 fact.
     */
    const equipNow = (slot) => {
        if (equipsByTick.has(ticksCompleted)) {
            throw new Error(`levelRun: the tape already equips slot `
                + `${equipsByTick.get(ticksCompleted)} at tick ${ticksCompleted}, and a `
                + 'leg is selecting one there too. Two writes to `Main.primary` on one '
                + 'observation would leave the winner up to array order, which is what '
                + "`parseEquips`'s duplicate-tick check refuses on the tape.");
        }
        equipsByTick.set(ticksCompleted, slot);
        applyEquipsAt(ticksCompleted);
    };

    // ── the PRESS (R4) ────────────────────────────────────────────────
    /**
     * The thrust an X press scheduled, or null.
     *
     * ⚠ ONE TICK LATE BY TRANSCRIPTION. `Player.update` calls `slash()` and
     * `spear()` BEFORE `super.update()`, and `super.update()` is what runs
     * `input()` — so the press that sets `spearing` on tick T fires its rect
     * on tick T+1, against the position T left and the facing T STARTED
     * with (`set spearing` captures `spearDirection = direction`, and
     * `sprites()` — the only writer of `direction` — runs at the END of the
     * update). The bridge probe confirmed that lag end to end.
     *
     * ⚠ ONE FIRING PER PRESS, MEASURED. `spearDelayMax` is 1, so `spear()`
     * would re-collide the rect every OTHER tick for as long as `spearing`
     * holds, and `spearing` is cleared by an 8-frame 45 fps Spritemap's
     * complete callback — arithmetic across two frame rates this model does
     * not have. `probe-seedling-bridge.mjs` measured the answer instead: one
     * press, one decrement (see `bridges.js`). A rung that lengthens the
     * animation re-opens this.
     */
    let pendingThrust = null;
    /**
     * ⛓ The four EXTRA hit ticks one sword press buys — `presses.SLASH_HIT_TICKS`.
     * ⚠ Cleared on a world swap with everything else: `slashing` is a Player
     * field and the Player is reconstructed.
     */
    let slashRepeats = [];
    /**
     * ⛓ R5 slice 7: the FIRE windows still open — `{pressTick, hitTicks}`.
     *
     * A list rather than a single pending value, and the reason is the
     * cadence: `FIRE_PRESS_CADENCE` is 11 and the window ends on T+10, so
     * two windows can never overlap in a LEGAL tape — but an illegal one
     * (a press inside another press's window) is exactly the thing this
     * has to be able to see in order to refuse it.
     */
    const fireWindows = [];
    /** One record per press that FIRED, for the audit ledger. */
    const presses = [];
    /** ⛓ R5 slice 7: one record per rope PULLED — `{id, level, t, flag}`. */
    const ropePulls = [];
    /**
     * ⛓⛓⛓ R5 slice 21: one record per ENEMY KILLED, and it is the only
     * witness a turret kill leaves.
     *
     * ⛔ `IceTurret` writes NO persistence — no `removed()`, no `check()`, no
     * tag — so nothing in the ledger, the flag set or the observation stream
     * says the body died. Every other per-visit family this rung models
     * leaves a trace somewhere else; this one leaves it only here, which is
     * why the record carries the LEDGER ARITHMETIC (how many kill locks the
     * room held and how many the death opened) rather than just the id.
     */
    const turretKills = [];
    /**
     * `Player.useItem(i)`'s switch, over `Inventory.getItem(i)`.
     *
     * Returns the WEAPON a press would be, or null when the press is a
     * silent no-op — which is a real case rather than a defensive one: an
     * item the run does not hold has no slot, and `getItem` on a missing
     * slot returns `undefined`, which the switch does not match.
     */
    const weaponForPress = () => {
        const slots = inventorySlotsFor(inventory);
        const item = slots[primary];
        if (item === undefined) return null;
        // 0 sword / 4 ghostsword -> slashing; 3 spear -> spearing.
        // ⚠ `set slashing` is guarded on `hasSword || hasGhostSword` and
        // `set spearing` on `hasSpear`, but a slot only EXISTS because the
        // item does, so the guard and the slot say the same thing here.
        if (item === 0) return 'sword';
        if (item === 4) return 'ghostsword';
        if (item === 3) return 'spear';
        // ⛓ R5 SLICE 6/7: THE SECOND WEAPON. `useItem`'s fire arm is
        // `firing = true`, which is an AREA and an ANIMATION rather than a
        // directed rect — see `fireVerb.js` for the five-tick window and
        // the eleven-tick cadence, and `applyFire` below for the dispatch.
        if (item === 1) return 'fire';
        // ⛓⛓⛓ R6 SLICE 2: THE WAND ARM, RETIRED FROM ITS REFUSAL.
        //
        // This used to throw *"A WandShot is an entity with its own physics
        // and is not modelled (R6)"*. It is now `wandShot.js`, the
        // thirteenth per-visit family, and `useItem` case 2 is
        // `if (!wanding) wanding = true`.
        //
        // ⚠ CASE 5 IS STILL REFUSED. `useItem`'s fire-wand arm sets BOTH
        // `wanding` and `firing`, which is two verbs on one press and two
        // windows this run would have to open together — and the FireWand
        // is not on this rung's honest path (§2.1). Named rather than
        // folded into the wand arm, because the shot it spawns has a
        // different hitbox, a different damage and a `shotType` that opens
        // a lock this one cannot.
        if (item === 2) return 'wand';
        if (item === 5) {
            throw new Error(`levelRun: the tape presses X with slot ${primary} holding the `
                + 'FIREWAND (item 5). `useItem` case 5 sets `wanding` AND `firing` from '
                + 'one press — two verbs, two windows — and the fire wand is not on this '
                + "rung's honest item chain (R6 §2.1). The plain wand (item 2) is "
                + 'modelled; this is refused rather than approximated by it.');
        }
        throw new Error(`levelRun: the tape presses X with slot ${primary} holding item `
            + `${item}, which no arm of \`useItem\` matches. An unmodelled weapon is `
            + 'refused rather than silently dropped.');
    };
    /** The arms this rung MODELS; see `presses.PRESS_ARM_POLICY` for the rest. */
    const MODELLED_PRESS_ARMS = new Set(
        Object.entries(PRESS_ARM_POLICY)
            .filter(([, p]) => p.policy === 'modelled').map(([as3]) => as3),
    );
    /** ...and the ones that run in the game and change nothing observable. */
    const INERT_PRESS_ARMS = new Set(
        Object.entries(PRESS_ARM_POLICY)
            .filter(([, p]) => p.policy === 'inert').map(([as3]) => as3),
    );

    /**
     * The block's own collision question, which is NOT the player's.
     *
     * `PushableBlockFire`'s ctor does `solids.push("Enemy", "Player")` on
     * top of `Mobile`'s five, so a block collides with two things the player
     * does not — and it excludes ITSELF, which `Entity.collide`'s `e !==
     * this` does for free and this has to do by hand (the live map is keyed
     * by id, so self is marked removed for the duration of its own query).
     *
     * ⛓⛓ R5 SLICE 13: THE NAMED BOUND IS PARTLY CLOSED. `Spinner` is
     * modelled and its live bodies are in this query — that is the whole of
     * §26.3's fix, and it is what cost the shaft its ledger. Every OTHER
     * enemy class is still a push this model allows and the game may refuse,
     * which is why `botDriverV2.runFire` refuses a `moves` press in a room
     * holding one rather than leaving the direction "safe": a wedge is
     * PERMANENT (`hit()` returns on `v.length > 0`), so "the model is
     * optimistic here" is not a graceful degradation.
     */
    const pushableCtx = () => {
        const pushState = pushableStateFor(level);
        const openBridges = openBridgeIdsNow();
        const openActivators = noclip ? null : openActivatorIds(activatorStateFor(level));
        const playerBox = playerBoxAt(state.x, state.y);
        // ⚠ READ AT THE TOP OF THE TICK AND ON PURPOSE. The spinners have
        // ALREADY been stepped when this ctx is built (they update before the
        // blocks — see the step site), so these are this tick's positions,
        // which is exactly what the game's block collides against.
        const spinners = spinnerRectsNow();
        // ⚠ BUILT ONCE PER TICK, NOT PER PROBE. `collides` is called for
        // every 1 px step of every block on both axes, and `liveSolidOpts`
        // rebuilds eight per-visit views — hoisting it is the difference
        // between a hot path and a quadratic one. The one thing that MUST
        // stay per call is `pushables`, which is read live (see below).
        // ⛓ R7 SLICE 4: NORMALISED HERE, once per tick. `normalizeLiveOpts`
        // brands the shape, `{ ...base, pushables }` below keeps the brand
        // and the key order, and `levelWorld`'s own normalise-per-query
        // becomes a single property read on the probe path.
        const base = normalizeLiveOpts(liveSolidOpts({
            beforeTypeFlip: firstTickInWorld, openActivators, openBridges,
        }));
        return {
            collides: (rect, self) => {
                // ⚠ READ LIVE, not off a snapshot taken at the top of the
                // tick. `stepPushables` walks the blocks one at a time and
                // the game's update list does too, so a block that updates
                // LATER must see the earlier one where this tick left it.
                // (No route has two pushables close enough for it to show —
                // L8, L39 and L40 are the only levels with more than one and
                // none is on a route — so this is a bounded vacuity that
                // costs nothing to close.)
                const withoutSelf = pushableRects(pushState);
                withoutSelf.set(self.id, { ...withoutSelf.get(self.id), removed: true });
                const hit = world.collidesSolid(rect, { ...base, pushables: withoutSelf });
                if (hit) return hit;
                // ⛔⛔⛔ THE CELL THAT COST THE SHAFT ITS LEDGER. A
                // `PushableBlock*`'s ctor pushes "Enemy" onto its own solids
                // list, so a spinner standing in the glide corridor STOPS the
                // block — permanently, because a blocked block keeps `v`
                // non-zero and `hit()` returns on `v.length > 0`. Above the
                // player test because the game's `collideTypes` walks
                // "Enemy" before "Player" (`Mobile.solids` order plus the two
                // pushes), and the caller only reads truthiness — the order
                // is transcribed rather than relied on.
                if (spinners) {
                    for (const s of spinners) {
                        if (rectsOverlap(rect, s.rect)) return { tag: 'Enemy', id: s.id, spinner: true };
                    }
                }
                // The player, at the position the PREVIOUS tick left — which
                // is where they are when the block updates, because the
                // block updates first.
                return rectsOverlap(rect, playerBox) ? { tag: 'Player' } : null;
            },
            tileTypeAt: (x, y) => world.nearestWalkableTile(x, y, { openBridges })?.t,
            // The walk family's `input()` reads the PLAYER — the box for its
            // four ±1 px probes and `c.v` for the sign test — and it reads
            // them at the position and velocity the previous tick left,
            // because the block updates first.
            playerBox,
            playerVx: state.vx,
            playerVy: state.vy,
        };
    };

    /**
     * ⛔⛔ R5 SLICE 13: THE SPINNER'S OWN COLLISION QUESTION, which is
     * neither the player's nor the block's.
     *
     * `Mobile.solids` untouched — `["Solid","Tree","Rock","Rope","ShieldBoss"]`
     * — so it reflects off static geometry and off a pushable block (`type =
     * "Solid"`), and passes THROUGH the player and through its siblings.
     *
     * ⚠ `world.collidesSolid` IS THE PLAYER'S LIST, and the two differ by
     * exactly one type: `"LavaBoss"`. Over-approximating would make a
     * spinner reflect off something the game lets it pass, so the difference
     * is ASSERTED AWAY rather than assumed away — `assertSpinnerSolidsBound`
     * fails by name in any room that holds both. (It holds neither today:
     * the four spinner levels are 18, 39, 40 and 92 and the only `lavaboss`
     * in the game is in Dungeon 7.)
     */
    const spinnerCtx = () => {
        const openBridges = openBridgeIdsNow();
        const openActivators = noclip ? null : openActivatorIds(activatorStateFor(level));
        // The blocks where the PREVIOUS tick left them: the spinner updates
        // first, so this is what its sweep reads. (The block then reads the
        // spinner at the position this tick gives it — the two are one tick
        // apart in opposite directions, which is what the update list says.)
        const pushables = pushableRectsNow();
        // ⚠ ONCE PER TICK — see `pushableCtx`'s note. A spinner's sweep is
        // 1 px steps on both axes too, and R7 slice 4's brand means the
        // normalise is paid once per tick with it.
        const base = normalizeLiveOpts(liveSolidOpts({
            beforeTypeFlip: firstTickInWorld, openActivators, openBridges, pushables,
        }));
        return {
            collides: (rect) => world.collidesSolid(rect, base),
            // ⚠ THE ENTITY POINT, not a box centre — they coincide on a
            // spinner and do NOT on a block, whose `input()` probes
            // `x - originX + width/2`. `Enemy.getState()` takes `(x, y)`.
            tileTypeAt: (x, y) => world.nearestWalkableTile(x, y, { openBridges })?.t,
            // `Mobile.mobileUpdate` gates friction/input/moveX/moveY on
            // `Game.freezeObjects`, so a ceremony PARKS a spinner. The
            // terrain switch and `death()` are outside that gate and keep
            // running — see `spinner.js`'s three-way split.
            frozen: ceremony !== null,
        };
    };

    /**
     * ⚠ THE ONE-TICK FENCEPOST ON A CEREMONY'S LAST FRAME, REFUSED RATHER
     * THAN APPROXIMATED.
     *
     * The freeze a ceremony holds is cleared by the temporary NPC's own
     * update, and a run-time `add` is PREPENDED — so on the frame the
     * dialogue completes the NPC runs first and `Game.freezeObjects` is
     * already false when the spinner (and the player) update. This model
     * steps the spinner at the TOP of the tick, before it knows whether the
     * dialogue completes, so its `frozen` flag would be one tick stale on
     * exactly that frame.
     *
     * ⛓ IT CANNOT BITE A PART-COLLECT. A totem part's ceremony has
     * `text: ''` — no NPC, no dialogue, and its 150 frozen frames are DEAD
     * frames the tape's counter skips entirely, so the model never ticks
     * through them and the spinner is parked on both sides by construction.
     * The gap is only reachable by a DIALOGUED pickup in a spinner room, of
     * which there are none. Refusing is a sentence; forking `stepDialogue`
     * into a pure "does this tick finish" predicate would be a second
     * implementation of the rule, which is what this package spends its
     * comments avoiding.
     */
    const assertDialogueFreeSpinnerRoom = () => {
        if (ceremony === null || ceremony.dialogue === null) return;
        throw new Error(`levelRun: level ${level} holds live spinners AND a DIALOGUED `
            + `ceremony (${ceremony.item ?? 'keyType ' + ceremony.keyType}) is running at `
            + `tick ${ticksCompleted}. A spinner is stepped at the top of the tick and the `
            + 'freeze is cleared by the NPC that updates before it, so on the frame the '
            + 'dialogue completes this model would park a spinner the game moves. No '
            + 'route needs this — a totem part collects with `text: \'\'` — so it is '
            + 'refused rather than approximated.');
    };

    /**
     * ⛓⛓⛓ R5 SLICE 15: THE CRUSHER'S OWN COLLISION QUESTION — and it is
     * NARROWER than the player's and narrower than the spinner's.
     *
     * ```
     *   Player   ["Solid","Tree","Rock","Rope","ShieldBoss"] + "LavaBoss"
     *   Spinner  ["Solid","Tree","Rock","Rope","ShieldBoss"]   (Mobile's, untouched)
     *   Crusher  ["Solid"]                                     (Crusher.as:22)
     * ```
     *
     * and its SIGHT test is `collideLine("Solid", …)`, the same one type. So
     * a Tree neither shields it nor stops its charge. `solidBoxesForMover`
     * is the filtered list and `assertCrusherSolidsBound` is what keeps the
     * "nothing is dropped in L41 or L42" half a measurement.
     *
     * ⚠ THE SAME LIST SERVES BOTH HALVES OF THE TICK, deliberately: the
     * sight line and `moveX`/`moveY` read the identical `"Solid"` type in
     * the game, and building them separately is how two views of one fact
     * drift.
     */
    const crusherCtx = (self, opts) => {
        const boxes = world.solidBoxesForMover(opts, self.id);
        return {
            // ⚠ `collideTypes(solids, …)` EXCLUDES `this` (`Entity.collide`'s
            // `e !== this`), so the charge stopper and the sight list are the
            // same list with the same exclusion — and another crusher is in
            // BOTH. In L42 that is load-bearing in two directions at once:
            // each of the two shields the other's sight line, and each is a
            // wall the other's charge stops against.
            solids: (rect) => boxes.find((b) => rectsOverlap(rect, b)) ?? null,
            lineSolids: boxes,
            // ⛔⛔ THE TWO SHAPES OF ONE PLAYER, and they are 2 px apart.
            // `collideRect("Player", …)` tests the BOX; `collideLine(…, p.x,
            // p.y)` takes the ENTITY POINT. §28.8's probe folded them into
            // one argument and got a chimera; `scanCrusher` refuses that now.
            playerBox: playerBoxAt(state.x, state.y),
            playerPoint: { x: state.x, y: state.y },
        };
    };
    /**
     * ⚠ THE BOUND `crusherCtx` LEANS ON, CHECKED RATHER THAN CLAIMED — the
     * `assertSpinnerSolidsBound` shape, one mover over and with more to say.
     *
     * Two ways the model could be reading a world the game does not have:
     * a solid whose AS3 type is not `"Solid"` (dropped correctly, but the
     * drop should be VISIBLE the first time it happens on a route), and a
     * PIXELMASK, which `collideLineSolid` cannot sample at all.
     */
    const assertCrusherSolidsBound = (n) => {
        const w = worldFor(n);
        if ((w.crushers ?? []).length === 0) return;
        const masks = w.pixelmasks ?? [];
        if (masks.length > 0) {
            throw new Error(`levelRun: level ${n} holds ${w.crushers.length} crusher(s) AND `
                + `${masks.length} pixelmask collider(s). A crusher's sight line is `
                + '`collideLine("Solid", …)`, a 1 px raycast of POINTS, and '
                + '`collideLineSolid` walks BOXES — so a Building or a CliffSide would '
                + 'shield it in the model over its whole bounding rect and in the game '
                + 'only over its opaque pixels. Give the raycast a mask sampler before '
                + 'routing here.');
        }
    };
    /**
     * ⚠ THE BOUND `spinnerCtx` LEANS ON, CHECKED RATHER THAN CLAIMED.
     *
     * Called once per level entry, not per tick: the rosters are static.
     */
    const assertSpinnerSolidsBound = (n) => {
        const w = worldFor(n);
        if ((w.spinners ?? []).length === 0) return;
        const lavaBoss = (w.solids ?? []).filter((s) => s.cls?.type === 'LavaBoss');
        if (lavaBoss.length > 0) {
            throw new Error(`levelRun: level ${n} holds ${w.spinners.length} spinner(s) AND `
                + `${lavaBoss.length} LavaBoss solid(s). \`spinnerCtx\` reuses `
                + '`collidesSolid`, which is the PLAYER\'s solids list — `Mobile.solids` '
                + 'plus "LavaBoss" (`Player.as:377`) — and a spinner\'s list does NOT '
                + 'carry it. The model would reflect the spinner off something the game '
                + 'lets it pass through. Give `collidesSolid` a mover before routing here.');
        }
    };

    /**
     * The on-screen policy (§3.3), asserted from the RUN's own state.
     *
     * A `Tile`'s `render()` early-returns off screen, so the opening timer
     * simply STOPS — a leg that wanders away from a bridge it opened is not
     * slow, it is stuck. The model does not grow a camera; it holds the
     * player to a conservative 64 px radius for the whole window and fails
     * by name if the run leaves it.
     *
     * ⚠ AND THAT POLICY IS ALSO WHAT MAKES `walkableAt` EXACT. Inside the
     * radius every tick is a rendered frame, so "sixty on-screen frames" and
     * "sixty ticks" are the same number — which is the number the probe
     * measured (`bridges.TICKS_FROM_PRESS_TO_WALKABLE`).
     */
    const assertBridgeWindows = ({ frozen = false } = {}) => {
        const bridges = bridgeStateFor(level);
        for (const [id, b] of bridges) {
            if (ticksCompleted >= b.walkableAt) continue;
            if (frozen) {
                throw new BridgeError(`levelRun: the run is FROZEN at tick `
                    + `${ticksCompleted} while bridge ${id} in level ${level} is opening `
                    + `(pressed at ${b.pressTick}, walkable at ${b.walkableAt}). `
                    + '`Tile.render` runs on frozen frames and this model counts TICKS, '
                    + 'so the game would open the bridge EARLIER than the model says. '
                    + 'Move the ceremony out of the opening window.');
            }
            if (!withinOnScreenRadius(state.x, state.y, b.centre)) {
                throw new BridgeError(`levelRun: at tick ${ticksCompleted} the player is `
                    + `at (${state.x}, ${state.y}), more than 64 px from bridge ${id}'s `
                    + `centre (${b.centre.x}, ${b.centre.y}) in level ${level}, and the `
                    + `bridge is still opening (walkable at ${b.walkableAt}). `
                    + '`Tile.render` early-returns off screen, so the opening STOPS. '
                    + 'Keep the leg near the bridge, or re-plan it.');
            }
        }
    };

    /**
     * `spear()` / `slash()`: collide the rect, then `genericHit` everything
     * in it.
     *
     * ⚠ THE UNINTENDED RESPONDERS ARE AS REAL AS THE INTENDED ONE. One
     * thrust can decrement a bridge, push a block, toggle a lightpole and
     * hit three enemies, and the audit is what turns the ones this rung does
     * not model into a synthesis-time failure instead of a divergence two
     * thousand ticks later. `intended` is deliberately NOT passed here: the
     * run does not know what a leg meant, so it applies the arms it models
     * and refuses everything else. The leg's own intent check lives with the
     * leg (`presses.auditPress`).
     */
    /**
     * ── ⛓⛓ THE FIRE PRESS (R5 slice 7) ────────────────────────────────
     *
     * Not a variant of `applyThrust`. The differences are all four of the
     * things that make a press a press:
     *
     *   WHEN   a slash fires ONE rect on the tick after the press; a fire
     *          fires on FIVE ticks, `FIRE_WINDOW.hitTicks` (T+4..T+8), and
     *          the animation is the only clock (`FIRE_PRESS_CADENCE` 11).
     *   WHERE  a 32x32 area CENTRED on the player, not a directed rect —
     *          so `direction` is not read at all and a fire press needs no
     *          facing, no face nudge and no stance grammar.
     *   WHAT   `t = "Fire"`, which is a DIFFERENT dispatch table
     *          (`FIRE_ARM_POLICY`): a bridge and a lightpole become inert
     *          and a `PushableBlockFire` becomes the only thing that moves.
     *   HOW MANY  the nested `for each` gives a `"Solid"` five dispatches
     *          per tick — 25 across the window — and it is the reason the
     *          knockback arithmetic is what it is. For a BLOCK it does not
     *          matter: `hit()` returns immediately while `v.length > 0`, so
     *          dispatches 2..25 land on a block that is already moving.
     *
     * ⛔ AND THE PRESS HAS NO AIM. Every block the rect and the 16 px
     * radius admit is pushed, each `atan2`-directed away from the player.
     * That is the finding that overturned §19.8's choreography, and it is
     * why this applies the audit's whole `modelled` list rather than one
     * intended target.
     */
    const applyFire = (fire) => {
        const { pressTick } = fire;
        const player = { x: state.x, y: state.y };
        const pushState = pushableStateFor(level);
        const audit = auditFire(world, player, { pushables: pushableRects(pushState) });
        if (audit.refused.length > 0) {
            throw new Error(`levelRun: the fire press at tick ${pressTick} in level `
                + `${level} reaches `
                + `${audit.refused.map((r) => `${r.tag}@${r.x},${r.y}`).join(', ')}, whose `
                + '`genericHit` arm under `t == "Fire"` this rung REFUSES '
                + `(${audit.refused.map((r) => FIRE_ARM_POLICY[r.as3]?.why
                    ?? 'no FIRE_ARM_POLICY entry at all').join('; ')}). Fire has no aim — `
                + 'the rect is 32x32 around the player — so the only fix is a different '
                + 'STANCE, or the arm.');
        }
        const hits = [];
        for (const r of audit.modelled) {
            if (r.as3 === 'PushableBlockFire') {
                const id = r.pushableId;
                const block = pushState.byId.get(id);
                if (!block) {
                    throw new Error(`levelRun: the fire press at tick ${pressTick} reaches `
                        + `${id} in level ${level}, which is not in the run's pushable `
                        + 'state.');
                }
                // ⚠ `hit()`'s FIRST LINE is `if (v.length > 0) return`, so a
                // block already gliding ignores every later dispatch — which
                // is what makes a five-tick window with five dispatches each
                // land exactly one push. Modelled by the pushable state
                // rather than by counting: `hitPushableFromPoint` returns
                // `moved: false` for a block with velocity.
                const { block: after, moved, why } = hitPushableFromPoint(block, player);
                pushState.byId.set(id, after);
                hits.push({ as3: 'PushableBlockFire', id, moved, why });
                continue;
            }
            if (r.as3 === 'IceTurret') {
                // ── ⛓⛓⛓ R5 SLICE 20: THE BUMP, THE TENTH FAMILY ───────
                //
                // `Player.genericHit`'s ONE class special case:
                //     if (e is IceTurret) (e as IceTurret).bump(new Point(x, y), t);
                //     (e as Enemy).hit(f, new Point(x, y), d, t);
                // — the bump FIRST, then the hit, which for fire is inert
                // by `Enemy.hit`'s `if (hitByFire || t != "Fire")`.
                //
                // ⛔ AND IT RUNS ON EVERY DISPATCH OF EVERY HIT TICK, which
                // is the whole of §33.5's correction: five bumps on five
                // consecutive ticks is why the rest cycle's PARITY stops
                // mattering. Nothing here counts dispatches — `bump` is
                // idempotent within a tick (it writes a target derived from
                // the body's own position), so applying it once per hit
                // tick is the same program.
                const st = turretStateFor(level);
                const t = st.get(r.id);
                if (!t) {
                    throw new Error(`levelRun: the fire press at tick ${pressTick} reaches `
                        + `${r.tag}@${r.x},${r.y} in level ${level}, which is not in the `
                        + "run's turret state.");
                }
                const res = bumpIceTurret(t, player, 'Fire');
                hits.push({ as3: 'IceTurret', id: t.id, moved: res.applied, why: res.why });
                continue;
            }
            if (r.as3 === 'BurnableTree') {
                // ── ⛓⛓ R5 SLICE 12: THE BURN, THE EIGHTH FAMILY ───────
                //
                // ⛔ `hit()` REMOVES NOTHING. Its whole body is
                // `if (t == "Fire" && !burn) { playSound; burn = true;
                // play("burn") }` — so the 2x2 solid is still there, and
                // stays there for the forty-one ticks the animation takes
                // (`15 * 0.0333` is 0.4995, so twenty frames is not forty
                // updates). `burnEnd -> die()` is what opens the cell.
                //
                // ⛔ AND THE PERSISTENCE WRITE IS IN `removed()`, at anim
                // end — the OPPOSITE of `FallRock.fall()`, which writes on
                // the trigger frame. So it is banked at `goneAt` rather
                // than here, and `burnWrites` is what cashes it.
                const id = r.treeId ?? `${r.tag}@${r.x},${r.y}`;
                const tree = (world.burnableTrees ?? []).find((t) => t.id === id);
                if (!tree) {
                    throw new Error(`levelRun: the fire press at tick ${pressTick} reaches `
                        + `${id} in level ${level}, which is not in the world's burnable `
                        + 'trees. Either `check()` already removed it at build time (a '
                        + 'cleared tag builds the room WITHOUT the tree) or the press '
                        + 'census and the geometry disagree — and those are different '
                        + 'bugs, so this does not guess.');
                }
                const { started, goneAt, why } = burnTree(burnStateFor(level), tree,
                    ticksCompleted);
                if (started) {
                    // ⛔ THE FLAG IS BANKED HERE AND ITS TIMESTAMP IS
                    // `goneAt`. `removed()` is what calls
                    // `Game.setPersistence(tag, false)`, so the write lands
                    // forty-one ticks after this line — and a SET has no
                    // timestamps (§24.7's finding, on the rock's twin). The
                    // ledger entry goes in now, because a run that ends
                    // mid-burn still owes it; the TICK is carried on
                    // `treeBurns` so a claim about WHEN the room changed
                    // has something to assert against.
                    const tag = tree.tag ?? -1;
                    const flag = tag < 0
                        ? outOfBandFlagForWriter({ as3: 'BurnableTree', level, tag })
                        : outOfBandFlagFor(level, tag);
                    rockFlags.set(ledgerKey(flag), { ...flag, id, level, by: 'burnabletree' });
                    treeBurns.push({ id, level, t: ticksCompleted, goneAt, flag });
                }
                hits.push({ as3: 'BurnableTree', id, burned: started, goneAt, why });
                continue;
            }
            if (r.as3 === 'RopeStart') {
                // ⛓ THE SEVENTH PRESS ARM, BUILT. `Player.as:1093-1095` is
                // `(e as RopeStart).hit()` with no `t` at all, so fire pulls
                // a rope exactly as a sword does — and the route needs it,
                // because `rope@96,384` is 112 px of wall across the only
                // shaft out of L39's arrival corridor (56 cells without it,
                // 688 with).
                // ⚠ `r.id`, NOT `${r.tag}@${r.x},${r.y}`. `fireRespondersIn`
                // rewrites `x`/`y` to the ENTITY position the radius cut
                // needs (a rope's is its hitbox centre, 8 px in on both
                // axes), and the id every other consumer keys on is the
                // OEL one. Rebuilding it from the rewritten fields gave
                // `rope@104,392` — a key nothing else in the run shares.
                const id = r.id;
                const pulled = ropeStateFor(level);
                if (pulled.has(id)) {
                    // `hit()`'s whole body is `if (!activate)`, so a second
                    // press is a real no-op rather than a second write.
                    hits.push({ as3: 'RopeStart', id, pulled: false, why: 'already pulled' });
                    continue;
                }
                pulled.add(id);
                // `Game.setPersistence(tag, false)` — an EARNED CLEAR, and
                // the tag can be -1, in which case it lands in another level
                // through the out-of-band family.
                const tag = r.persistTag ?? -1;
                const flag = tag < 0
                    ? outOfBandFlagForWriter({ as3: 'RopeStart', level, tag })
                    : outOfBandFlagFor(level, tag);
                if (!pendingEarnedClears.has(flag.level)) {
                    pendingEarnedClears.set(flag.level, new Set());
                }
                pendingEarnedClears.get(flag.level).add(flag.tag);
                ropePulls.push({ id, level, t: ticksCompleted, flag });
                // ── ⛓⛓ R5 SLICE 10: AND THE PULL PUBLISHES TO ITS GROUP ──
                //
                // `RopeStart.set activate` (`:79-91`) walks every
                // `Activators` sharing `t` and assigns the flag on. Four
                // slices of audit read that as "the pulser arms, and the
                // fallrock is a no-op"; the game's ledger said {39,10} and
                // this is the line that was missing.
                //
                // ⚠ IT GOES IN `latched`, which is where a `room = -1`
                // ButtonRoom's publish already goes — same shape (no
                // republication can ever clear it), so the consumers
                // (`stepActivators`, `stepPulsersNow`) need no second map.
                // ⚠ `r.t` IS THE WEAPON TYPE ("Fire") ON A PRESS RESPONDER,
                // not the activator group — the two fields are both called
                // `t` and mean different things. The group comes off the
                // SOLID, keyed on the same `ropeId` the geometry query uses.
                const ropeSolid = world.solids.find((s) => s.ropeId === id);
                const pub = ropePublish({ as3: 'RopeStart', t: ropeSolid?.ropeT ?? -1 });
                if (pub) {
                    activatorStateFor(level).latched.set(pub.group, pub.value);
                    // …and the members whose own `set activate` DOES
                    // something the latch alone cannot express.
                    const rocks = fallRockStateFor(level);
                    for (const [rid, rock] of rocks) {
                        if (rock.t !== pub.group || rock.landed) continue;
                        const dropped = dropRock(rock, rid);
                        if (!dropped.fell) continue;
                        rocks.set(rid, dropped.state);
                        // `fall()`'s FIRST line is the persistence write, at
                        // TRIGGER time — 197 frames before the landing. The
                        // run banks it as an earned clear like any other.
                        if (dropped.write) {
                            const rf = outOfBandFlagFor(level, dropped.write.tag);
                            if (!pendingEarnedClears.has(rf.level)) {
                                pendingEarnedClears.set(rf.level, new Set());
                            }
                            pendingEarnedClears.get(rf.level).add(rf.tag);
                        }
                        // ⛔ AND THE SNAP, IF THE PULL WAS MADE STANDING IN
                        // THE ROCK'S CELL. There is no deferring it by a tick
                        // the way a ShieldLock's is deferred: the whole span
                        // is frozen, so the game's LAST snap of the span is
                        // the position the next live tick starts from.
                        // ⛔⛔ AND THE FREEZE ADVANCES EVERY PULSER, because a
                        // `Pulser` is an `Activators` and NOT a `Mobile`:
                        // `Mobile.mobileUpdate`'s `if (!Game.freezeObjects)`
                        // guard is the one thing a frozen frame skips, and a
                        // Pulser has no part of it. So its cycle runs for the
                        // whole span while the tape's tick index does not —
                        // and a model that stepped it once per TAPE tick puts
                        // its ring `frames` out of phase, permanently.
                        //
                        // ⚠ 197 mod 51 = 44, so this is not a small error and
                        // it is not a rounding one. Same family as
                        // `Game.time`'s (`fallRock.TIME_COUPLED`); different
                        // clock, and this one the model owns.
                        const pst = pulserStateFor(level);
                        for (const [pid, p] of pst) {
                            if (p.t !== pub.group) continue;
                            // ⛓ NOTHING MOVES DURING THE SPAN, and the hit
                            // test is a FIXED 22 px ring (`radiusHit`, not
                            // the growing radius) — so ONE clearance check
                            // covers all 197 frames rather than 197 of them.
                            const frozen = [
                                ...[...pushableRects(pushableStateFor(level))]
                                    .filter(([, r]) => !r.removed)
                                    .map(([bid, r]) => ({
                                        id: bid, type: 'Solid', as3: 'PushableBlockFire',
                                        x: r.rect.x + 8, y: r.rect.y + 8,
                                        originX: 8, originY: 8, w: 16, h: 16,
                                    })),
                                {
                                    id: 'player', type: 'Player', as3: 'Player',
                                    x: state.x, y: state.y,
                                    originX: 2, originY: 2, w: 4, h: 5,
                                },
                            ];
                            const reached = pulseReaches(p, frozen)
                                .filter((c) => !(c.arm === 'player' && noDamage));
                            if (reached.length > 0) {
                                throw new Error(`levelRun: ${pid}'s ring reaches `
                                    + `[${reached.map((c) => c.id).join(', ')}] during the `
                                    + `${dropped.frames}-frame freeze ${rid} holds. Nothing `
                                    + 'can move out of it — the whole span is frozen — so '
                                    + 'this rung refuses the stance rather than modelling '
                                    + 'a pulse chain nobody can observe.');
                            }
                            let s = p;
                            for (let i = 0; i < dropped.frames; i += 1) {
                                s = stepPulser(s, true).state;
                            }
                            pst.set(pid, s);
                        }
                        if (dropped.snapY !== null) {
                            throw new Error(`levelRun: ${rid} landed on the player at tick `
                                + `${ticksCompleted} in level ${level} and wrote y = `
                                + `${dropped.snapY}. \`FallRock.update\` snaps an `
                                + 'overlapping player to the rock\'s top on every tick of '
                                + 'a span the player cannot move during, and this rung '
                                + 'does not model a route that pulls a rope while standing '
                                + 'where the rock lands. Move the stance.');
                        }
                    }
                }
                hits.push({ as3: 'RopeStart', id, pulled: true, why: null });
                continue;
            }
            throw new Error(`levelRun: \`FIRE_ARM_POLICY\` calls ${r.as3} modelled and `
                + 'this dispatch has no arm for it. A policy and an executor that '
                + 'disagree is the two-consumers failure, so this throws rather than '
                + 'silently skipping.');
        }
        presses.push({
            t: pressTick, fired: ticksCompleted, level, weapon: 'fire',
            // The 32x32 area itself, so the press ledger records WHERE the
            // rect was rather than a field no responder carries.
            direction: null, rect: fireRect(player.x, player.y), hits,
        });
    };

    const applyThrust = (thrust) => {
        const { weapon, direction, pressTick } = thrust;
        const rect = weapon === 'sword'
            ? slashRect(state.x, state.y, direction)
            : spearRect(state.x, state.y, direction);
        // A ghostsword routes a SLASH through the Spear branch of
        // `genericHit` — R5, and refused rather than approximated.
        if (weapon === 'ghostsword') {
            throw new Error('levelRun: a ghostsword press routes the slash rect through '
                + "`genericHit`'s Spear arm and doubles the rect's height from the "
                + 'sprite WIDTH. Neither is modelled (R5).');
        }
        const pushState = pushableStateFor(level);
        const audit = auditPress(world, rect, {
            weapon: weapon === 'spear' ? 'spear' : 'sword',
            // The block's LIVE rect: a chain's second push aims at where the
            // first one left it.
            pushables: pushableRects(pushState),
            // ⛓⛓ R5 SLICE 21: and the turret's, for the SAME reason plus one
            // more — a corpse has a different SIZE as well as a different
            // position (`death()`'s `setHitbox(16,16,8,8)`), so an audit
            // against the census box would aim at a 32x32 body that no longer
            // exists.
            turrets: turretRectsNow(),
            // ⛓⛓⛓ R6 SLICE 5: and the Shieldspire's, which does not move
            // and does not shrink — it VANISHES. `Player.slash` collects
            // with `collideRectInto`, which walks the world's type lists,
            // so a body `FP.world.remove` has drained is not a candidate at
            // all and an audit against the census box would report a hit on
            // an entity that is gone.
            shieldBosses: shieldBossRectsNow(),
            // ⛓⛓⛓ R6 SLICE 6f: and the Owl's, which is the only one of the
            // four that moves BETWEEN the five hit tests of a single press —
            // and therefore the only one where the join decides how many of
            // them land at all.
            finalBosses: finalBossRectsNow(),
        });
        const refused = audit.live.filter(
            (r) => !MODELLED_PRESS_ARMS.has(r.as3) && !INERT_PRESS_ARMS.has(r.as3),
        );
        if (refused.length > 0) {
            throw new Error(`levelRun: the ${weapon} press at tick ${pressTick} in level `
                + `${level} reaches ${refused.map((r) => `${r.tag}@${r.x},${r.y}`).join(', ')}`
                + `, whose \`genericHit\` arm this rung REFUSES `
                + `(${refused.map((r) => PRESS_ARM_POLICY[r.as3].why).join('; ')}). A stray `
                + 'responder is a route change, a ledger entry or a death — never a '
                + 'no-op. Re-aim the press, or model the arm.');
        }
        const bridges = bridgeStateFor(level);
        const hits = [];
        for (const r of audit.live) {
            if (r.as3 === 'Tile') {
                const id = `${r.tile.tx},${r.tile.ty}`;
                // ⚠ NO ALREADY-OPEN GUARD in `genericHit`'s Tile arm: a
                // second press on an open bridge drives the timer negative
                // and the `<= 0` arm keeps it open. Recorded rather than
                // clamped, because a double press is something the executor
                // should be reporting.
                if (!bridges.has(id)) {
                    bridges.set(id, {
                        pressTick,
                        walkableAt: pressTick + TICKS_FROM_PRESS_TO_WALKABLE,
                        centre: { x: r.x, y: r.y },
                    });
                }
                hits.push({ as3: 'Tile', id });
            } else if (r.as3 === 'PushableBlockSpear') {
                // ⚠ `pushableId`, not `tag@x,y`: `x`/`y` are the SPAWN
                // coordinates the census carries and the id is keyed on
                // them, but a caller that rebuilt the key from a live rect
                // would miss on every push after the first.
                const id = r.pushableId;
                const block = pushState.byId.get(id);
                if (!block) {
                    throw new Error(`levelRun: the press at tick ${pressTick} reaches `
                        + `${id} in level ${level}, which is not in the run's pushable `
                        + 'state. The world and the run disagree about which blocks '
                        + 'exist, which is the two-consumers failure this state family '
                        + 'exists to prevent.');
                }
                const { block: after, moved, why } = hitPushable(block, direction);
                pushState.byId.set(id, after);
                hits.push({ as3: 'PushableBlockSpear', id, moved, why });
            } else if (r.as3 === 'BreakableRock') {
                // ── R5 slice 5: the rock ──────────────────────────────
                // `hit(_t)` is `if (rockType <= _t) play("break")` and
                // `Player.as:1071-1074` passes `hasGhostSword ? 1 : 0`. A
                // press that reaches a rock the weapon cannot break is a
                // real no-op in the game, so it is one here — recorded,
                // because "the swing hit nothing" is a leg defect the
                // fixture author needs to see rather than a silent pass.
                const id = r.rockId ?? `${r.tag}@${r.x},${r.y}`;
                const rock = world.solids.find((s) => s.rockId === id);
                if (!rock) {
                    throw new Error(`levelRun: the press at tick ${pressTick} reaches `
                        + `${id} in level ${level}, which is not in the world's solids. `
                        + 'The press census and the geometry disagree about which rocks '
                        + 'exist, which is the two-consumers failure this state family '
                        + 'exists to prevent.');
                }
                if (!rockBreaksUnder(rock.rockType, inventory)) {
                    hits.push({
                        as3: 'BreakableRock', id, broke: false,
                        why: `rockType ${rock.rockType} > `
                            + `${inventory?.hasGhostSword ? 1 : 0} — this weapon cannot `
                            + 'break it',
                    });
                    continue;
                }
                const st = rockStateFor(level);
                const { started, goneAt } = hitRock(st, rock, ticksCompleted);
                // ⚠ `endAnim` writes `Game.setPersistence(tag, false)`
                // UNCONDITIONALLY — its `check()` guard (`tag >= 0 && ...`)
                // does not apply — so a `tag = -1` rock clears a flag in
                // ANOTHER LEVEL. Since slice 5 step 0 the resolution goes
                // through `outOfBandFlagForWriter`, which carries the
                // FAMILY (`Fire`, `BreakableRock`, `DarkSword`) and refuses
                // a class nobody has classified; the ledger has to name the
                // entry or the walk reports a clear nobody can attribute.
                // An in-band rock keeps the plain arithmetic: the family
                // helper is for the -1 sentinel only, and says so.
                if (started) {
                    const tag = rock.persistTag ?? -1;
                    const flag = tag < 0
                        ? outOfBandFlagForWriter({ as3: 'BreakableRock', level, tag })
                        : outOfBandFlagFor(level, tag);
                    rockFlags.set(ledgerKey(flag), { ...flag, id, level });
                }
                hits.push({
                    as3: 'BreakableRock', id, broke: started, goneAt,
                    // A second swing does NOT restart the animation:
                    // `Spritemap.play` early-returns for the anim already
                    // playing. Recorded so a double press reads as the
                    // no-op it is rather than as a shorter break.
                    why: started ? null : 'already breaking — `play("break")` early-returns',
                });
            } else if (r.as3 === 'LightPole') {
                const id = `${r.tag}@${r.x},${r.y}`;
                const pole = poleStateFor(level).get(id);
                if (pole.hitsTimer > 0) {
                    hits.push({ as3: 'LightPole', id, moved: false, why: 'hitsTimer > 0' });
                    continue;
                }
                pole.activate = !pole.activate;
                pole.hitsTimer = LIGHTPOLE_HITS_TIMER_MAX;
                // `set activate` — `Game.setPersistence(tag, !activate)`.
                if (pole.persistTag >= 0) {
                    poleFlags.set(poleKey(level, pole.persistTag), !pole.activate);
                }
                hits.push({
                    as3: 'LightPole', id, moved: true, why: null,
                    activate: pole.activate, persistTag: pole.persistTag,
                });
            } else if (r.as3 === 'IceTurret') {
                /**
                 * ── ⛓⛓⛓ R5 SLICE 21: THE KILL, AND IT IS TWO CALLS ─────
                 *
                 * `Player.genericHit`'s one class special case, in the
                 * game's own order:
                 *
                 *     if (e is IceTurret) (e as IceTurret).bump(new Point(x, y), t);
                 *     (e as Enemy).hit(f, new Point(x, y), d, t);
                 *
                 * ⛔ BOTH RUN FOR EVERY WEAPON, and each refuses the other's.
                 * `bump` is gated on `["Fire","Pulse"]`, so a SWORD press
                 * reaches it and moves nothing; `Enemy.hit` is gated on
                 * `hitByFire || t != "Fire"`, so a FIRE press reaches it and
                 * damages nothing. Modelling one arm and skipping the other
                 * would be right for exactly one weapon.
                 *
                 * ⚠ AND `applyFire` HAS ITS OWN COPY OF THE BUMP HALF. This
                 * is not a duplicate of it: that dispatch runs five times per
                 * press (`FIRE_WINDOW.hitTicks`) and never damages, this one
                 * runs once and never pushes. The shared thing is the
                 * TRANSCRIPTION in `iceTurret.js`, which is where it belongs.
                 */
                const st = turretStateFor(level);
                const t = st.get(r.turretId);
                if (!t) {
                    throw new Error(`levelRun: the ${weapon} press at tick ${pressTick} `
                        + `reaches ${r.turretId} in level ${level}, which is not in the `
                        + "run's turret state. The press census and the run disagree "
                        + 'about which turrets exist, which is the two-consumers failure '
                        + 'this state family exists to prevent.');
                }
                const type = weapon === 'spear' ? 'Spear' : 'Sword';
                // ⛓ `bump` FIRST, and it is a real no-op for a sword — kept
                // because the ORDER is the transcription and a later weapon
                // (Pulse) makes it matter.
                const bumped = bumpIceTurret(t, { x: state.x, y: state.y }, type);
                const before = { hits: t.hits, dead: t.dead };
                const verdict = hitIceTurret(t, {
                    d: weapon === 'spear' ? SPEAR_DAMAGE
                        : (inventory?.hasDarkSword ? DARK_SWORD_DAMAGE : SWORD_DAMAGE),
                    // `Player.as:116` — `swordForce = 5`. ⚠ It reaches
                    // `knockback`, which `IceTurret` overrides EMPTY, so this
                    // value is never used by this class; passed anyway because
                    // `Enemy.hit` clamps it against `maxForce` and a model
                    // that dropped the argument would be wrong for the first
                    // class that reads it.
                    f: SWORD_FORCE,
                    t: type,
                    // ⛔ `Enemy.hit` carries `!Game.freezeObjects` INSIDE its
                    // own gate, so a press during a ceremony damages nothing
                    // — while the i-frame it is waiting on keeps running
                    // down. The two halves of "frozen" go opposite ways.
                    frozen: ceremony !== null,
                });
                if (verdict.killed) {
                    /**
                     * ⛔⛔⛔ THE LEDGER CONSEQUENCE, COMPUTED — NOT SKIPPED.
                     *
                     * The R4 refusal this slice lifts was a claim about what
                     * a death COSTS: it moves `totalEnemies()`, which opens
                     * every `tset == -1` lock in the room. For this class the
                     * answer is nil twice over — `death()` intercepts the
                     * removal so `classCount` never moves, AND the room has
                     * no kill lock — and the machinery runs the scan for both
                     * because "there were no kill locks" and "nobody looked"
                     * print the same thing.
                     */
                    const census = world.combat?.enemies ?? null;
                    const roster = (census ?? [])
                        .filter((e) => !e.removed)
                        .map((e) => ({ as3: e.as3 }));
                    const led = killLockLedger(levelSource(level), {
                        bodiesBefore: roster,
                        // ⛓ THE CORPSE IS STILL IN THE ROSTER, which is the
                        // whole finding: `death()` consumed the destroy, so
                        // the body was never removed and the count is the
                        // same list.
                        bodiesAfter: roster,
                    });
                    /**
                     * ⛔⛔⛔ AN ABSENT CENSUS IS A REFUSAL, NOT A PASS — and
                     * this is the one question where it would have passed
                     * QUIETLY AND WRONGLY.
                     *
                     * With no `combat` role the roster is EMPTY, so
                     * `totalEnemies()` reads 0 both sides and
                     * `checkEnemies`' `== 0` was ALREADY satisfied — which
                     * `killLockLedger` correctly reports as "this death
                     * opened nothing" and which is, for a room that really
                     * holds enemies, a nil computed from a fiction. The scan
                     * of the ROOM is sound either way (it reads the level
                     * record), so the refusal is scoped to the case where the
                     * count is load-bearing: a room WITH a kill lock.
                     * [[feedback_silent_watcher_vacuous_negative]], and it is
                     * the same lesson `runFire`'s bump arm banked one slice
                     * ago about the same census.
                     */
                    if (led.locks.length > 0 && census === null) {
                        throw new Error(`levelRun: the kill of ${r.turretId} in level `
                            + `${level} happens in a room with ${led.locks.length} `
                            + '`tset == -1` lock(s), and the world was built with NO '
                            + 'COMBAT CENSUS — so `totalEnemies()` reads 0 because nothing '
                            + 'was ASKED, not because the room is empty, and "the lock did '
                            + 'not open" would be a nil computed from a fiction. Build the '
                            + 'world with the `combat` role.');
                    }
                    if (!led.nil) {
                        throw new Error(`levelRun: the kill of ${r.turretId} at tick `
                            + `${pressTick} OPENS ${led.opens.length} kill lock(s) in `
                            + `level ${level} (${led.why}) — a blocker the walk did not `
                            + 'earn and this rung does not model. `KILL_ARM_POLICY` lifted '
                            + 'IceTurret because its death moves NOTHING; a room where it '
                            + 'does is a room this arm has no verdict for.');
                    }
                    turretKills.push({
                        t: ticksCompleted, level, id: t.id, weapon,
                        killLocks: led.locks.length,
                        killLocksOpened: led.opens.length,
                        // ⚠ `null`, NOT 0, WHEN NOBODY ASKED. An empty roster
                        // and an empty room print the same number, and this
                        // record is the walk's only witness that the kill
                        // happened at all — so it says which one it is.
                        totalEnemies: census === null ? null : led.totalAfter,
                        censusAsked: census !== null,
                        // ⛓ `IceTurret` has no `removed()`, no `check()` and
                        // no tag, so this is the only witness the kill leaves.
                        writes: null,
                    });
                }
                hits.push({
                    as3: 'IceTurret',
                    id: t.id,
                    landed: verdict.landed,
                    killed: verdict.killed,
                    why: verdict.refusedAt,
                    hits: t.hits,
                    was: before,
                    // ⚠ Recorded even though it is always false for a sword:
                    // a silent `bump` is the half of the dispatch a reader
                    // would otherwise have to take on trust.
                    bumped: bumped.applied,
                    bumpWhy: bumped.why ?? null,
                });
            } else if (r.as3 === 'ShieldBoss') {
                /**
                 * ── ⛓⛓⛓ R6 SLICE 5: THE SWING AT THE SHIELDSPIRE ───────
                 *
                 * ⛔ AND IT IS THE `e is Enemy` ARM, NOT THE ONE WITH HIS
                 * NAME ON IT. `Player.genericHit` opens with `if (e is
                 * Enemy)` and `ShieldBoss extends Enemy`, so the `else if
                 * (e is ShieldBoss)` five arms below is DEAD CODE. The live
                 * call is `hit(swordForce 5, new Point(x, y), swordDamage,
                 * "Sword")` and `ShieldBoss.hit`'s override is what
                 * receives it.
                 *
                 * ⛔⛔ THE RECT IS NOT THE HIT TEST. `Player.slash` applies
                 * TWO filters the press census does not: a 16 px
                 * `FP.distanceRectPoint` gate and a `collideLine("Solid")`
                 * line of sight (waived for `type == "Solid"` — which this
                 * body is NOT; its type is `"ShieldBoss"`). Both are
                 * applied here, on the LIVE rect, because a swing from
                 * across the arena would otherwise land a hit the game
                 * refuses and the whole schedule is counted in hits.
                 */
                const st = shieldBossStateFor(level);
                const b = st.get(r.shieldBossId);
                if (!b) {
                    throw new Error(`levelRun: the ${weapon} press at tick ${pressTick} `
                        + `reaches ${r.shieldBossId} in level ${level}, which is not in `
                        + "the run's ShieldBoss state. The press census and the run "
                        + 'disagree about which bodies exist, which is the two-consumers '
                        + 'failure this state family exists to prevent.');
                }
                const body = shieldBossBodyRect(b);
                const reach = distanceRectPoint(state.x, state.y, body);
                if (reach > SLASH_REACH) {
                    hits.push({
                        as3: 'ShieldBoss', id: b.id, landed: false, killed: false,
                        why: `distanceRectPoint ${reach.toFixed(3)} > ${SLASH_REACH} — `
                            + 'the rect reached him and `slash()`\'s own gate did not',
                    });
                } else {
                    assertShieldBossLineOfSight(b);
                    const type = weapon === 'spear' ? 'Spear' : 'Sword';
                    const before = { hits: b.hits, activated: b.activated, anim: b.anim };
                    const verdict = shieldBossTakesHit(b, {
                        d: weapon === 'spear' ? SPEAR_DAMAGE
                            : (inventory?.hasDarkSword ? DARK_SWORD_DAMAGE : SWORD_DAMAGE),
                        f: SWORD_FORCE,
                        t: type,
                        // `Enemy.hit` carries `!Game.freezeObjects` inside
                        // its own gate — but ⛔ `ShieldBoss.hit`'s SWALLOW
                        // and its `sit()` are ABOVE it, so a swing during a
                        // ceremony still arms the fight and still aborts a
                        // stab while damaging nothing.
                        frozen: ceremony !== null,
                    });
                    if (verdict.killed) {
                        // ⛔ `startDeath` HAS ALREADY WRITTEN THE TAG — it is
                        // the first line of the override, above `play("die")`
                        // and 34 ticks above the removal. Banked here, on the
                        // tick it really happens.
                        const flag = outOfBandFlagFor(level, b.tag);
                        shieldBossFlags.set(ledgerKey(flag), { ...flag, id: b.id, level });
                        if (!pendingEarnedClears.has(flag.level)) {
                            pendingEarnedClears.set(flag.level, new Set());
                        }
                        pendingEarnedClears.get(flag.level).add(flag.tag);
                        b.tagTick = ticksCompleted;
                        const sched = shieldBossDeathSchedule(ticksCompleted);
                        shieldBossKills.push({
                            t: ticksCompleted, level, id: b.id, what: 'tag',
                            tagTick: ticksCompleted,
                            destroyTick: sched.destroyTick,
                            removedTick: sched.removedTick,
                            flag: { level: flag.level, tag: flag.tag },
                        });
                        /**
                         * ⛔ AND THE KILL-LOCK SCAN, COMPUTED RATHER THAN
                         * SKIPPED — the `IceTurret` arm's law, on a class
                         * whose answer is the OTHER one. This death really
                         * does remove the body, so `classCount(ShieldBoss)`
                         * really does move; L19 holds no `tset == -1` lock,
                         * and that nil is computed from the room record.
                         */
                        const census = world.combat?.enemies ?? null;
                        const roster = (census ?? [])
                            .filter((e) => !e.removed).map((e) => ({ as3: e.as3 }));
                        const led = killLockLedger(levelSource(level), {
                            bodiesBefore: roster,
                            bodiesAfter: roster.filter((e, i) => !(e.as3 === 'ShieldBoss'
                                && i === roster.findIndex((x) => x.as3 === 'ShieldBoss'))),
                        });
                        if (led.locks.length > 0 && census === null) {
                            throw new Error(`levelRun: the ShieldBoss kill in level `
                                + `${level} happens in a room with ${led.locks.length} `
                                + '`tset == -1` lock(s) and the world was built with NO '
                                + 'COMBAT CENSUS, so `totalEnemies()` reads 0 because '
                                + 'nothing was asked. Build the world with the `combat` '
                                + 'role.');
                        }
                        if (!led.nil) {
                            throw new Error(`levelRun: the ShieldBoss kill at tick `
                                + `${pressTick} OPENS ${led.opens.length} kill lock(s) in `
                                + `level ${level} (${led.why}) — a blocker the walk did `
                                + 'not earn. This arm has no verdict for a room where the '
                                + 'body\'s removal moves a lock.');
                        }
                    }
                    shieldBossHits.push({
                        t: ticksCompleted, level, id: b.id, weapon,
                        swallowed: verdict.swallowed,
                        landed: verdict.landed,
                        killed: verdict.killed,
                        aborted: verdict.aborted,
                        retaliated: verdict.retaliated,
                        refusedAt: verdict.refusedAt,
                        hits: b.hits,
                        anim: before.anim,
                    });
                    hits.push({
                        as3: 'ShieldBoss', id: b.id,
                        landed: verdict.landed, killed: verdict.killed,
                        swallowed: verdict.swallowed, aborted: verdict.aborted,
                        retaliated: verdict.retaliated,
                        why: verdict.refusedAt, hits: b.hits, was: before,
                    });
                }
            } else if (r.as3 === 'FinalBoss') {
                /**
                 * ── ⛓⛓⛓ R6 SLICE 6f: THE SHOVE ─────────────────────────
                 *
                 * `Player.genericHit`'s `e is Enemy` arm — the class has no arm
                 * of its own — so the call is `Enemy.hit(swordForce 5,
                 * new Point(x, y), swordDamage, "Sword")` and `onlyHitBy =
                 * "Lava"` sends it to `else if (justKnock) knockback(f, p)`.
                 *
                 * ⛔⛔⛔ AND THIS IS THE ARM WHERE THE FIVE TESTS ARE COUNTED
                 * BY GEOMETRY. Every other receiver on the ladder refuses the
                 * repeats with a timer of its own (`Watcher` 25, `IceTurret`
                 * 30) or is idempotent. This one refuses NOTHING: `justKnock`
                 * sets no `hitsTimer` at all. What ends the press is the
                 * DISPATCHER — `Player.slash` re-collects with
                 * `collideRectInto` and re-measures `FP.distanceRectPoint` on
                 * every tick, and by test 3 the shove has carried the body 13
                 * px along the ray. So the count is `SLASH_REACH` against a
                 * receding 12x12 box, and it is computed here, per test, with
                 * the distance recorded on the refusals.
                 *
                 * ⛔ `maxForce` IS THE BOSS'S OWN HISTORY: -1 (unclamped)
                 * until the first lava hit and 2 after it, so the first press
                 * is worth `n x 5` and every later one `n x 2`.
                 * `finalBossHit` reads it off the state rather than taking it
                 * as an argument, which is why the arm below passes only the
                 * raw `swordForce`.
                 */
                const st = owlStateFor(level).bosses;
                const b = st.get(r.finalBossId);
                if (!b) {
                    throw new Error(`levelRun: the ${weapon} press at tick ${pressTick} `
                        + `reaches ${r.finalBossId} in level ${level}, which is not in the `
                        + "run's FinalBoss state. The press census and the run disagree "
                        + 'about which bodies exist, which is the two-consumers failure '
                        + 'this state family exists to prevent.');
                }
                const body = finalBossBox(b.x, b.y);
                const reach = distanceRectPoint(state.x, state.y, body);
                if (reach > SLASH_REACH) {
                    finalBossShoves.push({
                        t: ticksCompleted, level, id: b.id, landed: false,
                        reach, force: 0, vx: b.vx, vy: b.vy, x: b.x, y: b.y,
                        why: `distanceRectPoint ${reach.toFixed(3)} > ${SLASH_REACH} — `
                            + 'the shove has carried him out of his own hit rect',
                    });
                    hits.push({ as3: 'FinalBoss', id: b.id, landed: false, killed: false });
                } else if (b.destroy) {
                    // ⛓ THE CORPSE IS STILL A RESPONDER (its type is "Solid",
                    // which `Player.slash` collects) and `Enemy.hit`'s gate
                    // chain refuses it: `canHit` is whatever the last live tick
                    // left, and `justKnock`'s `knockback` reaches a body that
                    // no longer runs `mobileUpdate`. Recorded as a refusal so a
                    // late swing reads as a no-op rather than as a missing
                    // event.
                    finalBossShoves.push({
                        t: ticksCompleted, level, id: b.id, landed: false,
                        reach, force: 0, vx: b.vx, vy: b.vy, x: b.x, y: b.y,
                        why: 'the body is a CORPSE — `destroy` is set, so `update()` '
                            + 'returns above every arm and the knockback moves nothing',
                    });
                    hits.push({ as3: 'FinalBoss', id: b.id, landed: false, killed: false });
                } else {
                    assertFinalBossLineOfSight(b);
                    const before = { x: b.x, y: b.y, vx: b.vx, vy: b.vy, hits: b.hits };
                    const verdict = finalBossHit(b, {
                        force: SWORD_FORCE,
                        fromX: state.x,
                        fromY: state.y,
                        // ⛓ NOT "Lava" — a sword press can never be. The type
                        // is what decides which arm of `Enemy.hit` runs, and
                        // `onlyHitBy` admits exactly one string.
                        type: weapon === 'spear' ? 'Spear' : 'Sword',
                    });
                    finalBossShoves.push({
                        t: ticksCompleted, level, id: b.id,
                        landed: verdict.landed,
                        force: verdict.force,
                        reach,
                        why: verdict.why ?? null,
                        x: before.x, y: before.y,
                        vx: b.vx, vy: b.vy,
                        maxForce: b.maxForce,
                    });
                    hits.push({
                        as3: 'FinalBoss', id: b.id,
                        landed: verdict.landed, killed: false,
                        why: verdict.why ?? null, was: before,
                    });
                }
            } else if (r.as3 === 'Watcher') {
                /**
                 * ── ⛓⛓⛓ R6 SLICE 6d: THE SWING AT THE WATCHER ──────────
                 *
                 * `Player.genericHit`'s LAST `else if` (`Player.as:1130`),
                 * and the arm takes NO ARGUMENTS at all — no force, no
                 * damage, no type. `Watcher.hit()` is three terms and a
                 * counter (`endingChain.watcherTakesHit`).
                 *
                 * ⛔⛔ THE RECT IS NOT THE HIT TEST, exactly as for the
                 * Shieldspire: `Player.slash` applies a 16 px
                 * `FP.distanceRectPoint` gate and a `collideLine("Solid")`
                 * line of sight afterwards. Both are applied here — and the
                 * line of sight is NOT waived, because `Watcher`'s ctor
                 * overrides `type` to `"Watcher"` and the waiver
                 * (`v[i].type == "Solid"`) does not fire for it.
                 *
                 * ⛓ AND THE BODY IS A CONSTANT, which is why this arm is
                 * shorter than every other one here: the Watcher never
                 * moves, never shrinks, and `check()` is overridden EMPTY so
                 * it never leaves — the census rect is live for the whole
                 * run and only the COUNTER has to be looked up.
                 */
                const st = watcherStateFor(level);
                const w = st.get(r.watcherId);
                if (!w) {
                    throw new Error(`levelRun: the ${weapon} press at tick ${pressTick} `
                        + `reaches ${r.watcherId} in level ${level}, which is not in the `
                        + "run's watcher state. The press census and the run disagree "
                        + 'about which bodies exist, which is the two-consumers failure '
                        + 'this state family exists to prevent.');
                }
                const body = {
                    x: w.ex - WATCHER.box.originX,
                    y: w.ey - WATCHER.box.originY,
                    right: w.ex - WATCHER.box.originX + WATCHER.box.w,
                    bottom: w.ey - WATCHER.box.originY + WATCHER.box.h,
                };
                const reach = distanceRectPoint(state.x, state.y, body);
                if (reach > SLASH_REACH) {
                    watcherHits.push({
                        t: ticksCompleted, level, id: w.id, landed: false,
                        hits: w.hits, hitsTimer: w.hitsTimer,
                        why: `distanceRectPoint ${reach.toFixed(3)} > ${SLASH_REACH} — `
                            + 'the rect reached him and `slash()`\'s own gate did not',
                    });
                    hits.push({ as3: 'Watcher', id: w.id, landed: false });
                } else {
                    const blocker = collideLineSolid(state.x, state.y, w.ex, w.ey);
                    if (blocker) {
                        throw new Error(`levelRun: the ${weapon} press at tick `
                            + `${pressTick} reaches ${w.id} through ${blocker}. `
                            + '`Player.slash`\'s `collideLine("Solid", x, y, v[i].x, '
                            + 'v[i].y)` refuses a swing with a wall in the way, and the '
                            + 'waiver is `v[i].type == "Solid"` — which a Watcher\'s '
                            + '"Watcher" type is not. Re-aim the press.');
                    }
                    const verdict = watcherTakesHit(w);
                    w.hits = verdict.hits;
                    w.hitsTimer = verdict.hitsTimer;
                    watcherHits.push({
                        t: ticksCompleted, level, id: w.id, landed: verdict.landed,
                        hits: w.hits, hitsTimer: w.hitsTimer, why: verdict.why,
                    });
                    hits.push({
                        as3: 'Watcher', id: w.id, landed: verdict.landed,
                        hits: w.hits, why: verdict.why,
                    });
                }
            }
        }
        presses.push({
            t: pressTick, fired: ticksCompleted, level, weapon, direction, rect, hits,
        });
    };

    // ── ⛔⛔ R5 SLICE 9: THE CHEST, THE PULSE AND THE SEAL ─────────────
    /**
     * One tick of every `Chest` in the level.
     *
     * The two joins the transcription needs and does not own:
     *
     * - **the gate.** `!collide("Solid", x, y)` with `e !== this`, which for
     *   the join cell is the chest colliding with its COVER. Asked of the
     *   real geometry with this chest's own solid taken out, because a chest
     *   that collided with itself would never open;
     * - **the write.** `setPersistence(tag, false)` is BANKED, exactly like
     *   `Lock.turnOff()`'s, because `Chest.check()` on the next `new Game`
     *   removes a chest whose flag is off — so the clear has to survive the
     *   visit and be cashed at the destination's build.
     */
    function stepChestsNow(activators) {
        const st = chestStateFor(level);
        if (st.size === 0) return;
        const events = stepChests(st, {
            playerBox: playerBoxAt(state.x, state.y),
            hasAllSealParts: HAS_ALL_SEAL_PARTS,
            solidOver: (c) => {
                // The chest's own box, and its own solid excluded — the
                // `e !== this` of `Entity.collide`.
                const box = {
                    x: c.x, y: c.y, right: c.x + 16, bottom: c.y + 16,
                };
                const openChests = new Set([c.id, ...(openChestIdsNow() ?? [])]);
                return !!world.collidesSolid(box, normalizeLiveOpts(liveSolidOpts({
                    beforeTypeFlip: firstTickInWorld,
                    openActivators: openActivatorIds(activators),
                    openChests,
                })));
            },
        });
        for (const ev of events) {
            if (ev.kind !== 'chestopen') continue;
            chestOpens.push({ t: ticksCompleted + 1, level, id: ev.id, persistTag: ev.persistTag });
            if (ev.persistTag >= 0) {
                if (!pendingEarnedClears.has(level)) pendingEarnedClears.set(level, new Set());
                pendingEarnedClears.get(level).add(ev.persistTag);
            } else {
                // A `tag = -1` chest is the family's SIXTH member. No
                // placement on this rung has one; the throw is here so the
                // first that does gets a name rather than a dropped write.
                throw new Error(`levelRun: ${ev.id} in level ${level} opened with `
                    + 'tag -1. `Game.setPersistence(-1, false)` is an OUT-OF-BAND write '
                    + '(`outOfBandLedger`), and no chest on any modelled route has one — '
                    + 'so this needs a classification rather than a silent drop.');
            }
            // ⛓ `open()` spawns the SealPiece at the CHEST's own position,
            // unconditionally. It cannot be routed around: in L38 that
            // position is the one cell the walk has to pass through.
            if (sealPiece !== null) {
                throw new Error('levelRun: a second SealPiece spawned while one was '
                    + 'still live. Two overlapping `special` pickups are two overlapping '
                    + 'freezes, which is not a shape this model transcribes.');
            }
            sealPiece = createSealPiece(ev.x + 8, ev.y + 8);
            sealPieceFrom = ev.id;
        }
    }

    /**
     * ⛓⛓⛓ ONE TICK OF EVERY `ArrowTrap`, AND THE ARROWS IN FLIGHT.
     *
     * `stepPulsersNow`'s shape, and it reads the group the same way and for
     * the same reason: a trap is not in `activators`, so the flag comes off
     * `pressedGroups` plus the groups a `room = -1` ButtonRoom has LATCHED.
     *
     * ⛔ AND IT IS THE PREVIOUS TICK'S FLAG, WHICH IS THE GAME'S. `Button`
     * is added at `Game.as:2202` and `arrowtrap` at `:2204`, `World.addUpdate`
     * PREPENDS, so the update list is reverse add order and the TRAP updates
     * BEFORE the BUTTON. `activators` here is exactly the previous tick's
     * state, which is what the game's trap sees — the same off-by-one the
     * chest/cover pair already documents, needing the note and no special case.
     *
     * ⚠ WHAT THIS DOES **NOT** DO, and both absences are claims:
     *
     *   1. **It computes no enemy hit.** An `Arrow`'s hitables include
     *      `"Enemy"`, and this run holds no enemy BODIES —
     *      `KILL_ARM_POLICY.Bob` is `refused` because a chaser's kill needs
     *      its POSITION, and an arrow needs the body in a LANE for exactly
     *      the same reason. The GAME adjudicates the kill (§1.5), which is
     *      what `probe-seedling-r7-l5-arrows.mjs` is.
     *   2. **It computes no cover hit and no player hit.** An arrow's
     *      hitables are a THIRD list — narrower than `Mobile.solids` (no
     *      `Rock`, no `Rope`, no `ShieldBoss`) and wider in one place
     *      (`Shield`) — so `collidesSolid`, which is the PLAYER's list,
     *      would stop arrows the game flies through. And the damage an
     *      arrow does to the player is ALREADY priced, by
     *      `combat.PUZZLEMENT_HAZARDS.arrowtrap`; computing it here as well
     *      would double-bill it. `shadowOf` is the predicate a planner asks
     *      the cover question with, at plan time, with the boxes in hand.
     *
     * ⇒ what this DOES carry is the cadence, the flight, and the volley
     * ledger — which is the only positive observable a hold on a trap group
     * has, because a trap has no open state to move.
     */
    function stepArrowTrapsNow(activators) {
        const st = arrowTrapStateFor(level);
        const flight = arrowsFor(level);
        if (st.size === 0 && flight.length === 0) return;
        const pressed = pressedGroups(world, playerBoxAt(state.x, state.y), movingSolidsNow());
        for (const [, trap] of st) {
            const armed = pressed.has(trap.t) || activators.latched.get(trap.t) === true;
            const r = stepArrowTrap(trap, armed);
            if (!r.fired) continue;
            arrowVolleysFired.push({
                t: ticksCompleted + 1,
                level,
                id: trap.id,
                arrows: r.arrows.map((a) => a.id),
            });
            flight.push(...r.arrows);
        }
        // ⚠ The bound is the LEVEL's, because `Game.as:1930-1931` writes
        // `FP.width/height` from the loading level's own `.oel` dimensions —
        // it is not the screen and it moves per level.
        const bound = { w: world.world.width, h: world.world.height };
        for (const a of flight) stepArrow(a, { frozen: ceremony !== null, bound });
        for (let i = flight.length - 1; i >= 0; i -= 1) {
            if (flight[i].removed) flight.splice(i, 1);
        }
    }

    /**
     * One tick of every `Pulser`, and the block it moves.
     *
     * ⚠ THE ACTIVATION IS THE GROUP'S, and a `Pulser` is not in
     * `activators` — so the flag is read off the same `pressedGroups` the
     * responders use, from the state the PREVIOUS tick left (a Pulser
     * updates before its ButtonRoom, per the add order).
     */
    function stepPulsersNow(activators, pushState) {
        const st = pulserStateFor(level);
        if (st.size === 0) return;
        // ⛓ THE FLAG IS THE GROUP'S, and a Pulser is not a member of
        // `activators` — so it is read off `pressedGroups` directly, plus
        // the groups a `room = -1` ButtonRoom has LATCHED (§20.6: the setter
        // is behind `if (a)` with the author's own "Can't be reset to
        // false!!"). Link 2 of L38's chain is exactly such a latch, which is
        // why the latched set is not an optional extra here.
        const pressed = pressedGroups(world, playerBoxAt(state.x, state.y), movingSolidsNow());
        for (const [id, p] of st) {
            const armed = pressed.has(p.t) || activators.latched.get(p.t) === true;
            const r = stepPulser(p, armed);
            st.set(id, r.state);
            if (!r.hit) continue;
            pulserHits.push({ t: ticksCompleted + 1, level, id });
            // The candidates: every block, and the player.
            const targets = [];
            for (const [bid, rect] of pushableRects(pushState)) {
                if (rect.removed) continue;
                const b = pushState.byId.get(bid);
                targets.push({
                    id: bid,
                    type: 'Solid',
                    as3: b.as3 ?? 'PushableBlockFire',
                    x: rect.rect.x + 8,
                    y: rect.rect.y + 8,
                    originX: 8,
                    originY: 8,
                    w: 16,
                    h: 16,
                });
            }
            targets.push({
                id: 'player', type: 'Player', as3: 'Player',
                x: state.x, y: state.y, originX: 2, originY: 2, w: 4, h: 5,
            });
            /**
             * ⛔⛔⛔ R5 SLICE 13 — AND THE ENEMIES, which cost the shaft's
             * CONTROL arm a ledger entry before they were here.
             *
             * `Pulser.hit`'s third arm is `(c as Enemy).hit(force, …, damage,
             * "Pulse")` and `pulser.armFor` has named it since slice 9; this
             * list is what it was missing. The control arm — the eighteen
             * presses DELETED, so nothing fights anything — came back from
             * the game carrying **{39,4}**, `spinner@224,112`'s own tag, and
             * the model predicted an empty ledger.
             *
             * ⛓ THE LESSON, AND IT IS THE GENERAL ONE: modelling a POSITION
             * creates a bill for everything that acts on it. A spinner was
             * inert while it had no position; the tick it acquired one, every
             * `collideRect` in the game that names "Enemy" became a query the
             * model owes an answer to.
             */
            for (const sp of spinnerRectsNow() ?? []) {
                targets.push({
                    id: sp.id, type: 'Enemy', as3: 'Spinner',
                    x: sp.spinner.x, y: sp.spinner.y,
                    originX: SPINNER.originX, originY: SPINNER.originY,
                    w: SPINNER.w, h: SPINNER.h,
                });
            }
            for (const reached of pulseReaches(r.state, targets)) {
                if (reached.arm === 'pushable') {
                    const block = pushState.byId.get(reached.id);
                    const push = pulsePushes(r.state, block);
                    pushState.byId.set(reached.id, push.block);
                    if (push.moved) {
                        pulsePushes_.push({
                            t: ticksCompleted + 1, level, pulser: id, block: reached.id,
                        });
                    }
                } else if (reached.arm === 'player') {
                    // ⚠ `Player.hit`'s FIRST LINE is `if (Bot.noDamage) return`
                    // — no knockback, no sound, no shake. Under the ladder's
                    // own flag the ring is inert; R5 refused the other arm by
                    // name, and ⛓⛓⛓ R6 SLICE 3 MODELS IT: the impulse is
                    // `Player.knockback` from the PULSER's own origin, which
                    // is the shape every other source here already has.
                    if (!noDamage) {
                        applyPlayerHit({
                            source: 'pulse', id, force: PULSER.force, damage: PULSER.damage,
                            from: { x: r.state.x, y: r.state.y },
                        });
                    }
                    pulserPlayerHits.push({ t: ticksCompleted + 1, level, id });
                } else if (reached.arm === 'enemy') {
                    // ⚠ THE STATE IS THE SPINNER'S, and `hitSpinner` is
                    // `Enemy.hit` verbatim: the `hitsTimer <= 0` gate, the
                    // `!Game.freezeObjects` gate, `hits += damage`, and the
                    // atan2 knockback at force 6 — which against `moveSpeed
                    // = 1` and a friction FLOOR of 1 is twenty ticks of a
                    // completely different trajectory, not a nudge.
                    const spSt = spinnerStateFor(level);
                    const sp = spSt.byId.get(reached.id);
                    if (sp) {
                        const after = hitSpinner(sp, {
                            force: PULSER.force,
                            from: { x: r.state.x, y: r.state.y },
                            damage: PULSER.damage,
                            t: 'Pulse',
                            frozen: ceremony !== null,
                        });
                        spSt.byId.set(reached.id, after);
                        if (after.destroy && !sp.destroy) {
                            pulserEnemyKills.push({
                                t: ticksCompleted + 1, level, pulser: id, enemy: reached.id,
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * ⛓⛓⛓ R5 SLICE 15: ONE TICK OF EVERY ARMED CRUSHER IN THE ROOM.
     *
     * ⚠ THE CTX IS REBUILT PER CRUSHER, ON PURPOSE. `moveX` collides against
     * the world as it is when THAT entity updates, and in L42 the two are
     * adjacent — so the second one's charge must see the first where this
     * loop just left it, and its sight line must be shielded by it there
     * too. Sharing one snapshot across the loop would give the second
     * crusher a one-tick-stale wall, which is the `pushableCtx` lesson
     * (`withoutSelf` read LIVE, not off a snapshot) on a mover that actually
     * has two instances on a route.
     *
     * ⛔ THE ORDER WITHIN THE LOOP IS THE ROSTER'S, which is the extract's,
     * which is `Game.loadlevel`'s `for each` — and `World.addUpdate`
     * PREPENDS, so the update list is its REVERSE. Iterated backwards for
     * that reason; in L42 it decides which of two adjacent crushers reads
     * the other as already-moved.
     */
    function stepCrushersNow() {
        const st = crusherStateFor(level);
        if (st.size === 0) return;
        const ids = [...st.keys()].reverse();
        for (const id of ids) {
            const c = st.get(id);
            // `update()`'s whole body is behind `if (activate || t == -1)`.
            // ⛔ On a `Lock` that same literal is the KILL-LOCK sentinel;
            // here it means ON, permanently.
            //
            // ⚠ REFUSED RATHER THAN APPROXIMATED for a grouped one. All four
            // crushers in the game carry `tset -1` (asserted in
            // `crusher.test.js` against the extract), so the `activate` arm
            // is reachable in the class and unexercised by the data — and
            // wiring it would mean deciding whether a `Crusher` joins
            // `activators`, which is exactly the question §21.65 got wrong
            // for the `Pulser` (a Solid either way, so "open" would read as
            // passable). The first placement that needs it gets a name.
            if (!alwaysArmed(c.t)) {
                throw new Error(`levelRun: ${id} in level ${level} has tset ${c.t}, not -1. `
                    + '`Crusher.update` opens on `activate || t == -1` and only the '
                    + 'sentinel is modelled: a grouped crusher would have to be published '
                    + 'to by a presser, and whether an "open" Crusher is passable is the '
                    + '`Pulser` question (§21.65) on a class that also MOVES. No placement '
                    + 'in the game has one — this needs a ruling, not a default.');
            }
            // ⚠ THE OPTS ARE REBUILT PER CRUSHER, and that is the point:
            // the second one's world contains the first where THIS loop just
            // left it (`liveSolidOpts` reads `crusherRectsNow()` live).
            const r = stepCrusher(c, crusherCtx(c, normalizeLiveOpts(liveSolidOpts())));
            st.set(id, { ...c, ...r.crusher });
            if (r.kills) {
                /**
                 * ⛔⛔ A CONTACT IS 1000 DAMAGE — `die()` at any `hitsMax` —
                 * AND IT IS NOT REPORTED AS A DEATH HERE.
                 *
                 * `Bot.noDamage` is on for every tape this ladder emits, so
                 * the GAME survives a contact and the model must not
                 * pretend otherwise: a run that threw here would diverge
                 * from the recording it is checked against. What it is
                 * instead is a ROUTE DEFECT — a stance the plan said was
                 * clear and was not — so it is recorded, and the leg verbs
                 * assert the list is empty. A relaxation that hides a
                 * mistake is only safe while something still counts them.
                 */
                crusherContacts.push({
                    t: ticksCompleted + 1, level, id, x: r.crusher.x, y: r.crusher.y,
                });
                // ⛓⛓⛓ R6 SLICE 3: ...AND ON A TAPE THAT HAS RETIRED THE
                // FLAG IT IS A DEATH, WHICH IS WHY THE PARAGRAPH ABOVE IS
                // SCOPED TO `noDamage` RATHER THAN TO THE CRUSHER.
                //
                // 1000 damage against any `hitsMax` is `hits >= hitsMax` on
                // the first contact, so `Player.hit` takes the `die()` arm
                // and NOT the knockback one — the impulse a crusher would
                // have applied never exists. The route-defect ledger above
                // still records it either way, because a stance that was
                // supposed to be clear and was not is the same defect
                // whether or not the tape survived it.
                if (!noDamage) {
                    applyPlayerHit({
                        source: 'crusher', id, force: CRUSHER.force,
                        damage: CRUSHER.damage, from: { x: r.crusher.x, y: r.crusher.y },
                    });
                }
            }
        }
    }

    /**
     * ⛓⛓⛓ R5 SLICE 20: ONE TICK OF EVERY ICE TURRET IN THE ROOM.
     *
     * ⚠ THE OPTS ARE REBUILT PER TURRET, for `stepCrushersNow`'s reason: the
     * corpse's own `solids` list is `Mobile`'s plus the Enemy/Player pushes
     * `death()` adds, so a second corpse in the same room is a wall to the
     * first one where THIS loop just left it.
     *
     * ⛔ AND THE BODY EXCLUDES ITSELF. `moveX`/`moveY` collide against
     * `solids` from the entity's own position, and the entity is not in its
     * own collision list — but its box IS in `turretRectsNow()`, so the
     * self-entry has to be dropped or every corpse is instantly wedged in
     * itself. `withoutSelf` is `pushableCtx`'s shape and it is here for
     * exactly the same reason.
     */
    /**
     * ⛓⛓⛓ R5 SLICE 22: ONE TICK OF EVERY BLAST IN FLIGHT, AND IT IS FIRST.
     *
     * `World.addUpdate` PREPENDS and a blast is added at RUN TIME, so it
     * sits ahead of every `.oel` entity in the update list — ahead of the
     * spinners, the blocks, the crusher, its own turret and the player.
     * Both halves are load-bearing:
     *
     *   · it reads the world as the PREVIOUS tick left it, so a wall that
     *     arrives this tick does not shield a blast already past it;
     *   · it writes `frozenTimer` BEFORE the player's `freezeStep`, which
     *     is what makes the contact tick itself the first refused one
     *     (`iceTurretBlast.FREEZE_SPAN`).
     *
     * ⚠ AND IT RUNS THROUGH A CEREMONY. Only the MOVE is behind
     * `Game.freezeObjects`; the collision test is in `update()`'s own body
     * below `super.update()`. A blast parked on the player by a freeze
     * still freezes them.
     */
    function stepBlastsNow() {
        const list = blastsFor(level);
        if (list.length === 0) return;
        const opts = normalizeLiveOpts(liveSolidOpts());
        const box = playerBoxAt(state.x, state.y);
        const reach = blastReachFor(level);
        for (const b of list) {
            const r = stepIceTurretBlast(b, {
                frozen: ceremony !== null,
                playerBox: box,
                blockedAt: (bx) => !!world.collidesBlast(bx, opts),
            });
            if (r.hitPlayer) {
                // `(hits[i] as Player).freeze(freezeTime)` — UNGATED, the
                // line above the `Bot.noDamage`-guarded `hit`.
                frozenTimer = BLAST_FREEZE_TICKS;
                blastFreezes.push({
                    t: ticksCompleted + 1, level, blast: b.id, x: b.x, y: b.y,
                });
            }
            // ⛓⛓⛓ R6 SLICE 3: `Player.hit(null, 0, new Point(x, y))` is the
            // NEXT LINE, and it is no longer a refusal.
            //
            // R5 threw here because the model carried the freeze and not the
            // damage — the two are separated by one line and only the second
            // is behind `Bot.noDamage`
            // ([[feedback_nodamage_prices_damage_not_freeze]]). Now both
            // land. ⚠ FORCE ZERO: the blast knocks nothing back, so what a
            // hit costs here is a heart, twenty i-frames and five of shake —
            // and the i-frames are what make the SECOND blast of a volley
            // free.
            if (r.hitPlayer) {
                applyPlayerHit({
                    source: 'blast', id: b.id, force: 0, damage: 1,
                    from: { x: b.x, y: b.y },
                });
            }
        }
        // `FP.world.remove` is deferred to `updateLists()` at the end of the
        // frame, so a blast that hit is gone from the NEXT tick and not
        // from this one. Nothing reads a blast but this loop, so the two
        // are indistinguishable — filtered here for that reason.
        const kept = list.filter((b) => !b.removed && !blastIsSpent(b, reach));
        if (kept.length !== list.length) blastStates.set(level, kept);
    }

    /**
     * ⛓⛓⛓ R6 SLICE 2: ONE UPDATE OF EVERY WAND SHOT, AND IT IS FIRST.
     *
     * A shot is added at RUN TIME and `World.addUpdate` PREPENDS, so it sits
     * ahead of every `.oel` entity — including the lock it is flying at and
     * the player who fired it. Two consequences, both load-bearing:
     *
     *   · it reads the world as the PREVIOUS tick left it;
     *   · the lock's `play("destroy")` therefore lands ABOVE the lock's own
     *     graphic pass in the same tick, which is what makes destroy update
     *     1 the HIT TICK (`magicalLock.MAGICAL_LOCK_CALLBACK_TICK_OFFSET`).
     *
     * ⚠ AND NOTHING HERE IS FREEZE-GATED. `WandShot.update` overrides
     * `Mobile.update` and never consults `Game.freezeObjects` — only
     * `Enemy.hit` does, which is why a contact during a ceremony is a spent
     * shot that deals nothing.
     */
    function stepWandShotsNow() {
        const list = wandShotsFor(level);
        if (list.length === 0) return;
        const opts = normalizeLiveOpts(liveSolidOpts());
        const hitAt = wandShotBlockerAt(opts);
        const locks = magicalLockStateFor(level);
        for (const s of list) {
            // ⛓⛓⛓ R6 SLICE 3: THE CULL'S CAMERA, UNDER SHAKE.
            //
            // `cam` is null while the camera is a band, and `stepWandShot`'s
            // cull is `if (cam && …)` — so passing null would SKIP the cull
            // silently, which is the exact shape of a dropped option key.
            // The band's low corner is passed instead, licensed by
            // `WAND_SHOT_CULL.reachableUnderShake`: with the roster's
            // largest shake the margin still dominates by 66 px, so the
            // verdict is the same at every point of the band. Guarded, not
            // assumed — if that arithmetic ever changes this throws.
            let cullCam = cam;
            if (cullCam === null) {
                if (WAND_SHOT_CULL.reachableUnderShake) {
                    throw new Error('levelRun: a wand shot is in flight while the camera '
                        + 'is a shake BAND, and `WAND_SHOT_CULL.reachableUnderShake` is '
                        + 'now true — so the cull\'s verdict depends on where inside the '
                        + 'jiggle the camera landed. The cull needs a band test, not a '
                        + 'point one.');
                }
                cullCam = { x: camBand.x.lo, y: camBand.y.lo };
            }
            const r = stepWandShot(s, {
                tick: ticksCompleted, frozen: ceremony !== null, cam: cullCam, hitAt,
            });
            if (r.event) {
                // ⛓ R6 SLICE 4: THE ENEMY ARM AMENDS THE EVENT, SO IT HAS
                // TO RUN ABOVE THE PUSH. `wandShotHits` takes a SPREAD, so
                // an amendment below it would be written to an object
                // nobody reads — the shape [[feedback_dropped_option_key_is_a_silence]]
                // names, found by this file's own test.
                if (r.event.arm === 'enemy') applyWandShotToBoss(s, r.event);
                wandShotHits.push({
                    t: ticksCompleted, level, id: s.id, ...r.event,
                });
                if (r.event.arm === 'magicallock' && r.event.opened) {
                    const lock = locks.get(r.event.id);
                    hitMagicalLock(lock, s.shotType, ticksCompleted);
                    magicalLocksOpened.push({
                        level, id: lock.id, tag: lock.tag, shot: s.id,
                        hitTick: lock.hitTick, openTick: lock.openTick,
                    });
                }
            }
            // `Music.playSound("Wand Fizzle")` moves the draw stream and
            // nothing gameplay-side reads it in any room this rung routes
            // (§8.3's census) — recorded, not modelled.
            if (r.fizzled) s.fizzledAt = ticksCompleted;
            // ⛓ THE GRAPHIC PASS, right after the entity's own update and
            // outside the `e.active` test (`World.as:58`). Separate call
            // because the die clock starts on the SAME tick `play("die")`
            // ran, and folding it in would hide that.
            stepWandShotGraphic(s, ticksCompleted);
        }
        const kept = list.filter((s) => !s.removed);
        if (kept.length !== list.length) wandShotStates.set(level, kept);
    }

    /**
     * `Enemy.hit(3, p, 0.5, "Wand")` on the one class this rung steps.
     *
     * Amends the shot's own event with the BODY's verdict — see the call
     * site for why it must run above the push.
     */
    function applyWandShotToBoss(s, event) {
        // ⛓⛓⛓ R6 SLICE 4: `Enemy.hit`, LANDED — slice 2's refusal retires
        // for the one class this rung steps.
        //
        // ⛔ `wandShotCheckEntity` KNOWS ONLY THE FREEZE. Its
        // `landed: !frozen` is `Enemy.hit`'s `&& !Game.freezeObjects` term
        // and nothing else; the other five gates (`fullyActivated`,
        // `activationRestTime`, `hitsTimer`, `onlyHitBy`, `hits < hitsMax`)
        // are the BODY's and live on the body. The event is amended with
        // the verdict the body gave, so a reader of `wandShotHits` never
        // sees a `landed: true` the boss refused.
        const boss = bossStateFor(level).get(event.id);
        if (!boss) {
            throw new Error(`levelRun: a wand shot (${s.id}) reached the enemy `
                + `"${event.id}" at tick ${ticksCompleted} in level ${level}, and it is `
                + 'not a BossTotem. `Enemy.hit(3, p, 0.5, "Wand")` would land — and the '
                + 'only fight model this rung carries is the totem\'s. Plan the shot at '
                + 'a `magicallock`, or route around the body.');
        }
        const verdict = bossTotemTakesHit(boss, {
            type: 'Wand',
            damage: BOSS_TOTEM_KILL.shotDamage,
            freezeObjects: ceremony !== null,
        });
        event.landed = verdict.landed;
        event.spentWithoutDamage = !verdict.landed;
        event.refusedAt = verdict.refusedAt;
        event.hits = boss.hits;
        bossHits.push({
            t: ticksCompleted, level, id: event.id, shot: s.id,
            hits: boss.hits, landed: verdict.landed,
            refusedAt: verdict.refusedAt, killed: verdict.killed,
            bossY: boss.y,
        });
        if (!verdict.killed) return;
        // ⛔ THE BLAST IS ABOUT THE POINT HE DIED AT, and the descent moved
        // it (§8.10). `dieEffects` runs inside `startDeath`, i.e. during
        // THIS shot's update, so the boss's y is the one his own `update()`
        // last wrote — one tick old, and his update this tick will return
        // at `if (destroy)`.
        //
        // ⛓ `added()` fires when `updateLists()` drains `_add` at the END
        // of this tick, so the disc is tested against where the PLAYER ends
        // up, not where they are now. Deferred for that reason.
        pendingBlasts.push({
            x: boss.x, y: boss.y,
            radius: BOSS_TOTEM_DEATH_BLAST.radius,
            damage: BOSS_TOTEM_DEATH_BLAST.damage,
            force: BOSS_TOTEM_DEATH_BLAST.force,
            source: 'bossDeathBlast', id: event.id,
        });
        bossKills.push({
            t: ticksCompleted, level, id: event.id,
            x: boss.x, y: boss.y, killTick: ticksCompleted,
            tagTick: null, flag: null,
        });
    }

    /**
     * ⛓⛓⛓ R6 SLICE 4: ONE UPDATE OF EVERY `BossTotemShot`.
     *
     * Also run-time-added and also PREPENDED, so it sits with the wand
     * shots ahead of every `.oel` entity. ⛓ BELOW them, because within one
     * tick `_add` is drained in add order and each entry is PREPENDED — so
     * the LAST thing added is FIRST in the list, and the boss (early in the
     * list) publishes before the player (late) does. The two families can
     * only be added on the same tick by a press that lands on the attack's
     * `shootFrame`; ordered rather than assumed apart.
     *
     * ⚠ NOTHING HERE IS FREEZE-GATED EITHER: `BossTotemShot.update` calls
     * `super.update()` (which IS gated) and then runs its own hit loop
     * unconditionally. So a frozen shot stops MOVING and keeps COLLIDING —
     * the shape §10.6 named for the wand, one class over.
     */
    function stepBossShotsNow() {
        const list = bossShotsFor(level);
        if (list.length === 0) return;
        const box = playerBoxAt(state.x, state.y);
        for (const s of list) {
            if (s.removed) continue;
            const verdict = bossShotOnScreenVerdict(s);
            const r = stepBossTotemShot(s, {
                playerBox: noDamage ? null : box,
                onScreenVerdict: verdict,
            });
            // ⛔⛔⛔ THE BAND'S BILL, AND IT IS PAID PER SHOT.
            //
            // After the first volley `Game.shake` has opened §11.6's band
            // for the rest of the visit, and these shots END at the bottom
            // screen edge — so `onScreen` is uncertain for every one of
            // them and a blanket refusal would make the window unwritable.
            // The surviving branch is driven instead (a removed shot does
            // NOTHING, so surviving is a strict over-approximation), and
            // what is owed in exchange is the assertion below: in the
            // branch that can act, it never touches the player. Then the
            // two branches are the same world and the claim holds in both.
            if (r.removalUncertain) {
                s.uncertainSince = s.uncertainSince ?? ticksCompleted;
                bossShotCullBand.push({ t: ticksCompleted, level, id: s.id, y: s.y });
            }
            if ((r.playerHit || (r.explodeAt && r.fate === 'bottom')) && s.uncertainSince) {
                throw new Error(`levelRun: the BossTotemShot ${s.id} acted on the player `
                    + `at tick ${ticksCompleted} in level ${level}, and its own removal `
                    + `has been UNCERTAIN since tick ${s.uncertainSince} — `
                    + '`Game.shake`\'s band (§11.6, which never closes) leaves it both '
                    + 'alive and culled. The game either did this or did nothing at all, '
                    + 'and the window cannot claim which. Plan the stance clear of the '
                    + 'shots\' columns (x 122 and 182, 16 px boxes) and of the room '
                    + 'bottom, so the two branches agree.');
            }
            if (r.playerHit) {
                // `(hits[i] as Player).hit(null, v.length, new Point(x, y))`
                // — `d` DEFAULTS to 1 and the force is the SPEED, which for
                // `(0,2)` is 2. Not the boss's `force`.
                applyPlayerHit({
                    source: 'bossShot', id: s.id,
                    force: Math.sqrt(s.vx * s.vx + s.vy * s.vy),
                    damage: BOSS_TOTEM_SHOT.playerDamage,
                    from: { x: s.x, y: s.y },
                });
            }
            if (r.explodeAt) {
                applyExplosion({
                    x: r.explodeAt.x, y: r.explodeAt.y,
                    radius: BOSS_TOTEM_SHOT.explosionHitRadius,
                    damage: BOSS_TOTEM_SHOT.explosionDamage,
                    force: BOSS_TOTEM_DEATH_BLAST.force,
                    source: 'bossShotBlast', id: s.id,
                });
            }
        }
        const kept = list.filter((s) => !s.removed);
        if (kept.length !== list.length) bossShotStates.set(level, kept);
    }

    /**
     * `World.updateLists()`'s REMOVE half, for the one entity in this rung
     * that asks to be removed from `render()`.
     *
     * ⛓⛓ THE TAG IS 240 RENDERS AND ONE UPDATE AFTER THE KILL. `render()`
     * increments the white-out counter and calls `FP.world.remove(this)` at
     * 240; `remove` defers to `_remove`, which the NEXT frame's
     * `updateLists()` drains. So `removed()` — and with it `{43,5}`,
     * `Game.shake = 60` and `Game.resetCamera()` — lands 240 renders and one
     * update after `startDeath`. The ledger row carries BOTH ticks so a
     * window can never confuse the kill with the flag.
     */
    function drainBossRemovals() {
        for (const b of bossStateFor(level).values()) {
            if (!b.removeRequested || b.removed) continue;
            b.removed = true;
            // `removed()`, `doActions` true — this is the death path, and
            // `check()`'s despawn (the re-entry) sets it false precisely so
            // this block does NOT run twice.
            bossCameraTarget = { x: -1, y: -1 };        // `Game.resetCamera()`
            shake = applyShakeWriter(shake, 'totemDeath');
            const w = BOSS_TOTEM_WHITE_OUT.persistenceWrite;
            const flag = outOfBandFlagFor(level, w.tag);
            bossFlags.set(ledgerKey(flag), { ...flag, id: b.id ?? 'bosstotem', level });
            const kill = bossKills.find((k) => k.level === level && k.tagTick === null);
            if (kill) {
                kill.tagTick = ticksCompleted;
                kill.flag = { level: flag.level, tag: flag.tag };
                kill.whiteOutRenders = b.whiteOutRenders;
            }
        }
    }

    /**
     * `BossTotem.render()` for every boss in the room, at the END of the
     * frame — after `update()` and after `updateLists()`, which is where
     * `Engine`'s loop puts it.
     *
     * ⛔ IT RUNS ON EVERY FRAME, INCLUDING FROZEN ONES AND CEREMONY ONES.
     * `render()` is outside `Game.update` entirely, so the head position the
     * NEXT tick's laser reads is written even on frames the boss's own
     * `update()` skipped — and the white-out counter advances through a
     * freeze for the same reason.
     */
    function renderBossesNow() {
        for (const b of bossStateFor(level).values()) {
            if (b.removed) continue;
            renderBossTotem(b);
        }
    }

    /**
     * `Entity.onScreen(20)` for one shot, three-valued.
     *
     * ⚠ SEPARATE FROM `onScreenNow`, which THROWS on uncertain. Here the
     * uncertainty has a caller that can say something more useful about it
     * than "move the stance" — so the verdict is returned and
     * `stepBossShotsNow` owns the refusal with the shot's own diagnosis.
     */
    const bossShotOnScreenVerdict = (s) => {
        const box = bossTotemShotRect(s);
        const margin = BOSS_TOTEM_SHOT.onScreenMargin;
        if (camBand === null) return camOnScreen(box, cam, margin) ? 'on' : 'off';
        return onScreenUnderShake(box, camBand, margin);
    };

    /**
     * `Projectiles/Explosion.added()` — the SQUARE prefilter, then the
     * origin-to-origin disc. One call site for both blasts this room can
     * produce (a shot's r=15.6 and the boss's own r=52), because they differ
     * in exactly the radius and the point.
     *
     * ⛔ ORIGIN TO ORIGIN, NOT RECT OVERLAP (§8.10): the prefilter is a
     * 104x104 box and the test that follows is `FP.distance(x, y, c.x, c.y)
     * <= radius`, so a player 60 px away diagonally passes the box and fails
     * the disc. Both are computed, and the pair is asserted to disagree in
     * the suite — a model that stopped at the prefilter would report a hit
     * 21 px outside the blast.
     */
    function applyExplosion({ x, y, radius, damage: d, force, source, id }) {
        // The prefilter is `collideRectInto`, i.e. RECT vs the player's BOX.
        const inSquare = rectsOverlap(
            playerBoxAt(state.x, state.y),
            rect(x - radius, y - radius, radius * 2, radius * 2),
        );
        // ...and the test that decides is the player's ORIGIN against the
        // blast's, which is a strictly smaller set and a different shape.
        const hit = inSquare
            && Math.sqrt((state.x - x) ** 2 + (state.y - y) ** 2) <= radius;
        bossBlasts.push({
            t: ticksCompleted + 1, level, source, id, x, y, radius,
            inSquare, hitPlayer: hit,
        });
        if (!hit) return;
        applyPlayerHit({ source, id, force, damage: d, from: { x, y } });
    }

    /**
     * ⛓⛓⛓ R6 SLICE 5: ONE `ShieldBoss.update()`, IN ITS OWN SLOT.
     *
     * `Game.loadlevel` adds the spinners at `:2250`, the shieldboss at
     * `:2222`, the pushables at `:2216-2218` and the Player at `:2092`, and
     * `World.addUpdate` PREPENDS — so the update list runs
     *
     *     spinner -> SHIELDBOSS -> pushables -> … -> Player
     *
     * and this call sits between the two for that reason. ⚠ L19 is the only
     * room with a ShieldBoss and it holds no spinner and no block, so the
     * placement is UNOBSERVABLE today; it is placed correctly anyway,
     * because the alternative is a slot chosen by convenience that a second
     * instance would silently invalidate.
     *
     * ⛔⛔ AND IT IS ABOVE THE CEREMONY'S EARLY RETURN — with the strongest
     * version of the crusher's reason and a REFUSAL attached.
     * `ShieldBoss.hitPlayer` is reached from `Enemy.update`'s tail, which
     * has no `Game.freezeObjects` test anywhere above it, so the 120-update
     * stand-under counter runs through a pickup's frozen frames at full
     * speed. This model does NOT step frozen frames one at a time — phase A
     * of a ceremony is a lump in `frozenFramesOwed` — so a ceremony begun
     * beside a live ShieldBoss would advance the game's counter by 150 and
     * the model's by nothing. `assertNoCeremonyBesideShieldBoss` refuses
     * that outright rather than approximating it.
     */
    function stepShieldBossesNow() {
        const st = shieldBossStateFor(level);
        if (st.size === 0) return;
        const box = playerBoxAt(state.x, state.y);
        for (const b of st.values()) {
            if (b.removed) continue;
            const body = shieldBossBodyRect(b);
            const before = { hits: b.hits, tagWritten: b.tagWritten, removed: b.removed };
            const r = stepShieldBoss(b, {
                playerBox: box,
                // `Enemy.update`'s first line, and `activeOffScreen` is
                // false on this class — so a boss the camera has lost stops
                // counting, stops damaging and stops draining its i-frame.
                // ⚠ `onScreenNow` THROWS on an uncertain band rather than
                // guessing; L19's geometry keeps him 24 px clear of the
                // nearest screen edge at the camera's worst clamp, which is
                // asserted in `shieldFight.test.js` as a measured minimum.
                onScreen: onScreenNow(body, `shieldboss ${b.id}`),
                // `Enemy.getState()` — `nearestToPoint("Tile", x, y)`, the
                // ENTITY point. L19 is t=5 under him and `stepShieldBoss`
                // throws on the three lethal ones rather than passing.
                tileT: world.nearestWalkableTile(b.x, b.y)?.t ?? 0,
                playerDist: Math.sqrt((state.x - b.x) ** 2 + (state.y - b.y) ** 2),
            });
            if (r.startedStab) {
                shieldBossStabs.push({
                    t: ticksCompleted, level, id: b.id, retaliation: false,
                    ...shieldBossWindowRow(ticksCompleted),
                });
            }
            shieldBossBand.push({
                t: ticksCompleted,
                level,
                id: b.id,
                inBand: r.bandOccupied,
                swingTime: r.swingTime,
                anim: r.anim,
                hitsTimer: b.hitsTimer,
            });
            // `hitPlayer`'s damage arm — one call per damaging frame, and
            // the PLAYER's own i-frames are what stop the rest.
            for (let i = 0; i < r.hitCalls; i += 1) {
                applyPlayerHit({
                    source: 'shieldBossStab',
                    id: b.id,
                    force: SHIELD_BOSS.swingForce,
                    damage: SHIELD_BOSS.damage,
                    from: { x: b.x, y: b.y },
                });
            }
            // ⛔ THE REMOVAL IS WHAT OPENS THE ROOM, and it is eleven ticks
            // after `destroy`. Banked here so `earnedClears` can spend it and
            // so a window can assert the wall's last live tick.
            if (r.removeRequestedNow) {
                shieldBossKills.push({
                    t: ticksCompleted, level, id: b.id,
                    what: 'removeRequested', tagTick: b.tagTick ?? null,
                });
            }
            // `World.update` calls `e._graphic.update()` AFTER `e.update()`
            // in the same pass and OUTSIDE `if (e.active)` — so the anim
            // advances here, below the entity step and ABOVE the player's.
            // ⛔ AND `destroy` IS SET IN THAT CALL, not in `update()`:
            // `endAnim` is the Spritemap's callback. A ledger row written
            // from the entity step would be one tick late.
            const wasDestroyed = b.destroy;
            advanceShieldBossGraphic(b);
            if (b.destroy && !wasDestroyed) {
                shieldBossKills.push({
                    t: ticksCompleted, level, id: b.id,
                    what: 'destroy', tagTick: b.tagTick ?? null,
                });
            }
        }
    }

    /**
     * ⛓⛓⛓ R6 SLICE 6f: ONE FRAME OF L112, IN THE GAME'S OWN ORDER.
     *
     * `Game.loadlevel` adds the Player at `:2101`, the FinalBoss at `:2135`,
     * the orb at `:2217` and the pods at `:2252`, and `World.addUpdate`
     * PREPENDS — so the update list is
     *
     *     [runtime rocks/grenades, newest first]  ->  pods  ->  …
     *       ->  orb  ->  rocklock  ->  FINALBOSS  ->  …  ->  Player LAST
     *
     * and every one of those positions is load-bearing:
     *
     *   1. ⛔ THE ROCKS UPDATE BEFORE THE BOSS, so a rock that lands on tick
     *      N raises the `Game.shake` that tick N's own `view()` reads. That is
     *      the feedback loop the draw schedule is built around (§16.8) — the
     *      rock's `scale` is a draw, the shake it adds is that draw, and the
     *      jiggle it keeps alive costs two more every frame.
     *   2. ⛔ THE PODS' ANIMATIONS ADVANCE BEFORE THE BOSS READS THEM, so his
     *      `pods[cpod].open` getter sees this tick's frame and not last
     *      tick's — 22 updates of `open`/`close` in the wrong direction is a
     *      whole barrage's phase.
     *   3. ⛔ THE PLAYER MOVES LAST, so every position the boss reads (the
     *      barrage's aim, the grenade's spawn) is the player's from the END of
     *      the previous tick, and every sword hit the player deals lands
     *      AFTER this function returns. `applyThrust` is called from the
     *      player's slot for exactly that reason.
     *
     * ⛓ AND `view()` IS NOT IN HERE. The jiggle's two draws are a property of
     * the FRAME, not of the boss — they fire on ticks he is frozen, dead and
     * coasting — so they are spent at the camera step, below the player, where
     * `Game.update` really calls `view()`. `owlJiggleNow` is that call.
     *
     * @returns {{frozen: boolean}} `frozen` is the INTRO's freeze, which is a
     *   `Game.talking` freeze and therefore TAPE TICKS rather than dead frames
     *   (`canInventory()` is false while `Game.talking`, and the else-arm
     *   `inventory.open = false` IS `Game.freezeObjects = false`).
     */
    function stepOwlNow({ held: heldPrimary, wasHeld: wasHeldPrimary }) {
        const { bosses, pods } = owlStateFor(level);
        if (bosses.size === 0) return { frozen: false };
        const stream = owlStreamFor(level);
        // `updateLists()`'s ADD half, drained at the TOP of the following tick
        // — the `pendingSeedAdds` convention, for the same reason: a tick can
        // leave through four different returns and the bottom is only one.
        if (owlPendingRocks.length > 0) {
            owlRocks = [...owlPendingRocks, ...owlRocks];
            owlPendingRocks = [];
        }
        if (owlPendingGrenades.length > 0) {
            owlGrenades = [...owlPendingGrenades, ...owlGrenades];
            owlPendingGrenades = [];
        }
        const frozenByCeremony = ceremony !== null;
        const drawsBefore = stream.count;
        const playerBox = playerBoxAt(state.x, state.y);

        // ── 1a. the rocks, newest first ────────────────────────────────
        //
        // ⛓ `RockFall.added()` sets `solids = []` on BOTH sides of its own
        // overlap test, so the fall collides with nothing and the landing tick
        // is a pure function of the constants: n = 16, for every scale and
        // every aim (`rockFallUpdatesToLand`).
        let rockSpawnedThisTick = false;
        for (const r of owlRocks) {
            if (!frozenByCeremony) {
                const res = stepRockFall(r);
                if (res.landed) {
                    // `Game.shake += sprRockFall.scale + 1` — the ONE writer on
                    // the roster with no constant, because its amount is the
                    // draw that made the rock (`camera.SHAKE_WRITERS`).
                    shake = applyShakeWriter(shake, 'rockFallLanding', res.shake);
                    const box = rockFallBox(r);
                    // `var p:Player = collide("Player", x, y); if (p) p.hit(...)`
                    // — the landing tick only, and the box is the TWICE-
                    // truncated one (trap 108: `setHitbox` takes ints and the
                    // second call re-derives its origins from the first's).
                    const hits = rectsOverlap(box, playerBox);
                    owlRockLandings.push({
                        t: ticksCompleted, level, id: r.id, x: r.x, y: r.y,
                        scale: r.scale, box, shake: res.shake, hitPlayer: hits,
                    });
                    if (hits) {
                        applyPlayerHit({
                            source: 'owlRock',
                            id: r.id,
                            force: ROCK_FALL.force,
                            damage: ROCK_FALL.damage,
                            from: { x: r.x, y: r.y },
                        });
                        if (pendingDeath) return { frozen: false };
                    }
                }
            }
            // ⛓ THE GRAPHIC IS NEVER FREEZE-GATED (`World.update` advances it
            // outside the `e.active` test), so a break animation keeps running
            // through a ceremony and the rock still leaves on schedule.
            advanceRockFallGraphic(r);
        }

        // ── 1b. the grenades, newest first ─────────────────────────────
        for (const g of owlGrenades) {
            stepOwlGrenade(g);
            const cb = advanceOwlGrenadeGraphic(g);
            if (cb === 'exploded') {
                // `animEnd`'s "explode" arm: `FP.distance(x, endY, p.x, p.y)
                // <= hitRadius` against the player's ENTITY point, read at the
                // grenade's slot — i.e. from the end of the previous tick.
                // ⛔ THROUGH `owlGrenadeReaches`, NOT A SECOND COPY OF IT:
                // `FP.distance` is `sqrt(dx*dx + dy*dy)` and `Math.hypot` is
                // not the same double (slice 6h, trap 118). `dist` is the
                // record; the VERDICT is the fight module's own.
                const dist = pointDistance(g.x, g.y, state.x, state.y);
                const reaches = owlGrenadeReaches(g, state.x, state.y);
                owlGrenadeEvents.push({
                    t: ticksCompleted, level, id: g.id, what: 'exploded',
                    x: g.x, y: g.y, dist, hitPlayer: reaches,
                });
                if (reaches) {
                    applyPlayerHit({
                        source: 'owlGrenade',
                        id: g.id,
                        force: GRENADE.force,
                        damage: GRENADE.damage,
                        from: { x: g.x, y: g.y },
                    });
                    if (pendingDeath) return { frozen: false };
                }
            } else if (cb === 'removed') {
                owlGrenadeEvents.push({
                    t: ticksCompleted, level, id: g.id, what: 'removed',
                    x: g.x, y: g.y, dist: null, hitPlayer: false,
                });
                assertGrenadeRemovalOpensNothing(g);
            }
        }

        // ── 1c. the pods' animations ───────────────────────────────────
        for (const p of pods) advancePodGraphic(p);
        /**
         * ⛔⛔⛔ THE PIN, AS A REFUSAL — and it survives `noDamage`.
         *
         * `Pod.update`'s arm is `p.x = x; p.y = y; p.v.x = p.v.y = 0;` and
         * THEN `p.hit(null, 0, null, 1)`. The three position writes are ABOVE
         * the `hit`, so `Bot.noDamage` — which returns at the top of
         * `Player.hit` — suppresses the heart and leaves the TELEPORT, and the
         * re-snap runs on every tick of overlap. A pinned player cannot walk
         * out at any `noDamage` setting, which is why `hazards.js` files the
         * volume `hard-avoid` on a damage of one.
         *
         * ⇒ this rung AVOIDS the cell by construction and asserts it rather
         * than modelling the pin. A tape that lands in one is not a tape that
         * takes a heart; it is a tape whose every later position is a fiction.
         */
        for (const p of pods) {
            if (!podIsLethal(p)) continue;
            const box = { x: p.x - 8, y: p.y - 8, right: p.x + 8, bottom: p.y + 8 };
            if (!rectsOverlap(box, playerBox)) continue;
            throw new Error(`levelRun: the player is inside ${p.id}'s 16x16 cell at tick `
                + `${ticksCompleted} in level ${level} with its animation "closed". `
                + '`Pod.update` writes `p.x`/`p.y`/`p.v` ABSOLUTELY on every tick of '
                + 'overlap and the writes sit ABOVE `p.hit`, so `Bot.noDamage` leaves the '
                + 'TELEPORT and a pinned player cannot walk out at any setting. This rung '
                + 'avoids the four pod cells by construction. Move the stance.');
        }

        // ── 1d. the boss, then his graphic — one pass, both calls ──────
        const b = [...bosses.values()][0];
        /**
         * ⚠ A LONGER SPAN IS STILL REFUSED, AND THE REASON HAS CHANGED.
         *
         * §19.5 refused it because two candidate mechanisms disagreed on it.
         * Slice 6g SETTLED the mechanism (see `introRelease` below) and the
         * ambiguity is gone: the intro ends on the RELEASE, wherever it falls.
         * What is left is that no arm has ever driven a longer one, so the
         * refusal stays as an unmeasured-shape guard rather than as a
         * this-model-cannot-decide one.
         */
        if (!b.started && heldPrimary && wasHeldPrimary) {
            throw new Error(`levelRun: the tape holds \`primary\` across tick `
                + `${ticksCompleted} while the Owl's intro is still up. The intro ends on `
                + 'the span\'s RELEASE edge (§21, measured), so a longer span is '
                + 'predictable — but no arm has driven one, so it is refused rather than '
                + 'assumed. Use a one-tick `primary` span for the intro.');
        }
        const wasDestroyed = b.destroy;
        /**
         * ⛓⛓⛓ R8 SLICE 0: HOISTED AND BRANDED — the worst `liveSolidOpts`
         * site in the file. `solidAt` below is called for every 1 px probe of
         * the Owl's own move sweep, and each call rebuilt all fourteen
         * per-visit views and handed `levelWorld` a fresh bag to normalise.
         *
         * ⚠ ONCE PER TICK IS THE SAME BAG, and that is a claim about what
         * `stepFinalBoss` may do: nothing inside it moves a per-visit
         * geometry family. `spawnRock` queues into `owlPendingRocks`, which
         * `fallenRocksNow` does not read until a rock has LANDED, and
         * `spawnGrenade` touches no solid at all. The differential is what
         * says so — this is the reasoning, not the evidence.
         */
        const owlOpts = normalizeLiveOpts(liveSolidOpts());
        const step = stepFinalBoss(b, {
            frozen: frozenByCeremony,
            // The player as the boss sees them: the END of the previous tick,
            // because he updates first.
            player: { x: state.x, y: state.y, vx: state.vx, vy: state.vy },
            solidAt: (x, y) => !!world.collidesSolid(finalBossBox(x, y), owlOpts),
            firstTileAt: (x, y) => firstTileUnder(world.tiles, finalBossBox(x, y)),
            stream,
            spawnRock: (argX, argY, scale) => {
                rockSpawnedThisTick = true;
                owlSpawnSeq += 1;
                owlPendingRocks.push(createRockFall(argX, argY, scale,
                    { id: `rock${owlSpawnSeq}@${ticksCompleted}` }));
            },
            spawnGrenade: (x, y) => {
                owlSpawnSeq += 1;
                // `new Grenade(x - 8, y - 8, true, 30)` — and the two half
                // tiles cancel, so the grenade is born at the Owl's own entity
                // point. `createOwlGrenade` takes that point.
                owlPendingGrenades.push(createOwlGrenade(x + 8, y + 8,
                    { id: `grenade${owlSpawnSeq}@${ticksCompleted}` }));
                owlGrenadeEvents.push({
                    t: ticksCompleted, level, id: `grenade${owlSpawnSeq}@${ticksCompleted}`,
                    what: 'spawned', x: x + 8, y: y + 8, dist: null, hitPlayer: false,
                });
            },
            pods: pods.map((p, i) => ({
                get open() { return p.anim === 'open' || p.anim === 'opened'; },
                set open(v) { setPodOpen(p, v); },
                x: FINAL_BOSS.podPositions[i].x,
                y: FINAL_BOSS.podPositions[i].y,
            })),
            /**
             * ⛔⛔⛔ R6 SLICE 6g: THE INTRO ENDS ON THE SPAN'S `to`, AND §19.5
             * WAS TWO OFF-BY-ONES THAT CANCELLED.
             *
             * `FinalBoss.as:88` reads `Input.released(p.keys[6])` and it means
             * exactly what it says: `Bot` dispatches the DOWN edge on `from`
             * and the UP edge on `to`, `Input.onKeyUp` is the only writer of
             * `_release`, and `Input.update()` runs at the END of the engine
             * frame — so the release is live on `to` and on no other frame.
             *
             * §19.5 read the intro as ending on `from` because the boss's
             * polled position said he was one 0.5303 px step further along
             * than a release on `to` permits. He was — and the step is not
             * his, it is the tape's: `Bot.update` records observation `N` and
             * DISARMS at the top of the frame whose world update then runs
             * anyway, so an N-tick tape performs **N + 1** world updates and
             * the poll sees the extra one. An intro one tick early and a run
             * one frame short agree on every quantity §19.4 could measure —
             * the polled draw count and the polled boss position — and
             * disagree only on WHICH TICK anything happens.
             *
             * ⛓⛓⛓ WHAT SEPARATED THEM IS `botStatus.slash.tests`, AND IT
             * READS **0**. Under the `from` reading the boss lowers the freeze
             * above the player on the very tick `Input.pressed` is live, so
             * the press reaches `useItem` and the fight opens with a shove
             * (§20.3). Under the `to` reading the freeze is still up when the
             * player updates on `from`, and on `to` the edge is a release —
             * so the press is swallowed at both ends and NOTHING slashes. The
             * game ran the plan's first press and counted zero hit tests.
             * → §21, and [[feedback_two_offbyones_that_cancel]]
             */
            introRelease: wasHeldPrimary && !heldPrimary,
        });
        for (const e of step.events) {
            if (e.what === 'lava') {
                const verdict = finalBossLavaVerdict(world.tiles, e.x, e.y);
                finalBossLava.push({
                    t: ticksCompleted, level, id: b.id, x: e.x, y: e.y,
                    hits: e.hits, landed: e.landed, killed: e.killed, why: e.why,
                    firstT: verdict.firstT, wholly: verdict.wholly,
                    touching: verdict.touching, overlapped: verdict.overlapped,
                });
                if (e.killed) {
                    const sched = finalBossDeathSchedule(ticksCompleted);
                    finalBossKills.push({
                        t: ticksCompleted, level, id: b.id, what: 'kill',
                        x: e.x, y: e.y,
                        dieEndsAt: sched.dieEndsAt,
                        tagTick: sched.tagTick,
                        ticksFromKill: sched.ticksFromKill,
                    });
                }
            }
        }
        // `World.update` calls `e._graphic.update()` AFTER `e.update()` in the
        // same pass and OUTSIDE `if (e.active)` — so the die/dead chain
        // advances on ticks the boss himself returns early from, which is
        // every tick after `startDeath`.
        let deathArmFired = false;
        for (const e of advanceFinalBossGraphic(b)) {
            if (e.what === 'dieAnimEnded') {
                finalBossKills.push({
                    t: ticksCompleted, level, id: b.id, what: 'dieAnimEnded',
                });
            } else if (e.what === 'deadAnimEnded') {
                /**
                 * `endAnim`'s "dead" arm, in ITS OWN ORDER: five RockFalls
                 * (ten draws), then `Button.activateAll(null, 0, true)`, then
                 * BOTH persistence writes.
                 *
                 * ⛔ THE SECOND FLAG IS A DIRECT WRITE. `setPersistence(tag+1)`
                 * is its own line; the button sweep beside it opens the same
                 * `rocklock@112,16 {tset 0}` by its GROUP and the tag does not
                 * depend on the sweep reaching anything. Two mechanisms, one
                 * arm, and the ledger records the flag rather than the lock.
                 */
                deathArmFired = true;
                for (let i = 0; i < 5; i += 1) {
                    const argX = stream.deathRockX();
                    const scale = stream.rockScale();
                    owlSpawnSeq += 1;
                    owlPendingRocks.push(createRockFall(argX, (i / 5) * 32, scale,
                        { id: `deathrock${i}@${ticksCompleted}` }));
                }
                for (const tag of [b.tag, b.tag + 1]) {
                    const flag = outOfBandFlagFor(level, tag);
                    finalBossFlags.set(ledgerKey(flag), { ...flag, id: b.id, level });
                    if (!pendingEarnedClears.has(flag.level)) {
                        pendingEarnedClears.set(flag.level, new Set());
                    }
                    pendingEarnedClears.get(flag.level).add(flag.tag);
                }
                finalBossKills.push({
                    t: ticksCompleted, level, id: b.id, what: 'tagsWritten',
                    flags: [{ level, tag: b.tag }, { level, tag: b.tag + 1 }],
                });
            }
        }
        if (b.destroy && !wasDestroyed) {
            finalBossKills.push({
                t: ticksCompleted, level, id: b.id, what: 'startDeath', x: b.x, y: b.y,
            });
        }

        // ── `Enemy.update`'s TAIL: `hitPlayer()` ──────────────────────
        //
        // ⛔ THE OWL TAKES IT UNCHANGED — the 12x12 box at force 3, damage 1,
        // gated on `hitsTimer <= 0` and `currentAnim != "die"`. `Bot.noDamage`
        // is what makes it byte-inert for every pre-R6 tape, so the scan is
        // behind the flag exactly as `stepContactsNow`'s is.
        //
        // ⚠ AND IT SITS ONE STATEMENT LATE, WITH THE COUPLING NAMED. In the
        // game `hitPlayer()` is inside `super.update()`, i.e. ABOVE the lava
        // test and the phase arms — so a contact that knocks the player back
        // changes the `p.v` the barrage's aim then reads, on that same tick.
        // Reaching that ordering needs `stepFinalBoss` split in two, and the
        // case is unreachable while the pods are avoided (a contact during a
        // barrage means standing on a boss who is sitting in a pod cell). It
        // is REFUSED rather than approximated.
        if (!noclip && !noDamage && !b.destroy && b.hitsTimer <= 0 && !frozenByCeremony) {
            if (rectsOverlap(finalBossBox(b.x, b.y), playerBox)) {
                if (rockSpawnedThisTick) {
                    throw new Error(`levelRun: the Owl's body touched the player at tick `
                        + `${ticksCompleted} on a tick that also SPAWNED a rock. In the `
                        + 'game `hitPlayer()` runs inside `super.update()`, above the '
                        + "phase arms, so the knockback would change the `p.v` the "
                        + 'barrage aim reads on this very tick — and this model runs the '
                        + 'contact after the arms. Refused rather than approximated.');
                }
                applyPlayerHit({
                    source: 'owlBody',
                    id: b.id,
                    force: PLAYER_DAMAGE.contactForce,
                    damage: 1,
                    from: { x: b.x, y: b.y },
                });
                if (pendingDeath) return { frozen: false };
            }
        }

        /**
         * ⛔⛔⛔ THE CORPSE, AS A REFUSAL PLUS A POSITIVE WITNESS (trap 101).
         *
         * `startDeath` writes `type = "Solid"` and `death()` is an EMPTY
         * override, so the body is a wall at the third shove's endpoint for
         * the rest of the visit. This package does NOT carry it as a
         * live-geometry key — the bound is named: no committed tape moves
         * after the kill (W-owl stands still for the 109 ticks to the tags),
         * so a 15th key would have no witness and `LIVE_GEOMETRY_KEYS`' own
         * lesson is that an unwitnessed key is worse than none. What guards
         * the bound is this: any overlap throws, and the CLEARANCE is recorded
         * every tick so a plan can assert the wall really was there.
         */
        if (b.destroy) {
            const corpse = finalBossBox(b.x, b.y);
            const clearance = distanceRectPoint(state.x, state.y, corpse);
            finalBossCorpse.push({
                t: ticksCompleted, level, id: b.id, rect: corpse, clearance,
            });
            if (rectsOverlap(corpse, playerBox)) {
                throw new Error(`levelRun: the player's box overlaps the Owl's CORPSE at `
                    + `tick ${ticksCompleted} in level ${level}. \`startDeath\` set `
                    + '`type = "Solid"` and `death()` is an empty override, so the body '
                    + 'is a permanent wall where the third shove left it — and this rung '
                    + 'does not carry it as a live-geometry key, because no tape needed '
                    + 'to. Choose a third endpoint that seals nothing, or add the key.');
            }
        }

        // ── `updateLists()`'s REMOVE half ─────────────────────────────
        owlRocks = owlRocks.filter((r) => !r.removeRequested);
        owlGrenades = owlGrenades.filter((g) => !g.removeRequested);

        /**
         * ⛔⛔ THE SCHEDULE, CHECKED AGAINST ITSELF — the one-table-two-
         * computations law on a DRAW COUNT.
         *
         * `owlTickDraws(phase, shaking)` walks `OWL_PHASE_SITES` and counts;
         * `stream.count` is what the fight actually booked. They are two
         * computations of one number and a disagreement is the §19.2 defect
         * (a census of SITES that does not discharge a schedule of TICKS)
         * happening again — so it throws by name here rather than surfacing as
         * a rock 40 px from where the game put it.
         *
         * ⚠ THE JIGGLE IS NOT IN THIS COMPARISON. It is spent below the
         * player, at `view()`, so `shaking: false` is right for this call and
         * `owlJiggleNow` makes its own assertion.
         */
        const spent = stream.count - drawsBefore;
        /**
         * ⛔⛔ AND THE DEATH ARM IS A SECOND ROW ON THE SAME TICK, WHICH IS
         * WHAT THIS CHECK CAUGHT ON ITS FIRST RUN.
         *
         * `OWL_PHASE_SITES` is keyed on the arm the BOSS's `update()` took,
         * and on the tag tick that arm is `frozen` — `destroy` is set, so he
         * returns right after `super.update()` and costs the stream nothing.
         * The ten draws come from the GRAPHIC: `endAnim`'s "dead" arm, in the
         * same pass, five rocks at two draws each. So a tick's site list is
         * `phase ++ (deathAnim if the callback fired) ++ jiggle`, and reading
         * the phase alone is one row short exactly once per fight.
         *
         * ⛓ Found by the check rather than by a recording, which is the whole
         * reason it is a throw and not a log — §19.2's defect (a census of
         * SITES that does not discharge a schedule of TICKS) recurring inside
         * the very slice that banked the lesson.
         */
        const owed = owlTickDraws(step.phase, false)
            + (deathArmFired ? owlTickDraws('deathAnim', false) : 0);
        if (spent !== owed) {
            throw new Error(`levelRun: the Owl's tick ${ticksCompleted} took phase `
                + `"${step.phase}"${deathArmFired ? ' + the death arm' : ''}, which `
                + `\`OWL_PHASE_SITES\` prices at ${owed} draw(s), and the stream booked `
                + `${spent}. The schedule and the sites disagree — which is §19.2's `
                + 'defect (a census of sites is not a schedule of ticks) recurring. Fix '
                + 'the table, not this check.');
        }
        owlTicks.push({
            t: ticksCompleted,
            level,
            phase: step.phase,
            deathArm: deathArmFired,
            draws: spent,
            shake,
            streamCount: stream.count,
            bossX: b.x,
            bossY: b.y,
            hits: b.hits,
            rockfallTime: b.rockfallTime,
            cpod: b.cpod,
            rocks: owlRocks.length,
            grenades: owlGrenades.length,
        });
        return { frozen: step.introFreeze };
    }

    /**
     * `view()`'s two draws, spent where `Game.update` really spends them.
     *
     * ⛔ ONE CALL PER FRAME AND IT IS BELOW EVERY ENTITY. `Game.as:1879-1880`
     * is `FP.camera.x += shake * Math.random() - shake / 2` and the same for
     * `y`, with the decay `shake = Math.max(shake - 1, 0)` on the line after —
     * so the draws are made against the shake AFTER every rock that landed
     * this tick has added to it, and the decay is once per FRAME however many
     * landed.
     *
     * ⚠ THE CAMERA STAYS A BAND. §11.6's carry: the jiggle's VALUES are
     * modelled now, and `stepCameraBand` still keeps the interval, because
     * `onScreen` within 9 px of a screen edge is a refusal either way and
     * collapsing the band would be a second change with no witness. What this
     * function owns is the STREAM POSITION, which is the quantity the fight
     * reads.
     */
    function owlJiggleNow() {
        if (owlStream === null || level !== owlStreamLevel) return;
        if (shake <= 0) return;
        const before = owlStream.count;
        owlStream.jiggle(shake);
        if (owlStream.count - before !== 2) {
            throw new Error('levelRun: the Owl room\'s jiggle spent '
                + `${owlStream.count - before} draws, and \`view()\` makes exactly two.`);
        }
    }

    /**
     * ⛓ A grenade's REMOVAL moves `classCount(Grenade)`, and `Grenade` IS in
     * `totalEnemies()` — so the scan is computed rather than skipped, on the
     * `IceTurret` arm's law: "there were no kill locks" and "nobody looked"
     * print the same thing.
     *
     * ⚠ AND THE ANSWER FOR L112 IS NIL FOR A REASON THAT IS NOT THE COUNT.
     * The room's one lock is `rocklock@112,16 {tset 0}` — a GROUP lock, not a
     * `tset == -1` kill lock — so nothing in the room reads `totalEnemies()`
     * at all. Computed from the level record so the nil is a measurement.
     */
    function assertGrenadeRemovalOpensNothing(g) {
        const census = world.combat?.enemies ?? null;
        const roster = (census ?? []).filter((e) => !e.removed).map((e) => ({ as3: e.as3 }));
        // The grenade is a RUNTIME body and is in no census; both sides of the
        // ledger therefore carry the placed roster and the difference is the
        // one entity this removal takes out.
        const led = killLockLedger(levelSource(level), {
            bodiesBefore: [...roster, { as3: 'Grenade' }],
            bodiesAfter: roster,
        });
        if (!led.nil) {
            throw new Error(`levelRun: ${g.id}'s removal at tick ${ticksCompleted} OPENS `
                + `${led.opens.length} kill lock(s) in level ${level} (${led.why}) — a `
                + 'blocker the walk did not earn. The Owl\'s grenades are spawned by his '
                + 'own script, so this would be a route change nothing asked for.');
        }
    }

    /**
     * ⛔ `Player.slash`'s SECOND filter, and the reason it is an assertion
     * rather than a model.
     *
     * ```as3
     *   if (!FP.world.collideLine("Solid", x, y, v[i].x, v[i].y)
     *       || hasGhostSword || v[i].type == "Solid" || … )
     * ```
     *
     * `collideLine` is FlashPunk's Bresenham walk over the "Solid" type
     * list, and this body's type is `"ShieldBoss"` — so the waiver does NOT
     * apply to him and the line really is consulted. Implementing a general
     * `collideLine` is a whole mover; what this does instead is walk the
     * segment from the player's point to his ENTITY point at 1 px and refuse
     * if any Solid is on it. Exact for a straight line, and it refuses
     * loudly rather than assuming the arena is open.
     */
    /**
     * ⛔ `Player.slash`'s line-of-sight gate, for the Owl.
     *
     * `if (!FP.world.collideLine("Solid", x, y, v[i].x, v[i].y) || hasGhostSword
     * || v[i].type == "Solid" || v[i].type == "Rope" || v[i] is Flyer)` — and
     * the Owl's `type` is `"Enemy"`, so NONE of the three waivers fires and
     * the line really is consulted. Same treatment as the Shieldspire's: walk
     * the segment at 1 px and refuse loudly rather than assume the arena is
     * open.
     *
     * ⛓ AND THE ARENA IS OPEN — that is what makes this cheap. L112's only
     * `"Solid"` tiles are its walls and the `rocklock`; the whole lava octagon
     * and its `t == 16` ring are walkable floor, so a stance adjacent to the
     * boss anywhere in the arena has a clear line. The check exists because
     * the CORPSE's type becomes `"Solid"` and a second Owl-shaped wall in the
     * middle of the room is exactly the thing a later press would be blocked
     * by.
     */
    function assertFinalBossLineOfSight(b) {
        const blocker = collideLineSolid(state.x, state.y, b.x, b.y);
        if (blocker) {
            throw new Error(`levelRun: the swing at (${state.x}, ${state.y}) reaches `
                + `${b.id}'s rect but \`collideLine("Solid", …)\` finds `
                + `${blocker.tag ?? 'a Solid'} at (${blocker.at.x}, ${blocker.at.y}) on `
                + `the line to his entity point (${b.x}, ${b.y}). \`Player.slash\`'s `
                + 'line-of-sight gate REFUSES that hit — the type waivers do not fire for '
                + 'an `"Enemy"` — so the shove would land in the model and miss in the '
                + 'game. Re-aim the stance.');
        }
    }

    function assertShieldBossLineOfSight(b) {
        const blocker = collideLineSolid(state.x, state.y, b.x, b.y);
        if (blocker) {
            throw new Error(`levelRun: the swing at (${state.x}, ${state.y}) reaches `
                + `${b.id}'s rect but \`collideLine("Solid", …)\` finds `
                + `${blocker.tag ?? 'a Solid'} at (${blocker.at.x}, ${blocker.at.y}) on `
                + `the line to his entity point (${b.x}, ${b.y}). \`Player.slash\`'s `
                + 'line-of-sight gate REFUSES that hit — the `v[i].type == "Solid"` '
                + 'waiver does not apply to a body whose type is "ShieldBoss" — so the '
                + 'swing would land in the model and miss in the game. Re-aim the stance.');
        }
    }

    /**
     * ⛔⛔⛔ `FP.world.collideLine("Solid", …)` — A **FOURTH** SOLIDS LIST,
     * AND THE NARROWEST ONE ON THE ARC.
     *
     * `levelWorld`'s own header names three (`Player.solids`,
     * `Crusher.solids`, `IceTurretBlast.hitables`). This is a fourth, and it
     * is not `Mobile.solids` at all: `collideLine` takes ONE TYPE STRING, so
     * a `Tree`, a `Rope`, a `LavaBoss` — and the ShieldBoss's own body,
     * whose type is `"ShieldBoss"` — are all INVISIBLE to it. ⚠ The first
     * cut of this check asked `world.collidesSolid`, which is the PLAYER's
     * list, and refused every swing in the room because the boss blocked the
     * line to himself. `solidBoxesForMover` already filters `cls.type !==
     * 'Solid'`, which is exactly the set this wants.
     *
     * Transcribed from `net/flashpunk/World.as`, three details included:
     *
     *   1. **the signature truncates.** `fromX:int … toY:int` — so a player
     *      at y 90.05 raycasts from y 90, and the fractional part the whole
     *      physics model carries is DROPPED at this one call;
     *   2. **the end point is exclusive.** The loop is `while (y > toY)`, so
     *      the target's own cell is never tested — which matters here,
     *      because the target's entity point is inside its own body;
     *   3. **`collidePoint` is half-open** (`>= left && < right`), which a
     *      1x1 box at integer coordinates reproduces exactly.
     *
     * @returns {?{tag: ?string, at: {x, y}}} the first blocker, or null
     */
    function collideLineSolid(fromXf, fromYf, toXf, toYf) {
        const fromX = Math.trunc(fromXf);
        const fromY = Math.trunc(fromYf);
        const toX = Math.trunc(toXf);
        const toY = Math.trunc(toYf);
        const boxes = world.solidBoxesForMover(normalizeLiveOpts(liveSolidOpts()));
        const at = (px, py) => {
            for (const s of boxes) {
                if (px >= s.x && px < s.right && py >= s.y && py < s.bottom) return s;
            }
            return null;
        };
        const xDelta = Math.abs(toX - fromX);
        const yDelta = Math.abs(toY - fromY);
        // `if (FP.distance(...) < precision)` with precision 1 — the short
        // sweep, which for a null `p` is `collidePoint(type, fromX, toY)`.
        // ⚠ THAT IS `fromX` WITH `toY`, a mixed pair, and it is verbatim.
        if (Math.hypot(toX - fromX, toY - fromY) < 1) {
            const s = at(fromX, toY);
            return s ? { tag: s.tag ?? null, at: { x: fromX, y: toY } } : null;
        }
        let x = fromX;
        let y = fromY;
        let xSign = toX > fromX ? 1 : -1;
        let ySign = toY > fromY ? 1 : -1;
        if (xDelta > yDelta) {
            ySign *= yDelta / xDelta;
            while (xSign > 0 ? x < toX : x > toX) {
                const s = at(x, y);
                if (s) return { tag: s.tag ?? null, at: { x, y } };
                x += xSign; y += ySign;
            }
        } else {
            xSign *= xDelta / yDelta;
            while (ySign > 0 ? y < toY : y > toY) {
                const s = at(x, y);
                if (s) return { tag: s.tag ?? null, at: { x, y } };
                x += xSign; y += ySign;
            }
        }
        return null;
    }

    /**
     * ⛔⛔⛔ `World.updateLists()` FOR THE SHIELDSPIRE — the one-tick
     * fencepost the game's own recording set.
     *
     * `Mobile.death`'s eleventh fade call runs `FP.world.remove(this)`,
     * which pushes to `_remove`; `Engine.update` drains it AFTER
     * `World.update`. The Player is added LAST (`Game.as:2092`) and so
     * updates LAST, which means the body is still in the `"ShieldBoss"`
     * type list for the player's own sweep on the request tick. ⇒ the wall
     * lasts one tick longer than the fade does.
     *
     * The first recording of `r6-shield-kill` is the witness: the model
     * walked north at tick 443 and the game was still pinned at y 90.05.
     * → [[feedback_destroy_is_not_removal]], one fencepost further along.
     */
    function drainShieldBossRemovals() {
        const st = shieldBossStateFor(level);
        if (st.size === 0) return;
        for (const b of st.values()) {
            if (!b.removeRequested || b.removed) continue;
            b.removed = true;
            shieldBossKills.push({
                t: ticksCompleted, level, id: b.id,
                what: 'removed', tagTick: b.tagTick ?? null,
            });
        }
    }

    /** The derived window row a stab publishes, for the ledger. */
    function shieldBossWindowRow(t) {
        const w = shieldBossWindowFor(t);
        return { windowFrom: w.windowFrom, windowTo: w.windowTo, stabFrom: w.stabFrom };
    }

    /**
     * ⛔ THE REFUSAL THE FREEZE ASYMMETRY EARNS.
     *
     * See `stepShieldBossesNow`. Called from the ceremony branch, so a tape
     * that collects anything in a room with a live Shieldspire fails BY NAME
     * instead of drifting 150 counter updates from the game.
     */
    function assertNoCeremonyBesideShieldBoss(what) {
        const st = shieldBossStateFor(level);
        for (const b of st.values()) {
            if (b.removed) continue;
            throw new Error(`levelRun: a ${what} ceremony began in level ${level} while `
                + `the ShieldBoss ${b.id} is still in the world. \`ShieldBoss.hitPlayer\` `
                + 'is not freeze-gated — its 120-update stand-under counter advances '
                + 'through every frozen frame — and this model spends a ceremony\'s '
                + 'phase A as a LUMP in `frozenFramesOwed` rather than as steps. So the '
                + 'game would count 150 updates the model counts none of. Collect after '
                + 'the removal, or step the freeze.');
        }
    }

    /**
     * The magical locks' own `animEnd`. Below the shots, above the player —
     * `Game.loadlevel` adds the player at `:2092` and the lock at `:2148`,
     * and `addUpdate` prepends.
     */
    function stepMagicalLocksNow() {
        const st = magicalLockStateFor(level);
        if (st.size === 0) return;
        for (const l of st.values()) stepMagicalLock(l, ticksCompleted);
    }

    /**
     * ⛓⛓⛓ R6 SLICE 3: `Player.hit(...)`, APPLIED — the ONE call site every
     * damage source in this run reaches.
     *
     * Six sources can reach `Player.hit` on this rung's roster (a body
     * contact, a pulse ring, an ice blast, a crusher, the totem's laser and
     * its shots) and they differ in exactly three arguments: the force, the
     * damage and the point. Everything else — the three-term gate, the
     * `hits` arithmetic, the i-frame window, the shake ADDITION, and the
     * die-or-knockback fork — is `Player.hit`'s own body and belongs in one
     * place, or the sixth source is where the fifth one's lesson gets lost.
     *
     * ⚠ THE VELOCITY IS WRITTEN INTO `state` HERE, BEFORE THE PHYSICS STEP,
     * because that is where the game writes it: the enemies update first,
     * so `friction()` decays the impulse on the SAME tick it lands.
     *
     * @returns the `playerHit` result, so a caller can see `died`/`applied`
     */
    function applyPlayerHit({ source, id, force = 0, damage: d = 1, from = null }) {
        const r = playerHit(damage, {
            hitsMax: inventory.hitsMax,
            force,
            damage: d,
            from,
            at: { x: state.x, y: state.y },
            direction: state.direction,
            noDamage,
            // ⛔ §10.6, ONE CLASS FURTHER ON: the gate is INSIDE `Player.hit`,
            // so a contact that lands inside a ceremony pays nothing at all
            // — no damage, no shake, no knockback and no i-frames. It is the
            // OPPOSITE of `hitUpdate`, which runs through the freeze.
            frozen: ceremony !== null,
            hasDarkSuit: !!inventory.hasDarkSuit,
        });
        if (!r.applied) {
            contactsSuppressed.push({
                t: ticksCompleted + 1, level, source, id, why: r.refusedAt,
            });
            return r;
        }
        damage = r.state;
        // `Game.shake += 5` — an ADDITION, and the only one of the roster's
        // three writers that is (`camera.SHAKE_WRITERS`).
        shake += r.shakeDelta;
        if (r.knockback) {
            state = {
                ...state,
                vx: state.vx + r.knockback.dx,
                vy: state.vy + r.knockback.dy,
            };
        }
        playerHits.push({
            t: ticksCompleted + 1,
            level,
            source,
            id,
            hits: r.state.hits,
            hitsMax: inventory.hitsMax,
            died: r.died,
            shake,
            knockback: r.knockback
                ? { dx: r.knockback.dx, dy: r.knockback.dy, landed: r.knockback.landed }
                : null,
        });
        if (r.died) {
            pendingDeath = {
                t: ticksCompleted + 1, level, source, id, hits: r.state.hits,
            };
        }
        return r;
    }

    /**
     * ⛓⛓⛓ R6 SLICE 3: `Enemy.hitPlayer()` FOR EVERY STATIC BODY IN THE ROOM.
     *
     * ⛔ ONLY WHEN THE TAPE HAS RETIRED `noDamage`, and that is not an
     * optimisation. Under the flag `Player.hit` returns at its first line,
     * so every one of these contacts is byte-inert — running the scan would
     * change nothing and cost 100 fixtures their hot loop. The ledger says
     * so out loud instead: `contactsSuppressed` gets the `Bot.noDamage`
     * reason from the one tape shape that reaches it.
     *
     * ⛔⛔ AND A BODY THIS MODEL DOES NOT MOVE IS A REFUSAL, NOT A ZERO.
     * `collide("Player", x, y)` tests the body where it IS, so a chaser's
     * contact is a question about a position no line of this file computes.
     * `combat.contactPricing` splits the census three ways and this arm
     * prices exactly one of them; the other two throw by name, so a tape
     * that walks a live route into an unmodelled body is a named failure
     * instead of a walk that silently took no damage.
     */
    function stepContactsNow() {
        if (noclip || noDamage) return;
        const census = world.combat?.enemies;
        if (!census) return;
        const box = playerBoxAt(state.x, state.y);
        for (const inst of census) {
            const rect = contactRect(inst);
            if (!rect || !rectsOverlap(rect, box)) continue;
            const id = `${inst.tag}@${inst.x},${inst.y}`;
            const pricing = contactPricing(inst.tag);
            // ⛓⛓ R6 SLICE 4: a `boss` is priced IN ITS OWN STEP, above.
            // The census rect here is its `.oel` placement and the descent
            // has moved it — scanning it would be a second contact, at a
            // position the fight left 140 px ago.
            if (pricing.kind === 'boss') continue;
            // ⛓⛓⛓ R8 SLICE 1: AND A `stepped` FAMILY WITH A PRICER IS THE
            // SAME SKIP, FOR THE SAME REASON ONE FAMILY OVER. A bridged
            // chaser's contact is billed by `stepChasersNow` at the position
            // THIS tick left it; the census rect here is its `.oel` placement,
            // which a chaser leaves on the first tick the player is inside
            // `runRange`. Scanning it would be a second contact at a stale
            // place — the totem's mistake, with a body that moves every tick
            // instead of once. A `stepped` family with `pricedBy: null` still
            // falls through to the throw below, and that is the CONTROL: the
            // partition is between "priced somewhere" and "priced nowhere",
            // never between two spellings of "stepped".
            //
            // ⛔⛔ AND THE SKIP IS PER ROOM, NOT PER CLASS. `chaserRoomVerdict`
            // refuses to step a body whose LIFETIME this model cannot compute
            // (today: any room with an arrow trap). Skipping there would be
            // the worst answer available — a silent zero for a body nobody
            // prices — so the refusal is re-raised here with the ROOM's own
            // reason rather than the class's.
            if (pricing.kind === 'stepped' && pricing.pricedBy) {
                const verdict = chaserRoomVerdict(level);
                if (verdict.stepped) continue;
                throw new Error(`levelRun: the player is standing inside ${id} in level `
                    + `${level} at tick ${ticksCompleted + 1} on a tape that does NOT `
                    + `declare \`noDamage\`. \`${pricing.pricedBy}\` would price this `
                    + `contact — but the bridge is NOT STEPPING this room: ${verdict.why}. `
                    + 'So the body is where `loadlevel` put it as far as this run is '
                    + 'concerned, and a contact against a stale placement is a number this '
                    + 'run cannot produce. Route clear of it, or build the missing family.');
            }
            if (pricing.kind !== 'static') {
                throw new Error(`levelRun: the player is standing inside ${id} in level `
                    + `${level} at tick ${ticksCompleted + 1} on a tape that does NOT `
                    + `declare \`noDamage\`, and this rung prices it as "${pricing.kind}" `
                    + `— ${pricing.why}. \`Enemy.hitPlayer\` collides against the body at `
                    + 'its CURRENT position, so a contact with a body the model does not '
                    + 'step is a number this run cannot produce. Declare `noDamage`, or '
                    + 'route clear of it.');
            }
            // `Enemy.update`'s own early return is `onScreen()` at ZERO
            // margin, so an off-screen body neither moves nor damages —
            // and under shake the verdict can be a refusal.
            const verdict = enemyHitPlayerFires(
                // A static trap is never hit on this rung (nothing shoots it),
                // so its own i-frames and die anim are constants — stated
                // rather than tracked, and stated where a future stepper
                // would have to replace them.
                { hitsTimer: 0, destroy: false, dieAnim: false },
                onScreenNow(rect, id) ? 'on' : 'off',
            );
            if (!verdict.fires) {
                contactsSuppressed.push({
                    t: ticksCompleted + 1, level, source: 'enemy', id, why: verdict.refusedAt,
                });
                continue;
            }
            applyPlayerHit({
                source: 'enemy',
                id,
                // `p.hit(this, 3, new Point(x, y), damage)` — the base
                // class's force, the instance's `damage`, and the body's
                // own ENTITY POINT (its centre, not its rect corner).
                force: PLAYER_DAMAGE.contactForce,
                damage: inst.row.damage,
                from: { x: inst.cx, y: inst.cy },
            });
            if (pendingDeath) return;
        }
    }

    /**
     * ⛓⛓⛓ R8 SLICE 1 — THE ENEMY BRIDGE. ONE `Bob.update()` PER BODY, IN THE
     * GAME'S OWN SLOT, AND THE SLOT IS THE LAST ONE BEFORE THE PLAYER.
     *
     * `Game.loadlevel` adds `bob` at `:2141` and `World.addUpdate` PREPENDS,
     * so the update list is the reverse of the add order:
     *
     *   spinner (:2273) -> shieldboss (:2245) -> pushables (:2239-2241)
     *     -> crusher (:2165) -> iceturret (:2161) -> sandtrap (:2156)
     *     -> finalboss (:2149) -> bosstotem (:2146) -> **BOB (:2141)**
     *     -> … -> Player (:2115)
     *
     * ⛔ SO A BOB UPDATES **AFTER EVERY OTHER ENEMY IN THE ROOM** and
     * immediately before the player — which is why this call sits beside
     * `stepContactsNow` at the bottom of the tick and NOT next to the ice
     * turret, where "one more enemy family" would have put it. The obvious
     * placement is wrong by nine families.
     *
     * ⛔⛔ AND IT IS **BELOW** THE CEREMONY'S EARLY RETURN, which is a
     * DIFFERENT answer from the crusher's and the spinner's, on purpose:
     *
     *   · a bob's MOTION is freeze-gated twice over (`Mobile.mobileUpdate`
     *     skips the move, and `Bob.update`'s own `|| Game.freezeObjects`
     *     returns above the chase block), so a ceremony parks it dead;
     *   · what does keep running through a freeze is `Enemy.update`'s TERRAIN
     *     switch, `Mobile.death`'s fade and `hitUpdate` — and this rung
     *     transcribes none of the three for a chaser (see `chasers.js`'s own
     *     note: the terrain arm is the game's, witnessed by a `despawn`).
     *
     * ⇒ the frozen frames a ceremony spends cost a LIVE, UNHIT bob exactly
     * nothing, and `assertNoCeremonyBesideLiveChaser` refuses the two cases
     * where that stops being true rather than approximating them.
     *
     * ── WHAT THIS CALLS, AND WHAT IT DOES NOT RE-IMPLEMENT ────────────
     *
     * `chasers.chaserStep` is the WHOLE movement transcription and has been
     * since R5 slice 3 — the off-screen return, `Mobile.friction`, the two
     * 1 px sweeps, the per-class freeze gate and the bang-bang chase impulse.
     * Nothing here re-derives a line of it: two cost models that must agree
     * are one cost model. What this function owns is the three things a
     * transcription cannot know — WHICH world it is stepping (the sweep), the
     * i-frame drain `iframesTicked` reports, and `Enemy.update`'s tail
     * (`hitPlayer`, through the run's one `applyPlayerHit` funnel).
     *
     * ⚠ `onScreenNow` THROWS on an uncertain shake band, and that is the
     * POSTURE CHOSEN HERE rather than the one inherited. `Enemy.update`
     * early-returns at ZERO margin, so the camera decides whether this body
     * moves AT ALL this tick — not merely whether it damages. Guessing would
     * make a whole walk's chase a coin flip, and a `false` would freeze a
     * body the game was still walking. It is the ShieldBoss's decision
     * (`onScreenNow(body, …)`) taken for the same reason and with a stronger
     * consequence, and the answer to a red here is to move the stance, never
     * to widen the band.
     */
    /**
     * ⛔⛔⛔ THE LIFETIME GAP, AS A CHECK RATHER THAN A REFUSAL — because a
     * refusal here would cost the slice the one room it can prove anything in.
     *
     * `chaserStep` is `Enemy.update`'s MOVEMENT half. Two things in the other
     * half remove a body and neither is transcribed:
     *
     *   · the TERRAIN switch — `case 1: //Water` and `case 17: //Lava` set
     *     `destroy = true` outright, and `case 6` starts the pit fall;
     *   · an ARROW — `Arrow.as:52` calls `Enemy.hit(v.length, …)`, and three
     *     of those kill a `bob` (`hitsMax` 3).
     *
     * The arrow case is refused by ROOM (`chaserRoomVerdict`). The terrain
     * case is not, because L6 — the room whose two bobs R7 slice 6e measured
     * — HOLDS WATER, and one of its bobs drowns in it. That removal is
     * DECLARED, by the tape's own v10 `despawn`, which is exactly the channel
     * the arc built for "the game removed this body itself".
     *
     * ⇒ what is left is the case where a body the model still believes in
     * stands somewhere the game would have destroyed it. That must never be
     * SILENT, so it is a throw by name on the tick it becomes true. In L6 it
     * never fires — the surviving bob parks at x≈84.2 against a sandtrap,
     * four pixels WEST of the water (trap 152) — and that nil is a
     * measurement rather than an assumption.
     */
    function assertSteppedChaserLifetime(c) {
        const t = world.nearestWalkableTile(c.x, c.y)?.t ?? 0;
        if (t === ENEMY_PIT_TILE) {
            throw new Error(`levelRun: the stepped chaser ${c.id} stands on a PIT tile in `
                + `level ${level} at tick ${ticksCompleted + 1}. \`Enemy.update\`'s `
                + '`case 6` starts a DESCENT — a lerp to the tile centre plus an 8 deg '
                + 'spin and a 0.05 fade over 20 ticks — which this rung does not '
                + 'transcribe (the water and lava arms are instants and are). No room '
                + 'this bridge steps has one, and that nil is why it is refused rather '
                + 'than approximated.');
        }
        for (const a of arrowsFor(level)) {
            if (a.removed) continue;
            if (!rectsOverlap(chaserBoxAt(c.tag, c.x, c.y), arrowRect(a))) continue;
            throw new Error(`levelRun: the stepped chaser ${c.id} is inside live arrow `
                + `${a.id} in level ${level} at tick ${ticksCompleted + 1}. `
                + '`Arrow.as:52` calls `Enemy.hit(v.length, …)` and three of those kill a '
                + 'bob — and this model\'s arrows hit NOTHING (`stepArrow` is called with '
                + 'no `bodies`). `chaserRoomVerdict` refuses a room with a TRAP in it, so '
                + 'reaching this line means an arrow came from somewhere that check does '
                + 'not know about. Build Arrow x Enemy.');
        }
    }

    /**
     * ⛔ THE LEDGER CONSEQUENCE OF A CHASER'S REMOVAL, COMPUTED — NOT SKIPPED.
     *
     * `Bob` IS in `totalEnemies()`, and its removal really does drop
     * `classCount(Bob)` — which opens every `tset == -1` lock in the room.
     * That is the exact cost `KILL_ARM_POLICY.Bob` refuses a PRESS over, and
     * a removal the ROOM causes owes the same arithmetic: the flag does not
     * care what killed the body.
     *
     * ⚠ THE ANSWER FOR L6 IS NIL AND IT IS A MEASUREMENT. The room holds four
     * sandtraps, two bobs and no lock of any kind — but "there were no kill
     * locks" and "nobody looked" print the same thing (the IceTurret arm's
     * own law), so the scan runs and the nil is computed from the level
     * record. A room where it is NOT nil is a route change nothing asked for,
     * and it fails by name.
     */
    function assertChaserRemovalOpensNothing(c) {
        const census = world.combat?.enemies ?? null;
        const roster = (census ?? []).filter((e) => !e.removed).map((e) => ({ as3: e.as3 }));
        const st = chaserStateFor(level);
        // The body is still in the census roster (the census is the PLACED
        // list and does not move), so `bodiesAfter` is that list minus the
        // ones this run has removed — including the one being removed now.
        const goneIds = new Set([...st.values()].filter((o) => o.destroy || o.removed)
            .map((o) => o.id));
        goneIds.add(c.id);
        const after = (census ?? []).filter((e) => !goneIds.has(`${e.tag}@${e.x},${e.y}`))
            .map((e) => ({ as3: e.as3 }));
        const led = killLockLedger(levelSource(level), {
            bodiesBefore: roster, bodiesAfter: after,
        });
        // ⛔ AN ABSENT CENSUS IS A REFUSAL, NOT A PASS — the IceTurret arm's
        // reasoning verbatim: with no `combat` role the roster is empty, so
        // `totalEnemies()` reads 0 both sides and the nil is computed from a
        // fiction. Scoped to the case where the count is load-bearing.
        if (led.locks.length > 0 && census === null) {
            throw new Error(`levelRun: ${c.id}'s terrain death in level ${level} happens `
                + `in a room with ${led.locks.length} \`tset == -1\` lock(s), and the `
                + 'world was built with NO COMBAT CENSUS — so `totalEnemies()` reads 0 '
                + 'because nothing was ASKED. Build the world with the `combat` role.');
        }
        if (!led.nil) {
            throw new Error(`levelRun: the removal of ${c.id} at tick ${ticksCompleted + 1} `
                + `OPENS ${led.opens.length} kill lock(s) in level ${level} (${led.why}) — `
                + 'a blocker the walk did not earn and this slice does not model. The '
                + 'bridge steps a chaser\'s POSITION; a room whose lock waits on its DEATH '
                + 'needs the kill arm too.');
        }
    }

    function stepChasersNow() {
        // ⛔ THE `noDamage` GATE IS `stepContactsNow`'s ARGUMENT, REUSED —
        // and it needs one more term, which `R8_ENEMY_BRIDGE.enemyBodyReaders`
        // enumerates: under the flag a chaser's POSITION has no reader in
        // this model at all (the block sweep's Enemy arm is spinners-only,
        // `stepArrow` gets no bodies, and a wand shot at a chaser already
        // throws). So stepping is byte-inert here, and running it would cost
        // 94 committed fixtures their hot loop for a number nobody reads.
        if (noclip || noDamage) return;
        const st = chaserStateFor(level);
        if (st.size === 0) return;
        const playerPoint = { x: state.x, y: state.y };
        // ⚠ ONCE PER TICK, not per probe — `pushableCtx`'s note, and a
        // chaser's sweep is 1 px steps on both axes exactly like a block's.
        // R8 slice 0's brand is what makes the normalise cost per TICK.
        const solidOpts = normalizeLiveOpts(liveSolidOpts());
        // ⛓ THE STATIC "Enemy" BODIES, read once. A `SandTrap` is
        // `type = "Enemy"` and never moves, so a trap the PLAYER walks past
        // is a WALL to a chaser — L6 parks `bob@96,16` against one forever
        // (trap 152). The census is the right source for these: their
        // position is their placement, for the whole visit.
        const staticEnemyBoxes = [];
        for (const inst of (world.combat?.enemies ?? [])) {
            if (isBridgedChaser(inst.tag)) continue;
            if (inst.row.speed !== 0) continue;
            const r = contactRect(inst);
            if (r) staticEnemyBoxes.push({ id: `${inst.tag}@${inst.x},${inst.y}`, rect: r });
        }
        // ⚠ THE UPDATE ORDER WITHIN THE FAMILY IS THE ADD ORDER, and the add
        // order is the `.oel`'s — `for each (o in xml.objects[0].bob)` walks
        // the placements in file order and PREPENDS each, so the LAST
        // placement updates FIRST. Reversed here rather than iterated
        // forwards, and it is observable the moment two bobs can block each
        // other, which is exactly L5's and L6's case.
        const ids = [...st.keys()].reverse();
        for (const id of ids) {
            const c = st.get(id);
            if (c.removed) continue;
            const box = chaserBoxAt(c.tag, c.x, c.y);
            const before = { x: c.x, y: c.y };
            /**
             * `Mobile.moveX`/`moveY`, transcribed as the sweep this world
             * really is — 1 px at a time, the last step `min(1, |rel| - i)`,
             * stopping at the first collider and NOT continuing past it.
             */
            const move = (mx, my, dx, dy) => {
                let x = mx;
                let y = my;
                const blocked = (px, py) => {
                    const r = chaserBoxAt(c.tag, px, py);
                    if (world.collidesSolid(r, solidOpts)) return true;
                    for (const b of staticEnemyBoxes) {
                        if (rectsOverlap(r, b.rect)) return true;
                    }
                    // ⛓ AND ITS SIBLINGS, read LIVE: this loop steps them one
                    // at a time and the game's update list does too, so a
                    // body that updates later must see the earlier one where
                    // this tick left it — `pushableCtx`'s own reasoning, and
                    // here it is not a bounded vacuity: L5 holds three and L6
                    // holds two.
                    for (const o of st.values()) {
                        if (o.id === c.id || o.removed) continue;
                        if (rectsOverlap(r, chaserBoxAt(o.tag, o.x, o.y))) return true;
                    }
                    return false;
                };
                const sweep = (rel, axis) => {
                    const n = Math.abs(rel);
                    const sign = rel < 0 ? -1 : (rel > 0 ? 1 : 0);
                    for (let i = 0; i < n; i += 1) {
                        const step = Math.min(1, n - i) * sign;
                        const nx = axis === 'x' ? x + step : x;
                        const ny = axis === 'y' ? y + step : y;
                        if (blocked(nx, ny)) return;
                        x = nx;
                        y = ny;
                    }
                };
                sweep(dx, 'x');
                sweep(dy, 'y');
                return { x, y };
            };
            const onScreen = onScreenNow(box, `${c.tag} ${c.id}`);
            /**
             * ⛓⛓⛓ `Enemy.update`'s TERRAIN SWITCH, AND IT RUNS *ABOVE*
             * `super.update()` — so it is the first thing this tick, and it
             * runs on a FROZEN tick too (nothing gates it).
             *
             * ⛔ IT IS BELOW THE OFF-SCREEN RETURN, THOUGH, and that is the
             * fencepost: `if (!activeOffScreen && !onScreen()) return;` is
             * `Enemy.update`'s FIRST statement and `Bob.activeOffScreen` is
             * false, so a body the camera has lost does not drown either.
             * Reading the switch as unconditional would kill bodies the game
             * leaves standing in water off screen.
             *
             * ⚠ THE PIT IS NOT MODELLED and is REFUSED — `case 6` starts a
             * lerp-to-tile-centre plus a spin and a 0.05 fade, a schedule
             * rather than an instant, and no room this rung steps has one.
             */
            if (onScreen && !c.destroy) {
                const t = world.nearestWalkableTile(c.x, c.y)?.t ?? 0;
                if (t === ENEMY_TERRAIN_DESTROYS.water || t === ENEMY_TERRAIN_DESTROYS.lava) {
                    c.destroy = true;
                    c.alpha = 1;
                    chaserTerrainDeaths.push({
                        t: ticksCompleted + 1,
                        level,
                        id: c.id,
                        cause: t === ENEMY_TERRAIN_DESTROYS.water ? 'water' : 'lava',
                        x: c.x,
                        y: c.y,
                    });
                    assertChaserRemovalOpensNothing(c);
                }
            }
            /**
             * ⛔⛔ A DESTROYED BODY STOPS DEAD, AND THE THREE GATES THAT SAY SO
             * ARE IN THREE DIFFERENT CLASSES — which is why this is a branch
             * and not a `continue`.
             *
             *   · `Mobile.mobileUpdate`'s `if (!destroy)` skips friction,
             *     `input()` and BOTH sweeps ⇒ it does not move;
             *   · `Enemy.update`'s `if (!destroy)` skips `hitUpdate()` and
             *     `hitPlayer()` ⇒ it damages nothing and its i-frames stop;
             *   · `Bob.update`'s own `if (destroy || …) return` skips the
             *     chase block ⇒ `v` stops accumulating.
             *
             * What DOES run is `Mobile.death()` — the 0.1 alpha fade, ten
             * subtractions from 1 (`MOBILE_DEATH_FADE.ticks`, a LOOP and not
             * a division) — and the `FP.world.remove` it ends in.
             *
             * ⚠ AND `death()` IS OUTSIDE THE FREEZE GATE, so a corpse keeps
             * fading through a ceremony. `assertNoCeremonyBesideLiveChaser`
             * is what refuses the case this model cannot spend as steps.
             */
            if (c.destroy) {
                c.alpha -= MOBILE_DEATH_FADE.alphaStep;
                if (c.alpha <= 0) c.removed = true;
                continue;
            }
            const r = chaserStep(c.tag, { x: c.x, y: c.y, v: c.v, dying: c.dying }, playerPoint, {
                onScreen,
                frozen: ceremony !== null,
                move,
            });
            c.x = r.x;
            c.y = r.y;
            c.v = r.v;
            assertSteppedChaserLifetime(c);
            // `Enemy.update`'s tail, in its own order: `hitUpdate()` then
            // `hitPlayer()`, and BOTH are inside `if (!destroy)`.
            if (r.iframesTicked && c.hitsTimer > 0) c.hitsTimer -= 1;
            if (before.x !== c.x || before.y !== c.y) {
                chaserWalks.push({
                    t: ticksCompleted + 1, level, id: c.id, x: c.x, y: c.y, vx: c.v.x, vy: c.v.y,
                });
            }
            // ── `Enemy.hitPlayer()`, at the position THIS tick left ──────
            // `collide("Player", x, y)` against the body's own hitbox, gated
            // on `!destroy`, `currentAnim != "die"` and `hitsTimer <= 0` —
            // which is `enemyHitPlayerFires`, the same predicate the static
            // census arm uses. One implementation, two callers.
            const bodyNow = chaserBoxAt(c.tag, c.x, c.y);
            if (!rectsOverlap(bodyNow, playerBoxAt(state.x, state.y))) continue;
            const verdict = enemyHitPlayerFires(
                { hitsTimer: c.hitsTimer, destroy: c.removed, dieAnim: c.dying },
                onScreenNow(bodyNow, `${c.tag} ${c.id}`) ? 'on' : 'off',
            );
            if (!verdict.fires) {
                contactsSuppressed.push({
                    t: ticksCompleted + 1, level, source: 'chaser', id: c.id, why: verdict.refusedAt,
                });
                continue;
            }
            applyPlayerHit({
                source: 'chaser',
                id: c.id,
                // `p.hit(this, 3, new Point(x, y), damage)` — the base class's
                // force, the instance's `damage`, and the body's own ENTITY
                // POINT, which for a chaser is where it stands NOW.
                force: PLAYER_DAMAGE.contactForce,
                damage: c.damage,
                from: { x: c.x, y: c.y },
            });
            if (pendingDeath) return;
        }
    }

    /**
     * ⛔ THE REFUSAL THE FREEZE ASYMMETRY EARNS, ONE FAMILY OVER — and it is
     * NARROWER than the ShieldBoss's on purpose.
     *
     * A ceremony's phase A is a LUMP in `frozenFramesOwed`, not a sequence of
     * steps. For a bob that costs nothing while it is unhurt and unmoving:
     * the motion is freeze-gated and the model's roster carries no terrain
     * arm to advance. Two states make it cost something, and only those two
     * are refused:
     *
     *   · `hitsTimer > 0` — `hitUpdate` runs OUTSIDE the freeze gate, so the
     *     game would drain 150 i-frames the model drains none of;
     *   · `dying` — `Mobile.death`'s fade runs outside it too, and the
     *     removal it ends in is what `totalEnemies()` counts.
     *
     * ⚠ NOTHING ON THIS RUNG'S ROSTER CAN PUT A BOB IN EITHER STATE — no kill
     * arm is modelled for the class and no arrow in this model hits a body —
     * so this is a BOUNDED VACUITY today, and it says so rather than being
     * left out on the strength of that.
     */
    function assertNoCeremonyBesideLiveChaser(what) {
        if (noclip || noDamage) return;
        for (const c of chaserStateFor(level).values()) {
            if (c.removed) continue;
            if (c.hitsTimer <= 0 && !c.dying) continue;
            const why = c.dying ? 'DYING' : `inside ${c.hitsTimer} ticks of i-frames`;
            throw new Error(`levelRun: a ${what} ceremony began in level ${level} while `
                + `the chaser ${c.id} is ${why}. \`Enemy.hitUpdate\` and \`Mobile.death\` `
                + 'both sit OUTSIDE `Game.freezeObjects`, so the game advances them through every '
                + 'frozen frame — and this model spends a ceremony\'s phase A as a LUMP '
                + 'rather than as steps. Collect after the body is gone, or step the '
                + 'freeze.');
        }
    }

    function stepIceTurretsNow() {
        const st = turretStateFor(level);
        if (st.size === 0) return;
        const ids = [...st.keys()].reverse();
        for (const id of ids) {
            const t = st.get(id);
            if (t.removed) continue;
            const opts = normalizeLiveOpts(liveSolidOpts());
            const withoutSelf = opts.turrets === null ? null
                : new Map([...opts.turrets].filter(([k]) => k !== id));
            stepIceTurret(t, {
                frozen: ceremony !== null,
                // ⛔⛔⛔ R5 SLICE 22: COMPUTED, NOT DECLARED — AND SLICE
                // 20's DECLARATION IS WHAT THE RECORDING REFUTED.
                //
                // It used to read `onScreen: true`, with the reason that
                // "the camera is a render-side quantity this package does
                // not carry, and every leg that pushes a corpse stands
                // within a tile of it". True, and beside the point: the
                // gate also skips `Mobile.mobileUpdate`, and this class's
                // `input()` SNAPS y by 8 px the first time it runs. A
                // turret that is on screen from tick 0 stands at y 424; one
                // the camera has not reached yet stands at y 416 — and
                // eight pixels of turret is 33 ticks of volley phase, which
                // is the whole distance between the model's freeze and the
                // game's. See `cam`.
                onScreen: onScreenNow(iceTurretRect(t), `iceturret ${t.id}`),
                blockedAt: (x, y) => {
                    const b = iceTurretRect({ ...t, x, y });
                    return !!world.collidesSolid(b, { ...opts, turrets: withoutSelf })
                        || rectsOverlap(b, playerBoxAt(state.x, state.y));
                },
                terrainAt: (x, y) => world.nearestWalkableTile(x, y)?.t ?? 0,
                playerOverlaps: (r) => rectsOverlap(r, playerBoxAt(state.x, state.y)),
                // ⛓⛓⛓ R5 SLICE 22: `FP.world.nearestToEntity("Player", this)`.
                // The ENTITY point, not the box — `FP.distance(x, y, p.x,
                // p.y)` is between the two entity points, and the turret's
                // is its 32x32 box's centre while the player's is 2 px in
                // from the left of a 4x5 box. Handing over the box corner
                // would move the 128 px range boundary by a tile's third.
                player: { x: state.x, y: state.y },
            });
            // ⛓ `endAnim` -> `FP.world.add(new IceTurretBlast(...))` x3, and
            // `add` is DEFERRED to `updateLists()` at the end of the frame:
            // a blast spawned this tick first updates on the NEXT one. The
            // unshift is `addUpdate`'s prepend.
            if (t.spawned) {
                blastsFor(level).unshift(...t.spawned);
                for (const b of t.spawned) b.spawnedAt = ticksCompleted + 1;
                volleys.push({
                    t: ticksCompleted + 1, level, turret: id, blasts: t.spawned.length,
                });
            }
            st.set(id, t);
        }
    }

    /**
     * One tick of the live `SealPiece`, if there is one.
     *
     * ⚠ ITS ORDER IS UNOBSERVABLE and that is asserted rather than assumed:
     * a `Pickup` is `type = "Seal"`, which is in no `solids` list and in no
     * player probe, so nothing else in the tick reads its position. What
     * DOES matter is that it reads the player's position from the previous
     * tick, which is what `state` is here.
     */
    function stepSealPieceNow() {
        if (sealPiece === null) return;
        // ⛓ R8 SLICE 0: HOISTED AND BRANDED — `blockedAt` is the seal piece's
        // own per-pixel sweep and rebuilt the whole per-visit view on each
        // probe. Nothing in `stepSealPiece` moves a geometry family: the
        // piece is `type = "Seal"`, in no `solids` list and in no player
        // probe, which the docblock above already asserts for the ORDER and
        // which is the same fact this hoist rests on.
        const sealOpts = normalizeLiveOpts(liveSolidOpts({
            beforeTypeFlip: firstTickInWorld,
        }));
        const r = stepSealPiece(sealPiece, {
            player: { x: state.x, y: state.y },
            playerBox: playerBoxAt(state.x, state.y),
            blockedAt: (x, y) => {
                const b = sealPieceBox({ x, y });
                return !!world.collidesSolid(b, sealOpts);
            },
        });
        sealPiece = r.piece;
        if (!r.contact) return;
        // ⛓ THE CEREMONY IS ALL DEAD FRAMES. Phase A is 150 and the
        // `SealController` behind it is 181 more, and the observation
        // stream sees neither — so this costs the tape NO ticks and the
        // evidence is the game's own `dead_frames` counter.
        sealCollections.push({
            t: ticksCompleted + 1,
            level,
            from: sealPieceFrom,
            deadFrames: CEREMONY_DEAD_FRAMES.total,
        });
        sealPiece = null;
        sealPieceFrom = null;
    }

    /**
     * ⛓⛓⛓ R5 SLICE 23: NO LONGER A CONSTANT — the rung that had something
     * to change is this one.
     *
     * It used to read: *"`SealController.hasAllSealParts()` reads
     * `Main.hasSealPart(15)`, which is save state no bot tape carries and
     * which a fresh `Main` leaves at -1. Written down as a constant so the
     * rung that changes it has something to change."* The v6 `save` block
     * carries it, and the predicate is the game's own — **the LAST SLOT,
     * not the count** — because the array is a collection log and the game
     * tests `Main.hasSealPart(SEALS - 1) != -1`.
     */
    const HAS_ALL_SEAL_PARTS = sealParts[SAVE_SLOTS.seal_parts - 1] !== -1;
    /** One record per chest this run opened. */
    const chestOpens = [];
    /** One per tick a pulse's `hit()` ran, per pulser. */
    const pulserHits = [];
    /** One per tick a pulse reached the PLAYER — inert under `noDamage`. */
    const pulserPlayerHits = [];
    /**
     * ⛓⛓⛓ R7 slice 6b: one per VOLLEY an arrow trap fired —
     * `{t, level, id, arrows}`.
     *
     * ⛔ THE ONLY POSITIVE OBSERVABLE A HOLD ON AN ARROWTRAP GROUP HAS. A
     * trap has no open state and no armed rect, so "the hold did something"
     * has to be asked of the SHOTS. `runHold`'s arrowtrap arm asks this.
     */
    const arrowVolleysFired = [];
    /**
     * One per arrow that hit something — `{t, level, id, types}`.
     *
     * ⚠ COVER AND THE PLAYER ONLY, AND THE ABSENCE IS THE CLAIM. An arrow's
     * `hitables` include `"Enemy"`, and this run does not carry enemy
     * BODIES: `KILL_ARM_POLICY.Bob` is `refused` because modelling a
     * chaser's kill needs its POSITION, and an arrow needs the body in a
     * LANE for exactly the same reason. So an enemy hit is not computed
     * here, it is adjudicated by the GAME, and `enemyBodiesAsked: false`
     * says which of the two a row's silence is.
     * [[feedback_silent_watcher_vacuous_negative]]
     */
    const arrowHits = [];
    /** One per block a pulse actually MOVED — the chain's third link. */
    const pulsePushes_ = [];
    /**
     * ⛔⛔ R5 slice 13: one per ENEMY a pulse killed — `{t, level, pulser, enemy}`.
     *
     * A ledger entry the route never chose and could not previously see: the
     * shaft's CONTROL arm came back from the game carrying {39,4} and the
     * model predicted nothing at all. See the dispatch site.
     */
    const pulserEnemyKills = [];
    /**
     * ⛔⛔ R5 slice 13: one record per `Spinner.removed()` write — the flag a
     * spinner banks by LEAVING THE WORLD, whatever took it out.
     *
     * `spinnerWritten` is the once-only guard: `removed` stays true for the
     * rest of the visit, so a per-tick scan without it would bank the same
     * flag every tick after the removal.
     */
    const spinnerWrites = [];
    const spinnerWritten = new Set();
    /** One per completed seal ceremony, with the dead frames it cost. */
    const sealCollections = [];
    /** Which chest the live piece came from, for the ledger. */
    let sealPieceFrom = null;

    // ── the pickup CEREMONY (R3) ──────────────────────────────────────
    /**
     * The ceremony currently running, or null.
     *
     * ⚠ THIS IS THE CRUTCH `grants` USED TO BE. R0 handed an item over as a
     * property write on room entry; R3 walks onto the pickup and lets the
     * game do it, which costs the tape TICKS — and the number of them is
     * what the observation stream measures.
     *
     * Two phases, and only one of them is visible:
     *
     *   PHASE A — `Pickup.pick_up()` sets `Game.freezeObjects` and counts
     *     `specialTimer` down from 150. `Pickup` is the only writer of the
     *     flag on those frames, so the bot's dead-frame gate holds and the
     *     tick counter does not advance. **The stream cannot see phase A at
     *     all**, so this model does not represent it: no ticks, no
     *     observations, nothing to reproduce. (It is 151 dead frames in the
     *     `r3-collect-sword` recording, against 20 for the boot fade.)
     *
     *   PHASE B — the NPC is up. `Game.freezeObjects` now has several
     *     writers and no per-frame reset, so it reads TRUE inside
     *     `Mobile.mobileUpdate` and FALSE again at the next frame's gate:
     *     **the tick counter runs while the player cannot move.** Every
     *     observation repeats the contact position, and the TAPE supplies
     *     the X releases, because `NPC.talk()` reads `Input.released` from
     *     the NPC's own update, outside the frozen block.
     *
     * ⚠ VELOCITY SURVIVES. `mobileUpdate` skips friction, input AND the
     * move, so `v` is exactly what it was when the freeze began — which is
     * why `r3-collect-sword` shows the player still drifting for three
     * ticks after the ceremony (61.65 -> 61.00 -> 60.60 -> 60.45) before
     * friction stops it. Not stepping is therefore the whole model: nothing
     * about the state is reset.
     */
    let ceremony = null;
    /**
     * ⛓⛓⛓ R6 SLICE 6d: THE PICKUPS NO LEVEL RECORD CONTAINS.
     *
     * `Watcher.update` does `FP.world.add(new Seed(p.x - 8, p.y - 8, true,
     * …))` at runtime, so this is a pickup roster the census cannot supply
     * and the run has to own. Two facts shape the list:
     *
     *   1. ⛔ **A `new Game` DESTROYS IT.** A runtime entity is in no
     *      `.oel`, so a world swap does not rebuild it — it simply ceases.
     *      Hence a bare array cleared in `enterWorld` rather than the
     *      per-level Map every census-backed family uses: "per visit" is the
     *      wrong shape for something that has no second visit.
     *   2. ⛔ **`FP.world.add` QUEUES.** `Engine.update` is `world.update();
     *      world.updateLists();`, so an entity added inside frame N first
     *      updates on frame N+1 — the same fencepost `FP.world.remove` gave
     *      W-door from the other end (§17.4). `pendingSeedAdds` is that one
     *      tick, spelled out.
     */
    let runtimeSeeds = [];
    let pendingSeedAdds = [];
    /**
     * The reboot a `Seed`'s terminal arm has ordered, consumed at the END of
     * the tick beside `pendingDeath` — the two are the same shape, and for
     * the same reason: `FP.world = new Game(...)` is deferred to
     * `Engine.checkWorld`, which runs after the whole tick.
     */
    let pendingSeedReboot = null;
    /**
     * ⛓⛓ `Game.as:955-960`'s scripted walk, while it is running.
     *
     * `null`, or `{arm: 1, level, from}`. It is NOT a freeze: `cutscene[1]`
     * writes `p.receiveInput = false`, which `Player.input()` reads and
     * `Mobile.mobileUpdate` does not — so friction runs, the sweeps run, the
     * player MOVES, and the tape's tick counter runs with it. The same
     * distinction a `ShieldLock`'s window draws (`lockSnap`), on a script
     * the GAME started.
     */
    let cutsceneWalk = null;
    /**
     * ⛓⛓⛓ R6 SLICE 6d: `Game.cutscene`, the run's own copy.
     *
     * `public static var cutscene:Array = new Array(false, false, false,
     * false)` (`Game.as:614`) — a STATIC, so it survives every world swap,
     * which is the whole mechanism of the ending: `Seed`'s plain arm sets
     * `[2]` one line above the reboot and `Game.as:2185` reads it back as
     * the fifth ctor argument when `loadlevel` rebuilds the same object.
     *
     * ⚠ ONLY `[1]` AND `[2]` ARE REACHABLE HERE. `[0]` is the opening wind
     * scene, which no boot can enter (it needs `Main`'s own start), and
     * `[3]` is never written by anything in the tree.
     */
    // ⛓ R7: seeded from the v8 seam when one is declared. `cutscene[2]` is
    // the Seed's mode change and every later `Game` spawns the player inert
    // under it (trap 91), so a segment that boots after the ending and does
    // not carry it models a player the game will not move.
    const cutscene = seamBoot['static.Game.cutscene']
        ? [...seamBoot['static.Game.cutscene']]
        : [false, false, false, false];
    /**
     * ⛓⛓ `Game.as:961-966`'s hold, while it is running — `{arm: 2, level,
     * enteredAt, phase, r}` or `null`.
     *
     * ⛔ NOT A FREEZE, and `endingChain.CUTSCENE_2_HOLD` is the argument.
     * The cutscene sets `p.receiveInput = false`, which makes
     * `canInventory()` false, which runs `inventory.open = false`, which
     * LOWERS `Game.freezeObjects` at the end of every frame. So these are
     * live TAPE TICKS with a player that cannot move — because
     * `p.active = false` stops `Player.update` being called at all, not
     * because anything is frozen. §14.5's "~688 frozen frames" counted them
     * the other way.
     */
    let cutsceneHold = null;
    /**
     * The credits, once reached — `{t, menuState, badge}` or `null`.
     *
     * ⛔ AND IT IS A TERMINAL, NOT A STATE. `Game.menuAndRestart()` sets
     * `Game.freezeObjects = true` on every frame while `menu` is true, so
     * the tape's counter cannot advance past this and a tape that tried
     * would be asking for observations the game never records. `advance`
     * refuses rather than producing them.
     */
    let credits = null;
    /** `${level}:${x},${y}` of every pickup this run has already taken. */
    const collectedPickups = new Set();
    const pickupKey = (n, p) => `${n}:${p.x},${p.y}`;
    /** One record per completed ceremony, for the acceptance ledger. */
    const collected = [];
    /**
     * ⛓⛓⛓ R6 SLICE 6d: one record per ceremony BEGUN — `{t, level, tag,
     * runtime}`.
     *
     * ⛔ AND IT IS A DIFFERENT LIST FROM `collected` FOR EXACTLY ONE REASON,
     * which the game charged for on the first recording of
     * `r6-seed-control`. `Pickup.pick_up()` raises `Game.freezeObjects` and
     * counts `specialTimer` down from 150 on CONTACT; it does not ask
     * whether the dialogue after it will ever be dismissed. So a tape that
     * ends mid-ceremony has paid 150 DEAD FRAMES and banked no completion,
     * and a dead-frame ledger keyed on `collected` reads that as 0 — 170
     * dead against a one-load band of [14.6, 23.6].
     *
     * ⚠ The two lists are identical for every fixture that finishes what it
     * starts, which is every fixture written before this one. That is why
     * the defect could exist at all.
     */
    const ceremonyStarts = [];
    /**
     * `Game.framesThisCharacter`, which is a `Game` FIELD and not the NPC's.
     *
     * ⚠ It carries across dialogues within one level and is fresh only on a
     * world swap, so two ceremonies in the same room do NOT cost the same
     * number of ticks. Owned here rather than inside a dialogue because a
     * dialogue does not outlive its NPC and this does.
     */
    let framesThisCharacter = INITIAL_FRAMES_THIS_CHARACTER;

    /** The item a pickup grants, and the text its ceremony shows. */
    function ceremonyFor(p) {
        // ⛓⛓⛓ R6 SLICE 5: the ATTRIBUTE split, before the tag lookup.
        // `BossKey`'s ctor gives a `text` only to `keyType == 0`, so the
        // L19 key runs a two-page dialogue where every other key on the
        // ladder self-resolves after 150 frozen frames. R4's own docblock
        // predicted this rung would find out "by the ceremony costing 150
        // ticks the recording does not have"; it found out by the key
        // collecting in ONE tick instead.
        const byKey = PICKUP_CEREMONY_BY_KEYTYPE[p.tag];
        if (byKey && p.keyType !== undefined && byKey[p.keyType]) return byKey[p.keyType];
        // ⛓⛓⛓ R6 SLICE 6d: the THIRD resolution, and the first that reads
        // the LEVEL rather than a table. `Game.as:2185` passes `o.@text` as
        // `Seed`'s fourth ctor argument, so the dialogue's length is data —
        // two `seed` objects would run two different ceremonies from one
        // class, which no table keyed on the class can express.
        const byAttr = PICKUP_TEXT_FROM_ATTRIBUTE[p.tag];
        if (byAttr) {
            if (typeof p.text !== 'string') {
                throw new Error(`levelRun: the "${p.tag}" pickup at (${p.x},${p.y}) in `
                    + `level ${level} takes its ceremony text from its \`${byAttr.attribute}\` `
                    + `ATTRIBUTE (${byAttr.src}) and the census carried none. A pickup `
                    + 'whose dialogue length is level data cannot fall back to a table '
                    + 'entry — the ceremony would run for the wrong number of ticks and '
                    + 'every observation after it would be shifted.');
            }
            return { item: byAttr.item, text: p.text };
        }
        const entry = PICKUP_CEREMONY[p.tag];
        if (!entry) {
            throw new Error(`levelRun: the player is standing on a "${p.tag}" pickup `
                + 'with no ceremony entry. Add it to `dialogue.PICKUP_CEREMONY` with its '
                + 'item name and its verbatim text — an unpriced pickup would cost the '
                + 'tape an unknown number of ticks and every observation after it would '
                + 'be shifted.');
        }
        return entry;
    }

    /**
     * The release EDGE the ceremony's dialogue reads.
     *
     * `Input.released(k)` is true on the frame the KEY_UP was dispatched,
     * which for a span `{from, to}` is tick `to` — held at `to - 1` and not
     * at `to`. The run derives it rather than being told, so the driver and
     * the runner cannot grow two ideas of what a release is.
     */
    let prevHeld = new Set();
    const releasedThisTick = (held, key) => prevHeld.has(key) && !held.has(key);

    // ── the TOUCH-LOCK ceremony (R3) ──────────────────────────────────
    /**
     * The ShieldLock window currently open, or null.
     *
     * ⚠ THIS IS NOT A FREEZE, and telling the two apart is the whole of it.
     * A pickup ceremony sets `Game.freezeObjects`, which gates the entire
     * friction/input/move block in `Mobile.mobileUpdate` — a frozen tick
     * moves nothing. A ShieldLock sets `p.receiveInput = false`, which is
     * read at the top of `Player.input()` (`Player.as:1501`) and NOWHERE
     * else: friction still runs, the sweeps still run, `getState` still
     * runs. So the window is not "skip the tick" — it is "run the tick with
     * no keys", and residual velocity carries the player through it.
     *
     * That distinction is also why the caller must emit no spans here.
     * `useItem(Main.primary)` is inside `input()` too, so a span in the
     * window is inert in the game — but a span one consumer honours and the
     * other drops is the asymmetry the tape format exists to prevent, and
     * the driver refuses to emit one (`botDriverV2.runTouch`).
     */
    let lockSnap = null;
    /** One record per COMPLETED touch-lock window, for the ledger. */
    const lockSnaps = [];
    const NO_KEYS = new Set();
    /**
     * ⚠ THE SNAP LANDS ON THE NEXT TICK, and the GAME is what said so.
     *
     * `Game.loadlevel` adds the Player at `Game.as:2040` and every scenery
     * and puzzle entity in the loop BELOW it, and `World.add` -> `addUpdate`
     * PREPENDS — so the update list is reverse add order and a Lock updates
     * BEFORE the player, reading the position the previous frame left. That
     * makes no difference to the activator STATE (deriving it from the
     * post-move position at the end of tick N is the same object the game
     * derives at the top of tick N+1) — which is why R2's button-lock
     * recordings could never see the ordering at all. It makes every
     * difference to the SIDE EFFECT: `p.y = y - originY + 7` is written at
     * the top of tick N+1, before the player's own update, so the first
     * observation showing it is N+1 and not N.
     *
     * The model got that wrong and the oracle caught it on the first
     * recording: at observation 19 the game says y = 264 and the model said
     * 263. Held here and applied at the top of the next `advance`.
     *
     * ⚠ Bounded imprecision, provably unreachable: teleporters are added
     * BELOW the locks (`Game.as:2169`), so they update before them and see
     * the UNsnapped position, while `stepV2` runs its teleporter check
     * against the snapped one. Both the pre-snap and post-snap boxes lie
     * inside the lock's own collide rect, and `levelRun.test.js` asserts
     * map-wide that no teleporter overlaps one — so no position either side
     * of a snap is ever inside a trigger.
     */
    let pendingSnapY = null;

    /**
     * Fold this tick's touch-responder events into the window state. The
     * position write is DEFERRED (see `pendingSnapY`); everything else — the
     * refusal, the ledger, the throws — lands here.
     */
    /**
     * R4: one record per BossLock that finished its fade — `{id, level,
     * persistTag, t}`.
     *
     * A separate list from `lockSnaps` because the two are different claims.
     * A snap says the player was TAKEN OVER for 101 ticks; a key open says a
     * lock the walk carried a key to has gone, and the only observable is
     * the flag. Both feed `earnedClears`.
     */
    const keyOpens = [];
    /**
     * ⛓ R5 slice 5 step 2: one record per `ButtonRoom` press with
     * `room >= 0` — `{id, from, level, tag, value, which, t}`, TWO per
     * press.
     *
     * Kept as WRITES rather than as clears because the sign is data: `flip`
     * decides it, and a `flip = 0` button writes TRUE. Only the `false`
     * writes are clears; recording both is what lets a test assert that the
     * TRUE one did not reach the ledger.
     */
    const roomWrites = [];
    /**
     * ⛓ R5 slice 7: one record per plain-`Lock` persistence write —
     * `{id, level, flag, t, value}`, with `value` the BOOLEAN the game
     * wrote. Kept as writes rather than as clears for the same reason
     * `roomWrites` is: only a `false` is a clear, and recording both is
     * what lets a test assert the TRUE one left the ledger again.
     */
    const lockWrites = [];

    function applyLockEvents(events) {
        for (const ev of events) {
            /**
             * ⛔⛔ R5 SLICE 7: `Lock.turnOff()` / `returnToNormal()`, the
             * two persistence writes every rung before this one dropped.
             *
             * A plain `Lock`/`WandLock` that fades open writes
             * `Game.setPersistence(tag, false)`; one that restores writes it
             * back TRUE. `Bot.as`'s `persistenceClearedAll` is a live scan
             * of the whole array, so BOTH are visible in the game's own
             * ledger — which means an exact-set assertion over a walk that
             * opens one is red without this, and a walk that opens and then
             * CLOSES one is red WITH only the first half.
             *
             * ⚠ CASHED IMMEDIATELY, unlike a touch lock's. The pending
             * mechanism exists because dropping a memo mid-visit would
             * despawn an entity the game keeps — but a `tSet >= 0` lock is
             * NOT despawned by its flag (`Lock.check()` needs `tSet < 0`),
             * so the flag changes nothing this level builds and there is
             * nothing to defer. Banked into the ledger and left there.
             */
            if (ev.kind === 'lockopen' || ev.kind === 'lockclose') {
                const tag = ev.persistTag ?? -1;
                const flag = tag < 0
                    ? outOfBandFlagForWriter({ as3: 'Lock', level, tag })
                    : outOfBandFlagFor(level, tag);
                lockWrites.push({
                    id: ev.id, level, flag, t: ticksCompleted,
                    value: ev.kind === 'lockclose',
                });
                if (ev.kind === 'lockopen') {
                    if (!pendingEarnedClears.has(flag.level)) {
                        pendingEarnedClears.set(flag.level, new Set());
                    }
                    pendingEarnedClears.get(flag.level).add(flag.tag);
                    // ⚠ AND ONLY AN OUT-OF-BAND ONE IS CASHED. A flag in
                    // THIS level stays pending: `applyEarnedClears` drops
                    // the world memo, and dropping it mid-visit also drops
                    // the activator and pushable state — which for the room
                    // this arm exists to model would erase the covers, the
                    // locks and the three blocks on the tick the shaft
                    // finally opened. The flag changes nothing this level
                    // builds anyway (`Lock.check()` needs `tSet < 0`), so
                    // there is nothing to cash.
                    if (flag.level !== level) applyEarnedClears(flag.level);
                } else {
                    // `returnToNormal()` writes TRUE — the flag goes back
                    // ON, so it leaves the cleared ledger. A model that
                    // only banked the opening would report a clear the game
                    // has taken back.
                    const tags = pendingEarnedClears.get(flag.level);
                    if (tags) tags.delete(flag.tag);
                    const list = clearedByLevel.get(flag.level);
                    if (list) {
                        const at = list.indexOf(flag.tag);
                        if (at >= 0) list.splice(at, 1);
                    }
                }
                continue;
            }
            if (ev.kind === 'keyopen') {
                keyOpens.push({
                    id: ev.id, level, persistTag: ev.persistTag, t: ticksCompleted,
                });
                // `Game.setPersistence(tag, false)` — banked exactly as a
                // `Lock.turnOff()`'s is, and cashed when the destination
                // world is built. `BossLock.check()` is
                // `tag >= 0 && !checkPersistence(tag) -> remove(this)`, with
                // no `tSet` test at all, so an opened boss lock is GONE on
                // the next visit rather than merely non-solid on this one.
                if (ev.persistTag >= 0) {
                    if (!pendingEarnedClears.has(level)) {
                        pendingEarnedClears.set(level, new Set());
                    }
                    pendingEarnedClears.get(level).add(ev.persistTag);
                }
                continue;
            }
            if (ev.kind === 'roomwrite') {
                // ⛓ R5 slice 5 step 2: a `ButtonRoom` with `room >= 0`.
                //
                // Two writes, and they are not the same shape. The FIRST is
                // in another level entirely and is what the route is for:
                // `levelPersistence[room * 30 + tset] = persist`, and the
                // next `new Game(room, ...)` builds without whatever that
                // flag was holding up (for L38's `{tset: 8, flip: 1,
                // room: 39}`, `Lock.check()`'s `tSet < 0 && !checkPersistence
                // (tag)` deletes L39's plug at BUILD time). The SECOND is
                // its own tag, here.
                //
                // ⚠ ONLY A `false` IS A CLEAR. `flip` decides the sign and a
                // `flip = 0` button writes TRUE — which is a persistence
                // write the game makes and the ledger's "cleared" list does
                // NOT contain. Banking it as a clear would put an entry in
                // an exact set that the game never reports.
                for (const w of ev.writes) {
                    const at = w.level === null ? level : w.level;
                    roomWrites.push({
                        id: ev.id, from: level, level: at, tag: w.tag,
                        value: w.value, which: w.which, t: ticksCompleted,
                    });
                    if (w.value !== false) continue;
                    if (!pendingEarnedClears.has(at)) pendingEarnedClears.set(at, new Set());
                    pendingEarnedClears.get(at).add(w.tag);
                }
                // ⚠ AND THE WRITE INTO ANOTHER LEVEL IS CASHED IMMEDIATELY.
                // `applyEarnedClears` runs on the transition path for the
                // level being ENTERED, which is right for a flag in the
                // level the player is standing in — dropping that memo
                // mid-visit would despawn an entity the game keeps until the
                // next `new Game`. A flag in a level the player is NOT in
                // has no such constraint, and holding it back would leave a
                // memoised world that the game has already invalidated.
                for (const w of ev.writes) {
                    if (w.level === null || w.value !== false) continue;
                    applyEarnedClears(w.level);
                }
                continue;
            }
            if (ev.kind === 'snap') {
                if (lockSnap) {
                    throw new Error(`levelRun: ${ev.id} in level ${level} snapped the `
                        + `player while ${lockSnap.id}'s window was still open. Two `
                        + 'position-writing ceremonies at once is not transcribed — '
                        + 'route the walk so it touches one lock at a time.');
                }
                lockSnap = {
                    id: ev.id,
                    level,
                    persistTag: ev.persistTag,
                    from: ticksCompleted,
                    y: ev.y,
                };
                pendingSnapY = ev.y;
            } else if (ev.kind === 'turnoff' && lockSnap && lockSnap.id === ev.id) {
                // ⚠ `ShieldLock.turnOff()` restores `receiveInput` only
                // `if (p)`, and `p` is the collide it re-ran THIS tick. A
                // player carried out of the rect by the velocity the snap
                // did not clear never gets input back — no later span can
                // reach them, and the run is over without saying so.
                if (!ev.touching) {
                    throw new Error(`levelRun: ${ev.id} in level ${lockSnap.level} `
                        + 'finished its fade with the player OUTSIDE its collide rect, '
                        + "so `ShieldLock.turnOff`'s `if (p)` never ran and "
                        + '`receiveInput` is never restored. That is terminal in the '
                        + 'game: no tape span can reach the player again. The touch has '
                        + 'to leave them inside the rect for the whole window, so what '
                        + 'moved them is the velocity they carried into the snap.');
                }
                lockSnaps.push({
                    ...lockSnap,
                    to: ticksCompleted,
                    ticks: ticksCompleted - lockSnap.from,
                });
                // `Lock.turnOff()`'s third line, and the one with a future in
                // it: `Game.setPersistence(tag, false)`. Banked rather than
                // applied — see `pendingEarnedClears`.
                if (lockSnap.persistTag >= 0) {
                    const lvl = lockSnap.level;
                    if (!pendingEarnedClears.has(lvl)) pendingEarnedClears.set(lvl, new Set());
                    pendingEarnedClears.get(lvl).add(lockSnap.persistTag);
                }
                lockSnap = null;
            }
        }
    }

    /**
     * Does the CURRENT position stand on an uncollected pickup?
     *
     * ⚠ Tested BEFORE the step, because `World.addUpdate` PREPENDS and
     * `loadlevel` adds the Player before the pickups — so a `Pickup` tests
     * the position the PREVIOUS tick left, exactly as a teleporter does.
     * The recording agrees: the contact observation is 23 and the freeze
     * covers 23..57, i.e. the pickup saw observation 23 and the advance that
     * would have produced 24 became phase B's first frame instead.
     */
    function pickupUnderfoot() {
        if (!world.pickups) return null;
        const box = playerBoxAt(state.x, state.y);
        for (const p of world.pickups) {
            if (collectedPickups.has(pickupKey(level, p))) continue;
            // ⛔⛔⛓ R5 SLICE 23: THE WAND'S GATE WRAPS THE CONTACT TEST, NOT
            // ONLY THE FADE — and reading it as "the fade is gated" is a
            // green control that collects the item it was built to prove
            // cannot be collected.
            //
            // `Wand.update`'s whole body is inside
            // `if ((p && p.y < y + Tile.h && Player.hasAllTotemParts()
            //      && !p.fallFromCeiling) || !doBossActions)`,
            // and `super.update()` — `Pickup.update`, which is the ONLY
            // thing that ever calls `collide("Player", x, y)` — is the ELSE
            // of the alpha ramp INSIDE it. So a wand whose gate is shut runs
            // no update at all: it does not fade, and it does not notice a
            // player standing on it.
            //
            // ⚠ Found by the pair. The first cut gated only the fade, and
            // the control — which presents NO totem parts — collected the
            // wand, woke the boss and reproduced the clamp tick for tick.
            // A control that does the thing it exists to refute is not a
            // weak control, it is not a control.
            if (p.tag === 'wand' && !wandFadeGateOpen({
                playerY: state.y,
                wandY: p.y,
                hasAllTotemParts: hasAllTotemParts(),
                fallFromCeiling: false,
            })) continue;
            // ⛓⛓⛓ R6 SLICE 6d: A SEED WITH `cutscene[2]` SET IS A TREE, AND
            // A TREE IS NOT A PICKUP.
            //
            // `Game.as:2185` passes `cutscene[2]` as `Seed`'s fifth ctor
            // argument, and `Seed.update`'s whole body is
            // `if (drawCover) {…} else if (!tree) super.update();` — so the
            // tree branch never reaches `Pickup.update` and therefore never
            // runs `collide("Player", x, y)`. It cannot be walked onto.
            //
            // ⚠ NAMED RATHER THAN LEFT TO `collectedPickups`. The set would
            // skip it too (the first visit collected it), and that is the
            // wrong reason: it would also skip a tree in a room the run had
            // never collected from, and it would stop skipping the moment
            // anything reset the set.
            if (p.tag === 'seed' && cutscene[2]) continue;
            if (rectsOverlap(box, p.rect)) return p;
        }
        return null;
    }

    /**
     * ⛓⛓⛓ R6 SLICE 6c: ONE FROZEN TICK, EXTRACTED — one implementation, two
     * callers.
     *
     * This was the pickup ceremony's `else` arm verbatim, and it stayed there
     * for three rungs because it had exactly one caller. A PLACED NPC's
     * dialogue raises the same flag by a different route
     * (`NPCs/NPC.as:194` — `if (talking) Game.freezeObjects = true`, every
     * frame, inside `talk()`), and every line below is about the FLAG rather
     * than about a pickup: the bridge windows, the burnt fire window, the
     * refused thrust, the activators that keep running, the camera that keeps
     * lerping, the i-frame that keeps draining. Copying it would have made
     * two models of one freeze — [[feedback_two_cost_models_must_agree]].
     *
     * ⚠ `what` NAMES THE FREEZE'S SOURCE IN EVERY REFUSAL, because "press
     * outside the ceremony" is unhelpful advice when the freeze is a
     * dialogue the player walked into.
     *
     * @param {object} activators the level's activator state, as of tick top
     * @param {string} what       what raised the freeze, for the messages
     */
    const runFrozenTick = (activators, what) => {
        // ⚠ A FROZEN TICK IS NOT A RENDERED FRAME AS FAR AS THIS MODEL IS
        // CONCERNED, and a bridge does not know that. `Tile.render` keeps
        // running, so the game would open one EARLIER than the tick count
        // says. Named here rather than discovered as a crossing that
        // happened too soon.
        assertBridgeWindows({ frozen: true });
        // `genericHit` returns immediately under `Game.freezeObjects`, so a
        // thrust scheduled by the press before a freeze would silently do
        // NOTHING.
        // ⚠ AND A FROZEN FRAME BURNS A FIRE WINDOW rather than stretching it:
        // `sprites()` is called unconditionally, so the animation advances
        // while `genericHit` returns at its first line. The hits are LOST,
        // silently. (`fireVerb.FIRE_DEAD_FRAME_RULE`.)
        if (fireWindows.some((w) => w.hitTicks.has(ticksCompleted))) {
            throw new Error('levelRun: a fire window\'s hit tick '
                + `${ticksCompleted} falls on a FROZEN tick (${what}). \`sprites()\` `
                + 'still advances `sprFire` and `genericHit` returns '
                + 'immediately under `Game.freezeObjects`, so the window '
                + 'BURNS — the press lands nothing. Press outside the freeze.');
        }
        if (pendingThrust) {
            throw new Error(`levelRun: a ${pendingThrust.weapon} press at tick `
                + `${pendingThrust.pressTick} would fire its rect on a FROZEN `
                + `tick (${what}), and \`genericHit\` returns immediately under `
                + '`Game.freezeObjects` — so the press would do nothing at '
                + 'all. Press outside the freeze.');
        }
        ticksCompleted++;
        // The game keeps updating every non-Mobile entity through a freeze,
        // so a Button under the frozen player stays pressed and a Lock's fade
        // keeps running. Unobservable on R3's route — no ceremony is near a
        // presser — but transcribed rather than assumed, because "no route
        // does that yet" is how the statue got its offset wrong for two
        // slices.
        if (!noclip) {
            applyLockEvents(stepActivators(activators, world,
                playerBoxAt(state.x, state.y),
                { inventory, keys, movingSolids: movingSolidsNow() }));
        }
        // ⛓ R5 SLICE 22: AND `view()` STILL RUNS. `Game.update` gates only
        // `super.update()` — on `blackCover`, not on `freezeObjects` — so the
        // camera keeps lerping toward a stationary player through every
        // frozen frame, which is what can bring an enemy on screen during a
        // ceremony. The same argument as `freezeStep` above, one frame higher
        // up.
        stepCameraNow(state, world.world);
        // ⛓⛓⛓ R6 SLICE 3: AND SO DOES `hitUpdate()`, for the SAME reason one
        // line lower — it sits outside `super.update()` in `Player.update`,
        // and `Game.freezeObjects` gates only what is inside `mobileUpdate`.
        // So an i-frame window DRAINS through a ceremony while the hit that
        // would open one is swallowed by it. Opposite directions, one flag.
        {
            const d = stepPlayerDamage(damage);
            damage = d.state;
            // The facing hand-back writes `Player.direction`, which lives in
            // `state` on this side.
            if (d.recovered && d.direction !== null) {
                state = { ...state, direction: d.direction };
            }
        }
        // No step: the position is unchanged and — critically — so is the
        // VELOCITY, which is why the player drifts on for a few ticks once
        // the freeze lifts.
        return {
            transition: null, grant: null, hitX: null, hitY: null, frozen: true,
        };
    };

    /**
     * ⛓⛓⛓ R6 SLICE 6c: THE WATCHER'S OWN `talk()`, TRANSCRIBED IN PLACE.
     *
     * `NPCs/NPC.as:184-236` and `Watcher.as:62-137`, in the game's order —
     * which is the part a paraphrase gets wrong:
     *
     * ```as3
     *   Watcher.update: if (Game.checkPersistence(tag)) super.update();   // ← talk()
     *   NPC.talk:
     *     inRange = FP.distance(x, y, p.x, p.y) <= talkRange;   // a CIRCLE, 24
     *     hitKey  = Input.released(p.keys[6]);
     *     if (talking) { Game.freezeObjects = true;  …advance…  if (exhausted) {
     *                       talking = false;  return; } }        // ← RETURNS
     *     if (inRange) { if ((hitKey || !keyNeeded) && !Game.talking) startTalking(); }
     *     else         { talked = false; if (talking) talking = false; }
     * ```
     *
     * Four things that order decides, all of them load-bearing:
     *
     *   1. ⛔ **THE FREEZE IS RAISED INSIDE THE `talking` BLOCK, NOT BY THE
     *      SETTER.** So the START frame is a LIVE tick — the player moves on
     *      it — and every frame after it is frozen until the pages run out.
     *   2. ⛔ **THE STARTING RELEASE DOES NOT ALSO ADVANCE A PAGE**, because
     *      `if (talking)` is tested above `startTalking()`. Letting one
     *      release do both finishes the dialogue a page early, and for the
     *      Watcher that moves the live-seed window from index 9 to 8.
     *   3. ⛔ **THE FINISHING FRAME `return`s**, so the `inRange` arm never
     *      runs on it — and `talked` is already true, so nothing restarts.
     *   4. ⛔⛔ **THE OUT-OF-RANGE ARM CALLS `doneTalking()` THROUGH THE
     *      SETTER**, which for the Watcher is the `{114,0}` write. Walking
     *      away mid-dialogue EARNS THE TAG. A control built on "walk out of
     *      range" clears the flag it exists to withhold.
     *      → [[feedback_leaving_the_radius_still_pays]]
     *
     * ⚠ AND `keyNeeded` IS FALSE FOR EVERY WATCHER IN THE EXTRACT.
     * `Watcher.as:46` is `keyNeeded = !Game.checkPersistence(tag)` and a
     * fresh boot's persistence array is all `true`, so the dialogue opens on
     * PROXIMITY with no key at all. That is why this runs before the
     * ceremony block and why a window can boot into the circle.
     *
     * @returns {{frozen: boolean}} `frozen` means the player must not move
     */
    const stepWatchersNow = (released) => {
        const st = watcherStateFor(level);
        if (st.size === 0) return { frozen: false };
        const box = playerBoxAt(state.x, state.y);
        let frozen = false;
        for (const w of st.values()) {
            /**
             * ⛔⛔⛔ R6 SLICE 6d: THE TAG GATES `talk()` AND NOTHING ELSE.
             *
             * `Watcher.update`'s first statement is
             * `if (Game.checkPersistence(tag)) super.update();` — and every
             * line BELOW it is ungated: the seed-holding arm, the
             * `hitsTimer` decrement, the `hits` arm that spawns the bloody
             * `Seed`. Slice 6c's `continue` on `cleared` was correct for the
             * only half that existed then and would have made W-blood
             * impossible: the hits gate on the CLEARED tag, so the exact
             * state that turns `talk()` off is the one that turns the sword
             * on. Split here rather than moved, so both halves name the
             * line they come from.
             */
            const canTalk = !w.cleared && w.persistTag >= 0 && !!w.text;
            const player = { x: state.x, y: state.y };
            const npc = { x: w.ex, y: w.ey };
            const inRange = inTalkRange(npc, player);

            let finished = null;
            if (!canTalk) {
                // `super.update()` — and therefore `talk()` — did not run.
            } else if (w.talking) {
                // `Game.freezeObjects = true`, every frame, ABOVE the key test.
                frozen = true;
                const r = stepNpcDialogue(w.dialogue, released, inRange);
                if (w.dialogue.done) {
                    finished = r.left ? 'left' : 'done';
                }
            } else if (inRange && !w.talked) {
                // `startTalking()` — and NOT an advance this frame (2 above).
                // ⛓ The RENDER still types, so the frame costs one character
                // of `Game.talk()`: `stepDialogue(d, false)`.
                w.dialogue = beginNpcDialogue(w.text, {
                    talkingSpeed: w.talkingSpeed,
                    framesThisCharacter,
                });
                w.talking = true;
                w.talked = true;
                stepDialogue(w.dialogue, false);
                // ⛔ NOT frozen on this frame — the freeze is raised by the
                // NEXT frame's `talk()`, and `Game.update`'s
                // `else if (inventory) inventory.open = false` has already
                // lowered whatever this frame left up.
            }

            if (finished !== null) {
                w.talking = false;
                frozen = false;
                framesThisCharacter = w.dialogue.framesThisCharacter;
                // `Watcher.doneTalking()` — `if (Game.checkPersistence(tag))
                // Game.setPersistence(tag, false)`. A CLEAR, the polarity the
                // whole R6 ledger runs on.
                w.cleared = true;
                const flag = { level: w.level, tag: w.persistTag, value: false };
                watcherFlags.set(ledgerKey(flag), { ...flag, id: w.id, level: w.level });
                if (!pendingEarnedClears.has(w.level)) {
                    pendingEarnedClears.set(w.level, new Set());
                }
                pendingEarnedClears.get(w.level).add(w.persistTag);
                watcherTalks.push({
                    t: ticksCompleted + 1,
                    level: w.level,
                    id: w.id,
                    cause: finished,
                    pages: w.dialogue.pages.length,
                    page: w.dialogue.page,
                    frames: w.dialogue.frames,
                    flag,
                });
            }

            // ── the stance, EVERY TICK the seed can be out ──────────────
            //
            // `Watcher.update:68-74` — the live `Seed` exists while
            // `text != "" && talking && checkPersistence(tag) &&
            // myCurrentText in [seedIndexMin, seedIndexMax]`.
            const page = w.dialogue?.page ?? 0;
            const seedLive = w.talking && !w.cleared
                && page >= WATCHER.seedIndexMin && page <= WATCHER.seedIndexMax;
            if (seedLive) {
                if (boxHitsWatcherSeed(box, w.oel)) {
                    throw new Error('levelRun: the stance overlaps the Watcher\'s LIVE '
                        + `SEED at tick ${ticksCompleted} (page ${page} of `
                        + `${w.dialogue.pages.length}, box `
                        + `${JSON.stringify(watcherSeedBox(w.oel))}). That Seed is `
                        + '`bloody = false, tree = false`, so collecting it takes '
                        + '`Seed.update`\'s plain arm — `Game.cutscene[2] = true` and a '
                        + 'reboot into a level with no `seed` object to grow — and '
                        + '`Game.as:956` then spawns the player `receiveInput = false; '
                        + 'visible = false; active = false` for EVERY later world. It '
                        + 'is a SOFT-LOCK, not a lost pickup, and it looks exactly like '
                        + 'a dead bot. Move the stance.');
                }
                const s = watcherSeedBox(w.oel);
                watcherSeedLive.push({
                    t: ticksCompleted,
                    level: w.level,
                    id: w.id,
                    page,
                    // The stance's clearance from the box, per axis: how far
                    // the player's box would have to move to touch it.
                    clearanceX: Math.max(s.x - box.right, box.x - s.right),
                    clearanceY: Math.max(s.y - box.bottom, box.y - s.bottom),
                });
            }

            // ── ⛓⛓⛓ R6 SLICE 6d: THE SWORD HALF, BELOW THE TAG GATE ────
            //
            // `Watcher.as:86-110`, in the game's own order and ungated:
            //
            // ```as3
            //   if (hitsTimer > 0) { hitsTimer--; }
            //   if (hits > 0) {
            //       if (hits > dieFrames.length) {
            //           if (!createdSeed) { …add the bloody Seed… }
            //       }
            //   }
            // ```
            //
            // ⛔ THE DECREMENT IS ABOVE THE SPAWN AND BELOW THE PLAYER'S
            // PRESS. The Watcher updates BEFORE the Player, so the timer a
            // hit set on tick N is decremented for the first time on tick
            // N+1 and reaches 0 twenty-five ticks later — which makes the
            // press spacing 25 and not 26. Derived here rather than banked
            // as a constant, because the same class's `hitsTimerMax` is also
            // 25 and the two numbers being equal is a coincidence of this
            // ordering.
            if (w.hitsTimer > 0) w.hitsTimer -= 1;
            if (w.hits > 0 && bloodySeedDue(w.hits) && !w.createdSeed) {
                // `p = FP.world.nearestToEntity("Player", this)` then
                // `new Seed(p.x - 8, p.y - 8, true, …)`. ⛔ THE PLACEMENT IS
                // THE PLAYER'S LIVE POSITION, not the press's and not the
                // Watcher's — the seed lands wherever the player is standing
                // on the tick the WATCHER notices, which is the tick after
                // the one the hit landed on.
                w.createdSeed = true;
                const ent = bloodySeedEntity({ x: state.x, y: state.y });
                const id = `seed@runtime:${w.id}`;
                pendingSeedAdds.push({
                    id,
                    level: w.level,
                    ex: ent.x,
                    ey: ent.y,
                    text: BLOODY_SEED_TEXT,
                    arm: 'bloody',
                    from: w.id,
                });
                seedSpawns.push({
                    t: ticksCompleted, level: w.level, id, ex: ent.x, ey: ent.y,
                    from: w.id, hits: w.hits,
                    // ⛓ The tick it can first be COLLECTED, and the only
                    // number a plan may use: `FP.world.add` queues, so the
                    // seed's first update is the next tick's.
                    liveAt: ticksCompleted + 1,
                });
            }
        }
        return { frozen };
    };

    /**
     * ⛓⛓⛓ R6 SLICE 6d: THE RUNTIME SEED, WHICH UPDATES BEFORE EVERYTHING.
     *
     * `World.addUpdate` PREPENDS, so an entity added at runtime is at the
     * FRONT of the update list — ahead of the Watcher that made it and
     * ahead of the Player. Its `Pickup.update` therefore finds the overlap
     * with the position the PREVIOUS tick left, and the `Game.freezeObjects`
     * its `pick_up()` raises is up before `Mobile.mobileUpdate` reads it.
     *
     * ⛓ `_attract` is FALSE for every `Seed` (`Seed.as:31` passes it to
     * `Pickup`'s fifth parameter), so there is no reach and no acceleration
     * — collection is pure overlap, exactly as for the Watcher's live one.
     *
     * @returns {?object} the seed collected this tick, or null
     */
    const runtimeSeedUnderfoot = () => {
        if (runtimeSeeds.length === 0) return null;
        const box = playerBoxAt(state.x, state.y);
        for (const s of runtimeSeeds) {
            if (s.collected) continue;
            const b = seedBoxAt({ x: s.ex, y: s.ey });
            if (box.right > b.x && box.x < b.right
                && box.bottom > b.y && box.y < b.bottom) {
                return s;
            }
        }
        return null;
    };

    /**
     * ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR — one approach, two arms, and a
     * freeze that is DEAD where the Watcher's is a tick.
     *
     * `Scenery/FinalDoor.as:47-68`, transcribed by `endingChain.
     * stepFinalDoor`; this is the wiring, and the three things only the
     * wiring can say:
     *
     *   1. ⛔ **THE CEREMONY'S FRAMES ARE DEAD.** `SealController`'s
     *      CONSTRUCTOR sets `Game.freezeObjects = true` and the class never
     *      touches `Game.talking` — so `Game.update`'s `else if (inventory)
     *      inventory.open = false` never runs (`canInventory()` is true) and
     *      nothing lowers the flag between frames. The bot's dead-frame gate
     *      sees every one of them, `autoAdvance` refuses to dispatch into
     *      them (`freezeUp` is `Game.talking || helpUp`), and the tape's own
     *      X releases cannot reach `Input.released` through them. ⇒ the
     *      overlay ALWAYS runs its full length and the span is a LUMP in
     *      `frozenFramesOwed`, exactly like a pickup's phase A.
     *   2. ⛓ **THE TRIGGER TICK IS LIVE AND ITS PLAYER IS FROZEN.** The door
     *      updates before the player (`Game.loadlevel` adds it at `:2190`
     *      and the Player at `:2092`; `World.addUpdate` PREPENDS), so the
     *      constructor's write lands before `Mobile.mobileUpdate` reads it —
     *      but the dead-frame gate at the TOP of that frame saw `false`, so
     *      the tape's counter advances through it.
     *   3. ⛔ **AND THE OPEN IS THE SAME APPROACH.** `SealController.
     *      removed()` nulls `parent.mySealController` from `updateLists()`,
     *      which runs after `world.update()` — so the door's very next
     *      update finds the second arm reachable with the player still
     *      standing inside the 32 px circle. §2.5's "only on a LATER
     *      approach" is wrong; what IS true is that leaving the radius
     *      resets `seenSeal` and re-approaching fires a FRESH ceremony.
     *
     * @returns {{frozen: boolean}} `frozen` means the player must not move
     */
    const stepFinalDoorsNow = () => {
        const st = finalDoorStateFor(level);
        if (st.size === 0) return { frozen: false };
        let frozen = false;
        // `!Game.checkPersistence(0, 114)` — a CROSS-LEVEL read, and the
        // only one in the game. `FinalDoor.as:50`'s own comment names it:
        // "0 is the tag for the Watcher's text, while 114 is the room that
        // it refers to."
        const talkedToWatcher = (clearedByLevel.get(WATCHER_FLAG.level) ?? [])
            .includes(WATCHER_FLAG.tag)
            || [...watcherFlags.values()].some((f) => f.level === WATCHER_FLAG.level
                && f.tag === WATCHER_FLAG.tag);
        // `SealController.hasAllSealParts()` is `Main.hasSealPart(SEALS - 1)
        // != -1` — the LAST SLOT, not a count. A save with fifteen
        // identities in slots 0..14 leaves slot 15 at -1 and the door stays
        // shut, which is exactly what the control declares.
        const hasAllSealParts = sealParts[SAVE_SLOTS.seal_parts - 1] !== -1;
        for (const d of st.values()) {
            // ⛔⛔⛔ `updateLists()` RUNS AFTER `world.update()`, AND THE
            // PLAYER UPDATES INSIDE IT.
            //
            // `animEnd` calls `FP.world.remove(this)`, which only QUEUES the
            // entity: `Engine.update` is `FP._world.update(); FP._world.
            // updateLists();`, so the door is still in the type list for the
            // rest of the frame — including the Player's own sweep, which
            // runs later in the very same pass. ⇒ the wall stands for ONE
            // MORE tick after the animation ends, and `removed()` (the
            // `{113,0}` write, and the type-list departure) lands at the end
            // of that frame, which is the top of this one.
            //
            // ⛓ THE GAME REFUTED THE MODEL ON EXACTLY THIS. The first
            // recording diverged at observation 94 — model 33.50, game 34.50
            // — and the step SEQUENCE either side was identical (1.55, 1.30,
            // 1.05, 0.80, 1.35), so the model had taken one extra step and
            // nothing else was wrong. R5 slice 5 found the same fencepost in
            // `ShieldBoss` and called it the third of three; this class has
            // no `destroy` and no fade, so for it the fencepost is the WHOLE
            // removal. → [[feedback_destroy_is_not_removal]]
            if (d.pendingRemove) {
                d.pendingRemove = false;
                d.removed = true;
            }
            const inRadius = Math.sqrt((d.ex - state.x) ** 2 + (d.ey - state.y) ** 2)
                <= FINAL_DOOR.seeDistance;
            const r = stepFinalDoor(d, {
                inRadius,
                // The overlay is resolved as a LUMP on its own trigger tick
                // (see 1 above), so by the next model tick it is gone.
                sealControllerUp: false,
                hasAllSealParts,
                talkedToWatcher,
            });
            Object.assign(d, r.state);
            if (r.event === 'ceremony') {
                const frames = sealControllerTicks();
                frozenFramesOwed += frames;
                frozen = true;
                doorCeremonies.push({
                    t: ticksCompleted, level, id: d.id, frames,
                    // ⚠ NAMED FALSE RATHER THAN OMITTED. The overlay IS
                    // X-dismissable from frame 61 in the game — and no tape
                    // can supply the release, because every frame of it is a
                    // dead frame (`sealCeremony.SEAL_AUTOADVANCE_BLIND_SPOT`).
                    dismissable: false,
                });
            } else if (r.event === 'open') {
                doorEvents.push({ t: ticksCompleted, level, id: d.id, what: 'open' });
            } else if (r.event === 'removed') {
                // `stepFinalDoor` reports the ANIMATION's end and sets
                // `removed`; the wall does not go until `updateLists()`, so
                // the flag is deferred to the top of the next tick (above).
                d.removed = false;
                d.pendingRemove = true;
                doorEvents.push({
                    t: ticksCompleted,
                    level,
                    id: d.id,
                    what: 'removed',
                    // ⛓ The tick the PLAYER can first walk through it — one
                    // later, and the only number a route may use.
                    wallOpensAt: ticksCompleted + 1,
                });
                if (d.persistTag >= 0) {
                    const flag = { level, tag: d.persistTag, value: false };
                    finalDoorFlags.set(ledgerKey(flag), { ...flag, id: d.id, level });
                    if (!pendingEarnedClears.has(level)) {
                        pendingEarnedClears.set(level, new Set());
                    }
                    pendingEarnedClears.get(level).add(d.persistTag);
                }
            }
        }
        return { frozen };
    };

    return {
        get level() { return level; },
        get world() { return world; },
        get state() { return state; },
        get transitions() { return transitions; },
        /** The `transitions` entries a PIT FALL produced, not a teleporter. */
        get transports() { return transports.map((r) => ({ ...r })); },
        get ticksCompleted() { return ticksCompleted; },
        get inventory() { return { ...inventory }; },
        /**
         * The equip mirror (R4): the slot `Main.primary` should hold, and
         * the slot array `Inventory` should have built.
         *
         * ⚠ THE GAME IS STILL THE ORACLE. `botStatus` reports its OWN
         * `Main.primary` and SCANS its own `Inventory`, and the differential
         * compares them against these — so a slot-order divergence is a
         * named failure at the first observation after any collection,
         * rather than a mysterious slash-instead-of-thrust later. Reading
         * this for both sides would be the mirror agreeing with itself.
         */
        get primary() { return primary; },
        /**
         * ⛓ R5 slice 9: WHICH WEAPON the selected slot would fire.
         *
         * `useItem(Main.primary)` reads the slot, and the four arms are
         * four different mechanics. Exposed so a leg verb can refuse a
         * press the run would route through the wrong one BY NAME, rather
         * than letting the effect check report the target unmoved.
         */
        get primaryWeapon() { return weaponForPress(); },
        get inventorySlots() { return inventorySlotsFor(inventory); },
        /**
         * R4: the facing (`Player.direction`) as of the END of the last
         * completed tick — which is exactly the value a press on the NEXT
         * tick captures as `spearDirection`.
         *
         * ⚠ THE LAG IS THE WHOLE REASON THIS IS A GETTER AND NOT A
         * PARAMETER. `sprites()` runs after `super.update()`, so the
         * direction a leg's press uses is the one the tick BEFORE it left
         * behind. A synthesis that computed the rect from the press tick's
         * own post-move velocity would be one tick out, and every press
         * stance the R4 route uses is a player pinned against a wall — the
         * one place where "the direction I am holding" and "the direction
         * my velocity last had" are different.
         */
        get direction() { return state.direction; },
        /** One record per equip that fired: `{t, slot}`. */
        get equipsFired() { return firedEquips.map((e) => ({ ...e })); },
        /** ⛓ R5 slice 7: every plain-`Lock` persistence write, in order. */
        get lockWrites() { return lockWrites.map((w) => ({ ...w, flag: { ...w.flag } })); },
        /** ⛓ R5 slice 7: every rope this run pulled, in order. */
        get ropePulls() { return ropePulls.map((r) => ({ ...r, flag: { ...r.flag } })); },
        /**
         * ⛔⛔ R5 slice 10: one record per `FallRock` an activator publication
         * DROPPED — `{id, level, t, flag, deadFrames}`.
         *
         * The claim the refuted shaft recording could not be checked against:
         * {39,10} is in the game's ledger and 197 of its 217 dead frames are
         * this. Exposed as its own list rather than folded into
         * `earnedClears`, for §22.8's reason — a banked clear is cashed on
         * the next BUILD, so a run that never leaves the level reports none.
         */
        get treeBurns() { return treeBurns.map((b) => ({ ...b, flag: { ...b.flag } })); },
        get rockFalls() { return rockFalls.map((r) => ({ ...r, flag: r.flag && { ...r.flag } })); },
        /**
         * ⛔⛔ R5 slice 13: every spinner that has LEFT THE WORLD this visit,
         * and what took it — `{id, tag, cause}` per level.
         *
         * `Spinner.removed()` writes `Game.setPersistence(tag, false)` with no
         * test of the cause, and `Enemy.update` destroys one in water and lava
         * and fades one out over a pit. ⇒ **a billiard that bounces into a
         * hazard banks the same flag a sword kill does**, on a tick no route
         * chose. Exposed so a ledger assertion can be two-sided about it: a
         * shaft plan that predicts nine writes has to survive a spinner
         * quietly earning a tenth, and until this list existed the model could
         * not have reported one. (`spinner.SPINNER_TERRAIN_WRITE`.)
         *
         * ⚠ PER VISIT, and by level — a re-entered room rebuilds its
         * spinners, and it is `buildLevelWorld`'s `check()` arm that keeps a
         * dead one dead.
         */
        /**
         * ⛓⛓ R5 SLICE 13: WHERE THE SPINNERS WILL BE, for the next `n` ticks.
         *
         * The whole reason `Spinner` is the one enemy worth modelling:
         * `runRange = 0` makes its chase arm dead code and `activeOffScreen`
         * takes the camera out of it, so the trajectory is a function of the
         * level's geometry and the tick index — and can therefore be run
         * FORWARD from here without the player's future being known.
         *
         * `forecast[i]` is the state at the top of tick
         * `ticksCompleted + 1 + i`, which is when the blocks read it.
         *
         * ⚠⚠ IT IS A SEARCH HEURISTIC, NOT AN ORACLE, and the difference is
         * load-bearing. It holds the PUSHABLES where they are now, so a
         * spinner that would have bounced off a block mid-glide is one tick
         * of geometry out. That is sound only because the thing downstream of
         * it is `runFire`'s exact-set effect check, which drives the REAL
         * models and fails by name: a wrong forecast costs a refused press,
         * never a wrong tape. A forecast used to ASSERT anything would be
         * [[feedback_two_cost_models_must_agree]] — a fast path predicting a
         * slow one — and this one is allowed to be approximate precisely
         * because nothing believes it.
         *
         * ⚠ AND IT DOES NOT MUTATE. The live state is deep-copied per
         * spinner; `stepSpinner` returns new objects, so copying the Map's
         * values is enough.
         */
        spinnerForecast(n) {
            const live = spinnerStateFor(level);
            if (live.byId.size === 0) return [];
            const st = { byId: new Map([...live.byId].map(([k, v]) => [k, { ...v }])), level };
            const ctx = spinnerCtx();
            const out = [];
            for (let i = 0; i < n; i += 1) {
                stepSpinners(st, ctx);
                out.push(spinnerRects(st).map((s) => s.rect));
            }
            return out;
        },
        /**
         * ⛔⛔ R5 slice 13: `{t, level, id, flag, cause}` per `Spinner.removed()`.
         *
         * The ledger half of `spinnerDeaths`, in the shape `lockWrites` and
         * `ropePulls` use — a persistence write with a tick on it, so a plan
         * can assert WHEN as well as whether.
         */
        get spinnerWrites() { return spinnerWrites.map((w) => ({ ...w, flag: { ...w.flag } })); },
        /** ⛔⛔ R5 slice 13: `{t, level, pulser, enemy}` per enemy a pulse killed. */
        get pulserEnemyKills() { return pulserEnemyKills.map((k) => ({ ...k })); },
        get spinnerDeaths() {
            const out = [];
            for (const [n, st] of spinnerStates) {
                for (const w of spinnerTerrainWrites(st)) out.push({ level: n, ...w });
            }
            return out;
        },
        /**
         * ⛓⛓ Frozen frames this run spent that the TAPE never advanced
         * through — the run's half of the `dead_frames` readout.
         *
         * ⚠ NOT THE WHOLE READOUT. A tape's `dead_frames` is this plus one
         * room-load fade per world build (~19-21, and §22.6 measured it as a
         * VARIABLE) plus any ceremony's own freeze. The three are summed by
         * the caller that knows how many loads its window has, because this
         * module does not.
         */
        get frozenFramesOwed() { return frozenFramesOwed; },
        /**
         * Ticks the tape's own `equips` name that the run never reached.
         *
         * The `unfiredGrantLevels` rule, one field over: a declared equip
         * that never fires is a tape claiming a selection the walk does not
         * make, and every press after it would be a SWORD SLASH with nothing
         * saying so.
         */
        get unfiredEquipTicks() { return [...equipsByTick.keys()]; },
        /** Select `Main.primary` at the tick the run has reached (R4). */
        equipNow,
        /**
         * The key types this run has collected — `Main.SAVE_FILE.data.hasKey`
         * as a set. A `BossLock` opens on exactly this.
         */
        get keys() { return new Set(keys); },
        /**
         * ⛓⛓⛓ R7 SLICE 1 (R6 debt 6): THE MODEL'S SAVE ARRAYS, in the
         * GAME's own shape — `botStatus.save`'s counterpart.
         *
         * `botStatus.save` has shipped since R5 slice 23 and NOTHING read
         * it: the sixteen booted seals and the driven key collect were
         * asserted from the model side and the stream, never from the
         * game's own array. This is the other end.
         *
         * ⛔ AND `seal_parts` IS DELIBERATELY NOT PREDICTED ELEMENT-WISE.
         * The identity in each slot is a REJECTION-SAMPLED DRAW taken at
         * chest OPEN (`Chest.as:84-89`: `floor(Math.random()*16)` redrawn
         * until `getSealPart` accepts, ~54 draws over sixteen chests), so
         * "which seal" is a fact about a run's stream position and not
         * about the map. What IS predictable is HOW MANY SLOTS ARE FILLED
         * — one per chest opened, because the commit is a side effect
         * inside the sampler's own predicate — and that the boot-declared
         * prefix is untouched. The consumer asserts exactly that and names
         * the bound rather than asserting an identity it cannot know.
         */
        get saveState() {
            return {
                totem_parts: Array.from(
                    { length: SAVE_SLOTS.totem_parts }, (_, i) => totemParts.has(i)),
                keys: Array.from({ length: SAVE_SLOTS.keys }, (_, i) => keys.has(i)),
                /** The boot-declared prefix, unchanged by the run. */
                bootSealParts: [...(bootSave.seal_parts ?? [])],
                /** One per chest OPENED — the slots the run itself filled. */
                sealSlotsEarned: chestOpens.length,
            };
        },
        /**
         * One record per BossLock that finished its fade:
         * `{id, level, persistTag, t}`.
         *
         * The KEY half of the opener ledger. `lockSnaps` is what a shield
         * opened; this is what a key opened; `earnedClears` is both, keyed by
         * flag.
         */
        get keyOpens() { return keyOpens.map((r) => ({ ...r })); },
        /**
         * ⛓ R5 slice 5 step 2: every `ButtonRoom` cross-room write this run
         * made — `{id, from, level, tag, value, which, t}`.
         *
         * `from` is the level the button is IN and `level` the level the
         * flag is in; for the `which: 'own'` write they are the same. A
         * planner reads this to check that the write it routed for is the
         * write the run actually made, which no reachability count can say:
         * two different buttons in one room resolve to two different rooms.
         */
        get roomWrites() { return roomWrites.map((r) => ({ ...r })); },
        /**
         * One record per completed ceremony: `{t, level, item, frames}`.
         *
         * The crutch LEDGER at R3. A grant that fired is in `grantsFired`;
         * an item that was walked over and talked through is here. The
         * claim "collected for real, not granted" is exactly the statement
         * that the first list is empty and this one is not.
         */
        get collected() { return collected.map((c) => ({ ...c })); },
        /**
         * One record per COMPLETED touch-lock window:
         * `{id, level, persistTag, from, to, ticks, y}`.
         *
         * The differential reads this to expect `saw_input_refused` from the
         * game — the same two-sided rule a pit transport already follows.
         * Derived rather than declared on the tape for the same reason: a
         * tape field would need validating on the AS3 side too, to state
         * something both sides can already work out.
         */
        get lockSnaps() { return lockSnaps.map((r) => ({ ...r })); },
        /**
         * The pickups already TAKEN in the level the run is in, as planner
         * contact keys.
         *
         * ⚠ LIVE STATE, exactly like `openActivators`, and for exactly the
         * same reason. A pickup is an avoid volume because walking over one
         * freezes the game — and once it has been collected there is
         * nothing there at all, so the very tile the walk is standing on
         * after a ceremony would otherwise be reported unwalkable and every
         * plan from it would fail at its START. A planner with its own idea
         * of which pickups are gone would certify a route the executor then
         * refuses; reading it off the run means the two cannot disagree.
         */
        get takenPickups() {
            const keys = new Set();
            for (const p of world.pickups ?? []) {
                if (collectedPickups.has(pickupKey(level, p))) {
                    keys.add(`pickup:${p.tag}@${p.x},${p.y}`);
                }
            }
            return keys;
        },
        /**
         * The `(level, tag)` clears this run EARNED — turned off by opening
         * something rather than by the tape declaring it.
         *
         * The R3 ledger's other half: the game's `persistence_cleared`
         * readout should be the tape's declared list plus this, and nothing
         * else. Reported per level as `{level, tags}`.
         */
        get earnedClears() {
            const out = [];
            for (const r of lockSnaps) {
                if (r.persistTag < 0) continue;
                out.push({ level: r.level, tag: r.persistTag, by: r.id });
            }
            // R4: a BossLock whose fade completed. Same shape as a snap's,
            // and deliberately a SEPARATE loop: the two are different
            // mechanics that happen to write the same namespace, and folding
            // them would make "which openers did this walk use" unanswerable
            // from the ledger.
            for (const r of keyOpens) {
                if (r.persistTag < 0) continue;
                out.push({ level: r.level, tag: r.persistTag, by: r.id });
            }
            // R4: a lit lightpole cleared a flag. ⚠ DERIVED FROM THE FINAL
            // STATE, never from a count of hits — `LightPole.hit()` is a
            // TOGGLE, so an even number of presses leaves the flag exactly
            // as it started and a ledger that counted them would report a
            // clear the game does not have.
            for (const [key, held] of poleFlags) {
                if (held) continue;
                const [n, tag] = key.split(':').map(Number);
                if ((clearedByLevel.get(n) ?? []).includes(tag)) continue;
                out.push({ level: n, tag, by: 'lightpole' });
            }
            // ⛓ R5 slice 5 step 2: a `ButtonRoom`'s cross-room press.
            // ⚠ FILTERED ON THE VALUE, not on the existence of the write.
            // `flip` decides the sign and a `flip = 0` button writes TRUE —
            // a real `setPersistence` call that puts nothing in the game's
            // `persistence_cleared` readout, so an exact-set assertion that
            // banked it would go red against a correct walk.
            for (const r of roomWrites) {
                if (r.value !== false || r.tag < 0) continue;
                if (out.some((o) => o.level === r.level && o.tag === r.tag)) continue;
                out.push({
                    level: r.level, tag: r.tag,
                    by: r.which === 'room' ? `${r.id} (L${r.from} -> L${r.level})` : r.id,
                });
            }
            // R5: a broken rock. ⚠ NOT a toggle — `endAnim` writes `false`
            // once and the entity is gone — so unlike the lightpole this is
            // read off the writes rather than off a final state. And two
            // rocks that resolve to one flag are ONE entry, which is what
            // keying the map by the flag buys.
            for (const [key, r] of rockFlags) {
                const [n, tag] = key.split(':').map(Number);
                if ((clearedByLevel.get(n) ?? []).includes(tag)) continue;
                // ⚠ THE WRITER IS NAMED, because two families share this
                // map now: a `BreakableRock`'s `endAnim` and (R5 slice 12) a
                // `BurnableTree`'s `removed`. A label hard-coded to one of
                // them would report a burn as a break — the ledger's whole
                // job is attribution.
                const by = r.by ?? 'breakablerock';
                out.push({
                    level: n, tag,
                    by: r.level === n ? by : `${by} (L${r.level}, tag -1)`,
                });
            }
            // ⛓⛓⛓ R6 SLICE 4: THE FIRST BOSS KILL ON THE LADDER.
            // `BossTotem.removed()` runs `Game.setPersistence(tag, false)`,
            // so a kill is a CLEAR like a broken rock's and not a set — the
            // same polarity the MagicalLock has (§10.8) and the opposite of
            // what "a kill sets a flag" suggests. It belongs in this ledger
            // for that reason and not in a ledger of its own.
            for (const [key, r] of bossFlags) {
                const [n, tag] = key.split(':').map(Number);
                if ((clearedByLevel.get(n) ?? []).includes(tag)) continue;
                if (out.some((o) => o.level === n && o.tag === tag)) continue;
                out.push({ level: n, tag, by: r.id });
            }
            // ⛓⛓⛓ R6 SLICE 5: THE SHIELDSPIRE — the same polarity and a
            // DIFFERENT SITE. `BossTotem` writes from `removed()`, 241 ticks
            // after the kill; `ShieldBoss.startDeath` writes from inside the
            // killing HIT, 34 ticks BEFORE the body leaves the world. So a
            // tape that ends between the two owes this clear and would owe
            // the totem's nothing — which is why the two are separate loops
            // rather than one "boss died" arm.
            for (const [key, r] of shieldBossFlags) {
                const [n, tag] = key.split(':').map(Number);
                if ((clearedByLevel.get(n) ?? []).includes(tag)) continue;
                if (out.some((o) => o.level === n && o.tag === tag)) continue;
                out.push({ level: n, tag, by: r.id });
            }
            // ⛓⛓⛓ R6 SLICE 6c: THE WATCHER — the same polarity again, and a
            // site that is not a death at all. `Watcher.doneTalking()` writes
            // `setPersistence(tag, false)` when the dialogue is exhausted OR
            // when the player leaves the 24 px circle, so this is the first
            // entry in the ledger that a route can earn by walking AWAY.
            // Its own loop for that reason: "which openers did this walk use"
            // has to distinguish a dialogue from a kill.
            for (const [key, r] of watcherFlags) {
                const [n, tag] = key.split(':').map(Number);
                if ((clearedByLevel.get(n) ?? []).includes(tag)) continue;
                if (out.some((o) => o.level === n && o.tag === tag)) continue;
                out.push({ level: n, tag, by: r.id });
            }
            // ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR — `removed()` is
            // `Game.setPersistence(tag, false)` with no test of the cause,
            // and `animEnd` is the only caller. Its own loop because the
            // WRITE SITE is what a window has to name: the flag lands 56
            // ticks after the animation starts and on the same tick the wall
            // stops colliding, which is the opposite fencepost from the
            // ShieldBoss's (tag first, wall 34 ticks later).
            for (const [key, r] of finalDoorFlags) {
                const [n, tag] = key.split(':').map(Number);
                if ((clearedByLevel.get(n) ?? []).includes(tag)) continue;
                if (out.some((o) => o.level === n && o.tag === tag)) continue;
                out.push({ level: n, tag, by: r.id });
            }
            // ⛓⛓ R7 SLICE 6 — R6 DEBT 2, PAID. A collected pickup's own
            // `removed()` runs `Game.setPersistence(tag, false)` for fourteen
            // of the seventeen placed classes, so the shield's `{20,2}` and
            // the sword's `{10,0}` belong in this ledger and were missing
            // from it since R3.
            //
            // ⚠ ITS OWN LOOP, like every family above, because "which
            // openers did this walk use" has to distinguish a PICKUP from a
            // kill, a break and a dialogue — and because the write site is
            // different in kind: the other families open a WALL, this one
            // stops an item respawning.
            //
            // ⚠ AND IT IS ADDITIVE IN THE SAFE DIRECTION. The differential's
            // persistence claim is a SUBSET check — "everything the model
            // says was opened really is off in the game" — and its own
            // comment says the exact-set claim was waiting on exactly these
            // tags. A row added here can only make that check stricter.
            for (const [key, r] of pickupFlags) {
                const [n, tag] = key.split(':').map(Number);
                if ((clearedByLevel.get(n) ?? []).includes(tag)) continue;
                if (out.some((o) => o.level === n && o.tag === tag)) continue;
                out.push({ level: n, tag, by: r.id });
            }
            return out;
        },
        /** Is a touch-lock refusing input RIGHT NOW? The driver's gate. */
        get inputRefused() { return lockSnap !== null; },
        /**
         * Is a pickup ceremony up RIGHT NOW?
         *
         * ⚠ NOT the same condition as `inputRefused`, and the two must not
         * be collapsed. A ceremony sets `Game.freezeObjects`, which gates
         * `Mobile.mobileUpdate` entirely — the tape's movement spans are
         * inert but its X releases still reach `NPC.talk()`, which is how
         * the tape drives the dialogue at all. A touch-lock sets
         * `receiveInput = false`, which gates `Player.input()` — so movement
         * still happens and nothing at all should be pressed.
         *
         * Exists for the fixture author: the number of X releases a ceremony
         * needs is a function of its text, and reading it off the run is the
         * alternative to counting pages by hand seven times.
         */
        get inCeremony() { return ceremony !== null; },
        /** `{t, level, items}` per grant that fired, in firing order. */
        get grantsFired() { return firedGrants.map((g) => ({ ...g, items: [...g.items] })); },
        /**
         * Levels named by `grants` the run never entered. A grant that never
         * fires is a ROUTE CLAIM that silently stopped being true, which is
         * exactly how a routing regression hides behind a green tape — so
         * the caller turns a non-empty list into a named failure.
         */
        get unfiredGrantLevels() { return [...grantsByLevel.keys()]; },
        get noDamage() { return noDamage; },
        /**
         * ⛓⛓⛓ R6 SLICE 3: THE DAMAGE LEDGERS.
         *
         * `playerHits` is one row per LANDED `Player.hit` — with its source,
         * the running `hits`, the knockback that landed on each axis and the
         * `Game.shake` after the addition. `playerDeaths` is one per world
         * reboot, with the respawn the `Game` constructor computed.
         * `contactsSuppressed` is the negative half: a contact that reached
         * the player and paid NOTHING, with the gate that swallowed it
         * (`Bot.noDamage`, an open i-frame window, or a ceremony's freeze).
         *
         * ⛔ THE THIRD LIST IS THE ONE THAT IS EASY TO LEAVE OUT. A schedule
         * that leans on a hit landing and a schedule that leans on one being
         * swallowed produce identical positions when the model is wrong in
         * either direction; the only difference is here.
         */
        get playerHits() { return playerHits.map((h) => ({ ...h })); },
        get playerDeaths() { return playerDeaths.map((d) => ({ ...d })); },
        get contactsSuppressed() { return contactsSuppressed.map((c) => ({ ...c })); },
        /** `{hits, hitsTimer, directionFace}` right now. */
        get damage() { return { ...damage }; },
        /** `Game.shake` right now — a static, so it outlives every world. */
        get shake() { return shake; },
        /**
         * The tape's hazard-name set, so a caller re-asking the geometry a
         * question mid-drive asks it under the SAME coercion the physics is
         * running. Carried rather than re-derived for the reason `relax` is
         * one object: two ideas of which experiment this is.
         */
        get noHazards() { return [...noHazards]; },
        /**
         * The activator ids that are NOT solid right now, in the level the
         * run is in — or `null` under `noclip`, matching the arm `advance`
         * hands `stepV2`.
         *
         * ⚠ THIS IS THE PLANNER'S ONLY LEGITIMATE VIEW OF AN OPEN LOCK.
         * `botDriverV2` re-plans before every target, and a Lock's solidity
         * is per-tick state: shut, then open after 101 ticks on its button,
         * then shut again the moment the player steps off a volume they are
         * not inside. A planner with its own idea of which locks are open
         * would certify a route the executor then walks into a wall on —
         * the walkTo-divergence lesson, one mechanic later. Reading it off
         * the run means the two cannot disagree.
         */
        get openActivators() {
            return noclip ? null : openActivatorIds(activatorStateFor(level));
        },
        /**
         * R4: the same thing for the two press families — the planner's only
         * legitimate view of an opened bridge and a moved block.
         *
         * ⚠ LIVE STATE, and per VISIT. `botDriverV2` re-plans before every
         * target, and both of these change mid-leg: a bridge is Solid until
         * sixty ticks after the press and a block is a moving 16 px wall for
         * thirty-two. A planner with its own copy would certify the corridor
         * the push opened and then walk the executor into the block it did
         * not move — the `openActivators` lesson, one mechanic later.
         */
        get openBridges() {
            return noclip ? null : (openBridgeIdsNow() ?? new Set());
        },
        get pushables() { return noclip ? null : pushableRects(pushableStateFor(level)); },
        /**
         * R5 slice 5: which of this level's BreakableRocks are GONE right
         * now — the planner's only legitimate view of a broken one.
         *
         * A rock is Solid for the whole of its break animation, so "is this
         * cell walkable" has two answers seven ticks apart inside one leg,
         * and a planner with its own copy would route the executor into a
         * wall it watched shatter. The `openBridges` lesson, one mechanic
         * later — which is now the fifth time this file has had to make it.
         */
        get brokenRocks() { return noclip ? null : (brokenRockIdsNow() ?? new Set()); },
        /**
         * ⛓⛓ R5 SLICE 14: which of this level's `BurnableTree`s are GONE
         * right now — the EIGHTH family's answer to the same question, and
         * the seventh time this file has had to give it.
         *
         * ⛔ AND IT HAD NO READER FOR TWO SLICES. `collidesSolid` and
         * `plannerBlockerAt` have taken `burnedTrees` since slice 12, and
         * `levelRun` has passed `burnedTreeIdsNow()` into both — but the
         * DRIVER's own entry point (`botDriverV2.plannerObstacleAt`) never
         * destructured the option, and no getter existed to feed it. So a
         * leg planned after a burn would have routed around a 2x2 solid the
         * game had removed forty-one ticks earlier: the geometry was wired
         * and the PLANNER was blind, which is exactly the split that makes
         * "the family is built" and "the family is usable" different claims.
         *
         * ⚠ The set is per VISIT, like `brokenRocks` and unlike the flag: a
         * `tag = -1` tree is rebuilt by the next `new Game` however this
         * reads, and a `tag >= 0` one is not rebuilt at all (`check()`).
         */
        get burnedTrees() { return noclip ? null : (burnedTreeIdsNow() ?? new Set()); },
        /** ⛓ R5 slice 7: the ropes pulled in the CURRENT level, this visit. */
        get pulledRopes() { return noclip ? null : (pulledRopeIdsNow() ?? new Set()); },
        /**
         * ⛓⛓⛓ R5 SLICE 15: WHERE EVERY CRUSHER IN THIS ROOM IS RIGHT NOW —
         * the NINTH family's answer to the question the other eight answer
         * with a set, and it needs a MAP because the fact is a position.
         *
         * ⚠ AND IT IS THE ONE MEMBER OF THE FAMILY A PLANNER MAY NOT TREAT
         * AS SETTLED. `brokenRocks`, `burnedTrees` and `openChests` are
         * monotone: once the run has opened a cell it stays open, so a leg
         * planned against them stays valid for its whole duration. A crusher
         * moves on its own, so this is a SNAPSHOT and a route flooded
         * against it is only sound while the crusher is PARKED. That is what
         * makes the two-phase doctrine a rule and not a style —
         * `crusherIsParked` is the predicate a phase-2 plan has to check.
         */
        get crushers() {
            if (noclip) return null;
            return crusherRectsNow() ?? new Map();
        },
        /**
         * ⛓ Is every crusher in this room at rest? The precondition a
         * phase-2 (static-world) plan has to hold, asked of the run rather
         * than assumed by it.
         */
        get crushersParked() {
            if (noclip) return true;
            for (const c of crusherStateFor(level).values()) {
                if (c.vx !== 0 || c.vy !== 0) return false;
            }
            return true;
        },
        /**
         * ⛔⛔ Every tick a crusher's body overlapped the player. `Bot.noDamage`
         * is why the run continues; this list is why "the route stayed out of
         * the body" is a CLAIM and not a silence.
         */
        get crusherContacts() { return crusherContacts.map((c) => ({ ...c })); },
        /**
         * ⛓⛓⛓ R8 SLICE 1 — THE LIVE CHASER BODIES IN THIS ROOM, RIGHT NOW.
         *
         * `{id, tag, x, y, vx, vy, hits, hitsTimer, dying}` per body the
         * bridge steps. The danger map's ingredient (c) reads this, and so
         * does any policy that wants to know where a body IS rather than
         * where its `.oel` put it.
         *
         * ⚠ EMPTY UNDER `noDamage` AND `noclip`, and that is the gate's own
         * claim made visible rather than hidden: under those flags the
         * stepper does not run, so there are no live positions to report and
         * this must not invent any.
         */
        get chasers() {
            if (noclip || noDamage) return [];
            const out = [];
            for (const c of chaserStateFor(level).values()) {
                if (c.removed) continue;
                out.push({
                    id: c.id, tag: c.tag, x: c.x, y: c.y, vx: c.v.x, vy: c.v.y,
                    hits: c.hits, hitsTimer: c.hitsTimer, dying: c.dying,
                });
            }
            return out;
        },
        /**
         * One row per tick a bridged chaser MOVED. ⚠ The emptiness is a
         * claim: a room whose chasers never wake writes nothing here, which
         * is what a pair asserts against when it says "the body was stepped"
         * — a hit count alone would not (trap 113).
         */
        get chaserWalks() { return chaserWalks.map((w) => ({ ...w })); },
        /** One per chaser the ROOM removed (water/lava), with the cause. */
        get chaserTerrainDeaths() { return chaserTerrainDeaths.map((d) => ({ ...d })); },
        /**
         * ⛓⛓⛓ R5 SLICE 20 — the ice turrets, as `collidesSolid` sees them.
         *
         * ⛔ A SNAPSHOT, like the crushers' and for a DIFFERENT reason: a
         * corpse does not move on its own, but it keeps moving for 32 ticks
         * after the press that shoved it, so a route flooded against it is
         * only sound once `turretsSettled` is true.
         */
        get turrets() {
            if (noclip) return null;
            return turretRectsNow() ?? new Map();
        },
        /**
         * ⛓⛓⛓ R5 SLICE 23 — the boss totems, as `collidesSolid` sees them.
         *
         * ⛔ AND ITS DEFAULT IS THE OPPOSITE OF THE TURRETS'. An entry with
         * `activated: false` is a WALL; the map exists to say which bosses
         * have stopped being one. A `null` here (noclip) means "ask no
         * questions", and `liveRectOf` then falls through to `s.rect`, which
         * for an unwoken boss is the right answer anyway.
         */
        get bosses() {
            if (noclip) return null;
            return bossRectsNow() ?? new Map();
        },
        /** ⛓ Has the wand's publication woken the room's boss? */
        get bossesWoken() {
            if (noclip) return [];
            return [...bossStateFor(level).values()]
                .filter((b) => b.activated)
                .map((b) => ({
                    x: b.x, y: b.y,
                    sinceActivation: b.sinceActivation,
                    fullyActivated: b.fullyActivated,
                    activationRestTime: b.activationRestTime,
                    walking: b.walking,
                    // ⛓ R6 slice 4: the fight's own state, so a window can
                    // assert the PHASE it planned against and not just that
                    // the boss exists.
                    state: b.state,
                    anim: b.anim,
                    rate: b.rate,
                    collidable: b.collidable,
                    hits: b.hits,
                    hitsTimer: b.hitsTimer,
                    laserWidth: b.laserWidth,
                    laserHitTime: b.laserHitTime,
                    waitAtTopTime: b.waitAtTopTime,
                    destroy: b.destroy,
                    whiteOutRenders: b.whiteOutRenders,
                    removed: b.removed,
                }));
        },
        /**
         * ⛓⛓⛓ Every tick the CLAMP fired, with the y it overwrote.
         *
         * ⛔ THE WINDOW'S WHOLE CLAIM IS IN HERE, and an empty list is a
         * NEGATIVE result rather than a quiet pass: the clamp is a floor at
         * y 212 and the wand sits at 232, so a walk that collected it and
         * stood still would never trigger the assignment at all. A window
         * that asserts "the clamp holds" against an empty list has asserted
         * nothing. See `r5Totem.L43_WAND_WINDOW`.
         */
        get bossClamps() { return bossClamps.map((c) => ({ ...c })); },
        /**
         * ⛓⛓ One record per wand APPROACH FADE — the 99 frozen frames no
         * other pickup has, and the ones a ceremony budget derived from
         * `CEREMONY_DEAD_FRAMES.pickup` alone would be short by.
         */
        get wandFades() { return wandFades.map((f) => ({ ...f })); },
        /**
         * ⛓ Is every corpse in this room done gliding?
         *
         * ⛔ `tile == cTile` is the WRONG predicate and never fires — see
         * `iceTurretSettled`, which uses the FLOOR tile because the
         * two-cycle straddles `Math.round`'s boundary.
         */
        get turretsSettled() {
            if (noclip) return true;
            for (const t of turretStateFor(level).values()) {
                if (t.removed) continue;
                if (!iceTurretSettled(t)) return false;
            }
            return true;
        },
        /**
         * ⛓ The kill ledger's other half: `IceTurret` writes NO persistence,
         * so the only witness that it died is this.
         */
        get turretsDead() {
            if (noclip) return [];
            return [...turretStateFor(level).values()]
                .filter((t) => t.dead)
                .map((t) => ({ id: t.id, x: t.x, y: t.y, solid: t.solid, removed: t.removed }));
        },
        /**
         * ⛓⛓⛓ R5 SLICE 21 — THE KILL LEDGER, WITH ITS ARITHMETIC.
         *
         * ⛔ AND `turretsDead` IS NOT THE SAME QUESTION. That one asks "is
         * there a corpse here NOW" (per level, rebuilt by every `new Game`);
         * this one is the walk's own history, and it carries what the death
         * COST — the number of `tset == -1` locks the room held and the
         * number it opened. A leg asserts the second; a flood reads the
         * first.
         */
        get turretKills() { return turretKills.map((k) => ({ ...k })); },
        /**
         * ⛓⛓⛓ R5 SLICE 22 — THE FREEZE LEDGER, AND IT IS THE PRICE OF THE
         * KILL RATHER THAN AN ACCIDENT.
         *
         * One entry per tick a blast reached the player. Each costs
         * `ICE_TURRET_BLAST.freezeTicks - 1` ticks of refused input, so a
         * leg reports a NUMBER for what standing inside a turret's range
         * cost it. ⛔ It is not `crusherContacts`' shape: a crusher contact
         * is a ROUTE DEFECT the plan is supposed to have avoided, and a
         * blast freeze is unavoidable (`BLAST_PLAN.avoidable` is false) —
         * so this is priced, not refused.
         */
        get blastFreezes() { return blastFreezes.map((b) => ({ ...b })); },
        /** One per volley an `endAnim` spawned — the shooter's own history. */
        get volleys() { return volleys.map((v) => ({ ...v })); },
        /** `Player.frozenTimer` right now, against the game's `frozen_timer`. */
        get frozenTimer() { return frozenTimer; },
        /** The blasts in flight in the CURRENT level, for a probe. */
        get blastsInFlight() {
            return blastsFor(level).map((b) => ({
                id: b.id, x: b.x, y: b.y, vx: b.v.x, vy: b.v.y, spawnedAt: b.spawnedAt,
            }));
        },
        /**
         * ⛓ The DAMAGE, mid-fight. `hits` climbs 0 -> 3 at the i-frame
         * cadence and `hitsTimer` is what a press has to wait out, so a leg
         * that presses too fast can be told WHICH press was refused rather
         * than being told the enemy did not die.
         */
        get turretDamage() {
            if (noclip) return [];
            return [...turretStateFor(level).values()].map((t) => ({
                id: t.id, hits: t.hits, hitsMax: t.hitsMax, hitsTimer: t.hitsTimer,
                dying: t.dying, dead: t.dead, removed: t.removed,
                // ⛓ The LATCH, so a leg can say whether the corpse has become
                // a wall yet — it flips on the first tick the player's box is
                // off the 16x16 body and never goes back.
                solid: t.solid,
                // ⛓⛓ R5 SLICE 22: THE SHOOTER'S OWN CLOCK. `anim` and
                // `shootTimer` between them say exactly where in the 45-tick
                // volley cycle the body is, and `angle` is what the next
                // `endAnim` will fire along — which is the only way a leg can
                // reason about a volley BEFORE it exists.
                anim: t.anim, shootTimer: t.shootTimer, angle: t.angle,
                volleys: t.volleys,
            }));
        },
        /**
         * ⛓⛓⛓ R5 SLICE 16 — WHAT EVERY CRUSHER IN THIS ROOM CAN SEE RIGHT
         * NOW, ASKED OF THE RUN.
         *
         * A parked crusher is not a disarmed one (§29.8): `update()`
         * re-derives `v` on every tick it is at rest, so a leg that parks one
         * on a button and then spends 1,300 ticks pushing blocks beside it is
         * making a claim about every one of those ticks. Auditing that needs
         * the scan the STEP takes — same solid list, same two player shapes,
         * same exclusion — and the first cut of L41's audit rebuilt it in the
         * plan script out of `botDriverV2.livePerVisitOpts`. Two views of one
         * fact, and the one nobody steps is the one that drifts.
         *
         * ⚠ A SNAPSHOT, like `crushers` — and for the same reason. It says
         * what the next tick's scan would find IF the crusher is at rest;
         * a charging one does not re-derive `v` at all.
         */
        get crusherScans() {
            if (noclip) return null;
            const out = new Map();
            /**
             * ⛓⛓ R8 SLICE 0: HOISTED, and the contrast with `stepCrushersNow`
             * is the whole reason this one may be. That loop REBUILDS the bag
             * per crusher on purpose — it steps them, so the second one's
             * world must contain the first where the loop just left it. This
             * loop MUTATES NOTHING (`scanCrusher` is a pure read), so the
             * per-crusher rebuild was pure cost — and it is cost a live
             * sensing policy pays on every tick it polls this getter.
             */
            const scanOpts = normalizeLiveOpts(liveSolidOpts());
            for (const [id, c] of crusherStateFor(level)) {
                const ctx = crusherCtx(c, scanOpts);
                out.set(id, {
                    ...scanCrusher({ x: c.x, y: c.y }, ctx.playerBox, ctx.playerPoint,
                        ctx.lineSolids),
                    x: c.x,
                    y: c.y,
                    resting: c.vx === 0 && c.vy === 0,
                });
            }
            return out;
        },
        // ── ⛔⛔ R5 slice 9: the chest, the pulse and the seal ──────────
        get openChests() { return noclip ? null : (openChestIdsNow() ?? new Set()); },
        /** One record per chest OPENED, with the flag `open()` cleared. */
        get chestOpens() { return chestOpens.map((c) => ({ ...c })); },
        /**
         * One per completed seal ceremony. ⚠ `deadFrames` is the claim and
         * `t` is not: the ceremony costs the TAPE nothing, so the tick is
         * where it started and the evidence is the game's own counter.
         */
        get sealCollections() { return sealCollections.map((c) => ({ ...c })); },
        /** The live piece's position, or null — for a driver mid-approach. */
        get sealPiece() { return sealPiece === null ? null : { ...sealPiece }; },
        /** One per tick a pulse's `hit()` ran. */
        get pulserHits() { return pulserHits.map((h) => ({ ...h })); },
        /**
         * The pulsers whose group is published RIGHT NOW.
         *
         * ⚠ THE ONLY OBSERVABLE A `hold` ON A PULSER GROUP HAS. A Pulser is
         * `type = "Solid"` either way, so `openActivators` can never move —
         * "the hold opened something" has to be asked of this instead, and
         * `runHold` does.
         */
        get armedPulsers() {
            if (noclip) return null;
            const armed = new Set();
            const st = pulserStateFor(level);
            if (st.size === 0) return armed;
            const activators = activatorStateFor(level);
            const pressed = pressedGroups(world, playerBoxAt(state.x, state.y),
                movingSolidsNow());
            for (const [id, p] of st) {
                if (pressed.has(p.t) || activators.latched.get(p.t) === true) armed.add(id);
            }
            return armed;
        },
        /**
         * ⛓⛓⛓ THE ARROW TRAPS WHOSE GROUP IS PUBLISHED RIGHT NOW.
         *
         * ⚠ THE ONLY OBSERVABLE A `hold` ON AN ARROWTRAP GROUP HAS, and it
         * is the pulsers' reason with the sign flipped: a Pulser is Solid
         * either way, an ArrowTrap is Solid neither way, and in both cases
         * `openActivators` can never move. "The hold armed something" has to
         * be asked of this, and `runHold` does.
         *
         * ⛔ `shootDefault` IS APPLIED HERE. Four of the game's eleven traps
         * fire UNTIL their group is pressed, so "armed" is the XOR and not
         * the flag — a set built from the flag alone would report L16 and
         * L67 backwards, and would report them backwards SILENTLY.
         */
        get armedArrowTraps() {
            if (noclip) return null;
            const armed = new Set();
            const st = arrowTrapStateFor(level);
            if (st.size === 0) return armed;
            const activators = activatorStateFor(level);
            const pressed = pressedGroups(world, playerBoxAt(state.x, state.y),
                movingSolidsNow());
            for (const [id, trap] of st) {
                const group = pressed.has(trap.t) || activators.latched.get(trap.t) === true;
                if (arrowTrapFires(trap, group)) armed.add(id);
            }
            return armed;
        },
        /** One per volley an arrow trap fired — `{t, level, id, arrows}`. */
        get arrowVolleys() { return arrowVolleysFired.map((v) => ({ ...v })); },
        /**
         * Every arrow in flight in THIS level right now, `{id, x, y}`.
         *
         * ⚠ POSITION AND LIFETIME ONLY. Nothing here says what an arrow hit
         * — see `stepArrowTrapsNow`'s two named absences.
         */
        get arrowsInFlight() {
            return arrowsFor(level).map((a) => ({ id: a.id, x: a.x, y: a.y }));
        },
        /** One per block a pulse MOVED — link 3 of L38's chain. */
        get pulserPushes() { return pulsePushes_.map((h) => ({ ...h })); },
        /** One per tick a pulse reached the player; inert under `noDamage`. */
        get pulserPlayerHits() { return pulserPlayerHits.map((h) => ({ ...h })); },
        /** `{id, hitTick, goneAt, tag, x, y}` per rock this run has broken. */
        get rocksBroken() {
            const out = [];
            for (const [n, st] of rockStates) {
                for (const [id, r] of st) out.push({ level: n, id, ...r });
            }
            return out;
        },
        /** Which blocks are no longer where the level built them, this visit. */
        get pushedBlocks() { return noclip ? [] : movedPushables(pushableStateFor(level)); },
        /** Is every block at rest? The `spear` leg's "the push has landed" test. */
        get pushesSettled() { return noclip ? true : pushablesSettled(pushableStateFor(level)); },
        /**
         * One record per press that FIRED its rect: `{t, fired, level,
         * weapon, direction, rect, hits}`.
         *
         * The press ledger the §3.2 audit is checked against. `t` is the
         * tape's own press tick and `fired` is the tick the rect collided —
         * they differ by one BY TRANSCRIPTION, and having both is what lets
         * a leg say which of the two it meant.
         */
        get presses() { return presses.map((p) => ({ ...p, hits: p.hits.map((h) => ({ ...h })) })); },
        /**
         * ⛓ R6 slice 2: one record per shot the run has FIRED —
         * `{t, level, id, direction, x, y, pressTick}`. `t` is the fire tick
         * and `pressTick` is the press; they differ by seven BY DERIVATION
         * (`WAND_WINDOW.fireTick`), and having both is what lets a window
         * say which of the two it meant.
         */
        get wandShots() { return wandShotsFired.map((s) => ({ ...s })); },
        /** One record per contact a shot made, including the ones that paid nothing. */
        get wandShotHits() { return wandShotHits.map((h) => ({ ...h })); },
        /**
         * ── ⛓⛓⛓ R6 SLICE 4: THE FIGHT'S SIX LEDGERS ─────────────────
         *
         * ⛔ EACH ONE IS A DIFFERENT CLAIM. A window that asserted "the
         * fight happened" off any single one of them would be asserting
         * something weaker than it thinks: `bossWalks` says the machine
         * started, `bossLasers` says the beam fired (with `hitCalls` 0 for a
         * volley that MISSED, which is the exactness claim), `bossHits` says
         * the schedule landed — including the shots the 20-tick timer
         * REFUSED — and `bossKills` carries both the kill tick and the tick
         * 240 renders later that the tag lands on.
         */
        get bossWalks() { return bossWalks.map((w) => ({ ...w })); },
        get bossLasers() {
            return bossLasers.map((l) => ({ ...l, rects: l.rects.map((r) => ({ ...r })) }));
        },
        get bossShotsFired() { return bossShotsFired.map((s) => ({ ...s })); },
        get bossHits() { return bossHits.map((h) => ({ ...h })); },
        get bossKills() { return bossKills.map((k) => ({ ...k })); },
        get bossBlasts() { return bossBlasts.map((b) => ({ ...b })); },
        /** Every tick a shot's cull was a band question — see the declaration. */
        get bossShotCullBand() { return bossShotCullBand.map((b) => ({ ...b })); },
        /** The live projectiles, for a stance that has to plan around them. */
        get bossShots() { return bossShotsFor(level).map((s) => ({ ...s })); },
        /**
         * ⛓ `Game.cameraTarget` — `null` until a boss writes it, `(-1,-1)`
         * once `Game.resetCamera()` has. The two are NOT the same state and
         * a window that merged them would lose the tick the follow came
         * back.
         */
        get bossCameraTarget() {
            return bossCameraTarget === null ? null : { ...bossCameraTarget };
        },
        /**
         * ⛔ One per `MagicalLock` a shot OPENED — `{level, id, tag, shot,
         * hitTick, openTick}`. `openTick` is 15 ticks after `hitTick` and is
         * the first tick the cell is passable; a route that read `hitTick`
         * as the opening would walk into a wall for fifteen ticks.
         */
        get magicalLocksOpened() { return magicalLocksOpened.map((l) => ({ ...l })); },
        // ── ⛓⛓⛓ R6 SLICE 5: THE SHIELDSPIRE'S FOUR LEDGERS ─────────────
        /** Every tick, `{t, level, id, inBand, swingTime, anim, hitsTimer}`. */
        get shieldBossBand() { return shieldBossBand.map((r) => ({ ...r })); },
        /** One per `startStab`, with the DERIVED window the sword must land in. */
        get shieldBossStabs() { return shieldBossStabs.map((r) => ({ ...r })); },
        /** One per swing that reached him — swallowed, refused, aborted or landed. */
        get shieldBossHits() { return shieldBossHits.map((r) => ({ ...r })); },
        /**
         * The death's THREE instants — `tag`, `destroy`, `removed` — as
         * separate rows 23 and 11 ticks apart. ⛔ A consumer that wants "when
         * did the wall open" must read `removed`; `tag` is the kill witness
         * and nothing else.
         */
        get shieldBossKills() { return shieldBossKills.map((r) => ({ ...r })); },
        /** The `{19,0}` write, keyed like `bossFlags`. */
        get shieldBossFlags() { return [...shieldBossFlags.values()].map((f) => ({ ...f })); },
        /** The live bodies, for a stance that has to plan around the wall. */
        get shieldBosses() {
            const st = shieldBossStateFor(level);
            return [...st.values()].map((b) => ({
                id: b.id,
                x: b.x,
                y: b.y,
                hits: b.hits,
                hitsTimer: b.hitsTimer,
                anim: b.anim,
                frame: b.frame,
                swingTime: b.swingTime,
                activated: b.activated,
                tagWritten: b.tagWritten,
                destroy: b.destroy,
                removed: b.removed,
                bodyRect: shieldBossBodyRect(b),
                bandRect: shieldBossBandRect(b),
            }));
        },
        // ── ⛓⛓⛓ R6 SLICE 6f: THE OWL'S SEVEN LEDGERS ──────────────────
        /**
         * One per HIT TEST that reached the Owl — landed or refused, with the
         * `reach` that decided it.
         *
         * ⛔ THE REFUSALS ARE THE DERIVATION. This receiver refuses none of a
         * press's five dispatches (`justKnock` sets no `hitsTimer`); what ends
         * the press is `Player.slash`'s own 16 px gate against a body the
         * earlier tests have already shoved. So "how many of the five land" is
         * a fact about geometry, and a ledger of landings alone would read as
         * a constant.
         */
        get finalBossShoves() { return finalBossShoves.map((r) => ({ ...r })); },
        /**
         * One per tick the lava self-hit fired — with BOTH predicates.
         * `firstT` is the game's (`collide("Tile", …)` returns the first
         * overlap in world order, trap 95); `wholly` is the order-independent
         * one a plan should aim for. A hit that is `firstT: 17, wholly: false`
         * is a hit that depends on a file's line order.
         */
        get finalBossLava() { return finalBossLava.map((r) => ({ ...r })); },
        /**
         * The death's four instants — `kill`, `startDeath`, `dieAnimEnded`,
         * `tagsWritten` — as separate rows. ⛔ The tags are 109 ticks after
         * the kill and NOTHING is written before them: a window that ends on
         * the kill has killed him and witnessed nothing.
         */
        get finalBossKills() { return finalBossKills.map((r) => ({ ...r })); },
        /** `{112,0}` AND `{112,1}`, both from `endAnim`'s "dead" arm. */
        get finalBossFlags() { return [...finalBossFlags.values()].map((f) => ({ ...f })); },
        /** One per rock that LANDED — its box, the shake it made, and the hit. */
        get owlRockLandings() { return owlRockLandings.map((r) => ({ ...r })); },
        /** One per grenade event — `spawned`, `exploded` (with its radius), `removed`. */
        get owlGrenadeEvents() { return owlGrenadeEvents.map((r) => ({ ...r })); },
        /**
         * EVERY TICK of the Owl room: the phase, its draw cost, the shake, the
         * stream's absolute position and the boss's own state.
         *
         * ⛓ This is the family's exactness claim in one list — "the model
         * turned the crank the same number of times as the game did, in the
         * same order" is a statement about every tick, and `owlTickDraws` is
         * asserted against the stream's own delta on each of them.
         */
        get owlTicks() { return owlTicks.map((r) => ({ ...r })); },
        /** One per tick after `startDeath` — the corpse's rect and the clearance. */
        get finalBossCorpse() { return finalBossCorpse.map((r) => ({ ...r })); },
        /** The Owl's live state, for a stance that has to plan around him. */
        get finalBosses() {
            const st = owlStateFor(level).bosses;
            return [...st.values()].map((b) => ({
                id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
                started: b.started, rockfallTime: b.rockfallTime, cpod: b.cpod,
                hitThisSequence: b.hitThisSequence, hits: b.hits, hitsTimer: b.hitsTimer,
                maxForce: b.maxForce, canHit: b.canHit, destroy: b.destroy,
                anim: b.anim, animAge: b.animAge, tagsWritten: b.tagsWritten,
                box: finalBossBox(b.x, b.y),
            }));
        },
        /** The four pods, in the BOSS's `podPositions` order — see `podStates`. */
        get owlPods() {
            return owlStateFor(level).pods.map((p) => ({
                id: p.id, x: p.x, y: p.y, anim: p.anim, animAge: p.animAge,
                lethal: podIsLethal(p),
            }));
        },
        /** The draw stream's absolute position, or null if no Owl room was entered. */
        get owlStreamCount() { return owlStream === null ? null : owlStream.count; },
        get owlStreamState() { return owlStream === null ? null : owlStream.state; },
        // ── ⛓⛓⛓ R6 SLICE 6c: the Watcher's three readouts ─────────────
        /**
         * `{t, level, id, cause, pages, page, frames, flag}` per
         * `doneTalking()`. ⛔ `cause` is `'done'` or `'left'` and BOTH write
         * the flag — the pair's whole design turns on that (§16.6).
         */
        get watcherTalks() {
            return watcherTalks.map((r) => ({ ...r, flag: { ...r.flag } }));
        },
        /** The `{114,0}` write, keyed like `bossFlags`. */
        get watcherFlags() { return [...watcherFlags.values()].map((f) => ({ ...f })); },
        /**
         * ⛔⛔ Every tick the Watcher's live `Seed` EXISTS, with the stance's
         * clearance from it. The POSITIVE half of a refusal no shipped tape
         * can reach: "the box was never touched" and "the box was never
         * there" print the same without this. (trap 101)
         */
        get watcherSeedLive() { return watcherSeedLive.map((r) => ({ ...r })); },
        /** The live dialogue state, for a plan that has to place a release. */
        get watchers() {
            const st = watcherStateFor(level);
            return [...st.values()].map((w) => ({
                id: w.id,
                x: w.ex,
                y: w.ey,
                persistTag: w.persistTag,
                talking: w.talking,
                talked: w.talked,
                cleared: w.cleared,
                page: w.dialogue?.page ?? null,
                pages: w.dialogue?.pages.length ?? null,
                currentCharacter: w.dialogue?.currentCharacter ?? null,
                pageLength: w.dialogue ? w.dialogue.pages[w.dialogue.page]?.length ?? null : null,
                done: w.dialogue?.done ?? null,
                seedBox: watcherSeedBox(w.oel),
                distance: Math.sqrt((w.ex - state.x) ** 2 + (w.ey - state.y) ** 2),
                inRange: inTalkRange({ x: w.ex, y: w.ey }, state),
                talkRange: TALK_RANGE,
                // ⛓⛓⛓ R6 slice 6d: the sword half. `hits` is the counter
                // `Watcher.hit()` increments and `hitsTimer` is what refuses
                // four of every press's five dispatches.
                hits: w.hits,
                hitsTimer: w.hitsTimer,
                createdSeed: w.createdSeed,
            }));
        },
        // ── ⛓⛓⛓ R6 SLICE 6d: the bloody branch's five readouts ────────
        /**
         * `{t, level, id, landed, hits, hitsTimer, why}` per HIT TEST that
         * reached a Watcher — the refused four of every press included,
         * because they are the derivation of "four presses" and not noise.
         */
        get watcherHits() { return watcherHits.map((r) => ({ ...r })); },
        /** `{t, level, id, ex, ey, from, hits, liveAt}` per runtime `Seed`. */
        get seedSpawns() { return seedSpawns.map((r) => ({ ...r })); },
        /** `{t, level, id, arm, fadeFrames}` per `Seed.removeSelf()`. */
        get seedFades() { return seedFades.map((r) => ({ ...r })); },
        /**
         * ⛔ `{t, level, tag, runtime}` per ceremony BEGUN — the dead-frame
         * ledger's term, and NOT `collected`. Phase A is paid on contact
         * whether or not the dialogue after it is ever dismissed.
         */
        get ceremonyStarts() { return ceremonyStarts.map((r) => ({ ...r })); },
        /**
         * ⛓⛓⛓ `{t, arm, id, fromLevel, toLevel, cutscene, respawn}` per
         * GAME-INITIATED ending reboot — the window's terminal, and the
         * discriminator `R6_BLOOD_MENU_DERIVATION` names: the LEVEL
         * SEQUENCE, never "a menu happened".
         */
        get endingReboots() { return endingReboots.map((r) => ({ ...r, respawn: { ...r.respawn } })); },
        /**
         * ⛔ `{t, id, distance, inRange}` per tick of a `cutscene[1]` world.
         * The POSITIVE witness for the Oracle refusal (trap 101, this rung's
         * second): a shipped tape cannot reach the throw, so what it can
         * show is that the circle really was entered with nothing live.
         */
        get oracleApproach() { return oracleApproach.map((r) => ({ ...r })); },
        /** The scripted walk, while it runs — `null` outside one. */
        get cutsceneWalk() { return cutsceneWalk ? { ...cutsceneWalk } : null; },
        /** The `cutscene[2]` tree hold, while it runs — `null` outside one. */
        get cutsceneHold() { return cutsceneHold ? { ...cutsceneHold } : null; },
        /** `{t, level, what, r, updates}` — `endAnim`, then `coverFull`. */
        get treeEvents() { return treeEvents.map((r) => ({ ...r })); },
        /**
         * ⛓⛓⛓ THE RUNG'S TERMINAL — `{t, menuState, badge, level}` once the
         * tree's cover has reached 1, `null` before it. `menuState` is 2,
         * which `botStatus.menu_state` reports directly since slice 6a: the
         * ladder's first "the game says it was beaten".
         */
        get credits() { return credits ? { ...credits } : null; },
        /** `Game.cutscene`, the run's own copy of the static. */
        get cutscene() { return [...cutscene]; },
        /** The runtime pickups alive in THIS world, `{id, ex, ey, collected}`. */
        get runtimeSeeds() {
            return runtimeSeeds.map((s) => ({
                id: s.id, ex: s.ex, ey: s.ey, arm: s.arm, collected: !!s.collected,
            }));
        },
        // ── ⛓⛓⛓ R6 SLICE 6c: the final door's three readouts ──────────
        /** `{t, level, id, frames, dismissable}` per SealController spawned. */
        get doorCeremonies() { return doorCeremonies.map((r) => ({ ...r })); },
        /** `{t, level, id, what}` — `open`, then `removed` 56 ticks later. */
        get doorEvents() { return doorEvents.map((r) => ({ ...r })); },
        /** The `{113,0}` write `removed()` makes, keyed like `bossFlags`. */
        get finalDoorFlags() { return [...finalDoorFlags.values()].map((f) => ({ ...f })); },
        /** The live door(s), for a stance that has to plan around the wall. */
        get finalDoors() {
            const st = finalDoorStateFor(level);
            return [...st.values()].map((d) => ({
                id: d.id,
                x: d.ex,
                y: d.ey,
                persistTag: d.persistTag,
                seenSeal: d.seenSeal,
                opening: d.opening,
                openUpdates: d.openUpdates,
                removed: d.removed,
                seeDistance: FINAL_DOOR.seeDistance,
                distance: Math.sqrt((d.ex - state.x) ** 2 + (d.ey - state.y) ** 2),
            }));
        },
        /** Build (and memoise) another level's world — for planning ahead. */
        worldFor,

        /**
         * Run one tick with `held` down, applying the end-of-tick swap if a
         * teleporter fired.
         *
         * Returns `{transition, hitX, hitY}` for this tick: `transition` is
         * the `{t, from_level, to_level}` record that was just appended (or
         * null), and the two hits are the sweep results the AS3 caller
         * discards — the driver needs them to tell "walked the whole way"
         * from "stopped early", which is the difference between a plan that
         * worked and a planner bug.
         *
         * ⚠ On a transition the returned `hitX`/`hitY` are the OLD player's,
         * from the last doomed step it completes in the old level before the
         * swap. That step is never observed; the hits are reported anyway
         * rather than swallowed, because a caller that wants to ignore them
         * can, and one that wants them cannot get them back.
         */
        advance(held) {
            // ⛓ R7 slice 6d: the witnessed mid-run clears, BEFORE anything
            // reads geometry this tick — the flag is already false when the
            // tick numbered `at` begins, which is what "the game cleared it
            // by then" means.
            applyTimedClears(ticksCompleted);
            // ⛓ R7 slice 6e: and the witnessed mid-run REMOVALS, beside them
            // and for the same reason — the body is already gone when the
            // tick numbered `at` begins, which is what "the game removed it
            // by then" means.
            applyTimedDespawns(ticksCompleted);
            // ── the equip, first thing (R4) ───────────────────────────
            // `Bot.as` applies it immediately after pushing observation
            // `t` and BEFORE dispatching that tick's key edges, so on this
            // side it has to land before the physics of tick `t` — a press
            // on the equip's own tick is already a thrust. Construction
            // covered tick 0; this covers every later one.
            applyEquipsAt(ticksCompleted);
            // The keys of the PREVIOUS tick, captured before the two
            // branches below both overwrite `prevHeld`. `Input.pressed(k)`
            // is the rising edge, and it is what `useItem` reads.
            const wasHeld = prevHeld;

            // ── ⛓⛓⛓ R5 SLICE 22: THE BLASTS, AND THEY ARE FIRST ──────
            // Every other family here is placed by an `.oel` and was added
            // by `Game.loadlevel`; a blast is added at RUN TIME, and
            // `World.addUpdate` PREPENDS — so it is ahead of the spinners,
            // the blocks, the crusher, its own turret and the player. See
            // `stepBlastsNow` for the two consequences.
            // ── ⛓⛓⛓ R6 SLICE 2: THE WAND SHOTS, AHEAD OF EVERYTHING ──
            // Also run-time-added, also prepended. `assertWandShotSolidsBound`
            // refuses the one room that could make the wand/blast order
            // observable, so "shots then blasts" is a bounded vacuity with a
            // named guard rather than a preference.
            if (!noclip) {
                stepWandShotsNow();
                // ⛓ R6 SLICE 4: and the boss's own projectiles, below them
                // (see `stepBossShotsNow` for why the order is that way).
                stepBossShotsNow();
                stepMagicalLocksNow();
            }
            if (!noclip) stepBlastsNow();

            // ── R4: the entities that update BEFORE the player ────────
            // `Game.loadlevel` adds the Player at `:2040` and the pushables
            // at `:2164-2166`, and `World.addUpdate` PREPENDS — so a block
            // moves first and the player's sweep this tick reads it where
            // this left it. And `PushableBlockFire.update()` overrides
            // `Mobile.update` without the `Game.freezeObjects` gate, so it
            // runs ABOVE the ceremony's early return below: a block keeps
            // gliding through a pickup's frozen frames.
            // ── ⛔⛔ R5 SLICE 13: THE SPINNERS, ABOVE THE BLOCKS ───────
            // `Game.loadlevel` adds the pushables at `:2216-2218` and the
            // spinners at `:2250`, and `World.addUpdate` PREPENDS — so the
            // update list is reverse add order and the spinner moves FIRST.
            // The block's sweep this tick must read it where this left it,
            // which is the difference between a wedge the model sees and the
            // eighteen successful presses it reported instead (§25.3).
            //
            // ⚠ AND IT IS ABOVE THE CEREMONY'S EARLY RETURN, like the blocks
            // and the LightPole — but for the OPPOSITE half of the reason.
            // A block ignores `Game.freezeObjects`; a spinner is gated by it
            // (`Mobile.mobileUpdate`) and its TERRAIN arm and `death()` are
            // not. `spinnerCtx().frozen` carries that split, so a spinner
            // already sinking keeps sinking through a ceremony and a moving
            // one parks.
            const spinState = spinnerStateFor(level);
            if (!noclip && spinState.byId.size > 0) {
                assertDialogueFreeSpinnerRoom();
                stepSpinners(spinState, spinnerCtx());
                /**
                 * ⛔⛔ AND THE FLAG A REMOVAL WRITES, BANKED HERE.
                 *
                 * `Spinner.removed()` is `Game.setPersistence(tag, false)`
                 * with no test of the cause, and `World.updateLists`
                 * processes the removal at the top of the frame — which is
                 * the tick `stepSpinner` returns `removed: true` on. So this
                 * is the write's real tick, not an approximation of it.
                 *
                 * ⚠ BANKED, NOT CASHED. Like every earned clear it lands in
                 * `pendingEarnedClears` and is spent when the level is next
                 * BUILT (§22.8) — so a run that never leaves the room reports
                 * an empty `earnedClears` and a full `spinnerDeaths`, and the
                 * ledger claim is phrased over the writes.
                 */
                for (const s of spinState.byId.values()) {
                    if (!s.removed || s.persistTag < 0 || spinnerWritten.has(s.id)) continue;
                    spinnerWritten.add(s.id);
                    if (!pendingEarnedClears.has(level)) pendingEarnedClears.set(level, new Set());
                    pendingEarnedClears.get(level).add(s.persistTag);
                    spinnerWrites.push({
                        t: ticksCompleted + 1,
                        level,
                        id: s.id,
                        flag: { level, tag: s.persistTag, value: false },
                        cause: s.deathCause,
                    });
                }
            }
            // ── ⛓⛓⛓ R6 SLICE 5: THE SHIELDSPIRE, BETWEEN THEM ────────
            // `Game.loadlevel` adds the spinners at `:2250`, the shieldboss
            // at `:2222` and the pushables at `:2216-2218`, and
            // `World.addUpdate` PREPENDS — so the update list is
            // spinner -> SHIELDBOSS -> pushables -> … -> Player, and this
            // sits exactly there. It is ABOVE the ceremony's early return
            // because `Enemy.update`'s tail has no freeze test; the refusal
            // in `assertNoCeremonyBesideShieldBoss` is what keeps that
            // honest rather than approximate.
            if (!noclip) stepShieldBossesNow();
            const pushState = pushableStateFor(level);
            if (!noclip && pushState.byId.size > 0) stepPushables(pushState, pushableCtx());
            // `LightPole.update()` is `super.update(); hitUpdate();` and the
            // class is not a `Mobile`, so — like a Button under a frozen
            // player — it keeps counting through a ceremony. Stepped here,
            // above the early return, for that reason.
            if (!noclip) {
                for (const pole of poleStateFor(level).values()) {
                    if (pole.hitsTimer > 0) pole.hitsTimer--;
                }
            }

            // The player reads the activator state as of the END of the
            // previous tick, which is the same object the game's Locks
            // compute at the TOP of this one (they update before the player —
            // see `activators.stepActivators`). Stepping the machinery first
            // here would open a lock one tick early, in every run, forever.
            const activators = activatorStateFor(level);

            // ── the touch-lock's position write, from the PREVIOUS tick ──
            // A Lock updates before the Player (see `pendingSnapY`), so its
            // `p.y` write lands here: ahead of `getState`, ahead of friction,
            // ahead of both sweeps. Velocity is NOT touched — the R3 slice-2
            // lesson one mechanic over: a ceremony that stops the player does
            // not stop their `v`, which is exactly why `turnOff`'s `if (p)`
            // is a live question.
            if (pendingSnapY !== null) {
                state = { ...state, y: pendingSnapY };
                pendingSnapY = null;
            }

            // ── ⛔⛔ R5 SLICE 9: THE CHEST, THEN THE PULSER ─────────────
            //
            // ⚠ THE ORDER HERE IS THE GAME'S, AND IT IS A FENCEPOST.
            // `World.addUpdate` PREPENDS, so the update list is the reverse
            // of `Game.loadlevel`'s add order — which for these four is
            //
            //     pushableblockfire (:2217)  ->  chest (:2211)
            //       ->  cover (:2194)  ->  pulser (:2191)  ->  … Player
            //
            // Two consequences, both one-tick and both load-bearing:
            //
            // 1. ⛔ THE BLOCK UPDATES BEFORE THE PULSER, so a pulse's `hit()`
            //    sets a velocity the block acts on NEXT tick. `stepPushables`
            //    above and `stepPulser` here are in that order for that
            //    reason, and reversing them would land the block on its
            //    button a tick early.
            // 2. ⛔ THE CHEST UPDATES BEFORE THE COVER, so on the tick the
            //    cover's fade completes the chest has already read it as
            //    Solid — the chest opens on the tick AFTER the cover does.
            //    `activators` above is exactly the previous tick's state,
            //    which is what the game's chest sees, so this needs no
            //    special case; it needs the note, because "open the cover
            //    and the chest opens" is off by one.
            if (!noclip) stepSealPieceNow();
            if (!noclip) stepChestsNow(activators);
            if (!noclip) stepPulsersNow(activators, pushState);
            // ⛓⛓⛓ R7 SLICE 6b: THE ARROW TRAPS, in the pulsers' own slot.
            // `Game.loadlevel` adds `arrowtrap` at :2204 — BELOW `pulser`
            // (:2191) and `button` (:2202) — so a prepending update list
            // puts it AHEAD of both, and the flag it reads is the previous
            // tick's. Stepping it here, after the movement, is the same
            // labelling `stepActivators` already justifies.
            if (!noclip) stepArrowTrapsNow(activators);
            // ── ⛓⛓⛓ R5 SLICE 15: THE CRUSHER, IN ITS OWN SLOT ────────
            //
            // `Game.loadlevel` adds it at `:2142` and `World.addUpdate`
            // PREPENDS, so the update list is reverse add order:
            //
            //   pushables (:2216-2218) -> cover (:2194) -> pulser (:2191)
            //     -> CRUSHER (:2142) -> … -> Player (:2092)
            //
            // ⇒ it updates AFTER every activator and every block and BEFORE
            // the player. Both halves are load-bearing: it charges into
            // where the pulse just shoved a block, and the player's sweep
            // this tick reads it where THIS call left it. Placing it below
            // the player would let a route walk through a charge.
            //
            // ⚠ AND IT IS ABOVE THE CEREMONY'S EARLY RETURN, like the blocks
            // and the LightPole and the spinner — but for the strongest
            // version of the reason. `Crusher.update` has NO
            // `Game.freezeObjects` test at all (`CEREMONY_RULE.freezeGated`),
            // so it moves through a pickup's 150 frozen frames at full
            // speed. Its `hit()` runs through them too and lands on a no-op,
            // because every damage path reaches the player through the
            // freeze-gated `Player.hit` (§27.6) — so the claim a collect
            // near one has to discharge is ONE FRAME plus a position, and
            // the position is what this loop computes.
            if (!noclip) stepCrushersNow();
            // ── ⛓⛓⛓ R5 SLICE 20: THE ICE TURRET, IN ITS OWN SLOT ─────
            //
            // `Game.loadlevel` adds it at `:2137` and the `crusher` at
            // `:2144`, and `World.addUpdate` PREPENDS — so the update list
            // runs CRUSHER then ICETURRET then … then Player, and this call
            // sits below `stepCrushersNow` for that reason. Both halves
            // matter for the same reasons the crusher's slot does: a corpse
            // glides into where a crusher has just parked, and the player's
            // sweep this tick reads the corpse where THIS call left it.
            //
            // ⛔ AND UNLIKE THE CRUSHER IT IS FREEZE-GATED — one level down,
            // in `Mobile.mobileUpdate`, which is §33.5's correction of
            // §32.6 item 5. A glide PAUSES for a ceremony and resumes after
            // it; what runs through a freeze is `Enemy.update`'s terrain
            // switch, a claim about DYING rather than about moving.
            if (!noclip) stepIceTurretsNow();

            // ── ⛓⛓⛓ R5 SLICE 22: `Player.update`'s `freezeStep()` ────
            //
            // `Player.as:532`, and its position is the whole arithmetic:
            // ABOVE `super.update()`, so the decrement for the contact tick
            // has already happened by the time `input()` reads
            // `frozenTimer > 0`. A freeze of 15 therefore refuses FOURTEEN
            // ticks, the first of them the contact tick itself.
            //
            // ⛔ AND IT IS ABOVE THE CEREMONY'S EARLY RETURN, because
            // `Player.update` has no `Game.freezeObjects` gate of its own —
            // only `Mobile.mobileUpdate` inside it does. A freeze span
            // DRAINS through a ceremony; what stops is the moving.
            if (frozenTimer > 0) frozenTimer -= 1;

            // ── ⛓⛓⛓ R6 SLICE 6d: THE CREDITS ARE A TERMINAL ──────────
            //
            // `Game.menuAndRestart()` runs at the TOP of `Game.update` and
            // sets `Game.freezeObjects = true` on EVERY frame while
            // `Game.menu` is true. So every frame after the credits reboot
            // is a dead frame, the bot's counter cannot advance through one,
            // and a tape whose `tick_count` runs past it is asking for
            // observations the game will never record. Refused rather than
            // produced — the alternative is a model stream longer than the
            // recording, which reads as a physics divergence at the very
            // moment the run has been WON.
            if (credits) {
                throw new Error(`levelRun: the tape asks for tick ${ticksCompleted}, `
                    + `after the CREDITS reboot at tick ${credits.t}. `
                    + '`Game.menuAndRestart()` sets `Game.freezeObjects = true` on every '
                    + 'frame while `Game.menu` is true, so every frame from there on is '
                    + 'DEAD and the tape\'s counter cannot advance. The window ENDS at '
                    + `the credits: set \`tick_count\` to ${credits.t}. (And a key `
                    + 'release would be worse than a wasted tick — '
                    + '`Input.released(Key.ANY)` is what LEAVES the menu, rebooting the '
                    + 'world again.)');
            }
            // ── ⛓⛓⛓ R6 SLICE 6d: THE TREE, WHICH IS NOT A FREEZE ─────
            //
            // ⛔ THESE FRAMES ARE TAPE TICKS, and §14.5 counted them as
            // frozen. `Game.as:961`'s `cutscene[2]` arm sets
            // `p.receiveInput = false`, which makes `canInventory()` false,
            // which runs `inventory.open = false`, which IS
            // `Game.freezeObjects = false` (`Inventory.as:153`). The
            // cutscene LOWERS the freeze at the end of every one of its own
            // frames. What holds the player still is `p.active = false` —
            // `Player.update` is never called at all — and that costs the
            // tape a tick per frame, not a dead frame.
            // (`endingChain.CUTSCENE_2_HOLD`.)
            //
            // ⚠ `runFrozenTick` IS STILL THE RIGHT PRIMITIVE and the name is
            // the only thing wrong with it: every line of it is about a tick
            // on which the player does not move while the rest of the world
            // keeps running. The one real difference is that `hitUpdate()`
            // does NOT drain here (it is inside `Player.update`, which an
            // inactive player never reaches) — inert in L115, which holds no
            // damage source, and named rather than left to be discovered.
            if (cutsceneHold) {
                if (held.size > 0) {
                    throw new Error(`levelRun: the tape holds ${[...held].join(', ')} at `
                        + `tick ${ticksCompleted}, inside the \`cutscene[2]\` hold that `
                        + `began at tick ${cutsceneHold.enteredAt}. \`Game.as:961\` sets `
                        + '`p.receiveInput = false` AND `p.active = false` every frame, '
                        + 'so `Player.update` is never called and the span is a silent '
                        + 'no-op in the game — the asymmetry the tape format exists to '
                        + 'prevent.');
                }
                cutsceneHold.r += 1;
                if (cutsceneHold.r === cutsceneHold.endAnimAt) {
                    // `endAnim` -> `sprTreeGrow.play("grown"); drawCover = true`.
                    // ⛔ It fires inside the GRAPHIC update, which
                    // `World.update` runs AFTER `e.update()` — so
                    // `Seed.update` has already run this tick with
                    // `drawCover` still false, and the first `coverAlpha`
                    // increment is the NEXT tick's.
                    cutsceneHold.phase = 'fade';
                    treeEvents.push({
                        t: ticksCompleted, level, what: 'endAnim',
                        r: cutsceneHold.r, updates: cutsceneHold.grow,
                    });
                }
                if (cutsceneHold.r >= cutsceneHold.rebootAt) {
                    treeEvents.push({
                        t: ticksCompleted, level, what: 'coverFull',
                        r: cutsceneHold.r, updates: cutsceneHold.fade,
                    });
                    pendingSeedReboot = {
                        arm: 'tree',
                        id: cutsceneHold.id ?? `tree@${level}`,
                        fromLevel: level,
                        toLevel: level,
                        ctor: { ...worldCtor },
                        // `Game.cutscene[2] = false` — see the reboot block.
                        cutscene: null,
                    };
                    cutsceneHold = null;
                }
                prevHeld = new Set(held);
                const tick = runFrozenTick(activators, 'the tree cutscene');
                // ⛓ AND THE SWAP IS STILL END-OF-TICK. `runFrozenTick`
                // returns before the tick's own tail, so the reboot is run
                // here rather than in the block below — the one place on
                // this path where the two orders could differ, named.
                if (pendingSeedReboot) return finishEndingReboot(state, tick);
                return tick;
            }
            // ── ⛓⛓⛓ R6 SLICE 6d: THE SCRIPTED WALK, AND THE ORACLE ───
            //
            // Two refusals and a witness, and the witness is why the
            // refusals can be trusted. `Game.as:955-960` walks the player
            // north with `receiveInput = false`, and the room it walks into
            // holds `oracle@64,32` whose `doneTalking()` under
            // `Game.cutscene[1]` is `exitToMenu()`. The window's terminal
            // claim is the LEVEL SEQUENCE, so a menu reached by any route at
            // all would make the record unreadable
            // (`r6Acceptance.R6_BLOOD_MENU_DERIVATION`).
            //
            // ⛓⛓ AND THE ORACLE'S GATE IS `keyNeeded`, WHICH IS **TRUE**.
            // `NPCs/NPC.as:41` declares it `true` and `Oracle` — unlike
            // `Watcher` — never assigns it, so proximity alone does NOT open
            // the dialogue: it takes an `Input.released(p.keys[6])` while in
            // range. §17.10 priced the clamp as "a boundary, not a margin"
            // on the assumption that arriving inside the circle was enough;
            // it is not, and that is the difference between a window that
            // has to stop 14 px early and one that can stand in the circle
            // for as long as it likes with no key live.
            //
            // ⛔ THE HARNESS CANNOT SUPPLY THE RELEASE EITHER, and that is
            // the second half of the same argument. `Bot.autoAdvance` is
            // called only from inside the DEAD-FRAME gate and returns
            // immediately unless `Game.talking || helpUp` — so it presses X
            // only into a dialogue that is ALREADY up. It cannot open one.
            // Both facts are needed: either alone leaves the trap live.
            if (cutsceneWalk) {
                if (held.size > 0) {
                    throw new Error(`levelRun: the tape holds ${[...held].join(', ')} at `
                        + `tick ${ticksCompleted}, inside the \`cutscene[${cutsceneWalk.arm}]\` `
                        + 'scripted walk that began at tick '
                        + `${cutsceneWalk.startedAt}. \`Game.as:956\` sets `
                        + '`p.receiveInput = false` every frame of it, so `Player.input()` '
                        + 'returns at its first line and the span is a SILENT no-op in '
                        + 'the game — the asymmetry the tape format exists to prevent. '
                        + 'And an X release here is worse than inert: it is the one input '
                        + 'that can open L1\'s Oracle, whose `doneTalking()` under '
                        + '`cutscene[1]` is `exitToMenu()`. End the tape before the '
                        + 'reboot, or hold nothing after it.');
                }
                for (const o of (world.oracles ?? [])) {
                    const d = Math.sqrt((o.ex - state.x) ** 2 + (o.ey - state.y) ** 2);
                    const inRange = d <= ORACLE.talkRange;
                    oracleApproach.push({
                        t: ticksCompleted, level, id: o.id, distance: d, inRange,
                    });
                    if (inRange && releasedThisTick(held, TALK_KEY)) {
                        throw new Error(`levelRun: an X release at tick ${ticksCompleted} `
                            + `lands ${d.toFixed(2)} px from ${o.id}, inside its `
                            + `${ORACLE.talkRange} px talk circle, with `
                            + `\`Game.cutscene[1]\` set. \`NPC.talk\` reads `
                            + '`Input.released(p.keys[6])` DIRECTLY — past the '
                            + '`receiveInput = false` the cutscene set — so this release '
                            + 'starts the Oracle\'s dialogue, and `Oracle.doneTalking()` '
                            + 'under `cutscene[1]` calls `exitToMenu()`. The tape would '
                            + 'end in a menu it never asked for and the record would be a '
                            + 'claim about the harness. Refused.');
                    }
                }
            }
            // ── ⛓⛓⛓ R6 SLICE 6d: `updateLists()`'s ADD HALF ──────────
            //
            // `Engine.update` is `world.update(); world.updateLists();`, so
            // an entity added inside a tick joins the update list at the END
            // of it and first updates on the NEXT one. Drained here, at the
            // top of the following tick, rather than at the bottom of the
            // previous one — because a tick can leave through four different
            // returns (frozen, death, transition, normal) and the bottom is
            // only one of them. Same shape as `stepFinalDoorsNow`'s
            // `pendingRemove`, which is the REMOVE half of the same call.
            if (pendingSeedAdds.length > 0) {
                runtimeSeeds = [...runtimeSeeds, ...pendingSeedAdds];
                pendingSeedAdds = [];
            }
            // ── ⛓⛓⛓ R6 SLICE 6c: THE WATCHER, ABOVE THE CEREMONY ─────
            //
            // `Game.loadlevel` adds the pickups at `:2100` and the watchers
            // at `:2237`, and `World.addUpdate` PREPENDS — so the update list
            // is watcher -> … -> pickup -> … -> Player and the NPC's `talk()`
            // runs first. Both are above the player, which is what makes the
            // freeze either one raises visible to `Mobile.mobileUpdate` on
            // the same frame.
            //
            // ⛔ AND THE TWO FREEZES ARE NOT INTERCHANGEABLE. A ceremony's
            // phase A is DEAD frames (`Game.talking` is false, so nothing
            // lowers `freezeObjects` and the bot's gate sees it); a dialogue
            // frame is a TAPE TICK (`Game.update`'s
            // `else if (inventory) inventory.open = false` lowers it every
            // frame while `Game.talking`). A window that ran both at once
            // would have to interleave two clocks — so it is REFUSED rather
            // than approximated, and the refusal names both.
            if (!noclip) {
                const watcherRelease = releasedThisTick(held, TALK_KEY);
                const wr = stepWatchersNow(watcherRelease);
                if (wr.frozen) {
                    if (ceremony !== null) {
                        throw new Error('levelRun: a Watcher\'s dialogue and a pickup '
                            + `ceremony are both up at tick ${ticksCompleted}. One X `
                            + 'release would be read by BOTH `NPC.talk()` calls, and the '
                            + 'two freezes cost the tape different things — a dialogue '
                            + 'frame is a TICK, a ceremony\'s phase A is a DEAD frame. '
                            + 'Refused rather than approximated.');
                    }
                    prevHeld = new Set(held);
                    return runFrozenTick(activators, 'a Watcher\'s dialogue');
                }
            }

            // ── ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR, BESIDE THE WATCHER ──
            //
            // `Game.loadlevel` adds it at `:2190` and the Player at `:2092`,
            // and `World.addUpdate` PREPENDS — so the door updates before
            // the player and the freeze its `SealController` raises in the
            // CONSTRUCTOR lands before `Mobile.mobileUpdate` reads it. The
            // trigger tick is therefore a LIVE tape tick with a frozen
            // player, and the 181 frames after it are DEAD.
            //
            // ⚠ The two families never share a room (the door is L113's, the
            // watcher L114's), so the order between these two calls is a
            // bounded vacuity — stated rather than left to be inferred from
            // the fact that nothing broke.
            if (!noclip) {
                const dr = stepFinalDoorsNow();
                if (dr.frozen) {
                    if (ceremony !== null) {
                        throw new Error('levelRun: a SealController and a pickup ceremony '
                            + `are both up at tick ${ticksCompleted}. Both are DEAD-frame `
                            + 'freezes with their own lengths and the model resolves each '
                            + 'as a LUMP, so running them together would double-count one '
                            + 'span or hide the other. Refused rather than approximated.');
                    }
                    prevHeld = new Set(held);
                    return runFrozenTick(activators, 'the final door\'s seal ceremony');
                }
            }

            // ── ⛓⛓⛓ R6 SLICE 6f: THE OWL ROOM, IN ONE SLOT ────────────
            //
            // Rocks, grenades, pods and the boss, in `World.update`'s own
            // order — see `stepOwlNow` for why each of those four positions is
            // load-bearing. It sits here, above the ceremony's early return
            // and above the player, for the ShieldBoss's reason:
            // `Enemy.update`'s tail (`hitUpdate`, `hitPlayer`) has no
            // `Game.freezeObjects` test anywhere above it.
            //
            // ⚠ AND THE ORDER BETWEEN THIS AND THE OTHER FAMILIES IS A
            // BOUNDED VACUITY WITH ITS BOUND NAMED: L112 holds no spinner, no
            // pushable, no crusher, no turret, no chest, no pulser, no
            // watcher, no door and no pickup — the whole room is four pods,
            // four plant torches, an orb, a rocklock, two teleporters and the
            // Owl. The relative slot is therefore unobservable today; it is
            // placed where the add order says because the alternative is a
            // slot chosen by convenience that a second room would silently
            // invalidate.
            //
            // ⛔ THE INTRO'S FREEZE IS A TAPE TICK, NOT A DEAD FRAME. It is a
            // `Game.talking` freeze (`FinalBoss.as:81-86` sets both), and
            // `Game.update`'s `else if (inventory) inventory.open = false` IS
            // `Game.freezeObjects = false` — so the flag is lowered at the end
            // of every one of its own frames and the bot's dead-frame gate
            // never sees it. `runFrozenTick` is the same treatment the
            // Watcher's dialogue gets, for the same reason.
            if (!noclip) {
                const ow = stepOwlNow({
                    // ⛔ THE RAW KEYS, NOT `acting`. `FinalBoss.update` reads
                    // `Input.released(p.keys[6])` DIRECTLY, outside
                    // `Player.input()` — so neither the intro's own freeze nor
                    // a touch-lock's `receiveInput = false` can hide the edge.
                    // The same directness that makes `Bot.autoAdvance` a
                    // hazard for the Oracle (§18.7) makes the intro
                    // dismissable while the world is frozen.
                    //
                    // ⛓ THE PRESS EDGE IS DELIBERATELY NOT PASSED. Slice 6g
                    // measured the intro ending on the RELEASE and the press
                    // being swallowed by the freeze at both ends
                    // (`botStatus.slash.tests` is 0 on the plan's own first
                    // press) — so an arm that took `pressed` would be the
                    // refuted reading kept alive as an unused argument.
                    held: held.has(TALK_KEY),
                    wasHeld: wasHeld.has(TALK_KEY),
                });
                if (ow.frozen) {
                    if (ceremony !== null) {
                        throw new Error('levelRun: the Owl\'s intro freeze and a pickup '
                            + `ceremony are both up at tick ${ticksCompleted}. The intro's `
                            + 'is a `Game.talking` freeze (its frames are TAPE TICKS) and '
                            + 'a ceremony\'s phase A is DEAD frames; running them together '
                            + 'would interleave two clocks. Refused rather than '
                            + 'approximated.');
                    }
                    prevHeld = new Set(held);
                    owlJiggleNow();
                    return runFrozenTick(activators, 'the Owl\'s intro');
                }
            }

            // ── the ceremony, before anything else ─────────────────────
            // A pickup updates BEFORE the player, so a contact found here
            // is a contact the game found on this frame too. Starting one
            // and stepping one are the same branch: phase A is invisible,
            // so the advance that discovers the contact IS phase B's first
            // frame.
            // ── ⛓⛓⛓ R5 SLICE 23: THE WAND'S APPROACH FADE ───────────
            //
            // Before the contact is even looked for, because the game looks
            // for it in the other order: `Wand.update`'s gate is the
            // player's Y and two booleans, and the 99 frozen frames it buys
            // are spent while the player is still walking toward the
            // pickup. A model that started the clock at the contact would
            // be 99 dead frames short and every later observation would
            // still line up — which is why this is asserted against the
            // game's own `dead_frames` and not against the stream.
            if (!wandFadeSpent && !noclip) {
                const wand = (world.pickups ?? []).find((p) => p.tag === 'wand'
                    && !collectedPickups.has(pickupKey(level, p)));
                if (wand && wandFadeGateOpen({
                    playerY: state.y,
                    wandY: wand.y,
                    hasAllTotemParts: hasAllTotemParts(),
                    // ⛔ The model has no `fallFromCeiling` here because a
                    // pit ARRIVAL is a transition and this run boots. The
                    // gate's third term is what makes a BOOT a cleaner
                    // entry than the pit the room is reached by — see
                    // `r5Totem.L43_WAND_WINDOW.arrivalGate`.
                    fallFromCeiling: false,
                })) {
                    wandFadeSpent = true;
                    const fade = wandFadeFreezeTicks();
                    frozenFramesOwed += fade;
                    wandFades.push({ t: ticksCompleted, level, deadFrames: fade });
                }
            }
            // ── ⛓⛓⛓ R6 SLICE 6d: THE RUNTIME SEED, BEFORE THE PLACED ──
            //
            // ⚠ THE ORDER BETWEEN THIS AND THE WATCHER BLOCK ABOVE IS A
            // BOUNDED VACUITY, NAMED. The seed is added at runtime and
            // `addUpdate` PREPENDS, so in the game it updates BEFORE the
            // Watcher that made it — the opposite of the order here. It
            // cannot be observed: the only Watcher that can spawn one has a
            // CLEARED tag (that is the hit gate), so its `talk()` never
            // runs, and the two remaining lines of its update are a counter
            // and a once-only latch that this tick has already set. Stated
            // rather than left to be inferred from nothing breaking.
            if (ceremony === null && !noclip) {
                const seed = runtimeSeedUnderfoot();
                if (seed) {
                    seed.collected = true;
                    ceremonyStarts.push({
                        t: ticksCompleted, level, tag: 'seed', runtime: true,
                    });
                    ceremony = {
                        pickup: { tag: 'seed', x: seed.ex, y: seed.ey, runtime: true },
                        level,
                        // ⛔ NOTHING. `Seed` overrides `removeSelf` and never
                        // reaches `removed()`, so the ceremony grants no item
                        // and writes no persistence — the only thing it does
                        // is the fade and the reboot below.
                        item: null,
                        keyType: null,
                        seed: { id: seed.id, arm: seed.arm },
                        dialogue: beginDialogue(seed.text, { framesThisCharacter }),
                    };
                }
            }
            if (ceremony === null) {
                const hit = pickupUnderfoot();
                if (hit) {
                    // ⛔ R6 slice 5 — see `assertNoCeremonyBesideShieldBoss`.
                    if (!noclip) assertNoCeremonyBesideShieldBoss(hit.tag ?? 'pickup');
                    // ⛓ R8 slice 1: and the chaser's narrower version of the
                    // same asymmetry — see `assertNoCeremonyBesideLiveChaser`
                    // for why it refuses two STATES rather than a class.
                    if (!noclip) assertNoCeremonyBesideLiveChaser(hit.tag ?? 'pickup');
                    const entry = ceremonyFor(hit);
                    ceremonyStarts.push({
                        t: ticksCompleted, level, tag: hit.tag ?? 'pickup', runtime: false,
                    });
                    ceremony = {
                        pickup: hit,
                        level,
                        item: entry.item,
                        // R4: `null` for everything but a BossKey — see the
                        // `keys` set and `dialogue.PICKUP_CEREMONY.bosskey`.
                        keyType: hit.keyType === undefined ? null : hit.keyType,
                        // R7: `keyType`'s twin — null for everything but a
                        // `BossTotemPart`, whose `removed()` writes
                        // `Player.hasTotemPartSet` instead of an item flag.
                        totemPart: hit.totemPart === undefined ? null : hit.totemPart,
                        // ⚠ `text: ''` is a REAL case (a totem part, a
                        // non-zero boss key): `pick_up()` spawns no NPC, so
                        // phase A runs and the pickup removes itself with no
                        // dialogue at all. Charging it a dialogue would cost
                        // the tape ticks the game never spends.
                        dialogue: entry.text === ''
                            ? null
                            : beginDialogue(entry.text, { framesThisCharacter }),
                        // ⛓⛓⛓ R6 SLICE 6d: a PLACED `seed` takes the same
                        // completion as the Watcher's runtime one — the
                        // fade and the reboot — and its arm is `plain`
                        // (`bloody` is false for anything `loadlevel`
                        // builds, and `tree` is guarded above).
                        ...(hit.tag === 'seed'
                            ? { seed: { id: pickupKey(level, hit), arm: 'plain' } } : {}),
                    };
                }
            }
            if (ceremony !== null) {
                const released = releasedThisTick(held, TALK_KEY);
                prevHeld = new Set(held);
                if (ceremony.dialogue) stepDialogue(ceremony.dialogue, released);
                const finishing = ceremony.dialogue === null || ceremony.dialogue.done;
                if (finishing && ceremony.seed) {
                    /**
                     * ── ⛓⛓⛓ R6 SLICE 6d: `Seed.removeSelf()` — THE PICKUP
                     * THAT NEVER LEAVES AND NEVER GIVES ANYTHING ────────
                     *
                     * Every other pickup's completion is `removeSelf()` ->
                     * `FP.world.remove` -> `removed()`: the item property and
                     * `Game.setPersistence(tag, false)`. `Seed` OVERRIDES
                     * `removeSelf` with two lines that call neither:
                     *
                     * ```as3
                     *   override public function removeSelf():void
                     *   { Game.freezeObjects = true; drawCover = true; }
                     * ```
                     *
                     * ⇒ no item, NO FLAG (which is why `earnedClears` stays
                     * empty for a window whose whole subject is a collected
                     * pickup) and the entity stays in the world drawing a
                     * cover over the screen for 200 frames.
                     *
                     * ⛔⛔ AND THOSE 200 ARE DEAD FRAMES, NOT TICKS.
                     * `Game.talking` is false for all of them — the dialogue
                     * ended one frame ago — so `Game.update`'s
                     * `else if (inventory) inventory.open = false` never runs
                     * (`canInventory()` is TRUE) and nothing lowers the flag
                     * between frames. The bot's gate sees every one. A
                     * recording deadline scaled from the TICK count would
                     * read this window as a dead bot (§12.14a).
                     */
                    const fade = coverFadeFrames();
                    frozenFramesOwed += fade;
                    seedFades.push({
                        t: ticksCompleted, level, id: ceremony.seed.id,
                        arm: ceremony.seed.arm, fadeFrames: fade,
                    });
                    /**
                     * ⛓⛓⛓ `Seed.update`'s TERMINAL ARMS, and the branch is
                     * on the two ctor booleans rather than on the level.
                     *
                     *   bloody -> `cutscene[1] = true`, `new Game(1,64,96)`
                     *   plain  -> `cutscene[2] = true`, THE SAME LEVEL at
                     *             `Game.currentPlayerPosition` — which the
                     *             `playerPosition` setter wrote from the
                     *             CURRENT world's own ctor args, i.e. this
                     *             run's `worldCtor`, i.e. the boot block.
                     *
                     * ⛔ THE PLAIN ARM'S REBOOT IS WHAT ARMS THE TREE.
                     * `Game.as:2185` passes `cutscene[2]` as `Seed`'s fifth
                     * ctor argument, so the same `.oel` object comes back as
                     * a tree. The two arms are one chain, not two options —
                     * and the SAME arm is a soft-lock in a room with no
                     * `seed` object (trap 91).
                     */
                    if (ceremony.seed.arm === 'bloody') {
                        // ⛓ `Game.cutscene[1] = true` and `FP.world = new
                        // Game(1, 64, 96, false)` — a reboot the DRIVER did
                        // not order, deferred to the end of the tick beside a
                        // death's for the reason both share:
                        // `Engine.checkWorld` swaps after the whole tick.
                        pendingSeedReboot = {
                            arm: 'bloody',
                            id: ceremony.seed.id,
                            fromLevel: level,
                            toLevel: SEED_ARMS.bloody.reboot.level,
                            ctor: {
                                x: SEED_ARMS.bloody.reboot.x,
                                y: SEED_ARMS.bloody.reboot.y,
                            },
                            cutscene: 1,
                        };
                    } else if (ceremony.seed.arm === 'plain') {
                        // ⛔ THE DESTINATION DECIDES WHETHER THIS IS THE
                        // ENDING OR A SOFT-LOCK, and it is the same code
                        // either way. A room with a `seed` object grows a
                        // tree; a room without one leaves `cutscene[2]` set
                        // for ever, and `Game.as:961` then spawns every
                        // later player `receiveInput/visible/active = false`.
                        // Refused by name rather than driven into.
                        const dest = worldFor(level);
                        if (!(dest.pickups ?? []).some((p) => p.tag === 'seed')) {
                            throw new Error(`levelRun: a plain Seed collected in level `
                                + `${level} reboots into a level with NO \`seed\` object. `
                                + '`Game.cutscene[2]` is a `public static` cleared only '
                                + 'by the tree arm or a save wipe, and `Game.as:961` '
                                + 'then spawns the player `receiveInput = false; visible '
                                + '= false; active = false` in EVERY later world. That '
                                + 'is a SOFT-LOCK for the rest of the page, not a lost '
                                + 'pickup, and it looks exactly like a dead bot.');
                        }
                        pendingSeedReboot = {
                            arm: 'plain',
                            id: ceremony.seed.id,
                            fromLevel: level,
                            toLevel: level,
                            // `Game.currentPlayerPosition` — written by the
                            // `playerPosition` SETTER from the current
                            // `Game`'s own ctor args and never by walking.
                            ctor: { ...worldCtor },
                            cutscene: 2,
                        };
                    } else {
                        throw new Error('levelRun: a Seed ceremony finished on the '
                            + `"${ceremony.seed.arm}" arm, which this rung does not `
                            + 'model. `Seed.update` has THREE terminal arms and they '
                            + 'reboot into different levels with different cutscene '
                            + 'flags.');
                    }
                    if (ceremony.dialogue) {
                        framesThisCharacter = ceremony.dialogue.framesThisCharacter;
                    }
                    collected.push({
                        t: ticksCompleted + 1,
                        level: ceremony.level,
                        item: null,
                        keyType: null,
                        frames: ceremony.dialogue ? ceremony.dialogue.frames : 1,
                    });
                    ceremony = null;
                    // ⚠ AND THEN FALL THROUGH, exactly as an ordinary
                    // ceremony's completing frame does. The step it takes is
                    // never observed — `enterWorld` overwrites `state` with
                    // the arrival at the end of this same tick — but it is
                    // taken rather than skipped so that the two completions
                    // do not become two models of one frame.
                } else if (finishing) {
                    // `removeSelf()` -> `removed()`: the property write and
                    // `Game.setPersistence`. The item lands HERE and not on
                    // contact, which is the whole difference between a real
                    // collection and R0's grant.
                    collectedPickups.add(pickupKey(ceremony.level, ceremony.pickup));
                    // ⛓⛓ R7 slice 6: and the `Game.setPersistence(tag, false)`
                    // the same `removed()` runs. `persistTag` is present only
                    // for the fourteen classes that write it
                    // (`PICKUP_CLEARS_OWN_TAG`), so a BossKey or a totem part
                    // banks nothing here and its flag stays set — which is
                    // what the game does.
                    if (ceremony.pickup.persistTag !== undefined
                        && ceremony.pickup.persistTag >= 0) {
                        pickupFlags.set(
                            `${ceremony.level}:${ceremony.pickup.persistTag}`,
                            {
                                id: `${ceremony.pickup.tag}@${ceremony.pickup.x},`
                                    + `${ceremony.pickup.y}`,
                                level: ceremony.level,
                                tag: ceremony.pickup.persistTag,
                                t: ticksCompleted + 1,
                            });
                    }
                    // `item: null` is a pickup the fourteen-property mirror
                    // does not track (a boss key, a totem part) — the
                    // ceremony is real, there is just nothing to apply.
                    if (ceremony.item) applyItem(inventory, ceremony.item);
                    // ...unless it is a BossKey, whose `removed()` writes
                    // `Player.hasKeySet(keyType, true)` INSTEAD of an item
                    // property and instead of persistence. R4's whole key
                    // chain hangs off this one line.
                    if (ceremony.keyType !== null) keys.add(ceremony.keyType);
                    // ⛓ R7 slice 1: and the same line for a totem part,
                    // whose `removed()` writes `Player.hasTotemPartSet`
                    // instead. It was missing for four rungs and nothing
                    // could see it, because nothing consumed the model's
                    // totem set: the R5 wand windows all PRESENT the parts
                    // through the v6 save block and none walks onto one.
                    // `botStatus.save`'s new consumer is what makes it
                    // visible, which is the shape of debt 6 exactly.
                    if (ceremony.totemPart !== null
                        && ceremony.totemPart !== undefined) {
                        totemParts.add(ceremony.totemPart);
                    }
                    // ── ⛓⛓⛓ R5 SLICE 23: `Wand.removed()` ───────────────
                    //
                    // Three writes in one override, and the tape sees all
                    // three: `Player.hasWand = true` (the item, applied
                    // above), `Game.setPersistence(tag, false)` (the earned
                    // clear, which the ceremony's own machinery banks), and
                    // — uniquely — a loop that sets `activate = true` on
                    // EVERY tset-0 `Activators` in the room.
                    //
                    // ⛔ THE LOOP IS WHAT MAKES THIS PICKUP A PUBLISHER, and
                    // it is why the wand is LAST in the itinerary: L43's
                    // three `fallrock`s are all tset 0, and
                    // `fallrock@176,384` lands on the unique open tile of
                    // row 24 — the mouth of the shaft the room's only
                    // stairs sit at the bottom of. `fall()`'s first line is
                    // `setPersistence(tag, false)`, so the seal holds for
                    // every later visit.
                    // [[feedback_the_pickup_seals_its_own_exit]]
                    if (ceremony.pickup.tag === 'wand' && !noclip) {
                        wandLeftTheWorld = true;
                        const group = WAND_PICKUP.tset;
                        activatorStateFor(level).latched.set(group, true);
                        const rocks = fallRockStateFor(level);
                        const together = [...rocks].filter(
                            ([, r]) => r.t === group && !r.landed,
                        );
                        const dropped = dropRocksTogether(together);
                        droppedRocksThisTick = true;
                        for (const d of dropped.dropped) {
                            rocks.set(d.id, d.state);
                            if (!d.write) continue;
                            const rf = outOfBandFlagFor(level, d.write.tag);
                            if (!pendingEarnedClears.has(rf.level)) {
                                pendingEarnedClears.set(rf.level, new Set());
                            }
                            pendingEarnedClears.get(rf.level).add(rf.tag);
                        }
                        // ⛔ AND THE SNAP, if the collect was made under a
                        // landing. Same rule as the rope's: the whole span
                        // is frozen, so the LAST snap is where the next live
                        // tick starts from.
                        if (dropped.snapY !== null) state.y = dropped.snapY;
                    }
                    collected.push({
                        t: ticksCompleted + 1,
                        level: ceremony.level,
                        item: ceremony.item,
                        keyType: ceremony.keyType,
                        frames: ceremony.dialogue ? ceremony.dialogue.frames : 1,
                    });
                    if (ceremony.dialogue) {
                        framesThisCharacter = ceremony.dialogue.framesThisCharacter;
                    }
                    ceremony = null;
                    // ⚠ AND THEN FALL THROUGH TO A NORMAL STEP. The frame
                    // that ENDS a dialogue is not a frozen frame: the NPC
                    // updates BEFORE the player (`World.addUpdate` PREPENDS
                    // and the temporary NPC is added last), so `talking =
                    // false` has already cleared `Game.freezeObjects` by the
                    // time `Mobile.mobileUpdate` reads it, and the player
                    // moves on that very tick. The oracle says so exactly:
                    // `r3-collect-sword` is frozen for observations 24..57
                    // and observation 58 — the completing one — is already
                    // back in motion at y 61.00, carrying the velocity the
                    // freeze preserved. Counting it as frozen made the model
                    // one tick long and was the only divergence in the
                    // whole ceremony.
                } else {
                    // ⛓ R6 slice 6c: one implementation, two callers — see
                    // `runFrozenTick`, which is this arm, extracted verbatim.
                    return runFrozenTick(activators, 'a pickup ceremony');
                }
            } else {
                prevHeld = new Set(held);
            }
            // ── ⛓⛓⛓ R5 SLICE 23: THE BOSS, AND THE CLAMP IT ASSIGNS ──
            //
            // `Game.loadlevel` adds the boss at `:2121` and the Player at
            // `:2092`, and `World.addUpdate` PREPENDS — so the boss updates
            // BEFORE the player and the clamp it writes is the y the
            // player's own sweep starts this tick from. Below the ceremony
            // and above the physics, for exactly that reason.
            //
            // ⛔ ONLY ON LIVE TICKS, AND THE FROZEN ONES ARE ACCOUNTED
            // ELSEWHERE. Every frozen span this room can produce is
            // resolved inside one model tick — the wand's approach fade
            // (nothing in level 43 advances through it) and the rocks'
            // 186-frame drop (which steps the boss itself, because
            // `BossTotem`'s rumble and ramp have no freeze test). A boss
            // that were somehow activated during a ceremony would need its
            // ticks spent here too, so that is a REFUSAL rather than an
            // approximation.
            if (!noclip && !droppedRocksThisTick) {
                for (const b of bossStateFor(level).values()) {
                    if (!b.activated) continue;
                    if (ceremony !== null) {
                        throw new Error('levelRun: a BossTotem is awake while a '
                            + 'ceremony is running. Its rumble and activation ramp '
                            + 'have NO `Game.freezeObjects` test, so the frozen '
                            + 'frames would advance it in the game and not here — '
                            + 'the whole clamp schedule would be short by the '
                            + 'ceremony\'s length. Model the span rather than '
                            + 'stepping the boss on live ticks only.');
                    }
                    const bossOpts = normalizeLiveOpts(liveSolidOpts());
                    const r = stepBossTotem(b, {
                        wandGone: wandLeftTheWorld,
                        freezeObjects: false,
                        playerY: state.y,
                        playerBox: playerBoxAt(state.x, state.y),
                        // ⛔ `Mobile.solids` FOR THE BOSS, not for the
                        // player: the two lists differ (the boss's is the
                        // base `["Solid","Tree","Rock","Rope","ShieldBoss"]`
                        // and the player's carries `"LavaBoss"`), and the
                        // boss must not collide with HIMSELF — `liveRectOf`
                        // returns null for an activated boss, which is
                        // exactly the exclusion `Entity.collide`'s
                        // `e !== this` gives him in the game.
                        // [[feedback_notsolid_is_per_mover]]
                        isSolid: (bx) => !!world.collidesSolid(bx, bossOpts),
                        terrainState: world.nearestWalkableTile(b.x, b.y)?.t ?? null,
                    });
                    if (r.clampedY !== null) {
                        bossClamps.push({
                            t: ticksCompleted,
                            level,
                            from: state.y,
                            to: r.clampedY,
                            sinceActivation: b.sinceActivation,
                        });
                        // ⛔ AN ASSIGNMENT. Not a sweep, not a collision
                        // resolution — one write of one number, which is
                        // why the record carries the y it overwrote.
                        state.y = r.clampedY;
                    }
                    // ── ⛓⛓⛓ R6 SLICE 4: THE FIGHT, WIRED ─────────────
                    //
                    // R5's `A+335` throw retires here. What replaces it is
                    // the four things the walk arm can do to the player,
                    // each at the place in the tick the game does it.
                    if (r.walkingNow) {
                        bossWalks.push({ t: ticksCompleted, level, id: b.id ?? null });
                    }
                    // 1. THE LASER. `Game.shake = 30` is written beside the
                    //    rect test and OUTSIDE it, so the band opens on
                    //    schedule whether or not the beam connected (§11.6).
                    if (r.laserFired) {
                        bossLasers.push({
                            t: ticksCompleted, level, y: b.y,
                            rects: (r.laserRects ?? []).map((q) => ({
                                x: q.x, right: q.right, y: q.y, bottom: q.bottom,
                                depth: q.depth, cappedAtSweep: q.cappedAtSweep,
                            })),
                            hitCalls: r.laserHitCalls,
                        });
                        shake = applyShakeWriter(shake, 'totemLaser');
                        // ⛔ TWO RECTS, TWO `hit` CALLS. `hitPlayers` walks
                        // a vector both `collideRectInto`s appended to, so a
                        // player inside both overlapping rects is hit TWICE
                        // — the second swallowed by their own i-frames and
                        // not by the boss. Applied as the game applies it.
                        for (let i = 0; i < r.laserHitCalls; i += 1) {
                            applyPlayerHit({
                                source: 'bossLaser', id: b.id ?? 'bosstotem',
                                force: BOSS_TOTEM_FIGHT.laserForce,
                                damage: 1,
                                // `new Point(player.x, y)` — the player's OWN
                                // x against the BOSS's y, so the knockback is
                                // pure south. Not the boss's x.
                                from: { x: state.x, y: b.y },
                            });
                        }
                    }
                    // 2. THE ATTACK'S TWO PROJECTILES, `FP.world.add`ed and
                    //    therefore not present until the NEXT tick's list
                    //    drain — the deferred-add rule the wand shot pays
                    //    too (`WAND_WINDOW.firstShotUpdateTick`).
                    if (r.attackShots.length > 0) {
                        for (const s of r.attackShots) {
                            const id = `bosstotemshot@${ticksCompleted}:${bossShotSeq += 1}`;
                            bossShotsFor(level).push({ id, ...s });
                            bossShotsFired.push({
                                t: ticksCompleted, level, id, x: s.x, y: s.y,
                            });
                        }
                    }
                    // 3. THE BODY. §11.10's warning is a computation now:
                    //    an 80x32 box at force 3, gated on the BOSS's own
                    //    20-tick `hitsTimer`, so each landed wand shot buys
                    //    exactly 20 ticks of silence — and the tick the
                    //    timer reaches 0 is one tick BEFORE the next shot
                    //    can land, which is why a stance stands clear of
                    //    the body instead of out-shooting it.
                    if (r.bodyContact) {
                        applyPlayerHit({
                            source: 'bossBody', id: b.id ?? 'bosstotem',
                            force: BOSS_TOTEM_BODY.force,
                            damage: BOSS_TOTEM_BODY.damage,
                            from: { x: b.x, y: b.y },
                        });
                    }
                    // 4. THE CAMERA OVERRIDE, which runs on every frame he
                    //    exists and is the last thing in his `update()`.
                    //    ⛓ `Game.cameraTarget` is a STATIC: once he dies his
                    //    `update()` returns above this block and the target
                    //    is FROZEN at the last midpoint for the whole
                    //    240-frame white-out (§8.16), until `removed()`
                    //    calls `Game.resetCamera()`.
                    bossCameraTarget = bossTotemCameraTarget(b, state);
                }
            }
            droppedRocksThisTick = false;
            // ── ⛓⛓⛓ R6 SLICE 3: THE BODIES TOUCH THE PLAYER, LAST ────
            //
            // `Enemy.update` ends with `hitUpdate(); hitPlayer();` and every
            // enemy is EARLIER in the update list than the Player
            // (`loadlevel` adds the player at `:2092`, the enemies after,
            // and `World.addUpdate` PREPENDS) — so this is the last thing
            // that happens before the player's own tick. R5's pair measured
            // exactly that: the overlap exists in observation 49, the enemy
            // writes the impulse on the next tick, and the position first
            // MOVES in observation 50.
            //
            // ⚠ AND IT IS **BELOW** THE BOSS, which is the ordering that
            // decides it: `loadlevel` adds the plain enemies at `:2081` and
            // the BossTotem at `:2121`, so the PREPEND puts the boss first
            // and the clamp it writes is already in `state.y` here.
            //
            // ⚠ A CEREMONY TICK RETURNS ABOVE THIS LINE, so a contact made
            // during one is not scanned. That is byte-inert rather than
            // approximate — `Player.hit`'s own `!Game.freezeObjects` would
            // have returned, and the only state a scan would have moved is
            // the ENEMY's `hitsTimer`, which is 0 for every body this arm
            // prices (nothing on this rung shoots a trap). What is lost is
            // a `contactsSuppressed` row, and `applyPlayerHit` still
            // carries `frozen` for the sources that DO run above the return
            // (the blast, the ring and the crusher).
            stepContactsNow();
            // ── ⛓⛓⛓ R8 SLICE 1: THE CHASERS, AND THEY ARE **LAST** ────
            //
            // `Game.loadlevel` adds `bob` at `:2141`, BEFORE every other
            // enemy family and AFTER the Player (`:2115`), and
            // `World.addUpdate` PREPENDS — so a Bob is the last enemy in the
            // update list and the last thing that runs before the player's
            // own tick. Below `stepContactsNow`, whose bodies (`sandtrap`
            // `:2156`) are added AFTER `bob` and therefore update BEFORE it.
            // See `stepChasersNow` for the whole ordering and for why the
            // obvious slot — next to the ice turret — is wrong by nine
            // families.
            if (!noclip) stepChasersNow();
            // ⚠ A touch-lock window drops the KEYS, not the tick.
            // `receiveInput` gates `Player.input()` alone, so friction, both
            // sweeps and `getState` all still run — which is why the player
            // keeps drifting on the velocity the snap did not clear. The
            // tape's own `held` is still what the DIALOGUE reads above,
            // because `NPC.talk()` reads `Input.released` from outside
            // `Player.input()` and a refused player can still talk.
            // ⛓⛓⛓ R5 SLICE 22: AND A BLAST FREEZE DROPS THEM THE SAME WAY,
            // because it is the SAME LINE. `Player.input()`'s first
            // statement is `if (!receiveInput || frozenTimer > 0 ||
            // fallFromCeiling) return` — the touch-lock writes the first
            // term and a blast writes the second, so a model that gave them
            // different treatment would be modelling one `if` twice.
            //
            // ⛔ THIS IS WHAT BURNS THE PRESS. `useItem(Main.primary)` is
            // called from inside `input()`, below the return, and
            // `Input.pressed` is a rising edge the frame clears whether or
            // not anybody read it. Dropping the keys here is exactly that
            // loss — see the refusal below, which will not let a tape
            // schedule one.
            // ⛓⛓⛓ R6 SLICE 6d: AND `cutscene[1]` IS THE THIRD WRITER OF THE
            // SAME `if`. `Game.as:956` sets `p.receiveInput = false` on every
            // frame of the scripted walk, which is the FIRST term of
            // `Player.input()`'s `if (!receiveInput || frozenTimer > 0 ||
            // fallFromCeiling) return` — the same line a touch-lock writes.
            // One statement, three writers, one treatment.
            const acting = (lockSnap || frozenTimer > 0 || cutsceneWalk) ? NO_KEYS : held;
            // ── R4: the thrust the last tick's press scheduled ────────
            // After the blocks' own update (the block's `hit` refuses while
            // `v.length > 0`, and `v` is what its own `input()` just set)
            // and before the player moves (`spear()` runs at the top of
            // `Player.update`, above `super.update()`).
            if (pendingThrust) {
                applyThrust(pendingThrust);
                /**
                 * ⛔⛔⛔ R6 SLICE 5: AND FOUR MORE, ON THE FOUR TICKS AFTER.
                 *
                 * `Player.slash`'s `slashDelayMax` is ZERO, so the hit test
                 * runs on every tick `slashing` is up — `T+1 … T+5`, five in
                 * all (`presses.SLASH_HIT_TICKS`). This model fired ONE for
                 * five rungs and was right every time, because every arm it
                 * had reached is idempotent inside five ticks. `ShieldBoss`
                 * is not: hit 1 spends the swallowed dispatch and hit 2 of
                 * the SAME press starts a retaliation stab. The game's
                 * recording is what found it.
                 *
                 * ⚠ THE REPEATS ARE THE SAME THRUST, RE-AIMED. `slashDirection`
                 * is LATCHED at the press (`set slashing`) so the direction
                 * does not move, but the RECT is recomputed from the player's
                 * live position on each tick — `getSlashRect()` reads `x`/`y`
                 * every call — so a player being knocked back swings from
                 * where they are, not from where they pressed.
                 */
                if (pendingThrust.weapon === 'sword') {
                    for (let i = 1; i < SLASH_HIT_TICKS; i += 1) {
                        slashRepeats.push({ ...pendingThrust, at: ticksCompleted + i, repeat: i });
                    }
                }
                pendingThrust = null;
            }
            // The four repeats, each on its own tick and against this tick's
            // position. ⚠ FILTERED IN PLACE rather than shifted, because a
            // second press inside the window is legal (it re-plays the anim,
            // which RESETS the clock) and the two windows must not interleave
            // by index.
            if (slashRepeats.length > 0) {
                const due = slashRepeats.filter((r) => r.at === ticksCompleted);
                if (due.length > 0) {
                    slashRepeats = slashRepeats.filter((r) => r.at > ticksCompleted);
                    for (const r of due) applyThrust(r);
                }
            }
            // ── ⛓ THE FIRE WINDOW'S HIT TICKS ────────────────────────
            // `Player.update` calls `fire()` in the same place it calls
            // `slash()`/`spear()` — above `super.update()` — so the five
            // hit ticks land here, against the position the PREVIOUS tick
            // left and after the blocks' own update (which is what makes
            // `hit()`'s `v.length > 0` guard bite).
            if (!noclip) {
                for (const w of fireWindows) {
                    if (w.hitTicks.has(ticksCompleted)) {
                        applyFire({ pressTick: w.pressTick });
                    }
                }
                // A window whose end tick has passed cannot swallow a press
                // any more; dropping it keeps the list at most one long.
                for (let i = fireWindows.length - 1; i >= 0; i -= 1) {
                    if (ticksCompleted > fireWindows[i].endTick) fireWindows.splice(i, 1);
                }
            }
            if (!noclip) assertBridgeWindows();
            // `set spearing` captures `spearDirection = direction`, and
            // `sprites()` — the only writer of `direction` — runs at the END
            // of the update. So a press consumes the facing this tick
            // STARTED with, which is the value in `state` right now.
            const pressFacing = state.direction;
            const pressed = acting.has(TALK_KEY) && !wasHeld.has(TALK_KEY);
            // ⛔⛔⛔ R5 SLICE 22: A FREEZE FRAME BURNS A PRESS, LOUDLY.
            //
            // The line above already models the loss — `acting` is
            // `NO_KEYS` — but a silent loss is how a leg comes back from
            // the game with two of its three kill presses landed and no
            // reason on the model side. This is the ceremony's own refusal
            // (`a fire press ... lands inside the window`) applied to the
            // other gate on the same `if`, and it is a REFUSAL rather than
            // a warning because the cure is arithmetic the planner owns:
            // the freeze span is derivable from the volley clock.
            if (frozenTimer > 0 && held.has(TALK_KEY) && !wasHeld.has(TALK_KEY) && !noclip) {
                throw new Error(`levelRun: a \`primary\` press at tick ${ticksCompleted} `
                    + `lands on a FROZEN tick (frozenTimer ${frozenTimer} after this `
                    + 'tick\'s `freezeStep`). `Player.input()` returns at its first line '
                    + 'while `frozenTimer > 0`, and `useItem(Main.primary)` is called '
                    + 'from INSIDE `input()` — so the press is LOST, not delayed. An '
                    + '`IceTurretBlast` contact refuses input for '
                    + `${ICE_TURRET_BLAST.freezeTicks - 1} ticks starting with the `
                    + 'contact tick; schedule the press outside that span.');
            }
            const stepOpts = {
                level: world,
                noclip,
                noHazards,
                beforeTypeFlip: firstTickInWorld,
                // ⛔⛔⛔ R5 SLICE 15: THE PLAYER'S OWN SWEEP, THROUGH THE ONE
                // BUILDER. Slice 14 found FOUR call sites that had been
                // handed an option and silently dropped it — and the worst
                // of them was this one, `stepV2`, the single mover whose
                // collisions decide where a route actually goes (§28.2).
                // Every family now arrives here by construction rather than
                // by a hand-written key, so a tenth cannot be forgotten in
                // exactly this spot for a third time.
                //
                // R4: under `noclip` there is no geometry to be part of, so
                // they are inert by the same argument `openActivators` is.
                //
                // ⛔ R8 SLICE 0: AND THE `noclip` HALF WAS A HAND ROSTER THAT
                // HAD ALREADY ROTTED. It listed TWELVE families where
                // `LIVE_GEOMETRY_KEYS` names fourteen — `shieldBosses` and
                // `finalDoors` were never added — directly under a comment
                // saying a family could not be forgotten in exactly this
                // spot for a third time. It cost nothing (under `noclip`
                // `playerPhysicsV2` skips the geometry entirely, and the two
                // arrived as its own destructure defaults, which are `null`
                // either way) and it is the fourth occurrence of the defect
                // `LIVE_GEOMETRY_KEYS` exists to end. Both arms are now
                // BRANDED, which means both are derived from the one literal
                // that writes the fourteen names out.
                // ⚠ `beforeTypeFlip` IS CARRIED THROUGH THE NORMALISE, and it
                // has to be: a normalised bag always has the key, this spread
                // sits BELOW the `beforeTypeFlip: firstTickInWorld` line
                // above, and a normalise that did not carry it would
                // overwrite the tick's own answer with the default `false` on
                // every first tick in a world. Found while writing this hoist,
                // by reading the key order rather than by a test.
                ...normalizeLiveOpts(noclip ? { beforeTypeFlip: firstTickInWorld }
                    : liveSolidOpts({
                        beforeTypeFlip: firstTickInWorld,
                        openActivators: openActivatorIds(activators),
                    })),
                // R4: `checkDrowning` reads `canSwim` and `hasDarkSuit`,
                // and the waterfall push reads `hasFeather`. The run's
                // mirror is the only place those live on this side.
                inventory,
                pins,
                // ⛓⛓⛓ R5 SLICE 22. `acting` above already drops the
                // direction keys; this drops the WATERFALL PUSH too, which
                // is the last statement of `input()` and below the same
                // return. Both, because the two halves of one `if` are not
                // a place to be economical.
                inputBlocked: frozenTimer > 0,
                // ⛓⛓⛓ R6 SLICE 3: `Player.input()`'s OTHER gate, and it is
                // NARROWER — `if (hitsTimer <= 0)` wraps the four arrow
                // branches and closes ABOVE the waterfall push and both
                // `useItem` presses. So a player in knockback still swings and
                // is still pushed; what they cannot do is steer. Reusing
                // `inputBlocked` for this would silently disarm every press in
                // a fight, which is the one place presses are the point.
                steerBlocked: !canSteer(damage),
            };
            // ── ⛓⛓⛓ R5 SLICE 23: THE FREEZE-CLEARING FRAME'S OWN STEP ──
            //
            // ⛔⛔ A COLLAPSED FROZEN SPAN ENDS ON A FRAME THAT IS DEAD TO
            // THE TAPE AND LIVE TO THE PLAYER, and the model owes that step.
            //
            // `Bot.update` reads `Game.freezeObjects` at the TOP of the
            // frame, ABOVE `super.update()`. So the frame on which an entity
            // CLEARS the flag records no observation and does not advance
            // the tape — and then that entity (a run-time `add`, so PREPENDED
            // by `World.addUpdate`, so updating before the Player) clears it,
            // and the player's own `mobileUpdate` reads the cleared flag and
            // MOVES. One physics step, folded invisibly into the next
            // observation.
            //
            // ⛓ MEASURED, NOT ARGUED. `r5-l43-wand` replayed against the
            // game diverged at its collect tick by exactly this: the game's
            // first post-ceremony delta was +1.65 where the model's was
            // +0.95, and +1.65 is the model's +0.95 and +0.70 summed. The
            // arms then re-converged the moment both reached rest, because a
            // rest position is a fixed point — which is also why this was
            // invisible for twenty-two slices: every earlier walk that
            // resolves a frozen span is AT REST when it lifts, and an extra
            // step on a zero velocity moves nothing.
            //   (`r5Totem.L43_WAND_WINDOW.refutation`)
            //
            // ⚠ A TRANSITION HERE IS OUT OF SCOPE AND IS REFUSED. The step
            // is unobserved by construction, so a world swap on it would be
            // a level change the stream cannot show and the transition list
            // would disagree with the tape.
            for (let extra = 0; extra < pendingFreeSteps; extra += 1) {
                const unobserved = stepV2(state, acting, stepOpts);
                if (unobserved.transition) {
                    throw new Error('levelRun: the freeze-clearing frame at tick '
                        + `${ticksCompleted} produced a TRANSITION. That frame is dead `
                        + 'to the tape by construction, so the crossing would be '
                        + 'invisible in the stream and the transition list would '
                        + 'disagree with it. Move the span away from the door.');
                }
                state = unobserved;
            }
            pendingFreeSteps = 0;
            // ── ⛓⛓⛓ R6 SLICE 3: `if (!dying) super.update()` ─────────
            //
            // ⛔⛔ A DEATH TICK HAS NO PHYSICS AT ALL. `die()` sets `dying`
            // during the ENEMIES' update, and `Player.update` tests it before
            // calling `super.update()` — so there is no friction, no input and
            // no sweep on the tick the last heart goes. The player stands
            // exactly where the hit found them while the world swap waits for
            // end of tick.
            //
            // ⚠ THE OPPOSITE OF A TELEPORT, whose old player DOES take a last
            // (never observed) step. Two deferred `FP.world =` writes, two
            // different final ticks, and the difference is one `if`.
            let next = pendingDeath ? state : stepV2(state, acting, stepOpts);
            // ── ⛓⛓⛓ R6 SLICE 6d: `Game.as:957-959`, BELOW THE WORLD ───
            //
            // ```as3
            //   p.v.y = -1;
            //   if (p.y <= 64) { p.v.y = 0; }
            // ```
            //
            // ⛔ THE BLOCK IS BELOW `super.update()`, so the velocity it
            // writes is consumed by the NEXT frame's `mobileUpdate` — the
            // player is one frame behind the script for the whole walk, and
            // writing it before the step would make the walk one tick short.
            // ⛔ AND `Mobile.friction` (0.25) RUNS BEFORE `moveY`, so a
            // `v.y` of -1 is a step of **0.75** — the same
            // friction-before-move shape as §12.2's descent, and the reason
            // the clamp's 64 is never landed on: from y 104 the lattice goes
            // 64.25 -> 63.5 and stops there, 23.5 px from the Oracle.
            // ⛓ `p.directionFace = 1` is set on the same lines and is not
            // written here: the player is moving UP, so `sprites()` derives
            // direction 1 anyway, and on the clamped frames it keeps the
            // value it already has. One write, two routes, same answer.
            if (cutsceneWalk && !pendingDeath) {
                next = {
                    ...next,
                    vy: next.y <= CUTSCENE_1_WALK.clampY ? 0 : CUTSCENE_1_WALK.vy,
                };
            }
            // ── R4: `input()`'s own last act, at the END of the tick ──
            // `useItem(Main.primary)` fires on `Input.pressed(keys[4])` from
            // inside `Player.input()`, which is where the sweeps happen too
            // — so the press is part of THIS tick, and the rect it schedules
            // fires on the next one. Recorded after the step because the
            // ordering within `input()` is invisible: nothing this schedules
            // is read again before the next tick.
            if (pressed && !noclip) {
                const weapon = weaponForPress();
                // A slot holding nothing is a SILENT no-op in the game
                // (`getItem` returns `undefined` and the switch matches
                // nothing), so it is a silent no-op here — the loud version
                // of that failure lives at the equip, which is where the
                // run knows what it holds.
                if (weapon === 'fire') {
                    // ⚠ `useItem`'s `if (!firing)` SWALLOWS a press inside
                    // an open window, and it runs in `super.update()` —
                    // BEFORE `sprites()` fires `fireEnd` — so a press on the
                    // window's own end tick does nothing at all. A tape that
                    // does that is a tape whose author miscounted the
                    // cadence by one, which is the whole reason
                    // `FIRE_PRESS_CADENCE` is derived rather than written
                    // down. Refused by name.
                    const open = fireWindows.find((w) => ticksCompleted <= w.endTick);
                    if (open) {
                        throw new Error(`levelRun: a fire press at tick ${ticksCompleted} `
                            + `lands inside the window the press at tick ${open.pressTick} `
                            + `opened (\`firing\` is up through tick ${open.endTick}). `
                            + '`useItem`\'s `if (!firing)` swallows it silently in the '
                            + `game. The cadence is ${FIRE_PRESS_CADENCE}.`);
                    }
                    fireWindows.push({
                        pressTick: ticksCompleted,
                        hitTicks: new Set(FIRE_WINDOW.hitTicks.map((k) => ticksCompleted + k)),
                        endTick: ticksCompleted + FIRE_WINDOW.endTick,
                    });
                } else if (weapon === 'wand') {
                    // ⚠ THE SAME SWALLOW AS THE FIRE ARM, one flag over.
                    // `useItem` case 2 is `if (!wanding) wanding = true`, and
                    // it runs in `super.update()` — ABOVE the `sprites()`
                    // that fires `wandEnd` and drops `_wanding`. So a press
                    // ON the window's own end tick does nothing at all, and
                    // the cadence is derived rather than written down.
                    const open = wandWindows.find((w) => ticksCompleted <= w.endTick);
                    if (open) {
                        throw new Error(`levelRun: a wand press at tick ${ticksCompleted} `
                            + `lands inside the window the press at tick ${open.pressTick} `
                            + `opened (\`_wanding\` is up through tick ${open.endTick}). `
                            + '`useItem`\'s `if (!wanding)` swallows it silently in the '
                            + `game. The cadence is ${WAND_PRESS_CADENCE}.`);
                    }
                    assertWandShotSolidsBound(level);
                    wandWindows.push({
                        pressTick: ticksCompleted,
                        fireTick: ticksCompleted + WAND_WINDOW.fireTick,
                        endTick: ticksCompleted + WAND_WINDOW.endTick,
                    });
                } else if (weapon) {
                    pendingThrust = { weapon, direction: pressFacing, pressTick: ticksCompleted };
                }
            }
            // ── ⛓⛓⛓ R6 SLICE 2: `wandEnd()`, AND IT IS BELOW THE PRESS ──
            //
            // `useItem` is inside `input()`, inside `super.update()`;
            // `sprites()` — which advances `sprWand` and fires `wandEnd` —
            // is the line BELOW it in `Player.update`. So a fire on the same
            // tick as a press happens after it, which is the order here.
            //
            // ⛓ POSITION IS THIS TICK'S, DIRECTION IS THE PREVIOUS TICK'S.
            // `wand()` runs from `sprWand.update()`, which `sprites()` calls
            // BEFORE it recomputes `direction` — so the facing is the value
            // the last `sprites()` wrote, which is exactly `pressFacing`'s
            // convention. The position is `super.update()`'s output, which
            // is `next`. One call, two tick conventions, and the asymmetry
            // is four lines of `sprites()`.
            if (!noclip && wandWindows.length > 0) {
                for (const w of wandWindows) {
                    if (w.fireTick !== ticksCompleted) continue;
                    assertWandSpawnUnclamped(next, w);
                    const p = wandPress(w.pressTick, pressFacing, { x: next.x, y: next.y });
                    const id = `wand@${level}#${w.pressTick}`;
                    const shot = createWandShot(id, p.spawn.x, p.spawn.y, p.v);
                    shot.spawnedAt = ticksCompleted + 1;
                    // `World.addUpdate` PREPENDS — the blast list's `unshift`
                    // for the same reason, one family on.
                    wandShotsFor(level).unshift(shot);
                    wandShotsFired.push({
                        t: ticksCompleted, level, id, direction: p.direction,
                        x: shot.x, y: shot.y, pressTick: w.pressTick,
                    });
                }
                for (let i = wandWindows.length - 1; i >= 0; i -= 1) {
                    if (ticksCompleted > wandWindows[i].endTick) wandWindows.splice(i, 1);
                }
            }
            // ── ⛓⛓⛓ R6 SLICE 3: `hitUpdate()`, BELOW THE MOVE ───────
            //
            // `Player.update` is `… if (!dying) super.update(); sprites();
            // hitUpdate(); …` — so the i-frame decrement happens AFTER this
            // tick's input has already been refused by it. That ordering is
            // the whole of "20 ticks of steering loss": the window is 20 on
            // the hit tick itself and reaches 0 on the twentieth one after.
            //
            // ⛔ AND IT RUNS ON A FROZEN TICK TOO. `Game.freezeObjects`
            // gates only what is inside `mobileUpdate`, and this line is
            // outside it — so a ceremony that SUPPRESSES a hit does not
            // suspend the window an earlier hit opened. The two halves of
            // "frozen" go opposite ways (§10.6, one class further on), and
            // the frozen branch above steps this for exactly that reason.
            {
                const d = stepPlayerDamage(damage);
                damage = d.state;
                // `direction = directionFace; directionFace = -1;` — the
                // facing the knockback parked, handed back on the recovery
                // tick. ⚠ `-1` is a REAL value here ("unset"): a hit with a
                // null point never wrote `directionFace`, and the game
                // assigns the -1 anyway.
                if (d.recovered && d.direction !== null) {
                    next.direction = d.direction;
                }
            }
            ticksCompleted++;
            // ── ⛓⛓⛓ R5 SLICE 22: `Game.view()`, LAST ────────────────
            // `Game.update` is `super.update(); … view();`, so the camera
            // reads the position every entity has just finished writing —
            // and the value it lands on is the one the NEXT tick's
            // `onScreen` tests are gated against. On a transition the swap
            // happens below and rebuilds it, which is `Game`'s own
            // reconstruction.
            // ⛓⛓⛓ R6 SLICE 6f: AND `view()`'s TWO DRAWS ARE PART OF IT.
            // `Game.as:1879-1880` jiggles the camera from `Game.shake` before
            // the decay on the line below, so the draws are spent against a
            // shake every rock that landed this tick has already added to.
            // Above `stepCameraNow` because that call is what performs the
            // decay, and the two draws come first.
            owlJiggleNow();
            if (!next.transition) stepCameraNow(next, world.world);
            // ...and THEN Button.update and Lock.update run, against where
            // the player ended up.
            if (!noclip) {
                applyLockEvents(stepActivators(activators, world,
                    playerBoxAt(next.x, next.y),
                    { inventory, keys, movingSolids: movingSolidsNow() }));
            }
            const hits = { hitX: next.hitX, hitY: next.hitY };
            // ── ⛓⛓⛓ R6 SLICE 4: `updateLists()` — THE DEFERRED HALVES ──
            //
            // `Engine.update` is `World.update(); World.updateLists();`, so
            // everything an entity ASKED for this tick lands here: an
            // `Explosion`'s `added()` (which is where its whole damage pass
            // lives) and a `removed()` that a `render()` requested on the
            // PREVIOUS frame.
            //
            // ⛓ Both are therefore tested against the player's END-of-tick
            // position, which is `next` and not `state`. That is §8.10's
            // "one tick of offset", and it is the difference between a
            // stance that is outside the disc when the shot lands and one
            // that is outside it when the disc is drawn.
            if (!next.transition) {
                // ⚠ `state` IS ADVANCED FIRST, and it has to be: the blast
                // reads the player's post-move origin AND `applyPlayerHit`
                // writes the knockback back into `state`. A drain against a
                // temporary copy would compute the right disc and throw the
                // impulse away.
                state = next;
                if (pendingBlasts.length > 0) {
                    for (const b of pendingBlasts.splice(0, pendingBlasts.length)) {
                        applyExplosion(b);
                    }
                    next = state;
                }
                drainBossRemovals();
                // ⛓ R6 slice 5: and the Shieldspire's, in the same
                // `updateLists()` — see `drainShieldBossRemovals`.
                drainShieldBossRemovals();
            }
            // ── ⛓⛓ …AND THEN `render()`. `Engine.onEnterFrame` is
            // `update(); render();`, so this is the LAST thing in the frame
            // — and it writes the `headPos` the NEXT tick's `laserStep`
            // reads, which is the whole mechanism behind the beam's
            // one-frame lag.
            if (!noclip) renderBossesNow();

            // ── ⛓⛓⛓ R6 SLICE 3: THE DEATH REBOOT, AT END OF TICK ────
            //
            // ⛔⛔⛔ A DEATH IS A GAME-INITIATED WORLD SWAP THE DRIVER DID
            // NOT ORDER (§8.8), and it is reachable from EVERY fight window
            // rather than only the ending ones. `restartLevel()` rebuilds
            // the SAME level from the current `Game`'s own constructor args,
            // so the level field never changes — there is NO transition
            // record, and the stream's only witness is the position jump.
            //
            // ⚠ IT TAKES PRECEDENCE OVER A TRANSITION BY CONSTRUCTION: a
            // death tick runs no physics, so `next.transition` is null.
            if (pendingDeath) {
                playerDeaths.push({
                    ...pendingDeath,
                    respawn: spawnFromBoot(worldCtor),
                });
                const grant = enterWorld({
                    toLevel: level,
                    fromLevel: level,
                    // The mixer is a `Music` static and does not care that
                    // the world it was playing in has been torn down — the
                    // same argument as a door, and the load costs it the
                    // same dead frames.
                    carriedSwim: state.swim ?? null,
                    arrivalFor: (w) => arriveAtRespawn(w, worldCtor),
                    // ⚠ UNCHANGED. `restartLevel()` passes the current
                    // `playerPosition` straight back into the new `Game`, so
                    // a second death respawns in exactly the same place —
                    // which is what makes a death loop a loop.
                    ctor: worldCtor,
                });
                pendingDeath = null;
                firstTickInWorld = true;
                return { transition: null, grant, ...hits, death: true };
            }

            // ── ⛓⛓⛓ R6 SLICE 6d: THE ENDING'S OWN REBOOT ────────────
            //
            // The THIRD game-initiated world swap on the ladder, and the
            // first that CHOOSES ITS DESTINATION. A teleporter goes where
            // its attributes say; a death goes back to the same `Game`'s
            // own constructor args; `Seed.update`'s bloody arm is a literal
            // `FP.world = new Game(1, 64, 96, false)` written inside a
            // pickup — a different level, a fresh position, and a
            // `Game.cutscene[1]` set on the line above it.
            //
            // ── ⛓⛓⛓ R6 SLICE 6d: THE ENDING'S OWN REBOOT, AT END OF TICK ──
            //
            // One implementation, TWO callers — the ordinary tail here and
            // the tree cutscene's own frozen-tick path above, which returns
            // before this line is reached. Copying it would have been two
            // models of one `FP.world = new Game(...)`, and the two would
            // have agreed exactly until one of them was edited.
            // [[feedback_two_cost_models_must_agree]]
            if (pendingSeedReboot) return finishEndingReboot(next, hits);

            if (!next.transition) {
                state = next;
                firstTickInWorld = false;
                return { transition: null, grant: null, ...hits };
            }

            // ⚠ A WORLD SWAP WOULD ORPHAN AN OPEN WINDOW. `Game` is
            // reconstructed on a transition and the destination's activator
            // state is fresh, so the lock that is refusing input ceases to
            // exist and its `turnOff` never runs — leaving `receiveInput`
            // false with nothing left to restore it. Named here rather than
            // discovered 2,000 ticks later in another level.
            if (lockSnap) {
                throw new Error('levelRun: the run crossed from level '
                    + `${next.transition.from_level} to ${next.transition.to_level} `
                    + `while ${lockSnap.id}'s input-refused window was still open. The `
                    + 'destination gets a fresh Game, so nothing is left to call '
                    + "`turnOff` and restore input. A touch-lock's window has to end "
                    + 'in the level it started in.');
            }
            // End-of-tick: `Engine.checkWorld` swaps only after the whole
            // tick has run, so `next` is the old player's last (never
            // observed) position and the state that survives is the arrival.
            // `ticksCompleted` is now "the number of completed movement
            // ticks", which is exactly the index of the first observation
            // showing the new level — the §1 ruling 2 definition of `t`.
            const record = {
                t: ticksCompleted,
                from_level: next.transition.from_level,
                to_level: next.transition.to_level,
            };
            transitions.push(record);
            if (next.transition.kind === 'fall') transports.push({ ...record });
            // ⛓⛓⛓ R6 SLICE 3: THE SWAP'S TAIL IS `enterWorld`, ONE COPY.
            //
            // A death reboot (`Player.die()` -> `restartLevel()`) is the SAME
            // five coupled facts as a teleport — a whole new `Game`, a fresh
            // `Player`, the per-visit state back to its `.oel` values, the
            // pre-armed latch and the destination's own `beforeTypeFlip` tick —
            // and this module's own docblock says what two copies of that
            // would do: agree exactly until one of them was edited. So the
            // tail moved into a function the moment the second caller arrived,
            // which is the rule that put this file here in the first place.
            const grant = enterWorld({
                toLevel: next.transition.to_level,
                fromLevel: next.transition.from_level,
                // ⚠ FROM `next`, NOT FROM `state`. `next` is the stepped tick —
                // the old player's last, never-observed position — and its
                // channel is the one that took THIS frame's `pinStep`. Reading
                // `state` would drop that step and leave the model exactly one
                // frame behind the game, which is what the first recording
                // measured before this line said `next`.
                carriedSwim: next.swim ?? state.swim ?? null,
                // ONE swap, TWO arrival kinds. A fall lands the player at the
                // ctor args `checkFallingInPit` computed, `fallFromCeiling`, 83
                // px above where it will end up; a teleporter lands them at its
                // own oel attrs, on the ground.
                arrivalFor: (w) => (next.transition.kind === 'fall'
                    ? arriveFromFall(w, next.transition.ctor)
                    : arriveIn(w, next.transition.teleporter)),
                // ⛓ THE NEW `Game`'s CONSTRUCTOR ARGS — what a later
                // `restartLevel()` would reboot into. A fall passes them
                // straight through (`new Game(fallthroughLevel, x, y)`); a
                // teleporter passes its own `playerx`/`playery` attrs, which
                // are `arrival` minus the Player ctor's half tile.
                ctor: next.transition.kind === 'fall'
                    ? { x: next.transition.ctor.x, y: next.transition.ctor.y }
                    : {
                        x: next.transition.teleporter.playerx,
                        y: next.transition.teleporter.playery,
                    },
            });
            return { transition: record, grant, ...hits };
        },
    };
}
