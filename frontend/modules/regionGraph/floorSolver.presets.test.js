/**
 * ⛓ THE FLOOR SOLVER ON THE FROZEN PRESETS (region-graph-floor-solver; `floorSolver.js`), and THE REPORT's tables.
 * Over the FROZEN fixtures (rules AND the Seedling atlases they were cut against, `loadFrozenAtlas`; never a live
 * preset): seedling_playthrough (`merged` and `separate`), seedling_atlas, procgen_maze, alttp. Pins each preset's
 * headline numbers at the doorway bound ±1 (shipped) and ±2 (the "wider range" experiment, ruling 1; reported, not
 * shipped), and the former `level_5` / `level_7` conflicts.
 *
 * Re-run the report's tables (CC/docs/region-graph/floor-solver.md §3–§6):
 *   FLOOR_SOLVER_REPORT=/some/path.md npx vitest run frontend/modules/regionGraph/floorSolver.presets.test.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
// ⛓ The shipped Seedling atlases → the FROZEN ones the frozen rules were cut against (as directionLayout.test.js).
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('./regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));
await import('../flashPanel/flashSeedlingLibrary.js');
const { GraphDataManager } = await import('./graphDataManager.js');
const { LayoutControlsManager, isDirectionSettingKey } = await import('./layoutControlsManager.js');
const { MapLookLayer } = await import('./mapLookLayer.js');
const { isRegionGroupNode, SUB_REGION_VIEW_SCHEMA } = await import('./subRegionGroups.js');
const { FloorBoxLayer, FLOOR_BOX_CLASS } = await import('./floorBoxLayer.js');
const D = await import('./directionLayout.js');
const G = await import('./floorGroups.js');
const kit = await import('./regionGraphElements.testkit.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const cytoscape = kit.loadCytoscape();
const digest = (positions) => createHash('sha256').update(D.positionsKey(positions)).digest('hex').slice(0, 16);
const NODE_STYLE = [{ selector: 'node', style: { width: 60, height: 45, 'border-width': 2, shape: 'ellipse' } }];
const VALUES = G.FLOOR_GROUPING_SCHEMA.enum;

/** A minimal DOM for the box layer (vitest runs in node): elements with style, dataset, children. */
function fakeDoc() {
    const make = (tag) => {
        const el = {
            tagName: tag, style: {}, dataset: {}, children: [], parentNode: null, className: '', textContent: '',
            get nextSibling() { const p = this.parentNode; if (!p) return null; const i = p.children.indexOf(this); return p.children[i + 1] ?? null; },
            classList: { contains(c) { return String(el.className).split(/\s+/).includes(c); } },
            setAttribute(k, v) {
                if (k !== 'style') { this[k] = v; return; }
                for (const decl of String(v).split(';')) {
                    const i = decl.indexOf(':');
                    if (i > 0) this.style[decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = decl.slice(i + 1).trim();
                }
            },
            appendChild(c) { c.parentNode?.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = this; this.children.push(c); return c; },
            remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } },
            querySelector(sel) {
                const cls = sel.replace(/^\./, '');
                const walk = (n) => { for (const c of n.children) { if (c.classList.contains(cls)) return c; const f = walk(c); if (f) return f; } return null; };
                return walk(this);
            },
        };
        return el;
    };
    return { createElement: make };
}

/** Build the panel's graph for frozen `preset` in `view` with `nodeLook` → { ui, lcm, dm }. */
function build(preset, view, { nodeLook = 'graph', open = [], doc = null } = {}) {
    const rules = kit.loadFrozenRules(preset);
    const regions = kit.regionsOf(rules);
    sm.rules = rules;
    sm.staticData = { regions, exits: null };
    sm.snapshot = kit.threeStates(rules, regions).find((s) => s.name === 'mid').snapshot;
    const ui = kit.makeUi(cytoscape, {
        cy: cytoscape({ headless: true, styleEnabled: true, style: NODE_STYLE }), subRegionView: view, nodeLook,
    });
    ui.graphContainer = doc ? doc.createElement('div') : null;
    ui.mapLook = new MapLookLayer(ui);
    const dm = new GraphDataManager(ui);
    ui.dataManager = dm;
    if (view === 'collapsible') { const set = dm.openGroupKeys(); set.clear(); for (const k of open) set.add(k); }
    dm.buildGraphFromRegions(regions, null);
    const lcm = new LayoutControlsManager(ui);
    ui.layoutControlsManager = lcm;
    if (nodeLook === 'map') expect(ui.mapLook.sync()).toBe(true);
    return { ui, lcm, dm };
}



const FS = await import('./floorSolver.js');
const { floorConnections } = FS;

const PRESETS = [['seedling_playthrough', 'merged'], ['seedling_playthrough', 'separate'], ['seedling_atlas', 'merged'],
    ['procgen_maze', 'separate'], ['alttp', 'separate']];

/** The frozen preset's Region Map model (the panel's own, as the layout reads it). */
function modelOf(preset, view) {
    const { ui } = build(preset, view);
    const got = ui.mapLook.regionMapModel();
    ui.mapLook.dispose();
    return got?.model ?? null;
}

/** The plain consistent system (no least-stretch reading): how many groups have an unbounded floor, either side. */
function unboundedCount(model) {
    const C = floorConnections(model);
    const names = [...C.reached].sort();
    const ix = new Map(names.map((g, i) => [g, i]));
    const e = [];
    for (const c of C.connections) {
        if (Number.isFinite(c.hi)) e.push([ix.get(c.ga), ix.get(c.gb), c.hi]);
        if (Number.isFinite(c.lo)) e.push([ix.get(c.gb), ix.get(c.ga), -c.lo]);
    }
    const sp = (rev) => {
        const d = new Array(names.length).fill(Infinity); d[ix.get(C.start)] = 0;
        for (let i = 0; i < names.length; i += 1) for (const [u0, v0, w] of e) { const [u, v] = rev ? [v0, u0] : [u0, v0]; if (d[u] + w < d[v]) d[v] = d[u] + w; }
        return d;
    };
    const hi = sp(false); const lo = sp(true);
    return names.filter((g, i) => hi[i] === Infinity || lo[i] === Infinity).length;
}

const summary = (sol) => {
    const a = FS.floorAmbiguities(sol);
    return {
        picked: sol.floorOf.size, ranged: sol.ranged.size, unreached: sol.unreached.length,
        spans: sol.spans, stretch: sol.stretch, contradictions: sol.contradictions.length, exact: sol.exact,
        connections: sol.connections.length, doorways: sol.connections.filter((c) => !c.stair && c.doorway).length,
        stairs: sol.connections.filter((c) => c.stair).length, ambiguousDoorways: a.doorways.length,
        forcedDoorways: a.forcedDoorways.length, changingDoorways: sol.connections.filter((c) => !c.stair && c.doorway && c.delta !== 0).length,
        stretchedStairs: a.stairs.filter((c) => c.stretched).length, mustStretch: a.stairs.filter((c) => c.mustStretch).length,
        canStretch: a.stairs.filter((c) => c.canStretch).length,
    };
};

const WANT = {
    seedling_playthrough: {
        1: { picked: 43, ranged: 0, unreached: 0, spans: { pick: 7, min: 7, max: 8 }, stretch: 1, contradictions: 0, exact: true },
        2: { picked: 43, ranged: 0, unreached: 0, spans: { pick: 7, min: 7, max: 10 }, stretch: 1, contradictions: 0, exact: true },
    },
    seedling_atlas: {
        1: { picked: 3, ranged: 0, unreached: 0, spans: { pick: 1, min: 1, max: 3 }, stretch: 0, contradictions: 0, exact: true },
        2: { picked: 3, ranged: 0, unreached: 0, spans: { pick: 1, min: 1, max: 5 }, stretch: 0, contradictions: 0, exact: true },
    },
    procgen_maze: {
        1: { picked: 1, ranged: 0, unreached: 0, spans: { pick: 1, min: 1, max: 1 }, stretch: 0, contradictions: 0, exact: true },
        2: { picked: 1, ranged: 0, unreached: 0, spans: { pick: 1, min: 1, max: 1 }, stretch: 0, contradictions: 0, exact: true },
    },
    alttp: {
        1: { picked: 1, ranged: 0, unreached: 2, spans: { pick: 1, min: 1, max: 1 }, stretch: 0, contradictions: 0, exact: true },
        2: { picked: 1, ranged: 0, unreached: 2, spans: { pick: 1, min: 1, max: 1 }, stretch: 0, contradictions: 0, exact: true },
    },
};

describe('⛓ the frozen presets', () => {
    const cache = new Map();
    const get = (preset, view) => {
        const k = `${preset}/${view}`;
        if (!cache.has(k)) cache.set(k, modelOf(preset, view));
        return cache.get(k);
    };
    for (const [preset, view] of PRESETS) {
        it(`${preset} (${view}): the headline numbers at ±1 and ±2`, () => {
            const m = get(preset, view);
            for (const bound of [1, 2]) expect(summary(FS.solveFloors(m, { bound })), `±${bound}`).toMatchObject(WANT[preset][bound]);
        });
    }
    it('seedling_playthrough merged and separate are ONE group graph: the same solve', () => {
        const a = FS.solveFloors(get('seedling_playthrough', 'merged')); const b = FS.solveFloors(get('seedling_playthrough', 'separate'));
        expect([...b.floorOf]).toEqual([...a.floorOf]);
        expect([...b.interval]).toEqual([...a.interval]);
    });
    it('seedling_playthrough: the ambiguities (19 doorways free, 5 forced; ONE stair must span 2: level_12 → level_5)', () => {
        const sol = FS.solveFloors(get('seedling_playthrough', 'merged'));
        const s = summary(sol);
        expect(s).toMatchObject({ connections: 55, ambiguousDoorways: 19, forcedDoorways: 5, stretchedStairs: 1, mustStretch: 1, canStretch: 1 });
        const st = FS.floorAmbiguities(sol).stairs;
        expect(st.map((c) => [c.a, c.b, c.delta, c.range])).toEqual([['level_12', 'level_5', -2, [-2, -2]]]);
        // ±2 changes no stair and no contradiction: not "better results" (fewer contradictions or stretched stairs).
        const w = summary(FS.solveFloors(get('seedling_playthrough', 'merged'), { bound: 2 }));
        expect([w.stretchedStairs, w.contradictions]).toEqual([1, 0]);
        // Unbounded stairs without the least-stretch reading: most floors are half-infinite.
        expect(unboundedCount(get('seedling_playthrough', 'merged'))).toBe(24);
    });
    it('the former BFS conflicts: level_5 is −2 (its stair from level_12 spans two floors), level_7 is −1, both forced', () => {
        const sol = FS.solveFloors(get('seedling_playthrough', 'merged'));
        expect([sol.floorOf.get('level_5'), sol.interval.get('level_5')]).toEqual([-2, [-2, -2]]);
        expect([sol.floorOf.get('level_7'), sol.interval.get('level_7')]).toEqual([-1, [-1, -1]]);
        const labels = FS.floorLabels(sol);
        expect([labels.get('level_5'), labels.get('level_7'), labels.get('level_48'), labels.get('level_102')])
            .toEqual(['Floor −2A', 'Floor −1I', 'Floor 0H', 'Floor +1D']);
    });
    // ⛓ region-graph-floor-rename-letters: a doorway never joins two groups (`groupsR1`), so the groups of one floor
    // reached through doorways each get their OWN letter. Pinned: how many floors carry more than one letter.
    it('the letters per floor on seedling_playthrough (merged): how many floors carry 2+ letters', () => {
        const labels = FS.floorLabels(FS.solveFloors(get('seedling_playthrough', 'merged')));
        const perFloor = new Map();
        for (const l of labels.values()) {
            const [, floor, letter] = /^(Floor .*?) ?([A-Z]+)$/.exec(l);
            if (!perFloor.has(floor)) perFloor.set(floor, []);
            perFloor.get(floor).push(letter);
        }
        const table = Object.fromEntries([...perFloor].map(([f, ls]) => [f, ls.length]));
        expect(table).toEqual({ 'Floor +1': 4, 'Floor 0': 19, 'Floor −1': 10, 'Floor −2': 6, 'Floor −3': 2, 'Floor −4': 1, 'Floor −5': 1 });
        expect([...perFloor.values()].filter((ls) => ls.length >= 2).length).toBe(5); // of 7 floors, 43 groups
        // On each floor the letters run A, B, C, … with none skipped or repeated.
        for (const ls of perFloor.values()) expect([...ls].sort((x, y) => x.length - y.length || (x < y ? -1 : 1))).toEqual(ls.map((_, k) => FS.floorLetter(k)));
    });
    it('writes the report tables when FLOOR_SOLVER_REPORT names a file', () => {
        const out = process.env.FLOOR_SOLVER_REPORT;
        if (!out) return;
        writeFileSync(out, reportMarkdown(get));
    });
});


/* ── the report ───────────────────────────────────────────────────────────────────────────────────────────────── */

const rng = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo} … ${hi}`);
const sgn = (n) => (n > 0 ? `+${n}` : `${n}`);

function reportMarkdown(get) {
    const L = [];
    L.push('<!-- generated: FLOOR_SOLVER_REPORT=<file> npx vitest run frontend/modules/regionGraph/floorSolver.presets.test.js -->');
    L.push('', '### Headline numbers', '');
    L.push('| preset (view) | bound | groups | picked | ranged | unreached | floors: min / **pick** / max | stair stretch (total) | stairs stretched / must / can | doorways: ambiguous / forced / changing in the pick | contradictions | unbounded w/o least stretch | solve (node) |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [preset, view] of PRESETS) {
        const m = get(preset, view);
        for (const bound of [1, 2]) {
            FS.solveFloors(m, { bound }); // warm
            const t = performance.now();
            const sol = FS.solveFloors(m, { bound });
            const ms = performance.now() - t;
            const s = summary(sol);
            L.push(`| ${preset} (${view}) | ±${bound} | ${s.picked + s.ranged + s.unreached} | ${s.picked} | ${s.ranged} | ${s.unreached} | ${s.spans.min} / **${s.spans.pick}** / ${s.spans.max} | ${s.stretch} | ${s.stretchedStairs} / ${s.mustStretch} / ${s.canStretch} | ${s.ambiguousDoorways} / ${s.forcedDoorways} / ${s.changingDoorways} | ${s.contradictions} | ${unboundedCount(m)} | ${ms.toFixed(1)} ms, ${sol.ops} ops |`);
        }
    }
    for (const [preset, view] of PRESETS.filter(([p, v]) => !(p === 'seedling_playthrough' && v === 'separate'))) {
        const m = get(preset, view);
        const sol = FS.solveFloors(m);
        const w = FS.solveFloors(m, { bound: 2 });
        const labels = FS.floorLabels(sol);
        L.push('', `### ${preset}: every group (pick, interval at ±1, interval at ±2)`, '');
        L.push('| group | members | label | pick | interval ±1 | interval ±2 |', '|---|---|---|---|---|---|');
        const members = new Map(m.layout.groups.map((g) => [g.id, g.members.length]));
        const order = [...sol.order.keys(), ...sol.unreached];
        const rows = order.map((g) => ({ g, f: sol.floorOf.get(g) ?? null }))
            .sort((a, b) => (b.f ?? -1e9) - (a.f ?? -1e9) || (sol.order.get(a.g) ?? 1e9) - (sol.order.get(b.g) ?? 1e9));
        for (const { g, f } of rows) {
            L.push(`| \`${g}\` | ${members.get(g) ?? ''} | ${labels.get(g)} | ${f == null ? '—' : sgn(f)} | ${sol.interval.has(g) ? rng(sol.interval.get(g)) : '—'} | ${w.interval.has(g) ? rng(w.interval.get(g)) : '—'} |`);
        }
        const amb = FS.floorAmbiguities(sol);
        const ambW = FS.floorAmbiguities(w);
        if (sol.connections.length) {
            L.push('', `### ${preset}: the ambiguities (Δ = floor of the second group − the first's)`, '');
            L.push('| connection (display keys) | groups | kinds | Δ in the pick | Δ range ±1 | Δ range ±2 | note |', '|---|---|---|---|---|---|---|');
            const wOf = new Map(w.connections.map((c) => [c.id, c]));
            const listed = [...amb.doorways, ...amb.stairs].sort((a, b) => a.id - b.id);
            const extraW = [...ambW.doorways, ...ambW.stairs].filter((c) => !listed.some((x) => x.id === c.id));
            for (const c of [...listed, ...extraW]) {
                const cw = wOf.get(c.id);
                const kinds = [...new Set(c.links.map((l) => l.kind))].join(' + ');
                const note = c.stair ? (c.mustStretch ? 'stair: MUST span > 1' : c.canStretch ? 'stair: CAN span > 1' : c.stretched ? 'stair: stretched' : '')
                    : (c.range[0] < c.range[1] ? 'doorway: not forced' : 'doorway: forced at ±1, free at ±2');
                L.push(`| \`${c.a}\` – \`${c.b}\` | ${c.ga} – ${c.gb} | ${kinds} | ${sgn(c.delta)} | ${rng(c.range)} | ${cw ? rng(cw.range) : '—'} | ${note} |`);
            }
            if (amb.forcedDoorways.length) {
                L.push('', `Forced doorways at ±1: ${amb.forcedDoorways.map((c) => `\`${c.a}\` – \`${c.b}\` (Δ ${sgn(c.range[0])})`).join(', ')}.`);
            }
        }
    }
    return `${L.join('\n')}\n`;
}
