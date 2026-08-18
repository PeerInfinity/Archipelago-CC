/**
 * reference/catalogue — **TABLE 2: THE GENERATION CATALOGUE** — per biome the
 * boot items, the pass-2 templates and their parameter schemas, the EXCLUDED
 * rows with the measurement that excluded them, the biome's DEFAULT element
 * spec and every skeleton kind with both the codec's defaults and the binding's
 * effective ones; plus the ELEMENT heads.
 *
 * ⛓ Split out of `generate-procgen-reference.mjs` unchanged (P3b, D0).
 */

import { M } from './sources.mjs';


const paramRow = (p) => ({
    key: p.key,
    domain: [...p.domain],
    default: p.default,
    why: p.why ?? null,
});

const templateRow = (t) => ({
    name: t.name,
    family: t.family,
    site: t.site ?? null,
    why: t.why ?? null,
    params: (t.params ?? []).map(paramRow),
});

const excludedRow = (t) => ({
    name: t.name,
    family: t.family,
    cause: t.cause,
    measured: t.measured,
    wouldNeed: t.wouldNeed,
    hasRefusalText: Boolean(t.refusalText),
});

function skeletonRows(substrate) {
    const simulator = substrate === 'maze';
    return M.skeletonKinds.skeletonCatalogue({ simulator }).map((k) => {
        const codecDefaults = M.skeletonKinds.resolveSkeletonParams(k.kind, {});
        const effective = simulator
            ? codecDefaults
            : (M.seedling.seedlingSkeletonSpec({ kind: k.kind }).params ?? {});
        return {
            kind: k.kind,
            name: k.name,
            description: k.description,
            backend: k.backend,
            postProcessors: [...k.postProcessors],
            isDefault: k.isDefault,
            offered: k.offered,
            needs: k.why,
            params: (k.params ?? []).map(paramRow),
            codecDefaults: { ...codecDefaults },
            effectiveDefaults: { ...codecDefaults, ...effective },
            spelledExplicitlyInTheUrl: simulator
                ? [] : [...M.seedling.seedlingExplicitSkeletonParams(k.kind)],
        };
    });
}

export function buildCatalogue() {
    const { PRE_SWORD_PALETTE, POST_SWORD_PALETTE, EXCLUDED_TEMPLATES,
        POST_SWORD_EXCLUDED_TEMPLATES } = M.palette;

    const biomes = [
        {
            id: 'pre-sword',
            substrate: 'seedling',
            page: '/frontend/modules/seedlingDemo/watch.html',
            items: { ...PRE_SWORD_PALETTE.items },
            templates: PRE_SWORD_PALETTE.templates.map(templateRow),
            excluded: EXCLUDED_TEMPLATES.map(excludedRow),
            defaultElements: M.elementSpec.formatElementSpec(
                M.seedling.defaultElementsFor(PRE_SWORD_PALETTE.items),
            ),
            skeletonKinds: skeletonRows('seedling'),
        },
        {
            id: 'post-sword',
            substrate: 'seedling',
            page: '/frontend/modules/seedlingDemo/watch.html',
            items: { ...POST_SWORD_PALETTE.items },
            templates: POST_SWORD_PALETTE.templates.map(templateRow),
            excluded: [...EXCLUDED_TEMPLATES, ...POST_SWORD_EXCLUDED_TEMPLATES].map(excludedRow),
            defaultElements: M.elementSpec.formatElementSpec(
                M.seedling.defaultElementsFor(POST_SWORD_PALETTE.items),
            ),
            skeletonKinds: skeletonRows('seedling'),
        },
        {
            id: 'maze-v1',
            substrate: 'maze',
            page: '/frontend/modules/mazeRoom/lab.html',
            items: M.maze.MAZE_PALETTE.items,
            templates: M.maze.MAZE_PALETTE.templates.map(templateRow),
            excluded: [],
            defaultElements: M.elementSpec.formatElementSpec(M.elementSpec.DEFAULT_ELEMENTS),
            skeletonKinds: skeletonRows('maze'),
        },
    ];

    const elements = Object.entries(M.elementSpec.ELEMENT_TABLE).map(([head, entry]) => ({
        head,
        why: entry.why,
        needs: [...(entry.needs ?? [])],
        module: entry.element?.name ?? null,
        params: M.elementSpec.paramSchemaFor(head).map(paramRow),
    }));

    return {
        biomes,
        elements,
        elementNames: [...M.elementSpec.ELEMENT_NAMES],
        elementListSeparator: '+',
        itemsElementsNeed: [...M.elementSpec.ITEMS_ELEMENTS_NEED],
        killLockTemplates: {
            count: M.palette.POST_SWORD_TEMPLATES.length - M.palette.PRE_SWORD_TEMPLATES.length,
            note: 'The post-sword-EXCLUSIVE roster. It is EMPTY by design since arc 3 slice 4c '
                + 'retired `wall-gap-spinner-killlock`: the room-aware `killgate` ELEMENT does '
                + 'its job, gated by `needs: [\'hasSword\']` in ELEMENT_TABLE. The array stays '
                + 'so POST_SWORD_TEMPLATES is a superset BY CONSTRUCTION.',
        },
        bounds: { ...M.levelGenerator.DEFAULT_BOUNDS },
        vocabulary: {
            keepPolicy: { ...M.levelGenerator.KEEP_POLICY },
            keptKind: { ...M.levelGenerator.KEPT_KIND },
        },
    };
}
