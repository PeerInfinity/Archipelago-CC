/**
 * The proof panels' goal check against each document's own location names
 * (ProofBaseState._resolveLocationNames, sdc-proof-goal-report).
 *
 * The cause it pins: the proof state named a graph step's location
 * "Complete Node N" (the hand-written DepGraph world's generic name), but the
 * DepGraph WorldGen package names it as the hand-written world displays it
 * ("Production Deployment") and carries no name_substitutions. Its goal step
 * then matched no checked location, so `isProofComplete()` stayed false and
 * the goal was never reported, connected or not.
 *
 * Census: every committed depgraph* / metamath* preset, both panel states.
 * Each one's goal step must resolve to an ID-bearing location in its own
 * document. Checking every ID location completes the proof, and checking
 * every location but the goal does not. The hand-written worlds resolve
 * exactly as they did before (the names are unchanged).
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getLatestStateSnapshot: () => null,
    getStaticData: () => null,
  },
}));

import { ProofGraphState } from '../proofGraph/proofGraphState.js';
import { ProofQueueState } from '../proofQueue/proofQueueState.js';
import { getDocLocationNames, reportGoalIfComplete } from './proofModuleHelpers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS = join(HERE, '..', '..', 'presets');
const GAME_DIRS = ['depgraph', 'depgraph_vanilla', 'depgraph_worldgen', 'metamath', 'metamath_vanilla', 'metamath_worldgen'];
const STATES = [ProofGraphState, ProofQueueState];

/** Every (file, player) whose world sends a proof/graph structure. */
function presetPlayers() {
  const out = [];
  for (const game of GAME_DIRS) {
    const gameDir = join(PRESETS, game);
    if (!existsSync(gameDir)) continue;
    for (const seedDir of readdirSync(gameDir).filter((d) => d.startsWith('AP_')).sort()) {
      for (const file of readdirSync(join(gameDir, seedDir)).filter((f) => f.endsWith('_rules.json')).sort()) {
        const path = join(gameDir, seedDir, file);
        const doc = JSON.parse(readFileSync(path, 'utf8'));
        for (const [player, world] of Object.entries(doc.world || {})) {
          const sd = world?.slot_data;
          if (!sd?.graph_structure && !sd?.proof_structure) continue;
          out.push({ game, label: `${game}/${seedDir}/${file} P${player}`, doc, player });
        }
      }
    }
  }
  return out;
}

/** The document's locations for one player, as static data carries them (name -> location). */
function staticLocations(doc, player) {
  const map = new Map();
  for (const region of Object.values(doc.regions?.[player] || {})) {
    for (const location of region?.locations || []) map.set(location.name, location);
  }
  return map;
}

/** Load a state as the panels do, with slot_data as the server sends it (JSON keys). */
function load(StateClass, doc, player, { withDoc = true } = {}) {
  const world = doc.world[player];
  const slotData = JSON.parse(JSON.stringify(world.slot_data));
  const state = new StateClass();
  const names = withDoc ? getDocLocationNames({ locations: staticLocations(doc, player) }) : null;
  state.loadFromSlotData(slotData, world.name_substitutions, world.options, names);
  return state;
}

const players = presetPlayers();

describe('proof goal location census (every committed depgraph*/metamath* preset)', () => {
  it('finds the presets it is about, the WorldGen ones among them', () => {
    const games = new Set(players.map((p) => p.game));
    expect(games).toContain('depgraph');
    expect(games).toContain('metamath');
    expect(games).toContain('depgraph_worldgen');
    expect(games).toContain('metamath_worldgen');
    console.log(`[census] ${players.length} preset player(s): ` +
      GAME_DIRS.map((g) => `${g}=${players.filter((p) => p.game === g).length}`).join(' '));
  });

  for (const { label, doc, player } of players) {
    for (const StateClass of STATES) {
      it(`${label} (${StateClass.name}): the goal resolves to a doc ID location and completes only when it is checked`, () => {
        const state = load(StateClass, doc, player);
        expect(state.isLoaded).toBe(true);
        const locations = staticLocations(doc, player);
        const goal = state.steps.get(state.goalStepIndex);
        expect(goal).toBeTruthy();
        expect(state.unresolvedLocationSteps.map((u) => u.index)).not.toContain(state.goalStepIndex);
        expect(locations.get(goal.locationName)?.id ?? null).not.toBeNull();

        const idNames = [...locations.values()].filter((l) => l.id != null).map((l) => l.name);
        const allButGoal = new StateClass();
        Object.assign(allButGoal, state); // same parse; fresh checked set below
        allButGoal.checkedLocations = new Set();
        allButGoal.syncLocations(idNames.filter((n) => n !== goal.locationName));
        expect(allButGoal.isProofComplete()).toBe(false);

        state.syncLocations(idNames);
        expect(state.isProofComplete()).toBe(true);
      });
    }
  }
});

describe('the hand-written worlds resolve exactly as before', () => {
  const handWritten = players.filter((p) => p.game === 'depgraph' || p.game === 'metamath' ||
    p.game === 'depgraph_vanilla' || p.game === 'metamath_vanilla');

  it('has hand-written presets to pin', () => {
    expect(handWritten.length).toBeGreaterThan(0);
  });

  for (const { label, doc, player } of handWritten) {
    it(`${label}: every step's location name is the one parsed without a document`, () => {
      const before = load(ProofGraphState, doc, player, { withDoc: false });
      const after = load(ProofGraphState, doc, player);
      expect(after.unresolvedLocationSteps).toEqual([]);
      const names = (s) => [...s.steps.entries()].map(([i, step]) => [i, step.locationName, step.itemName]);
      expect(names(after)).toEqual(names(before));
    });
  }
});

describe('DepGraph WorldGen: the measured cause', () => {
  const dg = players.find((p) => p.game === 'depgraph_worldgen');

  it('without the document, the goal is "Complete Node 61", which the document does not have', () => {
    const state = load(ProofGraphState, dg.doc, dg.player, { withDoc: false });
    const goal = state.steps.get(state.goalStepIndex);
    expect(goal.locationName).toBe(`Complete Node ${state.goalStepIndex}`);
    expect(staticLocations(dg.doc, dg.player).has(goal.locationName)).toBe(false);
  });

  it('with it, the goal is the document\'s location, and checking it reports the goal once per call', () => {
    const state = load(ProofGraphState, dg.doc, dg.player);
    const goal = state.steps.get(state.goalStepIndex);
    expect(goal.locationName).toBe(dg.doc.world[dg.player].slot_data.graph_structure[state.goalStepIndex].expression);
    const dispatcher = { publish: vi.fn() };
    reportGoalIfComplete(state, dispatcher);
    expect(dispatcher.publish).not.toHaveBeenCalled();
    state.syncLocations([goal.locationName]);
    reportGoalIfComplete(state, dispatcher);
    expect(dispatcher.publish).toHaveBeenCalledTimes(1);
    expect(dispatcher.publish.mock.calls[0][0]).toBe('user:goalReached');
  });
});

describe('no guess: an unmatched or ambiguous step stays unresolved and never completes', () => {
  const graph = {
    graph_structure: {
      1: { label: 'a', expression: 'Alpha', dependencies: [] },
      2: { label: 'b', expression: 'Twin', dependencies: [1] },
      3: { label: 'c', expression: 'Twin', dependencies: [1] },
      4: { label: 'd', expression: 'Goal Node', dependencies: [2, 3] },
    },
  };
  const warn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('a goal with no matching location is unresolved, logged, and not complete with everything checked', () => {
    const spy = warn();
    const names = new Set(['Alpha', 'Twin', 'Something Else']);
    const state = new ProofGraphState();
    state.loadFromSlotData(graph, null, null, names);
    expect(state.unresolvedLocationSteps.map((u) => u.index)).toContain(4);
    state.syncLocations([...names]);
    expect(state.isProofComplete()).toBe(false);
    expect(spy.mock.calls.some(([m]) => /the goal will not be reported/.test(m))).toBe(true);
    spy.mockRestore();
  });

  it('two steps that match the same location are both unresolved', () => {
    const spy = warn();
    const state = new ProofGraphState();
    state.loadFromSlotData(graph, null, null, new Set(['Alpha', 'Twin', 'Goal Node']));
    const unresolved = state.unresolvedLocationSteps.map((u) => u.index).sort();
    expect(unresolved).toEqual([2, 3]);
    expect(state.steps.get(2).locationName).toBe('Complete Node 2');
    expect(state.steps.get(4).locationName).toBe('Goal Node');
    spy.mockRestore();
  });

  it('a step whose substitution and expression are two different document locations is ambiguous', () => {
    const spy = warn();
    const state = new ProofGraphState();
    state.loadFromSlotData(
      { graph_structure: { 1: { label: 'x', expression: 'Plain', dependencies: [] } } },
      { locations: { 'Complete Node 1': 'Fancy' } },
      null,
      new Set(['Plain', 'Fancy'])
    );
    expect(state.unresolvedLocationSteps).toEqual([{ index: 1, locationName: 'Complete Node 1', matches: ['Fancy', 'Plain'] }]);
    spy.mockRestore();
  });

  it('a long DepGraph expression matches node_location_name\'s 50-character cut', () => {
    const long = 'L'.repeat(60);
    const cut = 'L'.repeat(47) + '...';
    const state = new ProofGraphState();
    state.loadFromSlotData({ graph_structure: { 1: { label: 'x', expression: long, dependencies: [] } } }, null, null, new Set([cut]));
    expect(state.steps.get(1).locationName).toBe(cut);
  });
});

describe('getDocLocationNames', () => {
  it('reads a Map, an entries array, an object array and a plain object', () => {
    expect(getDocLocationNames({ locations: new Map([['A', { name: 'A' }]]) })).toEqual(new Set(['A']));
    expect(getDocLocationNames({ locations: [['B', { name: 'B' }]] })).toEqual(new Set(['B']));
    expect(getDocLocationNames({ locations: [{ name: 'C' }] })).toEqual(new Set(['C']));
    expect(getDocLocationNames({ locations: { D: { name: 'D' } } })).toEqual(new Set(['D']));
  });

  it('is null when static data has no locations (names then stay as parsed)', () => {
    expect(getDocLocationNames(null)).toBeNull();
    expect(getDocLocationNames({})).toBeNull();
    expect(getDocLocationNames({ locations: new Map() })).toBeNull();
  });
});
