/**
 * ⛓ hammer-phase L41-PUNCHER-LADDER — `KILL_HIT_BODY` (`SEEDLING_KILL_HIT_BODY`, OFF): where the removal chooser's head is
 * not on the corridor probe's hit, the kill rung takes the hit's own body (`killHitBodyOf`). The switch and the pure
 * choice; the leg rows (L40 Totem Part 64,144 from L41, and the L42 control) are `hammerKillHitBody.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { KILL_HIT_BODY, killHitBodyOf } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const ENV = globalThis.process?.env ?? {};

describe('hammer-phase L41-PUNCHER-LADDER — KILL_HIT_BODY, the switch', () => {
    it('ships OFF, `SEEDLING_KILL_HIT_BODY=1` turns it on, and the channel carries the name', () => {
        expect(KILL_HIT_BODY.enabled).toBe(ENV.SEEDLING_KILL_HIT_BODY === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KILL_HIT_BODY');
    });

    it('`killHitBodyOf` retargets only when the head is off the hit and the hit names an admitted body', () => {
        const spinner = { id: 'spinner@192,128', kind: 'spinner' };
        const puncher = { id: 'puncher@816,128' };
        const bob = { id: 'bob@0,0' };
        const hit = { sources: [{ kind: 'chaser', id: 'puncher@816,128' }] };
        expect(killHitBodyOf([spinner, bob, puncher], hit)).toBe(puncher);
        // the head is on the hit: the chooser's choice stands
        expect(killHitBodyOf([puncher, spinner], hit)).toBeNull();
        // the hit names no admitted body: nothing to take
        expect(killHitBodyOf([spinner, bob], hit)).toBeNull();
        // an empty list, or no hit sources
        expect(killHitBodyOf([], hit)).toBeNull();
        expect(killHitBodyOf([spinner, puncher], { sources: [] })).toBeNull();
    });
});

