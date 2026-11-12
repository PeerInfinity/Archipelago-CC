/**
 * ⛓⛓⛓ hammer-phase GHOST-STRIKE-GATE (`GHOST_STRIKE_GATE`, OFF) — a Ghost-Sword-only run plans no swing the game
 * ignores (`Player.update` calls `slash()` only `if (hasSword)`, `Player.as:560-563`). Report:
 * `CC/docs/cloud-reports/seedling-hammer-ghost-strike-gate.md`.
 *
 * The witness is one divergence-sweep leg, by key: `level_0__r7c6 <- in_L2_48_16 -> exit:out_teleporter_0_128`
 * (L0's arrival from L2, (256,256), to the west teleporter), staged with the bag each row names.
 *
 * Mutants (each reds a row below):
 *   m1 `bladeSwings` ignores the switch (returns `hasSword || hasGhostSword` ON)
 *        -> "ON: the ghost-only witness walks" reds: levelRun throws at the t0 dash press.
 *   m2 `bladeSwings` returns `hasSword` OFF
 *        -> "OFF: the ghost-only witness dies at the press" reds (SOLVED where the throw was).
 *   m3 `bladeSwings` returns `hasGhostSword && !hasSword` ON (inverted)
 *        -> the Sword-only / both-held rows red (their dash and strikes vanish).
 *   m4 `planSwordDash` keeps `hasSword || hasGhostSword` (the strike policy alone gated)
 *        -> "ON: the ghost-only witness walks" reds (the dash plan presses).
 *   m5 `ghostOnlyWhy` returns null ON
 *        -> "planSwordDash refuses BY NAME" reds.
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { arrivalSolverGoal } from './wasmArrival.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { planSwordDash, solveSegment, SolverRefusal, strikePolicyFor } from './solverBot.js';
import {
    GHOST_STRIKE_GATE, GHOST_STRIKE_GATE_COUNTS, GHOST_STRIKE_GATE_DEFAULT, bladeSwings, ghostOnlyWhy,
    resetGhostStrikeGateCounts, withGhostStrikeGate,
} from './ghostStrikeGate.js';

const SRC = atlasLevelSource();
/** The witness leg (`seedling-divergence-legs.mjs`, `seedling_playthrough`): its arrival and its goal. */
const WITNESS = Object.freeze({
    key: 'level_0__r7c6 <- in_L2_48_16 -> exit:out_teleporter_0_128',
    boot: Object.freeze({ level: 0, x: 256, y: 256 }),
    goal: Object.freeze({ kind: 'exit', level: 0, tiles: [[0, 8]], name: 'level_0__r7c6 -> level_94__r2c16' }),
});
const BAGS = Object.freeze({
    ghostOnly: ['hasGhostSword', 'hasSpear'],
    swordOnly: ['hasSword'],
    both: ['hasSword', 'hasGhostSword', 'hasSpear'],
});

function solveWitness(items) {
    const staging = arrivalStaging(WITNESS.boot, { items });
    const mapped = arrivalSolverGoal({ ...WITNESS.goal }, { staging, levelSource: SRC, record: null });
    const run = createRunForStaging(staging, SRC);
    try {
        const out = solveSegment({ run, goals: [{ ...mapped.goal }], name: 'ghost-strike-gate', boot: WITNESS.boot,
            forkRun: () => createRunForStaging(arrivalStaging(WITNESS.boot, { items }), SRC) });
        return { verdict: 'SOLVED', keys: out.perTick.map((h) => [...h].sort().join('+')),
            presses: out.perTick.filter((h) => h.has('primary')).length, hits: (run.ledger('playerHits') ?? []).length };
    } catch (e) {
        return { verdict: e instanceof SolverRefusal ? 'REFUSED' : 'THREW', why: String(e?.message ?? e) };
    }
}

const runAt = (items) => createRunForStaging(arrivalStaging(WITNESS.boot, { items }), SRC);

describe('GHOST-STRIKE-GATE — the switch', () => {
    it.skipIf(process.env.SEEDLING_GHOST_STRIKE_GATE)('ships OFF; its env name is a known worker env name', () => {
        expect(GHOST_STRIKE_GATE_DEFAULT).toBe(false);
        expect(GHOST_STRIKE_GATE.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_GHOST_STRIKE_GATE');
    });
    it('`bladeSwings`: OFF is `hasSword || hasGhostSword`; ON is `hasSword` (the game\'s `if (hasSword) slash()`)', () => {
        const table = [{}, { hasSword: true }, { hasGhostSword: true }, { hasSword: true, hasGhostSword: true }];
        expect(withGhostStrikeGate(false, () => table.map(bladeSwings))).toEqual([false, true, true, true]);
        expect(withGhostStrikeGate(true, () => table.map(bladeSwings))).toEqual([false, true, false, true]);
    });
    it('`ghostOnlyWhy` is null OFF and for every bag but ghost-only ON; the instrument counts the gated reads', () => {
        expect(withGhostStrikeGate(false, () => ghostOnlyWhy({ hasGhostSword: true }))).toBeNull();
        expect(withGhostStrikeGate(true, () => ghostOnlyWhy({ hasSword: true, hasGhostSword: true }))).toBeNull();
        expect(withGhostStrikeGate(true, () => ghostOnlyWhy({ hasGhostSword: true })))
            .toMatch(/holds the GHOST SWORD and not the sword/);
        resetGhostStrikeGateCounts();
        withGhostStrikeGate(true, () => [{ hasGhostSword: true }, { hasSword: true }].forEach(bladeSwings));
        expect(GHOST_STRIKE_GATE_COUNTS.gated).toBe(1);
    });
});

describe(`GHOST-STRIKE-GATE — the witness (${WITNESS.key})`, () => {
    it('OFF: the ghost-only witness dies at the press — levelRun throws on the t0 ghost swing (the BEFORE)', () => {
        const off = withGhostStrikeGate(false, () => solveWitness(BAGS.ghostOnly));
        expect(off.verdict).toBe('THREW');
        expect(off.why).toMatch(/^levelRun: the ghostsword press at tick 0 in level 0: .*GHOST SWORD and not the sword/);
    });
    it('ON: the ghost-only witness walks — SOLVED, no `primary` press, no hit', () => {
        const on = withGhostStrikeGate(true, () => solveWitness(BAGS.ghostOnly));
        expect(on.verdict).toBe('SOLVED');
        expect(on.presses).toBe(0);
        expect(on.hits).toBe(0);
        expect(on.keys.length).toBe(223);
    });
    it('ON: `strikePolicyFor` builds no policy and `planSwordDash` refuses BY NAME for the ghost-only run', () => {
        withGhostStrikeGate(true, () => {
            expect(strikePolicyFor(runAt(BAGS.ghostOnly), { dashPlan: { ticks: new Set([1]), starts: [], windows: [] } }))
                .toBeNull();
            const plan = planSwordDash(runAt(BAGS.ghostOnly), [{ x: 8, y: 136 }]);
            expect(plan.plan).toBeNull();
            expect(plan.why).toMatch(/^no dash: the run holds the GHOST SWORD and not the sword/);
        });
    });
    it.each([['Sword-only', BAGS.swordOnly], ['both-held', BAGS.both]])(
        '%s: ON plans what OFF plans, tick for tick (its dash presses kept)', (_, items) => {
            const off = withGhostStrikeGate(false, () => solveWitness(items));
            const on = withGhostStrikeGate(true, () => solveWitness(items));
            expect(off.verdict).toBe('SOLVED');
            expect(off.presses).toBeGreaterThan(0);
            expect(on.keys).toEqual(off.keys);
        });
});
