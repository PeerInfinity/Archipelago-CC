/**
 * Unit tests for ApClient's connection-state transitions.
 *
 * Covers the events the UI's status line and connect/disconnect toggle are
 * driven by: a connect attempt announces itself, a user-requested disconnect
 * reports the close itself (nothing else will, once the socket's own handler
 * is torn down), and an AP-level refusal drops the transport without arming
 * the reconnect loop.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ApClient } from './apClient.js';

/** Minimal eventBus double recording every publish in order. */
function makeEventBus() {
  const published = [];
  const subscribers = new Map();
  return {
    published,
    publish(event, data) {
      published.push({ event, data });
      (subscribers.get(event) || []).forEach((fn) => fn(data));
    },
    subscribe(event, handler) {
      if (!subscribers.has(event)) subscribers.set(event, []);
      subscribers.get(event).push(handler);
      return () => {
        subscribers.set(
          event,
          (subscribers.get(event) || []).filter((fn) => fn !== handler)
        );
      };
    },
    events: () => published.map((entry) => entry.event),
  };
}

/** Stand-in for archipelago.js's SocketManager. */
function makeSocket({ connected = true } = {}) {
  return {
    connected,
    handlers: {},
    on(event, handler) {
      this.handlers[event] = handler;
    },
    off(event) {
      delete this.handlers[event];
    },
    disconnect() {
      this.connected = false;
    },
    send: vi.fn(),
  };
}

describe('ApClient connection state', () => {
  let client;
  let bus;

  beforeEach(() => {
    client = new ApClient();
    bus = makeEventBus();
    client.setEventBus(bus);
  });

  it('publishes connection:close when the user disconnects', () => {
    const socket = makeSocket();
    client.client = { socket };
    client.serverAddress = 'ws://localhost:38281';

    client.disconnect();

    expect(socket.connected).toBe(false);
    expect(bus.events()).toContain('connection:close');
    const close = bus.published.find((e) => e.event === 'connection:close');
    expect(close.data).toMatchObject({
      serverAddress: 'ws://localhost:38281',
      requested: true,
    });
  });

  it('reports the close even when there is no live socket to shut down', () => {
    // A connect attempt that never opened: nothing to close, but the UI still
    // has to leave its "connecting" state on the first press.
    client.client = { socket: makeSocket({ connected: false }) };
    client.serverAddress = 'ws://localhost:38281';

    client.disconnect();

    expect(bus.events()).toContain('connection:close');
  });

  it('cancels a pending reconnect when the user disconnects', () => {
    vi.useFakeTimers();
    try {
      client.client = { socket: makeSocket({ connected: false }) };
      client.serverAddress = 'ws://localhost:38281';
      client._scheduleReconnect();
      expect(client.reconnectTimeout).not.toBeNull();

      client.disconnect();
      expect(client.reconnectTimeout).toBeNull();

      bus.published.length = 0;
      vi.advanceTimersByTime(30000);
      expect(bus.events()).not.toContain('connection:reconnecting');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the transport on ConnectionRefused and stays down', () => {
    vi.useFakeTimers();
    try {
      const socket = makeSocket();
      client.client = { socket };
      client.serverAddress = 'ws://localhost:38281';
      client.serverPassword = 'hunter2';

      // messageHandler publishes this when the refusal packet arrives.
      bus.publish('network:connectionRefused', { errors: ['InvalidGame'] });

      expect(socket.connected).toBe(false);
      expect(client.isConnected()).toBe(false);
      expect(client.preventReconnect).toBe(true);
      // The refusal reason is the state the UI shows; a close event would
      // overwrite it with a plain "not connected".
      expect(bus.events()).not.toContain('connection:close');

      bus.published.length = 0;
      vi.advanceTimersByTime(30000);
      expect(bus.events()).not.toContain('connection:reconnecting');
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces the attempt and reports failure when the socket will not open', async () => {
    client.client = {
      socket: {
        ...makeSocket({ connected: false }),
        connect: vi.fn(() => Promise.reject(new Error('boom'))),
      },
    };

    const ok = await client.connect('ws://localhost:59999');

    expect(ok).toBe(false);
    expect(bus.events()).toContain('connection:connecting');
    expect(bus.events()).toContain('connection:error');
    // No open event: nothing ever connected.
    expect(bus.events()).not.toContain('connection:open');
    const error = bus.published.find((e) => e.event === 'connection:error');
    expect(error.data.message).toContain('ws://localhost:59999');
    expect(error.data.message).toContain('boom');
  });

  it('does not publish connection:open for an attempt the user cancelled', async () => {
    let resolveConnect;
    client.client = {
      socket: {
        ...makeSocket({ connected: false }),
        connect: vi.fn(
          () => new Promise((resolve) => {
            resolveConnect = resolve;
          })
        ),
      },
    };

    const attempt = client.connect('ws://localhost:38281');
    client.disconnect(); // pressed "Cancel" while connecting
    resolveConnect({ cmd: 'RoomInfo' });

    await expect(attempt).resolves.toBe(false);
    expect(bus.events()).not.toContain('connection:open');
    expect(bus.events()).not.toContain('connection:message');
  });
});
