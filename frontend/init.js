// init.js - Initialization script to load the application
// import GoldenLayout from 'golden-layout'; // REMOVE this line - rely on global from script tag

// Initialize key modules in order
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing application...');

  try {
    // First, import the stateManager to ensure it's loaded first
    const stateManagerModule = await import(
      './app/core/stateManagerSingleton.js'
    );
    const stateManager = stateManagerModule.default;

    // Make stateManager available globally for debugging
    window.stateManager = stateManager;
    console.log('StateManager loaded and made global');

    // Import GameUI class and create an instance
    const gameUIModule = await import('./app/ui/gameUI.js');
    const GameUI = gameUIModule.GameUI;
    const gameUI = new GameUI();
    window.gameUI = gameUI;
    console.log('GameUI instance created');

    // === Golden Layout Setup ===
    const containerElement = document.getElementById('goldenlayout-container');
    if (!containerElement) {
      throw new Error('Golden Layout container element not found!');
    }

    // Define the initial layout configuration
    const config = {
      settings: {
        showPopoutIcon: false, // Disable popout icon for simplicity initially
      },
      content: [
        {
          type: 'row',
          content: [
            {
              // Left Column (Inventory)
              type: 'component',
              componentName: 'inventoryPanel',
              title: 'Inventory',
              width: 20, // Percentage width
            },
            {
              // Middle Column (Main Content)
              type: 'component',
              componentName: 'mainContentPanel',
              title: 'Console & Status',
              width: 30,
            },
            {
              // Right Column (Stack of views)
              type: 'stack',
              width: 50,
              content: [
                {
                  type: 'component',
                  componentName: 'locationsPanel',
                  title: 'Locations',
                },
                {
                  type: 'component',
                  componentName: 'exitsPanel',
                  title: 'Exits',
                },
                {
                  type: 'component',
                  componentName: 'regionsPanel',
                  title: 'Regions',
                },
                {
                  type: 'component',
                  componentName: 'loopsPanel',
                  title: 'Loops',
                },
                {
                  type: 'component',
                  componentName: 'filesPanel',
                  title: 'Files',
                },
              ],
            },
          ],
        },
      ],
    };

    // Instantiate Golden Layout
    const layout = new GoldenLayout(config, containerElement);

    // Register components (Placeholder implementations)
    // We will need to modify gameUI or individual UI classes later
    // to provide the actual content and logic for these containers.

    layout.registerComponent(
      'inventoryPanel',
      function (container, componentState) {
        console.log('Registering inventoryPanel');
        const rootElement = gameUI.inventoryUI.getRootElement(); // Get the root element
        container.getElement().append(rootElement); // Append it to GL container

        // Handle resize - Optional: depends if inventory needs specific resize logic
        container.on('resize', () => {
          // gameUI.inventoryUI.updateSize(container.width, container.height);
        });
        // Initial population - REMOVED - This will be called later by gameUI when data is ready
        // gameUI.inventoryUI.initialize();
      }
    );

    layout.registerComponent(
      'mainContentPanel',
      function (container, componentState) {
        console.log('Registering mainContentPanel');
        const rootElement = gameUI.getMainContentRootElement(); // Need a method in GameUI for this
        container.getElement().append(rootElement);

        container.on('resize', () => {
          // Adjust console height or other elements if needed
        });
        // Initial population
        gameUI.initializeMainContentElements(rootElement); // Method to attach listeners/populate console
      }
    );

    layout.registerComponent(
      'locationsPanel',
      function (container, componentState) {
        console.log('Registering locationsPanel');
        const rootElement = gameUI.locationUI.getRootElement();
        container.getElement().append(rootElement);
        container.on('open', () => gameUI.locationUI.update());
        container.on('resize', () => {
          // We might need an updateSize method in locationUI if layout depends on container size
          gameUI.locationUI.update(); // For now, just re-render
        });
        gameUI.locationUI.initialize(); // Initial render
      }
    );

    layout.registerComponent(
      'exitsPanel',
      function (container, componentState) {
        console.log('Registering exitsPanel');
        const rootElement = gameUI.exitUI.getRootElement();
        container.getElement().append(rootElement);
        container.on('open', () => gameUI.exitUI.update());
        container.on('resize', () => gameUI.exitUI.update()); // Re-render on resize
        gameUI.exitUI.initialize(); // Initial render
      }
    );

    layout.registerComponent(
      'regionsPanel',
      function (container, componentState) {
        console.log('Registering regionsPanel');
        const rootElement = gameUI.regionUI.getRootElement();
        container.getElement().append(rootElement);
        container.on('open', () => gameUI.regionUI.update());
        container.on('resize', () => gameUI.regionUI.update()); // Re-render on resize
        gameUI.regionUI.initialize(); // Initial render
      }
    );

    layout.registerComponent(
      'loopsPanel',
      function (container, componentState) {
        console.log('Registering loopsPanel');
        const rootElement = gameUI.loopUI.getRootElement();
        container.getElement().append(rootElement);
        container.on('open', () => gameUI.loopUI.renderLoopPanel());
        container.on('resize', () => gameUI.loopUI.renderLoopPanel()); // Re-render on resize
        // gameUI.loopUI.initialize(); // Might need specific init
      }
    );

    layout.registerComponent(
      'filesPanel',
      function (container, componentState) {
        console.log('Registering filesPanel');
        const filesPanelRoot = gameUI.getFilesPanelRootElement();
        container.getElement().append(filesPanelRoot);

        gameUI.initializeFilesPanelElements(container.getElement());

        container.on('open', () => gameUI.updateFileViewDisplay());
        container.on('resize', () => gameUI.updateFileViewDisplay());
      }
    );

    // Initialize the layout
    layout.init();

    // Make layout instance globally available if needed for debugging
    window.goldenLayoutInstance = layout;
    console.log('Golden Layout initialized');

    // Import client app last to ensure UI is ready first
    const clientAppModule = await import('./client/app.js');
    window.APP = clientAppModule.default;
    console.log('Client app loaded');

    // No longer need URL param logic for view mode - Golden Layout handles active tab state
  } catch (error) {
    console.error('Error during application initialization:', error);
  }

  // Add a delayed check to verify initialization
  setTimeout(() => {
    console.log('=== Initialization Status Check ===');
    console.log('gameUI instance exists:', !!window.gameUI);
    console.log('stateManager instance exists:', !!window.stateManager);
    console.log(
      'Golden Layout instance exists:',
      !!window.goldenLayoutInstance
    );

    if (window.gameUI) {
      console.log(
        'GameUI initialized with view mode:',
        window.gameUI.currentViewMode
      );
      console.log('GameUI has inventory UI:', !!window.gameUI.inventoryUI);
      console.log('GameUI has location UI:', !!window.gameUI.locationUI);
    }

    if (window.stateManager) {
      console.log(
        'StateManager has inventory:',
        !!window.stateManager.inventory
      );
      console.log(
        'StateManager has regions:',
        !!window.stateManager.regions?.length
      );
      console.log(
        'StateManager has locations:',
        !!window.stateManager.locations?.length
      );
    }
  }, 1000);
});
