// frontend/modules/testModule/testPanelUI.js

export class TestPanelUI {
  constructor(container, componentState) {
    console.log('[TestPanelUI] Constructor called.');
    this.container = container; // Golden Layout container
    this.rootElement = document.createElement('div');
    this.rootElement.style.padding = '15px';
    this.rootElement.style.height = '100%';
    this.rootElement.style.overflow = 'auto';
    this.rootElement.innerHTML = `<h2>Test Panel Content</h2>
      <p>This panel was loaded dynamically as an external module.</p>
      <p>Module ID should be based on the path provided.</p>
      <p>Component State:</p>
      <pre>${JSON.stringify(componentState, null, 2)}</pre>`;

    // Set title for the panel tab
    this.container.setTitle('Test Module Panel');

    // Attach lifecycle listeners (optional but good practice)
    this._setupLifecycleListeners();
  }

  // Method required by PanelManager to get the root DOM element
  getRootElement() {
    console.log('[TestPanelUI] getRootElement called.');
    return this.rootElement;
  }

  // Optional: Method called when panel is opened/shown
  initialize() {
    console.log('[TestPanelUI] initialize (panel opened/shown).');
  }

  // Optional: Method called when panel is destroyed
  destroy() {
    console.log('[TestPanelUI] destroy called.');
    // Cleanup logic here (e.g., remove event listeners)
  }

  _setupLifecycleListeners() {
    this.container.on('open', () => this.initialize());
    this.container.on('destroy', () => this.destroy());
    console.log('[TestPanelUI] Lifecycle listeners set up.');
  }
}

console.log('[TestPanelUI] testPanelUI.js loaded');
