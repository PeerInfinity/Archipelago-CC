/**
 * Tests for same-name edge routing in the Proof Graph.
 *
 * Two nodes that share a label (e.g. two `breqd` steps) are the same theorem at
 * different instantiations — visually identical but NOT interchangeable. Routing
 * lets the player connect "a breqd" to a target and fills the edge for whichever
 * same-label instance the connection is actually valid for, instead of forcing a
 * guess.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProofGraphState } from './proofGraphState.js';

// Helper: build a state from a compact graph spec { index: {label, deps} }.
function makeState(spec, options = {}) {
  const graph_structure = {};
  for (const [idx, { label, deps }] of Object.entries(spec)) {
    graph_structure[idx] = { label, dependencies: deps };
  }
  const state = new ProofGraphState();
  state.loadFromSlotData({ graph_structure }, null, options);
  return state;
}

describe('ProofGraphState same-name edge routing', () => {
  let state;

  // Two `breqd` instances (base ⇒ always visible) each feeding a distinct
  // `2exbidv`. The pairing is asymmetric: #3 needs breqd#1, #4 needs breqd#2.
  beforeEach(() => {
    state = makeState({
      1: { label: 'breqd', deps: [] },
      2: { label: 'breqd', deps: [] },
      3: { label: '2exbidv', deps: [1] },
      4: { label: '2exbidv', deps: [2] },
    });
  });

  it('routes a mismatched drag to the valid same-label instance', () => {
    // Player drags breqd#1 → 2exbidv#4, but #4 actually needs breqd#2.
    const res = state.tryDrawEdge(1, 4);
    expect(res.success).toBe(true);
    expect(res.source).toBe(2); // routed to the instance that is valid
    expect(state.drawnEdges.has('2->4:0')).toBe(true);
    expect(state.drawnEdges.has('1->4:0')).toBe(false);
  });

  it('still accepts the exact-correct drag unchanged', () => {
    const res = state.tryDrawEdge(1, 3); // #3 genuinely needs breqd#1
    expect(res.success).toBe(true);
    expect(res.source).toBe(1);
  });

  it('reports already-drawn when the same-label edge is filled via routing', () => {
    expect(state.tryDrawEdge(1, 4).success).toBe(true); // fills 2->4 via routing
    const again = state.tryDrawEdge(2, 4); // the only breqd edge to #4 is taken
    expect(again.success).toBe(false);
    expect(again.reason).toBe('already-drawn');
  });

  it('rejects a genuinely wrong connection (no same-label edge to target)', () => {
    const s = makeState({
      1: { label: 'breqd', deps: [] },
      2: { label: 'foo', deps: [] },
      3: { label: 'bar', deps: [2] }, // needs foo, not breqd
    });
    const res = s.tryDrawEdge(1, 3);
    expect(res.success).toBe(false);
    expect(res.reason).toBe('incorrect');
  });

  it('does not route to a same-label instance that is not yet visible', () => {
    // breqd#3 is gated behind node 2 (strict mode ⇒ not visible until proven).
    const s = makeState(
      {
        1: { label: 'breqd', deps: [] }, // visible (base)
        2: { label: 'x', deps: [] },
        3: { label: 'breqd', deps: [2] }, // not visible until node 2 satisfied
        4: { label: '2exbidv', deps: [3] }, // needs the not-yet-visible breqd#3
      },
      { entrance_rule_mode: 0 } // strict
    );
    const res = s.tryDrawEdge(1, 4); // valid instance (#3) is off-screen
    expect(res.success).toBe(false);

    // Once breqd#3 becomes visible (its dep satisfied), routing works.
    s.receiveItem('Node 2');
    s.checkLocation('Complete Node 2');
    const res2 = s.tryDrawEdge(1, 4);
    expect(res2.success).toBe(true);
    expect(res2.source).toBe(3);
  });
});
