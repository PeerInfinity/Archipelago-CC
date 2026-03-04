// progressBarTest.js - MetaGame Configuration for Progress Bar Testing

export async function initializeMetaGame({ eventBus, dispatcher, logger, progressBarAPI, initializationApi }) {
  logger.info('progressBarTest', 'Initializing progress bar test configuration...');
  
  try {
    // Step 1: Activate the Progress Bar panel (layout is already configured)
    eventBus.registerPublisher('ui:activatePanel');
    eventBus.publish('ui:activatePanel', { panelId: 'progressBarPanel' });

    // Step 2: Hide the default UI content (header, buttons, info text)
    eventBus.registerPublisher('progressBarPanel:hideUIContent');
    eventBus.publish('progressBarPanel:hideUIContent', {});

    // Progress bars are created on-demand by the createProgressBar actions
    // in metaGameConfiguration when user:regionMove / user:locationCheck fire.

    logger.info('progressBarTest', 'Progress bar test configuration initialized successfully');
    
  } catch (error) {
    logger.error('progressBarTest', 'Failed to initialize progress bar test configuration:', error);
    throw error;
  }
}

// Configuration object that defines the event handling behavior
export const metaGameConfiguration = {
  eventDispatcher: {
    'user:regionMove': {
      actions: [
        {
          type: 'hideProgressBar',
          progressBarId: 'locationCheckBar'
        },
        {
          type: 'createProgressBar',
          progressBarId: 'regionMoveBar',
          config: {
            mode: 'timer',
            duration: 2000,
            text: 'Moving to [region name]',
            completionActions: [
              {
                type: 'forwardEvent',
                eventName: 'user:regionMove',
                direction: 'up'
              }
            ]
          }
        }
      ],
      stopPropagation: true
    },
    
    'user:locationCheck': {
      actions: [
        {
          type: 'hideProgressBar',
          progressBarId: 'regionMoveBar'
        },
        {
          type: 'createProgressBar',
          progressBarId: 'locationCheckBar',
          config: {
            mode: 'timer',
            duration: 4000,
            text: 'Checking location [location name]',
            completionActions: [
              {
                type: 'forwardEvent',
                eventName: 'user:locationCheck',
                direction: 'up'
              }
            ]
          }
        }
      ],
      stopPropagation: true
    }
  },
  
  eventBus: {
    // No eventBus configuration needed for this test
  }
};