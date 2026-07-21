import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PlaybackBridge } from './playbackBridge.js';

/**
 * Fake IframeClient — captures subscriber + lets tests fire control
 * events synchronously. Records publishEventDispatcher calls so tests
 * can assert what got dispatched.
 */
function makeFakeClient() {
    const subscriptions = new Map(); // event -> callback
    const dispatched = [];
    return {
        subscribeEventBus: vi.fn((event, cb) => { subscriptions.set(event, cb); }),
        publishEventDispatcher: vi.fn((event, data) => {
            dispatched.push({ event, data });
        }),
        _fire(event, payload) {
            const cb = subscriptions.get(event);
            if (!cb) throw new Error(`no subscriber for ${event}`);
            cb(payload);
        },
        _dispatched: () => dispatched,
    };
}

/**
 * Minimal world matching what buildWorldFromStaticData produces.
 */
function makeWorld() {
    return {
        rooms: {
            'Cave': {
                id: 'Cave',
                exits: [
                    { id: 'NorthDoor', label: 'NorthDoor', targetRoomId: 'Outside' },
                    { id: 'EastGate', label: 'EastGate', targetRoomId: 'Garden' },
                ],
                items: [{ id: 'Coin', label: 'Coin' }],
            },
            'Outside': { id: 'Outside', exits: [], items: [] },
            'Garden': { id: 'Garden', exits: [], items: [] },
        },
        startRoomId: 'Cave',
    };
}

function makeBridge(opts = {}) {
    const client = makeFakeClient();
    const world = opts.world ?? makeWorld();
    const currentRegion = opts.currentRegion ?? 'Cave';
    const bridge = new PlaybackBridge({
        client,
        getWorld: () => world,
        getCurrentRegion: () => currentRegion,
        log: () => {},
    });
    return { bridge, client, world };
}

describe('PlaybackBridge — subscription', () => {
    it('subscribes to textAdventureSubstrateWrapper:control on construction', () => {
        const { client } = makeBridge();
        expect(client.subscribeEventBus).toHaveBeenCalledWith(
            'textAdventureSubstrateWrapper:control',
            expect.any(Function),
        );
    });
});

describe('PlaybackBridge — walkTo dispatch', () => {
    it('location walkTo publishes user:locationCheck', () => {
        const { bridge, client } = makeBridge();
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        bridge.step();
        expect(client._dispatched()).toEqual([
            {
                event: 'user:locationCheck',
                data: {
                    locationName: 'Coin',
                    regionName: 'Cave',
                    originator: 'textAdventureSubstrateWrapper',
                },
            },
        ]);
    });

    it('exit walkTo publishes user:regionMove with the exit\'s targetRoomId', () => {
        const { bridge, client } = makeBridge();
        bridge.walkTo({ kind: 'exit', name: 'NorthDoor' });
        bridge.step();
        expect(client._dispatched()).toEqual([
            {
                event: 'user:regionMove',
                data: {
                    sourceRegion: 'Cave',
                    targetRegion: 'Outside',
                    exitName: 'NorthDoor',
                },
            },
        ]);
    });

    it('unknown exit drops the walkTo without dispatch', () => {
        const { bridge, client } = makeBridge();
        bridge.walkTo({ kind: 'exit', name: 'NoSuchExit' });
        bridge.step();
        expect(client._dispatched()).toEqual([]);
    });

    it('tile walkTo is not supported (no dispatch)', () => {
        const { bridge, client } = makeBridge();
        bridge.walkTo({ kind: 'tile', x: 1, y: 2 });
        bridge.step();
        expect(client._dispatched()).toEqual([]);
    });

    it('ignores walkTo when no world is loaded', () => {
        const client = makeFakeClient();
        const bridge = new PlaybackBridge({
            client,
            getWorld: () => null,
            getCurrentRegion: () => 'Cave',
            log: () => {},
        });
        bridge.walkTo({ kind: 'location', name: 'X' });
        bridge.step();
        expect(client._dispatched()).toEqual([]);
    });

    it('idle step is a no-op when no target is queued', () => {
        const { bridge, client } = makeBridge();
        bridge.step();
        bridge.step();
        expect(client._dispatched()).toEqual([]);
    });

    it('replaces the queued target on a fresh walkTo (last write wins)', () => {
        const { bridge, client } = makeBridge();
        bridge.walkTo({ kind: 'location', name: 'A' });
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        bridge.step();
        expect(client._dispatched()).toHaveLength(1);
        expect(client._dispatched()[0].data.locationName).toBe('Coin');
    });
});

describe('PlaybackBridge — clock', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('play() starts an interval that calls step() at the given rate', () => {
        const { bridge, client } = makeBridge();
        bridge.play(10);  // 100ms tick
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        vi.advanceTimersByTime(100);
        expect(client._dispatched()).toHaveLength(1);
    });

    it('stop() halts the clock', () => {
        const { bridge, client } = makeBridge();
        bridge.play(10);
        bridge.stop();
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        vi.advanceTimersByTime(1000);
        expect(client._dispatched()).toEqual([]);
    });

    it('play() is idempotent', () => {
        const { bridge, client } = makeBridge();
        bridge.play(10);
        bridge.play(10);
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        vi.advanceTimersByTime(100);
        expect(client._dispatched()).toHaveLength(1);
    });

    it('setRate() while playing reseats the interval at the new rate', () => {
        const { bridge, client } = makeBridge();
        bridge.play(2);     // 500ms tick
        bridge.setRate(20); // 50ms tick
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        vi.advanceTimersByTime(60);
        expect(client._dispatched()).toHaveLength(1);
    });

    it('setRate() while stopped does not start the clock', () => {
        const { bridge, client } = makeBridge();
        bridge.setRate(20);
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        vi.advanceTimersByTime(1000);
        expect(client._dispatched()).toEqual([]);
    });

    it('instant() drains the queued target immediately, leaves the clock alone', () => {
        const { bridge, client } = makeBridge();
        bridge.play(2);
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        bridge.instant();
        expect(client._dispatched()).toHaveLength(1);
        bridge.walkTo({ kind: 'exit', name: 'EastGate' });
        vi.advanceTimersByTime(500);
        expect(client._dispatched()).toHaveLength(2);
        expect(client._dispatched()[1].event).toBe('user:regionMove');
    });

    it('reset() stops the clock and clears the queued target', () => {
        const { bridge, client } = makeBridge();
        bridge.play(10);
        bridge.walkTo({ kind: 'location', name: 'Coin' });
        bridge.reset();
        vi.advanceTimersByTime(500);
        expect(client._dispatched()).toEqual([]);
    });
});

describe('PlaybackBridge — replayActions (M2 Playback)', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('walks recorded locationCheck / explore on the clock, then issues the departure regionMove', () => {
        const { bridge, client } = makeBridge();
        bridge.replayActions(
            [
                { type: 'locationCheck', locationName: 'Coin' },
                { type: 'explore', regionName: 'Cave' },
            ],
            { departureExitId: 'NorthDoor' },
        );
        // Default rate 4Hz → 250ms/tick.
        vi.advanceTimersByTime(250);
        expect(client._dispatched()).toHaveLength(1);
        expect(client._dispatched()[0]).toEqual({
            event: 'user:locationCheck',
            data: { locationName: 'Coin', regionName: 'Cave', originator: 'textAdventureSubstrateWrapper' },
        });
        vi.advanceTimersByTime(250);
        expect(client._dispatched()[1]).toEqual({
            event: 'loop:exploreCompleted',
            data: { regionName: 'Cave' },
        });
        // Interior drained → next tick issues the closing regionMove.
        vi.advanceTimersByTime(250);
        expect(client._dispatched()[2]).toEqual({
            event: 'user:regionMove',
            data: { sourceRegion: 'Cave', targetRegion: 'Outside', exitName: 'NorthDoor' },
        });
        // Clock stopped — no further dispatches.
        vi.advanceTimersByTime(1000);
        expect(client._dispatched()).toHaveLength(3);
    });

    it('with no departureExitId, drains the interior and stops without a regionMove', () => {
        const { bridge, client } = makeBridge();
        bridge.replayActions([{ type: 'locationCheck', locationName: 'Coin' }], {});
        vi.advanceTimersByTime(250); // locationCheck
        vi.advanceTimersByTime(250); // drained → stop (no departure)
        vi.advanceTimersByTime(500);
        expect(client._dispatched()).toEqual([
            {
                event: 'user:locationCheck',
                data: { locationName: 'Coin', regionName: 'Cave', originator: 'textAdventureSubstrateWrapper' },
            },
        ]);
    });

    it('routes replayActions through the control event', () => {
        const { client } = makeBridge();
        client._fire('textAdventureSubstrateWrapper:control', {
            method: 'replayActions',
            args: [[{ type: 'locationCheck', locationName: 'Coin' }], { departureExitId: null }],
        });
        vi.advanceTimersByTime(250);
        expect(client._dispatched()).toHaveLength(1);
        expect(client._dispatched()[0].event).toBe('user:locationCheck');
    });

    it('reset() cancels an in-flight replay', () => {
        const { bridge, client } = makeBridge();
        bridge.replayActions(
            [{ type: 'locationCheck', locationName: 'Coin' }],
            { departureExitId: 'NorthDoor' },
        );
        bridge.reset();
        vi.advanceTimersByTime(1000);
        expect(client._dispatched()).toEqual([]);
    });
});

describe('PlaybackBridge — control event routing', () => {
    it('dispatches walkTo + step + play through the control event', () => {
        const { client } = makeBridge();
        client._fire('textAdventureSubstrateWrapper:control', {
            method: 'walkTo',
            args: [{ kind: 'location', name: 'Coin' }],
        });
        client._fire('textAdventureSubstrateWrapper:control', {
            method: 'step',
            args: [],
        });
        expect(client._dispatched()).toEqual([
            {
                event: 'user:locationCheck',
                data: {
                    locationName: 'Coin',
                    regionName: 'Cave',
                    originator: 'textAdventureSubstrateWrapper',
                },
            },
        ]);
    });

    it('ignores control events with no method', () => {
        const { client } = makeBridge();
        client._fire('textAdventureSubstrateWrapper:control', {});
        client._fire('textAdventureSubstrateWrapper:control', { method: 'unknownMethod' });
        expect(client._dispatched()).toEqual([]);
    });
});
