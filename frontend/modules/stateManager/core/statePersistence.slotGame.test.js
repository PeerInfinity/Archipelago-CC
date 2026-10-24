/**
 * ⛓ rules F4 — the LOADED slot's game is `world["<p>"].game`. The top-level
 * `game_name` is the document's label, and a combined document says
 * `"Multiworld"` there, so a reader that resolves logic, inventory or the
 * snapshot's identity from it gets no game at all.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { slotGameName, getSnapshot, getStaticGameData } from './statePersistence.js';

// A combined document, loaded at player 2 (what initialization leaves on sm).
function combinedAt(playerId) {
  const rules = {
    game_name: 'Multiworld',
    game_directory: 'multiworld',
    world: {
      1: { game: 'A Link to the Past', world_directory: 'alttp' },
      2: { game: 'DLCQuest', world_directory: 'dlcquest' },
    },
  };
  return {
    rules,
    playerId,
    settings: { ...rules.world[playerId] },
    cacheValid: true,
    snapshotCount: 0,
    inventory: {},
    _logDebug() {},
  };
}

describe('slotGameName — a combined document resolves the loaded slot', () => {
  it("player 2 of a \"Multiworld\" document is DLCQuest, player 1 is ALttP", () => {
    expect(slotGameName(combinedAt('2'))).toBe('DLCQuest');
    expect(slotGameName(combinedAt('1'))).toBe('A Link to the Past');
  });

  it("the snapshot's game is the slot's, never the label", () => {
    expect(getSnapshot(combinedAt('2')).game).toBe('DLCQuest');
  });

  it('the static data still echoes the document labels as written', () => {
    const sm = combinedAt('2');
    Object.assign(sm, { itemData: new Map(), locationData: new Map(), regions: new Map(), locations: new Map() });
    const data = getStaticGameData(sm);
    expect(data.game_name).toBe('Multiworld');
    expect(data.game_directory).toBe('multiworld');
  });
});

describe('statePersistence — every `game_name` read is classified', () => {
  // The one remaining read is getStaticGameData's echo of the document label.
  // A new read of the label for logic would land here first.
  it('reads `sm.rules?.game_name` exactly once (the label echo)', () => {
    const src = readFileSync(new URL('./statePersistence.js', import.meta.url), 'utf8');
    expect(src.match(/rules\?\.game_name/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/\n {4}game_name: sm\.rules\?\.game_name,\n/);
  });
});
