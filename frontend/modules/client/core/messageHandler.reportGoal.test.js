/**
 * Unit tests for MessageHandler.reportGoal — the single-shot CLIENT_GOAL sender.
 *
 * Verifies the goal status (30) is sent once, guarded against re-sends, gated on
 * connection, and re-armed on (re)connect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the network connection so we can observe sent packets without a socket.
// vi.hoisted lets the factory (which is hoisted to the top) reference the mock.
const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

// Stub the stateManager singleton (would otherwise spin up a worker proxy).
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getLatestStateSnapshot: () => null,
    clearInventory: () => {},
    invalidateCache: () => {},
    notifyUI: () => {},
  },
}));

import { MessageHandler } from './messageHandler.js';
import Config from './config.js';

describe('MessageHandler.reportGoal', () => {
  let handler;

  beforeEach(() => {
    connectionMock.isConnected.mockReturnValue(true);
    connectionMock.send.mockClear();
    handler = new MessageHandler();
  });

  it('sends a single StatusUpdate with CLIENT_GOAL (30)', () => {
    const sent = handler.reportGoal();
    expect(sent).toBe(true);
    expect(connectionMock.send).toHaveBeenCalledTimes(1);
    expect(connectionMock.send).toHaveBeenCalledWith([
      { cmd: 'StatusUpdate', status: Config.CLIENT_STATUS.CLIENT_GOAL },
    ]);
    expect(Config.CLIENT_STATUS.CLIENT_GOAL).toBe(30);
  });

  it('does not re-send on subsequent calls (guarded)', () => {
    handler.reportGoal();
    handler.reportGoal();
    handler.reportGoal();
    expect(connectionMock.send).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disconnected and stays un-armed', () => {
    connectionMock.isConnected.mockReturnValue(false);
    expect(handler.reportGoal()).toBe(false);
    expect(connectionMock.send).not.toHaveBeenCalled();

    // Once connected, the goal still sends (the failed attempt did not consume the guard).
    connectionMock.isConnected.mockReturnValue(true);
    expect(handler.reportGoal()).toBe(true);
    expect(connectionMock.send).toHaveBeenCalledTimes(1);
  });

  it('re-arms when _goalReported is reset (reconnect path)', () => {
    handler.reportGoal();
    expect(connectionMock.send).toHaveBeenCalledTimes(1);

    // _handleConnected resets this flag on (re)connect.
    handler._goalReported = false;
    handler.reportGoal();
    expect(connectionMock.send).toHaveBeenCalledTimes(2);
  });
});
