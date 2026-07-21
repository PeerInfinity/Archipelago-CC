import { describe, it, expect, beforeEach, vi } from 'vitest';

import { startTextAdventureRecorder, takeLastTextAdventureRecording } from './recorder.js';

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

beforeEach(() => {
    // Drain the module-level stash so a prior test's recording can't bleed.
    takeLastTextAdventureRecording();
    currentManaValue = 100;
});

describe('startTextAdventureRecorder', () => {
    // M2: the recorder no longer persists directly — it stashes the finalized
    // capture in a module-level slot for loops to pull via
    // takeLastTextAdventureRecording(). loops owns the rules-hash + tag.

    it('stashes a SavedQueue on regionMove with the actions captured during the visit', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });

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

        const rec = takeLastTextAdventureRecording();
        expect(rec).toMatchObject({
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
        // Pull-and-clear: a second pull is empty.
        expect(takeLastTextAdventureRecording()).toBeNull();
    });

    it('uses "entrance" as the default arrival exit when arrivedFrom is missing', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a' });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'east',
        });
        expect(takeLastTextAdventureRecording().arrivalExitId).toBe('entrance');
    });

    it('captures explore actions in the recording', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'explore', regionName: 'room_a',
        });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        expect(takeLastTextAdventureRecording().actions)
            .toEqual([{ type: 'explore', regionName: 'room_a' }]);
    });

    it('drops actions that target a different region than the current recording', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
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
        expect(takeLastTextAdventureRecording().actions)
            .toEqual([{ type: 'locationCheck', locationName: 'real_item' }]);
    });

    it('stashes even without rules data (loops owns the rules-hash)', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        expect(takeLastTextAdventureRecording()).toMatchObject({
            regionName: 'room_a', arrivalExitId: 's', departureExitId: 'n',
        });
    });

    it('starts a new recording for the next region after a regionMove', () => {
        const bus = makeEventBus();
        startTextAdventureRecorder({ eventBus: bus });

        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        // room_a's recording is stashed; pull it before the next visit
        // overwrites the single stash slot.
        const recA = takeLastTextAdventureRecording();
        expect(recA).toMatchObject({ regionName: 'room_a', departureExitId: 'n' });

        bus.publish('textAdventure:loadRegion', { region_id: 'room_b', arrivedFrom: { exit_id: 's2' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'locationCheck', locationName: 'b_item', regionName: 'room_b',
        });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_b', targetRegion: 'room_c', exitName: 'e',
        });
        const recB = takeLastTextAdventureRecording();
        expect(recB).toMatchObject({
            regionName: 'room_b',
            arrivalExitId: 's2',
            departureExitId: 'e',
            actions: [{ type: 'locationCheck', locationName: 'b_item' }],
        });
    });

    it('stop() unsubscribes — subsequent events do not stash', () => {
        const bus = makeEventBus();
        const stop = startTextAdventureRecorder({ eventBus: bus });
        stop();
        bus.publish('textAdventure:loadRegion', { region_id: 'room_a', arrivedFrom: { exit_id: 's' } });
        bus.publish('textAdventure:commandRecorded', {
            type: 'regionMove', sourceRegion: 'room_a', targetRegion: 'room_b', exitName: 'n',
        });
        expect(takeLastTextAdventureRecording()).toBeNull();
    });
});
