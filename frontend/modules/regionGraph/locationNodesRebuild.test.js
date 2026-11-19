/**
 * The location-node rebuild bug (CC/docs/region-map/region-graph-checks.md). A rebuild removes every Cytoscape
 * element, so the location nodes drawn by force-show / zoom went with it, and `locationsVisible` stayed true, so
 * updateZoomBasedVisibility never drew them again. A `locationVisibility` written through the settings (not the
 * radio) was never read back either. These pin the three pieces of the fix against a stub `cy`:
 *   - redrawLocationNodesForMode (after a build) re-applies the mode, and hover re-draws the hovered region;
 *   - reseatLocationNodes (after a layout) re-selects bulk-drawn nodes, and moves hover's one region;
 *   - loadLocationVisibilityMode follows the setting and re-draws a built graph when the mode changed.
 * The in-app row `test_region_graph_location_nodes_survive_rebuild` drives the same path in the browser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let settings = {};
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: { getStaticData: () => null, getLatestStateSnapshot: () => null },
    getLastRawJsonData: () => null,
}));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({ default: {} }));
vi.mock('../../app/core/settingsManager.js', () => ({
    default: { getSetting: async (k, d) => (k in settings ? settings[k] : d), updateSetting: async (k, v) => { settings[k] = v; } },
}));
vi.mock('./index.js', () => ({
    getModuleEventBus: () => ({ publish() {} }),
    getNodeLabelProvider: () => null,
    getEdgeVisibilityFilter: () => null,
    getAccessibilityVisibilityFilter: () => null,
}));

const { GraphDataManager } = await import('./graphDataManager.js');
const { GraphInteractionManager } = await import('./graphInteractionManager.js');
const { LayoutControlsManager } = await import('./layoutControlsManager.js');

/** A stub cy: region ids that exist, and the location nodes currently drawn (by parent region). */
function stubCy(regionIds, drawnParents = []) {
    const drawn = drawnParents.map((p) => ({ data: (k) => (k === 'parentRegion' ? p : undefined) }));
    return {
        zoom: () => 1,
        getElementById: (id) => ({ length: regionIds.includes(id) ? 1 : 0 }),
        nodes: (sel) => {
            if (sel !== '.location-node') throw new Error(`unexpected selector ${sel}`);
            return { length: drawn.length, forEach: (f) => drawn.forEach(f) };
        },
    };
}

/** A ui wired the way RegionGraphUI wires its managers, with the draw calls recorded. */
function makeUi({ mode, cy, locationsVisible = false, hovered = null }) {
    const calls = [];
    const ui = {
        cy, locationVisibilityMode: mode, locationsVisible, _hoveredLocationRegion: hovered,
        graphInitialized: true, zoomLevels: { showLocationNodes: 0.5 }, controlPanel: null,
        showAllLocationNodes: () => calls.push('showAll'),
        hideAllLocationNodes: () => calls.push('hideAll'),
        refreshLocationNodes: () => calls.push('refresh'),
    };
    ui.dataManager = new GraphDataManager(ui);
    ui.interactionManager = new GraphInteractionManager(ui);
    ui.layoutControlsManager = new LayoutControlsManager(ui);
    ui.updateZoomBasedVisibility = () => ui.interactionManager.updateZoomBasedVisibility();
    ui.interactionManager.updateLabelVisibility = () => {};
    ui.dataManager.showLocationNodesForRegion = (id) => calls.push(`show:${id}`);
    ui.dataManager.hideLocationNodesForRegion = (id) => calls.push(`hide:${id}`);
    ui.dataManager.updateLocationNodePositions = (id) => calls.push(`reseat:${id}`);
    ui.dataManager.refreshLocationNodes = () => calls.push('refresh');
    return { ui, calls };
}

beforeEach(() => { settings = {}; });

describe('after a rebuild (buildGraphFromRegions resets locationsVisible, then redrawLocationNodesForMode)', () => {
    it('force-show draws every location node again', () => {
        const { ui, calls } = makeUi({ mode: 'force-show', cy: stubCy(['A']) });
        ui.dataManager.redrawLocationNodesForMode();
        expect(calls).toEqual(['showAll']);
        expect(ui.locationsVisible).toBe(true);
    });
    it('before the fix the stale flag was the bug: locationsVisible true draws nothing', () => {
        const { ui, calls } = makeUi({ mode: 'force-show', cy: stubCy(['A']), locationsVisible: true });
        ui.interactionManager.updateZoomBasedVisibility();
        expect(calls).toEqual([]);
    });
    it('zoom mode past the threshold draws them again', () => {
        const { ui, calls } = makeUi({ mode: 'zoom', cy: stubCy(['A']) });
        ui.dataManager.redrawLocationNodesForMode();
        expect(calls).toEqual(['showAll']);
    });
    it('force-hide and hover draw nothing in bulk', () => {
        for (const mode of ['force-hide', 'hover']) {
            const { ui, calls } = makeUi({ mode, cy: stubCy(['A']) });
            ui.dataManager.redrawLocationNodesForMode();
            expect(calls).toEqual([]);
            expect(ui.locationsVisible).toBe(false);
        }
    });
    it('hover re-draws the region still under the pointer', () => {
        const { ui, calls } = makeUi({ mode: 'hover', cy: stubCy(['A']), hovered: 'A' });
        ui.dataManager.redrawLocationNodesForMode();
        expect(calls).toEqual(['show:A']);
        expect(ui._hoveredLocationRegion).toBe('A');
    });
    it('a hovered region the new graph lacks is dropped', () => {
        const { ui, calls } = makeUi({ mode: 'hover', cy: stubCy(['B']), hovered: 'A' });
        ui.dataManager.redrawLocationNodesForMode();
        expect(calls).toEqual(['hide:A']);
        expect(ui._hoveredLocationRegion).toBe(null);
    });
    it('leaving hover mode drops the hovered region, then draws the new mode', () => {
        const { ui, calls } = makeUi({ mode: 'force-show', cy: stubCy(['A']), hovered: 'A' });
        ui.dataManager.redrawLocationNodesForMode();
        expect(calls).toEqual(['hide:A', 'showAll']);
        expect(ui._hoveredLocationRegion).toBe(null);
    });
});

describe('after a layout settles (reseatLocationNodes)', () => {
    it('bulk-drawn nodes are re-selected (the nearest-to-centre cap reads the final positions)', () => {
        const { ui, calls } = makeUi({ mode: 'force-show', cy: stubCy(['A', 'B'], ['A', 'B']), locationsVisible: true });
        ui.dataManager.reseatLocationNodes();
        expect(calls).toEqual(['refresh']);
    });
    it("hover's one region is moved back around its node", () => {
        const { ui, calls } = makeUi({ mode: 'hover', cy: stubCy(['A'], ['A', 'A']), hovered: 'A' });
        ui.dataManager.reseatLocationNodes();
        expect(calls).toEqual(['reseat:A']);
    });
});

describe('loadLocationVisibilityMode (a settings write, not only the radio)', () => {
    it('follows the setting and re-draws a built graph when the mode changed', async () => {
        settings['moduleSettings.regionGraph.locationVisibility'] = 'force-show';
        const { ui, calls } = makeUi({ mode: 'hover', cy: stubCy(['A']) });
        await ui.layoutControlsManager.loadLocationVisibilityMode();
        expect(ui.locationVisibilityMode).toBe('force-show');
        expect(calls).toEqual(['showAll']);
    });
    it('an unchanged mode re-draws nothing (the radio already drew it)', async () => {
        settings['moduleSettings.regionGraph.locationVisibility'] = 'force-show';
        const { ui, calls } = makeUi({ mode: 'force-show', cy: stubCy(['A']), locationsVisible: true });
        await ui.layoutControlsManager.loadLocationVisibilityMode();
        expect(calls).toEqual([]);
    });
    it('before the first build it only records the mode (the build draws it)', async () => {
        settings['moduleSettings.regionGraph.locationVisibility'] = 'force-show';
        const { ui, calls } = makeUi({ mode: 'hover', cy: stubCy([]) });
        ui.graphInitialized = false;
        await ui.layoutControlsManager.loadLocationVisibilityMode();
        expect(ui.locationVisibilityMode).toBe('force-show');
        expect(calls).toEqual([]);
    });
});
