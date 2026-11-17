/**
 * The spoiler checklist views the LOADED slot (sdc-player1-tidy).
 *
 * The defect: `_updateCurrentPlayerId` picked the only `game_info` key, then a
 * non-existent `staticData.player`, then the first `player_names` key. It never read
 * `staticData.playerId`, so a combined document loaded at player 2 was viewed as "1".
 *
 * Mutant: drop the `staticData.playerId` branch and the player-2 row reads "1".
 */
import { describe, it, expect, vi } from 'vitest';

let staticData = null;
vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: { getStaticData: () => staticData },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: () => true }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../commonUI/index.js', () => ({ default: {}, debounce: (f) => f }));
vi.mock('./index.js', () => ({ getModuleEventBus: () => null, getCrossPlayerItemSync: () => null }));
vi.mock('./crossPlayerItemSync.js', () => ({ compareSphereIndex: () => 0 }));
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async () => undefined } }));

const { SpoilerChecklistUI } = await import('./spoilerChecklistUI.js');

function currentPlayerFor(data) {
  staticData = data;
  const ui = {};
  SpoilerChecklistUI.prototype._updateCurrentPlayerId.call(ui);
  return ui.currentPlayerId;
}

const combined = {
  game_info: { 1: { name: 'A Link to the Past' }, 2: { name: 'DLCQuest' } },
  player_names: { 1: 'Alice', 2: 'Bob' },
};

describe('spoiler checklist — current player', () => {
  it('a combined document loaded at player 2 is viewed as player 2', () => {
    expect(currentPlayerFor({ ...combined, playerId: '2' })).toBe('2');
  });

  it('a numeric playerId is normalised to a string', () => {
    expect(currentPlayerFor({ ...combined, playerId: 2 })).toBe('2');
  });

  it('without a playerId the old fallbacks still apply', () => {
    expect(currentPlayerFor({ game_info: { 3: {} } })).toBe('3');
    expect(currentPlayerFor({ player_names: { 4: 'D', 5: 'E' } })).toBe('4');
  });
});
