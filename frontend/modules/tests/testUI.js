// frontend/modules/tests/testUI.js
import { testLogic } from './testLogic.js';
import eventBus from '../../app/core/eventBus.js';

export class TestUI {
  constructor(container, componentState) {
    this.container = container;
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'tests-panel-content panel-container'; // Added panel-container
    this.rootElement.style.padding = '10px';
    this.rootElement.style.height = '100%';
    this.rootElement.style.overflowY = 'auto';

    this.testListContainer = document.createElement('div');
    this.testListContainer.className = 'test-list-container';

    this.unsubscribeHandles = [];

    this._buildInitialUI();
    this.container.element.appendChild(this.rootElement);

    this._attachEventListeners();
    this._subscribeToLogicEvents();

    // Initial render
    this.renderTestList();

    // GoldenLayout lifecycle
    this.container.on('destroy', () => this.destroy());
    this.container.on('open', () => this.renderTestList()); // Re-render if panel is re-opened
  }

  _buildInitialUI() {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'test-panel-controls';
    controlsContainer.style.marginBottom = '10px';

    const runAllButton = document.createElement('button');
    runAllButton.textContent = 'Run All Enabled Tests';
    runAllButton.className = 'button run-all-tests-button';
    controlsContainer.appendChild(runAllButton);

    // Placeholder for overall status
    this.overallStatusElement = document.createElement('div');
    this.overallStatusElement.className = 'overall-test-status';
    this.overallStatusElement.style.marginTop = '5px';
    controlsContainer.appendChild(this.overallStatusElement);

    this.rootElement.appendChild(controlsContainer);
    this.rootElement.appendChild(this.testListContainer);
  }

  _attachEventListeners() {
    this.rootElement
      .querySelector('.run-all-tests-button')
      .addEventListener('click', async () => {
        this.overallStatusElement.textContent = 'Running all tests...';
        try {
          await testLogic.runAllEnabledTests();
        } catch (error) {
          console.error('Error running all tests:', error);
          this.overallStatusElement.textContent = `Error: ${error.message}`;
          this.overallStatusElement.style.color = 'red';
        }
      });

    // Event delegation for individual test buttons
    this.testListContainer.addEventListener('click', (event) => {
      const target = event.target;
      const testItemElement = target.closest('.test-item');
      if (!testItemElement) return;

      const testId = testItemElement.dataset.testId;

      if (target.classList.contains('run-single-test-button')) {
        testLogic.runTest(testId);
      } else if (target.classList.contains('test-enable-checkbox')) {
        testLogic.toggleTestEnabled(testId, target.checked);
        // testLogic should emit test:listUpdated, which will trigger re-render
      } else if (target.classList.contains('move-test-up-button')) {
        testLogic.updateTestOrder(testId, 'up');
      } else if (target.classList.contains('move-test-down-button')) {
        testLogic.updateTestOrder(testId, 'down');
      }
    });
  }

  _subscribeToLogicEvents() {
    const handlers = {
      'test:listUpdated': (data) => this.renderTestList(data.tests),
      'test:statusChanged': (data) =>
        this.updateTestStatus(data.testId, data.status, data.eventWaitingFor),
      'test:conditionReported': (data) =>
        this.updateTestCondition(data.testId, data.condition),
      'test:allRunsCompleted': (data) =>
        this.displayOverallSummary(data.summary),
      'test:logMessage': (data) =>
        this.logTestMessage(data.testId, data.message, data.type),
    };

    for (const [eventName, handler] of Object.entries(handlers)) {
      const unsubscribe = eventBus.subscribe(eventName, handler.bind(this));
      this.unsubscribeHandles.push(unsubscribe);
    }
  }

  renderTestList(testsToRender = null) {
    const tests = testsToRender || testLogic.getTests();
    this.testListContainer.innerHTML = ''; // Clear previous content

    if (!tests || tests.length === 0) {
      this.testListContainer.textContent = 'No tests defined yet.';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'tests-ul';
    ul.style.listStyle = 'none';
    ul.style.padding = '0';

    tests.forEach((test) => {
      const li = document.createElement('li');
      li.className = 'test-item';
      li.dataset.testId = test.id;
      li.style.border = '1px solid #444';
      li.style.marginBottom = '8px';
      li.style.padding = '8px';
      li.style.borderRadius = '4px';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';

      const nameDescDiv = document.createElement('div');
      const nameEl = document.createElement('strong');
      nameEl.textContent = test.name;
      nameDescDiv.appendChild(nameEl);

      if (test.description) {
        const descEl = document.createElement('p');
        descEl.textContent = test.description;
        descEl.style.fontSize = '0.9em';
        descEl.style.color = '#aaa';
        descEl.style.margin = '4px 0 0 0';
        nameDescDiv.appendChild(descEl);
      }
      header.appendChild(nameDescDiv);

      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'test-item-controls';
      controlsDiv.style.display = 'flex';
      controlsDiv.style.alignItems = 'center';
      controlsDiv.style.gap = '5px';

      const enableLabel = document.createElement('label');
      enableLabel.style.display = 'flex';
      enableLabel.style.alignItems = 'center';
      const enableCheckbox = document.createElement('input');
      enableCheckbox.type = 'checkbox';
      enableCheckbox.className = 'test-enable-checkbox';
      enableCheckbox.checked = test.isEnabled;
      enableCheckbox.title = 'Enable/Disable Test';
      enableLabel.appendChild(enableCheckbox);
      enableLabel.appendChild(document.createTextNode('Enabled'));
      controlsDiv.appendChild(enableLabel);

      const upButton = document.createElement('button');
      upButton.textContent = '↑';
      upButton.className = 'button button-small move-test-up-button';
      upButton.title = 'Move Up';
      controlsDiv.appendChild(upButton);

      const downButton = document.createElement('button');
      downButton.textContent = '↓';
      downButton.className = 'button button-small move-test-down-button';
      downButton.title = 'Move Down';
      controlsDiv.appendChild(downButton);

      const runButton = document.createElement('button');
      runButton.textContent = 'Run';
      runButton.className = 'button button-small run-single-test-button';
      controlsDiv.appendChild(runButton);

      header.appendChild(controlsDiv);
      li.appendChild(header);

      const statusEl = document.createElement('div');
      statusEl.className = 'test-status-display';
      statusEl.textContent = `Status: ${test.status || 'pending'}`;
      if (test.status === 'waiting_for_event' && test.currentEventWaitingFor) {
        statusEl.textContent += ` (Waiting for: ${test.currentEventWaitingFor})`;
      }
      statusEl.style.fontSize = '0.9em';
      statusEl.style.marginTop = '4px';
      this._setTestStatusColor(statusEl, test.status);
      li.appendChild(statusEl);

      const conditionsEl = document.createElement('ul');
      conditionsEl.className = 'test-conditions-list';
      conditionsEl.style.paddingLeft = '20px';
      conditionsEl.style.marginTop = '5px';
      conditionsEl.style.fontSize = '0.85em';
      test.conditions.forEach((cond) => {
        const condItem = document.createElement('li');
        condItem.textContent = `${cond.status === 'passed' ? '✅' : '❌'} ${
          cond.description
        }`;
        condItem.style.color =
          cond.status === 'passed' ? 'lightgreen' : 'lightcoral';
        conditionsEl.appendChild(condItem);
      });
      li.appendChild(conditionsEl);

      // Log area for this specific test
      const logArea = document.createElement('div');
      logArea.className = 'test-log-area';
      logArea.style.maxHeight = '100px';
      logArea.style.overflowY = 'auto';
      logArea.style.background = '#2a2a2a';
      logArea.style.padding = '5px';
      logArea.style.fontSize = '0.8em';
      logArea.style.marginTop = '5px';
      logArea.style.border = '1px solid #404040';
      li.appendChild(logArea);

      ul.appendChild(li);
    });
    this.testListContainer.appendChild(ul);
  }

  updateTestStatus(testId, status, eventWaitingFor = null) {
    const testItemElement = this.testListContainer.querySelector(
      `.test-item[data-test-id="${testId}"]`
    );
    if (testItemElement) {
      const statusEl = testItemElement.querySelector('.test-status-display');
      if (statusEl) {
        statusEl.textContent = `Status: ${status}`;
        if (status === 'waiting_for_event' && eventWaitingFor) {
          statusEl.textContent += ` (Waiting for: ${eventWaitingFor})`;
        }
        this._setTestStatusColor(statusEl, status);
      }
      if (status === 'running') {
        // Clear previous conditions and logs when a test starts running
        const conditionsList = testItemElement.querySelector(
          '.test-conditions-list'
        );
        if (conditionsList) conditionsList.innerHTML = '';
        const logArea = testItemElement.querySelector('.test-log-area');
        if (logArea) logArea.innerHTML = '';
      }
    }
  }

  updateTestCondition(testId, condition) {
    const testItemElement = this.testListContainer.querySelector(
      `.test-item[data-test-id="${testId}"]`
    );
    if (testItemElement) {
      const conditionsList = testItemElement.querySelector(
        '.test-conditions-list'
      );
      if (conditionsList) {
        const condItem = document.createElement('li');
        condItem.textContent = `${
          condition.status === 'passed' ? '✅' : '❌'
        } ${condition.description}`;
        condItem.style.color =
          condition.status === 'passed' ? 'lightgreen' : 'lightcoral';
        conditionsList.appendChild(condItem);
      }
    }
  }

  logTestMessage(testId, message, type = 'info') {
    const testItemElement = this.testListContainer.querySelector(
      `.test-item[data-test-id="${testId}"]`
    );
    if (testItemElement) {
      const logArea = testItemElement.querySelector('.test-log-area');
      if (logArea) {
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        if (type === 'error') logEntry.style.color = 'lightcoral';
        else if (type === 'warn') logEntry.style.color = 'orange';
        else logEntry.style.color = '#ccc'; // Default log color
        logArea.appendChild(logEntry);
        logArea.scrollTop = logArea.scrollHeight; // Auto-scroll
      }
    }
  }

  displayOverallSummary(summary) {
    if (this.overallStatusElement) {
      this.overallStatusElement.textContent = `All tests finished. Passed: ${summary.passedCount}, Failed: ${summary.failedCount}, Total: ${summary.totalRun}.`;
      if (summary.failedCount > 0) {
        this.overallStatusElement.style.color = 'lightcoral';
      } else {
        this.overallStatusElement.style.color = 'lightgreen';
      }
    }
  }

  _setTestStatusColor(element, status) {
    switch (status) {
      case 'pending':
        element.style.color = '#ccc';
        break;
      case 'running':
      case 'waiting_for_event':
        element.style.color = 'lightblue';
        break;
      case 'passed':
        element.style.color = 'lightgreen';
        break;
      case 'failed':
        element.style.color = 'lightcoral';
        break;
      default:
        element.style.color = '#ccc';
    }
  }

  destroy() {
    console.log(
      '[TestUI] Destroying TestUI panel and unsubscribing from events.'
    );
    this.unsubscribeHandles.forEach((unsub) => unsub());
    this.unsubscribeHandles = [];
    // Further cleanup if necessary
  }
}
