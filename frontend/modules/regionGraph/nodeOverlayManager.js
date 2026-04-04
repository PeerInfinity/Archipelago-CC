import { createUniversalLogger } from '../../app/core/universalLogger.js';

const logger = createUniversalLogger('regionGraph:overlays');

// Dimensions used for pre-sizing nodes before layout runs.  These should
// match the largest expected overlay card (two-line title + meta + badges)
// so the layout algorithm allocates enough space between nodes.
// After layout completes, nodes are shrunk back so edge lines terminate
// well inside the overlay rather than at or past its boundary.
const LAYOUT_WIDTH = 120;
const LAYOUT_HEIGHT = 80;

/**
 * Manages DOM overlays rendered on top of Cytoscape graph nodes.
 *
 * Overlay providers are registered by external modules (e.g. vibeCodingSim)
 * via the regionGraph public API.  The provider interface is:
 *
 *   { create(nodeId, nodeData): HTMLElement | null,
 *     update?(nodeId, nodeData, existingEl): void }
 *
 * If the provider supplies `update`, refreshes will patch existing elements
 * in-place instead of tearing everything down.
 *
 * A simpler callback form `(nodeId, nodeData) => HTMLElement | null` is also
 * accepted and auto-wrapped (update = full rebuild).
 */
export class NodeOverlayManager {
  constructor(ui) {
    this.ui = ui;
    this.provider = null;          // { create, update? }
    this._overlayElements = new Map(); // nodeId → DOM element
    this._cyListeners = null;      // stored so we can remove them
    this._overlayStyleApplied = false;
  }

  // --- Public API (called from index.js public functions) ---

  /**
   * Register an overlay provider.  Accepts either:
   *   - a plain callback  (nodeId, nodeData) => HTMLElement | null
   *   - an object { create(nodeId, nodeData): HTMLElement|null, update?(nodeId, nodeData, el): void }
   */
  registerProvider(providerOrCallback) {
    if (typeof providerOrCallback === 'function') {
      this.provider = { create: providerOrCallback };
    } else {
      this.provider = providerOrCallback;
    }
    this._ensureContainer();
    this._bindCyEvents();
    if (this.ui.cy && this.ui.graphInitialized) {
      this.presizeNodes();
      this.rebuild();
    }
  }

  /**
   * Remove the current overlay provider and tear down all overlay DOM/state.
   */
  unregisterProvider() {
    this.provider = null;
    this._teardownOverlays();
    this._unbindCyEvents();
  }

  /**
   * Refresh overlays after external state changes.
   * Uses `provider.update()` for in-place patching when available.
   */
  refresh() {
    if (!this.provider || !this.ui.cy) return;
    if (this.provider.update && this._overlayElements.size > 0) {
      this._updateInPlace();
    } else {
      this.rebuild();
    }
  }

  /**
   * Full rebuild — called when graph data changes (new rules loaded, etc).
   */
  rebuild() {
    if (!this.provider || !this.ui.cy) return;
    const container = this._getContainer();
    if (!container) return;

    container.innerHTML = '';
    this._overlayElements.clear();

    this.ui.cy.nodes('.region').forEach(node => {
      if (node.hasClass('player')) return;
      const nodeId = node.data('regionName') || node.id();
      const el = this.provider.create(nodeId, node.data());
      if (!el) return;

      el.style.position = 'absolute';
      el.dataset.nodeId = nodeId;
      this._attachInteractionHandlers(el, nodeId, node);
      container.appendChild(el);
      this._overlayElements.set(nodeId, el);
    });

    this._syncViewport();
    this._applyStyleOverrides();
    this._shrinkNodes();
    // Defer position sync until browser has laid out the elements
    requestAnimationFrame(() => this._syncPositions());
  }

  /**
   * Called after graph data is (re-)built by GraphDataManager.
   */
  onGraphRebuilt() {
    if (this.provider) this.rebuild();
  }

  // --- Layout integration ---

  /** Whether a provider is currently active. */
  get active() { return !!this.provider; }

  /**
   * Pre-size region nodes so layout algorithms allocate enough space.
   * Called before layout runs.  After layout completes, _shrinkNodes()
   * removes these inline overrides so edge lines terminate inside overlays.
   */
  presizeNodes() {
    if (!this.ui.cy || !this.provider) return;
    this.ui.cy.nodes('.region').forEach(node => {
      if (node.hasClass('player')) return;
      node.style({ width: LAYOUT_WIDTH, height: LAYOUT_HEIGHT, shape: 'rectangle' });
    });
  }

  /**
   * Remove inline width/height set by presizeNodes(), letting nodes fall back
   * to the base stylesheet dimensions (60x45).  This ensures edge lines
   * terminate well inside any overlay card rather than at or past its boundary.
   */
  _shrinkNodes() {
    if (!this.ui.cy) return;
    this.ui.cy.nodes('.has-overlay').removeStyle('width height');
  }


  // --- Container management ---

  _ensureContainer() {
    if (this._getContainer()) return;
    const div = document.createElement('div');
    div.className = 'region-graph-overlay-container';
    div.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:5';
    this.ui.rootElement.appendChild(div);
  }

  _getContainer() {
    return this.ui.rootElement.querySelector('.region-graph-overlay-container');
  }

  // --- Cytoscape event binding (lazy) ---

  _bindCyEvents() {
    if (this._cyListeners || !this.ui.cy) return;
    const onViewport = () => this._syncViewport();
    const onLayoutStop = () => { this._shrinkNodes(); this._syncPositions(); this._syncViewport(); };
    const onPosition = () => this._syncPositions();

    this.ui.cy.on('viewport', onViewport);
    this.ui.cy.on('layoutstop', onLayoutStop);
    this.ui.cy.on('position', 'node', onPosition);

    this._cyListeners = { onViewport, onLayoutStop, onPosition };
  }

  _unbindCyEvents() {
    if (!this._cyListeners || !this.ui.cy) return;
    this.ui.cy.off('viewport', this._cyListeners.onViewport);
    this.ui.cy.off('layoutstop', this._cyListeners.onLayoutStop);
    this.ui.cy.off('position', 'node', this._cyListeners.onPosition);
    this._cyListeners = null;
  }

  /**
   * Must be called after Cytoscape is (re-)created so we can re-bind.
   */
  onCyCreated() {
    this._cyListeners = null;    // old cy destroyed, references invalid
    this._overlayStyleApplied = false;
    if (this.provider) this._bindCyEvents();
  }

  // --- Viewport / position sync ---

  _syncViewport() {
    const container = this._getContainer();
    if (!this.ui.cy || !container) return;
    const zoom = this.ui.cy.zoom();
    const pan = this.ui.cy.pan();
    container.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }

  _syncPositions() {
    if (!this.ui.cy || this._overlayElements.size === 0) return;
    this.ui.cy.startBatch();
    this._overlayElements.forEach((el, nodeId) => {
      const node = this.ui.cy.getElementById(nodeId);
      if (!node || node.length === 0) return;
      const pos = node.position();
      const w = el.offsetWidth || LAYOUT_WIDTH;
      const h = el.offsetHeight || LAYOUT_HEIGHT;
      el.style.left = `${pos.x - w / 2}px`;
      el.style.top = `${pos.y - h / 2}px`;
    });
    this.ui.cy.endBatch();
  }

  // --- In-place update ---

  _updateInPlace() {
    this.ui.cy.nodes('.region').forEach(node => {
      if (node.hasClass('player')) return;
      const nodeId = node.data('regionName') || node.id();
      const existing = this._overlayElements.get(nodeId);
      if (existing) {
        this.provider.update(nodeId, node.data(), existing);
      }
    });
    // Sync positions in case overlay sizes changed
    requestAnimationFrame(() => this._syncPositions());
  }

  // --- Style overrides ---

  _applyStyleOverrides() {
    if (!this.ui.cy || this._overlayElements.size === 0) return;

    if (!this._overlayStyleApplied) {
      this._overlayStyleApplied = true;

      // Build all overlay style overrides in one batch
      let s = this.ui.cy.style();

      // Hide native node rendering behind overlays.
      // No width/height here — the pre-sized dimensions from presizeNodes()
      // are intentionally smaller than the overlay card so edge lines always
      // reach behind the card rather than terminating visibly outside it.
      s = s.selector('node.has-overlay').style({
        'text-opacity': 0,
        'background-opacity': 0,
        'border-width': 0,
        'shape': 'rectangle',
      });

      // Move arrows from endpoints (hidden behind overlays) to mid-edge.
      // Each selector mirrors the base stylesheet's arrow color assignments.
      s = s
        .selector('edge').style({
          'target-arrow-shape': 'none',
          'mid-target-arrow-shape': 'triangle',
          'mid-target-arrow-color': '#666',
        })
        .selector('edge.bidirectional').style({
          'source-arrow-shape': 'none',
          'mid-source-arrow-shape': 'triangle',
          'mid-source-arrow-color': '#666',
        })
        .selector('edge.inaccessible').style({
          'mid-target-arrow-color': '#8e8e8e',
        })
        .selector('edge.inaccessible.bidirectional').style({
          'mid-source-arrow-color': '#8e8e8e',
        })
        .selector('edge.accessible').style({
          'mid-target-arrow-color': '#52b845',
        })
        .selector('edge.accessible.bidirectional').style({
          'mid-source-arrow-color': '#52b845',
        })
        .selector('edge.in-path').style({
          'mid-target-arrow-color': '#6c5ce7',
        })
        .selector('edge.in-path.bidirectional').style({
          'mid-source-arrow-color': '#6c5ce7',
        })
        .selector('edge.undiscovered').style({
          'mid-target-arrow-color': '#444',
        })
        .selector('edge.undiscovered.bidirectional').style({
          'mid-source-arrow-color': '#444',
        })
        // Region-location edges should remain arrow-free
        .selector('.region-location-edge').style({
          'mid-target-arrow-shape': 'none',
        });

      s.update();
    }

    this.ui.cy.nodes('.region').forEach(node => {
      if (this._overlayElements.has(node.data('regionName') || node.id())) {
        node.addClass('has-overlay');
      }
    });
  }

  // --- Interaction handlers ---

  _attachInteractionHandlers(el, nodeId, cyNode) {
    // Forward drag to Cytoscape: disable overlay pointer events then
    // re-dispatch mousedown to the canvas so Cytoscape picks up the drag
    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const container = this._getContainer();
      if (container) container.style.pointerEvents = 'none';
      const canvas = this.ui.graphContainer.querySelector('canvas');
      if (canvas) {
        canvas.dispatchEvent(new MouseEvent('mousedown', {
          clientX: e.clientX, clientY: e.clientY,
          button: e.button, bubbles: true,
        }));
      }
      const onUp = () => {
        if (container) container.style.pointerEvents = '';
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mouseup', onUp);
    });

    // Click on overlay body → select the region node
    el.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      this.ui.eventBus.publish('regionGraph:nodeSelected', { nodeId, data: cyNode.data() });
    });
  }

  // --- Teardown ---

  _teardownOverlays() {
    const container = this._getContainer();
    if (container) container.innerHTML = '';
    this._overlayElements.clear();

    if (this.ui.cy) {
      this.ui.cy.nodes('.has-overlay').removeClass('has-overlay');

      // Restore endpoint arrows and remove mid-edge arrows
      if (this._overlayStyleApplied) {
        this._overlayStyleApplied = false;
        this.ui.cy.style()
          .selector('edge').style({
            'target-arrow-shape': 'triangle',
            'mid-target-arrow-shape': 'none',
          })
          .selector('edge.bidirectional').style({
            'source-arrow-shape': 'triangle',
            'mid-source-arrow-shape': 'none',
          })
          .selector('.region-location-edge').style({
            'target-arrow-shape': 'none',
          })
          .update();
      }
    }
  }

  destroy() {
    this._teardownOverlays();
    this._unbindCyEvents();
    const container = this._getContainer();
    if (container) container.remove();
  }
}
