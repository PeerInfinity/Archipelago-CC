// frontend/app/core/mobileLayoutManager.js
// Mobile-specific layout manager for touch-friendly panel navigation

import eventBus from './eventBus.js';
import { centralRegistry } from './centralRegistry.js';

// Helper function for logging
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('mobileLayoutManager', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[mobileLayoutManager] ${message}`, ...data);
  }
}

class MobileLayoutManager {
  constructor() {
    this.panels = new Map(); // Map<componentType, { factory, instance, title, element }>
    this.activePanel = null;
    this.container = null;
    this.tabBar = null;
    this.contentArea = null;
    this.isInitialized = false;
    this.appIsReady = false; // Track if app is ready for UI data load

    log('info', 'MobileLayoutManager instance created');

    // Listen for app ready event
    eventBus.subscribe('app:readyForUiDataLoad', () => {
      this.appIsReady = true;
      log('info', 'MobileLayoutManager: App is ready for UI data load');
    }, 'mobileLayoutManager');
  }

  /**
   * Initialize the mobile layout manager
   * @param {HTMLElement} container - The container element for mobile layout
   */
  initialize(container) {
    if (this.isInitialized) {
      log('warn', 'MobileLayoutManager already initialized');
      return;
    }

    this.container = container;
    this.setupMobileLayout();
    this.attachEventListeners();
    this.isInitialized = true;

    log('info', 'MobileLayoutManager initialized');

    // Create all panels upfront after initialization
    // This will be called after all panels are registered
    setTimeout(() => {
      this.createAllPanels();
    }, 0);
  }

  /**
   * Setup the mobile layout structure
   */
  setupMobileLayout() {
    // Clear existing content
    this.container.innerHTML = '';
    this.container.className = 'mobile-layout-container';

    // Create content area
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'mobile-panel-content';
    this.container.appendChild(this.contentArea);

    // Create tab bar
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'mobile-tab-bar';
    this.container.appendChild(this.tabBar);

    // No swipe gestures - removed to prevent accidental panel switches
  }

  /**
   * Create all registered panels upfront
   */
  createAllPanels() {
    log('info', 'Creating all panels upfront...');

    this.panels.forEach((panel, componentType) => {
      if (!panel.instance) {
        try {
          // Create a mock container that mimics Golden Layout's container
          const panelContainer = document.createElement('div');
          panelContainer.className = 'mobile-panel-instance';
          panelContainer.style.display = 'none'; // Hidden by default
          panelContainer.dataset.componentType = componentType;

          const mockContainer = {
            element: panelContainer,
            width: this.contentArea.clientWidth,
            height: this.contentArea.clientHeight,
            on: (event, handler) => {
              if (event === 'destroy') {
                panelContainer.addEventListener('destroy', handler);
              }
            },
            emit: (event) => {
              panelContainer.dispatchEvent(new CustomEvent(event));
            }
          };

          const componentState = {
            isMobile: true,
            componentType: componentType
          };

          // Call the factory function to create the panel
          const uiProvider = new panel.factory(mockContainer, componentState, componentType);

          if (uiProvider && typeof uiProvider.getRootElement === 'function') {
            const rootElement = uiProvider.getRootElement();
            if (rootElement instanceof HTMLElement) {
              panelContainer.appendChild(rootElement);
              this.contentArea.appendChild(panelContainer);

              panel.instance = uiProvider;
              panel.element = panelContainer;

              // Call onMount if it exists
              if (typeof uiProvider.onMount === 'function') {
                uiProvider.onMount(mockContainer, componentState);
              }

              // Initialize if app is ready
              if (this.appIsReady) {
                if (typeof uiProvider.initialize === 'function') {
                  uiProvider.initialize();
                }
                if (typeof uiProvider.init === 'function') {
                  uiProvider.init();
                }
              }

              log('info', `Panel pre-created: ${componentType}`);
            }
          }
        } catch (error) {
          log('error', `Error pre-creating panel ${componentType}:`, error);
        }
      }
    });

    // Show the first panel by default
    const firstPanel = Array.from(this.panels.keys())[0];
    if (firstPanel) {
      this.showPanel(firstPanel);
    }
  }

  /**
   * Register a panel component
   * @param {string} componentType - The component type identifier
   * @param {Function} componentFactory - The component factory function
   * @param {string} title - Display title for the panel
   */
  registerPanel(componentType, componentFactory, title) {
    log('info', `Registering panel: ${componentType} (${title})`);

    this.panels.set(componentType, {
      factory: componentFactory,
      instance: null,
      title: title || componentType,
      tabElement: null
    });

    // Create tab for this panel
    this.createTab(componentType);
  }

  /**
   * Create a tab for a panel
   * @param {string} componentType - The component type identifier
   */
  createTab(componentType) {
    const panel = this.panels.get(componentType);
    if (!panel || !this.tabBar) return;

    const tab = document.createElement('div');
    tab.className = 'mobile-tab';
    tab.dataset.componentType = componentType;

    // Create tab content with icon and label
    tab.innerHTML = `
      <div class="mobile-tab-icon">${this.getIconForPanel(componentType)}</div>
      <div class="mobile-tab-label">${panel.title}</div>
    `;

    tab.addEventListener('click', () => {
      this.showPanel(componentType);
    });

    panel.tabElement = tab;
    this.tabBar.appendChild(tab);

    // Show first panel by default
    if (this.panels.size === 1) {
      this.showPanel(componentType);
    }
  }

  /**
   * Get icon for panel type (can be customized)
   * @param {string} componentType - The component type
   * @returns {string} Icon HTML or emoji
   */
  getIconForPanel(componentType) {
    const icons = {
      'loopsPanel': '🔄',
      'jsonPanel': '📄',
      'inventoryPanel': '🎒',
      'locationsPanel': '📍',
      'testsPanel': '✅',
      'modulesPanel': '📦',
      'clientPanel': '🎮',
      'editorPanel': '✏️',
      'timerPanel': '⏱️',
      'pathAnalyzerPanel': '🛤️',
      'presetsPanel': '⚙️'
    };
    return icons[componentType] || '📱';
  }

  /**
   * Show a specific panel
   * @param {string} componentType - The component type to show
   */
  showPanel(componentType) {
    const panel = this.panels.get(componentType);
    if (!panel) {
      log('warn', `Panel not found: ${componentType}`);
      return;
    }

    // Hide all panels
    this.panels.forEach((p, type) => {
      if (p.element) {
        p.element.style.display = 'none';
      }
    });

    // Show the selected panel
    if (panel.element) {
      panel.element.style.display = 'block';

      // Notify the panel it's being shown (some panels might need to refresh)
      if (panel.instance) {
        if (typeof panel.instance.onShow === 'function') {
          panel.instance.onShow();
        }

        // If panel has a refresh method, call it
        if (typeof panel.instance.refresh === 'function') {
          panel.instance.refresh();
        }
      }
    } else if (!panel.instance) {
      // Fallback: Create panel if it wasn't created yet (shouldn't happen with createAllPanels)
      log('warn', `Panel ${componentType} not pre-created, creating now...`);
      this.createPanelInstance(componentType);
      if (panel.element) {
        panel.element.style.display = 'block';
      }
    }

    // Update active state
    this.activePanel = componentType;

    // Update tab bar active state
    this.updateTabBarState();

    // Emit panel activation event
    eventBus.publish('ui:panelActivated', {
      componentType,
      isMobile: true
    }, 'mobileLayoutManager');
  }

  /**
   * Create a single panel instance (helper method)
   * @param {string} componentType - The component type to create
   */
  createPanelInstance(componentType) {
    const panel = this.panels.get(componentType);
    if (!panel || panel.instance) return;

    try {
      const panelContainer = document.createElement('div');
      panelContainer.className = 'mobile-panel-instance';
      panelContainer.style.display = 'none';
      panelContainer.dataset.componentType = componentType;

      const mockContainer = {
        element: panelContainer,
        width: this.contentArea.clientWidth,
        height: this.contentArea.clientHeight,
        on: (event, handler) => {
          if (event === 'destroy') {
            panelContainer.addEventListener('destroy', handler);
          }
        },
        emit: (event) => {
          panelContainer.dispatchEvent(new CustomEvent(event));
        }
      };

      const componentState = {
        isMobile: true,
        componentType: componentType
      };

      const uiProvider = new panel.factory(mockContainer, componentState, componentType);

      if (uiProvider && typeof uiProvider.getRootElement === 'function') {
        const rootElement = uiProvider.getRootElement();
        if (rootElement instanceof HTMLElement) {
          panelContainer.appendChild(rootElement);
          this.contentArea.appendChild(panelContainer);

          panel.instance = uiProvider;
          panel.element = panelContainer;

          if (typeof uiProvider.onMount === 'function') {
            uiProvider.onMount(mockContainer, componentState);
          }

          if (this.appIsReady) {
            if (typeof uiProvider.initialize === 'function') {
              uiProvider.initialize();
            }
            if (typeof uiProvider.init === 'function') {
              uiProvider.init();
            }
          }

          log('info', `Panel created: ${componentType}`);
        }
      }
    } catch (error) {
      log('error', `Error creating panel ${componentType}:`, error);
    }
  }

  /**
   * Update tab bar to show active panel
   */
  updateTabBarState() {
    this.panels.forEach((panel, type) => {
      if (panel.tabElement) {
        if (type === this.activePanel) {
          panel.tabElement.classList.add('active');
          // Scroll the active tab into view
          this.scrollTabIntoView(panel.tabElement);
        } else {
          panel.tabElement.classList.remove('active');
        }
      }
    });
  }

  /**
   * Scroll a tab element into view smoothly
   * @param {HTMLElement} tabElement - The tab element to scroll into view
   */
  scrollTabIntoView(tabElement) {
    if (!tabElement || !this.tabBar) return;

    const tabBarRect = this.tabBar.getBoundingClientRect();
    const tabRect = tabElement.getBoundingClientRect();

    // Check if tab is fully visible
    const isFullyVisible =
      tabRect.left >= tabBarRect.left &&
      tabRect.right <= tabBarRect.right;

    if (!isFullyVisible) {
      // Calculate scroll position to center the tab if possible
      const scrollLeft = tabElement.offsetLeft - (tabBarRect.width / 2) + (tabRect.width / 2);

      this.tabBar.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: 'smooth'
      });
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Listen for panel activation requests
    eventBus.subscribe('ui:activatePanel', (payload) => {
      if (payload && payload.panelId) {
        this.showPanel(payload.panelId);
      }
    }, 'mobileLayoutManager');

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      this.handleOrientationChange();
    });
  }

  /**
   * Handle device orientation changes
   */
  handleOrientationChange() {
    // Refresh current panel layout if needed
    if (this.activePanel) {
      const panel = this.panels.get(this.activePanel);
      if (panel && panel.instance && typeof panel.instance.onResize === 'function') {
        setTimeout(() => {
          panel.instance.onResize();
        }, 100);
      }
    }
  }

  /**
   * Activate a specific panel by type
   * @param {string} componentType - The component type to activate
   */
  activatePanel(componentType) {
    this.showPanel(componentType);
  }

  /**
   * Get all registered panels
   * @returns {Array} Array of panel info objects
   */
  getAllPanels() {
    return Array.from(this.panels.entries()).map(([type, panel]) => ({
      componentType: type,
      title: panel.title,
      hasInstance: !!panel.instance,
      isActive: type === this.activePanel
    }));
  }

  /**
   * Destroy a panel instance
   * @param {string} componentType - The component type to destroy
   */
  destroyPanel(componentType) {
    const panel = this.panels.get(componentType);
    if (panel && panel.instance) {
      // Emit destroy event
      this.contentArea.dispatchEvent(new CustomEvent('destroy'));

      // Clear instance
      panel.instance = null;

      // If this was the active panel, show another one
      if (this.activePanel === componentType) {
        const otherPanels = Array.from(this.panels.keys()).filter(t => t !== componentType);
        if (otherPanels.length > 0) {
          this.showPanel(otherPanels[0]);
        }
      }
    }
  }

  /**
   * Check if layout manager is in mobile mode
   * @returns {boolean} Always true for mobile layout manager
   */
  isMobile() {
    return true;
  }
}

// Export singleton instance
const mobileLayoutManager = new MobileLayoutManager();
export default mobileLayoutManager;