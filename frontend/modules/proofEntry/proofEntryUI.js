/**
 * ProofEntryUI — GoldenLayout panel for the MetaMath Hard mode proof entry.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  Proof Entry: 2p2e4                  │
 *   ├──────────────────────────────────────┤
 *   │  [Clear] [Check Next]               │
 *   ├──────────────────────────────────────┤
 *   │  Enter statement:                   │
 *   │  ┌──────────────────────────┐ [Add] │
 *   │  │ type label or expr...    │       │
 *   │  └──────────────────────────┘       │
 *   │  ⓘ 3 undiscovered steps remain     │
 *   ├──────────────────────────────────────┤
 *   │  Discovered (not in queue):         │
 *   │  ┌────────┐ ┌────────┐             │
 *   │  │ 2cn    │ │ df-2   │  (click)    │
 *   │  └────────┘ └────────┘             │
 *   ├──────────────────────────────────────┤
 *   │  Proof Order (drag to reorder)      │
 *   │  1. ✓ 2cn: |- 2 e. CC              │
 *   │  2. ● ax-1cn: |- 1 e. CC           │
 *   │  3. ✗ 3eqtri: |- A = D  [missing…] │
 *   └──────────────────────────────────────┘
 */

import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import proofEntryState from './proofEntryStateSingleton.js';

// Module-level references set by index.js
let _moduleEventBus = null;
let _dispatcher = null;

export function setModuleEventBus(bus) { _moduleEventBus = bus; }
export function setDispatcher(dispatcher) { _dispatcher = dispatcher; }

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('proofEntryUI', message, ...data);
  } else {
    const method = console[level === 'info' ? 'log' : level] || console.log;
    method(`[proofEntryUI] ${message}`, ...data);
  }
}

export class ProofEntryUI {
  /**
   * @param {Object} container - GoldenLayout container
   * @param {Object} componentState - GoldenLayout component state
   */
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    this.rootElement = null;
    this.unsubscribeHandles = [];
    this.isInitialized = false;

    // DOM references
    this._headerEl = null;
    this._toolbarEl = null;
    this._inputSection = null;
    this._inputEl = null;
    this._addBtn = null;
    this._feedbackEl = null;
    this._hintEl = null;
    this._removedSection = null;
    this._removedPoolEl = null;
    this._queueEl = null;
    this._statusEl = null;

    // Drag state
    this._draggedIndex = null;
    this._dragOverIndex = null;

    // Debounce timer for hints
    this._hintTimer = null;

    this._createBaseUI();
    this._setupLifecycle();
  }

  getRootElement() {
    return this.rootElement;
  }

  // ─── Base UI Construction ────────────────────────────────

  _createBaseUI() {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'proof-entry-panel';

    // Header
    this._headerEl = document.createElement('div');
    this._headerEl.className = 'pe-header';
    this._headerEl.textContent = 'Proof Entry';
    this.rootElement.appendChild(this._headerEl);

    // Toolbar
    this._toolbarEl = document.createElement('div');
    this._toolbarEl.className = 'pe-toolbar';
    this._toolbarEl.innerHTML = `
      <button class="pe-btn pe-btn-clear" title="Remove unchecked steps from queue">Clear</button>
      <button class="pe-btn pe-btn-check" title="Check the next valid step">Check Next</button>
    `;
    this.rootElement.appendChild(this._toolbarEl);

    // Input section
    this._inputSection = document.createElement('div');
    this._inputSection.className = 'pe-input-section';

    const inputLabel = document.createElement('div');
    inputLabel.className = 'pe-section-label';
    inputLabel.textContent = 'Enter Statement';
    this._inputSection.appendChild(inputLabel);

    const inputRow = document.createElement('div');
    inputRow.className = 'pe-input-row';

    this._inputEl = document.createElement('input');
    this._inputEl.type = 'text';
    this._inputEl.className = 'pe-input';
    this._inputEl.placeholder = 'Type theorem label or expression...';
    this._inputEl.spellcheck = false;
    this._inputEl.autocomplete = 'off';
    inputRow.appendChild(this._inputEl);

    this._addBtn = document.createElement('button');
    this._addBtn.className = 'pe-btn pe-btn-add';
    this._addBtn.textContent = 'Add';
    this._addBtn.title = 'Try to match and add step';
    inputRow.appendChild(this._addBtn);

    this._inputSection.appendChild(inputRow);

    // Hint dropdown
    this._hintEl = document.createElement('div');
    this._hintEl.className = 'pe-hints';
    this._hintEl.style.display = 'none';
    this._inputSection.appendChild(this._hintEl);

    // Feedback message
    this._feedbackEl = document.createElement('div');
    this._feedbackEl.className = 'pe-feedback';
    this._inputSection.appendChild(this._feedbackEl);

    this.rootElement.appendChild(this._inputSection);

    // Removed/discovered pool section
    this._removedSection = document.createElement('div');
    this._removedSection.className = 'pe-section pe-removed-section';
    this._removedSection.style.display = 'none';
    const removedLabel = document.createElement('div');
    removedLabel.className = 'pe-section-label';
    removedLabel.textContent = 'Discovered (removed from queue)';
    this._removedSection.appendChild(removedLabel);
    this._removedPoolEl = document.createElement('div');
    this._removedPoolEl.className = 'pe-removed-pool';
    this._removedSection.appendChild(this._removedPoolEl);
    this.rootElement.appendChild(this._removedSection);

    // Queue section
    const queueSection = document.createElement('div');
    queueSection.className = 'pe-section pe-queue-section';
    const queueLabel = document.createElement('div');
    queueLabel.className = 'pe-section-label';
    queueLabel.textContent = 'Proof Order';
    queueSection.appendChild(queueLabel);
    this._queueEl = document.createElement('div');
    this._queueEl.className = 'pe-queue';
    queueSection.appendChild(this._queueEl);
    this.rootElement.appendChild(queueSection);

    // Status bar
    this._statusEl = document.createElement('div');
    this._statusEl.className = 'pe-status';
    this._statusEl.textContent = 'Load a MetaMath game to begin.';
    this.rootElement.appendChild(this._statusEl);

    // Event handlers
    this._toolbarEl.querySelector('.pe-btn-clear').addEventListener('click', () => this._onClear());
    this._toolbarEl.querySelector('.pe-btn-check').addEventListener('click', () => this._onCheckNext());
    this._addBtn.addEventListener('click', () => this._onAdd());
    this._inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._onAdd();
      }
    });
    this._inputEl.addEventListener('input', () => this._onInputChange());
    this._inputEl.addEventListener('focus', () => this._onInputChange());
    this._inputEl.addEventListener('blur', () => {
      // Delay hiding hints so click events on hints fire first
      setTimeout(() => { this._hintEl.style.display = 'none'; }, 200);
    });

    this._showEmptyState();
  }

  _showEmptyState() {
    this._queueEl.innerHTML = '';
    this._toolbarEl.style.display = 'none';
    this._inputSection.style.display = 'none';
    this._removedSection.style.display = 'none';
    this._feedbackEl.textContent = '';
  }

  // ─── Lifecycle ────────────────────────────────────────────

  _setupLifecycle() {
    Object.defineProperty(this, 'eventBus', {
      get: () => _moduleEventBus,
      configurable: true,
    });

    const readyHandler = () => {
      this._attachListeners();
      this.isInitialized = true;
      if (_moduleEventBus) {
        _moduleEventBus.unsubscribe('app:readyForUiDataLoad', readyHandler);
      }
    };

    if (_moduleEventBus) {
      _moduleEventBus.subscribe('app:readyForUiDataLoad', readyHandler);
    }

    if (this._hasProofStructure()) {
      this._attachListeners();
      this.isInitialized = true;
      this._wireStateCallbacks();
      this.render();
    }

    this.container.on('destroy', () => this.destroy());
  }

  _attachListeners() {
    this.destroy();

    const subscribe = (eventName, handler) => {
      if (!_moduleEventBus) return;
      const unsub = _moduleEventBus.subscribe(eventName, handler.bind(this));
      this.unsubscribeHandles.push(unsub);
    };

    subscribe('stateManager:rulesLoaded', this._handleRulesLoaded);
    subscribe('stateManager:snapshotUpdated', this._handleSnapshotUpdated);
    subscribe('stateManager:inventoryChanged', this._handleInventoryChanged);
  }

  destroy() {
    this.unsubscribeHandles.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.unsubscribeHandles = [];
    if (this._hintTimer) {
      clearTimeout(this._hintTimer);
      this._hintTimer = null;
    }
  }

  _wireStateCallbacks() {
    const existingQueueCb = proofEntryState.onQueueChanged;
    proofEntryState.onQueueChanged = () => {
      if (existingQueueCb) existingQueueCb();
      this.render();
    };
    proofEntryState.onAvailableChanged = () => this.render();
  }

  // ─── Event Handlers ───────────────────────────────────────

  _hasProofStructure() {
    const staticData = stateManager.getStaticData();
    if (!staticData?.world) return false;
    const playerId = staticData.playerId || '1';
    const playerWorld = staticData.world[playerId];
    return !!playerWorld?.slot_data?.proof_structure;
  }

  _handleRulesLoaded() {
    log('info', 'Rules loaded, checking for proof structure');
    if (!this._hasProofStructure()) {
      log('info', 'Not a MetaMath game — hiding proof entry');
      this._showEmptyState();
      this._statusEl.textContent = 'This game has no proof structure.';
      return;
    }

    if (proofEntryState && proofEntryState.isLoaded) {
      this._wireStateCallbacks();
      this._syncFromSnapshot();
      this.render();
    }
  }

  _handleSnapshotUpdated(snapshotData) {
    if (!proofEntryState?.isLoaded) return;
    this._syncFromSnapshot(snapshotData);
    this.render();
  }

  _handleInventoryChanged() {
    if (!proofEntryState?.isLoaded) return;
    this._syncFromSnapshot();
    this.render();
  }

  _syncFromSnapshot(snapshotData) {
    if (!proofEntryState) return;
    const snapshot = snapshotData || stateManager.getLatestStateSnapshot();
    if (!snapshot) return;

    if (snapshot.inventory) {
      proofEntryState.syncInventory(snapshot.inventory);
    }
    if (snapshot.checkedLocations) {
      const locMap = {};
      for (const loc of snapshot.checkedLocations) {
        locMap[loc] = true;
      }
      proofEntryState.syncLocations(locMap);
    }
  }

  // ─── Rendering ────────────────────────────────────────────

  render() {
    if (!proofEntryState?.isLoaded) {
      this._showEmptyState();
      return;
    }

    this._toolbarEl.style.display = '';
    this._inputSection.style.display = '';

    // Header
    this._headerEl.textContent = proofEntryState.theoremName
      ? `Proof Entry: ${proofEntryState.theoremName}`
      : 'Proof Entry';

    this._renderFeedback();
    this._renderRemovedPool();
    this._renderQueue();
    this._renderStatus();
  }

  _renderFeedback() {
    const undiscovered = proofEntryState.getUndiscoveredCount();
    if (undiscovered > 0) {
      this._feedbackEl.textContent = `${undiscovered} undiscovered step${undiscovered !== 1 ? 's' : ''} available`;
      this._feedbackEl.className = 'pe-feedback pe-feedback-info';
    } else if (proofEntryState.discoveredSteps.size < proofEntryState.steps.size) {
      this._feedbackEl.textContent = 'Waiting for more items to unlock steps...';
      this._feedbackEl.className = 'pe-feedback pe-feedback-waiting';
    } else {
      this._feedbackEl.textContent = 'All steps discovered!';
      this._feedbackEl.className = 'pe-feedback pe-feedback-complete';
    }
  }

  _renderRemovedPool() {
    const removed = proofEntryState.getRemovedDiscoveredSteps();
    if (removed.length === 0) {
      this._removedSection.style.display = 'none';
      return;
    }

    this._removedSection.style.display = '';
    this._removedPoolEl.innerHTML = '';

    for (const step of removed) {
      const chip = document.createElement('button');
      chip.className = 'pe-pool-chip';
      chip.title = step.fullText || step.expression;
      chip.dataset.stepIndex = step.index;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'pe-chip-label';
      labelSpan.textContent = step.label;
      chip.appendChild(labelSpan);

      const exprSpan = document.createElement('span');
      exprSpan.className = 'pe-chip-expr';
      exprSpan.textContent = step.expression;
      chip.appendChild(exprSpan);

      chip.addEventListener('click', () => {
        proofEntryState.readdToQueue(step.index);
      });

      this._removedPoolEl.appendChild(chip);
    }
  }

  _renderQueue() {
    this._queueEl.innerHTML = '';

    const queueWithStatus = proofEntryState.getQueueWithStatus();
    if (queueWithStatus.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pe-empty';
      empty.textContent = 'Type a statement to discover and add it';
      this._queueEl.appendChild(empty);
      return;
    }

    for (let i = 0; i < queueWithStatus.length; i++) {
      const { step, valid, checkable, missingDeps, alreadyChecked } = queueWithStatus[i];
      if (!step) continue;

      const row = document.createElement('div');
      row.className = 'pe-queue-row';
      row.dataset.queueIndex = i;
      row.dataset.stepIndex = step.index;

      // Status classes
      if (alreadyChecked) {
        row.classList.add('pe-checked');
      } else if (checkable) {
        row.classList.add('pe-checkable');
      } else if (!valid) {
        row.classList.add('pe-invalid');
      } else {
        row.classList.add('pe-valid');
      }

      // Drag support
      if (!alreadyChecked) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => this._onDragStart(e, i));
        row.addEventListener('dragend', (e) => this._onDragEnd(e));
        row.addEventListener('dragover', (e) => this._onDragOver(e, i));
        row.addEventListener('drop', (e) => this._onDrop(e, i));
      }

      // Index number
      const numEl = document.createElement('span');
      numEl.className = 'pe-row-num';
      numEl.textContent = `${i + 1}.`;
      row.appendChild(numEl);

      // Status icon
      const iconEl = document.createElement('span');
      iconEl.className = 'pe-row-icon';
      if (alreadyChecked) {
        iconEl.textContent = '\u2713';
        iconEl.title = 'Checked';
      } else if (valid) {
        iconEl.textContent = '\u25CF';
        iconEl.title = 'Ready to check';
      } else {
        iconEl.textContent = '\u2717';
        iconEl.title = `Missing: ${missingDeps.map(d => proofEntryState.steps.get(d)?.label || d).join(', ')}`;
      }
      row.appendChild(iconEl);

      // Label + expression
      const textEl = document.createElement('span');
      textEl.className = 'pe-row-text';
      const labelPart = document.createElement('strong');
      labelPart.textContent = step.label;
      textEl.appendChild(labelPart);
      textEl.appendChild(document.createTextNode(': ' + step.expression));
      row.appendChild(textEl);

      // Remove button
      if (!alreadyChecked) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'pe-row-remove';
        removeBtn.textContent = '\u00D7';
        removeBtn.title = 'Remove from queue';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          proofEntryState.removeFromQueue(step.index);
        });
        row.appendChild(removeBtn);
      }

      // Missing deps hint
      if (!valid && !alreadyChecked && missingDeps.length > 0) {
        const depInfo = document.createElement('div');
        depInfo.className = 'pe-row-deps';
        depInfo.textContent = 'Needs: ' + missingDeps.map(d => proofEntryState.steps.get(d)?.label || `#${d}`).join(', ');
        row.appendChild(depInfo);
      }

      this._queueEl.appendChild(row);
    }
  }

  _renderStatus() {
    if (!proofEntryState) return;

    if (proofEntryState.isProofComplete()) {
      this._statusEl.textContent = 'Proof complete!';
      this._statusEl.className = 'pe-status pe-status-complete';
      return;
    }

    const total = proofEntryState.steps.size;
    const checked = proofEntryState.checkedLocations.size;
    const discovered = proofEntryState.discoveredSteps.size;
    const inQueue = proofEntryState.queue.length;
    const failed = proofEntryState.failedAttempts;

    let text = `${checked}/${total} proved | ${discovered} discovered | ${inQueue} in queue`;
    if (failed > 0) text += ` | ${failed} failed`;

    this._statusEl.textContent = text;
    this._statusEl.className = 'pe-status';
  }

  // ─── Input / Match ──────────────────────────────────────

  _onAdd() {
    const input = this._inputEl.value.trim();
    if (!input) return;

    const result = proofEntryState.tryDiscover(input);

    if (result.success) {
      const step = proofEntryState.steps.get(result.stepIndex);
      this._showMatchFeedback(step, result.matchType);
      this._inputEl.value = '';
      this._hintEl.style.display = 'none';
    } else {
      this._showRejectFeedback(input, result.reason);
    }
  }

  _showMatchFeedback(step, matchType) {
    const typeLabel = matchType === 'label' ? 'label match'
      : matchType === 'expression' ? 'expression match'
      : 'structural match';

    this._feedbackEl.textContent = `Found: ${step.label} (${typeLabel})`;
    this._feedbackEl.className = 'pe-feedback pe-feedback-success';

    // Flash then revert after a delay
    setTimeout(() => this._renderFeedback(), 2000);
  }

  _showRejectFeedback(input, reason) {
    const display = input.length > 30 ? input.slice(0, 30) + '...' : input;
    this._feedbackEl.textContent = `No match for "${display}"`;
    this._feedbackEl.className = 'pe-feedback pe-feedback-reject';

    // Add shake animation
    this._inputEl.classList.add('pe-shake');
    setTimeout(() => this._inputEl.classList.remove('pe-shake'), 400);

    setTimeout(() => this._renderFeedback(), 2000);
  }

  _onInputChange() {
    if (this._hintTimer) clearTimeout(this._hintTimer);

    const input = this._inputEl.value.trim();
    if (input.length < 2) {
      this._hintEl.style.display = 'none';
      return;
    }

    // Debounce hint generation
    this._hintTimer = setTimeout(() => {
      const hints = proofEntryState.getHints(input);
      if (hints.length === 0) {
        this._hintEl.style.display = 'none';
        return;
      }

      this._hintEl.innerHTML = '';
      for (const hint of hints) {
        const item = document.createElement('div');
        item.className = 'pe-hint-item';
        item.innerHTML = `<strong>${hint.label}</strong> <span class="pe-hint-expr">${hint.hint}</span>`;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this._inputEl.value = hint.label;
          this._hintEl.style.display = 'none';
          this._onAdd();
        });
        this._hintEl.appendChild(item);
      }
      this._hintEl.style.display = '';
    }, 150);
  }

  // ─── Drag and Drop ────────────────────────────────────────

  _onDragStart(e, queueIndex) {
    this._draggedIndex = queueIndex;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(queueIndex));
    requestAnimationFrame(() => {
      const row = this._queueEl.querySelector(`[data-queue-index="${queueIndex}"]`);
      if (row) row.classList.add('pe-dragging');
    });
  }

  _onDragEnd(e) {
    this._draggedIndex = null;
    this._dragOverIndex = null;
    this._queueEl.querySelectorAll('.pe-dragging, .pe-drag-over').forEach(el => {
      el.classList.remove('pe-dragging', 'pe-drag-over');
    });
  }

  _onDragOver(e, queueIndex) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (this._dragOverIndex !== queueIndex) {
      this._queueEl.querySelectorAll('.pe-drag-over').forEach(el => {
        el.classList.remove('pe-drag-over');
      });
      this._dragOverIndex = queueIndex;
      const row = this._queueEl.querySelector(`[data-queue-index="${queueIndex}"]`);
      if (row) row.classList.add('pe-drag-over');
    }
  }

  _onDrop(e, toIndex) {
    e.preventDefault();
    const fromIndex = this._draggedIndex;
    if (fromIndex === null || fromIndex === toIndex) return;
    proofEntryState.moveInQueue(fromIndex, toIndex);
  }

  // ─── Toolbar Actions ──────────────────────────────────────

  _onClear() {
    if (!proofEntryState) return;
    // Remove unchecked steps from queue (they stay discovered)
    proofEntryState.queue = proofEntryState.queue.filter(idx => {
      const step = proofEntryState.steps.get(idx);
      return step && proofEntryState.checkedLocations.has(step.locationName);
    });
    proofEntryState._notifyQueueChanged();
  }

  _onCheckNext() {
    if (!proofEntryState || !_dispatcher) return;

    const nextStep = proofEntryState.getNextCheckableStep();
    if (nextStep === null) {
      log('info', 'No checkable step available');
      return;
    }

    const step = proofEntryState.steps.get(nextStep);
    if (!step) return;

    // Find region name for this location
    const staticData = stateManager.getStaticData();
    let regionName = step.locationName;
    if (staticData?.regions) {
      for (const [rName, rData] of Object.entries(staticData.regions)) {
        if (rData.locations && rData.locations.some(loc => loc.name === step.locationName)) {
          regionName = rName;
          break;
        }
      }
    }

    const payload = {
      locationName: step.locationName,
      regionName: regionName,
      originator: 'ProofEntryCheck',
      originalDOMEvent: true,
    };

    log('info', `Checking location: ${step.locationName}`, payload);
    _dispatcher.publish('user:locationCheck', payload, {
      initialTarget: 'bottom',
    });
  }
}
