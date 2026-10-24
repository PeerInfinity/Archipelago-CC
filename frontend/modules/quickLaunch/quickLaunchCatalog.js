/**
 * quickLaunchCatalog — PURE: what the Quick Launch panel lists, derived from
 * the live registry every render and never stored.
 *
 * `buildCatalog` takes everything it reads as arguments (no window, no
 * registry import), so a vitest can hand it fixtures:
 *
 *   panelComponents  centralRegistry.getAllPanelComponents() — Map
 *                    componentType → { moduleId, componentClass, moduleInfo }
 *   moduleStates     moduleManager.getAllModuleStates() — { moduleId: { enabled } }
 *   docsIndex        generated/docsIndex.js DOCS_INDEX — the docs that exist
 *   helpSections     generated/docsIndex.js HELP_SECTIONS — how Help groups them
 *   showDeveloperDocs  the panel's setting: draw the `developer` sections too
 *   loadPriority     moduleManager.getLoadPriority() — the standard order
 *   lookup           (componentType, entry) → the moduleInfo the fields come
 *                    from, or null; defaults to `lookupModuleInfo`
 *
 * ⛔ Per-module data comes from each module's own `moduleInfo` (⚖ the user,
 * 2026-09-24): no hand list of panels, titles, icons or doc paths lives here
 * (nor anywhere else — the mobile fallback table is gone). A module that declares
 * nothing still gets a row — titled by its componentType, with a blank icon.
 */

import { CATEGORY_ORDER } from './generated/docsIndex.js';

export const BLANK_ICON = '';

/** The category of a panel that declares none, or one CATEGORY_ORDER does not list; drawn last. */
export const OTHER_CATEGORY = 'Other';

/** The groups rendered from the catalog; none is stored or editable. `unfiled`
 *  (the entries the user's own tree does not reference) is drawn by the panel
 *  from quickLaunchTree.js `unfiled()`, so `virtualGroups` does not return it. */
export const VIRTUAL_GROUPS = Object.freeze({
    unfiled: Object.freeze({ id: 'unfiled', label: 'Unfiled' }),
    allPanels: Object.freeze({ id: 'all-panels', label: 'All panels' }),
    help: Object.freeze({ id: 'help', label: 'Help' }),
});

/**
 * The HELP_SECTIONS audiences Help draws: `user` always, `developer` with the
 * showDeveloperDocs setting on, `panel` never (those guides are the `?` on each
 * panel row; they stay indexed so the links resolve).
 */
export const DRAWN_AUDIENCES = Object.freeze({ always: Object.freeze(['user']), developer: 'developer' });

/** The sections Help draws, in HELP_SECTIONS order. */
export function drawnHelpSections(sections, showDeveloperDocs = false) {
    return sections.filter((s) => DRAWN_AUDIENCES.always.includes(s.audience)
        || (showDeveloperDocs && s.audience === DRAWN_AUDIENCES.developer));
}

/** The id of a Help section or sub-group: `help/<its directory under docs/json>`. */
export function helpGroupId(dir) {
    return `${VIRTUAL_GROUPS.help.id}/${dir}`;
}

/**
 * The title/icon lookup order the mobile layout uses
 * (`app/initialization/layoutManager.js` setupMobileLayout), minus its
 * module-loader maps: the moduleInfo registered with the component, then a
 * `moduleInfo` static on the component class.
 */
export function lookupModuleInfo(componentType, entry) {
    return entry?.moduleInfo || entry?.componentClass?.moduleInfo || null;
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function buildCatalog({
    panelComponents,
    moduleStates = {},
    docsIndex = [],
    helpSections = [],
    showDeveloperDocs = false,
    loadPriority = [],
    lookup = lookupModuleInfo,
}) {
    const docByPath = new Map(docsIndex.map((d) => [d.path, d]));
    const panels = [];
    for (const [componentType, entry] of panelComponents) {
        const info = lookup(componentType, entry) || {};
        const moduleId = entry.moduleId;
        const priority = loadPriority.indexOf(moduleId);
        // Only a path the index knows is linked: a typo is no link, not a 404.
        const guide = info.docs ? docByPath.get(info.docs) : undefined;
        panels.push({
            componentType,
            moduleId,
            title: info.title || info.name || componentType,
            icon: info.icon || BLANK_ICON,
            description: info.description || '',
            category: info.category || OTHER_CATEGORY,
            column: info.column ?? null,
            enabled: moduleStates[moduleId]?.enabled === true,
            allowMultipleInstances: info.allowMultipleInstances === true,
            docs: guide ? guide.path : null,
            // The guide's first paragraph: the cards view's text when `description` is empty.
            summary: guide?.summary || '',
            order: priority === -1 ? loadPriority.length : priority,
        });
    }
    panels.sort((a, b) => a.order - b.order || byText(a.title, b.title));

    const docs = docsIndex
        .map(({ path, title, section, summary = '' }) => ({ path, title, section, summary }))
        .sort((a, b) => byText(a.path, b.path));

    // Help: the drawn sections, their paths resolved to `docs` entries (a path the index lacks is dropped).
    const entryOf = new Map(docs.map((d) => [d.path, d]));
    const resolveAll = (paths) => paths.map((p) => entryOf.get(p)).filter(Boolean);
    const help = drawnHelpSections(helpSections, showDeveloperDocs).map((section) => ({
        dir: section.dir,
        label: section.label,
        docs: resolveAll(section.docs),
        children: section.children.map((c) => ({ dir: c.dir, label: c.label, single: c.single, docs: resolveAll(c.docs) }))
            .filter((c) => c.docs.length > 0),
    }));

    return { panels, docs, help };
}

/** The id of the "All panels" sub-group for `category`: `all-panels/<slug>`. */
export function categoryGroupId(category) {
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${VIRTUAL_GROUPS.allPanels.id}/${slug}`;
}

/** Every doc Help draws, in drawn order (the header's count, and what Unfiled may list). */
export function helpDocs(catalog) {
    return (catalog.help ?? []).flatMap((s) => [...s.docs, ...s.children.flatMap((c) => c.docs)]);
}

/**
 * One Help section as a group: its own docs, then each single child's doc, as
 * `items`; each child holding more than one doc as a sub-group in `groups`.
 */
function helpSectionGroup(section) {
    const singles = section.children.filter((c) => c.single);
    return {
        id: helpGroupId(section.dir),
        label: section.label,
        items: [...section.docs, ...singles.flatMap((c) => c.docs)],
        groups: section.children.filter((c) => !c.single)
            .map((c) => ({ id: helpGroupId(c.dir), label: c.label, items: c.docs })),
    };
}

/**
 * The groups the panel draws, in order. "All panels" holds no rows of its own:
 * `groups` is one sub-group per category, in `categoryOrder` (the modules
 * README's section order), each keeping the catalog's load-priority order;
 * a category `categoryOrder` does not list counts as OTHER_CATEGORY, which
 * comes last and only when it has a panel. Empty categories are left out.
 * Help likewise holds one sub-group per drawn section (`catalog.help`), which
 * may hold rows and sub-groups of its own (`helpSectionGroup`).
 */
export function virtualGroups(catalog, categoryOrder = CATEGORY_ORDER) {
    const known = new Set(categoryOrder);
    const byCategory = new Map([...categoryOrder, OTHER_CATEGORY].map((c) => [c, []]));
    for (const panel of catalog.panels) {
        byCategory.get(known.has(panel.category) ? panel.category : OTHER_CATEGORY).push(panel);
    }
    const groups = [...byCategory]
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => ({ id: categoryGroupId(label), label, items }));
    return [
        { ...VIRTUAL_GROUPS.allPanels, groups },
        { ...VIRTUAL_GROUPS.help, groups: (catalog.help ?? []).map(helpSectionGroup) },
    ];
}
