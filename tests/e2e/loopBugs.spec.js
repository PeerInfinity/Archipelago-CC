import { test, expect } from '@playwright/test';

test.describe('Loop Mode Bug Investigation', () => {
  test('Bug 1: Check mana initialization values', async ({ page }) => {
    // Navigate to the app and wait for network idle
    await page.goto('http://localhost:8000/frontend/', { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for centralRegistry to be available
    await page.waitForFunction(() => {
      return window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function';
    }, { timeout: 30000 });

    // Get loopState and check mana values
    const manaState = await page.evaluate(() => {
      const getLoopState = window.centralRegistry.getPublicFunction('loops', 'getLoopState');
      if (getLoopState) {
        const loopState = getLoopState();
        return {
          currentMana: loopState.currentMana,
          maxMana: loopState.maxMana,
          manaPerItem: loopState.manaPerItem,
        };
      }
      return null;
    });

    console.log('Mana state on initial load:', manaState);

    // Check if there's a mismatch (the bug)
    if (manaState.currentMana !== manaState.maxMana) {
      console.log(`BUG CONFIRMED: Mana mismatch - current: ${manaState.currentMana}, max: ${manaState.maxMana}`);
    } else {
      console.log('Mana initialized correctly');
    }

    // Get inventory to understand why maxMana might be different
    const inventoryInfo = await page.evaluate(() => {
      const stateManager = window.stateManager;
      if (stateManager) {
        const snapshot = stateManager.getSnapshot();
        const inventory = snapshot?.inventory || {};
        const itemCount = Object.values(inventory).reduce((sum, count) => sum + (count > 0 ? count : 0), 0);
        return {
          inventory,
          itemCount,
        };
      }
      return null;
    });

    console.log('Inventory info:', inventoryInfo);
  });

  test('Bug 5: Check unpause mana refill when queue finished', async ({ page }) => {
    await page.goto('http://localhost:8000/frontend/', { waitUntil: 'networkidle', timeout: 60000 });

    await page.waitForFunction(() => {
      return window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function';
    }, { timeout: 30000 });

    // Get loopState
    const result = await page.evaluate(async () => {
      const getLoopState = window.centralRegistry.getPublicFunction('loops', 'getLoopState');
      const getPlayerStateAPI = window.centralRegistry.getPublicFunction('loops', 'getPlayerStateAPI');

      if (!getLoopState || !getPlayerStateAPI) {
        return { error: 'Functions not available' };
      }

      const loopState = getLoopState();
      const playerStateAPI = getPlayerStateAPI();

      // Record initial state
      const initialMana = { current: loopState.currentMana, max: loopState.maxMana };

      // Consume some mana manually
      loopState.currentMana = 50;
      const afterConsumeMana = { current: loopState.currentMana, max: loopState.maxMana };

      // Pause and then unpause
      loopState.setPaused(true);
      loopState.setPaused(false);

      const afterUnpauseMana = { current: loopState.currentMana, max: loopState.maxMana };

      return {
        initialMana,
        afterConsumeMana,
        afterUnpauseMana,
        manaRefilled: afterUnpauseMana.current === afterUnpauseMana.max,
      };
    });

    console.log('Unpause mana test result:', result);
    if (!result.manaRefilled) {
      console.log('Note: Mana was NOT refilled on unpause. This may or may not be a bug depending on context.');
    }
  });

  test('Bug 8: Check mode=loops URL parameter (correct spelling)', async ({ page }) => {
    // Navigate with mode=loops parameter (plural - correct)
    await page.goto('http://localhost:8000/frontend/?mode=loops', { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for app to initialize
    await page.waitForFunction(() => {
      return window.centralRegistry && typeof window.centralRegistry.getPublicFunction === 'function';
    }, { timeout: 30000 });

    // Check if loop mode was activated
    const loopModeStatus = await page.evaluate(() => {
      const getLoopState = window.centralRegistry.getPublicFunction('loops', 'getLoopState');
      if (getLoopState) {
        const loopState = getLoopState();
        return {
          isPaused: loopState.isPaused,
          isProcessing: loopState.isProcessing,
          currentMode: window.G_currentActiveMode,
        };
      }
      return null;
    });

    console.log('Loop mode URL param test (plural):', loopModeStatus);
    console.log('Current mode:', loopModeStatus?.currentMode);

    // This should work - mode=loops (plural)
    expect(loopModeStatus?.currentMode).toBe('loops');
  });
});
