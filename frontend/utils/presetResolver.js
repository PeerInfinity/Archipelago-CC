// presetResolver.js - Shared utility for resolving preset paths from preset_files.json data

/**
 * Resolves the first available preset rules path from parsed preset_files.json data.
 * Selects the first game alphabetically (case-insensitive), preferring seed 1.
 *
 * @param {Object} presetFilesData - Parsed content of preset_files.json
 * @returns {{ path: string, gameKey: string, gameName: string } | null}
 */
export function resolveFirstPresetPath(presetFilesData) {
  if (!presetFilesData) return null;

  // Filter out non-game keys (metadata, etc.) and find games with folders
  const gameKeys = Object.keys(presetFilesData).filter(key => {
    if (key === 'metadata') return false;
    const entry = presetFilesData[key];
    return entry && entry.folders && Object.keys(entry.folders).length > 0;
  });

  if (gameKeys.length === 0) return null;

  // Sort alphabetically (case-insensitive)
  gameKeys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // Get the first game alphabetically
  const firstGameKey = gameKeys[0];
  const gameEntry = presetFilesData[firstGameKey];
  const folders = gameEntry.folders;
  const folderNames = Object.keys(folders);

  if (folderNames.length === 0) return null;

  // Get the first folder (prefer seed 1 if available)
  let targetFolder = null;
  let targetFolderName = null;

  for (const folderName of folderNames) {
    const folderData = folders[folderName];
    if (folderData.seed === 1) {
      targetFolder = folderData;
      targetFolderName = folderName;
      break;
    }
  }

  // If no seed 1, use the first folder
  if (!targetFolder) {
    targetFolderName = folderNames[0];
    targetFolder = folders[targetFolderName];
  }

  // Find the rules file (standard, not player-specific)
  const files = targetFolder.files || [];
  const rulesFile = files.find(f => f.endsWith('_rules.json') && !f.includes('_P'));

  if (!rulesFile) return null;

  return {
    path: `./presets/${firstGameKey}/${targetFolderName}/${rulesFile}`,
    gameKey: firstGameKey,
    gameName: gameEntry.name || firstGameKey,
  };
}

const RULES_SUFFIX = '_rules.json';

/**
 * Finds the presets that hold a room's own seed: the ones whose rules the
 * client can load before it connects to that room (the connect flow, when the
 * loaded rules don't fit the room).
 *
 * The seed id alone can't decide this: seed 1 produces `AP_14089154938208861744`
 * for EVERY game, so dozens of preset directories share one folder name. A
 * match also needs the folder's games to be the room's games, and a player in
 * it with the slot's name. Variants of one game generated from the same seed
 * (`metamath` / `metamath_vanilla`) still both match; the caller decides what
 * to do with more than one.
 *
 * @param {Object} presetFilesData - Parsed content of preset_files.json
 * @param {Object} room
 * @param {string} room.seedName - RoomInfo.seed_name (the folder is `AP_<seedName>`)
 * @param {string} room.slotName - The slot name the player is connecting as
 * @param {string[]} [room.games] - The room's games (RoomInfo.games without
 *   'Archipelago'); empty or absent means "any game"
 * @returns {Array<{ path: string, gameKey: string, folderName: string,
 *   playerId: string, game: string }>} Every match, in preset_files.json order.
 */
export function findPresetsForRoom(presetFilesData, { seedName, slotName, games = [] } = {}) {
  if (!presetFilesData || !seedName || !slotName) return [];
  const folderName = `AP_${seedName}`;
  const matches = [];

  for (const [gameKey, entry] of Object.entries(presetFilesData)) {
    if (gameKey === 'metadata') continue;
    const folder = entry?.folders?.[folderName];
    if (!folder) continue;
    const files = folder.files || [];
    const players = folder.games || [];

    // The folder must describe THIS room: the same set of games. A seed-1
    // single-player AHIT room and the seed-1 four-game multiworld both have a
    // Player1 playing A Hat in Time.
    if (games.length > 0) {
      const folderGames = new Set(players.map((p) => p?.game));
      const roomGames = new Set(games);
      if (folderGames.size !== roomGames.size
        || [...roomGames].some((g) => !folderGames.has(g))) continue;
    }

    for (const player of players) {
      if (player?.name !== slotName) continue;

      // The player's own slice first, then the folder's combined/plain file.
      const playerId = String(player.player);
      const isRules = (f) => f.endsWith(RULES_SUFFIX);
      const rulesFile =
        files.find((f) => isRules(f) && f.includes(`_P${playerId}_rules.json`)) ||
        files.find((f) => isRules(f) && !/_P\d+_rules\.json/.test(f));
      if (!rulesFile) continue;

      matches.push({
        path: `./presets/${gameKey}/${folderName}/${rulesFile}`,
        gameKey,
        folderName,
        playerId,
        game: player.game,
      });
    }
  }
  return matches;
}
