/**
 * procgenCore/deepEqualKeyOrder — **THE HOIST, AND THE PROOF IT IS BYTE-INERT**
 * (EDITOR INTEGRATION slice B-c; plan §15.11's ONE decision).
 *
 * ⛔ THE ROW THAT MATTERS IS NOT THE BEHAVIOUR ONE. Two adapters already ship
 * this predicate under their own names and their own test files pin it; what a
 * hoist can break is the CLAIM that the three are one function. So the last
 * describe block asserts IDENTITY — `atlasesEqual === deepEqualKeyOrder` and
 * `levelsEqual === deepEqualKeyOrder` — which a copy that drifted back would
 * fail even while every behavioural row stayed green.
 */

import { describe, expect, it } from 'vitest';

import { deepEqualKeyOrder } from './deepEqualKeyOrder.js';
import { canonicalJson } from './editCore.js';
import { atlasesEqual } from '../regionMarkingTool/atlasEditAdapter.js';
import { levelsEqual } from '../bounceRegionEditor/bounceEditAdapter.js';

describe('the equality itself', () => {
    it('is true of a value against ITSELF and against a JSON round trip', () => {
        const doc = { game_name: 'x', regions: { 1: { hall: { name: 'hall', exits: [] } } } };
        expect(deepEqualKeyOrder(doc, doc)).toBe(true);
        expect(deepEqualKeyOrder(doc, JSON.parse(JSON.stringify(doc)))).toBe(true);
    });

    /**
     * ⛓⛓⛓ **THE DISCRIMINATOR — and the mutant it reds is "`equal` via
     * `canonicalJson`".** Two documents differing ONLY in key order are NOT
     * equal here, and ARE equal under the core's canonical text. A single row
     * asserting both directions is what makes the difference between the two
     * functions a measurement rather than a claim in a header.
     */
    it('⛓⛓ KEY ORDER IS CONTENT — and canonicalJson says the opposite', () => {
        const a = { game_name: 'x', schema_version: 2 };
        const b = { schema_version: 2, game_name: 'x' };
        expect(deepEqualKeyOrder(a, b)).toBe(false);
        expect(canonicalJson(a)).toBe(canonicalJson(b));   // the mutant's answer
    });

    it('⛓ key order is content at DEPTH, not only at the top', () => {
        const a = { regions: { 1: { hall: { name: 'hall', exits: [] } } } };
        const b = { regions: { 1: { hall: { exits: [], name: 'hall' } } } };
        expect(deepEqualKeyOrder(a, b)).toBe(false);
    });

    it('tells arrays from objects, and length from content', () => {
        expect(deepEqualKeyOrder([1], { 0: 1 })).toBe(false);
        expect(deepEqualKeyOrder([1, 2], [1])).toBe(false);
        expect(deepEqualKeyOrder([1, 2], [1, 2])).toBe(true);
        expect(deepEqualKeyOrder([{ a: 1 }], [{ a: 2 }])).toBe(false);
    });

    it('⚠ `undefined` is a KEY, not an absence', () => {
        expect(deepEqualKeyOrder({ a: 1 }, { a: 1, b: undefined })).toBe(false);
        expect(deepEqualKeyOrder({ a: 1, b: null }, { a: 1 })).toBe(false);
    });

    it('handles primitives and null without an object walk', () => {
        expect(deepEqualKeyOrder(null, null)).toBe(true);
        expect(deepEqualKeyOrder(null, {})).toBe(false);
        expect(deepEqualKeyOrder(1, '1')).toBe(false);
        expect(deepEqualKeyOrder(NaN, NaN)).toBe(false);   // `===`, deliberately
    });

    /**
     * ⛓ THE `a === b` FAST PATH IS REACHED AT DEPTH, which is the property the
     * copy-on-write op modules are built on: a shared subtree costs one
     * reference comparison. A cyclic value proves the walk never entered it.
     */
    it('⛓ a SHARED subtree short-circuits — asserted with a cycle the walk cannot survive', () => {
        const shared = { deep: {} };
        shared.deep.self = shared;                          // a walk here would not return
        expect(deepEqualKeyOrder({ k: shared }, { k: shared })).toBe(true);
    });
});

/**
 * ⛓⛓⛓ **THE HOIST IS THE SAME FUNCTION, NOT THE SAME BEHAVIOUR.** Both
 * adapters re-export it under the name their own files and tests already use.
 */
describe('the two existing adapters use THIS function', () => {
    it('atlasesEqual IS deepEqualKeyOrder', () => {
        expect(atlasesEqual).toBe(deepEqualKeyOrder);
    });

    it('levelsEqual IS deepEqualKeyOrder', () => {
        expect(levelsEqual).toBe(deepEqualKeyOrder);
    });
});
