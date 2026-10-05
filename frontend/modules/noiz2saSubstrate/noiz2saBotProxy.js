/**
 * The Noiz2sa bot's playback controller (slice N4), host side: the shared PlaybackProxy (the commands go to the
 * in-iframe flash bridge on `noiz2sa:playbackControl`), whose walkTo also carries the bot's settings — the second
 * argument of the bridge's `botWalkTo(goal, options)`: the knobs at the trainer's CURRENT tracks, the speed and the
 * retry cap (noiz2saTraining.js botWalkOptions). `index.js` injects it into the registry entry.
 */
import { PlaybackProxy } from '../textAdventureSubstrateWrapper/playbackProxy.js';

/**
 * The bot's playback controller: the shared PlaybackProxy, whose walkTo also carries the bot's settings at the
 * trainer's current tracks. While the bot drives a Noiz2sa region, a change of the tracks or the bot settings is sent
 * again for the same goal (the page applies it from the next attempt; the speed at once).
 */
export class Noiz2saBotProxy extends PlaybackProxy {
    constructor({ eventBus, controlEvent, botOptions, isDriving = () => true }) {
        super({ eventBus, controlEvent });
        this._botOptions = botOptions;
        this._isDriving = isDriving;
        this._target = null;
    }
    walkTo(target) {
        this._target = target ?? null;
        this._send('walkTo', [target, this._botOptions()]);
    }
    stop() { this._target = null; super.stop(); }
    reset() { this._target = null; super.reset(); }
    /** re-send the current walk with fresh settings, only while the bot is driving */
    refresh() {
        if (this._target && this._isDriving()) this._send('walkTo', [this._target, this._botOptions()]);
    }
}
