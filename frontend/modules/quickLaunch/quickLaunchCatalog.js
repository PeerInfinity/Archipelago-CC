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
 *   docsIndex        generated/docsIndex.js DOCS_INDEX — the guides that exist
 *   loadPriority     moduleManager.getLoadPriority() — the standard order
 *   lookup           (componentType, entry) → the moduleInfo the fields come
 *                    from, or null; defaults to `lookupModuleInfo`
 *
 * ⛔ Per-module data comes from each module's own `moduleInfo` (⚖ the user,
 * 2026-09-24): no hand list of panels, titles, icons or doc paths lives here,
 * and `app/core/moduleMetadata.js` is not consulted. A module that declares
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

/** The Help group's section order: the general guides, then the per-panel ones. */
export const DOC_SECTION_ORDER = Object.freeze(['user', 'user/modules']);

/**
 * The title/icon lookup order the mobile layout uses
 * (`app/initialization/layoutManager.js` setupMobileLayout), minus its last
 * step, the `moduleMetadata.js` fallback table: the moduleInfo registered with
 * the component, then a `moduleInfo` static on the component class.
 */
export function lookupModuleInfo(componentType, entry) {
    return entry?.moduleInfo || entry?.componentClass?.moduleInfo || null;
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function buildCatalog({
    panelComponents,
    moduleStates = {},
    docsIndex = [],
    loadPriority = [],
    lookup = lookupModuleInfo,
}) {
    const docPaths = new Set(docsIndex.map((d) => d.path));
    const panels = [];
    for (const [componentType, entry] of panelComponents) {
        const info = lookup(componentType, entry) || {};
        const moduleId = entry.moduleId;
        const priority = loadPriority.indexOf(moduleId);
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
            // Only a path the index knows is linked: a typo is no link, not a 404.
            docs: info.docs && docPaths.has(info.docs) ? info.docs : null,
            order: priority === -1 ? loadPriority.length : priority,
        });
    }
    panels.sort((a, b) => a.order - b.order || byText(a.title, b.title));

    const sectionRank = (s) => {
        const i = DOC_SECTION_ORDER.indexOf(s);
        return i === -1 ? DOC_SECTION_ORDER.length : i;
    };
    const docs = docsIndex
        .map(({ path, title, section }) => ({ path, title, section }))
        .sort((a, b) => sectionRank(a.section) - sectionRank(b.section) || byText(a.path, b.path));

    return { panels, docs };
}

/** The id of the "All panels" sub-group for `category`: `all-panels/<slug>`. */
export function categoryGroupId(category) {
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${VIRTUAL_GROUPS.allPanels.id}/${slug}`;
}

/**
 * The groups the panel draws, in order. "All panels" holds no rows of its own:
 * `groups` is one sub-group per category, in `categoryOrder` (the modules
 * README's section order), each keeping the catalog's load-priority order;
 * a category `categoryOrder` does not list counts as OTHER_CATEGORY, which
 * comes last and only when it has a panel. Empty categories are left out.
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
        { ...VIRTUAL_GROUPS.help, items: catalog.docs },
    ];
}
