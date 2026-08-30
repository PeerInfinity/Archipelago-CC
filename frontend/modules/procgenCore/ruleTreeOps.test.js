/**
 * procgenCore/ruleTreeOps — headless, path-addressed rule-tree editing
 * (EDITOR v3 slice D0b, §15 gap 6).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    COMPARE_SLOTS, WRAPPABLE_KINDS, getRuleAt, removeRuleAt, replaceRuleAt,
    ruleAtRefusal, ruleTreePaths, wrapRuleAt,
} from './ruleTreeOps.js';
import { walkRuleTree } from './rulesGraph.js';
import { loadRulesSchema } from './jsonSchemaFiles.js';

const SCHEMA = loadRulesSchema();

const has = (item) => ({ rule: 'Has', args: { item_name: item } });

/** And( Has(Sword), Or( Has(Wand), Compare( CountItem(Seal) >= AtLeast(...) ) ) ) */
const tree = () => ({
    rule: 'And',
    children: [
        has('Progressive Sword'),
        {
            rule: 'Or',
            children: [
                has('Wand'),
                {
                    rule: 'Compare',
                    args: {
                        left: { rule: 'CountItem', args: { item_name: 'Seal' } },
                        op: '>=',
                        right: { rule: 'And', children: [has('Light')] },
                    },
                },
            ],
        },
    ],
});

const deepFreeze = (v) => {
    if (v == null || typeof v !== 'object' || Object.isFrozen(v)) return v;
    Object.freeze(v);
    for (const child of Object.values(v)) deepFreeze(child);
    return v;
};

const ok = (r) => {
    if (!r.ok) throw new Error(`expected success, got: ${r.error}`);
    return r.tree;
};

// ── addressing ───────────────────────────────────────────────────────────

describe('getRuleAt', () => {
    it('walks child indices and both Compare operand slots', () => {
        const t = tree();
        expect(getRuleAt(t, [])).toBe(t);
        expect(getRuleAt(t, [0])).toEqual(has('Progressive Sword'));
        expect(getRuleAt(t, [1, 0])).toEqual(has('Wand'));
        expect(getRuleAt(t, [1, 1, 'args.left']).rule).toBe('CountItem');
        expect(getRuleAt(t, [1, 1, 'args.right']).rule).toBe('And');
        expect(getRuleAt(t, [1, 1, 'args.right', 0])).toEqual(has('Light'));
    });

    it('COMPARE_SLOTS is the vocabulary, not a spelling', () => {
        expect(COMPARE_SLOTS).toEqual(['args.left', 'args.right']);
        for (const slot of COMPARE_SLOTS) {
            expect(getRuleAt(tree(), [1, 1, slot])).not.toBeNull();
        }
    });

    /**
     * ⛔ AN OUT-OF-TREE PATH REFUSES BY NAME, naming the failing STEP and what
     * was there instead. Returning `undefined` would let a caller write into a
     * tree it never located — and the caller that most wants these ops is a UI
     * whose paths go stale the moment somebody else edits.
     */
    it.each([
        [[9], /step 0 \("9"\) .* out of range .* has 2 child\(ren\)/],
        [[0, 0], /step 1 \("0"\) of path 0\/0 indexes children, but rule "Has" has none/],
        [[0, 'args.left'], /names a Compare operand, but args.left of rule "Has" is undefined/],
        [[1, 0, 'args.right'], /names a Compare operand, but args.right of rule "Has" is undefined/],
        [[1, 'nonsense'], /neither a child index nor one of args.left\/args.right/],
    ])('refuses %j by name', (path, pattern) => {
        expect(getRuleAt(tree(), path)).toBeNull();
        expect(ruleAtRefusal(tree(), path)).toMatch(pattern);
    });

    it('refuses a non-array path and a non-node tree', () => {
        expect(ruleAtRefusal(tree(), 0)).toMatch(/a path is an array of steps/);
        expect(ruleAtRefusal(null, [])).toMatch(/the tree is null, not a rule node/);
    });

    it('a valid path has no refusal', () => {
        expect(ruleAtRefusal(tree(), [1, 1, 'args.left'])).toBeNull();
    });
});

// ── purity ───────────────────────────────────────────────────────────────

describe('⛔ copy-on-write: the input tree is never mutated', () => {
    it.each([
        ['replaceRuleAt', (t) => replaceRuleAt(t, [1, 0], has('Fire Wand Fusion'))],
        ['removeRuleAt', (t) => removeRuleAt(t, [1, 0])],
        ['wrapRuleAt', (t) => wrapRuleAt(t, [0], 'Or')],
        ['replaceRuleAt at the root', (t) => replaceRuleAt(t, [], { rule: 'True_' })],
        ['replaceRuleAt inside a Compare', (t) => replaceRuleAt(t, [1, 1, 'args.left'], has('Seal'))],
    ])('%s writes nothing into a deep-frozen tree', (_name, call) => {
        const t = deepFreeze(tree());
        const r = call(t);
        expect(r.ok, r.error).toBe(true);
        expect(r.tree).not.toBe(t);
    });

    it('untouched branches keep their identity', () => {
        const t = tree();
        const first = t.children[0];
        const r = ok(replaceRuleAt(t, [1, 0], has('Ghost Spear')));
        expect(r.children[0]).toBe(first);
        expect(r.children[1]).not.toBe(t.children[1]);
        expect(r.children[1].children[1]).toBe(t.children[1].children[1]);
    });

    it('a refusal returns the input tree itself', () => {
        const t = deepFreeze(tree());
        const r = replaceRuleAt(t, [9], has('x'));
        expect(r.ok).toBe(false);
        expect(r.tree).toBe(t);
    });
});

// ── the ops ──────────────────────────────────────────────────────────────

describe('replaceRuleAt', () => {
    it('replaces at every kind of address', () => {
        expect(ok(replaceRuleAt(tree(), [], { rule: 'False_' }))).toEqual({ rule: 'False_' });
        expect(ok(replaceRuleAt(tree(), [0], has('Wand'))).children[0]).toEqual(has('Wand'));
        expect(ok(replaceRuleAt(tree(), [1, 1, 'args.right'], has('Light')))
            .children[1].children[1].args.right).toEqual(has('Light'));
    });

    it('leaves the rest of a Compare\'s args alone', () => {
        const r = ok(replaceRuleAt(tree(), [1, 1, 'args.left'], has('Seal')));
        expect(r.children[1].children[1].args.op).toBe('>=');
        expect(r.children[1].children[1].args.right.rule).toBe('And');
    });

    it('refuses a replacement that is not a rule object', () => {
        for (const bad of [null, 42, 'True_', ['a']]) {
            expect(replaceRuleAt(tree(), [0], bad).error)
                .toMatch(/the replacement must be a rule object/);
        }
    });

    /**
     * ⛓ THE SCHEMA IS INJECTED, and when it is, a node is checked against
     * `rules.schema.json#/$defs/rule` BEFORE it lands — the only moment anybody
     * knows where it came from. Without a schema the op still refuses a
     * non-object, because that is a claim about JavaScript and not about the
     * dialect.
     */
    it('validates the written node against #/$defs/rule when a schema is injected', () => {
        const bad = { args: { item_name: 'Wand' } };            // no `rule`
        expect(replaceRuleAt(tree(), [0], bad).ok).toBe(true);   // unchecked: it is an object
        const checked = replaceRuleAt(tree(), [0], bad, { schema: SCHEMA });
        expect(checked.ok).toBe(false);
        expect(checked.error).toMatch(/not a valid Rule Builder rule/);
        expect(checked.error).toMatch(/rule/);
        // and a good node still lands
        expect(replaceRuleAt(tree(), [0], has('Wand'), { schema: SCHEMA }).ok).toBe(true);
    });
});

describe('removeRuleAt', () => {
    it('splices a child out and renumbers the ones after it', () => {
        const r = ok(removeRuleAt(tree(), [0]));
        expect(r.children).toHaveLength(1);
        expect(r.children[0].rule).toBe('Or');
        expect(getRuleAt(r, [0, 0])).toEqual(has('Wand'));
    });

    it('removes a nested child without touching its siblings', () => {
        const r = ok(removeRuleAt(tree(), [1, 0]));
        expect(r.children[1].children).toHaveLength(1);
        expect(r.children[1].children[0].rule).toBe('Compare');
    });

    /**
     * ⛔ TWO THINGS ARE NOT REMOVABLE, and both refuse by name rather than
     * leaving a hole: an access rule is never ABSENT (it is `True_`), and a
     * Compare operand slot is never EMPTY. Both are the shapes the rest of the
     * pipeline reads without checking, which is exactly why the refusal belongs
     * here and not in a comment.
     */
    it('refuses the ROOT, and says to replace instead', () => {
        const r = removeRuleAt(tree(), []);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/the ROOT cannot be removed/);
        expect(r.error).toMatch(/True_/);
    });

    it.each(COMPARE_SLOTS)('refuses %s of a Compare, and says to replace instead', (slot) => {
        const r = removeRuleAt(tree(), [1, 1, slot]);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/cannot be removed — an operand slot is always filled/);
    });

    it('refuses an out-of-tree path', () => {
        expect(removeRuleAt(tree(), [1, 5]).error).toMatch(/out of range/);
    });
});

describe('wrapRuleAt', () => {
    it('wraps in each of the three kinds that take children', () => {
        expect(WRAPPABLE_KINDS).toEqual(['And', 'Or', 'AtLeast']);
        for (const kind of WRAPPABLE_KINDS) {
            const r = ok(wrapRuleAt(tree(), [0], kind));
            expect(r.children[0]).toEqual({ rule: kind, children: [has('Progressive Sword')] });
        }
    });

    it('wraps the ROOT', () => {
        const t = tree();
        const r = ok(wrapRuleAt(t, [], 'Or'));
        expect(r.rule).toBe('Or');
        expect(r.children[0]).toBe(t);
    });

    it('wraps inside a Compare operand', () => {
        const r = ok(wrapRuleAt(tree(), [1, 1, 'args.left'], 'And'));
        expect(r.children[1].children[1].args.left)
            .toEqual({ rule: 'And', children: [{ rule: 'CountItem', args: { item_name: 'Seal' } }] });
    });

    it('refuses a kind that takes no children, naming the ones that do', () => {
        const r = wrapRuleAt(tree(), [0], 'Has');
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/cannot wrap in "Has"/);
        expect(r.error).toMatch(/And, Or, AtLeast/);
    });

    it('refuses an out-of-tree path by name', () => {
        expect(wrapRuleAt(tree(), [4], 'And').error).toMatch(/out of range/);
    });
});

// ── the ONE recursion ────────────────────────────────────────────────────

describe('⛓ the paths come off rulesGraph.walkRuleTree, not a fourth recursion', () => {
    it('every node the walker visits has exactly one path, in the same order', () => {
        const t = tree();
        const visited = [];
        walkRuleTree(t, (node) => visited.push(node));
        const paths = ruleTreePaths(t);
        expect(paths).toHaveLength(visited.length);
        expect(paths.map((p) => p.node)).toEqual(visited);
        for (const { node, path } of paths) expect(getRuleAt(t, path)).toBe(node);
    });

    it('the tree fixture really exercises both slot kinds', () => {
        const paths = ruleTreePaths(tree()).map((p) => p.path);
        expect(paths.some((p) => p.includes('args.left'))).toBe(true);
        expect(paths.some((p) => p.includes('args.right'))).toBe(true);
        expect(paths.some((p) => p.length === 3 && typeof p[2] === 'string')).toBe(true);
        expect(paths).toContainEqual([]);
    });

    /**
     * ⛔ THE DISAGREEMENT IS A THROW, NOT A SILENT OMISSION. If `walkRuleTree`
     * learns a slot this does not, the two answers diverge — and a
     * path-addressed API that could not address part of the tree the walker
     * sees is the worst kind of wrong, because every path it DOES return still
     * works ([[feedback_two_rulings_may_not_compose]]).
     */
    it('the guard is REACHABLE — two readings that disagree throw', () => {
        // ⚠ No STATIC tree can separate the two walks today, because they
        //   traverse the same slots in the same order — which is the property
        //   this row exists to alarm on when it stops holding. So the witness
        //   makes the two READINGS disagree directly: a `children` getter that
        //   answers the walker with two children and the pather with one.
        const a = has('Wand');
        const b = has('Light');
        let reads = 0;
        const t = {
            rule: 'And',
            get children() { reads += 1; return reads <= 2 ? [a, b] : [a]; },
        };
        expect(() => ruleTreePaths(t)).toThrow(/disagrees with[\s\S]*walkRuleTree/);
        // ⛔ and it is not vacuous: the same tree read consistently does NOT throw.
        expect(() => ruleTreePaths({ rule: 'And', children: [a, b] })).not.toThrow();
    });
});

// ── the DOM editor really goes through this now ──────────────────────────

describe('⛓ apworldEditor/ruleTreeEditor delegates its tree-shape gestures', () => {
    const src = readFileSync(new URL('../apworldEditor/ruleTreeEditor.js', import.meta.url), 'utf8');

    it('imports the ops and holds no hand-written splice or child assignment', () => {
        expect(src).toMatch(/from '\.\.\/procgenCore\/ruleTreeOps\.js'/);
        expect(src).not.toMatch(/children\.splice\(/);
        expect(src).not.toMatch(/children\[idx\] = /);
        expect(src).not.toMatch(/children\.push\(/);
    });

    it('every render context carries a PATH', () => {
        expect(src).toMatch(/_ctxFor\(path, isRoot = false\)/);
        expect(src).toMatch(/this\._ctxFor\(\[\], true\)/);
        expect(src).toMatch(/this\._ctxFor\(\[\.\.\.ctx\.path, idx\]\)/);
        for (const slot of COMPARE_SLOTS) {
            expect(src).toContain(`[...ctx.path, '${slot}']`);
        }
    });

    /**
     * ⚠ THE ONE THING COPY-ON-WRITE COULD HAVE BROKEN, asserted rather than
     * asserted-in-a-comment. `_rawViewNodes` is a WeakSet keyed on node
     * IDENTITY, and an op rebuilds the spine — so a raw-view flag on a spine
     * node would be lost. It cannot happen because a raw-view node renders no
     * children, so nothing editable is ever beneath one; this row pins the
     * property the argument rests on.
     */
    it('a raw-view node renders no children, so no spine node can be in the WeakSet', () => {
        expect(src).toMatch(/if \(inRawView\) \{\s*block\.appendChild\(this\._renderRawBlock\(node\)\);\s*\} else if/);
    });
});
