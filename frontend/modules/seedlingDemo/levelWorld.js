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
        roles: ROLES, collider: 'rect', type: 'Solid',
        dx: 16, dy: 16, w: 32, h: 32, originX: 16, originY: 16,
        // ⚠ ANOTHER ENEMY THAT IS SOLID, and CONDITIONALLY so:
        // `IceTurret.as:93-95` is the ELSE-arm of the `d <= attackRange`
        // test — `else if (!collide("Player", x, y)) type = "Solid"`. It is
        // "Enemy" from the base ctor and becomes "Solid" on any tick the
        // player is outside its 128 px range. Priced as an UNCONDITIONAL
        // solid, which is exact for a route that keeps out of the disc: it
        // blocks precisely when the player is not already inside the volume
        // the hazard below makes the route avoid anyway.

        src: 'Game.as:2086 + Projectiles/IceTurretBlast.as:52',
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
                + 'A tag = -1 rock would be live; there are none.',
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
        src: 'Game.as:2191 + Scenery/Pod.as:70-73',
        why: 'snaps `p.x`/`p.y` to its own position, then calls Player.hit()',
        hazard: 'unpriced',
    },
    bosstotem: {
        as3: 'BossTotem', roles: ROLES, collider: 'none', type: 'Enemy',
        src: 'Game.as:2071 + Enemies/BossTotem.as:284,486',
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
        src: 'Game.as:2074 + Enemies/FinalBoss.as:92',
        why: 'sets `Game.freezeObjects = true` for its intro, and writes persistence',
        hazard: 'unpriced',
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
        'damage only (Spinner.as:75); Spinner.as:50 despawns it on a cleared\n        persistence, which changes nothing about blocking'),
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
        dx: 8, dy: 8, w: 16, h: 24, originX: 8, originY: 12,
        src: 'Game.as:2177 + NPCs/NPC.as:47-59 + NPCs/Oracle.as:13 (Spritemap 16x24)',
        why: 'NPC, keyNeeded true. Its `FP.world = new Game(...)` (Oracle.as:121) is in '
            + 'doneTalking(); the proximity check at :63 is inside render() and only '
            + 'picks an animation',
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
 */
export const FORCED_TSET = Object.freeze({
    shieldlock: -2,       // ShieldLock.as:26
    shieldlocknorm: -2,
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
 */
export const FORCED_TAG = Object.freeze({
    moonrockpile: 0,        // Scenery/MoonrockPile.as:23
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

/** The world rect an entity class occupies when placed at oel (x, y). */
export function entityRect(cls, x, y) {
    return rect(x + cls.dx - cls.originX, y + cls.dy - cls.originY, cls.w, cls.h);
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
            if (response === 'despawn') { clearedHere = true; }
            if (response === 'lock-despawn') {
                // ⚠ `Lock.check()` ALSO needs `tSet < 0`, and `int("")` is 0
                // — so a lock with no `tset` attribute is in group 0 and does
                // NOT despawn. Three route locks and thirteen of fourteen
                // wandlocks turn on this line.
                if (tSetOf(e.type, e.attrs) < 0) clearedHere = true;
            }
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
                // R4: a `BossKey`'s `removed()` writes `Player.hasKeySet`
                // rather than one of the fourteen item properties, so WHICH
                // key it is has to survive the census — a `bosskey` ceremony
                // that could not name its type would grant nothing.
                ...(e.type === 'bosskey'
                    ? { keyType: intAttr(e.attrs, 'keyType', 0) } : {}),
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
        if (consults.has('proximity-hazard') && cls.hazard) {
            if (cls.hazard === 'unpriced') {
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
            if (!cls.hazard.inert) {
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
                    rect: cls.collider === 'rope'
                        ? ropeSpanRect(e, cls, x, y, entityTag, clearedTags, where)
                        : entityRect(
                            cls.as3 === 'LightPole' ? LIGHTPOLE_PRESS_BOX : cls, x, y,
                        ),
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
            const cls = ENTITY_CLASSES[e.type];
            const as3 = cls?.as3 ?? null;
            const dangerous = as3 !== null
                && (HARMFUL_CLASS_SET.has(as3) || TOTAL_ENEMIES_SET.has(as3));
            const hasRow = Boolean(ENEMY_CLASSES[e.type] || PUZZLEMENT_HAZARDS[e.type]);
            if (!hasRow && (dangerous || LOOKS_LIKE_COMBAT.has(e.type))) {
                needsRow.push(`"${e.type}" (${as3}) at (${e.x},${e.y}) — `
                    + (dangerous
                        ? `${as3} reaches the player or is summed by totalEnemies()`
                        : 'it is in the combat vocabulary'));
            }
        }
        if (needsRow.length > 0) {
            fail(`${where} contains ${needsRow.length} entit(ies) that need a COMBAT row `
                + `and have none: ${needsRow.join('; ')}. Add them to combat.js's `
                + 'ENEMY_CLASSES or PUZZLEMENT_HAZARDS with their damage, aggro reach, '
                + 'timing class and setHitbox args — a route that consults `combat` has '
                + 'retired `noDamage`, so an unpriced hazard is a contact nobody planned.');
        }
        combat = combatCensusOf(levelRecord);
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
        collidesSolid(box, {
            beforeTypeFlip = false, openActivators = null, pushables: live = null,
            openBridges = null, brokenRocks = null, pulledRopes = null,
        } = {}) {
            // Pixelmask entities (Building, TreeLarge, CliffSide) assign
            // their type in the CONSTRUCTOR, so they are armed on tick 1
            // too — only Tiles are late.
            for (const p of pixelmasks) {
                if (maskHitsBox(p.mask, p.maskX, p.maskY, box)) return p;
            }
            for (const s of (beforeTypeFlip ? objectSolids : solids)) {
                // R2: a lock or cover whose group is held has `type = ""`,
                // which takes it out of the solids list rather than moving
                // it. `openActivators` is that list, owned by the RUN
                // (`activators.js`) because it is per-tick state and this
                // module builds static geometry.
                if (openActivators && s.activatorId && openActivators.has(s.activatorId)) continue;
                // R4: a bridge whose timer has run out is `type = "Tile"` —
                // it leaves the solids list and JOINS the walkable ones (see
                // `nearestWalkableTileWithTie`, which takes the same set).
                if (openBridges && s.bridgeId && openBridges.has(s.bridgeId)) continue;
                // R5: a BreakableRock whose `endAnim` has fired is
                // `FP.world.remove(this)` — off the list entirely, unlike a
                // lock (type "") or a bridge (type "Tile"). `brokenRocks` is
                // the run's per-VISIT set: a `tag = -1` rock is rebuilt by
                // the next `new Game`, so this may not be baked into the
                // geometry the way a persistence clear is.
                if (brokenRocks && s.rockId && brokenRocks.has(s.rockId)) continue;
                // ⛓ R5 SLICE 7: a rope the player has PULLED. Not a removal
                // and not a type flip — `RopeStart.hit()` runs
                // `setHitbox(16, 16, 8, 8)`, so 112 px of wall becomes 16 px
                // of wall at the span's START. A model that dropped it would
                // open a tile the game keeps, which is why this is a rect
                // swap rather than a `continue`.
                if (pulledRopes && s.ropeId && pulledRopes.has(s.ropeId)) {
                    if (rectsOverlap(box, s.shrunkRect)) return { ...s, rect: s.shrunkRect };
                    continue;
                }
                // R4: a block that has been pushed is not where the level
                // built it. `live` is the run's own state (see
                // `pushables.createPushableState`); WITHOUT it the spawn
                // rect is used, which is exactly right for every tape that
                // never presses and is why no frozen fixture moves.
                if (live && s.pushableId && live.has(s.pushableId)) {
                    // ⚠ A MISSING ENTRY FALLS THROUGH to the spawn rect
                    // below rather than being read as "gone". Absent and
                    // removed are different facts, and only one of them
                    // means the cell is clear.
                    const now = live.get(s.pushableId);
                    if (now.removed) continue;
                    if (rectsOverlap(box, now.rect)) return { ...s, rect: now.rect, live: true };
                    continue;
                }
                if (rectsOverlap(box, s.rect)) return s;
            }
            return null;
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
        plannerBlockerAt(box, probeRect = null, {
            noclip = false, noHazards = [], openActivators = null, pushables: live = null,
            openBridges = null, brokenRocks = null, pulledRopes = null,
        } = {}) {
            if (!noclip) {
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
                    if (openActivators && s.activatorId
                        && openActivators.has(s.activatorId)) continue;
                    if (openBridges && s.bridgeId && openBridges.has(s.bridgeId)) continue;
                    if (brokenRocks && s.rockId && brokenRocks.has(s.rockId)) continue;
                    // ⛓ R5 slice 7: a pulled rope SHRINKS. The planner has
                    // to see the one cell the game keeps, or it routes
                    // through the pulley.
                    if (pulledRopes && s.ropeId && pulledRopes.has(s.ropeId)) {
                        if (rectsOverlap(box, s.shrunkRect)) {
                            return { kind: 'solid', blocker: { ...s, rect: s.shrunkRect } };
                        }
                        continue;
                    }
                    // R4: the planner has to see a pushed block where it
                    // IS. A planner with its own idea of a block's position
                    // would certify the corridor the push opened and then
                    // walk the executor into the block it did not move —
                    // the `openActivators` lesson, one mechanic later.
                    if (live && s.pushableId && live.has(s.pushableId)) {
                        const now = live.get(s.pushableId);
                        if (now.removed) continue;
                        if (rectsOverlap(box, now.rect)) {
                            return { kind: 'solid', blocker: { ...s, rect: now.rect, live: true } };
                        }
                        continue;
                    }
                    if (rectsOverlap(box, s.rect)) return { kind: 'solid', blocker: s };
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
