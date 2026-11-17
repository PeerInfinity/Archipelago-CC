/**
 * The self-snapshot's `hasItem`/`countItem` hand a game's `has`/`count` helper the
 * loaded player's `world` (sdc-player1-tidy-3).
 *
 * The defect: `_createSelfSnapshotInterface` built a staticData for the helper with
 * no `world`, so a helper that reads options (SoE's P_ALLOW_OOB = 25 /
 * P_ALLOW_SEQUENCE_BREAKS = 26 read `world[p].options`) saw none and answered false.
 * Latent in SoE's preset (both options 0); the doc here has them ON (2 = "logic").
 *
 * Mutant: drop `world` from `helperStaticData` and the ON rows go red.
 */
import { describe, it, expect } from 'vitest';
import { _createSelfSnapshotInterface } from './statePersistence.js';
import * as soeLogic from '../../shared/gameLogic/soe/soeLogic.js';

function slot2(helperFunctions, p2Options) {
  return {
    playerId: '2',
    inventory: {},
    itemData: {},
    gameInfo: {},
    settings: {},
    progressionMapping: {},
    helperFunctions,
    rules: {
      world: {
        1: { game: 'Secret of Evermore', options: { out_of_bounds: 0, sequence_breaks: 0 } },
        2: { game: 'Secret of Evermore', options: p2Options },
      },
    },
    _hasItem: () => false,
    _countItem: () => 0,
    _logDebug() {},
  };
}

describe('self-snapshot helper staticData carries world', () => {
  it("hasItem: SoE's has sees player 2's out_of_bounds / sequence_breaks ON", () => {
    const sm = slot2(soeLogic, { out_of_bounds: 2, sequence_breaks: 2 });
    const snap = _createSelfSnapshotInterface(sm);
    expect(snap.hasItem(25)).toBe(true);
    expect(snap.hasItem(26)).toBe(true);
  });

  it('hasItem: the same flags OFF on player 2 stay false (player 1 is not read)', () => {
    const sm = slot2(soeLogic, { out_of_bounds: 0, sequence_breaks: 0 });
    sm.rules.world[1].options = { out_of_bounds: 2, sequence_breaks: 2 };
    const snap = _createSelfSnapshotInterface(sm);
    expect(snap.hasItem(25)).toBe(false);
    expect(snap.hasItem(26)).toBe(false);
  });

  it("countItem: a count helper sees the loaded player's option ON", () => {
    const helpers = {
      count: (snapshot, staticData, name) =>
        staticData.world?.[staticData.playerId]?.options?.[name] ?? -1,
    };
    const snap = _createSelfSnapshotInterface(slot2(helpers, { bonus_keys: 3 }));
    expect(snap.countItem('bonus_keys')).toBe(3);
  });
});
