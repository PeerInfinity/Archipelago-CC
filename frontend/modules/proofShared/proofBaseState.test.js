/**
 * The proof panels' entrance rule mode: slot_data first (servers that send
 * it), then the exporter's world options, then the worlds' default (1).
 */

import { describe, it, expect } from 'vitest';
import { ProofBaseState } from './proofBaseState.js';

const STRUCTURE = { proof_structure: { 1: { label: 'a', expression: '|- a', dependencies: [] } } };

function modeFor(slotData, options) {
  const state = new ProofBaseState();
  state._parseProofStructure(slotData, undefined, options);
  return state.entranceRuleMode;
}

describe('ProofBaseState entrance rule mode', () => {
  it('reads slot_data before the world options', () => {
    expect(modeFor({ ...STRUCTURE, entrance_rule_mode: 3 }, { entrance_rule_mode: 0 })).toBe(3);
  });

  it('reads the world options when slot_data lacks the mode', () => {
    expect(modeFor(STRUCTURE, { entrance_rule_mode: 0 })).toBe(0);
    expect(modeFor(STRUCTURE, { entrance_rule_mode: 2 })).toBe(2);
  });

  it("falls back to the worlds' default, relaxed_items (1), not strict", () => {
    expect(modeFor(STRUCTURE, undefined)).toBe(1);
    expect(new ProofBaseState().entranceRuleMode).toBe(1);
  });
});
