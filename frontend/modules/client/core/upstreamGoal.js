// client/core/upstreamGoal.js
//
// Goal reporting for a slot whose rules came from the host's Upstream Rules Add-on
// (worlds/upstream_rules_addon/; `source: "upstream_rules_addon"` on the envelope),
// or from a committed preset matched to the room by its exact seed, for a world that
// doesn't report its goal another way (reportsOwnGoal; sdc-preset-goal-report).
// Design: the server-data arc's design-upstream-goal-report.
//
// An upstream world's goal is an EVENT: an ID-less location holding an ID-less goal
// item. The server can never deliver that item, so goalMet (goalCheck.js) can't fire,
// and we can't change upstream Python. So for these slots only, the CLIENT decides,
// and it decides narrowly:
//   - the slot's one goal location is derived from the document (no game names); it
//     is marked `event_kind: 'goal'`, which the state manager never auto-collects
//     (stateManager/core/eventKinds.js), so reaching it finishes nothing: it stays a
//     location to check, like our own worlds' Victory location;
//   - a check of it takes the ordinary path, whoever sends it (a click, the Region
//     Graph bulk check, the Timer, a bot, the Loop queue; ⚖ Robert 2026-11-17: no
//     send restrictions this mode doesn't have elsewhere). The goal is reported when
//     THIS connection saw it go from unchecked to checked and completion_condition
//     holds over the SERVER's delivered items plus that one goal item, and not
//     without it (completesWithGoal).
//
// ⛔ A goal cannot be undone (under `auto` the server collects and releases at once).
// Every test here fails closed: a missed report is acceptable, a false one is not.

import { evaluateRuleWithInventory } from '../../shared/procgen/library.js';
import { reportsGoalByServerItem } from './goalCheck.js';

/**
 * Whether `player`'s world already reports its own goal through another path, so a
 * preset of it gets no upstream goal record (sdc-preset-goal-report): one of our
 * generated worlds or a world declaring `reports_goal_by_server_item` (goalCheck.js,
 * the server-delivered goal item), or a proof/graph world (MetaMath, DepGraph) whose
 * proof modules publish `user:goalReached` when the proof completes. The proof marker
 * is proofShared/proofModuleHelpers.js `hasStructureData`, inlined here because that
 * module imports the state manager.
 */
export function reportsOwnGoal(doc, player) {
  const p = String(player);
  if (reportsGoalByServerItem(doc, p)) return true;
  const slotData = doc?.world?.[p]?.slot_data;
  return !!(slotData?.proof_structure || slotData?.graph_structure);
}

/** The event_kind the client puts on an add-on slot's derived goal location. */
export const GOAL_EVENT_KIND = 'goal';

const ITEM_RULES = new Set(['Has', 'HasAll', 'HasAny', 'HasAllCounts']);

/** Item names a rule names (Rule Builder and the exporter's item_check/count_check shapes). */
export function itemNamesInRule(rule, out = new Set()) {
  if (Array.isArray(rule)) {
    for (const value of rule) itemNamesInRule(value, out);
  } else if (rule !== null && typeof rule === 'object') {
    const type = rule.type ?? rule.rule;
    if ((type === 'item_check' || type === 'count_check') && typeof rule.item === 'string') out.add(rule.item);
    if (ITEM_RULES.has(type)) {
      const args = rule.args || {};
      if (typeof args.item_name === 'string') out.add(args.item_name);
      for (const name of Array.isArray(args.item_names) ? args.item_names : []) out.add(name);
      if (args.item_counts && typeof args.item_counts === 'object') for (const name of Object.keys(args.item_counts)) out.add(name);
    }
    for (const value of Object.values(rule)) itemNamesInRule(value, out);
  }
  return out;
}

/**
 * The slot's single goal location, derived from the document alone:
 * completion_condition names exactly ONE item of this slot that sits only at ID-less
 * locations, at exactly ONE location, and the rule is decidable on it: false with
 * every other named item (as if the server had delivered plenty) and no goal item,
 * true once the goal item is added.
 *
 * @returns {{goal: {location: string, region: string, item: string, rule: object, progression: object|null}}|{reason: string}}
 */
export function deriveUpstreamGoal(doc, player) {
  const p = String(player);
  const rule = doc?.game_info?.[p]?.completion_condition;
  if (!rule || typeof rule !== 'object') return { reason: 'the slot has no goal rule' };
  if (rule.type === 'constant') return { reason: 'its goal rule is a constant' };
  const named = itemNamesInRule(rule);
  if (named.size === 0) return { reason: 'its goal rule names no item' };
  const idless = new Map(); // item name -> [{location, region}]
  const withId = new Set();
  for (const [regionName, region] of Object.entries(doc?.regions?.[p] || {})) {
    for (const location of region?.locations || []) {
      const item = location?.item;
      if (!item?.name || !named.has(item.name) || String(item.player) !== p) continue;
      if (location.id === null || location.id === undefined) {
        if (!idless.has(item.name)) idless.set(item.name, []);
        idless.get(item.name).push({ location: location.name, region: regionName });
      } else {
        withId.add(item.name);
      }
    }
  }
  const events = [...named].filter((name) => idless.has(name) && !withId.has(name));
  if (events.length === 0) return { reason: 'its goal is not an event at a location' };
  if (events.length > 1) return { reason: `its goal needs ${events.length} events` };
  const item = events[0];
  const places = idless.get(item);
  if (places.length !== 1) return { reason: `its goal event "${item}" sits at ${places.length} locations` };
  const progression = doc?.progression_mapping?.[p] ?? null;
  const others = new Map([...named].filter((name) => name !== item).map((name) => [name, 999]));
  const evaluate = (items) => evaluateRuleWithInventory(rule, items, p, null, progression);
  const without = evaluate(others);
  const withGoal = evaluate(new Map([...others, [item, 1]]));
  if (without !== false || withGoal !== true) return { reason: 'its goal rule cannot be decided from items alone' };
  return { goal: { location: places[0].location, region: places[0].region, item, rule, progression } };
}

/** Marks the goal location `event_kind: 'goal'` in `doc` (in place). Returns whether it found it. */
export function markGoalEvent(doc, player, goal) {
  const region = doc?.regions?.[String(player)]?.[goal.region];
  const location = (region?.locations || []).find((l) => l?.name === goal.location);
  if (!location || (location.id !== null && location.id !== undefined)) return false;
  location.event_kind = GOAL_EVENT_KIND;
  return true;
}

/**
 * Whether the goal item is what completes the slot over the server's record: the rule
 * is false over the server-delivered items alone and true with the goal item added.
 *
 * @param {object} goal - from deriveUpstreamGoal
 * @param {Map<string, number>} serverItems - item name -> count, delivered on this connection
 * @param {string|number} player
 */
export function completesWithGoal(goal, serverItems, player) {
  const p = String(player);
  const evaluate = (items) => evaluateRuleWithInventory(goal.rule, items, p, null, goal.progression);
  const items = new Map(serverItems);
  if (evaluate(items) !== false) return false;
  items.set(goal.item, (items.get(goal.item) ?? 0) + 1);
  return evaluate(items) === true;
}
