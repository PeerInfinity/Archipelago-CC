/**
 * ⛓⛓ CRUSHER FORK (slice `seedling-js-forkrun`) — THE L42 ROW, end to end through the production path.
 *
 * Fidelity's CRUSHER solves L42 by bait chains, and `execBait` certifies each chain's aligned start on a FORK
 * (`forkRun`) before committing a tick of it. `jsRuntimeSolver.solveFromTape` — the one site every production
 * solve request reaches (the JS page and the wasm engine, in the worker or in place) — now passes it
 * (`forkRunFor`). From the survey's L42 arrival (`crusher-l42-round-trip`'s staging), the dashless pass:
 *   with the fork    → a plan whose verbs include `bait` (measured 1566 t, 73 fine work units);
 *   without it       → refused (measured: "collect (184,152) stance … no corridor" — chain 2 never parks).
 * ⛔ SLOW (~13 s on the box): this tier, never the default one.
 */
import { describe, expect, it } from 'vitest';

import { CRUSHER_WITNESSES, crusherStaging } from '../../../scripts/procgen/plan-seedling-crusher-witness.mjs';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { liveOf, settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { CRUSHER_BAIT } from './crusherBait.js';

describe('L42 through the production solve path: the bait chains need the fork', () => {
    it('solveFromTape (dashless) plans L42\'s part through `bait`', async () => {
        expect(CRUSHER_BAIT.enabled).toBe(true);
        const w = CRUSHER_WITNESSES.find((x) => x.name === 'crusher-l42-round-trip');
        const staging = await crusherStaging(w);
        const levelSource = atlasLevelSource();
        const live = liveOf(createRunForStaging(staging, levelSource));
        const answer = settleSolve(() => solveFromTape({ staging, perTick: [], live, levelSource,
            solverGoal: JSON.parse(JSON.stringify(w.goals[0])), dashMode: 'none', name: 'l42-forkrun' }));
        expect(answer.ok, answer.message).toBe(true);
        expect(answer.plan.verbs).toContain('bait');
        expect(answer.plan.solution.length).toBeGreaterThan(0);
    });
});
