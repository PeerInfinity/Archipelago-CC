/**
 * ProofQueueState — manages the proof step ordering queue for MetaMath Easy mode.
 *
 * Responsibilities:
 *   - Extract proof structure from rules.json slot_data
 *   - Track which steps are available (received as Archipelago items)
 *   - Maintain the player's ordered queue of proof steps
 *   - Validate that each step's dependencies appear earlier in the queue
 *   - Determine which location checks can be awarded
 */

/**
 * @typedef {Object} ProofStep
 *   @property {number}   index        - 1-based statement index
 *   @property {string}   label        - Short theorem/axiom name (e.g. "2cn")
 *   @property {string}   expression   - Mathematical expression (e.g. "|- 2 e. CC")
 *   @property {number[]} dependencies - Indices of statements this depends on
 *   @property {string}   [fullText]   - Full description text
 *   @property {string}   itemName     - Archipelago item name ("Statement 1")
 *   @property {string}   locationName - Archipelago location name ("Prove Statement 1")
 *   @property {string}   displayName  - Human-readable display name
 */

export class ProofQueueState {
  constructor() {
    /** @type {Map<number, ProofStep>} All proof steps keyed by index */
    this.steps = new Map();

    /** @type {number[]} Ordered queue of step indices (the player's arrangement) */
    this.queue = [];

    /** @type {Set<number>} Steps available to place (item received or no-dep starting step) */
    this.availableSteps = new Set();

    /** @type {Set<string>} Item names currently in inventory (Archipelago items received) */
    this.receivedItems = new Set();

    /** @type {Set<string>} Location names already checked */
    this.checkedLocations = new Set();

    /** @type {Map<string, string>} Generic name → display name substitutions */
    this.nameSubstitutions = new Map();

    /** @type {string|null} The theorem being proved */
    this.theoremName = null;

    /** @type {number|null} The final goal step index */
    this.goalStepIndex = null;

    /** @type {boolean} Whether proof structure data has been loaded */
    this.isLoaded = false;

    /** @type {Function|null} Callback when queue changes */
    this.onQueueChanged = null;

    /** @type {Function|null} Callback when available steps change */
    this.onAvailableChanged = null;
  }

  // ─── Data Loading ──────────────────────────────────────────

  /**
   * Load proof structure from rules.json slot_data.
   * @param {Object} slotData - The slot_data object from rules.json
   * @param {Object} nameSubstitutions - The name_substitutions object from rules.json
   */
  loadFromSlotData(slotData, nameSubstitutions) {
    this.steps.clear();
    this.queue = [];
    this.availableSteps.clear();
    this.receivedItems.clear();
    this.checkedLocations.clear();
    this.nameSubstitutions.clear();

    if (!slotData?.proof_structure) {
      this.isLoaded = false;
      return false;
    }

    const proofStructure = slotData.proof_structure;
    this.theoremName = slotData.theorem || null;

    // Build name substitution map
    if (nameSubstitutions?.items) {
      for (const [generic, display] of Object.entries(nameSubstitutions.items)) {
        this.nameSubstitutions.set(generic, display);
      }
    }
    if (nameSubstitutions?.locations) {
      for (const [generic, display] of Object.entries(nameSubstitutions.locations)) {
        this.nameSubstitutions.set(generic, display);
      }
    }

    // Detect naming scheme: if name_substitutions has item entries, the game
    // uses generic "Statement N" / "Prove Statement N" names with substitutions.
    // Otherwise (worldgen), items/locations use "label: expression" directly.
    const useGenericNames = this.nameSubstitutions.size > 0;

    // Parse each statement into a ProofStep
    let maxIndex = 0;
    for (const [indexStr, stmt] of Object.entries(proofStructure)) {
      const index = parseInt(indexStr, 10);
      if (isNaN(index)) continue;

      const label = stmt.label || `stmt_${index}`;
      const expression = stmt.expression || '';
      const directName = `${label}: ${expression}`;

      const itemName = useGenericNames ? `Statement ${index}` : directName;
      const locationName = useGenericNames ? `Prove Statement ${index}` : `Prove ${directName}`;

      const step = {
        index,
        label,
        expression,
        dependencies: Array.isArray(stmt.dependencies) ? [...stmt.dependencies] : [],
        fullText: stmt.full_text || null,
        itemName,
        locationName,
        displayName: this.nameSubstitutions.get(itemName) || directName,
      };

      this.steps.set(index, step);
      if (index > maxIndex) maxIndex = index;
    }

    // The goal is the highest-indexed step (the final theorem)
    this.goalStepIndex = maxIndex;

    // Starting statements are available immediately and already proved
    // (they have no corresponding location to check)
    if (Array.isArray(slotData.starting_statements)) {
      for (const idx of slotData.starting_statements) {
        const startStep = this.steps.get(idx);
        if (startStep) {
          this.receivedItems.add(startStep.itemName);
          this.checkedLocations.add(startStep.locationName);
        }
      }
    }

    // Steps with no dependencies are always available to place
    this._updateAvailableSteps();

    this.isLoaded = true;
    return true;
  }

  // ─── Queue Operations ─────────────────────────────────────

  /**
   * Add a step to the end of the queue.
   * @param {number} stepIndex
   * @returns {boolean} Whether the step was added
   */
  addToQueue(stepIndex) {
    if (!this.steps.has(stepIndex)) return false;
    if (this.queue.includes(stepIndex)) return false;
    // Step must be available (item received or no-dep axiom)
    if (!this.availableSteps.has(stepIndex)) return false;

    this.queue.push(stepIndex);
    this._notifyQueueChanged();
    return true;
  }

  /**
   * Remove a step from the queue and return it to the available pool.
   * Only allowed if the step's location hasn't been checked yet.
   * @param {number} stepIndex
   * @returns {boolean}
   */
  removeFromQueue(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return false;
    // Can't remove already-checked steps
    if (this.checkedLocations.has(step.locationName)) return false;

    const idx = this.queue.indexOf(stepIndex);
    if (idx === -1) return false;

    this.queue.splice(idx, 1);
    this._notifyQueueChanged();
    return true;
  }

  /**
   * Move a step within the queue.
   * Only non-checked steps can be moved.
   * @param {number} fromIdx - Queue array index (not step index)
   * @param {number} toIdx - Queue array index (not step index)
   * @returns {boolean}
   */
  moveInQueue(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= this.queue.length) return false;
    if (toIdx < 0 || toIdx >= this.queue.length) return false;
    if (fromIdx === toIdx) return false;

    const stepIndex = this.queue[fromIdx];
    const step = this.steps.get(stepIndex);
    if (!step) return false;
    // Can't move already-checked steps
    if (this.checkedLocations.has(step.locationName)) return false;

    // Remove and reinsert
    this.queue.splice(fromIdx, 1);
    this.queue.splice(toIdx, 0, stepIndex);
    this._notifyQueueChanged();
    return true;
  }

  /**
   * Add all available steps to the queue in dependency-respecting order.
   * Steps already in queue are skipped.
   */
  autoFillQueue() {
    // Topological sort of available steps not yet in queue
    const toAdd = [...this.availableSteps].filter(idx => !this.queue.includes(idx));
    const sorted = this._topologicalSort(toAdd);
    for (const idx of sorted) {
      this.queue.push(idx);
    }
    if (sorted.length > 0) {
      this._notifyQueueChanged();
    }
  }

  /**
   * Clear all non-checked steps from the queue.
   */
  clearUncheckedFromQueue() {
    this.queue = this.queue.filter(idx => {
      const step = this.steps.get(idx);
      return step && this.checkedLocations.has(step.locationName);
    });
    this._notifyQueueChanged();
  }

  // ─── Validation ───────────────────────────────────────────

  /**
   * Validate the queue and return status for each position.
   * A step is "valid" if all its dependencies appear earlier in the queue.
   * A step is "checkable" if it's valid AND its location hasn't been checked yet.
   * @returns {Array<{stepIndex: number, valid: boolean, checkable: boolean, missingDeps: number[]}>}
   */
  validateQueue() {
    const result = [];
    const seenInQueue = new Set();

    for (let i = 0; i < this.queue.length; i++) {
      const stepIndex = this.queue[i];
      const step = this.steps.get(stepIndex);
      if (!step) continue;

      const missingDeps = step.dependencies.filter(dep => !seenInQueue.has(dep));
      const valid = missingDeps.length === 0;
      const alreadyChecked = this.checkedLocations.has(step.locationName);
      const checkable = valid && !alreadyChecked;

      result.push({ stepIndex, valid, checkable, missingDeps, alreadyChecked });
      seenInQueue.add(stepIndex);
    }

    return result;
  }

  /**
   * Get the next checkable step in the queue (first valid unchecked step).
   * @returns {number|null} Step index, or null if none
   */
  getNextCheckableStep() {
    const validation = this.validateQueue();
    for (const entry of validation) {
      if (entry.checkable) return entry.stepIndex;
    }
    return null;
  }

  /**
   * Check if the proof is complete (goal location checked).
   * @returns {boolean}
   */
  isProofComplete() {
    if (!this.goalStepIndex) return false;
    const goalStep = this.steps.get(this.goalStepIndex);
    if (!goalStep) return false;
    return this.checkedLocations.has(goalStep.locationName);
  }

  // ─── Inventory / Location State ────────────────────────────

  /**
   * Mark an item as received (updates available steps).
   * @param {string} itemName - e.g. "Statement 3"
   */
  receiveItem(itemName) {
    if (this.receivedItems.has(itemName)) return;
    this.receivedItems.add(itemName);
    this._updateAvailableSteps();
  }

  /**
   * Mark a location as checked.
   * @param {string} locationName - e.g. "Prove Statement 3"
   */
  checkLocation(locationName) {
    this.checkedLocations.add(locationName);
  }

  /**
   * Sync full inventory state from stateManager snapshot.
   * @param {Object} inventoryMap - Map of item names to counts
   */
  syncInventory(inventoryMap) {
    if (!inventoryMap) return;
    let changed = false;
    for (const [itemName, count] of Object.entries(inventoryMap)) {
      if (count > 0 && !this.receivedItems.has(itemName)) {
        this.receivedItems.add(itemName);
        changed = true;
      }
    }
    if (changed) {
      this._updateAvailableSteps();
    }
  }

  /**
   * Sync checked locations from stateManager snapshot.
   * @param {Object} locationsMap - Map of location names to checked status
   */
  syncLocations(locationsMap) {
    if (!locationsMap) return;
    for (const [locName, checked] of Object.entries(locationsMap)) {
      if (checked) {
        this.checkedLocations.add(locName);
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Get display name for a step.
   * @param {number} stepIndex
   * @returns {string}
   */
  getStepDisplayName(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return `Step ${stepIndex}`;
    return step.displayName;
  }

  /**
   * Get the step for a given item name.
   * @param {string} itemName - e.g. "Statement 3"
   * @returns {ProofStep|null}
   */
  getStepByItemName(itemName) {
    for (const step of this.steps.values()) {
      if (step.itemName === itemName) return step;
    }
    return null;
  }

  /**
   * Get steps not yet placed in the queue (available pool).
   * @returns {ProofStep[]}
   */
  getUnplacedSteps() {
    const inQueue = new Set(this.queue);
    return [...this.availableSteps]
      .filter(idx => !inQueue.has(idx))
      .map(idx => this.steps.get(idx))
      .filter(Boolean);
  }

  /**
   * Get all steps in the queue with their validation status.
   * @returns {Array<{step: ProofStep, valid: boolean, checkable: boolean, missingDeps: number[], alreadyChecked: boolean}>}
   */
  getQueueWithStatus() {
    const validation = this.validateQueue();
    return validation.map(entry => ({
      step: this.steps.get(entry.stepIndex),
      ...entry,
    }));
  }

  // ─── Private ──────────────────────────────────────────────

  /**
   * Recalculate which steps are available to place.
   * A step is available if:
   *   - It has no dependencies (axiom/definition), OR
   *   - All its dependency items have been received
   */
  _updateAvailableSteps() {
    const prev = new Set(this.availableSteps);
    this.availableSteps.clear();

    for (const [index, step] of this.steps) {
      if (step.dependencies.length === 0) {
        // Axioms/definitions are always available
        this.availableSteps.add(index);
      } else {
        // Check if all dependency items have been received
        const allDepsReceived = step.dependencies.every(depIdx => {
          const depStep = this.steps.get(depIdx);
          return depStep && this.receivedItems.has(depStep.itemName);
        });
        if (allDepsReceived) {
          this.availableSteps.add(index);
        }
      }
    }

    // Notify if changed
    const changed = this.availableSteps.size !== prev.size ||
      [...this.availableSteps].some(idx => !prev.has(idx));
    if (changed && this.onAvailableChanged) {
      this.onAvailableChanged();
    }
  }

  /**
   * Topological sort of step indices, respecting dependencies.
   * @param {number[]} indices
   * @returns {number[]}
   */
  _topologicalSort(indices) {
    const indexSet = new Set(indices);
    const visited = new Set();
    const result = [];

    const visit = (idx) => {
      if (visited.has(idx)) return;
      visited.add(idx);
      const step = this.steps.get(idx);
      if (step) {
        for (const dep of step.dependencies) {
          if (indexSet.has(dep)) {
            visit(dep);
          }
        }
      }
      result.push(idx);
    };

    for (const idx of indices) {
      visit(idx);
    }

    return result;
  }

  /** @private */
  _notifyQueueChanged() {
    if (this.onQueueChanged) {
      this.onQueueChanged();
    }
  }
}
