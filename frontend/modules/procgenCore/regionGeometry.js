// frontend/modules/procgenCore/regionGeometry.js
//
// ⛓⛓ PRESET SIDECARS slice G0 — **WHAT A SUBSTRATE'S REGION GEOMETRY IS**, as a
// registry-entry declaration (`regionGeometry`), read by the pipeline engine.
//
//   · `'tiles'` — the region is a tile grid and each exit stands ON a tile
//     (`exits[].x/y`, `exits_placed[].tile_position`, `extracted_rules.exits[].
//     position`). The maze's spawn, BFS and serializer read those tiles.
//   · `'sides'` — the region is a ZONE whose exits are only SIDES. Nothing reads
//     a tile off it (flash routes by `side`; jta/omsi label by `side`;
//     `stitchGrid` keys on `exit_id` + `side`), so the engine mints none.
//
// ⛔ ABSENT = `'tiles'` — today's behaviour for every entry that does not speak,
// so declaring the slot on one entry moves nothing on another.
//
// ⛓ The one cross-boundary read (plan §19.2): a maze CHILD's entrance is its
// PARENT's exit tile mirrored. A sides-only parent carries none, so the engine
// falls back to the perimeter midpoint of that side — exactly the tile a zone
// region carried before this slot existed, so the child's bytes do not move.
//
// ⛔ IT LIVES HERE AND NOT IN THE ENGINE because a substrate library DECLARES
// with the constant below (never a literal), and a library importing the
// pipeline engine would invert the layering; the engine imports `geometryOf`
// and re-exports it. This module imports nothing (`bindingContract.test.js`
// reads its roster off the directory).

/** The closed vocabulary of the `regionGeometry` registry-entry slot. */
export const REGION_GEOMETRY = Object.freeze({
    TILES: 'tiles',
    SIDES: 'sides',
});

/** Every legal `regionGeometry` value, in declaration order. */
export const REGION_GEOMETRIES = Object.freeze(Object.values(REGION_GEOMETRY));

/** What an entry that does not declare the slot gets. */
export const DEFAULT_REGION_GEOMETRY = REGION_GEOMETRY.TILES;

/**
 * The region geometry a registry entry declares. An absent entry (an
 * unregistered id) and an absent slot both read as the default; a value
 * outside the vocabulary is REFUSED BY NAME — never silently read as tiles.
 *
 * @param {object|undefined} entry a substrate registry entry
 * @returns {'tiles'|'sides'}
 */
export function geometryOf(entry) {
    const declared = entry?.regionGeometry;
    if (declared === undefined) return DEFAULT_REGION_GEOMETRY;
    if (!REGION_GEOMETRIES.includes(declared)) {
        throw new Error(`regionGeometry: substrate '${entry.id}' declares `
            + `${JSON.stringify(declared)} — not one of ${REGION_GEOMETRIES.map((g) => `'${g}'`).join(', ')}`);
    }
    return declared;
}
