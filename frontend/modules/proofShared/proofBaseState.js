/**
 * ProofBaseState — shared base class for all proof module states.
 *
 * Provides common functionality:
 *   - Proof structure parsing from slot_data
 *   - Name substitution handling (generic ↔ display names)
 *   - Inventory and location sync
 *   - Proof completion check
 *   - Step lookup helpers
 *
 * Subclasses: ProofQueueBaseState, ProofGraphState
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

export class ProofBaseState {
  constructor() {
    /** @type {Map<number, ProofStep>} All proof steps keyed by index */
    this.steps = new Map();

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
  }

  // ─── Proof Structure Parsing ──────────────────────────────

  /**
   * Parse proof structure from slot_data into this.steps and related fields.
   * Called by subclass loadFromSlotData() implementations.
   *
   * @param {Object} slotData - The slot_data object from rules.json
   * @param {Object} [nameSubstitutions] - The name_substitutions object from rules.json
   * @returns {boolean} Whether parsing succeeded
   * @protected
   */
  _parseProofStructure(slotData, nameSubstitutions) {
    this.steps.clear();
    this.receivedItems.clear();
    this.checkedLocations.clear();
    this.nameSubstitutions.clear();

    if (!slotData?.proof_structure) {
      this.isLoaded = false;
      return false;
    }

    const proofStructure = slotData.proof_structure;
    this.theoremName = slotData.theorem || null;

    // Build name substitution map (both items and locations)
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

      // Allow subclasses to augment the step before insertion
      this._augmentStep(step, stmt);

      this.steps.set(index, step);
      if (index > maxIndex) maxIndex = index;
    }

    // The goal is the highest-indexed step (the final theorem)
    this.goalStepIndex = maxIndex;

    // Starting statements are available immediately and already proved
    if (Array.isArray(slotData.starting_statements)) {
      for (const idx of slotData.starting_statements) {
        const startStep = this.steps.get(idx);
        if (startStep) {
          this.receivedItems.add(startStep.itemName);
          this.checkedLocations.add(startStep.locationName);
        }
      }
    }

    return true;
  }

  /**
   * Hook for subclasses to augment a step during parsing.
   * Called for each step before it is added to this.steps.
   * @param {ProofStep} step - The step being built (mutable)
   * @param {Object} _rawStmt - The raw statement from proof_structure
   * @protected
   */
  _augmentStep(step, _rawStmt) {
    // Default: no augmentation. Override in subclasses.
  }

  // ─── Inventory / Location State ────────────────────────────

  /**
   * Mark an item as received.
   * @param {string} itemName - e.g. "Statement 3"
   */
  receiveItem(itemName) {
    if (this.receivedItems.has(itemName)) return;
    this.receivedItems.add(itemName);
    this._onInventoryChanged();
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
      this._onInventoryChanged();
    }
  }

  /**
   * Sync checked locations from stateManager snapshot.
   * @param {Array<string>} checkedArray - Array of checked location names
   */
  syncLocations(checkedArray) {
    if (!checkedArray) return;
    for (const loc of checkedArray) {
      this.checkedLocations.add(loc);
    }
  }

  /**
   * Hook called when inventory changes. Override in subclasses.
   * @protected
   */
  _onInventoryChanged() {
    // Default: no-op. ProofQueueBaseState overrides to update available steps.
  }

  // ─── Query Helpers ──────────────────────────────────────────

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
}
