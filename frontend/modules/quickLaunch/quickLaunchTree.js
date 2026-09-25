/**
 * quickLaunchTree — PURE: the user's own arrangement of Quick Launch items,
 * stored as the setting `moduleSettings.quickLaunch.tree`.
 *
 *   tree = { version: 1, nodes: [Node] }
 *   Node = { id, kind: 'group', label, children: [Node] }
 *        | { id, kind: 'panel', ref: componentType }
 *        | { id, kind: 'doc',   ref: docs path }
 *        | { id, kind: 'url',   href, label }
 *
 * ⛓ The tree stores REFERENCES; the catalog (quickLaunchCatalog.js) resolves
 * them at render time. So a ref may appear any number of times, and a ref
 * whose target is gone is kept (drawn greyed) rather than silently dropped.
 *
 * ⛓ Every op is `(tree, …) → newTree`: no mutation (the input may be the very
 * object settingsManager holds), no DOM, no settings. The panel calls one op
 * per button press and writes the result back. An op that addresses an id the
 * tree does not hold throws a RangeError carrying UNKNOWN_NODE_MESSAGE.
 *
 * ⛔ No default arrangement lives here: EMPTY_TREE is the schema default, so a
 * fresh user sees only the virtual groups.
 */

export const TREE_VERSION = 1;

export const EMPTY_TREE = Object.freeze({ version: TREE_VERSION, nodes: Object.freeze([]) });

export const NODE_KINDS = Object.freeze({ group: 'group', panel: 'panel', doc: 'doc', url: 'url' });

/** The kinds whose `ref` points into the catalog. */
export const REF_KINDS = Object.freeze([NODE_KINDS.panel, NODE_KINDS.doc]);

export const UNKNOWN_NODE_MESSAGE = 'quickLaunchTree: no node with id';
export const NOT_A_GROUP_MESSAGE = 'quickLaunchTree: not a group';
export const INTO_ITSELF_MESSAGE = 'quickLaunchTree: a group cannot move into itself or its own descendant';
export const BAD_KIND_MESSAGE = 'quickLaunchTree: not a ref kind';

let idCounter = 0;

/** A fresh node id: a UUID where the platform has one, a counter otherwise. */
export function newId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    idCounter += 1;
    return `ql-${Date.now().toString(36)}-${idCounter}`;
}

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isGroup = (n) => n.kind === NODE_KINDS.group;
const unknown = (id) => new RangeError(`${UNKNOWN_NODE_MESSAGE} "${id}"`);

/** `{node, parent, index}` for `id` — `parent` is the group holding it, null at the root; null when absent. */
export function findNode(tree, id) {
    const walk = (nodes, parent) => {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.id === id) return { node, parent, index: i };
            if (isGroup(node)) {
                const hit = walk(node.children, node);
                if (hit) return hit;
            }
        }
        return null;
    };
    return walk(tree.nodes, null);
}

/**
 * A copy of `tree` with the child list of `parentId` (null = the root)
 * replaced by `edit(list)`. Only the path to that list is copied.
 */
function editList(tree, parentId, edit) {
    if (parentId == null) return { ...tree, nodes: edit(tree.nodes) };
    let found = false;
    const walk = (nodes) => nodes.map((node) => {
        if (!isGroup(node)) return node;
        if (node.id === parentId) {
            found = true;
            return { ...node, children: edit(node.children) };
        }
        const children = walk(node.children);
        return children === node.children || children.every((c, i) => c === node.children[i])
            ? node : { ...node, children };
    });
    const nodes = walk(tree.nodes);
    if (!found) {
        const hit = findNode(tree, parentId);
        throw hit ? new RangeError(`${NOT_A_GROUP_MESSAGE} "${parentId}"`) : unknown(parentId);
    }
    return { ...tree, nodes };
}

/** The id of the group holding `id` (null at the root); throws on an unknown id. */
function parentIdOf(tree, id) {
    const hit = findNode(tree, id);
    if (!hit) throw unknown(id);
    return hit.parent ? hit.parent.id : null;
}

const insertAt = (list, index, node) => {
    const i = Math.max(0, Math.min(index ?? list.length, list.length));
    return [...list.slice(0, i), node, ...list.slice(i)];
};

export function addGroup(tree, parentId, label, id = newId()) {
    return editList(tree, parentId, (list) => [...list, { id, kind: NODE_KINDS.group, label: String(label), children: [] }]);
}

export function renameGroup(tree, id, label) {
    const hit = findNode(tree, id);
    if (!hit) throw unknown(id);
    if (!isGroup(hit.node)) throw new RangeError(`${NOT_A_GROUP_MESSAGE} "${id}"`);
    return editList(tree, hit.parent?.id ?? null,
        (list) => list.map((n) => (n.id === id ? { ...n, label: String(label) } : n)));
}

/** Removes the node; a group takes its whole subtree with it (the UI asks first). */
export function deleteNode(tree, id) {
    return editList(tree, parentIdOf(tree, id), (list) => list.filter((n) => n.id !== id));
}

/**
 * Moves `id` into `newParentId` (null = the root) at `index` of the
 * destination list as it is AFTER the node left its old place; the index is
 * clamped. A group cannot move into itself or below itself.
 */
export function moveNode(tree, id, newParentId, index) {
    const hit = findNode(tree, id);
    if (!hit) throw unknown(id);
    if (newParentId != null) {
        const dest = findNode(tree, newParentId);
        if (!dest) throw unknown(newParentId);
        if (!isGroup(dest.node)) throw new RangeError(`${NOT_A_GROUP_MESSAGE} "${newParentId}"`);
        if (isGroup(hit.node) && (newParentId === id || findNode({ nodes: hit.node.children }, newParentId))) {
            throw new RangeError(`${INTO_ITSELF_MESSAGE} "${id}"`);
        }
    }
    const removed = editList(tree, hit.parent?.id ?? null, (list) => list.filter((n) => n.id !== id));
    return editList(removed, newParentId, (list) => insertAt(list, index, hit.node));
}

function shift(tree, id, delta) {
    const hit = findNode(tree, id);
    if (!hit) throw unknown(id);
    const siblings = hit.parent ? hit.parent.children : tree.nodes;
    const to = hit.index + delta;
    if (to < 0 || to >= siblings.length) return tree; // at the edge: nothing to do
    return editList(tree, hit.parent?.id ?? null, (list) => {
        const next = [...list];
        [next[hit.index], next[to]] = [next[to], next[hit.index]];
        return next;
    });
}

export const moveUp = (tree, id) => shift(tree, id, -1);
export const moveDown = (tree, id) => shift(tree, id, +1);

/** Appends a `panel` (ref = componentType) or `doc` (ref = path) node. */
export function addRef(tree, parentId, kind, ref, id = newId()) {
    if (!REF_KINDS.includes(kind)) throw new RangeError(`${BAD_KIND_MESSAGE} "${kind}"`);
    return editList(tree, parentId, (list) => [...list, { id, kind, ref: String(ref) }]);
}

export function addUrl(tree, parentId, href, label, id = newId()) {
    return editList(tree, parentId,
        (list) => [...list, { id, kind: NODE_KINDS.url, href: String(href), label: String(label || href) }]);
}

/**
 * Brings any stored value to the current shape. `null`/garbage → EMPTY_TREE;
 * a well-formed v1 tree comes back as the SAME object (identity, so a render
 * of an untouched tree writes nothing); anything else is rebuilt: unknown
 * kinds dropped, missing or repeated ids replaced, missing fields filled.
 * Idempotent: migrate(migrate(x)) deep-equals migrate(x).
 */
export function migrate(tree) {
    if (!isObject(tree) || !Array.isArray(tree.nodes)) return EMPTY_TREE;
    const seen = new Set();
    let changed = tree.version !== TREE_VERSION;
    const fix = (nodes) => {
        const out = [];
        for (const node of nodes) {
            if (!isObject(node) || !Object.values(NODE_KINDS).includes(node.kind)) { changed = true; continue; }
            let { id } = node;
            if (typeof id !== 'string' || !id || seen.has(id)) { id = newId(); changed = true; }
            seen.add(id);
            if (isGroup(node)) {
                const kids = Array.isArray(node.children) ? node.children : (changed = true, []);
                const label = typeof node.label === 'string' ? node.label : (changed = true, '');
                out.push({ id, kind: node.kind, label, children: fix(kids) });
            } else if (node.kind === NODE_KINDS.url) {
                if (typeof node.href !== 'string' || typeof node.label !== 'string') changed = true;
                const href = String(node.href ?? '');
                out.push({ id, kind: node.kind, href, label: String(node.label ?? href) });
            } else {
                if (typeof node.ref !== 'string') changed = true;
                out.push({ id, kind: node.kind, ref: String(node.ref ?? '') });
            }
        }
        return out;
    };
    const nodes = fix(tree.nodes);
    return changed ? { version: TREE_VERSION, nodes } : tree;
}

/** Every group, depth-first, as `{id, label, depth}` — the "move to" choices (the root is the caller's). */
export function groupsOf(tree) {
    const out = [];
    const walk = (nodes, depth) => {
        for (const node of nodes) {
            if (!isGroup(node)) continue;
            out.push({ id: node.id, label: node.label, depth });
            walk(node.children, depth + 1);
        }
    };
    walk(tree.nodes, 0);
    return out;
}

/** The catalog entry a ref node points at, or undefined. */
function lookup(catalog, node) {
    if (node.kind === NODE_KINDS.panel) return catalog.panels.find((p) => p.componentType === node.ref);
    if (node.kind === NODE_KINDS.doc) return catalog.docs.find((d) => d.path === node.ref);
    return undefined;
}

/**
 * The tree with each ref node carrying `item` (its catalog entry) or
 * `missing: true`. Never throws on a dangling ref; a new object throughout.
 */
export function resolve(tree, catalog) {
    const walk = (nodes) => nodes.map((node) => {
        if (isGroup(node)) return { ...node, children: walk(node.children) };
        if (!REF_KINDS.includes(node.kind)) return { ...node };
        const item = lookup(catalog, node);
        return item ? { ...node, item } : { ...node, missing: true };
    });
    return { ...tree, nodes: walk(tree.nodes) };
}

/** Every ref in the tree, as `"<kind>:<ref>"`. */
export function refsOf(tree) {
    const out = new Set();
    const walk = (nodes) => {
        for (const node of nodes) {
            if (isGroup(node)) walk(node.children);
            else if (REF_KINDS.includes(node.kind)) out.add(`${node.kind}:${node.ref}`);
        }
    };
    walk(tree.nodes);
    return out;
}

/** The catalog entries no node references, panels then docs, as `{kind, item}`. */
export function unfiled(tree, catalog) {
    const filed = refsOf(tree);
    return [
        ...catalog.panels.filter((p) => !filed.has(`${NODE_KINDS.panel}:${p.componentType}`))
            .map((item) => ({ kind: NODE_KINDS.panel, item })),
        ...catalog.docs.filter((d) => !filed.has(`${NODE_KINDS.doc}:${d.path}`))
            .map((item) => ({ kind: NODE_KINDS.doc, item })),
    ];
}
