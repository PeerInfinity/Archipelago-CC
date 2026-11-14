/**
 * RE1 (reconnect events, ⚖ Robert 2026-11-14): `client:connectedStateApplied` is published AFTER the Connected
 * packet's state reset is handed to the state manager, never before it.
 *
 * `game:connected` is published BEFORE `applyRuntimeStateData` (measured in the design probe): a module that
 * re-applied something on it (the Seedling glue's game-state events) would see it wiped by the reset that follows.
 * The state manager's worker runs its commands in order, so a check sent on the new event lands after the reset.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.hoisted(() => []);
const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: vi.fn(() => null),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));
const stateManagerMock = vi.hoisted(() => ({
  getStaticData: vi.fn(() => null),
  getGameName: vi.fn(() => null),
  getLatestStateSnapshot: () => null,
  applyRuntimeStateData: vi.fn((data) => order.push({ sm: 'applyRuntimeStateData', data })),
}));
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManagerMock,
  getLastRawJsonData: () => null,
}));
vi.mock('./storage.js', () => ({ default: { getItem: () => null, setItem: () => {}, initialize: () => {} } }));

import { MessageHandler } from './messageHandler.js';

describe('client:connectedStateApplied (RE1)', () => {
  let handler;
  beforeEach(() => {
    order.length = 0;
    handler = new MessageHandler();
    handler.setEventBus({ publish: (name, payload) => order.push({ bus: name, payload }), subscribe: () => () => {} });
  });
  const connected = (slot) => ({
    cmd: 'Connected', slot, team: 0, players: [], missing_locations: [], checked_locations: [], slot_data: {}, slot_info: {},
  });
  const seq = () => order.map((e) => e.sm ?? e.bus).filter((n) => ['game:connected', 'applyRuntimeStateData', 'client:connectedStateApplied'].includes(n));

  it('comes after the reset; game:connected comes before it (why a new event is needed)', async () => {
    await handler._handleConnected(connected(1), { scout: false });
    expect(seq()).toEqual(['game:connected', 'applyRuntimeStateData', 'client:connectedStateApplied']);
    expect(order.find((e) => e.bus === 'client:connectedStateApplied').payload).toEqual({ slot: 1, team: 0 });
  });

  it('on every Connected (a reconnect is a second one), at slot 2 too', async () => {
    await handler._handleConnected(connected(2), { scout: false });
    await handler._handleConnected(connected(2), { scout: false });
    expect(seq()).toEqual(['game:connected', 'applyRuntimeStateData', 'client:connectedStateApplied',
      'game:connected', 'applyRuntimeStateData', 'client:connectedStateApplied']);
    expect(order.filter((e) => e.bus === 'client:connectedStateApplied').map((e) => e.payload.slot)).toEqual([2, 2]);
  });
});
