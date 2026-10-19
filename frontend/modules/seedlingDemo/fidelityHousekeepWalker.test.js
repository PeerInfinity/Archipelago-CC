/**
 * seedling-fidelity-housekeep D3 — THE WALKER'S PLANNER SEES A BEAM TOWER'S DRIFT (`CONTACT_FIDELITY.walkerBeamTowers`,
 * OFF by default).
 *
 *     BeamTower.as:100-103  y += 0.3 * Math.sin(Game.worldFrame(100, 2) / 100 * 2 * Math.PI);  — the Solid rides on `y`
 *
 * L105, booted at (208,64), idle: by tick 7 `beamtower@48,40`'s Solid has risen 1.2 px above its placement (y 32), and
 * the planner's node test at (48,28) — the walker's `planWaypoints` over `livePerVisitOpts` — reads the drifted box
 * ON and the placement OFF. OFF the family is absent from the walker's bag AND dropped by `plannerObstacleAt`'s
 * named-key path (`R8_NORMALIZE_LIVE_BATCH.plannerDropsSixFamilies`), so a bag that carries it changes nothing.
 */
import { describe, expect, it } from 'vitest';
import { loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { livePerVisitOpts, plannerObstacleAt } from './botDriverV2.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';

const SRC = levelSourceFromAtlas(patchedMapDocument(loadAtlas()));
const TOWER = 'beamtower@48,40';

function l105At(ticks) {
    const run = createRunForStaging(arrivalStaging({ level: 105, x: 208, y: 64 }, { items: ['hasSword'] }), SRC);
    for (let t = 0; t < ticks; t += 1) run.advance(new Set());
    return run;
}
const blocked = (run, x, y, on) => withContactFidelity({ walkerBeamTowers: on },
    () => plannerObstacleAt(run.world, x, y, null, livePerVisitOpts(run)));

describe('housekeep D3: walkerBeamTowers', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.walkerBeamTowers).toBe(false);
    });

    it('OFF: the walker\'s bag carries no beam towers; ON: the run\'s drifted Solids', () => {
        const run = l105At(7);
        expect(withContactFidelity({ walkerBeamTowers: false }, () => livePerVisitOpts(run).beamTowers)).toBe(null);
        const on = withContactFidelity({ walkerBeamTowers: true }, () => livePerVisitOpts(run).beamTowers);
        expect([...on.keys()]).toEqual([TOWER]);
        expect(on.get(TOWER).rect.y).toBeCloseTo(30.83, 2);
        expect(run.liveGeometryOpts().beamTowers.get(TOWER).rect).toEqual(on.get(TOWER).rect);
    });

    it('the planner\'s node test reads the drift ON and the placement OFF', () => {
        const run = l105At(7);
        expect(blocked(run, 48, 28, false)).toBe(null);
        const hit = blocked(run, 48, 28, true);
        expect(hit).not.toBe(null);
        expect(JSON.stringify(hit)).toMatch(/beamtower/);
        // at boot the tower stands at its placement: both arms agree
        const boot = l105At(0);
        expect(blocked(boot, 48, 28, true)).toEqual(blocked(boot, 48, 28, false));
    });

    it('OFF, a bag that carries the family still changes nothing (the named-key path drops it)', () => {
        const run = l105At(7);
        const bag = { ...livePerVisitOpts(run), beamTowers: run.liveGeometryOpts().beamTowers };
        expect(withContactFidelity({ walkerBeamTowers: false },
            () => plannerObstacleAt(run.world, 48, 28, null, bag))).toBe(null);
    });
});
