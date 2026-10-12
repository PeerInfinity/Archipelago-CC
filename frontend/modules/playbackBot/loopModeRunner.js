/**
 * Loop-mode runner — the glue between the Playback Bot, the live game and `loopDriver.js` (loop-mode-bot S3).
 *
 * Each loop: read the live state into a `LoopView`, plan ONE loop (`planNextLoop`), write it as the Loops queue
 * (`gameState.setPath`), restart the queue from the start (`loopState.restartFromStart`) and wait for the loop to
 * end — the queue completing (`loopState:queueCompleted`) or the mana running out (`loopState:loopReset`). Then
 * plan the next. The bot acts ONLY through the Loops queue, so the loop-mode gate never meets a bot action.
 *
 * ⚖ The user's rulings (2026-10-11): one target per loop; the Loops speed settings stay the user's; it never
 * gives up (a loop that cannot run waits and retries; the user stops it); no costs → it says "Generate Costs
 * first" and waits. Auto-restart is the runner's to drive while it plays (it decides every loop), and the user's
 * own choice is put back when it stops.
 *
 * Out of scope for now: regions a substrate owns (gated in loop mode; they would need Bot blocks). The runner
 * waits with a status naming the region.
 *
 * Every dependency is injected, so the runner is exercised in vitest without the app.
 */
import { DEFAULT_MANA_STRATEGY, availableTasks, planNextLoop } from './loopDriver.js';

const RETRY_MS = 1000;

export class LoopModeRunner {
    /**
     * @param {Object} deps
     * @param {() => Object|null} deps.getLoopState        loops' LoopState
     * @param {() => Object|null} deps.getGameState        gameState's state (setPath, getMaxMana / maxMana)
     * @param {() => string|null} deps.getStartRegion      the loop start region
     * @param {() => {locationName: string, regionName: string}|null} deps.nextTarget
     * @param {(region: string) => Array<{name: string, to: string}>} deps.exitsOf    ACCESSIBLE exits now
     * @param {(region: string) => string[]} deps.locationsOf
     * @param {(location: string) => boolean} deps.isLocationCheckable              accessible and unchecked
     * @param {Object} deps.discovery                      {isExitDiscovered, isLocationDiscovered}
     * @param {() => boolean} deps.isDiscoveryActive       false → everything counts as discovered
     * @param {(region: string) => boolean} deps.isSubstrateRegion
     * @param {(event: string, handler: Function) => (() => void)} deps.subscribe
     * @param {() => string} [deps.getStrategy]
     * @param {(text: string) => void} [deps.onStatus]
     * @param {() => void} [deps.onFinished]
     * @param {() => number} [deps.random]
     * @param {() => Promise|null} [deps.flush]           settle the worker's snapshot before the next plan
     */
    constructor(deps) {
        this._d = deps;
        this._active = false;
        this._once = false;
        this._timer = null;
        this._unsubs = [];
        this._loops = 0;
        this._lastKey = null;
        this._savedAutoRestart = null;
        this._savedRepeat = new Map();
        this._lastPlan = null;
    }

    isActive() { return this._active; }
    getLoopCount() { return this._loops; }
    getLastPlan() { return this._lastPlan; }

    /** Start playing loops; `{once: true}` plays exactly one (the bot's Step). */
    start({ once = false } = {}) {
        if (this._active) return;
        this._active = true;
        this._once = once;
        const loopState = this._d.getLoopState?.();
        if (loopState && this._savedAutoRestart === null) {
            this._savedAutoRestart = !!loopState.autoRestartQueue;
            loopState.setAutoRestartQueue?.(false);
        }
        this._runLoop();
    }

    /** Stop: the queue pauses where it is, and the user's auto-restart and repeat-explore choices come back. */
    stop() {
        const wasActive = this._active;
        this._active = false;
        this._clearWait();
        if (this._timer) clearTimeout(this._timer);
        this._timer = null;
        const loopState = this._d.getLoopState?.();
        if (wasActive) loopState?.stopProcessing?.();
        if (loopState && this._savedAutoRestart !== null) loopState.setAutoRestartQueue?.(this._savedAutoRestart);
        this._savedAutoRestart = null;
        for (const [region, repeat] of this._savedRepeat) loopState?.setRepeatExplore?.(region, repeat);
        this._savedRepeat.clear();
    }

    _status(text) { this._d.onStatus?.(text); }

    _retry(text) {
        this._status(text);
        this._timer = setTimeout(() => { this._timer = null; this._runLoop(); }, RETRY_MS);
    }

    _clearWait() {
        for (const off of this._unsubs) { try { off?.(); } catch { /* already gone */ } }
        this._unsubs = [];
    }

    _view() {
        const d = this._d;
        const loopState = d.getLoopState();
        const gameState = d.getGameState?.();
        const discoveryOn = d.isDiscoveryActive?.() ?? true;
        const startRegion = d.getStartRegion();
        const isExitDiscovered = (r, e) => !discoveryOn || !!d.discovery?.isExitDiscovered?.(r, e);
        const isLocationDiscovered = (l) => !discoveryOn || !!d.discovery?.isLocationDiscovered?.(l);
        return {
            startRegion,
            target: d.nextTarget(),
            exitsOf: d.exitsOf,
            isExitDiscovered,
            isLocationDiscovered,
            costOf: (entry) => loopState._calculateActionCost(entry),
            maxMana: gameState?.getMaxMana?.() ?? gameState?.maxMana ?? 100,
            strategy: d.getStrategy?.() ?? DEFAULT_MANA_STRATEGY,
            lastTaskKey: this._lastKey,
            random: d.random,
            availableTasks: () => availableTasks({
                startRegion,
                exitsOf: d.exitsOf,
                isExitDiscovered,
                locationsOf: d.locationsOf,
                isLocationDiscovered,
                isLocationCheckable: d.isLocationCheckable,
                hasHidden: (region) => discoveryOn && (
                    (d.locationsOf(region) ?? []).some((l) => !isLocationDiscovered(l))
                    || (d.exitsOf(region) ?? []).some((e) => !isExitDiscovered(region, e.name))),
            }),
        };
    }

    _runLoop() {
        if (!this._active) return;
        const d = this._d;
        const loopState = d.getLoopState?.();
        const gameState = d.getGameState?.();
        if (!loopState || !gameState) return this._retry('waiting: the Loops module is not ready');
        if (!gameState.isLoopModeActive) return this._retry('waiting: loop mode is off');
        if (!loopState.costDataManager?.isLoaded?.()) {
            return this._retry('waiting: Generate Costs first (Loops panel)');
        }
        if (!d.getStartRegion()) return this._retry('waiting: no loop start region');
        const plan = planNextLoop(this._view());
        this._lastPlan = plan;
        if (plan.kind === 'done') {
            this._status(`finished — ${this._loops} loop${this._loops === 1 ? '' : 's'}`);
            this.stop();
            d.onFinished?.();
            return undefined;
        }
        if (plan.kind === 'unreachable') return this._retry(`waiting: ${plan.reason}`);
        const gated = plan.path.map((e) => e.destinationRegion ?? e.sourceRegion).find((r) => r && d.isSubstrateRegion(r));
        if (gated) return this._retry(`waiting: ${gated} is a substrate region — the bot does not play those in loop mode yet`);

        if (plan.kind === 'explore') {
            if (!this._savedRepeat.has(plan.region)) this._savedRepeat.set(plan.region, !!loopState.getRepeatExplore?.(plan.region));
            loopState.setRepeatExplore?.(plan.region, true);
        }
        this._lastKey = plan.key;
        this._loops += 1;
        this._status(`loop ${this._loops}: ${plan.reason}`);
        gameState.setPath(plan.path, d.getStartRegion());
        loopState.restartFromStart({ autoStart: true });
        // Subscribed AFTER the restart: restartFromStart publishes its own loopState:loopReset.
        const ended = () => {
            this._clearWait();
            if (!this._active) return;
            if (this._once) {
                this._status(`stepped one loop (${plan.reason})`);
                this._active = false;
                this.stop();
                return;
            }
            // Deferred: the out-of-mana reset publishes BEFORE loops pauses itself. And planned only once the
            // worker's snapshot holds this loop's check — planned at once, the same check came round again.
            const next = () => { this._timer = setTimeout(() => { this._timer = null; this._runLoop(); }, 0); };
            const flush = d.flush?.();
            if (flush && typeof flush.then === 'function') flush.then(next, next);
            else next();
        };
        this._unsubs.push(d.subscribe('loopState:queueCompleted', ended));
        this._unsubs.push(d.subscribe('loopState:loopReset', ended));
        return undefined;
    }
}
