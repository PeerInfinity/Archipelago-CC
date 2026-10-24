/**
 * procgenCore/rulesGraph.ruleTreeSlots — THE WALKER, WIDENED TO EVERY RULE-VALUED
 * SLOT (APWORLD SUBSTRATE CHANGE T1; plan §30.7 #3, trap 1450).
 *
 * Before T1 `walkRuleTree` recursed `children` and a `Compare`'s `args.left` /
 * `args.right` only, so every sub-rule under `Conditional.args.test`,
 * `Not.args.condition`, `And.args.rules`, `Has.args.count`, a helper call's
 * positional `args` array or its `kwargs` was invisible to `validateRules`, to
 * the rename cascades and to `ruleTreeOps`' paths. It now walks every slot
 * `ruleTreeSlots` names — recognised by SHAPE (a rule node inside `args` /
 * `kwargs`), never by rule kind.
 *
 * ⛓ The corpus rows read every committed `_rules.json` under
 * `frontend/presets`, every player, every exit / location access rule and
 * item rule.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    RULE_SLOT_CONTAINERS, isRuleNode, ruleTreeSlots, walkRuleTree, walkRulesGraph,
} from './rulesGraph.js';
import { getRuleAt, removeRuleAt, replaceRuleAt, ruleTreePaths } from './ruleTreeOps.js';
import { ownItemNames, undefinedRuleItems, itemNamesInRule } from './ruleItemNames.js';
import {
    renameItemInRules, renameLocationInRules, renameRegionInRules, validateRules,
} from '../apworldEditor/rulesUtils.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const has = (item_name) => ({ rule: 'Has', args: { item_name } });

/** One node carrying a sub-rule in every step family, in the documented order. */
const fixture = () => ({
    rule: 'AnyKind',
    children: [has('C0')],
    args: {
        test: has('T'),
        rules: [has('L0'), 3, has('L1')],
        count: 2,
        data: { type: 'item_check', item: 'typed — data, not a slot' },
    },
    kwargs: { flag: has('K'), list: [has('KL')] },
});

describe('ruleTreeSlots — the slots, by shape', () => {
    it('children, then args.<key> / args.<key>[i], then kwargs — keys in document order', () => {
        expect(ruleTreeSlots(fixture()).map(([step]) => step)).toEqual([
            0, 'args.test', 'args.rules[0]', 'args.rules[2]', 'kwargs.flag', 'kwargs.list[0]',
        ]);
        expect(RULE_SLOT_CONTAINERS).toEqual(['args', 'kwargs']);
    });

    it('a positional args ARRAY is walked as args[i]; a non-rule element is not a slot', () => {
        const call = { rule: 'someHelper', args: [{ rule: 'Constant', args: { value: 5 } }, 'x', has('A')] };
        expect(ruleTreeSlots(call).map(([s]) => s)).toEqual(['args[0]', 'args[2]']);
    });

    it('⛔ an ARRAY operand is data, not a node — the 157 trees that threw before T1', () => {
        // the corpus shape: `Compare(left: <rule>, op: 'in', right: ['easy', 'default'])`
        const t = { rule: 'Compare', args: { left: has('A'), op: 'in', right: ['easy', 'default'] } };
        const visited = [];
        walkRuleTree(t, (n) => visited.push(n));
        expect(visited.every(isRuleNode)).toBe(true);
        expect(() => ruleTreePaths(t)).not.toThrow();
        expect(ruleTreePaths(t).map((p) => p.path)).toEqual([[], ['args.left']]);
    });

    it('every step ruleTreePaths names addresses its node through getRuleAt', () => {
        const t = fixture();
        const paths = ruleTreePaths(t);
        expect(paths).toHaveLength(7);
        for (const { node, path } of paths) expect(getRuleAt(t, path)).toBe(node);
    });

    it('replaceRuleAt writes through each new step family, copy-on-write', () => {
        const t = fixture();
        const before = JSON.stringify(t);
        for (const step of ['args.test', 'args.rules[2]', 'kwargs.flag', 'kwargs.list[0]']) {
            const r = replaceRuleAt(t, [step], has('NEW'));
            expect(r.ok, step).toBe(true);
            expect(getRuleAt(r.tree, [step])).toEqual(has('NEW'));
            expect(JSON.stringify(t), step).toBe(before);
        }
        const call = { rule: 'h', args: [has('A'), has('B')] };
        const r = replaceRuleAt(call, ['args[1]'], has('Z'));
        expect(r.tree).toEqual({ rule: 'h', args: [has('A'), has('Z')] });
        // a list-valued arg keeps its non-rule members where they were
        expect(replaceRuleAt(t, ['args.rules[0]'], has('Q')).tree.args.rules).toEqual([has('Q'), 3, has('L1')]);
    });

    it('a named slot cannot be removed — replace it instead; a non-rule value is refused by name', () => {
        expect(removeRuleAt(fixture(), ['args.test']).error).toMatch(/cannot be removed — an operand slot is always filled/);
        expect(getRuleAt(fixture(), ['args.count'])).toBeNull();
        expect(getRuleAt(fixture(), ['args.data'])).toBeNull();
        expect(getRuleAt(fixture(), ['args.rules[1]'])).toBeNull();
    });
});

describe('the corpus — every committed document, every player', () => {
    const files = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    const docs = files.map((f) => ({ f, doc: JSON.parse(readFileSync(join(ROOT, f), 'utf8')) }));
    const treesOf = (doc, p) => {
        const out = [];
        walkRulesGraph(doc, p, {
            exit: (e) => out.push(e?.access_rule),
            location: (l) => { out.push(l?.access_rule); if (l?.item_rule) out.push(l.item_rule); },
        });
        return out.filter((t) => t && typeof t === 'object');
    };

    /** An INDEPENDENT raw scan: every rule node reachable through ANY object
     *  value, with the step family it sits in relative to its rule parent. */
    function rawRuleNodes(tree) {
        const out = [];
        const visit = (v, family) => {
            if (Array.isArray(v)) { for (const x of v) visit(x, family); return; }
            if (!v || typeof v !== 'object') return;
            if (isRuleNode(v)) out.push({ node: v, family });
            for (const [k, x] of Object.entries(v)) {
                if (!isRuleNode(v)) { visit(x, family); continue; }
                if (k === 'children') visit(x, 'children');
                else if (Array.isArray(x)) visit(x, `${k}[i]`);
                else if (x && typeof x === 'object' && !isRuleNode(x)) {
                    for (const [ak, ax] of Object.entries(x)) visit(ax, Array.isArray(ax) ? `${k}.<key>[i]` : `${k}.<key>`);
                } else visit(x, k);
            }
        };
        visit(tree, 'root');
        return out;
    }

    it('⛓ THE SLOT CENSUS: every rule node the raw scan finds, the walker visits — in every family the corpus carries', () => {
        const families = new Map();
        let raw = 0;
        for (const { f, doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                for (const t of treesOf(doc, p)) {
                    const seen = new Set();
                    walkRuleTree(t, (n) => seen.add(n));
                    for (const { node, family } of rawRuleNodes(t)) {
                        raw += 1;
                        families.set(family, (families.get(family) ?? 0) + 1);
                        expect(seen.has(node), `${f} ${p}: a ${node.rule} under ${family}`).toBe(true);
                    }
                }
            }
        }
        // ⛓ QUOTED at T1 (2026-09-27, 217 files): the six families below; a new
        //   family reds here so its arrival is READ. (90,989 rule nodes then.)
        expect([...families.keys()].sort()).toEqual(
            ['args.<key>', 'args.<key>[i]', 'args[i]', 'children', 'kwargs.<key>', 'root'].sort());
        expect(raw).toBeGreaterThan(0);
    });

    it('⛓ ruleTreePaths never throws over the corpus, and every path addresses its node', () => {
        let trees = 0;
        let named = 0;
        for (const { f, doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                for (const t of treesOf(doc, p)) {
                    trees += 1;
                    let paths;
                    expect(() => { paths = ruleTreePaths(t); }, f).not.toThrow();
                    for (const { node, path } of paths) {
                        expect(getRuleAt(t, path)).toBe(node);
                        if (path.some((s) => typeof s === 'string')) named += 1;
                    }
                }
            }
        }
        expect(trees).toBeGreaterThan(0);
        expect(named).toBeGreaterThan(0);
    });

    it('⛓ BYTE-INERT: replacing every named-slot node with a copy of itself round-trips each tree byte-identical', () => {
        let replaced = 0;
        for (const { doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                for (const t of treesOf(doc, p)) {
                    const before = JSON.stringify(t);
                    for (const { node, path } of ruleTreePaths(t)) {
                        if (!path.some((s) => typeof s === 'string')) continue;
                        const r = replaceRuleAt(t, path, structuredClone(node));
                        expect(r.ok).toBe(true);
                        expect(JSON.stringify(r.tree)).toBe(before);
                        replaced += 1;
                    }
                    expect(JSON.stringify(t)).toBe(before);
                }
            }
        }
        expect(replaced).toBeGreaterThan(0);
    });

    /** The names/regions/locations that sit ONLY under a slot the pre-T1 walk
     *  could not reach (under any `args`/`kwargs` step other than a Compare
     *  side reached from a children-only spine is not separable by shape, so
     *  this takes every node under ANY named step) — the rename subjects. */
    function namedSlotRefs(doc, p) {
        const refs = { item: new Set(), region: new Set(), location: new Set() };
        for (const t of treesOf(doc, p)) {
            for (const { node, path } of ruleTreePaths(t)) {
                if (!path.some((s) => typeof s === 'string')) continue;
                for (const n of ownItemNames(node)) refs.item.add(n);
                if (typeof node.args?.region_name === 'string') refs.region.add(node.args.region_name);
                if (typeof node.args?.location_name === 'string') refs.location.add(node.args.location_name);
            }
        }
        return refs;
    }

    it('⛓ BYTE-INERT: the rename cascades round-trip A → A′ → A byte-identical on every named-slot reference', () => {
        const cascades = [
            ['item', renameItemInRules], ['region', renameRegionInRules], ['location', renameLocationInRules],
        ];
        const tried = { item: 0, region: 0, location: 0 };
        for (const { f, doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                const refs = namedSlotRefs(doc, p);
                for (const [kind, rename] of cascades) {
                    // three per document per kind keeps the row seconds, not minutes
                    for (const name of [...refs[kind]].slice(0, 3)) {
                        const d = structuredClone(doc);
                        const before = JSON.stringify(d.regions[p]);
                        const temp = `${name}\u0000T1`;
                        rename(d, p, name, temp);
                        rename(d, p, temp, name);
                        expect(JSON.stringify(d.regions[p]), `${f} ${p} ${kind} ${name}`).toBe(before);
                        tried[kind] += 1;
                    }
                }
            }
        }
        expect(tried.item).toBeGreaterThan(0);
        expect(tried.region + tried.location).toBeGreaterThan(0);
    });

    it('⛓ the rename REACHES a named slot now (the round trip is not vacuous)', () => {
        const t = { rule: 'Conditional', args: { test: has('A'), if_true: has('A'), if_false: { rule: 'True_' } } };
        const d = { regions: { 1: { R: { exits: [{ name: 'e', connected_region: 'R', access_rule: t }] } } } };
        renameItemInRules(d, '1', 'A', 'B');
        expect(d.regions[1].R.exits[0].access_rule.args.test).toEqual(has('B'));
        expect(d.regions[1].R.exits[0].access_rule.args.if_true).toEqual(has('B'));
    });

    it('⛓ ruleWithOwned keeps its OWN recursion — it imports no walker, so T1 cannot move it', () => {
        // (A no-op owned list is NOT an identity there: a `Has` of count 0 folds
        //  to `True_` — measured on ahit at T1 — so "owning nothing returns the
        //  same rule" is not its contract; the import is the claim.)
        const src = readFileSync(join(HERE, 'ruleWithOwned.js'), 'utf8');
        expect(src).not.toMatch(/from '\.\/rulesGraph\.js'/);
        expect(src).not.toMatch(/walkRuleTree/);
    });

    it('⛓ validateRules sees what the rules say: its unknown-item names EQUAL undefinedRuleItems on every document', () => {
        let flagged = 0;
        for (const { f, doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                const unknown = new Set(validateRules(doc, p).filter((i) => !i.message.startsWith('Item pool'))
                    .map((i) => i.message.match(/unknown item "(.*)"\.?$/)?.[1]).filter(Boolean));
                const ours = new Set(undefinedRuleItems(doc, p).map((r) => r.name));
                expect([...unknown].sort(), `${f} ${p}`).toEqual([...ours].sort());
                flagged += unknown.size;
            }
        }
        expect(flagged).toBeGreaterThan(0);
    });

    /**
     * ⛓⛓ THE MOVE, PINNED. The pre-T1 reading is QUOTED here from
     * `1695094361` (`rulesGraph.walkRuleTree` :143-157 — children + a
     * Compare's object operands; `rulesUtils.validateRules` :176-199 — item
     * names read off five listed kinds) as the frozen oracle the delta is
     * measured against; it is not a live list. Measured at T1: of 229
     * (document, player) pairs, ONE moves — +16 issues, four names, all real
     * (the source never defines them). A document that gains issues later reds
     * here on purpose: read it, class it, then extend the table.
     */
    it('⛓⛓ the per-document delta against the pre-T1 reading is exactly the measured list', () => {
        const LEGACY_KINDS_ONE = ['Has', 'CountItem'];
        const LEGACY_KINDS_LIST = ['HasAll', 'HasAny', 'HasFromList'];
        const legacyWalk = (node, visit) => {
            if (!node || typeof node !== 'object') return;
            visit(node);
            if (Array.isArray(node.children)) for (const c of node.children) legacyWalk(c, visit);
            if (node.rule === 'Compare' && node.args) {
                for (const side of ['left', 'right']) {
                    if (node.args[side] && typeof node.args[side] === 'object') legacyWalk(node.args[side], visit);
                }
            }
        };
        const legacyUnknown = (doc, p) => {
            const items = doc.items?.[p] ?? {};
            const out = [];
            for (const t of treesOf(doc, p)) {
                legacyWalk(t, (n) => {
                    if (LEGACY_KINDS_ONE.includes(n.rule)) {
                        const name = n.args?.item_name;
                        if (name && !Object.hasOwn(items, name)) out.push(name);
                    } else if (LEGACY_KINDS_LIST.includes(n.rule)) {
                        const arr = Array.isArray(n.args?.item_names) ? n.args.item_names
                            : (Array.isArray(n.args?.items) ? n.args.items : []);
                        for (const name of arr) if (name && !Object.hasOwn(items, name)) out.push(name);
                    }
                });
            }
            return out;
        };
        const moved = {};
        for (const { f, doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                // rule-reference issues only (the exits / starts / pool / events
                // checks did not move)
                const now = validateRules(doc, p).filter((i) => / references unknown item "/.test(i.message)
                    && !i.message.startsWith('Item pool') && !i.message.startsWith('Victory condition'))
                    .map((i) => i.message.match(/unknown item "(.*)"\.?$/)[1]);
                const then = legacyUnknown(doc, p);
                if (now.length !== then.length) {
                    const left = [...then];
                    const added = [];
                    for (const n of now) { const i = left.indexOf(n); if (i >= 0) left.splice(i, 1); else added.push(n); }
                    moved[`${f}#${p}`] = { delta: now.length - then.length, names: [...new Set(added)].sort(), lost: left.length };
                }
            }
        }
        expect(moved).toEqual({
            'frontend/presets/terraria/AP_14089154938208861744/AP_14089154938208861744_rules.json#1': {
                delta: 16, names: ['Cyborg', 'Princess', 'Santa Claus', 'Steampunker'], lost: 0,
            },
        });
    });

    it('itemNamesInRule keeps its FULL walk: the one-walker reading (walkRuleTree + ownItemNames) would lose names', () => {
        let lossy = 0;
        for (const { doc } of docs) {
            for (const p of Object.keys(doc.regions ?? {})) {
                for (const t of treesOf(doc, p)) {
                    const one = new Set();
                    walkRuleTree(t, (n) => { for (const x of ownItemNames(n)) one.add(x); });
                    const full = new Set(itemNamesInRule(t));
                    for (const x of one) expect(full.has(x)).toBe(true);
                    if (full.size > one.size) lossy += 1;
                }
            }
        }
        // ⛓ measured at T1: 43 trees whose typed `item_check`s sit inside an
        //   exported AST's args (not rule nodes, so not the walker's) — the
        //   reason `itemNamesInRule` did not move onto the one walker.
        expect(lossy).toBeGreaterThan(0);
    });
});
