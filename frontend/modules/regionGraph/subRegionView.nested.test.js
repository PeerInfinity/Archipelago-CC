/**
 * ⛓ SUB-REGION VIEW = nested (option A; region-graph-groups-a). Through the panel's own builder on a headless
 * Cytoscape (`regionGraphElements.testkit.js`), on committed presets:
 *   · the boxes ARE the view model's display groups (`displayGroupsOf`, as `computeRegionView` folds them) of 2+;
 *   · the counts per preset (boxes, members inside them, groups of one); alttp and the maze draw NO box, and their
 *     element set is byte-identical to `separate`'s;
 *   · `separate → nested → separate` on one graph returns the fresh `separate` element set;
 *   · a box is not a region: the tap handler runs no click for it, the pathfinder never routes to it, saved
 *     positions never hold it, and location nodes stay attached to their member region;
 *   · the setting's default is the registered schema's, read with no call-site default.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sm = { staticData: null, snapshot: null, rules: null };
const settingsStore = new Map();
const registeredSchemas = [];
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
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => null }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => JSON.stringify(rule).length % 3 !== 0 }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
// The registry as the app fills it at boot: Seedling's displayRegionOf hook (flashPanel registers it); the maze
// declares a compositeMap with no displayRegionOf.
// (The hook is bound after the imports: importing seedlingCompositeMap inside this factory deadlocks the mock.)
const hooks = vi.hoisted(() => ({ seedling: null }));
vi.mock('../shared/procgen/substrateRegistry.js', () => {
    const entries = {
        flash_seedling: { compositeMap: { displayRegionOf: (...a) => hooks.seedling(...a) } },
        maze: { compositeMap: { drawRegion() {} } },
    };
    return { substrateRegistry: { get: (id) => entries[id] ?? null } };
});
vi.mock('../../app/core/settingsManager.js', () => ({
    default: {
        // The settings manager's precedence without a stored value: the registered schema default, then the call
        // site's (`settingsManager.getSetting`).
        getSetting: async (key, dflt) => {
            if (settingsStore.has(key)) return settingsStore.get(key);
            const prop = key.split('.').pop();
            for (const s of registeredSchemas) if (prop in (s.properties ?? {})) return s.properties[prop].default;
            return dflt;
        },
        updateSetting: async (k, v) => { settingsStore.set(k, v); },
    },
}));

const { GraphDataManager } = await import('./graphDataManager.js');
const { GraphInteractionManager } = await import('./graphInteractionManager.js');
const { LayoutControlsManager } = await import('./layoutControlsManager.js');
const { PathFinder } = await import('./pathfinder.js');
const groupsMod = await import('./subRegionGroups.js');
const { computeRegionView } = await import('../regionView/regionViewState.js');
const { substrateRegistry } = await import('../shared/procgen/substrateRegistry.js');
const kit = await import('./regionGraphElements.testkit.js');
hooks.seedling = (await import('../flashPanel/seedlingCompositeMap.js')).seedlingDisplayRegionOf;

const SEEDLING = 'seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const ALTTP = 'alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const MAZE = 'procgen_maze/AP_3/AP_3_rules.json';

/** Load a preset into the stateManager stub at state `stateName`; → { rules, regions }. */
function load(rel, stateName = 'mid') {
    const rules = kit.loadRules(rel);
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === stateName).snapshot;
    return { rules, regions };
}

/** Build on `ui` (a fresh one by default) with `subRegionView = view`; → { ui, dm, els }. */
function build(regions, view, ui = kit.makeUi(kit.loadCytoscape())) {
    ui.subRegionView = view;
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    dm.buildGraphFromRegions(regions, null);
    return { ui, dm, els: kit.serialiseElements(ui.cy) };
}

const parentsOf = (cy) => cy.nodes().filter((n) => groupsMod.isRegionGroupNode(n));

function countsOf(cy) {
    const parents = parentsOf(cy);
    const inside = cy.nodes('.region').filter((n) => n.isChild()).length;
    const regions = cy.nodes('.region').length;
    return { parents: parents.length, membersInside: inside, groupsOfOne: regions - inside };
}

beforeEach(() => { settingsStore.clear(); });

describe('⛓ nested: the boxes are the view model\'s display groups of 2+', () => {
    it('seedling_playthrough: every box = a `displayGroups` entry with 2+ members, members as children', () => {
        const { rules, regions } = load(SEEDLING);
        const view = computeRegionView({ snapshot: sm.snapshot, staticData: sm.staticData,
            discovery: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
            registry: substrateRegistry, rules, playerId: '1' });
        const expected = [...view.displayGroups.values()].filter((g) => g.members.length > 1);
        const { ui } = build(regions, 'nested');
        const parents = parentsOf(ui.cy);
        expect(expected.length).toBeGreaterThan(0);
        expect(parents.map((p) => p.data('groupKey')).sort()).toEqual(expected.map((g) => g.key).sort());
        for (const g of expected) {
            const p = ui.cy.getElementById(groupsMod.groupNodeId(g.key));
            expect(p.isParent(), g.key).toBe(true);
            expect(p.children().map((c) => c.id()).sort()).toEqual([...g.members].sort());
            expect(p.data('members')).toEqual(g.members);
        }
    });

    it('a box is not a region: no `region` class, no `regionName`, an id no rules region has', () => {
        const { regions } = load(SEEDLING);
        const { ui } = build(regions, 'nested');
        parentsOf(ui.cy).forEach((p) => {
            expect(p.hasClass('region')).toBe(false);
            expect(p.data('regionName')).toBeUndefined();
            expect(regions.has(p.id())).toBe(false);
        });
    });

    it('edges still end on the exact member (the same edge set as separate)', () => {
        const { regions } = load(SEEDLING);
        const sep = build(regions, 'separate').els.filter((e) => e.group === 'edges');
        const nest = build(regions, 'nested').els.filter((e) => e.group === 'edges');
        expect(nest).toEqual(sep);
    });
});

describe('⛓ nested: counts per preset', () => {
    const COUNTS = {};
    it('seedling_playthrough draws boxes; every region is in a box or a group of one', () => {
        const { regions } = load(SEEDLING);
        const { ui } = build(regions, 'nested');
        COUNTS.seedling = countsOf(ui.cy);
        // eslint-disable-next-line no-console
        console.log(`[nested-counts] seedling_playthrough ${JSON.stringify(COUNTS.seedling)} regions=${regions.size}`);
        expect(COUNTS.seedling.parents).toBeGreaterThan(0);
        expect(COUNTS.seedling.membersInside + COUNTS.seedling.groupsOfOne).toBe(regions.size);
        expect(COUNTS.seedling).toEqual({ parents: 60, membersInside: 251, groupsOfOne: 56 });
    });
    it('seedling_atlas (the in-app row\'s world) draws 2 boxes, 8 members inside, 3 groups of one', () => {
        const { regions } = load('seedling_atlas/AP_1/AP_1_rules.json');
        const { ui } = build(regions, 'nested');
        expect(countsOf(ui.cy)).toEqual({ parents: 2, membersInside: 8, groupsOfOne: 3 });
    });
    for (const [name, rel] of [['alttp', ALTTP], ['procgen_maze', MAZE]]) {
        it(`${name}: no sub-regions → 0 boxes, and the element set equals separate's at all 3 states`, () => {
            const rules = kit.loadRules(rel);
            const regions = kit.regionsOf(rules);
            sm.rules = rules;
            for (const { name: state, snapshot } of kit.threeStates(rules, regions)) {
                sm.staticData = { regions, exits: null };
                sm.snapshot = snapshot;
                const sep = build(regions, 'separate').els;
                const { ui, els } = build(regions, 'nested');
                expect(countsOf(ui.cy), state).toEqual({ parents: 0, membersInside: 0, groupsOfOne: regions.size });
                expect(kit.digestOf(els), state).toBe(kit.digestOf(sep));
            }
            // eslint-disable-next-line no-console
            console.log(`[nested-counts] ${name} {"parents":0,"membersInside":0,"groupsOfOne":${regions.size}}`);
        });
    }
});

describe('⛓ nested: a live switch rebuilds, and the round trip returns separate', () => {
    it('separate → nested → separate on ONE graph = a fresh separate (ids, data, classes)', () => {
        const { regions } = load(SEEDLING);
        const fresh = build(regions, 'separate').els;
        const ui = kit.makeUi(kit.loadCytoscape());
        build(regions, 'separate', ui);
        const mid = build(regions, 'nested', ui);
        expect(parentsOf(mid.ui.cy).length).toBeGreaterThan(0);
        const back = build(regions, 'separate', ui).els;
        // eslint-disable-next-line no-console
        console.log(`[round-trip] fresh=${kit.digestOf(fresh)} back=${kit.digestOf(back)}`);
        expect(kit.digestOf(back)).toBe(kit.digestOf(fresh));
    });
});

describe('⛓ nested: the readers', () => {
    it('the tap handler runs no click for a box, and the region click for a member', () => {
        const { regions } = load(SEEDLING);
        const { ui } = build(regions, 'nested');
        const gim = new GraphInteractionManager(ui);
        const region = vi.spyOn(gim, 'handleRegionNodeClick').mockReturnValue('region-click');
        const location = vi.spyOn(gim, 'handleLocationNodeClick').mockReturnValue('location-click');
        const box = parentsOf(ui.cy)[0];
        expect(gim.onNodeTap(box)).toBeNull();
        expect(region).not.toHaveBeenCalled();
        const member = box.children()[0];
        expect(gim.onNodeTap(member)).toBe('region-click');
        expect(region).toHaveBeenCalledWith(member);
        expect(location).not.toHaveBeenCalled();
    });

    it('the pathfinder never routes to or through a box (it reads the rules regions, which never hold one)', () => {
        const { regions } = load(SEEDLING, 'end');
        const { ui } = build(regions, 'nested');
        const pf = new PathFinder({ getStaticData: () => sm.staticData, getLatestStateSnapshot: () => sm.snapshot,
            getEffectiveBidirectionalSetting: () => false });
        const box = parentsOf(ui.cy)[0];
        expect(sm.staticData.regions.has(box.id())).toBe(false);
        expect(pf.findPath(box.children()[0].id(), box.id())).toBeNull();
        const adj = pf.buildAccessibilityMap(sm.staticData, sm.snapshot, {});
        for (const [from, conns] of adj) {
            expect(groupsMod.isRegionGroupNode(ui.cy.getElementById(from))).toBe(false);
            for (const c of conns) expect(String(c.region ?? c).startsWith(groupsMod.GROUP_ID_PREFIX)).toBe(false);
        }
    });

    it('saved positions never hold a box; positions saved in separate load in nested with no re-layout', () => {
        const { regions } = load(SEEDLING);
        let layouts = 0;
        const ui = kit.makeUi(kit.loadCytoscape(), { runLayout() { layouts += 1; } });
        const lcm = new LayoutControlsManager(ui);
        build(regions, 'nested', ui);
        lcm.saveNodePositions();
        expect(ui.nodePositions.size).toBe(regions.size);
        for (const id of ui.nodePositions.keys()) expect(id.startsWith(groupsMod.GROUP_ID_PREFIX)).toBe(false);
        // A separate build then re-uses them (size = region count: no layout); then nested re-uses them too.
        layouts = 0;
        build(regions, 'separate', ui);
        lcm.saveNodePositions();
        build(regions, 'nested', ui);
        expect(layouts).toBe(0);
        for (const [id, pos] of ui.nodePositions) expect(ui.cy.getElementById(id).position()).toEqual(pos);
    });

    it('location nodes stay attached to their own member region (not children of the box)', () => {
        const { regions } = load(SEEDLING);
        const { ui, dm } = build(regions, 'nested');
        const member = parentsOf(ui.cy).filter((p) => p.children().some((c) => (regions.get(c.id()).locations ?? []).length))[0]
            .children().filter((c) => (regions.get(c.id()).locations ?? []).length)[0];
        ui.locationVisibilityMode = 'hover';
        dm.showLocationNodesForRegion(member.id());
        const locs = ui.cy.nodes('.location-node');
        expect(locs.length).toBe(regions.get(member.id()).locations.length);
        locs.forEach((l) => {
            expect(l.data('parentRegion')).toBe(member.id());
            expect(l.isChild()).toBe(false);
        });
    });

    it('a box is coloured from its members by the Region Map\'s group rule', () => {
        const { regions } = load(SEEDLING, 'start');
        const { ui } = build(regions, 'nested');
        // At the start state only the start region is reachable: every box is inaccessible, none accessible.
        const boxes = parentsOf(ui.cy);
        expect(boxes.filter((b) => b.hasClass('group-inaccessible')).length + boxes.filter((b) => b.hasClass('group-accessible')).length)
            .toBe(boxes.length);
        expect(boxes.every((b) => !b.hasClass('accessible') && !b.hasClass('inaccessible'))).toBe(true);
        expect(groupsMod.groupState([
            { counts: { checked: 0, accessible: 1, inaccessible: 0, total: 1 }, reachable: true, color: 'accessible', visibility: 'shown' },
            { counts: { checked: 1, accessible: 0, inaccessible: 1, total: 2 }, reachable: false, color: 'inaccessible', visibility: 'hidden' },
        ])).toMatchObject({ color: 'accessible', interior: 'mixed-locations', visibility: 'shown', reachable: true,
            counts: { checked: 1, accessible: 1, inaccessible: 1, total: 3 } });
        expect(groupsMod.groupState([
            { counts: { checked: 0, accessible: 0, inaccessible: 0, total: 0 }, reachable: false, color: null, visibility: 'placeholder' },
        ])).toMatchObject({ color: null, interior: null, visibility: 'placeholder' });
    });
});

describe('⛓ the setting', () => {
    it('is registered with the schema default `separate`, and the panel reads it with NO call-site default', async () => {
        const index = await vi.importActual('./index.js');
        const api = { registerPublicFunction() {}, registerSettingsSchema: (s) => registeredSchemas.push(s),
            registerEventHandler() {}, registerDispatcherReceiver() {}, registerPanelComponent() {} };
        index.register(new Proxy(api, { get: (t, k) => t[k] ?? (() => {}) }));
        const schema = registeredSchemas.find((s) => s.properties?.subRegionView)?.properties.subRegionView;
        expect(schema).toBeTruthy();
        expect(schema.default).toBe('separate');
        expect(schema.default).toBe(groupsMod.SUB_REGION_VIEW_SCHEMA.default);
        expect(schema.enum).toEqual(['separate', 'nested', 'merged']);

        const { RegionGraphUI } = await import('./regionGraphUI.js');
        const seen = [];
        const settings = (await import('../../app/core/settingsManager.js')).default;
        const real = settings.getSetting;
        settings.getSetting = async (...args) => { seen.push(args); return real(...args); };
        const fake = { controlPanel: null };
        await RegionGraphUI.prototype.loadDisplaySettings.call(fake);
        settings.getSetting = real;
        const call = seen.find(([k]) => k === groupsMod.SUB_REGION_VIEW_KEY);
        expect(call).toEqual([groupsMod.SUB_REGION_VIEW_KEY]);
        expect(fake.subRegionView).toBe('separate');
        settingsStore.set(groupsMod.SUB_REGION_VIEW_KEY, 'nested');
        await RegionGraphUI.prototype.loadDisplaySettings.call(fake);
        expect(fake.subRegionView).toBe('nested');
        settingsStore.set(groupsMod.SUB_REGION_VIEW_KEY, 'merged'); // groups-b's value: drawn since it landed
        await RegionGraphUI.prototype.loadDisplaySettings.call(fake);
        expect(fake.subRegionView).toBe('merged');
        settingsStore.set(groupsMod.SUB_REGION_VIEW_KEY, 'collapsible'); // a value this build does not draw yet
        await RegionGraphUI.prototype.loadDisplaySettings.call(fake);
        expect(fake.subRegionView).toBe('separate');
    });
});
