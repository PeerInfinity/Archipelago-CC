/**
 * Bomb Rush Cyberfunk's `current_chapter` and `rep` helpers read prog_items for the snapshot's OWN slot
 * (shared/gameLogic/bomb_rush_cyberfunk/bomb_rush_cyberfunkLogic.js). They used to read prog_items['1'], so a
 * prog_items-only snapshot at slot 2 answered false where slot 1 answered true (sdc-player1-readers, 2026-11-12;
 * latent in play, where the inventory fallbacks answer first).
 */
import { describe, expect, it } from 'vitest';
import { helperFunctions } from '../../shared/gameLogic/bomb_rush_cyberfunk/bomb_rush_cyberfunkLogic.js';

const { current_chapter, rep } = helperFunctions;

/** A prog_items-only snapshot (no inventory, no events) for `slot`: 2 chapters completed, 40 rep. */
const progOnly = (slot, player = { id: slot }) => ({
  player,
  inventory: {},
  prog_items: { [String(slot)]: { 'Chapter Completed': 2, rep: 40 } },
});

describe('BRC current_chapter / rep read the playing slot\'s prog_items', () => {
  for (const [label, snapshot] of [
    ['slot 1', progOnly(1)],
    ['slot 2', progOnly(2)],
    ['slot 2 by player.slot', progOnly(2, { slot: 2 })],
  ]) {
    it(`${label}: the slot-1 answers`, () => {
      expect(current_chapter(snapshot, {}, 3)).toBe(true);
      expect(current_chapter(snapshot, {}, 4)).toBe(false);
      expect(rep(snapshot, {}, 40)).toBe(true);
      expect(rep(snapshot, {}, 41)).toBe(false);
    });
  }

  it('slot 2 named only by staticData.playerId', () => {
    const snapshot = { inventory: {}, prog_items: { 2: { 'Chapter Completed': 2, rep: 40 } } };
    expect(current_chapter(snapshot, { playerId: '2' }, 3)).toBe(true);
    expect(rep(snapshot, { playerId: '2' }, 40)).toBe(true);
  });

  it('slot 2 does not read slot 1\'s prog_items', () => {
    const snapshot = { player: { id: 2 }, inventory: {}, prog_items: { 1: { 'Chapter Completed': 2, rep: 40 } } };
    expect(current_chapter(snapshot, {}, 3)).toBe(false);
    expect(rep(snapshot, {}, 40)).toBe(false);
  });

  it('no player anywhere: still slot 1 (the default)', () => {
    const snapshot = { inventory: {}, prog_items: { 1: { 'Chapter Completed': 2, rep: 40 } } };
    expect(current_chapter(snapshot, {}, 3)).toBe(true);
    expect(rep(snapshot, {}, 40)).toBe(true);
  });
});
