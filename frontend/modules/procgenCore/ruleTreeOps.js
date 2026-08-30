/**
 * procgenCore/ruleTreeOps — HEADLESS, path-addressed editing of one Rule
 * Builder rule tree (EDITOR v3 slice D0b; §15 gap 6, §16.2).
 *
 * ── WHAT THIS REPLACED ─────────────────────────────────────────────────
 *
 * `apworldEditor/ruleTreeEditor.js` could edit a rule tree — replace a node,
 * delete one, wrap one in an `And`/`Or` — but ONLY through per-node CLOSURES
 * built while rendering (`ctx.replace` / `ctx.remove`, :111-112 and :200-201).
 * That made the editing inseparable from the DOM: nothing headless could ask
 * for "the node at this path", and D1's `set-access-rule` op would have had to
 * write a second implementation. The DOM keeps every one of its lines; the
 * mutations now go through here.
 *
 * ── THE PATH ───────────────────────────────────────────────────────────
 *
 * A path is an array of STEPS from the root, in the same shape
 * `rulesGraph.walkRuleTree` recurses over — which is the point: there is ONE
 * recursion over a rule tree in this repo and these ops are written against it
 * rather than becoming a fourth.
 *
 *   ·  a NUMBER      — `children[i]` of an `And`/`Or`/`AtLeast`
 *   ·  `'args.left'` / `'args.right'` — the two operand slots of a `Compare`
 *
 * `[]` is the root. `['args.left', 0]` is the first child of a Compare's left
 * operand.
 *
 * ⛔ AN OUT-OF-TREE PATH REFUSES BY NAME, naming the step that failed and what
 * was there instead. A path-addressed API that returned `undefined` for a bad
 * path would let a caller write into a tree it never located — and the caller
 * that most wants these ops is a UI whose paths go stale the moment somebody
 * else edits.
 *
 * ── COPY-ON-WRITE, AND VALIDATION BEFORE THE WRITE ─────────────────────
 *
 * Every op returns a NEW tree and never mutates the input, with structural
 * sharing along the untouched branches — the same contract `atlasOps.js` keeps,
 * for the same reason.
 *
 * A node being WRITTEN is checked against `rules.schema.json#/$defs/rule`
 * through `jsonSchemaCheck` first, when a schema is injected. That is optional
 * for the same reason the atlas structural pass is: this module is in the
 * browser page graph and cannot read a schema off disk. Injected, the check
 * refuses malformed nodes at the moment they are written, which is the only
 * moment anybody knows where they came from.
 */

import { walkRuleTree } from './rulesGraph.js';
import { ruleSchemaErrors } from './jsonSchemaCheck.js';

/** The two named operand slots a `Compare` carries, in `walkRuleTree`'s order. */
export const COMPARE_SLOTS = Object.freeze(['args.left', 'args.right']);

/** The rule kinds `wrapRuleAt` can wrap a node in — the ones that take children. */
export const WRAPPABLE_KINDS = Object.freeze(['And', 'Or', 'AtLeast']);

const isNode = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const describePath = (path) => (path.length === 0 ? '<root>' : path.join('/'));

/** What `step` addresses inside `node`, or a refusal reason. */
function stepInto(node, step, path, i) {
    const where = `step ${i} ("${step}") of path ${describePath(path)}`;
    if (!isNode(node)) {
        return { error: `ruleTreeOps: ${where} descends into ${JSON.stringify(node)}, which is not a rule node` };
    }
    if (typeof step === 'number') {
        if (!Array.isArray(node.children)) {
            return { error: `ruleTreeOps: ${where} indexes children, but rule "${node.rule}" has none` };
        }
        if (!Number.isInteger(step) || step < 0 || step >= node.children.length) {
            return { error: `ruleTreeOps: ${where} is out of range — rule "${node.rule}" has ${node.children.length} child(ren)` };
        }
        return { value: node.children[step] };
    }
    if (COMPARE_SLOTS.includes(step)) {
        const slot = step.slice('args.'.length);
        const value = node.args?.[slot];
        if (!isNode(value)) {
            return { error: `ruleTreeOps: ${where} names a Compare operand, but ${step} of rule "${node.rule}" is ${JSON.stringify(value)}` };
        }
        return { value };
    }
    return {
        error: `ruleTreeOps: ${where} is neither a child index nor one of ${COMPARE_SLOTS.join('/')}`,
    };
}

function checkPath(tree, path) {
    if (!Array.isArray(path)) {
        return { error: `ruleTreeOps: a path is an array of steps, got ${JSON.stringify(path)}` };
    }
    if (!isNode(tree)) {
        return { error: `ruleTreeOps: the tree is ${JSON.stringify(tree)}, not a rule node` };
    }
    return { ok: true };
}

/**
 * The node at `path`, or `null` when the path does not address one.
 *
 * ⚠ Returns the LIVE node from `tree` — reading is not copying. The write ops
 * below never hand a live reference into a document they also returned as new.
 */
export function getRuleAt(tree, path = []) {
    const bad = checkPath(tree, path);
    if (bad.error) return null;
    let node = tree;
    for (const [i, step] of path.entries()) {
        const next = stepInto(node, step, path, i);
        if (next.error) return null;
        node = next.value;
    }
    return node;
}

/** Why `path` does not address a node in `tree` — or null when it does. */
export function ruleAtRefusal(tree, path = []) {
    const bad = checkPath(tree, path);
    if (bad.error) return bad.error;
    let node = tree;
    for (const [i, step] of path.entries()) {
        const next = stepInto(node, step, path, i);
        if (next.error) return next.error;
        node = next.value;
    }
    return null;
}

/** Rebuild `node` with the value at `step` replaced (or, for a number, spliced out). */
function writeStep(node, step, value) {
    if (typeof step === 'number') {
        const children = value === undefined
            ? node.children.filter((_, i) => i !== step)
            : node.children.map((c, i) => (i === step ? value : c));
        return { ...node, children };
    }
    const slot = step.slice('args.'.length);
    return { ...node, args: { ...node.args, [slot]: value } };
}

/**
 * The shared spine walk: rebuild the path from the root down, applying `make`
 * to the addressed node. `make(node)` returning `undefined` DELETES it (only
 * legal under a numeric step, and only when the parent keeps at least one
 * child — see `removeRuleAt`).
 */
function rewriteAt(tree, path, make) {
    const refusal = ruleAtRefusal(tree, path);
    if (refusal) return { ok: false, tree, error: refusal };
    if (path.length === 0) {
        const next = make(tree);
        if (next === undefined) {
            return { ok: false, tree, error: 'ruleTreeOps: the ROOT cannot be removed — replace it instead (an access rule is never absent, it is `True_`)' };
        }
        return { ok: true, tree: next };
    }
    const [step, ...rest] = path;
    const child = stepInto(tree, step, path, 0).value;
    if (rest.length === 0) {
        const next = make(child);
        if (next === undefined && typeof step !== 'number') {
            return {
                ok: false,
                tree,
                error: `ruleTreeOps: ${step} of a Compare cannot be removed — an operand slot is always filled; replace it instead`,
            };
        }
        return { ok: true, tree: writeStep(tree, step, next) };
    }
    const inner = rewriteAt(child, rest, make);
    if (!inner.ok) return { ok: false, tree, error: inner.error };
    return { ok: true, tree: writeStep(tree, step, inner.tree) };
}

/** The schema refusal for a node about to be written, or null. */
function nodeRefusal(node, schemaRoot, what) {
    if (!isNode(node)) {
        return `ruleTreeOps: ${what} must be a rule object ({ rule: "..." }), got ${JSON.stringify(node)}`;
    }
    if (schemaRoot === undefined) return null;
    const errs = ruleSchemaErrors(node, schemaRoot);
    return errs.length === 0
        ? null
        : `ruleTreeOps: ${what} is not a valid Rule Builder rule — ${errs.join('; ')}`;
}

/**
 * Replace the node at `path` with `node`.
 *
 * @param {object} tree
 * @param {Array<number|string>} path
 * @param {object} node
 * @param {{schema?: object}} [options] `schema` = the parsed rules.schema.json;
 *   supply it and `node` is validated against `#/$defs/rule` BEFORE it lands.
 * @returns {{ok: true, tree: object} | {ok: false, tree: object, error: string}}
 */
export function replaceRuleAt(tree, path, node, options = {}) {
    const refusal = nodeRefusal(node, options.schema, 'the replacement');
    if (refusal) return { ok: false, tree, error: refusal };
    return rewriteAt(tree, path, () => node);
}

/**
 * Remove the node at `path`.
 *
 * ⛔ THE ROOT IS NOT REMOVABLE and neither is a `Compare` operand: an access
 * rule is never ABSENT, it is `True_`, and an operand slot is never empty. Both
 * refuse by name and tell the caller to replace instead — which is what
 * `ruleTreeEditor`'s "reset" button does and always did.
 */
export function removeRuleAt(tree, path) {
    return rewriteAt(tree, path, () => undefined);
}

/**
 * Wrap the node at `path` in a new `kind` node holding it as the only child —
 * the `⇪ And` / `⇪ Or` gesture, headless.
 */
export function wrapRuleAt(tree, path, kind, options = {}) {
    if (!WRAPPABLE_KINDS.includes(kind)) {
        return {
            ok: false,
            tree,
            error: `ruleTreeOps: cannot wrap in "${kind}" — the kinds that take children are ${WRAPPABLE_KINDS.join(', ')}`,
        };
    }
    const existing = getRuleAt(tree, path);
    if (existing === null) return { ok: false, tree, error: ruleAtRefusal(tree, path) };
    const wrapper = { rule: kind, children: [existing] };
    const refusal = nodeRefusal(wrapper, options.schema, `the ${kind} wrapper`);
    if (refusal) return { ok: false, tree, error: refusal };
    return rewriteAt(tree, path, () => wrapper);
}

/**
 * Every path in `tree`, root first, in `walkRuleTree`'s own order.
 *
 * ⛔ NOT A FOURTH RECURSION. It calls `walkRuleTree` for the ORDER and matches
 * each visited node back to the path that reaches it, so a change to how a rule
 * tree is walked moves this with it rather than leaving a second answer behind.
 */
export function ruleTreePaths(tree) {
    const order = [];
    walkRuleTree(tree, (node) => order.push(node));
    const paths = [];
    const seen = new Set();
    const walk = (node, path) => {
        paths.push({ node, path });
        for (const [i, child] of (Array.isArray(node.children) ? node.children : []).entries()) {
            if (isNode(child)) walk(child, [...path, i]);
        }
        if (node.rule === 'Compare' && node.args) {
            for (const step of COMPARE_SLOTS) {
                const value = node.args[step.slice('args.'.length)];
                if (isNode(value)) walk(value, [...path, step]);
            }
        }
    };
    if (isNode(tree)) walk(tree, []);
    for (const { node } of paths) seen.add(node);
    // ⛔ the two orders must agree — if `walkRuleTree` learns a new slot and
    //   this does not, the mismatch is a defect and not a silent omission.
    if (order.length !== paths.length || order.some((n, i) => n !== paths[i].node)) {
        throw new Error(`ruleTreeOps: the path walk (${paths.length} nodes) disagrees with `
            + `rulesGraph.walkRuleTree (${order.length}) — one of them learned a slot the other did not`);
    }
    return paths;
}
