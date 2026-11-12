/**
 * ⛓ RULES rules-l63-darktrap-census — the DarkTrap-as-gate census (`census-seedling-darktrap-gates.mjs`). Two halves:
 * the PURE half on synthetic grids (the gate patch, the side arms, the partition diff, the sphere sweep), and the
 * census itself PINNED by its findings, so a rules change that moves one reds a row here and has to be read. Report
 * only: nothing a producer reads.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { analyzeRegion } from '../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js';
import {
    trapGatedGrid, trapGateOptions, trapGateRule, keptComponents, comparePartitions, classifyTrapGate, evalRule,
    sphereSweep, sphereMoves, withoutConjunct,
} from './seedlingDarkTrapGateCensus.js';
import { darkTrapGateCensus } from './census-seedling-darktrap-gates.mjs';

const open = () => ({ kind: 'open', conditions: [], faces: {}, dirs: {}, manual: [], labels: [] });
/** A 1-row corridor of `w` open cells; exits at both ends. */
const corridor = (w) => ({ width: w, height: 1, origin: { x: 0, y: 0 }, cells: Array.from({ length: w }, open) });
const REGION = { region_id: 'room', exits: [{ exit_id: 'west', entrance_tile: [0, 0] }, { exit_id: 'east', entrance_tile: [6, 0] }], locations: [] };
const BASE = { conditionKey: (c) => JSON.stringify(c), resolveCondition: (c) => (c?.flag ? { rule: 'Has', args: { item_name: c.flag } } : null) };
const OPTS = trapGateOptions(BASE);
const has = (n) => ({ rule: 'Has', args: { item_name: n } });

describe('the pure half', () => {
    it('a trap gated as specified splits the corridor; the crossing costs its event, both ways', () => {
        const base = analyzeRegion(REGION, corridor(7), OPTS);
        const gated = analyzeRegion(REGION, trapGatedGrid(corridor(7), [{ tiles: [[3, 0]], events: ['E'] }]), OPTS);
        expect(base.components.map((c) => c.id)).toEqual(['r0c0']);
        expect(gated.components.map((c) => c.id)).toEqual(['r0c0', 'r0c4']);
        expect(gated.internal_exits.map((r) => [r.from, r.to, r.bidirectional, r.access_rule]))
            .toEqual([['r0c0', 'r0c4', true, has('E')]]);
        const cmp = comparePartitions(base, gated, { baseSubs: keptComponents(base), gatedSubs: keptComponents(gated) });
        expect(cmp.pieces).toEqual([{ sub: 'r0c0', pieces: [{ id: 'r0c0', size: 3 }, { id: 'r0c4', size: 3 }] }]);
        expect(cmp.moved).toEqual([{ kind: 'exit', id: 'east', tile: [6, 0], from: 'r0c0', to: 'r0c4' }]);
        expect(cmp.lostCells).toBe(1);
        expect(classifyTrapGate(cmp)).toBe('iii');
    });

    it('side arms: the entry from a side with a stance costs Or(event, arm); from the other, the event alone', () => {
        const arm = has('Spear');
        const grid = trapGatedGrid(corridor(7), [{ tiles: [[3, 0]], events: ['E'], armFrom: ([x]) => (x < 3 ? arm : null) }]);
        const a = analyzeRegion(REGION, grid, OPTS);
        const rows = a.internal_exits.map((r) => [r.from, r.to, r.bidirectional === true, r.access_rule]).sort();
        expect(rows).toEqual([['r0c0', 'r0c4', false, { rule: 'Or', children: [has('E'), arm] }], ['r0c4', 'r0c0', false, has('E')]]);
    });

    it('an empty piece split off (no binding moves) is class (ii); no split is (i); a reason is (iv)', () => {
        const region = { ...REGION, exits: [REGION.exits[0], { exit_id: 'east', entrance_tile: [2, 0] }] };
        const base = analyzeRegion(region, corridor(7), OPTS);
        const gated = analyzeRegion(region, trapGatedGrid(corridor(7), [{ tiles: [[4, 0]], events: ['E'] }]), OPTS);
        const cmp = comparePartitions(base, gated, { baseSubs: keptComponents(base), gatedSubs: keptComponents(gated) });
        expect(keptComponents(gated)).toEqual(['r0c0', 'r0c5']);
        expect(classifyTrapGate(cmp)).toBe('ii');
        expect(classifyTrapGate(comparePartitions(base, base, { baseSubs: ['r0c0'], gatedSubs: ['r0c0'] }))).toBe('i');
        expect(classifyTrapGate(cmp, ['no event clears it'])).toBe('iv');
    });

    it('the gate rule, the evaluator and the conjunct removal', () => {
        expect(trapGateRule({ darktrapGate: ['A', 'B'], arm: has('S') })).toEqual({ rule: 'Or', children: [has('A'), has('B'), has('S')] });
        const inv = new Map([['A', 1], ['K', 2]]);
        expect(evalRule({ rule: 'HasAll', args: { item_names: ['A', 'K'] } }, inv)).toBe(true);
        expect(evalRule({ rule: 'HasAllCounts', args: { item_counts: { K: 3 } } }, inv)).toBe(false);
        expect(evalRule({ rule: 'Or', children: [has('Z'), { rule: 'HasAny', args: { item_names: ['Z', 'A'] } }] }, inv)).toBe(true);
        expect(() => evalRule({ rule: 'Mystery' }, inv)).toThrow(/unknown rule/);
        const gate = { rule: 'Or', children: [has('E'), has('S')] };
        expect(withoutConjunct({ rule: 'And', children: [gate, has('X')] }, gate)).toEqual(has('X'));
        expect(withoutConjunct(gate, gate)).toEqual({ rule: 'True_' });
        expect(withoutConjunct(has('X'), gate)).toEqual(has('X'));
    });

    it('the sweep: an event costs a sphere, and the moves are named', () => {
        const regions = new Map([['Menu', { exits: [{ to: 'A' }] }], ['A', { exits: [{ to: 'B', rule: has('E') }] }], ['B', { exits: [] }]]);
        const locations = [{ name: 'ev', item: 'E', sources: [{ region: 'A' }] }, { name: 'chest', item: 'X', sources: [{ region: 'B' }] }];
        const a = sphereSweep({ regions, start: 'Menu', locations });
        expect([...a.sphereOf]).toEqual([['ev', 0], ['chest', 1]]);
        const direct = new Map([...regions, ['A', { exits: [{ to: 'B' }] }]]);
        const b = sphereSweep({ regions: direct, start: 'Menu', locations });
        expect(sphereMoves(a, b)).toEqual([{ location: 'chest', before: 1, after: 0 }]);
    });
});

describe('the census on the delivered set (seed 1)', () => {
    let census;
    beforeAll(async () => { census = await darkTrapGateCensus(); }, 300_000);

    it('seven DarkTraps, each cleared by exactly one minted pole event; two split an empty piece off, five move a door', () => {
        expect(census.traps.map((t) => [t.level, t.trap, t.killers.map((k) => `${k.event} (${k.how})`), t.cls])).toEqual([
            [62, 'darktrap@112,208', ['L62 flag 0: lightpole@120,200 cleared (cross-room press)'], 'iii'],
            [63, 'darktrap@64,96', ['L63 flag 1: lightpole@64,88 cleared (cross-room press)'], 'iii'],
            [63, 'darktrap@80,64', ['L63 flag 1: lightpole@64,88 cleared (cross-room press)'], 'iii'],
            [63, 'darktrap@32,272', ['L63 flag 6: lightpole@48,272 cleared (in-room pole)'], 'iii'],
            [63, 'darktrap@128,272', ['L63 flag 7: lightpole@112,272 cleared (in-room pole)'], 'iii'],
            [65, 'darktrap@144,144', ['L65 flag 0: lightpole@128,168 cleared (in-room pole)'], 'ii'],
            [101, 'darktrap@160,80', ['L101 flag 0: lightpole@144,64 cleared (in-room pole)'], 'ii'],
        ]);
        expect(census.traps.every((t) => t.undecided.length === 0 && t.killers.every((k) => k.minted))).toBe(true);
    });

    it('L63 under (b): the foothold becomes its own EMPTY sub-region r5c5, and the struck block still prices its entry f1', () => {
        const l63 = census.regions.find((r) => r.region === 'level_63');
        expect(l63.all.subs).toEqual(['r0c1', 'r0c4', 'r5c5', 'r5c14', 'r6c9', 'r6c15', 'r10c2', 'r18c2', 'r18c8']);
        expect(l63.all.pieceTiles.r5c5).toEqual(['5,5', '5,6', '6,6']);
        expect(l63.all.empty).toContain('r5c5');
        expect(census.variants.V3.notes).toContain('V3 level_63 pushableblockspear@112,96: r6c9 -> r5c5 needs L63 flag 1: lightpole@64,88 cleared');
    });

    // ⛓ tile-rules-automation-r-a5: the baseline moved (L40's wand locks cost their presses: one extra event level before
    //   L43's Wand, The Seed 13.2 -> 14.2 collected), and against it (b) moves ONE location, not three: L68's two were 9 -> 10
    //   because (b) delayed them past the Wand's sphere; the baseline now collects them that late anyway.
    it('the baseline sweep reproduces the committed seed-1 sphere log; (b) as specified moves one location a sphere later, (b) with side arms none', () => {
        expect(census.baselineVsLog).toEqual([]);
        const later = [
            { location: 'L65 flag 0: lightpole@128,168 cleared', before: 8, after: 9 },
        ];
        expect(census.variants.V1.moves).toEqual(later);
        expect(census.variants.V2.moves).toEqual(later);
        expect(census.variants.V3.moves).toEqual([]);
        expect(census.variants.V3s.moves).toEqual([]);
        for (const v of Object.values(census.variants)) expect(v.unreachable).toEqual([]);
    });
});
