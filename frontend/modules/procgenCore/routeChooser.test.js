/**
 * ⛓ ROUTE CHOOSER (`procgenCore/routeChooser.js`) — which candidate next, by the caller's route price.
 *
 * The cost is the caller's (`{hops, restart, pocket}`); these rows pin the ranking: fewest restarts first under the
 * default infinite penalty, a finite penalty trading hops against restarts, the goal last, progression-first ties,
 * the listed order as the last word, and a candidate with no route left out.
 */
import { describe, it, expect } from 'vitest';

import { chooseNext, grabOnTheWay, lookaheadCost, rankCandidates, rankLookahead, routeRestarts, routeScore,
    DEFAULT_LOOKAHEAD, DEFAULT_RESTART_PENALTY, TIE_BREAKS } from './routeChooser.js';

const priced = (table) => (c) => table[c.name] ?? null;
const names = (ranked) => ranked.map((r) => r.candidate.name);

describe('routeChooser', () => {
    it('ranks by hops, and leaves out a candidate with no route', () => {
        const cands = [{ name: 'far' }, { name: 'none' }, { name: 'near' }];
        const cost = priced({ far: { hops: 9, restart: false }, near: { hops: 2, restart: false } });
        expect(names(rankCandidates(cands, { cost }))).toEqual(['near', 'far']);
        expect(chooseNext(cands, { cost }).name).toBe('near');
        expect(chooseNext([{ name: 'none' }], { cost })).toBeNull();
        expect(chooseNext(cands, {})).toBeNull();
    });

    it('the default penalty is infinite: a walk of any length beats a Restart, and a pocket counts as one', () => {
        expect(DEFAULT_RESTART_PENALTY).toBe(Infinity);
        const cands = [{ name: 'restart' }, { name: 'pocket' }, { name: 'longWalk' }, { name: 'both' }];
        const cost = priced({
            restart: { hops: 1, restart: true },
            pocket: { hops: 1, restart: false, pocket: true },
            longWalk: { hops: 40, restart: false },
            both: { hops: 0, restart: true, pocket: true },
        });
        expect(names(rankCandidates(cands, { cost }))).toEqual(['longWalk', 'restart', 'pocket', 'both']);
        expect(routeRestarts({ restart: true, pocket: true })).toBe(2);
    });

    it('a finite penalty trades hops against restarts', () => {
        const cands = [{ name: 'walk' }, { name: 'restart' }];
        const cost = priced({ walk: { hops: 12, restart: false }, restart: { hops: 3, restart: true } });
        expect(chooseNext(cands, { cost, restartPenalty: 5 }).name).toBe('restart');   // 3 + 5 < 12
        expect(chooseNext(cands, { cost, restartPenalty: 10 }).name).toBe('walk');     // 3 + 10 > 12
        expect(routeScore({ hops: 3, restart: true }, 10)).toBe(13);
        expect(routeScore(null)).toBe(Infinity);
    });

    it('the goal goes last, however cheap', () => {
        const cands = [{ name: 'seed', goal: true }, { name: 'chest' }];
        const cost = priced({ seed: { hops: 0, restart: false }, chest: { hops: 30, restart: true } });
        expect(names(rankCandidates(cands, { cost }))).toEqual(['chest', 'seed']);
        expect(chooseNext([cands[0]], { cost }).name).toBe('seed');
    });

    it('ties: progression first by default, then the listed order; `listed` keeps the listed order only', () => {
        const cands = [{ name: 'a' }, { name: 'b', progression: true }, { name: 'c' }];
        const cost = () => ({ hops: 4, restart: false });
        expect(names(rankCandidates(cands, { cost }))).toEqual(['b', 'a', 'c']);
        expect(names(rankCandidates(cands, { cost, tieBreak: TIE_BREAKS.listed }))).toEqual(['a', 'b', 'c']);
    });

    it('GRAB-ON-THE-WAY: the nearest zero-detour candidate is taken first; a detour, an extra Restart or the goal is not', () => {
        // the target is 6 hops away; `on` and `near` sit on its route, `off` is 2 hops away but 3 hops off the route
        const target = { name: 'target' };
        const cands = [target, { name: 'on' }, { name: 'near' }, { name: 'off' }, { name: 'warp' }, { name: 'seed', goal: true }];
        const cost = priced({ target: { hops: 6, restart: false }, on: { hops: 4, restart: false }, near: { hops: 1, restart: false },
            off: { hops: 2, restart: false }, warp: { hops: 1, restart: true }, seed: { hops: 3, restart: false } });
        const via = { on: { hops: 6, restarts: 0 }, near: { hops: 6, restarts: 0 }, off: { hops: 9, restarts: 0 },
            warp: { hops: 6, restarts: 1 }, seed: { hops: 6, restarts: 0 } };
        const costVia = (c) => via[c.name] ?? null;
        expect(grabOnTheWay(target, cands, { cost, costVia }).name).toBe('near');
        expect(grabOnTheWay(target, cands.filter((c) => c.name !== 'near'), { cost, costVia }).name).toBe('on');
        // only detours, a Restart the direct route does not take, and the goal are left: the target stands
        const rest = cands.filter((c) => !['on', 'near'].includes(c.name));
        expect(grabOnTheWay(target, rest, { cost, costVia })).toBe(target);
        // a target whose own route Restarts lets a Restart-priced grab ride along
        const warpTarget = priced({ target: { hops: 6, restart: true }, warp: { hops: 1, restart: true } });
        expect(grabOnTheWay(target, [target, cands[4]], { cost: warpTarget, costVia }).name).toBe('warp');
        expect(grabOnTheWay(target, cands, { cost })).toBe(target);   // no costVia: nothing is grabbed
    });

    // ⛓ LOOKAHEAD — a one-way distance table: `dist[from][to]` hops (absent = no route), `rs` = routes that Restart.
    const lookaheadOver = (dist, { rs = new Set(), start = 'S' } = {}) => {
        const priceAt = (from) => (c) => {
            const h = dist[from]?.[c.name];
            return h === undefined ? null : { hops: h, restart: rs.has(`${from}>${c.name}`) };
        };
        return (cands, opts = {}) => {
            const next = (c, state) => {
                const remaining = (state?.left ?? cands).filter((x) => x !== c);
                return remaining.length ? { state: { left: remaining }, candidates: remaining, cost: priceAt(c.name) } : null;
            };
            return rankLookahead(cands, priceAt(start), { next, ...opts });
        };
    };

    it('LOOKAHEAD (k=2): a sequence cheaper than greedy\'s picks a farther first target', () => {
        expect(DEFAULT_LOOKAHEAD).toEqual({ depth: 2, beam: 6 });
        const A = { name: 'A' };
        const B = { name: 'B' };
        const dist = { S: { A: 1, B: 2 }, A: { B: 10 }, B: { A: 2 } };
        // greedy: A (1) then B (10) = 11; lookahead: B (2) then A (2) = 4
        expect(chooseNext([A, B], { cost: (c) => ({ hops: dist.S[c.name], restart: false }) })).toBe(A);
        const ranked = lookaheadOver(dist)([A, B]);
        expect(names(ranked)).toEqual(['B', 'A']);
        expect(ranked[0].price).toEqual({ hops: 4, restarts: 0, lead: 2, restart: false, pocket: false });
        // depth 1 is greedy
        expect(names(lookaheadOver(dist)([A, B], { depth: 1 }))).toEqual(['A', 'B']);
    });

    it('LOOKAHEAD: equal totals go to the nearer first step, then progression-first, then listed', () => {
        const A = { name: 'A' };
        const B = { name: 'B' };
        // A then B = 1 + 3; B then A = 3 + 1: a tie on the total, the nearer lead wins
        expect(names(lookaheadOver({ S: { A: 1, B: 3 }, A: { B: 3 }, B: { A: 1 } })([B, A]))).toEqual(['A', 'B']);
        // equal totals AND equal leads: progression first, else listed
        const P = { name: 'P', progression: true };
        const Q = { name: 'Q' };
        const sym = { S: { P: 2, Q: 2 }, P: { Q: 1 }, Q: { P: 1 } };
        expect(names(lookaheadOver(sym)([Q, P]))).toEqual(['P', 'Q']);
        expect(names(lookaheadOver(sym)([Q, P], { tieBreak: TIE_BREAKS.listed }))).toEqual(['Q', 'P']);
    });

    it('LOOKAHEAD: Restarts dominate the sequence; the goal is never a middle step; a dead sequence is dropped', () => {
        const A = { name: 'A' };
        const B = { name: 'B' };
        // A then B owes a Restart (A>B); B then A walks 30 — the walk wins under the infinite penalty
        const rs = new Set(['A>B']);
        const ranked = lookaheadOver({ S: { A: 1, B: 20 }, A: { B: 1 }, B: { A: 10 } }, { rs })([A, B]);
        expect(names(ranked)).toEqual(['B', 'A']);
        expect(routeRestarts(ranked[1].price)).toBe(1);
        // the goal G beside A is not taken second: A's sequence continues to B
        const G = { name: 'G', goal: true };
        const withGoal = lookaheadOver({ S: { A: 1, B: 5, G: 9 }, A: { G: 0, B: 6 }, B: { A: 6, G: 1 }, G: { A: 1, B: 1 } })([A, B, G]);
        expect(withGoal[0].candidate).toBe(A);
        expect(withGoal[0].price.hops).toBe(7);
        expect(withGoal[withGoal.length - 1].candidate).toBe(G);
        // A leads nowhere (no route on to B): dropped; B leads on and wins
        expect(names(lookaheadOver({ S: { A: 1, B: 5 }, A: {}, B: { A: 1 } })([A, B]))).toEqual(['B']);
        // every sequence dead: the plain ranking
        expect(names(lookaheadOver({ S: { A: 1, B: 5 }, A: {}, B: {} })([A, B]))).toEqual(['A', 'B']);
        // the lookahead cost alone answers null for a dead one
        expect(lookaheadCost(() => ({ hops: 1, restart: false }), {
            next: () => ({ state: null, candidates: [B], cost: () => null }) })(A)).toBeNull();
    });
});
