/**
 * ⛓ SUB-REGION VIEW — IDENTITY PIN (region-graph-groups-a). With `subRegionView` at its default (`separate`), the
 * Region Graph's element set (nodes + edges: ids, data, classes) is the one the graph drew BEFORE the setting existed.
 *
 * The digests below were recorded by THIS file on the base commit (6dbadc7364, before any grouping code), through the
 * panel's own builder on a headless Cytoscape (`regionGraphElements.testkit.js`), on three presets at three states
 * each. A change that moves one is a change to what `separate` draws — which this slice must not make.
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

const { GraphDataManager } = await import('./graphDataManager.js');
const kit = await import('./regionGraphElements.testkit.js');

export const PRESETS = [
    ['seedling_playthrough', 'seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json'],
    ['alttp', 'alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json'],
    ['procgen_maze', 'procgen_maze/AP_3/AP_3_rules.json'],
];

/** The element-set digest per preset per state, recorded at base 6dbadc7364. */
const PINS = {
    seedling_playthrough: { start: '4f315a341e062bf8', mid: '8760984c763bdf2e', end: '1fc2aacecc19bb36' },
    alttp: { start: '792bf711f6c3d36b', mid: '9b9f872a2012751e', end: 'fc1c2cfa0ae4e366' },
    procgen_maze: { start: '47e4ff50a382e106', mid: '09c8c677aff8563f', end: '7605415a11b70d3f' },
};

/** Build the graph once per state on a fresh headless cy; → { state: serialised elements }. */
function capture(rel, extra = {}) {
    const rules = kit.loadRules(rel);
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

describe('⛓ subRegionView = separate draws the base element set (ids, data, classes)', () => {
    for (const [preset, rel] of PRESETS) {
        it(preset, () => {
            const got = capture(rel);
            const digests = Object.fromEntries(Object.entries(got).map(([s, els]) => [s, kit.digestOf(els)]));
            // eslint-disable-next-line no-console
            console.log(`[identity] ${preset} ${JSON.stringify(digests)} nodes=${got.start.filter((e) => e.group === 'nodes').length} edges=${got.start.filter((e) => e.group === 'edges').length}`);
            // The capture is not vacuous: onStateUpdate coloured the regions at every state.
            for (const els of Object.values(got)) {
                expect(els.some((e) => e.classes.includes('region') && (e.classes.includes('accessible') || e.classes.includes('inaccessible')))).toBe(true);
            }
            expect(digests).toEqual(PINS[preset]);
        });
    }
});
