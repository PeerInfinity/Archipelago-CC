/**
 * Unit tests for the connect-time location scout.
 *
 * On Connected the client asks the server what is in every one of its
 * locations (LocationScouts, create_as_hint 0) and records the LocationInfo
 * answer. An item placed in our location can belong to another slot's game,
 * so its name must come from THAT game's DataPackage entry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  applyRuntimeStateData: vi.fn(),
}));
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManagerMock,
}));

vi.mock('./storage.js', () => ({
  default: { getItem: () => null, setItem: () => {}, initialize: () => {} },
}));

import { MessageHandler } from './messageHandler.js';
import { initializeMappingsFromDataPackage } from '../utils/idMapping.js';

// Two games whose IDs overlap on purpose: item 1 is a different item in each.
const DATA_PACKAGE = {
  games: {
    APQuest: {
      item_name_to_id: { Sword: 1, Shield: 2 },
      location_name_to_id: { 'Top Left Chest': 100, 'Bottom Right Chest': 101 },
    },
    'A Short Hike': {
      item_name_to_id: { 'Golden Feather': 1 },
      location_name_to_id: { 'Somewhere Else': 100 },
    },
  },
};

const CONNECTED = {
  cmd: 'Connected',
  slot: 1,
  team: 0,
  players: [
    { team: 0, slot: 1, alias: 'Quester', name: 'Quester' },
    { team: 0, slot: 2, alias: 'Hiker', name: 'Hiker' },
  ],
  missing_locations: [101],
  checked_locations: [100],
  slot_data: {},
  slot_info: {
    1: { name: 'Quester', game: 'APQuest', type: 1, group_members: [] },
    2: { name: 'Hiker', game: 'A Short Hike', type: 1, group_members: [] },
  },
};

describe('MessageHandler location scouting', () => {
  let handler;
  let published;

  beforeEach(() => {
    connectionMock.send.mockClear();
    published = [];
    handler = new MessageHandler();
    handler.setEventBus({
      publish: (name, payload) => published.push({ name, payload }),
      subscribe: () => () => {},
    });
    handler.clientGameName = 'APQuest';
    initializeMappingsFromDataPackage(DATA_PACKAGE, 'APQuest');
  });

  const sentScouts = () =>
    connectionMock.send.mock.calls
      .flatMap(([packets]) => packets)
      .filter((packet) => packet?.cmd === 'LocationScouts');

  it('scouts every checked and missing location silently on connect', async () => {
    await handler._handleConnected(CONNECTED);

    const scouts = sentScouts();
    expect(scouts).toHaveLength(1);
    expect(scouts[0].create_as_hint).toBe(0);
    expect([...scouts[0].locations].sort()).toEqual([100, 101]);
  });

  it("names each scouted item from the receiving slot's game", async () => {
    await handler._handleConnected(CONNECTED);

    handler.processMessage({
      cmd: 'LocationInfo',
      locations: [
        { item: 1, location: 100, player: 2, flags: 0b001, class: 'NetworkItem' },
        { item: 1, location: 101, player: 1, flags: 0b110, class: 'NetworkItem' },
      ],
    });

    const byLocation = Object.fromEntries(
      handler.getScoutedLocations().map((entry) => [entry.locationName, entry])
    );
    expect(byLocation['Top Left Chest']).toMatchObject({
      itemName: 'Golden Feather',
      player: 2,
      playerName: 'Hiker',
      game: 'A Short Hike',
      progression: true,
      useful: false,
      trap: false,
    });
    expect(byLocation['Bottom Right Chest']).toMatchObject({
      itemName: 'Sword',
      player: 1,
      playerName: 'Quester',
      game: 'APQuest',
      progression: false,
      useful: true,
      trap: true,
    });

    const event = published.find((entry) => entry.name === 'game:locationsScouted');
    expect(event.payload.locations).toHaveLength(2);
  });

  it('reports an item missing from the DataPackage as a null name', async () => {
    await handler._handleConnected(CONNECTED);
    handler.processMessage({
      cmd: 'LocationInfo',
      locations: [{ item: 999, location: 101, player: 1, flags: 0 }],
    });
    expect(handler.getScoutedLocations()[0].itemName).toBeNull();
  });

  it('sends no scout when the slot has no locations', async () => {
    await handler._handleConnected({
      ...CONNECTED,
      missing_locations: [],
      checked_locations: [],
    });
    expect(sentScouts()).toHaveLength(0);
  });

  it('clears the scouted results when the connection closes', async () => {
    const subscriptions = {};
    handler.setEventBus({
      publish: () => {},
      subscribe: (name, callback) => {
        subscriptions[name] = callback;
        return () => {};
      },
    });
    await handler._handleConnected(CONNECTED);
    handler.processMessage({
      cmd: 'LocationInfo',
      locations: [{ item: 2, location: 101, player: 1, flags: 0 }],
    });
    expect(handler.getScoutedLocations()).toHaveLength(1);

    subscriptions['connection:close']();
    expect(handler.getScoutedLocations()).toEqual([]);
  });
});
