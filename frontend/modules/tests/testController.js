// frontend/modules/tests/testController.js
import { stateManagerProxySingleton } from '../stateManager/index.js';
import { createStateSnapshotInterface } from '../stateManager/stateManagerProxy.js';

// --- TestController Class ---
export class TestController {
  constructor(testId, callbacks, eventBus) {
    if (
      !callbacks ||
      typeof callbacks.log !== 'function' ||
      typeof callbacks.reportCondition !== 'function' ||
      typeof callbacks.setTestStatus !== 'function' ||
      typeof callbacks.completeTest !== 'function'
    ) {
      throw new Error(
        'TestController: Missing required callbacks (log, reportCondition, setTestStatus, completeTest)'
      );
    }

    this.testId = testId;
    this.callbacks = callbacks; // { log, reportCondition, setTestStatus, completeTest }
    this.eventBus = eventBus; // Injected eventBus instance
    this.stateManager = stateManagerProxySingleton; // Direct import
  }

  log(message, type = 'info') {
    this.callbacks.log(this.testId, message, type);
  }

  reportCondition(description, passed) {
    this.log(`Condition: "${description}" - ${passed ? 'PASSED' : 'FAILED'}`);
    this.callbacks.reportCondition(
      this.testId,
      description,
      passed ? 'passed' : 'failed'
    );
  }

  async performAction(actionDetails) {
    const actionValue =
      actionDetails.payload ||
      actionDetails.itemName ||
      actionDetails.locationName ||
      actionDetails.selector;
    let detailsString =
      actionValue !== undefined && actionValue !== null
        ? String(actionValue)
        : '(no details)';
    if (typeof actionValue === 'object' && actionValue !== null) {
      try {
        detailsString = JSON.stringify(actionValue);
      } catch (e) {
        /* ignore */
      }
    }
    this.log(
      `Performing action: ${actionDetails.type}. Details: ${detailsString}`,
      'info'
    );

    if (
      actionDetails.type !== 'DISPATCH_EVENT' &&
      actionDetails.type !== 'SIMULATE_CLICK' &&
      actionDetails.type !== 'LOAD_RULES_DATA' &&
      actionDetails.type !== 'GET_SETTING' &&
      actionDetails.type !== 'UPDATE_SETTING' &&
      actionDetails.type !== 'SIMULATE_SERVER_MESSAGE'
    ) {
      if (!this.stateManager) {
        const msg = 'StateManager (Proxy) not available for action.';
        this.log(msg, 'error');
        throw new Error(msg);
      }
      try {
        await this.stateManager.ensureReady();
      } catch (e) {
        const msg = `StateManager (Proxy) not ready for action: ${e.message}`;
        this.log(msg, 'error');
        throw new Error(msg);
      }
    }

    switch (actionDetails.type) {
      case 'DISPATCH_EVENT':
        if (this.eventBus) {
          this.eventBus.publish(actionDetails.eventName, actionDetails.payload);
        } else {
          this.log(
            'Error: eventBus not available for DISPATCH_EVENT.',
            'error'
          );
        }
        return;

      case 'LOAD_RULES_DATA':
        if (
          this.stateManager &&
          typeof this.stateManager.loadRules === 'function'
        ) {
          this.log('Calling StateManager.loadRules...');
          try {
            const playerInfo = {
              playerId: actionDetails.playerId || '1',
              playerName:
                actionDetails.playerName ||
                `TestPlayer${actionDetails.playerId || '1'}`,
            };
            await this.stateManager.loadRules(
              actionDetails.payload,
              playerInfo
            );
            this.log('StateManager.loadRules command sent.');
          } catch (error) {
            this.log(
              `Error calling StateManager.loadRules: ${error.message}`,
              'error'
            );
            throw error;
          }
        } else {
          const errMsg =
            'StateManager proxy or its loadRules method not available.';
          this.log(errMsg, 'error');
          throw new Error(errMsg);
        }
        return;

      case 'ADD_ITEM_TO_INVENTORY':
        if (this.stateManager && actionDetails.itemName) {
          await this.stateManager.addItemToInventory(actionDetails.itemName);
          this.log(
            `Action ADD_ITEM_TO_INVENTORY for "${actionDetails.itemName}" sent.`
          );
        } else {
          throw new Error(
            'Missing itemName or StateManager for ADD_ITEM_TO_INVENTORY'
          );
        }
        return;

      case 'CHECK_LOCATION':
        if (this.stateManager && actionDetails.locationName) {
          await this.stateManager.checkLocation(actionDetails.locationName);
          this.log(
            `Action CHECK_LOCATION for "${actionDetails.locationName}" sent.`
          );
        } else {
          throw new Error(
            'Missing locationName or StateManager for CHECK_LOCATION'
          );
        }
        return;

      case 'GET_INVENTORY_ITEM_COUNT': {
        const snapshot = this.stateManager.getSnapshot();
        if (snapshot && snapshot.inventory && actionDetails.itemName) {
          return snapshot.inventory[actionDetails.itemName] || 0;
        }
        this.log(
          'Warning: Could not get item count, snapshot or inventory missing.',
          'warn'
        );
        return 0;
      }

      case 'IS_LOCATION_ACCESSIBLE': {
        const snapshot = this.stateManager.getSnapshot();
        const staticData = this.stateManager.getStaticData();
        // const gameId = this.stateManager.getGameId(); // getGameId needs to be reliable

        if (
          snapshot &&
          staticData &&
          actionDetails.locationName /*&& gameId*/
        ) {
          const snapshotInterface = createStateSnapshotInterface(
            snapshot,
            staticData /*, gameId*/
          );
          let locData = staticData.locations[actionDetails.locationName];
          if (!locData && staticData.regions) {
            for (const regionKey in staticData.regions) {
              const region = staticData.regions[regionKey];
              const foundLoc = region.locations?.find(
                (l) => l.name === actionDetails.locationName
              );
              if (foundLoc) {
                locData = {
                  ...foundLoc,
                  parent_region: region.name || regionKey,
                };
                break;
              }
            }
          }

          if (!locData) {
            this.log(
              `Location data for "${actionDetails.locationName}" not found in staticData or its regions.`,
              'warn'
            );
            return false;
          }
          const regionToEvaluate = locData.parent_region || locData.region;
          if (!regionToEvaluate) {
            this.log(
              `Location "${actionDetails.locationName}" has no parent_region or region defined.`,
              'warn'
            );
            return false;
          }
          const regionReachable =
            snapshotInterface.isRegionReachable(regionToEvaluate);
          if (!regionReachable) {
            this.log(
              `Region '${regionToEvaluate}' for location '${actionDetails.locationName}' is NOT reachable.`,
              'warn'
            );
            return false;
          }
          return snapshotInterface.evaluateRule(locData.access_rule);
        }
        this.log(
          'Warning: Could not check location accessibility, context missing.',
          'warn'
        );
        return false;
      }

      case 'IS_REGION_REACHABLE': {
        const snapshot = this.stateManager.getSnapshot();
        if (snapshot && snapshot.reachability && actionDetails.regionName) {
          const status = snapshot.reachability[actionDetails.regionName];
          return (
            status === 'reachable' || status === 'checked' || status === true
          );
        }
        this.log(
          'Warning: Could not check region reachability, context missing.',
          'warn'
        );
        return false;
      }

      case 'AWAIT_WORKER_PING':
        if (
          this.stateManager &&
          typeof this.stateManager.pingWorker === 'function'
        ) {
          this.log(`Pinging worker with payload: ${actionDetails.payload}`);
          try {
            const pongPayload = await this.stateManager.pingWorker(
              actionDetails.payload,
              2000
            );
            this.log(`Received pong from worker with payload: ${pongPayload}`);
            return pongPayload;
          } catch (error) {
            this.log(`Error during worker ping: ${error.message}`, 'error');
            throw error;
          }
        } else {
          const errMsg =
            'StateManager proxy or pingWorker method not available.';
          this.log(errMsg, 'error');
          throw new Error(errMsg);
        }
      // break; // Unreachable code after throw/return

      case 'SIMULATE_CLICK':
        if (actionDetails.selector) {
          const element = document.querySelector(actionDetails.selector);
          if (element) {
            element.click();
            this.log(`Clicked element: ${actionDetails.selector}`);
          } else {
            this.log(
              `Element not found for click: ${actionDetails.selector}`,
              'error'
            );
            throw new Error(
              `Element not found for SIMULATE_CLICK: ${actionDetails.selector}`
            );
          }
        } else {
          throw new Error('Missing selector for SIMULATE_CLICK');
        }
        return; // UI interaction is fire-and-forget

      case 'GET_SETTING':
        if (
          actionDetails.settingKey &&
          typeof actionDetails.settingKey === 'string'
        ) {
          const settingsManager = (
            await import('../../app/core/settingsManager.js')
          ).default;
          if (!settingsManager)
            throw new Error('settingsManager not found for GET_SETTING');
          return await settingsManager.getSetting(
            actionDetails.settingKey,
            actionDetails.defaultValue
          );
        }
        throw new Error('Missing settingKey for GET_SETTING');

      case 'UPDATE_SETTING':
        if (
          actionDetails.settingKey &&
          typeof actionDetails.settingKey === 'string' &&
          actionDetails.value !== undefined
        ) {
          const settingsManager = (
            await import('../../app/core/settingsManager.js')
          ).default;
          if (!settingsManager)
            throw new Error('settingsManager not found for UPDATE_SETTING');
          await settingsManager.updateSetting(
            actionDetails.settingKey,
            actionDetails.value
          );
          return; // Relies on event for sync
        }
        throw new Error('Missing settingKey or value for UPDATE_SETTING');

      case 'SIMULATE_SERVER_MESSAGE':
        if (
          actionDetails.commandObject &&
          typeof actionDetails.commandObject === 'object'
        ) {
          const messageHandler = (
            await import('../client/core/messageHandler.js')
          ).default;
          if (!messageHandler)
            throw new Error(
              'MessageHandler not found for SIMULATE_SERVER_MESSAGE'
            );
          messageHandler.processMessage(actionDetails.commandObject);
          return; // Relies on events/pings for sync
        }
        throw new Error('Missing commandObject for SIMULATE_SERVER_MESSAGE');

      case 'IS_LOCATION_CHECKED': {
        const snapshot = this.stateManager.getSnapshot();
        if (snapshot && snapshot.flags && actionDetails.locationName) {
          return snapshot.flags.includes(actionDetails.locationName);
        }
        this.log(
          'Warning: Could not determine if location is checked, snapshot or flags missing for IS_LOCATION_CHECKED.',
          'warn'
        );
        return false; // Or undefined
      }

      default:
        this.log(`Unknown action type: ${actionDetails.type}`, 'warn');
        return Promise.resolve();
    }
  }

  waitForEvent(eventName, timeoutMilliseconds = 5000) {
    this.log(
      `Waiting for event: ${eventName} (timeout: ${timeoutMilliseconds}ms)`
    );
    this.callbacks.setTestStatus(this.testId, 'waiting_for_event', eventName);
    return new Promise((resolve, reject) => {
      if (!this.eventBus) {
        const msg = 'eventBus is not available in TestController';
        this.log(msg, 'error');
        reject(new Error(msg));
        return;
      }
      let timeoutId;
      const handler = (data) => {
        clearTimeout(timeoutId);
        this.eventBus.unsubscribe(eventName, handler); // Make sure to use this.eventBus
        this.log(`Event received: ${eventName}`);
        this.log(`Event data: ${JSON.stringify(data)}`, 'debug');
        this.callbacks.setTestStatus(this.testId, 'running');
        resolve(data);
      };
      timeoutId = setTimeout(() => {
        this.eventBus.unsubscribe(eventName, handler);
        const msg = `Timeout waiting for event ${eventName}`;
        this.log(msg, 'error');
        this.callbacks.setTestStatus(this.testId, 'failed'); // Update status via callback
        reject(new Error(msg));
      }, timeoutMilliseconds);
      this.eventBus.subscribe(eventName, handler);
    });
  }

  async loadConfiguration(/*filePath, type*/) {
    // This method might be better placed in the orchestrator (testLogic.js)
    // if it needs appInitializationApiInstance directly.
    // For now, assuming it's complex and might be refactored later or removed
    // if test setup data is loaded differently.
    this.log(
      'loadConfiguration is a placeholder in this refactor and should be re-evaluated.',
      'warn'
    );
    throw new Error(
      'loadConfiguration not fully implemented in TestController post-refactor.'
    );
  }

  async completeTest(overallPassStatus) {
    this.log(
      `Test completion signal: ${overallPassStatus ? 'PASSED' : 'FAILED'}`
    );
    // The status update and event emission will be handled by the callback
    this.callbacks.completeTest(this.testId, overallPassStatus);
  }
}
