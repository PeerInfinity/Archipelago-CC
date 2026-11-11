import { describe, it, expect } from 'vitest';
import { buildSelectedPlayerInfo } from './selectedPlayerInfo.js';

describe('buildSelectedPlayerInfo (files:jsonLoaded → selectedPlayerInfo)', () => {
  it('a preset load (no playerInfo) is unchanged: the default from selectedPlayerId', () => {
    expect(buildSelectedPlayerInfo({ selectedPlayerId: '1' })).toEqual({ playerId: '1', playerName: 'Player1' });
    expect(buildSelectedPlayerInfo({ selectedPlayerId: 3 })).toEqual({ playerId: '3', playerName: 'Player3' });
  });

  it('a name-only playerInfo at slot 2 keeps playerId 2 and the given name (the slot-2 defect)', () => {
    expect(buildSelectedPlayerInfo({ selectedPlayerId: 2, playerInfo: { playerName: 'Berry' } })).toEqual({
      playerId: '2',
      playerName: 'Berry',
    });
  });

  it('a full playerInfo is kept as given (playerId as a string)', () => {
    expect(buildSelectedPlayerInfo({ selectedPlayerId: 2, playerInfo: { playerId: 2, playerName: 'Berry' } })).toEqual({
      playerId: '2',
      playerName: 'Berry',
    });
  });

  it('null/undefined fields keep the default', () => {
    expect(
      buildSelectedPlayerInfo({ selectedPlayerId: '2', playerInfo: { playerId: undefined, playerName: null } })
    ).toEqual({ playerId: '2', playerName: 'Player2' });
  });
});
