/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE OPP-FALLBACK-HITS — `OPP_PRESS_FALLBACK` must not adopt a redo that takes hits
 * (`OPP_FALLBACK_HITS`, OFF). The fast rows: the switch, the instrument, the sentence, the source shape. The solves
 * (leg 871's hit-bearing redo, leg 377's hitless one) are `hammerOppFallbackHits.train.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    OPP_FALLBACK_HITS, OPP_FALLBACK_HITS_COUNTS, OPP_FALLBACK_HITS_DEFAULT, auditOppFallbackRedo, oppFallbackHitsAudits,
    oppFallbackHitsSentence, playerHitsSince, resetOppFallbackHitsCounts, withOppFallbackHits,
} from './oppFallbackHits.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};

describe('hammer-phase OPP-FALLBACK-HITS — the switch', () => {
    it('ships OFF, `SEEDLING_OPP_FALLBACK_HITS=1` turns it on, the channel carries the name, the wrapper restores', () => {
        expect(OPP_FALLBACK_HITS_DEFAULT).toBe(false);
        expect(OPP_FALLBACK_HITS.enabled).toBe(ENV.SEEDLING_OPP_FALLBACK_HITS === '1');
        expect(OPP_FALLBACK_HITS.census).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_OPP_FALLBACK_HITS');
        const was = OPP_FALLBACK_HITS.enabled;
        expect(withOppFallbackHits(true, () => OPP_FALLBACK_HITS.enabled)).toBe(true);
        expect(withOppFallbackHits(false, () => OPP_FALLBACK_HITS.enabled)).toBe(false);
        expect(OPP_FALLBACK_HITS.enabled).toBe(was);
        expect(() => withOppFallbackHits(true, () => { throw new Error('x'); })).toThrow('x');
        expect(OPP_FALLBACK_HITS.enabled).toBe(was);
    });

    it('audits only ON or under the census instrument', () => {
        withOppFallbackHits(false, () => expect(oppFallbackHitsAudits()).toBe(false));
        withOppFallbackHits(true, () => expect(oppFallbackHitsAudits()).toBe(true));
        OPP_FALLBACK_HITS.census = true;
        try {
            withOppFallbackHits(false, () => expect(oppFallbackHitsAudits()).toBe(true));
        } finally {
            OPP_FALLBACK_HITS.census = false;
        }
    });
});

describe('hammer-phase OPP-FALLBACK-HITS — the instrument and the sentence', () => {
    const ledger = [{ t: 10, source: 'chaser', id: 'a' }, { t: 11, source: 'spinner-hammer', id: 'b' },
        { t: 30, source: 'chaser', id: 'a' }];
    const run = { ledger: (name) => (name === 'playerHits' ? ledger : []) };

    it('reads the hits billed on the ticks AFTER the redo\'s first clock (a row\'s `t` is its tick\'s completed clock)', () => {
        expect(playerHitsSince(run, 10)).toEqual([{ t: 11, source: 'spinner-hammer', id: 'b' },
            { t: 30, source: 'chaser', id: 'a' }]);
        expect(playerHitsSince(run, 30)).toEqual([]);
        expect(playerHitsSince({ ledger: () => undefined }, 0)).toEqual([]);
    });

    it('records every audited redo; refuses only ON and only with a hit', () => {
        resetOppFallbackHitsCounts();
        const row = { t: 0, ticks: 826, bodies: ['b1'] };
        const hits = [{ t: 666, source: 'chaser', id: 'c1' }];
        expect(withOppFallbackHits(false, () => auditOppFallbackRedo(row, hits))).toBe(false);
        expect(withOppFallbackHits(true, () => auditOppFallbackRedo(row, []))).toBe(false);
        expect(withOppFallbackHits(true, () => auditOppFallbackRedo(row, hits))).toBe(true);
        expect({ ...OPP_FALLBACK_HITS_COUNTS, rows: OPP_FALLBACK_HITS_COUNTS.rows.map((r) => [r.hits.length, r.refused]) })
            .toEqual({ audited: 3, hitless: 1, hit: 2, refused: 1, rows: [[1, false], [0, false], [1, true]] });
        resetOppFallbackHitsCounts();
        expect(OPP_FALLBACK_HITS_COUNTS).toEqual({ audited: 0, hitless: 0, hit: 0, refused: 0, rows: [] });
    });

    it('names the switch, the redo\'s ticks and each hit', () => {
        const s = oppFallbackHitsSentence({ t: 0, ticks: 826 }, [{ t: 666, source: 'chaser', id: 'c1' },
            { t: 737, source: 'chaser', id: 'c1' }]);
        expect(s).toContain('`OPP_PRESS_FALLBACK`');
        expect(s).toContain('`OPP_FALLBACK_HITS`');
        expect(s).toContain('killed in 826 tick(s)');
        expect(s).toContain('2 player hit(s) on the redo (t666 chaser:c1, t737 chaser:c1)');
    });
});

describe('hammer-phase OPP-FALLBACK-HITS — the source shape', () => {
    const src = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
    const start = src.indexOf('function execKillByPressOppFallback(');
    const body = src.slice(start, src.indexOf('\n}\n', start));

    it('both adoption paths audit only behind `oppFallbackHitsAudits()`, and the refusal is not undone twice', () => {
        expect(body.match(/if \(oppFallbackHitsAudits\(\)\) oppFallbackRedoAudit\(/g)).toHaveLength(2);
        expect(body).toContain('if (e2?.oppFallbackHitsRefused) throw e2;');
        // the audit precedes the adoption's count and note on both paths
        for (const at of [...body.matchAll(/oppFallbackRedoAudit\(/g)].map((m) => m.index)) {
            expect(body.indexOf('OPP_PRESS_FALLBACK_COUNTS.solved += 1;', at)).toBeGreaterThan(at);
        }
    });
});
