/**
 * seedlingDemo/hammerPitWest.test — ⛓⛓ SEEDLING HAMMER-PHASE PIT-WEST: the fast rows. Two switches, both OFF:
 *   - `CHOOSER_CUT`: where the chooser, C1 and CPAIR answer EMPTY, the climb asks an irreducible CUT of live chasers
 *     that holds the hit's body (`chooseCutToRemove`, inside `solveSegment`; its solves are the train file's).
 *   - `DETOUR_VIA_BOUND`: `deriveChaserDetour` refuses before planning its via set when the room has at least
 *     `DETOUR_RUNG.maxPlanned` lattice cells, the case where its search loop can never preview a candidate.
 * The state is the page's own request for L40 leg 388 (`level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_14_21`),
 * captured at `97739720dd`, its atlas records cut to levels 40 and 43 (byte-identical answers to the uncut capture, OFF
 * and ON: `CC/docs/cloud-reports/seedling-hammer-pit-west.md`). The solves are `hammerPitWest.train.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape } from './jsRuntimeSolver.js';
import {
    CHOOSER_CUT, CHOOSER_CUT_DEFAULT, DETOUR_RUNG, DETOUR_VIA_BOUND, DETOUR_VIA_BOUND_DEFAULT, deriveChaserDetour,
    solverPlanOpts, withChooserCut, withDetourViaBound,
} from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const LEG388 = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-pit-west',
    'leg388-l40-l43-request.json.gz'))).toString('utf8'));

/** The run at the request's arrival (its staging and prefix replayed, as the solve's shadow is). */
function arrivalRun(row) {
    const { source, ...tape } = restoreRequest(row.requests[0].request);
    return replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
}

describe('hammer-phase PIT-WEST — the fast rows', () => {
    it('both switches ship OFF, and the env alone turns each on', () => {
        expect(CHOOSER_CUT_DEFAULT).toBe(false);
        expect(CHOOSER_CUT.enabled).toBe(ENV.SEEDLING_CHOOSER_CUT === '1');
        withChooserCut(true, () => expect(CHOOSER_CUT.enabled).toBe(true));
        withChooserCut(false, () => expect(CHOOSER_CUT.enabled).toBe(false));
        expect(DETOUR_VIA_BOUND_DEFAULT).toBe(false);
        expect(DETOUR_VIA_BOUND.enabled).toBe(ENV.SEEDLING_DETOUR_VIA_BOUND === '1');
        withDetourViaBound(true, () => expect(DETOUR_VIA_BOUND.enabled).toBe(true));
        withDetourViaBound(false, () => expect(DETOUR_VIA_BOUND.enabled).toBe(false));
    });

    it('DETOUR_VIA_BOUND ON at the L40 arrival: 3479 cells against the bound of 500, refused before a leg is planned', () => {
        const run = arrivalRun(LEG388);
        expect(run.level).toBe(40);
        expect({ x: run.state.x, y: run.state.y }).toEqual({ x: 488, y: 904 });
        let certified = 0;
        const before = DETOUR_VIA_BOUND.counts.bounded;
        const out = withDetourViaBound(true, () => deriveChaserDetour(run, {
            aim: { x: 392, y: 456 }, planOpts: solverPlanOpts(run, new Set(), { allowPit: { tx: 24, ty: 28 } }),
            certify: () => { certified += 1; return { hit: null, truncated: null, ticks: 0 }; },
        }));
        expect(out.wps).toBeNull();
        expect([out.previews, out.planned, certified]).toEqual([0, 0, 0]);
        expect(out.bound).toEqual({ name: 'DETOUR_RUNG', hit: ['maxPlanned'], previews: 0,
            maxPreviews: DETOUR_RUNG.maxPreviews, planned: 0, maxPlanned: DETOUR_RUNG.maxPlanned,
            maxVias: DETOUR_RUNG.maxVias, unasked: 0, viaSet: 3479 });
        expect(out.why).toContain('(DETOUR_VIA_BOUND)');
        expect(DETOUR_VIA_BOUND.counts.bounded).toBe(before + 1);
    });
});
