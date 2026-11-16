/**
 * seedlingSetMapUnreachable.test — **THE REPORT'S UNREACHABLE REGIONS, AS MAP ROOMS** (slice `seedling-map-unreachable`).
 *
 * `seedlingSetMapUnreachable.unreachableRoomsOf(report)` turns the last REPORT into the rooms the lab map marks. Every claim is
 * against the REPORT itself (`watchSetEditor.reportOf` over a real set session), never against a hand-typed list.
 *
 * MUTANTS (each reds a row): join a region to a room by its position in `atlas.regions` instead of `map_ref` (the
 * partial row); drop the `derivedParts` guard (the composite row); mark every compiled region (the clean-set row);
 * treat a room as unreachable when ANY region is, with `partial` always false (the partial row).
 */
import { describe, expect, it } from 'vitest';

import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';
import { tileTypeForPlacement, SEEDLING_TILE_SIZE } from '../flashPanel/seedlingSemantics.js';
import { buildLevelSet } from './levelSetExporter.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { emptyOverlay } from './seedlingSetOverlay.js';
import { createSeedlingSetAdapter, createSetSession, setRecord } from './seedlingSetAdapter.js';
import { createSetMap } from './seedlingSetMap.js';
import { unreachableRoomsOf } from './seedlingSetMapUnreachable.js';
import { reportOf } from './watchSetEditor.js';

const DEPS = Object.freeze({
    parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement,
    atlas: { game: 'seedling-set-map-unreachable-test', mapDocument: 'seedling-set-map-unreachable-test.json' },
});
const adapter = createSeedlingSetAdapter(DEPS);

/** A six-room CHAIN, 0 ↔ 1 ↔ … ↔ 5, wired by the exporter's own linker (room `i`'s exit #1 leads to `i + 1`). */
const chainSession = () => {
    const set = buildLevelSet(Array.from({ length: 6 }, (_, level) => emptyLevel({ level })),
        { setId: 'seedling-set-map-unreachable-test', link: true }).set;
    return createSetSession(adapter, setRecord(set, emptyOverlay()), { base: { kind: 'set', set_id: set.set_id } });
};
const report = (s) => reportOf(s, DEPS, { compileRegionAtlas });
/** The REPORT's own `reach` error rows, as region names. */
const reachRows = (rep) => rep.rows.filter((r) => r.kind === 'reach' && r.severity === 'error')
    .map((r) => /region "([^"]+)"/.exec(r.text)[1]);

describe('⛓ seedling-map-unreachable — the REPORT\'s unreachable regions → the rooms the map marks', () => {
    it('a set whose graph closes marks NO room (and the REPORT names none)', () => {
        const rep = report(chainSession());
        expect(reachRows(rep)).toEqual([]);
        expect(unreachableRoomsOf(rep)).toEqual([]);
    });

    it('a disconnected door marks exactly the rooms the REPORT names, each by its own room index', () => {
        const s = chainSession();
        expect(s.apply({ op: 'disconnect', room: 3, exitIndex: 1 }).ok).toBe(true);
        const rep = report(s);
        const marks = unreachableRoomsOf(rep);
        expect(marks.map((m) => m.room)).toEqual([4, 5]);
        expect(marks.every((m) => m.partial === false)).toBe(true);
        // ⛓ the regions the marks carry ARE the REPORT's list, by its own rows
        expect(marks.flatMap((m) => m.regions).sort()).toEqual(reachRows(rep).sort());
        // ⛓ and each region's room is its atlas `map_ref`, not its name
        for (const m of marks) {
            for (const name of m.regions) {
                expect(rep.atlas.regions.find((r) => r.region_id === name).map_ref).toBe(m.room);
            }
        }
    });

    it('a room with several regions where only SOME are unreachable is marked `partial`, with just those', () => {
        const s = chainSession();
        s.apply({ op: 'disconnect', room: 4, exitIndex: 1 });
        const rep = report(s);
        const reached = reachableRegions(rep.rules);
        const gone = Object.keys(regionsOf(rep.rules)).filter((n) => !reached.has(n));
        expect(gone).toEqual(['level_5']);
        // ⛓ give room 5 a SECOND compiled region (room 3's, reachable) by moving its `map_ref` — the join is map_ref
        const atlas = {
            ...rep.atlas,
            regions: rep.atlas.regions.map((r) => (r.region_id === 'level_3' ? { ...r, map_ref: 5 } : r)),
        };
        expect(unreachableRoomsOf({ ...rep, atlas })).toEqual([{ room: 5, partial: true, regions: ['level_5'] }]);
        expect(unreachableRoomsOf(rep)).toEqual([{ room: 5, partial: false, regions: ['level_5'] }]);
    });

    it('no compiled rules, or a COMPOSITE report (part-local map_ref), marks nothing', () => {
        const s = chainSession();
        s.apply({ op: 'disconnect', room: 4, exitIndex: 1 });
        const rep = report(s);
        expect(unreachableRoomsOf(null)).toEqual([]);
        expect(unreachableRoomsOf({ ...rep, rules: null })).toEqual([]);
        expect(unreachableRoomsOf({ ...rep, derivedParts: { a: {} } })).toEqual([]);
    });

    it('the Seedling map provider carries the hook, and it is this function', () => {
        const s = chainSession();
        s.apply({ op: 'disconnect', room: 4, exitIndex: 1 });
        const rep = report(s);
        const provider = createSetMap(DEPS);
        expect(typeof provider.unreachableOf).toBe('function');
        expect(provider.unreachableOf(rep)).toEqual(unreachableRoomsOf(rep));
    });
});
