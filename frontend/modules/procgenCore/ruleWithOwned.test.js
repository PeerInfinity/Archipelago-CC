/**
 * procgenCore/ruleWithOwned — **A REWRITTEN RULE EVALUATES THE SAME** for every
 * inventory that holds the owned set (APWORLD SUBSTRATE CHANGE R3).
 *
 * ⛓⛓ THE PROPERTY, over a DERIVED population: every exit and location
 * `access_rule` of every slot of the four committed documents the arc probes
 * (the four-player fixture, `bounce_worldgen`, `procgen_topdown/AP_10`,
 * `jta_mixed_test`); owned sets = each single item the slot's rules NAME, and
 * every pair of them; inventories drawn by `sampleInventories` (seeded
 * `createRng`, `INVENTORIES_PER_OWNED_SET` per owned set: each named item held
 * 0–2 times, then raised to the owned multiplicity). The judge is the play-time
 * evaluator, `evaluateRule` (`shared/ruleEngine.js`), not a hand list.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluateRule } from '../shared/ruleEngine.js';
import { createRng } from '../shared/rng.js';
import { ownedCounts, ruleWithOwned } from './ruleWithOwned.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');
const DOCUMENTS = [
    'multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json',
    'bounce_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    'procgen_topdown/AP_10/AP_10_rules.json',
    'jta_mixed_test/AP_1/AP_1_rules.json',
];

/** ⛓ How many inventories the sampler draws per (slot, owned set). */
const INVENTORIES_PER_OWNED_SET = 24;
/** ⛓ The most copies of a named item a sampled inventory holds beyond the owned set. */
const MAX_HELD = 2;

/** Every item name a rule tree names (Has / HasAll / HasAny / any `item_name`). */
function namedItems(rule, out = new Set()) {
    if (Array.isArray(rule)) {
        for (const r of rule) namedItems(r, out);
    } else if (rule && typeof rule === 'object') {
        if (typeof rule.args?.item_name === 'string') out.add(rule.args.item_name);
        for (const k of ['items', 'item_names']) {
            if (Array.isArray(rule.args?.[k])) for (const n of rule.args[k]) if (typeof n === 'string') out.add(n);
        }
        for (const v of Object.values(rule)) if (v && typeof v === 'object') namedItems(v, out);
    }
    return out;
}

/** The slots of the four documents: `{doc, player, rules: [{endpoint, rule}], names}`. */
const SLOTS = DOCUMENTS.flatMap((rel) => {
    const doc = JSON.parse(readFileSync(join(PRESETS, rel), 'utf8'));
    return Object.entries(doc.regions ?? {}).map(([player, regions]) => {
        const rules = [];
        for (const [rn, r] of Object.entries(regions)) {
            for (const e of r.exits ?? []) if (e.access_rule) rules.push({ endpoint: `${rn} exit ${e.name}`, rule: e.access_rule });
            for (const l of r.locations ?? []) if (l.access_rule) rules.push({ endpoint: `${rn} location ${l.name}`, rule: l.access_rule });
        }
        return { doc: rel, player, rules, names: [...namedItems(rules.map((x) => x.rule))].sort() };
    });
});

/** The play-time evaluator's context, reduced to an inventory. */
const contextFor = (player, inventory) => ({
    _isSnapshotInterface: true,
    getPlayerId: () => player,
    hasItem: (n) => (inventory.get(n) ?? 0) > 0,
    countItem: (n) => inventory.get(n) ?? 0,
});

/** ⛓ THE SAMPLER: seeded, each named item held 0..MAX_HELD, raised to the owned multiplicity. */
function sampleInventories(names, owned, seed) {
    const rng = createRng(seed);
    const own = ownedCounts(owned);
    const out = [];
    for (let i = 0; i < INVENTORIES_PER_OWNED_SET; i += 1) {
        const inv = new Map();
        for (const n of names) inv.set(n, Math.floor(rng.next() * (MAX_HELD + 1)));
        for (const [n, c] of own) inv.set(n, Math.max(inv.get(n) ?? 0, c));
        out.push(inv);
    }
    return out;
}

const ownedSetsOf = (names) => [
    ...names.map((n) => [n]),
    ...names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b])),
];

describe('ruleWithOwned — the property over the committed documents', () => {
    it('⛓⛓ the population is derived and non-trivial (4 documents, rules in every one, names to own)', () => {
        expect(new Set(SLOTS.map((s) => s.doc)).size).toBe(DOCUMENTS.length);
        for (const rel of DOCUMENTS) {
            expect(SLOTS.filter((s) => s.doc === rel).reduce((n, s) => n + s.rules.length, 0)).toBeGreaterThan(0);
        }
        expect(SLOTS.some((s) => s.names.length >= 2)).toBe(true);
    });

    it.each(SLOTS.filter((s) => s.names.length).map((s) => [s.doc.split('/')[0], s.player, s]))(
        '⛓⛓⛓ %s slot %s: every rule, every owned single + pair, every sampled inventory — rewritten ≡ original',
        (_d, player, slot) => {
            let evaluations = 0;
            let rewrites = 0;
            let seed = 1;
            for (const owned of ownedSetsOf(slot.names)) {
                const invs = sampleInventories(slot.names, owned, seed);
                seed += 1;
                for (const { endpoint, rule } of slot.rules) {
                    const out = ruleWithOwned(rule, owned);
                    if (out.changed) rewrites += 1;
                    for (const inv of invs) {
                        const ctx = contextFor(player, inv);
                        const before = evaluateRule(rule, ctx);
                        expect(typeof before, `${endpoint}: the evaluator judged the ORIGINAL`).toBe('boolean');
                        expect(evaluateRule(out.rule, ctx), `${endpoint} owning [${owned}]`).toBe(before);
                        evaluations += 1;
                    }
                }
            }
            expect(evaluations).toBe(ownedSetsOf(slot.names).length * slot.rules.length * INVENTORIES_PER_OWNED_SET);
            // ⛓ The property is not vacuous: some owned set rewrote some rule in every slot that names items.
            expect(rewrites).toBeGreaterThan(0);
        },
    );
});

describe('ruleWithOwned — the constructs', () => {
    const has = (n, count) => ({ rule: 'Has', args: { item_name: n, ...(count ? { count } : {}) } });

    it('⛓ Has X owned → True_; not owned → the SAME object, changed 0', () => {
        expect(ruleWithOwned(has('A'), ['A'])).toEqual({ rule: { rule: 'True_' }, changed: 1, unmodelled: [] });
        const r = has('B');
        expect(ruleWithOwned(r, ['A']).rule).toBe(r);
    });

    it('⛓ Has X ×2 needs X owned twice — the starting list is a multiset', () => {
        const r = has('A', 2);
        expect(ruleWithOwned(r, ['A']).rule).toBe(r);
        expect(ruleWithOwned(r, ['A', 'A']).rule).toEqual({ rule: 'True_' });
    });

    it('⛓ HasAll minus owned: two left keeps the key, one left → Has, none → True_', () => {
        const r = { rule: 'HasAll', args: { item_names: ['A', 'B', 'C'] } };
        expect(ruleWithOwned(r, ['A']).rule).toEqual({ rule: 'HasAll', args: { item_names: ['B', 'C'] } });
        expect(ruleWithOwned(r, ['A', 'B']).rule).toEqual({ rule: 'Has', args: { item_name: 'C' } });
        expect(ruleWithOwned(r, ['A', 'B', 'C']).rule).toEqual({ rule: 'True_' });
    });

    it('⛓ HasAny with an owned name → True_', () => {
        expect(ruleWithOwned({ rule: 'HasAny', args: { items: ['A', 'B'] } }, ['B']).rule).toEqual({ rule: 'True_' });
    });

    it('⛓ And drops True_ children (empty → True_); Or is True_ when any child is — both child placements', () => {
        const and = { rule: 'And', children: [has('A'), has('B')] };
        expect(ruleWithOwned(and, ['A']).rule).toEqual({ rule: 'And', children: [has('B')] });
        expect(ruleWithOwned(and, ['A', 'B']).rule).toEqual({ rule: 'True_' });
        const or = { rule: 'Or', args: { rules: [has('A'), has('B')] } };
        expect(ruleWithOwned(or, ['B']).rule).toEqual({ rule: 'True_' });
        const nested = { rule: 'Or', children: [{ rule: 'HasAll', args: { items: ['A', 'C'] } }, has('B')] };
        expect(ruleWithOwned(nested, ['A']).rule)
            .toEqual({ rule: 'Or', children: [{ rule: 'Has', args: { item_name: 'C' } }, has('B')] });
    });

    it('⛓ Count / HasGroup / HasFromListUnique are returned UNCHANGED and named in unmodelled', () => {
        const count = { rule: 'Count', args: { item_name: 'A', count: 1 } };
        const out = ruleWithOwned({ rule: 'And', children: [count, { rule: 'HasGroup', args: { item_name_group: 'G' } }, has('A')] }, ['A']);
        expect(out.unmodelled).toEqual(['Count', 'HasGroup']);
        expect(out.rule.children[0]).toBe(count);
        const alone = ruleWithOwned({ rule: 'HasFromListUnique', args: { item_names: ['A'], count: 1 } }, ['A']);
        expect(alone).toMatchObject({ changed: 0, unmodelled: ['HasFromListUnique'] });
    });

    it('⛓ idempotent over the population: rewriting a rewritten rule changes nothing', () => {
        let checked = 0;
        for (const slot of SLOTS) {
            for (const owned of ownedSetsOf(slot.names)) {
                for (const { rule } of slot.rules) {
                    const once = ruleWithOwned(rule, owned).rule;
                    const twice = ruleWithOwned(once, owned);
                    expect(twice.changed).toBe(0);
                    expect(twice.rule).toBe(once);
                    checked += 1;
                }
            }
        }
        expect(checked).toBeGreaterThan(0);
    });
});
