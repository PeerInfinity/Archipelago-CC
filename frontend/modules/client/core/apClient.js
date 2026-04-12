// client/core/apClient.js
//
// Parallel adapter around archipelago.js v2.1.0. See
// CC/docs/plans/client-archipelago-js-migration.md.
//
// Phase 2: provides a drop-in transport replacement for connection.js. Opens
// the websocket via archipelago.js's SocketManager, bridges inbound packets
// to the existing `connection:message` eventBus event, and routes outbound
// commands through archipelago.js's `socket.send`. The legacy messageHandler
// `_handle*` methods and eventBus publishing paths remain unchanged.
//
// The phase-1 spike hook (`window.__apSpike`) is also preserved for manual
// testing independent of the feature flag.

import {
  Client,
} from '../../../libs/archipelago.js/archipelago.js';
import storage from './storage.js';
import Config from './config.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('apClient', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[apClient] ${message}`, ...data);
  }
}

export class ApClient {
  constructor() {
    this.client = null;

    this.serverAddress = null;
    this.serverPassword = null;

    this.preventReconnect = false;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.maxReconnectAttempts = 10;

    this.eventBus = null;

    this._packetSubscriber = null;
    this._disconnectSubscriber = null;
  }

  setEventBus(busInstance) {
    log('info', 'Setting EventBus instance');
    this.eventBus = busInstance;
  }

  initialize() {
    this.preventReconnect = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    log('info', 'ApClient initialized');
  }

  _ensureClient() {
    if (!this.client) {
      this.client = new Client();
      log('info', 'Created archipelago.js Client instance');
    }
    return this.client;
  }

  /**
   * Mirrors connection.js requestConnect(): reads clientSettings from storage
   * when no address is passed. Returns true if a connect attempt was started.
   */
  requestConnect(address, password) {
    log('info', 'requestConnect called', { address, hasPassword: !!password });

    let effectiveAddress = address;
    let effectivePassword = password;

    if (!effectiveAddress) {
      try {
        const storedSettingsString = storage.getItem('clientSettings');
        if (storedSettingsString) {
          const storedSettings = JSON.parse(storedSettingsString);
          if (storedSettings && storedSettings.connection) {
            effectiveAddress = storedSettings.connection.serverAddress;
            if (password === undefined || password === null || password === '') {
              effectivePassword = storedSettings.connection.password;
            }
          }
        }
      } catch (e) {
        log('error', 'Error reading clientSettings from storage:', e);
        this.eventBus?.publish('connection:error', {
          message: 'Error reading connection settings from storage.',
        });
        return false;
      }
    }

    if (!effectiveAddress) {
      this.eventBus?.publish('connection:error', {
        message: 'Server address not provided and not found in settings.',
      });
      return false;
    }

    return this.connect(effectiveAddress, effectivePassword);
  }

  /**
   * Open the websocket via archipelago.js, then bridge packets back to the
   * legacy eventBus. Returns true on success, false on failure. Fires
   * `connection:open` on success and `connection:error` on failure, matching
   * connection.js payload shapes.
   */
  async connect(address, password = null) {
    if (!address) return false;

    // Clean up any prior subscriptions / sockets.
    this._teardownSubscriptions();
    if (this.client?.socket?.connected) {
      try { this.client.socket.disconnect(); } catch { /* ignore */ }
    }

    this.serverAddress = address;
    this.serverPassword = password;
    this.preventReconnect = false;

    // Normalize address the same way connection.js does, then let
    // archipelago.js's own URL parsing finish the job.
    let formattedAddress = address;
    if (formattedAddress.search(/^\/connect /) > -1) {
      formattedAddress = formattedAddress.substring(9);
    }
    if (formattedAddress.search(/:\d+$/) === -1) {
      formattedAddress = `${formattedAddress}:${Config.DEFAULT_SERVER_PORT}`;
    }
    const protocol = /^ws:\/\//.test(formattedAddress) ? 'ws' : 'wss';
    formattedAddress = formattedAddress.replace(/^.*\/\//, '');
    const url = `${protocol}://${formattedAddress}`;

    this._ensureClient();

    // Subscribe to disconnect BEFORE connecting so the reconnect loop
    // catches failures from the very first connect attempt.
    this._disconnectSubscriber = () => this._onSocketDisconnected();
    this.client.socket.on('disconnected', this._disconnectSubscriber);

    let roomInfoPacket = null;
    try {
      log('info', `Opening websocket to ${url}`);
      roomInfoPacket = await this.client.socket.connect(url);
    } catch (error) {
      log('error', 'Failed to open websocket:', error);
      this.eventBus?.publish('connection:error', {
        message: `Failed to connect: ${error?.message || error}`,
      });
      this._teardownSubscriptions();
      this._scheduleReconnect();
      return false;
    }

    log('info', 'Websocket open, wiring packet bridge');

    // Bridge every subsequent packet to connection:message. Using the
    // generic "receivedPacket" event covers every server packet type in one
    // subscription and preserves the order the raw socket observed them.
    this._packetSubscriber = (packet) => {
      this.eventBus?.publish('connection:message', [packet]);
    };
    this.client.socket.on('receivedPacket', this._packetSubscriber);

    // Reset reconnect state on successful connect.
    this.reconnectAttempts = 0;

    // Fire connection:open using the same payload shape connection.js uses.
    this.eventBus?.publish('connection:open', {
      serverAddress: this.serverAddress,
    });

    // Hand the RoomInfo packet (returned by socket.connect) to the legacy
    // messageHandler via the same event bridge. This kicks off the
    // _handleRoomInfo → Connect flow.
    if (roomInfoPacket) {
      this.eventBus?.publish('connection:message', [roomInfoPacket]);
    }

    return true;
  }

  _teardownSubscriptions() {
    if (this.client?.socket) {
      if (this._packetSubscriber) {
        try { this.client.socket.off('receivedPacket', this._packetSubscriber); } catch { /* ignore */ }
      }
      if (this._disconnectSubscriber) {
        try { this.client.socket.off('disconnected', this._disconnectSubscriber); } catch { /* ignore */ }
      }
    }
    this._packetSubscriber = null;
    this._disconnectSubscriber = null;
  }

  _onSocketDisconnected() {
    log('info', 'Socket disconnected');
    this.eventBus?.publish('connection:close', {
      serverAddress: this.serverAddress,
    });
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this.preventReconnect || !this.serverAddress) return;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectTimeout = setTimeout(() => {
      if (this.isConnected()) return;
      if (this.preventReconnect) return;
      if (++this.reconnectAttempts > this.maxReconnectAttempts) {
        this.eventBus?.publish('connection:error', {
          message: 'Archipelago server connection lost. Maximum reconnection attempts reached.',
        });
        return;
      }
      this.eventBus?.publish('connection:reconnecting', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
      this.connect(this.serverAddress, this.serverPassword);
    }, 5000);
  }

  disconnect() {
    this.preventReconnect = true;
    this._teardownSubscriptions();
    if (this.client?.socket?.connected) {
      try { this.client.socket.disconnect(); } catch { /* ignore */ }
    }
    this.serverAddress = null;
    this.serverPassword = null;
    return true;
  }

  isConnected() {
    return !!(this.client?.socket?.connected);
  }

  /**
   * Accepts either a command object or an array of command objects, mirroring
   * connection.js's send(). Routes through archipelago.js's socket.send.
   */
  send(data) {
    if (!this.isConnected()) {
      log('warn', 'send() called while not connected');
      return false;
    }
    const packets = Array.isArray(data) ? data : [data];
    try {
      this.client.socket.send(...packets);
      return true;
    } catch (error) {
      log('error', 'Error sending packets via archipelago.js socket:', error);
      return false;
    }
  }

  getServerAddress() {
    return this.serverAddress;
  }

  getPassword() {
    return this.serverPassword;
  }

  // --- Phase 1 spike helpers (kept for manual browser console testing) ---

  async login(serverUrl, slotName, gameName, options = {}) {
    this._ensureClient();
    log('info', `Spike login: url=${serverUrl}, slot=${slotName}, game=${gameName}`);
    const loginOptions = {
      items: 0b111,
      tags: ['JSON Web Client (spike)'],
    };
    if (options.password) loginOptions.password = options.password;
    try {
      const slotData = await this.client.login(serverUrl, slotName, gameName, loginOptions);
      log('info', 'Spike login succeeded. slotData:', slotData);
      return slotData;
    } catch (err) {
      log('error', 'Spike login failed:', err);
      throw err;
    }
  }

  check(locationId) {
    if (!this.client) return;
    this.client.check(locationId);
  }

  getClient() {
    return this.client;
  }
}

export const apClient = new ApClient();

if (typeof window !== 'undefined') {
  window.__apSpike = apClient;
  log('info', 'ApClient exposed on window.__apSpike');
}

export default apClient;
