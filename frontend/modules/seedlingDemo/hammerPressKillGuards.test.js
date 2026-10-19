/**
 * ⛓⛓ SEEDLING HAMMER-PHASE LB (HX) — the press kill's two guards (`pressKillGuards.js`), both OFF.
 *
 * The state is fidelity L40CONTACT D4's: leg 414's atlas boot (`fixtures/hammer-lb-hx/boot-414.json`, the ghost sword,
 * goal the chest (880,816)), at the shipped defaults.
 *  - HO1 (`PRESS_KILL_SHAKE_GUARD`): the press kill's own keys to t2439 (`ho1-keys-t2439.json`, the base's solve,
 *    recorded tick by tick: two deaths, at t1202 and t2395), then the derivation the kill asks on that tick,
 *    `deriveStrike(run, 'spinner@880,848', ∅, 0)`. OFF the chaser forecast's shake-band throw escapes it (the crash
 *    the sweep saw); ON the candidates whose preview meets the band are refused by name, and no strike is returned
 *    (the kill then waits, re-deriving each tick).
 *  - HO2 (`PRESS_KILL_REBOOT_GUARD`): `solveSegment` from the boot, its `advance` capped at t1300. OFF the kill
 *    carries on past the first death (t1202) and meets the cap; ON it is refused by name on the death's tick.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { SolverRefusal, deriveStrike, solveSegment } from './solverBot.js';
import { progressKind } from './solveProgress.js';
import {
    PRESS_KILL_REBOOT_GUARD, PRESS_KILL_REBOOT_GUARD_DEFAULT, PRESS_KILL_SHAKE_GUARD, PRESS_KILL_SHAKE_GUARD_DEFAULT,
    isShakeBandThrow, withPressKillRebootGuard, withPressKillShakeGuard,
} from './pressKillGuards.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'hammer-lb-hx');
const ENV = globalThis.process?.env ?? {};
const OPTED = ENV.SEEDLING_PRESS_KILL_SHAKE_GUARD === '1' || ENV.SEEDLING_PRESS_KILL_REBOOT_GUARD === '1';

/** 414's atlas boot with the ghost sword, as fidelity's `cw-solve.mjs --view=… --ghost=1` stages it. */
function stagingOf() {
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(join(FIX, 'boot-414.json'), 'utf8'))));
    staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
    return staging;
}

/** The run at t2439: the base's press kill, key for key. */
function runAtHo1() {
    const { keys, ticks } = JSON.parse(readFileSync(join(FIX, 'ho1-keys-t2439.json'), 'utf8'));
    const run = createRunForStaging(stagingOf(), atlasLevelSource());
    for (let t = 0; t < ticks; t += 1) run.advance(new Set(keys[t]));
    return run;
}

const TARGET = 'spinner@880,848';

describe('hammer-phase LB — the press kill guards', () => {
    it.skipIf(OPTED)('ship OFF', () => {
        expect(PRESS_KILL_SHAKE_GUARD.enabled).toBe(false);
        expect(PRESS_KILL_SHAKE_GUARD_DEFAULT).toBe(false);
        expect(PRESS_KILL_REBOOT_GUARD.enabled).toBe(false);
        expect(PRESS_KILL_REBOOT_GUARD_DEFAULT).toBe(false);
    });

    it('isShakeBandThrow names the forecast\'s throw and nothing else', () => {
        const forecast = new Error('chaserForecast: whether bob bob@736,752 is on screen depends on where inside '
            + '`Game.shake`\'s jiggle the camera landed, and the two draws …');
        const live = new Error('levelRun: whether bob bob@736,752 is on screen at tick 9 depends on where inside '
            + '`Game.shake`\'s jiggle the camera landed …');
        expect(isShakeBandThrow(forecast)).toBe(true);
        expect(isShakeBandThrow(live)).toBe(false);
        expect(isShakeBandThrow(new TypeError(forecast.message))).toBe(false);
        expect(isShakeBandThrow(forecast.message)).toBe(false);
    });

    it('HO1: at t2439 the strike preview throws OFF; ON the band\'s candidates are refused by name', () => {
        const run = runAtHo1();
        // ⛔ the precondition, so a drifted fixture fails by name rather than by a missing throw
        expect(run.ticksCompleted).toBe(2439);
        expect(run.ledger('playerDeaths').map((d) => d.t)).toEqual([1202, 2395]);
        const body = run.entities('spinnerBodies').find((b) => b.id === TARGET);
        expect(body.hitsTimer).toBe(0);
        let off = null;
        try {
            withPressKillShakeGuard(false, () => deriveStrike(run, TARGET, new Set(), 0));
        } catch (e) { off = e; }
        expect(off).not.toBeNull();
        expect(isShakeBandThrow(off)).toBe(true);
        expect(off.message).toMatch(/bob@736,752 is on screen/);
        const on = withPressKillShakeGuard(true, () => deriveStrike(run, TARGET, new Set(), 0));
        expect(on.cell).toBeNull();
        const shake = on.rejected.filter((r) => /shake band/.test(r.why));
        expect(shake.length).toBeGreaterThan(0);
        expect(shake[0].why).toMatch(/^the preview cannot be asked inside the camera's shake band: whether bob bob@736,752/);
        expect(shake.map((r) => progressKind(r))).toEqual(shake.map(() => 'unmodelled'));
        // ⛓ the admission's continuation (`continuation: true`): a band candidate's walk reads as truncated, so the
        // scan goes on past it to a strike whose own preview the band does not touch (measured at the base)
        const cont = withPressKillShakeGuard(true, () => deriveStrike(run, TARGET, new Set(), 0, { continuation: true }));
        expect({ cell: cont.cell, pressAt: cont.pressAt, fromContinuation: cont.fromContinuation })
            .toEqual({ cell: { x: 664, y: 680 }, pressAt: 3276, fromContinuation: true });
        // ⛔ the run is not touched by the derivation, either way
        expect(run.ticksCompleted).toBe(2439);
    }, 120_000);

    /** One bounded solve: OFF ⇒ the sentinel's tick; ON ⇒ the refusal. */
    const capped = (on) => {
        const staging = stagingOf();
        const run = createRunForStaging(staging, atlasLevelSource());
        const advance = run.advance.bind(run);
        run.advance = (k) => {
            if (run.ticksCompleted >= 1300) throw Object.assign(new Error('LB sentinel: t1300'), { sentinel: true });
            return advance(k);
        };
        try {
            withPressKillRebootGuard(on, () => solveSegment({ run, goals: [{ kind: 'collect-placement',
                placement: { x: 880, y: 816 } }], name: 'lb-ho2', boot: staging.boot, dashMode: 'all' }));
        } catch (e) {
            return { e, t: run.ticksCompleted, deaths: run.ledger('playerDeaths').map((d) => d.t) };
        }
        return { e: null, t: run.ticksCompleted, deaths: [] };
    };

    it('HO2 OFF: the press kill carries on past the death at t1202', () => {
        const r = capped(false);
        expect(r.e?.sentinel).toBe(true);
        expect(r.t).toBe(1300);
        expect(r.deaths).toEqual([1202]);
    }, 600_000);

    it('HO2 ON: the press kill is refused by name on the tick of the first death', () => {
        const r = capped(true);
        expect(r.e).toBeInstanceOf(SolverRefusal);
        expect(r.t).toBe(1202);
        expect(r.deaths).toEqual([1202]);
        // ⚠ fields, never the whole error (a failing match on a refusal can OOM the pretty-printer)
        expect(r.e.obstacle).toEqual({ kind: 'danger', id: 'bob@736,752' });
        expect(r.e.perTick.length).toBe(1202);
        expect(String(r.e.message)).toMatch(/the player died at t1202 \(chaser bob@736,752\) while pressing spinner@880,848, after 1 landing\(s\)/);
        expect(progressKind(r.e)).toBe('danger');
    }, 600_000);
});
