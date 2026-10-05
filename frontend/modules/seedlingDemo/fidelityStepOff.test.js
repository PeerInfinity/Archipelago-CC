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
import { STEPOFF_DOORS, stepOffArms, stepOffStagingAt, compactTicks } from './fidelityStepOff.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'stepoff-oracle.json'), 'utf8'));
const SRC = atlasLevelSource();
const ARMS = stepOffArms();
const oracleArm = (arm) => ORACLE.arms.find((r) => r.arm === arm);

describe('fidelity STEP-OFF — D1: the game\'s rule, measured', () => {
    it('the oracle holds every arm, recorded clean (no error, no hit)', () => {
        expect(ORACLE.arms.filter((r) => !r.arm.startsWith('SOLVER-')).map((r) => r.arm)).toEqual(ARMS.map((a) => a.arm));
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
