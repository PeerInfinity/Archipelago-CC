/**
 * ⛓⛓⛓ SEEDLING FIDELITY DASH — **THE GAME REFUTED THE SOLVER'S L16 DASH PLAN, AND WHY.**
 *
 * CANCROSS report § D3: L16 → L17 with the Sword, the solver's `all` plan (111 t,
 * `5b1f924b52`) certified 0 hits, and on the game the player is hit and the streams part at
 * t104. D1 (`probe-seedling-dash-window.mjs`) found the cause on the game's own counter,
 * `Bot.slashTests`: a DASH press buys FOUR `Player.slash()` rect tests, the model ran five.
 * `slashnarrow` is 3 frames at 20 × `FP.elapsed` 0.0333 — it wraps on update 5, and the press
 * tick's own `sprites()` is update 1 (`combatVerbs.animCompleteUpdates`). The model's fifth
 * test (fired 88) pulled `rope@32,16`, silencing `arrowtrap@96/112/128,32` a volley early;
 * the game fired at t100 and arrow (100, 52) hit the player at t104.
 *
 * D2 put the game's table behind `combatVerbs.DASH_WINDOW_ROSTER_WIDE`, OFF: at true the
 * solver re-derives two committed campaign segments (`r9-solve-14`, `r9-solve-16`). DASHFLIP
 * turned it ON and re-recorded both on the game. Every row here except the gate's own holds
 * at BOTH arms, so these rows say what the flip bought.
 *
 * The game's answers are `fixtures/dash-window-oracle.json` (every observation sampled) and
 * the refuted tape's recorded stream (`fixtures/refuted/dash-l16-sword-refuted.*`).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DASH_WINDOW_ROSTER_WIDE, SLASH_ANIM_TICKS, SLASH_ANIM_TICKS_GAME,
} from './combatVerbs.js';
import { loadTape } from './fixtures/index.js';
import { buildArrivalStaging, canCross } from './seedlingCanCross.js';
import { solveSegment } from './solverBot.js';
import { atlasLevelSource } from './levelSource.js';
import { diffObservationStreams, parseObservationStream, parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { modelTestsByObservation } from '../../../scripts/procgen/probe-seedling-dash-window.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
const ORACLE = JSON.parse(readFileSync(join(FIX, 'dash-window-oracle.json'), 'utf8'));
const levelSource = atlasLevelSource();

const refutedTape = () => parseTape(readFileSync(join(FIX, 'refuted', 'dash-l16-sword-refuted.tape.json'), 'utf8'));
const refutedStream = () => parseObservationStream(
    readFileSync(join(FIX, 'refuted', 'dash-l16-sword-refuted.expectation.json'), 'utf8'));

/** The model's run of a tape, kept to the end: its stream, presses, volleys and hits. */
function replay(tape) {
    let run = null;
    const ticks = [];
    const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        ticks.push({ t: o.t, x: o.x, y: o.y, level: o.level });
        r = st.next();
    }
    return {
        stream: { ticks, transitions: run.transitions.map((x) => ({ ...x })) },
        presses: run.ledger('presses'),
        volleys: [...new Set(run.ledger('arrowVolleys').map((v) => v.t))],
        hits: run.ledger('playerHits'),
    };
}

/** A DASH thrust's rect is `slashnarrow`'s 1.5 × 0.65 squash: 24 × 20.8 or 20.8 × 24. */
const isDash = (p) => [p.rect.w, p.rect.h].some((d) => Math.abs(d - 20.8) < 1e-9);

describe('fidelity DASH D2 — a dash buys FOUR hit tests in the game', () => {
    // ⛓ DASHFLIP: the roster runs the game's table now (was 5 / 5 behind the gate).
    it('the game\'s table is 5 / 4, and the roster runs it (the gate is ON)', () => {
        expect(SLASH_ANIM_TICKS_GAME).toEqual({ slash: 5, slashnarrow: 4 });
        expect(DASH_WINDOW_ROSTER_WIDE).toBe(true);
        expect(SLASH_ANIM_TICKS.slashnarrow).toBe(4);
    });

    /**
     * ⛓⛓ THE GAME'S OWN COUNTER, AT EVERY OBSERVATION. The model's thrusts with each dash's
     * tests beyond the game's four dropped are exactly `Bot.slashTests`, tick for tick, on both
     * tapes — and the model's own count (no drop) is NOT, at the roster's arm, from the first
     * dash on (obs 11). At the game's arm the drop is a no-op and the two are one statement.
     */
    for (const name of ['dash-l16-sword-all', 'dash-l16-sword-refuted']) {
        it(`${name}: the model's hit tests, four per dash, are the game's \`Bot.slashTests\` at every observation`, () => {
            const o = ORACLE.tapes[name];
            const tape = name === 'dash-l16-sword-all' ? loadTape(name) : refutedTape();
            const { presses } = replay(tape);
            const sword = presses.filter((p) => p.weapon === 'sword');
            const four = sword.filter((p) => !(isDash(p) && p.fired - p.t > SLASH_ANIM_TICKS_GAME.slashnarrow));
            expect(modelTestsByObservation(four, tape.tick_count)).toEqual(o.tests);
            const own = modelTestsByObservation(sword, tape.tick_count);
            if (DASH_WINDOW_ROSTER_WIDE) {
                expect(own).toEqual(o.tests);
            } else {
                const first = own.findIndex((n, t) => n !== o.tests[t]);
                expect(first).toBe(11);
                expect(sword.length - four.length).toBeGreaterThan(0);
            }
        });
    }

    /**
     * ⛓⛓ THE REFUTATION, REPRODUCED OR PINNED. At the game's arm the model reproduces the
     * game's stream of the refuted plan byte for byte, hit included. At the roster's arm it is
     * CANCROSS's divergence exactly — so a flip that does not cure it reds here.
     */
    it('the refuted L16 plan: the game\'s stream, its t100 volley and its hit at t104', () => {
        const got = replay(refutedTape());
        const game = refutedStream();
        const d = diffObservationStreams(game, got.stream);
        const o = ORACLE.tapes['dash-l16-sword-refuted'];
        expect(o.hits.at(-1)).toBe(1);
        expect(o.hits.indexOf(1)).toBe(104);
        expect(game.transitions).toEqual([]);
        if (DASH_WINDOW_ROSTER_WIDE) {
            expect(d).toBeNull();
            expect(got.volleys).toEqual(o.volleys);
            expect(got.hits.map((h) => h.t)).toEqual([104]);
        } else {
            expect(d).toMatch(/^tick 104 differs: expected \(x=95\.47468179647264, y=47\.073553155161804, level=16\), got \(x=98\.56913453912111, y=50\.34171416472171/);
            // the one volley the model's fifth dash test silenced
            expect(o.volleys.filter((t) => !got.volleys.includes(t))).toEqual([100]);
            expect(got.hits).toEqual([]);
        }
    });

    /**
     * ⛓ WHAT THE SOLVER PLANS. At the roster's arm the L16 `all` plan is still CANCROSS's refuted
     * 111 t one (why `canCross` defaults to `none`); at the game's arm it is the committed witness
     * `dash-l16-sword-all` (117 t), which the game reproduced (`--record`, 118 observations).
     */
    it('canCross L16 → L17, dashMode all: the refuted plan behind the gate, the witnessed one past it', () => {
        const r = canCross({ level: 16, exit: 17, arrival: { from: 15 }, inventory: ['sword'], dashMode: 'all' });
        expect(r.verdict).toBe('can');
        const planned = parseTape(JSON.stringify(r.witness.tape));
        if (DASH_WINDOW_ROSTER_WIDE) {
            const w = loadTape('dash-l16-sword-all');
            expect(r.plan.ticks).toBe(117);
            expect(r.plan.hash).toBe('12575cff30');
            expect(planned.inputs).toEqual(w.inputs);
            expect(r.witness.tape.tick_count).toBe(w.tick_count);
        } else {
            expect(r.plan.ticks).toBe(111);
            expect(r.plan.hash).toBe('5b1f924b52');
            expect(planned.inputs).toEqual(refutedTape().inputs);
        }
    }, 60_000);
});

/**
 * ⛓⛓ fidelity DASH D3 — **`out.dashes`: THE EXACT COUNT, EVERY WALK.** `trace.rows[].strategy
 * .swordDash` is one walk's plan, and only the walk rows that survive `seeRow`'s same-tick merge
 * carry it — L16's PULL rung walks to the rope stance with four planned windows and no row says
 * so (SF report residue 1). The solve result now carries `dashes: {count, windows, walks}`:
 * `count` read off the run's own `set slashing` dash arm, `walks` one row per walk the planner
 * was asked for, inner rung walks included. An OPTIONAL field: no caller is required to read it.
 */
describe('fidelity DASH D3 — out.dashes', () => {
    /** `canCross`'s own arrival and goal, solved directly so the result's fields are visible. */
    const solveL16 = (dashMode) => {
        const goal = canCross({ level: 16, exit: 17, arrival: { from: 15 }, inventory: ['sword'], dashMode,
            witness: false }).request.goal;
        const { staging } = buildArrivalStaging({ level: 16, arrival: { from: 15 }, inventory: ['sword'], levelSource });
        staging.despawn = [];
        const run = createRunForStaging(staging, levelSource, { scratchPersistence: true });
        const out = solveSegment({ run, goals: [{ ...goal }], name: 'can-cross', boot: staging.boot, prefix: [], dashMode });
        return { out, run, staging };
    };

    it('L16 all: the count is the run\'s own dashes, and the inner PULL walk\'s windows are in it', () => {
        const { out, run } = solveL16('all');
        expect(out.perTick.length).toBe(DASH_WINDOW_ROSTER_WIDE ? 117 : 111);
        expect(out.dashes.count).toBe(run.dashes.length);
        expect(out.dashes.count).toBe(11);
        expect(out.dashes.windows).toBe(5);
        expect(out.dashes.walks.map((w) => [w.windows, w.pressed])).toEqual([[4, 9], [1, 2]]);
        expect(out.dashes.walks[0].what).toMatch(/-> pull \(rope@32,16\) stance$/);
        expect(out.dashes.walks.reduce((n, w) => n + w.pressed, 0)).toBe(out.dashes.count);
        // ⛔ the under-count the field exists for: the trace's rows carry ONE window
        const rowWindows = out.trace.rows.reduce((n, r) => n + (r.strategy?.swordDash?.windows?.length ?? 0), 0);
        expect(rowWindows).toBe(1);
    }, 60_000);

    it('the committed plan replays with the same dashes (the count is the tape\'s, not the planner\'s)', () => {
        const { out, staging } = solveL16('all');
        const tape = DASH_WINDOW_ROSTER_WIDE ? loadTape('dash-l16-sword-all') : refutedTape();
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s2, h, rn) => { run = rn; } });
        for (let r = st.next(); !r.done; r = st.next()) { /* to the end */ }
        expect(run.dashes.length).toBe(out.dashes.count);
        expect(staging.boot).toEqual({ level: 16, x: 32, y: 64 });
    }, 60_000);

    it('a dashless solve is zero: {count: 0, windows: 0, walks: []}', () => {
        const { out } = solveL16('none');
        expect(out.perTick.length).toBe(206);
        expect(out.dashes).toEqual({ count: 0, windows: 0, walks: [] });
    }, 60_000);
});

