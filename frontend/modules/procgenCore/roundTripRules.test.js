/**
 * procgenCore/roundTripRules — the `regionRoundTrip.rules` vocabulary and its
 * ONE reader (PRESET SIDECARS G2b-1).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DEFAULT_ROUND_TRIP_RULES, ROUND_TRIP_RULES, ROUND_TRIP_RULE_SOURCES, roundTripRulesOf,
} from './roundTripRules.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('roundTripRulesOf — where a round trip says its rules come from', () => {
    it('⛓ the vocabulary is closed and the default is DERIVED', () => {
        expect(ROUND_TRIP_RULE_SOURCES).toEqual(Object.values(ROUND_TRIP_RULES));
        expect(Object.isFrozen(ROUND_TRIP_RULES)).toBe(true);
        expect(DEFAULT_ROUND_TRIP_RULES).toBe(ROUND_TRIP_RULES.DERIVED);
    });

    it('⛓ absent at every level reads as the default — entry, round trip, member', () => {
        expect(roundTripRulesOf(undefined)).toBe(DEFAULT_ROUND_TRIP_RULES);
        expect(roundTripRulesOf({ id: 'x' })).toBe(DEFAULT_ROUND_TRIP_RULES);
        expect(roundTripRulesOf({ id: 'x', regionRoundTrip: { open() {}, save() {} } }))
            .toBe(DEFAULT_ROUND_TRIP_RULES);
    });

    it('⛓ every declared value reads as itself', () => {
        for (const v of ROUND_TRIP_RULE_SOURCES) {
            expect(roundTripRulesOf({ id: 'x', regionRoundTrip: { rules: v } })).toBe(v);
        }
    });

    it('⛔ a value outside the vocabulary is REFUSED BY NAME — never read as derived', () => {
        for (const bad of ['Authored', 'geometry', null, true, 0]) {
            expect(() => roundTripRulesOf({ id: 'sub_x', regionRoundTrip: { rules: bad } }))
                .toThrow(new RegExp(`substrate 'sub_x' declares ${JSON.stringify(bad)?.replace(/[()]/g, '\\$&')} — not one of`));
        }
    });

    it('⛔ the module imports nothing — a library declares with it and the hub reads it', () => {
        const src = readFileSync(join(HERE, 'roundTripRules.js'), 'utf8');
        expect(src).not.toMatch(/^\s*import\s/m);
    });
});
