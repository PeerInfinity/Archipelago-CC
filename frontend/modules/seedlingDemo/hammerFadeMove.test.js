/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE FADE-MOVE — a latched fade is not a reason to stand still (`FADE_MOVE`, OFF).
 * ⚖ The user approved the design on 2026-11-16 (*"Approve design, build after flip"*); see `solverBot.FADE_MOVE`.
 *
 * MEASURED (`CC/docs/cloud-reports/seedling-hammer-fade-move.md`): on the L12 bosslock legs from L35 / L95 the
 * clear-tag keylock reaches its stance unpunched, the key line latches, and the player stands out the ~80-tick fade
 * beside `puncher@416,256`, which punches twice (billed by the model at the game's ticks). ON, at the latch the still
 * wait is played on the segment's fork, meets the punch, and the nearest hitless refuge in the room is walked to and
 * stood at instead (fork-certified, replayed on the live run): the lock opens on the same tick and nothing is hit.
 *
 * The state is CLEARTAG-STAND's committed capture (`fixtures/hammer-cleartag-stand/`): leg 127
 * (`level_12__r0c19 <- in_L35_32_64 -> location:L12 flag 4: bosslock@416,240 cleared`) and leg 105
 * (`… <- in_L0_304_176 -> … flag 4 …`, whose route kills the puncher first, so its fade is hitless and is not moved).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    FADE_MOVE, FADE_MOVE_ATTACK, FADE_MOVE_ATTACK_DEFAULT, FADE_MOVE_COUNTS, FADE_MOVE_DEFAULT, resetFadeMoveCounts,
    withFadeMove, withFadeMoveAttack,
} from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-cleartag-stand', name)))
    .toString('utf8'));
const LEG_L35 = FIX('leg127-l35-l12-request.json.gz');
const LEG_L0 = FIX('leg105-l0-l12-request.json.gz');
const PUNCHER = 'puncher@416,256';
const L35_OFF_HITS = [[433, 'punch', PUNCHER], [474, 'punch', PUNCHER]];

/** A captured leg solved as the worker does, FADE_MOVE at `on`; the model's hits re-driven from the plan. */
function solveLeg(leg, on, attack = false) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    resetFadeMoveCounts();
    const answer = withFadeMoveAttack(attack, () => withFadeMove(on,
        () => solveAnytime({ ...tape, source, levelSource }, { passes })));
    expect(answer.ok).toBe(true);
    const counts = JSON.parse(JSON.stringify(FADE_MOVE_COUNTS));
    const shadow = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource, scratchPersistence: tape.scratchPersistence });
    return { ticks: answer.plan.solution.length, plan: JSON.stringify(answer.plan.solution.map((k) => [...k])),
        hits: shadow.ledger('playerHits').map((h) => [h.t, h.source, h.id]), counts,
        end: { level: shadow.level, x: shadow.state.x, y: shadow.state.y } };
}

describe('FADE-MOVE — the switch', () => {
    it('is OFF by default, named in the solver env channel, and withFadeMove restores it', () => {
        expect(FADE_MOVE_DEFAULT).toBe(false);
        expect(FADE_MOVE.enabled).toBe(ENV.SEEDLING_FADE_MOVE === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FADE_MOVE');
        const was = FADE_MOVE.enabled;
        expect(withFadeMove(!was, () => FADE_MOVE.enabled)).toBe(!was);
        expect(FADE_MOVE.enabled).toBe(was);
        expect(() => withFadeMove(true, () => { throw new Error('x'); })).toThrow('x');
        expect(FADE_MOVE.enabled).toBe(was);
    });

    it('phase 2 (FADE_MOVE_ATTACK) is OFF by default, named in the channel, and withFadeMoveAttack restores it', () => {
        expect(FADE_MOVE_ATTACK_DEFAULT).toBe(false);
        expect(FADE_MOVE_ATTACK.enabled).toBe(ENV.SEEDLING_FADE_MOVE_ATTACK === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FADE_MOVE_ATTACK');
        const was = FADE_MOVE_ATTACK.enabled;
        expect(withFadeMoveAttack(!was, () => FADE_MOVE_ATTACK.enabled)).toBe(!was);
        expect(FADE_MOVE_ATTACK.enabled).toBe(was);
    });
});

describe('FADE-MOVE — leg 127 (L35 → L12 flag 4): the keylock fade beside the puncher', () => {
    const off = solveLeg(LEG_L35, false);
    const on = solveLeg(LEG_L35, true);

    it('OFF stands the fade in reach and is punched twice; the census counts the latched key fade, nothing moves', () => {
        expect(off.hits).toEqual(L35_OFF_HITS);
        expect(off.counts.waits.keylock).toBeGreaterThan(0);
        expect(off.counts.rows.every((r) => r.kind === 'keylock' && r.lock === 'bosslock@416,240')).toBe(true);
        expect(off.counts.moves).toEqual([]);
        expect(off.counts.declined).toEqual([]);
    });

    it('ON the fade is waited out at a fork-certified refuge: no hit, the same plan length, the lock still opens', () => {
        expect(on.hits).toEqual([]);
        expect(on.ticks).toBe(off.ticks);
        expect(on.end.level).toBe(12);
        expect(on.counts.moves.length).toBeGreaterThan(0);
        for (const m of on.counts.moves) {
            expect(m.kind).toBe('keylock');
            expect(m.still).toMatch(/^hit: HIT .*puncher@416,256/);
            expect(m.ticks).toBeGreaterThan(0);
        }
    });
});

describe('FADE-MOVE — leg 105 (L0 → L12 flag 4): the puncher is killed first, so the fade is hitless', () => {
    it('ON answers OFF byte for byte (a hitless still wait whose aim needs no opening is never moved)', () => {
        const off = solveLeg(LEG_L0, false);
        const on = solveLeg(LEG_L0, true);
        expect(on.plan).toBe(off.plan);
        expect(on.hits).toEqual([]);
        expect(on.counts.moves).toEqual([]);
        expect(on.counts.waits.keylock).toBeGreaterThan(0);
    });
});

describe('FADE-MOVE phase 2 — FADE_MOVE_ATTACK needs FADE_MOVE, and keeps leg 127 hitless', () => {
    it('ATTACK alone answers OFF byte for byte (phase 2 is asked only inside a phase-1 move)', () => {
        expect(solveLeg(LEG_L35, false, true).plan).toBe(solveLeg(LEG_L35, false, false).plan);
    });

    it('both ON: leg 127 is hitless at OFF\'s length; the attack is ranked first and refused by the fork on a hit', () => {
        const off = solveLeg(LEG_L35, false);
        const both = solveLeg(LEG_L35, true, true);
        expect(both.hits).toEqual([]);
        expect(both.ticks).toBe(off.ticks);
        expect(both.counts.moves.length).toBeGreaterThan(0);
    });
});
