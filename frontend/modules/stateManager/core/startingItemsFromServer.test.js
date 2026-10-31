/**
 * ⚖ Starting items, the plain rule (server-data arc, user rulings 2026-10-30).
 *
 * When connected, an ID-bearing starting item comes only from the server (ReceivedItems,
 * location -2), and an ID-less one (an event: `Main.py` never sends it) from the LOADED rules'
 * `starting_items`. ReceivedItems `index 0` REPLACES the inventory, so a second one (`/sync`)
 * gives the same counts. Before this, APCalc seed 1's Buttons 6/7/8/9 read 2 after connect and
 * up to 3 after /sync (measured on a real MultiServer, research-event-autofire.md §2).
 *
 * Driven on the REAL `StateManager` with the payloads messageHandler sends: Connected
 * (`_handleConnected`) and ReceivedItems index 0 (`_handleReceivedItems`).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PRESETS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'presets');
const SEED1 = 'AP_14089154938208861744';
const rulesOf = (game) => JSON.parse(readFileSync(join(PRESETS, game, SEED1, `${SEED1}_rules.json`), 'utf8'));

const load = async (rules) => {
  const { StateManager } = await import('../stateManager.js');
  const { evaluateRule } = await import('../../shared/ruleEngine.js');
  const { workerLoggerInstance } = await import('../../../app/core/universalLogger.js');
  const sm = new StateManager(evaluateRule, workerLoggerInstance);
  sm.loadFromJSON(structuredClone(rules), '1');
  sm.computeReachableRegions();
  return sm;
};

/** What the server sends: the ID-bearing starting items, each at location -2. */
const serverStartInventory = (rules) =>
  rules.starting_items['1']
    .filter((name) => rules.items['1'][name].id != null)
    .map((itemName) => ({ itemName, locationNameToMark: null }));

/** messageHandler's payloads, in the order a connect delivers them. */
const connect = (sm, rules, serverChecked = []) => {
  sm.applyRuntimeState({
    serverCheckedLocationNames: serverChecked,
    serverUncheckedLocationNames: [],
    startingItemsFromServer: true,
  });
  receivedItemsIndex0(sm, rules);
};
const receivedItemsIndex0 = (sm, rules) =>
  sm.applyRuntimeState({
    resetInventory: true,
    startingItemsFromServer: true,
    rederiveIdlessLocations: true,
    receivedItemsForProcessing: serverStartInventory(rules),
  });

const BUTTONS = ['Button: 6', 'Button: 7', 'Button: 8', 'Button: 9'];
const counts = (sm, names) => Object.fromEntries(names.map((n) => [n, sm.inventory[n] ?? 0]));
const ONE_EACH = Object.fromEntries(BUTTONS.map((n) => [n, 1]));

describe('APCalc seed 1: the starting buttons count once', () => {
  it('reads 1 before connect, after connect, and after /sync (a second index 0)', async () => {
    const rules = rulesOf('apcalc');
    expect([...rules.starting_items['1']].sort()).toEqual(BUTTONS);
    const sm = await load(rules);
    expect(counts(sm, BUTTONS)).toEqual(ONE_EACH);
    const offlineRegions = [...sm.knownReachableRegions].sort();

    connect(sm, rules);
    expect(counts(sm, BUTTONS)).toEqual(ONE_EACH);
    // The double over-reported reachability (APCalc logic counts buttons); now it matches offline.
    expect([...sm.knownReachableRegions].sort()).toEqual(offlineRegions);

    receivedItemsIndex0(sm, rules);
    receivedItemsIndex0(sm, rules);
    expect(counts(sm, BUTTONS)).toEqual(ONE_EACH);
  });

  it('index 0 replaces items received earlier, it does not add to them', async () => {
    const rules = rulesOf('apcalc');
    const sm = await load(rules);
    connect(sm, rules);
    sm.applyRuntimeState({ resetInventory: false, receivedItemsForProcessing: [{ itemName: 'Button: 6' }] });
    expect(sm.inventory['Button: 6']).toBe(2);
    receivedItemsIndex0(sm, rules); // the server's resync no longer holds that copy
    expect(sm.inventory['Button: 6']).toBe(1);
  });

  it('offline: a full reset without the flag still re-adds every starting item', async () => {
    const rules = rulesOf('apcalc');
    const sm = await load(rules);
    sm.applyRuntimeState({ serverCheckedLocationNames: [] });
    expect(counts(sm, BUTTONS)).toEqual(ONE_EACH);
  });
});

describe('MetaMath seed 1: the ID-less starting event comes from the loaded rules', () => {
  it('keeps `Proved Statement s` and holds `Statement s` once; auto-collected events survive index 0', async () => {
    const rules = rulesOf('metamath');
    const start = rules.starting_items['1'];
    const event = start.find((n) => rules.items['1'][n].id == null);
    const idItem = start.find((n) => rules.items['1'][n].id != null);
    expect(event).toMatch(/^Proved Statement \d+$/);
    expect(idItem).toMatch(/^Statement \d+$/);

    const sm = await load(rules);
    const offlineEvents = [...sm.eventLocations.keys()].filter((n) => sm.checkedLocations.has(n)).sort();
    expect(offlineEvents.length).toBeGreaterThan(0);
    const offlineInventory = { ...sm.inventory };

    connect(sm, rules);
    receivedItemsIndex0(sm, rules); // /sync
    expect(sm.inventory[event]).toBe(1);
    expect(sm.inventory[idItem]).toBe(1);
    // index 0 kept the checked event locations' names but dropped their items: they are re-derived.
    expect([...sm.eventLocations.keys()].filter((n) => sm.checkedLocations.has(n)).sort()).toEqual(offlineEvents);
    for (const [name, n] of Object.entries(offlineInventory)) {
      if (n > 0) expect([name, sm.inventory[name]]).toEqual([name, n]);
    }
  });
});
