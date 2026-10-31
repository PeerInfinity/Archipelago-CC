/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SLASHRECT — a press on a tick that starts with no facing (`pressNoFacing.js`).
 *
 * The fixture (`fixtures/hammer-slashrect/seed7-request.json`, 6 KB) is the solve request the lab's caldera
 * COUNTERFACTUAL aborted on: caldera's items and terrain WITHOUT its melt `floodWalks`, `empty`, 8 obstacles, seed 7,
 * step 5 try 4, candidate `melt-patch(w=1,h=2)` at (2,4) (rebuilt by
 * `CC/docs/cloud-reports/seedling-hammer-slashrect-evidence/capture-seed7.mjs`). The press kill on `spinner@16,32`
 * aims `left` at t100 from lava (no dark suit); t100 is the i-frames' last tick, so `hitUpdate` leaves `direction` at
 * -1 and the escape forecast of the press at t101 threw `PressError: slashRect: direction -1 is not 0..3` at the base:
 * the level ABORTED.
 *  - always: the forecast's throw is a refusal by name (`PRESS_NO_FACING`), so the candidate is REFUSED and the
 *    generator walks on (seed 7 reaches its target);
 *  - `PRESS_NO_FACING` ON: the aim waits a tick and the solve meets the kill's own existing refusal instead.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { solve, VERDICT } from './procgenOracle.js';
import { PressError, slashRect } from './presses.js';
import { CombatVerbError } from './combatVerbs.js';
import { SolverRefusal } from './solverBot.js';
import { createPlayerDamage, playerHit, stepPlayerDamage } from './playerDamage.js';
import {
    PRESS_NO_FACING, PRESS_NO_FACING_BOUND, PRESS_NO_FACING_COUNTS, PRESS_NO_FACING_DEFAULT, isFacing,
    refuseNoFacing, resetPressNoFacingCounts, withPressNoFacing,
} from './pressNoFacing.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REQ = JSON.parse(readFileSync(join(HERE, 'fixtures', 'hammer-slashrect', 'seed7-request.json'), 'utf8'));
const OPTED = globalThis.process?.env?.SEEDLING_PRESS_NO_FACING === '1';
const solveSeed7 = () => solve(REQ.record, REQ.staging, REQ.goals, REQ.budget, { name: REQ.name });

describe('hammer-phase SLASHRECT — where the -1 comes from (`Player.as:1424`)', () => {
    it('a hit with no knockback source parks no facing, and the recovery tick hands back -1', () => {
        // `checkDrowning`'s lava arm: `hit(null, 0, null, 0)` — no `p`, so no `knockback`, so no `directionFace`
        const hit = playerHit(createPlayerDamage(), { hitsMax: 3, damage: 0, from: null, direction: 2 });
        expect(hit.applied).toBe(true);
        expect(hit.state.directionFace).toBe(-1);
        let s = { ...hit.state, hitsTimer: 1 };
        const r = stepPlayerDamage(s);
        expect(r).toMatchObject({ recovered: true, direction: -1 });
        expect(isFacing(r.direction)).toBe(false);
        // a knockback parks the facing it was hit at, and the recovery hands THAT back
        s = { ...playerHit(createPlayerDamage(), { hitsMax: 3, from: { x: 0, y: 0 }, at: { x: 10, y: 0 },
            direction: 2 }).state, hitsTimer: 1 };
        expect(stepPlayerDamage(s)).toMatchObject({ recovered: true, direction: 2 });
    });

    it('`isFacing` is the four values and nothing else', () => {
        for (const d of [0, 1, 2, 3]) expect(isFacing(d)).toBe(true);
        for (const d of [-1, 4, 0.5, 3.0000000000000004, null, undefined, NaN]) expect(isFacing(d)).toBe(false);
    });

    it('the rect throws on -1 by design (no model has `getSlashRect`\'s all-zero default arm)', () => {
        expect(() => slashRect(40, 88, -1)).toThrow(PressError);
    });
});

describe('hammer-phase SLASHRECT — `refuseNoFacing`', () => {
    const at = (direction) => ({ direction, pressAt: 101, caller: 'escape', id: 'spinner@16,32' });
    it('a value, a throw at a facing, and a non-rect throw all pass through unchanged', () => {
        expect(refuseNoFacing(SolverRefusal, at(-1), () => 7)).toBe(7);
        const atFacing = new PressError('x');
        expect(() => refuseNoFacing(SolverRefusal, at(2), () => { throw atFacing; })).toThrow(atFacing);
        const other = new TypeError('y');
        expect(() => refuseNoFacing(SolverRefusal, at(-1), () => { throw other; })).toThrow(other);
    });
    it('a rect throw with no facing becomes a SolverRefusal NAMED `PRESS_NO_FACING` (sword and ghost sword)', () => {
        for (const cause of [new PressError('slashRect: direction -1 is not 0..3'), new CombatVerbError('ghost')]) {
            let e = null;
            try { refuseNoFacing(SolverRefusal, at(-1), () => { throw cause; }); } catch (x) { e = x; }
            expect(e).toBeInstanceOf(SolverRefusal);
            expect(e.bound).toBe(PRESS_NO_FACING_BOUND);
            expect(e.code).toBe(PRESS_NO_FACING_BOUND);
            expect(e.message.startsWith(`${PRESS_NO_FACING_BOUND}: the press at t101 (escape) starts with facing -1`))
                .toBe(true);
            expect(e.message).toContain(cause.message);
        }
    });
});

describe('hammer-phase SLASHRECT — the caldera counterfactual, seed 7 (the request that aborted the level)', () => {
    it.skipIf(OPTED)('ships OFF', () => {
        expect(PRESS_NO_FACING.enabled).toBe(false);
        expect(PRESS_NO_FACING_DEFAULT).toBe(false);
    });

    it('always: the press forecast\'s throw is REFUSED by name (it threw `PressError` at the base)', () => {
        resetPressNoFacingCounts();
        const out = withPressNoFacing(false, solveSeed7);
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.errorName).toBe('SolverRefusal');
        expect(out.reasonText.startsWith(`${PRESS_NO_FACING_BOUND}: the press at t101 (escape) starts with facing -1`))
            .toBe(true);
        expect(out.reasonText).toContain('(body spinner@16,32)');
        expect(out.reasonText).toContain('the preview said: slashRect: direction -1 is not 0..3');
        expect(PRESS_NO_FACING_COUNTS.refused).toBe(1);
    });

    it('ON: the aim waits a tick instead (no forecast at -1), and the solve meets the kill\'s own refusal', () => {
        resetPressNoFacingCounts();
        const out = withPressNoFacing(true, solveSeed7);
        expect(PRESS_NO_FACING_COUNTS.escapeDeclined).toBeGreaterThanOrEqual(1);
        expect(PRESS_NO_FACING_COUNTS.aimDeclined).toBeGreaterThanOrEqual(1);
        expect(PRESS_NO_FACING_COUNTS.refused).toBe(0);
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).not.toContain(PRESS_NO_FACING_BOUND);
        expect(out.reasonText).toContain('kill (spinner@16,32) by press');
        expect(out.reasonText).toContain('There is no step out');
    });
});
