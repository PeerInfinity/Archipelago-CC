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
        this._replayQueue = null;     // remaining recorded actions during replay
        this._replayClock = null;     // dedicated replay clock
        this._replayDeparture = null; // exit id to issue when the replay drains

        this._subscribe();
    }

    destroy() {
        this.stop();
        this._stopReplay();
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
            case 'replayActions': this.replayActions(args[0], args[1]); return;
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
        this._stopReplay();
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

    /**
     * Replay a recorded visit (M2 Playback). Walks the recorded
     * locationCheck / explore commands one per clock tick, dispatching the
     * same AP dispatcher events the engine would emit during live play
     * (never calls the engine — so no engine-submodule dependency). When the
     * list drains, issues the closing regionMove via `departureExitId` so the
     * parked loops queue advances.
     *
     * @param {Array} actions
     * @param {{departureExitId?: string}} [opts]
     */
    replayActions(actions, opts = {}) {
        this._stopReplay();
        this._replayQueue = Array.isArray(actions) ? actions.slice() : [];
        this._replayDeparture = opts?.departureExitId ?? null;
        const intervalMs = Math.max(1, Math.round(1000 / this._rateHz));
        this._replayClock = setInterval(() => this._replayTick(), intervalMs);
        return true;
    }

    _replayTick() {
        if (this._replayQueue && this._replayQueue.length > 0) {
            const action = this._replayQueue.shift();
            this._replayOne(action);
            return;
        }
        // Interior drained — issue the departure (if any), then stop.
        const departure = this._replayDeparture;
        this._replayDeparture = null;
        this._stopReplay();
        if (departure) this._issueDeparture(departure);
    }

    _replayOne(action) {
        if (!action || typeof action !== 'object') return;
        const currentRegion = this._getCurrentRegion();
        if (action.type === 'locationCheck' && action.locationName) {
            // fromLoop:true — this is a Playback replay of a recorded visit,
            // so the parked loops block already holds this location's path
            // entry. Without the flag, gameState.handleLocationCheck →
            // addLocationCheck appends a DUPLICATE path entry
            // (gameState/index.js:457 guards on !fromLoop). The event still
            // propagates up, so the location is genuinely checked, and loops'
            // noteLocationChecked still marks the queued entry complete. Mirrors
            // the maze 10/n departure fix.
            this._client.publishEventDispatcher('user:locationCheck', {
                locationName: action.locationName,
                regionName: currentRegion ?? null,
                originator: 'textAdventureSubstrateWrapper',
                fromLoop: true,
            });
            return;
        }
        if (action.type === 'explore') {
            this._client.publishEventDispatcher('loop:exploreCompleted', {
                regionName: action.regionName ?? currentRegion ?? null,
            });
            return;
        }
        this._log('warn', 'playbackBridge: unknown replay action', action);
    }

    _issueDeparture(exitId) {
        const world = this._getWorld();
        const currentRegion = this._getCurrentRegion();
        const exitInfo = this._resolveExit(world, currentRegion, exitId);
        if (!exitInfo) {
            this._log('warn', 'playbackBridge: replay departure exit not found', exitId, 'in', currentRegion);
            return;
        }
        // fromLoop:true — the parked Playback block already holds the queued
        // regionMove-out, so gameState.updatePath would otherwise append a
        // duplicate forward move (gameState/index.js:383 guards on !fromLoop).
        // The block still advances on the resulting regionChanged wake. Mirrors
        // the maze 10/n departure fix.
        this._client.publishEventDispatcher('user:regionMove', {
            sourceRegion: currentRegion ?? null,
            targetRegion: exitInfo.targetRoomId,
            exitName: exitInfo.id,
            fromLoop: true,
        });
    }

    _stopReplay() {
        if (this._replayClock) {
            clearInterval(this._replayClock);
            this._replayClock = null;
        }
        this._replayQueue = null;
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
