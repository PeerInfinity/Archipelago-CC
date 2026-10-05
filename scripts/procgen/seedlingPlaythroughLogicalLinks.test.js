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
import { buildGroupOpeners } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
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

    // ⛓ RULES re-closing locks: a ruleless row is now LEGITIMATE in exactly one shape — the free side of a
    // grouped lock only a plain Button opens (its own crossing, one-way). Every other True_ the census found
    // was model-blocked, so a ruleless row in a level with no such lock is still a defect.
    it('no internal exit is left WITHOUT a rule, except through a re-closing lock — every other True_ was model-blocked', () => {
        const groups = buildGroupOpeners(MAP);
        const reclosingLevels = new Set(MAP.levels.filter((l) => l.entities.some((e) => ['lock', 'wandlock', 'grasslock'].includes(e.type)
            && Number(e.attrs?.tset) >= 0 && !groups.get(`${l.level}:${e.attrs.tset}`)?.latching
            && groups.get(`${l.level}:${e.attrs.tset}`)?.holders.length)).map((l) => `level_${l.level}`));
        const ruleless = atlas.regions.flatMap((r) => (r.subgraph?.internal_exits ?? [])
            .filter((e) => e.access_rule === undefined).map((e) => ({ region: r.region_id, row: `${e.from}->${e.to}`, oneWay: !e.bidirectional })));
        expect(ruleless.filter((x) => !reclosingLevels.has(x.region))).toEqual([]);
        expect(ruleless.every((x) => x.oneWay)).toBe(true);
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
    // ⛓ RULES patched-set: L110's pit no longer ARRIVES in L0 — its descent fires these stairs, so the fall ends in
    // L2 (`seedlingPatchedSet.test.js`); the L0 landing was never a place to stand.
    it('L0\'s L2 stairs and its L2 arrival stand in r8c0, beside the start; no L110 pit arrives in L0', () => {
        const at = (id) => regionOf('level_0').exits.find((e) => e.exit_id === id).sub_region;
        expect(at('out_stairsdown_256_272')).toBe('r8c0');
        expect(at('in_L2_48_16')).toBe('r8c0');
        expect(regionOf('level_0').exits.filter((e) => e.exit_id.startsWith('in_pit_L110'))).toEqual([]);
    });

    it('refuses an unbound member of a SPLIT region by name, and passes an unsplit one', () => {
        const unbound = [{ kind: 'exit', id: 'out_x', tile: [1, 2] }];
        expect(() => refuseUnboundMembers({ region_id: 'level_9', subgraph: { sub_regions: ['a', 'b'] } }, unbound))
            .toThrow(/level_9 is split into sub-regions, and exit "out_x" at \[1,2\] binds to NO walkable component/);
        expect(() => refuseUnboundMembers({ region_id: 'level_52' }, unbound)).not.toThrow();
        expect(() => refuseUnboundMembers({ region_id: 'level_9', subgraph: {} }, [])).not.toThrow();
    });
});

// ⛓ The playthrough's FIRST AP goal must keep a route at sphere 0 (the planner's gate). The REAL StateManager
// (as the worker builds it) and the REAL PathFinder, over the committed rules.json; the bidirectional setting is
// the proxy's own derivation (exporter["1"] declares false). Before this slice the route was 10 hops through the
// sealed logical link `level_0__r8c0 -> level_0__r1c6`; now the stairs leave r8c0 itself.
describe('the Sword keeps its sphere-0 route (PathFinder over the real StateManager)', () => {
    it('level_0__r8c0 -> level_10 in 9 hops, the stairs taken straight from r8c0', async () => {
        const { StateManager } = await import('../../frontend/modules/stateManager/stateManager.js');
        const { StateManagerProxy } = await import('../../frontend/modules/stateManager/stateManagerProxy.js');
        const { evaluateRule } = await import('../../frontend/modules/shared/ruleEngine.js');
        const { workerLoggerInstance } = await import('../../frontend/app/core/universalLogger.js');
        const { PathFinder } = await import('../../frontend/modules/shared/pathfinder.js');
        const rules = JSON.parse(readFileSync(fileURLToPath(new URL(
            '../../frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
        const sm = new StateManager(evaluateRule, workerLoggerInstance);
        sm.loadFromJSON(structuredClone(rules), '1');
        const sd = sm.getStaticGameData();
        const snap = sm.getSnapshot();
        expect(Object.values(snap.inventory).every((n) => n === 0)).toBe(true);
        const bidir = StateManagerProxy.prototype.getEffectiveBidirectionalSetting.call({ staticDataCache: sd });
        expect(bidir).toMatchObject({ assumeBidirectional: false, source: 'explicit' });
        expect(sd.locations.get('Level 010 - Sword').parent_region_name).toBe('level_10');
        const pf = new PathFinder({
            getStaticData: () => sd, getLatestStateSnapshot: () => snap, getEffectiveBidirectionalSetting: () => bidir,
        });
        expect(pf.findPath('level_0__r8c0', 'level_10')).toEqual({
            steps: ['level_0__r8c0', 'level_2', 'level_3__r0c4', 'level_4', 'level_5__r1c5', 'level_6', 'level_7',
                'level_8', 'level_9', 'level_10'],
            nextExit: 'level_0__r8c0 -> level_2',
            length: 9,
        });
        // r1c6 is not a sphere-0 place any more: only the Sword's rock leads there.
        expect(pf.findPath('level_0__r8c0', 'level_0__r1c6')).toBeNull();
    }, 60_000);
});
