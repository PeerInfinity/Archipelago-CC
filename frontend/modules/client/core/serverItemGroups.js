// client/core/serverItemGroups.js
//
// The server's item groups for the connected slot's game. A server answers a
// `Get` of the read-only data storage key `_read_item_name_groups_<game>` with
// that game's `item_name_groups` ({group: [item names]}), so on connect they
// are the record, not the rules file's copy (sdc-server-item-groups; ⚖ Robert
// 2026-11-15, rules-feature-inventory Q1: "Do it next").
//
// Measured (sdc-rules-feature-inventory, 2026-11-15, upstream AP 0.6.9, 8
// slots in 2 rooms): the key equals `item_groups[p]` for APQuest, Baking,
// Baking WorldGen and DepGraph, and every item's `groups` is a subset of it,
// plus "Event", which the server has no group for (an event item has no id).
//
// Location groups (`_read_location_name_groups_<game>`) are not fetched:
// rules.json has no field for them and the frontend reads none.
//
// Applied in the client's server build (messageHandler._completeServerBuild)
// BEFORE the one loadRules — static data is never patched after load.

/** @returns {string} The data storage key holding `game`'s item groups. */
export function itemNameGroupsKey(game) {
  return `_read_item_name_groups_${game}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The server's answer for the groups key, as group -> Set of item names, or
 * null when it is missing (an old server, a game without the key) or not the
 * `{group: [names]}` shape.
 *
 * @param {*} value - Retrieved.keys[itemNameGroupsKey(game)]
 * @returns {Map<string, Set<string>>|null}
 */
export function readServerItemGroups(value) {
  if (!isPlainObject(value)) return null;
  const groups = new Map();
  for (const [name, members] of Object.entries(value)) {
    if (!Array.isArray(members)) return null;
    groups.set(name, new Set(members.filter((m) => typeof m === 'string')));
  }
  return groups;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function listSome(names, max = 5) {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown}, … (${names.length} in all)` : shown;
}

/**
 * Sets `doc`'s item groups for `player` from the server's, in place:
 * - `item_groups[player]` = the server's group names, plus any of the file's
 *   names still carried by an item the server has no say over (an event's
 *   "Event");
 * - each item of the slot's own game gets the groups the server lists it in;
 *   an event item (`event: true`, no id) and another game's item placed here
 *   keep the file's.
 * Where the file already agrees (as sets), its arrays are left as they are.
 *
 * @param {Object} doc - A one-player rules.json, keyed by `player`
 * @param {string|number} player
 * @param {Map<string, Set<string>>} serverGroups - readServerItemGroups()
 * @param {Object} [options]
 * @param {Iterable<string>} [options.ownItemNames] - The game's DataPackage item
 *   names. Without it, an item is the game's own when a server group lists it.
 * @returns {{differences: string[]}} What the file had that the server does not,
 *   and the reverse; empty when they agree.
 */
export function applyServerItemGroups(doc, player, serverGroups, { ownItemNames } = {}) {
  const p = String(player);
  const membership = new Map(); // item name -> Set of server groups
  for (const [group, members] of serverGroups) {
    for (const name of members) {
      if (!membership.has(name)) membership.set(name, new Set());
      membership.get(name).add(group);
    }
  }
  const own = ownItemNames ? new Set(ownItemNames) : null;
  const isOwn = (name) => (own ? own.has(name) : membership.has(name));

  const changedItems = [];
  const keptGroupNames = new Set();
  const items = doc?.items?.[p];
  if (isPlainObject(items)) {
    for (const item of Object.values(items)) {
      if (!isPlainObject(item) || typeof item.name !== 'string') continue;
      const fileGroups = Array.isArray(item.groups) ? item.groups : [];
      if (item.event === true || !isOwn(item.name)) {
        for (const g of fileGroups) keptGroupNames.add(g);
        continue;
      }
      const serverSet = membership.get(item.name) ?? new Set();
      if (sameSet(new Set(fileGroups), serverSet)) continue;
      item.groups = [...serverSet].sort();
      changedItems.push(item.name);
    }
  }

  const fileNames = Array.isArray(doc?.item_groups?.[p]) ? doc.item_groups[p] : [];
  const serverNames = [...serverGroups.keys()];
  const wanted = new Set(serverNames);
  for (const g of fileNames) if (keptGroupNames.has(g)) wanted.add(g);
  const fileSet = new Set(fileNames);
  if (!sameSet(fileSet, wanted)) {
    if (!isPlainObject(doc.item_groups)) doc.item_groups = {};
    doc.item_groups[p] = [...wanted].sort();
  }

  const differences = [];
  const onlyFile = fileNames.filter((g) => !wanted.has(g));
  const onlyServer = serverNames.filter((g) => !fileSet.has(g));
  if (onlyFile.length) differences.push(`group(s) only in the rules: ${listSome(onlyFile)}`);
  if (onlyServer.length) differences.push(`group(s) only on the server: ${listSome(onlyServer)}`);
  if (changedItems.length) differences.push(`${changedItems.length} item(s) in other groups: ${listSome(changedItems)}`);
  return { differences };
}
