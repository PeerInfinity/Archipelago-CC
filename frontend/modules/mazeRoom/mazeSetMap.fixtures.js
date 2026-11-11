/**
 * MAZE WORLD MAP fixtures — a GENERATED region library with its links, built from a committed maze preset.
 *
 * A committed region library carries no wiring (a library forbids it inside its entries, and the demo packs ship no
 * overlay), so a map of one is rooms and no links. A generated preset IS wired: every maze region's sidecar exit
 * names its `targetRegion` / `targetExitId`. This turns one player's maze regions into the two documents the set arm
 * loads — the library, through the maze's own capture hook (`substrateRegistryEntry.captureLibraryEntry`, the
 * pipeline's "Save to library ▸"), and an overlay whose links are the sidecars' targets — so the unit rows and the
 * browser row map the same generated world.
 *
 * ⛔ Test and gate code only: nothing that ships imports this.
 */

import { stampLibraryIdentity } from '../procgenPipeline/regionLibraryValidator.js';
import { emptyMazeOverlay } from './mazeAtlasDerivation.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';

/**
 * @param {object} rules  a `rules.json` with maze `preset_sidecars`
 * @param {{player?: string, libraryId?: string}} [o]
 * @returns {{library: object, overlay: object, regions: string[], census: {twoWay:number, oneWay:number,
 *   dropped:number, conflicts:number}}}  `dropped` counts exits whose target is not a maze region of this player;
 *   `conflicts` counts links skipped because an endpoint was already joined (an overlay exit crosses to exactly one
 *   place — `procgen_topdown`'s hub doors are many-to-one)
 */
export function generatedMazeLibrary(rules, { player = '1', libraryId = 'generated-maze-map' } = {}) {
    const sidecars = rules?.preset_sidecars?.[player] ?? {};
    const regions = Object.keys(sidecars).filter((id) => sidecars[id]?.substrate === 'maze'
        && sidecars[id]?.playable_payload?.tiles && sidecars[id].playable_payload.exits);
    const indexOf = new Map(regions.map((id, i) => [id, i]));
    const entries = regions.map((id) => substrateRegistryEntry.captureLibraryEntry(
        { region_id: id, playable_payload: deserializeMazeWorld(sidecars[id].playable_payload) },
        { entry_id: id, name: id }));
    const links = [];
    const census = { twoWay: 0, oneWay: 0, dropped: 0, conflicts: 0 };
    const joined = new Set();
    const end = (room, id) => `${room}/${id}`;
    regions.forEach((id, i) => {
        for (const ex of sidecars[id].playable_payload.exits) {
            const j = indexOf.get(ex.targetRegion);
            const back = j === undefined ? null
                : sidecars[ex.targetRegion].playable_payload.exits.find((e) => e.exit_id === ex.targetExitId);
            if (!back) { census.dropped += 1; continue; }
            const twoWay = back.targetRegion === id && back.targetExitId === ex.exit_id;
            // ⛓ a two-way pair is ONE link, written once, from its lower endpoint
            if (twoWay && (j < i || (j === i && back.exit_id < ex.exit_id))) continue;
            if (joined.has(end(i, ex.exit_id)) || joined.has(end(j, ex.targetExitId))) { census.conflicts += 1; continue; }
            joined.add(end(i, ex.exit_id));
            joined.add(end(j, ex.targetExitId));
            links.push({ from: [i, ex.exit_id], to: [j, ex.targetExitId], one_way: !twoWay });
            census[twoWay ? 'twoWay' : 'oneWay'] += 1;
        }
    });
    const library = stampLibraryIdentity({
        schema_version: 1,
        library_id: libraryId,
        name: `Generated maze map (${rules?.game_name ?? 'preset'})`,
        description: `${entries.length} maze rooms captured from a generated preset, wired by its sidecars`,
        provenance: { source: 'mazeSetMap.fixtures.generatedMazeLibrary' },
        entries,
    });
    return { library, overlay: { ...emptyMazeOverlay(), links }, regions, census };
}
