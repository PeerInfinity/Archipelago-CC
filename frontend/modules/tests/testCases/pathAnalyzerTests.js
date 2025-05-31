// frontend/modules/tests/testCases/pathAnalyzerTests.js

import { registerTest } from '../testRegistry.js';

export async function testPathAnalyzerPanel(testController) {
  testController.log('Starting Path Analyzer Panel test...');
  testController.reportCondition('Test started', true);

  try {
    // Step 1: Get state manager and verify it's available
    testController.log('Step 1: Verifying state manager availability...');
    const sm = testController.stateManager;
    if (!sm) {
      throw new Error('State manager not available');
    }
    testController.reportCondition('State manager available', true);

    // Step 2: Set up test state with items to make some regions accessible
    testController.log('Step 2: Setting up test state with Moon Pearl...');
    await sm.applyTestInventoryAndEvaluate('Moon Pearl', [], []);
    testController.reportCondition('Test inventory applied', true);

    // Step 3: Wait for state processing
    testController.log('Step 3: Waiting for state processing...');
    await new Promise((resolve) => setTimeout(resolve, 500));
    testController.reportCondition('State processing wait completed', true);

    // Step 4: Verify snapshot and static data
    testController.log('Step 4: Verifying snapshot and static data...');
    const snapshot = sm.getSnapshot();
    const staticData = sm.getStaticData();

    if (!snapshot || !staticData || !staticData.regions) {
      testController.reportCondition('Data validation', false);
      testController.log('✗ Missing snapshot or static data');
      return false;
    }
    testController.reportCondition('Data validation', true);

    // Step 5: Check for PathAnalyzer Panel in Golden Layout
    testController.log('Step 5: Looking for PathAnalyzer Panel in UI...');
    const panelManager = window.panelManager;
    if (!panelManager) {
      testController.reportCondition('Panel manager check', false);
      testController.log('✗ Panel manager not available');
      return false;
    }
    testController.reportCondition('Panel manager check', true);

    // Step 6: Try to create PathAnalyzer Panel UI directly
    testController.log('Step 6: Testing PathAnalyzer Panel UI creation...');
    const { PathAnalyzerPanelUI } = await import(
      '../../pathAnalyzerPanel/pathAnalyzerPanelUI.js'
    );

    // Create mock container
    const mockContainer = {
      on: () => {}, // Mock Golden Layout container
      getElement: () => document.createElement('div'),
    };

    const panelUI = new PathAnalyzerPanelUI(
      mockContainer,
      {},
      'pathAnalyzerPanel'
    );
    testController.reportCondition('PathAnalyzer panel UI created', true);

    // Step 7: Test panel UI components
    testController.log('Step 7: Testing panel UI components...');
    const rootElement = panelUI.getRootElement();

    if (!rootElement) {
      testController.reportCondition('Panel root element check', false);
      testController.log('✗ Panel root element not created');
      return false;
    }

    // Check for key UI elements
    const regionInput = rootElement.querySelector('input[type="text"]');
    const analyzeButton = rootElement.querySelector('button');
    const resultsContainer = rootElement.querySelector(
      '.path-analysis-results'
    );

    if (!regionInput || !analyzeButton || !resultsContainer) {
      testController.reportCondition('Panel UI elements check', false);
      testController.log('✗ Required UI elements not found');
      testController.log('Found input:', !!regionInput);
      testController.log('Found button:', !!analyzeButton);
      testController.log('Found results:', !!resultsContainer);
      return false;
    }
    testController.reportCondition('Panel UI elements check', true);

    // Step 8: Test analysis functionality
    testController.log('Step 8: Testing analysis functionality...');
    const testRegion = 'Dark World';

    // Set region input value
    regionInput.value = testRegion;

    // Clear any existing analysis results
    localStorage.removeItem(`__pathAnalysis_${testRegion}__`);

    // Trigger analysis by clicking button
    analyzeButton.click();

    // Wait for analysis to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check for analysis results
    const analysisResults = localStorage.getItem(
      `__pathAnalysis_${testRegion}__`
    );
    if (!analysisResults) {
      testController.reportCondition('Panel analysis execution', false);
      testController.log('✗ No analysis results stored after panel test');
      return false;
    }
    testController.reportCondition('Panel analysis execution', true);

    // Step 9: Validate analysis results
    testController.log('Step 9: Validating analysis results...');
    const results = JSON.parse(analysisResults);

    const hasValidStructure =
      typeof results.totalPaths === 'number' &&
      typeof results.viablePaths === 'number' &&
      typeof results.isReachable === 'boolean' &&
      results.regionName === testRegion;

    if (!hasValidStructure) {
      testController.reportCondition(
        'Panel analysis results validation',
        false
      );
      testController.log('✗ Analysis results missing expected properties');
      testController.log('Results structure:', Object.keys(results));
      return false;
    }
    testController.reportCondition('Panel analysis results validation', true);

    // Step 10: Test settings functionality
    testController.log('Step 10: Testing settings functionality...');
    const pathAnalyzer = panelUI.pathAnalyzer;

    if (!pathAnalyzer) {
      testController.reportCondition('PathAnalyzer instance check', false);
      testController.log('✗ PathAnalyzer instance not found in panel');
      return false;
    }

    // Test settings update
    const originalSettings = pathAnalyzer.getSettings();
    const newSettings = { ...originalSettings, maxPaths: 50 };
    pathAnalyzer.updateSettings(newSettings);

    const updatedSettings = pathAnalyzer.getSettings();
    if (updatedSettings.maxPaths !== 50) {
      testController.reportCondition('Settings update test', false);
      testController.log('✗ Settings update failed');
      return false;
    }
    testController.reportCondition('Settings update test', true);

    // Step 11: Clean up
    testController.log('Step 11: Cleaning up resources...');
    panelUI.onUnmount();
    testController.reportCondition('Resource cleanup completed', true);

    // Final success
    testController.log('✓ Path Analyzer Panel test completed successfully');
    testController.reportCondition('Test completed successfully', true);
    return true;
  } catch (error) {
    testController.reportCondition('Test execution', false);
    testController.log(`✗ Path Analyzer Panel test failed: ${error.message}`);
    testController.log('Error stack:', error.stack);
    return false;
  }
}

export async function debugPathAnalyzerTest(testController) {
  testController.log('Starting Path Analyzer debug test...');
  testController.reportCondition('Test started', true);

  try {
    // Step 1: Get state manager
    testController.log('Step 1: Getting state manager...');
    const sm = testController.stateManager;
    if (!sm) {
      throw new Error('State manager not available');
    }
    testController.reportCondition('State manager available', true);

    // Step 2: Set up simple test state
    testController.log('Step 2: Setting up simple test state...');
    await sm.applyTestInventoryAndEvaluate('Moon Pearl', [], []);
    testController.reportCondition('Test inventory applied', true);

    // Step 3: Check if target region exists
    testController.log('Step 3: Getting static data...');
    const staticData = sm.getStaticData();
    testController.log('Step 3a: Static data retrieved');

    if (!staticData || !staticData.regions) {
      testController.reportCondition('Static data check', false);
      testController.log('✗ No static data or regions available');
      return false;
    }
    testController.log('Step 3b: Static data validation passed');

    // Use a simple region that should definitely exist
    const testRegion = 'Light World';
    const regionExists = staticData.regions[testRegion];
    testController.log(
      `Step 3c: Region "${testRegion}" exists: ${!!regionExists}`
    );

    if (!regionExists) {
      testController.log('Available regions (first 10):');
      const regionNames = Object.keys(staticData.regions).slice(0, 10);
      regionNames.forEach((name) => testController.log(`  - ${name}`));
      testController.reportCondition('Region validation', false);
      return false;
    }
    testController.reportCondition('Target region exists', true);

    // Step 4: Import PathAnalyzerLogic directly
    testController.log('Step 4: About to import PathAnalyzerLogic...');
    const { PathAnalyzerLogic } = await import(
      '../../pathAnalyzer/pathAnalyzerLogic.js'
    );
    testController.log('Step 4a: PathAnalyzerLogic imported successfully');

    testController.log(
      'Step 4b: About to create PathAnalyzerLogic instance...'
    );
    const logic = new PathAnalyzerLogic();
    testController.log('Step 4c: PathAnalyzerLogic instance created');
    testController.reportCondition('PathAnalyzerLogic imported', true);

    // Step 5: Get snapshot
    testController.log('Step 5: Getting snapshot...');
    const snapshot = sm.getSnapshot();
    testController.log('Step 5a: Snapshot retrieved');

    // Step 6: Test with immediate return (no actual path finding)
    testController.log(
      'Step 6: Testing with null parameters to check method entry...'
    );
    try {
      const nullResult = logic.findPathsToRegion(testRegion, 1, null, null);
      testController.log(
        `Step 6a: Null test completed, result length: ${nullResult.length}`
      );
    } catch (error) {
      testController.log(`Step 6a: Null test error: ${error.message}`);
    }

    // Step 7: Test with real parameters but very small limits
    testController.log('Step 7: Testing with real parameters...');
    testController.log(
      'Step 7a: About to call findPathsToRegion with real data...'
    );

    const startTime = Date.now();
    const paths = logic.findPathsToRegion(testRegion, 1, snapshot, staticData);
    const endTime = Date.now();

    testController.log(
      `Step 7b: findPathsToRegion completed in ${endTime - startTime}ms`
    );
    testController.log(`Step 7c: Found ${paths.length} paths`);
    testController.reportCondition(
      'Path analysis completed without hanging',
      true
    );

    // Step 8: Success
    testController.log('✓ Path Analyzer debug test completed successfully');
    testController.reportCondition('Test completed successfully', true);
    return true;
  } catch (error) {
    testController.reportCondition('Test execution', false);
    testController.log(`✗ Debug test failed: ${error.message}`);
    testController.log('Error stack:', error.stack);
    return false;
  }
}

export async function simplePathAnalyzerTest(testController) {
  testController.log('Starting Simple Path Analyzer test...');
  testController.reportCondition('Test started', true);

  try {
    // Step 1: Import PathAnalyzerLogic directly
    testController.log('Step 1: Importing PathAnalyzerLogic...');
    const { PathAnalyzerLogic } = await import(
      '../../pathAnalyzer/pathAnalyzerLogic.js'
    );
    testController.log('Step 1a: PathAnalyzerLogic imported successfully');

    // Step 2: Create instance
    testController.log('Step 2: Creating PathAnalyzerLogic instance...');
    const logic = new PathAnalyzerLogic();
    testController.log('Step 2a: PathAnalyzerLogic instance created');
    testController.reportCondition('PathAnalyzerLogic created', true);

    // Step 3: Test with null parameters (should return empty array immediately)
    testController.log('Step 3: Testing with null parameters...');
    const nullResult = logic.findPathsToRegion('Light World', 1, null, null);
    testController.log(
      `Step 3a: Null test completed, result length: ${nullResult.length}`
    );
    testController.reportCondition(
      'Null parameter test passed',
      nullResult.length === 0
    );

    // Step 4: Test with empty objects
    testController.log('Step 4: Testing with empty objects...');
    const emptyResult = logic.findPathsToRegion('Light World', 1, {}, {});
    testController.log(
      `Step 4a: Empty test completed, result length: ${emptyResult.length}`
    );
    testController.reportCondition(
      'Empty parameter test passed',
      emptyResult.length === 0
    );

    // Step 5: Success
    testController.log('✓ Simple Path Analyzer test completed successfully');
    testController.reportCondition('Test completed successfully', true);
    return true;
  } catch (error) {
    testController.reportCondition('Test execution', false);
    testController.log(`✗ Simple test failed: ${error.message}`);
    testController.log('Error stack:', error.stack);
    return false;
  }
}

// Self-register tests
registerTest({
  id: 'simple_path_analyzer',
  name: 'Simple Path Analyzer',
  description:
    'Very simple test to isolate Path Analyzer issues without state manager.',
  testFunction: simplePathAnalyzerTest,
  category: 'Path Analysis',
  enabled: false,
  order: -2, // Run first
});

registerTest({
  id: 'debug_path_analyzer',
  name: 'Debug Path Analyzer',
  description: 'Simple debug test to isolate Path Analyzer issues.',
  testFunction: debugPathAnalyzerTest,
  category: 'Path Analysis',
  enabled: false,
  order: -1,
});

registerTest({
  id: 'test_path_analyzer_panel',
  name: 'Path Analyzer Panel Test',
  description:
    'Tests the new PathAnalyzer Panel functionality with Golden Layout integration.',
  testFunction: testPathAnalyzerPanel,
  category: 'Path Analysis',
  enabled: false,
  order: 0,
});
