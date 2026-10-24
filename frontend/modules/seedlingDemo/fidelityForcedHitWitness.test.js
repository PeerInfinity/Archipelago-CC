/**
 * seedling-fidelity-searchgaps (wave 28) D-B — L67's WORK UNITS (`CONTACT_FIDELITY.forcedHitWitnessFirst`, OFF).
 *
 * Sweep 40015230731's leg 908 ran out of 640, then 2560 units. W0 (its captured request, replayed in node): of the
 * unbudgeted dashless pass's 5,348 units, 5,328 were one `proveForcedHit` (1,332 forks of a 134-tick replay, asked 135 px
 * from the danger) that then gave up at depth 3 — and both passes REFUSE anyway, on `arrowtrap@48,48`'s armed lane. ON:
 * one hitless `depthMax`-tick input decides `proven: false` exactly as the tree would (a hit prefix stays hit); the leg's
 * request spends 58 units and answers the room's own refusal.
 *
 * Mutants (predicted first; copy + edit + run + restore), the results in the report.
 */
import { describe, expect, it } from 'vitest';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { FORCED_HITS, proveForcedHit } from './forcedHit.js';

describe('fidelity SEARCHGAPS D-B — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.forcedHitWitnessFirst).toBe(false);
        expect(CONTACT_FIDELITY.forcedHitWitnessFirst).toBe(false);
    });
});

describe('fidelity SEARCHGAPS D-B — the forced-hit proof\'s hitless witness', () => {
    /** A run stand-in: `advance` bills a hit when `hitAt(keys, tick)` says so. */
    const fakeFork = (hitAt) => {
        let forks = 0;
        const fork = () => {
            forks += 1;
            const hits = [];
            let t = 0;
            return {
                ledger: (k) => (k === 'playerHits' ? hits : []),
                advance: (held) => { t += 1; if (hitAt([...held], t)) hits.push({ t }); return { transition: null }; },
            };
        };
        return { fork, forks: () => forks };
    };
    it('OFF: a room that never hits costs the whole depth-2 tree, then gives up at depth 3', () => {
        const f = fakeFork(() => false);
        const p = proveForcedHit(f.fork, { replayTicks: 134 });
        expect(p.proven).toBe(false);
        expect(f.forks()).toBe(36 + 36 * 36);
        expect(p.why).toMatch(/depth 3 needs 46656 fork/);
    });
    it('ON: the same room is decided by ONE fork — the hitless witness', () => {
        const f = fakeFork(() => false);
        const p = withContactFidelity({ forcedHitWitnessFirst: true }, () => proveForcedHit(f.fork, { replayTicks: 134 }));
        expect(p.proven).toBe(false);
        expect(p.witness).toBe(true);
        expect(f.forks()).toBe(1);
        expect(p.why).toMatch(new RegExp(`survives ${FORCED_HITS.depthMax} tick`));
    });
    it('ON: a room that hits every input at tick 1 is proven exactly as OFF proves it (the witnesses all hit)', () => {
        const off = proveForcedHit(fakeFork(() => true).fork);
        const on = withContactFidelity({ forcedHitWitnessFirst: true }, () => proveForcedHit(fakeFork(() => true).fork));
        expect(on.proven).toBe(true);
        expect({ ...on, nodes: null, advances: null }).toEqual({ ...off, nodes: null, advances: null });
        expect(on.nodes).toBe(off.nodes + 9);
    });
    it('ON: a witness that is hit is no verdict — a room hit only standing still is still searched', () => {
        const f = fakeFork((held) => held.length === 0);
        const on = withContactFidelity({ forcedHitWitnessFirst: true }, () => proveForcedHit(f.fork));
        expect(on.proven).toBe(false);
        expect(on.hitless).toBe('up up up');
        expect(f.forks()).toBe(2);
    });
});
