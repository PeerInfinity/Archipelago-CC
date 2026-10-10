/**
 * ⛓⛓ LOOP-MODE RESTART ON SEEDLING (⚖ the user, 2026-10-06: *"Loop mode has its own restart mechanic, which returns
 * to the start region and also resets mana."* / *"The start region should always be menu, not a Seedling region. But
 * we can go ahead and set up code to handle the case where it is a Seedling region, if that would be cheap and safe
 * to implement."*).
 *
 * The loops' reset (`loopState:loopReset`) moves nobody; the replay's first move does. WHAT THESE ROWS PIN:
 *   - THE HYPOTHESIS CASE (declared start = `Menu`, every committed preset): the glue's fallback DECLINES, and the
 *     replay's first move (`Menu` → the start region, the start hop) is the ONE teleport, to `seedlingStartSpawn`;
 *   - THE FALLBACK (declared start = a Seedling room — no committed preset has one, so the fixture is built here from
 *     the playthrough): in loop mode the reset moves the player into the start with the reset's shape (`fromReset`,
 *     `updatePath: false`, `restart: true`), procgenPlayer marks that load `startHop`, and the binding's start-hop
 *     arrival teleports ONCE to `seedlingStartSpawn` (§5.25's path, not a second one);
 *   - declined BY NAME: loop mode off, a new-rules reset, the player outside our regions, a queue whose first move
 *     enters the start room itself (no double teleport). Mana is never touched here.
 *
 * The live measurement (both runtimes) is `scripts/procgen/probe-seedling-loop-restart.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { seedlingStartSpawn } from './seedlingRegionBinding.js';
import { SeedlingRegionGlue, LOOP_RESET_EVENT, LOOP_RESET_MOVE_SOURCE } from './seedlingRegionGlue.js';
import { returnSpawnTable } from './seedlingReturnSpawns.js';
import { mapDocumentPath } from './mapDocumentPath.js';
import { substrateRegistryEntry as seedlingEntry, FLASH_SEEDLING_LOAD_REGION_EVENT, FLASH_SEEDLING_SUBSTRATE_ID } from './flashSeedlingLibrary.js';
import { FLASH_SEEDLING_GEN_SUBSTRATE_ID } from './flashSeedlingGenLibrary.js';
import { register, initialize, _testOnly_resetModuleState } from '../procgenPlayer/index.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url));
const PLAYTHROUGH = JSON.parse(readFileSync(`${FRONTEND}presets/seedling_playthrough/AP_1/AP_1_rules.json`, 'utf8'));
const START = 'level_0__r8c0';
const AWAY = 'level_94__r2c16';

describe('the glue — handleLoopReset decides (stubbed procgen + loop)', () => {
    function harness({ loopMode = true, startRegions = ['s'], here = 'r', queue = [], substrates = {} } = {}) {
        const subs = new Map();
        const eventBus = { subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); }, publish: () => {} };
        const published = [];
        const stops = [];
        const regionSub = { s: FLASH_SEEDLING_SUBSTRATE_ID, r: FLASH_SEEDLING_SUBSTRATE_ID, m: 'maze', ...substrates };
        const glue = new SeedlingRegionGlue({
            eventBus,
            getDispatcher: () => ({ publish: (name, data, opts) => published.push({ name, data, opts }) }),
            loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
            getProcgen: () => ({ getRegionInfo: (x) => (regionSub[x] ? { substrate: regionSub[x] } : null) }),
            stopBotWalks: () => { stops.push('stop'); return 1; },
            getLoop: () => ({
                isLoopModeActive: () => loopMode,
                getCurrentRegion: () => here,
                getStartRegions: () => startRegions,
                getActionQueue: () => queue,
            }),
        });
        glue.start();
        return { glue, published, stops, reset: (p = { mana: { current: 100, max: 100 } }) => subs.get(LOOP_RESET_EVENT)(p),
            subscribed: () => subs.has(LOOP_RESET_EVENT) };
    }

    it('subscribes loopState:loopReset at start(); a Seedling start in loop mode moves the player there with the reset\'s shape', () => {
        const h = harness({ queue: [{ type: 'regionMove', sourceRegion: 's', destinationRegion: 'r' }] });
        expect(h.subscribed()).toBe(true);
        h.reset();
        expect(h.published).toEqual([{
            name: 'user:regionMove',
            data: { sourceRegion: 'r', targetRegion: 's', exitName: null, fromReset: true, updatePath: false, restart: true,
                source: LOOP_RESET_MOVE_SOURCE },
            opts: { initialTarget: 'bottom' },
        }]);
        expect(h.glue.lastLoopReset).toMatchObject({ taken: true, why: null, start: 's', here: 'r', stoppedWalks: 1 });
        expect(h.glue.stats.loopResets).toBe(1);
        expect(h.stops).toEqual(['stop']);
    });

    it('⛓ RESTART HOLD — the stopped engines are told to EXPECT the hop\'s arrival after the stop and BEFORE the move queues it', () => {
        const h = harness({ queue: [{ type: 'regionMove', sourceRegion: 's', destinationRegion: 'r' }] });
        const order = [];
        h.glue.stopBotWalks = () => { order.push('stop'); return 1; };
        h.glue.expectBotArrivals = () => { order.push('expect'); return 1; };
        const publish = h.glue.getDispatcher().publish;
        h.glue.getDispatcher = () => ({ publish: (...a) => { order.push('move'); publish(...a); } });
        h.reset();
        expect(order).toEqual(['stop', 'expect', 'move']);
        expect(h.glue.lastLoopReset).toMatchObject({ taken: true, watching: 1 });
        // declined → nobody is told to expect anything
        const menu = harness({ startRegions: ['Menu'] });
        menu.glue.expectBotArrivals = () => { order.push('menu-expect'); return 1; };
        menu.reset();
        expect(order).not.toContain('menu-expect');
    });

    it('the generated entry counts as ours too', () => {
        const h = harness({ substrates: { s: FLASH_SEEDLING_GEN_SUBSTRATE_ID, r: FLASH_SEEDLING_GEN_SUBSTRATE_ID } });
        h.reset();
        expect(h.published).toHaveLength(1);
    });

    it('⛔ a MENU start (the hypothesis case): nothing published, nothing stopped, and no complaint (why null)', () => {
        const h = harness({ startRegions: ['Menu'] });
        h.reset();
        expect(h.published).toEqual([]);
        expect(h.stops).toEqual([]);
        expect(h.glue.lastLoopReset).toMatchObject({ taken: false, why: null, start: 'Menu', substrate: null });
    });

    it('a MAZE start: not ours either', () => {
        const h = harness({ startRegions: ['m'] });
        h.reset();
        expect(h.published).toEqual([]);
        expect(h.glue.lastLoopReset).toMatchObject({ taken: false, why: null, substrate: 'maze' });
    });

    it('⛔ loop mode OFF: nothing published, said by name', () => {
        const h = harness({ loopMode: false });
        h.reset();
        expect(h.published).toEqual([]);
        expect(h.glue.lastLoopReset).toMatchObject({ taken: false, why: 'loop mode is off' });
    });

    it('a new-rules reset (paused: true): the load takes the start itself', () => {
        const h = harness();
        h.reset({ mana: { current: 100, max: 100 }, paused: true });
        expect(h.published).toEqual([]);
        expect(h.glue.lastLoopReset.why).toMatch(/new-rules reset/);
    });

    it('the player outside our regions (Menu, a maze room): not ours to move, said by name', () => {
        for (const here of ['Menu', 'm', null]) {
            const h = harness({ here });
            h.reset();
            expect(h.published).toEqual([]);
            expect(h.glue.lastLoopReset.why).toMatch(/not a Seedling region/);
        }
    });

    it('⛔ NO DOUBLE TELEPORT: the queue\'s first move enters the start room itself — declined', () => {
        const h = harness({ queue: [{ type: 'regionMove', sourceRegion: 'r', destinationRegion: 's' }] });
        h.reset();
        expect(h.published).toEqual([]);
        expect(h.glue.lastLoopReset.why).toMatch(/first move enters "s" itself/);
        expect(h.stops).toEqual([]);
    });

    it('the player already in the start room is still put back at its spawn (the game may have walked inside it)', () => {
        const h = harness({ here: 's', queue: [{ type: 'locationCheck', sourceRegion: 's' }] });
        h.reset();
        expect(h.published.map((p) => [p.data.sourceRegion, p.data.targetRegion])).toEqual([['s', 's']]);
    });
});

/**
 * END TO END over the REAL procgenPlayer and the REAL binding: the playthrough's sidecars warehoused, the glue on the
 * same bus, the dispatcher handing `user:regionMove` to procgenPlayer's receiver, and the game's teleports counted.
 */
describe('end to end — procgenPlayer + glue + binding on the playthrough\'s rooms', () => {
    const map = JSON.parse(readFileSync(`${FRONTEND}${mapDocumentPath(PLAYTHROUGH, '1').path}`, 'utf8'));
    const returnSpawns = returnSpawnTable(map);
    const startWorld = seedlingEntry.deserializeWorld(PLAYTHROUGH.preset_sidecars['1'][START].playable_payload);
    const SPAWN = seedlingStartSpawn({ world: startWorld, returnSpawns });

    let ctx;
    beforeEach(() => { ctx = null; });

    async function boot({ startRegions, queue = [], loopMode = true }) {
        _testOnly_resetModuleState();
        substrateRegistry.clear();
        substrateRegistry.register(seedlingEntry);
        centralRegistry.publicFunctions.clear();
        const state = { here: startRegions[0], queue, loopMode };
        centralRegistry.registerPublicFunction('gameState', 'getCurrentRegion', () => state.here);
        const subs = new Map();
        const bus = {
            publish(event, data) { for (const cb of subs.get(event) ?? []) cb(data); },
            subscribe(event, cb) {
                if (!subs.has(event)) subs.set(event, new Set());
                subs.get(event).add(cb);
                return () => subs.get(event)?.delete(cb);
            },
            registerPublisher() {},
        };
        let receive = null;
        const moves = [];
        const dispatcher = {
            publish(name, data) {
                if (name !== 'user:regionMove') return;
                moves.push(data);
                receive?.(data);
            },
            // gameState follows the move (procgenPlayer forwards it up the chain).
            publishToNextModule(_m, name, data) { if (name === 'user:regionMove' && data?.targetRegion) state.here = data.targetRegion; },
        };
        const reg = {
            registerDispatcherReceiver: (...a) => { if (a[1] === 'user:regionMove' || !receive) receive = a[2]; },
            registerDispatcherSender: () => {}, registerPublicFunction: (m, f, fn) => centralRegistry.registerPublicFunction(m, f, fn),
            registerEventBusPublisher: () => {},
        };
        const teleports = [];
        const glue = new SeedlingRegionGlue({
            eventBus: bus,
            getDispatcher: () => dispatcher,
            loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
            getProcgen: () => ({ getRegionInfo: centralRegistry.getPublicFunction('procgenPlayer', 'getRegionInfo') }),
            getLoop: () => ({ isLoopModeActive: () => state.loopMode, getCurrentRegion: () => state.here,
                getStartRegions: () => startRegions, getActionQueue: () => state.queue }),
        });
        glue.binding.setReturnSpawns(returnSpawns);
        glue.adapter = { teleport: (t) => teleports.push([t.level, t.x, t.y]) };
        glue.binding.onStateReport('level', 0); // the game is reporting (baseline)
        glue.start();
        register(reg);
        await initialize('procgenPlayer', 0, {
            getEventBus: () => bus, getDispatcher: () => dispatcher,
            getLogger: () => ({ warn: () => {}, info: () => {}, error: () => {} }),
            getModuleFunction: (m, f) => (m === 'menuPanel' && f === 'isSkipMenuEnabled' ? () => true : null),
        });
        const rules = { ...PLAYTHROUGH, start_regions: { 1: startRegions } };
        bus.publish('stateManager:rawJsonDataLoaded', { rawJsonData: rules, selectedPlayerInfo: { playerId: '1' } });
        bus.publish('stateManager:rulesLoaded', {});
        /** The game reports the level it stands in (the binding consumes its own teleport's echo). */
        const report = (level) => glue.apply(glue.binding.onStateReport('level', level));
        ctx = { glue, bus, state, moves, teleports, report, receive: (d) => receive(d) };
        return ctx;
    }

    /** Away from the start: an AP move into L94 (the binding's arrival teleports the game there). */
    function goAway(c) {
        c.receive({ sourceRegion: START, targetRegion: AWAY, exitName: null });
        c.report(94);
        expect(c.state.here).toBe(AWAY);
    }

    it('⛔ MENU START (the hypothesis case): the reset warps nobody; the replay\'s first move is the ONE teleport, to seedlingStartSpawn', async () => {
        const c = await boot({ startRegions: ['Menu'],
            queue: [{ type: 'regionMove', sourceRegion: 'Menu', destinationRegion: START, exitUsed: 'GameStart' }] });
        c.report(0);
        goAway(c);
        const n = c.teleports.length;
        c.bus.publish(LOOP_RESET_EVENT, { mana: { current: 100, max: 100 } });
        expect(c.teleports.length).toBe(n);
        expect(c.glue.lastLoopReset).toMatchObject({ taken: false, why: null, start: 'Menu' });
        // the queue's replay: loops' _applyActionEffects publishes the Menu hop (fromLoop)
        c.receive({ sourceRegion: 'Menu', targetRegion: START, exitName: 'GameStart', fromLoop: true });
        expect(c.teleports.slice(n)).toEqual([[SPAWN.level, SPAWN.x, SPAWN.y]]);
        expect(c.glue.binding.arrivedByStartHop).toBe(true);
    });

    it('⛓ SEEDLING START (the fixture): the reset puts the player back at seedlingStartSpawn — ONE teleport, gameState follows', async () => {
        const c = await boot({ startRegions: [START],
            queue: [{ type: 'regionMove', sourceRegion: START, destinationRegion: AWAY, exitUsed: 'x' }] });
        c.report(0);
        goAway(c);
        const n = c.teleports.length;
        c.bus.publish(LOOP_RESET_EVENT, { mana: { current: 100, max: 100 } });
        expect(c.glue.lastLoopReset).toMatchObject({ taken: true, start: START, here: AWAY });
        expect(c.teleports.slice(n)).toEqual([[SPAWN.level, SPAWN.x, SPAWN.y]]);
        expect(c.state.here).toBe(START);
        expect(c.glue.binding).toMatchObject({ region: START, arrivedByStartHop: true, startRegion: START, restarts: 1 });
        expect(c.moves.at(-1)).toMatchObject({ fromReset: true, updatePath: false, restart: true });
        // ⛔ no check, no region move published by the binding on the warp
        expect(c.glue.stats.locationChecks).toBe(0);
        // its echo is the arrival, not a crossing
        c.report(0);
        expect(c.state.here).toBe(START);
    });

    it('SEEDLING START with loop mode OFF: nothing moves', async () => {
        const c = await boot({ startRegions: [START], loopMode: false });
        c.report(0);
        goAway(c);
        const n = c.teleports.length;
        c.bus.publish(LOOP_RESET_EVENT, { mana: { current: 100, max: 100 } });
        expect(c.teleports.length).toBe(n);
        expect(c.state.here).toBe(AWAY);
    });

    it('⛔ SEEDLING START whose first queued move ENTERS the start: the fallback declines, the move is the ONE teleport', async () => {
        const c = await boot({ startRegions: [START],
            queue: [{ type: 'regionMove', sourceRegion: AWAY, destinationRegion: START, exitUsed: 'x' }] });
        c.report(0);
        goAway(c);
        const n = c.teleports.length;
        c.bus.publish(LOOP_RESET_EVENT, { mana: { current: 100, max: 100 } });
        expect(c.teleports.length).toBe(n);
        expect(c.glue.lastLoopReset.why).toMatch(/itself/);
        c.receive({ sourceRegion: AWAY, targetRegion: START, exitName: null, fromLoop: true });
        expect(c.teleports.length - n).toBe(1);
    });
});

void vi;
