/**
 * seedling-fidelity-drill — EVERY DRILL OF A MIXED ROOM, STEPPED (`CONTACT_FIDELITY.drillMixedRooms`): the game
 * witnesses' tapes, the staging they boot from (`fidelityRope.ropeStaging`), and the model's samples of a tape — the
 * player, the drills and the chasers, tick by tick. Shared by `scripts/procgen/probe-seedling-drill-mixed.mjs` (plays
 * them on the game, `--record`) and `fidelityDrill.test.js` (replays the recordings against the model at 0 px).
 *
 * L28 holds `drill@80,96`, `drill@128,96` and `bobsoldier@264,168`; `Drill.solids` carries "Enemy" (`Drill.as:35`),
 * so a hop's `collideTypes(solids, …)` can be stopped by the other drill or by the bobsoldier. The witnesses:
 *
 *   drill-l28-pair          the player stands between the two drills (boot (96,64), idle): `drill@128,96` (it
 *                           updates first) is refused its x-hop by `drill@80,96` from t16 on
 *   drill-l28-cliffside     the player walks from (248,200) toward (176,88) (a greedy walk the model plans tick by
 *                           tick): at t65 the player is 46.9 px from `drill@128,96`, and the game's drill does NOT hop
 *                           — its `collideLine("Solid", …)` crosses the opaque half of the CliffSide at (160,112), a
 *                           pixelmask the box-only line did not see. The tape stops at t264 (on t266 a drill's
 *                           on-screen verdict falls inside the camera shake's band, which the model refuses)
 *   drill-l91-bob           L91 (`drill@64,80` and three bobs; Bob's `solids` carry "Enemy" too): the player stands
 *                           at (128,80) (boot (120,72), idle): from t49 `drill@64,80`'s x-hop is refused by `bob@128,64`
 *                           where the previous tick left it
 *   drill-l91-bob-wall      the same room, the player at (120,88) (boot (112,80), idle): at t41 a bob's sweep stops
 *                           against the live drill (Bob's "Enemy" wall, `levelRun.drillWallsNow`)
 *   drill-l28-spear-l25     ROPESTANCE's failing run, re-pointed at the L25 arrival: the spear stance (136,72) the
 *                           solver planned with the drills UNSTEPPED (the interim off) — the game hit the player at
 *                           t59 at (129.34,72.02); the model with the key ON must say the same
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ropeStaging } from './fidelityRope.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const DRILL_WITNESS_DIR = join(HERE, 'fixtures', 'drill-witness');

/** The switches every witness is replayed under: this slice's key (the rest at their defaults). */
export const DRILL_SWITCHES = Object.freeze({ drillMixedRooms: true });

const L28_CUT = { kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 }, obstacle: 'rope@160,64' };

/** Idle ticks after a scripted walk. */
const TAIL = 20;

/**
 * The witnesses. `script` is `{idle}` (stand still that many ticks) or `{walkTo: [x, y], ticks}` (the greedy walk:
 * each tick the keys toward the point, 2 px dead band, planned on the model with the key ON); `plan` is the recorded
 * plan's own keys (the drill-l28-spear-l25 row, whose plan was made with the drills unstepped).
 */
export const DRILL_WITNESSES = Object.freeze([
    Object.freeze({ name: 'drill-l28-pair', boot: { level: 28, x: 96, y: 64 }, items: ['hasSpear'], persistence: [],
        script: { idle: 60 } }),
    Object.freeze({ name: 'drill-l28-cliffside', boot: { level: 28, x: 240, y: 192 }, items: ['hasSpear'],
        persistence: [], script: { walkTo: [176, 88], ticks: 264, tail: 0 } }),
    Object.freeze({ name: 'drill-l91-bob', boot: { level: 91, x: 120, y: 72 }, items: ['hasSpear'], persistence: [],
        script: { idle: 80 } }),
    Object.freeze({ name: 'drill-l91-bob-wall', boot: { level: 91, x: 112, y: 80 }, items: ['hasSpear'], persistence: [],
        script: { idle: 70 } }),
    Object.freeze({ name: 'drill-l28-spear-l25', boot: { level: 28, x: 96, y: 16 }, items: ['hasSpear'],
        persistence: [], script: { plan: 'ropestance-l28-spear', goals: [L28_CUT] } }),
]);

/** The keys of a greedy walk toward `to` from where the run stands (2 px dead band per axis). */
export function greedyKeys(run, to) {
    const k = new Set();
    const dx = to[0] - run.state.x;
    const dy = to[1] - run.state.y;
    if (dx < -2) k.add('left');
    if (dx > 2) k.add('right');
    if (dy < -2) k.add('up');
    if (dy > 2) k.add('down');
    return k;
}

/**
 * The witness's tape. `idle` and `walkTo` are scripted on the model (the walk's keys are read off the run with the key
 * ON, tick by tick); `plan` replays the recorded plan's ticks (`planTicks`, from the fixture or from
 * `ropeSpearPlanUnstepped`).
 */
export async function drillTape(w, { planTicks = null } = {}) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    let perTick;
    if (w.script.idle) {
        perTick = Array.from({ length: w.script.idle }, () => new Set());
    } else if (w.script.walkTo) {
        perTick = withContactFidelity(DRILL_SWITCHES, () => {
            const run = createRunForStaging(staging, atlasLevelSource());
            const out = [];
            for (let i = 0; i < w.script.ticks; i += 1) {
                const k = greedyKeys(run, w.script.walkTo);
                out.push(k);
                run.advance(new Set(k));
            }
            return out;
        });
        perTick = [...perTick, ...Array.from({ length: w.script.tail ?? TAIL }, () => new Set())];
    } else {
        if (!planTicks) throw new Error(`fidelityDrill: ${w.name} replays a recorded plan; pass planTicks`);
        perTick = planTicks.map((k) => new Set(k));
    }
    const tape = buildStagedTape({ staging, perTick, name: w.name });
    return { ...tape, description: `seedling-fidelity-drill: ${w.name} (probe-seedling-drill-mixed.mjs)` };
}

/**
 * The model's samples of a tape, by tick, under `DRILL_SWITCHES` (or `over`): the player (x, y, level, hits), the
 * drills (`run.drills.bodies`: id, x, y, anim) and the chasers (`run.chasers`: id, x, y). A run that throws stops the
 * samples there and says why (`error`).
 */
export async function drillModelSamples(tapeJson, over = DRILL_SWITCHES) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const out = [];
    let events = [];
    let error = null;
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                out[o.t] = {
                    x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0,
                    drills: run ? run.drills.bodies.filter((d) => !d.removed).map((d) => ({ id: d.id, x: d.x, y: d.y,
                        anim: d.anim })) : [],
                    chasers: run ? run.chasers.map((c) => ({ id: c.id, x: c.x, y: c.y })) : [],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        events = run ? run.drills.events : [];
    });
    return { samples: out, events, error };
}

/**
 * Compare a game witness with the model, every sampled tick: the player's position, level and hits; every drill's
 * position and anim and every chaser's position (the game's `Drill` / `Bob` / `BobSoldier` rows joined to the model's
 * by the cheapest pairing within the class), in the boot `level`. `[]` = 0 px everywhere.
 */
export function compareDrillWitness(game, model, level = 28) {
    const bad = [];
    const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)])
        .map((p) => [x, ...p])));
    // The game's rows carry no placement id: join them to the model's by the cheapest pairing (≤ 3 bodies a class).
    const pair = (gs, ms) => {
        let best = null;
        let cost = Infinity;
        for (const p of perms(ms)) {
            const c = gs.reduce((sum, g, i) => sum + Math.hypot(g.x - p[i].x, g.y - p[i].y), 0);
            if (c < cost) { cost = c; best = p; }
        }
        return best ?? [];
    };
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (m.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${m.hits}`);
        if (g.level !== level || m.level !== level) continue;
        const gd = g.drills ?? [];
        if (gd.length !== m.drills.length) {
            bad.push(`t ${g.t}: game has ${gd.length} drill(s), the model ${m.drills.length}`);
            continue;
        }
        const pd = pair(gd, m.drills);
        gd.forEach((d, i) => {
            const b = pd[i];
            if (d.x !== b.x || d.y !== b.y) bad.push(`t ${g.t} ${b.id}: game (${d.x}, ${d.y}) model (${b.x}, ${b.y})`);
            if (d.anim !== b.anim) bad.push(`t ${g.t} ${b.id}: game anim "${d.anim}" model "${b.anim}"`);
        });
        const tags = [...new Set((g.chasers ?? []).map((c) => c.tag))];
        for (const tag of tags) {
            const gc = g.chasers.filter((c) => c.tag === tag);
            const mc = m.chasers.filter((c) => c.id.startsWith(`${tag}@`));
            if (gc.length !== mc.length) {
                bad.push(`t ${g.t}: game has ${gc.length} ${tag}(s), the model ${mc.length}`);
                continue;
            }
            const pc = pair(gc, mc);
            gc.forEach((c, i) => {
                const b = pc[i];
                if (c.x !== b.x || c.y !== b.y) bad.push(`t ${g.t} ${b.id}: game (${c.x}, ${c.y}) model (${b.x}, ${b.y})`);
            });
        }
    }
    return bad;
}
