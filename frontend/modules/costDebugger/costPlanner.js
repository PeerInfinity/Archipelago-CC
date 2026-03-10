/**
 * Cost Planner - Pure computation engine for cost generation debugging
 *
 * Plans cost generation steps from a sphere log WITHOUT executing them.
 * Each step represents one action queue (one loop with one mana budget).
 *
 * Algorithm per sphere entry:
 *   1. Find path from start to target location's region
 *   2. Assign uniform moveCosts to uncosted regions in path
 *   3. EXPLORE phase: Plan loops to fully explore each unvisited region
 *      - Each explore discovers ONE location or exit
 *      - Explore cost = 2x region moveCost (discounted by level)
 *   4. CHECK phase: Assign location cost = floor(currentMana), check location
 *
 * Move cost model: cost to move = SOURCE region's moveCost (discounted).
 * Start region has moveCost 0, so leaving it is always free.
 */

import {
  proposedLinearFinalCost,
  levelFromXP,
  calculateXPGain,
} from '../loops/xpFormulas.js';

// =========================================================================
// SimulatedState
// =========================================================================

class SimulatedState {
  constructor(startRegion, maxMana, staticData) {
    this.currentMana = maxMana;
    this.maxMana = maxMana;
    this.regionXP = new Map();
    this.exploredRegions = new Set();
    this.discoveredLocations = new Map();
    this.discoveredExits = new Map();
    this.checkedLocations = new Set();
    this.assignedRegionCosts = new Map();
    this.assignedLocationCosts = new Map();

    // Build region contents from static data
    this.regionContents = new Map();
    if (staticData?.regions) {
      for (const [name, data] of staticData.regions.entries()) {
        this.regionContents.set(name, {
          locations: (data.locations || []).map(l => l.name),
          exits: (data.exits || []).map(e =>
            e.name || e.exit_name || `${name} -> ${e.connected_region}`
          ),
        });
      }
    }

    // Start region: cost 0, fully explored
    if (startRegion) {
      this.assignedRegionCosts.set(startRegion, { moveCost: 0 });
      this._markFullyExplored(startRegion);
    }
  }

  _markFullyExplored(regionName) {
    const contents = this.regionContents.get(regionName);
    if (contents) {
      this.discoveredLocations.set(regionName, new Set(contents.locations));
      this.discoveredExits.set(regionName, new Set(contents.exits));
    }
    this.exploredRegions.add(regionName);
  }

  isRegionFullyExplored(regionName) {
    return this.exploredRegions.has(regionName);
  }

  getDiscoveredCount(regionName) {
    const locs = this.discoveredLocations.get(regionName)?.size || 0;
    const exits = this.discoveredExits.get(regionName)?.size || 0;
    return locs + exits;
  }

  getTotalDiscoverables(regionName) {
    const contents = this.regionContents.get(regionName);
    if (!contents) return 0;
    return contents.locations.length + contents.exits.length;
  }

  getUndiscoveredCount(regionName) {
    return this.getTotalDiscoverables(regionName) - this.getDiscoveredCount(regionName);
  }

  /** Discover the next undiscovered location or exit. Returns { type, name } or null. */
  discoverNext(regionName) {
    const contents = this.regionContents.get(regionName);
    if (!contents) return null;

    const discoveredLocs = this.discoveredLocations.get(regionName) || new Set();
    const discoveredExits = this.discoveredExits.get(regionName) || new Set();

    for (const loc of contents.locations) {
      if (!discoveredLocs.has(loc)) {
        discoveredLocs.add(loc);
        this.discoveredLocations.set(regionName, discoveredLocs);
        if (this.getUndiscoveredCount(regionName) === 0) {
          this.exploredRegions.add(regionName);
        }
        return { type: 'location', name: loc };
      }
    }
    for (const exit of contents.exits) {
      if (!discoveredExits.has(exit)) {
        discoveredExits.add(exit);
        this.discoveredExits.set(regionName, discoveredExits);
        if (this.getUndiscoveredCount(regionName) === 0) {
          this.exploredRegions.add(regionName);
        }
        return { type: 'exit', name: exit };
      }
    }
    return null;
  }

  snapshot() {
    return {
      currentMana: this.currentMana,
      maxMana: this.maxMana,
      regionXP: new Map(
        [...this.regionXP.entries()].map(([k, v]) => [k, { ...v }])
      ),
      exploredRegions: new Set(this.exploredRegions),
      discoveredLocations: new Map(
        [...this.discoveredLocations.entries()].map(([k, v]) => [k, new Set(v)])
      ),
      discoveredExits: new Map(
        [...this.discoveredExits.entries()].map(([k, v]) => [k, new Set(v)])
      ),
      checkedLocations: new Set(this.checkedLocations),
      assignedRegionCosts: new Map(
        [...this.assignedRegionCosts.entries()].map(([k, v]) => [k, { ...v }])
      ),
      assignedLocationCosts: new Map(this.assignedLocationCosts),
    };
  }

  resetManaToMax() { this.currentMana = this.maxMana; }
  deductMana(amount) { this.currentMana -= amount; }

  getRegionXP(regionName) {
    return this.regionXP.get(regionName) || { xp: 0, level: 0 };
  }

  addXP(regionName, amount) {
    const current = this.getRegionXP(regionName);
    const newXP = current.xp + amount;
    const newLevel = levelFromXP(newXP);
    this.regionXP.set(regionName, { xp: newXP, level: newLevel });
  }

  getRegionCost(regionName) {
    return this.assignedRegionCosts.get(regionName)?.moveCost ?? null;
  }

  getLocationCost(locationName) {
    return this.assignedLocationCosts.get(locationName) ?? null;
  }
}

// =========================================================================
// CostPlanner
// =========================================================================

export class CostPlanner {
  constructor({ stateManager, eventBus }) {
    this.stateManager = stateManager;
    this.eventBus = eventBus || null;

    this._simState = null;
    this._entries = [];
    this._plannedSteps = [];
    this._startRegion = null;
    this._adjacencyMap = null;
    this._isLoaded = false;

    // State machine
    this._currentEntryIndex = 0;
    this._currentEntry = null;
    this._phase = null;               // 'EXPLORE' or 'CHECK'
    this._currentPath = null;
    this._regionsToExplore = [];
    this._currentExploreRegionIdx = 0;
    this._pendingCostAssignments = []; // Cost assignments for next step's reasoning
  }

  loadSphereLog(sphereLog) {
    this._entries = this._extractLocationEntries(sphereLog);
    this._plannedSteps = [];
    this._currentEntryIndex = 0;
    this._currentEntry = null;
    this._phase = null;

    // Get start region from snapshot (proxy doesn't expose getStartRegions)
    const snapshot = this.stateManager.getLatestStateSnapshot?.();
    const startRegions = snapshot?.startRegions || [];
    this._startRegion = (Array.isArray(startRegions) ? startRegions[0] : null)
      || this._getFirstRegion();

    this._adjacencyMap = this._buildStaticAdjacencyMap();

    const staticData = this.stateManager.getStaticData();
    this._simState = new SimulatedState(this._startRegion, 100, staticData);
    this._isLoaded = true;

    return {
      entryCount: this._entries.length,
      startRegion: this._startRegion,
    };
  }

  /**
   * Plan one action queue (one loop). Returns StepReasoning or null if done.
   */
  planNextStep() {
    if (!this._isLoaded) return null;

    // Start a new sphere entry if needed (skip entries with missing locations/paths)
    while (!this._currentEntry) {
      if (this._currentEntryIndex >= this._entries.length) return null;
      this._beginEntry(this._entries[this._currentEntryIndex]);
    }

    let step;
    if (this._phase === 'EXPLORE') {
      step = this._planExploreLoop();
    } else if (this._phase === 'CHECK') {
      step = this._planCheckLoop();
    }

    if (step) {
      this._plannedSteps.push(step);
      this.eventBus?.publish('costDebugger:stepPlanned', {
        step,
        stepIndex: step.stepIndex,
      });
    }

    return step;
  }

  planAll() {
    const newSteps = [];
    let guard = 10000;
    while (guard-- > 0) {
      const step = this.planNextStep();
      if (!step) break;
      newSteps.push(step);
    }

    this.eventBus?.publish('costDebugger:allPlanned', {
      steps: this._plannedSteps,
      total: this._entries.length,
    });

    return newSteps;
  }

  reset() {
    if (!this._isLoaded) return;

    this._plannedSteps = [];
    this._currentEntryIndex = 0;
    this._currentEntry = null;
    this._phase = null;
    this._currentPath = null;
    this._regionsToExplore = [];
    this._pendingCostAssignments = [];

    const staticData = this.stateManager.getStaticData();
    this._simState = new SimulatedState(this._startRegion, 100, staticData);

    this.eventBus?.publish('costDebugger:reset', {});
  }

  getPlannedSteps() { return this._plannedSteps; }
  getCurrentStepIndex() { return this._plannedSteps.length; }
  getTotalEntries() { return this._entries.length; }
  isComplete() { return this._currentEntryIndex >= this._entries.length && !this._currentEntry; }
  isLoaded() { return this._isLoaded; }
  getSimulatedState() { return this._simState?.snapshot() || null; }

  getCostData() {
    if (!this._simState) return null;
    const costs = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      generatedFrom: 'costDebugger',
      regions: {},
      locations: {},
      defaultRegionCost: 10,
      defaultLocationCost: 10,
    };
    for (const [region, data] of this._simState.assignedRegionCosts) {
      costs.regions[region] = { moveCost: data.moveCost };
    }
    for (const [location, cost] of this._simState.assignedLocationCosts) {
      costs.locations[location] = cost;
    }
    return costs;
  }

  // =========================================================================
  // State machine
  // =========================================================================

  _beginEntry(entry) {
    const staticData = this.stateManager.getStaticData();
    const locationData = staticData?.locations?.get(entry.locationName);
    const targetRegion = locationData?.parent_region || locationData?.region || null;
    entry._targetRegion = targetRegion;

    if (!targetRegion) {
      // Skip - location not found
      this._currentEntryIndex++;
      return;
    }

    const pathResult = this._findPath(this._startRegion, targetRegion);
    if (!pathResult) {
      this._currentEntryIndex++;
      return;
    }

    this._currentEntry = entry;
    this._currentPath = pathResult;

    // Get non-start regions in path
    const pathRegions = pathResult.steps
      .map(s => s.region)
      .filter(r => r !== this._startRegion);

    // NOTE: Region costs are NOT assigned here. They are assigned just-in-time
    // during each loop, after path traversal costs are deducted, so the formula
    // uses the actual remaining mana rather than max mana.
    this._pendingCostAssignments = [];

    // Identify regions needing exploration (in path order)
    this._regionsToExplore = pathRegions.filter(r =>
      !this._simState.isRegionFullyExplored(r)
    );
    this._currentExploreRegionIdx = 0;

    this._phase = this._regionsToExplore.length > 0 ? 'EXPLORE' : 'CHECK';
  }

  _advanceToNextEntry() {
    this._currentEntryIndex++;
    this._currentEntry = null;
    this._phase = null;
    this._currentPath = null;
    this._regionsToExplore = [];
    this._pendingCostAssignments = [];
  }

  // =========================================================================
  // Explore loop: discover locations/exits in a region
  // =========================================================================

  _planExploreLoop() {
    const entry = this._currentEntry;
    const exploreRegion = this._regionsToExplore[this._currentExploreRegionIdx];
    const stateBefore = this._simState.snapshot();
    const notes = [];
    const costAssignments = [];

    let manaRemaining = this._simState.currentMana;
    const queue = [];
    const xpGained = {};

    // Traverse path to reach the explore region.
    // Move cost = SOURCE region's moveCost (discounted by source's level).
    const pathSteps = this._currentPath.steps;
    const exploreIdx = pathSteps.findIndex(s => s.region === exploreRegion);

    for (let i = 0; i < exploreIdx; i++) {
      const fromRegion = pathSteps[i].region;
      const toRegion = pathSteps[i + 1].region;

      const regionCost = this._simState.getRegionCost(fromRegion) || 0;
      const regionXP = this._simState.getRegionXP(fromRegion);
      const moveCost = proposedLinearFinalCost(regionCost, regionXP.level);

      queue.push({
        type: 'move', from: fromRegion, to: toRegion,
        exitUsed: pathSteps[i + 1].exitUsed,
        baseCost: regionCost, level: regionXP.level, cost: moveCost,
      });
      manaRemaining -= moveCost;

      if (moveCost > 0) {
        const xp = calculateXPGain('regionMove', moveCost);
        xpGained[fromRegion] = (xpGained[fromRegion] || 0) + xp;
        this._simState.addXP(fromRegion, xp);
      }
    }

    // Assign cost to explore region just-in-time (after traversal costs deducted)
    if (this._simState.getRegionCost(exploreRegion) === null) {
      // Count uncosted regions remaining in the full path (from here onward)
      const fullPathRegions = this._currentPath.steps.map(s => s.region);
      const uncostedRemaining = fullPathRegions.filter(r =>
        r !== this._startRegion && this._simState.getRegionCost(r) === null
      ).length;

      const cost = Math.max(1, Math.floor(manaRemaining / 2 / uncostedRemaining));
      const formula = `max(1, floor(${fmtNum(manaRemaining)} / 2 / ${uncostedRemaining})) = ${cost}`;

      this._simState.assignedRegionCosts.set(exploreRegion, { moveCost: cost });
      costAssignments.push({ type: 'region', name: exploreRegion, cost, formula });
    }

    // Explore actions until mana runs out
    const discoveries = [];
    const regionCost = this._simState.getRegionCost(exploreRegion) || 10;

    while (manaRemaining > 0 && this._simState.getUndiscoveredCount(exploreRegion) > 0) {
      const regionXP = this._simState.getRegionXP(exploreRegion);
      const exploreCost = proposedLinearFinalCost(regionCost * 2, regionXP.level);

      if (manaRemaining < exploreCost) {
        notes.push(`Not enough mana for next explore (need ${fmtNum(exploreCost)}, have ${fmtNum(manaRemaining)})`);
        break;
      }

      const discovered = this._simState.discoverNext(exploreRegion);
      if (!discovered) break;

      queue.push({
        type: 'explore', region: exploreRegion,
        discovered,
        baseCost: regionCost * 2, level: regionXP.level, cost: exploreCost,
      });
      manaRemaining -= exploreCost;
      discoveries.push(discovered);

      const xp = calculateXPGain('customAction', exploreCost);
      xpGained[exploreRegion] = (xpGained[exploreRegion] || 0) + xp;
      this._simState.addXP(exploreRegion, xp);
    }

    if (discoveries.length === 0) {
      notes.push('No explores completed - path traversal consumed all available mana');
    }

    const manaConsumed = stateBefore.currentMana - manaRemaining;

    // Explore progress
    const discoveredCount = this._simState.getDiscoveredCount(exploreRegion);
    const totalDiscoverables = this._simState.getTotalDiscoverables(exploreRegion);

    // Check if region is fully explored
    if (this._simState.isRegionFullyExplored(exploreRegion)) {
      notes.push(`${exploreRegion} fully explored! (${totalDiscoverables}/${totalDiscoverables})`);
      this._currentExploreRegionIdx++;

      if (this._currentExploreRegionIdx >= this._regionsToExplore.length) {
        this._phase = 'CHECK';
        notes.push('All regions in path explored. Ready for location check.');
      }
    } else {
      notes.push(`${exploreRegion}: ${discoveredCount}/${totalDiscoverables} discovered`);
    }

    // Reset mana for next loop
    this._simState.resetManaToMax();

    return {
      stepIndex: this._plannedSteps.length,
      sphereIndex: entry.sphereIndex,
      sphereEntryIndex: this._currentEntryIndex,
      phase: 'EXPLORE',
      locationName: entry.locationName,
      targetRegion: exploreRegion,
      stateBefore,
      path: {
        from: this._startRegion,
        to: exploreRegion,
        steps: pathSteps.slice(0, exploreIdx + 1),
      },
      costAssignments,
      queue,
      discoveries,
      exploreProgress: {
        discovered: discoveredCount,
        total: totalDiscoverables,
        remaining: totalDiscoverables - discoveredCount,
      },
      simulatedResults: {
        manaConsumed,
        manaRemaining,
        xpGained,
      },
      stateAfter: this._simState.snapshot(),
      notes,
    };
  }

  // =========================================================================
  // Check loop: move to location and check it
  // =========================================================================

  _planCheckLoop() {
    const entry = this._currentEntry;
    const targetRegion = entry._targetRegion;
    const stateBefore = this._simState.snapshot();
    const notes = [];
    const costAssignments = [];

    let manaRemaining = this._simState.currentMana;
    const queue = [];
    const xpGained = {};

    // Traverse path to target region.
    // Move cost = SOURCE region's moveCost.
    const pathSteps = this._currentPath.steps;
    for (let i = 0; i < pathSteps.length - 1; i++) {
      const fromRegion = pathSteps[i].region;
      const toRegion = pathSteps[i + 1].region;

      const regionCost = this._simState.getRegionCost(fromRegion) || 0;
      const regionXP = this._simState.getRegionXP(fromRegion);
      const moveCost = proposedLinearFinalCost(regionCost, regionXP.level);

      queue.push({
        type: 'move', from: fromRegion, to: toRegion,
        exitUsed: pathSteps[i + 1].exitUsed,
        baseCost: regionCost, level: regionXP.level, cost: moveCost,
      });
      manaRemaining -= moveCost;

      if (moveCost > 0) {
        const xp = calculateXPGain('regionMove', moveCost);
        xpGained[fromRegion] = (xpGained[fromRegion] || 0) + xp;
        this._simState.addXP(fromRegion, xp);
      }
    }

    // Assign location cost after traversal = floor(remaining mana)
    const locationCost = Math.max(1, Math.floor(manaRemaining));
    const locationFormula = `max(1, floor(${fmtNum(manaRemaining)})) = ${locationCost}`;
    this._simState.assignedLocationCosts.set(entry.locationName, locationCost);
    costAssignments.push({
      type: 'location', name: entry.locationName,
      cost: locationCost, formula: locationFormula,
    });

    // Check location
    const regionXP = this._simState.getRegionXP(targetRegion);
    const checkCost = proposedLinearFinalCost(locationCost, regionXP.level);

    queue.push({
      type: 'locationCheck',
      location: entry.locationName, region: targetRegion,
      baseCost: locationCost, level: regionXP.level, cost: checkCost,
    });
    manaRemaining -= checkCost;

    const locXP = calculateXPGain('locationCheck', checkCost);
    xpGained[targetRegion] = (xpGained[targetRegion] || 0) + locXP;
    this._simState.addXP(targetRegion, locXP);

    const manaConsumed = stateBefore.currentMana - manaRemaining;

    if (manaRemaining < 0) {
      notes.push(`Mana deficit: ${fmtNum(Math.abs(manaRemaining))} (consumed ${fmtNum(manaConsumed)} with ${fmtNum(stateBefore.currentMana)} available)`);
    }

    this._simState.checkedLocations.add(entry.locationName);
    this._simState.resetManaToMax();

    // Advance to next sphere entry
    this._advanceToNextEntry();

    return {
      stepIndex: this._plannedSteps.length,
      sphereIndex: entry.sphereIndex,
      sphereEntryIndex: this._currentEntryIndex - 1,
      phase: 'CHECK',
      locationName: entry.locationName,
      targetRegion,
      stateBefore,
      path: {
        from: this._startRegion,
        to: targetRegion,
        steps: pathSteps,
      },
      costAssignments,
      queue,
      simulatedResults: {
        manaConsumed,
        manaRemaining,
        xpGained,
      },
      stateAfter: this._simState.snapshot(),
      notes,
    };
  }

  // =========================================================================
  // Sphere log parsing
  // =========================================================================

  _extractLocationEntries(sphereLog) {
    const entries = [];

    for (const logEntry of sphereLog) {
      if (logEntry.type !== 'state_update') continue;

      const playerData = logEntry.player_data?.['1'];
      if (!playerData) continue;

      const sphereLocations = playerData.sphere_locations || [];
      const newRegions = playerData.new_accessible_regions || [];

      for (const locationName of sphereLocations) {
        entries.push({
          sphereIndex: logEntry.sphere_index,
          locationName,
          newAccessibleRegions: newRegions,
        });
      }
    }

    return entries;
  }

  // =========================================================================
  // Pathfinding (simplified BFS on static topology)
  // =========================================================================

  _buildStaticAdjacencyMap() {
    const staticData = this.stateManager.getStaticData();
    if (!staticData?.regions) return new Map();

    const adjacency = new Map();
    for (const regionName of staticData.regions.keys()) {
      adjacency.set(regionName, []);
    }

    for (const [regionName, regionData] of staticData.regions.entries()) {
      if (!regionData.exits) continue;
      for (const exit of regionData.exits) {
        const target = exit.connected_region;
        if (!adjacency.has(target)) {
          adjacency.set(target, []);
        }
        adjacency.get(regionName).push({
          region: target,
          exitName: exit.name || exit.exit_name || `${regionName} -> ${target}`,
        });
      }
    }

    return adjacency;
  }

  _findPath(from, to) {
    if (!this._adjacencyMap) return null;
    if (from === to) {
      return { steps: [{ region: from, exitUsed: null }], length: 0 };
    }

    const queue = [{ region: from, path: [{ region: from, exitUsed: null }] }];
    const visited = new Set([from]);

    while (queue.length > 0) {
      const { region, path } = queue.shift();
      const neighbors = this._adjacencyMap.get(region) || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor.region)) continue;
        visited.add(neighbor.region);

        const newPath = [...path, { region: neighbor.region, exitUsed: neighbor.exitName }];

        if (neighbor.region === to) {
          return { steps: newPath, length: newPath.length - 1 };
        }

        queue.push({ region: neighbor.region, path: newPath });
      }
    }

    return null;
  }

  _getFirstRegion() {
    const staticData = this.stateManager.getStaticData();
    if (staticData?.regions?.size > 0) {
      return staticData.regions.keys().next().value;
    }
    return null;
  }
}

function fmtNum(n) {
  if (n === null || n === undefined) return '?';
  return Number(n).toFixed(1);
}

export default CostPlanner;
