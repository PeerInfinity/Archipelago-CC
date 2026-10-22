/**
 * ⛓ ROUTE CHOOSER (`procgenCore/routeChooser.js`) — which candidate next, by the caller's route price.
 *
 * The cost is the caller's (`{hops, restart, pocket}`); these rows pin the ranking: fewest restarts first under the
 * default infinite penalty, a finite penalty trading hops against restarts, the goal last, progression-first ties,
 * the listed order as the last word, and a candidate with no route left out.
 */
import { describe, it, expect } from 'vitest';

import { chooseNext, rankCandidates, routeRestarts, routeScore, DEFAULT_RESTART_PENALTY, TIE_BREAKS }
    from './routeChooser.js';

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
});
