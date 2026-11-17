/**
 * upstreamGoal.js — the add-on slot's goal: derivation, marking, the deliberate-click test and
 * completion over the server's items (design-upstream-goal-report § 2). Every helper fails closed.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  deriveUpstreamGoal,
  markGoalEvent,
  deliberateRefusal,
  completesWithGoal,
  goalHoldMessage,
  GOAL_HOLD,
  GOAL_EVENT_KIND,
  DELIBERATE_GOAL_ORIGINATORS,
} from './upstreamGoal.js';
import { overlayServerData } from './localRulesOverlay.js';
import { autoCollectsEvent } from '../../stateManager/core/eventKinds.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const preset = (dir) => {
  const base = join(REPO, 'frontend', 'presets', dir);
  const seed = readdirSync(base).filter((s) => s.startsWith('AP_')).sort()[0];
  const file = readdirSync(join(base, seed)).find((f) => f.endsWith('_rules.json'));
  return JSON.parse(readFileSync(join(base, seed, file), 'utf8'));
};

/** A minimal one-slot doc: `locations` = [{name, id, item}] in region R. */
const tiny = (rule, locations, player = '1') => ({
  game_info: { [player]: { completion_condition: rule } },
  regions: { [player]: { R: { locations: locations.map((l) => ({ ...l, item: { name: l.item, player: Number(player) } })) } } },
});
const HAS = (name) => ({ rule: 'Has', args: { item_name: name } });

describe('deriveUpstreamGoal — one goal event at one location, decidable', () => {
  it('APQuest (an upstream world): Victory @ Final Boss Defeated', () => {
    const d = deriveUpstreamGoal(preset('apquest'), '1');
    expect(d.goal).toMatchObject({ location: 'Final Boss Defeated', region: 'Final Boss Room', item: 'Victory' });
  });

  it('ALttP: the brief called it multi-event; it is one event, Triforce @ Ganon', () => {
    expect(deriveUpstreamGoal(preset('alttp'), '1').goal).toMatchObject({ location: 'Ganon', item: 'Triforce' });
  });

  it('slot >= 2: derives on the overlay copy, keyed by the connected slot', () => {
    const src = preset('apquest');
    const scouts = Object.values(src.regions['1']).flatMap((r) => r.locations)
      .filter((l) => l.id !== null && l.id !== undefined)
      .map((l) => ({ locationId: l.id, itemName: l.item.name, player: 3, progression: true }));
    const doc = overlayServerData(src, '1', { slot: 3, names: { 3: 'P3' }, scouts });
    expect(deriveUpstreamGoal(doc, '3').goal).toMatchObject({ location: 'Final Boss Defeated', item: 'Victory' });
    expect(deriveUpstreamGoal(doc, '1').reason).toBeDefined();
  });

  it.each([
    ['sc2', /names no item/], // state_method can_reach_location: no single location
    ['checksfinder', /names no item/], // state_method has_all_counts
  ])('%s: not derived (%s)', (dir, why) => {
    expect(deriveUpstreamGoal(preset(dir), '1').reason).toMatch(why);
  });

  it.each([
    ['no rule', tiny(undefined, []), /no goal rule/],
    ['constant', tiny({ type: 'constant', value: true }, []), /constant/],
    ['the goal item is at an ID location', tiny(HAS('V'), [{ name: 'L', id: 5, item: 'V' }]), /not an event/],
    ['the goal item is at an ID AND an ID-less location', tiny(HAS('V'), [
      { name: 'L', id: 5, item: 'V' }, { name: 'E', id: null, item: 'V' }]), /not an event/],
    ['two goal events', tiny({ rule: 'HasAll', args: { item_names: ['A', 'B'] } }, [
      { name: 'EA', id: null, item: 'A' }, { name: 'EB', id: null, item: 'B' }]), /needs 2 events/],
    ['one event at two locations', tiny(HAS('V'), [
      { name: 'E1', id: null, item: 'V' }, { name: 'E2', id: null, item: 'V' }]), /2 locations/],
    ['undecidable (a helper beside the event)', tiny({ type: 'and', conditions: [
      { type: 'item_check', item: 'V' }, { type: 'helper', name: 'can_win' }] }, [{ name: 'E', id: null, item: 'V' }]), /cannot be decided/],
    ['true without the goal (Or)', tiny({ rule: 'HasAny', args: { item_names: ['V', 'X'] } }, [
      { name: 'E', id: null, item: 'V' }, { name: 'L', id: 9, item: 'X' }]), /cannot be decided/],
  ])('%s: not derived', (_label, doc, why) => {
    const d = deriveUpstreamGoal(doc, '1');
    expect(d.goal).toBeUndefined();
    expect(d.reason).toMatch(why);
  });

  it('another player\'s item of the same name does not count', () => {
    const doc = tiny(HAS('V'), [{ name: 'E', id: null, item: 'V' }]);
    doc.regions['1'].R.locations[0].item.player = 2;
    expect(deriveUpstreamGoal(doc, '1').reason).toMatch(/not an event/);
  });
});

describe('markGoalEvent + the state manager policy', () => {
  it('marks only the goal location, and that kind is never auto-collected', () => {
    const doc = preset('apquest');
    const { goal } = deriveUpstreamGoal(doc, '1');
    expect(markGoalEvent(doc, '1', goal)).toBe(true);
    const all = Object.values(doc.regions['1']).flatMap((r) => r.locations);
    expect(all.filter((l) => l.event_kind === GOAL_EVENT_KIND).map((l) => l.name)).toEqual(['Final Boss Defeated']);
    expect(autoCollectsEvent({ event_kind: GOAL_EVENT_KIND })).toBe(false);
  });

  it('refuses a location that has an ID or is missing', () => {
    const doc = tiny(HAS('V'), [{ name: 'L', id: 5, item: 'V' }]);
    expect(markGoalEvent(doc, '1', { location: 'L', region: 'R' })).toBe(false);
    expect(markGoalEvent(doc, '1', { location: 'Nope', region: 'R' })).toBe(false);
    expect(doc.regions['1'].R.locations[0].event_kind).toBeUndefined();
  });

  it('the REAL state manager: the goal stays unchecked and reachable; without the kind it is auto-collected', async () => {
    const { StateManager } = await import('../../stateManager/stateManager.js');
    const { evaluateRule } = await import('../../shared/ruleEngine.js');
    const { workerLoggerInstance } = await import('../../../app/core/universalLogger.js');
    const load = (doc) => {
      const sm = new StateManager(evaluateRule, workerLoggerInstance);
      sm.loadFromJSON(structuredClone(doc), '1');
      sm.addItemToInventory('Sword');
      sm.addItemToInventory('Shield');
      sm.addItemToInventory('Key'); // Top Left Room: its button event opens the boss room
      sm.computeReachableRegions();
      return sm;
    };
    const plain = preset('apquest');
    expect(load(plain).checkedLocations.has('Final Boss Defeated')).toBe(true); // control: today's auto-collect

    const marked = preset('apquest');
    markGoalEvent(marked, '1', deriveUpstreamGoal(marked, '1').goal);
    const sm = load(marked);
    expect(sm.checkedLocations.has('Final Boss Defeated')).toBe(false);
    expect(sm.inventory.Victory ?? 0).toBe(0);
    expect(sm.checkedLocations.has('Top Left Room Button')).toBe(true); // other (logic) events still auto-collect
    expect(sm.isLocationAccessible(sm.locations.get('Final Boss Defeated'))).toBe(true);
  });
});

describe('deliberateRefusal — fail-closed allowlist', () => {
  const CARD = { locationName: 'G', originator: 'LocationCardClick', originalDOMEvent: true };
  const NODE = { locationName: 'G', originator: 'RegionGraphCheck', originalDOMEvent: true };

  it('the two allowlisted single clicks pass outside Loop mode', () => {
    expect(DELIBERATE_GOAL_ORIGINATORS).toEqual(['LocationCardClick', 'RegionGraphCheck']);
    expect(deliberateRefusal('user:locationCheck', CARD, false)).toBeNull();
    expect(deliberateRefusal('user:locationCheck', NODE, false)).toBeNull();
  });

  it.each([
    ['Region Graph bulk check', 'user:locationCheck', { originator: 'RegionGraphBulkCheck', originalDOMEvent: true }],
    ['Timer', 'user:locationCheck', { originator: 'TimerModuleAuto', fromBot: true }],
    ['Playback Bot', 'user:locationCheck', { originator: 'PlaybackBot', fromBot: true }],
    ['a card click marked fromBot', 'user:locationCheck', { ...CARD, fromBot: true }],
    ['Loop queue replay', 'user:locationCheck', { fromLoop: true }],
    ['a card click replayed by Loop', 'user:locationCheck', { ...CARD, fromLoop: true }],
    ['a game report', 'user:locationCheck', { ...CARD, reportedByGame: true }],
    ['a system: event', 'system:locationCheck', CARD],
    ['no originator', 'user:locationCheck', { locationName: 'G' }],
    ['an unknown originator', 'user:locationCheck', { originator: 'SomethingNew' }],
  ])('%s → held', (_label, eventName, data) => {
    expect(deliberateRefusal(eventName, data, false)).toBe(GOAL_HOLD.NOT_A_CLICK);
  });

  it.each([[true], [undefined], [null]])('Loop mode %s → held (only a definite "off" passes)', (loop) => {
    expect(deliberateRefusal('user:locationCheck', CARD, loop)).toBe(GOAL_HOLD.LOOP_MODE);
  });

  it('every hold reason has a message', () => {
    for (const reason of Object.values(GOAL_HOLD)) expect(goalHoldMessage('G', reason)).toMatch(/Not checked: "G"/);
  });
});

describe('completesWithGoal — over the SERVER\'s items only', () => {
  const goalOf = (rule) => ({ item: 'V', rule, progression: null });

  it('Has V: completes with no server items', () => {
    expect(completesWithGoal(goalOf(HAS('V')), new Map(), '1')).toBe(true);
  });

  it('V and a server item: needs the server to have delivered it', () => {
    const rule = { rule: 'HasAll', args: { item_names: ['V', 'Sword'] } };
    expect(completesWithGoal(goalOf(rule), new Map(), '1')).toBe(false);
    expect(completesWithGoal(goalOf(rule), new Map([['Sword', 1]]), '1')).toBe(true);
  });

  it('already true without the goal item → not this path\'s report', () => {
    expect(completesWithGoal(goalOf(HAS('V')), new Map([['V', 1]]), '1')).toBe(false);
  });

  it('undecidable → no', () => {
    expect(completesWithGoal(goalOf({ type: 'helper', name: 'x' }), new Map(), '1')).toBe(false);
  });

  it('does not change the caller\'s map', () => {
    const items = new Map([['Sword', 1]]);
    completesWithGoal(goalOf(HAS('V')), items, '1');
    expect([...items]).toEqual([['Sword', 1]]);
  });
});
