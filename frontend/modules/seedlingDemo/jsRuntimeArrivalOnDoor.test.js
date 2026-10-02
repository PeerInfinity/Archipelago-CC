/**
 * jsRuntimeArrivalOnDoor — an ARRIVAL that stands the player INSIDE the goal's
 * teleporter (solver-walk S5; plan `seedling-js-solver-walk-plan.md` §3 S5,
 * §1.3's "L3 r8c6: both the walker and the solver stall on the spawn cell").
 *
 * A teleporter fires only on an ENTRY (`Teleporter.check()` latches the one a
 * boot stands on; `playerPhysicsV2.updateTeleporters` clears it the tick the box
 * is off). A walk to a point the player already stands on is zero-length, so
 * the walker steps OFF to the nearest standable cell clear of every teleporter
 * and back ON; while it is latched the solver mode hands the goal to the walker
 * (`solverGoalFor` → `{walker}`), then solves the walk back.
 *
 * The rows are DERIVED from the committed presets: every Seedling vanilla
 * arrival the region binding resolves (`resolveArrivalSpawn`, the return-spawn
 * table) is booted and its latch read (`initialLatch` at `spawnFromBoot`, the
 * model's own). `ARRIVALS_ON_A_DOOR` must name exactly that set, so a new preset
 * that lands on a door enrols here and fails until it is classified.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 resolve ignores the latch (no step-off)
 *        -> every 'crosses' row and the L3 round trip red (stalls on the door)
 *   m2 a step-off candidate need not END on its cell (the planner's snap)
 *        -> 'a CLOSED pocket fails by name' reds (L3 walks to the off-map
 *           (104,152), which the planner snaps back onto the door)
 *   m3 `solverGoalFor` maps a latched exit to the solver
 *        -> the ON rows red (the solver's corridor stalls on the door and
 *           declines: `declines` 0 fails)
 *   m4 the step-off cell may overlap ANOTHER teleporter
 *        -> 'no step-off cell overlaps a teleporter' reds
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { WALK_STATES, stepOffPoint } from './jsRuntimeWalker.js';
import { replayShadow, runDigest, solverGoalFor } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { initialLatch, playerBoxAt } from './playerPhysicsV2.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import { rectsOverlap, TILE_SIZE } from './levelWorld.js';
import { returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';
import { resolveArrivalSpawn } from '../flashPanel/seedlingRegionBinding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const RETURNS = returnSpawnTable(MAP);
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

/**
 * Every committed arrival that boots LATCHED on a door, by `level|x|y` (the
 * arrival's OEL spawn), and what the bot does there. `crosses`: steps off and
 * back on, solver ON and OFF. `closed`: no standable cell rings the door — a
 * named refusal at once. The rest are the ARRIVAL's, not the walk's: the
 * binding's `entrance_spawn` fallback lands on a door tile the game never
 * lands on (`lock`: a magical lock's solid over it, the player cannot move;
 * `pit`: the door stands over a pit, every boot falls; `deactivated`: a door
 * that is not live, refused as "no live teleporter").
 */
const ARRIVALS_ON_A_DOOR = {
    '3|96|128': 'closed',        // L11 → L3: the pocket under breakablerock@96,112 (bare); the round trip below opens it
    '34|128|0': 'lock',
    '37|576|144': 'closed',      // L97's stairs → L37: ringed by lava
    '43|144|64': 'pit',
    '58|80|16': 'deactivated',
    '87|432|304': 'crosses',
    '100|288|96': 'pit',
    '101|96|16': 'crosses',
    '102|224|96': 'crosses',
    '106|64|48': 'crosses',
    '109|160|48': 'crosses',
};

/**
 * One booted world per level. The latch is geometry (`initialLatch`), so any
 * arrival that boots the level serves; an arrival whose own first tick HALTS
 * (L112's Owl `rng.split`, a J3 HALT-roster row) does not condemn the level —
 * the next arrival is tried. Null only while no arrival of it has booted.
 */
const worlds = new Map();
function worldOf(level, x, y) {
    if (!worlds.get(level)) {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
        rt.tick();
        worlds.set(level, rt.run && rt.halted === null ? rt.run.world : null);
    }
    return worlds.get(level);
}

/** Every Seedling vanilla arrival of every committed preset: `{key, preset, region, exitId, level, x, y}`. */
function committedArrivals() {
    const out = [];
    const dir = join(ROOT, 'frontend/presets');
    for (const preset of readdirSync(dir)) {
        const f = join(dir, preset, 'AP_1/AP_1_rules.json');
        if (!existsSync(f)) continue;
        const side = JSON.parse(readFileSync(f, 'utf8')).preset_sidecars?.['1'] ?? {};
        for (const [region, v] of Object.entries(side)) {
            const pl = v?.playable_payload;
            if (!pl || pl.gameId !== 'seedling' || pl.generated) continue;
            for (const ex of pl.exits ?? []) {
                const s = resolveArrivalSpawn(pl, { exit_id: ex.exit_id }, RETURNS);
                if (s) out.push({ key: `${s.level}|${s.x}|${s.y}`, preset, region, exitId: ex.exit_id, payload: pl, ...s });
            }
        }
    }
    return out;
}

/** A runtime booted at an OEL spawn, optionally with items. */
function bootAt(level, x, y, items = []) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    if (items.length) rt.queueItems(items.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick();
    return rt;
}

/** Walk `goal` with the solver ON or OFF until it settles; the crossings seen. */
function walk(rt, goal, solver, maxTicks = 3000) {
    rt.playback.setSolverWalk(solver);
    expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
    rt.playback.play();
    const crossings = [];
    let t = 0;
    for (; t < maxTicks && !SETTLED.includes(rt.playback.state); t += 1) {
        const out = rt.tick();
        if (out.crossing) crossings.push(out.crossing);
    }
    return { crossings, ticks: t };
}

/** The door the run stands latched on, as an exit goal over its tile. */
function latchedDoorGoal(rt) {
    const [index] = [...rt.run.state.latched];
    const tp = rt.run.world.teleporters[index];
    return { tp, goal: { kind: 'exit', level: rt.run.level, tiles: [[Math.floor(tp.x / TILE_SIZE), Math.floor(tp.y / TILE_SIZE)]] } };
}

const ARRIVALS = committedArrivals();
const ON_A_DOOR = new Map();
const HALTED = new Set();
for (const a of ARRIVALS) worldOf(a.level, a.x, a.y);
for (const a of ARRIVALS) {
    const world = worlds.get(a.level);
    if (!world) { HALTED.add(a.level); continue; }
    const spawn = spawnFromBoot(a);
    if (initialLatch(world, spawn.x, spawn.y).size > 0 && !ON_A_DOOR.has(a.key)) ON_A_DOOR.set(a.key, a);
}

describe('S5 — the committed arrivals that land ON a door (derived)', () => {
    it('the set is exactly ARRIVALS_ON_A_DOOR (a new one enrols here)', () => {
        expect(ARRIVALS.length).toBeGreaterThan(200);
        expect([...ON_A_DOOR.keys()].sort()).toEqual(Object.keys(ARRIVALS_ON_A_DOOR).sort());
    });
    it('the only levels no committed arrival can boot are the model\'s HALT rows (L40 at boot, L112 the Owl; the swim arc\'s)', () => {
        expect([...HALTED].sort((a, b) => a - b)).toEqual([40, 112]);
    });
});

describe('S5 — step off and back on: the bot crosses from the arrival', () => {
    const crossing = Object.entries(ARRIVALS_ON_A_DOOR).filter(([, kind]) => kind === 'crosses').map(([k]) => k);
    for (const key of crossing) {
        for (const solver of [false, true]) {
            it(`${key} → the latched door, solver ${solver ? 'ON' : 'OFF'}`, () => {
                const [level, x, y] = key.split('|').map(Number);
                const rt = bootAt(level, x, y);
                const { tp, goal } = latchedDoorGoal(rt);
                const { crossings } = walk(rt, goal, solver);
                expect(rt.playback.state, rt.playback.reason).toBe(WALK_STATES.DONE);
                expect(crossings).toHaveLength(1);
                expect(crossings[0]).toMatchObject({ from: level, x: tp.x, y: tp.y });
                expect(rt.playback.stats.stepOffs).toBe(1);
                expect(rt.halted).toBeNull();
                expect(rt.deaths).toHaveLength(0);
                // The live run is still its own session's tape replayed.
                expect(runDigest(replayShadow(rt.session, SRC))).toBe(runDigest(rt.run));
                const s = rt.playback.solverStats;
                if (solver) {
                    // The step-off is the walker's; the walk BACK is the solver's.
                    expect(s.declines).toBe(0);
                    expect(s.refutations).toBe(0);
                    expect(s.solves).toBe(1);
                    expect(s.lastSolve).toMatchObject({ level, goal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } } });
                    expect(s.played).toBe(s.lastSolve.keys);
                } else {
                    expect(s.solves).toBe(0);
                }
            });
        }
    }

    it('no step-off cell overlaps a teleporter, and each is off its own door', () => {
        for (const key of crossing) {
            const [level, x, y] = key.split('|').map(Number);
            const rt = bootAt(level, x, y);
            const [index] = [...rt.run.state.latched];
            const p = stepOffPoint(rt.run, index);
            expect(p, key).not.toBeNull();
            const box = playerBoxAt(p.x, p.y);
            expect(rt.run.world.teleporters.some((tp) => rectsOverlap(box, tp.rect)), key).toBe(false);
        }
    });

    it('L3 r8c6 — the vanilla round trip: break the rock, L11, back into the pocket, step off and back on (solver OFF and ON)', () => {
        for (const solver of [false, true]) {
            // L4 → L3 lands in the main room; the solver breaks breakablerock@96,112 to reach the pocket's door.
            const rt = bootAt(3, 112, 48, ['hasSword']);
            const toL11 = { kind: 'exit', level: 3, tiles: [[6, 8]] };
            const first = walk(rt, toL11, true);
            expect(first.crossings.map((c) => [c.from, c.to])).toEqual([[3, 11]]);
            expect(rt.playback.solverStats.lastSolve.verbs).toContain('break');
            // L11's only door lands back ON L3's (96,128) door: latched.
            const back = walk(rt, { kind: 'exit', level: 11, tiles: [[2, 0]] }, solver);
            expect(back.crossings.map((c) => [c.from, c.to])).toEqual([[11, 3]]);
            expect(rt.run.level).toBe(3);
            expect([...rt.run.state.latched]).toEqual([2]);
            const solvesBefore = rt.playback.solverStats.solves;
            // The arrival: step off (the rock is gone — (104,120) is floor) and back on.
            const { crossings } = walk(rt, toL11, solver);
            expect(rt.playback.state, rt.playback.reason).toBe(WALK_STATES.DONE);
            expect(crossings.map((c) => [c.from, c.to, c.x, c.y])).toEqual([[3, 11, 96, 128]]);
            expect(rt.playback.stats.stepOffs).toBe(1);
            expect(rt.deaths).toHaveLength(0);
            expect(runDigest(replayShadow(rt.session, SRC))).toBe(runDigest(rt.run));
            if (solver) {
                expect(rt.playback.solverStats.solves).toBe(solvesBefore + 1);
                expect(rt.playback.solverStats.lastSolve).toMatchObject({ level: 3, verbs: ['walk'] });
            }
        }
    });
});

describe('S5 — a closed pocket fails by NAME, at once (no 1800-tick stall, no solve)', () => {
    for (const key of Object.entries(ARRIVALS_ON_A_DOOR).filter(([, k]) => k === 'closed').map(([k]) => k)) {
        for (const solver of [false, true]) {
            it(`${key}, solver ${solver ? 'ON' : 'OFF'}`, () => {
                const [level, x, y] = key.split('|').map(Number);
                const rt = bootAt(level, x, y);
                const { tp, goal } = latchedDoorGoal(rt);
                const { ticks } = walk(rt, goal, solver);
                expect(rt.playback.state).toBe(WALK_STATES.FAILED);
                expect(ticks).toBeLessThanOrEqual(1);
                expect(rt.playback.reason).toBe(`level ${level}: the run stands latched on the teleporter at `
                    + `(${tp.x}, ${tp.y}) and no cell next to it can be walked to — a crossing needs the player `
                    + 'to step off it and back on');
                expect(rt.playback.solverStats.solves).toBe(0);
                expect(rt.playback.solverStats.declines).toBe(0);
            });
        }
    }
});

describe('S5 — the solver goal mapping', () => {
    it('an exit resolved as a step-off stays on the walker, named; the same exit off the door maps to reach-exit', () => {
        const rt = bootAt(87, 432, 304);
        const { tp } = latchedDoorGoal(rt);
        const index = rt.run.world.teleporters.indexOf(tp);
        const goal = { kind: 'exit', level: 87, tiles: [[27, 19]] };
        expect(solverGoalFor(goal, { run: rt.run, resolved: { target: { x: 0, y: 0 }, allowTeleporter: index, stepOff: true } }))
            .toEqual({ walker: 'the run stands latched on the goal teleporter — the walker steps off it first' });
        expect(solverGoalFor(goal, { run: rt.run, resolved: { allowTeleporter: index } }))
            .toEqual({ goal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } } });
    });
});
