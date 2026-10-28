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
 * (c) G9's F1–F3, the responder fades' model side (`activators.js`) against the AS3 the skin already transcribes
 *     (`seedlingSolidsSkin.stepResponder`):
 *       F1 `coverHeldFade`  — a released Cover with an occupant keeps its faded alpha (`Cover.as:49-67`);
 *       F2 `lockRecloseLag` — a Lock re-closes at alpha 0, restored a step later, so a re-press on that step re-opens
 *                             at once (`Lock.as:64-97`);
 *       F3 (no key)         — a BossLock's private alpha/scale run on after the open, read by nothing but `render`
 *                             (`BossLock.as:69-96, :125`): the model's pinned 0 is the same game.
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
import { createActivatorState, openActivatorIds, openActivatorIdsBeforeLatestStep, opensOnTick, stepActivators } from './activators.js';
import { rect } from './levelWorld.js';
import { withContactFidelity } from './contactFidelity.js';
import { stepResponder } from './seedlingSolidsSkin.js';
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

describe('DETERM (c) — the responder fades, model vs AS3', () => {
    /** One button (t 0) at (0,0); a lock and a cover in its group; a block box the test can park on the cover. */
    const button = { tag: 'button', t: 0, x: 0, y: 0, rect: rect(0, 0, 16, 16) };
    const lock = { id: 'lock@64,0', tag: 'lock', t: 0, x: 64, y: 0, rect: rect(64, 0, 16, 16), persistTag: 3 };
    const cover = { id: 'cover@96,0', tag: 'cover', t: 0, x: 96, y: 0, rect: rect(96, 0, 16, 16), persistTag: -1 };
    const world = { level: 900, activators: [lock, cover], pressers: [button], solids: [] };
    const ON_BUTTON = rect(4, 4, 4, 5);
    const AWAY = rect(4, 64, 4, 5);
    const step = (st, box, movingSolids = []) => stepActivators(st, world, box, { inventory: {}, keys: new Set(), movingSolids });
    const s = (st, a) => st.byId.get(a.id);

    /** Open the lock (101 pressed steps), release it, return the state and the re-close step's alpha. */
    function reclosed() {
        const st = createActivatorState(world);
        for (let k = 1; k <= opensOnTick(0.01); k += 1) step(st, ON_BUTTON);
        expect(s(st, lock).open).toBe(true);
        const ev = step(st, AWAY);
        expect(ev.filter((e) => e.id === lock.id)).toEqual([{ kind: 'lockclose', id: lock.id, persistTag: 3 }]);
        return st;
    }

    it('F2 OFF (the default): the re-close step restores alpha 1, and a re-press on the next step re-fades from 1', () => withContactFidelity({ lockRecloseLag: false }, () => {
        const st = reclosed();
        expect([s(st, lock).open, s(st, lock).alpha]).toEqual([false, 1]);
        expect(step(st, ON_BUTTON).filter((e) => e.id === lock.id)).toEqual([]);
        expect(s(st, lock).open).toBe(false);
    }));

    it('F2 ON: alpha 0 on the re-close step (the AS3), and a re-press on the next step is an immediate turnOff', () => withContactFidelity({ lockRecloseLag: true }, () => {
        const st = reclosed();
        expect([s(st, lock).open, s(st, lock).alpha]).toEqual([false, 0]);
        // the skin's transcription agrees on the same two steps
        let k = null;
        for (let i = 1; i <= 101; i += 1) k = stepResponder(k, { tag: 'lock', held: i, touched: false, overlap: false, chestUnder: false, open: i >= 101 }).state;
        k = stepResponder(k, { tag: 'lock', held: 0, touched: false, overlap: false, chestUnder: false, open: false }).state;
        expect(k.alpha).toBe(s(st, lock).alpha);
        const ev = step(st, ON_BUTTON);
        expect(ev.filter((e) => e.id === lock.id)).toEqual([{ kind: 'lockopen', id: lock.id, persistTag: 3 }]);
        expect([s(st, lock).open, s(st, lock).alpha]).toEqual([true, 0]);
        // a body that updates before the responders still met it Solid on that step (`spinnerLockLag`'s reader)
        expect(openActivatorIdsBeforeLatestStep(st, world).has(lock.id)).toBe(false);
        expect(openActivatorIds(st).has(lock.id)).toBe(true);
        step(st, ON_BUTTON);
        expect(openActivatorIdsBeforeLatestStep(st, world).has(lock.id)).toBe(true);
        expect('lagReopen' in s(st, lock)).toBe(false);
    }));

    it('F2 ON: released again on the step after the re-close, the alpha is restored to 1 (one step late)', () => withContactFidelity({ lockRecloseLag: true }, () => {
        const st = reclosed();
        step(st, AWAY);
        expect([s(st, lock).open, s(st, lock).alpha]).toEqual([false, 1]);
    }));

    /** The cover faded `n` steps, then released with a block parked in its cell. */
    function coverHeld(n) {
        const st = createActivatorState(world);
        for (let k = 1; k <= n; k += 1) step(st, ON_BUTTON);
        const faded = s(st, cover).alpha;
        step(st, AWAY, [{ id: 'block', rect: rect(100, 4, 8, 8) }]);
        return { st, faded };
    }
    /** Steps of a re-press until the cover opens. */
    function reopenSteps(st) {
        let n = 0;
        while (!s(st, cover).open && n < 20) { n += 1; step(st, ON_BUTTON); }
        return n;
    }

    it('F1 OFF (the default): an occupied, released cover snaps to alpha 1 and a re-press takes the full 10 steps', () => withContactFidelity({ coverHeldFade: false }, () => {
        const { st } = coverHeld(5);
        expect([s(st, cover).open, s(st, cover).alpha]).toEqual([false, 1]);
        expect(reopenSteps(st)).toBe(opensOnTick(0.1));
    }));

    it('F1 ON: it keeps the faded alpha (Cover.as:49-67), and a re-press resumes — the skin\'s count, < 10', () => withContactFidelity({ coverHeldFade: true }, () => {
        const { st, faded } = coverHeld(5);
        expect([s(st, cover).open, s(st, cover).alpha]).toEqual([false, faded]);
        const n = reopenSteps(st);
        let k = null;
        for (let i = 1; i <= 5; i += 1) k = stepResponder(k, { tag: 'cover', held: i, touched: false, overlap: false, chestUnder: false, open: undefined }).state;
        k = stepResponder(k, { tag: 'cover', held: 0, touched: false, overlap: true, chestUnder: false, open: undefined }).state;
        let m = 0;
        while (k.solid && m < 20) { m += 1; k = stepResponder(k, { tag: 'cover', held: m, touched: false, overlap: false, chestUnder: false, open: undefined }).state; }
        expect(n).toBe(m);
        expect(n).toBeLessThan(opensOnTick(0.1));
        // with no occupant it still resets (the `reset()` arm)
        step(st, AWAY);
        expect([s(st, cover).open, s(st, cover).alpha]).toEqual([false, 1]);
    }));

    it('F1 ON leaves an occupied OPEN cover open (unchanged from OFF) and does not touch a Lock', () => withContactFidelity({ coverHeldFade: true }, () => {
        const st = createActivatorState(world);
        for (let k = 1; k <= opensOnTick(0.1); k += 1) step(st, ON_BUTTON);
        expect(s(st, cover).open).toBe(true);
        step(st, AWAY, [{ id: 'block', rect: rect(100, 4, 8, 8) }]);
        expect([s(st, cover).open, s(st, cover).alpha]).toEqual([true, 0]);
        // a mid-fade lock released snaps to 1, as the AS3 (`type == normType`)
        const st2 = createActivatorState(world);
        for (let k = 1; k <= 40; k += 1) step(st2, ON_BUTTON);
        step(st2, AWAY, [{ id: 'block', rect: rect(68, 4, 8, 8) }]);
        expect(s(st2, lock).alpha).toBe(1);
    }));

    it('F3 is a named no-op: after a BossLock opens nothing the model carries moves, whatever the private alpha does', () => {
        // `BossLock.update` keeps `alpha -= 0.05; scale += 0.05` while `activate` holds (it latches), but after the open
        // `type == ""` and the only readers are `render` (clamped `Image.alpha`, restored to 1 at `:125`) and the
        // `alpha <= 0 && type != ""` test, which is false. The skin carries the private value; the model's 0 is the
        // drawn one. Here: the skin's private alpha runs negative and its drawn (clamped) alpha is 0, the model's.
        let k = null;
        for (let i = 1; i <= 200; i += 1) k = stepResponder(k, { tag: 'bosslock', held: i, touched: true, overlap: false, chestUnder: false, open: i >= 80 }).state;
        expect(k.solid).toBe(false);
        expect(k.alpha).toBeLessThan(0);
        expect(k.scale).toBeGreaterThan(2);
        expect(Math.min(Math.max(k.alpha, 0), 1)).toBe(0);
    });
});
