// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('stateManagerHelpers', message, ...data);
  } else {
    // In worker context, only log ERROR and WARN levels to keep console clean
    if (level === 'error' || level === 'warn') {
      const consoleMethod =
        console[level === 'info' ? 'log' : level] || console.log;
      consoleMethod(`[stateManagerHelpers] ${message}`, ...data);
    }
  }
}

/**
 * Base class for game-specific helpers
 * Provides shared functionality and structure for helper implementations
 */
export class GameHelpers {
  constructor() {
    // Remove debug property references since we're using global logging or stateManager
  }

  log(message) {
    // Simplified logging that doesn't rely on instance properties
    log('info', message);
  }

  // Helper method to execute a helper function by name
  executeHelper(name, ...args) {
    if (typeof this[name] !== 'function') {
      log('info', `Unknown helper function: ${name}`);
      return false;
    }
    const result = this[name](...args);
    //log('info', `Helper ${name}(${args.join(', ')}) returned ${result}`);
    return result;
  }

  // Helper method to execute a state method by name
  executeStateMethod(method, ...args) {
    if (typeof this[method] !== 'function') {
      log('info', `Unknown state method: ${method}`);
      return false;
    }
    const result = this[method](...args);
    //log('info', `Helper ${method}(${args.join(', ')}) returned ${result}`);
    return result;
  }
}

// Base class for game-specific state tracking
export class GameState {
  constructor(gameName = 'UnknownGame', debugLog = null) {
    this.flags = new Set();
    this.settings = {};
    this.game = gameName;
    this.startRegions = ['Menu'];
    // Properly set up debug object if debugLog is provided
    this.debug = debugLog
      ? {
          log: (msg) => {
            if (typeof msg === 'object') {
              debugLog.log(JSON.stringify(msg));
            } else {
              debugLog.log(msg);
            }
          },
        }
      : {
          log: (msg) => {
            if (console) {
              if (typeof msg === 'object') {
                log('info', JSON.stringify(msg));
              } else {
                log('info', msg);
              }
            }
          },
        };
  }

  loadSettings(settings) {
    this.settings = settings || {};
    this.game = this.settings.game || this.game;
  }

  log(message) {
    if (this.debug?.log) {
      this.debug.log(message);
    }
  }

  setFlag(flag) {
    this.flags.add(flag);
    this.log(`Set flag: ${flag}`);
  }

  hasFlag(flag) {
    const hasFlag = this.flags.has(flag);
    this.log(`Checking flag ${flag}: ${hasFlag}`);
    return hasFlag;
  }

  getState() {
    this.log(`[GameState base] getState() called. Game: ${this.game}`);
    return {
      flags: Array.from(this.flags),
      settings: this.settings,
      game: this.game,
    };
  }
}
