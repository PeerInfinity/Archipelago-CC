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
import { applyRulesDocOp } from './rulesDocOps.js';
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

    it('⚠ an exit RENAME does not cascade into `er.reverse` / `placements` — the validator names the dangling reference', () => {
        // A named E4 prerequisite (the report's sweep): no op rewrites the references yet, so the loader
        // would refuse the result. Pinned so the day a cascade lands this row flips deliberately.
        const doc = apply(cloneFullRulesDoc(erFixtureRules()),
            { op: 'set-exit-field', region: N.down, index: 0, field: 'name', value: 'Renamed' });
        expect(doc.regions[1][N.down].exits[0].er).toBeDefined();
        const problems = entranceRandomizationProblems(doc, '1');
        expect(problems.some((s) => /names "Downstairs -> Upstairs \(stairs\)", which is no exit of player 1/.test(s)))
            .toBe(true);
    });

    it('the Document tab lists `entrance_randomization` as a per-player row (derived from the schema)', () => {
        const entry = buildDocumentKeys(loadRulesSchema()).find((e) => e.key === 'entrance_randomization');
        expect(entry).toBeDefined();
        expect(entry.perPlayer).toBe(true);
    });
});
