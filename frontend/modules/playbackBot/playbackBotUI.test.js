import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this._listeners = {};
        this.classList = (() => {
            const set = new Set();
            return {
                add: (c) => set.add(c),
                remove: (c) => set.delete(c),
                contains: (c) => set.has(c),
                toggle: (c) => { set.has(c) ? set.delete(c) : set.add(c); },
            };
        })();
        this.parentNode = null;
        this.disabled = false;
        this.value = '';
        this.type = '';
        this.title = '';
        this.textContent = '';
        this.className = '';
        this.onclick = null;
        this.innerHTML = '';
    }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
    insertBefore(child, before) {
        child.parentNode = this;
        const idx = this.children.indexOf(before);
        if (idx === -1) this.children.push(child);
        else this.children.splice(idx, 0, child);
        return child;
    }
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) this.children.splice(idx, 1);
        child.parentNode = null;
        return child;
    }
    addEventListener(name, fn) {
        if (!this._listeners[name]) this._listeners[name] = [];
        this._listeners[name].push(fn);
    }
    removeEventListener() {}
    queryAll(predicate, out = []) {
        for (const child of this.children) {
            if (predicate(child)) out.push(child);
            child.queryAll?.(predicate, out);
        }
        return out;
    }
}

const fakeDocument = {
    createElement(tag) { return new FakeElement(tag); },
};

beforeEach(() => { globalThis.document = fakeDocument; });
afterEach(() => { delete globalThis.document; });

import { PlaybackBotUI, buildLocationIndex, buildSphereQueue } from './playbackBotUI.js';

const SAMPLE_SPHERE_DATA = [
    { sphereIndex: 0, fractionalIndex: 0, locations: [], accessibleRegions: ['Menu'], accessibleLocations: ['Free Loc'] },
    { sphereIndex: 0, fractionalIndex: 1, locations: ['Free Loc'], accessibleRegions: [], accessibleLocations: ['Locked Loc'] },
];

function makeFakeBus() {
    const events = [];
    return {
        events,
        publish(topic, payload, publisher) {
            events.push({ topic, payload, publisher });
        },
    };
}

describe('PlaybackBotUI — initialization', () => {
    it('mounts with control bar and status display', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: makeFakeBus() });
        const root = bot.getElement();
        expect(root).toBeTruthy();
        const status = root.queryAll((el) => el.className === 'playback-bot-status')[0];
        expect(status?.textContent).toMatch(/2 entries/);
    });

    it('reports no sphere log when data is empty', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => [], eventBus: makeFakeBus() });
        const status = bot.getElement().queryAll((el) => el.className === 'playback-bot-status')[0];
        expect(status?.textContent).toMatch(/No sphere log loaded/);
    });
});

describe('PlaybackBotUI — publishes playback:command events', () => {
    it('play() publishes play with a rate', () => {
        const bus = makeFakeBus();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: bus });
        bot.play(7);
        const last = bus.events.at(-1);
        expect(last.topic).toBe('playback:command');
        expect(last.payload.command).toBe('play');
        expect(last.payload.rateHz).toBe(7);
    });

    it('stop() publishes stop', () => {
        const bus = makeFakeBus();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: bus });
        bot.stop();
        expect(bus.events.at(-1).payload.command).toBe('stop');
    });

    it('step() publishes step', () => {
        const bus = makeFakeBus();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: bus });
        bot.step();
        expect(bus.events.at(-1).payload.command).toBe('step');
    });

    it('reset() publishes reset', () => {
        const bus = makeFakeBus();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: bus });
        bot.reset();
        expect(bus.events.at(-1).payload.command).toBe('reset');
    });

    it('setRate() publishes setRate with rate', () => {
        const bus = makeFakeBus();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: bus });
        bot.setRate(12);
        const last = bus.events.at(-1);
        expect(last.payload.command).toBe('setRate');
        expect(last.payload.rateHz).toBe(12);
    });

    it('all events declare presets as the publisher module', () => {
        const bus = makeFakeBus();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: bus });
        bot.play(4);
        bot.stop();
        for (const ev of bus.events) {
            expect(ev.publisher).toBe('presets');
        }
    });

    it('survives a missing eventBus without throwing', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        expect(() => bot.play()).not.toThrow();
    });
});

describe('buildLocationIndex', () => {
    it('maps every location to its region', () => {
        const staticData = {
            regions: new Map([
                ['Menu', { exits: [], locations: [] }],
                ['region_2_2', {
                    locations: [
                        { name: 'region_2_2__key_red_pickup__4_4', id: 1 },
                        { name: 'region_2_2__key_green_pickup__7_3', id: 2 },
                    ],
                }],
                ['region_3_2', {
                    locations: [{ name: 'region_3_2__key_blue_pickup__5_9', id: 3 }],
                }],
            ]),
        };
        const idx = buildLocationIndex(staticData);
        expect(idx.size).toBe(3);
        expect(idx.get('region_2_2__key_red_pickup__4_4')).toBe('region_2_2');
        expect(idx.get('region_2_2__key_green_pickup__7_3')).toBe('region_2_2');
        expect(idx.get('region_3_2__key_blue_pickup__5_9')).toBe('region_3_2');
    });

    it('skips regions without a locations array', () => {
        const staticData = {
            regions: new Map([
                ['Menu', { exits: [{ name: 'GameStart' }] }],   // no `locations`
                ['region_a', { locations: [{ name: 'Loc A' }] }],
            ]),
        };
        const idx = buildLocationIndex(staticData);
        expect(idx.size).toBe(1);
        expect(idx.get('Loc A')).toBe('region_a');
    });

    it('skips locations without a name', () => {
        const staticData = {
            regions: new Map([
                ['region_a', { locations: [
                    { name: 'Loc A', id: 1 },
                    { id: 2 },                  // unnamed — defensive
                    { name: 'Loc B', id: 3 },
                ] }],
            ]),
        };
        const idx = buildLocationIndex(staticData);
        expect(idx.size).toBe(2);
        expect(idx.get('Loc A')).toBe('region_a');
        expect(idx.get('Loc B')).toBe('region_a');
    });

    it('returns an empty Map when staticData has no regions', () => {
        expect(buildLocationIndex({}).size).toBe(0);
        expect(buildLocationIndex(null).size).toBe(0);
        expect(buildLocationIndex({ regions: null }).size).toBe(0);
    });
});

describe('buildSphereQueue', () => {
    function idx(...pairs) {
        return new Map(pairs);
    }

    it('flattens multi-sphere entries in order', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A', 'Loc B'] },
            { sphereIndex: 1, fractionalIndex: 0, locations: ['Loc C'] },
            { sphereIndex: 1, fractionalIndex: 1, locations: ['Loc D'] },
        ];
        const queue = buildSphereQueue(data, idx(
            ['Loc A', 'rA'], ['Loc B', 'rB'], ['Loc C', 'rC'], ['Loc D', 'rD'],
        ));
        expect(queue.map((e) => e.locationName)).toEqual(['Loc A', 'Loc B', 'Loc C', 'Loc D']);
        expect(queue.map((e) => e.regionName)).toEqual(['rA', 'rB', 'rC', 'rD']);
    });

    it('preserves sphereIndex / fractionalIndex on every entry', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 3, locations: ['Loc A'] },
        ];
        const queue = buildSphereQueue(data, idx(['Loc A', 'rA']));
        expect(queue[0]).toEqual({
            locationName: 'Loc A',
            regionName: 'rA',
            sphereIndex: 0,
            fractionalIndex: 3,
        });
    });

    it('drops locations whose region is not in the index', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 0, locations: ['Loc A', 'Mystery', 'Loc B'] },
        ];
        const queue = buildSphereQueue(data, idx(['Loc A', 'rA'], ['Loc B', 'rB']));
        expect(queue.map((e) => e.locationName)).toEqual(['Loc A', 'Loc B']);
    });

    it('skips entries without a locations array (e.g. metadata or empty sphere)', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 0 },         // no locations key
            { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
            { sphereIndex: 0, fractionalIndex: 2, locations: [] },
        ];
        const queue = buildSphereQueue(data, idx(['Loc A', 'rA']));
        expect(queue.map((e) => e.locationName)).toEqual(['Loc A']);
    });

    it('returns an empty queue for empty / invalid inputs', () => {
        expect(buildSphereQueue([], new Map())).toEqual([]);
        expect(buildSphereQueue(null, new Map())).toEqual([]);
        expect(buildSphereQueue([{ locations: ['x'] }], null)).toEqual([]);
    });
});

describe('PlaybackBotUI — destroy', () => {
    it('detaches from parent and nulls element', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, eventBus: makeFakeBus() });
        const parent = new FakeElement('div');
        parent.appendChild(bot.getElement());
        expect(parent.children.length).toBe(1);
        bot.destroy();
        expect(parent.children.length).toBe(0);
        expect(bot.getElement()).toBe(null);
    });
});
