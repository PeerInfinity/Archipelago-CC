/**
 * ProofGraphState — manages the graph construction puzzle for MetaMath Medium mode.
 *
 * Extends ProofBaseState with edge-drawing mechanics:
 *   - The player sees all proof step nodes but no edges
 *   - They must draw edges between nodes to reconstruct the dependency graph
 *   - Correct edges stick; incorrect edges are rejected
 *   - When all incoming dependency edges for a step are correctly drawn,
 *     the step's location check becomes available
 */

import { ProofBaseState } from '../proofShared/proofBaseState.js';

export class ProofGraphState extends ProofBaseState {
  constructor() {
    super();

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
    this.correctEdges.clear();
    this.drawnEdges.clear();
    this.incorrectAttempts = 0;

    const success = this._parseProofStructure(slotData, nameSubstitutions);
    if (!success) return false;

    // Build correct edges from parsed step dependencies
    for (const [index, step] of this.steps) {
      for (const dep of step.dependencies) {
        const edgeKey = `${dep}->${index}`;
        this.correctEdges.set(edgeKey, { source: dep, target: index });
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
   *   - All dependency items have been received
   *   - All dependency locations have been checked (proved)
   *   - Its location hasn't been checked yet
   */
  isStepCheckable(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return false;
    if (this.checkedLocations.has(step.locationName)) return false;
    if (!this._isStepFullyConnected(stepIndex)) return false;

    // Also require all dependency items received and locations checked
    return step.dependencies.every(depIdx => {
      const depStep = this.steps.get(depIdx);
      return depStep &&
        this.receivedItems.has(depStep.itemName) &&
        this.checkedLocations.has(depStep.locationName);
    });
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
}
