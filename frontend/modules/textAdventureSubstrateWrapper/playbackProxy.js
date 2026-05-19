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
 * See NewDocs/plans/procedural-generation/async-playback-bot.md for
 * the broader design.
 */

const CONTROL_EVENT = 'textAdventureSubstrateWrapper:control';

export class PlaybackProxy {
    constructor({ eventBus }) {
        if (!eventBus || typeof eventBus.publish !== 'function') {
            throw new Error('PlaybackProxy: eventBus.publish is required');
        }
        this._eventBus = eventBus;
    }

    play(rateHz)    { this._send('play', [rateHz]); }
    stop()          { this._send('stop', []); }
    step()          { this._send('step', []); }
    instant()       { this._send('instant', []); }
    reset()         { this._send('reset', []); }
    setRate(rateHz) { this._send('setRate', [rateHz]); }
    walkTo(target)  { this._send('walkTo', [target]); }

    _send(method, args) {
        this._eventBus.publish(CONTROL_EVENT, { method, args });
    }
}

export const PLAYBACK_CONTROL_EVENT = CONTROL_EVENT;
