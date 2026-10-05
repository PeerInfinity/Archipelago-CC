/**
 * Seedling fidelity STEP-OFF: an exit tile re-triggers only after the player
 * STEPS OFF it.
 *
 *   · D1/D2 (the model): `Teleporter.check()` latches the door an arrival
 *     stands on (`playerTouching`), and `update()` clears it on the first update
 *     the box is off the rect. The model has carried it since R0
 *     (`playerPhysicsV2.initialLatch` / `updateTeleporters`, `state.latched`,
 *     armed at every `new Game`: boot, crossing, respawn). The game's side:
 *     `fixtures/stepoff-oracle.json` (`probe-seedling-stepoff.mjs --record`),
 *     nine arms over two teleporters and one stairs door; every row here
 *     replays the very tape the game played and must give the game's stream.
 *   · D3 (the solver): a `reach-exit` whose door is the one the run stands
 *     latched on plans a STEP-OFF first (the nearest standable cell ringing
 *     the door), then the crossing; a door no standable cell rings refuses as
 *     `closed`, by name.
 *
 * ── THE MUTATION LIST (run during development, each predicted first) ──
 *   m1 `initialLatch` returns an empty set (the guard removed)
 *        -> every STAND and SHORT arm crosses on t1 (the old, wrong immediate
 *           transition); the MIN arms cross on t1 too; the latch rows red.
 *   m2 the solver's step-off skipped (D3)
 *        -> the solver rows refuse with the old stall words.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { runTape, createRunForStaging } from './tapeRunner.js';
import { initialLatch } from './playerPhysicsV2.js';
import { buildLevelWorld } from './levelWorld.js';
import { STEPOFF_DOORS, stepOffArms, stepOffSolverArm, stepOffStagingAt, compactTicks } from './fidelityStepOff.js';
import { solveSegment } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'stepoff-oracle.json'), 'utf8'));
const SRC = atlasLevelSource();
const ARMS = stepOffArms();
const oracleArm = (arm) => ORACLE.arms.find((r) => r.arm === arm);

describe('fidelity STEP-OFF — D1: the game\'s rule, measured', () => {
    it('the oracle holds every arm, recorded clean (no error, no hit)', () => {
        expect(ORACLE.arms.map((r) => r.arm)).toEqual([...ARMS.map((a) => a.arm), ...STEPOFF_DOORS.map((d) => `SOLVER-${d.door}`)]);
        for (const r of ORACLE.arms) expect([r.arm, r.error, r.hits]).toEqual([r.arm, '', 0]);
    });
    it.each(STEPOFF_DOORS.map((d) => [d.door, d]))('%s: the arrival boots LATCHED on its own door, and only that one', (_, d) => {
        const run = createRunForStaging(stepOffStagingAt(d.boot), SRC);
        const latched = [...run.state.latched].map((i) => run.world.teleporters[i]);
        expect(latched.map((tp) => [tp.x, tp.y, Boolean(tp.isStairs)])).toEqual([[d.exit.x, d.exit.y, d.stairs]]);
    });
    it('on the GAME: standing never crosses, nMin - 1 away never crosses, nMin away crosses on the way back', () => {
        const rows = ARMS.map((a) => [a.arm, oracleArm(a.arm).transitions.length > 0]);
        expect(rows).toEqual(ARMS.map((a) => [a.arm, a.expect.crosses]));
    });
    it('on the GAME: the crossing tick after a step-off (L87 t13, L106 t12, L17 stairs t13)', () => {
        expect(['L87-teleporter-MIN', 'L106-teleporter-MIN', 'L17-stairs-MIN']
            .map((a) => oracleArm(a).transitions[0])).toEqual([
            { t: 13, from_level: 87, to_level: 88 },
            { t: 12, from_level: 106, to_level: 101 },
            { t: 13, from_level: 17, to_level: 16 },
        ]);
    });
});

describe('fidelity STEP-OFF — D2: the model carries the guard (every game arm, row for row)', () => {
    it.each(ARMS.map((a) => [a.arm, a]))('%s: the model\'s stream and transitions are the game\'s', (_, a) => {
        const model = runTape(a.tape, { levelSource: SRC });
        const game = oracleArm(a.arm);
        expect(model.transitions).toEqual(game.transitions);
        expect(compactTicks(model.ticks)).toEqual(game.ticks);
    });
    it('the latch is geometry: the arrival box overlaps the 16x16 door rect (positive area)', () => {
        for (const d of STEPOFF_DOORS) {
            const world = buildLevelWorld(SRC(d.boot.level));
            expect([...initialLatch(world, d.boot.x + 8, d.boot.y + 8)].length, d.door).toBe(1);
            // One tile off the door is not latched.
            expect([...initialLatch(world, d.boot.x + 8 + 16, d.boot.y + 8)].length, d.door).toBe(0);
        }
    });
});

/**
 * Every arrival `jsRuntimeArrivalOnDoor`'s ARRIVALS_ON_A_DOOR names, solved for
 * `reach-exit` on the door it stands latched on, from a fresh JS-runtime
 * staging. `crosses` SOLVES now (step-off, then the walk back); the rest refuse,
 * each by a true name.
 */
const SOLVER_ROWS = [
    ['3|96|128', 'closed', /: closed — the run stands LATCHED on teleporter@96,128 in level 3 /],
    ['34|128|0', 'lock', /: closed — the run stands LATCHED on teleporter@128,0 in level 34 /],
    ['37|576|144', 'closed', /: closed — the run stands LATCHED on stairs@576,144 in level 37 /],
    ['43|144|64', 'pit', /the teleporter at \(144,64\) in level 43 stands ON a PIT tile/],
    ['58|80|16', 'deactivated', /the teleporter at \(80,16\) in level 58 is DEACTIVATED/],
    ['87|432|304', 'crosses', { to: 88, ticks: 32, door: 'teleporter@432,304', off: { x: 440, y: 296 } }],
    ['100|288|96', 'pit', /the teleporter at \(288,96\) in level 100 stands ON a PIT tile/],
    ['101|96|16', 'crosses', { to: 110, ticks: 39, door: 'teleporter@104,24', off: { x: 104, y: 8 } }],
    ['102|224|96', 'crosses', { to: 107, ticks: 33, door: 'teleporter@224,96', off: { x: 216, y: 104 } }],
    ['106|64|48', 'crosses', { to: 101, ticks: 33, door: 'teleporter@64,48', off: { x: 56, y: 56 } }],
    ['109|160|48', 'crosses', { to: 101, ticks: 33, door: 'teleporter@160,48', off: { x: 152, y: 56 } }],
];

describe('fidelity STEP-OFF — D3: the solver steps off a latched door before crossing it', () => {
    it.each(SOLVER_ROWS)('%s (%s)', (key, kind, want) => {
        const [level, x, y] = key.split('|').map(Number);
        const run = createRunForStaging(stepOffStagingAt({ level, x, y }), SRC);
        const [index] = [...run.state.latched];
        const tp = run.world.teleporters[index];
        const solve = () => solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }],
            name: `stepoff-${key}`, boot: { level, x, y } });
        if (kind !== 'crosses') {
            expect(solve).toThrow(want);
            return;
        }
        const out = solve();
        expect(run.level).toBe(want.to);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(out.perTick).toHaveLength(want.ticks);
        expect(out.records).toHaveLength(1);
        expect(out.records[0]).toMatchObject({ goal: 'reach-exit', to: want.to, stepOff: { door: want.door, to: want.off, from: 0 } });
        expect(out.trace.rows.map((r) => r.strategy?.verb).filter(Boolean)).toEqual(['step-off', 'walk']);
    });
    it('a door the run is NOT latched on crosses with no step-off (the record carries no `stepOff`)', () => {
        const run = createRunForStaging(stepOffStagingAt({ level: 87, x: 432, y: 288 }), SRC);
        expect([...run.state.latched]).toEqual([]);
        const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 432, y: 304 } }],
            name: 'stepoff-control', boot: { level: 87, x: 432, y: 288 } });
        expect(run.level).toBe(88);
        expect(out.records[0].stepOff).toBeUndefined();
    });
    it.each(STEPOFF_DOORS.map((d) => [`SOLVER-${d.door}`, d]))('%s: the game played the solver\'s plan and crossed; the model\'s stream is the game\'s', (_, d) => {
        const a = stepOffSolverArm(d, SRC);
        const game = oracleArm(a.arm);
        expect(game.transitions).toHaveLength(1);
        expect(game.transitions[0]).toMatchObject({ from_level: a.door.boot.level, t: a.tape.tick_count });
        const model = runTape(a.tape, { levelSource: SRC });
        expect(model.transitions).toEqual(game.transitions);
        expect(compactTicks(model.ticks)).toEqual(game.ticks);
        expect(a.out.records[0].stepOff).toMatchObject({ from: 0, ticks: 26 });
    });
});
