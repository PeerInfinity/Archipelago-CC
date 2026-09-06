/**
 * Cost Debugger Panel UI
 *
 * GoldenLayout panel component that displays step-by-step
 * cost generation reasoning. Each step = one action queue (one loop).
 *
 * ── ⚖ WHAT THIS PANEL IS, AFTER 2026-09-06 ────────────────────────────
 *
 * ⚖ The user ruled it: **the debugger is the INSPECTOR of the one cost
 * algorithm, not a model of its own.** There is exactly one engine —
 * `shared/procgen/loopCostPlanner.js` — with two drivers (this panel, through
 * `loopsCostDebugger/costPlanner.js`; and the Loops panel's Generate Costs)
 * and a third caller (the procgen pipeline's `generateLoopCosts`).
 * `scripts/procgen/check-loop-costs-one-model.mjs` is the standing proof that
 * the block this panel stamps is byte-for-byte the block the pipeline embeds.
 *
 * ⛔ **THE PLAN IS NOT THE BLOCK, AND THIS PANEL HAS TO SAY SO.** ⚖ (i) — the
 * simulation walks EVERY region as if it were coarse, because that is how the
 * numbers are derived at all; `writeCostsByClass` then decides what reaches
 * the block, per the region's substrate:
 *
 *   COARSE   a `moveCost` and its locations' costs — the numbers are the price.
 *   NATIVE   nothing (jta, omsi). The substrate runs its own mana economy.
 *   SUMMARY  a drain per second only (runner, bounce), plus whatever the input
 *            block named explicitly.
 *
 * A readout that printed the simulation's 50 for a NATIVE region would be
 * stating a price nothing charges. So every cost this panel renders is
 * labelled by its region's CLASS — and, separately, by its CAPTURE SHAPE,
 * which is who charges at RUN TIME and is not the same question: maze is
 * COARSE (the block carries its `moveCost`) and FINE (the maze panel divides
 * that cost per tile and charges it natively, so the loop QUEUE charges
 * nothing).
 */

import {
  getCostPlanner, getModuleEventBus, getSphereLog,
  consumePendingWorkingCopy, LOOPS_COST_DEBUGGER_LOAD_RULES,
} from './index.js';
import {
  classifyRegions, REGION_CLASS,
} from '../shared/procgen/loopCostGenerator.js';
import {
  documentStateManager, documentPlayerId, documentSphereLog,
} from './documentStateManager.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('loopsCostDebuggerUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[loopsCostDebuggerUI] ${message}`, ...data);
  }
}

/**
 * CostDebuggerUI - GoldenLayout panel component
 */
export class CostDebuggerUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    Object.defineProperty(this, 'eventBus', {
      get: () => getModuleEventBus(),
      configurable: true,
    });

    this.selectedStepIndex = -1;
    this.subscriptions = [];
    this.isVerifying = false;
    this.verificationResults = [];
    this._verifyCancelled = false;
    // Set when the sphere-log slice or the rules changed under a loaded plan.
    this._isStale = false;
    /**
     * ⛓ H5 — the WORKING COPY this panel is planning, or null for applied
     * state. `{jsonData, source, player, stats}`. It is the panel's, not the
     * planner's: the planner holds only the state manager it was handed, and
     * the panel is what has to SAY which world the numbers describe.
     */
    this._workingCopy = null;

    this.rootElement = this._createRootElement();
    this.container.element.appendChild(this.rootElement);

    this._subscribeToEvents();

    // ⛓ A hand-off may have been stashed before this panel existed; the live
    //   subscription in _subscribeToEvents clears the slot when it fires first.
    const pending = consumePendingWorkingCopy();
    if (pending) this._adoptWorkingCopy(pending.jsonData, pending.source, pending.player);

    this.container.on('destroy', () => this._onDestroy());

    log('info', 'CostDebuggerUI initialized');
  }

  getRootElement() {
    return this.rootElement;
  }

  // =========================================================================
  // DOM Creation
  // =========================================================================

  _createRootElement() {
    const el = document.createElement('div');
    el.className = 'cost-debugger-panel';

    el.innerHTML = `
      <div class="cd-controls">
        <button class="cd-btn-load" title="Load sphere log data">Load</button>
        <button class="cd-btn-verify" title="Verify loaded cost data against sphere log">Verify</button>
        <button class="cd-btn-plan-step" disabled title="Plan next action queue">Plan Step</button>
        <button class="cd-btn-plan-sphere" disabled title="Plan remaining steps for current sphere entry">Plan Sphere</button>
        <button class="cd-btn-plan-all" disabled title="Plan all remaining steps">Plan All</button>
        <button class="cd-btn-reset" disabled title="Reset to initial state">Reset</button>
        <button class="cd-btn-applied" style="display: none;" title="Stop planning the handed-over working copy and go back to the world the app has loaded">Use applied state</button>
      </div>
      <div class="cd-status-bar">
        <span class="cd-status">No sphere log loaded</span>
        <div class="cd-status-warn" style="display: none;"></div>
      </div>
      <div class="cd-step-list-container">
        <div class="cd-step-list">
          <div class="cd-step-list-empty">Click "Load" to load sphere log data, then "Plan Step" to begin.</div>
        </div>
      </div>
      <div class="cd-resize-handle"></div>
      <div class="cd-detail-container" style="height: 250px;">
        <div class="cd-detail-empty">Select a step to view details</div>
      </div>
      <div class="cd-summary">
        <span class="cd-summary-item">
          <span class="cd-summary-label">Loops:</span>
          <span class="cd-summary-value cd-summary-steps">0</span>
        </span>
        <span class="cd-summary-item">
          <span class="cd-summary-label">Entries:</span>
          <span class="cd-summary-value cd-summary-entries">0 / 0</span>
        </span>
        <span class="cd-summary-item">
          <span class="cd-summary-label">Regions:</span>
          <span class="cd-summary-value cd-summary-regions">0</span>
        </span>
        <span class="cd-summary-item">
          <span class="cd-summary-label">Locations:</span>
          <span class="cd-summary-value cd-summary-locations">0</span>
        </span>
        <span class="cd-summary-item" title="There is ONE cost engine: shared/procgen/loopCostPlanner.js. This panel and the Loops panel's Generate Costs are two drivers of it, and the procgen pipeline's generateLoopCosts is a third caller — scripts/procgen/check-loop-costs-one-model.mjs is the standing proof that they produce the same block. The second half of this line is WHICH WORLD these numbers describe.">
          <span class="cd-summary-label">Engine:</span>
          <span class="cd-summary-value cd-summary-engine">loopCostPlanner \u00b7 applied state</span>
        </span>
      </div>
    `;

    this._attachControlListeners(el);
    this._attachResizeHandle(el);

    return el;
  }

  _attachControlListeners(el) {
    el.querySelector('.cd-btn-load').addEventListener('click', () => this._handleLoad());
    el.querySelector('.cd-btn-verify').addEventListener('click', () => this._handleVerify());
    el.querySelector('.cd-btn-plan-step').addEventListener('click', () => this._handlePlanStep());
    el.querySelector('.cd-btn-plan-sphere').addEventListener('click', () => this._handlePlanSphere());
    el.querySelector('.cd-btn-plan-all').addEventListener('click', () => this._handlePlanAll());
    el.querySelector('.cd-btn-reset').addEventListener('click', () => this._handleReset());
    el.querySelector('.cd-btn-applied').addEventListener('click', () => this._useAppliedState());
  }

  _attachResizeHandle(el) {
    const handle = el.querySelector('.cd-resize-handle');
    const detailContainer = el.querySelector('.cd-detail-container');
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e) => {
      const delta = startY - e.clientY;
      detailContainer.style.height = Math.max(100, startHeight + delta) + 'px';
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startHeight = detailContainer.offsetHeight;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }

  // =========================================================================
  // Event Subscriptions
  // =========================================================================

  _subscribeToEvents() {
    const subscribe = (eventName, handler) => {
      const unsub = this.eventBus.subscribe(eventName, handler.bind(this));
      this.subscriptions.push(unsub);
    };

    subscribe('loopsCostDebugger:stepPlanned', this._handleStepPlannedEvent);
    subscribe('loopsCostDebugger:allPlanned', this._handleAllPlannedEvent);
    subscribe('loopsCostDebugger:reset', this._handleResetEvent);

    // A player switch re-slices the sphere log and a rules reload replaces the
    // world; either makes an already-loaded plan describe data that is gone.
    // Marking stale rather than auto-reloading: a reload here would discard
    // the user's planned steps without being asked.
    subscribe('sphereState:dataLoaded', this._handleDataChangedEvent);
    subscribe('stateManager:rulesLoaded', this._handleDataChangedEvent);

    /**
     * ⛓⛓⛓ H5 — **THE HUB'S `loop_costs` DOOR.** One door, two entries (live
     * event / stash drained at mount), so the adoption and everything it says
     * cannot drift between them — H4c's rule for `apworldEditor:loadRules`.
     */
    subscribe(LOOPS_COST_DEBUGGER_LOAD_RULES, (ev) => {
      if (ev && ev.jsonData) {
        this._adoptWorkingCopy(ev.jsonData, ev.source ?? null, ev.player ?? null);
      }
      consumePendingWorkingCopy();
    });
  }

  /**
   * ⛓⛓⛓ H5 — **PLAN A DOCUMENT THE APP HAS NEVER APPLIED** (plan §1's ⚖:
   * *"Linked editors open from the WORKING COPY"*).
   *
   * ⛔ It is ASYNC because the translation is `StateManager.loadFromJSON`,
   * dynamically imported (see `documentStateManager.js` for why, and for the
   * measured cost — 4 ms to 306 ms across the committed corpus). The status
   * line says so while it runs: a panel that sat silent for a third of a second
   * on the biggest document and then changed every number is a panel that
   * looked broken.
   *
   * ⛔ AND IT DOES NOT PLAN. Adoption re-points the planner and drops the old
   * plan; Load is the person's gesture, and the log it would use is a separate
   * refusal this panel has to be able to state (`documentSphereLog`).
   */
  async _adoptWorkingCopy(jsonData, source, player) {
    const planner = getCostPlanner();
    if (!planner) {
      this._setStatus('CostPlanner is not available — the loops module has not initialized.');
      return;
    }
    const playerId = player ? String(player) : documentPlayerId(jsonData);
    const label = source ? `working copy · ${source}` : 'working copy';
    this._setStatus(`Adopting the ${label} for player ${playerId}…`);
    try {
      const sm = await documentStateManager(jsonData, playerId);
      planner.useStateManager(sm, { playerId });
      this._workingCopy = { jsonData, source, player: playerId, stats: sm.stats };
      this._isStale = false;
      this.verificationResults = [];
      this.selectedStepIndex = -1;
      this._refreshStepList();
      this._refreshDetailView();
      this._updateSummary();
      this._updateStatus();
      this._updateButtons();
      log('info', `Adopted a working copy: ${sm.stats.regions} regions, `
        + `${sm.stats.locations} locations, ${sm.stats.ms} ms`);
    } catch (e) {
      log('error', 'working-copy adoption failed', e);
      this._setStatus(`Could not read that working copy: ${e.message}`);
    }
  }

  /**
   * ⛓ Back to the world the app has loaded. ⛔ Named rather than implicit: a
   * panel that silently reverted on the next `stateManager:rulesLoaded` would
   * discard a hand-off nobody asked it to discard, and one that never reverted
   * would show applied-state numbers under a working-copy label forever.
   */
  _useAppliedState() {
    const planner = getCostPlanner();
    if (!planner) return;
    planner.useStateManager(stateManagerProxySingleton, { playerId: null });
    this._workingCopy = null;
    this._isStale = false;
    this.verificationResults = [];
    this.selectedStepIndex = -1;
    this._refreshStepList();
    this._refreshDetailView();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
    this._setStatus('Back on APPLIED state — press Load to plan the loaded world.');
  }

  _handleDataChangedEvent() {
    const planner = getCostPlanner();
    if (!planner?.isLoaded()) return;
    // ⛓ H5 — an APP-WIDE load does not invalidate a WORKING COPY's plan: the
    //   plan describes a document the app was never holding, and marking it
    //   stale would tell a person to re-Load a world that has not changed.
    if (this._workingCopy) return;
    this._isStale = true;
    this._updateStatus();
  }

  _handleStepPlannedEvent(data) {
    this.selectedStepIndex = data.stepIndex;
    this._refreshStepList();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
    this._refreshDetailView();
    this._scrollToStep(data.stepIndex);
  }

  _handleAllPlannedEvent() {
    this._refreshStepList();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
  }

  _handleResetEvent() {
    this.selectedStepIndex = -1;
    this._refreshStepList();
    this._refreshDetailView();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
  }

  // =========================================================================
  // Button Handlers
  // =========================================================================

  _handleLoad() {
    const planner = getCostPlanner();
    if (!planner) {
      log('warn', 'CostPlanner not available');
      return;
    }

    /**
     * ⛓⛓ H5 — **A WORKING COPY IS PLANNED AGAINST ITS OWN LOG OR NOT AT ALL.**
     * The app's log describes whatever world is applied; borrowing it for a
     * handed-over document would manufacture the panel's own "ALL n sphere-log
     * locations are not in this player's world" condition instead of reporting
     * it. `documentSphereLog` returns the entries or the refusal to print.
     */
    let sphereLog;
    if (this._workingCopy) {
      const answer = documentSphereLog(this._workingCopy.jsonData);
      if (answer.refusal) { this._setStatus(answer.refusal); return; }
      sphereLog = answer.entries;
    } else {
      sphereLog = getSphereLog();
    }
    if (!sphereLog || sphereLog.length === 0) {
      this._setStatus('No sphere log available. Load a game with sphere data first.');
      return;
    }

    const result = planner.loadSphereLog(sphereLog);
    log('info',
      `Loaded sphere log: ${result.entryCount} entries for player ${result.playerId}, ` +
      `start region: ${result.startRegion}`);
    if (result.entryCount === 0) {
      log('error', planner.getPlanRejectionReason() || 'Sphere log produced no entries');
    }

    this._isStale = false;
    this.verificationResults = [];
    this.selectedStepIndex = -1;
    this._refreshStepList();
    this._refreshDetailView();
    this._updateSummary();
    this._updateStatus();
    this._updateButtons();
  }

  async _handleVerify() {
    const planner = getCostPlanner();
    if (!planner) {
      log('warn', 'CostPlanner not available');
      return;
    }

    const steps = planner.getPlannedSteps();
    if (steps.length === 0) {
      this._setStatus('No steps planned. Click Load, then Plan All first.');
      return;
    }

    // Get game APIs via centralRegistry
    const getLoopState = window.centralRegistry?.getPublicFunction?.('loops', 'getLoopState');
    const getGameState = window.centralRegistry?.getPublicFunction?.('gameState', 'getState');
    const loopState = getLoopState?.();
    const gameState = getGameState?.();

    if (!loopState || !gameState) {
      this._setStatus('Game APIs not available. Ensure loops and gameState modules are loaded.');
      return;
    }

    // Initialize verification state
    this.isVerifying = true;
    this.verificationResults = [];
    this._verifyCancelled = false;
    this._updateButtons();

    /**
     * ⛓ Built once for the whole run: `classifyRegions` walks the topology and
     * the shape resolver holds ONE `getPublicFunction` call. The topology
     * cannot change mid-verify — every button is disabled while it runs.
     */
    const ctx = this._pricingContext();

    /**
     * ⚠ Verify drives the APP'S live loop state and gameState. With a working
     * copy adopted, the plan describes a document the app is not holding, so
     * this replays the plan's steps against the APPLIED world — right when the
     * two are the same document (the ordinary hub hand-off) and meaningless
     * when they are not. Said out loud rather than refused: refusing would
     * break the case that works.
     */
    if (this._workingCopy) {
      this._setWarnings([{
        severity: 'warn',
        text: 'Verify replays these steps through the APPLIED world, not the working copy — '
            + 'the comparison is only meaningful while the two are the same document.',
      }]);
    }

    // Save current settings to restore after verification
    const savedInstantMode = loopState.instantMode;
    const savedNoManaReset = gameState.noManaDepletionReset;
    const savedAutoRestart = loopState.autoRestartQueue;

    try {
      // Reset game state for a fresh playthrough
      loopState.resetForNewRules();
      gameState.reset();

      // Get start region
      const startRegion = gameState.getCurrentRegion();

      // Configure loopState for verification
      loopState.setAutoRestartQueue(false);
      loopState.setInstantMode(true);
      loopState.setNoManaDepletionReset(true);

      // Get cross-player item grant for multiworld support.
      // In multiworld, checkLocation skips items belonging to other players.
      // We grant those items before checking locations that require them.
      const grantItemsUpToSphere = centralRegistry.getPublicFunction('sphereState', 'grantItemsUpToSphere');
      let lastGrantedSphere = null;

      // Filter to executable steps (skip DEFAULTS)
      const executableSteps = steps.filter(s => s.phase !== 'DEFAULTS');

      for (let i = 0; i < executableSteps.length; i++) {
        if (this._verifyCancelled) break;

        const step = executableSteps[i];

        // Grant cross-player items for all spheres up to this step's sphere.
        if (grantItemsUpToSphere && step.sphereIndex !== lastGrantedSphere) {
          const result = await grantItemsUpToSphere(step.sphereIndex);
          if (result.grantedCount > 0) {
            log('info', `[Verify] Granted ${result.grantedCount} cross-player items up to sphere ${step.sphereIndex}`);
            // Let the snapshot cascade settle before proceeding
            await new Promise(r => setTimeout(r, 50));
          }
          lastGrantedSphere = step.sphereIndex;
        }
        const label = step.phase === 'EXPLORE' ? step.targetRegion : step.locationName;
        this._setStatus(`Verifying ${i + 1}/${executableSteps.length}: ${step.phase} ${label || ''}`);

        // Record XP state before
        const xpBefore = new Map();
        for (const [region, data] of gameState.regionXP) {
          xpBefore.set(region, { ...data });
        }

        // Reset mana for this loop (simulate loop reset between steps)
        gameState.currentMana = gameState.maxMana;
        gameState.manaDebt = 0;
        loopState.resetManaDebt();
        const manaAtStart = gameState.currentMana;
        const maxManaAtStart = gameState.maxMana;

        // Execute queue actions directly, awaiting each checkLocation to avoid
        // flooding the worker. loopState.startProcessing() fires all actions in
        // one frame (instant mode), which overwhelms the worker command queue.
        const split = this._queueChargeSplit(step, ctx);
        await this._executeStepDirect(loopState, step.queue, ctx);

        // Record state after
        const manaAfter = gameState.currentMana;
        const maxManaAfter = gameState.maxMana;
        const actualManaConsumed = manaAtStart - manaAfter + gameState.manaDebt;

        // Calculate XP gained (use totalXP to account for level-up resets)
        const xpGained = {};
        for (const [region, afterData] of gameState.regionXP) {
          const beforeData = xpBefore.get(region);
          const xpDelta = totalXP(afterData) - totalXP(beforeData);
          if (xpDelta > 0) xpGained[region] = xpDelta;
        }

        // Store result
        this.verificationResults.push({
          stepIndex: step.stepIndex,
          phase: step.phase,
          completed: true,
          actual: {
            manaAtStart,
            maxManaAtStart,
            manaConsumed: actualManaConsumed,
            manaRemaining: manaAfter,
            maxManaAfter,
            manaDebt: gameState.manaDebt,
            xpGained,
          },
          predicted: {
            manaConsumed: step.simulatedResults.manaConsumed,
            manaRemaining: step.simulatedResults.manaRemaining,
            maxMana: step.stateAfter.maxMana,
            // ⛓ the part of the prediction the QUEUE is answerable for — the
            //   only part a replay through the queue can confirm or refute.
            queueCharged: split.charged,
          },
          /**
           * ⛔ A step is COMPARABLE only when the queue bills all of it. A jta
           * or omsi step (own economy) and a runner or bounce step (time-
           * priced) are replayed and REPORTED, never scored: the runtime is
           * correct to charge nothing there, and scoring it would turn the
           * design into a permanent red.
           */
          comparable: split.uncharged === 0,
          // the simulated spend in regions the block leaves unpriced
          uncharged: split.uncharged,
          unchargedReasons: split.reasons,
        });

        // Update UI after each step
        this.selectedStepIndex = step.stepIndex;
        this._refreshStepList();
        this._refreshDetailView();
        this._updateSummary();

        // Yield to browser to allow UI updates
        await new Promise(r => setTimeout(r, 0));
      }

      // Final status
      const tolerance = 5;
      const comparable = this._comparableResults();
      const matched = comparable.filter(r =>
        Math.abs(r.actual.manaConsumed - r.predicted.queueCharged) <= tolerance
      ).length;
      const notScored = this.verificationResults.length - comparable.length;
      /**
       * ⛔ `0/0 within tolerance` is not a sentence about anything. On a world
       * whose regions are ALL priced by their own substrates (jta, omsi) there
       * is nothing for a queue replay to score, and the panel says that
       * instead of printing a ratio with an empty denominator.
       */
      this._setStatus(`Verification complete: ${executableSteps.length} steps`
        + (comparable.length
          ? `, ${matched}/${comparable.length} within tolerance`
          : ' — the block prices none of them, so there is nothing to score')
        + (notScored && comparable.length
          ? `; ${notScored} unpriced by design (own economy / time-priced)`
          : notScored ? ' (own economy / time-priced)' : ''));

    } catch (error) {
      console.error('[CostDebuggerUI] Verification error:', error);
      this._setStatus(`Verification error: ${error.message}`);
    } finally {
      // Restore loopState settings
      loopState.setInstantMode(savedInstantMode);
      loopState.setNoManaDepletionReset(savedNoManaReset);
      loopState.setAutoRestartQueue(savedAutoRestart);
      gameState.manaDebt = 0;

      this.isVerifying = false;
      this._updateButtons();
      this._updateSummary();
    }
  }

  _handlePlanStep() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded() || planner.isComplete()) return;
    planner.planNextStep();
  }

  _handlePlanSphere() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded() || planner.isComplete()) return;
    planner.planCurrentSphere();
  }

  _handlePlanAll() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded() || planner.isComplete()) return;
    planner.planAll();
  }

  _handleReset() {
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded()) return;
    planner.reset();
    this.verificationResults = [];
  }

  /**
   * Convert a CostPlanner step queue to gameState path format
   */
  _convertQueueToPath(stepQueue) {
    const path = [];
    const instanceCounts = new Map();

    for (const action of stepQueue) {
      if (action.type === 'move') {
        const instNum = (instanceCounts.get(action.to) || 0) + 1;
        instanceCounts.set(action.to, instNum);
        path.push({
          type: 'regionMove',
          sourceRegion: action.from,
          destinationRegion: action.to,
          exitUsed: action.exitUsed || null,
          instanceNumber: instNum,
        });
      } else if (action.type === 'explore') {
        const instNum = instanceCounts.get(action.region) || 1;
        path.push({
          type: 'customAction',
          actionName: 'explore',
          params: {},
          sourceRegion: action.region,
          instanceNumber: instNum,
        });
      } else if (action.type === 'locationCheck') {
        const instNum = instanceCounts.get(action.region) || 1;
        path.push({
          type: 'locationCheck',
          locationName: action.location,
          sourceRegion: action.region,
          instanceNumber: instNum,
        });
      }
    }

    return path;
  }

  /**
   * Execute a queue through the real game engine and wait for completion
   */
  _executeQueue(loopState) {
    return new Promise((resolve, reject) => {
      const queue = loopState.getActionQueue();
      if (queue.length === 0) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        unsub();
        reject(new Error('Queue execution timed out after 30s'));
      }, 30000);

      const unsub = this.eventBus.subscribe('loopState:queueCompleted', () => {
        clearTimeout(timeout);
        unsub();
        resolve();
      });

      loopState.startProcessing();
    });
  }

  /**
   * Execute a step's action queue directly, bypassing loopState.startProcessing().
   * Processes actions sequentially, awaiting each checkLocation so the worker
   * is never flooded. Updates loopState mana/XP to match what _processFrame does.
   */
  async _executeStepDirect(loopState, stepQueue, ctx = null) {
    const gameState = window.centralRegistry?.getPublicFunction?.('gameState', 'getState')?.();
    for (const action of stepQueue) {
      const sourceRegionName = action.region || action.from;
      const pricing = sourceRegionName && ctx
        ? this._pricingOf(sourceRegionName, ctx) : null;
      /**
       * ⛔⛔ **A NATIVE REGION MUST BE CHARGED NOTHING HERE, BECAUSE THE
       * RUNTIME CHARGES IT NOTHING.** `_calculateActionCost` has no `fine`
       * branch — the runtime's shape test lives in its CALLERS
       * (`observeParkedLiveAction`, `_handleManualWake_regionMove` and
       * `_completeBotExecutedAction` each return early on 'fine'), so calling
       * the pricing function on its own bills a jta region the STORE'S
       * FALLBACK for a move nothing charges. Measured on `jta_schedule_test`:
       * the block writes no entry for any of the three jta regions, so
       * `getRegionCost` answered `defaultRegionCost` 50 and `getLocationCost`
       * answered 10, and Verify scored the runtime wrong by up to **375.7
       * mana** (omsi) — a permanent red that was the design working. Forcing 0
       * is what makes "actual" the runtime's actual.
       *
       * ⚠ Two things are deliberately NOT forced:
       *   SUMMARY — `_calculateActionCost`'s summary branch already answers
       *     with the explicit cost or nothing, which is the runtime's own rule.
       *   COARSE-classed FINE regions (maze) — the block carries the price and
       *     the substrate charges exactly it, per tile; zeroing them would
       *     throw away a comparison that measured 10/10 with delta 0.0.
       */
      const actionCost = pricing && pricing.cls === REGION_CLASS.NATIVE ? 0 : loopState._calculateActionCost({
        type: action.type === 'locationCheck' ? 'locationCheck'
            : action.type === 'move' ? 'regionMove'
            : 'customAction',
        sourceRegion: sourceRegionName,
        destinationRegion: action.to,
        locationName: action.location,
        exitUsed: action.exitUsed,
      });

      // Deduct mana
      const newMana = gameState.currentMana - actionCost;
      if (newMana < 0 && gameState.noManaDepletionReset) {
        gameState.manaDebt = Math.max(gameState.manaDebt, Math.abs(newMana));
        gameState.currentMana = newMana;
      } else {
        gameState.currentMana = Math.max(0, newMana);
      }

      // XP gain (1 XP per mana spent, same as loopState)
      const sourceRegion = action.region || action.from;
      if (sourceRegion) {
        loopState.addRegionXP(sourceRegion, actionCost);
      }

      // For locationCheck, await the worker to avoid flooding
      if (action.type === 'locationCheck' && action.location) {
        try {
          await stateManagerProxySingleton.checkLocation(action.location);
        } catch (e) {
          log('warn', `[Verify] checkLocation failed: ${action.location}: ${e.message}`);
        }
      }
    }
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  _setStatus(text) {
    const statusEl = this.rootElement.querySelector('.cd-status');
    if (statusEl) statusEl.textContent = text;
  }

  // =========================================================================
  // ⛓⛓⛓ PRICING CLASS — the two questions a cost readout has to answer
  // =========================================================================

  /**
   * ⛓⛓ **THE PRICING CONTEXT — built ONCE per render pass, never per row.**
   *
   *   `classes`  region → `REGION_CLASS`, from the shared `classifyRegions`
   *              over the PLANNER'S OWN topology: the same call `getCostData()`
   *              makes, so the panel cannot disagree with the block it is
   *              inspecting about which regions the block speaks for.
   *   `shapeOf`  region → CAPTURE SHAPE, the runtime's answer, asked of the
   *              runtime (`loopState.getSubstrateCaptureShape`). The substrate
   *              id comes from the PLAN's topology and not the app's
   *              `_lookupSubstrateId`: with a working copy adopted, the app is
   *              holding a different world and its lookup answers 'coarse' for
   *              every region of the document being planned.
   *
   * ⛔ **ONE `getPublicFunction` CALL PER RENDER, and that is not tidiness.**
   * `centralRegistry.getPublicFunction` LOGS AN ERROR when the module is not up
   * (measured on a cold page: five `Public function 'getLoopState' not found`
   * lines before loops registers). A resolver called per region per row would
   * turn that into a screenful and bury a real error next to it.
   *
   * ⛔ Nothing here is CACHED ACROSS renders: an adoption or a rules reload
   * replaces the topology under the panel, and a cached map would label the new
   * world with the old world's classes.
   * @private
   */
  _pricingContext() {
    const topology = getCostPlanner()?.getTopology?.();
    let classes = new Map();
    if (topology?.regions) {
      try {
        classes = classifyRegions(topology);
      } catch { /* an unclassifiable topology means every region reads COARSE */ }
    }

    let ask = null;
    try {
      const loopState = centralRegistry.getPublicFunction('loops', 'getLoopState')?.();
      if (typeof loopState?.getSubstrateCaptureShape === 'function') {
        ask = (id) => loopState.getSubstrateCaptureShape(id);
      }
    } catch { /* loops not up — every region reads 'coarse', the safe direction */ }

    const shapes = new Map();
    const shapeOf = (regionName) => {
      if (shapes.has(regionName)) return shapes.get(regionName);
      const substrateId = topology?.regionSubstrates?.get?.(regionName) ?? null;
      let shape = 'coarse';
      if (substrateId && ask) {
        try { shape = ask(substrateId) || 'coarse'; } catch { shape = 'coarse'; }
      }
      shapes.set(regionName, shape);
      return shape;
    };

    return { classes, shapeOf, topology };
  }

  /**
   * ⛓⛓ **WHAT ONE REGION'S NUMBERS MEAN**, in the one place every readout asks.
   *
   *   `cls`             what the BLOCK says about it (COARSE / NATIVE / SUMMARY).
   *   `shape`           who CHARGES at run time (coarse / fine / summary).
   *   `priced`          false ⇒ the block deliberately carries no cost for it,
   *                     so the simulation's number is a step in deriving the
   *                     OTHER regions' costs and not a price. A readout must
   *                     NOT print it as one.
   *   `chargedByQueue`  false ⇒ the loop queue takes nothing for it at run time;
   *                     a substrate or a clock does the charging.
   *   `label` / `why`   the phrase that replaces a number, and the sentence a
   *                     person needs after reading it.
   *
   * ⚠ The two axes are NOT the same question and maze is why: it is COARSE (the
   * block carries its `moveCost`) and FINE (`mazeRoomUI._perTileMoveCost`
   * divides that cost by the room's longest shortest path and charges it
   * natively, so the queue charges nothing).
   * @private
   */
  _pricingOf(regionName, ctx) {
    const cls = ctx.classes.get(regionName) ?? REGION_CLASS.COARSE;
    const shape = ctx.shapeOf(regionName);
    const chargedByQueue = shape === 'coarse';

    if (cls === REGION_CLASS.NATIVE) {
      return {
        cls, shape, priced: false, chargedByQueue,
        label: 'own economy',
        why: 'this substrate runs its own mana economy, so the block writes no cost for '
           + 'it and the loop queue charges nothing — the number beside it is a step in '
           + 'deriving the other regions\' costs, not a price.',
      };
    }
    if (cls === REGION_CLASS.SUMMARY) {
      return {
        cls, shape, priced: false, chargedByQueue,
        label: 'time-priced',
        why: 'a summary substrate is priced by how long a visit takes — the block writes '
           + 'a drain per second and nothing else, and a per-action cost applies only '
           + 'where the input block named one explicitly.',
      };
    }
    if (!chargedByQueue) {
      return {
        cls, shape, priced: true, chargedByQueue,
        label: 'per tile',
        why: 'the block carries this region\'s moveCost and the substrate charges it '
           + 'natively (maze divides it by the room\'s longest shortest path), so the '
           + 'loop queue itself charges nothing for the visit.',
      };
    }
    return { cls, shape, priced: true, chargedByQueue, label: null, why: null };
  }

  /** The region a planned location belongs to, per the plan's own topology. */
  _regionOfLocation(locationName, ctx) {
    return ctx.topology?.locations?.get?.(locationName)?.region ?? null;
  }

  /**
   * The pricing that governs one cost assignment — a region row is about
   * itself, a location row about the region that contains it.
   * @private
   */
  _pricingOfAssignment(ca, ctx) {
    const region = ca.type === 'region' ? ca.name : this._regionOfLocation(ca.name, ctx);
    return region ? this._pricingOf(region, ctx) : null;
  }

  /**
   * ⛓⛓ **HOW MUCH OF A PLANNED STEP THE BLOCK ACTUALLY PRICES.** Verify
   * compares a prediction against a replay; where the block deliberately
   * carries no cost, the replay has nothing to confirm and scoring it as a
   * MISMATCH is the panel accusing the runtime of a bug that is the design.
   *
   * ⛔⛔ **THE SPLIT IS `priced`, NOT `chargedByQueue` — and the difference is
   * MEASURED, not stylistic.** The first shape of this code excluded every
   * region the QUEUE does not charge, which swallows maze: maze is FINE (its
   * walker charges per tile) but COARSE-classed (the block carries its
   * `moveCost`, and per-tile × longest-shortest-path is that same total). On
   * `maze_loop_worldgen` that cost a real result — **10/10 within tolerance,
   * max delta 0.0, became "none scored"**. Who charges is a presentational
   * note (the queue's `Charged by` column); whether the BLOCK states a price
   * is what decides if there is anything to verify.
   * @private
   */
  _queueChargeSplit(step, ctx) {
    let scored = 0;
    let unscored = 0;
    const reasons = new Map();
    for (const q of step.queue || []) {
      const region = q.region || q.from || null;
      const pricing = region ? this._pricingOf(region, ctx) : null;
      if (pricing && !pricing.priced) {
        unscored += q.cost;
        reasons.set(pricing.label, pricing.why);
      } else {
        scored += q.cost;
      }
    }
    return { charged: scored, uncharged: unscored, reasons: [...reasons.entries()] };
  }

  /** The verification rows the queue actually bills — the only comparable ones. */
  _comparableResults() {
    return this.verificationResults.filter(r => r.comparable);
  }

  /**
   * Render the warning lines below the status. Empty array hides the block.
   * @param {Array<{text: string, severity: 'warn'|'error'}>} warnings
   */
  _setWarnings(warnings) {
    const el = this.rootElement.querySelector('.cd-status-warn');
    if (!el) return;
    if (!warnings || warnings.length === 0) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = '';
    el.innerHTML = warnings.map(w =>
      `<div class="cd-status-${w.severity === 'error' ? 'error' : 'warning'}">${escapeHtml(w.text)}</div>`
    ).join('');
  }

  /**
   * "Player 2 (Player2 — A Link to the Past)" for the player the plan is for.
   * `player_names` and `world` are keyed by player id (the unsliced maps), so
   * they still name the right player after a switch.
   */
  _playerLabel(planner) {
    const playerId = planner?.getPlayerId()
      || centralRegistry.getPublicFunction('sphereState', 'getCurrentPlayerId')?.()
      || null;
    if (!playerId) return 'Player ?';

    /**
     * ⛓ H5 — the STATE MANAGER THE PLANNER IS ACTUALLY USING, not the app's.
     * With a working copy adopted this is the document's own; reading the
     * proxy here would label a handed-over world with the applied one's player
     * names and game — a true sentence about the wrong subject, which is
     * precisely what this label exists to prevent.
     */
    const staticData = (planner?.stateManager ?? stateManagerProxySingleton)?.getStaticData?.();
    const name = staticData?.player_names?.[playerId] || null;
    // game_name describes the LOADED world only — claiming it for some other
    // player is exactly the confusion this label exists to prevent.
    const isLoadedPlayer = String(playerId) === String(staticData?.playerId);
    const game = staticData?.world?.[playerId]?.game
      || (isLoadedPlayer ? staticData?.game_name : null)
      || null;

    const detail = [name, game].filter(Boolean).join(' — ');
    return detail ? `Player ${playerId} (${detail})` : `Player ${playerId}`;
  }

  _collectWarnings(planner) {
    const warnings = [];

    if (this._isStale) {
      warnings.push({
        severity: 'warn',
        text: 'Data changed (player switch or rules reload) — press Load to re-plan.',
      });
    }

    const diag = planner.getLogDiagnostics();
    if (diag?.error) {
      warnings.push({ severity: 'error', text: diag.error });
      return warnings;
    }

    if (planner.getTotalEntries() === 0 && diag && diag.stateUpdateCount > 0) {
      warnings.push({
        severity: 'error',
        text: `Sphere log has no data for player ${diag.playerId} — available players: ` +
          `[${diag.availablePlayers.join(', ') || 'none'}]. The loaded rules and the ` +
          `sphere log disagree about which player this is.`,
      });
    }

    const foreign = planner.getSkippedForeignEntries();
    const locationEntries = planner.getLocationEntryCount();
    if (foreign > 0) {
      const all = foreign >= locationEntries;
      warnings.push({
        severity: all ? 'error' : 'warn',
        text: all
          ? `ALL ${foreign} of ${locationEntries} sphere-log locations are not in this ` +
            `player's world — wrong player or wrong seed. The generated costs are ` +
            `defaults only; do not use them.`
          : `${foreign} of ${locationEntries} sphere-log locations are not in this ` +
            `player's world — wrong player or wrong seed?`,
      });
    }

    const truncation = planner.getTruncation();
    if (truncation) {
      warnings.push({
        severity: 'error',
        text: `Planning hit the ${truncation.limit}-step guard and stopped early — ` +
          `the plan is INCOMPLETE.`,
      });
    }

    return warnings;
  }

  /**
   * ⛓ H5 — WHICH WORLD the numbers describe, in front of every status
   * sentence. ⛔ Not a badge somewhere else on the panel: a person reading
   * "Complete: 12 loops" has to know whether those loops are the applied
   * world's or a document that has never been applied.
   */
  _sourcePrefix() {
    if (!this._workingCopy) return '';
    const { source, stats } = this._workingCopy;
    return `[working copy${source ? ` · ${source}` : ''} — `
      + `${stats.regions} regions, ${stats.locations} locations] `;
  }

  _updateStatus() {
    if (this.isVerifying) return; // Status managed by verify loop
    const planner = getCostPlanner();
    if (!planner || !planner.isLoaded()) {
      this._setStatus(`${this._sourcePrefix()}No sphere log loaded`);
      this._setWarnings([]);
      return;
    }
    const steps = planner.getPlannedSteps().length;
    const entries = planner.getTotalEntries() - (planner.getSkippedEventEntries() || 0);
    const who = this._playerLabel(planner);

    if (this.verificationResults.length > 0) {
      const tolerance = 5;
      const comparable = this._comparableResults();
      const matched = comparable.filter(r =>
        Math.abs(r.actual.manaConsumed - r.predicted.queueCharged) <= tolerance
      ).length;
      const notScored = this.verificationResults.length - comparable.length;
      this._setStatus(`${this._sourcePrefix()}${who} · Verified: ${this.verificationResults.length} steps`
        + (comparable.length
          ? `, ${matched}/${comparable.length} within tolerance`
          : ' — the block prices none of them, nothing to score')
        + (notScored && comparable.length ? `, ${notScored} unpriced by design` : ''));
    } else if (planner.isComplete()) {
      this._setStatus(`${this._sourcePrefix()}${who} · Complete: ${steps} loops, ${entries} entries`);
    } else {
      this._setStatus(`${this._sourcePrefix()}${who} · ${steps} loops planned`);
    }

    this._setWarnings(this._collectWarnings(planner));
  }

  _updateButtons() {
    const planner = getCostPlanner();
    const loaded = planner?.isLoaded() || false;
    const complete = planner?.isComplete() || false;
    const hasSteps = (planner?.getPlannedSteps().length || 0) > 0;

    const btnLoad = this.rootElement.querySelector('.cd-btn-load');
    const btnVerify = this.rootElement.querySelector('.cd-btn-verify');
    const btnPlanStep = this.rootElement.querySelector('.cd-btn-plan-step');
    const btnPlanSphere = this.rootElement.querySelector('.cd-btn-plan-sphere');
    const btnPlanAll = this.rootElement.querySelector('.cd-btn-plan-all');
    const btnReset = this.rootElement.querySelector('.cd-btn-reset');
    // ⛓ H5 — the way back exists only while there is something to go back from.
    const btnApplied = this.rootElement.querySelector('.cd-btn-applied');
    if (btnApplied) {
      btnApplied.style.display = this._workingCopy ? '' : 'none';
      btnApplied.disabled = this.isVerifying;
    }

    if (this.isVerifying) {
      if (btnLoad) btnLoad.disabled = true;
      if (btnVerify) btnVerify.disabled = true;
      if (btnPlanStep) btnPlanStep.disabled = true;
      if (btnPlanSphere) btnPlanSphere.disabled = true;
      if (btnPlanAll) btnPlanAll.disabled = true;
      if (btnReset) btnReset.disabled = true;
      return;
    }

    if (btnLoad) btnLoad.disabled = false;
    if (btnVerify) btnVerify.disabled = !hasSteps;
    if (btnPlanStep) btnPlanStep.disabled = !loaded || complete;
    if (btnPlanSphere) btnPlanSphere.disabled = !loaded || complete;
    if (btnPlanAll) btnPlanAll.disabled = !loaded || complete;
    if (btnReset) btnReset.disabled = !loaded || !hasSteps;
  }

  _updateSummary() {
    const planner = getCostPlanner();
    const steps = planner?.getPlannedSteps() || [];
    const totalEntries = planner?.getTotalEntries() || 0;
    const skippedEvents = planner?.getSkippedEventEntries() || 0;

    const stepsEl = this.rootElement.querySelector('.cd-summary-steps');
    const entriesEl = this.rootElement.querySelector('.cd-summary-entries');
    const regionsEl = this.rootElement.querySelector('.cd-summary-regions');
    const locationsEl = this.rootElement.querySelector('.cd-summary-locations');

    if (stepsEl) stepsEl.textContent = String(steps.length);

    // Count completed sphere entries (CHECK steps), excluding skipped event locations
    const checkableEntries = totalEntries - skippedEvents;
    const completedEntries = steps.filter(s => s.phase === 'CHECK').length;
    if (entriesEl) entriesEl.textContent = `${completedEntries} / ${checkableEntries}`;

    // Update labels and values based on mode
    const regionsLabel = this.rootElement.querySelector('.cd-summary-regions')?.previousElementSibling;
    const locationsLabel = this.rootElement.querySelector('.cd-summary-locations')?.previousElementSibling;

    if (this.verificationResults.length > 0) {
      // Verification summary
      if (regionsLabel) regionsLabel.textContent = 'Matched:';
      if (locationsLabel) locationsLabel.textContent = 'Max \u0394:';

      const tolerance = 5;
      const comparable = this._comparableResults();
      const matched = comparable.filter(r =>
        Math.abs(r.actual.manaConsumed - r.predicted.queueCharged) <= tolerance
      ).length;
      if (regionsEl) {
        // ⛔ `0/0` claims a ratio there is no denominator for.
        regionsEl.textContent = comparable.length
          ? `${matched}/${comparable.length}` : 'none scored';
        regionsEl.title = 'steps whose replayed spend matched the part of the prediction the '
          + 'BLOCK states a price for; a step in a region the block leaves unpriced by design '
          + '(own economy, time-priced) is replayed and reported but never scored';
      }

      const maxDelta = comparable.length > 0
        ? Math.max(...comparable.map(r =>
            Math.abs(r.actual.manaConsumed - r.predicted.queueCharged)
          ))
        : 0;
      if (locationsEl) locationsEl.textContent = maxDelta.toFixed(1);
    } else {
      if (regionsLabel) regionsLabel.textContent = 'Regions:';
      if (locationsLabel) locationsLabel.textContent = 'Locations:';
      /**
       * ⛔ `getCostData()` is the BLOCK — write-by-class applied — so on a jta
       * world it holds 1 of 4 regions and 0 of 23 locations. A bare "1" read
       * as "one region planned" is the opposite of what happened, so the
       * denominator is the world's own count and the gap is the point.
       */
      const costData = planner?.getCostData();
      const topology = planner?.getTopology?.();
      const worldRegions = topology?.regions?.size ?? 0;
      const worldLocations = topology?.locations?.size ?? 0;
      if (regionsEl) {
        regionsEl.textContent = costData
          ? `${Object.keys(costData.regions).length} / ${worldRegions}` : '0';
        regionsEl.title = 'regions the BLOCK prices, of the regions in this world — '
          + 'a substrate with its own mana economy is left unpriced on purpose';
      }
      if (locationsEl) {
        locationsEl.textContent = costData
          ? `${Object.keys(costData.locations).length} / ${worldLocations}` : '0';
        locationsEl.title = 'locations the BLOCK prices, of the locations in this world';
      }
    }

    // ⛓ ONE engine, and which world it was pointed at.
    const engineEl = this.rootElement.querySelector('.cd-summary-engine');
    if (engineEl) {
      engineEl.textContent = `loopCostPlanner \u00b7 ${this._workingCopy
        ? `working copy${this._workingCopy.source ? ` (${this._workingCopy.source})` : ''}`
        : 'applied state'}`;
    }
  }

  _refreshStepList() {
    const listEl = this.rootElement.querySelector('.cd-step-list');
    if (!listEl) return;

    const planner = getCostPlanner();
    const steps = planner?.getPlannedSteps() || [];

    if (steps.length === 0) {
      let msg;
      if (planner?.isLoaded()) {
        msg = 'Sphere log loaded. Click "Plan Step" to begin.';
      } else {
        msg = 'Click "Load" to plan costs, or "Verify" to verify after planning.';
      }
      listEl.innerHTML = `<div class="cd-step-list-empty">${msg}</div>`;
      return;
    }

    // ⛓ Built ONCE for the whole list — see `_pricingContext`.
    const ctx = this._pricingContext();

    listEl.innerHTML = steps.map(step => {
      const selected = step.stepIndex === this.selectedStepIndex ? ' cd-selected' : '';
      const hasDeficit = step.simulatedResults.manaRemaining < 0;
      const hasWarning = step.notes.some(n => !n.includes('fully explored') && !n.includes('discovered') && !n.includes('Ready'));
      const warnClass = hasDeficit ? ' cd-has-error' : hasWarning ? ' cd-has-warning' : '';

      let phaseBadge, detail, truncName, sphereLabel;

      if (step.phase === 'DEFAULTS') {
        phaseBadge = '<span class="cd-phase-badge cd-phase-defaults">DEF</span>';
        const count = step.costAssignments.length;
        detail = `<span class="cd-step-new-costs">${count} assigned</span>`;
        truncName = 'Default Costs';
        sphereLabel = '';
      } else {
        phaseBadge = step.phase === 'EXPLORE'
          ? '<span class="cd-phase-badge cd-phase-explore">EXP</span>'
          : '<span class="cd-phase-badge cd-phase-check">CHK</span>';
        detail = '';
        if (step.phase === 'EXPLORE' && step.exploreProgress) {
          const p = step.exploreProgress;
          detail = `<span class="cd-step-progress">${p.discovered}/${p.total}</span>`;
        } else if (step.phase === 'CHECK') {
          const locAssignment = step.costAssignments.find(a => a.type === 'location');
          if (step.mode === 'verify' && locAssignment?.verification) {
            const v = locAssignment.verification;
            const deltaClass = v.delta === 0 ? 'cd-verify-exact' : Math.abs(v.delta) <= 5 ? 'cd-verify-close' : 'cd-verify-far';
            const sign = v.delta > 0 ? '+' : '';
            detail = `<span class="${deltaClass}">${sign}${v.delta}</span>`;
          } else {
            /**
             * ⛔ A location in a NATIVE or SUMMARY region has NO cost in the
             * block, so `cost=100` here would be a price nothing charges. The
             * number is still in the step's detail view, under the label that
             * says what it is.
             */
            const pricing = locAssignment
              ? this._pricingOfAssignment(locAssignment, ctx) : null;
            detail = pricing && !pricing.priced
              ? `<span class="cd-step-unpriced" title="${escapeHtml(pricing.why)}">${pricing.label}</span>`
              : `<span class="cd-step-new-costs">cost=${locAssignment?.cost || '?'}</span>`;
          }
        }
        truncName = step.phase === 'EXPLORE'
          ? truncate(step.targetRegion, 24)
          : truncate(step.locationName, 24);
        sphereLabel = `S${step.sphereIndex}`;
      }

      // Override detail with verification result if available
      const vResult = this.verificationResults.find(r => r.stepIndex === step.stepIndex);
      if (vResult && !vResult.comparable) {
        // ⛔ No delta: the BLOCK states no cost for this step's region, so
        //    there is no prediction for a replay to confirm or refute. The
        //    label is the region's own, not a generic one.
        const label = vResult.unchargedReasons?.[0]?.[0] ?? 'not priced';
        const why = vResult.unchargedReasons?.[0]?.[1]
          ?? 'the block states no cost for this region, so the replay is reported and not scored';
        detail = `<span class="cd-step-unpriced" title="${escapeHtml(why)}">${label}</span>`;
      } else if (vResult) {
        const delta = vResult.actual.manaConsumed - vResult.predicted.queueCharged;
        const absD = Math.abs(delta);
        const cls = absD <= 1 ? 'cd-verify-exact' : absD <= 5 ? 'cd-verify-close' : 'cd-verify-far';
        const sign = delta > 0 ? '+' : '';
        detail = `<span class="${cls}">\u0394${sign}${delta.toFixed(1)}</span>`;
      }

      return `
        <div class="cd-step-row${selected}${warnClass}" data-index="${step.stepIndex}">
          <span class="cd-step-index">${step.stepIndex + 1}</span>
          <span class="cd-step-sphere">${sphereLabel}</span>
          ${phaseBadge}
          <span class="cd-step-name" title="${escapeHtml(step.phase === 'DEFAULTS' ? 'Default Costs' : (step.phase === 'EXPLORE' ? step.targetRegion : step.locationName))}">${escapeHtml(truncName)}</span>
          <span class="cd-step-summary">${detail}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.cd-step-row').forEach(row => {
      row.addEventListener('click', () => {
        this.selectedStepIndex = parseInt(row.dataset.index, 10);
        this._refreshStepList();
        this._refreshDetailView();
      });
    });
  }

  _scrollToStep(stepIndex) {
    const row = this.rootElement.querySelector(`.cd-step-row[data-index="${stepIndex}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  _refreshDetailView() {
    const container = this.rootElement.querySelector('.cd-detail-container');
    if (!container) return;

    const planner = getCostPlanner();
    const steps = planner?.getPlannedSteps() || [];
    const step = steps[this.selectedStepIndex];

    if (!step) {
      container.innerHTML = '<div class="cd-detail-empty">Select a step to view details</div>';
      return;
    }

    container.innerHTML = `<div class="cd-detail-inner">${this._renderStepDetail(step)}</div>`;
  }

  // =========================================================================
  // Detail Rendering
  // =========================================================================

  _renderStepDetail(step) {
    const sections = [];
    const pad = (str, len) => String(str).padEnd(len);
    const rpad = (str, len) => String(str).padStart(len);
    const pre = (html) => `<pre style="margin:0; font-size:inherit; font-family:inherit; white-space:pre;">${html}</pre>`;

    // Header
    const modePrefix = step.mode === 'verify' ? 'Verify ' : '';
    if (step.phase === 'DEFAULTS') {
      sections.push(`<div class="cd-reason-header">Step ${step.stepIndex + 1} [Defaults]: Assign costs to unvisited regions &amp; locations</div>`);
    } else {
      const phaseLabel = step.phase === 'EXPLORE' ? 'Explore' : 'Check';
      const target = step.phase === 'EXPLORE' ? step.targetRegion : step.locationName;
      sections.push(`<div class="cd-reason-header">${modePrefix}Step ${step.stepIndex + 1} [${phaseLabel}]: ${escapeHtml(target)}</div>`);

      // Sphere entry context
      const entryIdx = step.sphereEntryIndex != null ? step.sphereEntryIndex + 1 : '?';
      const planner = getCostPlanner();
      const totalEntries = (planner?.getTotalEntries() || 0) - (planner?.getSkippedEventEntries() || 0);
      sections.push(`<div class="cd-reason-subheader">Sphere entry ${entryIdx}/${totalEntries || '?'} (sphere ${step.sphereIndex}): ${escapeHtml(step.locationName)}</div>`);
    }

    // State before
    const s = step.stateBefore;
    const xpParts = [];
    if (s.regionXP) {
      for (const [region, data] of s.regionXP) {
        if (data.level > 0) xpParts.push(`${region}:L${data.level}`);
      }
    }
    sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">State Before</div><div class="cd-reason-grid">` +
      `<span>Mana: ${fmtMana(s.currentMana)} / ${fmtMana(s.maxMana)}</span>` +
      `<span>Explored: ${s.exploredRegions.size} regions | Checked: ${s.checkedLocations.size} locations</span>` +
      (xpParts.length > 0 ? `<span>XP Levels: ${xpParts.join(', ')}</span>` : '') +
      `</div></div>`);

    // Path
    if (step.path && step.path.steps.length > 0) {
      const pathStr = step.path.steps.map(s => s.region).join(' \u2192 ');
      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Path (${step.path.steps.length - 1} steps)</div><div class="cd-reason-grid">` +
        `<span>${escapeHtml(pathStr)}</span>` +
        `</div></div>`);
    }

    // Explore Progress (EXPLORE phase only)
    if (step.phase === 'EXPLORE' && step.exploreProgress) {
      const p = step.exploreProgress;
      const barLen = 20;
      const filled = Math.round((p.discovered / p.total) * barLen);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Explore Progress: ${step.targetRegion}</div><div class="cd-reason-grid">` +
        `<span>[${bar}] ${p.discovered} / ${p.total} (${p.remaining} remaining)</span>` +
        (step.discoveries && step.discoveries.length > 0
          ? `<span>Discovered this loop: ${step.discoveries.map(d => `${d.name} (${d.type})`).join(', ')}</span>`
          : '') +
        `</div></div>`);
    }

    // Cost Assignments
    if (step.costAssignments && step.costAssignments.length > 0) {
      const NW = 28;
      const rows = [];

      if (step.mode === 'verify') {
        rows.push(`${pad('Target', NW)} ${rpad('Type', 8)} ${rpad('Loaded', 8)} ${rpad('Simulated', 10)} ${rpad('Delta', 8)}`);
        rows.push('\u2500'.repeat(NW + 38));

        for (const ca of step.costAssignments) {
          const name = truncate(ca.name, NW - 2);
          const typeLabel = ca.type === 'region' ? 'region' : 'location';
          const v = ca.verification;
          if (v) {
            const cls = v.delta === 0 ? 'cd-verify-exact' : Math.abs(v.delta) <= 5 ? 'cd-verify-close' : 'cd-verify-far';
            const sign = v.delta > 0 ? '+' : '';
            rows.push(`<span class="${cls}">\u2713 ${pad(name, NW)} ${rpad(typeLabel, 8)} ${rpad(v.loadedCost, 8)} ${rpad(v.simulatedCost, 10)} ${rpad(sign + v.delta, 8)}</span>`);
          } else {
            rows.push(`<span class="cd-reason-new">\u2713 ${pad(name, NW)} ${rpad(typeLabel, 8)} ${rpad(ca.cost, 8)}</span>`);
          }
        }

        sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Cost Verification (${step.costAssignments.length})</div>${pre(rows.join('\n'))}</div>`);
      } else {
        /**
         * ⛔ **THE PLAN PRICES EVERY REGION; THE BLOCK DOES NOT.** ⚖ (i) — the
         * simulation walks every region as coarse to derive the numbers at
         * all, and `writeCostsByClass` then drops the ones no block should
         * carry. Printing a bare `50` beside a jta region states a price
         * nothing charges, so each row carries what its region's class makes
         * of that number, and the ones the block will not carry say so in the
         * BLOCK column instead of repeating the figure.
         */
        const ctx = this._pricingContext();
        rows.push(`${pad('Target', NW)} ${rpad('Type', 8)} ${rpad('Planned', 8)}  ${pad('In the block', 14)}Formula`);
        rows.push('\u2500'.repeat(NW + 64));

        const notes = new Map();
        for (const ca of step.costAssignments) {
          const cls = 'cd-reason-new';
          const name = truncate(ca.name, NW - 2);
          const typeLabel = ca.type === 'region' ? 'region' : 'location';
          const pricing = this._pricingOfAssignment(ca, ctx);
          const blockCol = pricing && !pricing.priced ? pricing.label : 'the cost';
          if (pricing?.why) notes.set(pricing.label, pricing.why);
          const rowCls = pricing && !pricing.priced ? 'cd-reason-unpriced' : cls;
          rows.push(`<span class="${rowCls}">\u2713 ${pad(name, NW)} ${rpad(typeLabel, 8)} ${rpad(ca.cost, 8)}  ${pad(blockCol, 14)}${ca.formula}</span>`);
        }
        for (const [label, why] of notes) {
          rows.push(`<span class="cd-reason-warning">   ${label}: ${escapeHtml(why)}</span>`);
        }

        sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Cost Assignments (${step.costAssignments.length})</div>${pre(rows.join('\n'))}</div>`);
      }
    }

    // Simulated Queue
    if (step.queue.length > 0) {
      const NW = 28;
      const rows = [];
      /**
       * ⛓⛓ **THIS IS THE SIMULATION'S QUEUE, NOT THE RUNTIME'S BILL.** Every
       * action here is priced as if its region were coarse — that is how the
       * walk derives the numbers. At run time the region's CAPTURE SHAPE
       * decides who charges: a `fine` region (maze, jta, omsi) is charged by
       * its own substrate and the loop queue takes nothing, and a `summary`
       * region is charged by TIME plus whatever the block names explicitly.
       * The `Charged by` column is that answer, so a reader cannot mistake a
       * derivation step for a bill.
       */
      const ctx = this._pricingContext();
      rows.push(`${pad('Action', 12)} ${pad('Target', NW)} ${rpad('Base', 6)} ${rpad('Lvl', 4)} ${rpad('Cost', 8)}          ${pad('Charged by', 12)}`);
      rows.push('\u2500'.repeat(NW + 60));

      let runningMana = step.stateBefore.currentMana;
      for (const q of step.queue) {
        let actionLabel, targetStr;
        if (q.type === 'explore') {
          actionLabel = 'Explore';
          const discType = q.discovered ? ` (${q.discovered.type})` : '';
          targetStr = q.discovered ? q.discovered.name + discType : q.region;
        } else if (q.type === 'move') {
          actionLabel = 'Move';
          targetStr = `${q.from} \u2192 ${q.to}`;
        } else {
          actionLabel = 'Check';
          targetStr = q.location || '?';
        }

        const truncTarget = truncate(targetStr, NW);
        runningMana -= q.cost;
        const manaClass = runningMana < 0 ? 'cd-reason-mana-deficit'
          : runningMana < step.stateBefore.maxMana * 0.2 ? 'cd-reason-mana-low'
          : '';

        const costStr = q.cost.toFixed(1);
        const remaining = `\u2192 ${runningMana.toFixed(1)}`;
        const sourceRegion = q.region || q.from || null;
        const pricing = sourceRegion ? this._pricingOf(sourceRegion, ctx) : null;
        const chargedBy = !pricing ? ''
          : pricing.chargedByQueue ? 'the queue'
          : pricing.shape === 'summary' ? 'time (drain)'
          : 'the substrate';
        rows.push(`${pad(actionLabel, 12)} ${pad(truncTarget, NW)} ${rpad(q.baseCost.toFixed(0), 6)} ${rpad('L' + q.level, 4)} <span class="${manaClass}">${rpad(costStr, 8)} ${pad(remaining, 10)}</span><span class="${pricing && !pricing.chargedByQueue ? 'cd-reason-unpriced' : ''}">${pad(chargedBy, 12)}</span>`);
      }

      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Action Queue (${step.queue.length} actions)</div>${pre(rows.join('\n'))}</div>`);
    }

    // Results
    const r = step.simulatedResults;
    const manaClass = r.manaRemaining < 0 ? 'cd-reason-mana-deficit'
      : r.manaRemaining < step.stateBefore.maxMana * 0.2 ? 'cd-reason-mana-low'
      : 'cd-reason-mana-ok';

    const xpEntries = Object.entries(r.xpGained);
    const xpStr = xpEntries.length > 0
      ? xpEntries.map(([region, xp]) => `${region}: +${xp.toFixed(1)}`).join(', ')
      : 'none';

    sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Results</div><div class="cd-reason-grid">` +
      `<span>Mana consumed: ${r.manaConsumed.toFixed(1)}</span>` +
      `<span>Mana remaining: <span class="${manaClass}">${r.manaRemaining.toFixed(1)}</span> (then reset to ${step.stateAfter.maxMana.toFixed(1)})</span>` +
      `<span>XP gained: ${xpStr}</span>` +
      `</div></div>`);

    // Notes
    if (step.notes.length > 0) {
      const noteRows = step.notes.map(n => {
        const cls = n.includes('deficit') || n.includes('No path') || n.includes('No explores')
          ? 'cd-reason-error'
          : n.includes('fully explored') || n.includes('Ready')
            ? 'cd-reason-success'
            : 'cd-reason-warning';
        return `<span class="${cls}">${escapeHtml(n)}</span>`;
      }).join('');
      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Notes</div><div class="cd-reason-grid">${noteRows}</div></div>`);
    }

    // Verification Results (if available)
    const vResult = this.verificationResults.find(r => r.stepIndex === step.stepIndex);
    if (vResult) {
      const NW = 20;
      const vRows = [];
      vRows.push(`${pad('Metric', NW)} ${rpad('Predicted', 10)} ${rpad('Actual', 10)} ${rpad('Delta', 8)}`);
      vRows.push('\u2500'.repeat(NW + 32));

      /**
       * ⛔ The comparable prediction is `queueCharged`, not the whole
       * simulated spend: the simulation prices every region as coarse, and a
       * region a substrate charges natively contributes to `manaConsumed`
       * without ever reaching the queue. Both are shown — the split IS the
       * finding — but only the queue's half is scored.
       */
      const predictedQueue = vResult.predicted.queueCharged ?? vResult.predicted.manaConsumed;
      const manaD = vResult.actual.manaConsumed - predictedQueue;
      const manaCls = Math.abs(manaD) <= 1 ? 'cd-verify-exact' : Math.abs(manaD) <= 5 ? 'cd-verify-close' : 'cd-verify-far';
      vRows.push(`<span class="${manaCls}">${pad('Mana Consumed', NW)} ${rpad(predictedQueue.toFixed(1), 10)} ${rpad(vResult.actual.manaConsumed.toFixed(1), 10)} ${rpad((manaD > 0 ? '+' : '') + manaD.toFixed(1), 8)}</span>`);
      if (vResult.uncharged > 0) {
        vRows.push(`<span class="cd-reason-unpriced">${pad('  \u2514 unpriced by design', NW)} `
          + `${rpad(vResult.uncharged.toFixed(1), 10)} ${rpad('\u2014', 10)} ${rpad('not scored', 8)}</span>`);
        for (const [label, why] of (vResult.unchargedReasons || [])) {
          vRows.push(`<span class="cd-reason-warning">     ${label}: ${escapeHtml(why)}</span>`);
        }
      }

      const remD = vResult.actual.manaRemaining - vResult.predicted.manaRemaining;
      const remCls = Math.abs(remD) <= 1 ? 'cd-verify-exact' : Math.abs(remD) <= 5 ? 'cd-verify-close' : 'cd-verify-far';
      vRows.push(`<span class="${remCls}">${pad('Mana Remaining', NW)} ${rpad(vResult.predicted.manaRemaining.toFixed(1), 10)} ${rpad(vResult.actual.manaRemaining.toFixed(1), 10)} ${rpad((remD > 0 ? '+' : '') + remD.toFixed(1), 8)}</span>`);

      const maxD = vResult.actual.maxManaAfter - vResult.predicted.maxMana;
      const maxCls = Math.abs(maxD) <= 1 ? 'cd-verify-exact' : Math.abs(maxD) <= 5 ? 'cd-verify-close' : 'cd-verify-far';
      vRows.push(`<span class="${maxCls}">${pad('Max Mana (after)', NW)} ${rpad(vResult.predicted.maxMana.toFixed(1), 10)} ${rpad(vResult.actual.maxManaAfter.toFixed(1), 10)} ${rpad((maxD > 0 ? '+' : '') + maxD.toFixed(1), 8)}</span>`);

      if (vResult.actual.manaDebt > 0) {
        vRows.push(`<span class="cd-verify-far">${pad('Mana Debt', NW)} ${rpad('-', 10)} ${rpad(vResult.actual.manaDebt.toFixed(1), 10)}</span>`);
      }

      // XP comparison
      const allRegions = new Set([
        ...Object.keys(step.simulatedResults.xpGained),
        ...Object.keys(vResult.actual.xpGained)
      ]);
      if (allRegions.size > 0) {
        vRows.push('');
        vRows.push(`${pad('XP Region', NW)} ${rpad('Predicted', 10)} ${rpad('Actual', 10)} ${rpad('Delta', 8)}`);
        for (const region of allRegions) {
          const predXP = step.simulatedResults.xpGained[region] || 0;
          const actXP = vResult.actual.xpGained[region] || 0;
          const d = actXP - predXP;
          const cls = Math.abs(d) <= 1 ? 'cd-verify-exact' : Math.abs(d) <= 5 ? 'cd-verify-close' : 'cd-verify-far';
          vRows.push(`<span class="${cls}">${pad(truncate(region, NW - 2), NW)} ${rpad(predXP.toFixed(1), 10)} ${rpad(actXP.toFixed(1), 10)} ${rpad((d > 0 ? '+' : '') + d.toFixed(1), 8)}</span>`);
        }
      }

      sections.push(`<div class="cd-reason-section"><div class="cd-reason-label">Verification: Actual vs Predicted</div>${pre(vRows.join('\n'))}</div>`);
    }

    return sections.join('');
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  _onDestroy() {
    this.subscriptions.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.subscriptions = [];
    log('info', 'CostDebuggerUI destroyed');
  }
}

// =========================================================================
// Helpers
// =========================================================================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtMana(n) {
  if (n === null || n === undefined) return '?';
  return Number(n).toFixed(1);
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen - 1) + '\u2026' : str;
}

function totalXP(data) {
  if (!data) return 0;
  return 10 * data.level * data.level + 90 * data.level + data.xp;
}

export default CostDebuggerUI;
