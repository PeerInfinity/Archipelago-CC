/**
 * SHARED LEVEL WORLD in the maze (tile-primitives Stage 2, session tile-primitives-stage2-l15): the
 * `shared_world` field, the owner / crossing helpers, and the panel walking Seedling L15 — the committed
 * `seedling_playthrough_maze` preset — across an in-world boundary without losing the level's state.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { MazeRoomUI } from './mazeRoomUI.js';
import { _testOnly_resetModuleState } from './index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import {
    createState, deserializeMazeWorld, checkSharedWorld, sharedWorldOwnerAt, sharedWorldCrossing,
    SHARED_WORLD_ALPHABET, TURN_PREFIX, USE_PREFIX,
} from './mazeRoomEngine.js';
import { SHARED_WORLD_ALPHABET as PROJECTION_ALPHABET, LEVEL_WORLD_USE_KEYS } from '../procgenPipeline/regionAtlasMazeProjection.js';
import { DEFAULT_USE_KEYS } from './mazeKeys.js';
import { crossEntry } from './mazeKeys.js';
import { nativeReachUnder } from './tileSpike/deriveLevelWorldLogic.js';

const PRESET = new URL('../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url);
const RULES = JSON.parse(readFileSync(PRESET, 'utf8'));
const SIDECARS = RULES.preset_sidecars['1'];
const R1C5 = 'level_15__r1c5';
const R1C9 = 'level_15__r1c9';
const R6C8 = 'level_15__r6c8';
const SWORD = 'Progressive Sword';
const l15 = () => deserializeMazeWorld(SIDECARS[R1C5].playable_payload);

describe('shared_world — the field and its readers', () => {
    it('the engine, the projection and the keys agree on the alphabet and the default use keys', () => {
        expect(SHARED_WORLD_ALPHABET).toBe(PROJECTION_ALPHABET);
        expect([...LEVEL_WORLD_USE_KEYS]).toEqual([...DEFAULT_USE_KEYS]);
    });

    it('L15 carries ONE payload; the other two sub-regions are payload-less aliases', () => {
        expect(SIDECARS[R1C5].shared_world).toBe('level_15');
        expect(SIDECARS[R1C9]).toEqual({ substrate: 'maze', shared_world: 'level_15' });
        expect(SIDECARS[R6C8]).toEqual({ substrate: 'maze', shared_world: 'level_15' });
        const w = l15();
        expect(w.sharedWorld.regions).toEqual([R1C5, R1C9, R6C8]);
        expect(w.blocks.size).toBe(1);
        expect(w.buttons.size).toBe(1);
        expect(Object.keys(w.actionLib)).toEqual(['sword', 'spear']);
    });

    it('owner lookups: an owned cell, a "no news" cell (water) and a crossing', () => {
        const w = l15();
        expect(sharedWorldOwnerAt(w, 3, 4)).toBe(R1C5);   // the stairs-up arrival
        expect(sharedWorldOwnerAt(w, 9, 2)).toBe(R1C9);
        expect(sharedWorldOwnerAt(w, 5, 6)).toBeNull();   // water
        expect(sharedWorldOwnerAt(w, 8, 3)).toBeNull();   // the lock itself
        expect(sharedWorldCrossing(w, R1C5, 9, 3)).toEqual({
            boundary: '9,3', sourceRegion: R1C5, targetRegion: R1C9, exitName: `${R1C5} -> ${R1C9}`,
        });
        expect(sharedWorldCrossing(w, R1C9, 9, 3)).toBeNull();       // already there
        expect(sharedWorldCrossing(w, 'elsewhere', 9, 3)).toBeNull(); // not a region of this world
        expect(sharedWorldOwnerAt({ sharedWorld: undefined }, 0, 0)).toBeNull();
    });

    it('a malformed shared_world is REFUSED by name', () => {
        const good = SIDECARS[R1C5].playable_payload.shared_world;
        const bad = (patch) => () => checkSharedWorld({ ...good, ...patch }, 11, 9, 't');
        expect(bad({ key: '' })).toThrow(/non-empty string "key"/);
        expect(bad({ rows: good.rows.slice(1) })).toThrow(/"rows" must be 9 strings of length 11/);
        expect(bad({ rows: good.rows.map((r, i) => (i === 1 ? `${r.slice(0, 10)}Z` : r)) }))
            .toThrow(/holds 'Z', which names no region/);
        expect(bad({ entrances: {} })).toThrow(/no entrance for "level_15__r1c5"/);
        expect(checkSharedWorld(good, 11, 9, 't').links[`${R1C5}>${R1C9}`]).toBe(`${R1C5} -> ${R1C9}`);
    });
});

/** Press the engine inputs of a plan as the keys a player would. */
const KEY_OF = { N: 'ArrowUp', S: 'ArrowDown', E: 'ArrowRight', W: 'ArrowLeft' };
function press(panel, input) {
    const ev = (key, shiftKey = false) => panel._handleKeydown({ key, shiftKey, preventDefault: () => {} });
    if (input.startsWith(TURN_PREFIX)) return ev(KEY_OF[input.slice(TURN_PREFIX.length)], true);
    if (input.startsWith(USE_PREFIX)) {
        const id = input.slice(USE_PREFIX.length);
        return ev(panel.world.actionLib[id].key);
    }
    return ev(KEY_OF[input]);
}

describe('MazeRoomUI — walking L15 across an in-world boundary', () => {
    let published;
    beforeEach(() => {
        _testOnly_resetModuleState();
        discoveryStateSingleton.discoveredRegions.clear();
        discoveryStateSingleton.discoveredLocations.clear();
        discoveryStateSingleton.discoveredExits.clear();
        discoveryStateSingleton.eventBus = { publish: () => {} };
        published = [];
    });
    afterEach(() => { MazeRoomUI.moduleApis = undefined; });

    /** A panel on L15 entered at r1c5, with procgenPlayer's same-world answer wired in. */
    function panelOnL15(inventory) {
        const panel = new MazeRoomUI(null, {});
        panel.render = () => {};
        const world = l15();
        world.itemLocationNames = world.itemLocationNames ?? new Map();
        panel.world = world;
        panel.state = createState(world);
        for (const item of inventory) panel.state.inventory.add(item);
        panel.currentRegionId = R1C5;
        MazeRoomUI.moduleApis = {
            dispatcher: {
                publish: (event, data) => {
                    published.push({ event, data });
                    // procgenPlayer's answer for two regions of one shared world.
                    if (event === 'user:regionMove') {
                        panel.applyLoadedRegion({ region_id: data.targetRegion, world, sameWorld: true });
                    }
                },
            },
        };
        return panel;
    }

    it('with the sword: break both rocks, push the block home, cross the held lock into r1c9 — state KEPT', () => {
        const panel = panelOnL15([SWORD]);
        const reach = nativeReachUnder(panel.world, [SWORD]);
        const plan = reach.planTo('9,3');
        expect(plan).not.toBeNull();
        for (const input of plan) press(panel, input);
        expect(panel._queueRefusal).toBeNull();
        expect(panel.state.player_pos).toEqual({ x: 9, y: 3 });
        expect(panel.currentRegionId).toBe(R1C9);
        // ⛓ the level's state survived the crossing: the block is still on the button,
        // both rocks still broken
        expect(panel.state.blocks).toEqual(['7,2']);
        expect(panel.state.broken).toEqual(['6,1', '6,5']);
        const moves = published.filter((p) => p.event === 'user:regionMove').map((p) => p.data);
        expect(moves).toEqual([{ sourceRegion: R1C5, targetRegion: R1C9, exitName: `${R1C5} -> ${R1C9}` }]);
        // the crossing step was PROMOTED to a cross entry carrying its regions
        const cross = panel._mazeQueue.getEntries().filter((e) => e.actionType === 'cross');
        expect(cross).toHaveLength(1);
        expect(cross[0].params).toMatchObject({ boundary: '9,3', sourceRegion: R1C5, targetRegion: R1C9 });
    });

    it('without an item the lock stays shut: the move toward r1c9 is refused and no region move is published', () => {
        const panel = panelOnL15([]);
        panel.state.player_pos = { x: 7, y: 3 };
        press(panel, 'E');
        expect(panel._queueRefusal).toMatch(/lock_0 is shut — nothing on button_0/);
        expect(panel.currentRegionId).toBe(R1C5);
        expect(published.filter((p) => p.event === 'user:regionMove')).toHaveLength(0);
    });

    it('the loop-mode gate is asked BEFORE the step: a gated cross leaves the player on the near side', () => {
        const panel = panelOnL15([]);
        panel.state.player_pos = { x: 7, y: 3 };
        panel.state.blocks = ['7,2']; // the block holds the lock open
        panel._crossGate = () => () => 'blocked for the test';
        press(panel, 'E');                                  // onto the lock cell: "no news", a plain move
        expect(panel.state.player_pos).toEqual({ x: 8, y: 3 });
        press(panel, 'E');                                  // onto (9,3): r1c9 owns it — a cross
        expect(panel._queueRefusal).toBe('cross E → level_15__r1c9 gated: blocked for the test');
        expect(panel.state.player_pos).toEqual({ x: 8, y: 3 });
        expect(panel.currentRegionId).toBe(R1C5);
    });

    it('a replayed cross from the wrong region is refused by name', () => {
        const panel = panelOnL15([]);
        const reason = panel._executeQueueAction(crossEntry('E',
            { boundary: '9,3', sourceRegion: R6C8, targetRegion: R1C9 }));
        expect(reason).toBe(`cross E → ${R1C9} refused: the player is in "${R1C5}", not "${R6C8}"`);
    });

    it('a FRESH entry into an alias region lands on that region\'s own entrance', () => {
        const panel = panelOnL15([]);
        panel.world = null;
        panel.state = null;
        panel.applyLoadedRegion({ region_id: R6C8, world: l15(), arrivedFrom: null });
        expect(panel.currentRegionId).toBe(R6C8);
        expect(panel.state.player_pos).toEqual({ x: 8, y: 6 });
        expect(panel.state.blocks).toEqual(['4,4']);
    });
});
