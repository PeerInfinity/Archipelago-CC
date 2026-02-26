/**
 * ProofQueueUI — GoldenLayout panel for the MetaMath Easy mode proof queue.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  Proof Queue: 2p2e4                  │
 *   ├──────────────────────────────────────┤
 *   │  [Auto-fill] [Clear] [Check Next]    │
 *   ├──────────────────────────────────────┤
 *   │  Available Steps (pool)              │
 *   │  ┌────────┐ ┌────────┐ ┌────────┐   │
 *   │  │ 2cn    │ │ df-2   │ │ df-3   │   │
 *   │  └────────┘ └────────┘ └────────┘   │
 *   ├──────────────────────────────────────┤
 *   │  Queue (drag to reorder)             │
 *   │  1. ✓ 2cn: |- 2 e. CC               │
 *   │  2. ✓ ax-1cn: |- 1 e. CC            │
 *   │  3. ● addassi: |- ((A+B)+C)=...     │
 *   │  4. ✗ 3eqtri: |- A = D  [missing…]  │
 *   └──────────────────────────────────────┘
 */

import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import proofQueueState from './proofQueueStateSingleton.js';

// Module-level references set by index.js
let _moduleEventBus = null;
let _dispatcher = null;

export function setModuleEventBus(bus) { _moduleEventBus = bus; }
export function setDispatcher(dispatcher) { _dispatcher = dispatcher; }

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('proofQueueUI', message, ...data);
  } else {
    const method = console[level === 'info' ? 'log' : level] || console.log;
    method(`[proofQueueUI] ${message}`, ...data);
  }
}

export class ProofQueueUI {
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
    this._poolEl = null;
    this._queueEl = null;
    this._statusEl = null;

    // Drag state
    this._draggedIndex = null;
    this._dragOverIndex = null;

    this._createBaseUI();
    this._setupLifecycle();
  }

  getRootElement() {
    return this.rootElement;
  }

  // ─── Base UI Construction ────────────────────────────────

  _createBaseUI() {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'proof-queue-panel';

    // Header
    this._headerEl = document.createElement('div');
    this._headerEl.className = 'pq-header';
    this._headerEl.textContent = 'Proof Queue';
    this.rootElement.appendChild(this._headerEl);

    // Toolbar
    this._toolbarEl = document.createElement('div');
    this._toolbarEl.className = 'pq-toolbar';
    this._toolbarEl.innerHTML = `
      <button class="pq-btn pq-btn-autofill" title="Add all available steps in valid order">Auto-fill</button>
      <button class="pq-btn pq-btn-clear" title="Remove unchecked steps from queue">Clear</button>
      <button class="pq-btn pq-btn-check" title="Check the next valid step">Check Next</button>
    `;
    this.rootElement.appendChild(this._toolbarEl);

    // Available steps pool
    const poolSection = document.createElement('div');
    poolSection.className = 'pq-section';
    const poolLabel = document.createElement('div');
    poolLabel.className = 'pq-section-label';
    poolLabel.textContent = 'Available Steps';
    poolSection.appendChild(poolLabel);
    this._poolEl = document.createElement('div');
    this._poolEl.className = 'pq-pool';
    poolSection.appendChild(this._poolEl);
    this.rootElement.appendChild(poolSection);

    // Queue
    const queueSection = document.createElement('div');
    queueSection.className = 'pq-section pq-queue-section';
    const queueLabel = document.createElement('div');
    queueLabel.className = 'pq-section-label';
    queueLabel.textContent = 'Proof Order';
    queueSection.appendChild(queueLabel);
    this._queueEl = document.createElement('div');
    this._queueEl.className = 'pq-queue';
    queueSection.appendChild(this._queueEl);
    this.rootElement.appendChild(queueSection);

    // Status bar
    this._statusEl = document.createElement('div');
    this._statusEl.className = 'pq-status';
    this._statusEl.textContent = 'Load a MetaMath game to begin.';
    this.rootElement.appendChild(this._statusEl);

    // Toolbar click handlers
    this._toolbarEl.querySelector('.pq-btn-autofill').addEventListener('click', () => this._onAutoFill());
    this._toolbarEl.querySelector('.pq-btn-clear').addEventListener('click', () => this._onClear());
    this._toolbarEl.querySelector('.pq-btn-check').addEventListener('click', () => this._onCheckNext());

    // Show empty state
    this._showEmptyState();
  }

  _showEmptyState() {
    this._poolEl.innerHTML = '<div class="pq-empty">No proof loaded</div>';
    this._queueEl.innerHTML = '';
    this._toolbarEl.style.display = 'none';
  }

  // ─── Lifecycle ────────────────────────────────────────────

  _setupLifecycle() {
    // Dynamic event bus getter
    Object.defineProperty(this, 'eventBus', {
      get: () => _moduleEventBus,
      configurable: true,
    });

    // Subscribe to ready event
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

    // Fallback: if already initialized
    if (this._hasProofStructure()) {
      this._attachListeners();
      this.isInitialized = true;
      this._wireStateCallbacks();
      this.render();
    }

    // GoldenLayout destroy
    this.container.on('destroy', () => this.destroy());
  }

  _attachListeners() {
    this.destroy(); // Clear old

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
  }

  /**
   * Wire the singleton state's callbacks to trigger UI re-renders.
   */
  _wireStateCallbacks() {
    // Keep existing onQueueChanged from index.js (which publishes events),
    // but also render. Chain them.
    const existingQueueCb = proofQueueState.onQueueChanged;
    proofQueueState.onQueueChanged = () => {
      if (existingQueueCb) existingQueueCb();
      this.render();
    };
    proofQueueState.onAvailableChanged = () => this.render();
  }

  // ─── Event Handlers ───────────────────────────────────────

  /**
   * Check if the current game has a MetaMath proof structure.
   */
  _hasProofStructure() {
    const staticData = stateManager.getStaticData();
    if (!staticData?.world) return false;
    const playerId = staticData.playerId || '1';
    const playerWorld = staticData.world[playerId];
    return !!playerWorld?.slot_data?.proof_structure;
  }

  _handleRulesLoaded() {
    log('info', 'Rules loaded, checking for proof structure');

    // Check if this is a MetaMath game
    if (!this._hasProofStructure()) {
      log('info', 'Not a MetaMath game — hiding proof queue');
      this._showEmptyState();
      this._statusEl.textContent = 'This game has no proof structure.';
      return;
    }

    // State initialization is handled by index.js; wire callbacks and render
    if (proofQueueState && proofQueueState.isLoaded) {
      this._wireStateCallbacks();
      this._syncFromSnapshot();
      this.render();
    }
  }

  _handleSnapshotUpdated(snapshotData) {
    if (!proofQueueState?.isLoaded) return;
    this._syncFromSnapshot(snapshotData);
    this.render();
  }

  _handleInventoryChanged() {
    if (!proofQueueState?.isLoaded) return;
    this._syncFromSnapshot();
    this.render();
  }

  _syncFromSnapshot(snapshotData) {
    if (!proofQueueState) return;
    const snapshot = snapshotData || stateManager.getLatestStateSnapshot();
    if (!snapshot) return;

    if (snapshot.inventory) {
      proofQueueState.syncInventory(snapshot.inventory);
    }
    if (snapshot.checkedLocations) {
      const locMap = {};
      for (const loc of snapshot.checkedLocations) {
        locMap[loc] = true;
      }
      proofQueueState.syncLocations(locMap);
    }
  }

  // ─── Rendering ────────────────────────────────────────────

  render() {
    if (!proofQueueState?.isLoaded) {
      this._showEmptyState();
      return;
    }

    // Show toolbar
    this._toolbarEl.style.display = '';

    // Update header
    this._headerEl.textContent = proofQueueState.theoremName
      ? `Proof Queue: ${proofQueueState.theoremName}`
      : 'Proof Queue';

    this._renderPool();
    this._renderQueue();
    this._renderStatus();
  }

  _renderPool() {
    this._poolEl.innerHTML = '';

    const unplaced = proofQueueState.getUnplacedSteps();
    if (unplaced.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pq-empty';
      empty.textContent = proofQueueState.availableSteps.size === proofQueueState.steps.size
        ? 'All steps placed in queue'
        : 'No new steps available yet';
      this._poolEl.appendChild(empty);
      return;
    }

    for (const step of unplaced) {
      const chip = document.createElement('button');
      chip.className = 'pq-pool-chip';
      chip.title = step.fullText || step.expression;
      chip.dataset.stepIndex = step.index;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'pq-chip-label';
      labelSpan.textContent = step.label;
      chip.appendChild(labelSpan);

      const exprSpan = document.createElement('span');
      exprSpan.className = 'pq-chip-expr';
      exprSpan.textContent = step.expression;
      chip.appendChild(exprSpan);

      chip.addEventListener('click', () => {
        proofQueueState.addToQueue(step.index);
      });

      this._poolEl.appendChild(chip);
    }
  }

  _renderQueue() {
    this._queueEl.innerHTML = '';

    const queueWithStatus = proofQueueState.getQueueWithStatus();
    if (queueWithStatus.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pq-empty';
      empty.textContent = 'Click steps above to add them to the queue';
      this._queueEl.appendChild(empty);
      return;
    }

    for (let i = 0; i < queueWithStatus.length; i++) {
      const { step, valid, checkable, missingDeps, alreadyChecked } = queueWithStatus[i];
      if (!step) continue;

      const row = document.createElement('div');
      row.className = 'pq-queue-row';
      row.dataset.queueIndex = i;
      row.dataset.stepIndex = step.index;

      // Status classes
      if (alreadyChecked) {
        row.classList.add('pq-checked');
      } else if (checkable) {
        row.classList.add('pq-checkable');
      } else if (!valid) {
        row.classList.add('pq-invalid');
      } else {
        row.classList.add('pq-valid');
      }

      // Drag handle (not for checked steps)
      if (!alreadyChecked) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => this._onDragStart(e, i));
        row.addEventListener('dragend', (e) => this._onDragEnd(e));
        row.addEventListener('dragover', (e) => this._onDragOver(e, i));
        row.addEventListener('drop', (e) => this._onDrop(e, i));
      }

      // Index number
      const numEl = document.createElement('span');
      numEl.className = 'pq-row-num';
      numEl.textContent = `${i + 1}.`;
      row.appendChild(numEl);

      // Status icon
      const iconEl = document.createElement('span');
      iconEl.className = 'pq-row-icon';
      if (alreadyChecked) {
        iconEl.textContent = '\u2713'; // checkmark
        iconEl.title = 'Checked';
      } else if (valid) {
        iconEl.textContent = '\u25CF'; // filled circle
        iconEl.title = 'Ready to check';
      } else {
        iconEl.textContent = '\u2717'; // X mark
        iconEl.title = `Missing: ${missingDeps.map(d => proofQueueState.steps.get(d)?.label || d).join(', ')}`;
      }
      row.appendChild(iconEl);

      // Label + expression
      const textEl = document.createElement('span');
      textEl.className = 'pq-row-text';
      const labelPart = document.createElement('strong');
      labelPart.textContent = step.label;
      textEl.appendChild(labelPart);
      textEl.appendChild(document.createTextNode(': ' + step.expression));
      row.appendChild(textEl);

      // Remove button (not for checked steps)
      if (!alreadyChecked) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'pq-row-remove';
        removeBtn.textContent = '\u00D7'; // multiplication sign (×)
        removeBtn.title = 'Remove from queue';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          proofQueueState.removeFromQueue(step.index);
        });
        row.appendChild(removeBtn);
      }

      // Missing deps tooltip for invalid rows
      if (!valid && !alreadyChecked && missingDeps.length > 0) {
        const depInfo = document.createElement('div');
        depInfo.className = 'pq-row-deps';
        depInfo.textContent = 'Needs: ' + missingDeps.map(d => proofQueueState.steps.get(d)?.label || `#${d}`).join(', ');
        row.appendChild(depInfo);
      }

      this._queueEl.appendChild(row);
    }
  }

  _renderStatus() {
    if (!proofQueueState) return;

    if (proofQueueState.isProofComplete()) {
      this._statusEl.textContent = 'Proof complete!';
      this._statusEl.className = 'pq-status pq-status-complete';
      return;
    }

    const total = proofQueueState.steps.size;
    const checked = proofQueueState.checkedLocations.size;
    const inQueue = proofQueueState.queue.length;
    const available = proofQueueState.availableSteps.size;

    this._statusEl.textContent = `${checked}/${total} proved | ${inQueue} in queue | ${available} available`;
    this._statusEl.className = 'pq-status';
  }

  // ─── Drag and Drop ────────────────────────────────────────

  _onDragStart(e, queueIndex) {
    this._draggedIndex = queueIndex;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(queueIndex));
    // Add visual feedback after a tick
    requestAnimationFrame(() => {
      const row = this._queueEl.querySelector(`[data-queue-index="${queueIndex}"]`);
      if (row) row.classList.add('pq-dragging');
    });
  }

  _onDragEnd(e) {
    this._draggedIndex = null;
    this._dragOverIndex = null;
    // Remove all drag styling
    this._queueEl.querySelectorAll('.pq-dragging, .pq-drag-over').forEach(el => {
      el.classList.remove('pq-dragging', 'pq-drag-over');
    });
  }

  _onDragOver(e, queueIndex) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (this._dragOverIndex !== queueIndex) {
      // Remove old highlight
      this._queueEl.querySelectorAll('.pq-drag-over').forEach(el => {
        el.classList.remove('pq-drag-over');
      });
      this._dragOverIndex = queueIndex;
      const row = this._queueEl.querySelector(`[data-queue-index="${queueIndex}"]`);
      if (row) row.classList.add('pq-drag-over');
    }
  }

  _onDrop(e, toIndex) {
    e.preventDefault();
    const fromIndex = this._draggedIndex;
    if (fromIndex === null || fromIndex === toIndex) return;
    proofQueueState.moveInQueue(fromIndex, toIndex);
  }

  // ─── Toolbar Actions ──────────────────────────────────────

  _onAutoFill() {
    if (!proofQueueState) return;
    proofQueueState.autoFillQueue();
  }

  _onClear() {
    if (!proofQueueState) return;
    proofQueueState.clearUncheckedFromQueue();
  }

  _onCheckNext() {
    if (!proofQueueState || !_dispatcher) return;

    const nextStep = proofQueueState.getNextCheckableStep();
    if (nextStep === null) {
      log('info', 'No checkable step available');
      return;
    }

    const step = proofQueueState.steps.get(nextStep);
    if (!step) return;

    // Find region name for this location
    const staticData = stateManager.getStaticData();
    let regionName = step.locationName; // fallback
    if (staticData?.regions) {
      // Search for the region containing this location
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
      originator: 'ProofQueueCheck',
      originalDOMEvent: true,
    };

    log('info', `Checking location: ${step.locationName}`, payload);
    _dispatcher.publish('user:locationCheck', payload, {
      initialTarget: 'bottom',
    });
  }
}
