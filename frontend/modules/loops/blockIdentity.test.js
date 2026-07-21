/**
 * Tests for blockIdentity — the shared queue→block resolver that keeps
 * loopState's per-block mode resolution in lockstep with the renderer's
 * per-visit grouping. The subtle case is the leaving regionMove: its own
 * instanceNumber names the DESTINATION block, but it must resolve to its
 * SOURCE block (where it's rendered and hand-driven).
 */
import { describe, it, expect } from 'vitest';
import { GameState } from '../gameState/state.js';
import { blockKeyOf, resolveQueueBlocks } from './blockIdentity.js';

function buildQueue(fn) {
  const gs = new GameState({ publish: () => {} });
  gs.setStartRegions(['Menu']);
  gs.setCurrentRegion('Menu');
  fn(gs);
  return gs.getPath();
}

describe('blockIdentity — resolveQueueBlocks', () => {
  it('blockKeyOf composes region#instance', () => {
    expect(blockKeyOf('A', 1)).toBe('A#1');
    expect(blockKeyOf('Some Region', 3)).toBe('Some Region#3');
  });

  it('maps a leaving regionMove to its SOURCE block, not its destination', () => {
    // Menu → A, locationCheck in A, A → B.
    const queue = buildQueue((gs) => {
      gs.updatePath('A', 'go', 'Menu');       // [0] regionMove Menu→A (dest instance 1)
      gs.addLocationCheck('Loc', 'A');        // [1] locationCheck in A (instance 1)
      gs.updatePath('B', 'exit', 'A');        // [2] regionMove A→B (dest instance 1)
    });
    const { indexToBlock } = resolveQueueBlocks(queue);
    // The Menu→A move belongs to the Menu block.
    expect(indexToBlock.get(0)).toMatchObject({ region: 'Menu', instance: 1 });
    // The locationCheck belongs to A#1.
    expect(indexToBlock.get(1)).toMatchObject({ region: 'A', instance: 1 });
    // The A→B move belongs to A#1 (its SOURCE), even though the entry's
    // own instanceNumber names B.
    expect(indexToBlock.get(2)).toMatchObject({ region: 'A', instance: 1, key: 'A#1' });
    expect(queue[2].type).toBe('regionMove');
    expect(queue[2].destinationRegion).toBe('B');
  });

  it('distinguishes two visits to the same region (per-visit instances)', () => {
    // Menu → A → B → A : A appears as A#1 and A#2.
    const queue = buildQueue((gs) => {
      gs.updatePath('A', 'go', 'Menu');   // [0] Menu→A
      gs.updatePath('B', 'go', 'A');      // [1] A→B  (belongs to A#1)
      gs.updatePath('A', 'go', 'B');      // [2] B→A  (belongs to B#1, dest A#2)
    });
    const { visits, indexToBlock } = resolveQueueBlocks(queue);
    const keys = visits.map((v) => v.key);
    expect(keys).toEqual(['Menu#1', 'A#1', 'B#1', 'A#2']);
    // The A→B move is in A#1; the B→A move is in B#1.
    expect(indexToBlock.get(1)).toMatchObject({ key: 'A#1' });
    expect(indexToBlock.get(2)).toMatchObject({ key: 'B#1' });
  });

  it('handles an empty queue', () => {
    const { visits, indexToBlock } = resolveQueueBlocks([]);
    expect(visits).toEqual([]);
    expect(indexToBlock.size).toBe(0);
  });
});
