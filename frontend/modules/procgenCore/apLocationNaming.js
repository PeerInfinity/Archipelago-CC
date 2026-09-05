// frontend/modules/procgenCore/apLocationNaming.js
//
// THE AP-canonical NAME conventions for a region's ENDPOINTS, in one place —
// the location names the pipeline mints, and (since H4b) the two spellings an
// EXIT's name can have in a committed document.
//
// ⛓ APWORLD EDITOR HUB slice H3b. It was `procgenPipelineEngine.js:2240`, next
// to `apIdNamespaces.js`'s id bases, and it had TWO callers inside that one
// file: `compileRegionGraph` (populates the regions block) and
// `serializeMazeWorld` (bakes `locationName` into each sidecar item so the
// substrate panel can publish `user:locationCheck` without a runtime lookup).
// H3b moved the serializer to `mazeRoom/mazeSerializer.js`, beside its inverse
// — so the convention needed a home BOTH halves can import, and the rule of
// that slice is that `mazeRoom/` imports nothing from `procgenPipeline/`.
//
// ⛔ IT LIVES HERE AND NOT IN `apIdNamespaces.js` because that module is the
// register of NUMERIC id bases and the allocator that mints from them; a name
// convention is a different subject with a different pin. Its neighbour, not
// its content.
//
// ⛓ WHY THE NAMES MAY NOT MOVE, exactly as the id bases may not: the shape
// below is baked into every committed `preset_sidecars` payload (1,360 entries
// over 34 documents, measured 2026-09-05) and into every `regions` block the
// pipeline emits, so the preset byte-identity dumps
// (`scripts/procgen/dump-{sphere,spiral,topdown}-byteidentity.mjs`) go red if
// the separator, the order, or the position suffix changes.
//
// This module imports nothing — `procgenCore/bindingContract.test.js` reads its
// roster off the directory, so this file joined that scan by existing.

/**
 * Construct a location's globally unique name from its region name,
 * extracted location id, and position. Position is appended so that
 * multiple same-id locations in one region (e.g. two key_red_pickup
 * entries) don't collide.
 *
 * @param {string} regionName the region's compiled name
 * @param {string} locId the extracted location id
 * @param {{x:number,y:number}} [position] omitted for substrates with no
 *   tile coordinates — the name is then `region__locId`.
 * @returns {string}
 */
export function makeLocationName(regionName, locId, position) {
    const suffix = position ? `__${position.x}_${position.y}` : '';
    return `${regionName}__${locId}${suffix}`;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ APWORLD EDITOR HUB slice H4b — READING A NAME BACK
 * ══════════════════════════════════════════════════════════════════════
 *
 * A room editor hands back GEOMETRY, and the ids in it are the ones
 * `extractPathsAndObstacles` / a zone payload use — `exit_1`, `key_red_pickup`,
 * `loc_arrow`. The DOCUMENT names the same endpoints differently, and there are
 * exactly two spellings for each, both DERIVED and neither guessed:
 *
 *   · a LOCATION is `makeLocationName` above, with or without the position
 *     suffix (a substrate with no tile coordinates omits it — bounce's
 *     `ap_locations` map is the payload saying so itself);
 *
 *   · an EXIT is its raw id, UNLESS the raw id occurs on more than one region
 *     of the document, in which case `world_generator/extractors.py:549` mints
 *     `f"{region_name}__{raw_name}"` to keep AP Entrance names globally unique.
 *     ⛔ MEASURED on the H4a fixture: `region_1_0`'s two exits are
 *     `region_1_0__exit_1` (because `exit_1` occurs in three regions) and
 *     `region_1_1` (because it occurs once) — so the prefix is NOT uniform
 *     even inside ONE region, and a matcher that assumed either spelling
 *     alone would miss half of them.
 *
 * ⚠ CANDIDATES, in preference order — never a single answer. The caller looks
 * each one up in the document it holds and takes the first that is there; a
 * candidate list that matches NOTHING is what makes an unmappable endpoint
 * REFUSABLE BY NAME instead of silently renamed.
 */

/** ⛓ The names a compiled location may go by in a rules.json document. */
export function apLocationNameCandidates(regionName, locId, position) {
    const withPos = makeLocationName(regionName, locId, position);
    const bare = makeLocationName(regionName, locId);
    return withPos === bare ? [bare] : [withPos, bare];
}

/** ⛓ The names a compiled exit may go by. See the block above for the second. */
export function apExitNameCandidates(regionName, exitId) {
    const prefixed = `${regionName}__${exitId}`;
    return exitId === prefixed ? [exitId] : [exitId, prefixed];
}
