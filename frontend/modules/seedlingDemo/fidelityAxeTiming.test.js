/**
 * ⛓ fidelity AXETIMING D2/D3 — THE AXE TIMING RUNG (`CONTACT_FIDELITY.axeTimingRung`, OFF by default;
 * `solverBot`'s AXE arm, `axeTimingCrossing`).
 *
 *     SpinningAxe.as:49-63   angle += spinRate each update; collideLine hub→hub+32·(cos a, sin a), the 12×12 hub
 *
 * L61's `spinningaxe@160,80` (rate 7, a revolution in 52 updates) hangs over the only corridor west from the L63 door.
 * The corridor walked turns 8.77 rad round the hub relative to the blade in its 55 in-reach ticks, so the AXE arm's
 * stalls are hit at every phase and the ladder EXHAUSTED (survey steps 152/183, sweep legs 529/530 at 06b625050f).
 * The same corridor at the sword's dash speed is in reach for ~20 ticks: the rung stalls at the doorstep, dashes the
 * crossing, certifies it with the probe's own predicate, drives it, and re-plans from the far side.
 *
 * Game witnesses (p4f headless, `botLoadTape`/`botDrain` + `botStatus().hits` per tick; the AXETIMING report's
 * `drivers/game.mjs`), recorded from the rung's plans:
 *   - `axetiming-l61-152-plan` — survey step 152's 227-t plan: 228 game rows, `hits` 0 throughout.
 *   - `axetiming-l61-529-plan` — sweep leg 529's 227-t plan at its row's `seamTime` 5172: likewise.
 *   - `axetiming-l71-598-plan`, `axetiming-l71-600-plan` — sweep legs 598 (122 t) and 600 (181 t), L71's
 *     `spinningaxe@256,144` crossed southward: 0 px, every `hits` the poller read is 0.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { AXE_DODGE_RUNG, AXE_TIMING_RUNG } from './solverBot.js';
import { arrivalSolveRequest } from './wasmArrival.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${name}.json`), 'utf8'));
const S152 = witness('axetiming-l61-152-plan');
const L529 = witness('axetiming-l61-529-plan');
const L497 = witness('axetiming-l54-497-plan');
const L598 = witness('axetiming-l71-598-plan');
const L600 = witness('axetiming-l71-600-plan');

/** The model's replay of a witness against its game rows: the ticks it parts at, and the hits it billed. */
const replay = (W, axeHit) => withContactFidelity({ spinningAxePlayerHit: axeHit }, () => {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(W.tape)), { levelSource: SRC,
        onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        col[r.value.observation.t] = r.value.observation;
        r = st.next();
    }
    const parted = W.rows.filter((g) => !col[g.t] || col[g.t].x !== g.x || col[g.t].y !== g.y
        || col[g.t].level !== g.level).map((g) => g.t);
    return { parted, hits: run.playerHits.map((h) => `t${h.t} ${h.source} ${h.id}`) };
});

describe('AXETIMING D2 — the switch', () => {
    it('ships OFF (both switches), appended after every older key', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.axeTimingRung).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.axeGateTransit).toBe(false);
        expect(CONTACT_FIDELITY_KEYS.slice(-2)).toEqual(['axeTimingRung', 'axeGateTransit']);
    });
    it('its bounds: the AXE arm\'s rest screen, 10 dash-chain phases, a preview bound, a one-radian order margin', () => {
        expect(AXE_TIMING_RUNG).toEqual({ rest: AXE_DODGE_RUNG.rest, offsetStep: 2, maxPreviews: 240, turnMargin: 1 });
    });
});

describe('AXETIMING D3 — the rung\'s plans on the game: 0 px, no hit', () => {
    for (const [name, W, level] of [['axetiming-l61-152-plan', S152, 61], ['axetiming-l61-529-plan', L529, 61],
        ['axetiming-l71-598-plan', L598, 71], ['axetiming-l71-600-plan', L600, 71]]) {
        it(`${name}: a game row for every one of the tape's ${W.tape.tick_count} ticks and t0, every hits reading is 0`, () => {
            expect(W.rows).toHaveLength(W.tape.tick_count + 1);
            expect(new Set(W.rows.filter((g) => 'hits' in g).map((g) => g.hits))).toEqual(new Set([0]));
            expect(W.rows[0]).toMatchObject({ t: 0, level });
        });
        for (const axeHit of [false, true]) {
            it(`${name}: the model replays it at 0 px on every tick and bills no hit (spinningAxePlayerHit ${axeHit ? 'ON' : 'OFF'})`, () => {
                expect(replay(W, axeHit)).toEqual({ parted: [], hits: [] });
            });
        }
    }
});

/**
 * Survey step 152's own staging (the witness tape's header): the solve OFF, ON, and ON beside the axe's player arm.
 */
describe('AXETIMING D2 — survey step 152 (L61 from (208,96) to teleporter@0,160)', () => {
    const staging = stagingFromTape(parseTape(JSON.stringify(S152.tape)));
    const solve = (over) => withContactFidelity(over, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, SRC),
        goals: [{ kind: 'reach-exit', exit: { x: 0, y: 160 } }], name: 'axetiming-152',
        boot: staging.boot, persistence: staging.persistence, log: () => {},
    }).then((s) => ({ ticks: s.out.perTick.length, rows: s.out.rows ?? null }), (e) => ({ refusal: e.message })));
    it('OFF: the ladder EXHAUSTS on the blade (the AXE arm\'s stalls are hit at every phase)', async () => {
        const r = await solve({ axeTimingRung: false });
        expect(r.refusal).toMatch(/the combat ladder is EXHAUSTED\. The corridor passes through danger at \(170\.8,104\.0\) — hazard:spinningaxe@160,80/);
        expect(r.refusal).not.toMatch(/AXETIMING/);
    }, 120000);
    it('ON: SOLVED in 227 t — the witnessed plan', async () => {
        const r = await solve({ axeTimingRung: true });
        expect(r.ticks).toBe(227);
    }, 120000);
    it('ON beside spinningAxePlayerHit: the same 227 t (the run bills no hit on the crossing)', async () => {
        const r = await solve({ axeTimingRung: true, spinningAxePlayerHit: true });
        expect(r.ticks).toBe(227);
    }, 120000);
});

/**
 * ⛓ AND AT THE PAGE'S BUDGET. The page asks 640 work units, then the held retry 2,560 over one work clock
 * (`solveAnytime`); the dashless pass spends 1,976 of the retry, so the full pass has ~584 — less than the AXE arm's
 * stall search costs before it refuses (the sweep's rows: "ran out of 640, then 2560 work units"). The rung is
 * therefore asked FIRST when the walk turns more than a revolution against the blade (`axeTimingFirst`); asked after
 * the search instead, this row refuses like OFF (mutant M3 in the report).
 */
describe('AXETIMING D2 — step 152 at the held retry\'s budget (2,560 work units, the page\'s `solveAnytime`)', () => {
    const staging = stagingFromTape(parseTape(JSON.stringify(S152.tape)));
    const solve = (on) => withContactFidelity({ axeTimingRung: on }, () => {
        const req = arrivalSolveRequest({ staging, solverGoal: { kind: 'reach-exit', exit: { x: 0, y: 160 } },
            levelSource: SRC, records: null });
        const r = solveAnytime({ ...req, budgetWork: 2560, upgradeWindowWork: 85 }, { passes: ANYTIME_PASSES });
        return { ok: r.ok, ticks: r.ok ? r.plan.solution.length : null,
            full: r.passes.find((p) => p.pass === 'full') };
    });
    it('OFF: refused — the full pass is cut at `axe-dodge` inside the AXE arm\'s stall search', () => {
        const r = solve(false);
        expect(r.ok).toBe(false);
        expect(r.full).toMatchObject({ ok: false, deadline: 'axe-dodge', limit: 'budget' });
    }, 120000);
    it('ON: SOLVED 227 t in the full pass, inside its budget', () => {
        const r = solve(true);
        expect(r).toMatchObject({ ok: true, ticks: 227, full: { ok: true, ticks: 227 } });
        expect(r.full.deadline).toBeUndefined();
    }, 120000);
});

/**
 * ⛓ fidelity AXETIMING D2b — `CONTACT_FIDELITY.axeGateTransit` (OFF). Sweep leg 497 arrives in L54 at (136,456), 16 px
 * under `spinningaxe@128,432`'s hub (rate −2), and the goal is the door 8 px below; the walk's gate refused on the
 * axe's WAIT disc before a corridor was planned. Witness `axetiming-l54-497-plan`: the 7-t plan on the game.
 */
describe('AXETIMING D2b — the walk\'s gate times the blade (sweep leg 497, L54)', () => {
    it(`the witness: a game row for every one of the tape's ${L497.tape.tick_count} ticks and t0, the game's hits stay 0, L52 at the end`, () => {
        expect(L497.rows).toHaveLength(L497.tape.tick_count + 1);
        expect(new Set(L497.rows.map((g) => g.hits))).toEqual(new Set([0]));
        expect(L497.rows.at(-1)).toMatchObject({ t: L497.tape.tick_count, level: 52 });
    });
    for (const axeHit of [false, true]) {
        it(`the model replays it at 0 px and bills no hit (spinningAxePlayerHit ${axeHit ? 'ON' : 'OFF'})`, () => {
            expect(replay(L497, axeHit)).toEqual({ parted: [], hits: [] });
        });
    }
    const staging = stagingFromTape(parseTape(JSON.stringify(L497.tape)));
    const solve = (on) => withContactFidelity({ axeGateTransit: on }, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, SRC),
        goals: [{ kind: 'reach-exit', exit: { x: 128, y: 464 } }], name: 'axetiming-497',
        boot: staging.boot, persistence: staging.persistence, log: () => {},
    }).then((s) => ({ ticks: s.out.perTick.length }), (e) => ({ refusal: e.message })));
    it('OFF: the gate refuses on the disc before any corridor', async () => {
        const r = await solve(false);
        expect(r.refusal).toMatch(/the danger map forbids \(136,456\) — hazard:spinningaxe@128,432 \(avoid \(exact\) — disc/);
    }, 60000);
    it('ON: SOLVED in 7 t — the witnessed plan', async () => {
        expect(await solve(true)).toEqual({ ticks: 7 });
    }, 60000);
});
