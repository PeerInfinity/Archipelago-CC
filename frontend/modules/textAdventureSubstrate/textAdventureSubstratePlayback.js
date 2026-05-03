/**
 * Text Adventure substrate playback controller — substrate-neutral
 * interface (per substrateRegistry.js's PlaybackController contract)
 * for the playback bot to drive a text-adventure region one action
 * per clock tick.
 *
 * Text-adventure has no tile-walking layer. Where the maze controller
 * forwards walkTo into the visualizer's tile pathfinder, here a single
 * walkTo target IS the action: we look up the location/exit in the
 * panel's loaded world and invoke the panel's existing click handler,
 * which already does the accessibility check and publishes the
 * dispatcher event (user:locationCheck or user:regionMove).
 *
 * Queue size is 1: the bot publishes one walkTo at a time and waits
 * for the resulting dispatcher event before issuing the next, so
 * replacing-on-walkTo (last-write-wins) matches the maze's
 * walkToTile semantics.
 */

const DEFAULT_RATE_HZ = 4;

export class TextAdventurePlaybackController {
    constructor(panel) {
        this._panel = panel;
        this._clock = null;          // setInterval handle
        this._rateHz = DEFAULT_RATE_HZ;
        this._target = null;         // queued walkTo target (kind+name)
    }

    play(rateHz) {
        if (Number.isFinite(rateHz) && rateHz > 0) this._rateHz = rateHz;
        if (this._clock) return;     // already running
        const intervalMs = Math.max(1, Math.round(1000 / this._rateHz));
        this._clock = setInterval(() => this.step(), intervalMs);
    }

    stop() {
        if (this._clock) {
            clearInterval(this._clock);
            this._clock = null;
        }
    }

    step() {
        if (!this._target) return;   // nothing queued; idle tick
        const target = this._target;
        this._target = null;
        this._performAction(target);
    }

    instant() {
        // Drain whatever's queued without delay; leave the clock state
        // untouched so a play()-then-instant() pattern still keeps the
        // clock running for subsequent walkTos.
        if (!this._target) return;
        const target = this._target;
        this._target = null;
        this._performAction(target);
    }

    reset() {
        this.stop();
        this._target = null;
    }

    setRate(rateHz) {
        if (!Number.isFinite(rateHz) || rateHz <= 0) return;
        this._rateHz = rateHz;
        if (this._clock) {
            clearInterval(this._clock);
            const intervalMs = Math.max(1, Math.round(1000 / rateHz));
            this._clock = setInterval(() => this.step(), intervalMs);
        }
    }

    walkTo(target) {
        this._target = target;
    }

    _performAction(target) {
        const panel = this._panel;
        if (!target || typeof target !== 'object') return;
        if (!panel?.world) {
            console.warn('[textAdventurePlayback] no world loaded; dropping', target);
            return;
        }
        if (target.kind === 'location') {
            panel._onLocationClick(target.name);
            return;
        }
        if (target.kind === 'exit') {
            // Bot may pass exitName or exit_id; resolve to exit_id.
            const exits = panel.world.exits;
            if (exits?.has?.(target.name)) {
                panel._onExitClick(target.name);
                return;
            }
            if (exits) {
                for (const e of exits.values()) {
                    if (e.exitName === target.name || e.exit_id === target.name) {
                        panel._onExitClick(e.exit_id);
                        return;
                    }
                }
            }
            console.warn('[textAdventurePlayback] exit not found', target.name);
            return;
        }
        if (target.kind === 'tile') {
            // No tile semantics here. The bot only emits tile walkTos
            // from manual UI input, which is never aimed at a text-
            // adventure region under normal use.
            console.warn('[textAdventurePlayback] tile walkTo not supported', target);
            return;
        }
    }
}
