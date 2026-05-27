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

    it('increments loopResetCount and includes it in the event payload', () => {
      gs.setStartRegions(['Menu']);
      expect(gs.getLoopResetCount()).toBe(0);
      bus.events.length = 0;
      gs.triggerLoopReset();
      expect(gs.getLoopResetCount()).toBe(1);
      const ev = bus.events.find((e) => e.name === 'gameState:loopReset');
      expect(ev.data.resetCount).toBe(1);

      gs.triggerLoopReset();
      gs.triggerLoopReset();
      expect(gs.getLoopResetCount()).toBe(3);
    });
  });

  describe('substrate max-mana bonuses', () => {
    it('defaults to 0 for an unregistered substrate', () => {
      expect(gs.getSubstrateMaxManaBonus('jta')).toBe(0);
    });

    it('contributes additively to maxMana', () => {
      // base 100, no items, no bonuses → 100
      expect(gs.getMaxMana()).toBe(100);
      gs.setSubstrateMaxManaBonus('jta', 50);
      expect(gs.getMaxMana()).toBe(150);
      gs.setSubstrateMaxManaBonus('maze', 25);
      expect(gs.getMaxMana()).toBe(175);
    });

    it('updates the existing bonus rather than accumulating', () => {
      gs.setSubstrateMaxManaBonus('jta', 50);
      gs.setSubstrateMaxManaBonus('jta', 30);
      expect(gs.getSubstrateMaxManaBonus('jta')).toBe(30);
      expect(gs.getMaxMana()).toBe(130);
    });

    it('stacks with the AP-item term', () => {
      gs.recalculateMaxMana({ inventory: { sword: 2 } });
      // 100 + 2*10 = 120
      expect(gs.getMaxMana()).toBe(120);
      gs.setSubstrateMaxManaBonus('jta', 40);
      // 100 + 40 + 2*10 = 160
      expect(gs.getMaxMana()).toBe(160);
    });

    it('emits gameState:manaChanged on update', () => {
      bus.events.length = 0;
      gs.setSubstrateMaxManaBonus('jta', 30);
      expect(bus.events.find((e) => e.name === 'gameState:manaChanged')).toBeDefined();
    });

    it('caps currentMana when a bonus is removed and max drops below it', () => {
      gs.setSubstrateMaxManaBonus('jta', 100); // max 200
      gs.currentMana = 200;
      gs.setSubstrateMaxManaBonus('jta', 0);   // max back to 100
      expect(gs.getCurrentMana()).toBe(100);
    });

    it('getAllSubstrateMaxManaBonuses returns a copy', () => {
      gs.setSubstrateMaxManaBonus('jta', 10);
      const copy = gs.getAllSubstrateMaxManaBonuses();
      copy.set('jta', 999);
      expect(gs.getSubstrateMaxManaBonus('jta')).toBe(10);
    });
  });

  describe('includePerItemMaxMana toggle', () => {
    it('defaults to true (preserves prior behavior)', () => {
      expect(gs.getIncludePerItemMaxMana()).toBe(true);
    });

    it('disabling removes the AP-item contribution', () => {
      gs.recalculateMaxMana({ inventory: { a: 3 } }); // 100 + 30 = 130
      expect(gs.getMaxMana()).toBe(130);
      gs.setIncludePerItemMaxMana(false);
      expect(gs.getMaxMana()).toBe(100);
    });

    it('re-enabling re-adds the contribution using cached itemCount', () => {
      gs.recalculateMaxMana({ inventory: { a: 5 } }); // cached count = 5
      gs.setIncludePerItemMaxMana(false);
      expect(gs.getMaxMana()).toBe(100);
      gs.setIncludePerItemMaxMana(true);
      expect(gs.getMaxMana()).toBe(150);
    });

    it('still respects substrate bonuses when disabled', () => {
      gs.recalculateMaxMana({ inventory: { a: 3 } });
      gs.setSubstrateMaxManaBonus('jta', 50);
      gs.setIncludePerItemMaxMana(false);
      // 100 + 50 (no item term) = 150
      expect(gs.getMaxMana()).toBe(150);
    });

    it('emits gameState:manaChanged on toggle', () => {
      bus.events.length = 0;
      gs.setIncludePerItemMaxMana(false);
      expect(bus.events.find((e) => e.name === 'gameState:manaChanged')).toBeDefined();
    });
  });

  describe('reset() clears the new max-mana state', () => {
    it('clears substrate bonuses, itemCount, and loopResetCount; preserves the toggle', () => {
      gs.setStartRegions(['Menu']);
      gs.recalculateMaxMana({ inventory: { a: 2 } });
      gs.setSubstrateMaxManaBonus('jta', 50);
      gs.triggerLoopReset();
      gs.triggerLoopReset();
      gs.setIncludePerItemMaxMana(false);
      expect(gs.getMaxMana()).toBe(150); // 100 + 50, item term off

      gs.reset();

      expect(gs.getAllSubstrateMaxManaBonuses().size).toBe(0);
      expect(gs.getLoopResetCount()).toBe(0);
      // toggle is a setting, preserved across reset
      expect(gs.getIncludePerItemMaxMana()).toBe(false);
      // maxMana back to default; no item term applied (toggle off)
      expect(gs.getMaxMana()).toBe(100);
      expect(gs.getCurrentMana()).toBe(100);
    });
  });

  describe('serialize / deserialize round-trip of new max-mana state', () => {
    it('round-trips substrate bonuses, itemCount, toggle, and loopResetCount', () => {
      gs.setStartRegions(['Menu']);
      gs.recalculateMaxMana({ inventory: { a: 3 } });
      gs.setSubstrateMaxManaBonus('jta', 40);
      gs.setSubstrateMaxManaBonus('maze', 10);
      gs.setIncludePerItemMaxMana(false);
      gs.triggerLoopReset();
      gs.triggerLoopReset();

      const data = gs.serialize();
      const gs2 = new GameState(makeBus());
      gs2.deserialize(data);

      expect(gs2.getSubstrateMaxManaBonus('jta')).toBe(40);
      expect(gs2.getSubstrateMaxManaBonus('maze')).toBe(10);
      expect(gs2.getIncludePerItemMaxMana()).toBe(false);
      expect(gs2.getLoopResetCount()).toBe(2);
      // Recompute matches: 100 + 50 (bonuses) + 0 (toggle off) = 150
      gs2._recomputeMaxMana();
      expect(gs2.getMaxMana()).toBe(150);
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

  describe('legacy bestPaths field on deserialize is silently ignored', () => {
    it('does not throw and does not expose bestPaths on the instance', () => {
      gs.setStartRegions(['Menu']);
      const legacy = {
        startRegions: ['Menu'],
        bestPaths: [['Forest|in|out', {
          actions: [{ type: 'move', dir: 'E' }],
          totalCost: 5,
          itemsPickedUp: [],
          locationsChecked: [],
        }]],
      };
      expect(() => gs.deserialize(legacy)).not.toThrow();
      expect(gs.bestPaths).toBeUndefined();
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
      bus.events.length = 0;

      gs.clearPath();

      expect(gs.getPath()).toEqual([]);
      expect(gs.getRegionCounts().size).toBe(0);
      // Player position and loop-mode resources untouched.
      expect(gs.getCurrentRegion()).toBe('region_2_3');
      expect(gs.getCurrentMana()).toBe(70);
      expect(gs.getRegionXP('region_0_0').xp).toBeGreaterThan(0);
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
