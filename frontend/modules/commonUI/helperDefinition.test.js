/**
 * The rule display's helper lookup reads the LOADED player's `helpers` (sdc-player1-in-play, 2026-11-18).
 * It used to try '1' and '0' only, so on a slot ≥2 document a helper showed without its definition
 * (no "[+] Show helper body"). Built on the real shared snapshot interface, as the Regions/Locations
 * panels build it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import { helperDefinitionFor } from './helperDefinition.js';

const CAN_FLY_2 = { type: 'item_check', item: 'Wings' };
const CAN_FLY_1 = { type: 'item_check', item: 'Feather' };

/** A loaded document for `slot`, its helpers keyed under that slot (and `extra` keys alongside). */
function iface(slot, helpers, { playerOnSnapshot = true } = {}) {
  const snapshot = { inventory: {}, ...(playerOnSnapshot ? { player: { id: String(slot) } } : {}) };
  const staticData = { game_name: 'Test Game', playerId: String(slot), helpers, regions: new Map() };
  return createSnapshotInterface(snapshot, staticData);
}

describe('helperDefinitionFor reads the loaded player\'s helpers', () => {
  it('slot 2: finds helpers["2"] (was null: only "1"/"0" were tried)', () => {
    expect(helperDefinitionFor(iface(2, { 2: { can_fly: CAN_FLY_2 } }), 'can_fly')).toEqual(CAN_FLY_2);
  });

  it('slot 2 named only by staticData.playerId: still finds helpers["2"]', () => {
    const si = iface(2, { 2: { can_fly: CAN_FLY_2 } }, { playerOnSnapshot: false });
    expect(helperDefinitionFor(si, 'can_fly')).toEqual(CAN_FLY_2);
  });

  it('slot 2 in a multiworld document: its own helper, not slot 1\'s same-named one', () => {
    const si = iface(2, { 1: { can_fly: CAN_FLY_1 }, 2: { can_fly: CAN_FLY_2 } });
    expect(helperDefinitionFor(si, 'can_fly')).toEqual(CAN_FLY_2);
  });

  it('slot 2: slot 1\'s helper is not shown as this slot\'s', () => {
    expect(helperDefinitionFor(iface(2, { 1: { can_fly: CAN_FLY_1 } }), 'can_fly')).toBeNull();
  });

  it('slot 2: the "0" key is still a fallback', () => {
    expect(helperDefinitionFor(iface(2, { 0: { can_fly: CAN_FLY_2 } }), 'can_fly')).toEqual(CAN_FLY_2);
  });

  it('control, slot 1: helpers["1"] as before', () => {
    expect(helperDefinitionFor(iface(1, { 1: { can_fly: CAN_FLY_1 } }), 'can_fly')).toEqual(CAN_FLY_1);
    expect(helperDefinitionFor(iface(1, { 0: { can_fly: CAN_FLY_1 } }), 'can_fly')).toEqual(CAN_FLY_1);
    expect(helperDefinitionFor(iface(1, { 1: {} }), 'can_fly')).toBeNull();
  });

  it('no player named: "1" then "0", as before', () => {
    const si = { getStaticData: () => ({ helpers: { 1: { can_fly: CAN_FLY_1 } } }) };
    expect(helperDefinitionFor(si, 'can_fly')).toEqual(CAN_FLY_1);
  });

  it('no interface, no helpers, no name: null', () => {
    expect(helperDefinitionFor(null, 'can_fly')).toBeNull();
    expect(helperDefinitionFor({ getStaticData: () => ({}) }, 'can_fly')).toBeNull();
    expect(helperDefinitionFor(iface(2, { 2: { can_fly: CAN_FLY_2 } }), '')).toBeNull();
  });
});

describe('commonUI.js renders helpers through helperDefinitionFor', () => {
  const src = readFileSync(fileURLToPath(new URL('./commonUI.js', import.meta.url)), 'utf8');
  it('both helper renderers call it, and the fixed player-1 list is gone', () => {
    expect(src.match(/helperDefinitionFor\(stateSnapshotInterface, /g)?.length).toBe(2);
    expect(src).not.toMatch(/\[\s*'1',\s*'0',\s*1,\s*0\s*\]/);
  });
});
