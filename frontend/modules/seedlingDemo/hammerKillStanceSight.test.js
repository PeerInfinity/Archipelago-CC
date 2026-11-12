/**
 * ⛓⛓⛓ seedling-hammer-l28-bobsoldier: THE CHASER ARM'S STANCE SCAN SEES THE SWING'S LINE OF SIGHT
 * (`KILL_STANCE_SIGHT`, OFF; `SEEDLING_KILL_STANCE_SIGHT=1`).
 *
 * The witness is ROCK-HOLDER-WAIT's L28 leg to the L30 door from state (136,296), {28,0} + {28,1} cleared, with both of
 * its switches ON (`RESTING_HOLDER`, `CONTACT_FIDELITY.fallRockHoldsButton`). The row USES the leg; the switch reads
 * no level id and no Seedling constant (the line is `run.collideLineSolid`, the run's own). The measurement and the
 * page play are in `CC/docs/cloud-reports/seedling-hammer-l28-bobsoldier.md` §3 and §6.
 */
import { describe, expect, it } from 'vitest';
import { withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import {
    KILL_STANCE_SIGHT, KILL_STANCE_SIGHT_DEFAULT, solveSegment, withKillStanceSight, withRestingHolder,
} from './solverBot.js';

const BOOT = { level: 28, x: 128, y: 288 };
const DOOR = [{ kind: 'reach-exit', exit: { x: 304, y: 16 } }];
const BOB = 'bobsoldier@264,168';

/** The leg solved on a fresh run under `sight` (both rock switches ON): outcome, ticks, hits, keys, kill record. */
function solveDoor(cleared, sight) {
    const run = createRunForStaging(arrivalStaging(BOOT, { items: ['hasSword'], cleared }), atlasLevelSource());
    const keys = [];
    const advance = run.advance.bind(run);
    run.advance = (...a) => { keys.push([...a[0]].sort().join('+')); return advance(...a); };
    KILL_STANCE_SIGHT.counts.asks = 0;
    KILL_STANCE_SIGHT.counts.refused = 0;
    let err = null;
    let out = null;
    withKillStanceSight(sight, () => withRestingHolder(true, () => withContactFidelity({ fallRockHoldsButton: true },
        () => {
            try {
                out = solveSegment({ run, goals: DOOR, name: 'l28-bobsoldier', boot: BOOT });
            } catch (e) { err = e; }
        })));
    return { err, out, run, keys, counts: { ...KILL_STANCE_SIGHT.counts },
        hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]) };
}

describe('L28-BOBSOLDIER — `KILL_STANCE_SIGHT` (OFF)', () => {
    it.skipIf(process.env.SEEDLING_KILL_STANCE_SIGHT)('ships OFF; its env name is a known worker env name', () => {
        expect(KILL_STANCE_SIGHT_DEFAULT).toBe(false);
        expect(KILL_STANCE_SIGHT.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KILL_STANCE_SIGHT');
        withKillStanceSight(true, () => expect(KILL_STANCE_SIGHT.enabled).toBe(true));
        expect(KILL_STANCE_SIGHT.enabled).toBe(false);
    });

    it('OFF: today\'s plan — the kill dwell is hit at t361 (the stance was priced with the swing landing through a Solid)',
        () => {
            const { err, run, hits, counts } = solveDoor([0, 1], false);
            expect(hits).toEqual([[361, 'sword', BOB]]);
            expect(run.ticksCompleted).toBe(361);
            expect(err.message).toMatch(/kill \(bobsoldier@264,168\) by press: the dwell was HIT at tick 74/);
            expect(counts).toEqual({ asks: 0, refused: 0 });
        });

    it('ON: the L28 leg SOLVES hitless — the kill is priced with the line, the soldier dies on the walk, L30 at t448', () => {
        const { err, out, run, hits, counts } = solveDoor([0, 1], true);
        expect(err).toBe(null);
        expect(hits).toEqual([]);
        expect(run.ticksCompleted).toBe(448);
        expect(out.records.at(-1)).toEqual({ goal: 'reach-exit', to: 30, t: 448 });
        const kill = out.records.find((r) => r.strategy === 'kill');
        expect(kill).toMatchObject({ arm: 'chaser', target: BOB, stance: { x: 280, y: 200 }, clears: [BOB] });
        // the line refused swings inside the scan's previews: the switch is what moved the pick
        expect(counts.asks).toBe(34);
        expect(counts.refused).toBe(8);
    });

    it('control: the rock overhead (`cleared: []`) — the scan asks the line, and the leg is ON = OFF, key for key', () => {
        const off = solveDoor([], false);
        const on = solveDoor([], true);
        expect(on.counts).toEqual({ asks: 34, refused: 8 });
        expect(off.err.message).toMatch(/kill \(bobsoldier@264,168\) stance: the re-planned corridor failed too/);
        expect(on.err.message).toBe(off.err.message);
        expect(on.run.ticksCompleted).toBe(1277);
        expect(on.keys).toEqual(off.keys);
        expect(on.hits).toEqual(off.hits);
    });
});
