// Seedling map semantics — what a tile or an entity MEANS for traversal.
// (CC/docs/plans/region-atlas-plan.md, Phase 5a, Deliverable 1.)
//
// `atlases/seedling-map.json` is deliberately semantic-free: the Phase-2
// extractor keeps raw tileset identity so the marking tool renders what the
// game draws and nothing is invented. This module is the other half — the
// TRANSCRIPTION of the game's own collision rules, so the Phase-5 analyzer can
// partition a region into zero-item-reachable components and label the
// crossings between them with the items that open them.
//
// It is data, not policy: no atlas concepts, no AP graph, no DOM. The analyzer
// (procgenPipeline/regionAtlasAnalyzer.js) is game-agnostic and takes the grid
// this module builds; the Phase-5b maze-mode projection will take the same
// tables. Both the browser panel and the Node CLIs import it directly.
//
// --- provenance --------------------------------------------------------------
//
// Everything here is transcribed from a Seedling source checkout (MIT), which
// is OUT of this repo. Line references are to that source at the revision this
// was written against:
//
//   src/Game.as:1909-2004        the 45-case tileset-column switch
//   src/Scenery/Tile.as:23-26    the 38-entry static `types` table
//   src/Scenery/Tile.as:39-77    the type-number comment block (the names)
//   src/Mobile.as:17             `solids = ["Solid","Tree","Rock","Rope","ShieldBoss"]`
//                                — THE oracle for "does this block the player"
//   src/Game.as:2034-2213        the entity construction table (tag -> class)
//
// Because the source is out of repo, drift cannot be caught by a diff. The
// alarm is the census guard in seedlingSemantics.test.js: every `tx` column and
// every entity tag the COMMITTED extract contains must be classified here, and
// the table sizes are pinned. A silent gap is a red test, not a skipped tile.

// --- condition algebra -------------------------------------------------------
//
// Conditions are expressed over the game's ENGINE FLAGS (`hasSword`, `canSwim`,
// …) and its key indices, never over AP item names: the flag is what the source
// tests, and the AP item that sets it is a per-game binding question answered by
// buildFlagItemRules() below, from `games/seedling.json`. Keeping the two apart
// is what lets an item-shuffle change (a new progressive chain, a renamed item)
// land in the config without touching this transcription.

/** A single engine flag, e.g. `flag('hasSword')`. */
export const flag = (name) => ({ flag: name });

/** A boss-lock key index (0-4), which is `Player.hasKey(n)` in the source. */
export const key = (index) => ({ key: index });

/** Disjunction. Collapses a single operand — an `Or` of one is noise. */
export const anyOf = (...parts) => (parts.length === 1 ? parts[0] : { any: parts });

/** Conjunction. Collapses a single operand. */
export const allOf = (...parts) => (parts.length === 1 ? parts[0] : { all: parts });

// --- tile types (Tile.as) ----------------------------------------------------

export const SEEDLING_TILE_SIZE = 16;

/**
 * Tile type numbers -> names, from the comment block at Tile.as:39-77. The
 * INDEX is the `t` a Tile is constructed with; the name is documentation only.
 */
export const TILE_TYPE_NAMES = Object.freeze([
    'Ground', 'Water', 'Stone', 'Brick', 'Dirt', 'Dungeon Tile', 'Pit', 'Shield Tile',
    'Forest', 'Cliff', 'Cliff Stairs', 'Wood', 'Walkable Wood', 'Cave', 'Wood (natural)',
    'Dark Stone', 'Igneous Stone', 'Lava', 'Blue Tile', 'Blue Wall', 'Blue Wall (dark)',
    'Snow', 'Ice', 'Ice Wall', 'Ice Wall (glowing)', 'Waterfall', 'Body Floor', 'Body Wall',
    'Ghost Tile', 'Bridge', 'Ghost Tile Step', 'Igneous-to-Lava', 'Odd Tile', 'Fuchsia Tile',
    'Odd Tile (wall)', 'Rock Wall (dark)', 'Rock Wall', 'Rock Wall (floor)',
]);

/**
 * `Tile.types` verbatim (Tile.as:23-26): the FlashPunk entity `type` each tile
 * number takes in `update()`. Only "Solid" blocks — see SOLID_ENTITY_TYPES.
 * Index 29 (Bridge) is "Unused" in the table because Bridge overwrites `type`
 * every frame from its own opening timer (Tile.as:381-404): closed => "Solid",
 * open => "Tile". It is handled as a gated crossing below.
 */
export const TILE_TYPE_ENTITY_TYPES = Object.freeze([
    'Tile', 'Tile', 'Solid', 'Tile', 'Tile', 'Tile', 'Tile', 'Tile', 'Tile', 'Solid',
    'Tile', 'Solid', 'Tile', 'Tile', 'Solid', 'Solid', 'Tile', 'Tile', 'Tile', 'Solid',
    'Solid', 'Tile', 'Tile', 'Solid', 'Solid', 'Tile', 'Tile', 'Solid', 'Tile', 'Unused',
    'Tile', 'Tile', 'Tile', 'Tile', 'Solid', 'Solid', 'Solid', 'Tile',
]);

/**
 * The types the player actually collides with, from `Mobile.solids`
 * (Mobile.as:17). This is the authoritative solidity oracle for BOTH tiles and
 * entities: an entity whose `type` is not in this set does not block movement,
 * however hostile it looks. Enemies are type "Enemy" and are therefore NOT
 * traversal blockers — enemy avoidance is a playback-bot concern (plan decision
 * 10, stage 5), not a region-split one.
 */
export const SOLID_ENTITY_TYPES = Object.freeze(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss']);

const SOLID_TYPE_SET = new Set(SOLID_ENTITY_TYPES);

/**
 * Tileset COLUMN -> tile type `t`, transcribed from the 45-case switch at
 * Game.as:1909-2004. Only the column matters: the game computes it as
 * `Math.floor(o.@tx / Tile.w)` and ignores `ty` entirely (every placement in
 * the committed extract has ty=0, which the census guard pins).
 *
 * Columns 27-32 all build type 25 (Waterfall) with different pit/continuous/
 * spray flags; those flags are cosmetic (spray emitter, pit shadow, whether the
 * fall continues) and change no collision, so they are recorded in
 * TILE_COLUMN_VARIANTS rather than forking the semantics.
 */
export const TILE_COLUMN_TO_TYPE = Object.freeze([
    /*  0 */ 0, /*  1 */ 0, /*  2 */ 1, /*  3 */ 2, /*  4 */ 3, /*  5 */ 4, /*  6 */ 5,
    /*  7 */ 6, /*  8 */ 7, /*  9 */ 8, /* 10 */ 8, /* 11 */ 9, /* 12 */ 10, /* 13 */ 11,
    /* 14 */ 12, /* 15 */ 13, /* 16 */ 14, /* 17 */ 15, /* 18 */ 16, /* 19 */ 17,
    /* 20 */ 18, /* 21 */ 19, /* 22 */ 20, /* 23 */ 21, /* 24 */ 22, /* 25 */ 23,
    /* 26 */ 24, /* 27 */ 25, /* 28 */ 25, /* 29 */ 25, /* 30 */ 25, /* 31 */ 25,
    /* 32 */ 25, /* 33 */ 26, /* 34 */ 27, /* 35 */ 28, /* 36 */ 29, /* 37 */ 30,
    /* 38 */ 31, /* 39 */ 32, /* 40 */ 33, /* 41 */ 34, /* 42 */ 35, /* 43 */ 36,
    /* 44 */ 37,
]);

/** Non-collision construction flags a column carries (Game.as:1909-2004). */
export const TILE_COLUMN_VARIANTS = Object.freeze({
    0: { grass: false },
    9: { grass: false },
    27: { pit: false, continuous: true, spray: false },
    28: { pit: false, continuous: false, spray: false },
    29: { pit: true, continuous: false, spray: false },
    30: { pit: true, continuous: true, spray: false },
    31: { pit: false, continuous: true, spray: true },
    32: { pit: false, continuous: false, spray: true },
});

// --- cell kinds --------------------------------------------------------------
//
// What the analyzer's flood does with a cell:
//
//   'open'        walk through it for free
//   'wall'        never passable, at any item state — the ordinary region border
//   'gated'       passable once the player has `condition`
//   'directional' passable, but not equally in every direction (see `faces`)
//   'sink'        enterable from anywhere, never leavable — a pit drop. It never
//                 joins two components; the analyzer reports it as a
//                 boundary-exit candidate instead of dropping it silently.
//   'manual'      a real blocker whose rule this transcription cannot derive
//                 (puzzle state, a moving hazard, destructive terrain). Splits
//                 the region and emits an internal exit with NO rule and
//                 `source: 'manual'`, listed as needs-hand-authoring.

export const CELL_KINDS = Object.freeze(['open', 'wall', 'gated', 'directional', 'sink', 'manual']);

const OPEN = Object.freeze({ kind: 'open' });
const WALL = Object.freeze({ kind: 'wall' });

/**
 * Per-tile-type semantics for the types whose behaviour is NOT just their
 * `Tile.types` entry. Everything absent here falls back to that entry: "Solid"
 * => wall, anything else => open.
 *
 * A directional cell carries one or both of:
 *
 *   `faces`  a gate on a geometric FACE of the tile, paid crossing it in either
 *            direction (the cave mouth's north wall)
 *   `dirs`   a gate on MOVING a given way while on the tile, paid only that way
 *            (climbing a waterfall)
 *
 * In both, `null` blocks and a condition node gates. Directions are compass
 * letters with y growing DOWNWARD, so 'N' is decreasing y. Keeping them apart
 * is what makes the cave right: its north face walls off the tile above in both
 * directions, while walking north INTO the cave from below crosses the south
 * face and is free.
 */
export const TILE_TYPE_SEMANTICS = Object.freeze({
    // Water (Tile.as:39, Player.checkDrowning at Player.as:1420): standing in
    // water with no `canSwim` starts the drown timer.
    1: { kind: 'gated', condition: flag('canSwim'), label: 'water' },

    // Pit (Player.checkFallingInPit, Player.as:718): falling in hands the
    // player to the level's <control> object's `fallthrough` target, which is
    // usually a different level entirely — so it leaves the region.
    6: { kind: 'sink', label: 'pit', note: 'drops to the level <control> fallthrough target' },

    // Cave (Tile.check case 13, Tile.as:~600): the tile spawns a 1px-tall Solid
    // along its TOP edge "so you can't enter from above". That entity blocks
    // BOTH ways across the north face — walking down into the cave mouth and
    // walking up out of it — so this is a face wall, not a one-way ledge.
    13: {
        kind: 'directional',
        label: 'cave',
        faces: { N: null },
        note: 'the cave-mouth Solid walls the north FACE — you cannot step down into the mouth or climb back out of it, but walking in from below or the side is free',
    },

    // Lava (Player.checkDrowning, Player.as:1424): without the Dark Suit it
    // damages and drowns.
    17: { kind: 'gated', condition: flag('hasDarkSuit'), label: 'lava' },

    // Ice: walkable, but the player SLIDES on it, which breaks the
    // 4-connectivity assumption this analyzer is built on (a sliding player
    // cannot stop on an arbitrary tile). Walkable so it does not falsely split
    // the region; the region is flagged for review instead.
    22: { kind: 'open', label: 'ice', review: 'sliding ice — 4-connectivity is not the real movement model here' },

    // Waterfall (Player.as:1521): `onWaterfall && (!hasFeather || v.y >= 0)`
    // adds downward acceleration — you are pushed down the fall unless you hold
    // the Feather and are already moving up. Down is free, up needs the Feather.
    25: {
        kind: 'directional',
        label: 'waterfall',
        dirs: { N: flag('hasFeather') },
        note: 'the fall pushes you down; climbing needs the Feather. A DIRECTION gate, not a face gate — going down is free from any side.',
    },

    // Bridge (Tile.as:381-404 + Player.genericHit, Player.as:1096): solid until
    // a "Spear"-typed hit runs its opening timer down. The Ghost Sword's slash
    // also types as "Spear" (Player.as:895), but holding the Ghost Sword
    // already implies holding the Ghost Spear (games/seedling.json's
    // `ghostsword` fusion requires the `spear` item), so that path is strictly
    // weaker and adds nothing to the rule.
    29: { kind: 'gated', condition: flag('hasSpear'), label: 'bridge' },

    // Igneous-to-Lava (Tile.render case 31, Tile.as:~470): standing near it
    // counts down and then turns the tile into Lava (t=17) permanently. Its
    // traversal cost therefore depends on the ORDER the player walks it, which
    // no static rule expresses.
    31: {
        kind: 'manual',
        label: 'igneous',
        reason: 'destructive terrain — becomes Lava once the player stands near it, so its cost depends on walk order',
    },
});

/** The tile type a tileset column places, or null for an unmapped column. */
export function tileTypeForColumn(column) {
    return TILE_COLUMN_TO_TYPE[column] ?? null;
}

/** The tile type of a `[x, y, tx, ty]` placement from the map extract. */
export function tileTypeForPlacement(placement) {
    return tileTypeForColumn(Math.floor(placement[2] / SEEDLING_TILE_SIZE));
}

/** Traversal semantics of a tile type. Unknown types are treated as walls. */
export function tileSemantics(t) {
    const special = TILE_TYPE_SEMANTICS[t];
    if (special) return special;
    const entityType = TILE_TYPE_ENTITY_TYPES[t];
    if (entityType === undefined) return WALL;
    return SOLID_TYPE_SET.has(entityType) ? WALL : OPEN;
}

// --- entity semantics (Game.as:2034-2213) ------------------------------------
//
// Keyed by the Ogmo TAG, because that is what the extract records. `class` is
// the AS3 class the tag constructs, kept so a reader can find the source. A
// `size` is the entity's hitbox in TILES — every scenery class in this game
// places its hitbox's top-left at the Ogmo x/y (Tree, for instance, offsets its
// centre by +16,+16 and then sets a 32x32 hitbox with a 16,16 origin, which
// lands the rect back on the placement), so the footprint is
// `[x/16, y/16] .. +size`. Defaults to 1x1.
//
// `variant` records the constructor argument the tag pins (BreakableRock's
// rockType, MagicalLock's lockType, ShieldLock's shieldType) — it is why two
// tags share one class and get different rules.

const G = (condition, extra = {}) => ({ kind: 'gated', condition, ...extra });
const M = (reason, extra = {}) => ({ kind: 'manual', reason, ...extra });

/**
 * Every entity tag the committed extract contains, classified. Tags whose
 * entity type is not in SOLID_ENTITY_TYPES are 'open' — they are decoration,
 * pickups, enemies, triggers or level furniture that the player walks through.
 */
export const ENTITY_SEMANTICS = Object.freeze({
    // --- item-conditional blockers -------------------------------------------
    // BreakableRock (Puzzlements/BreakableRock.as:41 type "Solid"; broken by
    // Player.genericHit -> hit(hasGhostSword ? 1 : 0), Player.as:1062). BOTH the
    // sword slash (Player.as:895, needs hasSword) and the spear thrust
    // (Player.as:960, needs hasSpear) route through genericHit, so either weapon
    // breaks a plain rock — the kickoff's "Sword" is the sword half of a
    // disjunction the source spells out.
    breakablerock: G(anyOf(flag('hasSword'), flag('hasSpear')), { class: 'BreakableRock', variant: { rockType: 0 } }),
    // The ghost variant only breaks on hit(1), which only the Ghost Sword
    // produces. Holding it already implies a weapon to swing (the fusion needs
    // the spear), so the flag alone is the rule.
    breakablerockghost: G(flag('hasGhostSword'), { class: 'BreakableRock', variant: { rockType: 1 } }),

    // BurnableTree (Scenery/BurnableTree.as:24 type "Solid"; hit(t) burns only
    // when t == "Fire", which Player.as:1003 emits under `if (hasFire)`).
    burnabletree: G(flag('hasFire'), { class: 'BurnableTree' }),

    // MagicalLock (Puzzlements/MagicalLock.as:40 type "Solid"). Opened by a
    // WandShot whose `shotType` is 1 when the player holds the Fire Wand
    // (Projectiles/WandShot.as:58,120) and 0 otherwise; `lockType <= _t` breaks
    // it. So the plain lock takes either wand and the fire lock takes only the
    // Fire Wand — the disjunction that made leave-one-out ability diffing the
    // wrong tool for this game (ruling 1).
    magicallock: G(anyOf(flag('hasWand'), flag('hasFireWand')), { class: 'MagicalLock', variant: { lockType: 0 } }),
    magicallockfire: G(flag('hasFireWand'), { class: 'MagicalLock', variant: { lockType: 1 } }),

    // ShieldLock (Puzzlements/ShieldLock.as:33). shieldType 0 wants the plain
    // Shield, 1 the Dark Shield. Note the Ogmo tags are the other way round from
    // the class default: `shieldlock` is type 1 (Game.as:2145).
    shieldlocknorm: G(flag('hasShield'), { class: 'ShieldLock', variant: { shieldType: 0 } }),
    shieldlock: G(flag('hasDarkShield'), { class: 'ShieldLock', variant: { shieldType: 1 } }),

    // BossLock (Puzzlements/BossLock.as:17,34,63): `normType = "Solid"` until
    // `Player.hasKey(keyType)`. The key index is a per-placement attribute
    // (Game.as:2147 `o.@keyType`), so the condition is resolved per entity.
    bosslock: { kind: 'gated', class: 'BossLock', conditionFromAttr: 'keyType', condition: null },

    // PushableBlockFire / PushableBlockSpear (Puzzlements/*.as:30 type "Solid";
    // pushed by Player.genericHit's Fire and Spear branches, Player.as:1092-1098).
    pushableblockfire: G(flag('hasFire'), { class: 'PushableBlockFire' }),
    pushableblockspear: G(flag('hasSpear'), { class: 'PushableBlockSpear' }),

    // RopeStart (Puzzlements/RopeStart.as:25 type "Rope" — in Mobile.solids, so
    // it blocks). Cut by genericHit with no type test, so either weapon works.
    // Constructed specially at Game.as:2201-2209 with the rope's far end, and
    // its hitbox spans that whole run; the extract keeps the `xend` attribute.
    rope: G(anyOf(flag('hasSword'), flag('hasSpear')), { class: 'RopeStart', spanAttr: 'xend' }),

    // --- puzzle-state blockers: solid until a protocol is satisfied ----------
    // Activators subclasses that start `type = normType` ("Solid") and clear to
    // "" when their button/room-clear condition fires (Puzzlements/Lock.as:20,
    // 34, 88; Cover.as:20,34,48). No item is involved, so no rule is derivable.
    lock: M('button/room-clear puzzle — Lock clears when its tset button fires or the room is empty of enemies', { class: 'Lock' }),
    grasslock: M('button/room-clear puzzle (GrassLock extends Lock)', { class: 'GrassLock' }),
    wandlock: M('wand-shot puzzle (WandLock extends Lock) — clears on activation, not on holding the Wand', { class: 'WandLock' }),
    rocklock: M('rock-placement puzzle (RockLock extends Lock)', { class: 'RockLock' }),
    cover: M('Cover clears while something (a Chest) sits under it, and resets otherwise', { class: 'Cover' }),
    pushableblock: M('plain pushable block — solid, moved by walking into it; passability depends on push geometry', { class: 'PushableBlock' }),
    chest: M('Chest is solid until opened (no item requirement, but an interaction)', { class: 'Chest' }),
    fallrock: M('FallRock drops on a trigger and is solid where it lands', { class: 'FallRock' }),
    fallrocklarge: M('FallRockLarge drops on a trigger and is solid where it lands', { class: 'FallRockLarge', size: [2, 2] }),
    moonrock: M('Moonrock is solid until its puzzle clears', { class: 'Moonrock', size: [3, 3] }),

    // --- moving solids: solid, but not in one place -------------------------
    crusher: M('moving hazard — Crusher sweeps across tiles', { class: 'Crusher', size: [2, 2] }),
    pulser: M('moving hazard — Pulser', { class: 'Pulser' }),
    spinningaxe: M('moving hazard — SpinningAxe', { class: 'SpinningAxe' }),
    lavachain: M('moving hazard — LavaChain', { class: 'LavaChain' }),
    beamtower: M('BeamTower is solid and fires a beam across the room', { class: 'BeamTower', size: [1, 2] }),
    bombpusher: M('BombPusher is a solid that moves', { class: 'BombPusher', size: [3, 3] }),

    // --- bosses and set pieces ----------------------------------------------
    bosstotem: M('boss set piece (type "Enemy"+"Solid")', { class: 'BossTotem', size: [5, 2] }),
    finalboss: M('boss set piece', { class: 'FinalBoss' }),
    shieldboss: M('boss set piece (type "ShieldBoss", which Mobile.solids blocks on)', { class: 'ShieldBoss', size: [3, 3] }),
    frozenboss: M('boss set piece with an off-centre hitbox', { class: 'FrozenBoss' }),
    tentaclebeast: M('boss set piece — hitbox is its spritemap, not transcribed', { class: 'TentacleBeast' }),
    finaldoor: M('FinalDoor opens on the endgame condition', { class: 'FinalDoor', size: [2, 2] }),
    treelarge: M('TreeLarge places its hitbox at +80,+96 from the Ogmo x/y and sizes it from a spritemap — footprint not transcribed', { class: 'TreeLarge' }),

    // --- unconditional solids ------------------------------------------------
    // Scenery. Sizes are the classes' own setHitbox calls; anything omitted is
    // the 1x1 default.
    tree: { kind: 'wall', class: 'Tree', size: [2, 2] },
    treebare: { kind: 'wall', class: 'Tree', size: [2, 2], variant: { bare: true } },
    opentree: { kind: 'wall', class: 'OpenTree', size: [2, 2] },
    rock: { kind: 'wall', class: 'Rock' },
    rock2: { kind: 'wall', class: 'Rock', variant: { rockType: 1 } },
    rock3: { kind: 'wall', class: 'Rock', variant: { rockType: 2 } },
    rock4: { kind: 'wall', class: 'Rock', variant: { rockType: 3 } },
    pole: { kind: 'wall', class: 'Pole' },
    brickpole: { kind: 'wall', class: 'BrickPole' },
    brickwell: { kind: 'wall', class: 'BrickWell' },
    dungeonspire: { kind: 'wall', class: 'DungeonSpire' },
    bar: { kind: 'wall', class: 'Bar', size: [4, 1] },
    barstool: { kind: 'wall', class: 'Barstool' },
    bed: { kind: 'wall', class: 'Bed', size: [1, 2] },
    dresser: { kind: 'wall', class: 'Dresser', size: [2, 1] },
    snowhill: { kind: 'wall', class: 'SnowHill', size: [6, 4] },
    statue1: { kind: 'wall', class: 'Statue', size: [1, 2] },
    statue2: { kind: 'wall', class: 'Statue', size: [1, 2], variant: { statueType: 1 } },
    shieldstatue: { kind: 'wall', class: 'ShieldStatue', size: [2, 2] },
    oraclestatue: { kind: 'wall', class: 'OracleStatue', size: [2, 2] },
    ruinedpillar: { kind: 'wall', class: 'RuinedPillar', size: [2, 2] },
    moonrockpile: { kind: 'wall', class: 'MoonrockPile', size: [2, 1] },
    planttorch: { kind: 'wall', class: 'PlantTorch' },
    bonetorch: { kind: 'wall', class: 'BoneTorch' },
    bonetorch2: { kind: 'wall', class: 'BoneTorch', variant: { boneType: 1 } },
    iceturret: { kind: 'wall', class: 'IceTurret', size: [2, 2] },
    // Buildings collide through a Pixelmask (Scenery/Building.as:22), so their
    // real outline is per-pixel. Sizes here are the sprite rectangles, rounded
    // UP to whole tiles: over-blocking splits a region the author then reviews,
    // where under-blocking would merge two rooms silently.
    building: { kind: 'wall', class: 'Building', size: [4, 4], pixelMask: true },
    building1: { kind: 'wall', class: 'Building', size: [3, 3], pixelMask: true, variant: { buildingType: 1 } },
    building2: { kind: 'wall', class: 'Building', size: [4, 4], pixelMask: true, variant: { buildingType: 2 } },
    building3: { kind: 'wall', class: 'Building', size: [3, 7], pixelMask: true, variant: { buildingType: 3 } },
    building4: { kind: 'wall', class: 'Building', size: [9, 9], pixelMask: true, variant: { buildingType: 4 } },
    building5: { kind: 'wall', class: 'Building', size: [4, 4], pixelMask: true, variant: { buildingType: 5 } },
    building6: { kind: 'wall', class: 'Building', size: [5, 8], pixelMask: true, variant: { buildingType: 6 } },
    building7: { kind: 'wall', class: 'Building', size: [5, 6], pixelMask: true, variant: { buildingType: 7 } },
    building8: { kind: 'wall', class: 'Building', size: [12, 4], pixelMask: true, variant: { buildingType: 8 } },
    // NPCs size their hitbox from their graphic (NPCs/NPC.as) and are "Solid".
    adnanchar: { kind: 'wall', class: 'AdnanCharacter' },
    forestchar: { kind: 'wall', class: 'ForestCharacter' },
    hermit: { kind: 'wall', class: 'Hermit' },
    introchar: { kind: 'wall', class: 'IntroCharacter' },
    karlore: { kind: 'wall', class: 'Karlore' },
    oracle: { kind: 'wall', class: 'Oracle' },
    rekcahdam: { kind: 'wall', class: 'Rekcahdam' },
    sensei: { kind: 'wall', class: 'Sensei' },
    sign: { kind: 'wall', class: 'Sign' },
    totem: { kind: 'wall', class: 'Totem' },
    witch: { kind: 'wall', class: 'Witch' },
    yeti: { kind: 'wall', class: 'Yeti' },

    // --- non-blocking --------------------------------------------------------
    // Enemies: type "Enemy", absent from Mobile.solids, so they do not block.
    bob: { kind: 'open', class: 'Bob' },
    bobsoldier: { kind: 'open', class: 'BobSoldier' },
    bulb: { kind: 'open', class: 'Bulb' },
    darktrap: { kind: 'open', class: 'DarkTrap' },
    drill: { kind: 'open', class: 'Drill' },
    flyer: { kind: 'open', class: 'Flyer' },
    grenade: { kind: 'open', class: 'Grenade' },
    icetrap: { kind: 'open', class: 'IceTrap' },
    jellyfish: { kind: 'open', class: 'Jellyfish' },
    lavaboss: { kind: 'open', class: 'LavaBoss' },
    lavarunner: { kind: 'open', class: 'LavaRunner' },
    lavatrap: { kind: 'open', class: 'LavaTrap' },
    puncher: { kind: 'open', class: 'Puncher' },
    sandtrap: { kind: 'open', class: 'SandTrap' },
    spinner: { kind: 'open', class: 'Spinner' },
    turret: { kind: 'open', class: 'Turret' },
    wallflyer: { kind: 'open', class: 'WallFlyer' },
    lightbosscontroller: { kind: 'open', class: 'LightBossController' },
    lightbosstotem: { kind: 'open', class: 'LightBossTotem' },
    // Pickups: type is never set, so "".
    bosskey: { kind: 'open', class: 'BossKey' },
    conch: { kind: 'open', class: 'Conch' },
    darkshield: { kind: 'open', class: 'DarkShield' },
    darksuit: { kind: 'open', class: 'DarkSuit' },
    feather: { kind: 'open', class: 'Feather' },
    firewand: { kind: 'open', class: 'FireWand' },
    fire: { kind: 'open', class: 'Fire' },
    ghostspear: { kind: 'open', class: 'GhostSpear' },
    ghostsword: { kind: 'open', class: 'GhostSword' },
    health: { kind: 'open', class: 'HealthPickup' },
    seed: { kind: 'open', class: 'Seed' },
    shield: { kind: 'open', class: 'Shield' },
    sword: { kind: 'open', class: 'Sword' },
    torchpickup: { kind: 'open', class: 'TorchPickup' },
    totempart: { kind: 'open', class: 'BossTotemPart' },
    wand: { kind: 'open', class: 'Wand' },
    // Triggers, decoration and level furniture.
    arrowtrap: { kind: 'open', class: 'ArrowTrap' },
    button: { kind: 'open', class: 'Button' },
    buttonroom: { kind: 'open', class: 'ButtonRoom' },
    lightpole: { kind: 'open', class: 'LightPole' },
    lightray: { kind: 'open', class: 'LightRay' },
    littlestones: { kind: 'open', class: 'LittleStones' },
    orb: { kind: 'open', class: 'Orb' },
    pod: { kind: 'open', class: 'Pod' },
    pull: { kind: 'open', class: 'Pull' },
    shadow: { kind: 'open', class: 'Shadow' },
    torch: { kind: 'open', class: 'Torch' },
    watcher: { kind: 'open', class: 'Watcher' },
    whirlpool: { kind: 'open', class: 'Whirlpool' },
    wire: { kind: 'open', class: 'Wire' },
    // Level links. Not blockers — and not the analyzer's business either: a
    // boundary exit is authored in the marking tool, from these very entities.
    stairsup: { kind: 'open', class: 'Stairs', link: true },
    stairsdown: { kind: 'open', class: 'Stairs', link: true },
    teleporter: { kind: 'open', class: 'Teleporter', link: true },
});

/**
 * Ogmo tags that are LEVEL PROPERTIES, not map objects: Game.as reads them off
 * `xml.objects[0]` to set a world-wide flag and never constructs an entity
 * (Game.as:1871-1890 for the light/weather ones, 2048-2065 for control and
 * droplet). They have coordinates in the file but no presence on the map, so
 * they are deliberately unclassified rather than silently 'open'.
 */
export const LEVEL_PROPERTY_TAGS = Object.freeze([
    'blur', 'blur2', 'control', 'daynight', 'droplet', 'lightalpha', 'snow',
]);

const LEVEL_PROPERTY_SET = new Set(LEVEL_PROPERTY_TAGS);

/** True when a tag is a level property rather than a placed entity. */
export const isLevelPropertyTag = (tag) => LEVEL_PROPERTY_SET.has(tag);

/**
 * Traversal semantics of one placed entity, with per-placement attributes
 * resolved (BossLock's key index). Returns null for a level-property tag and
 * for a tag this transcription does not know — the caller reports those; the
 * census guard keeps the second case from ever reaching real data.
 */
export function entitySemantics(entity) {
    const tag = entity?.type;
    if (tag === undefined || isLevelPropertyTag(tag)) return null;
    const base = ENTITY_SEMANTICS[tag];
    if (!base) return null;
    if (base.conditionFromAttr) {
        const raw = entity.attrs?.[base.conditionFromAttr];
        const index = Number(raw);
        if (!Number.isInteger(index)) {
            return { ...base, kind: 'manual', reason: `${base.class}: ${base.conditionFromAttr}="${raw}" is not an integer key index` };
        }
        return { ...base, condition: key(index) };
    }
    return base;
}

/** The tile rect an entity covers: top-left tile + its hitbox size in tiles. */
export function entityFootprint(entity, semantics) {
    const x = Math.floor(entity.x / SEEDLING_TILE_SIZE);
    const y = Math.floor(entity.y / SEEDLING_TILE_SIZE);
    let [w, h] = semantics?.size ?? [1, 1];
    // RopeStart's hitbox spans from its x to the rope's far end (Game.as:2209,
    // RopeStart.as:25), so its width is a per-placement attribute.
    if (semantics?.spanAttr) {
        const end = Number(entity.attrs?.[semantics.spanAttr]);
        if (Number.isInteger(end) && end >= entity.x) {
            w = Math.max(1, Math.ceil((end - entity.x + SEEDLING_TILE_SIZE) / SEEDLING_TILE_SIZE));
        }
    }
    return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

// --- flag -> AP item rules ---------------------------------------------------
//
// The tables above speak the game's flags. Rules in an atlas have to speak AP
// ITEM NAMES, and the mapping between them lives in the per-game engine binding
// (`flashPanel/games/seedling.json`, plan decision 6), not here:
//
//   items[]              flash item name -> the engine property it sets
//   ap_items[]           flash item name -> AP item name
//   progressive_items{}  a '!'-prefixed AP item whose Nth copy grants the Nth
//                        flash item in the list  => Has(name, count = N)
//   fusion_items[]       a flash item that appears only when several other
//                        things are held => And of their rules
//
// A flag with no AP item behind it resolves to null, and the analyzer turns that
// crossing into a hand-authoring row rather than inventing a rule.

const has = (itemName, count = 1) => (count === 1
    ? { rule: 'Has', args: { item_name: itemName } }
    : { rule: 'Has', args: { item_name: itemName, count } });

/**
 * Build `{ flags, keys, unresolved }` from a flashPanel per-game config.
 *
 * `flags[property]` is the Rule Builder tree for "the engine flag `property` is
 * set"; `keys[n]` is the tree for `Player.hasKey(n)`.
 */
export function buildFlagItemRules(gameConfig) {
    const apByFlash = new Map();
    for (const item of gameConfig?.ap_items ?? []) {
        if (typeof item?.flash_name === 'string' && typeof item?.ap_name === 'string') {
            apByFlash.set(item.flash_name, item.ap_name);
        }
    }

    // flash item name -> rule. Direct items first, then the progressive chains
    // (whose members are not themselves AP items), then fusions (which are built
    // out of both).
    const ruleByFlash = new Map();
    for (const [flashName, apName] of apByFlash) {
        if (!flashName.startsWith('!')) ruleByFlash.set(flashName, has(apName));
    }
    for (const [progressive, chain] of Object.entries(gameConfig?.progressive_items ?? {})) {
        const apName = apByFlash.get(progressive);
        if (!apName || !Array.isArray(chain)) continue;
        chain.forEach((flashName, i) => ruleByFlash.set(flashName, has(apName, i + 1)));
    }
    const unresolved = [];
    for (const fusion of gameConfig?.fusion_items ?? []) {
        const parts = [];
        let ok = true;
        for (const flagName of fusion.requires_flags ?? []) {
            const apName = apByFlash.get(flagName);
            if (apName) parts.push(has(apName)); else ok = false;
        }
        for (const itemName of fusion.requires_items ?? []) {
            const rule = ruleByFlash.get(itemName);
            if (rule) parts.push(rule); else ok = false;
        }
        for (const [progressive, count] of Object.entries(fusion.requires_progressive ?? {})) {
            const apName = apByFlash.get(progressive);
            if (apName) parts.push(has(apName, count)); else ok = false;
        }
        if (!ok || parts.length === 0) {
            unresolved.push(`fusion item "${fusion.result}" has requirements with no AP item behind them`);
            continue;
        }
        ruleByFlash.set(fusion.result, parts.length === 1 ? parts[0] : { rule: 'And', children: parts });
    }

    // engine property -> rule, via items[].
    const flags = {};
    for (const item of gameConfig?.items ?? []) {
        if (item?.op !== undefined || item?.value !== true) continue; // counters, not flags
        const rule = ruleByFlash.get(item.flash_name);
        if (!rule) {
            unresolved.push(`flash item "${item.flash_name}" (property ${item.property}) has no AP item behind it`);
            continue;
        }
        flags[item.property] = rule;
    }

    // Key indices. Keys set no engine property (Player.hasKey reads its own
    // array), so they are matched on the `key<N>` flash-name convention.
    const keys = {};
    for (const [flashName, apName] of apByFlash) {
        const m = /^key(\d+)$/.exec(flashName);
        if (m) keys[Number(m[1])] = has(apName);
    }

    return { flags, keys, unresolved };
}

/**
 * Turn a condition node from the tables above into a Rule Builder tree, or null
 * when any leaf has no AP item behind it (the crossing then needs hand
 * authoring). `And`/`Or` children are flattened and de-duplicated so a crossing
 * whose two paths share a requirement does not emit it twice.
 */
export function resolveCondition(condition, flagRules) {
    if (condition == null) return null;
    if (condition.flag !== undefined) return flagRules?.flags?.[condition.flag] ?? null;
    if (condition.key !== undefined) return flagRules?.keys?.[condition.key] ?? null;
    for (const [op, ruleName] of [['any', 'Or'], ['all', 'And']]) {
        if (!Array.isArray(condition[op])) continue;
        const children = [];
        const seen = new Set();
        for (const part of condition[op]) {
            const resolved = resolveCondition(part, flagRules);
            if (!resolved) return null;
            const flat = resolved.rule === ruleName && Array.isArray(resolved.children)
                ? resolved.children : [resolved];
            for (const child of flat) {
                const k = JSON.stringify(child);
                if (seen.has(k)) continue;
                seen.add(k);
                children.push(child);
            }
        }
        if (children.length === 0) return null;
        return children.length === 1 ? children[0] : { rule: ruleName, children };
    }
    return null;
}

/** Stable identity for a condition node, so equal conditions merge. */
export function conditionKey(condition) {
    if (condition == null) return 'none';
    if (condition.flag !== undefined) return `flag:${condition.flag}`;
    if (condition.key !== undefined) return `key:${condition.key}`;
    if (Array.isArray(condition.any)) return `any(${condition.any.map(conditionKey).sort().join('|')})`;
    if (Array.isArray(condition.all)) return `all(${condition.all.map(conditionKey).sort().join('&')})`;
    return `unknown:${JSON.stringify(condition)}`;
}

// --- grid construction -------------------------------------------------------

const DIRECTIONS = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });

export { DIRECTIONS as SEEDLING_DIRECTIONS };

/**
 * Build the analyzer's cell grid for one atlas region.
 *
 * The grid it returns is GAME-AGNOSTIC — the analyzer core reads only `kind`,
 * `conditions` (ANDed to occupy the cell), `faces` (per-direction overrides,
 * `null` blocking) and `manual` (why a blocker has no derivable rule). All the
 * Seedling knowledge is spent here.
 *
 * Coordinates: the extract's tile placements are `[x, y, tx, ty]` with x/y
 * already in TILES (the Phase-2 extractor divides by 16), while entity x/y stay
 * in raw pixels and are snapped here. Cells are indexed in REGION-LOCAL
 * coordinates; `origin` translates back.
 *
 * Layering matches the game's own load order: the `tiles` layer, then
 * `cliffsides` (a per-pixel solid mask, treated as tile-granular solid), then
 * entities. Everything claiming a cell is kept, and the cell takes the
 * STRONGEST claim — wall > manual > sink > gated/directional > open — with the
 * conditions of every gated claim ANDed, so a breakable rock standing in water
 * reads as "you need to get through both" rather than as whichever was applied
 * last.
 *
 * @param {{ x:number, y:number, w:number, h:number }} bounds region bounds
 * @param {object} level a level record from seedling-map.json
 */
export function buildSeedlingRegionGrid(bounds, level) {
    const { w: width, h: height } = bounds;
    const cells = new Array(width * height);
    for (let i = 0; i < cells.length; i += 1) {
        cells[i] = { kind: 'open', conditions: [], faces: {}, dirs: {}, manual: [], labels: [] };
    }

    const unclassified = [];
    const review = [];
    const sinks = [];
    const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;

    // Higher rank wins the cell's kind; every claim still contributes its
    // conditions, faces and manual reasons.
    const RANK = { open: 0, gated: 1, directional: 1, sink: 2, manual: 3, wall: 4 };
    const claim = (x, y, semantics, origin) => {
        if (!inside(x, y)) return;
        const cell = cells[y * width + x];
        if (RANK[semantics.kind] >= RANK[cell.kind]) cell.kind = semantics.kind;
        if (semantics.label) cell.labels.push(semantics.label);
        if (semantics.condition) cell.conditions.push(semantics.condition);
        if (semantics.kind === 'manual') {
            cell.manual.push(`${origin}: ${semantics.reason ?? 'no derivable rule'}`);
        }
        // A blocked face/direction always wins; two gated ones AND together,
        // which the analyzer does by seeing the list.
        for (const key of ['faces', 'dirs']) {
            for (const [dir, cond] of Object.entries(semantics[key] ?? {})) {
                const current = cell[key][dir];
                if (current === null) continue;
                if (cond === null) cell[key][dir] = null;
                else cell[key][dir] = [...(current ?? []), cond];
            }
        }
        if (semantics.review) review.push({ tile: [x + bounds.x, y + bounds.y], reason: semantics.review });
        if (semantics.kind === 'sink') sinks.push({ tile: [x + bounds.x, y + bounds.y], label: semantics.label ?? null });
    };

    for (const layer of level?.layers ?? []) {
        const cliffside = layer.name === 'cliffsides';
        for (const placement of layer.tiles ?? []) {
            const [tx, ty] = placement;
            const x = tx - bounds.x;
            const y = ty - bounds.y;
            if (!inside(x, y)) continue;
            if (cliffside) {
                claim(x, y, { kind: 'wall', label: 'cliffside' }, 'cliffsides');
                continue;
            }
            const t = tileTypeForPlacement(placement);
            if (t === null) {
                unclassified.push({ tile: [tx, ty], what: `tileset column ${Math.floor(placement[2] / SEEDLING_TILE_SIZE)}` });
                continue;
            }
            claim(x, y, tileSemantics(t), `tile ${TILE_TYPE_NAMES[t] ?? t}`);
        }
    }

    for (const entity of level?.entities ?? []) {
        if (isLevelPropertyTag(entity.type)) continue;
        const semantics = entitySemantics(entity);
        if (!semantics) {
            unclassified.push({
                tile: [Math.floor(entity.x / SEEDLING_TILE_SIZE), Math.floor(entity.y / SEEDLING_TILE_SIZE)],
                what: `entity "${entity.type}"`,
            });
            continue;
        }
        if (semantics.kind === 'open') continue;
        const fp = entityFootprint(entity, semantics);
        for (let dy = 0; dy < fp.h; dy += 1) {
            for (let dx = 0; dx < fp.w; dx += 1) {
                claim(fp.x + dx - bounds.x, fp.y + dy - bounds.y, semantics, `entity ${entity.type}`);
            }
        }
    }

    return {
        width,
        height,
        cells,
        origin: { x: bounds.x, y: bounds.y },
        unclassified,
        review,
        sinks,
    };
}
