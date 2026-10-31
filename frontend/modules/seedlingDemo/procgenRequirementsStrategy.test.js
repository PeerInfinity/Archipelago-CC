/**
 * STRATEGY SWITCH r1 (D2) — `requirementsFor`'s STRATEGY ARM, its grading rule alone (the oracle is stubbed, so each
 * without-arm outcome is chosen): the hit count gates REQUIRED on a refusal.
 *   REFUSED, hits > 0  → REQUIRED · STRONG;  REFUSED, hits === 0 → "rule not established" (never consulted);
 *   BUDGET_EXHAUSTED   → BOUND-DEPENDENT;    SOLVED same ticks  → INERT.
 * The row carries `disabled` and the CONTACT_FIDELITY stamp beside it; the solve was asked with `disable: [verb]` at
 * the SAME budget and boot; no `strategies` = today's report (no row, no key).
 */
import { describe, expect, it, vi } from 'vitest';

const asked = [];
let next = null;
vi.mock('./procgenOracle.js', async (orig) => ({
    ...(await orig()),
    solve: (record, staging, goals, budget, opts) => { asked.push({ budget, opts }); return next(opts); },
}));

const { requirementsFor, gradeOf } = await import('./procgenRequirements.js');
const { CONTACT_FIDELITY, CONTACT_FIDELITY_KEYS, withContactFidelity } = await import('./contactFidelity.js');

const state = {
    record: {}, seed: 1, biome: 'pre-sword',
    palette: { items: {} },
    model: { boot: () => ({ level: 900, x: 8, y: 8 }), goals: [{ kind: 'reach-exit' }] },
    summary: { pins: [] },
};
const WITH = { verdict: 'SOLVED', ticks: 200 };
const budget = { maxTicksPerTarget: 400 };
const row = (without) => {
    next = () => without;
    asked.length = 0;
    return requirementsFor(state, WITH, { budget, strategies: ['shove'] }).rows[0];
};

describe('requirementsFor — the strategy arm (strategy switch r1, D2)', () => {
    it('REFUSED at the gate (hits > 0) is STRONG; the solve asked disable:[verb] at the same budget', () => {
        const disabled = { asked: ['shove'], hits: { shove: 6 }, first: null, absent: [] };
        const r = row({ verdict: 'REFUSED', disabled, reasonText: 'x' });
        expect(asked).toEqual([{ budget, opts: expect.objectContaining({ disable: ['shove'] }) }]);
        expect(r).toMatchObject({ flag: 'strategy:shove', strategy: 'shove', verdict: 'REQUIRED',
            withoutVerdict: 'REFUSED', disabled, contactFidelity: null });
        expect(gradeOf(r)).toBe('STRONG');
    });

    it('REFUSED with 0 hits (never consulted; the flag OFF lands here) is "rule not established", never STRONG', () => {
        const r = row({ verdict: 'REFUSED', disabled: { asked: ['shove'], hits: {}, first: null, absent: [], switch: 'off' } });
        expect(r.verdict).toBe('rule not established');
        expect(r.why).toMatch(/never consulted/);
        expect(gradeOf(r)).toBe('NOT-ESTABLISHED');
    });

    it('BUDGET_EXHAUSTED is BOUND-DEPENDENT; SOLVED at the same ticks is INERT', () => {
        expect(gradeOf(row({ verdict: 'BUDGET_EXHAUSTED', disabled: { hits: { shove: 1 } } }))).toBe('BOUND-DEPENDENT');
        expect(gradeOf(row({ verdict: 'SOLVED', ticks: 200, certification: { certified: true },
            disabled: { hits: {} } }))).toBe('INERT');
    });

    it('the CONTACT_FIDELITY stamp rides beside `disabled` (fidelity p17 condition 3)', () => {
        const key = CONTACT_FIDELITY_KEYS[0];
        const r = withContactFidelity({ [key]: !CONTACT_FIDELITY[key] },
            () => row({ verdict: 'REFUSED', disabled: { hits: { shove: 1 } } }));
        expect(r.contactFidelity).not.toBe(null);
        expect(r.contactFidelity[key]).toBe(!CONTACT_FIDELITY[key]);
        expect(r.disabled).toEqual({ hits: { shove: 1 } });
    });

    it('no `strategies`: the report has no strategy key and no strategy row (the batch md5 path)', () => {
        next = () => { throw new Error('no solve expected'); };
        const r = requirementsFor(state, WITH, { budget });
        expect(r).not.toHaveProperty('strategies');
        expect(r.rows).toEqual([]);
    });
});
