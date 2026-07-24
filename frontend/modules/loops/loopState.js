/**
 * Loop state manager for the incremental game
 * Manages game state for the loop mode, including:
 * - Experience levels for regions
 * - Action queue
 * - Mana resources
 * - Loop progress and reset logic
 */

// REMOVED: import { stateManagerSingleton } from '../stateManager/index.js';
// Correctly import the default export from the singleton file if needed
// import stateManagerSingleton from '../stateManager/stateManagerSingleton.js';
// REMOVED: import eventBus from '../../app/core/eventBus.js';
import {
  proposedLinearReduction,
  applyRegionXpCostEffect,
} from './xpFormulas.js';
import { ActionQueueManager } from './actionQueueManager.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { blockKeyOf, resolveQueueBlocks, assignRecordingTags } from './blockIdentity.js';
import {
  getSavedQueues, getSavedQueueByTag, saveQueue, hasPlayableRecording, hasSummaryRecording,
} from './savedQueueStore.js';
import { BlockAnnotationTracker, itemKey } from './blockAnnotations.js';
import { hashRulesData } from '../shared/rulesHash.js';
import { isLoopModePlanningSource } from './loopModeExemptions.js';
import { DEFAULT_TIME_DRAIN_PER_SECOND } from './costDataManager.js';

/**
 * Tick period of the SUMMARY substrates' live-play time drain (M5). One
 * second: the drain rate is stated per second, and the tick count during a
 * Record park IS the visit's recorded duration.
 */
const TIME_DRAIN_INTERVAL_MS = 1000;

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('loopState', message, ...data);
  } else {
    const consoleMethod =
      console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[loopState] ${message}`, ...data);
  }
}

/**
 * Whether an evaluateActionGate verdict's reason means the strict gate
 * is simply OUT OF SCOPE for the event (loop mode off, AP-native
 * region, substrate not yet mode-integrated) — callers fall back to
 * their legacy behavior (e.g. clickToQueue interception) instead of
 * treating it as either live play or a block.
 */
export function gateReasonOutOfScope(reason) {
  return reason === 'loopModeOff' || reason === 'noRegion'
    || reason === 'apNative' || reason === 'substrateNotGated';
}

export class LoopState {
  constructor() {
    // Injected dependencies (will be set via setDependencies)
    this.eventBus = null;
    this.stateManager = null;
    this.dispatcher = null;
    this.gameState = null; // NEW: gameState API
    this.costDataManager = null; // Cost data for per-region/per-location costs

    // Action queue manager (will be initialized after gameState is set)
    this.actionQueueManager = null;

    // Resources (mana, manaPerItem) and region XP live in gameState now —
    // accessed below via delegating getters/setters for backward compat.
    // See gameState/state.js for the canonical state.

    // Action processing - now based on gameState path
    this.currentActionIndex = 0; // Index in the gameState path
    this.currentAction = null; // Current action being processed
    this.isProcessing = false;
    this.isPaused = false; // Not paused — idle (no queue started yet)
    this._queueCompleted = false; // True after queue runs to the end (distinct from idle)
    this.autoRestartQueue = false; // Flag to auto-restart queue when complete
    this.autoResumeOnNewAction = false; // Flag to auto-resume when a new action is added after completion
    this.autoRemoveCompleted = false; // Flag to auto-remove completed actions from queue
    this.gameSpeed = 100; // Multiplier for processing speed

    // Test mode flags
    this.instantMode = false; // When true, actions complete in one frame
    // noManaDepletionReset and manaDebt now live in gameState (test-mode flags).

    // Phase 6: substrate-handled completion. When non-null, we're
    // currently parked waiting for a substrate panel to walk through
    // its tile-by-tile execution and publish
    // loops:substrateActionCompleted.
    this._delegatedAction = null;
    // Step button: when true, the queue stops (transitions to paused)
    // after the next action completes — including substrate-delegated
    // walks (whole logical action) and out-of-mana resets (reset is
    // the step). Set by step(); cleared on completion or reset.
    this._stepMode = false;
    // "Keep this panel focused" toggle. When true AND the loops panel
    // is the active tab in its Golden Layout stack, substrate index
    // modules (maze, textAdventure) skip their ui:activatePanel
    // publish on loadRegion so the loops tab stays in front. The
    // active-tab check (loops/index.js's isFocusLocked) makes the
    // gate timing-independent — no need to track when the queue is
    // running, stepping, or resetting. Pushed in by displaySettings
    // on load and on UI changes. Default off.
    this.keepFocused = false;
    // Phase 6g: signal flag set across _handleSubstrateActionCompleted →
    // _completeCurrentAction → _applyActionEffects. Read by the
    // regionMove case to suppress its user:regionMove dispatch when
    // the substrate already dispatched one from onExitCross.
    this._completedViaDelegation = false;

    // Manual mode state. When the queue's current action is of type
    // 'manual', _processFrame stops accruing progress, auto-activates
    // the substrate panel for the region, and waits for either a
    // gameState:manaChanged → 0 (triggers loop reset) or a
    // user:regionMove (advances past the manual entry if the target
    // region matches the next regionMove in the queue; otherwise
    // sets _queuePausedUntilReset).
    //
    // _manualActionEntered is a guard so the auto-activate +
    // _manualEntered publish only fire once per manual entry, not on
    // every frame.
    this._manualActionEntered = false;
    // Per-region manual mode (the Manual checkbox on a region block).
    // When the queue cursor reaches an action whose sourceRegion is
    // flagged here, the queue parks and the player drives the region
    // by hand; its queued actions display as the expected outcome.
    // Exiting through the expected exit resumes the queue past the
    // region's whole segment; any other exit sets
    // _queuePausedUntilReset. Survives loop resets (cleared by
    // resetForNewRules / hard reset, like repeatExploreStates).
    this.manualRegionStates = new Map(); // regionName -> true
    // Per-block mode map (the mode-radio system that replaces the Manual
    // checkbox). Keyed by blockKeyOf(region, instanceNumber) so each
    // region VISIT gets its own mode instead of a whole region sharing
    // one checkbox. Values are a small string enum, currently
    // 'manual' | 'playback' (extensible: 'record' | 'bot' land in later
    // phases). Absent key → fall back to the legacy region checkbox
    // (manualRegionStates, for migrated saves) then to defaultBlockMode.
    // Serialized like manualRegionStates; survives loop resets, cleared
    // by resetForNewRules.
    this.blockModeStates = new Map(); // 'region#instance' -> mode
    // Per-block Instant toggle (M3). Keyed the same way as blockModeStates.
    // A truthy entry means "run this block headlessly in one frame" — it
    // applies to Playback/Bot blocks on substrates that DECLARE
    // loopSupport.instant. Absent key → not instant. Serialized alongside
    // blockModeStates; cleared by resetForNewRules. Distinct from the
    // GLOBAL this.instantMode debug flag (which instant-completes ALL
    // blocks) — the two OR together in the generic timer.
    this.blockInstantStates = new Map(); // 'region#instance' -> boolean
    // Default mode applied to a block that has no stored mode. Mirrors
    // the schema-backed `defaultBlockMode` setting (loopUI pushes it in,
    // like keepFocused / instantMode). M4 flips this to 'record': a fresh
    // run live-plays each block once and (with auto-switch, default ON)
    // replays it thereafter. Capability-clamped in getBlockMode — a
    // substrate without Record falls back to Manual, then to Playback.
    this.defaultBlockMode = 'record';
    // Whether a successful Record-mode segment auto-switches its block to
    // Playback. Schema-backed setting (loopUI pushes it in, like
    // defaultBlockMode); default ON per the M2 ruling.
    this.autoSwitchToPlaybackAfterRecord = true;
    // The block currently being RECORDED ({region, instance}), or null.
    // Set when a Record-mode block parks; the manual wake handler
    // finalizes the capture on a SUCCESSFUL exit, and clears this
    // (discard) on wrong-exit / mana-out / reset.
    this._recordingBlock = null;
    // M3b loops-owned coarse capture: the queue-grade actions observed
    // during a parked Record block on a COARSE-ONLY substrate (one whose
    // registry entry supplies no takeLastRecording). The block's interior
    // is rewritten from this buffer on a successful exit; fine-grained
    // substrates (maze) keep their own full-visit recorder instead and
    // never touch this. Cleared on park, discard, and finalize.
    this._liveCaptureBuffer = [];
    // M4 slice 4: the economy annotations accumulating for the parked
    // Record block ({items, xp} deltas from block start), or null when no
    // block is recording. Built into the saved entry's `annotations` field
    // on a successful exit; discarded with the recording otherwise.
    // See blockAnnotations.js.
    this._annotationTracker = null;
    // M5: the 1 Hz live-play time drain for SUMMARY substrates (runner,
    // bounce), whose visits are priced by how long they take rather than by
    // what they do. The interval runs only while loop mode is active and
    // every tick self-gates on livePlayRegion(), so an unparked, paused or
    // hard-paused queue costs nothing. `_summaryDrainSeconds` counts the
    // ticks charged during the parked block — that count IS the recorded
    // duration (slice 3), which excludes pauses for free.
    this._drainIntervalId = null;
    this._summaryDrainSeconds = 0;
    // M5: the performed actions of a summary visit that carried an EXPLICIT
    // loop_costs price. Stored with the recording so Playback can re-price
    // them at the current XP level (the duration covers everything else,
    // which is free by default). Cleared with the capture.
    this._summaryCostedActions = [];
    // The last queue index at which the Playback bound-recording lookup
    // ran, so a non-recording playback block doesn't re-resolve tags every
    // frame while it advances through the generic auto path.
    this._boundReplayCheckedIndex = -1;
    // Region currently being played manually via the mode radios; null
    // when parked on a legacy 'manual' / 'customQueue' entry instead.
    // Discriminates the two modes inside the shared wake handlers.
    this._manualRegionName = null;
    // Bot-backed queue execution (substrates whose loopSupport
    // declares executeVia: 'solver', e.g. bounce). The queue
    // parks on the action while the playback bot walks to the target
    // on real physics; completion arrives via the resulting
    // locationCheck / regionChanged events. Holds the in-flight
    // action, like _delegatedAction does for maze delegation.
    this._botExecutedAction = null;
    // When true, _processFrame bails immediately without advancing
    // the queue. Cleared by _resetLoop. Set when manual mode detects
    // the player exited to an unexpected region.
    this._queuePausedUntilReset = false;
    // Cached raw rules data — populated by the
    // stateManager:rawJsonDataLoaded subscriber in _setupEventListeners.
    // Used by the customQueue action's saved-queue lookup (needs the
    // rules-hash to key savedQueueStore buckets).
    this._cachedRulesData = null;

    // REMOVED: Discovery tracking
    // this.discoveredRegions = new Set(['Menu']); // Start with Menu discovered
    // this.discoveredLocations = new Set();
    // this.discoveredExits = new Map(); // regionName -> Set of exit names
    this.repeatExploreStates = new Map(); // NEW: regionName -> boolean

    // REMOVED: Initialize exits for the starting region
    // this.discoveredExits.set('Menu', new Set());

    // Animation frame tracking
    this._animationFrameId = null;

    // Auto-save interval
    this._saveIntervalId = null;
  }

  // Mana / XP / manaDebt / noManaDepletionReset live on the GameState
  // instance. Use `this._gs()` internally to reach them; outside callers
  // go through `gameStateAPI.getState()`.

  _gs() {
    if (this._gameStateInstance) return this._gameStateInstance;
    if (this.gameState && typeof this.gameState.getState === 'function') {
      this._gameStateInstance = this.gameState.getState();
      return this._gameStateInstance;
    }
    return null;
  }

  /**
   * Sets the required dependencies for the LoopState instance.
   * Should be called before or during initialize.
   * @param {object} dependencies - Object containing dependencies.
   * @param {EventBus} dependencies.eventBus - The application's event bus instance.
   * @param {StateManager} dependencies.stateManager - The application's state manager instance.
   * @param {Object} dependencies.gameState - The gameState API functions.
   */
  setDependencies(dependencies) {
    if (!dependencies.eventBus || !dependencies.stateManager) {
      log(
        'error',
        '[LoopState] Missing required dependencies (eventBus, stateManager).'
      );
      return;
    }
    log('info', '[LoopState] Setting dependencies...');
    this.eventBus = dependencies.eventBus;
    this.stateManager = dependencies.stateManager;
    this.dispatcher = dependencies.dispatcher || null;
    this.gameState = dependencies.gameState; // Store gameState API

    // Initialize ActionQueueManager now that we have gameState
    if (this.gameState) {
      this.actionQueueManager = new ActionQueueManager(this.gameState);
      log('info', '[LoopState] ActionQueueManager initialized');
    }

    // Re-setup listeners that depend on the event bus
    this._setupEventListeners();
  }

  /**
   * Set the cost data manager for per-region/per-location cost lookups.
   * Called after costDataManager is created (it's initialized after loopState).
   */
  setCostDataManager(costDataManager) {
    this.costDataManager = costDataManager;
    log('info', '[LoopState] CostDataManager set');
  }

  /**
   * Sets up event listeners for game events.
   * (snapshotUpdated → recalculateMaxMana now lives in gameState/index.js,
   * since gameState owns the mana state.)
   */
  _setupEventListeners() {
    if (!this.eventBus) {
      log(
        'warn',
        '[LoopState] Attempted to set up event listeners before eventBus dependency was set.'
      );
      return;
    }
    // Phase 6: substrate-handled completion. Resume the queue when
    // the substrate panel finishes its tile-by-tile walk.
    this.eventBus.subscribe('loops:substrateActionCompleted', (data) => {
      this._handleSubstrateActionCompleted(data);
    });
    // Phase 6h followup: when the substrate-driven path triggers a
    // loop reset (out-of-mana, fired via gameState.triggerLoopReset),
    // the queue's per-action progress tracking is now stale — the
    // explore action that drained the player's mana might be at 73%
    // progress. Reset it so a subsequent Start runs the queue from
    // action 0 with clean progress, mirroring the loops-queue's own
    // _resetLoop. Path is preserved (the queue stays); only progress
    // and the action cursor reset.
    this.eventBus.subscribe('gameState:loopReset', () => {
      this._resetActionsProgress();
    });

    // Manual mode wake handlers. Active only while a manual entry is
    // the queue's current action (the handlers themselves bail out
    // otherwise). Mana-zero triggers a loop reset; region change
    // either advances past the manual entry (on matching destination)
    // or sets _queuePausedUntilReset (on mismatch). We subscribe to
    // gameState:regionChanged rather than dispatcher's user:regionMove
    // because the regionChanged event is the authoritative "player
    // is now in region X" signal — it fires after gameState's
    // handler completes, so currentRegion reflects the move.
    this.eventBus.subscribe('gameState:manaChanged', () => {
      this._handleManualWake_mana();
    });
    this.eventBus.subscribe('gameState:regionChanged', (data) => {
      this._handleManualWake_regionMove({
        targetRegion: data?.newRegion,
        oldRegion: data?.oldRegion,
        fromReset: data?.fromReset,
        // M5: the exit the player actually crossed. gameState merges it in
        // from the originating user:regionMove (gameState/index.js), so the
        // summary recording can store the departure without loops needing
        // its own dispatcher receiver.
        exitName: data?.exitName,
      });
      this._handleBotWake_regionChanged(data?.newRegion);
    });

    // Cache raw rules data for the customQueue action's saved-queue
    // lookup. stateManager doesn't expose a persistent getter, so
    // each consumer that needs the raw JSON caches its own copy.
    this.eventBus.subscribe('stateManager:rawJsonDataLoaded', (data) => {
      this._cachedRulesData = data?.rawJsonData ?? null;
    });

    // M4 slice 4: cross-substrate consumable arrivals are the one item
    // movement loops can observe LIVE (the notification bus; the owning
    // substrate keeps the inventory, the host keeps no store). Folded into
    // the parked Record block's annotations as a positive delta. Items
    // CONSUMED during the block come out of the finalized recording
    // instead — see blockAnnotations.js on why the minimum is conservative.
    this.eventBus.subscribe('crossSubstrate:itemGranted', (data) => {
      if (!this._annotationTracker) return;
      const count = (typeof data?.count === 'number' && data.count > 0) ? data.count : 1;
      this._annotationTracker.noteItemDelta(itemKey(data?.to, data?.itemType), count);
    });

    // M5: the summary substrates' live-play time drain runs for exactly as
    // long as loop mode does. gameState is the sole writer of the flag and
    // publishes only on an actual change, so this is the one edge to track.
    this.eventBus.subscribe('gameState:loopModeChanged', (data) => {
      if (data?.active) this.startTimeDrain();
      else this.stopTimeDrain();
    });
    // Loop mode may already be on when dependencies land (a preset with
    // loop_costs auto-enables it before loops finishes wiring).
    if (this._gs()?.isLoopModeActive) this.startTimeDrain();
  }

  /**
   * Start the 1 Hz live-play time drain (M5). Idempotent — a second call
   * while it runs is a no-op, which matters because _setupEventListeners
   * runs again on every setDependencies.
   */
  startTimeDrain() {
    if (this._drainIntervalId !== null) return;
    if (typeof setInterval !== 'function') return;
    this._drainIntervalId = setInterval(() => this._timeDrainTick(), TIME_DRAIN_INTERVAL_MS);
  }

  /** Stop the live-play time drain (M5). Idempotent. */
  stopTimeDrain() {
    if (this._drainIntervalId === null) return;
    clearInterval(this._drainIntervalId);
    this._drainIntervalId = null;
  }

  /**
   * One second of a SUMMARY substrate's region being PLAYED (M5, extended
   * by M6). Time is that category's economy, and Bot execution costs what
   * live play of the same content costs, so the drain runs in exactly two
   * states — parked live play, and a solver driving the region.
   *
   * The two are mutually exclusive by construction: livePlayRegion() is
   * null whenever _botExecutedAction is set, so a tick can never charge
   * twice. Everything else — idle, replaying, paused, hard-paused, the
   * wrong capture shape — costs nothing, with no separate suppression.
   */
  _timeDrainTick() {
    const liveRegion = this.livePlayRegion();
    if (liveRegion) {
      if (this._captureShapeForRegion(liveRegion) !== 'summary') return;
      // Duration is TIME PARKED, independent of what that time cost — a
      // zero-rate region still accrues seconds. Counted BEFORE the charge,
      // because charging can end the park: deductMana fires
      // gameState:manaChanged synchronously, whose wake runs the depletion
      // reset (refilling the pool and discarding any in-progress capture).
      // Nothing may be touched after the charge on this path.
      this._summaryDrainSeconds += 1;
      this._chargeLiveAction({ type: 'timeDrain', sourceRegion: liveRegion });
      return;
    }
    const botRegion = this._botDrainRegion();
    if (!botRegion) return;
    // No _summaryDrainSeconds increment: that counter is Record-CAPTURE
    // state (it becomes the saved visit's duration), and a Bot block
    // records nothing. It stays owned by the live-play branch above.
    this._chargeLiveAction({ type: 'timeDrain', sourceRegion: botRegion });
    // The one thing that may follow the charge here — and it must. A solver
    // park runs no frames, so the generic timer's _maybeResetForOOM never
    // gets a turn, and _handleManualWake_mana ignores a non-manual park:
    // without this the pool would run negative for as long as the bot keeps
    // walking. _maybeResetForOOM stops the walk, snaps the queue to index 0
    // and re-schedules a frame, so the Bot branch re-engages — the same
    // depletion-retry loop the queue has always had, reached from the only
    // spend that happens while no frame is running.
    this._maybeResetForOOM();
  }

  /**
   * The region a SOLVER is currently driving on the time-drained economy,
   * or null (M6). Only the walkTo path qualifies: delegation is the maze's,
   * which is fine-grained and charges natively per tile.
   */
  _botDrainRegion() {
    const region = this._botExecutedAction?.sourceRegion;
    if (!region) return null;
    if (!this.isProcessing || this.isPaused || this._queuePausedUntilReset) return null;
    if (this._captureShapeForRegion(region) !== 'summary') return null;
    return region;
  }

  /**
   * Initialize the loop state when data is loaded
   */
  initialize() {
    // Ensure dependencies are set
    if (!this.stateManager || !this.eventBus) {
      log('error', '[LoopState] Cannot initialize: Dependencies not set.');
      return;
    }
    // REMOVED: Calculate initial mana based on current inventory
    // Initial mana will be set when the first snapshot arrives via the event listener.
    // this.recalculateMaxMana();

    // REMOVED: Initialize discoverable regions and exits
    // this._initializeDiscoverableData();

    // Set up auto-save timer
    this._setupAutoSave();

    // Automatic loading disabled — use the Load Game button in the UI instead
    // this.loadFromStorage();
  }

  /**
   * Get XP data for a region. Delegates to gameState.
   */
  getRegionXP(regionName) {
    const gs = this._gs();
    if (gs) return gs.getRegionXP(regionName);
    // Fallback when gameState isn't yet wired (shouldn't happen at runtime)
    return { level: 0, xp: 0, xpForNextLevel: 100 };
  }

  /**
   * Add XP to a region. Delegates to gameState (which fires
   * `gameState:xpChanged` on each level-up).
   */
  addRegionXP(regionName, amount) {
    const gs = this._gs();
    if (gs) gs.addRegionXP(regionName, amount);
  }


  /**
   * Get the current action queue from gameState path
   * Delegates to ActionQueueManager
   * @returns {Array} Array of action objects
   */
  getActionQueue() {
    if (!this.actionQueueManager) {
      return [];
    }
    return this.actionQueueManager.getActionQueue();
  }

  /**
   * Queue an action by adding it to gameState path
   * @param {Object} action - Action to add
   * @param {string} targetRegion - Region to insert the action at (optional)
   * @param {number} targetInstance - Instance number to insert at (optional)
   */
  queueAction(action, targetRegion = null, targetInstance = null) {
    if (!this.gameState) {
      log('error', '[LoopState] Cannot queue action: gameState not available');
      return;
    }

    // Map action types to gameState path entries
    if (action.type === 'customAction') {
      if (targetRegion && targetInstance) {
        // Insert at specific location
        this.gameState.insertCustomActionAt(action.actionName, targetRegion, targetInstance, {});
      } else {
        // Add to current location
        this.gameState.addCustomAction(action.actionName, {});
      }
    } else if (action.type === 'locationCheck') {
      if (targetRegion && targetInstance) {
        // Insert at specific location
        this.gameState.insertLocationCheckAt(action.locationName, targetRegion, targetInstance, action.sourceRegion);
      } else {
        // Add to current location
        this.gameState.addLocationCheck(action.locationName, action.sourceRegion);
      }
    } else if (action.type === 'regionMove') {
      // Movement is handled by the user:regionMove event, not added here
      log('warn', '[LoopState] regionMove actions should be handled via user:regionMove event');
    }

    // Get updated queue
    const queue = this.getActionQueue();

    //log('info', 'Action queued:', action);
    this.eventBus.publish('loopState:queueUpdated', {
      queue: queue,
    });

    // Start processing if not already running.
    // Auto-resume from waiting state is handled by EventCoordinator
    // listening to gameState:pathUpdated.
    if (!this.isProcessing && !this.isPaused && !this._queueCompleted) {
      this.startProcessing();
    }
  }

  /**
   * Remove an action from the queue by index
   * @param {number} index - Index of action to remove in the current action queue
   */
  removeAction(index) {
    if (!this.actionQueueManager) {
      log('error', '[LoopState] Cannot remove action: actionQueueManager not available');
      return false;
    }

    const queue = this.getActionQueue();
    if (index < 0 || index >= queue.length) {
      log('warn', '[LoopState] Invalid action index for removal:', index);
      return false;
    }

    const actionToRemove = queue[index];

    // Check if this is a regionMove action (can't be removed)
    if (actionToRemove.type === 'regionMove') {
      log('warn', '[LoopState] Cannot remove regionMove actions - they are managed by navigation');
      return false;
    }

    // Delegate removal to ActionQueueManager (handles gameState and tracking cleanup)
    const success = this.actionQueueManager.removeAction(index);

    if (!success) {
      return false;
    }

    // LoopState-specific logic: Handle processing state
    if (index === this.currentActionIndex && this.isProcessing) {
      // If we removed the current action, stop processing
      this.stopProcessing();
    } else if (index < this.currentActionIndex) {
      // If removing an action before the current one, adjust the index
      this.currentActionIndex--;
    }

    // Get updated queue and notify
    const updatedQueue = this.getActionQueue();
    this.eventBus.publish('loopState:queueUpdated', {
      queue: updatedQueue,
    });

    // Restart processing if stopped and there are actions to process
    if (!this.isProcessing && updatedQueue.length > 0 && !this.isPaused) {
      // If we removed all actions up to current index, reset to beginning
      if (this.currentActionIndex >= updatedQueue.length) {
        this.currentActionIndex = 0;
      }
      this.startProcessing();
    }

    return true;
  }
  /**
   * Clear the queue. Stops processing, clears ALL path entries
   * (including regionMoves), clears progress/completion tracking,
   * teleports the player to the resolved loop start, and emits a
   * single queue update. Used before building a new queue from
   * scratch.
   *
   * Distinct from `restartFromStart()`, which preserves the queue,
   * refills mana, resets progress, and snaps to index 0 (no teleport,
   * no path clearing).
   *
   * Phase 6g: path clearing now happens via gameState.clearPath() —
   * unlike the prior gameState.reset() call, this preserves
   * mana/XP/bestPaths and does NOT teleport the player back to
   * startRegions[0] (Menu). The player is teleported separately to
   * the *resolved* loop start (procgenPlayer.getResolvedStartRegion(),
   * which skips the synthetic Menu wrapper for procgen rules) via a
   * fromReset:true regionMove dispatch — substrate panels' regionChanged
   * handlers bail out on fromReset so they don't deduct mana on the
   * teleport, and procgenPlayer reloads the substrate's payload so the
   * panel matches the queue's first delegated action's sourceRegion.
   *
   * The path itself still starts from Menu (findDiscoveredPath uses
   * staticData.startRegions[0] as its source). The synthetic
   * "Menu → resolvedStart" first hop is non-delegated (Menu has no
   * substrate), ticks progress to 100, and dispatches a fromLoop:true
   * user:regionMove on completion — by which point the player is
   * already at resolvedStart, so setCurrentRegion is a no-op.
   */
  clearQueue() {
    // Stop processing
    if (this.isProcessing) {
      this.stopProcessing();
    }
    this._queueCompleted = false;

    // Clear tracking in ActionQueueManager (progress, completion)
    if (this.actionQueueManager) {
      this.actionQueueManager.actionProgress.clear();
      this.actionQueueManager.actionCompleted.clear();
    }
    this.currentActionIndex = 0;

    // Clear the gameState path without disturbing player position or
    // loop-mode resources. The teleport below moves the player to the
    // resolved loop start.
    if (this.gameState?.clearPath) {
      this.gameState.clearPath();
    } else if (this.gameState) {
      // Older gameState shape (no clearPath): fall back to the prior
      // sequence so tests using a stub still work.
      this.gameState.removeAllActionsOfType?.('locationCheck');
      this.gameState.removeAllActionsOfType?.('customAction');
      this.gameState.trimPath?.();
    }

    // Teleport the player to the resolved loop start. For procgen,
    // resolvedStart is the first warehoused region after Menu (Menu
    // itself is a synthetic wrapper with no playable payload); for
    // non-procgen flows, fall back to gameState.startRegions[0].
    const loopStartRegion = this._resolveLoopStartRegion();
    if (
      loopStartRegion
      && this.dispatcher?.publish
      && this.gameState?.getCurrentRegion?.() !== loopStartRegion
    ) {
      this.dispatcher.publish('user:regionMove', {
        sourceRegion: this.gameState.getCurrentRegion?.() ?? null,
        targetRegion: loopStartRegion,
        fromReset: true,
        updatePath: false,
      }, { initialTarget: 'bottom' });
    }

    // Emit single queue update with the now-empty queue
    const queue = this.getActionQueue();
    this.eventBus.publish('loopState:queueUpdated', {
      queue: queue,
    });
  }

  /**
   * Resolve the loop start region — where the player teleports on
   * clearQueue / loop reset. Prefers procgenPlayer.getResolvedStartRegion
   * (skips synthetic Menu) when available; falls back to
   * gameState.startRegions[0] otherwise. The fallback reads through
   * _gs() (the raw GameState instance) because the public gameStateAPI
   * doesn't expose startRegions as a property.
   */
  _resolveLoopStartRegion() {
    try {
      const fn = centralRegistry?.getPublicFunction?.(
        'procgenPlayer', 'getResolvedStartRegion',
      );
      const resolved = fn?.();
      if (resolved) return resolved;
    } catch {
      // procgenPlayer not loaded; fall through.
    }
    const gs = this._gs?.();
    return gs?.startRegions?.[0] ?? null;
  }

  /**
   * Clear all explore actions from the queue
   */
  clearExploreActions() {
    if (!this.gameState) {
      log('error', '[LoopState] Cannot clear explore actions: gameState not available');
      return;
    }
    
    // Remove all explore custom actions
    const removedCount = this.gameState.removeAllActionsOfType('customAction', 'explore');
    
    if (removedCount > 0) {
      // Clean up tracking for removed actions
      // Note: We'd need to match pathIndex to clean up properly, but this is a bulk operation
      // For now, we'll let the getActionQueue method handle missing progress
      
      // Get updated queue
      const queue = this.getActionQueue();
      
      // Notify queue updated
      this.eventBus.publish('loopState:queueUpdated', {
        queue: queue,
      });

      log('info', `[LoopState] Cleared ${removedCount} explore actions`);
    }
  }

  /**
   * Start processing the action queue
   */
  /**
   * Start processing from the beginning of the queue. Resets
   * currentActionIndex to 0; use resumeProcessing() to continue from
   * where the queue left off.
   */
  startProcessing() {
    this._beginProcessing({ resetIndex: true, publishProcessingStarted: true });
  }

  /**
   * Resume processing from the current action index. Unlike
   * startProcessing(), preserves currentActionIndex — used by
   * auto-resume on new action and by step() from a paused state.
   */
  resumeProcessing() {
    this._beginProcessing({ resetIndex: false, publishProcessingStarted: false });
  }

  /**
   * Internal: shared body of startProcessing / resumeProcessing.
   * The two callers differ only in (a) whether they reset
   * currentActionIndex to 0, and (b) whether they publish the
   * processingStarted event (only the start path does).
   */
  _beginProcessing({ resetIndex, publishProcessingStarted }) {
    if (this.isPaused || this.isProcessing) return;

    const queue = this.getActionQueue();
    if (queue.length === 0) return;

    if (resetIndex) {
      this.currentActionIndex = 0;
    } else if (this.currentActionIndex >= queue.length) {
      // Resume path: nothing left to advance to.
      return;
    }

    this.isProcessing = true;
    this._queueCompleted = false;
    this.currentAction = queue[this.currentActionIndex];

    if (!this.currentAction) {
      log('error', 'No valid action at index', this.currentActionIndex);
      this.isProcessing = false;
      return;
    }

    if (!this.actionQueueManager.getProgress(this.currentAction.pathIndex)) {
      this.actionQueueManager.setProgress(this.currentAction.pathIndex, 0);
    }
    this.currentAction.progress = this.actionQueueManager.getProgress(this.currentAction.pathIndex);

    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._lastFrameTime = null;
    this._animationFrameId = requestAnimationFrame(this._processFrame.bind(this));

    if (publishProcessingStarted) {
      this.eventBus.publish('loopState:processingStarted', {
        action: this.currentAction,
      });
    }
    // Refresh Pause/Step button labels — any path that lands here
    // (click-Start, auto-start on gameState:pathUpdated, step(),
    // setPaused(false)) needs the UI in sync.
    this.eventBus.publish('loopState:pauseStateChanged', {
      isPaused: this.isPaused,
      processingState: this.getProcessingState(),
    });
  }

  /**
   * Stop processing the current action
   */
  stopProcessing() {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;

    // Drop any in-flight substrate delegation. The substrate's own
    // walk-completion / reset path is responsible for cleanup on its
    // side; we just stop waiting.
    this._delegatedAction = null;
    // Stop an in-flight bot walk (bot-backed queue execution). The
    // parked action stays at the cursor, so resuming re-dispatches
    // walkTo from wherever the player ended up.
    this._stopBotExecutedAction();

    // Don't reset the action progress during a pause,
    // so we can continue from where we left off

    // Cancel animation frame
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    this.eventBus.publish('loopState:processingStopped', {});
    // Mirror startProcessing's pauseStateChanged publish so the
    // loopUI's button label refreshes on stop. Without this, after a
    // substrate-driven reset (out-of-mana mid-walk → stopProcessing
    // → button stays at "Pause") the user has to interact with the
    // queue once before the label catches up.
    this.eventBus.publish('loopState:pauseStateChanged', {
      isPaused: this.isPaused,
      processingState: this.getProcessingState(),
    });
  }

  /**
   * Step: run exactly one queued action, then transition to paused.
   * - Whole logical action: substrate-delegated walks finish in full.
   * - An out-of-mana reset along the way counts as the step.
   * - End state is `paused` so the user can keep clicking Step (or
   *   Resume) to advance one action at a time.
   * - Works from idle, paused, or completed-with-new-actions. From
   *   the completed-with-new-actions case, picks up at currentActionIndex
   *   (the new action) rather than restarting from 0.
   * - No-op when already running or when the queue has no work past
   *   currentActionIndex (the UI also disables the button then).
   */
  step() {
    if (this.isProcessing) return;
    const queue = this.getActionQueue();
    if (queue.length === 0) return;

    // Completed state with new actions appended past currentActionIndex:
    // resume from currentActionIndex so the new action runs next, not
    // index 0 (which would re-walk the already-completed prefix).
    if (this._queueCompleted) {
      if (queue.length <= this.currentActionIndex) return;
      this._stepMode = true;
      this.resumeProcessing();
      if (!this.isProcessing) this._stepMode = false;
      return;
    }

    this._stepMode = true;
    if (this.isPaused) {
      // Use resumeProcessing (not setPaused(false), which calls
      // startProcessing and resets currentActionIndex to 0). Stepping
      // from paused must advance from where the queue left off.
      this.isPaused = false;
      this.resumeProcessing();
    } else {
      this.startProcessing();
    }
    // Defensive: if startup didn't actually start processing (e.g.,
    // queue was filtered out by upstream guards), drop the flag so it
    // can't fire on a later action.
    if (!this.isProcessing) this._stepMode = false;
  }

  /**
   * Drop step mode and transition to paused. Used by the post-action
   * and post-reset hooks so a single Step click lands the queue in
   * the same shape as a manual Pause.
   */
  _pauseAfterStep() {
    this._stepMode = false;
    this.isPaused = true;
    if (this.isProcessing) {
      this.stopProcessing();
    } else {
      // stopProcessing publishes pauseStateChanged; if processing
      // already stopped (substrate-driven reset path), publish here.
      this.eventBus.publish('loopState:pauseStateChanged', {
        isPaused: this.isPaused,
        processingState: this.getProcessingState(),
      });
    }
  }

  /**
   * Pause/unpause the action queue
   * @param {boolean} isPaused - Whether to pause or unpause
   */
  setPaused(isPaused) {
    this.isPaused = isPaused;

    if (isPaused) {
      this.stopProcessing();
    } else {
      const queue = this.getActionQueue();
      if (queue.length > 0) {
        // Check if we need to reset the loop before resuming
        // This handles the case where the queue finished and user unpauses
        const needsReset = this._shouldResetOnResume(queue);

        if (needsReset) {
          // Reset loop to refill mana and reset action progress
          this._resetLoop();
        }

        this.startProcessing();
      }
    }

    // Single authoritative event after all state has settled
    this.eventBus.publish('loopState:pauseStateChanged', {
      isPaused: this.isPaused,
      processingState: this.getProcessingState(),
    });
  }

  /**
   * Get the current processing state:
   *   'idle'      — queue not started or empty; button: "Start"
   *   'running'   — actively processing actions; button: "Pause"
   *   'paused'    — user paused mid-queue; button: "Resume"
   *   'completed' — queue ran to the end; button: "Restart"
   *   'waiting'   — queue completed, auto-resume enabled, waiting for new actions
   * @returns {'idle'|'running'|'paused'|'completed'|'waiting'}
   */
  getProcessingState() {
    if (this.isProcessing) return 'running';
    if (this.isPaused) return 'paused';
    if (this._queueCompleted) {
      return this.autoResumeOnNewAction ? 'waiting' : 'completed';
    }
    return 'idle';
  }

  /**
   * Check if we should reset the loop when resuming from pause
   * Returns true if all actions are completed or if we've reached the end of the queue
   * @param {Array} queue - The action queue
   * @returns {boolean} - Whether to reset
   */
  _shouldResetOnResume(queue) {
    if (!queue || queue.length === 0) {
      return false;
    }

    // If there are no actions, no need to reset
    if (queue.length === 0) {
      return false;
    }

    // Check if all actions are completed
    let allCompleted = true;
    for (let i = 0; i < queue.length; i++) {
      const action = queue[i];
      // Skip checkLocation actions for already-checked locations
      if (action.type === 'locationCheck') {
        const snapshot = this.stateManager.getLatestStateSnapshot();
        const isChecked = snapshot?.checkedLocations?.includes(action.locationName);
        if (isChecked) {
          continue; // This one doesn't count, it's already done
        }
      }
      // Check if action is completed
      if (!action.completed && action.progress < 100) {
        allCompleted = false;
        break;
      }
    }

    // Also reset if currentActionIndex is past the end of the queue
    // (this means we finished processing)
    if (this.currentActionIndex >= queue.length) {
      return true;
    }

    return allCompleted;
  }

  /**
   * Set game speed multiplier
   * @param {number} speed - Speed multiplier (1.0 = normal speed)
   */
  setGameSpeed(speed) {
    // Allow Infinity for instant mode, otherwise cap at 1000
    if (speed === Infinity) {
      this.gameSpeed = Infinity;
    } else {
      this.gameSpeed = Math.max(0.1, Math.min(1000, speed));
    }

    // Reset the _lastFrameTime to ensure smooth speed transitions
    if (this.isProcessing) {
      this._lastFrameTime = null;
    }

    this.eventBus.publish('loopState:speedChanged', { speed: this.gameSpeed });
  }

  /**
   * Set instant mode - actions complete in one frame
   * @param {boolean} enabled - Whether to enable instant mode
   */
  setInstantMode(enabled) {
    this.instantMode = enabled;
    log('info', `[LoopState] Instant mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set no-mana-depletion-reset mode - don't reset loop when mana reaches 0
   * @param {boolean} enabled - Whether to enable no-reset mode
   */
  setNoManaDepletionReset(enabled) {
    const gs = this._gs();
    if (gs) gs.noManaDepletionReset = enabled;
    log('info', `[LoopState] No-mana-depletion-reset mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get the current mana debt (how negative mana went)
   * @returns {number} The mana debt
   */
  getManaDebt() {
    const gs = this._gs();
    return gs ? gs.manaDebt : 0;
  }

  /**
   * Reset mana debt tracking
   */
  resetManaDebt() {
    const gs = this._gs();
    if (gs) gs.manaDebt = 0;
  }

  /**
   * Process a single animation frame.
   *
   * Per-frame contract: advance the current action by one tick. Each frame
   * either ticks progress, completes an action, triggers an OOM reset, or
   * some combination — but the order is fixed and the helpers make it
   * explicit.
   *
   * Notable: the OOM reset runs even if completion paused us this frame
   * (step-mode landing). The only way to skip OOM is when the queue ran
   * to the end (_queueCompleted = true), at which point there's no
   * current action to reset. Stepping with low mana therefore lands the
   * user in "paused at index 0 with mana refilled" — the reset is the
   * step's terminal event, never a stranded mana=0 state.
   *
   * @param {number} timestamp - Current timestamp
   */
  _processFrame(timestamp) {
    if (!this.isProcessing || this.isPaused) {
      this._animationFrameId = null;
      return;
    }
    // Manual mode hard-pause: once the player exited to a region the
    // queue didn't expect, processing is locked off until _resetLoop
    // clears the flag. The queue is still authored / inspectable;
    // it just won't auto-advance.
    if (this._queuePausedUntilReset) {
      this._animationFrameId = null;
      this.isProcessing = false;
      return;
    }
    if (this._tickParkedSolver()) return;
    if (!this._primeFrameClock(timestamp)) return;

    const deltaTime = (timestamp - this._lastFrameTime) * this.gameSpeed;
    this._lastFrameTime = timestamp;

    try {
      if (!this._ensureCurrentAction()) return;
      // Per-block mode dispatch (M1 Manual + M2 Record / Playback-replay).
      // Resolve the current action's block and mode once. Checked before
      // the legacy entry types so a mode-flagged block wins even if old
      // 'manual' entries are queued there too.
      const modeBlock = this._blockForCurrentAction();
      const blockMode = modeBlock
        ? this.getBlockMode(modeBlock.region, modeBlock.instance)
        : null;
      // Manual OR Record: park and let the player drive the whole region
      // segment. Record additionally flags the block so the wake handler
      // pulls + persists the substrate's capture on a successful exit.
      if (modeBlock && (blockMode === 'manual' || blockMode === 'record')) {
        if (blockMode === 'record') {
          this._recordingBlock = { region: modeBlock.region, instance: modeBlock.instance };
          // Coarse-only capture starts fresh at every park (M3b).
          this._liveCaptureBuffer = [];
          // Annotations are deltas FROM BLOCK START, so the tracker starts
          // empty at every park (M4 slice 4).
          this._annotationTracker = new BlockAnnotationTracker();
        }
        this._handleManualRegionEntry(modeBlock.region);
        return;
      }
      // Playback with a bound recording: replay the recorded script.
      // Without a bound recording, fall through to today's auto path
      // (delegation / bot / timer). Guard the tag lookup per queue index so
      // a non-recording playback block doesn't re-resolve every frame.
      // Coarse-only substrates (no takeLastRecording — M3b) skip the
      // lookup entirely: the block's own interior IS the recording and
      // the generic executor below runs it. Reaching
      // _handlePlaybackReplayEntry without a substrate replayActions
      // would park the block forever.
      if (modeBlock && blockMode === 'playback'
          && this._boundReplayCheckedIndex !== this.currentActionIndex) {
        this._boundReplayCheckedIndex = this.currentActionIndex;
        const shape = this._captureShapeForRegion(modeBlock.region);
        if (shape === 'fine') {
          const bound = this._lookupBoundRecording(modeBlock.region, modeBlock.instance);
          if (bound) {
            this._handlePlaybackReplayEntry(modeBlock.region, bound);
            return;
          }
          // M4 ruling: a FINE-GRAINED substrate in Playback with NO bound
          // recording has no playable content — the auto walkTo/delegation
          // chain is unreachable from Playback until M6's Bot radio. Park for
          // live play (Manual behavior) instead of falling through to that
          // chain. (This is the safety net for a cleared/missing recording;
          // the Playback radio is disabled without playable content, so it
          // rarely triggers.)
          this._handleManualRegionEntry(modeBlock.region);
          return;
        }
        if (shape === 'summary') {
          // M5: a SUMMARY substrate (runner, bounce) in Playback applies its
          // recorded net result instantly — no replay, the game does not
          // participate.
          const summary = this._lookupBoundSummary(modeBlock.region, modeBlock.instance);
          if (summary) {
            this._handleSummaryApplyEntry(modeBlock.region, summary);
            return;
          }
          // With no bound summary it joins the fine-grained ruling above:
          // park for live play rather than fall through to the walkTo/bot
          // chain, which stays M6's to re-home.
          this._handleManualRegionEntry(modeBlock.region);
          return;
        }
        // Coarse-only substrates are unaffected: their block interior IS the
        // recording, run by the generic executor below.
      }
      // Bot (M6): explicit solver-driven execution. This branch is the ONE
      // trigger for BOTH solver mechanisms — the maze's substrate delegation
      // and the walkTo path (jta / runner / bounce). Dispatch is per ACTION:
      // each solver parks on one action, and its completion resumes the frame
      // loop, which re-enters here for the block's next action.
      //
      // A Bot block whose solver can't engage parks for LIVE PLAY with a loud
      // warning rather than falling through to the generic timer — a silent
      // timer teleport through content the bot was meant to play is the
      // failure mode this arc exists to prevent (loop-recording.md gotchas).
      if (modeBlock && blockMode === 'bot') {
        const solver = this.regionSolver(modeBlock.region);
        if (solver === 'delegation' && this._shouldDelegateCurrentAction()) {
          this._beginDelegatedAction();
          return;
        }
        if (solver === 'walkTo' && this._shouldBotExecuteCurrentAction()) {
          this._handleBotExecutedAction();
          return;
        }
        if (!this._manualActionEntered) {
          log('warn', `[LoopState] Bot block in '${modeBlock.region}' has no engageable `
            + `solver (solver=${solver ?? 'none'}, action=${this.currentAction?.type}) — `
            + 'parking for live play instead of running it on the generic timer.');
        }
        this._handleManualRegionEntry(modeBlock.region);
        return;
      }
      // Manual entry: stop accruing progress, hand control to the
      // player via the substrate panel. The wake handlers (subscribed
      // in _setupEventListeners) advance past this entry on the next
      // matching user:regionMove, or trigger a reset on mana-zero.
      if (this.currentAction.type === 'manual') {
        this._handleManualEntry(this.currentAction);
        return;
      }
      // Custom Queue: look up the saved queue and dispatch through
      // the substrate's replayActions. Same wake / advance / paused-
      // until-reset semantics as manual mode — _manualActionEntered
      // doubles as the "parked, waiting for an exit" guard.
      if (this.currentAction.type === 'customQueue') {
        this._handleCustomQueueEntry(this.currentAction);
        return;
      }
      // (M6: the unconditional bot dispatch that used to sit here — the
      // last leg of the auto execution chain — is gone. Solver execution
      // is reachable only through the Bot branch above. What remains here
      // is the generic timer, which runs coarse Playback interiors and
      // AP-native blocks.)
      this._advanceActionProgress(deltaTime);
      this._maybeCompleteCurrentAction();
      // Queue ran to the end — no current action to reset, terminal events
      // already published by _completeCurrentAction. Skip OOM and bail.
      if (this._queueCompleted) return;
      if (this._maybeResetForOOM()) return;
      this._publishProgressUpdate();
    } catch (error) {
      log('error', 'Error in _processFrame:', error);
      this.stopProcessing();
      return;
    }

    this._animationFrameId = requestAnimationFrame(
      this._processFrame.bind(this)
    );
  }

  /**
   * Stay parked while a SOLVER action is in flight (M6). Runs BEFORE the
   * mode dispatch purely as a guard: no progress tick, no animation frame
   * while the maze panel walks a delegated action tile-by-tile or a bot
   * walks to its target. _handleSubstrateActionCompleted /
   * _completeBotExecutedAction resume the loop.
   *
   * INITIATION does not happen here. Until M6 this tick also FIRED
   * delegation for any non-Manual block, which ran before the mode
   * dispatch and so silently shadowed Record and Playback on
   * delegation-capable regions. Both solvers are now started only from
   * the Bot branch of the mode dispatch (_processFrame).
   *
   * @returns {boolean} true if we are parked (caller should bail).
   */
  _tickParkedSolver() {
    if (this._delegatedAction || this._botExecutedAction) {
      this._animationFrameId = null;
      return true;
    }
    return false;
  }

  /**
   * Phase 6 substrate delegation, initiated by a Bot block (M6). Hand the
   * current action off to the substrate panel, which walks it tile-by-tile,
   * deducts mana per tile, and publishes loops:substrateActionCompleted
   * when done. The queue parks until that event arrives.
   */
  _beginDelegatedAction() {
    this._delegatedAction = this.currentAction;
    this._lastFrameTime = null;
    this.eventBus?.publish('loops:substrateActionBegan', {
      action: this.currentAction,
    });
    this._animationFrameId = null;
  }

  /**
   * On the first frame, _lastFrameTime is null. Prime it and re-schedule
   * without doing work — we need a delta to compute progress.
   *
   * @returns {boolean} true if the clock was already primed (caller proceeds);
   *   false if we just primed it and re-scheduled (caller bails).
   */
  _primeFrameClock(timestamp) {
    if (!this._lastFrameTime) {
      this._lastFrameTime = timestamp;
      this._animationFrameId = requestAnimationFrame(
        this._processFrame.bind(this)
      );
      return false;
    }
    return true;
  }

  /**
   * Validate currentAction/index against the queue. Recovers by snapping
   * to index 0 when possible; stops processing on an empty queue.
   *
   * @returns {boolean} true if we have a valid action to process; false if
   *   processing was stopped (caller should bail).
   */
  _ensureCurrentAction() {
    const queue = this.getActionQueue();
    if (this.currentAction && this.currentActionIndex < queue.length) {
      return true;
    }
    log('error', 'Invalid action state in _processFrame:', {
      currentActionIndex: this.currentActionIndex,
      queueLength: queue.length,
      hasCurrentAction: !!this.currentAction,
    });
    if (queue.length > 0) {
      this.currentActionIndex = 0;
      this.currentAction = queue[this.currentActionIndex];
      return true;
    }
    this.stopProcessing();
    return false;
  }

  // -------------------- Manual mode --------------------

  /**
   * Called from _processFrame whenever the current action is type
   * 'manual'. On the first hit per entry:
   *   - Activate the substrate panel for the manual entry's region
   *     (via procgenPlayer.getRegionInfo → registry componentType).
   *   - Stop queue processing so no further frames tick.
   *   - Publish loopState:manualEntered with the next expected
   *     region (the queue's next regionMove entry's destination,
   *     used by the wake handler to detect mismatched exits).
   * Subsequent hits are no-ops until _resetLoop or a successful wake.
   */
  _handleManualEntry(action) {
    if (this._manualActionEntered) return;
    this._manualActionEntered = true;

    const componentType = this._lookupSubstrateComponentType(action.sourceRegion);
    if (componentType && this.eventBus?.publish) {
      this.eventBus.publish('ui:activatePanel', { panelId: componentType });
    }

    this.stopProcessing();

    if (this.eventBus?.publish) {
      this.eventBus.publish('loopState:manualEntered', {
        regionName: action.sourceRegion,
        expectedNextRegion: this._getExpectedNextRegion(),
      });
    }
  }

  /**
   * Find the next regionMove entry at or after startIndex and return
   * its destinationRegion. That's the region the player is expected
   * to exit into when leaving a Manual entry (default: scan from the
   * entry AFTER the current action) or a manual-checked region's
   * segment (scan from the current action INCLUSIVE — the cursor may
   * be parked on the leaving regionMove itself).
   * Returns null if no further regionMove is queued.
   */
  _getExpectedNextRegion(startIndex = this.currentActionIndex + 1) {
    const queue = this.getActionQueue();
    for (let i = startIndex; i < queue.length; i++) {
      if (queue[i]?.type === 'regionMove') {
        return queue[i].destinationRegion ?? null;
      }
    }
    return null;
  }

  /**
   * Per-block manual mode: resolve the region of the current action's
   * block iff that block's mode is 'manual', else null. Uses the shared
   * queue-block resolver so the block matches exactly what the panel
   * renders — critical for the leaving regionMove, whose own
   * instanceNumber names the DESTINATION block while it's driven from
   * (and rendered inside) its SOURCE block.
   */
  _manualRegionForCurrentAction() {
    return this._currentBlockIsManual() ? this.currentAction?.sourceRegion ?? null : null;
  }

  /**
   * Resolve the (region, instance, key) block that owns the current
   * action, or null when there's no current action. Walks the queue via
   * the shared resolver (loopRenderer draws the mode radios off the same
   * grouping), so a naive (sourceRegion, instanceNumber) lookup — wrong
   * for a leaving regionMove — is avoided.
   */
  _blockForCurrentAction() {
    if (!this.currentAction) return null;
    const queue = this.getActionQueue();
    const { indexToBlock } = resolveQueueBlocks(queue);
    return indexToBlock.get(this.currentActionIndex) ?? null;
  }

  /** The mode of the current action's block, or null when there is none. */
  _currentBlockMode() {
    const block = this._blockForCurrentAction();
    if (!block) return null;
    return this.getBlockMode(block.region, block.instance);
  }

  /** Whether the current action's block resolves to manual mode. */
  _currentBlockIsManual() {
    return this._currentBlockMode() === 'manual';
  }

  /** The live procgenPlayer warehouse (region → { world }), or null. */
  _getWarehouse() {
    try {
      return centralRegistry?.getPublicFunction?.('procgenPlayer', 'getWarehouse')?.() ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Persistent recording tag `(arrivalKey, ordinal)` for a block. Resolves
   * the queue blocks, stamps recording tags against the live warehouse (so
   * arrivalKey matches what the substrate recorders captured), and returns
   * the matching block's tag. loops owns this derivation on BOTH the save
   * and the auto-restore side, so the two always agree regardless of any
   * recorder-side id drift. Returns null if the block isn't found.
   */
  _recordingTagForBlock(region, instance) {
    if (!region) return null;
    const { visits } = resolveQueueBlocks(this.getActionQueue());
    assignRecordingTags(visits, this._getWarehouse());
    const v = visits.find((x) => x.name === region && x.instance === instance);
    return v ? { arrivalKey: v.arrivalKey, ordinal: v.ordinal } : null;
  }

  /** Content-hash of the cached rules, or null when rules aren't cached. */
  _rulesHash() {
    return this._cachedRulesData ? hashRulesData(this._cachedRulesData) : null;
  }

  /**
   * The stored recording bound to a Playback block by its tag, or null.
   * "Auto-restore" is an on-demand tag lookup at block entry — equivalent
   * to binding at creation but always consistent with the current queue.
   */
  _lookupBoundRecording(region, instance) {
    const rulesHash = this._rulesHash();
    if (!rulesHash) return null;
    const substrate = this._lookupSubstrateId(region);
    if (!substrate) return null;
    const tag = this._recordingTagForBlock(region, instance);
    if (!tag) return null;
    const entry = getSavedQueueByTag(rulesHash, region, substrate, tag.arrivalKey, tag.ordinal);
    // An ACTIONS-LESS entry is a coarse substrate's annotations envelope
    // (M4 slice 4), not a playable recording — replaying it would park the
    // block on an empty script. Only playable entries bind.
    return hasPlayableRecording(entry) ? entry : null;
  }

  /**
   * The stored SUMMARY bound to a summary-substrate block by its tag, or
   * null (M5). Parallel to _lookupBoundRecording: same tag lookup, but
   * guarded on `hasSummaryRecording` instead of `hasPlayableRecording` —
   * a summary entry is actions-less by design and must never bind to a
   * fine-grained replay, nor a fine recording to an instant apply.
   */
  _lookupBoundSummary(region, instance) {
    const rulesHash = this._rulesHash();
    if (!rulesHash) return null;
    const substrate = this._lookupSubstrateId(region);
    if (!substrate) return null;
    const tag = this._recordingTagForBlock(region, instance);
    if (!tag) return null;
    const entry = getSavedQueueByTag(rulesHash, region, substrate, tag.arrivalKey, tag.ordinal);
    return hasSummaryRecording(entry) ? entry : null;
  }

  /** Whether a SUMMARY recording is bound to this block (M5). */
  hasBoundSummary(region, instance) {
    return !!this._lookupBoundSummary(region, instance);
  }

  /**
   * The stored annotations for a block, or null. Separate from
   * _lookupBoundRecording because annotations exist for COARSE blocks too,
   * where there is no playable recording to bind. Used by the panel.
   */
  getBlockAnnotations(region, instance) {
    const rulesHash = this._rulesHash();
    if (!rulesHash) return null;
    const substrate = this._lookupSubstrateId(region);
    if (!substrate) return null;
    const tag = this._recordingTagForBlock(region, instance);
    if (!tag) return null;
    const entry = getSavedQueueByTag(rulesHash, region, substrate, tag.arrivalKey, tag.ordinal);
    return entry?.annotations ?? null;
  }

  /**
   * Persist the substrate's stashed recording for a just-completed Record
   * block under its `(region, arrivalKey, ordinal)` tag, then apply the
   * auto-switch-to-Playback setting. Called only on a SUCCESSFUL exit (the
   * wake handler matched the expected departing regionMove). arrivalExitId
   * is stamped from the loops-owned arrivalKey so a later auto-restore
   * lookup keys on the identical value.
   *
   * M4 slice 4: the entry also carries the block's `annotations` — the
   * recording's item deltas + minima and its XP, as deltas from block start.
   * The recording's own `useItem` entries are the consumption half, folded
   * in here (blockAnnotations.js).
   */
  _persistRecordingForBlock(region, instance) {
    const substrate = this._lookupSubstrateId(region);
    if (!substrate) return null;
    const rec = substrateRegistry?.get?.(substrate)?.takeLastRecording?.();
    if (!rec) return null;
    const tag = this._recordingTagForBlock(region, instance);
    if (!tag) return null;
    const rulesHash = this._rulesHash();
    if (!rulesHash) return null;
    this._annotationTracker?.foldRecordedItemUses(rec.actions, substrate);
    const annotations = this._annotationTracker?.build() ?? null;
    saveQueue(rulesHash, {
      ...rec,
      regionName: region,
      substrate,
      arrivalExitId: tag.arrivalKey,
      ordinal: tag.ordinal,
      annotations,
    });
    this._autoSwitchAfterRecord(region, instance);
    return rec;
  }

  /**
   * Persist a COARSE-ONLY block's annotations (M4 slice 4). savedQueueStore
   * is the universal recording+metadata envelope, so a coarse substrate gets
   * an entry under the same `(region, arrivalKey, ordinal)` tag holding only
   * annotations — `actions: []`. That entry must NEVER read as a playable
   * recording: the coarse Playback contract is that the block's own INTERIOR
   * is the recording and the store is never consulted for actions (M3b
   * invariant), which `hasPlayableRecording` enforces on every read.
   *
   * Nothing is written when the block moved no economy at all, so a plain
   * walk-through doesn't litter the store.
   */
  _persistAnnotationsForBlock(region, instance) {
    const annotations = this._annotationTracker?.build() ?? null;
    if (!annotations) return null;
    const substrate = this._lookupSubstrateId(region);
    if (!substrate) return null;
    const tag = this._recordingTagForBlock(region, instance);
    if (!tag) return null;
    const rulesHash = this._rulesHash();
    if (!rulesHash) return null;
    saveQueue(rulesHash, {
      regionName: region,
      substrate,
      arrivalExitId: tag.arrivalKey,
      ordinal: tag.ordinal,
      departureExitId: null,
      actions: [],
      annotations,
    });
    return annotations;
  }

  /**
   * Finalize a successfully-exited Record block (M3b). Branches on the
   * capture contract:
   *   - FINE-GRAINED (registry supplies takeLastRecording — maze): pull
   *     the substrate's stashed full-visit recording, persist it to
   *     savedQueueStore under the block's tag, and project its coarse
   *     subset into the block interior.
   *   - COARSE-ONLY (text adventure): the loops-side capture buffer of
   *     observed live actions IS the recording — rewrite the block
   *     interior from it directly. No ACTIONS are written to
   *     savedQueueStore (the queue itself persists the same information;
   *     one source of truth), only the M4 annotations envelope.
   * Both paths apply the auto-switch-to-Playback setting.
   */
  _finalizeRecordBlock(region, instance, departureExitId = null) {
    const shape = this._captureShapeFor(this._lookupSubstrateId(region));
    if (shape === 'fine') {
      const rec = this._persistRecordingForBlock(region, instance);
      if (rec) this._applyCoarseReplacement(region, instance, rec);
    } else {
      // COARSE and SUMMARY share the interior rewrite — the block's queued
      // interior becomes what the player actually did (ruling 6: queue
      // readability, consistent with the maze/TA UX). They differ in what
      // is persisted: a coarse block stores only its annotations envelope
      // (its interior IS its recording), while a summary block stores the
      // visit's net RESULT, which the interior cannot express.
      this._applyCoarseReplacement(region, instance, { actions: this._liveCaptureBuffer.slice() });
      if (shape === 'summary') {
        this._persistSummaryForBlock(region, instance, departureExitId);
      } else {
        this._persistAnnotationsForBlock(region, instance);
      }
      this._autoSwitchAfterRecord(region, instance);
    }
    this._liveCaptureBuffer = [];
    this._annotationTracker = null;
    this._summaryDrainSeconds = 0;
    this._summaryCostedActions = [];
  }

  /**
   * The exit the queue intends to leave the current block by — the first
   * `regionMove` at or after the cursor. Used as the departure fallback
   * when the substrate's move carried no exit name (M5).
   */
  _queuedDepartureExit() {
    const queue = this.getActionQueue() ?? [];
    for (let i = Math.max(0, this.currentActionIndex); i < queue.length; i++) {
      if (queue[i]?.type === 'regionMove') return queue[i].exitUsed ?? null;
    }
    return null;
  }

  /**
   * Persist a SUMMARY block's recording (M5): the NET RESULT of the visit,
   * under the same `(region, arrivalKey, ordinal)` tag every other category
   * uses. `actions` stays EMPTY — a summary is not a replayable script, and
   * `hasPlayableRecording` must stay false for it — and the payload lives
   * in `summary`:
   *
   *   durationSeconds — drain ticks charged while parked. Playback prices
   *     this at the region's CURRENT rate, so region-XP growth keeps
   *     mattering for replays (a frozen mana number would not).
   *   checks         — the locations checked, refired on Playback.
   *   costedActions  — the performed actions that carried an EXPLICIT
   *     loop_costs price, re-priced at replay the same way.
   *
   * Unlike the coarse annotations envelope, this is written even when the
   * visit moved no economy at all: the duration alone is a real recording.
   */
  _persistSummaryForBlock(region, instance, departureExitId = null) {
    const substrate = this._lookupSubstrateId(region);
    if (!substrate) return null;
    const tag = this._recordingTagForBlock(region, instance);
    if (!tag) return null;
    const rulesHash = this._rulesHash();
    if (!rulesHash) return null;
    const summary = {
      durationSeconds: this._summaryDrainSeconds,
      checks: this._liveCaptureBuffer
        .filter((a) => a?.type === 'locationCheck' && a.locationName)
        .map((a) => a.locationName),
      costedActions: this._summaryCostedActions.slice(),
    };
    saveQueue(rulesHash, {
      regionName: region,
      substrate,
      arrivalExitId: tag.arrivalKey,
      ordinal: tag.ordinal,
      departureExitId: departureExitId ?? null,
      actions: [],
      annotations: this._annotationTracker?.build() ?? null,
      summary,
    });
    return summary;
  }

  /**
   * Coarse layer of Record (M2): replace the block's queued INTERIOR
   * entries with the coarse actions the player actually performed
   * (locationCheck / explore), so the queue reflects reality. The two
   * boundary regionMoves are untouched (clearActionsAt type-filters them),
   * and no regionMove is added or removed, so regionInstanceCounts /
   * instanceNumber bookkeeping stays exactly correct (recon 2).
   *
   * Safe to run inside the manual wake: a parked block's processing state is
   * 'idle' (not 'waiting'), so the gameState:pathUpdated this emits does NOT
   * trip eventCoordinator's auto-resume — no cursor reentrancy. Covered by
   * the "coarse replacement survives the pathUpdated reentrancy" test.
   */
  _applyCoarseReplacement(region, instance, rec) {
    const gs = this._gs();
    if (!gs || typeof gs.clearActionsAt !== 'function') return;
    gs.clearActionsAt(region, instance);
    for (const a of rec?.actions ?? []) {
      if (a?.type === 'locationCheck' && a.locationName) {
        gs.insertLocationCheckAt?.(a.locationName, region, instance, region);
      } else if (a?.type === 'explore') {
        gs.insertCustomActionAt?.('explore', region, instance, {});
      }
      // Fine-grained substrate actions (maze 'move', etc.) are NOT coarse
      // queue entries — they live only in the recorded fine script.
    }
  }

  /** Discard any in-progress Record capture (wrong-exit / mana-out / reset). */
  _discardActiveRecording() {
    this._liveCaptureBuffer = [];
    this._annotationTracker = null;
    // M5: the duration and costed-action list accrued for this visit die
    // with the capture.
    this._summaryDrainSeconds = 0;
    this._summaryCostedActions = [];
    if (!this._recordingBlock) return;
    // Drain the substrate's stash so it can't be pulled by a later block.
    const substrate = this._lookupSubstrateId(this._recordingBlock.region);
    try { substrateRegistry?.get?.(substrate)?.takeLastRecording?.(); } catch { /* ignore */ }
    this._recordingBlock = null;
  }

  /**
   * Playback with a bound recording: park the block and replay the recorded
   * script through the substrate's replayActions (generalizes the
   * customQueue path to mode-driven Playback). Same wake handlers as manual
   * mode advance past the block on the expected exit.
   */
  _handlePlaybackReplayEntry(region, saved) {
    if (this._manualActionEntered) return;
    // Capture the block's Instant flag (M3) BEFORE stopProcessing so the
    // running-block resolution is still valid; a truthy flag drains the
    // replay in one frame and (via isFocusLocked) suppresses the panel below.
    const instant = this._currentBlockIsInstant();
    this._manualActionEntered = true;
    this._manualRegionName = region;

    const componentType = this._lookupSubstrateComponentType(region);
    const focusLocked = centralRegistry?.getPublicFunction?.('loops', 'isFocusLocked')?.() ?? false;
    if (componentType && !focusLocked && this.eventBus?.publish) {
      this.eventBus.publish('ui:activatePanel', { panelId: componentType });
    }
    this.stopProcessing();

    const controller = substrateRegistry?.get?.(this._lookupSubstrateId(region))?.getPlaybackController?.();
    if (typeof controller?.replayActions === 'function') {
      try {
        controller.replayActions(saved.actions, {
          onComplete: () => { /* reserved for future UI */ },
          // Recorded actions exclude the region-departure move, so the
          // substrate uses this to cross the recorded exit after the interior
          // replay drains (textAdventure issues the closing regionMove; maze
          // physically walks its player across the exit tile) — the parked
          // loops block advances on the resulting regionMove wake.
          departureExitId: saved.departureExitId ?? null,
          // Instant (M3): drain the whole replay in one frame instead of
          // animating one action per clock tick.
          instant,
        });
      } catch (err) {
        log('warn', '[LoopState] playback replayActions threw:', err);
      }
    }

    if (this.eventBus?.publish) {
      this.eventBus.publish('loopState:manualEntered', {
        regionName: region,
        expectedNextRegion: this._getExpectedNextRegion(this.currentActionIndex),
        manualRegion: true,
        playback: true,
      });
    }
  }

  /**
   * The mana a stored summary costs to replay RIGHT NOW (M5): its recorded
   * seconds at the region's current XP-discounted drain rate, plus the
   * current XP-discounted price of each explicitly-costed action it
   * performed. Everything else the visit did is free by construction.
   *
   * Pricing at replay time (rather than storing a frozen number) is what
   * keeps region-XP growth meaningful for replays, and matches how the
   * generic executor prices a coarse replay.
   */
  _priceSummaryReplay(region, summary) {
    const seconds = Math.max(0, summary?.durationSeconds ?? 0);
    let total = this._calculateActionCost({ type: 'timeDrain', sourceRegion: region }) * seconds;
    for (const action of summary?.costedActions ?? []) {
      total += this._calculateActionCost({ ...action, sourceRegion: region });
    }
    return total;
  }

  /**
   * Playback for a SUMMARY substrate (M5): apply the recorded net result
   * directly instead of replaying anything. The game iframe does not
   * participate and the player character stays where it is — that is the
   * design of the category, not a bug.
   *
   * Order matters. The mana is spent FIRST, because spending can end the
   * visit: deductMana fires the depletion wake synchronously, which refills
   * the pool and snaps the queue back to index 0. If that happened, the
   * park flag is already cleared and the apply ABORTS — firing the checks
   * and the departure into a freshly reset loop would advance a block that
   * was never paid for.
   *
   * Summary playback is ALWAYS instant, so the per-block Instant flag is
   * not consulted; `instant` stays declared for the focus-suppression seam.
   */
  _handleSummaryApplyEntry(region, saved) {
    if (this._manualActionEntered) return;
    this._manualActionEntered = true;
    this._manualRegionName = region;

    const componentType = this._lookupSubstrateComponentType(region);
    const focusLocked = centralRegistry?.getPublicFunction?.('loops', 'isFocusLocked')?.() ?? false;
    if (componentType && !focusLocked && this.eventBus?.publish) {
      this.eventBus.publish('ui:activatePanel', { panelId: componentType });
    }
    this.stopProcessing();

    // Published BEFORE the apply, unlike the fine-grained replay path: the
    // apply below is synchronous end to end, so the departure's wake would
    // otherwise advance the block before this "we parked" event went out.
    this.eventBus?.publish?.('loopState:manualEntered', {
      regionName: region,
      expectedNextRegion: this._getExpectedNextRegion(this.currentActionIndex),
      manualRegion: true,
      playback: true,
      summary: true,
    });

    this._spendMana(region, this._priceSummaryReplay(region, saved?.summary));
    if (!this._manualActionEntered) return; // depletion reset fired — abort

    // Refire the recorded checks. Same dispatch as the generic executor:
    // host state is name-keyed and idempotent, and fromLoop marks these as
    // queue execution so neither the gate nor the path-append sees them as
    // performed play.
    for (const locationName of saved?.summary?.checks ?? []) {
      if (!locationName) continue;
      this.dispatcher?.publishToNextModule?.('loops', 'user:locationCheck', {
        locationName,
        regionName: region,
        fromLoop: true,
      }, { direction: 'up' });
    }

    // Cross the recorded departure. The TARGET comes from the queue, not
    // the recording: it is what the wake handler compares against, so
    // taking it from anywhere else could park the block forever on a
    // "wrong region" mismatch. The parked block advances on the resulting
    // regionMove wake.
    const targetRegion = this._getExpectedNextRegion(this.currentActionIndex);
    if (targetRegion) {
      this.dispatcher?.publish?.('user:regionMove', {
        sourceRegion: region,
        targetRegion,
        exitName: saved?.departureExitId ?? this._queuedDepartureExit(),
        fromLoop: true,
      }, { initialTarget: 'bottom' });
    }
  }

  /**
   * Resolve a block's mode. Precedence:
   *   1. explicit per-block mode (set via the radios / set-all);
   *   2. legacy region checkbox (migrated saves) → 'manual';
   *   3. defaultBlockMode — but a 'manual' default only applies where the
   *      substrate actually supports manual (an AP-native / no-manual
   *      block would otherwise park forever with no panel to hand to).
   * Explicit / legacy manual are NOT capability-clamped: the radios and
   * old checkbox only offered Manual where supported, so a stored value
   * already implies capability (and tests set it directly by design).
   */
  getBlockMode(region, instance) {
    if (!region) return this.defaultBlockMode || 'playback';
    const key = blockKeyOf(region, instance);
    if (this.blockModeStates.has(key)) return this.blockModeStates.get(key);
    if (this.manualRegionStates.get(region)) return 'manual';
    const dflt = this.defaultBlockMode || 'record';
    if (dflt === 'manual' && !this._regionSupportsManual(region)) return 'playback';
    // M4: the default is Record. A substrate that can't record falls back to
    // MANUAL, not Playback (user ruling 2026-07-23) — the point of the
    // Record default is "live-play each block once", and Manual is the
    // live-play mode. Manual is itself clamped to Playback where the
    // substrate can't park, so the two clamps compose in one step.
    if (dflt === 'record' && !this._regionSupportsRecord(region)) {
      return this._regionSupportsManual(region) ? 'manual' : 'playback';
    }
    return dflt;
  }

  /**
   * Whether the region's substrate follows the FINE-GRAINED capture
   * contract (M4 slice 5, public form of _substrateHasRecorder). The panel
   * needs it to decide what "a recording exists" means for a block: a bound
   * store recording for fine-grained substrates, a non-empty block interior
   * for coarse ones.
   */
  isFineGrainedRegion(region) {
    return this._captureShapeForRegion(region) === 'fine';
  }

  /**
   * Whether a PLAYABLE recording is bound to this block. Only meaningful
   * for fine-grained substrates; coarse blocks store no playable actions
   * (their interior is the recording), so this is always false for them.
   */
  hasBoundRecording(region, instance) {
    return !!this._lookupBoundRecording(region, instance);
  }

  /** Store an explicit per-block mode (overrides legacy + default). */
  setBlockMode(region, instance, mode) {
    if (!region || !mode) return;
    this.blockModeStates.set(blockKeyOf(region, instance), mode);
  }

  /**
   * Whether a block is set to run Instant (M3). Only meaningful for a
   * Playback/Bot block whose substrate declares loopSupport.instant; the
   * generic timer / substrate replay consult this to complete the block
   * headlessly in one frame. Absent key → false.
   */
  getBlockInstant(region, instance) {
    if (!region) return false;
    return this.blockInstantStates.get(blockKeyOf(region, instance)) === true;
  }

  /** Store a per-block Instant flag. Absent/false entries are dropped. */
  setBlockInstant(region, instance, on) {
    if (!region) return;
    const key = blockKeyOf(region, instance);
    if (on) this.blockInstantStates.set(key, true);
    else this.blockInstantStates.delete(key);
  }

  /**
   * Apply an Instant flag to every block in the current queue whose
   * substrate declares instant support (the "set all Instant" control).
   * Blocks that can't offer it are left untouched. Returns the count changed.
   */
  setAllBlockInstant(on) {
    const { visits } = resolveQueueBlocks(this.getActionQueue());
    let changed = 0;
    for (const v of visits) {
      if (!this._regionSupportsInstant(v.name)) continue;
      this.setBlockInstant(v.name, v.instance, on);
      changed += 1;
    }
    return changed;
  }

  /** Whether the current action's block resolves to Instant. */
  _currentBlockIsInstant() {
    const block = this._blockForCurrentAction();
    if (!block) return false;
    return this.getBlockInstant(block.region, block.instance);
  }

  /**
   * Apply `mode` to every block in the current queue whose substrate
   * supports it (the "set all" control). Blocks that can't offer the
   * mode are left untouched. Returns the number of blocks changed.
   */
  setAllBlockModes(mode) {
    if (!mode) return 0;
    const { visits } = resolveQueueBlocks(this.getActionQueue());
    let changed = 0;
    for (const v of visits) {
      if (mode === 'manual' && !this._regionSupportsManual(v.name)) continue;
      if (mode === 'record' && !this._regionSupportsRecord(v.name)) continue;
      if (mode === 'playback' && !this._regionOffersPlayback(v.name)) continue;
      if (mode === 'bot' && !this._regionSupportsBot(v.name)) continue;
      this.setBlockMode(v.name, v.instance, mode);
      changed += 1;
    }
    return changed;
  }

  /** Whether the region's substrate declares manual loop support. */
  _regionSupportsManual(region) {
    return !!this._loopSupportFor(region)?.manual;
  }

  /**
   * Whether the region's substrate can offer Record — it must DECLARE both
   * a recorder and replay (record requires playback). Mirrors
   * loopBlockBuilder.getModeOffers so the set-all control and the radios
   * agree on where Record is offered.
   */
  _regionSupportsRecord(region) {
    const ls = this._loopSupportFor(region);
    return !!ls?.record && !!ls?.playback;
  }

  /**
   * Whether the region's substrate declares Instant support (M3). The
   * per-block Instant toggle is offered only where this is true AND the
   * block runs in Playback/Bot (instant applies to the auto paths, not
   * Manual). Requires a real replay/timer instant primitive on the substrate.
   */
  _regionSupportsInstant(region) {
    return !!this._loopSupportFor(region)?.instant;
  }

  /**
   * Whether the region "auto-runs today" and can therefore offer the
   * Playback radio: any substrate with a real loopSupport declaration
   * (maze delegation / solver walkTo / generic timer all count).
   * AP-native (null) and NO_LOOP_SUPPORT (empty) regions get no row.
   */
  _regionOffersPlayback(region) {
    const ls = this._loopSupportFor(region);
    return !!ls && (ls.manual || (ls.queueActions?.length > 0) || !!ls.executeVia);
  }

  /** loopSupport for a region's substrate, or null (AP-native / lookup unavailable). */
  _loopSupportFor(region) {
    if (!region) return null;
    try {
      const fn = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
      const sub = fn?.(region)?.substrate;
      if (!sub) return null;
      return substrateRegistry.get(sub)?.loopSupport ?? null;
    } catch {
      return null;
    }
  }

  // -------------------- M3b: strict action gate + live-play observation --------------------

  /**
   * Whether a substrate follows the FINE-GRAINED capture contract: its
   * registry entry supplies a full-visit recorder (`takeLastRecording`).
   * Fine-grained substrates (maze) own capture AND the live-play drain
   * (per-tile, their native economy); coarse-only substrates (text
   * adventure) get both from loops. See loop-recording.md.
   */
  _substrateHasRecorder(substrateId) {
    if (!substrateId) return false;
    try {
      return typeof substrateRegistry?.get?.(substrateId)?.takeLastRecording === 'function';
    } catch {
      return false;
    }
  }

  /**
   * The substrate's CAPTURE SHAPE — the single resolver every
   * shape-dependent branch goes through, so a new category can never fall
   * into another's behavior by omission (M5). Three categories:
   *
   *   'fine'    — the registry entry supplies `takeLastRecording` (maze,
   *               jta): the substrate captures + replays a full interleaved
   *               action stream and charges its own native economy.
   *   'summary' — loopSupport declares `summaryRecording` (runner, bounce):
   *               the recording is the NET RESULT of the visit (duration,
   *               performed checks, departure exit) and Playback applies it
   *               instantly; the game replays nothing.
   *   'coarse'  — everything else (text adventure): the block's own queued
   *               interior IS the recording, run by the generic executor.
   *
   * The fine check wins if a substrate somehow declared both — a real
   * recorder is the stronger contract. See loop-recording.md.
   */
  _captureShapeFor(substrateId) {
    if (!substrateId) return 'coarse';
    if (this._substrateHasRecorder(substrateId)) return 'fine';
    try {
      if (substrateRegistry?.get?.(substrateId)?.loopSupport?.summaryRecording) return 'summary';
    } catch { /* fall through to coarse */ }
    return 'coarse';
  }

  /** The capture shape of a REGION's substrate (see _captureShapeFor). */
  _captureShapeForRegion(region) {
    return this._captureShapeFor(this._lookupSubstrateId(region));
  }

  /**
   * Public form of _captureShapeForRegion — the panel needs it to decide
   * what "a recording exists" means for a block (loopBlockBuilder's
   * getBlockPlayableContent).
   */
  getRegionCaptureShape(region) {
    return this._captureShapeForRegion(region);
  }

  /**
   * Which SOLVER can execute a region's actions under a Bot block, or null
   * where none can (M6). The companion of _captureShapeForRegion: one
   * public resolver, derived from EXISTING declarations — there is no new
   * capability flag (settled).
   *
   *   'walkTo'     — the substrate declares loopSupport.executeVia: 'solver'.
   *                  Loops drives its PlaybackController.walkTo and parks
   *                  until the resulting event arrives (jta, runner, bounce).
   *   'delegation' — the registry entry declares sharing.mana.loopAction-
   *                  Delegation AND the region has manaEnabled. The substrate
   *                  panel walks the action itself, charging natively, and
   *                  publishes loops:substrateActionCompleted (maze).
   *
   * The two are mutually exclusive in practice; walkTo wins if a substrate
   * ever declared both. Maze may NOT be moved onto walkTo: its controller's
   * walkTo drives the VISUALIZER (a separate position tracker), while
   * delegation drives the charging panel engine. M6 unifies the TRIGGER and
   * keeps both drivers.
   *
   * @param {string} region
   * @returns {'walkTo'|'delegation'|null}
   */
  regionSolver(region) {
    if (!region) return null;
    if (this._loopSupportFor(region)?.executeVia === 'solver') return 'walkTo';
    if (this._regionSupportsDelegation(region)) return 'delegation';
    return null;
  }

  /**
   * The delegation half of regionSolver: the region's substrate declares
   * the loop-action-delegation capability and the region has manaEnabled.
   * Reads procgenPlayer.getRegionInfo via centralRegistry to avoid a hard
   * dep — false in standalone / non-procgen contexts.
   */
  _regionSupportsDelegation(region) {
    let info = null;
    try {
      const fn = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
      info = fn?.(region) ?? null;
    } catch {
      info = null;
    }
    const entry = info?.substrate ? substrateRegistry.get(info.substrate) : null;
    return entry?.sharing?.mana?.loopActionDelegation === true
      && info?.manaEnabled === true;
  }

  /** Whether a region can offer the Bot radio — i.e. it has a solver (M6). */
  _regionSupportsBot(region) {
    return this.regionSolver(region) !== null;
  }

  /**
   * Whether a BOT block in this region can actually honor the Instant flag
   * (M6 ruling 4). The M1 "Instant applies to Playback and Bot" ruling is
   * satisfied PER CAPABILITY, not per declaration: showing a checkbox where
   * it does nothing is a vacuous control, so the Bot Instant checkbox is
   * offered only here.
   *
   * v1 is the walkTo solver on a FINE substrate — jta, whose controller
   * `instant()` maps to the fork's setInstantMode and really does collapse
   * the walk. The other two are deliberately out:
   *   - SUMMARY bots (runner, bounce) play real-time physics; no instant
   *     variant of that exists, so the checkbox would promise nothing.
   *   - MAZE DELEGATION is deferred, not impossible: its controller's
   *     instant() drives the VISUALIZER, while a delegated walk is tracked
   *     through the visualizer's per-tick change stream (step buffer,
   *     per-tile charging, mirrored queue, stuck detection). Wiring it
   *     means touching the two-position-tracker split, which is out of
   *     scope for this arc.
   */
  regionBotHonorsInstant(region) {
    if (!this._regionSupportsInstant(region)) return false;
    if (this.regionSolver(region) !== 'walkTo') return false;
    return this._captureShapeForRegion(region) === 'fine';
  }

  /**
   * Whether the strict action gate is ENFORCED for a region's substrate.
   * The gate model is substrate-universal, but enforcement rolls out with
   * each substrate's block-mode integration (declared record + playback —
   * maze and the text adventure today). Substrates that haven't adopted
   * the mode system yet (jta / omsi / runner / bounce / flash, pending
   * M4 / M5 / omsi arc D) keep their current loop-mode behavior until
   * their integration arc declares the capabilities.
   */
  _substrateGateEnforced(region) {
    const ls = this._loopSupportFor(region);
    return !!ls?.record && !!ls?.playback;
  }

  /**
   * The region currently open for parked LIVE PLAY (a Manual or Record
   * block the queue is parked on), or null. Playback/replay parks set
   * the same parked flags but are not live play. Hard-pause, user pause,
   * and completed/idle states all return null (ruling 3: strict gate).
   *
   * Exposed as the loops public function 'livePlayRegion' — the maze
   * consults it to enable its native per-tile drain during parked live
   * play (rule 2: Manual AND Record drain).
   */
  livePlayRegion() {
    if (!this._manualActionEntered) return null;
    if (this._queuePausedUntilReset) return null;
    if (this.isPaused) return null;
    // A solver is driving: not live play (M6). Its events pass the gate on
    // the 'queueExecution' exemption instead. Belt-and-braces — a solver
    // park never sets _manualActionEntered — so the negative can't rot.
    if (this._delegatedAction || this._botExecutedAction) return null;
    if (this._manualRegionName) {
      // Mode-driven park: discriminate hand-play (manual/record, plus a Bot
      // block whose solver could not engage and fell back to live play —
      // M6 ruling 2) from replay parks (playback / fine-grained recording
      // replay), which set the same _manualActionEntered/_manualRegionName
      // flags. Without 'bot' here the fallback park would be unplayable:
      // the strict gate would block the very hand-play it fell back to.
      const block = this._blockForCurrentAction();
      if (!block) return null;
      const mode = this.getBlockMode(block.region, block.instance);
      return (mode === 'manual' || mode === 'record' || mode === 'bot')
        ? this._manualRegionName : null;
    }
    // Legacy parks: a 'manual' path entry is hand-play; 'customQueue'
    // may fall back to hand-play when no replay is available.
    const t = this.currentAction?.type;
    if (t === 'manual' || t === 'customQueue') {
      return this.currentAction?.sourceRegion ?? null;
    }
    return null;
  }

  /**
   * The strict loop-mode action gate (M3b ruling 3, session 66b).
   * Decides whether a performed substrate action may proceed.
   *
   * @param {Object} args
   * @param {'location'|'exit'|'move'|'explore'} args.kind
   * @param {string|null} args.regionName - region the action is performed
   *   in (a move's SOURCE region).
   * @param {string|null} [args.eventName] - dispatcher event name, for
   *   the system:* exemption.
   * @param {Object|null} [args.data] - original event payload, for the
   *   fromLoop / fromReset / planning-source exemptions.
   * @returns {{allowed: boolean, reason: string, expectedRegion?: string|null}}
   *   reason ∈ exempt: 'loopModeOff'|'fromLoop'|'fromReset'|'systemEvent'|
   *     'planningSource'|'queueExecution'|'syntheticMove' — out of
   *     scope: 'noRegion'|'apNative'|'substrateNotGated' — allowed live
   *     play: 'parkedLivePlay' — blocked: 'hardPause'|'queueCompleted'|
   *     'emptyQueue'|'notStarted'|'paused'|'wrongRegion'.
   */
  evaluateActionGate({ kind, regionName = null, eventName = null, data = null }) {
    const gs = this._gs();
    if (!gs?.isLoopModeActive) return { allowed: true, reason: 'loopModeOff' };
    const d = data ?? {};
    if (d.fromLoop === true) return { allowed: true, reason: 'fromLoop' };
    if (d.fromReset === true) return { allowed: true, reason: 'fromReset' };
    if (typeof eventName === 'string' && eventName.startsWith('system:')) {
      return { allowed: true, reason: 'systemEvent' };
    }
    if (isLoopModePlanningSource(d.source)) {
      return { allowed: true, reason: 'planningSource' };
    }
    // The queue's own execution must always pass: substrate delegation
    // (maze walks) and solver/bot-backed actions dispatch real events.
    if (this._delegatedAction || this._botExecutedAction) {
      return { allowed: true, reason: 'queueExecution' };
    }
    // A regionMove WITHOUT an exit is a synthetic reposition (test
    // harness, debug tooling), not a player-performed exit crossing —
    // every real substrate publish carries the exit it crossed. The
    // gate governs performed substrate actions only.
    if (kind === 'move' && !d.exitName) {
      return { allowed: true, reason: 'syntheticMove' };
    }
    // A move without a resolvable source region can't be classified by
    // substrate — fall back to the player's current region.
    let region = regionName;
    if (!region && kind === 'move') {
      region = this.gameState?.getCurrentRegion?.() ?? null;
    }
    if (!region) return { allowed: true, reason: 'noRegion' };
    const substrate = this._lookupSubstrateId(region);
    if (!substrate) return { allowed: true, reason: 'apNative' };
    if (!this._substrateGateEnforced(region)) {
      return { allowed: true, reason: 'substrateNotGated' };
    }
    const liveRegion = this.livePlayRegion();
    if (liveRegion && liveRegion === region) {
      return { allowed: true, reason: 'parkedLivePlay' };
    }
    // Blocked — classify for user-facing feedback.
    let reason;
    if (this._queuePausedUntilReset) reason = 'hardPause';
    else if (this._queueCompleted) reason = 'queueCompleted';
    else if ((this.getActionQueue()?.length ?? 0) === 0) reason = 'emptyQueue';
    else if (this.isPaused) reason = 'paused';
    else if (liveRegion) reason = 'wrongRegion';
    else reason = 'notStarted';
    return { allowed: false, reason, expectedRegion: liveRegion ?? null };
  }

  /**
   * Observe a gate-allowed parked live-play action (rule 1 + rule 2,
   * session 66b): charge its loop_costs value (xp-adjusted, one economy
   * with the generic executor) and, when the parked block is Record,
   * append it to the coarse capture buffer. Applies to COARSE-ONLY
   * substrates only — fine-grained substrates (maze) drain natively and
   * capture through their own recorder. The departing regionMove is
   * charged on the wake (_handleManualWake_regionMove), not here.
   *
   * @param {{type: 'locationCheck'|'explore', locationName?: string, regionName: string}} action
   */
  observeParkedLiveAction({ type, locationName = null, regionName }) {
    const liveRegion = this.livePlayRegion();
    if (!liveRegion || liveRegion !== regionName) return;
    const substrate = this._lookupSubstrateId(regionName);
    if (!substrate) return;
    // FINE-GRAINED substrates drain natively and capture through their own
    // recorder — loops observes nothing. COARSE-ONLY and SUMMARY substrates
    // are both charged and captured here; M5 slice 2 splits their PRICING
    // (summary substrates charge only costs explicitly present in the
    // loop_costs data, never the 50/100 fallbacks).
    const shape = this._captureShapeFor(substrate);
    if (shape === 'fine') return;
    const actionShape = type === 'explore'
      ? { type: 'customAction', sourceRegion: regionName }
      : { type: 'locationCheck', locationName, sourceRegion: regionName };
    if (shape === 'summary') this._noteSummaryCostedAction(actionShape);
    this._chargeLiveAction(actionShape);
    if (this._recordingBlock) {
      this._liveCaptureBuffer.push(type === 'explore'
        ? { type: 'explore', regionName }
        : { type: 'locationCheck', locationName });
    }
  }

  /**
   * Remember a summary-visit action that carried an EXPLICIT loop_costs
   * price, so Playback can re-price it (M5). Free actions are deliberately
   * NOT listed: the recorded duration already prices them, and listing them
   * would invite a future reader to charge them twice.
   *
   * Recorded at CHARGE time rather than derived at finalize, so the list is
   * exactly what was paid for — including the departing move, which is
   * charged on the wake before the capture is finalized.
   */
  _noteSummaryCostedAction(actionShape) {
    if (!this._recordingBlock) return;
    if (!(this._summaryBaseCost(actionShape) > 0)) return;
    const { type, locationName = null } = actionShape;
    this._summaryCostedActions.push(
      locationName ? { type, locationName } : { type },
    );
  }

  /**
   * Charge one live-play action's cost: same cost model and XP award as
   * the generic executor (_advanceActionProgress), so live play, Record,
   * and Playback share one economy. Depletion is handled by the existing
   * mana wake (gameState:manaChanged → _handleManualWake_mana →
   * _resetLoop), which fires synchronously from deductMana.
   */
  _chargeLiveAction(actionShape) {
    this._spendMana(actionShape.sourceRegion, this._calculateActionCost(actionShape));
  }

  /**
   * Deduct mana and award the matching region XP 1:1 — the single spend
   * path shared by live-play charges, the M5 time drain, and the M5
   * summary replay, so all three keep one economy.
   *
   * CALLER BEWARE: deductMana fires gameState:manaChanged SYNCHRONOUSLY,
   * whose wake can run the depletion reset (refilling the pool, snapping
   * the queue to index 0 and discarding any capture). Anything a caller
   * does after this must tolerate that, or check for it.
   */
  _spendMana(region, cost) {
    if (!(cost > 0)) return;
    const gs = this._gs();
    if (!gs?.deductMana) return;
    gs.deductMana(cost);
    if (region) {
      this.addRegionXP(region, cost);
      this._annotationTracker?.noteXp(cost);
      this.eventBus?.publish('gameState:xpChanged', {
        regionName: region,
        xpData: this.getRegionXP(region),
      });
    }
  }

  /**
   * Auto-switch a just-recorded block to Playback (schema-backed
   * setting, default ON) and refresh the panel. Shared by the
   * fine-grained persist path and the coarse-only finalize path.
   */
  _autoSwitchAfterRecord(region, instance) {
    if (!this.autoSwitchToPlaybackAfterRecord) return;
    this.setBlockMode(region, instance, 'playback');
    this.eventBus?.publish?.('loopState:blockModeChanged', {
      region,
      instance,
      mode: 'playback',
      reason: 'autoSwitchAfterRecord',
    });
    // Re-render the panel so the block's mode radio flips to Playback
    // immediately on exit. eventCoordinator re-renders on queueUpdated
    // but not blockModeChanged. The payload MUST carry `queue` —
    // _handleQueueUpdated → _updateRegionsInQueue iterates it (an empty
    // {} throws on the for-of).
    this.eventBus?.publish?.('loopState:queueUpdated', { queue: this.getActionQueue() });
  }

  /**
   * Park the queue on a manual-checked region. Mirrors
   * _handleManualEntry, but the region's whole queued segment (every
   * action up to and including the regionMove that leaves the region)
   * becomes the player's expected outcome instead of a single entry.
   */
  _handleManualRegionEntry(regionName) {
    if (this._manualActionEntered) return;
    this._manualActionEntered = true;
    this._manualRegionName = regionName;
    // M5: the visit's duration and costed actions are counted from this
    // park (summary substrates only — they stay empty elsewhere).
    this._summaryDrainSeconds = 0;
    this._summaryCostedActions = [];

    const componentType = this._lookupSubstrateComponentType(regionName);
    if (componentType && this.eventBus?.publish) {
      this.eventBus.publish('ui:activatePanel', { panelId: componentType });
    }

    this.stopProcessing();

    if (this.eventBus?.publish) {
      this.eventBus.publish('loopState:manualEntered', {
        regionName,
        expectedNextRegion: this._getExpectedNextRegion(this.currentActionIndex),
        manualRegion: true,
      });
    }
  }

  /**
   * Mark the manual region's queued segment complete and move the
   * cursor past it: every action from the cursor up to and including
   * the first regionMove (the leaving move the player just performed).
   * No mana is charged — manual play's costs are substrate-owned
   * (maze drains natively per step; substrates without native drain
   * play free).
   */
  _completeManualRegionSegment() {
    const queue = this.getActionQueue();
    let i = this.currentActionIndex;
    for (; i < queue.length; i++) {
      const entry = queue[i];
      this.actionQueueManager?.markCompleted(entry.pathIndex);
      if (entry.type === 'regionMove') {
        i += 1;
        break;
      }
    }
    this.currentActionIndex = i;
  }

  /**
   * Display hook for per-region manual mode: a location check that
   * happened while the player drives a manual region marks the
   * matching queued locationCheck in the active segment completed
   * (expected-outcome tracking). Called from loopEvents' pass-through
   * branch for every locationCheck event; no-ops unless a manual
   * region segment is active. Unexpected checks are ignored by design
   * (mismatch = wrong-region moves only).
   */
  noteLocationChecked(locationName) {
    if (!this._manualRegionName || !locationName) return;
    const queue = this.getActionQueue();
    for (let i = this.currentActionIndex; i < queue.length; i++) {
      const entry = queue[i];
      if (entry.type === 'regionMove') break; // segment ends here
      if (entry.type === 'locationCheck' &&
          entry.locationName === locationName &&
          !entry.completed) {
        this.actionQueueManager?.markCompleted(entry.pathIndex);
        // Payload MUST carry `queue` — _handleQueueUpdated →
        // _updateRegionsInQueue iterates it (an empty {} throws).
        this.eventBus?.publish('loopState:queueUpdated', { queue });
        return;
      }
    }
  }

  /**
   * Read the substrate's GoldenLayout componentType for a region via
   * procgenPlayer.getRegionInfo + substrateRegistry. Returns null
   * when the region has no substrate (AP-native, e.g. Menu) or when
   * procgenPlayer isn't registered (test harness).
   */
  _lookupSubstrateComponentType(regionName) {
    if (!regionName) return null;
    try {
      const getRegionInfo = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
      if (typeof getRegionInfo !== 'function') return null;
      const info = getRegionInfo(regionName);
      if (!info?.substrate) return null;
      return substrateRegistry?.get?.(info.substrate)?.panelComponentType ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve the substrate id ('maze', 'text_adventure', ...) for a
   * region so callers can dispatch saved-queue actions through that
   * substrate's controller. Returns null when the region has no
   * substrate or procgenPlayer isn't registered (test envs).
   */
  _lookupSubstrateId(regionName) {
    if (!regionName) return null;
    try {
      const getRegionInfo = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
      if (typeof getRegionInfo !== 'function') return null;
      return getRegionInfo(regionName)?.substrate ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Look up a saved queue by (rules-hash, region, substrate,
   * recordedAt). Returns null on miss (rules not yet cached, no
   * substrate, queue evicted by FIFO cap).
   */
  _lookupSavedQueue(regionName, recordedAt) {
    if (!regionName || recordedAt == null) return null;
    if (!this._cachedRulesData) return null;
    const substrate = this._lookupSubstrateId(regionName);
    if (!substrate) return null;
    const rulesHash = hashRulesData(this._cachedRulesData);
    if (!rulesHash) return null;
    const queues = getSavedQueues(rulesHash, regionName, substrate);
    const target = String(recordedAt);
    return queues.find((q) => String(q.recordedAt) === target) ?? null;
  }

  /**
   * Called from _processFrame whenever the current action is type
   * 'customQueue'. On the first hit per entry:
   *   - Activate the substrate panel.
   *   - Stop queue processing.
   *   - Look up the saved queue (async); on hit, call the substrate's
   *     PlaybackController.replayActions. On miss (or substrate has no
   *     replayActions), fall back to publishing manualEntered so the
   *     player can drive manually.
   *   - Publish loopState:manualEntered (with queueRef in the payload
   *     so the UI banner can show the queue name).
   * The same wake handlers used by manual mode (regionChanged + manaChanged)
   * advance past this entry or set _queuePausedUntilReset on mismatch.
   */
  _handleCustomQueueEntry(action) {
    if (this._manualActionEntered) return;
    // Capture the block's Instant flag (M3) before stopProcessing, same as
    // the mode-driven Playback path — a customQueue replay on an Instant
    // block drains in one frame too.
    const instant = this._currentBlockIsInstant();
    this._manualActionEntered = true;

    // Playback (customQueue) runs the block automatically — unlike a
    // Manual entry, it should NOT steal panel focus when the user has
    // "Keep this panel focused" on. Gate on the same isFocusLocked
    // predicate the substrates consult before self-activating.
    const componentType = this._lookupSubstrateComponentType(action.sourceRegion);
    const focusLocked = centralRegistry?.getPublicFunction?.('loops', 'isFocusLocked')?.() ?? false;
    if (componentType && !focusLocked && this.eventBus?.publish) {
      this.eventBus.publish('ui:activatePanel', { panelId: componentType });
    }
    this.stopProcessing();

    // Resolve the saved queue + dispatch through the substrate's
    // replayActions controller. Missing queue, substrate without
    // replay support, or replay errors all silently fall through to
    // manual-mode semantics (banner + wake-on-exit are the same).
    const saved = this._lookupSavedQueue(action.sourceRegion, action.queueRef?.recordedAt);
    if (saved) {
      const substrate = this._lookupSubstrateId(action.sourceRegion);
      const controller = substrate
        ? substrateRegistry?.get?.(substrate)?.getPlaybackController?.()
        : null;
      if (typeof controller?.replayActions === 'function') {
        try {
          controller.replayActions(saved.actions, {
            onComplete: () => { /* reserved for future UI */ },
            instant,
          });
        } catch (err) {
          log('warn', '[LoopState] customQueue replayActions threw:', err);
        }
      }
    }

    if (this.eventBus?.publish) {
      this.eventBus.publish('loopState:manualEntered', {
        regionName: action.sourceRegion,
        expectedNextRegion: this._getExpectedNextRegion(),
        // Custom-queue marker so the UI banner can say "Custom queue:
        // X" instead of the generic "Manual mode" wording.
        customQueue: {
          queueName: action.queueName ?? null,
          recordedAt: action.queueRef?.recordedAt ?? null,
        },
      });
    }
  }

  // -------------------- Bot-backed queue execution --------------------

  /**
   * Whether the current ACTION can be executed by the walkTo solver.
   * The per-action half of the Bot branch's check (regionSolver answers
   * the per-REGION half): the action's type must be in queueActions and
   * a live playback controller exposing walkTo must exist. A missing
   * controller (panel not mounted / headless) means the solver cannot
   * engage — since M6 that parks the block for live play with a warning
   * rather than silently teleporting it on the generic timer.
   */
  _shouldBotExecuteCurrentAction() {
    const action = this.currentAction;
    if (!action) return false;
    if (action.type !== 'regionMove' && action.type !== 'locationCheck') return false;
    const substrate = this._lookupSubstrateId(action.sourceRegion);
    if (!substrate) return false;
    const entry = substrateRegistry?.get?.(substrate);
    const loopSupport = entry?.loopSupport;
    if (loopSupport?.executeVia !== 'solver') return false;
    if (!loopSupport.queueActions?.includes(action.type)) return false;
    return typeof entry.getPlaybackController?.()?.walkTo === 'function';
  }

  /**
   * Park the queue on the current action and dispatch the bot toward
   * its target (a location for locationCheck, the exit portal for
   * regionMove). Mirrors _tickSubstrateDelegation's parking: no RAF
   * is scheduled, isProcessing stays true, and the wake handlers
   * (_handleBotWake_locationCheck / _handleBotWake_regionChanged)
   * resume the queue when the result event arrives.
   */
  _handleBotExecutedAction() {
    if (this._botExecutedAction) {
      this._animationFrameId = null;
      return;
    }
    const action = this.currentAction;
    this._botExecutedAction = action;
    this._lastFrameTime = null;
    this._animationFrameId = null;

    const substrate = this._lookupSubstrateId(action.sourceRegion);
    const controller = substrate
      ? substrateRegistry?.get?.(substrate)?.getPlaybackController?.()
      : null;
    const target = action.type === 'locationCheck'
      ? { kind: 'location', name: action.locationName }
      : { kind: 'exit', name: action.exitUsed };
    try {
      // Instant (M6 ruling 4): collapse the walk where the solver really
      // honors it. Set BEFORE walkTo — it is a mode the substrate reads as
      // the walk runs, not an argument to it — and idempotent (jta's maps to
      // setInstantMode(true)). Gated on regionBotHonorsInstant so a flag
      // left over from a Playback session can't reach a solver that would
      // ignore it, or worse, half-honor it.
      if (this._currentBlockIsInstant() && this.regionBotHonorsInstant(action.sourceRegion)) {
        controller?.instant?.();
      }
      controller?.walkTo?.(target);
      log('info', `[LoopState] Bot walking to ${target.kind} '${target.name}' in ${action.sourceRegion}`);
    } catch (err) {
      log('warn', '[LoopState] Bot walkTo threw:', err);
    }
  }

  /**
   * Stop an in-flight bot walk (best-effort) and clear the parked
   * action. Called on pause/stop, loop reset, and unexpected-region
   * detection.
   */
  _stopBotExecutedAction() {
    const action = this._botExecutedAction;
    if (!action) return;
    this._botExecutedAction = null;
    const substrate = this._lookupSubstrateId(action.sourceRegion);
    const controller = substrate
      ? substrateRegistry?.get?.(substrate)?.getPlaybackController?.()
      : null;
    try {
      controller?.stop?.();
    } catch { /* best-effort */ }
  }

  /**
   * Wake for bot-executed locationCheck actions. Called from
   * loopEvents' pass-through branch for every locationCheck event;
   * completes the parked action when the checked location is its
   * target. No-ops otherwise (including for the fromLoop re-dispatch
   * our own completion emits — the parked action is already cleared
   * by then).
   */
  _handleBotWake_locationCheck(locationName) {
    const action = this._botExecutedAction;
    if (!action || action.type !== 'locationCheck') return;
    if (!locationName || locationName !== action.locationName) return;
    this._completeBotExecutedAction();
  }

  /**
   * Wake for bot-executed actions on a region change. A regionMove
   * arriving at its destination completes; any other region change
   * while the bot drives (an open non-target portal swallowed a
   * landing, the player grabbed the controls...) gets the same
   * paused-until-reset semantics as a manual wrong-exit.
   */
  _handleBotWake_regionChanged(newRegion) {
    const action = this._botExecutedAction;
    if (!action || !newRegion) return;
    if (action.type === 'regionMove' && newRegion === action.destinationRegion) {
      this._completeBotExecutedAction({ viaRegionMove: true });
      return;
    }
    this._stopBotExecutedAction();
    this.stopProcessing();
    this._queuePausedUntilReset = true;
    if (this.eventBus?.publish) {
      this.eventBus.publish('loopState:queuePausedUntilReset', {
        actualRegion: newRegion,
        expectedRegion: action.type === 'regionMove'
          ? action.destinationRegion
          : action.sourceRegion,
        reason: 'botUnexpectedRegion',
      });
    }
  }

  /**
   * Complete the parked bot-executed action: charge it, then run the
   * normal completion flow. For regionMoves the bridge already moved the
   * player, so the duplicate user:regionMove dispatch is suppressed
   * exactly like substrate delegation.
   *
   * THE CHARGE (M6 ruling 3 — Bot execution costs what live play of the
   * same content costs, so the charge follows the region's CAPTURE SHAPE):
   *
   *   - FINE (jta, maze): nothing. The substrate charges natively while
   *     the bot plays — jta's energy drain mirrors into the pool. The flat
   *     completion charge this replaces was a v1 decision made when bounce
   *     was the only user; on a natively-charging substrate it double-bills
   *     the same play.
   *   - SUMMARY (runner, bounce): the per-second drain has been running
   *     throughout, and the action itself costs only what the loop_costs
   *     data names EXPLICITLY (_calculateActionCost's summary branch) —
   *     no 50/100 fallbacks, which would price the visit twice.
   *   - Anything else (unreachable today — no coarse substrate declares a
   *     solver): charge as the safe default, matching the generic executor.
   *
   * All of it routes through _chargeLiveAction, so a bot's spend awards
   * region XP 1:1 like every other spend. The old direct deductMana call
   * awarded none. A resulting mana ≤ 0 lands on the next frame's
   * _maybeResetForOOM — the completion flow below is safe to run either
   * way, because the depletion wake ignores a non-manual park.
   */
  _completeBotExecutedAction({ viaRegionMove = false } = {}) {
    const action = this._botExecutedAction;
    this._botExecutedAction = null;
    if (!action || this.currentAction !== action) return;

    if (this._captureShapeForRegion(action.sourceRegion) !== 'fine') {
      this._chargeLiveAction(action);
    }

    if (this.actionQueueManager) {
      this.actionQueueManager.setProgress(action.pathIndex, 100);
      this.currentAction.progress = 100;
    }
    this._completedViaDelegation = viaRegionMove;
    try {
      this._completeCurrentAction();
    } finally {
      this._completedViaDelegation = false;
    }

    // Resume the frame loop to tick the next action (or hit the
    // queue-completed / OOM transitions cleanly).
    if (this.isProcessing && !this.isPaused) {
      this._lastFrameTime = null;
      if (this._animationFrameId) {
        cancelAnimationFrame(this._animationFrameId);
      }
      this._animationFrameId = requestAnimationFrame(
        this._processFrame.bind(this),
      );
    }
  }

  /**
   * Wake from manual mode in response to a user:regionMove event.
   * If the target matches the queue's next expected region, advance
   * past the manual entry and resume processing. Otherwise mark the
   * queue paused-until-reset and publish a warning.
   */
  _handleManualWake_regionMove(data) {
    // Not parked: nothing to wake. (M2's unparked Record capture lived
    // here; it is dead code under the M3b strict action gate — free-
    // walking a Record region can no longer happen — and was removed.)
    if (!this._manualActionEntered) return;
    // The loop-reset teleport is not live play — the reset flow owns
    // queue state (exemption matrix: fromReset).
    if (data?.fromReset) return;
    if (!this.currentAction) return;
    const manualRegion = this._manualRegionName;
    const t = this.currentAction.type;
    if (!manualRegion && t !== 'manual' && t !== 'customQueue') return;
    // Rule 2 (session 66b): live play drains — charge the departing
    // regionMove the player just performed, success or wrong exit alike
    // (the move happened either way). Coarse-only AND summary substrates
    // (M5) are charged here; fine-grained substrates charge their own
    // native economy per tile. M5 slice 2 splits the two pricings — a
    // summary substrate's departure costs only what loop_costs states
    // explicitly, never the 50 fallback.
    const liveRegion = this.livePlayRegion();
    if (liveRegion && liveRegion === (data?.oldRegion ?? liveRegion)
        && this._captureShapeForRegion(liveRegion) !== 'fine') {
      const move = { type: 'regionMove', sourceRegion: liveRegion };
      if (this._captureShapeForRegion(liveRegion) === 'summary') {
        this._noteSummaryCostedAction(move);
      }
      this._chargeLiveAction(move);
      // The charge may have depleted mana: deductMana fires manaChanged
      // synchronously, whose wake runs _resetLoop (mana-out mid-Record
      // discards, M2 ruling). The park state is gone — stop here.
      if (!this._manualActionEntered) return;
    }
    // Per-region manual mode scans from the current action INCLUSIVE
    // (the cursor may be parked on the leaving regionMove itself);
    // legacy manual/customQueue entries scan from the next entry.
    const expected = manualRegion
      ? this._getExpectedNextRegion(this.currentActionIndex)
      : this._getExpectedNextRegion();
    if (data?.targetRegion && data.targetRegion === expected) {
      // Match — advance past the manual entry (legacy) or the whole
      // region segment (per-region manual mode).
      this._manualActionEntered = false;
      this._manualRegionName = null;
      this._boundReplayCheckedIndex = -1;
      // Successful Record exit: finalize the capture + rewrite the
      // block interior BEFORE completing the segment (the departing
      // regionMove the segment-completer walks to stays untouched).
      const recordingBlock = this._recordingBlock;
      this._recordingBlock = null;
      if (recordingBlock) {
        // The crossed exit, or the one the queue meant to cross. A summary
        // recording needs it to replay the departure (M5); resolve it
        // BEFORE _completeManualRegionSegment moves the cursor past the
        // queued regionMove the fallback reads.
        this._finalizeRecordBlock(
          recordingBlock.region,
          recordingBlock.instance,
          data?.exitName ?? this._queuedDepartureExit(),
        );
      }
      if (manualRegion) {
        this._completeManualRegionSegment();
      } else {
        this.currentActionIndex += 1;
      }
      const queue = this.getActionQueue();
      this.currentAction = this.currentActionIndex < queue.length
        ? queue[this.currentActionIndex]
        : null;
      if (this.eventBus?.publish) {
        this.eventBus.publish('loopState:manualResumed', {
          targetRegion: data.targetRegion,
        });
      }
      // Resume processing from the current index (do NOT use
      // startProcessing — that resets currentActionIndex to 0 and
      // would re-enter the manual entry forever).
      this.resumeProcessing?.();
      return;
    }
    // Mismatch — disable playback until the next loop reset. A Record in
    // progress is DISCARDED (M2 ruling: wrong exit = Manual's wrong-region
    // semantics, recording thrown away).
    this._discardActiveRecording();
    this._queuePausedUntilReset = true;
    if (this.eventBus?.publish) {
      this.eventBus.publish('loopState:queuePausedUntilReset', {
        actualRegion: data?.targetRegion ?? null,
        expectedRegion: expected,
        reason: 'manualWrongRegion',
      });
    }
  }

  /** Mana-zero during manual mode → standard loop reset. */
  _handleManualWake_mana() {
    if (!this._manualActionEntered) return;
    if (!this.currentAction) return;
    const t = this.currentAction.type;
    if (!this._manualRegionName && t !== 'manual' && t !== 'customQueue') return;
    const gs = this._gs();
    if (typeof gs?.getCurrentMana !== 'function') return;
    if (gs.getCurrentMana() > 0) return;
    // The no-depletion-reset debug flag suppresses this reset exactly
    // like the generic timer's _maybeResetForOOM — mana runs negative
    // (manaDebt) instead.
    if (gs.noManaDepletionReset) return;
    this._resetLoop();
  }

  /**
   * Advance the current action's progress by one frame's worth, deduct
   * mana proportionally, and award XP. Side effects:
   *   - actionQueueManager progress map
   *   - gs.deductMana (handles noManaDepletionReset / manaDebt internally)
   *   - gs.addRegionXP + gameState:xpChanged event for fine-grained UI updates
   *
   * Zero-cost actions, the global instantMode debug flag, and a per-block
   * Instant toggle (M3) all complete the action in a single frame.
   */
  _advanceActionProgress(deltaTime) {
    const actionCost = this._calculateActionCost(this.currentAction);
    const currentProgress =
      this.actionQueueManager.getProgress(this.currentAction.pathIndex) || 0;

    let progressIncrement;
    if (actionCost === 0 || this.instantMode || this._currentBlockIsInstant()) {
      progressIncrement = 100 - currentProgress;
    } else {
      // Slow down the action for better visibility — 20 instead of 100.
      progressIncrement = (deltaTime / 1000) * (20 / actionCost);
    }

    const newProgress = currentProgress + progressIncrement;
    this.actionQueueManager.setProgress(
      this.currentAction.pathIndex,
      newProgress
    );
    this.currentAction.progress = newProgress;

    const manaCost = (progressIncrement / 100) * actionCost;
    const gs = this._gs();
    if (gs) gs.deductMana(manaCost);

    if (this.currentAction.sourceRegion) {
      const xpGain = (progressIncrement / 100) * actionCost;
      this.addRegionXP(this.currentAction.sourceRegion, xpGain);
      const xpData = this.getRegionXP(this.currentAction.sourceRegion);
      this.eventBus.publish('gameState:xpChanged', {
        regionName: this.currentAction.sourceRegion,
        xpData,
      });
    }
  }

  /**
   * If the current action's progress hit 100, complete it.
   * _completeCurrentAction may transition to _queueCompleted (queue ran
   * to the end) or, in step mode, call _pauseAfterStep to stop processing
   * after this single action.
   */
  _maybeCompleteCurrentAction() {
    if (this.currentAction.progress >= 100) {
      this._completeCurrentAction();
    }
  }

  /**
   * Out-of-mana reset. Runs when mana ≤ 0 unless noManaDepletionReset
   * is set. The reset refills mana, resets progress, and snaps the queue
   * back to index 0.
   *
   * Pause vs continue:
   *   - autoRestart off → pause
   *   - step mode → pause (the reset is the step's terminal event)
   *   - already paused this frame (step-mode completion ran first) →
   *     pause; otherwise we'd RAF into a paused state forever
   *   - otherwise → continue (RAF the next frame)
   *
   * @returns {boolean} true if a reset fired (caller should bail —
   *   the frame is done either way).
   */
  _maybeResetForOOM() {
    const gs = this._gs();
    if (!gs) return false;
    if (gs.currentMana > 0 || gs.noManaDepletionReset) return false;

    this._resetLoop();

    const shouldPause =
      !this.autoRestartQueue || this._stepMode || !this.isProcessing;
    if (shouldPause) {
      this._stepMode = false;
      this.isPaused = true;
      this.stopProcessing();
      this.eventBus.publish('loopState:pauseStateChanged', {
        isPaused: true,
        processingState: this.getProcessingState(),
      });
    } else {
      this._animationFrameId = requestAnimationFrame(
        this._processFrame.bind(this)
      );
    }
    return true;
  }

  /**
   * Publish the per-frame UI update event.
   */
  _publishProgressUpdate() {
    const gs = this._gs();
    const eventData = {
      mana: {
        current: gs ? gs.currentMana : 100,
        max: gs ? gs.maxMana : 100,
      },
    };
    if (this.currentAction) {
      eventData.action = this.currentAction;
    }
    this.eventBus.publish('loopState:progressUpdated', eventData);
  }

  /**
   * Complete the current action
   */
  _completeCurrentAction() {
    // Apply action effects
    this._applyActionEffects(this.currentAction);

    // Mark as completed in our tracking
    this.actionQueueManager.markCompleted(this.currentAction.pathIndex);
    this.actionQueueManager.setProgress(this.currentAction.pathIndex, 100);
    this.currentAction.completed = true;
    this.currentAction.progress = 100; // Ensure it shows 100% complete

    // Notify completion
    this.eventBus.publish('loopState:actionCompleted', {
      action: this.currentAction,
    });

    // Check if this is an explore action that just completed
    if (this.currentAction.type === 'customAction' && this.currentAction.actionName === 'explore') {
      // Get the region from the action
      const regionName = this.currentAction.sourceRegion;

      // Get the repeat state from THIS instance's map
      const shouldRepeat = this.getRepeatExplore(regionName); // Use internal method

      // Get current queue to check for more explore actions
      const queue = this.getActionQueue();

      // Check if there are already more explore actions for this region in the queue
      const hasMoreExploreActions = queue.some(
        (action, index) =>
          index > this.currentActionIndex &&
          action.type === 'customAction' &&
          action.sourceRegion === regionName
      );

      // Only add a new explore action if shouldRepeat is true AND there are no more explore actions for this region
      if (shouldRepeat && !hasMoreExploreActions) {
        //log('info',
        //  `Repeating explore action for ${regionName} (repeat state is true, no other explore actions pending)`
        //);

        // Add a new explore action to gameState
        if (this.gameState && this.gameState.addCustomAction) {
          this.gameState.addCustomAction('explore', { repeat: true });
        }

        // Notify that a new explore action was added
        this.eventBus.publish('loopState:exploreActionRepeated', {
          regionName: regionName,
        });
      }
    }

    // Move to next action in the queue or wrap around to beginning
    this.currentActionIndex++;

    // Get updated queue
    const queue = this.getActionQueue();
    
    // Loop to find the next valid, runnable action, skipping checked locations
    while (this.currentActionIndex < queue.length) {
      const nextAction = queue[this.currentActionIndex];

      // Check if it's a locationCheck action for an already checked location
      if (nextAction.type === 'locationCheck') {
        const snapshot = this.stateManager.getLatestStateSnapshot();
        const isChecked = snapshot?.checkedLocations?.includes(nextAction.locationName);
        if (isChecked) {
          //log('info',
          //  `Skipping already checked location: ${nextAction.locationName}.`
          //);
          // Mark as completed since it's already checked
          this.actionQueueManager.markCompleted(nextAction.pathIndex);
          this.actionQueueManager.setProgress(nextAction.pathIndex, 100);

          // Skip to next action
          this.currentActionIndex++;

          // Continue the loop to check the next action at the current index
        } else {
          // Location not checked, this is a valid action
          break;
        }
      } else {
        // Found a valid action to process (not a checkLocation)
        break;
      }
    }

    // If we reached the end of the queue
    if (this.currentActionIndex >= queue.length) {
      // Reset to beginning if auto-restart is enabled
      if (this.autoRestartQueue) {
        this.currentActionIndex = 0;
        this._resetActionsProgress();
      } else {
        // Queue completed — transition to completed state
        this.currentAction = null;
        this.isProcessing = false;
        this.isPaused = false;
        this._queueCompleted = true;
        // Step mode is irrelevant once the queue ends; the completed
        // state already meets "stop after one action".
        this._stepMode = false;
        this.eventBus.publish('loopState:queueCompleted', {});
        this.eventBus.publish('loopState:pauseStateChanged', {
          isPaused: this.isPaused,
          processingState: this.getProcessingState(),
        });
        return;
      }
    }

    // Start processing next action if there's one available
    if (this.currentActionIndex < queue.length) {
      this.currentAction = queue[this.currentActionIndex];
      // Initialize progress for new action if not tracked yet
      if (!this.actionQueueManager.getProgress(this.currentAction.pathIndex)) {
        this.actionQueueManager.setProgress(this.currentAction.pathIndex, 0);
      }
      this.currentAction.progress = this.actionQueueManager.getProgress(this.currentAction.pathIndex);
      this.eventBus.publish('loopState:newActionStarted', {
        action: this.currentAction,
      });
    }

    // Step mode: stop after this single action. Done at the very end
    // so currentActionIndex has already advanced — a follow-up Step
    // (or Resume) picks up from the next action.
    if (this._stepMode) {
      this._pauseAfterStep();
    }
  }

  /**
   * Whether the current action's region can be handled by the DELEGATION
   * solver — one that wants to walk the action tile-by-tile instead of
   * running the queue's flat tick-progress-to-100 model.
   *
   * This is a pure CAPABILITY predicate. Whether delegation actually fires
   * is a question of block MODE, and since M6 exactly one mode answers yes:
   * the Bot branch of _processFrame's dispatch is the only caller that
   * initiates. (Before M6 this predicate carried a "not Manual" exclusion
   * and doubled as the trigger from a pre-dispatch tick — which is how
   * Record and Playback blocks on delegation-capable regions got delegated
   * out from under their own mode.)
   */
  _shouldDelegateCurrentAction() {
    const region = this.currentAction?.sourceRegion;
    if (!region) return false;
    return this.regionSolver(region) === 'delegation';
  }

  /**
   * Substrate-completion handler — called from the loops:substrate-
   * ActionCompleted subscription. Advances the queue when the
   * substrate finished cleanly; stops processing when the substrate
   * was interrupted (typically by an out-of-mana reset that already
   * cleared the path).
   */
  _handleSubstrateActionCompleted(data) {
    if (!this._delegatedAction) return;
    const completed = data?.completed === true;
    this._delegatedAction = null;

    if (!completed) {
      // Reset interrupted the walk. The substrate's _fireLoopReset
      // already cleared the path via gameState.triggerLoopReset; the
      // queue is empty. Stop processing.
      this.stopProcessing();
      // Step mode: reset counts as the step. Land in paused so the
      // user can resume from the (now-cleared) queue position.
      if (this._stepMode) this._pauseAfterStep();
      return;
    }

    // Mark progress 100 and run the normal completion flow. This
    // dispatches loop:moveCompleted / loop:exploreCompleted /
    // user:locationCheck-with-fromLoop:true, advances currentActionIndex
    // (skipping already-checked locations), and either continues the
    // queue or transitions to the queue-completed state.
    if (this.currentAction && this.actionQueueManager) {
      const idx = this.currentAction.pathIndex;
      this.actionQueueManager.setProgress(idx, 100);
      this.currentAction.progress = 100;
    }
    // Phase 6g: signal _applyActionEffects that this regionMove
    // completion came from the substrate (which already dispatched
    // user:regionMove from its onExitCross handler). The non-delegated
    // path needs to dispatch user:regionMove itself to advance the
    // player; the delegated path must not, or we'd double-dispatch.
    this._completedViaDelegation = true;
    try {
      this._completeCurrentAction();
    } finally {
      this._completedViaDelegation = false;
    }

    // Resume animation frame to either tick the next action or hit
    // the queue-completed transition cleanly.
    if (this.isProcessing && !this.isPaused) {
      this._lastFrameTime = null;
      if (this._animationFrameId) {
        cancelAnimationFrame(this._animationFrameId);
      }
      this._animationFrameId = requestAnimationFrame(
        this._processFrame.bind(this),
      );
    }
  }

  /**
   * Apply the effects of completing an action
   * @param {Object} action - The completed action
   */
  _applyActionEffects(action) {
    if (!this.dispatcher) {
      log(
        'warn',
        '[LoopState] Cannot apply action effects: dispatcher dependency missing.'
      );
      return;
    }

    switch (action.type) {
      case 'customAction':
        // Publish event for discovery module via dispatcher. fromLoop
        // marks it as queue execution: loops itself receives this event
        // first (M3b explore gate/observation receiver, initialTarget
        // 'bottom' → highest load priority first) and must pass its own
        // dispatches through without gating or re-charging them.
        this.dispatcher.publish('loop:exploreCompleted', {
          regionName: action.sourceRegion,
          fromLoop: true,
        });
        break;
      case 'locationCheck':
        // Propagate user:locationCheck through the normal dispatcher chain
        // (discovery → gameState → stateManager), the same way it flows
        // when loop mode is inactive. The fromLoop flag tells gameState
        // to skip adding a duplicate path entry since the loop already
        // added it when the queue was built.
        this.dispatcher.publishToNextModule('loops', 'user:locationCheck', {
          locationName: action.locationName,
          regionName: action.sourceRegion,
          fromLoop: true,
        }, { direction: 'up' });
        break;
      case 'regionMove':
        // Publish event for discovery module via dispatcher
        this.dispatcher.publish('loop:moveCompleted', {
          sourceRegion: action.sourceRegion,
          destinationRegion: action.destinationRegion,
          exitName: action.exitUsed,
        });
        // Phase 6g: when this regionMove was NOT delegated to a
        // substrate (e.g. Menu's synthetic-wrapper hop, the
        // text-adventure substrate, or any region without manaEnabled),
        // the queue is responsible for actually advancing the player.
        // Use dispatcher.publish (initialTarget: 'bottom') so the chain
        // visits procgenPlayer first (it sits at a higher load
        // priority than loops, so publishToNextModule with
        // direction:'up' would miss it) — procgenPlayer.handleRegionMove
        // is what publishes the destination's substrate <kind>:loadRegion
        // event. Without that, the substrate panel never adopts the new
        // region. fromLoop:true tells gameState to skip a duplicate path
        // entry (the queue already enqueued the original).
        //
        // For delegated completions, the substrate panel's onExitCross
        // already dispatched user:regionMove with fromLoop:true — skip
        // here to avoid double-dispatch.
        if (!this._completedViaDelegation) {
          this.dispatcher.publish('user:regionMove', {
            sourceRegion: action.sourceRegion,
            targetRegion: action.destinationRegion,
            exitName: action.exitUsed,
            fromLoop: true,
          }, { initialTarget: 'bottom' });
        }
        break;
    }
  }

  /**
   * The pre-XP base cost of one action in a SUMMARY substrate's region
   * (M5). Time is the default economy: a second of live play costs the
   * region's drain rate, and everything else is FREE unless the loop_costs
   * data names a cost for it explicitly.
   *
   * @param {Object} action - {type, sourceRegion, locationName?}
   * @returns {number} base mana cost (0 when the data states none)
   */
  _summaryBaseCost(action) {
    const cdm = this.costDataManager;
    const region = action.sourceRegion;
    switch (action.type) {
      case 'timeDrain':
        return cdm?.getTimeDrainPerSecond?.(region) ?? DEFAULT_TIME_DRAIN_PER_SECOND;
      case 'regionMove':
        return cdm?.getExplicitRegionCost?.(region) ?? 0;
      case 'locationCheck':
        return cdm?.getExplicitLocationCost?.(action.locationName) ?? 0;
      case 'customAction': {
        // Explore is 2× the move cost where one exists (matching the
        // generic model); neither runner nor bounce declares the action.
        const move = cdm?.getExplicitRegionCost?.(region);
        return typeof move === 'number' ? move * 2 : 0;
      }
      default:
        return 0;
    }
  }

  /**
   * Calculate the mana cost of an action.
   * Uses per-region/per-location costs from costDataManager when available,
   * falling back to hardcoded defaults.
   * @param {Object} action - The action
   * @returns {number} - Mana cost
   */
  _calculateActionCost(action) {
    let baseCost;

    // M5: SUMMARY substrates (runner, bounce) are priced by TIME. Their
    // per-action costs apply only where the loop_costs data states one
    // EXPLICITLY (user ruling 2026-07-23) — the 50/100 fallbacks below,
    // and the sidecar-level defaults behind them, must never reach a
    // summary action, or every visit would be charged twice.
    if (action?.sourceRegion && this._captureShapeForRegion(action.sourceRegion) === 'summary') {
      baseCost = this._summaryBaseCost(action);
      return applyRegionXpCostEffect(
        baseCost,
        this.getRegionXP(action.sourceRegion).level,
        this.costDataManager?.getRegionXpEffect?.(action.sourceRegion),
      );
    }

    if (this.costDataManager?.isLoaded()) {
      // Use per-region/per-location costs from cost data
      switch (action.type) {
        case 'regionMove':
          // Move cost = source region's moveCost
          baseCost = this.costDataManager.getRegionCost(action.sourceRegion);
          break;
        case 'locationCheck':
          // Location check cost = per-location cost
          baseCost = this.costDataManager.getLocationCost(action.locationName);
          break;
        case 'customAction':
          // Explore cost = 2x region's moveCost
          baseCost = this.costDataManager.getRegionCost(action.sourceRegion) * 2;
          break;
        case 'manual':
        case 'customQueue':
          // Manual / customQueue entries park the queue and let the
          // substrate (player or replayed actions) drive directly.
          // No queue-side mana cost — the substrate's own actions
          // consume mana as they run.
          baseCost = 0;
          break;
        case 'timeDrain':
          // Only the summary branch above produces these; a stray one on
          // any other substrate is free, never the 50 default.
          baseCost = 0;
          break;
        default:
          baseCost = 50;
      }
    } else {
      // Fallback to hardcoded defaults when no cost data is loaded
      switch (action.type) {
        case 'customAction':
          baseCost = 50;
          break;
        case 'locationCheck':
          baseCost = 100;
          break;
        case 'regionMove':
          baseCost = 50;
          break;
        case 'manual':
        case 'customQueue':
        case 'timeDrain':
          baseCost = 0;
          break;
        default:
          baseCost = 50;
      }
    }

    // Apply region XP reduction if applicable, gated by the per-region
    // xpEffect from the loop_costs sidecar (defaults to 'cost').
    if (action.sourceRegion) {
      const xpData = this.getRegionXP(action.sourceRegion);
      const effect = this.costDataManager?.getRegionXpEffect?.(action.sourceRegion);
      return applyRegionXpCostEffect(baseCost, xpData.level, effect);
    }

    return baseCost;
  }

  /**
   * Reset progress for all actions in the queue
   * Also resets currentActionIndex so next startProcessing() starts fresh
   */
  _resetActionsProgress() {
    if (!this.actionQueueManager) return;
    // Clear all progress tracking
    this.actionQueueManager.resetProgress();
    // Reset current action index so startProcessing() starts from the beginning
    this.currentActionIndex = 0;
    this.currentAction = null;
  }

  /**
   * Full reset for when new rules/preset are loaded.
   * Unlike _resetLoop() which just resets mana and action progress for a loop iteration,
   * this clears all accumulated state (XP, explore states, etc.) that is preset-specific.
   */
  resetForNewRules() {
    // Stop any active processing
    this.stopProcessing();

    // Mana/XP are now reset by gameState.reset() (called via the same
    // stateManager:rulesLoaded handler chain). Just clear loop-specific state.
    this.repeatExploreStates.clear();
    this.manualRegionStates.clear();
    this.blockModeStates.clear();
    this.blockInstantStates.clear();
    this._manualRegionName = null;
    this._manualActionEntered = false;
    this._delegatedAction = null;
    // The wrong-region hard-pause must not survive a WORLD change — and
    // it can be freshly set by the rules switch itself: gameState.reset()
    // fires regionChanged (→ Menu) into a still-parked wake, which reads
    // as a wrong-exit mismatch. gameState's rulesLoaded handler runs
    // before ours (lower load priority), so clearing here wins.
    this._queuePausedUntilReset = false;
    // Any in-progress Record capture belongs to the old world.
    this._discardActiveRecording();

    // Reset action progress
    this._resetActionsProgress();

    // Reset to idle (not paused, not processing, not completed)
    this.isPaused = false;
    this._queueCompleted = false;

    // Notify about the reset.
    if (this.eventBus) {
      const gs = this._gs();
      this.eventBus.publish('loopState:loopReset', {
        mana: {
          current: gs ? gs.currentMana : 100,
          max: gs ? gs.maxMana : 100,
        },
        paused: true,
      });
    }
  }

  /**
   * Reset the loop: refill mana, reset action progress, reset to first action.
   * Does NOT modify pause state — the caller decides whether to pause or continue.
   */
  _resetLoop() {
    // Stop an in-flight bot walk — the reset teleports the player to
    // the start region; a bot still steering toward a stale target
    // would fight the fresh loop.
    this._stopBotExecutedAction();

    // Restore mana to full via gameState (fires gameState:manaChanged).
    const gs = this._gs();
    if (gs) gs.refillMana();

    // Reset action progress tracking
    this._resetActionsProgress();

    // Reset to first action
    const queue = this.getActionQueue();
    this.currentActionIndex = 0;
    this.currentAction = queue.length > 0 ? queue[0] : null;
    this._queueCompleted = false;
    // Clear manual-mode flags: a fresh loop starts at index 0, and
    // any prior "paused-until-reset" condition is the user's signal
    // that this reset is the unlock. The per-region manual CHECKBOX
    // states (manualRegionStates) deliberately survive — matching
    // resumes from the top with the checkboxes intact.
    this._manualActionEntered = false;
    this._manualRegionName = null;
    this._queuePausedUntilReset = false;
    // A Record in progress at reset (mana-out mid-record) is discarded.
    this._discardActiveRecording();
    this._boundReplayCheckedIndex = -1;

    // Notify loop reset
    this.eventBus.publish('loopState:loopReset', {
      mana: {
        current: gs ? gs.currentMana : 100,
        max: gs ? gs.maxMana : 100,
      },
    });
  }

  /**
   * Set auto-restart mode for the queue
   * @param {boolean} autoRestart - Whether to auto-restart the queue
   */
  setAutoRestartQueue(autoRestart) {
    this.autoRestartQueue = autoRestart;
    this.eventBus.publish('loopState:autoRestartChanged', {
      autoRestart: this.autoRestartQueue,
    });
  }

  /**
   * Set auto-resume on new action mode.
   * When enabled, the queue automatically resumes from where it left off
   * when a new action is added after the queue has completed.
   * @param {boolean} autoResume - Whether to enable auto-resume
   */
  setAutoResumeOnNewAction(autoResume) {
    this.autoResumeOnNewAction = autoResume;
  }

  /**
   * Set auto-remove completed actions mode.
   * When enabled, completed actions are automatically removed from the queue:
   * - locationCheck actions for already-checked locations
   * - explore actions for fully-explored regions (all locations discovered)
   * @param {boolean} enabled - Whether to enable auto-removal
   */
  setAutoRemoveCompleted(enabled) {
    this.autoRemoveCompleted = enabled;
    if (enabled) {
      this.removeCompletedActions();
    }
  }

  /**
   * Remove completed actions from the queue.
   * Removes locationCheck actions for already-checked locations,
   * and explore actions for fully-explored regions (all locations and exits discovered).
   */
  removeCompletedActions() {
    if (!this.actionQueueManager) return;

    const queue = this.getActionQueue();
    if (queue.length === 0) return;

    const snapshot = this.stateManager?.getLatestStateSnapshot();
    const staticData = this.stateManager?.getStaticData();
    const checkedLocations = snapshot?.checkedLocations || [];

    // Collect indices to remove (in reverse order to avoid index shifting)
    const indicesToRemove = [];

    for (let i = queue.length - 1; i >= 0; i--) {
      const action = queue[i];

      // Skip the currently processing action
      if (i === this.currentActionIndex && this.isProcessing) continue;

      if (action.type === 'locationCheck') {
        if (checkedLocations.includes(action.locationName)) {
          indicesToRemove.push(i);
        }
      } else if (action.type === 'customAction' && action.actionName === 'explore') {
        if (this._isRegionFullyExplored(action.sourceRegion, staticData)) {
          indicesToRemove.push(i);
        }
      }
    }

    if (indicesToRemove.length === 0) return;

    log('info', `[LoopState] Auto-removing ${indicesToRemove.length} completed actions`);

    // Remove in reverse order (indices are already sorted descending)
    for (const index of indicesToRemove) {
      this.removeAction(index);
    }
  }

  /**
   * Check if a region is fully explored (all locations and exits discovered).
   * @param {string} regionName - The region name
   * @param {Object} [staticData] - Static data (optional, will be fetched if not provided)
   * @returns {boolean} True if the region has nothing left to discover
   * @private
   */
  _isRegionFullyExplored(regionName, staticData) {
    if (!staticData) staticData = this.stateManager?.getStaticData();
    const regionData = staticData?.regions?.get(regionName);
    if (!regionData) return false;

    const locations = regionData.locations || [];
    const exits = regionData.exits || [];

    // A region with nothing to discover is not considered "fully explored"
    // (it was never explorable in the first place)
    if (locations.length === 0 && exits.length === 0) return false;

    const allLocationsDiscovered = locations.every(loc =>
      discoveryStateSingleton.isLocationDiscovered(loc.name)
    );
    const allExitsDiscovered = exits.every(exit =>
      discoveryStateSingleton.isExitDiscovered(regionName, exit.name)
    );

    return allLocationsDiscovered && allExitsDiscovered;
  }

  /**
   * Disable repeat-explore for any regions that are now fully explored.
   * Safe to call during queue processing since it only modifies the
   * repeatExploreStates map, not the queue itself.
   */
  disableRepeatForExploredRegions() {
    const staticData = this.stateManager?.getStaticData();
    for (const [regionName, repeat] of this.repeatExploreStates) {
      if (repeat && this._isRegionFullyExplored(regionName, staticData)) {
        this.repeatExploreStates.set(regionName, false);
        log('info', `[LoopState] Disabled repeat-explore for fully explored region: ${regionName}`);
      }
    }
  }

  /**
   * Restart the queue from the beginning
   */
  restartQueue() {
    // Don't restart if paused or already processing
    if (this.isPaused) {
      return;
    }

    // Stop current processing if active
    if (this.isProcessing) {
      this.stopProcessing();
    }

    // Reset action index to beginning
    this.currentActionIndex = 0;

    // Reset progress on all actions
    this._resetActionsProgress();

    // Get queue from gameState
    const queue = this.getActionQueue();

    // Start processing if there are actions
    if (queue.length > 0) {
      this.startProcessing();
    }
  }

  /**
   * Restart the queue from index 0. Refills mana, resets action
   * progress, snaps to the first action, clears _queueCompleted, then
   * either auto-starts processing or lands paused based on autoStart.
   *
   * Distinct from:
   *   - clearQueue() — clears the path (including regionMoves) and
   *     teleports the player to the resolved loop start (heavier
   *     "back to scratch"); does not preserve queue state.
   *   - _resetLoop() — internal mutation primitive (mana refill,
   *     progress reset, index 0); used here and by the OOM reset path.
   *
   * @param {Object} [options]
   * @param {boolean} [options.autoStart=true] - When true, unpauses
   *   and starts processing if the queue is non-empty (Restart button
   *   semantics). When false, lands paused — used by the Step button's
   *   Reset variant in completed/waiting state.
   */
  restartFromStart({ autoStart = true } = {}) {
    if (this.isProcessing) {
      this.stopProcessing();
    }

    this._resetLoop();

    // _resetLoop publishes loopState:loopReset (which refreshes mana
    // and progress-bar DOM), but the action-item rendering (cost/index
    // labels) refreshes on queueUpdated. Publish that too so the UI
    // doesn't need manual DOM patch-up at every caller.
    this.eventBus.publish('loopState:queueUpdated', {
      queue: this.getActionQueue(),
    });

    if (autoStart) {
      // "Restart" semantics: the user said go. Unpause and run.
      this.isPaused = false;
      if (this.getActionQueue().length > 0) {
        this.startProcessing(); // publishes pauseStateChanged
      } else {
        this.eventBus.publish('loopState:pauseStateChanged', {
          isPaused: this.isPaused,
          processingState: this.getProcessingState(),
        });
      }
    } else {
      // "Reset" semantics: return to start, don't run. Land paused.
      this.isPaused = true;
      this.eventBus.publish('loopState:pauseStateChanged', {
        isPaused: this.isPaused,
        processingState: this.getProcessingState(),
      });
    }
  }

  /**
   * Set the repeat state for exploring a region.
   * @param {string} regionName
   * @param {boolean} repeat
   */
  /**
   * Per-region manual checkbox state. Flagged regions are played by
   * hand when the queue cursor reaches them (loopBlockBuilder renders
   * the checkbox). Survives loop resets; cleared by resetForNewRules
   * like repeatExploreStates.
   */
  setManualRegion(regionName, enabled) {
    if (!regionName) return;
    if (enabled) this.manualRegionStates.set(regionName, true);
    else this.manualRegionStates.delete(regionName);
  }

  /** Whether the region's Manual checkbox is on. */
  getManualRegion(regionName) {
    return this.manualRegionStates.get(regionName) || false;
  }

  setRepeatExplore(regionName, repeat) {
    this.repeatExploreStates.set(regionName, repeat);
    // Optionally save this state? For now, it's ephemeral.
  }

  /**
   * Get the repeat state for exploring a region.
   * @param {string} regionName
   * @returns {boolean}
   */
  getRepeatExplore(regionName) {
    return this.repeatExploreStates.get(regionName) || false;
  }

  /**
   * Get a serializable state object for saving
   * @returns {Object} - Serializable state
   */
  getSerializableState() {
    const queueState = this.actionQueueManager ? this.actionQueueManager.getState() : {
      actionProgress: [],
      actionCompleted: []
    };

    const gs = this._gs();
    return {
      // Don't save maxMana as it should be calculated dynamically based on inventory
      currentMana: gs ? gs.currentMana : 100,
      regionXP: gs ? Array.from(gs.regionXP.entries()) : [],
      gameSpeed: this.gameSpeed,
      autoRestartQueue: this.autoRestartQueue,
      // Save progress tracking from ActionQueueManager
      actionProgress: queueState.actionProgress,
      actionCompleted: queueState.actionCompleted,
      currentActionIndex: this.currentActionIndex,
      repeatExploreStates: Array.from(this.repeatExploreStates.entries()),
      // blockModeStates is the per-block mode map. manualRegionStates is
      // retained alongside it as a lossless read-side fallback for saves
      // written before the mode system existed (and blocks whose mode is
      // still region-inherited) — see loadFromSerializedState.
      blockModeStates: Array.from(this.blockModeStates.entries()),
      // Per-block Instant flags (M3), keyed like blockModeStates. Only
      // truthy entries are stored, so old saves simply carry none.
      blockInstantStates: Array.from(this.blockInstantStates.entries()),
      manualRegionStates: Array.from(this.manualRegionStates.entries()),
    };
  }

  /**
   * Load state from a serialized object
   * @param {Object} state - Serialized state
   */
  loadFromSerializedState(state) {
    if (!state) return;

    const gs = this._gs();
    // Load current mana, cap at a reasonable default if needed (e.g., 100) until snapshot arrives
    if (gs) gs.currentMana = state.currentMana ?? 100;

    // Load region XP
    if (gs) gs.regionXP = new Map(state.regionXP || []);

    // Load game speed
    this.gameSpeed = state.gameSpeed ?? 100;

    // Load auto-restart setting
    this.autoRestartQueue = state.autoRestartQueue ?? false;

    // Load progress tracking into ActionQueueManager
    if (this.actionQueueManager && (state.actionProgress || state.actionCompleted)) {
      this.actionQueueManager.loadState({
        actionProgress: state.actionProgress,
        actionCompleted: state.actionCompleted
      });
    }
    this.currentActionIndex = state.currentActionIndex ?? 0;

    // Load repeatExploreStates + per-block modes. manualRegionStates is
    // the legacy region-level fallback: an old save has only it (no
    // blockModeStates), and getBlockMode falls through to it region-wide
    // → every block of a formerly-checked region resolves to 'manual',
    // exactly the migration the design calls for. New per-block choices
    // land in blockModeStates and win per key.
    this.repeatExploreStates = new Map(state.repeatExploreStates || []);
    this.blockModeStates = new Map(state.blockModeStates || []);
    this.blockInstantStates = new Map(state.blockInstantStates || []);
    this.manualRegionStates = new Map(state.manualRegionStates || []);

    // Notify mana/xp change so consumers reflect the loaded values
    // (the delegated setters above are silent by design).
    if (gs) gs.emitManaChanged();

    // Notify state loaded
    if (this.eventBus) {
      this.eventBus.publish('loopState:stateLoaded', {});
    } else {
      log(
        'warn',
        '[LoopState] EventBus not available during loadFromSerializedState to publish stateLoaded event.'
      );
    }
  }

  /**
   * Save state to localStorage
   */
  saveToStorage() {
    try {
      const serializedState = this.getSerializableState();
      localStorage.setItem(
        'archipelago_loop_state',
        JSON.stringify(serializedState)
      );
    } catch (error) {
      log('error', 'Failed to save loop state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  loadFromStorage() {
    try {
      const savedState = localStorage.getItem('archipelago_loop_state');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        this.loadFromSerializedState(parsedState);
        return true;
      }
    } catch (error) {
      log('error', 'Failed to load loop state:', error);
    }
    return false;
  }

  /**
   * Set up auto-save timer
   */
  _setupAutoSave() {
    // Clear any existing interval
    if (this._saveIntervalId) {
      clearInterval(this._saveIntervalId);
    }

    // Save every minute
    this._saveIntervalId = setInterval(() => {
      this.saveToStorage();
    }, 60000);
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Cancel animation frame
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    // Clear auto-save interval
    if (this._saveIntervalId) {
      clearInterval(this._saveIntervalId);
      this._saveIntervalId = null;
    }
  }
}
