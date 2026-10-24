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
    // `on` is forwarded so a substrate whose instant is a persistent MODE
    // (jta's setInstantMode) can be turned back off — a per-block pacing
    // choice must not leak into the next block. Substrates whose instant is
    // a one-shot action (the text adventure drains its pending target)
    // ignore the argument, and the no-arg call keeps its old meaning.
    instant(on = true)  { this._send('instant', [on]); }
    reset()         { this._send('reset', []); }
    setRate(rateHz) { this._send('setRate', [rateHz]); }
    walkTo(target)  { this._send('walkTo', [target]); }

    // M3b: no replayActions. The text adventure is a coarse-only
    // substrate — loops runs a Playback block's own interior through the
    // generic executor host-side, so nothing crosses the iframe for
    // replay. The absence of replayActions here is also what routes
    // loopState's fine-grained replay path away from this substrate.

    _send(method, args) {
        this._eventBus.publish(this._controlEvent, { method, args });
    }
}

/**
 * The text adventure's own proxy: the shared methods plus `perform(target)`,
 * which the iframe bridge acts on at once (`walkTo` only queues the target
 * for the bridge's clock). The loops Bot block prefers `perform` where a
 * controller has it — it drives one action at a time and calls no
 * play/step — and only a `perform` controller takes an explore. The other
 * iframe substrates reuse the base class, whose receivers do not know the
 * method, so it lives here and not there.
 */
export class TextAdventurePlaybackProxy extends PlaybackProxy {
    perform(target) { this._send('perform', [target]); }
}

export const PLAYBACK_CONTROL_EVENT = CONTROL_EVENT;
