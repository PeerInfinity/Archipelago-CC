/**
 * ⛓⛓⛓ SEEDLING FIDELITY WATERFALL (wave 35) — THE CORRIDOR PLANNER PRICES THE WATERFALL'S PUSH
 * (`waterfallPushPricing`).
 *
 * `Player.as:1557`: `if (onWaterfall && (!hasFeather || v.y >= 0)) v.y += 0.8`. Only a RISING player holding the
 * Feather is not pushed. The planner refused only the featherless climb (`climbsArmedWaterfall`) and priced every
 * other waterfall step as floor, so L100's corridor (survey step 219, leg 907) crossed the x 80–111 column FLAT at
 * y 44 and the walk was carried down into the pool (the L100 slice's Gap 1, game-witnessed by `l100-w0-straight`).
 * ON: a flat step INTO an unpinned waterfall node costs the fall (`1 + 2 × depth`), a flat EXIT costs the fall unless
 * its half-cell's carry lands on the far side, and the string-pull neither shortcuts a flat or down-diagonal leg
 * across one nor keeps a point on one as a stop. The 8 px corridor then rises into the row-1 pool with the Feather
 * and leaves it down-right into the sliver — the crossing the L100 slice found by hand.
 *
 * Game witnesses (`fixtures/waterfall-witness/`, p4g headless, the player's (x,y) at the first frame per tick):
 * `l100-on-route` — the ON corridor driven with the jellyfish present until 24 ticks past their first hit;
 * `l100-exit` — its exit leg from the pool down the sliver, 0 hits; and `l89-step89-on` — route survey step 89's ON
 * plan (the survey's one SOLVED mover: 639 → 291 ticks). The model equals the game at every tick.
 * Ships OFF (`contactFidelity.test.js` pins the defaults).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity } from './contactFidelity.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { solveSegment } from './solverBot.js';
import { DEFAULT_DASH_MODE } from '../../../scripts/procgen/dashMode.js';
import {
    driveStepHeld, livePerVisitOpts, planTilePath, planWaypoints, plansReach, waypointReached, BotDriverV2Error,
} from './botDriverV2.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'waterfall-witness', `${name}.json`), 'utf8'));
const ROUTE = witness('l100-on-route');
const EXIT = witness('l100-exit');
const L89 = witness('l89-step89-on');

const runOf = (tape) => createRunForStaging(solveStaging(stagingFromTape(parseTape({ ...tape, inputs: [], tick_count: 0 }))), SRC);
const optsOf = (run, lattice) => ({ ...livePerVisitOpts(run), inventory: run.inventory, lattice });
const pts = (wps) => wps.map((p) => [p.x, p.y]);
const STANCE = Object.freeze({ x: 124, y: 140 });   // the L100 rock's 8 px swing stance, in the sliver
const plan = (on, lattice, tape = ROUTE.tape) => withContactFidelity({ waterfallPushPricing: on }, () => {
    const run = runOf(tape);
    return pts(planWaypoints(run.world, run.state, STANCE, null, optsOf(run, lattice)));
});

/** Drive `wps` with the solver's own per-tick choice; the held sets, tick by tick. */
const driveKeys = (run, wps, maxTicks) => {
    const keys = [];
    for (let i = 0; i < wps.length && keys.length < maxTicks; i += 1) {
        const wp = { x: wps[i][0], y: wps[i][1] };
        for (let n = 0; n < 400 && keys.length < maxTicks
            && !waypointReached(run.state, wp, DEFAULT_TOLERANCE, i < wps.length - 1); n += 1) {
            const held = driveStepHeld(run, wp, DEFAULT_TOLERANCE);
            keys.push([...held].sort().join('+'));
            run.advance(held);
        }
    }
    return keys;
};
const tapeKeys = (tape) => {
    const out = [];
    for (let t = 0; t < tape.tick_count; t += 1) {
        out.push((tape.inputs ?? []).filter((i) => i.from <= t && t < i.to).map((i) => i.key).sort().join('+'));
    }
    return out;
};
/** The model replaying a witness tape: worst |Δ| against the game's player (x,y), and how many ticks were over the waterfall. */
const replay = (w) => {
    const run = runOf(w.tape);
    const keys = tapeKeys(w.tape);
    const model = [[run.state.x, run.state.y]];
    for (const k of keys) {
        run.advance(new Set(k ? k.split('+') : []));
        model.push([run.state.x, run.state.y]);
    }
    let worst = 0;
    let over = 0;
    for (const [t, x, y] of w.game) {
        worst = Math.max(worst, Math.abs(model[t][0] - x), Math.abs(model[t][1] - y));
        if (x >= 80 && x < 112 && y >= 32 && y < 128) over += 1;
    }
    return { worst, over, hits: run.playerHits.length, run };
};

describe('L100 — the waterfall\'s push in the corridor planner (waterfallPushPricing)', () => {
    it('OFF: the 8 px corridor crosses the column flat at y 44 (the carried crossing) — byte-identical to the base', () => {
        expect(plan(false, 8)).toEqual([[44, 92], [60, 44], [124, 44], [124, 140]]);
        expect(plan(false, 16)).toEqual([[40, 88], [56, 40], [104, 40], [104, 136], [124, 140]]);
    });

    it('ON: the 8 px corridor rises into the row-1 pool with the Feather and leaves it down-right, no stop on the waterfall', () => {
        expect(plan(true, 8)).toEqual([[44, 92], [60, 44], [76, 44], [108, 28], [116, 36], [124, 140]]);
    });

    it('ON: the 16 px corridor descends the column instead of crossing it (the sliver has no 16 px node)', () => {
        expect(plan(true, 16)).toEqual([[40, 88], [56, 40], [72, 40], [88, 136], [104, 136], [124, 140]]);
    });

    it('ON: the corridor IS the game witness, key for key, and the model equals the game at every tick (0 px)', () => {
        const keys = driveKeys(runOf(ROUTE.tape), plan(true, 8), ROUTE.tape.tick_count);
        expect(keys).toEqual(tapeKeys(ROUTE.tape));
        const r = replay(ROUTE);
        expect(r.worst).toBe(0);
        expect(r.over).toBeGreaterThanOrEqual(19);   // the Feather rise across the column's top
        // the hit is the jellyfish's (hammer's dwell), not the waterfall's: the corridor itself is clean
        expect(r.run.playerHits[0]).toMatchObject({ t: 151, source: 'chaser', id: 'jellyfish@80,16' });
    }, 60_000);

    it('ON: the exit leg (pool → sliver) is the witness too, hitless, and the model equals the game (0 px)', () => {
        const keys = driveKeys(runOf(EXIT.tape), [[116, 36], [124, 140]], EXIT.tape.tick_count);
        expect(keys).toEqual(tapeKeys(EXIT.tape));
        const r = replay(EXIT);
        expect(r.worst).toBe(0);
        expect(r.hits).toBe(0);
        expect(r.run.state.y).toBeGreaterThan(139);
    }, 60_000);

    it('ON: an EXIT is priced by where its half-cell carry lands — row 36 (lands above the mask), not row 44', () => {
        const exitOf = (on) => withContactFidelity({ waterfallPushPricing: on }, () => {
            const run = runOf(EXIT.tape);
            const path = planTilePath(run.world, { x: 108, y: 60 }, STANCE, null, optsOf(run, 8));
            const i = path.findIndex((n) => n.tx === 14);
            return [path[i - 1], path[i]];
        });
        // OFF: straight out at row 44, where `cliffside0@112,48` under (116,44) stops the 11.4 px carry's landing
        expect(exitOf(false)).toEqual([{ tx: 13, ty: 5 }, { tx: 14, ty: 5 }]);
        expect(exitOf(true)).toEqual([{ tx: 13, ty: 4 }, { tx: 14, ty: 4 }]);
    });

    it('a stop ON the waterfall is no stop: the walk to (108,36) never arrives (why the pull steps past it)', () => {
        const run = runOf(EXIT.tape);
        const keys = driveKeys(run, [[108, 36]], 300);
        expect(keys).toHaveLength(300);
        expect(waypointReached(run.state, { x: 108, y: 36 }, DEFAULT_TOLERANCE, false)).toBe(false);
    });

    it('survey step 89 (L89 → L87): OFF keeps a stop ON the waterfall and re-plans; ON descends the column — the game witness', () => {
        const solve = (on) => withContactFidelity({ waterfallPushPricing: on }, () => {
            const run = runOf(L89.tape);
            return solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 240 } }], name: 'l89',
                boot: L89.tape.boot, dashMode: DEFAULT_DASH_MODE });
        });
        const off = solve(false);
        expect(off.perTick).toHaveLength(639);
        // the first corridor's stop (232,104) is on L89's waterfall tile (14,6): it stalls, and the walk re-plans
        expect(off.trace.rows[0].path).toContainEqual({ x: 232, y: 104 });
        const on = solve(true);
        expect(on.perTick.map((k) => [...k].sort().join('+'))).toEqual(tapeKeys(L89.tape));
        const r = replay(L89);
        expect(r.worst).toBe(0);
        expect(r.hits).toBe(0);
        expect(r.run.level).toBe(87);
    }, 120_000);

    it('ON: a price, not a refusal — `plansReach` still answers `planWaypoints` cell for cell on L100', () => {
        withContactFidelity({ waterfallPushPricing: true }, () => {
            const run = runOf(ROUTE.tape);
            const opts = optsOf(run, 8);
            const reach = plansReach(run.world, null, opts).from(run.state);
            let asked = 0;
            for (let y = 20; y < 176; y += 8) {
                for (let x = 44; x < 132; x += 8) {
                    let plans = true;
                    try {
                        planWaypoints(run.world, run.state, { x, y }, null, opts);
                    } catch (e) {
                        if (!(e instanceof BotDriverV2Error)) throw e;
                        plans = false;
                    }
                    expect(reach({ x, y }), `(${x},${y})`).toBe(plans);
                    asked += 1;
                }
            }
            expect(asked).toBeGreaterThan(200);
        });
    }, 60_000);
});
