import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MazeRoomUI } from './mazeRoomUI.js';
import { _testOnly_resetModuleState } from './index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { ACTION_MOVE, ACTION_WAIT, ACTION_LOCATION_CHECK } from './mazeRoomQueue.js';
import {
    getSavedQueues,
    saveQueue,
    _testOnly_clearAll as _resetSavedQueueStore,
} from '../loops/savedQueueStore.js';
import { hashRulesData, clearRulesHashCache } from '../shared/rulesHash.js';

// Vitest runs under the 'node' environment (no DOM). The panel's
// constructor guards document access for exactly this reason — these
// tests verify the non-rendering behaviour. DOM rendering checks are
// deferred to browser smoke tests.

// --- Fixture helpers ---

// Minimal tile-grid world the panel can read without a real generation
// pass. Shape mirrors what mazeRoomEngine produces (exits/items as
// Maps keyed in the panel's expected style; world.entrance for
// createState; world.{width,height} for fog visibility bounds).
function makeWorld({
    width = 8,
    height = 6,
    entrance = { x: 0, y: 0 },
    exits = [],
    items = [],
    obstacles = [],
    obstacleLib = {},
} = {}) {
    return {
        width,
        height,
        entrance,
        exits: new Map(exits.map((e) => [e.exit_id, e])),
        items: new Map(items.map((i) => [`${i.x},${i.y}`, i.id])),
        obstacles: new Map(obstacles.map((o) => [`${o.x},${o.y}`, o.id])),
        obstacleLib,
        itemLocationNames: new Map(items.filter((i) => i.locationName)
            .map((i) => [`${i.x},${i.y}`, i.locationName])),
    };
}

// discoveryStateSingleton is a module-level singleton — clear its
// internal sets between tests so prior runs' marks don't leak. Inject
// a no-op eventBus because the discover* mutators early-return when
// eventBus is null.
function resetDiscoverySingleton() {
    discoveryStateSingleton.discoveredRegions.clear();
    discoveryStateSingleton.discoveredLocations.clear();
    discoveryStateSingleton.discoveredExits.clear();
    discoveryStateSingleton.eventBus = { publish: () => {} };
}

describe('MazeRoomUI — skeleton', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
    });

    it('constructs without DOM and starts with empty state', () => {
        const panel = new MazeRoomUI(null, {});
        expect(panel.rootElement).toBeNull();
        expect(panel.world).toBeNull();
        expect(panel.state).toBeNull();
        expect(panel.currentRegionId).toBeNull();
        expect(panel.fogEnabled).toBe(false);
        expect(panel.seenTilesByRegion.size).toBe(0);
    });

    it('discoveryModeActive defaults to false in headless tests', () => {
        // getDiscoverySettings() throws or returns nothing when the
        // discovery module hasn't been initialized — the constructor
        // catches and falls through with the default.
        const panel = new MazeRoomUI(null, {});
        expect(panel.discoveryModeActive).toBe(false);
    });
});

describe('MazeRoomUI — discovery population (fog opt-out)', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('marks every location and exit on region entry when world.fogEnabled is false', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
        const world = makeWorld({
            exits: [
                { exit_id: 'east', x: 5, y: 3, side: 'E', exitName: 'east_to_cave', targetRegion: 'Cave' },
                { exit_id: 'west', x: 0, y: 3, side: 'W', exitName: 'west_to_castle', targetRegion: 'Castle' },
            ],
            items: [
                { x: 2, y: 2, id: 'sword', locationName: 'Slay Yorgle' },
                { x: 4, y: 4, id: 'key_red', locationName: 'Bridge Key' },
            ],
        });
        world.fogEnabled = false;
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });

        expect(discoveryStateSingleton.isLocationDiscovered('Slay Yorgle')).toBe(true);
        expect(discoveryStateSingleton.isLocationDiscovered('Bridge Key')).toBe(true);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'east_to_cave')).toBe(true);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'west_to_castle')).toBe(true);
    });

    it('does not crash on a region with no items / exits', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
        expect(() => {
            panel.applyLoadedRegion({
                region_id: 'Empty',
                world: makeWorld({}),
                arrivedFrom: null,
            });
        }).not.toThrow();
    });

    it('subsequent fog-opt-out regions accumulate discoveries (does not clear prior marks)', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
        const worldA = makeWorld({
            items: [{ x: 1, y: 1, id: 'x', locationName: 'Loc A' }],
        });
        worldA.fogEnabled = false;
        panel.applyLoadedRegion({ region_id: 'A', world: worldA, arrivedFrom: null });
        const worldB = makeWorld({
            items: [{ x: 2, y: 2, id: 'y', locationName: 'Loc B' }],
        });
        worldB.fogEnabled = false;
        panel.applyLoadedRegion({ region_id: 'B', world: worldB, arrivedFrom: null });
        expect(discoveryStateSingleton.isLocationDiscovered('Loc A')).toBe(true);
        expect(discoveryStateSingleton.isLocationDiscovered('Loc B')).toBe(true);
    });
});

describe('MazeRoomUI — arrival position on region load', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('spawns at the entrance when arrivedFrom is null', () => {
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'A',
            world: makeWorld({
                entrance: { x: 4, y: 3 },
                exits: [{ exit_id: 'east', x: 7, y: 3, side: 'E', targetRegion: 'B' }],
            }),
            arrivedFrom: null,
        });
        expect(panel.state.player_pos).toEqual({ x: 4, y: 3 });
    });

    it('spawns at the arrivedFrom exit tile, not the entrance', () => {
        // Back-traversal regression: when the parent's exit and
        // entrance differ (always, except by coincidence), arriving
        // back via the parent's east-side exit must land on (7,3),
        // not on the geometric center entrance (4,3).
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'A',
            world: makeWorld({
                entrance: { x: 4, y: 3 },
                exits: [{ exit_id: 'east', x: 7, y: 3, side: 'E', targetRegion: 'B' }],
            }),
            arrivedFrom: { exit_id: 'east' },
        });
        expect(panel.state.player_pos).toEqual({ x: 7, y: 3 });
    });

    it('the visualizer mirroring callback does not clobber the arrival pos', () => {
        // The bug was: visualizer.setWorld would reset its internal
        // _state to createState(world) (= entrance), then notify the
        // panel's _onVisualizerChange callback which mirrored that
        // back into panel.state.player_pos. The fix threads spawnAt
        // through to the visualizer; this test asserts that after the
        // load completes, panel.state.player_pos is still the arrival
        // tile, not the entrance.
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'A',
            world: makeWorld({
                entrance: { x: 4, y: 3 },
                exits: [{ exit_id: 'east', x: 7, y: 3, side: 'E', targetRegion: 'B' }],
            }),
            arrivedFrom: { exit_id: 'east' },
        });
        // Invoke the visualizer-change handler directly to simulate
        // the post-setWorld _notifyChange firing in the runtime.
        panel._onVisualizerChange();
        expect(panel.state.player_pos).toEqual({ x: 7, y: 3 });
    });
});

describe('MazeRoomUI — walkTo command resolution', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    function panelWithLoadedWorld() {
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'A',
            world: makeWorld({
                entrance: { x: 4, y: 3 },
                exits: [
                    { exit_id: 'east_id', x: 7, y: 3, side: 'E', exitName: 'east_to_b', targetRegion: 'B' },
                ],
                items: [
                    { x: 2, y: 2, id: 'sword', locationName: 'Slay Yorgle' },
                    { x: 5, y: 4, id: 'key_red', locationName: 'Bridge Key' },
                ],
            }),
            arrivedFrom: null,
        });
        // Capture walkToTile invocations on the visualizer the panel
        // built. The visualizer is real but we don't tick — only the
        // resolution side is under test here.
        const calls = [];
        panel._visualizer.walkToTile = (arg) => calls.push(arg);
        return { panel, calls };
    }

    it('resolves a kind: location target via world.itemLocationNames', () => {
        const { panel, calls } = panelWithLoadedWorld();
        panel._handleWalkToCommand({ kind: 'location', name: 'Bridge Key' });
        expect(calls).toEqual([{ x: 5, y: 4, name: 'Bridge Key' }]);
    });

    it('resolves a kind: exit target by exit_id (Map key)', () => {
        const { panel, calls } = panelWithLoadedWorld();
        panel._handleWalkToCommand({ kind: 'exit', name: 'east_id' });
        expect(calls).toEqual([{ x: 7, y: 3, name: 'east_id' }]);
    });

    it('resolves a kind: exit target by exitName fallback', () => {
        const { panel, calls } = panelWithLoadedWorld();
        // Caller passed the AP-side exit name rather than the exit_id.
        panel._handleWalkToCommand({ kind: 'exit', name: 'east_to_b' });
        expect(calls).toEqual([{ x: 7, y: 3, name: 'east_to_b' }]);
    });

    it('drops unknown location names without throwing', () => {
        const { panel, calls } = panelWithLoadedWorld();
        expect(() => {
            panel._handleWalkToCommand({ kind: 'location', name: 'Nonexistent' });
        }).not.toThrow();
        expect(calls).toEqual([]);
    });

    it('drops unknown exit names without throwing', () => {
        const { panel, calls } = panelWithLoadedWorld();
        expect(() => {
            panel._handleWalkToCommand({ kind: 'exit', name: 'no_such_exit' });
        }).not.toThrow();
        expect(calls).toEqual([]);
    });

    it('drops walkTo when no world is loaded (early call)', () => {
        const panel = new MazeRoomUI(null, {});
        const calls = [];
        panel._visualizer.walkToTile = (arg) => calls.push(arg);
        expect(() => {
            panel._handleWalkToCommand({ kind: 'location', name: 'whatever' });
        }).not.toThrow();
        expect(calls).toEqual([]);
    });

    it('resolves a kind: tile target when region matches the loaded one', () => {
        const { panel, calls } = panelWithLoadedWorld();
        panel._handleWalkToCommand({ kind: 'tile', region: 'A', x: 5, y: 7 });
        expect(calls).toEqual([{ x: 5, y: 7, name: null }]);
    });

    it('drops a kind: tile target whose region does not match the loaded one', () => {
        const { panel, calls } = panelWithLoadedWorld();
        // Stale dispatch mid-region-transition: the bot computed (x, y)
        // for region B but a load-region race left the panel still on A.
        // Walking to those coords in A's world would land on the wrong
        // tile, so the panel must drop instead.
        panel._handleWalkToCommand({ kind: 'tile', region: 'B', x: 5, y: 7 });
        expect(calls).toEqual([]);
    });

    it('drops a kind: tile target with non-finite coords', () => {
        const { panel, calls } = panelWithLoadedWorld();
        panel._handleWalkToCommand({ kind: 'tile', region: 'A', x: NaN, y: 7 });
        panel._handleWalkToCommand({ kind: 'tile', region: 'A', x: 5, y: undefined });
        expect(calls).toEqual([]);
    });
});

describe('MazeRoomUI — playback controller adapter', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('getPlaybackController returns a stable object exposing the substrate-neutral interface', () => {
        const panel = new MazeRoomUI(null, {});
        const c1 = panel.getPlaybackController();
        const c2 = panel.getPlaybackController();
        expect(c1).toBe(c2);  // cached
        for (const m of ['play', 'stop', 'step', 'instant', 'reset', 'setRate', 'walkTo']) {
            expect(typeof c1[m]).toBe('function');
        }
    });

    it('controller methods delegate to the visualizer', () => {
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'A', world: makeWorld({}), arrivedFrom: null,
        });
        const calls = [];
        // Replace visualizer methods with recorders.
        panel._visualizer.play       = (rateHz) => calls.push(['play', rateHz]);
        panel._visualizer.stop       = () => calls.push(['stop']);
        panel._visualizer.step       = () => calls.push(['step']);
        panel._visualizer.instant    = () => calls.push(['instant']);
        panel._visualizer.freshStart = () => calls.push(['freshStart']);
        panel._visualizer.setRate    = (rateHz) => calls.push(['setRate', rateHz]);
        panel._visualizer.walkToTile = (arg) => calls.push(['walkToTile', arg]);
        const c = panel.getPlaybackController();
        c.play(8);
        c.stop();
        c.step();
        c.instant();
        c.reset();
        c.setRate(12);
        // walkTo goes through _handleWalkToCommand → resolution → walkToTile.
        c.walkTo({ kind: 'tile', region: 'A', x: 1, y: 1 });
        expect(calls).toEqual([
            ['play', 8],
            ['stop'],
            ['step'],
            ['instant'],
            ['freshStart'],
            ['setRate', 12],
            ['walkToTile', { x: 1, y: 1, name: null }],
        ]);
    });
});

describe('MazeRoomUI — visualizer pickup → system:locationCheck dispatch', () => {
    let calls;
    function fakeApis() {
        return {
            dispatcher: {
                publish: (topic, payload, options) => calls.push({ topic, payload, options }),
            },
            eventBus: { publish: () => {}, subscribe: () => {}, unsubscribe: () => {} },
        };
    }
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
        calls = [];
        // The panel reads dispatcher via the static moduleApis hook;
        // setModuleApis is the test-friendly way to wire a stub.
        MazeRoomUI.setModuleApis(fakeApis());
    });

    it('publishes system:locationCheck with locationName + itemId + regionName', () => {
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'A',
            world: makeWorld({}),
            arrivedFrom: null,
        });
        panel._onVisualizerLocationCheck('Slay Yorgle', 'sword', 'Overworld');
        expect(calls).toHaveLength(1);
        expect(calls[0].topic).toBe('system:locationCheck');
        expect(calls[0].payload).toEqual({
            locationName: 'Slay Yorgle',
            regionName: 'Overworld',
            itemId: 'sword',
        });
        expect(calls[0].options).toEqual({ initialTarget: 'bottom' });
    });

    it('falls back to currentRegionId when regionId is missing', () => {
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'CurrentRegion',
            world: makeWorld({}),
            arrivedFrom: null,
        });
        panel._onVisualizerLocationCheck('SomeLoc', 'key_red', null);
        expect(calls[0].payload.regionName).toBe('CurrentRegion');
    });

    it('drops the publish when no locationName is provided', () => {
        const panel = new MazeRoomUI(null, {});
        panel._onVisualizerLocationCheck(null, 'key_red', 'A');
        panel._onVisualizerLocationCheck('', 'key_red', 'A');
        expect(calls).toEqual([]);
    });
});

describe('MazeRoomUI — discovery filtering helpers', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('shows everything when discovery mode is off, even if not discovered', () => {
        const panel = new MazeRoomUI(null, {});
        panel.discoveryModeActive = false;
        panel.currentRegionId = 'Overworld';
        const exit = { exit_id: 'east', side: 'E', exitName: 'east', targetRegion: 'Cave' };
        expect(panel._isExitVisibleToUI(exit)).toBe(true);
        expect(panel._isLocationVisibleToUI('Slay Yorgle')).toBe(true);
    });

    it('hides undiscovered exits when discovery mode is on', () => {
        const panel = new MazeRoomUI(null, {});
        panel.discoveryModeActive = true;
        panel.currentRegionId = 'Overworld';
        const exit = { exit_id: 'east', side: 'E', exitName: 'east', targetRegion: 'Cave' };
        expect(panel._isExitVisibleToUI(exit)).toBe(false);
        // Once discovered, it shows.
        discoveryStateSingleton.discoverExit('Overworld', 'east');
        expect(panel._isExitVisibleToUI(exit)).toBe(true);
    });

    it('hides undiscovered locations when discovery mode is on', () => {
        const panel = new MazeRoomUI(null, {});
        panel.discoveryModeActive = true;
        panel.currentRegionId = 'Overworld';
        expect(panel._isLocationVisibleToUI('Slay Yorgle')).toBe(false);
        discoveryStateSingleton.discoverLocation('Slay Yorgle');
        expect(panel._isLocationVisibleToUI('Slay Yorgle')).toBe(true);
    });

    it('falls back to exit_id when exitName is missing', () => {
        const panel = new MazeRoomUI(null, {});
        panel.discoveryModeActive = true;
        panel.currentRegionId = 'Overworld';
        const exit = { exit_id: 'east', side: 'E' /* no exitName */ };
        expect(panel._isExitVisibleToUI(exit)).toBe(false);
        discoveryStateSingleton.discoverExit('Overworld', 'east');
        expect(panel._isExitVisibleToUI(exit)).toBe(true);
    });
});

describe('MazeRoomUI — fog of war helpers', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('_seenTilesForCurrentRegion lazily creates a per-region set', () => {
        const panel = new MazeRoomUI(null, {});
        panel.currentRegionId = 'A';
        const setA = panel._seenTilesForCurrentRegion();
        expect(setA).toBeInstanceOf(Set);
        // Same call returns the same set (no clobbering).
        expect(panel._seenTilesForCurrentRegion()).toBe(setA);
        // Different region → different set.
        panel.currentRegionId = 'B';
        const setB = panel._seenTilesForCurrentRegion();
        expect(setB).not.toBe(setA);
    });

    it('_seenTilesForCurrentRegion uses a sentinel key when no region is loaded (dev / Generate flow)', () => {
        // Dev/Generate doesn't have a procgen region context, but the
        // panel still needs a place to record fog state so the fog
        // checkbox + Explore button work. The sentinel keeps that
        // independent from any per-region state.
        const panel = new MazeRoomUI(null, {});
        panel.currentRegionId = null;
        const localSet = panel._seenTilesForCurrentRegion();
        expect(localSet).toBeInstanceOf(Set);
        // Switching to a procgen region returns a different set.
        panel.currentRegionId = 'A';
        const regionSet = panel._seenTilesForCurrentRegion();
        expect(regionSet).not.toBe(localSet);
    });

    it('_computeVisibleAt returns position plus 4-coord-adjacent in-bounds tiles', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = makeWorld({ width: 5, height: 5 });
        const visible = panel._computeVisibleAt({ x: 2, y: 2 });
        expect([...visible].sort()).toEqual(['1,2', '2,1', '2,2', '2,3', '3,2']);
    });

    it('_computeVisibleAt clips out-of-bounds neighbors', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = makeWorld({ width: 5, height: 5 });
        // Top-left corner: only self + east + south are in bounds.
        const visible = panel._computeVisibleAt({ x: 0, y: 0 });
        expect([...visible].sort()).toEqual(['0,0', '0,1', '1,0']);
    });

    it('_expandFogVisibility adds new tiles to the seen-set', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = makeWorld({ width: 5, height: 5 });
        panel.currentRegionId = 'A';
        panel._expandFogVisibility(new Set(['2,2', '2,3']));
        expect([...panel._seenTilesForCurrentRegion()].sort()).toEqual(['2,2', '2,3']);
        // Adding overlapping tiles is idempotent.
        panel._expandFogVisibility(new Set(['2,2', '3,3']));
        expect([...panel._seenTilesForCurrentRegion()].sort()).toEqual(['2,2', '2,3', '3,3']);
    });

    it('_expandFogVisibility fires discovery for items/exits at newly-visible tiles', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = makeWorld({
            width: 5,
            height: 5,
            items: [{ x: 1, y: 1, id: 'sword', locationName: 'Slay Yorgle' }],
            exits: [{ exit_id: 'east', x: 4, y: 2, side: 'E', exitName: 'east_to_cave' }],
        });
        panel.currentRegionId = 'Overworld';
        // Reveal a tile with neither an item nor an exit — no discovery fires.
        panel._expandFogVisibility(new Set(['0,0']));
        expect(discoveryStateSingleton.isLocationDiscovered('Slay Yorgle')).toBe(false);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'east_to_cave')).toBe(false);
        // Reveal the item tile — its location is discovered.
        panel._expandFogVisibility(new Set(['1,1']));
        expect(discoveryStateSingleton.isLocationDiscovered('Slay Yorgle')).toBe(true);
        // Reveal the exit tile — the exit is discovered.
        panel._expandFogVisibility(new Set(['4,2']));
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'east_to_cave')).toBe(true);
    });

    it('_isTileVisibleForRender returns true for all tiles when fog is disabled', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
        panel.currentRegionId = 'A';
        // Even with no seen tiles tracked, every tile renders.
        expect(panel._isTileVisibleForRender(0, 0)).toBe(true);
        expect(panel._isTileVisibleForRender(99, 99)).toBe(true);
    });

    it('_isTileVisibleForRender gates by the seen-set when fog is enabled', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = true;
        panel.currentRegionId = 'A';
        // No seen-set yet → nothing visible.
        expect(panel._isTileVisibleForRender(2, 2)).toBe(false);
        // Add one tile to the seen-set; only that tile shows.
        panel._seenTilesForCurrentRegion().add('2,2');
        expect(panel._isTileVisibleForRender(2, 2)).toBe(true);
        expect(panel._isTileVisibleForRender(2, 3)).toBe(false);
    });

    it('seen-set survives a region transition and back (no re-fog)', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = true;
        panel.currentRegionId = 'A';
        panel._seenTilesForCurrentRegion().add('1,1');
        panel.currentRegionId = 'B';
        panel._seenTilesForCurrentRegion().add('2,2');
        // Returning to A retains 'A's seen-set.
        panel.currentRegionId = 'A';
        expect(panel._isTileVisibleForRender(1, 1)).toBe(true);
        expect(panel._isTileVisibleForRender(2, 2)).toBe(false);
    });
});

describe('MazeRoomUI — fog/discovery interaction on region entry', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('panel fog OFF + world.fogEnabled false reveals every location/exit on entry', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
        const world = makeWorld({
            width: 6,
            height: 6,
            entrance: { x: 0, y: 0 },
            items: [
                { x: 5, y: 5, id: 'sword', locationName: 'Distant Sword' },
            ],
            exits: [
                { exit_id: 'east', x: 5, y: 3, side: 'E', exitName: 'east_to_cave' },
            ],
        });
        world.fogEnabled = false;
        panel.applyLoadedRegion({ region_id: 'Overworld', world, arrivedFrom: null });
        expect(discoveryStateSingleton.isLocationDiscovered('Distant Sword')).toBe(true);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'east_to_cave')).toBe(true);
    });

    it('panel fog OFF + world without fog flag does NOT auto-reveal (default fog on)', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
        // World omits fogEnabled → default fog on; panel-level fog
        // toggle controls only render, not discovery side effects.
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world: makeWorld({
                width: 6,
                height: 6,
                entrance: { x: 0, y: 0 },
                items: [{ x: 5, y: 5, id: 'sword', locationName: 'Distant Sword' }],
                exits: [{ exit_id: 'east', x: 5, y: 3, side: 'E', exitName: 'east_to_cave' }],
            }),
            arrivedFrom: null,
        });
        expect(discoveryStateSingleton.isLocationDiscovered('Distant Sword')).toBe(false);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'east_to_cave')).toBe(false);
    });

    it('fog ON only reveals tiles within the spawn visibility', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = true;
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world: makeWorld({
                width: 6,
                height: 6,
                entrance: { x: 0, y: 0 },
                items: [
                    // (0,1) is adjacent to spawn (0,0): item there is
                    // immediately discovered.
                    { x: 0, y: 1, id: 'key', locationName: 'Adjacent Key' },
                    // (5,5) is far from spawn: stays undiscovered.
                    { x: 5, y: 5, id: 'sword', locationName: 'Distant Sword' },
                ],
                exits: [
                    // Spawn-adjacent exit at (1,0) is discovered.
                    { exit_id: 'near', x: 1, y: 0, side: 'E', exitName: 'near_exit' },
                    // Far exit at (5,3) stays undiscovered.
                    { exit_id: 'far', x: 5, y: 3, side: 'E', exitName: 'far_exit' },
                ],
            }),
            arrivedFrom: null,
        });
        expect(discoveryStateSingleton.isLocationDiscovered('Adjacent Key')).toBe(true);
        expect(discoveryStateSingleton.isLocationDiscovered('Distant Sword')).toBe(false);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'near_exit')).toBe(true);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'far_exit')).toBe(false);
    });
});

describe('MazeRoomUI — loop-mode mana hooks (Phase 3)', () => {
    let createGameStateSingleton, _testOnly_resetGameStateSingleton;
    beforeEach(async () => {
        ({ createGameStateSingleton, _testOnly_resetGameStateSingleton } =
            await import('../gameState/singleton.js'));
        _testOnly_resetGameStateSingleton();
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

    it('_shouldDeductMazeMana is true with manaEnabled and loop mode inactive', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true };
        panel._isLoopModeActive = false;
        expect(panel._shouldDeductMazeMana()).toBe(true);
    });

    it('_shouldDeductMazeMana is false when loop mode is active', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true };
        panel._isLoopModeActive = true;
        expect(panel._shouldDeductMazeMana()).toBe(false);
    });

    it('_shouldDeductMazeMana is false when manaEnabled is off', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: false };
        panel._isLoopModeActive = false;
        expect(panel._shouldDeductMazeMana()).toBe(false);
    });

    it('_perTileMoveCost = baseRegionCost / longestShortestPath', () => {
        createGameStateSingleton(null);
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true, longestShortestPath: 10 };
        panel.currentRegionId = 'Forest';
        panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
        // 50 / 10 = 5, no XP reduction at level 0 → 5
        expect(panel._perTileMoveCost()).toBe(5);
    });

    it('_perTileMoveCost falls back to default region cost when costData not loaded', () => {
        createGameStateSingleton(null);
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true, longestShortestPath: 5 };
        panel.currentRegionId = 'Forest';
        panel._costDataManager = makeStubCostDataManager({ loaded: false });
        // 50 / 5 = 10
        expect(panel._perTileMoveCost()).toBe(10);
    });

    it('_perTileMoveCost handles longestShortestPath = 1', () => {
        createGameStateSingleton(null);
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true, longestShortestPath: 1 };
        panel.currentRegionId = 'Forest';
        panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
        expect(panel._perTileMoveCost()).toBe(50);
    });

    it('_locationTileCost reads from costDataManager when loaded', () => {
        createGameStateSingleton(null);
        const panel = new MazeRoomUI(null, {});
        panel.currentRegionId = 'Forest';
        panel._costDataManager = makeStubCostDataManager({
            locationCosts: { 'Slay Yorgle': 25 },
        });
        expect(panel._locationTileCost('Slay Yorgle')).toBe(25);
        expect(panel._locationTileCost('Unknown')).toBe(10);
    });

    it('XP reduction is applied to per-tile move cost', () => {
        const gs = createGameStateSingleton(null);
        gs.addRegionXP('Forest', 100); // → level 1, reduction = 1.05
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true, longestShortestPath: 10 };
        panel.currentRegionId = 'Forest';
        panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
        // base = 50/10 = 5; with reduction 1.05: 5/1.05 ≈ 4.7619
        const cost = panel._perTileMoveCost();
        expect(cost).toBeCloseTo(5 / 1.05, 5);
    });

    it('_deductMazeStepMana deducts move cost on a floor tile', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            manaEnabled: true,
            longestShortestPath: 10,
            itemLocationNames: new Map(),
        };
        panel.currentRegionId = 'Forest';
        panel.externalCheckedLocations = new Set();
        panel._isLoopModeActive = false;
        panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
        panel._deductMazeStepMana({ x: 3, y: 3 });
        expect(gs.getCurrentMana()).toBe(95); // 100 - 5
    });

    it('_deductMazeStepMana deducts location cost on an unchecked location tile', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            manaEnabled: true,
            longestShortestPath: 10,
            itemLocationNames: new Map([['3,3', 'Slay Yorgle']]),
        };
        panel.currentRegionId = 'Forest';
        panel.externalCheckedLocations = new Set();
        panel._isLoopModeActive = false;
        panel._costDataManager = makeStubCostDataManager({
            regionCosts: { Forest: 50 },
            locationCosts: { 'Slay Yorgle': 30 },
        });
        panel._deductMazeStepMana({ x: 3, y: 3 });
        expect(gs.getCurrentMana()).toBe(70); // 100 - 30 (location, not move)
    });

    it('_deductMazeStepMana uses move cost on an already-checked location tile', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            manaEnabled: true,
            longestShortestPath: 10,
            itemLocationNames: new Map([['3,3', 'Slay Yorgle']]),
        };
        panel.currentRegionId = 'Forest';
        panel.externalCheckedLocations = new Set(['Slay Yorgle']);
        panel._isLoopModeActive = false;
        panel._costDataManager = makeStubCostDataManager({
            regionCosts: { Forest: 50 },
            locationCosts: { 'Slay Yorgle': 30 },
        });
        panel._deductMazeStepMana({ x: 3, y: 3 });
        expect(gs.getCurrentMana()).toBe(95); // 100 - 5 (move, location already checked)
    });

    it('_deductMazeStepMana skips deduction when loop mode is active', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true, longestShortestPath: 10, itemLocationNames: new Map() };
        panel.currentRegionId = 'Forest';
        panel._isLoopModeActive = true;
        panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
        panel._deductMazeStepMana({ x: 3, y: 3 });
        expect(gs.getCurrentMana()).toBe(100); // no deduction
    });

    it('_deductMazeStepMana skips deduction when manaEnabled is off', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: false, longestShortestPath: 10, itemLocationNames: new Map() };
        panel.currentRegionId = 'Forest';
        panel._isLoopModeActive = false;
        panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
        panel._deductMazeStepMana({ x: 3, y: 3 });
        expect(gs.getCurrentMana()).toBe(100);
    });

    it('_deductMazeStepMana awards XP equal to mana spent', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true, longestShortestPath: 10, itemLocationNames: new Map() };
        panel.currentRegionId = 'Forest';
        panel.externalCheckedLocations = new Set();
        panel._isLoopModeActive = false;
        panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
        panel._deductMazeStepMana({ x: 3, y: 3 });
        expect(gs.getRegionXP('Forest').xp).toBe(5); // 50 / 10 longestShortestPath
    });

    it('_resolveLoopsActionTarget — regionMove resolves to matching exit tile', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            exits: new Map([
                ['exit_a', { exit_id: 'exit_a', x: 5, y: 0, targetRegion: 'A' }],
                ['exit_b', { exit_id: 'exit_b', x: 0, y: 5, targetRegion: 'B', exitName: 'eastward' }],
            ]),
            itemLocationNames: new Map(),
        };
        const target = panel._resolveLoopsActionTarget({
            type: 'regionMove', destinationRegion: 'B',
        });
        expect(target).toEqual({ x: 0, y: 5, name: 'eastward' });
    });

    it('_resolveLoopsActionTarget — locationCheck resolves via itemLocationNames', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            exits: new Map(),
            itemLocationNames: new Map([['3,4', 'Slay Yorgle']]),
        };
        const target = panel._resolveLoopsActionTarget({
            type: 'locationCheck', locationName: 'Slay Yorgle',
        });
        expect(target).toEqual({ x: 3, y: 4, name: 'Slay Yorgle' });
    });

    it('_pickBestExit — prefers lowest saved-queue mana cost', () => {
        _resetSavedQueueStore();
        clearRulesHashCache();
        const rulesData = { regions: { 1: ['Forest'] } };
        const rulesHash = hashRulesData(rulesData);
        // exit_a: cheap (10 mana cost). exit_b: expensive (50 mana cost).
        saveQueue(rulesHash, {
            regionName: 'Forest', substrate: 'maze',
            arrivalExitId: 'south', departureExitId: 'exit_a',
            actions: [{ type: 'move', dir: 'E' }],
            manaAtEntry: 100, manaAtExit: 90, manaMin: 90,
            locationsChecked: [], itemsPickedUp: [], recordedAt: 1,
        });
        saveQueue(rulesHash, {
            regionName: 'Forest', substrate: 'maze',
            arrivalExitId: 'south', departureExitId: 'exit_b',
            actions: [{ type: 'move', dir: 'S' }],
            manaAtEntry: 100, manaAtExit: 50, manaMin: 50,
            locationsChecked: [], itemsPickedUp: [], recordedAt: 2,
        });

        const panel = new MazeRoomUI(null, {});
        panel._cachedRulesData = rulesData;
        panel.world = { width: 10, height: 10, tiles: new Int8Array(100) };
        panel.currentRegionId = 'Forest';
        panel.arrivedFromExitId = 'south';
        panel.state = { player_pos: { x: 0, y: 0 } };

        const candidates = [
            { exit_id: 'exit_a', x: 1, y: 1, targetRegion: 'A' },
            { exit_id: 'exit_b', x: 5, y: 5, targetRegion: 'A' },
        ];
        const picked = panel._pickBestExit(candidates);
        expect(picked.exit_id).toBe('exit_a');
    });

    it('_pickBestExit — falls back to closest BFS distance when no saved data', () => {
        _resetSavedQueueStore();
        clearRulesHashCache();
        const panel = new MazeRoomUI(null, {});
        panel._cachedRulesData = { empty: true };
        panel.world = { width: 10, height: 1, tiles: new Int8Array(10), exits: new Map() };
        panel.currentRegionId = 'Forest';
        panel.arrivedFromExitId = 'south';
        panel.state = { player_pos: { x: 0, y: 0 } };

        const candidates = [
            { exit_id: 'far', x: 9, y: 0, targetRegion: 'A' },
            { exit_id: 'near', x: 3, y: 0, targetRegion: 'A' },
        ];
        const picked = panel._pickBestExit(candidates);
        expect(picked.exit_id).toBe('near');
    });

    it('_pickBestExit — defensive fallback to first candidate when no info', () => {
        // gs uninitialized in this branch — _pickBestExit catches the
        // throw and treats it as "no saved-path data".
        _testOnly_resetGameStateSingleton();
        const panel = new MazeRoomUI(null, {});
        panel.world = null;
        panel.currentRegionId = null;
        panel.state = null;
        const candidates = [
            { exit_id: 'a', x: 0, y: 0, targetRegion: 'X' },
            { exit_id: 'b', x: 1, y: 1, targetRegion: 'X' },
        ];
        const picked = panel._pickBestExit(candidates);
        expect(picked.exit_id).toBe('a');
    });

    it('_resolveLoopsActionTarget — explore returns alreadyComplete when fog is off', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { exits: new Map(), itemLocationNames: new Map() };
        panel.fogEnabled = false;
        expect(panel._resolveLoopsActionTarget({
            type: 'customAction', actionName: 'explore',
        })).toEqual({ alreadyComplete: true });
    });

    it('_resolveLoopsActionTarget — explore returns alreadyComplete when seenTiles is empty', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { exits: new Map(), itemLocationNames: new Map() };
        panel.fogEnabled = true;
        panel.currentRegionId = 'r1';
        // No seen-set entry seeded for r1 → empty.
        expect(panel._resolveLoopsActionTarget({
            type: 'customAction', actionName: 'explore',
        })).toEqual({ alreadyComplete: true });
    });

    it('_resolveLoopsActionTarget — unknown destinationRegion returns null', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            exits: new Map([['e', { exit_id: 'e', x: 1, y: 1, targetRegion: 'A' }]]),
            itemLocationNames: new Map(),
        };
        expect(panel._resolveLoopsActionTarget({
            type: 'regionMove', destinationRegion: 'NotInWorld',
        })).toBeNull();
    });

    it('_onLoopsSubstrateActionBegan — ignores actions for other regions', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { exits: new Map(), itemLocationNames: new Map() };
        panel.currentRegionId = 'Forest';
        panel._visualizer = { walkToTile: () => { throw new Error('should not walk'); } };
        // No exception means the handler bailed early on region mismatch.
        expect(() => panel._onLoopsSubstrateActionBegan({
            action: { type: 'regionMove', sourceRegion: 'Cave', destinationRegion: 'X' },
        })).not.toThrow();
        expect(panel._loopsDrivenAction).toBeNull();
    });

    it('_onLoopsSubstrateActionBegan — sets _loopsDrivenAction and calls walkToTile on resolvable target', () => {
        const calls = [];
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            exits: new Map([['e', { exit_id: 'e', x: 5, y: 5, targetRegion: 'B' }]]),
            itemLocationNames: new Map(),
        };
        panel.currentRegionId = 'A';
        panel._visualizer = { walkToTile: (t) => calls.push(t) };
        panel._onLoopsSubstrateActionBegan({
            action: { type: 'regionMove', sourceRegion: 'A', destinationRegion: 'B' },
        });
        expect(panel._loopsDrivenAction).not.toBeNull();
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({ x: 5, y: 5 });
    });

    it('_shouldDeductMazeMana allows deduction during queue-driven walks (Phase 6d)', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true };
        panel._isLoopModeActive = true;
        // Without queue direction: loops queue handles it; substrate stays passive.
        panel._loopsDrivenAction = null;
        expect(panel._shouldDeductMazeMana()).toBe(false);
        // With queue direction: substrate is the canonical deducter.
        panel._loopsDrivenAction = { type: 'regionMove' };
        expect(panel._shouldDeductMazeMana()).toBe(true);
    });

    it('_finalizeVisitOnExit persists a SavedQueue with action slice + mana fields', () => {
        _resetSavedQueueStore();
        clearRulesHashCache();
        createGameStateSingleton(null); // gameState.getCurrentMana fallback
        const rulesData = { regions: { 1: ['Forest'] } };
        const rulesHash = hashRulesData(rulesData);
        const panel = new MazeRoomUI(null, {});
        panel._cachedRulesData = rulesData;
        panel.currentRegionId = 'Forest';
        panel._mazeQueue._executor = () => {};
        // Begin recording, with arrival exit + entry mana.
        panel._startVisitRecording({
            region_id: 'Forest',
            arrivedFrom: { exit_id: 'south_door' },
        });
        // Simulate the visit: a couple of moves through the maze queue.
        panel._mazeQueue.handleInput({ type: ACTION_MOVE, dir: 'S' });
        panel._mazeQueue.handleInput({ type: ACTION_MOVE, dir: 'E' });
        // Mid-visit mana dip — drives the rolling min lower than entry.
        const gs = createGameStateSingleton(null);
        gs.currentMana = 60;
        panel._updateVisitMinMana();
        gs.currentMana = 75;
        panel._updateVisitMinMana(); // min stays at 60
        // Cross an exit to depart.
        panel._finalizeVisitOnExit('north_door');
        const queues = getSavedQueues(rulesHash, 'Forest', 'maze');
        expect(queues).toHaveLength(1);
        expect(queues[0]).toMatchObject({
            regionName: 'Forest',
            substrate: 'maze',
            arrivalExitId: 'south_door',
            departureExitId: 'north_door',
            actions: [
                { type: 'move', dir: 'S' },
                { type: 'move', dir: 'E' },
            ],
            manaMin: 60,
        });
    });

    it('_finalizeVisitOnExit silently skips persistence when no rules are cached', () => {
        _resetSavedQueueStore();
        clearRulesHashCache();
        const panel = new MazeRoomUI(null, {});
        // _cachedRulesData stays null
        panel.currentRegionId = 'Forest';
        panel._startVisitRecording({
            region_id: 'Forest',
            arrivedFrom: { exit_id: 'south' },
        });
        panel._finalizeVisitOnExit('north');
        const rulesHash = hashRulesData({ any: true });
        expect(getSavedQueues(rulesHash, 'Forest', 'maze')).toEqual([]);
    });

    it('_finalizeVisitOnExit extracts locationCheck actions into locationsChecked', () => {
        _resetSavedQueueStore();
        clearRulesHashCache();
        createGameStateSingleton(null);
        const rulesData = { regions: { 1: ['Forest'] } };
        const rulesHash = hashRulesData(rulesData);
        const panel = new MazeRoomUI(null, {});
        panel._cachedRulesData = rulesData;
        panel.currentRegionId = 'Forest';
        panel._mazeQueue._executor = () => {};
        panel._startVisitRecording({
            region_id: 'Forest',
            arrivedFrom: { exit_id: 'south' },
        });
        panel._mazeQueue.handleInput({ type: ACTION_MOVE, dir: 'E' });
        panel._mazeQueue.handleInput({ type: ACTION_LOCATION_CHECK, locationName: 'Slay Yorgle' });
        panel._finalizeVisitOnExit('north');
        const [q] = getSavedQueues(rulesHash, 'Forest', 'maze');
        expect(q.locationsChecked).toEqual(['Slay Yorgle']);
    });

    it('_deductMazeStepMana with freshLocationCheck override charges location cost', () => {
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            manaEnabled: true,
            longestShortestPath: 10,
            // The location is in checkedLocations already (visualizer
            // updated it before _onVisualizerChange fires) — without
            // the override the panel would charge move cost.
            itemLocationNames: new Map([['3,3', 'Slay Yorgle']]),
        };
        panel.currentRegionId = 'Forest';
        panel.externalCheckedLocations = new Set(['Slay Yorgle']);
        panel._isLoopModeActive = true;
        panel._loopsDrivenAction = { type: 'regionMove' };
        panel._costDataManager = makeStubCostDataManager({
            regionCosts: { Forest: 50 },
            locationCosts: { 'Slay Yorgle': 30 },
        });
        panel._deductMazeStepMana({ x: 3, y: 3 }, { freshLocationCheck: 'Slay Yorgle' });
        // 100 - 30 (location cost charged due to override)
        expect(gs.getCurrentMana()).toBe(70);
    });

    it('_onLoopsSubstrateActionBegan — fails back with completed:false when target unresolvable', () => {
        const events = [];
        // We can't easily mock the eventBus singleton import; the bus's
        // publish is a no-op in this headless context but the panel
        // also clears _loopsDrivenAction in the failure path.
        const panel = new MazeRoomUI(null, {});
        panel.world = { exits: new Map(), itemLocationNames: new Map() };
        panel.currentRegionId = 'A';
        panel._publishLoopsCompleted = (c) => events.push(c);
        panel._visualizer = { walkToTile: () => { throw new Error('should not walk'); } };
        panel._onLoopsSubstrateActionBegan({
            action: { type: 'regionMove', sourceRegion: 'A', destinationRegion: 'NotHere' },
        });
        expect(events).toEqual([false]);
        expect(panel._loopsDrivenAction).toBeNull();
    });

    it('_deductMazeStepMana triggers loop reset when mana hits zero', () => {
        const dispatcherCalls = [];
        const dispatcher = {
            publish: (event, data, opts) => dispatcherCalls.push({ event, data, opts }),
        };
        MazeRoomUI.setModuleApis({ eventBus: null, dispatcher });
        try {
            const gs = createGameStateSingleton(null);
            gs.setStartRegions(['Menu']);
            gs.currentMana = 4; // about to go below zero on a 5-mana step
            const panel = new MazeRoomUI(null, {});
            panel.world = { manaEnabled: true, longestShortestPath: 10, itemLocationNames: new Map() };
            panel.currentRegionId = 'Forest';
            panel.externalCheckedLocations = new Set();
            panel._isLoopModeActive = false;
            panel._costDataManager = makeStubCostDataManager({ regionCosts: { Forest: 50 } });
            panel._deductMazeStepMana({ x: 3, y: 3 });
            // Mana refilled to max
            expect(gs.getCurrentMana()).toBe(gs.getMaxMana());
            // Dispatcher saw the reset move
            const move = dispatcherCalls.find((c) => c.event === 'user:regionMove');
            expect(move).toBeDefined();
            expect(move.data.targetRegion).toBe('Menu');
            expect(move.data.fromReset).toBe(true);
            expect(move.data.updatePath).toBe(false);
        } finally {
            MazeRoomUI.setModuleApis(null);
        }
    });
});

describe('MazeRoomUI — action queue integration (Phase 1)', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('constructs a MazeRoomQueue exposed as panel._mazeQueue', () => {
        const panel = new MazeRoomUI(null, {});
        expect(panel._mazeQueue).toBeTruthy();
        expect(panel._mazeQueue.length).toBe(0);
        expect(panel._mazeQueue.isIdle()).toBe(true);
    });

    it('routes move actions through _executeMoveAction', () => {
        const panel = new MazeRoomUI(null, {});
        const spy = vi.spyOn(panel, '_executeMoveAction').mockImplementation(() => {});
        panel._mazeQueue.handleInput({ type: ACTION_MOVE, dir: 'N' });
        expect(spy).toHaveBeenCalledWith('N');
    });

    it('routes wait actions through _executeWaitAction', () => {
        const panel = new MazeRoomUI(null, {});
        const spy = vi.spyOn(panel, '_executeWaitAction').mockImplementation(() => {});
        panel._mazeQueue.handleInput({ type: ACTION_WAIT });
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('routes locationCheck actions through _executeLocationCheckAction', () => {
        const panel = new MazeRoomUI(null, {});
        const spy = vi.spyOn(panel, '_executeLocationCheckAction').mockImplementation(() => {});
        panel._mazeQueue.handleInput({
            type: ACTION_LOCATION_CHECK,
            locationName: 'Slay Yorgle',
        });
        expect(spy).toHaveBeenCalledWith('Slay Yorgle');
    });

    it('clears the queue on region adoption', () => {
        const panel = new MazeRoomUI(null, {});
        // Programmatic appends bypass the executor (no execution).
        panel._mazeQueue.append({ type: ACTION_MOVE, dir: 'N' });
        panel._mazeQueue.append({ type: ACTION_WAIT });
        expect(panel._mazeQueue.length).toBe(2);
        panel.applyLoadedRegion({
            region_id: 'A',
            world: makeWorld({}),
            arrivedFrom: null,
        });
        expect(panel._mazeQueue.length).toBe(0);
        expect(panel._mazeQueue.executionIndex).toBe(0);
        expect(panel._mazeQueue.editCursor).toBeNull();
    });

    it('_executeWaitAction is a no-op outside playback mode', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = { manaEnabled: true };
        panel.state = { player_pos: { x: 0, y: 0 }, turn: 0 };
        // externalInventory null → not in playback mode.
        panel.externalInventory = null;
        // Should not throw and should not deduct mana (no gameState
        // singleton interaction).
        expect(() => panel._executeWaitAction()).not.toThrow();
    });

    it('_executeWaitAction deducts mana in playback mode', async () => {
        const { createGameStateSingleton, _testOnly_resetGameStateSingleton } =
            await import('../gameState/singleton.js');
        _testOnly_resetGameStateSingleton();
        const gs = createGameStateSingleton(null);
        gs.currentMana = 100;
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            manaEnabled: true,
            longestShortestPath: 10,
            itemLocationNames: new Map(),
        };
        panel.state = { player_pos: { x: 1, y: 1 }, turn: 0 };
        panel.currentRegionId = 'Forest';
        panel.externalInventory = new Set();
        panel.externalCheckedLocations = new Set();
        panel._isLoopModeActive = false;
        panel._costDataManager = {
            isLoaded: () => true,
            getRegionCost: () => 50,
            getLocationCost: () => 10,
        };
        panel._executeWaitAction();
        // Same cost as a move-onto-floor (50 / 10 = 5).
        expect(gs.getCurrentMana()).toBe(95);
    });

    it('_executeLocationCheckAction publishes user:locationCheck in playback mode', () => {
        const calls = [];
        const dispatcher = {
            publish: (event, data, opts) => calls.push({ event, data, opts }),
        };
        MazeRoomUI.setModuleApis({ eventBus: null, dispatcher });
        try {
            const panel = new MazeRoomUI(null, {});
            panel.externalInventory = new Set();
            panel.currentRegionId = 'Forest';
            panel._executeLocationCheckAction('Slay Yorgle');
            expect(calls).toHaveLength(1);
            expect(calls[0].event).toBe('user:locationCheck');
            expect(calls[0].data).toEqual({
                locationName: 'Slay Yorgle',
                regionName: 'Forest',
            });
        } finally {
            MazeRoomUI.setModuleApis(null);
        }
    });

    it('_executeLocationCheckAction no-ops outside playback mode', () => {
        const calls = [];
        const dispatcher = {
            publish: (event, data, opts) => calls.push({ event, data, opts }),
        };
        MazeRoomUI.setModuleApis({ eventBus: null, dispatcher });
        try {
            const panel = new MazeRoomUI(null, {});
            panel.externalInventory = null;
            panel._executeLocationCheckAction('Slay Yorgle');
            expect(calls).toEqual([]);
        } finally {
            MazeRoomUI.setModuleApis(null);
        }
    });

    it('_executeLocationCheckAction no-ops with empty locationName', () => {
        const calls = [];
        const dispatcher = {
            publish: (event, data, opts) => calls.push({ event, data, opts }),
        };
        MazeRoomUI.setModuleApis({ eventBus: null, dispatcher });
        try {
            const panel = new MazeRoomUI(null, {});
            panel.externalInventory = new Set();
            panel._executeLocationCheckAction('');
            panel._executeLocationCheckAction(null);
            expect(calls).toEqual([]);
        } finally {
            MazeRoomUI.setModuleApis(null);
        }
    });
});

describe('MazeRoomUI — saved queue replay', () => {
    const RULES_DATA = { regions: { 1: ['Forest'] } };
    let _testOnly_resetGameStateSingleton;
    beforeEach(async () => {
        ({ _testOnly_resetGameStateSingleton } =
            await import('../gameState/singleton.js'));
        _testOnly_resetGameStateSingleton();
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
        _resetSavedQueueStore();
        clearRulesHashCache();
    });

    function panelWithRules() {
        const panel = new MazeRoomUI(null, {});
        panel._cachedRulesData = RULES_DATA;
        return panel;
    }

    it('_getReplayableTargets returns saved queues for matching (region, arrival)', () => {
        const rulesHash = hashRulesData(RULES_DATA);
        // Matching queue, departs via 'exit_a'.
        saveQueue(rulesHash, {
            regionName: 'Forest',
            substrate: 'maze',
            arrivalExitId: 'south',
            departureExitId: 'exit_a',
            actions: [{ type: 'move', dir: 'N' }],
            manaAtEntry: 100,
            manaAtExit: 95,
            manaMin: 95,
            locationsChecked: [],
            itemsPickedUp: [],
            recordedAt: 1000,
        });
        // Wrong region — filtered out.
        saveQueue(rulesHash, {
            regionName: 'Cave',
            substrate: 'maze',
            arrivalExitId: 'south',
            departureExitId: 'e',
            actions: [{ type: 'wait' }],
            manaAtEntry: 100,
            manaAtExit: 99,
            manaMin: 99,
            locationsChecked: [],
            itemsPickedUp: [],
            recordedAt: 1001,
        });
        // Wrong arrivedFrom — filtered out.
        saveQueue(rulesHash, {
            regionName: 'Forest',
            substrate: 'maze',
            arrivalExitId: 'north',
            departureExitId: 'exit_a',
            actions: [{ type: 'wait' }],
            manaAtEntry: 100,
            manaAtExit: 98,
            manaMin: 98,
            locationsChecked: [],
            itemsPickedUp: [],
            recordedAt: 1002,
        });
        // Same region+arrival, different departure, lower cost — should sort first.
        saveQueue(rulesHash, {
            regionName: 'Forest',
            substrate: 'maze',
            arrivalExitId: 'south',
            departureExitId: 'exit_b',
            actions: [{ type: 'move', dir: 'E' }],
            manaAtEntry: 100,
            manaAtExit: 99,
            manaMin: 99,
            locationsChecked: [],
            itemsPickedUp: [],
            recordedAt: 1003,
        });

        const panel = panelWithRules();
        panel.world = {
            exits: new Map([
                ['exit_a', { exit_id: 'exit_a', x: 0, y: 0, targetRegion: 'A', exitName: 'north_door' }],
                ['exit_b', { exit_id: 'exit_b', x: 0, y: 0, targetRegion: 'B', exitName: 'east_door' }],
            ]),
        };
        panel.currentRegionId = 'Forest';
        panel.arrivedFromExitId = 'south';

        const targets = panel._getReplayableTargets();
        expect(targets).toHaveLength(2);
        // Sorted cheapest-first by manaEntry - manaMin.
        expect(targets[0].label).toBe('exit: east_door');
        expect(targets[0].totalCost).toBe(1);
        expect(targets[1].label).toBe('exit: north_door');
        expect(targets[1].totalCost).toBe(5);
    });

    it('_getReplayableTargets uses "entrance" sentinel when arrivedFromExitId is null', () => {
        const rulesHash = hashRulesData(RULES_DATA);
        saveQueue(rulesHash, {
            regionName: 'Forest',
            substrate: 'maze',
            arrivalExitId: 'entrance',
            departureExitId: 'a',
            actions: [{ type: 'move', dir: 'N' }],
            manaAtEntry: 100,
            manaAtExit: 93,
            manaMin: 93,
            locationsChecked: [],
            itemsPickedUp: [],
            recordedAt: 2000,
        });
        const panel = panelWithRules();
        panel.world = {
            exits: new Map([['a', { exit_id: 'a', x: 0, y: 0, targetRegion: 'B' }]]),
        };
        panel.currentRegionId = 'Forest';
        panel.arrivedFromExitId = null;
        expect(panel._getReplayableTargets()).toHaveLength(1);
    });

    it('_getReplayableTargets returns empty when rules data isn\'t cached', () => {
        const panel = new MazeRoomUI(null, {});
        // _cachedRulesData stays null — represents "stateManager hasn't loaded yet"
        panel.currentRegionId = 'Forest';
        expect(panel._getReplayableTargets()).toEqual([]);
    });

    it('_replayBestPath appends the saved actions to the queue', () => {
        const rulesHash = hashRulesData(RULES_DATA);
        saveQueue(rulesHash, {
            regionName: 'Forest',
            substrate: 'maze',
            arrivalExitId: 'south',
            departureExitId: 'e',
            actions: [
                { type: 'move', dir: 'N' },
                { type: 'move', dir: 'E' },
                { type: 'wait' },
            ],
            manaAtEntry: 100,
            manaAtExit: 90,
            manaMin: 90,
            locationsChecked: [],
            itemsPickedUp: [],
            recordedAt: 3000,
        });
        const panel = panelWithRules();
        panel.render = () => {};
        panel.currentRegionId = 'Forest';
        panel.arrivedFromExitId = 'south';
        const ran = [];
        panel._mazeQueue._executor = (a) => ran.push(a.type);
        panel._replayBestPath('3000');
        expect(panel._replayDriver).not.toBeNull();
        expect(panel._mazeQueue.length).toBe(3);
        expect(panel._mazeQueue.actions.map((a) => a.type)).toEqual([
            'move', 'move', 'wait',
        ]);
        panel._stopReplay();
    });

    it('_replayBestPath no-ops on missing key', () => {
        const panel = panelWithRules();
        panel.render = () => {};
        panel.currentRegionId = 'Forest';
        panel._replayBestPath('nonexistent');
        expect(panel._replayDriver).toBeNull();
        expect(panel._mazeQueue.length).toBe(0);
    });

    it('_stopReplay clears the driver and is idempotent', () => {
        const panel = new MazeRoomUI(null, {});
        panel.render = () => {};
        // Hand-start the driver to test stop in isolation.
        panel._mazeQueue.append({ type: ACTION_WAIT });
        panel._startReplayDriver();
        expect(panel._replayDriver).not.toBeNull();
        panel._stopReplay();
        expect(panel._replayDriver).toBeNull();
        panel._stopReplay(); // idempotent
        expect(panel._replayDriver).toBeNull();
    });

    it('region adoption resets direct-walk tracking', () => {
        const panel = new MazeRoomUI(null, {});
        panel._directWalkCost = 42;
        panel._directWalkItems = ['stale-item'];
        panel._directWalkLocations = ['stale-loc'];
        panel.applyLoadedRegion({
            region_id: 'r',
            world: makeWorld({}),
            arrivedFrom: null,
        });
        expect(panel._directWalkCost).toBe(0);
        expect(panel._directWalkItems).toEqual([]);
        expect(panel._directWalkLocations).toEqual([]);
    });

    it('_populateLoopsDrivenQueue appends moves derived from the path', () => {
        const panel = new MazeRoomUI(null, {});
        // 5x1 corridor: floors (0), no walls.
        panel.world = {
            width: 5, height: 1, tiles: new Int8Array(5),
            exits: new Map(), items: new Map(), itemLocationNames: new Map(),
        };
        panel._mazeQueue._executor = () => {};
        panel._populateLoopsDrivenQueue(
            { type: 'regionMove', destinationRegion: 'X' },
            { x: 0, y: 0 },
            { x: 4, y: 0 },
        );
        // 4 east moves
        expect(panel._mazeQueue.actions.map((a) => `${a.type}:${a.dir ?? ''}`)).toEqual([
            'move:E', 'move:E', 'move:E', 'move:E',
        ]);
    });

    it('_populateLoopsDrivenQueue appends locationCheck terminator for location targets', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            width: 3, height: 1, tiles: new Int8Array(3),
            exits: new Map(), items: new Map(), itemLocationNames: new Map(),
        };
        panel._populateLoopsDrivenQueue(
            { type: 'locationCheck', locationName: 'Slay Yorgle' },
            { x: 0, y: 0 },
            { x: 2, y: 0 },
        );
        expect(panel._mazeQueue.actions.map((a) => `${a.type}:${a.dir ?? a.locationName ?? ''}`)).toEqual([
            'move:E', 'move:E', 'locationCheck:Slay Yorgle',
        ]);
    });

    it('_populateLoopsDrivenQueue skips path BFS when world lacks tiles', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            exits: new Map(), items: new Map(), itemLocationNames: new Map(),
        };
        expect(() => panel._populateLoopsDrivenQueue(
            { type: 'regionMove' },
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        )).not.toThrow();
        // No tile data → empty queue (visualizer still drives the walk).
        expect(panel._mazeQueue.length).toBe(0);
    });

    it('_populateLoopsDrivenQueue still adds locationCheck terminator without tiles', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            exits: new Map(), items: new Map(), itemLocationNames: new Map(),
        };
        panel._populateLoopsDrivenQueue(
            { type: 'locationCheck', locationName: 'L' },
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        );
        expect(panel._mazeQueue.actions).toEqual([
            expect.objectContaining({ type: 'locationCheck', locationName: 'L' }),
        ]);
    });

    it('keyboard input is blocked while loops is driving', () => {
        const panel = new MazeRoomUI(null, {});
        panel.world = {
            width: 5, height: 1, tiles: new Int8Array(5),
            exits: new Map(), items: new Map(), itemLocationNames: new Map(),
        };
        panel.state = { player_pos: { x: 0, y: 0 }, turn: 0 };
        panel._loopsDrivenAction = { type: 'regionMove' };
        const executor = vi.fn();
        panel._mazeQueue._executor = executor;
        const fakeEvent = {
            key: 'ArrowRight',
            preventDefault: vi.fn(),
        };
        panel._handleKeydown(fakeEvent);
        expect(fakeEvent.preventDefault).toHaveBeenCalled();
        expect(executor).not.toHaveBeenCalled();
        expect(panel._mazeQueue.length).toBe(0);
    });

    it('region adoption stops an active replay', () => {
        _resetSavedQueueStore();
        clearRulesHashCache();
        const rulesData = { regions: { 1: ['r'] } };
        const rulesHash = hashRulesData(rulesData);
        saveQueue(rulesHash, {
            regionName: 'r',
            substrate: 'maze',
            arrivalExitId: 'entrance',
            departureExitId: 'e',
            actions: [{ type: 'wait' }, { type: 'wait' }],
            manaAtEntry: 100, manaAtExit: 98, manaMin: 98,
            locationsChecked: [], itemsPickedUp: [],
            recordedAt: 5000,
        });
        const panel = new MazeRoomUI(null, {});
        panel._cachedRulesData = rulesData;
        panel.render = () => {};
        panel.currentRegionId = 'r';
        panel.arrivedFromExitId = null;
        panel._mazeQueue._executor = () => {}; // suppress side effects
        panel._replayBestPath('5000');
        expect(panel._replayDriver).not.toBeNull();
        // Adopting a region clears the queue + stops the replay.
        panel.applyLoadedRegion({
            region_id: 'r2',
            world: makeWorld({}),
            arrivedFrom: null,
        });
        expect(panel._replayDriver).toBeNull();
        expect(panel._mazeQueue.length).toBe(0);
    });
});

describe('MazeRoomUI — hazard runtime integration (Phase 2e)', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    function makeHazardLinear(tiles, phase = 0) {
        return {
            shape: 'linear',
            length: tiles.length,
            tiles,
            cycleLength: 2 * (tiles.length - 1),
            phase,
        };
    }

    function makeWorldWithHazards(hazards, opts = {}) {
        const w = makeWorld(opts);
        // Open floor for engine.step to operate on.
        const totalTiles = w.width * w.height;
        w.tiles = new Int8Array(totalTiles);
        w.hazards = hazards;
        return w;
    }

    function makePanelOnWorld(world, opts = {}) {
        const panel = new MazeRoomUI(null, {});
        panel.world = world;
        panel.state = {
            player_pos: opts.playerPos ?? { x: 0, y: 0 },
            turn: 0,
            inventory: new Set(),
        };
        panel.currentRegionId = opts.regionId ?? 'R';
        panel.arrivedFromExitId = opts.arrivedFrom ?? null;
        // Stub render so headless tests don't try to draw.
        panel.render = () => {};
        return panel;
    }

    it('_adoptLoadedRegion resets hazard phases to 0', () => {
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1);
        const world = makeWorldWithHazards([haz], {});
        world.fogEnabled = false;
        const panel = new MazeRoomUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'R',
            world,
            arrivedFrom: null,
        });
        expect(haz.phase).toBe(0);
    });

    it('_executeMoveAction skips engine.step when hazard blocks the destination', () => {
        // Hazard at (0,0), facing (1,0). Player at (2,0) tries to move
        // west to (1,0) — Rule 1 fires (1,0) = hazard's next tile.
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const world = makeWorldWithHazards([haz], { width: 4, height: 1 });
        const panel = makePanelOnWorld(world, { playerPos: { x: 2, y: 0 } });
        panel._executeMoveAction('W');
        // Player didn't move (blocked); turn advanced (hazard ticked).
        expect(panel.state.player_pos).toEqual({ x: 2, y: 0 });
        expect(haz.phase).toBe(1);
    });

    it('_executeMoveAction allows + ticks when destination is clear', () => {
        // Hazard far from player. Player moves east into open floor.
        const haz = makeHazardLinear([{ x: 5, y: 0 }, { x: 5, y: 1 }], 0);
        const world = makeWorldWithHazards([haz], { width: 6, height: 2 });
        const panel = makePanelOnWorld(world, { playerPos: { x: 0, y: 0 } });
        panel._executeMoveAction('E');
        expect(panel.state.player_pos).toEqual({ x: 1, y: 0 });
        expect(haz.phase).toBe(1);
    });

    it('_executeWaitAction ticks hazards even when no mana deducted', () => {
        const haz = makeHazardLinear([{ x: 5, y: 0 }, { x: 5, y: 1 }], 0);
        const world = makeWorldWithHazards([haz], { width: 6, height: 2 });
        const panel = makePanelOnWorld(world, { playerPos: { x: 0, y: 0 } });
        // externalInventory null → no mana deduction path. Wait still ticks.
        panel._executeWaitAction();
        expect(haz.phase).toBe(1);
    });

    it('_executeWaitAction rejection + stomp triggers a pre-tick teleport', () => {
        // Player at (1,0). Hazard at (0,0) facing east toward (1,0).
        // Wait would land the player on (1,0) = hazard.next — Rule 1
        // applied to wait. The pre-tick stomp check in
        // _tickAndCheckHazards fires the teleport BEFORE the hazard
        // ticks, so the player ends up at world.entrance and the
        // hazard is reset to phase 0.
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const world = makeWorldWithHazards([haz], { width: 3, height: 1 });
        const panel = makePanelOnWorld(world, { playerPos: { x: 1, y: 0 } });
        world.entrance = { x: 2, y: 0 };
        panel._executeWaitAction();
        expect(panel.state.player_pos).toEqual({ x: 2, y: 0 });
        expect(haz.phase).toBe(0);
        expect(panel.message).toMatch(/Hazard-trapped/);
    });

    it('_fireHazardTeleport moves player to world.entrance and resets hazards', () => {
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1);
        const world = makeWorldWithHazards([haz], { width: 5, height: 5 });
        world.entrance = { x: 2, y: 2 };
        const panel = makePanelOnWorld(world, { playerPos: { x: 4, y: 4 } });
        panel._fireHazardTeleport();
        expect(panel.state.player_pos).toEqual({ x: 2, y: 2 });
        expect(haz.phase).toBe(0);
        expect(panel.message).toMatch(/Hazard-trapped/);
    });

    it('_fireHazardTeleport prefers the arrived-from exit over world.entrance', () => {
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const world = makeWorldWithHazards([haz], { width: 5, height: 5 });
        world.entrance = { x: 2, y: 2 };
        world.exits = new Map([
            ['south_door', { exit_id: 'south_door', x: 4, y: 4 }],
        ]);
        const panel = makePanelOnWorld(world, {
            playerPos: { x: 1, y: 1 },
            arrivedFrom: 'south_door',
        });
        panel._fireHazardTeleport();
        expect(panel.state.player_pos).toEqual({ x: 4, y: 4 });
    });

    it('_fireHazardTeleport clears pending queue actions + stops replay', () => {
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const world = makeWorldWithHazards([haz], { width: 5, height: 5 });
        world.entrance = { x: 0, y: 0 };
        const panel = makePanelOnWorld(world, { playerPos: { x: 2, y: 2 } });
        // Populate the queue with some pending and start a fake replay.
        panel._mazeQueue.append({ type: 'move', dir: 'N' });
        panel._mazeQueue.append({ type: 'move', dir: 'E' });
        panel._startReplayDriver();
        expect(panel._replayDriver).not.toBeNull();
        expect(panel._mazeQueue.length).toBeGreaterThan(0);
        panel._fireHazardTeleport();
        expect(panel._replayDriver).toBeNull();
        expect(panel._mazeQueue.length).toBe(0);
    });

    it('_tickAndCheckHazards is a no-op when world has no hazards', () => {
        const world = makeWorldWithHazards(undefined, { width: 3, height: 3 });
        const panel = makePanelOnWorld(world);
        expect(() => panel._tickAndCheckHazards()).not.toThrow();
        expect(panel.state.player_pos).toEqual({ x: 0, y: 0 });
    });

    it('_tickAndCheckHazards teleports when no valid move remains after the tick', () => {
        // 2x1 world: tiles (0,0) and (1,0). One hazard cycling between
        // them. Player at (0,0); the tick advances the hazard from
        // phase 0 (at (0,0)) to phase 1 (at (1,0), facing back to (0,0)).
        // After tick, hasAnyValidMove from (0,0):
        //   wait at (0,0): Rule 1 — to=(0,0)=hazard.next. BLOCKED.
        //   move E to (1,0): Rule 2 — from=(0,0)=hazard.next, to=(1,0)=hazard.cur. BLOCKED.
        //   N/S/W: off-grid. Skipped.
        // → no valid move → teleport fires. Player → world.entrance
        // and hazard phase resets to 0.
        const world = makeWorldWithHazards([
            makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0),
        ], { width: 2, height: 1 });
        world.entrance = { x: 1, y: 0 };
        const panel = makePanelOnWorld(world, { playerPos: { x: 0, y: 0 } });
        panel._tickAndCheckHazards();
        // Teleport executed.
        expect(panel.state.player_pos).toEqual({ x: 1, y: 0 });
        expect(world.hazards[0].phase).toBe(0);
        expect(panel.message).toMatch(/Hazard-trapped/);
    });

    it('_tickAndCheckHazards leaves phase + position alone when a valid move exists', () => {
        // Same shape as the above world, but bigger so the player has
        // an escape direction. Player at (0,0); after tick, the hazard
        // is at (1,0) facing (0,0). Player can move south to (0,1).
        const world = makeWorldWithHazards([
            makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0),
        ], { width: 2, height: 3 });
        world.entrance = { x: 1, y: 2 };
        const panel = makePanelOnWorld(world, { playerPos: { x: 0, y: 0 } });
        panel._tickAndCheckHazards();
        expect(panel.state.player_pos).toEqual({ x: 0, y: 0 }); // unchanged
        expect(world.hazards[0].phase).toBe(1); // tick advanced
    });

    it('waiting on a tile a hazard will step into triggers the pre-tick teleport', () => {
        // Player at (1,0). Hazard at (0,0) facing east toward (1,0).
        // Phase 0: hazard.cur=(0,0), hazard.next=(1,0). Pre-tick stomp
        // check fires (Rule 1 applied to wait) → teleport BEFORE the
        // tick advances. Without this check, the wait was silently a
        // no-op and the player walked under the hazard.
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const world = makeWorldWithHazards([haz], { width: 4, height: 1 });
        world.entrance = { x: 3, y: 0 };
        const panel = makePanelOnWorld(world, { playerPos: { x: 1, y: 0 } });
        panel._executeWaitAction();
        expect(panel.state.player_pos).toEqual({ x: 3, y: 0 });
        expect(haz.phase).toBe(0); // reset after teleport
        expect(panel.message).toMatch(/Hazard-trapped/);
    });

    it('Rule-2 bumped move leaves player on hazard.next → pre-tick teleport', () => {
        // Player at (1,0). Hazard at (0,0) facing east toward (1,0).
        // Player tries to move WEST to (0,0). Rule 2 fires (to=cur,
        // from=next). Move rejected, player stays at (1,0) which IS
        // hazard.next. Pre-tick stomp catches it → teleport.
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const world = makeWorldWithHazards([haz], { width: 4, height: 1 });
        world.entrance = { x: 3, y: 0 };
        const panel = makePanelOnWorld(world, { playerPos: { x: 1, y: 0 } });
        panel._executeMoveAction('W');
        expect(panel.state.player_pos).toEqual({ x: 3, y: 0 });
        expect(haz.phase).toBe(0);
    });

    it('moving OUT from under a stomp threat is still allowed (escape works)', () => {
        // Player at (1,0) with hazard about to stomp. Player moves
        // SOUTH to (1,1) — that's not a hazard tile, so validateMove
        // passes. Move executes; tick advances hazard onto (1,0) (now
        // empty); player at (1,1) is safe. No teleport.
        const haz = makeHazardLinear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const world = makeWorldWithHazards([haz], { width: 4, height: 3 });
        world.entrance = { x: 3, y: 2 };
        const panel = makePanelOnWorld(world, { playerPos: { x: 1, y: 0 } });
        panel._executeMoveAction('S');
        expect(panel.state.player_pos).toEqual({ x: 1, y: 1 });
        expect(haz.phase).toBe(1); // hazard ticked
        expect(panel.message).not.toMatch(/Hazard-trapped/);
    });

    it('_onVisualizerChange treats a turn-only advance (wait) as a tick', () => {
        // Simulate the visualizer firing _onVisualizerChange after a
        // wait: player_pos unchanged, turn advanced by 1. Substrate
        // should advance the queue, push a duplicate tile into
        // _loopsDrivenSteps, and tick hazards.
        const haz = makeHazardLinear([{ x: 5, y: 5 }, { x: 5, y: 6 }], 0);
        const world = makeWorldWithHazards([haz], { width: 8, height: 8 });
        const panel = makePanelOnWorld(world, { playerPos: { x: 0, y: 0 } });
        panel._loopsDrivenAction = { type: 'regionMove' };
        panel._loopsDrivenSteps = [{ x: 0, y: 0 }];
        panel._loopsDrivenCost = 0;
        // Fake the visualizer: turn starts at 0, wait advances to 1.
        // First call sets _lastVisualizerTurn (no wait detected on
        // first observation, by design — initial pickup).
        panel._visualizer = { getState: () => ({ player_pos: { x: 0, y: 0 }, turn: 0 }) };
        panel._mazeQueue.append({ type: 'wait' });
        panel._onVisualizerChange();
        // Now advance the turn (simulating a wait tick).
        panel._visualizer = { getState: () => ({ player_pos: { x: 0, y: 0 }, turn: 1 }) };
        panel._onVisualizerChange();
        // Hazard ticked.
        expect(haz.phase).toBe(1);
        // Queue advanced.
        expect(panel._mazeQueue.executionIndex).toBe(1);
        // bestPath tracking saw a duplicate-tile step.
        expect(panel._loopsDrivenSteps).toEqual([
            { x: 0, y: 0 }, { x: 0, y: 0 },
        ]);
    });

    it('_executeMoveAction does not tick when loops is driving (visualizer does)', () => {
        const haz = makeHazardLinear([{ x: 5, y: 5 }, { x: 5, y: 6 }], 0);
        const world = makeWorldWithHazards([haz], { width: 8, height: 8 });
        const panel = makePanelOnWorld(world, { playerPos: { x: 0, y: 0 } });
        panel._loopsDrivenAction = { type: 'regionMove' };
        panel._executeMoveAction('E');
        // Loops walks the visualizer; the queue-executor path
        // doesn't tick — _onVisualizerChange does.
        expect(haz.phase).toBe(0);
    });
});
