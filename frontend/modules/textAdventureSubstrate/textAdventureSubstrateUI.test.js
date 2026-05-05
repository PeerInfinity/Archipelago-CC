import { describe, it, expect, beforeEach } from 'vitest';

import {
    TextAdventureSubstrateUI,
    groupExitsByCell,
    formatExitShorthand,
    formatLocationShorthand,
    formatFlatExitShorthand,
} from './textAdventureSubstrateUI.js';
import {
    _testOnly_resetModuleState, _testOnly_setSettings, _testOnly_setCustomData,
} from './index.js';

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

describe('groupExitsByCell', () => {
    it('returns empty buckets for null / undefined / empty input', () => {
        expect(groupExitsByCell(null)).toEqual({ N: [], E: [], S: [], W: [], C: [] });
        expect(groupExitsByCell(undefined)).toEqual({ N: [], E: [], S: [], W: [], C: [] });
        expect(groupExitsByCell([])).toEqual({ N: [], E: [], S: [], W: [], C: [] });
    });

    it('routes each exit to its compass bucket by side', () => {
        const exits = [
            { exit_id: 'n1', side: 'N' },
            { exit_id: 'e1', side: 'E' },
            { exit_id: 's1', side: 'S' },
            { exit_id: 'w1', side: 'W' },
        ];
        const cells = groupExitsByCell(exits);
        expect(cells.N).toEqual([exits[0]]);
        expect(cells.E).toEqual([exits[1]]);
        expect(cells.S).toEqual([exits[2]]);
        expect(cells.W).toEqual([exits[3]]);
        expect(cells.C).toEqual([]);
    });

    it('routes null / undefined / unknown sides to the center cell', () => {
        const exits = [
            { exit_id: 'tele', side: null },
            { exit_id: 'noside' },
            { exit_id: 'weird', side: 'NW' },
        ];
        const cells = groupExitsByCell(exits);
        expect(cells.C).toEqual(exits);
        expect(cells.N).toEqual([]);
    });

    it('preserves input order within a cell', () => {
        const exits = [
            { exit_id: 'n1', side: 'N' },
            { exit_id: 'n2', side: 'N' },
            { exit_id: 'n3', side: 'N' },
        ];
        const cells = groupExitsByCell(exits);
        expect(cells.N.map((e) => e.exit_id)).toEqual(['n1', 'n2', 'n3']);
    });

    it('accepts a Map.values() iterable directly', () => {
        const map = new Map([
            ['a', { exit_id: 'a', side: 'N' }],
            ['b', { exit_id: 'b', side: 'S' }],
        ]);
        const cells = groupExitsByCell(map.values());
        expect(cells.N.map((e) => e.exit_id)).toEqual(['a']);
        expect(cells.S.map((e) => e.exit_id)).toEqual(['b']);
    });
});

describe('formatExitShorthand / formatLocationShorthand', () => {
    it('drops the digit when there is exactly one entry', () => {
        expect(formatExitShorthand('N', 0, 1)).toBe('n');
        expect(formatExitShorthand('E', 0, 1)).toBe('e');
        expect(formatExitShorthand('C', 0, 1)).toBe('c');
        expect(formatLocationShorthand(0, 1)).toBe('l');
    });

    it('emits letter+1-based-index when there are multiple', () => {
        expect(formatExitShorthand('N', 0, 3)).toBe('n1');
        expect(formatExitShorthand('N', 1, 3)).toBe('n2');
        expect(formatExitShorthand('N', 2, 3)).toBe('n3');
        expect(formatLocationShorthand(0, 4)).toBe('l1');
        expect(formatLocationShorthand(3, 4)).toBe('l4');
    });

    it('returns empty string for unknown cell letters', () => {
        expect(formatExitShorthand('X', 0, 1)).toBe('');
    });

    it('formatFlatExitShorthand uses x prefix and drops digit when single', () => {
        expect(formatFlatExitShorthand(0, 1)).toBe('x');
        expect(formatFlatExitShorthand(0, 3)).toBe('x1');
        expect(formatFlatExitShorthand(2, 3)).toBe('x3');
    });
});

describe('TextAdventureSubstrateUI — standalone mode integration', () => {
    beforeEach(() => { _testOnly_resetModuleState(); resetDiscoverySingleton(); });

    function makeStandaloneRegion({ name = 'Foo', exits = [], locations = [] } = {}) {
        return { name, exits, locations };
    }

    it('applyStandaloneRegion synthesizes a world with mode=standalone', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const region = makeStandaloneRegion({
            name: 'Overworld',
            exits: [
                { name: 'east_door', connected_region: 'Cave' },
                { name: 'north_path', connected_region: 'Forest' },
            ],
            locations: [
                { name: 'Slay Yorgle', item: { name: 'Sword' } },
            ],
        });
        panel.applyStandaloneRegion('Overworld', region, null);

        expect(panel.currentRegionId).toBe('Overworld');
        expect(panel.world.mode).toBe('standalone');
        expect(panel.world.exits.size).toBe(2);
        expect(panel.world.itemLocationNames.get('loc:0')).toBe('Slay Yorgle');
    });

    it('standalone exits all bucket into C so x<n> resolves them', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const region = makeStandaloneRegion({
            name: 'X',
            exits: [
                { name: 'a', connected_region: 'A' },
                { name: 'b', connected_region: 'B' },
            ],
        });
        panel.applyStandaloneRegion('X', region, null);
        const ctx = panel._buildCommandContext();
        expect(ctx.exitsBySide.N).toEqual([]);
        expect(ctx.exitsBySide.E).toEqual([]);
        expect(ctx.exitsBySide.C.map((e) => e.exit_id)).toEqual(['a', 'b']);
    });

    it('standalone _isExitOpen evaluates exit access_rule via the rule engine', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const region = makeStandaloneRegion({
            name: 'X',
            exits: [
                { name: 'open', connected_region: 'A' },
                { name: 'closed', connected_region: 'B', access_rule: { Has: ['key'] } },
            ],
        });
        panel.applyStandaloneRegion('X', region, null);
        // No state manager available in headless test → rule evaluator
        // returns null → _evaluateAccessRule defaults to true.
        expect(panel._isExitOpen(panel.world.exits.get('open'))).toBe(true);
        expect(panel._isExitOpen(panel.world.exits.get('closed'))).toBe(true);
    });

    it('standalone parser shorthand x routes through _handleSubmit', () => {
        const dispatcherCalls = [];
        TextAdventureSubstrateUI.setModuleApis({
            eventBus: null,
            dispatcher: { publish: (event, data) => dispatcherCalls.push({ event, data }) },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        const region = makeStandaloneRegion({
            name: 'X',
            exits: [
                { name: 'first', connected_region: 'A' },
                { name: 'second', connected_region: 'B' },
            ],
        });
        panel.applyStandaloneRegion('X', region, null);
        panel._handleSubmit('x2');

        const move = dispatcherCalls.find((c) => c.event === 'user:regionMove');
        expect(move).toBeDefined();
        expect(move.data.targetRegion).toBe('B');
        expect(move.data.exitName).toBe('second');
    });
});

describe('TextAdventureSubstrateUI — _buildCommandContext', () => {
    beforeEach(() => { _testOnly_resetModuleState(); resetDiscoverySingleton(); });

    it('groups exits by side and excludes already-checked locations', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [
                { exit_id: 'n1', side: 'N', exitName: 'go_n1', targetRegion: 'A' },
                { exit_id: 's1', side: 'S', exitName: 'go_s1', targetRegion: 'B' },
                { exit_id: 'tele', side: null, exitName: 'go_tele', targetRegion: 'C' },
            ],
            items: [
                { x: 1, y: 1, id: 'sword', locationName: 'Slay Yorgle' },
                { x: 2, y: 2, id: 'key', locationName: 'Bridge Key' },
            ],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel.checkedLocations = new Set(['Slay Yorgle']);

        const ctx = panel._buildCommandContext();
        expect(ctx.exitsBySide.N.map((e) => e.exit_id)).toEqual(['n1']);
        expect(ctx.exitsBySide.S.map((e) => e.exit_id)).toEqual(['s1']);
        expect(ctx.exitsBySide.C.map((e) => e.exit_id)).toEqual(['tele']);
        expect(ctx.locations.map((l) => l.locationName)).toEqual(['Bridge Key']);
    });
});

describe('TextAdventureSubstrateUI — _handleSubmit', () => {
    beforeEach(() => { _testOnly_resetModuleState(); resetDiscoverySingleton(); });

    it('dispatches user:regionMove for shorthand "n"', () => {
        const dispatcherCalls = [];
        TextAdventureSubstrateUI.setModuleApis({
            eventBus: null,
            dispatcher: { publish: (event, data) => dispatcherCalls.push({ event, data }) },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{
                exit_id: 'north', x: 5, y: 0, side: 'N',
                exitName: 'north_to_field', targetRegion: 'Field',
            }],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel._handleSubmit('n');

        const move = dispatcherCalls.find((c) => c.event === 'user:regionMove');
        expect(move).toBeDefined();
        expect(move.data.targetRegion).toBe('Field');
    });

    it('dispatches user:locationCheck for shorthand "l"', () => {
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
        panel._handleSubmit('l');

        const check = dispatcherCalls.find((c) => c.event === 'user:locationCheck');
        expect(check).toBeDefined();
        expect(check.data.locationName).toBe('Slay Yorgle');
    });

    it('look verb is silent (no message added)', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({});
        panel.applyLoadedRegion({ region_id: 'Empty', world, arrivedFrom: null });
        const before = panel.messageHistory.length;
        panel._handleSubmit('look');
        expect(panel.messageHistory.length).toBe(before);
    });

    it('inventory verb adds an inventory line to message history', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({ region_id: 'X', world: makeWorld({}), arrivedFrom: null });
        panel.inventory = new Set(['sword', 'key']);
        panel._handleSubmit('inventory');
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toContain('inventory');
    });

    it('error from parser is surfaced to the message history', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({ region_id: 'X', world: makeWorld({}), arrivedFrom: null });
        panel._handleSubmit('xyzzy');
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toContain('Unrecognized');
    });

    it('empty submission is ignored', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({ region_id: 'X', world: makeWorld({}), arrivedFrom: null });
        const before = panel.messageHistory.length;
        panel._handleSubmit('');
        panel._handleSubmit('   ');
        expect(panel.messageHistory.length).toBe(before);
    });
});

describe('TextAdventureSubstrateUI — message history limit honors settings', () => {
    beforeEach(() => { _testOnly_resetModuleState(); });

    it('caps history at the configured messageHistoryLimit', () => {
        _testOnly_setSettings({ messageHistoryLimit: 3 });
        const panel = new TextAdventureSubstrateUI(null, {});
        for (let i = 0; i < 10; i++) panel._addMessage(`m${i}`);
        expect(panel.messageHistory.length).toBe(3);
        expect(panel.messageHistory[0].html).toContain('m7');
        expect(panel.messageHistory[2].html).toContain('m9');
    });

    it('falls back to default when setting is unset', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        for (let i = 0; i < 30; i++) panel._addMessage(`m${i}`);
        // Default is 10 (from SETTINGS_DEFAULTS).
        expect(panel.messageHistory.length).toBe(10);
    });
});

describe('TextAdventureSubstrateUI — custom data integration', () => {
    beforeEach(() => { _testOnly_resetModuleState(); });

    it('arrival message uses custom enterMessage when one is configured', () => {
        _testOnly_setCustomData({
            regions: { Overworld: { enterMessage: 'A custom welcome to {regionName}!' } },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'Overworld', world: makeWorld({}), arrivedFrom: null,
        });
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toBe('A custom welcome to Overworld!');
    });

    it('arrival falls back to generic message when no enterMessage is configured', () => {
        _testOnly_setCustomData({ regions: {} });
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'Overworld', world: makeWorld({}), arrivedFrom: null,
        });
        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toContain('You are now in Overworld');
    });

    it('location check uses custom checkMessage with item highlighting', () => {
        const dispatcherCalls = [];
        TextAdventureSubstrateUI.setModuleApis({
            eventBus: null,
            dispatcher: { publish: (event, data) => dispatcherCalls.push({ event, data }) },
        });
        _testOnly_setCustomData({
            locations: {
                'Slay Yorgle': {
                    checkMessage: 'Search {locationName}: {item}',
                },
            },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            items: [{ x: 2, y: 2, id: 'sword', locationName: 'Slay Yorgle' }],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel._onLocationClick('Slay Yorgle');

        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toBe('Search Slay Yorgle: <span class="item-name">sword</span>');
    });

    it('location check uses custom inaccessibleMessage when blocked', () => {
        _testOnly_setCustomData({
            locations: { Locked: { inaccessibleMessage: 'No way to {locationName}.' } },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            items: [{ x: 2, y: 2, id: 'sword', locationName: 'Locked' }],
            obstacles: [{ x: 2, y: 2, id: 'door' }],
            obstacleLib: { door: { id: 'door', clear_set: [['key']] } },
        });
        panel.applyLoadedRegion({ region_id: 'X', world, arrivedFrom: null });
        panel.inventory = new Set();
        panel._onLocationClick('Locked');

        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toBe('No way to Locked.');
    });

    it('location click uses custom alreadyCheckedMessage', () => {
        _testOnly_setCustomData({
            locations: { 'Slay Yorgle': { alreadyCheckedMessage: 'Done with {locationName} already.' } },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            items: [{ x: 2, y: 2, id: 'sword', locationName: 'Slay Yorgle' }],
        });
        panel.applyLoadedRegion({ region_id: 'X', world, arrivedFrom: null });
        panel.checkedLocations = new Set(['Slay Yorgle']);
        panel._onLocationClick('Slay Yorgle');

        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toBe('Done with Slay Yorgle already.');
    });

    it('exit click prepends custom moveMessage before publishing', () => {
        const dispatcherCalls = [];
        TextAdventureSubstrateUI.setModuleApis({
            eventBus: null,
            dispatcher: { publish: (event, data) => dispatcherCalls.push({ event, data }) },
        });
        _testOnly_setCustomData({
            exits: { go_east: { moveMessage: 'Trekking {exitName} to {destinationRegion}.' } },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{ exit_id: 'east', x: 5, y: 3, side: 'E', exitName: 'go_east', targetRegion: 'Cave' }],
        });
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        panel._onExitClick('east');

        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toBe('Trekking go_east to Cave.');
        const move = dispatcherCalls.find((c) => c.event === 'user:regionMove');
        expect(move).toBeDefined();
    });

    it('exit click uses custom inaccessibleMessage when blocked', () => {
        _testOnly_setCustomData({
            exits: { east_door: { inaccessibleMessage: '{exitName} requires a key.' } },
        });
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({
            exits: [{ exit_id: 'east', x: 5, y: 3, side: 'E', exitName: 'east_door', targetRegion: 'Cave' }],
            obstacles: [{ x: 5, y: 3, id: 'door_red' }],
            obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
        });
        panel.applyLoadedRegion({ region_id: 'X', world, arrivedFrom: null });
        panel.inventory = new Set();
        panel._onExitClick('east');

        const last = panel.messageHistory[panel.messageHistory.length - 1];
        expect(last.html).toBe('east_door requires a key.');
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

describe('TextAdventureSubstrateUI — loop-mode mana hooks (Phase 4)', () => {
    // Local imports for the gameState singleton helpers — kept inside
    // the describe block so they don't disturb the test file's
    // top-level imports.
    let createGameStateSingleton, _testOnly_resetGameStateSingleton;
    beforeEach(async () => {
        ({ createGameStateSingleton, _testOnly_resetGameStateSingleton } =
            await import('../gameState/singleton.js'));
        _testOnly_resetGameStateSingleton();
        _testOnly_resetModuleState();
    });

    function makeStubCostDataManager({
        loaded = true,
        regionCosts = {},
        locationCosts = {},
    } = {}) {
        return {
            isLoaded: () => loaded,
            getRegionCost: (name) => regionCosts[name] ?? 50,
            getLocationCost: (name) => locationCosts[name] ?? 10,
        };
    }

    function makeManaPanel({ manaEnabled = true, costData = makeStubCostDataManager() } = {}) {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = makeWorld({});
        world.manaEnabled = manaEnabled;
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        // Inject the stub directly; bypasses centralRegistry lookup.
        panel._costDataManager = costData;
        return panel;
    }

    it('_shouldDeductMana is true when manaEnabled and loop mode is inactive', () => {
        const panel = makeManaPanel({ manaEnabled: true });
        panel._isLoopModeActive = false;
        expect(panel._shouldDeductMana()).toBe(true);
    });

    it('_shouldDeductMana is false when loop mode is active', () => {
        const panel = makeManaPanel({ manaEnabled: true });
        panel._isLoopModeActive = true;
        expect(panel._shouldDeductMana()).toBe(false);
    });

    it('_shouldDeductMana is false when manaEnabled is off', () => {
        const panel = makeManaPanel({ manaEnabled: false });
        panel._isLoopModeActive = false;
        expect(panel._shouldDeductMana()).toBe(false);
    });

    it('_getLocationCost reads from costDataManager when loaded', () => {
        const panel = makeManaPanel({
            costData: makeStubCostDataManager({ locationCosts: { 'Slay Yorgle': 25 } }),
        });
        expect(panel._getLocationCost('Slay Yorgle')).toBe(25);
        expect(panel._getLocationCost('Unknown')).toBe(10); // default
    });

    it('_getLocationCost falls back to 10 when costDataManager is not loaded', () => {
        const panel = makeManaPanel({ costData: makeStubCostDataManager({ loaded: false }) });
        expect(panel._getLocationCost('Slay Yorgle')).toBe(10);
    });

    it('_getRegionMoveCost reads from costDataManager when loaded', () => {
        const panel = makeManaPanel({
            costData: makeStubCostDataManager({ regionCosts: { 'Overworld': 30 } }),
        });
        expect(panel._getRegionMoveCost('Overworld')).toBe(30);
        expect(panel._getRegionMoveCost('Other')).toBe(50); // default
    });

    it('_deductLocationCheckMana subtracts from gameState mana', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = makeManaPanel({
            costData: makeStubCostDataManager({ locationCosts: { 'A': 10, 'B': 20 } }),
        });
        panel._deductLocationCheckMana(['A', 'B']);
        expect(gs.getCurrentMana()).toBe(70); // 100 - 10 - 20
    });

    it('_deductRegionMoveMana subtracts source region cost', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = makeManaPanel({
            costData: makeStubCostDataManager({ regionCosts: { 'Overworld': 25 } }),
        });
        panel._deductRegionMoveMana('Overworld');
        expect(gs.getCurrentMana()).toBe(75);
    });

    it('does not deduct mana when manaEnabled is off (via _shouldDeductMana gate)', () => {
        // Sanity check: if a caller respects _shouldDeductMana, no
        // deduction happens. (The actual gating in production lives in
        // the snapshot/region-change handlers; this verifies the gate.)
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = makeManaPanel({ manaEnabled: false });
        if (panel._shouldDeductMana()) {
            panel._deductLocationCheckMana(['A']);
        }
        expect(gs.getCurrentMana()).toBe(100);
    });
});
