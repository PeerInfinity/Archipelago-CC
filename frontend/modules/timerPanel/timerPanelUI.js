// frontend/modules/timerPanel/timerPanelUI.js
import { centralRegistry } from '../../app/core/centralRegistry.js';
import eventBus from '../../app/core/eventBus.js';
// Import helper from its own index.js to get module context
import {
  getTimerPanelModuleLoadPriority,
  getTimerPanelModuleId, // Fallback if componentType is not provided
  getHostedUIComponentType,
} from './index.js';

const TIMER_UI_COMPONENT_TYPE = 'TimerProgressUI';

export class TimerPanelUI {
  constructor(container, componentState, componentType) {
    // componentType is passed by PanelManager's factory
    this.moduleId = componentType || getTimerPanelModuleId(); // Use componentType passed by PanelManager
    console.log(`[TimerPanelUI for ${this.moduleId}] Constructor called.`);
    this.container = container; // GoldenLayout container object
    this.componentState = componentState;

    this.rootElement = document.createElement('div');
    // this.moduleId = moduleId; // Store for context if needed, e.g., for debug messages
    this.rootElement.className = 'timer-panel-ui-container panel-container'; // Ensure consistent class
    this.rootElement.style.width = '100%';
    this.rootElement.style.height = '100%';
    this.rootElement.style.overflow = 'auto';
    this.rootElement.style.padding = '5px'; // Basic padding
    this.rootElement.style.boxSizing = 'border-box';
    // REMOVE DEBUG STYLING
    // this.rootElement.style.border = '2px solid blue';
    // this.rootElement.textContent = `TimerPanelUI Root (Module ID: ${this.moduleId || 'N/A'})`;
    this.rootElement.innerHTML = ''; // Clear any debug text content

    this.timerHostPlaceholder = document.createElement('div');
    this.timerHostPlaceholder.id = `timer-ui-host-in-${
      this.moduleId
    }-${Date.now()}`;
    this.timerHostPlaceholder.style.width = '100%';
    this.timerHostPlaceholder.style.height = 'calc(100% - 30px)'; // Adjust height to see text above
    // REMOVE DEBUG STYLING FOR PLACEHOLDER
    // this.timerHostPlaceholder.style.border = '1px dashed green;';
    // this.timerHostPlaceholder.innerHTML = `<p style="color:green; font-weight:bold;">TimerHostPlaceholder for ${this.moduleId}</p>`;
    this.timerHostPlaceholder.innerHTML = ''; // Clear debug text
    this.rootElement.appendChild(this.timerHostPlaceholder);

    // --- Do NOT append this.rootElement to this.container.element here. ---
    // --- The WrapperComponent in PanelManager is responsible for that. ---

    this.hostedComponentType = getHostedUIComponentType(); // From its own index.js
    this.isHostActive = false;
    this.moduleStateChangeHandler =
      this._handleSelfModuleStateChange.bind(this);

    // GL container lifecycle events
    this.container.on('open', this._handlePanelOpen.bind(this));
    this.container.on('show', this._handlePanelShow.bind(this));
    this.container.on('hide', this._handlePanelHide.bind(this));
    this.container.on('destroy', this._handlePanelDestroy.bind(this));

    eventBus.subscribe('module:stateChanged', this.moduleStateChangeHandler);
    centralRegistry.registerEventBusSubscriberIntent(
      this.moduleId,
      'module:stateChanged'
    );

    console.log(
      `[TimerPanelUI for ${this.moduleId}] Panel UI instance created. Root element ready but not yet appended by wrapper.`
    );
  }

  getRootElement() {
    console.log(
      `[TimerPanelUI for ${this.moduleId}] getRootElement() called, returning:`,
      this.rootElement
    );
    return this.rootElement;
  }

  onMount(glContainer, componentState) {
    // glContainer is the same as this.container
    console.log(
      `[TimerPanelUI for ${this.moduleId}] onMount CALLED. Panel's rootElement should now be in the DOM via wrapper.`
    );
    // Initial host registration
    // Consider if panel is immediately visible or not.
    if (this.container && this.container.isVisible) {
      this._registerAsHost(true);
    } else {
      this._registerAsHost(false); // Will be activated by _handlePanelShow if tab becomes active
    }
  }

  onUnmount() {
    console.log(`[TimerPanelUI for ${this.moduleId}] onUnmount CALLED.`);
    this._cleanupHostRegistration();
    if (this.moduleStateChangeHandler) {
      eventBus.unsubscribe(
        'module:stateChanged',
        this.moduleStateChangeHandler
      );
      this.moduleStateChangeHandler = null; // Prevent multiple unsubscribes
    }
    // Minimal DOM cleanup here as GL manages container.element
    if (
      this.timerHostPlaceholder &&
      this.timerHostPlaceholder.parentNode === this.rootElement
    ) {
      this.rootElement.removeChild(this.timerHostPlaceholder);
    }
    this.timerHostPlaceholder = null;
    // this.rootElement is managed by the WrapperComponent lifecycle through GL.
  }

  _handlePanelOpen() {
    console.log(
      `[TimerPanelUI for ${this.moduleId}] GoldenLayout 'open' event. Panel is being shown or created.`
    );
    // onMount handles initial registration. If 'open' implies visibility, ensure active.
    if (this.container && this.container.isVisible) {
      this._registerAsHost(true);
    }
  }

  _handlePanelShow() {
    console.log(
      `[TimerPanelUI for ${this.moduleId}] GoldenLayout 'show' event. Panel tab selected.`
    );
    this._registerAsHost(true); // Ensure active status
  }

  _handlePanelHide() {
    console.log(
      `[TimerPanelUI for ${this.moduleId}] GoldenLayout 'hide' event. Panel tab deselected.`
    );
    centralRegistry.setUIHostActive(
      this.hostedComponentType,
      this.moduleId,
      false
    );
  }

  _handlePanelDestroy() {
    console.log(
      `[TimerPanelUI for ${this.moduleId}] GoldenLayout 'destroy' event. Calling onUnmount.`
    );
    this.onUnmount();
  }

  _cleanupHostRegistration() {
    console.log(
      `[TimerPanelUI for ${this.moduleId}] Cleaning up host registration.`
    );
    centralRegistry.setUIHostActive(
      this.hostedComponentType,
      this.moduleId,
      false
    );
    centralRegistry.unregisterUIHost(this.hostedComponentType, this.moduleId);
  }

  _registerAsHost(isActive) {
    if (!this.rootElement || !this.timerHostPlaceholder) {
      // Check rootElement too, as placeholder is its child
      console.warn(
        `[TimerPanelUI for ${this.moduleId}] UI elements not ready. Cannot register as host.`
      );
      return;
    }

    const loadPriority = getTimerPanelModuleLoadPriority();

    centralRegistry.registerUIHost(
      this.hostedComponentType,
      this.moduleId,
      this.timerHostPlaceholder,
      loadPriority
    );
    this.isHostActive = isActive;
    console.log(
      `[TimerPanelUI for ${this.moduleId}] Host registration attempt. Module: ${
        this.moduleId
      }, Type: ${this.hostedComponentType}, Placeholder: ${
        this.timerHostPlaceholder ? 'exists' : 'null'
      }, Priority: ${loadPriority}, Requested Active: ${isActive}`
    );
    centralRegistry.setUIHostActive(
      this.hostedComponentType,
      this.moduleId,
      isActive
    );
  }

  _handleSelfModuleStateChange({ moduleId, enabled }) {
    if (moduleId === this.moduleId) {
      console.log(
        `[TimerPanelUI for ${this.moduleId}] Received self module:stateChanged. Module: ${moduleId}, Enabled: ${enabled}`
      );
      if (enabled) {
        console.log(
          `[TimerPanelUI for ${this.moduleId}] Module re-enabled. Panel lifecycle events (open/show after recreation) will handle host registration.`
        );
        if (this.container && this.container.isVisible) {
          this._registerAsHost(true);
        }
      } else {
        console.log(
          `[TimerPanelUI for ${this.moduleId}] Module disabled. Setting host to inactive via _registerAsHost(false).`
        );
        this._registerAsHost(false);
      }
    }
  }

  // Optional: If this panel needed its own internal initialization beyond DOM creation.
  // initialize() {
  //   console.log(`[TimerPanelUI for ${this.moduleId}] Initialize method called (if needed).`);
  // }

  // Optional: If this panel needed specific destruction logic.
  // destroy() {
  //   console.log(`[TimerPanelUI for ${this.moduleId}] Destroy method called (if needed).`);
  // }
}
