/**
 * seedling-fidelity-l40res (wave 29) — L40's wandlock-hold residues after WANDHOLD.
 *
 * ⛓ D2 (survey step 93, `Totem Part 64,144` from the L39 teleporter, (488,904)). The frontier names
 * `wandlock@448,432` (group 2) nearest the aim. Its opener `button@480,384` stands INSIDE the room it shuts, and the
 * hold stance (488,392) was derived reachable under the stance hypothesis THROUGH the room's south door
 * `wandlock@480,560` (group 3; `buttonroom@880,768` latches, so that door is in the hypothesis, while group 2 is guard
 * (iii)'s weigh-wall and is not). The walk to the stance then named `wandlock@448,432` again: STANCE_REENTRY.
 * `stanceReentryNextDoor` (OFF) walks on along the frontier instead. The south door's hold refuses by name (its
 * presser is behind `chest@880,816` and `burnabletree@872,784`), and the chest is this round's order: the first link
 * of the room's real chain. The new end is the chest walk's danger ladder, `kill (spinner@880,848) by press` (the
 * hammer arc's region, handed over).
 *
 * ⛓ D1 (sweep leg 368, `in_L41_0_160`). At seam time 5290 the solver plans 1600 t, and the game (p4g, headless, damage
 * on) hits the player once at t1222 at (209.20,147.77) — the sweep's tick and point. The MODEL REPLAY TAKES THE SAME
 * HIT, to the bit: `spinner@192,144`'s hammer line, the spinner the walk's own press struck on tick 1204
 * (`fixtures/l40res-witness/l40res-368-s5290.json`). The solver's own expected trajectory carries the knockback. What
 * let the plan through is the dashed walk's certificate: `probeSamples` prices the hammer from `run.spinnerForecast`,
 * which forecasts the spinners WITHOUT the walk's presses, and puts the struck spinner 28.6 px from where it is. That
 * is the hit-aware spinner forecast (the hammer arc's); this file pins the model against the game and the measurement.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { SolverRefusal, stanceHypothesisProbe } from './solverBot.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'l40res-witness', `${n}.json`), 'utf8'));

const STEP93_GOAL = Object.freeze({ kind: 'collect-placement', placement: { x: 64, y: 144 },
    why: 'Level 040 - Totem Part 64,144', location: 'Level 040 - Totem Part 64,144' });

/** Survey step 93's boot (the survey's own staged block at L40@480,896), solved for the part alone. */
async function solveStep93() {
    const staging = fixture('step93-boot');
    const levelSource = atlasLevelSource();
    try {
        await twoPassSolve({
            makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
            goals: [STEP93_GOAL], name: 'l40res', boot: staging.boot, dashMode: 'all',
            persistence: staging.persistence, log: () => {},
        });
    } catch (e) {
        if (e instanceof SolverRefusal) return e;
        throw e;
    }
    return null;
}

describe('L40RES D2 — a stance walk that re-enters its own order walks on along its frontier', () => {
    it('both of this slice\'s switches are ON by default (⚖ user 2026-10-24, planning-12\'s flip)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.stanceReentryNextDoor).toBe(true);
        expect(CONTACT_FIDELITY_DEFAULTS.spinnerLockLag).toBe(true);
    });

    it('the measurement behind it: the south door is in the stance hypothesis, the west door is not', () => {
        const run = createRunForStaging(fixture('step93-boot'), atlasLevelSource());
        const h = stanceHypothesisProbe(run);
        expect(h).toContainEqual({ id: 'wandlock@480,560', kind: 'activator', strategy: 'hold' });
        expect(h.map((r) => r.id)).not.toContain('wandlock@448,432');
        expect(h.map((r) => r.id)).not.toContain('wandlock@512,480');
    });

    it('OFF: survey step 93 refuses STANCE_REENTRY at the west door, the survey\'s text', async () => {
        const e = await withContactFidelity({ stanceReentryNextDoor: false }, solveStep93);
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toContain('-> hold stance (wandlock@448,432): STANCE_REENTRY — the walk to '
            + 'wandlock@448,432\'s `hold` stance (488,392) is itself blocked by wandlock@448,432 at tick 0');
    }, 120_000);

    it('ON: the re-entry passes to the chest (the south door\'s chain); the end is the chest walk\'s press kill', async () => {
        const e = await withContactFidelity({ stanceReentryNextDoor: true }, solveStep93);
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).not.toContain('STANCE_REENTRY');
        expect(e.message).toContain('-> hold stance (wandlock@448,432) -> chest stance (chest@880,816) '
            + '-> kill (spinner@880,848) by press: the player died at t1266 (chaser bob@736,752)');
    }, 300_000);
});

describe('L40RES D1 — leg 368 at seam time 5290: the game\'s t1222 hit is the model\'s too', () => {
    const w = fixture('l40res-368-s5290');
    const tape = parseTape(JSON.stringify(w.tape));

    /** The model run of the witness tape, sampled at the top of each tick (the game rows' alignment). */
    const replay = (upto) => {
        const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
        const rows = new Map();
        const spinners = new Map();
        for (let t = 0; t <= upto; t += 1) {
            rows.set(t, [run.state.x, run.state.y]);
            spinners.set(t, (run.entities('spinnerBodies') ?? []).map((s) => ({ id: s.id, x: s.x, y: s.y,
                hits: s.hits, hitsTimer: s.hitsTimer })));
            if (t === upto) break;
            run.advance(heldKeysAt(tape, t));
        }
        return { run, rows, spinners };
    };

    it('the witness: p4g, the solver\'s 1600 t plan, the game hit once — t1222 at (209.20,147.77)', () => {
        expect(w.page).toBe('seedling_bot_ap_p4g');
        expect(tape.seam.time).toBe(5290);
        const firstHit = w.game.find((r) => r[3] > 0);
        expect(firstHit.slice(0, 4)).toEqual([1222, 209.20268562891582, 147.76630485663475, 1]);
        expect(Math.max(...w.game.map((r) => r[3]))).toBe(1);
    });

    it('the model replays every game tick at 0 px and bills the same hit: spinner@192,144\'s hammer at t1222', () => {
        const { run, rows } = replay(1600);
        const off = w.game.filter((g) => g[0] <= 1600)
            .filter((g) => rows.get(g[0])[0] !== g[1] || rows.get(g[0])[1] !== g[2]);
        expect(off.slice(0, 3)).toEqual([]);
        expect(run.ledger('playerHits').map((h) => [h.t, h.source, h.id, h.hits])).toEqual(
            [[1222, 'spinner-hammer', 'spinner@192,144', 1]]);
    }, 120_000);

    /** The game spinner rows with no bit-exact model body at their tick (`hits` compared where one matches). */
    const unmatched = (spinners) => w.spinners.filter(([t, x, y, , , hits]) => {
        const m = spinners.get(t).find((s) => s.x === x && s.y === y);
        return !m || m.hits !== hits;
    });

    it('spinnerLockLag OFF: spinner@192,160 passes wandlock@208,160 one tick early (the game reflects at t1172)', () => {
        const { spinners } = withContactFidelity({ spinnerLockLag: false }, () => replay(1230));
        const off = unmatched(spinners);
        expect(off[0].slice(0, 3)).toEqual([1172, 204.94974746830587, 162.34314575050757]);
        const m = spinners.get(1172).find((s) => s.id === 'spinner@192,160');
        expect([m.x.toFixed(6), m.y]).toEqual(['205.656854', off[0][2]]);
    }, 120_000);

    it('spinnerLockLag ON: every spinner of the part room matches the game t1160-1230, the struck one too', () => {
        const { spinners } = withContactFidelity({ spinnerLockLag: true }, () => replay(1230));
        expect(w.spinners.length).toBeGreaterThan(200);
        expect(unmatched(spinners)).toEqual([]);
        expect(spinners.get(1204).find((s) => s.id === 'spinner@192,144').hits).toBe(0);
        expect(spinners.get(1205).find((s) => s.id === 'spinner@192,144').hits).toBe(1);
    }, 120_000);

    it('spinnerLockLag ON: the player still replays every game tick at 0 px with the one hammer hit at t1222', () => {
        const { run, rows } = withContactFidelity({ spinnerLockLag: true }, () => replay(1600));
        expect(w.game.filter((g) => g[0] <= 1600)
            .filter((g) => rows.get(g[0])[0] !== g[1] || rows.get(g[0])[1] !== g[2]).slice(0, 3)).toEqual([]);
        expect(run.ledger('playerHits').map((h) => [h.t, h.source, h.id])).toEqual(
            [[1222, 'spinner-hammer', 'spinner@192,144']]);
    }, 120_000);

    it('THE GAP (handed to the hammer arc): the press-blind forecast from before the strike misplaces it by 28.3 px', () => {
        const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
        for (let t = 0; t < 1204; t += 1) run.advance(heldKeysAt(tape, t));
        const idx = run.entities('spinnerBodies').findIndex((s) => s.id === 'spinner@192,144');
        const h = 1222 - 1204;
        const r = run.spinnerForecast(h)[h - 1][idx];
        const forecast = { x: r.x + 4, y: r.y + 4 };
        for (let t = 1204; t < 1222; t += 1) run.advance(heldKeysAt(tape, t));
        const actual = run.entities('spinnerBodies')[idx];
        expect([forecast.x.toFixed(3), forecast.y.toFixed(3)]).toEqual(['231.113', '147.757']);
        expect([actual.x.toFixed(3), actual.y.toFixed(3)]).toEqual(['205.557', '135.582']);
        expect(Math.hypot(actual.x - forecast.x, actual.y - forecast.y)).toBeCloseTo(28.31, 2);
    }, 120_000);
});
