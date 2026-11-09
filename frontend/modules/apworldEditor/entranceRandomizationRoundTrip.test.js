/**
 * ENTRANCE RANDOMIZATION E2 — the APWorld Editor keeps each exit's `er` and the slot's
 * `entrance_randomization` block through load → edit → save: the load/apply clone (`cloneFullRulesDoc`),
 * the exit and region ops that rewrite the exit list (`applyRulesDocOp`), and the download bytes
 * (`rulesDownloadText`). The schema-derived Document tab lists the key as a per-player row.
 */

import { describe, expect, it } from 'vitest';

import { ER_FIXTURE_NAMES as N, erFixtureRules } from '../procgenCore/entranceRandomization.fixture.js';
import { entranceRandomizationProblems } from '../procgenCore/entranceRandomizationCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { buildDocumentKeys } from './documentKeys.js';
import { rulesDownloadText } from './downloadJson.js';
import { applyRulesDocOp, initialiseOpRefusal } from './rulesDocOps.js';
import { layoutTopDown, entranceRandomizedFacts } from '../procgenPipeline/procgenPipelineEngine.js';
import { createRng } from '../shared/rng.js';
import { cloneFullRulesDoc } from './rulesUtils.js';

const erOf = (doc) => Object.fromEntries(Object.values(doc.regions[1])
    .flatMap((r) => r.exits).filter((e) => e.er).map((e) => [e.name, e.er]));
const apply = (doc, op) => {
    const res = applyRulesDocOp(doc, op);
    expect(res.ok, res.error).toBe(true);
    return res.doc;
};

describe('APWorld Editor round trip keeps `er` and the block', () => {
    it('load → edits on the same regions → save: byte-for-byte the same `er` and block', () => {
        const original = erFixtureRules();
        const erBefore = erOf(original);
        let doc = cloneFullRulesDoc(original); // load
        // Ops that REWRITE an exit list: change a field of an er exit, add an exit beside it, edit a
        // location in the same region, rename an untouched region's neighbour.
        doc = apply(doc, { op: 'set-exit-field', region: N.up, index: 1, field: 'connected_region', value: N.up });
        doc = apply(doc, { op: 'add-exit', region: N.up, name: 'Upstairs -> Upstairs (loop)' });
        doc = apply(doc, { op: 'add-region', name: 'Attic' });
        doc = apply(doc, { op: 'rename-region', from: 'Attic', to: 'Loft' });
        doc = apply(doc, { op: 'add-location', region: N.down, name: 'Second Chest' });
        const saved = JSON.parse(rulesDownloadText(cloneFullRulesDoc(doc))); // apply + download

        expect(erOf(saved)).toEqual(erBefore);
        expect(saved.entrance_randomization).toEqual(original.entrance_randomization);
        expect(entranceRandomizationProblems(saved, '1')).toEqual([]);
    });

    it('a region rename that moves an er exit\'s region keeps its `er` (er names exits, never regions)', () => {
        const original = erFixtureRules();
        const doc = apply(cloneFullRulesDoc(original), { op: 'rename-region', from: N.down, to: 'Cellar' });
        expect(erOf(doc)).toEqual(erOf(original));
        expect(doc.entrance_randomization).toEqual(original.entrance_randomization);
        expect(entranceRandomizationProblems(doc, '1')).toEqual([]);
    });

    it('⛓ E4b: an exit RENAME cascades into `er.reverse` and `placements[].exit/target` (the ⚠ row flipped)', () => {
        const before = erFixtureRules();
        const doc = apply(cloneFullRulesDoc(before),
            { op: 'set-exit-field', region: N.down, index: 0, field: 'name', value: 'Renamed' });
        expect(doc.regions[1][N.down].exits[0].er).toBeDefined();
        expect(entranceRandomizationProblems(doc, '1')).toEqual([]);
        // the reverse that named it, and both placement rows (exit of one, target of the other), now say 'Renamed'
        expect(erOf(doc)[N.stairsDown].reverse).toBe('Renamed');
        expect(doc.entrance_randomization[1].placements).toEqual([
            { exit: N.stairsDown, target: 'Renamed' }, { exit: 'Renamed', target: N.stairsDown },
        ]);
        // MUTANT: the old behaviour (rename the exit alone) leaves the dangling reference the validator names
        const raw = cloneFullRulesDoc(before);
        raw.regions[1][N.down].exits[0].name = 'Renamed';
        expect(entranceRandomizationProblems(raw, '1').some((m) => /names "Downstairs -> Upstairs \(stairs\)", which is no exit of player 1/.test(m))).toBe(true);
    });

    it('⛓ E4b: deleting half of a coupled shuffled pair is REFUSED by name; an un-shuffled pair\'s exit deletes with its references', () => {
        const res = applyRulesDocOp(cloneFullRulesDoc(erFixtureRules()), { op: 'delete-exit', region: N.down, index: 0 });
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/deleting exit "Downstairs -> Upstairs \(stairs\)" breaks the slot's entrance randomization/);
        const resRegion = applyRulesDocOp(cloneFullRulesDoc(erFixtureRules()), { op: 'delete-region', name: N.down });
        expect(resRegion.ok).toBe(false);
        // un-shuffled (no block, both exits shuffle: false): the delete drops the reverse that named it
        const calm = erFixtureRules();
        delete calm.entrance_randomization;
        for (const e of Object.values(calm.regions[1]).flatMap((r) => r.exits)) if (e.er) e.er.shuffle = false;
        const doc = apply(cloneFullRulesDoc(calm), { op: 'delete-exit', region: N.down, index: 0 });
        expect(erOf(doc)[N.stairsDown].reverse).toBeUndefined();
        expect(entranceRandomizationProblems(doc, '1')).toEqual([]);
    });

    it('⛓ E4b: a RELAYOUT of an entrance-randomized source is refused by name, at both doors', () => {
        const doc = erFixtureRules();
        expect(entranceRandomizedFacts(doc, '1')).toEqual({ block: true, er: 3, randomized: true });
        // the engine's top-down layout (topDownSteps, the APWorld Editor's initialise)
        expect(() => layoutTopDown(doc, { playerId: '1' }, createRng(1)))
            .toThrow(/player 1's source is entrance-randomized \(an entrance_randomization block, 3 exit\(s\) carrying `er`\)/);
        // the editor's initialise op refuses first, in its own words
        expect(initialiseOpRefusal(doc, { player: '1', substrate: 'maze' })).toMatch(/player 1 is entrance-randomized/);
        // MUTANT: the same source with its ER stripped is not refused for ER
        const plain = erFixtureRules();
        delete plain.entrance_randomization;
        for (const e of Object.values(plain.regions[1]).flatMap((r) => r.exits)) delete e.er;
        expect(entranceRandomizedFacts(plain, '1').randomized).toBe(false);
        expect(String(initialiseOpRefusal(plain, { player: '1', substrate: 'maze' }) ?? '')).not.toMatch(/entrance-randomized/);
        expect(() => layoutTopDown(plain, { playerId: '1' }, createRng(1))).not.toThrow(/entrance-randomized/);
    });

    it('the Document tab lists `entrance_randomization` as a per-player row (derived from the schema)', () => {
        const entry = buildDocumentKeys(loadRulesSchema()).find((e) => e.key === 'entrance_randomization');
        expect(entry).toBeDefined();
        expect(entry.perPlayer).toBe(true);
    });
});
