/**
 * seedlingDemo/seedlingSetMapUnreachable — **THE REPORT'S UNREACHABLE REGIONS, AS ROOMS OF THE LAB MAP** (slice
 * `seedling-map-unreachable`). `seedlingSetMap.createSetMap` hands this to `setEditorView` as the provider's optional
 * `unreachableOf`. ⛔ Its own module, not an export of `seedlingSetMap`: that module's export list is part of the
 * map digest `seedlingSetMapLift.test.js` pins, and a mark drawn only after a REPORT must leave that digest alone.
 */

import { DEFAULT_PLAYER_ID, reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';
import { apRegionNamesFor } from '../procgenPipeline/regionAtlasCompiler.js';

/**
 * ⛓⛓ **THE ROOMS THE LAST REPORT FOUND UNREACHABLE** (slice `seedling-map-unreachable`), as map cells.
 *
 * The REPORT (`setEditorCore.reportOver`, section 3) names compiled AP REGIONS: every region of `report.rules` that
 * `rulesGraph.reachableRegions` (edges all free — the STRUCTURAL answer) does not reach. This asks the same function
 * the same question over the same `report.rules`, so it is that list by construction and not a second reading of it.
 * A region is joined to its ROOM through the report's own derived atlas: each atlas region's compiled names
 * (`apRegionNamesFor`: the bare `region_id`, or one per sub-region) and its `map_ref`, which in a Seedling set IS the
 * room index (`seedlingSetAdapter`'s own join). No table of names lives here.
 *
 * A room with several regions (a subgraph) where only some are unreachable is returned `partial: true` with just
 * those regions; one whose every region is unreachable is `partial: false`. A compiled region no atlas region names
 * (`Menu`) maps to no room. ⚠ A region the derivation DROPPED (no link reaches it and it holds nothing) is not in the
 * rules, so the REPORT names it in a `derive` row, not as unreachable, and it is not marked here either.
 *
 * ⛔ `[]` for a report with no compiled rules (the atlas did not derive or compile) and for a COMPOSITE report
 * (`derivedParts` set): there `map_ref` is a PART's local index and is not a cell of this map.
 *
 * @param {object|null} report  `setEditorView`'s `lastReport`
 * @param {string} [playerId]
 * @returns {Array<{room: number, partial: boolean, regions: string[]}>} by room index
 */
export function unreachableRoomsOf(report, playerId = DEFAULT_PLAYER_ID) {
    if (!report?.rules || !report.atlas || report.derivedParts) return [];
    const compiled = regionsOf(report.rules, playerId);
    const reached = reachableRegions(report.rules, playerId);
    const unreachable = new Set(Object.keys(compiled).filter((n) => !reached.has(n)));
    if (unreachable.size === 0) return [];
    const byRoom = new Map();
    for (const region of report.atlas.regions ?? []) {
        if (!Number.isInteger(region.map_ref)) continue;
        // ⛓ only the names the compile actually built: `partial` compares compiled regions, never a guess
        const names = apRegionNamesFor(region).filter((n) => Object.prototype.hasOwnProperty.call(compiled, n));
        const row = byRoom.get(region.map_ref) ?? { all: [], hit: [] };
        row.all.push(...names);
        row.hit.push(...names.filter((n) => unreachable.has(n)));
        byRoom.set(region.map_ref, row);
    }
    return [...byRoom.entries()]
        .filter(([, r]) => r.hit.length > 0)
        .sort(([a], [b]) => a - b)
        .map(([room, r]) => Object.freeze({
            room, partial: r.hit.length < r.all.length, regions: Object.freeze([...r.hit]),
        }));
}
