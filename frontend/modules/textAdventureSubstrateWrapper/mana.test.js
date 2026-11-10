/**
 * Behavior-parity tests for the wrapper's mana leg (mana.js). Written
 * against the pre-resourceChannels implementation and kept unchanged
 * across the migration (cross-game R1 slice 2) — passing on both sides
 * is the deduction/XP/reset parity evidence.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { centralRegistry } from '../../app/core/centralRegistry.js';
import {
    createGameStateSingleton,
    _testOnly_resetGameStateSingleton,
} from '../gameState/singleton.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { chargeMana } from '../resourceChannels/resourceChannelsLibrary.js';
import { substrateRegistryEntry as mazeEntry } from '../mazeRoom/mazeRoomLibrary.js';
import { initManaWiring, getHeaderInfoEvent } from './mana.js';

function makeFakeBus() {
    const handlers = new Map();
    const published = [];
    return {
        published,
        subscribe(event, cb) {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(cb);
            return () => {};
        },
        publish(event, data) {
            published.push({ event, data });
            for (const cb of handlers.get(event) ?? []) cb(data);
        },
    };
}

function makeFakeDispatcher() {
    const published = [];
    return {
        published,
        publish(event, data, opts) {
            published.push({ event, data, opts });
        },
    };
}

const MANA_REGIONS = new Set(['A', 'B', 'SelfBilled', 'SelfBilled2', 'Own', 'Undeclared', 'MazeRoom', 'MazeRoom2',
    'Cloudberry', 'Cloudberry2', 'Noiz2sa', 'Noiz2sa2']);
const REGION_SUBSTRATES = {
    SelfBilled: 'self_billing',
    SelfBilled2: 'self_billing',
    Own: 'text_adventure',
    Undeclared: 'no_declaration',
    Cloudberry: 'cloudberry',
    Cloudberry2: 'cloudberry',
    Noiz2sa: 'noiz2sa',
    Noiz2sa2: 'noiz2sa',
    MazeRoom: mazeEntry.id,
    MazeRoom2: mazeEntry.id,
};

let unwire = null;

function stubRegistry({ startRegion = 'Start' } = {}) {
    centralRegistry.publicFunctions.set('procgenPlayer', new Map([
        ['getRegionInfo', (name) => ({
            manaEnabled: MANA_REGIONS.has(name),
            substrate: REGION_SUBSTRATES[name],
        })],
        ['getResolvedStartRegion', () => startRegion],
    ]));
    // Quiet null cost data manager → default costs (50 move / 10 location).
    centralRegistry.publicFunctions.set('loops', new Map([
        ['getCostDataManager', () => null],
    ]));
}

beforeEach(() => {
    _testOnly_resetGameStateSingleton();
    stubRegistry();
});

afterEach(() => {
    unwire?.();
    unwire = null;
    centralRegistry.publicFunctions.delete('procgenPlayer');
    centralRegistry.publicFunctions.delete('loops');
    substrateRegistry.clear();
    vi.restoreAllMocks();
});

function wire({ currentRegion = 'A', dispatcher = makeFakeDispatcher() } = {}) {
    const gs = createGameStateSingleton(null);
    gs.currentRegion = currentRegion;
    const bus = makeFakeBus();
    unwire = initManaWiring({ eventBus: bus, dispatcher });
    return { gs, bus, dispatcher };
}

describe('wrapper mana leg — region moves', () => {
    it('charges the OLD region default move cost (50) and awards 1:1 XP on depart', () => {
        const { gs, bus } = wire();
        bus.publish('gameState:regionChanged', { oldRegion: 'A', newRegion: 'B' });
        expect(gs.getCurrentMana()).toBe(50);
        expect(gs.getRegionXP('A').xp).toBe(50);
    });

    it('skips the charge on fromReset region changes', () => {
        const { gs, bus } = wire();
        bus.publish('gameState:regionChanged', { oldRegion: 'A', newRegion: 'B', fromReset: true });
        expect(gs.getCurrentMana()).toBe(100);
    });

    it('skips the charge while loop mode is active', () => {
        const { gs, bus } = wire();
        bus.publish('gameState:loopModeChanged', { active: true });
        bus.publish('gameState:regionChanged', { oldRegion: 'A', newRegion: 'B' });
        expect(gs.getCurrentMana()).toBe(100);
        bus.publish('gameState:loopModeChanged', { active: false });
        bus.publish('gameState:regionChanged', { oldRegion: 'B', newRegion: 'A' });
        expect(gs.getCurrentMana()).toBe(50);
    });

    it('skips the charge when departing a non-mana region', () => {
        const { gs, bus } = wire({ currentRegion: 'NoMana' });
        bus.publish('gameState:regionChanged', { oldRegion: 'NoMana', newRegion: 'A' });
        expect(gs.getCurrentMana()).toBe(100);
    });

    it('depletion on a move fires the loop reset teleport (no dispatch opts, pre-move source region)', () => {
        const { gs, bus, dispatcher } = wire();
        gs.deductMana(60); // 40 left; move costs 50 → depleted
        bus.publish('gameState:regionChanged', { oldRegion: 'A', newRegion: 'B' });
        expect(gs.getLoopResetCount()).toBe(1);
        expect(gs.getCurrentMana()).toBe(100); // refilled
        expect(dispatcher.published).toEqual([{
            event: 'user:regionMove',
            data: {
                sourceRegion: 'A',
                targetRegion: 'Start',
                fromReset: true,
                updatePath: false,
            },
            opts: undefined,
        }]);
    });

    it('reset still fires when no start region resolves, but no teleport is dispatched — declared start regions are NOT a fallback', () => {
        const { gs, bus, dispatcher } = wire();
        stubRegistry({ startRegion: null });
        gs.startRegions = ['DeclaredStart'];
        gs.deductMana(60);
        bus.publish('gameState:regionChanged', { oldRegion: 'A', newRegion: 'B' });
        expect(gs.getLoopResetCount()).toBe(1);
        expect(dispatcher.published).toHaveLength(0);
    });
});

describe('wrapper mana leg — location checks', () => {
    it('charges default location cost (10) per newly checked location, with 1:1 XP', () => {
        const { gs, bus } = wire();
        bus.publish('stateManager:snapshotUpdated', {
            snapshot: { checkedLocations: ['L1', 'L2'] },
        });
        expect(gs.getCurrentMana()).toBe(80);
        expect(gs.getRegionXP('A').xp).toBe(20);
        // Same snapshot again → nothing newly checked → no further charge.
        bus.publish('stateManager:snapshotUpdated', {
            snapshot: { checkedLocations: ['L1', 'L2'] },
        });
        expect(gs.getCurrentMana()).toBe(80);
    });

    it('stops charging mid-list when a check depletes the pool', () => {
        const { gs, bus, dispatcher } = wire();
        gs.deductMana(85); // 15 left; L1 → 5, L2 → 0 (reset), L3 uncharged
        bus.publish('stateManager:snapshotUpdated', {
            snapshot: { checkedLocations: ['L1', 'L2', 'L3'] },
        });
        expect(gs.getLoopResetCount()).toBe(1);
        expect(gs.getRegionXP('A').xp).toBe(20); // only L1 + L2 awarded
        expect(dispatcher.published).toHaveLength(1);
        expect(dispatcher.published[0].data.fromReset).toBe(true);
    });

    it('does not charge checks while loop mode is active', () => {
        const { gs, bus } = wire();
        bus.publish('gameState:loopModeChanged', { active: true });
        bus.publish('stateManager:snapshotUpdated', {
            snapshot: { checkedLocations: ['L1'] },
        });
        expect(gs.getCurrentMana()).toBe(100);
    });
});

describe('wrapper mana leg — regions another substrate bills', () => {
    const CHECK = { snapshot: { checkedLocations: ['L1'] } };

    function register() {
        substrateRegistry.register({ id: 'self_billing', sharing: { mana: {} } });
        substrateRegistry.register({ id: 'text_adventure', sharing: { mana: {} } });
        substrateRegistry.register({ id: 'no_declaration' });
    }

    it('a maze pickup is charged once: the panel\'s charge, and nothing from the snapshot that follows', () => {
        substrateRegistry.register(mazeEntry);
        const { gs, bus } = wire({ currentRegion: 'MazeRoom' });
        chargeMana({ substrateId: mazeEntry.id, amount: 78, regionId: 'MazeRoom' });
        bus.publish('stateManager:snapshotUpdated', CHECK);
        expect(gs.getCurrentMana()).toBe(22);
        expect(gs.getLoopResetCount()).toBe(0);
    });

    it('a maze exit is charged once: the panel\'s per-tile charge, and no move cost on departure', () => {
        substrateRegistry.register(mazeEntry);
        const { gs, bus } = wire({ currentRegion: 'MazeRoom' });
        chargeMana({ substrateId: mazeEntry.id, amount: 12.5, regionId: 'MazeRoom' });
        bus.publish('gameState:regionChanged', { oldRegion: 'MazeRoom', newRegion: 'MazeRoom2' });
        expect(gs.getCurrentMana()).toBe(87.5);
    });

    it('a location check in a region whose substrate declares sharing.mana is not charged', () => {
        register();
        const { gs, bus } = wire({ currentRegion: 'SelfBilled' });
        bus.publish('stateManager:snapshotUpdated', CHECK);
        expect(gs.getCurrentMana()).toBe(100);
        expect(gs.getRegionXP('SelfBilled').xp).toBe(0);
    });

    it('departing such a region is not charged, and no reset can fire from here', () => {
        register();
        const { gs, bus } = wire({ currentRegion: 'SelfBilled' });
        gs.deductMana(99);
        bus.publish('gameState:regionChanged', { oldRegion: 'SelfBilled', newRegion: 'SelfBilled2' });
        expect(gs.getCurrentMana()).toBe(1);
        expect(gs.getLoopResetCount()).toBe(0);
    });

    it('still charges the text adventure\'s own regions, which declare sharing.mana too', () => {
        register();
        const { gs, bus } = wire({ currentRegion: 'Own' });
        bus.publish('stateManager:snapshotUpdated', CHECK);
        expect(gs.getCurrentMana()).toBe(90);
        bus.publish('gameState:regionChanged', { oldRegion: 'Own', newRegion: 'A' });
        expect(gs.getCurrentMana()).toBe(40);
    });

    it('does not charge a substrate with no sharing.mana', () => {
        register();
        const { gs, bus } = wire({ currentRegion: 'Undeclared' });
        bus.publish('stateManager:snapshotUpdated', CHECK);
        bus.publish('gameState:regionChanged', { oldRegion: 'Undeclared', newRegion: 'A' });
        expect(gs.getCurrentMana()).toBe(100);
    });

    describe.each([
        ['Cloudberry', 'Cloudberry2'],
        ['Noiz2sa', 'Noiz2sa2'],
    ])('%s with loop mode off', (region, next) => {
        it('a location check costs nothing and earns no region XP', () => {
            const { gs, bus } = wire({ currentRegion: region });
            bus.publish('stateManager:snapshotUpdated', CHECK);
            expect(gs.getCurrentMana()).toBe(100);
            expect(gs.getRegionXP(region).xp).toBe(0);
        });

        it('leaving costs nothing, so low mana cannot fire a loop reset from here', () => {
            const { gs, bus } = wire({ currentRegion: region });
            gs.deductMana(99);
            bus.publish('gameState:regionChanged', { oldRegion: region, newRegion: next });
            expect(gs.getCurrentMana()).toBe(1);
            expect(gs.getLoopResetCount()).toBe(0);
        });

        it('leaving into a charged region charges nothing for the room left', () => {
            const { gs, bus } = wire({ currentRegion: region });
            bus.publish('gameState:regionChanged', { oldRegion: region, newRegion: 'Own' });
            expect(gs.getCurrentMana()).toBe(100);
        });

        it('the mana readout still shows', () => {
            const { bus } = wire({ currentRegion: region });
            bus.publish('gameState:manaChanged', {});
            expect(bus.published.at(-1)).toEqual({
                event: getHeaderInfoEvent(),
                data: { text: 'mana: 100.0 / 100.0' },
            });
        });
    });

    it('a text adventure region still pays its check and its move after a Cloudberry room', () => {
        const { gs, bus } = wire({ currentRegion: 'Cloudberry' });
        bus.publish('gameState:regionChanged', { oldRegion: 'Cloudberry', newRegion: 'Own' });
        bus.publish('stateManager:snapshotUpdated', CHECK);
        expect(gs.getCurrentMana()).toBe(90);
        bus.publish('gameState:regionChanged', { oldRegion: 'Own', newRegion: 'A' });
        expect(gs.getCurrentMana()).toBe(40);
    });

    it('moving from a self-billed region into a charged one bills only the region this leg owns', () => {
        register();
        const { gs, bus } = wire({ currentRegion: 'SelfBilled' });
        bus.publish('gameState:regionChanged', { oldRegion: 'SelfBilled', newRegion: 'Own' });
        expect(gs.getCurrentMana()).toBe(100);
        bus.publish('gameState:regionChanged', { oldRegion: 'Own', newRegion: 'SelfBilled' });
        expect(gs.getCurrentMana()).toBe(50);
    });

    it('needs no registry entry: a named substrate registered after wiring is still not charged', () => {
        const { gs, bus } = wire({ currentRegion: 'SelfBilled' });
        register();
        bus.publish('stateManager:snapshotUpdated', CHECK);
        expect(gs.getCurrentMana()).toBe(100);
    });

    it('the mana readout still shows in a region another substrate bills', () => {
        register();
        const { bus } = wire({ currentRegion: 'SelfBilled' });
        bus.publish('gameState:manaChanged', {});
        expect(bus.published.at(-1)).toEqual({
            event: getHeaderInfoEvent(),
            data: { text: 'mana: 100.0 / 100.0' },
        });
    });
});

describe('wrapper mana leg — header info', () => {
    it('publishes the mana readout for mana regions and null otherwise', () => {
        const { bus } = wire();
        const header = bus.published.filter((p) => p.event === getHeaderInfoEvent());
        bus.publish('gameState:manaChanged', {});
        const last = bus.published.filter((p) => p.event === getHeaderInfoEvent()).at(-1);
        expect(last.data.text).toBe('mana: 100.0 / 100.0');
        expect(header.length).toBeGreaterThanOrEqual(0);

        bus.publish('gameState:regionChanged', { oldRegion: 'A', newRegion: 'NoMana', fromReset: true });
        const afterMove = bus.published.filter((p) => p.event === getHeaderInfoEvent()).at(-1);
        expect(afterMove.data.text).toBeNull();
    });
});
