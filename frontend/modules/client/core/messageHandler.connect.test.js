/**
 * Unit tests for the Connect handshake MessageHandler drives.
 *
 * The `game` field must name the LOADED PLAYER's game. A combined multiworld
 * rules.json carries the placeholder `game_name: "Multiworld"` at the top
 * level, and sending that gets the connection refused with InvalidGame
 * (reported by guigui0246). The refusal path must also leave no half-built
 * session state behind.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: vi.fn(() => null),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

const stateManagerMock = vi.hoisted(() => ({
  staticData: null,
  gameName: null,
  getStaticData: vi.fn(function () {
    return stateManagerMock.staticData;
  }),
  getGameName: vi.fn(function () {
    return stateManagerMock.gameName;
  }),
  getLatestStateSnapshot: () => null,
  clearInventory: () => {},
  invalidateCache: () => {},
  notifyUI: () => {},
}));
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManagerMock,
}));

// storage is read for a remembered slot name; keep it empty here.
vi.mock('./storage.js', () => ({
  default: { getItem: () => null, setItem: () => {}, initialize: () => {} },
}));

import { MessageHandler } from './messageHandler.js';

/** The shape getStaticGameData() produces for a combined multiworld file. */
function multiworldStaticData(playerId) {
  return {
    game_name: 'Multiworld',
    playerId,
    player_names: { 1: 'Player1', 2: 'Player2', 3: 'Player3', 4: 'Player4' },
    world: {
      1: { game: 'A Hat in Time' },
      2: { game: 'A Link to the Past' },
      3: { game: 'A Short Hike' },
      4: { game: 'Adventure' },
    },
  };
}

describe('MessageHandler Connect packet', () => {
  let handler;

  beforeEach(() => {
    connectionMock.send.mockClear();
    stateManagerMock.staticData = null;
    stateManagerMock.gameName = null;
    handler = new MessageHandler();
    handler.setEventBus({ publish: () => {}, subscribe: () => () => {} });
    handler._requestDataPackage = vi.fn();
  });

  const sentConnect = () => {
    const call = connectionMock.send.mock.calls
      .map(([packets]) => packets[0])
      .find((packet) => packet?.cmd === 'Connect');
    return call;
  };

  it("sends the selected player's game, not the multiworld placeholder", () => {
    stateManagerMock.staticData = multiworldStaticData('2');
    stateManagerMock.gameName = 'Multiworld';
    handler.clientSlotName = 'SupraGuigui';

    handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['A Hat in Time'] });

    expect(sentConnect()).toMatchObject({
      cmd: 'Connect',
      game: 'A Link to the Past',
      name: 'SupraGuigui',
    });
  });

  it('uses the single-player game name unchanged', () => {
    stateManagerMock.staticData = {
      game_name: 'TUNIC',
      playerId: '1',
      world: { 1: { game: 'TUNIC' } },
    };
    stateManagerMock.gameName = 'TUNIC';
    handler.clientSlotName = 'Player1';

    handler._handleRoomInfo({ cmd: 'RoomInfo' });

    expect(sentConnect().game).toBe('TUNIC');
  });

  it('falls back to the state manager game name when world has no entry', () => {
    stateManagerMock.staticData = { game_name: 'Adventure', playerId: '1' };
    stateManagerMock.gameName = 'Adventure';
    handler.clientSlotName = 'Player1';

    handler._handleRoomInfo({ cmd: 'RoomInfo' });

    expect(sentConnect().game).toBe('Adventure');
  });

  it("defaults the slot name to the loaded player's own name", () => {
    stateManagerMock.staticData = multiworldStaticData('3');
    expect(handler.getDefaultSlotName()).toBe('Player3');

    handler._handleRoomInfo({ cmd: 'RoomInfo' });
    expect(sentConnect()).toMatchObject({
      game: 'A Short Hike',
      name: 'Player3',
    });
  });

  it('clears session state when the server refuses the connection', () => {
    handler.clientSlot = 2;
    handler.clientTeam = 0;
    handler.players = [{ slot: 2, name: 'Player2' }];

    handler._handleConnectionRefused({ cmd: 'ConnectionRefused', errors: ['InvalidGame'] });

    expect(handler.getClientSlot()).toBeNull();
    expect(handler.getClientTeam()).toBeNull();
    expect(handler.getPlayers()).toEqual([]);
  });
});
