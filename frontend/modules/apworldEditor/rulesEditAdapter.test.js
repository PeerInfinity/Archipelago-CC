/**
 * apworldEditor/rulesEditAdapter — **THE SECOND CELL-LESS ADAPTER** (EDITOR
 * INTEGRATION slice B-c; plan §15.11 #1–#3).
 *
 * ⛓ THE FIXTURE IS BUILT from `shared/rulesJsonBuilder.js`'s helpers, not
 * copied out of a preset.
 *
 * ⛔ AND THERE IS NO `rulesEditSession.js` TO TEST. B-a needed one because
 * `createEditSession.apply` dropped the adapter's `value`; with B-b's
 * forwarding landed, a bare `createEditSession` IS the whole APWorld session —
 * `session.apply({op:'add-region'}).value` is the new region. The rows below
 * assert that on the real core rather than on a wrapper.
 */

import { describe, expect, it } from 'vitest';

import {
    assertAdapterBehaviour, canonicalJson, createEditSession, describeOps,
    floodOps, hasCellSpace, rectCopy, resolveBase, CELL_SPACE_LAWS,
} from '../procgenCore/editCore.js';
import { deepEqualKeyOrder } from '../procgenCore/deepEqualKeyOrder.js';
import { makeExit, makeRegion, makeRulesJsonScaffold } from '../shared/rulesJsonBuilder.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { deleteRegionOps } from './rulesDocOps.js';

const P = '1';

function fixture() {
    const doc = makeRulesJsonScaffold({
        gameName: 'Fixture', gameDirectory: 'fixture', worldClassName: 'FixtureWorld',
        startRegions: ['Hall'],
    });
    doc.regions[P] = {
        Hall: makeRegion('Hall', [makeExit('Hall → Vault', 'Vault')], []),
        Vault: makeRegion('Vault', [], []),
    };
    doc.items[P] = { Key: { name: 'Key', id: 1, groups: [], classification: 'progression' } };
    return doc;
}

describe('the adapter\'s shape', () => {
    it('is `{name, apply, equal}` and NOTHING else', () => {
        expect(Object.keys(rulesEditAdapter).sort()).toEqual(['apply', 'equal', 'name']);
        expect(rulesEditAdapter.name).toBe('apworld');
        expect(Object.isFrozen(rulesEditAdapter)).toBe(true);
    });

    it('⛔ declares NO CELL SPACE — a rules.json has no canvas at all', () => {
        expect(hasCellSpace(rulesEditAdapter)).toBe(false);
        for (const m of ['bounds', 'readCell', 'writeOps']) {
            expect(m in rulesEditAdapter, m).toBe(false);
        }
    });

    it('⛓ `equal` IS the hoisted predicate, not a copy of it', () => {
        expect(rulesEditAdapter.equal).toBe(deepEqualKeyOrder);
    });

    /**
     * ⛓⛓⛓ **THE `canonicalJson` MUTANT'S ROW.** Two documents differing ONLY in
     * top-level key order are NOT equal — which is exactly what
     * `cloneFullRulesDoc`'s round-trip contract needs, and exactly what the
     * core's canonical text would deny.
     */
    it('⛓⛓ key order is CONTENT — the mutant `equal` via canonicalJson reds here', () => {
        const a = fixture();
        const reordered = { regions: a.regions, ...a };
        delete reordered.schema_version;
        reordered.schema_version = a.schema_version;
        expect(rulesEditAdapter.equal(a, reordered)).toBe(false);
        expect(canonicalJson(a)).toBe(canonicalJson(reordered));    // the mutant's answer
    });
});

// ⛓ The counts are INTERPOLATED from the core's own table, never typed: a
//   widening that changed how many laws are cell-space laws must move these
//   names rather than leave them asserting a number that is no longer true
//   (the `lintGateLabels` gate).
describe(`the cell-space refusals, and the ${CELL_SPACE_LAWS.length} skipped laws`, () => {
    it('rectCopy and floodOps refuse this adapter BY NAME', () => {
        expect(() => rectCopy(rulesEditAdapter, fixture(), { x: 0, y: 0, w: 1, h: 1 }))
            .toThrow(/apworld declares no cell space — rectCopy needs bounds\/readCell\/writeOps/);
        expect(() => floodOps(rulesEditAdapter, fixture(), 0, 0, {}))
            .toThrow(/apworld declares no cell space — floodOps needs/);
    });

    it('resolveBase refuses — an APWorld session is opened on a document somebody else resolved', () => {
        expect(() => resolveBase(rulesEditAdapter, { kind: 'rules' })).toThrow(/apworld/);
    });

    /**
     * ⛓⛓⛓ **THE FOUR ASKABLE LAWS WERE ASKED, AND THE THREE SKIPPED ONES ARE
     * NAMED.** §15.11 #2: passing `say` is the only way to get a green out of
     * `assertAdapterBehaviour` for a cell-less adapter, so this `true` is not a
     * claim about seven laws of which three were never asked.
     */
    it(`⛓⛓ assertAdapterBehaviour is GREEN, and SAYS which ${CELL_SPACE_LAWS.length} laws it skipped`, () => {
        const said = [];
        expect(assertAdapterBehaviour(rulesEditAdapter, {
            record: fixture(),
            op: { op: 'add-region', name: 'Attic' },
            refused: { op: 'add-region', name: 'Hall' },
            say: (line) => said.push(line),
        })).toBe(true);
        expect(said).toHaveLength(CELL_SPACE_LAWS.length);
        for (const { n, member } of CELL_SPACE_LAWS) {
            expect(said.some((l) => l.includes(`law ${n}`) && l.includes(member))).toBe(true);
        }
    });

    it('⛔ …and it REFUSES with no `say` — a bare `true` would be a green claim', () => {
        expect(() => assertAdapterBehaviour(rulesEditAdapter, {
            record: fixture(),
            op: { op: 'add-region', name: 'Attic' },
            refused: { op: 'add-region', name: 'Hall' },
        })).toThrow(/pass `say`/);
    });
});

describe('the session — a bare createEditSession, and no session module', () => {
    const open = (doc = fixture()) => createEditSession(rulesEditAdapter, doc,
        { base: { kind: 'rules', source: 'test', player: P } });

    it('⛓⛓ an APPLIED op FORWARDS the adapter\'s `value` — trap 857, and no side slot', () => {
        const s = open();
        const res = s.apply({ op: 'add-region', name: 'Attic' });
        expect(res.applied).toBe(true);
        expect(res.value).toEqual({ name: 'Attic', exits: [], locations: [] });
        expect(s.record().regions[P].Attic).toEqual(res.value);
    });

    it('⛓ a NO-OP is reported as one and does NOT grow the op list', () => {
        const s = open();
        const res = s.apply({ op: 'set-meta', key: 'game_name', value: 'Fixture' });
        expect(res.ok).toBe(true);
        expect(res.applied).toBe(false);
        expect(s.ops()).toHaveLength(0);
    });

    it('⛓ a REFUSAL carries the substrate\'s own sentence and changes nothing', () => {
        const s = open();
        const before = JSON.stringify(s.record());
        const res = s.apply({ op: 'add-region', name: 'Hall' });
        expect(res.ok).toBe(false);
        expect(res.description).toBe('A region named "Hall" already exists.');
        expect(JSON.stringify(s.record())).toBe(before);
    });

    it('⛓⛓ UNDO is the fold over a shorter list — the document comes back BYTE FOR BYTE', () => {
        const doc = fixture();
        const s = open(doc);
        const before = JSON.stringify(doc);
        s.apply({ op: 'add-region', name: 'Attic' });
        s.apply({ op: 'rename-region', from: 'Vault', to: 'Crypt' });
        s.apply({ op: 'set-meta', key: 'game_name', value: 'Other' });
        expect(s.ops()).toHaveLength(3);
        expect(JSON.stringify(s.record())).not.toBe(before);
        while (s.undo());
        expect(s.ops()).toHaveLength(0);
        expect(JSON.stringify(s.record())).toBe(before);
    });

    it('⛓ a delete CASCADE is ONE group and therefore ONE undo', () => {
        const doc = fixture();
        const s = open(doc);
        const before = JSON.stringify(doc);
        const ops = deleteRegionOps(doc, 'Vault', P);
        expect(ops).toHaveLength(2);
        s.apply({ op: 'group', label: 'delete region Vault', ops });
        expect(describeOps(s.ops())).toBe('1 edit(s) (1 group of 2)');
        expect(s.undo()).toBe(true);
        expect(JSON.stringify(s.record())).toBe(before);
    });

    it('⛓ `payload()` is `{base, edits, certified}` with the tag verbatim', () => {
        const s = open();
        s.apply({ op: 'add-region', name: 'Attic' });
        const p = s.payload();
        expect(p.base).toEqual({ kind: 'rules', source: 'test', player: P });
        expect(p.edits).toHaveLength(1);
        expect(p.certified).toBe(null);
    });
});
