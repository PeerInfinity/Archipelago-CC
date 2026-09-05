// frontend/modules/procgenCore/apLocationNaming.js
//
// THE AP-canonical LOCATION-NAME convention, in one place.
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
