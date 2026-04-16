// frontend/modules/tests/testState.js

import { createRng } from '../shared/rng.js';

// Holds the core state for the testing module.
// Functions here are simple accessors or direct mutators of this state.

export const testLogicState = {
  tests: [], // Initialize as empty; will be populated by testDiscovery and testLogic
  autoStartTestsOnLoad: false,
  hideDisabledTests: false, // Default to false - show all tests
  randomizeOrder: false, // Default to false - maintain order
  randomSeed: null, // Random seed for reproducible test ordering
  defaultEnabledState: false, // Default for newly discovered tests
  currentRunningTestId: null,
  fromDiscovery: false, // Flag to indicate if state was initialized from discovery
};

export function getTests() {
  return [...testLogicState.tests.sort((a, b) => a.order - b.order)];
}

// Function to get unique categories for display purposes (no ordering or enabling logic)
export function getUniqueCategories() {
  const categories = new Set();
  testLogicState.tests.forEach((test) => {
    if (test.category) {
      categories.add(test.category);
    }
  });
  return Array.from(categories).sort();
}

export function findTestById(testId) {
  return testLogicState.tests.find((t) => t.id === testId);
}

export function getSavableTestConfig() {
  return {
    autoStartTestsOnLoad: testLogicState.autoStartTestsOnLoad,
    hideDisabledTests: testLogicState.hideDisabledTests,
    randomizeOrder: testLogicState.randomizeOrder,
    defaultEnabledState: testLogicState.defaultEnabledState,
    tests: testLogicState.tests.map((t) => ({
      // Save only config, not runtime state
      id: t.id,
      name: t.name,
      description: t.description,
      functionName: t.functionName,
      enabled: t.enabled,
      order: t.order,
      category: t.category,
    })),
  };
}

export function setAutoStartTests(shouldAutoStart) {
  if (typeof shouldAutoStart === 'boolean') {
    testLogicState.autoStartTestsOnLoad = shouldAutoStart;
  }
}

export function shouldAutoStartTests() {
  return testLogicState.autoStartTestsOnLoad;
}

export function setHideDisabledTests(shouldHide) {
  if (typeof shouldHide === 'boolean') {
    testLogicState.hideDisabledTests = shouldHide;
  }
}

export function shouldHideDisabledTests() {
  return testLogicState.hideDisabledTests;
}

export function setRandomizeOrder(shouldRandomize) {
  if (typeof shouldRandomize === 'boolean') {
    testLogicState.randomizeOrder = shouldRandomize;
  }
}

export function shouldRandomizeOrder() {
  return testLogicState.randomizeOrder;
}

function shuffleArray(array) {
  if (testLogicState.randomSeed === null) {
    const newSeed = Math.floor(Math.random() * 2147483647);
    testLogicState.randomSeed = newSeed;
    console.log(`[TestState] Shuffling tests with generated seed: ${newSeed}`);
    console.log(`[TestState] To reproduce this order, add &testOrderSeed=${newSeed} to the URL`);
  } else {
    console.log(`[TestState] Shuffling tests with seed: ${testLogicState.randomSeed}`);
  }

  const rng = createRng(testLogicState.randomSeed);
  return rng.shuffle([...array]);
}

export function getTestsForExecution() {
  const sortedTests = [...testLogicState.tests.sort((a, b) => a.order - b.order)];
  
  if (testLogicState.randomizeOrder) {
    return shuffleArray(sortedTests);
  }
  
  return sortedTests;
}

export function toggleTestEnabled(testId, enabled) {
  const test = findTestById(testId);
  if (test) {
    test.enabled = enabled;
    // Update status based on enabled state, but preserve completed test results
    if (
      test.status !== 'passed' &&
      test.status !== 'failed' &&
      test.status !== 'running'
    ) {
      test.status = enabled ? 'pending' : 'disabled';
    }
  }
}

export function updateTestOrder(testId, direction) {
  const tests = testLogicState.tests;
  const testIndex = tests.findIndex((t) => t.id === testId);
  if (testIndex === -1) return false;

  // Sort tests by order to get the current position
  const sortedTests = [...tests].sort((a, b) => a.order - b.order);
  const currentIndex = sortedTests.findIndex((t) => t.id === testId);
  if (currentIndex === -1) return false;

  let targetIndex = -1;
  if (direction === 'up' && currentIndex > 0) {
    targetIndex = currentIndex - 1;
  } else if (direction === 'down' && currentIndex < sortedTests.length - 1) {
    targetIndex = currentIndex + 1;
  } else {
    return false; // No change possible
  }

  // Swap order properties between the two tests
  const currentTestObj = sortedTests[currentIndex];
  const targetTestObj = sortedTests[targetIndex];

  [currentTestObj.order, targetTestObj.order] = [
    targetTestObj.order,
    currentTestObj.order,
  ];

  return true;
}

export function setTestStatus(testId, status, eventWaitingFor = null) {
  const test = findTestById(testId);
  if (test) {
    const previousStatus = test.status;
    test.status = status;
    test.currentEventWaitingFor =
      status === 'waiting_for_event' ? eventWaitingFor : null;

    // Track start time when test begins running
    if (status === 'running' && (previousStatus === 'pending' || previousStatus === 'disabled' || previousStatus === 'passed' || previousStatus === 'failed' || !previousStatus)) {
      test.startTime = new Date().toISOString();
      test.endTime = null; // Clear end time
      test.conditions = []; // Clear conditions
      test.logs = []; // Clear logs
    }

    // Track end time when test completes
    if ((status === 'passed' || status === 'failed') && test.startTime) {
      test.endTime = new Date().toISOString();
    }

    // Also clear when explicitly set to pending (test reset)
    if (status === 'pending') {
      test.startTime = null;
      test.endTime = null;
      test.conditions = []; // Clear conditions
      test.logs = []; // Clear logs
    }
  }
}

export function addTestCondition(testId, description, status) {
  const test = findTestById(testId);
  if (test) {
    if (!test.conditions) test.conditions = [];
    test.conditions.push({
      description,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}

export function addTestLog(testId, message, type) {
  const test = findTestById(testId);
  if (test) {
    if (!test.logs) test.logs = [];
    test.logs.push({ message, type, timestamp: new Date().toISOString() });
  }
}

export function setCurrentRunningTestId(testId) {
  testLogicState.currentRunningTestId = testId;
}

export function getCurrentRunningTestId() {
  return testLogicState.currentRunningTestId;
}

// Function to check for duplicate order values and warn
