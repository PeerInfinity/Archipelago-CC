// APWORLD SUBSTRATE CHANGE M1 (R8, shape A) — THE MENU IS THE LAYOUT'S HUB.
//
// `layoutTopDown` strips a Menu-named start and roots the BFS at its FIRST
// exit's target. Every FURTHER Menu exit's target is now a root too — placed,
// when the roots before it did not reach it, at a `findDisconnectedCell`, with
// `parent: null` — and `layout.menuRoots` records which Menu exit fed each root.
// Measured before the change (plan §26.0): mm3 placed 1/23, marioland2 1/32.
//
// The byte half: a ONE-exit Menu draws no extra rng, so its layout is the one a
// document WITHOUT the Menu (start = the Menu's target) gets — cell for cell,
// rng state included. That comparison is the rows' "before", because it is what
// the single-root code computed for such a source.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import '../mazeRoom/mazeRoomLibrary.js';
import { createRng } from '../shared/rng.js';
import {
    layoutTopDown, getRegionExits, getRegionEntrance,
    sphereRebuildRefusal, rebuildEnvelopeFromRulesJson,
} from './procgenPipelineEngine.js';
import { buildTopDownEnvelope, runTopDownToStep, runTopDownStep } from './topDownSteps.js';

const preset = (game, id = 'AP_14089154938208861744') => JSON.parse(readFileSync(new URL(
    `../../presets/${game}/${id}/${id}_rules.json`, import.meta.url,
), 'utf8'));

const OPTS = (side) => ({
    gridDims: { width: side, height: side },
    regionSizeBase: { width: 8, height: 6 },
    seed: 1,
    substrateMix: { maze: 1 },
});

function layoutOf(doc, side) {
    const rng = createRng(1);
    const layout = layoutTopDown(doc, OPTS(side), rng);
    return { layout, rngState: rng.getState() };
}

/** The same document with its Menu removed and the start moved to the Menu's first target. */
function withoutMenu(doc) {
    const out = JSON.parse(JSON.stringify(doc));
    const regions = out.regions['1'];
    const target = regions.Menu.exits[0].connected_region;
    delete regions.Menu;
    out.start_regions['1'] = Array.isArray(out.start_regions['1'])
        ? [target] : { ...out.start_regions['1'], default: [target] };
    return out;
}

const placement = (layout) => JSON.stringify({
    order: layout.placementOrder,
    cells: [...layout.cellsByName],
    tele: layout.teleporterEdges,
    substrates: layout.substrateByRegion,
});

/**
 * The Menu targets that NEED a root, derived without the layout: walk the
 * document's exits (never into the Menu) from each target in Menu-exit order;
 * a target no earlier root reached needs its own.
 */
function targetsNeedingARoot(doc) {
    const regions = doc.regions['1'];
    const seen = new Set();
    const need = [];
    for (const e of regions.Menu.exits) {
        const t = e.connected_region;
        if (!regions[t] || t === 'Menu' || seen.has(t)) continue;
        need.push(t);
        const q = [t];
        seen.add(t);
        while (q.length) {
            for (const x of regions[q.shift()]?.exits ?? []) {
                const u = x.connected_region;
                if (u && u !== 'Menu' && regions[u] && !seen.has(u)) { seen.add(u); q.push(u); }
            }
        }
    }
    return { need, reachable: seen };
}

/** A small hub: Menu → A, B, C (B also reached from A), D only from C. */
function hubSource() {
    const T = { rule: 'True_' };
    const reg = (name, exits = [], locations = []) => ({ name, exits, locations });
    const ex = (name, to) => ({ name, connected_region: to, access_rule: T });
    return {
        game_name: 'Hub',
        start_regions: { 1: { default: ['Menu'] } },
        regions: {
            1: {
                Menu: reg('Menu', [ex('Menu -> A', 'A'), ex('Menu -> B', 'B'), ex('Menu -> C', 'C')]),
                A: reg('A', [ex('A -> B', 'B')], [{ name: 'A1', access_rule: T, item: { name: 'k1' } }]),
                B: reg('B', [], [{ name: 'B1', access_rule: T, item: { name: 'k2' } }]),
                C: reg('C', [ex('C -> D', 'D')], [{ name: 'C1', access_rule: T, item: { name: 'k3' } }]),
                D: reg('D', [], [{ name: 'D1', access_rule: T, item: { name: 'Victory' } }]),
            },
        },
        items: { 1: {} },
    };
}

describe('M1 — a ONE-exit Menu lays out exactly as before', () => {
    for (const [game, side] of [['adventure', 4], ['bumpstik', 5], ['shorthike', 6]]) {
        it(`${game}: placement, cells, teleporters and rng state equal the Menu-less document's`, () => {
            const doc = preset(game);
            expect(doc.regions['1'].Menu.exits).toHaveLength(1);
            const withMenu = layoutOf(doc, side);
            const bare = layoutOf(withoutMenu(doc), side);
            expect(placement(withMenu.layout)).toBe(placement(bare.layout));
            expect(withMenu.rngState).toEqual(bare.rngState);
            expect(withMenu.layout.menuRoots).toEqual([{
                name: doc.regions['1'].Menu.exits[0].connected_region,
                exit_id: doc.regions['1'].Menu.exits[0].name,
            }]);
            expect(bare.layout.menuRoots).toEqual([]);
        });
    }
});

describe('M1 — every Menu exit feeds a root', () => {
    it('mm3 (13 Menu exits; 1/23 placed before): every Menu-reachable region placed, roots parent-less, in Menu-exit order', () => {
        const doc = preset('mm3');
        const { layout } = layoutOf(doc, 7);
        const { need, reachable } = targetsNeedingARoot(doc);
        for (const r of reachable) expect(layout.cellsByName.has(r), r).toBe(true);
        expect(layout.placementOrder).toHaveLength(layout.stats.regionsTotal);
        expect(layout.menuRoots.map((r) => r.name)).toEqual(need);
        const exitOf = new Map(doc.regions['1'].Menu.exits.map((e) => [e.connected_region, e.name]));
        for (const { name, exit_id } of layout.menuRoots) expect(exit_id).toBe(exitOf.get(name));
        const roots = layout.placementOrder.filter((p) => p.parent == null).map((p) => p.name);
        expect(roots).toEqual(need);
        // A root is fed by the Menu, which has no cell: no teleporter edge from it.
        expect(layout.teleporterEdges.some((t) => t.from_name === layout.menuName)).toBe(false);
    });

    it('the start region\'s BFS is the unchanged PREFIX of a multi-exit layout', () => {
        const doc = preset('mm3');
        const { layout } = layoutOf(doc, 7);
        const firstOnly = JSON.parse(JSON.stringify(doc));
        firstOnly.regions['1'].Menu.exits = firstOnly.regions['1'].Menu.exits.slice(0, 1);
        const { layout: single } = layoutOf(firstOnly, 7);
        expect(layout.placementOrder.slice(0, single.placementOrder.length)).toEqual(single.placementOrder);
    });

    it('a Menu exit whose target an earlier root already reached gets NO root', () => {
        const { layout } = layoutOf(hubSource(), 6);
        expect(layout.menuRoots).toEqual([
            { name: 'A', exit_id: 'Menu -> A' },
            { name: 'C', exit_id: 'Menu -> C' },
        ]);
        expect(layout.placementOrder.find((p) => p.name === 'B').parent).toEqual({ name: 'A', exit_id: 'A -> B' });
        expect(layout.placementOrder.find((p) => p.name === 'D').parent).toEqual({ name: 'C', exit_id: 'C -> D' });
        expect(layout.stats.regionsTotal).toBe(4);
        expect(layout.placementOrder).toHaveLength(4);
    });

    it('a 1×1 grid places only the start; the unplaced are every other region, the skips counted', () => {
        const doc = preset('mm3');
        const { layout } = layoutOf(doc, 1);
        expect(layout.placementOrder.map((p) => p.name)).toEqual([layout.menuRoots[0].name]);
        expect(layout.menuRoots).toHaveLength(1);
        const unplaced = Object.keys(doc.regions['1']).filter((n) => n !== 'Menu' && !layout.cellsByName.has(n));
        expect(unplaced).toHaveLength(layout.stats.regionsTotal - 1);
        // Each of the 12 further Menu targets found no cell: counted like a dropped edge.
        expect(layout.stats.regionsSkipped).toBeGreaterThanOrEqual(12);
    });
});

describe('M1 — ③ treats a Menu root as it treats the start', () => {
    it('no back-exit is inserted into a root, and its entrance is left as ② realised it', async () => {
        const env = buildTopDownEnvelope({
            source: hubSource(), seed: 1, gridDims: { width: 6, height: 6 },
            regionSizeBase: { width: 8, height: 6 }, substrateMix: { maze: 1 },
        });
        await runTopDownToStep(env, 'realise');
        const { grid, cellsByName, menuRoots } = env.layout;
        const entranceBefore = new Map([...cellsByName].map(([n, c]) => [n, { ...getRegionEntrance(grid.getRegion(c)) }]));
        await runTopDownStep('finalize', env);
        const backExits = (name) => [...getRegionExits(grid.getRegion(cellsByName.get(name))).values()]
            .filter((e) => e.isBackExit);
        for (const { name } of menuRoots) {
            expect(backExits(name), name).toEqual([]);
            expect(getRegionEntrance(grid.getRegion(cellsByName.get(name)))).toEqual(entranceBefore.get(name));
        }
        // …while a BFS child still gets its back-exit (the source declares none).
        expect(backExits('D').map((e) => e.targetRegion)).toEqual(['C']);
        expect(env.finalize.stats.stopReason).toBe('all_placed');
    });
});

describe('M1 — the sphere rebuild REFUSES a multi-root tree by name', () => {
    const sphereLogOf = (game) => readFileSync(new URL(
        `../../presets/${game}/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl`, import.meta.url,
    ), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

    async function topDownSphere(game, side) {
        const env = buildTopDownEnvelope({
            source: preset(game), seed: 1, gridDims: { width: side, height: side },
            regionSizeBase: { width: 8, height: 6 }, substrateMix: { maze: 1 }, sphereLog: sphereLogOf(game),
        });
        await runTopDownToStep(env, 'compile');
        return env.compile.rulesJson;
    }

    it('mm3 top-down-sphere: 13 roots → the predicate and the throw are ONE sentence', async () => {
        const doc = await topDownSphere('mm3', 7);
        expect(doc.procgen_metadata.driver).toBe('top-down-sphere');
        const roots = doc.procgen_metadata.sphere_tree.nodes.filter((n) => n.parent == null).length;
        expect(roots).toBe(13);
        const refusal = sphereRebuildRefusal(doc);
        expect(refusal).toMatch(/13 roots/);
        expect(() => rebuildEnvelopeFromRulesJson(doc)).toThrow(refusal);
    });

    it('adventure top-down-sphere (one root) is not refused by it', async () => {
        const doc = await topDownSphere('adventure', 4);
        expect(sphereRebuildRefusal(doc)).toBeNull();
        expect(() => rebuildEnvelopeFromRulesJson(doc)).not.toThrow();
    });
});
