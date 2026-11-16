/**
 * The console's `item_groups` command (rules-feature-inventory § Else 4: it read
 * `staticData.groups.items`, which never exists, so it always said "No item
 * groups available").
 */
import { describe, it, expect, vi } from 'vitest';
import { ConsoleUI, describeItemGroups } from './consoleUI.js';

// The stateManager's staticData shape (statePersistence.getStaticGameData).
const STATIC = {
  playerId: '2',
  item_groups: { 2: ['Everything', 'Swords'] },
  itemsByPlayer: {
    2: {
      Sword: { name: 'Sword', groups: ['Everything', 'Swords'] },
      Shield: { name: 'Shield', groups: ['Everything'] },
    },
  },
};

describe('console item_groups', () => {
  it("lists the loaded player's groups with their item counts", () => {
    expect(describeItemGroups(STATIC)).toBe('Everything (2 items)\nSwords (1 item)');
    expect(describeItemGroups(null)).toBe(null);
    expect(describeItemGroups({ playerId: '1', item_groups: { 1: [] } })).toBe('');
  });

  it('the command prints them (not "No item groups available")', async () => {
    const printed = [];
    const consoleManager = { print: vi.fn((m, t) => printed.push([m, t])) };
    const stateManager = { ensureReady: vi.fn(async () => {}), getStaticData: () => STATIC };
    await ConsoleUI.handleItemGroupsCommand([], { stateManager, consoleManager });
    expect(printed).toEqual([['Item Groups:', undefined], ['Everything (2 items)\nSwords (1 item)', undefined]]);
  });
});
