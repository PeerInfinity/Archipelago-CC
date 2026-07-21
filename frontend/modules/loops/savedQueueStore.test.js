import { describe, it, expect, beforeEach } from 'vitest';

import {
    SAVED_QUEUE_PER_REGION_LIMIT,
    getSavedQueues,
    getSavedQueueByTag,
    saveQueue,
    clearForRegion,
    _testOnly_clearAll,
} from './savedQueueStore.js';

const RULES_HASH = 'a1b2c3d4';

function makeQueue(overrides = {}) {
    return {
        regionName: 'region_0_0',
        substrate: 'maze',
        arrivalExitId: 'entrance',
        departureExitId: 'east',
        actions: [{ type: 'move', dir: 'E' }],
        manaAtEntry: 100,
        manaAtExit: 80,
        manaMin: 75,
        locationsChecked: [],
        itemsPickedUp: [],
        ...overrides,
    };
}

beforeEach(() => {
    _testOnly_clearAll();
});

describe('savedQueueStore', () => {
    it('starts empty', () => {
        expect(getSavedQueues(RULES_HASH, 'region_0_0', 'maze')).toEqual([]);
    });

    it('saves a new queue and returns it from getSavedQueues', () => {
        const status = saveQueue(RULES_HASH, makeQueue());
        expect(status).toBe('saved');
        const queues = getSavedQueues(RULES_HASH, 'region_0_0', 'maze');
        expect(queues).toHaveLength(1);
        expect(queues[0]).toMatchObject({
            arrivalExitId: 'entrance',
            departureExitId: 'east',
            actions: [{ type: 'move', dir: 'E' }],
            manaAtEntry: 100,
            manaAtExit: 80,
            manaMin: 75,
            name: 'auto: entrance→east',
        });
        expect(typeof queues[0].recordedAt).toBe('number');
    });

    it('returns "duplicate" for a byte-identical re-record (same tag, departure, actions)', () => {
        saveQueue(RULES_HASH, makeQueue());
        const status = saveQueue(RULES_HASH, makeQueue({ manaMin: 1 }));
        // Mana fields differ but tag/departure/actions match.
        expect(status).toBe('duplicate');
        expect(getSavedQueues(RULES_HASH, 'region_0_0', 'maze')).toHaveLength(1);
    });

    it('treats different arrival exits as distinct queues (distinct tags)', () => {
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'entrance' }));
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'south' }));
        expect(getSavedQueues(RULES_HASH, 'region_0_0', 'maze')).toHaveLength(2);
    });

    it('treats different ordinals (same arrival) as distinct queues (distinct tags)', () => {
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'entrance', ordinal: 0 }));
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'entrance', ordinal: 1 }));
        expect(getSavedQueues(RULES_HASH, 'region_0_0', 'maze')).toHaveLength(2);
    });

    it('REPLACES the same-tag entry on re-record (different departure)', () => {
        saveQueue(RULES_HASH, makeQueue({ departureExitId: 'east', recordedAt: 1000 }));
        const status = saveQueue(RULES_HASH, makeQueue({ departureExitId: 'north', recordedAt: 2000 }));
        expect(status).toBe('saved');
        const queues = getSavedQueues(RULES_HASH, 'region_0_0', 'maze');
        // Same tag (entrance, ordinal 0) → the second recording replaced the first.
        expect(queues).toHaveLength(1);
        expect(queues[0].departureExitId).toBe('north');
    });

    it('REPLACES the same-tag entry on re-record (different actions)', () => {
        saveQueue(RULES_HASH, makeQueue({ actions: [{ type: 'move', dir: 'E' }] }));
        const status = saveQueue(RULES_HASH, makeQueue({
            actions: [{ type: 'move', dir: 'E' }, { type: 'move', dir: 'W' }],
        }));
        expect(status).toBe('saved');
        const queues = getSavedQueues(RULES_HASH, 'region_0_0', 'maze');
        expect(queues).toHaveLength(1);
        expect(queues[0].actions).toHaveLength(2);
    });

    it('getSavedQueueByTag returns the matching entry or null', () => {
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'entrance', ordinal: 0, departureExitId: 'east' }));
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'south', ordinal: 0, departureExitId: 'north' }));
        expect(getSavedQueueByTag(RULES_HASH, 'region_0_0', 'maze', 'entrance', 0))
            .toMatchObject({ arrivalExitId: 'entrance', departureExitId: 'east' });
        expect(getSavedQueueByTag(RULES_HASH, 'region_0_0', 'maze', 'south', 0))
            .toMatchObject({ arrivalExitId: 'south', departureExitId: 'north' });
        // No such tag → null.
        expect(getSavedQueueByTag(RULES_HASH, 'region_0_0', 'maze', 'entrance', 1)).toBeNull();
        expect(getSavedQueueByTag(RULES_HASH, 'nope', 'maze', 'entrance', 0)).toBeNull();
    });

    it('getSavedQueueByTag defaults ordinal to 0 and reads legacy (ordinal-less) entries', () => {
        // Legacy entry saved without an ordinal reads back at ordinal 0.
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'entrance' }));
        expect(getSavedQueueByTag(RULES_HASH, 'region_0_0', 'maze', 'entrance'))
            .toMatchObject({ arrivalExitId: 'entrance' });
    });

    it('FIFO-evicts the oldest entry when saving beyond the cap (distinct tags)', () => {
        // Save (cap + 2) distinct-tag queues; verify the bucket holds only
        // the cap, and the oldest two were dropped. Vary ordinal so each is
        // a distinct recording tag (varying departure would replace).
        for (let i = 0; i < SAVED_QUEUE_PER_REGION_LIMIT + 2; i++) {
            saveQueue(RULES_HASH, makeQueue({
                ordinal: i,
                recordedAt: 1000 + i, // explicit timestamps so eviction is deterministic
            }));
        }
        const queues = getSavedQueues(RULES_HASH, 'region_0_0', 'maze');
        expect(queues).toHaveLength(SAVED_QUEUE_PER_REGION_LIMIT);
        // First two are gone; oldest remaining is ordinal 2.
        expect(queues[0].ordinal).toBe(2);
        expect(queues[queues.length - 1].ordinal).toBe(SAVED_QUEUE_PER_REGION_LIMIT + 1);
    });

    it('returns defensive copies — caller mutations do not affect the store', () => {
        saveQueue(RULES_HASH, makeQueue());
        const queues = getSavedQueues(RULES_HASH, 'region_0_0', 'maze');
        queues.push('garbage');
        expect(getSavedQueues(RULES_HASH, 'region_0_0', 'maze')).toHaveLength(1);
    });

    it('isolates buckets by (rulesHash, region, substrate)', () => {
        saveQueue(RULES_HASH, makeQueue({ regionName: 'r1' }));
        saveQueue(RULES_HASH, makeQueue({ regionName: 'r2' }));
        saveQueue(RULES_HASH, makeQueue({ regionName: 'r1', substrate: 'text_adventure' }));
        saveQueue('other_hash', makeQueue({ regionName: 'r1' }));

        expect(getSavedQueues(RULES_HASH, 'r1', 'maze')).toHaveLength(1);
        expect(getSavedQueues(RULES_HASH, 'r2', 'maze')).toHaveLength(1);
        expect(getSavedQueues(RULES_HASH, 'r1', 'text_adventure')).toHaveLength(1);
        expect(getSavedQueues('other_hash', 'r1', 'maze')).toHaveLength(1);
        // Cross-talk: none of the above leak between buckets.
        expect(getSavedQueues(RULES_HASH, 'r1', 'maze')[0].substrate).toBe('maze');
    });

    it('clearForRegion drops one bucket without touching others', () => {
        saveQueue(RULES_HASH, makeQueue({ regionName: 'r1' }));
        saveQueue(RULES_HASH, makeQueue({ regionName: 'r2' }));
        clearForRegion(RULES_HASH, 'r1', 'maze');
        expect(getSavedQueues(RULES_HASH, 'r1', 'maze')).toEqual([]);
        expect(getSavedQueues(RULES_HASH, 'r2', 'maze')).toHaveLength(1);
    });

    it('returns "invalid" for malformed inputs', () => {
        expect(saveQueue(null, makeQueue())).toBe('invalid');
        expect(saveQueue(RULES_HASH, null)).toBe('invalid');
        expect(saveQueue(RULES_HASH, { ...makeQueue(), actions: 'oops' })).toBe('invalid');
        expect(saveQueue(RULES_HASH, { ...makeQueue(), regionName: '' })).toBe('invalid');
    });

    it('saved entries get a synthesized name when none provided', () => {
        saveQueue(RULES_HASH, makeQueue({ arrivalExitId: 'south', departureExitId: 'east' }));
        const [q] = getSavedQueues(RULES_HASH, 'region_0_0', 'maze');
        expect(q.name).toBe('auto: south→east');
    });

    it('respects an explicit name when provided', () => {
        saveQueue(RULES_HASH, makeQueue({ name: 'my-custom-queue' }));
        const [q] = getSavedQueues(RULES_HASH, 'region_0_0', 'maze');
        expect(q.name).toBe('my-custom-queue');
    });
});
