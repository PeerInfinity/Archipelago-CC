/**
 * ⛓ SUB-REGION VIEW — IDENTITY PIN (region-graph-groups-a; made STRUCTURAL in region-graph-groups-c). With
 * `subRegionView` at its default (`separate`), the Region Graph's element set (nodes + edges: ids, data, classes) is
 * the one the graph drew BEFORE the setting existed.
 *
 * The digests below were recorded by groups-a on its base commit (6dbadc7364, before any grouping code), through the
 * panel's own builder on a headless Cytoscape (`regionGraphElements.testkit.js`), three presets at three states.
 * ⛓ groups-c (the planner's ruling, 2026-11-24): they are now read over FROZEN copies of those presets
 * (`kit.loadFrozenRules`, taken at 146d8f6ef8), never the live ones, so a legitimate change to a live preset's rules
 * cannot trip them; a change to what `separate` draws still does. The digests are the same ones: the frozen copies
 * hold every field the builder reads. The live preset is still exercised by the SMOKE row below (not a digest).
 */
import { describe, it, expect, vi } from 'vitest';

const sm = { staticData: null, snapshot: null };
vi.mock('./index.js', () => ({
    getNodeLabelProvider: () => null,
    getEdgeVisibilityFilter: () => null,
    getAccessibilityVisibilityFilter: () => null,
}));
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: {
        getStaticData: () => sm.staticData,
        getLatestStateSnapshot: () => sm.snapshot,
        getStartRegions: () => sm.snapshot?.startRegions?.default ?? [],
    },
    getLastRawJsonData: () => (sm.rules ? { rawJsonData: sm.rules, selectedPlayerInfo: { playerId: '1' } } : null),
}));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));
// Rules evaluate deterministically off their own text (the identity is about the builder, not the rule engine).
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => JSON.stringify(rule).length % 3 !== 0 }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
// The Seedling fold for the smoke row's grouped views (`separate` never folds).
const hooks = vi.hoisted(() => ({ seedling: null }));
vi.mock('../shared/procgen/substrateRegistry.js', () => ({
    substrateRegistry: { get: (id) => (id === 'flash_seedling' ? { compositeMap: { displayRegionOf: (...a) => hooks.seedling(...a) } } : null) },
}));

const { GraphDataManager } = await import('./graphDataManager.js');
const { SUB_REGION_VIEW_SCHEMA, isRegionGroupNode } = await import('./subRegionGroups.js');
const kit = await import('./regionGraphElements.testkit.js');
hooks.seedling = (await import('../flashPanel/seedlingCompositeMap.js')).seedlingDisplayRegionOf;

/** The presets (frozen copies; `kit.FROZEN`). */
export const PRESETS = ['seedling_playthrough', 'alttp', 'procgen_maze'];

/** The element-set digest per preset per state, recorded at base 6dbadc7364 (groups-a). */
const PINS = {
    seedling_playthrough: { start: '4f315a341e062bf8', mid: '8760984c763bdf2e', end: '1fc2aacecc19bb36' },
    alttp: { start: '792bf711f6c3d36b', mid: '9b9f872a2012751e', end: 'fc1c2cfa0ae4e366' },
    procgen_maze: { start: '47e4ff50a382e106', mid: '09c8c677aff8563f', end: '7605415a11b70d3f' },
};

/** Build the graph once per state on a fresh headless cy; → { state: serialised elements }. */
function capture(rules, extra = {}) {
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    const out = {};
    for (const { name, snapshot } of kit.threeStates(rules, regions)) {
        sm.staticData = { regions, exits: null };
        sm.snapshot = snapshot;
        const ui = kit.makeUi(kit.loadCytoscape(), extra);
        new GraphDataManager(ui).buildGraphFromRegions(regions, null);
        out[name] = kit.serialiseElements(ui.cy);
    }
    return out;
}

describe('⛓ subRegionView = separate draws the base element set (ids, data, classes) — frozen presets', () => {
    for (const preset of PRESETS) {
        it(preset, () => {
            const got = capture(kit.loadFrozenRules(preset));
            const digests = Object.fromEntries(Object.entries(got).map(([s, els]) => [s, kit.digestOf(els)]));
            // eslint-disable-next-line no-console
            console.log(`[identity] ${preset} (frozen) ${JSON.stringify(digests)} nodes=${got.start.filter((e) => e.group === 'nodes').length} edges=${got.start.filter((e) => e.group === 'edges').length}`);
            // The capture is not vacuous: onStateUpdate coloured the regions at every state.
            for (const els of Object.values(got)) {
                expect(els.some((e) => e.classes.includes('region') && (e.classes.includes('accessible') || e.classes.includes('inaccessible')))).toBe(true);
            }
            expect(digests).toEqual(PINS[preset]);
        });
    }
});

describe('⛓ the LIVE preset still builds (a smoke row, not a digest)', () => {
    it('seedling_playthrough: every subRegionView value builds without error, with region nodes and edges', () => {
        const rules = kit.loadRules('seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json');
        const regions = kit.regionsOf(rules);
        sm.rules = rules;
        sm.staticData = { regions, exits: null };
        sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === 'mid').snapshot;
        for (const view of SUB_REGION_VIEW_SCHEMA.enum) {
            const ui = kit.makeUi(kit.loadCytoscape(), { subRegionView: view });
            new GraphDataManager(ui).buildGraphFromRegions(regions, null);
            const regionNodes = ui.cy.nodes('.region').length;
            const groupNodes = ui.cy.nodes().filter((n) => isRegionGroupNode(n)).length;
            expect(regionNodes, view).toBeGreaterThan(0);
            expect(ui.cy.edges().length, view).toBeGreaterThan(0);
            if (view !== 'separate') expect(groupNodes, view).toBeGreaterThan(0);
        }
    });
});
