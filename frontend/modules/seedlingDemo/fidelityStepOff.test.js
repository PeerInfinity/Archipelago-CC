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
 *   ⛓ STEPOFF2 (predicted, then measured; copy + restore, md5-identical):
 *   m3 `stepOffMinimalFor` offers no candidate (STEP-OFF's tile-centre walk only)
 *        -> 18 red: the 9 `crosses` rows (L12/L65 refuse `closed` again, the
 *           rest re-time to 32-39 t), L37 reads `closed` (no lava named), the
 *           nMin row, the sub-pixel row, the Sword row and all six SOLVER
 *           arms' game streams.
 *   m4 the D3 break never tried
 *        -> 5 red: the Sword row, SOLVER-L3-pocket-sword, the sub-pixel row
 *           (its L3 arm throws), and the bare L3 rows' `break` consideration.
 *   m5 the walk back through `walkTo` (no `returnOntoDoor`)
 *        -> 1 red: L83 (the planner's A* starts on cliffside0's tile).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { runTape, createRunForStaging } from './tapeRunner.js';
import { initialLatch, playerBoxAt } from './playerPhysicsV2.js';
import { buildLevelWorld } from './levelWorld.js';
import { STEPOFF_DOORS, STEPOFF2_DOORS, stepOffArms, stepOffSolverArm, stepOffStagingAt, compactTicks } from './fidelityStepOff.js';
import { solveSegment } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'stepoff-oracle.json'), 'utf8'));
const SRC = atlasLevelSource();
const ARMS = stepOffArms();
const oracleArm = (arm) => ORACLE.arms.find((r) => r.arm === arm);

/**
 * ⛓ STEPOFF2 — hits the game's END status counts that land AFTER the arm's
 * crossing, in the next room, outside every observed tick. SOLVER-L17-stairs
 * crosses at t12 and arrives in L16 at (120,56), inside `arrowtrap@112,32`'s
 * lane: the game, played on with an idle tail, stands the player there t12-t17
 * and knocks it back from t18 (measured). The probe reads `hits` after the
 * tape's latch, so the count is L16's, not the plan's: the arm's 13
 * observations are the model's to 0 px. (STEP-OFF's 32-tick plan arrived on a
 * different phase of the trap and read 0.)
 */
const POST_CROSSING_HITS = { 'SOLVER-L17-stairs': 1 };

describe('fidelity STEP-OFF — D1: the game\'s rule, measured', () => {
    it('the oracle holds every arm, recorded clean (no error, no hit)', () => {
        expect(ORACLE.arms.map((r) => r.arm)).toEqual([...ARMS.map((a) => a.arm),
            ...[...STEPOFF_DOORS, ...STEPOFF2_DOORS].map((d) => `SOLVER-${d.door}`)]);
        for (const r of ORACLE.arms) expect([r.arm, r.error, r.hits]).toEqual([r.arm, '', POST_CROSSING_HITS[r.arm] ?? 0]);
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
/**
 * ⛓ STEPOFF2 — the step-off is MINIMAL now (`stepOffMinimalFor`: one axis held
 * until the box clears the rect, then straight back), so every `crosses` row
 * is 5-13 ticks where STEP-OFF's tile-centre walk was 32-39, and `off` is the
 * first position off the rect (sub-pixel). The refusals carry truer names:
 * L34's magical lock and L37's lava are no longer `closed`.
 */
const SOLVER_ROWS = [
    ['3|96|128', 'closed', /: closed — the run stands LATCHED on teleporter@96,128 in level 3 .* Considered: .*break breakablerock@96,112 — the run's `primary` slot holds NOTHING/],
    ['34|128|0', 'lock', /: inside-solid — the run stands LATCHED on teleporter@128,0 in level 34 with its box INSIDE magicallock@128,0/],
    ['37|576|144', 'closed', /: hazard-floor — every way off stairs@576,144's rect crosses lava the run cannot stand on \(lava without the dark suit\); without that, closed — the run stands LATCHED on stairs@576,144 in level 37 /],
    ['43|144|64', 'pit', /the teleporter at \(144,64\) in level 43 stands ON a PIT tile/],
    ['58|80|16', 'deactivated', /the teleporter at \(80,16\) in level 58 is DEACTIVATED/],
    ['87|432|304', 'crosses', { to: 88, ticks: 13, door: 'teleporter@432,304', dir: 'up', off: { x: 440, y: 300.85 } }],
    ['100|288|96', 'pit', /the teleporter at \(288,96\) in level 100 stands ON a PIT tile/],
    // L101's boot box overlaps its door by 2 px only: 2 ticks left clear it.
    ['101|96|16', 'crosses', { to: 110, ticks: 5, door: 'teleporter@104,24', dir: 'left', off: { x: 101.85000000000001, y: 24 } }],
    ['102|224|96', 'crosses', { to: 107, ticks: 12, door: 'teleporter@224,96', dir: 'left', off: { x: 221.8, y: 104 } }],
    ['106|64|48', 'crosses', { to: 101, ticks: 12, door: 'teleporter@64,48', dir: 'down', off: { x: 72, y: 66.2 } }],
    ['109|160|48', 'crosses', { to: 101, ticks: 12, door: 'teleporter@160,48', dir: 'down', off: { x: 168, y: 66.2 } }],
    // ⛓ STEPOFF2, D2 — the doors no tile CENTRE rings (a half-tile door) open to the sub-pixel hold.
    ['12|40|688', 'crosses', { to: 24, ticks: 12, door: 'teleporter@40,688', dir: 'down', off: { x: 48, y: 706.2 } }],
    ['65|184|64', 'crosses', { to: 68, ticks: 12, door: 'teleporter@184,64', dir: 'down', off: { x: 192, y: 82.2 } }],
    // The walk BACK is straight back (`returnOntoDoor`): the planner, asked from L83's sub-pixel
    // stance west of the door, starts its A* on cliffside0's tile and finds no corridor.
    ['83|32|64', 'crosses', { to: 12, ticks: 12, door: 'teleporter@32,64', dir: 'left', off: { x: 29.800000000000004, y: 72 } }],
    ['66|72|64', 'inside-solid', /: inside-solid — the run stands LATCHED on teleporter@72,64 in level 66 with its box INSIDE bosslock@72,64/],
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
        expect(out.records[0]).toMatchObject({ goal: 'reach-exit', to: want.to,
            stepOff: { door: want.door, dir: want.dir, to: want.off, from: 0 } });
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
    it.each([...STEPOFF_DOORS, ...STEPOFF2_DOORS].map((d) => [`SOLVER-${d.door}`, d]))('%s: the game played the solver\'s plan and crossed; the model\'s stream is the game\'s', (_, d) => {
        const a = stepOffSolverArm(d, SRC);
        const game = oracleArm(a.arm);
        expect(game.transitions).toHaveLength(1);
        expect(game.transitions[0]).toMatchObject({ from_level: a.door.boot.level, t: a.tape.tick_count });
        const model = runTape(a.tape, { levelSource: SRC });
        expect(model.transitions).toEqual(game.transitions);
        expect(compactTicks(model.ticks)).toEqual(game.ticks);
        const stepOff = a.out.records.find((r) => r.stepOff)?.stepOff;
        expect([stepOff.door, stepOff.dir, stepOff.ticks, a.tape.tick_count]).toEqual(SOLVER_ARM_PLANS[a.door.door]);
    });
});

/** STEPOFF2 — each solver arm's plan: the door, the axis held, its ticks, and the whole tape. */
const SOLVER_ARM_PLANS = {
    'L87-teleporter': ['teleporter@432,304', 'up', 10, 13],
    'L106-teleporter': ['teleporter@64,48', 'down', 9, 12],
    'L17-stairs': ['stairs@32,48', 'down', 9, 12],
    'L12-teleporter-40-688': ['teleporter@40,688', 'down', 9, 12],
    'L65-teleporter-184-64': ['teleporter@184,64', 'down', 9, 12],
    'L3-pocket-sword': ['teleporter@96,128', 'up', 9, 34],
};

describe('fidelity STEPOFF2 — D1: the minimal step-off is the game\'s own minimum', () => {
    it('L87: the solver holds up exactly D1\'s nMin (10) and crosses on the MIN arm\'s tick (13)', () => {
        const a = stepOffSolverArm(STEPOFF_DOORS[0], SRC);
        expect(a.out.records[0].stepOff.ticks).toBe(STEPOFF_DOORS[0].nMin);
        expect(oracleArm('SOLVER-L87-teleporter').transitions).toEqual(oracleArm('L87-teleporter-MIN').transitions);
    });
    it('every solver arm\'s step-off ends with the box OFF the rect by less than one pixel', () => {
        for (const d of [...STEPOFF_DOORS, ...STEPOFF2_DOORS]) {
            const a = stepOffSolverArm(d, SRC);
            const { to } = a.out.records.find((r) => r.stepOff).stepOff;
            const run = createRunForStaging(stepOffStagingAt(d.boot, d.items ?? []), SRC);
            const r = run.world.teleporters.find((tp) => tp.x === d.exit.x && tp.y === d.exit.y).rect;
            const box = playerBoxAt(to.x, to.y);
            const gap = Math.max(r.x - box.right, box.x - r.right, r.y - box.bottom, box.y - r.bottom);
            expect([d.door, gap >= 0 && gap < 1]).toEqual([d.door, true]);
        }
    });
});

describe('fidelity STEPOFF2 — D3: L3\'s pocket opens to the Sword (break, then step off)', () => {
    it('with the Sword: break breakablerock@96,112 from the door, step off up, cross to L11 (34 t, no death)', () => {
        const run = createRunForStaging(stepOffStagingAt({ level: 3, x: 96, y: 128 }, ['hasSword']), SRC);
        const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 128 } }],
            name: 'stepoff2-l3-sword', boot: { level: 3, x: 96, y: 128 } });
        expect(run.level).toBe(11);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(out.perTick).toHaveLength(34);
        expect(out.records.map((r) => r.strategy ?? r.goal)).toEqual(['break', 'reach-exit']);
        expect(out.records[0]).toMatchObject({ target: 'breakablerock@96,112', from: 0 });
        expect(out.trace.rows.map((r) => r.strategy?.verb).filter(Boolean)).toEqual(['break', 'step-off', 'walk']);
    });
    it('without a weapon: `closed`, the break named and refused, nothing pressed', () => {
        const run = createRunForStaging(stepOffStagingAt({ level: 3, x: 96, y: 128 }), SRC);
        let err = null;
        try {
            solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 128 } }], name: 'stepoff2-l3-bare',
                boot: { level: 3, x: 96, y: 128 } });
        } catch (e) { err = e; }
        expect(err?.obstacle).toMatchObject({ kind: 'closed', id: 'teleporter@96,128' });
        expect(err.considered.map((c) => c.option)).toContain('break breakablerock@96,112');
        expect(run.ticksCompleted).toBe(0);
    });
});
