// loopBlockBuilder.js
// Builds region blocks for the loops panel following the same pattern as the Regions module
// A region block shows both the queued actions and the region details (locations/exits/entrances)

import loopState from './loopStateSingleton.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { getLoopsModuleDispatcher } from './index.js';
import { renderLogicTree } from '../commonUI/index.js';
import commonUI from '../commonUI/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { stateManagerProxySingleton } from '../stateManager/index.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('loopBlockBuilder', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[loopBlockBuilder] ${message}`, ...data);
  }
}

/**
 * LoopBlockBuilder class handles the creation of region block DOM elements for the loops panel
 * Follows the same architectural pattern as RegionBlockBuilder in the Regions module
 */
export class LoopBlockBuilder {
  constructor(loopUI) {
    this.loopUI = loopUI;
  }

  /**
   * Builds a complete region block DOM element
   * @param {string} regionName - Name of the region
   * @param {Object} regionStaticData - Static data for the region
   * @param {Array} actions - Array of actions for this region
   * @param {Object} snapshot - Current state snapshot
   * @param {Object} snapshotInterface - Snapshot interface for rule evaluation
   * @param {boolean} useColorblind - Whether to use colorblind mode
   * @param {boolean} isExpanded - Whether the region is expanded
   * @param {number} currentActionIndex - Index of the current action being processed
   * @returns {HTMLElement} The region block element
   */
  buildRegionBlock(
    regionName,
    regionStaticData,
    actions,
    snapshot,
    snapshotInterface,
    useColorblind,
    isExpanded,
    currentActionIndex
  ) {
    // Create outer container
    const regionBlock = document.createElement('div');
    regionBlock.className = 'loop-region-block';
    regionBlock.dataset.region = regionName;
    regionBlock.classList.add(isExpanded ? 'expanded' : 'collapsed');

    // Check if this is the initial start region (starting position)
    const isStartRegion = this.loopUI.playerStateAPI?.isStartRegion?.(regionName) ?? false;
    const isInitialMenu = isStartRegion &&
                         actions.length === 1 &&
                         actions[0].index === 0 &&
                         actions[0].pathEntry.type === 'regionMove' &&
                         !actions[0].pathEntry.exitUsed;

    // Build header
    const headerEl = this.buildHeader(regionName, isExpanded, isInitialMenu);
    regionBlock.appendChild(headerEl);

    // Add special action block for initial Menu
    if (isInitialMenu) {
      const actionBlock = this.buildInitialMenuBlock();
      regionBlock.appendChild(actionBlock);
    }

    // Build content (contains actions and region details)
    const contentEl = this.buildContent(
      regionName,
      regionStaticData,
      actions,
      snapshot,
      snapshotInterface,
      useColorblind,
      isExpanded,
      currentActionIndex,
      isInitialMenu
    );
    regionBlock.appendChild(contentEl);

    // Attach event listeners
    this.attachEventListeners(headerEl, regionName);

    return regionBlock;
  }

  /**
   * Builds the header element for a region block
   * @param {string} regionName - Name of the region
   * @param {boolean} isExpanded - Whether the region is expanded
   * @param {boolean} isInitialMenu - Whether this is the initial Menu
   * @returns {HTMLElement} The header element
   */
  buildHeader(regionName, isExpanded, isInitialMenu) {
    const headerEl = document.createElement('div');
    headerEl.className = 'loop-region-header';

    if (isInitialMenu) {
      // Simple header for initial Menu
      headerEl.innerHTML = `
        <span class="loop-expand-indicator" style="margin-right: 8px;">${isExpanded ? '▼' : '▶'}</span>
        <span class="loop-region-name" style="flex: 1;">Menu</span>
      `;
    } else {
      // Calculate XP data for the region
      const xpData = loopState.getRegionXP(regionName);
      const speedBonus = xpData.level * 5;

      headerEl.innerHTML = `
        <span class="loop-expand-indicator" style="margin-right: 8px;">${isExpanded ? '▼' : '▶'}</span>
        <span class="loop-region-name" style="flex: 1;">${regionName}</span>
        <span class="region-xp-level" style="margin-left: 12px;">Level ${xpData.level}</span>
        <span class="region-xp-efficiency" style="margin-left: 12px; color: #8c8;">+${speedBonus}% efficiency</span>
      `;
    }

    return headerEl;
  }

  /**
   * Builds a special action block for the initial Menu starting position
   * @returns {HTMLElement} The initial menu action block
   */
  buildInitialMenuBlock() {
    const actionBlock = document.createElement('div');
    actionBlock.className = 'loop-action-block';

    const titleEl = document.createElement('div');
    titleEl.className = 'action-title';
    titleEl.textContent = 'Starting Region: Menu';
    actionBlock.appendChild(titleEl);

    return actionBlock;
  }

  /**
   * Builds the content element for a region block
   * Renders actions (always visible), then region details when expanded
   * using configurable section ordering (entrances-exits-locations)
   */
  buildContent(
    regionName,
    regionStaticData,
    actions,
    snapshot,
    snapshotInterface,
    useColorblind,
    isExpanded,
    currentActionIndex,
    isInitialMenu
  ) {
    const contentEl = document.createElement('div');
    contentEl.className = 'loop-region-content';

    // Add actions container (always visible, even when collapsed)
    // Skip for initial Menu since we already added the special display
    if (!isInitialMenu && actions.length > 0) {
      this.addActions(contentEl, actions, currentActionIndex);
    }

    // If expanded, add region details (locations, exits, entrances, explore button)
    if (isExpanded) {
      const detailsEl = document.createElement('div');
      detailsEl.className = 'loop-region-details';

      // Compute region reachability from snapshot
      const regionReachability = snapshot?.regionReachability?.[regionName];
      const regionIsReachable = regionReachability === true ||
        regionReachability === 'reachable' ||
        regionReachability === 'checked';

      // Get full static data for entrances lookup
      const staticData = stateManagerProxySingleton.getStaticData();

      // Add explore button if in loop mode (but not for start regions, which are already fully explored)
      const isStartRegion = this.loopUI.playerStateAPI?.isStartRegion?.(regionName) ?? false;
      if (this.loopUI.isLoopModeActive && !isStartRegion) {
        this.addExploreButton(detailsEl, regionName);
      }

      // Section ordering - matches regions panel default
      const sectionOrder = 'entrances-exits-locations';
      const sections = sectionOrder.split('-');

      for (const section of sections) {
        switch (section) {
          case 'entrances':
            if (staticData) {
              this.addEntrances(
                detailsEl,
                regionName,
                staticData,
                snapshot,
                snapshotInterface,
                useColorblind
              );
            }
            break;
          case 'exits':
            if (regionStaticData?.exits && regionStaticData.exits.length > 0) {
              this.addExits(
                detailsEl,
                regionName,
                regionStaticData,
                snapshot,
                snapshotInterface,
                regionIsReachable,
                useColorblind
              );
            }
            break;
          case 'locations':
            if (regionStaticData?.locations && regionStaticData.locations.length > 0) {
              this.addLocations(
                detailsEl,
                regionName,
                regionStaticData,
                snapshot,
                snapshotInterface,
                regionIsReachable,
                useColorblind,
                staticData
              );
            }
            break;
        }
      }

      contentEl.appendChild(detailsEl);
    }

    return contentEl;
  }

  /**
   * Adds the actions container to the content element
   * @param {HTMLElement} contentEl - Content element to add to
   * @param {Array} actions - Array of actions
   * @param {number} currentActionIndex - Index of current action
   */
  addActions(contentEl, actions, currentActionIndex) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'region-actions-container';

    actions.forEach(({pathEntry, index}) => {
      const isCurrentAction = index === currentActionIndex && loopState.isProcessing;
      const actionEl = this.createActionBlockElement(pathEntry, index, isCurrentAction);
      if (actionEl) {
        actionsContainer.appendChild(actionEl);
      }
    });

    contentEl.appendChild(actionsContainer);
  }

  /**
   * Adds the explore button to the details element
   * @param {HTMLElement} detailsEl - Details element to add to
   * @param {string} regionName - Name of the region
   */
  addExploreButton(detailsEl, regionName) {
    const exploreContainer = document.createElement('div');
    exploreContainer.className = 'region-explore-container';

    const exploreBtn = document.createElement('button');
    exploreBtn.className = 'explore-btn';
    exploreBtn.textContent = 'Explore Region';
    exploreBtn.addEventListener('click', () => {
      this.queueExploreAction(regionName);
    });
    exploreContainer.appendChild(exploreBtn);

    detailsEl.appendChild(exploreContainer);
  }

  /**
   * Adds entrances list to the details element
   * Ported from RegionBlockBuilder - shows entrances TO this region from other regions
   */
  addEntrances(
    detailsEl,
    regionName,
    staticData,
    snapshot,
    snapshotInterface,
    useColorblind
  ) {
    // Find all entrances to this region
    const entrances = [];

    if (staticData?.regions) {
      for (const [sourceRegionName, sourceRegionData] of staticData.regions) {
        if (!sourceRegionData?.exits) continue;

        for (const exitDef of sourceRegionData.exits) {
          if (exitDef.connected_region === regionName) {
            // Check for bidirectional - find return exit
            let returnExit = null;
            const currentRegionData = staticData.regions.get(regionName);
            if (currentRegionData?.exits) {
              returnExit = currentRegionData.exits.find(
                e => e.connected_region === sourceRegionName
              );
            }

            entrances.push({
              sourceRegion: sourceRegionName,
              exitName: exitDef.name,
              accessRule: exitDef.access_rule,
              isBidirectional: !!returnExit,
              returnExit
            });
          }
        }
      }
    }

    if (entrances.length === 0) return;

    const entrancesHeader = document.createElement('h4');
    entrancesHeader.textContent = 'Entrances:';
    entrancesHeader.classList.add('region-entrances-header');
    detailsEl.appendChild(entrancesHeader);

    const entrancesList = document.createElement('ul');
    entrancesList.classList.add('region-entrances-list');

    entrances.forEach(entrance => {
      const li = document.createElement('li');
      li.classList.add('entrance-item');

      const entranceWrapper = document.createElement('div');
      entranceWrapper.classList.add('entrance-wrapper');

      // Header row
      const headerRow = document.createElement('div');
      headerRow.style.display = 'flex';
      headerRow.style.justifyContent = 'space-between';
      headerRow.style.alignItems = 'center';
      headerRow.style.gap = '8px';

      // Entrance info: region link + exit name
      const entranceInfo = document.createElement('span');
      entranceInfo.style.flex = '1';
      entranceInfo.appendChild(
        commonUI.createRegionLink(entrance.sourceRegion, useColorblind, snapshot)
      );
      entranceInfo.appendChild(document.createTextNode(` via ${entrance.exitName}`));
      headerRow.appendChild(entranceInfo);

      // Evaluate entrance accessibility
      let entranceAccessible = true;
      if (entrance.accessRule) {
        try {
          entranceAccessible = evaluateRule(entrance.accessRule, snapshotInterface);
        } catch (e) {
          log('error', `Error evaluating entrance rule for ${entrance.exitName}:`, e);
          entranceAccessible = false;
        }
      }

      // Check source region reachability
      const sourceReachability = snapshot?.regionReachability?.[entrance.sourceRegion];
      const sourceRegionReachable = sourceReachability === true ||
        sourceReachability === 'reachable' ||
        sourceReachability === 'checked';
      const isTraversable = sourceRegionReachable && entranceAccessible;

      // Return exit accessibility for bidirectional
      let returnExitAccessible = true;
      if (entrance.isBidirectional && entrance.returnExit?.access_rule) {
        try {
          returnExitAccessible = evaluateRule(entrance.returnExit.access_rule, snapshotInterface);
        } catch (e) {
          returnExitAccessible = false;
        }
      }
      const isFullyTraversable = isTraversable && returnExitAccessible;
      const isClickable = entrance.isBidirectional && isFullyTraversable;

      // Status indicator
      const statusIndicator = document.createElement('span');
      statusIndicator.classList.add('exit-status');
      if (!entrance.isBidirectional) {
        statusIndicator.textContent = 'One-way';
        statusIndicator.classList.add('status-oneway');
      } else if (isFullyTraversable) {
        statusIndicator.textContent = 'Available';
        statusIndicator.classList.add('status-available');
      } else {
        statusIndicator.textContent = 'Blocked';
        statusIndicator.classList.add('status-blocked');
      }
      headerRow.appendChild(statusIndicator);

      entranceWrapper.appendChild(headerRow);

      // Styling
      li.classList.toggle('accessible', isTraversable);
      li.classList.toggle('inaccessible', !isTraversable);

      if (!entrance.isBidirectional) {
        entranceWrapper.style.borderColor = '#888';
        entranceWrapper.style.backgroundColor = 'rgba(136, 136, 136, 0.1)';
      } else if (isFullyTraversable) {
        entranceWrapper.style.borderColor = '#4CAF50';
        entranceWrapper.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
      } else {
        entranceWrapper.style.borderColor = '#f44336';
        entranceWrapper.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
      }

      entranceWrapper.style.border = '2px solid';
      entranceWrapper.style.borderRadius = '4px';
      entranceWrapper.style.padding = '8px 12px';
      entranceWrapper.style.margin = '4px 0';
      entranceWrapper.style.cursor = isClickable ? 'pointer' : 'default';
      entranceWrapper.style.display = 'block';
      entranceWrapper.style.transition = 'all 0.2s ease';

      // Hover effects for clickable entrances
      if (isClickable) {
        entranceWrapper.addEventListener('mouseenter', () => {
          entranceWrapper.style.transform = 'translateX(4px)';
          entranceWrapper.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        });
        entranceWrapper.addEventListener('mouseleave', () => {
          entranceWrapper.style.transform = 'translateX(0)';
          entranceWrapper.style.boxShadow = 'none';
        });

        // Click handler - move to source region via return exit
        entranceWrapper.addEventListener('click', (e) => {
          if (e.target.classList.contains('region-link')) return;

          const dispatcher = getLoopsModuleDispatcher();
          if (dispatcher) {
            dispatcher.publish('user:regionMove', {
              sourceRegion: regionName,
              targetRegion: entrance.sourceRegion,
              exitName: entrance.returnExit?.name || entrance.exitName,
              updatePath: true,
              source: 'loopBlockBuilder'
            }, 'bottom');
            log('info', `[Entrance] Moving from ${regionName} to ${entrance.sourceRegion} via ${entrance.returnExit?.name || entrance.exitName}`);
          }
          this.loopUI.navigateToRegion(entrance.sourceRegion);
        });
      }

      li.appendChild(entranceWrapper);
      entrancesList.appendChild(li);
    });

    detailsEl.appendChild(entrancesList);
  }

  /**
   * Adds exits list to the details element
   * Matches RegionBlockBuilder's addExits with full traversability checks,
   * hover effects, status badges, and logic tree rendering
   */
  addExits(
    detailsEl,
    regionName,
    regionStaticData,
    snapshot,
    snapshotInterface,
    regionIsReachable,
    useColorblind
  ) {
    const exitsHeader = document.createElement('h4');
    exitsHeader.textContent = 'Exits:';
    exitsHeader.classList.add('region-exits-header');
    detailsEl.appendChild(exitsHeader);

    const exitsList = document.createElement('ul');
    exitsList.classList.add('region-exits-list');

    if (regionStaticData.exits && regionStaticData.exits.length > 0) {
      regionStaticData.exits.forEach((exitDef) => {
        // Evaluate exit accessibility
        let exitAccessible = true;
        if (exitDef.access_rule) {
          try {
            exitAccessible = evaluateRule(exitDef.access_rule, snapshotInterface);
          } catch (e) {
            log('error', `Error evaluating exit rule for ${exitDef.name} in ${regionName}:`, e);
            exitAccessible = false;
          }
        }

        const connectedRegionName = exitDef.connected_region;
        const connectedReachability = snapshot?.regionReachability?.[connectedRegionName];
        const connectedRegionReachable =
          connectedReachability === true ||
          connectedReachability === 'reachable' ||
          connectedReachability === 'checked';
        const isTraversable = regionIsReachable && exitAccessible && connectedRegionReachable;

        const li = document.createElement('li');
        li.classList.add('exit-item');

        // Create wrapper div for the entire clickable area
        const exitWrapper = document.createElement('div');
        exitWrapper.classList.add('exit-wrapper');

        // Header row with exit info and status
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'space-between';
        headerRow.style.alignItems = 'center';
        headerRow.style.gap = '8px';

        // Exit info: exit name + region link
        const exitInfo = document.createElement('span');
        exitInfo.style.flex = '1';
        exitInfo.appendChild(document.createTextNode(`${exitDef.name} \u2192 `));
        exitInfo.appendChild(
          commonUI.createRegionLink(connectedRegionName, useColorblind, snapshot)
        );
        headerRow.appendChild(exitInfo);

        // Status indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.classList.add('exit-status');
        if (isTraversable) {
          statusIndicator.textContent = 'Available';
          statusIndicator.classList.add('status-available');
        } else {
          statusIndicator.textContent = 'Blocked';
          statusIndicator.classList.add('status-blocked');
        }
        headerRow.appendChild(statusIndicator);

        exitWrapper.appendChild(headerRow);

        // Apply classes and styling
        li.classList.toggle('accessible', isTraversable);
        li.classList.toggle('inaccessible', !isTraversable);

        // Border color based on status
        if (isTraversable) {
          exitWrapper.style.borderColor = '#4CAF50';
          exitWrapper.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        } else {
          exitWrapper.style.borderColor = '#f44336';
          exitWrapper.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
        }

        exitWrapper.style.border = '2px solid';
        exitWrapper.style.borderRadius = '4px';
        exitWrapper.style.padding = '8px 12px';
        exitWrapper.style.margin = '4px 0';
        exitWrapper.style.cursor = isTraversable && connectedRegionName ? 'pointer' : 'default';
        exitWrapper.style.display = 'block';
        exitWrapper.style.transition = 'all 0.2s ease';

        // Add hover effect for traversable exits
        if (isTraversable && connectedRegionName) {
          exitWrapper.addEventListener('mouseenter', () => {
            exitWrapper.style.transform = 'translateX(4px)';
            exitWrapper.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          });
          exitWrapper.addEventListener('mouseleave', () => {
            exitWrapper.style.transform = 'translateX(0)';
            exitWrapper.style.boxShadow = 'none';
          });

          // Make entire wrapper clickable
          exitWrapper.addEventListener('click', (e) => {
            // Don't trigger if clicking on the region link
            if (e.target.classList.contains('region-link')) {
              return;
            }

            if (isTraversable && connectedRegionName) {
              const dispatcher = getLoopsModuleDispatcher();
              if (dispatcher) {
                // Get current region from playerState for accurate source
                const currentRegion = this.loopUI.playerStateAPI?.getCurrentRegion?.() || regionName;
                dispatcher.publish('user:regionMove', {
                  sourceRegion: currentRegion,
                  targetRegion: connectedRegionName,
                  exitName: exitDef.name,
                  updatePath: true,
                  source: 'loopBlockBuilder'
                }, 'bottom');
                log('info', `[Exit] Moving from ${currentRegion} to ${connectedRegionName} via ${exitDef.name}`);
              } else {
                log('error', 'Dispatcher not available for publishing user:regionMove');
              }
              this.loopUI.navigateToRegion(connectedRegionName);
            }
          });
        }

        // Render logic tree for the exit rule
        if (exitDef.access_rule) {
          const logicTreeElement = renderLogicTree(
            exitDef.access_rule,
            useColorblind,
            snapshotInterface
          );
          const ruleDiv = document.createElement('div');
          ruleDiv.classList.add('logic-rule-container');
          ruleDiv.style.marginTop = '8px';
          ruleDiv.style.paddingTop = '8px';
          ruleDiv.style.borderTop = '1px solid rgba(128, 128, 128, 0.3)';

          const ruleLabel = document.createTextNode('Rule: ');
          ruleDiv.appendChild(ruleLabel);
          ruleDiv.appendChild(logicTreeElement);

          exitWrapper.appendChild(ruleDiv);
        }

        li.appendChild(exitWrapper);
        exitsList.appendChild(li);
      });
    } else {
      exitsList.innerHTML = '<li>No exits defined.</li>';
    }

    detailsEl.appendChild(exitsList);
  }

  /**
   * Adds locations list to the details element
   * Matches RegionBlockBuilder's addLocations with full accessibility checks,
   * hover effects, status badges, and logic tree rendering
   */
  addLocations(
    detailsEl,
    regionName,
    regionStaticData,
    snapshot,
    snapshotInterface,
    regionIsReachable,
    useColorblind,
    staticData
  ) {
    const locationsHeader = document.createElement('h4');
    locationsHeader.textContent = 'Locations:';
    locationsHeader.classList.add('region-locations-header');
    detailsEl.appendChild(locationsHeader);

    const locationsList = document.createElement('ul');
    locationsList.classList.add('region-locations-list');

    if (regionStaticData.locations && regionStaticData.locations.length > 0) {
      regionStaticData.locations.forEach((locationDef) => {
        // Evaluate location accessibility
        let locAccessible = true;
        if (locationDef.access_rule) {
          try {
            locAccessible = evaluateRule(locationDef.access_rule, snapshotInterface);
          } catch (e) {
            log('error', `Error evaluating location rule for ${locationDef.name}:`, e);
            locAccessible = false;
          }
        }
        // Combine with region reachability
        locAccessible = regionIsReachable && locAccessible;

        // Check if location has been checked
        const locChecked = snapshot?.checkedLocations?.includes(locationDef.name) ?? false;

        const li = document.createElement('li');
        li.classList.add('location-item');
        li.dataset.locationName = locationDef.name;

        // Create wrapper div
        const locationWrapper = document.createElement('div');
        locationWrapper.classList.add('location-wrapper');

        // Header row
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'space-between';
        headerRow.style.alignItems = 'center';
        headerRow.style.gap = '8px';

        // Location name link
        const locationLink = document.createElement('span');
        locationLink.classList.add('location-link');
        locationLink.style.flex = '1';
        locationLink.textContent = locationDef.name;
        locationLink.dataset.location = locationDef.name;
        locationLink.dataset.region = regionName;
        headerRow.appendChild(locationLink);

        // Status indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.classList.add('exit-status');
        if (locChecked) {
          statusIndicator.textContent = 'Checked';
          statusIndicator.classList.add('status-checked');
        } else if (locAccessible) {
          statusIndicator.textContent = 'Available';
          statusIndicator.classList.add('status-available');
        } else {
          statusIndicator.textContent = 'Locked';
          statusIndicator.classList.add('status-locked');
        }
        headerRow.appendChild(statusIndicator);

        locationWrapper.appendChild(headerRow);

        // Apply classes and styling
        li.classList.toggle('accessible', locAccessible && !locChecked);
        li.classList.toggle('inaccessible', !locAccessible);
        li.classList.toggle('checked-location', locChecked);

        // Border color based on status
        if (locChecked) {
          locationWrapper.style.borderColor = '#000';
          locationWrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        } else if (locAccessible) {
          locationWrapper.style.borderColor = '#4CAF50';
          locationWrapper.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        } else {
          locationWrapper.style.borderColor = '#f44336';
          locationWrapper.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
        }

        locationWrapper.style.border = '2px solid';
        locationWrapper.style.borderRadius = '4px';
        locationWrapper.style.padding = '8px 12px';
        locationWrapper.style.margin = '4px 0';
        locationWrapper.style.cursor = (locAccessible && !locChecked) ? 'pointer' : 'default';
        locationWrapper.style.display = 'block';
        locationWrapper.style.transition = 'all 0.2s ease';

        // Hover effects for clickable locations
        if (locAccessible && !locChecked) {
          locationWrapper.addEventListener('mouseenter', () => {
            locationWrapper.style.transform = 'translateX(4px)';
            locationWrapper.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          });
          locationWrapper.addEventListener('mouseleave', () => {
            locationWrapper.style.transform = 'translateX(0)';
            locationWrapper.style.boxShadow = 'none';
          });

          // Click handler - queue location check
          locationWrapper.addEventListener('click', () => {
            if (this.loopUI.playerStateAPI?.addLocationCheck) {
              this.loopUI.playerStateAPI.addLocationCheck(locationDef.name, regionName);
              this.loopUI.renderLoopPanel();
            }
          });
        }

        // Render logic tree for location access rule
        if (locationDef.access_rule) {
          const locationContextInterface = createSnapshotInterface(
            snapshot, staticData, { location: locationDef }
          );
          const logicTreeElement = renderLogicTree(
            locationDef.access_rule,
            useColorblind,
            locationContextInterface
          );
          const ruleDiv = document.createElement('div');
          ruleDiv.classList.add('logic-rule-container');
          ruleDiv.style.marginTop = '8px';
          ruleDiv.style.paddingTop = '8px';
          ruleDiv.style.borderTop = '1px solid rgba(128, 128, 128, 0.3)';

          const ruleLabel = document.createTextNode('Rule: ');
          ruleDiv.appendChild(ruleLabel);
          ruleDiv.appendChild(logicTreeElement);

          locationWrapper.appendChild(ruleDiv);
        }

        li.appendChild(locationWrapper);
        locationsList.appendChild(li);
      });
    } else {
      locationsList.innerHTML = '<li>No locations defined.</li>';
    }

    detailsEl.appendChild(locationsList);
  }

  /**
   * Creates an action block element for display in the region
   * @param {Object} pathEntry - The path entry object
   * @param {number} index - The index in the action queue
   * @param {boolean} isCurrentAction - Whether this is the currently executing action
   * @returns {HTMLElement} The action block element
   */
  createActionBlockElement(pathEntry, index, isCurrentAction) {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'region-action-block';
    actionDiv.dataset.actionIndex = index;

    if (isCurrentAction) {
      actionDiv.classList.add('current-action');
    }

    // Determine action type and create appropriate display
    let actionText = '';
    let manaCost = 0;

    if (pathEntry.type === 'regionMove') {
      actionText = `Move to ${pathEntry.destinationRegion || pathEntry.region}`;
      if (pathEntry.exitUsed) {
        actionText += ` via ${pathEntry.exitUsed}`;
      }
      manaCost = loopState._calculateActionCost({type: 'moveToRegion', destinationRegion: pathEntry.destinationRegion || pathEntry.region});
    } else if (pathEntry.type === 'locationCheck') {
      actionText = `Check: ${pathEntry.locationName}`;
      manaCost = loopState._calculateActionCost({type: 'checkLocation', locationName: pathEntry.locationName});
    } else if (pathEntry.type === 'customAction') {
      if (pathEntry.actionName === 'explore') {
        actionText = 'Explore Region';
        manaCost = loopState._calculateActionCost({type: 'explore', regionName: pathEntry.region});
      } else {
        actionText = `Action: ${pathEntry.actionName}`;
      }
    }

    // Create content: [X] action name ... mana cost
    actionDiv.style.display = 'flex';
    actionDiv.style.alignItems = 'center';
    actionDiv.style.gap = '6px';
    actionDiv.innerHTML = `
      <button class="remove-action-btn" data-index="${index}">\u00d7</button>
      <span class="action-text" style="flex: 1;">${actionText}</span>
      <span class="action-mana">-${manaCost} Mana</span>
    `;

    // Add progress bar if this is the current action
    if (isCurrentAction && loopState.actionProgress) {
      const progress = loopState.actionProgress.get(index) || 0;
      const progressBar = document.createElement('div');
      progressBar.className = 'action-progress-bar';
      progressBar.innerHTML = `
        <div class="progress-fill" style="width: ${progress}%"></div>
      `;
      actionDiv.appendChild(progressBar);
    }

    // Add remove button handler
    const removeBtn = actionDiv.querySelector('.remove-action-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeActionAtIndex(index);
      });
    }

    return actionDiv;
  }

  /**
   * Attaches event listeners to the header element
   * @param {HTMLElement} headerEl - Header element
   * @param {string} regionName - Name of the region
   */
  attachEventListeners(headerEl, regionName) {
    // Header click listener for expand/collapse
    headerEl.addEventListener('click', (e) => {
      this.loopUI.toggleRegionExpanded(regionName);
    });

    // Clicking the background of an expanded region block collapses it
    const regionBlock = headerEl.parentElement;
    if (regionBlock) {
      regionBlock.addEventListener('click', (e) => {
        // Only collapse, don't expand (header handles toggle)
        if (!this.loopUI.expansionState.isRegionExpanded(regionName)) return;

        // Ignore clicks on interactive elements
        const interactive = e.target.closest(
          'button, a, input, label, select, .exit-wrapper, .location-wrapper, .entrance-wrapper, .region-link, .explore-btn, .loop-region-header, .remove-action-btn, .logic-rule-container'
        );
        if (interactive) return;

        this.loopUI.toggleRegionExpanded(regionName);
      });
    }
  }

  /**
   * Queues an explore action for a region
   * @param {string} regionName - The region to explore
   */
  queueExploreAction(regionName) {
    if (this.loopUI.playerStateAPI?.addCustomAction) {
      this.loopUI.playerStateAPI.addCustomAction('explore', { regionName });
      this.loopUI.renderLoopPanel();
    }
  }

  /**
   * Removes an action at a specific index
   * @param {number} index - The index to remove
   */
  removeActionAtIndex(index) {
    // Delegate to loopUI's implementation
    if (this.loopUI._removeActionAtIndex) {
      this.loopUI._removeActionAtIndex(index);
    }
  }
}

export default LoopBlockBuilder;
