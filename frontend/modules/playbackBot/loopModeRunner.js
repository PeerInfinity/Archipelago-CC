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
 * ⛓ SUBSTRATE REGIONS (⚖ the user, 2026-10-11): the queue is the only actor, and each substrate block gets the
 * mode that lets the queue's OWN entries be played there — a COARSE substrate (text adventure: its actions ARE the
 * Loops actions) runs them under Playback; a substrate with a Bot solver (maze delegation, the walkTo solvers) runs
 * them under Bot. A substrate with neither cannot be played by the queue yet: the runner waits, naming the region.
 * The modes it set are put back on Stop (the user's explicit ones, or none).
 *
 * Every dependency is injected, so the runner is exercised in vitest without the app.
 */
import { DEFAULT_MANA_STRATEGY, availableTasks, planNextLoop } from './loopDriver.js';

const RETRY_MS = 1000;
// A loop whose actions keep completing without spending any mana never ends by itself (a substrate explore with
// nothing left to find can be free — maze — and a repeating explore re-queues itself forever). After this many
// free completions in a row the runner ends the loop and stops exploring that region for XP.
const FREE_SPIN_LIMIT = 200;

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
     * @param {() => Array<{name: string, instance: number}>} [deps.queueBlocks]  the queue's blocks (resolveQueueBlocks)
     * @param {(region: string, instance: number) => string} [deps.blockKeyOf]
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
        // block key → {region, instance, prior} for every block mode the runner set (prior: the explicit mode, or
        // undefined when the block had none).
        this._savedBlockModes = new Map();
        // Regions where exploring measurably yields nothing (free spins): never explored for XP again this run.
        this._noYield = new Set();
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
        for (const [key, { region, instance, prior }] of this._savedBlockModes) {
            if (prior === undefined) loopState?.blockModeStates?.delete?.(key);
            else loopState?.setBlockMode?.(region, instance, prior);
        }
        this._savedBlockModes.clear();
    }

    _status(text) { this._d.onStatus?.(text); }

    /**
     * How the queue plays a region: 'plain' (no substrate — the queue's entries run as they are), 'playback' (a
     * coarse substrate runs the entries), 'bot' (the substrate's Bot solver plays them), or null (no way yet).
     */
    _modeFor(loopState, region) {
        if (!this._d.isSubstrateRegion(region)) return 'plain';
        if (loopState.getRegionCaptureShape?.(region) === 'coarse') return 'playback';
        if (loopState.regionSolver?.(region)) return 'bot';
        return null;
    }

    _applyBlockModes(loopState) {
        const keyOf = this._d.blockKeyOf ?? ((region, instance) => `${region}#${instance}`);
        for (const { name, instance } of this._d.queueBlocks?.() ?? []) {
            const mode = this._modeFor(loopState, name);
            if (mode !== 'playback' && mode !== 'bot') continue;
            const key = keyOf(name, instance);
            if (!this._savedBlockModes.has(key)) {
                const states = loopState.blockModeStates;
                this._savedBlockModes.set(key, { region: name, instance, prior: states?.has?.(key) ? states.get(key) : undefined });
            }
            loopState.setBlockMode(name, instance, mode);
        }
    }

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
        const hasHidden = (region) => discoveryOn && !this._noYield.has(region) && (
            (d.locationsOf(region) ?? []).some((l) => !isLocationDiscovered(l))
            || (d.exitsOf(region) ?? []).some((e) => !isExitDiscovered(region, e.name)));
        return {
            hasHidden,
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
                hasHidden,
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
        const regions = new Set(plan.path.flatMap((e) => [e.sourceRegion, e.destinationRegion]).filter(Boolean));
        const unplayable = [...regions].find((r) => this._modeFor(loopState, r) === null);
        if (unplayable) {
            return this._retry(`waiting: ${unplayable} is a substrate region the Loops queue cannot play yet (no Bot player)`);
        }

        if (plan.kind === 'explore') {
            if (!this._savedRepeat.has(plan.region)) this._savedRepeat.set(plan.region, !!loopState.getRepeatExplore?.(plan.region));
            loopState.setRepeatExplore?.(plan.region, true);
        }
        this._lastKey = plan.key;
        this._loops += 1;
        this._status(`loop ${this._loops}: ${plan.reason}`);
        gameState.setPath(plan.path, d.getStartRegion());
        this._applyBlockModes(loopState);
        loopState.restartFromStart({ autoStart: true });
        // Subscribed AFTER the restart: restartFromStart publishes its own loopState:loopReset.
        // ⛓ An explore loop ends when it has done its work: the region hides nothing more (its repeating explore
        // would otherwise run on — for free, in a maze — until the mana ends, or forever). The runner ends it by
        // Loops' own Restart path on the next plan.
        let freeSpins = 0;
        let manaSeen = gameState.currentMana;
        const onActionCompleted = () => {
            if (!this._active) return;
            const mana = gameState.currentMana;
            freeSpins = mana === manaSeen ? freeSpins + 1 : 0;
            manaSeen = mana;
            let why = null;
            if (plan.kind === 'explore' && !this._view().hasHidden(plan.region)) why = 'explored';
            else if (freeSpins >= FREE_SPIN_LIMIT) {
                this._noYield.add(plan.region);
                why = `${FREE_SPIN_LIMIT} actions spent no mana`;
            }
            if (!why) return;
            loopState.stopProcessing?.();
            ended(why);
        };
        const ended = (why = null) => {
            this._clearWait();
            if (!this._active) return;
            if (this._once) {
                this._status(`stepped one loop (${plan.reason})`);
                this._active = false;
                this.stop();
                return;
            }
            if (why) this._status(`loop ${this._loops} ended early (${why}): ${plan.reason}`);
            // Deferred: the out-of-mana reset publishes BEFORE loops pauses itself. And planned only once the
            // worker's snapshot holds this loop's check — planned at once, the same check came round again.
            const next = () => { this._timer = setTimeout(() => { this._timer = null; this._runLoop(); }, 0); };
            const flush = d.flush?.();
            if (flush && typeof flush.then === 'function') flush.then(next, next);
            else next();
        };
        this._unsubs.push(d.subscribe('loopState:queueCompleted', () => ended()));
        this._unsubs.push(d.subscribe('loopState:loopReset', () => ended()));
        this._unsubs.push(d.subscribe('loopState:actionCompleted', onActionCompleted));
        // A substrate that charges mana itself (maze delegation, per tile) ends the loop on its own reset path:
        // gameState.triggerLoopReset publishes gameState:loopReset, and loops just stops (no loopState event).
        this._unsubs.push(d.subscribe('gameState:loopReset', () => ended()));
        // Loops' named stop for a Bot block whose walk cannot happen: say why, and try again next loop.
        this._unsubs.push(d.subscribe('loopState:botWalkFailed', (data) => {
            this._clearWait();
            if (!this._active) return;
            this._retry(`waiting: the Bot block in ${data?.region ?? '?'} stopped — ${data?.reason ?? 'its walk failed'}`);
        }));
        return undefined;
    }
}
