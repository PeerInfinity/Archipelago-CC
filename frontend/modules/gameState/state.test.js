import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from './state.js';

function makeBus() {
  const events = [];
  return {
    events,
    publish: (name, data) => events.push({ name, data }),
    subscribe: () => () => {},
  };
}

describe('GameState — loop-mode resource API', () => {
  let bus, gs;
  beforeEach(() => {
    bus = makeBus();
    gs = new GameState(bus);
  });

  describe('default state', () => {
    it('starts at full mana', () => {
      expect(gs.getCurrentMana()).toBe(100);
      expect(gs.getMaxMana()).toBe(100);
      expect(gs.getManaPerItem()).toBe(10);
    });

    it('starts with no XP and no debt', () => {
      expect(gs.getManaDebt()).toBe(0);
      expect(gs.regionXP.size).toBe(0);
    });
  });

  describe('deductMana', () => {
    it('reduces currentMana and emits gameState:manaChanged', () => {
      gs.deductMana(25);
      expect(gs.getCurrentMana()).toBe(75);
      const ev = bus.events.find((e) => e.name === 'gameState:manaChanged');
      expect(ev).toBeDefined();
      expect(ev.data).toEqual({ current: 75, max: 100 });
    });

    it('clamps to 0 when mana would go negative (no-debt mode)', () => {
      gs.deductMana(150);
      expect(gs.getCurrentMana()).toBe(0);
    });

    it('allows negative mana and tracks debt when noManaDepletionReset is on', () => {
      gs.setNoManaDepletionReset(true);
      gs.deductMana(150);
      expect(gs.getCurrentMana()).toBe(-50);
      expect(gs.getManaDebt()).toBe(50);
    });

    it('handles fractional deductions (float mana)', () => {
      gs.deductMana(4.17);
      expect(gs.getCurrentMana()).toBeCloseTo(95.83, 5);
    });

    it('returns the new currentMana', () => {
      expect(gs.deductMana(30)).toBe(70);
    });
  });

  describe('refillMana', () => {
    it('restores currentMana to maxMana and emits event', () => {
      gs.deductMana(40);
      bus.events.length = 0;
      gs.refillMana();
      expect(gs.getCurrentMana()).toBe(100);
      expect(bus.events.find((e) => e.name === 'gameState:manaChanged')).toBeDefined();
    });
  });

  describe('recalculateMaxMana', () => {
    it('recomputes maxMana from a snapshot inventory', () => {
      const snapshot = { inventory: { sword: 1, shield: 2, key: 0 } };
      gs.recalculateMaxMana(snapshot);
      // base 100 + (3 items * 10 manaPerItem) = 130
      expect(gs.getMaxMana()).toBe(130);
    });

    it('caps currentMana when new max is lower', () => {
      gs.currentMana = 100;
      gs.recalculateMaxMana({ inventory: {} }); // → max 100, no clamp needed
      expect(gs.getCurrentMana()).toBe(100);

      gs.currentMana = 200;
      gs.recalculateMaxMana({ inventory: {} });
      expect(gs.getCurrentMana()).toBe(100);
    });

    it('emits gameState:manaChanged', () => {
      gs.recalculateMaxMana({ inventory: { a: 1 } });
      expect(bus.events.find((e) => e.name === 'gameState:manaChanged')).toBeDefined();
    });
  });

  describe('region XP', () => {
    it('initializes XP data on first access', () => {
      const data = gs.getRegionXP('Forest');
      expect(data).toEqual({ level: 0, xp: 0, xpForNextLevel: 100 });
    });

    it('returns the same object on subsequent reads (live reference)', () => {
      const a = gs.getRegionXP('Cave');
      const b = gs.getRegionXP('Cave');
      expect(a).toBe(b);
    });

    it('addRegionXP accumulates without leveling below threshold', () => {
      gs.addRegionXP('Town', 50);
      const data = gs.getRegionXP('Town');
      expect(data.level).toBe(0);
      expect(data.xp).toBe(50);
      // No level-up event yet
      expect(bus.events.filter((e) => e.name === 'gameState:xpChanged')).toEqual([]);
    });

    it('addRegionXP triggers level-up at threshold and fires gameState:xpChanged', () => {
      gs.addRegionXP('Town', 120); // 100 needed for L1, 20 leftover
      const data = gs.getRegionXP('Town');
      expect(data.level).toBe(1);
      expect(data.xp).toBe(20);
      expect(data.xpForNextLevel).toBe(120); // 100 + 1*20
      const ev = bus.events.find((e) => e.name === 'gameState:xpChanged');
      expect(ev).toBeDefined();
      expect(ev.data.regionName).toBe('Town');
    });

    it('addRegionXP can chain multiple level-ups in one call', () => {
      gs.addRegionXP('Town', 1000);
      const data = gs.getRegionXP('Town');
      expect(data.level).toBeGreaterThan(1);
      // One xpChanged event per level-up
      expect(bus.events.filter((e) => e.name === 'gameState:xpChanged').length).toBe(data.level);
    });
  });

  describe('triggerLoopReset', () => {
    it('refills mana and resets manaDebt', () => {
      gs.setStartRegions(['Menu']);
      gs.deductMana(80);
      gs.manaDebt = 5;
      bus.events.length = 0;

      gs.triggerLoopReset();

      expect(gs.getCurrentMana()).toBe(100);
      expect(gs.getManaDebt()).toBe(0);
    });

    it('preserves the path and regionInstanceCounts (queue persists across loop resets)', () => {
      // Phase 6h followup: clearing the path on loop reset wiped the
      // loops queue every time the player ran out of mana mid-walk,
      // breaking the Cavernous-style "re-run the same queue" model.
      // Loops module subscribes to gameState:loopReset to reset its
      // per-action progress separately.
      gs.setStartRegions(['Menu']);
      gs.path = [
        { type: 'regionMove', destinationRegion: 'A', sourceRegion: 'Menu', instanceNumber: 1 },
        { type: 'customAction', actionName: 'explore', sourceRegion: 'A', instanceNumber: 1 },
      ];
      gs.regionInstanceCounts.set('A', 1);

      gs.triggerLoopReset();

      expect(gs.getPath().length).toBe(2);
      expect(gs.getRegionCounts().get('A')).toBe(1);
    });

    it('emits gameState:loopReset and gameState:manaChanged (path is untouched, no pathUpdated)', () => {
      gs.setStartRegions(['Menu']);
      bus.events.length = 0;
      gs.triggerLoopReset();
      const names = bus.events.map((e) => e.name);
      expect(names).toContain('gameState:loopReset');
      expect(names).toContain('gameState:manaChanged');
      expect(names).not.toContain('gameState:pathUpdated');
    });

    it('does NOT change currentRegion (caller dispatches user:regionMove)', () => {
      gs.setStartRegions(['Menu']);
      gs.setCurrentRegion('Far');
      gs.triggerLoopReset();
      expect(gs.getCurrentRegion()).toBe('Far');
    });
  });

  describe('setCurrentRegion extra fields', () => {
    it('passes extra fields through to the published event', () => {
      gs.setStartRegions(['Menu']);
      bus.events.length = 0;
      gs.setCurrentRegion('A', { fromReset: true });
      const ev = bus.events.find((e) => e.name === 'gameState:regionChanged');
      expect(ev.data).toMatchObject({
        oldRegion: 'Menu',
        newRegion: 'A',
        fromReset: true,
      });
    });

    it('omits extras when none are passed (backwards compat)', () => {
      gs.setStartRegions(['Menu']);
      bus.events.length = 0;
      gs.setCurrentRegion('A');
      const ev = bus.events.find((e) => e.name === 'gameState:regionChanged');
      expect(ev.data).toEqual({ oldRegion: 'Menu', newRegion: 'A' });
      expect(ev.data.fromReset).toBeUndefined();
    });
  });

  describe('best-path persistence', () => {
    function makeValue({
      actions = [{ type: 'move', dir: 'E' }],
      totalCost = 5,
      itemsPickedUp = [],
      locationsChecked = [],
    } = {}) {
      return { actions, totalCost, itemsPickedUp, locationsChecked };
    }

    it('starts with no best paths', () => {
      expect(gs.bestPaths.size).toBe(0);
      expect(gs.getBestPath('any')).toBeNull();
    });

    it('records a new path on first call', () => {
      const ok = gs.recordBestPath('Forest|in|out', makeValue({
        actions: [{ type: 'move', dir: 'E' }, { type: 'move', dir: 'N' }],
        totalCost: 5,
        itemsPickedUp: ['sword'],
        locationsChecked: ['Slay Yorgle'],
      }));
      expect(ok).toBe(true);
      const stored = gs.getBestPath('Forest|in|out');
      expect(stored).toEqual({
        actions: [{ type: 'move', dir: 'E' }, { type: 'move', dir: 'N' }],
        totalCost: 5,
        itemsPickedUp: ['sword'],
        locationsChecked: ['Slay Yorgle'],
      });
    });

    it('replaces only when the new totalCost is strictly lower', () => {
      gs.recordBestPath('k', makeValue({ totalCost: 10 }));
      expect(gs.recordBestPath('k', makeValue({ totalCost: 10 }))).toBe(false);
      expect(gs.getBestPath('k').totalCost).toBe(10);
      expect(gs.recordBestPath('k', makeValue({ totalCost: 11 }))).toBe(false);
      expect(gs.getBestPath('k').totalCost).toBe(10);
      const replaced = gs.recordBestPath('k', makeValue({
        actions: [{ type: 'wait' }], totalCost: 9,
      }));
      expect(replaced).toBe(true);
      expect(gs.getBestPath('k').totalCost).toBe(9);
      expect(gs.getBestPath('k').actions).toEqual([{ type: 'wait' }]);
    });

    it('strips id / status from stored actions (Cavernous strip-progress convention)', () => {
      gs.recordBestPath('k', makeValue({
        actions: [
          { id: 7, type: 'move', dir: 'E', status: 'done' },
          { id: 8, type: 'wait', status: 'pending' },
        ],
        totalCost: 1,
      }));
      const stored = gs.getBestPath('k');
      expect(stored.actions).toEqual([
        { type: 'move', dir: 'E' },
        { type: 'wait' },
      ]);
    });

    it('stores a defensive copy of itemsPickedUp / locationsChecked', () => {
      const items = ['key'];
      const locs = ['Loc A'];
      gs.recordBestPath('k', makeValue({
        totalCost: 5, itemsPickedUp: items, locationsChecked: locs,
      }));
      items.push('extra');
      locs.push('extra-loc');
      expect(gs.getBestPath('k').itemsPickedUp).toEqual(['key']);
      expect(gs.getBestPath('k').locationsChecked).toEqual(['Loc A']);
    });

    it('rejects malformed input', () => {
      expect(gs.recordBestPath(123, makeValue())).toBe(false);
      expect(gs.recordBestPath('k', null)).toBe(false);
      expect(gs.recordBestPath('k', { totalCost: 5 })).toBe(false); // no actions
      expect(gs.recordBestPath('k', { actions: [] })).toBe(false); // no totalCost
      expect(gs.recordBestPath('k', { actions: 'nope', totalCost: 5 })).toBe(false);
      expect(gs.bestPaths.size).toBe(0);
    });

    it('clearBestPaths empties the map', () => {
      gs.recordBestPath('a', makeValue({ totalCost: 1 }));
      gs.recordBestPath('b', makeValue({ totalCost: 2 }));
      gs.clearBestPaths();
      expect(gs.bestPaths.size).toBe(0);
    });

    it('reset() clears best paths', () => {
      gs.setStartRegions(['Menu']);
      gs.recordBestPath('a', makeValue({ totalCost: 1 }));
      gs.reset();
      expect(gs.bestPaths.size).toBe(0);
    });

    it('round-trips through serialize / deserialize', () => {
      gs.setStartRegions(['Menu']);
      gs.recordBestPath('Forest|in|out', makeValue({
        actions: [{ type: 'move', dir: 'E' }, { type: 'move', dir: 'N' }],
        totalCost: 7,
        itemsPickedUp: ['sword'],
        locationsChecked: ['Slay Yorgle'],
      }));
      gs.recordBestPath('Forest|in|loc:LOC', makeValue({
        actions: [{ type: 'move', dir: 'S' }, { type: 'wait' }],
        totalCost: 12,
      }));

      const data = gs.serialize();
      const gs2 = new GameState(makeBus());
      gs2.deserialize(data);
      expect(gs2.getBestPath('Forest|in|out')).toEqual({
        actions: [{ type: 'move', dir: 'E' }, { type: 'move', dir: 'N' }],
        totalCost: 7,
        itemsPickedUp: ['sword'],
        locationsChecked: ['Slay Yorgle'],
      });
      expect(gs2.getBestPath('Forest|in|loc:LOC')).toEqual({
        actions: [{ type: 'move', dir: 'S' }, { type: 'wait' }],
        totalCost: 12,
        itemsPickedUp: [],
        locationsChecked: [],
      });
    });
  });

  describe('reset / serialize / deserialize', () => {
    it('reset clears mana and XP back to defaults', () => {
      gs.setStartRegions(['Menu']);
      gs.deductMana(40);
      gs.addRegionXP('Forest', 200);
      bus.events.length = 0;

      gs.reset();
      expect(gs.getCurrentMana()).toBe(100);
      expect(gs.getMaxMana()).toBe(100);
      expect(gs.getManaDebt()).toBe(0);
      expect(gs.regionXP.size).toBe(0);
      expect(bus.events.find((e) => e.name === 'gameState:manaChanged')).toBeDefined();
    });

    it('addCustomAction honors params.regionName for sourceRegion (queue-building from a downstream block)', () => {
      // Phase 6g/6h: queue-build from a Loops panel block representing
      // region_2_1 while the player stays at region_1_1 (loop start).
      // Pre-fix, addCustomAction stamped sourceRegion=this.currentRegion
      // (region_1_1), causing the action to render under the wrong
      // region's block.
      gs.setStartRegions(['Menu']);
      gs.setCurrentRegion('region_1_1');
      gs.updatePath('region_1_1', 'GameStart', 'Menu');
      gs.updatePath('region_2_1', 'exit_0', 'region_1_1');

      gs.addCustomAction('explore', { regionName: 'region_2_1' });

      const last = gs.getPath().at(-1);
      expect(last).toMatchObject({
        type: 'customAction',
        actionName: 'explore',
        sourceRegion: 'region_2_1',
      });
      // Instance number tracks the regionMove that landed in region_2_1.
      expect(last.instanceNumber).toBe(1);
    });

    it('addCustomAction defaults to the last regionMove\'s destination when no regionName is supplied', () => {
      gs.setStartRegions(['Menu']);
      gs.setCurrentRegion('region_1_1');
      gs.updatePath('region_1_1', 'GameStart', 'Menu');
      gs.updatePath('region_2_1', 'exit_0', 'region_1_1');

      gs.addCustomAction('explore', { repeat: true });

      const last = gs.getPath().at(-1);
      expect(last.sourceRegion).toBe('region_2_1');
    });

    it('addCustomAction falls back to currentRegion when path has no regionMoves', () => {
      gs.setStartRegions(['Menu']);
      gs.setCurrentRegion('Menu');

      gs.addCustomAction('explore', {});

      const last = gs.getPath().at(-1);
      expect(last.sourceRegion).toBe('Menu');
    });

    it('updatePath into empty path uses explicit sourceRegion (not currentRegion) for the redundancy check', () => {
      // Phase 6g queue-building scenario: player is at the loop start
      // region (region_1_1) and the queue's first entry records a
      // synthetic hop from Menu to region_1_1. The first updatePath
      // call would falsely look redundant if it fell back to
      // currentRegion === targetRegion === region_1_1.
      gs.setStartRegions(['Menu']);
      gs.setCurrentRegion('region_1_1');

      gs.updatePath('region_1_1', 'GameStart', 'Menu');

      const path = gs.getPath();
      expect(path.length).toBe(1);
      expect(path[0]).toMatchObject({
        type: 'regionMove',
        sourceRegion: 'Menu',
        destinationRegion: 'region_1_1',
        exitUsed: 'GameStart',
      });
    });

    it('clearPath wipes path entries without disturbing player position or resources', () => {
      gs.setStartRegions(['Menu', 'region_0_0']);
      gs.setCurrentRegion('region_2_3');
      gs.updatePath('region_0_0', null, 'Menu');
      gs.updatePath('region_1_0', 'east', 'region_0_0');
      gs.deductMana(30);
      gs.addRegionXP('region_0_0', 50);
      gs.recordBestPath('a:b:c', {
        actions: [{ type: 'move', dir: 'E' }],
        totalCost: 1,
        itemsPickedUp: [],
        locationsChecked: [],
      });
      bus.events.length = 0;

      gs.clearPath();

      expect(gs.getPath()).toEqual([]);
      expect(gs.getRegionCounts().size).toBe(0);
      // Player position and loop-mode resources untouched.
      expect(gs.getCurrentRegion()).toBe('region_2_3');
      expect(gs.getCurrentMana()).toBe(70);
      expect(gs.getRegionXP('region_0_0').xp).toBeGreaterThan(0);
      expect(gs.getBestPath('a:b:c')).not.toBeNull();
      // pathUpdated emitted, regionChanged NOT emitted.
      const eventNames = bus.events.map((e) => e.name);
      expect(eventNames).toContain('gameState:pathUpdated');
      expect(eventNames).not.toContain('gameState:regionChanged');
    });

    it('round-trips mana and XP via serialize/deserialize', () => {
      gs.setStartRegions(['Menu']);
      gs.currentMana = 73;
      gs.maxMana = 150;
      gs.addRegionXP('Forest', 130);

      const data = gs.serialize();
      expect(data.currentMana).toBe(73);
      expect(data.maxMana).toBe(150);
      // 130 XP added to level 0 (needs 100): leveled up, leftover xp = 30
      expect(data.regionXP).toEqual([['Forest', { level: 1, xp: 30, xpForNextLevel: 120 }]]);

      const gs2 = new GameState(makeBus());
      gs2.deserialize(data);
      expect(gs2.getCurrentMana()).toBe(73);
      expect(gs2.getMaxMana()).toBe(150);
      expect(gs2.getRegionXP('Forest')).toEqual({ level: 1, xp: 30, xpForNextLevel: 120 });
    });
  });
});
