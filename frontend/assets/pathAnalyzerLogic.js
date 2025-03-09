// pathAnalyzerLogic.js
import { evaluateRule } from './ruleEngine.js';
import stateManager from './stateManagerSingleton.js';

/**
 * Core logic for path analysis, separated from UI concerns
 * Handles path finding, rule evaluation, and node categorization
 */
export class PathAnalyzerLogic {
  constructor() {
    // Configure maximum iterations for path finding to prevent UI freezes
    this.maxPathFinderIterations = 10000;
    this.debugMode = false;
  }

  /**
   * Sets the debug mode
   * @param {boolean} debug - Whether debug mode is enabled
   */
  setDebugMode(debug) {
    this.debugMode = debug;
  }

  /**
   * Finds paths to a region using BFS
   * @param {string} targetRegion - The region to find paths to
   * @param {number} maxPaths - Maximum number of paths to find
   * @returns {Array} - Array of paths to the target region
   */
  findPathsToRegion(targetRegion, maxPaths = 100) {
    const paths = [];

    // Use stateManager's computeReachableRegions to check if the target is reachable at all
    const reachableRegions = stateManager.computeReachableRegions();

    if (!reachableRegions.has(targetRegion)) {
      this._logDebug(
        `Target region ${targetRegion} is not reachable according to stateManager`
      );
      // Still attempt to find paths, which might reveal why it's unreachable
    }

    const startRegions = stateManager.getStartRegions();

    for (const startRegion of startRegions) {
      if (paths.length >= maxPaths) break;
      this._findPathsDFS(
        startRegion,
        targetRegion,
        [startRegion],
        new Set([startRegion]),
        paths,
        maxPaths
      );
    }

    return paths;
  }

  /**
   * Helper method for DFS path finding
   * @private
   */
  _findPathsDFS(
    currentRegion,
    targetRegion,
    currentPath,
    visited,
    allPaths,
    maxPaths
  ) {
    if (currentRegion === targetRegion && currentPath.length > 1) {
      allPaths.push([...currentPath]);
      return;
    }

    if (allPaths.length >= maxPaths) return;

    const regionData = stateManager.regions[currentRegion];
    if (!regionData) return;

    for (const exit of regionData.exits || []) {
      const nextRegion = exit.connected_region;
      if (!nextRegion || visited.has(nextRegion)) continue;

      visited.add(nextRegion);
      currentPath.push(nextRegion);
      this._findPathsDFS(
        nextRegion,
        targetRegion,
        currentPath,
        visited,
        allPaths,
        maxPaths
      );
      currentPath.pop();
      visited.delete(nextRegion);
    }
  }

  /**
   * Find all transitions in a path, including blocked and open transitions
   * @param {Array<string>} path - Array of region names
   * @returns {Array<Object>} - Array of transition objects
   */
  findAllTransitions(path) {
    const transitions = [];

    for (let i = 0; i < path.length - 1; i++) {
      const fromRegion = path[i];
      const toRegion = path[i + 1];

      const fromAccessible = stateManager.isRegionReachable(fromRegion);
      const toAccessible = stateManager.isRegionReachable(toRegion);

      // Get the region data
      const fromRegionData = stateManager.regions[fromRegion];
      if (!fromRegionData || !fromRegionData.exits) continue;

      // Find ALL exits that connect these regions
      const availableExits = fromRegionData.exits.filter(
        (e) => e.connected_region === toRegion
      );

      if (availableExits.length === 0) continue;

      // Log what we found for debugging
      this._logDebug(
        `Transition ${fromRegion} → ${toRegion}: Found ${availableExits.length} exits`
      );

      // Evaluate all exits to determine if ANY are accessible
      const accessibleExits = availableExits.filter(
        (exit) => !exit.access_rule || evaluateRule(exit.access_rule)
      );

      // Log the accessible exits
      this._logDebug(
        `Transition ${fromRegion} → ${toRegion}: ${accessibleExits.length} accessible exits:`,
        accessibleExits.map((e) => e.name)
      );

      // The transition is accessible if ANY exit is accessible
      const transitionAccessible = accessibleExits.length > 0;

      // Add this transition to our list
      transitions.push({
        fromRegion,
        toRegion,
        exits: availableExits,
        isBlocking: fromAccessible && !toAccessible,
        // The transition is accessible if ANY exit is accessible
        transitionAccessible: transitionAccessible,
      });
    }

    // Debug logging for transitions
    this._logDebug('Path transitions debug:');
    transitions.forEach((t) => {
      this._logDebug(
        `Transition ${t.fromRegion} → ${t.toRegion}:`,
        `Accessible: ${t.transitionAccessible}, ` +
          `Exits: ${t.exits.length}, ` +
          `Accessible exits: ${
            t.exits.filter((e) => !e.access_rule || evaluateRule(e.access_rule))
              .length
          }`
      );
    });

    return transitions;
  }

  /**
   * Debug a specific transition between two regions
   * @param {Array<Object>} transitions - List of transitions
   * @param {string} fromRegion - Starting region name
   * @param {string} toRegion - Destination region name
   * @returns {Object|null} - The transition object if found
   */
  debugTransition(transitions, fromRegion, toRegion) {
    const transition = transitions.find(
      (t) => t.fromRegion === fromRegion && t.toRegion === toRegion
    );

    if (!transition) {
      this._logDebug(
        `DEBUG: No transition found from ${fromRegion} to ${toRegion}`
      );
      return;
    }

    this._logDebug(`DEBUG: Transition ${fromRegion} → ${toRegion}:`);
    this._logDebug(
      `  Marked as: ${
        transition.transitionAccessible ? 'ACCESSIBLE' : 'INACCESSIBLE'
      }`
    );
    this._logDebug(`  Exits count: ${transition.exits.length}`);

    transition.exits.forEach((exit, i) => {
      const accessible = !exit.access_rule || evaluateRule(exit.access_rule);
      this._logDebug(
        `  Exit ${i + 1}/${transition.exits.length}: ${exit.name} - ${
          accessible ? 'ACCESSIBLE' : 'INACCESSIBLE'
        }`
      );
    });

    return transition;
  }

  /**
   * Analyze all direct connections to a region
   * @param {string} regionName - The region to analyze
   * @returns {Object} - Analysis results containing node categories and region data
   */
  analyzeDirectConnections(regionName) {
    const allNodes = {
      primaryBlockers: [],
      secondaryBlockers: [],
      tertiaryBlockers: [],
      primaryRequirements: [],
      secondaryRequirements: [],
      tertiaryRequirements: [],
    };

    const regionData = stateManager.regions[regionName];
    const analysisData = {
      entrances: [],
      regionRules: [],
    };

    // 1. Analyze region's own rules
    if (regionData?.region_rules?.length > 0) {
      regionData.region_rules.forEach((rule) => {
        if (!rule) return;

        analysisData.regionRules.push(rule);
      });
    }

    // 2. Analyze entrances to this region
    Object.entries(stateManager.regions).forEach(
      ([otherRegionName, otherRegionData]) => {
        if (otherRegionName === regionName) return;

        if (otherRegionData.exits) {
          const entrances = otherRegionData.exits.filter(
            (exit) => exit.connected_region === regionName && exit.access_rule
          );

          if (entrances.length > 0) {
            entrances.forEach((entrance) => {
              analysisData.entrances.push({
                fromRegion: otherRegionName,
                entrance: entrance,
              });
            });
          }
        }
      }
    );

    return {
      nodes: allNodes,
      analysisData: analysisData,
    };
  }

  /**
   * Finds a reliable canonical path using the same BFS approach as stateManager
   * @param {string} targetRegion - The target region to find a path to
   * @returns {Object|null} - Object containing the path and connection info, or null if no path exists
   */
  findCanonicalPath(targetRegion) {
    // First check if the region is reachable according to stateManager
    const reachableRegions = new Set(stateManager.computeReachableRegions());
    if (!reachableRegions.has(targetRegion)) {
      return null; // Target isn't reachable according to stateManager
    }

    // Record predecessor information during a BFS search
    const predecessors = new Map();
    const exitInfo = new Map(); // Store the exit used between regions
    const queue = [...stateManager.getStartRegions()];
    const visited = new Set(queue);

    // Track level of search to ensure we find shortest path
    const nodeLevel = new Map();
    queue.forEach((region) => nodeLevel.set(region, 0));

    while (queue.length > 0) {
      const currentRegion = queue.shift();
      const currentLevel = nodeLevel.get(currentRegion);

      // Found target region, reconstruct path
      if (currentRegion === targetRegion) {
        return this._reconstructCanonicalPath(
          predecessors,
          exitInfo,
          targetRegion
        );
      }

      // Process all exits from the current region
      const currentRegionData = stateManager.regions[currentRegion];
      if (!currentRegionData) continue;

      for (const exit of currentRegionData.exits || []) {
        if (!exit.connected_region) continue;

        // Check if this exit is traversable
        const exitAccessible =
          !exit.access_rule || evaluateRule(exit.access_rule);
        if (!exitAccessible) continue;

        const nextRegion = exit.connected_region;
        if (!reachableRegions.has(nextRegion)) continue;

        const newLevel = currentLevel + 1;

        if (!visited.has(nextRegion)) {
          // First time seeing this region - use this path
          visited.add(nextRegion);
          queue.push(nextRegion);
          nodeLevel.set(nextRegion, newLevel);
          predecessors.set(nextRegion, currentRegion);
          exitInfo.set(`${currentRegion}->${nextRegion}`, exit);
        }
        // If we find a shorter path, update it
        else if (
          nodeLevel.has(nextRegion) &&
          newLevel < nodeLevel.get(nextRegion)
        ) {
          // Update to shorter path
          nodeLevel.set(nextRegion, newLevel);
          predecessors.set(nextRegion, currentRegion);
          exitInfo.set(`${currentRegion}->${nextRegion}`, exit);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Reconstructs a path from predecessors map
   * @param {Map} predecessors - Map of region to its predecessor
   * @param {Map} exitInfo - Map of region pairs to the exit used
   * @param {string} targetRegion - Target region
   * @returns {Object} - Object containing the path and exit information
   * @private
   */
  _reconstructCanonicalPath(predecessors, exitInfo, targetRegion) {
    const regions = [targetRegion];
    const connections = [];
    let current = targetRegion;

    while (predecessors.has(current)) {
      const previous = predecessors.get(current);

      // Add the connection to our connections list
      const exitKey = `${previous}->${current}`;
      const exit = exitInfo.get(exitKey);

      if (exit) {
        connections.unshift({
          fromRegion: previous,
          toRegion: current,
          exit: {
            type: 'exit',
            name: exit.name,
            fromRegion: previous,
            toRegion: current,
            rule: exit.access_rule,
            accessible: true, // Must be accessible since we're using it in our path
          },
        });
      }

      regions.unshift(previous);
      current = previous;
    }

    return {
      regions: regions,
      connections: connections,
    };
  }

  /**
   * Extract categorized leaf nodes from a logic tree element
   * @param {HTMLElement} treeElement - The logic tree DOM element to analyze
   * @return {Object} - Object containing the categorized node lists
   */
  extractCategorizedNodes(treeElement) {
    // Initialize result categories with the six categories
    const nodes = {
      primaryBlockers: [],
      secondaryBlockers: [],
      tertiaryBlockers: [],
      primaryRequirements: [],
      secondaryRequirements: [],
      tertiaryRequirements: [],
    };

    // Check if this is a failing or passing node
    const isFailing = treeElement.classList.contains('fail');
    const isPassing = treeElement.classList.contains('pass');

    // Get the current tree evaluation result
    const treeEvaluationResult = isPassing;

    // Process based on node type
    const nodeType = this.getNodeType(treeElement);

    if (nodeType && this.isLeafNodeType(nodeType)) {
      // This is a leaf node, extract its data
      const nodeData = this.extractNodeData(treeElement, nodeType);

      if (nodeData) {
        // Categorize the node based on the new algorithm
        if (isFailing) {
          if (treeEvaluationResult) {
            // Tree already passes despite this node's failure - Tertiary blocker
            nodes.tertiaryBlockers.push(nodeData);
          } else {
            // Calculate what would happen if this node passed instead
            const hypotheticalResult = this.evaluateTreeWithNodeFlipped(
              treeElement,
              true
            );

            if (hypotheticalResult) {
              // Tree would pass if this node passed - Primary blocker
              nodes.primaryBlockers.push(nodeData);
            } else {
              // Tree would still fail - Secondary blocker
              nodes.secondaryBlockers.push(nodeData);
            }
          }
        } else if (isPassing) {
          if (!treeEvaluationResult) {
            // Tree already fails despite this node's passing - Tertiary requirement
            nodes.tertiaryRequirements.push(nodeData);
          } else {
            // Calculate what would happen if this node failed instead
            const hypotheticalResult = this.evaluateTreeWithNodeFlipped(
              treeElement,
              false
            );

            if (!hypotheticalResult) {
              // Tree would fail if this node failed - Primary requirement
              nodes.primaryRequirements.push(nodeData);
            } else {
              // Tree would still pass - Secondary requirement
              nodes.secondaryRequirements.push(nodeData);
            }
          }
        }
      }
    } else {
      // For non-leaf nodes, recursively check children
      const childLists = treeElement.querySelectorAll('ul');
      childLists.forEach((ul) => {
        ul.querySelectorAll('li').forEach((li) => {
          if (li.firstChild) {
            const childResults = this.extractCategorizedNodes(li.firstChild);
            // Merge results
            Object.keys(nodes).forEach((key) => {
              nodes[key].push(...childResults[key]);
            });
          }
        });
      });
    }

    return nodes;
  }

  /**
   * Evaluates what the tree result would be if a specific node's value was flipped
   * @param {HTMLElement} nodeElement - The node to flip
   * @param {boolean} newValue - The new value to assume for this node
   * @return {boolean} - The hypothetical tree evaluation result
   */
  evaluateTreeWithNodeFlipped(nodeElement, newValue) {
    // Find the root node of the tree
    let root = nodeElement;
    let parent = root.parentElement;

    while (parent) {
      if (
        parent.classList &&
        (parent.classList.contains('logic-tree') || parent.tagName === 'BODY')
      ) {
        break;
      }
      if (
        parent.classList &&
        (parent.classList.contains('pass') || parent.classList.contains('fail'))
      ) {
        root = parent;
      }
      parent = parent.parentElement;
    }

    // Now simulate evaluation with the flipped node
    return this.simulateEvaluation(root, nodeElement, newValue);
  }

  /**
   * Simulates rule evaluation with a specific node's value flipped
   * @param {HTMLElement} currentNode - Current node in the tree traversal
   * @param {HTMLElement} targetNode - The node to flip
   * @param {boolean} newTargetValue - The new value for the target node
   * @return {boolean} - The simulated evaluation result
   */
  simulateEvaluation(currentNode, targetNode, newTargetValue) {
    // If this is the target node, return the flipped value
    if (currentNode === targetNode) {
      return newTargetValue;
    }

    // Otherwise, evaluate based on the node type
    const nodeType = this.getNodeType(currentNode);
    if (!nodeType) return false;

    switch (nodeType) {
      case 'constant':
      case 'item_check':
      case 'count_check':
      case 'group_check':
      case 'helper':
      case 'state_method':
        // For leaf nodes, return their actual value unless they're the target
        return currentNode.classList.contains('pass');

      case 'and': {
        // For AND nodes, check all children - all must be true
        const childResults = [];
        const childLists = currentNode.querySelectorAll('ul');
        childLists.forEach((ul) => {
          ul.querySelectorAll('li').forEach((li) => {
            if (li.firstChild) {
              childResults.push(
                this.simulateEvaluation(
                  li.firstChild,
                  targetNode,
                  newTargetValue
                )
              );
            }
          });
        });
        return childResults.every(Boolean);
      }

      case 'or': {
        // For OR nodes, check all children - at least one must be true
        const childResults = [];
        const childLists = currentNode.querySelectorAll('ul');
        childLists.forEach((ul) => {
          ul.querySelectorAll('li').forEach((li) => {
            if (li.firstChild) {
              childResults.push(
                this.simulateEvaluation(
                  li.firstChild,
                  targetNode,
                  newTargetValue
                )
              );
            }
          });
        });
        return childResults.some(Boolean);
      }

      default:
        return false;
    }
  }

  /**
   * Determines the type of a logic node from its DOM element
   * @param {HTMLElement} element - The DOM element representing a logic node
   * @return {string|null} - The type of the logic node or null if not found
   */
  getNodeType(element) {
    const logicLabel = element.querySelector('.logic-label');
    if (logicLabel) {
      const typeMatch = logicLabel.textContent.match(/Type: (\w+)/);
      if (typeMatch && typeMatch[1]) {
        return typeMatch[1];
      }
    }
    return null;
  }

  /**
   * Checks if a node type is a leaf node type
   * @param {string} nodeType - The type of the logic node
   * @return {boolean} - True if it's a leaf node type, false otherwise
   */
  isLeafNodeType(nodeType) {
    return [
      'constant',
      'item_check',
      'count_check',
      'group_check',
      'helper',
      'state_method',
    ].includes(nodeType);
  }

  /**
   * Deduplicates a list of nodes, treating functions with different args as unique
   * @param {Array} nodes - List of nodes to deduplicate
   * @return {Array} - Deduplicated list
   */
  deduplicateNodes(nodes) {
    const uniqueNodes = [];
    const seenIdentifiers = new Set();

    nodes.forEach((node) => {
      // Create an identifier that includes function arguments if present
      let identifier = node.identifier;

      // If this is a helper node or state_method node with args, include them in the identifier
      if (
        (node.type === 'helper' || node.type === 'state_method') &&
        node.args
      ) {
        // Use a consistent string representation of the args
        const argsString =
          typeof node.args === 'string' ? node.args : JSON.stringify(node.args);

        identifier = `${identifier}:${argsString}`;
      }

      if (!seenIdentifiers.has(identifier)) {
        seenIdentifiers.add(identifier);
        uniqueNodes.push(node);
      }
    });

    return uniqueNodes;
  }

  /**
   * Extract data from a node element based on its type
   * @param {HTMLElement} element - The DOM element representing a node
   * @param {string} nodeType - The type of the node
   * @return {Object|null} - The extracted node data or null if extraction failed
   */
  extractNodeData(element, nodeType) {
    const textContent = element.textContent;
    const isFailing = element.classList.contains('fail');
    // Default display color - red for failing nodes, green for passing nodes
    const displayColor = isFailing ? '#f44336' : '#4caf50';

    switch (nodeType) {
      case 'constant':
        const valueMatch = textContent.match(/value: (true|false)/i);
        if (valueMatch) {
          return {
            type: 'constant',
            value: valueMatch[1].toLowerCase() === 'true',
            display: `Constant: ${valueMatch[1]}`,
            displayColor,
            identifier: `constant_${valueMatch[1]}`,
          };
        }
        break;

      case 'item_check':
        const itemMatch = textContent.match(
          /item: ([^,]+?)($|\s(?:Type:|helper:|method:|group:))/
        );
        if (itemMatch) {
          const itemName = itemMatch[1].trim();
          return {
            type: 'item_check',
            item: itemName,
            display: `Need item: ${itemName}`,
            displayColor,
            identifier: `item_${itemName}`,
          };
        }
        break;

      case 'count_check':
        const countMatch = textContent.match(/(\w+) >= (\d+)/);
        if (countMatch) {
          return {
            type: 'count_check',
            item: countMatch[1],
            count: parseInt(countMatch[2], 10),
            display: `Need ${countMatch[2]}× ${countMatch[1]}`,
            displayColor,
            identifier: `count_${countMatch[1]}_${countMatch[2]}`,
          };
        }
        break;

      case 'group_check':
        const groupMatch = textContent.match(
          /group: ([^,]+?)($|\s(?:Type:|helper:|method:|item:))/
        );
        if (groupMatch) {
          const groupName = groupMatch[1].trim();
          return {
            type: 'group_check',
            group: groupName,
            display: `Need group: ${groupName}`,
            displayColor,
            identifier: `group_${groupName}`,
          };
        }
        break;

      case 'helper':
        // Extract both the helper name and its arguments
        const helperMatch = textContent.match(
          /helper: ([^,]+?), args: (\[.*\]|\{.*\}|".*?"|null|\d+)/
        );
        if (helperMatch) {
          const helperName = helperMatch[1].trim();
          const helperArgs = helperMatch[2].trim();

          return {
            type: 'helper',
            name: helperName,
            args: helperArgs, // Save raw args string for deduplication
            display: `Helper function: ${helperName}`,
            displayColor,
            identifier: `helper_${helperName}`, // Base identifier, args handled in deduplication
          };
        }
        break;

      case 'state_method':
        // Extract both the method name and its arguments
        const methodMatch = textContent.match(
          /method: ([^,]+?), args: (\[.*\]|\{.*\}|".*?"|null|\d+)/
        );
        if (methodMatch) {
          const methodName = methodMatch[1].trim();
          const methodArgs = methodMatch[2].trim();

          return {
            type: 'state_method',
            method: methodName,
            args: methodArgs, // Save raw args string for deduplication
            display: `State method: ${methodName}`,
            displayColor,
            identifier: `method_${methodName}`, // Base identifier, args handled in deduplication
          };
        }
        break;
    }

    return null;
  }

  /**
   * Log debug information if debug mode is enabled
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   * @private
   */
  _logDebug(message, data = null) {
    if (this.debugMode) {
      const logMsg = `[PathAnalyzerLogic] ${message}`;
      if (data !== null) {
        console.log(logMsg, data);
      } else {
        console.log(logMsg);
      }
    }
  }
}

export default PathAnalyzerLogic;
