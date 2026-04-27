import { describe, it, expect, beforeEach } from 'vitest';

import { TextAdventureSubstrateUI } from './textAdventureSubstrateUI.js';
import { _testOnly_resetModuleState } from './index.js';

// Vitest runs under the 'node' environment (no DOM). The panel's
// constructor guards document access for exactly this reason — these
// tests verify the non-rendering behaviour. DOM rendering checks are
// deferred to step 6's browser smoke test.

describe('TextAdventureSubstrateUI — skeleton', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
    });

    it('constructs without DOM and starts with no region loaded', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        expect(panel.world).toBeNull();
        expect(panel.currentRegionId).toBeNull();
        expect(panel.arrivedFromExitId).toBeNull();
    });

    it('stashes the region payload via applyLoadedRegion', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = { exits: new Map(), items: new Map() };
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world,
            arrivedFrom: { exit_id: 'east_to_kitchen' },
        });
        expect(panel.world).toBe(world);
        expect(panel.currentRegionId).toBe('Overworld');
        expect(panel.arrivedFromExitId).toBe('east_to_kitchen');
    });

    it('handles a payload with no arrivedFrom', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world: { exits: new Map(), items: new Map() },
            arrivedFrom: null,
        });
        expect(panel.arrivedFromExitId).toBeNull();
    });

    it('applies multiple region transitions in order', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({ region_id: 'A', world: {}, arrivedFrom: null });
        expect(panel.currentRegionId).toBe('A');
        panel.applyLoadedRegion({ region_id: 'B', world: {}, arrivedFrom: { exit_id: 'A_back' } });
        expect(panel.currentRegionId).toBe('B');
        expect(panel.arrivedFromExitId).toBe('A_back');
    });
});

// World fixture helpers for the v1-feature tests below. Returns a
// minimal tile-grid world the panel can read without needing a real
// generation pass.
function makeWorld({
    exits = [],
    items = [],
    obstacles = [],
    obstacleLib = {},
} = {}) {
    const world = {
        exits: new Map(exits.map((e) => [e.exit_id, e])),
        items: new Map(items.map((i) => [`${i.x},${i.y}`, i.id])),
        obstacles: new Map(obstacles.map((o) => [`${o.x},${o.y}`, o.id])),
        obstacleLib,
        itemLocationNames: new Map(items.filter((i) => i.locationName)
            .map((i) => [`${i.x},${i.y}`, i.locationName])),
    };
    return world;
}

describe('TextAdventureSubstrateUI — arrival messages', () => {
    beforeEach(() => { _testOnly_resetModuleState(); });

    it('uses generic message when arrivedFrom is missing', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({});
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toBe('You are now in Overworld.');
    });

    it('renders compass direction + source region when arrivedFrom resolves', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{ exit_id: 'back', x: 0, y: 3, side: 'W', targetRegion: 'Cave' }],
        });
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world,
            arrivedFrom: { exit_id: 'back' },
        });
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toContain('Overworld');
        expect(last.html).toContain('Cave');
        expect(last.html).toContain('west');
    });

    it('falls back to generic when arrivedFrom does not resolve to an exit', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({});
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world,
            arrivedFrom: { exit_id: 'nonexistent' },
        });
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toContain('You are now in Overworld');
    });
});

describe('TextAdventureSubstrateUI — accessibility lookups', () => {
    beforeEach(() => { _testOnly_resetModuleState(); });

    it('marks an exit with no obstacle as open', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{ exit_id: 'east', x: 5, y: 3, side: 'E', targetRegion: 'Cave' }],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        expect(panel._isExitOpen(world.exits.get('east'))).toBe(true);
    });

    it('marks an exit with a satisfied combo-list door as open', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{ exit_id: 'east', x: 5, y: 3, side: 'E', targetRegion: 'Cave' }],
            obstacles: [{ x: 5, y: 3, id: 'door_red' }],
            obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel.inventory = new Set(['key_red']);
        expect(panel._isExitOpen(world.exits.get('east'))).toBe(true);
    });

    it('marks an exit with an unsatisfied door as closed', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{ exit_id: 'east', x: 5, y: 3, side: 'E', targetRegion: 'Cave' }],
            obstacles: [{ x: 5, y: 3, id: 'door_red' }],
            obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel.inventory = new Set();
        expect(panel._isExitOpen(world.exits.get('east'))).toBe(false);
    });
});

describe('TextAdventureSubstrateUI — click dispatch', () => {
    beforeEach(() => { _testOnly_resetModuleState(); });

    it('publishes user:regionMove on accessible exit click', () => {
        const dispatcherCalls = [];
        const dispatcher = {
            publish: (event, data, opts) => dispatcherCalls.push({ event, data, opts }),
        };
        TextAdventureSubstrateUI.setModuleApis({ eventBus: null, dispatcher });

        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{
                exit_id: 'east', x: 5, y: 3, side: 'E',
                exitName: 'east_to_cave', targetRegion: 'Cave',
            }],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel._onExitClick('east');

        const move = dispatcherCalls.find((c) => c.event === 'user:regionMove');
        expect(move).toBeDefined();
        expect(move.data).toEqual({
            sourceRegion: 'Overworld',
            targetRegion: 'Cave',
            exitName: 'east_to_cave',
        });
    });

    it('does not publish for a closed exit; logs a blocked message instead', () => {
        const dispatcherCalls = [];
        TextAdventureSubstrateUI.setModuleApis({
            eventBus: null,
            dispatcher: { publish: (event, data) => dispatcherCalls.push({ event, data }) },
        });

        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{ exit_id: 'east', x: 5, y: 3, side: 'E', targetRegion: 'Cave' }],
            obstacles: [{ x: 5, y: 3, id: 'door_red' }],
            obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel.inventory = new Set();
        panel._onExitClick('east');

        expect(dispatcherCalls.find((c) => c.event === 'user:regionMove')).toBeUndefined();
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toContain('blocked');
    });

    it('publishes user:locationCheck on unchecked location click', () => {
        const dispatcherCalls = [];
        TextAdventureSubstrateUI.setModuleApis({
            eventBus: null,
            dispatcher: { publish: (event, data) => dispatcherCalls.push({ event, data }) },
        });

        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            items: [{ x: 2, y: 2, id: 'sword', locationName: 'Slay Yorgle' }],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel._onLocationClick('Slay Yorgle');

        const check = dispatcherCalls.find((c) => c.event === 'user:locationCheck');
        expect(check).toBeDefined();
        expect(check.data).toEqual({
            locationName: 'Slay Yorgle',
            regionName: 'Overworld',
        });
    });

    it('does not publish for an already-checked location', () => {
        const dispatcherCalls = [];
        TextAdventureSubstrateUI.setModuleApis({
            eventBus: null,
            dispatcher: { publish: (event, data) => dispatcherCalls.push({ event, data }) },
        });

        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            items: [{ x: 2, y: 2, id: 'sword', locationName: 'Slay Yorgle' }],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel.checkedLocations = new Set(['Slay Yorgle']);
        panel._onLocationClick('Slay Yorgle');

        expect(dispatcherCalls.find((c) => c.event === 'user:locationCheck')).toBeUndefined();
    });
});

describe('TextAdventureSubstrateUI — message history', () => {
    beforeEach(() => { _testOnly_resetModuleState(); });

    it('caps history at the message-history limit', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        for (let i = 0; i < 30; i++) panel._addMessage(`Message ${i}`);
        expect(panel.messageHistory.length).toBe(10);
        // Oldest dropped, newest retained.
        expect(panel.messageHistory[0].html).toContain('Message 20');
        expect(panel.messageHistory[9].html).toContain('Message 29');
    });

    it('escapes HTML in plain message strings', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel._addMessage('Hello <script>alert(1)</script>');
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).not.toContain('<script>');
        expect(last.html).toContain('&lt;script&gt;');
    });
});

// Discovery-mode tests. discoveryStateSingleton is shared across tests
// (it's a module-level singleton); the helper resets it before each
// test in this section so prior runs' marks don't leak.
import discoveryStateSingleton from '../discovery/singleton.js';

function resetDiscoverySingleton() {
    discoveryStateSingleton.discoveredRegions.clear();
    discoveryStateSingleton.discoveredLocations.clear();
    discoveryStateSingleton.discoveredExits.clear();
    // Inject a minimal eventBus so the discover* mutators run (they
    // early-return when eventBus is null).
    discoveryStateSingleton.eventBus = { publish: () => {} };
}

describe('TextAdventureSubstrateUI — discovery population', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('marks every location and exit on region entry', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world: makeWorld({
                exits: [
                    { exit_id: 'east', x: 5, y: 3, side: 'E', exitName: 'east_to_cave', targetRegion: 'Cave' },
                    { exit_id: 'west', x: 0, y: 3, side: 'W', exitName: 'west_to_castle', targetRegion: 'Castle' },
                ],
                items: [
                    { x: 2, y: 2, id: 'sword', locationName: 'Slay Yorgle' },
                    { x: 4, y: 4, id: 'key_red', locationName: 'Bridge Key' },
                ],
            }),
            arrivedFrom: null,
        });

        expect(discoveryStateSingleton.isLocationDiscovered('Slay Yorgle')).toBe(true);
        expect(discoveryStateSingleton.isLocationDiscovered('Bridge Key')).toBe(true);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'east_to_cave')).toBe(true);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'west_to_castle')).toBe(true);
    });

    it('handles a region with no items / exits without crashing', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        expect(() => {
            panel.applyLoadedRegion({
                region_id: 'Empty',
                world: makeWorld({}),
                arrivedFrom: null,
            });
        }).not.toThrow();
    });

    it('discovery state changes survive subsequent region transitions', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'A',
            world: makeWorld({
                items: [{ x: 1, y: 1, id: 'x', locationName: 'Loc A' }],
            }),
            arrivedFrom: null,
        });
        panel.applyLoadedRegion({
            region_id: 'B',
            world: makeWorld({
                items: [{ x: 2, y: 2, id: 'y', locationName: 'Loc B' }],
            }),
            arrivedFrom: null,
        });
        expect(discoveryStateSingleton.isLocationDiscovered('Loc A')).toBe(true);
        expect(discoveryStateSingleton.isLocationDiscovered('Loc B')).toBe(true);
    });
});

describe('TextAdventureSubstrateUI — discovery filtering helpers', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('shows everything when discovery mode is off, even if not discovered', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.discoveryModeActive = false;
        panel.currentRegionId = 'Overworld';
        const exit = { exit_id: 'east', side: 'E', exitName: 'east', targetRegion: 'Cave' };
        expect(panel._isExitVisibleToUI(exit)).toBe(true);
        expect(panel._isLocationVisibleToUI('Slay Yorgle')).toBe(true);
    });

    it('hides undiscovered exits when discovery mode is on', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.discoveryModeActive = true;
        panel.currentRegionId = 'Overworld';
        const exit = { exit_id: 'east', side: 'E', exitName: 'east', targetRegion: 'Cave' };
        expect(panel._isExitVisibleToUI(exit)).toBe(false);
        // Once discovered, it shows.
        discoveryStateSingleton.discoverExit('Overworld', 'east');
        expect(panel._isExitVisibleToUI(exit)).toBe(true);
    });

    it('hides undiscovered locations when discovery mode is on', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.discoveryModeActive = true;
        panel.currentRegionId = 'Overworld';
        expect(panel._isLocationVisibleToUI('Slay Yorgle')).toBe(false);
        discoveryStateSingleton.discoverLocation('Slay Yorgle');
        expect(panel._isLocationVisibleToUI('Slay Yorgle')).toBe(true);
    });
});
