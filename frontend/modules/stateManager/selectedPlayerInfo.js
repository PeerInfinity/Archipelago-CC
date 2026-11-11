/**
 * The selectedPlayerInfo a `files:jsonLoaded` load stands for.
 *
 * A given `playerInfo` is MERGED over the default built from `selectedPlayerId`;
 * a field it leaves out (or sets to null/undefined) keeps the default. Before
 * this, the given object REPLACED the default, so a name-only playerInfo (every
 * server-built load sent `{ playerName }`) left `playerId` undefined and every
 * reader fell back to '1' — which broke slot 2+.
 *
 * @param {{selectedPlayerId: string|number, playerInfo?: object}} eventData
 * @returns {{playerId: string, playerName: string}}
 */
export function buildSelectedPlayerInfo(eventData) {
  const id = String(eventData.selectedPlayerId);
  const merged = { playerId: id, playerName: `Player${id}` };
  for (const [key, value] of Object.entries(eventData.playerInfo || {})) {
    if (value !== undefined && value !== null) merged[key] = value;
  }
  merged.playerId = String(merged.playerId);
  return merged;
}
