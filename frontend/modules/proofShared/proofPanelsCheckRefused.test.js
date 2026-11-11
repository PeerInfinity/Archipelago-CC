/**
 * The proof panels after a REFUSED check (sdc-ool-guard; found by sdc-depgraph-click, ruled in-slice by the planner).
 *
 * Connected, the client's logic gate (client/core/checkGate.js) refuses a proof-step check the state manager calls
 * unreachable. That happens when the proof rule (a dep's location CHECKED) disagrees with AP logic (the dep's event
 * reachable), e.g. after a dep was checked out of logic. The refusal produces NO snapshot update, and the panels cleared
 * their in-flight `_checkingStep` only on a snapshot/inventory update, so the next "Check next" sent nothing.
 *
 * Pinned per panel: (1) a refusal naming the in-flight step clears it, and the next "Check next" sends the next
 * reachable step; (2) "Check next" (and proofQueue's auto-check) skips a step the snapshot calls unreachable, so a
 * low-index disagreeing step cannot be re-picked forever; (3) a refusal of a DIFFERENT location leaves the guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sm = vi.hoisted(() => ({ reachability: {}, locations: new Map() }));
vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getLatestStateSnapshot: () => ({ locationReachability: sm.reachability }),
    getStaticData: () => ({ locations: sm.locations, regions: {} }),
  },
}));

import { ProofGraphUI, setDispatcher as setGraphDispatcher } from '../proofGraph/proofGraphUI.js';
import proofGraphState from '../proofGraph/proofGraphStateSingleton.js';
import { ProofQueueUI, setDispatcher as setQueueDispatcher } from '../proofQueue/proofQueueUI.js';
import proofQueueState from '../proofQueue/proofQueueStateSingleton.js';

// Steps 4 (disagreeing: proof says ready, logic says unreachable) and 7 (ready and reachable). 4 has the LOWER index.
const STEPS = [[4, 'Complete Node 12'], [7, 'Complete Node 7']];
const published = [];
const dispatcher = { publish: (name, data) => published.push({ name, data }) };
const sentNames = () => published.filter((p) => p.name === 'user:locationCheck').map((p) => p.data.locationName);

function loadSteps(state) {
  state.steps = new Map(STEPS.map(([i, loc]) => [i, { index: i, locationName: loc, itemName: `item ${i}`, dependencies: [] }]));
  state.isLoaded = true;
  state.checkedLocations = new Set();
}

beforeEach(() => {
  published.length = 0;
  sm.reachability = { 'Complete Node 12': 'unreachable', 'Complete Node 7': 'reachable' };
  sm.locations = new Map(STEPS.map(([, loc]) => [loc, {}]));
});

describe('proofGraph', () => {
  let ui;
  beforeEach(() => {
    loadSteps(proofGraphState);
    vi.spyOn(proofGraphState, 'isStepCheckable').mockImplementation((i) => proofGraphState.steps.has(i)
      && !proofGraphState.checkedLocations.has(proofGraphState.steps.get(i).locationName));
    setGraphDispatcher(dispatcher);
    ui = Object.create(ProofGraphUI.prototype);
    ui._checkingStep = null;
    ui._updateNodeClasses = () => {};
    ui._updateStatus = () => {};
  });

  it('a refusal of the in-flight step clears it; the next "Check next" sends the reachable step', () => {
    ui._checkStep(4); // a node tap on the disagreeing step
    expect(sentNames()).toEqual(['Complete Node 12']);
    expect(ui._checkingStep).toBe(4);
    ui._onCheckNext(); // still in flight: ignored (the guard)
    expect(sentNames()).toEqual(['Complete Node 12']);

    ui._handleCheckRefused({ locationName: 'Complete Node 12', reason: 'not_accessible', originator: 'ProofGraphCheck' });
    expect(ui._checkingStep).toBe(null);
    ui._onCheckNext();
    expect(sentNames()).toEqual(['Complete Node 12', 'Complete Node 7']);
  });

  it('"Check next" skips the step logic calls unreachable, even at the lower index', () => {
    ui._onCheckNext();
    expect(sentNames()).toEqual(['Complete Node 7']);
  });

  it('a refusal of another location leaves the in-flight guard', () => {
    ui._checkStep(7);
    ui._handleCheckRefused({ locationName: 'Complete Node 12', reason: 'not_accessible' });
    expect(ui._checkingStep).toBe(7);
  });
});

describe('proofQueue', () => {
  let ui;
  beforeEach(() => {
    loadSteps(proofQueueState);
    // The queue in order 4, 7; both proof-checkable.
    vi.spyOn(proofQueueState, 'validateQueue').mockImplementation(() => STEPS.map(([i, loc]) => ({
      stepIndex: i, valid: true, checkable: !proofQueueState.checkedLocations.has(loc), missingDeps: [], alreadyChecked: false,
    })));
    setQueueDispatcher(dispatcher);
    ui = Object.create(ProofQueueUI.prototype);
    ui._checkingStep = null;
    ui._checkCooldownUntil = 0;
    ui._getDifficulty = () => 'trivial';
    ui._cbAutoCheck = { checked: true };
    ui.render = () => {};
  });

  it('a refusal of the in-flight step clears it; the next "Check next" sends the reachable step', () => {
    ui._checkQueueStep(4); // a click on the disagreeing queue row
    expect(sentNames()).toEqual(['Complete Node 12']);
    ui._onCheckNext();
    expect(sentNames()).toEqual(['Complete Node 12']); // in flight: ignored

    ui._handleCheckRefused({ locationName: 'Complete Node 12', reason: 'not_accessible', originator: 'ProofQueueCheck' });
    expect(ui._checkingStep).toBe(null);
    ui._onCheckNext();
    expect(sentNames()).toEqual(['Complete Node 12', 'Complete Node 7']);
  });

  it('"Check next" and auto-check skip the step logic calls unreachable (no refuse/re-pick loop)', () => {
    ui._onCheckNext();
    expect(sentNames()).toEqual(['Complete Node 7']);
    ui._checkingStep = null;
    published.length = 0;
    ui._tryAutoCheck();
    expect(sentNames()).toEqual(['Complete Node 7']);
  });

  it('with only the disagreeing step left, "Check next" sends nothing', () => {
    proofQueueState.checkedLocations.add('Complete Node 7');
    ui._onCheckNext();
    ui._tryAutoCheck();
    expect(sentNames()).toEqual([]);
  });
});
