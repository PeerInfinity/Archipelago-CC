// exitUI.js
import stateManager from '../core/stateManagerSingleton.js';
import { evaluateRule } from '../core/ruleEngine.js';
import commonUI from './commonUI.js';
import loopState from '../core/loop/loopState.js';

export class ExitUI {
  constructor(gameUI) {
    this.gameUI = gameUI;
    this.columns = 2; // Default number of columns

    this.attachEventListeners();
  }

  initialize() {
    // Don't need to call loadFromJSON since gameUI.js already does this
    this.updateExitDisplay();
  }

  clear() {
    const exitsGrid = document.getElementById('exits-grid');
    if (exitsGrid) {
      exitsGrid.innerHTML = '';
    }
  }

  update() {
    this.updateExitDisplay();
  }

  attachEventListeners() {
    // Sorting and filtering
    [
      'exit-sort-select',
      'exit-show-reachable',
      'exit-show-unreachable',
      'exit-show-explored',
    ].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener('change', () => this.updateExitDisplay());
    });

    // Column adjustment buttons
    document
      .getElementById('exit-increase-columns')
      ?.addEventListener('click', () => this.changeColumns(1));
    document
      .getElementById('exit-decrease-columns')
      ?.addEventListener('click', () => this.changeColumns(-1));
  }

  changeColumns(delta) {
    this.columns = Math.max(1, this.columns + delta); // Ensure at least 1 column
    this.updateExitDisplay();
  }

  syncWithState() {
    this.updateExitDisplay();
  }

  updateExitDisplay() {
    const showReachable = document.getElementById('exit-show-reachable')?.checked ?? true;
    const showUnreachable = document.getElementById('exit-show-unreachable')?.checked ?? true;
    const showExplored = document.getElementById('exit-show-explored')?.checked ?? true;
    const sorting = document.getElementById('exit-sort-select')?.value ?? 'original';

    // Get all exits from all regions
    const exits = this.getAllExits();

    const exitsGrid = document.getElementById('exits-grid');
    if (!exitsGrid) return;

    exitsGrid.style.gridTemplateColumns = `repeat(${this.columns}, minmax(0, 1fr))`; // Set the number of columns

    if (exits.length === 0) {
      exitsGrid.innerHTML = `
        <div class="empty-message">
          Upload a JSON file to see exits or adjust filters
        </div>
      `;
      return;
    }

    // Apply filters
    let filteredExits = exits;

    // Only show discovered exits in Loop Mode if not showing all
    const isLoopModeActive = window.loopUIInstance?.isLoopModeActive;
    if (isLoopModeActive) {
      const showingExplored = showExplored;
      
      filteredExits = exits.filter(exit => {
        const regionDiscovered = loopState.isRegionDiscovered(exit.region);
        if (!regionDiscovered) return false;
        
        const exitDiscovered = loopState.isExitDiscovered(exit.region, exit.name);
        return showingExplored || !exitDiscovered;
      });
    }

    // Filter reachable/unreachable
    filteredExits = filteredExits.filter(exit => {
      const regionAccessible = stateManager.isRegionReachable(exit.region);
      const exitTraversable = !exit.access_rule || evaluateRule(exit.access_rule);
      
      if (regionAccessible && exitTraversable) {
        return showReachable;
      } else {
        return showUnreachable;
      }
    });

    // Sort exits
    if (sorting === 'accessibility') {
      filteredExits.sort((a, b) => {
        const aRegionAccessible = stateManager.isRegionReachable(a.region);
        const bRegionAccessible = stateManager.isRegionReachable(b.region);

        const aExitTraversable = !a.access_rule || evaluateRule(a.access_rule);
        const bExitTraversable = !b.access_rule || evaluateRule(b.access_rule);

        if (aRegionAccessible && bRegionAccessible) {
          if (aExitTraversable && bExitTraversable) {
            return 0;
          } else if (aExitTraversable) {
            return -1;
          } else if (bExitTraversable) {
            return 1;
          } else {
            return 0;
          }
        } else if (aRegionAccessible) {
          return -1;
        } else if (bRegionAccessible) {
          return 1;
        } else {
          return 0;
        }
      });
    }

    // Generate HTML for exits
    exitsGrid.innerHTML = filteredExits
      .map((exit) => {
        const isRegionAccessible = stateManager.isRegionReachable(exit.region);
        const isExitTraversable = !exit.access_rule || evaluateRule(exit.access_rule);
        
        let stateClass = isExitTraversable ? 'traversable' : 'not-traversable';
        
        // For Loop Mode, check if the exit is discovered
        let exitName = exit.name;
        if (isLoopModeActive) {
          const isRegionDiscovered = loopState.isRegionDiscovered(exit.region);
          const isExitDiscovered = loopState.isExitDiscovered(exit.region, exit.name);
          
          if (!isRegionDiscovered || !isExitDiscovered) {
            exitName = "???";
            stateClass += " undiscovered";
          }
        }

        // Add connected region details
        let connectedRegionDisplay = '';
        if (exit.connected_region) {
          let connectedRegionName = exit.connected_region;
          
          // In Loop Mode, hide undiscovered connected regions
          if (isLoopModeActive) {
            const isConnectedRegionDiscovered = loopState.isRegionDiscovered(exit.connected_region);
            if (!isConnectedRegionDiscovered) {
              connectedRegionName = "???";
            }
          }
          
          connectedRegionDisplay = `
            <div class="text-sm">
              Leads to: <span class="region-link" data-region="${exit.connected_region}">${connectedRegionName}</span>
            </div>
          `;
        }

        return `
          <div 
            class="exit-card ${stateClass}"
            data-exit="${encodeURIComponent(
              JSON.stringify(exit)
            ).replace(/"/g, '&quot;')}"
          >
            <div class="font-medium exit-link" data-exit="${
              exit.name
            }" data-region="${exit.region}">${exitName}</div>
            <div class="text-sm">Player ${exit.player || '1'}</div>
            <div class="text-sm">
              Region: <span class="region-link" data-region="${
                exit.region
              }" style="color: ${isRegionAccessible ? 'inherit' : 'red'}">${
          exit.region
        }</span> (${isRegionAccessible ? 'Accessible' : 'Inaccessible'})
            </div>
            ${connectedRegionDisplay}
            <div class="text-sm">
              Exit logic: ${
                commonUI.renderLogicTree(exit.access_rule).outerHTML
              }
            </div>
            <div class="text-sm">
              ${
                isExitTraversable
                  ? 'Traversable'
                  : 'Not traversable'
              }
            </div>
          </div>
        `;
      })
      .join('');

    // Add click handlers for region links
    document.querySelectorAll('.region-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening the exit modal if we implement one
        const regionName = link.dataset.region;
        if (regionName) {
          this.gameUI.regionUI.navigateToRegion(regionName);
        }
      });
    });

    // Add click handlers for exit links
    document.querySelectorAll('.exit-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent capturing click on parent card
        const exitName = link.dataset.exit;
        const regionName = link.dataset.region;
        if (exitName && regionName) {
          this.gameUI.regionUI.navigateToRegion(regionName);
        }
      });
    });
  }

  getAllExits() {
    const allExits = [];
    
    // Iterate through all regions to collect exits
    Object.entries(stateManager.regions).forEach(([regionName, region]) => {
      if (region.exits && Array.isArray(region.exits)) {
        region.exits.forEach(exit => {
          // Add region name to each exit for reference
          allExits.push({
            ...exit,
            region: regionName,
            player: region.player || 1
          });
        });
      }
    });
    
    return allExits;
  }
}

export default ExitUI;