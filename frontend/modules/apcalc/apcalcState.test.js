/**
 * The APCalc game reports its finish (sdc-goal-apcalc): once THIS state has
 * visited every node by pressing the calculator, it calls onFinished('Victory')
 * once, and index.js sends that as the panel's other checks are sent. Not the
 * logic: `Checked N` are True_ events, so the Victory rule holds when every node
 * is merely reachable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { APCalcState, VICTORY_LOCATION } from './apcalcState.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS = join(HERE, '..', '..', 'presets', 'apcalc');

// C --5--> Region 1 (5, L0) --+3--> Region 3 (8, L1); C --7--> Region 2 (7, L0)
const TINY = {
  nodes: {
    'Region 1': { value: 5, layer: 0, location_name: 'Check 1' },
    'Region 2': { value: 7, layer: 0, location_name: 'Check 2' },
    'Region 3': { value: 8, layer: 1, location_name: 'Check 3' },
  },
  edges: [
    { source: 'C', target: 'Region 1', operation: null, operand: 5 },
    { source: 'C', target: 'Region 2', operation: null, operand: 7 },
    { source: 'Region 1', target: 'Region 3', operation: '+', operand: 3 },
  ],
  starting_buttons: { 5: 2, 7: 2, '+': 2, 3: 2 },
};

function recorded(slotData) {
  const state = new APCalcState();
  state.loadFromSlotData(slotData);
  const checks = [];
  const finishes = [];
  state.onLocationCheck = (name) => checks.push(name);
  state.onFinished = (name) => finishes.push({ name, checksBefore: checks.length });
  return { state, checks, finishes };
}

const enter = (state, value) => {
  for (const digit of String(value)) expect(state.pressNumber(Number(digit))).toBe(true);
};

describe('APCalcState.onFinished', () => {
  it('fires once, after the last node is visited, and never before', () => {
    const { state, checks, finishes } = recorded(TINY);
    enter(state, 5);
    expect(state.pressEquals()).toMatchObject({ moved: true, node: 'Region 1' });
    state.pressOperation('+');
    enter(state, 3);
    expect(state.pressEquals()).toMatchObject({ moved: true, node: 'Region 3' });
    expect(finishes).toEqual([]);
    expect(state.allNodesVisited()).toBe(false);

    state.reset();
    enter(state, 7);
    expect(state.pressEquals()).toMatchObject({ moved: true, node: 'Region 2' });
    expect(checks).toEqual(['Check 1', 'Check 3', 'Check 2']);
    expect(finishes).toEqual([{ name: VICTORY_LOCATION, checksBefore: 3 }]);
    expect(VICTORY_LOCATION).toBe('Victory');

    // Revisiting after the finish sends nothing more.
    state.reset();
    enter(state, 5);
    state.pressEquals();
    expect(finishes).toHaveLength(1);
    expect(checks).toHaveLength(3);
  });

  it('is not fired by the snapshot (the tracker auto-checks reachable locations; reachability is not a finish)', () => {
    const { state, finishes } = recorded(TINY);
    state.syncFromSnapshot({
      inventory: { 'Button: 5': 9, 'Button: 7': 9, 'Button: +': 9, 'Button: 3': 9, 'Checked 1': 1, 'Checked 2': 1, 'Checked 3': 1 },
      checkedLocations: ['Check 1', 'Check 2', 'Check 3'],
    });
    expect(state.allNodesVisited()).toBe(false);
    expect(finishes).toEqual([]);
  });

  it('a graph with no nodes never finishes', () => {
    const { state } = recorded({ nodes: {}, edges: [], starting_buttons: {} });
    expect(state.allNodesVisited()).toBe(false);
  });

  it.each(readdirSync(PRESETS).sort())('plays the committed preset %s to every node, then finishes once', (folder) => {
    const rules = JSON.parse(readFileSync(join(PRESETS, folder, `${folder}_rules.json`), 'utf8'));
    const p = rules.playerId ?? Object.keys(rules.world)[0];
    const slotData = rules.world[p].slot_data;
    const { state, checks, finishes } = recorded(slotData);
    // Every button, plenty of presses: this pins the finish, not the budget.
    const inventory = {};
    for (const label of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/']) inventory[`Button: ${label}`] = 999;
    state.syncFromSnapshot({ inventory });

    // Each node by a route of edges from C (first-seen edge into each target).
    const into = new Map();
    for (const edge of slotData.edges) if (!into.has(edge.target)) into.set(edge.target, edge);
    const routeTo = (region) => {
      const route = [];
      for (let r = region; r !== 'C'; r = into.get(r).source) route.unshift(into.get(r));
      return route;
    };
    const regions = Object.keys(slotData.nodes);
    for (const region of regions) {
      state.reset();
      for (const edge of routeTo(region)) {
        if (edge.source !== 'C') expect(state.pressOperation(edge.operation)).toBe(true);
        enter(state, edge.operand);
        expect(state.pressEquals()).toMatchObject({ moved: true });
      }
      if (checks.length < regions.length) expect(finishes).toEqual([]);
    }
    expect(new Set(checks).size).toBe(regions.length);
    expect(finishes).toEqual([{ name: 'Victory', checksBefore: regions.length }]);
    // The world's Victory location is the one the finish names, with a server ID.
    const victory = rules.regions[p].C.locations.find((l) => l.name === 'Victory');
    expect(victory.id).toBe(234810601);
  });
});
