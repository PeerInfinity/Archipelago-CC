import eventBus from '../../app/core/eventBus.js';
import settingsManager from '../../app/core/settingsManager.js'; // For loading test-specific settings files

// At the top of testLogic.js, for initial population if no saved state
let tests = [
  {
    id: 'sample1',
    name: 'Sample Test: Always Passes',
    description: 'Demonstrates a simple passing test.',
    functionName: 'sampleTestAlwaysPasses',
    isEnabled: true,
    order: 0,
    status: 'pending',
    conditions: [],
    currentEventWaitingFor: null,
  },
  {
    id: 'sample2',
    name: 'Sample Test: Always Fails',
    description: 'Demonstrates a simple failing test.',
    functionName: 'sampleTestAlwaysFails',
    isEnabled: true,
    order: 1,
    status: 'pending',
    conditions: [],
    currentEventWaitingFor: null,
  },
  {
    id: 'sample3',
    name: 'Sample Test: Waits for Event',
    description: 'Waits for a manually dispatched event.',
    functionName: 'sampleTestWaitsForEvent',
    isEnabled: true,
    order: 2,
    status: 'pending',
    conditions: [],
    currentEventWaitingFor: null,
  },
  {
    id: 'sample4',
    name: 'Sample Test: Dispatches Event',
    description: 'Dispatches an event and checks it.',
    functionName: 'sampleTestDispatchesEvent',
    isEnabled: true,
    order: 3,
    status: 'pending',
    conditions: [],
    currentEventWaitingFor: null,
  },
  {
    id: 'sample5',
    name: 'Sample Test: Loads Rules',
    description: 'Loads a test rules file.',
    functionName: 'sampleTestLoadsRules',
    isEnabled: true,
    order: 4,
    status: 'pending',
    conditions: [],
    currentEventWaitingFor: null,
  },
];

let autoStartTestsOnLoad = false;
let initializationApi = null; // To store the API from init.js for module interactions

// To keep track of the promise for the currently running test in runAllEnabledTests sequence
const activeTestPromises = new Map();

// Placeholder for actual test functions that will be defined later
const testFunctions = {
  async sampleTestAlwaysPasses(controller) {
    controller.log('Running sampleTestAlwaysPasses...');
    controller.reportCondition('This condition is hardcoded to pass.', true);
    controller.reportCondition('Another passing condition.', true);
    await controller.completeTest(true);
  },

  async sampleTestAlwaysFails(controller) {
    controller.log('Running sampleTestAlwaysFails...');
    controller.reportCondition('This condition is hardcoded to fail.', false);
    controller.reportCondition(
      'This condition passes, but the test will still fail.',
      true
    );
    await controller.completeTest(false);
  },

  async sampleTestWaitsForEvent(controller) {
    controller.log('Running sampleTestWaitsForEvent...');
    controller.reportCondition(
      'Step 1: Test started, about to wait for event.',
      true
    );
    try {
      // For this test to work, something needs to publish 'test:dummyEventForWait'
      // You could do this from the console: eventBus.publish('test:dummyEventForWait', { message: 'Hello from dummy event!' })
      controller.log('Waiting for test:dummyEventForWait...');
      const eventData = await controller.waitForEvent(
        'test:dummyEventForWait',
        3000
      ); // Wait for 3 seconds
      controller.reportCondition(
        `Event 'test:dummyEventForWait' received successfully. Data: ${JSON.stringify(
          eventData
        )}`,
        true
      );
      await controller.completeTest(true);
    } catch (error) {
      controller.log(`Error in sampleTestWaitsForEvent: ${error.message}`);
      controller.reportCondition(
        `Failed to receive 'test:dummyEventForWait' or other error: ${error.message}`,
        false
      );
      await controller.completeTest(false);
    }
  },

  async sampleTestDispatchesEvent(controller) {
    controller.log('Running sampleTestDispatchesEvent...');
    const eventName = 'test:dispatchedByTestAction';
    const eventPayload = { data: 'Sample payload from test' };

    let eventReceived = false;
    const unsubscribe = eventBus.subscribe(eventName, (payload) => {
      controller.log(
        `Event ${eventName} was observed with payload: ${JSON.stringify(
          payload
        )}`
      );
      if (JSON.stringify(payload) === JSON.stringify(eventPayload)) {
        eventReceived = true;
        controller.reportCondition(
          'Dispatched event was correctly observed by a temporary listener.',
          true
        );
      } else {
        controller.reportCondition(
          'Dispatched event was observed, but payload did not match.',
          false
        );
      }
      unsubscribe(); // Clean up listener
    });

    await controller.performAction({
      type: 'DISPATCH_EVENT',
      eventName: eventName,
      payload: eventPayload,
    });
    // Give a moment for the event to be processed by the temporary listener
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!eventReceived) {
      controller.reportCondition(
        'Dispatched event was NOT observed by temporary listener.',
        false
      );
    }
    unsubscribe(); // Ensure unsubscription if event not caught in time (though should be quick)
    await controller.completeTest(eventReceived);
  },

  async sampleTestLoadsRules(controller) {
    controller.log('Running sampleTestLoadsRules...');
    const rulesPath = './modules/tests/test_rules_simple.json'; // Path relative to frontend root
    try {
      await controller.loadConfiguration(rulesPath, 'rules');
      controller.reportCondition(
        `Action: loadConfiguration for rules '${rulesPath}' initiated.`,
        true
      );

      controller.log('Waiting for stateManager:rulesLoaded...');
      // This assumes 'stateManager:rulesLoaded' is published by stateManager/index.js upon successful rule processing.
      const eventData = await controller.waitForEvent(
        'stateManager:rulesLoaded',
        5000
      );
      controller.reportCondition(
        `Event 'stateManager:rulesLoaded' received. Source: ${eventData?.sourceName}`,
        true
      );

      // TODO: Add actual verification of the loaded rules if possible, e.g., by checking stateManager snapshot
      await controller.completeTest(true);
    } catch (error) {
      controller.log(`Error in sampleTestLoadsRules: ${error.message}`);
      controller.reportCondition(
        `Test failed during rule loading or event waiting: ${error.message}`,
        false
      );
      await controller.completeTest(false);
    }
  },
};

export const testLogic = {
  setInitializationApi(api) {
    initializationApi = api;
    console.log('[TestLogic] Initialization API set.');
  },

  getTests() {
    console.log(
      '[TestLogic getTests] Original tests array before processing:',
      JSON.parse(JSON.stringify(tests))
    );
    // Return a deep copy to prevent direct modification from UI
    const sortedTests = tests.sort((a, b) => a.order - b.order);
    console.log(
      '[TestLogic getTests] Sorted tests array:',
      JSON.parse(JSON.stringify(sortedTests))
    );
    const result = JSON.parse(JSON.stringify(sortedTests));
    console.log(
      '[TestLogic getTests] Returning tests:',
      JSON.parse(JSON.stringify(result))
    );
    return result;
  },

  getSavableState() {
    console.log('[TestLogic] getSavableState called.');
    const savableTests = tests.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      functionName: t.functionName,
      isEnabled: t.isEnabled,
      order: t.order,
    }));
    return { tests: savableTests, autoStartTestsOnLoad };
  },

  applyLoadedState(loadedData) {
    console.log('[TestLogic] applyLoadedState called with:', loadedData);
    if (loadedData) {
      if (Array.isArray(loadedData.tests)) {
        tests = loadedData.tests.map((t, index) => ({
          ...t,
          id: t.id || `test-${Date.now()}-${index}`, // Ensure ID exists
          order: t.order !== undefined ? t.order : index, // Ensure order exists
          isEnabled: t.isEnabled !== undefined ? t.isEnabled : true,
          status: 'pending',
          conditions: [],
          currentEventWaitingFor: null,
        }));
      } else {
        tests = [];
      }
      autoStartTestsOnLoad = !!loadedData.autoStartTestsOnLoad;
      eventBus.publish('test:listUpdated');
    }
  },

  getAutoStartSetting() {
    return autoStartTestsOnLoad;
  },

  // --- Internal Helper Methods ---
  _findTestById(testId) {
    return tests.find((t) => t.id === testId);
  },

  _updateTestStatus(testId, status, eventWaitingFor = null) {
    const test = this._findTestById(testId);
    if (test) {
      test.status = status;
      test.currentEventWaitingFor = eventWaitingFor;
      console.log(
        `[TestLogic] Test ${testId} status updated to: ${status}, waitingFor: ${eventWaitingFor}`
      );
      eventBus.publish('test:statusChanged', {
        testId,
        status,
        eventWaitingFor,
        conditions: test.conditions,
      });
    } else {
      console.warn(
        `[TestLogic] _updateTestStatus: Test with ID ${testId} not found.`
      );
    }
  },

  _addTestCondition(testId, description, passed) {
    const test = this._findTestById(testId);
    if (test) {
      test.conditions.push({
        description,
        status: passed ? 'passed' : 'failed',
      });
      eventBus.publish('test:conditionReported', {
        testId,
        conditions: test.conditions,
      });
    } else {
      console.warn(
        `[TestLogic] _addTestCondition: Test with ID ${testId} not found.`
      );
    }
  },

  _handleTestCompletion(testId, overallPassStatus) {
    const test = this._findTestById(testId);
    if (test) {
      test.status = overallPassStatus ? 'passed' : 'failed';
      test.currentEventWaitingFor = null;
      console.log(
        `[TestLogic] Test ${testId} completed with status: ${test.status}`
      );
      eventBus.publish('test:completed', {
        testId,
        name: test.name,
        overallStatus: test.status,
        conditions: test.conditions,
      });

      // Resolve the promise for this test if it's part of a sequence
      if (activeTestPromises.has(testId)) {
        const { resolve } = activeTestPromises.get(testId);
        resolve(); // Signal completion to runAllEnabledTests
        activeTestPromises.delete(testId);
      }
    } else {
      console.warn(
        `[TestLogic] _handleTestCompletion: Test with ID ${testId} not found.`
      );
    }
  },

  // --- UI Interaction Methods ---
  toggleTestEnabled(testId, isEnabled) {
    const test = this._findTestById(testId);
    if (test) {
      test.isEnabled = isEnabled;
      eventBus.publish('test:listUpdated'); // Triggers a full re-render in UI for now
    } else {
      console.warn(
        `[TestLogic] toggleTestEnabled: Test with ID ${testId} not found.`
      );
    }
  },

  updateTestOrder(testId, direction) {
    const testIndex = tests.findIndex((t) => t.id === testId);
    if (testIndex === -1) {
      console.warn(
        `[TestLogic] updateTestOrder: Test with ID ${testId} not found.`
      );
      return;
    }

    const currentOrder = tests[testIndex].order;
    let newOrder;

    if (direction === 'up') {
      if (testIndex === 0) return; // Already at the top
      const prevTest = tests[testIndex - 1];
      newOrder = prevTest.order;
      // Swap orders: give current test the previous test's order,
      // and previous test current test's original order.
      tests[testIndex].order = newOrder;
      prevTest.order = currentOrder;
    } else if (direction === 'down') {
      if (testIndex === tests.length - 1) return; // Already at the bottom
      const nextTest = tests[testIndex + 1];
      newOrder = nextTest.order;
      tests[testIndex].order = newOrder;
      nextTest.order = currentOrder;
    }

    // Re-sort the array by the order property to maintain consistency
    tests.sort((a, b) => a.order - b.order);
    // Normalize order values to be sequential integers starting from 0
    tests.forEach((test, index) => {
      test.order = index;
    });

    eventBus.publish('test:listUpdated');
  },

  // --- Test Execution Methods ---
  runTest(testId) {
    const test = this._findTestById(testId);
    if (!test) {
      console.warn(`[TestLogic] runTest: Test with ID ${testId} not found.`);
      return;
    }
    if (!testFunctions[test.functionName]) {
      console.error(
        `[TestLogic] runTest: Test function '${test.functionName}' not found for test ID ${testId}.`
      );
      this._updateTestStatus(
        testId,
        'failed',
        `Function ${test.functionName} not found.`
      );
      this._handleTestCompletion(testId, false);
      return;
    }

    console.log(`[TestLogic] Starting test: ${test.name} (ID: ${testId})`);
    // Reset conditions and status before running
    test.conditions = [];
    this._updateTestStatus(testId, 'running');
    eventBus.publish('test:executionStarted', { testId, name: test.name });

    const controller = new TestController(testId, this);
    const testFunction = testFunctions[test.functionName];

    // Run the test function. It's async, but runTest itself is not async.
    // The test function will call controller.completeTest() which then calls _handleTestCompletion.
    // For runAllEnabledTests, _handleTestCompletion resolves a promise to sequence tests.
    (async () => {
      try {
        await testFunction(controller);
        // If testFunction completes without calling completeTest(false), assume pass for now, but ideally it should always call completeTest.
        // However, completeTest is the primary mechanism for finalization.
      } catch (error) {
        console.error(
          `[TestLogic] Error executing test function ${test.functionName} for test ${testId}:`,
          error
        );
        controller.reportCondition(
          `Test function errored: ${error.message}`,
          false
        );
        // Ensure completion is still handled if an unhandled error occurs in the test function itself
        // (though well-behaved tests should use completeTest).
        if (test.status !== 'passed' && test.status !== 'failed') {
          this._updateTestStatus(
            testId,
            'failed',
            `Unhandled error: ${error.message}`
          );
          this._handleTestCompletion(testId, false);
        }
      }
    })();
  },

  async runAllEnabledTests() {
    const enabledTests = tests
      .filter((t) => t.isEnabled)
      .sort((a, b) => a.order - b.order);
    if (enabledTests.length === 0) {
      console.log('[TestLogic] No enabled tests to run.');
      eventBus.publish('test:allRunsCompleted', {
        summary: { passedCount: 0, failedCount: 0, totalRun: 0 },
      });
      return;
    }

    console.log(
      `[TestLogic] Starting to run ${enabledTests.length} enabled tests sequentially...`
    );
    let passedCount = 0;
    let failedCount = 0;

    for (const test of enabledTests) {
      // Create a promise that will be resolved by _handleTestCompletion
      const testCompletionPromise = new Promise((resolve) => {
        activeTestPromises.set(test.id, { resolve });
      });

      this.runTest(test.id); // Start the test

      await testCompletionPromise; // Wait for this specific test to complete via its promise

      // After completion, check its status
      const completedTest = this._findTestById(test.id);
      if (completedTest && completedTest.status === 'passed') {
        passedCount++;
      } else {
        failedCount++;
      }
    }

    console.log('[TestLogic] All enabled tests have completed.');
    eventBus.publish('test:allRunsCompleted', {
      summary: { passedCount, failedCount, totalRun: enabledTests.length },
    });
  },
};

// --- TestController Class ---
class TestController {
  constructor(testId, testLogicInstance) {
    this.testId = testId;
    this.testLogic = testLogicInstance; // Reference to the main testLogic object
    this.activeEventSubscriptions = new Map(); // To manage event listeners for waitForEvent
  }

  /**
   * Reports a condition (assertion) for the current test.
   * @param {string} description - A description of the condition being checked.
   * @param {boolean} passed - True if the condition passed, false otherwise.
   */
  reportCondition(description, passed) {
    if (
      this.testLogic &&
      typeof this.testLogic._addTestCondition === 'function'
    ) {
      this.testLogic._addTestCondition(this.testId, description, passed);
    }
  }

  /**
   * Logs a message associated with the current test.
   * These logs can be collected for Playwright output.
   * @param {string} message - The message to log.
   */
  log(message) {
    // For now, just console.log. testLogic could intercept this later.
    console.log(`[TestRunner][${this.testId}] ${message}`);
    // TODO: Potentially forward to testLogic to store logs for Playwright
  }

  /**
   * Signals that the current test function has completed its execution.
   * @param {boolean} overallPassStatus - True if the test passed, false otherwise.
   */
  async completeTest(overallPassStatus) {
    if (
      this.testLogic &&
      typeof this.testLogic._handleTestCompletion === 'function'
    ) {
      // Clean up any active event subscriptions for this test controller instance
      this.activeEventSubscriptions.forEach((unsubscribe) => unsubscribe());
      this.activeEventSubscriptions.clear();

      this.testLogic._handleTestCompletion(this.testId, overallPassStatus);
    }
  }

  /**
   * Pauses test execution until a specific event is caught on the eventBus or a timeout occurs.
   * @param {string} eventName - The name of the event to wait for.
   * @param {number} timeoutMilliseconds - Maximum time to wait for the event.
   * @returns {Promise<any>} A promise that resolves with the event data or rejects on timeout/error.
   */
  async waitForEvent(eventName, timeoutMilliseconds = 5000) {
    if (!eventBus) {
      this.log(`ERROR: eventBus not available for waitForEvent(${eventName})`);
      throw new Error('eventBus is not available.');
    }

    if (
      this.testLogic &&
      typeof this.testLogic._updateTestStatus === 'function'
    ) {
      this.testLogic._updateTestStatus(
        this.testId,
        'waiting_for_event',
        eventName
      );
    }
    this.log(
      `Waiting for event: ${eventName} (timeout: ${timeoutMilliseconds}ms)`
    );

    return new Promise((resolve, reject) => {
      let timeoutId = null;
      const unsubscribe = eventBus.subscribe(eventName, (data) => {
        if (timeoutId) clearTimeout(timeoutId);
        unsubscribe(); // Unsubscribe after receiving the event
        this.activeEventSubscriptions.delete(eventName); // Remove from map
        this.log(`Event received: ${eventName}`);
        if (
          this.testLogic &&
          typeof this.testLogic._updateTestStatus === 'function'
        ) {
          // Revert status from 'waiting_for_event' or let the test function proceed
          this.testLogic._updateTestStatus(this.testId, 'running'); // Or to a more specific status
        }
        resolve(data);
      });

      this.activeEventSubscriptions.set(eventName, unsubscribe); // Store unsubscribe function

      timeoutId = setTimeout(() => {
        unsubscribe();
        this.activeEventSubscriptions.delete(eventName);
        this.log(`Timeout waiting for event: ${eventName}`);
        if (
          this.testLogic &&
          typeof this.testLogic._updateTestStatus === 'function'
        ) {
          // Optionally, set a specific status like 'timed_out' or revert to 'running' so test can fail itself
          this.testLogic._updateTestStatus(
            this.testId,
            'failed',
            `Timeout waiting for ${eventName}`
          );
        }
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeoutMilliseconds);
    });
  }

  // --- New Methods for TestController ---
  async performAction(actionDetailsObject) {
    this.log(`Performing action: ${actionDetailsObject.type}`);
    if (!actionDetailsObject || !actionDetailsObject.type) {
      this.reportCondition(
        'performAction called with invalid actionDetailsObject',
        false
      );
      throw new Error('Invalid actionDetailsObject');
    }

    try {
      switch (actionDetailsObject.type) {
        case 'DISPATCH_EVENT':
          if (!eventBus) throw new Error('eventBus not available');
          this.log(
            `Dispatching event: ${
              actionDetailsObject.eventName
            } with payload: ${JSON.stringify(actionDetailsObject.payload)}`
          );
          eventBus.publish(
            actionDetailsObject.eventName,
            actionDetailsObject.payload
          );
          this.reportCondition(
            `Action: Dispatched event '${actionDetailsObject.eventName}'`,
            true
          );
          break;
        case 'CALL_MODULE_FUNCTION':
          if (
            !initializationApi ||
            typeof initializationApi.getModuleFunction !== 'function'
          ) {
            throw new Error(
              'initializationApi.getModuleFunction not available'
            );
          }
          const func = initializationApi.getModuleFunction(
            actionDetailsObject.targetModuleId,
            actionDetailsObject.functionName
          );
          if (typeof func !== 'function') {
            throw new Error(
              `Function ${actionDetailsObject.functionName} not found in module ${actionDetailsObject.targetModuleId}`
            );
          }
          this.log(
            `Calling module function: ${actionDetailsObject.targetModuleId}.${actionDetailsObject.functionName}`
          );
          // Assuming args is an array
          const result = await func.apply(null, actionDetailsObject.args || []);
          this.reportCondition(
            `Action: Called ${actionDetailsObject.targetModuleId}.${actionDetailsObject.functionName}`,
            true
          );
          return result; // Return result for the test to assert on if needed
        case 'SIMULATE_CLICK':
          if (!actionDetailsObject.selector)
            throw new Error('Selector missing for SIMULATE_CLICK');
          const element = document.querySelector(actionDetailsObject.selector);
          if (!element)
            throw new Error(
              `Element not found for selector: ${actionDetailsObject.selector}`
            );
          this.log(
            `Simulating click on selector: ${actionDetailsObject.selector}`
          );
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
            })
          );
          this.reportCondition(
            `Action: Clicked element '${actionDetailsObject.selector}'`,
            true
          );
          break;
        // Add DIRECT_SINGLETON_CALL later if absolutely necessary and how to manage it.
        default:
          throw new Error(
            `Unsupported action type: ${actionDetailsObject.type}`
          );
      }
    } catch (error) {
      this.log(
        `Error performing action ${actionDetailsObject.type}: ${error.message}`
      );
      this.reportCondition(
        `Action: ${actionDetailsObject.type} failed - ${error.message}`,
        false
      );
      throw error; // Re-throw so the test function can decide to stop or continue
    }
  }

  async loadConfiguration(filePathString, typeString) {
    this.log(`Loading configuration: ${filePathString} (type: ${typeString})`);
    if (!filePathString || !typeString) {
      this.reportCondition(
        'loadConfiguration called with invalid arguments',
        false
      );
      throw new Error(
        'filePathString and typeString are required for loadConfiguration.'
      );
    }

    try {
      const response = await fetch(filePathString);
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} for ${filePathString}`
        );
      }
      const jsonData = await response.json();
      this.log(`Successfully fetched ${filePathString}`);

      switch (typeString) {
        case 'rules':
          if (!eventBus)
            throw new Error('eventBus not available for loading rules');
          // Assuming player ID '1' for test rules for now. This could be configurable.
          eventBus.publish('files:jsonLoaded', {
            jsonData,
            selectedPlayerId: '1',
            sourceName: filePathString,
          });
          this.reportCondition(
            `Action: Dispatched files:jsonLoaded for rules '${filePathString}'`,
            true
          );
          // The test function MUST await waitForEvent('stateManager:rulesLoaded') after this.
          break;
        case 'settings':
          if (
            !settingsManager ||
            typeof settingsManager.updateSettings !== 'function'
          ) {
            throw new Error('settingsManager.updateSettings not available');
          }
          await settingsManager.updateSettings(jsonData);
          this.reportCondition(
            `Action: Applied settings from '${filePathString}'`,
            true
          );
          // The test function might await waitForEvent('settings:changed') or a short delay.
          break;
        // case 'modules': // More complex, handle in future phases
        //     this.log('Loading module configurations not yet implemented.');
        //     this.reportCondition('Loading module configurations (NYI)', false);
        //     break;
        default:
          throw new Error(`Unsupported configuration type: ${typeString}`);
      }
    } catch (error) {
      this.log(
        `Error loading configuration ${filePathString} (type ${typeString}): ${error.message}`
      );
      this.reportCondition(
        `Action: Load ${typeString} from '${filePathString}' failed - ${error.message}`,
        false
      );
      throw error; // Re-throw so the test function can handle
    }
  }
}
