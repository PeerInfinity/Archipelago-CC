// mazeGame.js - MetaGame Configuration for Maze Game Challenges

import discoveryStateSingleton from '../../discovery/singleton.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { resolveIframeUrl } from '../../../app/config/knownIframePages.js';

export async function initializeMetaGame({ eventBus, dispatcher, logger, progressBarAPI, initializationApi }) {
  logger.info('mazeGame', 'Initializing maze game metagame configuration...');

  try {
    // Register publishers for maze game events
    eventBus.registerPublisher('ui:activatePanel');
    eventBus.registerPublisher('amazingIdle:mazeCompleted');
    eventBus.registerPublisher('iframe:loadUrl');

    // Load the maze game into the iframe
    const mazeUrl = resolveIframeUrl('mazegame');
    if (mazeUrl) {
      eventBus.publish('iframe:loadUrl', { url: mazeUrl });
      logger.info('mazeGame', `Loading maze game iframe: ${mazeUrl}`);
    } else {
      logger.warn('mazeGame', 'Could not resolve maze game iframe URL');
    }

    // Enable discovery mode (same settings as progressBarTest)
    await settingsManager.updateSetting('moduleSettings.discovery.enableDiscoveryMode', true);
    await settingsManager.updateSetting('moduleSettings.discovery.regionDiscoveryTrigger', 'onEnter');
    await settingsManager.updateSetting('moduleSettings.discovery.autoDiscoverLocations', true);
    await settingsManager.updateSetting('moduleSettings.discovery.autoDiscoverExits', true);
    logger.info('mazeGame', 'Discovery mode enabled with onEnter trigger, auto-discover locations and exits');

    logger.info('mazeGame', 'Maze game metagame configuration initialized successfully');

  } catch (error) {
    logger.error('mazeGame', 'Failed to initialize maze game configuration:', error);
    throw error;
  }
}

export const metaGameConfiguration = {
  eventDispatcher: {
    'user:regionMove': {
      condition: (eventData) => {
        const target = eventData.targetRegion || eventData.region;
        return target && !discoveryStateSingleton.isRegionDiscovered(target);
      },
      actions: [
        {
          type: 'startMazeChallenge',
          challengeId: 'regionMoveMaze',
          config: {
            biome: 1,
            preserveScore: true,
            completionActions: [
              { type: 'forwardEvent', eventName: 'user:regionMove', direction: 'up' }
            ]
          }
        }
      ],
      stopPropagation: true
    },

    'user:locationCheck': {
      actions: [
        {
          type: 'startMazeChallenge',
          challengeId: 'locationCheckMaze',
          config: {
            biome: 2,
            preserveScore: true,
            completionActions: [
              { type: 'forwardEvent', eventName: 'user:locationCheck', direction: 'up' }
            ]
          }
        }
      ],
      stopPropagation: true
    }
  },

  eventBus: {
    // No eventBus configuration needed
  }
};
