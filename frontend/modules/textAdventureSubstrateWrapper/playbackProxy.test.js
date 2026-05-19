import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PlaybackProxy, PLAYBACK_CONTROL_EVENT } from './playbackProxy.js';

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

    it('instant() publishes', () => {
        proxy.instant();
        expect(bus.publish).toHaveBeenCalledWith(
            PLAYBACK_CONTROL_EVENT,
            { method: 'instant', args: [] },
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

    it('preserves call order across mixed methods', () => {
        proxy.walkTo({ kind: 'location', name: 'A' });
        proxy.play(4);
        proxy.stop();
        const methods = bus._published().map(([, payload]) => payload.method);
        expect(methods).toEqual(['walkTo', 'play', 'stop']);
    });
});
