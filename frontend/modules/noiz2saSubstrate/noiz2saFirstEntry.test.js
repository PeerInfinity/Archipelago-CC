/**
 * N4b — a region's first ENTRY explores it fully, and the queued move out of a region (`noiz2saFirstEntry.js`): how
 * many explores a full explore is, the once-per-region entry watcher, and which queued move leaves the region.
 */
import { describe, expect, it } from 'vitest';

import { exploresToFullyExplore, createFirstEntryWatcher, queuedMoveFrom } from './noiz2saFirstEntry.js';

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

describe('queuedMoveFrom', () => {
    const mv = (s, d, e) => ({ type: 'regionMove', sourceRegion: s, destinationRegion: d, exitUsed: e });
    const queue = [mv('Menu', 'A', 'm'), { type: 'locationCheck', sourceRegion: 'A' }, mv('A', 'B', 'ab'), mv('B', 'C', 'bc')];
    it('the next move leaving the region, skipping the move into it', () => {
        expect(queuedMoveFrom(queue, 0, 'A')).toEqual({ exit: 'ab', target: 'B', index: 2 });
        expect(queuedMoveFrom(queue, 2, 'A')).toEqual({ exit: 'ab', target: 'B', index: 2 });
        expect(queuedMoveFrom(queue, 2, 'B')).toEqual({ exit: 'bc', target: 'C', index: 3 });
    });
    it('none when the next move leaves another region, or there is no move left', () => {
        expect(queuedMoveFrom(queue, 0, 'B')).toBeNull();
        expect(queuedMoveFrom(queue, 4, 'C')).toBeNull();
        expect(queuedMoveFrom([], 0, 'A')).toBeNull();
        expect(queuedMoveFrom(null, 0, 'A')).toBeNull();
    });
});
