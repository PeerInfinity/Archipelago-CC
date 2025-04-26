// frontend/app/core/eventDispatcher.js

/**
 * Manages event handling based on module load priority.
 * Allows prioritized handling and explicit propagation down the priority chain.
 */
class EventDispatcher {
  constructor() {
    // Stores handlers: Map<eventName, Array<{moduleId, handlerFunction}>>
    this.handlers = new Map();

    // Stores data loaded from modules.json
    this.moduleData = {
      definitions: {}, // { moduleId: { path, description, enabled }, ... }
      loadPriority: [], // Array of moduleIds in load order
    };
    // Map<moduleId, priorityIndex>
    this.priorityMap = new Map();

    this.initialized = false;
    console.log('EventDispatcher instance created.');
  }

  /**
   * Initializes the dispatcher with module configuration data.
   * MUST be called after modules are registered and before any events are published.
   * @param {object} modulesData - The parsed content of modules.json
   * @param {Map<string, Array<{moduleId: string, handler: function}>>} registeredHandlers - Handlers collected during module registration.
   */
  initialize(modulesData, registeredHandlers) {
    if (this.initialized) {
      console.warn('EventDispatcher already initialized.');
      return;
    }
    if (
      !modulesData ||
      !modulesData.loadPriority ||
      !modulesData.moduleDefinitions
    ) {
      console.error(
        'EventDispatcher: Invalid modulesData provided during initialization.'
      );
      return;
    }
    if (!registeredHandlers || !(registeredHandlers instanceof Map)) {
      console.error(
        'EventDispatcher: Invalid registeredHandlers provided during initialization.'
      );
      return;
    }

    console.log('Initializing EventDispatcher...');
    this.moduleData = modulesData;
    this.handlers = registeredHandlers; // Use the handlers collected during registration

    // Pre-calculate priority indices for faster lookup
    this.priorityMap.clear(); // Clear in case of re-initialization attempt
    this.moduleData.loadPriority.forEach((moduleId, index) => {
      this.priorityMap.set(moduleId, index);
    });

    this.initialized = true;
    console.log('EventDispatcher initialized successfully.');
  }

  /**
   * Publishes an event to the highest (or lowest) priority enabled module that handles it.
   * @param {string} eventName - The name of the event to publish.
   * @param {any} data - The data payload associated with the event.
   * @param {object} [options={}] - Optional parameters.
   * @param {'highestFirst'|'lowestFirst'} [options.direction='highestFirst'] - Order to check handlers.
   */
  publish(eventName, data, options = {}) {
    if (!this.initialized) {
      console.warn(
        `EventDispatcher not initialized. Cannot publish event: ${eventName}`
      );
      return;
    }

    const { direction = 'highestFirst' } = options;

    const potentialHandlers = this.handlers.get(eventName) || [];
    if (potentialHandlers.length === 0) {
      return; // No handlers registered for this event
    }

    // Filter for enabled modules and sort by priority
    const eligibleHandlers = potentialHandlers
      .filter((entry) => this.moduleData.definitions[entry.moduleId]?.enabled)
      .sort((a, b) => {
        const priorityA = this.priorityMap.get(a.moduleId) ?? -1;
        const priorityB = this.priorityMap.get(b.moduleId) ?? -1;
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
      handlerEntry.handler(data); // Assumes handlers are stored with key 'handler'
    } catch (error) {
      console.error(
        `[EventDispatcher] Error executing handler for event "${eventName}" in module "${handlerEntry.moduleId}":`,
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
    if (!this.initialized) {
      console.warn(
        `EventDispatcher not initialized. Cannot publishToPredecessors event: ${eventName} from ${originModuleId}`
      );
      return;
    }

    const originPriority = this.priorityMap.get(originModuleId);
    if (originPriority === undefined) {
      console.warn(
        `[EventDispatcher] publishToPredecessors called by unknown module: ${originModuleId}`
      );
      return;
    }

    const potentialHandlers = this.handlers.get(eventName) || [];
    if (potentialHandlers.length === 0) {
      return; // No handlers registered for this event
    }

    // Filter for enabled modules loaded *before* the origin module, then sort by highest priority first
    const eligiblePredecessors = potentialHandlers
      .filter((entry) => {
        const entryPriority = this.priorityMap.get(entry.moduleId);
        return (
          this.moduleData.definitions[entry.moduleId]?.enabled &&
          entryPriority !== undefined &&
          entryPriority < originPriority // Only modules loaded BEFORE the origin
        );
      })
      .sort((a, b) => {
        const priorityA = this.priorityMap.get(a.moduleId);
        const priorityB = this.priorityMap.get(b.moduleId);
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
      handlerEntry.handler(data); // Assumes handlers are stored with key 'handler'
    } catch (error) {
      console.error(
        `[EventDispatcher] Error executing predecessor handler for event "${eventName}" in module "${handlerEntry.moduleId}":`,
        error
      );
    }
  }
}

// Export the class, not an instance
export default EventDispatcher;
