/**
 * seedlingDemo/hammerOppPressFallback.test — ⛓⛓ SEEDLING HAMMER-PHASE L40-FLIP-BUILD: `OPPORTUNISTIC_STRIKE`'s refused
 * press kill redone once with the strike off (`OPP_PRESS_FALLBACK`, ON in the flip branch). The fast rows: the switch,
 * its env name, the sentence, and the source shape (the retry asked only under OPP, only for a fallback code, never
 * twice). The leg rows (L40 flag 1, leg 377, at the arrival clock 5323: OPP refuses, the fallback solves hitless, the
 * defaults unchanged) are the train tier's (`hammerOppPressFallback.train.test.js`).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    OPP_PRESS_FALLBACK, OPP_PRESS_FALLBACK_COUNTS, OPP_PRESS_FALLBACK_DEFAULT, oppPressFallbackSentence,
    resetOppPressFallbackCounts, withOppPressFallback,
} from './oppPressFallback.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const SRC = readFileSync(join(HERE, 'solverBot.js'), 'utf8');

describe('hammer-phase L40-FLIP-BUILD — OPP_PRESS_FALLBACK, the switch', () => {
    it('ships ON in the flip branch, `SEEDLING_OPP_PRESS_FALLBACK=0` opts out, and the channel carries the name', () => {
        expect(OPP_PRESS_FALLBACK_DEFAULT).toBe(true);
        expect(OPP_PRESS_FALLBACK.enabled).toBe(ENV.SEEDLING_OPP_PRESS_FALLBACK !== '0');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_OPP_PRESS_FALLBACK');
        const was = OPP_PRESS_FALLBACK.enabled;
        expect(withOppPressFallback(false, () => OPP_PRESS_FALLBACK.enabled)).toBe(false);
        expect(withOppPressFallback(true, () => OPP_PRESS_FALLBACK.enabled)).toBe(true);
        expect(OPP_PRESS_FALLBACK.enabled).toBe(was);
        expect(() => withOppPressFallback(false, () => { throw new Error('x'); })).toThrow('x');
        expect(OPP_PRESS_FALLBACK.enabled).toBe(was);
    });

    it('the instrument resets, and a failed retry names itself in one sentence', () => {
        OPP_PRESS_FALLBACK_COUNTS.asked = 3;
        resetOppPressFallbackCounts();
        expect(OPP_PRESS_FALLBACK_COUNTS).toEqual({ asked: 0, solved: 0, refused: 0 });
        const s = oppPressFallbackSentence({ t: 412, retryRefused: 'HAMMER_SAFETY', why: 'no step out' });
        expect(s).toContain('`OPP_PRESS_FALLBACK`');
        expect(s).toContain('t412');
        expect(s).toContain('`OPPORTUNISTIC_STRIKE` off');
        expect(s).toContain('HAMMER_SAFETY: no step out');
    });
});

describe('hammer-phase L40-FLIP-BUILD — OPP_PRESS_FALLBACK, the source shape', () => {
    const body = (name) => {
        const at = SRC.indexOf(`function ${name}(`);
        expect(at).toBeGreaterThan(0);
        return SRC.slice(at, SRC.indexOf('\n}\n', at));
    };
    it('the retry is asked only with OPP on, the switch on and a rewind; otherwise the kill is B3\'s body, unchanged', () => {
        const entry = body('execKillByPress');
        expect(entry).toContain('OPP_PRESS_FALLBACK.enabled && OPPORTUNISTIC_STRIKE.enabled && ctx.rewind');
        expect(entry).toContain('return execKillByPressFightFallback(run, perTick, resolved, ctx);');
        // ⛔ the fight fallback's own gate is untouched (⚖ the user: `HAMMER_FIGHT_FALLBACK` is not flipped)
        expect(body('execKillByPressFightFallback')).toContain('if (!HAMMER_FIGHT_FALLBACK.enabled');
    });
    it('only a fallback code is retried, once, with OPP off and restored, and a failed retry is undone', () => {
        const opp = body('execKillByPressOppFallback');
        expect(opp).toContain('FIGHT_FALLBACK_CODES.includes(e.code)');
        expect(opp).toContain('e.oppPressFallback) throw e');
        expect(opp).toContain('OPPORTUNISTIC_STRIKE.enabled = false;');
        expect(opp).toContain('OPPORTUNISTIC_STRIKE.enabled = was;');
        expect(opp).toContain('undo();');
        expect(opp.match(/execKillByPressFightFallback\(/g)).toHaveLength(2);
    });
});
