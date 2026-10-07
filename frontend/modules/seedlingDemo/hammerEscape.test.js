/**
 * hammerEscape — SEEDLING HAMMER-PHASE A: the HIT-AWARE spinner forecast (D1,
 * `levelRun.spinnerForecastWithPress`) and the space-time ESCAPE kernel (D2,
 * `spaceTimeReach.js`) the press kill's `HAMMER_ESCAPE` arm is built on.
 *
 * D1's witness is model vs model and exact: for every press LANDING in a walk,
 * the forecast taken at the AIM tick (before the press exists) is the run's own
 * bodies, rect for rect and `{hits, hitsTimer, destroy}` for each, until the
 * next landing (`witness-seedling-press-forecast.mjs`, whose `witnessWalk` these
 * rows call; the instrument runs every committed tape and every solving residue).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 the forecast drops the knockback (`vx`/`vy` kept from before the hit)
 *        -> every walk's witness red (the instrument: 9 of 9 walks), so the
 *           committed-walk rows below red
 */
import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { witnessWalk } from '../../../scripts/procgen/witness-seedling-press-forecast.mjs';

const SOURCE = atlasLevelSource();
const replayRun = (name) => {
    const tape = loadTape(name);
    const st = stagingFromTape(tape);
    return { tape, make: () => createRunForStaging(st, SOURCE) };
};
const witnessTape = (name, aimBack = 1) => {
    const { tape, make } = replayRun(name);
    return witnessWalk(make, (t) => heldKeysAt(tape, t), tape.tick_count, 700, aimBack);
};

describe('hammer-phase A D1 — the hit-aware forecast (levelRun.spinnerForecastWithPress)', () => {
    it('⛓⛓⛓ the committed chain window: at every landing the forecast taken at the aim tick IS the run, byte for byte', () => {
        const r = witnessTape('r9-solve-18');
        expect(r.landings).toBeGreaterThan(0);
        expect(r.mismatches).toEqual([]);
        expect(r.scoped).toEqual([]);
    }, 120_000);

    it('⛓⛓ the game-recorded phase witness (a phase stall in its walk) is exact too', () => {
        const r = witnessTape('f1c-l18-phase42');
        expect(r.landings).toBeGreaterThan(0);
        expect(r.mismatches).toEqual([]);
    }, 120_000);

    it('⛓⛓ a carried shield is NAMED unmodelled: its bump at the aim tick is not in the forecast, and from the press tick the walk is exact (the dark-stuff latch through the i-frame included)', () => {
        const at = witnessTape('r1-dark-shield-spinner');
        expect(at.mismatches).toEqual([]);
        expect(at.scoped.length).toBeGreaterThan(0);
        expect(at.scoped[0].unmodelled.join()).toMatch(/shield bump/);
        const fromPress = witnessTape('r1-dark-shield-spinner', 0);
        expect(fromPress.landings).toBeGreaterThan(0);
        expect(fromPress.mismatches).toEqual([]);
        expect(fromPress.scoped).toEqual([]);
    }, 120_000);

    it('⛓ it reports, it does not assume: a re-press inside the slash timer is a DASH, a press in the past and a missing point are refused, and spinnerForecast is untouched', () => {
        const { tape, make } = replayRun('r9-solve-18');
        const run = make();
        let pressedAt = null;
        for (let t = 0; t < tape.tick_count && pressedAt === null; t += 1) {
            if (heldKeysAt(tape, t).has('primary')) pressedAt = t;
            run.advance(heldKeysAt(tape, t));
        }
        expect(pressedAt).not.toBeNull();
        const stand = () => ({ x: run.state.x, y: run.state.y });
        const before = JSON.stringify(run.spinnerForecast(60));
        const again = run.spinnerForecastWithPress(60, { pressAt: run.ticksCompleted + 1,
            direction: run.state.direction, positions: stand });
        expect(again.outcome).toBe('dash');
        expect(JSON.stringify(run.spinnerForecast(60))).toBe(before);
        expect(again.rows.length).toBe(60);
        expect(() => run.spinnerForecastWithPress(10, { pressAt: run.ticksCompleted - 1,
            direction: 0, positions: stand })).toThrow(/cannot press in the past/);
        expect(() => run.spinnerForecastWithPress(10, { pressAt: run.ticksCompleted,
            direction: 0, positions: [] })).toThrow(/no player position/);
    }, 60_000);
});
