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
      }, 'tests');
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
  log('info', '[rulesReloadTest] STARTED - testing rules reload functionality with UI state verification');
  try {
    testController.log('Starting comprehensive rules reload test...');
    testController.reportCondition('Rules reload test started', true);

    // Set up event listeners to track stateManager:rulesLoaded event
    let rulesLoadedEventReceived = false;
    
    const eventTracker = (eventData) => {
      rulesLoadedEventReceived = true;
      testController.log(`stateManager:rulesLoaded event received with data keys: ${Object.keys(eventData || {}).join(', ')}`);
    };
    
    // Subscribe to the same event that UI panels listen to
    const unsubscribe = testController.eventBus.subscribe('stateManager:rulesLoaded', eventTracker, 'rulesReloadTest');
    
    try {
      // Step 1: Activate the Locations panel
      testController.log('Step 1: Activating Locations panel...');
      testController.eventBus.publish('ui:activatePanel', { panelId: 'locationsPanel' }, 'tests');
      
      // Wait for the panel to be ready
      const locationsReady = await testController.pollForCondition(
        () => {
          const locationsPanel = document.querySelector('.locations-panel-container');
          return locationsPanel && locationsPanel.querySelector('#locations-grid');
        },
        'Locations panel ready',
        5000,
        250
      );
      testController.reportCondition('Locations panel activated', locationsReady);

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
        10000,
        500
      );
      
      if (mushroomLocation) {
        testController.reportCondition('Mushroom location found', true);
        testController.log('Clicking on Mushroom location to check it...');
        mushroomLocation.click();
        
        // Wait for the location to be checked
        await new Promise(resolve => setTimeout(resolve, 1000));
        testController.reportCondition('Mushroom location clicked', true);
      } else {
        testController.reportCondition('Mushroom location not found', false);
      }

      // Step 3: Activate the Regions panel  
      testController.log('Step 3: Activating Regions panel...');
      testController.eventBus.publish('ui:activatePanel', { panelId: 'regionsPanel' }, 'tests');
      
      // Wait for the panel to be ready
      const regionsReady = await testController.pollForCondition(
        () => {
          const regionsPanel = document.querySelector('.regions-panel-container');
          return regionsPanel && regionsPanel.querySelector('#region-details-container');
        },
        'Regions panel ready',
        5000,
        250
      );
      testController.reportCondition('Regions panel activated', regionsReady);

      // Step 4: Click on the Move button for "Links House S&Q → Links House"
      testController.log('Step 4: Looking for Links House S&Q move button...');
      
      const moveButton = await testController.pollForValue(
        () => {
          const moveButtons = document.querySelectorAll('.move-btn');
          for (const button of moveButtons) {
            if (button.parentElement && 
                button.parentElement.textContent.includes('Links House S&Q')) {
              return button;
            }
          }
          return null;
        },
        'Links House S&Q move button found',
        10000,
        500
      );
      
      if (moveButton) {
        testController.reportCondition('Links House S&Q move button found', true);
        testController.log('Clicking Links House S&Q move button...');
        moveButton.click();
        
        // Wait for the region to be added
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify Links House region block was added
        const linksHouseRegion = document.querySelector('.region-block[data-region="Links House"]') ||
                                Array.from(document.querySelectorAll('.region-block')).find(block => 
                                  block.textContent && block.textContent.includes('Links House'));
        testController.reportCondition('Links House region block added', !!linksHouseRegion);
      } else {
        testController.reportCondition('Links House S&Q move button not found', false);
      }

      // Step 5: Run reloadCurrentRules
      testController.log('Step 5: Calling reloadCurrentRules()...');
      await testController.reloadCurrentRules();
      
      testController.reportCondition('reloadCurrentRules() completed successfully', true);
      testController.log('Rules reload completed successfully');
      
      // Give time for events to propagate and UI to refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 6: Check if our test listener received the event
      testController.reportCondition('Test listener received stateManager:rulesLoaded event', rulesLoadedEventReceived);
      
      if (!rulesLoadedEventReceived) {
        testController.log('WARNING: stateManager:rulesLoaded event was not received - UI panels likely not refreshing', 'warn');
      }

      // Step 7: Check if Mushroom location is now marked as unchecked
      testController.log('Step 6: Checking if Mushroom location is now unchecked...');
      
      const mushroomLocationAfter = document.querySelector('.location-card');
      let mushroomUnchecked = false;
      
      if (mushroomLocationAfter) {
        const locationCards = document.querySelectorAll('.location-card');
        for (const card of locationCards) {
          if (card.textContent.includes('Mushroom')) {
            // Check if it's not marked as checked (no checked class or styling)
            mushroomUnchecked = !card.classList.contains('checked') && 
                               !card.classList.contains('location-checked');
            testController.log(`Mushroom location classes: ${Array.from(card.classList).join(', ')}`);
            break;
          }
        }
      }
      
      testController.reportCondition('Mushroom location is unchecked after reload', mushroomUnchecked);

      // Step 8: Check if Links House region block is removed
      testController.log('Step 7: Checking if Links House region block is removed...');
      
      // Look for Links House region block - it should be gone or reset
      const linksHouseRegionAfter = document.querySelector('.region-block[data-region-name="Links House"]');
      const regionsContainer = document.querySelector('.regions-container');
      let linksHouseRemoved = true;
      
      if (regionsContainer) {
        const regionBlocks = regionsContainer.querySelectorAll('.region-block, .region-card');
        for (const block of regionBlocks) {
          if (block.textContent && block.textContent.includes('Links House')) {
            linksHouseRemoved = false;
            testController.log('Links House region block still present after reload');
            break;
          }
        }
      }
      
      testController.reportCondition('Links House region block removed after reload', linksHouseRemoved);
      
      // Verify that the state manager is accessible after reload
      const snapshot = testController.stateManager.getSnapshot();
      if (snapshot) {
        testController.reportCondition('State snapshot available after reload', true);
        testController.log(`State snapshot contains ${Object.keys(snapshot).length} properties`);
      } else {
        testController.reportCondition('State snapshot not available after reload', false);
        await testController.completeTest(false);
        return;
      }
      
      testController.reportCondition('Comprehensive rules reload test completed successfully', true);
      log('info', '[rulesReloadTest] COMPLETED successfully');
      await testController.completeTest(true);
    } finally {
      // Clean up event listener
      unsubscribe();
    }
  } catch (error) {
    log('error', '[rulesReloadTest] CAUGHT ERROR:', error);
    testController.log(`Error in rulesReloadTest: ${error.message}`, 'error');
    testController.reportCondition(`Test errored: ${error.message}`, false);
    await testController.completeTest(false);
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
    'Tests the reloadCurrentRules() function to ensure it properly reloads the current rules.json file and waits for completion.',
  testFunction: rulesReloadTest,
  category: 'Core',
  enabled: true,
  //order: 2,
});
