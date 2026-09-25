/**
 * quickLaunchFilter — PURE: what the Quick Launch panel draws (the view
 * model), and the filter box's cut of it.
 *
 *   model = { stored: [Node], groups: [Group] }
 *     stored  the user's tree, resolved (quickLaunchTree.js `resolve`): a ref
 *             node carries `item` (its catalog entry) or `missing: true`
 *     Group   { id, label, entries: [{kind, item}] }            — rows
 *           | { id, label, groups: [Group] }                    — All panels: one sub-group per category
 *
 * Both views (tree and cards) draw the same model; the filter box passes it
 * through `filterView` first. No DOM, no settings.
 */

import { VIRTUAL_GROUPS, virtualGroups } from './quickLaunchCatalog.js';
import { NODE_KINDS, resolve, unfiled } from './quickLaunchTree.js';

/**
 * The model for `tree` over `catalog`: the stored nodes, then Unfiled (only
 * when the tree holds something — with an empty tree every entry is unfiled
 * and All panels / Help already show each one), All panels, Help.
 */
export function buildViewModel(tree, catalog, categoryOrder) {
    const loose = tree.nodes.length ? unfiled(tree, catalog) : [];
    const groups = [];
    if (loose.length) groups.push({ ...VIRTUAL_GROUPS.unfiled, entries: loose });
    for (const group of virtualGroups(catalog, categoryOrder)) {
        if (group.groups) {
            groups.push({
                id: group.id,
                label: group.label,
                groups: group.groups.map((g) => ({
                    id: g.id, label: g.label, entries: g.items.map((item) => ({ kind: NODE_KINDS.panel, item })),
                })),
            });
        } else {
            groups.push({ id: group.id, label: group.label, entries: group.items.map((item) => ({ kind: NODE_KINDS.doc, item })) });
        }
    }
    return { stored: resolve(tree, catalog).nodes, groups };
}

/** The number of rows a model group holds, sub-groups included. */
export function groupSize(group) {
    return group.groups ? group.groups.reduce((n, g) => n + groupSize(g), 0) : group.entries.length;
}

/** The texts a row is matched on: a panel's title and description, a guide's title, a link's label. */
function rowTexts(kind, item) {
    if (kind === NODE_KINDS.panel) return [item.title, item.description];
    if (kind === NODE_KINDS.doc) return [item.title];
    return [];
}

/** A stored node's own texts (a group's label; a dangling ref's ref, which is what its row shows). */
function nodeTexts(node) {
    if (node.kind === NODE_KINDS.group) return [node.label];
    if (node.kind === NODE_KINDS.url) return [node.label];
    if (node.missing) return [node.ref];
    return rowTexts(node.kind, node.item);
}

/**
 * The model cut to what matches `query`: a case-insensitive substring of a
 * panel's title or description, a guide's title, a group's label or a link's
 * label. A match keeps every group above it (with only the matching rows); a
 * group whose own label matches keeps everything in it. A group left empty is
 * dropped. A blank query returns `model` itself.
 */
export function filterView(model, query) {
    const q = String(query ?? '').trim().toLowerCase();
    if (!q) return model;
    const hit = (texts) => texts.some((t) => typeof t === 'string' && t.toLowerCase().includes(q));

    const cutNodes = (nodes) => nodes.flatMap((node) => {
        if (node.kind !== NODE_KINDS.group) return hit(nodeTexts(node)) ? [node] : [];
        if (hit(nodeTexts(node))) return [node];
        const children = cutNodes(node.children);
        return children.length ? [{ ...node, children }] : [];
    });

    const cutGroup = (group) => {
        if (hit([group.label])) return group;
        if (group.groups) {
            const groups = group.groups.map(cutGroup).filter(Boolean);
            return groups.length ? { ...group, groups } : null;
        }
        const entries = group.entries.filter(({ kind, item }) => hit(rowTexts(kind, item)));
        return entries.length ? { ...group, entries } : null;
    };

    return { stored: cutNodes(model.stored), groups: model.groups.map(cutGroup).filter(Boolean) };
}
