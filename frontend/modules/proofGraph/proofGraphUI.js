/**
 * ProofGraphUI — Cytoscape-based graph construction puzzle for MetaMath Medium mode.
 *
 * The player sees proof step nodes and must draw dependency edges between them.
 * Correct edges stick; incorrect edges are rejected with visual feedback.
 * When all incoming edges for a step are drawn, the step becomes checkable.
 */

import {
  createEventBusGetter,
  createLogger,
  hasProofStructure,
  syncStateFromSnapshot,
  ensureStateLoaded,
  dispatchLocationCheck,
} from '../proofShared/proofUIHelpers.js';
import proofGraphState from './proofGraphStateSingleton.js';

// Module-level references set by index.js
let _moduleEventBus = null;
let _dispatcher = null;

export function setModuleEventBus(bus) { _moduleEventBus = bus; }
export function setDispatcher(dispatcher) { _dispatcher = dispatcher; }

const getEventBus = createEventBusGetter('proofGraph', () => _moduleEventBus);
const log = createLogger('proofGraphUI');

export class ProofGraphUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    this.rootElement = null;
    this.unsubscribeHandles = [];
    this.isInitialized = false;

    // Cytoscape instance
    this.cy = null;
    this.cytoscape = null;
    this.eh = null; // edgehandles instance
    this.nodeRows = new Map(); // Row assignment per node for hierarchical layout

    // DOM references
    this._headerEl = null;
    this._toolbarEl = null;
    this._graphContainer = null;
    this._statusEl = null;

    // Track in-flight check to prevent double-clicks
    this._checkingStep = null;

    this._createBaseUI();
    this._setupLifecycle();
  }

  getRootElement() {
    return this.rootElement;
  }

  // ─── Base UI Construction ────────────────────────────────

  _createBaseUI() {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'proof-graph-panel';

    // Header
    this._headerEl = document.createElement('div');
    this._headerEl.className = 'pg-header';
    this._headerEl.textContent = 'Proof Graph';
    this.rootElement.appendChild(this._headerEl);

    // Toolbar
    this._toolbarEl = document.createElement('div');
    this._toolbarEl.className = 'pg-toolbar';
    this._toolbarEl.innerHTML = `
      <button class="pg-btn pg-btn-layout" title="Re-run layout algorithm">Re-layout</button>
      <button class="pg-btn pg-btn-fit" title="Fit graph to viewport">Fit</button>
      <button class="pg-btn pg-btn-check" title="Check a fully-connected step">Check Next</button>
    `;
    this.rootElement.appendChild(this._toolbarEl);

    // Graph container
    this._graphContainer = document.createElement('div');
    this._graphContainer.className = 'pg-graph-container';
    this.rootElement.appendChild(this._graphContainer);

    // Status bar
    this._statusEl = document.createElement('div');
    this._statusEl.className = 'pg-status';
    this._statusEl.textContent = 'Load a MetaMath game to begin.';
    this.rootElement.appendChild(this._statusEl);

    // Toolbar handlers
    this._toolbarEl.querySelector('.pg-btn-layout').addEventListener('click', () => this._runLayout());
    this._toolbarEl.querySelector('.pg-btn-fit').addEventListener('click', () => this._fitGraph());
    this._toolbarEl.querySelector('.pg-btn-check').addEventListener('click', () => this._onCheckNext());

    this._toolbarEl.style.display = 'none';
  }

  // ─── Lifecycle ────────────────────────────────────────────

  _setupLifecycle() {
    Object.defineProperty(this, 'eventBus', {
      get: () => getEventBus(),
      configurable: true,
    });

    this._attachListeners();
    this.container.on('destroy', () => this.destroy());
    this.container.on('show', () => this._onPanelShow());

    // Late-initialization: if proof data is already loaded (e.g. component
    // created after stateManager:rulesLoaded already fired), start immediately.
    if (proofGraphState.isLoaded && !this.cy) {
      log('info', 'State already loaded at construction time — starting Cytoscape load');
      syncStateFromSnapshot(proofGraphState);
      this._loadCytoscape();
    } else if (hasProofStructure() && !proofGraphState.isLoaded) {
      log('info', 'Proof structure available but state not loaded — loading from static data');
      ensureStateLoaded(proofGraphState);
      if (proofGraphState.isLoaded) {
        syncStateFromSnapshot(proofGraphState);
        this._loadCytoscape();
      }
    }
  }

  _attachListeners() {
    this.destroy();

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

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this.eh) {
      this.eh.destroy();
      this.eh = null;
    }
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
  }

  _onPanelShow() {
    if (this.cy) {
      this.cy.resize();
    } else if (this.cytoscape && proofGraphState.isLoaded) {
      this._initializeGraph();
    }
  }

  // ─── Cytoscape Loading ────────────────────────────────────

  _loadCytoscape() {
    // Prevent duplicate load attempts
    if (this._cytoscapeLoading || this.cy) return;

    log('info', 'Loading Cytoscape libraries...');
    this._statusEl.textContent = 'Loading graph libraries...';

    this._cytoscapeLoading = true;

    // Load scripts then initialize. Use window globals as source of truth
    // for whether each script is already loaded (avoids DOM query race conditions).
    const scripts = [
      { src: './libs/cytoscape/cytoscape.min.js', check: () => window.cytoscape, label: 'Cytoscape core' },
      { src: './libs/cytoscape/lodash-shim.js', check: () => window._, label: 'Lodash shim' },
      { src: './libs/cytoscape/cytoscape-edgehandles.js', check: () => window.cytoscapeEdgehandles, label: 'Edgehandles' },
    ];

    const loadNext = (idx) => {
      if (idx >= scripts.length) {
        // All loaded — register and initialize
        this.cytoscape = window.cytoscape;
        log('info', 'Cytoscape libraries loaded');
        this._cytoscapeLoading = false;
        this._statusEl.textContent = 'Initializing graph...';
        this._initializeGraph();
        return;
      }

      const { src, check, label } = scripts[idx];
      this._statusEl.textContent = `Loading ${label}...`;

      // Already available via window global? Skip loading.
      if (check()) {
        log('info', `${label} already available`);
        loadNext(idx + 1);
        return;
      }

      this._loadScript(src, () => {
        log('info', `${label} loaded`);
        loadNext(idx + 1);
      });
    };

    loadNext(0);
  }

  _loadScript(src, onload) {
    // Check for an existing script element (may have been inserted by another code path)
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      // Script tag exists — it may be still loading. Wait for it.
      if (existing.complete || existing.readyState === 'complete') {
        onload();
        return;
      }
      let handled = false;
      const done = () => {
        if (handled) return;
        handled = true;
        onload();
      };
      existing.addEventListener('load', done);
      setTimeout(() => { if (!handled) done(); }, 5000); // Safety fallback
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => onload();
    script.onerror = (err) => {
      log('error', `Failed to load ${src}`, err);
      this._statusEl.textContent = `Error loading library: ${src}`;
      this._cytoscapeLoading = false;
    };
    document.head.appendChild(script);
  }

  // ─── Graph Initialization ─────────────────────────────────

  _initializeGraph() {
    if (this.cy) return; // Already initialized

    if (!this.cytoscape || !proofGraphState.isLoaded) {
      log('info', 'Waiting for Cytoscape or proof data...');
      return;
    }

    const rect = this._graphContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      log('info', 'Container not visible, deferring to tab show event');
      this._statusEl.textContent = 'Waiting for panel to become visible...';
      return;
    }

    log('info', 'Initializing proof graph...');

    // Build node elements
    const elements = this._buildGraphElements();

    // Create Cytoscape instance
    this.cy = this.cytoscape({
      container: this._graphContainer,
      elements: elements,
      style: this._getGraphStyles(),
      layout: { name: 'preset' }, // We'll run layout after adding elements
      minZoom: 0.3,
      maxZoom: 3,
    });

    // Initialize edgehandles
    this._initEdgehandles();

    // Node click handler: check step
    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const stepIndex = parseInt(node.id(), 10);
      if (proofGraphState.isStepCheckable(stepIndex)) {
        this._checkStep(stepIndex);
      }
    });

    // Show toolbar
    this._toolbarEl.style.display = '';

    // Wire state callbacks
    this._wireStateCallbacks();

    // Resize handler: keep Cytoscape in sync with container size changes.
    this._resizeObserver = new ResizeObserver(() => {
      if (this.cy) this.cy.resize();
    });
    this._resizeObserver.observe(this._graphContainer);

    // Schedule the initial layout using rAF chaining to ensure the browser
    // has painted the Cytoscape canvas at its final container size.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.cy) {
          this.cy.resize();
          this._runLayout();
        }
      });
    });

    // Update status
    this._updateStatus();
    this._updateNodeClasses();

    log('info', 'Proof graph initialized');
  }

  _buildGraphElements() {
    const elements = [];

    for (const [index, step] of proofGraphState.steps) {
      const isAxiom = step.dependencies.length === 0;
      const isCheckable = proofGraphState.isStepCheckable(index);
      const isChecked = proofGraphState.checkedLocations.has(step.locationName);
      const isComplete = proofGraphState._isStepFullyConnected(index);

      const classes = ['proof-node'];
      if (isAxiom) classes.push('axiom');
      if (isCheckable) classes.push('checkable');
      if (isChecked) classes.push('checked');
      if (isComplete && !isChecked) classes.push('connected');
      if (index === proofGraphState.goalStepIndex) classes.push('goal');

      elements.push({
        group: 'nodes',
        data: {
          id: String(index),
          label: step.label,
          expression: step.expression,
          depCount: step.dependencies.length,
          drawnCount: proofGraphState.getDrawnDependenciesFor(index).length,
          fullText: step.fullText || '',
        },
        classes: classes.join(' '),
      });
    }

    // Add already-drawn edges
    for (const edgeKey of proofGraphState.drawnEdges) {
      const edge = proofGraphState.correctEdges.get(edgeKey);
      if (edge) {
        elements.push({
          group: 'edges',
          data: {
            id: `edge-${edge.source}-${edge.target}`,
            source: String(edge.source),
            target: String(edge.target),
          },
          classes: 'drawn-edge',
        });
      }
    }

    return elements;
  }

  _getGraphStyles() {
    return [
      // ─── Base Node Style ────────────────────────
      {
        selector: 'node.proof-node',
        style: {
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '11px',
          'font-weight': 'bold',
          'color': '#cdd6f4',
          'text-outline-color': '#1e1e2e',
          'text-outline-width': '2px',
          'width': '60px',
          'height': '40px',
          'shape': 'roundrectangle',
          'background-color': '#45475a',
          'border-width': '2px',
          'border-color': '#585b70',
          'text-wrap': 'wrap',
          'text-max-width': '55px',
        },
      },
      // ─── Axiom (no deps) ────────────────────────
      {
        selector: 'node.axiom',
        style: {
          'background-color': '#313244',
          'border-color': '#89b4fa',
          'border-style': 'dashed',
        },
      },
      // ─── Fully connected (all edges drawn, waiting on items/proofs) ──
      {
        selector: 'node.connected',
        style: {
          'background-color': '#2a2520',
          'border-color': '#f9e2af',
          'border-width': '3px',
        },
      },
      // ─── Checkable (connected + not checked) ────
      {
        selector: 'node.checkable',
        style: {
          'background-color': '#1a3328',
          'border-color': '#a6e3a1',
          'border-width': '4px',
        },
      },
      // ─── Checked (location complete) ────────────
      {
        selector: 'node.checked',
        style: {
          'background-color': '#11111b',
          'border-color': '#6c7086',
          'border-width': '2px',
          'opacity': 0.6,
          'color': '#6c7086',
        },
      },
      // ─── Goal node ──────────────────────────────
      {
        selector: 'node.goal',
        style: {
          'width': '70px',
          'height': '50px',
          'border-width': '3px',
          'font-size': '12px',
        },
      },
      // ─── Drawn edge ─────────────────────────────
      {
        selector: 'edge.drawn-edge',
        style: {
          'width': 2,
          'line-color': '#a6e3a1',
          'target-arrow-color': '#a6e3a1',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 0.8,
        },
      },
      // ─── Edgehandles ghost/preview ──────────────
      {
        selector: '.eh-ghost-edge',
        style: {
          'width': 2,
          'line-color': '#89b4fa',
          'target-arrow-color': '#89b4fa',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 0.5,
          'line-style': 'dashed',
        },
      },
      {
        selector: '.eh-preview',
        style: {
          'background-color': '#89b4fa',
          'border-color': '#89b4fa',
          'border-width': '3px',
        },
      },
      {
        selector: '.eh-source',
        style: {
          'border-color': '#89b4fa',
          'border-width': '3px',
        },
      },
      {
        selector: '.eh-target',
        style: {
          'border-color': '#f9e2af',
          'border-width': '3px',
        },
      },
      {
        selector: '.eh-presumptive-target',
        style: {
          'border-color': '#f9e2af',
          'border-width': '3px',
        },
      },
      // ─── Reject flash ──────────────────────────
      {
        selector: 'node.reject-flash',
        style: {
          'border-color': '#f38ba8',
          'border-width': '4px',
          'background-color': '#2a1a22',
        },
      },
      // ─── Success flash ─────────────────────────
      {
        selector: 'node.success-flash',
        style: {
          'border-color': '#a6e3a1',
          'border-width': '4px',
          'background-color': '#1a3328',
        },
      },
      // ─── Edge counter label ─────────────────────
      {
        selector: 'node.proof-node[depCount > 0]',
        style: {
          'label': (ele) => {
            const label = ele.data('label');
            const drawn = ele.data('drawnCount');
            const total = ele.data('depCount');
            return `${label}\n${drawn}/${total}`;
          },
          'font-size': '10px',
        },
      },
    ];
  }

  // ─── Edgehandles ──────────────────────────────────────────

  _initEdgehandles() {
    if (!this.cy || !window.cytoscapeEdgehandles) {
      log('warn', 'Cannot init edgehandles: missing dependencies');
      return;
    }

    this.eh = this.cy.edgehandles({
      snap: true,
      snapThreshold: 30,
      snapFrequency: 15,
      noEdgeEventsInDraw: true,
      disableBrowserGestures: true,

      // Can we start drawing from this node?
      handleNodes: 'node.proof-node',

      // Preview (ghost) edge while drawing
      preview: true,
      ghostEdgePairs: true,

      // Can this edge be created? Allow any non-self-loop, non-duplicate edge
      // so the player can attempt incorrect edges (which get rejected with feedback).
      canConnect: (sourceNode, targetNode) => {
        const sourceIdx = parseInt(sourceNode.id(), 10);
        const targetIdx = parseInt(targetNode.id(), 10);
        if (sourceIdx === targetIdx) return false;
        // Don't allow edges that are already drawn
        const edgeKey = `${sourceIdx}->${targetIdx}`;
        return !proofGraphState.drawnEdges.has(edgeKey);
      },

      // Edge parameters for the created edge
      edgeParams: (sourceNode, targetNode) => {
        return {
          data: {
            source: sourceNode.id(),
            target: targetNode.id(),
          },
          classes: 'drawn-edge',
        };
      },
    });

    // Handle edge completion via Cytoscape event.
    this.cy.on('ehcomplete', (event, sourceNode, targetNode, addedEdge) => {
      const sourceIdx = parseInt(sourceNode.id(), 10);
      const targetIdx = parseInt(targetNode.id(), 10);

      const result = proofGraphState.tryDrawEdge(sourceIdx, targetIdx);

      if (result.success) {
        // Edge already added by edgehandles — set proper ID and class
        addedEdge.data('id', `edge-${sourceIdx}-${targetIdx}`);
        addedEdge.addClass('drawn-edge');
        this._flashNode(targetNode, 'success-flash');
        // Move target node to the row below its source nodes
        this._updateRowAfterEdge(targetIdx);
        this._layoutFromRows(true);
        log('info', `Edge drawn: ${sourceIdx} -> ${targetIdx}`);
      } else {
        // Remove the edge that edgehandles added
        addedEdge.remove();

        if (result.reason === 'incorrect') {
          this._flashNode(targetNode, 'reject-flash');
          this._flashNode(sourceNode, 'reject-flash');
          log('info', `Edge rejected: ${sourceIdx} -> ${targetIdx}`);
        }
      }

      this._updateNodeClasses();
      this._updateStatus();
    });

    // Enable drawing mode
    this.eh.enableDrawMode();

    log('info', 'Edgehandles initialized and draw mode enabled');
  }

  // ─── Node Class Updates ───────────────────────────────────

  _updateNodeClasses() {
    if (!this.cy) return;

    for (const [index, step] of proofGraphState.steps) {
      const node = this.cy.getElementById(String(index));
      if (node.empty()) continue;

      const isAxiom = step.dependencies.length === 0;
      const isCheckable = proofGraphState.isStepCheckable(index);
      const isChecked = proofGraphState.checkedLocations.has(step.locationName);
      const isComplete = proofGraphState._isStepFullyConnected(index);

      // Update data for label refresh
      node.data('drawnCount', proofGraphState.getDrawnDependenciesFor(index).length);

      // Update classes
      node.removeClass('axiom connected checkable checked');
      if (isChecked) {
        node.addClass('checked');
      } else if (isCheckable) {
        node.addClass('checkable');
      } else if (isComplete) {
        node.addClass('connected');
      } else if (isAxiom) {
        node.addClass('axiom');
      }
    }
  }

  _flashNode(node, className) {
    node.addClass(className);
    setTimeout(() => {
      node.removeClass(className);
    }, 600);
  }

  // ─── Layout ───────────────────────────────────────────────

  _runLayout() {
    if (!this.cy) return;

    // Force Cytoscape to re-read the container dimensions
    this.cy.resize();

    this._recalculateAllRows();
    this._layoutFromRows(false);
  }

  // ─── Row-based Layout Helpers ──────────────────────────────

  /**
   * Recalculate all node rows from scratch based on drawn edges.
   * Axioms start at row 0, all others at row 1, then drawn edges
   * push targets to max(source rows) + 1.
   */
  _recalculateAllRows() {
    this.nodeRows.clear();
    for (const [index, step] of proofGraphState.steps) {
      this.nodeRows.set(String(index), step.dependencies.length === 0 ? 0 : 1);
    }

    // Recompute rows based on drawn edges in topological order
    const visited = new Set();
    const visit = (idx) => {
      const id = String(idx);
      if (visited.has(id)) return;
      visited.add(id);

      const drawnSources = proofGraphState.getDrawnDependenciesFor(idx);
      if (drawnSources.length === 0) return;

      // Ensure all sources are visited first
      for (const srcIdx of drawnSources) {
        visit(srcIdx);
      }

      let maxSourceRow = 0;
      for (const srcIdx of drawnSources) {
        const srcRow = this.nodeRows.get(String(srcIdx)) || 0;
        if (srcRow > maxSourceRow) maxSourceRow = srcRow;
      }

      const newRow = maxSourceRow + 1;
      if (newRow > (this.nodeRows.get(id) || 0)) {
        this.nodeRows.set(id, newRow);
      }
    };

    for (const [index] of proofGraphState.steps) {
      visit(index);
    }
  }

  /**
   * Update row assignment for a target node after a new edge is drawn.
   */
  _updateRowAfterEdge(targetIdx) {
    const targetId = String(targetIdx);
    const drawnSources = proofGraphState.getDrawnDependenciesFor(targetIdx);
    if (drawnSources.length === 0) return;

    let maxSourceRow = 0;
    for (const srcIdx of drawnSources) {
      const srcRow = this.nodeRows.get(String(srcIdx)) || 0;
      if (srcRow > maxSourceRow) maxSourceRow = srcRow;
    }

    const newRow = maxSourceRow + 1;
    const currentRow = this.nodeRows.get(targetId) || 0;

    if (newRow > currentRow) {
      this.nodeRows.set(targetId, newRow);

      // Cascade: update targets of outgoing drawn edges
      for (const edgeKey of proofGraphState.drawnEdges) {
        const parts = edgeKey.split('->');
        if (parseInt(parts[0], 10) === targetIdx) {
          this._updateRowAfterEdge(parseInt(parts[1], 10));
        }
      }
    }
  }

  /**
   * Position all nodes based on their current row assignments.
   * @param {boolean} animate - Whether to animate the transition
   */
  _layoutFromRows(animate = false) {
    if (!this.cy) return;

    // Group nodes by row
    const rowGroups = new Map();
    for (const [id, row] of this.nodeRows) {
      if (!rowGroups.has(row)) rowGroups.set(row, []);
      rowGroups.get(row).push(id);
    }

    const sortedRows = [...rowGroups.keys()].sort((a, b) => a - b);
    if (sortedRows.length === 0) return;

    const rect = this._graphContainer.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;
    const pad = 60;
    const rowCount = sortedRows.length;
    const rowHeight = (h - pad * 2) / Math.max(rowCount, 1);

    const positions = new Map();
    sortedRows.forEach((row, rowVisualIdx) => {
      const ids = rowGroups.get(row);
      ids.sort((a, b) => Number(a) - Number(b));
      const y = pad + rowHeight * rowVisualIdx + rowHeight / 2;
      const colWidth = (w - pad * 2) / (ids.length + 1);
      ids.forEach((id, colIdx) => {
        positions.set(id, {
          x: pad + colWidth * (colIdx + 1),
          y: y,
        });
      });
    });

    if (animate) {
      for (const [id, pos] of positions) {
        const node = this.cy.getElementById(id);
        if (node.length) {
          node.animate({ position: pos }, { duration: 300 });
        }
      }
    } else {
      this.cy.batch(() => {
        for (const [id, pos] of positions) {
          const node = this.cy.getElementById(id);
          if (node.length) node.position(pos);
        }
      });
      this.cy.zoom(1);
      this.cy.pan({ x: 0, y: 0 });
    }
  }

  _fitGraph() {
    if (!this.cy) return;
    this.cy.fit(undefined, 40);
  }

  // ─── Status ───────────────────────────────────────────────

  _updateStatus() {
    if (!proofGraphState.isLoaded) {
      this._statusEl.textContent = 'Load a MetaMath game to begin.';
      this._statusEl.className = 'pg-status';
      return;
    }

    if (proofGraphState.isProofComplete()) {
      this._statusEl.textContent = 'Proof complete!';
      this._statusEl.className = 'pg-status pg-status-complete';
      return;
    }

    const drawn = proofGraphState.drawnEdges.size;
    const total = proofGraphState.getTotalEdgeCount();
    const checked = proofGraphState.checkedLocations.size;
    const totalSteps = proofGraphState.steps.size;
    const wrong = proofGraphState.incorrectAttempts;

    let text = `Edges: ${drawn}/${total} | Steps: ${checked}/${totalSteps}`;
    if (wrong > 0) text += ` | Wrong: ${wrong}`;
    this._statusEl.textContent = text;
    this._statusEl.className = 'pg-status';
  }

  // ─── Event Handlers ───────────────────────────────────────

  _handleRulesLoaded() {
    log('info', 'Rules loaded, checking for proof structure');

    if (!hasProofStructure()) {
      log('info', 'Not a MetaMath game — hiding proof graph');
      this._statusEl.textContent = 'This game has no proof structure.';
      this._toolbarEl.style.display = 'none';
      return;
    }

    ensureStateLoaded(proofGraphState);

    if (proofGraphState.isLoaded) {
      syncStateFromSnapshot(proofGraphState);
      this._loadCytoscape();
    }
  }

  _handleSnapshotUpdated(snapshotData) {
    if (!proofGraphState.isLoaded) return;
    syncStateFromSnapshot(proofGraphState, snapshotData);
    this._checkingStep = null; // Clear in-flight guard after snapshot sync
    this._updateNodeClasses();
    this._updateStatus();
  }

  _handleInventoryChanged() {
    if (!proofGraphState.isLoaded) return;
    syncStateFromSnapshot(proofGraphState);
    this._checkingStep = null;
    this._updateNodeClasses();
    this._updateStatus();
  }

  // ─── Actions ──────────────────────────────────────────────

  _onCheckNext() {
    if (!proofGraphState.isLoaded || !_dispatcher) return;

    // Prevent double-clicks while a check is in-flight
    if (this._checkingStep !== null) {
      log('info', 'Check already in progress, ignoring');
      return;
    }

    // Find first checkable step
    for (const [index] of proofGraphState.steps) {
      if (proofGraphState.isStepCheckable(index)) {
        this._checkStep(index);
        return;
      }
    }

    log('info', 'No checkable step available');
  }

  _checkStep(stepIndex) {
    const step = proofGraphState.steps.get(stepIndex);
    if (!step || !_dispatcher) return;

    // Prevent double-clicks while a check is in-flight
    if (this._checkingStep !== null) {
      log('info', 'Check already in progress, ignoring');
      return;
    }

    this._checkingStep = stepIndex;

    dispatchLocationCheck(step, proofGraphState, _dispatcher, 'ProofGraphCheck', log, () => {
      this._checkingStep = null;
      this._updateNodeClasses();
      this._updateStatus();
    });
  }

  // ─── State Wiring ─────────────────────────────────────────

  _wireStateCallbacks() {
    proofGraphState.onStateChanged = () => {
      this._updateNodeClasses();
      this._updateStatus();
    };
  }
}
