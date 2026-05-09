import { describe, it, expect, beforeEach } from 'vitest';

import { MazeRoomUI } from './mazeRoomUI.js';
import { _testOnly_resetModuleState } from './index.js';
import discoveryStateSingleton from '../discovery/singleton.js';

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

    it('_pickBestExit — prefers lowest saved best-path cost (Phase 6f)', () => {
        const gs = createGameStateSingleton(null);
        // Pre-record best paths: exit_a is cheap (10), exit_b is expensive (50).
        gs.recordBestPath('Forest|south|exit:exit_a', [{ x: 0, y: 0 }, { x: 1, y: 1 }], 10);
        gs.recordBestPath('Forest|south|exit:exit_b', [{ x: 0, y: 0 }, { x: 5, y: 5 }], 50);

        const panel = new MazeRoomUI(null, {});
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
        // Fresh gameState; no saved paths.
        const gs = createGameStateSingleton(null);
        const panel = new MazeRoomUI(null, {});
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
        // gameState was unused for selection (no recordings)
        expect(gs.bestPaths.size).toBe(0);
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

    it('_recordBestPathIfBetter writes the walked path into gameState.bestPaths (Phase 6e)', () => {
        const gs = createGameStateSingleton(null);
        const panel = new MazeRoomUI(null, {});
        panel.currentRegionId = 'Forest';
        panel._loopsDrivenSteps = [
            { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
        ];
        panel._loopsDrivenCost = 7.5;
        panel._loopsDrivenArrivedFrom = 'south_door';
        panel._recordBestPathIfBetter({ kind: 'exit', exitId: 'north_door' });
        const stored = gs.getBestPath('Forest|south_door|exit:north_door');
        expect(stored).toEqual({
            steps: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
            cost: 7.5,
        });
    });

    it('_recordBestPathIfBetter is a no-op without tracking state', () => {
        const gs = createGameStateSingleton(null);
        const panel = new MazeRoomUI(null, {});
        panel.currentRegionId = 'Forest';
        panel._loopsDrivenSteps = null; // not tracking
        expect(() => panel._recordBestPathIfBetter({ kind: 'exit', exitId: 'e' }))
            .not.toThrow();
        expect(gs.bestPaths.size).toBe(0);
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
