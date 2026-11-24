/**
 * ⛓ SUB-REGION VIEW = merged (option B; region-graph-groups-b). Through the panel's own builder on a headless
 * Cytoscape (`regionGraphElements.testkit.js`), on committed presets:
 *   · one node per display group of 2+ (`region-group:<key>`), in place of its members; a group of one draws as a
 *     region; alttp and the maze (no sub-regions) are byte-identical to `separate` at all 3 states;
 *   · THE EDGE RULE (`mergeGroupEdges`): internal edges dropped, the rest re-targeted, parallel ones merged keeping
 *     every exit; the counts per preset; the result does not depend on the input order;
 *   · a merged edge's STATE: best state wins, each exit keeps its own state for the hover; mixed merges counted;
 *   · a click on a group node runs on `regionOfCell(key, members)`, the Region Map's rule (the same function);
 *   · paths: to and through group nodes, a path inside one group, and G → X → G;
 *   · saved positions: merged never writes `separate`'s; the round trip returns the fresh `separate` set;
 *   · the other readers: location nodes, the player marker, centring, the node picker, hub detection.
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
const { PathFinder } = await import('./pathfinder.js');
const { centreGraphOn } = await import('./regionGraphCentreAction.js');
const { PICKER, setupNodePicker } = await import('./nodePicker.js');
const G = await import('./subRegionGroups.js');
const vm = await import('../regionView/regionViewModel.js');
const mapClicks = await import('../regionMap/regionMapClickActions.js');
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

function build(regions, view, ui = kit.makeUi(kit.loadCytoscape())) {
    ui.subRegionView = view;
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    dm.buildGraphFromRegions(regions, null);
    return { ui, dm, els: kit.serialiseElements(ui.cy) };
}

const mergedNodes = (cy) => cy.nodes().filter((n) => G.isRegionGroupNode(n, 'merged'));
const mixedCount = (cy) => cy.edges('[exits]').filter((e) => e.hasClass('mixed-exits')).length;

/** A synthetic separate edge, as the builder makes one (forward + optional reverse exit). */
const edge = (source, target, fwd, rev = null, extra = {}) => ({
    data: {
        id: `${source}-${target}`, source, target, label: rev && rev !== fwd ? `${fwd} / ${rev}` : fwd,
        exitName: fwd, accessRule: { r: fwd }, isBidirectional: !!rev, hasForwardExit: true, hasReverseExit: !!rev,
        forwardExitRule: { r: fwd }, reverseExitRule: rev ? { r: rev } : null, forwardExitName: fwd,
        reverseExitName: rev ?? '', ...extra,
    },
    classes: '',
});

beforeEach(() => { gs.current = null; });

describe('⛓ merged: the setting', () => {
    it('appends `merged` with its label; the default stays `separate`', () => {
        expect(G.SUB_REGION_VIEW_SCHEMA.enum).toEqual(['separate', 'nested', 'merged']);
        expect(G.SUB_REGION_VIEW_SCHEMA.default).toBe('separate');
        expect(G.SUB_REGION_VIEW_LABELS.merged).toBe('Merged into one node per region');
        expect(G.normaliseSubRegionView('merged')).toBe('merged');
        expect(G.normaliseSubRegionView('collapsible')).toBe('separate');
    });

    it('isRegionGroupNode is ONE predicate, extended with a kind', () => {
        const { regions } = load(ATLAS);
        const nested = build(regions, 'nested').ui.cy.nodes().filter((n) => G.isRegionGroupNode(n));
        const merged = mergedNodes(build(regions, 'merged').ui.cy);
        expect(nested.length).toBe(2);
        expect(merged.length).toBe(2);
        expect(nested.every((n) => G.isRegionGroupNode(n, 'box') && !G.isRegionGroupNode(n, 'merged'))).toBe(true);
        expect(merged.every((n) => G.isRegionGroupNode(n) && !G.isRegionGroupNode(n, 'box'))).toBe(true);
    });
});

describe('⛓ merged: THE EDGE RULE (mergeGroupEdges)', () => {
    const nodeOf = new Map([['a1', 'region-group:A'], ['a2', 'region-group:A'], ['a3', 'region-group:A'],
        ['b1', 'region-group:B'], ['b2', 'region-group:B']]);
    const input = [
        edge('a1', 'a2', 'a1→a2', 'a2→a1'),   // internal: dropped
        edge('a2', 'a3', 'a2→a3'),            // internal: dropped
        edge('X', 'Y', 'X→Y', 'Y→X'),         // no group: kept as it is
        edge('a1', 'X', 'a1→X', 'X→a1'),      // re-targeted
        edge('a3', 'X', 'a3→X'),              // re-targeted, merges with the one above
        edge('X', 'a2', 'X→a2'),              // re-targeted the other way round, merges too
        edge('b1', 'a1', 'b1→a1'),            // group to group
        edge('b2', 'Y', 'b2→Y'),              // re-targeted, alone
    ];

    it('drops internal edges, keeps the rest, re-targets and merges', () => {
        const { edges, stats } = G.mergeGroupEdges(input, nodeOf);
        expect(stats).toEqual({ kept: 1, dropped: 2, retargeted: 5, merged: 2, groupEdges: 3 });
        expect(edges.find((e) => e.data.id === 'X-Y')).toBe(input[2]);
        expect(edges.every((e) => e.data.source !== e.data.target)).toBe(true);
        expect(edges.map((e) => e.data.id)).toEqual(['X-Y', 'region-group:A-X', 'region-group:B-Y', 'region-group:B-region-group:A']);
    });

    it('a merged edge keeps every exit, each with its direction; names sorted; orientation by majority', () => {
        const ax = G.mergeGroupEdges(input, nodeOf).edges.find((e) => e.data.id === 'region-group:A-X').data;
        // 2 of the 3 contributors ran A → X: that is its orientation.
        expect([ax.source, ax.target]).toEqual(['region-group:A', 'X']);
        expect(ax.exits.map((e) => [e.direction, e.name, e.from, e.to])).toEqual([
            ['forward', 'a1→X', 'a1', 'X'], ['forward', 'a3→X', 'a3', 'X'],
            ['reverse', 'X→a1', 'X', 'a1'], ['reverse', 'X→a2', 'X', 'a2'],
        ]);
        expect(ax.exitNames).toEqual(['X→a1', 'X→a2', 'a1→X', 'a3→X'].sort());
        expect(ax).toMatchObject({ isBidirectional: true, hasForwardExit: true, hasReverseExit: true, mergedEdges: 3,
            forwardExitName: 'a1→X / a3→X', reverseExitName: 'X→a1 / X→a2', exitName: 'a1→X', label: 'a1→X / a3→X / +2' });
        expect(ax.exits[0].rule).toEqual({ r: 'a1→X' });
        const by = G.mergeGroupEdges(input, nodeOf).edges.find((e) => e.data.id === 'region-group:B-Y').data;
        expect(by).toMatchObject({ isBidirectional: false, hasForwardExit: true, hasReverseExit: false, label: 'b2→Y', mergedEdges: 1 });
    });

    it('a tie in orientation goes to the smaller source id', () => {
        const { edges } = G.mergeGroupEdges([edge('a1', 'X', 'p'), edge('X', 'a2', 'q')], nodeOf);
        expect(edges[0].data.source).toBe('X');   // 'X' < 'region-group:A'
        expect(edges[0].data.exits.map((e) => e.direction)).toEqual(['forward', 'reverse']);
    });

    it('discovery: undiscovered / hidden / "???" only when EVERY contributor was', () => {
        const u = (e, c, label) => ({ ...e, classes: c, data: { ...e.data, label: label ?? e.data.label } });
        const one = G.mergeGroupEdges([u(edge('a1', 'X', 'p'), 'undiscovered discovery-hidden', '???'),
            u(edge('a2', 'X', 'q'), 'undiscovered', '???')], nodeOf).edges[0];
        expect(one.classes).toBe('undiscovered');
        expect(one.data.label).toBe('???');
        const two = G.mergeGroupEdges([u(edge('a1', 'X', 'p'), 'undiscovered', '???'), edge('a2', 'X', 'q')], nodeOf).edges[0];
        expect(two.classes).toBe('');
        expect(two.data.label).toBe('p / q');
    });

    it('DETERMINISM: shuffled input → the same edges (ids, exit order), on the synthetic set and on seedling', () => {
        const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
        const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        const canon = (edges) => kit.digestOf(edges.map((e) => [e.data.id, e.data.source, e.data.target, e.data.exits ?? null, e.data.label, e.classes])
            .sort((x, y) => (x[0] < y[0] ? -1 : 1)));
        const base = canon(G.mergeGroupEdges(input, nodeOf).edges);
        for (let s = 1; s <= 5; s++) expect(canon(G.mergeGroupEdges(shuffle(input, rng(s)), nodeOf).edges)).toBe(base);

        const { regions } = load(SEEDLING);
        const { ui } = build(regions, 'separate');
        const sepEdges = ui.cy.edges().map((e) => ({ data: e.data(), classes: [...e.classes()].join(' ') }));
        const groups = new GraphDataManager(ui).multiMemberGroups(regions);
        const { nodeOf: seedNodeOf } = G.mergedGroupElements(groups);
        const d1 = canon(G.mergeGroupEdges(sepEdges, seedNodeOf).edges);
        const d2 = canon(G.mergeGroupEdges(shuffle(sepEdges, rng(7)), seedNodeOf).edges);
        const d3 = canon(G.mergeGroupEdges([...sepEdges].reverse(), seedNodeOf).edges);
        // eslint-disable-next-line no-console
        console.log(`[merged-determinism] seedling edges digest=${d1}`);
        expect(d2).toBe(d1);
        expect(d3).toBe(d1);
    });
});

describe('⛓ merged: counts per preset, and worlds without sub-regions', () => {
    it.each([
        ['seedling_playthrough', SEEDLING],
        ['seedling_atlas', ATLAS],
    ])('%s: one node per group of 2+, the edge counts', (name, rel) => {
        const { regions } = load(rel);
        const sep = build(regions, 'separate');
        const { ui, dm } = build(regions, 'merged');
        const groups = dm.multiMemberGroups(regions);
        const members = [...groups.values()].reduce((a, m) => a + m.length, 0);
        const nodes = ui.cy.nodes().filter((n) => !n.hasClass('player'));
        expect(mergedNodes(ui.cy).length).toBe(groups.size);
        expect(nodes.length).toBe(regions.size - members + groups.size);
        expect(ui.cy.nodes('.region').length).toBe(regions.size - members);
        // No member is drawn; every edge end is a drawn node; no self-loop.
        for (const m of groups.values()) for (const r of m) expect(ui.cy.getElementById(r).length).toBe(0);
        ui.cy.edges().forEach((e) => expect(e.source().id()).not.toBe(e.target().id()));
        const s = dm.lastMergeStats;
        expect(s.kept + s.dropped + s.retargeted).toBe(sep.ui.cy.edges().length);
        expect(ui.cy.edges().length).toBe(s.kept + s.groupEdges);
        const mixed = ['start', 'mid', 'end'].map((st) => { load(rel, st); return mixedCount(build(regions, 'merged').ui.cy); });
        const largest = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
        const largestLocs = largest[1].reduce((a, r) => a + (regions.get(r).locations ?? []).length, 0);
        const mostLocs = [...groups].map(([k, m]) => [k, m.reduce((a, r) => a + (regions.get(r).locations ?? []).length, 0)])
            .sort((a, b) => b[1] - a[1])[0];
        // eslint-disable-next-line no-console
        console.log(`[merged-counts] ${name}: regions=${regions.size} groups=${groups.size} members=${members} `
            + `nodes=${nodes.length} sepEdges=${sep.ui.cy.edges().length} edges=${ui.cy.edges().length} `
            + `kept=${s.kept} dropped=${s.dropped} retargeted=${s.retargeted} merged=${s.merged} groupEdges=${s.groupEdges} `
            + `mixed(start/mid/end, mocked rules)=${mixed.join('/')} largestGroup=${largest[0]}(${largest[1].length} members, ${largestLocs} locations) `
            + `mostLocations=${mostLocs[0]}(${mostLocs[1]})`);
        if (name === 'seedling_atlas') {
            expect([groups.size, nodes.length]).toEqual([2, 5]);
        }
    });

    it.each([['alttp', ALTTP], ['procgen_maze', MAZE]])('%s: no sub-regions → merged = separate at all 3 states', (name, rel) => {
        for (const st of ['start', 'mid', 'end']) {
            const { regions } = load(rel, st);
            const sep = build(regions, 'separate');
            const mer = build(regions, 'merged');
            expect(mergedNodes(mer.ui.cy).length).toBe(0);
            expect(mer.dm.lastMergeStats).toEqual({ kept: sep.ui.cy.edges().length, dropped: 0, retargeted: 0, merged: 0, groupEdges: 0 });
            expect(kit.digestOf(mer.els), `${name} ${st}`).toBe(kit.digestOf(sep.els));
            if (st === 'mid') {
                // eslint-disable-next-line no-console
                console.log(`[merged-identity] ${name} mid: separate=${kit.digestOf(sep.els)} merged=${kit.digestOf(mer.els)}`);
            }
        }
    });

    it('the round trip separate → merged → separate on ONE graph = a fresh separate', () => {
        const { regions } = load(SEEDLING);
        const fresh = build(regions, 'separate').els;
        const ui = kit.makeUi(kit.loadCytoscape());
        build(regions, 'separate', ui);
        const mid = build(regions, 'merged', ui);
        expect(mergedNodes(mid.ui.cy).length).toBeGreaterThan(0);
        expect(ui.mergedNodeOf?.size).toBeGreaterThan(0);
        const back = build(regions, 'separate', ui).els;
        expect(ui.mergedNodeOf).toBeNull();
        // eslint-disable-next-line no-console
        console.log(`[merged-round-trip] fresh=${kit.digestOf(fresh)} back=${kit.digestOf(back)} merged=${kit.digestOf(mid.els)}`);
        expect(kit.digestOf(back)).toBe(kit.digestOf(fresh));
        expect(kit.digestOf(back)).toBe('8760984c763bdf2e'); // groups-a's seedling_playthrough mid pin
    });

    it('the merged node: its label is the key plus summed counts, its state the members\' (groupState)', () => {
        const { regions } = load(SEEDLING);
        const { ui, dm } = build(regions, 'merged');
        const node = mergedNodes(ui.cy).filter((n) => (n.data('groupCounts')?.total ?? 0) > 0)[0];
        const c = node.data('groupCounts');
        const counts = node.data('members').map((m) => dm.calculateLocationCounts(m, regions.get(m)));
        expect(c).toMatchObject(vm.aggregateCounts(counts));
        expect(node.data('label')).toBe(`${node.data('groupKey')}\n${c.checked}, ${c.accessible}, ${c.inaccessible} / ${c.total}`);
        expect(node.hasClass('region')).toBe(false);
        expect(node.data('regionName')).toBeUndefined();
        expect(G.mergedNodeHoverText('k', ['a', 'b'])).toBe('k: 2 sub-regions\n• a\n• b');
    });
});

describe('⛓ merged: a merged edge\'s STATE', () => {
    it('best state wins: accessible when ANY exit is traversable; mixed when they disagree', () => {
        expect(G.mergedEdgeState([{ traversable: true }, { traversable: false }])).toEqual({ traversable: true, mixed: true, traversableCount: 1, total: 2 });
        expect(G.mergedEdgeState([{ traversable: false }, { traversable: false }])).toMatchObject({ traversable: false, mixed: false });
        expect(G.mergedEdgeState([{ traversable: true }])).toMatchObject({ traversable: true, mixed: false });
    });

    it('on seedling: each merged edge is coloured by its exits\' own states, and the hover lists each one', () => {
        const { regions } = load(SEEDLING, 'mid');
        const { ui } = build(regions, 'merged');
        const gim = new GraphInteractionManager(ui);
        let mixedSeen = 0;
        ui.cy.edges('[exits]').forEach((e) => {
            const own = e.data('exits').map((x) => vm.exitState(sm.snapshot, sm.staticData,
                { source: x.from, target: x.to, forwardRule: x.rule, reverseRule: null, bidirectional: false }).traversable);
            expect(e.scratch('_rgExitStates').map((s) => s.traversable)).toEqual(own);
            expect(e.hasClass('accessible')).toBe(own.some(Boolean));
            expect(e.hasClass('inaccessible')).toBe(!own.some(Boolean));
            expect(e.hasClass('mixed-exits')).toBe(own.some(Boolean) && !own.every(Boolean));
            if (e.hasClass('mixed-exits')) {
                mixedSeen++;
                const text = gim.hoverTextOf(e).split('\n');
                expect(text[0]).toBe(`${own.length} exits`);
                e.data('exits').forEach((x, i) => expect(text[i + 1]).toBe(`${own[i] ? '✓' : '✗'} ${x.name} (${x.from} → ${x.to})`));
            }
        });
        expect(mixedSeen).toBeGreaterThan(0);
    });
});

describe('⛓ merged: clicks', () => {
    it('regionOfCell is ONE function: the Region Map re-exports the view model\'s', () => {
        expect(mapClicks.regionOfCell).toBe(vm.regionOfCell);
        expect(vm.regionOfCell('L1', ['L1:a', 'L1', 'L1:b'])).toBe('L1');
        expect(vm.regionOfCell('level-3', ['L3 top', 'L3 bottom'])).toBe('L3 top');
    });

    it('a tap on a group node runs the REGION click on regionOfCell(key, members); a box still runs none', () => {
        const { regions } = load(SEEDLING);
        const { ui } = build(regions, 'merged');
        const gim = new GraphInteractionManager(ui);
        const runs = [];
        vi.spyOn(gim, 'runClick').mockImplementation((target, ctx) => { runs.push([target, ctx.regionName]); return 'ran'; });
        for (const node of mergedNodes(ui.cy)) {
            const expected = vm.regionOfCell(node.data('groupKey'), node.data('members'));
            runs.length = 0;
            expect(gim.onNodeTap(node)).toBe('ran');
            expect(runs).toEqual([['region', expected]]);
            expect(ui.selectedNode).toBe(expected);
            expect(node.hasClass('selected')).toBe(true);
        }
        const nested = build(regions, 'nested').ui;
        const gimN = new GraphInteractionManager(nested);
        const spy = vi.spyOn(gimN, 'runClick');
        expect(gimN.onNodeTap(nested.cy.nodes().filter((n) => G.isRegionGroupNode(n))[0])).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('⛓ merged: paths', () => {
    function pathUi(rel = SEEDLING) {
        const { regions } = load(rel, 'end');
        const { ui } = build(regions, 'merged');
        const gim = new GraphInteractionManager(ui);
        ui.highlightPathEdges = () => gim.highlightPathEdges();
        const pf = new PathFinder({ getStaticData: () => sm.staticData, getLatestStateSnapshot: () => sm.snapshot,
            getEffectiveBidirectionalSetting: () => false });
        return { regions, ui, gim, pf };
    }
    const movesOf = (steps) => steps.slice(1).map((r, i) => ({ type: 'regionMove', sourceRegion: steps[i], destinationRegion: r, exitUsed: null }));
    async function highlight(ui, gim, steps) {
        ui.currentPath = movesOf(steps);
        gs.current = { getPath: () => ui.currentPath };
        gim.highlightPathEdges();
        await new Promise((r) => setTimeout(r, 20));
        return ui.cy.edges('.in-path');
    }

    it('a path to and through group nodes shows as a path through group nodes, no internal step', async () => {
        const { ui, gim, pf } = pathUi();
        const start = sm.snapshot.startRegions.default[0];
        // The group whose click region is farthest from the start (a path through other groups on the way).
        let best = null;
        for (const node of mergedNodes(ui.cy)) {
            const target = vm.regionOfCell(node.data('groupKey'), node.data('members'));
            const p = pf.findPath(start, target);
            if (p && (!best || p.steps.length > best.steps.length)) best = { node, steps: p.steps };
        }
        expect(best).toBeTruthy();
        const nodeSteps = G.pathNodeSteps(best.steps, ui.mergedNodeOf);
        expect(nodeSteps[nodeSteps.length - 1]).toBe(best.node.id());
        expect(nodeSteps.filter((s) => s.startsWith(G.GROUP_ID_PREFIX)).length).toBeGreaterThan(1);
        for (let i = 1; i < nodeSteps.length; i++) expect(nodeSteps[i]).not.toBe(nodeSteps[i - 1]);
        const lit = await highlight(ui, gim, best.steps);
        const pairs = new Set(nodeSteps.slice(1).map((s, i) => [nodeSteps[i], s].sort().join('|')));
        expect(lit.length).toBe(pairs.size);
        lit.forEach((e) => expect(pairs.has([e.source().id(), e.target().id()].sort().join('|'))).toBe(true));
        // eslint-disable-next-line no-console
        console.log(`[merged-path] ${best.steps.length} regions → ${nodeSteps.length} nodes, ${lit.length} edges lit`);
    });

    it('start and target in the SAME group: nothing is highlighted', async () => {
        const { ui, gim, pf } = pathUi();
        let found = null;
        for (const node of mergedNodes(ui.cy)) {
            const m = node.data('members');
            for (let i = 0; i < m.length && !found; i++) for (let j = 0; j < m.length && !found; j++) {
                if (i === j) continue;
                const p = pf.findPath(m[i], m[j]);
                if (p && p.steps.length > 1 && p.steps.every((s) => m.includes(s))) found = { node, steps: p.steps };
            }
            if (found) break;
        }
        expect(found).toBeTruthy();
        expect(G.pathNodeSteps(found.steps, ui.mergedNodeOf)).toEqual([found.node.id()]);
        expect((await highlight(ui, gim, found.steps)).length).toBe(0);
    });

    it('G → X → G (leave a group and re-enter it): the one G–X edge, no self-loop', async () => {
        const { ui, gim } = pathUi();
        // A merged edge between a group and an outside node, with exits from two different members or both ways.
        const e = ui.cy.edges('[exits]').filter((x) => x.data('hasForwardExit') && x.data('hasReverseExit')
            && (G.isRegionGroupNode(x.source(), 'merged') || G.isRegionGroupNode(x.target(), 'merged')))[0];
        expect(e).toBeTruthy();
        const g = G.isRegionGroupNode(e.source(), 'merged') ? e.source().id() : e.target().id();
        const out = e.data('exits').find((x) => ui.mergedNodeOf.get(x.from) === g);
        const back = e.data('exits').find((x) => ui.mergedNodeOf.get(x.to) === g);
        const steps = [out.from, out.to, back.to];
        expect(G.pathNodeSteps(steps, ui.mergedNodeOf)).toEqual([g, out.to, g]);
        const lit = await highlight(ui, gim, steps);
        expect(lit.length).toBe(1);
        expect(lit[0].id()).toBe(e.id());
        expect(ui.cy.edges().filter((x) => x.source().id() === x.target().id()).length).toBe(0);
    });
});

describe('⛓ merged: saved positions', () => {
    it('merged never writes separate\'s store; switching back restores separate\'s saved layout untouched', () => {
        const { regions } = load(SEEDLING);
        let layouts = 0;
        const ui = kit.makeUi(kit.loadCytoscape(), { runLayout() { layouts += 1; } });
        const lcm = new LayoutControlsManager(ui);
        build(regions, 'separate', ui);
        ui.subRegionView = 'separate';
        lcm.saveNodePositions();
        const saved = JSON.stringify([...ui.nodePositions]);
        expect(ui.nodePositions.size).toBe(regions.size);

        layouts = 0;
        build(regions, 'merged', ui);
        // Every node placed from separate's saved layout (a group at its members' centroid): no layout.
        expect(layouts).toBe(0);
        const g = mergedNodes(ui.cy)[0];
        const pts = g.data('members').map((m) => ui.nodePositions.get(m));
        expect(g.position().x).toBeCloseTo(pts.reduce((a, p) => a + p.x, 0) / pts.length, 6);
        // A merged layout saves into merged's OWN store.
        g.position({ x: 12345, y: 678 });
        lcm.saveNodePositions();
        expect(JSON.stringify([...ui.nodePositions])).toBe(saved);
        expect(ui.mergedNodePositions.get(g.id())).toEqual({ x: 12345, y: 678 });
        expect(ui.mergedNodePositions.size).toBe(ui.cy.nodes().length);
        // A merged rebuild re-uses its own store.
        build(regions, 'merged', ui);
        expect(ui.cy.getElementById(g.id()).position()).toEqual({ x: 12345, y: 678 });
        expect(layouts).toBe(0);
        // Export lists no group node.
        // Back to separate: its saved layout, untouched; no layout.
        build(regions, 'separate', ui);
        expect(layouts).toBe(0);
        expect(JSON.stringify([...ui.nodePositions])).toBe(saved);
        for (const [id, pos] of ui.nodePositions) expect(ui.cy.getElementById(id).position()).toEqual(pos);
    });

    it('with no saved layout, merged lays out (and runLayout reads merged\'s store, never separate\'s)', () => {
        const { regions } = load(SEEDLING);
        let layouts = 0;
        const ui = kit.makeUi(kit.loadCytoscape(), { runLayout() { layouts += 1; } });
        build(regions, 'merged', ui);
        expect(layouts).toBe(1);
        const lcm = new LayoutControlsManager(ui);
        ui.subRegionView = 'merged';
        expect(lcm.positionStore()).toBe(ui.mergedNodePositions);
        ui.subRegionView = 'separate';
        expect(lcm.positionStore()).toBe(ui.nodePositions);
    });
});

describe('⛓ merged: the other readers', () => {
    it('location nodes attach to the group node, each keeping its own region', () => {
        const { regions } = load(SEEDLING);
        const { ui, dm } = build(regions, 'merged');
        const groups = mergedNodes(ui.cy).map((n) => [n, n.data('members').reduce((a, m) => a + (regions.get(m).locations ?? []).length, 0)])
            .sort((a, b) => b[1] - a[1]);
        const [node, count] = groups[0];
        ui.locationVisibilityMode = 'hover';
        dm.showLocationNodesForRegion(node.id());
        const locs = ui.cy.nodes('.location-node');
        expect(locs.length).toBe(count);
        locs.forEach((l) => {
            expect(l.data('anchorNode')).toBe(node.id());
            expect(node.data('members')).toContain(l.data('parentRegion'));
            expect(l.id()).toBe(`loc_${l.data('parentRegion')}_${l.data('locationName')}`);
        });
        expect(ui.cy.edges('.region-location-edge').every((e) => e.source().id() === node.id())).toBe(true);
        // eslint-disable-next-line no-console
        console.log(`[merged-locations] seedling_playthrough most locations on one merged node: ${node.data('groupKey')} = ${count}`);
        dm.hideLocationNodesForRegion(node.id());
        expect(ui.cy.nodes('.location-node').length).toBe(0);
        expect(ui.cy.edges('.region-location-edge').length).toBe(0);
    });

    it('the player marker and "current" sit on the group node of the player\'s region; centring finds it', () => {
        const { regions } = load(SEEDLING);
        const { ui } = build(regions, 'merged');
        const gim = new GraphInteractionManager(ui);
        ui.highlightCurrentRegion = (r) => gim.highlightCurrentRegion(r);
        const nav = new NavigationManager(ui);
        const node = mergedNodes(ui.cy)[0];
        const member = node.data('members')[1];
        node.position({ x: 100, y: 200 });
        nav.updatePlayerLocation(member);
        expect(ui.cy.getElementById('player').position()).toEqual({ x: 130, y: 170 });
        expect(node.hasClass('current')).toBe(true);
        expect(centreGraphOn(ui, member)).toBe(true);
        expect(centreGraphOn(ui, 'no such region')).toBe(false);
        // A step inside the group has no edge: the incoming-exit position falls back (null).
        expect(nav.getIncomingExitEdgePosition(member, node.data('members')[0], 'x')).toBeNull();
    });

    it('the node picker lists each member by name and resolves it to its group node (the click runs on the member)', () => {
        const { regions } = load(ATLAS);
        const { ui } = build(regions, 'merged');
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
        const node = mergedNodes(ui.cy)[0];
        const member = node.data('members')[0];
        parts[PICKER.region].value = member;
        listeners.region.change();
        expect(calls).toEqual([[node.id(), member]]);
        expect(parts[PICKER.status].textContent).toBe(`Went to region ${member}.`);
    });

    it('hub detection counts a merged node (it has edges); it never counted a box', () => {
        const { regions } = load(SEEDLING);
        const { ui, dm } = build(regions, 'merged');
        const top = mergedNodes(ui.cy).sort((a, b) => b.degree() - a.degree())[0];
        const hubs = dm.identifyHubNodes(top.degree());
        expect(hubs.map((h) => h.id)).toContain(top.id());
        const nested = build(regions, 'nested').ui;
        new GraphDataManager(nested).identifyHubNodes(0);
        expect(nested.cy.nodes().filter((n) => G.isRegionGroupNode(n) && n.hasClass('hub')).length).toBe(0);
    });
});
