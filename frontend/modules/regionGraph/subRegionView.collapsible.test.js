/**
 * ⛓ SUB-REGION VIEW = collapsible (option C; region-graph-groups-c; ⚖ the user, session 84c8ab35, 2026-11-24:
 * "Small +/− badge"). Through the panel's own builder on a headless Cytoscape (`regionGraphElements.testkit.js`):
 *   · IDENTITY, computed at test time (no digest pin over a live preset): every group closed = `merged`; every group
 *     open = `nested`; open then close one group = the pre-open element set; a world with no sub-regions = `separate`;
 *   · THE MIXED EDGE RULE: an open group's members keep their own edges, the closed groups merge
 *     (`mergeGroupEdges` with the closed groups' `nodeOf` only), restated edge by edge;
 *   · THE BADGE (`groupBadgeLayer.js`, a DOM layer, here on a fake document): a press opens / closes the group and
 *     runs NO click action; a body tap runs them; the badges are not Cytoscape elements; it shows where region
 *     labels show; its hit square;
 *   · POSITIONS: open / close runs no layout; the members are placed round the closed node; the closed node goes to
 *     its members' centre; `separate`'s and `merged`'s stores are never written;
 *   · the open set: per world, session-only, kept across a switch to another view and back;
 *   · the READERS with some groups open and some closed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sm = { staticData: null, snapshot: null, rules: null };
const gs = vi.hoisted(() => ({ current: null }));
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
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => gs.current }));
vi.mock('../discovery/singleton.js', () => ({
    default: { isRegionDiscovered: () => true, isExitDiscovered: () => true, isLocationDiscovered: () => true },
}));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => JSON.stringify(rule).length % 3 !== 0 }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
const hooks = vi.hoisted(() => ({ seedling: null }));
vi.mock('../shared/procgen/substrateRegistry.js', () => {
    const entries = {
        flash_seedling: { compositeMap: { displayRegionOf: (...a) => hooks.seedling(...a) } },
        maze: { compositeMap: { drawRegion() {} } },
    };
    return { substrateRegistry: { get: (id) => entries[id] ?? null } };
});

const { GraphDataManager } = await import('./graphDataManager.js');
const { GraphInteractionManager } = await import('./graphInteractionManager.js');
const { LayoutControlsManager } = await import('./layoutControlsManager.js');
const { NavigationManager } = await import('./navigationManager.js');
const { centreGraphOn } = await import('./regionGraphCentreAction.js');
const { PICKER, setupNodePicker } = await import('./nodePicker.js');
const { GroupBadgeLayer, BADGE_CLASS } = await import('./groupBadgeLayer.js');
const G = await import('./subRegionGroups.js');
const vm = await import('../regionView/regionViewModel.js');
const kit = await import('./regionGraphElements.testkit.js');
hooks.seedling = (await import('../flashPanel/seedlingCompositeMap.js')).seedlingDisplayRegionOf;

const SEEDLING = 'seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const ATLAS = 'seedling_atlas/AP_1/AP_1_rules.json';
const ALTTP = 'alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const MAZE = 'procgen_maze/AP_3/AP_3_rules.json';

function load(rel, stateName = 'mid') {
    const rules = kit.loadRules(rel);
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === stateName).snapshot;
    return { rules, regions };
}

/** Build on `ui` with `subRegionView = view` (`open`: the display keys to open first, collapsible only). */
function build(regions, view, ui = kit.makeUi(kit.loadCytoscape()), { open = [] } = {}) {
    ui.subRegionView = view;
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    if (view === 'collapsible') { const set = dm.openGroupKeys(); set.clear(); for (const k of open) set.add(k); }
    dm.buildGraphFromRegions(regions, null);
    return { ui, dm, els: kit.serialiseElements(ui.cy) };
}

const mergedNodes = (cy) => cy.nodes().filter((n) => G.isRegionGroupNode(n, 'merged'));
const boxes = (cy) => cy.nodes().filter((n) => G.isRegionGroupNode(n, 'box'));
const elementIds = (cy) => cy.elements().map((e) => e.id()).sort();

/** A minimal DOM for the badge layer: elements with style, dataset, attributes, children and listeners. */
function fakeDoc() {
    const make = (tagName) => ({
        tagName, style: {}, dataset: {}, attrs: {}, children: [], listeners: {}, textContent: '', parent: null,
        setAttribute(k, v) { this.attrs[k] = v; },
        appendChild(c) { c.parent = this; this.children.push(c); return c; },
        addEventListener(t, f) { (this.listeners[t] ??= []).push(f); },
        remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; },
        fire(type) {
            const ev = { type, stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
            for (const f of this.listeners[type] ?? []) f(ev);
            return ev;
        },
    });
    return { createElement: make, root: make('div') };
}

/** A collapsible graph with the badge layer on a fake document, and the interaction manager with a click spy. */
function badgeUi(rel = ATLAS) {
    const { regions } = load(rel);
    let layouts = 0;
    const ui = kit.makeUi(kit.loadCytoscape(), { runLayout() { layouts += 1; } });
    const doc = fakeDoc();
    ui.rootElement = doc.root;
    ui.zoomLevels = { showRegionNames: 0.5 };
    ui.groupBadges = new GroupBadgeLayer(ui, { doc });
    const gim = new GraphInteractionManager(ui);
    ui.interactionManager = gim;
    const runs = [];
    vi.spyOn(gim, 'runClick').mockImplementation((target, ctx) => { runs.push([target, ctx.regionName]); return 'ran'; });
    const out = build(regions, 'collapsible', ui);
    return { ...out, regions, gim, runs, doc, layouts: () => layouts };
}

beforeEach(() => { gs.current = null; });

describe('⛓ collapsible: the setting', () => {
    it('appends `collapsible` with its label; the default stays `separate`', () => {
        expect(G.SUB_REGION_VIEW_SCHEMA.enum).toEqual(['separate', 'nested', 'merged', 'collapsible']);
        expect(G.SUB_REGION_VIEW_SCHEMA.default).toBe('separate');
        expect(G.SUB_REGION_VIEW_LABELS.collapsible).toBe('Collapsible (click + to open)');
        expect(G.normaliseSubRegionView('collapsible')).toBe('collapsible');
    });
});

describe('⛓ collapsible: identity (computed at test time)', () => {
    it.each([['seedling_playthrough', SEEDLING], ['seedling_atlas', ATLAS]])('%s: every group closed = merged, at all 3 states', (name, rel) => {
        for (const st of ['start', 'mid', 'end']) {
            const { regions } = load(rel, st);
            const mer = build(regions, 'merged');
            const col = build(regions, 'collapsible');
            expect(mergedNodes(col.ui.cy).length).toBeGreaterThan(0);
            expect(kit.digestOf(col.els), `${name} ${st}`).toBe(kit.digestOf(mer.els));
            if (st === 'mid') {
                // eslint-disable-next-line no-console
                console.log(`[collapsible-identity] ${name} mid all-closed=${kit.digestOf(col.els)} merged=${kit.digestOf(mer.els)}`);
            }
        }
    });

    it.each([['seedling_playthrough', SEEDLING], ['seedling_atlas', ATLAS]])('%s: every group open = nested (the badges are not elements)', (name, rel) => {
        for (const st of ['start', 'mid', 'end']) {
            const { regions } = load(rel, st);
            const nes = build(regions, 'nested');
            const keys = [...nes.dm.multiMemberGroups(regions).keys()];
            const col = build(regions, 'collapsible', undefined, { open: keys });
            expect(boxes(col.ui.cy).length).toBe(keys.length);
            expect(col.ui.mergedNodeOf).toBeNull();
            expect(kit.digestOf(col.els), `${name} ${st}`).toBe(kit.digestOf(nes.els));
            if (st === 'mid') {
                // eslint-disable-next-line no-console
                console.log(`[collapsible-identity] ${name} mid all-open=${kit.digestOf(col.els)} nested=${kit.digestOf(nes.els)}`);
            }
        }
    });

    it.each([['alttp', ALTTP], ['procgen_maze', MAZE]])('%s: no sub-regions → collapsible = separate at all 3 states', (name, rel) => {
        for (const st of ['start', 'mid', 'end']) {
            const { regions } = load(rel, st);
            const sep = build(regions, 'separate');
            const col = build(regions, 'collapsible');
            expect(G.isRegionGroupNode(col.ui.cy.nodes()[0])).toBe(false);
            expect(col.ui.cy.nodes().filter((n) => G.isRegionGroupNode(n)).length).toBe(0);
            expect(kit.digestOf(col.els), `${name} ${st}`).toBe(kit.digestOf(sep.els));
        }
    });

    it('open then close one group returns the pre-open element set (ids, data, classes)', () => {
        const { regions } = load(SEEDLING);
        const { ui, dm, els: pre } = build(regions, 'collapsible');
        const key = mergedNodes(ui.cy)[3].data('groupKey');
        expect(dm.setSubRegionGroupOpen(key, true).changed).toBe(true);
        const open = kit.serialiseElements(ui.cy);
        expect(kit.digestOf(open)).not.toBe(kit.digestOf(pre));
        expect(boxes(ui.cy).map((b) => b.data('groupKey'))).toEqual([key]);
        expect(dm.setSubRegionGroupOpen(key, false).changed).toBe(true);
        const post = kit.serialiseElements(ui.cy);
        // eslint-disable-next-line no-console
        console.log(`[collapsible-round-trip] pre=${kit.digestOf(pre)} open(${key})=${kit.digestOf(open)} post=${kit.digestOf(post)}`);
        expect(kit.digestOf(post)).toBe(kit.digestOf(pre));
        // Not in collapsible, or already in that state: nothing changes.
        expect(dm.setSubRegionGroupOpen(key, false).changed).toBe(false);
        ui.subRegionView = 'merged';
        expect(dm.setSubRegionGroupOpen(key, true).changed).toBe(false);
    });
});

describe('⛓ collapsible: THE MIXED EDGE RULE (open members keep their edges; closed groups merge)', () => {
    it('seedling_playthrough with open groups beside closed ones: every edge, restated from the separate edges', () => {
        const { regions } = load(SEEDLING);
        const sep = build(regions, 'separate');
        const groups = sep.dm.multiMemberGroups(regions);
        const groupOf = new Map();
        for (const [k, m] of groups) for (const r of m) groupOf.set(r, k);
        // Open: the groups at both ends of one cross-group edge (open ↔ open), and ONE end of another (open ↔ closed).
        const cross = sep.ui.cy.edges().filter((e) => groupOf.get(e.source().id()) && groupOf.get(e.target().id())
            && groupOf.get(e.source().id()) !== groupOf.get(e.target().id()));
        const e1 = cross[0];
        const open = new Set([groupOf.get(e1.source().id()), groupOf.get(e1.target().id())]);
        const e2 = cross.filter((e) => !open.has(groupOf.get(e.source().id())) && !open.has(groupOf.get(e.target().id())))[0];
        open.add(groupOf.get(e2.source().id()));
        const { ui, dm } = build(regions, 'collapsible', undefined, { open: [...open] });

        // The rule: each end in a CLOSED group → that group's node; an open member stays itself.
        const nodeOf = (r) => (groupOf.has(r) && !open.has(groupOf.get(r)) ? G.groupNodeId(groupOf.get(r)) : r);
        const pair = (a, b) => [a, b].sort().join('|');
        const expectedPairs = new Set();
        const keptIds = new Set();
        sep.ui.cy.edges().forEach((e) => {
            const s = nodeOf(e.source().id());
            const t = nodeOf(e.target().id());
            if (s === t) return; // internal to a closed group: dropped
            expectedPairs.add(pair(s, t));
            if (s === e.source().id() && t === e.target().id()) keptIds.add(e.id());
        });
        const drawnPairs = ui.cy.edges().map((e) => pair(e.source().id(), e.target().id()));
        expect(new Set(drawnPairs)).toEqual(expectedPairs);
        expect(drawnPairs.length).toBe(expectedPairs.size); // one edge per node pair
        for (const id of keptIds) expect(ui.cy.getElementById(id).data('exits')).toBeUndefined(); // kept as it was
        ui.cy.edges().forEach((e) => expect(e.source().id()).not.toBe(e.target().id()));
        // The kinds the brief names are all present.
        const kind = (id) => (id.startsWith(G.GROUP_ID_PREFIX) ? 'closed' : groupOf.has(id) ? 'open' : 'region');
        const kinds = new Set(ui.cy.edges().map((e) => [kind(e.source().id()), kind(e.target().id())].sort().join('-')));
        expect(kinds.has('closed-open')).toBe(true);
        expect(kinds.has('open-open')).toBe(true);
        // The same rule as `mergeGroupEdges` over the closed groups' nodeOf (B § 7).
        const closedNodeOf = G.mergedGroupElements(G.collapsibleGroups(groups, open).closed).nodeOf;
        const sepEls = sep.ui.cy.edges().map((e) => ({ data: e.data(), classes: [...e.classes()].join(' ') }));
        const viaRule = G.mergeGroupEdges(sepEls, closedNodeOf).edges.map((e) => e.data.id).sort();
        expect(ui.cy.edges().map((e) => e.id()).sort()).toEqual(viaRule);
        // A merged edge with an open member at one end keeps every exit, each one from its own member.
        const mixed = ui.cy.edges('[exits]').filter((e) => kind(e.source().id()) === 'open' || kind(e.target().id()) === 'open')[0];
        expect(mixed).toBeTruthy();
        for (const x of mixed.data('exits')) expect([nodeOf(x.from), nodeOf(x.to)].sort()).toEqual([mixed.source().id(), mixed.target().id()].sort());
        // eslint-disable-next-line no-console
        console.log(`[collapsible-edges] open=${open.size} groups, edges=${ui.cy.edges().length} kinds=${[...kinds].sort().join(',')} stats=${JSON.stringify(dm.lastMergeStats)}`);
    });
});

describe('⛓ collapsible: the badge', () => {
    it('one + per closed group, one − per open box; they are DOM buttons, never Cytoscape elements', () => {
        const { ui, doc, dm } = badgeUi();
        const layer = doc.root.children[0];
        const closed = mergedNodes(ui.cy);
        expect(layer.children.length).toBe(closed.length);
        expect(layer.children.every((b) => b.className.includes(BADGE_CLASS) && b.dataset.open === 'false')).toBe(true);
        expect(layer.children.map((b) => b.children[0].textContent)).toEqual(closed.map(() => '+'));
        const before = elementIds(ui.cy);
        ui.groupBadges.rebuild();
        expect(elementIds(ui.cy)).toEqual(before);
        dm.setSubRegionGroupOpen(closed[0].data('groupKey'), true);
        const open = layer.children.filter((b) => b.dataset.open === 'true');
        expect(open.map((b) => b.children[0].textContent)).toEqual(['−']);
        expect(open[0].attrs.title).toBe(`Close ${closed[0].data('groupKey')} back into one node`);
        // Any other view: no badge.
        build(sm.staticData.regions, 'merged', ui);
        expect(layer.children.length).toBe(0);
    });

    it('a badge press opens / closes the group and runs NO click action; the press stops at the button', () => {
        const { ui, gim, runs, doc } = badgeUi();
        const layer = doc.root.children[0];
        const node = mergedNodes(ui.cy)[0];
        const key = node.data('groupKey');
        const plus = layer.children.find((b) => b.dataset.groupKey === key);
        for (const t of ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend']) expect(plus.fire(t).stopped).toBe(true);
        const ev = plus.fire('click');
        expect(ev.stopped && ev.prevented).toBe(true);
        expect(boxes(ui.cy).map((b) => b.data('groupKey'))).toEqual([key]);
        expect(runs).toEqual([]);
        expect(gim.runClick).not.toHaveBeenCalled();
        expect(ui.selectedNode).toBeUndefined();
        const minus = layer.children.find((b) => b.dataset.groupKey === key);
        expect(minus.dataset.open).toBe('true');
        minus.fire('click');
        expect(boxes(ui.cy).length).toBe(0);
        expect(mergedNodes(ui.cy).map((n) => n.data('groupKey'))).toContain(key);
        expect(gim.runClick).not.toHaveBeenCalled();
    });

    it('a BODY tap runs the click actions: a closed node as B (regionOfCell), an open box nothing, a member its own', () => {
        const { ui, gim, runs, dm } = badgeUi();
        const [closed, other] = mergedNodes(ui.cy);
        expect(gim.onNodeTap(closed)).toBe('ran');
        expect(runs).toEqual([['region', vm.regionOfCell(closed.data('groupKey'), closed.data('members'))]]);
        runs.length = 0;
        dm.setSubRegionGroupOpen(other.data('groupKey'), true);
        const box = boxes(ui.cy)[0];
        expect(gim.onNodeTap(box)).toBeNull();
        expect(runs).toEqual([]);
        const member = box.children()[0];
        expect(gim.onNodeTap(member)).toBe('ran');
        expect(runs).toEqual([['region', member.id()]]);
    });

    it('it sits on the node\'s top-right corner and shows where region labels show (zoom ≥ showRegionNames), not below', () => {
        const { ui } = badgeUi();
        const node = mergedNodes(ui.cy)[0];
        const key = node.data('groupKey');
        ui.cy.zoom(0.5);
        ui.groupBadges.sync();
        const c = G.badgeCentre(node.renderedBoundingBox({ includeLabels: false }));
        expect(ui.groupBadges.centreOf(key)).toEqual(c);
        const btn = ui.groupBadges.buttonOf(key);
        expect(btn.style.display).toBe('block');
        // The hit square is centred on the corner: a tap at the centre is inside the button.
        expect(parseFloat(btn.style.left)).toBeCloseTo(c.x - G.BADGE_HIT_PX / 2, 6);
        expect(parseFloat(btn.style.top)).toBeCloseTo(c.y - G.BADGE_HIT_PX / 2, 6);
        ui.cy.zoom(0.49);
        ui.groupBadges.sync();
        expect(btn.style.display).toBe('none');
        expect(ui.groupBadges.centreOf(key)).toBeNull();
        expect([G.BADGE_SIZE_PX, G.BADGE_HIT_PX]).toEqual([20, 36]);
    });
});

describe('⛓ collapsible: positions (no layout on open / close)', () => {
    it('members open round the closed node, the node closes at their centre; separate\'s and merged\'s stores untouched', () => {
        const { regions } = load(SEEDLING);
        let layouts = 0;
        const ui = kit.makeUi(kit.loadCytoscape(), { runLayout() { layouts += 1; } });
        const lcm = new LayoutControlsManager(ui);
        build(regions, 'separate', ui);
        ui.subRegionView = 'separate';
        lcm.saveNodePositions();
        const sepSaved = JSON.stringify([...ui.nodePositions]);
        layouts = 0;

        const { dm } = build(regions, 'collapsible', ui);
        expect(layouts).toBe(0); // every node placed from separate's saved layout
        const node = mergedNodes(ui.cy)[0];
        const key = node.data('groupKey');
        const members = node.data('members');
        node.position({ x: 5000, y: -3000 }); // the user dragged it
        const { ms: openMs } = dm.setSubRegionGroupOpen(key, true);
        expect(layouts).toBe(0);
        const pts = members.map((m) => ui.cy.getElementById(m).position());
        const centre = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
        expect(centre.x).toBeCloseTo(5000, 6);
        expect(centre.y).toBeCloseTo(-3000, 6);
        // The members keep separate's arrangement (shifted).
        const s0 = ui.nodePositions.get(members[0]);
        const s1 = ui.nodePositions.get(members[1]);
        expect(pts[1].x - pts[0].x).toBeCloseTo(s1.x - s0.x, 6);
        // Another node the user dragged stays where it is.
        const other = mergedNodes(ui.cy)[0];
        other.position({ x: -777, y: 888 });
        ui.cy.getElementById(members[0]).position({ x: pts[0].x + 300, y: pts[0].y }); // drag a member inside the box
        const pts2 = members.map((m) => ui.cy.getElementById(m).position());
        const centre2 = { x: pts2.reduce((a, p) => a + p.x, 0) / pts2.length, y: pts2.reduce((a, p) => a + p.y, 0) / pts2.length };
        const { ms: closeMs } = dm.setSubRegionGroupOpen(key, false);
        expect(layouts).toBe(0);
        expect(ui.cy.getElementById(G.groupNodeId(key)).position()).toEqual(centre2);
        expect(ui.cy.getElementById(other.id()).position()).toEqual({ x: -777, y: 888 });
        // Re-open: the members' last arrangement, round the node.
        dm.setSubRegionGroupOpen(key, true);
        expect(ui.cy.getElementById(members[0]).position().x - ui.cy.getElementById(members[1]).position().x)
            .toBeCloseTo(pts2[0].x - pts2[1].x, 6);
        // Never written: separate's store, merged's store; collapsible's has no box.
        expect(JSON.stringify([...ui.nodePositions])).toBe(sepSaved);
        expect(ui.mergedNodePositions ?? null).toBeNull();
        expect([...ui.collapsibleNodePositions.keys()].some((id) => boxes(ui.cy).some((b) => b.id() === id))).toBe(false);
        // A layout's save in collapsible goes to its own store, never a box.
        ui.subRegionView = 'collapsible';
        expect(lcm.positionStore()).toBe(ui.collapsibleNodePositions);
        lcm.saveNodePositions();
        expect(JSON.stringify([...ui.nodePositions])).toBe(sepSaved);
        expect(ui.collapsibleNodePositions.has(G.groupNodeId(key))).toBe(false); // its box is never saved
        // Back to separate: its layout, untouched, no layout.
        build(regions, 'separate', ui);
        expect(layouts).toBe(0);
        for (const [id, pos] of ui.nodePositions) expect(ui.cy.getElementById(id).position()).toEqual(pos);
        // eslint-disable-next-line no-console
        console.log(`[collapsible-toggle] seedling_playthrough headless open=${openMs.toFixed(1)} ms close=${closeMs.toFixed(1)} ms (${key}, ${members.length} members)`);
    });

    it('with no saved layout: collapsible lays out once; an open with no saved arrangement rings the members round the node', () => {
        const { regions } = load(ATLAS);
        let layouts = 0;
        const ui = kit.makeUi(kit.loadCytoscape(), { runLayout() { layouts += 1; } });
        const { dm } = build(regions, 'collapsible', ui);
        expect(layouts).toBe(1);
        const node = mergedNodes(ui.cy)[0];
        const p = { ...node.position() };
        dm.setSubRegionGroupOpen(node.data('groupKey'), true);
        expect(layouts).toBe(1);
        const ms = node.data('members').map((m) => ui.cy.getElementById(m).position());
        const r = 50 + 12 * ms.length;
        for (const q of ms) expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeCloseTo(r, 6);
    });
});

describe('⛓ collapsible: the open set', () => {
    it('is per world and kept across a switch to another view and back', () => {
        const { regions } = load(ATLAS);
        const ui = kit.makeUi(kit.loadCytoscape());
        const { dm } = build(regions, 'collapsible', ui);
        const key = mergedNodes(ui.cy)[0].data('groupKey');
        dm.setSubRegionGroupOpen(key, true);
        const worldA = dm.worldKey();
        ui.subRegionView = 'merged';
        dm.buildGraphFromRegions(regions, null);
        ui.subRegionView = 'collapsible';
        dm.buildGraphFromRegions(regions, null);
        expect(boxes(ui.cy).map((b) => b.data('groupKey'))).toEqual([key]);
        // Another world: its own set, every group closed.
        const { regions: r2 } = load(SEEDLING);
        expect(dm.worldKey()).not.toBe(worldA);
        dm.buildGraphFromRegions(r2, null);
        expect(boxes(ui.cy).length).toBe(0);
        expect([...ui.openSubRegionGroups.get(worldA)]).toEqual([key]);
    });
});

describe('⛓ collapsible: the readers, with some groups open and some closed', () => {
    function mixedUi() {
        const { regions } = load(SEEDLING);
        const ui = kit.makeUi(kit.loadCytoscape());
        const { dm } = build(regions, 'collapsible', ui);
        const [a, b] = mergedNodes(ui.cy);
        dm.setSubRegionGroupOpen(a.data('groupKey'), true);
        const closed = ui.cy.getElementById(b.id());
        const box = ui.cy.getElementById(a.id());
        return { regions, ui, dm, box, closed };
    }

    it('graphNodeIdOf / centring: an open member is its own node, a closed member its group node', () => {
        const { ui, box, closed } = mixedUi();
        const om = box.data('members')[0];
        const cm = closed.data('members')[1];
        expect(G.graphNodeIdOf(ui, om)).toBe(om);
        expect(G.graphNodeIdOf(ui, cm)).toBe(closed.id());
        ui.cy.animate = () => {};
        expect(centreGraphOn(ui, om)).toBe(true);
        expect(centreGraphOn(ui, cm)).toBe(true);
    });

    it('the picker / Go to: a closed group\'s member resolves to its group node, an open member to itself', () => {
        const { ui, box, closed } = mixedUi();
        const listeners = {};
        const el = () => ({ value: '', textContent: '', children: [], addEventListener(t, f) { (listeners[this.k] ??= {})[t] = f; },
            replaceChildren(...k) { this.children = k; } });
        const parts = { [PICKER.region]: { ...el(), k: 'region' }, [PICKER.location]: { ...el(), k: 'loc' }, [PICKER.status]: el(),
            '#rg-pick-region-list': el(), '#rg-pick-location-list': el() };
        const root = { open: true, querySelector: (s) => parts[s] ?? null, addEventListener() {} };
        globalThis.document = { createElement: (t) => ({ tagName: t }) };
        const calls = [];
        ui.controlPanel = { querySelector: (s) => (s === PICKER.section ? root : null) };
        ui.interactionManager = { handleRegionNodeClick: (n, name) => calls.push([n.id(), name]), handleLocationNodeClick() {} };
        ui.cy.animate = () => {};
        setupNodePicker(ui);
        const cm = closed.data('members')[0];
        const om = box.data('members')[0];
        parts[PICKER.region].value = cm;
        listeners.region.change();
        parts[PICKER.region].value = om;
        listeners.region.change();
        expect(calls).toEqual([[closed.id(), cm], [om, om]]);
        delete globalThis.document;
    });

    it('paths across mixed groups: open members are steps of their own, a closed group one step; edges lit = the step pairs', async () => {
        const { ui, box, closed } = mixedUi();
        const gim = new GraphInteractionManager(ui);
        // A drawn edge between an open member and a closed group node, walked out and on through the group.
        const e = ui.cy.edges('[exits]').filter((x) => [x.source(), x.target()].some((n) => n.id() === closed.id() || G.isRegionGroupNode(n, 'merged'))
            && [x.source(), x.target()].some((n) => n.isChild?.()))[0]
            ?? ui.cy.edges().filter((x) => x.source().isChild() || x.target().isChild())[0];
        expect(e).toBeTruthy();
        const exit = (e.data('exits') ?? [{ from: e.source().id(), to: e.target().id() }])[0];
        const steps = [exit.from, exit.to];
        const nodeSteps = G.pathNodeSteps(steps, ui.mergedNodeOf);
        ui.currentPath = steps.slice(1).map((r, i) => ({ type: 'regionMove', sourceRegion: steps[i], destinationRegion: r, exitUsed: null }));
        gs.current = { getPath: () => ui.currentPath };
        gim.highlightPathEdges();
        await new Promise((r) => setTimeout(r, 20));
        const lit = ui.cy.edges('.in-path');
        expect(lit.map((x) => x.id())).toEqual([e.id()]);
        expect(nodeSteps.length).toBe(2);
        expect(box.isParent()).toBe(true);
    });

    it('the player marker sits on the open member, or on the closed group node', () => {
        const { ui, box, closed } = mixedUi();
        const gim = new GraphInteractionManager(ui);
        ui.highlightCurrentRegion = (r) => gim.highlightCurrentRegion(r);
        const nav = new NavigationManager(ui);
        const om = ui.cy.getElementById(box.data('members')[0]);
        om.position({ x: 10, y: 20 });
        nav.updatePlayerLocation(om.id());
        expect(ui.cy.getElementById('player').position()).toEqual({ x: 40, y: -10 });
        expect(om.hasClass('current')).toBe(true);
        closed.position({ x: 100, y: 200 });
        nav.updatePlayerLocation(closed.data('members')[0]);
        expect(ui.cy.getElementById('player').position()).toEqual({ x: 130, y: 170 });
        expect(closed.hasClass('current')).toBe(true);
    });

    it('location nodes move from the merged node to the members when the group opens', () => {
        const { regions } = load(SEEDLING);
        const ui = kit.makeUi(kit.loadCytoscape());
        const { dm } = build(regions, 'collapsible', ui);
        const withLocs = mergedNodes(ui.cy).filter((n) => n.data('members').filter((m) => (regions.get(m).locations ?? []).length > 0).length >= 2)[0];
        const key = withLocs.data('groupKey');
        ui.locationVisibilityMode = 'hover';
        dm.showLocationNodesForRegion(withLocs.id());
        const closedLocs = ui.cy.nodes('.location-node').map((l) => [l.id(), l.data('anchorNode')]);
        expect(closedLocs.length).toBeGreaterThan(0);
        expect(closedLocs.every(([, a]) => a === withLocs.id())).toBe(true);
        dm.hideLocationNodesForRegion(withLocs.id());
        dm.setSubRegionGroupOpen(key, true);
        const member = withLocs.data('members').find((m) => (regions.get(m).locations ?? []).length > 0);
        dm.showLocationNodesForRegion(member);
        const openLocs = ui.cy.nodes('.location-node');
        expect(openLocs.length).toBe((regions.get(member).locations ?? []).length);
        openLocs.forEach((l) => expect(l.data('parentRegion')).toBe(member));
        expect(ui.cy.edges('.region-location-edge').every((x) => x.source().id() === member)).toBe(true);
        // The ids are the same either way (`loc_<member>_<name>`).
        const ids = new Set(closedLocs.map(([id]) => id));
        openLocs.forEach((l) => expect(ids.has(l.id())).toBe(true));
    });

    it('hub detection, colouring and the status count: a box is skipped, a closed node counts, members colour as regions', () => {
        const { ui, dm, box, closed } = mixedUi();
        dm.identifyHubNodes(0);
        expect(box.hasClass('hub')).toBe(false);
        expect(closed.hasClass('hub')).toBe(true);
        // Colour: the open box and the closed node from their members (group classes), members as regions.
        expect(box.classes().some((c) => c.startsWith('group-'))).toBe(true);
        expect(closed.classes().some((c) => c.startsWith('group-'))).toBe(true);
        const m = ui.cy.getElementById(box.data('members')[0]);
        expect(m.hasClass('accessible') || m.hasClass('inaccessible')).toBe(true);
        let status = '';
        ui.updateStatus = (s) => { status = s; };
        dm.setSubRegionGroupOpen(closed.data('groupKey'), true);
        expect(status).toMatch(new RegExp(`^Loaded ${sm.staticData.regions.size} regions`));
    });
});
