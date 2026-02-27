/**
 * ProofEntryState — manages the proof entry puzzle for MetaMath Hard mode.
 *
 * Like ProofQueueState (Easy mode), but steps are NOT shown upfront.
 * The player must type a theorem label or expression to "discover" each step.
 * Matching uses multiple strategies:
 *   1. Exact label match (case-insensitive)
 *   2. Token-normalized expression match
 *   3. Structural unification — metavariable template matching
 *      e.g. "|- ( ( A + B ) + C ) = ( A + ( B + C ) )" matches
 *           "|- ( ( 2 + 2 ) + 1 ) = ( 2 + ( 2 + 1 ) )"
 *      with consistent binding A=2, B=2, C=1
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
 *   @property {string[]} exprTokens   - Tokenized expression for matching
 */

export class ProofEntryState {
  constructor() {
    /** @type {Map<number, ProofStep>} All proof steps keyed by index */
    this.steps = new Map();

    /** @type {number[]} Ordered queue of step indices */
    this.queue = [];

    /** @type {Set<number>} Steps that have been discovered (typed correctly) */
    this.discoveredSteps = new Set();

    /** @type {Set<number>} Steps available (item received or axiom) */
    this.availableSteps = new Set();

    /** @type {Set<string>} Item names currently in inventory */
    this.receivedItems = new Set();

    /** @type {Set<string>} Location names already checked */
    this.checkedLocations = new Set();

    /** @type {Map<string, string>} Generic name -> display name */
    this.nameSubstitutions = new Map();

    /** @type {string|null} */
    this.theoremName = null;

    /** @type {number|null} */
    this.goalStepIndex = null;

    /** @type {boolean} */
    this.isLoaded = false;

    /** @type {number} Total failed match attempts */
    this.failedAttempts = 0;

    // ─── Lookup indices for fast matching ────────────────
    /** @type {Map<string, number>} Lowercase label -> step index */
    this._labelIndex = new Map();
    /** @type {Map<string, number>} Normalized expression string -> step index */
    this._exprIndex = new Map();

    // ─── Callbacks ────────────────────────────────────────
    /** @type {Function|null} Called when queue changes */
    this.onQueueChanged = null;
    /** @type {Function|null} Called when a step is discovered */
    this.onStepDiscovered = null;
    /** @type {Function|null} Called when a match attempt fails */
    this.onMatchFailed = null;
    /** @type {Function|null} Called when available steps change */
    this.onAvailableChanged = null;
  }

  // ─── Data Loading ──────────────────────────────────────────

  /**
   * Load proof structure from rules.json slot_data.
   * @param {Object} slotData
   * @param {Object} [nameSubstitutions]
   */
  loadFromSlotData(slotData, nameSubstitutions) {
    this.steps.clear();
    this.queue = [];
    this.discoveredSteps.clear();
    this.availableSteps.clear();
    this.receivedItems.clear();
    this.checkedLocations.clear();
    this.nameSubstitutions.clear();
    this._labelIndex.clear();
    this._exprIndex.clear();
    this.failedAttempts = 0;

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

    // Parse each statement
    let maxIndex = 0;
    for (const [indexStr, stmt] of Object.entries(proofStructure)) {
      const index = parseInt(indexStr, 10);
      if (isNaN(index)) continue;

      const label = stmt.label || `stmt_${index}`;
      const expression = stmt.expression || '';
      const directName = `${label}: ${expression}`;
      const exprTokens = this._tokenize(expression);

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
        exprTokens,
      };

      this.steps.set(index, step);
      if (index > maxIndex) maxIndex = index;

      // Build lookup indices
      this._labelIndex.set(step.label.toLowerCase(), index);
      this._exprIndex.set(exprTokens.join(' '), index);
    }

    this.goalStepIndex = maxIndex;

    // Starting statements
    if (Array.isArray(slotData.starting_statements)) {
      for (const idx of slotData.starting_statements) {
        const startStep = this.steps.get(idx);
        if (startStep) {
          this.receivedItems.add(startStep.itemName);
        }
      }
    }

    this._updateAvailableSteps();
    this.isLoaded = true;
    return true;
  }

  // ─── Expression Matching ──────────────────────────────────

  /**
   * Tokenize a MetaMath expression into normalized tokens.
   * Splits on whitespace, lowercases everything.
   * @param {string} expr
   * @returns {string[]}
   */
  _tokenize(expr) {
    return expr.trim().split(/\s+/).filter(t => t.length > 0);
  }

  /**
   * Check if a token is a MetaMath metavariable.
   * Metavariables are single uppercase letters (A-Z) or
   * common multi-char placeholders like "ph", "ps", "ch", "th".
   * @param {string} token
   * @returns {boolean}
   */
  _isMetavariable(token) {
    // Single uppercase letter: A, B, C, ..., Z
    if (token.length === 1 && /^[A-Z]$/.test(token)) return true;
    // Common Metamath metavariable names (Greek letter abbreviations)
    if (/^(ph|ps|ch|th|ta|et|ze|si|rh|mu|la|ka)$/.test(token)) return true;
    return false;
  }

  /**
   * Attempt structural unification between a template expression (with metavariables)
   * and user input tokens.
   *
   * The template's metavariables can bind to any single token in the input.
   * Bindings must be consistent (same metavar always maps to same token).
   *
   * @param {string[]} templateTokens - Tokenized template expression
   * @param {string[]} inputTokens - Tokenized user input
   * @returns {boolean} Whether the input structurally matches the template
   */
  _unifyTokens(templateTokens, inputTokens) {
    if (templateTokens.length !== inputTokens.length) return false;

    const bindings = new Map();

    for (let i = 0; i < templateTokens.length; i++) {
      const tTok = templateTokens[i];
      const iTok = inputTokens[i];

      if (this._isMetavariable(tTok)) {
        // Metavariable: check or create binding
        if (bindings.has(tTok)) {
          if (bindings.get(tTok) !== iTok) return false;
        } else {
          bindings.set(tTok, iTok);
        }
      } else {
        // Concrete token: must match exactly (case-insensitive)
        if (tTok.toLowerCase() !== iTok.toLowerCase()) return false;
      }
    }

    return true;
  }

  /**
   * Try to match user input against all undiscovered available steps.
   * Returns the matching step index, or null.
   *
   * Matching strategies (in order):
   *   1. Exact label match (case-insensitive)
   *   2. Exact normalized expression match
   *   3. Structural unification (metavariable binding)
   *
   * @param {string} input - The user's typed text
   * @returns {{stepIndex: number, matchType: string}|null}
   */
  matchInput(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const lowered = trimmed.toLowerCase();
    const inputTokens = this._tokenize(trimmed);

    // Only match against steps that are available but not yet discovered
    const candidates = [...this.availableSteps].filter(
      idx => !this.discoveredSteps.has(idx)
    );

    // Strategy 1: Label match
    for (const idx of candidates) {
      const step = this.steps.get(idx);
      if (!step) continue;
      if (step.label.toLowerCase() === lowered) {
        return { stepIndex: idx, matchType: 'label' };
      }
    }

    // Strategy 2: Normalized expression match
    const inputNorm = inputTokens.join(' ');
    for (const idx of candidates) {
      const step = this.steps.get(idx);
      if (!step) continue;
      // Compare lowercase normalized tokens
      const stepNorm = step.exprTokens.map(t => t.toLowerCase()).join(' ');
      if (inputNorm.toLowerCase() === stepNorm) {
        return { stepIndex: idx, matchType: 'expression' };
      }
    }

    // Strategy 3: Structural unification
    for (const idx of candidates) {
      const step = this.steps.get(idx);
      if (!step) continue;
      if (this._unifyTokens(step.exprTokens, inputTokens)) {
        return { stepIndex: idx, matchType: 'unification' };
      }
    }

    return null;
  }

  /**
   * Get hints for partial input (autocomplete suggestions).
   * Returns labels that start with the input text.
   * Only suggests undiscovered available steps.
   * @param {string} input
   * @returns {Array<{index: number, label: string, hint: string}>}
   */
  getHints(input) {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return [];

    const candidates = [...this.availableSteps].filter(
      idx => !this.discoveredSteps.has(idx)
    );

    const hints = [];
    for (const idx of candidates) {
      const step = this.steps.get(idx);
      if (!step) continue;
      if (step.label.toLowerCase().startsWith(trimmed)) {
        hints.push({
          index: idx,
          label: step.label,
          hint: step.expression.length > 40
            ? step.expression.slice(0, 40) + '...'
            : step.expression,
        });
      }
    }

    return hints.slice(0, 5);
  }

  // ─── Step Discovery & Queue Operations ─────────────────────

  /**
   * Attempt to discover a step by matching user input.
   * If successful, adds the step to discoveredSteps and the queue.
   * @param {string} input
   * @returns {{success: boolean, stepIndex?: number, matchType?: string, reason?: string}}
   */
  tryDiscover(input) {
    const match = this.matchInput(input);

    if (!match) {
      this.failedAttempts++;
      if (this.onMatchFailed) this.onMatchFailed(input);
      return { success: false, reason: 'no-match' };
    }

    const { stepIndex, matchType } = match;

    // Already discovered (shouldn't happen since matchInput filters, but guard)
    if (this.discoveredSteps.has(stepIndex)) {
      return { success: false, reason: 'already-discovered' };
    }

    this.discoveredSteps.add(stepIndex);
    this.queue.push(stepIndex);

    if (this.onStepDiscovered) {
      this.onStepDiscovered(stepIndex, matchType);
    }
    this._notifyQueueChanged();

    return { success: true, stepIndex, matchType };
  }

  /**
   * Remove a step from the queue (but keep it discovered).
   * Only allowed if the step's location hasn't been checked.
   * @param {number} stepIndex
   * @returns {boolean}
   */
  removeFromQueue(stepIndex) {
    const step = this.steps.get(stepIndex);
    if (!step) return false;
    if (this.checkedLocations.has(step.locationName)) return false;

    const idx = this.queue.indexOf(stepIndex);
    if (idx === -1) return false;

    this.queue.splice(idx, 1);
    this._notifyQueueChanged();
    return true;
  }

  /**
   * Re-add a discovered (but removed) step to the end of the queue.
   * @param {number} stepIndex
   * @returns {boolean}
   */
  readdToQueue(stepIndex) {
    if (!this.discoveredSteps.has(stepIndex)) return false;
    if (this.queue.includes(stepIndex)) return false;

    this.queue.push(stepIndex);
    this._notifyQueueChanged();
    return true;
  }

  /**
   * Move a step within the queue.
   * @param {number} fromIdx - Queue array index
   * @param {number} toIdx - Queue array index
   * @returns {boolean}
   */
  moveInQueue(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= this.queue.length) return false;
    if (toIdx < 0 || toIdx >= this.queue.length) return false;
    if (fromIdx === toIdx) return false;

    const stepIndex = this.queue[fromIdx];
    const step = this.steps.get(stepIndex);
    if (!step) return false;
    if (this.checkedLocations.has(step.locationName)) return false;

    this.queue.splice(fromIdx, 1);
    this.queue.splice(toIdx, 0, stepIndex);
    this._notifyQueueChanged();
    return true;
  }

  // ─── Validation ───────────────────────────────────────────

  /**
   * Validate the queue — same logic as ProofQueueState.
   * A step is "valid" if all its dependencies appear earlier in the queue.
   * @returns {Array<{stepIndex: number, valid: boolean, checkable: boolean, missingDeps: number[], alreadyChecked: boolean}>}
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
   * Get the next checkable step in the queue.
   * @returns {number|null}
   */
  getNextCheckableStep() {
    const validation = this.validateQueue();
    for (const entry of validation) {
      if (entry.checkable) return entry.stepIndex;
    }
    return null;
  }

  /**
   * Check if the proof is complete.
   * @returns {boolean}
   */
  isProofComplete() {
    if (!this.goalStepIndex) return false;
    const goalStep = this.steps.get(this.goalStepIndex);
    if (!goalStep) return false;
    return this.checkedLocations.has(goalStep.locationName);
  }

  /**
   * Get queue with validation status.
   * @returns {Array<{step: ProofStep, valid: boolean, checkable: boolean, missingDeps: number[], alreadyChecked: boolean}>}
   */
  getQueueWithStatus() {
    const validation = this.validateQueue();
    return validation.map(entry => ({
      step: this.steps.get(entry.stepIndex),
      ...entry,
    }));
  }

  /**
   * Get discovered steps not currently in queue (removed ones).
   * @returns {ProofStep[]}
   */
  getRemovedDiscoveredSteps() {
    const inQueue = new Set(this.queue);
    return [...this.discoveredSteps]
      .filter(idx => !inQueue.has(idx))
      .map(idx => this.steps.get(idx))
      .filter(Boolean);
  }

  /**
   * Get count of undiscovered available steps.
   * @returns {number}
   */
  getUndiscoveredCount() {
    let count = 0;
    for (const idx of this.availableSteps) {
      if (!this.discoveredSteps.has(idx)) count++;
    }
    return count;
  }

  // ─── Inventory / Location State ────────────────────────────

  receiveItem(itemName) {
    if (this.receivedItems.has(itemName)) return;
    this.receivedItems.add(itemName);
    this._updateAvailableSteps();
  }

  checkLocation(locationName) {
    this.checkedLocations.add(locationName);
  }

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

  syncLocations(locationsMap) {
    if (!locationsMap) return;
    for (const [locName, checked] of Object.entries(locationsMap)) {
      if (checked) {
        this.checkedLocations.add(locName);
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────

  _updateAvailableSteps() {
    const prev = new Set(this.availableSteps);
    this.availableSteps.clear();

    for (const [index, step] of this.steps) {
      if (step.dependencies.length === 0) {
        this.availableSteps.add(index);
      } else {
        const allDepsReceived = step.dependencies.every(depIdx => {
          const depStep = this.steps.get(depIdx);
          return depStep && this.receivedItems.has(depStep.itemName);
        });
        if (allDepsReceived) {
          this.availableSteps.add(index);
        }
      }
    }

    const changed = this.availableSteps.size !== prev.size ||
      [...this.availableSteps].some(idx => !prev.has(idx));
    if (changed && this.onAvailableChanged) {
      this.onAvailableChanged();
    }
  }

  _notifyQueueChanged() {
    if (this.onQueueChanged) this.onQueueChanged();
  }
}
