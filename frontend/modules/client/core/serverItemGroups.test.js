/**
 * sdc-server-item-groups: the server's item groups (data storage
 * `_read_item_name_groups_<game>`) laid into a one-player rules document.
 */
import { describe, it, expect } from 'vitest';
import { applyServerItemGroups, itemNameGroupsKey, readServerItemGroups } from './serverItemGroups.js';
import { overlayServerData } from './localRulesOverlay.js';

function doc(player = '3') {
  return {
    item_groups: { [player]: ['Everything', 'Swords', 'Retired'] },
    items: {
      [player]: {
        Sword: { name: 'Sword', id: 1, groups: ['Everything', 'Swords', 'Retired'] },
        Shield: { name: 'Shield', id: 2, groups: ['Everything'] },
        Victory: { name: 'Victory', id: null, event: true, groups: ['Event'] },
        // Another game's item placed at this slot's location (overlayServerData's foreign item).
        'Health Upgrade': { name: 'Health Upgrade', id: 5, groups: [] },
      },
    },
  };
}
const SERVER = readServerItemGroups({ Everything: ['Sword', 'Shield'], Swords: ['Sword'], Armour: ['Shield'] });
const OWN = ['Sword', 'Shield'];

describe('serverItemGroups', () => {
  it('names the data storage key per game', () => {
    expect(itemNameGroupsKey('APQuest')).toBe('_read_item_name_groups_APQuest');
  });

  it('reads the {group: [names]} answer; null for a missing key or another shape', () => {
    expect([...SERVER.keys()]).toEqual(['Everything', 'Swords', 'Armour']);
    expect([...SERVER.get('Swords')]).toEqual(['Sword']);
    expect(readServerItemGroups(null)).toBe(null);
    expect(readServerItemGroups(undefined)).toBe(null);
    expect(readServerItemGroups(['Everything'])).toBe(null);
    expect(readServerItemGroups({ Everything: 'Sword' })).toBe(null);
  });

  it("server groups replace the file's, under the document's own player (slot 3, never player 1)", () => {
    const d = doc('3');
    const { differences } = applyServerItemGroups(d, 3, SERVER, { ownItemNames: OWN });
    expect(Object.keys(d.item_groups)).toEqual(['3']);
    expect(d.item_groups['3']).toEqual(['Armour', 'Everything', 'Swords']);
    expect(d.items['3'].Sword.groups).toEqual(['Everything', 'Swords']);
    expect(d.items['3'].Shield.groups).toEqual(['Armour', 'Everything']);
    // An event and another game's item keep the file's groups.
    expect(d.items['3'].Victory.groups).toEqual(['Event']);
    expect(d.items['3']['Health Upgrade'].groups).toEqual([]);
    expect(differences).toEqual([
      'group(s) only in the rules: Retired',
      'group(s) only on the server: Armour',
      '2 item(s) in other groups: Sword, Shield',
    ]);
  });

  it('agreement leaves the arrays as they are and reports nothing', () => {
    const d = doc('1');
    d.item_groups['1'] = ['Swords', 'Everything']; // the file's order, kept
    d.items['1'].Sword.groups = ['Swords', 'Everything'];
    const server = readServerItemGroups({ Everything: ['Sword', 'Shield'], Swords: ['Sword'] });
    const before = structuredClone(d);
    expect(applyServerItemGroups(d, '1', server, { ownItemNames: OWN }).differences).toEqual([]);
    expect(d).toEqual(before);
  });

  it("a file group still carried by an event stays listed (the server has no say over it)", () => {
    const d = doc('1');
    d.item_groups['1'].push('Event');
    applyServerItemGroups(d, '1', SERVER, { ownItemNames: OWN });
    expect(d.item_groups['1']).toEqual(['Armour', 'Event', 'Everything', 'Swords']);
  });

  it('without the DataPackage names, an item is own when a server group lists it', () => {
    const d = doc('1');
    applyServerItemGroups(d, '1', SERVER);
    expect(d.items['1'].Shield.groups).toEqual(['Armour', 'Everything']);
    expect(d.items['1']['Health Upgrade'].groups).toEqual([]);
  });

  it('offline is unchanged: overlayServerData alone (no server groups) keeps the file\'s groups', () => {
    const file = {
      game_name: 'G',
      item_groups: { 1: ['Everything'] },
      items: { 1: { A: { name: 'A', id: 7, groups: ['Everything'] } } },
      regions: { 1: { Menu: { name: 'Menu', locations: [] } } },
      world: { 1: { game: 'G', options: {} } },
    };
    const out = overlayServerData(file, '1', { slot: 2, names: { 2: 'P' } });
    expect(out.item_groups).toEqual({ 2: ['Everything'] });
    expect(out.items['2'].A.groups).toEqual(['Everything']);
  });
});
