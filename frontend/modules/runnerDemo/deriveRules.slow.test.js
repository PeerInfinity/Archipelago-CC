/**
 * deriveRules FULL-GRAPH agreement (plan §4.4) — the layered strip flood
 * (reachableRunPlatforms) must yield derive-identical rules to the full N²
 * graph on every fixture. Split out of deriveRules.test.js by the test-
 * strategy rebalance §1: the glideDrop (~15 s) and shieldBed (~7 s) full-
 * graph derives blow the default suite's 10 s ceiling. The reach-set identity
 * this depends on is the frozen canRun.slow.test.js corpus; this is its
 * stronger end-to-end derive-level twin.
 */

import { describe, it, expect } from 'vitest';
import { deriveAccessRules } from './deriveRules.js';
import { reachableRunPlatforms } from './canRun.js';
import { FIXTURES } from './fixtures.js';

describe('injectable reach: layered strip flood agrees with the full graph', () => {
    // reachableRunPlatforms claims VERDICT-IDENTITY with the full
    // N² flood on AUTO_RUN levels (canRun.js) — so the whole derive
    // must agree on every fixture, not merely over-state.
    for (const f of FIXTURES) {
        it(`${f.id}: identical minimal sets and defects`, () => {
            const full = deriveAccessRules(f);
            const layered = deriveAccessRules(f, { reach: reachableRunPlatforms });
            expect(layered.pickups).toEqual(full.pickups);
            expect(layered.exits).toEqual(full.exits);
            expect(layered.defects).toEqual(full.defects);
        });
    }
});
