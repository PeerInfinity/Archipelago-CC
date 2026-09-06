/**
 * `loopsCostDebugger/costDebuggerUI` — the panel's PURE rules.
 *
 * ⛓ L3 named it: this file had **no vitest file at all**, and its two
 * decision-making helpers (`_pricingOf`, and now L4's Send rule) were driven
 * only by an in-app row and its mutant. L4 opens it with the one thing that is
 * pure — `sendCostsRefusal` — and leaves the DOM halves to the in-app rows,
 * which is the same split `apworldEditor/hubExits.test.js` states for the hub.
 *
 * ⛔ Every row here is about a SENTENCE. The Send button is a boolean, and the
 * whole point of the rule is that a person needs to know WHICH of five states
 * they are in — so a row asserting only `!== null` would pass a panel that
 * always says the same thing.
 */

import { describe, expect, it } from 'vitest';

import { sendCostsRefusal } from './costDebuggerUI.js';

/** A planner with the two predicates the rule reads, and nothing else. */
function planner({ rejection = null, complete = true } = {}) {
    return {
        getPlanRejectionReason: () => rejection,
        isComplete: () => complete,
    };
}

const READY = { source: 'the APWorld editor', onSave: () => {} };

describe('sendCostsRefusal — L4', () => {
    it('⛓ a complete plan over a working copy that carries a return path can be sent', () => {
        expect(sendCostsRefusal({ workingCopy: READY, planner: planner() })).toBeNull();
    });

    it('⛔ APPLIED STATE has no document to write into, and the sentence says so', () => {
        const why = sendCostsRefusal({ workingCopy: null, planner: planner() });
        expect(why).toContain('APPLIED state');
        expect(why).toContain('APWorld editor');
    });

    /**
     * ⛔ A DIFFERENT sentence from the one above, and that is the row: a
     * hand-off that arrived without `onSave` (a pre-L4 caller, or a stash made
     * before the door carried one) is not the same problem as no hand-off, and
     * the fix is not the same either.
     */
    it('⛔ a working copy with NO return path is its own refusal, not the applied-state one', () => {
        const why = sendCostsRefusal({ workingCopy: { source: 'x' }, planner: planner() });
        expect(why).toContain('without a way back');
        expect(why).not.toContain('APPLIED state');
    });

    it('⛓⛓ a plan rejection is QUOTED — the planner\'s own sentence, not a summary', () => {
        const rejection = 'All 23 sphere-log locations are missing from this player\'s world '
            + '(player 1) — wrong player or wrong seed.';
        expect(sendCostsRefusal({ workingCopy: READY, planner: planner({ rejection }) }))
            .toBe(rejection);
    });

    /**
     * ⛔ The order is a claim. A planner that is BOTH rejected and incomplete
     * must quote the rejection: "press Plan All" is useless advice when Plan
     * All cannot run. (`getPlanRejectionReason()` also answers "No sphere log
     * loaded", which is why the rule has no separate `isLoaded()` clause.)
     */
    it('⛔ a rejection beats incompleteness — the advice must be actionable', () => {
        const rejection = 'No sphere log loaded.';
        expect(sendCostsRefusal({
            workingCopy: READY, planner: planner({ rejection, complete: false }),
        })).toBe(rejection);
    });

    it('⛓ an INCOMPLETE plan is refused, and it says why a partial block is wrong', () => {
        const why = sendCostsRefusal({
            workingCopy: READY, planner: planner({ complete: false }),
        });
        expect(why).toContain('INCOMPLETE');
        expect(why).toContain('Plan All');
        // ⛔ The consequence, not just the state: a partial plan's block prices
        //    some regions and silently falls back for the others.
        expect(why).toContain('falls back');
    });

    it('⛓ no planner at all is named as the module not being up, not as a bad plan', () => {
        expect(sendCostsRefusal({ workingCopy: READY, planner: null }))
            .toContain('loops module has not initialized');
    });

    it('⛓ called with nothing, it refuses rather than throwing', () => {
        expect(typeof sendCostsRefusal()).toBe('string');
    });
});
