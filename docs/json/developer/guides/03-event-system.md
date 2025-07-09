# Developer Guide: The Event System

To maintain a decoupled and modular architecture, the frontend relies on a two-tier event system for communication between modules. Understanding when and how to use each tier is crucial for developing new features.

The two tiers are:

1.  **The Event Bus (`eventBus.js`):** For simple, broadcast-style notifications.
2.  **The Event Dispatcher (`eventDispatcher.js`):** For prioritized, command-like events that should be handled by a specific module in a defined order.

## Tier 1: The Event Bus

The `eventBus` is a simple publish-subscribe (pub/sub) system. It allows modules to broadcast notifications without knowing or caring who, if anyone, is listening.

**Analogy:** Think of it as a public announcement system. A module makes an announcement, and any other module that has chosen to listen for that specific type of announcement will hear it.

### When to Use the Event Bus

Use the Event Bus for **one-to-many** or **many-to-many** communication, typically for broadcasting state changes or general UI notifications.

- A module's state has changed, and other modules might need to react and update their UI (e.g., `stateManager:snapshotUpdated`, `settings:changed`).
- A user action has occurred that multiple, unrelated panels might be interested in (e.g., `ui:activatePanel`).
- A notification needs to be displayed to the user (e.g., `ui:notification`).

### How to Use the Event Bus

```javascript
// --- Publishing an event ---
// Module A wants to announce something.
import eventBus from '../../app/core/eventBus.js';

eventBus.publish('myModule:dataUpdated', { newData: 'hello world' });
```

```javascript
// --- Subscribing to an event ---
// Module B wants to listen for Module A's announcement.
import eventBus from '../../app/core/eventBus.js';

class ModuleB_UI {
  constructor() {
    // It's best practice to subscribe in postInitialize or when the component mounts.
    this.unsubscribeHandle = eventBus.subscribe(
      'myModule:dataUpdated',
      (data) => {
        console.log('Module B received update:', data.newData);
        this.updateMyUI();
      }
    );
  }

  // It's critical to unsubscribe when the component is destroyed to prevent memory leaks.
  destroy() {
    if (this.unsubscribeHandle) {
      this.unsubscribeHandle();
    }
  }
}
```

## Tier 2: The Event Dispatcher

The `eventDispatcher` is a more sophisticated system designed for handling events that should be processed in a specific, prioritized order. It sends an event down a "chain of command," and the first eligible module that handles it can stop the event from propagating further.

**Analogy:** Think of it as escalating a request through a chain of command. The request goes to the highest-priority manager first. If they can't handle it, they pass it to the next one in line, and so on.

### When to Use the Event Dispatcher

Use the Event Dispatcher for user actions or system commands that require a **single, authoritative handler**.

- A user clicks a location to check it (`user:locationCheck`). This event needs to be routed correctly:
  1.  Should the `Loops` module handle it and queue an action?
  2.  If not, should the `Client` module handle it and send it to the server?
  3.  If not, should the `StateManager` handle it locally for offline tracking?
- The dispatcher ensures that only one of these modules acts on the event, based on their load priority.

### How to Use the Event Dispatcher

Modules must register their intent to handle a dispatched event. The dispatcher uses the `loadPriority` from `modules.json` to determine the order.

1.  **Registering a Handler (in `module/index.js` `register()` function):**

    ```javascript
    // In loops/index.js
    registrationApi.registerDispatcherReceiver(
      'loops', // Module ID
      'user:locationCheck', // Event name
      handleUserLocationCheckForLoops, // The handler function
      { direction: 'up', condition: 'conditional', timing: 'immediate' } // Propagation details
    );
    ```

2.  **Dispatching an Event (from a UI element):**

    ```javascript
    // In locationsUI.js, when a location card is clicked
    // The dispatcher instance is retrieved via the module's initialization API.
    const dispatcher = getDispatcher();
    dispatcher.publish(
      'user:locationCheck',
      { locationName: "Link's House" },
      { initialTarget: 'bottom' } // Start with the last-loaded, highest-priority module
    );
    ```

3.  **Handling and Propagating (in the handler function):**

    ```javascript
    // In loops/loopEvents.js
    export function handleUserLocationCheckForLoops(
      eventData,
      propagationOptions
    ) {
      const dispatcher = getLoopsModuleDispatcher();

      if (loopStateSingleton.isLoopModeActive) {
        // Handle the event here...
        console.log('Loop mode is active, queuing the check.');
        // Do NOT propagate further. The chain stops here.
      } else {
        // Not handled by this module, so pass it on.
        dispatcher.publishToNextModule(
          'loops', // My module ID
          'user:locationCheck', // The event I'm propagating
          eventData, // The original data
          { direction: 'up' } // Continue in the same direction
        );
      }
    }
    ```

### Summary: `eventBus` vs. `eventDispatcher`

| Characteristic        | Event Bus (`eventBus`)                             | Event Dispatcher (`dispatcher`)                           |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| **Communication**     | One-to-many (Broadcast)                            | One-to-one-in-a-chain (Prioritized Command)               |
| **Purpose**           | Announcing state changes, general notifications    | Processing user actions, delegating commands              |
| **Handler Execution** | **All** subscribers are called.                    | **Only the highest-priority** eligible handler is called. |
| **Propagation**       | Implicitly goes to all subscribers.                | Must be **explicitly propagated** by the handler.         |
| **Typical Use Case**  | `stateManager:snapshotUpdated`, `settings:changed` | `user:locationCheck`, `user:itemCheck`                    |
