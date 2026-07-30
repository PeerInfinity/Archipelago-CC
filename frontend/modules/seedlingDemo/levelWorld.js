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
    6: 'Pit — sets receiveInput = false and takes the player away',
    17: 'Lava — same sound-coupled stroke burst as water, plus damage',
    22: 'Ice — rewrites both moveSpeed (1) and friction (0.025)',
    25: 'Waterfall — sound-coupled like water, at half speed',
    29: 'Bridge — rewrites its own entity type from a timer inside render()',
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
        as3: 'Tree', collider: 'rect', type: 'Tree',
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
        as3: 'Rock', collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/Rock.as:12-17 (new Rock(x, y, 0))',
    },
    rock2: {
        as3: 'Rock', collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/Rock.as:12-17 (new Rock(x, y, 1) — index picks the sprite only)',
    },
    pole: {
        as3: 'Pole', collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8,
        src: 'Scenery/Pole.as:15-20',
    },
    brickpole: {
        as3: 'BrickPole', collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/BrickPole.as:14-22 (sprite offsets are cosmetic)',
    },
    brickwell: {
        as3: 'BrickWell', collider: 'rect', type: 'Solid',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Scenery/BrickWell.as:14-24 (sprite offsets are cosmetic)',
    },
    breakablerock: {
        as3: 'BreakableRock', collider: 'rect', type: 'Solid',
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
        as3: 'IntroCharacter', collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 8, h: 8, originX: 4, originY: 4,
        src: 'NPCs/NPC.as:48-59 + IntroCharacter.as:13 (Spritemap 8x8)',
    },
    adnanchar: {
        as3: 'AdnanCharacter', collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 8, h: 8, originX: 4, originY: 4,
        src: 'NPCs/NPC.as:48-59 + AdnanCharacter.as:13 (Spritemap 8x8)',
    },
    rekcahdam: {
        as3: 'Rekcahdam', collider: 'rect', type: 'Solid',
        dx: 8, dy: 8, w: 9, h: 10, originX: 4, originY: 5,
        src: 'NPCs/NPC.as:48-59 + Rekcahdam.as:13 (Spritemap 9x10)',
        // ⚠ originX is `_g.width / 2` = 4.5 passed to `setHitbox(..., originX:int)`
        // — AS3 truncates toward zero, so it is 4, not 4.5 and not 5.
    },
    statue2: {
        as3: 'Statue', collider: 'rect', type: 'Solid',
        dx: 16, dy: -8, w: 48, h: 24, originX: 24, originY: 0,
        src: 'NPCs/Statue.as:19-45 (new Statue(x, y, 1, ...))',
        // Two transcription traps in one class:
        // 1. The ctor y is `_y - Tile.h/2 + Tile.h*int(_t==0)`; for the
        //    `statue2` tag `_t` is 1, so the second term is ZERO and the
        //    offset is -8, not +8.
        // 2. `setHitbox` is called from **render()**, not the constructor
        //    (`Statue.as:34-45`). Until the first render the hitbox is
        //    NPC's default (48x40 centred). Level 0's statue sits far from
        //    any fixture route, so the first-frame difference is
        //    unobservable — recorded rather than modelled, like the Tile
        //    type flip.
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
        as3: 'Building', collider: 'pixelmask', type: 'Solid',
        dx: 0, dy: 0, w: 64, h: 48, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/BuildingMask.png (64x48)',
    },
    building1: {
        as3: 'Building', collider: 'pixelmask', type: 'Solid',
        dx: 0, dy: 0, w: 48, h: 32, originX: 0, originY: 0,
        src: 'Scenery/Building.as:20-23 + assets/graphics/Building1Mask.png (48x32)',
    },
    treelarge: {
        as3: 'TreeLarge', collider: 'pixelmask', type: 'Solid',
        dx: 0, dy: 0, w: 160, h: 192, originX: 0, originY: 0,
        src: 'Scenery/TreeLarge.as:22-30 + assets/graphics/TreeLargeMask.png (160x192)',
        // The entity sits at (x+80, y+96) and the mask offset is
        // (-80, -96), so the two cancel and the mask lands on the raw oel
        // coordinates. Do not "simplify" by dropping one of them.
    },
    // --- present but not blocking ---------------------------------------
    torch: {
        as3: 'Torch', collider: 'none', type: '',
        src: 'Scenery/Torch.as:19-30',
        why: 'never assigns `type`, so it stays "" and is in no solids list',
    },
    orb: {
        as3: 'Orb', collider: 'none', type: '',
        src: 'Scenery/Orb.as:30-32',
        why: 'never assigns `type`',
    },
    watcher: {
        as3: 'Watcher', collider: 'none', type: 'Watcher',
        src: 'NPCs/Watcher.as:40-49',
        why: 'overrides the NPC default to type "Watcher", which is in no solids list',
    },
    moonrock: {
        as3: 'Moonrock', collider: 'none', type: '',
        src: 'Scenery/Moonrock.as:42-55',
        why: 'constructed with type "" at y = -1000; it only drops in and '
            + 'becomes "Solid" once Game.moonrockSet, a static that is false '
            + 'on a fresh boot and can only be set by the beam event (v3+)',
    },
    daynight: {
        as3: null, collider: 'none', type: null,
        src: 'Game.as:1875 (hasOwnProperty check)',
        why: 'not an entity at all — a level FLAG read by hasOwnProperty, '
            + 'never constructed',
    },
    // --- transitions ----------------------------------------------------
    teleporter: {
        as3: 'Teleporter', collider: 'trigger', type: 'Teleporter',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Teleporter.as:31-53',
    },
    stairsdown: {
        as3: 'Stairs', collider: 'trigger', type: 'Teleporter',
        dx: 0, dy: 0, w: 16, h: 16, originX: 0, originY: 0,
        src: 'Stairs.as:11-20 — `Stairs extends Teleporter` and calls '
            + 'super(x, y, to, px, py, true, -1, false, sign), so it is the '
            + 'identical trigger with `show` forced true and `tag` forced -1',
    },
});

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
export function buildLevelWorld(levelRecord) {
    if (!levelRecord || typeof levelRecord !== 'object') {
        fail('buildLevelWorld needs a level record from seedling-map.json');
    }
    const level = levelRecord.level;
    const where = `level ${level}`;

    const tiles = [];
    const walkableTiles = [];
    const solids = [];
    const pixelmasks = [];
    const teleporters = [];

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
    for (const e of levelRecord.entities ?? []) {
        const cls = ENTITY_CLASSES[e.type];
        if (!cls) {
            fail(`${where} contains entity "${e.type}" at (${e.x},${e.y}), which is not `
                + 'in the transcribed class table — add it (with its Game.as construction '
                + 'site and its setHitbox args) rather than assuming it does not collide');
        }
        const x = Number(e.x);
        const y = Number(e.y);
        if (cls.collider === 'none') continue;
        if (cls.collider === 'rect') {
            solids.push({ rect: entityRect(cls, x, y), cls, tag: e.type, x, y });
        } else if (cls.collider === 'pixelmask') {
            pixelmasks.push({ rect: entityRect(cls, x, y), cls, tag: e.type, x, y });
        } else if (cls.collider === 'trigger') {
            const isStairs = e.type === 'stairsdown';
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
        tiles,
        walkableTiles,
        solids,
        pixelmasks,
        teleporters,

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
         */
        collidesSolid(box) {
            for (const p of pixelmasks) {
                if (rectsOverlap(box, p.rect)) {
                    fail(`unmodeled pixelmask collider: ${p.cls.as3} (${p.tag}) at `
                        + `(${p.x},${p.y}) in ${where}. Pixelmask colliders are a v2 `
                        + 'seam, not a model — route the fixture clear of it. '
                        + `Source: ${p.cls.src}`);
                }
            }
            for (const s of solids) {
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
         */
        nearestWalkableTile(x, y) {
            let best = null;
            let bestDist = Infinity;
            for (const tile of walkableTiles) {
                const dx = tile.x - x;
                const dy = tile.y - y;
                const d = dx * dx + dy * dy;
                if (d < bestDist) { bestDist = d; best = tile; }
            }
            return best;
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
