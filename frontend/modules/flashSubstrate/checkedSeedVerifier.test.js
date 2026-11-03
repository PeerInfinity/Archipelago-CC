import { describe, it, expect } from 'vitest';
import { createCheckedSeedVerifier } from './checkedSeedVerifier.js';

const payload = { region_id: 'region_2_2' };

describe('checkedSeedVerifier — a configure seeded from the previous world is re-run once, a healthy one never', () => {
    it('(a) a healthy revisit (the host has every seeded name) never reconfigures', () => {
        const v = createCheckedSeedVerifier();
        v.configured(payload, ['loc_0', 'loc_1']);
        expect(v.snapshot(new Set(['loc_0', 'loc_1', 'loc_9']))).toBe(null);
        expect(v.isArmed()).toBe(false);
        // the same host losing them later decides nothing either
        expect(v.snapshot(new Set())).toBe(null);
    });

    it('an empty seed is never armed (a fresh world, a Seedling visit with nothing checked)', () => {
        const v = createCheckedSeedVerifier();
        v.configured(payload, []);
        expect(v.isArmed()).toBe(false);
        expect(v.snapshot(new Set())).toBe(null);
    });

    it('(b) a stale seed reconfigures exactly ONCE, then never again', () => {
        const v = createCheckedSeedVerifier();
        v.configured(payload, ['loc_0']);
        expect(v.snapshot(new Set())).toEqual({ payload, stale: ['loc_0'] });
        // the bridge re-runs configure from the fresh snapshot: not re-armed, whatever it was seeded with
        v.configured(payload, ['loc_0'], { reconfigure: true });
        expect(v.isArmed()).toBe(false);
        expect(v.snapshot(new Set())).toBe(null);
        expect(v.snapshot(new Set())).toBe(null);
    });

    it('(c) only the FIRST snapshot after a configure decides: a host change after it never reseeds', () => {
        const v = createCheckedSeedVerifier();
        v.configured(payload, ['loc_0']);
        expect(v.snapshot(new Set(['loc_0']))).toBe(null);
        expect(v.snapshot(new Set())).toBe(null);
    });

    it('(d) loop reset: checks cleared AFTER the confirming snapshot → no reconfigure; cleared BEFORE it → once (the host really lacks them)', () => {
        const after = createCheckedSeedVerifier();
        after.configured(payload, ['R__clear']);
        expect(after.snapshot(new Set(['R__clear']))).toBe(null);
        expect(after.snapshot(new Set())).toBe(null);            // the reset's snapshot

        const before = createCheckedSeedVerifier();
        before.configured(payload, ['R__clear']);
        expect(before.snapshot(new Set())).toEqual({ payload, stale: ['R__clear'] });
        before.configured(payload, [], { reconfigure: true });
        expect(before.snapshot(new Set())).toBe(null);
    });

    it('a new loadRegion re-arms (each configure is verified by its own first snapshot)', () => {
        const v = createCheckedSeedVerifier();
        v.configured(payload, ['loc_0']);
        v.configured({ region_id: 'region_2_3' }, ['loc_5']);
        expect(v.snapshot(new Set(['loc_0']))).toEqual({ payload: { region_id: 'region_2_3' }, stale: ['loc_5'] });
    });
});
