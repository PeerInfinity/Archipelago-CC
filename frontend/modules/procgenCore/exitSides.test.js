/**
 * procgenCore/exitSides — **THE OCCUPIED-SIDE RULE** (PIPELINE RELAYOUT R2):
 * `sideMayHoldAnotherExit(entry)`, asked of hand-built declarations. The
 * registry-wide agreement row lives in `sidecarFieldsRegistry.test.js`, which
 * already loads every library; the op rows in `apworldEditor/exitSides.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { EXIT_SIDES_SLOT, SIDE_SHARING, sideMayHoldAnotherExit } from './exitSides.js';

const clone = (p) => structuredClone(p);

describe('⛓⛓ sideMayHoldAnotherExit — the three verdicts', () => {
    it('an EMPTY `keys` declaration: a side may hold another exit', () => {
        const entry = { [EXIT_SIDES_SLOT]: { keys: [], relabel: clone } };
        expect(sideMayHoldAnotherExit(entry)).toEqual({ may: true, reason: SIDE_SHARING.SIDE_AGNOSTIC });
    });

    it('a KEYED declaration: it may not, and the verdict names the keys that hold one value per side', () => {
        const entry = { [EXIT_SIDES_SLOT]: { keys: ['params.sidePortals', 'params.backExitSide'], relabel: clone } };
        expect(sideMayHoldAnotherExit(entry)).toEqual({
            may: false, reason: SIDE_SHARING.KEYED, keys: ['params.sidePortals', 'params.backExitSide'],
        });
    });

    it('an ABSENT declaration: it may not — for the absence, a reason distinct from a keyed one', () => {
        expect(sideMayHoldAnotherExit({ id: 'x' })).toEqual({ may: false, reason: SIDE_SHARING.ABSENT });
        expect(sideMayHoldAnotherExit(undefined)).toEqual({ may: false, reason: SIDE_SHARING.ABSENT });
    });

    it('a MALFORMED declaration: it may not, and the reader\'s words ride along', () => {
        const got = sideMayHoldAnotherExit({ [EXIT_SIDES_SLOT]: { keys: 'params.sidePortals', relabel: clone } });
        expect(got.may).toBe(false);
        expect(got.reason).toBe(SIDE_SHARING.MALFORMED);
        expect(got.malformed).toMatch(/^its `exitSides.keys` is "params.sidePortals", not a list/);
    });

    it('every reason is a distinct word', () => {
        expect(new Set(Object.values(SIDE_SHARING)).size).toBe(Object.keys(SIDE_SHARING).length);
    });
});
