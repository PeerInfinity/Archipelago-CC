/**
 * Tests for blockIdentity — the shared queue→block resolver that keeps
 * loopState's per-block mode resolution in lockstep with the renderer's
 * per-visit grouping. The subtle case is the leaving regionMove: its own
 * instanceNumber names the DESTINATION block, but it must resolve to its
 * SOURCE block (where it's rendered and hand-driven).
 */
import { describe, it, expect } from 'vitest';
import { GameState } from '../gameState/state.js';
import {
  blockKeyOf,
  resolveQueueBlocks,
  recordingTagOf,
  arrivalKeyOf,
  assignRecordingTags,
} from './blockIdentity.js';

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

  it('captures enteredVia (source region + exit) on each entered block', () => {
    const queue = buildQueue((gs) => {
      gs.updatePath('A', 'go', 'Menu'); // Menu→A via exit 'go'
      gs.updatePath('B', 'east', 'A');  // A→B via exit 'east'
    });
    const { visits } = resolveQueueBlocks(queue);
    const byKey = Object.fromEntries(visits.map((v) => [v.key, v]));
    // Start block: never entered by a regionMove.
    expect(byKey['Menu#1'].enteredVia).toBeNull();
    expect(byKey['A#1'].enteredVia).toEqual({ sourceRegion: 'Menu', exitUsed: 'go' });
    expect(byKey['B#1'].enteredVia).toEqual({ sourceRegion: 'A', exitUsed: 'east' });
  });
});

describe('blockIdentity — recording tags', () => {
  it('recordingTagOf composes region/arrivalKey/ordinal', () => {
    expect(recordingTagOf('A', 'east', 0)).toBe(recordingTagOf('A', 'east', 0));
    expect(recordingTagOf('A', 'east', 0)).not.toBe(recordingTagOf('A', 'east', 1));
    expect(recordingTagOf('A', 'east', 0)).not.toBe(recordingTagOf('A', 'west', 0));
  });

  it('arrivalKeyOf returns "entrance" for the start block (null enteredVia)', () => {
    expect(arrivalKeyOf(null, null)).toBe('entrance');
    expect(arrivalKeyOf({ sourceRegion: 'Menu', exitUsed: null }, null)).toBe('entrance');
  });

  it('arrivalKeyOf falls back to the source exit name when no warehouse', () => {
    expect(arrivalKeyOf({ sourceRegion: 'A', exitUsed: 'east' }, null)).toBe('east');
  });

  it('arrivalKeyOf maps the source exit to the destination targetExitId via the warehouse', () => {
    // Mirror procgenPlayer.handleRegionMove: source world's exit 'east'
    // links to destination exit id 'B_west'.
    const warehouse = new Map([
      ['A', { world: { exits: new Map([['east', { targetExitId: 'B_west' }]]) } }],
    ]);
    expect(arrivalKeyOf({ sourceRegion: 'A', exitUsed: 'east' }, warehouse)).toBe('B_west');
    // Exit present but no targetExitId → fall back to the raw source name.
    const warehouse2 = new Map([
      ['A', { world: { exits: new Map([['east', {}]]) } }],
    ]);
    expect(arrivalKeyOf({ sourceRegion: 'A', exitUsed: 'east' }, warehouse2)).toBe('east');
    // Source region not in the warehouse → raw source name (matches the
    // recorder's identical fallback).
    expect(arrivalKeyOf({ sourceRegion: 'Z', exitUsed: 'east' }, warehouse)).toBe('east');
  });

  it('assignRecordingTags numbers ordinals within each (region, arrivalKey)', () => {
    // Menu → A → B → A : two visits to A, both entered from B/Menu via
    // distinct exits, so distinct arrivalKeys → each ordinal 0. A third A
    // visit reached the same way would be ordinal 1.
    const queue = buildQueue((gs) => {
      gs.updatePath('A', 'go', 'Menu');  // A#1 from Menu/go
      gs.updatePath('B', 'east', 'A');   // B#1 from A/east
      gs.updatePath('A', 'west', 'B');   // A#2 from B/west
      gs.updatePath('C', 'n', 'A');      // C#1
      gs.updatePath('A', 'west', 'C');   // A#3 — but from C, not B
    });
    const { visits } = resolveQueueBlocks(queue);
    assignRecordingTags(visits, null); // no warehouse → arrivalKey = raw exit name
    const byKey = Object.fromEntries(visits.map((v) => [v.key, v]));
    expect(byKey['Menu#1']).toMatchObject({ arrivalKey: 'entrance', ordinal: 0 });
    expect(byKey['A#1']).toMatchObject({ arrivalKey: 'go', ordinal: 0 });
    expect(byKey['A#2']).toMatchObject({ arrivalKey: 'west', ordinal: 0 });
    // A#3 shares (A, 'west') with A#2 → ordinal 1.
    expect(byKey['A#3']).toMatchObject({ arrivalKey: 'west', ordinal: 1 });
    expect(byKey['A#3'].recordingTag).toBe(recordingTagOf('A', 'west', 1));
  });
});
