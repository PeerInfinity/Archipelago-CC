/**
 * Seedling fidelity ARRIVAL: an arrival INSIDE a solid — the model knows the
 * saved state, and the solver refuses by name with the way out.
 *
 * ⚖ The user (2026-10-05): *"Arrival inside a solid should only happen if we
 * play the game out of order. The proper fix for this might be to restart
 * using the menu, or just take a different path. The broken state of some
 * obstacles is saved in the save data."*
 *
 *   · D1 (the game): `fixtures/arrival-solid-oracle.json`
 *     (`probe-seedling-arrival-solid.mjs --record`, p4f) — four GAME landings
 *     whose box overlaps a solid a saved flag removes, booted with the flag
 *     HELD (never broken: the out-of-order arrival) and CLEARED, standing and
 *     holding each cardinal; and the two rock landings with the Sword pressed
 *     once. Every row here replays the very tape the game played.
 *   · D1(c)/D2 (the census): `arrivalSolidCensus` — every game landing in the
 *     map whose box overlaps such a solid, with the model's verdict in each
 *     save state.
 *   · D3 (the solver): `solveSegment` refuses an arrival inside a solid BEFORE
 *     any search, `obstacle.kind: 'arrival-inside-solid'`, with the flag that
 *     would remove it and `wayOut` (the Menu's Restart, other arrivals); with
 *     the flag cleared the same arrival solves as before.
 *   · D4: `fixtures/arrival-solid-edges.json` is the census's edge table.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 the D3 entry check removed (`arrivalInsideSolid` never consulted)
 *        -> the solver rows red (L0 refuses as `solid` / `no REACHABLE stance`
 *           again; L66's latched boot reads STEPOFF2's `inside-solid` kind), the
 *           census's solver column, and the edge fixture.
 *   m2 the build ignores a cleared breakable rock (`clearedAwayByTag` false
 *      for `despawn`)
 *        -> every CLEARED arm whose landing is a rock replays STUCK where the
 *           game walked: the oracle rows catch a model that does not know the
 *           saved state.
 *   m3 `modelStuck` reads every box as free
 *        -> the census's STUCK column and the solver rows red (the check
 *           refuses only a box that cannot move).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { runTape, createRunForStaging } from './tapeRunner.js';
import { compactTicks } from './fidelityStepOff.js';
import {
    ARRIVAL_SOLID_LANDINGS, arrivalArms, arrivalSolidCensus, arrivalEdgeTable, arrivalStaging,
} from './fidelityArrival.js';
import { arrivalInsideSolid } from './arrivalSolid.js';
import { solveSegment, SolverRefusal } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'arrival-solid-oracle.json'), 'utf8'));
const EDGES = JSON.parse(readFileSync(join(HERE, 'fixtures', 'arrival-solid-edges.json'), 'utf8'));
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const SRC = atlasLevelSource();
const oracleArm = (arm) => ORACLE.arms.find((r) => r.arm === arm);
const travel = (ticks) => ticks.reduce((m, [, , x, y]) => Math.max(m, Math.abs(x - ticks[0][2]), Math.abs(y - ticks[0][3])), 0);

describe('fidelity ARRIVAL — D1: the game, a landing inside a solid', () => {
    const arms = arrivalArms();
    it('the oracle holds every arm (four landings; held/cleared × stand + 4 holds; 2 Sword presses)', () => {
        expect(ORACLE.arms.map((a) => a.arm)).toEqual(arms.map((a) => a.arm));
        expect(arms).toHaveLength(42);
    });
    it.each(arms.filter((a) => a.hold !== 'press').map((a) => [a.arm, a]))('%s: the model replays the game\'s stream, 0 px', (_, a) => {
        const game = oracleArm(a.arm);
        const model = runTape(a.tape, { levelSource: SRC });
        expect(compactTicks(model.ticks)).toEqual(game.ticks);
        expect(model.transitions).toEqual(game.transitions);
    });
    it.each(arms.filter((a) => a.hold !== 'press').map((a) => [a.arm, a]))('%s: the game\'s verdict (flag held: no step; cleared: it walks)', (_, a) => {
        const game = oracleArm(a.arm);
        if (!a.cleared || a.hold === 'stand') expect(travel(game.ticks)).toBe(0);
        else expect(travel(game.ticks)).toBeGreaterThan(0);
    });
    it('each cleared landing walks out through a door in one direction (the obstacle was the only wall)', () => {
        const crossing = ORACLE.arms.filter((a) => a.cleared && a.transitions.length > 0).map((a) => a.arm);
        expect(crossing).toEqual(['L0-from-L12-CLEARED-right', 'L0-from-L1-CLEARED-up',
            'L24-from-L12-CLEARED-down', 'L113-from-L115-CLEARED-up']);
    });
    /**
     * ⚠ THE PRESS FROM INSIDE (game evidence, NOT a strategy — ⚖ 2026-10-05):
     * the game breaks the rock on one Sword press from inside (its own
     * `persistence_cleared` names the flag) and the player then walks. The
     * model breaks it too but frees the box two ticks early (it moves on
     * observation 8, the game on 10): pinned here as RESIDUE so a fix reads.
     */
    it.each(ARRIVAL_SOLID_LANDINGS.filter((l) => l.press !== false).map((l) => [l.key, l]))('%s: one Sword press from inside breaks the rock in the game; the model frees it 2 ticks early (residue)', (_, l) => {
        const game = oracleArm(`${l.key}-HELD-press-sword`);
        expect(game.persistenceCleared).toEqual([{ tag: l.tag, level: l.boot.level }]);
        expect(travel(game.ticks)).toBeGreaterThan(0);
        expect(game.ticks.findIndex(([, , x, y]) => x !== game.ticks[0][2] || y !== game.ticks[0][3])).toBe(10);
        expect(game.vsModel.first).toBe(8);
        const a = arrivalArms().find((x) => x.arm === `${l.key}-HELD-press-sword`);
        const model = runTape(a.tape, { levelSource: SRC });
        expect(model.rocksBroken).toEqual([expect.objectContaining({ id: l.solid, tag: l.tag, goneAt: 8 })]);
    });
});

/** Every game landing whose box overlaps a solid a saved flag decides: `level|x|y solid`. */
const CENSUS = [
    '0|80|112 breakablerock@80,112',
    '0|288|176 breakablerock@288,176',
    '24|48|128 burnabletree@32,128',
    '71|288|256 shieldlock@288,256',
    '12|32|864 magicallock@32,864',
    '12|32|864 bosslock@32,864',
    '112|112|16 rocklock@112,16',
    '112|112|16 rocklock@112,16',
    '113|112|16 finaldoor@112,0',
    '113|128|16 finaldoor@112,0',
];

describe('fidelity ARRIVAL — D1(c)/D2: the census, the model in each save state', () => {
    const rows = arrivalSolidCensus(MAP, SRC, { solve: true });
    it('ten (landing, solid) rows: ten doors, eight landing positions', () => {
        expect(rows.map((r) => `${r.landing.level}|${r.landing.x}|${r.landing.y} ${r.solid}`)).toEqual(CENSUS);
    });
    it('flag HELD: every row is inside and stuck (every cardinal hold moves 0 px)', () => {
        for (const r of rows) {
            expect(r.flagHolds).toMatchObject({ inside: true, stuck: true });
            expect(Object.values(r.flagHolds.moved)).toEqual([0, 0, 0, 0]);
        }
    });
    it('flag CLEARED: the solid is gone from the build; the box walks — except L12\'s stacked locks, free only with BOTH flags', () => {
        for (const r of rows) {
            expect(r.flag, r.solid).not.toBeNull();
            expect(r.flagCleared.inside, r.solid).toBe(false);
            const stacked = r.landing.level === 12;
            expect(r.flagCleared.stuck, r.solid).toBe(stacked);
            if (stacked) expect(r.allCleared).toEqual({ tags: [7, 12], inside: false, stuck: false });
        }
    });
    it('the solver refuses every row by NAME before any search (`arrival-inside-solid`)', () => {
        expect(rows.map((r) => r.solver?.kind)).toEqual(rows.map(() => 'arrival-inside-solid'));
    });
    it('D4: the committed edge table is the census\'s', () => {
        expect(EDGES.edges).toEqual(arrivalEdgeTable(MAP, rows));
    });
});

const solveFrom = (boot, { items = [], cleared = [] } = {}, exit) => {
    const run = createRunForStaging(arrivalStaging(boot, { items, cleared }), SRC);
    return { run, solve: () => solveSegment({ run, goals: [{ kind: 'reach-exit', exit }],
        name: `arrival-${boot.level}-${boot.x}-${boot.y}`, boot }) };
};

describe('fidelity ARRIVAL — D3: the solver knows the state and refuses by name with the way out', () => {
    it('L12 -> L0 (288,176) with the Sword, rock unbroken: `arrival-inside-solid`, the flag, the Restart, the other arrivals', () => {
        const { solve } = solveFrom({ level: 0, x: 288, y: 176 }, { items: ['hasSword'] }, { x: 304, y: 176 });
        let e = null;
        try { solve(); } catch (err) { e = err; }
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toMatch(/: arrival-inside-solid — the run's box at \(296,184\) in level 0 is INSIDE breakablerock@288,176 and no cardinal hold moves it/);
        expect(e.message).toMatch(/persistence \{level 0, tag 1\} still holds — it is cleared when the obstacle is broken by a sword strike \(hasSword\)/);
        expect(e.message).toMatch(/Way out: Restart from the Menu \(`seedlingStartSpawn`\), or another route into level 0 \(L2 stairs@48,16 -> \(264,264\), /);
        expect(e.perTick).toEqual([]);
        expect(e.rows).toEqual([]);
        expect(e.obstacle).toMatchObject({
            kind: 'arrival-inside-solid', id: 'breakablerock@288,176', solids: ['breakablerock@288,176'],
            flags: [{ solid: 'breakablerock@288,176', level: 0, tag: 1, action: 'broken by a sword strike', item: 'hasSword' }],
            at: { level: 0, x: 296, y: 184 },
        });
        expect(e.obstacle.wayOut[0]).toMatchObject({ kind: 'restart', via: 'seedlingStartSpawn' });
        // L1's landing is itself inside `breakablerock@80,112`: it is NOT another route.
        expect(e.obstacle.wayOut[1].arrivals.map((a) => `L${a.from} ${a.door}`)).toEqual([
            'L2 stairs@48,16', 'L13 stairs@64,144', 'L86 teleporter@48,64', 'L89 teleporter@160,304',
            'L94 teleporter@304,160', 'L94 teleporter@304,176']);
    });
    it('the same arrival with the flag CLEARED solves as before (5 t, into L12)', () => {
        const { run, solve } = solveFrom({ level: 0, x: 288, y: 176 }, { items: ['hasSword'], cleared: [1] }, { x: 304, y: 176 });
        const out = solve();
        expect(run.level).toBe(12);
        expect(out.perTick).toHaveLength(5);
    });
    it('L1 -> L0 (80,112) bare: the same refusal, and the rock at (288,176) is not another route either', () => {
        const { solve } = solveFrom({ level: 0, x: 80, y: 112 }, {}, { x: 64, y: 112 });
        let e = null;
        try { solve(); } catch (err) { e = err; }
        expect(e.obstacle).toMatchObject({ kind: 'arrival-inside-solid', id: 'breakablerock@80,112',
            flags: [{ level: 0, tag: 4 }] });
        expect(e.obstacle.wayOut[1].arrivals.some((a) => a.from === 12 || a.from === 1)).toBe(false);
    });
    it('STEPOFF2\'s latched boot under a lock refuses here first, its words kept (`Latched: inside-solid — …`)', () => {
        const run = createRunForStaging(arrivalStaging({ level: 66, x: 72, y: 64 }), SRC);
        let e = null;
        try {
            solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 72, y: 64 } }], name: 'arrival-l66', boot: { level: 66, x: 72, y: 64 } });
        } catch (err) { e = err; }
        expect(e.message).toMatch(/: inside-solid — the run stands LATCHED on teleporter@72,64 in level 66 with its box INSIDE bosslock@72,64/);
        expect(e.obstacle).toMatchObject({ kind: 'arrival-inside-solid', latchedOn: 'teleporter@72,64', solids: ['bosslock@72,64'],
            flags: [{ level: 66, tag: 0, item: 'hasKey' }] });
    });
    it('a box that is not inside a solid is not this state (the control: a free landing)', () => {
        const run = createRunForStaging(arrivalStaging({ level: 0, x: 288, y: 176 }, { cleared: [1] }), SRC);
        expect(arrivalInsideSolid(run)).toBeNull();
    });
});
