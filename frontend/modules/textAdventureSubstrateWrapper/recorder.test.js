import { describe, it, expect, beforeEach, vi } from 'vitest';

import { startTextAdventureRecorder } from './recorder.js';
import {
    getSavedQueues,
    _testOnly_clearAll as resetSavedQueueStore,
} from '../loops/savedQueueStore.js';
import { hashRulesData, clearRulesHashCache } from '../shared/rulesHash.js';

// Stub gameState singleton — recorder uses getCurrentMana via the
// singleton import. Each test sets currentManaValue directly.
let currentManaValue = 100;
vi.mock('../gameState/singleton.js', () => ({
    getGameStateSingleton: () => ({
        getCurrentMana: () => currentManaValue,
    }),
}));

function makeEventBus() {
    const subs = new Map();
    return {
        subs,
        subscribe: (name, cb) => {
            if (!subs.has(name)) subs.set(name, []);
            subs.get(name).push(cb);
        },
        unsubscribe: (name, cb) => {
            const list = subs.get(name);
            if (!list) return;
            const i = list.indexOf(cb);
            if (i !== -1) list.splice(i, 1);
        },
        publish: (name, data) => {
            (subs.get(name) ?? []).forEach((cb) => cb(data));
        },
    };
}

const RULES_DATA = { regions: { 1: ['room_a', 'room_b'] } };

beforeEach(() => {
    resetSavedQueueStore();
    clearRulesHashCache();
    currentManaValue = 100;
});

describe('startTextAdventureRecorder', () => {
    it('persists a SavedQueue on regionMove with the actions captured during the visit', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });

        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: RULES_DATA });
        bus.publish('textAdventure:loadRegion', {
            region_id: 'room_a',
            arrivedFrom: { exit_id: 'south' },
        });
        // A few player actions.
        bus.publish('textAdventure:commandRecorded', {
            type: 'locationCheck', locationName: 'sword', regionName: 'room_a',
        });
        bus.publish('textAdventure:commandRecorded', {
            type: 'locationCheck', locationName: 'lamp', regionName: 'room_a',
        });
        // Mana dipped mid-visit.
        currentManaValue = 70;
        bus.publish('gameState:manaChanged', {});
        currentManaValue = 80;
        bus.publish('gameState:manaChanged', {});
        // Exit.
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'north',
        });

        const queues = getSavedQueues(hashRulesData(RULES_DATA), 'room_a', 'text_adventure');
        expect(queues).toHaveLength(1);
        expect(queues[0]).toMatchObject({
            regionName: 'room_a',
            substrate: 'text_adventure',
            arrivalExitId: 'south',
            departureExitId: 'north',
            actions: [
                { type: 'locationCheck', locationName: 'sword' },
                { type: 'locationCheck', locationName: 'lamp' },
            ],
            manaAtEntry: 100,
            manaAtExit: 80,
            manaMin: 70,
            locationsChecked: ['sword', 'lamp'],
        });
    });

    it('uses "entrance" as the default arrival exit when arrivedFrom is missing', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: RULES_DATA });
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a' });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'east',
        });
        const [q] = getSavedQueues(hashRulesData(RULES_DATA), 'room_a', 'text_adventure');
        expect(q.arrivalExitId).toBe('entrance');
    });

    it('captures explore actions in the recording', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: RULES_DATA });
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'explore', regionName: 'room_a',
        });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        const [q] = getSavedQueues(hashRulesData(RULES_DATA), 'room_a', 'text_adventure');
        expect(q.actions).toEqual([{ type: 'explore', regionName: 'room_a' }]);
    });

    it('drops actions that target a different region than the current recording', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: RULES_DATA });
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        // Stale event from room_b — should be ignored.
        bus.publish('textAdventure:commandRecorded', {
            type: 'locationCheck', locationName: 'stale_item', regionName: 'room_b',
        });
        bus.publish('textAdventure:commandRecorded', {
            type: 'locationCheck', locationName: 'real_item', regionName: 'room_a',
        });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        const [q] = getSavedQueues(hashRulesData(RULES_DATA), 'room_a', 'text_adventure');
        expect(q.actions).toEqual([{ type: 'locationCheck', locationName: 'real_item' }]);
    });

    it('silently skips persistence when rules data is not yet cached', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        // Never publish rawJsonDataLoaded.
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        expect(getSavedQueues(hashRulesData(RULES_DATA), 'room_a', 'text_adventure')).toEqual([]);
    });

    it('starts a new recording for the next region after a regionMove', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: RULES_DATA });

        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        bus.publish('textAdventure:loadRegion', { region_id: 'room_b', arrivedFrom: { exit_id: 's2' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'locationCheck', locationName: 'b_item', regionName: 'room_b',
        });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_b', targetRegion: 'room_c', exitName: 'e',
        });

        const hash = hashRulesData(RULES_DATA);
        expect(getSavedQueues(hash, 'room_a', 'text_adventure')).toHaveLength(1);
        const [qB] = getSavedQueues(hash, 'room_b', 'text_adventure');
        expect(qB.arrivalExitId).toBe('s2');
        expect(qB.departureExitId).toBe('e');
        expect(qB.actions).toEqual([{ type: 'locationCheck', locationName: 'b_item' }]);
    });

    it('stop() unsubscribes — subsequent events do not persist', () => {
        const bus = makeEventBus();
        const stop = startTextAdventureRecorder({ eventBus: bus });
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: RULES_DATA });
        stop();
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        expect(getSavedQueues(hashRulesData(RULES_DATA), 'room_a', 'text_adventure')).toEqual([]);
    });
});
