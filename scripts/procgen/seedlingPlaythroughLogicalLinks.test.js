/**
 * ⛓ RULES logical-links — the playthrough's sub-region links answer to the PHYSICS MODEL.
 *
 * Two defects of the transcription, measured by the JS arc (walk-plan §5.17) and fixed in the analyzer's two
 * optional oracles (`manualCrossingVerdict`, `modelReach`), which `make-seedling-playthrough-rules.mjs` fills
 * from `levelWorld.collidesSolid`:
 *   - a crossing through a building's untranscribed outline was emitted as a True_ hand row. All 10 such links
 *     (L0, L12, L66, L93 x2, both ways) are ones the model cannot walk — the Sword's `level_0__r8c0 <-> r1c6`
 *     among them;
 *   - an exit nothing reaches was bucketed into the FIRST sub-region — L0's L2 stairs into r1c6.
 *
 * Each row BUILDS the atlas fresh, so a regression in the analyzer or the generator reds here and not only in a
 * `--check` that someone has to remember to run.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import {
    buildPlaythroughAtlas, modelVerdicts, refuseUnboundMembers, modelFloodTiles, playthroughGridFor,
    playthroughAnalyzerOptions,
} from './make-seedling-playthrough-rules.mjs';
import { analyzeRegion } from '../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MAP = JSON.parse(readFileSync(fileURLToPath(
    new URL('../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8'));

let atlas;
beforeAll(() => { atlas = buildPlaythroughAtlas(); }, 120_000);

const regionOf = (id) => atlas.regions.find((r) => r.region_id === id);

describe('a link the physics model cannot walk is NOT emitted as True_', () => {
    it('the model SEALS every building-only crossing: 10 links, all of them the old True_ hand rows', () => {
        expect([...modelVerdicts].sort()).toEqual([
            'level_0/r1c6->r8c0 SEALED', 'level_0/r8c0->r1c6 SEALED',
            'level_12/r0c37->r44c19 SEALED', 'level_12/r44c19->r0c37 SEALED',
            'level_66/r1c2->r5c4 SEALED', 'level_66/r5c4->r1c2 SEALED',
            'level_93/r10c7->r1c0 SEALED', 'level_93/r10c7->r1c13 SEALED',
            'level_93/r1c0->r10c7 SEALED', 'level_93/r1c13->r10c7 SEALED',
        ]);
    });

    it('the Sword\'s old link is gone, and nothing replaces it as a free row', () => {
        const rows = regionOf('level_0').subgraph.internal_exits;
        expect(rows.filter((e) => [e.from, e.to].includes('r1c6') && [e.from, e.to].includes('r8c0'))).toEqual([]);
        // r1c6 is still a place: the Sword's breakable rock at (12,2) is its real way in.
        expect(rows.find((e) => e.from === 'r1c6' && e.to === 'r2c13')).toBeTruthy();
    });

    it('no internal exit is left WITHOUT a rule — every True_ the census found was model-blocked', () => {
        const ruleless = atlas.regions.flatMap((r) => (r.subgraph?.internal_exits ?? [])
            .filter((e) => e.access_rule === undefined).map((e) => `${r.region_id} ${e.from}->${e.to}`));
        expect(ruleless).toEqual([]);
    });

    it('the pockets only a sealed row reached are pruned (L66 r1c2, L93 r1c0 / r1c13)', () => {
        expect(regionOf('level_66').subgraph.sub_regions).toEqual(['r5c4', 'r9c8']);
        expect(regionOf('level_93').subgraph.sub_regions).toEqual(['r10c7', 'r14c7']);
    });

    // ⚠ NOT a probe that shares the subject's assumption: §5.17 called L93's four links "model-walkable" off a
    // flood that walked over its PITS. The model's own collision does not know a pit is a fall; the analyzer's
    // grid does, and the pit cells are excluded here.
    it('L93: the model reaches the corner pockets ONLY across the pit cells', () => {
        const level = MAP.levels.find((l) => l.level === 93);
        const grid = playthroughGridFor(level);
        const a = analyzeRegion({ region_id: 'level_93', exits: [], locations: [] }, grid, playthroughAnalyzerOptions);
        const tiles = (id) => a.components.find((c) => c.id === id).tiles;
        const target = new Set(tiles('r1c0').map((t) => t.join(',')));
        const hits = (enterable) => modelFloodTiles(level, tiles('r10c7'), enterable).some((t) => target.has(t.join(',')));
        expect(hits(() => true)).toBe(true);
        expect(hits((x, y) => grid.cells[y * grid.width + x].kind !== 'sink')).toBe(false);
    });
});

describe('an exit no component reaches binds to the component the model reaches — or is refused by name', () => {
    it('L0\'s L2 stairs, its L110 pit arrival and its L2 arrival stand in r8c0, beside the start', () => {
        const at = (id) => regionOf('level_0').exits.find((e) => e.exit_id === id).sub_region;
        expect(at('out_stairsdown_256_272')).toBe('r8c0');
        expect(at('in_pit_L110_16_17')).toBe('r8c0');
        expect(at('in_L2_48_16')).toBe('r8c0');
    });

    it('refuses an unbound member of a SPLIT region by name, and passes an unsplit one', () => {
        const unbound = [{ kind: 'exit', id: 'out_x', tile: [1, 2] }];
        expect(() => refuseUnboundMembers({ region_id: 'level_9', subgraph: { sub_regions: ['a', 'b'] } }, unbound))
            .toThrow(/level_9 is split into sub-regions, and exit "out_x" at \[1,2\] binds to NO walkable component/);
        expect(() => refuseUnboundMembers({ region_id: 'level_52' }, unbound)).not.toThrow();
        expect(() => refuseUnboundMembers({ region_id: 'level_9', subgraph: {} }, [])).not.toThrow();
    });
});
