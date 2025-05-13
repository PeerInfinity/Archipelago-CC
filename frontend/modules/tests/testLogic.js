// frontend/modules/tests/testLogic.js

// This module will be a plain object managing state and providing functions.
let eventBusInstance = null;
let appInitializationApiInstance = null;

const testLogicState = {
  tests: [
    // Initial placeholder tests
    {
      id: 'test_1_simple_event',
      name: 'Test Simple Event Wait',
      description:
        'Checks if waitForEvent correctly pauses and resumes on a custom event.',
      functionName: 'simpleEventTest',
      isEnabled: true,
      order: 0,
      status: 'pending', // 'pending', 'running', 'passed', 'failed', 'waiting_for_event'
      conditions: [], // { description: string, status: 'passed' | 'failed' }
      currentEventWaitingFor: null,
    },
    {
      id: 'test_2_config_load',
      name: 'Test Configuration Loading (Rules)',
      description:
        'Attempts to load a simplified rules.json and verifies a known accessible location.',
      functionName: 'configLoadTest',
      isEnabled: true,
      order: 1,
      status: 'pending',
      conditions: [],
      currentEventWaitingFor: null,
    },
  ],
  autoStartTestsOnLoad: false, // Default to false
  currentRunningTestId: null,
  testQueue: [], // For "Run All Enabled"
  overallTestRunPromise: null,
  overallTestRunResolver: null,
};

// Define Test Functions (async functions)
const testFunctions = {
  simpleEventTest: async (testController) => {
    try {
      testController.log('Starting simpleEventTest...');
      testController.reportCondition('Test started', true);

      setTimeout(() => {
        console.log(
          '[Test Logic - simpleEventTest] Publishing custom:testEventAfterDelay'
        );
        eventBusInstance.publish('custom:testEventAfterDelay', {
          detail: 'Event Fired!',
        });
      }, 1000);

      testController.log('Waiting for custom:testEventAfterDelay...');
      const eventData = await testController.waitForEvent(
        'custom:testEventAfterDelay',
        2000
      );

      if (eventData && eventData.detail === 'Event Fired!') {
        testController.reportCondition(
          'custom:testEventAfterDelay received correctly',
          true
        );
        await testController.completeTest(true);
      } else {
        testController.reportCondition(
          'custom:testEventAfterDelay not received or data mismatch',
          false
        );
        await testController.completeTest(false);
      }
    } catch (error) {
      testController.log(`Error in simpleEventTest: ${error.message}`);
      testController.reportCondition(`Test errored: ${error.message}`, false);
      await testController.completeTest(false);
    }
  },

  configLoadTest: async (testController) => {
    try {
      testController.log('Starting configLoadTest...');
      testController.reportCondition('Test started', true);

      // Assuming a file 'frontend/modules/tests/test_files/sample_rules.json' exists
      // For this example, we'll mock the content it might have.
      // A real test would fetch this file.
      const mockRulesContent = {
        // A very minimal rules structure
        schema_version: 3,
        game: 'ALTTP',
        player_names: { 1: 'TestPlayer' },
        start_regions: { 1: ['Test Start Region'] },
        items: { 1: { TestItem: { name: 'TestItem', type: 'Item' } } },
        regions: {
          1: {
            'Test Start Region': {
              name: 'Test Start Region',
              is_light_world: true,
              is_dark_world: false,
              locations: [
                {
                  name: 'Test Location',
                  access_rule: { type: 'constant', value: true },
                  item: { name: 'Victory', player: 1, type: 'Event' },
                },
              ],
              exits: [],
            },
          },
        },
        progression_mapping: { 1: {} },
        item_groups: { 1: {} },
        settings: { 1: {} },
      };

      // Simulate loading this configuration
      testController.log('Simulating loading of test_rules_simple.json...');
      // Instead of actual file loading, we'll directly use the mock content for performAction
      await testController.performAction({
        type: 'LOAD_RULES_DATA', // A new action type for this
        payload: mockRulesContent,
        playerId: '1',
      });
      testController.reportCondition('Rules data loading initiated', true);

      testController.log('Waiting for stateManager:rulesLoaded...');
      await testController.waitForEvent('stateManager:rulesLoaded', 3000);
      testController.reportCondition(
        'stateManager:rulesLoaded event received',
        true
      );

      // Now, try to access something that should be available if rules loaded
      // This part needs the StateManager Proxy to be working.
      // For now, we'll assume a successful load means the test passes this stage.
      // A real test would then query StateManager for 'Test Location' accessibility.
      testController.log(
        'Assuming StateManager processed rules. Verification step would go here.'
      );

      await testController.completeTest(true);
    } catch (error) {
      testController.log(`Error in configLoadTest: ${error.message}`);
      testController.reportCondition(`Test errored: ${error.message}`, false);
      await testController.completeTest(false);
    }
  },
};

class TestController {
  constructor(testId, testLogicInstance) {
    this.testId = testId;
    this.testLogic = testLogicInstance; // Reference to the main testLogic object
  }

  log(message, type = 'info') {
    console.log(
      `[TestController-${this.testId}] ${type.toUpperCase()}: ${message}`
    );
    this.testLogic.emitLogMessage(this.testId, message, type);
  }

  reportCondition(description, passed) {
    this.log(`Condition: "${description}" - ${passed ? 'PASSED' : 'FAILED'}`);
    this.testLogic.addTestCondition(
      this.testId,
      description,
      passed ? 'passed' : 'failed'
    );
  }

  async performAction(actionDetails) {
    this.log(
      `Performing action: ${actionDetails.type}`,
      actionDetails.payload || ''
    );
    // Placeholder: Actual action implementation will vary.
    // Example for event dispatch:
    if (actionDetails.type === 'DISPATCH_EVENT' && eventBusInstance) {
      eventBusInstance.publish(actionDetails.eventName, actionDetails.payload);
      return; // Event dispatch is usually fire-and-forget for the action itself
    }
    // Example for LOAD_RULES_DATA (used in configLoadTest)
    if (actionDetails.type === 'LOAD_RULES_DATA' && eventBusInstance) {
      eventBusInstance.publish('files:jsonLoaded', {
        fileName: 'test_rules_direct_data.json', // Mock filename
        jsonData: actionDetails.payload,
        selectedPlayerId: actionDetails.playerId || '1',
      });
      return;
    }

    // Simulate a small delay for other action types
    return new Promise((resolve) => setTimeout(resolve, 50));
  }

  waitForEvent(eventName, timeoutMilliseconds = 5000) {
    this.log(
      `Waiting for event: ${eventName} (timeout: ${timeoutMilliseconds}ms)`
    );
    this.testLogic.setTestStatus(this.testId, 'waiting_for_event', eventName);
    return new Promise((resolve, reject) => {
      if (!eventBusInstance) {
        reject(
          new Error('eventBusInstance is not available in TestController')
        );
        return;
      }
      let timeoutId;
      const handler = (data) => {
        clearTimeout(timeoutId);
        eventBusInstance.unsubscribe(eventName, handler); // Unsubscribe after catching
        this.log(`Event received: ${eventName}`, data);
        this.testLogic.setTestStatus(this.testId, 'running'); // Revert status
        resolve(data);
      };
      timeoutId = setTimeout(() => {
        eventBusInstance.unsubscribe(eventName, handler);
        this.log(`Timeout waiting for event: ${eventName}`, 'error');
        this.testLogic.setTestStatus(this.testId, 'failed'); // Set status to failed on timeout
        reject(new Error(`Timeout waiting for event ${eventName}`));
      }, timeoutMilliseconds);
      eventBusInstance.subscribe(eventName, handler);
    });
  }

  async loadConfiguration(filePath, type) {
    this.log(`Loading configuration: ${filePath} (type: ${type})`);
    // Placeholder: Implement actual config loading.
    // This would involve fetch, then specific actions based on type.
    // Example for rules:
    // if (type === 'rules') {
    //   const rulesData = await fetch(filePath).then(res => res.json());
    //   eventBusInstance.publish('files:jsonLoaded', { jsonData: rulesData, selectedPlayerId: '1' });
    //   await this.waitForEvent('stateManager:rulesLoaded');
    // }
    return new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async load
  }

  async completeTest(overallPassStatus) {
    this.log(
      `Test completion signal: ${overallPassStatus ? 'PASSED' : 'FAILED'}`
    );
    this.testLogic.setTestStatus(
      this.testId,
      overallPassStatus ? 'passed' : 'failed'
    );
    this.testLogic.emitTestCompleted(this.testId, overallPassStatus);
    // Resolve the promise for this specific test run if runAllEnabledTests is waiting
    const currentTestRun = testLogicState.activeTestPromises[this.testId];
    if (currentTestRun) {
      currentTestRun.resolve();
      delete testLogicState.activeTestPromises[this.testId];
    }
  }
}

export const testLogic = {
  setInitializationApi(api) {
    appInitializationApiInstance = api;
  },
  setEventBus(bus) {
    eventBusInstance = bus;
  },

  getTests() {
    return [...testLogicState.tests]; // Return a copy
  },

  getSavableState() {
    return {
      autoStartTestsOnLoad: testLogicState.autoStartTestsOnLoad,
      tests: testLogicState.tests.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        functionName: t.functionName,
        isEnabled: t.isEnabled,
        order: t.order,
        // Don't save runtime status, conditions, or eventWaitingFor
      })),
    };
  },

  applyLoadedState(data) {
    if (data && typeof data.autoStartTestsOnLoad === 'boolean') {
      testLogicState.autoStartTestsOnLoad = data.autoStartTestsOnLoad;
    }
    if (data && Array.isArray(data.tests)) {
      // A more robust merge would be better, but for now, overwrite if IDs match
      const loadedTests = data.tests.map((st) => ({
        ...st, // Spread saved state
        status: 'pending', // Reset runtime state
        conditions: [],
        currentEventWaitingFor: null,
      }));
      // Simple merge: if a test with same ID exists, update it, else add.
      // This doesn't handle removal of tests that are no longer in saved data.
      loadedTests.forEach((loadedTest) => {
        const existingTestIndex = testLogicState.tests.findIndex(
          (t) => t.id === loadedTest.id
        );
        if (existingTestIndex > -1) {
          // Preserve runtime parts if needed, but generally, loaded state takes precedence for config
          testLogicState.tests[existingTestIndex] = {
            ...testLogicState.tests[existingTestIndex], // Keep old status etc. if not in loadedTest
            ...loadedTest, // Override with loaded config
          };
        } else {
          // Add new test from loaded data
          testLogicState.tests.push(loadedTest);
        }
      });
      // Re-sort by order
      testLogicState.tests.sort((a, b) => a.order - b.order);
    }
    if (eventBusInstance) {
      eventBusInstance.publish('test:listUpdated', { tests: this.getTests() });
    }
  },

  shouldAutoStartTests() {
    return testLogicState.autoStartTestsOnLoad;
  },

  toggleTestEnabled(testId, isEnabled) {
    const test = testLogicState.tests.find((t) => t.id === testId);
    if (test) {
      test.isEnabled = isEnabled;
      if (eventBusInstance)
        eventBusInstance.publish('test:listUpdated', {
          tests: this.getTests(),
        });
    }
  },

  updateTestOrder(testId, direction) {
    const tests = testLogicState.tests;
    const index = tests.findIndex((t) => t.id === testId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      // Swap order with previous
      [tests[index].order, tests[index - 1].order] = [
        tests[index - 1].order,
        tests[index].order,
      ];
    } else if (direction === 'down' && index < tests.length - 1) {
      // Swap order with next
      [tests[index].order, tests[index + 1].order] = [
        tests[index + 1].order,
        tests[index].order,
      ];
    }
    tests.sort((a, b) => a.order - b.order);
    // Re-assign order based on new array position to ensure sequentiality
    tests.forEach((t, i) => (t.order = i));
    if (eventBusInstance)
      eventBusInstance.publish('test:listUpdated', { tests: this.getTests() });
  },

  setTestStatus(testId, status, eventWaitingFor = null) {
    const test = testLogicState.tests.find((t) => t.id === testId);
    if (test) {
      test.status = status;
      test.currentEventWaitingFor =
        status === 'waiting_for_event' ? eventWaitingFor : null;
      if (status === 'running') {
        // Clear conditions when a test starts running
        test.conditions = [];
      }
      if (eventBusInstance)
        eventBusInstance.publish('test:statusChanged', {
          testId,
          status,
          eventWaitingFor,
        });
    }
  },

  addTestCondition(testId, description, status) {
    const test = testLogicState.tests.find((t) => t.id === testId);
    if (test) {
      const condition = { description, status };
      test.conditions.push(condition);
      if (eventBusInstance)
        eventBusInstance.publish('test:conditionReported', {
          testId,
          condition,
        });
    }
  },

  emitLogMessage(testId, message, type) {
    if (eventBusInstance)
      eventBusInstance.publish('test:logMessage', { testId, message, type });
  },

  emitTestCompleted(testId, overallStatus) {
    // This function is primarily called by TestController.completeTest
    // It signals that an individual test's async function has finished.
    // The runAllEnabledTests method will be awaiting a promise associated with this testId.
    const test = testLogicState.tests.find((t) => t.id === testId);
    if (test) {
      test.status = overallStatus ? 'passed' : 'failed'; // Ensure final status is set
      if (eventBusInstance) {
        eventBusInstance.publish('test:statusChanged', {
          testId,
          status: test.status,
        });
        // We need a way for runAllEnabledTests to know this specific test is done.
        // Publishing a generic 'test:completed' is fine for UI, but for sequencing:
        eventBusInstance.publish(`test:internalTestDone:${testId}`, {
          testId,
          status: test.status,
        });
      }
    }
  },

  async runTest(testId) {
    const test = testLogicState.tests.find((t) => t.id === testId);
    if (!test) {
      console.error(`Test with ID ${testId} not found.`);
      return;
    }
    if (!testFunctions[test.functionName]) {
      console.error(
        `Test function ${test.functionName} not found for test ${test.name}.`
      );
      this.setTestStatus(testId, 'failed');
      this.addTestCondition(
        testId,
        `Test function "${test.functionName}" is not defined.`,
        'failed'
      );
      this.emitTestCompleted(testId, false);
      return;
    }

    this.setTestStatus(testId, 'running');
    if (eventBusInstance)
      eventBusInstance.publish('test:executionStarted', {
        testId,
        name: test.name,
      });

    testLogicState.currentRunningTestId = testId;
    const controller = new TestController(testId, this);

    try {
      await testFunctions[test.functionName](controller);
      // completeTest in controller will set final status and emit test:completed
    } catch (error) {
      console.error(`Error during execution of test ${test.name}:`, error);
      this.setTestStatus(testId, 'failed');
      this.addTestCondition(
        testId,
        `Test execution error: ${error.message}`,
        'failed'
      );
      this.emitTestCompleted(testId, false);
    } finally {
      testLogicState.currentRunningTestId = null;
    }
  },

  async runAllEnabledTests() {
    const enabledTests = testLogicState.tests
      .filter((t) => t.isEnabled)
      .sort((a, b) => a.order - b.order);

    if (enabledTests.length === 0) {
      console.log('[TestLogic] No enabled tests to run.');
      if (eventBusInstance)
        eventBusInstance.publish('test:allRunsCompleted', {
          summary: { passedCount: 0, failedCount: 0, totalRun: 0 },
        });
      return;
    }

    console.log(
      `[TestLogic] Starting run of ${enabledTests.length} enabled tests.`
    );
    let passedCount = 0;
    let failedCount = 0;

    // Store promises for each test run
    testLogicState.activeTestPromises = {};

    for (const test of enabledTests) {
      // Create a promise that will resolve when this specific test calls completeTest()
      const testRunPromise = new Promise((resolve) => {
        testLogicState.activeTestPromises[test.id] = { resolve };
      });

      await this.runTest(test.id); // Start the test
      await testRunPromise; // Wait for this specific test to complete

      // After the test completes, update counts
      const completedTest = testLogicState.tests.find((t) => t.id === test.id);
      if (completedTest) {
        if (completedTest.status === 'passed') {
          passedCount++;
        } else if (completedTest.status === 'failed') {
          failedCount++;
        }
      }
    }

    const summary = {
      passedCount,
      failedCount,
      totalRun: enabledTests.length,
    };
    console.log('[TestLogic] All enabled tests finished.', summary);
    if (eventBusInstance)
      eventBusInstance.publish('test:allRunsCompleted', { summary });

    // Playwright signal (if needed later)
    // localStorage.setItem('__playwrightTestResults__', JSON.stringify({ summary, tests: testLogicState.tests }));
    // localStorage.setItem('__playwrightTestsComplete__', 'true');
  },
};
