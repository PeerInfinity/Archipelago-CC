/**
 * Group counts read each item's `groups` (sdc-player1-tidy). A `sm.itemGroups`
 * lookup stood ahead of that in countGroup / has_group_unique; nothing sets
 * `sm.itemGroups`, so it was dead and was removed. These rows pin that the
 * remaining path answers the same.
 */
import { describe, it, expect } from 'vitest';
import { countGroup, has_group_unique } from './inventoryManager.js';

const sm = {
  playerId: '2',
  inventory: { 'Bottle': 2, 'Bottle (Red Potion)': 1 },
  itemData: {
    'Bottle': { groups: ['Bottles'] },
    'Bottle (Red Potion)': { groups: ['Bottles'] },
    'Bottle (Fairy)': { groups: ['Bottles'] },
  },
  gameInfo: {},
};

describe('group counts from item groups', () => {
  it('countGroup sums the inventory of the group', () => {
    expect(countGroup(sm, 'Bottles')).toBe(3);
  });
  it('has_group_unique counts distinct held items', () => {
    expect(has_group_unique(sm, 'Bottles', 2)).toBe(true);
    expect(has_group_unique(sm, 'Bottles', 3)).toBe(false);
  });
});
