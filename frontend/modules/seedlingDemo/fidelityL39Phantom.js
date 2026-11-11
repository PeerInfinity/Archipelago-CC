/**
 * ⛓⛓ SEEDLING FIDELITY L39PHANTOM (wave 38) — A SPINNER A PULSER KILLED, ON THE GAME: its death, its fade and its
 * removal, tick by tick, against the model at 0 px.
 *
 * THE GAME (`vendor/seedling/src`):
 *   Pulser.as:87-116    every tick of a pulse's growth, `hit()` collects "Player", "Solid" and "Enemy" in the 44x44
 *                       square about the pulser and, for each within `radiusHit` 22 of its rect, an `Enemy` gets
 *                       `(c as Enemy).hit(force 6, pulser point, damage 1, "Pulse")`
 *   Enemy.as:141-181    `hit`: behind `hitsTimer <= 0` (30 after a hit), `!Game.freezeObjects`, `canHit`; "Pulse" is
 *                       not "Fire", so `hits += 1`; at `hits >= hitsMax` (3) → `startDeath` → `destroy = true`
 *   Mobile.as:30-71     a destroyed mobile stops moving and fades, `alpha -= 0.1` a tick, and `FP.world.remove` at
 *                       `alpha <= 0`
 *   Spinner.as:66-76    ⚠ `update` swings the hammer (`collideLine("Player", …)`) AFTER `super.update()` with no
 *                       `destroy` test, so a spinner in its fade is STILL HARMFUL until its removal
 *
 * THE MODEL: `levelRun.stepPulsersNow` (the `t: 'Pulse'` arm, `pulserEnemyKills`), `spinner.hitSpinner` /
 * `stepSpinner`; the run's roster (`run.entities('spinnerBodies')`) lists a spinner until `removed`.
 *
 * The witness (`scripts/procgen/probe-seedling-l39-pulser-kill.mjs`) plays the committed `l39shaft-solver-step66`
 * game witness's tape (the survey's step-66 plan, p4g, the delivered set) and records every `Spinner` row of
 * `botMobiles` over `L39PHANTOM_WINDOW`: in that tape `pulser@64,96` kills `spinner@112,88` at t1267 (the model's
 * `pulserEnemyKills`; the committed witness's spinner count drops on the same tick, and its fold already proves the
 * positions at 0 px up to it). This file is the fold both sides share and the comparison.
 */
import { join } from 'node:path';
import { L39, L39SHAFT_WITNESS_DIR, L39SHAFT_SOLVER_WITNESS, l39LevelSource } from './fidelityL39Shaft.js';

export { L39SHAFT_WITNESS_DIR };
export const L39PHANTOM_WITNESS = 'l39phantom-pulser-kill';
export const L39PHANTOM_SOURCE = L39SHAFT_SOLVER_WITNESS;
export const L39PHANTOM_PATH = join(L39SHAFT_WITNESS_DIR, `${L39PHANTOM_WITNESS}.json`);
/** The ticks recorded: the pulse ring's three hits on `spinner@112,88`, its death at t1267 and its fade, with margin. */
export const L39PHANTOM_WINDOW = Object.freeze({ from: 1180, to: 1300 });
export const L39PHANTOM_SPINNER = 'spinner@112,88';
export const L39PHANTOM_PULSER = 'pulser@64,96';

const FIELDS = ['x', 'y', 'hits', 'hitsTimer', 'destroy', 'alpha'];

/** A row in the shared shape. */
function row(x, y, hits, hitsTimer, destroy, alpha) {
    return { x, y, hits, hitsTimer, destroy: destroy === true, alpha };
}

/** The game's fold: every `Spinner` in `botMobiles`' roster (the world's own list — present until `FP.world.remove`). */
export function gameSpinnerRows(m) {
    return (m.mobiles ?? []).filter((r) => /(^|:)Spinner$/.test(String(r.cls ?? '')))
        .map((r) => row(r.x, r.y, r.enemy?.hits ?? null, r.enemy?.hits_timer ?? null, r.destroy, r.alpha));
}

/** The model's fold: the run's roster (`spinnerBodies`: every spinner not yet `removed`). */
export function modelSpinnerRows(run) {
    return (run.entities('spinnerBodies') ?? []).map((b) => row(b.x, b.y, b.hits, b.hitsTimer, b.destroy, b.alpha));
}

/** `x,y,hits,hitsTimer,destroy(0|1),alpha` per spinner, sorted, `;`-joined. */
export function packSpinnerRows(rows) {
    return rows.map((r) => FIELDS.map((f) => (f === 'destroy' ? (r.destroy ? 1 : 0) : r[f])).join(','))
        .sort().join(';');
}

/** The model's samples of the tape over the window: `{t, level, rows}` by tape tick, and the run's pulser kills. */
export async function l39PhantomModelSamples(tapeJson, over = {}, { set = 'delivered', window = L39PHANTOM_WINDOW } = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const levelSource = await l39LevelSource(set);
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let kills = [];
    let error = null;
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const t = r.value.observation.t;
                if (t > window.to) break;
                if (t >= window.from && run) {
                    samples[t] = { t, level: run.level, rows: run.level === L39 ? modelSpinnerRows(run) : [] };
                }
                r = st.next();
            }
            kills = run ? run.pulserEnemyKills : [];
        } catch (e) {
            error = e.message;
        }
    });
    return { samples, kills, error };
}

/**
 * ⚠ THE ONE MEASURED DISAGREEMENT, NAMED: the model's roster READ lists a spinner whose fade reached `alpha <= 0` for
 * ONE more observation than the game's world does. `Mobile.death` queues `FP.world.remove` on the alpha-zero update and
 * the world drops it at that update's end, so the game's next read has no row; `stepSpinner` sets `removePending` on
 * that step and `removed` at the top of the next (the F5 convention: `assertSpinnerRemovalIsDeclared` already stamps
 * the removal at the alpha-zero step, `ticksCompleted`). Measured (D0, p4g, t1278): the game's roster has 2 rows, the
 * model's 3 — the third `destroy` up, alpha −0.1. Nothing is stepped for it on the next tick (`removed` first), so it is
 * a read fencepost, not a contact; it is not the danger map's (`spinnersTheRunSteps` excludes it either way: it is
 * IN the roster). Named so a fix of it reds this row instead of passing silently.
 */
export function isRemovePendingFencepost(gameRows, modelRows) {
    const gs = gameRows === '' ? [] : gameRows.split(';');
    const ms = modelRows === '' ? [] : modelRows.split(';');
    const extra = ms.filter((r) => !gs.includes(r));
    return ms.length === gs.length + 1 && extra.length === 1 && gs.every((r) => ms.includes(r))
        && extra[0].split(',')[4] === '1' && Number(extra[0].split(',')[5]) <= 0;
}

/**
 * Every tick where the game's packed spinner rows differ from the model's (exact: positions, hits, timer, alpha),
 * and, apart, the ticks that are exactly the named `isRemovePendingFencepost`.
 */
export function compareL39Phantom(game, model) {
    const bad = [];
    const fencepost = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (g.level !== m.level) { bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`); continue; }
        if (g.rows === m.rows) continue;
        if (isRemovePendingFencepost(g.rows, m.rows)) fencepost.push(g.t);
        else bad.push(`t ${g.t}: game [${g.rows}] model [${m.rows}]`);
    }
    return { bad, fencepost };
}

/**
 * The readout: for the spinner whose death the window holds, the tick `destroy` goes up, the last tick it is listed,
 * and the first tick it is gone — off one side's packed rows (`{t, rows}`), keyed by the row count dropping.
 */
export function deathReadout(samples) {
    let destroyAt = null;
    let lastListed = null;
    let goneAt = null;
    let n0 = null;
    for (const s of samples) {
        if (!s) continue;
        const rows = s.rows === '' ? [] : s.rows.split(';');
        n0 ??= rows.length;
        if (destroyAt === null && rows.some((r) => r.split(',')[4] === '1')) destroyAt = s.t;
        if (destroyAt !== null && rows.some((r) => r.split(',')[4] === '1')) lastListed = s.t;
        if (destroyAt !== null && goneAt === null && rows.length < n0) goneAt = s.t;
    }
    return { destroyAt, lastListed, goneAt };
}
