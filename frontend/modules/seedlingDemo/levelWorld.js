/**
 * seedlingDemo/levelWorld — the level as `Game.loadlevel` BUILDS it.
 *
 * v2 slice 1 of the real-game bot ladder. Brief:
 * `CC/docs/plans/seedling-bot-v2-opus-kickoff.md` §3.1. The physics
 * (`playerPhysicsV2`, slice 2) asks this module three questions per tick —
 * "does the player's box overlap something solid", "which walkable tile is
 * nearest", "is the player standing in a teleporter" — and this module
 * answers them the way the game's own entity list would.
 *
 * ── Solid geometry is ENTITIES, not a grid ────────────────────────────
 * FlashPunk's `Grid`/`Tilemap` masks have ZERO call sites in Seedling.
 * `loadlevel` creates ONE `Tile` entity per 16x16 cell through a 45-arm
 * switch on the tileset column (`Game.as:1902-2007`), plus one entity per
 * `<objects>` tag and one `CliffSide` per `<cliffsides>` placement. The
 * parallel `tiles` vector (`Game.as:1893-1901`) is an INDEX ONLY —
 * collision never reads it. So this module builds lists of entities with
 * rects, not a grid, and every query below is a list scan exactly like
 * `Entity.collideTypes`.
 *
 * ── Where the data comes from, and where reuse STOPS ──────────────────
 * The level records are the committed Phase-2 extract
 * (`flashPanel/atlases/seedling-map.json`, all 116 levels, tile placements
 * and entities verbatim), and the tile semantics are the verbatim AS3
 * tables in `flashPanel/seedlingSemantics.js` (`TILE_COLUMN_TO_TYPE` is
 * the 45-arm switch as data; `TILE_TYPE_ENTITY_TYPES` IS `Tile.types`).
 * Reuse stops there, deliberately: the analyzer's abstraction layer
 * (`CELL_KINDS` / `buildSeedlingRegionGrid`) is the REGION VERIFIER's
 * altitude and carries its assumptions — 4-connectivity, tile-granular
 * cliffsides, pits-as-sinks. Coupling the physics to those would make the
 * two disagree with the real game together, which is the one failure mode
 * a differential cannot catch. A welcome side effect of keeping to the raw
 * tables: the oracle differential now LIVE-TESTS the tables the Phase-5a
 * analyzer trusts.
 *
 * ── Loud by default ───────────────────────────────────────────────────
 * An unknown entity tag, an unknown tileset column, a terrain type v2 does
 * not model, and any overlap with a pixelmask collider all THROW with the
 * offending thing named. v1's lesson was that every divergence came from a
 * description tidier than the code; the seams here exist so a fixture that
 * strays dies loudly instead of quietly producing a plausible stream.
 *
 * This module is dependency-free and browser-usable: it takes a level
 * RECORD (a plain object) rather than reading the atlas itself, exactly as
 * `tapeFormat`/`playerPhysicsV1`/`tapeRunner` take plain tapes.
 */

import {
    SEEDLING_TILE_SIZE,
    TILE_COLUMN_TO_TYPE,
    TILE_TYPE_ENTITY_TYPES,
    TILE_TYPE_NAMES,
    SOLID_ENTITY_TYPES,
} from '../flashPanel/seedlingSemantics.js';
import { coerceTerrainState, HAZARD_STATES } from './tapeFormat.js';
import { SEEDLING_PIXEL_MASKS } from './seedlingPixelMasks.js';
// R5 slice 2: the `combat` role. `combat.js` is deliberately dependency-free
// (its own docblock says so) precisely so this import can exist without a
// cycle, and `seedlingDamageSites.js` is generated data.
import {
    ENEMY_CLASSES,
    PUZZLEMENT_HAZARDS,
    LOOKS_LIKE_COMBAT,
    TOTAL_ENEMIES_CLASSES,
    aggroDisc,
    combatCensus,
    isCounted,
    killLocksIn,
} from './combat.js';
import { HARMFUL_CLASSES } from './seedlingDamageSites.js';
// ⛓ R5 slice 12: `check()`'s build-time kill. `burnableTree.js` imports only
// `breakableRocks.js`, which imports nothing at all, so this is a leaf-ward
// edge and not a cycle — the same care `combat.js`'s import above records.
import { treeBuiltIn } from './burnableTree.js';

/**
 * The player hitbox origin, for recovering the entity position from a box.
 * Transcribed rather than imported: this module stays dependency-free of the
 * physics (`Player.as:295` normalHitbox = (2, 2, 4, 5)).
 */
const HITBOX_ORIGIN_X = 2;
const HITBOX_ORIGIN_Y = 2;

/** `Tile.types` index for a Pit — the transport primitive, R1. */
const PIT_STATE = HAZARD_STATES.pit;

/** `Tile.types` index for a Bridge — Solid until something spears it. */
const BRIDGE_STATE = 29;

/**
 * The two terrain types that KILL rather than merely slowing (R4).
 *
 * Both are modelled from R4, and both stay planner-forbidden floor until
 * the item that survives them lands: `canSwim` (the conch, R5) for water
 * and `hasDarkSuit` for lava. See `lethalTerrainTiles`.
 */
const WATER_STATE = 1;
const LAVA_STATE = 17;
/** R4: `Player.input()`'s waterfall push — see `waterfallTiles`. */
const WATERFALL_STATE = 25;

export class LevelWorldError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LevelWorldError';
    }
}

const fail = (message) => { throw new LevelWorldError(message); };

/** Is THIS entity's tag in the cleared set? (rope's shrink needs it late.) */
const clearedHere2 = (e, entityTag, clearedTags) => Boolean(
    clearedTags && entityTag >= 0 && clearedTags.has(entityTag),
);

export const TILE_SIZE = SEEDLING_TILE_SIZE;

/**
 * What the PLAYER collides with: `Mobile.solids` plus the `"LavaBoss"` the
 * Player constructor pushes.
 *
 * ⚠ That push is UNCONDITIONAL (`Player.as:355-359`) — it is not inside a
 * boss-fight branch, and the queue's worry that it might be is settled.
 * Transcribed verbatim (code shaped like the AS3) even though it is inert
 * outside Dungeon 7, because no `LavaBoss`-typed entity exists elsewhere.
 */
export const PLAYER_SOLID_TYPES = Object.freeze([...SOLID_ENTITY_TYPES, 'LavaBoss']);

const PLAYER_SOLID_SET = new Set(PLAYER_SOLID_TYPES);

/**
 * ⛔⛔⛔ R5 SLICE 12 — SOLIDITY IS PER MOVER, AND THE CENSUS HAD ONE FIELD.
 *
 * FlashPunk collision is not a property of the thing being hit: every
 * `Mobile` carries its OWN `solids` array and `collideTypes(solids, …)`
 * asks about that one. This file's `collider: 'none'` verdict — its own
 * docblock says *"does not block the player"* — was therefore always a
 * claim about ONE list, and it was the right one for four rungs because
 * the Player was the only mover anybody planned against.
 *
 * ⛔ **A PUSHABLE BLOCK HAS A DIFFERENT LIST**, and it is the one mover in
 * the game that collides with enemies:
 *
 * ```
 *   Mobile.as:17              ["Solid","Tree","Rock","Rope","ShieldBoss"]
 *   Player.as:377             …push("LavaBoss")
 *   PushableBlock.as:28       …push("Enemy", "Player")
 *   PushableBlockFire.as:31   …push("Enemy", "Player")
 * ```
 *
 * ⛓⛓ **THAT COST R5 THE WHOLE SHAFT.** `spinner: notSolid('Spinner', …,
 * 'damage only …')` is TRUE of the player and FALSE of a block, and a
 * wandering `Spinner` wedged block 2 mid-glide in L39 — see
 * `r5Shaft.SPINNER_WEDGE` for the four tapes that establish it, including
 * the time-shifted one that is byte-exact. One cell, and every stance
 * after it was wrong.
 *
 * ⇒ solidity is asked as `blocksMover(type, mover)` now. The old
 * `PLAYER_SOLID_TYPES` export stays and stays authoritative for the
 * player, because every existing caller means the player and a silent
 * widening would be the same defect pointing the other way.
 */
export const SOLIDS_BY_MOVER = Object.freeze({
    player: PLAYER_SOLID_TYPES,
    /** `PushableBlock` / `PushableBlockFire` / `PushableBlockSpear`. */
    pushable: Object.freeze([...SOLID_ENTITY_TYPES, 'Enemy', 'Player']),
    /**
     * The base list, verbatim — for the `Enemy` subclasses that add nothing.
     *
     * ⛔⛔⛔ R8 SLICE 1: THIS ROW'S OLD DOCBLOCK WAS A CLAIM ABOUT THE WHOLE
     * FAMILY AND THE SOURCE REFUTES IT. It read *"`Enemy` and its subclasses
     * add nothing"*. Swept over `Enemies/*.as`, SEVEN of them do:
     *
     * ```
     *   Bob.as:39          solids.push("Enemy")
     *   Jellyfish.as:35    solids.push("Enemy")
     *   Drill.as:35        solids.push("Enemy")
     *   LavaRunner.as:43   solids.push("LavaBoss", "Enemy")   (and Bob's, inherited)
     *   Puncher.as:48      solids.push("Enemy", "Player")
     *   IceTurret.as:148   solids.push("Enemy", "Player")     (in its CORPSE arm)
     *   Flyer.as:45        solids = new Array()               ← the other direction
     * ```
     *
     * The row itself is CORRECT for its one consumer — `SPINNER.solids`, and
     * `Spinner.as` really does add nothing — so nothing here changes and the
     * false generalisation does. This is R5 slice 12's own lesson pointed at
     * the table that recorded it: solidity is per MOVER, and "the subclasses
     * add nothing" is per SUBCLASS.
     */
    enemy: Object.freeze([...SOLID_ENTITY_TYPES]),
    /**
     * ⛓⛓⛓ R8 SLICE 1 — THE CHASER, AND THE ONE TYPE THAT SEPARATES IT.
     *
     * `Mobile.solids` plus `"Enemy"` (`Bob.as:39`). It is not decoration and
     * it is not symmetric: a static `SandTrap` is `type = "Enemy"`, so a trap
     * the PLAYER walks straight past is a WALL to a chaser — which is exactly
     * how L6 parks `bob@96,16` at x≈84.2 forever without anybody killing it
     * (R7 slice 6e, trap 152). A chaser stepped against the player's list
     * would walk through that trap and arrive somewhere the game never puts
     * it.
     *
     * ⚠ AND IT LACKS `"LavaBoss"`, which the player's list has. Same shape as
     * the spinner's row, same treatment: `levelRun` asserts the difference
     * away by room rather than over-approximating it.
     */
    chaser: Object.freeze([...SOLID_ENTITY_TYPES, 'Enemy']),
    /**
     * ⛔⛔ R6 SLICE 2: `WandShot.as:69` — `solids.push("Enemy")`, and the
     * FOURTH mover. `Mobile.solids` plus `"Enemy"`, WITHOUT the player's
     * `"LavaBoss"`: a wand shot is stopped by a spinner and flies through a
     * LavaBoss, which is the reverse of the player on both names.
     *
     * ⛓ AND IT RETIRES A CLAIM OF EXCLUSIVITY. The `spinners` roster's
     * docblock below said the Enemy-solids movers were *"a
     * `PushableBlock*`, and nothing else in the game"* — true when it was
     * written, and false the moment the wand became a verb.
     * [[feedback_two_member_list_one_member_read]].
     */
    wandshot: Object.freeze([...SOLID_ENTITY_TYPES, 'Enemy']),
});

/**
 * ⛔ R6 slice 2: `Game.as:2148-2149` — the SAME class with a different
 * `_type` argument, and the `.oel` tag is the only thing that says which.
 * `MagicalLock.hit`'s `lockType <= shotType` reads it, so a table keyed on
 * `as3` alone (which is what `ENTITY_CLASSES` is) cannot answer the
 * question the wand asks.
 */
export const MAGICAL_LOCK_TYPE_BY_TAG = Object.freeze({
    magicallock: 0,
    magicallockfire: 1,
});

const SOLID_SETS_BY_MOVER = Object.freeze(Object.fromEntries(
    Object.entries(SOLIDS_BY_MOVER).map(([k, v]) => [k, new Set(v)]),
));

/**
 * Does an entity of runtime type `type` block `mover`?
 *
 * ⚠ THE TYPE, NOT THE CLASS. `BombPusher` and `LavaBoss` are `Enemy`
 * subclasses whose constructors OVERWRITE `type` (slice 11's ctor audit),
 * so a class-name test would miss the first and mis-answer the second.
 * The census's `type` field is the one the audit corrected.
 *
 * @param {string} type   the entity's runtime `type`
 * @param {'player'|'pushable'|'enemy'} mover
 */
export function blocksMover(type, mover) {
    const set = SOLID_SETS_BY_MOVER[mover];
    if (!set) {
        fail(`blocksMover: unknown mover "${mover}" — the solids list is a property of the `
            + `thing MOVING, so this has to name one of [${Object.keys(SOLIDS_BY_MOVER).join(', ')}]`);
    }
    return set.has(type);
}

/**
 * Terrain types v2 models. Everything else throws from the resolver.
 *
 * The excluded set is not arbitrary squeamishness — it is where the
 * physics stops being a function of position. Water/waterfall couple
 * `moveSpeed` to SOUND state (`Player.as:517-537` adds a stroke burst of
 * `0.25 * int(Music.soundPosition("Swim") < 0.1)`), ice rewrites both
 * speed and friction, a pit sets `receiveInput = false` and takes the
 * player away, and a bridge rewrites its own `type` from a timer inside
 * `render()`. All of that is v3+; a v2 fixture that strays onto one must
 * die loudly rather than quietly diverge.
 */
export const MODELLED_TILE_TYPES = Object.freeze([
    0,  // Ground
    2,  // Stone        (solid — never underfoot, but legal geometry)
    3,  // Brick
    4,  // Dirt
    5,  // Dungeon Tile
    // ⚠ 6 (Pit) is MODELLED FROM R1, and it is the only entry here that is
    // not merely "a floor with a speed". Standing on it starts a TRANSPORT:
    // `playerPhysicsV2` runs the fall-out lerp, the deferred swap to this
    // level's `control` fallthrough, and the fall-from-ceiling descent.
    // `moveSpeeds[6]` is the plain walk speed, so the tick the edge fires
    // is an ordinary tick — which is exactly why the edge has to be modelled
    // rather than inferred from a speed.
    //
    // ⚠ Being modelled here means `plannerBlockerAt` STOPS reporting pit
    // tiles, because they are no longer unmodelled terrain. That is correct
    // for the physics and wrong for the planner, which must keep treating
    // them as forbidden floor (a pit in a level with no `control` block
    // kills). The policy moved to the driver, where the teleporter-volume
    // policy already lives — see `botDriverV2.plannerObstacleAt`.
    6,  // Pit          (R1: a transport primitive, not a floor)
    7,  // Shield Tile
    8,  // Forest
    9,  // Cliff        (solid)
    10, // Cliff Stairs — moveSpeed 0.4, no side effects
    11, // Wood         (solid)
    12, // Walkable Wood
    13, // Cave
    14, // Wood natural (solid)
    15, // Dark Stone   (solid)
    16, // Igneous Stone
    // ⚠ 17 (Lava), 22 (Ice) and 25 (Waterfall) are MODELLED FROM R4, and
    // being in this list is what lets a tape ARM them: `noHazards` decides
    // whether the resolver's answer is coerced, and this list decides
    // whether an uncoerced answer is legal terrain at all. Removing a name
    // from `noHazards` without adding its type here is the trap the R4
    // kickoff names in §2.6 — the tape says "armed" and the resolver still
    // throws.
    //
    // ⛓ 1 (Water) JOINS THEM AT R5 SLICE 4, and the thing that let it in is
    // not the drowning arm — that was transcribed at R4 — but the SOUND
    // TERM. `Player.as:530` adds `0.25 * int(Music.soundPosition("Swim") <
    // 0.1)` to the swim speed, and unpinned that position is the Web Audio
    // mixer's wall clock: slice 2 ran one tape at 0.4 fps and 10.1 fps and
    // the streams parted four ticks after the water edge. So water was not
    // "untranscribed", it was NOT REPRODUCIBLE, and no amount of care in
    // this file would have fixed it.
    //
    // The §13 ruling took the PIN. Under a v5 tape's `pins: ["sound"]` the
    // game reads a frame clock, `swimSoundClock` is the same arithmetic on
    // this side, and `playerPhysicsV2.step` REFUSES a wet tick on a tape
    // that does not pin it — so an armed-water run without the pin is a
    // named failure rather than a stream that matches one recording and not
    // the next.
    //
    // ⚠ Being legal terrain is still not permission to stand on it.
    // `canSwim` is the CONCH, and `checkDrowning`'s water arm gives an
    // unprotected walk ELEVEN CUMULATIVE TICKS before `drowning` latches —
    // the timer is never reset off-hazard. The planner's forbidden-floor
    // policy is unchanged; what changed is that a route which HOLDS the
    // conch can now be modelled at all.
    1,  // Water          (R5 slice 4: WATER_FRICTION + the pinned swim burst)
    17, // Lava           (R4: 0.45 + WATER_FRICTION; lethal without the dark suit)
    18, // Blue Tile
    19, // Blue Wall    (solid)
    20, // Blue Wall dark (solid)
    21, // Snow
    22, // Ice            (R4: slidingSpeed 1 AND slidingFriction 0.025)
    23, // Ice Wall     (solid)
    24, // Ice Wall glowing (solid)
    25, // Waterfall      (R4: 0.225 + the 0.8 push, feather-gated upward)
    26, // Body Floor
    27, // Body Wall    (solid)
    28, // Ghost Tile
    // ⚠ 29 (Bridge) IS MODELLED FROM R4, and it is the only type here that
    // is terrain only CONDITIONALLY. A closed bridge is `type = "Solid"` and
    // never underfoot; the render that takes the `<= 0` arm writes
    // `type = "Tile"` and from that frame the entity is in the list
    // `getState` searches, so `state` really can be 29 — `moveSpeeds[29]` is
    // the plain walk speed. Until R4 nothing could open one, so the type was
    // legitimately absent; leaving it absent now would make the crossing
    // itself throw.
    29, // Bridge         (R4: walkable only while `openBridges` holds it)
    30, // Ghost Tile Step — moveSpeed 0.4, no side effects
    31, // Igneous-to-Lava
    32, // Odd Tile
    33, // Fuchsia Tile
    34, // Odd Tile wall (solid)
    35, // Rock Wall dark (solid)
    36, // Rock Wall    (solid)
    37, // Rock Wall floor
]);

const MODELLED_TILE_SET = new Set(MODELLED_TILE_TYPES);

/**
 * ⛓ R5 SLICE 22: `IceTurretBlast.hitables` minus `"Player"`, which is not a
 * member of any geometry list this module owns. A Tile carries no `cls` and
 * is `type = "Solid"` once flipped, so the filter is only ever applied to
 * entity entries. See `collidesBlast` for why this is a third list.
 */
const BLAST_HITABLE_TYPES = new Set(['Solid', 'Tree', 'Shield']);

/**
 * ⛓⛓⛓ R8 SLICE 3 — THE ARROW'S COVER LIST, AND IT IS A FOURTH MOVER.
 *
 * `Arrow.hitables` is `["Player", "Enemy", "Tree", "Solid", "Shield"]`
 * (`Arrow.as:17`) and `Arrow.solids` is EMPTY — so the hitables list is the
 * only thing that ever stops an arrow, and it stops on all five whether or
 * not it damages them (the removal is `if (hits.length > 0)`, outside the
 * switch: cover is a resource).
 *
 * ⚠ `"Player"` AND `"Enemy"` ARE NOT IN HERE, for `collidesBlast`'s own
 * reason one family over: neither is a member of any geometry list this
 * module owns. The run holds the player's box and the live enemy bodies and
 * tests them itself.
 *
 * ⛔⛔ AND THIS IS ITS OWN SET RATHER THAN A REFERENCE TO THE BLAST'S, WHICH
 * HAS THE SAME THREE MEMBERS TODAY. They are equal by coincidence of two
 * different AS3 lists (`IceTurretBlast.hitables` and `Arrow.hitables`), not
 * by construction, and sharing the symbol is how a list comes to mean nothing
 * the moment one of the two classes changes
 * ([[feedback_two_cost_models_must_agree]] — `SHOVE_SETTLE_TICKS` refusing to
 * borrow `PUSH_GLIDE_TICKS` is the same decision). `levelWorld.test.js`
 * asserts the equality WITH that reason, so the coincidence is a measurement.
 */
const ARROW_HITABLE_TYPES = new Set(['Solid', 'Tree', 'Shield']);

/** The arrow's cover types, for a consumer that wants to derive against them. */
export const ARROW_COVER_TYPES = Object.freeze([...ARROW_HITABLE_TYPES]);

/** Why each unmodelled type is out, for the error message. */
const UNMODELLED_REASON = Object.freeze({
    1: 'Water — `canSwim` is the CONCH, which Karlore.added() gates on hasFire '
        + '(BobBoss, R5). `drownTimer` is never reset off-hazard, so the whole-run '
        + 'budget is eleven cumulative ticks and then die(). Water is '
        + 'planner-forbidden floor until R5; standing on one is a ROUTE defect, '
        + 'which is what this throw says.',
});

/**
 * ── ROLES: why the census is not all-or-nothing any more ──────────────
 *
 * v2's `buildLevelWorld` threw on ANY tag it did not carry, which was right
 * while every caller was a collision run. The subtractive ladder's first
 * rungs are not: a `noclip` walk never asks whether a `bob` blocks, and
 * pricing 115 collider footprints to find that out is R2's bill, not R0's.
 *
 * So a tag is classified PER ROLE, and the builder throws only for a role
 * the caller says it CONSULTS:
 *
 *   `blocking`          does it stop the sweep? (the `collider` fields)
 *   `trigger`           does it swap the world?
 *   `pickup`            is it a walk-over item, i.e. a freeze the tape
 *                       cannot dismiss and a volume a route must avoid?
 *   `proximity-hazard`  does APPROACHING it freeze the game, move the
 *                       player, or consume gameplay RNG — without any key
 *                       being pressed?
 *
 * ⚠ "Classified" is an affirmative act, never a default. `roles` lists the
 * roles an entry answers for; the answer is "does not participate" only
 * when the entry says so with a source citation. A tag absent from the
 * table is unclassified for EVERY role and still throws.
 *
 * ⚠ The census for the three CHEAP roles is deliberately WIDER than the
 * fixture levels — all 116, exactly like the trigger census (`stairsup`).
 * The reason is the same shape and worse: a missed trigger is an exit that
 * silently does not exist, and a missed proximity hazard is not a loud
 * throw anywhere useful either — it is a mid-walk deadlock, or 150 frozen
 * frames, or a shifted global RNG stream, all of which surface as "the
 * physics diverged".
 */
export const ROLES = Object.freeze([
    'blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat',
]);

/** The three a relaxed (noclip) walk consults. `blocking` is R2's bill. */
export const RELAXED_ROLES = Object.freeze(['trigger', 'pickup', 'proximity-hazard']);

/**
 * The four roles every rung through R4 consulted, and the DEFAULT.
 *
 * ⚠⚠ `combat` IS OPT-IN, AND THAT IS A DELIBERATE ASYMMETRY. Every other
 * role was added by widening this default, because a walk that ignored a
 * trigger or a pickup was WRONG. A walk with `noDamage: true` — which is
 * every fixture R0 through R4 recorded, all fifty-seven of them — is not
 * wrong to ignore combat: the guard is real and the game honoured it. Making
 * `combat` the default would throw on the four committed route files at
 * import time and re-open a settled rung to satisfy a table.
 *
 * So R5 asks for it by name, and `ROLES` stays the name of "every role there
 * is" so that `buildLevelWorld`'s unknown-role check keeps working.
 * See `feedback_coincidental_predicate_rots`: the set a caller consults is
 * pinned by that caller, never inferred.
 */
export const PRE_R5_ROLES = Object.freeze([
    'blocking', 'trigger', 'pickup', 'proximity-hazard',
]);

/**
 * The roles an `ENTITY_CLASSES` entry's own `roles` field answers for.
 *
 * ⛔ `combat` IS NOT ONE OF THEM, and that is not an oversight. The other
 * four are answered by the entry itself ("does it block", "does it swap the
 * world"); the combat answer lives in `combat.js`'s two tables, which have
 * their own vocabulary — hit points, aggro reach, which terrain kills it —
 * and their own second stratum (`seedlingDamageSites.js`). If `combat` were
 * in this list, then `roles: ROLES` on a hundred-odd scenery entries would
 * silently CLAIM a combat answer none of them has, which is the exact
 * "classified is an affirmative act, never a default" rule the ROLES
 * docblock opens with. So the entity-table check iterates these four and the
 * combat check is its own block, sourced from its own table.
 */
export const ENTITY_TABLE_ROLES = Object.freeze([
    'blocking', 'trigger', 'pickup', 'proximity-hazard',
]);

/**
 * The two derivations that decide whether a placed tag NEEDS a combat row.
 *
 * `HARMFUL_CLASS_SET` is the call-site census — a grep over the Seedling
 * checkout for every `hit`/`drown`/`die` on a `Player`-typed receiver, which
 * knows nothing about combat.js. `TOTAL_ENEMIES_SET` is the whitelist
 * `Game.totalEnemies()` sums, because a COUNTED class seals a kill lock
 * whether or not it can hurt you: `DarkTrap` is counted, unkillable and
 * harmless, and it is the one combination that can seal a lock forever.
 * A tag matching either one has to be priced.
 */
const HARMFUL_CLASS_SET = new Set(HARMFUL_CLASSES);
const TOTAL_ENEMIES_SET = new Set(TOTAL_ENEMIES_CLASSES);

/**
 * Does this placed tag need a combat row, and WHY? `null` means no.
 *
 * ⛓⛓ R6 SLICE 6b — EXTRACTED FROM `buildLevelWorld`'s combat block, and the
 * reason is that paying the Pod bill DELETED THE BLOCK'S ONLY LIVE WITNESS.
 *
 * Until this slice, `buildLevelWorld(L112, ROLES)` was the integration
 * proof that the check fires: `pod` was the one placed tag in the whole
 * extract with no row. With the row paid, **no level and no
 * `ENTITY_CLASSES` tag can reach the throw any more** — every tag in
 * `LOOKS_LIKE_COMBAT` has a row, and every dangerous `as3` in the extract
 * does too. A check whose failing branch has become unreachable from real
 * data is a check whose non-vacuity has to move DOWN a stratum rather than
 * be quietly dropped, so the predicate is exported and tested directly with
 * class names the extract does not place.
 * → [[feedback_bounded_sweep_must_name_what_it_bounded]]
 *
 * ⚠ ONE implementation, two callers (the block and the test), never a
 * paraphrase of the block in the test — the two-cost-models law.
 *
 * @param {string} tag the entity tag as the extract spells it
 * @param {string|null} as3 `ENTITY_CLASSES[tag].as3`, or null if unknown
 * @returns {string|null} the reason it needs a row, or null
 */
/**
 * Which of the FOUR hazard dispositions is this `cls.hazard`?
 *
 * ⛓ R6 SLICE 6b. There were three (`'unpriced'` / `inert` / a volume) and
 * this slice adds `entry` — a hazard whose trigger is WORLD ENTRY, so there
 * is no rect and no claim that it cannot fire. Extracted for the same reason
 * as `combatRowRequirement`: paying the Pod bill emptied the `'unpriced'`
 * disposition, so the builder's refusal arm is no longer reachable from the
 * shipped table and the branch has to be witnessed one stratum down.
 *
 * ⚠ ORDER IS LOAD-BEARING. `entry` is tested before `inert` so that a row
 * carrying both would be a visible contradiction rather than a silent
 * precedence — and the table test asserts no row carries two.
 *
 * @param {string|object} hazard `ENTITY_CLASSES[tag].hazard`
 * @returns {'none'|'unpriced'|'entry'|'inert'|'volume'}
 */
export function hazardDisposition(hazard) {
    if (!hazard) return 'none';
    if (hazard === 'unpriced') return 'unpriced';
    if (hazard.entry) return 'entry';
    if (hazard.inert) return 'inert';
    return 'volume';
}

export function combatRowRequirement(tag, as3) {
    if (ENEMY_CLASSES[tag] || PUZZLEMENT_HAZARDS[tag]) return null;
    if (as3 !== null && (HARMFUL_CLASS_SET.has(as3) || TOTAL_ENEMIES_SET.has(as3))) {
        return `${as3} reaches the player or is summed by totalEnemies()`;
    }
    if (LOOKS_LIKE_COMBAT.has(tag)) return 'it is in the combat vocabulary';
    return null;
}

/**
 * The ONE placement table, injected into `combat.js`'s census.
 *
 * `combat.combatCensus` refuses to guess a constructed position, and this is
 * why: an enemy's `x`/`y` — the coordinates `FP.distance`, `getState` and
 * every aggro test read — are the CONSTRUCTOR's, not the `.oel` file's, and
 * `IceTurret`'s ctor is `super(_x + Tile.w, _y + Tile.h)`, sixteen pixels
 * down and right of the attribute. That table is `ENTITY_CLASSES`' own
 * `dx`/`dy`, transcribed once from each class's `Game.as` construction site.
 * One implementation, two callers — the `levelRun.js` doctrine.
 */
export const combatPlacementOf = (tag) => {
    const cls = ENTITY_CLASSES[tag];
    // ⛔ ONLY A `rect` COLLIDER'S dx/dy IS THE ENTITY'S CONSTRUCTED POSITION.
    // A `pixelmask` entry's dx/dy is the MASK's top-left (§8.2: TentacleBeast
    // is at +24/+24 and its mask at +1/+2), and a `none` collider —
    // `notSolid`/`cheapOnly`, which is SEVENTEEN of the thirty-two combat
    // tags — has no dx/dy at all, because "does it block" never needed one.
    // Returning `{dx: 0, dy: 0}` for those is what put the whole census eight
    // pixels up and left until the live contact-control pair caught it.
    // `combat.js` owns the ctor offsets now; this is the cross-check.
    if (!cls || cls.collider !== 'rect') return null;
    if (!Number.isFinite(cls.dx) || !Number.isFinite(cls.dy)) return null;
    return { dx: cls.dx, dy: cls.dy };
};

/**
 * The combat census of one level, PER INSTANCE, with counts and the two
 * things a router asks of it: the aggro disc and the kill bill.
 *
 * §5's rule in one function: "L40 has enemies" is not a claim; these rows
 * are what a claim is made of. Callable without building a world — the
 * instruments want it that way — and `buildLevelWorld` returns exactly this
 * on `world.combat` when the caller consults the role.
 */
export function combatCensusOf(levelRecord) {
    const c = combatCensus(levelRecord, { placementOf: combatPlacementOf });
    const counts = {};
    for (const row of [...c.enemies, ...c.hazards]) {
        counts[row.tag] = (counts[row.tag] ?? 0) + 1;
    }
    return {
        level: c.level,
        // Every enemy instance, with the disc a router must not cross
        // without a declared verdict. `disc` is null for a class whose
        // aggro range is not a number (a boss's "arena", the wallflyer's
        // screen-width ray) — those are ENCOUNTER SCRIPTS, and a null here
        // is what stops an envelope from quietly calling one contact-free.
        enemies: c.enemies.map((e) => ({
            ...e, disc: aggroDisc(e.tag, e.cx, e.cy), counted: isCounted(e.tag),
        })),
        // The second damage family, carrying the field the rung turns on.
        hazards: c.hazards,
        counts,
        /** Counted instances only — what a `tSet == -1` lock waits on. */
        get bill() { return c.enemies.filter((e) => e.counted); },
        killLocks: killLocksIn(levelRecord, { placementOf: combatPlacementOf }),
        /**
         * ⚠ How many `Game.worldFrame`-coupled instances stand here.
         * Exactly two classes are (BeamTower, LavaChain), and their phase
         * rides on the accumulated dead-frame count — so a level with a
         * non-zero count here cannot be crossed on an EXACT schedule, only
         * inside a ±k envelope. It is the field the §6.6 pin decision is
         * about, surfaced where a planner can see it.
         */
        get phaseUncertain() { return c.hazards.filter((h) => h.timing === 'worldFrame'); },
    };
}

/**
 * A tag that is NOT an entity: `loadlevel` reads it with `hasOwnProperty`
 * or as a parameter block and never constructs anything. Classified for
 * every role, participating in none — which is what takes the biggest
 * blocker in the table out of the way: `lightalpha` alone appears in 98 of
 * the 116 levels.
 */
const levelFlag = (src, what) => Object.freeze({
    as3: null, collider: 'none', roles: ROLES, src, why: `not an entity — ${what}`,
});

/**
 * A `Pickup` subclass placed in a level. All fifteen are `special = true`
 * with non-empty text except `totempart`, so walking over one freezes the
 * game and spawns an NPC that only `Input.released(V)` dismisses — during
 * FROZEN frames, which the bot's tick counter skips. **A walked-over
 * special pickup deadlocks the tape**, which is why a pickup is an
 * avoid-volume rather than something a route may clip.
 *
 * None of them BLOCKS: `Mobile` never assigns `type` and no placed pickup
 * subclass does either (only `Coin`/`SealPiece`/`Stick` do, and none of
 * those is placed), so `type` stays FlashPunk's default "" — in no solids
 * list. `attract` is false for every placed one, so they do not chase.
 *
 * The rect is the ctor's half-tile offset plus `setHitbox`, same algebra as
 * a blocking entry: `[x + 8 - originX, + w) x [y + 8 - originY, + h)`.
 */
/**
 * ⛓⛓ THE PICKUPS THAT CLEAR THEIR OWN PERSISTENCE TAG (R6 debt 2, paid at
 * R7 slice 6).
 *
 * `Pickup.as` itself writes NO persistence — the base class's `removeSelf()`
 * is one line. Fourteen SUBCLASSES override `removed()` and write
 * `Game.setPersistence(tag, false)` there, which is what stops a collected
 * item respawning on the next visit. Three placed pickup classes do NOT:
 * `BossKey` writes `Player.hasKeySet` instead, `BossTotemPart` writes
 * `Player.hasTotemPartSet`, and `Seed` ends the game.
 *
 * ⇒ collecting one of these is an EARNED CLEAR, exactly like breaking a rock
 * or opening a touch-lock, and until this table existed `earnedClears` could
 * not say so: `buildLevelWorld` put no `persistTag` on a pickup row at all,
 * so the shield's `{20,2}` and the sword's `{10,0}` were invisible to the
 * one ledger whose whole job is "which flags did this walk turn off itself".
 *
 * ⚠ THE MEMBERSHIP IS A CLAIM ABOUT SOURCE and `levelWorld.test.js` asserts
 * its SHAPE (every name is a real pickup tag, and the three exclusions are
 * named), because a table that quietly grew a wrong member would make the
 * differential expect a clear the game never writes.
 *
 * ⚠ `HealthPickup.as:62` writes its clear OUTSIDE the `doActions` guard,
 * alone among the fourteen. It does not change this table — the model only
 * banks a clear on a COMPLETED ceremony, which is `doActions` true — but it
 * is the one member whose flag would also land on the refused path, and R6
 * §2.2 already carries it as a modelled fact.
 */
export const PICKUP_CLEARS_OWN_TAG = Object.freeze({
    sword: 'Pickups/Sword.as:47',
    shield: 'Pickups/Shield.as:47',
    torchpickup: 'Pickups/TorchPickup.as:49',
    wand: 'Pickups/Wand.as:71',
    conch: 'Pickups/Conch.as:45',
    ghostspear: 'Pickups/GhostSpear.as:46',
    health: 'Pickups/HealthPickup.as:62 (⚠ OUTSIDE the doActions guard)',
    darkshield: 'Pickups/DarkShield.as:45',
    darksuit: 'Pickups/DarkSuit.as:45',
    feather: 'Pickups/Feather.as:45',
    ghostsword: 'Pickups/GhostSword.as:46',
    firewand: 'Pickups/FireWand.as:52',
    fire: 'Pickups/Fire.as:47',
    darksword: 'Pickups/DarkSword.as:49',
});

/** The three placed pickup classes that write no persistence, and why. */
export const PICKUP_WRITES_NO_TAG = Object.freeze({
    bosskey: 'BossKey.removed() writes Player.hasKeySet(keyType, true) instead',
    totempart: 'BossTotemPart.removed() writes Player.hasTotemPartSet instead',
    seed: 'Seed ends the game; Pickups/Seed.as:73,80,85 reboot the world',
});

const pickup = (as3, src, w, h, originX, originY) => Object.freeze({
    as3,
    collider: 'none',
    roles: ROLES,
    why: 'a Pickup: Mobile assigns no type, so it is in no solids list',
    src,
    pickup: Object.freeze({
        special: true, dx: 8, dy: 8, w, h, originX, originY,
    }),
});

/**
 * A tag classified for the three CHEAP roles and NOT for `blocking`.
 *
 * This is the whole of the relaxation: saying "this is not a trigger, not a
 * pickup and does nothing on approach" is a one-read answer, while saying
 * what its collider is means transcribing a constructor chain and a
 * `setHitbox` — and, for the pixelmask classes, extracting a mask. R2 pays
 * that bill for the levels its walk actually enters.
 */
const cheapOnly = (as3, src, why) => Object.freeze({
    as3, roles: RELAXED_ROLES, src, why,
});

/**
 * R2: a tag classified for ALL FOUR roles whose `blocking` answer is "no",
 * because its `type` is not in `PLAYER_SOLID_TYPES`.
 *
 * The type is a required argument rather than a sentence in `why`, so that
 * the claim is CHECKABLE: `levelWorld.test.js` runs every entry's declared
 * type against `PLAYER_SOLID_TYPES` and requires the two to agree. A
 * hand-written "this does not block" is exactly the kind of assertion that
 * survives being wrong; a type the solids list can be asked about is not.
 *
 * ⚠ `type` here is the type at STEADY STATE. Three classes on the route
 * change it under conditions the route avoids and they carry their own
 * entries, not this one: `IceTurret` (Solid when the player is far),
 * `Cover` (Solid unless its button group is held), `FallRock` (Solid once
 * a cleared persistence lets it fall).
 */
const notSolid = (as3, src, type, why) => Object.freeze({
    as3, roles: ROLES, collider: 'none', type, src, why,
});

/**
 * The per-class transcription table: one entry per `.oel` object tag, as
 * `Game.loadlevel` constructs it (`Game.as:2034-2213`).
 *
 * `dx`/`dy` are the CONSTRUCTOR offset the class adds to the oel
 * coordinates; `w`/`h`/`originX`/`originY` are its `setHitbox` args. The
 * resulting world rect is
 *     [x + dx - originX, ... + w) x [y + dy - originY, ... + h)
 * which is why several classes that look different collapse to the same
 * one-cell footprint: `Pole` centres itself and then sets a centred
 * origin, `BrickPole` does neither.
 *
 * `collider`:
 *   'rect'      — a Hitbox; modelled exactly
 *   'pixelmask' — a Pixelmask; NOT modelled, a loud-throw seam (see below)
 *   'none'      — present in the level but does not block the player,
 *                 with the reason recorded so nobody "fixes" it later
 *
 * ⛔⛔ AND `'none'` MEANS "DOES NOT BLOCK **THE PLAYER**" — R5 slice 12.
 * Read `blocksMover` before using it for anything else. Every `type:
 * 'Enemy'` entry here has `collider: 'none'` and every one of them blocks
 * a PUSHABLE BLOCK, whose constructor pushes "Enemy" onto its own solids
 * list. That is not a defect in these entries; it is a question this table
 * has one field for and the game answers per mover.
 *
 * Every entry cites the source it was transcribed from. The source is out
 * of repo (MIT, `~/CC/seedling`), so drift cannot be caught by a diff —
 * the alarm is the census test, which forces every entity tag in the
 * committed extract for a fixture level to appear here.
 */
export const ENTITY_CLASSES = Object.freeze({
    // --- rect solids ----------------------------------------------------
    tree: {
        as3: 'Tree',
        roles: ROLES, collider: 'rect', type: 'Tree',
        dx: 16, dy: 16, w: 32, h: 32, originX: 16, originY: 16,
        src: 'Scenery/Tree.as:20-26',
        // A 2x2-TILE footprint, the canary case for "one tag is one cell".
        // 25 of them wall most of level 0's left edge.
        // ⚠ `Tree` also declares a private `solids` list — DEAD CODE. It
        // extends Entity (not Mobile), is `active = false`, and the
        // identifier is used nowhere in the file. It is vestigial, not an
        // override, and must not be read as one.
    },
    rock: {
        as3: 'Rock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/Rock.as:12-17 (new Rock(x, y, 0))',
    },
    rock2: {
        as3: 'Rock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/Rock.as:12-17 (new Rock(x, y, 1) — index picks the sprite only)',
    },
    pole: {
        as3: 'Pole',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Scenery/Pole.as:15-20',
    },
    brickpole: {
        as3: 'BrickPole',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/BrickPole.as:14-22 (sprite offsets are cosmetic)',
    },
    brickwell: {
        as3: 'BrickWell',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/BrickWell.as:14-24 (sprite offsets are cosmetic)',
    },
    breakablerock: {
        as3: 'BreakableRock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Puzzlements/BreakableRock.as:22-43',
        // ⚠ `check()` removes it when `tag >= 0 && !checkPersistence(tag)`,
        // but `Main.as:319-330` fills levelPersistence with `true` on a
        // fresh boot and the recompiled runtime never persists — so it is
        // PRESENT on every run. With no items in v2 it is a permanent
        // solid either way. (Its own comment notes the type was changed
        // from "Rock" to "Solid"; both are in the player's solids list.)
    },
    // --- NPCs, which ARE solid ------------------------------------------
    // `NPC extends Mobile` and sets `type = "Solid"` with a hitbox taken
    // from the SPRITE's frame size, centred (`NPCs/NPC.as:48-59`). Easy to
    // miss: nothing about "an NPC" suggests a collider. They are Mobiles
    // and so they run the full friction/input/move block every tick, but
    // nothing ever gives them velocity, so a static rect is correct.
    introchar: {
        as3: 'IntroCharacter',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 8, h: 8, originX: 4, originY: 4,
        src: 'NPCs/NPC.as:48-59 + IntroCharacter.as:13 (Spritemap 8x8)',
    },
    adnanchar: {
        as3: 'AdnanCharacter',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 8, h: 8, originX: 4, originY: 4,
        src: 'NPCs/NPC.as:48-59 + AdnanCharacter.as:13 (Spritemap 8x8)',
    },
    rekcahdam: {
        as3: 'Rekcahdam',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 9, h: 10, originX: 4, originY: 5,
        src: 'NPCs/NPC.as:48-59 + Rekcahdam.as:13 (Spritemap 9x10)',
        // ⚠ originX is `_g.width / 2` = 4.5 passed to `setHitbox(..., originX:int)`
        // — AS3 truncates toward zero, so it is 4, not 4.5 and not 5.
    },
    statue2: {
        as3: 'Statue',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 24, dy: 0, w: 48, h: 24, originX: 24, originY: 0,
        src: 'NPCs/Statue.as:19-45 via NPCs/NPC.as:47-49 (new Statue(x, y, 1, ...))',
        // ⚠ CORRECTED at v2 slice 4 by the oracle, which is the only reason
        // anybody found out. Level 0's statue is the ONLY entity in the
        // table whose class adds an offset of its own ON TOP of NPC's, and
        // the slice-1 transcription applied one of the two:
        //     Statue ctor  super(_x + Tile.w, _y - Tile.h/2 + Tile.h*int(_t==0), ...)
        //                  = (+16, -8) for the `statue2` tag, where _t is 1
        //                    so the third term is ZERO
        //     NPC ctor     super(_x + Tile.w/2, _y + Tile.h/2, _g)   = (+8, +8)
        //     total        (+24, 0)
        // (`IntroCharacter`, `AdnanCharacter`, `Rekcahdam` and `Watcher` all
        // pass _x/_y straight through, so for them NPC's half-tile IS the
        // whole offset and their entries were right.)
        //
        // With the render hitbox below, the world rect comes out as exactly
        // [oel.x, oel.x + 48) x [oel.y, oel.y + 24) — which is worth stating
        // because it looks like a coincidence and is not: originX is w/2 and
        // dx is Tile.w + Tile.w/2 + ... no, it simply cancels.
        //
        // The old (16, -8) put the rect 8 px up and left of the truth, and
        // NOTHING caught it until `thread-the-gap` walked past: the real
        // game pinned x at 181.17065141119556 against the statue's left edge
        // at 184, and the model walked straight through. Slice 1's own note
        // said the statue "sits far from any fixture route" — true of the v1
        // routes, and a reminder that "unobservable" is a claim about
        // today's fixtures rather than about the game.
        //
        // ⚠ `setHitbox` is called from **render()**, not the constructor
        // (`Statue.as:28-45`): frame 1 is `setHitbox(w, 24, w/2)` with
        // originY defaulting to 0, and `w` is the Spritemap's FRAME width
        // (`Game.as:348`: `new Spritemap(imgStatues, 48, 40)` over a 96x40
        // sheet) — 48, not the image's 96. Before the first render the
        // hitbox is NPC's default 48x40 centred. Unlike the Tile type flip
        // that is NOT observable on tick 0, because render() is driven by
        // the Engine independently of `Game.update`'s blackCover gate, so
        // the ~18 fade frames have all rendered before the first live tick.
    },
    // --- pixelmask colliders --------------------------------------------
    // v2 ruled these an unmodelled loud-throw seam, because Phase 5a proved
    // neither rectangle approximation safe — the sprite rect swallows a
    // building's own doorway, and the mask rect is not a rect at all.
    //
    // R2 MODELS THEM, because a doorway turned out to be load-bearing: the
    // exit to the health room sits inside `OpenTreeMask`'s 10x12 opening,
    // so a bounding rect seals a route the real mask opens (R2 kickoff
    // §8.5). The bitmaps are committed in `seedlingPixelMasks.js`; `mask`
    // names which one, `dx`/`dy` place its TOP-LEFT relative to the oel
    // coordinates, and `w`/`h` stay as the mask's bounding box because the
    // PLANNER still uses a rect (a conservative over-approximation is the
    // right direction for routing) while the PHYSICS uses the bitmap.
    //
    // ⚠ THE SEAM DID NOT GO AWAY, it moved: an entry with `collider:
    // 'pixelmask'` and no `mask` field still throws by name. That is what
    // keeps a mask class nobody extracted from silently becoming a
    // bounding rect.
    building: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'BuildingMask',
        dx: 0, dy: 0, w: 64, h: 48, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/BuildingMask.png (64x48)',
        // `super(_x, _y, ...)` then `mask = new Pixelmask(buildingMasks[0], 0, 0)`,
        // so the mask's top-left IS the oel position. `Game.buildings[_t].y = -8`
        // on the next line is the SPRITE offset and moves no collider.
    },
    building1: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'Building1Mask',
        dx: 0, dy: 0, w: 48, h: 32, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/Building1Mask.png (48x32)',
    },
    treelarge: {
        as3: 'TreeLarge',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'TreeLargeMask',
        dx: 0, dy: 0, w: 160, h: 192, originX: 0, originY: 0,
        src: 'Scenery/TreeLarge.as:22-30 + assets/graphics/TreeLargeMask.png (160x192)',
        // The entity sits at (x+80, y+96) and the mask offset is
        // (-80, -96), so the two cancel and the mask lands on the raw oel
        // coordinates. Do not "simplify" by dropping one of them.
    },
    // --- present but not blocking ---------------------------------------
    torch: {
        as3: 'Torch',
        roles: ROLES, collider: 'none', type: '',
        src: 'Scenery/Torch.as:19-30',
        why: 'never assigns `type`, so it stays "" and is in no solids list',
    },
    orb: {
        as3: 'Orb',
        roles: ROLES, collider: 'none', type: '',
        src: 'Scenery/Orb.as:30-32',
        why: 'never assigns `type`',
    },
    watcher: {
        as3: 'Watcher',
        roles: ROLES, collider: 'none', type: 'Watcher',
        src: 'NPCs/Watcher.as:40-49',
        why: 'overrides the NPC default to type "Watcher", which is in no solids list',
        // ⚠ AND IT AUTO-TALKS. `keyNeeded` is declared `true` at
        // `NPCs/NPC.as:41` and assigned in exactly ONE place in the whole
        // codebase — `Watcher.as:46`, `keyNeeded = !Game.checkPersistence(tag)`.
        // `Main.as:319-330` fills levelPersistence with `true` on a fresh
        // boot, so a Watcher with `tag >= 0` has keyNeeded FALSE and
        // `NPC.talk()` (`:225`) opens dialogue on PROXIMITY alone, freezing
        // the game at `:195` with no key pressed. All ELEVEN watchers in the
        // extract carry `tag >= 0`, so all eleven do this. (A `tag = -1`
        // watcher would be wholly inert — `Watcher.update` gates
        // `super.update()` on the same `checkPersistence`, false for an
        // out-of-range index — but there are none.)
        //
        // The volume is `FP.distance(x, y, p.x, p.y) <= talkRange` with
        // talkRange 24 (`NPC.as:27`), measured from the NPC's own centre,
        // which for a Watcher is the ctor's half-tile (`NPC.as:47`). A
        // CIRCLE, bounded here by its square — an over-approximation, which
        // is the safe direction for an avoid volume.
        hazard: {
            dx: 8 - 24, dy: 8 - 24, w: 48, h: 48, originX: 0, originY: 0,
            kind: 'auto-talk',
            effect: 'Game.freezeObjects = true, dismissed only by Input.released(V) '
                + "during frozen frames — which the bot's tick counter skips",
        },
    },
    moonrock: {
        as3: 'Moonrock',
        roles: ROLES, collider: 'none', type: '',
        src: 'Scenery/Moonrock.as:42-55',
        why: 'constructed with type "" at y = -1000; it only drops in and '
            + 'becomes "Solid" once Game.moonrockSet, a static that is false '
            + 'on a fresh boot and can only be set by the beam event (v3+)',
    },
    daynight: {
        as3: null, collider: 'none', type: null, roles: ROLES,
        src: 'Game.as:1875 (hasOwnProperty check)',
        why: 'not an entity at all — a level FLAG read by hasOwnProperty, '
            + 'never constructed',
    },
    // --- transitions ----------------------------------------------------
    teleporter: {
        as3: 'Teleporter',
        roles: ROLES, collider: 'trigger', type: 'Teleporter',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Teleporter.as:31-53',
    },
    // ⚠ BOTH stair tags are the SAME class and the SAME trigger.
    // `Game.as:2167-2168` differs only in the third argument:
    //     stairsup   -> new Stairs(x, y, TRUE,  flip, to, px, py, sign)
    //     stairsdown -> new Stairs(x, y, FALSE, flip, to, px, py, sign)
    // and `_up` only picks a sprite frame, a sound index and a render flag
    // (`Stairs.as:18-34`). The `super(...)` call is byte-identical either
    // way, so the collision geometry, the forced `show`/`tag` and the
    // trigger volume are too. Omitting `stairsup` is not a small gap: 26 of
    // the extract's 280 triggers carry it, including one of the four
    // arrivals that land ON another trigger (L97 -> L37).
    stairsup: {
        as3: 'Stairs',
        roles: ROLES, collider: 'trigger', type: 'Teleporter',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Stairs.as:11-20 via Game.as:2167 (new Stairs(x, y, true, ...))',
    },
    stairsdown: {
        as3: 'Stairs',
        roles: ROLES, collider: 'trigger', type: 'Teleporter',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Stairs.as:11-20 via Game.as:2168 (new Stairs(x, y, false, ...)) — '
            + '`Stairs extends Teleporter` and calls '
            + 'super(x, y, to, px, py, true, -1, false, sign), so it is the '
            + 'identical trigger with `show` forced true and `tag` forced -1',
    },

    // ─────────────────────────────────────────────────────────────────
    // R0: the CHEAP-ROLE census, extended from the 22 tags above to all
    // 137 in the extract. Everything below answers "trigger? pickup?
    // proximity hazard?" and, except where noted, NOT "does it block" —
    // that is R2's bill, and the loud throw for it is the rung boundary.
    // ─────────────────────────────────────────────────────────────────

    // --- level FLAGS: not entities at all -----------------------------
    // These four join `daynight` above. `lightalpha` is the one that
    // matters most: it appears in 98 of the 116 levels, so it was the
    // single largest blocker in the v2 census, and it turns out not to be
    // an entity at all.
    lightalpha: levelFlag('Game.as:1873', 'a lighting NUMBER read off the tag'),
    snow: levelFlag('Game.as:1879', 'a hasOwnProperty flag turning on snowfall'),
    blur: levelFlag('Game.as:1884', 'a hasOwnProperty flag setting Game.blurRegion'),
    blur2: levelFlag('Game.as:1888', 'a hasOwnProperty flag setting Game.blurRegion2'),
    // ⚠ `control` carries the PIT DESTINATION. It builds nothing, but it is
    // the data `Player.checkFallingInPit` uses for `Game.fallthroughLevel`
    // — i.e. pits are a TRANSPORT primitive, and 12 of these edges are the
    // only way into 14 of the 116 levels (darkshield L74 and darksuit L79
    // among them). See the R0 kickoff §8.7(b).
    control: levelFlag('Game.as:2048', 'a parameter block: fallthrough level/offset/sign'),
    droplet: levelFlag('Game.as:2056', 'a parameter block: the rain rect and heaviness'),

    // --- PICKUPS: walk-over items, every one a tape deadlock ----------
    // `Pickup.pick_up()` (`Pickups/Pickup.as:90-120`) sets
    // `Game.freezeObjects = true`, counts `specialTimer` 150 down, spawns
    // an NPC carrying the item's text, and unfreezes only once that NPC is
    // gone. `NPC.talk()` runs while frozen and dismisses on
    // `Input.released(V)` — and the bot dispatches edges only on LIVE
    // ticks. So a route that clips one of these never finishes.
    sword: pickup('Sword', 'Game.as:2117 + Pickups/Sword.as:21-23', 8, 8, 4, 4),
    shield: pickup('Shield', 'Game.as:2124 + Pickups/Shield.as', 8, 8, 4, 4),
    torchpickup: pickup('TorchPickup', 'Game.as:2125 + Pickups/TorchPickup.as', 8, 8, 4, 4),
    wand: pickup('Wand', 'Game.as:2184 + Pickups/Wand.as', 3, 8, 2, 4),
    conch: pickup('Conch', 'Game.as:2123 + Pickups/Conch.as', 8, 8, 4, 4),
    ghostspear: pickup('GhostSpear', 'Game.as:2119 + Pickups/GhostSpear.as', 12, 4, 6, 2),
    health: pickup('HealthPickup', 'Game.as:2132 + Pickups/HealthPickup.as', 4, 4, 2, 2),
    darkshield: pickup('DarkShield', 'Game.as:2121 + Pickups/DarkShield.as', 9, 9, 5, 5),
    darksuit: pickup('DarkSuit', 'Game.as:2122 + Pickups/DarkSuit.as', 10, 10, 5, 5),
    feather: pickup('Feather', 'Game.as:2118 + Pickups/Feather.as', 8, 8, 4, 4),
    ghostsword: pickup('GhostSword', 'Game.as:2120 + Pickups/GhostSword.as', 20, 4, 10, 2),
    firewand: pickup('FireWand', 'Game.as:2185 + Pickups/FireWand.as', 8, 8, 4, 4),
    bosskey: pickup('BossKey', 'Game.as:2130 + Pickups/BossKey.as', 8, 8, 4, 4),
    seed: pickup('Seed', 'Game.as:2133 + Pickups/Seed.as', 10, 14, 5, 7),
    // The one placed Pickup whose `text` is empty, so it self-resolves after
    // 150 frozen frames instead of deadlocking. Still an avoid volume: 150
    // frozen frames advance the global RNG stream (rain consumes one per
    // frame) and `BossTotemPart` writes save state.
    totempart: pickup('BossTotemPart', 'Game.as:2131 + Pickups/BossTotemPart.as',
        16, 16, 8, 8),

    // --- PROXIMITY HAZARDS -------------------------------------------
    // The test applied to every tag: with `noDamage` and `noHazards` on and
    // NO key pressed, can being near this thing freeze the game, move the
    // player, or consume gameplay RNG? Found by scanning all 209 files for
    // `Game.freezeObjects = true`, `Game.setPersistence(`, direct writes to
    // a Player's x/y/receiveInput, `.freeze(`/`.die()` on a player, and
    // `FP.world = new Game`, then reading each hit.
    //
    // ⚠ Only two carry a transcribed VOLUME (`chest` and `watcher`, the two
    // the R0 walk can reach). The rest are `hazard: 'unpriced'`: classified
    // as hazards on evidence, with the avoid volume deliberately NOT
    // guessed. `buildLevelWorld` throws when one appears in a level whose
    // proximity-hazard role is consulted — a rung boundary made visible,
    // exactly like the pixelmask seam, rather than a rect nobody derived.
    chest: {
        as3: 'Chest', roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2159 + Chest.as:25-34',
        // `Chest.update` (`:57-65`) opens on
        // `FP.world.collideLine("Player", x-originX+2, y-originY+height+1,
        //  x-originX+width-4, y-originY+height+1)` — a 1-px line BENEATH the
        // chest, inset 2 px on the left and 4 on the right. Opening spawns a
        // special `SealPiece` (150 frozen frames), calls
        // `Game.setPersistence`, and burns an UNBOUNDED `while` loop of
        // `Math.random()` for the seal index (`:80-84`) — so it does not
        // merely freeze, it shifts the global RNG stream by a number of
        // draws that depends on saved state.
        //
        // The volume is the chest's own cell plus two rows for the line and
        // the player's box depth: [x, x+16) x [y, y+18).
        hazard: {
            dx: 0, dy: 0, w: 16, h: 18, originX: 0, originY: 0,
            kind: 'line-below',
            effect: 'spawns a special SealPiece (150 frozen frames), writes '
                + 'persistence, and consumes an unbounded number of Math.random() '
                + 'draws for the seal index',
        },
    },
    button: {
        as3: 'Button', roles: ROLES, collider: 'none', type: 'Button',
        src: 'Game.as:2127 + Puzzlements/Button.as:19-40',
        why: 'STANDING ON IT presses it: `collideTypesInto(["Player","Enemy","Solid"], '
            + 'x, y, v)` then `activate = v.length > 0`, which propagates to every '
            + '`Activators` sharing its `t` — including a ButtonRoom, which writes '
            + 'persistence for ANOTHER level (ButtonRoom.as:93). No key needed.',
        hazard: {
            dx: 4, dy: 5, w: 8, h: 6, originX: 0, originY: 0,
            kind: 'stand-on',
            effect: 'presses, which propagates to every Activators sharing its `t` — '
                + 'and a ButtonRoom writes persistence for ANOTHER LEVEL, changing '
                + 'what exists in a room this run models from a static extract',
        },    },
    buttonroom: {
        as3: 'ButtonRoom', roles: ROLES, collider: 'none', type: 'ButtonRoom',
        src: 'Game.as:2128 + Puzzlements/ButtonRoom.as:93',
        why: 'the other half of `button`: `Game.setPersistence(t, persist, room)` '
            + 'changes what EXISTS in a different level',
        hazard: {
            dx: 4, dy: 5, w: 8, h: 6, originX: 0, originY: 0,
            kind: 'stand-on',
            effect: 'presses, which propagates to every Activators sharing its `t` — '
                + 'and a ButtonRoom writes persistence for ANOTHER LEVEL, changing '
                + 'what exists in a room this run models from a static extract',
        },    },
    pull: {
        as3: 'Pull', roles: ROLES, collider: 'none', type: 'Pull',
        src: 'Game.as:2134 + Puzzlements/Pull.as:33-45',
        why: 'moves the player DIRECTLY — `collideTypesInto(["Player",...])` then '
            + '`e.x += force*cos(dir); e.y -= force*sin(dir)` every tick, with no '
            + 'call to Player.hit(), so `Bot.noDamage` does not touch it. 14 of them '
            + 'sit in level 12, which is on the shortest chain to several items.',
        hazard: {
            dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
            kind: 'hitbox',
            effect: 'adds force*cos(dir) to e.x and subtracts force*sin(dir) from e.y '
                + 'every tick, for as long as the player overlaps it',
        },    },
    whirlpool: {
        as3: 'Whirlpool', roles: ROLES, collider: 'none', type: '',
        src: 'Game.as:2163 + Puzzlements/Whirlpool.as:61-81',
        why: 'writes player.x/player.y radially AND calls `player.drown()` directly '
            + '— bypassing the terrain state entirely, so `noHazards` does not stop '
            + 'it either',
        hazard: {
            dx: 0, dy: 0, w: 32, h: 32, originX: 0, originY: 0,
            kind: 'hitbox',
            effect: 'writes player.x/.y radially outward, then calls player.drown() '
                + 'directly — so noHazards does not stop it either',
        },    },
    lavatrap: {
        as3: 'LavaTrap', roles: ROLES, collider: 'none', type: 'Enemy',
        src: 'Game.as:2083 + Enemies/LavaTrap.as:56-72,145-148',
        why: 'its rotating tongue `collideLine`s the player, then DRAGS them '
            + '(`attached.x/.y = ...`) and calls `attached.die()`. `hitPlayer()` is '
            + 'overridden to {} — it never goes through Player.hit(), so `noDamage` '
            + 'does not touch it. The volume is a DISC of radius max(tongueLengths).',
        hazard: {
            point: { dx: 8, dy: 8, r: 33 },
            kind: 'chomp-disc',
            effect: 'launches a tongue that ATTACHES the player and then writes '
                + 'attached.x/.y every tick until it is fully retracted, at which '
                + 'point it calls attached.die() unless Player.hasDarkSuit',
        },    },
    iceturret: {
        as3: 'IceTurret',
        roles: ROLES, collider: 'rect', type: 'Enemy',
        dx: 16, dy: 16, w: 32, h: 32, originX: 16, originY: 16,
        // ⛔⛔⛔ CORRECTED AT R5 SLICE 20, AND THE OLD READING WAS A MISREAD
        // OF WHICH `if` THE ELSE BELONGS TO. This entry used to say
        // "`IceTurret.as:93-95` is the ELSE-arm of the `d <= attackRange`
        // test … it is 'Enemy' from the base ctor and becomes 'Solid' on any
        // tick the player is outside its 128 px range", and priced it as an
        // UNCONDITIONAL 32x32 solid on that basis.
        //
        // It is the else-arm of `if (sprIceTurret.currentAnim != "dead")`.
        // The braces are explicit. So `type = "Solid"` fires ONLY for a
        // CORPSE, and only on a tick the player's box does not overlap it —
        // and nothing ever writes the type back, so it is a LATCH.
        //
        // ⇒ AN ALIVE ICE TURRET DOES NOT BLOCK THE PLAYER AT ALL. Worth +16
        // lattice cells in every L40 flood (`L40_ARRIVAL_BREAK`'s four
        // counts each move by exactly the body's 4x4 nodes; the +208 and
        // every reachability verdict are unchanged).
        //
        // ⛓ THE SOLID IS STILL BUILT, because the corpse is a real solid and
        // the entity is the id join for it: `solid.turretId` + the
        // `iceTurrets` roster + `liveRectOf`'s turret arm, which returns
        // `null` for anything the RUN has not said is a standing corpse.
        // `solid.rect` here is the ALIVE 32x32 body and `liveRectOf` never
        // returns it — it is kept because the hazard disc and the aim are
        // about the live entity.
        //
        // ⚠ THE HAZARD BELOW IS STILL STATIC, and a dead turret does not
        // shoot. Named rather than fixed: making the 129 px disc per-visit
        // is a `proximityHazards` change with no driven witness, and the
        // conservative direction is the one it is already in.

        src: 'Game.as:2137 + Enemies/IceTurret.as:53-95 + Projectiles/IceTurretBlast.as:52',
        why: 'its projectile calls `(hits[i] as Player).freeze(freezeTime)` — a '
            + 'frozen player runs no friction/input/move block, which is a stream '
            + 'difference, and it does not go through Player.hit()',
        hazard: {
            point: { dx: 16, dy: 16, r: 129 },
            kind: 'attack-range',
            effect: 'aims and, after shootTimer, fires three IceTurretBlasts, each of '
                + 'which calls Player.freeze(90) — ninety ticks with no input block',
        },    },
    fallrock: {
        as3: 'FallRock',
        roles: ROLES, collider: 'none', type: '',
        // ⚠ NOT SOLID, AND THE REASON IS A CONSTRAINT ON THE CLEAR LIST.
        // The ctor parks it at `y = -16` with `type = ""` unless
        // `!Game.checkPersistence(tag)`, and a fresh boot leaves every flag
        // TRUE — so on the R2 route it is off-map and in no solids list.
        // CLEARING ITS TAG ARMS IT: the ctor then builds it at `fallTo` with
        // `type = "Solid"` and `_active = true`, a 16x16 solid at
        // [oel.x, +16) x [oel.y, +16) whose update writes the player's y.
        // No clear in the R2 list targets a fallrock tag, and that is a rule
        // the derivation keeps rather than a coincidence (kickoff §8.7).
        // R1 met the armed form once — L38's arrival ButtonRoom writes
        // persistence into L37 — and priced it as an `extraVolumes` entry
        // bound to the leg that makes the contact.

        src: 'Game.as:2135 + Scenery/FallRock.as:59,107',
        why: 'triggers on the player being above it, then freezes the game and '
            + 'writes `p.y`',
        hazard: {
            inert: 'a FRESH BOOT parks it. `Main.as:319-330` fills levelPersistence '
                + 'with true, and both the constructor and the whole falling branch of '
                + 'update() are behind `!Game.checkPersistence(tag)` — so a tag >= 0 '
                + 'rock sits at y = -16 with type "", never falls, never freezes the '
                + 'game and never writes p.y. Every one on the R1 route carries a tag. '
                + 'A tag = -1 rock would be live; there are none. '
                // ⛔⛔ R5 SLICE 10: THE SENTENCE ABOVE IS TRUE AND IT IS NOT
                // THE WHOLE STORY, and the game charged 197 frozen frames for
                // the difference.
                + '⛔⛔ BUT `set activate` IS NEITHER OF THOSE TWO PLACES. '
                + '`FallRock.as:111-118` is `if (a && !_active) { fall(); _active = a; }` '
                + 'and `fall()` runs `Game.setPersistence(tag, false)` ITSELF — so an '
                + 'ACTIVATOR PUBLICATION arms a rock whose flag nothing else touched, and '
                + 'the update-time gate is then open because the setter opened it. Two of '
                + 'the game\'s three `RopeStart`s publish to a `FallRock` (L28 t1, L39 '
                + 't6): it is the mechanism, not an edge. Modelled in `fallRock.js`; the '
                // ⚠ THE INERTNESS THAT SURVIVES, stated exactly.
                + 'inertness that survives is narrower — a rock is inert for a route that '
                + 'never PUBLISHES ITS GROUP, which is every R1-R4 route and no route '
                + 'that pulls a rope.',
        },    },
    fallrocklarge: {
        as3: 'FallRockLarge',
        roles: ROLES, collider: 'none', type: '',
        // As `fallrock`, parked at `y = -32`, and 2x2 TILES when armed:
        // super(_x + Tile.w, _y + Tile.h) with setHitbox(32, 32, 16, 16)
        // gives [oel.x, +32) x [oel.y, +32).

        src: 'Game.as:2136 + Scenery/FallRockLarge.as:67,117,134',
        why: 'as `fallrock`, and the one in level 32 additionally spawns BobBoss '
            + '(`bossrock && thirdboss`) — the only construction site of the boss '
            + 'that drops `fire`, since no .oel carries a bobboss1/2/3 tag',
        hazard: {
            inert: 'a FRESH BOOT parks it. `Main.as:319-330` fills levelPersistence '
                + 'with true, and both the constructor and the whole falling branch of '
                + 'update() are behind `!Game.checkPersistence(tag)` — so a tag >= 0 '
                + 'rock sits at y = -16 with type "", never falls, never freezes the '
                + 'game and never writes p.y. Every one on the R1 route carries a tag. '
                + 'A tag = -1 rock would be live; there are none.',
        },    },
    shieldlock: {
        as3: 'ShieldLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        // Geometry is `Lock`'s (ShieldLock.as:26 is a bare super with tSet
        // forced to -2); the lock-snap hazard below is the separate question.

        src: 'Game.as:2145 + Puzzlements/ShieldLock.as:35-49 (new ShieldLock(x,y,tag,1))',
        why: 'snaps `p.y` and sets `p.receiveInput = false` on approach',
        // R3: what the collide rect below cannot say. The RECT is already
        // here — `ShieldLock.update` collides at `x - 1` and the avoid volume
        // is that same rect, one geometry answering two questions, exactly as
        // `pressers` reuses `cls.hazard` for the press volume. This block
        // carries only the two facts a rect cannot: which shield opens it,
        // and where the snap puts the player.
        lockSnap: {
            // `(Player.hasDarkShield && shieldType == 1)`; `shieldlock` is
            // constructed with the default `_type = 1` (`Game.as:2145`).
            shield: 'hasDarkShield',
            // `p.y = y - originY + 7`, where `y` is the ENTITY's (placement
            // + Tile.h/2 = +8, `Lock.as:31`) and `originY` is 8
            // (`Lock.as:33`). So the snap lands the player at placement + 7,
            // one pixel above the lock cell's centre.
            snapDY: 7,
            src: 'Puzzlements/ShieldLock.as:32-39',
        },
        hazard: {
            dx: -1, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
            kind: 'lock-snap',
            effect: 'snaps p.y and sets p.receiveInput = false',
            // ⚠ PRICED UNCONDITIONALLY LIVE, deliberately over-approximating.
            // `ShieldLock.update` fires only under `(hasDarkShield && type
            // == 1) || (hasShield && type == 0)`, so the true volume is a
            // function of the INVENTORY — it appears halfway through a walk,
            // the moment the shield room is entered. A volume that switches
            // on mid-route is a policy the planner has no vocabulary for,
            // and over-avoiding is the safe direction, so it is always on.
        },    },
    shieldlocknorm: {
        as3: 'ShieldLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,

        src: 'Game.as:2144 + Puzzlements/ShieldLock.as:35-49 (new ShieldLock(x,y,tag,0))',
        why: 'same class as `shieldlock`; the fourth argument picks a sprite',
        // Same class, `_type = 0` — so the OTHER arm of the disjunction at
        // `ShieldLock.as:33` and the plain shield. Not a sprite difference:
        // reading it as one would open every normal lock on the dark shield.
        lockSnap: { shield: 'hasShield', snapDY: 7, src: 'Puzzlements/ShieldLock.as:32-39' },
        hazard: {
            dx: -1, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
            kind: 'lock-snap',
            effect: 'snaps p.y and sets p.receiveInput = false',
            // ⚠ PRICED UNCONDITIONALLY LIVE, deliberately over-approximating.
            // `ShieldLock.update` fires only under `(hasDarkShield && type
            // == 1) || (hasShield && type == 0)`, so the true volume is a
            // function of the INVENTORY — it appears halfway through a walk,
            // the moment the shield room is entered. A volume that switches
            // on mid-route is a policy the planner has no vocabulary for,
            // and over-avoiding is the safe direction, so it is always on.
        },    },
    pod: {
        as3: 'Pod', roles: ROLES, collider: 'none', type: 'Pod',
        dx: 8, dy: 8,
        src: 'Game.as:2191 + Scenery/Pod.as:24-45,60-80',
        why: 'snaps `p.x`/`p.y` to its own position, then calls Player.hit()',
        // ⛓⛓ R6 SLICE 6b — PRICED. §14.3 transcribed it and deliberately did
        // not wire it; this is the wiring, and the volume is the oel cell
        // EXACTLY.
        //
        //   ctor  `super(_x + Tile.w/2, _y + Tile.h/2)`  ⇒ entity = oel+(8,8)
        //         `setHitbox(16, 16, 8, 8)`              ⇒ box = the oel cell
        //   gate  `collideTypesInto(["Player"], x, y, v)` — the POD's own box
        //         at the POD's own position, so `dx/dy/originX/originY` are
        //         all 0 and the rect is `[oel.x, +16) x [oel.y, +16)`.
        //
        // ⛔⛔ THE PIN SURVIVES `noDamage` AND THE DAMAGE DOES NOT. The three
        // position writes sit ABOVE the `p.hit` call (`Pod.as:70-73`), and
        // `Bot.noDamage` returns at the top of `Player.hit` — so a
        // `noDamage: true` tape keeps the teleport and loses only the heart.
        // Same shape as `whirlpool`, and the reason this volume is avoided by
        // EVERY tape rather than by the damage-taking ones.
        //
        // ⛔ STANDING IN AN *OPEN* POD CLOSES IT. `if (v.length > 0 &&
        // currentAnim == "opened") play("close")` makes the player their own
        // trigger — 22 updates later the anim is `"closed"` and the pin is
        // live. So the volume is armed on a fresh boot with no boss action at
        // all, which is why `inert:` would be the wrong classification.
        //
        // ⛓ AND THE PIN IS NOT A ONE-SHOT. `p.hit`'s own `hitsTimer` (20)
        // rate-limits the hearts; `p.x = x; p.y = y; p.v.x = p.v.y = 0` is
        // UNGATED and runs on every tick of overlap. A pinned player cannot
        // walk out.
        hazard: {
            dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
            kind: 'pod-pin',
            effect: 'writes `p.x`/`p.y`/`p.v` ABSOLUTELY every tick of overlap while '
                + 'its animation is "closed", then calls `p.hit(null, 0, null, 1)` — '
                + 'and only the second half is inside `noDamage`',
        },
    },
    bosstotem: {
        as3: 'BossTotem',
        roles: ROLES, collider: 'rect', type: 'Enemy',
        // `setHitbox(80, 32, 40, -12)` — an 80x32 box whose origin is
        // NEGATIVE in y, so the body sits BELOW the entity point.
        dx: 0, dy: 0, w: 80, h: 32, originX: 40, originY: -12,
        // ⛔⛔⛔ CORRECTED AT R5 SLICE 23, AND IT WAS `collider: 'none'` FOR
        // TWENTY-TWO SLICES BECAUSE NOTHING HAD EVER BEEN IN THE ROOM.
        //
        // `BossTotem.update` ends its activation block with
        //
        //     if (activated) { type = "Enemy"; ... } else { type = "Solid"; }
        //
        // so an UNWOKEN boss is a Solid — and for `bosstotem@152,168` the
        // box is `[112,192) x [180,212)`, which is EXACTLY L43's arena
        // columns 7..11, i.e. the whole width of the room. It is the wall
        // that shuts the north half before the wake, and the CLAMP is what
        // shuts it after (`bossTotem.bossTotemClampY`, an ASSIGNMENT of the
        // same 212 this box's bottom edge is).
        //
        // ⛓ THE SOLID IS PER-VISIT, like the ice turret's corpse: the
        // entity is the id join (`solid.bossId` + the `bossTotems` roster),
        // and `liveRectOf`'s boss arm returns `null` once the run says the
        // boss has activated. ⛔ `null` MEANS NOT SOLID and must not fall
        // through to `s.rect` — an activated boss is `"Enemy"`, which is not
        // in `Mobile.solids`, and the 31 live ticks the player has to run
        // north through it are the window's whole claim.
        //
        // ⚠ ONE INSTANCE IN THE GAME (`bosstotem@152,168`, level 43), so
        // this correction moves no committed fixture — which is also why it
        // survived unmeasured for so long.
        src: 'Game.as:2071 + Enemies/BossTotem.as:280-315,486',
        why: 'writes `p.y` directly during its fight sequence, and consumes RNG',
        hazard: {
            inert: 'it activates on `FP.world.classCount(Wand) <= 0` — i.e. when the '
                + 'Wand has been COLLECTED. R0 ruled grants to be property writes only, '
                + 'so the pickup is never removed from the world, classCount(Wand) is '
                + 'never 0, the boss never activates, and its p.y write at :284 (behind '
                + '`fullyActivated`) never runs. The grants ruling paying for itself in '
                + 'a way nobody predicted — and it means R3, which collects for real, '
                + 'has to price this volume properly.',
        },    },
    finalboss: {
        as3: 'FinalBoss', roles: ROLES, collider: 'none', type: 'Enemy',
        dx: 8, dy: 8,
        src: 'Game.as:2074 + Enemies/FinalBoss.as:78-100,131-165,216-222',
        why: 'sets `Game.freezeObjects = true` for its intro, and writes persistence',
        /**
         * ⛓⛓ R6 SLICE 6b — CLASSIFIED, AND IT IS THE FOURTH DISPOSITION.
         *
         * §8.13's second refusal was `hazard: 'unpriced'` and the obvious
         * discharge is a rect. **There is no rect.** Every one of this
         * class's hazardous effects is ungated by distance:
         *
         *   · the intro `Game.freezeObjects = true` runs in the `!started`
         *     block on the FIRST update of the room, at any separation, and
         *     holds until an X RELEASE (`FinalBoss.as:80-99`);
         *   · `activeOffScreen = true`, so the barrage aims at the player
         *     from anywhere in the level and `RockFall` lands on the aim
         *     point, not near the boss;
         *   · the persistence writes are `endAnim`'s, i.e. the DEATH.
         *
         * A volume that expressed any of that would be the whole room, and
         * "avoid the room" is not a routing instruction — it is the fight.
         * ⇒ `entry:` says the trigger is WORLD ENTRY rather than proximity,
         * and names what prices it instead. The class is still a hazard on
         * the same evidence; what it is not is a *proximity* hazard.
         *
         * ⚠ `inert:` would have been the cheap discharge and it would have
         * been false — this thing fires on a fresh boot with no input at all.
         */
        hazard: {
            entry: 'ROOM ENTRY, not proximity: the `!started` intro raises '
                + '`Game.freezeObjects` on the room\'s first update from any distance '
                + 'and holds it until an X RELEASE; `activeOffScreen = true` makes the '
                + 'rockfall barrage aim at the player anywhere in the level; and the '
                + '`{112,0}`/`{112,1}` writes are `endAnim`\'s death arm. There is no '
                + 'avoid volume smaller than the level. Priced by `finalBossFight.js` '
                + '(the fight model) and by `combat.ENEMY_CLASSES.finalboss` (the '
                + 'contact damage), never by a rect a planner routes around.',
        },
    },

    // --- everything else: not a trigger, not a pickup, harmless to be
    //     near. Blocking stays unclassified — that is R2's bill.
    //
    // Enemies are the bulk of this list and they share one reason: damage
    // reaches the player ONLY through `Player.hit()` (`Player.as:1345`),
    // which `Bot.noDamage` guards. The seven classes that reach around it
    // are all in the hazard section above, and finding them is why the scan
    // looked for direct position writes rather than for "is it an enemy".
    bob: notSolid('Bob', 'Game.as:2066 + Enemies/Enemy.as:58', 'Enemy',
        'damage only, via Player.hit()'),
    bobsoldier: notSolid('BobSoldier', 'Game.as:2067 + Enemies/Enemy.as:58', 'Enemy',
        'damage only'),
    flyer: notSolid('Flyer', 'Game.as:2075 + Enemies/Enemy.as:58 (via Bob)', 'Enemy',
        'damage only (Flyer.as:68). ⚠ Its ctor is `super(_x, _y, …)` with NO half-tile '
        + 'offset — the only enemy on the map without one — and its damage is 2, the '
        + 'only non-boss contact that costs two hearts'),
    jellyfish: notSolid('Jellyfish', 'Game.as:2076 + Enemies/Enemy.as:58', 'Enemy',
        'damage only'),
    lavarunner: notSolid('LavaRunner', 'Game.as:2077 + Enemies/Enemy.as:58 (via Bob)',
        'Enemy', 'damage only'),
    bulb: notSolid('Bulb', 'Game.as:2078 + Enemies/Enemy.as:58 (via Bob)', 'Enemy',
        'damage only'),
    tentaclebeast: {
        as3: 'TentacleBeast',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'TentacleBeastMask',
        dx: 1, dy: 2, w: 46, h: 44, originX: 0, originY: 0,
        src: 'Game.as:2079 + Enemies/TentacleBeast.as:38-46 '
            + '+ assets/graphics/TentacleBeastMask.png (46x44)',
        // ⛔ THE THIRD ENEMY THAT IS SOLID, and the mask extractor said the
        // opposite for three rungs: its docblock read `TentacleBeast extends
        // Enemy` and concluded "type is Enemy, which is in no solids list",
        // but the ctor OVERWRITES it — `type = "Solid"` at `:46`, exactly as
        // `BombPusher.as:31` does. So the mask is a real collider and L57
        // could not be built without it.
        // ⚠ THE TWO OFFSETS ARE NOT THE SAME NUMBER, and only one `dx` field
        // serves both readers. `super(_x + 24, _y + 24, …)` puts the ENTITY
        // 24 px in, and `new Pixelmask(img, -23, -22)` puts the MASK 23/22
        // back out from there — so the mask's top-left is oel + (1, 2).
        // `entityRect` reads `x + dx - originX` and `maskPlacement` reads
        // `x + dx`, so the pair that satisfies both is dx/dy = 1/2 with zero
        // origins, not 24/24 with 23/22. (The `Statue` lesson again: an
        // offset applied at one level of the chain and not the next.)
    },
    drill: notSolid('Drill', 'Game.as:2080 + Enemies/Enemy.as:58', 'Enemy',
        'Enemy — chases within runRange (48, by teleport-hop along a solid-free line) '
        + 'but only ever damages via Player.hit()'),
    sandtrap: notSolid('SandTrap', 'Game.as:2081 + Enemies/Enemy.as:58', 'Enemy',
        'Enemy — proximity only plays a "chomp" animation and a sound '
        + '(SandTrap.as:56-64); damage is the base Enemy contact path. ⚠ It is the one '
        + 'plain enemy whose `removed()` writes its own persistence tag '
        + '(SandTrap.as:85), so killing one is a LEDGER entry'),
    icetrap: notSolid('IceTrap', 'Game.as:2082 + Enemies/Enemy.as:58', 'Enemy',
        'as SandTrap: proximity animates, damage goes through Player.hit()'),
    darktrap: notSolid('DarkTrap', 'Game.as:2084 + Enemies/Enemy.as:58 (via SandTrap)',
        'Enemy', 'reacts to LIGHT sources, not to the player'),
    turret: notSolid('Turret', 'Game.as:2085 + Enemies/Enemy.as:58', 'Enemy',
        'fires projectiles that hit()'),
    beamtower: {
        as3: 'BeamTower',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 16, w: 16, h: 32, originX: 8, originY: 24,
        src: 'Game.as:2087 + Puzzlements/BeamTower.as:28-44',
        // ⚠ A DAMAGE SOURCE THAT IS ALSO A SOLID, and two tiles tall:
        // `super(_x + 8, _y + 16, …)` then `setHitbox(16, 32, 8, 24)` gives
        // [oel.x, +16) x [oel.y + 8, +32). The BEAM is the damage and it is
        // not this rect — it is a swept position from
        // `Game.worldFrame(phases, loops)`, i.e. a phase that rides on the
        // accumulated dead-frame count (see `combat.PUZZLEMENT_HAZARDS`).
        // Four of these flank the L108 ferry corridor.
    },
    grenade: notSolid('Grenade', 'Game.as:2088 + Enemies/Grenade.as:41', 'Enemy',
        'damage only (Grenade.as:133)'),
    bombpusher: {
        as3: 'BombPusher',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 24, dy: 24, w: 48, h: 48, originX: 24, originY: 24,
        src: 'Game.as:2089 + Enemies/BombPusher.as:24-35',
        // ⚠ An ENEMY THAT IS SOLID. `BombPusher extends Enemy` (whose ctor
        // sets type = "Enemy"), and then its own ctor OVERWRITES it with
        // "Solid" — so the "enemies are type Enemy and therefore not
        // traversal blockers" rule, which is true of every other enemy on
        // the route, is false here. And it is 3x3 TILES:
        // super(_x + Tile.w*3/2, _y + Tile.h*3/2) with
        // setHitbox(48, 48, 24, 24) gives [oel.x, +48) x [oel.y, +48).
    },
    crusher: {
        as3: 'Crusher',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 16, dy: 16, w: 32, h: 32, originX: 16, originY: 16,
        src: 'Game.as:2090 + Puzzlements/Crusher.as:37-40',
        // `Crusher extends Activators`: super(_x + Tile.w, _y + Tile.h) then
        // setHitbox(32, 32, 16, 16) — [oel.x, +32) x [oel.y, +32), two tiles
        // square. ⛔ Its damage is **1000** ("KILL EVERYTHING",
        // `Crusher.as:33`), so a contact is `die()` at any `hitsMax` and its
        // volume is never a graze. `type` also becomes "BS" mid-cycle
        // (`:57`), which is in no solids list — priced as the steady-state
        // "Solid", which over-approximates in the safe direction for a
        // route that stays out of a 1000-damage box anyway.
    },
    puncher: notSolid('Puncher', 'Game.as:2091 + Enemies/Enemy.as:58', 'Enemy',
        'damage only (Puncher.as:216)'),
    wallflyer: notSolid('WallFlyer', 'Game.as:2197 + Enemies/Enemy.as:58', 'Enemy',
        'damage only'),
    spinner: notSolid('Spinner', 'Game.as:2198 + Enemies/Enemy.as:58', 'Enemy',
        'damage only TO THE PLAYER (Spinner.as:75); Spinner.as:50 despawns it on a\n'
        + '        cleared persistence, which changes nothing about blocking.\n'
        + '        ⛔⛔ R5 SLICE 12: IT BLOCKS A PUSHABLE BLOCK. `PushableBlockFire.as:31`\n'
        + '        pushes "Enemy" onto its own solids list, and this one MOVES —\n'
        + '        `v = moveSpeed·(cos(-π/4), sin(-π/4))`, a `friction()` override that\n'
        + '        clamps |v| >= moveSpeed so it never stops, and moveX/moveY overrides\n'
        + '        that REFLECT. It wedged block 2 mid-glide in L39 and cost the shaft its\n'
        + '        whole ledger — see `r5Shaft.SPINNER_WEDGE` and `blocksMover`.'),
    spinningaxe: {
        as3: 'SpinningAxe',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 8, h: 8, originX: 4, originY: 4,
        src: 'Game.as:2140 + Puzzlements/SpinningAxe.as:24-44',
        // ⚠ An 8x8 collider at the CENTRE of its cell: [oel.x+4, +8) x
        // [oel.y+4, +8). It leaves a 4 px margin on every side, which a
        // tile-granular reachability model turns into a false wall — the
        // reason R2's feasibility pass runs at one-pixel resolution.
    },
    pulser: {
        as3: 'Pulser',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2139 + Puzzlements/Pulser.as:26-38',
    },
    arrowtrap: notSolid('ArrowTrap',
        'Game.as:2129 + Puzzlements/ArrowTrap.as:24 + Activators.as (base)',
        '',
        'fires Arrows, which damage via Player.hit() (Arrow.as:49); neither '
        + 'ArrowTrap nor the Activators base calls setHitbox or assigns a '
        + 'type, so it stays Entity-default "" — in no solids list'),
    lavachain: {
        as3: 'LavaChain',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2141 + Puzzlements/LavaChain.as:24-46',
        // Damages ENEMIES only (LavaChain.as:86) — no Player branch — but it
        // is `type = "Solid"` with setHitbox(16, 16, 8, 8) at the cell
        // centre, so it blocks. "Harmless" and "passable" are different
        // questions and this class answers them differently.
    },
    lavaboss: {
        as3: 'LavaBoss',
        roles: ROLES, collider: 'rect', type: 'LavaBoss',
        dx: 48, dy: 40, w: 64, h: 58, originX: 32, originY: 29,
        src: 'Game.as:2073 + Enemies/LavaBoss.as:24-46',
        // The v2 entry flagged this as "a real R2 question rather than a
        // formality", and the answer is: it blocks. `Player.as:355-359`
        // pushes "LavaBoss" onto the player's solids list unconditionally,
        // and this is the only class that carries that type.
        // super(_x + 48, _y + 40) then setHitbox(64, 58, 32, 29), so the
        // world rect is [oel.x + 16, +64) x [oel.y + 11, +58).
        // ⚠ It sits in L82 at (112,48) and the R1 route's final leg arrives
        // at (168,280) with no exit — so it seals nothing. Priced anyway.
    },
    shieldboss: {
        as3: 'ShieldBoss',
        roles: ROLES, collider: 'rect', type: 'ShieldBoss',
        dx: 24, dy: 32, w: 48, h: 48, originX: 24, originY: 24,
        src: 'Game.as:2170 + Enemies/ShieldBoss.as:32-47',
        // ⛔ THE SEAL ON `shield`, AND IT IS HIS BODY. "ShieldBoss" is in
        // `PLAYER_SOLID_TYPES` — pushed unconditionally by `Player`'s own
        // ctor — and `super(_x + Tile.w * 1.5, _y + Tile.h * 2, …)` with
        // `setHitbox(48, 48, 24, 24)` puts a 48x48 solid at
        // [oel.x, +48) x [oel.y + 8, +48). L19's `bosskey@96,64` is INSIDE
        // it, and `_attract` is false, so the key cannot be taken while he
        // lives. Three rungs called the shield sealed by L20's lock chain;
        // it is sealed by this rect.
    },
    frozenboss: {
        as3: 'FrozenBoss',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 80, h: 32, originX: -32, originY: -128,
        src: 'Game.as:2192 + Scenery/FrozenBoss.as:18-20',
        // ⚠ NEGATIVE ORIGINS, transcribed verbatim rather than tidied:
        // `setHitbox(80, 32, -32, -128)` puts the rect at
        // [oel.x + 32, +80) x [oel.y + 128, +32) — a hundred and twenty-eight
        // pixels BELOW the placement. It is `Scenery`, not `Enemies`, in
        // spite of the name, and it writes nothing player-side.
    },
    lightbosscontroller: notSolid('LightBossController', 'Game.as:2072 '
        + '+ Enemies/LightBossController.as:40', '',
        'spawns Flyers; writes persistence only on its own death. ⚠ Its ctor is a bare '
        + '`super()` — it takes NO position at all, so the oel x/y are read into fields '
        + 'and the entity itself sits at (0, 0) with no hitbox and FlashPunk\'s default '
        + 'empty type'),

    // NPCs. `keyNeeded` is `true` for every one of them (it is assigned in
    // exactly one place in the codebase, `Watcher.as:46`), so `NPC.talk()`
    // needs `Input.released(V)` and proximity alone does nothing but set an
    // `inRange` render flag. They ARE `type = "Solid"`, which is why their
    // blocking classification still matters at R2.
    witch: {
        as3: 'Witch',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 13, originX: 8, originY: 6,
        src: 'Game.as:2178 + NPCs/NPC.as:47-59 + NPCs/Witch.as:16 (Spritemap 16x13)',
        // `NPC.as:47-59`: super(_x + Tile.w/2, _y + Tile.h/2) then
        // setHitbox(g.width, g.height, g.width/2, g.height/2) — and
        // `setHitbox` takes ints, so an odd frame size TRUNCATES toward
        // zero (the `Rekcahdam` lesson: 9/2 is 4, not 4.5 and not 5).
        // Its `doneTalking()` is where `darksword` comes from — a KEY PRESS,
        // not a proximity event, which is why it is not a hazard.
    },
    oracle: {
        as3: 'Oracle',
        roles: ROLES, collider: 'rect', type: 'Solid',
        // ⛔⛔ R6 SLICE 6d: 16x16, NOT 16x24 — THE CTOR OVERRIDES THE BASE.
        //
        // `NPC`'s constructor derives the box from the graphic
        // (`setHitbox(g.width, g.height, g.width/2, g.height/2)`, so 16x24
        // origin (8,12) for a 16x24 Spritemap) and `Oracle.as:38` then calls
        // `setHitbox(16, 16, 8, 8)` **on the line after `super()`**. The
        // table read the base and stopped, which put the solid's bottom edge
        // at y 52 where the game has it at 48.
        //
        // ⛓ Found by W-blood, whose scripted walk arrives in L1 from the
        // SOUTH — i.e. straight at the edge the two answers disagree about —
        // and unobservable before it, because no fixture had ever entered
        // L1. The velocity clamp (`p.y <= 64`) stops the walk 14 px short of
        // either box, so W-blood does not touch it either; it is corrected
        // because it is wrong, not because a tape needs it.
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2177 + NPCs/NPC.as:47-59 + NPCs/Oracle.as:38 (setHitbox overrides)',
        why: 'NPC, keyNeeded true — `Oracle` does NOT assign it, so the base\'s `true` '
            + 'stands and the dialogue needs an X RELEASE, not proximity. Its '
            + '`FP.world = new Game(...)` (Oracle.as:121) is in doneTalking() under '
            + '`Game.cutscene[1]`; the proximity check at :63 is inside render() and '
            + 'only picks an animation',
    },
    hermit: {
        as3: 'Hermit',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 10, h: 12, originX: 5, originY: 6,
        src: 'Game.as:2179 + NPCs/NPC.as:47-59 + NPCs/Hermit.as:13 (Spritemap 10x12)',
    },
    yeti: {
        as3: 'Yeti',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 10, h: 12, originX: 5, originY: 6,
        src: 'Game.as:2180 + NPCs/NPC.as:47-59 + NPCs/Yeti.as:13 (Spritemap 10x12)',
        why: 'NPC, keyNeeded true',
    },
    sensei: {
        as3: 'Sensei',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 8, h: 8, originX: 4, originY: 4,
        src: 'Game.as:2181 + NPCs/NPC.as:47-59 + NPCs/Sensei.as:13 (Spritemap 8x8)',
    },
    sign: {
        as3: 'Sign',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2182 + NPCs/NPC.as:47-59 + NPCs/Sign.as:11 (Spritemap 16x16)',
        why: 'NPC, keyNeeded true — and a Solid, like every NPC (NPC.as:59)',
    },
    totem: {
        as3: 'Totem',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 16, dy: 48, w: 32, h: 32, originX: 16, originY: 16,
        src: 'Game.as:2183 + NPCs/Totem.as:16-27 via NPCs/NPC.as:47-59',
        // ⚠ TWO offsets stack, exactly as they do for `Statue` — and the
        // source's own comment ("the weird tiles for the constructor are
        // because NPC offsets by Tile.w/2, Tile.h/2 automagically") is a
        // warning that the author already tripped over it:
        //     Totem ctor  super(_x + Tile.w/2, _y + Tile.h*5/2, ...)  (+8, +40)
        //     NPC ctor    super(_x + Tile.w/2, _y + Tile.h/2, _g)     (+8, +8)
        //     total                                                  (+16, +48)
        // then Totem OVERRIDES the sprite-derived hitbox with an explicit
        // setHitbox(Tile.w*2, Tile.h*2, Tile.w, Tile.h) = (32, 32, 16, 16).
        // World rect: [oel.x, +32) x [oel.y + 32, +32) — two tiles BELOW the
        // placement, which is the part a single-offset reading gets wrong.
    },
    karlore: {
        as3: 'Karlore',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2174 + NPCs/Karlore.as:17-23',
        // ⚠ Karlore OVERRIDES NPC's sprite-derived hitbox with an explicit
        // setHitbox(16, 16, 8, 8) — so it fills its cell rather than the
        // 20x20 sprite's centre, and its cell is a ONE-TILE CORRIDOR.
        //
        // ⚠⚠ AND IT IS AN INVENTORY-CONDITIONAL BLOCKER, the only one of its
        // shape in the codebase: `Karlore.added()` removes it outright when
        // `Player.hasFire`. Priced UNCONDITIONALLY LIVE, the same direction
        // as `shieldlock` and for the same reason — a volume that vanishes
        // partway through a walk is a policy the planner has no vocabulary
        // for. It is what seals the conch at R2 (kickoff §8.3).
    },
    forestchar: {
        as3: 'ForestCharacter',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 8, h: 9, originX: 4, originY: 4,
        src: 'Game.as:2173 + NPCs/NPC.as:47-59 + NPCs/ForestCharacter.as:13 (Spritemap 8x9)',
        // originY is `9 / 2` truncated to 4.
    },
    statue1: {
        as3: 'Statue',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 24, dy: 16, w: 48, h: 32, originX: 24, originY: 16,
        src: 'Game.as:2187 (new Statue(x, y, 0, ...)) + NPCs/Statue.as:19-45 via NPCs/NPC.as:47-49',
        // The `statue2` sibling below carries the full derivation. For _t = 0
        // the ctor's third term `Tile.h*int(_t==0)` is +16 rather than 0, so
        // Statue passes (_x + 16, _y - 8 + 16) to NPC, which adds (8, 8):
        // the entity lands at (_x + 24, _y + 16). render()'s frame-0 arm is
        // `setHitbox(w, 32, w/2, 16)` with w = the SPRITEMAP FRAME width 48
        // (Game.as:348, a 96x40 sheet cut into 48x40 frames), so the world
        // rect is [oel.x, +48) x [oel.y, +32).
        //
        // ⚠ The R2 recon priced this from the frame-1 arm and was wrong in
        // both height and origin. The two frames have DIFFERENT hitboxes.
    },
    oraclestatue: {
        as3: 'OracleStatue',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 32, h: 32, originX: 0, originY: 0,
        src: 'Game.as:2195 + Scenery/OracleStatue.as:16-21',
        // `setHitbox(32, 32)` with NO origin args, so both origins are
        // FlashPunk's default 0 and the rect's top-left IS the oel
        // position: [oel.x, +32) x [oel.y, +32). The `sprOracleStatue.y =
        // -16` / `originY = 16` two lines above move the SPRITE only —
        // `Statue`'s lesson (an offset applied at one level of the chain and
        // not the next) pointing the other way for once.
    },
    shieldstatue: {
        as3: 'ShieldStatue',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 0, w: 32, h: 32, originX: 0, originY: 0,
        src: 'Game.as:2194 + Scenery/ShieldStatue.as:16-23',
        // super(_x + Tile.w/2, _y) — a HALF-TILE in x only — then
        // setHitbox(32, 32) with the default origin. The sprite is 32x43 and
        // its y/originY are cosmetic.
    },

    // Interactive blockers: they change state only when HIT or unlocked,
    // which is an item use and therefore R3. Standing next to one does
    // nothing.
    breakablerockghost: {
        as3: 'BreakableRock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2158 (new BreakableRock(x, y, tag, 1)) + Puzzlements/BreakableRock.as:22-43',
        // The same class as `breakablerock`; the fourth argument picks the
        // sprite and the hit power needed to break it, not the collider.
    },
    burnabletree: {
        as3: 'BurnableTree',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 16, dy: 16, w: 32, h: 32, originX: 16, originY: 16,
        src: 'Game.as:2095 + Scenery/BurnableTree.as:20-30 via Scenery/Tree.as:20-26',
        // ⚠ It extends `Tree` — so it inherits Tree's (+16, +16) and its
        // 2x2-TILE hitbox — but OVERRIDES the type to "Solid", and the
        // source says why: "NOT a tree. Done so it doesn't loop with the
        // other trees." Both types are in the player's solids list, so the
        // override changes nothing here; it is transcribed because reading
        // `type` off the base class is how the next one gets missed.
    },
    lock: {
        as3: 'Lock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2138 (new Lock(x, y, tset, tag)) + Puzzlements/Lock.as:25-33',
        // `Lock.as:25-33`: super(_x + Tile.w/2, _y + Tile.h/2, g, _t) then
        // setHitbox(16, 16, 8, 8) and `type = normType` ("Solid") — exactly
        // its own cell. `Activators` adds no offset of its own.
    },
    bosslock: {
        as3: 'BossLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2147 (new BossLock(x, y, keyType, tag)) + Puzzlements/BossLock.as:30-38',
        // `BossLock extends Activators` DIRECTLY, not `Lock` — so it has no
        // `tSet` despawn condition (see the census notes) — but its ctor is
        // the same shape: super(_x + Tile.w/2, _y + Tile.h/2, g, -1) then
        // setHitbox(16, 16, 8, 8).
        //
        // ── R4: THE THIRD WAY A RESPONDER OPENS ────────────────────────
        // R2 had the BUTTON (a group flag republished every tick) and R3 the
        // TOUCH (a shield, latched). This is the KEY, and it is neither: the
        // lock reads a SAVE-FILE boolean and a one-pixel line beneath itself.
        //
        //     var p = FP.world.collideLine("Player",
        //         x - originX + m,               y - originY + height + 1,
        //         x - originX + width - 2 * m,   y - originY + height + 1);
        //     if (p && Player.hasKey(keyType)) activate = true;
        //
        // ⚠ `activate` LATCHES, and this class is the one place on the
        // ladder where that is true *by absence*. `Activators.set activate`
        // stores the flag; `BossLock` overrides it only to play a sound;
        // `tSet` is forced to -1 by the ctor's `super(..., -1)` so no
        // `Button.activateAll` ever republishes it; and nothing else in the
        // extract writes it. So `update`'s `else if (type != normType)`
        // re-close arm is UNREACHABLE once the lock has been touched — it can
        // only run before the first touch, when `type` already IS `normType`.
        // (`Lock` is the class that really does re-close, via
        // `activationStep`'s occupancy-guarded `returnToNormal`; reading
        // BossLock as a Lock is the mistake this paragraph exists to stop.)
        keyLock: {
            keyTypeAttr: 'keyType',
            // ⚠ The line is walked by `World.collideLine` with precision 1
            // and its loop is `while (x < toX)`, with the `precision > 1`
            // end-point check skipped — so `toX` itself is NEVER tested. The
            // integer probes are `[oel.x + m, oel.x + width - 2m - 1]`, i.e.
            // x = oel.x+2 .. oel.x+11 at y = oel.y + 17. Transcribed as an
            // inclusive INTEGER range rather than a rect because a rect
            // overlap would also accept a box that straddles the last probe
            // without containing it.
            x0: 2,
            x1: 11,
            dy: 17,
            // `keyTimerMax` is 60 and the decrement runs on the SAME frame
            // the touch is found, so the fade starts on tick 61 of contact.
            keyTimer: 60,
            // `alpha -= 0.05` until `alpha <= 0`, at which point `type = ""`
            // and `Game.setPersistence(tag, false)` — once, guarded by
            // `type != ""`. Repeated subtraction, never `1 / step`.
            fade: 0.05,
            src: 'Puzzlements/BossLock.as:59-88',
        },
        // ⚠ AND THE LINE IS AN AVOID VOLUME, priced unconditionally live for
        // exactly the reason `shieldlock`'s is: whether it fires is a
        // function of the INVENTORY (`Player.hasKey(keyType)`), which appears
        // halfway through a walk, and a volume that switches on mid-route is
        // a policy the planner has no vocabulary for. Over-avoiding is the
        // safe direction — and here the effect being avoided is a
        // PERSISTENCE WRITE in another level, which is a silent ledger entry
        // rather than a stall. L12 alone holds two keyType-4 bosslocks the R4
        // walk carries the key past.
        hazard: {
            // ⚠ A `line`, NOT a rect — the third volume shape, and it exists
            // because a rect is not exact enough here. See the `line` note at
            // the `proximityHazards.push` site: R3's committed L12 route
            // passes `bosslock@416,240` at y = 259.38 with the probe row at
            // y = 257, which a rect test calls a hit and the game does not.
            // The bounds are the raycast's own — `x - originX + m` to
            // `x - originX + width - 2m - 1`, because `while (x < toX)`
            // never tests `toX`.
            line: { x0: 2, x1: 11, dy: 17 },
            kind: 'key-line',
            effect: 'a player holding the matching BossKey latches `activate`, and '
                + '80 frames later the lock writes Game.setPersistence(tag, false) — '
                + 'a ledger entry in whatever level the walk happens to be passing '
                + 'through',
        },
    },
    rocklock: {
        as3: 'RockLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2137 + Puzzlements/RockLock.as:22-28',
        // `RockLock extends Activators` directly and carries its OWN
        // `normType = "Solid"` (`:19`) — the same shape as `Lock`'s but a
        // separate field. L26's is a KILL lock (`tset = -1`), and
        // `RockLock.as:52` re-states `Lock`'s kill arm rather than
        // inheriting it.
    },
    grasslock: {
        as3: 'GrassLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2143 + Puzzlements/GrassLock.as:13-16 + Puzzlements/Lock.as:25-34',
        // `GrassLock extends Lock` and its ctor is a bare `super(_x, _y, _t,
        // _tag, sprGrassLock)` — every offset and the hitbox come from
        // `Lock`, so it is the `lock` entry with a different sprite.
    },
    wandlock: {
        as3: 'WandLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2146 (new WandLock(x, y, tset, tag)) + Puzzlements/WandLock.as:13-16',
        // `WandLock extends Lock` and its ctor is nothing but
        // super(_x, _y, _t, _tag, sprWandLock) — same geometry, same
        // `tSet < 0` despawn rule.
    },
    magicallock: {
        as3: 'MagicalLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2148 (new MagicalLock(x, y, tag, 0)) + Puzzlements/MagicalLock.as:21-46',
        // ⚠ `MagicalLock extends Entity`, NOT `Activators` — so it has no
        // `tSet` at all and its check() despawn needs only a cleared
        // persistence. Geometry is the same cell: super(_x + Tile.w/2,
        // _y + Tile.h/2) then setHitbox(16, 16, 8, 8).
    },
    magicallockfire: {
        as3: 'MagicalLock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2149 (new MagicalLock(x, y, tag, 1)) — the same class, sprite only',
    },
    finaldoor: {
        as3: 'FinalDoor',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 16, dy: 16, w: 32, h: 32, originX: 16, originY: 16,
        src: 'Game.as:2190 + Scenery/FinalDoor.as:23-26',
        why: 'opens on seal state; it READS persistence (including level 114 tag 0, the '
            + 'Watcher) but writes nothing on approach',
    },
    // ⚠ `rope` is the one entry whose footprint is not a constant: it spans
    // from its own x to its `<node>` child's, so `w` is DATA and lives with
    // the placement rather than with the class. See `ROPE_SPANS`.
    rope: {
        as3: 'RopeStart',
        roles: ROLES, collider: 'rope', type: 'Rope',
        dx: 8, dy: 8, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2201-2210 (node-terminated) + Puzzlements/RopeStart.as:20-49',
        // `setHitbox(_xend - _x + 16, 16, 8, 8)` at (_x + 8, _y + 8), so the
        // world rect is [oel.x, xend + 16) x [oel.y, +16) — a horizontal span.
        // `type = "Rope"` IS in the player's solids list.
        //
        // ⚠⚠ A CLEARED ROPE DOES NOT DESPAWN, IT SHRINKS. `check()` calls
        // `hit()`, not `FP.world.remove` — and `hit()` runs
        // `setHitbox(16, 16, 8, 8)`, leaving a ONE-CELL solid at the span's
        // start. The R2 brief listed it with the despawning classes.
    },
    pushableblock: {
        as3: 'PushableBlock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2164 + Puzzlements/PushableBlock.as:23-32',
        // `extends Mobile`, whose ctor adds NOTHING (Mobile.as:21-24 is a
        // bare super), so there is no half-tile here: setHitbox(16, 16) with
        // the default origin lands on the raw oel cell.
        //
        // ⚠ It is a MOBILE and it moves — but only when pushed, which is an
        // item-shaped action R2 does not model. Priced as a static solid,
        // which is what it is for a walk that never pushes. R2 kickoff §9
        // ruled the pushables onto the blocked list for exactly this reason.
    },
    pushableblockfire: {
        as3: 'PushableBlockFire',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2165 + Puzzlements/PushableBlockFire.as:25-33',
        // A separate class from `PushableBlock`, also `extends Mobile`
        // directly, with the same setHitbox(16, 16) — not a subclass of it.
    },
    pushableblockspear: {
        as3: 'PushableBlockSpear',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2166 + Puzzlements/PushableBlockSpear.as:11-16 via PushableBlockFire',
        // `extends PushableBlockFire` and its ctor only recolours the
        // graphic and sets moveTypes = ["Spear"], so the geometry is Fire's.
    },
    lightpole: notSolid('LightPole', 'Game.as:2155 + Scenery/LightPole.as:45', 'LightPole',
        'lit by a hit; its own type "LightPole" is in no solids list'),
    moonrockpile: {
        as3: 'MoonrockPile',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 32, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2193 + Scenery/MoonrockPile.as:17-23 (sprite MoonrockPile.png 32x16)',
        // ⚠ `setHitbox(spr.width, spr.height)` — the hitbox is the IMAGE's
        // size, so it is 2 tiles WIDE and 1 tall. The R2 recon guessed 16x16
        // and was wrong; the sprite had to be measured.
    },

    // Scenery and presentation.
    rock3: {
        as3: 'Rock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2114 (new Rock(x, y, 2)) — Scenery/Rock.as:12-17, index picks the sprite',
    },
    rock4: {
        as3: 'Rock',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2115 (new Rock(x, y, 3)) — Scenery/Rock.as:12-17, index picks the sprite',
    },
    treebare: {
        as3: 'Tree',
        roles: ROLES, collider: 'rect', type: 'Tree',
        dx: 16, dy: 16, w: 32, h: 32, originX: 16, originY: 16,
        src: 'Game.as:2094 (new Tree(x, y, true)) + Scenery/Tree.as:20-26',
        // The same class and the same 2x2-tile footprint as `tree`; the
        // `_bare` flag only picks which sprite render() draws.
    },
    opentree: {
        as3: 'OpenTree',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'OpenTreeMask',
        dx: 0, dy: 0, w: 32, h: 32, originX: 0, originY: 0,
        src: 'Game.as:2096 + Scenery/OpenTree.as:13-26 via Scenery/Tree.as:20-26',
        // ⚠ THE MASK IS ASSIGNED IN update(), NOT IN THE CONSTRUCTOR:
        // `if (!mask) { setHitbox(); mask = new Pixelmask(imgOpenTreeMask,
        // -16, -16); }`. The entity is at Tree's (x+16, y+16) and the mask
        // offset is (-16, -16), so the two cancel and the mask lands on the
        // raw oel coordinates — the same cancellation as `treelarge`.
        //
        // ⚠ Before that first update it carries Tree's setHitbox(32, 32, 16,
        // 16), which is the SAME bounding box — so the one-tick difference is
        // rect-instead-of-mask over identical bounds, the same family as the
        // Tile type flip `beforeTypeFlip` models. Not transcribed: `Tree`
        // sets active = false and OpenTree sets it back to true, so the
        // update runs, and a route that needs the doorway on its ARRIVAL
        // tick would be depending on an ordering this module does not model.
        //
        // Its doorway (rows 20-31, columns 11-20) is what the health room's
        // exit teleporter sits inside — see the R2 kickoff §8.5.
    },
    snowhill: {
        as3: 'SnowHill',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'SnowHillMask',
        dx: 0, dy: 0, w: 96, h: 56, originX: 0, originY: 0,
        src: 'Game.as:2097 + Scenery/SnowHill.as:14-22',
        // super(_x, _y, ...) then mask = new Pixelmask(imgSnowHillMask, 0, 0)
        // — the mask's top-left IS the oel position. `active = false`, so
        // unlike OpenTree it is armed from construction.
    },
    building2: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'Building2Mask',
        dx: 0, dy: 0, w: 64, h: 48, originX: 0, originY: 0,
        src: 'Game.as:2100 (new Building(x, y, 2)) + Scenery/Building.as:20-23',
    },
    building4: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'Building4Mask',
        dx: 0, dy: 0, w: 144, h: 128, originX: 0, originY: 0,
        src: 'Game.as:2102 (new Building(x, y, 4)) + Scenery/Building.as:20-23',
        // The largest mask in the game — 144x128, and only 10528 of its
        // 18432 pixels are opaque, so the bounding rect is 43% wrong by area.
    },
    building5: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'Building5Mask',
        dx: 0, dy: 0, w: 64, h: 48, originX: 0, originY: 0,
        src: 'Game.as:2103 (new Building(x, y, 5)) + Scenery/Building.as:20-23',
    },
    building6: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'Building6Mask',
        dx: 0, dy: 0, w: 80, h: 88, originX: 0, originY: 0,
        src: 'Game.as:2104 (new Building(x, y, 6)) + Scenery/Building.as:20-23',
    },
    building7: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'Building7Mask',
        dx: 0, dy: 0, w: 80, h: 96, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/Building7Mask.png (80x96)',
        // ⚠ ON THE CRITICAL PATH, not scenery trivia: L93 is the only level
        // with an edge into L98, i.e. into Dungeon 8, and it would not build
        // at all while this tag was blocking-unclassified.
    },
    building8: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid', mask: 'Building8Mask',
        dx: 0, dy: 0, w: 64, h: 64, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/Building8Mask.png (64x64)',
    },
    wire: notSolid('Wire', 'Game.as:2107 + Scenery/Wire.as:20-26', 'Wire',
        'decoration — its own type "Wire" is in no solids list'),
    bed: {
        as3: 'Bed',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 32, originX: 0, originY: 0,
        src: 'Game.as:2108 + Scenery/Bed.as:15-21',
    },
    dresser: {
        as3: 'Dresser',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 32, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2109 + Scenery/Dresser.as:16-20',
    },
    bar: {
        as3: 'Bar',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 64, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2110 + Scenery/Bar.as:16-20',
        // `setHitbox(64, 16)` — four tiles wide, one tall, top-left at the
        // oel position. The `barstool` beside it is a separate tag.
    },
    barstool: {
        as3: 'Barstool',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 4, dy: 4, w: 8, h: 8, originX: 0, originY: 0,
        src: 'Game.as:2111 + Scenery/Barstool.as:16-23',
        // super(_x + Tile.w/4, _y + Tile.h/4) then setHitbox(8, 8) with the
        // default origin. The sprite's own y = -4 / originY are cosmetic.
    },
    dungeonspire: {
        as3: 'DungeonSpire',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Game.as:2160 + Scenery/DungeonSpire.as:16-23',
        // `sprDungeonSpire.y = -8` and its originY are the SPRITE's, applied
        // after super() and before setHitbox — they move no collider.
    },
    littlestones: notSolid('LittleStones', 'Game.as:2162 + Scenery/LittleStones.as:18-26',
        '', 'scenery; extends Entity, never assigns `type`, and only spawns Grass'),
    ruinedpillar: {
        as3: 'RuinedPillar',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 32, h: 32, originX: 0, originY: 0,
        src: 'Game.as:2196 + Scenery/RuinedPillar.as:16-23',
        // A 2x2-TILE footprint. Eleven of them across L30/37/38/39/40.
    },
    cover: {
        as3: 'Cover',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2142 + Puzzlements/Cover.as:23-35',
        // ⚠ NOT a decorative overlay — it is `type = normType` ("Solid") in
        // the ctor, and `update()`'s else-arm calls `reset()` (which restores
        // "Solid") on EVERY tick its Activators group is not held. It only
        // becomes passable while `activate` is true, and even then not
        // immediately: the alpha fades 0.1 per frame and `type` clears when
        // it reaches 0, i.e. TEN ticks after the button is pressed.
        //
        // The v2 entry called it "a tile overlay" on the strength of
        // `Button` excluding Covers from what presses it — which is a fact
        // about what presses a button, not about what stops a player. L38's
        // cover is what seals the wand at R2 (kickoff §8.3).
    },
    bonetorch: {
        as3: 'BoneTorch',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2152 (new BoneTorch(x, y, 0, ...)) + Scenery/BoneTorch.as:29-52',
        // A light that is ALSO a solid: super(_x + Tile.w/2, _y + Tile.h/2)
        // then setHitbox(16, 16, 8, 8), so it is exactly its own cell.
    },
    bonetorch2: {
        as3: 'BoneTorch',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2153 (new BoneTorch(x, y, 1, ...)) + Scenery/BoneTorch.as:29-52',
        // The `_type` argument picks a sprite and a light offset only.
    },
    planttorch: {
        as3: 'PlantTorch',
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Game.as:2154 + Scenery/PlantTorch.as:26-48',
    },
    lightray: notSolid('LightRay', 'Game.as:2199 + Scenery/LightRay.as:20-28', '',
        'a drawn ray; extends Entity and never assigns `type`'),
    shadow: notSolid('Shadow', 'Game.as:2200 + Scenery/Shadow.as:22-32', '',
        'a drawn rect; extends Entity and never assigns `type`'),
});

/** The `.oel` tags that build a `Stairs` rather than a bare `Teleporter`. */
export const STAIRS_TAGS = Object.freeze(['stairsup', 'stairsdown']);

/**
 * R2: the `Activators` tags whose SOLIDITY answers to a button group.
 *
 * Kept here rather than in `activators.js` because `buildLevelWorld` is
 * what has to recognise them while building, and a module that imported
 * the state machine to build geometry would couple the two the wrong way
 * round. `activators.js` holds the semantics; this holds the membership,
 * and a test pins that the two lists agree.
 */
/**
 * R4: the three pushable tags, by the `input()` they run.
 *
 * ⚠ THE FAMILY, NOT THE CLASS, because the class hierarchy and the
 * behaviour disagree. `PushableBlockSpear extends PushableBlockFire` and
 * shares its `input()` — a TARGET-TILE glide, moved by a press. Plain
 * `PushableBlock` extends `Mobile` directly with its own `input()` — it is
 * WALK-pushed, by a player leaning on an edge, and no arm of `genericHit`
 * names it at all, so no press of any weapon moves one.
 *
 * `pushables.js` steps the `fire` family and REFUSES to step a `walk` one,
 * which is why the distinction is data here rather than a comment.
 */
export const PUSHABLE_FAMILIES = Object.freeze({
    pushableblockspear: 'fire',
    pushableblockfire: 'fire',
    pushableblock: 'walk',
});

export const ACTIVATOR_RESPONDERS = new Set([
    'lock', 'wandlock', 'shieldlock', 'shieldlocknorm', 'grasslock', 'cover',
    // R4: the KEY responder. It joins the family late because until this rung
    // nothing could hold a BossKey, so listing it would have modelled an
    // opening that could not happen — see `activators.KEY_RESPONDERS`.
    'bosslock',
]);

/** The two tags that press a group: `Button` and `ButtonRoom`. */
export const ACTIVATOR_PRESSERS = new Set(['button', 'buttonroom']);

/**
 * ── R4: THE CLASSES A PRESS ANSWERS, and why this list is short ───────
 *
 * `Player.genericHit` (`Player.as:1053-1112`) is one if/else chain of
 * `e is <Class>` tests. Every class it names is here with its arm and what
 * the arm COSTS a run; every other class in the extract is inert under a
 * press **because the chain does not name it**, which is a single claim
 * about one function rather than 115 defaults. That is what makes this
 * table checkable: re-read `genericHit` and the two lists must agree.
 *
 * ⚠ THE ENTRY IS BY AS3 CLASS, NOT BY `.oel` TAG, because the chain
 * dispatches on class and several tags share one (`rock3`/`rock4` are both
 * `Rock`; every enemy tag is an `Enemy`). The census table's `as3` field is
 * the join.
 *
 * ⚠ ORDER MATTERS IN THE CHAIN and it is preserved in the comments:
 * `e is PushableBlockSpear` is tested BEFORE `e is PushableBlockFire`, so
 * a `PushableBlockSpear` never reaches the arm that would consult its own
 * `moveTypes` — which is exactly why a sword pushes one (R4 §8.5).
 */
export const PRESS_ARMS = Object.freeze({
    Enemy: {
        arm: '(e as Enemy).hit(f, new Point(x, y), d, t)',
        cost: 'hits += damage; a DEATH moves totalEnemies(), which opens tSet == -1 locks',
        src: 'Player.as:1055-1065',
    },
    Grass: {
        arm: '(e as Grass).cut(t)',
        cost: 'cosmetic + Game.grassCut',
        src: 'Player.as:1067-1070',
    },
    BreakableRock: {
        arm: '(e as BreakableRock).hit(hasGhostSword ? 1 : 0)',
        cost: 'despawns at its hit count AND writes Game.setPersistence(tag, false)',
        src: 'Player.as:1071-1074',
    },
    RopeStart: {
        arm: '(e as RopeStart).hit()',
        cost: 'SHRINKS to a one-cell solid (it does not despawn) and writes persistence',
        src: 'Player.as:1075-1078',
    },
    ShieldBoss: {
        arm: '(e as ShieldBoss).hit(0, null, d)',
        cost: 'boss damage — R5; no route enters a boss room',
        src: 'Player.as:1079-1082',
    },
    LightPole: {
        arm: '(e as LightPole).hit(), ONLY under t == "Spear"',
        cost: 'toggles the group AND `set activate` calls Game.setPersistence(tag, !activate)',
        src: 'Player.as:1083-1088 + Scenery/LightPole.as:45',
    },
    Tree: {
        arm: '(e as Tree).hit(t)',
        cost: 'cosmetic shake',
        src: 'Player.as:1089-1092',
    },
    /**
     * ⛔⛔ R5 SLICE 11 — THE SUBCLASS THE JOIN COULD NOT SEE.
     *
     * `genericHit` is an `e is <Class>` chain, so `else if (e is Tree)`
     * fires for `Tree` AND every subclass. This table is keyed on the class
     * the CHAIN TESTS; `buildLevelWorld`'s census looks it up with
     * `PRESS_ARMS[cls.as3]` — the class the ENTITY IS — and a miss is a
     * silent `if (arm)` skip. So `BurnableTree` was in NO list at all: no
     * press responder, no fire policy, no hitable type. `auditFire` from
     * the one stance that reaches L40's tree returned an EMPTY census —
     * nothing modelled, nothing inert, nothing refused.
     *
     * ⚠⚠ AND THE ENTRY IT INHERITED SAYS THE OPPOSITE OF THE TRUTH.
     * `FIRE_ARM_POLICY.Tree` reads *"`Tree.hit()` is an EMPTY BODY, for
     * every `t`"* — correct about `Tree`, and false about the subclass that
     * overrides `hit` to burn: `Scenery/BurnableTree.as:30-37` plays a
     * 20-frame animation whose wrap callback is `die()`, which removes a
     * 2x2 SOLID and whose `removed()` writes `setPersistence(tag, false)`.
     * A ledger entry no route declared, and a wall the model keeps.
     *
     * ⛓ The mechanism was already transcribed ONCE — `bobBoss.BURNABLE_TREE`
     * has the 41-tick burn, for L28's arena exit — and the census still
     * could not see the class. Third time on this arc that an enumeration
     * has missed its own instance.
     *
     * ⚠ Only `BurnableTree` is affected, and that is measured rather than
     * hoped: `probe-seedling-ctor-args`'s press-arm join walks every census
     * class's ancestor chain, and the five other subclasses that override
     * `hit` are all `Enemy`s — collected by `cls.type === 'Enemy'` rather
     * than by this lookup, so no class lookup can lose them.
     */
    BurnableTree: {
        arm: '(e as Tree).hit(t) — dispatched by `e is Tree`, overridden by the subclass',
        cost: 'under t == "Fire" ONLY: a 41-tick burn, then `die()` — the 2x2 Solid is '
            + 'removed and `removed()` writes setPersistence(tag, false)',
        src: 'Player.as:1089-1092 + Scenery/BurnableTree.as:30-37,50-56,64-68',
    },
    /**
     * ⛔⛔ THE SAME DEFECT WEARING A THIRD DISGUISE — R5 slice 11.
     *
     * `BurnableTree` fell out of the census because the table is keyed on
     * the class `genericHit` TESTS and the census looks up the class the
     * entity IS. These two fall out for the mirror-image reason: they are
     * `Enemy` subclasses, so `e is Enemy` reaches them — but the census's
     * enemy path is `else if (cls.type === 'Enemy')`, and **both ctors
     * OVERWRITE `type`**:
     *
     *   `Enemies/BombPusher.as:32`  type = "Solid"    (and it is 3x3 tiles)
     *   `Enemies/LavaBoss.as`       type = "LavaBoss" (its own solids entry)
     *
     * So neither is in `pressEnemies` (wrong type) and neither had a class
     * entry (no key) — invisible on **both of the press census's paths at
     * once**, which is why the table's own "every other class is inert
     * because the chain does not name it" reads as safe. The chain names
     * them.
     *
     * ⚠ THE COMBAT CENSUS SEES THEM, and the distinction is worth keeping
     * straight: `world.combat.enemies` collects by a different rule, so
     * L40's `bombpusher@112,128` has always been in the encounter roster
     * (and in `solids`, as a 3x3 box). What it was missing is a PRESS
     * verdict — the answer to "what happens if I swing at it" — which is
     * exactly the question `BombPusher.hit`'s empty body settles.
     *
     * ⛓ `BombPusher.hit` IS AN EMPTY OVERRIDE and that is the finding, not
     * a shrug: `override public function hit(f, p, d, t):void { }`. A press
     * on one costs nothing and does nothing — no damage, no knockback, no
     * i-frames — where the `Enemy` arm it would otherwise have inherited
     * declares `hits += damage`. Declaring it is what stops a route pricing
     * a kill that cannot happen. L40 has one at (112,128).
     */
    BombPusher: {
        arm: '(e as Enemy).hit(f, p, d, t) — reached by `e is Enemy`, overridden EMPTY',
        cost: 'NOTHING. `Enemies/BombPusher.as` overrides `hit` with an empty body, so '
            + 'no press of any weapon damages, knocks back or spends an i-frame on one. '
            + 'It is unkillable, it is a 3x3 Solid, and `activeOffScreen = true`.',
        src: 'Player.as:1077-1082 + Enemies/BombPusher.as:24-36 (the `hit` override)',
    },
    LavaBoss: {
        arm: '(e as Enemy).hit(f, p, d, t) — reached by `e is Enemy`, overridden',
        cost: 'a boss damage gate keyed on `t == "LavaBall"` and `hitByFire`; R6/R7 work, '
            + 'declared here only so the class is not invisible to the census',
        src: 'Player.as:1077-1082 + Enemies/LavaBoss.as (the `hit` override)',
    },
    Tile: {
        arm: '(e as Tile).bridgeOpeningTimer--, ONLY under t == "Spear"',
        cost: 'starts a bridge opening — see bridges.js; no other tile reads the timer',
        src: 'Player.as:1093-1099',
    },
    PushableBlockSpear: {
        arm: 'hit(facingVector, t, _relative = TRUE)',
        cost: 'slides ONE TILE in the FACING direction; a block resting on '
            + 'water/lava/pit destroys itself, so a stray push is an irreversible '
            + 'route change within the visit',
        src: 'Player.as:1100-1103 + Puzzlements/PushableBlockFire.as:76-87',
    },
    PushableBlockFire: {
        arm: 'hit(new Point(x, y), t) — the NON-relative path',
        cost: 'nothing for a player press: the non-relative branch consults '
            + 'moveTypes = ["Fire","Pulse"], which no weapon type satisfies',
        src: 'Player.as:1104-1107',
    },
    LavaBall: {
        arm: '(e as LavaBall).hit()',
        cost: 'R5 — Dungeon 7',
        src: 'Player.as:1108-1111',
    },
    Watcher: {
        arm: '(e as Watcher).hit()',
        cost: 'R6 — the ending',
        src: 'Player.as:1112-1115',
    },
    IceTurret: {
        arm: '(e as IceTurret).bump(new Point(x, y), t) BEFORE the Enemy arm',
        cost: 'the Enemy cost plus a bump; Dungeon 5, off route',
        src: 'Player.as:1057-1060',
    },
    /**
     * ⛓⛓⛓ R6 SLICE 6f: THE OWL — the class with NO arm of its own, and the
     * only responder on the roster a press cannot damage AND cannot ignore.
     *
     * `Player.genericHit` opens with `if (e is Enemy)` and `FinalBoss extends
     * Enemy`, so the call is the generic one; `onlyHitBy = "Lava"` then sends
     * it past the whole damage path to `else if (justKnock) knockback(f, p)`.
     * ⇒ the cost is a POSITION, and this rung's window is built out of
     * exactly three of them.
     *
     * ⛔ THE RECT IS NOT A CONSTANT AND MOVES WITHIN ONE PRESS — see
     * `presses.pressRespondersIn`'s `finalBosses` arm, which is why the
     * `finalBossId` join below exists.
     */
    /**
     * ⛓⛓⛓ R8 SLICE 6: THE FIRST PRESS ARM AGAINST A BODY THAT MOVES ON ITS
     * OWN — and the key is here for `BurnableTree`'s reason, one family over.
     *
     * `genericHit` is an `e is <Class>` chain and `Spinner extends Enemy`, so
     * the arm it takes is the BASE one, twenty lines above any name of its
     * own. This table is keyed on the class the chain TESTS and the census
     * looks it up as `PRESS_ARMS[cls.as3]` — so without this row a spinner
     * falls to `cls.type === 'Enemy'` and lands in `pressEnemies`, which
     * carries NO RECT and therefore no press could ever reach one.
     *
     * ⛔ THE RECT IS NOT A CONSTANT AND THE REASON IS NEW. A pushed block
     * moves between presses; a killed turret moves and shrinks; a dead
     * ShieldBoss vanishes; the Owl is shoved BY the press. A spinner moves
     * ~1 px every tick for reasons that have nothing to do with the player —
     * `runRange` 0, `activeOffScreen` true — so it is the first body on this
     * roster whose position at hit test 3 differs from its position at hit
     * test 1 whether or not the press lands at all.
     */
    Spinner: {
        arm: '(e as Enemy).hit(f, new Point(x, y), d, t) — reached by `e is Enemy`; '
            + 'the class overrides none of `Enemy.hit`\'s five gates',
        cost: '1 damage against `hitsMax` 3 behind a 30-tick `hitsTimer` (so ONE of a '
            + 'press\'s five tests lands), an atan2 KNOCKBACK at `swordForce` 5 against '
            + '`moveSpeed` 1 with a friction FLOOR of 1 — twenty ticks of a different '
            + 'trajectory — and, at the third hit, a death that moves `classCount` AND '
            + 'writes `Game.setPersistence(tag, false)` from `removed()`.',
        src: 'Player.as:1055-1065 + Enemies/Enemy.as:141-181 + Enemies/Spinner.as:22-64',
    },
    FinalBoss: {
        arm: '(e as Enemy).hit(f, new Point(x, y), d, t) — reached by `e is Enemy`; '
            + '`onlyHitBy = "Lava"` takes the `justKnock` arm and only SHOVES',
        cost: 'a KNOCKBACK of `min(swordForce, maxForce)` along the player->boss ray, '
            + 'with NO `hitsTimer` set — so the press\'s five tests compound until the '
            + 'shove carries the body out of the 16 px reach. No damage, no persistence, '
            + 'no `classCount` move: the kill is the LAVA\'s self-hit.',
        src: 'Player.as:1055-1065 + Enemies/Enemy.as:141-181 + Enemies/FinalBoss.as:101-165',
    },
});

/**
 * The Enemy subclasses whose `hit()` override is EMPTY — no press of any
 * weapon can damage one, so they cost the audit nothing at all.
 *
 * ⚠ AN ENUMERATION, not a guess: every `override public function hit(` in
 * `src/Enemies/` was read, and exactly three have empty bodies. The others
 * either call `super.hit` under a guard (`BossTotem`, `IceTurret`,
 * `BobBoss`, `LavaBoss`) or are `hitPlayer` overrides, which is the
 * opposite direction and `Bot.noDamage`'s business.
 *
 * This matters because a DarkTrap sits in the middle of L63's and L65's
 * press geometry: without it the arithmetic would reserve a press budget
 * for an enemy that can never take one.
 */
export const PRESS_UNKILLABLE = Object.freeze({
    DarkTrap: 'Enemies/DarkTrap.as:56-59 — the body is empty',
    Grenade: 'Enemies/Grenade.as:70-71 — `{		}`; its hitsMax 1 is unreachable',
    BombPusher: 'Enemies/BombPusher.as — `hit(...):void { }` on one line',
});

/**
 * ⚠ THE ONE PRESS RESPONDER WHOSE HITBOX MOVES, and it moves before any
 * press can reach it.
 *
 * `LightPole` is `collider: 'none'` — its `type` is `"LightPole"`, which is
 * in no solids list, so it blocks nothing and the census records no
 * geometry for it. But `collideRectInto("LightPole", ...)` still collides
 * against its HITBOX, so the press audit needs one, and the constructor's
 * is not it:
 *
 *   ctor      entity at (oel + 8, oel + 8), `setHitbox(10, 12, 5, 6)`
 *             -> rect [oel.x + 3, +10) x [oel.y + 2, +12)
 *   render()  `y = startY - sprLightPole.originY + 2 * sin(...)`, and
 *             `centerOO()` on a 16x16 image makes `originY` 8, so
 *             `y = oel.y + 2*sin(...)` — the pole is re-anchored EIGHT
 *             PIXELS UP and then bobs +/- 2 about that.
 *
 * `render()` runs every frame from the Engine (the same fact that decides
 * a bridge's type), so the constructor rect is true for at most one frame.
 * What is recorded here is the BOB ENVELOPE — 16 px tall, covering both
 * extremes — because a press audit that under-states a responder's rect
 * passes a press that toggles a group, and `set activate` writes a
 * persistence flag no tape declared.
 *
 * ⚠ Conservative on purpose, and NAMED as such: the true rect is 12 px
 * tall inside this 16, so the audit can refuse a press the game would have
 * allowed. That direction costs a route; the other direction costs a
 * ledger entry nobody can explain.
 */
export const LIGHTPOLE_PRESS_BOX = Object.freeze({
    dx: 8, dy: 0, w: 10, h: 16, originX: 5, originY: 8,
    src: 'Scenery/LightPole.as:32-46 (ctor) + :58-60 (render re-anchors y)',
});

/**
 * ⛔ R5 SLICE 8: THE SECOND `entityRect` CASUALTY, found by step 0's sweep.
 *
 * `Watcher` is `collider: 'none'` (its `type` is "Watcher", which is in no
 * solids list) so the entity table gives it no top-level box at all — only
 * a `hazard` sub-object, and that one is the 48x48 AUTO-TALK CIRCLE, three
 * times too big to stand in for a press. `Watcher` is nonetheless in
 * `HITABLE_TYPES` and in `PRESS_ARMS` (`Player.as:1112-1115`), so the press
 * census called `entityRect(cls, …)` on it and got `{x: NaN, y: NaN, right:
 * NaN, bottom: NaN}` — in ELEVEN levels, L43 among them, which is the wand
 * room the next slice opens in.
 *
 * ⚠ AND ITS ARM IS `refused`, exactly as the rope's was. That is now twice
 * that a policy refusal and a geometry failure have covered for each other,
 * and the pattern is worth naming: **a `refused` arm is the one place a
 * malformed rect can never be caught by a route**, because no route ever
 * queries it. The sweep is the stratum that does not care.
 *
 * The box is `Watcher.as:49`'s `setHitbox(16, 16, 8, 8)` against the entity
 * position `NPC.as:47` constructs — `super(_x + Tile.w / 2, _y + Tile.h / 2,
 * …)`, i.e. the placement's half-tile. Those two cancel: dx/dy of +8 with an
 * origin of 8 puts the 16x16 box exactly on the placement cell.
 */
export const WATCHER_PRESS_BOX = Object.freeze({
    as3: 'Watcher',
    dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
    src: 'NPCs/Watcher.as:49 (setHitbox) + NPCs/NPC.as:47 (the ctor half-tile)',
});

/**
 * ⛓⛓⛓ R8 SLICE 6: THE THIRD `entityRect` CASUALTY — and this one was
 * unreachable until a press arm existed for the class.
 *
 * A `Spinner` is `collider: 'none'` here: it is in NO solids list (a spinner
 * does not block the PLAYER), so the entity table gives it no top-level box
 * and `entityRect` refuses by name. That refusal fired on the first probe
 * this slice ran, which is the guard working — a rect with a non-finite edge
 * never overlaps anything, so the press census would have answered "nothing
 * here" for the one body the whole slice is about.
 *
 * ⚠ AND THIS BOX IS THE FALLBACK, NOT THE ANSWER. Unlike the lightpole's and
 * the Watcher's, a spinner is never AT its placement after the first tick of
 * a visit — `pressRespondersIn`'s `spinners` join supplies the live rect and
 * this box is what an absent run state falls through to (the turret arm's
 * "absent means alive, where the level built it" default).
 *
 * ⛔ THE NUMBERS ARE `spinner.SPINNER`'s AND THE TWO ARE ASSERTED EQUAL.
 * `setHitbox(7, 7, 4, 4)` against the ctor's `super(_x + Tile.w/2, _y +
 * Tile.h/2, …)`. They are re-typed here rather than imported because
 * `spinner.js` imports `SOLIDS_BY_MOVER` from THIS module and a cycle would
 * be a worse defect than a duplicated literal — so the equality is a test
 * (`levelWorld.test.js`), which is this arc's own idiom for two tables that
 * must agree.
 */
export const SPINNER_PRESS_BOX = Object.freeze({
    as3: 'Spinner',
    dx: 8, dy: 8, w: 7, h: 7, originX: 4, originY: 4,
    src: 'Enemies/Spinner.as:31-42 (the ctor half-tile + setHitbox(7,7,4,4))',
});

/**
 * The press census's per-class box, for the responders whose PRESS volume
 * is not the one the blocking role transcribed.
 *
 * ⚠ A TABLE RATHER THAN TWO `if`s, deliberately: there are two of these
 * now and both arrived the same way — a class in `PRESS_ARMS` that the
 * entity table gives no box, discovered only when something threw. Keyed on
 * `as3`, the way `moveTypes` is (slice 6's `PUSHABLE_FAMILIES` lesson), so
 * a family alias cannot answer for a class.
 */
/**
 * ⛓⛓⛓ R6 SLICE 6f: THE OWL's SPAWN box — and it is only ever the SPAWN's.
 *
 * `setHitbox(12, 12, 6, 6)` (`FinalBoss.as:52`) against the entity position
 * `super(_x + Tile.w/2, _y + Tile.h/2, …)` builds, so a `finalboss@64,96`
 * has a 12x12 box centred on (72,104) — i.e. NOT the placement cell, unlike
 * the Watcher's, because 6 does not cancel 8.
 *
 * ⚠ THE CENSUS RECT IS STALE FROM THE ROOM'S SECOND TICK. He walks. Every
 * consumer joins through `finalBossId` and reads the run's live rect; this
 * box exists so the census BUILDS (`entityRect` throws on a class with no
 * box) and so an unfought room answers with the body the level made.
 */
export const FINAL_BOSS_PRESS_BOX = Object.freeze({
    as3: 'FinalBoss',
    dx: 8, dy: 8, w: 12, h: 12, originX: 6, originY: 6,
    src: 'Enemies/FinalBoss.as:52 (setHitbox) + :46 (the ctor half-tile)',
});

export const PRESS_BOX_OVERRIDES = Object.freeze({
    Spinner: SPINNER_PRESS_BOX,
    LightPole: LIGHTPOLE_PRESS_BOX,
    Watcher: WATCHER_PRESS_BOX,
    FinalBoss: FINAL_BOSS_PRESS_BOX,
});

/**
 * ⚠ THE CLASSES WHOSE `tSet` THE CONSTRUCTOR DECIDES, not the `.oel`.
 *
 * `ShieldLock`'s ctor is `super(_x, _y, -2, _tag, ...)`
 * (`Puzzlements/ShieldLock.as:26`) and `Game.as:2144-2145` builds it as
 * `new ShieldLock(o.@x, o.@y, o.@tag, 0|1)` — the group is never passed,
 * so no `tset` attribute can reach it. Nothing else in `Puzzlements/`
 * hardcodes one (checked every `super(` call).
 *
 * It is a table rather than an `if` because reading `tset` off the
 * attributes is the DEFAULT and the exception has to be looked up in one
 * place by all three of its consumers — the despawn test, the presser
 * list and the responder list. R2 shipped it as an `if`-less default and
 * got both halves wrong at once: a `shieldlock` joined group 0 (so a
 * button 176 px away "opened" it) and it stopped despawning on a cleared
 * flag (because `int("") = 0` is not `< 0`). Both are corrected by this
 * one lookup, which is the fourth time in this arc an index or a column
 * has been read against the wrong table.
 *
 * ⛔⛔ **R5 SLICE 10: THE SENTENCE "Nothing else in `Puzzlements/`
 * hardcodes one (checked every `super(` call)" WAS FALSE, AND A SHIPPED
 * PREDICTION WAS BUILT ON IT.**
 *
 * `BossLock.as:31` is
 * `super(_x + Tile.w/2, _y + Tile.h/2, Game.bossLocks[_t], -1)` — a
 * literal −1 in the GROUP slot, with `_t` (the key type) one argument to
 * its left, selecting the graphic. `Game.as:2199` builds it as
 * `new BossLock(o.@x, o.@y, o.@keyType, o.@tag)`, so the call site has the
 * `_t`-shaped third argument the sweep was looking for and the hardcoded
 * value is somewhere else entirely. That is how an enumeration that named
 * its own method still missed an instance
 * ([[feedback_kickoff_anchor_duplicate_engines]], on its own sweep).
 *
 * ⛔⛔ **AND IT REFUTES §20.6's keyType-2 ANSWER.** That slice argued
 * `bosslock@480,352` is "an `Activators` in group t = 0", so
 * `buttonroom@272,208`'s `room = -1` latch would publish `activate = true`
 * to it "with no key at all", and concluded **the walk should not collect
 * `bosskey@656,528`**. With the group hard-wired to −1 no publication can
 * reach it: `BossLock.update`'s own probe line — a player on the sill AND
 * `Player.hasKey(2)` — is its only opener. The prediction is a NAMED
 * FAILURE, found at source before L40 was ever driven, and the model had
 * it wrong in the UNSAFE direction: it opened a wall the game keeps shut.
 */
export const FORCED_TSET = Object.freeze({
    shieldlock: -2,       // ShieldLock.as:26
    shieldlocknorm: -2,
    bosslock: -1,         // BossLock.as:31 — the group slot, not `_t`
});

/** The group an entity is in: its class's forced value, else `tset`, else 0. */
export function tSetOf(type, attrs) {
    const forced = FORCED_TSET[type];
    // ⚠ `int("")` is 0, so a MISSING attribute means group 0 rather than
    // "no group" — the line three route locks and thirteen of the fourteen
    // wandlocks turn on.
    return forced === undefined ? intAttr(attrs, 'tset', 0) : forced;
}

/**
 * ⚠ THE SAME TRAP, ONE FIELD OVER: the classes whose persistence TAG the
 * constructor decides.
 *
 * `MoonrockPile`'s ctor ends `tag = 0;` (`Scenery/MoonrockPile.as:23`),
 * discarding the `_tag` it was handed — and the extract's one placement
 * carries no `tag` attribute at all, so reading the attribute gives -1,
 * every persistence reader guards on `tag >= 0`, and the pile looks inert.
 * It is not: with `tag = 0` its `check()` fires on a fresh boot and removes
 * it. Checked against every `tag = ` assignment in `src/`; this is the only
 * one.
 *
 * ⛔⛔ AND "THE ONLY ONE" WAS TRUE ABOUT `tag = ` AND FALSE ABOUT THE
 * FAMILY — R5 slice 11, from the constructor argument-table audit
 * (`probe-seedling-ctor-args`). A tag can also be forced by a LITERAL
 * PARKED IN A SUPER CALL, which no `tag = ` grep reaches, and there are
 * two more of those:
 *
 *   `NPCs/Statue.as:20`  super(…, Game.sprStatues, **-1**, _text, …)
 *   `Stairs.as:20`       super(_x, _y, _to, _px, _py, true, **-1**, …)
 *
 * ⚠⚠ BOTH HAVE A NON-TAG ARGUMENT IMMEDIATELY IN FRONT OF THE LITERAL —
 * a Graphic and a `_show` Boolean — which is the `BossLock` shape exactly
 * (§23.8), and is why three separate slices each found one instance by
 * tripping over it. The audit resolves the whole chain instead.
 *
 * ⚠ THEY ARE INERT AGAINST THE COMMITTED EXTRACT, AND THAT IS THE POINT
 * OF DECLARING THEM. No `statue1`/`statue2`/`stairsup`/`stairsdown`
 * placement in all 116 levels carries a `tag` attribute (checked: their
 * attribute sets are `text,frames` and `flip,to,playerx,playery,sign`), so
 * `tagOf` already answered -1 — by the DATA happening not to say
 * otherwise, not by construction. A tagged stairs added to any future
 * extract would have given the model a persistence tag the game hardcodes
 * away, and `Teleporter.checkDeactivated`'s `tag >= 0` guard means such a
 * stairs can never be deactivated however the flag reads. Declared here so
 * the agreement is structural and the probe can gate it.
 */
export const FORCED_TAG = Object.freeze({
    moonrockpile: 0,        // Scenery/MoonrockPile.as:23
    statue1: -1,            // NPCs/Statue.as:20 — the NPC `_tag` slot, behind the Graphic
    statue2: -1,            // NPCs/Statue.as:20
    stairsup: -1,           // Stairs.as:20 — the Teleporter `_tag` slot, behind `_show`
    stairsdown: -1,         // Stairs.as:20
});

/** An entity's persistence tag: its class's forced value, else `tag`, else -1. */
export function tagOf(type, attrs) {
    const forced = FORCED_TAG[type];
    if (forced !== undefined) return forced;
    return attrs?.tag === undefined ? -1 : Number(attrs.tag);
}

/**
 * R2: what a CLEARED persistence flag does to each class that reads one.
 *
 * Every entry was read at its own `check()` or constructor. The three
 * behaviours are genuinely different and collapsing them into "remove by
 * tag" would be wrong three ways:
 *
 *   'despawn'  `FP.world.remove(this)` — the entity is gone
 *   'shrink'   `RopeStart.check()` calls `hit()`, NOT remove, and `hit()`
 *              runs `setHitbox(16, 16, 8, 8)` — a 7-tile span becomes a
 *              one-cell solid at its start
 *   'arm'      `FallRock`/`FallRockLarge` are parked at y = -16/-32 with
 *              `type = ""` WHILE the flag holds. Clearing one builds it
 *              FALLEN, Solid and live. A clear here ADDS a blocker.
 *   'trigger'  `Teleporter.checkDeactivated()` is
 *              `tag >= 0 && (!checkPersistence(tag) == invert)`, so a
 *              clear turns a non-inverted tagged teleporter ON and an
 *              inverted one OFF. A clear can open a door.
 *
 * ⚠ `lock`, `wandlock` and `grasslock` despawn ONLY when `tSet < 0`
 * (`Lock.as:42`), and `o.@tset` on a missing attribute is `int("") = 0` —
 * so the DEFAULT is group 0, not "no group". Three locks and thirteen of
 * the fourteen wandlocks on the R1 route do not despawn for that reason,
 * and the R2 brief's census said they all did.
 *
 * ⚠⚠ AND THE TABLE IS THE WHOLE ANSWER FOR A CLEARED TAG, so it has to
 * cover EVERY class that reads one. `grep -rn checkPersistence src/` finds
 * far more than the five behaviours above: every PICKUP removes itself, a
 * `MoonrockPile` does the OPPOSITE of a FallRock (it exists only while the
 * flag is false), a `ButtonRoom` boots ALREADY PRESSED, a `Watcher` stops
 * updating. The first cut of this table listed twenty tags and the
 * derivation would happily have cleared a tag a pickup shared — the game
 * would remove the pickup, the model would keep its avoid volume, and
 * nothing anywhere would say so. `buildLevelWorld` therefore refuses a
 * clear that reaches ANY entity with no declared response; the four
 * REFUSED responses below are the ones that are declared and still
 * refused, because modelling them is a rung's work rather than a line's.
 */
export const PERSISTENCE_RESPONSE = Object.freeze({
    chest: 'despawn',                 // Chest.as:41
    breakablerock: 'despawn',         // BreakableRock.as:50
    breakablerockghost: 'despawn',    // BreakableRock.as:50
    burnabletree: 'despawn',          // BurnableTree.as:59 -> die()
    bosslock: 'despawn',              // BossLock.as:43 (extends Activators, no tSet test)
    rocklock: 'despawn',              // RockLock.as:34
    magicallock: 'despawn',           // MagicalLock.as:51 (extends Entity, no tSet)
    magicallockfire: 'despawn',       // MagicalLock.as:51
    shieldlock: 'lock-despawn',       // Lock.as:42 — ShieldLock forces tSet = -2
    shieldlocknorm: 'lock-despawn',
    lock: 'lock-despawn',             // Lock.as:42 — needs tSet < 0
    wandlock: 'lock-despawn',
    grasslock: 'lock-despawn',
    rope: 'shrink',                   // RopeStart.as:31-38 -> hit()
    fallrock: 'arm',                  // FallRock.as:39-47
    fallrocklarge: 'arm',             // FallRockLarge.as:45-53
    teleporter: 'trigger',            // Teleporter.as:76-79
    stairsup: 'trigger',              // ...but Stairs forces tag = -1, so inert
    stairsdown: 'trigger',

    // ── the classes the first cut of this table missed ────────────────
    // Every one carries a tag somewhere in the extract, so every one could
    // have shared a tag with something the derivation wanted to clear.
    spinner: 'despawn',               // Enemies/Spinner.as:47-54
    lavaboss: 'despawn',              // Enemies/LavaBoss.as:62 — and it IS Solid
    shieldboss: 'despawn',            // Enemies/ShieldBoss.as:56
    /**
     * ⛓⛓ R7 SLICE 6f — THE CLASS THAT MAKES L8's PUZZLE A PERSISTENCE
     * PROBLEM RATHER THAN A COMBAT ONE.
     *
     * `SandTrap.check()` is `if (tag >= 0 && !Game.checkPersistence(tag))
     * FP.world.remove(this)` (`Enemies/SandTrap.as:44-51`) — `Spinner`'s
     * shape one class over — and `removed()` is `super.removed();
     * Game.setPersistence(tag, false)` (`:88-92`), so a sandtrap the room
     * kills WRITES ITS OWN CLEAR and never comes back.
     *
     * ⛔ THAT PAIR IS WHY L8 NEEDS NO NEW VERB. The model owns no Arrow ×
     * Enemy (§16.4, still refused), so it cannot predict the kill — but it
     * does not have to: the kill's DURABLE consequence is a flag, the game
     * writes it, and a v9 `at`-clear carries it to the model at the tick a
     * `phases` block witnessed it. Undeclared, the clear would have thrown
     * by name (which is how this row got written) — the guard below is what
     * turned "L8 is a fight" into "L8 is two clears".
     */
    sandtrap: 'despawn',              // Enemies/SandTrap.as:44-51 (+ :88-92 removed())
    /**
     * ⚠ AND ITS SUBCLASS, BY INHERITANCE RATHER THAN BY ROUTE.
     * `DarkTrap extends SandTrap` (`Enemies/DarkTrap.as:12`) and overrides
     * neither `check()` nor `removed()`, so the row above IS its row. No
     * segment on this rung clears one — the seven placements are in L62–L65
     * — and it is declared anyway because the alternative is a throw in a
     * later rung whose cause is two files away.
     */
    darktrap: 'despawn',              // Enemies/DarkTrap.as:12 -> SandTrap.check()
    moonrock: 'despawn',              // Scenery/Moonrock.as:60
    finaldoor: 'despawn',             // Scenery/FinalDoor.as:36
    // ⚠ A PICKUP REMOVES ITSELF ON A CLEARED FLAG, with `doActions = false`
    // so nothing is granted. Its avoid volume goes with it. Clearing one is
    // legal and merely wasteful (R2's grants are property writes and never
    // touch the pickup), but it MUST be declared: undeclared, the game
    // would remove it while the model went on routing around it.
    sword: 'despawn',                 // Pickups/Sword.as:35
    darksword: 'despawn',             // Pickups/DarkSword.as:35
    wand: 'despawn',                  // Pickups/Wand.as:46
    ghostsword: 'despawn',            // Pickups/GhostSword.as:34
    ghostspear: 'despawn',            // Pickups/GhostSpear.as (Pickup.check)
    feather: 'despawn',               // Pickups/Feather.as:33
    shield: 'despawn',                // Pickups/Shield.as:34
    darkshield: 'despawn',            // Pickups/DarkShield.as:33
    darksuit: 'despawn',              // Pickups/DarkSuit.as:33
    conch: 'despawn',                 // Pickups/Conch.as:33
    health: 'despawn',                // Pickups/HealthPickup.as:38
    torchpickup: 'despawn',           // Pickups/Torch.as (Pickup.check)
    firewand: 'despawn',              // Pickups/FireWand.as (Pickup.check)

    // ── declared, and REFUSED ─────────────────────────────────────────
    // ⚠ `MoonrockPile` is a FallRock in a mirror: `check()` removes it while
    // the flag is TRUE ("false = there, true = not there", its own comment),
    // so a fresh boot has none and a CLEAR builds a 32x16 Solid. Its ctor
    // also forces `tag = 0` (`Scenery/MoonrockPile.as:23`) whatever the .oel
    // says — the second forced constructor value in this file. One exists,
    // in L2, which is the third level of the walk.
    moonrockpile: 'appear',           // Scenery/MoonrockPile.as:23-32
    // ⚠ `ButtonRoom` reads `_active = !checkPersistence(tag)`
    // (`Puzzlements/ButtonRoom.as:43`), so a cleared tag boots it ALREADY
    // PRESSED and its group starts fading from frame one. `activators.js`
    // presses on the player alone and would report those locks shut for the
    // whole run.
    buttonroom: 'press',              // Puzzlements/ButtonRoom.as:43
    // `Watcher.update` runs `super.update()` only while the flag holds
    // (`NPCs/Watcher.as:62-66`), so a clear SILENCES it — the talk circle
    // stops firing. Harmless in itself, and the model keeps pricing the
    // circle, which over-avoids in the safe direction. Allowed, recorded.
    watcher: 'silence',               // NPCs/Watcher.as:44-66
    // `LightPole.activate = !checkPersistence(tag)` drives a light radius;
    // its type is "LightPole", which is in no solids list, and nothing this
    // model consults reads `activate`.
    lightpole: 'cosmetic',            // Scenery/LightPole.as:50
    // `Oracle` picks which of two strings it says. Its collider does not move.
    oracle: 'cosmetic',               // NPCs/Oracle.as:26
});

/**
 * ⛔⛔⛔ R7 SLICE 6f — ONE BODY, ONE ANSWER: does a CLEARED tag take this
 * entity out of the world?
 *
 * This predicate existed inline in `buildLevelWorld`'s entity loop and
 * NOWHERE ELSE, and that is the defect it was extracted to fix. The loop
 * builds `solids`, `activators`, `pickups` and every other derived list; the
 * COMBAT CENSUS is built separately, from the RAW `levelRecord`, by
 * `combatCensusOf`. So a cleared `sandtrap` vanished from the geometry and
 * STAYED in the census — gone for the route and present for the contact
 * test, which is `levelRun`'s throw-on-`mover` and the hazard pricing both.
 *
 * ⛓ §19.3 wrote the rule for the v10 field ("the removal edits the LEVEL
 * RECORD, not any one list the world derives") and this is the same rule
 * arriving from the v9 side: a body must not be able to be gone for one
 * list and present for another. L8 is where it bit — its two sandtraps are
 * removed by the clears their own deaths write, and the walk goes straight
 * down the column they stand in.
 *
 * ⚠ IT IS DELIBERATELY NARROWER THAN "the tag is cleared". `lock-despawn`
 * needs `tSet < 0` (`Lock.as:42`), an `arm` class is BUILT by a clear, and
 * `appear`/`press`/`silence`/`cosmetic`/`trigger` classes stay. The loop
 * below keeps its own throw for an UNDECLARED response, because that check
 * is about the table's completeness rather than about this entity.
 */
export function clearedAwayByTag(e, clearedTags) {
    if (!clearedTags) return false;
    const entityTag = tagOf(e.type, e.attrs);
    if (!(entityTag >= 0) || !clearedTags.has(entityTag)) return false;
    const response = PERSISTENCE_RESPONSE[e.type];
    if (response === 'despawn') return true;
    if (response === 'lock-despawn') return tSetOf(e.type, e.attrs) < 0;
    return false;
}

/**
 * ⛓ R5 slice 4: WHAT A HELD ITEM DOES AT LEVEL-BUILD TIME.
 *
 * A persistence flag is not the only thing that decides whether an entity
 * exists. `Karlore.added()` is four lines:
 *
 *     override public function added():void {
 *         super.added();
 *         if (Player.hasFire) FP.world.remove(this);
 *     }
 *
 * `added()` runs from `World.updateLists`, i.e. inside the frame that
 * `new Game(48, ...)` builds — so the level the game builds is a function
 * of the inventory at CONSTRUCTION, and `buildLevelWorld` had no idea. That
 * is what made `r5-karlore-fire` a declared divergence: the model pinned
 * against a plug the game had already removed.
 *
 * ⚠ THE ITEM MUST BE BANKED BEFORE THE BUILD, and that is a property of the
 * RUN rather than of this table (§15.8). A grant naming the level it boots
 * into, or naming the level a walk ENTERS, is applied after `new Game` —
 * so it cannot reach any `added()` in that level. **A boot is not an
 * entry.** `levelRun` passes the inventory it holds at the instant it
 * builds each world, which is exactly the instant the game constructs its
 * `Game`, and rebuilds a memoised world when that inventory has moved.
 *
 * ── ⛔ THE ENUMERATION, AND THE ONE THE KICKOFF GOT WRONG ─────────────
 *
 * §15.10 recorded this as "a small table (one entity class today)". A
 * sweep of every constructor and `added()` in `src/` that reads a
 * `Player.has*`/`Player.can*` finds **TWO**, and only one of them is a
 * removal:
 *
 *   `NPCs/Karlore.as:27-33`     `added()`, `FP.world.remove(this)` — REAL,
 *                               and it is this table's only entry.
 *   `Enemies/BobBoss.as:35-43`  the CONSTRUCTOR, same two lines — and it
 *                               is a **NO-OP**. `Game.as:2120` is
 *                               `add(new BobBoss(...))`: the constructor
 *                               runs to completion before `add`, so at the
 *                               moment it calls `FP.world.remove(this)` the
 *                               entity's `_world` is still null, and
 *                               `World.remove` opens with
 *                               `if (e._world !== this) return e`. Nothing
 *                               is removed. What the guard DOES do is
 *                               `return` out of the rest of the
 *                               constructor, so a fire-holding player who
 *                               re-enters L32 gets three BobBosses with no
 *                               `bossType`, no weapon and no boss music —
 *                               present, and differently broken. Modelling
 *                               that as a removal would be wrong in the
 *                               most expensive direction: the model would
 *                               walk through a room the game still fills.
 *
 * ⚠ SO THE TABLE IS BY CLASS AND BY CITATION, never "an NPC that reads an
 * item" (`feedback_coincidental_predicate_rots`) — the predicate that would
 * read naturally here is exactly the one that sweeps in BobBoss.
 *
 * Each entry: `property` is the inventory mirror's own field name (the
 * `ITEM_PROPERTIES` shape `levelRun` keeps), `cite` is where it was read.
 */
export const ADDED_TIME_REMOVAL = Object.freeze({
    karlore: Object.freeze({
        property: 'hasFire',
        cite: 'NPCs/Karlore.as:27-33 — added(), FP.world.remove(this)',
        why: 'the one-tile Solid plugging L48\'s corridor north out of the arrival. '
            + '`NPC`\'s ctor sets type = "Solid" and Karlore\'s own setHitbox(16,16,8,8) '
            + 'fills tile (7,17), so `fire` is never SPENT here — it is HELD, and the '
            + 'level simply builds without him.',
    }),
});

/** The item properties any level's build can depend on. */
export const ADDED_TIME_PROPERTIES = Object.freeze([
    ...new Set(Object.values(ADDED_TIME_REMOVAL).map((d) => d.property)),
]);

/**
 * The build-affecting slice of an inventory mirror, as a comparable key.
 *
 * ⚠ A WORLD IS MEMOISED AND AN INVENTORY IS NOT. `new Game(n, ...)` re-runs
 * every `added()` on every visit, so a level first entered without `fire`
 * and re-entered with it is built TWICE and differently — and a memo keyed
 * on the level alone would serve the first build to the second visit. This
 * is what `levelRun` compares to decide whether its memo is still the world
 * the game would construct.
 */
export function addedTimeKey(inventory) {
    return ADDED_TIME_PROPERTIES.map((p) => `${p}=${inventory?.[p] === true ? 1 : 0}`).join(',');
}

/**
 * The declared responses a clear list may NOT name, and why in one line.
 *
 * Declared-and-refused is a different thing from unclassified: these are
 * read, cited and understood, and modelling them is a rung's work.
 */
/**
 * Classes a derived clear list will not name, even though their response
 * IS modelled — because the ruled crutch is narrower than the mechanism.
 *
 * R2's persistence clear stands in for "interactive blockers the bot
 * cannot yet operate" (locks, breakable rocks, ropes, burnable trees).
 * `Game.checkPersistence` is not that narrow: the same flag despawns a
 * pickup and a boss. Clearing either would work, and would be a rung's
 * crutch smuggled in through a derivation nobody re-read — an enemy
 * removed is R5's subject and an item removed is the game's own state.
 */
export const CLEAR_EXCLUDED = Object.freeze({
    sword: 'a pickup — the game\'s item, not a blocker',
    darksword: 'a pickup — the game\'s item, not a blocker',
    wand: 'a pickup — the game\'s item, not a blocker',
    ghostsword: 'a pickup — the game\'s item, not a blocker',
    ghostspear: 'a pickup — the game\'s item, not a blocker',
    feather: 'a pickup — the game\'s item, not a blocker',
    shield: 'a pickup — the game\'s item, not a blocker',
    darkshield: 'a pickup — the game\'s item, not a blocker',
    darksuit: 'a pickup — the game\'s item, not a blocker',
    conch: 'a pickup — the game\'s item, not a blocker',
    health: 'a pickup — the game\'s item, not a blocker',
    torchpickup: 'a pickup — the game\'s item, not a blocker',
    firewand: 'a pickup — the game\'s item, not a blocker',
    spinner: 'an ENEMY — despawning one is R5, not a blocker crutch',
    lavaboss: 'an ENEMY (and a Solid) — despawning one is R5, not a blocker crutch',
    shieldboss: 'an ENEMY — despawning one is R5, not a blocker crutch',
    moonrock: 'it WRITES persistence(0, false, 2) across levels (Moonrock.as:135) — '
        + 'the endgame namespace is untouchable',
    finaldoor: 'the ENDGAME door (FinalDoor.as:36) — untouchable',
});

/**
 * `(level, tag)` pairs no clear list may name, whatever carries them.
 *
 * `FinalDoor.as:50` reads `!checkPersistence(0, 114)` — "0 is the tag for
 * the Watcher's text, while 114 is the room that it refers to", in its own
 * comment — from level 113. So the flag that decides whether the ending
 * opens lives in a level nothing else on any route cares about, under a
 * tag that looks exactly like every other NPC dialogue flag. Named here so
 * it can never be reached by a derivation.
 */
export const UNTOUCHABLE_CLEARS = Object.freeze([
    Object.freeze({
        level: 114,
        tag: 0,
        why: "the Watcher flag FinalDoor reads as \"talked to the Watcher\" "
            + '(FinalDoor.as:50)',
    }),
]);

export const REFUSED_CLEAR_RESPONSES = Object.freeze({
    arm: 'clearing it does not remove it — it BUILDS IT FALLEN, Solid and live, '
        + "and its update writes the player's y",
    appear: 'it exists ONLY while its flag is false, so a clear ADDS a 32x16 Solid '
        + 'that a fresh boot does not have',
    press: 'a cleared tag boots it ALREADY PRESSED, so its whole Activators group '
        + 'starts fading from frame one — which `activators.js` does not model',
});

/**
 * The `(level, tag)` clears a level OFFERS, derived from its own entities.
 *
 * ⚠ DERIVED, NEVER AUTHORED. The R2 clear list is ~40 pairs of numbers, and
 * a hand-written one is unreviewable — the brief's own census got it wrong
 * three ways (it said 36 locks despawn when 16 do; it missed `chest`
 * entirely; it called a rope a despawn when it shrinks). So the list is
 * computed from the extract, every entry names the blocker it removes, and
 * the ones that are REFUSED are returned too, with the reason, rather than
 * silently absent. An empty findings list and a clean pass look identical;
 * a refusal that is not printed is a bounded sweep that did not say what
 * it bounded.
 *
 * A tag is offered when clearing it removes or shrinks at least one thing
 * the walk would otherwise have to go around — a solid, a pixelmask, a
 * pickup volume or a proximity hazard. A tag carried only by a teleporter
 * or a lightpole is not a blocker and is not offered: a clear that opens a
 * door nobody asked to open is a route change nobody reviewed.
 *
 * @returns {{offered: Array<{level, tag, note, removes}>,
 *            refused: Array<{level, tag, why}>}}
 */
export function persistenceClearsFor(levelRecord) {
    const level = levelRecord.level;
    const byTag = new Map();
    for (const e of levelRecord.entities ?? []) {
        const tag = e.attrs?.tag === undefined ? -1 : Number(e.attrs.tag);
        if (!(tag >= 0)) continue;
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push(e);
    }
    const offered = [];
    const refused = [];
    for (const [tag, entities] of [...byTag.entries()].sort((a, b) => a[0] - b[0])) {
        const untouchable = UNTOUCHABLE_CLEARS
            .find((u) => u.level === level && u.tag === tag);
        if (untouchable) {
            refused.push({ level, tag, why: untouchable.why });
            continue;
        }
        const unclassified = entities.filter((e) => !PERSISTENCE_RESPONSE[e.type]);
        if (unclassified.length > 0) {
            refused.push({
                level,
                tag,
                why: `${[...new Set(unclassified.map((e) => e.type))].join(', ')} `
                    + 'has no declared persistence response',
            });
            continue;
        }
        const blocked = entities
            .map((e) => ({ e, response: PERSISTENCE_RESPONSE[e.type] }))
            .find(({ response }) => REFUSED_CLEAR_RESPONSES[response]);
        if (blocked) {
            refused.push({
                level,
                tag,
                why: `${blocked.e.type}@${blocked.e.x},${blocked.e.y} — `
                    + `${REFUSED_CLEAR_RESPONSES[blocked.response]}`,
            });
            continue;
        }
        // ⚠ A CLEAR IS A FLAG, NOT AN ENTITY: it reaches everything in the
        // level carrying that tag. So one excluded class refuses the whole
        // tag — a clear that took a lock away and an item with it would be
        // outside the ruled crutch even though only the lock was wanted.
        const excluded = entities.find((e) => CLEAR_EXCLUDED[e.type]);
        if (excluded) {
            refused.push({
                level,
                tag,
                why: `${excluded.type}@${excluded.x},${excluded.y} is `
                    + `${CLEAR_EXCLUDED[excluded.type]}`,
            });
            continue;
        }
        // What the clear actually BUYS: the entities that stop being in the
        // way. A `lock` only counts when its `tSet` is negative, which is
        // the same test `buildLevelWorld` applies.
        const removes = entities.filter((e) => {
            const response = PERSISTENCE_RESPONSE[e.type];
            if (response === 'lock-despawn') return tSetOf(e.type, e.attrs) < 0;
            if (response === 'shrink') return true;
            if (response !== 'despawn') return false;
            const cls = ENTITY_CLASSES[e.type];
            return Boolean(cls && (
                (cls.collider && cls.collider !== 'none') || cls.hazard));
        });
        if (removes.length === 0) continue;
        offered.push({
            level,
            tag,
            removes: removes.map((e) => `${e.type}@${e.x},${e.y}`),
            note: removes.map((e) => `${e.type}@${e.x},${e.y}`).join(', '),
        });
    }
    return { offered, refused };
}

/** Layer names `loadlevel` knows how to build. Anything else throws. */
const KNOWN_LAYERS = Object.freeze(['tiles', 'cliffsides']);

/**
 * `CliffSide` is built from the `<cliffsides>` LAYER rather than from
 * `<objects>` (`Game.as:2009-2015`), so it gets its own entry.
 *
 * ⚠ CORRECTION to the v2 brief §2.2, which called it "a plain `Solid`
 * Entity". It IS `type = "Solid"`, but its collider is a **Pixelmask**
 * (one of five 16x16 masks picked by the tileset column) and it calls
 * `setHitbox` never — so its Hitbox is 0x0. A model that read "Solid" and
 * used the hitbox would give every cliffside a ZERO-SIZE rect and collide
 * with none of them: silent, and exactly wrong. It belongs in the
 * pixelmask seam. Level 0 has no cliffsides layer; level 94 has 9.
 */
export const CLIFFSIDE_CLASS = Object.freeze({
    as3: 'CliffSide', collider: 'pixelmask', type: 'Solid',
    dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
    src: 'Scenery/CliffSide.as:15-34 + assets/graphics/CliffSideMask*.png (all 16x16)',
});

/**
 * ⚠ WHICH of the five cliffside masks a placement uses is chosen by the
 * `<cliffsides>` row's THIRD COLUMN, and v2 dropped it.
 *
 * `Game.as:2013` is `add(new CliffSide(o.@x, o.@y, Math.floor(o.@tx / Tile.w)))`
 * and `CliffSide.as:19-32` is a `switch(frame)` over exactly this order,
 * with the `default` arm (frame >= 4, or a negative) taking the U mask. The
 * extract records `[x, y, tx, ty]` with `tx` raw, so the index is
 * `floor(tx / 16)` — 0, 16, 32, 48, 64 in the committed data.
 *
 * While every cliffside was a bounding rect the column did not matter: all
 * five masks are 16x16, so all five bounding boxes are the same cell. It
 * matters now, and it is the fourth time in this arc that an index has been
 * read against the wrong table — hence a named table rather than an inline
 * `[a, b, c][i]`.
 */
export const CLIFFSIDE_FRAME_MASKS = Object.freeze([
    'CliffSideMaskL',    // frame 0
    'CliffSideMaskR',    // frame 1
    'CliffSideMaskLU',   // frame 2
    'CliffSideMaskRU',   // frame 3
    'CliffSideMaskU',    // frame 4 and the `default` arm
]);

/** The CliffSide class for one `<cliffsides>` placement's tileset column. */
export function cliffSideClassFor(txPixel) {
    const frame = Math.floor(txPixel / TILE_SIZE);
    // `default:` in the AS3 switch, i.e. anything not 0..3, is the U mask.
    const name = (frame >= 0 && frame < 4)
        ? CLIFFSIDE_FRAME_MASKS[frame] : CLIFFSIDE_FRAME_MASKS[4];
    return Object.freeze({ ...CLIFFSIDE_CLASS, mask: name, frame });
}

/**
 * ⚠ A RECT CARRIES ITS OWN `right`/`bottom`, and `rectsOverlap` READS THEM.
 * A `{x, y, w, h}` literal handed to `rectsOverlap` therefore compares
 * against `undefined` and is SILENTLY never overlapping — which is a
 * check that cannot fail, not a check that passes. R1 shipped exactly that
 * bug in its persistence-effect volume and the GAME found it: the model
 * walked the player straight through an armed FallRock while both the
 * planner and the executor reported the route clear. Build every rect
 * through this, and see `assertRect`.
 */
export const rect = (x, y, w, h) => ({ x, y, w, h, right: x + w, bottom: y + h });

/**
 * Loud guard for a rect that arrives from outside this module. The failure
 * it prevents is invisible by construction, so it is worth a throw.
 */
export function assertRect(r, what) {
    if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)
        || !Number.isFinite(r.right) || !Number.isFinite(r.bottom)) {
        fail(`${what} is not a rect: ${JSON.stringify(r)}. `
            + '`rectsOverlap` reads `right`/`bottom`, so a {x,y,w,h} literal never '
            + 'overlaps anything and every check against it silently passes. Build '
            + 'it with `levelWorld.rect(x, y, w, h)`.');
    }
    return r;
}

/**
 * FlashPunk's overlap test (`Entity.collideRect`) — a STRICT half-open
 * comparison, so rects that merely touch do NOT collide.
 */
export function rectsOverlap(a, b) {
    return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

/**
 * ── THE PIXELMASK TEST, transcribed from the two places it actually lives ──
 *
 * R2 slice 1. The seam v2 threw at is a model now, and it is a model of a
 * chain that crosses a language boundary, so both halves are cited.
 *
 * **Which AS3 function runs.** `Entity.collideWith` takes the `!_mask`
 * branch for the Player (which uses `setHitbox`, never `mask`) and calls
 * `e._mask.collide(HITBOX)`. `Entity.HITBOX` is
 * `private const HITBOX:Mask = new Mask` (`Entity.as:515`) — a plain
 * **`Mask`**, NOT a `Hitbox` — so `Mask.collide` dispatches `_check[Mask]`,
 * which `Pixelmask`'s constructor set to its own **`collideMask`**, not
 * `collideHitbox`. The rect handed to `hitTest` is therefore the PLAYER
 * ENTITY's own box, `[x - originX, +width) x [y - originY, +height)`.
 *
 * **What the runtime does with it.** `BitmapData.hitTest` here is
 * SWFRecomp's `bd_hit_test` (`SWFModernRuntime/src/avm2/avm2_bitmap.c`):
 * the mask origin goes through `avm2_coerce_to_i32`, the rect's x/y/w/h are
 * read as doubles and **cast to `int32_t`, which truncates TOWARD ZERO**
 * (not `floor`), and the scan is `[x_min, x_max) x [y_min, y_max)` clamped
 * to the mask, returning true on the first pixel with
 * `alpha >= threshold` — and `Pixelmask.threshold` is declared `1`, so any
 * non-transparent pixel collides.
 *
 * ⚠ **The bounding pre-test in `collideWith` does NOT truncate.** It is a
 * float comparison against the entity's bounds, which for a mask-carrying
 * Entity are the MASK's (assigning a `Pixelmask` runs `Hitbox.update`,
 * which rewrites `parent.originX/originY/width/height`). So a box can pass
 * the float bbox test and then be truncated onto a different pixel column.
 * Both halves are here, in that order, because that is the order they run.
 *
 * @param mask  a `SEEDLING_PIXEL_MASKS` entry
 * @param mx,my where the mask's top-left pixel sits in world coordinates
 * @param box   the player's box, from `rect()`
 */
export function maskHitsBox(mask, mx, my, box) {
    // 1. `Entity.collideWith`'s float bounding test against the mask bbox.
    if (!(box.x < mx + mask.w && box.right > mx
        && box.y < my + mask.h && box.bottom > my)) return false;
    // 2. `bd_hit_test`'s integer scan. `Math.trunc` IS the C cast.
    const rx = Math.trunc(box.x) - mx;
    const ry = Math.trunc(box.y) - my;
    const w = Math.trunc(box.right - box.x);
    const h = Math.trunc(box.bottom - box.y);
    const x0 = Math.max(0, rx);
    const x1 = Math.min(mask.w, rx + w);
    const y0 = Math.max(0, ry);
    const y1 = Math.min(mask.h, ry + h);
    for (let y = y0; y < y1; y++) {
        const row = mask.rows[y];
        for (let x = x0; x < x1; x++) if (row[x] === '#') return true;
    }
    return false;
}

/**
 * The mask a placed pixelmask entity presents, and where its top-left sits.
 *
 * Kept apart from `maskHitsBox` because the two answer different questions:
 * this one is the class's CONSTRUCTOR CHAIN (which picture, at what offset
 * from the oel coordinates), the other is FlashPunk's arithmetic. Two
 * classes read the same picture from different origins, which is exactly
 * the kind of thing that gets collapsed when one function owns both.
 *
 * ⚠ The fields are `maskX`/`maskY`, not `x`/`y`, because every caller
 * spreads this into a record that ALREADY has an `x` and a `y` — the
 * ENTITY's. R1 shipped a `{to: b, ...label}` whose label carried its own
 * `to` and spent an afternoon on "NO PATH from a graph that has one".
 */
export function maskPlacement(cls, x, y) {
    const mask = SEEDLING_PIXEL_MASKS[cls.mask];
    if (!mask) {
        fail(`${cls.as3} declares collider "pixelmask" but its mask "${cls.mask}" is not in `
            + 'seedlingPixelMasks.js. Regenerate with '
            + 'scripts/procgen/extract-seedling-masks.mjs, or leave the entry without a '
            + '`mask` field so the loud-throw seam still covers it.');
    }
    return { mask, maskX: x + cls.dx, maskY: y + cls.dy };
}

/**
 * The world rect an entity class occupies when placed at oel (x, y).
 *
 * ⛔ R5 SLICE 8: IT ASSERTS ITS OWN OUTPUT, and that is the whole point of
 * this slice's step 0. Nothing about the three additions below is wrong;
 * what went wrong TWICE is that a caller handed in a class with no box —
 * the node-terminated `rope` (slice 7) and the `Watcher` (this one) — and
 * `x + undefined` came out the far side as a shape that type-checks,
 * prints plausibly, and answers every `rectsOverlap` question "no". Both
 * were ALSO refused by policy, so both read as a clean audit from every
 * other angle. The absent INPUT is the unit of audit; this is the backstop
 * that makes it loud. See `feedback_rect_literal_never_overlaps`.
 */
export function entityRect(cls, x, y) {
    const r = rect(x + cls.dx - cls.originX, y + cls.dy - cls.originY, cls.w, cls.h);
    if (!Number.isFinite(r.right) || !Number.isFinite(r.bottom)
        || !Number.isFinite(r.x) || !Number.isFinite(r.y)) {
        fail(`entityRect("${cls.as3 ?? cls.type ?? '?'}") at (${x},${y}) built `
            + `${JSON.stringify(r)} — a class with no box (dx/dy/w/h/originX/originY: `
            + `${cls.dx}/${cls.dy}/${cls.w}/${cls.h}/${cls.originX}/${cls.originY}). `
            + 'A rect with a non-finite edge NEVER OVERLAPS ANYTHING, so every '
            + 'query against it silently answers "no" — a check that cannot fail, '
            + 'not one that passes. Either the class needs its hitbox '
            + 'transcribed, or this caller needs a per-class press box the way '
            + '`LIGHTPOLE_PRESS_BOX` and `WATCHER_PRESS_BOX` are.');
    }
    return r;
}

/**
 * The `rope` collider's rect — the ONE whose width is placement data.
 *
 * `RopeStart`'s constructor is `setHitbox(_xend - _x + 16, 16, 8, 8)` with
 * `_xend` taken from the entity's last `<node>` (`Game.as:2201-2210`), and
 * `hit()` shrinks it to `setHitbox(16, 16, 8, 8)` — so a CLEARED rope is a
 * one-cell solid at the span's start rather than open floor.
 *
 * ⛔ EXTRACTED INTO A FUNCTION AT R5 SLICE 7 because there were two
 * consumers and only one of them had the code. The blocking role built
 * this rect; the PRESS census called `entityRect`, which reads `cls.w` —
 * absent for a node-terminated class — and produced `{right: null}`. A
 * rect with a null `right` never overlaps anything, so the rope was
 * invisible to `pressRespondersIn`: the arm was refused by policy AND
 * unreachable by geometry, and either one alone reads as a clean audit.
 */
export function ropeSpanRect(e, cls, x, y, entityTag, clearedTags, where) {
    const last = e.nodes?.[e.nodes.length - 1];
    if (!last) {
        fail(`${where} has a "${e.type}" at (${x},${y}) with no <node> child. `
            + 'Its collider spans from its own x to that node\'s, so it cannot be '
            + 'built without one. Re-extract the atlas with '
            + 'scripts/procgen/extract-seedling-map.mjs, which records nodes.');
    }
    const w = clearedHere2(e, entityTag, clearedTags) ? TILE_SIZE : last.x - x + TILE_SIZE;
    return rect(x + cls.dx - cls.originX, y + cls.dy - cls.originY, w, cls.h);
}

function intAttr(attrs, name, fallback) {
    const raw = attrs?.[name];
    if (raw === undefined || raw === null || raw === '') {
        if (fallback === undefined) fail(`teleporter is missing required attribute "${name}"`);
        return fallback;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) fail(`teleporter attribute "${name}" is not an integer: ${raw}`);
    return n;
}

/**
 * Build the collision/terrain world for one level record from the
 * committed extract.
 *
 * ⚠ The extract is TILE-space for tiles and PIXEL-space for entities: a
 * `[x, y, tx, ty]` row has x/y in TILES and `tx` as a pixel offset into
 * the tileset strip, while an entity's x/y are raw pixels. Mixing them is
 * the easiest way to build a world that is 16x wrong in one place only.
 *
 * ⛓ `inventory` is the run's ITEM MIRROR AT CONSTRUCTION TIME (R5 slice 4),
 * and it is optional only because most callers are asking a question no
 * item can change. `ADDED_TIME_REMOVAL` is what reads it: an entity whose
 * `added()` removes itself on a held item is simply not built. Omitting it
 * builds the level a fresh save sees, which is what every caller before
 * this got and still gets.
 */
/**
 * ⛔⛔⛔ THE THIRTEEN PER-VISIT GEOMETRY KEYS, AS A LIST — AND IT EXISTS
 * BECAUSE THE SAME DEFECT HAS NOW HAPPENED THREE TIMES.
 *
 * R5 slice 14 found `burnedTrees` and `fallenRocks` passed to
 * `playerPhysicsV2.step` and silently DROPPED by its own hand-written
 * destructure; R6 slice 2 found `openMagicalLocks` reaching
 * `liveSolidOpts`, `normalizeLive` and `liveRectOf` — all green — and
 * dropped by the `collides` closure inside the same function; R6 slice 5
 * found `shieldBosses` dropped in exactly that closure, one family later.
 * Every time, the model opened a cell for the PLANNER and left it solid
 * for the PLAYER, and every time the symptom was a walk that stalled on a
 * wall the run says is gone.
 *
 * ⚠ AN UNLISTED KEY IN AN OPTIONS OBJECT IS NOT AN ERROR — IT IS A
 * SILENCE. This list is what a consumer can be CHECKED against, and
 * `playerPhysicsV2` asserts its bag covers it rather than being trusted to
 * have typed thirteen names correctly for a fourth time.
 *
 * ⚠ `normalizeLive` stays a fixed-shape LITERAL rather than being derived
 * from this list: it is allocated per QUERY on the hottest loop in the
 * package and a derived object costs both the loop and V8's monomorphism
 * (§10.10a). `levelWorld.test.js` asserts the two agree, which is the
 * one-table-two-computations shape the rest of this package uses.
 */
export const LIVE_GEOMETRY_KEYS = Object.freeze([
    'openActivators', 'openMagicalLocks', 'openBridges', 'brokenRocks', 'burnedTrees',
    'crushers', 'turrets', 'bosses', 'shieldBosses', 'finalDoors', 'openChests',
    'pulledRopes', 'pushables',
    // ⚠ READ ABOVE THE LOOP, NOT INSIDE IT. A parked `FallRock` is in no
    // `solids` entry at all, so `collidesSolid` handles it ABOVE its own loop
    // and reads `opts.fallenRocks` directly — `liveRectOf` never asks for it.
    // It is a live geometry key all the same, and a consumer that dropped it
    // would walk through a dropped rock. ⛓ R7 SLICE 4: `normalizeLiveOpts`
    // now carries it too, because a normalised bag is handed BACK to the
    // query as its whole options object — see the brand note below.
    'fallenRocks',
]);

/**
 * ⛔⛔⛔ THE BRAND, AND WHY IT IS A SYMBOL — R7 slice 4, paying the
 * `normalizeLive` debt (owed since R6 slice 2; +9.7 % measured there over
 * three interleaved A/B pairs, deferred through four slices since).
 *
 * The cost was never the normalising; it was normalising the SAME bag again
 * for every 1 px probe of every sweep. The hot callers already hoist their
 * bag once per TICK (`levelRun`'s `pushableCtx`/`spinnerCtx` and
 * `playerPhysicsV2.step` all say so in their own comments) and then hand
 * that one object to a query that runs hundreds of times per tick — so the
 * allocation was per PROBE while its input was per TICK.
 *
 * ⛔⛔⛔ AND THE DEBT'S OWN PREMISE IS REFUTED BY THE COUNT. R6 §10.10a
 * attributed a measured +9.7 % to "the per-query ALLOCATION" here, and R7
 * §11.7 carried that forward as "a per-QUERY allocation on the hottest loop".
 * Counted rather than argued, on `r5-l40-part5` — the very tape R6 measured:
 *
 *     normalizeLive calls  31,191        liveRectOf calls  34,705,483
 *
 * **1,113 solids per query.** The allocation this brand removes is under a
 * tenth of a percent of the work, and an interleaved A/B of this change over
 * three tapes (`r5-l40-part1`, `r4-walk-full`, `r5-d5-conch`, median of 3,
 * two passes) sees NOTHING outside noise. ⇒ **this brand is a correctness
 * and shape change, not a speed-up, and it must not be quoted as one.**
 *
 * ⛓ THE REAL LEVER, NAMED WITH ITS NUMBER, for whoever wants the 9.7 % back:
 * `liveRectOf`'s per-SOLID arms. Each new family adds one load and one branch
 * to 34.7 M invocations per tape — which is exactly the size of the effect
 * R6 measured when it added the eleventh key, and R6's own hoisted-boolean
 * experiment (+13.6 %, "worse, and certainly no better") did not exonerate
 * the branch: it added a closure-slot read ON TOP of it. The fix that pays
 * is a per-world PRE-FILTER — a solid with no `magicalLockId` can never take
 * that arm — not another shape for the argument.
 *
 * ⛔ THE OBVIOUS FIX IS REFUTED AND STAYS REFUTED (§11.7): a one-entry cache
 * keyed on the options object's IDENTITY never hits, because the hottest
 * caller of all is `world.collidesSolid(rect, { ...base, pushables:
 * withoutSelf })` — a FRESH literal per probe. The skip cannot be keyed on
 * identity; it has to be keyed on SHAPE, and the shape has to survive that
 * spread. It does: `{ ...branded }` copies own enumerable symbol keys and
 * preserves insertion order, and `pushables` already being a key means the
 * assignment overwrites in place rather than appending. Same brand, same
 * hidden class, and the caller's one allocation instead of two.
 *
 * ⚠ A SYMBOL, NOT A STRING, AND THAT IS THE HAZARD §11.7 NAMED. A brand a
 * caller can type is a brand a caller can type onto a PARTIAL bag, and a
 * partial bag that skips normalisation reads `undefined` where the model
 * promised `null` — the exact silence `LIVE_GEOMETRY_KEYS` exists to end.
 * This symbol is module-private and unexported, so the only way to wear the
 * brand is to have been through the function that fills every key.
 */
const LIVE_NORMALIZED = Symbol('levelWorld.normalizeLiveOpts');

/**
 * ⚠ ONE FIXED SHAPE FOR THE CHAIN'S ARGUMENT, and it is a performance fact
 * rather than a style one. `liveRectOf` reads thirteen keys per solid and the
 * callers hand it option objects of a dozen different shapes (`{}`,
 * `{openActivators}`, the full driver bag…) — V8 turns that into a
 * megamorphic load on the hottest loop in the package. Normalised, the loads
 * are monomorphic; branded, they are normalised ONCE.
 *
 * ⚠ IT CARRIES ALL FOURTEEN `LIVE_GEOMETRY_KEYS` PLUS `beforeTypeFlip`, so a
 * normalised bag is a COMPLETE substitute for the caller's own — the queries
 * destructure `fallenRocks` and `beforeTypeFlip` off `opts` itself, above the
 * loop that reads the normalised thirteen. `levelWorld.test.js` asserts that
 * coverage both ways rather than trusting fifteen names typed by hand for a
 * fifth time.
 *
 * ⚠ UNKNOWN KEYS ARE DROPPED, which is why the brand is applied at the
 * HOISTED bag sites and NOT inside `levelRun.liveSolidOpts`:
 * `plannerBlockerAt` reads `noclip`/`noHazards` off the same argument, and a
 * normaliser that silently ate `noclip` would open every wall in the level to
 * the planner.
 */
export function normalizeLiveOpts(o) {
    if (o[LIVE_NORMALIZED] === true) return o;
    return {
        [LIVE_NORMALIZED]: true,
        openActivators: o.openActivators ?? null,
        openMagicalLocks: o.openMagicalLocks ?? null,
        openBridges: o.openBridges ?? null,
        brokenRocks: o.brokenRocks ?? null,
        burnedTrees: o.burnedTrees ?? null,
        crushers: o.crushers ?? null,
        turrets: o.turrets ?? null,
        bosses: o.bosses ?? null,
        shieldBosses: o.shieldBosses ?? null,
        finalDoors: o.finalDoors ?? null,
        openChests: o.openChests ?? null,
        pulledRopes: o.pulledRopes ?? null,
        pushables: o.pushables ?? null,
        fallenRocks: o.fallenRocks ?? null,
        beforeTypeFlip: o.beforeTypeFlip ?? false,
    };
}

/**
 * Is this bag one `normalizeLiveOpts` filled? For the TESTS, which are the
 * only consumers allowed to ask — the brand itself stays module-private, so
 * that no caller can mint one.
 */
export const isNormalizedLiveOpts = (o) => !!o && o[LIVE_NORMALIZED] === true;

/**
 * ⛔⛔ THE CONSUMER ENTRY'S OWN CHECK — R8 slice 0, paying the rest of the
 * `normalizeLive` debt.
 *
 * Every query that walks `liveRectOf` calls this on the bag it is about to
 * use. It asserts TWO things, and neither is the same claim:
 *
 *   1. **The bag wears the brand.** The symbol is module-private, so wearing
 *      it means having been through `normalizeLiveOpts` — the only function
 *      that fills every key. A bag that reached the loop by another door is
 *      a bag whose missing keys read `undefined` where the model promised
 *      `null`, which is the SILENCE `LIVE_GEOMETRY_KEYS` exists to end.
 *   2. **It covers `LIVE_GEOMETRY_KEYS`, asserted against the LIST.** Not
 *      against a count and not against a roster typed beside this line —
 *      trap 89's lesson is that a hardcoded list next to a mechanism
 *      assertion re-arms the fuse it was written to defuse. A fifteenth
 *      family added to the list is checked here for free.
 *
 * ⚠ IT IS PER QUERY, NOT PER PIXEL, and that is why it is affordable: the
 * counted ratio on `r5-l40-part5` is 31,191 queries against 34,705,483
 * `liveRectOf` invocations, so a fourteen-key pass at the entry is under a
 * tenth of a percent of the same denominator the brand itself lives under.
 *
 * ⛓ WHAT MAKES IT NON-VACUOUS: it fires under a mutation of
 * `normalizeLiveOpts` itself — drop the brand, or drop a key from its fixed
 * literal, and all four consumers red by name in one run. That is the
 * mutation this stratum exists to catch, because that literal is the one
 * place the fourteen names are typed out.
 */
export function assertNormalizedLiveOpts(o, what) {
    if (!isNormalizedLiveOpts(o)) {
        fail(`${what}: the live-geometry options bag reaching this query does not wear `
            + '`normalizeLiveOpts`\' brand. The brand is a module-private Symbol, so a '
            + 'bag without it has not been through the one function that fills every '
            + 'key — and an unlisted key is a SILENCE, not an error: the query would '
            + 'read `undefined` for a per-visit family and treat it as absent.');
    }
    for (const k of LIVE_GEOMETRY_KEYS) {
        if (!(k in o)) {
            fail(`${what}: the normalised live-geometry bag is missing "${k}", which `
                + '`LIVE_GEOMETRY_KEYS` names as a per-visit family. `normalizeLiveOpts` '
                + 'is the one place those fourteen names are written out, so this is a '
                + 'defect in that literal rather than at the call site.');
        }
    }
    return o;
}

export function buildLevelWorld(levelRecord, {
    roles = PRE_R5_ROLES, cleared = null, inventory = null,
} = {}) {
    if (!levelRecord || typeof levelRecord !== 'object') {
        fail('buildLevelWorld needs a level record from seedling-map.json');
    }
    for (const r of roles) {
        if (!ROLES.includes(r)) {
            fail(`buildLevelWorld: unknown role "${r}"; roles are ${ROLES.join(', ')}`);
        }
    }
    const consults = new Set(roles);
    const level = levelRecord.level;
    const where = `level ${level}`;
    // R2: the tags a tape's `persistence` field cleared in THIS level. Every
    // tag it names must be owned by something that reads persistence here —
    // a clear nobody responds to is a line in the audit list that does
    // nothing, and the whole point of the list being derived is that each
    // entry names a blocker.
    const clearedTags = cleared ? new Set(cleared) : null;
    const clearsUsed = new Set();

    const tiles = [];
    const walkableTiles = [];
    const solids = [];
    // Object entities only — the `solids` list minus everything a TILE
    // contributed. It exists for the first-tick type flip (see the query
    // methods' `beforeTypeFlip` option): a Tile is constructed
    // `type = "Tile"` and only becomes `"Solid"` in its own first update,
    // while every object class assigns its type in its CONSTRUCTOR, so on a
    // world's very first live tick the object solids are the whole list.
    const objectSolids = [];
    const pixelmasks = [];
    const teleporters = [];
    // The two R0 roles. Both are AVOID VOLUMES for a relaxed walk rather
    // than anything the physics consults — nothing here changes a tick.
    const pickups = [];
    const proximityHazards = [];
    /**
     * ⛓ R6 SLICE 6b: hazards whose trigger is WORLD ENTRY rather than
     * distance, so there is no avoid volume to compute and a planner has
     * nothing to route around. One class so far (`finalboss`); the list
     * exists so a room that contains one says so out loud instead of
     * looking like a room with no hazard in it at all.
     */
    const entryHazards = [];
    /**
     * ⛓ R6 SLICE 6b: every placed `Watcher`, with the three attributes its
     * dialogue's LENGTH depends on. Eleven in the extract; L114's is the one
     * `{114,0}` hangs off.
     */
    /**
     * ⛓⛓⛓ R6 SLICE 6f: THE OWL and HIS PODS — the FIFTEENTH per-visit family.
     * Rosters rather than solids: `finalboss` and `pod` are both
     * `collider: 'none'`, and what the run holds for them is a fight state
     * and an animation, not a rect. `finalBossFight.js` owns the behaviour.
     */
    const finalBosses = [];
    const pods = [];
    const watchers = [];
    /**
     * ⛓⛓⛓ R6 SLICE 6d: every placed `Oracle`, for the ONE question W-blood
     * has to answer about it — how close did the scripted walk get?
     *
     * ⚠ IT IS NOT A SECOND WATCHER ROSTER even though the class is a
     * sibling, and the difference is the whole reason it is a separate list:
     * a `Watcher`'s dialogue is MODELLED (its length is the window) and an
     * `Oracle`'s is REFUSED (its `doneTalking()` under `Game.cutscene[1]` is
     * `exitToMenu()`, i.e. the end of the run). So this carries the entity
     * point and the tag and NOT the text, because carrying the text would
     * read as an offer to run it.
     * → `endingChain.ORACLE`, `levelRun`'s `oracleApproach`
     */
    const oracles = [];
    // R2: the `Activators` groups. `activators` are the responders that stop
    // being solid while their group is held; `pressers` are the volumes that
    // hold it. Both carry the `t` the game groups them by, read from the
    // entity's own `tset` attribute — and `int("")` is 0, so a MISSING tset
    // means group 0, not "no group". Three route locks and thirteen of the
    // fourteen wandlocks rely on that being read the game's way.
    const activators = [];
    const pressers = [];
    // R4: what a press RECT can contain (see `PRESS_ARMS`), and the enemy
    // roster the press arithmetic is taken over. Both are collected only
    // for a caller that consults `blocking` — the geometry and the `type`
    // the dispatch needs are that role's own transcription, and a
    // relaxed world has neither.
    const pressResponders = [];
    const pressEnemies = [];
    // R4: the blocks a press MOVES. Collected beside the solids they also
    // are, because a pushable is BOTH — a static rect until something hits
    // it and a live one for the 32 ticks afterwards — and `pushables.js`
    // owns the second half. See `PUSHABLE_FAMILIES` for why the family is
    // recorded rather than the class.
    const pushables = [];
    /**
     * ⛔⛔ R5 SLICE 9: THE TWO SOLIDS WHOSE STATE IS NOT AN ACTIVATOR'S.
     *
     * A `Chest` and a `Pulser` are both `type = "Solid"` and both in
     * `solids`, and neither can live in `activators`:
     *
     * - a **chest** stops being solid on `open()`, which no `t` publishes
     *   and no flag expresses — the trigger is a line beneath it and the
     *   gate is its own `collide("Solid")`. It is the join cell of L38
     *   (§21.4), so the run has to be able to say the cell opened;
     * - a **pulser** is solid whether or not its group is published, so
     *   putting it in `activators` would make `collidesSolid` treat an
     *   "open" one as PASSABLE — the geometry would go the unsafe way
     *   (§21.65). What its flag changes is that it starts HITTING.
     *
     * Both are therefore their own lists with their own ids, on the same
     * `pushableId` join the run has used since R4: the geometry is static,
     * the state is the run's.
     */
    const chests = [];
    /** ⛓ R5 slice 12: the level's BurnableTrees, for the burn verb. */
    const burnableTrees = [];
    /**
     * ⛔ R6 slice 2: the level's `MagicalLock`s, `{id, tag, lockType, x, y,
     * ex, ey, rect}` — the roster the wand verb opens.
     *
     * ⚠ ALREADY FILTERED BY `check()`, like `burnableTrees`: a lock whose
     * tag this run has cleared is not built and is in neither list.
     */
    const magicalLocks = [];
    const pulsers = [];
    /** ⛔⛔ R5 slice 10: every `FallRock`/`FallRockLarge`, parked or landed. */
    const fallRocks = [];
    /**
     * ⛔⛔ R5 slice 13: every live `Spinner` — the first ENEMY the run steps.
     *
     * Unconditional, not gated on the `combat` role: see the collection site.
     */
    const spinners = [];
    /**
     * ⛓⛓⛓ R7 slice 6b: every `ArrowTrap` — the SIXTEENTH family's roster.
     *
     * Unconditional and collected above the `collider === 'none'` bail, for
     * the third time and for the same reason: `notSolid` is a verdict about
     * the PLAYER's geometry, and a trap's whole effect is the arrows it
     * spawns. See the collection site for why it is not an `ACTIVATOR_RESPONDER`.
     */
    const arrowTraps = [];
    /**
     * ⛓⛓⛓ R5 SLICE 15: ONE DECISION ABOUT WHETHER A SOLID IS THERE.
     *
     * `collidesSolid` and `plannerBlockerAt` each carried their own copy of
     * the same nine-arm chain — one for every per-visit family — and slice
     * 14's finding was that three hand-written option literals is how one of
     * them quietly acquires a different world (§28.2). This is the same
     * shape one layer down: two hand-written FILTERS, and a ninth family
     * about to be added to both.
     *
     * ⚠ AND A THIRD CONSUMER IS WHAT FORCED IT. A crusher's sight line needs
     * the LIST of live Solids, not a "does this box hit one" predicate, and
     * writing that list from a third copy of the chain is exactly the defect
     * this package spends its comments avoiding.
     *
     * ⚠ IT RETURNS THE RECT ITSELF, NOT A WRAPPER, AND THAT IS A
     * MEASUREMENT. The first cut returned `{rect, live}` and allocated one
     * object PER SOLID PER QUERY — on a loop the player's sweep runs for
     * every 1 px of every step, over 200-2,000 solids. Measured: 2.6s ->
     * 3.6s on `r5-l40-part1`, which pushed eleven long fixtures past the
     * 10 s test timeout and produced eleven reds that looked like defects
     * and were allocation. `at !== s.rect` is what tells the callers a box
     * was SWAPPED, and it needs no wrapper to say so.
     *
     * @returns {null|object} `null` = the entity is not in the world's Solid
     *   list right now; otherwise the box it occupies, which for a mover is
     *   where the RUN left it and not where the level built it.
     */
    const normalizeLive = normalizeLiveOpts;
    const liveRectOf = (s, o) => {
        // R2: a lock or cover whose group is held has `type = ""`, which
        // takes it out of the solids list rather than moving it.
        // `openActivators` is that list, owned by the RUN (`activators.js`)
        // because it is per-tick state and this module builds static
        // geometry.
        if (o.openActivators && s.activatorId && o.openActivators.has(s.activatorId)) return null;
        // ⛔ R6 slice 2: a `MagicalLock` whose destroy animation has WRAPPED.
        // Like a broken rock and unlike a lock-with-a-tSet, it leaves the
        // list entirely (`animEnd` is a bare `FP.world.remove`). ⚠ AND IT
        // IS SOLID FOR THE WHOLE 15-UPDATE ANIMATION — the set must be
        // keyed on `magicalLock.openTick`, never on the hit tick, which is
        // the `BurnableTree` lesson with a smaller number.
        if (o.openMagicalLocks && s.magicalLockId
            && o.openMagicalLocks.has(s.magicalLockId)) return null;
        // R4: a bridge whose timer has run out is `type = "Tile"` — it leaves
        // the solids list and JOINS the walkable ones (see
        // `nearestWalkableTileWithTie`, which takes the same set).
        if (o.openBridges && s.bridgeId && o.openBridges.has(s.bridgeId)) return null;
        // R5: a BreakableRock whose `endAnim` has fired is
        // `FP.world.remove(this)` — off the list entirely, unlike a lock
        // (type "") or a bridge (type "Tile"). Per VISIT: a `tag = -1` rock
        // is rebuilt by the next `new Game`, so this may not be baked into
        // the geometry the way a persistence clear is.
        if (o.brokenRocks && s.rockId && o.brokenRocks.has(s.rockId)) return null;
        // ⛓⛓ R5 SLICE 12: a BurnableTree whose 41-tick animation has
        // completed. `burnEnd -> die()` writes `type = ""` AND calls
        // `FP.world.remove(this)`, so — like a broken rock and unlike a lock
        // — it leaves the list entirely. ⛔ AND IT IS SOLID FOR THE WHOLE
        // BURN: `hit()` starts the animation and removes nothing, so a set
        // keyed on the PRESS tick would open a 2x2 cell forty-one ticks
        // early.
        if (o.burnedTrees && s.treeId && o.burnedTrees.has(s.treeId)) return null;
        // ⛓⛓⛓ R5 SLICE 15: a CRUSHER, which is where the run left it and not
        // where the level built it. The `pushables` arm's shape — and a
        // stronger version of its reason: a block only moves when the player
        // presses, a crusher moves when it can SEE the player, so the spawn
        // rect is wrong from the first tick a bait commits.
        //
        // ⚠ NO `removed` ARM, deliberately. Nothing removes a crusher:
        // `Crusher.as` has no `die()`, no `removed()`, no `check()` and no
        // persistence write of any kind.
        if (o.crushers && s.crusherId && o.crushers.has(s.crusherId)) {
            return o.crushers.get(s.crusherId).rect;
        }
        // ⛔⛔⛔ R5 SLICE 20: AN ICE TURRET, AND IT IS THE ONE ARM THAT NEVER
        // FALLS THROUGH TO `s.rect`.
        //
        // Every family above answers "the level built a solid here; is it
        // still there / where did it go?". This one answers the opposite
        // question, because `IceTurret.type` is "Enemy" from the base ctor
        // and `type = "Solid"` is the else-arm of `if (currentAnim !=
        // "dead")` — so an ALIVE turret is not a solid at all, and a CORPSE
        // is one only from the first tick the player's box is off it.
        //
        // ⇒ absent run state means NOT SOLID, which is the reverse of the
        // `pushables` convention two arms down and is said here rather than
        // left to be inferred. The run's entry carries its own `rect`
        // (16x16, where the RUN left it after the bumps) and its own `solid`
        // latch; nothing else can produce either.
        if (s.turretId) {
            const now = o.turrets ? o.turrets.get(s.turretId) : null;
            return now && now.solid ? now.rect : null;
        }
        // ⛓⛓⛓ R5 SLICE 23: A BOSS TOTEM, and it is the ice turret's arm
        // RUN BACKWARDS. `BossTotem.type` is "Enemy" from the base ctor and
        // `type = "Solid"` is the ELSE of `if (activated)` — so an UNWOKEN
        // boss IS a solid and a woken one is not, which is the opposite of
        // the turret's corpse latch above.
        //
        // ⇒ absent run state means SOLID here, and the arm falls through to
        // `s.rect` for exactly that case: a run that has never touched the
        // Wand has never woken it, and every flood and every planner query
        // made before the family existed was made against a room where the
        // boss had not woken. ⚠ THE DEFAULT IS THEREFORE LOAD-BEARING, and
        // it is the reverse of the turret's for a reason that is in the
        // source rather than in the convention.
        if (s.bossId) {
            const now = o.bosses ? o.bosses.get(s.bossId) : null;
            if (now && now.activated) return null;
            return s.rect;
        }
        // ⛓⛓⛓ R6 SLICE 5: A SHIELDBOSS — the THIRTEENTH per-visit family,
        // and the SIMPLEST polarity of the three boss-shaped arms.
        //
        // `ShieldBoss.type` is `"ShieldBoss"` from its own constructor and
        // it is NEVER reassigned. There is no wake, no corpse latch and no
        // type flip: the body is a wall from the tick the level builds it
        // until `FP.world.remove(this)`, which is `Mobile.death`'s eleventh
        // fade call, twenty-three graphic updates after the tag. ⇒ absent
        // run state means SOLID (a room nobody has fought in has its wall),
        // and the ONE thing that opens the cell is `removed`.
        //
        // ⛔ `destroy` IS NOT THE GATE. The body keeps colliding for the
        // whole fade — `FP.world.remove` is what takes it out of the type
        // list — so an arm keyed on `destroy` would open the room eleven
        // ticks early and walk the player through a wall.
        if (s.shieldBossId) {
            const now = o.shieldBosses ? o.shieldBosses.get(s.shieldBossId) : null;
            if (now && now.removed) return null;
            return s.rect;
        }
        // ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR — the ShieldBoss's polarity with
        // an even simpler mechanism. `FinalDoor.type` is `"Solid"` from the
        // constructor and is never reassigned, and the ONLY thing that takes
        // it out of the type list is `animEnd`'s `FP.world.remove(this)`.
        //
        // ⛔ THE ANIMATION IS NOT THE GATE. The door is a wall for all 57
        // updates of the `open` animation — the sprite changes and the body
        // does not — so an arm keyed on "opening" would walk the player into
        // the doorway 57 ticks early and, in this room, straight onto a
        // teleporter the door exists to cover.
        if (s.finalDoorId) {
            const now = o.finalDoors ? o.finalDoors.get(s.finalDoorId) : null;
            if (now && now.removed) return null;
            return s.rect;
        }
        // ⛔⛔ R5 SLICE 9: a chest the player has OPENED. `open()` writes
        // `type = ""` (Chest.as:77) and the entity then fades for 60 more
        // ticks before `FP.world.remove` — so the SOLIDITY goes first and the
        // removal is invisible, which is why one set covers both.
        if (o.openChests && s.chestId && o.openChests.has(s.chestId)) return null;
        // ⛓ R5 SLICE 7: a rope the player has PULLED. Not a removal and not a
        // type flip — `RopeStart.hit()` runs `setHitbox(16, 16, 8, 8)`, so
        // 112 px of wall becomes 16 px of wall at the span's START. A model
        // that dropped it would open a tile the game keeps, which is why this
        // is a rect swap rather than a removal.
        if (o.pulledRopes && s.ropeId && o.pulledRopes.has(s.ropeId)) {
            return s.shrunkRect;
        }
        // R4: a block that has been pushed is not where the level built it.
        // ⚠ A MISSING ENTRY FALLS THROUGH to the spawn rect below rather than
        // being read as "gone". Absent and removed are different facts, and
        // only one of them means the cell is clear.
        if (o.pushables && s.pushableId && o.pushables.has(s.pushableId)) {
            const now = o.pushables.get(s.pushableId);
            return now.removed ? null : now.rect;
        }
        return s.rect;
    };
    /**
     * ⛓⛓⛓ R5 SLICE 15: THE CRUSHERS — the NINTH per-visit geometry family,
     * and the first whose member is a solid that MOVES ON ITS OWN.
     *
     * Every family before this one moves because the PLAYER moved it: a
     * pushed block, a shrunk rope, a dropped rock, a burnt tree. A
     * `Crusher` charges at a player it can see, so its box is a function of
     * the whole run and not of any one press — which is why the roster
     * carries the ENTITY point as well as the OEL one. `Crusher.update`
     * grid-snaps `x`/`y` (the entity's, not the box's) with `Math.round`,
     * and a model that snapped the box corner would park it half a tile out.
     *
     * ⚠ AND IT HAS NO PERSISTENCE AT ALL — no `check()`, no `removed()`, no
     * `setPersistence` anywhere in `Crusher.as`. So unlike a spinner (whose
     * roster IS filtered by `check()`) this list is unconditional, and every
     * `new Game` rebuilds a crusher at its constructor cell however far the
     * last visit drove it. A botched park is one room-exit from reset, and a
     * window plan may not carry a crusher position across a re-boot.
     */
    const crushers = [];
    /**
     * ⛓⛓⛓ R5 SLICE 20: THE ICE TURRETS — the TENTH per-visit geometry
     * family, and the only one whose member is NOT a solid until the player
     * has killed it and stepped off it. `iceTurret.js` owns the behaviour;
     * this is the roster the run builds its state from, and the join is
     * `solid.turretId` exactly as `crusherId`/`pushableId` before it.
     */
    const iceTurrets = [];
    /**
     * ⛓⛓⛓ R5 SLICE 23: THE BOSS TOTEMS — the TWELFTH per-visit geometry
     * family, and the only one that stops being a solid by WAKING UP.
     * `bossTotem.js` owns the behaviour; the join is `solid.bossId`.
     *
     * ⚠ ONE MEMBER IN THE GAME (`bosstotem@152,168`, level 43), which is
     * why `collider: 'none'` survived unmeasured until a window walked in.
     */
    const bossTotems = [];
    /**
     * ⛓⛓⛓ R6 SLICE 5: THE SHIELD BOSSES — the THIRTEENTH per-visit
     * geometry family, and the only one whose member stops being a solid by
     * DYING. `shieldBossFight.js` owns the behaviour; the join is
     * `solid.shieldBossId`, and the press census carries the same id so a
     * swing after the removal cannot aim at a body that has left the world.
     *
     * ⚠ ONE MEMBER IN THE GAME (`shieldboss@80,32`, level 19), which is why
     * the `check()` despawn and the `bosskey` cage inside it went unpriced
     * for five rungs.
     */
    const shieldBosses = [];
    /**
     * ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR — the FOURTEENTH per-visit geometry
     * family, and the only one whose member stops being a solid because a
     * SAVE FILE said so.
     *
     * `FinalDoor.type` is `"Solid"` from its constructor and is never
     * reassigned, so the body is a wall from the tick the level builds it
     * until `animEnd` runs `FP.world.remove(this)` at the end of a 28-frame
     * `open` animation. What decides whether that animation ever plays is
     * three facts none of which is in this level:
     * `SealController.hasAllSealParts()` (the SAVE array's last slot),
     * `!Game.checkPersistence(0, 114)` (the WATCHER, in another room) and
     * an approach inside 32 px.
     *
     * ⚠ ONE MEMBER IN THE GAME (`finaldoor@112,0`, level 113), and it
     * covers both of L113's teleporters to L115 — so it is not merely a
     * wall, it is the only thing between the player and the ending.
     */
    const finalDoors = [];
    /**
     * ⛓ R5: the entities a HELD ITEM removed at build time.
     *
     * Published rather than silent, for the same reason the clear list is:
     * a world that differs from the extract has to be able to say why, and
     * a planner asserting "the plug is gone" must be able to assert it
     * against the build rather than against the absence of a collision.
     */
    const addedTimeRemoved = [];

    // --- tiles ---------------------------------------------------------
    // The extract has ALREADY applied loadlevel's own bounds guard
    // (`if (floor(x/Tile.w) < tiles.length && ...)`) and records how many
    // placements it dropped in `tiles_outside_level` — 51 levels paint
    // past their own rectangle and the game never builds those tiles. So
    // this loop must NOT re-filter, and must not un-filter either.
    for (const layer of levelRecord.layers ?? []) {
        if (!KNOWN_LAYERS.includes(layer.name)) {
            fail(`${where} has a layer "${layer.name}" that loadlevel does not build; `
                + `known layers are ${KNOWN_LAYERS.join(', ')}`);
        }
        if (layer.name === 'cliffsides') {
            for (const [tx, ty, txPixel] of layer.tiles) {
                const px = tx * TILE_SIZE;
                const py = ty * TILE_SIZE;
                const cls = cliffSideClassFor(txPixel);
                pixelmasks.push({
                    rect: entityRect(cls, px, py),
                    ...maskPlacement(cls, px, py),
                    cls,
                    tag: `cliffside${cls.frame}`,
                    x: px,
                    y: py,
                });
            }
            continue;
        }
        for (const [tx, ty, txPixel] of layer.tiles) {
            const column = Math.floor(txPixel / TILE_SIZE);
            const t = TILE_COLUMN_TO_TYPE[column];
            if (t === undefined) {
                fail(`${where} tile (${tx},${ty}) uses tileset column ${column}, which `
                    + 'the Game.as switch does not build');
            }
            const entityType = TILE_TYPE_ENTITY_TYPES[t];
            // Position is the cell CENTRE and the hitbox covers the cell
            // exactly (`Scenery/Tile.as:101-110`: `super(_x + w/2, _y + h/2)`
            // with `setHitbox(w, h, w/2, h/2)`). The centre is what
            // `nearestToPoint` measures to — see nearestWalkableTile.
            const x = tx * TILE_SIZE + TILE_SIZE / 2;
            const y = ty * TILE_SIZE + TILE_SIZE / 2;
            const tile = {
                tx, ty, t, entityType, x, y, column,
                name: TILE_TYPE_NAMES[t],
                rect: rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE),
            };
            tiles.push(tile);
            if (PLAYER_SOLID_SET.has(entityType)) {
                solids.push({ rect: tile.rect, cls: null, tag: `tile:${tile.name}`, x, y });
            } else if (entityType === 'Tile') {
                // Only entities still typed "Tile" are candidates for
                // `getState`: a solid tile flipped its type on its first
                // update and LEFT the "Tile" list, so `state` can never
                // become a wall type and the nearest walkable tile near a
                // wall may be surprisingly distant.
                walkableTiles.push(tile);
            } else if (t === BRIDGE_STATE) {
                // ⚠ A BRIDGE IS A SOLID, and it stays one for as long as
                // nothing throws a spear at it.
                //
                // v2 failed the whole level here, because `Tile.types[29]`
                // is "Unused" and the entity rewrites its own type from
                // `bridgeOpeningTimer` inside render() — closed => "Solid",
                // open => "Tile" — so it could not be sorted into either
                // list. R1 read the timer instead of the table, and it is
                // not a timer at all on a bot's boot: it is initialised to
                // `bridgeOpeningTimerMax` (60) and the ONLY line in the
                // whole codebase that decrements it is `Player.as:1098`,
                // inside `genericHit` under `t == "Spear"`. Nothing ticks
                // it down; nothing else writes it. A bridge opens because
                // you SPEAR it, and R1 never presses an attack key — so the
                // `bridgeOpeningTimer >= max` arm holds for the whole run
                // and `type` is "Solid", every frame, deterministically.
                //
                // ⚠ It is an OBJECT solid, not a tile solid, and that is
                // the same distinction CliffSide already draws: the type is
                // assigned from render(), which the Engine drives
                // independently of `Game.update`'s blackCover gate, so a
                // bridge is already Solid on a world's first LIVE tick
                // while an ordinary Stone is still typed "Tile".
                //
                // ⚠ AND R4 REVISITED IT, exactly as this note demanded. The
                // spear press is in the vocabulary now, so the timer is a
                // real timer and a bridge is a gated crossing: it stays a
                // solid HERE (a closed bridge is what the geometry is) and
                // the run carries the per-visit `openBridges` set that takes
                // it out of the list — the `openActivators` shape, for the
                // same reason. `bridgeId` is the join between the two views.
                const solid = {
                    rect: tile.rect, cls: null, tag: `tile:${tile.name}`, x, y,
                    bridgeId: `${tx},${ty}`,
                };
                solids.push(solid);
                objectSolids.push(solid);
            } else {
                fail(`${where} tile (${tx},${ty}) is type ${t} `
                    + `(${TILE_TYPE_NAMES[t]}), whose Tile.types entry is "Unused": `
                    + `${UNMODELLED_REASON[t] ?? 'not modelled'}`);
            }
        }
    }

    // --- objects -------------------------------------------------------
    let fallthrough = null;
    for (const e of levelRecord.entities ?? []) {
        const cls = ENTITY_CLASSES[e.type];
        if (!cls) {
            fail(`${where} contains entity "${e.type}" at (${e.x},${e.y}), which is not `
                + 'in the transcribed class table — add it (with its Game.as construction '
                + 'site and its setHitbox args) rather than assuming it does not collide');
        }
        // Role-scoped: a tag classified for the roles this caller consults
        // is enough, even if another role is still unpriced. That is the
        // whole relaxation — see the ROLES docblock.
        //
        // ⚠ FOUR OF THE FIVE. `combat` is answered by `combat.js`'s tables
        // rather than by this one's `roles` field (see ENTITY_TABLE_ROLES),
        // and its check is the block after the object loop.
        for (const role of roles.filter((r) => ENTITY_TABLE_ROLES.includes(r))) {
            if (!cls.roles.includes(role)) {
                fail(`${where} contains entity "${e.type}" at (${e.x},${e.y}), which is `
                    + `classified for [${cls.roles.join(', ')}] but NOT for the "${role}" `
                    + 'role this caller consults. Classify it (with its Game.as '
                    + `construction site) — ${role === 'blocking'
                        ? 'that means transcribing its constructor chain and setHitbox args'
                        : 'that means reading what it does on approach'}.`);
            }
        }
        const x = Number(e.x);
        const y = Number(e.y);

        // ── ⛓ R5: what a HELD ITEM does to this entity, at build time ────
        // `Karlore.added()` runs inside `new Game(level, ...)` and removes
        // the NPC when `Player.hasFire`, so the level the game builds is a
        // function of the inventory the player already had. See
        // `ADDED_TIME_REMOVAL` — one class, by NAME and by citation,
        // because the predicate that reads naturally here ("an NPC that
        // reads an item") sweeps in `BobBoss`, whose identical two lines
        // are a NO-OP in a constructor.
        const addedRemoval = ADDED_TIME_REMOVAL[e.type];
        if (addedRemoval && inventory?.[addedRemoval.property] === true) {
            addedTimeRemoved.push({
                tag: e.type, x, y, property: addedRemoval.property, cite: addedRemoval.cite,
            });
            continue;
        }

        // ── R2: what a cleared persistence flag does to this entity ──────
        // Read from `PERSISTENCE_RESPONSE`, which is per CLASS, because the
        // three behaviours are genuinely different: a chest is removed, a
        // rope SHRINKS, and a FallRock is ARMED. "Remove everything with
        // this tag" would be wrong in two of the three.
        const entityTag = tagOf(e.type, e.attrs);
        let clearedHere = false;
        // ⚠ AN "APPEAR" CLASS IS ABSENT ON A FRESH BOOT, and that is the
        // exact mirror of a parked FallRock. `MoonrockPile.check()` is
        // `if (tag >= 0 && checkPersistence(tag)) remove(this)` — its own
        // comment reads "false = there, true = not there" — so while the
        // flag holds there is NO 32x16 Solid, and the model was building
        // one. Level 2 is the third level of the walk and its arrival tile
        // is the pile's; the route reported the whole map unreachable.
        // Clearing the tag is refused (REFUSED_CLEAR_RESPONSES), so the
        // "it is there" arm is unreachable rather than unmodelled.
        if (PERSISTENCE_RESPONSE[e.type] === 'appear'
            && !(clearedTags && entityTag >= 0 && clearedTags.has(entityTag))) {
            continue;
        }
        if (clearedTags && entityTag >= 0 && clearedTags.has(entityTag)) {
            const response = PERSISTENCE_RESPONSE[e.type];
            // ⚠ AN UNDECLARED RESPONSE IS A THROW, and it is the guard that
            // makes this table's completeness checkable rather than hoped
            // for. A clear is a flag, not an entity: it reaches EVERYTHING
            // in the level carrying that tag. If one of them is a class
            // nobody has read, the game acts on it and the model does not,
            // and the difference surfaces as a physics divergence with no
            // trail back to here.
            if (response === undefined) {
                fail(`${where}: the tape clears tag ${entityTag}, which is also carried `
                    + `by "${e.type}" at (${x},${y}) — a class with NO declared `
                    + 'persistence response. Every class that reads '
                    + 'Game.checkPersistence changes when its flag does (a pickup '
                    + 'removes itself, a MoonrockPile APPEARS, a ButtonRoom boots '
                    + 'pressed), so an undeclared one is a difference between the game '
                    + 'and the model that nothing would report. Read its check()/ctor '
                    + 'and add it to PERSISTENCE_RESPONSE with the citation, or clear a '
                    + 'different tag.');
            }
            clearsUsed.add(entityTag);
            // ⚠ `Lock.check()` ALSO needs `tSet < 0`, and `int("")` is 0 —
            // so a lock with no `tset` attribute is in group 0 and does NOT
            // despawn. Three route locks and thirteen of fourteen wandlocks
            // turn on that clause, which lives in `clearedAwayByTag` now so
            // that the COMBAT CENSUS reaches the same verdict as this loop.
            clearedHere = clearedAwayByTag(e, clearedTags);
            const refusal = REFUSED_CLEAR_RESPONSES[response];
            if (refusal) {
                fail(`${where}: the tape clears tag ${entityTag}, which is a `
                    + `"${e.type}" at (${x},${y}) — response "${response}", and `
                    + `${refusal}. A clear list must never name it.`);
            }
        }
        if (clearedHere) continue;

        // ⚠ `control` is where a PIT GOES. It is not an entity — `loadlevel`
        // reads it as a parameter block (`Game.as:2050-2054`) into the
        // `Game.fallthrough*` statics — and it is read here unconditionally,
        // for every role set, because a run that walks onto a pit needs it
        // whatever census the caller asked for.
        //
        // Two transcription points, both easy to get wrong:
        //   - the offset is the control ENTITY'S OWN POSITION plus its
        //     `xOff`/`yOff` attrs, not the attrs alone
        //     (`fallthroughOffset = new Point(o.@x, o.@y)` then `+ tempOffset`);
        //   - `loadlevel` LOOPS, so a level with two control blocks keeps the
        //     LAST. None in the extract has two; transcribed anyway.
        //
        // `sign` is carried for completeness and consumed by nothing here:
        // `Game.sign` picks a dungeon signpost graphic.
        if (e.type === 'control') {
            fallthrough = {
                level: Number(e.attrs?.fallthrough),
                offsetX: x + Number(e.attrs?.xOff ?? 0),
                offsetY: y + Number(e.attrs?.yOff ?? 0),
                sign: Number(e.attrs?.sign ?? 0) - 1,
            };
            if (!Number.isInteger(fallthrough.level)) {
                fail(`${where} has a control block at (${x},${y}) with no readable `
                    + `fallthrough level (got ${JSON.stringify(e.attrs?.fallthrough)})`);
            }
        }

        if (consults.has('pickup') && cls.pickup) {
            pickups.push({
                rect: entityRect(cls.pickup, x, y), cls, tag: e.type, x, y,
                special: cls.pickup.special,
                // ⛓ R7 slice 6 (R6 debt 2): the pickup's OWN persistence tag,
                // carried only for the fourteen classes whose `removed()`
                // writes it — so a missing field on a `bosskey` is a loud
                // absence rather than a `{19,-1}` nobody would notice.
                ...(PICKUP_CLEARS_OWN_TAG[e.type] !== undefined
                    ? { persistTag: tagOf(e.type, e.attrs) } : {}),
                // R4: a `BossKey`'s `removed()` writes `Player.hasKeySet`
                // rather than one of the fourteen item properties, so WHICH
                // key it is has to survive the census — a `bosskey` ceremony
                // that could not name its type would grant nothing.
                ...(e.type === 'bosskey'
                    ? { keyType: intAttr(e.attrs, 'keyType', 0) } : {}),
                // ⛓ R7 slice 1: `keyType`'s twin, one pickup class over.
                // `BossTotemPart.removed()` writes `Player.hasTotemPartSet(
                // totemPart, true)` rather than one of the fourteen item
                // properties, and `Game.as:2192` passes `o.@totempart` as the
                // ctor's third argument — so WHICH part it is has to survive
                // the census or the save consumer added in the same batch
                // compares the game's five booleans against a model that
                // never learned which one moved.
                ...(e.type === 'totempart'
                    ? { totemPart: intAttr(e.attrs, 'totempart', 0) } : {}),
                // ⛓⛓⛓ R6 slice 6d: a `seed`'s ceremony text is an
                // ATTRIBUTE, not a class constant — `Game.as:2185` passes
                // `o.@text` as the fourth ctor argument. The dialogue's
                // LENGTH is therefore level data, and a census that dropped
                // it would leave `dialogue.PICKUP_TEXT_FROM_ATTRIBUTE` with
                // nothing to read. (Same shape as `keyType`: carried only
                // for the class that needs it, so a missing field is a loud
                // lookup failure rather than a wrong-length ceremony.)
                ...(e.type === 'seed'
                    ? { text: e.attrs?.text ?? '' } : {}),
            });
        }
        if (ACTIVATOR_PRESSERS.has(e.type)) {
            // The press volume IS the entity's hitbox — `Button.update`
            // collides at its own position — and `cls.hazard` already
            // carries exactly that rect, because standing on one is also
            // the proximity hazard R0 priced. One geometry, two questions.
            pressers.push({
                tag: e.type,
                t: tSetOf(e.type, e.attrs),
                rect: entityRect(cls.hazard, x, y),
                x,
                y,
                // ── R5 slice 5 step 2: THE CROSS-ROOM WRITE ───────────
                // A `ButtonRoom`'s setter has TWO arms and the census
                // carried neither, because until this rung no route
                // pressed one deliberately.
                //
                //   ButtonRoom.as:87-96
                //     var persist:Boolean = _active;      // true on a press
                //     if (flip) persist = !persist;
                //     if (room == -1) ...activate every Activator sharing t...
                //     else Game.setPersistence(t, persist, room);
                //     Game.setPersistence(tag, !activate);
                //
                // `room == -1` is the arm `pressedGroups` already models.
                // The other arm writes a flag in ANOTHER LEVEL, keyed on the
                // **TSET** rather than the tag, and then clears its OWN tag
                // in this one. Both are ledger entries and the first changes
                // what the other level BUILDS.
                //
                // ⚠ `flip` is what decides the SIGN, and the comment in the
                // source is the authority: "persist = false, then things
                // won't exist". A press with `flip` writes FALSE.
                //
                // ⚠ `persistTag` comes from `tagOf`, the census-wide helper,
                // rather than from a second reading of the attribute — so a
                // `ButtonRoom` and every other entity answer "what is your
                // tag" the same way. (`tagOf` gives -1 for a missing
                // attribute where AS3's `int("")` would give 0; all four
                // cross-room ButtonRooms in the game carry an explicit tag,
                // so the two cannot disagree here, and changing the
                // convention for one class would be worse than the caveat.)
                ...(e.type === 'buttonroom' ? {
                    room: intAttr(e.attrs, 'room', -1),
                    flip: intAttr(e.attrs, 'flip', 0) !== 0,
                    persistTag: entityTag,
                } : {}),
            });
        }
        // ⛓⛓⛓ R6 SLICE 6b: the WATCHER ROSTER, on the same role that already
        // prices it as an auto-talk volume.
        //
        // ⚠ IT IS A ROSTER AND NOT A VOLUME, which is why it is a separate
        // list rather than more fields on the hazard row. The hazard answers
        // "where must a walk not go"; this answers "what does the dialogue
        // COST and what does it write", and the second question needs the
        // entity's own `text`, `text1` and `frames` — `Game.as:2237` passes
        // `o.@frames` as `_talkingSpeed`, so the typing cadence is DATA and
        // taking the class default (0) would retime every page boundary.
        if (consults.has('proximity-hazard') && e.type === 'watcher') {
            watchers.push({
                id: `${e.type}@${e.x},${e.y}`,
                tag: e.type,
                x, y,
                // ⚠ THE HALF-TILE IS TRANSCRIBED, NOT TAKEN FROM `cls.dx`.
                // `watcher` is a `collider: 'none'` row and those carry no
                // dx/dy at all by convention (`ctorOffsetOf` returns null for
                // anything that is not a `rect`), so reading them here would
                // silently give `NaN` — which is exactly the eight-pixel class
                // of error the convention exists to prevent. The value is
                // `NPCs/NPC.as:47`'s `super(_x + Tile.w/2, _y + Tile.h/2)`,
                // and `endingChain.WATCHER.ctor` is asserted equal to it.
                ex: x + TILE_SIZE / 2,
                ey: y + TILE_SIZE / 2,
                persistTag: entityTag,
                text: e.attrs?.text ?? '',
                text1: e.attrs?.text1 ?? '',
                // ⚠ `int("")` is 0 in AS3 and 0 is a REAL talking speed (one
                // character per frame), so a missing attribute is not an
                // error here — it is the game's own value.
                talkingSpeed: intAttr(e.attrs, 'frames', 0),
            });
        }
        // ⛓⛓⛓ R6 SLICE 6d: THE ORACLE ROSTER — the run-ender at the end of
        // the bloody walk.
        //
        // ⛔ AND ITS HITBOX IS **NOT** THE `PRESS_ARMS` ROW'S. `NPC`'s ctor
        // does `setHitbox(g.width, g.height, g.width/2, g.height/2)` — 16x24
        // for a 16x24 Spritemap — and `Oracle`'s own ctor then calls
        // `setHitbox(16, 16, 8, 8)` on the line AFTER `super()`. The class
        // table's `w: 16, h: 24, originX: 8, originY: 12` is the base's,
        // taken before the override; the live body is 16x16 about the entity
        // point. Corrected in the table beside this (`ENTITY_CLASSES.oracle`)
        // rather than only here, because the solid rect is what a walk in L1
        // collides with — and the two answers differ by four pixels at the
        // bottom edge, which is where a walk arrives from.
        if (consults.has('proximity-hazard') && e.type === 'oracle') {
            oracles.push({
                id: `${e.type}@${e.x},${e.y}`,
                tag: e.type,
                x, y,
                // `NPCs/NPC.as:47` — the same half tile the Watcher takes,
                // transcribed rather than read from `cls.dx` for the reason
                // the watcher roster gives.
                ex: x + TILE_SIZE / 2,
                ey: y + TILE_SIZE / 2,
                persistTag: entityTag,
            });
        }
        /**
         * ⛓⛓⛓ R6 SLICE 6f: THE OWL ROSTER — the FIFTEENTH per-visit family,
         * and the first whose member is not a solid, not a wall and not a
         * hazard volume at all until it DIES.
         *
         * ⚠ THE HALF-TILE IS TRANSCRIBED, for the watcher roster's reason:
         * `finalboss` is a `collider: 'none'` row, and those DO carry dx/dy
         * in this table (it is one of the two that do), but reading them here
         * would make the roster's geometry depend on a field the convention
         * says may be absent. `finalBossFight.FINAL_BOSS.dx` is asserted
         * equal to it.
         */
        if (consults.has('combat') && e.type === 'finalboss') {
            finalBosses.push({
                id: `${e.type}@${e.x},${e.y}`,
                tag: e.type,
                x, y,
                ex: x + TILE_SIZE / 2,
                ey: y + TILE_SIZE / 2,
                persistTag: entityTag,
            });
        }
        /**
         * ⛓⛓⛓ R6 SLICE 6f: THE POD ROSTER — and it is a roster because the
         * PIN is not the only consumer.
         *
         * `hazards.js` already prices the 16x16 pin from `cls.hazard`, which
         * answers "where must a walk not go". This answers a second question
         * the volume cannot: **what animation is it playing**. Both the pin
         * (`currentAnim == "closed"`, 22 updates after a `close`) and the
         * Owl's own walk arm (`pods[cpod].open`, which is the GETTER over
         * `"open"`/`"opened"`) read the animation and not the geometry, and
         * `FinalBoss.check()` fills its `pods` Vector in `podPositions` order
         * — so the run needs the four of them keyed by that order.
         *
         * ⛔ THE ORDER IS `podPositions`', NOT THE `.oel`'s. L112's four pods
         * are placed (112,48), (112,192), (40,120), (184,120) and the boss
         * visits them (120,56), (48,128), (120,200), (192,128) — i.e. his
         * second pod is the level's THIRD. A roster in file order and a
         * `cpod` index into it would send him to the wrong pod on every
         * cycle. `finalBossFight` does the reordering, from `podPositions`.
         */
        if (consults.has('combat') && e.type === 'pod') {
            pods.push({
                id: `${e.type}@${e.x},${e.y}`,
                tag: e.type,
                x, y,
                ex: x + TILE_SIZE / 2,
                ey: y + TILE_SIZE / 2,
            });
        }
        if (consults.has('proximity-hazard') && cls.hazard) {
            const disposition = hazardDisposition(cls.hazard);
            if (disposition === 'unpriced') {
                // Classified as a hazard on evidence, with the avoid volume
                // deliberately NOT guessed. Same shape as the pixelmask
                // seam: a rung boundary made visible rather than a rect
                // nobody derived. `why` carries the evidence.
                fail(`${where} contains "${e.type}" at (${e.x},${e.y}), a PROXIMITY `
                    + 'HAZARD whose avoid volume has not been transcribed yet. '
                    + `${cls.why} Source: ${cls.src}. Price the volume before routing a `
                    + 'walk through this level, or drop the proximity-hazard role.');
            }
            // An INERT classification is an affirmative act with its
            // evidence attached, never an omission: the class IS a proximity
            // hazard, and the reason it cannot fire on a fresh boot is
            // recorded so a later rung (R3 collects for real, which wakes
            // BossTotem) knows exactly what it has to price.
            //
            // ⛓ R6 SLICE 6b — AND `entry:` IS THE FOURTH. Same act, different
            // claim: the effects are real and ungated by DISTANCE, so there
            // is no avoid volume to compute. It is recorded in its own list
            // rather than dropped, because "the builder said nothing" and
            // "the builder said the trigger is the doorway" must not print
            // the same. → `entryHazards`.
            if (disposition === 'entry') {
                entryHazards.push({
                    cls, tag: e.type, x, y, entry: cls.hazard.entry, src: cls.src,
                });
            } else if (disposition === 'volume') {
                proximityHazards.push({
                    cls, tag: e.type, x, y,
                    kind: cls.hazard.kind, effect: cls.hazard.effect,
                    // Two volume shapes, because the GAME uses two tests. A
                    // rect hazard gates on `collide("Player", ...)`, i.e. the
                    // player's BOX against the entity's hitbox. A `point`
                    // hazard gates on `FP.distance(x, y, player.x, player.y)`
                    // — the player's ENTITY POSITION against a radius, which
                    // is not a box test at all and must not be approximated
                    // by one when the radius is 129 px wide.
                    rect: (cls.hazard.point || cls.hazard.line)
                        ? null : entityRect(cls.hazard, x, y),
                    disc: cls.hazard.point
                        ? {
                            x: x + cls.hazard.point.dx,
                            y: y + cls.hazard.point.dy,
                            r: cls.hazard.point.r,
                        }
                        : null,
                    // ⚠ R4: A THIRD SHAPE, and it exists because the second
                    // one was not exact enough. A `BossLock` gates on
                    // `World.collideLine`, which tests INTEGER points along a
                    // one-pixel row and never tests its own end point — so
                    // the true volume is a set of ten pixels, not the 10x1
                    // rect enclosing them. Approximating it as a rect
                    // over-avoids by up to a pixel on each side, and it is
                    // not a theoretical amount: R3's committed L12 route
                    // passes at y = 259.38 with the line at y = 257, which
                    // the rect test calls a hit and the game does not.
                    //
                    // Placement-relative, so the entity `x`/`y` (which carry
                    // the ctor's half tile) are undone first.
                    line: cls.hazard.line
                        ? {
                            x0: e.x + cls.hazard.line.x0,
                            x1: e.x + cls.hazard.line.x1,
                            y: e.y + cls.hazard.line.dy,
                        }
                        : null,
                    // ⚠ AND THIS ONE VOLUME IS CONDITIONAL, which no other
                    // hazard is. `BossLock.update`'s gate is
                    // `p && Player.hasKey(keyType)` — the line is inert to a
                    // walk that does not hold the key, and R1/R2/R3 hold
                    // none, so pricing it unconditionally live (the
                    // `shieldlock` treatment) would move three rungs of
                    // committed routes for a mechanic that cannot fire.
                    //
                    // The shieldlock's own docblock calls that shape "a
                    // policy the planner has no vocabulary for", and at R4
                    // that stopped being true: `planNow` threads the RUN's
                    // inventory and key set, so the caller can say what it
                    // holds. `keyType: null` means unconditional.
                    keyType: cls.keyLock
                        ? intAttr(e.attrs, cls.keyLock.keyTypeAttr, 0) : null,
                });
            }
        }

        // ── R4: the press census ──────────────────────────────────────
        // Collected BEFORE the collider switch, because the responder that
        // made this list necessary does not collide: a `LightPole` is
        // `collider: 'none'` and would `continue` out of the loop three
        // lines below, so a rect query written against the old world
        // reported "nothing else in the rect" for exactly the entity whose
        // stray hit writes a persistence flag.
        if (consults.has('blocking')) {
            const arm = PRESS_ARMS[cls.as3];
            if (arm) {
                pressResponders.push({
                    tag: e.type,
                    as3: cls.as3,
                    x,
                    y,
                    // The lightpole's box is its own (the render() re-anchor
                    // and the bob envelope); every other responder collides
                    // on the hitbox the blocking role already transcribed.
                    // ⛔ R5 SLICE 7: AND THE `rope` COLLIDER IS NOT A
                    // CONSTANT EITHER. `entityRect` reads `cls.w`, which a
                    // node-terminated class does not have, so a rope's press
                    // rect came out `{x, y, h, right: null, bottom}` — and a
                    // rect with a null `right` NEVER OVERLAPS ANYTHING
                    // (`null > x` is false). So `pressRespondersIn` could
                    // not see the rope AT ALL: the sword arm that pulls it
                    // was `refused` by policy AND unreachable by geometry,
                    // and either one alone would have read as "the audit is
                    // clean". Sized here from the same `<node>` span the
                    // blocking role uses, so the two cannot disagree.
                    // ⛔ R5 SLICE 8: AND THE `Watcher` IS THE SECOND ONE.
                    // Same shape, same cover story — `collider: 'none'`, no
                    // top-level box, an arm that is `refused` so no route
                    // ever asks. Eleven levels of `{x: NaN, …}`, found by
                    // step 0's sweep rather than by anybody suspecting it.
                    // `entityRect` now throws on such a class, so this
                    // lookup is not an optimisation: without it the census
                    // does not build.
                    rect: cls.collider === 'rope'
                        ? ropeSpanRect(e, cls, x, y, entityTag, clearedTags, where)
                        : entityRect(PRESS_BOX_OVERRIDES[cls.as3] ?? cls, x, y),
                    // ⚠ R5 SLICE 7: THE ORIGIN, because `Player.as:1026`'s
                    // radius cut needs it and needs it WRONG. The fire
                    // distance is computed from `e.x - e.originX` (the box
                    // left, which the rect already is) and `e.y - originY`
                    // — the PLAYER's originY, not the target's. So the
                    // shift a fire candidate takes is
                    // `e.originY - HITBOX.originY`, and a census that
                    // carried only the rect cannot express it.
                    originX: cls.originX ?? 0,
                    originY: cls.originY ?? 0,
                    arm: arm.arm,
                    cost: arm.cost,
                    src: arm.src,
                    t: tSetOf(e.type, e.attrs),
                    persistTag: entityTag,
                    // ⚠ The ONE responder whose rect is not a constant. A
                    // pushed block is not where the level built it, and a
                    // press census that answered from the spawn rect would
                    // find the block for the FIRST push of a chain and miss
                    // it for every one after — which is exactly what the
                    // three-push L65 chain did before this line existed.
                    ...(PUSHABLE_FAMILIES[e.type]
                        ? { pushableId: `${e.type}@${x},${y}` } : {}),
                    // R5 slice 5: the same join for a BreakableRock, and for
                    // the same reason — the run holds live state for it and
                    // the press has to look it up. `rockType` rides along
                    // because it is what decides whether the press does
                    // anything at all (`rockType <= hasGhostSword ? 1 : 0`).
                    ...(cls.as3 === 'BreakableRock'
                        ? {
                            rockId: `${e.type}@${x},${y}`,
                            rockType: e.type === 'breakablerockghost' ? 1 : 0,
                        } : {}),
                    // ⛓ R5 slice 12: the EIGHTH family. A `BurnableTree`'s
                    // press arm needs the same join — the run holds the burn
                    // state and `applyFire` looks it up by this id.
                    ...(cls.as3 === 'BurnableTree'
                        ? { treeId: `${e.type}@${x},${y}` } : {}),
                    // ⛓⛓⛓ R6 slice 6d: the FIFTEENTH family's join, and the
                    // narrowest of them all — the run holds `hits` and
                    // `hitsTimer` for a body that never moves, never shrinks
                    // and never leaves, so the RECT stays the census's and
                    // only the counter needs looking up.
                    ...(cls.as3 === 'Watcher'
                        ? { watcherId: `${e.type}@${x},${y}` } : {}),
                    // ⛓⛓⛓ R5 slice 21: the TENTH, and the SECOND responder
                    // whose rect is not a constant.
                    //
                    // ⛔ A pushed block moves; a killed turret moves AND
                    // SHRINKS — `death()`'s `setHitbox(16, 16, 8, 8)` against
                    // the ctor's 32x32 — so the box below is true only while
                    // the body is alive. `pressRespondersIn`'s `turrets` join
                    // is what makes a press after the kill aim at the corpse
                    // rather than at where the level built the turret.
                    ...(cls.as3 === 'IceTurret'
                        ? { turretId: `${e.type}@${x},${y}` } : {}),
                    // ⛓⛓⛓ R6 SLICE 5: the THIRD responder whose rect is not
                    // a constant — and the only one whose rect stops
                    // EXISTING. A pushed block moves, a killed turret moves
                    // and shrinks; a dead ShieldBoss is simply gone from the
                    // world thirty-four ticks after the tag, and a press
                    // audited against the census box after that would report
                    // a hit on an entity `Player.slash`'s `collideRectInto`
                    // could not have collected.
                    ...(cls.as3 === 'ShieldBoss'
                        ? { shieldBossId: `${e.type}@${x},${y}` } : {}),
                    // ⛓⛓⛓ R6 slice 6f: the FOURTH, and the only one whose
                    // rect moves DURING a single press. A pushed block moves
                    // between presses, a killed turret between visits; the
                    // Owl is shoved by test 1 of a press and tests 2..5 have
                    // to find him where the shove left him — which is what
                    // decides how many of the five land at all.
                    ...(cls.as3 === 'FinalBoss'
                        ? { finalBossId: `${e.type}@${x},${y}` } : {}),
                    // ⛓⛓⛓ R8 slice 6: the FIFTH, and the first whose body
                    // moves for a reason unrelated to the press. The four
                    // before it are moved BY something the walk did (a push, a
                    // kill, a shove); a spinner is a billiard, so the census
                    // box is wrong from the first tick of the visit onward and
                    // `pressRespondersIn`'s `spinners` join is what makes a
                    // press aim at the body rather than at its `.oel` cell.
                    ...(cls.as3 === 'Spinner'
                        ? { spinnerId: `${e.type}@${x},${y}` } : {}),
                });
            } else if (cls.type === 'Enemy') {
                // ⚠ NO RECT, AND THAT IS THE POINT. An enemy's press
                // obligation is arithmetic over the whole walk — one spear
                // press is 2 damage against `hitsMax` 3, so the rule is
                // "at most one press per enemy per walk" (§8.8) — and a
                // static rect for a chaser would be a fact about where it
                // spawned, not about where the press lands. Recording the
                // ROSTER is the honest half; `Bot.noDamage` covers the
                // other direction.
                pressEnemies.push({
                    tag: e.type,
                    as3: cls.as3,
                    x,
                    y,
                    // An enemy no press can damage costs the arithmetic
                    // nothing; one that can is a press budget the walk
                    // has to spend at most once (2 damage vs hitsMax 3).
                    unkillable: PRESS_UNKILLABLE[cls.as3] ?? null,
                });
            }
        }

        /**
         * ⛔⛔ R5 SLICE 10: THE FALLROCK ROSTER, and it is collected ABOVE
         * the `collider === 'none'` bail because that is exactly what a
         * parked rock is.
         *
         * A `FallRock` has no collider until it LANDS, and until slice 10
         * nothing could make one land, so `collider: 'none'` was the whole
         * truth. `RopeStart.set activate` can: it reaches every `Activators`
         * sharing its `t`, and `FallRock.set activate` calls `fall()`. The
         * roster is what lets the RUN hold that live state, on the same
         * `<id>` join `pushables`/`chests`/`pulsers` use.
         *
         * ⚠ THE ROSTER IS NOT A SOLID LIST. A landed rock reaches
         * `collidesSolid` through the `fallenRocks` option, exactly as a
         * pushed block reaches it through `pushables` — because whether it
         * is there is a fact about the run, not about the level.
         */
        if (cls.as3 === 'FallRock' || cls.as3 === 'FallRockLarge') {
            fallRocks.push({
                id: `${e.type}@${x},${y}`,
                tag: e.type,
                as3: cls.as3,
                x,
                y,
                t: tSetOf(e.type, e.attrs),
                persistTag: tagOf(e.type, e.attrs),
            });
        }
        /**
         * ⛔⛔ R5 SLICE 13: THE SPINNER ROSTER — collected ABOVE the
         * `collider === 'none'` bail for the same reason the FallRock roster
         * is, and it is the same reason twice: a verdict of "no collider"
         * was always a verdict about the PLAYER.
         *
         * A `Spinner` blocks a `PushableBlock*` (`solids.push("Enemy")`) and
         * it MOVES, so the run holds live state for it exactly as it does
         * for a block. ⚠ AND THE ROSTER IS NOT THE COMBAT CENSUS: the
         * `combat` role is opt-in, and a glide corridor that went uncertified
         * because nobody asked for combat is the vacuity §25.3's refusal was
         * built to prevent. This is unconditional.
         *
         * ⛓ `check()` IS APPLIED HERE. `Spinner.as:47-55` despawns one whose
         * `tag >= 0` flag has been cleared — the same shape as a burnt tree
         * and a looted chest, so a spinner the run already killed is not in
         * the roster on re-entry and cannot wedge anything.
         */
        if (cls.as3 === 'Spinner') {
            const spinTag = tagOf(e.type, e.attrs);
            if (!(clearedTags && spinTag >= 0 && clearedTags.has(spinTag))) {
                spinners.push({
                    id: `${e.type}@${x},${y}`,
                    tag: e.type,
                    as3: cls.as3,
                    x,
                    y,
                    persistTag: spinTag,
                });
            } else {
                clearsUsed.add(spinTag);
            }
        }
        /**
         * ⛓⛓⛓ R7 SLICE 6b: THE ARROW TRAP ROSTER — and it is NOT an
         * `ACTIVATOR_RESPONDER`, which §15.7 of the R7 kickoff ruled it
         * should be. The ruling cannot be executed and the reason is
         * structural rather than stylistic:
         *
         *   1. `ACTIVATOR_RESPONDERS` is the set whose SOLIDITY answers to a
         *      group, and it is consulted INSIDE the `collider === 'rect'`
         *      branch below — the branch this bail has already skipped for
         *      an `arrowtrap`. `ArrowTrap` never calls `setHitbox` and never
         *      assigns a `type`, so the entry would be unreachable code.
         *   2. `activators.test.js` pins the set as exactly
         *      `keys(RESPONDERS) ∪ keys(KEY_RESPONDERS)`, and both of those
         *      carry an opening FADE. A trap has no open state; it has a
         *      FIRING state.
         *
         * ⇒ it joins the PULSER lane, which exists for exactly this shape:
         * an `Activators` with a `t` whose activation changes what it DOES
         * rather than whether it blocks (§21.65 — *"a pulser group's EFFECT
         * is a different observable"*). `arrowTrap.js` owns the cadence, the
         * arrows and the lanes; `ARROW_TRAP_CENSUS` re-asserts the
         * membership the ruling wanted.
         *
         * ⚠ `shootDefault` IS CARRIED, and it is not decoration: four of the
         * game's eleven traps are `shoot="1"` and fire UNTIL their group is
         * pressed. A roster without it would model L16 and L67 backwards.
         */
        if (cls.as3 === 'ArrowTrap') {
            arrowTraps.push({
                id: `${e.type}@${x},${y}`,
                tag: e.type,
                x,
                y,
                // The ENTITY point — `super(_x + Tile.w/2, _y + spr.height/2)`
                // through `Activators(_x:int, _y:int, …)`, whose int params
                // TRUNCATE the 2.5 to 2. `arrowTrap.ARROW_TRAP.ctor` is the
                // one transcription; this is its consumer.
                ex: x + PUZZLEMENT_HAZARDS.arrowtrap.ctor.dx,
                ey: y + PUZZLEMENT_HAZARDS.arrowtrap.ctor.dy,
                t: tSetOf(e.type, e.attrs),
                shootDefault: Boolean(intAttr(e.attrs, 'shoot', 0)),
            });
        }
        if (cls.collider === 'none' || cls.collider === undefined) continue;
        if (cls.collider === 'rect') {
            const solid = { rect: entityRect(cls, x, y), cls, tag: e.type, x, y };
            // R5 slice 5: a BreakableRock is the third entity family the RUN
            // holds live state for, and the id is the join between the two
            // views — `pushableId`'s shape, for `pushableId`'s reason. It
            // carries its own `persistTag` and `rockType` because both decide
            // what a press DOES (`rockType <= hasGhostSword ? 1 : 0` breaks
            // it; `tag` says where `endAnim`'s write lands, which for the -1
            // rocks is another level entirely).
            if (cls.as3 === 'BreakableRock') {
                solid.rockId = `${e.type}@${x},${y}`;
                solid.persistTag = tagOf(e.type, e.attrs);
                solid.rockType = e.type === 'breakablerockghost' ? 1 : 0;
            }
            // ⛓⛓ R5 SLICE 12: A BURNABLE TREE, THE EIGHTH GEOMETRY FAMILY.
            //
            // ⛔ AND `check()` DECIDES WHETHER IT IS BUILT AT ALL:
            // `if (tag >= 0 && !Game.checkPersistence(tag)) die()`, so once
            // the flag is cleared the room is built WITHOUT it — the same
            // shape as a despawned chest and the opposite of a per-visit
            // `tag = -1` tree, which every `new Game` rebuilds whole.
            if (cls.as3 === 'BurnableTree') {
                const treeTag = tagOf(e.type, e.attrs);
                if (!treeBuiltIn({ tag: treeTag }, clearedTags)) continue;
                solid.treeId = `${e.type}@${x},${y}`;
                solid.persistTag = treeTag;
                burnableTrees.push({
                    id: solid.treeId, tag: treeTag, x, y, rect: solid.rect,
                });
            }
            // ⛔⛔ R6 SLICE 2: A MAGICAL LOCK — the only solid in the game
            // whose opener is a PROJECTILE, and the twelfth id join.
            //
            // ⛓ ITS `check()` IS ALREADY HANDLED. `MagicalLock` extends
            // `Entity` (not `Activators`), so it has no `tSet` and its
            // despawn is the bare `!Game.checkPersistence(tag)` that
            // `PERSISTENCE_RESPONSE.magicallock = 'despawn'` already
            // applies at build time. What is new is the WITHIN-VISIT half:
            // `hit()` starts a 15-update animation and the entity is
            // `"Solid"` for every tick of it — see `magicalLock.js`.
            //
            // ⚠ THE POLARITY IS THE REVERSE OF A BOSS TAG. `hit()` writes
            // `setPersistence(tag, FALSE)`, so an OPENED lock is a CLEARED
            // flag; the `openMagicalLocks` set below is the run's own view
            // and is not the flag.
            if (cls.as3 === 'MagicalLock') {
                solid.magicalLockId = `${e.type}@${x},${y}`;
                solid.persistTag = tagOf(e.type, e.attrs);
                solid.lockType = MAGICAL_LOCK_TYPE_BY_TAG[e.type];
                magicalLocks.push({
                    id: solid.magicalLockId,
                    tag: solid.persistTag,
                    lockType: solid.lockType,
                    x,
                    y,
                    ex: solid.rect.x + cls.originX,
                    ey: solid.rect.y + cls.originY,
                    rect: solid.rect,
                });
            }
            // ── R5 slice 9: the two solids whose state is their own ──────
            if (cls.as3 === 'Chest') {
                solid.chestId = `${e.type}@${x},${y}`;
                chests.push({
                    id: solid.chestId,
                    tag: e.type,
                    x,
                    y,
                    // `Chest(_x, _y, _tag:int = -1)` — a SIXTH member of the
                    // out-of-band family if the attribute is absent, and
                    // L38's carries tag 1.
                    persistTag: tagOf(e.type, e.attrs),
                });
            }
            if (cls.as3 === 'Pulser') {
                solid.pulserId = `${e.type}@${x},${y}`;
                pulsers.push({
                    id: solid.pulserId,
                    tag: e.type,
                    x,
                    y,
                    t: tSetOf(e.type, e.attrs),
                });
            }
            // ⛓⛓⛓ R5 SLICE 15: THE CRUSHER, on the same `<id>` join as every
            // family since R4. `tset` is read through `tSetOf` rather than
            // hard-coded to -1 because the sentinel is the CLASS's meaning of
            // the value, not the value itself: `alwaysArmed(t)` is what reads
            // it, and a crusher in a real group would be armed by a button.
            // (All four in the game carry -1 — asserted, not assumed.)
            if (cls.as3 === 'Crusher') {
                solid.crusherId = `${e.type}@${x},${y}`;
                crushers.push({
                    id: solid.crusherId,
                    tag: e.type,
                    x,
                    y,
                    // ⛔ THE ENTITY POINT, and it is a different number from
                    // `x`/`y`. `Crusher(_x, _y, …)` calls
                    // `super(_x + Tile.w, _y + Tile.h)` and then
                    // `setHitbox(32, 32, 16, 16)`, so the box is [x, x+32) and
                    // the entity sits at its CENTRE. `Math.round(x / Tile.w)`
                    // in `update()` snaps THIS point.
                    ex: x + cls.dx,
                    ey: y + cls.dy,
                    t: tSetOf(e.type, e.attrs),
                    rect: solid.rect,
                });
            }
            // ⛓⛓⛓ R5 SLICE 20: AN ICE TURRET. Same `<id>` join as every
            // family since R4, and the roster carries BOTH boxes because the
            // two are different sizes: the live 32x32 body (the hazard's and
            // the aim's) and the 16x16 corpse `death()` shrinks it to, which
            // is the only one that is ever a Solid.
            if (cls.as3 === 'IceTurret') {
                solid.turretId = `${e.type}@${x},${y}`;
                iceTurrets.push({
                    id: solid.turretId,
                    tag: e.type,
                    x,
                    y,
                    // The ENTITY point — `super(_x + Tile.w, _y + Tile.h)`, a
                    // WHOLE tile, and a tile CORNER. `input()`'s first snap
                    // moves it 8 px to a centre, so this is not where it
                    // stands (`iceTurret.js`' two-cycle).
                    ex: x + cls.dx,
                    ey: y + cls.dy,
                    aliveRect: solid.rect,
                });
            }
            // ⛓⛓⛓ R5 SLICE 23: A BOSS TOTEM. `solid.rect` here is the
            // PRE-WAKE wall — the else-arm of `if (activated)` — and
            // `liveRectOf`'s boss arm returns `null` for a boss the run says
            // has activated, which is the reverse of the pushables
            // convention and the same as the turret's.
            if (cls.as3 === 'BossTotem') {
                solid.bossId = `${e.type}@${x},${y}`;
                bossTotems.push({
                    id: solid.bossId,
                    tag: e.type,
                    x,
                    y,
                    // The ENTITY point — `super(_x, _y)` with no offset at
                    // any level of the chain, which is why `dx`/`dy` are 0.
                    ex: x + cls.dx,
                    ey: y + cls.dy,
                    persistTag: tagOf(e.type, e.attrs),
                    preWakeRect: solid.rect,
                });
            }
            // ⛓⛓⛓ R6 SLICE 5: A SHIELD BOSS. `solid.rect` here is the LIVE
            // body — the 48x48 `setHitbox` around the asymmetric ctor
            // offset — and `liveRectOf`'s arm returns `null` only once the
            // run says the entity has been REMOVED (not killed, not
            // destroyed: removed). ⛔ The `bosskey` this room also places is
            // INSIDE this rect, so the wall and the key's cage are one
            // object with one release instant.
            if (cls.as3 === 'ShieldBoss') {
                solid.shieldBossId = `${e.type}@${x},${y}`;
                shieldBosses.push({
                    id: solid.shieldBossId,
                    tag: e.type,
                    x,
                    y,
                    // The ENTITY point — `super(_x + Tile.w * 1.5, _y +
                    // Tile.h * 2)`, which is 24 across and 32 down. ⚠ The
                    // asymmetry is the class's, not a transcription slip.
                    ex: x + cls.dx,
                    ey: y + cls.dy,
                    persistTag: tagOf(e.type, e.attrs),
                    aliveRect: solid.rect,
                });
            }
            // ⛓⛓⛓ R6 SLICE 6c: THE FINAL DOOR. `solid.rect` here is the
            // STANDING door — `super(_x + Tile.w, _y + Tile.h)` (a WHOLE
            // tile, not the half every other class uses) with
            // `setHitbox(32, 32, 16, 16)`, so the entity is (128,16) and the
            // body is `[112,144) x [0,32)`. `liveRectOf`'s arm returns
            // `null` only once the run says the entity has been REMOVED,
            // which is `animEnd` after the 28-frame `open`; there is no
            // intermediate non-solid state at all.
            if (cls.as3 === 'FinalDoor') {
                solid.finalDoorId = `${e.type}@${x},${y}`;
                finalDoors.push({
                    id: solid.finalDoorId,
                    tag: e.type,
                    x,
                    y,
                    ex: x + cls.dx,
                    ey: y + cls.dy,
                    persistTag: tagOf(e.type, e.attrs),
                    standingRect: solid.rect,
                });
            }
            if (PUSHABLE_FAMILIES[e.type]) {
                // ⚠ The id shape is the activator's, deliberately: both are
                // "the run holds live state for this entity and the geometry
                // query has to look it up". A second id convention would be
                // a second place for the two to fall out of step.
                solid.pushableId = `${e.type}@${x},${y}`;
                pushables.push({
                    id: solid.pushableId,
                    tag: e.type,
                    as3: cls.as3,
                    family: PUSHABLE_FAMILIES[e.type],
                    x,
                    y,
                });
            }
            if (ACTIVATOR_RESPONDERS.has(e.type)) {
                solid.activatorId = `${e.type}@${x},${y}`;
                const activator = {
                    id: solid.activatorId,
                    tag: e.type,
                    t: tSetOf(e.type, e.attrs),
                    rect: solid.rect,
                    x,
                    y,
                    // What `Lock.turnOff()` writes: `Game.setPersistence(tag,
                    // false)`. Carried so a consumer can say WHICH flag a
                    // touch turned off, against the game's own
                    // `persistence_cleared` readout — the R3 ledger's whole
                    // point is that a flag went false because the player did
                    // something, and a claim about "a lock opened" that
                    // cannot name the flag is not checkable against it.
                    persistTag: entityTag,
                };
                // ── R3: the responders that press THEMSELVES ────────────
                // A `ShieldLock` has no button: its own `update` collides at
                // `x - 1` and sets `activate`. The rect for that collide is
                // `cls.hazard`'s, because they are the SAME rect — see the
                // `lockSnap` note on the class.
                if (cls.lockSnap) {
                    activator.touchRect = assertRect(entityRect(cls.hazard, x, y),
                        `${where}: ${e.type}@${x},${y} touch rect`);
                    activator.shield = cls.lockSnap.shield;
                    activator.snapY = y + cls.lockSnap.snapDY;
                }
                // ── R4: the responders that open on a KEY ───────────────
                // A `BossLock` has no button and no shield: it walks a
                // one-pixel line beneath itself and gates on a save-file
                // boolean. The line is carried as its own INTEGER probe
                // range rather than as a rect — `World.collideLine` tests
                // integer points and skips its own end point, so a rect
                // would accept a box that straddles the last probe without
                // containing it. Placement-relative, so the entity's own
                // `x`/`y` (which are the placement plus the half tile) are
                // undone first.
                if (cls.keyLock) {
                    const kl = cls.keyLock;
                    activator.keyType = intAttr(e.attrs, kl.keyTypeAttr, 0);
                    activator.keyLine = Object.freeze({
                        x0: e.x + kl.x0,
                        x1: e.x + kl.x1,
                        y: e.y + kl.dy,
                    });
                    activator.keyTimer = kl.keyTimer;
                }
                activators.push(activator);
            }
            solids.push(solid);
            objectSolids.push(solid);
        } else if (cls.collider === 'rope') {
            // The one collider whose WIDTH is placement data rather than
            // class data: `setHitbox(_xend - _x + 16, ...)` where `_xend`
            // comes from the entity's last `<node>` child
            // (`Game.as:2201-2210`). A rope with no node cannot be sized,
            // and guessing a 16 px stub would turn a 7-tile wall into a
            // 1-tile one — silently, and only in the level nobody visits.
            // ⚠ A CLEARED ROPE SHRINKS, it does not despawn: `check()`
            // calls `hit()`, and `hit()` runs `setHitbox(16, 16, 8, 8)`.
            // What is left is a ONE-CELL solid at the span's start, not
            // open floor — which is the difference between routing through
            // and walking into a wall. `ropeSpanRect` is the shared
            // derivation; the press census reads the same one.
            const last = e.nodes?.[e.nodes.length - 1];
            const r = ropeSpanRect(e, cls, x, y, entityTag, clearedTags, where);
            const solid = {
                rect: r, cls, tag: e.type, x, y,
                span: { xend: last.x, w: r.right - r.x },
                // ⛓ R5 SLICE 7: the join a PULLED rope needs. Unlike a
                // broken rock the entity survives — `hit()` shrinks the
                // hitbox to one cell — so the run cannot express it by
                // dropping the solid, and `collidesSolid` needs both the
                // id and the shrunken rect.
                ropeId: `${e.type}@${x},${y}`,
                shrunkRect: rect(
                    x + cls.dx - cls.originX, y + cls.dy - cls.originY, TILE_SIZE, cls.h,
                ),
                // ⛔⛔ R5 SLICE 10: THE GROUP THE PULL PUBLISHES TO.
                //
                // `RopeStart.set activate` broadcasts to every `Activators`
                // sharing this `t`, and two of the game's three ropes reach a
                // `FallRock` with it. It is carried HERE — on the solid the
                // run already looks up by `ropeId` — because the press
                // census's own `t` field is the WEAPON TYPE ("Fire"), and a
                // consumer reaching for the group would silently get a
                // string. Named, not renamed: the collision is the game's.
                ropeT: tSetOf(e.type, e.attrs),
                ropeTag: entityTag,
            };
            solids.push(solid);
            objectSolids.push(solid);
        } else if (cls.collider === 'pixelmask') {
            pixelmasks.push({
                rect: entityRect(cls, x, y),
                ...maskPlacement(cls, x, y),
                cls,
                tag: e.type,
                x,
                y,
            });
        } else if (cls.collider === 'trigger') {
            const isStairs = STAIRS_TAGS.includes(e.type);
            // `Stairs` forces tag = -1; a bare Teleporter defaults to -1
            // when the attribute is absent (`Game.as:2169`:
            // `String(o.@tag) == "" ? -1 : o.@tag`).
            const tag = isStairs ? -1 : intAttr(e.attrs, 'tag', -1);
            const invert = isStairs ? false : intAttr(e.attrs, 'invert', 0) !== 0;
            // `deactivated` is `tag >= 0 && (!checkPersistence(tag) == invert)`
            // (`Teleporter.as:76-79`). v2 has no items and the recompiled
            // runtime never persists, so `Main.as:319-330` leaves every
            // persistence flag TRUE — which makes `!checkPersistence(tag)`
            // false, and a tagged, non-inverted teleporter DEACTIVATED.
            // Item-driven changes to this are v3+.
            // R2: a clear does not only despawn things — it can open a
            // door. `Teleporter.checkDeactivated()` is
            // `tag >= 0 && (!checkPersistence(tag) == invert)`, so a
            // non-inverted tagged teleporter is DEACTIVATED on a fresh boot
            // and becomes live once its tag is cleared; an inverted one goes
            // the other way. v2 hardcoded this true because it had no
            // persistence to read.
            const persistenceIsTrue = !(clearedTags && tag >= 0 && clearedTags.has(tag));
            if (clearedTags && tag >= 0 && clearedTags.has(tag)) clearsUsed.add(tag);
            const deactivated = tag >= 0 && (!persistenceIsTrue === invert);
            teleporters.push({
                tag, invert, deactivated, isStairs,
                x, y,
                rect: entityRect(cls, x, y),
                to: intAttr(e.attrs, 'to'),
                playerx: intAttr(e.attrs, 'playerx'),
                playery: intAttr(e.attrs, 'playery'),
                // Where the player ACTUALLY lands: `Game.as:2040` builds
                // `new Player(playerx, playery)` and the Player ctor adds
                // the half-tile offset (`Player.as:357`). Both are ints.
                arrival: {
                    x: intAttr(e.attrs, 'playerx') + TILE_SIZE / 2,
                    y: intAttr(e.attrs, 'playery') + TILE_SIZE / 2,
                },
            });
        }
    }

    // --- the combat role (R5 slice 2) ------------------------------------
    //
    // ⛔ THE THROW IS THE POINT. §5: "census claims are per-INSTANCE with
    // counts — 'L40 has enemies' is not a claim. The Puzzlements family is IN
    // the census or the builder throws." A caller that consults `combat` has
    // retired `noDamage`, so a placed thing that can reach `Player.hit` and
    // has no row is not a gap in a table, it is a hazard the route does not
    // know about.
    //
    // ⚠⚠ AND WHAT "NEEDS A ROW" IS DERIVED THE OTHER WAY ROUND. The obvious
    // test — "is the tag in `combat.LOOKS_LIKE_COMBAT`" — asks the table
    // whether the table knows about it, which is the R4 §14 shape exactly: a
    // check that shares its subject's derivation agrees with whatever both
    // forgot. So the requirement is sourced from `seedlingDamageSites.js`,
    // extracted from the game's own call sites by a script with no notion of
    // "enemy", UNIONED with `totalEnemies()`'s whitelist (a counted class
    // seals a kill lock whether or not it can hurt you — `DarkTrap` is
    // exactly that, and it is harmless).
    let combat = null;
    if (consults.has('combat')) {
        const needsRow = [];
        for (const e of levelRecord.entities ?? []) {
            const why = combatRowRequirement(e.type, ENTITY_CLASSES[e.type]?.as3 ?? null);
            if (why) {
                needsRow.push(`"${e.type}" (${ENTITY_CLASSES[e.type]?.as3 ?? null}) `
                    + `at (${e.x},${e.y}) — ${why}`);
            }
        }
        if (needsRow.length > 0) {
            fail(`${where} contains ${needsRow.length} entit(ies) that need a COMBAT row `
                + `and have none: ${needsRow.join('; ')}. Add them to combat.js's `
                + 'ENEMY_CLASSES or PUZZLEMENT_HAZARDS with their damage, aggro reach, '
                + 'timing class and setHitbox args — a route that consults `combat` has '
                + 'retired `noDamage`, so an unpriced hazard is a contact nobody planned.');
        }
        /**
         * ⛔⛔ THE CENSUS SEES THE CLEARS TOO — see `clearedAwayByTag`.
         *
         * It used to be `combatCensusOf(levelRecord)`, straight off the raw
         * record, so a body a clear had removed from the geometry was still
         * in the census: present for the contact test and the hazard
         * pricing, absent for the route. L8's two sandtraps are removed by
         * the clears their own deaths write and the walk goes down their
         * column, so the disagreement was a `mover`-class throw at best and
         * a phantom contact at worst.
         *
         * ⚠ The filter is applied to the RECORD, not to the census's output
         * rows, because `combatCensus` also counts and classifies — a
         * post-filter would leave the counts describing a room that is not
         * there.
         */
        combat = combatCensusOf(clearedTags
            ? {
                ...levelRecord,
                entities: (levelRecord.entities ?? [])
                    .filter((e) => !clearedAwayByTag(e, clearedTags)),
            }
            : levelRecord);
    }

    // ⚠ A CLEAR NOBODY RESPONDS TO IS A THROW, not a no-op. The clear list
    // is DERIVED from named blockers, so an entry that matches nothing in
    // its level is a bookkeeping error in the derivation — and the failure
    // it would otherwise cause is a route planned around a door that never
    // opened, which surfaces as a physics divergence 2000 ticks later.
    if (clearedTags) {
        const orphans = [...clearedTags].filter((t) => !clearsUsed.has(t));
        if (orphans.length > 0) {
            fail(`${where}: the tape clears tag(s) ${orphans.join(', ')}, which no `
                + 'entity in this level reads. A clear is derived from a named blocker; '
                + 'one that matches nothing is a derivation error, not a harmless '
                + 'extra. (Entities that read persistence here: '
                + `${[...clearsUsed].sort((a, b) => a - b).join(', ') || 'none'}.)`);
        }
    }

    const widthPx = levelRecord.width * TILE_SIZE;
    const heightPx = levelRecord.height * TILE_SIZE;

    return {
        level,
        width: levelRecord.width,
        height: levelRecord.height,
        // Shaped for `playerPhysicsV1.clampFor` — `Game.as:1854-1855`
        // overwrites FP.width/height from the level file on every load, so
        // the clamp is per-level and reads THESE, not the 160x160 screen.
        world: Object.freeze({ width: widthPx, height: heightPx }),
        roles: [...roles],
        tiles,
        walkableTiles,
        /**
         * ⛓ R5: the entities a HELD ITEM removed at build time, and the key
         * the inventory they were tested against hashes to.
         *
         * `addedTimeKey` is what a memoising caller compares: `new Game(n,
         * ...)` re-runs every `added()` on every visit, so a level first
         * entered without `fire` and re-entered with it is built twice and
         * differently, and a memo keyed on the level alone serves the first
         * build to the second visit.
         */
        addedTimeRemoved,
        addedTimeKey: addedTimeKey(inventory),
        /**
         * Where a pit in THIS level drops the player, from its `control`
         * block: `{level, offsetX, offsetY, sign}`, or **null** when the
         * level has none — and null is not "no pits here", it is LETHAL.
         * `checkFallingInPit` guards on `Game.fallthroughLevel > -1` and
         * calls `die()` otherwise, and 27 of the 116 levels hold pit tiles
         * with no control block (all of Dungeon 6 and most of Dungeon 8
         * among them). Walking onto one of those is not a divergence, it is
         * a death, which is why pit tiles are forbidden floor for the
         * planner everywhere except a leg's named exit.
         */
        fallthrough,
        /** Pit tiles, for the planner's forbidden-floor policy. */
        get pitTiles() { return walkableTiles.filter((t) => t.t === PIT_STATE); },
        /**
         * Water and lava tiles, for R4's forbidden-floor policy.
         *
         * ⚠ EXPOSED BECAUSE MODELLING THEM TOOK THEM OFF THE OTHER LIST,
         * which is the same trap R1 hit with pits and for the same reason.
         * Until R4, `plannerBlockerAt` reported an armed lava tile as
         * UNMODELLED TERRAIN and the planner routed around it for free.
         * Adding 17/22/25 to `MODELLED_TILE_TYPES` — which is what lets a
         * tape arm them at all — silently made the planner willing to walk
         * across lava. The policy therefore has to become EXPLICIT, in the
         * driver, beside the pit one.
         *
         * Only the two LETHAL types are here. Ice and waterfall are armed
         * at R4 and are ordinary floor with unusual physics: nothing about
         * standing on them ends a run. Water and lava do — `drownTimer` is
         * never reset off-hazard, so eleven cumulative ticks without the
         * conch (water) or the dark suit (lava) reaches `die()`, which
         * `noDamage` does not guard.
         */
        get lethalTerrainTiles() {
            return walkableTiles.filter((t) => t.t === WATER_STATE || t.t === LAVA_STATE);
        },
        /**
         * ⚠ WATERFALL TILES, which are the THIRD floor policy and the one
         * the docblock above says does not exist.
         *
         * It was right that nothing about standing on a waterfall ends a
         * run, and wrong that that makes it ordinary floor.
         * `Player.input()`'s last act is `v.y += 0.8` on a waterfall tile,
         * exempted for UPWARD motion only and only with the feather
         * (`!hasFeather || v.y >= 0`) — and the water move speed is far
         * below 0.8. So an armed waterfall is a ONE-WAY DOWNWARD tile
         * without the feather: a walk that plans across one climbs at a
         * negative rate and stalls for its whole per-waypoint budget.
         *
         * Found by the R4 route, in level 0, on the way to the feather
         * itself — the one leg on the ladder that necessarily runs before
         * the item that exempts it. R3 never saw it because R3 COERCED
         * waterfall to plain floor, and its walk stood on this very tile for
         * 71 ticks.
         *
         * The gate is the ITEM, like the lethal one; the coercion decides
         * whether the tile is armed at all.
         */
        get waterfallTiles() {
            return walkableTiles.filter((t) => t.t === WATERFALL_STATE);
        },
        solids,
        objectSolids,
        pixelmasks,
        teleporters,
        pickups,
        proximityHazards,
        entryHazards,
        watchers,
        oracles,
        /**
         * ⛓⛓⛓ R6 slice 6f: the Owl, `{id, tag, x, y, ex, ey, persistTag}`,
         * and his four pods, `{id, tag, x, y, ex, ey}` — in `.oel` order.
         *
         * ⚠⚠ UNFILTERED, AND THAT IS A NAMED BOUND RATHER THAN A CONVENTION.
         * `FinalBoss.check()` really does `FP.world.remove(this)` on a CLEARED
         * tag, so a room REBUILT after the kill has no boss — but `finalboss`
         * has no `PERSISTENCE_RESPONSE` row, so this package neither offers
         * `{112,0}` as a clear nor despawns him from one. W-owl never rebuilds
         * L112 (the window ends 109 ticks after the third lava hit, inside the
         * same visit), so the case is unreachable from any committed tape and
         * is left declared rather than modelled. A slice that re-enters the
         * room after the kill owes the row.
         */
        finalBosses,
        pods,
        activators,
        pressers,
        /**
         * R4: the pushable blocks, `{id, tag, as3, family, x, y}`.
         *
         * The `blocking` role already lists each of them in `solids` (with
         * a `pushableId` on the entry); this is the same set from the other
         * side, for the run that has to hold their live positions. A block
         * is the one solid on the map whose rect is a function of what the
         * player has DONE, and `collidesSolid`/`plannerBlockerAt` take that
         * live map as an option for exactly the reason they take
         * `openActivators`: the geometry is static, the state is the run's.
         */
        pushables,
        /**
         * ⛔⛔ R5 slice 9: the chests, `{id, tag, x, y, persistTag}`.
         *
         * The join cell of L38 is one of these, and `Chest.open()`'s
         * `type = ""` is the passage — an entity state change with no flag
         * and no `t`. `chest.js` owns the live half; `collidesSolid` drops
         * an OPENED chest's solid the way it drops a broken rock's.
         */
        chests,
        /**
         * ⛓⛓ R5 slice 12: the level's `BurnableTree`s, `{id, tag, x, y,
         * rect}` — the EIGHTH geometry family's roster.
         *
         * ⚠ ALREADY FILTERED BY `check()`: a tree whose tag this run has
         * cleared is not in this list and not in `solids` either, because
         * the game builds the room without it. A caller that wanted "every
         * tree the .oel declares" would have to ask the extract; what a
         * route needs is what the level HAS.
         */
        burnableTrees,
        /**
         * ⛔ R6 slice 2: the `MagicalLock`s, `{id, tag, lockType, x, y, ex,
         * ey, rect}`. The `blocking` role already lists each of them in
         * `solids` (with a `magicalLockId`); this is the same set from the
         * side the wand verb needs — `lockType` is what decides whether a
         * plain shot opens it at all.
         */
        magicalLocks,
        /**
         * ⛓⛓⛓ R5 slice 15: the crushers, `{id, tag, x, y, ex, ey, t, rect}`.
         *
         * The NINTH per-visit family and the first SELF-PROPELLED one. `ex`/
         * `ey` are the entity point (`x + Tile.w`, `y + Tile.h`), which is
         * what `update()`'s `Math.round` snap operates on and what
         * `collideLine` casts for the sight test — the OEL pair is the box's
         * corner and the two are 16 px apart.
         *
         * ⚠ UNFILTERED BY DESIGN. `Spinner`'s roster applies `check()`;
         * `Crusher` has no persistence of any kind, so every visit gets every
         * crusher back at its ctor cell.
         */
        crushers,
        /**
         * ⛓⛓⛓ R5 slice 20: the ice turrets, `{id, tag, x, y, ex, ey,
         * aliveRect}`. Unconditional like the crushers' — `IceTurret` has no
         * `check()`, no `removed()` and no persistence of any kind, so a
         * rebuild REVIVES it and a window plan may never carry a corpse
         * across a re-boot.
         */
        iceTurrets,
        /**
         * ⛓⛓⛓ R5 slice 23: the boss totems, `{id, tag, x, y, ex, ey,
         * persistTag, preWakeRect}`.
         *
         * Unconditional, like the turrets': `BossTotem` has a `check()` that
         * removes it on a CLEARED tag, which `buildLevelWorld`'s own
         * persistence arm already handles — so a roster entry means the
         * entity is in the world, and whether it is SOLID is the run's.
         */
        bossTotems,
        /**
         * ⛓⛓⛓ R6 slice 5: the shield bosses, `{id, tag, x, y, ex, ey,
         * persistTag, aliveRect}`.
         *
         * Unconditional for the same reason the totems' list is:
         * `ShieldBoss.check()` removes the body on a CLEARED tag, and the
         * build's own persistence arm already applies that — so a roster
         * entry means the entity exists, and whether it is still a WALL is
         * the run's per-visit business.
         */
        shieldBosses,
        /**
         * ⛓⛓⛓ R6 slice 6c: the final door, `{id, tag, x, y, ex, ey,
         * persistTag, standingRect}`.
         *
         * Unconditional, like the bosses': `FinalDoor.check()` removes the
         * body on a CLEARED tag and the build's own persistence arm already
         * applies that, so a roster entry means the entity exists and
         * whether it is still a WALL is the run's per-visit business.
         */
        finalDoors,
        /**
         * ⛓⛓ R5 slice 9: the pulsers, `{id, tag, x, y, t}`.
         *
         * ⚠ NOT ACTIVATORS, deliberately (§21.65): a Pulser is Solid either
         * way, so "open" would read as passable. Its `t` decides whether it
         * HITS, and `pulser.js` owns that cycle.
         */
        pulsers,
        /**
         * ⛓⛓⛓ R7 slice 6b: the arrow traps,
         * `{id, tag, x, y, ex, ey, t, shootDefault}`.
         *
         * ⚠ NOT ACTIVATORS, and the reason is the pulsers' reason with the
         * sign flipped: a Pulser is Solid either way, and an ArrowTrap is
         * Solid NEITHER way — `ArrowTrap` calls no `setHitbox` and assigns
         * no `type`, so it is in no solids list and "open" is not a question
         * anyone can ask of it. Its `t` decides whether it SHOOTS, and
         * `arrowTrap.js` owns that cadence and the arrows it makes.
         *
         * ⛔ Unconditional, like the spinners' and for the same reason: the
         * `combat` role is opt-in, and a room whose traps went unmodelled
         * because nobody asked for combat is §25.3's vacuity again.
         */
        arrowTraps,
        /**
         * ⛔⛔ R5 slice 10: the fall rocks, `{id, tag, as3, x, y, t, persistTag}`.
         *
         * In NO solids list, because a parked rock is `type = ""` at
         * `y = -16`. It gets there through the run's `fallenRocks` set once
         * an activator publication has dropped it — see `fallRock.js`, and
         * `r5Totem.GROUP_6` for the four slices this was believed impossible.
         */
        fallRocks,
        /**
         * ⛔⛔ R5 slice 13: the live `Spinner`s, `{id, tag, as3, x, y, persistTag}`.
         *
         * In NO solids list — a spinner does not block the PLAYER, and that
         * verdict is still exactly right. It reaches the geometry through the
         * run's per-visit state, and only for the movers whose own `solids`
         * carry `"Enemy"`.
         *
         * ⛔ R6 SLICE 2: that used to read *"a `PushableBlock*`, and nothing
         * else in the game"*, and it is no longer true — `WandShot`'s ctor
         * pushes `"Enemy"` too, so a spinner STOPS a wand shot. The
         * exclusivity claim was a census of the movers that existed when it
         * was written. See `spinner.js` and `SOLIDS_BY_MOVER.wandshot`.
         */
        spinners,
        /**
         * R4: every entity in this level that `Player.genericHit` names,
         * with the arm it takes and what that arm COSTS a run.
         *
         * ⚠ EMPTY IS NOT "NOTHING RESPONDS" unless the world was built
         * with the `blocking` role — the dispatch needs the `type` and the
         * hitbox that role transcribes, and a relaxed world has neither.
         * `pressRespondersIn` refuses rather than answering emptily.
         */
        pressResponders,
        /** R4: the enemy roster, for the per-walk press arithmetic. */
        pressEnemies,
        /**
         * R5: the combat census, PER INSTANCE — or **null** when the caller
         * did not consult the `combat` role.
         *
         * ⚠ NULL, NOT AN EMPTY CENSUS, and that distinction is the same one
         * `pressResponders` draws: an empty list would read as "nothing here
         * can hurt you", which is the single most dangerous thing this
         * module could say untruthfully. A relaxed world has not paid for
         * the answer and says so.
         */
        combat,
        /**
         * R4: the bridge tiles, which are press responders too — the one
         * arm of `genericHit` that dispatches on `Tile` and the only
         * reason `bridgeOpeningTimer` ever moves.
         *
         * Read off `tiles` rather than collected beside the entities
         * because a bridge is terrain: it has no `.oel` object, its rect
         * is its cell, and `bridges.js` owns everything else about it.
         */
        get bridgeTiles() { return tiles.filter((t) => t.t === BRIDGE_STATE); },

        /**
         * The R0 avoid-volume query: every pickup or proximity hazard the
         * box overlaps.
         *
         * Deliberately SEPARATE from `plannerBlockerAt`. Those two answer
         * different questions and mixing them would change what the v2
         * driver plans around — and the v2 fixtures are recordings, so a
         * re-route is a fixture rewrite. This one is consulted only by a
         * relaxed walk, and only for the roles the world was built with:
         * a world built without the `pickup` role has no pickups to report,
         * which is honest rather than empty.
         */
        avoidVolumesAt(box, pos = null, { keys = null } = {}) {
            const hits = [];
            for (const p of pickups) {
                if (rectsOverlap(box, p.rect)) hits.push({ kind: 'pickup', blocker: p });
            }
            for (const h of proximityHazards) {
                // The one conditional volume — see the `keyType` note where
                // these are built. `keys === null` is "the caller did not
                // say", which keeps every pre-R4 call site exactly as
                // permissive as it was: a walk that cannot hold a key is a
                // walk the line cannot fire on.
                if (h.keyType !== null && h.keyType !== undefined
                    && !(keys && keys.has(h.keyType))) continue;
                let hit;
                if (h.disc) {
                    // `FP.distance(x, y, player.x, player.y) <= range`, with
                    // the result assigned to an `int` — so the true bound is
                    // `dist < range + 1` and `r` already carries the +1.
                    // Needs the player's POSITION; a caller that only has a
                    // box gets it from the box's own origin.
                    hit = Math.hypot(
                        (pos ? pos.x : box.x + HITBOX_ORIGIN_X) - h.disc.x,
                        (pos ? pos.y : box.y + HITBOX_ORIGIN_Y) - h.disc.y,
                    ) < h.disc.r;
                } else if (h.line) {
                    // `World.collideLine` at precision 1: does the box
                    // CONTAIN one of the row's integer probes? See the `line`
                    // note where these are built for why a rect is not this.
                    hit = box.y <= h.line.y && h.line.y < box.bottom
                        && Math.max(h.line.x0, Math.ceil(box.x))
                            <= Math.min(h.line.x1, Math.ceil(box.right) - 1);
                } else {
                    hit = rectsOverlap(box, h.rect);
                }
                if (hit) hits.push({ kind: 'proximity-hazard', blocker: h });
            }
            return hits;
        },

        /**
         * The sweep's candidate test: `collideTypes(solids, x + d, y)`.
         * Returns the first blocker or null — the AS3 sweep consumes only
         * null/non-null, so list order does not affect movement.
         *
         * Pixelmask colliders are tested PER PIXEL from R2 (`maskHitsBox`),
         * having been an unconditional throw at v2. The throw survives for
         * a pixelmask entry with no committed `mask` — `maskPlacement`
         * raises it at BUILD time now, which is strictly earlier and names
         * the class rather than the fixture.
         *
         * ⚠ `opts.beforeTypeFlip` selects the world as it exists on its
         * very FIRST live tick, when no tile is solid yet. See the note on
         * `nearestWalkableTile` — this is the same one fact seen from the
         * other side, and it is transcribed rather than tidied because the
         * game's own comment says the order is deliberate.
         */
        collidesSolid(box, opts = {}) {
            const {
                beforeTypeFlip = false,
                fallenRocks = null,
            } = opts;
            const live = assertNormalizedLiveOpts(normalizeLive(opts), 'levelWorld.collidesSolid');
            // Pixelmask entities (Building, TreeLarge, CliffSide) assign
            // their type in the CONSTRUCTOR, so they are armed on tick 1
            // too — only Tiles are late.
            for (const p of pixelmasks) {
                if (maskHitsBox(p.mask, p.maskX, p.maskY, box)) return p;
            }
            // ⛔⛔ R5 SLICE 10: a rock the run has DROPPED. It is the only
            // member of this family that ADDS a solid rather than removing or
            // moving one — a parked `FallRock` is in no list at all, and
            // `type = "Solid"` is written on the landing tick. So the check
            // is above the `solids` loop rather than inside it: there is no
            // entry to `continue` past.
            if (fallenRocks) {
                for (const r of fallenRocks.values()) {
                    if (rectsOverlap(box, r.rect)) return { ...r, fallen: true };
                }
            }
            for (const s of (beforeTypeFlip ? objectSolids : solids)) {
                // ⛓⛓⛓ R5 SLICE 15: ONE CHAIN, SHARED WITH THE PLANNER AND
                // WITH THE CRUSHER'S SIGHT LIST. See `liveRectOf`.
                const at = liveRectOf(s, live);
                if (at === null) continue;
                if (!rectsOverlap(box, at)) continue;
                // ⚠ THE PLAIN ARM RETURNS THE ENTRY ITSELF, not a copy: two
                // callers compare blockers by identity, and a spread here
                // would silently make every one of those comparisons false.
                if (at === s.rect) return s;
                return { ...s, rect: at, live: true };
            }
            return null;
        },

        /**
         * ⛓⛓⛓ R5 SLICE 15: THE LIVE `"Solid"` LIST, AS A LIST.
         *
         * Every consumer before this one asked "does this box hit a solid",
         * so a predicate was enough. A `Crusher` asks a question no predicate
         * answers: `collideLine("Solid", x, y, p.x, p.y)` walks the type list
         * sampling POINTS, so the model needs the boxes themselves.
         *
         * ⛔⛔ AND IT IS A NARROWER LIST THAN THE PLAYER'S, WHICH IS WHY IT IS
         * A SEPARATE ENTRY POINT AND NOT A SPREAD OF `solids`.
         *
         * ```
         *   Player.solids   ["Solid","Tree","Rock","Rope","ShieldBoss"]  (Mobile.as:17)
         *                 + "LavaBoss"                                   (Player.as:377)
         *   Crusher.solids  ["Solid"]                                    (Crusher.as:22)
         * ```
         *
         * — and `collideLine`'s type argument is `"Solid"` too. So a `Tree`
         * neither shields a crusher nor stops its charge, while it does both
         * for the player. `world.solids` is the PLAYER's list; handing it
         * over whole would make a crusher stop at a tree and report a clean
         * "it cannot see you" from behind one. The filter is by AS3 type: a
         * Tile has no `cls` and is `type = "Solid"` once flipped.
         *
         * ⚠ THE OVER-APPROXIMATION WOULD HAVE BEEN INERT TODAY AND WRONG
         * ANYWAY — L41 and L42 hold 196 and 198 tiles plus 6 and 2
         * `type: "Solid"` entities between them and no Tree, Rope,
         * ShieldBoss or LavaBoss at all, so nothing is dropped in either
         * room. `assertCrusherSolidsBound` is what keeps that a measurement
         * rather than an assumption ([[feedback_notsolid_is_per_mover]],
         * which is the same lesson the spinner taught one family ago).
         *
         * @param {object} opts   the same live-state options `collidesSolid`
         *                        takes, so the two can never disagree
         * @param {string|null} exclude  an id to leave out — the game does it
         *                        with a temporary `type = "BS"` swap on the
         *                        scanning crusher itself, and `moveX`'s
         *                        `collideTypes` excludes `this` too
         */
        solidBoxesForMover(opts = {}, exclude = null) {
            const live = assertNormalizedLiveOpts(normalizeLive(opts), 'levelWorld.solidBoxesForMover');
            const out = [];
            // ⛔⛔ R5 slice 10's family is in no `solids` entry at all — a
            // parked `FallRock` has `type = ""` at `y = -16` and a landed one
            // is a 16x16 `"Solid"`. `collidesSolid` handles it above its own
            // loop for that reason and this has to do the same, or a crusher
            // charges through a rock the run dropped.
            if (opts.fallenRocks) {
                for (const r of opts.fallenRocks.values()) {
                    out.push({ ...r.rect, id: r.id, tag: 'fallrock' });
                }
            }
            for (const s of solids) {
                if (s.cls && s.cls.type !== 'Solid') continue;
                if (exclude !== null && s.crusherId === exclude) continue;
                const at = liveRectOf(s, live);
                if (at === null) continue;
                out.push({
                    ...at,
                    id: s.crusherId ?? s.pushableId ?? s.rockId ?? s.treeId ?? s.chestId ?? null,
                    tag: s.tag,
                    rockId: s.rockId,
                });
            }
            return out;
        },

        /**
         * ⛓⛓⛓ R5 SLICE 22: THE BLAST'S OWN LIST — A THIRD ONE, AND IT
         * OVERLAPS NEITHER OF THE OTHER TWO.
         *
         * ```
         *   Player.solids            ["Solid","Tree","Rock","Rope","ShieldBoss"]
         *                          + "LavaBoss"
         *   Crusher.solids           ["Solid"]
         *   IceTurretBlast.hitables  ["Player","Tree","Solid","Shield"]
         * ```
         *
         * ⇒ a blast is stopped by a TREE, which a crusher is not, and flies
         * THROUGH a `Rope`, a `ShieldBoss` and a `LavaBoss`, which the player
         * is not. Neither existing entry point answers it, and reusing
         * either would be wrong in a different direction — the player's
         * over-stops the blast (a rope becomes cover the game does not
         * give), the crusher's under-stops it (a tree stops being cover the
         * game does give, and cover is what a kill leg PRICES).
         * [[feedback_notsolid_is_per_mover]], third mover.
         *
         * ⚠ AND `"Player"` IS NOT IN HERE. The blast's own step tests the
         * player box directly, because the player is not a member of any
         * geometry list this module owns.
         */
        collidesBlast(box, opts = {}) {
            const { fallenRocks = null } = opts;
            const live = assertNormalizedLiveOpts(normalizeLive(opts), 'levelWorld.collidesBlast');
            // A `Building`/`TreeLarge`/`CliffSide` is `type = "Solid"`, and
            // the game's `collideTypesInto` runs the same `Pixelmask` test
            // `collidesSolid` does — the mask, not the bounding rect.
            for (const p of pixelmasks) {
                if (maskHitsBox(p.mask, p.maskX, p.maskY, box)) return p;
            }
            if (fallenRocks) {
                for (const r of fallenRocks.values()) {
                    if (rectsOverlap(box, r.rect)) return { ...r, fallen: true };
                }
            }
            for (const s of solids) {
                if (s.cls && !BLAST_HITABLE_TYPES.has(s.cls.type)) continue;
                const at = liveRectOf(s, live);
                if (at === null) continue;
                if (!rectsOverlap(box, at)) continue;
                if (at === s.rect) return s;
                return { ...s, rect: at, live: true };
            }
            return null;
        },

        /**
         * ⛓⛓⛓ R8 SLICE 3: THE ARROW'S COVER QUERY — see `ARROW_HITABLE_TYPES`
         * for why it is a fourth list and not a reuse of the blast's.
         *
         * ⚠ THE PIXELMASK ARM IS THE SAME ONE, and it has to be: a `Building`
         * / `TreeLarge` / `CliffSide` is `type = "Solid"` and the game's
         * `collideTypesInto` runs FlashPunk's `Pixelmask` test, so an arrow
         * stops on the MASK and not on the bounding rect. An arrow query that
         * skipped it would fly through the transparent corner of a tree and
         * kill a body the game leaves standing.
         */
        collidesArrowCover(box, opts = {}) {
            const { fallenRocks = null } = opts;
            const live = assertNormalizedLiveOpts(normalizeLive(opts), 'levelWorld.collidesArrowCover');
            for (const p of pixelmasks) {
                if (maskHitsBox(p.mask, p.maskX, p.maskY, box)) return p;
            }
            if (fallenRocks) {
                for (const r of fallenRocks.values()) {
                    if (rectsOverlap(box, r.rect)) return { ...r, fallen: true };
                }
            }
            for (const s of solids) {
                if (s.cls && !ARROW_HITABLE_TYPES.has(s.cls.type)) continue;
                const at = liveRectOf(s, live);
                if (at === null) continue;
                if (!rectsOverlap(box, at)) continue;
                if (at === s.rect) return s;
                return { ...s, rect: at, live: true };
            }
            return null;
        },

        /**
         * The STATIC boxes a blast could ever be stopped by, for the reach
         * bound that lets a spent blast be dropped. Static on purpose: a
         * mover's live rect never leaves its own family's footprint by more
         * than the level rect, which is in the union at the call site.
         */
        solidBoxesForBlast() {
            const out = [];
            for (const p of pixelmasks) out.push({ ...p.rect });
            for (const s of solids) {
                if (s.cls && !BLAST_HITABLE_TYPES.has(s.cls.type)) continue;
                out.push({ ...s.rect });
            }
            return out;
        },

        /**
         * `FP.world.nearestToPoint("Tile", x, y)` with the default
         * `useHitboxes = false` — squared distance to each entity's x/y,
         * which for a Tile is its CENTRE (`World.as:640-668`).
         *
         * ⛓ TIES RESOLVE BY ENTITY-LIST ORDER, AND R5 SLICE 4 TRANSCRIBES
         * IT (see `nearestWalkableTileWithTie` for the citation and the
         * witness). Until then this kept the extract's order and asked
         * fixtures to stay off exact ties — which stopped being possible
         * the moment a route had to ENTER L47, whose arrival from L46 lands
         * the probe exactly between a snow tile and an ice one.
         *
         * ⚠ `opts.beforeTypeFlip` searches ALL tiles instead of the
         * walkable ones. On a world's very first live tick every Tile is
         * still typed `"Tile"` — the flip happens in each Tile's own first
         * `update()` (`Tile.as:117-122`), and `World.addUpdate` PREPENDS
         * while `loadlevel` adds the tiles (`Game.as:1902-2007`) before the
         * Player (`:2040`), so the Player updates FIRST and reads the
         * pre-flip lists. The game's own comment at that update says this
         * is deliberate ("after all of the objects have run their
         * first-frame check"), so it is transcribed, not fixed. It is very
         * hard to observe — a fresh Player has v = 0, so tick 1 moves at
         * most 0.8 px, and every SOLID tile type happens to carry the plain
         * 0.8 walk speed, so a first-tick state of 9 (Cliff) and one of 0
         * (Ground) pick the same physics. Modelled anyway: "unobservable"
         * is a claim about today's fixtures, not about the game.
         */
        nearestWalkableTile(x, y, opts = {}) {
            return this.nearestWalkableTileWithTie(x, y, opts).tile;
        },

        /**
         * The same single pass, in the GAME'S OWN LIST ORDER, also reporting
         * an exact tie.
         *
         * ⛓ R5 SLICE 4: THE TIE-BREAK IS TRANSCRIBED, and the witness for
         * it was recorded on this arc at R1.
         *
         * `nearestToPoint` walks `_typeFirst["Tile"]` and keeps a candidate
         * only on a STRICT `dist < nearDist` (`World.as:640-668`), so among
         * equidistant tiles the one EARLIEST IN THE LIST wins. And
         * `World.addType` PREPENDS (`World.as:1016-1029`:
         * `_typeFirst[type]._typePrev = e; e._typeNext = _typeFirst[type]`),
         * while `loadlevel` adds the tiles in the extract's own order — so
         * **the list is the reverse of the extract, and a tie is won by the
         * tile that appears LATER in the extract.**
         *
         * ⚠ THE WITNESS IS A GAME RECORDING, not this reading. R1's first
         * pit recording walked UP from a tile centre, putting the probe on
         * y = 32.0 exactly, equidistant from tiles (2,1) and (2,2) of level
         * 83. **The GAME fell into the pit and the model did not** — the
         * model was picking the extract's earlier tile and the game the
         * later one. That divergence is what this rule predicts, and the
         * 59 committed recordings are what it is checked against: every one
         * of them was produced by the real game, so a tie-break that
         * changed any of their streams would be a wrong one.
         *
         * ⚠ AND AN OPEN BRIDGE IS AT THE HEAD OF THE LIST, not the tail.
         * `Tile.render`'s `<= 0` arm writes `type = "Tile"`, and the
         * `Entity.type` setter is `removeType` then `addType` — which
         * PREPENDS. A bridge that opened mid-run therefore joined the list
         * after every static tile, which puts it FIRST, which means it wins
         * every tie it is in. Scanned first here for exactly that reason;
         * it also happens to be the difference between walking across a
         * bridge and falling down the pit beside it (L63's is surrounded by
         * pit), which is why it is a candidate at all.
         *
         * `tie` is still REPORTED, because a tie is worth seeing even when
         * it is decided: it is the shape that used to be a throw, and
         * `playerPhysicsV2.resolveTerrainState` still names one whose two
         * candidates lead somewhere different — as a finding in the stream
         * rather than as an abort.
         */
        nearestWalkableTileWithTie(x, y, { beforeTypeFlip = false, openBridges = null } = {}) {
            let best = null;
            let bestDist = Infinity;
            let tie = null;
            const scan = (tile) => {
                const dx = tile.x - x;
                const dy = tile.y - y;
                const d = dx * dx + dy * dy;
                if (d < bestDist) {
                    bestDist = d;
                    best = tile;
                    tie = null;
                } else if (d === bestDist && best && tile.t !== best.t && !tie) {
                    tie = tile;
                }
            };
            // ── the list, in the order `nearestToPoint` walks it ─────────
            if (openBridges && openBridges.size > 0 && !beforeTypeFlip) {
                for (const tile of tiles) {
                    if (tile.t === BRIDGE_STATE && openBridges.has(`${tile.tx},${tile.ty}`)) {
                        scan(tile);
                    }
                }
            }
            const list = beforeTypeFlip ? tiles : walkableTiles;
            for (let i = list.length - 1; i >= 0; i -= 1) scan(list[i]);
            return { tile: best, tie };
        },

        /**
         * The PLANNER's view of the same geometry: what would stop, throw or
         * strand the player at this position — reported, never thrown.
         *
         * `collidesSolid` above is the PHYSICS query and it throws on a
         * pixelmask deliberately, so a tape that strays dies loudly. A
         * planner cannot use it: routing around an obstacle by catching the
         * exception that says you already hit it is not routing around it,
         * and one stray probe would abort the whole search. So the seam has
         * two faces, and the difference is exactly which of them is allowed
         * to be quiet:
         *
         *   collidesSolid      physics — pixelmask THROWS, and must
         *   plannerBlockerAt   planning — pixelmask is just a blocker
         *
         * The planner's is the STRICTLY WIDER notion of "blocked", because
         * it also reports the two things that do not stop the player at all
         * but end the run anyway:
         *   - a pixelmask, which the physics refuses to model;
         *   - an UNMODELLED TERRAIN tile (water, pit, lava, ice, waterfall)
         *     overlapping the terrain probe rect. Those tiles are WALKABLE
         *     geometry — nothing blocks the player — but standing on one
         *     makes `assertModelledTerrain` throw. A planner that only asked
         *     about solids would route a fixture straight into the lake.
         *
         * `probeRect` is `playerPhysicsV2.terrainProbeRect(x, y)`; pass it
         * whenever the position is one the player would actually occupy.
         * Omitting it skips the terrain arm (useful for asking a pure
         * geometry question), which is why it is an explicit argument rather
         * than derived from `box` here — this module does not own the
         * probe's offset.
         *
         * The terrain arm OVER-approximates: it reports any unmodelled tile
         * the probe rect touches, while `resolveTerrainState` picks only the
         * NEAREST walkable tile and only when that one intersects. Wider is
         * the right direction — an over-report routes the fixture elsewhere,
         * an under-report is a run that dies mid-tape.
         *
         * Steady state only: no `beforeTypeFlip`. The first-tick pre-flip
         * world is strictly more permissive (no tile is solid yet), so
         * planning against the flipped world can only be more conservative.
         *
         * ⚠ `opts` mirrors the TAPE's relaxations, and must: a planner that
         * routed around a wall the tape's `noclip` walks through, or around
         * water the tape's `noHazards` has flattened, would be planning for
         * a different run than the one it emits.
         *   `noclip`     skip the solid and pixelmask arms entirely
         *   `noHazards`  coerce a tile's type before asking whether the
         *                terrain arm models it — so a disabled hazard stops
         *                being an obstacle, and one still armed does not
         */
        plannerBlockerAt(box, probeRect = null, opts = {}) {
            const { noclip = false, noHazards = [], fallenRocks = null } = opts;
            const live = assertNormalizedLiveOpts(normalizeLive(opts), 'levelWorld.plannerBlockerAt');
            if (!noclip) {
                // ⛔⛔ R5 slice 10: a dropped rock ADDS a solid, so the
                // planner has to be told about it the same way the collision
                // query is. A route that pulls a rope and then walks back the
                // way it came is the case this exists for — L39's rock lands
                // ON the teleporter home.
                if (fallenRocks) {
                    for (const r of fallenRocks.values()) {
                        if (rectsOverlap(box, r.rect)) {
                            return { kind: 'solid', blocker: { ...r, fallen: true } };
                        }
                    }
                }
                // ⚠ THE PLANNER USES THE REAL MASK, not the bounding rect.
                // The conservative direction is normally right for routing,
                // but not here: L65's exit to the health room sits inside
                // `OpenTreeMask`'s 10x12 doorway, so the bounding rect
                // refuses a corridor the game walks (R2 kickoff §8.5). This
                // is Phase 5a's "the sprite rect swallows a building's own
                // doorway" as a route-critical fact rather than a caveat.
                // No committed R1 recording can change: they all declare
                // `noclip`, which skips this arm entirely.
                for (const p of pixelmasks) {
                    if (maskHitsBox(p.mask, p.maskX, p.maskY, box)) {
                        return { kind: 'pixelmask', blocker: p };
                    }
                }
                for (const s of solids) {
                    // ⛓⛓⛓ R5 SLICE 15: the SAME chain `collidesSolid` walks
                    // — `liveRectOf`. Until this slice the two were separate
                    // transcriptions of nine arms, which is the §28.2 defect
                    // with the copies one layer lower down.
                    //
                    // ⚠ THE PLANNER'S VIEW OF A MOVER IS A SNAPSHOT AND
                    // CANNOT BE ANYTHING ELSE. A crusher's box here is where
                    // it is on the tick the question is asked, which is only
                    // a route-safe answer once it is PARKED — hence
                    // `CRUSHER_PLAN`'s two phases: a bait choreography
                    // verified tick by tick against `stepCrusher`, and only
                    // then a flood against this.
                    const at = liveRectOf(s, live);
                    if (at === null) continue;
                    if (!rectsOverlap(box, at)) continue;
                    if (at === s.rect) return { kind: 'solid', blocker: s };
                    return { kind: 'solid', blocker: { ...s, rect: at, live: true } };
                }
            }
            if (probeRect) {
                for (const tile of walkableTiles) {
                    const effective = coerceTerrainState(tile.t, noHazards);
                    if (!MODELLED_TILE_SET.has(effective)
                        && rectsOverlap(probeRect, tile.rect)) {
                        return { kind: 'terrain', blocker: tile };
                    }
                }
            }
            return null;
        },

        /** Every live teleporter whose trigger volume the box overlaps. */
        teleporterHit(box) {
            return teleporters.filter(
                (tp) => !tp.deactivated && rectsOverlap(box, tp.rect),
            );
        },

        /** Guard for the terrain resolver (slice 2). */
        assertModelledTerrain(t) {
            if (!MODELLED_TILE_SET.has(t)) {
                fail(`tile type ${t} (${TILE_TYPE_NAMES[t]}) is not modelled at the v2 `
                    + `rung: ${UNMODELLED_REASON[t] ?? 'no reason recorded'}`);
            }
            return t;
        },
    };
}
