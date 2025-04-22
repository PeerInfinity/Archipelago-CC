class EventDispatcher {
  constructor(registry, modulesData) {
    this.registry = registry; // Reference to the central registry
    this.modulesData = modulesData; // Contains moduleDefinitions and loadPriority
    this.enabledModules = new Set(
      this.modulesData.loadPriority.filter(
        (id) => this.modulesData.moduleDefinitions[id]?.enabled
      )
    );
    console.log(
      'EventDispatcher initialized. Enabled modules:',
      this.enabledModules
    );
    console.log('Load Priority:', this.modulesData.loadPriority);
  }

  /**
   * Publishes an event to the highest priority enabled handler.
   * @param {string} eventName - The name of the event.
   * @param {any} data - The event payload.
   */
  publish(eventName, data) {
    const handlers = this.registry.eventHandlers.get(eventName) || [];
    const loadPriority = this.modulesData.loadPriority;

    // Filter for enabled modules and sort by REVERSE load priority (highest prio first)
    const potentialHandlers = handlers
      .filter((h) => this.enabledModules.has(h.moduleId))
      .sort((a, b) => {
        const indexA = loadPriority.indexOf(a.moduleId);
        const indexB = loadPriority.indexOf(b.moduleId);
        return indexB - indexA; // Higher index = higher priority = comes first
      });

    if (potentialHandlers.length > 0) {
      const handlerEntry = potentialHandlers[0];
      console.log(
        `[Dispatcher] Publishing '${eventName}' to ${handlerEntry.moduleId}`
      );
      try {
        handlerEntry.handlerFunction(data);
      } catch (error) {
        console.error(
          `Error in event handler ${handlerEntry.moduleId} for ${eventName}:`,
          error
        );
      }
    } else {
      console.log(`[Dispatcher] No enabled handlers found for '${eventName}'`);
    }
  }

  /**
   * Publishes an event to the next highest priority enabled handler *before* the origin module.
   * @param {string} originModuleId - The ID of the module initiating the propagation.
   * @param {string} eventName - The name of the event.
   * @param {any} data - The event payload.
   */
  publishToPredecessors(originModuleId, eventName, data) {
    const handlers = this.registry.eventHandlers.get(eventName) || [];
    const loadPriority = this.modulesData.loadPriority;
    const originIndex = loadPriority.indexOf(originModuleId);

    if (originIndex === -1) {
      console.warn(
        `[Dispatcher] Origin module ${originModuleId} not found in load priority for publishToPredecessors.`
      );
      return;
    }

    // Filter for enabled modules loaded BEFORE origin, sort by REVERSE load priority
    const potentialHandlers = handlers
      .filter((h) => {
        const handlerIndex = loadPriority.indexOf(h.moduleId);
        return (
          this.enabledModules.has(h.moduleId) && handlerIndex < originIndex
        );
      })
      .sort((a, b) => {
        const indexA = loadPriority.indexOf(a.moduleId);
        const indexB = loadPriority.indexOf(b.moduleId);
        return indexB - indexA; // Higher index = higher priority = comes first
      });

    if (potentialHandlers.length > 0) {
      const handlerEntry = potentialHandlers[0];
      console.log(
        `[Dispatcher] Propagating '${eventName}' from ${originModuleId} to ${handlerEntry.moduleId}`
      );
      try {
        handlerEntry.handlerFunction(data);
      } catch (error) {
        console.error(
          `Error in propagated event handler ${handlerEntry.moduleId} for ${eventName}:`,
          error
        );
      }
    } else {
      console.log(
        `[Dispatcher] No predecessors found for '${eventName}' from ${originModuleId}`
      );
    }
  }
}

export default EventDispatcher;
