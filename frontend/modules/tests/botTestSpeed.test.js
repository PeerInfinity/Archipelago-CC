import { describe, expect, it } from 'vitest';
import { startBotTestSpeed, TEST_NOIZ2SA_BOT_SPEED } from './botTestSpeed.js';

function bus() {
    const subs = new Map();
    return {
        subscribe: (name, fn) => subs.set(name, [...(subs.get(name) ?? []), fn]),
        unsubscribe: (name, fn) => subs.set(name, (subs.get(name) ?? []).filter((f) => f !== fn)),
        publish: (name) => (subs.get(name) ?? []).forEach((f) => f()),
        count: (name) => (subs.get(name) ?? []).length,
    };
}

// A queue of regionMove entries resolves to one visit per region entered (blockIdentity.js).
const move = (from, to) => ({ type: 'regionMove', regionName: to, sourceRegion: from, destinationRegion: to });

function loopState({ honours, queue, instant = new Map() }) {
    return {
        queue,
        blockInstantStates: instant,
        getActionQueue() { return this.queue; },
        regionBotHonorsInstant: (r) => honours.includes(r),
        getBlockInstant(r, i) { return this.blockInstantStates.get(`${r}#${i}`) === true; },
        setBlockInstant(r, i, on) {
            if (on) this.blockInstantStates.set(`${r}#${i}`, true);
            else this.blockInstantStates.delete(`${r}#${i}`);
        },
    };
}

function noiz2sa(botSpeed = 1) {
    const service = { settings: { botSpeed }, applied: [] };
    service.applySettings = (next) => { service.applied.push(next); Object.assign(service.settings, next); };
    return service;
}

describe('startBotTestSpeed', () => {
    it('ticks Instant on the blocks whose Bot honours it, again on every queue write, and removes only its own', async () => {
        const ls = loopState({ honours: ['J1', 'J2'], queue: [move('Menu', 'J1'), move('J1', 'M1')] });
        const eventBus = bus();
        const restore = startBotTestSpeed({ eventBus, getLoopState: () => ls });
        const keys = () => [...ls.blockInstantStates.keys()].sort();
        expect(keys()).toEqual(['J1#1']);

        // The runner writes the next loop's queue; a block the person had set Instant themselves stays theirs.
        ls.queue = [move('Menu', 'J2'), { ...move('J2', 'J1'), instanceNumber: 2 }];
        ls.setBlockInstant('J2', 1, true);
        eventBus.publish('loopState:queueUpdated');
        expect(keys()).toEqual(['J1#1', 'J1#2', 'J2#1']);

        await restore();
        expect(keys()).toEqual(['J2#1']);
        expect(eventBus.count('loopState:queueUpdated')).toBe(0);
    });

    it('plays Noiz2sa at the test speed and restores the SAVED setting, never writing it', async () => {
        const service = noiz2sa(1);
        const ls = loopState({ honours: [], queue: [] });
        const restore = startBotTestSpeed({
            eventBus: bus(), getLoopState: () => ls, getNoiz2saService: () => service,
            readSavedSetting: async (key, fallback) => (key === 'moduleSettings.noiz2saSubstrate.botSpeed' ? 2 : fallback),
        });
        expect(service.settings.botSpeed).toBe(TEST_NOIZ2SA_BOT_SPEED);
        await restore();
        expect(service.settings.botSpeed).toBe(2);
    });

    it('re-applies the speed after a module that loads its saved settings mid-run, and leaves an untouched one alone', async () => {
        let service = null; // the module is off at the start
        const eventBus = bus();
        const restore = startBotTestSpeed({ eventBus, getLoopState: () => null, getNoiz2saService: () => service });
        service = noiz2sa(1);
        eventBus.publish('loopState:queueUpdated');
        expect(service.settings.botSpeed).toBe(TEST_NOIZ2SA_BOT_SPEED);
        await restore();
        expect(service.settings.botSpeed).toBe(1);

        const untouched = noiz2sa(TEST_NOIZ2SA_BOT_SPEED);
        const restore2 = startBotTestSpeed({ eventBus: bus(), getLoopState: () => null, getNoiz2saService: () => untouched });
        await restore2();
        expect(untouched.applied).toEqual([]);
    });
});
