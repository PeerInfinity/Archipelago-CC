/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE BAIT-SUBWALK-GOAL — the default-tier rows of `SUBWALK_ANCESTOR_CROSSING` (OFF): the
 * switch's plumbing, and a walk with no level change unchanged ON (the generated bait gate, `[bait, collect]`: a
 * stance walk inside a goal walk, no crossing). The witness (ER c3, L40 → the pit → L43, solved ON) is
 * `hammerBaitSubwalkGoal.train.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { AncestorCrossing, SUBWALK_ANCESTOR_CROSSING, SUBWALK_ANCESTOR_CROSSING_COUNTS,
    SUBWALK_ANCESTOR_CROSSING_DEFAULT, subwalkAncestorCrossing, withSubwalkAncestorCrossing } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { generateSeedlingLevel, seedlingOracle } from './procgenSeedling.js';
import { PRE_SWORD_PALETTE } from './procgenPalette.js';
import { VERDICT } from './procgenOracle.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

describe('hammer-phase BAIT-SUBWALK-GOAL — `SUBWALK_ANCESTOR_CROSSING`', () => {
    it('is OFF by default, named in the worker env channel, and `withSubwalkAncestorCrossing` restores it', () => {
        expect(SUBWALK_ANCESTOR_CROSSING_DEFAULT).toBe(false);
        expect(SUBWALK_ANCESTOR_CROSSING.enabled)
            .toBe(globalThis.process?.env?.SEEDLING_SUBWALK_ANCESTOR_CROSSING === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SUBWALK_ANCESTOR_CROSSING');
        const before = SUBWALK_ANCESTOR_CROSSING.enabled;
        withSubwalkAncestorCrossing(!before, () => expect(SUBWALK_ANCESTOR_CROSSING.enabled).toBe(!before));
        expect(SUBWALK_ANCESTOR_CROSSING.enabled).toBe(before);
    });

    it('a bait stance walk that never changes level (the generated bait gate, seed 1) solves the same plan ON as OFF', () => {
        const out = generateSeedlingLevel({
            seed: 1, palette: PRE_SWORD_PALETTE, defaults: { width: 10, height: 10 },
            skeleton: parseSkeleton('empty', { substrate: 'seedling' }), elements: parseElementSpec('baitgate'),
        });
        const solve = () => seedlingOracle({ model: out.model, items: PRE_SWORD_PALETTE.items }).solve(out.record);
        const off = withSubwalkAncestorCrossing(false, solve);
        SUBWALK_ANCESTOR_CROSSING_COUNTS.handed.length = 0;
        SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched.length = 0;
        const on = withSubwalkAncestorCrossing(true, solve);
        expect(off.verdict).toBe(VERDICT.SOLVED);
        expect(on.verdict).toBe(VERDICT.SOLVED);
        expect(on.ticks).toBe(off.ticks);
        expect(JSON.stringify(on.tape)).toBe(JSON.stringify(off.tape));
        expect(on.records).toEqual(off.records);
        expect(on.records.some((r) => r.strategy === 'bait')).toBe(true);
        expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.handed).toEqual([]);
        expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched).toEqual([]);
    }, 240000);

    /**
     * The CONTROL: a sub-walk's crossing that does not satisfy an enclosing walk is the refuted corridor it was (no
     * throw; an `unmatched` row ON). No route-survey step has one (0 in 1254 step solves, vanilla and ER): doors are
     * planner obstacles and only the goal's own pit is exempt, so the check is asked here on a stub run.
     */
    it('a crossing into a level no enclosing walk names, or by another door, is left to the walk; OFF asks nothing', () => {
        const run = { transitions: [{ t: 10, from_level: 1, to_level: 2 }], level: 2, state: { x: 8, y: 8 } };
        const perTick = new Array(10).fill([]);
        const door = (level, x, y) => ({ crossTo: { level, arrival: { x, y } }, what: `exit->L${level}` });
        const pit = (level) => ({ crossTo: { level, pit: { tx: 0, ty: 0 }, arrival: { x: 0, y: 0 } }, what: `pit->L${level}` });
        withSubwalkAncestorCrossing(false, () => {
            expect(() => subwalkAncestorCrossing(run, perTick, [door(2, 8, 8)], null, 'sub')).not.toThrow();
        });
        withSubwalkAncestorCrossing(true, () => {
            SUBWALK_ANCESTOR_CROSSING_COUNTS.handed.length = 0;
            SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched.length = 0;
            // another level; the right level by another door; the crossing not on this tick; no enclosing walk
            expect(() => subwalkAncestorCrossing(run, perTick, [door(3, 8, 8)], null, 'sub a')).not.toThrow();
            expect(() => subwalkAncestorCrossing(run, perTick, [door(2, 16, 8)], null, 'sub b')).not.toThrow();
            expect(() => subwalkAncestorCrossing(run, new Array(11).fill([]), [door(2, 8, 8)], null, 'sub c')).not.toThrow();
            expect(() => subwalkAncestorCrossing(run, perTick, [], null, 'sub d')).not.toThrow();
            // the walk's OWN crossing frame is `drive`'s question, not this one
            expect(() => subwalkAncestorCrossing(run, perTick, [door(2, 8, 8)], door(2, 8, 8).crossTo, 'sub e')).not.toThrow();
            expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched.map((u) => u.sub)).toEqual(['sub a', 'sub b', 'sub e']);
            expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.handed).toEqual([]);
            // the nearest enclosing walk that names the level: a door by its arrival, a pit by its level
            const frames = [pit(2), door(5, 0, 0)];
            let thrown = null;
            try { subwalkAncestorCrossing(run, perTick, frames, null, 'sub f'); } catch (e) { thrown = e; }
            expect(thrown).toBeInstanceOf(AncestorCrossing);
            expect(thrown.frame).toBe(frames[0]);
            expect(thrown.transition).toBe(run.transitions[0]);
            expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.handed).toMatchObject([{ t: 10, from: 1, to: 2, sub: 'sub f', depth: 2 }]);
        });
    });
});
