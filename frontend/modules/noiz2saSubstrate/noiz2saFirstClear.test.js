/**
 * N4b — a region's first clear explores it fully (`noiz2saFirstClear.js`): which regions are Noiz2sa ones and their
 * clear, the checked set in any snapshot shape, how many explores a full explore is, and the once-per-region watcher.
 */
import { describe, expect, it } from 'vitest';

import { clearsOf, checkedNamesOf, exploresToFullyExplore, createFirstClearWatcher } from './noiz2saFirstClear.js';

const warehouse = () => new Map([
    ['n1', { substrate: 'noiz2sa', world: { ap_locations: { clear: 'n1__clear' } } }],
    ['n2', { substrate: 'noiz2sa', world: { ap_locations: { clear: 'n2__clear' } } }],
    ['m1', { substrate: 'maze', world: { ap_locations: { clear: 'm1__clear' } } }],
    ['nx', { substrate: 'noiz2sa', world: {} }],
]);

describe('clearsOf', () => {
    it('the Noiz2sa regions with a clear location, and only them', () => {
        expect([...clearsOf(warehouse(), 'noiz2sa')]).toEqual([['n1', 'n1__clear'], ['n2', 'n2__clear']]);
    });
    it('reads procgenPlayer\'s WorldWarehouse (its `regions` Map)', () => {
        expect([...clearsOf({ regions: warehouse() }, 'noiz2sa').keys()]).toEqual(['n1', 'n2']);
    });
    it('no warehouse → none', () => {
        expect(clearsOf(null, 'noiz2sa').size).toBe(0);
        expect(clearsOf({}, 'noiz2sa').size).toBe(0);
    });
});

describe('checkedNamesOf', () => {
    it('reads every snapshot shape', () => {
        expect([...checkedNamesOf({ checkedLocations: ['a', 'b'] })]).toEqual(['a', 'b']);
        expect([...checkedNamesOf({ checkedLocations: new Set(['a']) })]).toEqual(['a']);
        expect([...checkedNamesOf({ checkedLocations: { a: true, b: false } })]).toEqual(['a']);
        expect(checkedNamesOf(null).size).toBe(0);
    });
});

describe('exploresToFullyExplore', () => {
    it('one explore per location and per exit (each explore discovers one undiscovered item)', () => {
        expect(exploresToFullyExplore({ locations: [{}], exits: [{}, {}] })).toBe(3);
        expect(exploresToFullyExplore({ locations: [{}] })).toBe(1);
        expect(exploresToFullyExplore(undefined)).toBe(0);
    });
});

describe('the first-clear watcher', () => {
    it('reports a region when its clear turns from unchecked to checked, once per turn', () => {
        const w = createFirstClearWatcher();
        const clears = clearsOf(warehouse(), 'noiz2sa');
        expect(w.note(clears, new Set())).toEqual([]);
        expect(w.note(clears, new Set(['n1__clear', 'm1__clear']))).toEqual(['n1']);
        expect(w.note(clears, new Set(['n1__clear']))).toEqual([]);
        expect(w.note(clears, new Set(['n1__clear', 'n2__clear']))).toEqual(['n2']);
        expect(w.explored()).toEqual(['n1', 'n2']);
    });
    it('a region first seen already checked is not a first clear (a stale snapshot after a rules load)', () => {
        const w = createFirstClearWatcher();
        const clears = clearsOf(warehouse(), 'noiz2sa');
        expect(w.note(clears, new Set(['n1__clear']))).toEqual([]); // stale: the state before the load
        expect(w.note(clears, new Set())).toEqual([]);               // the fresh state
        expect(w.note(clears, new Set(['n1__clear']))).toEqual(['n1']); // the real first clear
    });
    it('a reset forgets every region', () => {
        const w = createFirstClearWatcher();
        const clears = clearsOf(warehouse(), 'noiz2sa');
        w.note(clears, new Set());
        w.reset();
        expect(w.explored()).toEqual([]);
        expect(w.note(clears, new Set(['n1__clear']))).toEqual([]);
    });
});
