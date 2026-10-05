/**
 * N4b — a region's first ENTRY explores it fully, and (N4c) the next queued action of a region (`noiz2saFirstEntry.js`):
 * how many explores a full explore is, the once-per-region entry watcher, and which queued action comes next.
 */
import { describe, expect, it } from 'vitest';

import { exploresToFullyExplore, createFirstEntryWatcher, queuedNextFrom } from './noiz2saFirstEntry.js';

describe('exploresToFullyExplore', () => {
    it('one explore per location and per exit (each explore discovers one undiscovered item)', () => {
        expect(exploresToFullyExplore({ locations: [{}], exits: [{}, {}] })).toBe(3);
        expect(exploresToFullyExplore({ locations: [{}] })).toBe(1);
        expect(exploresToFullyExplore(undefined)).toBe(0);
    });
});

describe('the first-entry watcher', () => {
    it('true on a region\'s first entry only; a reset (a rules load) starts over', () => {
        const w = createFirstEntryWatcher();
        expect(w.enter('a')).toBe(true);
        expect(w.enter('a')).toBe(false);
        expect(w.enter('b')).toBe(true);
        expect(w.entered()).toEqual(['a', 'b']);
        w.reset();
        expect(w.entered()).toEqual([]);
        expect(w.enter('a')).toBe(true);
        expect(w.enter('')).toBe(false);
        expect(w.enter(null)).toBe(false);
    });
});

describe('queuedNextFrom (N4c)', () => {
    const mv = (s, d, e) => ({ type: 'regionMove', sourceRegion: s, destinationRegion: d, exitUsed: e });
    const ck = (r, l = `${r}__clear`) => ({ type: 'locationCheck', sourceRegion: r, locationName: l });
    const queue = [mv('Menu', 'A', 'm'), ck('A'), mv('A', 'B', 'ab'), mv('B', 'C', 'bc')];
    it('the region\'s check, or the next move leaving the region, skipping the move into it', () => {
        expect(queuedNextFrom(queue, 0, 'A')).toEqual({ kind: 'check', locationName: 'A__clear', index: 1 });
        expect(queuedNextFrom(queue, 2, 'A')).toEqual({ kind: 'move', exit: 'ab', target: 'B', index: 2 });
        expect(queuedNextFrom(queue, 2, 'B')).toEqual({ kind: 'move', exit: 'bc', target: 'C', index: 3 });
    });
    it('a completed entry, or a check of a checked location, is passed over', () => {
        const done = [mv('Menu', 'A', 'm'), { ...ck('A'), completed: true }, mv('A', 'B', 'ab')];
        expect(queuedNextFrom(done, 0, 'A')).toMatchObject({ kind: 'move', exit: 'ab' });
        expect(queuedNextFrom(queue, 0, 'A', { isChecked: (l) => l === 'A__clear' })).toMatchObject({ kind: 'move', exit: 'ab' });
    });
    it('a check that ends the queue is the next action; none after it', () => {
        const q = [mv('Menu', 'A', 'm'), ck('A')];
        expect(queuedNextFrom(q, 0, 'A')).toMatchObject({ kind: 'check' });
        expect(queuedNextFrom(q, 0, 'A', { isChecked: () => true })).toBeNull();
    });
    it('none when the next action is another region\'s, or nothing is left', () => {
        expect(queuedNextFrom(queue, 0, 'B')).toBeNull();
        expect(queuedNextFrom([ck('B')], 0, 'A')).toBeNull();
        expect(queuedNextFrom(queue, 4, 'C')).toBeNull();
        expect(queuedNextFrom([], 0, 'A')).toBeNull();
        expect(queuedNextFrom(null, 0, 'A')).toBeNull();
    });
});
