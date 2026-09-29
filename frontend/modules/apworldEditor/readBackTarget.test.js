/**
 * ⛓⛓ APWORLD SUBSTRATE CHANGE H2 — the S2 read-back row's target derivation
 * (`test-helpers.js` `readBackTarget`) over a FAKE registry order. The page's
 * order is its parallel module-import order (a coin flip), so every order the
 * rows below name is one a page load can draw.
 */
import { describe, it, expect } from 'vitest';
import { READ_BACK_SKIP, moveReadBackKnob, readBackKeysOf, readBackTarget } from './test-helpers.js';

const hooks = { renderProcgenParams: () => null, procgenParamsFromPayload: () => ({}) };
const REG = {
    // the read-back names no knob the hook's control moves (it answers `{}` for an empty payload)
    undefinedKnob: { ...hooks },
    bounce: { ...hooks, procgenParamsFromPayload: () => ({ profile: 'x' }) },
    heavy: { ...hooks, procgenParamsFromPayload: () => ({ profile: 'x' }), generationCost: 'heavy' },
    unhooked: {},
};
const facts = {
    isHeavy: (e) => e.generationCost === 'heavy',
    knobMoves: (id, e) => Object.keys(e.procgenParamsFromPayload({})).length > 0,
};
const pick = (order) => readBackTarget(order, (id) => REG[id], facts);

describe('readBackTarget — the knob the control moves is part of the derivation', () => {
    it('[undefined-knob, bounce] → bounce (the knob fact skips the first draw)', () => {
        expect(pick(['undefinedKnob', 'bounce'])).toEqual({
            target: 'bounce', skipped: [{ id: 'undefinedKnob', reason: READ_BACK_SKIP.NO_KNOB }],
        });
    });
    it('[bounce, undefined-knob] → bounce (probing stops at the chosen target)', () => {
        expect(pick(['bounce', 'undefinedKnob'])).toEqual({ target: 'bounce', skipped: [] });
    });
    it('[heavy, undefined-knob, bounce] → bounce, each skip with its own reason', () => {
        expect(pick(['unhooked', 'heavy', 'undefinedKnob', 'bounce'])).toEqual({
            target: 'bounce',
            skipped: [
                { id: 'unhooked', reason: READ_BACK_SKIP.NO_HOOKS },
                { id: 'heavy', reason: READ_BACK_SKIP.HEAVY },
                { id: 'undefinedKnob', reason: READ_BACK_SKIP.NO_KNOB },
            ],
        });
    });
    it('every hooked target without a movable knob → null, and every skip is named', () => {
        expect(pick(['undefinedKnob', 'heavy'])).toEqual({
            target: null,
            skipped: [
                { id: 'undefinedKnob', reason: READ_BACK_SKIP.NO_KNOB },
                { id: 'heavy', reason: READ_BACK_SKIP.HEAVY },
            ],
        });
    });
    it('the heavy fact is asked before the knob probe (a heavy target is never rendered)', () => {
        const probed = [];
        readBackTarget(['heavy', 'bounce'], (id) => REG[id],
            { ...facts, knobMoves: (id, e) => { probed.push(id); return facts.knobMoves(id, e); } });
        expect(probed).toEqual(['bounce']);
    });
});

// ── moveReadBackKnob over a fake hook node (no DOM in this suite) ──
function fakeSelect(bag, key, values) {
    const listeners = [];
    const c = {
        tagName: 'SELECT', type: 'select-one', value: bag[key],
        options: values.map((value) => ({ value, disabled: false })),
        addEventListener: (_, f) => listeners.push(f),
        dispatchEvent: () => { listeners.forEach((f) => f()); return true; },
    };
    c.addEventListener('change', () => { bag[key] = c.value; });
    return c;
}
const nodeOf = (...controls) => ({ querySelectorAll: () => controls });

describe('moveReadBackKnob — the probe the row asserts', () => {
    it('moves the key the read-back names through the control that writes it', () => {
        const bag = { other: 'a', profile: 'x' };
        const node = nodeOf(fakeSelect(bag, 'other', ['a', 'b']), fakeSelect(bag, 'profile', ['x', 'y']));
        expect(moveReadBackKnob(REG.bounce, bag, node)).toEqual({ key: 'profile', from: 'x', to: 'y' });
        expect(bag).toEqual({ other: 'a', profile: 'y' }); // the other control was put back
    });
    it('a read-back that names no key → null, whatever the controls write', () => {
        const bag = { profile: 'x' };
        expect(readBackKeysOf(REG.undefinedKnob)).toEqual([]);
        expect(moveReadBackKnob(REG.undefinedKnob, bag, nodeOf(fakeSelect(bag, 'profile', ['x', 'y'])))).toBeNull();
    });
    it('a named key no control writes → null', () => {
        const bag = { other: 'a', profile: 'x' };
        expect(moveReadBackKnob(REG.bounce, bag, nodeOf(fakeSelect(bag, 'other', ['a', 'b'])))).toBeNull();
        expect(bag.other).toBe('a');
    });
});
