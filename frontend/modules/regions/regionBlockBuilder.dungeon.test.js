/**
 * The Regions panel's dungeon line finds the dungeon in the `dungeons` Map
 * (sdc-player1-tidy).
 *
 * The defect: `findDungeonForRegion` ran `Object.values()` over `staticData.dungeons`,
 * which is a Map (initialization and the proxy both build one), so it iterated nothing
 * and every region's dungeon lookup failed.
 *
 * Mutant: put `Object.values(staticData.dungeons)` back and the Map row reads null.
 */
import { describe, it, expect, vi } from 'vitest';

let staticData = null;
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async () => undefined } }));
vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: { getStaticData: () => staticData },
}));
vi.mock('../discovery/singleton.js', () => ({ default: {} }));
vi.mock('../commonUI/index.js', () => ({ default: {}, renderLogicTree: () => null }));
vi.mock('./index.js', () => ({ getModuleEventBus: () => null }));

const { RegionBlockBuilder } = await import('./regionBlockBuilder.js');
const find = (name) => RegionBlockBuilder.prototype.findDungeonForRegion.call({}, name);

const desert = { name: 'Desert Palace', regions: ['Desert Palace North', 'Desert Palace Main (Inner)'] };

describe('findDungeonForRegion', () => {
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
