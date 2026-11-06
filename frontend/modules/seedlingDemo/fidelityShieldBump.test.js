/**
 * ⛓⛓ SEEDLING FIDELITY SHIELDBUMP (wave 36, ⚖ hammer-2's licence 2026-10-31) — `CONTACT_FIDELITY.forecastShieldBump`
 * (OFF): the spinner forecasts (`levelRun.spinnerForecastWithPress`, `spinnerFightForecast`) step the PLAIN shield's
 * bump on every row they are told the player's state, as `shieldBumpNow` steps it, and report it modelled only when every
 * row was so stepped. Report: `CC/docs/cloud-reports/seedling-fidelity-shieldbump.md`.
 *
 * THE GAME WITNESS (`fixtures/shieldbump-witness/l40button-l42-part0-bumps.json`): the committed L40 tape
 * `l40button-l42-part0` played on the default build (p4g, headless), `botMobiles()`'s Spinner rows at t1304–1347. The
 * run shoves `spinner@192,160` with the plain shield three times there (ledger t1319, t1333, t1334). The model's body
 * equals the game's at every sample, and a forecast taken at t1310 (or t1331) and TOLD the run's own top-of-tick states
 * equals the game across the bumps with the key ON; OFF leaves it on the first bump's next row.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { replayTape } from './jsRuntimeSolver.js';
import { pressEscape } from './solverBot.js';
import { SPINNER } from './spinner.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIELD = ['shield bump (`shieldBumpNow`)'];
const WITNESS = JSON.parse(readFileSync(join(HERE, 'fixtures', 'shieldbump-witness', 'l40button-l42-part0-bumps.json'),
    'utf8'));
const BODY = WITNESS.body;

/**
 * The tape replayed once: per tick `t`, the player at the TOP of tick t (`states`), the body's entity point after the
 * advance of tick t (`after`), the run's own presses, and the spinner bump rows. Taken from a second replay stopped at
 * `at`: the run there, for a forecast.
 */
function replayL42({ at = null } = {}) {
    let run = null;
    const st = createTapeStepper(loadTape(WITNESS.tape), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => {
        run = rn;
    } });
    const states = new Map();
    const after = new Map();
    let r = st.next();
    while (!r.done) {
        if (run !== null) {
            if (at !== null && run.ticksCompleted === at) return { run };
            states.set(run.ticksCompleted, { ...run.state });
            const b = (run.entities('spinnerBodies') ?? []).find((x) => x.id === BODY);
            if (b) after.set(run.ticksCompleted - 1, { x: b.rect.x + SPINNER.originX, y: b.rect.y + SPINNER.originY });
        }
        r = st.next();
    }
    return { run, states, after, presses: new Map(run.slashPresses.map((p) => [p.t, { direction: p.direction }])),
        bumps: run.shieldBumps.filter((b) => b.family === 'spinner') };
}
const L42 = replayL42();

/** The game's body after the advance of tick T: its Spinner row nearest the run's (`botMobiles` carries no census id). */
function gameAfter(T) {
    const s = WITNESS.samples.find((x) => x.t === T + 1);
    const m = L42.after.get(T);
    if (!s || !m) return null;
    return s.spinners.reduce((a, b) => (Math.hypot(b.x - m.x, b.y - m.y) < Math.hypot(a.x - m.x, a.y - m.y) ? b : a));
}

/** Both forecasts from the run at `from`, told the run's own states (and the cursor its presses), as entity points. */
function forecastsAt(from, to, on) {
    const { run } = replayL42({ at: from });
    return withContactFidelity({ forecastShieldBump: on }, () => {
        const n = run.ticksCompleted;
        const need = to - n;
        const at = (t) => L42.states.get(t) ?? null;
        const f = run.spinnerForecastWithPress(need, { pressAt: n + need, direction: run.state.direction,
            positions: at, players: at });
        const F = run.spinnerFightForecast();
        for (let i = 0; i < need; i += 1) F.advance(L42.states.get(n + i), L42.presses.get(n + i) ?? null);
        const k = (run.entities('spinnerBodies') ?? []).findIndex((b) => b.id === BODY);
        const pt = (rows, i) => ({ x: rows[i][k].x + SPINNER.originX, y: rows[i][k].y + SPINNER.originY });
        return { n, f, F, press: (T) => pt(f.rows, T - n), cursor: (T) => pt(F.rows, T - n) };
    });
}
const px = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** The first tick in [from, to) whose point leaves the game's, or null. */
function firstLeave(pointAt, from, to) {
    for (let T = from; T < to; T += 1) if (px(pointAt(T), gameAfter(T)) > 0) return T;
    return null;
}

describe('fidelity SHIELDBUMP — the switch', () => {
    it('ships OFF; `SEEDLING_FORECAST_SHIELD_BUMP` turns it on in a node process', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.forecastShieldBump).toBe(false);
        expect(CONTACT_FIDELITY.forecastShieldBump).toBe(process.env.SEEDLING_FORECAST_SHIELD_BUMP === '1');
    });
});

describe('fidelity SHIELDBUMP — the game witness on `l40button-l42-part0` (p4g, L40, spinner@192,160)', () => {
    it('the run shoves the body with the plain shield three times, and equals the game at every sample (0 px, and v)', () => {
        expect(L42.bumps.map((b) => [b.t, b.id, b.shoved])).toEqual([[1319, BODY, true], [1333, BODY, true],
            [1334, BODY, true]]);
        let n = 0;
        for (let T = WITNESS.from; T < WITNESS.to; T += 1) {
            const g = gameAfter(T);
            if (g === null) continue;
            expect(px(L42.after.get(T), g)).toBe(0);
            n += 1;
        }
        expect(n).toBeGreaterThanOrEqual(38);
    });

    it('from t1310, told the run\'s states: ON both forecasts equal the game through the t1318 bump; OFF leaves at t1319', () => {
        const off = forecastsAt(1310, 1333, false);
        const on = forecastsAt(1310, 1333, true);
        expect(firstLeave(off.press, 1310, 1333)).toBe(1319);
        expect(firstLeave(off.cursor, 1310, 1333)).toBe(1319);
        expect(firstLeave(on.press, 1310, 1333)).toBe(null);
        expect(firstLeave(on.cursor, 1310, 1333)).toBe(null);
        // the window's last row is tick 1332: its bump is stepped there, and moves the body from t1333 on
        expect(on.f.shieldBump.bumps.map((b) => b.t)).toEqual([1318, 1332]);
        expect(on.F.shieldBumps.map((b) => b.t)).toEqual([1318, 1332]);
        // the shove's velocity is the run's ledger's (the ledger's `t` is the tick's end, `ticksCompleted + 1`)
        expect(on.f.shieldBump.bumps.map((b) => b.v)).toEqual(L42.bumps.slice(0, 2).map((b) => b.v));
        // every row was stepped with a state, so ON names nothing; OFF names the carried shield
        expect(on.f.unmodelled).toEqual([]);
        expect(on.F.unmodelled).toEqual([]);
        expect(off.f.unmodelled).toEqual(SHIELD);
        expect(off.f.shieldBump).toBeUndefined();
        expect(off.F.shieldBumps).toBeUndefined();
    });

    it('from t1331 (rock cells at goneAt, `rockGoneFencepost` OFF): ON equals the game through the t1332 and t1333 bumps; OFF leaves at t1333', () => {
        withContactFidelity({ rockGoneFencepost: false }, () => {
            const off = forecastsAt(1331, 1340, false);
            const on = forecastsAt(1331, 1340, true);
            expect(firstLeave(off.press, 1331, 1340)).toBe(1333);
            expect(firstLeave(on.press, 1331, 1340)).toBe(null);
            expect(firstLeave(on.cursor, 1331, 1340)).toBe(null);
            expect(on.F.shieldBumps.map((b) => b.t)).toEqual([1332, 1333]);
        });
    });

    it('⚠ from t1331 with `rockGoneFencepost` ON: the frozen-world bound again — breakablerock@176,128/@176,144 (goneAt 1331) are still SOLID at the forecast\'s start and open at t1333 (as on the game), so both arms leave at t1333; the RUN still equals the game', () => {
        // KNOCKBACK376 (wave 37c): a broken rock's cell opens two observations after goneAt. The forecast reuses the world
        // as it stood at t1331 (the row below names that bound); the run's world drops the two cells at t1333.
        withContactFidelity({ rockGoneFencepost: true }, () => {
            const off = forecastsAt(1331, 1340, false);
            const on = forecastsAt(1331, 1340, true);
            expect(firstLeave(off.press, 1331, 1340)).toBe(1333);
            expect(firstLeave(on.press, 1331, 1340)).toBe(1333);
        });
    });

    it('⚠ the frozen-world bound is not the bump\'s: from t1310 past t1333 both arms leave the game on one collision', () => {
        // the forecasts reuse the world as it stood at their start (blocks, activators); the run's world moved by t1333
        const on = forecastsAt(1310, 1340, true);
        expect(firstLeave(on.cursor, 1310, 1340)).toBe(1333);
    });
});

// ── leg 860's staging (hammer SPIN's fixture): the stands beside spinner@816,848 ─────────────────────────────────────
const REQ = (() => {
    const row = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'spin-witness', 'leg860-request.json.gz')))
        .toString('utf8'));
    const c = row.request;
    return restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
})();
const SOURCE = levelSourceFromAtlas(REQ.source.records);
function standAt(x, y, items = {}) {
    const staging = { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 },
        seam: { ...REQ.staging.seam, items: { ...REQ.staging.seam.items, ...items } } };
    return replayTape({ staging, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true,
        equips: REQ.equips ?? null, holds: REQ.holds ?? null });
}
const NO = new Set();
/** Drive a stand along `keys`, recording the top-of-tick states and the bodies' rects after each tick. */
function driveStand(x, y, keys) {
    const run = standAt(x, y);
    const states = [];
    const rows = [];
    const b0 = run.shieldBumps.length;
    for (const k of keys) {
        states.push({ ...run.state });
        run.advance(k);
        rows.push((run.entities('spinnerBodies') ?? []).map((b) => b.rect));
    }
    return { states, rows, bumps: run.shieldBumps.slice(b0).filter((b) => b.family === 'spinner'),
        hits: run.playerHits.length };
}
function firstRowOff(rows, runRows) {
    for (let i = 0; i < rows.length; i += 1) {
        if (rows[i].some((r, k) => px(r, runRows[i][k]) > 0)) return i;
    }
    return null;
}

describe('fidelity SHIELDBUMP — leg 860\'s stands (spinner@816,848)', () => {
    // SPIN's exhausted stand, the press, the train stood, then held left INTO the body: the run shoves it at tick 11
    const keys = [new Set(['left']), new Set(['primary']), ...Array(6).fill(NO), ...Array(12).fill(new Set(['left']))];
    const driven = driveStand(829, 860, keys);
    const ask = (on, players) => withContactFidelity({ forecastShieldBump: on }, () => {
        const run = standAt(829, 860);
        const at = (t) => driven.states[t - run.ticksCompleted] ?? null;
        return run.spinnerForecastWithPress(keys.length, { pressAt: run.ticksCompleted + 1,
            direction: driven.states[1].direction, positions: at, players: players ? at : null });
    });

    it('walked into the body: ON (told every state) = the run at every row; OFF leaves it the row after the shove', () => {
        expect(driven.bumps.map((b) => [b.t - 1, b.id, b.shoved])).toEqual([[11, 'spinner@816,848', true]]);
        const off = ask(false, true);
        const on = ask(true, true);
        expect(firstRowOff(off.rows, driven.rows)).toBe(12);
        expect(firstRowOff(on.rows, driven.rows)).toBe(null);
        expect(on.unmodelled).toEqual([]);
        expect(on.shieldBump).toMatchObject({ stepped: keys.length, uncoveredFrom: null });
    });

    it('told only the points the tests ask (pressEscape\'s shape): rows past the last test are not stepped, so it names the bump', () => {
        const on = ask(true, false);
        // the train's tests ask t1..t6; the shove at t11 is past them
        expect(on.shieldBump.stepped).toBe(7);
        expect(on.shieldBump.uncoveredFrom).toBe(7);
        expect(on.unmodelled).toEqual(SHIELD);
        expect(firstRowOff(on.rows, driven.rows)).toBe(12);
    });

    it('a zero-row probe steps no row, so it names the bump (pressEscape\'s first read is unchanged)', () => {
        const run = standAt(829, 860);
        const r = withContactFidelity({ forecastShieldBump: true }, () => run.spinnerForecastWithPress(0,
            { pressAt: run.ticksCompleted + 1, direction: 2, positions: [] }));
        expect(r.unmodelled).toEqual(SHIELD);
        expect(withContactFidelity({ forecastShieldBump: true }, () => run.spinnerFightForecast().unmodelled))
            .toEqual(SHIELD);
    });

    it('the dark shield is not the plain bump: still named, nothing stepped', () => {
        const run = standAt(829, 860, { hasDarkShield: true });
        const at = (t) => driven.states[t - run.ticksCompleted] ?? null;
        const r = withContactFidelity({ forecastShieldBump: true }, () => run.spinnerForecastWithPress(keys.length,
            { pressAt: run.ticksCompleted + 1, direction: 2, positions: at, players: at }));
        expect(r.unmodelled).toEqual(SHIELD);
        expect(r.shieldBump).toBeUndefined();
    });

    it('⚠ a bump whose gate a same-tick CONTACT opens is outside the forecast: the approach stand\'s t0 shove', () => {
        // the player stands still at the top of t0; the spinner's contact knocks it back, and that live `v` bumps
        const k2 = [new Set(['right']), new Set(['primary']), ...Array(6).fill(NO)];
        const d = driveStand(820, 854, k2);
        expect(d.bumps.map((b) => b.t - 1)).toEqual([0]);
        expect(d.hits).toBe(1);
        const on = withContactFidelity({ forecastShieldBump: true }, () => {
            const run = standAt(820, 854);
            const at = (t) => d.states[t] ?? null;
            return run.spinnerForecastWithPress(k2.length, { pressAt: 1, direction: d.states[1].direction,
                positions: at, players: at });
        });
        expect(on.shieldBump.bumps).toEqual([]);
        expect(firstRowOff(on.rows, d.rows)).toBe(1);
    });
});

describe('fidelity SHIELDBUMP — pressEscape at SPIN\'s four stands, the key ON alone', () => {
    const STANDS = [[808, 854, 'right'], [814, 854, 'right'], [829, 860, 'left'], [820, 854, 'right']];
    it('makes no claim, as OFF: its probe is a zero-row forecast, which still names the carried shield', () => {
        for (const [x, y, key] of STANDS) {
            const esc = (on) => withContactFidelity({ forecastShieldBump: on }, () => {
                const run = standAt(x, y);
                return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [new Set([key])],
                    pressAt: run.ticksCompleted + 1, id: 'spinner@816,848', caller: 'aim' });
            });
            expect(esc(true)).toEqual(esc(false));
            expect(esc(true)).toEqual({ ok: false, claim: false,
                why: 'the forecast names shield bump (`shieldBumpNow`) as unmodelled' });
        }
    });
});
