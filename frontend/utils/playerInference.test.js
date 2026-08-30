import { describe, it, expect } from 'vitest';

import {
  inferPlayerIdFromFileName,
  getPlayersFromRules,
  inferPlayerIdFromRules,
  resolvePlayerId,
} from './playerInference.js';

// Shape mirrors frontend/presets/multiworld/AP_.../AP_..._rules.json:
// player_names + game_info + world are all keyed by player ID.
const COMBINED = {
  game_name: 'Multiworld',
  player_names: { 1: 'Player1', 2: 'Player2', 3: 'Player3' },
  game_info: { 1: {}, 2: {}, 3: {} },
  world: {
    1: { game: 'A Hat in Time' },
    2: { game: 'A Link to the Past' },
    3: { game: 'A Short Hike' },
  },
};

// A per-player slice keeps every player's name but only its own game_info.
const SLICE_P3 = {
  player_names: { 1: 'Player1', 2: 'Player2', 3: 'Player3' },
  game_info: { 3: {} },
  world: { 3: { game: 'A Short Hike' } },
};

// Some exports carry no game_info at all; the lone player_names entry is
// then the only thing identifying the player.
const SINGLE_PLAYER = {
  player_names: { 1: 'Player1' },
  world: { 1: { game: 'A Link to the Past' } },
};

describe('inferPlayerIdFromFileName', () => {
  it('reads the _P<N>_rules.json suffix', () => {
    expect(inferPlayerIdFromFileName('AP_123_P7_rules.json')).toBe('7');
    expect(
      inferPlayerIdFromFileName('./presets/multiworld/AP_123/AP_123_P2_rules.json')
    ).toBe('2');
  });

  it('returns null for combined / unrelated names', () => {
    expect(inferPlayerIdFromFileName('AP_123_rules.json')).toBeNull();
    expect(inferPlayerIdFromFileName('AP_123_P2_sphere_log.jsonl')).toBeNull();
    expect(inferPlayerIdFromFileName(null)).toBeNull();
  });
});

describe('getPlayersFromRules', () => {
  it('lists every player with name and game, ordered numerically', () => {
    expect(getPlayersFromRules(COMBINED)).toEqual([
      { id: '1', name: 'Player1', game: 'A Hat in Time' },
      { id: '2', name: 'Player2', game: 'A Link to the Past' },
      { id: '3', name: 'Player3', game: 'A Short Hike' },
    ]);
  });

  it('unions the per-player maps and falls back on missing names/games', () => {
    expect(getPlayersFromRules({ game_info: { 2: {}, 10: {} } })).toEqual([
      { id: '2', name: 'Player 2', game: null },
      { id: '10', name: 'Player 10', game: null },
    ]);
  });

  it('returns [] for junk input', () => {
    expect(getPlayersFromRules(null)).toEqual([]);
    expect(getPlayersFromRules({})).toEqual([]);
  });
});

describe('inferPlayerIdFromRules', () => {
  it('branch (a): file name wins', () => {
    expect(inferPlayerIdFromRules('AP_123_P2_rules.json', COMBINED)).toBe('2');
  });

  it('branch (b): single game_info key', () => {
    expect(inferPlayerIdFromRules('uploaded.json', SLICE_P3)).toBe('3');
  });

  it('branch (c): ambiguous combined file yields null', () => {
    expect(inferPlayerIdFromRules('AP_123_rules.json', COMBINED)).toBeNull();
  });
});

describe('resolvePlayerId', () => {
  it('reports the file-name branch', () => {
    expect(resolvePlayerId('AP_123_P2_rules.json', COMBINED)).toMatchObject({
      playerId: '2',
      reason: 'fileName',
    });
  });

  it('reports the game_info branch', () => {
    expect(resolvePlayerId('anything.json', SLICE_P3)).toMatchObject({
      playerId: '3',
      reason: 'gameInfo',
    });
  });

  it('takes the only player when the file has just one', () => {
    expect(resolvePlayerId('anything.json', SINGLE_PLAYER)).toMatchObject({
      playerId: '1',
      reason: 'onlyPlayer',
    });
  });

  it('defaults when the file names no players', () => {
    expect(resolvePlayerId('anything.json', { regions: {} })).toMatchObject({
      playerId: '1',
      reason: 'noPlayers',
    });
  });

  it('refuses to guess between several players', () => {
    const result = resolvePlayerId('AP_123_rules.json', COMBINED);
    expect(result.playerId).toBeNull();
    expect(result.reason).toBe('ambiguous');
    expect(result.players.map((p) => p.id)).toEqual(['1', '2', '3']);
  });
});
