/**
 * ⛓⛓ SEEDLING FIDELITY BOBSOLDIER2, D3 — the CRUSHER bait's fork hygiene (`solveSegment`'s `fork`, `execBait`).
 *
 * (b) `replayOntoFork` applies a segment's slot selections on the fork's RUN clock (`ticksCompleted`), where the
 * live run made them — the first cut keyed them by the perTick index, which dead frames move away from the run clock.
 * (a) the fork tries ask the opt-in FINE deadline site `crusher-fork`; without `fineCheckpoints` it is never asked.
 */

import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { DEADLINE_SITES, SolverRefusal, WALK_CHECK_TICKS, replayOntoFork, solveSegment } from './solverBot.js';
import { crusherStaging, CRUSHER_WITNESSES } from '../../../scripts/procgen/plan-seedling-crusher-witness.mjs';

const SRC = atlasLevelSource();

describe('BOBSOLDIER2 D3(b) — the fork replays equips on the RUN clock, not the perTick index', () => {
    /** A run whose clock jumps `dead` extra ticks on the advances listed (dead frames). */
    const stubRun = (dead) => {
        const r = { ticksCompleted: 0, advances: 0, log: [] };
        r.advance = () => { r.ticksCompleted += 1 + (dead.get(r.advances) ?? 0); r.advances += 1; };
        r.equipNow = (slot) => r.log.push({ at: r.advances, clock: r.ticksCompleted, slot });
        return r;
    };
    const NO = new Set();
    /** The live run: drive `n` ticks, equipping where `plan` says (by advance count), recording `{t: clock}`. */
    const live = (n, dead, plan) => {
        const r = stubRun(dead);
        const equips = [];
        for (let i = 0; i <= n; i += 1) {
            if (plan.has(i)) { r.equipNow(plan.get(i)); equips.push({ t: r.ticksCompleted, slot: plan.get(i) }); }
            if (i < n) r.advance(NO);
        }
        return { r, equips };
    };

    it('across dead frames, every equip lands where the live run made it — and one after the last tick too', () => {
        const dead = new Map([[3, 174]]);
        const plan = new Map([[2, 'fire'], [6, 'sword'], [10, 'shield']]);
        const { r, equips } = live(10, dead, plan);
        expect(equips.map((e) => e.t)).toEqual([2, 180, 184]);
        const f = replayOntoFork(stubRun(dead), new Array(10).fill(NO), equips);
        expect(f.log).toEqual(r.log);
    });

    it('a clock the fork never lands on is not the same run, and says so', () => {
        expect(() => replayOntoFork(stubRun(new Map([[0, 3]])), [NO, NO], [{ t: 2, slot: 'x' }]))
            .toThrow(/without landing on it/);
    });

    it('`stop` is asked every WALK_CHECK_TICKS advances, and a trip abandons the fork', () => {
        let asks = 0;
        const n = WALK_CHECK_TICKS * 3 + 1;
        expect(replayOntoFork(stubRun(new Map()), new Array(n).fill(NO), [], { stop: () => { asks += 1; return false; } }))
            .not.toBeNull();
        expect(asks).toBe(3);
        const f = stubRun(new Map());
        expect(replayOntoFork(f, new Array(n).fill(NO), [], { stop: () => true })).toBeNull();
        expect(f.advances).toBe(WALK_CHECK_TICKS);
    });
});

describe('BOBSOLDIER2 D3(a) — `crusher-fork` is a FINE site: asked only under `fineCheckpoints`', () => {
    const W = CRUSHER_WITNESSES[0];
    const solve = async (fine, shouldStop) => {
        const st = await crusherStaging(W);
        const mk = () => createRunForStaging(st, SRC);
        return solveSegment({ run: mk(), goals: W.goals.map((g) => JSON.parse(JSON.stringify(g))), name: W.name,
            boot: st.boot, dashMode: 'none', forkRun: mk, shouldStop, fineCheckpoints: fine });
    };

    it('is a row of DEADLINE_SITES, appended', () => {
        expect(DEADLINE_SITES.at(-1)).toBe('crusher-fork');
    });

    it('coarse: never asked (L42 dashless: 0 asks at all, the base\'s sequence); fine: asked, the solve unchanged',
        async () => {
            const coarse = [];
            const a = await solve(false, (s) => { coarse.push(s); return false; });
            expect(coarse).toEqual([]);
            const fine = [];
            const b = await solve(true, (s) => { fine.push(s); return false; });
            expect(b.perTick.length).toBe(a.perTick.length);
            expect(fine.filter((s) => s === 'crusher-fork').length).toBe(95);
            expect(fine.filter((s) => s !== 'crusher-fork').length).toBe(98);
        }, 120_000);

    it('a trip at `crusher-fork` refuses the bait verb by name', async () => {
        await expect(solve(true, (s) => s === 'crusher-fork')).rejects.toSatisfy((e) => e instanceof SolverRefusal
            && /`crusher-fork` site/.test(e.message) && e.deadline?.first === 'crusher-fork');
    }, 120_000);
});
