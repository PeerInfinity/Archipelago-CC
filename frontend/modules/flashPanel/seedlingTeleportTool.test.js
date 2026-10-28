/**
 * ⛓⛓ THE SEEDLING PANEL'S TOOLS: RESTART, AND THE TELEPORT TOOL THROUGH THE ARRIVAL PATH (⚖ the user, 2026-10-28:
 * copy the Menu panel's reset button into the Seedling panel, and *"check if the teleport tool is missing any of the
 * updates that would happen if the player manually walked through an exit"*).
 *
 * WHAT THESE ROWS PIN:
 *   - Tools ▸ Restart calls the Menu panel's own `restart` (its public function): one code path, so the AP move, the
 *     `menuPanel:restarted` event and every listener of it are the Menu button's. A private copy fails the pin.
 *   - THE GAP, AS MAIN HAS IT: a game-only teleport reaches the binding as a level change nobody walked — read as a
 *     door when the AP region has one to that level (a faked "came from"), warned about and NOT moved otherwise.
 *   - THE FIX: `teleportTool` stops a walk in flight, moves the AP player with no door (the Restart's warp shape),
 *     the binding's own arrival lands it and swallows the echo, and a spot asked for is the second teleport.
 *   - A decline is named, and the panel then teleports the game alone, as before.
 *
 * The live witness (both runtimes) is the in-app pair `seedling-{js,wasm}-runtime-tools-teleport`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { centralRegistry } from '../../app/core/centralRegistry.js';
import { SeedlingRegionGlue, TELEPORT_TOOL_SOURCE } from './seedlingRegionGlue.js';
import { substrateRegistryEntry as seedlingEntry, FLASH_SEEDLING_LOAD_REGION_EVENT } from './flashSeedlingLibrary.js';
import { RESTARTED_EVENT } from '../menuPanel/menuPanelEngine.js';

const glueHolder = vi.hoisted(() => ({ glue: null }));
vi.mock('./index.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getSeedlingRegionGlue: () => glueHolder.glue,
}));
const { FlashPanelUI } = await import('./flashPanelUI.js');

const PRESET = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../presets/seedling_atlas/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
const SIDECARS = PRESET.preset_sidecars['1'];
const worldFor = (id) => seedlingEntry.deserializeWorld(SIDECARS[id].playable_payload);
const START = 'overworld_start__r8c0';
const OWLS = 'owls_nest_entrance'; // level 2: the start has a door to it (its stairs)
const DUNGEON = 'dungeon1_room1__r0c4'; // level 3: the start has no door to it

/**
 * The glue between two stand-ins: procgenPlayer (a move loads its target with the `arrivedFrom` procgenPlayer would
 * resolve — a teleport's is null) and gameState (the region a move lands in). The warehouse is the preset's.
 */
function harness({ loop = false } = {}) {
    const subs = new Map();
    const eventBus = { subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); }, publish: () => {} };
    const moves = [];
    let here = 'Menu';
    const warehouse = new Map(Object.entries(SIDECARS).map(([id, sc]) => [id, { substrate: sc.substrate, world: worldFor(id) }]));
    const dispatcher = {
        publish: (name, data) => {
            if (name !== 'user:regionMove') return;
            moves.push(data);
            here = data.targetRegion;
            const exit = data.exitName && SIDECARS[data.sourceRegion] ? worldFor(data.sourceRegion).exits.get(data.exitName) : null;
            subs.get(FLASH_SEEDLING_LOAD_REGION_EVENT)({ region_id: data.targetRegion, world: worldFor(data.targetRegion),
                arrivedFrom: exit?.targetExitId ? { exit_id: exit.targetExitId, source_region: data.sourceRegion } : null });
        },
    };
    const stops = vi.fn(() => 1);
    const glue = new SeedlingRegionGlue({
        eventBus,
        getDispatcher: () => dispatcher,
        loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
        getPanel: () => ({ _panelLog: () => {} }),
        getProcgen: () => ({
            getRegionInfo: (r) => (warehouse.has(r) ? { substrate: warehouse.get(r).substrate } : null),
            getWarehouse: () => warehouse,
        }),
        getLoop: () => ({ isLoopModeActive: () => loop, getCurrentRegion: () => here }),
        stopBotWalks: stops,
    });
    glue.start();
    const adapter = { teleport: vi.fn(() => true), pushNow: vi.fn(() => true), onStateReport: null };
    glue.attachAdapter(adapter);
    const report = (p, v) => adapter.onStateReport(p, v);
    // the new game: the start hop, the game's first report (the baseline), its arrival landed
    dispatcher.publish('user:regionMove', { sourceRegion: 'Menu', targetRegion: START, exitName: 'GameStart' });
    report('level', 0);
    adapter.teleport.mockClear();
    moves.length = 0;
    return { glue, adapter, moves, report, stops, region: () => here };
}

vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('THE GAP, as main has it: a game-only teleport is a level change nobody walked', () => {
    it('into a level the AP region has a DOOR to: read as that door — a "came from" the player never used', () => {
        const h = harness();
        h.adapter.teleport({ level: 2, x: 200, y: 200 }); // main's `_manualTeleport`
        h.report('level', 2);
        expect(h.moves.map((m) => m.exitName)).toEqual([`${START} -> ${OWLS}`]);
    });

    it('into a level it has NO door to: warned, and the AP region stays behind', () => {
        const h = harness();
        h.adapter.teleport({ level: 3, x: 64, y: 32 });
        h.report('level', 3);
        expect(h.moves).toEqual([]);
        expect(h.glue.binding.region).toBe(START);
        expect(h.glue.stats.warnings).toBe(1);
    });
});

describe('teleportTool — the AP move with no door, then the binding\'s own arrival', () => {
    it('moves the AP player with the warp\'s shape (no exit, no path entry), stopping a walk in flight first', () => {
        const h = harness();
        const r = h.glue.teleportTool({ region: DUNGEON });
        expect(r).toMatchObject({ taken: true, why: null, from: START, region: DUNGEON, stoppedWalks: 1 });
        expect(h.stops).toHaveBeenCalledTimes(1);
        expect(h.moves).toEqual([{ sourceRegion: START, targetRegion: DUNGEON, exitName: null, source: TELEPORT_TOOL_SOURCE,
            fromReset: true, updatePath: false }]);
        expect(h.region()).toBe(DUNGEON);
        expect(h.glue.binding.region).toBe(DUNGEON);
        // ⚖ no faked "came from": the no-door arrival lands at the region's FIRST exit's spawn
        expect(h.glue.binding.arrivedFrom).toBe(null);
        expect(h.adapter.teleport).toHaveBeenCalledTimes(1);
        expect(h.adapter.teleport.mock.calls[0][0].level).toBe(3);
    });

    it('the arrival\'s level report is its own echo: swallowed, no crossing, no warning', () => {
        const h = harness();
        h.glue.teleportTool({ region: DUNGEON });
        h.report('level', 3);
        expect(h.moves).toHaveLength(1);
        expect(h.glue.stats.warnings).toBe(0);
        expect(h.glue.binding.lastLevel).toBe(3);
    });

    it('a SPOT (Go / Location): the region that owns its level, then the spot itself, after the arrival', () => {
        const h = harness();
        const r = h.glue.teleportTool({ level: 2, x: 200, y: 200 });
        expect(r).toMatchObject({ taken: true, region: OWLS });
        expect(h.moves[0]).toMatchObject({ targetRegion: OWLS, exitName: null });
        const calls = h.adapter.teleport.mock.calls.map((c) => c[0]);
        expect(calls).toHaveLength(2);
        expect(calls[1]).toEqual({ level: 2, x: 200, y: 200 });
        h.report('level', 2);
        expect(h.moves).toHaveLength(1);
        expect(h.glue.binding.region).toBe(OWLS);
    });

    it('declines BY NAME, moving nothing: loop mode, a parked binding, a level no region of ours is, no game', () => {
        const loop = harness({ loop: true });
        expect(loop.glue.teleportTool({ region: DUNGEON })).toMatchObject({ taken: false, why: expect.stringMatching(/loop mode/) });
        expect(loop.moves).toEqual([]);
        expect(loop.stops).not.toHaveBeenCalled();
        const h = harness();
        expect(h.glue.teleportTool({ level: 50, x: 16, y: 16 })).toMatchObject({ taken: false, why: 'no Seedling region of this preset is level 50' });
        expect(h.glue.teleportTool({ region: 'Menu' })).toMatchObject({ taken: false, why: '"Menu" is not a Seedling region of this preset' });
        h.glue.binding.setActive(false);
        expect(h.glue.teleportTool({ region: DUNGEON }).why).toMatch(/parked/);
        h.glue.detachAdapter();
        expect(h.glue.teleportTool({ region: DUNGEON }).why).toBe('no game is attached');
        expect(h.moves).toEqual([]);
    });

    /**
     * MEASURED (in-app, both runtimes): the owl's-nest stairs land the player on (256, 256) of level 0, the stairs'
     * approach cell — crossing material, in NO sub-region of the partition. The spot then belongs to the nearest
     * ring of tiles that holds one, when that ring agrees; two sub-regions at the same distance are refused.
     */
    it('a spot on crossing material takes the nearest sub-region (the ring agrees), and is refused between two', () => {
        const h = harness();
        // level 0, 4 x 1 tiles: a | . | . | b  (origin 0,0; one entry, two sub-regions)
        const map = { tileSize: 16, alphabet: 'ab', levels: new Map([[0, [{ region: 'overworld_start', origin: [0, 0],
            rows: ['a..b'], subs: ['r8c0', 'r1c6'] }]]]), worlds: new Map(), links: new Map() };
        h.glue.binding.subRegions = map;
        // constructor (0,0) → centre (8,8): tile 0, sub-region a, directly
        expect(h.glue._regionAtSpot({ level: 0, x: 0, y: 0 })).toBe('overworld_start__r8c0');
        // tile 1 is crossing material: ring 1 holds only a (tile 0) and the empty tile 2
        expect(h.glue._regionAtSpot({ level: 0, x: 16, y: 0 })).toBe('overworld_start__r8c0');
        // a 5-tile row with the middle tile two away from both: refused, by name
        map.levels.get(0)[0].rows = ['a...b'];
        expect(h.glue._regionAtSpot({ level: 0, x: 32, y: 0 }).why).toMatch(/between sub-regions/);
    });

    it('a level of SEVERAL regions with no partition is refused, never guessed (the dungeon is two)', () => {
        const h = harness();
        expect(h.glue.teleportTool({ level: 3, x: 64, y: 32 }).why).toMatch(/level 3 is 2 regions/);
    });
});

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────

function barePanel() {
    const panel = Object.create(FlashPanelUI.prototype);
    const logs = [];
    const adapter = { teleport: vi.fn(() => true), teleportToRegion: vi.fn(() => true), teleportToLocation: vi.fn(() => true) };
    Object.assign(panel, {
        adapter,
        gameConfig: { location_coords: { Sword: { level: 10, x: 48, y: 64 } }, region_coords: {} },
        teleportLevelInput: { value: '3' }, teleportXInput: { value: '64' }, teleportYInput: { value: '32' },
        _panelLog: (m) => logs.push(m),
    });
    return { panel, adapter, logs };
}

describe('the panel — every Tools teleport asks the glue first', () => {
    afterEach(() => { glueHolder.glue = null; });

    it('Go / region / location reach `teleportTool`, and the game is not teleported behind its back', () => {
        const { panel, adapter } = barePanel();
        const teleportTool = vi.fn(() => ({ taken: true }));
        glueHolder.glue = { adapter, teleportTool };
        panel._manualTeleport();
        panel._teleportToRegion(DUNGEON);
        panel._teleportToLocation('Sword');
        expect(teleportTool.mock.calls.map((c) => c[0])).toEqual([
            { level: 3, x: 64, y: 32 }, { region: DUNGEON }, { level: 10, x: 48, y: 64 }]);
        expect(adapter.teleport).not.toHaveBeenCalled();
        expect(adapter.teleportToRegion).not.toHaveBeenCalled();
        expect(adapter.teleportToLocation).not.toHaveBeenCalled();
    });

    it('a decline is logged by name and the game is teleported alone, as before', () => {
        const { panel, adapter, logs } = barePanel();
        glueHolder.glue = { adapter, teleportTool: () => ({ taken: false, why: 'loop mode is on' }) };
        panel._manualTeleport();
        expect(adapter.teleport).toHaveBeenCalledWith({ level: 3, x: 64, y: 32 });
        expect(logs).toEqual(['teleport: the AP region was not moved — loop mode is on']);
    });

    it('a glue bound to ANOTHER adapter (a stale page) is not asked', () => {
        const { panel, adapter } = barePanel();
        const teleportTool = vi.fn();
        glueHolder.glue = { adapter: {}, teleportTool };
        panel._manualTeleport();
        expect(teleportTool).not.toHaveBeenCalled();
        expect(adapter.teleport).toHaveBeenCalledTimes(1);
    });
});

describe('Tools ▸ Restart — the Menu panel\'s own Restart, one code path', () => {
    let restart;
    let bus;
    let glue;
    beforeEach(() => {
        restart = vi.fn(() => ({ mode: 'world', target: 'Menu' }));
        bus = [];
        glue = { lastRestart: null, handleMenuRestart: vi.fn() };
        glueHolder.glue = glue;
        vi.spyOn(centralRegistry, 'getPublicFunction').mockImplementation((m, f) => (m === 'menuPanel' && f === 'restart' ? restart : null));
    });
    afterEach(() => { vi.restoreAllMocks(); glueHolder.glue = null; });

    /** The pin: the press is ONE call of the shared function, and nothing else of its own. */
    const pressIsTheMenusRestart = (press) => {
        press();
        return restart.mock.calls.length === 1 && glue.handleMenuRestart.mock.calls.length === 0 && bus.length === 0;
    };

    it('the press calls menuPanel.restart once — no private warp, no event of its own', () => {
        const { panel } = barePanel();
        expect(pressIsTheMenusRestart(() => panel._toolsRestart())).toBe(true);
    });

    it('MUTANT: a private copy (the glue called directly, the event published by the panel) fails the pin', () => {
        const { panel } = barePanel();
        panel._toolsRestart = function privateCopy() {
            bus.push({ name: RESTARTED_EVENT, data: { mode: 'world' } });
            glue.handleMenuRestart({ mode: 'world' });
        };
        expect(pressIsTheMenusRestart(() => panel._toolsRestart())).toBe(false);
    });

    it('the glue\'s silent decline (a start that is not ours) is said in the panel log; a named one is the glue\'s own line', () => {
        const { panel, logs } = barePanel();
        restart.mockImplementation(() => { glue.lastRestart = { taken: false, why: null, start: 'maze_0' }; return { mode: 'world', target: 'Menu' }; });
        panel._toolsRestart();
        expect(logs).toEqual(['Restart: the AP player is back at "Menu"; the start region "maze_0" is not a Seedling room, so the game was not moved']);
        logs.length = 0;
        restart.mockImplementation(() => { glue.lastRestart = { taken: false, why: 'a loop-mode restart is not ours' }; return { mode: 'loop' }; });
        panel._toolsRestart();
        expect(logs).toEqual([]);
    });

    it('no Menu panel module: nothing moves, and the log says why', () => {
        const { panel, logs } = barePanel();
        restart = undefined;
        centralRegistry.getPublicFunction.mockImplementation(() => undefined);
        expect(panel._toolsRestart()).toBe(null);
        expect(logs[0]).toMatch(/Menu panel module is not loaded/);
        expect(glue.handleMenuRestart).not.toHaveBeenCalled();
    });

});
