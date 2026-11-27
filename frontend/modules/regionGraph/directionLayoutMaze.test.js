/**
 * region-map-maze-hooks — the Region Graph's Direction-aware layout on a MAZE world (frozen procgen_topdown AP_1:
 * `mazeRoom/fixtures/region-map-hooks/procgen_topdown.rules.json.gz`), merged + map look, default settings.
 *
 * The layout reads each exit's door tile against its level's extent (`directionLayout.exitDirections`), and a maze
 * level's extent is now the maze's own `compositeMap.regionExtent` — so every maze exit has a preferred direction, the
 * side its door is on, and the layout honours it. Before this slice a maze level had no extent and no exit had one.
 * (The harness and its mocks are `directionLayout.test.js`'s.)
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';

const sm = { staticData: null, snapshot: null, rules: null };
vi.mock('./index.js', () => ({
    getNodeLabelProvider: () => null,
    getEdgeVisibilityFilter: () => null,
    getAccessibilityVisibilityFilter: () => null,
    getModuleEventBus: () => ({ publish() {} }),
    moduleDispatcher: null,
}));
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: {
        getStaticData: () => sm.staticData,
        getLatestStateSnapshot: () => sm.snapshot,
        getStartRegions: () => sm.snapshot?.startRegions?.default ?? [],
    },
    getLastRawJsonData: () => (sm.rules ? { rawJsonData: sm.rules, selectedPlayerInfo: { playerId: '1' } } : null),
}));
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async (_k, d) => d, updateSetting: async () => {} } }));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => JSON.stringify(rule).length % 3 !== 0 }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));

// ⛓ The shipped Seedling atlases → the FROZEN ones the frozen rules were cut against (regionGraphElements.testkit.js
// `FROZEN_ATLASES`): a live restamp (L25) would otherwise leave every frozen `atlas_ref` resolving to nothing.
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));
await import('../flashPanel/flashSeedlingLibrary.js');
await import('../mazeRoom/mazeRoomLibrary.js');
const { GraphDataManager } = await import('./graphDataManager.js');
const { LayoutControlsManager } = await import('./layoutControlsManager.js');
const { MapLookLayer } = await import('./mapLookLayer.js');
const { isRegionGroupNode, groupNodeId, SUB_REGION_VIEW_SCHEMA } = await import('./subRegionGroups.js');
const D = await import('./directionLayout.js');
const kit = await import('./regionGraphElements.testkit.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const cytoscape = kit.loadCytoscape();
const NODE_STYLE = [{ selector: 'node', style: { width: 60, height: 45, 'border-width': 2, shape: 'ellipse' } }];
const RULES = JSON.parse(gunzipSync(readFileSync(join(HERE, '..', 'mazeRoom', 'fixtures', 'region-map-hooks', 'procgen_topdown.rules.json.gz'))).toString('utf8'));

function build(rules, view, nodeLook) {
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === 'mid').snapshot;
    const ui = kit.makeUi(cytoscape, {
        cy: cytoscape({ headless: true, styleEnabled: true, style: NODE_STYLE }), subRegionView: view, nodeLook, runLayout() {},
    });
    ui.graphContainer = null;
    ui.mapLook = new MapLookLayer(ui);
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    dm.buildGraphFromRegions(regions, null);
    const lcm = new LayoutControlsManager(ui);
    ui.layoutControlsManager = lcm;
    return { ui, lcm };
}

describe('⛓ the Direction-aware layout on procgen_topdown AP_1 (frozen), merged + map look', () => {
    it('every maze exit gives its edge a direction; the layout honours them; the map nodes take the level\'s shape', () => {
        const { ui, lcm } = build(RULES, 'merged', 'map');
        expect(ui.mapLook.sync()).toBe(true);
        const settings = D.normaliseDirectionSettings();
        const inputs = lcm.directionLayoutInputs(settings);
        const { positions, report } = lcm.buildDirectionLayout(settings);
        // 16 exits, every one a border door with a direction; 8 drawn edges (each exit pair is one edge)
        expect(report.counts).toMatchObject({ exits: 16, withDirection: 16, without: 0 });
        expect(inputs.prefs.size).toBe(8);
        // each edge's preferred direction points the way its source's door faces (the payload's `side`)
        const sc = RULES.preset_sidecars['1'];
        const unit = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
        for (const e of inputs.edges) {
            const p = inputs.prefs.get(e.id);
            if (!p) continue;
            const door = sc[e.source].playable_payload.exits.find((x) => x.targetRegion === e.target);
            const [ux, uy] = unit[door.side];
            expect(p.dx * ux + p.dy * uy, `${e.source} → ${e.target} (${door.side})`).toBeGreaterThan(0.8);
        }
        const err = D.angleErrors(inputs.edges, inputs.prefs, positions);
        expect(err.n).toBe(8);
        expect(err.max).toBeLessThan(15);
        expect(report.overlaps).toBe(0);
        // the maze levels are 8 × 6: the map node is its rectangle (72 + the 2 px border on the long side), not a square
        const maze = inputs.nodes.filter((n) => sc[n.id]?.substrate === 'maze');
        expect(maze.length).toBe(9);
        expect(maze.every((n) => n.w === 74 && n.h === 56)).toBe(true);
        // eslint-disable-next-line no-console
        console.log(`[direction-maze] procgen_topdown AP_1: ${err.n} edges, mean ${err.mean.toFixed(1)}°, max ${err.max.toFixed(1)}°`);
        ui.mapLook.dispose();
    });
});
