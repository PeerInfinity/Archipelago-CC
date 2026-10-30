/**
 * The static data carries the document's `seed_name` for the client's
 * connect-time seed check. A SEEDLESS document has no `seed_name`; that must
 * load and read back as null, not undefined or a throw.
 */

import { describe, it, expect } from 'vitest';

import { getStaticGameData } from './statePersistence.js';

function smWith(rules) {
  return {
    rules,
    playerId: '1',
    itemData: new Map(),
    locationData: new Map(),
    regions: new Map(),
    locations: new Map(),
    _logDebug() {},
  };
}

describe('getStaticGameData — seed_name', () => {
  it("echoes the document's seed_name", () => {
    const rules = { game_name: 'APQuest', seed_name: '14089154938208861744', world: { 1: { game: 'APQuest' } } };
    expect(getStaticGameData(smWith(rules)).seed_name).toBe('14089154938208861744');
  });

  it('is null for a seedless document (no seed_name)', () => {
    const rules = { game_name: 'APQuest', world: { 1: { game: 'APQuest' } } };
    expect(getStaticGameData(smWith(rules)).seed_name).toBeNull();
  });
});
