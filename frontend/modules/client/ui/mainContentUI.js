// MainContentUI - Central panel containing console and connection status

import ConsoleUI from './consoleUI.js';
import { stateManagerProxySingleton as stateManager } from '../../stateManager/index.js';
import messageHandler from '../core/messageHandler.js';
import eventBus from '../../../app/core/eventBus.js';
import connection from '../core/connection.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js'; // Added for timer UI injection

class MainContentUI {
  constructor(container, componentState) {
    console.log('[MainContentUI] Constructor called');
    this.container = container;
    this.componentState = componentState;

    this.rootElement = null;
    this.consoleElement = null;
    this.consoleInputElement = null;
    this.consoleHistoryElement = null;
    this.statusIndicator = null;
    this.connectButton = null;
    this.serverAddressInput = null;

    this.eventBus = eventBus;
    this.connection = connection;

    this.stateManager = stateManager;
    this.messageHandler = messageHandler;

    // Subscribe to connection events using the imported eventBus singleton
    this.eventBus.subscribe('connection:open', () => {
      this.updateConnectionStatus(true);
    });
    this.eventBus.subscribe('connection:close', () => {
      this.updateConnectionStatus(false);
    });
    this.eventBus.subscribe('connection:error', () => {
      this.updateConnectionStatus(false);
    });
    this.eventBus.subscribe('connection:reconnecting', () => {
      this.updateConnectionStatus('connecting');
    });

    // <<< ADDED: Subscribe to console print requests >>>
    this.eventBus.subscribe('ui:printToConsole', (payload) => {
      if (payload && payload.message) {
        this.appendConsoleMessage(payload.message, payload.type || 'info');
      }
    });
    // <<< END ADDED >>>

    // Defer full element initialization and event listener setup
    const readyHandler = (eventPayload) => {
      console.log(
        '[MainContentUI] Received app:readyForUiDataLoad. Initializing elements.'
      );
      // Pass the GoldenLayout container's DOM element to initializeElements
      this.initializeElements(this.container.element);
      eventBus.unsubscribe('app:readyForUiDataLoad', readyHandler);
    };
    eventBus.subscribe('app:readyForUiDataLoad', readyHandler);

    this.container.on('destroy', () => {
      // ADDED: Ensure cleanup
      this.dispose();
    });
  }

  getRootElement() {
    console.log('[MainContentUI] Getting root element');
    if (!this.rootElement) {
      console.log('[MainContentUI] Creating new root element');
      this.rootElement = document.createElement('div');
      this.rootElement.className = 'main-content-panel';
      this.rootElement.style.width = '100%';
      this.rootElement.style.height = '100%';
      this.rootElement.style.display = 'flex';
      this.rootElement.style.flexDirection = 'column';
      this.rootElement.style.backgroundColor = '#2d2d2d';
      this.rootElement.style.color = '#cecece';
      this.rootElement.style.padding = '10px';
      this.rootElement.style.boxSizing = 'border-box';

      this.rootElement.innerHTML = `
        <div style="margin-bottom: 10px; border-bottom: 1px solid #666; padding-bottom: 5px;">
          <h3 style="margin: 0 0 10px 0;">Console & Status</h3>
          
          <div id="status-bar" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 5px;">
              AP Server: <span id="server-status" class="status-indicator" style="color: yellow; font-weight: bold;">Not Connected</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px; margin-left: auto;">
              <label for="server-address">Server Address:</label>
              <input id="server-address" value="ws://localhost:38281" style="background-color: #333; color: #eee; border: 1px solid #555; padding: 4px;" />
              <button class="connect-button" style="padding: 4px 10px;">Connect</button>
            </div>
          </div>
          
          <!-- Timer UI Placeholder -->
          <div id="timer-ui-placeholder" style="margin-bottom: 10px;"></div>
        </div>
        
        <div id="main-console" class="main-console" style="flex-grow: 1; overflow-y: auto; background-color: #222; border: 1px solid #444; padding: 10px;">
          <div id="console-output" class="console-output console-messages">
            <div class="console-message">Welcome to the console!</div>
            <div class="console-message">Type "help" for a list of available commands.</div>
          </div>
        </div>
        
        <div id="command-wrapper" style="margin-top: 10px; display: flex;">
          <label for="main-console-input" style="display: none;"></label>
          <input id="main-console-input" type="text" placeholder="Enter command..." style="flex-grow: 1; padding: 5px; background-color: #333; color: #eee; border: 1px solid #555;" />
          <button class="send-button" style="margin-left: 5px; padding: 5px 10px;">Send</button>
        </div>
      `;

      console.log('[MainContentUI] Added content to root element');
    }
    return this.rootElement;
  }

  initializeElements(containerElement) {
    console.log(
      '[MainContentUI] Initializing elements in container:',
      containerElement
    );

    const root = this.getRootElement();

    while (containerElement.firstChild) {
      containerElement.removeChild(containerElement.firstChild);
    }

    containerElement.appendChild(root);
    console.log('[MainContentUI] Root element appended to container');

    this.consoleElement = root.querySelector('#main-console');
    this.consoleInputElement = root.querySelector('#main-console-input');
    this.consoleHistoryElement = root.querySelector('#console-output');
    this.statusIndicator = root.querySelector('#server-status');
    this.connectButton = root.querySelector('.connect-button');
    this.serverAddressInput = root.querySelector('#server-address');

    this.attachEventListeners();
    this.initializeConsole();
    this.registerConsoleCommands();
    this.updateConnectionStatus(
      this.connection.isConnected() ? 'connected' : 'disconnected'
    );

    // Inject Timer UI
    const timerPlaceholder = this.rootElement.querySelector(
      '#timer-ui-placeholder'
    );
    if (timerPlaceholder) {
      try {
        const timerModuleAPI = centralRegistry.getPublicFunction(
          'timer',
          'getTimerUIDOMElement'
        );
        if (timerModuleAPI) {
          const timerDOM = timerModuleAPI();
          if (timerDOM) {
            timerPlaceholder.appendChild(timerDOM);
          } else {
            console.warn(
              "[MainContentUI] Timer module's getTimerUIDOMElement returned null."
            );
            timerPlaceholder.innerHTML = '<!-- Timer UI not available -->';
          }
        } else {
          console.warn(
            '[MainContentUI] Timer module or getTimerUIDOMElement function not registered. Timer UI will not be displayed.'
          );
          timerPlaceholder.innerHTML = '<!-- Timer module inactive -->';
        }
      } catch (error) {
        console.error('[MainContentUI] Error injecting Timer UI:', error);
        timerPlaceholder.innerHTML =
          '<p style="color:red;">Error loading Timer UI.</p>';
      }
    }

    console.log('[MainContentUI] Elements initialized and references stored');
  }

  attachEventListeners() {
    if (this.connectButton && this.serverAddressInput) {
      this.connectButton.addEventListener('click', () => {
        console.log('[MainContentUI] Connect button clicked');
        if (this.connection.isConnected()) {
          this.connection.disconnect();
        } else {
          const serverAddress =
            this.serverAddressInput.value || 'ws://localhost:38281';
          if (typeof this.connection.requestConnect === 'function') {
            this.connection.requestConnect(serverAddress, '');
          } else {
            console.error(
              '[MainContentUI] this.connection.requestConnect is not a function. Connection attempt failed.'
            );
          }
        }
      });
    }

    if (this.consoleInputElement) {
      this.consoleInputElement.addEventListener('keypress', (event) => {
        if (
          event.key === 'Enter' &&
          this.consoleInputElement.value.trim() !== ''
        ) {
          const command = this.consoleInputElement.value.trim();
          this.consoleInputElement.value = ''; // Clear input

          // Display the command
          this.appendConsoleMessage(`> ${command}`, 'command');

          // Process the command
          this.executeCommand(command);
        }
      });
    }
  }

  initializeConsole() {
    console.log('[MainContentUI] Initializing console');

    this.appendConsoleMessage(
      'Console initialized. Type "help" for available commands.',
      'system'
    );
  }

  // Console functionality
  appendConsoleMessage(message, type = 'info') {
    if (!this.consoleHistoryElement) return;

    const messageElement = document.createElement('div');
    messageElement.className = `console-message console-message-${type}`;
    messageElement.textContent = message;

    // Style based on message type
    switch (type) {
      case 'error':
        messageElement.style.color = '#ff6b6b';
        break;
      case 'success':
        messageElement.style.color = '#51cf66';
        break;
      case 'warning':
        messageElement.style.color = '#fcc419';
        break;
      case 'system':
        messageElement.style.color = '#4dabf7';
        messageElement.style.fontStyle = 'italic';
        break;
      case 'command':
        messageElement.style.color = '#94d3a2';
        messageElement.style.fontWeight = 'bold';
        break;
      default:
        messageElement.style.color = '#ced4da';
    }

    this.consoleHistoryElement.appendChild(messageElement);

    // Scroll to bottom
    this.consoleElement.scrollTop = this.consoleElement.scrollHeight;
  }

  executeCommand(command) {
    const args = command.split(' ');
    const cmd = args.shift().toLowerCase();
    const argString = args.join(' ');

    // Check for built-in commands
    if (cmd === 'help') {
      this.showHelp();
      return;
    }

    if (cmd === 'clear') {
      this.clearConsole();
      return;
    }

    // Check for registered commands
    if (
      window.consoleManager &&
      window.consoleManager.commands &&
      window.consoleManager.commands[cmd]
    ) {
      try {
        window.consoleManager.commands[cmd].handler(argString);
      } catch (error) {
        this.appendConsoleMessage(
          `Error executing command: ${error.message}`,
          'error'
        );
      }
      return;
    }

    // Command not found
    this.appendConsoleMessage(
      `Unknown command: ${cmd}. Type "help" for available commands.`,
      'error'
    );
  }

  registerCommand(name, description, handler) {
    if (!window.consoleManager) return;
    window.consoleManager.commands[name.toLowerCase()] = {
      description,
      handler,
    };
    console.log(`[MainContentUI] Registered console command: ${name}`);
  }

  showHelp() {
    this.appendConsoleMessage('Available commands:', 'system');
    if (window.consoleManager && window.consoleManager.commands) {
      Object.entries(window.consoleManager.commands)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically
        .forEach(([name, { description }]) => {
          this.appendConsoleMessage(
            `${name} - ${description || 'No description'}`,
            'info'
          );
        });
    }
  }

  clearConsole() {
    if (this.consoleHistoryElement) {
      this.consoleHistoryElement.innerHTML = '';
      this.appendConsoleMessage('Console cleared.', 'system');
    }
  }

  registerConsoleCommands() {
    // --- MainContentUI Commands ---
    this.registerCommand('state', 'Show current game state.', () => {
      const currentState = this.stateManager?.instance?.getStateForPlayer(
        this.stateManager?.selectedPlayerId
      );
      this.appendConsoleMessage(
        JSON.stringify(currentState || {}, null, 2),
        'info'
      );
    });
    this.registerCommand('reachable', 'List reachable locations.', () => {
      const reachable = this.stateManager?.instance
        ?.getPathAnalyzer?.()
        ?.getReachableLocations?.();
      this.appendConsoleMessage(
        `Reachable locations: ${reachable?.join(', ') || 'None'}`,
        'info'
      );
    });
    this.registerCommand('inventory', 'List current inventory items.', () => {
      const inventory = this.stateManager?.instance?.getCurrentInventory?.();
      this.appendConsoleMessage(
        `Inventory: ${inventory?.join(', ') || 'Empty'}`,
        'info'
      );
    });
    this.registerCommand('debug', 'Toggle stateManager debug mode.', () => {
      const debugMode = !this.stateManager?.instance?.getDebugMode?.();
      this.stateManager?.instance?.setDebugMode?.(debugMode);
      this.appendConsoleMessage(
        `Debug mode ${debugMode ? 'enabled' : 'disabled'}.`,
        'info'
      );
    });
    this.registerCommand(
      'connect',
      'Connect to server. Usage: connect [addr]',
      (args) => {
        const serverAddress = args || 'ws://localhost:38281';
        this.appendConsoleMessage(
          `Connecting to ${serverAddress}...`,
          'system'
        );
        this.eventBus.publish('network:connectRequest', {
          serverAddress,
          password: '',
        });
      }
    );
    this.registerCommand('disconnect', 'Disconnect from server.', () => {
      this.appendConsoleMessage('Disconnecting...', 'system');
      this.eventBus.publish('network:disconnectRequest', {});
    });
    this.registerCommand('help', 'Show available commands.', () =>
      this.showHelp()
    );
    this.registerCommand('clear', 'Clear the console.', () =>
      this.clearConsole()
    );

    // --- Register ConsoleUI Commands ---
    // Pass the register function and dependencies to ConsoleUI
    ConsoleUI.registerCommands(this.registerCommand.bind(this), {
      stateManager: this.stateManager,
      timerState: this.timerState,
      messageHandler: this.messageHandler,
      connection: this.connection, // From constructor
      // Pass specific console methods needed by ConsoleUI handlers
      consoleManager: {
        print: this.appendConsoleMessage.bind(this),
        // Add clearConsole etc. if needed by ConsoleUI handlers
      },
    });

    console.log('[MainContentUI] Registered all console commands');
  }

  updateConnectionStatus(status) {
    if (this.statusIndicator) {
      if (status === true || status === 'connected') {
        this.statusIndicator.textContent = 'Connected';
        this.statusIndicator.style.color = 'lightgreen';
        if (this.connectButton) this.connectButton.textContent = 'Disconnect';
      } else if (status === 'connecting') {
        this.statusIndicator.textContent = 'Connecting...';
        this.statusIndicator.style.color = 'orange';
        if (this.connectButton) this.connectButton.textContent = 'Cancel';
      } else {
        this.statusIndicator.textContent = 'Not Connected';
        this.statusIndicator.style.color = 'yellow';
        if (this.connectButton) this.connectButton.textContent = 'Connect';
      }
    }
  }

  dispose() {
    console.log('[MainContentUI] Disposing...');
    console.log('[MainContentUI] Dispose complete.');
  }
}

export default MainContentUI;
