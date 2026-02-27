/**
 * ProofGraphState — manages the graph construction puzzle for MetaMath Medium mode.
 *
 * The player sees all proof step nodes but no edges. They must draw edges
 * between nodes to reconstruct the dependency graph. Correct edges stick;
 * incorrect edges are rejected. When all incoming dependency edges for a
 * step are correctly drawn, the step's location check becomes available.
 */

export class ProofGraphState {
  constructor() {
    /** @type {Map<number, ProofStep>} All proof steps keyed by index */
    this.steps = new Map();

    /**
     * Correct dependency edges in the proof.
     * Key: "source->target" (e.g. "1->3" means step 1 is a dependency of step 3)
     * Value: { source: number, target: number }
     * @type {Map<string, {source: number, target: number}>}
     */
    this.correctEdges = new Map();

    /**
     * Edges the player has successfully drawn.
     * Same key format as correctEdges.
     * @type {Set<string>}
     */
    this.drawnEdges = new Set();

    /** @type {Set<string>} Item names currently in inventory */
    this.receivedItems = new Set();

    /** @type {Set<string>} Location names already checked */
    this.checkedLocations = new Set();

    /** @type {Map<string, string>} Generic name → display name */
    this.nameSubstitutions = new Map();

    /** @type {string|null} */
    this.theoremName = null;

    /** @type {number|null} */
    this.goalStepIndex = null;

    /** @type {boolean} */
    this.isLoaded = false;

    /** @type {number} Total number of incorrect edge attempts */
    this.incorrectAttempts = 0;

    // ─── Callbacks ────────────────────────────────────────
    /** @type {Function|null} Called when an edge is correctly drawn */
    this.onEdgeDrawn = null;
    /** @type {Function|null} Called when an edge attempt is rejected */
    this.onEdgeRejected = null;
    /** @type {Function|null} Called when a step becomes fully connected */
    this.onStepCompleted = null;
    /** @type {Function|null} Called when puzzle state changes */
    this.onStateChanged = null;
  }

  // ─── Data Loading ──────────────────────────────────────────

  /**
   * Load proof structure from rules.json slot_data.
   * @param {Object} slotData
   * @param {Object} [nameSubstitutions]
   */
  loadFromSlotData(slotData, nameSubstitutions) {
    this.steps.clear();
    this.correctEdges.clear();
    this.drawnEdges.clear();
    this.receivedItems.clear();
    this.checkedLocations.clear();
    this.nameSubstitutions.clear();
    this.incorrectAttempts = 0;

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

    // Detect naming scheme: if name_substitutions has item entries, the game
    // uses generic "Statement N" / "Prove Statement N" names with substitutions.
    // Otherwise (worldgen), items/locations use "label: expression" directly.
    const useGenericNames = this.nameSubstitutions.size > 0;

    // Parse statements and build edge map
    let maxIndex = 0;
    for (const [indexStr, stmt] of Object.entries(proofStructure)) {
      const index = parseInt(indexStr, 10);
      if (isNaN(index)) continue;

      const label = stmt.label || `stmt_${index}`;
      const expression = stmt.expression || '';
      const directName = `${label}: ${expression}`;

      const itemName = useGenericNames ? `Statement ${index}` : directName;
      const locationName = useGenericNames ? `Prove Statement ${index}` : `Prove ${directName}`;

      this.steps.set(index, {
        index,
        label,
        expression,
        dependencies: Array.isArray(stmt.dependencies) ? [...stmt.dependencies] : [],
        fullText: stmt.full_text || null,
        itemName,
        locationName,
        displayName: this.nameSubstitutions.get(itemName) || directName,
      });

      // Build correct edges: dependency -> this step
      if (Array.isArray(stmt.dependencies)) {
        for (const dep of stmt.dependencies) {
          const edgeKey = `${dep}->${index}`;
          this.correctEdges.set(edgeKey, { source: dep, target: index });
        }
      }

      if (index > maxIndex) maxIndex = index;
    }

    this.goalStepIndex = maxIndex;

    // Starting statements — these are already received and checked
    if (Array.isArray(slotData.starting_statements)) {
      for (const idx of slotData.starting_statements) {
        const startStep = this.steps.get(idx);
        if (startStep) {
          this.receivedItems.add(startStep.itemName);
          this.checkedLocations.add(startStep.locationName);
        }
      }
    }

    this.isLoaded = true;
    return true;
  }

  // ─── Edge Drawing ─────────────────────────────────────────

  /**
   * Attempt to draw an edge from source to target.
   * An edge is correct if `source` is a dependency of `target` in the proof.
   *
   * @param {number} sourceIndex - The dependency step
   * @param {number} targetIndex - The step that depends on source
   * @returns {{success: boolean, reason?: string}}
   */
  tryDrawEdge(sourceIndex, targetIndex) {
    // Can't draw self-loops
    if (sourceIndex === targetIndex) {
      return { success: false, reason: 'self-loop' };
    }

    // Both steps must exist
    if (!this.steps.has(sourceIndex) || !this.steps.has(targetIndex)) {
      return { success: false, reason: 'invalid-step' };
    }

    const edgeKey = `${sourceIndex}->${targetIndex}`;

    // Already drawn?
    if (this.drawnEdges.has(edgeKey)) {
      return { success: false, reason: 'already-drawn' };
    }

    // Is this a correct dependency edge?
    if (this.correctEdges.has(edgeKey)) {
      this.drawnEdges.add(edgeKey);

      if (this.onEdgeDrawn) {
        this.onEdgeDrawn(sourceIndex, targetIndex);
      }

      // Check if target step is now fully connected
      if (this._isStepFullyConnected(targetIndex)) {
        if (this.onStepCompleted) {
          this.onStepCompleted(targetIndex);
        }
      }

      if (this.onStateChanged) this.onStateChanged();
      return { success: true };
    }

    // Wrong edge
    this.incorrectAttempts++;
    if (this.onEdgeRejected) {
      this.onEdgeRejected(sourceIndex, targetIndex);
    }
    return { success: false, reason: 'incorrect' };
  }

  // ─── Query Methods ────────────────────────────────────────

  /**
   * Check if all incoming dependency edges for a step have been drawn.
   * Steps with no dependencies are always fully connected.
   */
  _isStepFullyConnected(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return false;
    if (step.dependencies.length === 0) return true;

    return step.dependencies.every(dep => {
      const edgeKey = `${dep}->${stepIndex}`;
      return this.drawnEdges.has(edgeKey);
    });
  }

  /**
   * Check if a step's location is checkable.
   * A step is checkable if:
   *   - All its dependency edges have been correctly drawn
   *   - Its location hasn't been checked yet
   */
  isStepCheckable(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return false;
    if (this.checkedLocations.has(step.locationName)) return false;
    return this._isStepFullyConnected(stepIndex);
  }

  /**
   * Get all steps that have no dependencies (axioms/definitions).
   * These are automatically "complete" from the start.
   */
  getAxiomSteps() {
    return [...this.steps.values()].filter(s => s.dependencies.length === 0);
  }

  /**
   * Get the number of correct edges still needed.
   */
  getRemainingEdgeCount() {
    return this.correctEdges.size - this.drawnEdges.size;
  }

  /**
   * Get the total number of correct edges.
   */
  getTotalEdgeCount() {
    return this.correctEdges.size;
  }

  /**
   * Check if all edges have been drawn.
   */
  isAllEdgesDrawn() {
    return this.drawnEdges.size === this.correctEdges.size;
  }

  /**
   * Check if the proof is complete (goal location checked).
   */
  isProofComplete() {
    if (!this.goalStepIndex) return false;
    const goalStep = this.steps.get(this.goalStepIndex);
    if (!goalStep) return false;
    return this.checkedLocations.has(goalStep.locationName);
  }

  /**
   * Get edges already drawn for a specific target step.
   * @returns {number[]} Source indices of drawn incoming edges
   */
  getDrawnDependenciesFor(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return [];
    return step.dependencies.filter(dep => {
      return this.drawnEdges.has(`${dep}->${stepIndex}`);
    });
  }

  /**
   * Get the count of missing edges for a step.
   */
  getMissingEdgeCount(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return 0;
    return step.dependencies.length - this.getDrawnDependenciesFor(stepIndex).length;
  }

  // ─── Inventory / Location State ────────────────────────────

  /** Mark an item as received. */
  receiveItem(itemName) {
    this.receivedItems.add(itemName);
  }

  /** Mark a location as checked. */
  checkLocation(locationName) {
    this.checkedLocations.add(locationName);
  }

  /** Sync full inventory. */
  syncInventory(inventoryMap) {
    if (!inventoryMap) return;
    for (const [itemName, count] of Object.entries(inventoryMap)) {
      if (count > 0) this.receivedItems.add(itemName);
    }
  }

  /** Sync checked locations. */
  syncLocations(checkedArray) {
    if (!checkedArray) return;
    for (const loc of checkedArray) {
      this.checkedLocations.add(loc);
    }
  }
}
