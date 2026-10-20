/**
 * ⛓⛓ SEEDLING FIDELITY L40GUARD — the L40 chest's guard, game-witnessed (post-wave 19; hammer LB hand-overs #1, #3,
 * #6, #7). Four switches, all OFF (`contactFidelity.js`):
 *
 *  - D1 (no switch: no gap). `bobsoldier@880,832` on the game (p4f headless, three witnesses, worst |Δ| 0): it chases
 *    inside 80 px, the pocket's west wall holds it, it spins at d < 33, it has no return-to-post, and a press lands
 *    from d 20.5, outside its blade (`l40guard-diag-strike`, whose game rows are this file's first fixture).
 *  - D2 `guardApproachStance`: `solverBot.deriveGuardApproach`, asked by `deriveKillByChaser` only when both of its
 *    scans priced nothing. Its refusal names REACH / TIMING / LEASH.
 *  - D3 `coveredGoalRefusal`: `solverBot.coveredGoalOf` — the aim's own tile inside a live body's danger; DETOUR and
 *    the forced-hit rung refuse by name.
 *  - D4 `shakeBandMoot` (#6) and `spinnerSwingLineOfSight` (#7): `levelRun.shakeBandMootNow` and
 *    `levelRun.spinnerSwingBlockedNow`, each witnessed on the game (`fixtures/l40guard-witness/`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { coveredGoalOf, deriveKillByChaser } from './solverBot.js';
import { dangerVolumes } from './dangerMap.js';
import { progressKind } from './solveProgress.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'l40guard-witness');
const tape = (name) => parseTape(readFileSync(join(WIT, `${name}.tape.json`), 'utf8'));
const rowsOf = (name) => JSON.parse(readFileSync(join(WIT, name), 'utf8')).rows;
const GUARD = 'bobsoldier@880,832';
const AIM = { x: 888, y: 834 };

/** Replay `t` for `upto` ticks; `at(run)` after every tick. Returns the run. */
const replay = (t, { upto = t.tick_count, at = null } = {}) => {
    const run = createRunForStaging(stagingFromTape(t), atlasLevelSource());
    for (let i = 0; i < upto; i += 1) {
        run.advance(new Set(heldKeysAt(t, i)));
        at?.(run);
    }
    return run;
};

const SWITCHES = ['guardApproachStance', 'coveredGoalRefusal', 'shakeBandMoot', 'spinnerSwingLineOfSight'];
const ENV = ['SEEDLING_CONTACT_FIDELITY', 'SEEDLING_GUARD_APPROACH_STANCE', 'SEEDLING_COVERED_GOAL_REFUSAL',
    'SEEDLING_SHAKE_BAND_MOOT', 'SEEDLING_SPINNER_SWING_LOS'];

describe('L40GUARD — the guard on the game, and the four switches', () => {
    // ⛓ planning-9's flip (⚖ user "Flip all four", 2026-10-19): the four shipped OFF and ship ON now.
    it.skipIf(ENV.some((k) => process.env[k]))('ships ON', () => {
        for (const k of SWITCHES) {
            expect(CONTACT_FIDELITY_DEFAULTS[k], k).toBe(true);
            expect(CONTACT_FIDELITY[k], k).toBe(true);
        }
    });

    it('D1: the model walks the guard where the game does, and the press at t83 lands from outside the blade', () => {
        const T = tape('l40guard-diag-strike');
        const game = new Map(rowsOf('l40guard-diag-strike.game-guard.json').map((r) => [r[0], r.slice(1)]));
        const seen = [];
        let landedAt = null;
        let dAtLanding = null;
        replay(T, { at: (run) => {
            const g = run.entities('chasers').find((c) => c.id === GUARD);
            const want = game.get(run.ticksCompleted);
            if (want) seen.push([run.ticksCompleted, [g.x, g.y, g.vx, g.vy, g.hits, g.hitsTimer], want]);
            if (landedAt === null && g.hits === 1) {
                landedAt = run.ticksCompleted;
                dAtLanding = Math.hypot(g.x - run.state.x, g.y - run.state.y);
            }
        } });
        expect(seen.length).toBeGreaterThan(100);
        for (const [t, model, want] of seen) expect(model, `t${t}`).toEqual(want);
        expect(landedAt).toBe(85); // pressed at index 83, the hit test's tick
        expect(dAtLanding).toBeGreaterThan(16); // the blade's 8..16 px does not reach
    });

    it('D2: OFF the arm refuses as before; ON the approach pass is asked and its refusal names REACH / TIMING / LEASH', () => {
        const T = tape('l40guard-diag-strike');
        const at = (k) => {
            const run = replay(T, { upto: k });
            return run;
        };
        const ask = (run, on) => withContactFidelity({ guardApproachStance: on },
            () => deriveKillByChaser(run, { id: GUARD }, new Set(), { aim: AIM, dashMode: 'all', tolerance: 1 }));
        const r0 = at(0);
        const off = ask(r0, false);
        expect(off.stance).toBeNull();
        expect(off.why).not.toMatch(/GUARD APPROACH/);
        expect(off.approach).toBeUndefined();
        const on = ask(r0, true);
        expect(on.stance).toBeNull();
        expect(on.why.startsWith(off.why)).toBe(true); // ON only appends
        expect(on.approach).toMatch(/^GUARD APPROACH \(guardApproachStance\): no approach stance for bobsoldier@880,832/);
        expect(on.approach).toMatch(/REACH: 7 lattice cell\(s\).*TIMING: 0 .*LEASH: 6 candidate/);
        expect(on.approach).toMatch(/spinner:spinner@880,848/); // the corridor's spinner reaches every wait
        expect(progressKind(on.why)).toBe('exhausted');
        // beside the guard, its blade lands first: TIMING
        const near = ask(replay(tape('l40guard-walk-east'), { upto: 90 }), true);
        expect(near.approach).toMatch(/TIMING: 7 .*LEASH: 0 /);
    }, 120000);

    it('D3: the chest stance\'s tile lies inside the guard\'s live volume; a corridor cell does not', () => {
        const run = replay(tape('l40guard-diag-strike'), { upto: 0 });
        const opts = { extraVolumes: dangerVolumes(run, 0) };
        const c = coveredGoalOf(run, AIM, null, opts);
        expect(c?.id).toBe(GUARD);
        expect(c.why).toMatch(/^COVERED GOAL \(coveredGoalRefusal\)/);
        expect(progressKind(c.why)).toBe('danger');
        expect(coveredGoalOf(run, { x: 776, y: 856 }, null, opts)).toBeNull();
        expect(coveredGoalOf(run, AIM, null, {})).toBeNull(); // with no danger volume the tile is walkable
    });

    describe('D4 #6 — a shake band over a body at rest is moot (`shakeBandMoot`)', () => {
        const T = tape('l40guard-band-moot');
        it('OFF the live run throws the band at t878 (bob@736,752, at rest at home)', () => {
            expect(() => withContactFidelity({ shakeBandMoot: false }, () => replay(T)))
                .toThrow(/whether bob bob@736,752 is on screen at tick 878/);
        });
        it('ON it steps through, and both shaft bobs equal the game\'s rows t860–1000', () => {
            const game = rowsOf('l40guard-band-moot.game-bobs.json');
            const model = new Map();
            const run = withContactFidelity({ shakeBandMoot: true }, () => replay(T, { at: (rn) => {
                if (rn.ticksCompleted < 860) return;
                for (const c of rn.entities('chasers')) {
                    if (c.id === 'bob@736,752' || c.id === 'bob@736,800') {
                        model.set(`${rn.ticksCompleted} ${c.id}`, [c.x, c.y, c.vx, c.vy, c.hits, c.hitsTimer]);
                    }
                }
            } }));
            expect(run.shakeBandMoots.length).toBeGreaterThan(100);
            expect(run.shakeBandMoots[0]).toEqual({ t: 879, level: 40, id: 'bob@736,752' });
            for (const [t, id, ...want] of game) expect(model.get(`${t} ${id}`), `t${t} ${id}`).toEqual(want);
        }, 60000);
        it('ON a MOVING body under an uncertain band still throws by name (the guard at t169 of walk-east, v ≠ 0)', () => {
            const W = tape('l40guard-walk-east');
            expect(() => withContactFidelity({ shakeBandMoot: true }, () => {
                const run = replay(W);
                for (let i = 0; i < 20; i += 1) run.advance(new Set(['right']));
            })).toThrow(/whether bobsoldier bobsoldier@880,832 is on screen at tick 169/);
        });
    });

    describe('D4 #7 — a sword swing at a spinner through a Solid misses (`spinnerSwingLineOfSight`)', () => {
        const T = tape('l40guard-spinner-los');
        it('OFF the press at t2166 throws the line-of-sight assertion', () => {
            expect(() => withContactFidelity({ shakeBandMoot: true, spinnerSwingLineOfSight: false }, () => replay(T)))
                .toThrow(/the swing at \(728, 685\) reaches spinner@816,848's rect but `collideLine\("Solid", …\)` finds tile:Blue Wall/);
        }, 60000);
        it('ON the blocked test is a miss row and the spinner equals the game\'s rows t2160–2200', () => {
            const game = rowsOf('l40guard-spinner-los.game-spinner.json');
            const model = new Map();
            const run = withContactFidelity({ shakeBandMoot: true, spinnerSwingLineOfSight: true }, () => replay(T, {
                at: (rn) => {
                    if (rn.ticksCompleted < 2160) return;
                    const s = rn.entities('spinnerBodies').find((b) => b.id === 'spinner@816,848');
                    if (s) model.set(rn.ticksCompleted, [s.x, s.y, s.hits, s.hitsTimer]);
                },
            }));
            const rows = run.spinnerPressHits.filter((h) => h.id === 'spinner@816,848');
            expect(rows[0]).toMatchObject({ t: 2167, landed: false, hits: 0 });
            expect(rows[0].why).toMatch(/^collideLine\("Solid"\) meets tile:Blue Wall/);
            expect(rows[1]).toMatchObject({ t: 2168, landed: true, hits: 1, hitsTimer: 30 });
            for (const [t, x, y, hits, hitsTimer] of game) {
                const m = model.get(t);
                expect(Math.abs(m[0] - x), `t${t} x`).toBeLessThan(1e-9);
                expect(Math.abs(m[1] - y), `t${t} y`).toBeLessThan(1e-9);
                expect([m[2], m[3]], `t${t} hits`).toEqual([hits, hitsTimer]);
            }
        }, 60000);
    });
});
