/**
 * ⛓ hammer-phase CONNECTED-L22 — `WALK_DEATH_REFUSED` (`SEEDLING_WALK_DEATH_REFUSED`, OFF): a walk that died is
 * refused BY NAME, whatever killed it, instead of ending as a 400-tick "stall … after grazing" once the respawn has
 * walked the same corridor into the same hits.
 *
 * The case is the vanilla room the measurement came from: L22 entered by L25's door, aiming at the L29 exit. Its
 * corridor crosses the wallflyer band unpriced (`corridorBodyPricing` OFF), so the drive dies to wallflyer hits and
 * respawns at the door. OFF, `canCross` answers `cannot` with the stall's words (also pinned in
 * `seedlingCanCross.test.js`); ON, the same `cannot` names the death and the hits.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { canCross } from './seedlingCanCross.js';
import { WALK_DEATH_REFUSED } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const ENV = globalThis.process?.env ?? {};
const ASK = { level: 22, exit: 29, arrival: { from: 25 }, dashMode: 'none', witness: false };
const WAS = WALK_DEATH_REFUSED.enabled;

afterEach(() => {
    WALK_DEATH_REFUSED.enabled = WAS;
    WALK_DEATH_REFUSED.refused.length = 0;
});

describe('hammer-phase CONNECTED-L22 — WALK_DEATH_REFUSED, the switch', () => {
    it('ships OFF, `SEEDLING_WALK_DEATH_REFUSED=1` turns it on, and the channel carries the name', () => {
        expect(WALK_DEATH_REFUSED.enabled).toBe(ENV.SEEDLING_WALK_DEATH_REFUSED === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WALK_DEATH_REFUSED');
    });
});

describe('hammer-phase CONNECTED-L22 — a walk that died, OFF and ON', () => {
    it('OFF: the death loop reads as a stall short of (88,88), a `cannot`', () => {
        WALK_DEATH_REFUSED.enabled = false;
        const r = canCross(ASK);
        expect(r.verdict).toBe('cannot');
        expect(r.why).toMatch(/the re-planned corridor failed too — .* waypoint 0 \(88,88\): not reached within 400 ticks/);
        expect(WALK_DEATH_REFUSED.refused).toEqual([]);
    });

    it('ON: the same `cannot` names the death, its tick and the wallflyer hits before it', () => {
        WALK_DEATH_REFUSED.enabled = true;
        const r = canCross(ASK);
        expect(r.verdict).toBe('cannot');
        expect(r.why).toMatch(/: the player DIED at run tick \d+ in level 22 \(\d+ death\(s\) on the walk; the hits before the first: wallflyer@/);
        expect(r.why).toContain('a walk that died is refused, not re-planned from the respawn');
        expect(r.cause).toMatchObject({ kind: 'refusal', name: 'SolverRefusal', obstacle: { kind: 'death' } });
        expect(r.cause.obstacle.id).toMatch(/^wallflyer@/);
        // one row per refusal asked: the attempt's own catch, then `walkTo`'s wrapper over the same death (as a drown is)
        expect(WALK_DEATH_REFUSED.refused.length).toBeGreaterThan(0);
        for (const row of WALK_DEATH_REFUSED.refused) {
            expect(row).toMatchObject({ level: 22 });
            expect(row.sources.every((s) => s.startsWith('wallflyer@'))).toBe(true);
        }
    });
});
