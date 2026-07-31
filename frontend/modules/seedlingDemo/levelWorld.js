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

/** `Tile.types` index for a Pit — the transport primitive, R1. */
const PIT_STATE = HAZARD_STATES.pit;

export class LevelWorldError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LevelWorldError';
    }
}

const fail = (message) => { throw new LevelWorldError(message); };

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
    18, // Blue Tile
    19, // Blue Wall    (solid)
    20, // Blue Wall dark (solid)
    21, // Snow
    23, // Ice Wall     (solid)
    24, // Ice Wall glowing (solid)
    26, // Body Floor
    27, // Body Wall    (solid)
    28, // Ghost Tile
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
    1: 'Water — moveSpeed and friction couple to Music.soundPosition("Swim")',
    17: 'Lava — same sound-coupled stroke burst as water, plus damage',
    22: 'Ice — rewrites both moveSpeed (1) and friction (0.025)',
    25: 'Waterfall — sound-coupled like water, at half speed',
    29: 'Bridge — rewrites its own entity type from a timer inside render()',
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
export const ROLES = Object.freeze(['blocking', 'trigger', 'pickup', 'proximity-hazard']);

/** The three a relaxed (noclip) walk consults. `blocking` is R2's bill. */
export const RELAXED_ROLES = Object.freeze(['trigger', 'pickup', 'proximity-hazard']);

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
    // --- pixelmask colliders: the loud-throw seam ------------------------
    // Ruled 2026-07-30: NOT modelled. Phase 5a already proved neither
    // rectangle approximation is safe — the sprite rect swallows a
    // building's own doorway, and the mask rect is not a rect at all.
    // Masks are MIT and extractable if a later rung ever needs one.
    // The rect below is the mask's BOUNDING box, used only to decide when
    // to throw: `Pixelmask.collideHitbox` places the mask at
    // `parent.x + _x` (masks/Pixelmask.as:collideHitbox), and the entity
    // carries no hitbox origin, so world rect = [x+dx, +maskW) x [y+dy, +maskH).
    building: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid',
        dx: 0, dy: 0, w: 64, h: 48, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/BuildingMask.png (64x48)',
    },
    building1: {
        as3: 'Building',
        roles: ROLES, collider: 'pixelmask', type: 'Solid',
        dx: 0, dy: 0, w: 48, h: 32, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/Building1Mask.png (48x32)',
    },
    treelarge: {
        as3: 'TreeLarge',
        roles: ROLES, collider: 'pixelmask', type: 'Solid',
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
        as3: 'Button', roles: RELAXED_ROLES,
        src: 'Game.as:2127 + Puzzlements/Button.as:19-40',
        why: 'STANDING ON IT presses it: `collideTypesInto(["Player","Enemy","Solid"], '
            + 'x, y, v)` then `activate = v.length > 0`, which propagates to every '
            + '`Activators` sharing its `t` — including a ButtonRoom, which writes '
            + 'persistence for ANOTHER level (ButtonRoom.as:93). No key needed.',
        hazard: 'unpriced',
    },
    buttonroom: {
        as3: 'ButtonRoom', roles: RELAXED_ROLES,
        src: 'Game.as:2128 + Puzzlements/ButtonRoom.as:93',
        why: 'the other half of `button`: `Game.setPersistence(t, persist, room)` '
            + 'changes what EXISTS in a different level',
        hazard: 'unpriced',
    },
    pull: {
        as3: 'Pull', roles: RELAXED_ROLES,
        src: 'Game.as:2134 + Puzzlements/Pull.as:33-45',
        why: 'moves the player DIRECTLY — `collideTypesInto(["Player",...])` then '
            + '`e.x += force*cos(dir); e.y -= force*sin(dir)` every tick, with no '
            + 'call to Player.hit(), so `Bot.noDamage` does not touch it. 14 of them '
            + 'sit in level 12, which is on the shortest chain to several items.',
        hazard: 'unpriced',
    },
    whirlpool: {
        as3: 'Whirlpool', roles: RELAXED_ROLES,
        src: 'Game.as:2163 + Puzzlements/Whirlpool.as:61-81',
        why: 'writes player.x/player.y radially AND calls `player.drown()` directly '
            + '— bypassing the terrain state entirely, so `noHazards` does not stop '
            + 'it either',
        hazard: 'unpriced',
    },
    lavatrap: {
        as3: 'LavaTrap', roles: RELAXED_ROLES,
        src: 'Game.as:2083 + Enemies/LavaTrap.as:56-72,145-148',
        why: 'its rotating tongue `collideLine`s the player, then DRAGS them '
            + '(`attached.x/.y = ...`) and calls `attached.die()`. `hitPlayer()` is '
            + 'overridden to {} — it never goes through Player.hit(), so `noDamage` '
            + 'does not touch it. The volume is a DISC of radius max(tongueLengths).',
        hazard: 'unpriced',
    },
    iceturret: {
        as3: 'IceTurret', roles: RELAXED_ROLES,
        src: 'Game.as:2086 + Projectiles/IceTurretBlast.as:52',
        why: 'its projectile calls `(hits[i] as Player).freeze(freezeTime)` — a '
            + 'frozen player runs no friction/input/move block, which is a stream '
            + 'difference, and it does not go through Player.hit()',
        hazard: 'unpriced',
    },
    fallrock: {
        as3: 'FallRock', roles: RELAXED_ROLES,
        src: 'Game.as:2135 + Scenery/FallRock.as:59,107',
        why: 'triggers on the player being above it, then freezes the game and '
            + 'writes `p.y`',
        hazard: 'unpriced',
    },
    fallrocklarge: {
        as3: 'FallRockLarge', roles: RELAXED_ROLES,
        src: 'Game.as:2136 + Scenery/FallRockLarge.as:67,117,134',
        why: 'as `fallrock`, and the one in level 32 additionally spawns BobBoss '
            + '(`bossrock && thirdboss`) — the only construction site of the boss '
            + 'that drops `fire`, since no .oel carries a bobboss1/2/3 tag',
        hazard: 'unpriced',
    },
    shieldlock: {
        as3: 'ShieldLock', roles: RELAXED_ROLES,
        src: 'Game.as:2145 + Puzzlements/ShieldLock.as:35-49 (new ShieldLock(x,y,tag,1))',
        why: 'snaps `p.y` and sets `p.receiveInput = false` on approach',
        hazard: 'unpriced',
    },
    shieldlocknorm: {
        as3: 'ShieldLock', roles: RELAXED_ROLES,
        src: 'Game.as:2144 + Puzzlements/ShieldLock.as:35-49 (new ShieldLock(x,y,tag,0))',
        why: 'same class as `shieldlock`; the fourth argument picks a sprite',
        hazard: 'unpriced',
    },
    pod: {
        as3: 'Pod', roles: RELAXED_ROLES,
        src: 'Game.as:2191 + Scenery/Pod.as:70-73',
        why: 'snaps `p.x`/`p.y` to its own position, then calls Player.hit()',
        hazard: 'unpriced',
    },
    bosstotem: {
        as3: 'BossTotem', roles: RELAXED_ROLES,
        src: 'Game.as:2071 + Enemies/BossTotem.as:284,486',
        why: 'writes `p.y` directly during its fight sequence, and consumes RNG',
        hazard: 'unpriced',
    },
    finalboss: {
        as3: 'FinalBoss', roles: RELAXED_ROLES,
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
    bob: cheapOnly('Bob', 'Game.as:2066', 'Enemy — damage only, via Player.hit()'),
    bobsoldier: cheapOnly('BobSoldier', 'Game.as:2067', 'Enemy — damage only'),
    flyer: cheapOnly('Flyer', 'Game.as:2075', 'Enemy — damage only (Flyer.as:68)'),
    jellyfish: cheapOnly('Jellyfish', 'Game.as:2076', 'Enemy — damage only'),
    lavarunner: cheapOnly('LavaRunner', 'Game.as:2077', 'Enemy — damage only'),
    bulb: cheapOnly('Bulb', 'Game.as:2078', 'Enemy — damage only'),
    tentaclebeast: cheapOnly('TentacleBeast', 'Game.as:2079',
        'Enemy — damage via Tentacle.as:73, i.e. Player.hit()'),
    drill: cheapOnly('Drill', 'Game.as:2080',
        'Enemy — chases within runRange but only ever damages via Player.hit()'),
    sandtrap: cheapOnly('SandTrap', 'Game.as:2081',
        'Enemy — proximity only plays a "chomp" animation and a sound '
        + '(SandTrap.as:56-64); damage is the base Enemy contact path'),
    icetrap: cheapOnly('IceTrap', 'Game.as:2082',
        'Enemy — as SandTrap: proximity animates, damage goes through Player.hit()'),
    darktrap: cheapOnly('DarkTrap', 'Game.as:2084',
        'Enemy — reacts to LIGHT sources, not to the player'),
    turret: cheapOnly('Turret', 'Game.as:2085', 'Enemy — fires projectiles that hit()'),
    beamtower: cheapOnly('BeamTower', 'Game.as:2087',
        'damage only (BeamTower.as:92 calls p.hit)'),
    grenade: cheapOnly('Grenade', 'Game.as:2088', 'Enemy — damage only (Grenade.as:133)'),
    bombpusher: cheapOnly('BombPusher', 'Game.as:2089', 'Enemy — damage only'),
    crusher: cheapOnly('Crusher', 'Game.as:2090',
        'damage only — Crusher.as:98 goes through Player.hit()'),
    puncher: cheapOnly('Puncher', 'Game.as:2091', 'Enemy — damage only (Puncher.as:216)'),
    wallflyer: cheapOnly('WallFlyer', 'Game.as:2197', 'Enemy — damage only'),
    spinner: cheapOnly('Spinner', 'Game.as:2198', 'Enemy — damage only (Spinner.as:75)'),
    spinningaxe: cheapOnly('SpinningAxe', 'Game.as:2140',
        'damage only (SpinningAxe.as:75)'),
    pulser: cheapOnly('Pulser', 'Game.as:2139', 'damage only (Pulser.as:114)'),
    arrowtrap: cheapOnly('ArrowTrap', 'Game.as:2129',
        'fires Arrows, which damage via Player.hit() (Arrow.as:49)'),
    lavachain: cheapOnly('LavaChain', 'Game.as:2141',
        'damages ENEMIES only (LavaChain.as:86); no Player branch'),
    lavaboss: cheapOnly('LavaBoss', 'Game.as:2073',
        'boss — damage only; note its type IS in the player solids list, so its '
        + 'BLOCKING classification is a real R2 question rather than a formality'),
    shieldboss: cheapOnly('ShieldBoss', 'Game.as:2170',
        'boss — damage only (ShieldBoss.as:110); also in the player solids list'),
    frozenboss: cheapOnly('FrozenBoss', 'Game.as:2192', 'boss — no player-side writes'),
    lightbosscontroller: cheapOnly('LightBossController', 'Game.as:2072',
        'spawns Flyers; writes persistence only on its own death'),

    // NPCs. `keyNeeded` is `true` for every one of them (it is assigned in
    // exactly one place in the codebase, `Watcher.as:46`), so `NPC.talk()`
    // needs `Input.released(V)` and proximity alone does nothing but set an
    // `inRange` render flag. They ARE `type = "Solid"`, which is why their
    // blocking classification still matters at R2.
    witch: cheapOnly('Witch', 'Game.as:2178',
        'NPC, keyNeeded true — and the source of `darksword` via doneTalking(), '
        + 'which is a KEY PRESS, not a proximity event'),
    oracle: cheapOnly('Oracle', 'Game.as:2177',
        'NPC, keyNeeded true. Its `FP.world = new Game(...)` (Oracle.as:121) is in '
        + 'doneTalking(); the proximity check at :63 is inside render() and only '
        + 'picks an animation'),
    hermit: cheapOnly('Hermit', 'Game.as:2179', 'NPC, keyNeeded true'),
    yeti: cheapOnly('Yeti', 'Game.as:2180', 'NPC, keyNeeded true'),
    sensei: cheapOnly('Sensei', 'Game.as:2181', 'NPC, keyNeeded true'),
    sign: cheapOnly('Sign', 'Game.as:2182', 'NPC, keyNeeded true'),
    totem: cheapOnly('Totem', 'Game.as:2183', 'NPC, keyNeeded true'),
    karlore: cheapOnly('Karlore', 'Game.as:2174', 'NPC, keyNeeded true'),
    forestchar: cheapOnly('ForestCharacter', 'Game.as:2173', 'NPC, keyNeeded true'),
    statue1: cheapOnly('Statue', 'Game.as:2187 (new Statue(x, y, 0, ...))',
        'NPC, keyNeeded true; talkRange is 32 rather than 24 (Statue.as:25), which '
        + 'still needs the key'),
    oraclestatue: cheapOnly('OracleStatue', 'Game.as:2195', 'scenery'),
    shieldstatue: cheapOnly('ShieldStatue', 'Game.as:2194', 'scenery'),

    // Interactive blockers: they change state only when HIT or unlocked,
    // which is an item use and therefore R3. Standing next to one does
    // nothing.
    breakablerockghost: cheapOnly('BreakableRock',
        'Game.as:2158 (new BreakableRock(x, y, tag, 1))',
        'the ghost variant of `breakablerock` above; broken by a hit, not by '
        + 'proximity'),
    burnabletree: cheapOnly('BurnableTree', 'Game.as:2095', 'burned by Fire, not by proximity'),
    lock: cheapOnly('Lock', 'Game.as:2138', 'opened by a key, not by proximity'),
    bosslock: cheapOnly('BossLock', 'Game.as:2147', 'opened by a boss key'),
    rocklock: cheapOnly('RockLock', 'Game.as:2137', 'opened by an item'),
    grasslock: cheapOnly('GrassLock', 'Game.as:2143', 'opened by an item'),
    wandlock: cheapOnly('WandLock', 'Game.as:2146', 'opened by a WandShot'),
    magicallock: cheapOnly('MagicalLock', 'Game.as:2148 (new MagicalLock(x, y, tag, 0))',
        'opened by a WandShot (WandShot.as:120)'),
    magicallockfire: cheapOnly('MagicalLock',
        'Game.as:2149 (new MagicalLock(x, y, tag, 1))', 'the fire variant of the same class'),
    finaldoor: cheapOnly('FinalDoor', 'Game.as:2190',
        'opens on seal state; it READS persistence (including level 114 tag 0, the '
        + 'Watcher) but writes nothing on approach'),
    rope: cheapOnly('RopeStart', 'Game.as:2201-2210 (node-terminated)',
        'cut by a sword/spear hit, not by proximity'),
    pushableblock: cheapOnly('PushableBlock', 'Game.as:2164', 'moved by a push, not by proximity'),
    pushableblockfire: cheapOnly('PushableBlockFire', 'Game.as:2165', 'moved by Fire'),
    pushableblockspear: cheapOnly('PushableBlockSpear', 'Game.as:2166', 'moved by a spear thrust'),
    lightpole: cheapOnly('LightPole', 'Game.as:2155', 'lit by a hit'),
    moonrockpile: cheapOnly('MoonrockPile', 'Game.as:2193',
        'Solid scenery; no update-time player interaction'),

    // Scenery and presentation.
    rock3: cheapOnly('Rock', 'Game.as:2114 (new Rock(x, y, 2))', 'scenery — index picks a sprite'),
    rock4: cheapOnly('Rock', 'Game.as:2115 (new Rock(x, y, 3))', 'scenery — index picks a sprite'),
    treebare: cheapOnly('Tree', 'Game.as:2094 (new Tree(x, y, true))',
        'the same Tree class as the classified `tree`; the flag picks a sprite'),
    opentree: cheapOnly('OpenTree', 'Game.as:2096', 'scenery (pixelmask — R2)'),
    snowhill: cheapOnly('SnowHill', 'Game.as:2097', 'scenery (pixelmask — R2)'),
    building2: cheapOnly('Building', 'Game.as:2100 (new Building(x, y, 2))', 'scenery (pixelmask)'),
    building4: cheapOnly('Building', 'Game.as:2102 (new Building(x, y, 4))', 'scenery (pixelmask)'),
    building5: cheapOnly('Building', 'Game.as:2103 (new Building(x, y, 5))', 'scenery (pixelmask)'),
    building6: cheapOnly('Building', 'Game.as:2104 (new Building(x, y, 6))', 'scenery (pixelmask)'),
    building7: cheapOnly('Building', 'Game.as:2105 (new Building(x, y, 7))', 'scenery (pixelmask)'),
    building8: cheapOnly('Building', 'Game.as:2106 (new Building(x, y, 8))', 'scenery (pixelmask)'),
    wire: cheapOnly('Wire', 'Game.as:2107', 'decoration'),
    bed: cheapOnly('Bed', 'Game.as:2108', 'furniture'),
    dresser: cheapOnly('Dresser', 'Game.as:2109', 'furniture'),
    bar: cheapOnly('Bar', 'Game.as:2110', 'furniture'),
    barstool: cheapOnly('Barstool', 'Game.as:2111', 'furniture'),
    dungeonspire: cheapOnly('DungeonSpire', 'Game.as:2160',
        'Solid scenery (setHitbox(16,16), DungeonSpire.as:19-20); no update override'),
    littlestones: cheapOnly('LittleStones', 'Game.as:2162', 'scenery'),
    ruinedpillar: cheapOnly('RuinedPillar', 'Game.as:2196', 'scenery'),
    cover: cheapOnly('Cover', 'Game.as:2142',
        'a tile overlay; `Button` explicitly excludes it from what presses it'),
    bonetorch: cheapOnly('BoneTorch', 'Game.as:2152 (new BoneTorch(x, y, 0, ...))', 'a light'),
    bonetorch2: cheapOnly('BoneTorch', 'Game.as:2153 (new BoneTorch(x, y, 1, ...))', 'a light'),
    planttorch: cheapOnly('PlantTorch', 'Game.as:2154', 'a light'),
    lightray: cheapOnly('LightRay', 'Game.as:2199', 'a drawn ray'),
    shadow: cheapOnly('Shadow', 'Game.as:2200', 'a drawn rect'),
});

/** The `.oel` tags that build a `Stairs` rather than a bare `Teleporter`. */
export const STAIRS_TAGS = Object.freeze(['stairsup', 'stairsdown']);

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

const rect = (x, y, w, h) => ({ x, y, w, h, right: x + w, bottom: y + h });

/**
 * FlashPunk's overlap test (`Entity.collideRect`) — a STRICT half-open
 * comparison, so rects that merely touch do NOT collide.
 */
export function rectsOverlap(a, b) {
    return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

/** The world rect an entity class occupies when placed at oel (x, y). */
export function entityRect(cls, x, y) {
    return rect(x + cls.dx - cls.originX, y + cls.dy - cls.originY, cls.w, cls.h);
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
 */
export function buildLevelWorld(levelRecord, { roles = ROLES } = {}) {
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
            for (const [tx, ty] of layer.tiles) {
                const px = tx * TILE_SIZE;
                const py = ty * TILE_SIZE;
                pixelmasks.push({
                    rect: entityRect(CLIFFSIDE_CLASS, px, py),
                    cls: CLIFFSIDE_CLASS,
                    tag: 'cliffside',
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
            } else {
                // 'Unused' in `Tile.types` — Bridge, and only Bridge. It
                // rewrites its own entity type from an opening timer
                // inside render(), so it is neither reliably solid nor
                // reliably walkable and cannot even be sorted into a list
                // here. A level containing one is unmodellable rather than
                // modellable-but-wrong, so it fails at BUILD time; the
                // merely special terrains (water, pit, lava, ice,
                // waterfall) load fine and throw from the resolver only if
                // the player actually stands on one.
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
        for (const role of roles) {
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
            proximityHazards.push({
                rect: entityRect(cls.hazard, x, y), cls, tag: e.type, x, y,
                kind: cls.hazard.kind, effect: cls.hazard.effect,
            });
        }

        if (cls.collider === 'none' || cls.collider === undefined) continue;
        if (cls.collider === 'rect') {
            const solid = { rect: entityRect(cls, x, y), cls, tag: e.type, x, y };
            solids.push(solid);
            objectSolids.push(solid);
        } else if (cls.collider === 'pixelmask') {
            pixelmasks.push({ rect: entityRect(cls, x, y), cls, tag: e.type, x, y });
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
            const persistenceIsTrue = true;   // no items, no persistence in v2
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
        solids,
        objectSolids,
        pixelmasks,
        teleporters,
        pickups,
        proximityHazards,

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
        avoidVolumesAt(box) {
            const hits = [];
            for (const p of pickups) {
                if (rectsOverlap(box, p.rect)) hits.push({ kind: 'pickup', blocker: p });
            }
            for (const h of proximityHazards) {
                if (rectsOverlap(box, h.rect)) {
                    hits.push({ kind: 'proximity-hazard', blocker: h });
                }
            }
            return hits;
        },

        /**
         * The sweep's candidate test: `collideTypes(solids, x + d, y)`.
         * Returns the first blocker or null — the AS3 sweep consumes only
         * null/non-null, so list order does not affect movement.
         *
         * THROWS on any overlap with a pixelmask collider. Deliberately
         * unconditional, even when a rect solid would also have blocked:
         * the bounding rect is already an over-approximation, so this can
         * only over-throw, and an over-throw is a loud "route the fixture
         * elsewhere" while an under-throw is a silent divergence.
         *
         * ⚠ `opts.beforeTypeFlip` selects the world as it exists on its
         * very FIRST live tick, when no tile is solid yet. See the note on
         * `nearestWalkableTile` — this is the same one fact seen from the
         * other side, and it is transcribed rather than tidied because the
         * game's own comment says the order is deliberate.
         */
        collidesSolid(box, { beforeTypeFlip = false } = {}) {
            // Pixelmask entities (Building, TreeLarge, CliffSide) assign
            // their type in the CONSTRUCTOR, so the seam is armed on tick 1
            // too — only Tiles are late.
            for (const p of pixelmasks) {
                if (rectsOverlap(box, p.rect)) {
                    fail(`unmodeled pixelmask collider: ${p.cls.as3} (${p.tag}) at `
                        + `(${p.x},${p.y}) in ${where}. Pixelmask colliders are a v2 `
                        + 'seam, not a model — route the fixture clear of it. '
                        + `Source: ${p.cls.src}`);
                }
            }
            for (const s of (beforeTypeFlip ? objectSolids : solids)) {
                if (rectsOverlap(box, s.rect)) return s;
            }
            return null;
        },

        /**
         * `FP.world.nearestToPoint("Tile", x, y)` with the default
         * `useHitboxes = false` — squared distance to each entity's x/y,
         * which for a Tile is its CENTRE (`World.as:640-668`).
         *
         * Ties resolve by entity-list order in the real game. Rather than
         * transcribe FlashPunk's list order, this keeps the extract's
         * order and the fixtures stay off exact ties; if one ever lands on
         * a tie, move the fixture.
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
         * The same single pass, also reporting an EXACT tie.
         *
         * ⚠ Ties are real and this arc met one immediately: R1's first pit
         * recording walked UP from a tile centre, which put the probe point
         * on y = 32.0 exactly, equidistant from tiles (2,1) and (2,2) of
         * level 83. The GAME fell into the pit, because `nearestToPoint`
         * walks FlashPunk's entity list and `World.addUpdate` PREPENDS — so
         * its order is the reverse of the extract's, and a model reading the
         * extract picks the other tile.
         *
         * The tie is REPORTED here rather than judged, because whether it
         * matters is a physics question, not a geometry one: two equidistant
         * tiles that both walk at 0.8 resolve to the same behaviour whoever
         * wins, and a full tile grid produces ties constantly. See
         * `playerPhysicsV2.resolveTerrainState`, which throws only when the
         * two lead somewhere different.
         *
         * `tie` is the FIRST later candidate at the same distance with a
         * different `t`; two tied tiles of the same type are not an
         * ambiguity at all.
         */
        nearestWalkableTileWithTie(x, y, { beforeTypeFlip = false } = {}) {
            let best = null;
            let bestDist = Infinity;
            let tie = null;
            for (const tile of (beforeTypeFlip ? tiles : walkableTiles)) {
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
            }
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
        plannerBlockerAt(box, probeRect = null, { noclip = false, noHazards = [] } = {}) {
            if (!noclip) {
                for (const p of pixelmasks) {
                    if (rectsOverlap(box, p.rect)) return { kind: 'pixelmask', blocker: p };
                }
                for (const s of solids) {
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
