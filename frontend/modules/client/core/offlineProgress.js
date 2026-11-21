// client/core/offlineProgress.js
//
// Offline progress at connect (sdc-offline-progress-op1; design
// NewDocs/plans/server-data/design-offline-progress.md, Robert's answers 2026-11-21).
//
// Offline, a check reaches only the state manager. At connect the client loses it twice: the
// connect flow's own rules reload, then the `Connected` reset. So a RECORD is captured at
// `RoomInfo` (before both): the loaded document's identity and the ID-bearing locations it
// had checked, in the order they were checked. When the room is that document's own (exact
// seed + slot + game, + the player's name when the document names one), the player is asked
// once per connect: Send / Not now / Discard. Send pushes the checks through the ordinary
// check path (the out-of-logic gate included) in PASSES: what is in logic now, then again on
// each ReceivedItems (our own items come back), never one that is out of logic.
// A mismatched seed, another player's document and a seedless document are never offered.
// Nothing here persists: the record lives in this page session only.
//
// Pure functions only: messageHandler.js holds the state and does the sending.

import { reportsGoalByServerItem } from './goalCheck.js';
import { deriveUpstreamGoal, itemNamesInRule } from './upstreamGoal.js';
import { evaluateRuleWithInventory } from '../../shared/procgen/library.js';

/** The originator a pushed check carries. */
export const OFFLINE_ORIGINATOR = 'OfflineProgress';

/** The player's answers to the offer. */
export const OFFLINE_CHOICE = Object.freeze({ SEND: 'send', LATER: 'later', DISCARD: 'discard' });

const present = (v) => v !== undefined && v !== null && v !== '';

/** A server/rules location id that names a real location (0 and null are "none", as the send filter treats them). */
const realId = (id) => present(id) && Number(id) !== 0 && !Number.isNaN(Number(id));

/** Identity key of a record (one record per document identity). */
export function recordKey(record) {
  return `${record.seedName}|${record.slot}|${record.game}`;
}

/**
 * The record for the loaded document, or null when there is nothing to offer: a seedless
 * document (it describes no room), no player, no game, or no ID-bearing location checked.
 *
 * @param {object|null} doc - the loaded rules document (getLastRawJsonData().rawJsonData)
 * @param {string|number|null} player - the loaded player (selectedPlayerInfo.playerId)
 * @param {Iterable<string>} checkedNames - the state manager's checked locations, in check order
 * @param {Set<string>} [gameReported] - names the GAME reported while offline (reportedByGame / system:)
 */
export function captureRecord(doc, player, checkedNames, gameReported = new Set()) {
  if (!doc || !present(player) || !present(doc.seed_name)) return null;
  const p = String(player);
  const game = doc.world?.[p]?.game;
  if (!game) return null;
  const ids = new Map();
  for (const region of Object.values(doc.regions?.[p] || {})) {
    for (const location of region?.locations || []) {
      if (location?.name) ids.set(location.name, location.id);
    }
  }
  const goalLocation = deriveUpstreamGoal(doc, p).goal?.location ?? null;
  const names = [];
  for (const name of checkedNames || []) {
    if (names.includes(name)) continue;
    if (realId(ids.get(name)) || name === goalLocation) names.push(name);
  }
  if (names.length === 0) return null;
  return {
    seedName: String(doc.seed_name),
    slot: p,
    game,
    playerName: doc.player_names?.[p] ?? null,
    goalLocation,
    names,
    reportedByGame: new Set(names.filter((n) => gameReported.has(n))),
    decision: null,
  };
}

/** `fresh` folded into `kept` (same identity): kept names first, in order, then the new ones; kept's decision stays. */
export function mergeRecord(kept, fresh) {
  if (!kept) return fresh;
  if (!fresh) return kept;
  const names = [...kept.names];
  for (const n of fresh.names) if (!names.includes(n)) names.push(n);
  return {
    ...kept,
    playerName: kept.playerName ?? fresh.playerName,
    goalLocation: kept.goalLocation ?? fresh.goalLocation,
    names,
    reportedByGame: new Set([...kept.reportedByGame, ...fresh.reportedByGame]),
  };
}

/**
 * Whether the record is this connection's own: the room's seed, the connected slot, that
 * slot's game, and (when both name one) the same player name. Anything else is never offered.
 *
 * @param {object} record
 * @param {{seedName: string|null, slot: number|string, slotInfo: object}} room
 */
export function matchesRoom(record, { seedName, slot, slotInfo }) {
  if (!record || !present(seedName) || !present(record.seedName)) return false;
  if (String(seedName) !== record.seedName) return false;
  if (!present(slot) || String(slot) !== record.slot) return false;
  const info = slotInfo?.[String(slot)];
  if (!info?.game || info.game !== record.game) return false;
  if (record.playerName && info.name && info.name !== record.playerName) return false;
  return true;
}

/**
 * Sorts the record's names against the room.
 *
 * @param {object} record
 * @param {object} room
 * @param {Map<string, number>} room.roomIds - Connected's name -> server id (missing + checked)
 * @param {Set<number>} room.checkedIds - ids the server has checked (Connected + RoomUpdates)
 * @param {boolean} room.goalReportable - the record's goal location is this connection's goal-kind one
 * @returns {{pending: Array<{name: string, id: number|null, reportedByGame: boolean, goal: boolean}>,
 *   done: string[], unknown: string[], idless: string[]}}
 *   pending: still to send, in check order; done: already on the server; unknown: this room has no
 *   such location (the server would ignore it); idless: a goal the client does not report here.
 */
export function classifyRecord(record, { roomIds, checkedIds, goalReportable = false }) {
  const out = { pending: [], done: [], unknown: [], idless: [] };
  for (const name of record?.names || []) {
    const reportedByGame = record.reportedByGame?.has(name) === true;
    if (roomIds?.has(name)) {
      const id = roomIds.get(name);
      if (checkedIds?.has(id)) out.done.push(name);
      else out.pending.push({ name, id, reportedByGame, goal: false });
    } else if (name === record.goalLocation) {
      if (goalReportable) out.pending.push({ name, id: null, reportedByGame, goal: true });
      else out.idless.push(name);
    } else {
      out.unknown.push(name);
    }
  }
  return out;
}

/**
 * One pass: the pending checks to send now, in check order with the goal last. A check is
 * sent when the game reported it (exempt from the gate, as while connected) or the state
 * manager says it is reachable; never one already sent on this connection.
 *
 * @param {Array} pending - classifyRecord().pending
 * @param {{reachability: object, inFlight: Set<string>}} state
 */
export function pickPass(pending, { reachability, inFlight }) {
  const ready = (e) =>
    !inFlight?.has(e.name) &&
    (e.reportedByGame || reachability?.[e.name] === 'reachable' || reachability?.[e.name] === 'checked');
  const picked = (pending || []).filter(ready);
  return [...picked.filter((e) => !e.goal), ...picked.filter((e) => e.goal)];
}

/**
 * Whether sending `pending` finishes the slot's game, and where:
 * - the add-on / exact-seed goal (a goal-kind entry) is in it; or
 * - a world whose goal this client reports by server item (goalMet): its completion rule is
 *   not met by the items the server has delivered, and is met with the own items at the
 *   pending locations added.
 *
 * @returns {{locations: string[]}|null}
 */
export function goalInPending(doc, slot, pending, serverItems = new Map()) {
  const goalEntries = (pending || []).filter((e) => e.goal);
  if (goalEntries.length > 0) return { locations: goalEntries.map((e) => e.name) };
  const p = String(slot);
  if (!doc || !reportsGoalByServerItem(doc, p)) return null;
  const rule = doc.game_info?.[p]?.completion_condition;
  if (!rule) return null;
  const itemAt = new Map();
  for (const region of Object.values(doc.regions?.[p] || {})) {
    for (const location of region?.locations || []) {
      const item = location?.item;
      if (location?.name && item?.name && String(item.player) === p) itemAt.set(location.name, item.name);
    }
  }
  const progression = doc.progression_mapping?.[p] ?? null;
  const evaluate = (items) => evaluateRuleWithInventory(rule, items, p, null, progression);
  if (evaluate(new Map(serverItems)) === true) return null;
  const withPending = new Map(serverItems);
  for (const e of pending || []) {
    const item = itemAt.get(e.name);
    if (item) withPending.set(item, (withPending.get(item) ?? 0) + 1);
  }
  if (evaluate(withPending) !== true) return null;
  const named = itemNamesInRule(rule);
  return { locations: (pending || []).filter((e) => named.has(itemAt.get(e.name))).map((e) => e.name) };
}

/** The offer's plain-language text (the bar and the console say the same). */
export function offerMessage(record, count, goal, slotName = null) {
  const who = slotName || record.playerName || `slot ${record.slot}`;
  const plural = count === 1 ? 'location' : 'locations';
  let text =
    `You checked ${count} ${plural} while offline (${who}, ${record.game}, this room's seed). ` +
    `Send ${count === 1 ? 'it' : 'them'} to the server?`;
  if (goal) {
    const where = goal.locations.length > 0 ? ` (${goal.locations.map((l) => `"${l}"`).join(', ')})` : '';
    text +=
      ` This includes your goal${where}: sending it finishes ${who}'s game, ` +
      'and the server may release your remaining items to the other players.';
  }
  return text;
}
