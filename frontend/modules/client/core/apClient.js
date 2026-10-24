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
    this._refusedSubscription = null;
    // Bumped on every connect attempt so a slow attempt that resolves after
    // the user cancelled (or started a newer one) cannot publish its events.
    this._connectGeneration = 0;
  }

  setEventBus(busInstance) {
    log('info', 'Setting EventBus instance');
    this.eventBus = busInstance;

    // An AP-level refusal (bad slot name, wrong game, bad password) leaves the
    // websocket OPEN but useless: the handshake will never complete, so the
    // socket must not keep reporting a live session. messageHandler publishes
    // network:connectionRefused when the packet arrives; reacting to that
    // event (rather than to the raw packet) keeps the packet bridge intact so
    // the refusal still reaches the console and the UI.
    if (typeof this._refusedSubscription === 'function') {
      try { this._refusedSubscription(); } catch { /* ignore */ }
      this._refusedSubscription = null;
    }
    if (typeof this.eventBus?.subscribe === 'function') {
      this._refusedSubscription = this.eventBus.subscribe(
        'network:connectionRefused',
        () => this._onConnectionRefused()
      );
    }
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
    const generation = ++this._connectGeneration;

    // The websocket is now being opened, but nothing is connected yet — the
    // AP handshake only completes when the server answers Connect. Consumers
    // showing connection state use this to enter a "connecting" state.
    this.eventBus?.publish('connection:connecting', {
      serverAddress: address,
    });

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
      // archipelago.js reports every transport failure as the generic
      // "Failed to connect to Archipelago server." — naming the address is
      // the part the user can act on, so only append a detail that adds
      // something (a bad protocol, a malformed URL...).
      const reason = error?.message || String(error);
      const detail = /^failed to connect/i.test(reason) ? '' : `: ${reason}`;
      this.eventBus?.publish('connection:error', {
        message: `Failed to connect to ${url}${detail}`,
      });
      this._teardownSubscriptions();
      this._scheduleReconnect();
      return false;
    }

    // The attempt may have been superseded (a newer connect) or cancelled
    // (disconnect pressed while connecting) while the socket was opening.
    // Publishing connection:open now would resurrect a state the user left.
    if (generation !== this._connectGeneration || this.preventReconnect) {
      log('info', 'Websocket opened after the attempt was cancelled; closing it');
      this._teardownSubscriptions();
      if (this.client?.socket?.connected) {
        try { this.client.socket.disconnect(); } catch { /* ignore */ }
      }
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

  /**
   * Close the connection at the user's request.
   *
   * Publishes `connection:close` itself: the subscriptions are torn down
   * first (so the reconnect loop doesn't fire), which also removes the
   * socket's own 'disconnected' handler — without an explicit publish here,
   * nothing would ever tell the UI the connection ended, leaving a stale
   * "Connected" display and a toggle that acts on the wrong state.
   */
  disconnect() {
    this.preventReconnect = true;
    // Supersede any connect attempt still awaiting its socket.
    this._connectGeneration++;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    const serverAddress = this.serverAddress;
    this._teardownSubscriptions();
    if (this.client?.socket?.connected) {
      try { this.client.socket.disconnect(); } catch { /* ignore */ }
    }
    this.serverAddress = null;
    this.serverPassword = null;
    this.eventBus?.publish('connection:close', {
      serverAddress,
      requested: true,
    });
    return true;
  }

  /**
   * The server answered Connect with ConnectionRefused. The websocket is
   * still open but the session will never be established, so drop the
   * transport and stay down — retrying the same rejected credentials would
   * only be refused again.
   */
  _onConnectionRefused() {
    log('warn', 'AP handshake refused; closing the websocket');
    this.preventReconnect = true;
    this._connectGeneration++;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this._teardownSubscriptions();
    if (this.client?.socket?.connected) {
      try { this.client.socket.disconnect(); } catch { /* ignore */ }
    }
    this.serverAddress = null;
    this.serverPassword = null;
    // No connection:close here — the refusal reason is the state the UI
    // should show, and a close event would overwrite it with a plain
    // "not connected".
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
