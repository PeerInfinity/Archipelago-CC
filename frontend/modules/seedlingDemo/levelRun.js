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

import { addedTimeKey, buildLevelWorld, rectsOverlap } from './levelWorld.js';
import {
    INITIAL_FRAMES_THIS_CHARACTER, PICKUP_CEREMONY, TALK_KEY,
    beginDialogue, stepDialogue,
} from './dialogue.js';
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
    FIRE_ARM_POLICY, LIGHTPOLE_HITS_TIMER_MAX, PRESS_ARM_POLICY, auditFire, auditPress,
    slashRect, spearRect,
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
import { ledgerKey, outOfBandFlagForWriter } from './outOfBandLedger.js';
import { createChestState, stepChests } from './chest.js';
import {
    CEREMONY_DEAD_FRAMES, createSealPiece, sealPieceBox, stepSealPiece,
} from './sealCeremony.js';
import { PULSER, createPulser, pulseReaches, pulsePushes, stepPulser } from './pulser.js';
import { ITEM_PROPERTIES, ITEM_NAMES, inventorySlotsFor } from './tapeFormat.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import {
    CEREMONY_FREEZE_FRAMES, LOAD_DEAD_FRAMES, stepChannel,
} from './swimSoundClock.js';
import {
    INITIAL_DIRECTION,
    INITIAL_HAZARD_FLAGS,
    INITIAL_TERRAIN_STATE,
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
 * ⚠ `noDamage` IS CARRIED AND NOT CONSUMED, and that is a bounded vacuity
 * rather than an oversight. The JS engine models no enemy, no projectile and
 * no trap, so there is no site at which `Player.hit()` would have been
 * called — `noDamage: false` is equally inert here. It is threaded anyway so
 * the tape schema is symmetric and the field reaches the game, which is
 * where it does something. The witness that would close it is the first
 * fixture whose route is in range of a damage source, i.e. R5.
 */
export function createLevelRun({
    levelSource, boot, noclip = false, noHazards = [], noDamage = false, grants = [],
    persistence = [], equips = [], roles,
    // R5 slice 4: the tape's `pins` list, threaded to the physics. The swim
    // sound term is only modellable under `pins: ["sound"]`, and `stepV2`
    // REFUSES a wet tick without it rather than modelling the term as zero
    // — so this has to reach the step, not merely be recorded on the tape.
    pins = [],
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
     * R2: the tape's persistence clears, indexed BY LEVEL.
     *
     * A clear is `(level, tag)` and a world is built per level, so the run
     * hands each level only its own tags. Passing the whole list would make
     * `buildLevelWorld`'s orphan guard fire for every level that does not
     * happen to own one — which is every level but a handful.
     */
    const clearedByLevel = new Map();
    for (const c of persistence) {
        if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
        clearedByLevel.get(c.level).push(c.tag);
    }
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
    const worldFor = (n) => {
        if (!worlds.has(n)) {
            const opts = { ...(roles ? { roles } : {}), inventory };
            if (clearedByLevel.has(n)) opts.cleared = clearedByLevel.get(n);
            worlds.set(n, buildLevelWorld(levelSource(n), opts));
        }
        return worlds.get(n);
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
        const st = pushableStateFor(level);
        if (st.byId.size === 0) return [];
        const out = [];
        for (const [id, r] of pushableRects(st)) {
            if (!r.removed) out.push({ id, rect: r.rect });
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
     */
    const keys = new Set();
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
    let primary = 0;
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
        throw new Error(`levelRun: the tape presses X with slot ${primary} holding item `
            + `${item}, which routes through \`useItem\`'s WAND arm. A WandShot is an `
            + 'entity with its own physics and is not modelled (R6), so a press that '
            + 'would spawn one is refused rather than silently dropped.');
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
                const hit = world.collidesSolid(rect, {
                    beforeTypeFlip: firstTickInWorld,
                    openActivators,
                    openBridges,
                    pushables: withoutSelf,
                    brokenRocks: brokenRockIdsNow(),
                    burnedTrees: burnedTreeIdsNow(),
                    pulledRopes: pulledRopeIdsNow(),
                    fallenRocks: fallenRocksNow(),
                    openChests: openChestIdsNow(),
                });
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
        return {
            collides: (rect) => world.collidesSolid(rect, {
                beforeTypeFlip: firstTickInWorld,
                openActivators,
                openBridges,
                pushables,
                brokenRocks: brokenRockIdsNow(),
                burnedTrees: burnedTreeIdsNow(),
                pulledRopes: pulledRopeIdsNow(),
                fallenRocks: fallenRocksNow(),
                openChests: openChestIdsNow(),
            }),
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
                return !!world.collidesSolid(box, {
                    beforeTypeFlip: firstTickInWorld,
                    openActivators: openActivatorIds(activators),
                    openBridges: openBridgeIdsNow(),
                    pushables: pushableRectsNow(),
                    brokenRocks: brokenRockIdsNow(),
                    burnedTrees: burnedTreeIdsNow(),
                    pulledRopes: pulledRopeIdsNow(),
                    fallenRocks: fallenRocksNow(),
                    openChests,
                });
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
                    // — no knockback, no sound, no shake. So under the
                    // ladder's own flag the ring is inert, and without it the
                    // player is knocked back by a force this rung has not
                    // modelled. Refused by name rather than ignored.
                    if (!noDamage) {
                        throw new Error(`levelRun: ${id}'s pulse reached the player at `
                            + `tick ${ticksCompleted} with \`noDamage\` OFF. `
                            + '`Player.hit(null, 6, …, 1)` knocks back, and this rung '
                            + 'does not model the player\'s knockback. Route outside the '
                            + '22 px ring, or declare the encounter.');
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
        const r = stepSealPiece(sealPiece, {
            player: { x: state.x, y: state.y },
            playerBox: playerBoxAt(state.x, state.y),
            blockedAt: (x, y) => {
                const b = sealPieceBox({ x, y });
                return !!world.collidesSolid(b, {
                    beforeTypeFlip: firstTickInWorld,
                    openActivators: openActivatorIds(activatorStateFor(level)),
                    openBridges: openBridgeIdsNow(),
                    pushables: pushableRectsNow(),
                    brokenRocks: brokenRockIdsNow(),
                    burnedTrees: burnedTreeIdsNow(),
                    pulledRopes: pulledRopeIdsNow(),
                    fallenRocks: fallenRocksNow(),
                    openChests: openChestIdsNow(),
                });
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
     * ⚠ SIXTEEN PARTS, AND R5 BANKS ONE. `SealController.hasAllSealParts()`
     * reads `Main.hasSealPart(15)`, which is save state no bot tape carries
     * and which a fresh `Main` leaves at -1. Written down as a constant so
     * the rung that changes it has something to change.
     */
    const HAS_ALL_SEAL_PARTS = false;
    /** One record per chest this run opened. */
    const chestOpens = [];
    /** One per tick a pulse's `hit()` ran, per pulser. */
    const pulserHits = [];
    /** One per tick a pulse reached the PLAYER — inert under `noDamage`. */
    const pulserPlayerHits = [];
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
    /** `${level}:${x},${y}` of every pickup this run has already taken. */
    const collectedPickups = new Set();
    const pickupKey = (n, p) => `${n}:${p.x},${p.y}`;
    /** One record per completed ceremony, for the acceptance ledger. */
    const collected = [];
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
            if (rectsOverlap(box, p.rect)) return p;
        }
        return null;
    }

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

            // ── the ceremony, before anything else ─────────────────────
            // A pickup updates BEFORE the player, so a contact found here
            // is a contact the game found on this frame too. Starting one
            // and stepping one are the same branch: phase A is invisible,
            // so the advance that discovers the contact IS phase B's first
            // frame.
            if (ceremony === null) {
                const hit = pickupUnderfoot();
                if (hit) {
                    const entry = ceremonyFor(hit);
                    ceremony = {
                        pickup: hit,
                        level,
                        item: entry.item,
                        // R4: `null` for everything but a BossKey — see the
                        // `keys` set and `dialogue.PICKUP_CEREMONY.bosskey`.
                        keyType: hit.keyType === undefined ? null : hit.keyType,
                        // ⚠ `text: ''` is a REAL case (a totem part, a
                        // non-zero boss key): `pick_up()` spawns no NPC, so
                        // phase A runs and the pickup removes itself with no
                        // dialogue at all. Charging it a dialogue would cost
                        // the tape ticks the game never spends.
                        dialogue: entry.text === ''
                            ? null
                            : beginDialogue(entry.text, { framesThisCharacter }),
                    };
                }
            }
            if (ceremony !== null) {
                const released = releasedThisTick(held, TALK_KEY);
                prevHeld = new Set(held);
                if (ceremony.dialogue) stepDialogue(ceremony.dialogue, released);
                const finishing = ceremony.dialogue === null || ceremony.dialogue.done;
                if (finishing) {
                    // `removeSelf()` -> `removed()`: the property write and
                    // `Game.setPersistence`. The item lands HERE and not on
                    // contact, which is the whole difference between a real
                    // collection and R0's grant.
                    collectedPickups.add(pickupKey(ceremony.level, ceremony.pickup));
                    // `item: null` is a pickup the fourteen-property mirror
                    // does not track (a boss key, a totem part) — the
                    // ceremony is real, there is just nothing to apply.
                    if (ceremony.item) applyItem(inventory, ceremony.item);
                    // ...unless it is a BossKey, whose `removed()` writes
                    // `Player.hasKeySet(keyType, true)` INSTEAD of an item
                    // property and instead of persistence. R4's whole key
                    // chain hangs off this one line.
                    if (ceremony.keyType !== null) keys.add(ceremony.keyType);
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
                    // ⚠ A FROZEN TICK IS NOT A RENDERED FRAME AS FAR AS THIS
                    // MODEL IS CONCERNED, and a bridge does not know that.
                    // `Tile.render` keeps running, so the game would open one
                    // EARLIER than the tick count says. Named here rather
                    // than discovered as a crossing that happened too soon.
                    assertBridgeWindows({ frozen: true });
                    // `genericHit` returns immediately under
                    // `Game.freezeObjects`, so a thrust scheduled by the
                    // press before a ceremony would silently do NOTHING.
                    // ⚠ AND A FROZEN FRAME BURNS A FIRE WINDOW rather than
                    // stretching it: `sprites()` is called unconditionally,
                    // so the animation advances while `genericHit` returns
                    // at its first line. The hits are LOST, silently.
                    // (`fireVerb.FIRE_DEAD_FRAME_RULE`.)
                    if (fireWindows.some((w) => w.hitTicks.has(ticksCompleted))) {
                        throw new Error('levelRun: a fire window\'s hit tick '
                            + `${ticksCompleted} falls on a FROZEN tick. \`sprites()\` `
                            + 'still advances `sprFire` and `genericHit` returns '
                            + 'immediately under `Game.freezeObjects`, so the window '
                            + 'BURNS — the press lands nothing. Press outside the '
                            + 'ceremony.');
                    }
                    if (pendingThrust) {
                        throw new Error(`levelRun: a ${pendingThrust.weapon} press at tick `
                            + `${pendingThrust.pressTick} would fire its rect on a FROZEN `
                            + 'tick, and `genericHit` returns immediately under '
                            + '`Game.freezeObjects` — so the press would do nothing at '
                            + 'all. Press outside the ceremony.');
                    }
                    ticksCompleted++;
                    // The game keeps updating every non-Mobile entity
                    // through a freeze, so a Button under the frozen player
                    // stays pressed and a Lock's fade keeps running.
                    // Unobservable on R3's route — no ceremony is near a
                    // presser — but transcribed rather than assumed,
                    // because "no route does that yet" is how the statue got
                    // its offset wrong for two slices.
                    if (!noclip) {
                        applyLockEvents(stepActivators(activators, world,
                            playerBoxAt(state.x, state.y),
                            { inventory, keys, movingSolids: movingSolidsNow() }));
                    }
                    // No step: the position is unchanged and — critically —
                    // so is the VELOCITY, which is why the player drifts on
                    // for a few ticks once the freeze lifts.
                    return {
                        transition: null, grant: null, hitX: null, hitY: null,
                        frozen: true,
                    };
                }
            } else {
                prevHeld = new Set(held);
            }
            // ⚠ A touch-lock window drops the KEYS, not the tick.
            // `receiveInput` gates `Player.input()` alone, so friction, both
            // sweeps and `getState` all still run — which is why the player
            // keeps drifting on the velocity the snap did not clear. The
            // tape's own `held` is still what the DIALOGUE reads above,
            // because `NPC.talk()` reads `Input.released` from outside
            // `Player.input()` and a refused player can still talk.
            const acting = lockSnap ? NO_KEYS : held;
            // ── R4: the thrust the last tick's press scheduled ────────
            // After the blocks' own update (the block's `hit` refuses while
            // `v.length > 0`, and `v` is what its own `input()` just set)
            // and before the player moves (`spear()` runs at the top of
            // `Player.update`, above `super.update()`).
            if (pendingThrust) {
                applyThrust(pendingThrust);
                pendingThrust = null;
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
            const next = stepV2(state, acting, {
                level: world,
                noclip,
                noHazards,
                beforeTypeFlip: firstTickInWorld,
                openActivators: noclip ? null : openActivatorIds(activators),
                // R4: the two per-visit families, live. Under `noclip` there
                // is no geometry to be part of, so they are inert by the
                // same argument `openActivators` is.
                openBridges: noclip ? null : openBridgeIdsNow(),
                pushables: noclip ? null : pushableRectsNow(),
                brokenRocks: noclip ? null : brokenRockIdsNow(),
                burnedTrees: noclip ? null : burnedTreeIdsNow(),
                pulledRopes: noclip ? null : pulledRopeIdsNow(),
                fallenRocks: noclip ? null : fallenRocksNow(),
                // ⛔⛔ R5 slice 9: the join cell L38's chain opens. Without
                // this the player walks into a chest the run has already
                // desolidified.
                openChests: noclip ? null : openChestIdsNow(),
                // R4: `checkDrowning` reads `canSwim` and `hasDarkSuit`,
                // and the waterfall push reads `hasFeather`. The run's
                // mirror is the only place those live on this side.
                inventory,
                pins,
            });
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
                } else if (weapon) {
                    pendingThrust = { weapon, direction: pressFacing, pressTick: ticksCompleted };
                }
            }
            ticksCompleted++;
            // ...and THEN Button.update and Lock.update run, against where
            // the player ended up.
            if (!noclip) {
                applyLockEvents(stepActivators(activators, world,
                    playerBoxAt(next.x, next.y),
                    { inventory, keys, movingSolids: movingSolidsNow() }));
            }
            const hits = { hitX: next.hitX, hitY: next.hitY };

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
            level = next.transition.to_level;
            // A `Game` is constructed here, so this is where `Lock.check()`
            // runs and where a flag the player turned off finally removes
            // its lock.
            applyEarnedClears(level);
            // ...and so is where every `added()` runs again, which is the
            // other way a memoised world can be the wrong one (R5 slice 4).
            dropWorldIfBuiltStale(level);
            world = worldFor(level);
            // A new `Game` means new entities: every lock is solid again.
            if (!noclip) freshActivatorState(level);
            // ⚠ ...and so is every bridge, and every block is back in the
            // corridor. `Tile.bridgeOpeningTimer` and
            // `PushableBlockFire.tile` are instance variables with NO
            // persistence — unlike the clear a shield lock earns, which
            // `applyEarnedClears` above has just cashed. Two families, two
            // lifetimes, three lines apart on purpose.
            if (!noclip) freshVisitState(level);
            // A thrust cannot outlive its level either: `spear()` collides
            // the rect against `FP.world`, and by the time it fires the
            // world is the destination's.
            pendingThrust = null;
            // ONE swap, TWO arrival kinds. A fall lands the player at the
            // ctor args `checkFallingInPit` computed, `fallFromCeiling`, 83
            // px above where it will end up; a teleporter lands them at its
            // own oel attrs, on the ground. Everything else about the swap —
            // when it happens, the fresh velocity and terrain, the pre-armed
            // latch, the destination world's own `beforeTypeFlip` tick — is
            // shared, which is the point of the transition record carrying a
            // `kind` rather than the caller sniffing which fields are set.
            // ⛔⛔ THE SWIM CHANNEL IS A MIXER, NOT A `Player` FIELD, AND IT
            // SURVIVES THE DOOR — plus the twenty frames the door costs.
            //
            // `arriveIn`/`arriveFromFall` build a WHOLE NEW Player, which is
            // right for `terrain`, `direction` and `drownTimer` (all
            // instance initialisers) and WRONG for this: `Music`'s pinned
            // channels are statics, and `Bot.update` steps them above the
            // armed check and above the dead-frame gate on purpose — "a
            // mixer does not stop because the room is fading". So the
            // channel crosses the door AND advances by the load's
            // `blackCover` frames, which the tape does not count.
            //
            // Found by the feather walk's first recording: it swims in L87,
            // crosses three doors, swims again in L89, and the model was
            // 0.25 px ahead eight ticks later — `SWIM_BOOST_SPEED` exactly.
            // ⚠ FROM `next`, NOT FROM `state`. `next` is the stepped tick —
            // the old player's last, never-observed position — and its
            // channel is the one that took THIS frame's `pinStep`. Reading
            // `state` would drop that step and leave the model exactly one
            // frame behind the game, which is what the first recording
            // measured before this line said `next`.
            const carriedSwim = next.swim ?? state.swim ?? null;
            state = next.transition.kind === 'fall'
                ? arriveFromFall(world, next.transition.ctor)
                : arriveIn(world, next.transition.teleporter);
            if (carriedSwim) {
                state = {
                    ...state,
                    swim: stepChannel({ ...carriedSwim }, LOAD_DEAD_FRAMES),
                };
            }
            firstTickInWorld = true;
            // `ticksCompleted` is already the arrival observation's index, so
            // the grant's `t` is that observation — the same tick the
            // transition record carries, and the same tick `Bot.as` applies
            // it on. Applied AFTER the swap, so a grant naming the level
            // being LEFT does not fire on the way out.
            const grant = applyGrantsFor(level);
            return { transition: record, grant, ...hits };
        },
    };
}
