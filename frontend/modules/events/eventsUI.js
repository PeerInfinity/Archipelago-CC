import { getInitApi } from './index.js';
import eventBus from '../../app/core/eventBus.js'; // Import eventBus

// Basic CSS for the panel
const CSS = `
.events-inspector {
  padding: 10px;
  font-family: sans-serif;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  background-color: #282c34; /* Darker background for the whole panel */
  color: #abb2bf; /* Lighter default text */
}
.events-inspector h2, .events-inspector h3, .events-inspector h4 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  color: #61afef; /* Brighter headings */
  border-bottom: 1px solid #4b5263;
  padding-bottom: 0.2em;
}
.events-inspector h4 {
  color: #98c379; /* Different color for event names */
  border-bottom: none;
  margin-bottom: 0.8em;
}
.event-bus-section .category-block {
  margin-bottom: 15px;
  border-left: 2px solid #61afef; /* Use heading color for border */
  padding-left: 10px;
}
.dispatcher-event, .event-bus-event {
  margin-bottom: 20px;
  border: 1px solid #4b5263; /* Darker border */
  padding: 10px;
  background-color: #323842; /* Slightly lighter dark background */
  border-radius: 4px;
}
.module-block {
  border: 1px dashed #4b5263; /* Darker dashed border */
  padding: 5px 8px;
  margin-bottom: 5px;
  background-color: #282c34; /* Match panel background or slightly different dark */
  display: flex; /* Use flexbox for columns */
  align-items: center;
  min-height: 24px; /* Ensure consistent height */
  color: #dcdfe4; /* Light text for module names */
  border-radius: 2px;
}
.module-name {
  flex-grow: 1; /* Allow module name to take up remaining space */
  font-weight: bold;
  margin-right: 10px;
}
.symbols-column {
  flex-basis: 30px; /* Fixed width for symbol columns */
  text-align: center;
  font-family: monospace; /* Monospace often aligns symbols well */
  color: #abb2bf; /* Default light symbol color */
}
.publisher-symbol {
  color: #61afef; /* Light Blue */
}
.subscriber-symbol {
  color: #c678dd; /* Light Purple/Magenta */
}
.sender-symbol {
  color: #61afef; /* Light Blue */
}
.handler-symbol {
  color: #98c379; /* Light Green */
}
.connector {
  height: 10px;
  width: 1px;
  background-color: #4b5263; /* Darker connector line */
  margin: -2px auto 3px auto; /* Adjust margin for better visual connection */
}
.symbols-column input[type="checkbox"] {
  margin-left: 4px;
  vertical-align: middle;
  cursor: pointer;
}
.disabled-interaction {
  opacity: 0.5;
  text-decoration: line-through;
}
`;

class EventsUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    this.rootElement = null;
    this.eventBusSection = null;
    this.dispatcherSection = null;
    this.initApi = getInitApi(); // Get the API stored during module initialization
    this.unsubscribeModuleState = null; // Handle for unsubscribing

    if (!this.initApi) {
      console.error('[EventsUI] Failed to get initApi!');
      // Handle error - maybe display a message in the panel?
    }

    this._createUI();
    this._loadAndRenderData();

    // Subscribe to module state changes to refresh the UI
    this.unsubscribeModuleState = eventBus.subscribe(
      'module:stateChanged',
      this.handleModuleStateChange.bind(this)
    );

    // Golden Layout: Listen for destroy event to unsubscribe
    this.container.on('destroy', () => {
      this.destroy();
    });

    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = CSS;
    // Prepend to ensure it's added early, avoid FOUC
    this.container.element.prepend(style);

    // TODO: Set up listeners if needed (e.g., to refresh when modules are dynamically loaded/unloaded)
  }

  // Method expected by PanelManager/WrapperComponent
  getRootElement() {
    return this.rootElement;
  }

  _createUI() {
    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('events-inspector');
    this.rootElement.innerHTML = `
      <h2>Event Bus</h2>
      <div class="event-bus-section">Loading...</div>
      <hr>
      <h2>Event Dispatcher</h2>
      <div class="dispatcher-section">Loading...</div>
    `;

    this.eventBusSection = this.rootElement.querySelector('.event-bus-section');
    this.dispatcherSection = this.rootElement.querySelector(
      '.dispatcher-section'
    );

    this.container.element.appendChild(this.rootElement);
  }

  async _loadAndRenderData() {
    if (!this.initApi) {
      this.eventBusSection.textContent = 'Error: Initialization API not found.';
      this.dispatcherSection.textContent =
        'Error: Initialization API not found.';
      return;
    }

    try {
      const registry = this.initApi.getModuleManager()._getRawRegistry();
      const moduleManager = this.initApi.getModuleManager();

      if (!registry || !moduleManager) {
        throw new Error('Failed to retrieve registry or module manager.');
      }

      const eventBusPublishers = registry.getAllEventBusPublishers();
      const eventBusSubscribers = registry.getAllEventBusSubscribers();
      const dispatcherSenders = registry.getAllDispatcherSenders();
      const dispatcherHandlers = registry.getAllDispatcherHandlers();
      const loadPriority = await moduleManager.getCurrentLoadPriority();

      this._renderEventBus(eventBusPublishers, eventBusSubscribers);
      this._renderDispatcherEvents(
        dispatcherSenders,
        dispatcherHandlers,
        loadPriority
      );
    } catch (error) {
      console.error('[EventsUI] Error loading or rendering event data:', error);
      this.eventBusSection.textContent = `Error loading data: ${error.message}`;
      this.dispatcherSection.textContent = `Error loading data: ${error.message}`;
    }
  }

  _renderEventBus(publishersMap, subscribersMap) {
    this.eventBusSection.innerHTML = ''; // Clear loading indicator

    const allEventNames = new Set([
      ...publishersMap.keys(),
      ...subscribersMap.keys(),
    ]);

    if (allEventNames.size === 0) {
      this.eventBusSection.textContent = 'No EventBus events registered.';
      return;
    }

    // --- Get Load Priority (needed for ordering the stack) ---
    let loadPriority = [];
    try {
      const moduleManager = this.initApi.getModuleManager();
      // Note: This relies on the async call in _loadAndRenderData having completed,
      // or potentially making it sync if ModuleManager caches it.
      // For simplicity here, assume moduleManager provides it synchronously or is cached.
      // A more robust solution might pass loadPriority as an argument.
      if (
        moduleManager &&
        typeof moduleManager.getCurrentLoadPriority === 'function'
      ) {
        // Attempt to get priority - this might need to be async if manager doesn't cache
        // For now, let's proceed, but acknowledge this might need adjustment
        // loadPriority = await moduleManager.getCurrentLoadPriority();
        console.warn(
          '[EventsUI] Getting loadPriority synchronously for EventBus rendering. Ensure ModuleManager provides this efficiently.'
        );
        // *** TEMPORARY WORKAROUND: Accessing _getRawModulesData - NOT IDEAL ***
        // This assumes _getRawModulesData and loadPriority are available after init
        const rawData = moduleManager._getRawModulesData();
        loadPriority = rawData ? rawData.loadPriority : [];
      } else {
        throw new Error(
          'ModuleManager or getCurrentLoadPriority not available.'
        );
      }
    } catch (error) {
      console.error(
        '[EventsUI] Failed to get loadPriority for EventBus rendering:',
        error
      );
      this.eventBusSection.innerHTML = 'Error loading module priority.';
      return;
    }
    // --- End Get Load Priority ---

    // Group by category
    const eventsByCategory = {};
    allEventNames.forEach((eventName) => {
      const parts = eventName.split(':');
      const category = parts.length > 1 ? parts[0] : 'Uncategorized';
      if (!eventsByCategory[category]) {
        eventsByCategory[category] = [];
      }
      eventsByCategory[category].push(eventName);
    });

    // Sort categories and events within categories
    Object.keys(eventsByCategory)
      .sort()
      .forEach((category) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('category-block'); // Add class for styling
        categoryDiv.innerHTML = `<h3>${category}</h3>`;
        this.eventBusSection.appendChild(categoryDiv);

        eventsByCategory[category].sort().forEach((eventName) => {
          const publishers = publishersMap.get(eventName) || new Set();
          const subscribers = subscribersMap.get(eventName) || [];
          const subscriberModuleIds = new Set(
            subscribers.map((s) => s.moduleId)
          );

          // Determine relevant modules for this event
          const relevantModuleIds = new Set([
            ...publishers,
            ...subscriberModuleIds,
          ]);

          // Filter loadPriority to only include relevant modules, maintaining order
          const relevantModulesInOrder = loadPriority.filter((moduleId) =>
            relevantModuleIds.has(moduleId)
          );

          if (relevantModulesInOrder.length === 0) {
            return; // Skip rendering if no relevant modules found (e.g., only unregistered modules involved)
          }

          const eventContainer = document.createElement('div');
          eventContainer.classList.add('event-bus-event'); // Add class for styling
          eventContainer.innerHTML = `<h4>${eventName}</h4>`;

          relevantModulesInOrder.forEach((moduleId, index) => {
            const publisherInfo = publishers.get(moduleId);
            const isPublisher = !!publisherInfo;
            const isPublisherEnabled =
              isPublisher && publisherInfo.enabled !== false;

            // Find subscriber info (assuming one per module/event for UI toggle)
            const subscriberInfo = subscribers.find(
              (s) => s.moduleId === moduleId
            );
            const isSubscriber = !!subscriberInfo;
            const isSubscriberEnabled =
              isSubscriber && subscriberInfo.enabled !== false;

            const moduleDiv = document.createElement('div');
            moduleDiv.classList.add('module-block');
            // Add disabled class if BOTH publisher/subscriber roles (if applicable) are disabled
            if (
              isPublisher &&
              !isPublisherEnabled &&
              isSubscriber &&
              !isSubscriberEnabled
            ) {
              moduleDiv.classList.add('disabled-interaction');
            }

            const nameDiv = document.createElement('div');
            nameDiv.classList.add('module-name');
            nameDiv.textContent = moduleId;

            // --- Publisher Column --- //
            const publisherCol = document.createElement('div');
            publisherCol.classList.add('symbols-column', 'publisher-symbol');
            if (isPublisher) {
              publisherCol.textContent = '[P]';
              const checkbox = this._createToggleCheckbox(
                eventName,
                moduleId,
                'eventBusPublisher',
                isPublisherEnabled
              );
              publisherCol.appendChild(checkbox);
              if (!isPublisherEnabled)
                publisherCol.classList.add('disabled-interaction');
            }

            // --- Subscriber Column --- //
            const subscriberCol = document.createElement('div');
            subscriberCol.classList.add('symbols-column', 'subscriber-symbol');
            if (isSubscriber) {
              subscriberCol.textContent = '[S]';
              const checkbox = this._createToggleCheckbox(
                eventName,
                moduleId,
                'eventBusSubscriber',
                isSubscriberEnabled
              );
              subscriberCol.appendChild(checkbox);
              if (!isSubscriberEnabled)
                subscriberCol.classList.add('disabled-interaction');
            }

            moduleDiv.appendChild(nameDiv);
            moduleDiv.appendChild(publisherCol);
            moduleDiv.appendChild(subscriberCol);
            eventContainer.appendChild(moduleDiv);

            // Add connector
            if (index < relevantModulesInOrder.length - 1) {
              const connector = document.createElement('div');
              connector.classList.add('connector');
              eventContainer.appendChild(connector);
            }
          });
          categoryDiv.appendChild(eventContainer);
        });
      });
  }

  _renderDispatcherEvents(sendersMap, handlersMap, loadPriority) {
    this.dispatcherSection.innerHTML = ''; // Clear loading indicator

    const allEventNames = new Set([
      ...sendersMap.keys(),
      ...handlersMap.keys(),
    ]);

    if (allEventNames.size === 0) {
      this.dispatcherSection.textContent =
        'No EventDispatcher events registered.';
      return;
    }

    // Sort event names alphabetically for consistent display
    [...allEventNames].sort().forEach((eventName) => {
      const senders = sendersMap.get(eventName) || [];
      const handlers = handlersMap.get(eventName) || [];

      // Determine which modules are relevant for this specific event
      const relevantModuleIds = new Set();
      senders.forEach((s) => relevantModuleIds.add(s.moduleId));
      handlers.forEach((h) => relevantModuleIds.add(h.moduleId));

      // Filter loadPriority to only include relevant modules, maintaining order
      const relevantModulesInOrder = loadPriority.filter((moduleId) =>
        relevantModuleIds.has(moduleId)
      );

      // If no modules interact with this event (shouldn't normally happen if eventName exists),
      // maybe skip rendering or show a message?
      if (relevantModulesInOrder.length === 0) {
        console.warn(
          `[EventsUI] Event '${eventName}' has registered senders/handlers but none are in loadPriority? Skipping render for this event.`
        );
        return; // Skip rendering this event block
      }

      const eventContainer = document.createElement('div');
      eventContainer.classList.add('dispatcher-event');
      eventContainer.style.marginBottom = '20px';
      eventContainer.style.border = '1px solid #4b5263';
      eventContainer.style.padding = '10px';

      eventContainer.innerHTML = `<h4>${eventName}</h4>`;

      // Create vertical stack using only the relevant modules in their load priority order
      relevantModulesInOrder.forEach((moduleId, index) => {
        const senderInfo = senders.find((s) => s.moduleId === moduleId);
        const isSender = !!senderInfo;
        const isSenderEnabled = isSender && senderInfo.enabled !== false;

        const handlerInfo = handlers.find((h) => h.moduleId === moduleId);
        const isHandler = !!handlerInfo;
        const isHandlerEnabled = isHandler && handlerInfo.enabled !== false;

        const moduleDiv = document.createElement('div');
        moduleDiv.classList.add('module-block');
        if (isSender && !isSenderEnabled && isHandler && !isHandlerEnabled) {
          moduleDiv.classList.add('disabled-interaction');
        }

        const nameDiv = document.createElement('div');
        nameDiv.classList.add('module-name');
        nameDiv.textContent = moduleId;

        // --- Sender Column --- //
        const senderCol = document.createElement('div');
        senderCol.classList.add('symbols-column', 'sender-symbol');
        if (isSender) {
          senderCol.textContent = '[S]'; // Placeholder symbol
          const checkbox = this._createToggleCheckbox(
            eventName,
            moduleId,
            'dispatcherSender',
            isSenderEnabled
          );
          senderCol.appendChild(checkbox);
          if (!isSenderEnabled) senderCol.classList.add('disabled-interaction');
          // TODO: Adjust sender symbol based on direction/target? Still needed.
        }

        // --- Handler Column --- //
        const handlerCol = document.createElement('div');
        handlerCol.classList.add('symbols-column', 'handler-symbol');
        if (isHandler) {
          let symbolsText = '';
          if (handlerInfo.propagationDetails) {
            const details = handlerInfo.propagationDetails;
            if (details.direction === 'highestFirst') symbolsText += '↓';
            else if (details.direction === 'lowestFirst') symbolsText += '↑';
            else symbolsText += '●'; // Non-propagating handler
            if (details.timing === 'delayed') symbolsText += '⏳';
            if (details.condition === 'conditional') symbolsText += '❓';
          } else {
            symbolsText = '[H]'; // Basic handler, no details
          }
          handlerCol.textContent = symbolsText;
          const checkbox = this._createToggleCheckbox(
            eventName,
            moduleId,
            'dispatcherHandler',
            isHandlerEnabled
          );
          handlerCol.appendChild(checkbox);
          if (!isHandlerEnabled)
            handlerCol.classList.add('disabled-interaction');
        }

        moduleDiv.appendChild(nameDiv);
        moduleDiv.appendChild(senderCol); // Add sender column
        moduleDiv.appendChild(handlerCol); // Add handler column
        eventContainer.appendChild(moduleDiv);

        // Add connector placeholder
        if (index < relevantModulesInOrder.length - 1) {
          const connector = document.createElement('div');
          connector.classList.add('connector');
          eventContainer.appendChild(connector);
        }
      });

      this.dispatcherSection.appendChild(eventContainer);
    });

    // TODO: Implement detailed arrow/symbol logic for dispatcher events
    console.warn(
      '[EventsUI] Dispatcher event rendering is basic. Needs symbol/arrow implementation.'
    );
  }

  // --- Helper to create toggle checkboxes --- //
  _createToggleCheckbox(eventName, moduleId, type, isEnabled) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEnabled;
    checkbox.title = `${isEnabled ? 'Disable' : 'Enable'} this interaction`;
    checkbox.addEventListener('change', (event) => {
      const newState = event.target.checked;
      try {
        const registry = this.initApi.getModuleManager()._getRawRegistry();
        let success = false;
        switch (type) {
          case 'eventBusPublisher':
            success = registry.setEventBusPublisherEnabled(
              eventName,
              moduleId,
              newState
            );
            break;
          case 'eventBusSubscriber':
            success = registry.setEventBusSubscriberEnabled(
              eventName,
              moduleId,
              newState
            );
            break;
          case 'dispatcherSender':
            success = registry.setDispatcherSenderEnabled(
              eventName,
              moduleId,
              newState
            );
            break;
          case 'dispatcherHandler':
            success = registry.setDispatcherHandlerEnabled(
              eventName,
              moduleId,
              newState
            );
            break;
        }
        if (success) {
          console.log(
            `Successfully toggled ${type} for ${moduleId} on ${eventName} to ${newState}`
          );
          // Update visual style immediately
          event.target
            .closest('.symbols-column')
            .classList.toggle('disabled-interaction', !newState);
          // Potentially update parent module-block style too
        } else {
          console.error(`Failed to toggle ${type} state in registry.`);
          event.target.checked = !newState; // Revert checkbox on failure
        }
      } catch (error) {
        console.error(
          `Error calling registry toggle function for ${type}:`,
          error
        );
        event.target.checked = !newState; // Revert checkbox on failure
      }
    });
    return checkbox;
  }

  // Handler for module state changes
  handleModuleStateChange(payload) {
    console.log(
      `[EventsUI] Received module:stateChanged for ${payload.moduleId}. Refreshing data...`
    );
    // Simple approach: reload all data and re-render
    this._loadAndRenderData();
  }

  // Clean up subscriptions when the panel is destroyed
  destroy() {
    if (this.unsubscribeModuleState) {
      this.unsubscribeModuleState();
      this.unsubscribeModuleState = null;
      console.log('[EventsUI] Unsubscribed from module:stateChanged.');
    }
    // Add any other cleanup needed
  }
}

// Export the class for the module index to use
export default EventsUI;
