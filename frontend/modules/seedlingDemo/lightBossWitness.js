/**
 * seedlingDemo/lightBossWitness — ⛓⛓⛓ SEEDLING FIDELITY LIGHTS (wave 20, D2): the model's side of a game witness of
 * the L69 fight (`scripts/procgen/probe-seedling-lights.mjs`, `fixtures/lights-witness/*.json`).
 *
 * `modelLightsTrack` replays a tape in the model (`createTapeStepper`) and records, after every tick, what the probe
 * records off the game: the player (and its `hits`), the level, every live `LightBoss` (in UPDATE order: newest
 * first, which is `botMobiles()`'s order), every `LightBossShot` (newest first) and the intro's presence.
 * `compareLightsWitness` holds the two to the bit at every sampled tick (0 px), joined by order.
 */

import { createTapeStepper } from './tapeRunner.js';

/** The model's reading after every tick: `track[t]`. */
export function modelLightsTrack(tape, { levelSource, cameraWitness = null } = {}) {
    let run = null;
    const st = createTapeStepper(tape, {
        levelSource,
        onTick: (t, s, h, rn) => { run = rn; },
        ...(cameraWitness ? { cameraWitness } : {}),
    });
    const track = [];
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        const fight = run ? (run.entities('lightsFight')?.[0] ?? null) : null;
        track[o.t] = {
            t: o.t,
            level: o.level,
            player: { x: o.x, y: o.y },
            hits: run ? run.damage.hits : null,
            hitsTimer: run ? run.damage.hitsTimer : null,
            npc: fight ? (fight.introUp ? 1 : 0) : null,
            fliers: fight ? fight.bodies.filter((b) => !b.removed).reverse().map((b) => ({
                x: b.x, y: b.y, vx: b.vx, vy: b.vy, hits: b.hits, hitsTimer: b.hitsTimer,
                anim: b.dieAnim ? 'die' : 'sit' })) : [],
            shots: fight ? [...fight.shots].reverse().map((s) => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy,
                band: s.band === true })) : [],
            ended: fight ? fight.endedAt : null,
        };
        r = st.next();
    }
    return track;
}

const same = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || a === b;

/**
 * Every sampled tick: the level, the player's position (and `hits`), the intro's presence, every flier's position,
 * velocity, `hits`, `hits_timer` and die anim, and every shot's position — strict equality. A shot within 8 px of the
 * room's edge is compared only when both sides have it (the cull is a shake band there, `levelRun.lightsShotOnScreen`).
 */
export function compareLightsWitness(samples, track, { upto = Infinity } = {}) {
    const disagreements = [];
    let worst = 0;
    let compared = 0;
    const d = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : (same(a, b) ? 0 : Infinity));
    for (const g of samples) {
        if (g.tick > upto) continue;
        const m = track[g.tick];
        if (!m) {
            disagreements.push(`t ${g.tick}: the model has no tick`);
            continue;
        }
        compared += 1;
        if (g.level !== m.level) {
            disagreements.push(`t ${g.tick}: level game ${g.level} model ${m.level}`);
            continue;
        }
        const pd = Math.max(d(g.player.x, m.player.x), d(g.player.y, m.player.y));
        worst = Math.max(worst, pd);
        if (pd > 0) disagreements.push(`t ${g.tick}: player game (${g.player.x}, ${g.player.y}) model (${m.player.x}, ${m.player.y})`);
        if (m.hits !== null && (g.hits !== m.hits || g.hitsTimer !== m.hitsTimer)) {
            disagreements.push(`t ${g.tick}: player hits game ${g.hits}/${g.hitsTimer} model ${m.hits}/${m.hitsTimer}`);
        }
        if (g.level !== 69) continue;
        const gn = g.npc.length;
        if (m.npc !== null && gn !== m.npc) disagreements.push(`t ${g.tick}: intro NPC game ${gn} model ${m.npc}`);
        if (g.fliers.length !== m.fliers.length) {
            disagreements.push(`t ${g.tick}: game ${g.fliers.length} flier(s), model ${m.fliers.length}`);
        } else {
            g.fliers.forEach((gf, i) => {
                const mf = m.fliers[i];
                const fd = Math.max(d(gf.x, mf.x), d(gf.y, mf.y), d(gf.vx, mf.vx), d(gf.vy, mf.vy));
                worst = Math.max(worst, fd);
                if (fd > 0) {
                    disagreements.push(`t ${g.tick}: flier ${i} game (${gf.x}, ${gf.y}) v (${gf.vx}, ${gf.vy}) model `
                        + `(${mf.x}, ${mf.y}) v (${mf.vx}, ${mf.vy})`);
                }
                if (gf.hits !== mf.hits || gf.hitsTimer !== mf.hitsTimer) {
                    disagreements.push(`t ${g.tick}: flier ${i} hits game ${gf.hits}/${gf.hitsTimer} model ${mf.hits}/${mf.hitsTimer}`);
                }
                if ((gf.anim === 'die') !== (mf.anim === 'die')) {
                    disagreements.push(`t ${g.tick}: flier ${i} anim game "${gf.anim}" model "${mf.anim}"`);
                }
            });
        }
        const edge = (s) => s.x < 8 || s.y < 8 || s.x > 152 || s.y > 152;
        const gs = g.shots.filter((s) => !edge(s));
        const ms = m.shots.filter((s) => !edge(s));
        if (gs.length !== ms.length) {
            disagreements.push(`t ${g.tick}: game ${gs.length} shot(s) inside the room, model ${ms.length}`);
        } else {
            gs.forEach((s, i) => {
                const sd = Math.max(d(s.x, ms[i].x), d(s.y, ms[i].y));
                worst = Math.max(worst, sd);
                if (sd > 0) disagreements.push(`t ${g.tick}: shot ${i} game (${s.x}, ${s.y}) model (${ms[i].x}, ${ms[i].y})`);
            });
        }
    }
    return { pass: compared > 0 && disagreements.length === 0, compared, worst, disagreements };
}
