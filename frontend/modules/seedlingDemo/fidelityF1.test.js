/**
 * fidelityF1 — Seedling fidelity F1: L5's bodies, and the open-lock arrival.
 *
 * D1: THE ARROWS UPDATE NEWEST-FIRST. Two arrows of one volley can overlap one
 * body on one tick; the first to update lands and the second meets the
 * i-frames. FlashPunk's update list puts the newest arrow first
 * (`World.addUpdate` prepends), so the game shoves `bob@16,64` from the arrow
 * at x = 40 on `r8-solve-5` t54, and the model, walking `flight` in creation
 * order, shoved it from x = 36. L5's bodies and kill order left the game there
 * (swim R5 D3), and L4's `bob@64,64` on `r8-solve-4` at t83 the same way.
 * `levelRun.arrowUpdateOrder` transcribes the order; these rows hold the
 * model's bodies to the GAME's own readouts (`fixtures/f1-bodies-oracle.json`).
 *
 * D1c: `f1-l5-lock-removal` is the game's answer to L5's kill lock with a walk
 * that stands on the lock before both readings. The game opens it on the
 * REMOVAL of the last body plus 100, and the tape's `{5,0}@301` is that
 * game-sourced value. The model's own ledger still reads the kill (t166 + 101
 * = 267): swim R5's residue item 3, measured and not changed here.
 *
 * D2: L5's OPEN-LOCK ARRIVAL. With `{5,0}` already set, the ladder kills
 * `bob@16,80` from the ceiling, and the chaser arm took the hold's
 * shut-before snapshot AFTER the walk onto the button, so `runHold` refused
 * with *"every responder in group t=0 [] is ALREADY OPEN before the hold
 * begins"*. That was true of nothing: the traps are silent before the walk.
 * With the snapshot taken first, the hold runs, and the arrival declines by
 * the reason the hold measured: the body walks out of every armed lane
 * (`BODY_OUT_OF_LANE`). The game agrees body for body
 * (`f1-l5-open-lock-bait`).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 `arrowUpdateOrder` returns `flight` unchanged (creation order)
 *        -> 6/6 red: both oracle rows (r8-solve-5 at t54, r8-solve-4 at t83),
 *           the t54 pinpoint (v (-0.4903, 3.7028)), the kills row and both
 *           D1c rows (the player reaches the lock at t285)
 *   m2 the chaser kill-by-ceiling arm's `before` taken after the walk again
 *        -> the D2 decline row red with the old *"ALREADY OPEN"* refusal
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTape } from './fixtures/index.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { solveSegment } from './solverBot.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
// The JS arc's modules, imported read-only: the staging and the arrival goal.
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal } from './wasmArrival.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'f1-bodies-oracle.json'), 'utf8'));

/** Replay a tape through the model; per tick, the run's Bob rows (index = t). */
function bobsPerTick(name) {
    const tape = loadTape(name);
    let run = null;
    const perTick = [];
    const st = createTapeStepper(tape, {
        levelSource: atlasLevelSource(),
        onTick: (t, s, h, rn) => { run = rn; },
    });
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        perTick[o.t] = !run ? [] : run.entities('chasers')
            .filter((c) => c.id.startsWith('bob@'))
            .map((c) => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, ht: c.hitsTimer }));
        r = st.next();
    }
    return { tape, perTick, run };
}

describe('F1 D1 — the arrows update newest-first, and the bodies are the game\'s', () => {
    for (const name of Object.keys(ORACLE.tapes)) {
        it(`⛓⛓⛓ ${name}: every Bob, every sampled tick, is the game's readout (position, velocity, hits, i-frames, presence)`, () => {
            const { tape, perTick } = bobsPerTick(name);
            const game = new Map();
            for (const row of ORACLE.tapes[name]) {
                if (!game.has(row[0])) game.set(row[0], []);
                game.get(row[0]).push(row);
            }
            let worst = 0;
            let first = null;
            const unsampled = new Set(ORACLE.unsampled[name]);
            for (let t = 0; t <= tape.tick_count; t += 1) {
                if (unsampled.has(t)) continue;
                const g = game.get(t) ?? [];
                const m = perTick[t] ?? [];
                if (g.length !== m.length) {
                    first ??= `t${t}: game ${g.length} body(ies), model ${m.length}`;
                    continue;
                }
                for (const [, x, y, vx, vy, hits, ht] of g) {
                    const b = m.reduce((best, c) => (!best
                        || Math.hypot(c.x - x, c.y - y) < Math.hypot(best.x - x, best.y - y) ? c : best), null);
                    const d = Math.max(...[x - b.x, y - b.y, vx - b.vx, vy - b.vy].map(Math.abs));
                    worst = Math.max(worst, d);
                    if ((d > 1e-9 || hits !== b.hits || ht !== b.ht) && !first) {
                        first = `t${t} ${b.id}: game (${x}, ${y}) v (${vx}, ${vy}) ${hits}/${ht}, `
                            + `model (${b.x}, ${b.y}) v (${b.vx}, ${b.vy}) ${b.hits}/${b.ht}`;
                    }
                }
            }
            expect(first, `worst |Δ| ${worst}`).toBeNull();
            expect(worst).toBeLessThan(1e-9);
        });
    }

    it('⛓ r8-solve-5 t54: bob@16,64 is shoved from the arrow at x = 40 (#0.1), and #0.0 meets its i-frames', () => {
        const { perTick, run } = bobsPerTick('r8-solve-5');
        const b = perTick[54].find((c) => c.id === 'bob@16,64');
        // (0.3536, -0.3536) + 5 at atan2(4.8128, -5.405), friction, the chase step.
        expect(b.vx).toBeCloseTo(-2.6928666146430356, 12);
        expect(b.vy).toBeCloseTo(2.3064236788471035, 12);
        const at54 = run.arrowBodyHits.filter((h) => h.t === 54 && h.body === 'bob@16,64');
        expect(at54.map((h) => [h.arrow, h.damaged])).toEqual([
            ['arrowtrap@32,48#0.1', true],
            ['arrowtrap@32,48#0.0', false],
        ]);
    });

    it('⛓ the kills that open L5\'s lock are the game\'s: t124, t127 and t166 (they were t165 and t326)', () => {
        const { run } = bobsPerTick('r8-solve-5');
        const opens = run.chaserKillLockOpens.filter((o) => !o.nil);
        expect(opens.map((o) => [o.t, o.id])).toEqual([[166, 'bob@16,80']]);
    });
});

describe('F1 D1c — L5\'s kill lock opens on the REMOVAL (the game\'s answer, f1-l5-lock-removal)', () => {
    it('⛓⛓ the last body leaves the world on t201, and the game-sourced {5,0}@301 is that + 100', () => {
        const { tape, perTick } = bobsPerTick('f1-l5-lock-removal');
        const inL5 = perTick.slice(0, 303);   // the crossing (below)
        const lastSeen = inL5.findLastIndex((m) => (m ?? []).length > 0);
        expect(lastSeen + 1).toBe(201);
        const decl = tape.persistence.find((p) => p.level === 5 && p.tag === 0);
        expect(decl.at).toBe(201 + 100);
    });

    it('⛓ the walk discriminates: the player is on the lock before the kill reading (t267) would open it', () => {
        const tape = loadTape('f1-l5-lock-removal');
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource() });
        const obs = [];
        let r = st.next();
        while (!r.done) { obs.push(r.value.observation); r = st.next(); }
        const onLock = obs.find((o) => o.level === 5 && o.y >= 108.5);
        expect(onLock.t).toBeLessThan(267);
        // held there until the removal reading opens it; the game crossed on t303
        expect(obs.find((o) => o.level !== 5).t).toBe(303);
    });
});

describe('F1 D2 — L5\'s open-lock arrival declines by what the hold measured, not by a false control', () => {
    const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
    const RECS = indexLevels(MAP);
    const SRC = levelSourceFromAtlas(RECS);
    const arrive = (clears) => {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [5, 80, 32] }]);
        rt.tick();
        const staging = { ...rt.session.staging, persistence: [...rt.session.staging.persistence, ...clears] };
        const m = arrivalSolverGoal({ kind: 'exit', level: 5, tiles: [[3, 7]], name: 'l5' },
            { staging, levelSource: SRC, record: RECS.get(5) });
        const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
        try {
            return { run, out: solveSegment({ run, goals: [m.goal], name: 'l5', boot: staging.boot }) };
        } catch (e) {
            return { run, err: e };
        }
    };

    it('⛓ lock SHUT: the first arrival solves (403 ticks, zero hits)', () => {
        const { run, out, err } = arrive([]);
        expect(err).toBeUndefined();
        expect(out.perTick.length).toBe(403);
        expect(run.playerHits).toEqual([]);
    });

    it('⛓⛓ lock OPEN: the arrival declines with BODY_OUT_OF_LANE, and never with the false "ALREADY OPEN"', () => {
        const { run, err } = arrive([{ level: 5, tag: 0 }]);
        expect(err?.name).toBe('BotDriverV2Error');
        expect(err.message).not.toMatch(/ALREADY OPEN/);
        expect(err.message).toMatch(/kill \(bob@16,80\): held button@48,48 for the whole bound/);
        expect(err.message).toMatch(/bob@16,80 is alive at \(58\.87, 84\.14\) with 2 hit\(s\), and NO armed lane covers it/);
        expect(err.message).toMatch(/BODY_OUT_OF_LANE/);
        expect(run.entities('chasers').map((c) => c.id)).toEqual(['bob@16,80']);
    });
});
