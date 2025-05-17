// frontend/modules/timer/timerLogic.js
import { Config } from '../client/core/config.js'; // Assuming Config might be needed for defaults
import { createStateSnapshotInterface } from '../stateManager/stateManagerProxy.js'; // For evaluating rules

export class TimerLogic {
  constructor(dependencies) {
    if (
      !dependencies ||
      !dependencies.stateManager ||
      !dependencies.eventBus ||
      !dependencies.dispatcher
    ) {
      throw new Error(
        '[TimerLogic] Missing required dependencies (stateManager, eventBus, dispatcher).'
      );
    }
    this.stateManager = dependencies.stateManager; // This is stateManagerProxySingleton
    this.eventBus = dependencies.eventBus;
    this.dispatcher = dependencies.dispatcher;

    this.minCheckDelay = 30; // Default minimum delay in seconds
    this.maxCheckDelay = 60; // Default maximum delay in seconds
    this.gameInterval = null;
    this.startTime = 0;
    this.endTime = 0;
    this.isLoopModeActive = false; // Internal state to track loop mode for pausing timer
    this.unsubscribeHandles = [];

    console.log('[TimerLogic] Instance created.');
  }

  initialize() {
    console.log('[TimerLogic] Initializing...');
    this.stop(); // Ensure timer is stopped initially
    // TODO: Load minCheckDelay/maxCheckDelay from settings if they become configurable
    // For now, using defaults.

    // Subscribe to loop:modeChanged to pause/resume the timer
    const loopModeHandler = (data) => {
      this.isLoopModeActive = data.active;
      if (this.isLoopModeActive && this.isRunning()) {
        console.log('[TimerLogic] Loop mode activated, pausing timer.');
        this.stop(); // Stop the timer, but don't reset its visual progress entirely (UI might keep last state)
        // Or, we can let the UI clear the progress bar via timer:stopped event.
      } else if (!this.isLoopModeActive && !this.isRunning()) {
        // Potentially auto-restart timer if it was paused due to loop mode.
        // This might need more nuanced logic (e.g., only restart if it was running before loop mode)
        // For now, loop mode exiting doesn't auto-restart the timer. User has to click "Begin!" again.
        console.log('[TimerLogic] Loop mode deactivated.');
      }
    };
    const unsubLoopMode = this.eventBus.subscribe(
      'loop:modeChanged',
      loopModeHandler
    );
    this.unsubscribeHandles.push(unsubLoopMode);

    // TODO: Add listener for settings:changed if delays become configurable
  }

  isRunning() {
    return this.gameInterval !== null;
  }

  begin() {
    if (this.isLoopModeActive) {
      console.log('[TimerLogic] Cannot start timer, Loop Mode is active.');
      this.eventBus.publish('ui:notification', {
        message: 'Timer disabled while Loop Mode is active.',
        type: 'warn',
      });
      return;
    }

    if (this.isRunning()) {
      this.stop();
      return;
    }

    const rangeMs = (this.maxCheckDelay - this.minCheckDelay) * 1000;
    const baseMs = this.minCheckDelay * 1000;
    const initialDelay = Math.floor(Math.random() * rangeMs + baseMs);

    this.startTime = Date.now();
    this.endTime = this.startTime + initialDelay;

    this.eventBus.publish('timer:started', {
      startTime: this.startTime,
      endTime: this.endTime,
    });
    this.eventBus.publish('timer:progressUpdate', {
      value: 0,
      max: this.endTime - this.startTime,
    });

    this.gameInterval = setInterval(async () => {
      if (this.isLoopModeActive) {
        // Double check in case mode changes during interval
        this.stop();
        return;
      }

      const currentTime = Date.now();
      const elapsed = currentTime - this.startTime;
      const totalDuration = this.endTime - this.startTime;

      this.eventBus.publish('timer:progressUpdate', {
        value: elapsed,
        max: totalDuration,
      });

      if (currentTime >= this.endTime) {
        const checkDispatched =
          await this._determineAndDispatchNextLocationCheck();
        // TODO: Add gameComplete check if that state is managed elsewhere
        if (!checkDispatched /* || this.gameComplete */) {
          this.stop();
        } else {
          const nextDelay = Math.floor(Math.random() * rangeMs + baseMs);
          this.startTime = Date.now();
          this.endTime = this.startTime + nextDelay;
          this.eventBus.publish('timer:started', {
            startTime: this.startTime,
            endTime: this.endTime,
          });
          this.eventBus.publish('timer:progressUpdate', {
            value: 0,
            max: this.endTime - this.startTime,
          });
        }
      }
    }, Config.TIMER_INTERVAL_MS || 200); // Check more frequently for smoother bar

    console.log('[TimerLogic] Timer started.');
  }

  stop() {
    if (!this.isRunning()) {
      return;
    }
    clearInterval(this.gameInterval);
    this.gameInterval = null;
    const lastStartTime = this.startTime; // Keep for potential UI update
    const lastEndTime = this.endTime;
    this.startTime = 0;
    this.endTime = 0;

    this.eventBus.publish('timer:stopped', {});
    // Publish a final progress update to reset the bar visually
    this.eventBus.publish('timer:progressUpdate', {
      value: 0,
      max: lastEndTime - lastStartTime || 1,
    });
    console.log('[TimerLogic] Timer stopped.');
  }

  async _determineAndDispatchNextLocationCheck() {
    console.log('[TimerLogic] Determining next location to check...');
    if (!this.stateManager) {
      console.error('[TimerLogic] StateManager not available.');
      return false;
    }

    try {
      await this.stateManager.ensureReady(); // Ensure snapshot/static data is loaded in proxy
      const snapshot = this.stateManager.getSnapshot();
      const staticData = this.stateManager.getStaticData();

      if (!snapshot || !staticData || !staticData.locations) {
        console.warn(
          '[TimerLogic] Snapshot or static location data not available for checking.'
        );
        return false;
      }

      const snapshotInterface = createStateSnapshotInterface(
        snapshot,
        staticData
      );
      if (!snapshotInterface) {
        console.error('[TimerLogic] Failed to create snapshotInterface.');
        return false;
      }

      // Find the first reachable and unchecked location
      // The order of locations in staticData.locations might matter here if "original" order is desired.
      // Otherwise, .find() will get the first match based on current array order.
      const locationsArray = Array.isArray(staticData.locations)
        ? staticData.locations
        : Object.values(staticData.locations);

      let locationToCheck = null;
      for (const loc of locationsArray) {
        const isChecked = snapshot.flags?.includes(loc.name);
        if (isChecked) continue;

        // Evaluate accessibility using the snapshotInterface
        let isAccessible = false;
        if (loc.access_rule) {
          isAccessible = snapshotInterface.evaluateRule(loc.access_rule);
        } else {
          isAccessible = true; // No rule means accessible if region is
        }

        // Also check parent region's reachability
        const parentRegionName = loc.parent_region || loc.region;
        const isParentRegionReachable = parentRegionName
          ? snapshotInterface.isRegionReachable(parentRegionName)
          : true;

        if (isAccessible && isParentRegionReachable) {
          locationToCheck = loc;
          break;
        }
      }

      if (locationToCheck) {
        console.log(
          `[TimerLogic] Found location to check: ${locationToCheck.name}`
        );
        this.dispatcher.publish(
          'user:locationCheck',
          {
            locationName: locationToCheck.name,
            regionName: locationToCheck.region || locationToCheck.parent_region, // Pass region context
            originator: 'TimerModule',
            originalDOMEvent: false,
          },
          { direction: 'bottom' }
        );
        return true; // Check was dispatched
      } else {
        console.log('[TimerLogic] No reachable and unchecked locations found.');
        // Potentially publish an event like 'timer:noLocationsToAutoCheck'
        this.eventBus.publish('ui:notification', {
          message: 'All available locations checked by timer.',
          type: 'info',
        });
        return false; // No location found/dispatched
      }
    } catch (error) {
      console.error(
        '[TimerLogic] Error in _determineAndDispatchNextLocationCheck:',
        error
      );
      return false;
    }
  }

  async determineAndDispatchQuickCheck() {
    console.log('[TimerLogic] Quick Check initiated.');
    if (this.isLoopModeActive) {
      console.log(
        '[TimerLogic] Quick Check in Loop Mode - Loop module should handle this via user:locationCheck event.'
      );
      // In loop mode, the "Quick Check" effectively asks the loop system to do something smart.
      // We can dispatch "user:locationCheck" without a specific locationName,
      // and the Loops module's handler can interpret this as "find next logical action for loop".
      this.dispatcher.publish(
        'user:locationCheck',
        {
          locationName: null, // Explicitly null for "next logical"
          originator: 'QuickCheckButton',
          originalDOMEvent: true,
        },
        { direction: 'bottom' }
      );
      return;
    }

    // Standard mode: find and dispatch check for one location
    const checkDispatched = await this._determineAndDispatchNextLocationCheck(); // Reuses the same logic as timer expiry
    if (!checkDispatched) {
      this.eventBus.publish('ui:notification', {
        message: 'No locations available for Quick Check.',
        type: 'info',
      });
    }
  }

  setCheckDelay(minSeconds, maxSeconds = null) {
    if (maxSeconds === null) maxSeconds = minSeconds;

    if (
      typeof minSeconds !== 'number' ||
      minSeconds < 1 ||
      typeof maxSeconds !== 'number' ||
      maxSeconds < 1
    ) {
      console.warn('[TimerLogic] Invalid delay values. Must be numbers >= 1.');
      return false;
    }
    if (minSeconds > maxSeconds) {
      [minSeconds, maxSeconds] = [maxSeconds, minSeconds];
    }

    this.minCheckDelay = minSeconds;
    this.maxCheckDelay = maxSeconds;
    console.log(
      `[TimerLogic] Check delay set to ${this.minCheckDelay}-${this.maxCheckDelay} seconds.`
    );

    // If timer is running, update its current cycle (optional, or let it finish current cycle)
    // For simplicity, we'll let the current cycle finish with old delay.
    // Next cycle after a check will use new delay.
    return true;
  }

  dispose() {
    console.log('[TimerLogic] Disposing...');
    this.stop();
    this.unsubscribeHandles.forEach((unsub) => unsub());
    this.unsubscribeHandles = [];
  }
}
