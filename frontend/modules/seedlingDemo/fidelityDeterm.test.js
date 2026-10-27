/**
 * ⛓ SEEDLING FIDELITY DETERM — the determinism bundle (wave 33).
 *
 * (a) L69's flier sequence. `lightBoss.js` numbered its fliers from a MODULE-level counter, so a second L69 run in one
 *     process numbered them 7..12 and `stateDigest`'s `visit` part (`lightsFights`) differed from the first run's from
 *     the first spawn on (G10's finding: tick 43 of `lights-witness/lights-solve-sword`). The ordinal is now the fight's
 *     own (`bodies.length + 1`); a fork's clone carries `bodies`, so it continues the same ordinal.
 * (b) L82's solve. The sweep's L82 legs flip between "on plan" and "recovered divergence at t=0" run to run. W0 measured
 *     the SOLVER deterministic: every captured L82 request (keyed ×2, 40536788606 / 40536803626) answers one plan over 8
 *     solves in one process and 8 fresh processes, and run 1's and run 2's requests answer the SAME plan although their
 *     seam clocks differ (5800 vs 5713). The t=0 divergence is the harness's arrival staging, not the solve (report).
 *     This row pins that: the diverging run's own request, solved twice in one process — equal plans, and the plan
 *     replayed from the staging gives an equal `stateDigest` every tick.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIGHT_BOSS, cloneLightsFight, createLightsFight, stepLightsController } from './lightBoss.js';
import { createHash } from 'node:crypto';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { ANYTIME_PASSES, liveOf, solveAnytime } from './jsRuntimeSolver.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witnessTape = (path) => JSON.parse(readFileSync(join(HERE, 'fixtures', `${path}.json`), 'utf8')).tape;

/** A fight past its intro, stepped once: the controller spawns its fliers. */
function spawned() {
    const fight = createLightsFight({ x: 72, y: 72, flierNum: 6, tag: 0 });
    fight.introUp = false;
    stepLightsController(fight, { time: 100 });
    return fight;
}

describe('DETERM (a) — the L69 flier ordinal is the fight\'s, not the module\'s', () => {
    it('two fights in one process number their fliers 1..6 each', () => {
        const a = spawned();
        const b = spawned();
        expect(a.fliers.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(b.fliers.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(LIGHT_BOSS.controller.spawnY).toBeTypeOf('number');
    });

    it('a fork clone carries the ordinal: same seqs, and its fliers resolve to its own bodies', () => {
        const a = spawned();
        a.fliers.splice(2, 1);
        const c = cloneLightsFight(a);
        expect(c.fliers.map((f) => f.seq)).toEqual([1, 2, 4, 5, 6]);
        for (const f of c.fliers) expect(c.bodies).toContain(f);
        expect(c.bodies.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('lights-solve-sword replayed twice in one process: stateDigest equal EVERY tick', () => {
        const once = () => {
            const digests = [];
            runTape(witnessTape('lights-witness/lights-solve-sword'), {
                levelSource: atlasLevelSource(),
                onTick: (t, now, held, run) => { digests.push(JSON.stringify(run.stateDigest())); },
            });
            return digests;
        };
        const r1 = once();
        const r2 = once();
        expect(r1.length).toBeGreaterThan(43);
        const first = r1.findIndex((d, i) => d !== r2[i]);
        expect(first, `the two runs' stateDigest first differs at tick index ${first}`).toBe(-1);
        expect(r2.length).toBe(r1.length);
    }, 240_000);
});

describe('DETERM (b) — L82\'s solve is a function of its request', () => {
    const fx = JSON.parse(readFileSync(join(HERE, 'fixtures', 'determ', 'l82-leg631-run2-request.json'), 'utf8'));
    const levelSource = atlasLevelSource();
    const { passes = ANYTIME_PASSES, ...tape } = restoreRequest(fx.request);
    const sha = (v) => createHash('sha1').update(v).digest('hex').slice(0, 12);
    const solve = () => solveAnytime({ ...tape, levelSource }, { passes });
    /** The plan stepped from the staging the way the shadow is built; `stateDigest` per tick. */
    const digests = (solution) => {
        const run = createRunForStaging(tape.staging, levelSource, { scratchPersistence: !!tape.scratchPersistence });
        const out = [JSON.stringify(run.stateDigest())];
        for (const held of solution) { run.advance(held); out.push(JSON.stringify(run.stateDigest())); }
        return { out, end: { level: run.level, x: run.state.x, y: run.state.y } };
    };

    it('the staging reproduces the page\'s live run (the request is self-consistent)', () => {
        const shadow = createRunForStaging(tape.staging, levelSource, { scratchPersistence: !!tape.scratchPersistence });
        expect(liveOf(shadow).digest).toBe(tape.live.digest);
    });

    it('two solves in one process: the same plan (the sweep\'s answer), and the same stateDigest every tick', () => {
        const a = solve();
        const b = solve();
        expect(a.ok && b.ok).toBe(true);
        const keys = (x) => JSON.stringify(x.plan.solution.map((k) => [...k]));
        expect(keys(b)).toBe(keys(a));
        // the answer every captured run-1 and run-2 request of this leg gave (node replay, fresh and in-process)
        expect({ answer: sha(keys(a)), ticks: a.plan.solution.length, work: a.work })
            .toEqual({ answer: 'd9e8ee425267', ticks: 1075, work: 174 });
        const da = digests(a.plan.solution);
        const db = digests(b.plan.solution);
        expect(da.out.findIndex((d, i) => d !== db.out[i])).toBe(-1);
        expect(da.end).toEqual(db.end);
        expect(da.end.level).toBe(96);
    }, 240_000);
});
