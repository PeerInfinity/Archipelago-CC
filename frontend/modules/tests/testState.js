// frontend/modules/tests/testState.js

// Holds the core state for the testing module.
// Functions here are simple accessors or direct mutators of this state.

export const testLogicState = {
  tests: [
    {
      id: 'test_1_simple_event',
      name: 'Test Simple Event Wait',
      description:
        'Checks if waitForEvent correctly pauses and resumes on a custom event.',
      functionName: 'simpleEventTest',
      isEnabled: false,
      order: 0,
      category: 'Core',
      status: 'pending', // 'pending', 'running', 'waiting_for_event', 'passed', 'failed'
      conditions: [], // { description: string, status: 'passed'|'failed' }
      logs: [], // { message: string, type: 'info'|'error'|'warn'|'debug', timestamp: string }
      currentEventWaitingFor: null,
    },
    {
      id: 'test_2_config_load_and_item_check',
      name: 'Test Config Load & Item Interaction',
      description: 'Loads test rules, adds an item, and verifies state.',
      functionName: 'configLoadAndItemCheckTest',
      isEnabled: false,
      order: 1,
      category: 'State Management',
      status: 'pending',
      conditions: [],
      logs: [],
      currentEventWaitingFor: null,
    },
    {
      id: 'test_3_ui_simulation',
      name: 'Test UI Simulation (Placeholder)',
      description:
        'Simulates a click and checks outcome (initial placeholder).',
      functionName: 'uiSimulationTest',
      isEnabled: false,
      order: 2,
      category: 'UI',
      status: 'pending',
      conditions: [],
      logs: [],
      currentEventWaitingFor: null,
    },
    {
      id: 'test_4_super_quick',
      name: 'Super Quick Test',
      description: 'A test that completes almost instantly.',
      functionName: 'superQuickTest',
      isEnabled: true,
      order: 3,
      category: 'Core',
      status: 'pending',
      conditions: [],
      logs: [],
      currentEventWaitingFor: null,
    },
    {
      id: 'test_5_progressive_sword',
      name: 'Test Progressive Sword',
      description: 'Verifies correct item granting for Progressive Sword.',
      functionName: 'progressiveSwordTest',
      isEnabled: true,
      order: 4,
      category: 'State Management',
      status: 'pending',
      conditions: [],
      logs: [],
      currentEventWaitingFor: null,
    },
    {
      id: 'test_6_theme_setting',
      name: 'Test Theme Setting Change',
      description: 'Checks if updating and getting theme setting works.',
      functionName: 'themeSettingTest',
      isEnabled: true,
      order: 5,
      category: 'Settings',
      status: 'pending',
      conditions: [],
      logs: [],
      currentEventWaitingFor: null,
    },
    {
      id: 'test_7_simulate_received_items',
      name: 'Test Simulate ReceivedItems Message',
      description:
        'Simulates a server "ReceivedItems" message and checks inventory/location state.',
      functionName: 'simulateReceivedItemsTest',
      isEnabled: true,
      order: 6,
      category: 'Client',
      status: 'pending',
      conditions: [],
      logs: [],
      currentEventWaitingFor: null,
    },
  ],
  autoStartTestsOnLoad: false,
  defaultEnabledState: false, // Default for newly discovered tests or categories
  currentRunningTestId: null,
  categories: {
    // Initial categories; can be dynamically added to by tests
    'Core': { isEnabled: true, order: 0 },
    'State Management': { isEnabled: true, order: 1 },
    'UI': { isEnabled: true, order: 2 },
    'Items': { isEnabled: true, order: 3 },
    'Settings': { isEnabled: true, order: 4 },
    'Client': { isEnabled: true, order: 5 },
    'Uncategorized': { isEnabled: true, order: 99 },
  },
};

export function getTests() {
  return [...testLogicState.tests.sort((a, b) => a.order - b.order)];
}

export function findTestById(testId) {
  return testLogicState.tests.find((t) => t.id === testId);
}

export function getSavableTestConfig() {
  return {
    autoStartTestsOnLoad: testLogicState.autoStartTestsOnLoad,
    defaultEnabledState: testLogicState.defaultEnabledState,
    categories: JSON.parse(JSON.stringify(testLogicState.categories)), // Deep copy
    tests: testLogicState.tests.map((t) => ({
      // Save only config, not runtime state
      id: t.id,
      name: t.name,
      description: t.description,
      functionName: t.functionName,
      isEnabled: t.isEnabled,
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

export function toggleTestEnabled(testId, isEnabled) {
  const test = findTestById(testId);
  if (test) {
    test.isEnabled = isEnabled;
  }
}

export function updateTestOrder(testId, direction) {
  const tests = testLogicState.tests;
  const index = tests.findIndex((t) => t.id === testId);
  if (index === -1) return false;

  if (direction === 'up' && index > 0) {
    // Swap order property
    [tests[index].order, tests[index - 1].order] = [
      tests[index - 1].order,
      tests[index].order,
    ];
  } else if (direction === 'down' && index < tests.length - 1) {
    // Swap order property
    [tests[index].order, tests[index + 1].order] = [
      tests[index + 1].order,
      tests[index].order,
    ];
  } else {
    return false; // No change
  }
  // Re-sort by order and re-normalize to ensure contiguous order values
  tests.sort((a, b) => a.order - b.order);
  tests.forEach((t, i) => (t.order = i));
  return true;
}

export function setTestStatus(testId, status, eventWaitingFor = null) {
  const test = findTestById(testId);
  if (test) {
    test.status = status;
    test.currentEventWaitingFor =
      status === 'waiting_for_event' ? eventWaitingFor : null;
    if (status === 'running' || status === 'pending') {
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

export function getCategories() {
  // Return categories sorted by their 'order' property, then alphabetically
  return Object.entries(testLogicState.categories)
    .map(([name, data]) => ({ name, ...data })) // Convert to array of objects with name
    .sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Infinity;
      const orderB = b.order !== undefined ? b.order : Infinity;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    })
    .map((cat) => cat.name); // Return just names
}

export function getCategoryState(categoryName) {
  return (
    testLogicState.categories[categoryName] || {
      isEnabled: testLogicState.defaultEnabledState,
      order: Infinity,
    }
  );
}

export function toggleCategoryEnabled(categoryName, isEnabled) {
  if (testLogicState.categories[categoryName]) {
    testLogicState.categories[categoryName].isEnabled = isEnabled;
    testLogicState.tests.forEach((test) => {
      if (test.category === categoryName) {
        test.isEnabled = isEnabled;
      }
    });
    return true;
  }
  return false;
}

export function updateCategoryOrder(categoryName, direction) {
  const categories = getCategories(); // Gets sorted category names
  const currentIndex = categories.indexOf(categoryName);
  if (currentIndex === -1) return false;

  let newIndex;
  if (direction === 'up' && currentIndex > 0) {
    newIndex = currentIndex - 1;
  } else if (direction === 'down' && currentIndex < categories.length - 1) {
    newIndex = currentIndex + 1;
  } else {
    return false; // No change
  }

  const categoryToMove = categories[currentIndex];
  const categoryToSwapWith = categories[newIndex];

  // Swap order properties in the state
  const orderMoving = testLogicState.categories[categoryToMove].order;
  const orderSwapping = testLogicState.categories[categoryToSwapWith].order;

  testLogicState.categories[categoryToMove].order = orderSwapping;
  testLogicState.categories[categoryToSwapWith].order = orderMoving;

  // Re-normalize all test orders based on new category order
  let currentTestOrder = 0;
  getCategories().forEach((catName) => {
    // Iterate sorted categories
    testLogicState.tests
      .filter((t) => t.category === catName)
      .sort((a, b) => a.name.localeCompare(b.name)) // Keep tests within category alphabetically sorted for now
      .forEach((test) => {
        test.order = currentTestOrder++;
      });
  });
  testLogicState.tests.sort((a, b) => a.order - b.order); // Final sort on tests
  return true;
}
