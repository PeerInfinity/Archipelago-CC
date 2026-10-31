/**
 * ⛓⛓⛓ SEEDLING FIDELITY L100LATTICE (wave 36) — A WALK TO AN 8 px STANCE PLANS ON THE 8 px LATTICE (`fineStanceWalk`).
 *
 * L100's `breakablerock@128,144` is broken from the 8 px sliver x 120–127, and `fineSwingStance` (W34 L100FIX) names
 * the stance (124,140) on `FINE_LATTICE`. The walk to it was then planned on the run's 16 px lattice: no 16 px node fits
 * the sliver, so `nearestGoalNode` aimed at the pool node (104,136) and the string-pull's fallback kept (124,140) as a
 * last segment through `cliffside0@112,128` that nothing checked. The walk stalled there for 400 ticks, twice (route
 * survey step 216 at this base; step 219 at W35's). The 8 px retry (FRONTIER3) runs only when the 16 px plan THROWS,
 * and this one did not.
 *
 * ON: a stance an 8 px arm answered is marked (`FINE_STANCES`, an identity set) and the walk to it is planned on
 * `FINE_LATTICE` first. Step 216 then reaches L101 at t731 with one jellyfish hit (t125, `jellyfish@80,112`), and the
 * game agrees at every tick (`fixtures/l100lattice-witness/step216-on.json`, p4g headless, 0 px; the game bills the hit
 * at t125 and is in L101 at t731). Walks to stances the 16 px lattice answered are untouched: the L89 control (W35's
 * step-89 witness) solves to the same keys ON.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment } from './solverBot.js';
import { DEFAULT_DASH_MODE } from '../../../scripts/procgen/dashMode.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'l100lattice-witness', 'step216-on.json'), 'utf8'));
const L89 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'waterfall-witness', 'l89-step89-on.json'), 'utf8'));

const runOf = (tape) => createRunForStaging(solveStaging(stagingFromTape(parseTape({ ...tape, inputs: [], tick_count: 0 }))), SRC);
const tapeKeys = (tape) => {
    const out = [];
    for (let t = 0; t < tape.tick_count; t += 1) {
        out.push((tape.inputs ?? []).filter((i) => i.from <= t && t < i.to).map((i) => i.key).sort().join('+'));
    }
    return out;
};
const keysOf = (perTick) => perTick.map((k) => [...k].sort().join('+'));
const solve216 = (on) => withContactFidelity({ fineStanceWalk: on }, () => {
    const run = runOf(W.tape);
    try {
        const r = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100',
            boot: W.tape.boot, dashMode: DEFAULT_DASH_MODE });
        return { r, run };
    } catch (e) {
        return { e, run };
    }
});

describe('L100 — the walk to an 8 px swing stance plans on the 8 px lattice (fineStanceWalk)', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.fineStanceWalk).toBe(false);
    });

    it('OFF: the break-stance walk is planned at 16 px, aims (124,140) past the pool node, and stalls on the mask', () => {
        const { e } = solve216(false);
        expect(e?.name).toBe('SolverRefusal');
        expect(e.message).toContain('break stance (breakablerock@128,144): the re-planned corridor failed too');
        expect(e.message).toContain('waypoint 1 (124,140): not reached within 400 ticks');
        expect(e.message).toContain('cliffside0 at (112,128)');
        const walk = e.rows.find((row) => row.strategy?.verb === 'walk');
        expect(walk.strategy.lattice).toBeUndefined();
        expect(walk.path.slice(-2)).toEqual([{ x: 104, y: 136 }, { x: 124, y: 140 }]);
    }, 120_000);

    it('ON: the walk is planned on FINE_LATTICE, the rock breaks, and the plan IS the game witness, key for key', () => {
        const { r, run, e } = solve216(true);
        expect(e).toBeUndefined();
        expect(keysOf(r.perTick)).toEqual(tapeKeys(W.tape));
        expect(run.level).toBe(101);
        // the walk to the stance is a FINE_STANCE walk, its re-plan (t479) too
        const fine = r.fineLatticeWalks.filter((w) => w.refused.startsWith('FINE_STANCE'));
        expect(fine.map((w) => [w.tick, w.aim.x, w.aim.y])).toEqual([[0, 124, 140], [479, 124, 140]]);
        const replan = r.trace.rows.find((row) => row.tick === 479);
        expect(replan.strategy).toMatchObject({ verb: 'walk', lattice: 8 });
        expect(replan.path).toEqual([{ x: 116, y: 36 }, { x: 124, y: 140 }]);
        // the one hit is the jellyfish's on the first corridor (unbilled; `unbilledDamageGate` is OFF)
        expect(run.playerHits.map((h) => [h.t, h.id])).toEqual([[125, 'jellyfish@80,112']]);
    }, 120_000);

    it('ON: the model replaying the witness tape equals the game at every sampled tick (0 px), hit and level too', () => {
        const run = runOf(W.tape);
        const model = [[run.state.x, run.state.y]];
        for (const k of tapeKeys(W.tape)) {
            run.advance(new Set(k ? k.split('+') : []));
            model.push([run.state.x, run.state.y]);
        }
        let worst = 0;
        for (const [t, x, y] of W.game) worst = Math.max(worst, Math.abs(model[t][0] - x), Math.abs(model[t][1] - y));
        expect(W.game.length).toBeGreaterThan(700);
        expect(worst).toBe(0);
        expect(run.playerHits.map((h) => [h.t, h.hits])).toEqual(W.gameHits);
        expect([run.ticksCompleted, run.level]).toEqual([W.gameEnd.tick, W.gameEnd.level]);
    }, 60_000);

    it('ON: a walk the 16 px lattice answers is untouched — the L89 control (W35 step 89) solves to the same keys', () => {
        const r = withContactFidelity({ fineStanceWalk: true }, () => solveSegment({ run: runOf(L89.tape),
            goals: [{ kind: 'reach-exit', exit: { x: 288, y: 240 } }], name: 'l89', boot: L89.tape.boot,
            dashMode: DEFAULT_DASH_MODE }));
        expect(keysOf(r.perTick)).toEqual(tapeKeys(L89.tape));
        expect(r.fineLatticeWalks ?? []).toEqual([]);
    }, 120_000);
});
