import { describe, it, expect } from 'vitest';

import { findPresetsForRoom } from './presetResolver.js';

const SEED = '14089154938208861744';
const FOLDER = `AP_${SEED}`;

// The shapes preset_files.json has: single-player presets of one game (and a
// `_vanilla` twin of one of them), and a four-game multiworld, all seed 1.
const PRESETS = {
  metadata: { generated: 'x' },
  ahit: {
    name: 'A Hat in Time',
    folders: {
      [FOLDER]: {
        seed: 1,
        games: [{ player: 1, name: 'Player1', game: 'A Hat in Time' }],
        files: [`${FOLDER}_rules.json`, `${FOLDER}_sphere_log.jsonl`],
      },
    },
  },
  metamath: {
    folders: {
      [FOLDER]: { games: [{ player: 1, name: 'Player1', game: 'Metamath' }], files: [`${FOLDER}_rules.json`] },
    },
  },
  metamath_vanilla: {
    folders: {
      [FOLDER]: { games: [{ player: 1, name: 'Player1', game: 'Metamath' }], files: [`${FOLDER}_rules.json`] },
    },
  },
  multiworld: {
    folders: {
      [FOLDER]: {
        games: [
          { player: 1, name: 'Player1', game: 'A Hat in Time' },
          { player: 2, name: 'Player2', game: 'A Link to the Past' },
          { player: 3, name: 'Player3', game: 'A Short Hike' },
        ],
        files: [`${FOLDER}_P1_rules.json`, `${FOLDER}_P2_rules.json`, `${FOLDER}_rules.json`],
      },
    },
  },
};

describe('findPresetsForRoom', () => {
  it("finds a single-player room's preset, not the multiworld that shares its seed and slot", () => {
    const matches = findPresetsForRoom(PRESETS, { seedName: SEED, slotName: 'Player1', games: ['A Hat in Time'] });
    expect(matches).toEqual([
      { path: `./presets/ahit/${FOLDER}/${FOLDER}_rules.json`, gameKey: 'ahit', folderName: FOLDER, playerId: '1', game: 'A Hat in Time' },
    ]);
  });

  it("picks a multiworld player's own _P<N> slice", () => {
    const matches = findPresetsForRoom(PRESETS, {
      seedName: SEED, slotName: 'Player2', games: ['A Hat in Time', 'A Link to the Past', 'A Short Hike'],
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ gameKey: 'multiworld', playerId: '2', game: 'A Link to the Past' });
    expect(matches[0].path).toBe(`./presets/multiworld/${FOLDER}/${FOLDER}_P2_rules.json`);
  });

  it('falls back to the combined file when a player has no slice', () => {
    const matches = findPresetsForRoom(PRESETS, {
      seedName: SEED, slotName: 'Player3', games: ['A Hat in Time', 'A Link to the Past', 'A Short Hike'],
    });
    expect(matches[0].path).toBe(`./presets/multiworld/${FOLDER}/${FOLDER}_rules.json`);
  });

  it('returns every variant of one game made from the same seed', () => {
    const matches = findPresetsForRoom(PRESETS, { seedName: SEED, slotName: 'Player1', games: ['Metamath'] });
    expect(matches.map((m) => m.gameKey)).toEqual(['metamath', 'metamath_vanilla']);
  });

  it('matches nothing for another seed, another slot name, or a missing input', () => {
    expect(findPresetsForRoom(PRESETS, { seedName: '1', slotName: 'Player1', games: ['A Hat in Time'] })).toEqual([]);
    expect(findPresetsForRoom(PRESETS, { seedName: SEED, slotName: 'Somebody', games: ['A Hat in Time'] })).toEqual([]);
    expect(findPresetsForRoom(PRESETS, { seedName: '', slotName: 'Player1' })).toEqual([]);
    expect(findPresetsForRoom(null, { seedName: SEED, slotName: 'Player1' })).toEqual([]);
  });
});
