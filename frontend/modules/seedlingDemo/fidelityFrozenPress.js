/**
 * seedling-fidelity-frozenpress (wave 37) — A PRESS INSIDE AN ICE TURRET'S FREEZE IS LOST; THE FREEZE IS FORECAST
 * FROM THE STATE AT SCHEDULING TIME, AND A PRESS MOVED TO THE FIRST TICK IT DOES NOT REFUSE LANDS.
 * Shared by `scripts/procgen/probe-seedling-frozen-press.mjs` (plays each witness on the game, `--record`) and
 * `fidelityFrozenPress.test.js` (replays the recordings against the model at 0 px).
 *
 * THE GAME (W0):
 *   `IceTurretBlast.update` (prepended, so ahead of the player) calls `Player.freeze(15)` on contact
 *   (`IceTurretBlast.as:18,51-53`); `Player.update` runs `freezeStep()` (`Player.as:532`, `:591-601`) ABOVE
 *   `super.update()`, whose `input()` returns at its first line while `frozenTimer > 0` (`Player.as:1521`) — and
 *   `useItem(Main.primary)` is called from inside `input()`. Fourteen refused ticks, the contact tick first; a
 *   `primary` press on any of them is LOST (`iceTurretBlast.FREEZE_SPAN`). The model refuses to author one
 *   (`levelRun`'s `FROZEN_TICK_PRESS`), so the model of a lost press is the same tape WITHOUT it.
 *   `levelRun.freezeForecastNow` (`run.progress('freezeForecast')`, D1) answers "is the next tick refused" from the
 *   state the previous tick left: the blasts in flight stepped once on copies, and the timer's decrement.
 *
 * WITNESSES (each from the L40 pocket boot, `fidelityTurretCircle.l40PocketBoot`: the Sword, no shield): walk up 12
 * (to y 447.6, facing `iceturret@472,400`, in slash reach) and stand. The first volley touches the player on input
 * 52; the forecast names inputs 52..65 refused and 66 the first that is not (tape INPUT indices; observation t is
 * the state input t − 1 left).
 *   `frozenpress-l40-lost`   — `primary` on t52 (the contact tick) and t65 (the last refused one). The game's
 *     turret takes no hit; the game equals the model of the tape WITHOUT the two presses at 0 px.
 *   `frozenpress-l40-landed` — `primary` on t66 (the forecast's first unrefused tick). The game's turret takes the
 *     hit (observation t68), and the model replays the tape at 0 px.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const FROZENPRESS_WITNESS_DIR = join(HERE, 'fixtures', 'frozenpress-witness');

/** The turret both witnesses stand under. */
export const L40_TURRET = 'iceturret@472,400';

/** The stance: up 12 from the pocket boot, then stand; the tape's length. */
export const FROZENPRESS_UP = 12;
export const FROZENPRESS_TICKS = 120;
/** The forecast's span for the first volley (measured by the model, asserted on the game): refused t52..t65. */
export const FROZENPRESS_SPAN = Object.freeze({ contact: 52, firstFree: 66 });
/** The presses each witness carries. */
export const FROZENPRESS_LOST_PRESSES = Object.freeze([52, 65]);
export const FROZENPRESS_LANDED_PRESSES = Object.freeze([66]);

/** The per-tick held sets: up `FROZENPRESS_UP`, stand, `primary` on `presses`. */
export function frozenPressPerTick(presses) {
    const out = [];
    for (let t = 0; t < FROZENPRESS_TICKS; t += 1) {
        const h = new Set(t < FROZENPRESS_UP ? ['up'] : []);
        if (presses.includes(t)) h.add('primary');
        out.push(h);
    }
    return out;
}

async function frozenPressTape(name, presses, description) {
    const { buildTape } = await import('./botDriverV1.js');
    const { l40PocketBoot } = await import('./fidelityTurretCircle.js');
    const base = await l40PocketBoot({}, name);
    const perTick = frozenPressPerTick(presses);
    const folded = buildTape(perTick, base.boot, name, { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...base, name, tick_count: perTick.length, inputs: folded.inputs, description };
}

export function frozenPressLostTape() {
    return frozenPressTape('frozenpress-l40-lost', FROZENPRESS_LOST_PRESSES,
        'seedling-fidelity-frozenpress W: L40 from the pocket boot (Sword, no shield) — up 12, stand under '
        + 'iceturret@472,400; primary on t52 (the volley\'s contact tick) and t65 (the last refused tick): both LOST '
        + '(probe-seedling-frozen-press.mjs)');
}

export function frozenPressLandedTape() {
    return frozenPressTape('frozenpress-l40-landed', FROZENPRESS_LANDED_PRESSES,
        'seedling-fidelity-frozenpress W: L40 from the pocket boot (Sword, no shield) — up 12, stand under '
        + 'iceturret@472,400; primary on t66 (the forecast\'s first unrefused tick): it lands (observation t68) '
        + '(probe-seedling-frozen-press.mjs)');
}

const turretHitAt = (samples) => samples.find((g) => (g.turret?.hits ?? 0) > 0)?.t ?? null;

export const FROZENPRESS_WITNESSES = Object.freeze({
    'frozenpress-l40-lost': Object.freeze({
        tape: frozenPressLostTape,
        /** The model of a LOST press is the tape without it. */
        modelPresses: Object.freeze([]),
        checks: (samples) => [
            { name: `the game's frozen_timer is > 0 on exactly the observations after inputs `
                + `${FROZENPRESS_SPAN.contact}..${FROZENPRESS_SPAN.firstFree - 1} (t53..t66): fourteen refused inputs`,
            ok: samples.filter((g) => g.frozen > 0 && g.t < 80).map((g) => g.t).join(',')
                === Array.from({ length: 14 }, (_, i) => FROZENPRESS_SPAN.contact + 1 + i).join(','),
            detail: `frozen on ${samples.filter((g) => g.frozen > 0 && g.t < 80).map((g) => g.t).join(',')}` },
            { name: 'the game\'s turret takes no hit from either press (both LOST)', ok: turretHitAt(samples) === null,
                detail: `first turret hit t${turretHitAt(samples)}` },
        ],
    }),
    'frozenpress-l40-landed': Object.freeze({
        tape: frozenPressLandedTape,
        modelPresses: FROZENPRESS_LANDED_PRESSES,
        checks: (samples) => [
            { name: 'the game\'s turret takes the input-66 press\'s hit (observation t68: its first hit test)',
                ok: turretHitAt(samples) === 68,
                detail: `first turret hit t${turretHitAt(samples)}` },
        ],
    }),
});

const TURRET_CLASS = /(^|:)IceTurret$/;

/** The game poll's fold: the player (hits, frozen timer) and the turret (position, hits, i-frame). */
export function frozenPressSampleOf(s, m) {
    const rows = m.mobiles ?? [];
    const t = rows.find((r) => TURRET_CLASS.test(r.cls)) ?? null;
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits, frozen: s.frozen_timer,
        turret: t ? { x: t.x, y: t.y, hits: t.enemy?.hits ?? null, hitsTimer: t.enemy?.hits_timer ?? null } : null,
    };
}

/** The recording's compact row: `[t, level, x, y, hits, frozen, turret "x,y,hits,hitsTimer"]`. */
export function packFrozenPressSample(g) {
    return [g.t, g.level, g.x, g.y, g.hits, g.frozen,
        g.turret ? `${g.turret.x},${g.turret.y},${g.turret.hits},${g.turret.hitsTimer}` : ''];
}

/** The inverse of `packFrozenPressSample`. */
export function unpackFrozenPressSample(row) {
    const [t, level, x, y, hits, frozen, turret] = row;
    let tu = null;
    if (turret) {
        const [tx, ty, th, tt] = turret.split(',').map(Number);
        tu = { x: tx, y: ty, hits: th, hitsTimer: tt };
    }
    return { t, level, x, y, hits, frozen, turret: tu };
}

/**
 * The model's samples of a tape (the witness's MODEL tape: its `modelPresses`), by tape tick — the same stepper and
 * observation indexing `fidelityTurretCircle.turretCircleModelSamples` is proven at 0 px with — and the run's
 * `freezeForecast` asked before each input (`forecast[t]`: will input t be refused). ⚠ Observation `t` is the state
 * input `t − 1` left (observation 0 is the boot), so a press on input `t` shows its first hit test on observation `t + 2`.
 */
export async function frozenPressModelSamples(tapeJson) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    const forecast = [];
    let error = null;
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    try {
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const tu = run ? (run.turretDamage ?? []).find((d) => d.id === L40_TURRET) ?? null : null;
            const body = run ? (run.entities('turrets') ?? new Map()).get(L40_TURRET) : null;
            samples[o.t] = {
                x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                hits: run ? run.damage.hits : 0, frozen: run ? run.frozenTimer : 0,
                turret: body && !body.removed ? { x: body.x, y: body.y, hits: tu?.hits ?? null,
                    hitsTimer: tu?.hitsTimer ?? null } : null,
            };
            // obs `t` is the state the input of tick t-1 left; input t is applied next, so this is input t's forecast.
            if (run) forecast[o.t] = run.progress('freezeForecast');
            r = st.next();
        }
    } catch (e) {
        error = e.code ?? e.message;
    }
    return { samples, forecast, error };
}

/** The model tape of a witness: its own tape's header with `modelPresses` in place of the presses it carries. */
export async function frozenPressModelTape(name) {
    const w = FROZENPRESS_WITNESSES[name];
    const tape = await w.tape();
    if (w.modelPresses === FROZENPRESS_LANDED_PRESSES && name === 'frozenpress-l40-landed') return tape;
    return frozenPressTape(`${name}-model`, w.modelPresses, `${name} without its lost presses (the model of a loss)`);
}

/** Compare a game witness with the model, every sampled tick: the player, its hits and freeze, the turret. */
export function compareFrozenPressWitness(game, model) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) { bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`); continue; }
        if (m.hits !== g.hits) bad.push(`t ${g.t}: player hits game ${g.hits} model ${m.hits}`);
        if (m.frozen !== g.frozen) bad.push(`t ${g.t}: frozen game ${g.frozen} model ${m.frozen}`);
        const tk = (u) => (u ? `${u.x},${u.y},${u.hits},${u.hitsTimer}` : '-');
        if (tk(m.turret) !== tk(g.turret)) bad.push(`t ${g.t}: turret game ${tk(g.turret)} model ${tk(m.turret)}`);
    }
    return bad;
}
