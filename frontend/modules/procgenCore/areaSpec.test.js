/**
 * procgenCore/areaSpec.test — THE ONE CODEC, driven the way slice 7 drove the
 * skeleton one.
 *
 * ⛓⛓ **LITERAL EXPECTED STRINGS, NOT ONLY A FIXED POINT** (traps 250 / 269).
 * `format(parse(s)) === s` tests SELF-CONSISTENCY and nothing else: a codec
 * that dropped every parameter on both sides would satisfy it perfectly. So
 * every round-trip row below is paired with a row that says what the string
 * IS, and every parse row with a row that says what the OBJECT is.
 */

import { describe, expect, it } from 'vitest';
import {
    AREA_PARAM_SCHEMA, AreaSpecError, DEFAULT_AREAS, KEYS_DOMAIN, enumerateAreaValues,
    formatAreaSpec, normalizeAreaSpec, parseAreaSpec, resolveAreaSpec,
} from './areaSpec.js';

describe('procgenCore/areaSpec — the defaults', () => {
    it('⛓ the default is `{keys: 0}` and NOTHING ELSE — the off switch', () => {
        expect(DEFAULT_AREAS).toEqual({ keys: 0 });
        expect(formatAreaSpec(DEFAULT_AREAS)).toBe('0');
        expect(normalizeAreaSpec(undefined)).toEqual({ keys: 0 });
    });

    it('resolve fills every declared value; normalize STRIPS the ones at default', () => {
        expect(resolveAreaSpec({ keys: 1 }))
            .toEqual({ keys: 1, partition: 'chambers', graphify: 0.2, goalShortcut: 1 });
        expect(normalizeAreaSpec({ keys: 1 })).toEqual({ keys: 1 });
        expect(normalizeAreaSpec({ keys: 1, params: { graphify: 0.2 } })).toEqual({ keys: 1 });
    });

    it('the schema declares exactly the three knobs, and the domains are the swept ones', () => {
        expect(AREA_PARAM_SCHEMA.map((p) => p.key))
            .toEqual(['partition', 'graphify', 'goalShortcut']);
        expect(AREA_PARAM_SCHEMA.find((p) => p.key === 'partition').domain).toEqual(['chambers']);
        expect(KEYS_DOMAIN).toEqual([0, 1, 2, 3]);
        // ⚖ ruling 4: a domain nobody can enumerate is a domain nobody swept.
        expect(enumerateAreaValues().length).toBe(1 * 4 * 2);
    });
});

describe('procgenCore/areaSpec — format writes the LITERAL string', () => {
    const cases = [
        [{ keys: 0 }, '0'],
        [{ keys: 1 }, '1'],
        [{ keys: 3 }, '3'],
        [{ keys: 1, params: { graphify: 0.5 } }, '1;graphify=0.5'],
        [{ keys: 2, params: { goalShortcut: 0 } }, '2;goalShortcut=0'],
        [{ keys: 2, params: { graphify: 1, goalShortcut: 0 } }, '2;graphify=1;goalShortcut=0'],
        // ⛔ a value AT its default is spelled by ABSENCE, exactly once.
        [{ keys: 2, params: { partition: 'chambers', graphify: 0.2, goalShortcut: 1 } }, '2'],
    ];
    for (const [spec, text] of cases) {
        it(`${JSON.stringify(spec)} -> "${text}"`, () => {
            expect(formatAreaSpec(spec)).toBe(text);
        });
    }

    it('⛓ keys are emitted in DECLARATION order, never in the caller\'s', () => {
        expect(formatAreaSpec({ keys: 1, params: { goalShortcut: 0, graphify: 0.5 } }))
            .toBe('1;graphify=0.5;goalShortcut=0');
    });
});

describe('procgenCore/areaSpec — parse reads the LITERAL object', () => {
    const cases = [
        ['0', { keys: 0 }],
        ['1', { keys: 1 }],
        ['1;graphify=0.5', { keys: 1, params: { graphify: 0.5 } }],
        ['2;goalShortcut=0', { keys: 2, params: { goalShortcut: 0 } }],
        ['3;partition=chambers', { keys: 3 }],
        [' 2 ; graphify = 1 ', { keys: 2, params: { graphify: 1 } }],
    ];
    for (const [text, spec] of cases) {
        it(`"${text}" -> ${JSON.stringify(spec)}`, () => {
            expect(parseAreaSpec(text)).toEqual(spec);
        });
    }

    it('⚠ values carry the domain\'s OWN TYPE — the number 0.5, never the string', () => {
        const parsed = parseAreaSpec('1;graphify=0.5;goalShortcut=0');
        expect(parsed.params.graphify).toBe(0.5);
        expect(typeof parsed.params.graphify).toBe('number');
        expect(parsed.params.goalShortcut).toBe(0);
        expect(typeof parsed.params.goalShortcut).toBe('number');
    });

    it('the ROUND TRIP is a fixed point — ⚠ and this row alone proves nothing', () => {
        for (const text of ['0', '1', '2;graphify=0.5', '3;graphify=1;goalShortcut=0']) {
            expect(formatAreaSpec(parseAreaSpec(text))).toBe(text);
        }
    });
});

describe('procgenCore/areaSpec — SIX distinguished refusals, each actionable', () => {
    const refuses = (text, pattern) => {
        expect(() => parseAreaSpec(text)).toThrow(AreaSpecError);
        expect(() => parseAreaSpec(text)).toThrow(pattern);
    };

    it('a head that is not a declared key count', () => {
        refuses('rooms', /the head of an area spec is the KEY COUNT/);
        refuses('9', /the KEY COUNT — one of \[0, 1, 2, 3\]/);
        refuses('', /the head of an area spec is the KEY COUNT/);
    });

    it('a clause that is not `key=value`', () => refuses('1;graphify', /is not `key=value`/));
    it('an EMPTY clause', () => refuses('1;;graphify=1', /EMPTY parameter clause/));
    it('a DUPLICATED key', () => refuses('1;graphify=1;graphify=0', /names "graphify" TWICE/));
    it('a key the spec does not declare', () => {
        refuses('1;chambers=2', /has no parameter "chambers"/);
        refuses('1;chambers=2', /\[partition, graphify, goalShortcut\]/);
    });
    it('a value outside a declared domain', () => {
        refuses('1;graphify=0.7', /not in its declared domain \[0, 0.2, 0.5, 1\]/);
    });

    it('⛓ `partition=grid` refuses WITH THE CENSUS LINE that says why it is not declared', () => {
        refuses('1;partition=grid', /not in its declared domain \[chambers\]/);
        refuses('1;partition=grid', /`rooms` yields 3-8 areas on the default 11x11 room/);
    });

    it('an out-of-domain `keys` refuses through the OBJECT path too, not only the string', () => {
        expect(() => resolveAreaSpec({ keys: 7 })).toThrow(/declared domain \[0, 1, 2, 3\]/);
        expect(() => resolveAreaSpec({ keys: 1, params: { nope: 1 } }))
            .toThrow(/has no parameter "nope"/);
    });
});
