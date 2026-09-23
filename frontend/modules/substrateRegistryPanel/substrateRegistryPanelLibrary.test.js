/**
 * substrateRegistryPanelLibrary — the view-model over FIXTURE entries and a
 * FIXTURE snapshot (not the real ones: the real registry moves, and a test
 * pinned to it would be a second snapshot). The fixture snapshot is built with
 * the same shaper the generator uses, then one cell and one column are
 * changed so both drift directions and a field drift exist.
 */
import { describe, expect, it } from 'vitest';

import { cellOf, fieldNamesOf, shapeRows } from '../procgenDocs/registryShape.js';
import {
    applyColumnControls, describeRegistry, driftIsEmpty, FEATURE_SEPARATOR, featureRowsOf, fullValueText, GLYPH, MATRIX_KINDS,
    matrixCell, matrixOf, reorderIds, ROW_KINDS, snapshotExpandable, THREW_PREFIX, UNSNAPSHOTTED_GROUP,
} from './substrateRegistryPanelLibrary.js';

const controller = { play() {}, stop() {} };

const alpha = {
    id: 'alpha',
    label: 'Alpha',
    gate: null,
    getPlaybackController: () => controller,
    sharing: { items: { getTypes: () => ['coin', 'gem'] } },
    features: ['a', 'b'],
    fresh: true, // the fixture snapshot has no row for this
};
const beta = {
    id: 'beta',
    label: 'Beta',
    getPlaybackController: () => null,
    sharing: { items: { types: ['wood'] } },
    features: ['a'],
};
const gamma = { id: 'gamma' }; // live only

/** A snapshot the way the generator would write it for [alpha, beta, ghost],
 *  minus `fresh`, with beta's `features` recorded as it USED to be. */
function fixtureSnapshot() {
    const ghost = { id: 'ghost', label: 'Ghost' };
    const entries = [alpha, beta, ghost].map(({ fresh, ...rest }) => rest);
    const names = fieldNamesOf(entries, new Set(['sharing', 'sharing.items']));
    const rows = shapeRows(entries, names).map((r) => ({ ...r }));
    const feat = rows.find((r) => r.name === 'features');
    feat.cells = feat.cells.map((c) => (c.id === 'beta' ? { id: 'beta', ...cellOf(['a', 'x']) } : c));
    const identity = ['id', 'label'];
    return {
        columns: entries.map((e) => ({
            id: e.id, label: e.label, fields: Object.keys(e).length, registeredBy: `lib/${e.id}.js`,
        })),
        groups: [
            { title: 'Identity', rows: identity },
            { title: 'Everything else', rows: names.filter((n) => !identity.includes(n)) },
        ],
        rows,
    };
}

describe('describeRegistry', () => {
    const snap = fixtureSnapshot();
    const vm = describeRegistry([alpha, beta, gamma], snap);

    it('expands exactly the parents the snapshot expanded', () => {
        expect([...snapshotExpandable(snap)].sort()).toEqual(['sharing', 'sharing.items']);
        expect(vm.rows.map((r) => r.name)).toContain('sharing.items.getTypes');
        expect(vm.rows.map((r) => r.name)).toContain('sharing.items.types');
    });

    it('columns are the LIVE entries, in live order, registeredBy from the snapshot or null', () => {
        expect(vm.columns).toEqual([
            { id: 'alpha', label: 'Alpha', fields: 7, registeredBy: 'lib/alpha.js' },
            { id: 'beta', label: 'Beta', fields: 5, registeredBy: 'lib/beta.js' },
            { id: 'gamma', label: null, fields: 1, registeredBy: null },
        ]);
        expect(vm.snapshotCount).toBe(3);
    });

    it('groups are the snapshot\'s, in order, plus one for the field it has no row for', () => {
        expect(vm.groups.map((g) => g.title)).toEqual(['Identity', 'Everything else', UNSNAPSHOTTED_GROUP]);
        expect(vm.groups[2].rows).toEqual(['fresh']);
    });

    it('null is a VALUE and a function is a function', () => {
        const gate = vm.rows.find((r) => r.name === 'gate').cells[0];
        expect(gate).toMatchObject({ present: true, type: 'null' });
        expect(fullValueText(gate)).toEqual({ text: 'null', note: false });
        const fn = vm.rows.find((r) => r.name === 'getPlaybackController').cells[0];
        expect(fullValueText(fn)).toEqual({ text: 'function', note: false });
        expect(fullValueText(cellOf([]))).toEqual({ text: 'empty', note: true });
        expect(fullValueText(cellOf(undefined))).toEqual({ text: '—', note: true });
        expect(fullValueText(cellOf({ b: 1, a: 1 }))).toEqual({ text: '{a, b}', note: false });
        expect(fullValueText(cellOf('s'))).toEqual({ text: '"s"', note: false });
    });

    it('the callable answers: controller, null, absent; a provider and a static list', () => {
        expect(vm.answers).toEqual({
            alpha: { playbackController: 'controller', itemTypes: ['coin', 'gem'] },
            beta: { playbackController: 'null', itemTypes: ['wood'] },
            gamma: { playbackController: 'absent', itemTypes: 'absent' },
        });
    });

    it('drift in BOTH id directions and the moved fields, entry by entry in live order', () => {
        expect(vm.drift.liveOnly).toEqual(['gamma']);
        expect(vm.drift.snapshotOnly).toEqual(['ghost']);
        expect(vm.drift.fields).toEqual([
            { name: 'fresh', id: 'alpha', snapshot: '—', live: 'yes' },
            { name: 'features', id: 'beta', snapshot: 'a, x', live: 'a' },
        ]);
        expect(driftIsEmpty(vm.drift)).toBe(false);
    });

    it('a registry that matches its snapshot has an EMPTY drift', () => {
        const same = describeRegistry([beta], {
            columns: [{ id: 'beta', label: 'Beta', fields: 5, registeredBy: null }],
            groups: [],
            rows: shapeRows([beta], fieldNamesOf([beta], new Set())),
        });
        expect(driftIsEmpty(same.drift)).toBe(true);
    });

    it('a callable that THROWS is an answer, not a crash — through the injected call', () => {
        const thrown = describeRegistry([alpha, gamma], snap, {
            call: () => { throw new Error('not mounted\nstack'); },
        });
        expect(thrown.answers.alpha).toEqual({
            playbackController: `${THREW_PREFIX}not mounted`,
            itemTypes: `${THREW_PREFIX}not mounted`,
        });
        // An entry with nothing to call never reaches `call`.
        expect(thrown.answers.gamma).toEqual({ playbackController: 'absent', itemTypes: 'absent' });
    });

    it('the injected call sees every callable, and its return is the answer', () => {
        const seen = [];
        const faked = describeRegistry([alpha], snap, {
            call: (fn) => { seen.push(fn); return seen.length === 1 ? 7 : null; },
        });
        expect(seen).toHaveLength(2);
        expect(faked.answers.alpha).toEqual({ playbackController: 'returned number', itemTypes: 'returned null' });
    });
});

describe('the matrix mode', () => {
    const { yes, no, number, count } = MATRIX_KINDS;

    it('matrixCell: one kind per cellOf TYPE, the title says which ✗ it is', () => {
        const kinds = (v) => { const m = matrixCell(cellOf(v)); return [m.kind, m.text]; };
        expect(kinds(undefined)).toEqual([no, GLYPH.no]);
        expect(kinds(null)).toEqual([yes, GLYPH.yes]);
        expect(kinds(() => 1)).toEqual([yes, GLYPH.yes]);
        expect(kinds('s')).toEqual([yes, GLYPH.yes]);
        expect(kinds({ a: 1 })).toEqual([yes, GLYPH.yes]);
        expect(kinds(true)).toEqual([yes, GLYPH.yes]);
        expect(kinds(false)).toEqual([no, GLYPH.no]);
        expect(kinds(30)).toEqual([number, '30']);
        expect(kinds(['a', 'b', 'c'])).toEqual([count, '3']);
        expect(kinds([])).toEqual([count, '0']);
        expect(matrixCell(cellOf(undefined)).title).toMatch(/^absent/);
        expect(matrixCell(cellOf(false)).title).toMatch(/^false/);
        expect(matrixCell(cellOf(null)).title).toBe('null');
        expect(matrixCell(cellOf(['a', 'b'])).title).toBe('a, b');
    });

    /** Rows the way describeRegistry makes them (it adds `allStrings`). */
    const rowsOf = (entries) => describeRegistry(entries, { columns: [], groups: [], rows: [] }).rows;
    const row = (entries, name) => rowsOf(entries).find((r) => r.name === name);

    it('featureRowsOf: the SORTED union across entries, ✓ where the entry holds it', () => {
        const feats = featureRowsOf(row([{ id: 'p', f: ['b', 'a'] }, { id: 'q', f: ['c', 'a'] }, { id: 'r' }], 'f'));
        expect(feats.map((f) => f.name)).toEqual(['a', 'b', 'c'].map((e) => `f${FEATURE_SEPARATOR}${e}`));
        expect(feats.every((f) => f.parent === 'f')).toBe(true);
        expect(feats.map((f) => f.cells.map((c) => c.text).join(''))).toEqual([
            GLYPH.yes + GLYPH.yes + GLYPH.no, GLYPH.yes + GLYPH.no + GLYPH.no, GLYPH.no + GLYPH.yes + GLYPH.no]);
        expect(feats[0].cells[2].title).toMatch(/^absent/);
    });

    it('featureRowsOf: an array of non-strings is NOT expanded', () => {
        expect(featureRowsOf(row([{ id: 'p', f: [1, 2] }], 'f'))).toEqual([]);
        expect(featureRowsOf(row([{ id: 'p', f: ['a'] }, { id: 'q', f: [{ x: 1 }] }], 'f'))).toEqual([]);
    });

    it('featureRowsOf: a null cell beside arrays still expands; the null column is all ✗', () => {
        const feats = featureRowsOf(row([{ id: 'p', f: ['a', 'b'] }, { id: 'n', f: null }], 'f'));
        expect(feats).toHaveLength(2);
        for (const f of feats) {
            expect(f.cells[1]).toMatchObject({ id: 'n', kind: no, text: GLYPH.no });
            expect(f.cells[1].title).toMatch(/null/);
        }
    });

    it('featureRowsOf: no arrays (or only nulls, or a mixed row) — nothing to expand', () => {
        expect(featureRowsOf(row([{ id: 'p', f: true }, { id: 'q', f: false }], 'f'))).toEqual([]);
        expect(featureRowsOf(row([{ id: 'p', f: null }], 'f'))).toEqual([]);
        expect(featureRowsOf(row([{ id: 'p', f: ['a'] }, { id: 'q', f: 'a' }], 'f'))).toEqual([]);
        expect(featureRowsOf(row([{ id: 'p', f: [] }], 'f'))).toEqual([]);
    });

    it('matrixOf: groups in vm.groups order, each feature row directly after its parent', () => {
        const vm = describeRegistry([alpha, beta, gamma], fixtureSnapshot());
        const m = matrixOf(vm);
        expect(m.columns).toBe(vm.columns);
        expect(m.groups.map((g) => g.title)).toEqual(vm.groups.map((g) => g.title));
        const names = m.groups.flatMap((g) => g.rows.map((r) => r.name));
        const i = names.indexOf('features');
        expect(names.slice(i, i + 3)).toEqual(['features', `features${FEATURE_SEPARATOR}a`,
            `features${FEATURE_SEPARATOR}b`]);
        const flat = m.groups.flatMap((g) => g.rows);
        expect(flat.filter((r) => r.kind === ROW_KINDS.field).map((r) => r.name))
            .toEqual(vm.groups.flatMap((g) => g.rows));
        // Every feature row's parent is the nearest field row above it.
        let lastField = null;
        for (const r of flat) {
            if (r.kind === ROW_KINDS.field) lastField = r.name;
            else expect(r.parent).toBe(lastField);
        }
        expect(flat.filter((r) => r.kind === ROW_KINDS.feature).map((r) => r.parent))
            .toEqual(['features', 'features', 'sharing.items.types']);
        const feat = flat.find((r) => r.name === 'features');
        expect(feat.cells.map((c) => c.text)).toEqual(['2', '1', GLYPH.no]);
    });
});

describe('the column controls', () => {
    const vm = describeRegistry([alpha, beta, gamma], fixtureSnapshot());
    const m = matrixOf(vm);
    const ids = (x) => x.columns.map((c) => c.id);
    const rows = (x) => x.groups.flatMap((g) => g.rows);
    /** Every row's cells, as the ids they belong to. */
    const cellIds = (x) => rows(x).map((r) => r.cells.map((c) => c.id).join(','));

    it('reorderIds: the order\'s live ids first, then the unnamed ids in input order', () => {
        expect(reorderIds(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
        expect(reorderIds(['a', 'b', 'c'], ['c', 'a'])).toEqual(['c', 'a', 'b']);
        expect(reorderIds(['a', 'b', 'c'], ['ghost', 'b', 'b'])).toEqual(['b', 'a', 'c']);
        expect(reorderIds([], ['a'])).toEqual([]);
    });

    it('the default controls are the identity', () => {
        const out = applyColumnControls(m);
        expect(out).toEqual(m);
        expect(out).not.toBe(m);
        expect(applyColumnControls(m, { hidden: new Set(), order: [] })).toEqual(m);
    });

    it('hiding one id shrinks the columns and EVERY row\'s cells together, feature rows included', () => {
        const hidden = ids(m)[0];
        const out = applyColumnControls(m, { hidden: new Set([hidden]) });
        const kept = ids(m).filter((id) => id !== hidden);
        expect(ids(out)).toEqual(kept);
        expect(rows(out).length).toBe(rows(m).length);
        expect(rows(out).some((r) => r.kind === ROW_KINDS.feature)).toBe(true);
        for (const r of rows(out)) expect(r.cells.map((c) => c.id)).toEqual(kept);
    });

    it('reordering moves each row\'s cells with its column', () => {
        const order = [...ids(m)].reverse();
        const out = applyColumnControls(m, { order });
        expect(ids(out)).toEqual(order);
        for (const [i, r] of rows(out).entries()) {
            const before = rows(m)[i];
            expect(r.name).toBe(before.name);
            expect(r.cells).toEqual(order.map((id) => before.cells.find((c) => c.id === id)));
        }
    });

    it('a stale id in order is dropped; a live id missing from order appends in input order', () => {
        const [first, second, third] = ids(m);
        const out = applyColumnControls(m, { order: ['ghost-no-longer-live', third] });
        expect(ids(out)).toEqual([third, first, second]);
        expect(new Set(cellIds(out))).toEqual(new Set([[third, first, second].join(',')]));
    });

    it('hiding everything leaves the rows with no cells', () => {
        const out = applyColumnControls(m, { hidden: new Set(ids(m)) });
        expect(out.columns).toEqual([]);
        expect(rows(out).every((r) => r.cells.length === 0)).toBe(true);
    });

    it('the input matrix is not mutated', () => {
        const before = structuredClone(m);
        applyColumnControls(m, { hidden: new Set([ids(m)[1]]), order: [...ids(m)].reverse() });
        expect(m).toEqual(before);
    });
});
