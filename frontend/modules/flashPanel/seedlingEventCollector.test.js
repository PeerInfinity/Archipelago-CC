/**
 * ⛓ OBSTACLE EVENTS — the runtime collector (`seedlingEventCollector.js`) and its place in the region glue.
 *
 * The events are the committed playthrough's (`runtimeEventsOf`). A game-state event is collected when the GAME's
 * flag is set — a live `pendingCheck` clear (both runtimes report one) or the load read of
 * `botStatus.persistence_cleared` — and never because its region is reachable. The glue collects it as a LOCAL event
 * check (`collectEvent`), never through `user:locationCheck` (whose connected path drops an id-less location).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { SeedlingEventCollector } from './seedlingEventCollector.js';
import { SeedlingRegionGlue } from './seedlingRegionGlue.js';
import { runtimeEventsOf } from './seedlingPlaybackController.js';
import { FLASH_SEEDLING_LOAD_REGION_EVENT } from './flashSeedlingLibrary.js';

const PT = JSON.parse(readFileSync(fileURLToPath(new URL(
    '../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
const { events: EVENTS } = runtimeEventsOf(PT, '1');
const ROCK = EVENTS.find((e) => e.eventId === 'flag:L0:1');
const WALL = EVENTS.find((e) => e.eventId === 'flag:L0:4');
const clear = (seq, level, tag) => `${seq}|${level}|${tag}|0`;
const restore = (seq, level, tag) => `${seq}|${level}|${tag}|1`;
const collector = (over = {}) => new SeedlingEventCollector({ getEvents: () => EVENTS, ...over });

describe('the events the collector reads', () => {
    it('the playthrough\'s game_state events, each with its flag {level, tag}', () => {
        // ⛓ RULES lock-events added the 11 latching bosslocks (L12:3/4/5/11, L19:1, L30:0/2, L31:0, L40:8, L48:1, L68:0);
        //   RULES l38-button-event the L38 press that clears L39's plug (L39:8 — its event sits in level_38's region)
        expect(EVENTS.map((e) => e.eventId)).toEqual(['flag:L0:1', 'flag:L0:4', 'flag:L12:4', 'flag:L12:5', 'flag:L12:11',
            'flag:L12:3', 'flag:L12:7', 'flag:L12:12', 'flag:L19:1', 'flag:L24:0', 'flag:L30:0', 'flag:L30:2', 'flag:L31:0',
            'flag:L39:8', 'flag:L40:8', 'flag:L48:1', 'flag:L68:0', 'flag:L71:2', 'flag:L112:1', 'flag:L113:0']);
        expect(ROCK).toMatchObject({ location: 'L0 flag 1: breakablerock@288,176 cleared', level: 0, tag: 1 });
    });
});

describe('SeedlingEventCollector — LIVE (a pendingCheck clear)', () => {
    it('the flag set → the event collected, once (a re-clear is a repeat)', () => {
        const c = collector();
        expect(c.onStateReport('pendingCheck', clear(1, 0, 1))).toEqual([{ type: 'eventCollect', location: ROCK.location,
            eventId: 'flag:L0:1', level: 0, tag: 1, at: 'live' }]);
        expect(c.onStateReport('pendingCheck', clear(2, 0, 1))).toEqual([]);
        expect(c.stats).toMatchObject({ live: 1, repeats: 1 });
    });

    it('a slot that is no event\'s flag, a restore, another property, an empty boot report: nothing', () => {
        const c = collector();
        expect(c.onStateReport('pendingCheck', clear(1, 0, 9))).toEqual([]);
        expect(c.onStateReport('pendingCheck', restore(2, 0, 1))).toEqual([]);
        expect(c.onStateReport('level', 0)).toEqual([]);
        expect(c.onStateReport('pendingCheck', '')).toEqual([]);
        expect(c.stats).toMatchObject({ other: 1, restores: 1, live: 0 });
    });

    it('a clear inside a host botStart\'s arming window is a tape DECLARATION, not the player\'s doing', () => {
        const c = collector({ insideHostStart: (seq) => seq > 10 && seq <= 12 });
        expect(c.onStateReport('pendingCheck', clear(11, 0, 1))).toEqual([]);
        expect(c.stats.armingWindow).toBe(1);
        expect(c.onStateReport('pendingCheck', clear(13, 0, 1))).toHaveLength(1);
    });
});

describe('SeedlingEventCollector — AT LOAD (botStatus.persistence_cleared)', () => {
    it('a save where the rock is already broken collects at load; other cleared slots are not events', () => {
        const c = collector();
        expect(c.onLoad([{ level: 86, tag: 0 }, { level: 0, tag: 1 }, { level: 0, tag: 4 }]).map((e) => [e.location, e.at]))
            .toEqual([[ROCK.location, 'load'], [WALL.location, 'load']]);
        // the live clear of a flag the load already collected is a repeat
        expect(c.onStateReport('pendingCheck', clear(1, 0, 1))).toEqual([]);
    });

    it('no readout (a page with no persistence_cleared) is not a read; a new game re-reads', () => {
        const c = collector();
        expect(c.onLoad(undefined)).toEqual([]);
        expect(c.stats.loadReads).toBe(0);
        c.onLoad([{ level: 0, tag: 1 }]);
        c.onGameRestart();
        expect(c.onLoad([{ level: 0, tag: 1 }])).toHaveLength(1);
    });

    it('requires its events source', () => {
        expect(() => new SeedlingEventCollector({})).toThrow(/getEvents/);
    });
});

/** The glue with a collector, a fake game (its botStatus) and a dispatcher that records what is published. */
function harness({ cleared = [] } = {}) {
    const subs = new Map();
    const eventBus = { subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); }, publish: () => {} };
    const published = [];
    const collected = [];
    const glue = new SeedlingRegionGlue({
        eventBus,
        getDispatcher: () => ({ publish: (name, data) => published.push({ name, data }) }),
        loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
        getPanel: () => ({ _panelLog: () => {} }),
        getEvents: () => EVENTS,
        collectEvent: (location) => { collected.push(location); return Promise.resolve(true); },
    });
    glue.start();
    const game = { botStatus: vi.fn(() => JSON.stringify({ level: 0, x: 16, y: 128, persistence_cleared: cleared })) };
    const adapter = { teleport: vi.fn(() => true), onStateReport: null, _getFlash: () => game };
    return { glue, adapter, game, published, collected, emitLoad: (p) => subs.get(FLASH_SEEDLING_LOAD_REGION_EVENT)(p) };
}

describe('the region glue — the collector is the third reader of the reports', () => {
    it('a live clear of the rock\'s flag → collectEvent(location), never a user:locationCheck', () => {
        const h = harness();
        h.glue.attachAdapter(h.adapter);
        h.adapter.onStateReport('pendingCheck', clear(1, 0, 1));
        expect(h.collected).toEqual([ROCK.location]);
        expect(h.published.filter((p) => p.name === 'user:locationCheck')).toEqual([]);
        expect(h.glue.stats.eventsCollected).toBe(1);
    });

    it('the FIRST region load reads botStatus once: a save where the rock is broken collects at load', () => {
        const h = harness({ cleared: [{ level: 0, tag: 1 }] });
        h.glue.attachAdapter(h.adapter);
        expect(h.collected).toEqual([]);
        h.emitLoad({ region_id: 'level_0__r8c0', world: null });
        expect(h.collected).toEqual([ROCK.location]);
        h.emitLoad({ region_id: 'level_0__r8c0', world: null });
        expect(h.game.botStatus).toHaveBeenCalledTimes(1);
        // an AP load landing re-reads (setCheckBinding), and collects nothing twice
        h.glue.setCheckBinding({ hostOwnedLocations: () => new Set(), onStateReport: () => [], onGameRestart: () => {} });
        expect(h.collected).toEqual([ROCK.location]);
    });

    it('⛔ NEVER ON REACHABILITY: a region load INTO the event\'s own region, flag not set, collects nothing', () => {
        const h = harness({ cleared: [] });
        h.glue.attachAdapter(h.adapter);
        h.emitLoad({ region_id: ROCK.side, world: null });
        h.emitLoad({ region_id: ROCK.across[0], world: null });
        expect(h.collected).toEqual([]);
    });

    it('a glue built without the collector deps has none (today\'s behaviour)', () => {
        const glue = new SeedlingRegionGlue({ eventBus: { subscribe: () => () => {} }, loadRegionEvent: 'x' });
        expect(glue.eventCollector).toBeNull();
        expect(glue.syncEventsFromGame()).toBeNull();
    });
});
