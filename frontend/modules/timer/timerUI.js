// frontend/modules/timer/timerUI.js
import { Config } from '../client/core/config.js'; // For default timer interval

export class TimerUI {
  constructor(dependencies) {
    if (!dependencies || !dependencies.timerLogic || !dependencies.eventBus) {
      throw new Error(
        '[TimerUI] Missing required dependencies (timerLogic, eventBus).'
      );
    }
    this.timerLogic = dependencies.timerLogic;
    this.eventBus = dependencies.eventBus;

    this.domElement = null;
    this.progressBar = null;
    this.checksCounter = null;
    this.controlButton = null;
    this.quickCheckButton = null;
    this.unsubscribeHandles = [];

    console.log('[TimerUI] Instance created.');
    console.log(
      '[TimerUI Constructor] this.domElement initially:',
      this.domElement
    );
  }

  initialize() {
    console.log('[TimerUI] Initializing...');
    console.log(
      '[TimerUI Initialize] Before createDOMElement, this.domElement:',
      this.domElement
    );
    if (!this.domElement) {
      this.createDOMElement(); // Create DOM if not already present
    }
    console.log(
      '[TimerUI Initialize] After createDOMElement, this.domElement:',
      this.domElement
    );
    this._attachButtonListeners();
    this._subscribeToEvents();
    this.updateChecksCounter(); // Initial update based on current state
    this.enableControls(false); // Initially disabled until state/connection ready
    // TimerLogic might re-enable if conditions met (e.g., rules loaded)
  }

  getDOMElement() {
    console.log('[TimerUI getDOMElement] Method called.');
    console.log(
      '[TimerUI getDOMElement] Before check, this.domElement:',
      this.domElement
    );
    if (!this.domElement) {
      console.log(
        '[TimerUI getDOMElement] this.domElement is null, calling createDOMElement.'
      );
      this.createDOMElement();
    }
    console.log(
      '[TimerUI getDOMElement] Returning this.domElement:',
      this.domElement
    );
    return this.domElement;
  }

  createDOMElement() {
    console.log('[TimerUI createDOMElement] Method called.');
    this.domElement = document.createElement('div');
    this.domElement.id = 'progress-container';
    // Styles will be from index.css as per clarification
    // this.domElement.style.marginBottom = '10px';
    // this.domElement.style.padding = '8px';
    // this.domElement.style.backgroundColor = '#333';
    // this.domElement.style.borderRadius = '4px';

    this.domElement.innerHTML = `
      <h3 id="progress-container-header" style="margin: 0 0 5px 0; font-size: 1em;">Location Check Progress</h3>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
        <progress id="timer-progress-bar" value="0" max="30000" style="flex-grow: 1; height: 15px;"></progress>
        <span id="timer-checks-sent" style="min-width: 120px; text-align: right; font-size:0.9em;">Checked: 0/0</span>
      </div>
      <div class="button-container" style="display: flex; gap: 10px;">
        <button id="timer-control-button" disabled style="padding: 4px 10px;">Begin!</button>
        <button id="timer-quick-check-button" disabled style="padding: 4px 10px;">Quick Check</button>
      </div>
    `;

    // Store references to the created elements
    this.progressBar = this.domElement.querySelector('#timer-progress-bar');
    this.checksCounter = this.domElement.querySelector('#timer-checks-sent');
    this.controlButton = this.domElement.querySelector('#timer-control-button');
    this.quickCheckButton = this.domElement.querySelector(
      '#timer-quick-check-button'
    );

    console.log(
      '[TimerUI createDOMElement] After creation, this.domElement:',
      this.domElement
    );
    return this.domElement;
  }

  _attachButtonListeners() {
    if (this.controlButton) {
      this.controlButton.addEventListener('click', () => {
        if (this.timerLogic.isRunning()) {
          this.timerLogic.stop();
        } else {
          this.timerLogic.begin();
        }
      });
    }

    if (this.quickCheckButton) {
      this.quickCheckButton.addEventListener('click', () => {
        this.timerLogic.determineAndDispatchQuickCheck();
      });
    }
  }

  _subscribeToEvents() {
    const subscribe = (eventName, handler) => {
      const unsub = this.eventBus.subscribe(eventName, handler.bind(this));
      this.unsubscribeHandles.push(unsub);
    };

    subscribe('timer:started', this._handleTimerStarted);
    subscribe('timer:stopped', this._handleTimerStopped);
    subscribe('timer:progressUpdate', this._handleTimerProgressUpdate);
    subscribe('stateManager:snapshotUpdated', this._handleSnapshotUpdated); // For checksCounter

    // Enable controls when rules are loaded or connection is established
    const enableControlsHandler = () => this.enableControls(true);
    subscribe('stateManager:rulesLoaded', enableControlsHandler);
    subscribe('connection:open', enableControlsHandler);
    subscribe('connection:close', () => this.enableControls(false));

    console.log('[TimerUI] Subscribed to timer and state events.');
  }

  _handleTimerStarted(data) {
    // data = { startTime, endTime }
    if (this.progressBar && data && data.endTime && data.startTime) {
      this.progressBar.setAttribute(
        'max',
        (data.endTime - data.startTime).toString()
      );
      this.progressBar.setAttribute('value', '0');
    }
    this.setControlButtonState(true); // Timer is running, button shows "Stop"
    this.enableControls(true); // Ensure controls are enabled when timer starts
  }

  _handleTimerStopped() {
    if (this.progressBar) {
      this.progressBar.setAttribute('value', '0');
      // Max can remain, or be reset to a default
    }
    this.setControlButtonState(false); // Timer is stopped, button shows "Begin!"
    // Don't disable controls here, allow user to restart.
    // enableControls(false) might be called by connection:close
  }

  _handleTimerProgressUpdate(data) {
    // data = { value, max }
    if (
      this.progressBar &&
      data &&
      data.value !== undefined &&
      data.max !== undefined
    ) {
      if (Number(data.max) > 0) {
        // Avoid setting max to 0 or negative
        this.progressBar.setAttribute('max', data.max.toString());
      } else if (Number(data.max) === 0 && Number(data.value) === 0) {
        // If max is 0 and value is 0 (e.g. timer stopped, progress reset), set max to a nominal value
        this.progressBar.setAttribute('max', '1');
      }
      this.progressBar.setAttribute('value', data.value.toString());
    }
  }

  _handleSnapshotUpdated(eventData) {
    // eventData = { snapshot }
    if (eventData && eventData.snapshot) {
      this.updateChecksCounter(eventData.snapshot);
    } else {
      // If no snapshot, perhaps clear or show loading for counter
      this.updateChecksCounter(null);
    }
  }

  updateProgressBar(value, max) {
    if (this.progressBar) {
      if (max !== undefined && Number(max) > 0) this.progressBar.max = max;
      else if (max !== undefined && Number(max) === 0 && Number(value) === 0)
        this.progressBar.max = 1;
      if (value !== undefined) this.progressBar.value = value;
    }
  }

  updateChecksCounter(snapshot = null) {
    if (!this.checksCounter) return;

    if (!snapshot || !snapshot.locations || !snapshot.flags) {
      this.checksCounter.textContent = 'Checked: ?/?';
      this.checksCounter.title = 'Location data not yet available.';
      return;
    }

    const locationsArray = Array.isArray(snapshot.locations)
      ? snapshot.locations
      : Object.values(snapshot.locations);

    const totalNonEventLocations = locationsArray.filter(
      (loc) => loc.id !== null && loc.id !== undefined
    ).length;
    const checkedNonEventLocations = snapshot.flags.filter((flagName) => {
      const loc = locationsArray.find((l) => l.name === flagName);
      return loc && loc.id !== null && loc.id !== undefined;
    }).length;

    this.checksCounter.textContent = `Checked: ${checkedNonEventLocations}/${totalNonEventLocations}`;
    this.checksCounter.title = `Locations checked: ${checkedNonEventLocations} out of ${totalNonEventLocations}`;
  }

  setControlButtonState(isStarted) {
    if (this.controlButton) {
      this.controlButton.textContent = isStarted ? 'Stop' : 'Begin!';
    }
  }

  enableControls(enable) {
    if (this.controlButton) this.controlButton.disabled = !enable;
    if (this.quickCheckButton) this.quickCheckButton.disabled = !enable;
  }

  dispose() {
    console.log('[TimerUI] Disposing...');
    this.unsubscribeHandles.forEach((unsub) => unsub());
    this.unsubscribeHandles = [];
    // DOM element will be removed by its parent (ClientUI or PanelManager)
    this.domElement = null;
  }
}
