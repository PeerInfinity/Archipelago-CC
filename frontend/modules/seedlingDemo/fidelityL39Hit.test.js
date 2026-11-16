/**
 * ⛓⛓ SEEDLING FIDELITY L39HIT (wave 47) — the seed-1 whole-game walk's L39 hit, and `pulserForecastPulse`.
 *
 * The walk (hammer's walk check 2, arm Ac) played a SOLVED 2864 t dashless plan in L39 ("Level 039 - Totem Part 72,40",
 * kill,l39shaft,rope,walk) and the game took one hit at tick 1521 of it, with 0 hits billed. The fixture
 * (`fixtures/l39hit/l39hit-walk-seam30036.json`) is that plan rebuilt: the page's own request (probe-captured at the walk's
 * inventory, arrival and set) solved at seam 30036, and its game rows on a fresh p4g page.
 *
 * What the rows say (the report: `CC/docs/cloud-reports/seedling-fidelity-l39hit.md`):
 *   · the MODEL steps the hit exactly — `spinner@112,88`'s hammer (`Spinner.as:66-76` → `Player.hit`, `Player.as:1374-1401`)
 *     at t1522, the game's tick, at 0 px; the solver accepted the plan anyway;
 *   · the walk segment that took it (t1310 → t1679) was certified against `run.spinnerForecast`, which steps only the bodies:
 *     `pulser@64,96` hits that spinner at t1317 (`Pulser.as:87-116` → `Enemy.hit`, force 6), so the forecast cut at t1310
 *     leaves its line at t1318 and is ~88 px off at t1522;
 *   · `pulserForecastPulse` ON steps the room's pulsers inside the forecast: exact through the hit, the hammer priced at
 *     t1522, and the same request plans a 3813 t walk with no hit (game-witnessed: the report's evidence).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { spinnerDanger } from './dangerMap.js';
import { l39LevelSource } from './fidelityL39Shaft.js';
import { ANYTIME_PASSES, liveOf, solveAnytime } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

const FIX = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'l39hit', 'l39hit-walk-seam30036.json'), 'utf8'));
const TAPE = parseTape(JSON.stringify(FIX.tape));
const ID = 'spinner@112,88';
const HIT = 1522; // the game's tick (and the model's): the advance that lands the hammer
const WALK_FROM = 1310; // the walk segment's first tick (the solver's decision row)
const BASE = await l39LevelSource('delivered');
/** The delivered set with the page's own L39 record (its `apitem@72,40`): the walk's request's level source. */
const LEVELS = (n) => (n === 39 ? FIX.l39Record : BASE(n));
const STAGING = { ...stagingFromTape(TAPE), equips: [] };
const EQUIPS = new Map((TAPE.equips ?? []).map((e) => [e.t, e.slot]));
const ON = (fn) => withContactFidelity({ pulserForecastPulse: true }, fn);
const OFF = (fn) => withContactFidelity({ pulserForecastPulse: false }, fn);

/** A fresh run at the request's staging, advanced through the tape's first `n` ticks (its equips at their index). */
function runTo(n) {
    const run = createRunForStaging(STAGING, LEVELS, { scratchPersistence: true });
    for (let i = 0; i < n; i += 1) {
        if (EQUIPS.has(i)) run.equipNow(EQUIPS.get(i));
        run.advance(heldKeysAt(TAPE, i));
    }
    return run;
}

/** The request the page made (`wasm-location-39`, the page budget), from the tape's staging. */
function solveTheRequest() {
    const live = liveOf(createRunForStaging(STAGING, LEVELS, { scratchPersistence: true }));
    return solveAnytime({ staging: STAGING, perTick: [], live, levelSource: LEVELS,
        solverGoal: { kind: 'collect-placement', placement: { x: 72, y: 40 } }, name: 'wasm-location-39',
        scratchPersistence: true, equips: null, budgetWork: 640, upgradeWindowWork: 85 }, { passes: ANYTIME_PASSES });
}

/** A plan's drive replayed on a fresh run: its `playerHits` rows. */
function hitsOfPlan(plan) {
    const run = createRunForStaging(STAGING, LEVELS, { scratchPersistence: true });
    plan.solution.forEach((k, i) => {
        if (plan.equipsAt.has(i)) run.equipNow(plan.equipsAt.get(i));
        run.advance(k);
    });
    return run.ledger('playerHits');
}

/** The forecast cut at the walk's first tick: `ID`'s centre at tick `t` (`forecast[i]` = the bodies after advance n+1+i). */
function forecastAt(run, t) {
    const ids = run.entities('spinnerBodies').map((b) => b.id);
    const row = run.spinnerForecast(t - run.ticksCompleted)[t - run.ticksCompleted - 1];
    const r = row[ids.indexOf(ID)];
    return { x: r.x + 4, y: r.y + 4 }; // `setHitbox(7, 7, 4, 4)`: the rect's corner + origin
}

describe('fidelity L39HIT — the walk\'s L39 hit is the model\'s (the solver accepted it)', () => {
    it('the rebuilt request plans the walk\'s plan at the defaults: 2864 t dashless, the full pass stopped at block-route', () => OFF(() => {
        const a = solveTheRequest();
        expect(a.ok).toBe(true);
        expect(a.pass).toBe('dashless');
        expect(a.passes.map((p) => [p.pass, p.ok, p.deadline ?? null])).toEqual([['dashless', true, null], ['full', false, 'block-route']]);
        expect(a.plan.verbs).toEqual(['kill', 'l39shaft', 'rope', 'walk']);
        expect(a.plan.solution.length).toBe(2864);
        expect(a.plan.solution.every((k, i) => [...k].sort().join() === [...heldKeysAt(TAPE, i)].sort().join())).toBe(true);
        // ⚠ the plan's drive IS hit, and nothing billed it (`billedHitsOf` counts `forcedHits` only)
        expect(hitsOfPlan(a.plan).map((h) => [h.t, h.source, h.id, h.hits])).toEqual([[HIT, 'spinner-hammer', ID, 1]]);
        expect(a.plan.forcedHits ?? []).toEqual([]);
    }), 120000);

    it('the model steps the game\'s hit at the game\'s tick: t1522, spinner@112,88\'s hammer, the rows at 0 px', () => OFF(() => {
        const run = runTo(1505 - 1);
        const model = [];
        for (let t = 1505; t <= 1545; t += 1) {
            if (EQUIPS.has(t - 1)) run.equipNow(EQUIPS.get(t - 1));
            run.advance(heldKeysAt(TAPE, t - 1));
            const b = run.entities('spinnerBodies').find((s) => s.id === ID);
            model.push([t, run.state.x, run.state.y, run.ledger('playerHits').length, b.x, b.y]);
        }
        const game = FIX.game.map(([t, x, y, hits, , sx, sy]) => [t, x, y, hits, sx, sy]);
        expect(model).toEqual(game);
        expect(FIX.game.find((g) => g[3] > 0)).toEqual([HIT, 117.53913036147111, 243.56207322596796, 1, 19,
            118.84133374576462, 258.2139899789809]);
        // the walk's own two samples are this run's rows, bit for bit (the walk polls ~2 rows behind its tick counter)
        const row = (t) => FIX.game.find((g) => g[0] === t);
        expect([row(1523)[1], row(1523)[2], row(1523)[4]]).toEqual([FIX.walkSamples[0].x, FIX.walkSamples[0].y, 18]);
        expect([row(1542)[1], row(1542)[2]]).toEqual([FIX.walkSamples[1].x, FIX.walkSamples[1].y]);
    }));
});

describe('fidelity L39HIT D2 — `pulserForecastPulse`: the spinner forecast steps the room\'s pulsers', () => {
    it('ships OFF, appended last, with a worker env name', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.pulserForecastPulse).toBe(false);
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).at(-1)).toBe('pulserForecastPulse');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PULSER_FORECAST_PULSE');
    });

    it('the pulse the forecast misses: pulser@64,96 hits spinner@112,88 at t1317 (hits 0 → 1, hitsTimer 30)', () => OFF(() => {
        const run = runTo(1316);
        const before = run.entities('spinnerBodies').find((s) => s.id === ID);
        run.advance(heldKeysAt(TAPE, 1316));
        const after = run.entities('spinnerBodies').find((s) => s.id === ID);
        expect([before.hits, before.hitsTimer, after.hits, after.hitsTimer]).toEqual([0, 0, 1, 30]);
        expect(run.ledger('pulserHits').at(-1)).toEqual({ t: 1317, level: 39, id: 'pulser@64,96' });
    }));

    it('OFF: the forecast cut at the walk\'s first tick leaves the body\'s line at t1318, ~88 px off at the hit, its hammer unpriced', () => OFF(() => {
        const run = runTo(WALK_FROM);
        const at = (t) => forecastAt(run, t);
        const truth = (t) => { const r = FIX.game.find((g) => g[0] === t); return { x: r[5], y: r[6] }; };
        const off = Math.hypot(at(HIT).x - truth(HIT).x, at(HIT).y - truth(HIT).y);
        expect(off).toBeGreaterThan(85);
        expect(off).toBeLessThan(92);
        const stepped = (t) => { const b = runTo(t).entities('spinnerBodies').find((s) => s.id === ID); return { x: b.x, y: b.y }; };
        expect(at(1317)).toEqual(stepped(1317)); // the pulse lands ON t1317's advance; the bodies part from t1318
        expect(Math.hypot(at(1318).x - stepped(1318).x, at(1318).y - stepped(1318).y)).toBeCloseTo(5.75006037578043, 9);
        const box = playerBoxAt(...rowXY(HIT - 1));
        expect(spinnerDanger(run, box, HIT - WALK_FROM).filter((d) => d.id === ID)).toEqual([]);
    }));

    it('ON: the same forecast is the stepped body through t1524, and prices the hammer at t1522 (the game\'s tick, ±0)', () => ON(() => {
        const run = runTo(WALK_FROM);
        // the game's rows where the fixture has them, the stepped model's (0 px with the game, the row above) elsewhere
        const stepped = (t) => { const b = runTo(t).entities('spinnerBodies').find((s) => s.id === ID); return { x: b.x, y: b.y }; };
        for (const t of [1318, 1400]) expect(forecastAt(run, t)).toEqual(stepped(t));
        for (const t of [1521, HIT, 1523, 1524]) {
            const r = FIX.game.find((g) => g[0] === t);
            expect(forecastAt(run, t)).toEqual({ x: r[5], y: r[6] });
        }
        const box = playerBoxAt(...rowXY(HIT - 1));
        const priced = (h) => spinnerDanger(run, box, h).filter((d) => d.id === ID).map((d) => d.arm);
        expect(priced(HIT - WALK_FROM)).toEqual(['hammer']);
        expect(priced(HIT - WALK_FROM - 1)).toEqual([]); // one row early, the same box is clear
    }));

    it('ON: the walk\'s request plans a 3813 t dashless walk whose drive takes no hit', () => ON(() => {
        const a = solveTheRequest();
        expect(a.ok).toBe(true);
        expect(a.pass).toBe('dashless');
        expect(a.plan.solution.length).toBe(3813);
        expect(hitsOfPlan(a.plan)).toEqual([]);
    }), 120000);

    it('ON = OFF in a spinner room with no pulser (L18, `r8-solve-18`\'s boot): the forecast is the same rows', () => {
        const t = parseTape(readFileSync(join(import.meta.dirname, 'fixtures', 'tapes', 'r8-solve-18.json'), 'utf8'));
        const cut = () => {
            const run = createRunForStaging(stagingFromTape(t), atlasLevelSource());
            for (let i = 0; i < 40; i += 1) run.advance(heldKeysAt(t, i));
            return JSON.stringify(run.spinnerForecast(300));
        };
        const off = OFF(cut);
        expect(JSON.parse(off).length).toBe(300);
        expect(ON(cut)).toBe(off);
    });

    it('ON = OFF while the room\'s pulser is unarmed (L39 at boot, before the rope latches its group): 400 rows', () => {
        const cut = () => JSON.stringify(runTo(1).spinnerForecast(400));
        expect(ON(cut)).toBe(OFF(cut));
    });
});

/** The player's position after `t` advances of the tape (the box the next tick's hammer tests). */
function rowXY(t) {
    const run = runTo(t);
    return [run.state.x, run.state.y];
}
