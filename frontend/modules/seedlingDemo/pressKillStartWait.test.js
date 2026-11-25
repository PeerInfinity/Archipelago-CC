/**
 * seedlingDemo/pressKillStartWait.test — ⛓ hammer-phase STEP149 (`PRESS_KILL_START_WAIT`, OFF): the switch's own
 * contract. The witness (a captured page request the switch solves hitless) is `hammerPressKillStartWait.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    PRESS_KILL_START_WAIT, PRESS_KILL_START_WAIT_COUNTS, PRESS_KILL_START_WAIT_DEFAULT, resetPressKillStartWaitCounts,
    withPressKillStartWait,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const SOURCE = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');

describe('PRESS_KILL_START_WAIT (hammer-phase STEP149)', () => {
    it('ships OFF, and its env name is in the worker\'s table', () => {
        expect(PRESS_KILL_START_WAIT_DEFAULT).toBe(false);
        expect(PRESS_KILL_START_WAIT.enabled).toBe(globalThis.process?.env?.SEEDLING_PRESS_KILL_START_WAIT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PRESS_KILL_START_WAIT');
    });

    it('the waits are non-negative integer ticks, strictly increasing, and start with no idle', () => {
        const w = PRESS_KILL_START_WAIT.waits;
        expect(w.length).toBeGreaterThan(1);
        expect(w[0]).toBe(0);
        for (let i = 0; i < w.length; i += 1) {
            expect(Number.isInteger(w[i]) && w[i] >= 0).toBe(true);
            if (i > 0) expect(w[i]).toBeGreaterThan(w[i - 1]);
        }
    });

    it('withPressKillStartWait sets the switch inside and restores it after, also on a throw', () => {
        const was = PRESS_KILL_START_WAIT.enabled;
        expect(withPressKillStartWait(!was, () => PRESS_KILL_START_WAIT.enabled)).toBe(!was);
        expect(PRESS_KILL_START_WAIT.enabled).toBe(was);
        expect(() => withPressKillStartWait(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(PRESS_KILL_START_WAIT.enabled).toBe(was);
    });

    it('the counts are an instrument the reset clears', () => {
        PRESS_KILL_START_WAIT_COUNTS.rows.push({ t: 1 });
        resetPressKillStartWaitCounts();
        expect(PRESS_KILL_START_WAIT_COUNTS.rows).toEqual([]);
    });

    it('source: ONE guarded call site at the top of execKillByPress, the redo under the fight, a hit audit', () => {
        const calls = SOURCE.match(/return execKillByPressStartWait\(run, perTick, resolved, ctx\)/g) ?? [];
        expect(calls).toHaveLength(1);
        const body = SOURCE.slice(SOURCE.indexOf('function execKillByPress(run, perTick, resolved, ctx) {'));
        expect(body.slice(0, 400)).toContain(
            'if (PRESS_KILL_START_WAIT.enabled && ctx.rewind && pressKillStartWaitDepth === 0) {');
        const wrapper = SOURCE.slice(SOURCE.indexOf('function execKillByPressStartWait('),
            SOURCE.indexOf('function execKillByPress(run, perTick, resolved, ctx) {'));
        // the redo: the fight on for that redo only, and a kill with a player hit since the rewind is undone
        expect(wrapper).toContain('withHammerFight(true, () => inner(fresh, again))');
        expect(wrapper).toContain('playerHitsSince(ctx.rewind.replay(perTick.length), clock0)');
        expect(wrapper).toMatch(/if \(hits\.length > 0\) \{\s+undo\(\);/);
        // nothing single-game: no level, coordinate or entity id in the wrapper
        expect(wrapper).not.toMatch(/level\s*===\s*\d|@\d+,\d+|spinner@|bombpusher/);
    });
});
