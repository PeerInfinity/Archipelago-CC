/**
 * A connected event collect, on the document the SERVER sends (sdc-connected-events, ⚖ Robert 2026-11-12).
 *
 * The room's rules are `slot_data.worldgen_rules` = the package's `_worldgen_rules.json`. Its event locations
 * used to carry no item (world_generator's strip took every location's item), so a connected event collect
 * checked the location and added nothing: the Seedling bot's L16 rope break step repeated forever. Here the
 * shipped Seedling document is loaded as the client loads it, connected the way messageHandler connects, the
 * rope is collected the way the glue collects it, and the server's resyncs follow: one event item, never two.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ROPE = 'L16 flag 0: rope@32,16 cleared';

const serverDoc = () => {
  const env = JSON.parse(readFileSync(join(REPO, 'worlds', 'seedling_playthrough', '_worldgen_rules.json'), 'utf8'));
  return { doc: env.doc, player: String(env.player) };
};

const load = async ({ doc, player }) => {
  const { StateManager } = await import('../stateManager.js');
  const { evaluateRule } = await import('../../shared/ruleEngine.js');
  const { workerLoggerInstance } = await import('../../../app/core/universalLogger.js');
  const sm = new StateManager(evaluateRule, workerLoggerInstance);
  sm.loadFromJSON(structuredClone(doc), player);
  sm.computeReachableRegions();
  return sm;
};

/** messageHandler's Connected payload, then ReceivedItems index 0 (Connect, /sync) and index > 0. */
const connected = (sm) => sm.applyRuntimeState({ serverCheckedLocationNames: [], serverUncheckedLocationNames: [], startingItemsFromServer: true });
const index0 = (sm, items = []) => sm.applyRuntimeState({
  resetInventory: true, startingItemsFromServer: true, rederiveIdlessLocations: true,
  receivedItemsForProcessing: items.map((itemName) => ({ itemName, locationNameToMark: null })),
});
const incremental = (sm, items) => sm.applyRuntimeState({
  resetInventory: false, receivedItemsForProcessing: items.map((itemName) => ({ itemName, locationNameToMark: null })),
});

describe('Seedling: a connected event collect on the server-sent document', () => {
  it('the shipped document pairs every event location with its event item', () => {
    const { doc, player } = serverDoc();
    const events = Object.values(doc.regions[player]).flatMap((r) => r.locations || []).filter((l) => l.id == null);
    expect(events.length).toBeGreaterThan(0);
    expect(events.filter((l) => !l.item?.name).map((l) => l.name)).toEqual([]);
    expect(events.find((l) => l.name === ROPE)?.item?.name).toBe(ROPE);
  });

  it('collecting the rope adds its event item once; /sync, a second /sync and new items never add a second', async () => {
    const sm = await load(serverDoc());
    connected(sm);
    index0(sm, ['Progressive Sword']);
    expect(sm.inventory[ROPE] ?? 0).toBe(0);

    sm.checkLocation(ROPE, true, true); // the glue's collectEvent: proxy.checkLocation(location, true, true)
    expect(sm.checkedLocations.has(ROPE)).toBe(true);
    expect(sm.inventory[ROPE]).toBe(1);

    index0(sm, ['Progressive Sword']); // /sync
    index0(sm, ['Progressive Sword']);
    incremental(sm, ['Seal']);
    expect(sm.checkedLocations.has(ROPE)).toBe(true);
    expect(sm.inventory[ROPE]).toBe(1);
  });

  it('a check of the rope passed up by the client (no forceCheck) honours logic: unreachable = not collected', async () => {
    const sm = await load(serverDoc());
    connected(sm);
    index0(sm, []);
    expect(sm.isLocationAccessible(sm.locations.get(ROPE))).toBe(false);
    sm.checkLocation(ROPE, true, false);
    expect(sm.checkedLocations.has(ROPE)).toBe(false);
    expect(sm.inventory[ROPE] ?? 0).toBe(0);
  });
});

/**
 * RE1 (reconnect events, ⚖ Robert 2026-11-14): a reconnect's `Connected` reset drops a locally collected event
 * (measured on upstream 0.6.9 at slots 1 and 2); the glue then re-applies it through the same forced local check
 * (`client:connectedStateApplied`, after the reset). On the REAL state manager, at slot 1 AND slot 2 (the server
 * document overlaid for the room's slot, as `messageHandler._overlayRulesForSlot` does): the event comes back with
 * its item once, a re-apply of an event it still has is `already_checked`, and a /sync never doubles it.
 */
const ROCK = 'L0 flag 1: breakablerock@288,176 cleared';

const slotDoc = async (slot) => {
  const { doc, player } = serverDoc();
  if (String(slot) === player) return { doc, player };
  const { overlayServerData } = await import('../../client/core/localRulesOverlay.js');
  const items = Object.keys(doc.items[player]);
  const scouts = Object.values(doc.regions[player]).flatMap((r) => r.locations || []).filter((l) => l.id != null)
    .map((l) => ({ locationId: l.id, itemName: l.item?.name ?? items[0], player: Number(slot), progression: true }));
  return { doc: overlayServerData(doc, player, { slot, scouts }), player: String(slot) };
};

describe.each([1, 2])('RE1 — a reconnect re-applies a collected event (slot %i, real state manager)', (slot) => {
  it('collect → Connected reset drops it → the re-apply brings it back once; /sync and a repeat never double it', async () => {
    const sm = await load(await slotDoc(slot));
    expect(String(sm.playerId)).toBe(String(slot));
    expect(sm.locations.get(ROCK)?.item?.player).toBe(slot);
    connected(sm);
    index0(sm, []);
    sm.checkLocation(ROCK, true, true); // the live collect
    sm.checkLocation(ROPE, true, true);
    expect(sm.inventory[ROCK]).toBe(1);

    // the reconnect: Connected (the FULL reset) — the measured loss
    connected(sm);
    expect(sm.checkedLocations.has(ROCK)).toBe(false);
    expect(sm.inventory[ROCK] ?? 0).toBe(0);

    // client:connectedStateApplied → the glue's re-apply (the same forced local check), then the server's /sync
    const rejected = [];
    const publish = sm._publishEvent.bind(sm);
    sm._publishEvent = (name, data) => { if (name === 'locationCheckRejected') rejected.push(data); return publish(name, data); };
    sm.checkLocation(ROCK, true, true);
    sm.checkLocation(ROPE, true, true);
    index0(sm, []);
    expect(sm.checkedLocations.has(ROCK)).toBe(true);
    expect(sm.inventory[ROCK]).toBe(1);
    expect(sm.inventory[ROPE]).toBe(1);

    // a second trigger of the same reset (or an in-place reload of the same rules) — the state manager dedupes
    sm.checkLocation(ROCK, true, true);
    index0(sm, []);
    expect(sm.inventory[ROCK]).toBe(1);
    expect(rejected).toEqual([{ locationName: ROCK, reason: 'already_checked' }]);
  });
});
