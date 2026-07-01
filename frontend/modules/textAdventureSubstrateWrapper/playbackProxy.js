/**
 * Host-side PlaybackController proxy for the wrapper. Implements the
 * substrate-neutral PlaybackController contract by publishing the
 * method invocation as an eventBus event; the in-iframe
 * playbackBridge.js subscribes and executes the call.
 *
 * Why this instead of routing through panel methods (as mazeRoom and
 * the existing textAdventureSubstrate do): the panel UI lives inside
 * the iframe, so there's no host-side panel object to call into. The
 * eventBus is already plumbed through iframeAdapter, so we reuse it
 * rather than adding new MessageTypes to the iframe protocol.
 *
 * Methods are fire-and-forget. The bot's `_dispatch` doesn't await,
 * and `eventBus.publish` is synchronous on the host side anyway —
 * what's async is the postMessage delivery to the iframe, which the
 * bot doesn't need to wait for.
 *
 * See docs/json/developer/procgen/playback-and-debugging.md for the
 * broader design.
 */

const CONTROL_EVENT = 'textAdventureSubstrateWrapper:control';

export class PlaybackProxy {
    /**
     * @param {object} deps
     * @param {object} deps.eventBus
     * @param {string} [deps.controlEvent] — which eventBus event carries
     *   the commands. Defaults to this wrapper's own channel; other
     *   iframe substrates reuse the proxy with their own event (e.g.
     *   bounceDemo's 'bounce:playbackControl', received by the shared
     *   flash bridge's playback receiver).
     */
    constructor({ eventBus, controlEvent = CONTROL_EVENT }) {
        if (!eventBus || typeof eventBus.publish !== 'function') {
            throw new Error('PlaybackProxy: eventBus.publish is required');
        }
        this._eventBus = eventBus;
        this._controlEvent = controlEvent;
    }

    play(rateHz)    { this._send('play', [rateHz]); }
    stop()          { this._send('stop', []); }
    step()          { this._send('step', []); }
    instant()       { this._send('instant', []); }
    reset()         { this._send('reset', []); }
    setRate(rateHz) { this._send('setRate', [rateHz]); }
    walkTo(target)  { this._send('walkTo', [target]); }

    _send(method, args) {
        this._eventBus.publish(this._controlEvent, { method, args });
    }
}

export const PLAYBACK_CONTROL_EVENT = CONTROL_EVENT;
