/**
 * seedlingDemo/procgenLook — **A GENERATED ROOM'S LOOK**: which tileset columns
 * its floor and its walls are painted with (Seedling lab arc, `seedling-gen-biomes-1`,
 * C1).
 *
 * ⚖ The user (2026-10-28): *"I want the biomes to include the looks eventually."*
 * Each look is one of the original game's areas, its floor and wall column read
 * off the vanilla census (the gen-content design's §3.3 LOOK column).
 *
 * ── A LOOK IS A FINAL REPAINT, NEVER A PALETTE ─────────────────────────
 *
 * The generator reasons in `procgenLevel.TERRAIN`'s names, and its placement
 * rules read them back (`terrainAt(record, x, y) === 'ground'`, ~a dozen sites
 * in `procgenSeedling`). A column `TERRAIN` does not name reads back as `null`,
 * so painting Forest where the generator wrote ground would make every later
 * rule see a room with no floor. ⛔ So the generator is untouched: `applyLook`
 * runs on the FINISHED record, where nothing reads terrain by name again, and
 * swaps `TERRAIN.ground`'s column for the look's floor and `TERRAIN.wall`'s for
 * its wall. Water, pit and waterfall cells keep their columns.
 *
 * ── AND IT IS COSMETIC, CHECKED AT LOAD ────────────────────────────────
 *
 * A look may only change what the room LOOKS like. A floor must build a tile the
 * game treats exactly as Ground (entity type `Tile`, the plain walk speed, no
 * entry in `TILE_TYPE_SEMANTICS`, no grass), a wall exactly as Stone (`Solid`).
 * `assertLookCosmetic` checks each look against the engine's own tables when this
 * module loads, so a look that painted ice, lava or a stair never reaches a room.
 * Walk-changing terrain is C3's, as its own templates.
 *
 * ⚠ TWO TYPES §3.2 CALLS COSMETIC ARE NOT, and are left out of the sets:
 *  · Cave (13): `Tile.check` adds a 1 px `Solid` on the tile's top edge
 *    (`Tile.as`, `case 13`), so a cave floor walls off its north face;
 *  · Ice Wall (glowing) (24): `Tile.check` adds a `Light` entity per tile.
 *
 * ⛔ ABSENT IS THE DEFAULT. `applyLook(record, null)` returns the record itself,
 * so a caller that names no look builds the room it always built, byte for byte.
 *
 * ⛔ NO NODE IMPORTS: the lab's generate arm loads this in the browser.
 */

import {
    TILE_COLUMN_TO_TYPE, TILE_COLUMN_VARIANTS, TILE_TYPE_ENTITY_TYPES, TILE_TYPE_NAMES, TILE_TYPE_SEMANTICS,
} from '../flashPanel/seedlingSemantics.js';
import { MOVE_SPEEDS, WALK_SPEED } from './playerPhysicsV1.js';
import { TERRAIN } from './procgenLevel.js';
import { TILE_SIZE } from './levelWorld.js';

/** The floor types a look may paint: entity type `Tile`, walk speed, no semantics (Cave 13 left out). */
export const COSMETIC_FLOOR_TYPES = Object.freeze([0, 3, 4, 5, 7, 8, 12, 16, 18, 21, 26, 28, 32, 33, 37]);

/** The wall types a look may paint: entity type `Solid` (Ice Wall glowing 24 left out). */
export const COSMETIC_WALL_TYPES = Object.freeze([2, 9, 11, 14, 15, 19, 20, 23, 27, 34, 35, 36]);

/** The types `Tile.check` adds grass to (`case 0` / `case 8`, `if (grass) addGrass()`). */
const GRASS_TYPES = Object.freeze([0, 8]);

const look = (area, floor, wall) => Object.freeze({ area, floor, wall });

/**
 * ⛓ THE LOOKS, by name: `{area, floor, wall}`, `floor` and `wall` tileset
 * COLUMNS (`TILE_COLUMN_TO_TYPE` gives the type). A biome's own look has the
 * biome's name; `overworld` is a look with no biome of its own, spelled as
 * `{biome: 'pre-sword', look: 'overworld'}` (any biome takes any look).
 *
 * ⚠ `pre-sword`'s look is D1's (Dungeon Tile / Stone), and that is NOT today's
 * room: the generator's floor is `TERRAIN.ground`, column 0 (Ground). Today's
 * room is the ABSENT look.
 */
export const GEN_LOOKS = Object.freeze({
    'pre-sword': look('D1', 6, 3),           // Dungeon Tile / Stone
    overworld: look('Overworld', 9, 11),     // Forest (no grass) / Cliff
    'post-sword': look('D2', 8, 3),          // Shield Tile / Stone
    'post-shield': look('D3', 9, 16),        // Forest (no grass) / Wood (natural)
    'post-fire': look('D4', 20, 21),         // Blue Tile / Blue Wall
    'post-swim': look('D5', 23, 25),         // Snow / Ice Wall
    'post-feather': look('D6', 33, 34),      // Body Floor / Body Wall
    'post-spear': look('D7', 18, 17),        // Igneous Stone / Dark Stone
    'post-dark-suit': look('D8', 39, 41),    // Odd Tile / Odd Tile (wall)
    endgame: look('End', 44, 43),            // Rock Wall (floor) / Rock Wall
    // ⛓ seedling-gen-new-biomes (C4) — the new biomes' own looks: no original area, so each names
    //   its theme. Their columns are all used by a look above (the lab-art row measures per column).
    //   caldera's floor is plain grey rock so the melt crust (Igneous-to-Lava) and the lava read against it
    //   (on D7's speckled Igneous Stone the crust is hard to see); frozen-forge's floor is blue tile so the
    //   ice sheets read against it; flooded-ruins is D1's.
    caldera: look('Caldera', 44, 17),        // Rock Wall (floor) / Dark Stone
    'frozen-forge': look('Frozen forge', 20, 25), // Blue Tile / Ice Wall
    'flooded-ruins': look('D1', 6, 3),       // Dungeon Tile / Stone (pre-sword's)
});

export const GEN_LOOK_NAMES = Object.freeze(Object.keys(GEN_LOOKS));

class ProcgenLookError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenLookError';
    }
}
const fail = (message) => { throw new ProcgenLookError(message); };

/** Why a column is not a cosmetic `role` ('floor' | 'wall'), or null when it is. */
export function lookColumnRefusal(column, role) {
    const type = TILE_COLUMN_TO_TYPE[column];
    if (type === undefined) return `column ${column} builds no tile`;
    const name = `column ${column} (${TILE_TYPE_NAMES[type]}, type ${type})`;
    const set = role === 'floor' ? COSMETIC_FLOOR_TYPES : COSMETIC_WALL_TYPES;
    if (!set.includes(type)) return `${name} is not in the cosmetic ${role} set`;
    const entity = role === 'floor' ? 'Tile' : 'Solid';
    if (TILE_TYPE_ENTITY_TYPES[type] !== entity) return `${name} is a "${TILE_TYPE_ENTITY_TYPES[type]}", not a "${entity}"`;
    if (role === 'floor' && MOVE_SPEEDS[type] !== WALK_SPEED) return `${name} changes the walk speed`;
    if (TILE_TYPE_SEMANTICS[type]) return `${name} has its own semantics (${TILE_TYPE_SEMANTICS[type].label})`;
    // ⚠ Grass is the Tile constructor's DEFAULT (`grass = true`) for Ground and Forest: only the columns
    //   `Game.as` builds with `false` (0 and 9, `TILE_COLUMN_VARIANTS`) are bare.
    if (GRASS_TYPES.includes(type) && TILE_COLUMN_VARIANTS[column]?.grass !== false) return `${name} grows grass`;
    return null;
}

/** Refuse, by name, a look whose floor or wall is not cosmetic. */
export function assertLookCosmetic(name, l) {
    for (const role of ['floor', 'wall']) {
        const why = lookColumnRefusal(l?.[role], role);
        if (why) {
            fail(`procgenLook: the look "${name}" paints its ${role} with ${why}. A look may only change what `
                + 'a room looks like; walk-changing terrain is placed by a template, never by a look.');
        }
    }
    return true;
}

for (const [name, l] of Object.entries(GEN_LOOKS)) assertLookCosmetic(name, l);

/** The look a name selects, refusing an unknown one BY NAME. */
export function lookByName(name) {
    const l = GEN_LOOKS[name];
    if (!l) fail(`procgenLook: "${name}" is not a look (the looks are [${GEN_LOOK_NAMES.join(', ')}]).`);
    return l;
}

/**
 * The record with its ground and wall cells painted in `name`'s look — or the
 * record ITSELF when `name` is absent (`null`, `undefined` or `''`).
 *
 * Only the `tiles` layer moves, and only cells on `TERRAIN.ground`'s or
 * `TERRAIN.wall`'s column; everything else (water, pit, waterfall, entities) is
 * copied as it is. Re-applying a look to a looked record moves nothing more.
 */
export function applyLook(record, name) {
    if (name === null || name === undefined || name === '') return record;
    const l = lookByName(name);
    const swap = new Map([[TERRAIN.ground.column, l.floor], [TERRAIN.wall.column, l.wall]]);
    return {
        ...record,
        layers: record.layers.map((layer) => (layer.name !== 'tiles' || !Array.isArray(layer.tiles) ? layer : {
            ...layer,
            tiles: layer.tiles.map((t) => {
                const to = swap.get(Math.floor(t[2] / TILE_SIZE));
                return to === undefined ? t : [t[0], t[1], to * TILE_SIZE, ...t.slice(3)];
            }),
        })),
    };
}

/**
 * ⛓ THE LAB'S LOOK SELECT (watch.html's generate arm). Its choices are the
 * biome's OWN look (the default), NONE (today's Ground / Stone) or any look by
 * name. ⛔ The lab applies the look to the room it DRAWS, never to the state's
 * record: the payload, the `?gen=` reproduction, the directives and the edits all
 * read the generator's own record, so the page's committed outputs do not move.
 */
export const LAB_LOOK_OWN = 'own';
export const LAB_LOOK_NONE = 'none';
export const LAB_LOOK_CHOICES = Object.freeze([LAB_LOOK_OWN, LAB_LOOK_NONE, ...GEN_LOOK_NAMES]);

/** The look name a lab choice draws `biome` in, or null for none. */
export function labLookOf(choice, biome) {
    if (choice === LAB_LOOK_NONE) return null;
    if (choice === LAB_LOOK_OWN || choice === undefined || choice === null || choice === '') {
        return GEN_LOOKS[biome] ? biome : null;
    }
    lookByName(choice);
    return choice;
}
