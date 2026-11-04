/**
 * ENTRANCE RANDOMIZATION E2 — the runtime loader and the worker's static data KEEP `er` and the per-player
 * block, REFUSE a document-level block (and a broken `er`) by name, and reachability IGNORES both: the sphere
 * log and the reachable set of the committed seedling_playthrough AP_1 are unchanged when every one of its
 * exits carries a valid `er` and the slot carries a block.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadFromJSON, refuseRetiredTopLevelKeys } from './initialization.js';
import { getStaticGameData } from './statePersistence.js';
import { ER_FIXTURE_NAMES as N, erFixtureRules } from '../../procgenCore/entranceRandomization.fixture.js';
import { entranceRandomizationProblems } from '../../procgenCore/entranceRandomizationCheck.js';
import { generateSphereLog } from '../../shared/procgen/forwardSimulator.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const AP_1 = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));

const realLoad = async (rules) => {
    const { StateManager } = await import('../stateManager.js');
    const { evaluateRule } = await import('../../shared/ruleEngine.js');
    const { workerLoggerInstance } = await import('../../../app/core/universalLogger.js');
    const sm = new StateManager(evaluateRule, workerLoggerInstance);
    sm.loadFromJSON(structuredClone(rules), '1');
    sm.computeReachableRegions();
    return sm;
};
const stub = () => ({ invalidateCache() {}, clearCheckedLocations() {}, logger: { warn() {}, info() {} }, _logDebug() {} });

/**
 * Every exit of the playthrough carries a VALID `er`: an exit `A -> B` whose `B -> A` exists is a `two_way`
 * pair naming each other, any other is `one_way`. The block declares both groups and places nothing.
 */
function withEr(rules) {
    const doc = structuredClone(rules);
    const names = new Set(Object.values(doc.regions[1]).flatMap((r) => r.exits.map((e) => e.name)));
    for (const r of Object.values(doc.regions[1])) {
        for (const e of r.exits) {
            const [a, b] = e.name.split(' -> ');
            const back = `${b} -> ${a}`;
            e.er = names.has(back)
                ? { group: 'paired', type: 'two_way', reverse: back, shuffle: true }
                : { group: 'one_way', type: 'one_way', shuffle: false };
        }
    }
    doc.entrance_randomization = {
        1: { algorithm: 'ger', coupled: true, target_group_lookup: { paired: ['paired'] }, placements: [] },
    };
    return doc;
}

describe('the loader refuses by name', () => {
    it('a document-level `entrance_randomization` block (the retired-key mechanism)', () => {
        const doc = { schema_version: 3, entrance_randomization: erFixtureRules().entrance_randomization[1] };
        expect(() => loadFromJSON(stub(), doc, '1')).toThrow(/document-level `entrance_randomization` block/);
        expect(() => loadFromJSON(stub(), doc, '1')).toThrow(/entrance_randomization\["<player>"\]/);
        expect(() => loadFromJSON(stub(), doc, '1')).toThrow(/migrate-per-player-blocks\.mjs/);
    });

    it('lets the slot map through', () => {
        expect(() => refuseRetiredTopLevelKeys({ entrance_randomization: erFixtureRules().entrance_randomization }))
            .not.toThrow();
        expect(() => refuseRetiredTopLevelKeys({ entrance_randomization: {} })).not.toThrow();
    });

    it('a loaded slot whose `er` breaks a cross-field rule', () => {
        const doc = erFixtureRules();
        doc.regions[1][N.up].exits[0].er.reverse = 'Nowhere';
        expect(() => loadFromJSON(stub(), doc, '1')).toThrow(/entrance randomization is refused.*"Nowhere", which is no exit of player 1/);
    });
});

describe('the REAL StateManager keeps the data, per player', () => {
    it('`er` on each loaded exit, the slot\'s block, and both in the worker\'s static data', async () => {
        const rules = erFixtureRules();
        const sm = await realLoad(rules);
        const byName = new Map(sm.exits.map((e) => [e.name, e]));
        for (const r of Object.values(rules.regions[1])) {
            for (const e of r.exits) expect(byName.get(e.name).er, e.name).toEqual(e.er);
        }
        expect(sm.entranceRandomization).toEqual(rules.entrance_randomization[1]);

        // The snapshot crosses the worker boundary by structured clone.
        const posted = structuredClone(getStaticGameData(sm));
        expect(posted.entrance_randomization).toEqual(rules.entrance_randomization[1]);
        expect(posted.exits.find((e) => e.name === N.stairsDown).er).toEqual(rules.regions[1][N.up].exits[0].er);
    });

    it('a slot without a block reads null, and an exit without `er` carries none', async () => {
        const rules = erFixtureRules();
        delete rules.entrance_randomization;
        delete rules.regions[1][N.up].exits[1].er;
        const sm = await realLoad(rules);
        expect(sm.entranceRandomization).toBeNull();
        expect(getStaticGameData(sm).entrance_randomization).toBeNull();
        expect('er' in sm.exits.find((e) => e.name === N.pit)).toBe(false);
    });
});

describe('reachability IGNORES `er` (the sphere evaluator and the stateManager)', () => {
    const annotated = withEr(AP_1);

    it('the annotation is a valid one (the premise)', () => {
        expect(entranceRandomizationProblems(annotated, '1')).toEqual([]);
        expect(Object.values(annotated.regions[1]).flatMap((r) => r.exits).filter((e) => e.er.type === 'two_way').length)
            .toBeGreaterThan(0);
    });

    it('generateSphereLog is identical', () => {
        expect(generateSphereLog(annotated)).toEqual(generateSphereLog(AP_1));
    });

    it('the stateManager\'s reachable regions are identical', async () => {
        const plain = await realLoad(AP_1);
        const er = await realLoad(annotated);
        const reach = (sm) => [...sm.regions.keys()].filter((r) => sm.isRegionReachable(r)).sort();
        expect(reach(er)).toEqual(reach(plain));
        expect(reach(plain).length).toBeGreaterThan(0);
    });
});
