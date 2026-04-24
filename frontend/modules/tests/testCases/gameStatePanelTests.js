/**
 * Tests for GameState and GameStatePanel modules
 */

import { registerTest } from '../testRegistry.js';

export function testGameStateInitialRegion(testController) {
  testController.log('Testing GameState initial region...');
  
  const gameState = testController.centralRegistry.getPublicFunction('gameState', 'getState')();
  const currentRegion = gameState.getCurrentRegion();
  
  testController.reportCondition(
    'Initial region should be Menu',
    currentRegion === 'Menu',
    `Current region: ${currentRegion}`
  );
  
  testController.completeTest();
}

export async function testGameStateRegionUpdate(testController) {
  testController.log('Testing GameState region update via user:regionMove event...');
  
  const gameState = testController.centralRegistry.getPublicFunction('gameState', 'getState')();
  const initialRegion = gameState.getCurrentRegion();
  
  testController.reportCondition(
    'Initial region should be Menu',
    initialRegion === 'Menu',
    `Initial region: ${initialRegion}`
  );
  
  // Dispatch a user:regionMove event
  testController.eventDispatcher.dispatch('user:regionMove', {
    sourceRegion: 'Menu',
    targetRegion: 'Links House',
    exitName: 'To House'
  }, 'bottom');
  
  // Wait a bit for event processing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const newRegion = gameState.getCurrentRegion();
  testController.reportCondition(
    'Region should update to Links House',
    newRegion === 'Links House',
    `New region: ${newRegion}`
  );
  
  testController.completeTest();
}

export async function testGameStateResetOnRulesLoaded(testController) {
  testController.log('Testing GameState reset on rules loaded...');
  
  const gameState = testController.centralRegistry.getPublicFunction('gameState', 'getState')();
  
  // Move to a different region first
  testController.eventDispatcher.dispatch('user:regionMove', {
    sourceRegion: 'Menu',
    targetRegion: 'Links House',
    exitName: 'To House'
  }, 'bottom');
  
  await testController.waitForTimeout(100);
  
  const movedRegion = gameState.getCurrentRegion();
  testController.reportCondition(
    'Should be in Links House before reset',
    movedRegion === 'Links House',
    `Current region: ${movedRegion}`
  );
  
  // Dispatch state:rulesLoaded event
  testController.eventDispatcher.dispatch('state:rulesLoaded', {}, 'bottom');
  
  await testController.waitForTimeout(100);
  
  const resetRegion = gameState.getCurrentRegion();
  testController.reportCondition(
    'Region should reset to Menu',
    resetRegion === 'Menu',
    `Reset region: ${resetRegion}`
  );
  
  testController.completeTest();
}

export async function testGameStateEventPublishing(testController) {
  testController.log('Testing GameState event publishing...');
  
  const gameState = testController.centralRegistry.getPublicFunction('gameState', 'getState')();
  let eventReceived = false;
  let eventData = null;
  
  // Subscribe to gameState:regionChanged event
  const unsubscribe = testController.eventBus.subscribe('gameState:regionChanged', (data) => {
    eventReceived = true;
    eventData = data;
  });
  
  // Trigger a region change
  testController.eventDispatcher.dispatch('user:regionMove', {
    sourceRegion: 'Menu',
    targetRegion: 'Links House',
    exitName: 'To House'
  }, 'bottom');
  
  await testController.waitForTimeout(100);
  
  testController.reportCondition(
    'gameState:regionChanged event should be received',
    eventReceived,
    `Event received: ${eventReceived}`
  );
  
  testController.reportCondition(
    'Event should contain correct data',
    eventData && eventData.oldRegion === 'Menu' && eventData.newRegion === 'Links House',
    `Event data: ${JSON.stringify(eventData)}`
  );
  
  // Cleanup
  unsubscribe();
  
  testController.completeTest();
}

export async function testGameStatePanelDisplay(testController) {
  testController.log('Testing GameStatePanel display...');
  
  // Check if panel exists
  const panelElement = document.querySelector('.game-state-panel');
  testController.reportCondition(
    'GameStatePanel should exist in DOM',
    panelElement !== null,
    `Panel found: ${panelElement !== null}`
  );
  
  if (panelElement) {
    const regionDisplay = panelElement.querySelector('.region-name');
    testController.reportCondition(
      'Region display element should exist',
      regionDisplay !== null,
      `Region display found: ${regionDisplay !== null}`
    );
    
    if (regionDisplay) {
      const displayedRegion = regionDisplay.textContent;
      testController.reportCondition(
        'Should display current region',
        displayedRegion === 'Menu' || displayedRegion === 'Links House',
        `Displayed region: ${displayedRegion}`
      );
    }
  }
  
  testController.completeTest();
}

export async function testGameStatePanelUpdate(testController) {
  testController.log('Testing GameStatePanel updates on region change...');
  
  const panelElement = document.querySelector('.game-state-panel');
  if (!panelElement) {
    testController.reportCondition(
      'GameStatePanel should exist',
      false,
      'Panel not found in DOM'
    );
    testController.completeTest();
    return;
  }
  
  const regionDisplay = panelElement.querySelector('.region-name');
  const initialRegion = regionDisplay ? regionDisplay.textContent : '';
  
  // Trigger a region change
  testController.eventDispatcher.dispatch('user:regionMove', {
    sourceRegion: 'Menu',
    targetRegion: 'Links House',
    exitName: 'To House'
  }, 'bottom');
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const updatedRegion = regionDisplay ? regionDisplay.textContent : '';
  testController.reportCondition(
    'Panel should update to show new region',
    updatedRegion === 'Links House',
    `Initial: ${initialRegion}, Updated: ${updatedRegion}`
  );
  
  // Reset to Menu
  testController.eventDispatcher.dispatch('state:rulesLoaded', {}, 'bottom');
  
  testController.completeTest();
}

// Register all tests
registerTest({
  id: 'test_gamestate_initial_region',
  name: 'GameState Initial Region',
  category: 'Game State',
  testFunction: testGameStateInitialRegion,
  //enabled: true,
  description: 'Tests that GameState initializes with Menu as the current region.'
});

registerTest({
  id: 'test_gamestate_region_update',
  name: 'GameState Region Update',
  category: 'Game State',
  testFunction: testGameStateRegionUpdate,
  //enabled: true,
  description: 'Tests that GameState updates region via user:regionMove events.'
});

registerTest({
  id: 'test_gamestate_reset_on_rules',
  name: 'GameState Reset on Rules Loaded',
  category: 'Game State',
  testFunction: testGameStateResetOnRulesLoaded,
  //enabled: true,
  description: 'Tests that GameState resets to Menu when rules are loaded.'
});

registerTest({
  id: 'test_gamestate_event_publishing',
  name: 'GameState Event Publishing',
  category: 'Game State',
  testFunction: testGameStateEventPublishing,
  //enabled: true,
  description: 'Tests that GameState publishes gameState:regionChanged events.'
});

registerTest({
  id: 'test_gamestatepanel_display',
  name: 'GameStatePanel Display',
  category: 'Game State',
  testFunction: testGameStatePanelDisplay,
  //enabled: true,
  description: 'Tests that GameStatePanel displays in the DOM.'
});

registerTest({
  id: 'test_gamestatepanel_update',
  name: 'GameStatePanel Update',
  category: 'Game State',
  testFunction: testGameStatePanelUpdate,
  //enabled: true,
  description: 'Tests that GameStatePanel updates when region changes.'
});