/**
 * Sphere-0 crediting in the spoiler test (`sphereZeroCredit.js`).
 *
 * Sphere 0's log inventory is the starting items PLUS what the world computed from them.
 * The spoiler test used to skip sphere 0 outright ("starting items already added during
 * init"), so a computed item's sphere-0 value was never credited and every later delta
 * landed on a short base. jakanddaxter's "Reachable Orbs" is the case in the corpus: 332 at
 * sphere 0, so the orb trades gated on 1530 never opened at 3.15 (1304 instead of 1636).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findUncreditedSphereZeroItems } from './sphereZeroCredit.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const JAK = join(REPO, 'frontend/presets/jakanddaxter/AP_14089154938208861744/AP_14089154938208861744');

describe('findUncreditedSphereZeroItems', () => {
    const counts = (inv) => (name) => inv[name] ?? 0;

    it('credits what the live state lacks, and only that', () => {
        expect(findUncreditedSphereZeroItems({ 'Reachable Orbs': 332, Sword: 1 }, counts({ Sword: 1 })))
            .toEqual({ 'Reachable Orbs': 332 });
        expect(findUncreditedSphereZeroItems({ Arrows: 5 }, counts({ Arrows: 2 }))).toEqual({ Arrows: 3 });
    });

    it('credits nothing the init or a game hook already produced (Stardew "Received Progression Item")', () => {
        expect(findUncreditedSphereZeroItems({ 'Received Progression Item': 7 }, counts({ 'Received Progression Item': 7 })))
            .toEqual({});
        expect(findUncreditedSphereZeroItems({ Sword: 1 }, counts({ Sword: 2 }))).toEqual({});
    });

    it('a logged boolean flag counts as 1 (jakanddaxter "Reachable Orbs Fresh")', () => {
        expect(findUncreditedSphereZeroItems({ Fresh: true, Stale: false }, counts({}))).toEqual({ Fresh: 1 });
    });

    it('skips the names it is told to (accumulator targets in resolved mode)', () => {
        expect(findUncreditedSphereZeroItems({ 'Tradeable Orbs': 50, X: 1 }, counts({}), new Set(['Tradeable Orbs'])))
            .toEqual({ X: 1 });
    });

    it('an empty or missing log inventory credits nothing', () => {
        expect(findUncreditedSphereZeroItems({}, counts({}))).toEqual({});
        expect(findUncreditedSphereZeroItems(undefined, counts({}))).toEqual({});
    });
});

describe('the REAL worker spoiler test on the committed jakanddaxter preset', () => {
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

    it('sphere 0 credits the computed Reachable Orbs the log holds (332; the old skip left 0)', async () => {
        const { sm, test, sphereData } = await setup();
        expect(String(sphereData[0].sphereIndex)).toBe('0');

        const result = await test.run(sphereData.slice(0, 1), { playerId: 1 });

        expect(result.mismatchDetails).toEqual([]);
        expect(sm.getItemCount('Reachable Orbs')).toBe(332);
        expect(sm.getItemCount('Sentinel Beach Reachable Orbs')).toBe(138);
        // a starting item is not credited twice
        for (const [item, n] of Object.entries(sphereData[0].inventoryDetails.resolved_items)) {
            expect(sm.getItemCount(item), item).toBe(Number(n));
        }
    }, 30000);
});
