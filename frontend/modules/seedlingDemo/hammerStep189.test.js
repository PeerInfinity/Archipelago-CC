/**
 * seedlingDemo/hammerStep189.test — ⛓ hammer-phase STEP-189 (`KILLLOCK_PINNED_SPEAR`, OFF): the contracts.
 *   - the switch ships OFF, is read from `SEEDLING_KILLLOCK_PINNED_SPEAR`, rides the solver-env channel, and its
 *     with-wrapper restores it;
 *   - its one call site sits behind the switch, after the arm's own stances, before the turn's refusal;
 *   - no single-game constant in its functions;
 *   - `pinnedSpearStances` on re-measure-11 P1 38:6's own tick 0 (L71, five counted lavarunners in a Dark Stone pocket):
 *     every cell is one the body's straight line to does NOT reach (none is a line stance), and the thrust faces the wall.
 * The whole-request witnesses (38:6, 39:1, OFF and ON) are `hammerStep189.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    KILLLOCK_PINNED_SPEAR, KILLLOCK_PINNED_SPEAR_COUNTS, KILLLOCK_PINNED_SPEAR_DEFAULT, chaserLineStances,
    pinnedSpearStances, resetKillLockPinnedSpearCounts, withKillLockPinnedSpear,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { replayTape } from './jsRuntimeSolver.js';
import { REQ_38_6, staged } from './hammerStep189Legs.js';

const SOURCE = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
const SINGLE_GAME = /level\s*===\s*\d|@\d+,\d+|lavarunner|\b(71|75)\b/;
const bodyIn = (decl) => {
    const at = SOURCE.indexOf(decl);
    expect(at).toBeGreaterThan(-1);
    return SOURCE.slice(at, SOURCE.indexOf('\n}\n', at) + 2);
};

describe('KILLLOCK_PINNED_SPEAR (hammer-phase STEP-189)', () => {
    it('ships OFF, read from SEEDLING_KILLLOCK_PINNED_SPEAR, and is a name the solver-env channel carries', () => {
        expect(KILLLOCK_PINNED_SPEAR_DEFAULT).toBe(false);
        expect(KILLLOCK_PINNED_SPEAR.enabled).toBe(globalThis.process?.env?.SEEDLING_KILLLOCK_PINNED_SPEAR === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KILLLOCK_PINNED_SPEAR');
    });

    it('its with-wrapper sets the switch inside and restores it after, also on a throw', () => {
        const was = KILLLOCK_PINNED_SPEAR.enabled;
        expect(withKillLockPinnedSpear(!was, () => KILLLOCK_PINNED_SPEAR.enabled)).toBe(!was);
        expect(KILLLOCK_PINNED_SPEAR.enabled).toBe(was);
        expect(() => withKillLockPinnedSpear(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(KILLLOCK_PINNED_SPEAR.enabled).toBe(was);
    });

    it('the counts reset to empty', () => {
        KILLLOCK_PINNED_SPEAR_COUNTS.asked = 3;
        KILLLOCK_PINNED_SPEAR_COUNTS.rows.push({});
        resetKillLockPinnedSpearCounts();
        expect(KILLLOCK_PINNED_SPEAR_COUNTS).toEqual({ asked: 0, noSpear: 0, rows: [] });
    });

    it('one call site: inside the rewound turn, behind the switch, after the line stances and before the refusal', () => {
        const turn = bodyIn('function killLockChaserRewindTurn(');
        const site = turn.indexOf('if (KILLLOCK_PINNED_SPEAR.enabled)');
        expect(site).toBeGreaterThan(turn.indexOf('if (KILLLOCK_LINE_STANCE.enabled)'));
        expect(site).toBeLessThan(turn.lastIndexOf('throw new SolverRefusal'));
        expect(SOURCE.split('killLockPinnedSpearTurn(').length - 1).toBe(2); // the declaration and the one call
    });

    it('no single-game constant in its functions', () => {
        for (const decl of ['function chaserPinPoint(', 'export function pinnedSpearStances(',
            'function killLockPinnedSpearAttempt(', 'function killLockPinnedSpearTurn(']) {
            expect(bodyIn(decl)).not.toMatch(SINGLE_GAME);
        }
    });

    it('38:6\'s tick 0: every body is offered cells its line does not reach, thrusting at the wall between', () => {
        const { tape, levelSource } = staged(REQ_38_6);
        const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null,
            scratchPersistence: tape.scratchPersistence === true });
        const bodies = run.entities('strikeBodies');
        expect(bodies.length).toBe(5);
        for (const b of bodies) {
            const cells = pinnedSpearStances(run, b, new Set());
            expect(cells.length).toBeGreaterThan(0);
            const line = chaserLineStances(run, b, new Set());
            expect(cells.filter((c) => line.some((l) => l.x === c.x && l.y === c.y))).toEqual([]);
            for (const c of cells) {
                // across the wall from the body, facing it
                expect(c.dir).toBe(c.x > b.x ? 2 : 0);
                expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeLessThanOrEqual(80);
            }
        }
        expect(pinnedSpearStances(run, bodies[0], new Set())).toEqual([
            { x: 120, y: 232, dir: 2, key: 'left', back: 'right' }, { x: 120, y: 216, dir: 2, key: 'left', back: 'right' },
        ]);
    });
});
