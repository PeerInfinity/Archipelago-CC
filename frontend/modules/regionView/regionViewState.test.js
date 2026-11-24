/**
 * Pins for the region view state wrapper (region map step 2, D2): it recomputes at most once per frame however many
 * triggers fire, re-reads the discovery settings on a discovery trigger, freezes what it hands out, folds display
 * groups, and `dispose()` leaves no subscription behind.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => rule.ok }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));

const { createRegionViewState, REGION_VIEW_TRIGGERS } = await import('./regionViewState.js');

function fakeBus() {
    const subs = new Map();
    return {
        subs,
        subscribe(event, fn, owner) {
            if (!subs.has(event)) subs.set(event, new Set());
            const rec = { fn, owner };
            subs.get(event).add(rec);
            return () => subs.get(event).delete(rec);
        },
        publish(event, data) { for (const r of [...(subs.get(event) ?? [])]) r.fn(data); },
        count: () => [...subs.values()].reduce((n, s) => n + s.size, 0),
    };
}

function fakeFrames() {
    const queue = [];
    return {
        schedule: (fn) => { queue.push(fn); return { id: queue.length }; },
        cancel: () => { queue.length = 0; },
        run() { const q = queue.splice(0); q.forEach((fn) => fn()); return q.length; },
        get pending() { return queue.length; },
    };
}

const staticData = {
    regions: new Map([
        ['Menu', { locations: [], exits: [{ name: 'Start', connected_region: 'level_0__a' }] }],
        ['level_0__a', { locations: [{ name: 'x' }], exits: [{ name: 'down', connected_region: 'level_0__b' }] }],
        ['level_0__b', { locations: [{ name: 'y', access_rule: { ok: false } }], exits: [{ name: 'up', connected_region: 'level_0__a' }] }],
    ]),
};

function setup({ settingsValues = {} } = {}) {
    let snapshot = { regionReachability: { Menu: true, level_0__a: true, level_0__b: true }, checkedLocations: [] };
    const bus = fakeBus();
    const frames = fakeFrames();
    const discovered = new Set(['Menu']);
    const settings = { getSetting: async (k, d) => (k in settingsValues ? settingsValues[k] : d) };
    const state = createRegionViewState({
        stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => snapshot },
        eventBus: bus,
        discovery: {
            isRegionDiscovered: (r) => discovered.has(r), isLocationDiscovered: () => false, isExitDiscovered: () => false,
        },
        gameState: { getCurrentRegion: () => 'level_0__b', getPath: () => [{ type: 'regionMove', region: 'Menu' }] },
        registry: { get: (id) => (id === 'seedling' ? { compositeMap: { displayRegionOf: (n) => n.split('__')[0] } } : null) },
        settings,
        getRules: () => ({ rules: { preset_sidecars: { 1: [
            { region_id: 'level_0__a', substrate: 'seedling' }, { region_id: 'level_0__b', substrate: 'seedling' },
        ] } }, playerId: '1' }),
        schedule: frames.schedule,
        cancel: frames.cancel,
    });
    return { state, bus, frames, setSnapshot: (s) => { snapshot = s; }, discovered };
}

describe('createRegionViewState', () => {
    it('subscribes to every trigger and folds display groups', async () => {
        const { state, bus } = setup();
        expect([...bus.subs.keys()].sort()).toEqual([...REGION_VIEW_TRIGGERS].sort());
        await state.ready();
        const v = state.get();
        expect(v.regions.get('level_0__a')).toMatchObject({ reachable: true, color: 'accessible', displayKey: 'level_0', visibility: 'shown' });
        expect([...v.displayGroups.keys()]).toEqual(['Menu', 'level_0']);
        expect(v.displayGroups.get('level_0')).toMatchObject({ members: ['level_0__a', 'level_0__b'], reachable: true,
            counts: { total: 2, accessible: 1, inaccessible: 1 } });
        expect(v.currentRegion).toBe('level_0__b');
        expect(v.currentDisplayRegion).toBe('level_0');
        expect(v.locations.get('y')).toMatchObject({ region: 'level_0__b', state: 'inaccessible' });
        expect(v.exits.map((e) => `${e.from}>${e.to}:${e.reverseName}`)).toEqual(['Menu>level_0__a:null',
            'level_0__a>level_0__b:up', 'level_0__b>level_0__a:down']);
        expect(Object.isFrozen(v)).toBe(true);
        expect(Object.isFrozen(v.regions.get('Menu'))).toBe(true);
        expect(() => v.regions.set('z', {})).toThrow();
    });

    it('coalesces a burst of triggers into ONE recompute per frame', async () => {
        const { state, bus, frames } = setup();
        await state.ready();
        frames.run();
        const seen = [];
        state.subscribe((v) => seen.push(v.version));
        for (let i = 0; i < 5; i++) bus.publish('stateManager:snapshotUpdated', {});
        bus.publish('gameState:regionChanged', {});
        bus.publish('gameState:pathUpdated', {});
        expect(frames.pending).toBe(1);
        frames.run();
        expect(seen).toHaveLength(1);
        bus.publish('stateManager:snapshotUpdated', {});
        frames.run();
        expect(seen).toHaveLength(2);
        expect(seen[1]).toBe(seen[0] + 1);
    });

    it('a discovery trigger re-reads the discovery settings before recomputing', async () => {
        const values = { 'moduleSettings.discovery.enableDiscoveryMode': false };
        const { state, bus, frames } = setup({ settingsValues: values });
        await state.ready();
        frames.run();
        expect(state.get().discoveryActive).toBe(false);
        values['moduleSettings.discovery.enableDiscoveryMode'] = true;
        bus.publish('settings:changed', { key: 'moduleSettings.discovery.enableDiscoveryMode' });
        await state.ready();
        frames.run();
        const v = state.get();
        expect(v.discoveryActive).toBe(true);
        expect(v.regions.get('level_0__a').visibility).toBe('placeholder');
        expect(v.regions.get('level_0__b').visibility).toBe('hidden');
        expect(v.displayGroups.get('level_0').visibility).toBe('placeholder');
    });

    it('dispose() unsubscribes everything and drops a pending frame', async () => {
        const { state, bus, frames } = setup();
        await state.ready();
        const fn = vi.fn();
        state.subscribe(fn);
        bus.publish('stateManager:snapshotUpdated', {});
        state.dispose();
        expect(bus.count()).toBe(0);
        frames.run();
        bus.publish('stateManager:snapshotUpdated', {});
        expect(frames.pending).toBe(0);
        expect(fn).not.toHaveBeenCalled();
    });
});
