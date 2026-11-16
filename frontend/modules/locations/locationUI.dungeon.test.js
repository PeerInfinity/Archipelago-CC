/**
 * The Locations panel's dungeon lookup finds the dungeon in the `dungeons` Map
 * (sdc-player1-tidy-3; mirrors regionBlockBuilder's round-2 fix).
 *
 * The defect: `findDungeonForRegion` ran `Object.values()` over `staticData.dungeons`,
 * which is a Map (initialization and the proxy both build one), so it iterated nothing
 * and every lookup returned null.
 *
 * Mutant: put `Object.values(staticData.dungeons)` back and the Map row reads null.
 */
import { describe, it, expect, vi } from 'vitest';

let staticData = null;
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async () => undefined } }));
vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: { getStaticData: () => staticData },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: () => true }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../discovery/singleton.js', () => ({ default: {} }));
vi.mock('../commonUI/index.js', () => ({
  default: {},
  debounce: (f) => f,
  renderLogicTree: () => null,
  applyColorblindSymbol: () => {},
  resetUnknownEvaluationCounter: () => {},
  logAndGetUnknownEvaluationCounter: () => 0,
}));
vi.mock('./index.js', () => ({ getModuleEventBus: () => null, getDispatcher: () => null }));

const { LocationUI } = await import('./locationUI.js');
const find = (name) => LocationUI.prototype.findDungeonForRegion.call({}, name);

const desert = { name: 'Desert Palace', regions: ['Desert Palace North', 'Desert Palace Main (Inner)'] };

describe('LocationUI.findDungeonForRegion', () => {
  it('finds the dungeon in a Map (the shape staticData carries)', () => {
    staticData = { dungeons: new Map([['Desert Palace', desert]]) };
    expect(find('Desert Palace North')).toBe(desert);
    expect(find('Light World')).toBeNull();
  });

  it('a plain object is still accepted', () => {
    staticData = { dungeons: { 'Desert Palace': desert } };
    expect(find('Desert Palace Main (Inner)')).toBe(desert);
  });
});
