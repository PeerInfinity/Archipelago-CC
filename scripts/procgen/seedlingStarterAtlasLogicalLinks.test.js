/**
 * ⛓ RULES starter-atlas-links — the STARTER atlas answers to the same physics model as the playthrough.
 *
 * `make-seedling-starter-atlas.mjs` used to analyse without the analyzer's two model oracles, so the start
 * room's crossing through the house's untranscribed outline shipped as a True_ hand row,
 * `overworld_start r1c6 <-> r8c0` — the same L0 wall the playthrough's `level_0__r1c6 <-> r8c0` was dropped for.
 * Both producers now take the oracles from ONE module (`seedlingDemo/seedlingModelOracles.js`).
 *
 * Each row BUILDS the atlas fresh, so a regression reds here and not only in a `--check`.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import {
    buildStarterAtlas, modelVerdicts, STARTER_ANALYSIS_DEPS,
} from './make-seedling-starter-atlas.mjs';
import { seedlingModelOracles } from '../../frontend/modules/seedlingDemo/seedlingModelOracles.js';

let atlas;
beforeAll(() => { atlas = buildStarterAtlas(); }, 60_000);

const rowsOf = (id) => atlas.regions.find((r) => r.region_id === id).subgraph?.internal_exits ?? [];

describe('the starter producer drops a model-sealed True_ link', () => {
    it('the model SEALS the house crossing both ways, and settles nothing else', () => {
        expect([...modelVerdicts].sort()).toEqual([
            'overworld_start/r1c6->r8c0 SEALED', 'overworld_start/r8c0->r1c6 SEALED',
        ]);
    });

    it('r1c6 <-> r8c0 is gone, and r1c6 keeps its real way in (the breakable rock, Sword OR Spear)', () => {
        const rows = rowsOf('overworld_start');
        expect(rows.filter((e) => [e.from, e.to].includes('r1c6') && [e.from, e.to].includes('r8c0'))).toEqual([]);
        expect(rows.find((e) => e.from === 'r1c6' && e.to === 'r2c13')?.access_rule).toBeTruthy();
    });

    it('no internal exit is left without a rule, and none is a hand row', () => {
        const loose = atlas.regions.flatMap((r) => (r.subgraph?.internal_exits ?? [])
            .filter((e) => e.access_rule === undefined || e.source !== 'analyzer')
            .map((e) => `${r.region_id} ${e.from}->${e.to}`));
        expect(loose).toEqual([]);
    });

    it('builds with the SHARED oracles (the ones the playthrough generator runs with)', () => {
        expect(STARTER_ANALYSIS_DEPS.modelOracles).toBe(seedlingModelOracles);
    });
});
