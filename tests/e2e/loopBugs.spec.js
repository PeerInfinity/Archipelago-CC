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

    // Test the fix: when all actions are completed and user unpauses, mana should refill
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

      // Simulate a queue with completed actions
      // First, consume some mana (simulating actions being processed)
      loopState.currentMana = 30;

      // Simulate queue being at the end (all actions completed)
      const queue = loopState.getActionQueue();
      loopState.currentActionIndex = queue.length; // Past the end = queue finished

      // Mark all actions as completed
      if (loopState.actionQueueManager) {
        queue.forEach((action, index) => {
          loopState.actionQueueManager.markCompleted(action.pathIndex);
          loopState.actionQueueManager.setProgress(action.pathIndex, 100);
        });
      }

      const beforeUnpauseMana = { current: loopState.currentMana, max: loopState.maxMana };

      // Pause first (simulating queue finished state)
      loopState.setPaused(true);

      // Now unpause - this should trigger a reset and refill mana
      loopState.setPaused(false);

      const afterUnpauseMana = { current: loopState.currentMana, max: loopState.maxMana };

      return {
        initialMana,
        beforeUnpauseMana,
        afterUnpauseMana,
        manaRefilled: afterUnpauseMana.current === afterUnpauseMana.max,
        queueLength: queue.length,
      };
    });

    console.log('Unpause mana test result:', result);

    // The fix should ensure mana is refilled when unpausing after queue completion
    if (result.manaRefilled) {
      console.log('SUCCESS: Mana was refilled on unpause after queue completion');
    } else {
      console.log('ISSUE: Mana was NOT refilled on unpause after queue completion');
    }

    // After the fix, this should pass
    expect(result.manaRefilled).toBe(true);
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
