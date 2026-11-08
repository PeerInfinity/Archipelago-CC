/**
 * game:itemsReceived carries what arrived and who sent it (P7a, additive): the substrate status strip
 * logs "Received X from <player>" from it. The sender is the slot that found the item; its name is
 * that slot's name in this room's slot info, or null when the room did not say (never made up).
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
  beginBatchUpdate: vi.fn(async () => {}),
  addItemToInventory: vi.fn(async () => {}),
  commitBatchUpdate: vi.fn(async () => {}),
}));
vi.mock('../../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManagerMock,
  getLastRawJsonData: () => null,
}));
vi.mock('./storage.js', () => ({
  default: { getItem: () => null, setItem: () => {}, initialize: () => {} },
}));

import { MessageHandler } from './messageHandler.js';
import { initializeMappingsFromDataPackage } from '../utils/idMapping.js';

const DATA_PACKAGE = {
  games: {
    APQuest: {
      item_name_to_id: { Sword: 1, Shield: 2 },
      location_name_to_id: { 'Top Left Chest': 100 },
    },
  },
};

describe('MessageHandler game:itemsReceived names the sender', () => {
  let handler;
  let published;

  beforeEach(() => {
    published = [];
    handler = new MessageHandler();
    handler.stateManager = stateManagerMock;
    handler.setEventBus({ publish: (name, payload) => published.push({ name, payload }), subscribe: () => () => {} });
    handler.clientGameName = 'APQuest';
    handler.clientSlot = 1;
    handler.slotInfo = { 1: { name: 'Quester', game: 'APQuest' }, 2: { name: 'Hiker', game: 'A Short Hike' } };
    initializeMappingsFromDataPackage(DATA_PACKAGE, 'APQuest');
  });

  it('each item names the slot that sent it, and that slot\'s room name', async () => {
    await handler._handleReceivedItems({
      cmd: 'ReceivedItems', index: 3,
      items: [{ item: 1, location: 555, player: 2, flags: 0 }, { item: 2, location: 100, player: 1, flags: 0 }, { item: 2, location: 7, player: 9, flags: 0 }],
    });
    const ev = published.find((p) => p.name === 'game:itemsReceived');
    expect(ev.payload.index).toBe(3);
    expect(ev.payload.items).toEqual([
      { itemName: 'Sword', senderSlot: 2, senderName: 'Hiker' },
      { itemName: 'Shield', senderSlot: 1, senderName: 'Quester' },
      { itemName: 'Shield', senderSlot: 9, senderName: null },
    ]);
  });
});
