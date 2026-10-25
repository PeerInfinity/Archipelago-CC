/**
 * ⛓⛓ SEEDLING FIDELITY BEAMLANE (wave 29) — a corridor along a BeamTower's beam band rides the band-to-band lane at the
 * towers' LIVE `y` (`solverBot.beamLaneSteer`, the dodge rung's PHASE arm, behind `CONTACT_FIDELITY.beamLaneWalk`, OFF).
 *
 * Leg 785 (`level_107 <- in_L108_0_32 -> exit:out_teleporter_0_48`): L107's only way west is the 2-tile corridor of rows
 * 7-8, along which BOTH towers' left beams run, and the bob (`0.3·sin(worldFrame(100, 2)…)` on `Game.time`) puts the
 * bands where the ARRIVAL clock says for the whole visit. OFF, the PHASE arm's stall grid (8 walk-offsets × 89 stalls)
 * solved 12/61 clocks of the 2,560-unit retry and none of the 640-unit first request. ON, one steered preview: every
 * clock 5564..5656 solves inside 640 (measured 122..128 units). The game rides the same lane at 61/61 clocks (js
 * `seedling-js-l107-investigate`, CI 40130832484); the solver's own plans are witnessed on p4g in
 * `fixtures/beamlane-witness/` (report `CC/docs/cloud-reports/seedling-fidelity-beamlane.md`).
 *
 * The fixture is the divergence sweep's own capture of 785's two requests at the slice's base (seam 5626).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { solveAnytime } from './jsRuntimeSolver.js';
import { createRunForStaging } from './tapeRunner.js';
import { axeVisitClock, phaseBeamTowerAt } from './dangerMap.js';
import { BEAM_BOB_SPAN } from './hazards.js';
import { beamLaneSteer } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { atSeamTime } from '../../../scripts/procgen/replay-seedling-solve-request.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURE = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'beamlane-witness', 'cap785.jsonl.gz')))
    .toString('utf8').trim().split('\n')[0]);
const ON = (fn) => withContactFidelity({ beamLaneWalk: true }, fn);
const OFF = (fn) => withContactFidelity({ beamLaneWalk: false }, fn);

/** Request `i` (0: the 640-unit first ask) staged at arrival clock `seam`, as the worker restores it. */
function requestAt(seam, i = 0) {
    const { passes, source, ...tape } = restoreRequest(atSeamTime(CAPTURE.requests.find((r) => r.i === i).request, seam));
    return { passes, tape: { ...tape, source, levelSource: levelSourceFromAtlas(source.records) } };
}
const solveAt = (seam, i = 0) => {
    const { passes, tape } = requestAt(seam, i);
    return solveAnytime(tape, { passes });
};

describe('fidelity BEAMLANE — L107 leg 785, the band-to-band lane at the towers\' live y', () => {
    // ⛓ planning-13's flip: shipped OFF, now ON by default.
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_BEAM_LANE_WALK)('ships ON', () => {
        expect(CONTACT_FIDELITY.beamLaneWalk).toBe(true);
    });

    it('OFF: the 640-unit request runs out at the PHASE arm\'s stall grid (the gap, measured)', () => {
        const a = OFF(() => solveAt(5594));
        expect(a.ok).toBe(false);
        expect(a.passes[0]).toMatchObject({ pass: 'dashless', ok: false, deadline: 'phase-dodge', limit: 'budget' });
    });

    // The OFF arm's band (5600..5611 solve at 2,560), the refusing clocks either side, and both ends of the census.
    it.each([5564, 5594, 5605, 5622, 5643, 5656])('ON: seam %i solves inside the first request\'s 640 units, '
        + 'and the plan reaches L102 with zero hits on the model', (seam) => {
        const a = ON(() => solveAt(seam));
        expect(a.ok).toBe(true);
        expect(a.work).toBeLessThanOrEqual(640);
        expect(a.plan.verbs).toContain('dodge');
        const { tape } = requestAt(seam);
        const run = createRunForStaging(tape.staging, tape.levelSource);
        let to = null;
        for (const k of a.plan.solution) {
            const r = run.advance(new Set(k));
            if (r.transition) { to = r.transition.to_level; break; }
        }
        expect(to).toBe(102);
        expect(run.playerHits).toEqual([]);
    });

    /**
     * The AIM rule the census needed (5643..5652 refused without it): at a clock whose bands sit LOW, the corridor's
     * row (y 120) is above band 1 at the visit's start and the bob then lifts the band through it. A waypoint within
     * a band's REACH (zone ± `BEAM_BOB_SPAN`) is aimed into the bounded lane, not held at its own y.
     */
    it('a waypoint inside a band\'s bob reach is aimed into the bounded lane (seam 5643, tick 229)', () => {
        const { tape } = requestAt(5643);
        const run = createRunForStaging(tape.staging, tape.levelSource);
        const towers = (run.world.combat?.hazards ?? []).filter((h) => h.tag === 'beamtower');
        expect(towers.map((h) => `${h.tag}@${h.x},${h.y}`)).toEqual(['beamtower@208,120', 'beamtower@208,136']);
        const clock = axeVisitClock(run);
        const steer = beamLaneSteer(run, towers, clock, 1);
        // The update the keys of tick 229 move the box into: both LEFT bands (side 2) at their live y.
        const band1 = phaseBeamTowerAt(run, towers[0], clock, 230).band(2);
        const band2 = phaseBeamTowerAt(run, towers[1], clock, 230).band(2);
        const zone1 = { lo: band1.y - 3, hi: band1.y + band1.h + 2 };
        // The row's own y is ABOVE band 1's zone here (free) but inside its bob reach — the measured failure.
        expect(120).toBeLessThan(zone1.lo);
        expect(120).toBeGreaterThan(zone1.lo - BEAM_BOB_SPAN);
        // In the lane: without the reach rule the waypoint's own (free) interval is the target, and the walk would
        // climb back through band 1 to the row's y.
        const st = { ...run.state, x: 90, y: 134, vx: 0, vy: 0 };
        const aim = steer(st, { x: 56, y: 120 }, 229, true);
        expect(aim.x).toBe(56);
        expect(aim.y).toBeCloseTo((zone1.hi + band2.y - 3) / 2, 9);
    });
});
