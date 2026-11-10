/**
 * MessageHandler's wiring of goalCheck: server items reach the check, Connected
 * clears them, and the goal goes out once per connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: { isConnected: vi.fn(() => true), send: vi.fn(() => true) },
  raw: { value: null },
}));
vi.mock('./apClient.js', () => ({ default: mocks.connection }));
vi.mock('../../stateManager/index.js', () => ({
  getLastRawJsonData: () => mocks.raw.value,
  stateManagerProxySingleton: {
    getLatestStateSnapshot: () => null,
    clearInventory: () => {},
    invalidateCache: () => {},
    notifyUI: () => {},
  },
}));
vi.mock('../utils/idMapping.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getItemNameFromServerId: (id) => ({ 1: 'Victory', 2: 'Sword' })[id] ?? null,
  getLocationNameFromServerId: () => null,
}));

import { MessageHandler } from './messageHandler.js';
import { GENERATED_WORLD_OPTION } from './localRulesOverlay.js';

const GAME = 'Some Generated World';
const stateManager = {
  applyRuntimeStateData: vi.fn(),
  beginBatchUpdate: vi.fn(async () => {}),
  addItemToInventory: vi.fn(async () => {}),
  commitBatchUpdate: vi.fn(async () => {}),
};
const received = (handler, index, ...ids) =>
  handler._handleReceivedItems({ index, items: ids.map((item) => ({ item, location: 9, player: 2 })) });
const goalPackets = () => mocks.connection.send.mock.calls.filter(([msgs]) => msgs.some((m) => m.status === 30));

describe('MessageHandler goal check', () => {
  let handler;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.raw.value = {
      rawJsonData: {
        world: { 2: { game: GAME, options: { [GENERATED_WORLD_OPTION]: 0 } } },
        game_info: { 2: { completion_condition: { type: 'item_check', item: 'Victory' } } },
      },
    };
    handler = new MessageHandler();
    handler._getStateManager = async () => stateManager;
    handler.clientSlot = 2;
    handler.clientGameName = GAME;
  });

  it('sends nothing before the goal item arrives', async () => {
    await received(handler, 0, 2);
    expect(goalPackets()).toHaveLength(0);
  });

  it('sends one status 30 when the goal item arrives, and none on later packets', async () => {
    await received(handler, 0, 2);
    await received(handler, 1, 1);
    await received(handler, 2, 2);
    await received(handler, 0, 2, 1); // /sync
    expect(goalPackets()).toHaveLength(1);
  });

  it('does not count items from before a resync that no longer holds them', async () => {
    await received(handler, 0, 2);
    handler._serverItems.set('Victory', 1); // stale, as if from an earlier state
    await received(handler, 0, 2);
    expect(goalPackets()).toHaveLength(0);
  });

  it('clears the items on Connected, and reports again on the next connection', async () => {
    await received(handler, 0, 1);
    expect(goalPackets()).toHaveLength(1);
    await handler._handleConnected({ slot: 2, team: 0, players: [], slot_info: {}, checked_locations: [], missing_locations: [] }).catch(() => {});
    expect(handler._serverItems.size).toBe(0);
    await received(handler, 0, 1);
    expect(goalPackets()).toHaveLength(2);
  });
});
