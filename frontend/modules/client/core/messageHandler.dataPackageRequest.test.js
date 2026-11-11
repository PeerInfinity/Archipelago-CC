/**
 * The GetDataPackage packet names the room's games.
 *
 * Since upstream 0.6.8 (#5981) MultiServer answers GetDataPackage with only
 * the games listed in `games`; a bare request gets `{"games":{}}` and every
 * DataPackage consumer (the builders, spoiler data, id mapping) fails. Our
 * fork's MultiServer still answers a bare request with everything, which hid
 * the defect. The packet must carry RoomInfo's games plus 'Archipelago'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectionMock = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  send: vi.fn(() => true),
  getPassword: vi.fn(() => null),
}));
vi.mock('./apClient.js', () => ({ default: connectionMock }));

vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getStaticData: () => null,
    getGameName: () => null,
    getLatestStateSnapshot: () => null,
    clearInventory: () => {},
    invalidateCache: () => {},
    notifyUI: () => {},
    applyRuntimeStateData: () => {},
  },
  getLastRawJsonData: () => null,
}));
vi.mock('./storage.js', () => ({
  default: { getItem: () => null, setItem: () => {}, initialize: () => {} },
}));

import { MessageHandler, dataPackageRequestFor } from './messageHandler.js';

const sentDataPackageRequests = () =>
  connectionMock.send.mock.calls
    .flatMap(([packets]) => packets)
    .filter((packet) => packet?.cmd === 'GetDataPackage');

describe('dataPackageRequestFor', () => {
  it("names RoomInfo's games, Archipelago included once", () => {
    expect(
      dataPackageRequestFor({ games: ['Archipelago', 'DepGraph', 'A Link to the Past'] })
    ).toEqual({ cmd: 'GetDataPackage', games: ['Archipelago', 'DepGraph', 'A Link to the Past'] });
  });

  it("adds Archipelago when RoomInfo's games lack it", () => {
    const packet = dataPackageRequestFor({ games: ['TUNIC'] });
    expect(packet.games).toEqual(['Archipelago', 'TUNIC']);
  });

  it('is never a bare request, even without RoomInfo games', () => {
    expect(dataPackageRequestFor(undefined)).toEqual({ cmd: 'GetDataPackage', games: ['Archipelago'] });
    expect(dataPackageRequestFor({})).toEqual({ cmd: 'GetDataPackage', games: ['Archipelago'] });
  });

  it('drops non-string and duplicate entries', () => {
    expect(dataPackageRequestFor({ games: ['TUNIC', 'TUNIC', null, 3, ''] }).games).toEqual([
      'Archipelago',
      'TUNIC',
    ]);
  });
});

describe('MessageHandler RoomInfo → GetDataPackage', () => {
  beforeEach(() => {
    connectionMock.send.mockClear();
    connectionMock.isConnected.mockReturnValue(true);
  });

  it("sends exactly one GetDataPackage carrying the room's games", () => {
    const handler = new MessageHandler();
    handler.setEventBus({ publish: () => {}, subscribe: () => () => {} });
    handler._connectForRoom = vi.fn();

    handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['Archipelago', 'DepGraph', 'Hollow Knight'] });

    const sent = sentDataPackageRequests();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      cmd: 'GetDataPackage',
      games: ['Archipelago', 'DepGraph', 'Hollow Knight'],
    });
  });

  it('sends nothing while disconnected', () => {
    connectionMock.isConnected.mockReturnValue(false);
    const handler = new MessageHandler();
    handler.setEventBus({ publish: () => {}, subscribe: () => () => {} });
    handler._connectForRoom = vi.fn();

    handler._handleRoomInfo({ cmd: 'RoomInfo', games: ['TUNIC'] });

    expect(sentDataPackageRequests()).toHaveLength(0);
  });
});
