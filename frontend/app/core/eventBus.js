// eventBus.js
import centralRegistry from './centralRegistry.js'; // Import registry

export class EventBus {
  constructor() {
    this.events = {};
  }

  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(event, callback);
    };
  }

  publish(event, data) {
    if (!this.events[event]) {
      return;
    }

    // Get subscriber info from registry to check enabled status
    const subscriberInfoMap = new Map();
    const subscribers =
      centralRegistry.getAllEventBusSubscribers().get(event) || [];
    subscribers.forEach((sub) => {
      // Assuming one entry per module for now, store enabled state by callback ref
      subscriberInfoMap.set(sub.callback, {
        moduleId: sub.moduleId,
        enabled: sub.enabled,
      });
    });

    this.events[event].forEach((callback) => {
      const subInfo = subscriberInfoMap.get(callback);
      // Check if the subscriber is registered AND enabled
      if (subInfo && subInfo.enabled !== false) {
        // Default to enabled if somehow missing
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      } else if (subInfo && subInfo.enabled === false) {
        // console.log(`[EventBus] Skipping disabled subscriber for ${event}: module ${subInfo.moduleId}`);
      } else {
        // This callback is subscribed but not found in centralRegistry - shouldn't happen if using registerEventBusSubscriber
        // console.warn(`[EventBus] Callback for ${event} is subscribed but not found in registry. Executing anyway.`);
        // Decide whether to execute unregistered callbacks - for now, let's skip them to encourage registration
        console.warn(
          `[EventBus] Skipping execution for ${event}: Callback not found or registered via centralRegistry.`
        );
      }
    });
  }

  unsubscribe(event, callback) {
    if (!this.events[event]) {
      return;
    }

    this.events[event] = this.events[event].filter((cb) => cb !== callback);

    // Clean up empty event arrays
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus();

// Also export as default for convenience
export default eventBus;
