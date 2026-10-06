/**
 * Seedling fidelity CLEARTAG: the `clear-tag` goal — a saved obstacle broken,
 * burned or opened from its OPEN side, finished on the run's ledger.
 *
 * ⚖ The user (2026-10-05): *"break before first use"* — an arrival inside a
 * persistence-tagged obstacle requires its flag; the planner visits the unmet
 * flag first as a goal; ARRIVAL's `arrival-inside-solid` refusal is the
 * backstop and is never acted from.
 *
 *   · D1 (the game): `fixtures/cleartag-oracle.json`
 *     (`probe-seedling-cleartag.mjs --record`, p4f) — the solver's own plan for
 *     each verb path (the walk's strike on {0,1}, `break` {0,4}, `touch` {71,2},
 *     `burn` {24,0}), its stream 0 px against the model, and the tick the game's
 *     `persistence_cleared` first holds the flag: after `T + 1` ticks, T the
 *     executor's write tick (the cut at `T` does not hold it).
 *   · D2 (the executor): `solverBot.execClearTag` — the verb is the catalogue's,
 *     the stance the resolver's, the finish the GAME's write (`earnedClears`
 *     holds the flag AND the family's write tick has run, `clearTagWriteTick`); met
 *     before it was asked (`cleared-in-passing`, `already-clear`) without a
 *     tick; every refusal `obstacle.kind 'clear-tag'` with a `reason`.
 *   · D3 (the census): one row per playthrough event, from a landing on its
 *     open side (`measure-seedling-cleartag.mjs` is the full table).
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 the in-passing check removed (`if (written())` at the top of
 *      `execClearTag` never returns)
 *        -> "a second clear-tag of the same flag is met in passing" reds: the
 *           rock is gone, so the second goal reads `already-clear`.
 *   m2 the stance walk skipped (`walkTo(goal, resolved.stance …)` removed)
 *        -> every SOLVES row reds: `execBreak` refuses "not in reach of a
 *           swing", `execBurn`/`execTouch` likewise from the boot cell.
 *   m3 the ledger finish dropped (`waitForWrite`'s closing `refuseCT('not-written' …)`
 *      removed)
 *        -> "a verb that does not write THIS flag is refused" reds: the wrong
 *           tag's goal SOLVES.
 *   m5 the write-tick finish dropped (`landed` = the row exists)
 *        -> the L71 rows red: the solve ends on 164 t, the tick BEFORE the
 *           game's write (the oracle's solve arm is 165 t).
 *   m4 (the guarantee) ARRIVAL's entry check removed (`arrivalInsideSolid`
 *      never consulted in `solveSegment`)
 *        -> "the arrival the flag gates still refuses with the flag unset" reds.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { runTape, createRunForStaging } from './tapeRunner.js';
import { compactTicks } from './fidelityStepOff.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CLEARTAG_WITNESSES, clearTagArms, modelWrote } from './fidelityClearTag.js';
import { assertGoal, solveSegment, SolverRefusal } from './solverBot.js';
import { KNOWN_GOAL_KINDS } from './decisionTrace.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'cleartag-oracle.json'), 'utf8'));
const SRC = atlasLevelSource();

const L0_ROCK = Object.freeze({ kind: 'clear-tag', tag: { level: 0, tag: 1 }, at: { x: 288, y: 176 },
    obstacle: 'breakablerock@288,176' });
const FROM_L2 = Object.freeze({ level: 0, x: 256, y: 256 });

const solve = (boot, goals, { items = [], cleared = [], keys = null } = {}) => {
    const st = arrivalStaging(boot, { items, cleared });
    const run = createRunForStaging(keys ? { ...st, save: { totem_parts: [], seal_parts: [], keys } } : st, SRC);
    return { run, go: () => solveSegment({ run, goals, name: `cleartag-row-${boot.level}`, boot }) };
};
const refusalOf = (fn) => {
    try { fn(); } catch (e) { if (e instanceof SolverRefusal) return e; throw e; }
    return null;
};

describe('fidelity CLEARTAG — D2: the goal shape', () => {
    it('`clear-tag` is in the trace vocabulary and the solver admits it', () => {
        expect(KNOWN_GOAL_KINDS).toContain('clear-tag');
        expect(assertGoal({ ...L0_ROCK }, 0)).toEqual(L0_ROCK);
        expect(assertGoal({ kind: 'clear-tag', tag: { level: 0, tag: 1 }, at: { x: 288, y: 176 } }, 0)).toBeTruthy();
    });
    it.each([
        ['no tag', { kind: 'clear-tag', at: { x: 0, y: 0 } }],
        ['a negative tag', { kind: 'clear-tag', tag: { level: 0, tag: -1 }, at: { x: 0, y: 0 } }],
        ['no at', { kind: 'clear-tag', tag: { level: 0, tag: 1 } }],
        ['a malformed obstacle id', { ...L0_ROCK, obstacle: 'rock at 288' }],
    ])('refuses %s at the door', (_, g) => {
        expect(() => assertGoal(g, 0)).toThrow(/clear-tag needs tag \{level, tag\}/);
    });
});

describe('fidelity CLEARTAG — D2: the executor', () => {
    it('L0 {0,4} from L13 with the Sword: walk to the open side, `break`, finish on the GAME\'s write (75 t; the rock leaves on t63)', () => {
        const goal = { kind: 'clear-tag', tag: { level: 0, tag: 4 }, at: { x: 80, y: 112 }, obstacle: 'breakablerock@80,112' };
        const { run, go } = solve({ level: 0, x: 48, y: 192 }, [goal], { items: ['hasSword'] });
        const out = go();
        expect(out.perTick).toHaveLength(75);
        expect(out.records).toEqual([expect.objectContaining({ goal: 'clear-tag', arm: 'verb', strategy: 'break',
            flag: { level: 0, tag: 4 }, obstacle: 'breakablerock@80,112', ledgerAt: 56, confirmedAt: 75, by: 'breakablerock',
            stance: { x: 104, y: 120 }, waited: 0 })]);
        expect(run.rocksBroken).toEqual([expect.objectContaining({ id: 'breakablerock@80,112', tag: 4, goneAt: 63 })]);
        expect(out.trace.rows.some((r) => r.goal.kind === 'clear-tag' && r.strategy.verb === 'break')).toBe(true);
    });
    it('L0 {0,1} from L2: the walk to the stance strikes the rock on its way — met in passing, the verb not re-run (54 t)', () => {
        const { run, go } = solve(FROM_L2, [L0_ROCK], { items: ['hasSword'] });
        const out = go();
        expect(out.perTick).toHaveLength(54);
        expect(out.records).toEqual([expect.objectContaining({ arm: 'cleared-in-passing', during: 'stance walk',
            strategy: 'break', ledgerAt: 43, confirmedAt: 54 })]);
        // The row was stamped at the HIT (t43); the rock left the world, and the game wrote, on t50.
        expect(run.rocksBroken).toEqual([expect.objectContaining({ id: 'breakablerock@288,176', hitTick: 43, goneAt: 50 })]);
    });
    it('L71 {71,2} from L80: `touch`, and ONE idle tick past the verb so the game\'s write has run (165 t)', () => {
        const goal = { kind: 'clear-tag', tag: { level: 71, tag: 2 }, at: { x: 288, y: 256 }, obstacle: 'shieldlock@288,256' };
        const out = solve({ level: 71, x: 224, y: 288 }, [goal], { items: ['hasShield', 'hasDarkShield'] }).go();
        expect(out.perTick).toHaveLength(165);
        expect(out.records).toEqual([expect.objectContaining({ arm: 'verb', strategy: 'touch', ledgerAt: 164, confirmedAt: 165, waited: 1 })]);
    });
    it('a second clear-tag of the same flag is met in passing (no tick spent)', () => {
        const out = solve(FROM_L2, [L0_ROCK, L0_ROCK], { items: ['hasSword'] }).go();
        expect(out.perTick).toHaveLength(54);
        expect(out.records.map((r) => r.arm)).toEqual(['cleared-in-passing', 'cleared-in-passing']);
        expect(out.records[1]).toMatchObject({ ledgerAt: 43, confirmedAt: 54, waited: 0 });
        expect(out.records[1].during).toBeUndefined();
    });
    it('the flag already cleared at boot: `already-clear`, zero ticks (the build left the rock out)', () => {
        const out = solve(FROM_L2, [L0_ROCK], { items: ['hasSword'], cleared: [1] }).go();
        expect(out.perTick).toHaveLength(0);
        expect(out.records).toEqual([expect.objectContaining({ arm: 'already-clear', ledgerAt: null, confirmedAt: 0 })]);
    });
    it('a verb that does not write THIS flag is refused (`not-written`), never reported met', () => {
        const e = refusalOf(solve(FROM_L2, [{ ...L0_ROCK, tag: { level: 0, tag: 2 } }], { items: ['hasSword'] }).go);
        expect(e.obstacle).toEqual({ kind: 'clear-tag', id: 'breakablerock@288,176', flag: { level: 0, tag: 2 }, reason: 'not-written' });
        expect(e.message).toMatch(/'break' ran .* still does not hold \{0,2\} 120 ticks later/);
    });
    it('no Sword: `cannot-act`, before a tick (the resolver\'s own held:false words)', () => {
        const e = refusalOf(solve(FROM_L2, [L0_ROCK]).go);
        expect(e.obstacle.reason).toBe('cannot-act');
        expect(e.message).toMatch(/the run's `primary` slot holds NOTHING/);
        expect(e.perTick).toEqual([]);
    });
    it('the wrong level: `wrong-level`', () => {
        const e = refusalOf(solve(FROM_L2, [{ ...L0_ROCK, tag: { level: 12, tag: 1 } }], { items: ['hasSword'] }).go);
        expect(e.obstacle.reason).toBe('wrong-level');
    });
    it('an unreachable open side: `unresolved`, with the stance search\'s words (L89\'s landing, the north pocket)', () => {
        const e = refusalOf(solve({ level: 0, x: 240, y: 16 }, [L0_ROCK], { items: ['hasSword'] }).go);
        expect(e.obstacle.reason).toBe('unresolved');
        expect(e.message).toMatch(/no REACHABLE stance for a swing at breakablerock@288,176/);
    });
});

describe('fidelity CLEARTAG — D2: break before first use, end to end (the guarantee holds)', () => {
    it('the arrival the flag gates still refuses with the flag unset (ARRIVAL\'s backstop, untouched)', () => {
        const e = refusalOf(solve({ level: 0, x: 288, y: 176 }, [{ kind: 'reach-exit', exit: { x: 304, y: 176 } }],
            { items: ['hasSword'] }).go);
        expect(e.obstacle.kind).toBe('arrival-inside-solid');
    });
    it('clear-tag, then the door to L12: the run carries {0,1}, and the gated arrival back from L12 then solves', () => {
        const { run, go } = solve(FROM_L2, [L0_ROCK, { kind: 'reach-exit', exit: { x: 304, y: 176 } }], { items: ['hasSword'] });
        const out = go();
        expect(out.perTick).toHaveLength(68);
        expect(run.level).toBe(12);
        const cleared = run.ledger('earnedClears').filter((c) => c.level === 0).map((c) => c.tag);
        expect(cleared).toEqual([1]);
        const back = solve({ level: 0, x: 288, y: 176 }, [{ kind: 'reach-exit', exit: { x: 304, y: 176 } }],
            { items: ['hasSword'], cleared }).go();
        expect(back.perTick).toHaveLength(5);
    });
});

/**
 * ⛓ D3 — one row per playthrough event, from a GAME landing on its open side
 * (the full table, every landing, is `measure-seedling-cleartag.mjs`).
 */
const CENSUS = [
    ['{0,1} break from L2 stairs', { level: 0, x: 256, y: 256 }, L0_ROCK, ['hasSword'], null, 'SOLVES 54'],
    ['{0,4} break from L13 stairs', { level: 0, x: 48, y: 192 },
        { kind: 'clear-tag', tag: { level: 0, tag: 4 }, at: { x: 80, y: 112 }, obstacle: 'breakablerock@80,112' },
        ['hasSword'], null, 'SOLVES 75'],
    ['{12,7} magicallock from L0', { level: 12, x: 16, y: 80 },
        { kind: 'clear-tag', tag: { level: 12, tag: 7 }, at: { x: 32, y: 864 }, obstacle: 'magicallock@32,864' },
        ['hasWand'], null, 'REFUSES unresolved'],
    ['{12,12} bosslock from L0 (every key)', { level: 12, x: 16, y: 80 },
        { kind: 'clear-tag', tag: { level: 12, tag: 12 }, at: { x: 32, y: 864 }, obstacle: 'bosslock@32,864' },
        [], [0, 1, 2, 3, 4], 'REFUSES unresolved'],
    ['{24,0} burn from L23 stairs', { level: 24, x: 96, y: 80 },
        { kind: 'clear-tag', tag: { level: 24, tag: 0 }, at: { x: 32, y: 128 }, obstacle: 'burnabletree@32,128' },
        ['hasSword', 'hasFire'], null, 'SOLVES 114'],
    ['{71,2} touch from L80', { level: 71, x: 224, y: 288 },
        { kind: 'clear-tag', tag: { level: 71, tag: 2 }, at: { x: 288, y: 256 }, obstacle: 'shieldlock@288,256' },
        ['hasShield', 'hasDarkShield'], null, 'SOLVES 165'],
    ['{112,1} rocklock from L111', { level: 112, x: 32, y: 208 },
        { kind: 'clear-tag', tag: { level: 112, tag: 1 }, at: { x: 112, y: 16 }, obstacle: 'rocklock@112,16' },
        [], null, 'REFUSES no-verb'],
    ['{113,0} finaldoor from L112', { level: 113, x: 72, y: 128 },
        { kind: 'clear-tag', tag: { level: 113, tag: 0 }, at: { x: 112, y: 0 }, obstacle: 'finaldoor@112,0' },
        [], null, 'REFUSES no-verb'],
];

describe('fidelity CLEARTAG — D3: the eight events, each solves or refuses by name', () => {
    it.each(CENSUS)('%s', (_, boot, goal, items, keys, want) => {
        const { go } = solve(boot, [goal], { items, keys });
        let got;
        try {
            got = `SOLVES ${go().perTick.length}`;
        } catch (e) {
            if (!(e instanceof SolverRefusal)) throw e;
            expect(e.obstacle.kind).toBe('clear-tag');
            got = `REFUSES ${e.obstacle.reason}`;
        }
        expect(got).toBe(want);
    });
});

describe('fidelity CLEARTAG — D1/D2: the game witnesses (the oracle replays at 0 px)', () => {
    const arms = clearTagArms(SRC);
    it('the oracle holds every arm (four witnesses × the solve and its two cuts), all PASS on the game', () => {
        expect(ORACLE.arms.map((a) => a.arm)).toEqual(arms.map((a) => a.arm));
        expect(CLEARTAG_WITNESSES.map((w) => w.verb)).toEqual(['break', 'break', 'touch', 'burn']);
        expect(ORACLE.arms.every((a) => a.vsModel.worst === 0 && a.error === '')).toBe(true);
    });
    it.each(arms.map((a) => [a.arm, a]))('%s: the model replays the game\'s stream, and agrees on the flag', (name, a) => {
        const game = ORACLE.arms.find((r) => r.arm === name);
        const model = runTape(a.tape, { levelSource: SRC });
        expect(compactTicks(model.ticks)).toEqual(game.ticks);
        expect(model.transitions).toEqual(game.transitions);
        expect(game.gameFlag).toBe(a.flagExpected);
        expect(modelWrote(a.tape, a.w.goal.tag, SRC)).toBe(game.gameFlag);
    });
});
