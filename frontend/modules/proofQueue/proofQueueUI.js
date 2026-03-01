/**
 * ProofQueueUI — GoldenLayout panel for the MetaMath Easy mode proof queue.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Proof Queue: 2p2e4                                     │  header
 *   ├──────────────────────────────────────────────────────────┤
 *   │  [Fill all] [Clear]  ☐ Auto-fill  [Check Next] ☐ Auto   │  toolbar row 1
 *   │  ☐ Show details & links                                 │  toolbar row 2
 *   ├──────────────────────────────────────────────────────────┤
 *   │  PROVEN STEPS                                           │  proven section
 *   │  Theorem 2p2e4: |- ( 2 + 2 ) = 4                       │
 *   │  Step │ Hyp │ Ref      │ Expression            │ Type   │
 *   │  1    │     │ 2cn      │ |- 2 e. CC            │ Thm    │
 *   │                                           Q.E.D.        │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  AVAILABLE STEPS (chips)                                │  working area
 *   │  [df-2] [df-3] [df-4]                                   │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  QUEUE (unchecked only)                                 │
 *   │  Step │ Hyp │ Ref    │ Expression        │ Type │ ×     │
 *   │  4    │     │ df-2   │ |- 2 = (1+1)      │ Def  │ ×     │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  3/10 proved | 2 in queue | 3 available                 │  status
 *   └──────────────────────────────────────────────────────────┘
 */

import {
  createEventBusGetter,
  createLogger,
  hasProofStructure,
  syncStateFromSnapshot,
  ensureStateLoaded,
  dispatchLocationCheck,
} from '../proofShared/proofUIHelpers.js';
import proofQueueState from './proofQueueStateSingleton.js';

// Module-level references set by index.js
let _moduleEventBus = null;
let _dispatcher = null;

export function setModuleEventBus(bus) { _moduleEventBus = bus; }
export function setDispatcher(dispatcher) { _dispatcher = dispatcher; }

const getEventBus = createEventBusGetter('proofQueue', () => _moduleEventBus);
const log = createLogger('proofQueueUI');

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
    this._statusEl = null;

    // New DOM references for proof table layout
    this._provenSectionEl = null;
    this._theoremHeaderEl = null;
    this._provenBodyEl = null;
    this._qedEl = null;
    this._workingAreaEl = null;
    this._queueBodyEl = null;

    // Checkbox references
    this._cbAutoFill = null;
    this._cbAutoCheck = null;
    this._cbShowDetails = null;

    // Proven step ordering
    this._provenOrder = [];

    // Drag state
    this._draggedIndex = null;
    this._dragOverIndex = null;

    // Track in-flight check to prevent double-clicks
    this._checkingStep = null;

    this._createBaseUI();
    this._setupLifecycle();
  }

  getRootElement() {
    return this.rootElement;
  }

  // ─── Step Classification ─────────────────────────────────

  /**
   * Classify a proof step label into type category.
   * @param {string} label - Step label (e.g. "ax-1cn", "df-2", "2cn")
   * @returns {{type: string, abbrev: string, cssClass: string}}
   */
  static _classifyStep(label) {
    if (label.startsWith('ax-')) {
      return { type: 'Axiom', abbrev: 'Ax', cssClass: 'pq-type-axiom' };
    }
    if (label.startsWith('df-')) {
      return { type: 'Definition', abbrev: 'Def', cssClass: 'pq-type-def' };
    }
    return { type: 'Theorem', abbrev: 'Thm', cssClass: 'pq-type-thm' };
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

    // Toolbar (two rows)
    this._toolbarEl = document.createElement('div');
    this._toolbarEl.className = 'pq-toolbar';

    // Row 1: buttons + checkboxes
    const row1 = document.createElement('div');
    row1.className = 'pq-toolbar-row';
    row1.innerHTML = `
      <button class="pq-btn pq-btn-autofill" title="Add all available steps in valid order">Fill all</button>
      <button class="pq-btn pq-btn-clear" title="Remove unchecked steps from queue">Clear</button>
      <label class="pq-checkbox-label"><input type="checkbox" class="pq-cb-autofill"> Auto-fill</label>
      <button class="pq-btn pq-btn-check" title="Check the next valid step">Check Next</button>
      <label class="pq-checkbox-label"><input type="checkbox" class="pq-cb-autocheck"> Auto-check</label>
    `;
    this._toolbarEl.appendChild(row1);

    // Row 2: show details
    const row2 = document.createElement('div');
    row2.className = 'pq-toolbar-row';
    row2.innerHTML = `
      <label class="pq-checkbox-label"><input type="checkbox" class="pq-cb-showdetails"> Show details &amp; links</label>
    `;
    this._toolbarEl.appendChild(row2);

    this.rootElement.appendChild(this._toolbarEl);

    // Cache checkbox references
    this._cbAutoFill = this._toolbarEl.querySelector('.pq-cb-autofill');
    this._cbAutoCheck = this._toolbarEl.querySelector('.pq-cb-autocheck');
    this._cbShowDetails = this._toolbarEl.querySelector('.pq-cb-showdetails');

    // ─── Proven Section ──────────────────────────────────
    this._provenSectionEl = document.createElement('div');
    this._provenSectionEl.className = 'pq-proven-section';
    this._provenSectionEl.style.display = 'none';

    // Section label
    const provenLabel = document.createElement('div');
    provenLabel.className = 'pq-section-label';
    provenLabel.textContent = 'Proven Steps';
    this._provenSectionEl.appendChild(provenLabel);

    // Theorem header
    this._theoremHeaderEl = document.createElement('div');
    this._theoremHeaderEl.className = 'pq-theorem-header';
    this._provenSectionEl.appendChild(this._theoremHeaderEl);

    // Proven table
    const provenTable = document.createElement('table');
    provenTable.className = 'pq-proven-table';
    const provenThead = document.createElement('thead');
    provenThead.innerHTML = `<tr>
      <th class="pq-col-step">Step</th>
      <th class="pq-col-hyp">Hyp</th>
      <th class="pq-col-ref">Ref</th>
      <th class="pq-col-expr">Expression</th>
      <th class="pq-col-type">Type</th>
    </tr>`;
    provenTable.appendChild(provenThead);
    this._provenBodyEl = document.createElement('tbody');
    provenTable.appendChild(this._provenBodyEl);
    this._provenSectionEl.appendChild(provenTable);

    // QED
    this._qedEl = document.createElement('div');
    this._qedEl.className = 'pq-qed';
    this._qedEl.style.display = 'none';
    this._provenSectionEl.appendChild(this._qedEl);

    this.rootElement.appendChild(this._provenSectionEl);

    // ─── Working Area ────────────────────────────────────
    this._workingAreaEl = document.createElement('div');
    this._workingAreaEl.className = 'pq-working-area';

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
    this._workingAreaEl.appendChild(poolSection);

    // Queue section (table-based)
    const queueSection = document.createElement('div');
    queueSection.className = 'pq-section pq-queue-section';
    const queueLabel = document.createElement('div');
    queueLabel.className = 'pq-section-label';
    queueLabel.textContent = 'Queue';
    queueSection.appendChild(queueLabel);

    const queueTable = document.createElement('table');
    queueTable.className = 'pq-queue-table';
    const queueThead = document.createElement('thead');
    queueThead.innerHTML = `<tr>
      <th class="pq-col-step">Step</th>
      <th class="pq-col-hyp">Hyp</th>
      <th class="pq-col-ref">Ref</th>
      <th class="pq-col-expr">Expression</th>
      <th class="pq-col-type">Type</th>
      <th class="pq-col-actions"></th>
    </tr>`;
    queueTable.appendChild(queueThead);
    this._queueBodyEl = document.createElement('tbody');
    queueTable.appendChild(this._queueBodyEl);
    queueSection.appendChild(queueTable);
    this._workingAreaEl.appendChild(queueSection);

    this.rootElement.appendChild(this._workingAreaEl);

    // Status bar
    this._statusEl = document.createElement('div');
    this._statusEl.className = 'pq-status';
    this._statusEl.textContent = 'Load a MetaMath game to begin.';
    this.rootElement.appendChild(this._statusEl);

    // ─── Wire toolbar handlers ───────────────────────────
    this._toolbarEl.querySelector('.pq-btn-autofill').addEventListener('click', () => this._onAutoFill());
    this._toolbarEl.querySelector('.pq-btn-clear').addEventListener('click', () => this._onClear());
    this._toolbarEl.querySelector('.pq-btn-check').addEventListener('click', () => this._onCheckNext());
    this._cbShowDetails.addEventListener('change', () => this.render());
    this._cbAutoFill.addEventListener('change', () => {
      if (this._cbAutoFill.checked) this._onAutoFill();
    });
    this._cbAutoCheck.addEventListener('change', () => {
      if (this._cbAutoCheck.checked) this._tryAutoCheck();
    });

    // Show empty state
    this._showEmptyState();
  }

  _showEmptyState() {
    this._poolEl.innerHTML = '<div class="pq-empty">No proof loaded</div>';
    this._queueBodyEl.innerHTML = '';
    this._provenBodyEl.innerHTML = '';
    this._provenSectionEl.style.display = 'none';
    this._qedEl.style.display = 'none';
    this._workingAreaEl.style.display = '';
    this._toolbarEl.style.display = 'none';
    this.rootElement.classList.remove('pq-complete');
  }

  // ─── Lifecycle ────────────────────────────────────────────

  _setupLifecycle() {
    Object.defineProperty(this, 'eventBus', {
      get: () => getEventBus(),
      configurable: true,
    });

    this._attachListeners();
    this.container.on('destroy', () => this.destroy());
  }

  _attachListeners() {
    this.destroy(); // Clear old

    const subscribe = (eventName, handler) => {
      const unsub = this.eventBus.subscribe(eventName, handler.bind(this));
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
    proofQueueState.onAvailableChanged = () => {
      // If auto-fill is enabled, fill the queue when new steps become available
      if (this._cbAutoFill && this._cbAutoFill.checked) {
        proofQueueState.autoFillQueue();
      }
      this.render();
    };
  }

  // ─── Event Handlers ───────────────────────────────────────

  _handleRulesLoaded() {
    log('info', 'Rules loaded, checking for proof structure');

    if (!hasProofStructure()) {
      log('info', 'Not a MetaMath game — hiding proof queue');
      this._showEmptyState();
      this._statusEl.textContent = 'This game has no proof structure.';
      return;
    }

    ensureStateLoaded(proofQueueState);

    if (proofQueueState && proofQueueState.isLoaded) {
      this._wireStateCallbacks();
      syncStateFromSnapshot(proofQueueState);
      this.render();
    }
  }

  _handleSnapshotUpdated(snapshotData) {
    if (!proofQueueState?.isLoaded) return;
    syncStateFromSnapshot(proofQueueState, snapshotData);
    this._checkingStep = null; // Clear in-flight guard after snapshot sync
    this.render();
  }

  _handleInventoryChanged() {
    if (!proofQueueState?.isLoaded) return;
    syncStateFromSnapshot(proofQueueState);
    this._checkingStep = null;
    this.render();
  }

  // ─── Proven Order ──────────────────────────────────────────

  /**
   * Rebuild the proven step order: starting statements first (sorted by index),
   * then checked queue steps in queue order.
   */
  _updateProvenOrder() {
    this._provenOrder = [];

    const checkedSet = proofQueueState.checkedLocations;
    const queueWithStatus = proofQueueState.getQueueWithStatus();

    // Collect starting statements (checked but not in queue)
    const inQueue = new Set(proofQueueState.queue);
    const startingSteps = [];
    for (const [index, step] of proofQueueState.steps) {
      if (checkedSet.has(step.locationName) && !inQueue.has(index)) {
        startingSteps.push(index);
      }
    }
    startingSteps.sort((a, b) => a - b);
    this._provenOrder.push(...startingSteps);

    // Then checked queue steps in queue order
    for (const entry of queueWithStatus) {
      if (entry.alreadyChecked) {
        this._provenOrder.push(entry.stepIndex);
      }
    }
  }

  // ─── Formatting Helpers ────────────────────────────────────

  /**
   * Format dependencies as proven table row numbers.
   * @param {number[]} dependencies - Step indices this step depends on
   * @param {Map<number, number>} stepToRow - Map of step index → proven row number
   * @returns {string}
   */
  _formatHyp(dependencies, stepToRow) {
    if (dependencies.length === 0) return '';
    return dependencies.map(depIdx => {
      const row = stepToRow.get(depIdx);
      return row !== undefined ? String(row) : '?';
    }).join(',');
  }

  /**
   * Format dependencies for queue rows (original step indices).
   * @param {number[]} dependencies
   * @returns {string}
   */
  _formatHypForQueue(dependencies) {
    if (dependencies.length === 0) return '';
    return dependencies.map(d => String(d)).join(',');
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

    // Rebuild proven order
    this._updateProvenOrder();

    // Render proven table
    this._renderProvenTable();

    const complete = proofQueueState.isProofComplete();

    if (complete) {
      // Hide working area, show only proven table + QED
      this._workingAreaEl.style.display = 'none';
      this.rootElement.classList.add('pq-complete');
    } else {
      // Show working area
      this._workingAreaEl.style.display = '';
      this.rootElement.classList.remove('pq-complete');
      this._renderPool();
      this._renderQueue();
    }

    this._renderStatus();

    // Auto-check cascade
    if (this._cbAutoCheck && this._cbAutoCheck.checked) {
      requestAnimationFrame(() => this._tryAutoCheck());
    }
  }

  _renderProvenTable() {
    this._provenBodyEl.innerHTML = '';

    if (this._provenOrder.length === 0) {
      this._provenSectionEl.style.display = 'none';
      this._qedEl.style.display = 'none';
      return;
    }

    this._provenSectionEl.style.display = '';

    // Show theorem header (prefer instantiated expression for concrete values)
    const goalStep = proofQueueState.steps.get(proofQueueState.goalStepIndex);
    if (goalStep) {
      const goalExpr = goalStep.instantiatedExpression || goalStep.expression;
      this._theoremHeaderEl.textContent = `Theorem ${proofQueueState.theoremName || goalStep.label}: ${goalExpr}`;
    }

    // Build stepIndex → row number map
    const stepToRow = new Map();
    for (let i = 0; i < this._provenOrder.length; i++) {
      stepToRow.set(this._provenOrder[i], i + 1);
    }

    const showDetails = this._cbShowDetails && this._cbShowDetails.checked;
    const isComplete = proofQueueState.isProofComplete();

    for (let i = 0; i < this._provenOrder.length; i++) {
      const stepIndex = this._provenOrder[i];
      const step = proofQueueState.steps.get(stepIndex);
      if (!step) continue;

      const tr = document.createElement('tr');
      tr.className = 'pq-proven-row';

      // Highlight the goal step
      if (stepIndex === proofQueueState.goalStepIndex) {
        tr.classList.add('pq-proven-goal');
      }

      const classification = ProofQueueUI._classifyStep(step.label);

      // Step column
      const tdStep = document.createElement('td');
      tdStep.className = 'pq-col-step';
      tdStep.textContent = String(i + 1);
      tr.appendChild(tdStep);

      // Hyp column
      const tdHyp = document.createElement('td');
      tdHyp.className = 'pq-col-hyp';
      tdHyp.textContent = this._formatHyp(step.dependencies, stepToRow);
      tr.appendChild(tdHyp);

      // Ref column
      const tdRef = document.createElement('td');
      tdRef.className = 'pq-col-ref';
      if (showDetails) {
        const link = document.createElement('a');
        link.className = 'pq-ref-link';
        link.href = `https://us.metamath.org/mpeuni/${step.label}.html`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = step.label;
        tdRef.appendChild(link);
      } else {
        tdRef.textContent = step.label;
      }
      tr.appendChild(tdRef);

      // Expression column (prefer instantiated expression for concrete values)
      const tdExpr = document.createElement('td');
      tdExpr.className = 'pq-col-expr';
      tdExpr.textContent = step.instantiatedExpression || step.expression;
      if (showDetails && step.fullText) {
        const detail = document.createElement('div');
        detail.className = 'pq-detail-text';
        detail.textContent = step.fullText;
        tdExpr.appendChild(detail);
        tdExpr.style.whiteSpace = 'normal';
      }
      tr.appendChild(tdExpr);

      // Type column
      const tdType = document.createElement('td');
      tdType.className = 'pq-col-type';
      const badge = document.createElement('span');
      badge.className = `pq-type-badge ${classification.cssClass}`;
      badge.textContent = classification.abbrev;
      badge.title = classification.type;
      tdType.appendChild(badge);
      tr.appendChild(tdType);

      this._provenBodyEl.appendChild(tr);
    }

    // Show/hide QED with theorem link
    if (isComplete) {
      this._qedEl.innerHTML = '';
      this._qedEl.appendChild(document.createTextNode('Q.E.D.'));
      const name = proofQueueState.theoremName;
      if (name) {
        const sep = document.createTextNode(' \u2014 ');
        const link = document.createElement('a');
        link.className = 'pq-ref-link';
        link.href = `https://us.metamath.org/mpeuni/${name}.html`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = name;
        this._qedEl.appendChild(sep);
        this._qedEl.appendChild(link);
      }
      this._qedEl.style.display = '';
    } else {
      this._qedEl.style.display = 'none';
    }
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
    this._queueBodyEl.innerHTML = '';

    const queueWithStatus = proofQueueState.getQueueWithStatus();
    // Only show unchecked entries
    const unchecked = [];
    for (let i = 0; i < queueWithStatus.length; i++) {
      const entry = queueWithStatus[i];
      if (!entry.alreadyChecked) {
        unchecked.push({ ...entry, originalIndex: i });
      }
    }

    if (unchecked.length === 0) {
      // Show empty in a row spanning all columns
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'pq-empty';
      td.textContent = 'Click steps above to add them to the queue';
      tr.appendChild(td);
      this._queueBodyEl.appendChild(tr);
      return;
    }

    const showDetails = this._cbShowDetails && this._cbShowDetails.checked;

    for (const entry of unchecked) {
      const { step, valid, checkable, missingDeps, originalIndex } = entry;
      if (!step) continue;

      const tr = document.createElement('tr');
      tr.className = 'pq-queue-row';
      tr.dataset.queueIndex = originalIndex;
      tr.dataset.stepIndex = step.index;

      // Status classes
      if (checkable) {
        tr.classList.add('pq-checkable');
      } else if (!valid) {
        tr.classList.add('pq-invalid');
      } else {
        tr.classList.add('pq-valid');
      }

      // Drag
      tr.draggable = true;
      tr.addEventListener('dragstart', (e) => this._onDragStart(e, originalIndex));
      tr.addEventListener('dragend', (e) => this._onDragEnd(e));
      tr.addEventListener('dragover', (e) => this._onDragOver(e, originalIndex));
      tr.addEventListener('drop', (e) => this._onDrop(e, originalIndex));

      const classification = ProofQueueUI._classifyStep(step.label);

      // Step column (original step index)
      const tdStep = document.createElement('td');
      tdStep.className = 'pq-col-step';
      tdStep.textContent = String(step.index);
      tr.appendChild(tdStep);

      // Hyp column (original dep indices)
      const tdHyp = document.createElement('td');
      tdHyp.className = 'pq-col-hyp';
      tdHyp.textContent = this._formatHypForQueue(step.dependencies);
      tr.appendChild(tdHyp);

      // Ref column
      const tdRef = document.createElement('td');
      tdRef.className = 'pq-col-ref';
      if (showDetails) {
        const link = document.createElement('a');
        link.className = 'pq-ref-link';
        link.href = `https://us.metamath.org/mpeuni/${step.label}.html`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = step.label;
        tdRef.appendChild(link);
      } else {
        tdRef.textContent = step.label;
      }
      tr.appendChild(tdRef);

      // Expression column (generic in working area)
      const tdExpr = document.createElement('td');
      tdExpr.className = 'pq-col-expr';
      tdExpr.textContent = step.expression;
      if (showDetails && step.fullText) {
        const detail = document.createElement('div');
        detail.className = 'pq-detail-text';
        detail.textContent = step.fullText;
        tdExpr.appendChild(detail);
        tdExpr.style.whiteSpace = 'normal';
      }
      // Missing deps hint inside expression cell
      if (!valid && missingDeps.length > 0) {
        const depInfo = document.createElement('div');
        depInfo.className = 'pq-row-deps';
        depInfo.textContent = 'Needs: ' + missingDeps.map(d => proofQueueState.steps.get(d)?.label || `#${d}`).join(', ');
        tdExpr.appendChild(depInfo);
      }
      tr.appendChild(tdExpr);

      // Type column
      const tdType = document.createElement('td');
      tdType.className = 'pq-col-type';
      const badge = document.createElement('span');
      badge.className = `pq-type-badge ${classification.cssClass}`;
      badge.textContent = classification.abbrev;
      badge.title = classification.type;
      tdType.appendChild(badge);
      tr.appendChild(tdType);

      // Actions column (remove button)
      const tdActions = document.createElement('td');
      tdActions.className = 'pq-col-actions';
      const removeBtn = document.createElement('button');
      removeBtn.className = 'pq-row-remove';
      removeBtn.textContent = '\u00D7'; // ×
      removeBtn.title = 'Remove from queue';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        proofQueueState.removeFromQueue(step.index);
      });
      tdActions.appendChild(removeBtn);
      tr.appendChild(tdActions);

      this._queueBodyEl.appendChild(tr);
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
    const available = proofQueueState.availableSteps.size;

    // Count only unchecked queue entries
    const queueWithStatus = proofQueueState.getQueueWithStatus();
    const inQueue = queueWithStatus.filter(e => !e.alreadyChecked).length;

    this._statusEl.textContent = `${checked}/${total} proved | ${inQueue} in queue | ${available} available`;
    this._statusEl.className = 'pq-status';
  }

  // ─── Auto Check ────────────────────────────────────────────

  /**
   * If auto-check is enabled and no check is in-flight, check the next step.
   * Deferred via requestAnimationFrame to avoid blocking renders.
   * The cascade works: check completes → snapshot update → render() → auto-check again.
   */
  _tryAutoCheck() {
    if (!this._cbAutoCheck || !this._cbAutoCheck.checked) return;
    if (this._checkingStep !== null) return;
    if (!proofQueueState || !_dispatcher) return;
    if (proofQueueState.isProofComplete()) return;

    const nextStep = proofQueueState.getNextCheckableStep();
    if (nextStep === null) return;

    const step = proofQueueState.steps.get(nextStep);
    if (!step) return;

    this._checkingStep = nextStep;

    dispatchLocationCheck(step, proofQueueState, _dispatcher, 'ProofQueueCheck', log, () => {
      this._checkingStep = null;
      this.render();
    });
  }

  // ─── Drag and Drop ────────────────────────────────────────

  _onDragStart(e, queueIndex) {
    this._draggedIndex = queueIndex;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(queueIndex));
    // Add visual feedback after a tick
    requestAnimationFrame(() => {
      const row = this._queueBodyEl.querySelector(`tr[data-queue-index="${queueIndex}"]`);
      if (row) row.classList.add('pq-dragging');
    });
  }

  _onDragEnd(e) {
    this._draggedIndex = null;
    this._dragOverIndex = null;
    // Remove all drag styling
    this._queueBodyEl.querySelectorAll('.pq-dragging, .pq-drag-over').forEach(el => {
      el.classList.remove('pq-dragging', 'pq-drag-over');
    });
  }

  _onDragOver(e, queueIndex) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (this._dragOverIndex !== queueIndex) {
      // Remove old highlight
      this._queueBodyEl.querySelectorAll('.pq-drag-over').forEach(el => {
        el.classList.remove('pq-drag-over');
      });
      this._dragOverIndex = queueIndex;
      const row = this._queueBodyEl.querySelector(`tr[data-queue-index="${queueIndex}"]`);
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

    // Prevent double-clicks while a check is in-flight
    if (this._checkingStep !== null) {
      log('info', 'Check already in progress, ignoring');
      return;
    }

    const nextStep = proofQueueState.getNextCheckableStep();
    if (nextStep === null) {
      log('info', 'No checkable step available');
      return;
    }

    const step = proofQueueState.steps.get(nextStep);
    if (!step) return;

    // Mark step as in-flight; cleared when snapshot sync updates checked locations
    this._checkingStep = nextStep;

    dispatchLocationCheck(step, proofQueueState, _dispatcher, 'ProofQueueCheck', log, () => {
      this._checkingStep = null;
      this.render();
    });
  }
}
