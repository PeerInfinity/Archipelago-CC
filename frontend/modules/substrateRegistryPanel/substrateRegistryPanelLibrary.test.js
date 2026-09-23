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
    describeRegistry, driftIsEmpty, fullValueText, snapshotExpandable, THREW_PREFIX,
    UNSNAPSHOTTED_GROUP,
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
