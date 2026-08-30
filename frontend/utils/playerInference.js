// playerInference.js - Shared helpers for deciding WHICH player's slice of a
// rules.json the frontend should load.
//
// A generated multiworld emits a combined AP_<seed>_rules.json (every player)
// alongside per-player AP_<seed>_P<N>_rules.json slices, and a single sphere
// log whose entries are keyed per player. The frontend only ever loads one
// player's slice, so picking the wrong id is silent — the app just shows the
// first player's game, and a spoiler test then fails with a generic
// "comparison failed" a long way from the actual cause.
//
// The rule is: infer the id whenever the data says which player this is, and
// let the caller ask the user when it genuinely doesn't.

import { DEFAULT_PLAYER_ID } from '../modules/shared/playerIdUtils.js';

// Per-player slices are named AP_<seed>_P<N>_rules.json by the exporter.
const PLAYER_RULES_FILE_RE = /_P(\d+)_rules\.json$/;

/**
 * Extract a player ID from a per-player rules file name.
 *
 * @param {string} fileName - File name or path (e.g. "AP_123_P3_rules.json")
 * @returns {string|null} The player ID as a string, or null if the name
 *   doesn't identify one.
 */
export function inferPlayerIdFromFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return null;
  const match = fileName.match(PLAYER_RULES_FILE_RE);
  return match ? match[1] : null;
}

/**
 * List the players described by a rules object.
 *
 * Player IDs can appear in several per-player maps; a combined multiworld
 * file has all of them, a per-player slice usually has just its own. The
 * union is taken so a file missing one map still enumerates correctly.
 *
 * @param {Object} rulesData - Parsed rules JSON
 * @returns {Array<{id: string, name: string, game: string|null}>} Players
 *   sorted by numeric ID.
 */
export function getPlayersFromRules(rulesData) {
  if (!rulesData || typeof rulesData !== 'object') return [];

  const playerNames = rulesData.player_names || {};
  const gameInfo = rulesData.game_info || {};
  const world = rulesData.world || {};

  const ids = new Set([
    ...Object.keys(playerNames),
    ...Object.keys(gameInfo),
    ...Object.keys(world),
  ]);

  return Array.from(ids)
    .sort((a, b) => Number(a) - Number(b))
    .map((id) => ({
      id,
      name: playerNames[id] || `Player ${id}`,
      game: world[id]?.game || null,
    }));
}

/**
 * Infer the player ID a rules file is "about", without guessing.
 *
 * Precedence:
 *   1. The `_P<N>_rules.json` suffix on the file name.
 *   2. A `game_info` map with exactly one key (a per-player slice keeps only
 *      its own entry).
 *   3. Otherwise null — the file describes several players and nothing says
 *      which one the user wants.
 *
 * @param {string} fileName - File name or path the rules came from
 * @param {Object} rulesData - Parsed rules JSON
 * @returns {string|null} The inferred player ID, or null when ambiguous.
 */
export function inferPlayerIdFromRules(fileName, rulesData) {
  const fromFileName = inferPlayerIdFromFileName(fileName);
  if (fromFileName) return fromFileName;

  const gameInfoKeys = Object.keys(rulesData?.game_info || {});
  if (gameInfoKeys.length === 1) return gameInfoKeys[0];

  return null;
}

/**
 * Resolve which player to load, reporting how confident the answer is.
 *
 * Callers with a UI should prompt the user when `playerId` is null and
 * `players.length > 1`; headless/programmatic callers fall back to
 * `players[0]` (see `reason: 'ambiguous'`) and should say so loudly.
 *
 * @param {string} fileName - File name or path the rules came from
 * @param {Object} rulesData - Parsed rules JSON
 * @returns {{playerId: string|null, players: Array, reason: string}}
 *   reason is one of:
 *     'fileName'  - taken from the _P<N>_rules.json suffix
 *     'gameInfo'  - the only key in game_info
 *     'onlyPlayer'- the file describes exactly one player
 *     'noPlayers' - the file names no players at all (playerId defaulted)
 *     'ambiguous' - several players, nothing identifies one (playerId null)
 */
export function resolvePlayerId(fileName, rulesData) {
  const players = getPlayersFromRules(rulesData);

  const fromFileName = inferPlayerIdFromFileName(fileName);
  if (fromFileName) {
    return { playerId: fromFileName, players, reason: 'fileName' };
  }

  const gameInfoKeys = Object.keys(rulesData?.game_info || {});
  if (gameInfoKeys.length === 1) {
    return { playerId: gameInfoKeys[0], players, reason: 'gameInfo' };
  }

  if (players.length === 1) {
    return { playerId: players[0].id, players, reason: 'onlyPlayer' };
  }

  if (players.length === 0) {
    return { playerId: DEFAULT_PLAYER_ID, players, reason: 'noPlayers' };
  }

  return { playerId: null, players, reason: 'ambiguous' };
}
