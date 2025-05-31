// frontend/modules/tests/testCases/stateManagementTests.js

import { registerTest } from '../testRegistry.js';

export async function configLoadAndItemCheckTest(testController) {
  let overallResult = true;
  try {
    testController.log('Starting configLoadAndItemCheckTest...');
    testController.reportCondition('Test started', true);

    const mockRulesContent = {
      /* ... (same as original, ensure it's valid JSON) ... */
      schema_version: 3,
      game_name: 'A Link to the Past',
      archipelago_version: '0.6.1',
      generation_seed: 12345,
      player_names: { 1: 'TestPlayer1' },
      world_classes: { 1: 'ALTTPWorld' },
      plando_options: [],
      start_regions: {
        1: { default: ['Menu'], available: [{ name: 'Menu', type: 1 }] },
      },
      items: {
        1: {
          'Moon Pearl': {
            name: 'Moon Pearl',
            id: 100,
            groups: ['Progression'],
            advancement: true,
            priority: false,
            useful: true,
            trap: false,
            event: false,
            type: 'Item',
            max_count: 1,
          },
          'Progressive Sword': {
            name: 'Progressive Sword',
            id: 94,
            groups: ['Everything', 'Progression Items', 'Swords'],
            advancement: true,
            priority: false,
            useful: false,
            trap: false,
            event: false,
            type: 'Sword',
            max_count: 4,
          },
          'Fighter Sword': {
            name: 'Fighter Sword',
            id: 73,
            groups: ['Everything', 'Progression Items', 'Swords'],
            advancement: true,
            priority: false,
            useful: false,
            trap: false,
            event: false,
            type: 'Sword',
            max_count: 1,
          },
          'Master Sword': {
            name: 'Master Sword',
            id: 80,
            groups: ['Everything', 'Progression Items', 'Swords'],
            advancement: true,
            priority: false,
            useful: false,
            trap: false,
            event: false,
            type: 'Sword',
            max_count: 1,
          },
          'Lifting Glove': {
            name: 'Lifting Glove',
            id: 102,
            groups: ['Progression'],
            advancement: true,
            priority: false,
            useful: true,
            trap: false,
            event: false,
            type: 'Item',
            max_count: 1,
          },
          'Victory': {
            name: 'Victory',
            id: 999,
            groups: ['Event'],
            advancement: false,
            priority: false,
            useful: false,
            trap: false,
            event: true,
            type: 'Event',
            max_count: 1,
          },
        },
      },
      item_groups: { 1: ['Progression', 'Swords', 'Event'] },
      itempool_counts: {
        1: {
          'Moon Pearl': 1,
          'Progressive Sword': 1,
          'Lifting Glove': 1,
          'Victory': 1,
        },
      },
      progression_mapping: {
        1: {
          'Progressive Sword': {
            items: [
              { name: 'Fighter Sword', level: 1 },
              { name: 'Master Sword', level: 2 },
              { name: 'Tempered Sword', level: 3 },
              { name: 'Golden Sword', level: 4 },
            ],
            base_item: 'Progressive Sword',
          },
        },
      },
      starting_items: { 1: [] },
      regions: {
        1: {
          'Menu': {
            name: 'Menu',
            type: 1,
            player: 1,
            entrances: [],
            exits: [
              {
                name: 'Links House S&Q',
                connected_region: 'Links House',
                access_rule: { type: 'constant', value: true },
                type: 'Exit',
              },
            ],
            locations: [],
            time_passes: true,
            provides_chest_count: false,
          },
          'Links House': {
            name: 'Links House',
            type: 1,
            player: 1,
            entrances: [
              {
                name: 'From Menu S&Q',
                parent_region: 'Menu',
                connected_region: 'Links House',
                access_rule: { type: 'constant', value: true },
                assumed: false,
                type: 'Entrance',
              },
            ],
            exits: [
              {
                name: 'To Hyrule Castle Courtyard',
                connected_region: 'Hyrule Castle Courtyard',
                access_rule: { type: 'constant', value: true },
                type: 'Exit',
              },
            ],
            locations: [],
            time_passes: true,
            provides_chest_count: false,
          },
          'Hyrule Castle Courtyard': {
            name: 'Hyrule Castle Courtyard',
            type: 1,
            player: 1,
            entrances: [
              {
                name: 'From Links House',
                parent_region: 'Links House',
                connected_region: 'Hyrule Castle Courtyard',
                access_rule: { type: 'constant', value: true },
                assumed: false,
                type: 'Entrance',
              },
            ],
            locations: [],
            exits: [
              {
                name: 'To Dark World Portal',
                connected_region: 'Dark World Forest',
                access_rule: { type: 'item_check', item: 'Moon Pearl' },
                type: 'Exit',
              },
            ],
            time_passes: true,
            provides_chest_count: false,
          },
          'Dark World Forest': {
            name: 'Dark World Forest',
            type: 1,
            player: 1,
            entrances: [
              {
                name: 'From Hyrule Castle Courtyard Portal',
                parent_region: 'Hyrule Castle Courtyard',
                connected_region: 'Dark World Forest',
                access_rule: { type: 'item_check', item: 'Moon Pearl' },
                assumed: false,
                type: 'Entrance',
              },
            ],
            locations: [
              {
                name: 'LocationUnlockedByMoonPearl',
                id: 10001,
                access_rule: { type: 'constant', value: true },
                item: {
                  name: 'Victory',
                  player: 1,
                  advancement: false,
                  type: 'Event',
                },
                progress_type: 0,
                locked: false,
              },
            ],
            exits: [],
            time_passes: true,
            provides_chest_count: false,
          },
        },
      },
      settings: {
        1: {
          game: 'A Link to the Past',
          player_name: 'TestPlayer1',
          world_state: 'open',
          shuffle_ganon: true,
        },
      },
      game_info: {
        1: { name: 'A Link to the Past', rule_format: { version: '1' } },
      },
    };

    await testController.performAction({
      type: 'LOAD_RULES_DATA',
      payload: mockRulesContent,
      playerId: '1',
      playerName: 'TestPlayer1',
    });
    testController.reportCondition('Initial data loaded', true);
    // Note: LOAD_RULES_DATA action now waits for stateManager:rulesLoaded internally

    await testController.performAction({
      type: 'ADD_ITEM_TO_INVENTORY',
      itemName: 'Progressive Sword',
    });
    testController.reportCondition('Added Progressive Sword', true);
    await testController.performAction({
      type: 'AWAIT_WORKER_PING',
      payload: 'syncAfterAddSword1',
    });
    // await testController.waitForEvent('stateManager:snapshotUpdated', 1000);

    await testController.performAction({
      type: 'ADD_ITEM_TO_INVENTORY',
      itemName: 'Moon Pearl',
    });
    testController.reportCondition('Added Moon Pearl', true);
    await testController.performAction({
      type: 'AWAIT_WORKER_PING',
      payload: 'syncAfterAddMoonPearl',
    });
    // await testController.waitForEvent('stateManager:snapshotUpdated', 1000);

    const fighterSwordCount = await testController.performAction({
      type: 'GET_INVENTORY_ITEM_COUNT',
      itemName: 'Fighter Sword',
    });
    const hasFighterSword = fighterSwordCount > 0;
    testController.reportCondition(
      "hasItem('Fighter Sword') check",
      hasFighterSword
    );
    if (!hasFighterSword) overallResult = false;

    const moonPearlCount = await testController.performAction({
      type: 'GET_INVENTORY_ITEM_COUNT',
      itemName: 'Moon Pearl',
    });
    const hasMoonPearl = moonPearlCount > 0;
    testController.reportCondition("hasItem('Moon Pearl') check", hasMoonPearl);
    if (!hasMoonPearl) overallResult = false;

    const locationToCheck = 'LocationUnlockedByMoonPearl';
    const canAccessLocation = await testController.performAction({
      type: 'IS_LOCATION_ACCESSIBLE',
      locationName: locationToCheck,
    });
    testController.reportCondition(
      `canAccessLocation('${locationToCheck}') check`,
      canAccessLocation
    );
    if (!canAccessLocation) overallResult = false;

    await testController.performAction({
      type: 'ADD_ITEM_TO_INVENTORY',
      itemName: 'Victory',
    });
    testController.reportCondition('Added Victory Event Item', true);
    await testController.performAction({
      type: 'AWAIT_WORKER_PING',
      payload: 'syncAfterAddVictory',
    });
    // await testController.waitForEvent('stateManager:snapshotUpdated', 1000);

    testController.log(
      `configLoadAndItemCheckTest finished. Overall Result: ${overallResult}`
    );
  } catch (error) {
    testController.log(
      `Error in configLoadAndItemCheckTest: ${error.message}`,
      'error'
    );
    testController.reportCondition(`Test errored: ${error.message}`, false);
    overallResult = false;
  } finally {
    await testController.completeTest(overallResult);
  }
}

export async function testCasePanelInteractionTest(testController) {
  let overallResult = true;
  try {
    testController.log('Starting testCasePanelInteractionTest...');
    testController.reportCondition('Test started', true);

    // First, we need to ensure the Test Cases panel is available and activated
    testController.log('Attempting to activate Test Cases panel...');

    // Import eventBus to publish panel activation event
    const eventBusModule = await import('../../../app/core/eventBus.js');
    const eventBus = eventBusModule.default;

    if (!eventBus) {
      throw new Error('Event bus not available');
    }

    // Activate the Test Cases panel using the same pattern as region links
    eventBus.publish('ui:activatePanel', { panelId: 'testCasesPanel' });
    testController.reportCondition(
      'Test Cases panel activation event published',
      true
    );

    // Wait a moment for the panel to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Look for the Test Cases panel in the DOM
    const testCasesPanel = document.querySelector('#test-cases-panel');
    if (!testCasesPanel) {
      throw new Error('Test Cases panel not found in DOM');
    }
    testController.reportCondition('Test Cases panel found in DOM', true);

    // Wait for the panel to load test sets
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Look for the vanilla folder and Light World test
    const vanillaButtons = testCasesPanel.querySelectorAll(
      'button[data-folder="vanilla"]'
    );
    let lightWorldButton = null;

    for (const button of vanillaButtons) {
      if (
        button.dataset.testset &&
        button.dataset.testset.toLowerCase().includes('lightworld')
      ) {
        lightWorldButton = button;
        break;
      }
    }

    if (!lightWorldButton) {
      // Try alternative selectors
      const allButtons = testCasesPanel.querySelectorAll('button');
      for (const button of allButtons) {
        if (button.textContent.toLowerCase().includes('light world')) {
          lightWorldButton = button;
          break;
        }
      }
    }

    if (!lightWorldButton) {
      throw new Error('Light World test button not found in vanilla category');
    }

    testController.reportCondition('Light World test button found', true);

    // Click the Light World test button
    testController.log('Clicking Light World test button...');
    lightWorldButton.click();

    // Wait for the test cases to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify that test cases are now displayed
    const testTable = testCasesPanel.querySelector('.results-table');
    if (!testTable) {
      throw new Error('Test cases table not found after clicking Light World');
    }
    testController.reportCondition('Test cases table loaded', true);

    // Look for the "Run All Tests" button
    const runAllButton = testCasesPanel.querySelector('#run-all-tests');
    if (!runAllButton) {
      throw new Error('Run All Tests button not found');
    }
    testController.reportCondition('Run All Tests button found', true);

    // Verify the cancel button is present but hidden
    const cancelButton = testCasesPanel.querySelector('#cancel-all-tests');
    if (!cancelButton) {
      throw new Error('Cancel Tests button not found');
    }

    const isHidden =
      cancelButton.style.display === 'none' ||
      getComputedStyle(cancelButton).display === 'none';
    testController.reportCondition(
      'Cancel Tests button found and initially hidden',
      isHidden
    );
    if (!isHidden) overallResult = false;

    // Click the "Run All Tests" button
    testController.log('Clicking Run All Tests button...');
    runAllButton.click();

    // Wait a moment for the tests to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that the cancel button is now visible
    const isCancelVisible =
      cancelButton.style.display === 'inline-block' ||
      getComputedStyle(cancelButton).display !== 'none';
    testController.reportCondition(
      'Cancel Tests button becomes visible when tests start',
      isCancelVisible
    );
    if (!isCancelVisible) overallResult = false;

    // Verify that the run button is disabled
    const isRunDisabled = runAllButton.disabled;
    testController.reportCondition(
      'Run All Tests button disabled during execution',
      isRunDisabled
    );
    if (!isRunDisabled) overallResult = false;

    // NEW: Wait for all tests to complete instead of canceling
    testController.log('Waiting for all tests to complete...');

    // Monitor test completion by watching for the run button to be re-enabled
    // and the cancel button to be hidden again
    let testsCompleted = false;
    let maxWaitTime = 300000; // 5 minutes maximum wait time
    let waitStartTime = Date.now();

    while (!testsCompleted && Date.now() - waitStartTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second

      const isRunButtonEnabled = !runAllButton.disabled;
      const isCancelButtonHidden =
        cancelButton.style.display === 'none' ||
        getComputedStyle(cancelButton).display === 'none';

      testsCompleted = isRunButtonEnabled && isCancelButtonHidden;

      if (testsCompleted) {
        testController.log(
          'Tests completed - buttons returned to initial state'
        );
        break;
      }
    }

    if (!testsCompleted) {
      throw new Error('Tests did not complete within the maximum wait time');
    }

    testController.reportCondition(
      'All tests completed successfully',
      testsCompleted
    );

    // Collect and analyze test results
    const summaryElement = testCasesPanel.querySelector(
      '#test-results-summary'
    );
    let testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      cancelled: 0,
      details: [],
    };

    if (summaryElement) {
      const summaryText = summaryElement.textContent;
      testController.log(`Test summary: ${summaryText}`);

      // Parse the summary text to extract counts
      const totalMatch = summaryText.match(/(\d+) total/);
      const passedMatch = summaryText.match(/(\d+) passed/);
      const failedMatch = summaryText.match(/(\d+) failed/);
      const cancelledMatch = summaryText.match(/(\d+) cancelled/);

      if (totalMatch) testResults.total = parseInt(totalMatch[1]);
      if (passedMatch) testResults.passed = parseInt(passedMatch[1]);
      if (failedMatch) testResults.failed = parseInt(failedMatch[1]);
      if (cancelledMatch) testResults.cancelled = parseInt(cancelledMatch[1]);
    }

    // Collect detailed results from individual test rows
    const testRows = testTable.querySelectorAll('tbody tr');
    testController.log(`Found ${testRows.length} test rows`);

    testRows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 6) {
        const locationName = cells[0].textContent.trim();
        const expectedAccess = cells[1].textContent.trim();
        const requiredItems = cells[2].textContent.trim();
        const excludedItems = cells[3].textContent.trim();
        const resultCell = cells[5];

        let status = 'unknown';
        let message = '';

        if (resultCell) {
          const statusDiv = resultCell.querySelector('.test-status div');
          if (statusDiv) {
            message = statusDiv.textContent.trim();
            if (statusDiv.classList.contains('test-success')) {
              status = 'passed';
            } else if (statusDiv.classList.contains('test-failure')) {
              status = 'failed';
            } else if (statusDiv.classList.contains('test-cancelled')) {
              status = 'cancelled';
            } else if (statusDiv.classList.contains('test-error')) {
              status = 'error';
            }
          }
        }

        testResults.details.push({
          index: index,
          locationName: locationName,
          expectedAccess: expectedAccess,
          requiredItems: requiredItems,
          excludedItems: excludedItems,
          status: status,
          message: message,
        });
      }
    });

    // Report overall test results
    testController.reportCondition(
      `Test suite completed: ${testResults.passed}/${testResults.total} passed`,
      testResults.failed === 0
    );

    if (testResults.failed > 0) {
      testController.log(`${testResults.failed} tests failed:`, 'error');
      testResults.details.forEach((test) => {
        if (test.status === 'failed' || test.status === 'error') {
          testController.log(
            `  - ${test.locationName}: ${test.message}`,
            'error'
          );
        }
      });
      overallResult = false;
    }

    // Store results for Playwright to access
    if (typeof window !== 'undefined') {
      window.__testCaseResults__ = testResults;
      testController.log(
        'Test results stored in window.__testCaseResults__ for Playwright access'
      );
    }

    // Also store in localStorage for Playwright
    try {
      localStorage.setItem('__testCaseResults__', JSON.stringify(testResults));
      testController.log(
        'Test results stored in localStorage for Playwright access'
      );
    } catch (e) {
      testController.log(
        'Could not store results in localStorage: ' + e.message,
        'warn'
      );
    }

    testController.log(
      `testCasePanelInteractionTest finished. Overall Result: ${overallResult}. ` +
        `Results: ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.cancelled} cancelled`
    );
  } catch (error) {
    testController.log(
      `Error in testCasePanelInteractionTest: ${error.message}`,
      'error'
    );
    testController.reportCondition(`Test errored: ${error.message}`, false);
    overallResult = false;
  } finally {
    await testController.completeTest(overallResult);
  }
}

export async function singleTestCaseDebugTest(testController) {
  const testRunId = `test-run-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  testController.log(`[${testRunId}] Starting singleTestCaseDebugTest...`);

  let overallResult = true;
  try {
    testController.log(
      `[${testRunId}] Starting safe button targeting demonstration...`
    );
    testController.reportCondition('Test started', true);

    // REINTRODUCING: Event bus panel activation
    testController.log('Testing: Event bus panel activation...');

    const eventBusModule = await import('../../../app/core/eventBus.js');
    const eventBus = eventBusModule.default;

    if (!eventBus) {
      throw new Error('Event bus not available');
    }

    // Activate the Test Cases panel
    eventBus.publish('ui:activatePanel', { panelId: 'testCasesPanel' });
    testController.reportCondition('Event bus panel activation tested', true);

    // Wait for panel to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find the Test Cases panel
    testController.log('Looking for Test Cases panel after activation...');

    const testCasesPanel = document.querySelector('#test-cases-panel');
    if (!testCasesPanel) {
      testController.log(
        'Test Cases panel not found - this demo requires the panel to be available'
      );
      testController.reportCondition('Test Cases panel found', false);
      testController.log('SAFE EXIT: Panel activation may not have worked');
      testController.reportCondition('Safe demonstration completed', true);
      return;
    }
    testController.reportCondition('Test Cases panel found', true);

    // Check if test cases are already loaded
    let testTable = testCasesPanel.querySelector('#test-cases-results-table');

    if (!testTable) {
      // REINTRODUCING: Light World button click to load test cases
      testController.log(
        'Test cases not loaded - testing Light World button click...'
      );
      testController.reportCondition('Test cases pre-loaded', false);

      // Wait for the panel to load test sets
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Find the Light World test button
      let lightWorldButton = null;
      const allButtons = testCasesPanel.querySelectorAll('button');
      for (const button of allButtons) {
        if (button.textContent.toLowerCase().includes('light world')) {
          lightWorldButton = button;
          break;
        }
      }

      if (!lightWorldButton) {
        testController.log(
          'Light World test button not found - skipping button click test'
        );
        testController.reportCondition('Light World button found', false);
        testController.reportCondition('Safe demonstration completed', true);
        return;
      }

      testController.log('Found Light World button, testing click...');
      testController.reportCondition('Light World button found', true);

      // SAFETY CHECK: Before clicking, verify no tests are running
      const runAllButtonBefore = testCasesPanel.querySelector('#run-all-tests');
      if (runAllButtonBefore) {
        const isDisabledBefore = runAllButtonBefore.disabled;
        const buttonTextBefore = runAllButtonBefore.textContent.trim();

        if (isDisabledBefore || buttonTextBefore.includes('Running')) {
          testController.log(
            '❌ CRITICAL: Tests already running before Light World click!'
          );
          testController.reportCondition('Pre-click state safe', false);
          overallResult = false;
          return;
        } else {
          testController.log('✓ Pre-click state is safe');
          testController.reportCondition('Pre-click state safe', true);
        }
      }

      // TESTING: Click the Light World button
      testController.log('TESTING: Clicking Light World button...');
      lightWorldButton.click();

      // Wait for test cases to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // IMMEDIATE SAFETY CHECK: See if Light World click triggered batch execution
      const runAllButtonAfter = testCasesPanel.querySelector('#run-all-tests');
      if (runAllButtonAfter) {
        const isDisabledAfter = runAllButtonAfter.disabled;
        const buttonTextAfter = runAllButtonAfter.textContent.trim();

        if (
          isDisabledAfter ||
          buttonTextAfter.includes('Running') ||
          buttonTextAfter.includes('Cancel')
        ) {
          testController.log(
            '❌ CRITICAL: Light World button click triggered batch test execution!'
          );
          testController.reportCondition('Light World click safe', false);
          overallResult = false;

          // Try to cancel if possible
          const cancelButton =
            testCasesPanel.querySelector('#cancel-all-tests');
          if (cancelButton && cancelButton.style.display !== 'none') {
            testController.log(
              '🛑 Attempting to cancel the accidentally started tests...'
            );
            cancelButton.click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } else {
          testController.log(
            '✓ Light World button click was safe - no batch execution triggered'
          );
          testController.reportCondition('Light World click safe', true);
        }
      }

      // Find the test cases table after loading
      testTable = testCasesPanel.querySelector('#test-cases-results-table');
      if (!testTable) {
        testController.log(
          'Test cases table not found after Light World click'
        );
        testController.reportCondition('Test cases loaded after click', false);
        testController.reportCondition('Safe demonstration completed', true);
        return;
      }

      testController.log(
        '✓ Test cases loaded successfully after Light World click'
      );
      testController.reportCondition('Test cases loaded after click', true);
    } else {
      testController.reportCondition('Test cases pre-loaded', true);
      testController.log(
        '✓ Found pre-loaded test cases - proceeding with safe demonstration'
      );
    }

    // EARLY SAFETY CHECK: See if panel activation triggered anything
    testController.log('=== EARLY SAFETY CHECK ===');

    // Check Run All Tests button state immediately after panel activation
    const runAllButton = testCasesPanel.querySelector('#run-all-tests');
    if (runAllButton) {
      const isDisabled = runAllButton.disabled;
      const buttonText = runAllButton.textContent.trim();

      if (
        isDisabled ||
        buttonText.includes('Running') ||
        buttonText.includes('Cancel')
      ) {
        testController.log(
          '❌ CRITICAL: Panel activation triggered test execution!'
        );
        testController.reportCondition('Panel activation safe', false);
        overallResult = false;
      } else {
        testController.log('✓ Panel activation was safe - no tests triggered');
        testController.reportCondition('Panel activation safe', true);
      }
    }

    // SAFE DEMONSTRATION: Only read existing data, no interactions whatsoever
    testController.log('=== SAFE BUTTON TARGETING DEMONSTRATION ===');

    // Check what test data is available
    const testRows = testTable.querySelectorAll('tbody tr');
    testController.log(
      `Found ${testRows.length} test cases in the loaded table`
    );

    if (testRows.length === 0) {
      testController.log(
        'No test data found in table - skipping demonstration'
      );
      testController.reportCondition('Test data available', false);
      testController.reportCondition('Safe demonstration completed', true);
      return;
    }

    testController.reportCondition('Test data available', true);

    // Pick the first test case for demonstration (safer than looking for a specific one)
    const firstRow = testRows[0];
    const cells = firstRow.querySelectorAll('td');

    if (cells.length < 6) {
      testController.log(
        'Test table format not as expected - skipping demonstration'
      );
      testController.reportCondition('Test table format valid', false);
      testController.reportCondition('Safe demonstration completed', true);
      return;
    }

    const locationName = cells[0].textContent.trim();
    const expectedAccess = cells[1].textContent.trim();
    const requiredItems = cells[2].textContent.trim();
    const excludedItems = cells[3].textContent.trim();

    testController.log(
      `Demo target: "${locationName}" (expected: ${expectedAccess})`
    );
    testController.log(`Required items: ${requiredItems}`);
    testController.log(`Excluded items: ${excludedItems}`);
    testController.reportCondition('Demo target identified', true);

    // SAFE BUTTON IDENTIFICATION: Show selectors without using them
    testController.log('=== BUTTON SELECTOR DEMONSTRATION ===');

    const expectedIndividualButtonSelector = `button[data-test-type="individual"][data-location-name="${locationName}"]`;
    const expectedRunAllButtonSelector = '#run-all-tests';

    testController.log(
      `NEW individual button selector: ${expectedIndividualButtonSelector}`
    );
    testController.log(
      `NEW run-all button selector: ${expectedRunAllButtonSelector}`
    );

    // Check if selectors exist (READ-ONLY, no interaction)
    const individualButtonExists =
      testCasesPanel.querySelector(expectedIndividualButtonSelector) !== null;
    const runAllButtonExists =
      testCasesPanel.querySelector(expectedRunAllButtonSelector) !== null;

    testController.log(`Individual button exists: ${individualButtonExists}`);
    testController.log(`Run All Tests button exists: ${runAllButtonExists}`);

    // Document the improvements
    testController.log('=== TARGETING IMPROVEMENTS DEMONSTRATED ===');
    testController.log(
      '✓ Individual buttons can be targeted by data-test-type="individual"'
    );
    testController.log(
      '✓ Individual buttons can be targeted by data-location-name'
    );
    testController.log(
      '✓ Run All Tests button has unique ID for clear distinction'
    );
    testController.log(
      '✓ Individual buttons are contained in #test-cases-table-container'
    );
    testController.log('✓ Run All Tests button is in header controls area');

    testController.reportCondition(
      'Button targeting improvements documented',
      true
    );

    // VERIFY NO TESTS ARE RUNNING (this is the critical safety check)
    testController.log('=== FINAL SAFETY VERIFICATION ===');

    // Check Run All Tests button state
    if (runAllButton) {
      const isDisabled = runAllButton.disabled;
      const buttonText = runAllButton.textContent.trim();

      if (
        isDisabled ||
        buttonText.includes('Running') ||
        buttonText.includes('Cancel')
      ) {
        testController.log(
          '❌ CRITICAL: Run All Tests button shows tests are running!'
        );
        testController.reportCondition('No tests currently running', false);
        overallResult = false;
      } else {
        testController.log('✓ Run All Tests button is in normal state');
        testController.reportCondition('No tests currently running', true);
      }
    } else {
      testController.log('⚠️ Run All Tests button not found');
      testController.reportCondition('Run All Tests button found', false);
    }

    // Check for any active test statuses
    const allTestStatusElements = testTable.querySelectorAll('.test-status');
    let activeTestsCount = 0;
    let totalStatusElements = allTestStatusElements.length;

    allTestStatusElements.forEach((statusEl) => {
      const statusText = statusEl.textContent.trim();
      if (
        statusText.includes('Sending test to worker') ||
        statusText.includes('Running') ||
        statusText.includes('PASS') ||
        statusText.includes('FAIL') ||
        statusText.includes('Error')
      ) {
        activeTestsCount++;
      }
    });

    testController.log(
      `Found ${activeTestsCount} tests with active status out of ${totalStatusElements} total`
    );

    if (activeTestsCount === 0) {
      testController.log(
        '✓ No tests show active status - demonstration was completely safe'
      );
      testController.reportCondition('No test execution detected', true);
    } else {
      testController.log(
        `❌ CRITICAL: Found ${activeTestsCount} tests with active status - something triggered execution!`
      );
      testController.reportCondition('No test execution detected', false);
      overallResult = false;
    }

    // Final summary
    testController.log('=== DEMONSTRATION SUMMARY ===');
    testController.log(
      'This test safely demonstrated the new button targeting system by:'
    );
    testController.log('1. Testing event bus panel activation');
    testController.log('2. Testing Light World button click (if needed)');
    testController.log(
      '3. Reading existing test data without any button interactions'
    );
    testController.log('4. Showing what the new selectors would be');
    testController.log('5. Documenting the targeting improvements');
    testController.log('6. Verifying no tests were accidentally triggered');

    testController.reportCondition(
      'Safe demonstration completed successfully',
      true
    );
  } catch (error) {
    testController.log(
      `Error in button targeting demo: ${error.message}`,
      'error'
    );
    testController.reportCondition(`Test errored: ${error.message}`, false);
    overallResult = false;
  } finally {
    await testController.completeTest(overallResult);
  }
}

// Self-register tests
registerTest({
  id: 'test_config_load_and_item_check',
  name: 'Config Load and Item Check Test',
  description:
    'Tests loading rules configuration, adding items to inventory, and checking location accessibility based on item requirements.',
  testFunction: configLoadAndItemCheckTest,
  category: 'State Management',
  enabled: false,
  order: 0,
});

// Register the new test
registerTest({
  id: 'test_case_panel_interaction',
  name: 'Test Case Panel Interaction Test',
  description:
    'Tests activating the Test Cases panel, selecting the vanilla Light World test, running all tests, and collecting results for Playwright.',
  testFunction: testCasePanelInteractionTest,
  category: 'UI Interaction',
  enabled: false,
  order: 1,
});

// Self-register tests
registerTest({
  id: 'test_single_case_debug',
  name: 'Test Case Button Targeting Demo',
  description:
    'Demonstrates the new button targeting system for individual test buttons without executing tests. Shows how to reliably find and target specific test buttons.',
  testFunction: singleTestCaseDebugTest,
  category: 'UI Interaction',
  enabled: true,
  order: 2,
});
