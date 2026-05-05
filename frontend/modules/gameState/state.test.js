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
    it('refills mana, clears path, resets manaDebt', () => {
      gs.setStartRegions(['Menu']);
      gs.deductMana(80);
      gs.manaDebt = 5;
      gs.path = [
        { type: 'regionMove', destinationRegion: 'A', sourceRegion: 'Menu', instanceNumber: 1 },
      ];
      gs.regionInstanceCounts.set('A', 1);

      bus.events.length = 0;
      gs.triggerLoopReset();

      expect(gs.getCurrentMana()).toBe(100);
      expect(gs.getManaDebt()).toBe(0);
      expect(gs.getPath()).toEqual([]);
      expect(gs.regionInstanceCounts.size).toBe(0);
    });

    it('emits gameState:loopReset, gameState:manaChanged, gameState:pathUpdated', () => {
      gs.setStartRegions(['Menu']);
      bus.events.length = 0;
      gs.triggerLoopReset();
      const names = bus.events.map((e) => e.name);
      expect(names).toContain('gameState:loopReset');
      expect(names).toContain('gameState:manaChanged');
      expect(names).toContain('gameState:pathUpdated');
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
