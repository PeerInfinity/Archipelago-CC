/**
 * Pool limits (ALttP's difficulty_requirements.*_limit) are world attributes,
 * not pool entries: the exporter writes them at world[p].difficulty_requirements
 * and itempool_counts carries real items only. initializeInventoryForTest reads
 * them from world[p]. Runs under vitest's `node` environment with a stub `this`.
 */
import { describe, it, expect } from 'vitest';
import { StateManager } from './stateManager.js';

function makeStub(doc) {
  const added = [];
  return {
    added,
    rules: doc,
    playerId: '1',
    itempoolCounts: doc.itempool_counts['1'],
    gameStateModule: {},
    inventory: {
      itemData: doc.items['1'],
      isProgressiveBaseItem: () => false,
    },
    clearState() {},
    beginBatchUpdate() {},
    commitBatchUpdate() {},
    addItemToInventory(name) {
      added.push(name);
    },
    _ensureProgressiveItems() {},
  };
}

const doc = {
  items: {
    1: {
      Hookshot: { id: 1 },
      'Piece of Heart': { id: 2 },
    },
  },
  itempool_counts: { 1: { Hookshot: 1, 'Piece of Heart': 24 } },
  world: {
    1: {
      difficulty_requirements: {
        progressive_bottle_limit: 4,
        boss_heart_container_limit: 10,
        heart_piece_limit: 24,
        progressive_sword_limit: 4,
      },
    },
  },
};

function run(stub) {
  try {
    StateManager.prototype.initializeInventoryForTest.call(stub, [], [
      'Hookshot',
    ]);
  } catch {
    // The progressive-exclusion pass after the pool walk needs more of the
    // real StateManager than this stub provides; the limits are set before it.
  }
}

describe('initializeInventoryForTest pool limits', () => {
  it('reads the limits from world[player].difficulty_requirements', () => {
    const stub = makeStub(doc);
    run(stub);
    expect(stub.gameStateModule.difficultyRequirements).toEqual({
      progressive_bottle_limit: 4,
      boss_heart_container_limit: 10,
      heart_piece_limit: 24,
    });
    expect(stub.added.filter((n) => n === 'Piece of Heart')).toHaveLength(24);
    expect(stub.added).not.toContain('Hookshot');
  });

  it('leaves the limits empty for a world without difficulty_requirements', () => {
    const stub = makeStub({ ...doc, world: { 1: {} } });
    run(stub);
    expect(stub.gameStateModule.difficultyRequirements).toEqual({});
  });
});
