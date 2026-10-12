/**
 * SEEDLING FIDELITY L74LEG624 (wave 14, planner `seedling-fidelity-planning-6`) — the three switches this slice adds,
 * all OFF by default (`contactFidelity.js`):
 *
 *   · `strikeIframeLapse` (D3, STRIKE_IFRAME_LAPSE) — `strikePolicy` gates a press on its hit TESTS, not on its press
 *     tick: a body whose (one-tick-old) `hitsTimer` lapses inside the window `T+1 … T+SLASH_HIT_TICKS` is admitted
 *     (`iframeLapse`), and a body in its death (`spent`) is refused. Witnessed on the game by hammer C4's
 *     `tape-l74-624-press84`/`-press85` and by this slice's ON-planned stance walk (the report's evidence).
 *   · `fallRockPostFall` (D2, FALLROCK_POSTFALL) — `buildLevelWorld` builds a cleared non-arena `FallRock` FALLEN
 *     (`FallRock.as:42-47`) instead of refusing the clear. Game witness: `l74leg624-postfall-reentry` (L74 booted
 *     with {74,2} staged, the player held down onto the rock: 71 samples, 0 px, clock shift [0]).
 *   · `forecastSpeedByTerrain` (D4) — `chaserForecastNow` runs K2's `LavaRunner` speed tail on its clone.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { CONTACT_READING_LAG, IFRAME_LAPSE_SPARE_TESTS, iframeLapse, projectedHitsTimer, strikeCandidates, vetoedInRect }
    from './strikePolicy.js';
import { SLASH_HIT_TICKS, SLASH_SCALE_NORMAL } from './solverView.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, postFallRockOf } from './levelWorld.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const WPOST = witness('l74leg624-postfall-reentry');
const levelSource = atlasLevelSource();
const SWITCHES = ['strikeIframeLapse', 'fallRockPostFall', 'forecastSpeedByTerrain'];

describe('L74LEG624 — the switches', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_STRIKE_IFRAME_LAPSE
        || !!process.env.SEEDLING_FALLROCK_POSTFALL || !!process.env.SEEDLING_FORECAST_SPEED_BY_TERRAIN)(
        // ⛓ fidelity FLIP14: shipped OFF; ⚖ (user, 2026-10-12, "All three ON") ON since the wave-14 flip.
        'all three ship ON (the wave-14 flip)', () => {
            for (const k of SWITCHES) {
                expect(CONTACT_FIDELITY_DEFAULTS[k]).toBe(true);
                expect(CONTACT_FIDELITY[k]).toBe(true);
            }
        });
});

describe('L74LEG624 D3 — `iframeLapse`: the window reaches the lapse, derived from the two lags', () => {
    it('the measured witnesses: an aim at reading 5 (t83) or 4 (t84) lands its test at t87', () => {
        // hammer C4: the t57 hit's i-frame lapses at t87; the readings at t83/t84's decisions are 5/4.
        expect(iframeLapse(5, 83)).toEqual({ hitsTimer: 5, firstTest: 3, firstTick: 87 });
        expect(iframeLapse(4, 84)).toEqual({ hitsTimer: 4, firstTest: 2, firstTick: 87 });
    });
    it('one spare test: an aim admits a reading ≤ 6 (lapse on test 4 of 5), a press on this tick ≤ 5', () => {
        expect(IFRAME_LAPSE_SPARE_TESTS).toBe(1);
        const last = SLASH_HIT_TICKS - IFRAME_LAPSE_SPARE_TESTS;
        const aimMax = last + CONTACT_READING_LAG + 1;
        expect(aimMax).toBe(6);
        expect(iframeLapse(aimMax, 0)).toMatchObject({ firstTest: last });
        expect(iframeLapse(aimMax + 1, 0)).toBeNull(); // L6: reading 7 lands nothing on the game's drain
        expect(iframeLapse(aimMax - 1, 0, 0)).toMatchObject({ firstTest: last });
        expect(iframeLapse(aimMax, 0, 0)).toBeNull();
        // one derivation: admitted exactly when the projection at test `last` is ≤ 0
        for (let r = 1; r <= 12; r += 1) {
            expect(iframeLapse(r, 0) !== null).toBe(projectedHitsTimer(r, last) <= 0);
        }
    });
});

describe('L74LEG624 D3 — `strikeCandidates` under the switch', () => {
    // A body due east of the player, inside the plain swing's rect facing east (direction 0, `slashRect`).
    const player = { x: 100, y: 100 };
    const body = (over = {}) => ({ id: 'lavarunner@0,0', as3: 'Enemy', enemyClass: 'LavaRunner',
        rect: { x: 104, y: 96, w: 8, h: 8, right: 112, bottom: 104 }, hits: 1, hitsTimer: 4, ...over });
    const ask = (b, opts = {}) => strikeCandidates(player, [b], { facingToward: () => 0, owed: new Map(), tick: 84,
        ...opts });
    it('OFF: a live i-frame refuses, as before', () => {
        withContactFidelity({ strikeIframeLapse: false }, () => {
            const r = ask(body());
            expect(r.chosen).toEqual([]);
            expect(r.rejected[0].why).toMatch(/hitsTimer 4/);
        });
    });
    it('ON: a reading whose lapse lands inside the window is admitted, and the row says where it lands', () => {
        withContactFidelity({ strikeIframeLapse: true }, () => {
            const r = ask(body());
            expect(r.chosen.map((c) => c.id)).toEqual(['lavarunner@0,0']);
            expect(r.chosen[0].iframeLapse).toEqual({ hitsTimer: 4, firstTest: 2, firstTick: 87 });
            expect(ask(body({ hitsTimer: 7 })).chosen).toEqual([]);
        });
    });
    it('ON: the `owed` rule still holds, and a body in its death (`spent`) is refused at any reading', () => {
        withContactFidelity({ strikeIframeLapse: true }, () => {
            const owed = new Map([['lavarunner@0,0', 82]]);
            expect(ask(body({ hitsTimer: 0 }), { owed }).rejected[0].why).toMatch(/my own press at tick 82/);
            expect(ask(body({ hitsTimer: 0, spent: true })).rejected[0].why).toMatch(/hitsMax/);
            expect(ask(body({ hitsTimer: 4, spent: true })).chosen).toEqual([]);
        });
    });
    it('ON: the veto asks a body whose i-frame lapses inside the window (the slash would kill it)', () => {
        const veto = (o) => (o.id === 'bulb@0,0' ? { why: 'vetoed' } : null);
        const bulb = { id: 'bulb@0,0', as3: 'Enemy', enemyClass: 'Bulb', rect: { x: 104, y: 96, w: 8, h: 8, right: 112, bottom: 104 },
            hits: 0, hitsTimer: 4 };
        withContactFidelity({ strikeIframeLapse: false }, () => {
            expect(vetoedInRect(player, [bulb], 0, SLASH_SCALE_NORMAL, veto)).toBeNull();
        });
        withContactFidelity({ strikeIframeLapse: true }, () => {
            expect(vetoedInRect(player, [bulb], 0, SLASH_SCALE_NORMAL, veto)).toMatchObject({ id: 'bulb@0,0' });
            // the veto takes no spare test: a lapse on the window's last test is still a possible death
            expect(vetoedInRect(player, [{ ...bulb, hitsTimer: 7 }], 0, SLASH_SCALE_NORMAL, veto)).toMatchObject({ id: 'bulb@0,0' });
            expect(vetoedInRect(player, [{ ...bulb, hitsTimer: 8 }], 0, SLASH_SCALE_NORMAL, veto)).toBeNull();
        });
    });
});

describe('L74LEG624 D2 — a cleared non-arena FallRock is built FALLEN (ON) or refused (OFF)', () => {
    const rec74 = () => levelSource(74);
    it('OFF: L74 with {74,2} cleared is the arm refusal, as before', () => {
        withContactFidelity({ fallRockPostFall: false }, () => {
            expect(() => buildLevelWorld(rec74(), { cleared: [2] })).toThrow(/clears tag 2, which is a "fallrock"/);
        });
    });
    it('ON: the rock is a `postFall` roster row; L82\'s non-arena `fallrocklarge` stays refused', () => {
        withContactFidelity({ fallRockPostFall: true }, () => {
            const w = buildLevelWorld(rec74(), { cleared: [2] });
            expect(w.fallRocks.filter((r) => r.postFall)).toEqual([expect.objectContaining({
                id: 'fallrock@288,144', persistTag: 2 })]);
            expect(postFallRockOf({ type: 'fallrocklarge' })).toBe(false);
            expect(() => buildLevelWorld(levelSource(82), { cleared: [1] })).toThrow(/fallrocklarge/);
        });
    });
    it('ON: the game witness (L74 booted with {74,2}, held down onto the rock) replays at 0 px; the rock is Solid', () => {
        withContactFidelity({ fallRockPostFall: true }, () => {
            const st = createTapeStepper(parseTape(JSON.stringify(WPOST.tape)), { levelSource });
            const col = [];
            let r = st.next();
            while (!r.done) {
                col[r.value.observation.t] = r.value.observation;
                r = st.next();
            }
            const bad = WPOST.samples.filter((s) => !col[s.t] || col[s.t].x !== s.player.x || col[s.t].y !== s.player.y
                || col[s.t].level !== s.level);
            expect(bad.map((s) => s.t)).toEqual([]);
            expect(WPOST.samples.length).toBe(71);
            // held down from the boot: the player rests on the rock's top (y 144 − the box's 3) and never reaches the
            // L73 teleporter under it.
            expect(WPOST.samples.filter((s) => s.t >= 8 && s.t <= 20).every((s) => s.player.y === 141)).toBe(true);
            expect(WPOST.samples.every((s) => s.level === 74)).toBe(true);
        });
    });
    it('OFF: the same tape is refused at the build', () => {
        withContactFidelity({ fallRockPostFall: false }, () => {
            expect(() => createRunForStaging(stagingFromTape(parseTape(JSON.stringify(WPOST.tape))), levelSource))
                .toThrow(/fallrock/);
        });
    });
});

describe('L74LEG624 D4 — the chaser forecast re-chooses a lavarunner\'s speed by terrain', () => {
    // L74 booted with {74,2} staged (no arrival freeze) and walked west as leg 624's first 54 ticks do:
    // `lavarunner@208,96` chases across the lava south of its cell.
    const tape = () => parseTape(JSON.stringify({ ...WPOST.tape, name: 'l74leg624-forecast-speed', tick_count: 54,
        inputs: [{ key: 'up', from: 0, to: 11 }, { key: 'down', from: 11, to: 12 }, { key: 'up', from: 12, to: 14 },
            { key: 'down', from: 16, to: 19 }, { key: 'up', from: 20, to: 22 }, { key: 'left', from: 26, to: 54 }] }));
    const parted = () => {
        const t = tape();
        const run = createRunForStaging(stagingFromTape(t), levelSource);
        const forecast = run.chaserForecast();
        const held = (k) => new Set(t.inputs.filter((i) => i.from <= k && k < i.to).map((i) => i.key));
        const out = [];
        for (let k = 0; k < t.tick_count; k += 1) {
            const pre = { ...run.state };
            const proj = forecast.step(pre);
            run.advance(held(k));
            const live = (run.entities('chasers') ?? []).find((c) => c.id === 'lavarunner@208,96');
            const f = proj.find((c) => c.id === 'lavarunner@208,96');
            if (Math.abs(live.x - f.x) > 1e-9 || Math.abs(live.y - f.y) > 1e-9) out.push(k);
        }
        return out;
    };
    it('OFF: the forecast and the run part', () => {
        withContactFidelity({ fallRockPostFall: true, forecastSpeedByTerrain: false }, () => {
            expect(parted().length).toBeGreaterThan(0);
        });
    });
    it('ON: they agree at every tick', () => {
        withContactFidelity({ fallRockPostFall: true, forecastSpeedByTerrain: true }, () => {
            expect(parted()).toEqual([]);
        });
    });
});
