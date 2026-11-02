// frontend/modules/tests/testCases/coreTests.js

import { registerTest } from '../testRegistry.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('coreTests', message, ...data);
  } else {
    const consoleMethod =
      console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[coreTests] ${message}`, ...data);
  }
}

export async function simpleEventTest(testController) {
  try {
    testController.log('Starting simpleEventTest...');
    testController.reportCondition('Test started', true);

    setTimeout(() => {
      log(
        'info',
        '[Test Case - simpleEventTest] Publishing tests:testEventAfterDelay'
      );
      // Assuming testController.eventBus is the correct eventBus instance
      testController.eventBus.publish('tests:testEventAfterDelay', {
        detail: 'Event Fired!',
      });
    }, 1000);

    testController.log('Waiting for tests:testEventAfterDelay...');
    const eventData = await testController.waitForEvent(
      'tests:testEventAfterDelay',
      2000
    );

    let passCondition = eventData && eventData.detail === 'Event Fired!';
    testController.reportCondition(
      'tests:testEventAfterDelay received correctly',
      passCondition
    );
    await testController.completeTest(passCondition);
  } catch (error) {
    testController.log(`Error in simpleEventTest: ${error.message}`, 'error');
    testController.reportCondition(`Test errored: ${error.message}`, false);
    await testController.completeTest(false);
  }
}

export async function superQuickTest(testController) {
  log('info', '[superQuickTest] STARTED - function entry point');
  try {
    log('info', '[superQuickTest] About to call testController.log...');
    testController.log('Starting superQuickTest...');
    log('info', '[superQuickTest] About to call reportCondition...');
    testController.reportCondition('Super quick test started', true);
    log('info', '[superQuickTest] About to do math...');
    // Simulate some quick synchronous operations
    let x = 1 + 1;
    if (x !== 2) {
      log('info', '[superQuickTest] Math failed!');
      testController.reportCondition('Basic math failed (1+1!=2)', false);
      await testController.completeTest(false);
      return;
    }
    log('info', '[superQuickTest] Math passed, reporting...');
    testController.reportCondition('Basic math passed (1+1=2)', true);
    testController.reportCondition(
      'Super quick test finished successfully',
      true
    );
    log('info', '[superQuickTest] About to call completeTest(true)...');
    await testController.completeTest(true);
    log('info', '[superQuickTest] COMPLETED successfully');
  } catch (error) {
    log('info', '[superQuickTest] CAUGHT ERROR:', error);
    testController.log(`Error in superQuickTest: ${error.message}`, 'error');
    testController.reportCondition(`Test errored: ${error.message}`, false);
    await testController.completeTest(false);
  }
}

export async function rulesReloadTest(testController) {
  log('info', '[rulesReloadTest] STARTED - testing rules reload functionality with complete UI state verification');
  try {
    testController.log('Starting comprehensive rules reload test with inventory validation...');
    testController.reportCondition('Rules reload test started', true);

    // Track if we receive the stateManager:rulesLoaded event
    let rulesLoadedEventReceived = false;

    // Step 0: Load ALTTP rules first (this test uses ALTTP-specific locations)
    testController.log('Step 0: Loading ALTTP rules for test setup...');
    await testController.loadALTTPRules();
    testController.reportCondition('ALTTP rules loaded for test', true);

    // Note: loadALTTPRules() already waits for stateManager:rulesLoaded event, so no delay needed

    // Step 1: Activate the Locations panel
    testController.log('Step 1: Activating Locations panel...');
    testController.eventBus.publish('ui:activatePanel', { panelId: 'locationsPanel' });

    // Wait for the panel to be ready
    const locationsReady = await testController.pollForCondition(
      () => {
        const locationsPanel = document.querySelector('.locations-panel-container');
        return locationsPanel && locationsPanel.querySelector('#locations-grid');
      },
      'Locations panel ready',
      5000,
      50
    );
    testController.reportCondition('Locations panel activated', locationsReady);

    // Step 1b: Ensure "Show Checked" checkbox is enabled
    testController.log('Step 1b: Ensuring "Show Checked" checkbox is enabled...');
    const showCheckedCheckbox = document.querySelector('#show-checked');
    if (showCheckedCheckbox && !showCheckedCheckbox.checked) {
      testController.log('"Show Checked" was not checked, enabling it...');
      showCheckedCheckbox.click();
      // The checkbox change triggers UI update synchronously, no wait needed
    }
    testController.reportCondition('"Show Checked" checkbox enabled', showCheckedCheckbox && showCheckedCheckbox.checked);

    // Step 2: Click on the Mushroom location to check it
    testController.log('Step 2: Looking for Mushroom location...');
    
    // Find the Mushroom location
    const mushroomLocation = await testController.pollForValue(
      () => {
        const locationCards = document.querySelectorAll('.location-card');
        for (const card of locationCards) {
          if (card.textContent.includes('Mushroom')) {
            return card;
          }
        }
        return null;
      },
      'Mushroom location found',
      5000,
      50
    );
    
    if (mushroomLocation) {
      testController.reportCondition('Mushroom location found', true);
      testController.log('Clicking on Mushroom location to check it...');
      mushroomLocation.click();
      testController.reportCondition('Mushroom location clicked', true);
    } else {
      testController.reportCondition('Mushroom location not found', false);
    }

    // Step 3: Confirm that the Mushroom location is checked (polling handles the wait)
    testController.log('Step 3: Confirming Mushroom location is checked...');
    const mushroomLocationChecked = await testController.pollForCondition(
      () => {
        const locationCards = document.querySelectorAll('.location-card');
        for (const card of locationCards) {
          if (card.textContent.includes('Mushroom')) {
            const classes = Array.from(card.classList).join(', ');
            testController.log(`Mushroom card classes: ${classes}`);
            // Check for either checked or pending (pending means the click worked, waiting for confirmation)
            return card.classList.contains('checked') || card.classList.contains('pending');
          }
        }
        return false;
      },
      'Mushroom location is checked or pending',
      5000,
      50
    );
    testController.reportCondition('Mushroom location confirmed checked', mushroomLocationChecked);

    // Step 4: Activate Inventory panel to check for Rupees (20)
    testController.log('Step 4: Activating Inventory panel...');
    testController.eventBus.publish('ui:activatePanel', { panelId: 'inventoryPanel' });
    
    // Wait for inventory panel to be ready
    const inventoryReady = await testController.pollForCondition(
      () => {
        const inventoryPanel = document.querySelector('.inventory-panel-container');
        return inventoryPanel && inventoryPanel.querySelector('.inventory-content');
      },
      'Inventory panel ready',
      5000,
      50
    );
    testController.reportCondition('Inventory panel activated', inventoryReady);

    // Step 5: Confirm "Rupees (20)" appears in inventory
    testController.log('Step 5: Checking for Rupees (20) in inventory...');
    const rupeesFound = await testController.pollForCondition(
      () => {
        const inventoryItems = document.querySelectorAll('.item-container, .item-button');
        for (const item of inventoryItems) {
          if (item.textContent.includes('Rupees') && item.textContent.includes('20')) {
            // Check if the item is actually visible and active (owned)
            const button = item.classList.contains('item-button') ? item : item.querySelector('.item-button');
            if (button) {
              const isOwned = button.classList.contains('active');
              const itemContainer = button.closest('.item-container');
              const style = window.getComputedStyle(itemContainer);
              const parentStyle = window.getComputedStyle(itemContainer.parentElement);
              
              // Item is considered "appearing" if it's owned (active) AND visible
              if (isOwned && style.display !== 'none' && style.visibility !== 'hidden' && 
                  parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden') {
                testController.log(`Rupees (20) found as owned and visible - classes: ${button.classList.toString()}`);
                return true; // Found and visible
              }
            }
          }
        }
        return false;
      },
      'Rupees (20) found in inventory',
      5000,
      50
    );
    testController.reportCondition('Rupees (20) appears in inventory', rupeesFound);

    // Step 5b: Confirm "Bow" does NOT appear in inventory (should be hidden)
    testController.log('Step 5b: Checking that Bow does NOT appear in inventory...');
    const bowNotFound = await testController.pollForCondition(
      () => {
        const inventoryItems = document.querySelectorAll('.item-container, .item-button');
        for (const item of inventoryItems) {
          if (item.textContent.includes('Bow')) {
            // Check if the item is actually visible and active (owned)
            const button = item.classList.contains('item-button') ? item : item.querySelector('.item-button');
            if (button) {
              const isOwned = button.classList.contains('active');
              const itemContainer = button.closest('.item-container');
              const style = window.getComputedStyle(itemContainer);
              const parentStyle = window.getComputedStyle(itemContainer.parentElement);
              
              // Item is considered "appearing" if it's owned (active) AND visible
              if (isOwned && style.display !== 'none' && style.visibility !== 'hidden' && 
                  parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden') {
                testController.log(`Bow found as owned and visible - classes: ${button.classList.toString()}`);
                return false; // If we find an owned and visible Bow, condition not met
              }
            }
          }
        }
        return true; // No owned and visible Bow found = condition met
      },
      'Bow not found in inventory',
      3000,
      50
    );
    testController.reportCondition('Bow does not appear in inventory', bowNotFound);

    // Step 7: Activate the Regions panel  
    testController.log('Step 7: Activating Regions panel...');
    testController.eventBus.publish('ui:activatePanel', { panelId: 'regionsPanel' });
    
    // Wait for the panel to be ready
    const regionsReady = await testController.pollForCondition(
      () => {
        const regionsPanel = document.querySelector('.regions-panel-container');
        return regionsPanel && regionsPanel.querySelector('#region-details-container');
      },
      'Regions panel ready',
      5000,
      50
    );
    testController.reportCondition('Regions panel activated', regionsReady);

    // Step 8: Click on the exit block for "Links House S&Q → Links House"
    testController.log('Step 8: Looking for Links House S&Q exit...');

    const exitElement = await testController.pollForValue(
      () => {
        // Find the exit wrapper div (not the li), which has the click handler
        const exitsList = document.querySelector('.region-exits-list');
        if (!exitsList) return null;

        const exitItems = exitsList.querySelectorAll('li');
        for (const exitItem of exitItems) {
          const exitText = exitItem.textContent;
          if (exitText.includes('Links House S&Q') && exitText.includes('Links House')) {
            // Return the exit-wrapper div inside the li, which has the click handler
            return exitItem.querySelector('.exit-wrapper');
          }
        }
        return null;
      },
      'Links House S&Q exit found',
      5000,
      50
    );

    if (exitElement) {
      testController.reportCondition('Links House S&Q exit found', true);
      testController.log('Clicking Links House S&Q exit wrapper...');
      testController.log(`Exit element tag: ${exitElement.tagName}, classes: ${exitElement.className}`);

      // Click the exit-wrapper div which has the actual click handler
      // The click handler checks if target is region-link and returns early if so
      testController.log('Clicking the exit-wrapper to trigger navigation...');

      // Just use a simple click - the wrapper already has the handler attached
      exitElement.click();
      testController.reportCondition('Links House S&Q exit clicked', true);
    } else {
      testController.reportCondition('Links House S&Q exit not found', false);
    }

    // Step 9: Confirm Links House region block appears (polling handles the wait)
    testController.log('Step 9: Confirming Links House region block appears...');
    const linksHouseAdded = await testController.pollForCondition(
      () => {
        // Region blocks now use data-region attribute instead of .region-name elements
        const regionsPanel = document.querySelector('.regions-panel-container');
        if (!regionsPanel) return false; // If regions panel not found, region hasn't appeared

        const regionsContainer = regionsPanel.querySelector('#region-details-container');
        if (!regionsContainer) return false; // If regions container not found, region hasn't appeared

        // Look for region block with data-region="Links House"
        const linksHouseBlock = regionsContainer.querySelector('.region-block[data-region="Links House"]');
        return !!linksHouseBlock; // Found it if block exists
      },
      'Links House region block appears',
      5000,
      50
    );
    testController.reportCondition('Links House region block confirmed added', linksHouseAdded);

    // Step 10: Run loadALTTPRules
    testController.log('Step 10: Calling loadALTTPRules()...');
    
    // Set up a promise to wait for the stateManager:rulesLoaded event
    const rulesLoadedPromise = testController.waitForEvent('stateManager:rulesLoaded', 10000);
    
    // Start the reload (this will fire the event)
    await testController.loadALTTPRules();
    
    testController.reportCondition('loadALTTPRules() completed successfully', true);
    testController.log('Rules reload completed successfully');
    
    // Wait for the event to be received
    try {
      const eventData = await rulesLoadedPromise;
      rulesLoadedEventReceived = true;
      testController.log(`stateManager:rulesLoaded event received with data keys: ${Object.keys(eventData || {}).join(', ')}`);
    } catch (error) {
      testController.log(`Failed to receive stateManager:rulesLoaded event: ${error.message}`, 'warn');
      rulesLoadedEventReceived = false;
    }

    // Note: UI refresh happens on stateManager:rulesLoaded event, no delay needed
    // The polling checks below will wait for the actual UI changes

    // Step 11: Check if our test received the event
    testController.reportCondition('Test received stateManager:rulesLoaded event', rulesLoadedEventReceived);
    
    if (!rulesLoadedEventReceived) {
      testController.log('WARNING: stateManager:rulesLoaded event was not received - UI panels likely not refreshing', 'warn');
    }

    // Step 12: Check if Mushroom location is now marked as unchecked
    testController.log('Step 12: Checking if Mushroom location is now unchecked after reload...');
    
    let mushroomUnchecked = false;
    const locationCards = document.querySelectorAll('.location-card');
    for (const card of locationCards) {
      if (card.textContent.includes('Mushroom')) {
        // Check if it's not marked as checked (no checked class or styling)
        mushroomUnchecked = !card.classList.contains('checked') && 
                            !card.classList.contains('location-checked');
        testController.log(`Mushroom location classes after reload: ${Array.from(card.classList).join(', ')}`);
        break;
      }
    }
    testController.reportCondition('Mushroom location is unchecked after reload', mushroomUnchecked);

    // Step 13: Check if Rupees (20) is removed from inventory
    testController.log('Step 13: Checking if Rupees (20) is removed from inventory after reload...');
    
    const rupeesRemovedAfterReload = await testController.pollForCondition(
      () => {
        const inventoryItems = document.querySelectorAll('.item-container, .item-button');
        for (const item of inventoryItems) {
          if (item.textContent.includes('Rupees') && item.textContent.includes('20')) {
            // Check if the item is actually visible and active (owned)
            const button = item.classList.contains('item-button') ? item : item.querySelector('.item-button');
            if (button) {
              const isOwned = button.classList.contains('active');
              const itemContainer = button.closest('.item-container');
              const style = window.getComputedStyle(itemContainer);
              const parentStyle = window.getComputedStyle(itemContainer.parentElement);
              
              // Item is considered "still appearing" if it's owned (active) AND visible
              if (isOwned && style.display !== 'none' && style.visibility !== 'hidden' && 
                  parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden') {
                testController.log(`Rupees (20) still found as owned and visible after reload - classes: ${button.classList.toString()}`);
                return false; // If we still find it owned and visible, condition not met
              }
            }
          }
        }
        return true; // Not found as owned and visible = removed = condition met
      },
      'Rupees (20) removed from inventory',
      3000,
      50
    );
    testController.reportCondition('Rupees (20) removed from inventory after reload', rupeesRemovedAfterReload);

    // Step 14: Check if Links House region block is removed
    testController.log('Step 14: Checking if Links House region block is removed after reload...');
    
    const linksHouseRemovedAfterReload = await testController.pollForCondition(
      () => {
        // Region blocks now use data-region attribute instead of .region-name elements
        const regionsPanel = document.querySelector('.regions-panel-container');
        if (!regionsPanel) return true; // If regions panel not found, consider it removed

        const regionsContainer = regionsPanel.querySelector('#region-details-container');
        if (!regionsContainer) return true; // If regions container not found, consider it removed

        // Look for region block with data-region="Links House"
        const linksHouseBlock = regionsContainer.querySelector('.region-block[data-region="Links House"]');
        return !linksHouseBlock; // Return true if block is NOT found (i.e., removed)
      },
      'Links House region block removed',
      3000,
      50
    );
    testController.reportCondition('Links House region block removed after reload', linksHouseRemovedAfterReload);
    
    // Verify that the state manager is accessible after reload
    const snapshot = testController.stateManager.getSnapshot();
    const snapshotAvailable = !!snapshot;
    testController.reportCondition('State snapshot available after reload', snapshotAvailable);
    if (snapshot) {
      testController.log(`State snapshot contains ${Object.keys(snapshot).length} properties`);
    }
    
    // Calculate overall test result based on all critical conditions
    const criticalConditions = [
      rulesLoadedEventReceived,
      mushroomUnchecked, 
      rupeesRemovedAfterReload,
      linksHouseRemovedAfterReload,
      snapshotAvailable
    ];
    
    const allCriticalConditionsPassed = criticalConditions.every(condition => condition === true);
    const failedCount = criticalConditions.filter(condition => condition !== true).length;
    
    if (allCriticalConditionsPassed) {
      testController.reportCondition('All critical UI refresh conditions passed', true);
      log('info', '[rulesReloadTest] COMPLETED successfully - all UI panels refresh correctly');
      await testController.completeTest(true);
    } else {
      testController.reportCondition(`Critical UI refresh failure: ${failedCount} of ${criticalConditions.length} conditions failed`, false);
      testController.log(`FAILED: ${failedCount} critical conditions failed. Test shows UI panels not refreshing properly during rules reload.`, 'error');
      log('error', `[rulesReloadTest] FAILED - ${failedCount} critical conditions failed`);
      await testController.completeTest(false);
    }
  } catch (error) {
    log('error', '[rulesReloadTest] CAUGHT ERROR:', error);
    testController.log(`Error in rulesReloadTest: ${error.message}`, 'error');
    testController.reportCondition(`Test errored: ${error.message}`, false);
    await testController.completeTest(false);
  }
}

/**
 * test_core_rules_load_failed_named — a rules file the worker cannot load shows a
 * NAMED error and the page does not hang (rule-engine-worker-load-failure, option A).
 *
 * ⛓ Before: a structural data error (C5: `region.exits = 5`) threw inside the
 * worker's loadFromJSON; only `workerError` was posted, nothing settled
 * initialLoadPromise, ensureReady() waited out its timeout and the page showed
 * nothing but two console lines.
 *
 * Drives the page's own load path (loadRules + rawJsonDataLoaded, as
 * loadRulesFromFile does) with the committed concept_trial AP_1 rules, mutated in
 * memory, then restores ALTTP so the next row starts where the roster expects.
 */
export async function rulesLoadFailedNamedTest(testController) {
  const RULES = './presets/concept_trial/AP_1/AP_1_rules.json';
  const SOURCE = 'concept_trial AP_1 (C5: region_2_2.exits = 5)';
  const uncaught = [];
  const onError = (e) => uncaught.push(`error: ${e.message || e.error || e}`);
  const onRejection = (e) => uncaught.push(`unhandledrejection: ${e.reason?.message || e.reason}`);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  let ok = true;
  const check = (description, condition) => {
    testController.reportCondition(description, !!condition);
    ok = ok && !!condition;
  };
  const handlerErrorsBefore = testController.eventBus?.handlerErrorCount ?? 0;
  try {
    const sm = testController.stateManager;
    await sm.ensureReady(5000);
    const response = await fetch(RULES);
    const rules = await response.json();
    rules.regions['1'].region_2_2.exits = 5;
    const playerInfo = { playerId: '1', playerName: 'TestPlayer1' };

    const failedPromise = testController.waitForEvent('stateManager:loadFailed', 8000);
    await sm.loadRules(rules, playerInfo, SOURCE);
    testController.eventBus?.publishAs?.('stateManager:rawJsonDataLoaded', {
      source: SOURCE, rawJsonData: rules, selectedPlayerInfo: playerInfo,
    }, 'stateManager');
    const failure = await failedPromise;
    check(
      `stateManager:loadFailed names game/player/phase (${failure?.game} / ${failure?.player} / ${failure?.phase}: ${failure?.message})`,
      !!failure && failure.game === 'Procgen Maze' && failure.player === '1'
        && failure.phase === 'processStartingItems' && /not iterable/.test(failure.message || '')
    );

    const banner = await testController.pollForValue(
      () => document.getElementById('rules-load-failed-banner'),
      'rules-load-failed banner shown', 5000, 50
    );
    const text = banner?.textContent || '';
    check(
      'the banner names the game, the player, the phase and the message',
      text.includes('Game: Procgen Maze') && text.includes('Player: 1')
        && text.includes('Phase: processStartingItems') && text.includes('not iterable')
    );

    const t0 = performance.now();
    const ready = await sm.ensureReady(10000);
    const waited = Math.round(performance.now() - t0);
    check(
      `ensureReady() settles false at once, not after its timeout (${waited} ms)`,
      ready === false && waited < 2000
    );

    // A quiet window for anything the failure sets off after the banner.
    await new Promise((r) => setTimeout(r, 750));
    const handlerErrors = (testController.eventBus?.handlerErrorCount ?? 0) - handlerErrorsBefore;
    check(
      `no secondary uncaught error or bus handler error after the banner (${uncaught.length} uncaught, ${handlerErrors} handler)${uncaught.length ? `: ${uncaught.join(' | ')}` : ''}`,
      uncaught.length === 0 && handlerErrors === 0
    );

    // Fail, then a good load: the page boots again and the banner goes.
    await testController.loadALTTPRules();
    const readyAgain = await sm.ensureReady(10000);
    check('a later good load boots (ensureReady true)', readyAgain === true);
    check(
      'the good load removes the banner',
      !document.getElementById('rules-load-failed-banner')
    );
    await testController.completeTest(ok);
  } catch (error) {
    testController.reportCondition(`Test errored: ${error.message}`, false);
    await testController.completeTest(false);
  } finally {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  }
}

// Self-register tests

registerTest({
  id: 'test_core_super_quick',
  name: 'Super Quick Test',
  description: 'A test that completes almost instantly.',
  testFunction: superQuickTest,
  category: 'Core',
  //enabled: false,
  //order: 0,
});

registerTest({
  id: 'test_core_simple_event',
  name: 'Test Simple Event Wait',
  description:
    'Checks if waitForEvent correctly pauses and resumes on a custom event.',
  testFunction: simpleEventTest,
  category: 'Core',
  //enabled: false,
  //order: 1,
});

registerTest({
  id: 'test_core_rules_reload',
  name: 'Rules Reload Test',
  description:
    'Tests the loadALTTPRules() function to ensure it properly loads the default rules.json file and waits for completion.',
  testFunction: rulesReloadTest,
  category: 'Core',
  //enabled: true,
  //order: 2,
});

registerTest({
  id: 'test_core_rules_load_failed_named',
  name: 'Rules Load Failure Is Named',
  description:
    'A rules file the worker cannot load (C5: region.exits = 5) shows a named error (game, player, phase, message), ensureReady settles at once, and a later good load boots.',
  testFunction: rulesLoadFailedNamedTest,
  category: 'Core',
});
