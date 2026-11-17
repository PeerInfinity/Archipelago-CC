// client/core/upstreamGoal.js
//
// Goal reporting for a slot whose rules came from the host's Upstream Rules Add-on
// (worlds/upstream_rules_addon/; `source: "upstream_rules_addon"` on the envelope).
// Design: the server-data arc's design-upstream-goal-report.
//
// An upstream world's goal is an EVENT: an ID-less location holding an ID-less goal
// item. The server can never deliver that item, so goalMet (goalCheck.js) can't fire,
// and we can't change upstream Python. So for these slots only, the CLIENT decides,
// and it decides narrowly:
//   - the slot's one goal location is derived from the document (no game names); it
//     is marked `event_kind: 'goal'`, which the state manager never auto-collects
//     (stateManager/core/eventKinds.js), so reaching it finishes nothing;
//   - the goal is reported only after a DELIBERATE single click on that location
//     (deliberateRefusal), the out-of-logic gate passing, the state manager recording
//     the check, and completion_condition holding over the SERVER's delivered items
//     plus that one goal item, and not without it (completesWithGoal).
//
// ⛔ A goal cannot be undone (under `auto` the server collects and releases at once).
// Every test here fails closed: a missed report is acceptable, a false one is not.

import { evaluateRuleWithInventory } from '../../shared/procgen/library.js';

/** The event_kind the client puts on an add-on slot's derived goal location. */
export const GOAL_EVENT_KIND = 'goal';

/** The only originators whose click may finish the game: one location, chosen by the player. */
export const DELIBERATE_GOAL_ORIGINATORS = Object.freeze(['LocationCardClick', 'RegionGraphCheck']);

/** Why a check of the goal location was held back (client:locationCheckRefused reasons). */
export const GOAL_HOLD = Object.freeze({
  NOT_A_CLICK: 'goal_not_a_click',
  LOOP_MODE: 'goal_loop_mode',
});

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
 * null when this check may finish the game; else a GOAL_HOLD reason.
 * Fail-closed: only a `user:` check from an allowlisted originator, carrying none of
 * the bot / Loop-queue / game-report marks, outside Loop mode.
 */
export function deliberateRefusal(eventName, eventData, loopModeActive) {
  if (eventName !== 'user:locationCheck') return GOAL_HOLD.NOT_A_CLICK;
  if (!DELIBERATE_GOAL_ORIGINATORS.includes(eventData?.originator)) return GOAL_HOLD.NOT_A_CLICK;
  if (eventData?.fromBot === true || eventData?.fromLoop === true || eventData?.reportedByGame === true) {
    return GOAL_HOLD.NOT_A_CLICK;
  }
  if (loopModeActive !== false) return GOAL_HOLD.LOOP_MODE;
  return null;
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

/** The console line for a held-back goal check. */
export function goalHoldMessage(locationName, reason) {
  if (reason === GOAL_HOLD.LOOP_MODE) {
    return `Not checked: "${locationName}" finishes the game, and Loop mode is on. Turn Loop mode off and click it to finish.`;
  }
  return `Not checked: "${locationName}" finishes the game, so it is only sent when you click it yourself (not a bulk check, bot, timer, replay or game report).`;
}
