import { describe, expect, it } from 'vitest';
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';
import {
    SECTIONS, buildView, confirmText, declarationError, familyKeys, headerText, holdText, idbDeclarations, libraryConfirmText, libraryRows, normalizeDeclarations, ownerOf, pct, refusalText, sectionKeys,
} from './storageModel.js';

const Q = 5242880;
const { declarations } = normalizeDeclarations([
    { moduleId: 'json', owner: 'JSON', storage: [
        { prefix: 'mode_', kind: STORAGE_KINDS.state, label: 'Saved mode', clearAll: 'Clear all saved modes', clearsWith: ['lastMode'] },
        { key: 'lastMode', kind: STORAGE_KINDS.state, label: 'Last mode' },
    ] },
    { moduleId: 'game', owner: 'Game', storage: [
        { key: 'save', kind: STORAGE_KINDS.user, label: 'Game save' },
        { prefix: 'mode_special', kind: STORAGE_KINDS.user, label: 'A longer prefix wins' },
        { pattern: '/shrum$', kind: STORAGE_KINDS.user, label: 'Ruffle save' },
    ] },
    { moduleId: 'bal', owner: 'Balance', storage: [{ prefix: 'bal_', kind: STORAGE_KINDS.cache, label: 'Patches' }] },
]);
const entries = [
    { key: 'orphan_small', chars: 10 }, { key: 'orphan_big', chars: 900 },
    { key: 'mode_default', chars: 300 }, { key: 'mode_loops', chars: 50 }, { key: 'lastMode', chars: 12 },
    { key: 'save', chars: 500 }, { key: 'host/a.swf/shrum', chars: 40 }, { key: 'mode_specialX', chars: 5 },
    { key: 'bal_1', chars: 7 },
];

describe('declarationError', () => {
    it('accepts each matcher kind', () => {
        expect(declarationError({ key: 'a', kind: 'user', label: 'x' })).toBe(null);
        expect(declarationError({ prefix: 'a', kind: 'cache', label: 'x', clearAll: 'Clear' })).toBe(null);
        expect(declarationError({ pattern: 'a$', kind: 'state', label: 'x', clearsWith: ['k'] })).toBe(null);
    });
    it('rejects the malformed ones with a reason', () => {
        expect(declarationError({ kind: 'user', label: 'x' })).toMatch(/exactly one/);
        expect(declarationError({ key: 'a', prefix: 'b', kind: 'user', label: 'x' })).toMatch(/exactly one/);
        expect(declarationError({ key: 'a', kind: 'mine', label: 'x' })).toMatch(/kind/);
        expect(declarationError({ key: 'a', kind: 'user', label: ' ' })).toMatch(/label/);
        expect(declarationError({ pattern: '(', kind: 'user', label: 'x' })).toMatch(/compile/);
        expect(declarationError({ key: 'a', kind: 'user', label: 'x', clearAll: 'y' })).toMatch(/family/);
        expect(declarationError({ key: 'a', kind: 'user', label: 'x', size: 3 })).toMatch(/unknown field/);
    });
    it('a malformed entry is reported and skipped, not fatal', () => {
        const r = normalizeDeclarations([{ moduleId: 'm', storage: [{ key: 'ok', kind: 'user', label: 'x' }, { key: 1 }] }]);
        expect(r.declarations).toHaveLength(1);
        expect(r.errors).toEqual([expect.stringContaining('m.storage[1]')]);
    });
});

describe('the idb matcher (an IndexedDB database name)', () => {
    it('is accepted alone, with a kind and a label', () => {
        expect(declarationError({ idb: 'some-db', kind: 'user', label: 'x' })).toBe(null);
    });
    it('two matchers are refused, idb with any other', () => {
        for (const other of [{ key: 'a' }, { prefix: 'a' }, { pattern: 'a$' }]) {
            expect(declarationError({ idb: 'some-db', ...other, kind: 'user', label: 'x' })).toMatch(/exactly one of key \/ prefix \/ pattern \/ idb \(has 2\)/);
        }
    });
    it('an unknown matcher is refused (it is an unknown field, and leaves no matcher)', () => {
        expect(declarationError({ database: 'some-db', kind: 'user', label: 'x' })).toMatch(/exactly one .* \(has 0\)/);
        expect(declarationError({ idb: 'some-db', database: 'x', kind: 'user', label: 'x' })).toMatch(/unknown field\(s\) database/);
    });
    it('an empty name, a clearAll and a clearsWith are refused', () => {
        expect(declarationError({ idb: '', kind: 'user', label: 'x' })).toMatch(/idb must be a non-empty string/);
        expect(declarationError({ idb: 'd', kind: 'user', label: 'x', clearAll: 'Clear' })).toMatch(/takes no clearAll/);
        expect(declarationError({ idb: 'd', kind: 'user', label: 'x', clearsWith: ['k'] })).toMatch(/takes no clearAll/);
    });
    it('normalizes, owns NO localStorage key (even one spelled like its name), and is listed by idbDeclarations', () => {
        const r = normalizeDeclarations([{ moduleId: 'lab', owner: 'Lab', storage: [
            { idb: 'lib-db', kind: STORAGE_KINDS.user, label: 'Library' },
            { key: 'k', kind: STORAGE_KINDS.state, label: 'K' },
        ] }]);
        expect(r.errors).toEqual([]);
        expect(idbDeclarations(r.declarations).map((d) => [d.moduleId, d.value, d.kind])).toEqual([['lab', 'lib-db', 'user']]);
        expect(ownerOf('lib-db', r.declarations)).toBe(null);
        expect(ownerOf('k', r.declarations).label).toBe('K');
        expect(buildView([{ key: 'lib-db', chars: 6 }], r.declarations, Q).sections[0].count).toBe(1);
    });
});

describe('ownerOf', () => {
    it('exact key, then the longest prefix, then a pattern', () => {
        expect(ownerOf('lastMode', declarations).label).toBe('Last mode');
        expect(ownerOf('mode_specialX', declarations).label).toBe('A longer prefix wins');
        expect(ownerOf('mode_x', declarations).label).toBe('Saved mode');
        expect(ownerOf('h/x.swf/shrum', declarations).label).toBe('Ruffle save');
        expect(ownerOf('nobody', declarations)).toBe(null);
    });
});

describe('buildView', () => {
    const view = buildView(entries, declarations, Q);

    it('draws the sections in order: Unknown FIRST, then user, state, cache', () => {
        expect(view.sections.map((s) => s.id)).toEqual(['unknown', 'user', 'state', 'cache']);
        expect(SECTIONS[0].sectionClear).toBe('Clear all unknown keys');
        expect(view.sections.find((s) => s.id === 'user').sectionClear).toBe(null);
    });

    it('puts undeclared keys under Unknown, largest first', () => {
        expect(view.sections[0].groups[0].rows.map((r) => r.key)).toEqual(['orphan_big', 'orphan_small']);
    });

    it('groups rows by owner and totals the header', () => {
        const state = view.sections.find((s) => s.id === 'state');
        expect(state.groups.map((g) => g.owner)).toEqual(['JSON']);
        expect(state.groups[0].rows.map((r) => r.key)).toEqual(['mode_default', 'mode_loops', 'lastMode']);
        expect(view.totalChars).toBe(1824);
        expect(headerText(view)).toBe('9 keys · 1,824 of 5,242,880 chars (<0.1 %)');
    });

    it('a family with clearAll is offered on its group; its button removes the family plus clearsWith', () => {
        const json = view.sections.find((s) => s.id === 'state').groups[0];
        expect(json.families.map((f) => f.clearAll)).toEqual(['Clear all saved modes']);
        expect(familyKeys(json.families[0], entries, declarations)).toEqual(['mode_default', 'mode_loops', 'lastMode']);
    });

    it("a section's clear covers every row of it", () => {
        expect(sectionKeys(view.sections.find((s) => s.id === 'cache'))).toEqual(['bal_1']);
    });
});

describe('texts', () => {
    it('pct', () => {
        expect(pct(Q / 2, Q)).toBe('50.0 %');
        expect(pct(1, Q)).toBe('<0.1 %');
        expect(pct(0, Q)).toBe('0.0 %');
    });
    it('confirmText names the count and size, and the reload caveat only for the current mode blob', () => {
        const size = (k) => ({ a: 1000, b: 234 })[k];
        expect(confirmText('Clear all state', ['a', 'b'], size, 'mode_default'))
            .toBe('Clear all state: remove 2 keys (1,234 chars) from this site\'s browser storage? This cannot be undone.');
        expect(confirmText('Clear', ['mode_default'], () => 5, 'mode_default')).toMatch(/takes effect on reload/);
    });
});

describe('the document library row (pure half)', () => {
    const lineages = [
        { lineage_id: 'L1', label: 'Demo', versions: 2, drafts: 1, bytes: 1234, liveHolds: [] },
        { lineage_id: 'L2', label: null, versions: 1, drafts: 0, bytes: 10,
            liveHolds: [{ hold_id: 'h', entry_id: 'L2#1', kind: 'game', tab_id: 't9', what: 'running game' }] },
    ];
    it('one row per lineage: label (or id), counts, bytes, and the live holds by name', () => {
        const rows = libraryRows(lineages);
        expect(rows.map((r) => [r.lineageId, r.label, r.counts, r.versions, r.drafts, r.held])).toEqual([
            ['L1', 'Demo', '2 versions, 1 draft', 2, 1, false],
            ['L2', 'L2', '1 version, 0 drafts', 1, 0, true],
        ]);
        expect(rows[1].heldText).toBe('In use: game in tab t9 (running game)');
    });
    it('the refusal names the set and every hold', () => {
        expect(refusalText('Demo', { heldBy: [{ kind: 'pin', tab_id: 'a' }, { kind: 'game', tab_id: 'b', what: 'x' }] }))
            .toMatch(/^Not cleared: "Demo" is in use \(pin in tab a; game in tab b \(x\)\)\./);
        expect(holdText({ kind: 'world', tab_id: 'w' })).toBe('world in tab w');
    });
    it("a library Clear's confirm says what, how much, and that it cannot be undone (confirmText's wording)", () => {
        expect(libraryConfirmText('Clear "Demo"', { versions: 2, drafts: 1, bytes: 1234 }))
            .toMatch(/^Clear "Demo": remove 2 saved versions and 1 draft \(1,234 bytes\) from this site's document library\? This cannot be undone\. A set that something is using is refused/);
        expect(libraryConfirmText('Clear leftover drafts', { drafts: 3, draftsOnly: true }))
            .toMatch(/^Clear leftover drafts: remove 3 drafts from this site's document library\? This cannot be undone\. A draft that something is using is kept/);
    });
});
