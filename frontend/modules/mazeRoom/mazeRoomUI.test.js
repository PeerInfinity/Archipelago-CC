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

describe('MazeRoomUI — discovery population (fog off)', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
        resetDiscoverySingleton();
    });

    it('marks every location and exit on region entry when fog is off', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
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

    it('subsequent regions accumulate discoveries (does not clear prior marks)', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
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

    it('_seenTilesForCurrentRegion returns null when no region is loaded', () => {
        const panel = new MazeRoomUI(null, {});
        panel.currentRegionId = null;
        expect(panel._seenTilesForCurrentRegion()).toBeNull();
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

    it('fog OFF reveals every location/exit in the region on entry', () => {
        const panel = new MazeRoomUI(null, {});
        panel.fogEnabled = false;
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world: makeWorld({
                width: 6,
                height: 6,
                entrance: { x: 0, y: 0 },
                items: [
                    { x: 5, y: 5, id: 'sword', locationName: 'Distant Sword' },
                ],
                exits: [
                    { exit_id: 'east', x: 5, y: 3, side: 'E', exitName: 'east_to_cave' },
                ],
            }),
            arrivedFrom: null,
        });
        expect(discoveryStateSingleton.isLocationDiscovered('Distant Sword')).toBe(true);
        expect(discoveryStateSingleton.isExitDiscovered('Overworld', 'east_to_cave')).toBe(true);
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
