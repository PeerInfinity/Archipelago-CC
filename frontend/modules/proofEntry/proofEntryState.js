/**
 * ProofEntryState — manages the proof entry puzzle for MetaMath Hard mode.
 *
 * Extends ProofQueueBaseState with step discovery via text matching:
 *   - Steps are NOT shown upfront; the player must type to "discover" each step
 *   - Matching uses multiple strategies:
 *     1. Exact label match (case-insensitive)
 *     2. Token-normalized expression match
 *     3. Structural unification — metavariable template matching
 *        e.g. "|- ( ( A + B ) + C ) = ( A + ( B + C ) )" matches
 *             "|- ( ( 2 + 2 ) + 1 ) = ( 2 + ( 2 + 1 ) )"
 *        with consistent binding A=2, B=2, C=1
 */

import { ProofQueueBaseState } from '../proofShared/proofQueueBaseState.js';

export class ProofEntryState extends ProofQueueBaseState {
  constructor() {
    super();

    /** @type {Set<number>} Steps that have been discovered (typed correctly) */
    this.discoveredSteps = new Set();

    /** @type {number} Total failed match attempts */
    this.failedAttempts = 0;

    // ─── Lookup indices for fast matching ────────────────
    /** @type {Map<string, number>} Lowercase label -> step index */
    this._labelIndex = new Map();
    /** @type {Map<string, number>} Normalized expression string -> step index */
    this._exprIndex = new Map();

    // ─── Callbacks ────────────────────────────────────────
    /** @type {Function|null} Called when a step is discovered */
    this.onStepDiscovered = null;
    /** @type {Function|null} Called when a match attempt fails */
    this.onMatchFailed = null;
  }

  // ─── Data Loading ──────────────────────────────────────────

  /**
   * Load proof structure from rules.json slot_data.
   * @param {Object} slotData
   * @param {Object} [nameSubstitutions]
   */
  loadFromSlotData(slotData, nameSubstitutions) {
    this.queue = [];
    this.availableSteps.clear();
    this.discoveredSteps.clear();
    this._labelIndex.clear();
    this._exprIndex.clear();
    this.failedAttempts = 0;

    const success = this._parseProofStructure(slotData, nameSubstitutions);
    if (!success) return false;

    // Build lookup indices from parsed steps
    for (const [index, step] of this.steps) {
      this._labelIndex.set(step.label.toLowerCase(), index);
      this._exprIndex.set(step.exprTokens.join(' '), index);
    }

    this._updateAvailableSteps();
    this.isLoaded = true;
    return true;
  }

  /** @override - Add tokenized expression to each step */
  _augmentStep(step, _rawStmt) {
    step.exprTokens = this._tokenize(step.expression);
  }

  // ─── Expression Matching ──────────────────────────────────

  /**
   * Tokenize a MetaMath expression into normalized tokens.
   * Splits on whitespace.
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

  // ─── Query Helpers ──────────────────────────────────────────

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
}
