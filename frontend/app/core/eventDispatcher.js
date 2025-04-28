// frontend/app/core/eventDispatcher.js

/**
 * Manages event handling based on module load priority.
 * Allows prioritized handling and explicit propagation down the priority chain.
 */
class EventDispatcher {
  /**
   * Constructs the EventDispatcher.
   * @param {function(): Map<string, Array<{moduleId: string, handlerFunction: Function}>>} getHandlersFunc - Function to get the current map of registered event handlers.
   * @param {function(): Array<string>} getLoadPriorityFunc - Function to get the current load priority array.
   * @param {function(string): boolean} isModuleEnabledFunc - Function to check if a module is currently enabled by its ID.
   */
  constructor(getHandlersFunc, getLoadPriorityFunc, isModuleEnabledFunc) {
    if (typeof getHandlersFunc !== 'function') {
      throw new Error(
        'EventDispatcher: getHandlersFunc is required and must be a function.'
      );
    }
    if (typeof getLoadPriorityFunc !== 'function') {
      throw new Error(
        'EventDispatcher: getLoadPriorityFunc is required and must be a function.'
      );
    }
    if (typeof isModuleEnabledFunc !== 'function') {
      throw new Error(
        'EventDispatcher: isModuleEnabledFunc is required and must be a function.'
      );
    }

    // Store the functions to retrieve dynamic data
    this.getHandlers = getHandlersFunc;
    this.getLoadPriority = getLoadPriorityFunc;
    this.isModuleEnabled = isModuleEnabledFunc;

    console.log('EventDispatcher instance created (dynamic data fetching).');
  }

  /**
   * Helper to get priority index on the fly.
   * @param {string} moduleId
   * @returns {number} Priority index or -1 if not found.
   */
  _getPriorityIndex(moduleId) {
    const loadPriority = this.getLoadPriority();
    return loadPriority.indexOf(moduleId);
  }

  /**
   * Publishes an event to the highest (or lowest) priority enabled module that handles it.
   * @param {string} eventName - The name of the event to publish.
   * @param {any} data - The data payload associated with the event.
   * @param {object} [options={}] - Optional parameters.
   * @param {'highestFirst'|'lowestFirst'} [options.direction='highestFirst'] - Order to check handlers.
   */
  publish(eventName, data, options = {}) {
    const { direction = 'highestFirst' } = options;

    const allHandlers = this.getHandlers(); // Get current handlers
    const potentialHandlers = allHandlers.get(eventName) || [];

    if (potentialHandlers.length === 0) {
      return; // No handlers registered for this event
    }

    // Filter for enabled modules and sort by priority
    const eligibleHandlers = potentialHandlers
      .filter((entry) => this.isModuleEnabled(entry.moduleId)) // Use checker function
      .sort((a, b) => {
        const priorityA = this._getPriorityIndex(a.moduleId); // Get current priority
        const priorityB = this._getPriorityIndex(b.moduleId);

        // Handle cases where module might not be in priority list (e.g., async loading issues)
        if (priorityA === -1) return 1; // Put unknowns last
        if (priorityB === -1) return -1;

        // Descending order for highestFirst (default), Ascending for lowestFirst
        return direction === 'lowestFirst'
          ? priorityA - priorityB
          : priorityB - priorityA;
      });

    if (eligibleHandlers.length === 0) {
      return; // No enabled modules handle this event
    }

    // Get the first handler based on the sorted order
    const handlerEntry = eligibleHandlers[0];

    console.log(
      `[Dispatcher] Dispatching ${eventName} to module: ${handlerEntry.moduleId} (Direction: ${direction})`
    );
    try {
      // Execute the handler
      // Ensure the handler function reference is correct
      if (typeof handlerEntry.handlerFunction === 'function') {
        handlerEntry.handlerFunction(data);
      } else {
        console.error(
          `[Dispatcher] Invalid handlerFunction found for ${eventName} in module ${handlerEntry.moduleId}`
        );
      }
    } catch (error) {
      console.error(
        `[Dispatcher] Error executing handler for event "${eventName}" in module "${handlerEntry.moduleId}":`,
        error
      );
    }
  }

  /**
   * Publishes an event to the next-highest priority enabled module *before* the origin module.
   * This is intended to be called *by* a module's event handler to propagate the event down the chain.
   * Note: The direction is implicitly 'highestFirst' among predecessors.
   * @param {string} originModuleId - The ID of the module calling this function.
   * @param {string} eventName - The name of the event to publish.
   * @param {any} data - The data payload associated with the event.
   */
  publishToPredecessors(originModuleId, eventName, data) {
    const originPriority = this._getPriorityIndex(originModuleId); // Get current priority

    if (originPriority === -1) {
      console.warn(
        `[Dispatcher] publishToPredecessors called by module not in current priority list: ${originModuleId}`
      );
      return;
    }

    const allHandlers = this.getHandlers(); // Get current handlers
    const potentialHandlers = allHandlers.get(eventName) || [];
    if (potentialHandlers.length === 0) {
      return; // No handlers registered for this event
    }

    // Filter for enabled modules loaded *before* the origin module, then sort by highest priority first
    const eligiblePredecessors = potentialHandlers
      .filter((entry) => {
        const entryPriority = this._getPriorityIndex(entry.moduleId); // Get current priority
        return (
          this.isModuleEnabled(entry.moduleId) && // Use checker function
          entryPriority !== -1 &&
          entryPriority < originPriority // Only modules loaded BEFORE the origin
        );
      })
      .sort((a, b) => {
        const priorityA = this._getPriorityIndex(a.moduleId);
        const priorityB = this._getPriorityIndex(b.moduleId);
        // Handle unknowns just in case, although filter should prevent -1 here
        if (priorityA === -1) return 1;
        if (priorityB === -1) return -1;
        return priorityB - priorityA; // Descending order (highest priority first)
      });

    if (eligiblePredecessors.length === 0) {
      return; // No preceding enabled modules handle this event
    }

    // Get the highest priority predecessor handler
    const handlerEntry = eligiblePredecessors[0];

    console.log(
      `[Dispatcher] Dispatching ${eventName} (predecessor) to module: ${handlerEntry.moduleId}`
    );
    try {
      // Execute the handler
      if (typeof handlerEntry.handlerFunction === 'function') {
        handlerEntry.handlerFunction(data);
      } else {
        console.error(
          `[Dispatcher] Invalid predecessor handlerFunction found for ${eventName} in module ${handlerEntry.moduleId}`
        );
      }
    } catch (error) {
      console.error(
        `[Dispatcher] Error executing predecessor handler for event "${eventName}" in module "${handlerEntry.moduleId}":`,
        error
      );
    }
  }
}

// Export the class, not an instance
export default EventDispatcher;
