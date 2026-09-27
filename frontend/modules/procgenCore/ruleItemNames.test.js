/**
 * procgenCore/ruleItemNames — the item names a rule references (APWORLD
 * SUBSTRATE CHANGE B1, plan §26.8 #1).
 *
 * ⛓ The shapes are DERIVED from the committed documents (every `_rules.json`
 * under `frontend/presets`, every player), not listed: a raw scan finds every
 * rule node carrying an item-name arg, and each is asked of the walker. The
 * verdict the walker serves — `validateRules`' `unknown item` — is the cross
 * check: over the same corpus, every name it flags is one `undefinedRuleItems`
 * flags too.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    ITEM_LIST_KEYS, ITEM_NAME_KEYS, TYPED_ITEM_CHECK,
    itemNamesInDocument, itemNamesInRule, itemReferencesInDocument, undefinedRuleItems,
} from './ruleItemNames.js';
import { validateRules } from '../apworldEditor/rulesUtils.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const has = (item_name) => ({ rule: 'Has', args: { item_name } });

describe('itemNamesInRule — one rule', () => {
    it('reads a name under item_name / item, a list under item_names / items, and the typed item_check', () => {
        expect(itemNamesInRule(has('A'))).toEqual(['A']);
        expect(itemNamesInRule({ rule: 'AnyKind', args: { item: 'B' } })).toEqual(['B']);
        expect(itemNamesInRule({ rule: 'HasAll', args: { item_names: ['C', 'D'] } })).toEqual(['C', 'D']);
        expect(itemNamesInRule({ rule: 'HasFromListUnique', args: { items: ['E'], count: 1 } })).toEqual(['E']);
        expect(itemNamesInRule({ type: TYPED_ITEM_CHECK, item: 'F' })).toEqual(['F']);
    });

    it('an item that is an EXPRESSION names nothing literally; nothing, null, True_ → []', () => {
        expect(itemNamesInRule({ type: TYPED_ITEM_CHECK, item: { type: 'name', name: 'x' } })).toEqual([]);
        expect(itemNamesInRule(null)).toEqual([]);
        expect(itemNamesInRule(undefined)).toEqual([]);
        expect(itemNamesInRule({ rule: 'True_' })).toEqual([]);
        // a rule whose args are a LIST (helpers) carries no keyed name
        expect(itemNamesInRule({ rule: 'some_helper', args: ['G'] })).toEqual([]);
    });

    it('walks every nesting — children, args.rules, Not.condition, Compare sides, a rule-valued count — once each, first reference first', () => {
        const rule = {
            rule: 'Or',
            children: [
                { rule: 'And', args: { rules: [has('A'), has('B')] } },
                { rule: 'Not', args: { condition: has('C') } },
                { rule: 'Compare', args: { left: { rule: 'CountItem', args: { item_name: 'D' } }, right: 3 } },
                { rule: 'Has', args: { item_name: 'A', count: { rule: 'Has', args: { item_name: 'E' } } } },
                { type: 'and', conditions: [{ type: TYPED_ITEM_CHECK, item: 'F' }] },
            ],
        };
        expect(itemNamesInRule(rule)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });
});

describe('itemReferencesInDocument / undefinedRuleItems — one document', () => {
    const doc = {
        regions: {
            1: {
                R1: {
                    name: 'R1',
                    exits: [{ name: 'e1', connected_region: 'R2', access_rule: has('Late') }],
                    locations: [{ name: 'l1', access_rule: has('Defined'), item_rule: has('Ruled') }],
                },
                R2: {
                    name: 'R2',
                    exits: [{ name: 'e2', connected_region: 'R1', access_rule: has('Late') }],
                    locations: [],
                },
            },
        },
        items: { 1: { Defined: { name: 'Defined', id: 1 } } },
        game_info: { 1: { completion_condition: { type: TYPED_ITEM_CHECK, item: 'Goal' } } },
    };

    it('document order: region by region, exits before locations (access then item_rule), the completion condition last; a name per reference', () => {
        expect(itemReferencesInDocument(doc, '1')).toEqual([
            { name: 'Late', regionName: 'R1', exitName: 'e1' },
            { name: 'Defined', regionName: 'R1', locationName: 'l1' },
            { name: 'Ruled', regionName: 'R1', locationName: 'l1', fieldName: 'item_rule' },
            { name: 'Late', regionName: 'R2', exitName: 'e2' },
            { name: 'Goal', completion: true },
        ]);
        expect(itemNamesInDocument(doc, '1')).toEqual(['Late', 'Defined', 'Ruled', 'Goal']);
    });

    it('undefinedRuleItems: the FIRST reference of each name items[p] lacks', () => {
        expect(undefinedRuleItems(doc, '1')).toEqual([
            { name: 'Late', regionName: 'R1', exitName: 'e1' },
            { name: 'Ruled', regionName: 'R1', locationName: 'l1', fieldName: 'item_rule' },
            { name: 'Goal', completion: true },
        ]);
        expect(undefinedRuleItems({ ...doc, items: { 1: { Late: {}, Ruled: {}, Goal: {}, Defined: {} } } }, '1'))
            .toEqual([]);
    });
});

describe('the corpus — every committed document, every player', () => {
    const files = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    const docs = files.map((f) => ({ f, doc: JSON.parse(readFileSync(join(ROOT, f), 'utf8')) }));

    /** An INDEPENDENT raw scan: every node (anywhere under a rule) with a rule
     *  kind and an item-bearing arg, or the typed check; its shape + own names. */
    function rawNodes(rule, out) {
        if (Array.isArray(rule)) { for (const x of rule) rawNodes(x, out); return; }
        if (!rule || typeof rule !== 'object') return;
        if (typeof rule.rule === 'string' && rule.args && !Array.isArray(rule.args)) {
            for (const key of [...ITEM_NAME_KEYS, ...ITEM_LIST_KEYS]) {
                const v = rule.args[key];
                const names = typeof v === 'string' ? [v] : (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
                if (names.length) out.push({ shape: `${rule.rule}.${key}`, names, node: rule });
            }
        }
        if (rule.type === TYPED_ITEM_CHECK && typeof rule.item === 'string') {
            out.push({ shape: `type:${TYPED_ITEM_CHECK}.item`, names: [rule.item], node: rule });
        }
        for (const v of Object.values(rule)) rawNodes(v, out);
    }

    it('⛓ every shape the corpus carries is walked — each node\'s own names come back from itemNamesInRule', () => {
        const shapes = new Map();
        for (const { f, doc } of docs) {
            for (const [p, regions] of Object.entries(doc.regions ?? {})) {
                const nodes = [];
                for (const r of Object.values(regions ?? {})) {
                    for (const e of r.exits ?? []) rawNodes(e.access_rule, nodes);
                    for (const l of r.locations ?? []) { rawNodes(l.access_rule, nodes); rawNodes(l.item_rule, nodes); }
                }
                rawNodes(doc.game_info?.[p]?.completion_condition, nodes);
                for (const { shape, names, node } of nodes) {
                    shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
                    const walked = itemNamesInRule(node);
                    for (const n of names) expect(walked, `${f} ${p} ${shape}`).toContain(n);
                }
            }
        }
        // ⛓ QUOTED at the slice (2026-09-27, 217 files): 10 rule-kind/arg shapes
        // (Has, CountItem .item_name; HasAll, HasAny, HasFromList,
        // HasFromListUnique, CountFromList .item_names; HasFromListUnique .items;
        // AST_count_item, AST_placement_search .item) + the typed item_check.
        // A new shape is walked already when it rides one of the keys; this
        // count reds so its arrival is READ, not assumed.
        expect([...shapes.keys()].sort()).toHaveLength(11);
    });

    it('⛓ the verdict agrees: every `unknown item` validateRules raises on a committed document is one undefinedRuleItems names', () => {
        let flagged = 0;
        for (const { f, doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                // (the pool's own `unknown item` is not a rule's — excluded)
                const unknown = new Set(validateRules(doc, p).filter((i) => !i.message.startsWith('Item pool'))
                    .map((i) => i.message.match(/unknown item "(.*)"\.?$/)?.[1]).filter(Boolean));
                const ours = new Set(undefinedRuleItems(doc, p).map((r) => r.name));
                for (const n of unknown) expect(ours.has(n), `${f} ${p}: ${n}`).toBe(true);
                flagged += unknown.size;
            }
        }
        // the row asks a population, not an empty set: the corpus has some
        expect(flagged).toBeGreaterThan(0);
    });
});
