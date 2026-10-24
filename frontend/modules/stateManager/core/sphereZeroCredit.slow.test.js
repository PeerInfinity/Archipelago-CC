/**
 * The slow half of `sphereZeroCredit.test.js`: the REAL worker spoiler test on the committed
 * jakanddaxter preset, run from sphere 0 through 3.15 (~9 s). With sphere 0's computed 332
 * "Reachable Orbs" credited, the count at 3.15 is 1636 and the 15 orb trades gated on 1530
 * open where the sphere log says; with the old sphere-0 skip it was 1304 and 3.15 failed.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const JAK = join(REPO, 'frontend/presets/jakanddaxter/AP_14089154938208861744/AP_14089154938208861744');

describe('the REAL worker spoiler test on the committed jakanddaxter preset, through 3.15', () => {
    const setup = async () => {
        const { StateManager } = await import('../stateManager.js');
        const { evaluateRule } = await import('../../shared/ruleEngine.js');
        const { workerLoggerInstance } = await import('../../../app/core/universalLogger.js');
        const { WorkerSpoilerTest } = await import('./workerSpoilerTest.js');
        const { SphereState } = await import('../../sphereState/sphereState.js');
        const sm = new StateManager(evaluateRule, workerLoggerInstance);
        sm.loadFromJSON(JSON.parse(readFileSync(`${JAK}_rules.json`, 'utf8')), '1');
        const spheres = new SphereState(null);
        spheres.setCurrentPlayerId('1');
        spheres.parseSphereLog(readFileSync(`${JAK}_sphere_log.jsonl`, 'utf8'));
        return { sm, test: new WorkerSpoilerTest(sm, () => {}), sphereData: spheres.getSphereData() };
    };

    it('sphere 0 credits the computed Reachable Orbs (332), and the orb trades open at 3.15', async () => {
        const { sm, test, sphereData } = await setup();
        const upTo = sphereData.findIndex((s) => String(s.sphereIndex) === '3.15');
        expect(upTo).toBeGreaterThan(0);

        const result = await test.run(sphereData.slice(0, upTo + 1), { playerId: 1 });

        expect(result.mismatchDetails).toEqual([]);
        expect(result.passed).toBe(true);
        // 332 at sphere 0 + the later deltas (1459 before 3.15, +177 at it)
        expect(sm.getItemCount('Reachable Orbs')).toBe(1636);
        expect(sm.isLocationAccessible(sm.locations.get('SV: Bring 90 Orbs To The Mayor'))).toBe(true);
    }, 60000);
});
