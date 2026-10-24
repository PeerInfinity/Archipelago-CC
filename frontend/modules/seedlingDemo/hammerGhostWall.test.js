/**
 * seedlingDemo/hammerGhostWall.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE D, D2: THE GHOST PRESS THROUGH A WALL.
 *
 * `Player.slash` waives its `collideLine("Solid")` gate for the ghost sword (`|| hasGhostSword`, `Player.as:917`), and
 * so do the model's run (`levelRun.applyThrust`'s ghost arm) and the hammer arc's forecasts and strike (C2's per-weapon
 * row, `GHOST_SPINNER_PRESS_ROW.lineOfSight: false`). C2's L18 witness pressed with a clear line, so no row could see
 * the waiver (C2's mutant M3 was blind). `hammer-d-l39-ghostwall` is the walled stance: a ghost press from the pocket
 * beside L39's dark Blue Wall block lands on `spinner@224,112` from 21.2 px, and the line from the player's point to the
 * body's entity point crosses that wall. The game took the hit at the model's tick (the committed samples beside the
 * tape: `fixtures/hammer-d-ghostwall-witness/`, recorded with `probe-seedling-u9-shield-mobiles.mjs --tape-file`).
 * Not a roster tape: these rows replay it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { GHOST_SPINNER_PRESS, withGhostSpinnerPress } from './ghostSpinnerPress.js';
import { GHOST_SLASH_ANIM_TICKS, GHOST_SWORD_REACH } from './ghostSword.js';
import { SLASH_REACH, distanceRectPoint } from './presses.js';
import { SPINNER } from './spinner.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'hammer-d-ghostwall-witness');
const NAME = 'hammer-d-l39-ghostwall';
const TARGET = 'spinner@224,112';
const PRESS_AT = 573;
const tape = parseTape(readFileSync(join(DIR, `${NAME}.tape.json`), 'utf8'));
const game = JSON.parse(readFileSync(join(DIR, `${NAME}.game-bodies.json`), 'utf8'));

/** The witness walked on the model: its keys, the player's point at the top of each tick, the bodies after it. */
function walk() {
    const staging = stagingFromTape(tape);
    const make = () => createRunForStaging({ ...staging, equips: [] }, atlasLevelSource());
    const held = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    const keys = held.filter(Boolean);
    const run = make();
    const points = [];
    const rows = [];
    const row = () => (run.entities('spinnerBodies') ?? []).map((b) => [b.id, b.hits, b.hitsTimer, b.destroy, b.rect]);
    const boot = row();
    for (let t = 0; t < keys.length; t += 1) {
        points[t] = { x: run.state.x, y: run.state.y };
        run.advance(keys[t]);
        rows[t] = row();
    }
    return { make, keys, points, rows, boot, run };
}

const forecastRow = (f, i) => f.bodies[i].map((b, k) => [b.id, b.hits, b.hitsTimer, b.destroy, f.rows[i][k]]);

describe(`${NAME} — the ghost press through L39's dark Blue Wall (hammer-phase D, D2)`, () => {
    const w = walk();
    const landed = w.run.spinnerPressHits.filter((h) => h.landed);

    it('⛓⛓⛓ the walk lands ONE ghost press on the target, from beyond the sword\'s reach, with no player hit', () => {
        expect(landed.map((h) => [h.t, h.id, h.weapon, h.hits])).toEqual([[PRESS_AT + 1, TARGET, 'ghostsword', 2]]);
        expect(landed[0].reach).toBeGreaterThan(SLASH_REACH);
        expect(landed[0].reach).toBeLessThanOrEqual(GHOST_SWORD_REACH);
        expect(w.run.playerHits.length).toBe(0);
    });

    it('⛓⛓⛓ THE LINE IS WALLED at the landing: the test\'s point (the player before the tick, the body after its '
        + 'own update) reproduces the recorded reach, and its line crosses a Solid tile', () => {
        const h = landed[0];
        const p = w.points[h.t];
        const r = w.make();
        for (let t = 0; t <= h.t; t += 1) r.advance(w.keys[t]);
        // the body after the landing tick's update, before its knockback moves it: the run's row at `h.t` is AFTER
        // the hit, so re-step to the top of `h.t` and read the body the test met from the row the run reports
        const body = w.rows[h.t].find((b) => b[0] === TARGET)[4];
        expect(distanceRectPoint(p.x, p.y, body)).toBeCloseTo(h.reach, 9);
        const blocker = r.collideLineSolid(p.x, p.y, body.x + SPINNER.originX, body.y + SPINNER.originY);
        expect(blocker?.tag).toBe('tile:Blue Wall (dark)');
    });

    it('⛓⛓⛓ THE GAME TOOK THE HIT: its Spinner rows (position, hits, hits_timer) are the model\'s at every '
        + 'sampled tick, and the target goes 0 → 2 / i-frame 30 at the observation after the landing', () => {
        const bad = [];
        for (const [t, x, y, hits, hitsTimer] of game.rows) {
            // observation t is after t ticks: the boot row, then `rows[t - 1]`
            const m = (t === 0 ? w.boot : w.rows[t - 1])?.find((b) => Math.abs(b[4].x + SPINNER.originX - x) < 1e-9
                && Math.abs(b[4].y + SPINNER.originY - y) < 1e-9);
            if (!m || m[1] !== hits || m[2] !== hitsTimer) bad.push(t);
        }
        expect(bad).toEqual([]);
        const hit = game.rows.filter(([t, , , hits]) => t === PRESS_AT + 2 && hits === 2);
        expect(hit.map((r) => r[4])).toEqual([30]);
    });

    it('⛓⛓ ON: `spinnerForecastWithPress` at the press, given the walk\'s points, forecasts the run byte for byte '
        + 'and lands at the run\'s tick', () => {
        expect(GHOST_SPINNER_PRESS.enabled).toBe(true);
        const r = w.make();
        for (let t = 0; t < PRESS_AT; t += 1) r.advance(w.keys[t]);
        const n = w.keys.length - PRESS_AT;
        const f = r.spinnerForecastWithPress(n, { pressAt: PRESS_AT, direction: r.state.direction,
            positions: (t) => w.points[t] });
        const diverged = [];
        for (let i = 0; i < f.bodies.length; i += 1) {
            if (JSON.stringify(forecastRow(f, i)) !== JSON.stringify(w.rows[PRESS_AT + i])) diverged.push(PRESS_AT + i);
        }
        expect(diverged).toEqual([]);
        expect(f.landing?.t ?? null).toBe(PRESS_AT + 1);
    });

    it('⛓⛓ ON: `spinnerFightForecast` advanced along the walk with its presses equals the run at every tick', () => {
        const r = w.make();
        const c = r.spinnerFightForecast();
        const dirAt = new Map(w.run.slashPresses.map((p) => [p.t, p.direction]));
        const diverged = [];
        for (let t = 0; t < w.keys.length; t += 1) {
            c.advance(w.points[t], w.keys[t].has('primary') ? { direction: dirAt.get(t) ?? 0 } : null);
            if (JSON.stringify(forecastRow(c, t)) !== JSON.stringify(w.rows[t])) diverged.push(t);
        }
        expect(diverged).toEqual([]);
        const tests = c.tests.filter((x) => x.landed).map((x) => [x.t, x.id]);
        expect(tests).toEqual([[PRESS_AT + 1, TARGET]]);
    });

    it('OFF (the BEFORE model) the press forecast lands nothing — the control', () => {
        withGhostSpinnerPress(false, () => {
            const r = w.make();
            for (let t = 0; t < PRESS_AT; t += 1) r.advance(w.keys[t]);
            const f = r.spinnerForecastWithPress(GHOST_SLASH_ANIM_TICKS.slash + 2, { pressAt: PRESS_AT,
                direction: r.state.direction, positions: (t) => w.points[t] });
            expect(f.landing ?? null).toBe(null);
        });
    });
});
