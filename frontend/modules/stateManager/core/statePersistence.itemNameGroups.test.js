/**
 * `world.item_name_groups` has Python's shape, `{group: [items]}` (sdc-player1-tidy).
 *
 * The defect: `getSetting('item_name_groups')` spread `sm.groupData` — `item_groups[p]`,
 * a LIST of group names — into an object, giving `{0: 'Bottles', 1: …}`; the snapshot's
 * `world` read `sm.itemGroups`, which nothing sets. Membership lives on each item's
 * `groups`. AHIT's `relic_groups` still merge on top.
 *
 * Mutant: put `...(sm.groupData || {})` back and the getSetting row sees '0' keys.
 */
import { describe, it, expect } from 'vitest';
import { itemNameGroupsOf, _createSelfSnapshotInterface } from './statePersistence.js';

function slot2() {
  return {
    playerId: '2',
    groupData: ['Bottles', 'Swords'],
    itemData: {
      'Bottle': { name: 'Bottle', groups: ['Bottles'] },
      'Bottle (Red Potion)': { name: 'Bottle (Red Potion)', groups: ['Bottles'] },
      'Fighter Sword': { name: 'Fighter Sword', groups: ['Swords'] },
      'Arrow': { name: 'Arrow' },
    },
    gameInfo: { 2: { relic_groups: { Burger: ['Burger Patty', 'Burger Cushion'] } } },
    world: { 1: { options: {} }, 2: { options: {} } },
    settings: {},
    _logDebug() {},
  };
}

describe('item_name_groups', () => {
  it('itemNameGroupsOf builds {group: [items]} from item groups', () => {
    expect(itemNameGroupsOf(slot2())).toEqual({
      Bottles: ['Bottle', 'Bottle (Red Potion)'],
      Swords: ['Fighter Sword'],
    });
  });

  it("getSetting('item_name_groups') has group keys, not list indices, plus relic_groups", () => {
    const groups = _createSelfSnapshotInterface(slot2()).getSetting('item_name_groups');
    expect(Object.keys(groups).sort()).toEqual(['Bottles', 'Burger', 'Swords']);
    expect(groups.Bottles).toEqual(['Bottle', 'Bottle (Red Potion)']);
    expect(groups['0']).toBeUndefined();
  });
});
