import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PlaybackProxy, TextAdventurePlaybackProxy, PLAYBACK_CONTROL_EVENT } from './playbackProxy.js';

function makeFakeEventBus() {
    const publish = vi.fn();
    return { publish, _published: () => publish.mock.calls };
}

describe('PlaybackProxy — publishes control events for each method', () => {
    let bus;
    let proxy;
    beforeEach(() => {
        bus = makeFakeEventBus();
        proxy = new PlaybackProxy({ eventBus: bus });
    });

    it('throws if eventBus has no publish', () => {
        expect(() => new PlaybackProxy({ eventBus: {} })).toThrow(/publish/);
        expect(() => new PlaybackProxy({ eventBus: null })).toThrow();
    });

    it('play(rateHz) publishes the control event', () => {
        proxy.play(8);
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'play', args: [8] },
        );
    });

    it('stop() publishes', () => {
        proxy.stop();
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'stop', args: [] },
        );
    });

    it('step() publishes', () => {
        proxy.step();
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'step', args: [] },
        );
    });

    it('instant() publishes, defaulting to ON', () => {
        proxy.instant();
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'instant', args: [true] },
        );
    });

    it('instant(false) publishes the OFF direction (M6)', () => {
        // Substrates whose instant is a persistent MODE (jta's setInstantMode)
        // need an unset path, or one Instant block leaves the game instant for
        // the rest of the session.
        proxy.instant(false);
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'instant', args: [false] },
        );
    });

    it('reset() publishes', () => {
        proxy.reset();
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'reset', args: [] },
        );
    });

    it('setRate(rateHz) publishes', () => {
        proxy.setRate(12);
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'setRate', args: [12] },
        );
    });

    it('walkTo(target) publishes with the target verbatim', () => {
        const target = { kind: 'location', name: 'Cave Entrance' };
        proxy.walkTo(target);
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'walkTo', args: [target] },
        );
    });

    it('has no replayActions (M3b: coarse-only substrate — loops runs the block interior host-side)', () => {
        expect(proxy.replayActions).toBeUndefined();
    });

    it('preserves call order across mixed methods', () => {
        proxy.walkTo({ kind: 'location', name: 'A' });
        proxy.play(4);
        proxy.stop();
        const methods = bus._published().map(([, payload]) => payload.method);
        expect(methods).toEqual(['walkTo', 'play', 'stop']);
    });
});

describe('TextAdventurePlaybackProxy', () => {
    it('perform(target) publishes with the target verbatim', () => {
        const bus = makeFakeEventBus();
        const target = { kind: 'explore', region: 'Cave' };
        new TextAdventurePlaybackProxy({ eventBus: bus }).perform(target);
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'perform', args: [target] },
        );
    });

    it('the shared base has NO perform — the other substrates\' receivers do not know it', () => {
        // loops prefers `perform` wherever it exists, so a base-class perform
        // would send jta / bounce / runner / omsi a method they drop.
        expect(new PlaybackProxy({ eventBus: makeFakeEventBus() }).perform).toBeUndefined();
    });
});
