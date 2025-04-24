// client/ui/consoleUI.js - Updated to use the console manager
import eventBus from '../../../app/core/eventBus.js';
import Config from '../core/config.js';
import messageHandler from '../core/messageHandler.js';
import connection from '../core/connection.js';

// ConsoleUI class manages the console interface
export class ConsoleUI {
  static cachedCommands = [];
  static commandCursor = 0;
  static consoleWindow = null;
  static commandInput = null;
  static autoScrollPaused = false;
  static useMarquee = false;
  static maxCachedCommands = Config.MAX_CACHED_COMMANDS || 10;

  static initialize() {
    // Get UI elements - these will be set by MainContentUI now
    this.consoleWindow = document.getElementById('main-console');
    this.commandInput = document.getElementById('main-console-input');

    if (!this.consoleWindow || !this.commandInput) {
      console.log(
        'Console UI elements not found - will use console manager when available'
      );
      // We'll use the console manager that will be created by MainContentUI
      return;
    }

    // Reset state
    this.cachedCommands = [];
    this.commandCursor = 0;
    this.autoScrollPaused = false;

    // Set up event listeners
    this._setupEventListeners();

    // Subscribe to console message events
    eventBus.subscribe('console:message', (message) => {
      this.appendMessage(message);
    });

    eventBus.subscribe('console:formattedMessage', (data) => {
      this.appendFormattedMessage(data);
    });

    console.log('ConsoleUI module initialized');
  }

  static _setupEventListeners() {
    // If console elements aren't available yet, return early
    if (!this.commandInput || !this.consoleWindow) return;

    // Add additional command handling for AP integration
    this._registerNetworkCommands();

    // Command history navigation
    this.commandInput.addEventListener('keydown', (event) => {
      // Only handle arrow keys
      const allowedKeys = ['ArrowUp', 'ArrowDown'];
      if (allowedKeys.indexOf(event.key) === -1) {
        return;
      }

      switch (event.key) {
        case 'ArrowUp':
          this._handleCommandUp();
          break;

        case 'ArrowDown':
          this._handleCommandDown();
          break;
      }
    });

    // Command execution
    this.commandInput.addEventListener('keyup', (event) => {
      // Ignore non-enter keyup events and empty commands
      if (event.key !== 'Enter' || !event.target.value) {
        return;
      }

      const command = event.target.value.trim();
      this._cacheCommand(command);
      this.commandCursor = 0;
      event.target.value = '';

      // Add the command to the console
      this.appendMessage(`> ${command}`, 'command');

      // Process the command
      this.executeCommand(command);
    });
  }

  static _registerNetworkCommands() {
    // Use the console manager if available, otherwise set up our own commands
    if (window.consoleManager) {
      const cmdRegister = window.consoleManager.registerCommand.bind(
        window.consoleManager
      );

      cmdRegister(
        'received',
        'Show received items',
        this.handleReceivedCommand.bind(this)
      );
      cmdRegister(
        'missing',
        'Show missing locations',
        this.handleMissingCommand.bind(this)
      );
      cmdRegister(
        'items',
        'List available items',
        this.handleItemsCommand.bind(this)
      );
      cmdRegister(
        'item_groups',
        'List available item groups',
        this.handleItemGroupsCommand.bind(this)
      );
      cmdRegister(
        'locations',
        'List available locations',
        this.handleLocationsCommand.bind(this)
      );
      cmdRegister(
        'location_groups',
        'List available location groups',
        this.handleLocationGroupsCommand.bind(this)
      );
      cmdRegister(
        'ready',
        'Send ready status to server',
        this.handleReadyCommand.bind(this)
      );
      cmdRegister(
        'set_delay',
        'Set check delay in seconds',
        this.handleSetDelayCommand.bind(this)
      );
    }
  }

  static _handleCommandUp() {
    if (!this.commandInput || this.cachedCommands.length === 0) return;

    if (this.commandCursor < this.cachedCommands.length) {
      this.commandCursor++;
      this.commandInput.value =
        this.cachedCommands[this.cachedCommands.length - this.commandCursor];

      // Move cursor to end of input
      setTimeout(() => {
        this.commandInput.selectionStart = this.commandInput.selectionEnd =
          this.commandInput.value.length;
      }, 0);
    }
  }

  static _handleCommandDown() {
    if (!this.commandInput) return;

    if (this.commandCursor > 1) {
      this.commandCursor--;
      this.commandInput.value =
        this.cachedCommands[this.cachedCommands.length - this.commandCursor];
    } else {
      this.commandCursor = 0;
      this.commandInput.value = '';
    }
  }

  static executeCommand(command) {
    const args = command.split(' ');
    const cmd = args.shift().toLowerCase();
    const argString = args.join(' ');

    // Check for console manager first
    if (window.consoleManager && window.consoleManager.executeCommand) {
      window.consoleManager.executeCommand(command);
      return;
    }

    // Built-in commands
    switch (cmd) {
      case 'help':
        this.appendMessage('Available commands:');
        this.appendMessage('received - Show received items');
        this.appendMessage('missing - Show missing locations');
        this.appendMessage('items - List available items');
        this.appendMessage('item_groups - List available item groups');
        this.appendMessage('locations - List available locations');
        this.appendMessage('location_groups - List available location groups');
        this.appendMessage('ready - Send ready status to server');
        this.appendMessage('set_delay <seconds> - Set check delay in seconds');
        this.appendMessage('clear - Clear console');
        this.appendMessage('help - Show this help message');
        break;

      case 'clear':
        this.clear();
        break;

      case 'received':
        this.handleReceivedCommand();
        break;

      case 'missing':
        this.handleMissingCommand();
        break;

      case 'items':
        this.handleItemsCommand();
        break;

      case 'item_groups':
        this.handleItemGroupsCommand();
        break;

      case 'locations':
        this.handleLocationsCommand();
        break;

      case 'location_groups':
        this.handleLocationGroupsCommand();
        break;

      case 'ready':
        this.handleReadyCommand();
        break;

      case 'set_delay':
        this.handleSetDelayCommand(argString);
        break;

      default:
        this.appendMessage(`Unknown command: ${cmd}`);
        break;
    }
  }

  static handleReceivedCommand() {
    this.appendMessage('Received Items:');
    if (window.messageHandler) {
      const items = window.messageHandler.itemsReceived || [];
      if (items.length === 0) {
        this.appendMessage('No items received yet.');
        return;
      }

      items.forEach((item, index) => {
        let itemName = 'Unknown';
        let locationName = 'Unknown';

        try {
          itemName = window.messageHandler.getItemNameSync(item.item);
          locationName = window.messageHandler.getLocationNameSync(
            item.location
          );
        } catch (e) {
          // Use defaults if error
        }

        this.appendMessage(`${index + 1}. ${itemName} from ${locationName}`);
      });
    } else {
      this.appendMessage('Message handler not available.');
    }
  }

  static handleMissingCommand() {
    this.appendMessage('Missing Locations:');

    // Get references to required objects
    const mh = window.messageHandler || null;
    const sm = window.stateManager || null;

    if (mh && typeof mh.getMissingLocations === 'function') {
      const missing = mh.getMissingLocations() || [];
      if (missing.length === 0) {
        this.appendMessage('No missing locations found.');
        return;
      }

      const limitedList = missing.slice(0, 20); // Limit to 20 to avoid flooding console
      limitedList.forEach((locId) => {
        let locationName = 'Unknown';
        try {
          if (typeof mh.getLocationNameSync === 'function') {
            locationName = mh.getLocationNameSync(locId);
          }
        } catch (e) {
          locationName = `Unknown (ID: ${locId})`;
        }
        this.appendMessage(`- ${locationName}`);
      });

      if (missing.length > 20) {
        this.appendMessage(`...and ${missing.length - 20} more locations.`);
      }
    } else if (sm && sm.missing_locations) {
      // Try stateManager as fallback
      const missing = Array.from(sm.missing_locations);
      if (missing.length === 0) {
        this.appendMessage('No missing locations found.');
        return;
      }

      const limitedList = missing.slice(0, 20);
      limitedList.forEach((locId) => {
        let locationName = `Location ${locId}`;
        if (
          sm.getLocationNameFromId &&
          typeof sm.getLocationNameFromId === 'function'
        ) {
          try {
            const name = sm.getLocationNameFromId(locId);
            if (name) locationName = name;
          } catch (e) {}
        }
        this.appendMessage(`- ${locationName}`);
      });

      if (missing.length > 20) {
        this.appendMessage(`...and ${missing.length - 20} more locations.`);
      }
    } else {
      this.appendMessage('Missing location data not available.');
    }
  }

  static handleItemsCommand() {
    this.appendMessage('Available Items:');

    // Get reference to stateManager
    const sm = window.stateManager || null;

    if (sm && sm.itemNameToId) {
      const items = Object.keys(sm.itemNameToId);
      if (items.length === 0) {
        this.appendMessage('No items found.');
        return;
      }

      const limitedList = items.slice(0, 20); // Limit to 20 to avoid flooding console
      limitedList.forEach((itemName) => {
        this.appendMessage(`- ${itemName}`);
      });

      if (items.length > 20) {
        this.appendMessage(`...and ${items.length - 20} more items.`);
      }
    } else {
      this.appendMessage('Item data not available.');
    }
  }

  static handleItemGroupsCommand() {
    this.appendMessage('Available Item Groups:');

    // Get reference to stateManager
    const sm = window.stateManager || null;

    if (sm && sm.inventory && sm.inventory.groupData) {
      const groups = Object.keys(sm.inventory.groupData || {});
      if (groups.length === 0) {
        this.appendMessage('No item groups found.');
        return;
      }

      groups.forEach((groupName) => {
        this.appendMessage(`- ${groupName}`);
      });
    } else {
      this.appendMessage('Item group data not available.');
    }
  }

  static handleLocationsCommand() {
    this.appendMessage('Available Locations:');

    // Get reference to stateManager
    const sm = window.stateManager || null;

    if (sm && sm.locationNameToId) {
      const locations = Object.keys(sm.locationNameToId);
      if (locations.length === 0) {
        this.appendMessage('No locations found.');
        return;
      }

      const limitedList = locations.slice(0, 20); // Limit to 20 to avoid flooding console
      limitedList.forEach((locationName) => {
        this.appendMessage(`- ${locationName}`);
      });

      if (locations.length > 20) {
        this.appendMessage(`...and ${locations.length - 20} more locations.`);
      }
    } else {
      this.appendMessage('Location data not available.');
    }
  }

  static handleLocationGroupsCommand() {
    this.appendMessage('Available Location Groups:');

    // Get reference to stateManager
    const sm = window.stateManager || null;

    if (sm && sm.regions) {
      // Extract unique region names as location groups
      const regions = new Set(Object.keys(sm.regions));
      if (regions.size === 0) {
        this.appendMessage('No location groups found.');
        return;
      }

      [...regions].sort().forEach((regionName) => {
        this.appendMessage(`- ${regionName}`);
      });
    } else {
      this.appendMessage('Location group data not available.');
    }
  }

  static handleReadyCommand() {
    this.appendMessage('Setting ready status...');

    // Get reference to messageHandler
    const mh = window.messageHandler || null;

    if (mh && typeof mh.sendStatusUpdate === 'function') {
      mh.sendStatusUpdate(10); // 10 = CLIENT_READY
      this.appendMessage('Ready status sent to server.');
    } else {
      this.appendMessage('Message handler not available.');
    }
  }

  static handleSetDelayCommand(delayArg) {
    // Parse arguments - supports either "30" or "20 40" format
    const parts = delayArg ? delayArg.split(/\s+/) : [];

    if (parts.length === 0 || parts[0] === '') {
      this.appendMessage('Please specify at least one delay value in seconds.');
      return;
    }

    // Parse first value (min or fixed)
    const minDelay = parseInt(parts[0], 10);
    if (isNaN(minDelay) || minDelay < 1) {
      this.appendMessage('Invalid delay value. Please specify a number >= 1.');
      return;
    }

    // Parse second value (max) if provided
    let maxDelay = null;
    if (parts.length > 1) {
      maxDelay = parseInt(parts[1], 10);
      if (isNaN(maxDelay) || maxDelay < 1) {
        this.appendMessage('Invalid max delay. Please specify a number >= 1.');
        return;
      }
    }

    // Get reference to timerState
    const ts = window.timerState || null;

    if (ts && typeof ts.setCheckDelay === 'function') {
      if (maxDelay === null) {
        this.appendMessage(`Setting fixed delay to ${minDelay} seconds...`);
        ts.setCheckDelay(minDelay);
        this.appendMessage(`Check delay updated to fixed ${minDelay} seconds.`);
      } else {
        this.appendMessage(
          `Setting delay range to ${minDelay}-${maxDelay} seconds...`
        );
        ts.setCheckDelay(minDelay, maxDelay);
        this.appendMessage(
          `Check delay updated to range: ${minDelay}-${maxDelay} seconds.`
        );
      }
    } else {
      this.appendMessage('Game state not available.');
    }
  }

  static _cacheCommand(command) {
    // Don't cache if it's the same as the last command or empty
    if (
      this.cachedCommands.length > 0 &&
      (this.cachedCommands[this.cachedCommands.length - 1] === command ||
        command === '')
    ) {
      return;
    }

    // Add to cache and limit size
    this.cachedCommands.push(command);
    if (this.cachedCommands.length > this.maxCachedCommands) {
      this.cachedCommands.shift();
    }
  }

  static appendMessage(message, type = 'info') {
    // Use console manager if available
    if (window.consoleManager && window.consoleManager.print) {
      window.consoleManager.print(message, type);
      return;
    }

    // Otherwise use direct DOM manipulation if elements are available
    if (!this.consoleWindow) return;

    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = `console-message console-message-${
      type || 'info'
    }`;

    // Add to console
    this.consoleWindow.appendChild(messageElement);

    // Auto-scroll
    if (!this.autoScrollPaused) {
      this.consoleWindow.scrollTop = this.consoleWindow.scrollHeight;
    }
  }

  static appendFormattedMessage(messageParts) {
    // Use console manager if available
    if (window.consoleManager && window.consoleManager.print) {
      const message = messageParts.map((part) => part.text).join('');
      window.consoleManager.print(message, messageParts[0]?.type || 'info');
      return;
    }

    // Otherwise format it ourselves
    if (!this.consoleWindow) return;

    const container = document.createElement('div');
    container.className = 'console-message';

    messageParts.forEach((part) => {
      const span = document.createElement('span');
      span.textContent = part.text;

      if (part.type) {
        span.className = `console-${part.type}`;
      }

      container.appendChild(span);
    });

    this.consoleWindow.appendChild(container);

    // Auto-scroll
    if (!this.autoScrollPaused) {
      this.consoleWindow.scrollTop = this.consoleWindow.scrollHeight;
    }
  }

  static clear() {
    // Use console manager if available
    if (window.consoleManager && window.consoleManager.print) {
      // The console manager should handle clearConsole
      if (typeof window.consoleManager.clearConsole === 'function') {
        window.consoleManager.clearConsole();
      } else {
        window.consoleManager.print('Console cleared.', 'system');
      }
      return;
    }

    // Otherwise clear directly
    if (this.consoleWindow) {
      this.consoleWindow.innerHTML = '';
      this.appendMessage('Console cleared.', 'system');
    }
  }

  static setUseMarquee(use) {
    this.useMarquee = !!use;
  }

  static focus() {
    if (this.commandInput) {
      this.commandInput.focus();
    }
  }
}

export default ConsoleUI;
