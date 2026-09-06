import { test, expect } from '@playwright/test';
// ⚖ 2026-09-06 — the base-cost table is the exported default, never a typed
// number. This spec is NOT selected by `npm test` (run-tests.js hardcodes
// app.spec.js) but a bare `npx playwright test` collects it, because
// playwright.config.js sets testDir: './test_json/e2e'. It was STALE on both
// counts until L2: it asserted key names the analyzer has never had
// (`explore`/`checkLocation`/`moveToRegion` vs
// `customAction`/`locationCheck`/`regionMove`) against values 50/100/10.
import {
  DEFAULT_REGION_COST,
  DEFAULT_LOCATION_COST,
} from '../../frontend/modules/shared/procgen/loopCostGenerator.js';

test.describe('LoopStats Module Tests', () => {
  test('loopStats module loads correctly and exposes public API', async ({ page }) => {
    // Navigate to the app and wait for network idle
    await page.goto('http://localhost:8000/frontend/', { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for centralRegistry to be available (app initialized)
    await page.waitForFunction(() => {
      return window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function';
    }, { timeout: 30000 });

    // Check if loopStats module is registered
    const moduleInfo = await page.evaluate(() => {
      if (window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function') {
        // Try to get the loopStats public functions
        const getAnalysis = window.centralRegistry.getPublicFunction('loopStats', 'getAnalysis');
        const getQueueAnalyzer = window.centralRegistry.getPublicFunction('loopStats', 'getQueueAnalyzer');
        const analyzeQueue = window.centralRegistry.getPublicFunction('loopStats', 'analyzeQueue');
        const getPreviousAnalysis = window.centralRegistry.getPublicFunction('loopStats', 'getPreviousAnalysis');
        const getSerializableState = window.centralRegistry.getPublicFunction('loopStats', 'getSerializableState');

        return {
          hasGetAnalysis: typeof getAnalysis === 'function',
          hasGetQueueAnalyzer: typeof getQueueAnalyzer === 'function',
          hasAnalyzeQueue: typeof analyzeQueue === 'function',
          hasGetPreviousAnalysis: typeof getPreviousAnalysis === 'function',
          hasGetSerializableState: typeof getSerializableState === 'function',
        };
      }
      return { error: 'centralRegistry not found' };
    });

    console.log('Module info:', moduleInfo);

    // Verify the public functions are available
    expect(moduleInfo.hasGetAnalysis).toBe(true);
    expect(moduleInfo.hasGetQueueAnalyzer).toBe(true);
    expect(moduleInfo.hasAnalyzeQueue).toBe(true);
    expect(moduleInfo.hasGetPreviousAnalysis).toBe(true);
    expect(moduleInfo.hasGetSerializableState).toBe(true);
  });

  test('queueAnalyzer has correct base costs', async ({ page }) => {
    await page.goto('http://localhost:8000/frontend/', { waitUntil: 'networkidle', timeout: 60000 });

    await page.waitForFunction(() => {
      return window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function';
    }, { timeout: 30000 });

    const analyzerState = await page.evaluate(() => {
      const getQueueAnalyzer = window.centralRegistry.getPublicFunction('loopStats', 'getQueueAnalyzer');
      if (getQueueAnalyzer) {
        const analyzer = getQueueAnalyzer();
        return {
          hasAnalyze: typeof analyzer.analyze === 'function',
          baseCosts: analyzer.baseCosts,
        };
      }
      return null;
    });

    console.log('Analyzer state:', analyzerState);

    expect(analyzerState).not.toBeNull();
    expect(analyzerState.hasAnalyze).toBe(true);
    expect(analyzerState.baseCosts.customAction).toBe(DEFAULT_REGION_COST);
    expect(analyzerState.baseCosts.locationCheck).toBe(DEFAULT_LOCATION_COST);
    expect(analyzerState.baseCosts.regionMove).toBe(DEFAULT_REGION_COST);
  });

  test('analyzeQueue returns valid analysis for mock queue', async ({ page }) => {
    await page.goto('http://localhost:8000/frontend/', { waitUntil: 'networkidle', timeout: 60000 });

    await page.waitForFunction(() => {
      return window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function';
    }, { timeout: 30000 });

    const analysis = await page.evaluate(() => {
      const getQueueAnalyzer = window.centralRegistry.getPublicFunction('loopStats', 'getQueueAnalyzer');
      const getLoopState = window.centralRegistry.getPublicFunction('loops', 'getLoopState');

      if (getQueueAnalyzer && getLoopState) {
        const analyzer = getQueueAnalyzer();
        const loopState = getLoopState();

        // Create a mock queue for testing
        const mockQueue = [
          { type: 'moveToRegion', regionName: 'Menu', exitUsed: null },
          { type: 'moveToRegion', regionName: 'Forest', exitUsed: 'Door', pathIndex: 1 },
          { type: 'explore', regionName: 'Forest', pathIndex: 2 },
        ];

        // Run analysis
        const result = analyzer.analyze(mockQueue, loopState);

        return {
          entryCount: result.entries.length,
          totalCost: result.totalCost,
          finalMana: result.finalMana,
          startingMana: result.startingMana,
          hasTimestamp: typeof result.timestamp === 'number',
        };
      }
      return null;
    });

    console.log('Analysis result:', analysis);

    expect(analysis).not.toBeNull();
    // Should skip Menu entry, leaving 2 actions
    expect(analysis.entryCount).toBe(2);
    // Move (10) + Explore (50) = 60
    expect(analysis.totalCost).toBe(60);
    expect(analysis.hasTimestamp).toBe(true);
  });
});
