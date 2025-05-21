// frontend/modules/tests/testLogic.js (Orchestrator)
import * as TestState from './testState.js';
import { TestController } from './testController.js';
import { stateManagerProxySingleton } from '../stateManager/index.js'; // For direct interaction if needed by orchestrator
// createStateSnapshotInterface is used by TestController, not directly here.

// Import test functions
import * as CoreTests from './testCases/coreTests.js';
import * as StateManagementTests from './testCases/stateManagementTests.js';
import * as UITests from './testCases/uiInteractionTests.js';
import * as ProgressiveItemsTests from './testCases/progressiveItemsTests.js';
import * as SettingsTests from './testCases/settingsTests.js';
import * as ClientMessageTests from './testCases/clientMessageTests.js';

let eventBusInstance = null;
let appInitializationApiInstance = null; // Might not be needed directly by orchestrator anymore

const testFunctions = {
  ...CoreTests,
  ...StateManagementTests,
  ...UITests,
  ...ProgressiveItemsTests,
  ...SettingsTests,
  ...ClientMessageTests,
};

// --- testLogic Public API ---
export const testLogic = {
  setInitializationApi(api) {
    appInitializationApiInstance = api;
    // If orchestrator needs direct stateManager access (less ideal), it can use stateManagerProxySingleton
  },
  setEventBus(bus) {
    eventBusInstance = bus;
  },

  getTests() {
    return TestState.getTests();
  },

  getSavableState() {
    // Combine savable parts from TestState
    return TestState.getSavableTestConfig();
  },

  applyLoadedState(data) {
    // This function needs to carefully merge loaded data with existing state,
    // including adding new tests, updating existing ones, and handling categories.
    let autoStartChanged = false;
    const oldAutoStartValue = TestState.shouldAutoStartTests();

    if (data && typeof data.autoStartTestsOnLoad === 'boolean') {
      if (TestState.shouldAutoStartTests() !== data.autoStartTestsOnLoad) {
        TestState.setAutoStartTests(data.autoStartTestsOnLoad);
        autoStartChanged = true;
      }
    }
    if (data && typeof data.defaultEnabledState === 'boolean') {
      TestState.testLogicState.defaultEnabledState = data.defaultEnabledState;
    }

    // Categories: Merge, don't overwrite. Add new, update existing.
    if (data && data.categories) {
      for (const categoryName in data.categories) {
        if (Object.hasOwnProperty.call(data.categories, categoryName)) {
          const loadedCategory = data.categories[categoryName];
          if (TestState.testLogicState.categories[categoryName]) {
            // Update existing
            TestState.testLogicState.categories[categoryName].isEnabled =
              loadedCategory.isEnabled;
            TestState.testLogicState.categories[categoryName].order =
              loadedCategory.order !== undefined
                ? loadedCategory.order
                : TestState.testLogicState.categories[categoryName].order || 0;
          } else {
            // Add new
            TestState.testLogicState.categories[categoryName] = {
              isEnabled: loadedCategory.isEnabled,
              order: loadedCategory.order || 0,
            };
          }
        }
      }
    }

    if (data && Array.isArray(data.tests)) {
      const newTestsMap = new Map(data.tests.map((t) => [t.id, t]));
      const currentTests = [];
      let maxOrder = -1;

      // Update existing or add new from loaded
      newTestsMap.forEach((loadedTestConfig, testId) => {
        const existingTest = TestState.findTestById(testId);
        if (existingTest) {
          currentTests.push({
            ...existingTest,
            name: loadedTestConfig.name,
            description: loadedTestConfig.description,
            functionName: loadedTestConfig.functionName,
            isEnabled: loadedTestConfig.isEnabled,
            order: loadedTestConfig.order,
            category: loadedTestConfig.category || 'Uncategorized',
          });
        } else {
          currentTests.push({
            ...loadedTestConfig,
            status: 'pending',
            conditions: [],
            logs: [],
            currentEventWaitingFor: null,
            category: loadedTestConfig.category || 'Uncategorized',
          });
        }
        if (loadedTestConfig.order > maxOrder)
          maxOrder = loadedTestConfig.order;
      });

      // Add any tests from current logic state that weren't in the loaded data
      TestState.getTests().forEach((currentTest) => {
        if (!newTestsMap.has(currentTest.id)) {
          currentTest.order = ++maxOrder; // Assign new order
          currentTest.isEnabled = TestState.testLogicState.defaultEnabledState;
          if (!currentTest.logs) currentTest.logs = [];
          if (!currentTest.conditions) currentTest.conditions = [];
          if (currentTest.status === undefined) currentTest.status = 'pending';
          if (!currentTest.category) currentTest.category = 'Uncategorized';
          currentTests.push(currentTest);
        }
      });

      TestState.testLogicState.tests = currentTests; // Directly assign sorted array
      // Normalize order and ensure all required fields exist after sorting by the assigned order
      TestState.testLogicState.tests.sort((a, b) => a.order - b.order);
      TestState.testLogicState.tests.forEach((t, i) => {
        t.order = i; // Re-normalize order
        if (!t.logs) t.logs = [];
        if (!t.conditions) t.conditions = [];
        if (t.status === undefined) t.status = 'pending';
        if (!t.category) t.category = 'Uncategorized';
        // Ensure category exists
        if (t.category && !TestState.testLogicState.categories[t.category]) {
          TestState.testLogicState.categories[t.category] = {
            isEnabled: TestState.testLogicState.defaultEnabledState,
            order: Object.keys(TestState.testLogicState.categories).length,
          };
        }
      });
    }

    if (eventBusInstance) {
      eventBusInstance.publish('test:listUpdated', { tests: this.getTests() });
      if (autoStartChanged) {
        eventBusInstance.publish('test:autoStartConfigChanged', {
          autoStartEnabled: TestState.shouldAutoStartTests(),
        });
      }
    }
  },

  shouldAutoStartTests() {
    return TestState.shouldAutoStartTests();
  },
  setAutoStartTests(shouldAutoStart) {
    TestState.setAutoStartTests(shouldAutoStart);
    if (eventBusInstance) {
      eventBusInstance.publish('test:autoStartConfigChanged', {
        autoStartEnabled: shouldAutoStart,
      });
    }
  },

  toggleTestEnabled(testId, isEnabled) {
    TestState.toggleTestEnabled(testId, isEnabled);
    if (eventBusInstance)
      eventBusInstance.publish('test:listUpdated', { tests: this.getTests() });
  },

  updateTestOrder(testId, direction) {
    if (TestState.updateTestOrder(testId, direction)) {
      if (eventBusInstance)
        eventBusInstance.publish('test:listUpdated', {
          tests: this.getTests(),
        });
    }
  },

  // Methods called by TestController via callbacks
  _setTestStatus(testId, status, eventWaitingFor = null) {
    TestState.setTestStatus(testId, status, eventWaitingFor);
    if (eventBusInstance)
      eventBusInstance.publish('test:statusChanged', {
        testId,
        status,
        eventWaitingFor,
      });
  },
  _addTestCondition(testId, description, status) {
    TestState.addTestCondition(testId, description, status);
    if (eventBusInstance)
      eventBusInstance.publish('test:conditionReported', {
        testId,
        condition: { description, status },
      });
  },
  _emitLogMessage(testId, message, type) {
    TestState.addTestLog(testId, message, type);
    if (eventBusInstance)
      eventBusInstance.publish('test:logMessage', { testId, message, type });
  },
  _emitTestCompleted(testId, overallStatus) {
    const test = TestState.findTestById(testId);
    if (test) {
      test.status = overallStatus ? 'passed' : 'failed';
      if (eventBusInstance) {
        eventBusInstance.publish('test:statusChanged', {
          testId,
          status: test.status,
        });
        eventBusInstance.publish(`test:internalTestDone:${testId}`, {
          testId,
          status: test.status,
        });
      }
    }
  },

  async runTest(testId) {
    const test = TestState.findTestById(testId);
    if (!test) {
      console.error(`Test with ID ${testId} not found.`);
      this._emitLogMessage(
        testId,
        `Test definition for ${testId} not found.`,
        'error'
      );
      this._setTestStatus(testId, 'failed');
      this._emitTestCompleted(testId, false);
      return;
    }
    if (!testFunctions[test.functionName]) {
      const errorMsg = `Test function ${test.functionName} not found for test ${test.name}.`;
      console.error(errorMsg);
      this._setTestStatus(testId, 'failed');
      this._addTestCondition(
        testId,
        `Config Error: Test function "${test.functionName}" is not defined.`,
        'failed'
      );
      this._emitTestCompleted(testId, false);
      return;
    }

    this._setTestStatus(testId, 'running');
    if (eventBusInstance)
      eventBusInstance.publish('test:executionStarted', {
        testId,
        name: test.name,
      });

    TestState.setCurrentRunningTestId(testId);

    const controllerCallbacks = {
      log: this._emitLogMessage.bind(this),
      reportCondition: this._addTestCondition.bind(this),
      setTestStatus: this._setTestStatus.bind(this),
      completeTest: this._emitTestCompleted.bind(this),
    };
    // Pass eventBusInstance (from module init) to the controller
    const controller = new TestController(
      testId,
      controllerCallbacks,
      eventBusInstance
    );

    try {
      await testFunctions[test.functionName](controller);
    } catch (error) {
      console.error(`Error during execution of test ${test.name}:`, error);
      if (test.status !== 'passed' && test.status !== 'failed') {
        // Avoid double-completion
        this._addTestCondition(
          testId,
          `Unhandled test execution error: ${error.message}`,
          'failed'
        );
        this._emitTestCompleted(testId, false); // Mark as failed
      }
    } finally {
      if (TestState.getCurrentRunningTestId() === testId) {
        TestState.setCurrentRunningTestId(null);
      }
    }
  },

  async runAllEnabledTests() {
    const enabledTests = TestState.getTests()
      .filter((t) => t.isEnabled)
      .sort((a, b) => a.order - b.order);
    if (enabledTests.length === 0) {
      console.log('[TestLogic] No enabled tests to run.');
      const summary = { passedCount: 0, failedCount: 0, totalRun: 0 };
      if (eventBusInstance)
        eventBusInstance.publish('test:allRunsCompleted', { summary });
      try {
        localStorage.setItem(
          '__playwrightTestResults__',
          JSON.stringify({
            summary,
            testDetails: [],
            reportTimestamp: new Date().toISOString(),
          })
        );
        localStorage.setItem('__playwrightTestsComplete__', 'true');
      } catch (e) {
        console.error('[TestLogic] Error saving empty Playwright report:', e);
      }
      return;
    }

    console.log(
      `[TestLogic] Starting run of ${enabledTests.length} enabled tests.`
    );
    let passedCount = 0;
    let failedCount = 0;
    const executedTestIds = new Set();

    for (const test of enabledTests) {
      executedTestIds.add(test.id);
      const testCompletionPromise = new Promise((resolve) => {
        const specificEventListener = (eventData) => {
          if (eventData.testId === test.id) {
            if (eventBusInstance)
              eventBusInstance.unsubscribe(
                `test:internalTestDone:${test.id}`,
                specificEventListener
              );
            resolve(eventData.status === 'passed');
          }
        };
        if (eventBusInstance)
          eventBusInstance.subscribe(
            `test:internalTestDone:${test.id}`,
            specificEventListener
          );
        else resolve(false); // No event bus, assume fail for safety
      });

      await this.runTest(test.id);
      const testPassed = await testCompletionPromise;

      if (testPassed) {
        passedCount++;
      } else {
        failedCount++;
      }
    }

    const summary = { passedCount, failedCount, totalRun: enabledTests.length };
    console.log('[TestLogic] All enabled tests finished.', summary);

    try {
      const testDetailsForReport = TestState.getTests()
        .filter((t) => executedTestIds.has(t.id))
        .map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          conditions: t.conditions ? [...t.conditions] : [],
          logs: t.logs ? [...t.logs] : [],
        }));
      const playwrightReport = {
        summary,
        testDetails: testDetailsForReport,
        reportTimestamp: new Date().toISOString(),
      };
      localStorage.setItem(
        '__playwrightTestResults__',
        JSON.stringify(playwrightReport)
      );
      localStorage.setItem('__playwrightTestsComplete__', 'true');
      console.log('[TestLogic] Playwright report saved to localStorage.');
    } catch (e) {
      console.error('[TestLogic] Error saving Playwright report:', e);
    }

    if (eventBusInstance)
      eventBusInstance.publish('test:allRunsCompleted', { summary });
  },

  // Category Management
  getCategories() {
    return TestState.getCategories();
  },
  isCategoryEnabled(categoryName) {
    return TestState.getCategoryState(categoryName).isEnabled;
  },
  toggleCategoryEnabled(categoryName, isEnabled) {
    if (TestState.toggleCategoryEnabled(categoryName, isEnabled)) {
      if (eventBusInstance)
        eventBusInstance.publish('test:listUpdated', {
          tests: this.getTests(),
        });
    }
  },
  updateCategoryOrder(categoryName, direction) {
    if (TestState.updateCategoryOrder(categoryName, direction)) {
      if (eventBusInstance)
        eventBusInstance.publish('test:listUpdated', {
          tests: this.getTests(),
        });
    }
  },
};
