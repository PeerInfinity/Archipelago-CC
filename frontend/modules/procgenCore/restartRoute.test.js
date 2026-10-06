/**
 * ⛓ THE RESTART MOVE (`procgenCore/restartRoute.js`) — the one helper every position-aware planner asks.
 *
 * A small graph first (flag on → a Restart route; flag off → today's refusal; a walk always beats a Restart), then
 * the committed playthrough at a real sphere's inventory: a region the soft-lock census lists as RESTART-ONLY gets
 * a route that begins with RESTART, and the same region in a copy without the flag is refused.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { planRoute, preferRoute, isRestartStep, restartTargetFor, ROUTE_TIE_BREAK, avoidingFindPath } from './restartRoute.js';
import { declareReturnToMenu } from './restartWarp.js';
import { startRegionsOf } from './rulesGraph.js';
import { restartTargetOf } from '../menuPanel/menuPanelEngine.js';
import { makeRuleHolds } from '../../../scripts/procgen/surveyRoute.js';
import { softLockCensus, sphereInventories } from '../../../scripts/procgen/softLockCensus.js';

/** `findPathWithExits` over a plain adjacency list `{region: [[exitName, target], ...]}` (BFS, exits in order). */
function finderOver(adj) {
    return (from, to) => {
        const seen = new Set([from]);
        const queue = [[{ region: from, exitUsed: null }]];
        while (queue.length) {
            const path = queue.shift();
            const here = path[path.length - 1].region;
            if (here === to) return { steps: path, length: path.length - 1 };
            for (const [exit, next] of adj[here] ?? []) {
                if (seen.has(next)) continue;
                seen.add(next);
                queue.push([...path, { region: next, exitUsed: exit }]);
            }
        }
        return null;
    };
}

// Menu -GameStart-> Start; Start <-> A; A -drop-> Pit (one-way); Start -> B; a long walk A -> C -> D -> B.
const ADJ = {
    Menu: [['GameStart', 'Start']],
    Start: [['toA', 'A'], ['toB', 'B']],
    A: [['back', 'Start'], ['drop', 'Pit'], ['toC', 'C']],
    C: [['toD', 'D']],
    D: [['toB', 'B']],
    Pit: [],
};
const DOC = { start_regions: { 1: ['Menu'] }, exporter: { 1: {} } };
const flagged = () => declareReturnToMenu(structuredClone(DOC), '1');
const findPath = finderOver(ADJ);

describe('planRoute over a small graph', () => {
    it('flag ON, no walk from the pit: the route BEGINS with RESTART, then walks from the restart target', () => {
        const { route, kind, why } = planRoute({ from: 'Pit', to: 'B', findPath, rules: flagged() });
        expect(kind).toBe('restart');
        expect(why).toBeNull();
        expect(route.steps).toEqual([
            { region: 'Pit', exitUsed: null },
            { region: 'Menu', exitUsed: null, restart: true },
            { region: 'Start', exitUsed: 'GameStart' },
            { region: 'B', exitUsed: 'toB' },
        ]);
        expect(isRestartStep(route.steps[1])).toBe(true);
        // ⛔ never an edge: no step after the first names an exit out of the pit
        expect(route.steps.filter((s) => s.exitUsed && ADJ.Pit.some(([e]) => e === s.exitUsed))).toEqual([]);
    });

    it('flag OFF: today\'s refusal, word for word (fail-closed)', () => {
        expect(planRoute({ from: 'Pit', to: 'B', findPath, rules: structuredClone(DOC) }))
            .toEqual({ route: null, kind: null, why: 'no path from Pit to B' });
        expect(planRoute({ from: 'Pit', to: 'B', findPath, rules: null }))
            .toEqual({ route: null, kind: null, why: 'no path from Pit to B' });
    });

    it('fail-closed on the slot: the flag on player 1 gives player 2 nothing', () => {
        const r = planRoute({ from: 'Pit', to: 'B', findPath, rules: flagged(), playerId: '2' });
        expect(r.route).toBeNull();
    });

    it(`⚖ ${ROUTE_TIE_BREAK}: a walk wins even when the Restart route is shorter`, () => {
        // From C: walk C -> D -> B (2 steps). Restart: (RESTART) Menu -> Start -> B (3 steps). Make the walk longer:
        const long = { ...ADJ, A: [['back', 'Start'], ['toC', 'C']], C: [['c1', 'C1']], C1: [['c2', 'C2']], C2: [['c3', 'D']] };
        const { route, kind } = planRoute({ from: 'C', to: 'B', findPath: finderOver(long), rules: flagged() });
        expect(kind).toBe('walk');
        expect(route.steps.map((s) => s.region)).toEqual(['C', 'C1', 'C2', 'D', 'B']);
        expect(route.steps.some(isRestartStep)).toBe(false);
        expect(preferRoute('walk', 'restart')).toBe('walk');
        expect(preferRoute(null, 'restart')).toBe('restart');
        expect(preferRoute(null, null)).toBeNull();
    });

    it('no Restart from the restart target itself, nor without a target, nor when the start cannot reach the goal', () => {
        const noWay = { ...ADJ, Start: [['toA', 'A']], D: [] };
        expect(planRoute({ from: 'Pit', to: 'B', findPath: finderOver(noWay), rules: flagged() }))
            .toMatchObject({ route: null, why: 'no path from Pit to B, nor from the restart target Menu' });
        expect(planRoute({ from: 'Pit', to: 'B', findPath, rules: flagged(), restartTarget: null }))
            .toMatchObject({ route: null, why: 'no path from Pit to B (no restart target)' });
        const atMenu = { ...ADJ, Menu: [] };
        expect(planRoute({ from: 'Menu', to: 'B', findPath: finderOver(atMenu), rules: flagged() }))
            .toMatchObject({ route: null, why: 'no path from Menu to B (already at the restart target)' });
    });

    it('a goal that IS the restart target: Restart alone', () => {
        const { route, kind } = planRoute({ from: 'Pit', to: 'Menu', findPath, rules: flagged() });
        expect(kind).toBe('restart');
        expect(route.steps).toEqual([{ region: 'Pit', exitUsed: null }, { region: 'Menu', exitUsed: null, restart: true }]);
    });
});

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url));
const PRESETS = `${FRONTEND}presets/`;

describe('restartTargetFor = the Menu panel\'s restartTargetOf (M2), over every committed preset', () => {
    it('agrees on every AP_1 preset', () => {
        const presets = readdirSync(PRESETS).filter((d) => existsSync(`${PRESETS}${d}/AP_1/AP_1_rules.json`));
        expect(presets.length).toBeGreaterThan(5);
        for (const p of presets) {
            const rules = JSON.parse(readFileSync(`${PRESETS}${p}/AP_1/AP_1_rules.json`, 'utf8'));
            expect(restartTargetFor(rules, '1'), p).toBe(restartTargetOf(startRegionsOf(rules, '1').default));
        }
    });
});

describe('the committed playthrough at a real sphere — the census\'s RESTART-ONLY regions get the move', () => {
    const DIR = `${PRESETS}seedling_playthrough/`;
    const rules = JSON.parse(readFileSync(`${DIR}AP_1/AP_1_rules.json`, 'utf8'));
    const seed = readdirSync(DIR).find((d) => d.startsWith('AP_') && d !== 'AP_1');
    const log = readFileSync(`${DIR}${seed}/${seed}_sphere_log.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const spheres = sphereInventories(log);
    const census = softLockCensus(rules, spheres);
    const holds = makeRuleHolds(rules, '1');
    /** The graph's walk at `items`, the way the bot's PathFinder walks it (exits whose rules hold). */
    const finderAt = (items) => finderOver(Object.fromEntries(Object.entries(rules.regions['1']).map(([n, r]) => [n,
        (r.exits ?? []).filter((e) => holds(e.access_rule ?? null, items)).map((e) => [e.name, e.connected_region])])));

    it('every RESTART-ONLY region of sphere 0.4 routes home by Restart; without the flag, by nothing', () => {
        const row = census.rows.find((r) => r.sphere === '0.4');
        expect(census.kind).toBe('restart-only');
        expect(row.stuck.length).toBeGreaterThan(0);
        const at = finderAt(spheres.find((s) => s.sphere === '0.4').items);
        const bare = structuredClone(rules);
        delete bare.exporter['1'].return_to_menu;
        for (const pocket of row.stuck) {
            const { route, kind } = planRoute({ from: pocket, to: census.start, findPath: at, rules });
            expect(kind, pocket).toBe('restart');
            expect(route.steps[1], pocket).toEqual({ region: 'Menu', exitUsed: null, restart: true });
            expect(route.steps[2], pocket).toMatchObject({ region: census.start, exitUsed: 'GameStart' });
            expect(planRoute({ from: pocket, to: census.start, findPath: at, rules: bare }).why, pocket)
                .toBe(`no path from ${pocket} to ${census.start}`);
        }
    });

    it('a region that is NOT restart-only walks (the walk is preferred, never a Restart)', () => {
        const row = census.rows.find((r) => r.sphere === '0.4');
        const at = finderAt(spheres.find((s) => s.sphere === '0.4').items);
        const walker = Object.keys(rules.regions['1'])
            .find((n) => n !== 'Menu' && n !== census.start && !row.stuck.includes(n) && at(census.start, n));
        expect(planRoute({ from: walker, to: census.start, findPath: at, rules }).kind).toBe('walk');
    });
});

/**
 * ⛓ WAVE-6 CONSUMER — `avoid`: exits whose crossing LANDED INSIDE A SOLID (fidelity ARRIVAL's
 * `arrival-inside-solid`), each with the refusal's other arrivals as AP exits. Every walk the route asks for
 * avoids them, by a detour through one of those arrivals; without `avoid` nothing changes.
 */
describe('planRoute with `avoid` (an entrance that landed inside a solid)', () => {
    // Menu -GameStart-> Start; Start -s>12-> L12 -12>P (the landing inside the rock)-> P -P>G-> G;
    // Start -s>2-> L2 -2>H (another arrival into the level)-> H -H>G-> G; L94 -94>H-> H (a third, unreachable).
    const G2 = {
        Menu: [['GameStart', 'Start']],
        Start: [['s>12', 'L12'], ['s>2', 'L2']],
        L12: [['12>P', 'P']],
        P: [['P>G', 'G']],
        L2: [['2>H', 'H']],
        H: [['H>G', 'G']],
        L94: [['94>H', 'H']],
        G: [],
    };
    const fp = finderOver(G2);
    const AVOID = new Map([['12>P', [{ region: 'L94', exit: '94>H', landing: 'H' }, { region: 'L2', exit: '2>H', landing: 'H' }]]]);
    const exits = (r) => r.route.steps.map((st) => st.exitUsed);

    it('without `avoid` the walk is findPath\'s own (through the landing)', () => {
        expect(exits(planRoute({ from: 'Start', to: 'G', findPath: fp, rules: flagged() }))).toEqual([null, 's>12', '12>P', 'P>G']);
        expect(exits(planRoute({ from: 'Start', to: 'G', findPath: fp, rules: flagged(), avoid: new Map() })))
            .toEqual([null, 's>12', '12>P', 'P>G']);
    });

    it('with it: the walk goes by ANOTHER ARRIVAL the refusal named (the reachable one), never the avoided exit', () => {
        const r = planRoute({ from: 'Start', to: 'G', findPath: fp, rules: flagged(), avoid: AVOID });
        expect(r.kind).toBe('walk');
        expect(exits(r)).toEqual([null, 's>2', '2>H', 'H>G']);
        expect(r.route.length).toBe(3);
    });

    it('a walk that never crosses the avoided exit is untouched; no clean detour → no walk (then Restart, or the named refusal)', () => {
        expect(avoidingFindPath(fp, AVOID)('L2', 'G')).toEqual(fp('L2', 'G'));
        const none = new Map([['12>P', [{ region: 'L94', exit: '94>H', landing: 'H' }]]]);
        expect(avoidingFindPath(fp, none)('Start', 'G')).toBeNull();
        expect(planRoute({ from: 'Start', to: 'G', findPath: fp, rules: structuredClone(DOC), avoid: none }))
            .toEqual({ route: null, kind: null, why: 'no path from Start to G' });
        // the Restart leg avoids it too: from Menu the only walk crosses the landing again
        expect(planRoute({ from: 'P', to: 'G', findPath: (a, b) => (a === 'P' ? null : fp(a, b)), rules: flagged(), avoid: none }).why)
            .toBe('no path from P to G, nor from the restart target Menu');
    });

    it('a detour through another avoided exit is not a detour', () => {
        const both = new Map([['12>P', [{ region: 'L2', exit: '2>H', landing: 'H' }]], ['2>H', []]]);
        expect(avoidingFindPath(fp, both)('Start', 'G')).toBeNull();
    });
});
