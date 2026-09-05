/**
 * ⛓⛓⛓ APWORLD EDITOR HUB slice H5 — **THE `loop_costs` LINK IS A REAL
 * WORKING-COPY INTAKE, NOT "APPLY, THEN OPEN".**
 *
 * Plan §4 priced this link as its named fallback because the cost debugger
 * reads APPLIED state. These rows are the measurement that overturned it: the
 * planner's whole dependency on a state manager is two methods, and a rules.json
 * can wear them without the worker, without Apply, and without a second parse.
 *
 * ⛔ Every row drives a REAL COMMITTED PRESET. The claim is about what the
 * corpus contains — that ten of the twelve `loop_costs` carriers embed a sphere
 * log and two do not — and a fixture could not make that claim.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    documentStateManager, documentPlayerId, documentSphereLog,
} from './documentStateManager.js';
import { CostPlanner } from './costPlanner.js';

const preset = (rel) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`../../presets/${rel}`, import.meta.url)), 'utf8'));

/** Carries `loop_costs` AND an embedded `sphere_log` — the planning case. */
const WITH_LOG = 'jta_schedule_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/** Carries `loop_costs` and NO embedded log — one of exactly two in the corpus. */
const NO_LOG = 'jta_substrate_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/** Names its own slot in `playerId` and keys `regions` under it alone. */
const P2 = 'multiworld/AP_01043188731678011336/AP_01043188731678011336_P2_rules.json';

describe('documentStateManager — a rules.json wearing the state manager\'s face', () => {
    it('⛓⛓ hands back exactly the two methods CostPlanner touches, over the '
        + "DOCUMENT's regions and locations", async () => {
        const doc = preset(NO_LOG);
        const sm = await documentStateManager(doc, '1');
        expect(typeof sm.getStaticData).toBe('function');
        expect(typeof sm.getLatestStateSnapshot).toBe('function');
        const sd = sm.getStaticData();
        // The counts come off the document, not out of this row.
        expect(sd.regions.size).toBe(Object.keys(doc.regions['1']).length);
        // ⛔ Locations are NESTED IN REGIONS in a rules.json; there is no
        //   top-level `locations` key. The expectation is derived from the
        //   document's own nesting rather than typed.
        expect(sd.locations.size).toBe(Object.values(doc.regions['1'])
            .reduce((n, r) => n + Object.keys(r.locations ?? {}).length, 0));
        expect(sm.stats.regions).toBe(sd.regions.size);
    });

    it('⛓ the static data is ONE object across calls — the planner compares '
        + 'across them', async () => {
        const sm = await documentStateManager(preset(NO_LOG), '1');
        expect(sm.getStaticData()).toBe(sm.getStaticData());
    });

    it('⛓⛓ and a CostPlanner built on it derives its topology from the '
        + 'document — the whole point of the seam', async () => {
        const doc = preset(NO_LOG);
        const sm = await documentStateManager(doc, '1');
        const planner = new CostPlanner({ stateManager: sm, eventBus: null });
        planner.loadSphereLog([]);
        expect(planner.isLoaded()).toBe(true);
        // A region name only this document has.
        expect([...sm.getStaticData().regions.keys()])
            .toEqual(Object.keys(doc.regions['1']));
    });

    it('⛔ refuses a non-document by name rather than throwing somewhere deep', async () => {
        await expect(documentStateManager(null, '1')).rejects.toThrow(/needs a rules.json/);
        await expect(documentStateManager('{}', '1')).rejects.toThrow(/got string/);
    });
});

describe('CostPlanner.useStateManager — planning a different world', () => {
    it('⛓⛓⛓ DROPS the loaded plan: every planned step names the old world\'s '
        + 'regions', async () => {
        const sm = await documentStateManager(preset(NO_LOG), '1');
        const planner = new CostPlanner({ stateManager: sm, eventBus: null });
        planner.loadSphereLog([]);
        expect(planner.isLoaded()).toBe(true);
        planner.useStateManager(sm, { playerId: '1' });
        expect(planner.isLoaded()).toBe(false);
        expect(planner.getPlannedSteps()).toEqual([]);
    });

    it('⛓⛓ the playerId OVERRIDE wins over sphereState — a working copy names '
        + 'its own slot and the app may hold another world', async () => {
        const sm = await documentStateManager(preset(NO_LOG), '1');
        const planner = new CostPlanner({ stateManager: sm, eventBus: null });
        planner.useStateManager(sm, { playerId: '7' });
        expect(planner._getCurrentPlayerId()).toBe('7');
        // Cleared, and the answer falls back to what it always was.
        planner.useStateManager(sm, { playerId: null });
        expect(planner._getCurrentPlayerId()).toBe(String(sm.getStaticData().playerId));
    });
});

describe('documentPlayerId — the DOCUMENT\'s slot, never the app\'s', () => {
    it('⛓⛓ honours a `playerId` the document actually carries — the committed '
        + 'P2 export proves the fallback alone is wrong', () => {
        const doc = preset(P2);
        expect(doc.playerId).toBe('2');
        expect(Object.keys(doc.regions)).toEqual(['2']);
        expect(documentPlayerId(doc)).toBe('2');
    });

    it('⛔ but not a slot the document does not hold', () => {
        expect(documentPlayerId({ playerId: '9', regions: { 1: {}, 3: {} } })).toBe('1');
    });

    it('⛓ falls back to the first slot, then to the caller\'s default', () => {
        expect(documentPlayerId({ regions: { 3: {}, 4: {} } })).toBe('3');
        expect(documentPlayerId({})).toBe('1');
        expect(documentPlayerId({}, '5')).toBe('5');
    });
});

describe('documentSphereLog — its own log or none, never the app\'s', () => {
    it('⛓ returns the embedded entries when the document carries them', () => {
        const doc = preset(WITH_LOG);
        expect(documentSphereLog(doc).entries).toBe(doc.sphere_log);
        expect(doc.sphere_log.length).toBeGreaterThan(0);
    });

    it('⛓⛓⛓ REFUSES BY NAME when it does not — borrowing the app\'s log would '
        + "manufacture the panel's own \"wrong seed\" condition", () => {
        const answer = documentSphereLog(preset(NO_LOG));
        expect(answer.entries).toBeUndefined();
        expect(answer.refusal).toContain('embeds no `sphere_log`');
        expect(answer.refusal).toContain('Use applied state');
    });

    it('⛓ an empty array is "no log", not a log with nothing in it', () => {
        expect(documentSphereLog({ sphere_log: [] }).refusal).toBeTruthy();
    });
});
