/**
 * ⛓ TWO-WAY EDGES DRAW AS ONE (ActionNodes AN-1b). The compiler writes a forward AND a reverse exit for every `after`
 * edge; the Region Graph merges an exit pair A→B + B→A into ONE edge (`buildGraphFromRegions`, its pair dedup). This
 * builds the graph from the compiled example world and counts: one drawn edge per `after` edge, plus `Menu → start`
 * (one-way: there is no exit back to Menu).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('./index.js', () => ({
    getNodeLabelProvider: () => null,
    getEdgeVisibilityFilter: () => null,
    getAccessibilityVisibilityFilter: () => null,
}));
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: {
        getStaticData: () => null,
        getLatestStateSnapshot: () => null,
        getStartRegions: () => ['Menu'],
    },
    getLastRawJsonData: () => null,
}));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));

const { GraphDataManager } = await import('./graphDataManager.js');
const { compileActionGraph } = await import('../actionNodes/actionGraphCompiler.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GRAPH = JSON.parse(readFileSync(join(HERE, '../actionNodes/graphs/example-village.json'), 'utf8'));
const P = '1';

function drawnElements(rules) {
    let added = null;
    const ui = {
        controlPanel: null,
        isDiscoveryModeActive: false,
        discoverySettings: null,
        nodePositions: new Map(),
        cy: { elements: () => ({ remove() {} }), add: (els) => { added = els; }, fit() {} },
        runLayout() {},
        updateStatus() {},
        getRegionDisplayText: (r) => r?.name ?? '',
        getCurrentPlayerLocation: () => null,
    };
    const regions = new Map(Object.entries(rules.regions[P]).map(([name, r]) => [name, { ...r, name }]));
    new GraphDataManager(ui).buildGraphFromRegions(regions, null);
    return added;
}

describe('⛓ the compiled ActionNodes example draws ONE Region Graph edge per `after` edge', () => {
    const { rules } = compileActionGraph(GRAPH);
    const els = drawnElements(rules);
    const afterEdges = Object.entries(GRAPH.nodes).flatMap(([b, n]) => [...new Set((n.after ?? []).flat())].map((a) => [a, b]));

    it('edges = `after` edges + the one-way Menu → start hop', () => {
        expect(afterEdges.length).toBeGreaterThan(0);
        expect(els.edges).toHaveLength(afterEdges.length + 1);
    });
    it('every node edge is one merged two-way pair; the Menu edge is one-way', () => {
        for (const [a, b] of afterEdges) {
            const e = els.edges.find((x) => (x.data.source === a && x.data.target === b) || (x.data.source === b && x.data.target === a));
            expect(e, `${a} - ${b}`).toBeTruthy();
            expect(e.data.isBidirectional, `${a} - ${b}`).toBe(true);
        }
        const menu = els.edges.find((x) => x.data.source === 'Menu');
        expect(menu.data.target).toBe(GRAPH.start);
        expect(menu.data.isBidirectional).toBe(false);
    });
    it('the layout still runs parent → child along the `after` edges (the forward direction)', () => {
        for (const [a, b] of afterEdges) {
            const e = els.edges.find((x) => (x.data.source === a && x.data.target === b) || (x.data.source === b && x.data.target === a));
            expect([e.data.source, e.data.target], `${a} - ${b}`).toEqual([a, b]);
        }
    });
});
