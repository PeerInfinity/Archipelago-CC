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
import { solveSegment, withDashCertSight } from './solverBot.js';
import { DEFAULT_DASH_MODE } from '../../../scripts/procgen/dashMode.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'l100lattice-witness', 'step216-on.json'), 'utf8'));
const L89 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'waterfall-witness', 'l89-step89-on.json'), 'utf8'));
const WDC = JSON.parse(readFileSync(join(HERE, 'fixtures', 'dashcert-witness', 'step216-on.json'), 'utf8'));
const W168 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'l100lattice-witness', 'step168-on.json'), 'utf8'));
const bootOf = (step) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'l100lattice-witness', `step${step}-boot.json`), 'utf8'));

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
    // ⛓ shipped OFF (wave 36); ⚖ (user, 2026-11-02, "Yes, after W36 lands") ON at the L100 joint flip with hammer's DASH_CERT_SIGHT.
    it('ships ON', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.fineStanceWalk).toBe(true);
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

    // ⛓ The L100LATTICE witness (731 t, one unbilled jellyfish hit) is the plan with DASH_CERT_SIGHT OFF — its control row.
    it('ON, DASH_CERT_SIGHT OFF: the walk is planned on FINE_LATTICE, the rock breaks, and the plan IS the game witness, key for key', () => {
        const { r, run, e } = withDashCertSight(false, () => solve216(true));
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

    // ⛓ L100 joint flip: with DASH_CERT_SIGHT ON (hammer DASHCERT: previewWalk's chaser swing asks the run's line of sight)
    // the fine-lattice walk on step 216 is DASHCERT's hitless 327-t plan, game-witnessed (`fixtures/dashcert-witness/`, p4g, 0 px).
    it('ON, DASH_CERT_SIGHT ON: the plan IS the DASHCERT game witness, key for key, hitless, into L101', () => {
        const { r, run, e } = withDashCertSight(true, () => solve216(true));
        expect(e).toBeUndefined();
        expect(keysOf(r.perTick)).toEqual(tapeKeys(WDC.tape));
        expect(run.level).toBe(101);
        expect(run.playerHits).toEqual([]);
    }, 120_000);

    it.each([['step 216 (L100)', W, 700], ['step 168 (L66, a mover)', W168, 230]])(
        'ON: the model replaying %s\'s witness tape equals the game at every sampled tick (0 px), hits and level too',
        (_name, w, min) => {
            const run = runOf(w.tape);
            const model = [[run.state.x, run.state.y]];
            for (const k of tapeKeys(w.tape)) {
                run.advance(new Set(k ? k.split('+') : []));
                model.push([run.state.x, run.state.y]);
            }
            let worst = 0;
            for (const [t, x, y] of w.game) worst = Math.max(worst, Math.abs(model[t][0] - x), Math.abs(model[t][1] - y));
            expect(w.game.length).toBeGreaterThan(min);
            expect(worst).toBe(0);
            expect(run.playerHits.map((h) => [h.t, h.hits])).toEqual(w.gameHits);
            expect([run.ticksCompleted, run.level]).toEqual([w.gameEnd.tick, w.gameEnd.level]);
        }, 60_000);

    it('ON: step 168 (L66 → L70) — the keylock stance fineFrontierFlood found is walked on 8 px; the plan IS the witness', () => {
        const solve = (on) => withContactFidelity({ fineStanceWalk: on }, () => solveSegment({ run: runOf(W168.tape),
            goals: [{ kind: 'reach-exit', exit: { x: 72, y: 64 } }], name: 'l66', boot: W168.tape.boot,
            dashMode: DEFAULT_DASH_MODE }));
        const off = solve(false);
        expect(off.perTick).toHaveLength(230);
        expect(off.fineLatticeWalks).toBeUndefined();
        const on = solve(true);
        expect(keysOf(on.perTick)).toEqual(tapeKeys(W168.tape));
        expect(on.fineLatticeWalks.map((w) => [w.tick, w.aim.x, w.aim.y, w.refused.slice(0, 11)]))
            .toEqual([[64, 76, 84, 'FINE_STANCE'], [160, 76, 84, 'FINE_STANCE']]);
    }, 120_000);

    it('ON: a walk the 16 px lattice answers is untouched — the L89 control (W35 step 89) solves to the same keys', () => {
        const r = withContactFidelity({ fineStanceWalk: true }, () => solveSegment({ run: runOf(L89.tape),
            goals: [{ kind: 'reach-exit', exit: { x: 288, y: 240 } }], name: 'l89', boot: L89.tape.boot,
            dashMode: DEFAULT_DASH_MODE }));
        expect(keysOf(r.perTick)).toEqual(tapeKeys(L89.tape));
        expect(r.fineLatticeWalks ?? []).toEqual([]);
    }, 120_000);

    it.each([[172], [200]])('ON: step %i (L12, the wand stance (40,888), off the 8 px grid) walks axis-aligned — the OFF keys', (step) => {
        const boot = bootOf(step);
        const solve = (on) => withContactFidelity({ fineStanceWalk: on }, () => solveSegment({
            run: runOf({ ...boot, equips: [] }), goals: [{ kind: 'reach-exit', exit: { x: 32, y: 848 } }], name: 'l12',
            boot: boot.boot, dashMode: DEFAULT_DASH_MODE }));
        const off = solve(false);
        const on = solve(true);
        // OFF reached it by STANCE_REENTRY's axis-aligned fine walk; ON asks the same shape first, and asks no dash
        // (a free fine corridor's whole-chain dash certificate cost ~60 s / ~105 s here, measured)
        expect(off.fineLatticeWalks.map((w) => w.refused)).toEqual(['STANCE_REENTRY wand(magicallock@32,864)#0']);
        expect(on.fineLatticeWalks.map((w) => w.refused))
            .toEqual(['FINE_STANCE (the stance an 8 px arm answered; off the 8 px grid, axis-aligned)']);
        expect(keysOf(on.perTick)).toEqual(keysOf(off.perTick));
    }, 120_000);
});
