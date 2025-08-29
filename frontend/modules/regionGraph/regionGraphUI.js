import eventBus from '../../app/core/eventBus.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

export class RegionGraphUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    this.cy = null;
    this.cytoscape = null;
    this.cytoscapeFcose = null;
    this.currentLayout = null;
    this.selectedNode = null;
    this.nodePositions = new Map();
    this.isLayoutRunning = false;
    
    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('region-graph-panel-container', 'panel-container');
    this.rootElement.style.width = '100%';
    this.rootElement.style.height = '100%';
    this.rootElement.style.position = 'relative';
    
    this.statusBar = document.createElement('div');
    this.statusBar.style.position = 'absolute';
    this.statusBar.style.top = '5px';
    this.statusBar.style.left = '5px';
    this.statusBar.style.background = 'rgba(0, 0, 0, 0.7)';
    this.statusBar.style.color = 'white';
    this.statusBar.style.padding = '5px 10px';
    this.statusBar.style.borderRadius = '3px';
    this.statusBar.style.fontSize = '12px';
    this.statusBar.style.zIndex = '1000';
    this.statusBar.innerHTML = 'Loading graph...';
    
    this.graphContainer = document.createElement('div');
    this.graphContainer.id = 'cy-' + Math.random().toString(36).substr(2, 9);
    this.graphContainer.style.width = '100%';
    this.graphContainer.style.height = '100%';
    
    this.controlPanel = document.createElement('div');
    this.controlPanel.style.position = 'absolute';
    this.controlPanel.style.top = '5px';
    this.controlPanel.style.right = '5px';
    this.controlPanel.style.background = 'rgba(0, 0, 0, 0.7)';
    this.controlPanel.style.padding = '5px';
    this.controlPanel.style.borderRadius = '3px';
    this.controlPanel.style.zIndex = '1000';
    this.controlPanel.innerHTML = `
      <button id="resetView" style="margin: 2px; padding: 4px 8px;">Reset View</button>
      <button id="relayout" style="margin: 2px; padding: 4px 8px;">Re-layout</button>
      <button id="exportPositions" style="margin: 2px; padding: 4px 8px;">Export Positions</button>
    `;
    
    this.rootElement.appendChild(this.statusBar);
    this.rootElement.appendChild(this.controlPanel);
    this.rootElement.appendChild(this.graphContainer);
    this.container.element.appendChild(this.rootElement);
    
    this.container.on('show', () => this.onPanelShow());
    this.container.on('resize', () => this.onPanelResize());
    this.container.on('destroy', () => this.destroy());
    
    // Use event-driven initialization like Regions module
    const readyHandler = () => {
      console.log('[RegionGraphUI] Received app:readyForUiDataLoad, starting initialization');
      this.loadCytoscape();
      eventBus.unsubscribe('app:readyForUiDataLoad', readyHandler);
    };
    eventBus.subscribe('app:readyForUiDataLoad', readyHandler, 'regionGraph');
    
    console.log('[RegionGraphUI] Constructor complete, waiting for app:readyForUiDataLoad event');
  }

  getRootElement() {
    return this.rootElement;
  }

  loadCytoscape() {
    console.log('[RegionGraphUI] loadCytoscape called');
    console.log('[RegionGraphUI] Checking libraries - cytoscape:', !!window.cytoscape, 'coseBase:', !!window.coseBase, 'cytoscapeFcose:', !!window.cytoscapeFcose);
    
    if (window.cytoscape && window.coseBase && window.cytoscapeFcose) {
      console.log('[RegionGraphUI] All libraries already loaded, initializing graph');
      this.cytoscape = window.cytoscape;
      this.cytoscapeFcose = window.cytoscapeFcose;
      this.cytoscape.use(this.cytoscapeFcose(window.coseBase));
      this.initializeGraph();
    } else {
      console.log('[RegionGraphUI] Loading libraries dynamically');
      // Load Cytoscape.js first
      const script1 = document.createElement('script');
      script1.src = './libs/cytoscape/cytoscape.min.js';
      script1.onerror = (error) => {
        console.error('[RegionGraphUI] Error loading cytoscape.min.js:', error);
        this.updateStatus('Error loading Cytoscape library');
      };
      script1.onload = () => {
        console.log('[RegionGraphUI] Cytoscape.js loaded');
        this.cytoscape = window.cytoscape;
        
        // Load layout-base dependency
        const script2 = document.createElement('script');
        script2.src = './libs/cytoscape/layout-base.js';
        script2.onload = () => {
          console.log('[RegionGraphUI] layout-base.js loaded');
          // Load cose-base dependency  
          const script3 = document.createElement('script');
          script3.src = './libs/cytoscape/cose-base.js';
          script3.onload = () => {
            console.log('[RegionGraphUI] cose-base.js loaded, window.coseBase:', !!window.coseBase);
            // Load FCose plugin
            const script4 = document.createElement('script');
            script4.src = './libs/cytoscape/cytoscape-fcose.js';
            script4.onload = () => {
              console.log('[RegionGraphUI] cytoscape-fcose.js loaded, window.cytoscapeFcose:', !!window.cytoscapeFcose);
              this.cytoscapeFcose = window.cytoscapeFcose;
              if (this.cytoscape && this.cytoscapeFcose && window.coseBase) {
                console.log('[RegionGraphUI] All libraries loaded, registering FCose plugin');
                try {
                  this.cytoscape.use(this.cytoscapeFcose(window.coseBase));
                  console.log('[RegionGraphUI] FCose plugin registered successfully');
                } catch (error) {
                  console.error('[RegionGraphUI] Error registering FCose plugin:', error);
                }
              } else {
                console.warn('[RegionGraphUI] Missing libraries:', 'cytoscape:', !!this.cytoscape, 'cytoscapeFcose:', !!this.cytoscapeFcose, 'coseBase:', !!window.coseBase);
              }
              console.log('[RegionGraphUI] Calling initializeGraph...');
              this.initializeGraph();
            };
            script4.onerror = (error) => console.error('[RegionGraphUI] Error loading cytoscape-fcose.js:', error);
            document.head.appendChild(script4);
          };
          script3.onerror = (error) => console.error('[RegionGraphUI] Error loading cose-base.js:', error);
          document.head.appendChild(script3);
        };
        script2.onerror = (error) => console.error('[RegionGraphUI] Error loading layout-base.js:', error);
        document.head.appendChild(script2);
      };
      document.head.appendChild(script1);
    }
  }

  initializeGraph() {
    console.log('[RegionGraphUI] initializeGraph called');
    try {
      if (!this.cytoscape) {
        console.error('[RegionGraphUI] Cytoscape not loaded');
        this.updateStatus('Error: Failed to load Cytoscape');
        return;
      }

    console.log('[RegionGraphUI] Creating Cytoscape instance');
    this.cy = this.cytoscape({
      container: this.graphContainer,
      
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#666',
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'width': 30,
            'height': 30,
            'border-width': 2,
            'border-color': '#333',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'z-index': 10
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#ff6b6b',
            'border-color': '#ff0000',
            'border-width': 3
          }
        },
        {
          selector: 'node.accessible',
          style: {
            'background-color': '#4ecdc4',
            'border-color': '#2a9d8f'
          }
        },
        {
          selector: 'node.visited',
          style: {
            'background-color': '#95e77e',
            'border-color': '#52b845'
          }
        },
        {
          selector: 'node.current',
          style: {
            'background-color': '#ffd93d',
            'border-color': '#f9c74f',
            'width': 40,
            'height': 40
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#666',
            'target-arrow-color': '#666',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'z-index': 5
          }
        },
        {
          selector: 'edge.accessible',
          style: {
            'line-color': '#4ecdc4',
            'target-arrow-color': '#4ecdc4',
            'width': 3
          }
        },
        {
          selector: 'edge.traversed',
          style: {
            'line-color': '#95e77e',
            'target-arrow-color': '#95e77e',
            'width': 4
          }
        }
      ],
      
      layout: {
        name: 'grid',
        fit: true,
        padding: 30
      },

      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.2
    });

    console.log('[RegionGraphUI] Cytoscape instance created successfully');
    this.setupEventHandlers();
    this.subscribeToEvents();
    this.graphInitialized = false; // Track if data has been loaded
    
    this.updateStatus('Graph initialized, waiting for data...');
    console.log('[RegionGraphUI] Graph initialized, waiting for StateManager events');
    } catch (error) {
      console.error('[RegionGraphUI] Error in initializeGraph:', error);
      this.updateStatus('Error initializing graph: ' + error.message);
    }
  }

  setupEventHandlers() {
    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      this.selectedNode = node.id();
      
      eventBus.publish('regionGraph:nodeSelected', {
        nodeId: node.id(),
        data: node.data()
      }, 'regionGraph');
    });

    this.cy.on('layoutstop', () => {
      this.isLayoutRunning = false;
      this.saveNodePositions();
      this.updateStatus('Layout complete');
    });

    const resetButton = this.controlPanel.querySelector('#resetView');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.cy.fit(30);
      });
    }

    const relayoutButton = this.controlPanel.querySelector('#relayout');
    if (relayoutButton) {
      relayoutButton.addEventListener('click', () => {
        this.runLayout(true);
      });
    }

    const exportButton = this.controlPanel.querySelector('#exportPositions');
    if (exportButton) {
      exportButton.addEventListener('click', () => {
        this.exportNodePositions();
      });
    }
  }

  subscribeToEvents() {
    console.log('[RegionGraphUI] Subscribing to events...');
    
    // Clear any existing subscriptions
    if (this.unsubscribeStateUpdate) this.unsubscribeStateUpdate();
    if (this.unsubscribeRegionChange) this.unsubscribeRegionChange();
    if (this.unsubscribeRulesLoaded) this.unsubscribeRulesLoaded();
    if (this.unsubscribeStateReady) this.unsubscribeStateReady();
    
    // Subscribe to state updates
    this.unsubscribeStateUpdate = eventBus.subscribe('stateManager:snapshotUpdated', 
      (data) => this.onStateUpdate(data), 'regionGraph');
    
    this.unsubscribeRegionChange = eventBus.subscribe('playerState:regionChanged',
      (data) => this.highlightCurrentRegion(data.region), 'regionGraph');
      
    // Subscribe to rules loaded event (like Regions module)
    this.unsubscribeRulesLoaded = eventBus.subscribe('stateManager:rulesLoaded', 
      (event) => {
        console.log('[RegionGraphUI] Received stateManager:rulesLoaded, initializing graph data');
        if (this.cy) {
          this.loadGraphData();
        }
      }, 'regionGraph');
      
    // Subscribe to state ready event
    this.unsubscribeStateReady = eventBus.subscribe('stateManager:ready',
      () => {
        console.log('[RegionGraphUI] Received stateManager:ready, ensuring graph is loaded');
        if (this.cy && !this.graphInitialized) {
          this.loadGraphData();
        }
      }, 'regionGraph');
  }

  async loadGraphData() {
    console.log('[RegionGraphUI] loadGraphData called');
    try {
      console.log('[RegionGraphUI] Getting state data...');
      const staticData = stateManager.getStaticData();
      const snapshot = stateManager.getLatestStateSnapshot();
      
      console.log('[RegionGraphUI] staticData:', staticData);
      console.log('[RegionGraphUI] snapshot:', snapshot);
      
      if (!staticData?.regions || !snapshot) {
        console.warn('[RegionGraphUI] Missing data - staticData.regions:', !!staticData?.regions, 'snapshot:', !!snapshot);
        this.updateStatus('No region data available');
        return;
      }

      console.log('[RegionGraphUI] Building graph from regions:', Object.keys(staticData.regions).length);
      this.buildGraphFromRegions(staticData.regions, staticData.exits);
      this.graphInitialized = true; // Mark as successfully loaded
    } catch (error) {
      console.error('[RegionGraphUI] Error loading graph data:', error);
      this.updateStatus('Error loading graph data');
    }
  }

  buildGraphFromRegions(regions, exits) {
    console.log('[RegionGraphUI] buildGraphFromRegions called with:', Object.keys(regions || {}).length, 'regions');
    if (!regions || Object.keys(regions).length === 0) {
      console.warn('[RegionGraphUI] No regions to display');
      this.updateStatus('No regions to display');
      return;
    }

    const elements = {
      nodes: [],
      edges: []
    };

    const processedEdges = new Set();

    for (const [regionName, regionData] of Object.entries(regions)) {
      elements.nodes.push({
        data: {
          id: regionName,
          label: regionName.replace(/_/g, ' ')
        },
        position: this.nodePositions.get(regionName) || { x: Math.random() * 500, y: Math.random() * 500 }
      });
    }

    if (exits) {
      for (const [exitName, exitData] of Object.entries(exits)) {
        const fromRegion = exitData.parentRegion;
        const toRegion = exitData.connectedRegion;
        
        if (fromRegion && toRegion && regions[fromRegion] && regions[toRegion]) {
          const edgeId = `${fromRegion}-${toRegion}`;
          const reverseEdgeId = `${toRegion}-${fromRegion}`;
          
          if (!processedEdges.has(edgeId) && !processedEdges.has(reverseEdgeId)) {
            elements.edges.push({
              data: {
                id: edgeId,
                source: fromRegion,
                target: toRegion,
                label: exitName
              }
            });
            processedEdges.add(edgeId);
          }
        }
      }
    }

    this.cy.elements().remove();
    this.cy.add(elements);

    if (this.nodePositions.size === 0 || this.nodePositions.size !== elements.nodes.length) {
      this.runLayout(false);
    } else {
      this.cy.fit(30);
    }

    this.updateStatus(`Loaded ${elements.nodes.length} regions, ${elements.edges.length} connections`);
  }

  runLayout(force = false) {
    if (this.isLayoutRunning) {
      console.log('[RegionGraphUI] Layout already running');
      return;
    }

    const savedPositions = !force && this.nodePositions.size > 0;
    
    if (savedPositions) {
      this.cy.nodes().forEach(node => {
        const pos = this.nodePositions.get(node.id());
        if (pos) {
          node.position(pos);
        }
      });
      this.cy.fit(30);
      return;
    }

    this.isLayoutRunning = true;
    this.updateStatus('Running layout...');

    const layoutOptions = {
      name: 'fcose',
      quality: 'proof',
      randomize: false,
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 50,
      nodeDimensionsIncludeLabels: true,
      uniformNodeDimensions: false,
      packComponents: true,
      
      nodeRepulsion: 8500,
      idealEdgeLength: 100,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 10,
      tilingPaddingHorizontal: 10,
      gravityRangeCompound: 1.5,
      gravityCompound: 1.0,
      gravityRange: 3.8,
      initialEnergyOnIncremental: 0.5
    };

    this.currentLayout = this.cy.layout(layoutOptions);
    this.currentLayout.run();
  }

  saveNodePositions() {
    this.nodePositions.clear();
    this.cy.nodes().forEach(node => {
      this.nodePositions.set(node.id(), {
        x: node.position('x'),
        y: node.position('y')
      });
    });
  }

  exportNodePositions() {
    const positions = {};
    this.cy.nodes().forEach(node => {
      positions[node.id()] = {
        x: Math.round(node.position('x')),
        y: Math.round(node.position('y'))
      };
    });
    
    const dataStr = JSON.stringify(positions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'region-graph-positions.json';
    link.click();
    URL.revokeObjectURL(url);
    
    this.updateStatus('Positions exported to file');
  }

  onStateUpdate(data) {
    if (!this.cy) return;
    
    const snapshot = data.snapshot;
    if (!snapshot) return;

    this.cy.nodes().forEach(node => {
      const regionName = node.id();
      const isReachable = snapshot.regionReachability?.[regionName] === true ||
                         snapshot.regionReachability?.[regionName] === 'reachable' ||
                         snapshot.regionReachability?.[regionName] === 'checked';
      const isVisited = snapshot.visitedRegions && 
                       snapshot.visitedRegions.includes(regionName);
      
      node.removeClass('accessible visited');
      if (isVisited) {
        node.addClass('visited');
      } else if (isReachable) {
        node.addClass('accessible');
      }
    });

    this.cy.edges().forEach(edge => {
      const sourceReachable = snapshot.regionReachability?.[edge.source().id()] === true ||
                             snapshot.regionReachability?.[edge.source().id()] === 'reachable' ||
                             snapshot.regionReachability?.[edge.source().id()] === 'checked';
      const targetReachable = snapshot.regionReachability?.[edge.target().id()] === true ||
                             snapshot.regionReachability?.[edge.target().id()] === 'reachable' ||
                             snapshot.regionReachability?.[edge.target().id()] === 'checked';
      
      edge.removeClass('accessible traversed');
      if (sourceReachable && targetReachable) {
        edge.addClass('accessible');
        
        const sourceVisited = snapshot.visitedRegions && 
                            snapshot.visitedRegions.includes(edge.source().id());
        const targetVisited = snapshot.visitedRegions && 
                            snapshot.visitedRegions.includes(edge.target().id());
        if (sourceVisited && targetVisited) {
          edge.addClass('traversed');
        }
      }
    });
  }

  highlightCurrentRegion(regionName) {
    if (!this.cy) return;
    
    this.cy.nodes().removeClass('current');
    
    const node = this.cy.getElementById(regionName);
    if (node && node.length > 0) {
      node.addClass('current');
      
      this.cy.animate({
        center: { eles: node },
        zoom: 1.5
      }, {
        duration: 500
      });
    }
  }

  updateStatus(message) {
    if (this.statusBar) {
      this.statusBar.innerHTML = message;
    }
  }

  onPanelShow() {
    console.log('[RegionGraphUI] Panel shown, cy:', !!this.cy);
    if (this.cy) {
      this.cy.resize();
      this.cy.fit(30);
    } else {
      console.log('[RegionGraphUI] Panel shown but no Cytoscape instance, checking if libraries are loaded...');
      console.log('[RegionGraphUI] Library check - cytoscape:', !!window.cytoscape, 'coseBase:', !!window.coseBase, 'cytoscapeFcose:', !!window.cytoscapeFcose);
      // Try to initialize if libraries are now available but graph wasn't created yet
      if (window.cytoscape && window.coseBase && window.cytoscapeFcose) {
        console.log('[RegionGraphUI] Libraries are loaded, initializing now...');
        this.cytoscape = window.cytoscape;
        this.cytoscapeFcose = window.cytoscapeFcose;
        this.cytoscape.use(this.cytoscapeFcose(window.coseBase));
        this.initializeGraph();
      } else {
        console.log('[RegionGraphUI] Some libraries not loaded, waiting...');
      }
    }
  }

  onPanelResize() {
    if (this.cy) {
      this.cy.resize();
    }
  }

  destroy() {
    if (this.unsubscribeStateUpdate) {
      this.unsubscribeStateUpdate();
    }
    if (this.unsubscribeRegionChange) {
      this.unsubscribeRegionChange();
    }
    if (this.unsubscribeRulesLoaded) {
      this.unsubscribeRulesLoaded();
    }
    if (this.unsubscribeStateReady) {
      this.unsubscribeStateReady();
    }
    if (this.cy) {
      this.cy.destroy();
    }
  }
}