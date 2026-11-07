/**
 * seedling-fidelity-drillwater — A DRILL THAT HOPS ONTO WATER DROWNS (`CONTACT_FIDELITY.drillTerrainSwitch`): the game
 * witnesses' tapes, and the model's samples of a tape with the key ON. Shared by
 * `scripts/procgen/probe-seedling-drill-water.mjs` (plays them on the p4g game, `--record`) and
 * `fidelityDrillWater.test.js` (replays the recordings against the model at 0 px).
 *
 * `Drill.as` overrides none of `dieInWater` / `dieInLava` / `canFallInPit` (`Enemy.as:33,39-40`: all true) and calls
 * `super.update()` first, so `Enemy.update`'s terrain switch (`Enemy.as:62-112`) reads the cell the drill's hop LANDED
 * on at its next on-screen update: water sets `destroy`, `Mobile.death` fades it 0.1 a tick, `World.remove` at alpha
 * <= 0. L91's `drill@64,80` is the one shipped drill with a fatal tile in its hop reach (measured, W0: water (40,120) in
 * 4 hops, (24,120) in 5; L28's two drills and L88's reach none — so no lava or pit witness exists on a shipped drill).
 *
 *   drillwater-l91-drown   boot (32,96) (the player at (40,104)), canSwim; walk to (40,112), then into the water at
 *                          (24,136): the drill hops (72,88)→(56,104) at t1 and (56,104)→(40,120) — WATER — at t16;
 *                          `destroy` at t17; removed after the fade. The player is never touched.
 *   drillwater-l91-floor   the CONTROL: the same boot, idle: the drill hops onto plain floor ((56,104), then (40,104))
 *                          and stays — no `destroy`, and its contact bills as before.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ropeStaging } from './fidelityRope.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const DRILL_WATER_WITNESS_DIR = join(HERE, 'fixtures', 'drillwater-witness');

/** The switches every witness is replayed under: the mixed-room drills (ON by default) and this slice's key. */
export const DRILL_WATER_SWITCHES = Object.freeze({ drillMixedRooms: true, drillTerrainSwitch: true });

const ITEMS = ['hasSpear', 'canSwim'];

/**
 * The witnesses. `script` is `{idle}` or `{path: [[x, y], …], ticks}` (a greedy walk through the waypoints, 2 px dead
 * band per axis, the next waypoint once the keys go empty; planned on the model with the switches ON).
 */
export const DRILL_WATER_WITNESSES = Object.freeze([
    Object.freeze({ name: 'drillwater-l91-drown', boot: { level: 91, x: 32, y: 96 }, items: ITEMS, persistence: [],
        script: { path: [[40, 112], [24, 136]], ticks: 60 } }),
    Object.freeze({ name: 'drillwater-l91-floor', boot: { level: 91, x: 32, y: 96 }, items: ITEMS, persistence: [],
        script: { idle: 40 } }),
]);

/** The keys of a greedy walk toward `to` from where the run stands (2 px dead band per axis). */
function greedyKeys(run, to) {
    const k = new Set();
    const dx = to[0] - run.state.x;
    const dy = to[1] - run.state.y;
    if (dx < -2) k.add('left');
    if (dx > 2) k.add('right');
    if (dy < -2) k.add('up');
    if (dy > 2) k.add('down');
    return k;
}

/** The witness's tape (the walk's keys read off the model, tick by tick, with the switches ON). */
export async function drillWaterTape(w) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    let perTick;
    if (w.script.idle) {
        perTick = Array.from({ length: w.script.idle }, () => new Set());
    } else {
        perTick = withContactFidelity(DRILL_WATER_SWITCHES, () => {
            const run = createRunForStaging(staging, atlasLevelSource());
            const out = [];
            let wi = 0;
            for (let i = 0; i < w.script.ticks; i += 1) {
                let k = greedyKeys(run, w.script.path[wi]);
                if (k.size === 0 && wi < w.script.path.length - 1) {
                    wi += 1;
                    k = greedyKeys(run, w.script.path[wi]);
                }
                out.push(k);
                run.advance(new Set(k));
            }
            return out;
        });
    }
    const tape = buildStagedTape({ staging, perTick, name: w.name });
    return { ...tape, description: `seedling-fidelity-drillwater: ${w.name} (probe-seedling-drill-water.mjs)` };
}

/**
 * The model's samples of a tape, by tick, under `DRILL_WATER_SWITCHES` (or `over`): the player (x, y, level, hits) and
 * every drill still in the world (id, x, y, anim, destroy). A run that throws stops there and says why (`error`).
 */
export async function drillWaterModelSamples(tapeJson, over = DRILL_WATER_SWITCHES) {
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
                        anim: d.anim, destroy: d.destroy === true })) : [],
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
 * Compare a game witness with the model, every sampled tick: the player's position, level and hits, and the drill's
 * position, anim and `destroy` (one drill in L91; a drill the game has REMOVED is absent from both). `[]` = 0 px.
 */
export function compareDrillWaterWitness(game, model) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (m.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${m.hits}`);
        const gd = g.drills ?? [];
        if (gd.length !== m.drills.length) {
            bad.push(`t ${g.t}: game has ${gd.length} drill(s), the model ${m.drills.length}`);
            continue;
        }
        gd.forEach((d, i) => {
            const b = m.drills[i];
            if (d.x !== b.x || d.y !== b.y) bad.push(`t ${g.t} ${b.id}: game (${d.x}, ${d.y}) model (${b.x}, ${b.y})`);
            if (d.anim !== b.anim) bad.push(`t ${g.t} ${b.id}: game anim "${d.anim}" model "${b.anim}"`);
            if ((d.destroy === true) !== b.destroy) bad.push(`t ${g.t} ${b.id}: game destroy ${d.destroy} model ${b.destroy}`);
        });
    }
    return bad;
}
