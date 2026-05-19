/**
 * Iframe-side playback bridge — receives PlaybackController commands
 * from the host (published as eventBus events) and drives the same
 * sphere-log walk that the in-process TextAdventurePlaybackController
 * drives, except the resulting AP actions are dispatched via
 * client.publishEventDispatcher instead of via panel click handlers
 * (which don't exist on this side — there's no host-side panel UI to
 * click into; the engine renders inside the iframe).
 *
 * Protocol: host publishes one of:
 *   eventBus 'textAdventureSubstrateWrapper:control'
 *   payload  { method: 'play' | 'stop' | 'step' | 'instant' | 'reset'
 *                     | 'setRate' | 'walkTo',
 *              args:   array of method arguments }
 *
 * The bridge owns its own clock (setInterval). Same semantics as the
 * in-process controller: replace-on-walkTo (last write wins); step()
 * drains the queued target.
 */

const DEFAULT_RATE_HZ = 4;
const CONTROL_EVENT = 'textAdventureSubstrateWrapper:control';

export class PlaybackBridge {
    /**
     * @param {object} deps
     * @param {object} deps.client          IframeClient (for subscribe + publishEventDispatcher)
     * @param {() => object|null} deps.getWorld   returns the bridge-built engine world (with rooms)
     * @param {() => string|null} deps.getCurrentRegion   returns lastSeenRegion (engine's roomId === AP region name)
     * @param {(level: string, ...args: any[]) => void} [deps.log]   optional logger
     */
    constructor({ client, getWorld, getCurrentRegion, log }) {
        this._client = client;
        this._getWorld = getWorld;
        this._getCurrentRegion = getCurrentRegion;
        this._log = log ?? (() => {});
        this._clock = null;
        this._rateHz = DEFAULT_RATE_HZ;
        this._target = null;          // queued walkTo target
        this._unsubscribe = null;

        this._subscribe();
    }

    destroy() {
        this.stop();
        this._target = null;
        // IframeClient.subscribeEventBus has no unsubscribe primitive
        // exposed; rely on the iframe being torn down with the panel.
        this._unsubscribe = null;
    }

    _subscribe() {
        this._client.subscribeEventBus(CONTROL_EVENT, (payload) => {
            this._handleCommand(payload);
        });
    }

    _handleCommand(payload) {
        const method = payload?.method;
        const args = Array.isArray(payload?.args) ? payload.args : [];
        if (!method) {
            this._log('warn', 'playbackBridge: control event without method', payload);
            return;
        }
        switch (method) {
            case 'play':    this.play(args[0]); return;
            case 'stop':    this.stop(); return;
            case 'step':    this.step(); return;
            case 'instant': this.instant(); return;
            case 'reset':   this.reset(); return;
            case 'setRate': this.setRate(args[0]); return;
            case 'walkTo':  this.walkTo(args[0]); return;
            default:
                this._log('warn', 'playbackBridge: unknown control method', method);
        }
    }

    play(rateHz) {
        if (Number.isFinite(rateHz) && rateHz > 0) this._rateHz = rateHz;
        if (this._clock) return;
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
        if (!this._target) return;
        const target = this._target;
        this._target = null;
        this._performAction(target);
    }

    instant() {
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
        // Last write wins — mirrors TextAdventurePlaybackController.
        this._target = target;
    }

    _performAction(target) {
        if (!target || typeof target !== 'object') return;
        const world = this._getWorld();
        const currentRegion = this._getCurrentRegion();
        if (!world) {
            this._log('warn', 'playbackBridge: no world loaded; dropping', target);
            return;
        }
        if (target.kind === 'location') {
            this._client.publishEventDispatcher('user:locationCheck', {
                locationName: target.name,
                regionName: currentRegion ?? null,
                originator: 'textAdventureSubstrateWrapper',
            });
            return;
        }
        if (target.kind === 'exit') {
            // The bot may pass either the exit's AP name or its engine
            // id. In this engine they're the same (the bridge maps
            // AP exit name → engine exit id 1:1 in buildWorldFromStaticData).
            const exitInfo = this._resolveExit(world, currentRegion, target.name);
            if (!exitInfo) {
                this._log('warn', 'playbackBridge: exit not found', target.name, 'in', currentRegion);
                return;
            }
            this._client.publishEventDispatcher('user:regionMove', {
                sourceRegion: currentRegion ?? null,
                targetRegion: exitInfo.targetRoomId,
                exitName: exitInfo.id,
            });
            return;
        }
        if (target.kind === 'tile') {
            // No tile semantics here. The bot only emits tile walkTos
            // from manual UI input, which is never aimed at a text-
            // adventure region under normal use.
            this._log('warn', 'playbackBridge: tile walkTo not supported', target);
            return;
        }
        this._log('warn', 'playbackBridge: unknown walkTo kind', target);
    }

    _resolveExit(world, currentRegion, exitNameOrId) {
        if (!world?.rooms || !currentRegion) return null;
        const room = world.rooms[currentRegion];
        if (!room) return null;
        for (const e of room.exits ?? []) {
            if (e.id === exitNameOrId) return e;
        }
        return null;
    }
}

/**
 * Convenience factory matching how bridge.js installs other helpers.
 */
export function installPlaybackBridge(deps) {
    return new PlaybackBridge(deps);
}
