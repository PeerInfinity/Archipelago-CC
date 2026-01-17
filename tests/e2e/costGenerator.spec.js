/**
 * E2E tests for Cost Generator
 * Tests the cost generation feature on Adventure, seed 1
 */

import { test, expect } from '@playwright/test';

test.describe('Cost Generator', () => {
  test.setTimeout(120000); // 2 minute timeout for cost generation

  test('should generate costs for Adventure seed 1', async ({ page }) => {
    // Load the app with Adventure rules (server runs from repo root)
    const rulesPath = 'presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';
    await page.goto(`http://localhost:8000/frontend/?rules=${rulesPath}`, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for app to initialize and modules to load
    await page.waitForFunction(
      () => window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function',
      { timeout: 30000 }
    );

    // Wait a bit more for all modules to initialize
    await page.waitForTimeout(3000);

    // Check that cost generator is available
    const hasCostGenerator = await page.evaluate(() => {
      return typeof window.costGenerator !== 'undefined' && window.costGenerator !== null;
    });
    expect(hasCostGenerator).toBe(true);
    console.log('Cost generator is available');

    // Check that cost data manager is available
    const hasCostDataManager = await page.evaluate(() => {
      return typeof window.costDataManager !== 'undefined' && window.costDataManager !== null;
    });
    expect(hasCostDataManager).toBe(true);
    console.log('Cost data manager is available');

    // Wait for rules to be loaded by checking stateManagerProxy
    await page.waitForFunction(
      () => {
        const proxy = window.stateManagerProxy;
        if (!proxy || typeof proxy.getStaticData !== 'function') return false;
        const staticData = proxy.getStaticData();
        return staticData && staticData.regions && staticData.regions.size > 0;
      },
      { timeout: 30000 }
    );
    console.log('Rules loaded');

    // Load sphere log manually using the public function
    const sphereLogPath = `presets/adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl`;
    console.log(`Loading sphere log from: ${sphereLogPath}`);

    const loadResult = await page.evaluate(async (logPath) => {
      const loadSphereLog = window.centralRegistry?.getPublicFunction('sphereState', 'loadSphereLog');
      if (!loadSphereLog) {
        return { success: false, error: 'loadSphereLog function not found' };
      }
      try {
        const result = await loadSphereLog(logPath);
        return { success: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, sphereLogPath);

    console.log('Sphere log load result:', loadResult);

    // Wait a moment for the sphere log to be integrated into the snapshot
    await page.waitForTimeout(1000);

    console.log('Sphere log loading complete');

    // Get sphere log info - check both snapshot and sphereState module
    const sphereLogInfo = await page.evaluate(() => {
      // First try snapshot
      const proxy = window.stateManagerProxy;
      const snapshot = proxy.getLatestStateSnapshot();
      let sphereLog = snapshot?.sphereLog;

      // If not in snapshot, try sphereState module
      if (!sphereLog || !Array.isArray(sphereLog) || sphereLog.length === 0) {
        const getSphereData = window.centralRegistry?.getPublicFunction?.('sphereState', 'getSphereData');
        if (getSphereData) {
          const sphereData = getSphereData();
          if (sphereData && Array.isArray(sphereData) && sphereData.length > 0) {
            return { available: true, length: sphereData.length, source: 'sphereState' };
          }
        }
      }

      if (sphereLog && Array.isArray(sphereLog) && sphereLog.length > 0) {
        return { available: true, length: sphereLog.length, source: 'snapshot' };
      }

      return { available: false, length: 0 };
    });

    console.log('Sphere log info:', sphereLogInfo);
    expect(sphereLogInfo.available).toBe(true);
    expect(sphereLogInfo.length).toBeGreaterThan(0);

    // Run cost generation
    console.log('Starting cost generation...');
    const costs = await page.evaluate(async () => {
      try {
        const result = await window.generateCosts();
        if (!result) {
          return { error: 'generateCosts returned null' };
        }
        return {
          success: true,
          regionCount: Object.keys(result.regions || {}).length,
          locationCount: Object.keys(result.locations || {}).length,
          regions: result.regions,
          locations: result.locations,
          version: result.version,
          generatedAt: result.generatedAt,
        };
      } catch (error) {
        return { error: error.message, stack: error.stack };
      }
    });

    console.log('Cost generation result:', JSON.stringify(costs, null, 2));

    // Verify result
    if (costs.error) {
      console.error('Cost generation failed:', costs.error);
      if (costs.stack) {
        console.error('Stack:', costs.stack);
      }
    }

    expect(costs.success).toBe(true);
    expect(costs.regionCount).toBeGreaterThan(0);
    expect(costs.locationCount).toBeGreaterThan(0);

    console.log(`Generated costs for ${costs.regionCount} regions and ${costs.locationCount} locations`);

    // Verify Menu region has 0 cost
    expect(costs.regions.Menu).toBeDefined();
    expect(costs.regions.Menu.moveCost).toBe(0);

    // Log some sample costs
    console.log('\nSample region costs:');
    const regionNames = Object.keys(costs.regions).slice(0, 5);
    for (const name of regionNames) {
      console.log(`  ${name}: ${costs.regions[name].moveCost}`);
    }

    console.log('\nSample location costs:');
    const locationNames = Object.keys(costs.locations).slice(0, 5);
    for (const name of locationNames) {
      console.log(`  ${name}: ${costs.locations[name]}`);
    }

    // Check cost data manager has the data
    const managerStatus = await page.evaluate(() => {
      return window.costDataManager.getStatus();
    });
    console.log('\nCost data manager status:', managerStatus);
    expect(managerStatus.isLoaded).toBe(true);
    expect(managerStatus.regionCount).toBe(costs.regionCount);
    expect(managerStatus.locationCount).toBe(costs.locationCount);
  });
});
