import eventBus from '../../app/core/eventBus.js';
import { testLogic } from './testLogic.js';

export class TestUI {
  constructor(container, componentState) {
    this.container = container; // Golden Layout container
    this.componentState = componentState; // Not used for now, but good to have
    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('tests-panel-container');
    this.testListElement = null; // To hold the list of tests

    console.log('[TestUI constructor] rootElement created:', this.rootElement);

    this._initializeUI();
    this._attachEventListeners();
    this._subscribeToLogicEvents();
  }

  // Called by Golden Layout to get the DOM element for the panel
  getRootElement() {
    console.log(
      '[TestUI getRootElement] Returning rootElement:',
      this.rootElement ? this.rootElement.outerHTML : 'null'
    );
    return this.rootElement;
  }

  _initializeUI() {
    console.log('[TestUI _initializeUI] Called.');
    this.rootElement.innerHTML = `
      <div class="tests-panel-controls">
        <button id="runAllEnabledTestsBtn">Run All Enabled Tests</button>
        <!-- More global controls can be added here -->
      </div>
      <div class="tests-list-container">
        <h3>Tests</h3>
        <ul id="testsList" class="tests-list"></ul>
      </div>
    `;
    console.log(
      '[TestUI _initializeUI] rootElement.innerHTML set. Current rootElement.outerHTML:',
      this.rootElement.outerHTML
    );

    this.testListElement = this.rootElement.querySelector('#testsList');
    console.log(
      '[TestUI _initializeUI] testListElement selected:',
      this.testListElement ? this.testListElement.outerHTML : 'null'
    );

    this.runAllEnabledTestsBtn = this.rootElement.querySelector(
      '#runAllEnabledTestsBtn'
    );
    console.log(
      '[TestUI _initializeUI] runAllEnabledTestsBtn selected:',
      this.runAllEnabledTestsBtn
    );

    this.renderTestList(); // Initial render
    console.log('[TestUI _initializeUI] Finished.');
  }

  renderTestList() {
    console.log('[TestUI renderTestList] Called.'); // Log when the function is called
    if (
      !this.testListElement ||
      !testLogic ||
      typeof testLogic.getTests !== 'function'
    ) {
      console.warn(
        '[TestUI] Cannot render test list: testListElement or testLogic.getTests not available.'
      );
      if (this.testListElement) {
        this.testListElement.innerHTML = '<li>Error loading tests.</li>';
      }
      return;
    }

    const tests = testLogic.getTests();
    console.log(
      '[TestUI renderTestList] Tests received from testLogic.getTests():',
      tests ? JSON.parse(JSON.stringify(tests)) : 'null or undefined'
    ); // Log the received tests

    this.testListElement.innerHTML = ''; // Clear previous list
    console.log('[TestUI renderTestList] testListElement cleared.');

    if (!tests || tests.length === 0) {
      console.log(
        '[TestUI renderTestList] No tests to display or tests array is empty.'
      ); // Log if no tests
      this.testListElement.innerHTML = '<li>No tests defined yet.</li>';
      return;
    }

    console.log(`[TestUI renderTestList] Rendering ${tests.length} tests.`); // Log number of tests to render
    tests.forEach((test, index) => {
      console.log(
        `[TestUI renderTestList] Processing test #${index}:`,
        JSON.parse(JSON.stringify(test))
      );
      const listItem = document.createElement('li');
      listItem.classList.add('test-item');
      listItem.dataset.testId = test.id;

      // Sanitize potential HTML in names/descriptions if they can come from unsafe sources
      // For now, assuming they are developer-defined strings.
      listItem.innerHTML = `
        <div class="test-item-header">
          <input type="checkbox" class="test-enable-checkbox" data-testid="${
            test.id
          }" ${test.isEnabled ? 'checked' : ''}>
          <span class="test-name">${test.name}</span>
          <div class="test-item-controls">
            <button class="test-run-btn" data-testid="${test.id}">Run</button>
            <button class="test-order-up-btn" data-testid="${
              test.id
            }">↑</button>
            <button class="test-order-down-btn" data-testid="${
              test.id
            }">↓</button>
          </div>
        </div>
        ${
          test.description
            ? `<p class="test-description">${test.description}</p>`
            : ''
        }
        <div class="test-status">Status: <span class="status-value">${
          test.status || 'pending'
        }</span></div>
        ${
          test.currentEventWaitingFor
            ? `<div class="test-waiting-event">Waiting for: ${test.currentEventWaitingFor}</div>`
            : ''
        }
        <div class="test-conditions">
          <strong>Conditions:</strong>
          <ul class="test-conditions-list">
            ${
              test.conditions && test.conditions.length > 0
                ? test.conditions
                    .map(
                      (c) =>
                        `<li class="condition-${c.status}">${c.description} (${c.status})</li>`
                    )
                    .join('')
                : '<li>No conditions reported yet.</li>'
            }
          </ul>
        </div>
      `;
      console.log(
        `[TestUI renderTestList] Test #${index} listItem.innerHTML set to:`,
        listItem.innerHTML
      );
      console.log(
        `[TestUI renderTestList] Test #${index} listItem.outerHTML after innerHTML:`,
        listItem.outerHTML
      );

      this.testListElement.appendChild(listItem);
      console.log(
        `[TestUI renderTestList] Test #${index} listItem appended to testListElement.`
      );
    });

    console.log(
      '[TestUI renderTestList] Finished processing all tests. Final testListElement.innerHTML:',
      this.testListElement.innerHTML
    );
    console.log(
      '[TestUI renderTestList] Final rootElement.outerHTML:',
      this.rootElement.outerHTML
    );
  }

  _attachEventListeners() {
    if (this.runAllEnabledTestsBtn) {
      this.runAllEnabledTestsBtn.addEventListener('click', () => {
        if (testLogic && typeof testLogic.runAllEnabledTests === 'function') {
          testLogic.runAllEnabledTests();
        }
      });
    }

    // Use event delegation for test item controls
    this.rootElement.addEventListener('click', (event) => {
      const target = event.target;
      const testId = target.dataset.testid;

      if (!testId || !testLogic) return;

      if (target.classList.contains('test-enable-checkbox')) {
        if (typeof testLogic.toggleTestEnabled === 'function') {
          testLogic.toggleTestEnabled(testId, target.checked);
        }
      } else if (target.classList.contains('test-run-btn')) {
        if (typeof testLogic.runTest === 'function') {
          testLogic.runTest(testId);
        }
      } else if (target.classList.contains('test-order-up-btn')) {
        if (typeof testLogic.updateTestOrder === 'function') {
          testLogic.updateTestOrder(testId, 'up');
        }
      } else if (target.classList.contains('test-order-down-btn')) {
        if (typeof testLogic.updateTestOrder === 'function') {
          testLogic.updateTestOrder(testId, 'down');
        }
      }
    });
  }

  _subscribeToLogicEvents() {
    // These events will trigger a re-render of the test list or specific items
    eventBus.subscribe('test:listUpdated', () => this.renderTestList());
    eventBus.subscribe('test:statusChanged', () => this.renderTestList()); // Could be optimized to update only one item
    eventBus.subscribe('test:conditionReported', () => this.renderTestList()); // Could be optimized
    // Add more specific event handlers if needed for performance, e.g., updating a single test item
  }

  // Golden Layout lifecycle methods (optional, but good practice)
  onPanelResize(width, height) {
    // console.log('[TestUI] Panel resized', width, height);
  }

  onPanelDestroy() {
    // Unsubscribe from eventBus events if any were directly subscribed by the instance
    // For now, subscriptions are module-level, handled by eventBus itself or init script upon module disable/unload
    console.log('[TestUI] Panel destroyed');
  }
}
